-- MIR-16-d AC-1 to AC-3: `tests.member_role(text)` maps the application's role word to the
-- `public.member_role` value that means it, and its admin value is the one the database treats as
-- admin (01-plan.md § 2, § 4.3; ADR-084). No assertion here names the admin value, so the file holds
-- before and after MIR-16-e renames it.
-- AC-1's grant and its *no migration* half, AC-4 and AC-5 are file and run facts, checked at review.
--
-- Fixture: `tests.seed()` only. `admin_t` is Ada, an approved admin of Org public on team T;
-- `member_t` is Thanh, an approved member on T.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(10);
select tests.seed();

-- AC-1: the helper exists, in the test schema, and returns public.member_role.
select has_function('tests', 'member_role', array['text'],
  'AC-1: tests.member_role(text) exists');
select ok(
  (select prorettype = 'public.member_role'::regtype
     from pg_catalog.pg_proc where oid = 'tests.member_role(text)'::regprocedure),
  'AC-1: tests.member_role(text) returns public.member_role');

-- AC-2: the database value for each application role word.
select is(tests.member_role('member'), 'member'::public.member_role,
  'AC-2: member maps to member');
select is(tests.member_role('manager'), 'member'::public.member_role,
  'AC-2: manager maps to member — a team role since MIR-16-h');
select ok(tests.member_role(null) is null,
  'AC-2: null maps to null');
select throws_ok($$select tests.member_role('owner')$$, '22P02', null,
  'AC-2: an unknown role word raises 22P02');

-- AC-3: the helper's admin value is the value the database treats as admin.
select is((select role from public.member where id = tests.id('admin_t')),
  tests.member_role('admin'),
  'AC-3: Ada''s role equals tests.member_role(''admin'')');
select ok(public.is_org_admin(tests.id('admin_t'), public.member_org_id(tests.id('admin_t'))),
  'AC-3: Ada is an org admin of Org public');

select tests.authenticate_as(tests.id('admin_t'));
select is((select s.role from public.promote_member_to_admin(tests.id('member_t')) s),
  tests.member_role('admin'),
  'AC-3: promote_member_to_admin(Thanh) returns a role equal to tests.member_role(''admin'')');
select tests.clear_authentication();

select ok(public.is_org_admin(tests.id('member_t'), public.member_org_id(tests.id('member_t'))),
  'AC-3: Thanh is then an org admin of Org public');

select * from finish();
rollback;
