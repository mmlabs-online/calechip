---
ticket: BUG-006
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-17T01:36:47Z
inputs_read: [ .ai/board/tickets/BUG-006/01-plan.md, .ai/board/tickets/BUG-006/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# BUG-006 implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `tests/e2e/tsk-01-tasks.spec.ts` | modified | adds `stepDay` and routes all thirteen day-arrow clicks through it | §4.1, §4.2 |

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 `stepDay` | `tests/e2e/tsk-01-tasks.spec.ts:67-73` | verbatim from plan, after `heading` |
| 4.2 thirteen call sites | the thirteen lines that called `tasks-next-day` / `tasks-prev-day` | expected days exactly as in the plan's table |
| 4.3 throttle | not committed | used temporarily, restored from a copy before the fix |

## Deviations from the design

none

## Invariants

`invariants_touched: []`. One spec's ordering; no entry, member, team, task or count is read or written by anything changed.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `git diff --name-only` subset of `allowed_paths` | yes | only `tests/e2e/tsk-01-tasks.spec.ts` |
| `pnpm exec playwright test --workers=2 --retries=0` (AC-5, once) | 1 | 549 passed, 2 failed, neither in the spec: `tsk-02-overdue-prompt.spec.ts:109 AC-2: nothing overdue — no prompt` (BUG-007's spec) and `uie-10-sidebar.spec.ts:208 AC-3: every address the sidebar gave up is still reachable in two steps`. Recorded, not fixed. Every test in `tsk-01-tasks.spec.ts` passed. |

## Regression test

Command (AC-4): `pnpm exec playwright test tests/e2e/tsk-01-tasks.spec.ts tests/e2e/uie-10-sidebar.spec.ts --repeat-each=20 --workers=2 --retries=0`

| Run | Command | Exit | Failing assertion or result |
|-----|---------|------|-----------------------------|
| before the fix, run 1 (baseline spec) | AC-4 command | non-zero (the run listed failures; the exit code itself was not captured because the output was piped) | 22 failed, 419 passed. 13 of 20 repeats of the overdue test `AC-13 to AC-15: overdue shows on today, oldest first, and empties as tasks are handled` failed; the other 9 failures were `uie-10-sidebar.spec.ts:208` (`back.click()` at `uie-10-sidebar.spec.ts:150` timing out). The per-failure assertion text of the 13 overdue failures was not captured (output was truncated to its tail). |
| before the fix, run 2 (baseline spec, `--trace=retain-on-failure`) | AC-4 command + trace flag | 0 | 441 passed, 0 failed. Not reproduced. |
| before the fix, run 3 (baseline spec + § 4.3 throttle, rate 4) | AC-4 command + trace flag | 0 | 441 passed. Not reproduced. |
| before the fix, run 4 (baseline spec + throttle rate 6, only the two named tests, 30 repeats) | same, with `-g` | 0 | 61 passed. Not reproduced. |
| after the fix | AC-4 command | 1 | 431 passed, 10 failed. All 10 failures are `uie-10-sidebar.spec.ts:208` (the load companion, out of scope, same `back.click()` timeout at line 150). Every test in `tsk-01-tasks.spec.ts`, including the overdue test, passed 20 of 20. |

Reading: the failure reproduced once on this machine (run 1, 13 of 20), which is the AC-4 before result, but not in the three later baseline runs, including with the throttle. The reviewer's before run may need repeating. The failure is also on record in `00-bug-report.md` § Actual (four reviews).

AC-6: the trace step was not done, because no later baseline run failed, and run 1 had no trace. The cause in plan § 1 therefore remains `suspected`, supported by the source reading in the plan and by run 1's failure being confined to the overdue test.

## Testability contract

No selector added or changed (AC-7). The helper uses existing `tasks-day-heading`, `tasks-prev-day`, `tasks-next-day`.

## Open questions

- `uie-10-sidebar.spec.ts:208` fails in the after run (10 of 20) and in the full run once, and `tsk-02-overdue-prompt.spec.ts:109` failed once in the full run. Both are outside this ticket's path; candidates for their own `/bug` (tsk-02 is BUG-007's).
