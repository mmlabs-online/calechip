-- MIR-20-b AC-6 to AC-14 (01-plan.md § 2, § 4.1): the org's read of the impersonation log
-- (`public.list_impersonation_log()`, ADR-100 decision 8).
--
-- The cast is this file's own, added on top of `tests.seed()` as the session user. Labels are fixture
-- names, not schema fields:
--   * Orgs A, B, C — dedicated. A holds team A1; B and C hold none. Org public holds teams P1 and P2.
--   * Org admins: aadm (A), badm (B), cadm (C, no session on it), padm (Org public).
--   * Managers by team membership: p1m (P1), p2m (P2), a1m (A1; the member row's role is 'member').
--   * Refused readers: p1plain (a member of P1), apend (pending, A), aold (a removed org admin of A),
--     pleft (P1 manager membership with left_at set), prem (removed, P1 manager membership still open),
--     sys (a system admin with a live session on A).
--   * Sessions, inserted as the owner with their actions: sA1 (A, whole org, ended, three reads),
--     sA2 (A, live), sB (B, ended), sP1 (Org public, P1, expired and never ended), sP2 (Org public, P2,
--     ended).
--
-- `now()` is the transaction's start, so every time below is an offset from it.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(29);
select tests.seed();

create function tests.lg(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('40000000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('org_a', '01'), ('org_b', '02'), ('org_c', '03'), ('a1', '04'), ('p1', '05'), ('p2', '06'),
      ('aadm', '11'), ('badm', '12'), ('cadm', '13'), ('padm', '14'),
      ('p1m', '21'), ('p2m', '22'), ('a1m', '23'),
      ('p1plain', '31'), ('apend', '32'), ('aold', '33'), ('pleft', '34'), ('prem', '35'),
      ('sys', '41'), ('actor2', '42'),
      ('sA1', '51'), ('sA2', '52'), ('sB', '53'), ('sP1', '54'), ('sP2', '55')
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

-- Definer, so a test running as `authenticated` can name Org public.
create function tests.shared_org() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

-- The log's two row counts, as `sessions|actions`, read as the owner.
create function tests.lg_state() returns text
  language sql stable security definer set search_path = '' as $$
  select (select count(*) from public.impersonation)::text || '|' ||
         (select count(*) from public.impersonation_action)::text;
$$;

-- What a caller received, kept so the owner can compare it with the stored rows.
create table tests.cap (
  who         text not null,
  id          uuid not null,
  actor_email text,
  team_id     uuid,
  team_name   text,
  reason      text,
  started_at  timestamptz,
  expires_at  timestamptz,
  ended_at    timestamptz,
  reads       integer
);
grant select, insert on table tests.cap to authenticated;
create table tests.prints (label text primary key, print text not null);
grant select, insert on table tests.prints to authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The cast, as the session user.
-- ---------------------------------------------------------------------------------------------
insert into public.org (id, org_code, name, is_shared_tenant) values
  (tests.lg('org_a'), 'mir20b-a', 'Org A', false),
  (tests.lg('org_b'), 'mir20b-b', 'Org B', false),
  (tests.lg('org_c'), 'mir20b-c', 'Org C', false);
insert into public.team (id, name, org_id) values
  (tests.lg('a1'), 'A One', tests.lg('org_a')),
  (tests.lg('p1'), 'P One', tests.shared_org()),
  (tests.lg('p2'), 'P Two', tests.shared_org());

insert into auth.users (id, email)
select tests.lg(v.label), v.label || '@mir20b.test'
  from (values ('aadm'), ('badm'), ('cadm'), ('padm'), ('p1m'), ('p2m'), ('a1m'), ('p1plain'),
               ('apend'), ('aold'), ('pleft'), ('prem'), ('sys')) as v(label);

insert into public.member (id, org_id, display_name, avatar, role, status, removed_at, email) values
  (tests.lg('aadm'),    tests.lg('org_a'),  'Aadm',    '1.png', 'org_admin', 'approved', null,  'aadm@mir20b.test'),
  (tests.lg('badm'),    tests.lg('org_b'),  'Badm',    '1.png', 'org_admin', 'approved', null,  'badm@mir20b.test'),
  (tests.lg('cadm'),    tests.lg('org_c'),  'Cadm',    '1.png', 'org_admin', 'approved', null,  'cadm@mir20b.test'),
  (tests.lg('padm'),    tests.shared_org(), 'Padm',    '1.png', 'org_admin', 'approved', null,  'padm@mir20b.test'),
  (tests.lg('p1m'),     tests.shared_org(), 'P1m',     '1.png', 'member',    'approved', null,  'p1m@mir20b.test'),
  (tests.lg('p2m'),     tests.shared_org(), 'P2m',     '1.png', 'member',    'approved', null,  'p2m@mir20b.test'),
  (tests.lg('a1m'),     tests.lg('org_a'),  'A1m',     '1.png', 'member',    'approved', null,  'a1m@mir20b.test'),
  (tests.lg('p1plain'), tests.shared_org(), 'P1plain', '1.png', 'member',    'approved', null,  'p1plain@mir20b.test'),
  (tests.lg('apend'),   tests.lg('org_a'),  'Apend',   '1.png', 'member',    'pending',  null,  'apend@mir20b.test'),
  (tests.lg('aold'),    tests.lg('org_a'),  'Aold',    '1.png', 'org_admin', 'approved', now(), 'aold@mir20b.test'),
  (tests.lg('pleft'),   tests.shared_org(), 'Pleft',   '1.png', 'member',    'approved', null,  'pleft@mir20b.test'),
  (tests.lg('prem'),    tests.shared_org(), 'Prem',    '1.png', 'member',    'approved', now(), 'prem@mir20b.test');

select tests.put_on_team(tests.lg('p1m'), tests.lg('p1'), 'manager');
select tests.put_on_team(tests.lg('p2m'), tests.lg('p2'), 'manager');
select tests.put_on_team(tests.lg('a1m'), tests.lg('a1'), 'manager');
select tests.put_on_team(tests.lg('p1plain'), tests.lg('p1'));
-- A manager membership that has ended, and a removed member's manager membership that was left open.
insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at, left_at) values
  (tests.shared_org(), tests.lg('p1'), tests.lg('pleft'), 'manager', false, now(), now()),
  (tests.shared_org(), tests.lg('p1'), tests.lg('prem'),  'manager', false, now(), null);

select public.grant_system_admin(tests.lg('sys'));

insert into public.impersonation (id, actor_id, actor_email, org_id, team_id, team_name, reason, started_at, expires_at, ended_at) values
  (tests.lg('sA1'), tests.lg('sys'), 'sys@mir20b.test', tests.lg('org_a'), null, null,
   'Customer ticket 1', now() - interval '3 hours', now() - interval '3 hours' + interval '45 minutes',
   now() - interval '3 hours' + interval '20 minutes'),
  (tests.lg('sA2'), tests.lg('sys'), 'sys@mir20b.test', tests.lg('org_a'), null, null,
   'Customer ticket 2', now() - interval '10 minutes', now() + interval '20 minutes', null),
  (tests.lg('sB'),  tests.lg('sys'), 'sys@mir20b.test', tests.lg('org_b'), null, null,
   'Customer ticket 3', now() - interval '5 days', now() - interval '5 days' + interval '30 minutes',
   now() - interval '5 days' + interval '10 minutes'),
  (tests.lg('sP1'), tests.lg('actor2'), 'actor2@mir20b.test', tests.shared_org(), tests.lg('p1'), 'P One',
   'Customer ticket 4', now() - interval '2 hours', now() - interval '90 minutes', null),
  (tests.lg('sP2'), tests.lg('actor2'), 'actor2@mir20b.test', tests.shared_org(), tests.lg('p2'), 'P Two',
   'Customer ticket 5', now() - interval '1 hour', now() - interval '1 hour' + interval '30 minutes',
   now() - interval '1 hour' + interval '15 minutes');
insert into public.impersonation_action (impersonation_id, action) values
  (tests.lg('sA1'), 'start'), (tests.lg('sA1'), 'read_roster'), (tests.lg('sA1'), 'read_roster'),
  (tests.lg('sA1'), 'read_roster'), (tests.lg('sA1'), 'end'),
  (tests.lg('sA2'), 'start'),
  (tests.lg('sB'), 'start'), (tests.lg('sB'), 'end'),
  (tests.lg('sP1'), 'start'), (tests.lg('sP1'), 'read_roster'),
  (tests.lg('sP2'), 'start'), (tests.lg('sP2'), 'read_roster'), (tests.lg('sP2'), 'read_roster'),
  (tests.lg('sP2'), 'end');

-- Team P1 is renamed after sP1 was written (AC-10).
update public.team set name = 'P One renamed' where id = tests.lg('p1');

-- ---------------------------------------------------------------------------------------------
-- AC-6. A dedicated org's org_admin reads every session on the org and nothing else. Two assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.lg('aadm'));
select results_eq('select id from public.list_impersonation_log()',
  format($$values (%L::uuid), (%L::uuid)$$, tests.lg('sA2'), tests.lg('sA1')),
  'AC-6: A''s org admin receives sA2 then sA1');
select is((select count(*)::int from public.list_impersonation_log() l
            where l.id in (tests.lg('sB'), tests.lg('sP1'), tests.lg('sP2'))), 0,
  'AC-6: and none of sB, sP1, sP2');
insert into tests.cap select 'aadm', l.* from public.list_impersonation_log() l;
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-7. Org public's org_admin reads every session on Org public. One assertion.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.lg('padm'));
select results_eq('select id from public.list_impersonation_log()',
  format($$values (%L::uuid), (%L::uuid)$$, tests.lg('sP2'), tests.lg('sP1')),
  'AC-7: Org public''s org admin receives sP2 then sP1, whatever the team');
insert into tests.cap select 'padm', l.* from public.list_impersonation_log() l;
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-8. A team's manager reads the sessions on that team only. Three assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.lg('p1m'));
select results_eq('select id from public.list_impersonation_log()',
  format($$values (%L::uuid)$$, tests.lg('sP1')), 'AC-8: P1''s manager receives exactly sP1');
select tests.authenticate_as(tests.lg('p2m'));
select results_eq('select id from public.list_impersonation_log()',
  format($$values (%L::uuid)$$, tests.lg('sP2')), 'AC-8: P2''s manager receives exactly sP2');
select tests.authenticate_as(tests.lg('a1m'));
select is((select count(*)::int from public.list_impersonation_log()), 0,
  'AC-8: A1''s manager (a dedicated org, no team on any session) receives no row');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-9. Nobody else reads anything. Seven assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.lg('p1plain'));
select is((select count(*)::int from public.list_impersonation_log()), 0,
  'AC-9: a member of P1 who is not its manager receives no row');
select tests.authenticate_as(tests.lg('apend'));
select is((select count(*)::int from public.list_impersonation_log()), 0,
  'AC-9: a pending member of A receives no row');
select tests.authenticate_as(tests.lg('aold'));
select is((select count(*)::int from public.list_impersonation_log()), 0,
  'AC-9: a removed former org admin of A receives no row');
select tests.authenticate_as(tests.lg('pleft'));
select is((select count(*)::int from public.list_impersonation_log()), 0,
  'AC-9: a member whose P1 manager membership has left_at set receives no row');
select tests.authenticate_as(tests.lg('prem'));
select is((select count(*)::int from public.list_impersonation_log()), 0,
  'AC-9: a removed member whose P1 manager membership is still open receives no row');
select tests.authenticate_at(tests.lg('sys'), 'aal2');
select is((select count(*)::int from public.list_impersonation_log()), 0,
  'AC-9: a system admin at aal2 with a live session on A receives no row');
select tests.authenticate_anon();
select throws_ok('select * from public.list_impersonation_log()', '42501', null,
  'AC-9: anon is refused with 42501');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-10. What a row says. Five assertions, over the rows the two org admins received above.
-- ---------------------------------------------------------------------------------------------
select is((select c.actor_email = i.actor_email and c.team_id is null and c.team_name is null
                   and c.reason = i.reason and c.started_at = i.started_at
                   and c.expires_at = i.expires_at and c.ended_at = i.ended_at
              from tests.cap c join public.impersonation i on i.id = c.id
             where c.who = 'aadm' and c.id = tests.lg('sA1')),
  true, 'AC-10: sA1 carries the stored e-mail, reason, times and effective end, and no team');
select is((select c.reads from tests.cap c where c.who = 'aadm' and c.id = tests.lg('sA1')), 3,
  'AC-10: sA1 counts its three reads and not its start and end');
select is((select c.ended_at is null and c.reads = 0
             from tests.cap c where c.who = 'aadm' and c.id = tests.lg('sA2')),
  true, 'AC-10: the live sA2 has a null ended_at and no reads');
select is((select c.ended_at = c.expires_at
             from tests.cap c where c.who = 'padm' and c.id = tests.lg('sP1')),
  true, 'AC-10: sP1, which ran out without an end, ends at its expires_at');
select is((select c.team_id = tests.lg('p1') and c.team_name = 'P One'
             from tests.cap c where c.who = 'padm' and c.id = tests.lg('sP1')),
  true, 'AC-10: sP1 names the team''s name as stored at the start, not its new name');

-- ---------------------------------------------------------------------------------------------
-- AC-11. Newest first, at most 200. Three assertions.
-- ---------------------------------------------------------------------------------------------
insert into public.impersonation (actor_id, actor_email, org_id, reason, started_at, expires_at, ended_at)
select tests.lg('sys'), 'sys@mir20b.test', tests.lg('org_b'), 'Bulk ' || g,
       now() - interval '1 day' - g * interval '1 minute',
       now() - interval '1 day' - g * interval '1 minute' + interval '45 minutes',
       now() - interval '1 day' - g * interval '1 minute' + interval '20 minutes'
  from generate_series(1, 200) g;
select tests.authenticate_as(tests.lg('badm'));
select is((select count(*)::int from public.list_impersonation_log()), 200,
  'AC-11: 201 sessions on B return 200 rows');
select is((select count(*)::int from public.list_impersonation_log() l where l.id = tests.lg('sB')), 0,
  'AC-11: the earliest session, sB, is the one left out');
select is((select count(*)::int
             from (select l.started_at, lag(l.started_at) over () as prev
                     from public.list_impersonation_log() l) x
            where x.prev < x.started_at), 0,
  'AC-11: the rows are ordered by started_at descending');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-12. Reading writes nothing and the tables stay closed. Three assertions.
-- ---------------------------------------------------------------------------------------------
insert into tests.prints (label, print) values ('before', tests.lg_state());
select tests.authenticate_as(tests.lg('aadm'));
insert into tests.cap select 'aadm2', l.* from public.list_impersonation_log() l;
select throws_ok('select 1 from public.impersonation', '42501', null,
  'AC-12: A''s org admin still cannot select public.impersonation');
select throws_ok('select 1 from public.impersonation_action', '42501', null,
  'AC-12: A''s org admin still cannot select public.impersonation_action');
select tests.clear_authentication();
select is(tests.lg_state(), (select p.print from tests.prints p where p.label = 'before'),
  'AC-12: the call left both log tables with the rows they had');

-- ---------------------------------------------------------------------------------------------
-- AC-13. The log follows its team out of Org public. Four assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.lg('sys'), 'aal2');
select lives_ok(format('select * from public.move_team_to_org(%L::uuid, %L::uuid)', tests.lg('p1'), tests.lg('org_c')),
  'AC-13: a system admin moves P1 into org C');
select tests.authenticate_as(tests.lg('p1m'));
select is((select count(*)::int from public.list_impersonation_log() l where l.id = tests.lg('sP1')), 1,
  'AC-13: P1''s manager still receives sP1');
select tests.authenticate_as(tests.lg('padm'));
select is((select count(*)::int from public.list_impersonation_log() l where l.id = tests.lg('sP1')), 1,
  'AC-13: Org public''s org admin still receives sP1');
select tests.authenticate_as(tests.lg('cadm'));
select is((select count(*)::int from public.list_impersonation_log()), 0,
  'AC-13: org C''s org admin receives no row');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-14. The function is security definer. One assertion; 010-catalogue.test.sql lists it.
-- ---------------------------------------------------------------------------------------------
select ok((select p.prosecdef from pg_catalog.pg_proc p
            where p.oid = 'public.list_impersonation_log()'::regprocedure),
  'AC-14: public.list_impersonation_log() is security definer');

select * from finish();
rollback;
