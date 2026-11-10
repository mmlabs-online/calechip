-- MIR-06 AC-2, with AC-13 controls and the entry rows of the § 4.7 mirror: a member or manager of T
-- reads none of U's entries, by table or by RPC. 01-plan.md § 4.4.
begin;
\ir _isolation.psql
select plan(15);
select tests.seed();

-- AC-2, as a member of T and as a manager of T.
select tests.authenticate_as(tests.id('member_t'));
select is(current_user::text, 'authenticated', 'runs as authenticated');

select is_empty(
  $$select id from public.entry where member_id in (tests.id('member_u'), tests.id('member_u2'))$$,
  'AC-2 member_t: selects no entry of U (seam-parity.test.ts:127-136)'
);
select is_empty(
  $$select id from public.entry
     where member_id in (tests.id('member_u'), tests.id('member_u2')) and status = 'pending'$$,
  'AC-2 member_t: selects no pending entry of U (pending-entries.test.ts:182-183)'
);
select is_empty(
  $$select id from public.list_team_entries_for_team(tests.id('team_u'))$$,
  'AC-2 member_t: list_team_entries_for_team(U) is empty (viewed-team.test.ts:179-183)'
);
select is_empty(
  $$select id from public.list_team_entries_overlapping_for_team(tests.id('team_u'), '2026-11-01', '2026-11-30')$$,
  'AC-2 member_t: list_team_entries_overlapping_for_team(U, November) is empty'
);
-- e2e cal-04-month-view.spec.ts:159-167: the month view over the two days both teams are off.
select results_eq(
  $$select id from public.entry where date_range && daterange('2026-11-02', '2026-11-03', '[]')$$,
  $$values (tests.id('entry_t'))$$,
  'AC-2 member_t: the 2026-11-02..03 window holds T''s entry only (cal-04-month-view.spec.ts:159-167)'
);

select tests.authenticate_as(tests.id('manager_t'));
select is_empty(
  $$select id from public.entry where member_id in (tests.id('member_u'), tests.id('member_u2'))$$,
  'AC-2 manager_t: selects no entry of U'
);
select is_empty(
  $$select id from public.entry
     where member_id in (tests.id('member_u'), tests.id('member_u2')) and status = 'pending'$$,
  'AC-2 manager_t: selects no pending entry of U (the approval worklist read)'
);
select is_empty(
  $$select id from public.list_team_entries_for_team(tests.id('team_u'))$$,
  'AC-2 manager_t: list_team_entries_for_team(U) is empty'
);
select is_empty(
  $$select id from public.list_team_entries_overlapping_for_team(tests.id('team_u'), '2026-11-01', '2026-11-30')$$,
  'AC-2 manager_t: list_team_entries_overlapping_for_team(U, November) is empty'
);

-- e2e cal-03-admin-edit-entry.spec.ts:412-427: an admin of T cannot open U's entry by table.
select tests.authenticate_as(tests.id('admin_t'));
select is_empty(
  $$select id from public.entry where id = tests.id('entry_u')$$,
  'AC-2 admin_t: selects no entry of U (cal-03-admin-edit-entry.spec.ts:412-427)'
);

-- AC-13 controls: the U rows exist and are readable by those entitled to them.
select tests.authenticate_as(tests.id('member_u'));
select set_eq(
  $$select id from public.entry where member_id in (tests.id('member_u'), tests.id('member_u2'))$$,
  $$values (tests.id('entry_u')), (tests.id('entry_u_approved'))$$,
  'AC-13 control: member_u reads U''s entries'
);
select set_eq(
  $$select id from public.entry
     where member_id in (tests.id('member_u'), tests.id('member_u2')) and status = 'pending'$$,
  $$values (tests.id('entry_u'))$$,
  'AC-13 control: member_u reads U''s pending entry'
);

select tests.authenticate_as(tests.id('admin_t'));
select set_eq(
  $$select id from public.list_team_entries_for_team(tests.id('team_u'))$$,
  $$values (tests.id('entry_u')), (tests.id('entry_u_approved'))$$,
  'AC-13 control: an approved admin reads U''s entries through list_team_entries_for_team (CAL-11)'
);
select set_eq(
  $$select id from public.list_team_entries_overlapping_for_team(tests.id('team_u'), '2026-11-01', '2026-11-30')$$,
  $$values (tests.id('entry_u')), (tests.id('entry_u_approved'))$$,
  'AC-13 control: an approved admin reads U''s entries through list_team_entries_overlapping_for_team'
);

select * from finish();
rollback;
