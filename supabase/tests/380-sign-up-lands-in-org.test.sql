-- MIR-19-f AC-9: a sign-up lands in the org of the address it was made at, and a code that names no org
-- refuses the sign-up (ADR-099 decisions 2, 3 and 5). The trigger under test is
-- `public.admit_allow_listed_member()` on `auth.users`.
--
-- Fixture, added here on top of `tests.seed()` as `postgres`:
--   * Org F, `org_code = 'org-f-mir19f-380'`, with Team F and Fay, an approved org admin of Org F
--     placed on Team F.
--   * Org public's org admin is `tests.id('admin_t')` (Ada), from `tests.seed()`. Its code is `shared`.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(17);
select tests.seed();

create function tests.m380(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('c3800000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('org_f', '01'), ('team_f', '02'), ('fay', '11'),
      ('s1', '21'), ('s2', '22'), ('s3', '23'), ('s4', '24'), ('s5', '25'), ('s6', '26'),
      ('s7', '27'), ('bad1', '31'), ('bad2', '32')
    ) as v(label, nn)
   where v.label = p_label;
$$;

-- Org public's id, readable by the test whoever is authenticated.
create function tests.shared_org_380() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

insert into public.org (id, org_code, name) values (tests.m380('org_f'), 'org-f-mir19f-380', 'Org F');
insert into public.team (id, name, org_id) values (tests.m380('team_f'), 'Team F', tests.m380('org_f'));
insert into auth.users (id, email) values (tests.m380('fay'), 'fay@mir19f-380.test');
insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m380('fay'), tests.m380('org_f'), 'Fay', '1.png', tests.member_role('admin'), 'approved', 'fay@mir19f-380.test');
select tests.put_on_team(tests.m380('fay'), tests.m380('team_f'));

-- ---------------------------------------------------------------------------------------------
-- AC-9.1. Confirmed at insert, with Org F's code.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values (tests.m380('s1'), 's1@mir19f-380.test', now(), '{"org_code": "org-f-mir19f-380"}'::jsonb);

select is((select m.org_id from public.member m where m.id = tests.m380('s1')), tests.m380('org_f'),
  'AC-9.1: a confirmed sign-up with Org F''s code has a member row in Org F');
select is((select m.status::text from public.member m where m.id = tests.m380('s1')), 'pending',
  'AC-9.1: it is pending');
select is((select m.role::text from public.member m where m.id = tests.m380('s1')), 'member',
  'AC-9.1: it has role member');
select is((select count(*)::int from public.membership where member_id = tests.m380('s1')), 0,
  'AC-9.1: it has no membership row');

-- ---------------------------------------------------------------------------------------------
-- AC-9.2. Unconfirmed at insert, then confirmed.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data)
values (tests.m380('s2'), 's2@mir19f-380.test', '{"org_code": "org-f-mir19f-380"}'::jsonb);
select ok(not exists (select 1 from public.member where id = tests.m380('s2')),
  'AC-9.2: an unconfirmed sign-up creates no member row on insert');
update auth.users set email_confirmed_at = now() where id = tests.m380('s2');
select is((select m.org_id from public.member m where m.id = tests.m380('s2')), tests.m380('org_f'),
  'AC-9.2: confirming it creates the row in Org F');

-- ---------------------------------------------------------------------------------------------
-- AC-9.3. No code, and a blank code, are Org public.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at)
values (tests.m380('s3'), 's3@mir19f-380.test', now());
select is((select m.org_id from public.member m where m.id = tests.m380('s3')), tests.shared_org_380(),
  'AC-9.3: no org_code key lands in Org public');
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values (tests.m380('s4'), 's4@mir19f-380.test', now(), '{"org_code": "   "}'::jsonb);
select is((select m.org_id from public.member m where m.id = tests.m380('s4')), tests.shared_org_380(),
  'AC-9.3: a blank org_code lands in Org public');

-- ---------------------------------------------------------------------------------------------
-- AC-9.4. Org public's own code.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values (tests.m380('s5'), 's5@mir19f-380.test', now(), '{"org_code": "shared"}'::jsonb);
select is((select m.org_id from public.member m where m.id = tests.m380('s5')), tests.shared_org_380(),
  'AC-9.4: org_code shared lands in Org public');

-- ---------------------------------------------------------------------------------------------
-- AC-9.5. A code that names no org, or a reserved word, refuses the sign-up.
-- ---------------------------------------------------------------------------------------------
select throws_ok(
  format($f$insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
            values (%L, 'bad1@mir19f-380.test', now(), '{"org_code": "no-such-org-380"}'::jsonb)$f$,
         tests.m380('bad1')),
  'P0002', 'sign_up_org_unknown',
  'AC-9.5: an unknown org_code makes the auth.users insert throw sign_up_org_unknown');
select throws_ok(
  format($f$insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
            values (%L, 'bad2@mir19f-380.test', now(), '{"org_code": "admin"}'::jsonb)$f$,
         tests.m380('bad2')),
  'P0002', 'sign_up_org_unknown',
  'AC-9.5: a reserved org_code makes the auth.users insert throw sign_up_org_unknown');
select ok(
  not exists (select 1 from auth.users where id in (tests.m380('bad1'), tests.m380('bad2'))),
  'AC-9.5: neither refused sign-up left an auth.users row');
select ok(
  not exists (select 1 from public.member where id in (tests.m380('bad1'), tests.m380('bad2'))),
  'AC-9.5: neither refused sign-up left a member row');

-- ---------------------------------------------------------------------------------------------
-- AC-9.6. Metadata never sets the role.
-- ---------------------------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data)
values (tests.m380('s6'), 's6@mir19f-380.test', now(),
        '{"org_code": "org-f-mir19f-380", "role": "org_admin"}'::jsonb);
select is(
  (select concat_ws('|', m.org_id, m.role::text) from public.member m where m.id = tests.m380('s6')),
  concat_ws('|', tests.m380('org_f'), 'member'),
  'AC-9.6: raw_user_meta_data.role = org_admin still creates role member, in Org F (TEA-01 AC-9)');

-- ---------------------------------------------------------------------------------------------
-- AC-9.7. Who can see Org F's pending row.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m380('fay'));
select is((select count(*)::int from public.member where id = tests.m380('s1')), 1,
  'AC-9.7: Org F''s org admin sees the new pending row');
select tests.authenticate_as(tests.id('admin_t'));
select is((select count(*)::int from public.member where id = tests.m380('s1')), 0,
  'AC-9.7: Org public''s org admin does not');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-9.8. 250 AC-8 still holds.
-- ---------------------------------------------------------------------------------------------
select doesnt_match(
  (select p.prosrc from pg_catalog.pg_proc p
    where p.oid = 'public.admit_allow_listed_member()'::regprocedure),
  '\mteam_id\M',
  'AC-9.8: admit_allow_listed_member() does not name team_id');

select * from finish();
rollback;
