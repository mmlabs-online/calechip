-- MIR-06 AC-9, with AC-13 controls: every callable `security definer` RPC refuses the caller who
-- should not reach it, exactly as 01-plan.md § 4.5's table states. Where an RPC writes, the target is
-- re-read as the table owner afterwards. Also the cross-team-reads.test.ts rows of the § 4.7 mirror.
begin;
\ir _isolation.psql
select plan(73);
select tests.seed();

-- Runs p_sql as each caller and asserts one refusal form: 'raises' (42501), 'empty' (no row) or
-- 'null' (a scalar that is null).
create function tests.refused(p_callers text[], p_sql text, p_form text, p_what text) returns setof text
  language plpgsql security invoker set search_path = extensions, pg_catalog as $$
declare
  v_caller text;
  v_desc   text;
begin
  foreach v_caller in array p_callers loop
    perform tests.authenticate_as(tests.id(v_caller));
    v_desc := format('AC-9 %s: %s %s', v_caller, p_what,
                     case p_form when 'raises' then 'raises 42501' when 'empty' then 'is empty'
                                 else 'is null' end);
    if p_form = 'raises' then
      return next throws_ok(p_sql, '42501', null, v_desc);
    elsif p_form = 'empty' then
      return next is_empty(p_sql, v_desc);
    else
      return next results_eq(p_sql, 'values (null::text)', v_desc);
    end if;
    perform tests.clear_authentication();
  end loop;
end;
$$;

select tests.authenticate_as(tests.id('member_t'));
select is(current_user::text, 'authenticated', 'runs as authenticated');
select tests.clear_authentication();

-- Team and member administration. M = member_t, Mg = manager_t, RA = removed_admin_t, AT = admin_t.
select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t'],
  'select 1 from public.list_teams()', 'empty', 'list_teams()');
select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t'],
  'select 1 from public.list_all_members()', 'empty', 'list_all_members()');

select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t'],
  $$select public.create_team('x')$$, 'raises', 'create_team(x)');
select is((select count(*) from public.team), 2::bigint, 'AC-9: create_team added no team');

select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t'],
  $$select public.rename_team(tests.id('team_u'), 'x')$$, 'raises', 'rename_team(U, x)');
select is((select name from public.team where id = tests.id('team_u')), 'Team U',
          'AC-9: rename_team left U''s name unchanged');

select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t'],
  $$select public.delete_team(tests.id('team_u'))$$, 'raises', 'delete_team(U)');
select ok(exists (select 1 from public.team where id = tests.id('team_u')), 'AC-9: delete_team left U in place');

select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t'],
  $$select public.admit_member(tests.id('pending_p'), tests.id('team_t'))$$, 'raises', 'admit_member(pending_p, T)');
select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t'],
  $$select public.reject_member(tests.id('pending_p'))$$, 'raises', 'reject_member(pending_p)');
select results_eq(
  $$select status::text, public.member_roster_team_id(id) from public.member where id = tests.id('pending_p')$$,
  $$values ('pending', null::uuid)$$,
  'AC-9: admit_member and reject_member left pending_p pending');

select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t'],
  $$select public.move_member(tests.id('member_u'), tests.id('team_t'))$$, 'raises', 'move_member(member_u, T)');
select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t', 'admin_t'],
  $$select public.set_member_team(tests.id('member_u'), tests.id('team_u'))$$, 'raises', 'set_member_team(member_u, U)');
select is((select public.member_roster_team_id(id) from public.member where id = tests.id('member_u')), tests.id('team_u'),
          'AC-9: move_member and set_member_team left member_u on U');

select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t', 'admin_t'],
  $$select public.set_member_role(tests.id('member_u'), 'manager')$$, 'raises',
  'set_member_role(member_u, manager) (cross-team-role.test.ts:76, 86, 100)');
select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t', 'admin_t'],
  $$select public.promote_member_to_admin(tests.id('member_u'))$$, 'raises', 'promote_member_to_admin(member_u)');
select is((select role::text from public.member where id = tests.id('member_u')), 'member',
          'AC-9: set_member_role and promote_member_to_admin left member_u''s role unchanged');

-- Cross-team reads (cross-team-reads.test.ts:117-174).
select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t'],
  $$select 1 from public.list_members_for_team(tests.id('team_u'))$$, 'empty', 'list_members_for_team(U)');
select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t'],
  $$select 1 from public.list_team_entries_for_team(tests.id('team_u'))$$, 'empty', 'list_team_entries_for_team(U)');
select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t'],
  $$select 1 from public.list_team_entries_overlapping_for_team(tests.id('team_u'), '2026-11-01', '2026-11-30')$$,
  'empty', 'list_team_entries_overlapping_for_team(U, November)');

-- Events.
select * from tests.refused(array['removed_t', 'pending_p'],
  'select 1 from public.list_member_directory()', 'empty', 'list_member_directory()');

select * from tests.refused(array['removed_t'],
  'select public.set_event_email(false)::text', 'null', 'set_event_email(false)');
select is((select event_email_enabled from public.member where id = tests.id('removed_t')), true,
          'AC-9: set_event_email left removed_t''s event_email_enabled unchanged');

select * from tests.refused(array['member_t', 'manager_t', 'removed_admin_t'],
  $$select * from public.invite_to_event(tests.id('event_u_public'), array['z@mir06.test'])$$, 'raises',
  'invite_to_event(event_u_public, z@)');
select is_empty(
  $$select 1 from public.event_email_invitation where event_id = tests.id('event_u_public')$$,
  'AC-9: invite_to_event added no event_email_invitation row');

select * from tests.refused(array['member_t', 'manager_t', 'member_u2'],
  $$select 1 from public.list_event_guest_emails(tests.id('event_u_public'))$$, 'empty',
  'list_event_guest_emails(event_u_public)');

select * from tests.refused(array['member_t', 'removed_t', 'pending_p'],
  $$select public.guest_link_event_id(repeat('b', 64))::text$$, 'null', 'guest_link_event_id(event_u''s token)');

-- AC-13 controls, and the admin rows of cross-team-reads.test.ts:52 and :117-174.
select tests.authenticate_as(tests.id('admin_t'));
select isnt_empty('select 1 from public.list_teams()', 'AC-13 control: admin_t list_teams() returns rows');
select is_empty(
  $$select 1 from public.list_members_for_team(tests.id('team_t')) where public.member_roster_team_id(id) = tests.id('team_u')$$,
  'AC-9 admin_t: list_members_for_team(T) holds no member of U (cross-team-reads.test.ts:52)');
select is_empty(
  $$select 1 from public.list_members_for_team('00000000-0000-4000-8000-0000000000ff')$$,
  'AC-9 admin_t: list_members_for_team(unknown team) is empty (cross-team-reads.test.ts:117-174)');
select lives_ok($$select public.set_member_role(tests.id('member_t'), 'manager')$$,
                'AC-13 control: admin_t set_member_role(member_t, manager) succeeds');

select tests.authenticate_as(tests.id('member_u'));
select results_eq(
  $$select email from public.list_event_guest_emails(tests.id('event_u_public'))$$,
  $$values ('guest-u@mir06.test')$$,
  'AC-13 control: member_u (creator) reads Guest U''s email');
select is(public.guest_link_event_id(repeat('b', 64)), tests.id('event_u'),
          'AC-13 control: member_u guest_link_event_id(event_u''s token) is event_u');
select tests.clear_authentication();

select is(public.member_roster_team_role(tests.id('member_t')), 'manager'::public.team_role,
          'AC-13 control: the set_member_role control wrote member_t''s team role — MIR-16-f');

select * from finish();
rollback;
