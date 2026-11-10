-- MIR-14-b: a decider's worklist names the owner of every entry they may decide, and shows the
-- teams that entry affects.
--
-- Implements ADR-073 decisions 1, 7 and 9 (01-plan.md § 4.1):
--
--   * decision 1 — the teams an entry affects are the owner's ACTIVE `membership` rows, derived
--     here at the moment of the question through `member_team_ids`. Nothing is stored.
--   * decision 7 — when a team has no active manager, its admin is the decider. `may_decide_entry`
--     (MIR-14) already answers that, so this read names those owners to that admin unchanged.
--   * decision 9 — this is the queue slice of MIR-14, split by operation.
--
-- WHY A DEFINER READ AND NOT A WIDER POLICY. `member_select_team` is primary-team only (ADR-072
-- decision 1) because it feeds the absence count, so a second-team manager's queue holds the entry
-- (`entry_select_decider`) and no roster row naming its owner. Widening that policy would put
-- second-team members on the roster and in INV-04's denominator. This function reveals the name,
-- avatar and active teams of an owner ONLY to a caller `may_decide_entry` admits — someone who can
-- already select the entry and who decides it on behalf of every team it affects (ADR-073
-- decision 4).
--
-- No table, column, policy, trigger or constraint changes.
--
-- **IDEMPOTENT** (ADR-024): `create or replace`, and the grants are re-stated.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

create or replace function public.list_entry_owners(p_member_ids uuid[])
  returns table (member_id uuid, display_name text, avatar text, team_id uuid, team_name text)
  language sql stable security definer set search_path = '' as $$
  select m.id, m.display_name, m.avatar, t.id, t.name
    from public.member m
    join public.team t on t.id in (select public.member_team_ids(m.id))
   where m.id = any (coalesce(p_member_ids, '{}'::uuid[]))
     and public.may_decide_entry((select auth.uid()), m.id)
   order by m.id, t.name, t.id;
$$;

-- `anon` as well as `public`: Supabase's default privileges grant a new function to `anon`
-- directly, and `from public` alone leaves that grant in place (010-catalogue.test.sql, F-1).
revoke all on function public.list_entry_owners(uuid[]) from public, anon;
grant execute on function public.list_entry_owners(uuid[]) to authenticated;

commit;
