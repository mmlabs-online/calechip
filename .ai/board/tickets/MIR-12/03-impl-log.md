---
ticket: MIR-12
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-31T12:24:00Z
inputs_read:
  - .ai/board/tickets/MIR-12/01-plan.md
  - .ai/board/tickets/MIR-12/ticket.yaml
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/migrations/20260905120000_adm02_holiday.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/bootstrap.sql
  - supabase/seed.sql
  - supabase/tests/120-composite-fks.test.sql
  - supabase/tests/090-event-boundaries.test.sql
consulted:
  - with: tech-lead-design
    asked: "allowed_paths cannot hold once org_id is NOT NULL — seed.sql, test 120's shared-tenant fixture and test 090's app-write assertions all fail. Widen to what? Also confirm org_code = 'shared' (ADR-070 § 2) and removed members as is_primary = false (membership_inactive_not_primary)."
    answer: "Neither widen to the seed nor add compat: SET NOT NULL and the holiday unique swap move to MIR-13, beside the writer rewrite. Columns stay nullable. allowed_paths gains tests 120 (org-alpha becomes is_shared_tenant = false) and new 130. Both ADR-070 corrections confirmed. The entry-orphan refusal becomes a notice."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-12 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261031120000_mir12_backfill_org_public.sql` | created | Creates Org public, backfills `org_id` / `entry.primary_team_id` on all 12 tables, seeds `membership`; idempotent | § 4 outputs; § 6 steps 1–4 |
| `supabase/bootstrap.sql` | modified | Admin-zero provisioning must write `org_id` on the team and member it creates, and the matching `membership` row | § 6 step 7; AC-12 |
| `supabase/tests/120-composite-fks.test.sql` | modified | Fixture `org-alpha` collided with Org public on `org_one_shared_tenant_idx`; now `is_shared_tenant = false` (`:218-220`) | AC-14 |
| `supabase/tests/130-backfill-org-public.test.sql` | created | pgTAP for the checks a reset database can answer | AC-13 (AC-1, AC-8, AC-9, AC-10) |
| `.ai/board/tickets/MIR-12/99-questions.md` | created | The consultation that amended the plan | — |
| `.ai/board/tickets/MIR-12/ticket.yaml` | modified | `chat_budget.developer->tech-lead-design.used` 0 → 1 | — |

`01-plan.md` and `ticket.yaml` `allowed_paths` / `schema_delta` were amended by `tech-lead-design`, not by this stage.

## Contract items

| Plan item (§ 4 / § 6, as amended 2026-10-31) | Implemented at | Notes |
|----------|----------------|-------|
| Org public row, `org_code = 'shared'`, `name = 'Org public'` | migration `:34-49` | Found by `is_shared_tenant`; refuses if a non-shared `'shared'` row exists. `plan` keeps MIR-11's `not null default 'free'` |
| Entry-orphan count reported, not refused | migration `:51-66` | `raise notice` with the count (AC-6) |
| `org_id` backfill, parents before children | migration `:68-92` | `team`, `member`, `event` first so composite FKs have a target |
| `entry.primary_team_id` from `member.team_id` | migration `:78-84` | `coalesce` keeps any existing value |
| `membership` backfill (ADR-070 § 3) | migration `:94-120` | `team_role` mapped from `manager`; `joined_at = created_at`; removed → `is_primary = false`, `left_at = greatest(removed_at, created_at)`; `not exists` guard |
| bootstrap writes `org_id` + membership | `bootstrap.sql` Org public lookup before the team insert; member insert `org_id`; membership insert at the end | Refuses if Org public is missing |

## Deviations from the design

- **AC-10 observable.** The plan says an authenticated `select * from public.org` returns zero rows. MIR-11 revoked every grant, so it raises 42501 before RLS is reached. Test 130 asserts 42501 and, separately, that RLS is enabled. Both mean "no read".
- **`bootstrap.sql` also inserts a `membership` row.** § 6 step 7 names only `org_id` on the two inserts. Without the row, admin zero would be the only member with a `team_id` and no `membership`, the exact gap MIR-13's policies would then mis-read. Same mapping as the backfill (`admin` → `'member'`).

Everything else follows the amended plan.

## Delegated decisions

- Removed members whose `removed_at` precedes `created_at` take `left_at = created_at`, so `membership_left_after_joined` holds. TL confirmed in 99-questions.md.

## Invariants

| ID | Still holds because |
|----|---------------------|
| INV-04 | No reader moves to `membership` in this ticket. The rows written mirror `member.team_id` with `joined_at = created_at`, so every pre-existing entry falls inside its author's window when MIR-13 switches readers. A removed member's window closes at `removed_at`, matching today's `removed_at` filter. |
| INV-07 | `entry.primary_team_id` is copied from the author's own `member.team_id`, the only team source, and `entry_member_org_fk` / `entry_primary_team_org_fk` now hold non-null pairs in one org. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 49 files, 992 tests |
| `pnpm db:test` | 0 | 14 files, 567 tests, `Result: PASS`; 130 and the amended 120 pass. The four `Failed (TODO)` lines in 010/030/080 are pre-existing TODOs |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-carry.mjs MIR-12` | 0 | PASS — nothing stray |

### Backfill verification (AC-2..AC-7, AC-11) — `verification_required: true`

`db reset` runs with the seed disabled (`supabase/config.toml:65-73`, MIR-05), so a reset database has nothing to backfill. On the local stack after `pnpm db:test`:

1. `seed.sql` loaded with `calechip.seed_target=local`. Its members arrived pending with no team (the admission trigger inserts first; the seed's `on conflict (id) do nothing` then skips), so the membership path was not exercised.
2. A pre-MIR-12 state was then rebuilt by script: all `org_id`, `primary_team_id` and `membership` nulled or deleted, Org public deleted. Members were varied: 5 on team 1 and 2 on team 2; one `admin`, one `manager`; one removed a day after creation, one with `removed_at` before `created_at`; one left pending with no team. Data: 2 teams, 8 members, 2 entries, 6 holidays, 1 issue report.
3. The migration was applied twice with `psql -v ON_ERROR_STOP=1`. Both exited 0 and printed `NOTICE: mir12: 1 entry row(s) belong to a member with no team_id`.

| Query (01-plan.md § 2) | Before | After 2× apply |
|------|--------|-------|
| AC-1 Org public row | none | `shared / Org public / true`, one row |
| AC-2 teams with null `org_id` | 2 | 0 |
| AC-3 members with null `org_id` | 8 | 0 |
| AC-4 active members missing an active primary row | 5 | 0 |
| AC-4 removed members missing `is_primary = false, left_at = greatest(…)` | 2 | 0 |
| AC-4 `joined_at ≠ created_at` or role mismatch | — | 0 |
| AC-5 duplicate active primaries | 0 | 0 |
| AC-6 entries with null `org_id`, or null `primary_team_id` whose author has a team | 2 | 0 |
| AC-7 null `org_id` across the other 9 tables | 7 | 0 |
| AC-11 `membership` rows after 1st and 2nd apply | — | 7 and 7 |

Per-row check of the 7 `membership` rows: the admin and members map to `member` and the manager to `manager`. The 5 active rows are `is_primary = true` with `left_at` null; the 2 removed rows are `is_primary = false` with `left_at` set; every row has `joined_at = created_at`.

**AC-12.** On a fresh `supabase db reset --local`, an `auth.users` row `zero@mir12.test` was inserted, and `bootstrap.sql` was applied with `calechip.bootstrap_email=Zero@mir12.test`. The first run exited 0. Afterwards: teams with null `org_id` 0, members with null `org_id` 0, 1 active primary membership, and member, team and Org public all on the same org. The second run exited 0 with `already bootstrapped`.

## Testability contract

No UI; no selectors (plan § 2b).

## Open questions

- **MIR-13 has to pick up what moved off this ticket.** That means: re-run this file's backfill, `SET NOT NULL` on the 12 `org_id` columns and `entry.primary_team_id`, and swap `holiday_date_key` for `holiday_org_id_date_key`. It also has to settle entries whose author has no `team_id` (the migration reports them) before `SET NOT NULL`. Today this obligation is recorded only in this ticket's `01-plan.md` § 1 and its Changelog; MIR-13 is in BACKLOG with no plan.
