-- MIR-16 AC-1 to AC-6: no org admin reads or marks an issue report any more; a system admin at aal2
-- reads every org's reports and marks one done, through two security definer RPCs; nobody else uses
-- the door (ADR-082 decision 1, 01-plan.md § 4.1, § 4.2).
--
-- Fixture, added here on top of `tests.seed()` (Org public; `admin_t` is Ada, `member_t` is Thanh):
--   * Org D, with team D1;
--   * Dora (`admin`, approved) and Dan (`member`, approved), both of Org D, inserted without
--     `team_id` and given a `membership` row with `tests.put_on_team` — the shape the schema has had
--     since `member.team_id` was dropped (270-member-team-id-dropped.test.sql), and the pattern
--     150-write-path-org-bound.test.sql:39-61 already uses for a second org's fixture;
--   * a `system_admin` row for Sam, with `grant_system_admin`, as 190-system-admin.test.sql and
--     200-org-management.test.sql do;
--   * R-P, by Thanh (older), and R-D, by Dan (newer, with one image path and a matching
--     `storage.objects` row in the `issue-report` bucket) — so "newest first" has something to prove.
--
-- `tests.seed()` ALSO WRITES A THIRD REPORT, by member_t (`_isolation.psql:158-159`), with
-- `created_at` defaulting to `now()` — later than both R-P and R-D, so AC-4's ordering assertion is
-- restricted to R-P and R-D's ids (01-plan.md § 4.2, re-plan of 2026-11-07, review finding 2,
-- `04-review.md`). AC-1 to AC-3 and AC-6 are unaffected: they assert over every row or none, and the
-- seed's own report is refused the same way R-P and R-D are.
--
-- "At aal2" is claims `{"sub", "role": "authenticated", "aal": "aal2"}`; `tests.authenticate_at` is
-- copied from 200-org-management.test.sql:33-40, as `_isolation.psql` is not edited.
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(31);
select tests.seed();

-- The fixture ids local to this file. Labels are fixture names, not schema fields.
create function tests.m16(p_label text) returns uuid
  language sql immutable security invoker set search_path = '' as $$
  select ('c2700000-0000-4000-8000-0000000000' || v.nn)::uuid
    from (values
      ('org_d', '01'), ('team_d1', '02'), ('dora', '11'), ('dan', '12'), ('sam', '21'),
      ('report_p', '31'), ('report_d', '32'), ('nobody', 'ff')
    ) as v(label, nn)
   where v.label = p_label;
$$;

-- Become X at an assurance level. Transaction-local, like `tests.authenticate_as`. Copied from
-- 200-org-management.test.sql:33-40.
create function tests.authenticate_at(p_id uuid, p_aal text) returns void
  language plpgsql security invoker set search_path = '' as $$
begin
  perform set_config('request.jwt.claims',
                     json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true);
  perform set_config('role', 'authenticated', true);
end;
$$;

-- Org public's id. Definer, so a test running as `authenticated` can name it in a call.
create function tests.shared_org() returns uuid
  language sql stable security definer set search_path = '' as $$
  select o.id from public.org o where o.is_shared_tenant;
$$;

insert into public.org (id, org_code, name) values (tests.m16('org_d'), 'org-d-mir16-270', 'Org D');
insert into public.team (id, name, org_id) values (tests.m16('team_d1'), 'Team D1', tests.m16('org_d'));

insert into auth.users (id, email) values
  (tests.m16('dora'), 'dora@mir16-270.test'),
  (tests.m16('dan'), 'dan@mir16-270.test'),
  (tests.m16('sam'), 'sam@mir16-270.test');

insert into public.member (id, org_id, display_name, avatar, role, status, email) values
  (tests.m16('dora'), tests.m16('org_d'), 'Dora', '1.png', tests.member_role('admin'), 'approved', 'dora@mir16-270.test'),
  (tests.m16('dan'), tests.m16('org_d'), 'Dan', '1.png', 'member', 'approved', 'dan@mir16-270.test');
select tests.put_on_team(tests.m16('dora'), tests.m16('team_d1'));
select tests.put_on_team(tests.m16('dan'), tests.m16('team_d1'));

select public.grant_system_admin(tests.m16('sam'));

-- R-P (Thanh, Org public, older) and R-D (Dan, Org D, newer, one image).
insert into public.issue_report (id, member_id, kind, message, page, status, created_at) values
  (tests.m16('report_p'), tests.id('member_t'), 'bug', 'R-P', '/week', 'open', '2026-11-01T00:00:00+00'),
  (tests.m16('report_d'), tests.m16('dan'), 'idea', 'R-D', '/month', 'open', '2026-11-02T00:00:00+00');
update public.issue_report set images = array[tests.m16('dan')::text || '/d1.png']
 where id = tests.m16('report_d');
insert into storage.objects (bucket_id, name) values
  ('issue-report', tests.m16('dan')::text || '/d1.png');

select is(
  (select count(*)::int from public.issue_report where id in (tests.m16('report_p'), tests.m16('report_d'))),
  2,
  'fixture: R-P and R-D exist'
);

-- ---------------------------------------------------------------------------------------------
-- AC-1. No org admin reads a report.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select is_empty($$select id from public.issue_report$$, 'AC-1: Ada (Org public''s admin) reads zero issue reports');
select tests.authenticate_as(tests.m16('dora'));
select is_empty($$select id from public.issue_report$$, 'AC-1: Dora (Org D''s admin) reads zero issue reports');
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-2. Nor marks one done.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.id('admin_t'));
select is(
  tests.rows_affected(format($$update public.issue_report set status = 'done' where id = %L::uuid$$, tests.m16('report_p'))),
  0::bigint,
  'AC-2: Ada updating R-P''s status affects zero rows'
);
select tests.authenticate_as(tests.m16('dora'));
select is(
  tests.rows_affected(format($$update public.issue_report set status = 'done' where id = %L::uuid$$, tests.m16('report_d'))),
  0::bigint,
  'AC-2: Dora updating R-D''s status affects zero rows'
);
select tests.clear_authentication();
select is((select status::text from public.issue_report where id = tests.m16('report_p')), 'open',
  'AC-2: R-P stays open');
select is((select status::text from public.issue_report where id = tests.m16('report_d')), 'open',
  'AC-2: R-D stays open');

-- ---------------------------------------------------------------------------------------------
-- AC-3. Nor reads a report's image.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_as(tests.m16('dora'));
select is_empty(
  format($$select name from storage.objects where bucket_id = 'issue-report' and name = %L$$,
    tests.m16('dan')::text || '/d1.png'),
  'AC-3: Dora selecting R-D''s image from storage.objects returns zero rows'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-4. A system admin at aal2 lists every org's reports, newest first, with every field.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.m16('sam'), 'aal2');
-- `tests.seed()` writes a third report, by member_t, whose created_at defaults to now()
-- (_isolation.psql:158-159; 20260926100000_solo_issue_report.sql:56) — later than R-P and R-D, so it
-- is the newest row list_issue_reports() returns. Restricted to R-P and R-D (01-plan.md § 4.2, added
-- at the re-plan of 2026-11-07), the ordering still proves newest-first across both orgs.
select results_eq(
  format(
    $$select id from public.list_issue_reports() where id in (%L::uuid, %L::uuid)$$,
    tests.m16('report_d'), tests.m16('report_p')
  ),
  format($$values (%L::uuid), (%L::uuid)$$, tests.m16('report_d'), tests.m16('report_p')),
  'AC-4: Sam at aal2 lists R-D then R-P, newest first'
);
select results_eq(
  format(
    $$select org_id, org_name, member_id, member_name, kind::text, message, page, status::text, images
        from public.list_issue_reports() where id = %L::uuid$$,
    tests.m16('report_d')
  ),
  format(
    $$values (%L::uuid, 'Org D'::text, %L::uuid, 'Dan'::text, 'idea'::text, 'R-D'::text, '/month'::text,
              'open'::text, array[%L::text])$$,
    tests.m16('org_d'), tests.m16('dan'), tests.m16('dan')::text || '/d1.png'
  ),
  'AC-4: R-D carries its org, author, kind, message, page, status and image path'
);
select results_eq(
  format(
    $$select org_id, org_name, member_id, member_name, kind::text, message, page, status::text, images
        from public.list_issue_reports() where id = %L::uuid$$,
    tests.m16('report_p')
  ),
  format(
    $$values (%L::uuid, 'Org public'::text, %L::uuid, 'member_t'::text, 'bug'::text, 'R-P'::text, '/week'::text,
              'open'::text, array[]::text[])$$,
    tests.shared_org(), tests.id('member_t')
  ),
  'AC-4: R-P carries its org, author, kind, message, page, status and no images'
);
select tests.clear_authentication();

-- ---------------------------------------------------------------------------------------------
-- AC-5. And marks one done, and open again.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.m16('sam'), 'aal2');
select lives_ok(
  format($$select public.set_issue_report_status(%L::uuid, 'done')$$, tests.m16('report_d')),
  'AC-5: Sam at aal2 marks R-D done'
);
select tests.clear_authentication();
select is((select status::text from public.issue_report where id = tests.m16('report_d')), 'done',
  'AC-5: R-D is done');
select tests.authenticate_at(tests.m16('sam'), 'aal2');
select lives_ok(
  format($$select public.set_issue_report_status(%L::uuid, 'open')$$, tests.m16('report_d')),
  'AC-5: Sam at aal2 reopens R-D'
);
select tests.clear_authentication();
select is((select status::text from public.issue_report where id = tests.m16('report_d')), 'open',
  'AC-5: R-D is open again');

-- ---------------------------------------------------------------------------------------------
-- AC-6. Nobody else uses the door, and an unknown id is refused with P0002.
-- ---------------------------------------------------------------------------------------------
select tests.authenticate_at(tests.m16('sam'), 'aal1');
select throws_ok('select * from public.list_issue_reports()', '42501', null,
  'AC-6: Sam at aal1 is refused list_issue_reports() with 42501');
select throws_ok(
  format($$select public.set_issue_report_status(%L::uuid, 'done')$$, tests.m16('report_p')),
  '42501', null, 'AC-6: Sam at aal1 is refused set_issue_report_status(R-P) with 42501');

select tests.authenticate_as(tests.id('admin_t'));
select throws_ok('select * from public.list_issue_reports()', '42501', null,
  'AC-6: Ada is refused list_issue_reports() with 42501');
select throws_ok(
  format($$select public.set_issue_report_status(%L::uuid, 'done')$$, tests.m16('report_p')),
  '42501', null, 'AC-6: Ada is refused set_issue_report_status(R-P) with 42501');

select tests.authenticate_as(tests.m16('dora'));
select throws_ok('select * from public.list_issue_reports()', '42501', null,
  'AC-6: Dora is refused list_issue_reports() with 42501');
select throws_ok(
  format($$select public.set_issue_report_status(%L::uuid, 'done')$$, tests.m16('report_p')),
  '42501', null, 'AC-6: Dora is refused set_issue_report_status(R-P) with 42501');

select tests.authenticate_as(tests.id('member_t'));
select throws_ok('select * from public.list_issue_reports()', '42501', null,
  'AC-6: Thanh is refused list_issue_reports() with 42501');
select throws_ok(
  format($$select public.set_issue_report_status(%L::uuid, 'done')$$, tests.m16('report_p')),
  '42501', null, 'AC-6: Thanh is refused set_issue_report_status(R-P) with 42501');

select tests.clear_authentication();
select is((select status::text from public.issue_report where id = tests.m16('report_p')), 'open',
  'AC-6: R-P stays open after every refusal');

select tests.authenticate_at(tests.m16('sam'), 'aal2');
select throws_ok(
  format($$select public.set_issue_report_status(%L::uuid, 'done')$$, tests.m16('nobody')),
  'P0002', null, 'AC-6: Sam at aal2 setting status on an unknown id is refused with P0002');
select tests.clear_authentication();

select ok(not has_function_privilege('anon', 'public.list_issue_reports()', 'EXECUTE'),
  'AC-6: anon has no EXECUTE on list_issue_reports()');
select ok(not has_function_privilege('anon', 'public.set_issue_report_status(uuid,public.issue_status)', 'EXECUTE'),
  'AC-6: anon has no EXECUTE on set_issue_report_status(uuid,public.issue_status)');

-- ---------------------------------------------------------------------------------------------
-- The three member-era policies are gone; the system-scope image policy exists.
-- ---------------------------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'issue_report' and policyname = 'issue_report_select_admin'),
  0, 'issue_report_select_admin no longer exists'
);
select is(
  (select count(*)::int from pg_catalog.pg_policies
    where schemaname = 'public' and tablename = 'issue_report' and policyname = 'issue_report_update_admin'),
  0, 'issue_report_update_admin no longer exists'
);
select is(
  (select count(*)::int from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'issue_image_select_admin'),
  0, 'issue_image_select_admin no longer exists'
);
select is(
  (select count(*)::int from pg_catalog.pg_policies
    where schemaname = 'storage' and tablename = 'objects' and policyname = 'issue_image_select_system'),
  1, 'issue_image_select_system exists'
);

select * from finish();
rollback;
