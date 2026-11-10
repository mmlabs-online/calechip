-- MIR-06 AC-3, with AC-13 controls and the team rows of the § 4.7 mirror: a member or manager of T
-- reads no member of U and no pending sign-up, by table or by RPC. 01-plan.md § 4.4.
begin;
\ir _isolation.psql
select plan(14);
select tests.seed();

select tests.authenticate_as(tests.id('member_t'));
select is(current_user::text, 'authenticated', 'runs as authenticated');

select is_empty(
  $$select id from public.member where public.member_roster_team_id(id) = tests.id('team_u')
     or public.member_roster_team_id(id) is null$$,
  'AC-3 member_t: selects no member of U and no pending sign-up'
);
select is_empty(
  $$select id from public.list_members_for_team(tests.id('team_u'))$$,
  'AC-3 member_t: list_members_for_team(U) is empty (viewed-team.test.ts:179-183)'
);
select todo('MIR-06 finding F-3: list_member_directory() returns U people who share a public event with the caller (ADR-066 clauses, mir04:33-45) — AC-3 may be mis-specified', 1);
select is_empty(
  $$select id from public.list_member_directory() where team_id = tests.id('team_u')$$,
  'AC-3 member_t: list_member_directory() holds no member of U'
);
-- seam-parity.test.ts:84-92, e2e cal-12-team-picker.spec.ts:111-121: the team a member sees is theirs.
select results_eq(
  $$select id from public.team$$,
  $$values (tests.id('team_t'))$$,
  'AC-3 member_t: public.team returns T only (seam-parity.test.ts:84-92)'
);

select tests.authenticate_as(tests.id('manager_t'));
select is_empty(
  $$select id from public.member where public.member_roster_team_id(id) = tests.id('team_u')
     or public.member_roster_team_id(id) is null$$,
  'AC-3 manager_t: selects no member of U and no pending sign-up'
);
select is_empty(
  $$select id from public.list_members_for_team(tests.id('team_u'))$$,
  'AC-3 manager_t: list_members_for_team(U) is empty'
);
select todo('MIR-06 finding F-3: list_member_directory() returns U people who share a public event with the caller (ADR-066 clauses, mir04:33-45) — AC-3 may be mis-specified', 1);
select is_empty(
  $$select id from public.list_member_directory() where team_id = tests.id('team_u')$$,
  'AC-3 manager_t: list_member_directory() holds no member of U'
);

-- AC-13 controls.
select tests.authenticate_as(tests.id('member_t'));
select ok(
  exists (select 1 from public.member where id = tests.id('member_t2')),
  'AC-13 control: member_t reads teammate member_t2'
);

select tests.authenticate_as(tests.id('member_u'));
select results_eq(
  $$select id from public.team$$,
  $$values (tests.id('team_u'))$$,
  'AC-3 control: public.team returns U only to member_u (seam-parity.test.ts:84-92)'
);
select set_eq(
  $$select id from public.member where public.member_roster_team_id(id) = tests.id('team_u')$$,
  $$values (tests.id('admin_u')), (tests.id('manager_u')), (tests.id('member_u')),
           (tests.id('member_u2')), (tests.id('removed_u'))$$,
  'AC-13 control: member_u reads U''s roster, the removed member included (ADR-018)'
);
select ok(
  exists (select 1 from public.list_member_directory() where id = tests.id('member_u2')),
  'AC-13 control: member_u finds teammate member_u2 in list_member_directory()'
);

select tests.authenticate_as(tests.id('admin_t'));
select ok(
  exists (select 1 from public.list_members_for_team(tests.id('team_u'))),
  'AC-13 control: an approved admin reads U through list_members_for_team (CAL-11)'
);
select results_eq(
  $$select id from public.member where public.member_roster_team_id(id) is null$$,
  $$values (tests.id('pending_p'))$$,
  'AC-13 control: an approved admin reads the pending sign-up (member_select_pending_admin)'
);

select * from finish();
rollback;
