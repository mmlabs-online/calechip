---
ticket: MIR-09
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-27T01:49:43Z
inputs_read:
  - .ai/board/tickets/MIR-09/01-plan.md
  - .ai/board/tickets/MIR-09/03-impl-log.md
  - .ai/board/tickets/MIR-09/ticket.yaml
  - .ai/templates/review-report.md
  - git diff origin/main...HEAD
  - git status --porcelain (clean)
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

# MIR-09 — review

Reviewed in a fresh session on `feat/MIR-09` at `d5714d9`, working tree clean. Every verify command
below was run by the reviewer, one per call; none is taken from `03-impl-log.md`.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → exit 0, `allowed-paths: ticket MIR-09, 17 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-09` → exit 0, `0 uncommitted path(s)` … `PASS — nothing stray`. The 12 paths are `ticket.yaml` `allowed_paths` = `01-plan.md:317-330`; the other 5 are the ticket folder and `.ai/board/backlog.md` (ship-owned) |
| R2 | `pnpm typecheck` exit 0, whole program | PASS | `tsc --noEmit` → exit 0, no output |
| R3 | `pnpm lint` exit 0 | PASS | `eslint .` → exit 0, no output; repo-wide, so the changed lintable files are covered and nothing outside the diff is reported |
| R4 | Nothing outside the seam reaches the datastore | PASS | The only new datastore call is inside the seam, `src/lib/data/supabase.ts:2359-2375`. The shared guard is a pure function at `src/lib/data/index.ts:205-208`, imported by `src/lib/data/mock.ts:32` and `src/lib/data/supabase.ts:42`. No file outside `src/lib/data/` gains an import; `eslint.config.js:64` (`no-restricted-imports`) is green under R3 |
| R5 | Every § 4 contract item is implemented | PASS | See R5 detail, one row per item |
| R6 | Permission gating matches plan § 3 | PASS | § 3 says permissions are unchanged. The new migration holds no policy, grant, function or trigger: `supabase/migrations/20261023120000_mir09_schema_cleanup.sql:21-30` is one `create index` and one `check` constraint. The writers are still decided by `supabase/migrations/20260905000000_adm01_team_threshold.sql:43` (`grant update (overload_threshold)`) and `:62` (`team_update_admin`). The value-before-permission order § 3 states is at `src/lib/data/mock.ts:2427-2432` and pinned by `tests/threshold.test.ts:191-200` |
| R7 | No invariant violated | PASS | `invariants_touched: []`. Per-ID reasoning for the two invariants the plan names (`01-plan.md:152-155`) is in R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` → empty. The new imports are local (`src/lib/data/mock.ts:32`, `src/lib/data/supabase.ts:42`) |

## R5 detail

| Contract item (`01-plan.md` § 4) | Implemented at | Matches signature |
|---|---|---|
| Migration: header cites MIR-09, ADR-069 and RULE-09 | `supabase/migrations/20261023120000_mir09_schema_cleanup.sql:1-3` | yes |
| Migration: `begin;` / `create index if not exists member_team_id_idx on public.member (team_id)` / drop-if-exists + add `team_overload_threshold_range check (overload_threshold >= 0 and overload_threshold <= 1)` / `commit;` | `supabase/migrations/20261023120000_mir09_schema_cleanup.sql:21-30` | yes, byte-identical to `01-plan.md:184-193` |
| `FailureCode`: remove `already_allow_listed`, `already_consumed` | `src/lib/domain/types.ts:128-129` (replaced by a history comment) | yes |
| `FailureCode`: add `invalid_threshold` with MIR-09 comment | `src/lib/domain/types.ts:301` | yes, text identical to `01-plan.md:201` |
| `mock.ts` `refused(...)` union: drop the two codes, add `invalid_threshold` | `src/lib/data/mock.ts:427-432` | yes |
| `mock.ts` `setOverloadThreshold`: guard is the first statement | `src/lib/data/mock.ts:2427-2429` | yes |
| `index.ts`: export `isValidThreshold(share: number): boolean` and `INVALID_THRESHOLD_MESSAGE` beside `SetOverloadThresholdInput`; one copy | `src/lib/data/index.ts:204-208` | yes, identical to `01-plan.md:218-222` |
| `index.ts`: "NO RANGE CHECK HERE" doc comment replaced with guard, constraint name and code | `src/lib/data/index.ts:768-775` | yes |
| `supabase.ts` `setOverloadThreshold`: guard first | `src/lib/data/supabase.ts:2359-2361` | yes |
| `supabase.ts` `setOverloadThreshold`: `23514` → `invalid_threshold` before the generic mapper | `src/lib/data/supabase.ts:2370-2375` | yes, identical to `01-plan.md:235-240` |
| `supabase.ts` `toPostgrestFailure`: `case "23505"` arm deleted | `src/lib/data/supabase.ts:1325-1329` (first arm is now `42501`) | yes |
| `supabase.ts` CAL-01 comment: `allowed_email` → `member` / `team` | `src/lib/data/supabase.ts:1337-1339` | yes |
| `fixtures.ts`: two orphaned doc comments deleted; `FIXTURE_UNLISTED_EMAIL` and its comment kept | `src/lib/fixtures.ts:57-58` | yes |
| `bootstrap.sql:183-185`: sentence made past tense, citing `20260910100000_solo_member_approval.sql`; no SQL changes | `supabase/bootstrap.sql:183-186` (the `insert` at `:187` is unchanged in the diff) | yes |
| `20260926100000_solo_issue_report.sql`: `begin;` and `commit;` only | `supabase/migrations/20260926100000_solo_issue_report.sql:25`, `:141`. The diff is +4 lines: the two statements and two blank lines | yes (AC-7) |
| pgTAP `110-schema-cleanup.test.sql`, `050`-shape: AC-1 `has_index`; AC-2 four `throws_ok '23514'` as `admin_t`; `results_eq` on the stored value; AC-3 `rows_affected = 1` per bound | `supabase/tests/110-schema-cleanup.test.sql:2-6` (shape), `:9-10` (AC-1), `:12-13` (`admin_t`), `:16-27` (AC-2), `:29-33` (unchanged), AC-3 rows follow through `:64`. `plan(13)` matches the 13 assertions | yes |
| `tests/threshold.test.ts`: `describe("MIR-09 range")`, AC-4 against the mock as an admin and as `FIXTURE_MEMBER`, stored value unchanged | `tests/threshold.test.ts:177-201` | yes. Existing tests are untouched: the diff to this file only adds lines (AC-6) |
| `tests/draft-entry.test.ts`: `IS_OWN_COLUMN_RANGE_CHECK` and the narrowed `mentioningThreshold` only; `CAN_REFUSE_A_WRITE` untouched | `tests/draft-entry.test.ts:313-322`; `CAN_REFUSE_A_WRITE` is unchanged at `:301` | yes, regex identical to `01-plan.md:283`. The regex only exempts the exact statement at `20261023120000_mir09_schema_cleanup.sql:26-28`, so any other `check (` that mentions the threshold is still flagged |
| AC-9: no other migration changes | `git diff --name-only origin/main...HEAD -- supabase/migrations` → exactly the two files named in § 7 | yes |
| AC-8: no live `already_allow_listed` / `already_consumed` in `src/` or `bootstrap.sql` | `grep -rn` over `src supabase/bootstrap.sql` returns neither identifier | yes |

The deviation recorded in `03-impl-log.md` § *Deviations*, rewording the `holiday_date_taken`
comment, is at `src/lib/domain/types.ts:169-171`. It is a comment, it is in `allowed_paths`, and AC-8's
literal search requires it. It is not a contract violation.

`pnpm test` → exit 0, 49 files, 990 tests passed. That includes `tests/threshold.test.ts` (12) and
`tests/draft-entry.test.ts` (64).

## R7 detail

`invariants_touched: []`. The plan names two invariants whose subject this ticket touches, and each
one is checked below.

| Invariant | Held by | Citation |
|---|---|---|
| INV-04: one definition of the absence count; the threshold multiplies the current member count | Unchanged. No count, view or function is edited. The constraint refuses only values outside `[0, 1]`. The screen already refused those under ADM-01 AC-7, and the seam's input contract already defined that range, so no stored value that was reachable before is refused now and no day is reclassified. A hosted row outside the range would make the migration fail when it is applied, not change silently. ADR-069 accepts that | `supabase/migrations/20261023120000_mir09_schema_cleanup.sql:26-28`; `src/lib/data/index.ts:205-207` |
| INV-07: reads keyed on `member.team_id` | Unchanged. A b-tree index adds no predicate and changes no row any query returns | `supabase/migrations/20261023120000_mir09_schema_cleanup.sql:23` |

No other invariant is reachable: there is no change to `entry`, policies, triggers or functions.

## Findings

None that fail a check.

## Not part of this gate: an observation for a human

The plan defines "allow-list references" as statements that describe `public.allowed_email` *as if
it still existed* (`01-plan.md:62-68`). It then lists three of them under "Today these are". The
Developer handled all three. Present-tense comments of the same kind remain at
`src/lib/fixtures.ts:36-37`, `src/lib/data/mock.ts:149`, `src/lib/data/mock.ts:404-406` and
`src/lib/data/supabase.ts:1379`. They are not § 4 contract items and AC-8 does not search for them.
Holding them against the Developer would charge a plan omission to the implementation (RULE-08), so
they do not fail this review. They are comments only and change no behaviour. If they are worth
removing, that belongs in a follow-up chore.

`pnpm db:test`, which AC-1 to AC-3 and AC-6 name, is not one of the R1 to R8 commands and was not run
here. The migration's own header says it is unverified against a running PostgreSQL
(`supabase/migrations/20261023120000_mir09_schema_cleanup.sql:19`).

## Verdict

**PASS.** All eight checks pass. Next state: DONE.
