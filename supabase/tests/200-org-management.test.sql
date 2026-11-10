-- MIR-18-b AC-1 to AC-8: a system admin at `aal2` lists, creates and edits orgs through three
-- `security definer` RPCs; a new org arrives with Org public's holidays; `public.org` stays closed
-- (ADR-075 decisions 1 to 7).
--
-- Fixture, added here on top of `tests.seed()` as `postgres` (01-plan.md § 2):
--   * `sys_a` — an `auth.users` row made a system admin with `grant_system_admin`, as in
--     `190-system-admin.test.sql`. A different uuid from 190's, so the files share nothing.
--   * Two holiday rows in Org public: 2031-01-01 `non_working` and 2031-02-08 `working`.
--   * `org_x` — a dedicated org, `org_code = 'mir18b-x'`.
--
-- "At aal2" is claims `{"sub", "role": "authenticated", "aal": "aal2"}`. The two helpers below are
-- copied from `190-system-admin.test.sql:22-37`; `_isolation.psql` is not edited.
--
-- "Refused" (§ 2) includes "and the state of `public.org` and `public.holiday` is as it was": each
-- refusal is followed by `tests.unchanged()`, which compares the holiday row count and every
-- `public.org` row against `tests.snapshot()`.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(64);
select tests.seed();

-- The fixture ids local to this file. Labels are fixture names, not schema fields.
create function tests.sys(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('00000000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values ('sys_a', 'b1'), ('org_x', 'b2'), ('nobody', 'bf')) as v(label, nn)
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

-- Org public's id. Definer, so a test running as `authenticated` can name it in a call.
create function tests.shared_org() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

-- "Writes nothing": the holiday row count and every org row, before and after. Definer, so they run
-- under any role; they read and write only `tests.*` and read `public.*`.
create table tests.baseline (holiday_rows int not null, org_rows text not null);
create function tests.snapshot() returns void
  language sql volatile security definer set search_path = '' as $$
  delete from tests.baseline;
  insert into tests.baseline (holiday_rows, org_rows)
  select (select count(*)::int from public.holiday),
         (select coalesce(string_agg(o::text, ',' order by o.id), '') from public.org o);
$$;
create function tests.unchanged() returns boolean
  language sql stable security definer set search_path = '' as $$
  select b.holiday_rows = (select count(*)::int from public.holiday)
     and b.org_rows = (select coalesce(string_agg(o::text, ',' order by o.id), '') from public.org o)
    from tests.baseline b;
$$;

-- The ids `create_org` returns, captured by the caller.
create table tests.created (org_code text primary key, id uuid not null);
grant select, insert on table tests.created to authenticated;

insert into auth.users (id, email) values (tests.sys('sys_a'), 'sys_a@mir18b.test');
select public.grant_system_admin(tests.sys('sys_a'));

insert into public.holiday (org_id, date, name, kind) values
  (tests.shared_org(), '2031-01-01', 'Tet Duong lich', 'non_working'),
  (tests.shared_org(), '2031-02-08', 'Lam bu', 'working');

insert into public.org (id, org_code, name, is_shared_tenant)
values (tests.sys('org_x'), 'mir18b-x', 'Org X', false);

-- AC-2's expected order, taken while no RPC has written anything.
create table tests.expected_order as
  select o.id, row_number() over (order by o.is_shared_tenant desc, o.org_code asc) as pos
    from public.org o;
grant select on table tests.expected_order to authenticated;

-- AC-4's denominator.
create table tests.shared_holidays as
  select count(*)::int as n from public.holiday h where h.org_id = tests.shared_org();

-- ---------------------------------------------------------------------------------------------
-- AC-1. The licence column exists, and `public.org` stays closed.
-- ---------------------------------------------------------------------------------------------
select has_column('public', 'org', 'licence_expires_at', 'AC-1: public.org.licence_expires_at exists');
select col_type_is('public', 'org', 'licence_expires_at', 'timestamp with time zone',
  'AC-1: licence_expires_at is timestamptz');
select col_is_null('public', 'org', 'licence_expires_at', 'AC-1: licence_expires_at is nullable');
select ok(not has_table_privilege('anon', 'public.org',
            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
  'AC-1: anon holds no privilege on public.org');
select ok(not has_table_privilege('authenticated', 'public.org',
            'SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER'),
  'AC-1: authenticated holds no privilege on public.org');

-- ---------------------------------------------------------------------------------------------
-- AC-2. Only a system admin at aal2 lists orgs.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.sys('sys_a'), 'aal2');
select results_eq('select id from public.list_orgs()',
  'select e.id from tests.expected_order e order by e.pos',
  'AC-2: sys_a at aal2 lists one row per org, shared tenant first, then by org_code');
select results_eq(
  format('select is_shared_tenant from public.list_orgs() where id = %L::uuid', tests.shared_org()),
  $$values (true)$$,
  'AC-2: Org public is listed with is_shared_tenant = true');
select results_eq(
  format('select is_shared_tenant from public.list_orgs() where id = %L::uuid', tests.sys('org_x')),
  $$values (false)$$,
  'AC-2: org_x is listed with is_shared_tenant = false');
select is((select l.id from public.list_orgs() l limit 1), tests.shared_org(),
  'AC-2: the first row is the shared tenant');

select tests.authenticate_at(tests.sys('sys_a'), 'aal1');
select throws_ok('select * from public.list_orgs()', '42501', null,
  'AC-2: sys_a at aal1 is refused with 42501');
select tests.authenticate_at(tests.id('admin_t'), 'aal2');
select throws_ok('select * from public.list_orgs()', '42501', null,
  'AC-2: admin_t at aal2 is refused with 42501');

-- ---------------------------------------------------------------------------------------------
-- AC-3. Creating an org.
-- ---------------------------------------------------------------------------------------------
select tests.clear_authentication();
select tests.snapshot();
select tests.authenticate_at(tests.sys('sys_a'), 'aal2');
select lives_ok(
  $$insert into tests.created (org_code, id)
    select 'mir18b-new', public.create_org('mir18b-new', 'New Org', 'Asia/Ho_Chi_Minh')$$,
  'AC-3: sys_a at aal2 creates mir18b-new');
select isnt((select c.id from tests.created c where c.org_code = 'mir18b-new'), null,
  'AC-3: create_org returns a uuid');
select lives_ok(
  $$insert into tests.created (org_code, id)
    select 'mir18b-trim', public.create_org('mir18b-trim', '  Trimmed Org  ', 'Asia/Ho_Chi_Minh')$$,
  'AC-3: sys_a at aal2 creates mir18b-trim');

select tests.clear_authentication();
select results_eq(
  $$select o.org_code, o.name, o.timezone, o.is_shared_tenant, o.plan,
           o.max_members, o.max_teams, o.licence_expires_at
      from public.org o join tests.created c on c.id = o.id
     where c.org_code = 'mir18b-new'$$,
  $$values ('mir18b-new'::text, 'New Org'::text, 'Asia/Ho_Chi_Minh'::text, false, 'free'::text,
            null::integer, null::integer, null::timestamptz)$$,
  'AC-3: the returned id is a public.org row with the given values and the defaults');
select is(
  (select o.name from public.org o join tests.created c on c.id = o.id where c.org_code = 'mir18b-trim'),
  'Trimmed Org',
  'AC-3: a name given with surrounding spaces is stored trimmed');

-- ---------------------------------------------------------------------------------------------
-- AC-4. A new org arrives with the national holidays.
-- ---------------------------------------------------------------------------------------------
select set_eq(
  $$select h.date, h.name, h.kind from public.holiday h
      join tests.created c on c.id = h.org_id where c.org_code = 'mir18b-new'$$,
  $$select h.date, h.name, h.kind from public.holiday h
      join public.org o on o.id = h.org_id where o.is_shared_tenant$$,
  'AC-4: the new org''s (date, name, kind) set equals Org public''s');
select results_eq(
  $$select h.date, h.name, h.kind::text from public.holiday h
      join tests.created c on c.id = h.org_id
     where c.org_code = 'mir18b-new' and h.date in ('2031-01-01', '2031-02-08')
     order by h.date$$,
  $$values ('2031-01-01'::date, 'Tet Duong lich'::text, 'non_working'::text),
           ('2031-02-08'::date, 'Lam bu'::text, 'working'::text)$$,
  'AC-4: both fixture rows are copied with kind preserved');
select is(
  (select count(*)::int from public.holiday h where h.org_id = tests.shared_org()),
  (select s.n from tests.shared_holidays s),
  'AC-4: Org public''s holiday row count is unchanged');

-- ---------------------------------------------------------------------------------------------
-- AC-5. Creating is refused for a bad value or a non-admin, and writes nothing.
-- ---------------------------------------------------------------------------------------------
select tests.snapshot();
select tests.authenticate_at(tests.sys('sys_a'), 'aal2');

select throws_ok($$select public.create_org('mir18b-x', 'Dup', 'Asia/Ho_Chi_Minh')$$, '23505', null,
  'AC-5: an org_code already in use is refused with 23505');
select ok(tests.unchanged(), 'AC-5: and nothing is written');

select throws_ok($$select public.create_org('admin', 'Reserved', 'Asia/Ho_Chi_Minh')$$, '23514', null,
  'AC-5: a reserved org_code is refused with 23514');
select ok(tests.unchanged(), 'AC-5: and nothing is written');

select throws_ok($$select public.create_org('Bad_Code', 'Malformed', 'Asia/Ho_Chi_Minh')$$, '23514', null,
  'AC-5: a malformed org_code is refused with 23514');
select ok(tests.unchanged(), 'AC-5: and nothing is written');

select throws_ok($$select public.create_org('mir18b-blank', '   ', 'Asia/Ho_Chi_Minh')$$, '23514', null,
  'AC-5: a blank name is refused with 23514');
select ok(tests.unchanged(), 'AC-5: and nothing is written');

select throws_ok($$select public.create_org('mir18b-mars', 'Mars', 'Mars/Olympus')$$, '22023', null,
  'AC-5: an unknown timezone is refused with 22023');
select ok(tests.unchanged(), 'AC-5: and nothing is written');

select tests.authenticate_at(tests.sys('sys_a'), 'aal1');
select throws_ok($$select public.create_org('mir18b-valid', 'Valid', 'Asia/Ho_Chi_Minh')$$, '42501', null,
  'AC-5: sys_a at aal1 is refused with 42501');
select ok(tests.unchanged(), 'AC-5: and nothing is written');

select tests.authenticate_at(tests.id('admin_t'), 'aal2');
select throws_ok($$select public.create_org('mir18b-valid', 'Valid', 'Asia/Ho_Chi_Minh')$$, '42501', null,
  'AC-5: admin_t at aal2 is refused with 42501');
select ok(tests.unchanged(), 'AC-5: and nothing is written');

-- ---------------------------------------------------------------------------------------------
-- AC-6. Editing a dedicated org.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.sys('sys_a'), 'aal2');
select lives_ok(
  format($$select public.update_org(%L::uuid, 'Renamed', 40, 4, 'pro', '2028-01-31')$$, tests.sys('org_x')),
  'AC-6: sys_a at aal2 edits org_x');
select results_eq(
  format($$select name, max_members, max_teams, plan, licence_expires_on, org_code, timezone
             from public.list_orgs() where id = %L::uuid$$, tests.sys('org_x')),
  $$values ('Renamed'::text, 40, 4, 'pro'::text, '2028-01-31'::date,
            'mir18b-x'::text, 'Asia/Ho_Chi_Minh'::text)$$,
  'AC-6: list_orgs() returns the edited values, org_code and timezone unchanged');
select lives_ok(
  format($$select public.update_org(%L::uuid, 'Renamed', null, null, 'pro', null)$$, tests.sys('org_x')),
  'AC-6: sys_a at aal2 clears org_x''s caps and licence');
select results_eq(
  format($$select max_members, max_teams, licence_expires_on
             from public.list_orgs() where id = %L::uuid$$, tests.sys('org_x')),
  $$values (null::integer, null::integer, null::date)$$,
  'AC-6: both caps and licence_expires_on are null');

-- ---------------------------------------------------------------------------------------------
-- AC-7. Editing is refused for Org public, a bad value or a non-admin.
-- ---------------------------------------------------------------------------------------------
select tests.snapshot();

select throws_ok(
  format($$select public.update_org(%L::uuid, 'Org public', null, null, 'free', null)$$, tests.shared_org()),
  '42501', null, 'AC-7: update_org on Org public is refused with 42501');
select ok(tests.unchanged(), 'AC-7: and nothing is written');

select throws_ok(
  format($$select public.update_org(%L::uuid, 'Renamed', 0, null, 'pro', null)$$, tests.sys('org_x')),
  '23514', null, 'AC-7: max_members = 0 is refused with 23514');
select ok(tests.unchanged(), 'AC-7: and nothing is written');

select throws_ok(
  format($$select public.update_org(%L::uuid, 'Renamed', null, 0, 'pro', null)$$, tests.sys('org_x')),
  '23514', null, 'AC-7: max_teams = 0 is refused with 23514');
select ok(tests.unchanged(), 'AC-7: and nothing is written');

select throws_ok(
  format($$select public.update_org(%L::uuid, 'Renamed', null, null, '   ', null)$$, tests.sys('org_x')),
  '23514', null, 'AC-7: a blank plan is refused with 23514');
select ok(tests.unchanged(), 'AC-7: and nothing is written');

select throws_ok(
  format($$select public.update_org(%L::uuid, 'Renamed', null, null, null, null)$$, tests.sys('org_x')),
  '23502', null, 'AC-7: a null plan is refused with 23502');
select ok(tests.unchanged(), 'AC-7: and nothing is written');

select throws_ok(
  format($$select public.update_org(%L::uuid, '   ', null, null, 'pro', null)$$, tests.sys('org_x')),
  '23514', null, 'AC-7: a blank name is refused with 23514');
select ok(tests.unchanged(), 'AC-7: and nothing is written');

select throws_ok(
  format($$select public.update_org(%L::uuid, 'Nobody', null, null, 'pro', null)$$, tests.sys('nobody')),
  'P0002', null, 'AC-7: a uuid with no public.org row is refused with P0002');
select ok(tests.unchanged(), 'AC-7: and nothing is written');

select tests.authenticate_at(tests.sys('sys_a'), 'aal1');
select throws_ok(
  format($$select public.update_org(%L::uuid, 'Renamed', 40, 4, 'pro', null)$$, tests.sys('org_x')),
  '42501', null, 'AC-7: sys_a at aal1 is refused with 42501');
select ok(tests.unchanged(), 'AC-7: and nothing is written');

select tests.authenticate_at(tests.id('admin_t'), 'aal2');
select throws_ok(
  format($$select public.update_org(%L::uuid, 'Renamed', 40, 4, 'pro', null)$$, tests.sys('org_x')),
  '42501', null, 'AC-7: admin_t at aal2 is refused with 42501');
select ok(tests.unchanged(), 'AC-7: and nothing is written');

-- ---------------------------------------------------------------------------------------------
-- AC-8. The RPCs' privileges. The census half is 010-catalogue.test.sql.
-- ---------------------------------------------------------------------------------------------
select tests.clear_authentication();
select ok(has_function_privilege('authenticated', 'public.list_orgs()', 'EXECUTE'),
  'AC-8: authenticated has EXECUTE on list_orgs()');
select ok(has_function_privilege('authenticated', 'public.create_org(text,text,text)', 'EXECUTE'),
  'AC-8: authenticated has EXECUTE on create_org(text,text,text)');
select ok(has_function_privilege('authenticated',
            'public.update_org(uuid,text,integer,integer,text,date)', 'EXECUTE'),
  'AC-8: authenticated has EXECUTE on update_org(uuid,text,integer,integer,text,date)');
select ok(not has_function_privilege('anon', 'public.list_orgs()', 'EXECUTE'),
  'AC-8: anon has no EXECUTE on list_orgs()');
select ok(not has_function_privilege('anon', 'public.create_org(text,text,text)', 'EXECUTE'),
  'AC-8: anon has no EXECUTE on create_org(text,text,text)');
select ok(not has_function_privilege('anon',
            'public.update_org(uuid,text,integer,integer,text,date)', 'EXECUTE'),
  'AC-8: anon has no EXECUTE on update_org(uuid,text,integer,integer,text,date)');
select ok((select p.prosecdef from pg_catalog.pg_proc p
            where p.oid = 'public.list_orgs()'::regprocedure),
  'AC-8: list_orgs() is security definer');
select ok((select p.prosecdef from pg_catalog.pg_proc p
            where p.oid = 'public.create_org(text,text,text)'::regprocedure),
  'AC-8: create_org(text,text,text) is security definer');
select ok((select p.prosecdef from pg_catalog.pg_proc p
            where p.oid = 'public.update_org(uuid,text,integer,integer,text,date)'::regprocedure),
  'AC-8: update_org(uuid,text,integer,integer,text,date) is security definer');

select * from finish();
rollback;
