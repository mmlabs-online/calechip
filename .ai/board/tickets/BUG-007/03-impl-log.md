---
ticket: BUG-007
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-17T03:20:00Z
inputs_read: [ .ai/board/tickets/BUG-007/01-plan.md, .ai/board/tickets/BUG-007/ticket.yaml, .ai/board/tickets/BUG-007/00-bug-report.md, tests/e2e/tsk-02-overdue-prompt.spec.ts, playwright.config.ts ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `tests/e2e/tsk-02-overdue-prompt.spec.ts` | modified | adds `stepDay` and routes the seven arrow clicks through it, so each click waits for the day it leads to | §4.1, §4.2 |
| `.ai/board/tickets/BUG-007/03-impl-log.md` | created | this log | — |

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | `tests/e2e/tsk-02-overdue-prompt.spec.ts:63-69` | inserted after `heading` (line 62), text as in the plan |
| 4.2 | `:91`, `:94`, `:123`, `:184`, `:185`, `:204`, `:205` | origin/main lines 83, 86, 115, 176, 177, 196, 197, each with the planned day |
| 4.3 | not committed | the throttle was applied once to a copy of the baseline and removed; diff shows only 4.1 and 4.2 |

## Deviations from the design

none

## Invariants

`invariants_touched` is `[]`. Only the order of steps in one e2e spec changes; no entry, member, team, task or count is read or written.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `git diff --name-only` subset of `allowed_paths` | yes | only the spec (the log is in the ticket folder) |
| search for `tasks-next-day` / `tasks-prev-day` in the spec | | matches only in `stepDay`'s signature and the seven call arguments, none as `getByTestId(...)` outside `stepDay` (AC-1) |
| `pnpm exec playwright test --workers=2 --retries=0` (AC-5, once) | 1 | 551 tests: 548 passed, 3 failed. All 20 TSK-02 tests passed. Failures elsewhere, not fixed: `tsk-01-tasks.spec.ts:279` (AC-13 to AC-15), `uie-09-admin-hub.spec.ts:248` (AC-4), `uie-10-sidebar.spec.ts:208` (AC-3). `unit tests` (`pnpm test`) not run: no `src/` or unit file changed. |

## Regression test

Command (AC-4): `pnpm exec playwright test tests/e2e/tsk-02-overdue-prompt.spec.ts tests/e2e/uie-10-sidebar.spec.ts --repeat-each=30 --workers=2 --retries=0`

| Run | Command | Exit | Failing assertion or result |
|-----|---------|------|-----------------------------|
| before the fix, run 1 (baseline spec, `--reporter=line`) | AC-4 command | non-zero | 561 passed, 40 failed of 601. The AC-2 test (`tsk-02-overdue-prompt.spec.ts:109`) appeared in the failure list in the tail of the output; the other failures were `uie-10-sidebar.spec.ts:208`. The output was tailed to the last 40 lines and the exact per-title split and the failing assertion line were not kept. |
| before the fix, run 2 (baseline spec, `--trace=retain-on-failure`) | AC-4 command + trace | 0 | 601 passed, 0 failed |
| before the fix, run 3 (baseline spec + § 4.3 throttle, rate 4) | AC-4 command + trace | 0 | 601 passed, 0 failed |
| after the fix | AC-4 command | 1 | 591 passed, 10 failed of 601. All 10 failures are `uie-10-sidebar.spec.ts:208` (`locator.click` timeout), the load companion. Every test in `tsk-02-overdue-prompt.spec.ts` passed 30 of 30. |

Reading of the table. The baseline AC-2 test failed under load in run 1 and passed in runs 2 and 3, which is consistent with the load race the report describes (and with the records that disagree on "deterministic": it is not deterministic here). Run 1 lacks the saved failing assertion, so I did not obtain a trace of it.

**AC-6: the cause remains `suspected`.** No baseline run with trace retention failed, so which day's form received the `fill` was not read from a trace. The source reading in plan § 1 is unchanged and untested by trace. The after-fix result (30 of 30 on every TSK-02 test, under the same two-worker load that produced failures in run 1) is supporting, not conclusive, evidence.

The reviewer's before run, per plan AC-4, is the same command with the spec taken from `git show origin/main:tests/e2e/tsk-02-overdue-prompt.spec.ts`.

## Testability contract

No selector added or renamed. `tasks-day-heading`, `tasks-prev-day`, `tasks-next-day` already exist (`src/routes/Tasks.tsx`).

## Open questions

- `uie-10-sidebar.spec.ts:208` fails 10 of 30 under the AC-4 repeat load (a `locator.click` timeout) and in the full suite. It is the load companion, out of scope here, and plan § 1 names it as its own record. It means the plan's AC-4 command exits 1 after the fix because of a test that is not in this ticket. The reviewer should judge AC-4 on the TSK-02 tests' results, as written in the plan ("every test in the spec").
- `tsk-01-tasks.spec.ts:279` and `uie-09-admin-hub.spec.ts:248` also failed in the one full-suite run. Both are named in the plan's out-of-scope list.
