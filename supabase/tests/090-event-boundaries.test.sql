-- MIR-06 AC-15, the event rows of 01-plan.md § 4.7, with AC-13 controls: a team event is invisible
-- to the other team; only its creator (or an admin) writes it; only its audience attends it; only its
-- manager opens or closes its guest link.
begin;
\ir _isolation.psql
select plan(27);
select tests.seed();

create function tests.attend_refused(p_caller text, p_event text) returns text
  language plpgsql security invoker set search_path = extensions, pg_catalog as $$
declare
  v_result text;
begin
  perform tests.authenticate_as(tests.id(p_caller));
  -- member_id is not insertable (column grant `insert (event_id)`); it defaults to auth.uid(), as
  -- the client's own insert does.
  v_result := throws_ok(format('insert into public.event_attendance (event_id) values (%L)', tests.id(p_event)),
                        '42501', null,
                        format('%s: attending %s raises 42501 (event-attendance.test.ts:367-386)', p_caller, p_event));
  perform tests.clear_authentication();
  return v_result;
end;
$$;

create function tests.guest_link_refused(p_callers text[]) returns setof text
  language plpgsql security invoker set search_path = extensions, pg_catalog as $$
declare
  v_caller text;
begin
  foreach v_caller in array p_callers loop
    perform tests.authenticate_as(tests.id(v_caller));
    return next throws_ok(format('insert into public.event_guest_link (event_id) values (%L)', tests.id('event_t')),
                          '42501', null,
                          format('%s: opening event_t''s guest link raises 42501 (guest-link.test.ts:167-174)', v_caller));
    perform tests.clear_authentication();
  end loop;
end;
$$;

-- events.test.ts:207-221: a team event is invisible to the other team.
select tests.authenticate_as(tests.id('member_u'));
select is(current_user::text, 'authenticated', 'runs as authenticated');
select is_empty($$select 1 from public.event where id = tests.id('event_t')$$,
                'member_u: event_t is invisible (events.test.ts:207-221)');
select tests.authenticate_as(tests.id('member_u2'));
select is_empty($$select 1 from public.event where id = tests.id('event_t')$$,
                'member_u2: event_t is invisible');
select tests.authenticate_as(tests.id('member_t'));
select is_empty($$select 1 from public.event where id = tests.id('event_u')$$,
                'member_t: event_u is invisible');
select tests.authenticate_as(tests.id('manager_t'));
select is_empty($$select 1 from public.event where id = tests.id('event_u')$$,
                'manager_t: event_u is invisible');
select tests.authenticate_as(tests.id('member_u2'));
select isnt_empty($$select 1 from public.event where id = tests.id('event_u')$$,
                  'AC-13 control: member_u2 reads event_u');

-- events.test.ts:485-505: a non-creator of T neither edits nor deletes event_t.
select tests.authenticate_as(tests.id('member_t2'));
select is(tests.rows_affected($$update public.event set name = 'x' where id = tests.id('event_t')$$), 0::bigint,
          'member_t2: renaming event_t affects zero rows (events.test.ts:485-505)');
select is(tests.rows_affected($$delete from public.event where id = tests.id('event_t')$$), 0::bigint,
          'member_t2: deleting event_t affects zero rows');
select tests.authenticate_as(tests.id('manager_t'));
select is(tests.rows_affected($$update public.event set name = 'x' where id = tests.id('event_t')$$), 0::bigint,
          'manager_t: renaming event_t affects zero rows');
select is(tests.rows_affected($$delete from public.event where id = tests.id('event_t')$$), 0::bigint,
          'manager_t: deleting event_t affects zero rows');
select tests.clear_authentication();
select results_eq($$select name from public.event where id = tests.id('event_t')$$, $$values ('Event T')$$,
                  'event_t still exists, unrenamed');
select results_eq($$select member_id from public.event_invitee where event_id = tests.id('event_t')$$,
                  $$values (tests.id('member_t2'))$$,
                  'event_t''s event_invitee is unchanged');

-- event-attendance.test.ts:367-386: only an event's audience attends it.
select tests.attend_refused('member_u',  'event_t');
select tests.attend_refused('admin_t',   'event_u');
select tests.attend_refused('manager_t', 'event_u');
select tests.attend_refused('pending_p', 'event_t_public');
select tests.authenticate_as(tests.id('member_t2'));
select lives_ok($$insert into public.event_attendance (event_id) values (tests.id('event_t'))$$,
                'AC-13 control: member_t2 attends event_t');

-- guest-link.test.ts:167-174: only the event's manager closes or opens its guest link.
select tests.authenticate_as(tests.id('manager_t'));
select is(tests.rows_affected($$delete from public.event_guest_link where event_id = tests.id('event_t')$$), 0::bigint,
          'manager_t: closing event_t''s guest link affects zero rows (guest-link.test.ts:167-174)');
select tests.authenticate_as(tests.id('member_t2'));
select is(tests.rows_affected($$delete from public.event_guest_link where event_id = tests.id('event_t')$$), 0::bigint,
          'member_t2: closing event_t''s guest link affects zero rows');
select tests.authenticate_as(tests.id('member_u'));
select is(tests.rows_affected($$delete from public.event_guest_link where event_id = tests.id('event_t')$$), 0::bigint,
          'member_u: closing event_t''s guest link affects zero rows');
select tests.clear_authentication();
select results_eq($$select token from public.event_guest_link where event_id = tests.id('event_t')$$,
                  $$values (repeat('a', 64))$$,
                  'event_t''s guest link survives');

delete from public.event_guest_link where event_id = tests.id('event_t');
select * from tests.guest_link_refused(array['manager_t', 'member_t2', 'member_u']);
select tests.authenticate_as(tests.id('member_t'));
select lives_ok($$insert into public.event_guest_link (event_id) values (tests.id('event_t'))$$,
                'AC-13 control: member_t (creator) opens event_t''s guest link');

-- AC-13 control: the creator does edit and delete event_t.
select is(tests.rows_affected($$update public.event set name = 'Event T renamed' where id = tests.id('event_t')$$), 1::bigint,
          'AC-13 control: member_t (creator) renames event_t (1 row)');
select is(tests.rows_affected($$delete from public.event where id = tests.id('event_t')$$), 1::bigint,
          'AC-13 control: member_t (creator) deletes event_t (1 row)');

select * from finish();
rollback;
