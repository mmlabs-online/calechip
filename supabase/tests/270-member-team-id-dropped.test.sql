-- MIR-21-f AC-1 to AC-10: `member.team_id`, its index and foreign key, `public.member_team_id(uuid)`,
-- `member_decide_admin` and the mirror's INSERT branch are dropped, and what stood on them still
-- works (ADR-080 decision 4, ADR-081 decision 2; 01-plan.md § 2, § 4.2).
--
-- The seed of _isolation.psql, in the shared tenant O1. A is `admin_t`, approved admin on T1
-- (`team_t`). M is `member_t`, approved on T1. T2 is `team_u`. P is `pending_p`, pending with no
-- `membership` row. Q, R and P2 are added here; O2 is an org that is not the shared tenant.
--
-- `team_id` appears only as a string: in AC-1's catalogue reads, AC-3's `doesnt_match` and AC-10's
-- refused statement (ADR-080 decision 5).
--
-- AC-8 removes M, so it runs last: AC-9 and AC-10 need M active.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(28);

create function tests.m21f(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('a2700000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values ('o2', 'b1'), ('q', 'c1'), ('r', 'c2'), ('p2', 'c3')) as v(label, nn)
   where v.label = p_label;
$$;

-- Definer: `authenticated` holds no grant on `public.org`. The shape of 140's helper.
create function tests.org_a() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

-- A digest of `membership`, for "unchanged, compared before and after". Owner only.
create function tests.m21f_ms() returns text
  language sql stable security invoker set search_path = '' as $$
  select coalesce(md5(string_agg(ms::text, '|' order by ms.id)), 'none')
    from public.membership ms;
$$;

select tests.seed();

-- ---------------------------------------------------------------------------------------------
-- AC-1. The column, its index and its foreign key are gone.
-- ---------------------------------------------------------------------------------------------
select hasnt_column('public', 'member', 'team_id', 'AC-1: public.member has no column team_id');
select hasnt_index('public', 'member', 'member_team_id_idx', 'AC-1: public.member has no index member_team_id_idx');
select is(
  (select count(*)::int from pg_catalog.pg_constraint
    where conrelid = 'public.member'::regclass and contype = 'f' and confrelid = 'public.team'::regclass),
  0,
  'AC-1: public.member has no foreign key to public.team');

-- ---------------------------------------------------------------------------------------------
-- AC-2. public.member_team_id(uuid) and member_decide_admin are gone.
-- ---------------------------------------------------------------------------------------------
select hasnt_function('public', 'member_team_id', array['uuid'], 'AC-2: public.member_team_id(uuid) does not exist');
select ok(
  not exists (select 1 from pg_catalog.pg_policies
               where schemaname = 'public' and tablename = 'member' and policyname = 'member_decide_admin'),
  'AC-2: public.member has no policy member_decide_admin');

-- ---------------------------------------------------------------------------------------------
-- AC-3. The mirror trigger fires only on a removal, and its function has no insert branch.
-- ---------------------------------------------------------------------------------------------
select matches(
  (select pg_catalog.pg_get_triggerdef(t.oid) from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.member'::regclass and t.tgname = 'member_sync_membership'),
  'AFTER UPDATE OF removed_at ON public\.member ',
  'AC-3: member_sync_membership fires AFTER UPDATE OF removed_at');
select doesnt_match(
  (select pg_catalog.pg_get_triggerdef(t.oid) from pg_catalog.pg_trigger t
    where t.tgrelid = 'public.member'::regclass and t.tgname = 'member_sync_membership'),
  'INSERT',
  'AC-3: member_sync_membership does not fire on INSERT');
select doesnt_match(
  (select p.prosrc from pg_catalog.pg_proc p
    where p.oid = 'public.member_sync_membership()'::regprocedure),
  '\m(tg_op|team_id)\M',
  'AC-3: member_sync_membership() names neither tg_op nor team_id');

-- ---------------------------------------------------------------------------------------------
-- AC-4. Inserting a member writes no membership row, and lands in the shared tenant.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email) values (tests.m21f('q'), 'q@mir21f-270.test');
insert into public.member (id, display_name, avatar, role, status, email) values
  (tests.m21f('q'), 'Q', '1.png', 'member', 'pending', 'q@mir21f-270.test');
select is((select org_id from public.member where id = tests.m21f('q')), tests.org_a(),
  'AC-4: Q''s org_id is the shared tenant');
select is((select count(*)::int from public.membership where member_id = tests.m21f('q')), 0,
  'AC-4: Q has no membership row');

-- ---------------------------------------------------------------------------------------------
-- AC-5. A member inserted with an org_id keeps it.
-- ---------------------------------------------------------------------------------------------
insert into public.org (id, org_code, name, is_shared_tenant) values
  (tests.m21f('o2'), 'mir21f-o2', 'Org O2 mir21f-270', false);
insert into auth.users (id, email) values (tests.m21f('r'), 'r@mir21f-270.test');
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m21f('r'), tests.m21f('o2'), 'R', '1.png', 'member', 'pending', 'r@mir21f-270.test');
select is((select org_id from public.member where id = tests.m21f('r')), tests.m21f('o2'),
  'AC-5: R''s org_id is O2');

-- ---------------------------------------------------------------------------------------------
-- AC-6. Admitting and rejecting a sign-up still work.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email) values (tests.m21f('p2'), 'p2@mir21f-270.test');
insert into public.member (id, display_name, avatar, role, status, email) values
  (tests.m21f('p2'), 'P2', '1.png', 'member', 'pending', 'p2@mir21f-270.test');

select tests.authenticate_as(tests.id('admin_t'));
select lives_ok(
  format('select public.admit_member(%L::uuid, %L::uuid)', tests.id('pending_p'), tests.id('team_t')),
  'AC-6: A admit_member(P, T1) succeeds');
select lives_ok(
  format('select public.reject_member(%L::uuid)', tests.m21f('p2')),
  'AC-6: A reject_member(P2) succeeds');
select tests.clear_authentication();

select results_eq(
  format($$select status::text, public.member_roster_team_id(id) from public.member
            where id in (%L, %L) order by status::text$$, tests.id('pending_p'), tests.m21f('p2')),
  format($$values ('approved'::text, %L::uuid), ('rejected'::text, null::uuid)$$, tests.id('team_t')),
  'AC-6: P is approved on T1; P2 is rejected on no team');

-- ---------------------------------------------------------------------------------------------
-- AC-7. A person still cannot change their own role, status or team. The first two run as the
-- table owner with A's claims: the position a definer writer is in when it updates the caller's
-- own row. (set_member_role(A, …) cannot be the probe: it refuses an admin before the trigger.)
-- ---------------------------------------------------------------------------------------------
select tests.m21f_ms() as ac7_ms_before \gset

select set_config('request.jwt.claims',
                  json_build_object('sub', tests.id('admin_t'), 'role', 'authenticated')::text, true);
select throws_ok(
  format('update public.member set role = %L where id = %L',
         tests.member_role('member')::text, tests.id('admin_t')),
  '42501', 'a person may not change their own role, status or team',
  'AC-7: an owner-side update of A''s own role, under A''s claims, raises 42501');
select throws_ok(
  format('update public.member set status = %L where id = %L', 'rejected', tests.id('admin_t')),
  '42501', 'a person may not change their own role, status or team',
  'AC-7: an owner-side update of A''s own status, under A''s claims, raises 42501');

select tests.authenticate_as(tests.id('admin_t'));
select throws_ok(
  format('select public.move_member(%L::uuid, %L::uuid)', tests.id('admin_t'), tests.id('team_u')),
  '42501', 'a person may not change their own role, status or team',
  'AC-7: A move_member(A, T2) raises 42501');
select tests.clear_authentication();

select results_eq(
  format('select role::text, status::text from public.member where id = %L', tests.id('admin_t')),
  $$values (tests.member_role('admin')::text, 'approved'::text)$$,
  'AC-7: A''s role and status are unchanged');
select is(tests.m21f_ms(), :'ac7_ms_before', 'AC-7: every membership row is unchanged');

-- ---------------------------------------------------------------------------------------------
-- AC-9. A person still edits their own profile, and only their own.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('member_t'));
select is(
  tests.rows_affected(format('update public.member set display_name = %L where id = %L',
                             '  M renamed  ', tests.id('member_t'))),
  1::bigint,
  'AC-9: M''s update of their own display name affects one row');
select tests.clear_authentication();
select is((select display_name from public.member where id = tests.id('member_t')), 'M renamed',
  'AC-9: M''s display name is stored trimmed');

select tests.authenticate_as(tests.id('admin_t'));
select throws_ok(
  format('update public.member set display_name = %L where id = %L', 'Renamed by A', tests.id('member_t')),
  '42501', null,
  'AC-9: A''s update of M''s display name raises 42501');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-10. A table update naming team_id is refused and changes nothing.
-- ---------------------------------------------------------------------------------------------
select to_jsonb(m)::text as ac10_m_before from public.member m where m.id = tests.id('member_t') \gset
select tests.m21f_ms() as ac10_ms_before \gset

select tests.authenticate_as(tests.id('member_t'));
select throws_ok(
  format('update public.member set team_id = %L where id = %L', tests.id('team_u'), tests.id('member_t')),
  '42703', null,
  'AC-10: M''s update naming team_id raises 42703');
select tests.clear_authentication();

select is((select to_jsonb(m)::text from public.member m where m.id = tests.id('member_t')), :'ac10_m_before',
  'AC-10: M''s member row is unchanged');
select is(tests.m21f_ms(), :'ac10_ms_before', 'AC-10: every membership row is unchanged');

-- ---------------------------------------------------------------------------------------------
-- AC-8. A removal still closes the removed member's rows on the removal day.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
update public.member set removed_at = '2000-01-01' where id = tests.id('member_t');
select tests.clear_authentication();

select ok((select removed_at from public.member where id = tests.id('member_t')) > '2000-01-01'::timestamptz,
  'AC-8: M''s removed_at is the statement time, not the supplied value');
select results_eq(
  format($$select ms.left_at = greatest(m.removed_at, ms.joined_at), ms.is_primary
             from public.membership ms join public.member m on m.id = ms.member_id
            where ms.member_id = %L and ms.team_id = %L$$, tests.id('member_t'), tests.id('team_t')),
  $$values (true, false)$$,
  'AC-8: M''s T1 row has left_at = greatest(removed_at, joined_at) and is not primary');
select is(public.member_roster_team_id(tests.id('member_t')), tests.id('team_t'),
  'AC-8: M''s roster team is still T1');

select * from finish();
rollback;
