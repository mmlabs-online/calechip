---
ticket: MIR-12
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-31T12:38:46Z
inputs_read:
  - .ai/board/tickets/MIR-12/01-plan.md
  - .ai/board/tickets/MIR-12/03-impl-log.md
  - .ai/board/tickets/MIR-12/99-questions.md
  - .ai/board/tickets/MIR-12/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/templates/review-report.md
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - "git diff origin/main...HEAD"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
verdict: PASS
failed_checks: []
invariant_violation: false
route_to: none
increments_rework: false
---

# MIR-12 — review

Reviewed against `01-plan.md` as amended 2026-10-31T12:17:00Z (NOT NULL and the holiday unique swap
moved to MIR-13). The working tree was clean; the subject is `origin/main...HEAD` (9 files).

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (9 changed files; the four code paths match `ticket.yaml` `allowed_paths`, the rest are the ticket folder and `.ai/board/backlog.md`, ship-owned). `node scripts/check-carry.mjs MIR-12` → `0 uncommitted path(s)`, `PASS — nothing stray` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` → `tsc --noEmit`, exit 0 |
| R3 | lint exit 0 | PASS | `pnpm lint` → `eslint .`, exit 0, no output. The diff has no lintable files (SQL only) |
| R4 | Nothing bypasses the data-access seam | PASS | No file under `src/` in the diff. All writes are in migration SQL (`supabase/migrations/20261031120000_mir12_backfill_org_public.sql:73-118`) and the human-run `supabase/bootstrap.sql:186-217` |
| R5 | Every contract item in plan § 4 implemented | PASS | See R5 detail. `pnpm db:test` → `Files=14, Tests=567`, `Result: PASS` (130 and amended 120 `ok`; the TODO failures in 010/030/080 are pre-existing `TODO` assertions, not counted as failures). `pnpm test` → 49 files, 992 passed |
| R6 | Permission gating matches plan § 3 | PASS | Plan § 3: no grant or RLS change. The migration contains no `grant`, `revoke`, `policy` or `security definer` (`20261031120000_mir12_backfill_org_public.sql:25-122`). `bootstrap.sql:178-217` runs as owner and changes no grant. AC-10 holds: `supabase/tests/130-backfill-org-public.test.sql:64-75` |
| R7 | No invariant violated | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty |

## R5 detail

| Contract item (plan § 4 / § 6, amended) | Implemented at | Matches signature |
|---|---|---|
| File `supabase/migrations/20261031120000_mir12_backfill_org_public.sql` | that path | Yes — timestamp `20261031120000` as § 4 names |
| `public.org` row: `org_code = 'shared'`, `name = 'Org public'`, `is_shared_tenant = true`, `timezone = 'Asia/Ho_Chi_Minh'`; idempotent reuse | `20261031120000_mir12_backfill_org_public.sql:38-49` | Yes. Lookup by `is_shared_tenant` (unique by `org_one_shared_tenant_idx`); refuses a non-shared `'shared'` row at `:41-44`. Asserted by `130-backfill-org-public.test.sql:12-21` |
| `org_id` backfilled on all 12 tables, parents first, still nullable | `20261031120000_mir12_backfill_org_public.sql:73-92` | Yes — team, member, event (`:73-75`) before entry (`:78-83`) and the eight children (`:85-92`); all guarded `where org_id is null`. No `set not null` anywhere in the file. Nullability asserted at `130-backfill-org-public.test.sql:24-35` |
| `entry.primary_team_id` from `member.team_id`, still nullable | `20261031120000_mir12_backfill_org_public.sql:78-83` | Yes — `coalesce(e.primary_team_id, m.team_id)` |
| Orphan entries reported, not refused (AC-6) | `20261031120000_mir12_backfill_org_public.sql:56-66` | Yes — `raise notice`, no exception |
| `membership` rows per non-null `member.team_id`, values per AC-4 | `20261031120000_mir12_backfill_org_public.sql:101-118` | Yes — `team_role` manager/member mapping `:105-107`; `is_primary = removed_at is null` `:108`; `joined_at = created_at` `:109`; `left_at = greatest(removed_at, created_at)` `:110-111`, satisfying MIR-11 `membership_inactive_not_primary` and `membership_left_after_joined` (`20261027120000_mir11_composite_foreign_keys.sql:178-181`); `not exists` guard `:114-118` gives AC-11 |
| `holiday_date_key` unchanged | migration has no `holiday` DDL (`:85` is the only `holiday` line) | Yes — asserted `130-backfill-org-public.test.sql:38-61` |
| `bootstrap.sql` writes `org_id` on team and member (AC-12) | `supabase/bootstrap.sql:178-184`, `:187-188`, `:194`, `:202-205` | Yes. Also writes one active primary `membership` row `:216-217` — a stated deviation in `03-impl-log.md`, consistent with ADR-070 § 3 and the backfill mapping; it adds no path and no contract surface |
| Test file 130 (AC-13) | `supabase/tests/130-backfill-org-public.test.sql:1-79` | Yes — AC-1, AC-8, AC-9, AC-10. AC-10 asserts 42501 rather than zero rows (`:71-75`): MIR-11 revoked all grants, so "no read" is reached earlier; stated deviation, same observable outcome |
| Test 120 fixture only change (AC-14) | `supabase/tests/120-composite-fks.test.sql:217-221` | Yes — `org-alpha` → `is_shared_tenant = false`; no assertion removed |
| AC-2..AC-7, AC-11 (data backfill, `verification_required: true`) | Recorded in `03-impl-log.md` § *Backfill verification* | Developer evidence: before/after counts, 2× apply exit 0, 7 → 7 membership rows. Not reproduced here; the SQL at `:73-118` is consistent with every row of that table |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — absence count over members still on the team on the date | No reader is changed: the count is still computed from `member.team_id` and `removed_at`. The backfilled `membership` rows mirror `member.team_id` with `joined_at = created_at` and close at `removed_at` (or `created_at` if earlier), so when MIR-13 moves readers to `membership` every existing entry falls in the same window it does today. No second definition of the count is introduced | `20261031120000_mir12_backfill_org_public.sql:101-118`; no file under `src/` or any function definition in the diff |
| INV-07 — every entry belongs to exactly one member and counts against that member's teams | `entry.member_id` is untouched. `primary_team_id` is copied from the author's own `member.team_id`, the single team source, never chosen independently; `org_id` lands in the same org as the author, so `entry_member_org_fk` and the primary-team composite FK hold on non-null pairs. `bootstrap.sql` derives `org_id` from the team, never a second source | `20261031120000_mir12_backfill_org_public.sql:78-83`, `:73-74`; `supabase/bootstrap.sql:194`, `:202-205` |

## Findings

None.

## Verdict

PASS.
