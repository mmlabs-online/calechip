-- MIR-16-b: `is_org_admin(uid, org_id)` replaces `is_admin(uid)` at every call site.
-- .ai/board/tickets/MIR-16-b/01-plan.md § 4.1; ADR-082 decision 2, ADR-083.
--
-- Nobody gains or loses a power. Every admin check used to ask "is this person an admin?" and then,
-- separately, "of the same org as the row?". Each now asks one question with the org named at the
-- call. The predicate that cannot name an org is dropped, so a later check cannot be written without
-- one.
--
-- Two forms, X being the call's existing argument:
--   Form C, the caller's own org: is_admin(X) -> is_org_admin(X, public.member_org_id(X)).
--   Form R, the row's org, only where the same conjunction already requires
--          <row>.org_id = public.member_org_id(X): is_admin(X) -> is_org_admin(X, <row>.org_id).
--          The existing conjunct stays word for word.
-- A person belongs to exactly one org, so both forms answer what is_admin(X) answered at that site.
--
-- Still reads role = 'admin'. MIR-16-d renames the value to 'org_admin' (ADR-083 decision 2).
-- Idempotent (ADR-024): create or replace, drop policy if exists, drop function if exists.

begin;

-- ---------------------------------------------------------------------------------------------
-- Step 1: the predicate.
-- ---------------------------------------------------------------------------------------------

create or replace function public.is_org_admin(p_uid uuid, p_org_id uuid)
  returns boolean
  language sql stable security definer set search_path = ''
as $$
  -- MIR-16-b, ADR-083. Still reads 'admin'. MIR-16-d renames the value to 'org_admin'.
  select exists (
    select 1 from public.member m
    where m.id = p_uid
      and m.org_id = p_org_id
      and m.removed_at is null
      and m.status = 'approved'::public.member_status
      and m.role = 'admin'::public.member_role
  );
$$;

revoke all on function public.is_org_admin(uuid, uuid) from public, anon;
grant execute on function public.is_org_admin(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Step 2a: the 19 functions. Each body is pg_get_functiondef after 20261107210000, with only the
-- call expression changed (Form C, or Form R in may_manage_event and may_read_event). The grants
-- on each are kept by create or replace, so none is restated.
-- ---------------------------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.admit_member(p_member_id uuid, p_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))) then
    raise exception 'only an admin can decide a sign-up' using errcode = '42501';
  end if;
  if not exists (select 1 from public.team t
                  where t.id = p_team_id
                    and t.org_id = public.member_org_id((select auth.uid()))) then
    raise exception 'no such team' using errcode = '42501';
  end if;

  update public.member
     set status = 'approved'::public.member_status
   where id = p_member_id
     and public.member_roster_team_id(id) is null
     and status = 'pending'::public.member_status
     and org_id = public.member_org_id((select auth.uid()));
  if not found then
    raise exception 'that sign-up is not waiting for a decision' using errcode = '42501';
  end if;

  perform public.membership_make_primary(p_member_id, p_team_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.create_team(p_name text)
 RETURNS public.team
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.team;
begin
  if not public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))) then
    raise exception 'only an admin can create a team' using errcode = '42501';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'a team needs a name' using errcode = '22023';
  end if;

  -- `overload_threshold` and `created_at` take their column defaults: 0.5 and now().
  insert into public.team (name) values (btrim(p_name)) returning * into v_row;
  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_team(p_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))) then
    raise exception 'only an admin can delete a team' using errcode = '42501';
  end if;
  if not exists (select 1 from public.team t
                  where t.id = p_team_id
                    and t.org_id = public.member_org_id((select auth.uid()))) then
    raise exception 'no such team' using errcode = '42501';
  end if;
  if exists (select 1 from public.member m where public.member_roster_team_id(m.id) = p_team_id) then
    raise exception 'a team with people on it cannot be deleted' using errcode = '23503';
  end if;

  delete from public.team
   where id = p_team_id
     and org_id = public.member_org_id((select auth.uid()));
  if not found then
    raise exception 'no such team' using errcode = '42501';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.entry_enforce_decision()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  v_uid uuid := (select auth.uid());
begin
  -- CAL-02 AC-12. The datastore's own clock, never the client's: an UPDATE must name a value for
  -- every column it writes, and this line overwrites whatever a caller might send — which is why
  -- `updated_at` is absent from the update grant and cannot be sent at all. A timestamp a client can
  -- set is a record that can be backdated.
  new.updated_at := now();

  -- (a) ADM-05 — ADR-016 section 1, WIDENED BY ADR-035, MADE PER TEAM BY ADR-073. Only a DECIDER
  -- may move the four decision columns, and a decider is an admin sharing a team with the owner or a
  -- manager of one of the owner's teams (`may_decide_entry`).
  --
  -- THIS IS NOT EXPRESSIBLE AS A POLICY, and that is why it is here. An RLS `with check` sees the
  -- NEW row and has no OLD, so "`status` did not change" cannot be written; and CAL-02's
  -- `entry_update_own` admits a member's own row, so a raw PATCH {"status":"approved"} against it
  -- satisfies the policy and the entry is approved by the person who wrote it. A column grant cannot
  -- help either: `member`, `manager` and `admin` are the SAME PostgreSQL role, `authenticated`, so
  -- revoking `status` from it blocks the admin too.
  --
  -- The three columns ADR-070 § 4 added are not in this test: no grant lets the wire write them
  -- (AC-19), so only clauses (b) and (c) below ever move them.
  --
  -- v_uid is null in a migration, the SQL editor or a service-role call; that context is not
  -- blocked, because nothing blocks a service-role key anyway (known weakness 1).
  if (new.status           is distinct from old.status
   or new.rejection_reason is distinct from old.rejection_reason
   or new.approved_by      is distinct from old.approved_by
   or new.approved_at      is distinct from old.approved_at)
     and v_uid is not null then

    -- ADR-073 decision 3 SUPERSEDES ADR-035 § Decision item 3: a manager MAY decide their own entry,
    -- and clause (b) records it as `self_approved`. The own-entry refusal that stood here is gone;
    -- `may_decide_entry` answers true for a manager's own entry because they manage their own team.
    if not public.may_decide_entry(v_uid, old.member_id) then
      raise exception 'only an admin, or a manager of one of this person''s teams, may decide this entry'
        using errcode = '42501';
    end if;

    -- (a1) ADR-073 decision 4. FIRST DECISION WINS, AND A REJECTION IS NOT OVERTURNED BY A PEER.
    -- Only the rejecter, or an admin, may move a decision column of a rejected entry — approving it
    -- and rewriting its reason alike. A rejection made before MIR-14 carries no rejecter, so only an
    -- admin can change it (this file's header). An approved entry is NOT protected the same way:
    -- "any rejection rejects" (AC-13), and a second approval is a no-op in clause (b) (AC-12).
    if not public.is_org_admin(v_uid, public.member_org_id(v_uid))
       and old.status = 'rejected'::public.entry_status
       and old.rejected_by is distinct from v_uid then
      raise exception 'only the person who rejected this entry, or an admin, may change that decision'
        using errcode = '42501';
    end if;
  end if;

  -- (a2) FIXED 2026-09-13: `date_range` and `portion_slots` are also masked — PostgreSQL computes
  -- stored generated columns AFTER the BEFORE triggers run, so NEW does not yet carry OLD's values.
  -- MIR-14: the three decision columns ADR-070 § 4 added are masked with the four existing ones,
  -- and the decider test is per team (`may_decide_entry`).
  --
  -- (a2) ADR-035 § Decision item 4 — **THE CONTAINMENT, AND THE WHOLE REASON A MANAGER IS NOT AN
  -- ADMIN.** `entry_update_manager` admits the row, and the row carries the owner's dates, type,
  -- portion, tentativeness and note. Without this clause, "a manager may approve" would in fact read
  -- "a manager may rewrite anybody's entry", which is the power ADR-035 § Rationale refuses.
  --
  -- **A MASKED WHOLE-ROW COMPARISON RATHER THAN A COLUMN LIST**, so a column added to `entry` later
  -- is covered on the day it is added rather than on the day somebody remembers this file. The names
  -- removed are the decision columns plus `updated_at`, which the line at the top of this function
  -- has already moved and which is therefore never the caller's doing.
  --
  -- IT DOES NOT FIRE ON A MANAGER'S OWN ENTRY: that write is `entry_update_own`'s, and a manager
  -- edits their own entry on exactly the terms every member does.
  if v_uid is not null
     and old.member_id <> v_uid
     and not public.is_org_admin(v_uid, public.member_org_id(v_uid))
     and public.may_decide_entry(v_uid, old.member_id)
     and (to_jsonb(new) - '{status,rejection_reason,approved_by,approved_at,rejected_by,rejected_at,self_approved,updated_at,date_range,portion_slots}'::text[])
         is distinct from
         (to_jsonb(old) - '{status,rejection_reason,approved_by,approved_at,rejected_by,rejected_at,self_approved,updated_at,date_range,portion_slots}'::text[]) then
    raise exception 'a manager may only decide an entry, not edit it'
      using errcode = '42501';
  end if;

  -- (b) ADM-05 — ADR-016 section 1. PROVENANCE, NEVER TRUSTED FROM THE WIRE, IN EITHER DIRECTION.
  --
  -- `approved_by` and, since MIR-14, `rejected_by` are the only audit trail the product has, and
  -- known weakness 3 means nothing anywhere would contradict a forged one. Written here, they also
  -- make CAL-05's "displaying who approved is not approving" true by construction rather than by a
  -- story remembering it.
  --
  -- `v_uid` is whoever decided, so a manager's approval records the manager. The screens that render
  -- `approved_by` name a person, not a role, so none of them needed a change.
  --
  -- `self_approved` is about THE CURRENT APPROVAL ONLY (AC-11): set on the transition into
  -- `approved`, and false on every other outcome.
  --
  -- A SECOND APPROVAL CHANGES NOTHING (AC-12): `approved` to `approved` matches no branch, so
  -- `approved_by` and `approved_at` keep the first decider's values. First decision wins.
  --
  -- A REJECTION RECORDS ITS REJECTER (ADR-073, audit A10's rejection half): on the transition into
  -- `rejected`, and again on a reason rewrite, which is a new decision by whoever made it (INV-03).
  --
  -- Nulling `rejection_reason` on approval is FORCED, not chosen: the biconditional check
  -- `entry_rejection_reason_iff_rejected` refuses any transition off `rejected` that leaves the
  -- reason standing, and would surface as a raw 23514 (INV-03).
  if new.status = 'approved'::public.entry_status
     and old.status is distinct from 'approved'::public.entry_status then
    new.approved_by      := v_uid;
    new.approved_at      := now();
    new.rejection_reason := null;
    new.self_approved    := (v_uid is not null and v_uid = old.member_id);
    new.rejected_by      := null;
    new.rejected_at      := null;
  elsif new.status = 'rejected'::public.entry_status
     and (old.status is distinct from 'rejected'::public.entry_status
          or new.rejection_reason is distinct from old.rejection_reason) then
    new.rejected_by   := v_uid;
    new.rejected_at   := now();
    new.approved_by   := null;
    new.approved_at   := null;
    new.self_approved := false;
  elsif new.status is distinct from 'approved'::public.entry_status then
    new.approved_by   := null;
    new.approved_at   := null;
    new.self_approved := false;
    if new.status is distinct from 'rejected'::public.entry_status then
      new.rejected_by := null;
      new.rejected_at := null;
    end if;
  end if;

  -- (c) INV-02, and the rejected-entry hole closed with it (ADR-016 section 3). CAL-01's and
  -- CAL-02's, with MIR-14's three columns cleared alongside the four. RUNS LAST, ON PURPOSE: it
  -- overrides whatever (b) recorded, because a substantive edit revokes the decision outright.
  --
  -- A substantive edit revokes the decision: dates, type, portion and tentative are substantive;
  -- `note` alone is NOT, which is data-model.md's own carve-out.
  --
  -- It is ACTOR-BLIND on purpose: an admin's edit under CAL-03 revokes approval exactly as the
  -- owner's does. INV-02's text carries no actor qualifier — and it still does not, which is why
  -- neither ADR-035 nor ADR-073 amends an invariant. A manager reaches this clause only through their
  -- own entry, since (a2) refused every other substantive edit they could have sent.
  if (new.start_date is distinct from old.start_date
   or new.end_date   is distinct from old.end_date
   or new.type       is distinct from old.type
   or new.portion    is distinct from old.portion
   or new.tentative  is distinct from old.tentative)
     and old.status <> 'pending'::public.entry_status then
    new.status           := 'pending'::public.entry_status;
    new.approved_by      := null;
    new.approved_at      := null;
    new.rejection_reason := null;
    new.rejected_by      := null;
    new.rejected_at      := null;
    new.self_approved    := false;
  end if;

  return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.list_all_members()
 RETURNS SETOF public.member
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.*
    from public.member m
   where public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid())))
     and m.org_id = public.member_org_id((select auth.uid()))
     and public.member_roster_team_id(m.id) is not null
   order by m.created_at, m.id;
$function$
;

CREATE OR REPLACE FUNCTION public.list_member_directory()
 RETURNS TABLE(id uuid, display_name text, avatar text, team_id uuid, team_name text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.id, m.display_name, m.avatar, public.member_primary_team_id(m.id), t.name
    from public.member m
    join public.team t on t.id = public.member_primary_team_id(m.id)
   where exists (select 1 from public.member_team_ids((select auth.uid())))
     and m.org_id = public.member_org_id((select auth.uid()))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and (
       -- (a) ADR-066 2(a): an admin, within the admin's org.
       public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid())))
       -- (b) own team: any team the caller is on.
       or public.shares_active_team(m.id, (select auth.uid()))
       -- (c) creator of an event the caller reads; invitee of an event the caller manages.
       or exists (select 1 from public.event e
                   where e.creator_id = m.id
                     and public.may_read_event(e.id, (select auth.uid())))
       or exists (select 1 from public.event_invitee i
                   where i.member_id = m.id
                     and public.may_manage_event(i.event_id, (select auth.uid())))
       -- (d) attendance the caller can see: event_attendance_select_visible's predicate.
       or exists (select 1 from public.event_attendance a
                   where a.member_id = m.id
                     and public.may_read_event(a.event_id, (select auth.uid()))
                     and (a.status = 'attending'::public.attendance_status
                          or public.may_manage_event(a.event_id, (select auth.uid()))))
       -- (e) actor of a notification addressed to the caller.
       or exists (select 1 from public.notification n
                   where n.actor_id = m.id
                     and n.recipient_id = (select auth.uid()))
     );
$function$
;

CREATE OR REPLACE FUNCTION public.list_members_for_team(p_team_id uuid)
 RETURNS SETOF public.member
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select m.*
    from public.member m
   where public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid())))
     and exists (select 1 from public.team t2
                  where t2.id = p_team_id
                    and t2.org_id = public.member_org_id((select auth.uid())))
     and public.member_roster_team_id(m.id) = p_team_id;
$function$
;

CREATE OR REPLACE FUNCTION public.list_team_entries_for_team(p_team_id uuid)
 RETURNS SETOF public.entry
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select e.*
    from public.entry e
   where public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid())))
     and exists (select 1 from public.team t2
                  where t2.id = p_team_id
                    and t2.org_id = public.member_org_id((select auth.uid())))
     and public.member_primary_team_id(e.member_id) = p_team_id;
$function$
;

CREATE OR REPLACE FUNCTION public.list_team_entries_overlapping_for_team(p_team_id uuid, p_start date, p_end date)
 RETURNS SETOF public.entry
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select e.*
    from public.entry e
   where public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid())))
     and exists (select 1 from public.team t2
                  where t2.id = p_team_id
                    and t2.org_id = public.member_org_id((select auth.uid())))
     and public.member_primary_team_id(e.member_id) = p_team_id
     and e.date_range && daterange(p_start, p_end, '[]');
$function$
;

CREATE OR REPLACE FUNCTION public.list_teams()
 RETURNS SETOF public.team
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select t.*
    from public.team t
   where public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid())))
     and t.org_id = public.member_org_id((select auth.uid()))
   order by t.created_at, t.id;
$function$
;

CREATE OR REPLACE FUNCTION public.may_decide_entry(p_uid uuid, p_owner uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select p_uid is not null and p_owner is not null and (
    (public.is_org_admin(p_uid, public.member_org_id(p_uid)) and public.shares_active_team(p_owner, p_uid))
    or exists (
      select 1
        from public.membership c
        join public.member cm on cm.id = c.member_id
       where c.member_id = p_uid
         and c.left_at is null
         and c.team_role = 'manager'::public.team_role
         and cm.removed_at is null
         and cm.status = 'approved'::public.member_status
         and c.team_id in (select public.member_team_ids(p_owner))
    )
  );
$function$
;

CREATE OR REPLACE FUNCTION public.may_manage_event(p_event_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (
    select 1 from public.event e
     where e.id = p_event_id
       and ((e.creator_id = p_uid and exists (select 1 from public.member_team_ids(p_uid)))
            or (public.is_org_admin(p_uid, e.org_id) and e.org_id = public.member_org_id(p_uid)))
  );
$function$
;

CREATE OR REPLACE FUNCTION public.may_read_event(p_event_id uuid, p_uid uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select exists (select 1 from public.member_team_ids(p_uid))
     and exists (
       select 1 from public.event e
        where e.id = p_event_id
          and e.org_id = public.member_org_id(p_uid)
          and (public.is_org_admin(p_uid, e.org_id)
               or e.creator_id = p_uid
               or (e.scope = 'public'::public.event_scope
                   and (not public.org_is_shared(e.org_id)
                        or e.team_id in (select public.member_team_ids(p_uid))))
               or (e.scope = 'team'::public.event_scope
                   and e.team_id in (select public.member_team_ids(p_uid)))
               or (e.scope = 'named'::public.event_scope
                   and public.is_event_invitee(e.id, p_uid))
               or public.is_event_participant(e.id, p_uid))
     );
$function$
;

CREATE OR REPLACE FUNCTION public.move_member(p_member_id uuid, p_team_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))) then
    raise exception 'only an admin can move somebody between teams' using errcode = '42501';
  end if;
  if not exists (select 1 from public.team t
                  where t.id = p_team_id
                    and t.org_id = public.member_org_id((select auth.uid()))) then
    raise exception 'no such team' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.member m
     where m.id = p_member_id
       and public.member_roster_team_id(m.id) is not null
       and m.status = 'approved'::public.member_status
       and m.removed_at is null
       and m.org_id = public.member_org_id((select auth.uid()))
  ) then
    raise exception 'that person cannot be moved' using errcode = '42501';
  end if;

  perform public.membership_make_primary(p_member_id, p_team_id);
end;
$function$
;

CREATE OR REPLACE FUNCTION public.promote_member_to_admin(p_member_id uuid)
 RETURNS public.member
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row public.member;
begin
  if not public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))) then
    raise exception 'only an admin can promote a member' using errcode = '42501';
  end if;

  update public.member m
     set role = 'admin'::public.member_role
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) in (select public.member_team_ids((select auth.uid())))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'admin'::public.member_role
  returning m.* into v_row;

  if not found then
    raise exception 'that member could not be promoted' using errcode = '42501';
  end if;

  update public.membership ms
     set team_role = 'member'::public.team_role, updated_at = now()
   where ms.member_id = p_member_id
     and ms.left_at is null
     and ms.is_primary;

  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.reject_member(p_member_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))) then
    raise exception 'only an admin can decide a sign-up' using errcode = '42501';
  end if;

  update public.member m
     set status = 'rejected'::public.member_status
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) is null
     and m.status = 'pending'::public.member_status
     and m.org_id = public.member_org_id((select auth.uid()));
  if not found then
    raise exception 'that sign-up is not waiting for a decision' using errcode = '42501';
  end if;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.rename_team(p_team_id uuid, p_name text)
 RETURNS public.team
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_row public.team;
begin
  if not public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))) then
    raise exception 'only an admin can rename a team' using errcode = '42501';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'a team needs a name' using errcode = '22023';
  end if;

  update public.team set name = btrim(p_name)
   where id = p_team_id
     and org_id = public.member_org_id((select auth.uid()))
  returning * into v_row;
  if not found then
    raise exception 'no such team' using errcode = '42501';
  end if;
  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_member_role(p_member_id uuid, p_role public.member_role)
 RETURNS public.member
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row public.member;
begin
  if not public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))) then
    raise exception 'only an admin can change a rank' using errcode = '42501';
  end if;

  -- ADR-065 decision 2.
  if p_role = 'admin'::public.member_role then
    raise exception 'promotion to admin is promote_member_to_admin, not a rank change'
      using errcode = '42501';
  end if;

  update public.member m
     set role = p_role
   where m.id = p_member_id
     -- ADR-065 decision 1. Also excludes a person with no roster team: `in` never matches a null.
     and public.member_roster_team_id(m.id) in (select public.member_team_ids((select auth.uid())))
     and m.org_id = public.member_org_id((select auth.uid()))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'admin'::public.member_role
  returning m.* into v_row;

  -- Not on the caller's teams, another org, pending, removed, an admin, or nobody. One answer.
  if not found then
    raise exception 'that rank could not be changed' using errcode = '42501';
  end if;

  update public.membership ms
     set team_role = case when p_role = 'manager'::public.member_role
                          then 'manager'::public.team_role else 'member'::public.team_role end,
         updated_at = now()
   where ms.member_id = p_member_id
     and ms.left_at is null
     and ms.is_primary;

  return v_row;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.set_member_team(p_member_id uuid, p_team_id uuid)
 RETURNS public.member
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_row public.member;
begin
  if not public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))) then
    raise exception 'only an admin can move a member' using errcode = '42501';
  end if;

  select m.* into v_row
    from public.member m
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) in (select public.member_team_ids((select auth.uid())))
     and p_team_id = public.member_roster_team_id(m.id);
  if not found then
    raise exception 'that member could not be moved' using errcode = '42501';
  end if;

  return v_row;
end;
$function$
;

-- ---------------------------------------------------------------------------------------------
-- Step 2b: the 12 policies. Same name, table, command and role; only the call is replaced.
-- ---------------------------------------------------------------------------------------------

drop policy if exists entry_delete_admin on public.entry;
create policy entry_delete_admin on public.entry
  for delete to authenticated
  using (
    public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid())))
    and public.shares_active_team(member_id, (select auth.uid()))
  );

drop policy if exists entry_update_admin on public.entry;
create policy entry_update_admin on public.entry
  for update to authenticated
  using (
    public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid())))
    and public.shares_active_team(member_id, (select auth.uid()))
  )
  with check (
    public.shares_active_team(member_id, (select auth.uid()))
  );

drop policy if exists entry_update_manager on public.entry;
create policy entry_update_manager on public.entry
  for update to authenticated
  using      (not public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid())))
              and public.may_decide_entry((select auth.uid()), member_id))
  with check (public.may_decide_entry((select auth.uid()), member_id));

drop policy if exists event_delete_manage on public.event;
create policy event_delete_manage on public.event
  for delete to authenticated
  using (
    (creator_id = (select auth.uid())
     and exists (select 1 from public.member_team_ids((select auth.uid()))))
    or (public.is_org_admin((select auth.uid()), org_id)
        and org_id = public.member_org_id((select auth.uid())))
  );

drop policy if exists event_select_visible on public.event;
create policy event_select_visible on public.event
  for select to authenticated
  using (
    exists (select 1 from public.member_team_ids((select auth.uid())))
    and org_id = public.member_org_id((select auth.uid()))
    and (public.is_org_admin((select auth.uid()), org_id)
         or creator_id = (select auth.uid())
         or (scope = 'public'::public.event_scope
             and (not public.org_is_shared(org_id)
                  or team_id in (select public.member_team_ids((select auth.uid())))))
         or (scope = 'team'::public.event_scope
             and team_id in (select public.member_team_ids((select auth.uid()))))
         or (scope = 'named'::public.event_scope
             and public.is_event_invitee(id, (select auth.uid())))
         or public.is_event_participant(id, (select auth.uid())))
  );

drop policy if exists event_update_manage on public.event;
create policy event_update_manage on public.event
  for update to authenticated
  using (
    (creator_id = (select auth.uid())
     and exists (select 1 from public.member_team_ids((select auth.uid()))))
    or (public.is_org_admin((select auth.uid()), org_id)
        and org_id = public.member_org_id((select auth.uid())))
  )
  with check (
    (creator_id = (select auth.uid())
     and exists (select 1 from public.member_team_ids((select auth.uid()))))
    or (public.is_org_admin((select auth.uid()), org_id)
        and org_id = public.member_org_id((select auth.uid())))
  );

drop policy if exists holiday_delete_admin on public.holiday;
create policy holiday_delete_admin on public.holiday
  for delete to authenticated
  using (
    public.is_org_admin((select auth.uid()), org_id)
    and org_id = public.member_org_id((select auth.uid()))
    and not public.org_is_shared(org_id)
  );

drop policy if exists holiday_insert_admin on public.holiday;
create policy holiday_insert_admin on public.holiday
  for insert to authenticated
  with check (
    public.is_org_admin((select auth.uid()), org_id)
    and org_id = public.member_org_id((select auth.uid()))
    and not public.org_is_shared(org_id)
  );

drop policy if exists holiday_update_admin on public.holiday;
create policy holiday_update_admin on public.holiday
  for update to authenticated
  using (
    public.is_org_admin((select auth.uid()), org_id)
    and org_id = public.member_org_id((select auth.uid()))
    and not public.org_is_shared(org_id)
  )
  with check (
    public.is_org_admin((select auth.uid()), org_id)
    and org_id = public.member_org_id((select auth.uid()))
    and not public.org_is_shared(org_id)
  );

drop policy if exists member_select_pending_admin on public.member;
create policy member_select_pending_admin on public.member
  for select to authenticated
  using (
    public.is_org_admin((select auth.uid()), org_id)
    and public.member_roster_team_id(id) is null
    and status <> 'approved'::public.member_status
    and org_id = public.member_org_id((select auth.uid()))
  );

drop policy if exists member_update_admin on public.member;
create policy member_update_admin on public.member
  for update to authenticated
  using (
    public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid())))
    and public.member_roster_team_id(id) in (select public.member_team_ids((select auth.uid())))
  )
  with check (
    public.member_roster_team_id(id) in (select public.member_team_ids((select auth.uid())))
  );

drop policy if exists team_update_admin on public.team;
create policy team_update_admin on public.team
  for update to authenticated
  using      (id = public.member_primary_team_id((select auth.uid()))
              and public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))))
  with check (id = public.member_primary_team_id((select auth.uid()))
              and public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))));

-- ---------------------------------------------------------------------------------------------
-- Step 3: the old predicate. No cascade: a missed caller fails the migration rather than
-- silently losing a policy.
-- ---------------------------------------------------------------------------------------------

drop function if exists public.is_admin(uuid);

commit;
