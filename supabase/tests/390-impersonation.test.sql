-- MIR-20 AC-8 to AC-19 (01-plan.md § 2, § 4.1): a system admin's impersonation session — start, the
-- roster read, end, and the log (ADR-100).
--
-- The cast is this file's own, added on top of `tests.seed()` as the session user. Labels are fixture
-- names, not schema fields:
--   * Org A and Org B — dedicated orgs. A: team A One (Ann, Ben), team A Two (Ben also); Cy is pending
--     with no team; Rem is removed. B: team B One with Bea.
--   * In Org public: team P One (Pam, Pat), team P Two (Pam also, Pru), and the empty team P Three.
--   * Sys and Sys2 — system admins; Ann is an approved member; Ben is an org admin of A.
--
-- "At aal2" is claims `{"sub", "role": "authenticated", "aal": "aal2"}`, set by the helper below.
-- `now()` is the transaction's start, so a session started here expires exactly 30 to 60 minutes after
-- it and the expired row of AC-12 is inserted already past its end.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(89);
select tests.seed();

create function tests.im(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('39000000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('org_a', '01'), ('org_b', '02'), ('a1', '03'), ('a2', '04'), ('b1', '05'),
      ('p1', '06'), ('p2', '07'), ('p3', '08'), ('missing', '09'),
      ('ann', '11'), ('ben', '12'), ('cy', '13'), ('rem', '14'), ('bea', '15'),
      ('pam', '21'), ('pat', '22'), ('pru', '23'),
      ('sys', '31'), ('sys2', '32'), ('expired', '41')
    ) as v(label, nn)
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

-- The log's two row counts, as `sessions|actions`, read as the owner.
create function tests.im_state() returns text
  language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.impersonation)::text || '|' ||
         (select count(*) from public.impersonation_action)::text;
$$;

-- The log itself, as one string. "Unchanged" is this being equal to itself.
create function tests.log_print() returns text
  language sql stable security definer set search_path = '' as $$
  select md5(concat_ws('|',
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.impersonation x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.impersonation_action x)));
$$;

-- How many times a session of the given actor was logged doing the given thing.
create function tests.action_count(p_session uuid, p_action text) returns bigint
  language sql stable security definer set search_path = '' as $$
  select count(*) from public.impersonation_action a
   where a.impersonation_id = p_session and a.action = p_action;
$$;
create function tests.read_roster_count() returns bigint
  language sql stable security definer set search_path = '' as $$
  select count(*) from public.impersonation_action a where a.action = 'read_roster';
$$;

-- The state of the org-stamped tables the roster reads and a session must not change.
create function tests.fingerprint() returns text
  language sql stable security definer set search_path = '' as $$
  select md5(concat_ws('|',
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.team x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.member x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.membership x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.entry x)));
$$;

-- The session ids the calls below return, and the rosters they read.
create table tests.sess (label text primary key, id uuid not null);
grant select, insert on table tests.sess to authenticated;
create table tests.prints (label text primary key, print text not null);
grant select, insert on table tests.prints to authenticated;
create table tests.roster_out (
  n            int generated always as identity,
  label        text not null,
  display_name text,
  member_role  text,
  status       text,
  team_names   text[]
);
grant select, insert on table tests.roster_out to authenticated;

-- `sqlstate`, or `ok`, of one statement run as the current role. The block rolls the statement back.
create function tests.state_of(p_sql text) returns text
  language plpgsql volatile security invoker set search_path = '' as $$
begin
  execute p_sql;
  return 'ok';
exception when others then
  return sqlstate;
end;
$$;

-- True when a write was refused with 42501 or touched no row. Update and delete are filtered by
-- row-level security to zero rows; an insert is refused outright.
create function tests.write_refused(p_sql text) returns boolean
  language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_n bigint;
begin
  execute p_sql;
  get diagnostics v_n = row_count;
  return v_n = 0;
exception when sqlstate '42501' then
  return true;
end;
$$;

-- The four operations on one log table, as the states they return, comma-joined.
create function tests.log_closed(p_table text) returns text
  language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_insert text;
begin
  if p_table = 'impersonation' then
    v_insert := 'insert into public.impersonation (actor_id, actor_email, org_id, reason, expires_at) '
             || 'values (gen_random_uuid(), ''x'', gen_random_uuid(), ''r'', now() + interval ''30 minutes'')';
  else
    v_insert := 'insert into public.impersonation_action (impersonation_id, action) '
             || 'values (gen_random_uuid(), ''start'')';
  end if;
  return concat_ws(',',
    tests.state_of(format('select 1 from public.%I', p_table)),
    tests.state_of(v_insert),
    tests.state_of(format('update public.%I set %I = %I', p_table,
                          case p_table when 'impersonation' then 'reason' else 'action' end,
                          case p_table when 'impersonation' then 'reason' else 'action' end)),
    tests.state_of(format('delete from public.%I', p_table)));
end;
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The cast, as the session user.
-- ---------------------------------------------------------------------------------------------
insert into public.org (id, org_code, name, is_shared_tenant) values
  (tests.im('org_a'), 'mir20-a', 'Org A', false),
  (tests.im('org_b'), 'mir20-b', 'Org B', false);
insert into public.team (id, name, org_id) values
  (tests.im('a1'), 'A One',   tests.im('org_a')),
  (tests.im('a2'), 'A Two',   tests.im('org_a')),
  (tests.im('b1'), 'B One',   tests.im('org_b')),
  (tests.im('p1'), 'P One',   tests.shared_org()),
  (tests.im('p2'), 'P Two',   tests.shared_org()),
  (tests.im('p3'), 'P Three', tests.shared_org());

insert into auth.users (id, email)
select tests.im(v.label), v.label || '@mir20.test'
  from (values ('ann'), ('ben'), ('cy'), ('rem'), ('bea'), ('pam'), ('pat'), ('pru'),
               ('sys'), ('sys2')) as v(label);

insert into public.member (id, org_id, display_name, avatar, role, status, removed_at, email) values
  (tests.im('ann'), tests.im('org_a'),  'Ann', '1.png', 'member',    'approved', null,  'ann@mir20.test'),
  (tests.im('ben'), tests.im('org_a'),  'Ben', '1.png', 'org_admin', 'approved', null,  'ben@mir20.test'),
  (tests.im('cy'),  tests.im('org_a'),  'Cy',  '1.png', 'member',    'pending',  null,  'cy@mir20.test'),
  (tests.im('rem'), tests.im('org_a'),  'Rem', '1.png', 'member',    'approved', now(), 'rem@mir20.test'),
  (tests.im('bea'), tests.im('org_b'),  'Bea', '1.png', 'member',    'approved', null,  'bea@mir20.test'),
  (tests.im('pam'), tests.shared_org(), 'Pam', '1.png', 'member',    'approved', null,  'pam@mir20.test'),
  (tests.im('pat'), tests.shared_org(), 'Pat', '1.png', 'member',    'approved', null,  'pat@mir20.test'),
  (tests.im('pru'), tests.shared_org(), 'Pru', '1.png', 'member',    'approved', null,  'pru@mir20.test');

select tests.put_on_team(tests.im('ann'), tests.im('a1'));
select tests.put_on_team(tests.im('ben'), tests.im('a1'));
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.im('org_a'), tests.im('a2'), tests.im('ben'), 'member', false);
select tests.put_on_team(tests.im('rem'), tests.im('a1'));
select tests.put_on_team(tests.im('bea'), tests.im('b1'));
select tests.put_on_team(tests.im('pam'), tests.im('p1'));
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.shared_org(), tests.im('p2'), tests.im('pam'), 'member', false);
select tests.put_on_team(tests.im('pat'), tests.im('p1'));
select tests.put_on_team(tests.im('pru'), tests.im('p2'));

select public.grant_system_admin(tests.im('sys'));
select public.grant_system_admin(tests.im('sys2'));

insert into tests.prints (label, print) values ('pristine', tests.fingerprint());

-- ---------------------------------------------------------------------------------------------
-- AC-8. Only a system admin at aal2 starts, reads, ends or sees a session. Eighteen assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.im('ann'));
select throws_ok(format('select public.start_impersonation(%L::uuid, null, ''r'', 30)', tests.im('org_a')),
  '42501', null, 'AC-8: an approved member is refused start_impersonation with 42501');
select throws_ok('select * from public.current_impersonation()', '42501', null,
  'AC-8: an approved member is refused current_impersonation with 42501');
select throws_ok('select * from public.impersonated_roster()', '42501', null,
  'AC-8: an approved member is refused impersonated_roster with 42501');
select throws_ok('select public.end_impersonation()', '42501', null,
  'AC-8: an approved member is refused end_impersonation with 42501');

select tests.authenticate_as(tests.im('ben'));
select throws_ok(format('select public.start_impersonation(%L::uuid, null, ''r'', 30)', tests.im('org_a')),
  '42501', null, 'AC-8: an org admin is refused start_impersonation with 42501');
select throws_ok('select * from public.current_impersonation()', '42501', null,
  'AC-8: an org admin is refused current_impersonation with 42501');
select throws_ok('select * from public.impersonated_roster()', '42501', null,
  'AC-8: an org admin is refused impersonated_roster with 42501');
select throws_ok('select public.end_impersonation()', '42501', null,
  'AC-8: an org admin is refused end_impersonation with 42501');

select tests.authenticate_at(tests.im('sys'), 'aal1');
select throws_ok(format('select public.start_impersonation(%L::uuid, null, ''r'', 30)', tests.im('org_a')),
  '42501', null, 'AC-8: a system admin at aal1 is refused start_impersonation with 42501');
select throws_ok('select * from public.current_impersonation()', '42501', null,
  'AC-8: a system admin at aal1 is refused current_impersonation with 42501');
select throws_ok('select * from public.impersonated_roster()', '42501', null,
  'AC-8: a system admin at aal1 is refused impersonated_roster with 42501');
select throws_ok('select public.end_impersonation()', '42501', null,
  'AC-8: a system admin at aal1 is refused end_impersonation with 42501');

select tests.clear_authentication();
select is(tests.im_state(), '0|0', 'AC-8: the twelve refused calls wrote nothing to either table');
select ok(not has_function_privilege('anon', 'public.impersonated_org_id()', 'EXECUTE'),
  'AC-8: anon holds no EXECUTE on impersonated_org_id()');
select ok(not has_function_privilege('anon', 'public.start_impersonation(uuid,uuid,text,integer)', 'EXECUTE'),
  'AC-8: anon holds no EXECUTE on start_impersonation(uuid,uuid,text,integer)');
select ok(not has_function_privilege('anon', 'public.end_impersonation()', 'EXECUTE'),
  'AC-8: anon holds no EXECUTE on end_impersonation()');
select ok(not has_function_privilege('anon', 'public.current_impersonation()', 'EXECUTE'),
  'AC-8: anon holds no EXECUTE on current_impersonation()');
select ok(not has_function_privilege('anon', 'public.impersonated_roster()', 'EXECUTE'),
  'AC-8: anon holds no EXECUTE on impersonated_roster()');

-- ---------------------------------------------------------------------------------------------
-- AC-9. The start refuses a bad box, target or reason. Twelve assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.im('sys'), 'aal2');
select throws_ok(format('select public.start_impersonation(%L::uuid, null, ''r'', 29)', tests.im('org_a')),
  '22023', null, 'AC-9: 29 minutes is refused with 22023');
select throws_ok(format('select public.start_impersonation(%L::uuid, null, ''r'', 61)', tests.im('org_a')),
  '22023', null, 'AC-9: 61 minutes is refused with 22023');
select throws_ok(format('select public.start_impersonation(%L::uuid, null, ''r'', null)', tests.im('org_a')),
  '22023', null, 'AC-9: a null box is refused with 22023');
select throws_ok(format('select public.start_impersonation(%L::uuid, null, ''r'', 30)', tests.im('missing')),
  'P0002', null, 'AC-9: an org that does not exist is refused with P0002');
select throws_ok(format('select public.start_impersonation(%L::uuid, null, ''r'', 30)', tests.shared_org()),
  '22023', null, 'AC-9: Org public with no team is refused with 22023');
select throws_ok(
  format('select public.start_impersonation(%L::uuid, %L::uuid, ''r'', 30)', tests.shared_org(), tests.im('a1')),
  'P0002', null, 'AC-9: Org public and a team of a dedicated org is refused with P0002');
select throws_ok(
  format('select public.start_impersonation(%L::uuid, %L::uuid, ''r'', 30)', tests.im('org_a'), tests.im('a1')),
  '22023', null, 'AC-9: a dedicated org and a team is refused with 22023');
select throws_ok(format('select public.start_impersonation(%L::uuid, null, '''', 30)', tests.im('org_a')),
  '23514', null, 'AC-9: an empty reason is refused with 23514');
select throws_ok(format('select public.start_impersonation(%L::uuid, null, ''   '', 30)', tests.im('org_a')),
  '23514', null, 'AC-9: a reason of spaces is refused with 23514');
select throws_ok(
  format('select public.start_impersonation(%L::uuid, null, repeat(''x'', 501), 30)', tests.im('org_a')),
  '23514', null, 'AC-9: a reason of 501 characters is refused with 23514');
select throws_ok(format('select public.start_impersonation(%L::uuid, null, null, 30)', tests.im('org_a')),
  '23502', null, 'AC-9: a null reason is refused with 23502');
select tests.clear_authentication();
select is(tests.im_state(), '0|0', 'AC-9: the eleven refused calls wrote nothing to either table');

-- ---------------------------------------------------------------------------------------------
-- AC-16, first half. No session: no row of org data. Four assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.im('sys'), 'aal2');
select is((select count(*)::int from public.entry), 0, 'AC-16: with no session, entry returns no row');
select is((select count(*)::int from public.member), 0, 'AC-16: with no session, member returns no row');
select is((select count(*)::int from public.membership), 0, 'AC-16: with no session, membership returns no row');
select is((select count(*)::int from public.team), 0, 'AC-16: with no session, team returns no row');

-- ---------------------------------------------------------------------------------------------
-- AC-10. A start writes the session and the log. Six assertions.
-- ---------------------------------------------------------------------------------------------
insert into tests.sess (label, id)
select 'a', public.start_impersonation(tests.im('org_a'), null, '  Customer ticket 4411  ', 45);
select tests.clear_authentication();
select is((select i.actor_id = tests.im('sys') and i.actor_email = 'sys@mir20.test'
             from public.impersonation i where i.id = (select s.id from tests.sess s where s.label = 'a')),
  true, 'AC-10: the row carries the caller and the caller''s email');
select is((select i.org_id = tests.im('org_a') and i.team_id is null and i.team_name is null
             from public.impersonation i where i.id = (select s.id from tests.sess s where s.label = 'a')),
  true, 'AC-10: the row names the org and no team');
select is((select i.reason from public.impersonation i where i.id = (select s.id from tests.sess s where s.label = 'a')),
  'Customer ticket 4411', 'AC-10: the reason is stored trimmed');
select is((select i.expires_at = i.started_at + interval '45 minutes' and i.ended_at is null
             from public.impersonation i where i.id = (select s.id from tests.sess s where s.label = 'a')),
  true, 'AC-10: the box is 45 minutes and the session is open');
select is((select string_agg(a.action, ',') from public.impersonation_action a
            where a.impersonation_id = (select s.id from tests.sess s where s.label = 'a')),
  'start', 'AC-10: exactly one action, start');
select tests.authenticate_at(tests.im('sys'), 'aal2');
select results_eq(
  'select id, org_code, org_name, team_id, reason from public.current_impersonation()',
  format($$values (%L::uuid, 'mir20-a'::text, 'Org A'::text, null::uuid, 'Customer ticket 4411'::text)$$,
         (select s.id from tests.sess s where s.label = 'a')),
  'AC-10: current_impersonation returns exactly that session with the org''s code and name');

-- ---------------------------------------------------------------------------------------------
-- AC-11. A second start while live is refused. Three assertions.
-- ---------------------------------------------------------------------------------------------
select throws_ok(format('select public.start_impersonation(%L::uuid, null, ''again'', 30)', tests.im('org_b')),
  'IM001', null, 'AC-11: a second start for another org is refused with IM001');
select throws_ok(format('select public.start_impersonation(%L::uuid, null, ''again'', 30)', tests.im('org_a')),
  'IM001', null, 'AC-11: a second start for the same org is refused with IM001');
select tests.clear_authentication();
select is(tests.im_state(), '1|1', 'AC-11: the first session is unchanged and nothing was added');

-- ---------------------------------------------------------------------------------------------
-- AC-14, dedicated org. The roster is the org's and the read is logged. Two assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.im('sys'), 'aal2');
insert into tests.roster_out (label, display_name, member_role, status, team_names)
select 'a', r.display_name, r.member_role, r.status, r.team_names from public.impersonated_roster() r;
select tests.clear_authentication();
select results_eq(
  $$select display_name, member_role, status, team_names from tests.roster_out where label = 'a' order by n$$,
  $$values ('Ann'::text, 'member'::text, 'approved'::text, array['A One']::text[]),
           ('Ben'::text, 'org_admin'::text, 'approved'::text, array['A One', 'A Two']::text[]),
           ('Cy'::text,  'member'::text, 'pending'::text, '{}'::text[])$$,
  'AC-14: Org A''s roster is its three current members, Rem and every other org absent, teams sorted');
select is(tests.action_count((select s.id from tests.sess s where s.label = 'a'), 'read_roster'), 1::bigint,
  'AC-14: the read wrote exactly one read_roster action');

-- ---------------------------------------------------------------------------------------------
-- AC-15. A live session cannot write. Eight assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.im('sys'), 'aal2');
select throws_ok(
  format($$insert into public.entry (member_id, type, portion, start_date, end_date)
           values (%L::uuid, 'pto', 'full', '2099-03-02', '2099-03-03')$$, tests.im('ann')),
  '42501', null, 'AC-15: inserting an entry for an org member is refused with 42501');
select is(tests.write_refused(
  format('update public.member set display_name = ''Changed'' where id = %L::uuid', tests.im('ann'))), true,
  'AC-15: updating a member affects no row');
select is(tests.write_refused(
  format('delete from public.membership where member_id = %L::uuid', tests.im('ann'))), true,
  'AC-15: deleting a membership affects no row');
select is(tests.write_refused(
  format('update public.team set name = ''Changed'' where id = %L::uuid', tests.im('a1'))), true,
  'AC-15: updating a team affects no row');
select throws_ok($$select public.create_team('Made under impersonation')$$, '42501', null,
  'AC-15: create_team is refused with 42501');
select throws_ok(format('select public.admit_member(%L::uuid, %L::uuid)', tests.im('cy'), tests.im('a1')),
  '42501', null, 'AC-15: admit_member is refused with 42501');
select throws_ok(format($$select public.set_member_role(%L::uuid, 'manager')$$, tests.im('ann')),
  '42501', null, 'AC-15: set_member_role is refused with 42501');
select tests.clear_authentication();
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'pristine'),
  'AC-15: the rows of Org A are unchanged');

-- ---------------------------------------------------------------------------------------------
-- AC-16, second half. A live session on A still returns no row of org data. Four assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.im('sys'), 'aal2');
select is((select count(*)::int from public.entry), 0, 'AC-16: with a live session, entry returns no row');
select is((select count(*)::int from public.member), 0, 'AC-16: with a live session, member returns no row');
select is((select count(*)::int from public.membership), 0, 'AC-16: with a live session, membership returns no row');
select is((select count(*)::int from public.team), 0, 'AC-16: with a live session, team returns no row');

-- ---------------------------------------------------------------------------------------------
-- AC-17. The log is closed to every caller and append-only. Thirteen assertions; the log holds a
-- live session and two actions while they run.
-- ---------------------------------------------------------------------------------------------
select tests.clear_authentication();
select has_table('public', 'impersonation', 'AC-17: public.impersonation exists');
select has_table('public', 'impersonation_action', 'AC-17: public.impersonation_action exists');
select is((select count(*)::int from pg_class c
            where c.oid in ('public.impersonation'::regclass, 'public.impersonation_action'::regclass)
              and c.relrowsecurity), 2, 'AC-17: row-level security is enabled on both tables');
select is((select count(*)::int from pg_policies p
            where p.schemaname = 'public' and p.tablename in ('impersonation', 'impersonation_action')),
  0, 'AC-17: neither table has a policy');
select tests.authenticate_anon();
select is(tests.log_closed('impersonation'), '42501,42501,42501,42501',
  'AC-17: anon is refused every operation on impersonation');
select is(tests.log_closed('impersonation_action'), '42501,42501,42501,42501',
  'AC-17: anon is refused every operation on impersonation_action');
select tests.authenticate_as(tests.im('ann'));
select is(tests.log_closed('impersonation'), '42501,42501,42501,42501',
  'AC-17: an approved member is refused every operation on impersonation');
select is(tests.log_closed('impersonation_action'), '42501,42501,42501,42501',
  'AC-17: an approved member is refused every operation on impersonation_action');
select tests.authenticate_as(tests.im('ben'));
select is(tests.log_closed('impersonation'), '42501,42501,42501,42501',
  'AC-17: an org admin is refused every operation on impersonation');
select is(tests.log_closed('impersonation_action'), '42501,42501,42501,42501',
  'AC-17: an org admin is refused every operation on impersonation_action');
select tests.authenticate_at(tests.im('sys'), 'aal2');
select is(tests.log_closed('impersonation'), '42501,42501,42501,42501',
  'AC-17: a system admin at aal2 is refused every operation on impersonation');
select is(tests.log_closed('impersonation_action'), '42501,42501,42501,42501',
  'AC-17: a system admin at aal2 is refused every operation on impersonation_action');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-13. Ending a session. Six assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.im('sys'), 'aal2');
select public.end_impersonation();
select tests.clear_authentication();
select is((select i.ended_at is not null from public.impersonation i
            where i.id = (select s.id from tests.sess s where s.label = 'a')),
  true, 'AC-13: the session''s ended_at is set');
select is(tests.action_count((select s.id from tests.sess s where s.label = 'a'), 'end'), 1::bigint,
  'AC-13: one end action was written');
select tests.authenticate_at(tests.im('sys'), 'aal2');
select is((select count(*)::int from public.current_impersonation()), 0,
  'AC-13: current_impersonation returns no row');
select throws_ok('select * from public.impersonated_roster()', '42501', null,
  'AC-13: impersonated_roster is refused with 42501');
select lives_ok('select public.end_impersonation()', 'AC-13: a further end_impersonation returns without error');
select tests.clear_authentication();
select is(tests.action_count((select s.id from tests.sess s where s.label = 'a'), 'end'), 1::bigint,
  'AC-13: and wrote no second end action');

-- ---------------------------------------------------------------------------------------------
-- AC-10 (a team of Org public) and AC-14 (that team's roster). Four assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.im('sys'), 'aal2');
insert into tests.sess (label, id)
select 'p', public.start_impersonation(tests.shared_org(), tests.im('p1'), 'Customer ticket 4412', 60);
insert into tests.roster_out (label, display_name, member_role, status, team_names)
select 'p', r.display_name, r.member_role, r.status, r.team_names from public.impersonated_roster() r;
select tests.clear_authentication();
select is((select i.team_id = tests.im('p1') and i.team_name = 'P One' and i.org_id = tests.shared_org()
             from public.impersonation i where i.id = (select s.id from tests.sess s where s.label = 'p')),
  true, 'AC-10: the row carries the team and its name');
select results_eq(
  $$select display_name, member_role, status, team_names from tests.roster_out where label = 'p' order by n$$,
  $$values ('Pam'::text, 'member'::text, 'approved'::text, array['P One']::text[]),
           ('Pat'::text, 'member'::text, 'approved'::text, array['P One']::text[])$$,
  'AC-14: the roster is the team''s members only, each carrying that team''s name alone');
select is(tests.action_count((select s.id from tests.sess s where s.label = 'p'), 'read_roster'), 1::bigint,
  'AC-14: the read wrote exactly one read_roster action');
select tests.authenticate_at(tests.im('sys'), 'aal2');
select lives_ok('select public.end_impersonation()', 'AC-14: the Org public session ends');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-12. The database clock ends a session. Five assertions.
-- ---------------------------------------------------------------------------------------------
insert into public.impersonation (id, actor_id, actor_email, org_id, reason, started_at, expires_at)
values (tests.im('expired'), tests.im('sys'), 'sys@mir20.test', tests.im('org_b'), 'Expired one',
        now() - interval '2 hours', now() - interval '90 minutes');
insert into tests.prints (label, print) values ('reads', tests.read_roster_count()::text);
select tests.authenticate_at(tests.im('sys'), 'aal2');
select is((select count(*)::int from public.current_impersonation()), 0,
  'AC-12: current_impersonation returns no row for a session past its end');
select throws_ok('select * from public.impersonated_roster()', '42501', null,
  'AC-12: impersonated_roster is refused with 42501');
select tests.clear_authentication();
select is(tests.read_roster_count()::text, (select p.print from tests.prints p where p.label = 'reads'),
  'AC-12: and no read_roster action was written');
select tests.authenticate_at(tests.im('sys'), 'aal2');
select lives_ok(format('select public.start_impersonation(%L::uuid, null, ''After expiry'', 30)', tests.im('org_b')),
  'AC-12: a new start succeeds over an expired session');
select tests.clear_authentication();
select is((select i.ended_at = i.expires_at from public.impersonation i where i.id = tests.im('expired')),
  true, 'AC-12: the expired session''s ended_at equals its expires_at');
select tests.authenticate_at(tests.im('sys'), 'aal2');
select public.end_impersonation();
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-18. The log outlives its actor and does not pin a team. Four assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.im('sys2'), 'aal2');
insert into tests.sess (label, id)
select 'p3', public.start_impersonation(tests.shared_org(), tests.im('p3'), 'Customer ticket 4413', 30);
select public.end_impersonation();
select tests.clear_authentication();
insert into tests.prints (label, print) values ('log', tests.log_print());
select lives_ok(format('delete from public.system_admin where id = %L::uuid', tests.im('sys2')),
  'AC-18: deleting the actor''s system_admin row succeeds');
select tests.authenticate_at(tests.im('sys'), 'aal2');
select lives_ok(format('select * from public.move_team_to_org(%L::uuid, %L::uuid)', tests.im('p3'), tests.im('org_a')),
  'AC-18: moving the impersonated team into a dedicated org succeeds');
select tests.clear_authentication();
select is(tests.log_print(), (select p.print from tests.prints p where p.label = 'log'),
  'AC-18: the session row and its action rows are unchanged');
select is((select i.team_id = tests.im('p3') and i.team_name = 'P Three' and i.ended_at is not null
             from public.impersonation i where i.id = (select s.id from tests.sess s where s.label = 'p3')),
  true, 'AC-18: the row still names the team it was started on');

-- ---------------------------------------------------------------------------------------------
-- AC-19. The five functions are security definer. One assertion; 010-catalogue.test.sql lists them.
-- ---------------------------------------------------------------------------------------------
select set_eq(
  $$select p.oid::regprocedure::text from pg_catalog.pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prosecdef
       and p.proname in ('impersonated_org_id', 'start_impersonation', 'end_impersonation',
                         'current_impersonation', 'impersonated_roster')$$,
  array[
    'public.impersonated_org_id()',
    'public.start_impersonation(uuid,uuid,text,integer)',
    'public.end_impersonation()',
    'public.current_impersonation()',
    'public.impersonated_roster()'
  ],
  'AC-19: the five impersonation functions are security definer');

select * from finish();
rollback;
