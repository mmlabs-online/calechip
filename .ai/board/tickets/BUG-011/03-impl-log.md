---
ticket: BUG-011
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-17T06:00:00Z
inputs_read: [ .ai/board/tickets/BUG-011/01-plan.md, .ai/board/tickets/BUG-011/ticket.yaml, .ai/board/tickets/BUG-011/00-bug-report.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# BUG-011 implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `tests/e2e/mir-19-d-flip.spec.ts` | modified | AC-5 test waits for `year-overview` and the settled `/shared/year/<yyyy>` before `goBack()`; header line added | § 4.1 |
| `tests/e2e/mir-19-org-routing.spec.ts` | modified | AC-2 test asserts the link `href`, then waits for the settled year screen before the logo click; header line added | § 4.2 |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 | `tests/e2e/mir-19-d-flip.spec.ts:91-96`, header `:10` | Text as in the plan. `goBack()` and the assertions after it are unchanged. |
| 4.2 | `tests/e2e/mir-19-org-routing.spec.ts:45-49`, header `:11` | Text as in the plan. Logo click and `/shared` poll unchanged. |
| 4.3 | n/a | `href` was exactly `/shared/year` in all 50 runs; the assertion never failed. |

## Deviations from the design

none

## Invariants

`invariants_touched: []`. Only two e2e tests' waits changed; no entry, member, team or count is read or written.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm exec playwright test` (full, `--workers=2 --retries=0`) | 1 | 549 passed, 2 failed, both elsewhere and out of scope (plan AC-5: recorded, not fixed): `tsk-01-tasks.spec.ts:279` and `uie-10-sidebar.spec.ts:208`. Both are named in the operator's list of flaky tests, each to get its own BUG. Neither file is touched. |
| `git diff --name-only` subset of `allowed_paths` | yes | the two spec files only |

Unit tests (`pnpm test`) were not run: no source or unit test changed, and this ticket's gate is typecheck, lint and the plan AC-5 repetition.

## Regression test

Command: `pnpm exec playwright test <flip AC-5 test> <org-routing AC-2 test> --workers=4 --repeat-each=25 --retries=0`. Line numbers shifted by one after the header comments were added (`:84`/`:39` before, `:85`/`:40` after).

| Run | Command | Exit | Failing assertion or result |
|-----|---------|------|-----------------------------|
| before the fix | `... mir-19-d-flip.spec.ts:84 mir-19-org-routing.spec.ts:39 --workers=4 --repeat-each=25 --retries=0` | non-zero | 14 failed, 37 passed (51 includes the setup). Shown failure: `mir-19-org-routing.spec.ts:45` `expect.poll(...).toBe("/shared/year")` timed out after 5000ms; the other failures are the AC-5 test and the same AC-2 test. |
| after the fix | `... mir-19-d-flip.spec.ts:85 mir-19-org-routing.spec.ts:40 --workers=4 --repeat-each=25 --retries=0` | 0 | 51 passed, 0 failed (50 test runs plus setup) |

Note: the first post-fix attempt used `:89`/`:40`; `:89` matched no test, so only the AC-2 half ran (26 passed). The run above is the complete one.

## Testability contract

No selector is created or renamed. Used, all existing: `home-year-link` (`src/components/Sidebar.tsx:536`), `year-overview` (`src/routes/YearOverview.tsx:332`), `month-grid`, `shell-brand-logo`.

## Open questions

None.
