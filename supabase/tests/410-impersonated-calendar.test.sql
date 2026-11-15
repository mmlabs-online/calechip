-- MIR-20-c AC-7 to AC-15 (01-plan.md § 2, § 4.1): the calendar read a live impersonation unlocks
-- (`public.impersonated_calendar(date, date)`, ADR-100 decisions 2, 6 and 8).
--
-- The cast is this file's own, added on top of `tests.seed()` as the session user. Labels are fixture
-- names, not schema fields:
--   * Org A (dedicated): team A1 with approved members ann and abe, the removed rem, and the org admin
--     aadm. Org B (dedicated): team B1 with bea.
--   * Org public: team P1 with pam and pat, team P2 with pam and pru, and lea, whose P1 membership has
--     left_at set (her active primary team is P2).
--   * sys and sys2 — system admins.
-- Entries are inserted as the owner with the `org_id` and `primary_team_id` their member's org and
-- team require; the stamp trigger would fill both for an active member, and not for a removed one.
--
-- "At aal2" is claims `{"sub", "role": "authenticated", "aal": "aal2"}`, set by the helper below.
-- `now()` is the transaction's start, so a session started here expires 30 minutes after it.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(28);
select tests.seed();

create function tests.cl(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('41000000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('org_a', '01'), ('org_b', '02'), ('a1', '03'), ('b1', '04'), ('p1', '05'), ('p2', '06'),
      ('ann', '11'), ('abe', '12'), ('rem', '13'), ('bea', '14'), ('aadm', '15'),
      ('pam', '21'), ('pat', '22'), ('pru', '23'), ('lea', '24'),
      ('sys', '31'), ('sys2', '32'),
      ('e_ann1', '51'), ('e_ann2', '52'), ('e_abe1', '53'), ('e_abe2', '54'), ('e_rem', '55'),
      ('e_bea', '56'), ('e_pam', '57'), ('e_pat', '58'), ('e_pru', '59'), ('e_lea', '60'),
      ('s_exp', '71')
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

-- Row counts of the action log: all of it, all read_calendar rows, and one session's read_calendar rows.
create function tests.cl_actions() returns bigint
  language sql stable security definer set search_path = '' as $$
  select count(*) from public.impersonation_action;
$$;
create function tests.cl_cal_all() returns bigint
  language sql stable security definer set search_path = '' as $$
  select count(*) from public.impersonation_action a where a.action = 'read_calendar';
$$;
create function tests.cl_cal_n(p_session uuid) returns bigint
  language sql stable security definer set search_path = '' as $$
  select count(*) from public.impersonation_action a
   where a.impersonation_id = p_session and a.action = 'read_calendar';
$$;

-- The entry table as one string. "Unchanged" is this being equal to itself.
create function tests.cl_entry_print() returns text
  language sql stable security definer set search_path = '' as $$
  select md5(coalesce(string_agg(x::text, ',' order by x::text), '')) from public.entry x;
$$;

create table tests.sess (label text primary key, id uuid not null);
grant select, insert on table tests.sess to authenticated;
create table tests.prints (label text primary key, print text not null);
grant select, insert on table tests.prints to authenticated;
create table tests.cal_out (
  n            int generated always as identity,
  who          text not null,
  entry_id     uuid,
  member_id    uuid,
  display_name text,
  type         text,
  portion      text,
  start_date   date,
  end_date     date,
  tentative    boolean,
  status       text
);
grant select, insert on table tests.cal_out to authenticated;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The cast, as the session user.
-- ---------------------------------------------------------------------------------------------
insert into public.org (id, org_code, name, is_shared_tenant) values
  (tests.cl('org_a'), 'mir20c-a', 'Org A', false),
  (tests.cl('org_b'), 'mir20c-b', 'Org B', false);
insert into public.team (id, name, org_id) values
  (tests.cl('a1'), 'A One', tests.cl('org_a')),
  (tests.cl('b1'), 'B One', tests.cl('org_b')),
  (tests.cl('p1'), 'P One', tests.shared_org()),
  (tests.cl('p2'), 'P Two', tests.shared_org());

insert into auth.users (id, email)
select tests.cl(v.label), v.label || '@mir20c.test'
  from (values ('ann'), ('abe'), ('rem'), ('bea'), ('aadm'), ('pam'), ('pat'), ('pru'), ('lea'),
               ('sys'), ('sys2')) as v(label);

insert into public.member (id, org_id, display_name, avatar, role, status, removed_at, email) values
  (tests.cl('ann'),  tests.cl('org_a'),  'Ann',   '1.png', 'member',    'approved', null,  'ann@mir20c.test'),
  (tests.cl('abe'),  tests.cl('org_a'),  'Abe',   '1.png', 'member',    'approved', null,  'abe@mir20c.test'),
  (tests.cl('rem'),  tests.cl('org_a'),  'Rem',   '1.png', 'member',    'approved', now(), 'rem@mir20c.test'),
  (tests.cl('aadm'), tests.cl('org_a'),  'Aadm',  '1.png', 'org_admin', 'approved', null,  'aadm@mir20c.test'),
  (tests.cl('bea'),  tests.cl('org_b'),  'Bea',   '1.png', 'member',    'approved', null,  'bea@mir20c.test'),
  (tests.cl('pam'),  tests.shared_org(), 'Pam',   '1.png', 'member',    'approved', null,  'pam@mir20c.test'),
  (tests.cl('pat'),  tests.shared_org(), 'Pat',   '1.png', 'member',    'approved', null,  'pat@mir20c.test'),
  (tests.cl('pru'),  tests.shared_org(), 'Pru',   '1.png', 'member',    'approved', null,  'pru@mir20c.test'),
  (tests.cl('lea'),  tests.shared_org(), 'Lea',   '1.png', 'member',    'approved', null,  'lea@mir20c.test');

select tests.put_on_team(tests.cl('ann'), tests.cl('a1'));
select tests.put_on_team(tests.cl('abe'), tests.cl('a1'));
select tests.put_on_team(tests.cl('rem'), tests.cl('a1'));
select tests.put_on_team(tests.cl('aadm'), tests.cl('a1'));
select tests.put_on_team(tests.cl('bea'), tests.cl('b1'));
select tests.put_on_team(tests.cl('pam'), tests.cl('p1'));
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.shared_org(), tests.cl('p2'), tests.cl('pam'), 'member', false);
select tests.put_on_team(tests.cl('pat'), tests.cl('p1'));
select tests.put_on_team(tests.cl('pru'), tests.cl('p2'));
select tests.put_on_team(tests.cl('lea'), tests.cl('p2'));
insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at, left_at)
values (tests.shared_org(), tests.cl('p1'), tests.cl('lea'), 'member', false, now(), now());

select public.grant_system_admin(tests.cl('sys'));
select public.grant_system_admin(tests.cl('sys2'));

insert into public.entry (id, member_id, org_id, primary_team_id, type, portion, start_date, end_date,
                          tentative, status, rejection_reason, approved_at) values
  (tests.cl('e_ann1'), tests.cl('ann'), tests.cl('org_a'),  tests.cl('a1'), 'pto', 'full', '2026-09-14', '2026-09-16', false, 'approved', null, now()),
  (tests.cl('e_ann2'), tests.cl('ann'), tests.cl('org_a'),  tests.cl('a1'), 'wfh', 'am',   '2026-08-28', '2026-09-02', true,  'pending',  null, null),
  (tests.cl('e_abe1'), tests.cl('abe'), tests.cl('org_a'),  tests.cl('a1'), 'wfh', 'full', '2026-09-10', '2026-09-10', false, 'rejected', 'No cover', null),
  (tests.cl('e_abe2'), tests.cl('abe'), tests.cl('org_a'),  tests.cl('a1'), 'pto', 'pm',   '2026-10-05', '2026-10-05', false, 'approved', null, now()),
  (tests.cl('e_rem'),  tests.cl('rem'), tests.cl('org_a'),  tests.cl('a1'), 'pto', 'full', '2026-09-20', '2026-09-20', false, 'approved', null, now()),
  (tests.cl('e_bea'),  tests.cl('bea'), tests.cl('org_b'),  tests.cl('b1'), 'pto', 'full', '2026-09-14', '2026-09-14', false, 'approved', null, now()),
  (tests.cl('e_pam'),  tests.cl('pam'), tests.shared_org(), tests.cl('p1'), 'wfh', 'full', '2026-09-15', '2026-09-15', false, 'approved', null, now()),
  (tests.cl('e_pat'),  tests.cl('pat'), tests.shared_org(), tests.cl('p1'), 'pto', 'am',   '2026-09-16', '2026-09-16', false, 'pending',  null, null),
  (tests.cl('e_pru'),  tests.cl('pru'), tests.shared_org(), tests.cl('p2'), 'pto', 'full', '2026-09-17', '2026-09-17', false, 'approved', null, now()),
  (tests.cl('e_lea'),  tests.cl('lea'), tests.shared_org(), tests.cl('p2'), 'pto', 'full', '2026-09-18', '2026-09-18', false, 'approved', null, now());

-- ---------------------------------------------------------------------------------------------
-- AC-7. Only a system admin at aal2 may call it. Five assertions.
-- ---------------------------------------------------------------------------------------------
insert into tests.prints (label, print) values ('actions0', tests.cl_actions()::text);
select tests.authenticate_as(tests.cl('ann'));
select throws_ok($$select * from public.impersonated_calendar('2026-09-01', '2026-09-30')$$, '42501', null,
  'AC-7: an approved member is refused with 42501');
select tests.authenticate_as(tests.cl('aadm'));
select throws_ok($$select * from public.impersonated_calendar('2026-09-01', '2026-09-30')$$, '42501', null,
  'AC-7: an org admin is refused with 42501');
select tests.authenticate_at(tests.cl('sys'), 'aal1');
select throws_ok($$select * from public.impersonated_calendar('2026-09-01', '2026-09-30')$$, '42501', null,
  'AC-7: a system admin at aal1 is refused with 42501');
select tests.authenticate_anon();
select throws_ok($$select * from public.impersonated_calendar('2026-09-01', '2026-09-30')$$, '42501', null,
  'AC-7: anon is refused with 42501');
select tests.clear_authentication();
select is(tests.cl_actions()::text, (select p.print from tests.prints p where p.label = 'actions0'),
  'AC-7: the four refused calls wrote nothing to the action log');

-- ---------------------------------------------------------------------------------------------
-- AC-8. No live session, no read, no log row. Three assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.cl('sys'), 'aal2');
select throws_ok($$select * from public.impersonated_calendar('2026-09-01', '2026-09-30')$$, '42501', null,
  'AC-8: a system admin at aal2 with no session is refused with 42501');
select tests.clear_authentication();
insert into public.impersonation (id, actor_id, actor_email, org_id, reason, started_at, expires_at, ended_at)
values (tests.cl('s_exp'), tests.cl('sys'), 'sys@mir20c.test', tests.cl('org_a'), 'Old ticket',
        now() - interval '2 hours', now() - interval '1 hour', null);
select tests.authenticate_at(tests.cl('sys'), 'aal2');
select throws_ok($$select * from public.impersonated_calendar('2026-09-01', '2026-09-30')$$, '42501', null,
  'AC-8: a session past its expires_at and never ended is refused with 42501');
select tests.clear_authentication();
select is(tests.cl_cal_all(), 0::bigint, 'AC-8: no read_calendar action exists');

-- ---------------------------------------------------------------------------------------------
-- AC-9. A bad range is refused before anything is written. Six assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.cl('sys'), 'aal2');
insert into tests.sess (label, id)
select 'a', public.start_impersonation(tests.cl('org_a'), null, 'Customer ticket 4411', 30);
select throws_ok($$select * from public.impersonated_calendar(null::date, '2026-09-30')$$, '22023', null,
  'AC-9: a null p_start is refused with 22023');
select throws_ok($$select * from public.impersonated_calendar('2026-09-01', null::date)$$, '22023', null,
  'AC-9: a null p_end is refused with 22023');
select throws_ok($$select * from public.impersonated_calendar('2026-09-30', '2026-09-29')$$, '22023', null,
  'AC-9: p_end before p_start is refused with 22023');
select throws_ok($$select * from public.impersonated_calendar('2026-09-01', '2026-10-02')$$, '22023', null,
  'AC-9: p_end - p_start of 31 is refused with 22023');
select tests.clear_authentication();
select is(tests.cl_cal_n((select s.id from tests.sess s where s.label = 'a')), 0::bigint,
  'AC-9: the four refused calls wrote no read_calendar action');
select tests.authenticate_at(tests.cl('sys'), 'aal2');
select lives_ok($$select * from public.impersonated_calendar('2026-10-01', '2026-10-31')$$,
  'AC-9: p_end - p_start of 30 (2026-10-01..2026-10-31) is accepted');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-10 and AC-12. A dedicated org's month, and the read changes no org data. Four plus two.
-- ---------------------------------------------------------------------------------------------
insert into tests.prints (label, print) values
  ('c0', tests.cl_cal_n((select s.id from tests.sess s where s.label = 'a'))::text),
  ('entries0', tests.cl_entry_print());
select tests.authenticate_at(tests.cl('sys'), 'aal2');
insert into tests.cal_out (who, entry_id, member_id, display_name, type, portion, start_date, end_date, tentative, status)
select 'a', c.entry_id, c.member_id, c.display_name, c.type, c.portion, c.start_date, c.end_date, c.tentative, c.status
  from public.impersonated_calendar('2026-09-01', '2026-09-30') c;
select results_eq(
  $$select entry_id, member_id, display_name, type, portion, start_date, end_date, tentative, status
      from tests.cal_out where who = 'a' order by n$$,
  format($$values (%L::uuid, %L::uuid, 'Ann'::text, 'wfh'::text, 'am'::text, '2026-08-28'::date, '2026-09-02'::date, true, 'pending'::text),
                  (%L::uuid, %L::uuid, 'Ann'::text, 'pto'::text, 'full'::text, '2026-09-14'::date, '2026-09-16'::date, false, 'approved'::text)$$,
         tests.cl('e_ann2'), tests.cl('ann'), tests.cl('e_ann1'), tests.cl('ann')),
  'AC-10: exactly Ann''s two entries, the wfh am one first');
select is((select count(*)::int from tests.cal_out o
            where o.who = 'a'
              and o.entry_id in (tests.cl('e_abe1'), tests.cl('e_abe2'), tests.cl('e_rem'), tests.cl('e_bea'),
                                 tests.cl('e_pam'), tests.cl('e_pat'), tests.cl('e_pru'), tests.cl('e_lea'))), 0,
  'AC-10: Abe''s rejected and October entries, Rem''s, Bea''s and every Org public entry are absent');
-- The same two rows, compared with what is stored.
select tests.clear_authentication();
select is((select count(*)::int
             from tests.cal_out o join public.entry e on e.id = o.entry_id
            where o.who = 'a' and o.member_id = e.member_id and o.type = e.type::text
              and o.portion = e.portion::text and o.start_date = e.start_date and o.end_date = e.end_date
              and o.tentative = e.tentative and o.status = e.status::text
              and o.display_name = (select m.display_name from public.member m where m.id = e.member_id)), 2,
  'AC-10: each returned row equals the stored values');
select is(tests.cl_cal_n((select s.id from tests.sess s where s.label = 'a'))::text,
  ((select p.print::int from tests.prints p where p.label = 'c0') + 1)::text,
  'AC-10: exactly one read_calendar action was written for the call');
select is(tests.cl_entry_print(), (select p.print from tests.prints p where p.label = 'entries0'),
  'AC-12: the md5 of public.entry is unchanged by the read');
select tests.authenticate_at(tests.cl('sys'), 'aal2');
select is((select count(*)::int from public.entry), 0,
  'AC-12: the system admin''s own select on public.entry still returns zero rows');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-11. A team of Org public's month. Three assertions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.cl('sys2'), 'aal2');
insert into tests.sess (label, id)
select 'p', public.start_impersonation(tests.shared_org(), tests.cl('p1'), 'Customer ticket 4412', 30);
insert into tests.cal_out (who, entry_id, member_id, display_name, type, portion, start_date, end_date, tentative, status)
select 'p', c.entry_id, c.member_id, c.display_name, c.type, c.portion, c.start_date, c.end_date, c.tentative, c.status
  from public.impersonated_calendar('2026-09-01', '2026-09-30') c;
select results_eq(
  $$select entry_id, member_id, display_name, type, portion, start_date, end_date, tentative, status
      from tests.cal_out where who = 'p' order by n$$,
  format($$values (%L::uuid, %L::uuid, 'Pam'::text, 'wfh'::text, 'full'::text, '2026-09-15'::date, '2026-09-15'::date, false, 'approved'::text),
                  (%L::uuid, %L::uuid, 'Pat'::text, 'pto'::text, 'am'::text, '2026-09-16'::date, '2026-09-16'::date, false, 'pending'::text)$$,
         tests.cl('e_pam'), tests.cl('pam'), tests.cl('e_pat'), tests.cl('pat')),
  'AC-11: exactly Pam''s and Pat''s entries, Pam''s once though she is also on P2');
select tests.clear_authentication();
select is((select count(*)::int from tests.cal_out o
            where o.who = 'p' and o.entry_id in (tests.cl('e_pru'), tests.cl('e_lea'))), 0,
  'AC-11: Pru''s entry (P2 only) and Lea''s entry (left P1) are absent');
select is(tests.cl_cal_n((select s.id from tests.sess s where s.label = 'p')), 1::bigint,
  'AC-11: exactly one read_calendar action was written for that session');

-- ---------------------------------------------------------------------------------------------
-- AC-13. The org sees the calendar reads in its log. One assertion.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.cl('sys'), 'aal2');
select public.end_impersonation();
insert into tests.sess (label, id)
select 'b', public.start_impersonation(tests.cl('org_a'), null, 'Customer ticket 4413', 30);
select count(*) from public.impersonated_roster();
select count(*) from public.impersonated_calendar('2026-09-01', '2026-09-30');
select count(*) from public.impersonated_calendar('2026-10-01', '2026-10-31');
select tests.authenticate_as(tests.cl('aadm'));
select is((select l.reads from public.list_impersonation_log() l
            where l.id = (select s.id from tests.sess s where s.label = 'b')), 3,
  'AC-13: the new session''s row has reads = 3 (one roster read and two calendar reads)');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-14. The action value is known, and only it was added. Two assertions.
-- ---------------------------------------------------------------------------------------------
select lives_ok(
  format('insert into public.impersonation_action (impersonation_id, action) values (%L::uuid, ''read_calendar'')',
         (select s.id from tests.sess s where s.label = 'b')),
  'AC-14: an action of read_calendar is accepted');
select throws_ok(
  format('insert into public.impersonation_action (impersonation_id, action) values (%L::uuid, ''read_entries'')',
         (select s.id from tests.sess s where s.label = 'b')),
  '23514', null, 'AC-14: an action of read_entries is refused with 23514');

-- ---------------------------------------------------------------------------------------------
-- AC-15. The function is security definer and closed to anon. Two assertions; 010-catalogue.test.sql
-- lists it, and 390 and 400 are not edited.
-- ---------------------------------------------------------------------------------------------
select ok((select p.prosecdef from pg_catalog.pg_proc p
            where p.oid = 'public.impersonated_calendar(date,date)'::regprocedure),
  'AC-15: public.impersonated_calendar(date,date) is security definer');
select ok(not has_function_privilege('anon', 'public.impersonated_calendar(date,date)', 'EXECUTE'),
  'AC-15: anon holds no EXECUTE on impersonated_calendar(date,date)');

select * from finish();
rollback;
