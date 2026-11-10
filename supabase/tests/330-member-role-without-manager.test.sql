-- MIR-16-h AC-1, AC-4 to AC-9: `'manager'` leaves `public.member_role`, the audit history keeps its
-- words as `text`, and `set_member_role` takes `text` (ADR-086 decision 2, ADR-087 decision 2;
-- 01-plan.md § 2, § 4.2). AC-2 and AC-3 describe the conversion of rows that exist before this
-- migration runs and are observed by the psql procedure in 01-plan.md § 4.3, recorded in
-- 03-impl-log.md — pgTAP runs after every migration has applied and cannot see a pre-migration row.
--
-- Fixture: `tests.seed()` only. Ada is `admin_t`, an approved org_admin of Team T in Org public.
-- Thanh is `member_t`, an approved member of Team T. `member_t2` is a second approved member of
-- Team T.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(26);
select tests.seed();

-- ---------------------------------------------------------------------------------------------
-- AC-1. The type has exactly two values.
-- ---------------------------------------------------------------------------------------------
select enum_has_labels('public', 'member_role'::name, array['member', 'org_admin'],
  'AC-1: public.member_role has labels (member, org_admin), in that order');
select throws_ok($$select 'manager'::public.member_role$$, '22P02', null,
  'AC-1: casting the literal ''manager'' to public.member_role raises 22P02');

-- ---------------------------------------------------------------------------------------------
-- AC-4. The history accepts only the words it has ever used. As the owner (session user), which
-- owns the table and so is not stopped by its RLS.
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  format($$insert into public.member_role_change (member_id, from_role, to_role, changed_by)
            values (%L, 'member', 'owner', %L)$$, tests.id('member_t'), tests.id('admin_t')),
  '23514', null,
  'AC-4: inserting a member_role_change row with to_role = ''owner'' raises 23514');

-- ---------------------------------------------------------------------------------------------
-- AC-5. A rank change still works and is still audited.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select results_eq(
  format('select id from public.set_member_role(%L::uuid, %L)', tests.id('member_t'), 'manager'),
  format('values (%L::uuid)', tests.id('member_t')),
  'AC-5: Ada calling set_member_role(Thanh, ''manager'') succeeds and returns Thanh''s row');
select tests.clear_authentication();
select is(
  (select team_role::text from public.membership
    where member_id = tests.id('member_t') and left_at is null and is_primary),
  'manager', 'AC-5: Thanh''s primary team_role is manager');

select tests.authenticate_as(tests.id('admin_t'));
select results_eq(
  format('select id from public.set_member_role(%L::uuid, %L)', tests.id('member_t'), 'member'),
  format('values (%L::uuid)', tests.id('member_t')),
  'AC-5: Ada calling set_member_role(Thanh, ''member'') succeeds and returns Thanh''s row');
select tests.clear_authentication();
select is(
  (select team_role::text from public.membership
    where member_id = tests.id('member_t') and left_at is null and is_primary),
  'member', 'AC-5: Thanh''s primary team_role is member again');

select is((select role::text from public.member where id = tests.id('member_t')), 'member',
  'AC-5: Thanh''s member.role is member throughout both calls');
select is(
  (select count(*)::int from public.member_role_change where member_id = tests.id('member_t')),
  2, 'AC-5: two audit rows were written for Thanh');
select results_eq(
  format($$select from_role, to_role, changed_by from public.member_role_change
            where member_id = %L order by changed_at$$, tests.id('member_t')),
  format($$values ('member'::text, 'manager'::text, %L::uuid),
                  ('manager'::text, 'member'::text, %L::uuid)$$,
         tests.id('admin_t'), tests.id('admin_t')),
  'AC-5: the two audit rows are member -> manager then manager -> member, both as text, by Ada');

-- ---------------------------------------------------------------------------------------------
-- AC-6. The rank door's refusals hold, and say why.
-- ---------------------------------------------------------------------------------------------
select (select count(*)::int from public.member_role_change) as audit_count_before_ac6 \gset
select (select md5(ms::text) from public.membership ms
          where ms.member_id = tests.id('member_t') and ms.left_at is null and ms.is_primary
       ) as mt_ms_before_ac6 \gset

select tests.authenticate_as(tests.id('admin_t'));
select throws_ok(
  format('select public.set_member_role(%L::uuid, %L)', tests.id('member_t'), 'org_admin'),
  '42501', null, 'AC-6: set_member_role(Thanh, ''org_admin'') raises 42501');
select throws_ok(
  format('select public.set_member_role(%L::uuid, %L)', tests.id('member_t'), 'owner'),
  '22023', null, 'AC-6: set_member_role(Thanh, ''owner'') raises 22023');
select tests.clear_authentication();

select is((select count(*)::int from public.member_role_change), :'audit_count_before_ac6'::int,
  'AC-6: neither refusal wrote an audit row');
select is(
  (select md5(ms::text) from public.membership ms
     where ms.member_id = tests.id('member_t') and ms.left_at is null and ms.is_primary),
  :'mt_ms_before_ac6', 'AC-6: Thanh''s membership row is unchanged by either refusal');

-- ---------------------------------------------------------------------------------------------
-- AC-7. Promotion is still audited by the trigger, as text.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select is((select s.role::text from public.promote_member_to_admin(tests.id('member_t2')) s),
  'org_admin', 'AC-7: promote_member_to_admin(member_t2) returns role org_admin');
select tests.clear_authentication();
select is(
  (select count(*)::int from public.member_role_change where member_id = tests.id('member_t2')),
  1, 'AC-7: exactly one audit row for member_t2');
select results_eq(
  format($$select from_role, to_role, changed_by from public.member_role_change
            where member_id = %L$$, tests.id('member_t2')),
  format($$values ('member'::text, 'org_admin'::text, %L::uuid)$$, tests.id('admin_t')),
  'AC-7: the row is member -> org_admin, as text, by Ada');

-- ---------------------------------------------------------------------------------------------
-- AC-8. An org admin is still an org admin and still cannot be demoted.
-- ---------------------------------------------------------------------------------------------
select ok(public.is_org_admin(tests.id('admin_t'), public.member_org_id(tests.id('admin_t'))),
  'AC-8: is_org_admin(Ada, Org public) is true');
select throws_ok(
  format('update public.member set role = %L where id = %L', 'member', tests.id('admin_t')),
  '42501', 'an org admin may not be demoted',
  'AC-8: demoting Ada to member, as owner, raises 42501 ''an org admin may not be demoted''');

-- ---------------------------------------------------------------------------------------------
-- AC-9. Nothing is left on the old type.
-- ---------------------------------------------------------------------------------------------
select hasnt_type('public', 'member_role_old', 'AC-9: no type named public.member_role_old exists');
select hasnt_function('public', 'set_member_role', array['uuid', 'public.member_role'],
  'AC-9: set_member_role(uuid, public.member_role) does not exist');
select has_function('public', 'set_member_role', array['uuid', 'text'],
  'AC-9: set_member_role(uuid, text) exists');
select ok(
  not has_function_privilege('anon', 'public.set_member_role(uuid, text)', 'EXECUTE'),
  'AC-9: anon holds no EXECUTE on set_member_role(uuid, text)');
select is(
  (select count(*)::int from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosrc ~ '''manager''::public\.member_role'),
  0,
  'AC-9: no function in public casts the literal ''manager'' to public.member_role'
);
select col_type_is('public', 'member_role_change', 'from_role', 'text',
  'AC-9: member_role_change.from_role is text');
select col_type_is('public', 'member_role_change', 'to_role', 'text',
  'AC-9: member_role_change.to_role is text');

select * from finish();
rollback;
