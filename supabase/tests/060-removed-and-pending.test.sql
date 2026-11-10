-- MIR-06 AC-7 and AC-8: a removed member, a removed admin and a pending sign-up read nothing — no
-- table row but their own `member` row, and no RPC result. The holiday calendar is global by design
-- and is not asserted (01-plan.md § 2, assumption 1). With AC-13 controls. 01-plan.md § 4.4.
begin;
\ir _isolation.psql
select plan(86);
select tests.seed();

create function tests.reads_nothing(p_label text) returns setof text
  language plpgsql security invoker set search_path = extensions, pg_catalog as $$
declare
  v_table text;
begin
  perform tests.authenticate_as(tests.id(p_label));
  foreach v_table in array array['entry', 'team', 'busy_day', 'event', 'event_attendance',
                                 'event_invitee', 'event_guest', 'event_guest_link',
                                 'event_email_invitation', 'notification', 'task', 'issue_report'] loop
    return next is_empty(format('select 1 from public.%I', v_table),
                         format('AC-7/8 %s: public.%s returns no row', p_label, v_table));
  end loop;
  return next results_eq('select id from public.member', format('values (%L::uuid)', tests.id(p_label)),
                         format('AC-7/8 %s: public.member returns exactly their own row', p_label));
  return next is_empty('select 1 from public.list_teams()',
                       format('AC-7/8 %s: list_teams() is empty', p_label));
  return next is_empty('select 1 from public.list_all_members()',
                       format('AC-7/8 %s: list_all_members() is empty', p_label));
  return next is_empty(format('select 1 from public.list_members_for_team(%L)', tests.id('team_t')),
                       format('AC-7/8 %s: list_members_for_team(T) is empty', p_label));
  return next is_empty(format('select 1 from public.list_team_entries_for_team(%L)', tests.id('team_t')),
                       format('AC-7/8 %s: list_team_entries_for_team(T) is empty', p_label));
  return next is_empty(format('select 1 from public.list_team_entries_overlapping_for_team(%L, %L, %L)',
                              tests.id('team_t'), '2026-11-01', '2026-11-30'),
                       format('AC-7/8 %s: list_team_entries_overlapping_for_team(T, November) is empty', p_label));
  return next is_empty('select 1 from public.list_member_directory()',
                       format('AC-7/8 %s: list_member_directory() is empty', p_label));
  return next is_empty(format('select 1 from public.list_event_guest_emails(%L)', tests.id('event_t_public')),
                       format('AC-7/8 %s: list_event_guest_emails(event_t_public) is empty', p_label));
  return next is(public.guest_link_event_id(repeat('a', 64)), null::uuid,
                 format('AC-7/8 %s: guest_link_event_id(event_t''s token) is null', p_label));
  return next throws_ok('select * from public.member_role_change', '42501', null,
                        format('AC-7/8 %s: select on member_role_change raises 42501', p_label));
  perform tests.clear_authentication();
end;
$$;

select tests.authenticate_as(tests.id('removed_t'));
select is(current_user::text, 'authenticated', 'runs as authenticated');
select tests.clear_authentication();

-- AC-7: removed, rank member — including the task and notification addressed to them.
select * from tests.reads_nothing('removed_t');
-- AC-7: removed, rank admin.
select * from tests.reads_nothing('removed_admin_t');
-- AC-8: a pending sign-up, team_id null.
select * from tests.reads_nothing('pending_p');

-- AC-13 controls: every table and RPC above returns rows to an entitled caller on the same fixture.
create function tests.reads_something(p_label text, p_tables text[]) returns setof text
  language plpgsql security invoker set search_path = extensions, pg_catalog as $$
declare
  v_table text;
begin
  perform tests.authenticate_as(tests.id(p_label));
  foreach v_table in array p_tables loop
    return next isnt_empty(format('select 1 from public.%I', v_table),
                           format('AC-13 control %s: public.%s returns rows', p_label, v_table));
  end loop;
  perform tests.clear_authentication();
end;
$$;

-- `issue_report` came out of this control at MIR-16 (ADR-082): an org admin now reads none, even on
-- their own fixture. The control that a report is readable by somebody entitled is now
-- 270-issue-reports-system-scope.test.sql's AC-4. Re-plan of 2026-11-07, review finding 1
-- (04-review.md).
select * from tests.reads_something('admin_t',
  array['entry', 'team', 'busy_day', 'event', 'event_attendance', 'event_invitee', 'event_guest',
        'event_guest_link', 'event_email_invitation']);
select * from tests.reads_something('member_t', array['notification', 'task']);

select tests.authenticate_as(tests.id('admin_t'));
select isnt_empty('select 1 from public.list_teams()', 'AC-13 control admin_t: list_teams() returns rows');
select isnt_empty('select 1 from public.list_all_members()', 'AC-13 control admin_t: list_all_members() returns rows');
select isnt_empty($$select 1 from public.list_members_for_team(tests.id('team_t'))$$,
                  'AC-13 control admin_t: list_members_for_team(T) returns rows');
select isnt_empty($$select 1 from public.list_team_entries_for_team(tests.id('team_t'))$$,
                  'AC-13 control admin_t: list_team_entries_for_team(T) returns rows');
select isnt_empty($$select 1 from public.list_team_entries_overlapping_for_team(tests.id('team_t'), '2026-11-01', '2026-11-30')$$,
                  'AC-13 control admin_t: list_team_entries_overlapping_for_team(T, November) returns rows');

select tests.authenticate_as(tests.id('member_t'));
select isnt_empty('select 1 from public.list_member_directory()',
                  'AC-13 control member_t: list_member_directory() returns rows');
select isnt_empty($$select 1 from public.list_event_guest_emails(tests.id('event_t_public'))$$,
                  'AC-13 control member_t (creator): list_event_guest_emails(event_t_public) returns rows');
select is(public.guest_link_event_id(repeat('a', 64)), tests.id('event_t'),
          'AC-13 control member_t: guest_link_event_id(event_t''s token) is event_t');

select * from finish();
rollback;
