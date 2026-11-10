-- MIR-14-b AC-1 to AC-7: `public.list_entry_owners(uuid[])` names the owner of an entry the caller
-- may decide, with every team that owner actively belongs to, and names nobody to anybody else
-- (ADR-073 decisions 1, 7 and 9).
--
-- A "second-team row" is one active `membership` row with `is_primary = false`, inserted here as the
-- test owner (no writer creates one yet, ADR-072 decision 5). Part 1 runs with `member_t` on T
-- (`team_t`) only; part 2 adds a second-team row on U (`team_u`) and then sets its `left_at`; part 3
-- demotes `manager_t`, so it runs last (01-plan.md § 2).
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(18);
select tests.seed();

-- Definer: the org row is read here without RLS.
create function tests.org_a() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

-- The row count of one call as the current role.
create function tests.owner_rows(p_ids uuid[]) returns int
  language sql stable security invoker set search_path = '' as $$
  select count(*)::int from public.list_entry_owners(p_ids);
$$;

-- =============================================================================================
-- Part 1. `member_t` is on T only.
-- =============================================================================================

-- ---------------------------------------------------------------------------------------------
-- AC-2. A single-team owner gets one team.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('manager_t'));
select is(tests.owner_rows(array[tests.id('member_t')]), 1,
  'AC-2: manager_t naming member_t gets exactly one row');
select results_eq(
  format('select team_name from public.list_entry_owners(array[%L::uuid])', tests.id('member_t')),
  $$values ('Team T'::text)$$,
  'AC-2: that row is Team T');

-- ---------------------------------------------------------------------------------------------
-- AC-3, the no-shared-team half. A same-org admin or manager of another team learns nothing.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_u'));
select is(tests.owner_rows(array[tests.id('member_t')]), 0,
  'AC-3: admin_u, sharing no team with member_t, gets no row');
select tests.authenticate_as(tests.id('manager_u'));
select is(tests.owner_rows(array[tests.id('member_t')]), 0,
  'AC-3: manager_u, sharing no team with member_t, gets no row');

-- ---------------------------------------------------------------------------------------------
-- AC-4. A manager may name their own entry's teams (ADR-073 decision 3).
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('manager_t'));
select results_eq(
  format('select member_id, team_name from public.list_entry_owners(array[%L::uuid])',
         tests.id('manager_t')),
  format('values (%L::uuid, %L::text)', tests.id('manager_t'), 'Team T'),
  'AC-4: manager_t naming themselves gets one row, for Team T');

-- ---------------------------------------------------------------------------------------------
-- AC-7, the bound. Empty and null name nobody; an id the caller may not decide is dropped while
-- one they may decide in the same call still comes back.
-- ---------------------------------------------------------------------------------------------
select is(tests.owner_rows('{}'::uuid[]), 0, 'AC-7: an empty array returns no row');
select is(tests.owner_rows(null), 0, 'AC-7: null returns no row');
select results_eq(
  format('select member_id from public.list_entry_owners(array[%L::uuid, %L::uuid])',
         tests.id('member_t'), tests.id('member_u')),
  format('values (%L::uuid)', tests.id('member_t')),
  'AC-7: manager_t naming member_t and member_u gets member_t only, without error');

-- =============================================================================================
-- Part 2. `member_t` holds a second-team row on U.
-- =============================================================================================
select tests.clear_authentication();
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
values (tests.org_a(), tests.id('team_u'), tests.id('member_t'), 'member', false);

-- ---------------------------------------------------------------------------------------------
-- AC-1. A second-team decider gets the owner's name and both teams, ordered by team name.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('manager_u'));
select is(tests.owner_rows(array[tests.id('member_t')]), 2,
  'AC-1: manager_u naming member_t gets two rows');
select results_eq(
  format('select member_id, display_name, avatar, team_name
            from public.list_entry_owners(array[%L::uuid])', tests.id('member_t')),
  format('values (%L::uuid, %L::text, %L::text, %L::text), (%L::uuid, %L::text, %L::text, %L::text)',
         tests.id('member_t'), 'member_t', '1.png', 'Team T',
         tests.id('member_t'), 'member_t', '1.png', 'Team U'),
  'AC-1: both rows carry member_t''s name and avatar, Team T then Team U');

-- ---------------------------------------------------------------------------------------------
-- AC-3, the second-team half. An ordinary member of the owner's second team learns nothing.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('member_u'));
select is(tests.owner_rows(array[tests.id('member_t')]), 0,
  'AC-3: member_u, a plain member on U, gets no row');

-- ---------------------------------------------------------------------------------------------
-- AC-6. A left team stops being affected (INV-07: read at the moment of the question).
-- ---------------------------------------------------------------------------------------------
select tests.clear_authentication();
update public.membership set left_at = now()
 where member_id = tests.id('member_t') and team_id = tests.id('team_u');
select tests.authenticate_as(tests.id('manager_t'));
select results_eq(
  format('select team_name from public.list_entry_owners(array[%L::uuid])', tests.id('member_t')),
  $$values ('Team T'::text)$$,
  'AC-6: after member_t leaves U, manager_t gets Team T only');
select tests.authenticate_as(tests.id('manager_u'));
select is(tests.owner_rows(array[tests.id('member_t')]), 0,
  'AC-6: after member_t leaves U, manager_u gets no row');

-- =============================================================================================
-- Part 3. AC-5. The fallback decider is named too. Last, because it demotes manager_t.
-- =============================================================================================
select tests.authenticate_as(tests.id('admin_t'));
select lives_ok(format('select public.set_member_role(%L, %L)', tests.id('manager_t'), 'member'),
  'AC-5: admin_t demotes manager_t, leaving T with no active manager');
select results_eq(
  format('select member_id, team_name from public.list_entry_owners(array[%L::uuid])',
         tests.id('member_t')),
  format('values (%L::uuid, %L::text)', tests.id('member_t'), 'Team T'),
  'AC-5: admin_t naming member_t gets one row, for Team T');

-- ---------------------------------------------------------------------------------------------
-- AC-7, the catalogue half: definer, closed to anon, open to authenticated.
-- ---------------------------------------------------------------------------------------------
select tests.clear_authentication();
select ok(not has_function_privilege('anon', 'public.list_entry_owners(uuid[])', 'EXECUTE'),
  'AC-7: anon does not execute list_entry_owners');
select ok(has_function_privilege('authenticated', 'public.list_entry_owners(uuid[])', 'EXECUTE'),
  'AC-7: authenticated executes list_entry_owners');
select ok((select p.prosecdef from pg_catalog.pg_proc p
            where p.oid = 'public.list_entry_owners(uuid[])'::regprocedure),
  'AC-7: list_entry_owners is security definer');

select * from finish();
rollback;
