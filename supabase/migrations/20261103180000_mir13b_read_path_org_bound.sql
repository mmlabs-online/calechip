-- MIR-13-b: the read path. Every select policy and read definer function moves off the single-valued
-- `member_team_id` helper; the reads that feed the absence count resolve to the caller's primary
-- team, visibility reads use every active team, and every admin and public read is bounded by the
-- caller's org.
--
-- Implements ADR-072 decisions 1 to 3, which amend ADR-071 decision 5. The helpers are MIR-13's
-- (`member_org_id`, `member_team_ids`, `member_primary_team_id`; 20261103120000 § 1).
--
--   1. count-feeding policies: the primary team (ADR-072 decision 1)
--   2. visibility policies and functions: every active team, bounded by org (decisions 2 and 3)
--   3. admin reads: bounded by org (decision 3)
--
-- No new function, table, column or grant. Every function keeps its name, signature, return type,
-- volatility and security mode, so `create or replace` keeps its existing grants. Every policy keeps
-- its table, command and `to authenticated`.
--
-- After this file no policy and no function other than `member_team_id` itself reads that helper.
-- MIR-21 drops it, with `member.team_id` (ADR-072 decision 4). Readers of the `member.team_id`
-- COLUMN stay where they are until then.
--
-- **IDEMPOTENT** (ADR-024): `create or replace` and `drop policy if exists` before every policy.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Count-feeding policies (01-plan.md § 4.1). The calendar's roster, entries, busy days and team
--    row come from these four reads with no team argument, and `absenceCountsFor` counts whatever
--    they return. Single-valued on the primary team, so the count is one team's (INV-04) and
--    `getTeam()`'s `.maybeSingle()` still sees one row.
-- ---------------------------------------------------------------------------------------------

drop policy if exists member_select_team on public.member;
create policy member_select_team on public.member
  for select to authenticated
  using (team_id = public.member_primary_team_id((select auth.uid())));

drop policy if exists team_select_own on public.team;
create policy team_select_own on public.team
  for select to authenticated
  using (id = public.member_primary_team_id((select auth.uid())));

drop policy if exists entry_select_team on public.entry;
create policy entry_select_team on public.entry
  for select to authenticated
  using (public.member_primary_team_id(member_id) = public.member_primary_team_id((select auth.uid())));

drop policy if exists busy_day_select_team on public.busy_day;
create policy busy_day_select_team on public.busy_day
  for select to authenticated
  using (
    exists (select 1 from public.member m
             where m.id = public.busy_day.member_id
               and m.team_id = public.member_primary_team_id((select auth.uid())))
  );

-- ---------------------------------------------------------------------------------------------
-- 2. Visibility (01-plan.md § 4.2). "On a team" is "has an active membership"; a team-scope event
--    is read by every member of its team, whichever of their teams it is; nothing reaches another
--    org, a public event and an admin's read included.
-- ---------------------------------------------------------------------------------------------

create or replace function public.may_read_event(p_event_id uuid, p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.member_team_ids(p_uid))
     and exists (
       select 1 from public.event e
        where e.id = p_event_id
          and e.org_id = public.member_org_id(p_uid)
          and (public.is_admin(p_uid)
               or e.creator_id = p_uid
               or e.scope = 'public'::public.event_scope
               or (e.scope = 'team'::public.event_scope
                   and e.team_id in (select public.member_team_ids(p_uid)))
               or (e.scope = 'named'::public.event_scope
                   and public.is_event_invitee(e.id, p_uid))
               or public.is_event_participant(e.id, p_uid))
     );
$$;

drop policy if exists event_select_visible on public.event;
create policy event_select_visible on public.event
  for select to authenticated
  using (
    exists (select 1 from public.member_team_ids((select auth.uid())))
    and org_id = public.member_org_id((select auth.uid()))
    and (public.is_admin((select auth.uid()))
         or creator_id = (select auth.uid())
         or scope = 'public'::public.event_scope
         or (scope = 'team'::public.event_scope
             and team_id in (select public.member_team_ids((select auth.uid()))))
         or (scope = 'named'::public.event_scope
             and public.is_event_invitee(id, (select auth.uid())))
         or public.is_event_participant(id, (select auth.uid())))
  );

drop policy if exists event_attendance_select_visible on public.event_attendance;
create policy event_attendance_select_visible on public.event_attendance
  for select to authenticated
  using (
    exists (select 1 from public.member_team_ids((select auth.uid())))
    and exists (select 1 from public.event e where e.id = public.event_attendance.event_id)
    and (status = 'attending'::public.attendance_status
         or member_id = (select auth.uid())
         or public.may_manage_event(event_id, (select auth.uid())))
  );

drop policy if exists event_guest_select_visible on public.event_guest;
create policy event_guest_select_visible on public.event_guest
  for select to authenticated
  using (
    exists (select 1 from public.member_team_ids((select auth.uid())))
    and exists (select 1 from public.event e where e.id = public.event_guest.event_id)
    and (status = 'attending'::public.guest_status
         or public.may_manage_event(event_id, (select auth.uid())))
  );

drop policy if exists notification_select_own on public.notification;
create policy notification_select_own on public.notification
  for select to authenticated
  using (
    recipient_id = (select auth.uid())
    and exists (select 1 from public.member_team_ids((select auth.uid())))
  );

drop policy if exists task_select_own on public.task;
create policy task_select_own on public.task
  for select to authenticated
  using (
    member_id = (select auth.uid())
    and exists (select 1 from public.member_team_ids((select auth.uid())))
  );

drop policy if exists task_insert_own on public.task;
create policy task_insert_own on public.task
  for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and exists (select 1 from public.member_team_ids((select auth.uid())))
  );

drop policy if exists task_update_own on public.task;
create policy task_update_own on public.task
  for update to authenticated
  using (
    member_id = (select auth.uid())
    and exists (select 1 from public.member_team_ids((select auth.uid())))
  )
  with check (
    member_id = (select auth.uid())
    and exists (select 1 from public.member_team_ids((select auth.uid())))
  );

drop policy if exists task_delete_own on public.task;
create policy task_delete_own on public.task
  for delete to authenticated
  using (
    member_id = (select auth.uid())
    and exists (select 1 from public.member_team_ids((select auth.uid())))
  );

-- Recipients are the new event's org only. Before this, a public event addressed every member of
-- the deployment, and `notification_event_org_fk` refused the first recipient in another org, so
-- creating a public event failed once a second org had a member (01-plan.md § 1).
create or replace function public.notify_event_created() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  if new.scope = 'named'::public.event_scope then
    return null;
  end if;

  perform public.notify(
    array(
      select m.id from public.member m
       where m.org_id = new.org_id
         and exists (select 1 from public.member_team_ids(m.id))
         and (new.scope = 'public'::public.event_scope
              or new.team_id in (select public.member_team_ids(m.id)))
    ),
    'event_created'::public.notification_kind,
    new.id,
    new.name
  );
  return null;
end;
$$;

-- EVT-02's body (20260929140000 § 3) with one line changed: an invitee with no active team is
-- refused, as before. Still SECURITY INVOKER.
create or replace function public.save_event(
  p_event_id              uuid,
  p_name                  text,
  p_description           text,
  p_location              text,
  p_start_date            date,
  p_end_date              date,
  p_scope                 public.event_scope,
  p_invitee_ids           uuid[],
  p_capacity              integer default null,
  p_requires_approval     boolean default false,
  p_registration_deadline date    default null
) returns public.event
  language plpgsql security invoker set search_path = '' as $$
declare
  v_event   public.event;
  v_invitee uuid[] := coalesce(p_invitee_ids, '{}'::uuid[]);
begin
  if p_event_id is null then
    insert into public.event (name, description, location, start_date, end_date, scope,
                              capacity, requires_approval, registration_deadline)
    values (p_name, p_description, p_location, p_start_date, p_end_date, p_scope,
            p_capacity, coalesce(p_requires_approval, false), p_registration_deadline)
    returning * into v_event;
  else
    update public.event
       set name                  = p_name,
           description           = p_description,
           location              = p_location,
           start_date            = p_start_date,
           end_date              = p_end_date,
           scope                 = p_scope,
           capacity              = p_capacity,
           requires_approval     = coalesce(p_requires_approval, false),
           registration_deadline = p_registration_deadline
     where id = p_event_id
    returning * into v_event;

    if not found then
      raise exception 'event_not_permitted' using errcode = '42501';
    end if;
  end if;

  if exists (
    select 1 from unnest(v_invitee) as i(member_id)
     where not exists (select 1 from public.member_team_ids(i.member_id))
  ) then
    raise exception 'invalid_event_invitee' using errcode = '22023';
  end if;

  -- Everybody not in the new list goes; all of them when the scope is not `named`. An attendance is
  -- NOT touched — a person taken off the list keeps their place (AC-5).
  delete from public.event_invitee x
   where x.event_id = v_event.id
     and (p_scope <> 'named'::public.event_scope or x.member_id <> all (v_invitee));

  if p_scope = 'named'::public.event_scope then
    insert into public.event_invitee (event_id, member_id)
    select v_event.id, n.member_id
      from (select distinct unnest(v_invitee) as member_id) n
     where not exists (
       select 1 from public.event_invitee x
        where x.event_id = v_event.id
          and x.member_id = n.member_id
     );
  end if;

  return v_event;
end;
$$;

-- MIR-04's body (20261020180000) bounded by the caller's org, with "own team" meaning any of the
-- caller's teams. Every other disjunct is ADR-066's, unchanged.
create or replace function public.list_member_directory()
  returns table (id uuid, display_name text, avatar text, team_id uuid, team_name text)
  language sql stable security definer set search_path = '' as $$
  select m.id, m.display_name, m.avatar, m.team_id, t.name
    from public.member m
    join public.team t on t.id = m.team_id
   where exists (select 1 from public.member_team_ids((select auth.uid())))
     and m.org_id = public.member_org_id((select auth.uid()))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and (
       -- (a) ADR-066 2(a): an admin, within the admin's org.
       public.is_admin((select auth.uid()))
       -- (b) own team: any team the caller is on.
       or m.team_id in (select public.member_team_ids((select auth.uid())))
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

-- ---------------------------------------------------------------------------------------------
-- 3. Admin reads (01-plan.md § 4.3). An admin reads every team of the admin's own org and nothing
--    of another. A `p_team_id` from the client is checked against the caller's org, never trusted.
-- ---------------------------------------------------------------------------------------------

create or replace function public.list_teams() returns setof public.team
  language sql stable security definer set search_path = '' as $$
  select t.*
    from public.team t
   where public.is_admin((select auth.uid()))
     and t.org_id = public.member_org_id((select auth.uid()))
   order by t.created_at, t.id;
$$;

create or replace function public.list_all_members() returns setof public.member
  language sql stable security definer set search_path = '' as $$
  select m.*
    from public.member m
   where public.is_admin((select auth.uid()))
     and m.org_id = public.member_org_id((select auth.uid()))
     and m.team_id is not null
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
     and m.team_id = p_team_id;
$$;

-- `member_primary_team_id` gives the answer the old helper gave under ADR-071's mirror; both filter
-- out removed and unapproved members, so the entries returned do not change.
create or replace function public.list_team_entries_for_team(p_team_id uuid) returns setof public.entry
  language sql stable security definer set search_path = '' as $$
  select e.*
    from public.entry e
   where public.is_admin((select auth.uid()))
     and exists (select 1 from public.team t2
                  where t2.id = p_team_id
                    and t2.org_id = public.member_org_id((select auth.uid())))
     and public.member_primary_team_id(e.member_id) = p_team_id;
$$;

create or replace function public.list_team_entries_overlapping_for_team(p_team_id uuid, p_start date, p_end date)
  returns setof public.entry
  language sql stable security definer set search_path = '' as $$
  select e.*
    from public.entry e
   where public.is_admin((select auth.uid()))
     and exists (select 1 from public.team t2
                  where t2.id = p_team_id
                    and t2.org_id = public.member_org_id((select auth.uid())))
     and public.member_primary_team_id(e.member_id) = p_team_id
     and e.date_range && daterange(p_start, p_end, '[]');
$$;

drop policy if exists member_select_pending_admin on public.member;
create policy member_select_pending_admin on public.member
  for select to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id is null
    and status <> 'approved'::public.member_status
    and org_id = public.member_org_id((select auth.uid()))
  );

drop policy if exists issue_report_select_admin on public.issue_report;
create policy issue_report_select_admin on public.issue_report
  for select to authenticated
  using (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
  );

-- The first path segment is the uploader's uid (issue_image_insert_own). The org is read from the
-- uploader's issue reports, which `issue_report_select_admin` above already bounds by org, and NOT
-- from `public.member`: under the caller's RLS an admin sees only the primary team's roster there,
-- so a `member` subquery would hide the images of every other team's reporter, and of a reporter
-- since removed (03-impl-log.md, Deviations).
drop policy if exists issue_image_select_admin on storage.objects;
create policy issue_image_select_admin on storage.objects
  for select to authenticated
  using (
    bucket_id = 'issue-report'
    and public.is_admin((select auth.uid()))
    and exists (select 1 from public.issue_report r
                 where r.member_id::text = (storage.foldername(objects.name))[1]
                   and r.org_id = public.member_org_id((select auth.uid())))
  );

commit;
