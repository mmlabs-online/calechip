-- MIR-18 AC-1 to AC-6: `public.system_admin` is a closed account table, `is_system_admin()` needs the
-- row AND the second factor, an identity is a system admin or a member and never both, and only a
-- person makes one (ADR-074 decisions 1 to 5).
--
-- Fixture, added here on top of `tests.seed()` (01-plan.md § 2):
--   * `sys_a`, `sys_b` — `auth.users` rows with `email_confirmed_at` null, so no member row is
--     created, then made system admins with `grant_system_admin` as the session user.
--   * `sys_c` — the same, used for AC-4's confirmation clause.
--   * `pending_p` — the seed's own pending, team-less member with no `membership` row. It is the row
--     the confirmation trigger creates, so the seed's copy stands in for a newly confirmed one.
--
-- "At aal2" is claims `{"sub", "role": "authenticated", "aal": "aal2"}`, set by the helper below;
-- `_isolation.psql` is not edited. `tests.authenticate_as` sets no `aal`.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(37);
select tests.seed();

-- The fixture ids local to this file. Labels are fixture names, not schema fields.
create function tests.sys(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('00000000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values ('sys_a', 'a1'), ('sys_b', 'a2'), ('sys_c', 'a3'), ('nobody', 'ff')) as v(label, nn)
   where v.label = p_label;
$$;

-- Become X at an assurance level. Transaction-local, like `tests.authenticate_as`.
create function tests.authenticate_at(p_id uuid, p_aal text) returns void
  language plpgsql security invoker set search_path = '' as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

insert into auth.users (id, email) values
  (tests.sys('sys_a'), 'sys_a@mir18.test'),
  (tests.sys('sys_b'), 'sys_b@mir18.test'),
  (tests.sys('sys_c'), 'sys_c@mir18.test');
select public.grant_system_admin(tests.sys('sys_a'));
select public.grant_system_admin(tests.sys('sys_b'));
select public.grant_system_admin(tests.sys('sys_c'));

-- ---------------------------------------------------------------------------------------------
-- AC-1. The table exists, with RLS, closed except for SELECT to `authenticated`.
-- ---------------------------------------------------------------------------------------------
select has_table('public', 'system_admin', 'AC-1: public.system_admin exists');
select col_is_pk('public', 'system_admin', 'id', 'AC-1: id is the primary key');
select col_type_is('public', 'system_admin', 'id', 'uuid', 'AC-1: id is uuid');
select fk_ok('public', 'system_admin', 'id', 'auth', 'users', 'id',
  'AC-1: id references auth.users (id)');
select col_type_is('public', 'system_admin', 'created_at', 'timestamp with time zone',
  'AC-1: created_at is timestamptz');
select col_not_null('public', 'system_admin', 'created_at', 'AC-1: created_at is not null');
select is((select c.relrowsecurity from pg_class c where c.oid = 'public.system_admin'::regclass),
  true, 'AC-1: row-level security is enabled');
select ok(not has_table_privilege('anon', 'public.system_admin',
            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
  'AC-1: anon holds no privilege on the table');
select ok(has_table_privilege('authenticated', 'public.system_admin', 'SELECT'),
  'AC-1: authenticated holds SELECT');
select ok(not has_table_privilege('authenticated', 'public.system_admin',
            'INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
  'AC-1: authenticated holds no other privilege');

-- ---------------------------------------------------------------------------------------------
-- AC-2. A caller reads their own row and nobody else's, at any assurance level.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.sys('sys_a'), 'aal1');
select results_eq('select id from public.system_admin',
  format('values (%L::uuid)', tests.sys('sys_a')),
  'AC-2: sys_a at aal1 reads exactly its own row');
select tests.authenticate_at(tests.sys('sys_a'), 'aal2');
select results_eq('select id from public.system_admin',
  format('values (%L::uuid)', tests.sys('sys_a')),
  'AC-2: sys_a at aal2 reads exactly its own row, not sys_b''s');
select tests.authenticate_at(tests.id('admin_t'), 'aal2');
select is((select count(*)::int from public.system_admin), 0,
  'AC-2: admin_t at aal2 reads no row');

-- ---------------------------------------------------------------------------------------------
-- AC-3. `is_system_admin()` needs the row and the second factor.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.sys('sys_a'), 'aal2');
select is(public.is_system_admin(), true, 'AC-3: sys_a at aal2 is a system admin');
select tests.authenticate_at(tests.sys('sys_a'), 'aal1');
select is(public.is_system_admin(), false, 'AC-3: sys_a at aal1 is not');
select tests.authenticate_as(tests.sys('sys_a'));
select is(public.is_system_admin(), false, 'AC-3: sys_a with no aal claim is not');
select tests.authenticate_at(tests.id('admin_t'), 'aal2');
select is(public.is_system_admin(), false, 'AC-3: admin_t at aal2 is not');
select tests.clear_authentication();
select ok(not has_function_privilege('anon', 'public.is_system_admin()', 'EXECUTE'),
  'AC-3: anon has no EXECUTE on is_system_admin()');

-- ---------------------------------------------------------------------------------------------
-- AC-4. A system admin cannot hold a member row.
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  format($$insert into public.member (id, display_name, avatar, role, email)
           values (%L::uuid, 'sys_a', '1.png', 'member', 'sys_a@mir18.test')$$,
         tests.sys('sys_a')),
  '42501', null,
  'AC-4: a member row for sys_a is refused with 42501');
select lives_ok(
  format('update auth.users set email_confirmed_at = now() where id = %L::uuid', tests.sys('sys_c')),
  'AC-4: confirming a system admin''s email succeeds');
select is((select count(*)::int from public.member m where m.id = tests.sys('sys_c')), 0,
  'AC-4: and admit_allow_listed_member() created no member row');

-- ---------------------------------------------------------------------------------------------
-- AC-5. Granting removes only the row the confirmation created.
-- ---------------------------------------------------------------------------------------------
select lives_ok(format('select public.grant_system_admin(%L::uuid)', tests.id('pending_p')),
  'AC-5: grant_system_admin(pending_p) succeeds');
select is((select count(*)::int from public.member m where m.id = tests.id('pending_p')), 0,
  'AC-5: pending_p''s member row is gone');
select is((select count(*)::int from public.system_admin s where s.id = tests.id('pending_p')), 1,
  'AC-5: pending_p has a system_admin row');

select throws_ok(format('select public.grant_system_admin(%L::uuid)', tests.id('member_t')),
  '42501', null,
  'AC-5: grant_system_admin(member_t) is refused with 42501');
select is((select count(*)::int from public.member m
            where m.id = tests.id('member_t') and m.status = 'approved'
              and public.member_roster_team_id(m.id) = tests.id('team_t') and m.removed_at is null), 1,
  'AC-5: member_t''s member row is unchanged');
select is((select count(*)::int from public.system_admin s where s.id = tests.id('member_t')), 0,
  'AC-5: member_t has no system_admin row');

select lives_ok(format('select public.grant_system_admin(%L::uuid)', tests.sys('sys_a')),
  'AC-5: granting sys_a a second time succeeds');
select is((select count(*)::int from public.system_admin s where s.id = tests.sys('sys_a')), 1,
  'AC-5: sys_a still has exactly one row');

select throws_ok(format('select public.grant_system_admin(%L::uuid)', tests.sys('nobody')),
  '23503', null,
  'AC-5: a uuid with no auth.users row is refused');
select is((select count(*)::int from public.system_admin s where s.id = tests.sys('nobody')), 0,
  'AC-5: and no row is written for it');

-- ---------------------------------------------------------------------------------------------
-- AC-6. Only a person makes a system admin.
-- ---------------------------------------------------------------------------------------------
select ok(not has_function_privilege('anon', 'public.grant_system_admin(uuid)', 'EXECUTE'),
  'AC-6: anon has no EXECUTE on grant_system_admin(uuid)');
select ok(not has_function_privilege('authenticated', 'public.grant_system_admin(uuid)', 'EXECUTE'),
  'AC-6: authenticated has no EXECUTE on grant_system_admin(uuid)');
select ok(has_function_privilege('service_role', 'public.grant_system_admin(uuid)', 'EXECUTE'),
  'AC-6: service_role has EXECUTE on grant_system_admin(uuid)');

select tests.authenticate_at(tests.sys('sys_a'), 'aal2');
select throws_ok(
  format('insert into public.system_admin (id) values (%L::uuid)', tests.id('member_t2')),
  '42501', null, 'AC-6: sys_a at aal2 cannot INSERT');
select throws_ok(
  format('update public.system_admin set created_at = now() where id = %L::uuid', tests.sys('sys_a')),
  '42501', null, 'AC-6: sys_a at aal2 cannot UPDATE');
select throws_ok(
  format('delete from public.system_admin where id = %L::uuid', tests.sys('sys_a')),
  '42501', null, 'AC-6: sys_a at aal2 cannot DELETE');

select tests.clear_authentication();
select * from finish();
rollback;
