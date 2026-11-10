-- MIR-11: pgTAP verification of `public.team_role`, `public.org`, `public.membership`,
-- parent `(id, org_id)` unique keys, and all 18 composite foreign keys (AC-1 through AC-7).
\set ON_ERROR_STOP 1
begin;
\ir _isolation.psql
set local search_path = extensions, public;
select plan(92);
select tests.seed();

-- ---------------------------------------------------------------------------------------------
-- 1. Catalogue & constraint inventory (AC-1, AC-2, AC-3)
-- ---------------------------------------------------------------------------------------------

-- AC-1: `public.team_role` enum and `public.org` table & columns
select has_type('public', 'team_role'::name, 'AC-1: public.team_role type exists');
select enum_has_labels('public', 'team_role'::name, array['member', 'manager'],
  'AC-1: public.team_role has labels (member, manager)');
select has_table('public', 'org'::name, 'AC-1: public.org table exists');

select has_column('public', 'org', 'id', 'AC-1: org.id exists');
select has_column('public', 'org', 'org_code', 'AC-1: org.org_code exists');
select has_column('public', 'org', 'name', 'AC-1: org.name exists');
select has_column('public', 'org', 'is_shared_tenant', 'AC-1: org.is_shared_tenant exists');
select has_column('public', 'org', 'plan', 'AC-1: org.plan exists');
select has_column('public', 'org', 'max_members', 'AC-1: org.max_members exists');
select has_column('public', 'org', 'max_teams', 'AC-1: org.max_teams exists');
select has_column('public', 'org', 'timezone', 'AC-1: org.timezone exists');
select has_column('public', 'org', 'created_by', 'AC-1: org.created_by exists');
select has_column('public', 'org', 'created_at', 'AC-1: org.created_at exists');
select has_column('public', 'org', 'updated_at', 'AC-1: org.updated_at exists');

-- AC-1: `public.org` constraints, index, trigger, RLS, and privilege revocations
select set_has(
  $$select c.conname::text
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_class r on r.oid = c.conrelid
      join pg_catalog.pg_namespace n on n.oid = r.relnamespace
     where n.nspname = 'public' and r.relname = 'org'$$,
  $$values
    ('org_pkey'),
    ('org_org_code_key'),
    ('org_code_shape'),
    ('org_code_not_reserved'),
    ('org_name_not_blank'),
    ('org_plan_not_blank'),
    ('org_timezone_not_blank'),
    ('org_max_members_positive'),
    ('org_max_teams_positive')$$,
  'AC-1: public.org has all required PK, unique, and check constraints'
);

select has_index('public', 'org', 'org_one_shared_tenant_idx',
  'AC-1: public.org has partial unique index org_one_shared_tenant_idx');
select has_trigger('public', 'org', 'org_enforce_immutable_org_code',
  'AC-1: public.org has trigger org_enforce_immutable_org_code');

select ok(
  (select r.relrowsecurity from pg_catalog.pg_class r
     join pg_catalog.pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public' and r.relname = 'org'),
  'AC-1: public.org has row level security enabled'
);
select ok(
  not has_table_privilege('anon', 'public.org', 'SELECT')
  and not has_table_privilege('authenticated', 'public.org', 'SELECT'),
  'AC-1: anon and authenticated hold no table privileges on public.org'
);

-- AC-2: `public.membership` table, columns, constraints, indexes, RLS, and revocations
select has_table('public', 'membership'::name, 'AC-2: public.membership table exists');
select has_column('public', 'membership', 'id', 'AC-2: membership.id exists');
select has_column('public', 'membership', 'org_id', 'AC-2: membership.org_id exists');
select has_column('public', 'membership', 'team_id', 'AC-2: membership.team_id exists');
select has_column('public', 'membership', 'member_id', 'AC-2: membership.member_id exists');
select has_column('public', 'membership', 'team_role', 'AC-2: membership.team_role exists');
select has_column('public', 'membership', 'is_primary', 'AC-2: membership.is_primary exists');
select has_column('public', 'membership', 'joined_at', 'AC-2: membership.joined_at exists');
select has_column('public', 'membership', 'left_at', 'AC-2: membership.left_at exists');
select has_column('public', 'membership', 'created_at', 'AC-2: membership.created_at exists');
select has_column('public', 'membership', 'updated_at', 'AC-2: membership.updated_at exists');

select set_has(
  $$select c.conname::text
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_class r on r.oid = c.conrelid
      join pg_catalog.pg_namespace n on n.oid = r.relnamespace
     where n.nspname = 'public' and r.relname = 'membership'$$,
  $$values
    ('membership_pkey'),
    ('membership_id_org_id_key'),
    ('membership_team_org_fk'),
    ('membership_member_org_fk'),
    ('membership_left_after_joined'),
    ('membership_inactive_not_primary')$$,
  'AC-2: public.membership has all required PK, unique, FK, and check constraints'
);

select has_index('public', 'membership', 'membership_active_team_member_idx',
  'AC-2: public.membership has index membership_active_team_member_idx');
select has_index('public', 'membership', 'membership_one_active_primary_idx',
  'AC-2: public.membership has index membership_one_active_primary_idx');
select has_index('public', 'membership', 'membership_member_active_idx',
  'AC-2: public.membership has index membership_member_active_idx');
select has_index('public', 'membership', 'membership_org_id_idx',
  'AC-2: public.membership has index membership_org_id_idx');
select has_index('public', 'membership', 'membership_team_history_idx',
  'AC-2: public.membership has index membership_team_history_idx');

select ok(
  (select r.relrowsecurity from pg_catalog.pg_class r
     join pg_catalog.pg_namespace n on n.oid = r.relnamespace
    where n.nspname = 'public' and r.relname = 'membership'),
  'AC-2: public.membership has row level security enabled'
);
select ok(
  not has_table_privilege('anon', 'public.membership', 'SELECT')
  and not has_table_privilege('authenticated', 'public.membership', 'SELECT'),
  'AC-2: anon and authenticated hold no table privileges on public.membership'
);

-- AC-3: `org_id` on all 12 existing tenant-scoped tables + `entry.primary_team_id`
select has_column('public', 'team', 'org_id', 'AC-3: team.org_id exists');
select has_column('public', 'member', 'org_id', 'AC-3: member.org_id exists');
select has_column('public', 'entry', 'org_id', 'AC-3: entry.org_id exists');
select has_column('public', 'entry', 'primary_team_id', 'AC-3: entry.primary_team_id exists');
select has_column('public', 'holiday', 'org_id', 'AC-3: holiday.org_id exists');
select has_column('public', 'busy_day', 'org_id', 'AC-3: busy_day.org_id exists');
select has_column('public', 'issue_report', 'org_id', 'AC-3: issue_report.org_id exists');
select has_column('public', 'event', 'org_id', 'AC-3: event.org_id exists');
select has_column('public', 'event_invitee', 'org_id', 'AC-3: event_invitee.org_id exists');
select has_column('public', 'event_attendance', 'org_id', 'AC-3: event_attendance.org_id exists');
select has_column('public', 'event_guest_link', 'org_id', 'AC-3: event_guest_link.org_id exists');
select has_column('public', 'event_guest', 'org_id', 'AC-3: event_guest.org_id exists');
select has_column('public', 'notification', 'org_id', 'AC-3: notification.org_id exists');

-- AC-3: all 4 parent `(id, org_id)` unique constraints exist in `pg_constraint` (`contype = 'u'`)
select set_has(
  $$select c.conname::text
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_namespace n on n.oid = c.connamespace
     where n.nspname = 'public' and c.contype = 'u'$$,
  $$values
    ('team_id_org_id_key'),
    ('member_id_org_id_key'),
    ('event_id_org_id_key'),
    ('membership_id_org_id_key')$$,
  'AC-3: all 4 parent (id, org_id) unique constraints exist'
);

-- AC-3: all 12 `<table_name>_org_id_fkey` foreign keys and all 18 composite foreign keys exist
select set_has(
  $$select c.conname::text
      from pg_catalog.pg_constraint c
      join pg_catalog.pg_namespace n on n.oid = c.connamespace
     where n.nspname = 'public' and c.contype = 'f'$$,
  $$values
    ('team_org_id_fkey'),
    ('member_org_id_fkey'),
    ('entry_org_id_fkey'),
    ('holiday_org_id_fkey'),
    ('busy_day_org_id_fkey'),
    ('issue_report_org_id_fkey'),
    ('event_org_id_fkey'),
    ('event_invitee_org_id_fkey'),
    ('event_attendance_org_id_fkey'),
    ('event_guest_link_org_id_fkey'),
    ('event_guest_org_id_fkey'),
    ('notification_org_id_fkey'),
    ('membership_team_org_fk'),
    ('membership_member_org_fk'),
    ('entry_member_org_fk'),
    ('entry_primary_team_org_fk'),
    ('entry_approved_by_org_fk'),
    ('busy_day_member_org_fk'),
    ('issue_report_member_org_fk'),
    ('event_creator_org_fk'),
    ('event_team_org_fk'),
    ('event_invitee_event_org_fk'),
    ('event_invitee_member_org_fk'),
    ('event_attendance_event_org_fk'),
    ('event_attendance_member_org_fk'),
    ('event_guest_link_event_org_fk'),
    ('event_guest_event_org_fk'),
    ('notification_recipient_org_fk'),
    ('notification_actor_org_fk'),
    ('notification_event_org_fk')$$,
  'AC-3: all 12 org_id FKs and all 18 composite FKs exist in pg_constraint'
);

-- AC-3: `<table_name>_org_id_idx` on all 12 existing tenant-scoped tables
select set_has(
  $$select i.relname::text
      from pg_catalog.pg_class i
      join pg_catalog.pg_namespace n on n.oid = i.relnamespace
     where n.nspname = 'public' and i.relkind = 'i'$$,
  $$values
    ('team_org_id_idx'),
    ('member_org_id_idx'),
    ('entry_org_id_idx'),
    ('entry_primary_team_org_idx'),
    ('holiday_org_id_idx'),
    ('busy_day_org_id_idx'),
    ('issue_report_org_id_idx'),
    ('event_org_id_idx'),
    ('event_invitee_org_id_idx'),
    ('event_attendance_org_id_idx'),
    ('event_guest_link_org_id_idx'),
    ('event_guest_org_id_idx'),
    ('notification_org_id_idx')$$,
  'AC-3: all 12 <table_name>_org_id_idx indexes and entry_primary_team_org_idx exist'
);

-- ---------------------------------------------------------------------------------------------
-- 2. `public.org` constraints and immutability trigger (AC-1) & Two-tenant fixture setup
-- ---------------------------------------------------------------------------------------------

-- Insert Org A and Org B. MIR-12: neither is the shared tenant — Org public, created by
-- 20261031120000_mir12_backfill_org_public.sql, holds the one slot `org_one_shared_tenant_idx` allows.
insert into public.org (id, org_code, name, is_shared_tenant) values
  ('d0000000-0000-4000-8000-000000000a01', 'org-alpha', 'Org Alpha', false),
  ('d0000000-0000-4000-8000-000000000b01', 'org-beta',  'Org Beta',  false);

-- AC-1: reserved `org_code` ('admin') is refused with 23514 (check_violation)
select throws_ok(
  $$insert into public.org (org_code, name) values ('admin', 'Reserved Org')$$,
  '23514', null,
  'AC-1: reserved org_code (admin) is refused with 23514'
);

-- AC-1: malformed `org_code` (' Bad_Code ') is refused with 23514 (check_violation)
select throws_ok(
  $$insert into public.org (org_code, name) values (' Bad_Code ', 'Malformed Org')$$,
  '23514', null,
  'AC-1: malformed org_code is refused with 23514'
);

-- AC-1: updating `org_code` on an existing `org` row is refused with 42501 (`org_code_immutable`)
select throws_ok(
  $$update public.org set org_code = 'org-alpha-renamed' where id = 'd0000000-0000-4000-8000-000000000a01'$$,
  '42501', 'org_code_immutable',
  'AC-1: updating org.org_code is refused with 42501 (org_code_immutable)'
);

-- AC-1: inserting a second row with `is_shared_tenant = true` is refused with 23505 (`unique_violation`)
select throws_ok(
  $$insert into public.org (org_code, name, is_shared_tenant) values ('org-shared-2', 'Second Shared', true)$$,
  '23505', null,
  'AC-1: second is_shared_tenant = true row is refused with 23505 on org_one_shared_tenant_idx'
);

-- Two-tenant fixture setup (01-plan.md § 4.2 item 3):
-- Team Engineering (10000000-0000-4000-8000-000000000001) & Member Ada (a0000000-0000-4000-8000-000000000001) in Org A
-- Team Design      (10000000-0000-4000-8000-000000000002) & Member Cy  (a0000000-0000-4000-8000-000000000003) in Org B
insert into public.team (id, name, overload_threshold, org_id) values
  ('10000000-0000-4000-8000-000000000001', 'Engineering', 0.5, 'd0000000-0000-4000-8000-000000000a01'),
  ('10000000-0000-4000-8000-000000000002', 'Design',      0.5, 'd0000000-0000-4000-8000-000000000b01')
on conflict (id) do update set org_id = excluded.org_id;

insert into auth.users (id, email) values
  ('a0000000-0000-4000-8000-000000000001', 'ada@mir11.test'),
  ('a0000000-0000-4000-8000-000000000003', 'cy@mir11.test')
on conflict (id) do nothing;

insert into public.member (id, display_name, avatar, role, status, email, org_id) values
  ('a0000000-0000-4000-8000-000000000001', 'Ada', '1.png', tests.member_role('admin'), 'approved', 'ada@mir11.test', 'd0000000-0000-4000-8000-000000000a01'),
  ('a0000000-0000-4000-8000-000000000003', 'Cy',  '1.png', tests.member_role('admin'), 'approved', 'cy@mir11.test',  'd0000000-0000-4000-8000-000000000b01')
on conflict (id) do update set org_id = excluded.org_id;

-- MIR-21-e (ADR-080 decision 3): the mirror's INSERT branch no longer runs, because the member
-- insert above does not name team_id. Write Ada's and Cy's membership rows itself.
select tests.put_on_team('a0000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001');
select tests.put_on_team('a0000000-0000-4000-8000-000000000003', '10000000-0000-4000-8000-000000000002');

-- Open Event A (Org A, creator Ada -> team Engineering via event_stamp) and Event B (Org B, creator Cy -> team Design)
insert into public.event (id, creator_id, org_id, name, start_date, end_date, scope) values
  ('d0000000-0000-4000-8000-000000000e01', 'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000a01', 'Event A', current_date + 5, current_date + 7, 'public'),
  ('d0000000-0000-4000-8000-000000000e02', 'a0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000b01', 'Event B', current_date + 5, current_date + 7, 'public');

-- ---------------------------------------------------------------------------------------------
-- 3. Composite FK cross-org refusal & same-org acceptance (AC-2, AC-4, AC-5, AC-6)
-- ---------------------------------------------------------------------------------------------

-- AC-2: `public.membership` composite FKs (`membership_team_org_fk`, `membership_member_org_fk`)
-- MIR-13: `is_primary` is false in both refusals. The mirror trigger has already written Ada's and
-- Cy's active primary rows, so a second primary would be refused by
-- membership_one_active_primary_idx (23505) before the foreign key under test is reached.
select throws_ok(
  $$insert into public.membership (org_id, team_id, member_id, is_primary)
    values ('d0000000-0000-4000-8000-000000000a01',
            '10000000-0000-4000-8000-000000000002',
            'a0000000-0000-4000-8000-000000000001',
            false)$$,
  '23503', null,
  'AC-2: membership_team_org_fk refuses cross-org (Design [Org B], Org A) with 23503'
);

select throws_ok(
  $$insert into public.membership (org_id, team_id, member_id, is_primary)
    values ('d0000000-0000-4000-8000-000000000a01',
            '10000000-0000-4000-8000-000000000001',
            'a0000000-0000-4000-8000-000000000003',
            false)$$,
  '23503', null,
  'AC-2: membership_member_org_fk refuses cross-org (Cy [Org B], Org A) with 23503'
);

-- MIR-13: a closed row. The mirror trigger already holds Ada's active primary row on Engineering, so
-- an active one would collide with membership_active_team_member_idx; a past window does not.
select lives_ok(
  $$insert into public.membership (org_id, team_id, member_id, is_primary, joined_at, left_at)
    values ('d0000000-0000-4000-8000-000000000a01',
            '10000000-0000-4000-8000-000000000001',
            'a0000000-0000-4000-8000-000000000001',
            false, now() - interval '2 days', now() - interval '1 day')$$,
  'AC-2: same-org membership insert (Engineering [Org A], Ada [Org A], Org A) succeeds'
);

-- AC-4: `public.entry` composite FKs (`entry_member_org_fk`, `entry_primary_team_org_fk`, `entry_approved_by_org_fk`)
select throws_ok(
  $$insert into public.entry (member_id, primary_team_id, org_id, type, portion, start_date, end_date)
    values ('a0000000-0000-4000-8000-000000000003',
            '10000000-0000-4000-8000-000000000001',
            'd0000000-0000-4000-8000-000000000a01',
            'pto', 'full', '2026-12-01', '2026-12-01')$$,
  '23503', null,
  'AC-4: entry_member_org_fk refuses cross-org member Cy [Org B] in Org A with 23503'
);

select throws_ok(
  $$insert into public.entry (member_id, primary_team_id, org_id, type, portion, start_date, end_date)
    values ('a0000000-0000-4000-8000-000000000001',
            '10000000-0000-4000-8000-000000000002',
            'd0000000-0000-4000-8000-000000000a01',
            'pto', 'full', '2026-12-02', '2026-12-02')$$,
  '23503', null,
  'AC-4: entry_primary_team_org_fk refuses cross-org primary_team_id Design [Org B] in Org A with 23503'
);

select throws_ok(
  $$insert into public.entry (member_id, primary_team_id, approved_by, approved_at, status, org_id, type, portion, start_date, end_date)
    values ('a0000000-0000-4000-8000-000000000001',
            '10000000-0000-4000-8000-000000000001',
            'a0000000-0000-4000-8000-000000000003',
            now(), 'approved',
            'd0000000-0000-4000-8000-000000000a01',
            'pto', 'full', '2026-12-03', '2026-12-03')$$,
  '23503', null,
  'AC-4: entry_approved_by_org_fk refuses cross-org approved_by Cy [Org B] in Org A with 23503'
);

select lives_ok(
  $$insert into public.entry (member_id, primary_team_id, approved_by, org_id, type, portion, start_date, end_date)
    values ('a0000000-0000-4000-8000-000000000001',
            '10000000-0000-4000-8000-000000000001',
            null,
            'd0000000-0000-4000-8000-000000000a01',
            'pto', 'full', '2026-12-04', '2026-12-04')$$,
  'AC-4: same-org entry insert with approved_by = null succeeds'
);

select lives_ok(
  $$insert into public.entry (member_id, primary_team_id, approved_by, approved_at, status, org_id, type, portion, start_date, end_date)
    values ('a0000000-0000-4000-8000-000000000001',
            '10000000-0000-4000-8000-000000000001',
            'a0000000-0000-4000-8000-000000000001',
            now(), 'approved',
            'd0000000-0000-4000-8000-000000000a01',
            'pto', 'full', '2026-12-05', '2026-12-05')$$,
  'AC-4: same-org entry insert with approved_by = Ada [Org A] succeeds'
);

-- AC-5: `public.busy_day`, `public.issue_report`, and `public.notification`
select throws_ok(
  $$insert into public.busy_day (member_id, date, org_id)
    values ('a0000000-0000-4000-8000-000000000003', '2026-12-10', 'd0000000-0000-4000-8000-000000000a01')$$,
  '23503', null,
  'AC-5: busy_day_member_org_fk refuses cross-org member Cy [Org B] in Org A with 23503'
);

select lives_ok(
  $$insert into public.busy_day (member_id, date, org_id)
    values ('a0000000-0000-4000-8000-000000000001', '2026-12-10', 'd0000000-0000-4000-8000-000000000a01')$$,
  'AC-5: same-org busy_day insert succeeds'
);

select throws_ok(
  $$insert into public.issue_report (member_id, kind, message, page, org_id)
    values ('a0000000-0000-4000-8000-000000000003', 'bug', 'Cross-org report', '/', 'd0000000-0000-4000-8000-000000000a01')$$,
  '23503', null,
  'AC-5: issue_report_member_org_fk refuses cross-org member Cy [Org B] in Org A with 23503'
);

select lives_ok(
  $$insert into public.issue_report (member_id, kind, message, page, org_id)
    values ('a0000000-0000-4000-8000-000000000001', 'bug', 'Same-org report', '/', 'd0000000-0000-4000-8000-000000000a01')$$,
  'AC-5: same-org issue_report insert succeeds'
);

select throws_ok(
  $$insert into public.notification (recipient_id, kind, event_id, event_name, actor_id, org_id)
    values ('a0000000-0000-4000-8000-000000000003', 'event_created',
            'd0000000-0000-4000-8000-000000000e01', 'Event A',
            'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000a01')$$,
  '23503', null,
  'AC-5: notification_recipient_org_fk refuses cross-org recipient Cy [Org B] in Org A with 23503'
);

select throws_ok(
  $$insert into public.notification (recipient_id, kind, event_id, event_name, actor_id, org_id)
    values ('a0000000-0000-4000-8000-000000000001', 'event_created',
            'd0000000-0000-4000-8000-000000000e01', 'Event A',
            'a0000000-0000-4000-8000-000000000003', 'd0000000-0000-4000-8000-000000000a01')$$,
  '23503', null,
  'AC-5: notification_actor_org_fk refuses cross-org actor Cy [Org B] in Org A with 23503'
);

select throws_ok(
  $$insert into public.notification (recipient_id, kind, event_id, event_name, actor_id, org_id)
    values ('a0000000-0000-4000-8000-000000000001', 'event_created',
            'd0000000-0000-4000-8000-000000000e02', 'Event B',
            'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000a01')$$,
  '23503', null,
  'AC-5: notification_event_org_fk refuses cross-org event Event B [Org B] in Org A with 23503'
);

select lives_ok(
  $$insert into public.notification (recipient_id, kind, event_id, event_name, actor_id, org_id)
    values ('a0000000-0000-4000-8000-000000000001', 'event_cancelled',
            null, 'Cancelled Event',
            'a0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000a01')$$,
  'AC-5: same-org notification insert with event_id = null succeeds'
);

-- AC-6: `public.event`, `public.event_invitee`, `public.event_attendance`, `public.event_guest_link`, `public.event_guest`
select throws_ok(
  $$insert into public.event (creator_id, org_id, name, start_date, end_date, scope)
    values ('a0000000-0000-4000-8000-000000000003',
            'd0000000-0000-4000-8000-000000000a01',
            'Cross-org Creator Event', current_date + 5, current_date + 7, 'public')$$,
  '23503', null,
  'AC-6: event_creator_org_fk refuses cross-org creator Cy [Org B] on Org A event with 23503'
);

select throws_ok(
  $$update public.event
       set team_id = '10000000-0000-4000-8000-000000000002'
     where id = 'd0000000-0000-4000-8000-000000000e01'$$,
  '23503', null,
  'AC-6: event_team_org_fk refuses cross-org team Design [Org B] on Event A [Org A] with 23503'
);

select throws_ok(
  $$insert into public.event_invitee (event_id, member_id, org_id)
    values ('d0000000-0000-4000-8000-000000000e02',
            'a0000000-0000-4000-8000-000000000001',
            'd0000000-0000-4000-8000-000000000a01')$$,
  '23503', null,
  'AC-6: event_invitee_event_org_fk refuses Event B [Org B] with Org A in event_invitee with 23503'
);

select throws_ok(
  $$insert into public.event_invitee (event_id, member_id, org_id)
    values ('d0000000-0000-4000-8000-000000000e01',
            'a0000000-0000-4000-8000-000000000003',
            'd0000000-0000-4000-8000-000000000a01')$$,
  '23503', null,
  'AC-6: event_invitee_member_org_fk refuses Member Cy [Org B] with Org A in event_invitee with 23503'
);

-- MIR-13: `event_attendance_guard` now refuses both inserts below with 42501 first, because
-- `is_event_audience` is bounded by org (MIR-13 AC-15). It is disabled for these two statements only,
-- inside this rolled-back transaction, so the foreign keys stay what is under test.
alter table public.event_attendance disable trigger event_attendance_guard;

select throws_ok(
  $$insert into public.event_attendance (event_id, member_id, status, org_id)
    values ('d0000000-0000-4000-8000-000000000e02',
            'a0000000-0000-4000-8000-000000000001',
            'attending',
            'd0000000-0000-4000-8000-000000000a01')$$,
  '23503', null,
  'AC-6: event_attendance_event_org_fk refuses Event B [Org B] with Org A in event_attendance with 23503'
);

select throws_ok(
  $$insert into public.event_attendance (event_id, member_id, status, org_id)
    values ('d0000000-0000-4000-8000-000000000e01',
            'a0000000-0000-4000-8000-000000000003',
            'attending',
            'd0000000-0000-4000-8000-000000000a01')$$,
  '23503', null,
  'AC-6: event_attendance_member_org_fk refuses Member Cy [Org B] with Org A in event_attendance with 23503'
);

alter table public.event_attendance enable trigger event_attendance_guard;

select throws_ok(
  $$insert into public.event_guest_link (event_id, token, org_id)
    values ('d0000000-0000-4000-8000-000000000e02',
            repeat('1', 64),
            'd0000000-0000-4000-8000-000000000a01')$$,
  '23503', null,
  'AC-6: event_guest_link_event_org_fk refuses Event B [Org B] with Org A in event_guest_link with 23503'
);

select throws_ok(
  $$insert into public.event_guest (event_id, event_name, name, email, manage_token_hash, status, org_id)
    values ('d0000000-0000-4000-8000-000000000e02',
            'Event B', 'Guest Cross', 'guest-cross@mir11.test',
            repeat('2', 64), 'attending',
            'd0000000-0000-4000-8000-000000000a01')$$,
  '23503', null,
  'AC-6: event_guest_event_org_fk refuses Event B [Org B] with Org A in event_guest with 23503'
);

-- ---------------------------------------------------------------------------------------------
-- 4. Same-org event child writes and ON DELETE CASCADE / ON DELETE SET NULL (event_id) (AC-6, AC-7)
-- ---------------------------------------------------------------------------------------------

select lives_ok(
  $$insert into public.event_invitee (event_id, member_id, org_id)
    values ('d0000000-0000-4000-8000-000000000e01',
            'a0000000-0000-4000-8000-000000000001',
            'd0000000-0000-4000-8000-000000000a01')$$,
  'AC-6: same-org event_invitee insert succeeds'
);

select lives_ok(
  $$insert into public.event_attendance (event_id, member_id, status, org_id)
    values ('d0000000-0000-4000-8000-000000000e01',
            'a0000000-0000-4000-8000-000000000001',
            'attending',
            'd0000000-0000-4000-8000-000000000a01')$$,
  'AC-6: same-org event_attendance insert succeeds'
);

select lives_ok(
  $$insert into public.event_guest_link (event_id, token, org_id)
    values ('d0000000-0000-4000-8000-000000000e01',
            repeat('3', 64),
            'd0000000-0000-4000-8000-000000000a01')$$,
  'AC-6: same-org event_guest_link insert succeeds'
);

select lives_ok(
  $$insert into public.event_guest (id, event_id, event_name, name, email, manage_token_hash, status, org_id)
    values ('d0000000-0000-4000-8000-000000000f01',
            'd0000000-0000-4000-8000-000000000e01',
            'Event A', 'Guest Alpha', 'guest-alpha@mir11.test',
            repeat('4', 64), 'attending',
            'd0000000-0000-4000-8000-000000000a01')$$,
  'AC-6: same-org event_guest insert succeeds'
);

select lives_ok(
  $$insert into public.notification (id, recipient_id, kind, event_id, event_name, actor_id, org_id)
    values ('d0000000-0000-4000-8000-000000000f02',
            'a0000000-0000-4000-8000-000000000001', 'event_created',
            'd0000000-0000-4000-8000-000000000e01', 'Event A',
            'a0000000-0000-4000-8000-000000000001',
            'd0000000-0000-4000-8000-000000000a01')$$,
  'AC-5: same-org notification insert referencing Event A succeeds'
);

-- AC-7: Delete Event A and verify ON DELETE CASCADE vs column-specific ON DELETE SET NULL (event_id)
delete from public.event where id = 'd0000000-0000-4000-8000-000000000e01';

select is(
  (select count(*) from public.event_invitee where event_id = 'd0000000-0000-4000-8000-000000000e01'),
  0::bigint,
  'AC-7: deleting Event A cascades to event_invitee'
);

select is(
  (select count(*) from public.event_attendance where event_id = 'd0000000-0000-4000-8000-000000000e01'),
  0::bigint,
  'AC-7: deleting Event A cascades to event_attendance'
);

select is(
  (select count(*) from public.event_guest_link where event_id = 'd0000000-0000-4000-8000-000000000e01'),
  0::bigint,
  'AC-7: deleting Event A cascades to event_guest_link'
);

select results_eq(
  $$select event_id, org_id from public.event_guest where id = 'd0000000-0000-4000-8000-000000000f01'$$,
  $$values (null::uuid, 'd0000000-0000-4000-8000-000000000a01'::uuid)$$,
  'AC-7: deleting Event A nulls event_guest.event_id while preserving event_guest.org_id'
);

select results_eq(
  $$select event_id, org_id from public.notification where id = 'd0000000-0000-4000-8000-000000000f02'$$,
  $$values (null::uuid, 'd0000000-0000-4000-8000-000000000a01'::uuid)$$,
  'AC-7: deleting Event A nulls notification.event_id while preserving notification.org_id'
);

select * from finish();
rollback;
