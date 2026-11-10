-- MIR-16-e. The value `admin` is renamed `org_admin` in place: the type, and the five function
-- bodies that spelled it (ADR-084 decision 2; .ai/board/tickets/MIR-16-e/01-plan.md § 4.1).
--
-- Nobody gains or loses a power. `system_admin` is already a separate account (ADR-074), so this is
-- purely a respelling of the value an org admin's `member.role` holds. Every existing admin becomes
-- an `org_admin` of their org the moment this applies (ADR-082 decision 3): the rename carries the
-- rows, including `member_role_change.from_role` and `to_role`, which are typed on this same enum.
--
-- Idempotent (ADR-024): the rename is guarded so a second run is a no-op, and every body below is
-- `create or replace` from its LATEST definition, with only the value respelled — name, signature,
-- return type, volatility, security mode and search_path unchanged, so existing grants are kept.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The rename. Updates no row, fires no trigger, writes no member_role_change row. Guarded so a
--    second run is a no-op.
-- ---------------------------------------------------------------------------------------------

do $$
begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
              where t.typname = 'member_role' and t.typnamespace = 'public'::regnamespace
                and e.enumlabel = 'admin') then
    alter type public.member_role rename value 'admin' to 'org_admin';
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. The five bodies. Each is its LATEST definition before this migration, respelled.
-- ---------------------------------------------------------------------------------------------

-- public.is_org_admin(uuid, uuid), from 20261107230000_mir16b_is_org_admin.sql.
create or replace function public.is_org_admin(p_uid uuid, p_org_id uuid)
  returns boolean
  language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.member m
    where m.id = p_uid
      and m.org_id = p_org_id
      and m.removed_at is null
      and m.status = 'approved'::public.member_status
      and m.role = 'org_admin'::public.member_role
  );
$$;

-- public.promote_member_to_admin(uuid), from 20261107230000_mir16b_is_org_admin.sql.
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
     set role = 'org_admin'::public.member_role
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) in (select public.member_team_ids((select auth.uid())))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'org_admin'::public.member_role
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

-- public.set_member_role(uuid, public.member_role), from 20261107230000_mir16b_is_org_admin.sql.
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
  if p_role = 'org_admin'::public.member_role then
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
     and m.role <> 'org_admin'::public.member_role
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

-- public.member_enforce_role_and_removal(), from 20261107180000_mir21f_drop_member_team_id.sql.
-- The trigger that points at it is not touched.
create or replace function public.member_enforce_role_and_removal() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- MIR-02, ADR-064 decision 3. **NOBODY HOLDING A USER TOKEN CHANGES THEIR OWN ROLE, STATUS OR
  -- TEAM, BY ANY PATH** — a table PATCH, or a definer function such as `move_member` called on the
  -- caller's own id. This trigger is `security invoker`, but `auth.uid()` reads the request's JWT
  -- claims, so inside a definer function it is still the caller and the clause still fires.
  --
  -- FIRST, before every other clause, so the refusal a self-escalation meets is this one and not a
  -- narrower sentence about demotion or removal.
  --
  -- `v_uid is not null` so a migration, the SQL editor or a service-role call is not blocked, the
  -- carve-out clauses (a) and (d) make. Nothing blocks a service-role key anyway (known weakness 1).
  -- MIR-21-f: the team half of this lock is membership_refuse_own_rows (MIR-21-c, ADR-080).
  if v_uid is not null and old.id = v_uid
     and (new.role    is distinct from old.role
       or new.status  is distinct from old.status) then
    raise exception 'a person may not change their own role, status or team'
      using errcode = '42501';
  end if;

  -- SOLO, 2026-09-10, clause (a). **THE FENCE AROUND THE NEW COLUMN GRANT.** `display_name` and
  -- `avatar` may be changed only by the person the row is about. Without this, step 1's grant plus
  -- the pre-existing `member_update_admin` would let any admin rename any member of their team —
  -- a permission nobody granted and no row in `.ai/standards/rbac-and-security.md` describes.
  --
  -- It is HERE and not in a policy because a policy sees only the new row and therefore cannot say
  -- *these two columns did not change* (known weakness 6). `is distinct from` and not `<>`, so a
  -- null on either side compares correctly — neither column is nullable today, and a comparison that
  -- depends on that staying true is a comparison that fails silently the day it stops.
  --
  -- `v_uid is not null` so a migration, the SQL editor or a service-role call is not blocked, the
  -- same carve-out clause (d) below makes. Nothing blocks a service-role key anyway.
  if v_uid is not null and old.id is distinct from v_uid
     and (new.display_name is distinct from old.display_name
          or new.avatar is distinct from old.avatar) then
    raise exception 'only the member themselves may change their display name or avatar'
      using errcode = '42501';
  end if;

  -- SOLO, 2026-09-10, clause (b). A display name is trimmed and may not be blank. The column is
  -- `text not null` with no check constraint, so '' and '   ' both satisfy the table today and would
  -- render as an empty row in the roster and an empty name on every entry chip.
  --
  -- **TRIMMED HERE, WHICH MEANS THE DATASTORE DECIDES WHAT WAS SAVED.** `updateOwnProfile` in both
  -- seam implementations trims before sending, so this normally changes nothing; it holds for a
  -- caller that is not this application, and it is the reason the seam trims rather than the reason
  -- it does not have to.
  --
  -- NO UPPER BOUND. There is no length limit on this column anywhere — not in TEA-01's table, not in
  -- `.ai/standards/data-model.md`, not at sign-up — and inventing one here would be a rule the other
  -- writer of this column does not apply.
  if new.display_name is distinct from old.display_name then
    new.display_name := btrim(new.display_name);
    if new.display_name = '' then
      raise exception 'a display name may not be blank' using errcode = '23514';
    end if;
  end if;

  -- TEA-04 AC-5. Demotion is denied for everybody, in every context. `Demote an admin to member` is
  -- ❌ for both roles in rbac-and-security.md, marked not decided — denied until it is. The refusal
  -- is asserted here rather than left to the absence of a control, because `role` is granted `update`
  -- for the promotion path and the column is therefore writable in exactly the direction that must
  -- be refused (ADR-005: a control that does not exist refuses nobody holding a token).
  --
  -- MIR-16-e, ADR-084 decision 2. The message names the role: *admin* is now ambiguous between
  -- `org_admin` and `system_admin` (ADR-074), and no test or screen asserts the old text.
  if old.role = 'org_admin'::public.member_role and new.role is distinct from old.role then
    raise exception 'an org admin may not be demoted' using errcode = '42501';
  end if;

  -- TEA-04 AC-10. `public.is_admin` filters `removed_at is null`, so a promoted removed member would
  -- hold a role that answers false everywhere — a row that says `admin` and behaves as nobody.
  if new.role is distinct from old.role and old.removed_at is not null then
    raise exception 'a removed member may not be promoted' using errcode = '42501';
  end if;

  -- Removal is one-way (TEA-04 01-plan.md section 1, Out of scope). Restoring a member is not a
  -- decided permission, and re-dating one is ADR-013's revert condition arriving as an ordinary
  -- UPDATE.
  if old.removed_at is not null and new.removed_at is distinct from old.removed_at then
    raise exception 'a removal may not be undone or re-dated' using errcode = '42501';
  end if;

  -- TEA-04 AC-9. A denial by DEFAULT rather than by decision, and narrower than the `Remove a member`
  -- permission row: the loss it prevents is a one-way door where the sole admin removes themselves,
  -- `is_admin` then answers false for everybody, no promotion is possible, and the roster is
  -- recoverable only by a human editing the database.
  --
  -- `v_uid is not null` so a migration, the SQL editor or a service-role call is not blocked —
  -- nothing blocks a service-role key anyway (known weakness 1). ADR-016 clause (a) does the same.
  if old.removed_at is null and new.removed_at is not null
     and v_uid is not null and old.id = v_uid then
    raise exception 'an admin may not remove themselves' using errcode = '42501';
  end if;

  -- TEA-04 AC-3. Provenance, never trusted from the wire — ADR-016 clause (b), same reasoning. This
  -- is the column INV-04's denominator is defined against and ADR-013's per-date condition reads, so
  -- a caller-supplied or backdated value is not a data-entry mistake: it is a silent rewrite of every
  -- past absence count. The write SUCCEEDS and the supplied value is discarded.
  if old.removed_at is null and new.removed_at is not null then
    new.removed_at := now();
  end if;

  return new;
end;
$$;

-- public.may_decide(uuid), from 20260912100000_solo_manager_role.sql. `role::text` and not a cast
-- literal: the comment there explains why, and it is unaffected by this respelling.
create or replace function public.may_decide(p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.member m
    where m.id = p_uid
      and m.removed_at is null
      and m.status = 'approved'
      and m.role::text in ('org_admin', 'manager')
  );
$$;

commit;
