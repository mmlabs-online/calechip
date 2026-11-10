-- MIR-13-b AC-1, AC-2 and AC-4 to AC-9: no policy or function reads the single-valued team helper,
-- the four count-feeding reads stay on the caller's primary team, visibility reads span every active
-- team, and every admin and public read is bounded by the caller's org (ADR-072).
--
-- Org A is the shared tenant the seed lives in. Admin A is `admin_t` on `team_t` (T1); T3 is
-- `team_u`. K is `member_t`, given an active non-primary row on T3 below. N is `member_u` (primary
-- T3). Org B, T2, M2, P2, E2, B2, R2, M2's image and V2 are this file's (01-plan.md § 2).
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(49);
select tests.seed();

create function tests.m13b(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('b1600000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('org_b', 'b0'), ('team_2', 'b2'), ('m2', 'c2'), ('p2', 'd2'),
      ('entry_2', 'e1'), ('report_2', 'e4'), ('event_2', 'e2'),
      ('report_u', 'a4')
    ) as v(label, nn)
   where v.label = p_label;
$$;

-- An event created as an authenticated caller, by its name: `id` is not an insertable column.
-- Definer, so it answers whatever the caller's select policy shows.
create function tests.event_named(p_name text) returns uuid
  language sql stable security definer set search_path = '' as $$
  select e.id from public.event e where e.name = p_name;
$$;

-- Definer: it is read while authenticated, and `authenticated` holds no grant on `public.org`.
create function tests.org_a() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

-- Org B, as the owner.
insert into public.org (id, org_code, name) values (tests.m13b('org_b'), 'org-b-mir13b-160', 'Org B');
insert into public.team (id, name, org_id) values (tests.m13b('team_2'), 'Team 2', tests.m13b('org_b'));
insert into auth.users (id, email) values
  (tests.m13b('m2'), 'm2@mir13b-160.test'),
  (tests.m13b('p2'), 'p2@mir13b-160.test');
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m13b('m2'), tests.m13b('org_b'), 'M2', '1.png', 'member', 'approved', 'm2@mir13b-160.test');
-- MIR-21-f: no team column; M2's team is its membership row, which the entry's stamp reads.
select tests.put_on_team(tests.m13b('m2'), tests.m13b('team_2'));
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m13b('p2'), tests.m13b('org_b'), 'P2', '1.png', 'member', 'pending', 'p2@mir13b-160.test');
insert into public.entry (id, member_id, type, portion, start_date, end_date) values
  (tests.m13b('entry_2'), tests.m13b('m2'), 'pto', 'full', '2099-07-01', '2099-07-01');
insert into public.busy_day (member_id, date) values (tests.m13b('m2'), '2099-07-01');
insert into public.issue_report (id, member_id, kind, message, page, images) values
  (tests.m13b('report_2'), tests.m13b('m2'), 'bug', 'R2', '/',
   array[tests.m13b('m2')::text || '/r2.png']),
  (tests.m13b('report_u'), tests.id('member_u'), 'bug', 'RU', '/',
   array[tests.id('member_u')::text || '/ru.png']);
insert into storage.objects (bucket_id, name) values
  ('issue-report', tests.m13b('m2')::text || '/r2.png'),
  ('issue-report', tests.id('member_u')::text || '/ru.png');
insert into public.event (id, creator_id, name, start_date, end_date, scope) values
  (tests.m13b('event_2'), tests.m13b('m2'), 'V2', current_date + 10, current_date + 11, 'public');

-- K: primary T1 (the seed), plus an active non-primary membership on T3.
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.org_a(), tests.id('team_u'), tests.id('member_t'), 'member', false);

-- ---------------------------------------------------------------------------------------------
-- AC-1. No policy and no function reads the single-valued helper; MIR-21-f dropped the helper.
-- ---------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_catalog.pg_policies
    where coalesce(qual, '') ~ 'member_team_id\(' or coalesce(with_check, '') ~ 'member_team_id\('),
  0,
  'AC-1: no policy in any schema reads member_team_id()'
);
select is(
  (select count(*)::int from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname <> 'member_team_id' and p.prosrc ~ 'member_team_id\('),
  0,
  'AC-1: no function in public reads member_team_id()'
);
select hasnt_function('public', 'member_team_id', array['uuid'], 'AC-1: public.member_team_id(uuid) is dropped (MIR-21-f)');

-- ---------------------------------------------------------------------------------------------
-- AC-2. The four count-feeding reads return K's primary team only.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('member_t'));
select results_eq($$select id from public.team$$, $$values (tests.id('team_t'))$$,
  'AC-2: K reads exactly one team row, T1');
select is_empty(
  $$select id from public.member
     where public.member_roster_team_id(id) is not null and public.member_roster_team_id(id) <> tests.id('team_t')
       and id <> tests.id('member_t')$$,
  'AC-2: every member row K reads is on T1 or is K''s own'
);
select ok((select count(*) from public.member where public.member_roster_team_id(id) = tests.id('team_t')) > 1,
  'AC-2: K still reads T1''s roster');
select is_empty(
  $$select e.id from public.entry e
     where public.member_primary_team_id(e.member_id) is distinct from tests.id('team_t')$$,
  'AC-2: every entry K reads has an author whose primary team is T1'
);
select is_empty($$select id from public.entry where member_id = tests.id('member_u')$$,
  'AC-2: N''s entries are not returned to K');
select ok(exists (select 1 from public.entry where id = tests.id('entry_t')),
  'AC-2: K still reads T1''s entries');
select is_empty(
  $$select b.member_id from public.busy_day b
     where b.member_id not in (select id from public.member where public.member_roster_team_id(id) = tests.id('team_t'))$$,
  'AC-2: every busy day K reads belongs to a member on T1'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.busy_day b where b.member_id = tests.id('member_u')),
  1,
  'AC-2: N''s busy day exists, so its absence above is the policy''s answer'
);

-- ---------------------------------------------------------------------------------------------
-- AC-4. Visibility reads span every active team. N creates a team-scope event on T3.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('member_u'));
insert into public.event (name, start_date, end_date, scope) values
  ('VN mir13b', current_date + 10, current_date + 11, 'team');
select tests.clear_authentication();
select is((select team_id from public.event where id = tests.event_named('VN mir13b')), tests.id('team_u'),
  'AC-4: N''s team-scope event is on T3');

select tests.authenticate_as(tests.id('member_t'));
select results_eq($$select id from public.event where id = tests.event_named('VN mir13b')$$,
  $$values (tests.event_named('VN mir13b'))$$,
  'AC-4: K reads N''s team-scope event');
select is(
  (select count(*)::int from public.notification
    where kind = 'event_created' and event_id = tests.event_named('VN mir13b')),
  1,
  'AC-4: K reads an event_created notification for it'
);
-- MIR-15: N's public event is on T3, in Org public (the shared tenant), so it reaches K only because
-- K holds the active T3 membership given above.
select ok(exists (select 1 from public.list_member_directory() d where d.id = tests.id('member_u')),
  'AC-4: list_member_directory() called by K returns N');
-- N also created a public event, so the line above holds through ADR-066 (c) alone. manager_u
-- created, attends and is invited to nothing, so only "own team" puts it in K's directory.
select ok(exists (select 1 from public.list_member_directory() d where d.id = tests.id('manager_u')),
  'AC-4: and returns manager_u of T3, whom only the own-team clause reaches');
select tests.clear_authentication();
select is(public.may_read_event(tests.event_named('VN mir13b'), tests.id('member_t')), true,
  'AC-4: may_read_event(N''s event, K) is true');
select is(public.may_read_event(tests.event_named('VN mir13b'), tests.id('member_t2')), false,
  'AC-4: and false for a T1 member with no T3 membership');

-- ---------------------------------------------------------------------------------------------
-- AC-5. A public event reaches its own org only.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select is_empty($$select id from public.event where id = tests.m13b('event_2')$$,
  'AC-5: Admin A does not read V2');
select tests.authenticate_as(tests.id('member_t'));
select is_empty($$select id from public.event where id = tests.m13b('event_2')$$,
  'AC-5: K does not read V2');
-- MIR-15: Event U public is on T3, in the shared tenant, so K reads it only through the active T3
-- membership given above.
select ok(exists (select 1 from public.event where id = tests.id('event_u_public')),
  'AC-5: K still reads a public event of Org A');
select tests.clear_authentication();
select is(public.may_read_event(tests.m13b('event_2'), tests.id('admin_t')), false,
  'AC-5: may_read_event(V2, Admin A) is false');
select is(public.may_read_event(tests.m13b('event_2'), tests.id('member_t')), false,
  'AC-5: may_read_event(V2, K) is false');

-- ---------------------------------------------------------------------------------------------
-- AC-6. Creating a public event notifies the creator's org only, and succeeds. Org A is the shared
-- tenant, so since MIR-15 that is the creator's team within it (ADR-076 decision 2).
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('member_t2'));
select lives_ok(
  $$insert into public.event (name, start_date, end_date, scope) values
      ('VA mir13b', current_date + 10, current_date + 11, 'public')$$,
  'AC-6: a member of Org A creates a public event while Org B has an approved member'
);
select tests.clear_authentication();
select set_eq(
  $$select recipient_id from public.notification
     where kind = 'event_created' and event_id = tests.event_named('VA mir13b')$$,
  $$select m.id from public.member m
     where m.org_id = tests.org_a()
       and tests.id('team_t') in (select public.member_team_ids(m.id))
       and m.id <> tests.id('member_t2')$$,
  'AC-6: event_created goes to every other active member of T1, the event''s team'
);
select is(
  (select count(*)::int from public.notification
    where recipient_id = tests.m13b('m2') and event_id = tests.event_named('VA mir13b')),
  0,
  'AC-6: and to no one in Org B'
);

-- ---------------------------------------------------------------------------------------------
-- AC-7. Admin cross-team reads are bounded by org and do not trust p_team_id.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select is_empty($$select id from public.list_members_for_team(tests.m13b('team_2'))$$,
  'AC-7: list_members_for_team(T2) returns zero rows');
select is_empty($$select id from public.list_team_entries_for_team(tests.m13b('team_2'))$$,
  'AC-7: list_team_entries_for_team(T2) returns zero rows');
select is_empty(
  $$select id from public.list_team_entries_overlapping_for_team(tests.m13b('team_2'), '2099-06-30', '2099-07-02')$$,
  'AC-7: list_team_entries_overlapping_for_team(T2, a range containing E2) returns zero rows'
);
select set_eq($$select id from public.list_members_for_team(tests.id('team_u'))$$,
  $$values (tests.id('admin_u')), (tests.id('manager_u')), (tests.id('member_u')),
           (tests.id('member_u2')), (tests.id('removed_u'))$$,
  'AC-7: list_members_for_team(T3) returns T3''s members, as before');
select set_eq($$select id from public.list_team_entries_for_team(tests.id('team_u'))$$,
  $$values (tests.id('entry_u')), (tests.id('entry_u_approved'))$$,
  'AC-7: list_team_entries_for_team(T3) returns T3''s entries, as before');
select set_eq(
  $$select id from public.list_team_entries_overlapping_for_team(tests.id('team_u'), '2026-11-01', '2026-11-30')$$,
  $$values (tests.id('entry_u')), (tests.id('entry_u_approved'))$$,
  'AC-7: list_team_entries_overlapping_for_team(T3, November) returns T3''s entries, as before');
select ok((select array_agg(id) from public.list_teams()) @> array[tests.id('team_t'), tests.id('team_u')],
  'AC-7: list_teams() returns T1 and T3');
select ok(not exists (select 1 from public.list_teams() t where t.id = tests.m13b('team_2')),
  'AC-7: list_teams() does not return T2');
select ok(not exists (select 1 from public.list_all_members() m where m.org_id = tests.m13b('org_b')),
  'AC-7: list_all_members() returns no member of Org B');
select ok(exists (select 1 from public.list_all_members() m where m.id = tests.id('member_u')),
  'AC-7: list_all_members() still returns a member of T3');

-- ---------------------------------------------------------------------------------------------
-- AC-8. Every other is_admin read is bounded by org.
-- ---------------------------------------------------------------------------------------------
select is_empty($$select id from public.member where status <> 'approved' and id = tests.m13b('p2')$$,
  'AC-8: Admin A does not read P2');
select ok(exists (select 1 from public.member where status <> 'approved' and id = tests.id('pending_p')),
  'AC-8: Admin A still reads Org A''s pending sign-up');
select is_empty($$select id from public.issue_report where id = tests.m13b('report_2')$$,
  'AC-8: public.issue_report does not return R2');
select is_empty($$select id from public.issue_report where id = tests.m13b('report_u')$$,
  'AC-8: public.issue_report returns nothing to an admin — MIR-16, ADR-082');
select is_empty(
  $$select name from storage.objects
     where bucket_id = 'issue-report' and name like tests.m13b('m2')::text || '/%'$$,
  'AC-8: storage.objects in issue-report does not return M2''s image'
);
select is_empty(
  $$select name from storage.objects
     where bucket_id = 'issue-report' and name = tests.id('member_u')::text || '/ru.png'$$,
  'AC-8: storage.objects returns nothing to an admin, even for a reporter on T3 — MIR-16, ADR-082'
);
select ok(not exists (select 1 from public.list_member_directory() d where d.id = tests.m13b('m2')),
  'AC-8: list_member_directory() does not return M2');
select is_empty($$select id from public.event where id = tests.m13b('event_2')$$,
  'AC-8: public.event does not return V2');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-9. The guards still refuse a person on no team. pending_p is a pending sign-up of Org A.
-- ---------------------------------------------------------------------------------------------
insert into public.task (member_id, date, title) values (tests.id('pending_p'), '2026-11-05', 'Task of pending_p');
insert into public.notification (recipient_id, kind, event_id, event_name, actor_id) values
  (tests.id('pending_p'), 'event_created', tests.id('event_t_public'), 'Event T public', tests.id('admin_t'));
-- `event_attendance_guard` refuses a person on no team, so pending_p is on T1 for the one insert and
-- back to a pending sign-up before anything is read.
update public.member set status = 'approved' where id = tests.id('pending_p');
-- ADR-078: the mirror no longer writes on a team change, so the fixture writes the row the writers write.
select public.membership_make_primary(tests.id('pending_p'), tests.id('team_t'));
insert into public.event_attendance (event_id, member_id, status) values
  (tests.id('event_t_public'), tests.id('pending_p'), 'attending');
update public.member set status = 'pending' where id = tests.id('pending_p');
-- ADR-078: and closes it again, as the mirror's team-change branch did on the way back.
update public.membership set left_at = now(), is_primary = false, updated_at = now()
 where member_id = tests.id('pending_p') and left_at is null;
select is(
  (select count(*)::int from public.event_attendance where member_id = tests.id('pending_p')),
  1,
  'AC-9: the attendance row exists, so its absence below is the policy''s answer'
);

select tests.authenticate_as(tests.id('pending_p'));
select is_empty($$select id from public.task$$, 'AC-9: a pending sign-up reads no task');
select is_empty($$select id from public.notification$$, 'AC-9: a pending sign-up reads no notification');
select is_empty($$select event_id from public.event_attendance$$,
  'AC-9: a pending sign-up reads no event_attendance');
select is_empty($$select id from public.list_member_directory()$$,
  'AC-9: list_member_directory() returns nothing to a pending sign-up');
select tests.clear_authentication();

select * from finish();
rollback;
