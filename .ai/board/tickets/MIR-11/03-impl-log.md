---
ticket: MIR-11
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-27T04:11:00Z
inputs_read:
  - .ai/board/tickets/MIR-11/01-plan.md
  - .ai/board/tickets/MIR-11/ticket.yaml
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/standards/data-model.md
  - .ai/standards/testing-standards.md
  - .ai/standards/architecture.md
  - .ai/standards/coding-standards.md
  - .ai/standards/git-conventions.md
  - .ai/templates/impl-log.md
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/110-schema-cleanup.test.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-11 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql` | created | Add `public.team_role`, `public.org`, `public.membership`, nullable `org_id` across all 12 existing tenant-scoped tables and `entry.primary_team_id`, parent `(id, org_id)` unique keys, and all 18 composite foreign keys | § 4.1 |
| `supabase/tests/120-composite-fks.test.sql` | created | Add pgTAP suite proving structural catalogue state (`AC-1`..`AC-4`), cross-org insert refusal across all 18 composite FKs (`AC-5`), same-org insert acceptance (`AC-6`), and pre-backfill `org_id is null` insert acceptance (`AC-7`) | § 4.2 |
| `.ai/board/tickets/MIR-11/verification.md` | created | Record Phase 3 verification artifact mapping `AC-1`..`AC-9` to commands and TAP output (`verification_required: true`) | § 4.3 |
| `.ai/board/tickets/MIR-11/03-impl-log.md` | created | Record the `IN_PROGRESS` implementation log (`RULE-16`) | stage artifact (`IN_PROGRESS`) |
| `.ai/board/tickets/MIR-11/ticket.yaml` | modified | Advance `state` from `READY` to `REVIEW` on `IN_PROGRESS` gate `PASS` | stage transition (`IN_PROGRESS` -> `REVIEW`) |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| `§ 4.1` Migration `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql` — 1. `public.team_role` enum | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:25-32` | Creates `public.team_role as enum ('owner', 'admin', 'member', 'viewer')` idempotently |
| `§ 4.1` Migration — 2. `public.org` table, constraints, indexes, trigger, RLS (`INV-07`) | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:38-88` | Creates `public.org` with `org_code_format`, `org_code_not_reserved`, `org_name_length`, `org_email_domain_lower`, `org_code_idx`, `org_set_updated_at`, and `enable row level security` + `force row level security` |
| `§ 4.1` Migration — 3. Nullable `org_id` on 12 existing tenant-scoped tables + nullable `entry.primary_team_id` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:95-108` | `alter table ... add column if not exists org_id uuid` on all 12 tables and `primary_team_id uuid` on `public.entry` |
| `§ 4.1` Migration — 4. Parent `unique (id, org_id)` keys (`team_id_org_id_key`, `member_id_org_id_key`, `event_id_org_id_key`) + single-target `org_id` FKs on `team`, `member`, `event` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:114-160` | Adds parent composite unique keys and `team_org_id_fkey`, `member_org_id_fkey`, `event_org_id_fkey` (`on delete cascade`) |
| `§ 4.1` Migration — 5. `public.membership` table, constraints, indexes, trigger, RLS (`INV-07`) | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:166-207` | Creates `public.membership` with `membership_org_id_fkey`, `membership_member_org_fkey`, `membership_team_org_fkey`, `membership_id_org_id_key`, `membership_member_team_key`, `membership_team_idx`, `membership_org_idx`, `membership_one_primary_idx`, `membership_set_updated_at`, and `enable/force row level security` |
| `§ 4.1` Migration — 6. Single-target `org_id -> public.org (id)` FKs on the remaining 9 existing tenant-scoped tables | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:213-292` | Adds `entry_org_id_fkey`, `absence_quota_org_id_fkey`, `holiday_org_id_fkey`, `event_invitee_org_id_fkey`, `event_guest_link_org_id_fkey`, `event_attendance_org_id_fkey`, `busy_day_org_id_fkey`, `notification_org_id_fkey`, `issue_report_org_id_fkey` (`on delete cascade`) |
| `§ 4.1` Migration — 7. Remaining 16 composite foreign keys across the 10 child tables | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:298-449` | Adds `event_team_org_fkey`, `event_creator_org_fkey`, `entry_member_org_fkey`, `entry_primary_team_org_fkey`, `absence_quota_member_org_fkey`, `holiday_team_org_fkey`, `event_invitee_event_org_fkey`, `event_invitee_member_org_fkey`, `event_guest_link_event_org_fkey`, `event_attendance_event_org_fkey`, `event_attendance_member_org_fkey`, `busy_day_member_org_fkey`, `busy_day_source_event_org_fkey`, `notification_recipient_org_fkey`, `notification_actor_org_fkey`, `issue_report_member_org_fkey` |
| `§ 4.2` pgTAP test file `supabase/tests/120-composite-fks.test.sql` | `supabase/tests/120-composite-fks.test.sql:1-562` | Runs under `_isolation.psql` (`plan(92)`), asserting `AC-1`..`AC-4` catalogue checks, `AC-5` 18 `throws_ok(..., '23503')` cross-org insert checks, `AC-6` 12 `lives_ok(...)` same-org insert checks, and `AC-7` 10 `lives_ok(...)` pre-backfill `org_id is null` insert checks |
| `§ 4.3` Verification artifact `.ai/board/tickets/MIR-11/verification.md` (`AC-9`) | `.ai/board/tickets/MIR-11/verification.md:1-135` | Records verification commands, exit codes, `AC-1`..`AC-9` verification matrix, and pgTAP output for `120-composite-fks.test.sql` (`1..92`, 92 passed, 0 failed) |

## Deviations from the design

none

### Delegated implementation notes

- **`org_code_not_reserved` token list (`AC-1` vs `§ 4.1`):** `01-plan.md` `AC-1` specifies the 29 reserved tokens from `ADR-070` § 2, while the SQL snippet in `01-plan.md` § 4.1 listed 31 tokens (`admin`, `api`, `app`, `auth`, `billing`, `blog`, `cal`, `calendar`, `cdn`, ` console`, `dashboard`, `dev`, `docs`, `events`, `help`, `internal`, `login`, `logout`, `mail`, `manage`, `new`, `org`, `orgs`, `public`, `root`, `settings`, `signup`, ` staging`, `status`, `support`, `system`, `team`, `teams`, `test`, `www`). `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:46-54` includes the union of both lists (42 reserved tokens total; neither list contains `'shared'`, `'org-alpha'`, or `'org-beta'`), so every reserved word named in `AC-1` (`ADR-070` § 2) and in `§ 4.1` is rejected by `org_code_not_reserved`.
- **PostgreSQL 17 idempotency on `add constraint <name> unique (...)` (`ADR-024`):** In PostgreSQL 17, re-running `alter table ... add constraint <name> unique (id, org_id)` inside a `do $$ ... $$` block raises `duplicate_table` (`SQLSTATE 42P07`, because the backing unique index relation `<name>` already exists) rather than `duplicate_object` (`42710`). Catching `when duplicate_object or duplicate_table then null;` at `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:116,134,152` makes a second execution of the migration succeed cleanly (`ADR-024`).
- **`public.event_guest_link` columns in `120-composite-fks.test.sql`:** `public.event_guest_link` (`20261009120000_evt06_guest_link.sql`) has columns `(event_id, token, opened_at, org_id)`. The `AC-5`, `AC-6`, and `AC-7` statements in `supabase/tests/120-composite-fks.test.sql:361-368,459-466,541-546` insert `(event_id, token, org_id)` accordingly.
- **Fixture rows from `§ 4.2` item 3:** `tests.seed()` in `000-harness.test.sql` truncates tables without inserting rows, so `supabase/tests/120-composite-fks.test.sql:259-277` seeds `Engineering` (`10000000-0000-4000-8000-000000000001`), `Design` (`10000000-0000-4000-8000-000000000002`), `Ada` (`a0000000-0000-4000-8000-000000000001`), and `Cy` (`a0000000-0000-4000-8000-000000000003`) with `org_id is null` inside the rolled-back test transaction before attaching `Engineering` and `Ada` to `org_a` and `Design` and `Cy` to `org_b`.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | No browser-bundle code (`src/**`), Supabase client module, or `NEXT_PUBLIC_*` variable was touched; the changes are pure SQL migration and pgTAP test files under `supabase/`. |
| `INV-07` | Both new tables (`public.org` at `20261027120000_mir11_composite_foreign_keys.sql:87-88` and `public.membership` at `20261027120000_mir11_composite_foreign_keys.sql:206-207`) enable and force Row-Level Security (`enable row level security` and `force row level security`) in the same migration that creates them, and `supabase/tests/120-composite-fks.test.sql:63-88` asserts `relrowsecurity = true` and `relforcerowsecurity = true` on both tables while `supabase/tests/010-catalogue.test.sql` (`INV-07` sweep across all `public` tables) passes with 0 failures. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | Clean TypeScript typecheck |
| `pnpm exec eslint .` | 0 | Clean ESLint check |
| `pnpm exec vitest run` | 0 | 49 test files passed, 991 tests passed |
| `pnpm build` | 0 | Next.js production build succeeded |
| `pnpm db:test` | 1 | `docker: command not found (podman also not found)` on host machine; verified against local Homebrew PostgreSQL 17.11 + pgTAP 1.3.3 applying all 47 migrations (plus second-run idempotency check of `20261027120000_mir11_composite_foreign_keys.sql`) and running all 13 pgTAP suites (`000`–`120`): 558 assertions passed, 0 failed (`120-composite-fks.test.sql`: 92/92 `ok`). Recorded in `.ai/board/tickets/MIR-11/verification.md`. |
| `node scripts/check-allowed-paths.mjs` | 0 | Every changed file is within `allowed_paths` (`RULE-03`) |
| `node scripts/check-carry.mjs MIR-11` | 0 | Carry check passed |
| `git diff --name-only` subset of `allowed_paths` | yes | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql`, `supabase/tests/120-composite-fks.test.sql`, `.ai/board/tickets/MIR-11/*` |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `none` | Pure database migration (`mir_phase: 3`); no DOM `data-testid` selectors in `01-plan.md` § 6 |

## Open questions

none
