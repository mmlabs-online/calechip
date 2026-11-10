-- MIR-13 AC-11 to AC-16 and AC-18: every admin-gated write is bounded by the caller's org, "same
-- team" on a write path means "share an active team", and a team-level setting writes only the
-- caller's primary team (ADR-071 decisions 3 and 4).
--
-- Org A is the shared tenant the seed lives in; Admin A is `admin_t` on `team_t` (T1), and T3 is
-- `team_u`. Org B, T2, M2, P2, E2, H2, R2 and V2 are this file's (01-plan.md § 2).
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(46);
select tests.seed();

create function tests.m13(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('b1500000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('org_b', 'b0'), ('team_2', 'b2'), ('m2', 'c2'), ('p2', 'd2'),
      ('entry_2', 'e1'), ('holiday_2', 'e3'), ('report_2', 'e4'), ('event_2', 'e2'),
      ('event_1', 'a1'), ('member_n_entry', 'a3')
    ) as v(label, nn)
   where v.label = p_label;
$$;

-- Definer: it is read while authenticated, and `authenticated` holds no grant on `public.org`.
create function tests.org_a() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

-- Org B, as the owner.
insert into public.org (id, org_code, name) values (tests.m13('org_b'), 'org-b-mir13-150', 'Org B');
insert into public.team (id, name, org_id) values (tests.m13('team_2'), 'Team 2', tests.m13('org_b'));
insert into auth.users (id, email) values
  (tests.m13('m2'), 'm2@mir13-150.test'),
  (tests.m13('p2'), 'p2@mir13-150.test');
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m13('m2'), tests.m13('org_b'), 'M2', '1.png', 'member', 'approved', 'm2@mir13-150.test');
select tests.put_on_team(tests.m13('m2'), tests.m13('team_2'));
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m13('p2'), tests.m13('org_b'), 'P2', '1.png', 'member', 'pending', 'p2@mir13-150.test');
insert into public.entry (id, member_id, type, portion, start_date, end_date) values
  (tests.m13('entry_2'), tests.m13('m2'), 'pto', 'full', '2099-07-01', '2099-07-01');
insert into public.holiday (id, date, name, org_id) values
  (tests.m13('holiday_2'), '2099-07-02', 'H2', tests.m13('org_b'));
insert into public.issue_report (id, member_id, kind, message, page) values
  (tests.m13('report_2'), tests.m13('m2'), 'bug', 'R2', '/');
insert into public.event (id, creator_id, name, start_date, end_date, scope) values
  (tests.m13('event_2'), tests.m13('m2'), 'V2', current_date + 10, current_date + 11, 'public');

-- ---------------------------------------------------------------------------------------------
-- AC-18. The helpers are callable by `authenticated` and not by `public`.
-- ---------------------------------------------------------------------------------------------
select ok(
  has_function_privilege('authenticated', 'public.member_org_id(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.member_team_ids(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.member_primary_team_id(uuid)', 'EXECUTE')
  and has_function_privilege('authenticated', 'public.shares_active_team(uuid,uuid)', 'EXECUTE'),
  'AC-18: authenticated executes the four helpers'
);
select is_empty(
  $$select p.oid::regprocedure::text
      from pg_catalog.pg_proc p, aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) a
     where p.oid in ('public.member_org_id(uuid)'::regprocedure,
                     'public.member_team_ids(uuid)'::regprocedure,
                     'public.member_primary_team_id(uuid)'::regprocedure,
                     'public.shares_active_team(uuid,uuid)'::regprocedure)
       and a.grantee = 0$$,
  'AC-18: none of the four helpers is granted to public'
);

-- ---------------------------------------------------------------------------------------------
-- AC-11. The two setters' statements reach only the caller's primary team. Admin A also holds an
-- active non-primary row on T3.
-- ---------------------------------------------------------------------------------------------
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.org_a(), tests.id('team_u'), tests.id('admin_t'), 'member', false);

select tests.authenticate_as(tests.id('admin_t'));
select is(
  tests.rows_affected($$update public.team set overload_threshold = 0.3 where id is not null$$),
  1::bigint,
  'AC-11: setOverloadThreshold''s statement updates exactly one row'
);
select is(
  tests.rows_affected($$update public.team set wfh_need_approve = false, pto_need_approve = false where id is not null$$),
  1::bigint,
  'AC-11: setApprovalSettings''s statement updates exactly one row'
);
select tests.clear_authentication();
select results_eq(
  $$select overload_threshold::numeric, wfh_need_approve, pto_need_approve from public.team where id = tests.id('team_t')$$,
  $$values (0.3::numeric, false, false)$$,
  'AC-11: the row written is T1, Admin A''s primary team'
);
select results_eq(
  $$select overload_threshold::numeric, wfh_need_approve, pto_need_approve from public.team where id = tests.id('team_u')$$,
  $$values (0.5::numeric, true, true)$$,
  'AC-11: T3''s three columns are unchanged'
);

-- ---------------------------------------------------------------------------------------------
-- AC-12. Every admin-gated definer function refuses a target in another org.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select throws_ok($$select public.admit_member(tests.m13('p2'), tests.m13('team_2'))$$, '42501', null,
  'AC-12: admit_member(P2, T2) is refused with 42501');
select throws_ok($$select public.admit_member(tests.m13('p2'), tests.id('team_t'))$$, '42501', null,
  'AC-12: admit_member(P2, T1) is refused with 42501');
select throws_ok($$select public.reject_member(tests.m13('p2'))$$, '42501', null,
  'AC-12: reject_member(P2) is refused with 42501');
select throws_ok($$select public.move_member(tests.m13('m2'), tests.id('team_t'))$$, '42501', null,
  'AC-12: move_member(M2, T1) is refused with 42501');
select throws_ok($$select public.rename_team(tests.m13('team_2'), 'x')$$, '42501', null,
  'AC-12: rename_team(T2, ''x'') is refused with 42501');
select throws_ok($$select public.delete_team(tests.m13('team_2'))$$, '42501', null,
  'AC-12: delete_team(T2) is refused with 42501, though T2 has people on it');
select throws_ok($$select public.set_member_role(tests.m13('m2'), 'manager')$$, '42501', null,
  'AC-12: set_member_role(M2, manager) is refused with 42501');
select throws_ok($$select public.promote_member_to_admin(tests.m13('m2'))$$, '42501', null,
  'AC-12: promote_member_to_admin(M2) is refused with 42501');
select throws_ok($$select public.set_member_team(tests.m13('m2'), tests.m13('team_2'))$$, '42501', null,
  'AC-12: set_member_team(M2, T2) is refused with 42501');
select is((select (public.create_team('New')).org_id), tests.org_a(),
  'AC-12: create_team(''New'') returns a team in Org A');
select tests.clear_authentication();

select results_eq(
  $$select status::text, public.member_roster_team_id(id) from public.member where id = tests.m13('p2')$$,
  $$values ('pending'::text, null::uuid)$$,
  'AC-12: P2 is unchanged'
);
select results_eq(
  $$select public.member_roster_team_id(id), role::text from public.member where id = tests.m13('m2')$$,
  $$values (tests.m13('team_2'), 'member'::text)$$,
  'AC-12: M2 is unchanged'
);
select is((select name from public.team where id = tests.m13('team_2')), 'Team 2',
  'AC-12: T2 still exists under its name');

-- ---------------------------------------------------------------------------------------------
-- AC-13. Every admin-gated write policy admits no row of another org.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select is(tests.rows_affected($$update public.entry set note = 'x' where id = tests.m13('entry_2')$$),
  0::bigint, 'AC-13: updating E2 affects zero rows');
select is(tests.rows_affected($$delete from public.entry where id = tests.m13('entry_2')$$),
  0::bigint, 'AC-13: deleting E2 affects zero rows');
select is(tests.rows_affected($$update public.holiday set name = 'x' where id = tests.m13('holiday_2')$$),
  0::bigint, 'AC-13: updating H2 affects zero rows');
select is(tests.rows_affected($$delete from public.holiday where id = tests.m13('holiday_2')$$),
  0::bigint, 'AC-13: deleting H2 affects zero rows');
select is(tests.rows_affected($$update public.issue_report set status = 'done' where id = tests.m13('report_2')$$),
  0::bigint, 'AC-13: updating R2 affects zero rows');
select is(tests.rows_affected($$update public.member set removed_at = now() where id = tests.m13('m2')$$),
  0::bigint, 'AC-13: updating M2 through member_update_admin affects zero rows');
-- `status` and `team_id` are not granted to authenticated (MIR-02), so a decision by update is
-- reached only through member_decide_admin's `using`; a granted column is the probe.
select is(tests.rows_affected($$update public.member set display_name = 'x' where id = tests.m13('p2')$$),
  0::bigint, 'AC-13: deciding P2 through member_decide_admin affects zero rows');
select is(tests.rows_affected($$update public.event set name = 'x' where id = tests.m13('event_2')$$),
  0::bigint, 'AC-13: updating V2 affects zero rows');
select is(tests.rows_affected($$delete from public.event where id = tests.m13('event_2')$$),
  0::bigint, 'AC-13: deleting V2 affects zero rows');
select throws_ok(
  $$insert into public.holiday (date, name, org_id) values ('2099-07-03', 'into B', tests.m13('org_b'))$$,
  '42501', null,
  'AC-13: inserting a holiday with org_id = Org B is refused with 42501'
);
select throws_ok(
  $$insert into public.holiday (date, name) values ('2099-07-04', 'no org')$$,
  '42501', null,
  'AC-13: inserting a holiday into Org A is refused — MIR-15-b, ADR-079 decision 2'
);
select tests.clear_authentication();
select is((select count(*)::int from public.holiday where date = '2099-07-04'), 0,
  'AC-13: and no row lands on 2099-07-04 — MIR-15-b, ADR-079 decision 2');

select results_eq(
  $$select note, (select count(*)::int from public.entry where id = tests.m13('entry_2'))
      from public.entry where id = tests.m13('entry_2')$$,
  $$values (null::text, 1)$$,
  'AC-13: E2 is unchanged'
);
select is((select name from public.holiday where id = tests.m13('holiday_2')), 'H2', 'AC-13: H2 is unchanged');
select is((select status::text from public.issue_report where id = tests.m13('report_2')), 'open',
  'AC-13: R2 is unchanged');
select results_eq(
  $$select removed_at, display_name from public.member where id = tests.m13('m2')$$,
  $$values (null::timestamptz, 'M2'::text)$$,
  'AC-13: M2 is unchanged'
);
select is((select display_name from public.member where id = tests.m13('p2')), 'P2', 'AC-13: P2 is unchanged');
select is((select name from public.event where id = tests.m13('event_2')), 'V2', 'AC-13: V2 is unchanged');

-- ---------------------------------------------------------------------------------------------
-- AC-14. On a write path, "same team" is "share an active team". K is manager_t (T1); N is
-- member_u (T3), whose entry is entry_u.
-- ---------------------------------------------------------------------------------------------
-- `entry_select_team` still reads `member_team_id` until MIR-13-b, so N's entry is not a row K can
-- see however a write policy answers, and both decisions below would affect zero rows for that reason
-- alone. Visibility of that one row is lent by a permissive select policy that names it, inside this
-- rolled-back transaction, so entry_update_manager is the only thing deciding each answer.
create policy mir13_test_lend_visibility on public.entry
  for select to authenticated using (id = tests.id('entry_u'));

select tests.authenticate_as(tests.id('manager_t'));
select is(tests.rows_affected($$update public.entry set status = 'approved' where id = tests.id('entry_u')$$),
  0::bigint, 'AC-14: K approving N''s entry through entry_update_manager affects zero rows');
select tests.clear_authentication();

insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.org_a(), tests.id('team_t'), tests.id('member_u'), 'member', false);

select tests.authenticate_as(tests.id('manager_t'));
select is(tests.rows_affected($$update public.entry set status = 'approved' where id = tests.id('entry_u')$$),
  1::bigint, 'AC-14: once N also holds an active row on T1, the same update affects one row');
select tests.clear_authentication();
drop policy mir13_test_lend_visibility on public.entry;

-- ---------------------------------------------------------------------------------------------
-- AC-15. Event management is bounded by org.
-- ---------------------------------------------------------------------------------------------
select is(public.may_manage_event(tests.m13('event_2'), tests.id('admin_t')), false,
  'AC-15: may_manage_event(V2, Admin A) is false');
select is(public.is_event_audience(tests.m13('event_2'), tests.id('admin_t')), false,
  'AC-15: is_event_audience(V2, Admin A) is false, though V2 is public');
select tests.authenticate_as(tests.id('admin_t'));
select throws_ok($$select * from public.invite_to_event(tests.m13('event_2'), array['x@example.com'])$$,
  '42501', null,
  'AC-15: invite_to_event(V2, ...) is refused with 42501');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-16. Another org's member is an outsider to invite_to_event. V1 is a named event of Org A that
-- Admin A manages.
-- ---------------------------------------------------------------------------------------------
insert into public.event (id, creator_id, name, start_date, end_date, scope) values
  (tests.m13('event_1'), tests.id('admin_t'), 'V1', current_date + 10, current_date + 11, 'named');
select tests.authenticate_as(tests.id('admin_t'));
select results_eq(
  $$select outcome from public.invite_to_event(tests.m13('event_1'), array['m2@mir13-150.test'])$$,
  $$values ('sent'::text)$$,
  'AC-16: inviting M2''s address to V1 answers sent'
);
select tests.clear_authentication();
select is(
  (select count(*)::int from public.event_email_invitation
    where event_id = tests.m13('event_1') and lower(email) = 'm2@mir13-150.test'),
  1,
  'AC-16: an event_email_invitation row exists for that address'
);
select is(
  (select count(*)::int from public.event_invitee
    where event_id = tests.m13('event_1') and member_id = tests.m13('m2')),
  0,
  'AC-16: and no event_invitee row exists for M2'
);
select is(
  (select count(*)::int from public.event_guest_link where event_id = tests.m13('event_1')),
  1,
  'AC-16: the outsider path opened V1''s guest link'
);

select * from finish();
rollback;
