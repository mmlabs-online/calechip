-- MIR-17-d, ADR-091 decision 1. The application's one notion of *manager* becomes "manages at
-- least one team", read through a new helper and computed field (01-plan.md § 4.1).
--
-- `member_manages_a_team(uuid)` is true when the person holds an active, non-primary or primary
-- `membership` row with `team_role = 'manager'` on an approved, not-removed member — so a
-- second-team manager (one whose roster-team row is `team_role = 'member'`) still manages a team —
-- or, for a removed member, when `member_roster_team_role` still reads `manager` on their closed
-- row, so a removed manager keeps the label they carry today (MIR-16-c AC-2's behaviour).
--
-- `manages_a_team(public.member)` is the computed field PostgREST embeds the same way
-- `roster_team_role(public.member)` already is (20261108090000_mir16c_manager_read_from_membership.sql).
-- It is invoker, not definer, so it is passed only the rows the caller's own policies admit — the
-- same seam RLS already enforces for every other computed field.
--
-- Nobody gains or loses a power. These are reads; every write stays `may_decide_entry`'s
-- (ADR-073). No table, column, enum value, policy, trigger, constraint or grant on an existing
-- object changes.
--
-- IDEMPOTENT (ADR-024): `create or replace` for both functions, same signatures.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. member_manages_a_team(uuid): true when the person manages a team now, or — for a removed
--    person — when the row member_roster_team_role reads says manager.
-- ---------------------------------------------------------------------------------------------

create or replace function public.member_manages_a_team(p_member uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
           select 1
             from public.membership ms
             join public.member m on m.id = ms.member_id
            where ms.member_id = p_member
              and ms.left_at is null
              and ms.team_role = 'manager'::public.team_role
              and m.status = 'approved'::public.member_status
              and m.removed_at is null)
      or coalesce(public.member_roster_team_role(p_member) = 'manager'::public.team_role, false);
$$;
revoke all on function public.member_manages_a_team(uuid) from public, anon;
grant execute on function public.member_manages_a_team(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. manages_a_team(public.member): the computed field, in the shape of roster_team_role.
-- ---------------------------------------------------------------------------------------------

create or replace function public.manages_a_team(p_member public.member) returns boolean
  language sql stable set search_path = '' as $$
  select public.member_manages_a_team(p_member.id);
$$;
revoke all on function public.manages_a_team(public.member) from public, anon;
grant execute on function public.manages_a_team(public.member) to authenticated;

commit;
