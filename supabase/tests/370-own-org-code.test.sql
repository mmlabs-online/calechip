-- MIR-19 AC-12 and AC-13 (database half): `public.own_org_code()` answers the caller's own org code
-- and nobody else's, and `tasks` cannot be an org code (ADR-097 decisions 2 and 3).
--
-- Fixture, added here on top of `tests.seed()` as `postgres`:
--   * Org D, `org_code = 'org-d-mir19-370'`, with Dan (approved) and Pia (pending) in it.
--   * Sam, a system admin (as `200-org-management.test.sql`), who calls `create_org`.
-- Org public's code is `shared` (20261031120000_mir12_backfill_org_public.sql). `member_t` is in it,
-- `pending_p` is pending, and `removed_t` is removed — all from `tests.seed()`.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(13);
select tests.seed();

create function tests.m370(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('c3700000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values ('org_d', '01'), ('team_d', '02'), ('dan', '11'), ('pia', '12'), ('sam', '21')) as v(label, nn)
   where v.label = p_label;
$$;

insert into public.org (id, org_code, name) values (tests.m370('org_d'), 'org-d-mir19-370', 'Org D');
insert into public.team (id, name, org_id) values (tests.m370('team_d'), 'Team D', tests.m370('org_d'));
insert into auth.users (id, email) values
  (tests.m370('dan'), 'dan@mir19-370.test'),
  (tests.m370('pia'), 'pia@mir19-370.test'),
  (tests.m370('sam'), 'sam@mir19-370.test');
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m370('dan'), tests.m370('org_d'), 'Dan', '1.png', 'member', 'approved', 'dan@mir19-370.test'),
  (tests.m370('pia'), tests.m370('org_d'), 'Pia', '1.png', 'member', 'pending', 'pia@mir19-370.test');
select tests.put_on_team(tests.m370('dan'), tests.m370('team_d'));
select public.grant_system_admin(tests.m370('sam'));

-- Become X at an assurance level, as `200-org-management.test.sql` does; `_isolation.psql` is not edited.
create function tests.authenticate_at(p_id uuid, p_aal text) returns void
  language plpgsql security invoker set search_path = '' as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- AC-12. The caller's own org code, by who is calling.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('member_t'));
select is(public.own_org_code(), 'shared', 'AC-12: an approved member of Org public gets shared');

select tests.authenticate_as(tests.m370('dan'));
select is(public.own_org_code(), 'org-d-mir19-370', 'AC-12: an approved member of Org D gets Org D''s code');

select tests.authenticate_as(tests.id('pending_p'));
select is(public.own_org_code(), null, 'AC-12: a pending caller gets null');

select tests.authenticate_as(tests.m370('pia'));
select is(public.own_org_code(), null, 'AC-12: a pending member of Org D gets null');

select tests.authenticate_as(tests.id('removed_t'));
select is(public.own_org_code(), null, 'AC-12: a removed member gets null');

select tests.authenticate_anon();
select throws_ok($$select public.own_org_code()$$, '42501', null, 'AC-12: anon is refused');

select tests.clear_authentication();
select ok(not has_function_privilege('anon', 'public.own_org_code()', 'execute'),
  'AC-12: anon holds no execute on own_org_code()');
select ok(has_function_privilege('authenticated', 'public.own_org_code()', 'execute'),
  'AC-12: authenticated holds execute on own_org_code()');
select is(
  (select pronargs::int from pg_catalog.pg_proc where oid = 'public.own_org_code()'::regprocedure),
  0,
  'AC-12: it takes no argument, so it cannot look up another org'
);

-- ---------------------------------------------------------------------------------------------
-- AC-13. `tasks` is reserved.
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  $$insert into public.org (org_code, name) values ('tasks', 'Tasks')$$,
  '23514', null, 'AC-13: inserting an org with org_code = tasks is refused by org_code_not_reserved');

select tests.authenticate_at(tests.m370('sam'), 'aal2');
select throws_ok(
  $$select public.create_org('tasks', 'Tasks', 'Asia/Ho_Chi_Minh')$$,
  '23514', null, 'AC-13: create_org with org_code = tasks is refused with 23514');

select tests.clear_authentication();
select is(
  (select count(*)::int from public.org where org_code = 'tasks'), 0,
  'AC-13: and no org holds the code');
select ok(
  (select pg_get_constraintdef(c.oid) like '%''tasks''%'
     from pg_catalog.pg_constraint c
    where c.conrelid = 'public.org'::regclass and c.conname = 'org_code_not_reserved'),
  'AC-13: org_code_not_reserved names tasks and keeps its name');

select * from finish();
rollback;
