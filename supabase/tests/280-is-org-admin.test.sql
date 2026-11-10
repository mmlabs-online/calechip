-- MIR-16-b AC-1 to AC-7: `is_org_admin(uid, org_id)` replaces `is_admin(uid)` at every call site,
-- and `is_admin` is dropped. Nobody gains or loses a power (01-plan.md § 2, § 4.2; ADR-083).
-- AC-8 is the rest of `pnpm db:test` and `pnpm test`, unchanged.
--
-- Fixture, added here on top of `tests.seed()` (Org public; `admin_t` is Ada, `manager_t` Mona,
-- `member_t` Thanh, `removed_admin_t` Rex, `pending_p` Pat), following
-- 270-issue-reports-system-scope.test.sql:31-80:
--   * Org D, with team D1. D1 requires approval for PTO, which is the column default;
--   * Dora (`admin`) and Dan (`member`), approved, of Org D, inserted without `team_id` and placed on
--     D1 with `tests.put_on_team`; Pia, `pending`, of Org D, on no team;
--   * a `system_admin` row for Sam, with `grant_system_admin`. Sam has no member row;
--   * event E-D, Org D, created by Dan, scope `team`, stamped onto D1 (his only team);
--   * entry N-D, Dan's `pending` PTO for one full day.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(45);
select tests.seed();

-- The fixture ids local to this file. Labels are fixture names, not schema fields.
create function tests.m16b(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('c2800000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('org_d', '01'), ('team_d1', '02'), ('dora', '11'), ('dan', '12'), ('pia', '13'),
      ('sam', '21'), ('event_d', '31'), ('entry_d', '41'), ('nobody', 'ff')
    ) as v(label, nn)
   where v.label = p_label;
$$;

-- Org public's id. Definer, so a test running as `authenticated` can name it in a call.
create function tests.shared_org() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

-- An org's team ids, read as the owner, so a `list_teams()` result can be compared with them.
create function tests.m16b_team_ids(p_org_id uuid) returns uuid[]
  language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(t.id order by t.id), '{}') from public.team t where t.org_id = p_org_id;
$$;

insert into public.org (id, org_code, name) values (tests.m16b('org_d'), 'org-d-mir16b-280', 'Org D');
insert into public.team (id, name, org_id) values (tests.m16b('team_d1'), 'Team D1', tests.m16b('org_d'));

insert into auth.users (id, email) values
  (tests.m16b('dora'), 'dora@mir16b-280.test'),
  (tests.m16b('dan'), 'dan@mir16b-280.test'),
  (tests.m16b('pia'), 'pia@mir16b-280.test'),
  (tests.m16b('sam'), 'sam@mir16b-280.test');

insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m16b('dora'), tests.m16b('org_d'), 'Dora', '1.png', tests.member_role('admin'), 'approved', 'dora@mir16b-280.test'),
  (tests.m16b('dan'), tests.m16b('org_d'), 'Dan', '1.png', 'member', 'approved', 'dan@mir16b-280.test'),
  (tests.m16b('pia'), tests.m16b('org_d'), 'Pia', '1.png', 'member', 'pending', 'pia@mir16b-280.test');
select tests.put_on_team(tests.m16b('dora'), tests.m16b('team_d1'));
select tests.put_on_team(tests.m16b('dan'), tests.m16b('team_d1'));

select public.grant_system_admin(tests.m16b('sam'));

insert into public.event (id, creator_id, name, start_date, end_date, scope) values
  (tests.m16b('event_d'), tests.m16b('dan'), 'E-D', current_date + 10, current_date + 11, 'team');
insert into public.entry (id, member_id, type, portion, start_date, end_date) values
  (tests.m16b('entry_d'), tests.m16b('dan'), 'pto', 'full', '2099-08-03', '2099-08-03');

select is(
  (select concat_ws('|', e.org_id, e.team_id, e.scope) from public.event e where e.id = tests.m16b('event_d')),
  concat_ws('|', tests.m16b('org_d'), tests.m16b('team_d1'), 'team'),
  'fixture: E-D is in Org D, on team D1, scope team'
);
select is(
  (select e.status from public.entry e where e.id = tests.m16b('entry_d')),
  'pending'::public.entry_status,
  'fixture: N-D is pending (D1 requires approval for PTO)'
);

-- ---------------------------------------------------------------------------------------------
-- AC-1. `is_org_admin` says yes for an admin of the org named.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select is(public.is_org_admin(tests.id('admin_t'), tests.shared_org()), true,
  'AC-1: is_org_admin(Ada, Org public) is true');
select is(public.is_org_admin(tests.m16b('dora'), tests.m16b('org_d')), true,
  'AC-1: is_org_admin(Dora, Org D) is true');

-- ---------------------------------------------------------------------------------------------
-- AC-2. And no for every other pair, without raising.
-- ---------------------------------------------------------------------------------------------
select is(public.is_org_admin(tests.id('admin_t'), tests.m16b('org_d')), false,
  'AC-2: is_org_admin(Ada, Org D) is false');
select is(public.is_org_admin(tests.m16b('dora'), tests.shared_org()), false,
  'AC-2: is_org_admin(Dora, Org public) is false');
select is(public.is_org_admin(tests.id('manager_t'), tests.shared_org()), false,
  'AC-2: is_org_admin(Mona, Org public) is false');
select is(public.is_org_admin(tests.id('member_t'), tests.shared_org()), false,
  'AC-2: is_org_admin(Thanh, Org public) is false');
select is(public.is_org_admin(tests.id('removed_admin_t'), tests.shared_org()), false,
  'AC-2: is_org_admin(Rex, Org public) is false');
select is(public.is_org_admin(tests.id('pending_p'), tests.shared_org()), false,
  'AC-2: is_org_admin(Pat, Org public) is false');
select is(public.is_org_admin(tests.m16b('sam'), tests.shared_org()), false,
  'AC-2: is_org_admin(Sam, Org public) is false');
select is(public.is_org_admin(tests.m16b('sam'), tests.m16b('org_d')), false,
  'AC-2: is_org_admin(Sam, Org D) is false');
select is(public.is_org_admin(tests.m16b('nobody'), tests.shared_org()), false,
  'AC-2: is_org_admin(no one, Org public) is false');
select is(public.is_org_admin(tests.id('admin_t'), null), false,
  'AC-2: is_org_admin(Ada, null) is false');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-3. `is_admin` is gone, and nothing calls it.
-- ---------------------------------------------------------------------------------------------
select hasnt_function('public', 'is_admin', array['uuid'], 'AC-3: public.is_admin(uuid) does not exist');
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosrc ~ 'public\.is_admin\s*\('),
  0,
  'AC-3: no function in public has a body that calls public.is_admin('
);
select is(
  (select count(*)::int from pg_policies
    where coalesce(qual, '') ~ '\mis_admin\(' or coalesce(with_check, '') ~ '\mis_admin\('),
  0,
  'AC-3: no policy in any schema calls is_admin('
);
select is(
  (select p.prosecdef from pg_proc p where p.oid = 'public.is_org_admin(uuid,uuid)'::regprocedure),
  true,
  'AC-3: public.is_org_admin(uuid,uuid) is security definer'
);
select is(has_function_privilege('authenticated', 'public.is_org_admin(uuid,uuid)', 'execute'), true,
  'AC-3: authenticated holds EXECUTE on is_org_admin');
select is(has_function_privilege('anon', 'public.is_org_admin(uuid,uuid)', 'execute'), false,
  'AC-3: anon does not hold EXECUTE on is_org_admin');

-- ---------------------------------------------------------------------------------------------
-- AC-4. The sign-up queue and the admin lists stay org powers.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select throws_ok(
  format($$select public.admit_member(%L::uuid, %L::uuid)$$, tests.m16b('pia'), tests.m16b('team_d1')),
  '42501', null, 'AC-4: Ada admitting Pia to D1 is refused with 42501');
select tests.authenticate_as(tests.m16b('sam'));
select throws_ok(
  format($$select public.admit_member(%L::uuid, %L::uuid)$$, tests.m16b('pia'), tests.m16b('team_d1')),
  '42501', null, 'AC-4: Sam admitting Pia to D1 is refused with 42501');
select tests.clear_authentication();
select is((select m.status from public.member m where m.id = tests.m16b('pia')),
  'pending'::public.member_status, 'AC-4: after both refusals Pia is still pending');
select is(public.member_roster_team_id(tests.m16b('pia')), null::uuid,
  'AC-4: after both refusals Pia is on no team');

select tests.authenticate_as(tests.m16b('dora'));
select lives_ok(
  format($$select public.admit_member(%L::uuid, %L::uuid)$$, tests.m16b('pia'), tests.m16b('team_d1')),
  'AC-4: Dora admits Pia to D1');
select tests.clear_authentication();
select is((select m.status from public.member m where m.id = tests.m16b('pia')),
  'approved'::public.member_status, 'AC-4: Pia is approved');
select is(public.member_roster_team_id(tests.m16b('pia')), tests.m16b('team_d1'),
  'AC-4: Pia is on D1');

select tests.authenticate_as(tests.m16b('dora'));
select is((select array_agg(t.id order by t.id) from public.list_teams() t),
  array[tests.m16b('team_d1')],
  'AC-4: Dora''s list_teams() is D1 and no Org public team');
select tests.authenticate_as(tests.id('admin_t'));
select is((select coalesce(array_agg(t.id order by t.id), '{}') from public.list_teams() t),
  tests.m16b_team_ids(tests.shared_org()),
  'AC-4: Ada''s list_teams() is Org public''s teams');
select is((select count(*)::int from public.list_teams() t where t.id = tests.m16b('team_d1')), 0,
  'AC-4: Ada''s list_teams() does not include D1');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-5. The event override stays an org power.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select is(
  tests.rows_affected(format($$update public.event set name = 'renamed by Ada' where id = %L::uuid$$,
    tests.m16b('event_d'))),
  0::bigint, 'AC-5: Ada updating E-D''s title affects zero rows');
select is(
  tests.rows_affected(format($$delete from public.event where id = %L::uuid$$, tests.m16b('event_d'))),
  0::bigint, 'AC-5: Ada deleting E-D affects zero rows');
select tests.clear_authentication();
select is((select e.name from public.event e where e.id = tests.m16b('event_d')), 'E-D',
  'AC-5: E-D exists and is unchanged');
select is(public.may_manage_event(tests.m16b('event_d'), tests.id('admin_t')), false,
  'AC-5: may_manage_event(E-D, Ada) is false');

select tests.authenticate_as(tests.m16b('dora'));
select is(
  tests.rows_affected(format($$update public.event set name = 'renamed by Dora' where id = %L::uuid$$,
    tests.m16b('event_d'))),
  1::bigint, 'AC-5: Dora updating E-D''s title affects one row');
select tests.clear_authentication();
select is((select e.name from public.event e where e.id = tests.m16b('event_d')), 'renamed by Dora',
  'AC-5: E-D''s title reads back as Dora wrote it');
select is(public.may_manage_event(tests.m16b('event_d'), tests.m16b('dora')), true,
  'AC-5: may_manage_event(E-D, Dora) is true');

-- ---------------------------------------------------------------------------------------------
-- AC-6. A dedicated org's holidays are written by its own admin.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m16b('dora'));
select lives_ok(
  format($$insert into public.holiday (date, name, org_id) values ('2099-08-01', 'D by Dora', %L::uuid)$$,
    tests.m16b('org_d')),
  'AC-6: Dora inserts a holiday for Org D');
select tests.authenticate_as(tests.id('admin_t'));
select throws_ok(
  format($$insert into public.holiday (date, name, org_id) values ('2099-08-02', 'D by Ada', %L::uuid)$$,
    tests.m16b('org_d')),
  '42501', null, 'AC-6: Ada inserting a holiday for Org D is refused with 42501');
select tests.clear_authentication();
select is((select count(*)::int from public.holiday h where h.name = 'D by Dora' and h.org_id = tests.m16b('org_d')),
  1, 'AC-6: Dora''s holiday is stored');
select is((select count(*)::int from public.holiday h where h.name = 'D by Ada'),
  0, 'AC-6: no holiday of Ada''s is stored');

-- ---------------------------------------------------------------------------------------------
-- AC-7. The entry decider's admin half stays an org power.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select is(
  tests.rows_affected(format($$update public.entry set status = 'approved' where id = %L::uuid$$,
    tests.m16b('entry_d'))),
  0::bigint, 'AC-7: Ada approving N-D affects zero rows');
select tests.clear_authentication();
select is((select e.status from public.entry e where e.id = tests.m16b('entry_d')),
  'pending'::public.entry_status, 'AC-7: N-D stays pending');

select tests.authenticate_as(tests.m16b('dora'));
select is(
  tests.rows_affected(format($$update public.entry set status = 'approved' where id = %L::uuid$$,
    tests.m16b('entry_d'))),
  1::bigint, 'AC-7: Dora approving N-D affects one row');
select tests.clear_authentication();
select is((select e.status from public.entry e where e.id = tests.m16b('entry_d')),
  'approved'::public.entry_status, 'AC-7: N-D is approved');

select * from finish();
rollback;
