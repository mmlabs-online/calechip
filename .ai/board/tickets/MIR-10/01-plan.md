---
ticket: MIR-10
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-27T02:18:00Z
inputs_read:
  - .ai/00-charter.md
  - .ai/01-operating-model.md
  - .ai/registry/rules.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-067-the-runner-pushes-merges-and-decides-blocked-questions-on-its-own.md
  - .ai/registry/decisions/ADR-069-member-team-id-is-indexed-and-the-overload-threshold-is-checked-in-the-database.md
  - .ai/standards/data-model.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/plans/multi-tenancy-status.md
  - .ai/board/plans/feature-change-log.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/tickets/MIR-10/ticket.yaml
  - .ai/board/tickets/MIR-11/ticket.yaml
  - .ai/board/tickets/MIR-12/ticket.yaml
  - .ai/board/tickets/MIR-13/ticket.yaml
  - .ai/board/tickets/MIR-14/ticket.yaml
  - .ai/board/tickets/MIR-15/ticket.yaml
  - .ai/board/tickets/MIR-16/ticket.yaml
  - .ai/board/tickets/MIR-18/ticket.yaml
  - .ai/board/tickets/MIR-19/ticket.yaml
  - .ai/board/tickets/MIR-21/ticket.yaml
  - src/lib/data/absence.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-10 — The `org` and multi-team `membership` schema is designed and approved before any migration

## 1. Story

As the **Tech Lead and Developer preparing Phase 3 of the multi-tenancy migration**, I want **the
complete `org` and multi-team `membership` database schema, composite foreign-key topology,
`org_code` reserved word list, `holiday` uniqueness change, and temporal `INV-04` / `INV-07`
absence-count contract designed, approved in an ADR, and recorded in `.ai/standards/data-model.md`
before any Phase 3 migration is written**, so that **MIR-11 through MIR-21 build against one fixed,
unambiguous schema contract without inventing column names, constraints or foreign keys mid-flight
(RULE-04, RULE-09)**.

`size_estimate: S` — written back to `ticket.yaml`.

**Why this item runs before any Phase 3 migration.** Plan item P3-1
(`.ai/board/plans/calechip-multi-tenancy-plan.md:167-173`) is the single design gate for Phase 3.
Ten downstream tickets (`MIR-11`, `MIR-12`, `MIR-13`, `MIR-14`, `MIR-15`, `MIR-16`, `MIR-17`,
`MIR-18`, `MIR-19`, `MIR-21`) depend on it. `.ai/standards/data-model.md:21-23` explicitly leaves a
pointer for it: *"ADR-059 places every team inside an org. The columns that carry that are MIR-10's
design, and this file describes them when it lands."* And `.ai/registry/invariants.md:184-185`
requires MIR-10 to design for the restated `INV-04` and `INV-07` wording (*"a count per team, taken
over that team's members as of the date, and no second definition of the number"*).

**Out of scope:**

- Writing or applying any SQL migration under `supabase/migrations/`. Every DDL change designed here
  is executed by its own downstream ticket:
  - **MIR-11** creates `public.org` and `public.membership` (or adds `org_id` and composite FKs
    across the twelve existing data tables), adds `unique (id, org_id)` on `team`, `member` and
    `event`, and wires every child composite foreign key.
  - **MIR-12** backfills `Org public`, populates `org_id` and `primary_team_id`, backfills
    `public.membership` from `member.team_id`, and replaces `holiday_date_key` (`unique (date)`)
    with `holiday_org_id_date_key` (`unique (org_id, date)`).
  - **MIR-13** rewrites RLS policies and `security definer` functions against `membership` and
    `org_id`.
  - **MIR-14** adds `rejected_by`, `rejected_at` and `self_approved` on `public.entry` and updates
    the multi-team decision trigger.
  - **MIR-15** enforces `is_shared_tenant` special cases (directory, `public` events, notifications,
    `system_admin`-only holiday writes in Org public, and team transfer between orgs).
  - **MIR-16** rewrites `public.member_role` (`admin` → `org_admin`, `manager` moved to
    `membership.role_in_team`) and splits `is_admin(uid)` into `is_org_admin(uid, org_id)` and
    `is_system_admin(uid)`.
  - **MIR-18** builds the separate `system_admin` account store and system panel.
  - **MIR-19** serves authenticated routes under `/{org_code}`.
  - **MIR-20** adds the impersonation audit table and read-only session claims.
  - **MIR-21** drops `public.member.team_id` and `member_team_id_idx` once all readers use
    `public.membership`.
- Changing any file under `src/`, `tests/` or `supabase/` (`expected_impact: []` in `ticket.yaml`).
- Filling in any of the seven commercial items deferred by the operator in
  [ADR-059](../../../registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md)
  § *Out of scope of this decision* (billing/pricing, licence-expiry behaviour, over-cap behaviour,
  member counting against a cap, self-serve org signup, per-tenant export/deletion, and cap defaults).
- Glossary rows for `System admin` and `Org admin` (ADR-059 § *Consequences*): those are written at
  PLAN by the first ticket that builds those roles (`MIR-18` and `MIR-16` respectively). This ticket
  writes the three rows it defines: `Org`, `Org public`, and `Membership`.

## 2. Acceptance criteria

**AC-1 — `public.org` schema, constraints, immutability and shared-tenant singleton**
- Given the approved schema design in
  [ADR-070](../../../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md) § 2 and
  `.ai/standards/data-model.md` § *Multi-tenancy target schema*
- When `public.org` is inspected
- Then it defines:
  - `id uuid primary key default gen_random_uuid()`,
  - `org_code text not null` with `constraint org_org_code_key unique (org_code)`,
    `constraint org_code_shape check (org_code ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$')`,
    `constraint org_code_not_reserved`, and a `BEFORE UPDATE` trigger
    `org_enforce_immutable_org_code` raising SQLSTATE `42501` whenever
    `new.org_code is distinct from old.org_code`,
  - `name text not null` with `constraint org_name_not_blank check (btrim(name) <> '')`,
  - `is_shared_tenant boolean not null default false` with partial unique index
    `org_one_shared_tenant_idx on public.org (is_shared_tenant) where is_shared_tenant = true`,
  - `max_members integer null` (`check (max_members is null or max_members >= 1)`),
    `max_teams integer null` (`check (max_teams is null or max_teams >= 1)`),
    `plan text null` (`check (plan is null or btrim(plan) <> '')`), and
    `licence_expires_at timestamptz null` — all four nullable per ADR-059 § *Out of scope* (items 1
    and 7),
  - `timezone text not null default 'Asia/Ho_Chi_Minh'` (`check (btrim(timezone) <> '')`),
  - `created_at timestamptz not null default now()`,
  - and the seeded `Org public` row specification (`is_shared_tenant = true`, `name = 'Org public'`,
    `org_code = 'shared'`, `timezone = 'Asia/Ho_Chi_Minh'`, nullable commercial placeholders set to
    `null`).

**AC-2 — `org_code` reserved word list covers both plan P3-1 and every existing route/static segment**
- Given `constraint org_code_not_reserved` on `public.org`
- When its array literal is compared against `.ai/board/tickets/MIR-10/ticket.yaml` (`plan:172`) and
  `.ai/board/audits/multi-tenancy-audit-2026-10-12.md:801-813`
- Then it contains all 15 P3-1 reserved tokens (`system`, `api`, `admin`, `login`, `signin`,
  `signup`, `app`, `static`, `public`, `assets`, `healthz`, `fonts`, `images`, `_next`,
  `index.html`) and all 14 additional first-level SPA route segments (`signups`, `members`,
  `entries`, `month`, `week`, `year`, `setting`, `threshold`, `teams`, `reports`, `holidays`,
  `events`, `profile`, `guest`) — 29 tokens in total, with `'shared'` (Org public's `org_code`)
  permitted.

**AC-3 — `public.membership` and `public.team_role` schema, composite FKs and partial unique indexes**
- Given the approved schema design in ADR-070 §§ 1, 3 and `.ai/standards/data-model.md`
- When `public.team_role` and `public.membership` are inspected
- Then:
  - `public.team_role` is `enum ('member', 'manager')`,
  - `public.membership` defines `id uuid primary key default gen_random_uuid()`,
    `org_id uuid not null references public.org (id) on delete restrict`,
    `team_id uuid not null`, `member_id uuid not null`,
    `role_in_team public.team_role not null default 'member'`,
    `is_primary boolean not null default false`,
    `joined_at timestamptz not null default now()`, and `left_at timestamptz null`,
  - composite foreign keys `membership_team_org_fk` (`(team_id, org_id) references public.team (id, org_id) on delete restrict`)
    and `membership_member_org_fk` (`(member_id, org_id) references public.member (id, org_id) on delete restrict`)
    guarantee the member and team belong to the same `org_id`,
  - `membership_left_after_joined` checks `left_at is null or left_at >= joined_at`, and
    `membership_inactive_not_primary` checks `left_at is null or is_primary = false`,
  - partial unique indexes `membership_active_team_member_idx` (`(team_id, member_id) where left_at is null`)
    and `membership_one_active_primary_idx` (`(member_id) where left_at is null and is_primary = true`)
    prevent duplicate active memberships on the same team and multiple active primary teams for one
    member,
  - and the MIR-12 backfill rule is stated (`joined_at = member.created_at`,
    `left_at = member.removed_at`, `is_primary = true`,
    `role_in_team = 'manager'` when `member.role = 'manager'` else `'member'`).

**AC-4 — `public.member`, `public.entry` and `public.holiday` schema changes**
- Given the approved schema design in ADR-070 § 4 and `.ai/standards/data-model.md`
- When `public.member`, `public.entry` and `public.holiday` are inspected
- Then:
  - `public.member` gains `org_id uuid not null references public.org (id) on delete restrict` and
    `constraint member_id_org_id_key unique (id, org_id)`, retains `id uuid primary key references auth.users (id)`
    so each user belongs to at most one org, and retains `team_id` during MIR-11..MIR-13 until MIR-21
    drops `member.team_id` and `member_team_id_idx`,
  - `public.entry` keeps `member_id` and `entry_no_overlapping_portion` (keyed on `member_id`), gains
    `org_id uuid not null references public.org (id) on delete restrict` and
    `primary_team_id uuid not null`, gains composite FKs `entry_member_org_fk`,
    `entry_primary_team_org_fk` and `entry_approved_by_org_fk`, and specifies the MIR-14 decision
    columns (`rejected_by uuid null` with `entry_rejected_by_org_fk`, `rejected_at timestamptz null`,
    `self_approved boolean not null default false`),
  - and `public.holiday` gains `org_id uuid not null references public.org (id) on delete restrict`,
    replaces `holiday_date_key` (`unique (date)`) with
    `constraint holiday_org_id_date_key unique (org_id, date)`, and states the ownership model
    (Org public rows owned by `system_admin` as the national set; dedicated-org rows seeded from the
    national set at org creation and maintained by `org_admin`).

**AC-5 — Composite foreign keys across all 12 existing data tables (`MIR-11` contract)**
- Given the twelve existing data tables in `.ai/board/audits/multi-tenancy-audit-2026-10-12.md:81-305`
  (`team`, `member`, `entry`, `holiday`, `busy_day`, `issue_report`, `event`, `event_invitee`,
  `event_attendance`, `event_guest_link`, `event_guest`, `notification`)
- When the composite FK table in ADR-070 § 4 and `.ai/standards/data-model.md` is inspected
- Then:
  - `team`, `member` and `event` each carry `unique (id, org_id)`,
  - every child table carries `org_id uuid not null references public.org (id) on delete restrict`
    and composite FKs `(parent_id, org_id) references parent (id, org_id)` for every reference to
    `team`, `member` or `event`,
  - and the two nullable event foreign keys (`event_guest.event_id` and `notification.event_id`)
    specify PostgreSQL column-specific `on delete set null (event_id)` so deleting an event never
    attempts to set `org_id` to `null`.

**AC-6 — `INV-04` and `INV-07` temporal multi-team absence-count contract**
- Given the restated `INV-04` and `INV-07` in `.ai/registry/invariants.md:170-185` and
  `src/lib/data/absence.ts:92-207`
- When the temporal absence-count contract in ADR-070 § 5 and `.ai/standards/data-model.md` is
  inspected
- Then it specifies:
  - `absenceCountsFor` in `src/lib/data/absence.ts` remains the single definition of the absence
    count (no SQL view, RPC or second TypeScript function computes it),
  - an entry of `member_id = M` is counted in team `T` on date `d` (`yyyy-MM-dd`) if and only if
    `entry.status <> 'rejected'`, `d` is in `[entry.start_date, entry.end_date]`, `M` is `approved`
    with `member.removed_at is null or member.removed_at::date > d`, and `M` has a `membership` row
    for `team_id = T` with `joined_at::date <= d and (left_at is null or left_at::date > d)` (using
    ISO-8601 `slice(0, 10)` date comparison in `src/lib/data/absence.ts`),
  - and a multi-team member's entry is counted in every team whose membership window covers `d`.

**AC-7 — Glossary rows and ADR-070 are recorded**
- Given `.ai/registry/glossary.md` and
  `.ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md`
- When both files are read
- Then `.ai/registry/glossary.md` has rows for **Org**, **Org public** and **Membership** matching
  `glossary_owed` in `ticket.yaml`, and `ADR-070` has status
  `` `ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)` ``.

**AC-8 — `.ai/standards/data-model.md` and `.ai/board/tickets/MIR-10/verification.md` are complete and audit-clean**
- Given `.ai/standards/data-model.md` and `.ai/board/tickets/MIR-10/verification.md` written at
  `IN_PROGRESS`
- When `node scripts/check-docs.mjs`, `node scripts/check-allowed-paths.mjs` and
  `node scripts/check-carry.mjs MIR-10` are run
- Then `check-allowed-paths.mjs` and `check-carry.mjs MIR-10` exit 0, `check-docs.mjs` reports zero
  errors on any file in `MIR-10`'s `allowed_paths` (`ADR-070`, `glossary.md`, `data-model.md`; the
  pre-existing D9 `doc_version: 2` finding on `ADR-068` from MIR-08 is outside `allowed_paths` per
  RULE-03), `.ai/standards/data-model.md:21-23` points to the new
  `## Multi-tenancy target schema (MIR-10, ADR-070)` section, and `verification.md` verifies every
  table, constraint, composite FK and downstream ticket mapping against the audit (`A:81-305`,
  `A:799-813`, `A:917-983`).

**Invariants touched: `[INV-04, INV-07]`.** Written back to `ticket.yaml`.

- **INV-04** (*one definition of the absence count; member still on that team on that date*):
  `.ai/registry/invariants.md:184-185` explicitly instructs MIR-10 to design for the restated
  wording. `public.membership` records `joined_at` and `left_at` (soft-leaving a team sets `left_at`
  rather than deleting the row), and MIR-12 backfills `joined_at = member.created_at` and
  `left_at = member.removed_at`. `absenceCountsFor` in `src/lib/data/absence.ts` remains the sole
  computation of the count.
- **INV-07** (*every entry belongs to one member, and is counted against every team that member
  belongs to*): `public.entry` remains keyed on `member_id` (with `entry_no_overlapping_portion`
  keyed on `member_id` and `primary_team_id` recording the member's primary team at creation), while
  team membership is N:M through `public.membership`, so an entry of a member on *k* active teams on
  date `d` is included in the entry read and absence count of each of those *k* teams.

**Open questions:** none. Every deferred commercial question in ADR-059 § *Out of scope* is left
nullable by design and not decided here.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

*(This ticket has no screen; nothing visual is designed.)*

## 3. Permission model

This ticket changes no runtime table, policy, grant, trigger or seam method (`schema_delta: none`).
The target permission invariants embedded in the schema design and enforced when MIR-11..MIR-16 land
are:

| Boundary | Database mechanism designed in MIR-10 (applied in MIR-11..MIR-16) |
|---|---|
| Cross-org foreign-key write refusal | Composite FKs `(team_id, org_id)`, `(member_id, org_id)` and `(event_id, org_id)` on every child table (MIR-11) refuse any cross-org link with SQLSTATE `23503` even if a policy or definer function has a bug |
| `org_code` immutability and reserved paths | `org_org_code_key`, `org_code_shape`, `org_code_not_reserved` and `BEFORE UPDATE` trigger `org_enforce_immutable_org_code` on `public.org` (MIR-11 / MIR-12) |
| Single shared tenant (`Org public`) | Partial unique index `org_one_shared_tenant_idx` on `public.org (is_shared_tenant) where is_shared_tenant = true` (MIR-11 / MIR-12) |
| One org per user | `public.member.id` PK references `auth.users (id)` + `member.org_id not null references public.org (id)` (MIR-11 / MIR-12) |
| At most one active membership per `(team_id, member_id)` and one active primary team per `member_id` | Partial unique indexes `membership_active_team_member_idx` and `membership_one_active_primary_idx` + `membership_inactive_not_primary` check constraint on `public.membership` (MIR-11 / MIR-12) |
| Per-team `manager` vs org-wide `org_admin` vs deployment-wide `system_admin` | `membership.role_in_team` (`public.team_role`: `'member' \| 'manager'`), `member.role` (`'member' \| 'org_admin'` in MIR-16), and separate `system_admin` store (MIR-18) |

## 4. Contract

### 4.1 Already completed at PLAN (do not revert at `IN_PROGRESS`)

1. **`.ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md`** — written and
   accepted at PLAN under ADR-067 delegation (`doc_version: 3`, `last_updated: 2026-10-27`,
   `governed_by: [RULE-01, RULE-04, RULE-07, RULE-09]`). Contains the complete DDL and invariant
   decisions (sections 1 to 5). The Developer verifies it is present and unaltered.
2. **`.ai/registry/glossary.md`** — updated at PLAN (`last_updated: 2026-10-27`) with the three rows
   in `glossary_owed`: **Org**, **Org public** and **Membership**. The Developer verifies all three
   rows are present and unaltered.

### 4.2 `.ai/standards/data-model.md` (Developer implements at `IN_PROGRESS`)

The Developer makes three edits to `.ai/standards/data-model.md`:

1. **Front-matter (`lines 1-5`):** bump `doc_version` from `8` to `9` and set
   `last_updated: 2026-10-27`.
2. **`### team` intro (`lines 21-23`):** replace:
   ```markdown
   inside an org. The columns that carry that are MIR-10's design, and this file describes them when
   it lands. *Until 2026-10-13 this read "One row in v1. The table exists anyway because INV-07 counts
   ```
   with:
   ```markdown
   inside an org. The target schema designed by MIR-10 ([ADR-070](../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md))
   is specified in `## Multi-tenancy target schema (MIR-10, ADR-070)` below and takes effect in
   `supabase/migrations/` as MIR-11, MIR-12, MIR-14, MIR-16 and MIR-21 land. *Until 2026-10-13 this read "One row in v1. The table exists anyway because INV-07 counts
   ```
3. **Append `## Multi-tenancy target schema (MIR-10, ADR-070)` at the end of `.ai/standards/data-model.md`**
   (after item 5 of `## OPEN QUESTIONS`), containing the following subsections transcribed from
   ADR-070 (taking care never to write a bare `/<word>` token outside `/{org_code}` so
   `scripts/check-docs.mjs` check D5 stays green):
   - **`### New enum: team_role`** — `public.team_role` (`'member'`, `'manager'`), used by
     `public.membership.role_in_team`, and the Phase 3 → Phase 4 transition plan for
     `public.member_role` (MIR-16).
   - **`### org`** — field table (`id`, `org_code`, `name`, `is_shared_tenant`, `max_members`,
     `max_teams`, `plan`, `licence_expires_at`, `timezone`, `created_at`), constraints
     (`org_org_code_key`, `org_code_shape`, `org_code_not_reserved` with all 29 reserved tokens
     listed as bare strings without leading slashes, `org_name_not_blank`, `org_plan_not_blank`,
     `org_timezone_not_blank`, `org_max_members_positive`, `org_max_teams_positive`), partial unique
     index `org_one_shared_tenant_idx`, trigger `org_enforce_immutable_org_code`, and the `Org public`
     seed specification (`is_shared_tenant = true`, `name = 'Org public'`, `org_code = 'shared'`).
   - **`### membership`** — field table (`id`, `org_id`, `team_id`, `member_id`, `role_in_team`,
     `is_primary`, `joined_at`, `left_at`), composite FKs (`membership_team_org_fk`,
     `membership_member_org_fk`), checks (`membership_left_after_joined`,
     `membership_inactive_not_primary`), partial unique indexes
     (`membership_active_team_member_idx`, `membership_one_active_primary_idx`), supporting indexes
     (`membership_member_active_idx`, `membership_org_id_idx`, `membership_team_history_idx`), and
     the MIR-12 backfill rule (`joined_at = member.created_at`, `left_at = member.removed_at`).
   - **`### Composite foreign keys and org_id across existing tables (MIR-11, MIR-12, MIR-14, MIR-21)`** —
     a table covering all 12 existing data tables (`team`, `member`, `entry`, `holiday`, `busy_day`,
     `issue_report`, `event`, `event_invitee`, `event_attendance`, `event_guest_link`,
     `event_guest`, `notification`) with their new columns (`org_id`, `primary_team_id`,
     `rejected_by`, `rejected_at`, `self_approved`), parent `unique (id, org_id)` constraints on
     `team`, `member` and `event`, exact composite foreign-key names and `ON DELETE` clauses
     (including `on delete set null (event_id)` on `event_guest` and `notification`), `holiday`'s
     `holiday_org_id_date_key` (`unique (org_id, date)`), and MIR-21's drop of `member.team_id`.
   - **`### Temporal multi-team absence count (INV-04, INV-07)`** — the four-part membership and
     entry predicate for team `T` on date `d` and the rule that `absenceCountsFor` in
     `src/lib/data/absence.ts` remains the single calculation site.

### 4.3 `.ai/board/tickets/MIR-10/verification.md` (Developer implements at `IN_PROGRESS`)

Because `MIR-10` is in Phase 3 (`verification_required: true`), the Developer creates
`.ai/board/tickets/MIR-10/verification.md` with front-matter:

```yaml
---
ticket: MIR-10
stage: IN_PROGRESS
agent: developer
produced_at: <ISO8601>
purpose: "Phase 3 schema design verification against the multi-tenancy audit (A:81-305, A:799-813, A:917-983) and downstream tickets MIR-11..MIR-21"
---
```

and four sections:

1. **`## 1. Acceptance criteria verification (AC-1 to AC-8)`** — one row per AC with its status and
   exact `file:line` citations in `ADR-070`, `.ai/standards/data-model.md` and
   `.ai/registry/glossary.md`.
2. **`## 2. Audit coverage matrix (A:81-305, A:799-813, A:917-983)`** — a table verifying that all 12
   existing data tables in audit § 1, all route/static path collisions in audit § 6 (`A:799-813`),
   and every breakage item in audit § 9a (`A:917-939`) and § 9c (`A:965-983`) has a corresponding
   column, constraint or migration rule in ADR-070 and `.ai/standards/data-model.md`.
3. **`## 3. Downstream ticket handoff matrix (MIR-11 to MIR-21)`** — a table mapping each downstream
   ticket (`MIR-11`, `MIR-12`, `MIR-13`, `MIR-14`, `MIR-15`, `MIR-16`, `MIR-17`, `MIR-18`, `MIR-19`,
   `MIR-20`, `MIR-21`) to the exact section of ADR-070 and `.ai/standards/data-model.md` it consumes.
4. **`## 4. Verification commands run`** — the exit codes and outputs of `node scripts/check-docs.mjs`
   (confirming zero errors on `ADR-070`, `glossary.md` and `data-model.md`),
   `node scripts/check-allowed-paths.mjs`, `node scripts/check-carry.mjs MIR-10`,
   `pnpm exec tsc --noEmit` and `pnpm exec eslint .`.

## 5. Seam impact

`none`. `src/lib/data/index.ts`, `src/lib/data/supabase.ts`, `src/lib/data/mock.ts`,
`src/lib/data/absence.ts` and `src/lib/domain/types.ts` are untouched by MIR-10. Their updates land
in MIR-12, MIR-13, MIR-14, MIR-15 and MIR-17.

## 6. Schema delta

`none` applied by this ticket. MIR-10 is the design and approval gate before any Phase 3 migration
(`plan:167`); the SQL DDL is specified in
[ADR-070](../../../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md) and
`.ai/standards/data-model.md` and executed by MIR-11, MIR-12, MIR-14, MIR-16 and MIR-21.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md"
  - ".ai/registry/glossary.md"
  - ".ai/standards/data-model.md"
  - ".ai/board/tickets/MIR-10/**"
```

Four entries (three paths outside the ticket folder), so `size: S`, which agrees with
`size_estimate: S`. `glossary_owed` is `[Org, "Org public", Membership]`, and all three rows have
been written in `.ai/registry/glossary.md` at PLAN (ADR-047).

## 8. Rejected alternatives

- **Use `'public'` as the `org_code` of Org public and exempt Org public from `org_code_not_reserved`.**
  Rejected. `'public'` is on the P3-1 reserved word list (`ticket.yaml:49`, `ADR-059:113`) because
  `public/` is the static asset directory and `try_files $uri $uri/ /index.html` in nginx can collide
  with static directories (`multi-tenancy-audit-2026-10-12.md:808-813`). Identifying Org public in
  SQL by `is_shared_tenant = true` (enforced as a singleton by `org_one_shared_tenant_idx`), naming
  it `'Org public'`, and giving it `org_code = 'shared'` keeps the reserved word check unconditional.
- **Delete a `membership` row when a member leaves a team instead of setting `left_at`.**
  Rejected. `INV-04` counts entries on date `d` whose member *"was still on that team on that date"*
  (`.ai/registry/invariants.md:176-177`). Hard-deleting the `membership` row would erase the
  member's historical team window `[joined_at, left_at)` and change past dates' absence counts in
  violation of ADR-013 and INV-04.
- **Backfill `membership.joined_at` with `now()` in MIR-12 instead of `member.created_at`.**
  Rejected. Any existing entry dated before the migration timestamp would then fall before
  `joined_at::date` and drop out of past absence counts. Backfilling `joined_at = member.created_at`
  and `left_at = member.removed_at` preserves every existing count across the migration.
- **Use plain `ON DELETE SET NULL` (without column list `(event_id)`) on the composite foreign keys
  for `event_guest` and `notification`.**
  Rejected. On a composite FK `(event_id, org_id) references public.event (id, org_id)`, plain
  `ON DELETE SET NULL` sets *both* referencing columns to `NULL` when the event is deleted, which
  fails against `org_id not null`. PostgreSQL 15+ `ON DELETE SET NULL (event_id)` nulls only
  `event_id` and leaves `org_id` intact.
- **Add a SQL view or database function to compute the per-team absence count.**
  Rejected. `INV-04` forbids a second definition of the absence count anywhere in the system, and
  `src/lib/data/absence.ts:15-18` explains why a database view cannot be the sole definition (CAL-07
  evaluates unsaved draft entries in the browser before any row exists). `absenceCountsFor` in
  `src/lib/data/absence.ts` remains the single implementation.

## Delegated decisions

- **Accepted [ADR-070](../../../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md)
  under ADR-067 delegation (`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`).**
  Plan item P3-1 (`.ai/board/plans/calechip-multi-tenancy-plan.md:167`) requires an ADR for the `org`
  and `membership` schema design before any Phase 3 migration. Every high-level tenancy and role
  choice was already settled by the operator in ADR-059, and the seven commercial questions in
  ADR-059 § *Out of scope* remain deferred as nullable columns (`max_members`, `max_teams`, `plan`,
  `licence_expires_at`). The remaining technical schema choices (`public.team_role` enum, `org_code`
  shape and 29-word reserved list, `org_code = 'shared'` for Org public, composite FK topology with
  `ON DELETE SET NULL (event_id)`, and `joined_at = member.created_at` backfill semantics for INV-04)
  have a clear recommended option and are recorded in ADR-070 per `.claude/commands/plan.md` § *An
  ADR or a question you can recommend an answer to (ADR-067)*.
