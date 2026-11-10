---
doc_version: 3
last_updated: 2026-10-27
governed_by: [RULE-01, RULE-04, RULE-07, RULE-09]
---

# ADR-070 — The `org` and multi-team `membership` schema, composite foreign keys, and temporal absence count contract

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-10-27 — at `/plan` for MIR-10 (ADR-008, ADR-067).

This ADR supersedes no accepted ADR. It supplies the concrete table, column, constraint, foreign-key
and temporal-count design that [ADR-059](ADR-059-calechip-becomes-multi-tenant-system-org-team.md)
deferred to MIR-10 (`.ai/standards/data-model.md:21-22`,
`.ai/board/plans/calechip-multi-tenancy-plan.md:167-173`).

## Context

Feature MIR-10 (`.ai/registry/features.md:299`): *The org and multi-team membership schema is
designed and approved before any migration.* Plan item P3-1
(`.ai/board/plans/calechip-multi-tenancy-plan.md:167-173`) blocks the entire Phase 3 migration
sequence (MIR-11, MIR-12, MIR-13, MIR-14, MIR-15, MIR-18, MIR-21) and Phases 4–6 (MIR-16, MIR-17,
MIR-19, MIR-20).

- **Current schema limitations (`.ai/board/audits/multi-tenancy-audit-2026-10-12.md:81-305`,
  `917-983`):**
  - `public.member` holds a single nullable `team_id` (`tea01:33`, `member_approval:50`), so a
    person cannot belong to more than one team and cannot hold a per-team role (`manager` on Team A,
    `member` on Team B).
  - `public.entry` has no `org_id` and no `primary_team_id` (`cal01:45-97`).
  - `public.holiday` has a global `unique (date)` constraint (`adm02:33`), which prevents per-org
    holiday calendars.
  - None of the twelve existing data tables (`team`, `member`, `entry`, `holiday`, `busy_day`,
    `issue_report`, `event`, `event_invitee`, `event_attendance`, `event_guest_link`, `event_guest`,
    `notification`) carries `org_id` or a composite foreign key binding child rows to their parent's
    `org_id`.
- **Invariants restated by ADR-059 (`.ai/registry/invariants.md:170-185`):**
  - **INV-04:** *The absence count for a team on a date is the sum, over that date's `pending` and
    `approved` entries whose member was still on that team on that date, of 1 per `full` portion and
    0.5 per `am` or `pm` portion, with PTO and WFH counted alike. Rejected entries are excluded. No
    second definition of this number exists anywhere in the system.*
  - **INV-07:** *Every entry belongs to exactly one member, and is counted against every team that
    member belongs to.*
  - `.ai/registry/invariants.md:184-185` requires MIR-10 to design for the new wording: a count per
    team, taken over that team's members as of the date, with no second definition of the number.
- **Deferred commercial items (`ADR-059` § *Out of scope of this decision*, lines 97-119):**
  Billing, licence-expiry behaviour, over-cap behaviour, member counting against a cap, self-serve
  org signup, per-tenant export/deletion, and cap defaults are explicitly deferred by the operator
  (*"Treo những tính năng này, chưa làm bây giờ"*). `plan`, `licence_expires_at`, `max_members` and
  `max_teams` on `public.org` are nullable schema placeholders, not a pricing or cap-enforcement
  decision.

## Decision

### 1. New enum `public.team_role`

```sql
create type public.team_role as enum ('member', 'manager');
```

- Used on `public.membership.role_in_team` (default `'member'`).
- `public.member.role` (`public.member_role`) keeps its current three values (`'member'`,
  `'manager'`, `'admin'`) throughout Phase 3 (MIR-11..MIR-15) so existing policies and client checks
  continue to compile while `membership` is backfilled (MIR-12) and policy readers move (MIR-13). In
  Phase 4 (MIR-16), `manager` moves to `membership.role_in_team`, `admin` is renamed to `org_admin`
  on `public.member_role` (`'member'`, `'org_admin'`), and `system_admin` lives in its own account
  store (MIR-18).

### 2. New table `public.org`

```sql
create table public.org (
  id                 uuid primary key default gen_random_uuid(),
  org_code           text not null,
  name               text not null,
  is_shared_tenant   boolean not null default false,
  max_members        integer null,
  max_teams          integer null,
  plan               text null,
  licence_expires_at timestamptz null,
  timezone           text not null default 'Asia/Ho_Chi_Minh',
  created_at         timestamptz not null default now(),
  constraint org_org_code_key unique (org_code),
  constraint org_code_shape check (
    org_code ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'
  ),
  constraint org_code_not_reserved check (
    org_code <> all (array[
      -- Plan P3-1 / ADR-059 reserved list (15 tokens):
      'system', 'api', 'admin', 'login', 'signin', 'signup', 'app',
      'static', 'public', 'assets', 'healthz', 'fonts', 'images',
      '_next', 'index.html',
      -- Existing first-level SPA route segments (audit A:803-804, 14 tokens):
      'signups', 'members', 'entries', 'month', 'week', 'year',
      'setting', 'threshold', 'teams', 'reports', 'holidays',
      'events', 'profile', 'guest'
    ])
  ),
  constraint org_name_not_blank check (btrim(name) <> ''),
  constraint org_plan_not_blank check (plan is null or btrim(plan) <> ''),
  constraint org_timezone_not_blank check (btrim(timezone) <> ''),
  constraint org_max_members_positive check (max_members is null or max_members >= 1),
  constraint org_max_teams_positive check (max_teams is null or max_teams >= 1)
);

create unique index org_one_shared_tenant_idx
  on public.org (is_shared_tenant)
  where is_shared_tenant = true;
```

- **`org_code` immutability:** enforced by a `BEFORE UPDATE` trigger `org_enforce_immutable_org_code`
  on `public.org` that raises SQLSTATE `42501` (`'org_code is immutable'`) whenever
  `new.org_code is distinct from old.org_code`.
- **Org public row (`MIR-12` backfill):** `is_shared_tenant = true`, `name = 'Org public'`,
  `org_code = 'shared'` (since `'public'` is a reserved word colliding with the `public/` static
  asset directory), `timezone = 'Asia/Ho_Chi_Minh'`, and `max_members`, `max_teams`, `plan`,
  `licence_expires_at` all `null` per ADR-059 § *Out of scope*. The partial unique index
  `org_one_shared_tenant_idx` guarantees at most one shared-tenant row exists in the deployment.

### 3. New table `public.membership`

```sql
create table public.membership (
  id           uuid primary key default gen_random_uuid(),
  org_id       uuid not null references public.org (id) on delete restrict,
  team_id      uuid not null,
  member_id    uuid not null,
  role_in_team public.team_role not null default 'member',
  is_primary   boolean not null default false,
  joined_at    timestamptz not null default now(),
  left_at      timestamptz null,
  constraint membership_team_org_fk
    foreign key (team_id, org_id) references public.team (id, org_id) on delete restrict,
  constraint membership_member_org_fk
    foreign key (member_id, org_id) references public.member (id, org_id) on delete restrict,
  constraint membership_left_after_joined
    check (left_at is null or left_at >= joined_at),
  constraint membership_inactive_not_primary
    check (left_at is null or is_primary = false)
);

create unique index membership_active_team_member_idx
  on public.membership (team_id, member_id)
  where left_at is null;

create unique index membership_one_active_primary_idx
  on public.membership (member_id)
  where left_at is null and is_primary = true;

create index membership_member_active_idx
  on public.membership (member_id, team_id)
  where left_at is null;

create index membership_org_id_idx
  on public.membership (org_id);

create index membership_team_history_idx
  on public.membership (team_id, member_id, joined_at, left_at);
```

- **Same-org guarantee:** `membership_team_org_fk` and `membership_member_org_fk` share the same
  `org_id` column, making it impossible at the database level to link a member of one org to a team
  of another org.
- **Historical intervals (`joined_at`, `left_at`):** leaving a team sets `left_at := now()` and
  `is_primary := false` rather than deleting the row, preserving the historical membership window
  required by INV-04. Rejoining the same team later inserts a new `membership` row, which
  `membership_active_team_member_idx` permits because the prior row has `left_at is not null`.
- **Backfill rule (`MIR-12`):** for every existing `public.member` row with `team_id is not null`,
  MIR-12 inserts one `public.membership` row with `org_id = member.org_id`,
  `team_id = member.team_id`, `member_id = member.id`,
  `role_in_team = case when member.role = 'manager' then 'manager'::public.team_role else 'member'::public.team_role end`,
  `is_primary = true`, `joined_at = member.created_at`, and `left_at = member.removed_at`. Setting
  `joined_at = member.created_at` (not `now()`) ensures entries dated before the migration day remain
  within the member's active window on that team under INV-04.

### 4. Composite foreign keys and `org_id` across the 12 existing data tables (`MIR-11`, `MIR-12`, `MIR-14`, `MIR-21`)

- **Parent composite unique keys (`MIR-11`):**
  - `public.team`: `constraint team_id_org_id_key unique (id, org_id)`
  - `public.member`: `constraint member_id_org_id_key unique (id, org_id)`
  - `public.event`: `constraint event_id_org_id_key unique (id, org_id)`
- **`public.member` (`MIR-11`, `MIR-12`, `MIR-21`):**
  - Gains `org_id uuid not null references public.org (id) on delete restrict`. Because `member.id`
    is the primary key referencing `auth.users (id)`, a user has at most one `member` row and
    therefore belongs to exactly one org (ADR-059 decision 1).
  - Keeps `team_id` during MIR-11 and MIR-12 until MIR-13 rewrites every reader onto `membership`;
    MIR-21 then drops `member.team_id` and `member_team_id_idx`.
- **`public.entry` (`MIR-11`, `MIR-12`, `MIR-14`):**
  - Gains `org_id uuid not null references public.org (id) on delete restrict` and
    `primary_team_id uuid not null`.
  - Composite foreign keys (`MIR-11`):
    - `entry_member_org_fk`: `(member_id, org_id) references public.member (id, org_id) on delete restrict`
    - `entry_primary_team_org_fk`: `(primary_team_id, org_id) references public.team (id, org_id) on delete restrict`
    - `entry_approved_by_org_fk`: `(approved_by, org_id) references public.member (id, org_id) on delete restrict` (default `MATCH SIMPLE`: permits `approved_by is null` while `org_id is not null`, and requires a non-null approver to belong to the same `org_id`)
  - `entry_no_overlapping_portion` (`exclude using gist (member_id with =, date_range with &&, portion_slots with &&)`) stays keyed on `member_id` alone (INV-01, INV-07).
  - Multi-team decision columns (`MIR-14`):
    - `rejected_by uuid null`, with composite FK `entry_rejected_by_org_fk` `(rejected_by, org_id) references public.member (id, org_id) on delete restrict`
    - `rejected_at timestamptz null`
    - `self_approved boolean not null default false`
- **`public.holiday` (`MIR-11`, `MIR-12`, `MIR-15`, `MIR-16`):**
  - Gains `org_id uuid not null references public.org (id) on delete restrict`.
  - Drops `holiday_date_key` (`unique (date)`) and adds
    `constraint holiday_org_id_date_key unique (org_id, date)`.
  - In Org public (`is_shared_tenant = true`), holiday rows are the system-owned national set and may
    be written only by `system_admin` (MIR-15); in a dedicated org (`is_shared_tenant = false`),
    holiday rows are seeded from the national set on org creation (MIR-18) and maintained by that
    org's `org_admin` (MIR-16).
- **Remaining 8 tables (`MIR-11`, `MIR-12`):**
  - `public.busy_day`: `org_id uuid not null references public.org (id) on delete restrict`;
    composite FK `busy_day_member_org_fk` `(member_id, org_id) references public.member (id, org_id) on delete restrict`.
  - `public.issue_report`: `org_id uuid not null references public.org (id) on delete restrict`;
    composite FK `issue_report_member_org_fk` `(member_id, org_id) references public.member (id, org_id) on delete restrict`.
  - `public.event`: `org_id uuid not null references public.org (id) on delete restrict`;
    `unique (id, org_id)`; composite FKs `event_creator_org_fk` `(creator_id, org_id) references public.member (id, org_id) on delete restrict` and `event_team_org_fk` `(team_id, org_id) references public.team (id, org_id) on delete restrict`.
  - `public.event_invitee`: `org_id uuid not null references public.org (id) on delete restrict`;
    composite FKs `event_invitee_event_org_fk` `(event_id, org_id) references public.event (id, org_id) on delete cascade` and `event_invitee_member_org_fk` `(member_id, org_id) references public.member (id, org_id) on delete restrict`.
  - `public.event_attendance`: `org_id uuid not null references public.org (id) on delete restrict`;
    composite FKs `event_attendance_event_org_fk` `(event_id, org_id) references public.event (id, org_id) on delete cascade` and `event_attendance_member_org_fk` `(member_id, org_id) references public.member (id, org_id) on delete restrict`.
  - `public.event_guest_link`: `org_id uuid not null references public.org (id) on delete restrict`;
    composite FK `event_guest_link_event_org_fk` `(event_id, org_id) references public.event (id, org_id) on delete cascade`.
  - `public.event_guest`: `org_id uuid not null references public.org (id) on delete restrict`;
    composite FK `event_guest_event_org_fk` `(event_id, org_id) references public.event (id, org_id) on delete set null (event_id)` (column-specific `SET NULL (event_id)` preserves `org_id not null` when an event is deleted).
  - `public.notification`: `org_id uuid not null references public.org (id) on delete restrict`;
    composite FKs `notification_recipient_org_fk` `(recipient_id, org_id) references public.member (id, org_id) on delete restrict`, `notification_actor_org_fk` `(actor_id, org_id) references public.member (id, org_id) on delete restrict`, and `notification_event_org_fk` `(event_id, org_id) references public.event (id, org_id) on delete set null (event_id)`.

### 5. INV-04 and INV-07 temporal multi-team absence count contract

- **Single calculation site preserved (`INV-04`):** `absenceCountsFor` in `src/lib/data/absence.ts`
  remains the sole function in the system that computes the absence count. No SQL view, RPC or
  second TypeScript helper computes it.
- **Per-team temporal membership window (`INV-04`, `INV-07`):** an entry of `member_id = M`
  contributes to the absence count of team `T` on calendar date `d` (`yyyy-MM-dd`) if and only if:
  1. `entry.status` is `'pending'` or `'approved'` (`entry.status <> 'rejected'`),
  2. `d` lies within `[entry.start_date, entry.end_date]`,
  3. `M` has `member.status = 'approved'` and `(member.removed_at is null or member.removed_at::date > d)`, and
  4. `M` has a `public.membership` row for `team_id = T` whose
     `joined_at::date <= d and (left_at is null or left_at::date > d)` (where date slicing uses the
     existing ISO-8601 `slice(0, 10)` convention in `src/lib/data/absence.ts:106-107`).
- Because an entry is keyed on `member_id` (`INV-07`) and each team's count evaluates `absenceCountsFor`
  over that team's entries and that team's roster (including former team members carrying their
  membership window), an entry of a member who belongs to *k* teams on date `d` is counted once in
  each of those *k* teams and zero times in any team they joined after `d` or left on or before `d`.

## Options considered

- **Composite primary keys `(id, org_id)` instead of `id` PK + `unique (id, org_id)`.** Rejected.
  Every existing table uses `id uuid primary key`, and PostgREST, Supabase client queries and route
  params address rows by `id`. Adding `unique (id, org_id)` on `team`, `member` and `event` gives
  child tables an exact composite FK target without breaking primary-key lookups.
- **Plain `ON DELETE SET NULL` (without `(event_id)`) on `event_guest` and `notification` composite
  FKs.** Rejected. A composite FK `FOREIGN KEY (event_id, org_id) ... ON DELETE SET NULL` attempts
  to null *both* columns when the referenced `event` is deleted, which fails with a `NOT NULL`
  violation on `org_id`. PostgreSQL 15+ column-specific `ON DELETE SET NULL (event_id)` nulls only
  `event_id` and keeps `org_id` intact.
- **Hard-code non-null `max_members` and `max_teams` defaults on `public.org`.** Rejected. ADR-059
  § *Out of scope* (items 1, 3, 4, 7) explicitly records that billing, over-cap behaviour and cap
  defaults are deferred by the operator. Making `max_members`, `max_teams`, `plan` and
  `licence_expires_at` nullable with positivity checks when present honours P3-1's column list
  without inventing deferred commercial policy.
- **Use `'public'` as `org_code` for Org public.** Rejected. `'public'` is on the P3-1 reserved word
  list because `public/` is the static asset directory (audit A:808, A:812). Org public is
  identified in SQL by `is_shared_tenant = true`, carries `name = 'Org public'`, and uses
  `org_code = 'shared'` so the reserved word list has no exception.

## Consequences

- MIR-11, MIR-12, MIR-13, MIR-14, MIR-15, MIR-16, MIR-18, MIR-19 and MIR-21 share one fixed schema
  contract before any migration is written.
- `.ai/standards/data-model.md` gains the approved multi-tenancy target schema section under MIR-10,
  and `.ai/registry/glossary.md` gains rows for *Org*, *Org public* and *Membership*.
- No database migration is applied by MIR-10 (`schema_delta: none`); runtime behaviour is unchanged
  until MIR-11 and MIR-12 land.

## Revert condition

If the operator changes the tenancy hierarchy in ADR-059 (for example, allowing a single `member`
account to belong to multiple orgs, or replacing `membership` with single-team accounts), this ADR
is superseded before or alongside the affected Phase 3 migrations.
