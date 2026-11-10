-- MIR-14 AC-1 to AC-20: one decider on any of the owner's teams decides a multi-team entry, the
-- approval switches are OR-ed across the owner's teams, a rejection records its rejecter, a manager
-- may decide their own entry (recorded as `self_approved`), and a manager may not overturn another
-- person's rejection (ADR-073, ADR-070 § 4).
--
-- A "second-team row" is one active `membership` row with `is_primary = false`, inserted here as the
-- owner (no writer creates one yet, ADR-072 decision 5). Part 1 runs with `member_t` holding one on U
-- (`team_u`); part 2 deletes it, so `member_t` is on T (`team_t`) only (01-plan.md § 2).
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(96);
select tests.seed();

create function tests.m14(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('c1700000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('e4', '04'), ('e5', '05'), ('e6', '06'), ('e7', '07'), ('e8a', '08'), ('e8b', '09'),
      ('e9a', '0a'), ('e9b', '0b'), ('e10', '10'), ('e11', '11'), ('e12', '12'),
      ('e14', '14'), ('e16', '16'), ('e16b', '1b'), ('e17', '17'), ('e17b', '1c'),
      ('e18a', '18'), ('e18b', '19'), ('e18c', '1a'), ('e20', '20')
    ) as v(label, nn)
   where v.label = p_label;
$$;

-- Definer: the org row and every entry are read here while authenticated, without RLS.
create function tests.org_a() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

create function tests.e(p_id uuid) returns public.entry
  language sql stable security definer set search_path = '' as $$
  select * from public.entry where id = p_id;
$$;

create function tests.by_note(p_note text) returns public.entry
  language sql stable security definer set search_path = '' as $$
  select * from public.entry where note = p_note;
$$;

-- One decision as the current role; returns the row count, since a row a policy does not admit is
-- filtered rather than errored.
create function tests.decide(p_id uuid, p_status text, p_reason text default null) returns bigint
  language plpgsql security invoker set search_path = '' as $$
declare
  v_n bigint;
begin
  update public.entry
     set status = p_status::public.entry_status, rejection_reason = p_reason
   where id = p_id;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Entries, inserted as the owner while both seed teams require approval, so every one is pending.
-- Distinct dates per member: `entry_no_overlapping_portion` covers every status.
insert into public.entry (id, member_id, type, portion, start_date, end_date) values
  (tests.m14('e4'),   tests.id('member_t'),  'pto', 'full', '2099-01-04', '2099-01-04'),
  (tests.m14('e5'),   tests.id('member_t'),  'pto', 'full', '2099-01-05', '2099-01-05'),
  (tests.m14('e6'),   tests.id('member_t'),  'pto', 'full', '2099-01-06', '2099-01-06'),
  (tests.m14('e7'),   tests.id('member_t'),  'pto', 'full', '2099-01-07', '2099-01-07'),
  (tests.m14('e8a'),  tests.id('member_t'),  'pto', 'full', '2099-01-08', '2099-01-08'),
  (tests.m14('e8b'),  tests.id('member_t'),  'pto', 'full', '2099-01-09', '2099-01-09'),
  (tests.m14('e11'),  tests.id('member_t'),  'pto', 'full', '2099-01-11', '2099-01-11'),
  (tests.m14('e12'),  tests.id('member_t'),  'pto', 'full', '2099-01-12', '2099-01-12'),
  (tests.m14('e14'),  tests.id('member_t'),  'pto', 'full', '2099-01-14', '2099-01-14'),
  (tests.m14('e16'),  tests.id('member_t'),  'pto', 'full', '2099-01-16', '2099-01-16'),
  (tests.m14('e16b'), tests.id('member_t'),  'pto', 'full', '2099-01-17', '2099-01-17'),
  (tests.m14('e17'),  tests.id('member_t'),  'pto', 'full', '2099-01-18', '2099-01-18'),
  (tests.m14('e17b'), tests.id('member_t'),  'pto', 'full', '2099-01-19', '2099-01-19'),
  (tests.m14('e20'),  tests.id('member_t'),  'pto', 'full', '2099-01-20', '2099-01-20'),
  (tests.m14('e9a'),  tests.id('manager_t'), 'pto', 'full', '2099-01-10', '2099-01-10'),
  (tests.m14('e9b'),  tests.id('manager_t'), 'pto', 'full', '2099-01-11', '2099-01-11'),
  (tests.m14('e18a'), tests.id('manager_t'), 'pto', 'full', '2099-03-01', '2099-03-01'),
  (tests.m14('e18b'), tests.id('manager_t'), 'pto', 'full', '2099-03-05', '2099-03-05'),
  (tests.m14('e18c'), tests.id('manager_t'), 'pto', 'full', '2099-03-10', '2099-03-10'),
  (tests.m14('e10'),  tests.id('admin_t'),   'pto', 'full', '2099-01-10', '2099-01-10');

-- =============================================================================================
-- Part 1. `member_t` holds a second-team row on U.
-- =============================================================================================
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.org_a(), tests.id('team_u'), tests.id('member_t'), 'member', false);

-- ---------------------------------------------------------------------------------------------
-- AC-1. Any team requiring approval makes the entry wait.
-- ---------------------------------------------------------------------------------------------
update public.team set pto_need_approve = false where id = tests.id('team_t');
update public.team set pto_need_approve = true  where id = tests.id('team_u');
select tests.authenticate_as(tests.id('member_t'));
insert into public.entry (member_id, type, portion, start_date, end_date, note)
values (tests.id('member_t'), 'pto', 'full', '2099-02-01', '2099-02-01', 'mir14-ac1');
select is((tests.by_note('mir14-ac1')).status, 'pending'::public.entry_status,
  'AC-1: T does not require PTO approval, U does: the entry is pending');
select ok((tests.by_note('mir14-ac1')).approved_by is null and (tests.by_note('mir14-ac1')).approved_at is null,
  'AC-1: approved_by and approved_at are null');

-- ---------------------------------------------------------------------------------------------
-- AC-2. No team requiring approval auto-approves.
-- ---------------------------------------------------------------------------------------------
select tests.clear_authentication();
update public.team set pto_need_approve = false where id = tests.id('team_u');
select tests.authenticate_as(tests.id('member_t'));
insert into public.entry (member_id, type, portion, start_date, end_date, note)
values (tests.id('member_t'), 'pto', 'full', '2099-02-02', '2099-02-02', 'mir14-ac2');
select is((tests.by_note('mir14-ac2')).status, 'approved'::public.entry_status,
  'AC-2: neither team requires PTO approval: the entry is approved');
select ok((tests.by_note('mir14-ac2')).approved_by is null, 'AC-2: approved_by is null');
select ok((tests.by_note('mir14-ac2')).approved_at is not null, 'AC-2: approved_at is set');
select is((tests.by_note('mir14-ac2')).self_approved, false, 'AC-2: self_approved is false');

select tests.clear_authentication();
update public.team set pto_need_approve = true where id in (tests.id('team_t'), tests.id('team_u'));

-- ---------------------------------------------------------------------------------------------
-- AC-4. The manager of a second team decides, and the first decision is final for every team.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('manager_u'));
select is(tests.decide(tests.m14('e4'), 'approved'), 1::bigint,
  'AC-4: manager_u (manager of member_t''s second team) approves E');
select is((tests.e(tests.m14('e4'))).status, 'approved'::public.entry_status, 'AC-4: E is approved');
select is((tests.e(tests.m14('e4'))).approved_by, tests.id('manager_u'), 'AC-4: approved_by is manager_u');
select is((select count(*)::int from public.entry where id = tests.m14('e4')), 1,
  'AC-4: manager_u still selects E');
select is((select count(*)::int from public.entry where id = tests.m14('e4') and status = 'pending'), 0,
  'AC-4: manager_u does not find E among pending rows');
select tests.authenticate_as(tests.id('manager_t'));
select is((select count(*)::int from public.entry where id = tests.m14('e4')), 1,
  'AC-4: manager_t still selects E');
select is((select count(*)::int from public.entry where id = tests.m14('e4') and status = 'pending'), 0,
  'AC-4: manager_t does not find E among pending rows');

-- ---------------------------------------------------------------------------------------------
-- AC-12. A second approval changes nothing.
-- ---------------------------------------------------------------------------------------------
select is(tests.decide(tests.m14('e12'), 'approved'), 1::bigint, 'AC-12: manager_t approves E first');
select tests.authenticate_as(tests.id('manager_u'));
select tests.decide(tests.m14('e12'), 'approved');
select is((tests.e(tests.m14('e12'))).approved_by, tests.id('manager_t'),
  'AC-12: after manager_u approves too, approved_by is still manager_t');
-- `now()` is the transaction's clock, so within this file "unchanged" is "still the first stamp".
select is((tests.e(tests.m14('e12'))).approved_at, now(),
  'AC-12: approved_at is unchanged');

-- ---------------------------------------------------------------------------------------------
-- AC-13. Any rejection rejects.
-- ---------------------------------------------------------------------------------------------
select is(tests.decide(tests.m14('e12'), 'rejected', 'Trùng lịch'), 1::bigint,
  'AC-13: manager_u rejects E that manager_t approved');
select is((tests.e(tests.m14('e12'))).status, 'rejected'::public.entry_status, 'AC-13: E is rejected');
select is((tests.e(tests.m14('e12'))).rejected_by, tests.id('manager_u'), 'AC-13: rejected_by is manager_u');
select ok((tests.e(tests.m14('e12'))).approved_by is null and (tests.e(tests.m14('e12'))).approved_at is null,
  'AC-13: approved_by and approved_at are cleared');
select is((tests.e(tests.m14('e12'))).self_approved, false, 'AC-13: self_approved is false');

-- ---------------------------------------------------------------------------------------------
-- AC-14. A manager may not overturn another person's rejection.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('manager_t'));
select is(tests.decide(tests.m14('e14'), 'rejected', 'Trùng lịch'), 1::bigint, 'AC-14: manager_t rejects E');
select tests.authenticate_as(tests.id('manager_u'));
select throws_ok($$select tests.decide(tests.m14('e14'), 'approved')$$, '42501', null,
  'AC-14: manager_u approving E rejected by manager_t is refused with 42501');
select throws_ok($$select tests.decide(tests.m14('e14'), 'rejected', 'Lý do khác')$$, '42501', null,
  'AC-14: manager_u rewriting the reason is refused with 42501');
select is((tests.e(tests.m14('e14'))).status, 'rejected'::public.entry_status, 'AC-14: E is still rejected');
select is((tests.e(tests.m14('e14'))).rejection_reason, 'Trùng lịch', 'AC-14: the reason is unchanged');
select is((tests.e(tests.m14('e14'))).rejected_by, tests.id('manager_t'), 'AC-14: rejected_by is unchanged');

-- ---------------------------------------------------------------------------------------------
-- AC-15. The rejecter may change their own decision.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('manager_t'));
select is(tests.decide(tests.m14('e14'), 'rejected', 'Lý do mới'), 1::bigint,
  'AC-15: manager_t rewrites the reason on their own rejection');
select is((tests.e(tests.m14('e14'))).rejection_reason, 'Lý do mới', 'AC-15: the new reason stands');
select is((tests.e(tests.m14('e14'))).rejected_by, tests.id('manager_t'), 'AC-15: rejected_by is manager_t');
select ok((tests.e(tests.m14('e14'))).rejected_at is not null, 'AC-15: rejected_at is set');
select is(tests.decide(tests.m14('e14'), 'approved'), 1::bigint, 'AC-15: manager_t then approves E');
select is((tests.e(tests.m14('e14'))).status, 'approved'::public.entry_status, 'AC-15: E is approved');
select ok((tests.e(tests.m14('e14'))).rejected_by is null
      and (tests.e(tests.m14('e14'))).rejected_at is null
      and (tests.e(tests.m14('e14'))).rejection_reason is null,
  'AC-15: rejected_by, rejected_at and rejection_reason are null');

-- ---------------------------------------------------------------------------------------------
-- AC-16. An admin keeps every ADM-05 transition.
-- ---------------------------------------------------------------------------------------------
select tests.decide(tests.m14('e16'),  'rejected', 'Trùng lịch');
select tests.decide(tests.m14('e16b'), 'rejected', 'Trùng lịch');
select tests.authenticate_as(tests.id('admin_t'));
select is(tests.decide(tests.m14('e16'), 'approved'), 1::bigint, 'AC-16: admin_t approves E rejected by manager_t');
select is((tests.e(tests.m14('e16'))).approved_by, tests.id('admin_t'), 'AC-16: approved_by is admin_t');
select is(tests.decide(tests.m14('e16b'), 'rejected', 'Lý do của admin'), 1::bigint,
  'AC-16: admin_t rewrites the reason on a row manager_t rejected');
select is((tests.e(tests.m14('e16b'))).rejected_by, tests.id('admin_t'), 'AC-16: rejected_by is admin_t');

-- ---------------------------------------------------------------------------------------------
-- AC-20. A decider can read what they may decide, and nobody else gains a read.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('manager_u'));
select is((select count(*)::int from public.entry where id = tests.m14('e20')), 1,
  'AC-20: manager_u selects E of a member on their team by a second-team row');
select is((select count(*)::int from public.member where id = tests.id('member_t')), 0,
  'AC-20: the roster manager_u reads still does not contain member_t');
select tests.authenticate_as(tests.id('member_u'));
select is((select count(*)::int from public.entry where id = tests.m14('e20')), 0,
  'AC-20: member_u does not select E');
select tests.authenticate_as(tests.id('admin_u'));
select is((select count(*)::int from public.entry where id = tests.m14('e20')), 0,
  'AC-20: admin_u does not select E');

-- =============================================================================================
-- Part 2. `member_t` is on T only.
-- =============================================================================================
select tests.clear_authentication();
delete from public.membership
 where member_id = tests.id('member_t') and team_id = tests.id('team_u');

-- ---------------------------------------------------------------------------------------------
-- AC-3. A single-team member is unchanged (ADM-08).
-- ---------------------------------------------------------------------------------------------
update public.team set wfh_need_approve = false, pto_need_approve = true where id = tests.id('team_u');
select tests.authenticate_as(tests.id('member_u'));
insert into public.entry (member_id, type, portion, start_date, end_date, note) values
  (tests.id('member_u'), 'wfh', 'full', '2099-02-03', '2099-02-03', 'mir14-ac3-wfh'),
  (tests.id('member_u'), 'pto', 'full', '2099-02-04', '2099-02-04', 'mir14-ac3-pto');
select is((tests.by_note('mir14-ac3-wfh')).status, 'approved'::public.entry_status,
  'AC-3: member_u''s WFH entry is approved when U does not require WFH approval');
select is((tests.by_note('mir14-ac3-pto')).status, 'pending'::public.entry_status,
  'AC-3: member_u''s PTO entry is pending when U requires PTO approval');
select tests.clear_authentication();
update public.team set wfh_need_approve = true where id = tests.id('team_u');

-- ---------------------------------------------------------------------------------------------
-- AC-5. A decider's power is per team.
-- ---------------------------------------------------------------------------------------------
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.org_a(), tests.id('team_t'), tests.id('member_u2'), 'member', false);
select tests.authenticate_as(tests.id('member_u2'));
select is(tests.decide(tests.m14('e5'), 'approved'), 0::bigint,
  'AC-5: member_u2, a plain member on T, approving E changes no row');
select tests.authenticate_as(tests.id('manager_u'));
select is(tests.decide(tests.m14('e5'), 'approved'), 0::bigint,
  'AC-5: manager_u, sharing no team with member_t, approving E changes no row');
select is((tests.e(tests.m14('e5'))).status, 'pending'::public.entry_status, 'AC-5: E is still pending');

-- ---------------------------------------------------------------------------------------------
-- AC-6. A manager whose global role is manager decides only where they manage.
-- ---------------------------------------------------------------------------------------------
select tests.clear_authentication();
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.org_a(), tests.id('team_t'), tests.id('manager_u'), 'member', false);
select tests.authenticate_as(tests.id('manager_u'));
select is(tests.decide(tests.m14('e6'), 'approved'), 0::bigint,
  'AC-6: manager_u, a plain member on T, approving E changes no row');
select is((tests.e(tests.m14('e6'))).status, 'pending'::public.entry_status, 'AC-6: E stays pending');
select tests.clear_authentication();
delete from public.membership
 where (member_id, team_id) in ((tests.id('member_u2'), tests.id('team_t')),
                                (tests.id('manager_u'), tests.id('team_t')));

-- ---------------------------------------------------------------------------------------------
-- AC-7. A rejection records its rejecter.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('manager_t'));
select is(tests.decide(tests.m14('e7'), 'rejected', 'Trùng lịch'), 1::bigint, 'AC-7: manager_t rejects E');
select is((tests.e(tests.m14('e7'))).status, 'rejected'::public.entry_status, 'AC-7: E is rejected');
select is((tests.e(tests.m14('e7'))).rejected_by, tests.id('manager_t'), 'AC-7: rejected_by is manager_t');
select ok((tests.e(tests.m14('e7'))).rejected_at is not null, 'AC-7: rejected_at is set');
select ok((tests.e(tests.m14('e7'))).approved_by is null and (tests.e(tests.m14('e7'))).approved_at is null,
  'AC-7: approved_by and approved_at are null');
select is((tests.e(tests.m14('e7'))).self_approved, false, 'AC-7: self_approved is false');

-- ---------------------------------------------------------------------------------------------
-- AC-8. A batch rejection records its rejecter on every row.
-- ---------------------------------------------------------------------------------------------
select is(public.reject_entries(array[tests.m14('e8a'), tests.m14('e8b')], 'Trùng lịch'), 2,
  'AC-8: reject_entries over two pending entries returns 2');
select is((tests.e(tests.m14('e8a'))).rejected_by, tests.id('manager_t'), 'AC-8: first row rejected_by is manager_t');
select is((tests.e(tests.m14('e8b'))).rejected_by, tests.id('manager_t'), 'AC-8: second row rejected_by is manager_t');
select ok((tests.e(tests.m14('e8a'))).rejected_at is not null and (tests.e(tests.m14('e8b'))).rejected_at is not null,
  'AC-8: both rows carry rejected_at');

-- ---------------------------------------------------------------------------------------------
-- AC-9. A manager may decide their own entry, and it is recorded.
-- ---------------------------------------------------------------------------------------------
select is(tests.decide(tests.m14('e9a'), 'approved'), 1::bigint, 'AC-9: manager_t approves their own entry');
select is((tests.e(tests.m14('e9a'))).status, 'approved'::public.entry_status, 'AC-9: it is approved');
select is((tests.e(tests.m14('e9a'))).approved_by, tests.id('manager_t'), 'AC-9: approved_by is manager_t');
select is((tests.e(tests.m14('e9a'))).self_approved, true, 'AC-9: self_approved is true');
select is(tests.decide(tests.m14('e9b'), 'rejected', 'Trùng lịch'), 1::bigint,
  'AC-9: manager_t rejects a second own entry');
select is((tests.e(tests.m14('e9b'))).rejected_by, tests.id('manager_t'), 'AC-9: rejected_by is manager_t');
select is((tests.e(tests.m14('e9b'))).self_approved, false, 'AC-9: a self-rejection is not self_approved');

-- ---------------------------------------------------------------------------------------------
-- AC-10. An admin's self-approval is recorded too.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select is(tests.decide(tests.m14('e10'), 'approved'), 1::bigint, 'AC-10: admin_t approves their own entry');
select is((tests.e(tests.m14('e10'))).self_approved, true, 'AC-10: self_approved is true');

-- ---------------------------------------------------------------------------------------------
-- AC-11. `self_approved` is only ever about the current approval.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('manager_t'));
select tests.decide(tests.m14('e11'), 'approved');
select is((tests.e(tests.m14('e11'))).self_approved, false,
  'AC-11: member_t''s entry approved by manager_t is not self_approved');
select tests.authenticate_as(tests.id('admin_t'));
select is(tests.decide(tests.m14('e9a'), 'rejected', 'Trùng lịch'), 1::bigint,
  'AC-11: admin_t rejects manager_t''s self-approved entry');
select is((tests.e(tests.m14('e9a'))).self_approved, false, 'AC-11: self_approved is false after the rejection');

-- ---------------------------------------------------------------------------------------------
-- AC-18. INV-02 clears every decision record.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('manager_t'));
select tests.decide(tests.m14('e18a'), 'approved');
select tests.decide(tests.m14('e18c'), 'approved');
select tests.authenticate_as(tests.id('admin_t'));
select tests.decide(tests.m14('e18b'), 'rejected', 'Trùng lịch');
select is((tests.e(tests.m14('e18a'))).self_approved, true, 'AC-18: precondition, E is self-approved');
select is((tests.e(tests.m14('e18b'))).rejected_by, tests.id('admin_t'), 'AC-18: precondition, F has rejected_by');
select tests.authenticate_as(tests.id('manager_t'));
select is(tests.rows_affected(format('update public.entry set end_date = %L where id = %L',
                                     '2099-03-02', tests.m14('e18a'))), 1::bigint,
  'AC-18: the owner changes end_date on E');
select is(tests.rows_affected(format('update public.entry set end_date = %L where id = %L',
                                     '2099-03-06', tests.m14('e18b'))), 1::bigint,
  'AC-18: the owner changes end_date on F');
select is((tests.e(tests.m14('e18a'))).status, 'pending'::public.entry_status, 'AC-18: E is pending');
select is((tests.e(tests.m14('e18b'))).status, 'pending'::public.entry_status, 'AC-18: F is pending');
select ok(e.approved_by is null and e.approved_at is null and e.rejection_reason is null
          and e.rejected_by is null and e.rejected_at is null and e.self_approved = false,
  'AC-18: every decision column of E is cleared')
  from tests.e(tests.m14('e18a')) e;
select ok(e.approved_by is null and e.approved_at is null and e.rejection_reason is null
          and e.rejected_by is null and e.rejected_at is null and e.self_approved = false,
  'AC-18: every decision column of F is cleared')
  from tests.e(tests.m14('e18b')) e;
select is(tests.rows_affected(format('update public.entry set note = %L where id = %L',
                                     'chỉ ghi chú', tests.m14('e18c'))), 1::bigint,
  'AC-18: the owner changes only note on an approved entry');
select ok(e.status = 'approved' and e.approved_by = tests.id('manager_t') and e.self_approved,
  'AC-18: a note-only change moves nothing else')
  from tests.e(tests.m14('e18c')) e;

-- ---------------------------------------------------------------------------------------------
-- AC-19. The wire cannot write the new columns.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('member_t'));
select throws_ok(format($$insert into public.entry (member_id, type, portion, start_date, end_date, rejected_by)
                          values (%L, 'pto', 'full', '2099-04-01', '2099-04-01', %L)$$,
                        tests.id('member_t'), tests.id('member_t')),
  '42501', null, 'AC-19: an insert naming rejected_by is refused with 42501');
select throws_ok(format($$insert into public.entry (member_id, type, portion, start_date, end_date, rejected_at)
                          values (%L, 'pto', 'full', '2099-04-02', '2099-04-02', now())$$,
                        tests.id('member_t')),
  '42501', null, 'AC-19: an insert naming rejected_at is refused with 42501');
select throws_ok(format($$insert into public.entry (member_id, type, portion, start_date, end_date, self_approved)
                          values (%L, 'pto', 'full', '2099-04-03', '2099-04-03', true)$$,
                        tests.id('member_t')),
  '42501', null, 'AC-19: an insert naming self_approved is refused with 42501');
select throws_ok(format('update public.entry set rejected_by = %L where id = %L',
                        tests.id('member_t'), tests.id('entry_t')),
  '42501', null, 'AC-19: a patch of rejected_by is refused with 42501');
select throws_ok(format('update public.entry set rejected_at = now() where id = %L', tests.id('entry_t')),
  '42501', null, 'AC-19: a patch of rejected_at is refused with 42501');
select throws_ok(format('update public.entry set self_approved = true where id = %L', tests.id('entry_t')),
  '42501', null, 'AC-19: a patch of self_approved is refused with 42501');

-- ---------------------------------------------------------------------------------------------
-- AC-17. The fallback is the team's admin. Last, because it demotes manager_t.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select lives_ok(format('select public.set_member_role(%L, %L)', tests.id('manager_t'), 'member'),
  'AC-17: admin_t demotes manager_t, leaving T with no active manager');
select tests.clear_authentication();
select is((select count(*)::int from public.membership
            where team_id = tests.id('team_t') and left_at is null and team_role = 'manager'), 0,
  'AC-17: T has no active manager');
select tests.authenticate_as(tests.id('admin_t'));
select is(tests.decide(tests.m14('e17'), 'approved'), 1::bigint, 'AC-17: admin_t approves E');
select is((tests.e(tests.m14('e17'))).approved_by, tests.id('admin_t'), 'AC-17: approved_by is admin_t');
select tests.authenticate_as(tests.id('admin_u'));
select is(tests.decide(tests.m14('e17b'), 'approved'), 0::bigint,
  'AC-17: admin_u (same org, no shared team) approving E changes no row');
select is((tests.e(tests.m14('e17b'))).status, 'pending'::public.entry_status, 'AC-17: that entry stays pending');

-- ---------------------------------------------------------------------------------------------
-- The catalogue half: the helper is definer, revoked from anon, and the policies exist.
-- ---------------------------------------------------------------------------------------------
select tests.clear_authentication();
select ok(not has_function_privilege('anon', 'public.may_decide_entry(uuid, uuid)', 'EXECUTE'),
  'AC-19: anon does not execute may_decide_entry');
select ok((select p.prosecdef from pg_catalog.pg_proc p
            where p.oid = 'public.entry_apply_approval_setting()'::regprocedure),
  'AC-1: entry_apply_approval_setting is security definer');
select policies_are('public', 'entry',
  array['entry_select_team', 'entry_select_decider', 'entry_insert_own', 'entry_update_own',
        'entry_update_admin', 'entry_update_manager', 'entry_delete_own', 'entry_delete_admin'],
  'AC-20: entry carries exactly the eight policies, entry_select_decider among them');

select * from finish();
rollback;
