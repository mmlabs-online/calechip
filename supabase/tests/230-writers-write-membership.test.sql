-- MIR-21-b AC-1 to AC-14: every writer writes `membership` itself, and the mirror no longer writes
-- on a change of team or rank (ADR-078).
--
-- O1 holds T1, T2 and T4; O2 holds T3. A is admin on T1; M, R, W and V are members on T1; K is admin
-- on T3. The fixture writes their primary row itself (MIR-21-e). V also holds an active non-primary
-- row on T2, inserted directly. P1, P2 and P3 are pending in O1 with no team and no `membership`
-- row; P3 exists only for AC-12's grant (01-plan.md § 2).
--
-- Steps run in the order that keeps each AC's "Given" true: AC-12's first half and AC-7's refusals
-- before AC-1, AC-7's W refusal after AC-8, AC-11 and AC-12's grant last. AC-9 runs after each step.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(84);
select tests.seed();

create function tests.m21b(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('c2300000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('o1', 'a1'), ('o2', 'a2'), ('t1', 'b1'), ('t2', 'b2'), ('t3', 'b3'), ('t4', 'b4'),
      ('a', 'c1'), ('m', 'c2'), ('r', 'c3'), ('w', 'c4'), ('v', 'c5'),
      ('p1', 'c6'), ('p2', 'c7'), ('p3', 'c8'), ('k', 'c9')
    ) as v(label, nn)
   where v.label = p_label;
$$;

-- A digest of `membership`, for "unchanged, compared before and after". Owner only: no user token
-- reads the table.
create function tests.m21b_ms(p_member uuid default null) returns text
  language sql stable security invoker set search_path = '' as $$
  select coalesce(md5(string_agg(ms::text, '|' order by ms.id)), 'none')
    from public.membership ms
   where p_member is null or ms.member_id = p_member;
$$;

-- AC-9 over every row of public.member: the mirror invariant fails (at most one active primary
-- row; exactly one when on a roster team and not removed).
create function tests.m21b_drift() returns bigint
  language sql stable security invoker set search_path = '' as $$
  select count(*) from public.member m
    cross join lateral (select count(*) as n from public.membership ms
                         where ms.member_id = m.id and ms.left_at is null and ms.is_primary) p
   where p.n > 1
      or (public.member_roster_team_id(m.id) is not null and m.removed_at is null and p.n <> 1);
$$;

-- AC-7: one refused call, as p_caller. Two assertions: it raises 42501 (with p_message when given),
-- and every `membership` row is as it was. No `set search_path`: pgTAP resolves its own helpers
-- through the caller's path.
create function tests.m21b_refused(p_caller uuid, p_sql text, p_message text, p_label text)
  returns setof text
  language plpgsql security invoker as $$
declare
  v_before text := tests.m21b_ms();
begin
  perform tests.authenticate_as(p_caller);
  return next throws_ok(p_sql, '42501', p_message, p_label || ' raises 42501');
  perform tests.clear_authentication();
  return next is(tests.m21b_ms(), v_before, p_label || ' leaves every membership row unchanged');
end;
$$;

insert into public.org (id, org_code, name) values
  (tests.m21b('o1'), 'org-o1-mir21b-230', 'Org O1'),
  (tests.m21b('o2'), 'org-o2-mir21b-230', 'Org O2');
insert into public.team (id, name, org_id) values
  (tests.m21b('t1'), 'Team T1', tests.m21b('o1')),
  (tests.m21b('t2'), 'Team T2', tests.m21b('o1')),
  (tests.m21b('t4'), 'Team T4', tests.m21b('o1')),
  (tests.m21b('t3'), 'Team T3', tests.m21b('o2'));
insert into auth.users (id, email)
select tests.m21b(l), l || '@mir21b-230.test'
  from unnest(array['a', 'm', 'r', 'w', 'v', 'p1', 'p2', 'p3', 'k']) l;
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m21b('a'), tests.m21b('o1'), 'A', '1.png', tests.member_role('admin'), 'approved', 'a@mir21b-230.test'),
  (tests.m21b('k'), tests.m21b('o2'), 'K', '1.png', tests.member_role('admin'), 'approved', 'k@mir21b-230.test');
insert into public.member (id, org_id, display_name, avatar, role, status, email)
select tests.m21b(l), tests.m21b('o1'), upper(l), '1.png', 'member', 'approved', l || '@mir21b-230.test'
  from unnest(array['m', 'r', 'w', 'v']) l;
insert into public.member (id, org_id, display_name, avatar, role, status, email)
select tests.m21b(l), tests.m21b('o1'), upper(l), '1.png', 'member', 'pending', l || '@mir21b-230.test'
  from unnest(array['p1', 'p2', 'p3']) l;

-- MIR-21-e (ADR-080 decision 3): the mirror's INSERT branch no longer runs, because the member
-- inserts above do not name team_id. Write each one's primary membership row directly.
select tests.put_on_team(tests.m21b('a'), tests.m21b('t1'));
select tests.put_on_team(tests.m21b('k'), tests.m21b('t3'));
select tests.put_on_team(tests.m21b('m'), tests.m21b('t1'));
select tests.put_on_team(tests.m21b('r'), tests.m21b('t1'));
select tests.put_on_team(tests.m21b('w'), tests.m21b('t1'));
select tests.put_on_team(tests.m21b('v'), tests.m21b('t1'));

insert into public.membership (org_id, team_id, member_id, team_role, is_primary) values
  (tests.m21b('o1'), tests.m21b('t2'), tests.m21b('v'), 'member', false);

-- ---------------------------------------------------------------------------------------------
-- AC-10. The mirror no longer writes on a change of team or rank.
-- ---------------------------------------------------------------------------------------------
select matches(
  (select pg_catalog.pg_get_triggerdef(t.oid) from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.member'::regclass and t.tgname = 'member_sync_membership'),
  'AFTER UPDATE OF removed_at ON public\.member ',
  'AC-10: member_sync_membership fires AFTER UPDATE OF removed_at (MIR-21-f dropped the INSERT event)');
select doesnt_match(
  (select pg_catalog.pg_get_triggerdef(t.oid) from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.member'::regclass and t.tgname = 'member_sync_membership'),
  '\m(team_id|role)\M',
  'AC-10: the trigger names neither team_id nor role');
select doesnt_match(
  (select p.prosrc from pg_catalog.pg_proc p
    where p.oid = 'public.member_sync_membership()'::regprocedure),
  'old\.(team_id|role)',
  'AC-10: the mirror function has no branch on a change of team or rank');

-- ---------------------------------------------------------------------------------------------
-- AC-13. No write-side predicate reads the column.
-- ---------------------------------------------------------------------------------------------
create function tests.m21b_writers() returns setof pg_catalog.pg_proc
  language sql stable security invoker set search_path = '' as $$
  select p.* from pg_catalog.pg_proc p
   where p.pronamespace = 'public'::regnamespace
     and p.proname in ('admit_member', 'reject_member', 'move_member', 'set_member_team',
                       'set_member_role', 'promote_member_to_admin', 'delete_team',
                       'grant_system_admin');
$$;
select is((select count(*)::int from tests.m21b_writers()), 8,
  'AC-13: the eight writer functions exist, one definition each');
select is(
  (select count(*)::int from tests.m21b_writers() p
    where p.prosrc ~* '\mm\.team_id\M|\mteam_id\s+(is|in)\M'),
  0,
  'AC-13: no writer body contains m.team_id, team_id is, or team_id in');
select is(
  (select coalesce(sum(
            (select count(*) from regexp_matches(p.prosrc, '\mteam_id\s*=', 'gi'))
          - (select count(*) from regexp_matches(p.prosrc, '(\mset\s+|,\s*)team_id\s*=', 'gi'))), 0)::int
     from tests.m21b_writers() p),
  0,
  'AC-13: every team_id = in a writer body is an assignment in a set list (p_team_id aside)');
select is(
  (select count(*)::int from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename = 'member' and p.policyname = 'member_update_admin'),
  1,
  'AC-13: member_update_admin exists');
select is(
  (select count(*)::int from pg_catalog.pg_policies p
    where p.schemaname = 'public' and p.tablename = 'member' and p.policyname = 'member_update_admin'
      and (coalesce(p.qual, '') || ' ' || coalesce(p.with_check, ''))
          ~* '\mm\.team_id\M|\mteam_id\s*(=|is\M|in\M)'),
  0,
  'AC-13: member_update_admin''s qual and with_check do not read the column');

-- ---------------------------------------------------------------------------------------------
-- AC-14, first half. The helper is closed to clients. The second half (create-account.sql calls
-- it) is a source-text check, recorded in 03-impl-log.md.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_anon();
select throws_ok(
  format('select public.membership_make_primary(%L::uuid, %L::uuid)', tests.m21b('p1'), tests.m21b('t1')),
  '42501', null,
  'AC-14: anon is refused membership_make_primary(uuid, uuid)');
select tests.authenticate_as(tests.m21b('a'));
select throws_ok(
  format('select public.membership_make_primary(%L::uuid, %L::uuid)', tests.m21b('p1'), tests.m21b('t1')),
  '42501', null,
  'AC-14: authenticated is refused membership_make_primary(uuid, uuid)');
select tests.clear_authentication();

select is(tests.m21b_drift(), 0::bigint, 'AC-9: no drift and no mirror violation after the fixtures');

-- ---------------------------------------------------------------------------------------------
-- AC-12, first half (M still on T1). set_member_team and the removal policy are unchanged.
-- ---------------------------------------------------------------------------------------------
select tests.m21b_ms(tests.m21b('m')) as m_before \gset
select tests.authenticate_as(tests.m21b('a'));
select is(public.roster_team_id(s), tests.m21b('t1'), 'AC-12: set_member_team(M, T1) returns M on T1')
  from public.set_member_team(tests.m21b('m'), tests.m21b('t1')) s;
select throws_ok(
  format('select public.set_member_team(%L::uuid, %L::uuid)', tests.m21b('m'), tests.m21b('t2')),
  '42501', null,
  'AC-12: set_member_team(M, T2) raises 42501');
select is(tests.rows_affected(format('update public.member set removed_at = now() where id = %L',
                                     tests.m21b('k'))),
          0::bigint, 'AC-12: A removing K through a table update changes zero rows');
select tests.clear_authentication();
select is(tests.m21b_ms(tests.m21b('m')), :'m_before', 'AC-12: M''s membership rows are unchanged');
select is(tests.m21b_drift(), 0::bigint, 'AC-9: no drift and no mirror violation after set_member_team');

-- ---------------------------------------------------------------------------------------------
-- AC-7. The refusals are unchanged, and a refused call writes nothing.
-- ---------------------------------------------------------------------------------------------
select * from tests.m21b_refused(tests.m21b('k'),
  format('select public.admit_member(%L::uuid, %L::uuid)', tests.m21b('p1'), tests.m21b('t1')), null,
  'AC-7: K admit_member(P1, T1)');
select * from tests.m21b_refused(tests.m21b('k'),
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21b('m'), tests.m21b('t3')), null,
  'AC-7: K move_member(M, T3)');
select * from tests.m21b_refused(tests.m21b('k'),
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21b('m'), tests.m21b('t1')), null,
  'AC-7: K move_member(M, T1)');
select * from tests.m21b_refused(tests.m21b('k'),
  format('select public.set_member_role(%L::uuid, %L)', tests.m21b('m'), 'manager'), null,
  'AC-7: K set_member_role(M, manager)');
select * from tests.m21b_refused(tests.m21b('m'),
  format('select public.admit_member(%L::uuid, %L::uuid)', tests.m21b('p1'), tests.m21b('t1')), null,
  'AC-7: M admit_member(P1, T1)');
select * from tests.m21b_refused(tests.m21b('m'),
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21b('r'), tests.m21b('t2')), null,
  'AC-7: M move_member(R, T2)');
select * from tests.m21b_refused(tests.m21b('m'),
  format('select public.set_member_role(%L::uuid, %L)', tests.m21b('r'), 'manager'), null,
  'AC-7: M set_member_role(R, manager)');
select * from tests.m21b_refused(tests.m21b('a'),
  format('select public.admit_member(%L::uuid, %L::uuid)', tests.m21b('m'), tests.m21b('t1')), null,
  'AC-7: A admit_member on approved M');
select * from tests.m21b_refused(tests.m21b('a'),
  format('select public.reject_member(%L::uuid)', tests.m21b('m')), null,
  'AC-7: A reject_member on approved M');
select * from tests.m21b_refused(tests.m21b('a'),
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21b('p1'), tests.m21b('t2')), null,
  'AC-7: A move_member on pending P1');
select * from tests.m21b_refused(tests.m21b('a'),
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21b('a'), tests.m21b('t2')),
  'a person may not change their own role, status or team',
  'AC-7: A move_member(A, T2) on A''s own id');
select is(tests.m21b_drift(), 0::bigint, 'AC-9: no drift and no mirror violation after the refusals');

-- ---------------------------------------------------------------------------------------------
-- AC-1. Admitting a sign-up writes one primary membership row.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21b('a'));
select lives_ok(
  format('select public.admit_member(%L::uuid, %L::uuid)', tests.m21b('p1'), tests.m21b('t1')),
  'AC-1: A admit_member(P1, T1) succeeds');
select tests.clear_authentication();
select results_eq(
  $$select status::text, public.member_roster_team_id(id) from public.member where id = tests.m21b('p1')$$,
  $$values ('approved', tests.m21b('t1'))$$,
  'AC-1: P1 is approved, on T1');
select results_eq(
  $$select team_id, org_id, is_primary, team_role::text, left_at, joined_at = now()
      from public.membership where member_id = tests.m21b('p1') and left_at is null$$,
  $$values (tests.m21b('t1'), tests.m21b('o1'), true, 'member', null::timestamptz, true)$$,
  'AC-1: P1 has exactly one active row: T1, O1, primary, member, open, joined now()');
select is(public.member_roster_team_id(tests.m21b('p1')), tests.m21b('t1'), 'AC-1: P1''s roster team is T1');
select is(tests.m21b_drift(), 0::bigint, 'AC-9: no drift and no mirror violation after AC-1');

-- ---------------------------------------------------------------------------------------------
-- AC-2. Moving a member closes the old row and opens one on the new team.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21b('a'));
select lives_ok(
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21b('m'), tests.m21b('t2')),
  'AC-2: A move_member(M, T2) succeeds');
select tests.clear_authentication();
select is(public.member_roster_team_id(tests.m21b('m')), tests.m21b('t2'), 'AC-2: M''s roster team is T2');
select results_eq(
  $$select left_at is not null, is_primary from public.membership
     where member_id = tests.m21b('m') and team_id = tests.m21b('t1')$$,
  $$values (true, false)$$,
  'AC-2: M''s T1 row is closed and not primary');
select results_eq(
  $$select team_id, is_primary, team_role::text from public.membership
     where member_id = tests.m21b('m') and left_at is null$$,
  $$values (tests.m21b('t2'), true, 'member')$$,
  'AC-2: M''s only active row is T2, primary, member');
select is(tests.m21b_drift(), 0::bigint, 'AC-9: no drift and no mirror violation after AC-2');

-- ---------------------------------------------------------------------------------------------
-- AC-3. Moving onto a team the member already holds promotes that row.
-- ---------------------------------------------------------------------------------------------
select ms.id as v_t2_id from public.membership ms
 where ms.member_id = tests.m21b('v') and ms.team_id = tests.m21b('t2') and ms.left_at is null \gset
select count(*) as v_rows from public.membership ms where ms.member_id = tests.m21b('v') \gset
select tests.authenticate_as(tests.m21b('a'));
select lives_ok(
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21b('v'), tests.m21b('t2')),
  'AC-3: A move_member(V, T2) succeeds');
select tests.clear_authentication();
select results_eq(
  format($$select id, is_primary, team_role::text from public.membership
            where member_id = %L and team_id = %L and left_at is null$$,
         tests.m21b('v'), tests.m21b('t2')),
  format($$values (%L::uuid, true, 'member')$$, :'v_t2_id'),
  'AC-3: V''s existing T2 row is now primary, same id, team_role member');
select is((select count(*) from public.membership where member_id = tests.m21b('v')), :'v_rows'::bigint,
  'AC-3: no membership row was inserted for V');
select results_eq(
  $$select left_at is not null, is_primary from public.membership
     where member_id = tests.m21b('v') and team_id = tests.m21b('t1')$$,
  $$values (true, false)$$,
  'AC-3: V''s T1 row is closed');
select is(tests.m21b_drift(), 0::bigint, 'AC-9: no drift and no mirror violation after AC-3');

-- ---------------------------------------------------------------------------------------------
-- AC-4. Moving a member onto their current team changes nothing.
-- ---------------------------------------------------------------------------------------------
select tests.m21b_ms(tests.m21b('m')) as m_before_ac4 \gset
select tests.authenticate_as(tests.m21b('a'));
select lives_ok(
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21b('m'), tests.m21b('t2')),
  'AC-4: A move_member(M, T2) succeeds again');
select tests.clear_authentication();
select is(tests.m21b_ms(tests.m21b('m')), :'m_before_ac4',
  'AC-4: M''s membership rows are identical in count and in every column');
select is(tests.m21b_drift(), 0::bigint, 'AC-9: no drift and no mirror violation after AC-4');

-- ---------------------------------------------------------------------------------------------
-- AC-5. A rank change writes the primary row's team role.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21b('a'));
select is(s.role::text, 'member',
          'AC-5: set_member_role(R, manager) leaves R''s member.role at member — MIR-16-f')
  from public.set_member_role(tests.m21b('r'), 'manager') s;
select tests.clear_authentication();
select is(
  (select team_role::text from public.membership
    where member_id = tests.m21b('r') and left_at is null and is_primary),
  'manager', 'AC-5: R''s active primary row has team_role manager');
select tests.authenticate_as(tests.m21b('a'));
select is(s.role, tests.member_role('admin'), 'AC-5: promote_member_to_admin(R) returns R as admin')
  from public.promote_member_to_admin(tests.m21b('r')) s;
select tests.clear_authentication();
select is(
  (select team_role::text from public.membership
    where member_id = tests.m21b('r') and left_at is null and is_primary),
  'member', 'AC-5: R''s active primary row has team_role member');
select is(tests.m21b_drift(), 0::bigint, 'AC-9: no drift and no mirror violation after AC-5');

-- ---------------------------------------------------------------------------------------------
-- AC-6. Rejecting a sign-up writes no membership row.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21b('a'));
select lives_ok(format('select public.reject_member(%L::uuid)', tests.m21b('p2')),
  'AC-6: A reject_member(P2) succeeds');
select tests.clear_authentication();
select results_eq(
  $$select status::text, public.member_roster_team_id(id) from public.member where id = tests.m21b('p2')$$,
  $$values ('rejected', null::uuid)$$,
  'AC-6: P2 is rejected, with no team');
select is((select count(*)::int from public.membership where member_id = tests.m21b('p2')), 0,
  'AC-6: P2 has no membership row');
select is(tests.m21b_drift(), 0::bigint, 'AC-9: no drift and no mirror violation after AC-6');

-- ---------------------------------------------------------------------------------------------
-- AC-8. Removal still closes the removed member's rows.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21b('a'));
select is(tests.rows_affected(format('update public.member set removed_at = now() where id = %L',
                                     tests.m21b('w'))),
          1::bigint, 'AC-8: A removes W through the seam''s update');
select tests.clear_authentication();
select is((select count(*)::int from public.membership where member_id = tests.m21b('w') and left_at is null),
  0, 'AC-8: W has no active membership row');
select ok((select count(*) > 0 from public.membership where member_id = tests.m21b('w')),
  'AC-8: W has closed rows to check');
select is(
  (select count(*)::int from public.membership ms join public.member m on m.id = ms.member_id
    where ms.member_id = tests.m21b('w')
      and (ms.left_at is distinct from greatest(m.removed_at, ms.joined_at) or ms.is_primary)),
  0,
  'AC-8: every closed row of W has left_at = greatest(removed_at, joined_at) and is not primary');
select is(tests.m21b_drift(), 0::bigint, 'AC-9: no drift and no mirror violation after AC-8');

select * from tests.m21b_refused(tests.m21b('a'),
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21b('w'), tests.m21b('t2')), null,
  'AC-7: A move_member(W, T2) on removed W');

-- ---------------------------------------------------------------------------------------------
-- AC-11. Deleting a team is refused for exactly the teams it is refused for today.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21b('a'));
select throws_ok(format('select public.delete_team(%L::uuid)', tests.m21b('t1')), '23503', null,
  'AC-11: delete_team(T1), which has members, raises 23503');
select lives_ok(format('select public.delete_team(%L::uuid)', tests.m21b('t4')),
  'AC-11: delete_team(T4), an empty team, succeeds');
select throws_ok(format('select public.delete_team(%L::uuid)', tests.m21b('t3')), '42501', null,
  'AC-11: delete_team(T3), K''s team in O2, raises 42501');
select tests.clear_authentication();
select is((select count(*)::int from public.team where id = tests.m21b('t1')), 1, 'AC-11: T1 still exists');
select is((select count(*)::int from public.team where id = tests.m21b('t4')), 0, 'AC-11: T4 is gone');

-- ---------------------------------------------------------------------------------------------
-- AC-12, second half. grant_system_admin, as the service role. `tests` is not granted to
-- service_role, so the ids are resolved first, as the owner.
-- ---------------------------------------------------------------------------------------------
select tests.m21b('p3') as p3_id, tests.m21b('m') as m_id \gset
select m::text as m_row from public.member m where m.id = tests.m21b('m') \gset
set local role service_role;
select lives_ok(format('select public.grant_system_admin(%L::uuid)', :'p3_id'),
  'AC-12: service_role grant_system_admin(P3), pending with no membership row, succeeds');
select throws_ok(format('select public.grant_system_admin(%L::uuid)', :'m_id'), '42501', null,
  'AC-12: service_role grant_system_admin(M), approved, raises 42501');
reset role;
select is((select count(*)::int from public.member where id = tests.m21b('p3')), 0,
  'AC-12: P3''s member row is gone');
select is((select count(*)::int from public.system_admin where id = tests.m21b('p3')), 1,
  'AC-12: P3 has a system_admin row');
select is((select m::text from public.member m where m.id = tests.m21b('m')), :'m_row',
  'AC-12: M''s member row is unchanged');
select is(tests.m21b_drift(), 0::bigint, 'AC-9: no drift and no mirror violation after the grant');

select * from finish();
rollback;
