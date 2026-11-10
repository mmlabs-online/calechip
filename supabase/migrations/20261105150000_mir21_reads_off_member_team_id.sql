-- MIR-21: the read slice. Every select policy and read definer function that asked the
-- `member.team_id` COLUMN which team a person is on asks `membership` instead, through one helper.
--
-- Implements ADR-077 decisions 1 and 2, within ADR-072 and ADR-071 (01-plan.md § 4):
--
--   1. the helper `member_roster_team_id(uuid)` and the PostgREST computed field
--      `roster_team_id(public.member)` the seam selects as `team_id:roster_team_id`
--   2. three policies off the column: member_select_team, member_select_pending_admin,
--      busy_day_select_team
--   3. three read functions off the column: list_all_members, list_members_for_team,
--      list_member_directory
--
-- THE ANSWER MOVES WITHOUT CHANGING. A member's roster team is the team of their active primary
-- membership; for a removed member, the team of the row their removal closed; otherwise null. Under
-- ADR-071's mirror (`member_sync_membership`, 20261103120000 § 2) that equals `member.team_id` on
-- every row, and 220-roster-team-from-membership.test.sql AC-1 proves it while the column remains.
--
-- No table, column, constraint or trigger changes. The writers of the column, the column itself,
-- `member_team_id(uuid)` and the mirror stay until MIR-21-b (ADR-077 decision 3). Every rewritten
-- function keeps its name, signature, return type, volatility and security mode, so
-- `create or replace` keeps its grants. Every policy keeps its table, command and `to authenticated`.
--
-- **IDEMPOTENT** (ADR-024): `create or replace` and `drop policy if exists` before every policy.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Helper and computed field (01-plan.md § 4.1).
-- ---------------------------------------------------------------------------------------------

-- ADR-077 decision 1. The active primary row; for a removed member, the row the removal closed;
-- otherwise null. No status filter: the roster carries removed members (ADR-013, INV-04).
create or replace function public.member_roster_team_id(p_member uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select ms.team_id
    from public.membership ms
    join public.member m on m.id = ms.member_id
   where ms.member_id = p_member
     and (   (m.removed_at is null     and ms.left_at is null and ms.is_primary)
          or (m.removed_at is not null and ms.left_at = greatest(m.removed_at, ms.joined_at)))
   order by ms.joined_at desc, ms.id
   limit 1;
$$;
-- `anon` as well as `public`: Supabase's default privileges grant a new function to `anon`
-- directly, and `from public` alone leaves that grant in place (010-catalogue.test.sql, F-1).
revoke all on function public.member_roster_team_id(uuid) from public, anon;
grant execute on function public.member_roster_team_id(uuid) to authenticated;

-- ADR-077 decision 2. A PostgREST computed field: the seam selects it as `team_id:roster_team_id`.
-- Invoker, so a caller only ever passes a row its policies already let it read.
create or replace function public.roster_team_id(p_member public.member) returns uuid
  language sql stable set search_path = '' as $$
  select public.member_roster_team_id(p_member.id);
$$;
revoke all on function public.roster_team_id(public.member) from public, anon;
grant execute on function public.roster_team_id(public.member) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Policies (01-plan.md § 4.2). The count-feeding pair stays on the caller's primary team
--    (ADR-072 decision 1); only the row side moves from the column to the roster team.
-- ---------------------------------------------------------------------------------------------

drop policy if exists member_select_team on public.member;
create policy member_select_team on public.member
  for select to authenticated
  using (public.member_roster_team_id(id) = public.member_primary_team_id((select auth.uid())));

drop policy if exists member_select_pending_admin on public.member;
create policy member_select_pending_admin on public.member
  for select to authenticated
  using (
    public.is_admin((select auth.uid()))
    and public.member_roster_team_id(id) is null
    and status <> 'approved'::public.member_status
    and org_id = public.member_org_id((select auth.uid()))
  );

drop policy if exists busy_day_select_team on public.busy_day;
create policy busy_day_select_team on public.busy_day
  for select to authenticated
  using (
    public.member_roster_team_id(public.busy_day.member_id)
      = public.member_primary_team_id((select auth.uid()))
  );

-- ---------------------------------------------------------------------------------------------
-- 3. Read functions (01-plan.md § 4.3).
-- ---------------------------------------------------------------------------------------------

create or replace function public.list_all_members() returns setof public.member
  language sql stable security definer set search_path = '' as $$
  select m.*
    from public.member m
   where public.is_admin((select auth.uid()))
     and m.org_id = public.member_org_id((select auth.uid()))
     and public.member_roster_team_id(m.id) is not null
   order by m.created_at, m.id;
$$;

create or replace function public.list_members_for_team(p_team_id uuid) returns setof public.member
  language sql stable security definer set search_path = '' as $$
  select m.*
    from public.member m
   where public.is_admin((select auth.uid()))
     and exists (select 1 from public.team t2
                  where t2.id = p_team_id
                    and t2.org_id = public.member_org_id((select auth.uid())))
     and public.member_roster_team_id(m.id) = p_team_id;
$$;

-- MIR-13-b's body (20261103180000 § 2) with the column gone from three places. The directory lists
-- only approved members who are not removed, and for them the roster team is the primary team, so
-- `member_primary_team_id` is the narrower name for the same answer. Clause (b) is "shares a team
-- with the caller", which `shares_active_team` already states. The output column stays `team_id`.
create or replace function public.list_member_directory()
  returns table (id uuid, display_name text, avatar text, team_id uuid, team_name text)
  language sql stable security definer set search_path = '' as $$
  select m.id, m.display_name, m.avatar, public.member_primary_team_id(m.id), t.name
    from public.member m
    join public.team t on t.id = public.member_primary_team_id(m.id)
   where exists (select 1 from public.member_team_ids((select auth.uid())))
     and m.org_id = public.member_org_id((select auth.uid()))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and (
       -- (a) ADR-066 2(a): an admin, within the admin's org.
       public.is_admin((select auth.uid()))
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
$$;

commit;
