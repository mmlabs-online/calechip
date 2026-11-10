-- MIR-06 AC-10 (table half) and AC-11, with AC-13 controls: signed out, `anon` reads no table, and a
-- guest token reaches its own event and nothing else. 01-plan.md § 4.6. The privilege half of AC-10
-- is 010-catalogue.test.sql.
begin;
\ir _isolation.psql
-- Types in pg_get_function_result below print `public.`-qualified whatever the session path is.
set local search_path = extensions;
select plan(35);
select tests.seed();

-- AC-10: every table select by anon raises 42501 (rbac-and-security.md § Signed out; also
-- cross-team-reads.test.ts:117-174's anon rows).
create function tests.anon_reads_no_table() returns setof text
  language plpgsql security invoker set search_path = extensions, pg_catalog as $$
declare
  v_table text;
begin
  foreach v_table in array array['entry', 'team', 'member', 'event', 'event_attendance',
                                 'event_invitee', 'event_guest', 'event_guest_link',
                                 'event_email_invitation', 'notification', 'task', 'issue_report',
                                 'holiday', 'member_role_change'] loop
    return next throws_ok(format('select 1 from public.%I', v_table), '42501', null,
                          format('AC-10 anon: select on public.%s raises 42501', v_table));
  end loop;
end;
$$;

select tests.authenticate_anon();
select is(current_user::text, 'anon', 'runs as anon');
select * from tests.anon_reads_no_table();
select todo('MIR-06 finding F-2: anon holds SELECT on public.busy_day (solo_busy_day revokes from authenticated only); RLS then returns zero rows instead of refusing', 1);
select throws_ok('select 1 from public.busy_day', '42501', null,
                 'AC-10 anon: select on public.busy_day raises 42501');

-- AC-11: the shape of what a token returns. No email, id or token column anywhere.
select tests.clear_authentication();
select is(pg_get_function_result('public.get_guest_event(text)'::regprocedure),
  'TABLE(name text, description text, location text, start_date date, end_date date, capacity integer, seats_taken integer)',
  'AC-11: get_guest_event returns exactly the EVT-06 columns');
select is(pg_get_function_result('public.list_guest_event_attendees(text)'::regprocedure),
  'TABLE(display_name text)',
  'AC-11: list_guest_event_attendees returns display_name only');
select is(pg_get_function_result('public.get_guest_event_terms(text)'::regprocedure),
  'TABLE(requires_approval boolean, registration_open boolean)',
  'AC-11: get_guest_event_terms returns the two EVT-07 columns');
select is(pg_get_function_result('public.get_guest_registration(text)'::regprocedure),
  'TABLE(event_name text, start_date date, end_date date, location text, guest_name text, status public.guest_status, registration_open boolean, event_deleted boolean)',
  'AC-11: get_guest_registration returns no email, id or token');

-- AC-11: t1 = event_t_public's token, m1 = Guest T's manage token.
select tests.authenticate_anon();
select results_eq(
  $$select * from public.get_guest_event(repeat('c', 64))$$,
  $$values ('Event T public'::text, null::text, null::text, '2026-11-10'::date, '2099-12-31'::date, null::integer, 2)$$,
  'AC-11 t1: get_guest_event describes the T event only');
select set_eq(
  $$select display_name from public.list_guest_event_attendees(repeat('c', 64))$$,
  $$values ('member_t2'), ('Guest T')$$,
  'AC-11 t1: attendees are the T event''s own, never member_u2 or Guest U');
select results_eq(
  $$select * from public.get_guest_event_terms(repeat('c', 64))$$,
  $$values (false, true)$$,
  'AC-11 t1: get_guest_event_terms returns one row');
select results_eq(
  $$select guest_name from public.get_guest_registration(repeat('e', 64))$$,
  $$values ('Guest T')$$,
  'AC-11 m1: get_guest_registration returns Guest T''s registration only');

-- AC-11: an unknown well-formed token.
select is_empty($$select 1 from public.get_guest_event(repeat('9', 64))$$,
                'AC-11 unknown token: get_guest_event is empty');
select is_empty($$select 1 from public.list_guest_event_attendees(repeat('9', 64))$$,
                'AC-11 unknown token: list_guest_event_attendees is empty');
select is_empty($$select 1 from public.get_guest_event_terms(repeat('9', 64))$$,
                'AC-11 unknown token: get_guest_event_terms is empty');
select is_empty($$select 1 from public.get_guest_registration(repeat('9', 64))$$,
                'AC-11 unknown token: get_guest_registration is empty');

-- AC-13 control: t2 returns the U event, so an empty answer above is not an empty fixture.
select results_eq(
  $$select name from public.get_guest_event(repeat('d', 64))$$,
  $$values ('Event U public')$$,
  'AC-13 control t2: get_guest_event returns the U event');
select set_eq(
  $$select display_name from public.list_guest_event_attendees(repeat('d', 64))$$,
  $$values ('member_u2'), ('Guest U')$$,
  'AC-13 control t2: attendees are the U event''s own');

-- AC-11: cancelling m1 changes m1's registration only.
select is(public.cancel_guest_registration(repeat('e', 64))::text, 'cancelled',
          'AC-11 m1: cancel_guest_registration returns cancelled');
select tests.clear_authentication();
select results_eq(
  $$select name, status::text from public.event_guest order by name$$,
  $$values ('Guest T', 'cancelled'), ('Guest U', 'attending')$$,
  'AC-11: Guest T is cancelled and Guest U is unchanged');

-- AC-11: t1 after its link row is deleted.
delete from public.event_guest_link where token = repeat('c', 64);
select tests.authenticate_anon();
select is_empty($$select 1 from public.get_guest_event(repeat('c', 64))$$,
                'AC-11 deleted t1: get_guest_event is empty');
select is_empty($$select 1 from public.list_guest_event_attendees(repeat('c', 64))$$,
                'AC-11 deleted t1: list_guest_event_attendees is empty');
select is_empty($$select 1 from public.get_guest_event_terms(repeat('c', 64))$$,
                'AC-11 deleted t1: get_guest_event_terms is empty');

select * from finish();
rollback;
