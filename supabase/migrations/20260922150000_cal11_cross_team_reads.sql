-- CAL-11. An admin reads any team's entries and roster through the seam.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like its predecessor
-- (20260911180000_solo_many_teams.sql). `tests/permission-model.test.ts` is still owed
-- (.ai/standards/rbac-and-security.md § Known weaknesses 1).
--
-- Decided by ADR-040 decisions 3, 5 and 6, resting on ADR-039 (both ACCEPTED by the operator).
-- 01-plan.md section 1: the read half of a two-row split; CAL-12 is the only consumer.
--
-- **THREE FUNCTIONS AND NO POLICY CHANGE, FOR THE REASON 20260911180000_solo_many_teams.sql'S
-- HEADER ALREADY RECORDS.** Widening `entry_select_team`, `member_select_team` or `team_select_own`
-- with an `or is_admin(...)` clause would silently turn `getTeam()` into a multi-row error for
-- every admin and `listMembers()` into every team's roster — INV-04's denominator on every
-- calendar screen. A `security definer` function checks `is_admin` in its own body and changes no
-- read anybody else makes; the table policies below this line are exactly what they were.
--
-- `set search_path = ''` and schema-qualified names throughout, the shape TEA-01's own definer
-- functions use. `stable`, never `volatile`: these read and write nothing.
--
-- **NO `order by` IN THE FUNCTIONS.** Ordering is the seam's, exactly as the own-team twins order
-- in the seam (`.order(...)`), so a paging window is taken over one order rather than two that
-- could disagree.
--
-- **IDEMPOTENT.** Applied by hand through the SQL editor (ADR-024): `create or replace` throughout,
-- and the grants are idempotent by nature.

begin;

-- The roster of ANY team, removed members included (INV-04 needs them), for an admin.
-- Pending sign-ups have team_id null and cannot match.
create or replace function public.list_members_for_team(p_team_id uuid)
  returns setof public.member
  language sql stable security definer set search_path = '' as $$
  select m.*
    from public.member m
   where public.is_admin((select auth.uid()))
     and m.team_id = p_team_id;
$$;

-- Every entry of ANY team, for an admin. The team predicate is entry_select_team's left side
-- verbatim, with the caller's team replaced by the argument — so a removed member's entries are
-- excluded here exactly as they are from the own-team read (parity; plan section 2, INV-04).
create or replace function public.list_team_entries_for_team(p_team_id uuid)
  returns setof public.entry
  language sql stable security definer set search_path = '' as $$
  select e.*
    from public.entry e
   where public.is_admin((select auth.uid()))
     and public.member_team_id(e.member_id) = p_team_id;
$$;

-- The same, narrowed to entries whose inclusive range overlaps [p_start, p_end]. '[]' is required:
-- the default '[)' would drop every entry touching only p_end (ADR-011 section 1).
create or replace function public.list_team_entries_overlapping_for_team(
  p_team_id uuid, p_start date, p_end date)
  returns setof public.entry
  language sql stable security definer set search_path = '' as $$
  select e.*
    from public.entry e
   where public.is_admin((select auth.uid()))
     and public.member_team_id(e.member_id) = p_team_id
     and e.date_range && daterange(p_start, p_end, '[]');
$$;

revoke all on function public.list_members_for_team(uuid) from public;
revoke all on function public.list_team_entries_for_team(uuid) from public;
revoke all on function public.list_team_entries_overlapping_for_team(uuid, date, date) from public;

grant execute on function public.list_members_for_team(uuid) to authenticated;
grant execute on function public.list_team_entries_for_team(uuid) to authenticated;
grant execute on function public.list_team_entries_overlapping_for_team(uuid, date, date) to authenticated;

commit;
