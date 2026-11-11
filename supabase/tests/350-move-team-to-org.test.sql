-- MIR-15-c AC-1 to AC-16 (01-plan.md § 2, § 4.2): a system admin at `aal2` moves one team out of Org
-- public into a dedicated org with `move_team_to_org`, and lists Org public's teams with
-- `list_shared_teams` (ADR-093).
--
-- The cast is this file's own, added on top of `tests.seed()` as the session user, so the seed's
-- teams and members take no part in any move. Labels are fixture names, not schema fields:
--   * Org D — a dedicated org with team D1 and an approved member Dee on it.
--   * In Org public: team T (the team moved) and team U.
--   * Tam    — approved, active only on T, T's manager.
--   * Alice  — approved, active only on T; an ended row on U, and an entry tied to U.
--   * Rex    — removed; his removal closed a row on T.
--   * Bob    — approved, active only on U.
--   * Carol  — approved, active only on U; an ended row on T, and an entry tied to T.
--   * Sam    — a system admin, signed in at aal2.
--
-- Every refusal runs first, against the pristine cast, and is followed by the whole-database
-- fingerprint: a refused call changes nothing. A refusal that needs the cast changed changes it back.
-- The move itself runs once, last, and every assertion about its effects follows it.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(89);
select tests.seed();

create function tests.mv(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('35000000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('org_d', '01'), ('d1', '02'), ('dee', '03'),
      ('t', '11'), ('u', '12'), ('missing', '13'),
      ('tam', '21'), ('alice', '22'), ('rex', '23'), ('bob', '24'), ('carol', '25'),
      ('sam', '31'),
      ('entry_tam', '41'), ('entry_alice', '42'), ('entry_rex', '43'), ('entry_carol', '44'),
      ('entry_x', '45'),
      ('ev_tam', '51'), ('ev_bob', '52'), ('ev_x', '53')
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

-- The state of every org-stamped table, as one string. "Unchanged" is this being equal to itself.
create function tests.fingerprint() returns text
  language sql stable security definer set search_path = '' as $$
  select md5(concat_ws('|',
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.team x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.member x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.membership x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.entry x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.busy_day x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.issue_report x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.event x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.event_invitee x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.event_attendance x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.event_guest_link x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.event_guest x),
    (select coalesce(string_agg(x::text, ',' order by x::text), '') from public.notification x)));
$$;
create table tests.prints (label text primary key, print text not null);
grant select, insert, update on table tests.prints to authenticated;

-- A refused or accepted call, as `sqlstate|detail`. The exception block rolls the call back when it
-- raises, so a refusal leaves nothing behind.
create function tests.try_move(p_team uuid, p_org uuid) returns text
  language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_detail text;
begin
  perform * from public.move_team_to_org(p_team, p_org);
  return 'ok';
exception when others then
  get stacked diagnostics v_detail = pg_exception_detail;
  return sqlstate || '|' || coalesce(v_detail, '');
end;
$$;

-- The summary the one successful move returns.
create table tests.moved (moved_members int not null, deleted_links int not null);
grant select, insert on table tests.moved to authenticated;

-- Definer reads, so a test running as any role can name a row.
create function tests.org_of(p_table text, p_id uuid) returns uuid
  language plpgsql stable security definer set search_path = '' as $$
declare
  v_org uuid;
begin
  execute format('select org_id from public.%I where id = $1', p_table) into v_org using p_id;
  return v_org;
end;
$$;
create function tests.org_of_key(p_table text, p_col text, p_id uuid) returns setof uuid
  language plpgsql stable security definer set search_path = '' as $$
begin
  return query execute format('select org_id from public.%I where %I = $1', p_table, p_col) using p_id;
end;
$$;
-- The teams of the shared tenant, read as the owner.
create function tests.shared_teams_now() returns table (id uuid, name text)
  language sql stable security definer set search_path = '' as $$
  select t.id, t.name
    from public.team t
    join public.org o on o.id = t.org_id
   where o.is_shared_tenant;
$$;
grant execute on all functions in schema tests to anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The cast, as the session user.
-- ---------------------------------------------------------------------------------------------

insert into public.org (id, org_code, name, is_shared_tenant)
values (tests.mv('org_d'), 'mir15c-d', 'Org D', false);
insert into public.team (id, name, org_id) values (tests.mv('d1'), 'D1', tests.mv('org_d'));

insert into public.team (id, name, org_id, overload_threshold, wfh_need_approve, pto_need_approve) values
  (tests.mv('t'), 'MIR15C T', tests.shared_org(), 0.4, false, true),
  (tests.mv('u'), 'MIR15C U', tests.shared_org(), 0.5, true,  true);

insert into auth.users (id, email)
select tests.mv(v.label), v.label || '@mir15c.test'
  from (values ('dee'), ('tam'), ('alice'), ('rex'), ('bob'), ('carol'), ('sam')) as v(label);

insert into public.member (id, org_id, display_name, avatar, role, status, removed_at, email) values
  (tests.mv('dee'),   tests.mv('org_d'),   'Dee',   '1.png', 'member', 'approved', null,  'dee@mir15c.test'),
  (tests.mv('tam'),   tests.shared_org(),  'Tam',   '1.png', 'member', 'approved', null,  'tam@mir15c.test'),
  (tests.mv('alice'), tests.shared_org(),  'Alice', '1.png', 'member', 'approved', null,  'alice@mir15c.test'),
  (tests.mv('rex'),   tests.shared_org(),  'Rex',   '1.png', 'member', 'approved', now(), 'rex@mir15c.test'),
  (tests.mv('bob'),   tests.shared_org(),  'Bob',   '1.png', 'member', 'approved', null,  'bob@mir15c.test'),
  (tests.mv('carol'), tests.shared_org(),  'Carol', '1.png', 'member', 'approved', null,  'carol@mir15c.test');

select public.grant_system_admin(tests.mv('sam'));

-- Ended rows first: Alice's on U, Carol's on T.
insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at, left_at) values
  (tests.shared_org(), tests.mv('u'), tests.mv('alice'), 'member', false,
   now() - interval '30 days', now() - interval '10 days'),
  (tests.shared_org(), tests.mv('t'), tests.mv('carol'), 'member', false,
   now() - interval '30 days', now() - interval '10 days');
select tests.put_on_team(tests.mv('dee'),   tests.mv('d1'));
select tests.put_on_team(tests.mv('tam'),   tests.mv('t'), 'manager');
select tests.put_on_team(tests.mv('alice'), tests.mv('t'));
select tests.put_on_team(tests.mv('rex'),   tests.mv('t'));
select tests.put_on_team(tests.mv('bob'),   tests.mv('u'));
select tests.put_on_team(tests.mv('carol'), tests.mv('u'));

-- Entries. The stamp gives every entry its owner's primary team; two are re-pointed afterwards.
insert into public.entry (id, member_id, type, portion, start_date, end_date) values
  (tests.mv('entry_alice'), tests.mv('alice'), 'pto', 'full', '2099-03-02', '2099-03-03'),
  (tests.mv('entry_carol'), tests.mv('carol'), 'pto', 'full', '2099-03-02', '2099-03-03');
insert into public.entry (id, member_id, type, portion, start_date, end_date, status,
                          approved_by, approved_at, self_approved) values
  (tests.mv('entry_tam'), tests.mv('tam'), 'pto', 'full', '2099-03-02', '2099-03-02',
   'approved', tests.mv('tam'), now(), true);
-- Rex holds no active row, so the stamp has no primary team to give: his entry names T itself.
insert into public.entry (id, member_id, type, portion, start_date, end_date, status,
                          rejection_reason, rejected_by, rejected_at, primary_team_id) values
  (tests.mv('entry_rex'), tests.mv('rex'), 'pto', 'full', '2099-03-02', '2099-03-02',
   'rejected', 'no cover', tests.mv('tam'), now(), tests.mv('t'));
update public.entry set primary_team_id = tests.mv('u') where id = tests.mv('entry_alice');
update public.entry set primary_team_id = tests.mv('t') where id = tests.mv('entry_carol');

insert into public.busy_day (member_id, date) values (tests.mv('tam'), '2099-03-05');
insert into public.issue_report (member_id, kind, message, page)
values (tests.mv('alice'), 'bug', 'MIR-15-c fixture report', '/');

-- Events. Tam's is public; Bob's is on U.
insert into public.event (id, creator_id, name, start_date, end_date, scope) values
  (tests.mv('ev_tam'), tests.mv('tam'), 'MIR15C Tam event', current_date + 10, current_date + 11, 'public'),
  (tests.mv('ev_bob'), tests.mv('bob'), 'MIR15C Bob event', current_date + 10, current_date + 11, 'public');
insert into public.event_invitee (event_id, member_id) values
  (tests.mv('ev_tam'), tests.mv('alice')),
  (tests.mv('ev_tam'), tests.mv('bob')),
  (tests.mv('ev_bob'), tests.mv('alice'));
-- Since MIR-15 a public event in Org public reaches only its own team, so the guard would refuse Bob
-- on Tam's event and Alice on Bob's. Rows like these exist from before it, and are what the move
-- cuts: the guard is switched off for these inserts only.
alter table public.event_attendance disable trigger event_attendance_guard;
insert into public.event_attendance (event_id, member_id, status) values
  (tests.mv('ev_tam'), tests.mv('tam'),   'attending'),
  (tests.mv('ev_tam'), tests.mv('bob'),   'attending'),
  (tests.mv('ev_bob'), tests.mv('alice'), 'attending');
alter table public.event_attendance enable trigger event_attendance_guard;
insert into public.event_guest_link (event_id, token) values (tests.mv('ev_tam'), repeat('3', 64));
insert into public.event_guest (event_id, name, email, manage_token_hash) values
  (tests.mv('ev_tam'), 'Guest 35', 'guest-35@mir15c.test',
   encode(sha256(convert_to(repeat('4', 64), 'UTF8')), 'hex'));

-- Notifications: two cross the new boundary, one does not.
insert into public.notification (recipient_id, kind, event_id, event_name, actor_id) values
  (tests.mv('alice'), 'event_created', tests.mv('ev_bob'), 'MIR15C Bob event', tests.mv('bob')),
  (tests.mv('bob'),   'event_created', null,               'MIR15C actor',     tests.mv('alice')),
  (tests.mv('tam'),   'event_created', tests.mv('ev_tam'), 'MIR15C Tam event', tests.mv('alice'));

-- Holidays: one of Org public's and one of Org D's, for AC-7.
insert into public.holiday (org_id, date, name, kind) values
  (tests.shared_org(), '2031-03-03', 'MIR15C public holiday', 'non_working'),
  (tests.mv('org_d'),  '2031-03-04', 'MIR15C D holiday',      'non_working');

create table tests.entry_before as select * from public.entry
 where member_id in (select tests.mv(l) from (values ('tam'), ('alice'), ('rex'), ('bob'), ('carol')) as v(l));
create table tests.team_before as select * from public.team where id = tests.mv('t');
create table tests.membership_before as
  select m.id, m.team_role, m.is_primary from public.membership m where m.member_id = tests.mv('tam');
create table tests.notif_before as select count(*)::int as n from public.notification;

insert into tests.prints (label, print) values ('pristine', tests.fingerprint());

-- ---------------------------------------------------------------------------------------------
-- The constraints. 4.1 item 1: nineteen, deferrable, and none of them deferred by default.
-- ---------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_catalog.pg_constraint c
    where c.contype = 'f' and c.condeferrable and not c.condeferred
      and c.conname in (
        'membership_team_org_fk', 'membership_member_org_fk', 'entry_member_org_fk',
        'entry_primary_team_org_fk', 'entry_approved_by_org_fk', 'entry_rejected_by_org_fk',
        'busy_day_member_org_fk', 'issue_report_member_org_fk', 'event_creator_org_fk',
        'event_team_org_fk', 'event_invitee_event_org_fk', 'event_invitee_member_org_fk',
        'event_attendance_event_org_fk', 'event_attendance_member_org_fk',
        'event_guest_link_event_org_fk', 'event_guest_event_org_fk', 'notification_recipient_org_fk',
        'notification_actor_org_fk', 'notification_event_org_fk')),
  19,
  'constraints: all nineteen keys are deferrable initially immediate'
);

-- ---------------------------------------------------------------------------------------------
-- AC-15. Only a system admin, only at aal2.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.mv('tam'));
select throws_ok(format('select * from public.list_shared_teams()'), '42501', null,
  'AC-15: Tam is refused list_shared_teams with 42501');
select is(tests.try_move(tests.mv('t'), tests.mv('org_d')) like '42501|%', true,
  'AC-15: Tam is refused move_team_to_org with 42501');
select tests.authenticate_at(tests.id('admin_t'), 'aal2');
select throws_ok('select * from public.list_shared_teams()', '42501', null,
  'AC-15: an org admin of Org public is refused list_shared_teams with 42501');
select is(tests.try_move(tests.mv('t'), tests.mv('org_d')) like '42501|%', true,
  'AC-15: an org admin of Org public is refused move_team_to_org with 42501');
select tests.authenticate_at(tests.mv('sam'), 'aal1');
select throws_ok('select * from public.list_shared_teams()', '42501', null,
  'AC-15: Sam at aal1 is refused list_shared_teams with 42501');
select is(tests.try_move(tests.mv('t'), tests.mv('org_d')) like '42501|%', true,
  'AC-15: Sam at aal1 is refused move_team_to_org with 42501');
select tests.clear_authentication();
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'pristine'),
  'AC-15: the three refused calls changed nothing');
select ok(not has_function_privilege('anon', 'public.list_shared_teams()', 'EXECUTE'),
  'AC-15: anon holds no EXECUTE on list_shared_teams()');
select ok(not has_function_privilege('anon', 'public.move_team_to_org(uuid,uuid)', 'EXECUTE'),
  'AC-15: anon holds no EXECUTE on move_team_to_org(uuid,uuid)');
select ok(has_function_privilege('authenticated', 'public.list_shared_teams()', 'EXECUTE'),
  'AC-15: authenticated holds EXECUTE on list_shared_teams()');
select ok(has_function_privilege('authenticated', 'public.move_team_to_org(uuid,uuid)', 'EXECUTE'),
  'AC-15: authenticated holds EXECUTE on move_team_to_org(uuid,uuid)');
select ok((select p.prosecdef from pg_catalog.pg_proc p
            where p.oid = 'public.list_shared_teams()'::regprocedure),
  'AC-15: list_shared_teams() is security definer');
select ok((select p.prosecdef from pg_catalog.pg_proc p
            where p.oid = 'public.move_team_to_org(uuid,uuid)'::regprocedure),
  'AC-15: move_team_to_org(uuid,uuid) is security definer');

-- ---------------------------------------------------------------------------------------------
-- AC-16. The list names Org public's teams and nothing else.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.mv('sam'), 'aal2');
select results_eq(
  format('select id, name, active_members from public.list_shared_teams() where id in (%L, %L) order by name, id',
         tests.mv('t'), tests.mv('u')),
  format($$values (%L::uuid, 'MIR15C T'::text, 2), (%L::uuid, 'MIR15C U'::text, 2)$$,
         tests.mv('t'), tests.mv('u')),
  'AC-16: T and U are listed by name, T with its two active members (Rex is removed)');
select is((select count(*)::int from public.list_shared_teams() l where l.id = tests.mv('d1')), 0,
  'AC-16: no team of Org D is listed');
select is(
  (select array_agg(l.name order by l.name, l.id) from public.list_shared_teams() l),
  (select array_agg(t.name order by t.name, t.id) from tests.shared_teams_now() t),
  'AC-16: the list is exactly the teams of the shared tenant, ordered by name');

-- ---------------------------------------------------------------------------------------------
-- AC-13. Only from Org public, only into a dedicated org.
-- ---------------------------------------------------------------------------------------------
select is(tests.try_move(tests.mv('d1'), tests.shared_org()) like '22023|%', true,
  'AC-13: moving D1 to Org public is refused with 22023');
select is(tests.try_move(tests.mv('t'), tests.shared_org()) like '22023|%', true,
  'AC-13: moving T to Org public is refused with 22023');
select is(tests.try_move(tests.mv('d1'), tests.mv('org_d')) like '22023|%', true,
  'AC-13: moving D1 to Org D is refused with 22023');
select is(tests.try_move(tests.mv('missing'), tests.mv('org_d')) like 'P0002|%', true,
  'AC-13: moving an unknown team is refused with P0002');
select is(tests.try_move(tests.mv('t'), tests.mv('missing')) like 'P0002|%', true,
  'AC-13: moving T to an unknown org is refused with P0002');
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'pristine'),
  'AC-13: the five refused calls changed nothing');

-- ---------------------------------------------------------------------------------------------
-- AC-9. A mover who is on another team refuses the move (MT001).
-- ---------------------------------------------------------------------------------------------
select tests.clear_authentication();
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.shared_org(), tests.mv('t'), tests.mv('bob'), 'member', false);
-- Bob is now on T as well as U, so Bob is a mover and an active member of another team.
insert into tests.prints (label, print) values ('mt001', tests.fingerprint());
select tests.authenticate_at(tests.mv('sam'), 'aal2');
select is(tests.try_move(tests.mv('t'), tests.mv('org_d')) like 'MT001|%Bob%', true,
  'AC-9: a member of T who is also on U refuses the move with MT001, naming Bob');
select tests.clear_authentication();
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'mt001'),
  'AC-9: the refused call changed nothing');
delete from public.membership where team_id = tests.mv('t') and member_id = tests.mv('bob');
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'pristine'),
  'AC-9: the cast is as it was');

-- ---------------------------------------------------------------------------------------------
-- AC-10. An event that would be split from its creator refuses the move (MT002).
-- ---------------------------------------------------------------------------------------------
insert into public.event (id, creator_id, name, start_date, end_date, scope)
values (tests.mv('ev_x'), tests.mv('bob'), 'MIR15C split event', current_date + 20, current_date + 21, 'team');
update public.event set team_id = tests.mv('t') where id = tests.mv('ev_x');
insert into tests.prints (label, print) values ('mt002a', tests.fingerprint());
select tests.authenticate_at(tests.mv('sam'), 'aal2');
select is(tests.try_move(tests.mv('t'), tests.mv('org_d')) like 'MT002|%MIR15C split event%', true,
  'AC-10: an event of T created by Bob refuses the move with MT002, naming the event');
select tests.clear_authentication();
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'mt002a'),
  'AC-10: the refused call changed nothing');
delete from public.event where id = tests.mv('ev_x');

insert into public.event (id, creator_id, name, start_date, end_date, scope)
values (tests.mv('ev_x'), tests.mv('alice'), 'MIR15C split event', current_date + 20, current_date + 21, 'team');
update public.event set team_id = tests.mv('u') where id = tests.mv('ev_x');
insert into tests.prints (label, print) values ('mt002b', tests.fingerprint());
select tests.authenticate_at(tests.mv('sam'), 'aal2');
select is(tests.try_move(tests.mv('t'), tests.mv('org_d')) like 'MT002|%MIR15C split event%', true,
  'AC-10: an event of U created by Alice refuses the move with MT002, naming the event');
select tests.clear_authentication();
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'mt002b'),
  'AC-10: the second refused call changed nothing');
delete from public.event where id = tests.mv('ev_x');
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'pristine'),
  'AC-10: the cast is as it was');

-- ---------------------------------------------------------------------------------------------
-- AC-11. A decision that would be split refuses the move (MT003).
-- ---------------------------------------------------------------------------------------------
insert into public.entry (id, member_id, type, portion, start_date, end_date, status, approved_by, approved_at)
values (tests.mv('entry_x'), tests.mv('alice'), 'pto', 'full', '2099-04-01', '2099-04-01',
        'approved', tests.mv('bob'), now());
insert into tests.prints (label, print) values ('mt003a', tests.fingerprint());
select tests.authenticate_at(tests.mv('sam'), 'aal2');
select is(tests.try_move(tests.mv('t'), tests.mv('org_d')) like 'MT003|%Alice%', true,
  'AC-11: an entry of Alice approved by Bob refuses the move with MT003, naming Alice');
select tests.clear_authentication();
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'mt003a'),
  'AC-11: the refused call changed nothing');
delete from public.entry where id = tests.mv('entry_x');

insert into public.entry (id, member_id, type, portion, start_date, end_date, status, approved_by, approved_at)
values (tests.mv('entry_x'), tests.mv('carol'), 'pto', 'full', '2099-04-01', '2099-04-01',
        'approved', tests.mv('tam'), now());
insert into tests.prints (label, print) values ('mt003b', tests.fingerprint());
select tests.authenticate_at(tests.mv('sam'), 'aal2');
select is(tests.try_move(tests.mv('t'), tests.mv('org_d')) like 'MT003|%Carol%', true,
  'AC-11: an entry of Carol approved by Tam refuses the move with MT003, naming Carol');
select tests.clear_authentication();
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'mt003b'),
  'AC-11: the second refused call changed nothing');
delete from public.entry where id = tests.mv('entry_x');
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'pristine'),
  'AC-11: the cast is as it was');

-- ---------------------------------------------------------------------------------------------
-- AC-12. A stayer with nowhere to keep an entry refuses the move (MT004).
-- ---------------------------------------------------------------------------------------------
-- Carol holds an active row on U and an entry tied to T. With no primary row, she has no home team.
update public.membership set is_primary = false
 where member_id = tests.mv('carol') and team_id = tests.mv('u') and left_at is null;
insert into tests.prints (label, print) values ('mt004', tests.fingerprint());
select tests.authenticate_at(tests.mv('sam'), 'aal2');
select is(tests.try_move(tests.mv('t'), tests.mv('org_d')) like 'MT004|%Carol%', true,
  'AC-12: a stayer with an entry tied to T and no primary team refuses the move with MT004');
select tests.clear_authentication();
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'mt004'),
  'AC-12: the refused call changed nothing');
update public.membership set is_primary = true
 where member_id = tests.mv('carol') and team_id = tests.mv('u') and left_at is null;
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'pristine'),
  'AC-12: the cast is as it was');

-- ---------------------------------------------------------------------------------------------
-- The guard clause did not widen what a member may do (4.2).
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.mv('tam'));
select throws_ok(
  format($$update public.event_attendance set status = 'pending' where event_id = %L and member_id = %L$$,
         tests.mv('ev_tam'), tests.mv('tam')),
  '22023', 'invalid_attendance_change',
  'guard: a status change that is not an allowed transition still meets invalid_attendance_change');
select tests.clear_authentication();
select is(tests.fingerprint(), (select p.print from tests.prints p where p.label = 'pristine'),
  'guard: the refused update changed nothing');

-- ---------------------------------------------------------------------------------------------
-- The move. Org D's caps are 1 and 1, which would refuse nothing (AC-14).
-- ---------------------------------------------------------------------------------------------
update public.org set max_members = 1, max_teams = 1 where id = tests.mv('org_d');
select tests.authenticate_at(tests.mv('sam'), 'aal2');
select lives_ok(
  format('insert into tests.moved select * from public.move_team_to_org(%L, %L)',
         tests.mv('t'), tests.mv('org_d')),
  'AC-14: Sam moves T to Org D although Org D is over both its caps');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-1. The team and its people move.
-- ---------------------------------------------------------------------------------------------
select is(tests.org_of('team', tests.mv('t')), tests.mv('org_d'), 'AC-1: team T carries Org D''s id');
select is(tests.org_of('member', tests.mv('tam')), tests.mv('org_d'), 'AC-1: Tam carries Org D''s id');
select is(tests.org_of('member', tests.mv('alice')), tests.mv('org_d'), 'AC-1: Alice carries Org D''s id');
select is(tests.org_of('member', tests.mv('rex')), tests.mv('org_d'), 'AC-1: Rex carries Org D''s id');
select is(
  (select count(*)::int from public.membership m
    where m.member_id in (tests.mv('tam'), tests.mv('alice'), tests.mv('rex'))
      and m.org_id = tests.mv('org_d')),
  3, 'AC-1: the three movers'' membership rows carry Org D''s id');
select is(
  (select count(*)::int from public.membership m
    where m.member_id in (tests.mv('tam'), tests.mv('alice'), tests.mv('rex'))
      and m.org_id <> tests.mv('org_d')),
  0, 'AC-1: none of the movers'' membership rows is left in Org public');
select is(
  (select count(*)::int from public.entry e
    where e.member_id in (tests.mv('tam'), tests.mv('alice'), tests.mv('rex'))
      and e.org_id <> tests.mv('org_d')),
  0, 'AC-1: every entry of the movers carries Org D''s id');
select is(
  (select count(*)::int from public.busy_day b where b.member_id = tests.mv('tam') and b.org_id = tests.mv('org_d')),
  1, 'AC-1: Tam''s busy day carries Org D''s id');
select is(
  (select count(*)::int from public.issue_report r where r.member_id = tests.mv('alice') and r.org_id = tests.mv('org_d')),
  1, 'AC-1: Alice''s issue report carries Org D''s id');
select is((select m.moved_members from tests.moved m), 3, 'AC-1: the call returns moved_members = 3');
select is(tests.org_of('member', tests.mv('bob')), tests.shared_org(), 'AC-1: Bob stays in Org public');
select is(tests.org_of('member', tests.mv('carol')), tests.shared_org(), 'AC-1: Carol stays in Org public');
select is(tests.org_of('team', tests.mv('u')), tests.shared_org(), 'AC-1: team U stays in Org public');
select is(
  (select count(*)::int from public.membership m
    where m.member_id in (tests.mv('bob'), tests.mv('carol')) and m.org_id <> tests.shared_org()),
  0, 'AC-1: Bob''s and Carol''s membership rows stay in Org public');
select is(
  (select count(*)::int from public.entry e
    where e.member_id in (tests.mv('bob'), tests.mv('carol')) and e.org_id <> tests.shared_org()),
  0, 'AC-1: Bob''s and Carol''s entries stay in Org public');
select is(
  (select count(*)::int from public.notification n where n.recipient_id = tests.mv('tam') and n.org_id = tests.mv('org_d')),
  1, 'AC-1: the notification Tam receives carries Org D''s id');

-- ---------------------------------------------------------------------------------------------
-- AC-2. The team's events move with everything hanging off them.
-- ---------------------------------------------------------------------------------------------
select is(tests.org_of('event', tests.mv('ev_tam')), tests.mv('org_d'), 'AC-2: Tam''s event carries Org D''s id');
select is(
  (select count(*)::int from public.event_invitee i where i.event_id = tests.mv('ev_tam') and i.org_id = tests.mv('org_d')),
  1, 'AC-2: Alice''s invitation carries Org D''s id (Bob''s was cut)');
select is(
  (select count(*)::int from public.event_attendance a where a.event_id = tests.mv('ev_tam') and a.org_id = tests.mv('org_d')),
  1, 'AC-2: Tam''s attendance carries Org D''s id (Bob''s was cut)');
select is(
  (select count(*)::int from public.event_guest_link l where l.event_id = tests.mv('ev_tam') and l.org_id = tests.mv('org_d')),
  1, 'AC-2: the guest link carries Org D''s id');
select is(
  (select count(*)::int from public.event_guest g where g.event_id = tests.mv('ev_tam') and g.org_id = tests.mv('org_d')),
  1, 'AC-2: the guest registration carries Org D''s id');
select results_eq(
  format('select scope::text, start_date, end_date, name from public.event where id = %L', tests.mv('ev_tam')),
  format($$values ('public'::text, %L::date, %L::date, 'MIR15C Tam event'::text)$$,
         current_date + 10, current_date + 11),
  'AC-2: the event''s scope, dates and name are unchanged');
select is(tests.org_of('event', tests.mv('ev_bob')), tests.shared_org(), 'AC-2: Bob''s event stays in Org public');

-- ---------------------------------------------------------------------------------------------
-- AC-3. Nothing about a moved entry changes but its org and its team.
-- ---------------------------------------------------------------------------------------------
select is(
  (select count(*)::int
     from tests.entry_before b
     join public.entry a on a.id = b.id
    where b.member_id in (tests.mv('tam'), tests.mv('alice'), tests.mv('rex'))
      and (to_jsonb(a) - 'org_id' - 'primary_team_id' - 'updated_at')
          = (to_jsonb(b) - 'org_id' - 'primary_team_id' - 'updated_at')),
  3, 'AC-3: status, deciders, reason, dates, type, portion and note of the three movers'' entries are unchanged');
select results_eq(
  format('select status::text, approved_by, self_approved from public.entry where id = %L', tests.mv('entry_tam')),
  format($$values ('approved'::text, %L::uuid, true)$$, tests.mv('tam')),
  'AC-3: the entry Tam decided is still approved, by Tam');
select results_eq(
  format('select status::text, rejected_by, rejection_reason from public.entry where id = %L', tests.mv('entry_rex')),
  format($$values ('rejected'::text, %L::uuid, 'no cover'::text)$$, tests.mv('tam')),
  'AC-3: Rex''s rejected entry is still rejected, with its decider and reason');
select is((select e.status::text from public.entry e where e.id = tests.mv('entry_alice')), 'pending',
  'AC-3: Alice''s entry is still pending');
select is((select e.primary_team_id from public.entry e where e.id = tests.mv('entry_alice')), tests.mv('t'),
  'AC-3: Alice''s entry that was tied to U is now tied to T');

-- ---------------------------------------------------------------------------------------------
-- AC-4. A person who stays keeps their entries on a team that stays.
-- ---------------------------------------------------------------------------------------------
select is((select e.primary_team_id from public.entry e where e.id = tests.mv('entry_carol')), tests.mv('u'),
  'AC-4: Carol''s entry that was tied to T is now tied to U');
select is(
  (select count(*)::int from public.membership m where m.member_id = tests.mv('carol') and m.team_id = tests.mv('t')),
  0, 'AC-4: Carol''s ended membership row on T no longer exists');
select is(
  (select count(*)::int from public.membership m where m.member_id = tests.mv('alice') and m.team_id = tests.mv('u')),
  0, 'AC-4: Alice''s ended membership row on U no longer exists');
select is(
  (select count(*)::int from public.membership m where m.member_id = tests.mv('rex') and m.team_id = tests.mv('t')),
  1, 'AC-4: Rex''s closed row on T stays');

-- ---------------------------------------------------------------------------------------------
-- AC-5. Links across the new boundary are cut, and counted.
-- ---------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from public.event_attendance a where a.member_id = tests.mv('bob') and a.event_id = tests.mv('ev_tam')),
  0, 'AC-5: Bob''s attendance of Tam''s event is gone');
select is(
  (select count(*)::int from public.event_invitee i where i.member_id = tests.mv('bob') and i.event_id = tests.mv('ev_tam')),
  0, 'AC-5: Bob''s invitation to Tam''s event is gone');
select is(
  (select count(*)::int from public.event_attendance a where a.member_id = tests.mv('alice') and a.event_id = tests.mv('ev_bob')),
  0, 'AC-5: Alice''s attendance of Bob''s event is gone');
select is(
  (select count(*)::int from public.event_invitee i where i.member_id = tests.mv('alice') and i.event_id = tests.mv('ev_bob')),
  0, 'AC-5: Alice''s invitation to Bob''s event is gone');
select is(
  (select count(*)::int from public.notification n where n.recipient_id = tests.mv('alice') and n.event_id = tests.mv('ev_bob')),
  0, 'AC-5: the notification Alice held for Bob''s event is gone');
select is(
  (select count(*)::int from public.notification n where n.recipient_id = tests.mv('bob') and n.actor_id = tests.mv('alice')),
  0, 'AC-5: the notification Bob held with Alice as its actor is gone');
select is((select m.deleted_links from tests.moved m), 8,
  'AC-5: deleted_links counts the six links and the two membership rows');

-- ---------------------------------------------------------------------------------------------
-- AC-6. The move writes no notification and no email.
-- ---------------------------------------------------------------------------------------------
select is((select count(*)::int from public.notification),
          (select b.n - 2 from tests.notif_before b),
  'AC-6: the notifications left are those before the move less the two cut; none was inserted');

-- ---------------------------------------------------------------------------------------------
-- AC-8. The manager still manages, the team keeps its settings.
-- ---------------------------------------------------------------------------------------------
select results_eq(
  format('select team_role::text, is_primary from public.membership where member_id = %L and left_at is null',
         tests.mv('tam')),
  $$select b.team_role::text, b.is_primary from tests.membership_before b$$,
  'AC-8: Tam''s membership is still the manager''s and still primary');
select results_eq(
  format('select overload_threshold, wfh_need_approve, pto_need_approve from public.team where id = %L',
         tests.mv('t')),
  $$select b.overload_threshold, b.wfh_need_approve, b.pto_need_approve from tests.team_before b$$,
  'AC-8: T''s overload threshold and approval settings are unchanged');

-- ---------------------------------------------------------------------------------------------
-- AC-7. After the move Org public sees nothing of T, and T sees its new org.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.mv('bob'));
select is((select count(*)::int from public.event e where e.id = tests.mv('ev_tam')), 0,
  'AC-7: Bob reads no event of Tam''s');
select is(
  (select count(*)::int from public.list_member_directory() d
    where d.id in (tests.mv('tam'), tests.mv('alice'), tests.mv('rex'))),
  0, 'AC-7: Bob reads neither Tam, Alice nor Rex in the directory');
select tests.authenticate_as(tests.mv('dee'));
select is((select count(*)::int from public.event e where e.id = tests.mv('ev_tam')), 1,
  'AC-7: Dee reads Tam''s public event');
select tests.authenticate_as(tests.mv('tam'));
select results_eq(
  $$select h.name from public.holiday h where h.name in ('MIR15C public holiday', 'MIR15C D holiday') order by h.name$$,
  $$values ('MIR15C D holiday'::text)$$,
  'AC-7: Tam reads Org D''s holiday and not Org public''s');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-16, second half. After the move the list holds U only.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.mv('sam'), 'aal2');
select results_eq(
  format('select id from public.list_shared_teams() where id in (%L, %L)', tests.mv('t'), tests.mv('u')),
  format('values (%L::uuid)', tests.mv('u')),
  'AC-16: after the move the list holds U and not T');
select tests.clear_authentication();

select * from finish();
rollback;
