-- MIR-16-f AC-1 to AC-7: `set_member_role` writes `membership.team_role` and its own
-- `member_role_change` row, and no longer writes `member.role` (ADR-086 decision 1;
-- .ai/board/tickets/MIR-16-f/01-plan.md § 2, § 4.2). AC-8 is observed against the member seam's
-- source and is not run here (tests/org-admin-role-mapping.test.ts).
--
-- Fixture: `tests.seed()`. Ada is `admin_t`, an approved org_admin of Team T. Thanh is `member_t`, an
-- approved member of Team T. Mona is `manager_t`, an approved manager of Team T whose `member.role`
-- still reads `manager` because the seed predates this ticket. `member_t2` is a second member of
-- Team T. The extra fixture below adds Una, an approved member of Team U — a team Ada does not
-- share — and one pending entry by `member_t2`, for AC-7.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(23);
select tests.seed();

-- The one extra fixture id this file needs, in the shape of tests.m21c (250): its own prefix, so it
-- cannot collide with tests.id's fixed ids.
create function tests.m16f(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('f3200000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values ('una', 'a1')) as v(label, nn)
   where v.label = p_label;
$$;

insert into auth.users (id, email) values (tests.m16f('una'), 'una@mir16f.test');
insert into public.member (id, display_name, avatar, role, status, email) values
  (tests.m16f('una'), 'Una', '1.png', 'member', 'approved', 'una@mir16f.test');
select tests.put_on_team(tests.m16f('una'), tests.id('team_u'));

insert into public.entry (id, member_id, type, portion, start_date, end_date) values
  (gen_random_uuid(), tests.id('member_t2'), 'pto', 'full', '2026-11-20', '2026-11-21');

-- ---------------------------------------------------------------------------------------------
-- AC-1. Making someone a manager writes their team role, not their member role.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select results_eq(
  format('select id from public.set_member_role(%L::uuid, %L)',
         tests.id('member_t'), 'manager'),
  format('values (%L::uuid)', tests.id('member_t')),
  'AC-1: Ada calling set_member_role(Thanh, manager) succeeds and returns Thanh''s row');
select tests.clear_authentication();
select is(
  (select team_role::text from public.membership
    where member_id = tests.id('member_t') and left_at is null and is_primary),
  'manager', 'AC-1: Thanh''s active primary row has team_role manager');
select is((select role::text from public.member where id = tests.id('member_t')), 'member',
  'AC-1: Thanh''s member.role is still member');
select is(public.member_roster_team_role(tests.id('member_t')), 'manager'::public.team_role,
  'AC-1: member_roster_team_role(Thanh) is manager');

-- ---------------------------------------------------------------------------------------------
-- AC-2. And it is audited once, with the words of the change.
-- ---------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from public.member_role_change where member_id = tests.id('member_t')),
  1, 'AC-2: member_role_change holds exactly one new row for Thanh');
select results_eq(
  format($$select from_role::text, to_role::text, changed_by from public.member_role_change
            where member_id = %L$$, tests.id('member_t')),
  format($$values ('member', 'manager', %L::uuid)$$, tests.id('admin_t')),
  'AC-2: the row is from_role=member, to_role=manager, changed_by=Ada');

-- ---------------------------------------------------------------------------------------------
-- AC-3. Making a manager a member again works for a legacy manager too.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select results_eq(
  format('select id from public.set_member_role(%L::uuid, %L)',
         tests.id('manager_t'), 'member'),
  format('values (%L::uuid)', tests.id('manager_t')),
  'AC-3: Ada calling set_member_role(Mona, member) succeeds and returns Mona''s row');
select tests.clear_authentication();
select is(
  (select team_role::text from public.membership
    where member_id = tests.id('manager_t') and left_at is null and is_primary),
  'member', 'AC-3: Mona''s active primary row has team_role member');
select is(
  (select count(*)::int from public.member_role_change where member_id = tests.id('manager_t')),
  1, 'AC-3: exactly one audit row for Mona');
select results_eq(
  format($$select from_role::text, to_role::text, changed_by from public.member_role_change
            where member_id = %L$$, tests.id('manager_t')),
  format($$values ('manager', 'member', %L::uuid)$$, tests.id('admin_t')),
  'AC-3: the row is manager -> member by Ada');
select is((select role::text from public.member where id = tests.id('manager_t')),
  tests.member_role('manager')::text,
  'AC-3: Mona''s member.role is not changed by the call');

-- ---------------------------------------------------------------------------------------------
-- AC-4. A call that changes nothing writes nothing.
-- ---------------------------------------------------------------------------------------------
select (select md5(ms::text) from public.membership ms
          where ms.member_id = tests.id('member_t') and ms.left_at is null and ms.is_primary
       ) as mt_ms_before_ac4 \gset
select (select count(*)::int from public.member_role_change where member_id = tests.id('member_t'))
       as mt_audit_before_ac4 \gset

select tests.authenticate_as(tests.id('admin_t'));
select results_eq(
  format('select id from public.set_member_role(%L::uuid, %L)',
         tests.id('member_t'), 'manager'),
  format('values (%L::uuid)', tests.id('member_t')),
  'AC-4: Ada calling set_member_role(Thanh, manager) again succeeds and returns Thanh''s row');
select tests.clear_authentication();
select is(
  (select md5(ms::text) from public.membership ms
     where ms.member_id = tests.id('member_t') and ms.left_at is null and ms.is_primary),
  :'mt_ms_before_ac4', 'AC-4: Thanh''s membership row is unchanged');
select is(
  (select count(*)::int from public.member_role_change where member_id = tests.id('member_t')),
  :'mt_audit_before_ac4'::int, 'AC-4: no new audit row for Thanh');

-- ---------------------------------------------------------------------------------------------
-- AC-5. The refusals are unchanged.
-- ---------------------------------------------------------------------------------------------
select (select count(*)::int from public.member_role_change) as audit_count_before_ac5 \gset
select (select md5(ms::text) from public.membership ms
          where ms.member_id = tests.m16f('una') and ms.left_at is null and ms.is_primary
       ) as una_ms_before_ac5 \gset

select tests.authenticate_as(tests.id('admin_t'));
select throws_ok(
  format('select public.set_member_role(%L::uuid, %L)',
         tests.id('member_t'), 'org_admin'),
  '42501', null, 'AC-5: Ada calling set_member_role(Thanh, org_admin) raises 42501');
select tests.clear_authentication();

select tests.authenticate_as(tests.id('member_t'));
select throws_ok(
  format('select public.set_member_role(%L::uuid, %L)',
         tests.id('manager_t'), 'member'),
  '42501', null, 'AC-5: Thanh calling set_member_role(Mona, member) raises 42501');
select tests.clear_authentication();

select tests.authenticate_as(tests.id('admin_t'));
select throws_ok(
  format('select public.set_member_role(%L::uuid, %L)',
         tests.m16f('una'), 'manager'),
  '42501', null,
  'AC-5: Ada calling set_member_role(Una, manager) raises 42501 (a team Ada does not share)');
select throws_ok(
  format('select public.set_member_role(%L::uuid, %L)',
         tests.id('admin_t'), 'member'),
  '42501', null, 'AC-5: Ada calling set_member_role on herself raises 42501');
select tests.clear_authentication();

select is((select count(*)::int from public.member_role_change), :'audit_count_before_ac5'::int,
  'AC-5: none of the four refusals wrote an audit row');
select is(
  (select md5(ms::text) from public.membership ms
     where ms.member_id = tests.m16f('una') and ms.left_at is null and ms.is_primary),
  :'una_ms_before_ac5', 'AC-5: Una''s membership row is unchanged');

-- ---------------------------------------------------------------------------------------------
-- AC-6. Nobody writes 'manager' to member.role any more.
-- ---------------------------------------------------------------------------------------------
-- Captures the token immediately after `set role =` — a quoted literal ('org_admin'::cast) or a
-- bare identifier (p_role) alike — so an assignment from a PARAMETER, not just a literal naming
-- some other role, is also counted. That is the shape AC-6 has to catch: the pre-ticket
-- `set_member_role` wrote `set role = p_role` (20261107235000_mir16e_…sql:109), a non-literal
-- assignment a literal-only check would miss.
select is(
  (select count(*)::int from (
     select (regexp_matches(p.prosrc, 'set\s+role\s*=\s*(\S+)', 'gi'))[1] as assigned
       from pg_catalog.pg_proc p
       join pg_catalog.pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public'
   ) s
   where s.assigned !~ '^''org_admin'''),
  0,
  'AC-6: every ''set role = ...'' assignment in a public function body is to org_admin'
);

-- ---------------------------------------------------------------------------------------------
-- AC-7. The decider still follows the team role.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('member_t'));
select lives_ok(
  format('update public.entry set status = %L where member_id = %L', 'approved', tests.id('member_t2')),
  'AC-7: Thanh (now manager) updates member_t2''s pending entry to approved, through entry_update_manager');
select tests.clear_authentication();
select is((select status::text from public.entry where member_id = tests.id('member_t2')), 'approved',
  'AC-7: member_t2''s entry is now approved');

select * from finish();
rollback;
