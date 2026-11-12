-- MIR-20-b: every impersonation is visible to the org it touched.
--
-- Implements ADR-100 decision 8, second bullet (01-plan.md § 4.1): one security definer read of
-- `public.impersonation`, returning exactly the rows the caller may see —
--   * the `org_admin` of the session's org (`public.is_org_admin`), and
--   * for a session on a team of Org public, that team's manager: an active `membership` on the
--     session's `team_id` with `team_role = 'manager'`, the member approved and not removed.
-- The manager disjunct matches on `team_id` alone, so a team moved out of Org public keeps its
-- manager's sight of what was done to it (AC-13). A system admin has no `member` row and reads none.
--
-- Both log tables stay closed (MIR-20 AC-17): no table, column, index, policy, trigger or grant on
-- an existing object changes. The function writes nothing.
--
-- **IDEMPOTENT** (ADR-024): `create or replace`, and the grants are re-stated.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

create or replace function public.list_impersonation_log()
  returns table (
    id          uuid,
    actor_email text,
    team_id     uuid,          -- null for a whole-org session
    team_name   text,          -- the name stored at the start; null for a whole-org session
    reason      text,
    started_at  timestamptz,
    expires_at  timestamptz,
    ended_at    timestamptz,   -- effective end: i.ended_at, else i.expires_at when <= now(), else null (live)
    reads       integer        -- count of the session's actions other than 'start' and 'end'
  )
  language sql stable security definer set search_path = '' as $$
  select i.id,
         i.actor_email,
         i.team_id,
         i.team_name,
         i.reason,
         i.started_at,
         i.expires_at,
         coalesce(i.ended_at, case when i.expires_at <= now() then i.expires_at end),
         (select count(*)::integer
            from public.impersonation_action a
           where a.impersonation_id = i.id
             and a.action not in ('start', 'end'))
    from public.impersonation i
   where public.is_org_admin((select auth.uid()), i.org_id)
      or (i.team_id is not null
          and exists (select 1
                        from public.membership ms
                        join public.member m on m.id = ms.member_id
                       where ms.member_id = (select auth.uid())
                         and ms.team_id = i.team_id
                         and ms.left_at is null
                         and ms.team_role = 'manager'::public.team_role
                         and m.status = 'approved'::public.member_status
                         and m.removed_at is null))
   order by i.started_at desc, i.id
   limit 200;
$$;
revoke all on function public.list_impersonation_log() from public, anon;
grant execute on function public.list_impersonation_log() to authenticated;

commit;
