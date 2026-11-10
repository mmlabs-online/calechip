---
ticket: MIR-11
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-27T04:09:00Z
purpose: "Phase 3 pgTAP verification of composite foreign keys, parent (id, org_id) unique keys, public.team_role, public.org, and public.membership against local PostgreSQL 17.11 (RULE-16)"
---

# MIR-11 — Phase 3 Composite Foreign Keys Verification

## 1. Acceptance criteria verification (`AC-1` to `AC-9`)

| AC | Status | Verification and `file:line` citations |
|---|---|---|
| **AC-1** — `public.team_role` and `public.org` DDL & invariants | PASS | Implemented in `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:22-104` and verified by pgTAP assertions `1..19` and `55..58` in `supabase/tests/120-composite-fks.test.sql:14-66,204-230`: `public.team_role` has labels `('member', 'manager')`; `public.org` has columns `(id, org_code, name, is_shared_tenant, plan, max_members, max_teams, timezone, created_by, created_at, updated_at)`, constraints `org_pkey`, `org_org_code_key`, `org_code_shape`, `org_code_not_reserved` (including all 29 `ADR-070` § 2 reserved tokens and all § 4.1 tokens), `org_name_not_blank`, `org_plan_not_blank`, `org_timezone_not_blank`, `org_max_members_positive`, `org_max_teams_positive`, partial unique index `org_one_shared_tenant_idx`, trigger `org_enforce_immutable_org_code`, RLS enabled, and table privileges revoked from `public, anon, authenticated`. Reserved/malformed `org_code` values are refused with `23514`, updating `org_code` is refused with `42501` (`org_code_immutable`), and a second `is_shared_tenant = true` row is refused with `23505`. |
| **AC-2** — `public.membership` DDL, indexes, and composite FKs | PASS | Implemented in `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:165-210` and verified by pgTAP assertions `20..38` and `59..61` in `supabase/tests/120-composite-fks.test.sql:68-120,256-284`: `public.membership` has columns `(id, org_id, team_id, member_id, team_role, is_primary, joined_at, left_at, created_at, updated_at)`, constraints `membership_pkey`, `membership_id_org_id_key`, `membership_team_org_fk`, `membership_member_org_fk`, `membership_left_after_joined`, `membership_inactive_not_primary`, partial unique indexes `membership_active_team_member_idx` and `membership_one_active_primary_idx`, supporting indexes `membership_member_active_idx`, `membership_org_id_idx`, `membership_team_history_idx`, RLS enabled, and table privileges revoked from `public, anon, authenticated`. Cross-org `(team_id, org_id)` and `(member_id, org_id)` inserts are refused with `23503`, while same-org insert succeeds. |
| **AC-3** — Parent `(id, org_id)` unique keys and `org_id` / `primary_team_id` columns on existing tables | PASS | Implemented in `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:109-162,216-447` and verified by pgTAP assertions `39..54` in `supabase/tests/120-composite-fks.test.sql:122-194`: all 12 existing tenant-scoped tables (`team`, `member`, `entry`, `holiday`, `busy_day`, `issue_report`, `event`, `event_invitee`, `event_attendance`, `event_guest_link`, `event_guest`, `notification`) have nullable `org_id uuid` with `<table_name>_org_id_fkey` (`references public.org (id) on delete restrict`) and `<table_name>_org_id_idx`; `public.entry` has nullable `primary_team_id uuid` and `entry_primary_team_org_idx`; and `team`, `member`, `event`, and `membership` carry composite unique constraints `team_id_org_id_key`, `member_id_org_id_key`, `event_id_org_id_key`, and `membership_id_org_id_key`. |
| **AC-4** — Cross-org refusal on `public.entry` | PASS | Implemented in `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:228-247` (`entry_member_org_fk`, `entry_primary_team_org_fk`, `entry_approved_by_org_fk`) and verified by pgTAP assertions `62..66` in `supabase/tests/120-composite-fks.test.sql:286-336`: cross-org `member_id`, `primary_team_id`, and `approved_by` on an `Org A` entry each fail with SQLSTATE `23503`, while same-org entries with `approved_by = null` and `approved_by = Ada [Org A]` both succeed. |
| **AC-5** — Cross-org refusal on `public.busy_day`, `public.issue_report`, and `public.notification` | PASS | Implemented in `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:276-281,296-301,425-443` (`busy_day_member_org_fk`, `issue_report_member_org_fk`, `notification_recipient_org_fk`, `notification_actor_org_fk`, `notification_event_org_fk`) and verified by pgTAP assertions `67..74` and `87` in `supabase/tests/120-composite-fks.test.sql:338-401,518-525`: all 5 cross-org inserts are refused with SQLSTATE `23503`, while same-org inserts (including `notification` with `event_id = null` and `event_id = Event A`) succeed. |
| **AC-6** — Cross-org refusal on `public.event`, `public.event_invitee`, `public.event_attendance`, `public.event_guest_link`, and `public.event_guest` | PASS | Implemented in `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:306-411` (`event_creator_org_fk`, `event_team_org_fk`, `event_invitee_event_org_fk`, `event_invitee_member_org_fk`, `event_attendance_event_org_fk`, `event_attendance_member_org_fk`, `event_guest_link_event_org_fk`, `event_guest_event_org_fk`) and verified by pgTAP assertions `75..86` in `supabase/tests/120-composite-fks.test.sql:403-516`: all 8 cross-org writes are refused with SQLSTATE `23503`, while same-org writes succeed. |
| **AC-7** — `ON DELETE SET NULL (event_id)` and `ON DELETE CASCADE` preservation on event deletion | PASS | Implemented in `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:332-443` and verified by pgTAP assertions `88..92` in `supabase/tests/120-composite-fks.test.sql:528-559`: deleting `Event A` cascades child rows in `event_invitee`, `event_attendance`, and `event_guest_link` (`count = 0`), while `event_guest` and `notification` rows survive with `event_id = null` and `org_id = Org A` intact via column-specific `ON DELETE SET NULL (event_id)`. |
| **AC-8** — Backward compatibility with existing pgTAP tests `000`–`110` and unit tests | PASS | All 13 pgTAP test files (`000-harness.test.sql` through `120-composite-fks.test.sql`, 558 assertions total) pass with 0 failures on local PostgreSQL 17.11; `pnpm exec vitest run` passes all 49 test files (991 tests); `pnpm exec tsc --noEmit`, `pnpm exec eslint .`, and `pnpm build` all exit 0. |
| **AC-9** — Phase 3 verification artifact | PASS | This file (`.ai/board/tickets/MIR-11/verification.md`). |

## 2. Database test execution output

### 2.1 `pnpm db:test`

```text
> calechip@1.0.0 db:test /Users/mpa/Downloads/aifw-template
> node scripts/db-test.mjs

{"_tag":"Error","error":{"code":"LegacyDockerLifecycleInspectError","message":"failed to inspect container health: docker: command not found (podman also not found) — install Docker Desktop or Podman and ensure it is on PATH"}}
db:test: start failed (exit 1)
```

As documented in `.ai/board/tickets/MIR-06/03-impl-log.md:30-36,166-176`, Docker Desktop is not installed on this machine, so `supabase start` cannot launch containers. Instead, the complete 47-migration sequence and all 13 pgTAP test suites (`000` through `120`) were executed directly against a fresh disposable local Homebrew PostgreSQL 17.11 + pgTAP 1.3.3 instance configured with Supabase's roles (`anon`, `authenticated`, `service_role`), schemas (`auth`, `extensions`, `storage`, `vault`, `net`, `supabase_migrations`), and default privileges.

### 2.2 Full PostgreSQL 17.11 + pgTAP 1.3.3 suite output (`000`–`120`)

```text
Applying 47 migrations...
All 47 migrations applied cleanly.
Idempotency check (re-running 20261027120000_mir11_composite_foreign_keys.sql): PASS
000-harness.test.sql: 1..4 (4 ok, 0 todo, 0 fail)
010-catalogue.test.sql: 1..5 (4 ok, 1 todo, 0 fail)
020-entry-reads.test.sql: 1..15 (15 ok, 0 todo, 0 fail)
030-member-reads.test.sql: 1..14 (12 ok, 2 todo, 0 fail)
040-member-self-writes.test.sql: 1..29 (29 ok, 0 todo, 0 fail)
050-cross-team-writes.test.sql: 1..20 (20 ok, 0 todo, 0 fail)
060-removed-and-pending.test.sql: 1..87 (87 ok, 0 todo, 0 fail)
070-definer-callers.test.sql: 1..73 (73 ok, 0 todo, 0 fail)
080-guest-tokens.test.sql: 1..35 (34 ok, 1 todo, 0 fail)
090-event-boundaries.test.sql: 1..27 (27 ok, 0 todo, 0 fail)
100-mock-parity.test.sql: 1..144 (144 ok, 0 todo, 0 fail)
110-schema-cleanup.test.sql: 1..13 (13 ok, 0 todo, 0 fail)
120-composite-fks.test.sql: 1..92 (92 ok, 0 todo, 0 fail)
--- TAP output for 120-composite-fks.test.sql ---
1..92
ok 1 - AC-1: public.team_role type exists
ok 2 - AC-1: public.team_role has labels (member, manager)
ok 3 - AC-1: public.org table exists
ok 4 - AC-1: org.id exists
ok 5 - AC-1: org.org_code exists
ok 6 - AC-1: org.name exists
ok 7 - AC-1: org.is_shared_tenant exists
ok 8 - AC-1: org.plan exists
ok 9 - AC-1: org.max_members exists
ok 10 - AC-1: org.max_teams exists
ok 11 - AC-1: org.timezone exists
ok 12 - AC-1: org.created_by exists
ok 13 - AC-1: org.created_at exists
ok 14 - AC-1: org.updated_at exists
ok 15 - AC-1: public.org has all required PK, unique, and check constraints
ok 16 - AC-1: public.org has partial unique index org_one_shared_tenant_idx
ok 17 - AC-1: public.org has trigger org_enforce_immutable_org_code
ok 18 - AC-1: public.org has row level security enabled
ok 19 - AC-1: anon and authenticated hold no table privileges on public.org
ok 20 - AC-2: public.membership table exists
ok 21 - AC-2: membership.id exists
ok 22 - AC-2: membership.org_id exists
ok 23 - AC-2: membership.team_id exists
ok 24 - AC-2: membership.member_id exists
ok 25 - AC-2: membership.team_role exists
ok 26 - AC-2: membership.is_primary exists
ok 27 - AC-2: membership.joined_at exists
ok 28 - AC-2: membership.left_at exists
ok 29 - AC-2: membership.created_at exists
ok 30 - AC-2: membership.updated_at exists
ok 31 - AC-2: public.membership has all required PK, unique, FK, and check constraints
ok 32 - AC-2: public.membership has index membership_active_team_member_idx
ok 33 - AC-2: public.membership has index membership_one_active_primary_idx
ok 34 - AC-2: public.membership has index membership_member_active_idx
ok 35 - AC-2: public.membership has index membership_org_id_idx
ok 36 - AC-2: public.membership has index membership_team_history_idx
ok 37 - AC-2: public.membership has row level security enabled
ok 38 - AC-2: anon and authenticated hold no table privileges on public.membership
ok 39 - AC-3: team.org_id exists
ok 40 - AC-3: member.org_id exists
ok 41 - AC-3: entry.org_id exists
ok 42 - AC-3: entry.primary_team_id exists
ok 43 - AC-3: holiday.org_id exists
ok 44 - AC-3: busy_day.org_id exists
ok 45 - AC-3: issue_report.org_id exists
ok 46 - AC-3: event.org_id exists
ok 47 - AC-3: event_invitee.org_id exists
ok 48 - AC-3: event_attendance.org_id exists
ok 49 - AC-3: event_guest_link.org_id exists
ok 50 - AC-3: event_guest.org_id exists
ok 51 - AC-3: notification.org_id exists
ok 52 - AC-3: all 4 parent (id, org_id) unique constraints exist
ok 53 - AC-3: all 12 org_id FKs and all 18 composite FKs exist in pg_constraint
ok 54 - AC-3: all 12 <table_name>_org_id_idx indexes and entry_primary_team_org_idx exist
ok 55 - AC-1: reserved org_code (admin) is refused with 23514
ok 56 - AC-1: malformed org_code is refused with 23514
ok 57 - AC-1: updating org.org_code is refused with 42501 (org_code_immutable)
ok 58 - AC-1: second is_shared_tenant = true row is refused with 23505 on org_one_shared_tenant_idx
ok 59 - AC-2: membership_team_org_fk refuses cross-org (Design [Org B], Org A) with 23503
ok 60 - AC-2: membership_member_org_fk refuses cross-org (Cy [Org B], Org A) with 23503
ok 61 - AC-2: same-org membership insert (Engineering [Org A], Ada [Org A], Org A) succeeds
ok 62 - AC-4: entry_member_org_fk refuses cross-org member Cy [Org B] in Org A with 23503
ok 63 - AC-4: entry_primary_team_org_fk refuses cross-org primary_team_id Design [Org B] in Org A with 23503
ok 64 - AC-4: entry_approved_by_org_fk refuses cross-org approved_by Cy [Org B] in Org A with 23503
ok 65 - AC-4: same-org entry insert with approved_by = null succeeds
ok 66 - AC-4: same-org entry insert with approved_by = Ada [Org A] succeeds
ok 67 - AC-5: busy_day_member_org_fk refuses cross-org member Cy [Org B] in Org A with 23503
ok 68 - AC-5: same-org busy_day insert succeeds
ok 69 - AC-5: issue_report_member_org_fk refuses cross-org member Cy [Org B] in Org A with 23503
ok 70 - AC-5: same-org issue_report insert succeeds
ok 71 - AC-5: notification_recipient_org_fk refuses cross-org recipient Cy [Org B] in Org A with 23503
ok 72 - AC-5: notification_actor_org_fk refuses cross-org actor Cy [Org B] in Org A with 23503
ok 73 - AC-5: notification_event_org_fk refuses cross-org event Event B [Org B] in Org A with 23503
ok 74 - AC-5: same-org notification insert with event_id = null succeeds
ok 75 - AC-6: event_creator_org_fk refuses cross-org creator Cy [Org B] on Org A event with 23503
ok 76 - AC-6: event_team_org_fk refuses cross-org team Design [Org B] on Event A [Org A] with 23503
ok 77 - AC-6: event_invitee_event_org_fk refuses Event B [Org B] with Org A in event_invitee with 23503
ok 78 - AC-6: event_invitee_member_org_fk refuses Member Cy [Org B] with Org A in event_invitee with 23503
ok 79 - AC-6: event_attendance_event_org_fk refuses Event B [Org B] with Org A in event_attendance with 23503
ok 80 - AC-6: event_attendance_member_org_fk refuses Member Cy [Org B] with Org A in event_attendance with 23503
ok 81 - AC-6: event_guest_link_event_org_fk refuses Event B [Org B] with Org A in event_guest_link with 23503
ok 82 - AC-6: event_guest_event_org_fk refuses Event B [Org B] with Org A in event_guest with 23503
ok 83 - AC-6: same-org event_invitee insert succeeds
ok 84 - AC-6: same-org event_attendance insert succeeds
ok 85 - AC-6: same-org event_guest_link insert succeeds
ok 86 - AC-6: same-org event_guest insert succeeds
ok 87 - AC-5: same-org notification insert referencing Event A succeeds
ok 88 - AC-7: deleting Event A cascades to event_invitee
ok 89 - AC-7: deleting Event A cascades to event_attendance
ok 90 - AC-7: deleting Event A cascades to event_guest_link
ok 91 - AC-7: deleting Event A nulls event_guest.event_id while preserving event_guest.org_id
ok 92 - AC-7: deleting Event A nulls notification.event_id while preserving notification.org_id
--- end TAP output ---
SUMMARY: 13 files, 558 assertions, 0 failures.
```
