-- MIR-21-c AC-1 to AC-8: ADR-064 decision 3's self lock is a row trigger on `membership`, the three
-- row-returning member RPCs carry the roster team when read the seam's way, and the sign-up trigger
-- no longer names the team column (ADR-080 decision 1).
--
-- T1 and T2 are inserted with no org, so `stamp_org_id` puts them in the shared tenant O. A (admin),
-- M, R, W and X (members) are inserted with no team and no org, so they land in O too, and each gets
-- an active primary `membership` row on T1, inserted directly. No fixture names the member table's
-- team column (ADR-080 decision 5).
--
-- "Claims name P" sets `request.jwt.claims` while the session role is still the table owner: the
-- state a `security definer` function runs in when P calls it (01-plan.md § 2).
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(38);

create function tests.m21c(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('c2400000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('t1', 'b1'), ('t2', 'b2'),
      ('a', 'c1'), ('m', 'c2'), ('r', 'c3'), ('w', 'c4'), ('x', 'c5'), ('s', 'c6')
    ) as v(label, nn)
   where v.label = p_label;
$$;

-- The shared tenant's id.
create function tests.m21c_org() returns uuid
  language sql stable security invoker set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

-- Claims name P, with no role change.
create function tests.m21c_claims(p_id uuid) returns void
  language sql volatile security invoker set search_path = '' as $$
  select set_config('request.jwt.claims',
                    json_build_object('sub', p_id, 'role', 'authenticated')::text, true);
$$;

insert into public.team (id, name) values
  (tests.m21c('t1'), 'Team T1 mir21c-250'),
  (tests.m21c('t2'), 'Team T2 mir21c-250');
insert into auth.users (id, email)
select tests.m21c(l), l || '@mir21c-250.test'
  from unnest(array['a', 'm', 'r', 'w', 'x']) l;
insert into public.member (id, display_name, avatar, role, status, email) values
  (tests.m21c('a'), 'A', '1.png', tests.member_role('admin'), 'approved', 'a@mir21c-250.test');
insert into public.member (id, display_name, avatar, role, status, email)
select tests.m21c(l), upper(l), '1.png', 'member', 'approved', l || '@mir21c-250.test'
  from unnest(array['m', 'r', 'w', 'x']) l;
insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
select tests.m21c_org(), tests.m21c('t1'), tests.m21c(l), 'member', true
  from unnest(array['a', 'm', 'r', 'w', 'x']) l;

-- ---------------------------------------------------------------------------------------------
-- AC-1. A write to the caller's own `membership` row is refused, whatever the statement.
-- ---------------------------------------------------------------------------------------------
create temp table m21c_x_before as
  select * from public.membership where member_id = tests.m21c('x');

select tests.m21c_claims(tests.m21c('x'));
select throws_ok(
  format('insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
          values (%L, %L, %L, ''member'', false)',
         tests.m21c_org(), tests.m21c('t2'), tests.m21c('x')),
  '42501', 'a person may not change their own role, status or team',
  'AC-1: X inserting a row for X on T2 raises 42501');
select throws_ok(
  format('update public.membership set updated_at = now() where member_id = %L and team_id = %L',
         tests.m21c('x'), tests.m21c('t1')),
  '42501', 'a person may not change their own role, status or team',
  'AC-1: X updating X''s T1 row raises 42501');
select throws_ok(
  format('delete from public.membership where member_id = %L and team_id = %L',
         tests.m21c('x'), tests.m21c('t1')),
  '42501', 'a person may not change their own role, status or team',
  'AC-1: X deleting X''s T1 row raises 42501');
select tests.clear_authentication();

select results_eq(
  format('select * from public.membership where member_id = %L order by id', tests.m21c('x')),
  'select * from m21c_x_before order by id',
  'AC-1: X''s membership rows are identical before and after, in count and every column');

-- ---------------------------------------------------------------------------------------------
-- AC-2. Writes to another person's rows pass, and so do owner writes.
-- ---------------------------------------------------------------------------------------------
select tests.m21c_claims(tests.m21c('a'));
select lives_ok(
  format('insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
          values (%L, %L, %L, ''member'', false)',
         tests.m21c_org(), tests.m21c('t2'), tests.m21c('x')),
  'AC-2: claims naming A insert a non-primary row for X on T2');
select lives_ok(
  format('update public.membership set updated_at = now() where member_id = %L and team_id = %L',
         tests.m21c('x'), tests.m21c('t2')),
  'AC-2: claims naming A update it');
select lives_ok(
  format('delete from public.membership where member_id = %L and team_id = %L',
         tests.m21c('x'), tests.m21c('t2')),
  'AC-2: claims naming A delete it');
select tests.clear_authentication();

select lives_ok(
  format('insert into public.membership (org_id, team_id, member_id, team_role, is_primary)
          values (%L, %L, %L, ''member'', false)',
         tests.m21c_org(), tests.m21c('t2'), tests.m21c('x')),
  'AC-2: with no claims, the owner inserts a non-primary row for X on T2');
select lives_ok(
  format('update public.membership set updated_at = now() where member_id = %L and team_id = %L',
         tests.m21c('x'), tests.m21c('t2')),
  'AC-2: with no claims, the owner updates it');
select lives_ok(
  format('delete from public.membership where member_id = %L and team_id = %L',
         tests.m21c('x'), tests.m21c('t2')),
  'AC-2: with no claims, the owner deletes it');

-- ---------------------------------------------------------------------------------------------
-- AC-3. The definer writers work as before for a person other than the caller.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21c('a'));
select lives_ok(
  format('select public.set_member_role(%L::uuid, ''manager'')', tests.m21c('m')),
  'AC-3: A set_member_role(M, manager) succeeds');
select lives_ok(
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21c('m'), tests.m21c('t2')),
  'AC-3: A move_member(M, T2) succeeds');
select is(tests.rows_affected(format('update public.member set removed_at = now() where id = %L',
                                     tests.m21c('w'))),
          1::bigint, 'AC-3: A removes W through the seam''s update');
select tests.clear_authentication();

select is(
  (select count(*)::int from public.membership
    where member_id = tests.m21c('m') and left_at is null and is_primary),
  1, 'AC-3: M has exactly one active primary row');
select is(
  (select team_id from public.membership
    where member_id = tests.m21c('m') and left_at is null and is_primary),
  tests.m21c('t2'), 'AC-3: M''s active primary row is on T2');
select is(
  (select team_role::text from public.membership
    where member_id = tests.m21c('m') and left_at is null and is_primary),
  'manager', 'AC-3: M''s active primary row has team_role manager');
select is(
  (select count(*)::int from public.membership
    where member_id = tests.m21c('m') and team_id = tests.m21c('t1') and left_at is null),
  0, 'AC-3: M has no active row on T1');
select ok(
  exists (select 1 from public.membership
           where member_id = tests.m21c('m') and team_id = tests.m21c('t1') and left_at is not null),
  'AC-3: M''s T1 row is closed');
select is(
  (select count(*)::int from public.membership where member_id = tests.m21c('w') and left_at is null),
  0, 'AC-3: W has no active membership row');
select ok((select count(*) > 0 from public.membership where member_id = tests.m21c('w')),
  'AC-3: W has closed rows to check');
select is(
  (select count(*)::int from public.membership ms join public.member m on m.id = ms.member_id
    where ms.member_id = tests.m21c('w')
      and (ms.left_at is distinct from greatest(m.removed_at, ms.joined_at) or ms.is_primary)),
  0,
  'AC-3: every closed row of W has left_at = greatest(removed_at, joined_at) and is not primary');

-- ---------------------------------------------------------------------------------------------
-- AC-4. Moving oneself is still refused with ADR-064's message.
-- ---------------------------------------------------------------------------------------------
create temp table m21c_a_before as
  select * from public.membership where member_id = tests.m21c('a');

select tests.authenticate_as(tests.m21c('a'));
select throws_ok(
  format('select public.move_member(%L::uuid, %L::uuid)', tests.m21c('a'), tests.m21c('t2')),
  '42501', 'a person may not change their own role, status or team',
  'AC-4: A move_member(A, T2) raises 42501');
select tests.clear_authentication();

select results_eq(
  format('select * from public.membership where member_id = %L order by id', tests.m21c('a')),
  'select * from m21c_a_before order by id',
  'AC-4: A''s membership rows are identical before and after');

-- ---------------------------------------------------------------------------------------------
-- AC-5. The lock is a row trigger on `membership`, and clients cannot call its function.
-- ---------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.membership'::regclass and t.tgname = 'membership_refuse_own_rows'),
  1, 'AC-5: public.membership has a trigger named membership_refuse_own_rows');
select is(
  (select t.tgenabled::text from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.membership'::regclass and t.tgname = 'membership_refuse_own_rows'),
  'O', 'AC-5: the trigger is enabled');
select matches(
  (select pg_catalog.pg_get_triggerdef(t.oid) from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.membership'::regclass and t.tgname = 'membership_refuse_own_rows'),
  -- Each token on its own: Postgres prints the events in its own order (INSERT OR DELETE OR UPDATE).
  '^(?=.*\mBEFORE\M)(?=.*\mINSERT\M)(?=.*\mUPDATE\M)(?=.*\mDELETE\M)(?=.*\mFOR EACH ROW\M)',
  'AC-5: the trigger definition contains BEFORE, INSERT, UPDATE, DELETE and FOR EACH ROW');
select is(
  (select p.prosecdef from pg_catalog.pg_proc p
    where p.oid = 'public.membership_refuse_own_rows()'::regprocedure),
  false, 'AC-5: membership_refuse_own_rows() is security invoker');
select ok(
  not has_function_privilege('anon', 'public.membership_refuse_own_rows()', 'EXECUTE'),
  'AC-5: anon cannot execute membership_refuse_own_rows()');
select ok(
  not has_function_privilege('authenticated', 'public.membership_refuse_own_rows()', 'EXECUTE'),
  'AC-5: authenticated cannot execute membership_refuse_own_rows()');

-- ---------------------------------------------------------------------------------------------
-- AC-6. The three row-returning RPCs carry the roster team when read the seam's way. R was inserted
-- with no team, so a T1 here cannot have come from the column.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m21c('a'));
select is(
  (select public.roster_team_id(r)
     from public.set_member_role(tests.m21c('r'), 'manager') r),
  tests.m21c('t1'), 'AC-6: set_member_role(R, manager) read through roster_team_id is T1');
select is(
  (select public.roster_team_id(r)
     from public.set_member_team(tests.m21c('r'), tests.m21c('t1')) r),
  tests.m21c('t1'), 'AC-6: set_member_team(R, T1) read through roster_team_id is T1');
select is(
  (select public.roster_team_id(r)
     from public.promote_member_to_admin(tests.m21c('r')) r),
  tests.m21c('t1'), 'AC-6: promote_member_to_admin(R) read through roster_team_id is T1');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-8. A confirmed sign-up is admitted as before, and the trigger no longer names the column.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at)
values (tests.m21c('s'), 's@mir21c-250.test', now());

select ok(exists (select 1 from public.member where id = tests.m21c('s')),
  'AC-8: the confirmed sign-up S has a member row');
select is((select status::text from public.member where id = tests.m21c('s')),
  'pending', 'AC-8: S is pending');
select is((select role::text from public.member where id = tests.m21c('s')),
  'member', 'AC-8: S has role member');
select is((select count(*)::int from public.membership where member_id = tests.m21c('s')),
  0, 'AC-8: S has no membership row');
select ok(public.member_roster_team_id(tests.m21c('s')) is null,
  'AC-8: member_roster_team_id(S) is null');
select doesnt_match(
  (select p.prosrc from pg_catalog.pg_proc p
    where p.oid = 'public.admit_allow_listed_member()'::regprocedure),
  '\mteam_id\M',
  'AC-8: admit_allow_listed_member() does not name team_id');

select * from finish();
rollback;
