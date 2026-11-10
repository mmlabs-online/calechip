-- MIR-06 AC-5 and AC-6, with AC-13 controls: an admin of T decides, edits and deletes none of U's
-- entries and writes neither team U nor its members; a manager of T decides nothing of U's.
-- 01-plan.md § 4.4.
begin;
\ir _isolation.psql
select plan(20);
select tests.seed();

-- AC-5, as admin_t.
select tests.authenticate_as(tests.id('admin_t'));
select is(current_user::text, 'authenticated', 'runs as authenticated');

select is(
  tests.rows_affected($$update public.entry set status = 'approved' where id = tests.id('entry_u')$$),
  0::bigint, 'AC-5 admin_t: approving U''s entry affects zero rows (entry-decision.test.ts:286-300)');
select is(
  tests.rows_affected($$update public.entry set status = 'rejected', rejection_reason = 'x' where id = tests.id('entry_u')$$),
  0::bigint, 'AC-5 admin_t: rejecting U''s entry affects zero rows');
select is(
  tests.rows_affected($$update public.entry set note = 'x' where id = tests.id('entry_u')$$),
  0::bigint, 'AC-5 admin_t: editing U''s entry note affects zero rows');
select is(
  tests.rows_affected($$delete from public.entry where id = tests.id('entry_u')$$),
  0::bigint, 'AC-5 admin_t: deleting U''s entry affects zero rows');
select is(
  tests.rows_affected($$update public.team set overload_threshold = 0.9 where id = tests.id('team_u')$$),
  0::bigint, 'AC-5 admin_t: U''s overload_threshold affects zero rows (threshold.test.ts:130-137)');
select is(
  tests.rows_affected($$update public.team set wfh_need_approve = false, pto_need_approve = false where id = tests.id('team_u')$$),
  0::bigint, 'AC-5 admin_t: U''s approval flags affect zero rows (approval-settings.test.ts:101-109)');
select is(
  tests.rows_affected($$update public.member set removed_at = now() where id = tests.id('member_u')$$),
  0::bigint, 'AC-5 admin_t: removing a member of U affects zero rows (cross-team-role.test.ts:138)');

-- AC-6, as manager_t.
select tests.authenticate_as(tests.id('manager_t'));
select is(
  tests.rows_affected($$update public.entry set status = 'approved' where id = tests.id('entry_u')$$),
  0::bigint, 'AC-6 manager_t: approving U''s entry affects zero rows');
select is(
  tests.rows_affected($$update public.entry set status = 'rejected', rejection_reason = 'x' where id = tests.id('entry_u')$$),
  0::bigint, 'AC-6 manager_t: rejecting U''s entry affects zero rows');

-- Re-read as the table owner, without RLS.
select tests.clear_authentication();
select results_eq(
  $$select status::text, note, rejection_reason, approved_by from public.entry where id = tests.id('entry_u')$$,
  $$values ('pending', null::text, null::text, null::uuid)$$,
  'AC-5/AC-6: U''s entry is unchanged and still exists'
);
select results_eq(
  $$select overload_threshold, wfh_need_approve, pto_need_approve from public.team where id = tests.id('team_u')$$,
  $$values (0.5::numeric, true, true)$$,
  'AC-5: team U is unchanged'
);
select is(
  (select removed_at from public.member where id = tests.id('member_u')),
  null::timestamptz,
  'AC-5: member_u is not removed'
);

-- AC-13 controls: the same statements succeed for the entitled caller on the same fixture.
select tests.authenticate_as(tests.id('admin_t'));
select is(
  tests.rows_affected($$update public.entry set status = 'approved' where id = tests.id('entry_t')$$),
  1::bigint, 'AC-13 control: admin_t approves T''s entry (1 row)');
select is(
  tests.rows_affected($$update public.team set overload_threshold = 0.9 where id = tests.id('team_t')$$),
  1::bigint, 'AC-13 control: admin_t sets T''s overload_threshold (1 row)');
select is(
  tests.rows_affected($$update public.member set removed_at = now() where id = tests.id('member_t2')$$),
  1::bigint, 'AC-13 control: admin_t removes a member of T (1 row)');

select tests.authenticate_as(tests.id('admin_u'));
select is(
  tests.rows_affected($$update public.entry set note = 'x' where id = tests.id('entry_u')$$),
  1::bigint, 'AC-13 control: admin_u edits U''s entry note (1 row)');
select is(
  tests.rows_affected($$update public.team set wfh_need_approve = false, pto_need_approve = false where id = tests.id('team_u')$$),
  1::bigint, 'AC-13 control: admin_u sets U''s approval flags (1 row)');

select tests.authenticate_as(tests.id('manager_u'));
select is(
  tests.rows_affected($$update public.entry set status = 'rejected', rejection_reason = 'x' where id = tests.id('entry_u')$$),
  1::bigint, 'AC-13 control: manager_u rejects U''s entry (1 row)');

select tests.authenticate_as(tests.id('member_u'));
select is(
  tests.rows_affected($$delete from public.entry where id = tests.id('entry_u')$$),
  1::bigint, 'AC-13 control: member_u deletes their own entry (1 row)');

select * from finish();
rollback;
