-- MIR-16-c: the manager rank is read from `membership.team_role`, not from `member.role`.
-- ADR-085 decision 1 (.ai/board/tickets/MIR-16-c/01-plan.md § 4.1).
--
-- 1. `member_roster_team_role(uuid)` and the computed field `roster_team_role(public.member)`, in
--    the shape of `member_roster_team_id` (20261105150000_mir21_reads_off_member_team_id.sql:35-58):
--    the same row, its `team_role`.
-- 2. `membership_make_primary` (20261105210000_mir21b_writers_write_membership.sql:39-76) stops
--    reading `member.role` for the role it writes, and reads the member's current active primary
--    row's `team_role` instead, read BEFORE the close of that row.
-- 3. `may_decide(uuid)` retires (ADR-085 decision 1). No caller but the two pgTAP files this ticket
--    also changes. No `cascade`: a policy that still referenced it would make this statement fail,
--    which is the check that nothing does.
--
-- Nobody gains or loses a power. The decider already reads the per-team role (ADR-073,
-- `may_decide_entry`). No table, column, enum value, policy, trigger, constraint or grant changes.
--
-- IDEMPOTENT (ADR-024): `create or replace` for every function, `drop function if exists` for the
-- retirement.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The roster team role.
-- ---------------------------------------------------------------------------------------------

create or replace function public.member_roster_team_role(p_member uuid) returns public.team_role
  language sql stable security definer set search_path = '' as $$
  select ms.team_role
    from public.membership ms
    join public.member m on m.id = ms.member_id
   where ms.member_id = p_member
     and (   (m.removed_at is null     and ms.left_at is null and ms.is_primary)
          or (m.removed_at is not null and ms.left_at = greatest(m.removed_at, ms.joined_at)))
   order by ms.joined_at desc, ms.id
   limit 1;
$$;
revoke all on function public.member_roster_team_role(uuid) from public, anon;
grant execute on function public.member_roster_team_role(uuid) to authenticated;

create or replace function public.roster_team_role(p_member public.member) returns public.team_role
  language sql stable set search_path = '' as $$
  select public.member_roster_team_role(p_member.id);
$$;
revoke all on function public.roster_team_role(public.member) from public, anon;
grant execute on function public.roster_team_role(public.member) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. membership_make_primary, from 20261105210000_mir21b_writers_write_membership.sql:39-76, with
--    one change: v_role is the team_role of the member's current active primary row, else
--    'member'. Read BEFORE the close of the old primary row. Everything else verbatim, including
--    the revoke.
-- ---------------------------------------------------------------------------------------------

create or replace function public.membership_make_primary(p_member_id uuid, p_team_id uuid)
  returns void
  language plpgsql security invoker set search_path = '' as $$
declare
  v_org  uuid;
  v_role public.team_role;
begin
  select m.org_id into v_org
    from public.member m
   where m.id = p_member_id;

  select coalesce(
           (select ms.team_role from public.membership ms
             where ms.member_id = p_member_id and ms.left_at is null and ms.is_primary),
           'member'::public.team_role)
    into v_role;

  if exists (select 1 from public.membership ms
              where ms.member_id = p_member_id and ms.team_id = p_team_id
                and ms.left_at is null and ms.is_primary) then
    return;
  end if;

  update public.membership ms
     set left_at = now(), is_primary = false, updated_at = now()
   where ms.member_id = p_member_id
     and ms.left_at is null
     and ms.is_primary;

  update public.membership ms
     set is_primary = true, team_role = v_role, updated_at = now()
   where ms.member_id = p_member_id
     and ms.team_id = p_team_id
     and ms.left_at is null;
  if not found then
    insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at)
    values (v_org, p_team_id, p_member_id, v_role, true, now());
  end if;
end;
$$;
revoke all on function public.membership_make_primary(uuid, uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. may_decide retires (ADR-085 decision 1).
-- ---------------------------------------------------------------------------------------------

drop function if exists public.may_decide(uuid);

commit;
