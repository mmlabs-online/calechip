-- MIR-06 AC-4, with AC-13 controls: nobody alters their own role, status or team, by table or by
-- RPC — member, manager or admin. 01-plan.md § 4.4.
begin;
\ir _isolation.psql
select plan(26);
select tests.seed();

-- The six refusals, as each of member_t, manager_t and admin_t on their own row.
create function tests.self_writes(p_label text) returns setof text
  language plpgsql security invoker set search_path = extensions, pg_catalog as $$
declare
  v_id text := quote_literal(tests.id(p_label));
begin
  perform tests.authenticate_as(tests.id(p_label));
  return next throws_ok(format('update public.member set role = %L where id = %s',
                               tests.member_role('member')::text, v_id),
    '42501', null, format('AC-4 %s: update own role raises 42501', p_label));
  return next throws_ok(format('update public.member set status = %L where id = %s', 'rejected', v_id),
    '42501', null, format('AC-4 %s: update own status raises 42501', p_label));
  return next throws_ok(format('select public.move_member(%s, %L)', v_id, tests.id('team_u')),
    '42501', null, format('AC-4 %s: move_member(self, U) raises 42501', p_label));
  return next throws_ok(format('select public.set_member_team(%s, %L)', v_id, tests.id('team_u')),
    '42501', null, format('AC-4 %s: set_member_team(self, U) raises 42501', p_label));
  return next throws_ok(format('select public.set_member_role(%s, %L)', v_id, 'manager'),
    '42501', null, format('AC-4 %s: set_member_role(self, manager) raises 42501', p_label));
  return next throws_ok(format('select public.promote_member_to_admin(%s)', v_id),
    '42501', null, format('AC-4 %s: promote_member_to_admin(self) raises 42501', p_label));
  perform tests.clear_authentication();
end;
$$;

select tests.authenticate_as(tests.id('member_t'));
select is(current_user::text, 'authenticated', 'runs as authenticated');
select tests.clear_authentication();

select * from tests.self_writes('member_t');
select * from tests.self_writes('manager_t');
select * from tests.self_writes('admin_t');

-- Re-read as the table owner, without RLS.
select results_eq(
  $$select id, role::text, status::text, public.member_roster_team_id(id) from public.member
     where id in (tests.id('member_t'), tests.id('manager_t'), tests.id('admin_t')) order by id$$,
  $$values (tests.id('admin_t'),   tests.member_role('admin')::text,   'approved', tests.id('team_t')),
           (tests.id('manager_t'), tests.member_role('manager')::text, 'approved', tests.id('team_t')),
           (tests.id('member_t'),  'member',  'approved', tests.id('team_t'))$$,
  'AC-4: role, status and roster team of the three callers are unchanged'
);

-- AC-13 controls: the caller's own row is reachable, and the RPCs work for an entitled caller on
-- somebody else.
select tests.authenticate_as(tests.id('member_t'));
select is(
  tests.rows_affected($$update public.member set display_name = 'member_t renamed' where id = tests.id('member_t')$$),
  1::bigint,
  'AC-13 control: member_t updates their own display_name (1 row)'
);

select tests.authenticate_as(tests.id('admin_t'));
select lives_ok(
  $$select public.set_member_team(tests.id('member_t2'), tests.id('team_t'))$$,
  'AC-13 control: admin_t set_member_team(member_t2, T) succeeds'
);
select lives_ok(
  $$select public.set_member_role(tests.id('member_t2'), 'manager')$$,
  'AC-13 control: admin_t set_member_role(member_t2, manager) succeeds'
);
select lives_ok(
  $$select public.promote_member_to_admin(tests.id('member_t2'))$$,
  'AC-13 control: admin_t promote_member_to_admin(member_t2) succeeds'
);
select lives_ok(
  $$select public.move_member(tests.id('member_t2'), tests.id('team_u'))$$,
  'AC-13 control: admin_t move_member(member_t2, U) succeeds (solo_many_teams)'
);
select tests.clear_authentication();

select results_eq(
  $$select role::text, public.member_roster_team_id(id) from public.member where id = tests.id('member_t2')$$,
  $$values (tests.member_role('admin')::text, tests.id('team_u'))$$,
  'AC-13 control: the controls wrote member_t2'
);

select * from finish();
rollback;
