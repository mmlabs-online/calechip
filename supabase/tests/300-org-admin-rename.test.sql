-- MIR-16-e AC-1 to AC-10: the value `admin` is renamed `org_admin` in place — the type, and the five
-- function bodies that spelled it (ADR-084 decision 2; 01-plan.md § 2, § 4.2). AC-9 and AC-10 are
-- observed against the member seam's source and are not run here (01-plan.md § 2).
--
-- MIR-16-c retired `public.may_decide(uuid)` (ADR-085 decision 1). The AC-7 section this file once
-- had, asserting `may_decide` admits an org admin and a manager, is gone with it; the per-team
-- decider is asserted at 310-manager-read-from-membership.test.sql AC-7.
--
-- Fixture: `tests.seed()` only. Ada is `admin_t`, an approved admin of Org public on Team T; Mona is
-- `manager_t`; Thanh is `member_t`, both on Team T; `member_t2` is a second member on Team T.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(17);
select tests.seed();

-- ---------------------------------------------------------------------------------------------
-- AC-1. The type has `org_admin` and not `admin`.
-- ---------------------------------------------------------------------------------------------
select enum_has_labels('public', 'member_role'::name, array['member', 'org_admin'],
  'AC-1: public.member_role has labels (member, org_admin), in that order');

-- ---------------------------------------------------------------------------------------------
-- AC-2. Every existing admin row is now `org_admin`, and nothing else moved.
-- ---------------------------------------------------------------------------------------------
select is((select role::text from public.member where id = tests.id('admin_t')), 'org_admin',
  'AC-2: Ada''s role is org_admin');
select is((select role::text from public.member where id = tests.id('admin_u')), 'org_admin',
  'AC-2: admin_u''s role is org_admin');
select is((select role::text from public.member where id = tests.id('removed_admin_t')), 'org_admin',
  'AC-2: removed_admin_t''s role is org_admin');
select is((select role::text from public.member where id = tests.id('member_t')), 'member',
  'AC-2: Thanh''s role is unchanged (member)');
select is((select role::text from public.member where id = tests.id('manager_t')),
  tests.member_role('manager')::text,
  'AC-2: Mona''s role is unchanged');
select is(
  (select count(*)::int from public.member_role_change
    where member_id in (
      tests.id('admin_t'), tests.id('admin_u'), tests.id('removed_admin_t'),
      tests.id('member_t'), tests.id('manager_t'), tests.id('member_t2')
    )),
  0,
  'AC-2: the migration wrote no member_role_change row for the seed''s people'
);

-- ---------------------------------------------------------------------------------------------
-- AC-3. An org admin is still an org admin.
-- ---------------------------------------------------------------------------------------------
select ok(public.is_org_admin(tests.id('admin_t'), public.member_org_id(tests.id('admin_t'))),
  'AC-3: is_org_admin(Ada, Org public) is true');
select tests.authenticate_as(tests.id('admin_t'));
select lives_ok(
  format($$select public.admit_member(%L::uuid, %L::uuid)$$, tests.id('pending_p'), tests.id('team_t')),
  'AC-3: Ada admitting Pat to Team T lives');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-4. An org admin still cannot be demoted, and the refusal names the role.
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  format('update public.member set role = %L where id = %L', 'member', tests.id('admin_t')),
  '42501', 'an org admin may not be demoted',
  'AC-4: demoting Ada to member, as owner, raises 42501 ''an org admin may not be demoted''');

-- ---------------------------------------------------------------------------------------------
-- AC-5. Promotion writes `org_admin`.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select is((select s.role::text from public.promote_member_to_admin(tests.id('member_t2')) s),
  'org_admin', 'AC-5: promote_member_to_admin(member_t2) returns role org_admin');
select tests.clear_authentication();
select ok(public.is_org_admin(tests.id('member_t2'), public.member_org_id(tests.id('member_t2'))),
  'AC-5: member_t2 is now an org admin of Org public');

-- ---------------------------------------------------------------------------------------------
-- AC-6. The rank door still refuses promotion to the admin role.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select throws_ok(
  format($$select public.set_member_role(%L::uuid, 'org_admin')$$, tests.id('member_t')),
  '42501', null, 'AC-6: set_member_role(Thanh, org_admin) raises 42501');
select tests.clear_authentication();
select is((select role::text from public.member where id = tests.id('member_t')), 'member',
  'AC-6: Thanh''s role is unchanged after the refusal');

-- ---------------------------------------------------------------------------------------------
-- AC-8. No public function body spells the old value.
-- ---------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ~ '''admin''::public\.member_role'),
  0,
  'AC-8: no function in public casts the literal ''admin'' to public.member_role'
);
select is(
  (select count(*)::int from pg_catalog.pg_proc p join pg_catalog.pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ~* 'role::text\s+in\s*\([^)]*''admin'''),
  0,
  'AC-8: no function in public compares role::text with ''admin'' in an ''in'' list'
);

-- `tests.member_role`'s admin value is the value the database treats as admin (290-member-role-helper
-- is not edited; this confirms it holds on this side of the rename too).
select is(tests.member_role('admin'), 'org_admin'::public.member_role,
  'tests.member_role(''admin'') is org_admin::public.member_role');

select * from finish();
rollback;
