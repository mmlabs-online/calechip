-- MIR-15: in Org public a `public` event reaches its own team only — to read, to join and to be
-- notified of — and so the member directory reaches no other team through one. A dedicated org keeps
-- the org-wide `public` scope it has today: the narrowing is a property of the shared tenant, not of
-- the scope.
--
-- Implements ADR-076 decisions 1 to 5, under ADR-059 decision 2 (Org public has every org-wide
-- visibility feature disabled).
--
--   1. org_is_shared(uuid): the one predicate (decision 5)
--   2. the `public` disjunct in the three readers: may_read_event, event_select_visible,
--      is_event_audience (decision 1)
--   3. notify_event_created's recipients follow the reader (decision 2)
--
-- `list_member_directory()` is not redefined: its (c) and (d) reach a member through
-- `may_read_event`, which item 2 changes (decision 3). The admin disjunct is unchanged (decision 4).
-- No stored `scope` is rewritten and no row is updated.
--
-- Bodies are MIR-13-b's (20261103180000 § 2) and MIR-13's (20261103120000 § 5), each with the one
-- disjunct changed. Every replaced function keeps its name, signature, return type, volatility and
-- security mode, so `create or replace` keeps its existing grants.
--
-- **IDEMPOTENT** (ADR-024): `create or replace`, and `drop policy if exists` before the one policy.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The one predicate. Definer: `authenticated` holds no grant on `public.org`. An org id the
--    caller does not hold answers `false`, exactly as a dedicated org does, so it reveals no row.
-- ---------------------------------------------------------------------------------------------

create or replace function public.org_is_shared(p_org_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select coalesce((select o.is_shared_tenant from public.org o where o.id = p_org_id), false);
$$;

-- `anon` as well as `public`: Supabase's default privileges grant a new function to `anon`
-- directly, and `from public` alone leaves that grant in place (010-catalogue.test.sql, F-1).
revoke all on function public.org_is_shared(uuid) from public, anon;
grant execute on function public.org_is_shared(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. The readers. A `public` event is read, and joined, by every member of its org — or, in the
--    shared tenant, by every member of its team.
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
               or (e.scope = 'public'::public.event_scope
                   and (not public.org_is_shared(e.org_id)
                        or e.team_id in (select public.member_team_ids(p_uid))))
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
         or (scope = 'public'::public.event_scope
             and (not public.org_is_shared(org_id)
                  or team_id in (select public.member_team_ids((select auth.uid())))))
         or (scope = 'team'::public.event_scope
             and team_id in (select public.member_team_ids((select auth.uid()))))
         or (scope = 'named'::public.event_scope
             and public.is_event_invitee(id, (select auth.uid())))
         or public.is_event_participant(id, (select auth.uid())))
  );

-- Joining follows reading: `event_attendance_insert_own` and `event_attendance_guard` both ask this.
-- A participant is not in it, so a cross-team attendee who withdraws cannot join again (AC-14).
create or replace function public.is_event_audience(p_event_id uuid, p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.member_team_ids(p_uid))
     and exists (
       select 1 from public.event e
        where e.id = p_event_id
          and e.org_id = public.member_org_id(p_uid)
          and (e.creator_id = p_uid
               or (e.scope = 'public'::public.event_scope
                   and (not public.org_is_shared(e.org_id)
                        or e.team_id in (select public.member_team_ids(p_uid))))
               or (e.scope = 'team'::public.event_scope
                   and e.team_id in (select public.member_team_ids(p_uid)))
               or (e.scope = 'named'::public.event_scope
                   and public.is_event_invitee(e.id, p_uid)))
     );
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. `event_created` goes to whoever `may_read_event` now admits through scope: the org for a
--    `public` event in a dedicated org, the event's team otherwise. `public.notify` still excludes
--    the actor.
-- ---------------------------------------------------------------------------------------------

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
         and ((new.scope = 'public'::public.event_scope and not public.org_is_shared(new.org_id))
              or new.team_id in (select public.member_team_ids(m.id)))
    ),
    'event_created'::public.notification_kind,
    new.id,
    new.name
  );
  return null;
end;
$$;

commit;
