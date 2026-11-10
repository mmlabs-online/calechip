-- MIR-17-d AC-1 to AC-5: the application's manager is whoever manages a team, read through
-- member_manages_a_team(uuid) and the computed field manages_a_team(public.member)
-- (ADR-091 decision 1; 01-plan.md § 2, § 4.1, § 4.2).
--
-- Fixture: `tests.seed()`, plus (written as `postgres`): Team T2 in Org public; a second, active,
-- non-primary `membership` row for `member_t` on T2 with `team_role = 'manager'` — that makes
-- `member_t` the AC's Vu, a second-team manager whose roster-team row still reads `team_role =
-- member`; `member_t2` is the AC's Thanh. Rae, a manager placed on Team T with
-- `tests.put_on_team` and then removed by the owner. `manager_t` is Mona, a roster-team manager
-- of Team T. `admin_t` is Ada, an org admin of T's org.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(13);
select tests.seed();

create function tests.m340(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('c3400000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('team_t2', '01'), ('rae', '02')
    ) as v(label, nn)
   where v.label = p_label;
$$;

insert into public.team (id, name) values (tests.m340('team_t2'), 'Team T2');

-- Vu: member_t keeps their primary, active team_role = member row on Team T, and gains a second,
-- active, non-primary row on Team T2 with team_role = manager.
select is(
  tests.rows_affected(
    format($$insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at)
              select m.org_id, %L::uuid, m.id, 'manager'::public.team_role, false, now()
                from public.member m where m.id = %L$$,
           tests.m340('team_t2'), tests.id('member_t'))),
  1::bigint,
  'fixture: member_t (Vu) gains a second, non-primary, active row on T2 as manager'
);

-- Rae: a manager of Team T, removed. In the shape of 310-manager-read-from-membership.test.sql.
insert into auth.users (id, email) values (tests.m340('rae'), 'rae@mir17d-340.test');
insert into public.member (id, display_name, avatar, role, status, email) values
  (tests.m340('rae'), 'Rae', '1.png', tests.member_role('manager'), 'approved', 'rae@mir17d-340.test');
select tests.put_on_team(tests.m340('rae'), tests.id('team_t'), 'manager');
select is(
  tests.rows_affected(format('update public.member set removed_at = now() where id = %L', tests.m340('rae'))),
  1::bigint,
  'fixture: Rae is removed'
);

-- ---------------------------------------------------------------------------------------------
-- AC-1. A roster-team manager manages a team.
-- ---------------------------------------------------------------------------------------------
select ok(public.member_manages_a_team(tests.id('manager_t')),
  'AC-1: member_manages_a_team(Mona) is true');

-- ---------------------------------------------------------------------------------------------
-- AC-2. A second-team manager manages a team, while their roster-team role stays member.
-- ---------------------------------------------------------------------------------------------
select ok(public.member_manages_a_team(tests.id('member_t')),
  'AC-2: member_manages_a_team(Vu) is true');
select is(public.member_roster_team_role(tests.id('member_t')), 'member'::public.team_role,
  'AC-2: member_roster_team_role(Vu) is member');

-- ---------------------------------------------------------------------------------------------
-- AC-3. A member, an org admin who holds no manager row, and a pending sign-up do not.
-- ---------------------------------------------------------------------------------------------
select ok(not public.member_manages_a_team(tests.id('member_t2')),
  'AC-3: member_manages_a_team(Thanh) is false');
select ok(not public.member_manages_a_team(tests.id('admin_t')),
  'AC-3: member_manages_a_team(Ada) is false');
select ok(not public.member_manages_a_team(tests.id('pending_p')),
  'AC-3: member_manages_a_team(a pending sign-up) is false');

-- ---------------------------------------------------------------------------------------------
-- AC-4. A removed manager keeps the label they have today.
-- ---------------------------------------------------------------------------------------------
select ok(public.member_manages_a_team(tests.m340('rae')),
  'AC-4: member_manages_a_team(Rae) is true');
select is(public.member_roster_team_role(tests.m340('rae')), 'manager'::public.team_role,
  'AC-4: member_roster_team_role(Rae) is manager, which is why she still manages a team');

-- ---------------------------------------------------------------------------------------------
-- AC-5. The computed field answers the same as the function, on the rows Ada may read, and anon
-- holds EXECUTE on neither signature.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select results_eq(
  format($$select m.id, public.manages_a_team(m) from public.member m
            where public.member_roster_team_id(m.id) = %L order by m.id$$, tests.id('team_t')),
  format($$select m.id, public.member_manages_a_team(m.id) from public.member m
            where public.member_roster_team_id(m.id) = %L order by m.id$$, tests.id('team_t')),
  'AC-5: manages_a_team(m) equals member_manages_a_team(id) for every row of T''s roster, read as Ada'
);
select tests.clear_authentication();

select tests.authenticate_anon();
select throws_ok(format('select public.member_manages_a_team(%L)', tests.id('member_t')), '42501', null,
  'AC-5: anon is refused member_manages_a_team(uuid)');
select throws_ok('select public.manages_a_team(null::public.member)', '42501', null,
  'AC-5: anon is refused manages_a_team(public.member)');
select tests.clear_authentication();

select * from finish();
rollback;
