-- MIR-06 AC-10 (privilege half) and AC-12: which functions `anon` may execute, and the census of
-- every `security definer` function in `public`. 01-plan.md §§ 4.5, 4.6.
begin;
\ir _isolation.psql
-- regprocedure text is printed schema-qualified only when the schema is off the search path; with
-- `public` off it, every name below is `public.`-qualified whatever the caller's session path is.
set local search_path = extensions;
select plan(5);
select tests.seed();

select tests.authenticate_anon();
select is(current_user::text, 'anon', 'the catalogue is read as anon');

-- AC-12. A census, not a requirement: a definer function a later migration adds fails here until it
-- is classified in 01-plan.md § 4.5 and in this list.
select set_eq(
  $$select p.oid::regprocedure::text from pg_catalog.pg_proc p
     where p.pronamespace = 'public'::regnamespace and p.prosecdef$$,
  array[
    -- RPCs, called in 070-definer-callers.test.sql
    'public.list_teams()',
    'public.list_all_members()',
    'public.create_team(text)',
    'public.rename_team(uuid,text)',
    'public.delete_team(uuid)',
    'public.admit_member(uuid,uuid)',
    'public.reject_member(uuid)',
    'public.move_member(uuid,uuid)',
    'public.set_member_team(uuid,uuid)',
    'public.set_member_role(uuid,text)',
    'public.promote_member_to_admin(uuid)',
    'public.list_members_for_team(uuid)',
    'public.list_team_entries_for_team(uuid)',
    'public.list_team_entries_overlapping_for_team(uuid,date,date)',
    'public.list_member_directory()',
    'public.set_event_email(boolean)',
    'public.invite_to_event(uuid,text[])',
    'public.list_event_guest_emails(uuid)',
    'public.guest_link_event_id(text)',
    -- predicates, covered by the anon check below
    'public.is_org_admin(uuid,uuid)',
    'public.is_event_invitee(uuid,uuid)',
    'public.may_manage_event(uuid,uuid)',
    'public.event_registration_open(uuid)',
    'public.is_event_audience(uuid,uuid)',
    'public.is_event_participant(uuid,uuid)',
    'public.may_read_event(uuid,uuid)',
    'public.notify(uuid[],public.notification_kind,uuid,text)',
    -- MIR-13 helpers, 150-write-path-org-bound.test.sql AC-18
    'public.member_org_id(uuid)',
    'public.member_team_ids(uuid)',
    'public.member_primary_team_id(uuid)',
    'public.shares_active_team(uuid,uuid)',
    -- MIR-21 helper, 220-roster-team-from-membership.test.sql
    'public.member_roster_team_id(uuid)',
    -- MIR-16-c helper, 310-manager-read-from-membership.test.sql. roster_team_role(public.member)
    -- is invoker and is not a security definer, so it is not in this census.
    'public.member_roster_team_role(uuid)',
    -- MIR-17-d helper, 340-manages-a-team.test.sql. manages_a_team(public.member) is invoker and
    -- is not a security definer, so it is not in this census.
    'public.member_manages_a_team(uuid)',
    -- MIR-14 helper, 170-multi-team-decisions.test.sql
    'public.may_decide_entry(uuid,uuid)',
    -- MIR-14-b RPC, 180-entry-owners.test.sql
    'public.list_entry_owners(uuid[])',
    -- MIR-18-b RPCs, 200-org-management.test.sql
    'public.list_orgs()',
    'public.create_org(text,text,text)',
    'public.update_org(uuid,text,integer,integer,text,date)',
    -- MIR-15 helper, 210-org-public-team-bound.test.sql
    'public.org_is_shared(uuid)',
    -- MIR-15-b RPCs, 240-org-public-holidays.test.sql
    'public.list_national_holidays(date,date)',
    'public.add_national_holiday(date,text,public.holiday_kind)',
    'public.update_national_holiday(uuid,date,text,public.holiday_kind)',
    'public.delete_national_holiday(uuid)',
    -- MIR-16 RPCs, 270-issue-reports-system-scope.test.sql
    'public.list_issue_reports()',
    'public.set_issue_report_status(uuid,public.issue_status)',
    -- guest functions, 080-guest-tokens.test.sql
    'public.get_guest_event(text)',
    'public.list_guest_event_attendees(text)',
    'public.get_guest_event_terms(text)',
    'public.register_guest(text,text,text)',
    'public.get_guest_registration(text)',
    'public.cancel_guest_registration(text)',
    -- triggers, classified and not called
    'public.admit_allow_listed_member()',
    'public.sync_member_last_sign_in()',
    'public.sync_member_email()',
    'public.member_record_role_change()',
    'public.event_stamp()',
    'public.event_attendance_guard()',
    'public.event_capacity_guard()',
    'public.event_guest_guard()',
    'public.notify_event_created()',
    'public.notify_event_updated()',
    'public.notify_event_cancelled()',
    'public.notify_event_invited()',
    'public.notify_attendance_inserted()',
    'public.notify_attendance_changed()',
    'public.notify_attendance_deleted()',
    'public.email_notification()',
    'public.email_invitation()',
    -- MIR-13 triggers, 140-org-stamping-and-membership-mirror.test.sql
    'public.member_sync_membership()',
    'public.stamp_org_id()',
    -- MIR-14 trigger, 170-multi-team-decisions.test.sql AC-1 to AC-3
    'public.entry_apply_approval_setting()'
  ],
  'AC-12: every security definer function in public is classified by the suite'
);

-- AC-10, privilege half. rbac-and-security.md § Signed out: exactly six.
select todo('MIR-06 finding F-1: anon holds EXECUTE on 18 non-guest public functions (Supabase default privileges; only `from public` was revoked)', 1);
select set_eq(
  $$select p.oid::regprocedure::text from pg_catalog.pg_proc p
     where p.pronamespace = 'public'::regnamespace
       and p.prorettype <> 'trigger'::regtype
       and has_function_privilege('anon', p.oid, 'EXECUTE')$$,
  array[
    'public.get_guest_event(text)',
    'public.list_guest_event_attendees(text)',
    'public.get_guest_event_terms(text)',
    'public.register_guest(text,text,text)',
    'public.get_guest_registration(text)',
    'public.cancel_guest_registration(text)'
  ],
  'AC-10: anon executes exactly the six guest functions'
);

select ok(
  not has_function_privilege('anon', 'public.notify(uuid[], public.notification_kind, uuid, text)', 'EXECUTE'),
  'AC-10: anon does not execute notify(...)'
);
select ok(
  not has_function_privilege('authenticated', 'public.notify(uuid[], public.notification_kind, uuid, text)', 'EXECUTE'),
  'AC-10: authenticated does not execute notify(...)'
);

select * from finish();
rollback;
