-- MIR-21 AC-1 to AC-8 and AC-10: every reader of `member.team_id` reads the roster team from
-- `membership`, and every answer is the one the column gave (ADR-077).
--
-- O1 holds T1 and T2; O2 holds T3. A is admin on T1, K is admin on T3; the fixture writes their
-- membership rows directly (MIR-21-e). M, R, V, P and J sign up pending in O1, and A then decides
-- them through today's writers: admit_member, move_member, reject_member, and the removal update the
-- seam sends (01-plan.md § 2).
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(25);
select tests.seed();

create function tests.m21(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('c2200000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('o1', 'a1'), ('o2', 'a2'), ('t1', 'b1'), ('t2', 'b2'), ('t3', 'b3'),
      ('a', 'c1'), ('m', 'c2'), ('r', 'c3'), ('p', 'c4'), ('j', 'c5'), ('v', 'c6'), ('k', 'c7')
    ) as v(label, nn)
   where v.label = p_label;
$$;

insert into public.org (id, org_code, name) values
  (tests.m21('o1'), 'org-o1-mir21-220', 'Org O1'),
  (tests.m21('o2'), 'org-o2-mir21-220', 'Org O2');
insert into public.team (id, name, org_id) values
  (tests.m21('t1'), 'Team T1', tests.m21('o1')),
  (tests.m21('t2'), 'Team T2', tests.m21('o1')),
  (tests.m21('t3'), 'Team T3', tests.m21('o2'));
insert into auth.users (id, email)
select tests.m21(l), l || '@mir21-220.test' from unnest(array['a', 'm', 'r', 'p', 'j', 'v', 'k']) l;
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m21('a'), tests.m21('o1'), 'A', '1.png', tests.member_role('admin'), 'approved', 'a@mir21-220.test'),
  (tests.m21('k'), tests.m21('o2'), 'K', '1.png', tests.member_role('admin'), 'approved', 'k@mir21-220.test');
select tests.put_on_team(tests.m21('a'), tests.m21('t1'));
select tests.put_on_team(tests.m21('k'), tests.m21('t3'));
insert into public.member (id, org_id, display_name, avatar, role, status, email)
select tests.m21(l), tests.m21('o1'), upper(l), '1.png', 'member', 'pending', l || '@mir21-220.test'
  from unnest(array['m', 'r', 'p', 'j', 'v']) l;

select tests.authenticate_as(tests.m21('a'));
select public.admit_member(tests.m21('m'), tests.m21('t1'));
select public.admit_member(tests.m21('r'), tests.m21('t1'));
select public.admit_member(tests.m21('v'), tests.m21('t1'));
select public.move_member(tests.m21('v'), tests.m21('t2'));
select public.reject_member(tests.m21('j'));
select tests.clear_authentication();

-- AC-4's busy days, before R's removal.
insert into public.busy_day (member_id, date) values
  (tests.m21('r'), '2099-08-01'),
  (tests.m21('m'), '2099-08-01'),
  (tests.m21('v'), '2099-08-01');

select tests.authenticate_as(tests.m21('a'));
select is(tests.rows_affected(format('update public.member set removed_at = now() where id = %L',
                                     tests.m21('r'))),
          1::bigint, 'fixture: A removes R through the seam''s update');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-1. The roster team of each decided member.
-- ---------------------------------------------------------------------------------------------
select is(public.member_roster_team_id(tests.m21('r')), tests.m21('t1'), 'AC-1: R''s roster team is T1');
select is(public.member_roster_team_id(tests.m21('v')), tests.m21('t2'), 'AC-1: V''s roster team is T2');
select is(public.member_roster_team_id(tests.m21('p')), null::uuid, 'AC-1: P''s roster team is null');
select is(public.member_roster_team_id(tests.m21('j')), null::uuid, 'AC-1: J''s roster team is null');

-- ---------------------------------------------------------------------------------------------
-- AC-3. The roster read is unchanged.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21('m'));
select set_eq($$select id from public.member$$,
  $$values (tests.m21('a')), (tests.m21('m')), (tests.m21('r'))$$,
  'AC-3: M reads exactly A, M and R');
select is_empty(
  $$select id from public.member
     where id in (tests.m21('p'), tests.m21('j'), tests.m21('v'), tests.m21('k'))$$,
  'AC-3: M reads none of P, J, V or K');

-- ---------------------------------------------------------------------------------------------
-- AC-4. Busy days are unchanged.
-- ---------------------------------------------------------------------------------------------
select set_eq($$select member_id from public.busy_day$$,
  $$values (tests.m21('r')), (tests.m21('m'))$$,
  'AC-4: M reads R''s busy day and M''s own, and no other');
select tests.clear_authentication();
select is((select count(*)::int from public.busy_day where member_id = tests.m21('v')), 1,
  'AC-4: V''s busy day exists, so its absence above is the policy''s answer');

-- ---------------------------------------------------------------------------------------------
-- AC-5. The sign-up queue, read the way the seam reads it: rows whose roster_team_id is null.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21('a'));
select set_eq($$select m.id from public.member m where public.roster_team_id(m) is null$$,
  $$values (tests.m21('p')), (tests.m21('j'))$$,
  'AC-5: A reads P and J, and no approved member');
select tests.authenticate_as(tests.m21('m'));
select is_empty(
  $$select m.id from public.member m
     where public.roster_team_id(m) is null and m.id in (tests.m21('p'), tests.m21('j'))$$,
  'AC-5: M reads no row of P or J');
select tests.authenticate_as(tests.m21('k'));
select is_empty(
  $$select m.id from public.member m
     where public.roster_team_id(m) is null and m.id in (tests.m21('p'), tests.m21('j'))$$,
  'AC-5: K, an admin of another org, reads no row of P or J');

-- ---------------------------------------------------------------------------------------------
-- AC-6. The admin member lists, bounded by org.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21('a'));
select set_eq($$select id from public.list_all_members()$$,
  $$values (tests.m21('a')), (tests.m21('m')), (tests.m21('r')), (tests.m21('v'))$$,
  'AC-6: list_all_members() is every O1 member with a roster team, R included, and no O2 member');
select set_eq($$select id from public.list_members_for_team(tests.m21('t2'))$$,
  $$values (tests.m21('v'))$$,
  'AC-6: list_members_for_team(T2) is exactly V');
select is_empty($$select id from public.list_members_for_team(tests.m21('t3'))$$,
  'AC-6: list_members_for_team(T3) is empty for A');
select tests.authenticate_as(tests.m21('m'));
select is_empty($$select id from public.list_all_members()$$, 'AC-6: list_all_members() is empty for M');
select is_empty($$select id from public.list_members_for_team(tests.m21('t1'))$$,
  'AC-6: list_members_for_team(T1) is empty for M');

-- ---------------------------------------------------------------------------------------------
-- AC-7. The directory is unchanged.
-- ---------------------------------------------------------------------------------------------
select bag_eq(
  $$select id, team_id, team_name from public.list_member_directory()
     where id in (tests.m21('a'), tests.m21('m'))$$,
  $$values (tests.m21('a'), tests.m21('t1'), 'Team T1'), (tests.m21('m'), tests.m21('t1'), 'Team T1')$$,
  'AC-7: M''s directory lists A and M once each, on T1 with T1''s name');
select is_empty(
  $$select id from public.list_member_directory()
     where id in (tests.m21('v'), tests.m21('r'), tests.m21('p'), tests.m21('j'), tests.m21('k'))$$,
  'AC-7: M''s directory lists none of V, R, P, J or K');
select tests.authenticate_as(tests.m21('a'));
select bag_eq(
  $$select id, team_id, team_name from public.list_member_directory() where id = tests.m21('v')$$,
  $$values (tests.m21('v'), tests.m21('t2'), 'Team T2')$$,
  'AC-7: A''s directory lists V once, on T2 with T2''s name');
select is_empty($$select id from public.list_member_directory() where id = tests.m21('k')$$,
  'AC-7: A''s directory does not list K');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-8. No read policy or read function reads the column.
-- ---------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_catalog.pg_policies p
    where p.cmd = 'SELECT'
      and (coalesce(p.qual, '') ~ '\m(member|m)\.team_id\M'
           or (p.schemaname = 'public' and p.tablename = 'member'
               and coalesce(p.qual, '') ~ '\mteam_id\M'))),
  0,
  'AC-8: no select policy reads member.team_id'
);
select is(
  (select count(*)::int from pg_catalog.pg_proc p
    where p.pronamespace = 'public'::regnamespace
      and p.proname in ('list_all_members', 'list_members_for_team', 'list_member_directory')
      and p.prosrc ~ '\mm\.team_id\M'),
  0,
  'AC-8: no read function body names m.team_id'
);

-- ---------------------------------------------------------------------------------------------
-- AC-10. The helpers are closed to anon.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_anon();
select throws_ok(format('select public.member_roster_team_id(%L)', tests.m21('m')), '42501', null,
  'AC-10: anon is refused member_roster_team_id(uuid)');
select throws_ok('select public.roster_team_id(null::public.member)', '42501', null,
  'AC-10: anon is refused roster_team_id(public.member)');
select tests.clear_authentication();

select * from finish();
rollback;
