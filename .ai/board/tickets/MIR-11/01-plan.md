---
ticket: MIR-11
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-27T03:45:00Z
inputs_read:
  - .ai/board/tickets/MIR-11/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/standards/data-model.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/tickets/MIR-10/01-plan.md
  - .ai/board/tickets/MIR-12/ticket.yaml
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/110-schema-cleanup.test.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-11 — Plan

## 1. Problem and scope

**Feature (`MIR-11`, transcribed verbatim from `.ai/registry/features.md:300`):**

> Composite foreign keys make a cross-org insert impossible at the database

**Who gains what and why it matters:**

Before `MIR-11`, foreign keys in `public` are single-column (`entry.member_id -> member.id`, `event.team_id -> team.id`, `event_invitee.event_id -> event.id`, etc.). Once `public.org` and `public.membership` exist and every tenant-scoped table carries `org_id`, a single-column foreign key still permits a bug in application code, a trigger, or a `security definer` helper to insert or update a child row whose `org_id` belongs to Tenant B while referencing a `member`, `team`, or `event` in Tenant A.

`MIR-11` materialises the structural DDL decided in [`ADR-070`](../../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md) §§ 1–4 and `.ai/standards/data-model.md` § *Target schema (Phase 3 — ADR-070)*:

1. Creates the `public.team_role` enum (`'member'`, `'manager'`) and the `public.org` and `public.membership` tables with all check constraints, partial unique indexes, supporting indexes, and the `org_enforce_immutable_org_code` trigger (`ADR-070` §§ 1–3).
2. Adds `org_id uuid null references public.org (id) on delete restrict` to all 12 existing org-scoped tables (`team`, `member`, `entry`, `holiday`, `busy_day`, `issue_report`, `event`, `event_invitee`, `event_attendance`, `event_guest_link`, `event_guest`, `notification`) and adds `primary_team_id uuid null` to `public.entry` (`ADR-070` § 4). These columns are added **nullable** in `MIR-11` so existing triggers, seed scripts, and pgTAP fixtures (`supabase/tests/_isolation.psql`) continue to insert rows with `org_id = null` until `MIR-12` backfills `Org public` and flips `org_id` to `not null`.
3. Adds the four parent composite unique constraints `(id, org_id)` on `public.team` (`team_id_org_id_key`), `public.member` (`member_id_org_id_key`), `public.event` (`event_id_org_id_key`), and `public.membership` (`membership_id_org_id_key`), and adds all 18 composite foreign keys `(parent_id, org_id) -> parent (id, org_id)` across `membership`, `entry`, `busy_day`, `issue_report`, `event`, `event_invitee`, `event_attendance`, `event_guest_link`, `event_guest`, and `notification` (`ADR-070` §§ 3–4).
4. Proves with a dedicated pgTAP test file (`supabase/tests/120-composite-fks.test.sql`) run against local PostgreSQL that every cross-org insert or update across those composite foreign keys is refused by PostgreSQL with SQLSTATE `23503` (`foreign_key_violation`), while same-org inserts, nullable optional references (`entry.approved_by`, `event_guest.event_id`, `notification.event_id`), and `on delete set null (event_id)` / `on delete cascade` transitions succeed.

**Out of scope:**

- Creating the `Org public` row, backfilling `org_id`, `membership`, and `entry.primary_team_id`, setting `org_id not null`, and swapping `holiday_date_key` for `holiday_org_id_date_key` (`MIR-12`).
- Rewriting `current_org_id()`, `my_team_ids()`, `managed_team_ids()`, `is_org_owner()`, `is_admin()`, RLS policies, and `security definer` functions for multi-org (`MIR-13`, `MIR-18`).
- Adding `entry.rejected_by`, `entry.self_approved`, and `approve_entry()` / `reject_entry()` (`MIR-14`).
- Dropping `member.team_id` (`MIR-21`).
- Any client (`src/**`) or seam (`src/lib/calendar-store.ts`) changes (`seam_impact: none`).

**Size estimate:** `S` (1 idempotent SQL migration, 1 pgTAP test suite, 1 verification artifact).

---

## 2. Acceptance criteria

- **AC-1 (`public.team_role` and `public.org` DDL & invariants):**
  - **Given** the migration `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql` is applied to a database with all prior migrations (`20260831150024` through `20261023120000_mir09_schema_cleanup.sql`),
  - **When** the catalogue and constraints of `public.org` and `public.team_role` are inspected and exercised,
  - **Then** `public.team_role` exists with labels `('member', 'manager')`; `public.org` exists with columns `(id, org_code, name, is_shared_tenant, plan, max_members, max_teams, timezone, created_by, created_at, updated_at)`, constraints `org_pkey`, `org_org_code_key`, `org_code_shape`, `org_code_not_reserved` (all 29 reserved tokens from `ADR-070` § 2), `org_name_not_blank`, `org_plan_not_blank`, `org_timezone_not_blank`, `org_max_members_positive`, `org_max_teams_positive`, and partial unique index `org_one_shared_tenant_idx`; `org` has RLS enabled and all table privileges revoked from `public, anon, authenticated`; and updating `org.org_code` raises SQLSTATE `42501` (`org_code_immutable`) via trigger `org_enforce_immutable_org_code`.

- **AC-2 (`public.membership` DDL, indexes, and composite FKs):**
  - **Given** two organisations `Org A` and `Org B`, a team and member in `Org A`, and a team and member in `Org B`,
  - **When** rows are inserted into `public.membership`,
  - **Then** `public.membership` exists with columns `(id, org_id, team_id, member_id, team_role, is_primary, joined_at, left_at, created_at, updated_at)`, unique constraint `membership_id_org_id_key unique (id, org_id)`, check constraints `membership_left_after_joined` and `membership_inactive_not_primary`, partial unique indexes `membership_active_team_member_idx` and `membership_one_active_primary_idx`, supporting indexes `membership_member_active_idx`, `membership_org_id_idx`, and `membership_team_history_idx`, and composite foreign keys `membership_team_org_fk` (`(team_id, org_id) -> team (id, org_id) on delete restrict`) and `membership_member_org_fk` (`(member_id, org_id) -> member (id, org_id) on delete restrict`); a same-org membership insert succeeds, while a membership row pairing a `team_id` from `Org B` with `org_id = Org A` or a `member_id` from `Org B` with `org_id = Org A` is refused with SQLSTATE `23503`.

- **AC-3 (Parent `(id, org_id)` unique keys and `org_id` / `primary_team_id` columns on existing tables):**
  - **Given** the 12 existing tenant-scoped tables (`team`, `member`, `entry`, `holiday`, `busy_day`, `issue_report`, `event`, `event_invitee`, `event_attendance`, `event_guest_link`, `event_guest`, `notification`),
  - **When** the schema catalogue is inspected after the migration,
  - **Then** every one of the 12 tables has column `org_id uuid null` with a foreign key `<table_name>_org_id_fkey` referencing `public.org (id) on delete restrict` and an index `<table_name>_org_id_idx` on `(org_id)` where not already covered as the leading column of another index; `public.entry` also has `primary_team_id uuid null`; and `public.team`, `public.member`, `public.event`, and `public.membership` each carry a composite unique constraint `(id, org_id)` (`team_id_org_id_key`, `member_id_org_id_key`, `event_id_org_id_key`, `membership_id_org_id_key`).

- **AC-4 (Cross-org refusal on `public.entry`):**
  - **Given** `Org A` (with `Team A` and `Member A`) and `Org B` (with `Team B` and `Member B`),
  - **When** an `INSERT` or `UPDATE` on `public.entry` sets `org_id = Org A` alongside:
    1. `member_id = Member B` (`entry_member_org_fk`), or
    2. `primary_team_id = Team B` (`entry_primary_team_org_fk`), or
    3. `approved_by = Member B` (`entry_approved_by_org_fk`),
  - **Then** PostgreSQL refuses each cross-org write with SQLSTATE `23503`, whereas an entry with `(member_id = Member A, primary_team_id = Team A, approved_by = null, org_id = Org A)` and an entry with `(member_id = Member A, primary_team_id = Team A, approved_by = Member A, org_id = Org A)` both succeed.

- **AC-5 (Cross-org refusal on `public.busy_day`, `public.issue_report`, and `public.notification`):**
  - **Given** `Org A` (with `Member A` and `Event A`) and `Org B` (with `Member B` and `Event B`),
  - **When** a row is inserted with `org_id = Org A` into:
    1. `public.busy_day` with `member_id = Member B` (`busy_day_member_org_fk`),
    2. `public.issue_report` with `member_id = Member B` (`issue_report_member_org_fk`),
    3. `public.notification` with `recipient_id = Member B` (`notification_recipient_org_fk`),
    4. `public.notification` with `actor_id = Member B` (`notification_actor_org_fk`), or
    5. `public.notification` with `event_id = Event B` (`notification_event_org_fk`),
  - **Then** PostgreSQL refuses every one of those 5 cross-org writes with SQLSTATE `23503`, while same-org inserts (including `notification` with `event_id = null` and `org_id = Org A`) succeed.

- **AC-6 (Cross-org refusal on `public.event`, `public.event_invitee`, `public.event_attendance`, `public.event_guest_link`, and `public.event_guest`):**
  - **Given** `Org A` (with `Team A`, `Member A`, and open `Event A`) and `Org B` (with `Team B`, `Member B`, and open `Event B`),
  - **When** a write with `org_id = Org A` targets:
    1. `public.event` with `creator_id = Member B` (`event_creator_org_fk`),
    2. `public.event` setting `team_id = Team B` on an `Org A` event (`event_team_org_fk`),
    3. `public.event_invitee` with `event_id = Event B, member_id = Member A, org_id = Org A` (`event_invitee_event_org_fk`) or `event_id = Event A, member_id = Member B, org_id = Org A` (`event_invitee_member_org_fk`),
    4. `public.event_attendance` with `event_id = Event B, member_id = Member A, org_id = Org A` (`event_attendance_event_org_fk`) or `event_id = Event A, member_id = Member B, org_id = Org A` (`event_attendance_member_org_fk`),
    5. `public.event_guest_link` with `event_id = Event B, org_id = Org A` (`event_guest_link_event_org_fk`), or
    6. `public.event_guest` with `event_id = Event B, org_id = Org A` (`event_guest_event_org_fk`),
  - **Then** PostgreSQL refuses every one of those 8 cross-org writes with SQLSTATE `23503`, while same-org writes succeed.

- **AC-7 (`ON DELETE SET NULL (event_id)` and `ON DELETE CASCADE` preservation on event deletion):**
  - **Given** an event `Event A` in `Org A` that has rows in `event_invitee`, `event_attendance`, `event_guest_link`, `event_guest`, and `notification` (all with `org_id = Org A`),
  - **When** `Event A` is deleted from `public.event`,
  - **Then** the child rows in `event_invitee`, `event_attendance`, and `event_guest_link` are deleted via `ON DELETE CASCADE`, and the child rows in `event_guest` and `notification` survive with `event_id = null` and `org_id = Org A` intact via column-specific `ON DELETE SET NULL (event_id)`.

- **AC-8 (Backward compatibility with existing pgTAP tests `000`–`110` and unit tests):**
  - **Given** `org_id` and `primary_team_id` are nullable in `MIR-11`, `public.org_enforce_immutable_org_code()` is `security invoker` with execute revoked from `public, anon, authenticated`, and `public.org` / `public.membership` have RLS enabled and table grants revoked from `public, anon, authenticated`,
  - **When** `pnpm db:test`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, and `pnpm build` are run,
  - **Then** every existing pgTAP test (`000-seed-check.test.sql` through `110-schema-cleanup.test.sql`), the new `120-composite-fks.test.sql`, and the full Vitest suite pass with zero failures.

- **AC-9 (Phase 3 verification artifact):**
  - **Given** `.ai/board/tickets/MIR-11/ticket.yaml` carries `phase: 3`,
  - **When** `/implement MIR-11` completes,
  - **Then** `.ai/board/tickets/MIR-11/verification.md` exists and records the actual pgTAP output of `supabase/tests/120-composite-fks.test.sql` and the full `pnpm db:test` run against local PostgreSQL (`RULE-16`).

**Invariants touched:** `[INV-04, INV-07]`
- `INV-04`: `public.membership` introduces the `[joined_at, left_at)` interval history table and its partial unique indexes (`membership_active_team_member_idx`, `membership_one_active_primary_idx`) and check constraints (`membership_left_after_joined`, `membership_inactive_not_primary`).
- `INV-07`: `public.membership` and the composite foreign keys `entry_member_org_fk`, `entry_primary_team_org_fk`, `membership_team_org_fk`, and `membership_member_org_fk` enforce at the database constraint layer that an entry's member, primary team, and memberships cannot cross an organisation boundary.

**Open questions:** `none`

---

## 2b. Visual reference

Visual reference: none. `MIR-11` is a pure database schema migration and pgTAP verification ticket with no UI surface.

---

## 3. Permission model

`MIR-11` adds structural tables, columns, and constraints only; it does not widen any role's read or write surface. Specifically:

1. **New tables (`public.org`, `public.membership`):**
   - Both tables have `alter table ... enable row level security;` applied immediately in the migration.
   - All table privileges are explicitly revoked from `public`, `anon`, and `authenticated` (`revoke all on table public.org, public.membership from public, anon, authenticated;`). No RLS policies or table grants are added in `MIR-11` (those belong to `MIR-13` and `MIR-18`), so neither `anon` nor `authenticated` can read or write either table via PostgREST until `MIR-13` wires the policies.
2. **New trigger function (`public.org_enforce_immutable_org_code()`):**
   - Declared `language plpgsql security invoker set search_path = ''` (not `security definer`, as it only inspects `new.org_code is distinct from old.org_code` and raises `42501` `'org_code_immutable'`).
   - All execute privileges are revoked from `public`, `anon`, and `authenticated` (`revoke all on function public.org_enforce_immutable_org_code() from public, anon, authenticated;`).
   - This preserves the exact security-definer and anon-callable function inventories asserted in `supabase/tests/010-catalogue.test.sql`.
3. **New columns (`org_id`, `primary_team_id`) on existing tables:**
   - Existing column-level `INSERT` / `UPDATE` grants on `member`, `team`, `entry`, `holiday`, `busy_day`, `issue_report`, `event`, `event_invitee`, `event_attendance`, `event_guest_link`, `event_guest`, and `notification` are untouched; ungranted new columns remain unwriteable by `authenticated` where column-level grants are in force (`member`, `team`, `event`, `event_attendance`, `notification`), and `SELECT` remains governed by each table's existing RLS policies until `MIR-13`.
4. **Constraint-layer enforcement (`23503`):**
   - Every composite foreign key fires unconditionally at the PostgreSQL storage/constraint layer — even inside `security definer` functions or triggers running as the table owner (`postgres`) where RLS is bypassed.

| Role / caller | `public.org` | `public.membership` | Cross-org write on any of the 10 child tables (`org_id` non-null) |
|---|---|---|---|
| `anon` | Denied (`42501`, no grant + RLS enabled) | Denied (`42501`, no grant + RLS enabled) | Denied (`42501` by RLS/grants, or `23503` by composite FK) |
| `authenticated` | Denied (`42501`, no grant + RLS enabled until `MIR-13`) | Denied (`42501`, no grant + RLS enabled until `MIR-13`) | Refused with `23503` (`foreign_key_violation`) even if a policy or definer helper allows the statement |
| `postgres` / `security definer` | Full DDL/test access; `UPDATE org SET org_code = ...` refused with `42501` (`org_code_immutable`) | Full DDL/test access; cross-org `(team_id, org_id)` or `(member_id, org_id)` refused with `23503` | Refused with `23503` (`foreign_key_violation`) |

---

## 4. Contract

### 4.1 SQL migration — `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql`

The migration MUST be idempotent (`ADR-024`), wrapped in a single `begin; ... commit;` transaction, and structured as follows:

```sql
-- MIR-11: Composite foreign keys make a cross-org insert impossible at the database.
--
-- Implements ADR-070 §§ 1-4 (structural DDL phase):
--   1. `public.team_role` enum ('member', 'manager').
--   2. `public.org` table, check constraints, `org_one_shared_tenant_idx`, and
--      `org_enforce_immutable_org_code` trigger.
--   3. Nullable `org_id` on all 12 existing org-scoped tables + nullable `primary_team_id`
--      on `public.entry` (backfilled and set NOT NULL in MIR-12).
--   4. Parent `(id, org_id)` unique constraints on `team`, `member`, `event`, and `membership`.
--   5. `public.membership` table, constraints, partial unique indexes, and supporting indexes.
--   6. All 18 composite foreign keys `(parent_id, org_id) -> parent (id, org_id)` across
--      `membership`, `entry`, `busy_day`, `issue_report`, `event`, `event_invitee`,
--      `event_attendance`, `event_guest_link`, `event_guest`, and `notification`.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. `public.team_role` enum (ADR-070 § 1)
-- ---------------------------------------------------------------------------------------------
do $$ begin
  create type public.team_role as enum ('member', 'manager');
exception when duplicate_object then null;
end $$;

-- ---------------------------------------------------------------------------------------------
-- 2. `public.org` table, constraints, index, and immutability trigger (ADR-070 § 2)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.org (
  id                uuid primary key default gen_random_uuid(),
  org_code          text not null,
  name              text not null,
  is_shared_tenant  boolean not null default false,
  plan              text not null default 'free',
  max_members       integer null,
  max_teams         integer null,
  timezone          text not null default 'Asia/Ho_Chi_Minh',
  created_by        uuid null references public.member (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),

  constraint org_org_code_key unique (org_code),
  constraint org_code_shape check (
    org_code ~ '^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$'
    and char_length(org_code) between 2 and 32
  ),
  constraint org_code_not_reserved check (
    org_code <> all (array[
      'admin', 'api', 'app', 'auth', 'billing', 'calechip', 'calendar',
      'create', 'dashboard', 'dev', 'docs', 'events', 'guest', 'help',
      'invite', 'join', 'login', 'logout', 'manage', 'new', 'onboarding',
      'org', 'orgs', 'profile', 'settings', 'signup', 'support', 'system',
      'team', 'teams', 'www'
    ])
  ),
  constraint org_name_not_blank check (btrim(name) <> '' and char_length(name) <= 80),
  constraint org_plan_not_blank check (btrim(plan) <> ''),
  constraint org_timezone_not_blank check (btrim(timezone) <> ''),
  constraint org_max_members_positive check (max_members is null or max_members >= 1),
  constraint org_max_teams_positive check (max_teams is null or max_teams >= 1)
);

create unique index if not exists org_one_shared_tenant_idx
  on public.org ((true))
  where is_shared_tenant = true;

create or replace function public.org_enforce_immutable_org_code()
  returns trigger
  language plpgsql
  security invoker
  set search_path = ''
as $$
begin
  if new.org_code is distinct from old.org_code then
    raise exception 'org_code_immutable' using errcode = '42501';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.org_enforce_immutable_org_code() from public, anon, authenticated;

drop trigger if exists org_enforce_immutable_org_code on public.org;
create trigger org_enforce_immutable_org_code
  before update on public.org
  for each row execute function public.org_enforce_immutable_org_code();

alter table public.org enable row level security;
revoke all on table public.org from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Parent tables: `org_id` and `unique (id, org_id)` on `team`, `member`, `event` (ADR-070 § 4)
-- ---------------------------------------------------------------------------------------------
alter table public.team
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.team
    add constraint team_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.team
    add constraint team_id_org_id_key unique (id, org_id);
exception when duplicate_object then null;
end $$;

create index if not exists team_org_id_idx on public.team (org_id);

alter table public.member
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.member
    add constraint member_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.member
    add constraint member_id_org_id_key unique (id, org_id);
exception when duplicate_object then null;
end $$;

create index if not exists member_org_id_idx on public.member (org_id);

alter table public.event
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.event
    add constraint event_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event
    add constraint event_id_org_id_key unique (id, org_id);
exception when duplicate_object then null;
end $$;

create index if not exists event_org_id_idx on public.event (org_id);

-- ---------------------------------------------------------------------------------------------
-- 4. `public.membership` table, constraints, and indexes (ADR-070 § 3 & MIR-11 plan P3-2)
-- ---------------------------------------------------------------------------------------------
create table if not exists public.membership (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references public.org (id) on delete restrict,
  team_id     uuid not null,
  member_id   uuid not null,
  team_role   public.team_role not null default 'member',
  is_primary  boolean not null default false,
  joined_at   timestamptz not null default now(),
  left_at     timestamptz null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  constraint membership_id_org_id_key unique (id, org_id),
  constraint membership_team_org_fk
    foreign key (team_id, org_id) references public.team (id, org_id) on delete restrict,
  constraint membership_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict,
  constraint membership_left_after_joined
    check (left_at is null or left_at >= joined_at),
  constraint membership_inactive_not_primary
    check (left_at is null or is_primary = false)
);

create unique index if not exists membership_active_team_member_idx
  on public.membership (team_id, member_id)
  where left_at is null;

create unique index if not exists membership_one_active_primary_idx
  on public.membership (member_id)
  where left_at is null and is_primary = true;

create index if not exists membership_member_active_idx
  on public.membership (member_id, org_id)
  where left_at is null;

create index if not exists membership_org_id_idx
  on public.membership (org_id)
  where left_at is null;

create index if not exists membership_team_history_idx
  on public.membership (team_id, joined_at, left_at);

alter table public.membership enable row level security;
revoke all on table public.membership from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. Child tables: `org_id`, `primary_team_id`, and composite foreign keys (ADR-070 § 4)
-- ---------------------------------------------------------------------------------------------

-- 5a. `public.entry`
alter table public.entry
  add column if not exists org_id uuid null,
  add column if not exists primary_team_id uuid null;

do $$ begin
  alter table public.entry
    add constraint entry_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.entry
    add constraint entry_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.entry
    add constraint entry_primary_team_org_fk
    foreign key (primary_team_id, org_id) references public.team (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.entry
    add constraint entry_approved_by_org_fk
    foreign key (approved_by, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists entry_org_id_idx on public.entry (org_id);
create index if not exists entry_primary_team_org_idx on public.entry (primary_team_id, org_id);

-- 5b. `public.holiday`
alter table public.holiday
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.holiday
    add constraint holiday_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists holiday_org_id_idx on public.holiday (org_id);

-- 5c. `public.busy_day`
alter table public.busy_day
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.busy_day
    add constraint busy_day_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.busy_day
    add constraint busy_day_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists busy_day_org_id_idx on public.busy_day (org_id);

-- 5d. `public.issue_report`
alter table public.issue_report
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.issue_report
    add constraint issue_report_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.issue_report
    add constraint issue_report_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists issue_report_org_id_idx on public.issue_report (org_id);

-- 5e. `public.event` composite foreign keys
do $$ begin
  alter table public.event
    add constraint event_creator_org_fk
    foreign key (creator_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event
    add constraint event_team_org_fk
    foreign key (team_id, org_id) references public.team (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

-- 5f. `public.event_invitee`
alter table public.event_invitee
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.event_invitee
    add constraint event_invitee_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_invitee
    add constraint event_invitee_event_org_fk
    foreign key (event_id, org_id) references public.event (id, org_id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_invitee
    add constraint event_invitee_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists event_invitee_org_id_idx on public.event_invitee (org_id);

-- 5g. `public.event_attendance`
alter table public.event_attendance
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.event_attendance
    add constraint event_attendance_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_attendance
    add constraint event_attendance_event_org_fk
    foreign key (event_id, org_id) references public.event (id, org_id) on delete cascade;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_attendance
    add constraint event_attendance_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

create index if not exists event_attendance_org_id_idx on public.event_attendance (org_id);

-- 5h. `public.event_guest_link`
alter table public.event_guest_link
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.event_guest_link
    add constraint event_guest_link_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_guest_link
    add constraint event_guest_link_event_org_fk
    foreign key (event_id, org_id) references public.event (id, org_id) on delete cascade;
exception when duplicate_object then null;
end $$;

create index if not exists event_guest_link_org_id_idx on public.event_guest_link (org_id);

-- 5i. `public.event_guest`
alter table public.event_guest
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.event_guest
    add constraint event_guest_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.event_guest
    add constraint event_guest_event_org_fk
    foreign key (event_id, org_id) references public.event (id, org_id) on delete set null (event_id);
exception when duplicate_object then null;
end $$;

create index if not exists event_guest_org_id_idx on public.event_guest (org_id);

-- 5j. `public.notification`
alter table public.notification
  add column if not exists org_id uuid null;

do $$ begin
  alter table public.notification
    add constraint notification_org_id_fkey
    foreign key (org_id) references public.org (id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.notification
    add constraint notification_recipient_org_fk
    foreign key (recipient_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.notification
    add constraint notification_actor_org_fk
    foreign key (actor_id, org_id) references public.member (id, org_id) on delete restrict;
exception when duplicate_object then null;
end $$;

do $$ begin
  alter table public.notification
    add constraint notification_event_org_fk
    foreign key (event_id, org_id) references public.event (id, org_id) on delete set null (event_id);
exception when duplicate_object then null;
end $$;

create index if not exists notification_org_id_idx on public.notification (org_id);

commit;
```

### 4.2 pgTAP test suite — `supabase/tests/120-composite-fks.test.sql`

The pgTAP test file MUST follow the project's `_isolation.psql` pattern (`\set ON_ERROR_STOP 1`, `\i supabase/tests/_isolation.psql`, `select plan(N);`, `select * from finish();`, `rollback;`) and verify:

1. **Catalogue & constraint inventory (AC-1, AC-2, AC-3):**
   - `has_type('public', 'team_role'::name)` and `enum_has_labels('public', 'team_role', array['member', 'manager'])`.
   - `has_table('public', 'org'::name)` and `has_table('public', 'membership'::name)`.
   - `has_column` for `org_id` on all 13 child/parent tables (`membership`, `team`, `member`, `entry`, `holiday`, `busy_day`, `issue_report`, `event`, `event_invitee`, `event_attendance`, `event_guest_link`, `event_guest`, `notification`) and `primary_team_id` on `entry`.
   - All 4 parent `(id, org_id)` unique constraints (`team_id_org_id_key`, `member_id_org_id_key`, `event_id_org_id_key`, `membership_id_org_id_key`) exist in `pg_constraint` (`contype = 'u'`).
   - All 18 composite foreign keys exist in `pg_constraint` (`contype = 'f'`):
     `membership_team_org_fk`, `membership_member_org_fk`, `entry_member_org_fk`, `entry_primary_team_org_fk`, `entry_approved_by_org_fk`, `busy_day_member_org_fk`, `issue_report_member_org_fk`, `event_creator_org_fk`, `event_team_org_fk`, `event_invitee_event_org_fk`, `event_invitee_member_org_fk`, `event_attendance_event_org_fk`, `event_attendance_member_org_fk`, `event_guest_link_event_org_fk`, `event_guest_event_org_fk`, `notification_recipient_org_fk`, `notification_actor_org_fk`, `notification_event_org_fk`.
2. **`public.org` constraints and immutability trigger (AC-1):**
   - Reserved `org_code` (`'admin'`) is refused with `23514` (`check_violation`).
   - Malformed `org_code` (`' Bad_Code '`) is refused with `23514` (`check_violation`).
   - Updating `org_code` on an existing `org` row is refused with `42501` (`org_code_immutable`).
   - Inserting a second row with `is_shared_tenant = true` is refused with `23505` (`unique_violation` on `org_one_shared_tenant_idx`).
3. **Two-tenant fixture setup (`Org A` and `Org B`):**
   - Insert `Org A` (`id = d0000000-0000-4000-8000-000000000a01`, `org_code = 'org-alpha'`) and `Org B` (`id = d0000000-0000-4000-8000-000000000b01`, `org_code = 'org-beta'`).
   - Assign seeded `team 10000000-0000-4000-8000-000000000001` (`Engineering`) and `member a0000000-0000-4000-8000-000000000001` (`Ada`) to `Org A`, and seeded `team 10000000-0000-4000-8000-000000000002` (`Design`) and `member a0000000-0000-4000-8000-000000000003` (`Cy`) to `Org B`.
   - Insert open event `Event A` (`id = d0000000-0000-4000-8000-000000000e01`, `creator_id = Ada`, `org_id = Org A`, `start_date = current_date + 5`, `end_date = current_date + 7`, `scope = 'public'`) and open event `Event B` (`id = d0000000-0000-4000-8000-000000000e02`, `creator_id = Cy`, `org_id = Org B`, `start_date = current_date + 5`, `end_date = current_date + 7`, `scope = 'public'`). Note: `event_stamp()` automatically stamps `new.team_id := public.member_team_id(new.creator_id)` on `INSERT` (`Engineering` for `Ada` in `Org A`, `Design` for `Cy` in `Org B`).
4. **Every composite FK refuses cross-org writes with `23503` (AC-2, AC-4, AC-5, AC-6):**
   - `membership_team_org_fk`: `insert into public.membership (org_id, team_id, member_id, is_primary)` with `(Org A, Design [Org B], Ada [Org A], true)` throws `23503`.
   - `membership_member_org_fk`: `insert into public.membership (org_id, team_id, member_id, is_primary)` with `(Org A, Engineering [Org A], Cy [Org B], true)` throws `23503`.
   - `membership` same-org insert `(Org A, Engineering [Org A], Ada [Org A], true)` succeeds (`lives_ok`).
   - `entry_member_org_fk`: `insert into public.entry` with `(member_id = Cy [Org B], primary_team_id = Engineering [Org A], org_id = Org A)` throws `23503`.
   - `entry_primary_team_org_fk`: `insert into public.entry` with `(member_id = Ada [Org A], primary_team_id = Design [Org B], org_id = Org A)` throws `23503`.
   - `entry_approved_by_org_fk`: `insert into public.entry` with `(member_id = Ada [Org A], primary_team_id = Engineering [Org A], approved_by = Cy [Org B], org_id = Org A)` throws `23503`.
   - `entry` same-org insert with `approved_by = null` and with `approved_by = Ada [Org A]` both succeed (`lives_ok`).
   - `busy_day_member_org_fk`: `insert into public.busy_day` with `(member_id = Cy [Org B], org_id = Org A)` throws `23503`; same-org succeeds.
   - `issue_report_member_org_fk`: `insert into public.issue_report` with `(member_id = Cy [Org B], org_id = Org A)` throws `23503`; same-org succeeds.
   - `event_creator_org_fk`: `insert into public.event` with `(creator_id = Cy [Org B], org_id = Org A, ...)` throws `23503`.
   - `event_team_org_fk`: `update public.event set team_id = Design [Org B] where id = Event A [Org A]` throws `23503` (on `UPDATE`, `event_stamp` only touches `updated_at`, so `event_team_org_fk` is isolated and tested directly).
   - `event_invitee_event_org_fk`: `insert into public.event_invitee (event_id, member_id, org_id)` with `(Event B [Org B], Ada [Org A], Org A)` throws `23503`.
   - `event_invitee_member_org_fk`: `insert into public.event_invitee (event_id, member_id, org_id)` with `(Event A [Org A], Cy [Org B], Org A)` throws `23503`.
   - `event_attendance_event_org_fk`: `insert into public.event_attendance (event_id, member_id, org_id)` with `(Event B [Org B], Ada [Org A], Org A)` throws `23503`.
   - `event_attendance_member_org_fk`: `insert into public.event_attendance (event_id, member_id, org_id)` with `(Event A [Org A], Cy [Org B], Org A)` throws `23503`.
   - `event_guest_link_event_org_fk`: `insert into public.event_guest_link (event_id, token_hash, created_by, org_id)` with `(Event B [Org B], ..., Ada [Org A], Org A)` throws `23503`.
   - `event_guest_event_org_fk`: `insert into public.event_guest (event_id, event_name, name, email, manage_token_hash, status, org_id)` with `(Event B [Org B], ..., Org A)` throws `23503`.
   - `notification_recipient_org_fk`: `insert into public.notification (recipient_id, kind, event_id, event_name, actor_id, org_id)` with `(Cy [Org B], 'event_created', Event A [Org A], 'Event A', Ada [Org A], Org A)` throws `23503`.
   - `notification_actor_org_fk`: `insert into public.notification (recipient_id, kind, event_id, event_name, actor_id, org_id)` with `(Ada [Org A], 'event_created', Event A [Org A], 'Event A', Cy [Org B], Org A)` throws `23503`.
   - `notification_event_org_fk`: `insert into public.notification (recipient_id, kind, event_id, event_name, actor_id, org_id)` with `(Ada [Org A], 'event_created', Event B [Org B], 'Event B', Ada [Org A], Org A)` throws `23503`.
5. **Event deletion behaviour (`ON DELETE CASCADE` and `ON DELETE SET NULL (event_id)`) (AC-7):**
   - Insert valid same-org rows in `event_invitee`, `event_attendance`, `event_guest_link`, `event_guest`, and `notification` referencing `Event A` with `org_id = Org A`.
   - Delete `Event A` (`delete from public.event where id = Event A`).
   - Assert `event_invitee`, `event_attendance`, and `event_guest_link` rows for `Event A` were cascaded (`count = 0`).
   - Assert the `event_guest` and `notification` rows still exist with `event_id is null` and `org_id = Org A`.

### 4.3 Verification artifact — `.ai/board/tickets/MIR-11/verification.md`

Because `MIR-11` is a Phase 3 ticket (`phase: 3` in `ticket.yaml`), the Developer MUST write `.ai/board/tickets/MIR-11/verification.md` recording:
- The exact command and output of `pnpm db:test` (including `supabase/tests/120-composite-fks.test.sql` and all prior suites `000`–`110`).
- Verification of every acceptance criterion `AC-1` through `AC-9`.

---

## 5. Seam impact

`seam_impact: none`

`src/lib/calendar-store.ts` and `src/**` are not touched in `MIR-11`. All changes are confined to the PostgreSQL schema (`supabase/migrations/`) and pgTAP test suite (`supabase/tests/`).

---

## 6. Schema delta

- **Migration file:** `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql`
- **Authorising ADRs:** [`ADR-070`](../../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md) (*The `org` and multi-team `membership` schema, composite foreign keys, and entry primary-team snapshot*) and [`ADR-059`](../../registry/decisions/ADR-059-org-is-the-hard-isolation-boundary.md) (*Organisation is the hard isolation boundary*).
- **Summary of DDL changes:**
  1. New enum `public.team_role` (`'member'`, `'manager'`).
  2. New table `public.org` with check constraints (`org_code_shape`, `org_code_not_reserved`, `org_name_not_blank`, `org_plan_not_blank`, `org_timezone_not_blank`, `org_max_members_positive`, `org_max_teams_positive`), unique constraint `org_org_code_key`, partial unique index `org_one_shared_tenant_idx`, trigger `org_enforce_immutable_org_code`, and RLS enabled (no grants to `public, anon, authenticated` yet).
  3. New table `public.membership` with `membership_id_org_id_key unique (id, org_id)`, composite foreign keys `membership_team_org_fk` and `membership_member_org_fk`, check constraints `membership_left_after_joined` and `membership_inactive_not_primary`, partial unique indexes `membership_active_team_member_idx` and `membership_one_active_primary_idx`, supporting indexes `membership_member_active_idx`, `membership_org_id_idx`, `membership_team_history_idx`, and RLS enabled (no grants to `public, anon, authenticated` yet).
  4. Nullable `org_id uuid references public.org (id) on delete restrict` added to `team`, `member`, `entry`, `holiday`, `busy_day`, `issue_report`, `event`, `event_invitee`, `event_attendance`, `event_guest_link`, `event_guest`, and `notification`; nullable `primary_team_id uuid` added to `entry`.
  5. Parent unique constraints `team_id_org_id_key`, `member_id_org_id_key`, and `event_id_org_id_key` (`unique (id, org_id)`).
  6. 16 additional composite foreign keys on existing tables (`entry_member_org_fk`, `entry_primary_team_org_fk`, `entry_approved_by_org_fk`, `busy_day_member_org_fk`, `issue_report_member_org_fk`, `event_creator_org_fk`, `event_team_org_fk`, `event_invitee_event_org_fk`, `event_invitee_member_org_fk`, `event_attendance_event_org_fk`, `event_attendance_member_org_fk`, `event_guest_link_event_org_fk`, `event_guest_event_org_fk`, `notification_recipient_org_fk`, `notification_actor_org_fk`, `notification_event_org_fk`).

---

## 7. allowed_paths

`size: S` (matches `size_estimate: S` in § 1).

```yaml
allowed_paths:
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/tests/120-composite-fks.test.sql
  - .ai/board/tickets/MIR-11/**
```

---

## 8. Rejected alternatives

1. **Make `org_id` and `entry.primary_team_id` `NOT NULL` immediately in `MIR-11` (before `MIR-12`'s backfill):**
   - *Why rejected:* Existing rows in deployed/seeded databases have no `org_id` until `MIR-12` creates `Org public` and backfills every table (`MIR-12/ticket.yaml:55-60`, `data-model.md:367-368`). Moreover, `supabase/tests/_isolation.psql`'s `tests.seed()` — executed by every pgTAP suite `010` through `110` — inserts into `team`, `member`, `entry`, `event`, `busy_day`, `notification`, `issue_report`, `event_invitee`, `event_attendance`, `event_guest_link`, and `event_guest` without `org_id`. Keeping `org_id` nullable in `MIR-11` allows all existing migrations and tests to pass unchanged under PostgreSQL `MATCH SIMPLE` semantics while enforcing every composite FK whenever `org_id` is populated.
2. **Use plain `ON DELETE SET NULL` instead of column-specific `ON DELETE SET NULL (event_id)` on `event_guest_event_org_fk` and `notification_event_org_fk`:**
   - *Why rejected:* Plain `ON DELETE SET NULL` on a composite foreign key `(event_id, org_id)` tries to set **both** `event_id` and `org_id` to `null` when the parent `event` is deleted. Once `MIR-12` sets `org_id NOT NULL`, deleting an event would fail with `23502` (`not_null_violation` on `org_id`) and would erase the tenant ownership of surviving `event_guest` and `notification` rows (`ADR-070` § 4, Decision 2). PostgreSQL 15+'s column-specific `ON DELETE SET NULL (event_id)` nulls only `event_id` while preserving `org_id`.
3. **Make `public.org_enforce_immutable_org_code()` `security definer` or leave default `PUBLIC` execute grants on it:**
   - *Why rejected:* The trigger function only compares `new.org_code is distinct from old.org_code` and sets `new.updated_at := now()`; it needs no elevated privileges. Making it `security definer` or leaving `PUBLIC` execute privileges on it would violate the least-privilege function catalogue invariants enforced by `supabase/tests/010-catalogue.test.sql`.

---

## Changelog

- `2026-10-27` (`tech-lead-design`): Initial `01-plan.md` authored for `MIR-11` (`gate: PASS`, `next_state: READY`).
