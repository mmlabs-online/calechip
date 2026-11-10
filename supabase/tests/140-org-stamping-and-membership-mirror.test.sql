-- MIR-13 AC-1, AC-2, AC-5 to AC-9: the constraints and the database stamping `org_id` (ADR-071
-- decision 1). AC-3 and AC-4 need rows that exist before the migration runs, and AC-10 needs
-- `supabase/bootstrap.sql`, which is outside the
-- directory `supabase test db` mounts; all three are verified by the psql procedure in
-- .ai/board/tickets/MIR-13/03-impl-log.md.
--
-- Org A is the shared tenant the seed lives in; Admin A is `admin_t` on `team_t` (T1), and T3 is
-- `team_u`. Org B, T2, M2, P2 and Admin B are this file's (01-plan.md § 2).
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(35);

create function tests.m13(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('b1300000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('org_b', 'b0'), ('team_2', 'b2'), ('admin_b', 'a2'), ('m2', 'c2'), ('p2', 'd2'),
      ('event_2', 'e2'), ('team_x', 'f1'), ('member_x', 'f2'), ('signup', 'f4')
    ) as v(label, nn)
   where v.label = p_label;
$$;

-- Definer: it is read while authenticated, and `authenticated` holds no grant on `public.org`.
create function tests.org_a() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

select tests.seed();

-- Org B, as the owner. M2 and Admin B name org_id themselves (MIR-21-e, ADR-080 decision 3); the
-- fixture writes their membership row with put_on_team instead of relying on the mirror.
insert into public.org (id, org_code, name) values (tests.m13('org_b'), 'org-b-mir13', 'Org B');
insert into public.team (id, name, org_id) values (tests.m13('team_2'), 'Team 2', tests.m13('org_b'));
insert into auth.users (id, email) values
  (tests.m13('m2'), 'm2@mir13.test'),
  (tests.m13('admin_b'), 'admin_b@mir13.test'),
  (tests.m13('p2'), 'p2@mir13.test');
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m13('m2'),      tests.m13('org_b'), 'M2',      '1.png', 'member', 'approved', 'm2@mir13.test'),
  (tests.m13('admin_b'), tests.m13('org_b'), 'Admin B', '1.png', tests.member_role('admin'),  'approved', 'admin_b@mir13.test');
select tests.put_on_team(tests.m13('m2'), tests.m13('team_2'));
select tests.put_on_team(tests.m13('admin_b'), tests.m13('team_2'));
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m13('p2'), tests.m13('org_b'), 'P2', '1.png', 'member', 'pending', 'p2@mir13.test');

-- ---------------------------------------------------------------------------------------------
-- AC-1, AC-2. The constraints.
-- ---------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from information_schema.columns
    where table_schema = 'public'
      and is_nullable = 'NO'
      and ((column_name = 'org_id'
            and table_name in ('team', 'member', 'entry', 'holiday', 'busy_day', 'issue_report',
                               'event', 'event_invitee', 'event_attendance', 'event_guest_link',
                               'event_guest', 'notification'))
           or (table_name = 'entry' and column_name = 'primary_team_id'))),
  13,
  'AC-1: all thirteen org_id columns and entry.primary_team_id are NOT NULL'
);

select results_eq(
  $$select pg_get_constraintdef(c.oid) from pg_constraint c
     where c.conrelid = 'public.holiday'::regclass and c.conname = 'holiday_org_id_date_key'$$,
  $$values ('UNIQUE (org_id, date)'::text)$$,
  'AC-2: holiday_org_id_date_key is unique (org_id, date)'
);
select hasnt_index('public', 'holiday', 'holiday_date_key', 'AC-2: holiday_date_key is gone');
select lives_ok(
  $$insert into public.holiday (date, name, org_id) values ('2099-03-01', 'A', tests.org_a())$$,
  'AC-2: a holiday on 2099-03-01 in Org A is accepted'
);
select lives_ok(
  $$insert into public.holiday (date, name, org_id) values ('2099-03-01', 'B', tests.m13('org_b'))$$,
  'AC-2: a holiday on the same date in Org B is accepted'
);
select throws_ok(
  $$insert into public.holiday (date, name, org_id) values ('2099-03-01', 'A again', tests.org_a())$$,
  '23505', null,
  'AC-2: a second holiday on 2099-03-01 in Org A is refused with 23505'
);

-- ---------------------------------------------------------------------------------------------
-- AC-5. Stamping, one row per table of ADR-071 decision 1, each inserted with no org_id.
-- ---------------------------------------------------------------------------------------------
insert into public.team (id, name) values (tests.m13('team_x'), 'Team X');
select is((select org_id from public.team where id = tests.m13('team_x')), tests.org_a(),
  'AC-5: team with no caller -> the shared tenant');

insert into auth.users (id, email) values (tests.m13('member_x'), 'x@mir13.test');
insert into public.member (id, display_name, avatar, role, status, email)
values (tests.m13('member_x'), 'X', '1.png', 'member', 'pending', 'x@mir13.test');
select is((select org_id from public.member where id = tests.m13('member_x')), tests.org_a(),
  'AC-5: member with no team -> the shared tenant');
insert into public.holiday (date, name) values ('2099-03-02', 'no caller');
select is((select org_id from public.holiday where date = '2099-03-02'), tests.org_a(),
  'AC-5: holiday with no caller -> the shared tenant');

insert into public.entry (member_id, type, portion, start_date, end_date)
values (tests.m13('m2'), 'pto', 'full', '2099-04-01', '2099-04-01');
select results_eq(
  $$select org_id, primary_team_id from public.entry where member_id = tests.m13('m2')$$,
  $$values (tests.m13('org_b'), tests.m13('team_2'))$$,
  'AC-5: entry -> the member''s org, and primary_team_id -> the author''s active primary team'
);

insert into public.busy_day (member_id, date) values (tests.m13('m2'), '2099-04-02');
select is((select org_id from public.busy_day where member_id = tests.m13('m2')), tests.m13('org_b'),
  'AC-5: busy_day -> the member''s org');

insert into public.issue_report (member_id, kind, message, page)
values (tests.m13('m2'), 'bug', 'MIR-13', '/');
select is((select org_id from public.issue_report where member_id = tests.m13('m2')), tests.m13('org_b'),
  'AC-5: issue_report -> the member''s org');

insert into public.event (id, creator_id, name, start_date, end_date, scope)
values (tests.m13('event_2'), tests.m13('m2'), 'V2', current_date + 10, current_date + 11, 'public');
select results_eq(
  $$select org_id, team_id from public.event where id = tests.m13('event_2')$$,
  $$values (tests.m13('org_b'), tests.m13('team_2'))$$,
  'AC-5: event -> the creator''s org; event_stamp still takes the creator''s team'
);

insert into public.notification (recipient_id, kind, event_id, event_name, actor_id)
values (tests.m13('m2'), 'event_updated', tests.m13('event_2'), 'V2', tests.m13('admin_b'));
select is(
  (select org_id from public.notification
    where recipient_id = tests.m13('m2') and kind = 'event_updated'),
  tests.m13('org_b'),
  'AC-5: notification -> the recipient''s org'
);

insert into public.event_invitee (event_id, member_id) values (tests.m13('event_2'), tests.m13('m2'));
select is((select org_id from public.event_invitee where event_id = tests.m13('event_2')), tests.m13('org_b'),
  'AC-5: event_invitee -> the event''s org');

insert into public.event_attendance (event_id, member_id) values (tests.m13('event_2'), tests.m13('m2'));
select is((select org_id from public.event_attendance where event_id = tests.m13('event_2')), tests.m13('org_b'),
  'AC-5: event_attendance -> the event''s org');

insert into public.event_guest_link (event_id) values (tests.m13('event_2'));
select is((select org_id from public.event_guest_link where event_id = tests.m13('event_2')), tests.m13('org_b'),
  'AC-5: event_guest_link -> the event''s org');

insert into public.event_guest (event_id, event_name, name, email, manage_token_hash)
values (tests.m13('event_2'), 'V2', 'Guest', 'guest@mir13.test', repeat('a', 64));
select is((select org_id from public.event_guest where event_id = tests.m13('event_2')), tests.m13('org_b'),
  'AC-5: event_guest -> the event''s org');

-- With a caller: team and holiday take the caller's org, not the shared tenant.
select tests.authenticate_as(tests.m13('admin_b'));
select is((select (public.create_team('Team B2')).org_id), tests.m13('org_b'),
  'AC-5: team created by an admin of Org B -> Org B');
insert into public.holiday (date, name) values ('2099-03-03', 'Org B caller');
select tests.clear_authentication();
select is((select org_id from public.holiday where date = '2099-03-03'), tests.m13('org_b'),
  'AC-5: holiday inserted by an admin of Org B -> Org B');

-- ---------------------------------------------------------------------------------------------
-- AC-6. A confirmed sign-up still lands, pending, in the shared tenant, with no membership.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at)
values (tests.m13('signup'), 'signup@mir13.test', now());
select results_eq(
  $$select status::text, public.member_roster_team_id(id), org_id from public.member where id = tests.m13('signup')$$,
  $$values ('pending'::text, null::uuid, tests.org_a())$$,
  'AC-6: the admission trigger writes a pending member with no team in the shared tenant'
);
select is((select count(*)::int from public.membership where member_id = tests.m13('signup')), 0,
  'AC-6: and no membership row');

-- ---------------------------------------------------------------------------------------------
-- AC-7. A supplied org_id is kept; a mismatched one is refused by the composite FK.
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  $$insert into public.entry (member_id, org_id, type, portion, start_date, end_date)
    values (tests.m13('m2'), tests.org_a(), 'pto', 'full', '2099-05-01', '2099-05-01')$$,
  '23503', null,
  'AC-7: an entry for M2 with org_id = Org A is refused with 23503'
);
select lives_ok(
  $$insert into public.entry (member_id, org_id, type, portion, start_date, end_date)
    values (tests.m13('m2'), tests.m13('org_b'), 'wfh', 'full', '2099-05-02', '2099-05-02')$$,
  'AC-7: an entry for M2 with org_id = Org B is accepted'
);
select is(
  (select org_id from public.entry where member_id = tests.m13('m2') and start_date = '2099-05-02'),
  tests.m13('org_b'),
  'AC-7: and its org_id is kept unchanged'
);

-- ---------------------------------------------------------------------------------------------
-- AC-8. No active team, no entry.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('pending_p'));
select throws_ok(
  $$insert into public.entry (member_id, type, portion, start_date, end_date)
    values ((select auth.uid()), 'pto', 'full', '2099-06-01', '2099-06-01')$$,
  '23502', null,
  'AC-8: a pending sign-up inserting its own entry is refused with 23502 on primary_team_id'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-9. The mirror, through admit, move, set_member_role and removal, as Admin A. Admin A also
-- holds a non-primary row on T3, so T3 is one of "the caller's teams" for set_member_role and for
-- member_update_admin once P has moved there.
-- ---------------------------------------------------------------------------------------------
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.org_a(), tests.id('team_u'), tests.id('admin_t'), 'member', false);

select tests.authenticate_as(tests.id('admin_t'));
select public.admit_member(tests.id('pending_p'), tests.id('team_t'));
select tests.clear_authentication();
select results_eq(
  $$select team_id, is_primary, left_at from public.membership
     where member_id = tests.id('pending_p') and left_at is null$$,
  $$values (tests.id('team_t'), true, null::timestamptz)$$,
  'AC-9: after admit_member(P, T1), P has exactly one active row: T1, primary'
);

select tests.authenticate_as(tests.id('admin_t'));
select public.move_member(tests.id('pending_p'), tests.id('team_u'));
select tests.clear_authentication();
select results_eq(
  $$select left_at is not null, is_primary from public.membership
     where member_id = tests.id('pending_p') and team_id = tests.id('team_t')$$,
  $$values (true, false)$$,
  'AC-9: after move_member(P, T3), the T1 row is closed and not primary'
);
select results_eq(
  $$select team_id from public.membership
     where member_id = tests.id('pending_p') and left_at is null and is_primary$$,
  $$values (tests.id('team_u'))$$,
  'AC-9: and one active primary row exists on T3'
);

select tests.authenticate_as(tests.id('admin_t'));
select public.set_member_role(tests.id('pending_p'), 'manager');
select tests.clear_authentication();
select is(
  (select team_role::text from public.membership
    where member_id = tests.id('pending_p') and left_at is null and is_primary),
  'manager',
  'AC-9: after set_member_role(P, manager), the active primary row has team_role = manager'
);

-- The removal is made by admin_u, whose primary team is T3. Admin A shares T3 too, but
-- `member_select_team` still reads `member_team_id` until MIR-13-b, so P on T3 is not a row Admin A
-- can see, and an update of it affects nothing.
select tests.authenticate_as(tests.id('admin_u'));
select is(
  tests.rows_affected($$update public.member set removed_at = now() where id = tests.id('pending_p')$$),
  1::bigint,
  'AC-9: an admin of T3 removes P through member_update_admin'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.membership where member_id = tests.id('pending_p') and left_at is null),
  0,
  'AC-9: after removal, P has no active membership row'
);
select ok(
  (select bool_and(left_at >= joined_at) from public.membership where member_id = tests.id('pending_p')),
  'AC-9: every closed row of P has left_at >= joined_at'
);

-- A removal recorded on insert: the row MIR-12's backfill would have written, closed and not primary.
select results_eq(
  $$select is_primary, left_at is not null from public.membership where member_id = tests.id('removed_t')$$,
  $$values (false, true)$$,
  'AC-9: a member inserted already removed gets one closed, non-primary row'
);

-- The mirror never opens a second active row for one (team, member): a move onto a team the member
-- already holds an active row on promotes that row.
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.org_a(), tests.id('team_u'), tests.id('member_t2'), 'member', false);
select tests.authenticate_as(tests.id('admin_t'));
select public.move_member(tests.id('member_t2'), tests.id('team_u'));
select tests.clear_authentication();
select results_eq(
  $$select team_id, is_primary from public.membership
     where member_id = tests.id('member_t2') and left_at is null$$,
  $$values (tests.id('team_u'), true)$$,
  'AC-9: moving onto a team already held promotes that row rather than inserting a second'
);

select * from finish();
rollback;
