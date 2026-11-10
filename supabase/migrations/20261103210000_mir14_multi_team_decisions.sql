-- MIR-14: one decider on any of the owner's teams decides a multi-team entry; the approval switches
-- are OR-ed across every team the owner belongs to; a rejection records its rejecter; a manager may
-- decide their own entry, recorded as `self_approved`; a manager may not overturn another person's
-- rejection.
--
-- Implements ADR-073 (which supersedes ADR-035 § Decision item 3) and the three `entry` columns
-- ADR-070 § 4 fixed for this ticket. The write slice only: the queue across teams, the teams an
-- entry affects and the empty-queue fallback are MIR-14-b (ADR-073 decision 9).
--
-- Sections, in order (01-plan.md § 4.1):
--
--   1. columns: rejected_by (+ entry_rejected_by_org_fk), rejected_at, self_approved
--   2. helper: may_decide_entry(uid, owner)
--   3. policies: entry_update_manager rewritten, entry_select_decider added
--   4. entry_apply_approval_setting(): security definer, OR-ed across the owner's active teams
--   5. entry_enforce_decision(): who may decide, the rejecter record, and INV-02's wider reset
--
-- **NO BACKFILL.** A row rejected before this file keeps `rejected_by` null: nobody recorded who
-- rejected it, and inventing a rejecter would forge the record this column exists to keep. Under
-- clause (a1) below (AC-14) only an admin can change such a decision — the rejecter is unknown, so no
-- manager can be shown to be them.
--
-- **IDEMPOTENT** (ADR-024): `add column if not exists`, `drop … if exists` before the constraint and
-- every policy, `create or replace` for every function.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Columns (ADR-070 § 4, verbatim). Not granted to `authenticated` for insert or update: the
--    column grants on `entry` are lists, so a column added later is unwritable from the wire until a
--    grant names it (AC-19). Only clause (b) and (c) below write them.
-- ---------------------------------------------------------------------------------------------

alter table public.entry
  add column if not exists rejected_by   uuid        null,
  add column if not exists rejected_at   timestamptz null,
  add column if not exists self_approved boolean     not null default false;

alter table public.entry drop constraint if exists entry_rejected_by_org_fk;
alter table public.entry
  add constraint entry_rejected_by_org_fk
  foreign key (rejected_by, org_id) references public.member (id, org_id) on delete restrict;

-- ---------------------------------------------------------------------------------------------
-- 2. The helper (ADR-073 decisions 2 and 5). A decider for an owner is:
--      * an admin sharing an active team with the owner — the team's admin is the fallback when a
--        team has no manager, until MIR-16 gives `org_admin` the org (ADR-073 decision 5); or
--      * a member holding `team_role = 'manager'` on any one of the owner's active teams.
--
--    PER TEAM, NOT GLOBAL: `may_decide(uid)` reads `member.role`, so a manager of team A was a
--    decider on every team they share with anyone. Here a manager who is a plain member of the
--    owner's team decides nothing there (AC-6).
--
--    The owner may be the caller: a manager is a member of their own teams, so this answers true for
--    a manager's own entry. That is ADR-073 decision 3, and clause (b) records it as `self_approved`.
-- ---------------------------------------------------------------------------------------------

create or replace function public.may_decide_entry(p_uid uuid, p_owner uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select p_uid is not null and p_owner is not null and (
    (public.is_admin(p_uid) and public.shares_active_team(p_owner, p_uid))
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
$$;

-- `anon` as well as `public`: Supabase's default privileges grant a new function to `anon`
-- directly, and `from public` alone leaves that grant in place (010-catalogue.test.sql, F-1).
revoke all on function public.may_decide_entry(uuid, uuid) from public, anon;
grant execute on function public.may_decide_entry(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Policies. `entry_update_admin`, `entry_update_own`, `entry_select_team` and `entry_delete_*`
--    are not touched.
-- ---------------------------------------------------------------------------------------------

-- `not is_admin` keeps the admin on `entry_update_admin`, exactly as before; this policy is the
-- manager's. Per-team through the helper, replacing `may_decide(caller) and shares_active_team`.
drop policy if exists entry_update_manager on public.entry;
create policy entry_update_manager on public.entry
  for update to authenticated
  using      (not public.is_admin((select auth.uid()))
              and public.may_decide_entry((select auth.uid()), member_id))
  with check (public.may_decide_entry((select auth.uid()), member_id));

-- WITHOUT THIS, A SECOND-TEAM MANAGER'S PATCH IS FILTERED TO ZERO ROWS. An UPDATE with a `WHERE`
-- is also checked against the SELECT policies, and `entry_select_team` admits the caller's primary
-- team only (ADR-072 decision 1). A separate policy rather than a widened `entry_select_team`: that
-- one feeds the absence count (INV-07), and this one must not change any count — it admits only the
-- rows the caller may decide (01-plan.md § 8 Alt 4, AC-20).
drop policy if exists entry_select_decider on public.entry;
create policy entry_select_decider on public.entry
  for select to authenticated
  using (public.may_decide_entry((select auth.uid()), member_id));

-- ---------------------------------------------------------------------------------------------
-- 4. The approval switches, OR-ed across every active team of the owner (ADR-073 decision 6).
--
--    SECURITY DEFINER NOW, AND IT HAS TO BE. Invoker, it read the team row through the caller's
--    select policies, and `team_select_own` admits the primary team only — so the switches of a
--    second team would read as null and be ignored. The function reads nothing but `team`'s two
--    switches for the teams of the row being inserted, and writes only NEW.
--
--    `bool_or` IS NULL WHEN THE OWNER HAS NO ACTIVE TEAM, and null is not false: the entry stays
--    `pending`, which is the behaviour the single-team join had for a teamless owner.
-- ---------------------------------------------------------------------------------------------

create or replace function public.entry_apply_approval_setting() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_needs boolean;
begin
  if new.status is distinct from 'pending'::public.entry_status then
    return new;
  end if;

  select bool_or(case new.type
                   when 'wfh'::public.entry_type then t.wfh_need_approve
                   when 'pto'::public.entry_type then t.pto_need_approve
                 end)
    into v_needs
    from public.team t
   where t.id in (select public.member_team_ids(new.member_id));

  if v_needs is false then
    new.status           := 'approved'::public.entry_status;
    new.approved_by      := null;
    new.approved_at      := now();
    new.rejection_reason := null;
    new.self_approved    := false;
    new.rejected_by      := null;
    new.rejected_at      := null;
  end if;

  return new;
end;
$$;
revoke all on function public.entry_apply_approval_setting() from public, anon;

-- ---------------------------------------------------------------------------------------------
-- 5. The decision trigger. A `create or replace` of the 2026-09-13 body
--    (20260913120000_solo_manager_decision_generated_columns.sql); the trigger itself is unchanged.
-- ---------------------------------------------------------------------------------------------

create or replace function public.entry_enforce_decision() returns trigger
  language plpgsql security invoker set search_path = '' as $$
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
    if not public.is_admin(v_uid)
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
     and not public.is_admin(v_uid)
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
$$;

commit;
