---
ticket: MIR-12
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-31T12:02:00Z
inputs_read:
  - .ai/board/tickets/MIR-12/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/standards/architecture.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/tickets/MIR-10/01-plan.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/bootstrap.sql
  - supabase/seed.sql
  - src/lib/domain/types.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/fixtures.ts
  - supabase/tests/_isolation.psql
  - supabase/tests/090-event-boundaries.test.sql
  - supabase/tests/120-composite-fks.test.sql
  - supabase/create-account.sql
  - .ai/board/tickets/MIR-12/99-questions.md
consulted:
  - "developer, 2026-10-31T12:14:50Z (99-questions.md Q1): NOT NULL and holiday swap moved to MIR-13; tests 120 and 130 added to allowed_paths"
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-12 — `org_id` backfilled into Org public, `membership` backfilled from `member.team_id`

## 1. Problem and scope

**Feature — MIR-12** (`.ai/registry/features.md`):

> `org_id` is added and backfilled into Org public, `membership` is backfilled from `member.team_id`, and `member.team_id` is dropped last.

MIR-11 (`.ai/board/tickets/MIR-12/ticket.yaml` `depends_on`) added all `org_id` columns as **nullable** across
every org-scoped table, created `public.org`, and created `public.membership` — all structural DDL.
MIR-12 is the **data migration phase**: it makes those nullable columns non-null by creating the
singleton *Org public* row, backfilling every existing team, member, entry and related-table row into
it, and populating `membership` from today's `member.team_id`. *Amended 2026-10-31 (99-questions Q1):*
the columns stay **nullable** after MIR-12; `SET NOT NULL` moves to MIR-13 (see out of scope below).

The operator delegated the step-ordering decision on 2026-10-12 (recorded in
`ticket.yaml mir_detail`): the final step in plan P3-3 — *Drop `member.team_id`* — waits for MIR-13
(policy rewrite), and is split out as MIR-21. MIR-12 therefore ends at *set NOT NULL*; the column
drop is out of scope. *Amended 2026-10-31:* MIR-12 also ends **before** *set NOT NULL* — that step
moves to MIR-13, so that a constraint lands in the same migration as the writers that must satisfy it.

**Which role gains what capability:** No user-visible capability changes in this ticket. The
migration runs as a human-applied SQL file (RULE-09). Its value is structural: after it lands, every
existing row in every org-scoped table has a valid, non-null `org_id`, the cross-org FK barrier
written by MIR-11 has non-null values to bind, and `public.membership` is seeded so MIR-13's policy rewrite has rows
to work against.

**Out of scope:**

- Dropping `member.team_id` or `member_team_id_idx` — that is **MIR-21**.
- **`SET NOT NULL` on every `org_id` and on `entry.primary_team_id` — moved to MIR-13** (amended
  2026-10-31, 99-questions Q1). Under NOT NULL every writer MIR-13 has not yet rewritten fails with
  23502: `090-event-boundaries.test.sql:82` and `:103` exercise the real `insert (event_id)` grant
  path and cannot be fixed by fixtures, and the admission trigger (`avatar_images:63-79`) would
  silently drop sign-ups. Each migration must be independently shippable
  (`.ai/board/plans/calechip-multi-tenancy-plan.md:323`). MIR-13 must re-run this ticket's
  idempotent backfill immediately before its `SET NOT NULL`, to catch rows written in between.
- **Replacing `holiday_date_key unique (date)` with `unique (org_id, date)` — moved to MIR-13** (same
  amendment). With `org_id` nullable, `unique (org_id, date)` lets `addHoliday` (still writing null)
  insert duplicate dates; keeping `holiday_date_key` keeps today's guarantee.
- `supabase/seed.sql`, `supabase/tests/_isolation.psql`, `090`, `100` and `supabase/create-account.sql`
  stay unchanged: with nullable columns none of them fails. `create-account.sql:152` is an `update`;
  its member row comes from the admission trigger, which is MIR-13's.
- Rewriting any RLS policy, trigger, or definer function — that is **MIR-13**.
- Adding `rejected_by`, `rejected_at`, or `self_approved` on `entry` — that is **MIR-14**.
- Any change to `src/`, `tests/` or `supabase/` beyond what is explicitly listed in § 7
  (`allowed_paths`). The `expected_impact` list in `ticket.yaml` concerns **MIR-13** onwards, when
  the policies are rewritten and the seam must supply `org_id`. *Amended 2026-10-31:* this bullet
  said "there is no running application code to update yet". That was wrong: the application and
  the pgTAP suite are live writers, which is why NOT NULL moved to MIR-13.
- Grants or RLS on `public.org` or `public.membership` — those are MIR-13's.

`size_estimate: M`

## 2. Acceptance criteria

Each criterion is stated from the perspective of an external check on the database state after the
migration runs. Checks here are observable via `psql` or `supabase db diff` — they do not require
application code to be running.

**How AC-2..AC-7 and AC-11 are exercised** (*amended 2026-10-31*): `supabase db reset` runs the seed
*after* migrations, so on a reset the migration backfills nothing. The verification is:
1. Run `pnpm db:test`. It leaves the seed's rows with null `org_id`.
2. Re-apply the migration file with `psql -f` against the local stack.
3. Re-apply it a second time (AC-11).
4. Run the AC queries.
The output goes into the implementation artifact (`verification_required: true`).

**AC-1 — Org public row exists and is the shared tenant**
- Given the migration file has been applied to a database that already has MIR-11's schema
- When `select id, org_code, name, is_shared_tenant from public.org` is executed
- Then exactly one row exists with `is_shared_tenant = true`, and it has `org_code = 'shared'` and `name = 'Org public'` (ADR-070 § 2; `'public'` is refused by `org_code_not_reserved`). *Amended 2026-10-31; was `'public'`.*

**AC-2 — Every team is backfilled into Org public**
- Given the migration has been applied and zero or more `public.team` rows existed before
- When `select count(*) from public.team where org_id is null` is executed
- Then the result is `0`

**AC-3 — Every member is backfilled into Org public**
- Given the migration has been applied
- When `select count(*) from public.member where org_id is null` is executed
- Then the result is `0`

**AC-4 — Every member with a non-null `team_id` has one backfilled `membership` row. It is the active primary unless the member is removed**
- Given the migration has been applied
- When `select count(*) from public.member m where m.team_id is not null and m.removed_at is null and not exists (select 1 from public.membership ms where ms.member_id = m.id and ms.team_id = m.team_id and ms.is_primary = true and ms.left_at is null)` is executed
- Then the result is `0`
- And when `select count(*) from public.member m where m.team_id is not null and m.removed_at is not null and not exists (select 1 from public.membership ms where ms.member_id = m.id and ms.team_id = m.team_id and ms.is_primary = false and ms.left_at = greatest(m.removed_at, m.created_at))` is executed
- Then the result is `0`. ADR-070 § 3 sets `left_at = removed_at`, and MIR-11's `membership_inactive_not_primary` forbids an inactive primary row, so a removed member's row is `is_primary = false`. *Amended 2026-10-31.*
- And every backfilled row has `joined_at = member.created_at`, and `team_role = 'manager'` exactly when `member.role = 'manager'`. The column is `team_role` as MIR-11 shipped it; ADR-070 calls it `role_in_team`.

**AC-5 — `membership` is_primary uniqueness index holds**
- Given the migration has been applied
- When `select count(*) from (select member_id from public.membership where left_at is null and is_primary = true group by member_id having count(*) > 1) dups` is executed
- Then the result is `0`; the partial unique index `membership_one_active_primary_idx` is the database-level guard

**AC-6 — Every `entry` row carries a non-null `org_id`, and a non-null `primary_team_id` wherever its author has a team**
- Given the migration has been applied
- When `select count(*) from public.entry e join public.member m on m.id = e.member_id where e.org_id is null or (e.primary_team_id is null and m.team_id is not null)` is executed
- Then the result is `0`
- And an entry whose author has `team_id is null` keeps `primary_team_id` null. The migration reports how many with `raise notice` and does not refuse to run. *Amended 2026-10-31:* the refusal existed only to protect `SET NOT NULL`, which moved to MIR-13.

**AC-7 — Every row in every other backfilled table carries a non-null `org_id`**
- Given the migration has been applied
- When each of these queries is executed: `select count(*) from public.holiday where org_id is null`, `select count(*) from public.busy_day where org_id is null`, `select count(*) from public.issue_report where org_id is null`, `select count(*) from public.event where org_id is null`, `select count(*) from public.event_invitee where org_id is null`, `select count(*) from public.event_attendance where org_id is null`, `select count(*) from public.event_guest_link where org_id is null`, `select count(*) from public.event_guest where org_id is null`, `select count(*) from public.notification where org_id is null`
- Then every result is `0`

**AC-8 — The columns stay nullable, so every writer MIR-13 has not yet rewritten still works** (*rewritten 2026-10-31; was "NOT NULL constraints are in place"*)
- Given the migration has been applied
- When `select table_name, column_name from information_schema.columns where table_schema = 'public' and ((column_name = 'org_id' and table_name in ('team','member','entry','holiday','busy_day','issue_report','event','event_invitee','event_attendance','event_guest_link','event_guest','notification')) or (table_name = 'entry' and column_name = 'primary_team_id')) and is_nullable = 'NO'` is executed
- Then zero rows are returned

**AC-9 — `holiday` uniqueness is unchanged: one row per date** (*rewritten 2026-10-31; the per-org swap moved to MIR-13*)
- Given the migration has been applied
- When the constraints on `public.holiday` are inspected
- Then `holiday_date_key` still exists and `holiday_org_id_date_key` does not
- And when a second `public.holiday` row is inserted with the date of an existing row
- Then it is rejected with 23505

**AC-10 — `public.org` RLS is enabled; no authenticated session can read it without a policy**
- Given the migration has been applied (MIR-11 enabled RLS and revoked all grants on `public.org`)
- When an `authenticated` session executes `select * from public.org`
- Then zero rows are returned (no policy grants reads yet — that is MIR-13)

**AC-11 — The migration is idempotent on a database that has already run it**
- Given the migration has been applied once
- When the migration file is applied a second time
- Then it succeeds without error and leaves the database in the same state

**AC-12 — `bootstrap.sql` is updated so admin-zero provisioning writes `org_id`**
- Given the updated `bootstrap.sql` is applied after MIR-12's migration on a fresh project
- When `select count(*) from public.team where org_id is null` and `select count(*) from public.member where org_id is null` are executed
- Then both return `0`

**AC-13 — A pgTAP file covers the checks a reset database can answer** (*added 2026-10-31*)
- Given `supabase/tests/130-backfill-org-public.test.sql` exists
- When `pnpm db:test` runs
- Then it asserts AC-1, AC-8, AC-9 and AC-10 against the reset database, and passes

**AC-14 — `pnpm db:test` is green with no existing assertion weakened** (*added 2026-10-31*)
- Given the migration and the test changes in § 7
- When `pnpm db:test` runs
- Then every test passes
- And the only edit to an existing test is the fixture org `org-alpha` in `120-composite-fks.test.sql:218-219`, which becomes `is_shared_tenant = false`. Org public now holds the one shared-tenant slot (`org_one_shared_tenant_idx`). The test's assertion that a second shared tenant is refused (`:243-247`) stays, and now refuses against Org public.

**Invariants touched:**

- **INV-04** — The absence count is computed over members *still on a team on the date*. After MIR-12,
  `member.team_id` is still the live pointer (MIR-13 moves queries to `membership`). The migration
  creates `membership` rows that mirror `member.team_id`, but no query path yet reads `membership`.
  INV-04 is therefore *not broken* by this ticket, but the backfill must be consistent with it: a
  member with `team_id = X` must have an active primary `membership` row pointing to `(team_id = X,
  org_id = <org_public_id>, is_primary = true, left_at = null)`.
- **INV-07** — Every entry belongs to exactly one member and is counted against every team that
  member belongs to. After MIR-12, `entry.primary_team_id` records the member's primary team at
  insert time (now the same as `member.team_id`). MIR-13 rewrites the policies that derive the team
  from `member.team_id`. INV-07 is upheld by the composite FK
  `entry_member_org_fk (member_id, org_id) -> member (id, org_id)`, which now has non-null values on
  both sides.

**Open questions:** None. All decisions are recorded in `ticket.yaml mir_detail` and ADR-070.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

MIR-12 produces no UI change. There is no screen to design.

## 3. Permission model

This ticket produces one migration file. No session-level operation is changed. The entire migration
is executed as a human-supplied SQL file (RULE-09); no grant or RLS change is included in this file.

**bootstrap.sql update:** The bootstrap is a `do $$ ... $$` block that creates the first team and
promotes admin-zero. Its update adds `org_id = v_org_id` to the two inserts it already performs.
It runs as the database owner (service role via `psql` or the Supabase SQL editor), so column
access is not restricted. No new policy is needed.

Check R6: no role gate changes in this ticket.

## 4. Contract

MIR-12 is a pure schema migration with a `bootstrap.sql` update. No seam function is added, changed,
or removed. The file that will be produced is:

```
supabase/migrations/<timestamp>_mir12_backfill_org_public.sql
```

The timestamp follows the convention in `supabase/migrations/` (ISO 8601 compact, UTC):
`20261031120000` or the next available slot.

**Migration inputs consumed (human-supplied at apply time, identical to bootstrap.sql pattern):**

```sql
-- None. The migration finds the Org public uuid it just inserted via a local variable.
```

**Migration outputs (after apply):**

- `public.org`: 1 row (`org_code = 'shared'`, `name = 'Org public'`, `is_shared_tenant = true`, `timezone = 'Asia/Ho_Chi_Minh'`)
- `public.membership`: N rows (one per existing `member` row where `team_id is not null`). Columns `org_id, team_id, member_id, team_role, is_primary, joined_at, left_at` take the values in AC-4.
- Every `org_id` on all 12 tables: backfilled, **still nullable** (NOT NULL is MIR-13's)
- `entry.primary_team_id`: backfilled from `member.team_id`, **still nullable**
- `holiday_date_key`: **unchanged**
- Test file: `supabase/tests/130-backfill-org-public.test.sql` (AC-13)

**Seam / type changes:** None in this ticket. `src/lib/domain/types.ts`, `src/lib/data/mock.ts`,
`src/lib/fixtures.ts`, and `src/lib/data/supabase.ts` are unchanged. The `org_id` field does not
appear in the client types until MIR-13 rewrites the seam queries to supply it.

## 5. Seam impact

None. No function in `src/lib/data/` is added, renamed, or changed. The seam-parity test is
unaffected.

## 6. Schema delta

**Non-trivial — ADR-070 governs this.** The migration:

1. Creates `public.org` row for Org public.
2. Backfills `org_id` (referencing the new row) on every nullable `org_id` column in all 12 tables.
3. Backfills `entry.primary_team_id` from `member.team_id` via `entry.member_id`.
4. Inserts one `public.membership` row per non-null `member.team_id` with `is_primary = true, left_at = null`.
5. ~~Sets `NOT NULL` on every `org_id` column and on `entry.primary_team_id`.~~ Moved to MIR-13 (amended 2026-10-31).
6. ~~Drops `holiday_date_key unique (date)` and adds `holiday_org_id_date_key unique (org_id, date)`.~~ Moved to MIR-13 (amended 2026-10-31).
7. Updates `supabase/bootstrap.sql` to write `org_id` on the team and member inserts it performs.

**ADR link:** [ADR-070](../../../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md)
§§ 3, 5 (backfill sequencing and NOT NULL promotion).

**No migration is applied by this ticket.** The file is drafted here; a human applies it per RULE-09.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20261031120000_mir12_backfill_org_public.sql"
  - "supabase/bootstrap.sql"
  - "supabase/tests/120-composite-fks.test.sql"
  - "supabase/tests/130-backfill-org-public.test.sql"
```

`glossary_owed` in `ticket.yaml` is `[]` — no glossary rows owed.

`size`: 4 paths → **S** (*amended 2026-10-31; was 2 paths*). `size_estimate` was M (written before counting paths). The estimate and the
count disagree: M was chosen because the migration logic is non-trivial even if the path count is
small. The verdict (ADR-012) is **S** — the two files are the only deliverables.

## 8. Rejected alternatives

**Alt 1 — backfill `org_id` in application code (a one-off script in `scripts/`) rather than SQL.**

Rejected. The migration runs as a human-applied SQL transaction. A TypeScript script would need the
service role key at the terminal, would bypass the database's transaction atomicity, and would
produce a file in `scripts/` that is spent after one use. The SQL approach is atomic (single
`begin/commit`), leaves a permanent record in `supabase/migrations/`, and follows the pattern every
other migration uses. Cost: the SQL must be vetted by a human before apply, which is RULE-09's
requirement anyway.

**Alt 2 — set `NOT NULL` in a separate subsequent migration.**

*Reversed 2026-10-31 (99-questions Q1): now **adopted**. NOT NULL moves to MIR-13, into the same
migration as the writer rewrite.* The window this paragraph worried about already exists since
MIR-11, and MIR-13 closes it by re-running the idempotent backfill before `SET NOT NULL`. The
alternative, setting NOT NULL before the writers supply `org_id`, breaks live write paths
(`090:82`, `090:103`, the admission trigger) and leaves CI red, which plan:323 rules out. The
original reasoning follows and is kept as the record.

Rejected for this ticket's scope. The plan (P3-3) explicitly sequences: add nullable, backfill, set
NOT NULL, all as one logical unit across MIR-11 and MIR-12. Splitting the NOT NULL promotion into a
third migration (MIR-11.5) would add a state where `org_id` is backfilled but not enforced — a
window during which a concurrent insert could land without `org_id` and silently succeed. Keeping
backfill and NOT NULL in the same transaction closes that window.

**Alt 3 — use `NOT VALID` and then `VALIDATE CONSTRAINT` in a follow-up.**

Considered for large tables (ADR-069 decision 1 records the precedent for the `overload_threshold`
constraint). Rejected here because the NOT NULL promotion is not a constraint validated by a scan —
PostgreSQL's `ALTER TABLE … ALTER COLUMN … SET NOT NULL` runs a full table scan inline. There is no
`NOT VALID` equivalent for a NOT NULL column. For a hosted project with a non-trivial number of rows,
the operator must assess whether applying this migration offline or during low-traffic is appropriate;
the file itself cannot make that choice and the comment in the migration header will say so.

## Changelog

- `2026-10-31T12:02:00Z` — initial draft. tech-lead-design.
- `2026-10-31T12:17:00Z` — consultation, 99-questions Q1 (developer).
  - `SET NOT NULL` and the holiday unique swap moved to MIR-13. Under NOT NULL, unrewritten writers
    fail with 23502 (`090:82`, `090:103`, the admission trigger), fixtures cannot fix that, and
    plan:323 requires each migration to ship alone.
  - AC-1 now `'shared'`, and AC-4 gives removed members `is_primary = false`; both follow ADR-070
    and MIR-11's checks.
  - AC-6, AC-8 and AC-9 rewritten; AC-13 and AC-14 added.
  - `allowed_paths` gains `120` and `130`; size stays S.
  - Seed, `_isolation.psql`, `090`, `100` and `create-account.sql` stay out, because nullable
    columns do not break them.
  tech-lead-design.
