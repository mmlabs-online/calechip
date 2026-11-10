---
ticket: MIR-09
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-27T01:35:30Z
inputs_read:
  - .ai/board/tickets/MIR-09/01-plan.md
  - .ai/board/tickets/MIR-09/ticket.yaml
  - .ai/board/tickets/MIR-09/99-questions.md
  - .ai/registry/decisions/ADR-069-member-team-id-is-indexed-and-the-overload-threshold-is-checked-in-the-database.md
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - supabase/migrations/20260926100000_solo_issue_report.sql
  - supabase/migrations/20261023120000_mir09_schema_cleanup.sql
  - supabase/tests/110-schema-cleanup.test.sql
  - supabase/bootstrap.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/fixtures.ts
  - tests/threshold.test.ts
  - tests/draft-entry.test.ts
consulted:
  - with: tech-lead-design
    asked: "Implementing 01-plan.md § 4 in full makes pnpm test fail tests/draft-entry.test.ts's
      AC-14 charter-refusal-6 scanner: its regex flags any CHECK mentioning overload_threshold,
      including the new team_overload_threshold_range constraint, which validates the admin's own
      input and does not consult the column to refuse a write to a different table. That file is
      outside allowed_paths so I cannot fix it myself (RULE-03). Asked to either widen
      allowed_paths and narrow the scanner (my proposed narrowing given), or say what to do
      instead."
    answer: "Option (a) approved (tech-lead-design, 2026-10-27). Charter refusal 6 forbids
      consulting overload_threshold to refuse a plan or entry write, whereas
      team_overload_threshold_range (ADR-069) validates the admin's own [0, 1] input on public.team
      itself. Added tests/draft-entry.test.ts to allowed_paths and specified IS_OWN_COLUMN_RANGE_CHECK
      in 01-plan.md § 4."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-09 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261023120000_mir09_schema_cleanup.sql` | created | add `member_team_id_idx` on `public.member (team_id)` and `team_overload_threshold_range` check constraint on `public.team`, wrapped in one transaction | §4 "Migration" |
| `supabase/migrations/20260926100000_solo_issue_report.sql` | modified | wrap the existing statements in `begin;` / `commit;` without altering any other byte | §4 "`supabase/migrations/20260926100000_solo_issue_report.sql`" |
| `supabase/tests/110-schema-cleanup.test.sql` | created | pgTAP coverage for AC-1 (`has_index`), AC-2 (`23514` refusals and unchanged value), and AC-3 (bound updates `0`, `1`, `0.5`) | §4 "`supabase/tests/110-schema-cleanup.test.sql`" |
| `supabase/bootstrap.sql` | modified | reword the `public.allowed_email` comment at lines 183–186 to past tense | §4 "`supabase/bootstrap.sql:183-185`" |
| `src/lib/domain/types.ts` | modified | remove `already_allow_listed` and `already_consumed` from `FailureCode`, add `invalid_threshold`, and remove the literal retired code reference from the `holiday_date_taken` doc comment | §4 "`src/lib/domain/types.ts`" |
| `src/lib/data/index.ts` | modified | export `isValidThreshold` and `INVALID_THRESHOLD_MESSAGE` beside `SetOverloadThresholdInput` and update the `setOverloadThreshold` doc comment | §4 "`src/lib/data/index.ts`" |
| `src/lib/data/mock.ts` | modified | update `refused(...)` code union and add `isValidThreshold` pre-send guard as the first statement of `setOverloadThreshold` | §4 "`src/lib/data/mock.ts`" |
| `src/lib/data/supabase.ts` | modified | add `isValidThreshold` pre-send guard and SQLSTATE `23514` mapping in `setOverloadThreshold`, remove the `23505` arm in `toPostgrestFailure`, and update the CAL-01 comment to name `member` or `team` instead of `allowed_email` | §4 "`src/lib/data/supabase.ts`" |
| `src/lib/fixtures.ts` | modified | remove the two orphaned allow-list doc comments while preserving `FIXTURE_UNLISTED_EMAIL` and its comment | §4 "`src/lib/fixtures.ts`" |
| `tests/threshold.test.ts` | modified | add `describe("MIR-09 range")` covering AC-4 for admin and non-admin callers | §4 "`tests/threshold.test.ts`" |
| `tests/draft-entry.test.ts` | modified | exclude `team_overload_threshold_range` (`IS_OWN_COLUMN_RANGE_CHECK`) in `mentioningThreshold` so the AC-14 Charter refusal 6 scanner does not false-positive on the column's own range check | §4 "`tests/draft-entry.test.ts`" |
| `.ai/registry/decisions/ADR-069-member-team-id-is-indexed-and-the-overload-threshold-is-checked-in-the-database.md` | created | ADR-069 authored at PLAN and bumped to `doc_version: 3` on the branch (`allowed_paths`) | §6 / §7 ADR-069 |
| `.ai/board/tickets/MIR-09/99-questions.md` | created | consultation with `tech-lead-design` that amended `01-plan.md` § 4 and § 7 to include `tests/draft-entry.test.ts` | consultation record |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| Migration | `supabase/migrations/20261023120000_mir09_schema_cleanup.sql:21-30` | exact SQL from §4, wrapped in `begin;` / `commit;` |
| `src/lib/domain/types.ts` | `src/lib/domain/types.ts:128-129,301` | `already_allow_listed` and `already_consumed` removed; `invalid_threshold` added with MIR-09 citation |
| `src/lib/data/mock.ts` | `src/lib/data/mock.ts:426-430,2427-2429` | `refused` union updated; `isValidThreshold` guard is the first statement of `setOverloadThreshold` |
| `src/lib/data/index.ts` | `src/lib/data/index.ts:204-208,768-775` | `isValidThreshold` and `INVALID_THRESHOLD_MESSAGE` exported; `setOverloadThreshold` docblock updated |
| `src/lib/data/supabase.ts` | `src/lib/data/supabase.ts:1321-1339,2359-2375` | `isValidThreshold` guard first, `23514` mapped to `invalid_threshold`, `23505` arm removed from `toPostgrestFailure`, CAL-01 comment reworded |
| `src/lib/fixtures.ts` | `src/lib/fixtures.ts:57-58` | two orphaned comments deleted; `FIXTURE_UNLISTED_EMAIL` and its comment kept |
| `supabase/bootstrap.sql:183-185` | `supabase/bootstrap.sql:183-186` | reworded to past tense citing `20260910100000_solo_member_approval.sql`; no SQL statement changed |
| `supabase/migrations/20260926100000_solo_issue_report.sql` | `supabase/migrations/20260926100000_solo_issue_report.sql:25,141` | `begin;` before first statement and `commit;` after last statement; no other change |
| `supabase/tests/110-schema-cleanup.test.sql` | `supabase/tests/110-schema-cleanup.test.sql:1-64` | pgTAP tests for AC-1, AC-2, and AC-3 |
| `tests/threshold.test.ts` | `tests/threshold.test.ts:175-201` | `describe("MIR-09 range")` testing AC-4 as admin and as `FIXTURE_MEMBER` |
| `tests/draft-entry.test.ts` | `tests/draft-entry.test.ts:313-322` | `IS_OWN_COLUMN_RANGE_CHECK` added and filtered in `mentioningThreshold` per amended §4 |

## Deviations from the design

One minor comment cleanup forced by AC-8's literal search requirement ("When `src/` and `supabase/bootstrap.sql` are searched for `already_allow_listed`, `already_consumed` ... Then there is no match"):

- `src/lib/domain/types.ts:169-171` had a comment on `holiday_date_taken` that mentioned `already_allow_listed` by name for contrast. Reworded to `"A SEPARATE CODE FROM EVERY OTHER 23505 THIS SEAM MAPS"` so AC-8's search across `src/` returns zero matches.

## Invariants

`invariants_touched: []` in `ticket.yaml`.

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The absence count definition is untouched; restricting `team.overload_threshold` to `[0, 1]` in the database and seam only enforces the fraction bounds the screen already required. |
| `INV-07` | Adding index `member_team_id_idx` on `public.member (team_id)` changes query execution plans only, never the rows or values returned. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | clean |
| `pnpm exec eslint .` | 0 | clean |
| `pnpm exec vitest run` | 0 | 49 test files passed, 990 tests passed (including `tests/threshold.test.ts` and `tests/draft-entry.test.ts`) |
| `node scripts/check-allowed-paths.mjs` | 0 | `allowed-paths: PASS` (16 changed files, all allowed/exempt) |
| `node scripts/check-carry.mjs MIR-09` | 0 | `check-carry: PASS — nothing stray` |
| `git diff --name-only` subset of `allowed_paths` | yes | verified by `node scripts/check-allowed-paths.mjs` |

## Testability contract

Plan section 2b specifies no UI or selector changes (`none`).

## Open questions

none.
