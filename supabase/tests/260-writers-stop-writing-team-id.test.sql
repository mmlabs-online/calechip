-- MIR-21-d AC-1 to AC-6: admit_member, reject_member, move_member and set_member_team stop
-- assigning `member.team_id`, the people they put on, take off or move a team still land where
-- they used to, and an admin's self-move is now refused only by MIR-21-c's `membership` trigger
-- (ADR-080 decision 2; 01-plan.md § 4.2). No criterion below reads `member.team_id` (ADR-080
-- decision 5).
--
-- T1 and T2 are inserted with no org, so `stamp_org_id` puts them in the shared tenant, in the
-- shape of 250-membership-self-lock.test.sql. A (admin) and M (member) are inserted with no team
-- and no org, so they land there too, and each gets an active primary `membership` row on T1,
-- inserted directly. P1 and P2 are pending, with no `membership` row. No fixture names the member
-- table's team column (ADR-080 decision 5).
--
-- Steps run in the order that keeps each AC's "Given" true: AC-4 needs M still on T1, so it runs
-- before AC-3 moves M to T2 (the shape of 230-writers-write-membership.test.sql's own reordering).
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(18);

create function tests.m21d(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('c2600000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('t1', 'b1'), ('t2', 'b2'),
      ('a', 'c1'), ('m', 'c2'), ('p1', 'c3'), ('p2', 'c4')
    ) as v(label, nn)
   where v.label = p_label;
$$;

-- A digest of `membership`, for "unchanged, compared before and after". Owner only.
create function tests.m21d_ms(p_member uuid default null) returns text
  language sql stable security invoker set search_path = '' as $$
  select coalesce(md5(string_agg(ms::text, '|' order by ms.id)), 'none')
    from public.membership ms
   where p_member is null or ms.member_id = p_member;
$$;

insert into public.team (id, name) values
  (tests.m21d('t1'), 'Team T1 mir21d-260'),
  (tests.m21d('t2'), 'Team T2 mir21d-260');
insert into auth.users (id, email)
select tests.m21d(l), l || '@mir21d-260.test'
  from unnest(array['a', 'm', 'p1', 'p2']) l;
insert into public.member (id, display_name, avatar, role, status, email) values
  (tests.m21d('a'), 'A', '1.png', tests.member_role('admin'), 'approved', 'a@mir21d-260.test'),
  (tests.m21d('m'), 'M', '1.png', 'member', 'approved', 'm@mir21d-260.test');
insert into public.member (id, display_name, avatar, role, status, email)
select tests.m21d(l), upper(l), '1.png', 'member', 'pending', l || '@mir21d-260.test'
  from unnest(array['p1', 'p2']) l;
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
select (select o.id from public.org o where o.is_shared_tenant), tests.m21d('t1'), tests.m21d(l),
       'member', true
  from unnest(array['a', 'm']) l;

-- ---------------------------------------------------------------------------------------------
-- AC-1. Admitting a sign-up still puts them on the team.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21d('a'));
select lives_ok(
  format('select public.admit_member(%L::uuid, %L::uuid)', tests.m21d('p1'), tests.m21d('t1')),
  'AC-1: A admit_member(P1, T1) succeeds');
select tests.clear_authentication();
select is((select status::text from public.member where id = tests.m21d('p1')), 'approved',
  'AC-1: P1''s status is approved');
select is(public.member_roster_team_id(tests.m21d('p1')), tests.m21d('t1'),
  'AC-1: P1''s roster team is T1');
select results_eq(
  $$select team_id, is_primary from public.membership
     where member_id = tests.m21d('p1') and left_at is null$$,
  $$values (tests.m21d('t1'), true)$$,
  'AC-1: P1 has exactly one active, primary membership row, on T1');

-- ---------------------------------------------------------------------------------------------
-- AC-2. Rejecting a sign-up still rejects them and puts them on no team.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21d('a'));
select lives_ok(
  format('select public.reject_member(%L::uuid)', tests.m21d('p2')),
  'AC-2: A reject_member(P2) succeeds');
select tests.clear_authentication();
select is((select status::text from public.member where id = tests.m21d('p2')), 'rejected',
  'AC-2: P2''s status is rejected');
select ok(public.member_roster_team_id(tests.m21d('p2')) is null,
  'AC-2: P2''s roster team is null');
select is((select count(*)::int from public.membership where member_id = tests.m21d('p2')), 0,
  'AC-2: P2 has no membership row');

-- ---------------------------------------------------------------------------------------------
-- AC-4. set_member_team still returns the member on their own team, and refuses any other. Run
-- here, before AC-3, so M is still on T1.
-- ---------------------------------------------------------------------------------------------
create temp table m21d_m_before_ac4 as
  select * from public.membership where member_id = tests.m21d('m');

select tests.authenticate_as(tests.m21d('a'));
select is(public.roster_team_id(s), tests.m21d('t1'), 'AC-4: set_member_team(M, T1) returns M on T1')
  from public.set_member_team(tests.m21d('m'), tests.m21d('t1')) s;
select throws_ok(
  format('select public.set_member_team(%L::uuid, %L::uuid)', tests.m21d('m'), tests.m21d('t2')),
  '42501', null,
  'AC-4: set_member_team(M, T2) raises 42501');
select tests.clear_authentication();

select results_eq(
  format('select * from public.membership where member_id = %L order by id', tests.m21d('m')),
  'select * from m21d_m_before_ac4 order by id',
  'AC-4: M''s membership rows are unchanged by both calls');

-- ---------------------------------------------------------------------------------------------
-- AC-3. Moving a member still moves them.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21d('a'));
select lives_ok(
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21d('m'), tests.m21d('t2')),
  'AC-3: A move_member(M, T2) succeeds');
select tests.clear_authentication();
select is(public.member_roster_team_id(tests.m21d('m')), tests.m21d('t2'),
  'AC-3: M''s roster team is T2');
select results_eq(
  $$select left_at is not null, is_primary from public.membership
     where member_id = tests.m21d('m') and team_id = tests.m21d('t1')$$,
  $$values (true, false)$$,
  'AC-3: M''s T1 row is closed and not primary');
select results_eq(
  $$select team_id, is_primary from public.membership
     where member_id = tests.m21d('m') and left_at is null$$,
  $$values (tests.m21d('t2'), true)$$,
  'AC-3: M''s only active row is T2, primary');

-- ---------------------------------------------------------------------------------------------
-- AC-5. An admin still cannot move themselves, and the lock on `membership` is now the one that
-- answers.
-- ---------------------------------------------------------------------------------------------
select tests.m21d_ms() as ac5_before \gset

select tests.authenticate_as(tests.m21d('a'));
select throws_ok(
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21d('a'), tests.m21d('t2')),
  '42501', 'a person may not change their own role, status or team',
  'AC-5: A move_member(A, T2) raises 42501');
select tests.clear_authentication();

select is(tests.m21d_ms(), :'ac5_before', 'AC-5: every membership row is unchanged');

-- ---------------------------------------------------------------------------------------------
-- AC-6. No writer assigns the column.
-- ---------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('admit_member', 'reject_member', 'move_member', 'set_member_team')
      and p.prosrc ~ '\mteam_id\s*='),
  0,
  'AC-6: no writer body contains an assignment of team_id');

select * from finish();
rollback;
