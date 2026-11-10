-- MIR-16-c AC-1 to AC-7: the manager rank is read from `membership.team_role`, not from
-- `member.role`, and `may_decide(uuid)` retires (ADR-085 decision 1; 01-plan.md § 2, § 4.2).
--
-- Fixture: `tests.seed()`, plus (written as `postgres`): Team T2 in Org public; Rae, a manager
-- placed on Team T with `tests.put_on_team` and then removed by the owner; one pending entry by
-- Thanh. Mona is `manager_t`, an approved manager of Team T; Thanh is `member_t`, an approved
-- member of T; Ada is `admin_t`, an approved org_admin of T's org.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(25);
select tests.seed();

create function tests.m310(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('c3100000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('team_t2', '01'), ('rae', '02'), ('entry_thanh2', '03')
    ) as v(label, nn)
   where v.label = p_label;
$$;

insert into public.team (id, name) values (tests.m310('team_t2'), 'Team T2');

insert into auth.users (id, email) values (tests.m310('rae'), 'rae@mir16c-310.test');
insert into public.member (id, display_name, avatar, role, status, email) values
  (tests.m310('rae'), 'Rae', '1.png', tests.member_role('manager'), 'approved', 'rae@mir16c-310.test');
select tests.put_on_team(tests.m310('rae'), tests.id('team_t'), 'manager');
select is(
  tests.rows_affected(format('update public.member set removed_at = now() where id = %L', tests.m310('rae'))),
  1::bigint,
  'fixture: Rae is removed'
);

insert into public.entry (id, member_id, type, portion, start_date, end_date) values
  (tests.m310('entry_thanh2'), tests.id('member_t'), 'pto', 'full', '2026-12-10', '2026-12-11');

-- ---------------------------------------------------------------------------------------------
-- AC-1. Each person's roster team role is readable, and the computed field agrees on the rows
-- Ada (an org admin sharing Team T) can select.
-- ---------------------------------------------------------------------------------------------
select is(public.member_roster_team_role(tests.id('manager_t')), 'manager'::public.team_role,
  'AC-1: member_roster_team_role(Mona) is manager');
select is(public.member_roster_team_role(tests.id('member_t')), 'member'::public.team_role,
  'AC-1: member_roster_team_role(Thanh) is member');
select is(public.member_roster_team_role(tests.id('admin_t')), 'member'::public.team_role,
  'AC-1: member_roster_team_role(Ada) is member');

select tests.authenticate_as(tests.id('admin_t'));
select is((select public.roster_team_role(m) from public.member m where m.id = tests.id('manager_t')),
  'manager'::public.team_role, 'AC-1: roster_team_role(Mona) is manager, read as Ada');
select is((select public.roster_team_role(m) from public.member m where m.id = tests.id('member_t')),
  'member'::public.team_role, 'AC-1: roster_team_role(Thanh) is member, read as Ada');
select is((select public.roster_team_role(m) from public.member m where m.id = tests.id('admin_t')),
  'member'::public.team_role, 'AC-1: roster_team_role(Ada) is member, read as Ada');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-2. A removed manager's roster team role is the one on their closed row.
-- ---------------------------------------------------------------------------------------------
select is(public.member_roster_team_role(tests.m310('rae')), 'manager'::public.team_role,
  'AC-2: member_roster_team_role(Rae) is manager');
select is(
  (select ms.team_role from public.membership ms
    where ms.member_id = tests.m310('rae') and ms.team_id = public.member_roster_team_id(tests.m310('rae'))),
  public.member_roster_team_role(tests.m310('rae')),
  'AC-2: it is the team_role of the row member_roster_team_id(Rae) reads'
);

-- ---------------------------------------------------------------------------------------------
-- AC-3. A person with no roster team has none.
-- ---------------------------------------------------------------------------------------------
select ok(public.member_roster_team_role(tests.id('pending_p')) is null,
  'AC-3: member_roster_team_role(a pending sign-up) is null');

-- ---------------------------------------------------------------------------------------------
-- AC-4. A manager moved to another team is still a manager there.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select lives_ok(
  format($$select public.move_member(%L::uuid, %L::uuid)$$, tests.id('manager_t'), tests.m310('team_t2')),
  'AC-4: Ada moving Mona to T2 lives');
select tests.clear_authentication();
select is(public.member_roster_team_id(tests.id('manager_t')), tests.m310('team_t2'),
  'AC-4: Mona''s active primary row is on T2');
select is(public.member_roster_team_role(tests.id('manager_t')), 'manager'::public.team_role,
  'AC-4: Mona''s active primary row is still team_role manager');
select ok(
  (select ms.left_at is not null and not ms.is_primary from public.membership ms
    where ms.member_id = tests.id('manager_t') and ms.team_id = tests.id('team_t')),
  'AC-4: Mona''s T row is closed');

-- ---------------------------------------------------------------------------------------------
-- AC-6's precondition, set here so AC-5's move already exercises it: Thanh's `member.role` is set
-- to manager by the owner, while his primary row stays at team_role = member.
-- ---------------------------------------------------------------------------------------------
select is(
  tests.rows_affected(format('update public.member set role = %L where id = %L',
                              tests.member_role('manager'), tests.id('member_t'))),
  1::bigint,
  'fixture: Thanh''s member.role is set to manager'
);
select is(
  (select ms.team_role from public.membership ms
    where ms.member_id = tests.id('member_t') and ms.left_at is null and ms.is_primary),
  'member'::public.team_role,
  'fixture: Thanh''s primary row still reads team_role member'
);

-- ---------------------------------------------------------------------------------------------
-- AC-5 and AC-6. A member moved, or a sign-up admitted, is a member there, and moving reads the
-- row and not member.role (which this fixture just set to manager for Thanh).
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select lives_ok(
  format($$select public.move_member(%L::uuid, %L::uuid)$$, tests.id('member_t'), tests.m310('team_t2')),
  'AC-5/AC-6: Ada moving Thanh to T2 lives');
select lives_ok(
  format($$select public.admit_member(%L::uuid, %L::uuid)$$, tests.id('pending_p'), tests.id('team_t')),
  'AC-5: Ada admitting Pat to T lives');
select tests.clear_authentication();
select is(public.member_roster_team_role(tests.id('member_t')), 'member'::public.team_role,
  'AC-6: Thanh''s new primary row has team_role member — it follows the row, not the column');
select is(public.member_roster_team_role(tests.id('pending_p')), 'member'::public.team_role,
  'AC-5: Pat''s new primary row has team_role member');

-- ---------------------------------------------------------------------------------------------
-- AC-7. may_decide is gone, and nothing used it: entry_update_manager still lets Mona decide
-- Thanh's pending entry. Mona and Thanh now share Team T2 (AC-4, AC-5/AC-6).
-- ---------------------------------------------------------------------------------------------
select hasnt_function('public', 'may_decide', array['uuid'], 'AC-7: public.may_decide(uuid) does not exist');
select tests.authenticate_as(tests.id('manager_t'));
select is(
  tests.rows_affected(format($$update public.entry set status = 'approved' where id = %L$$,
                              tests.m310('entry_thanh2'))),
  1::bigint,
  'AC-7: Mona deciding Thanh''s pending entry affects one row'
);
select tests.clear_authentication();
select is((select status::text from public.entry where id = tests.m310('entry_thanh2')), 'approved',
  'AC-7: Thanh''s entry is approved, decided by Mona');

-- ---------------------------------------------------------------------------------------------
-- anon lacks EXECUTE on both new functions.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_anon();
select throws_ok(format('select public.member_roster_team_role(%L)', tests.id('member_t')), '42501', null,
  'anon is refused member_roster_team_role(uuid)');
select throws_ok('select public.roster_team_role(null::public.member)', '42501', null,
  'anon is refused roster_team_role(public.member)');
select tests.clear_authentication();

select * from finish();
rollback;
