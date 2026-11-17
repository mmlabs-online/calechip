---
ticket: BUG-013
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-17T12:42:00Z
inputs_read: [ .ai/board/tickets/BUG-013/01-plan.md, .ai/board/tickets/BUG-013/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/Tasks.tsx` | modified | `loadSeq` ref; a load drops its result and its failure when a newer load has started | § 4.1 |
| `tests/e2e/tsk-01-tasks.spec.ts` | modified | `HeldRead` type and the AC-R1 regression test | § 4.2 |

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | `src/routes/Tasks.tsx:639` and the `load` callback below it | `stale()` checked after the await and in the catch; signature and deps unchanged |
| 4.2 | `tests/e2e/tsk-01-tasks.spec.ts`, test "AC-2 (BUG-013): ..." | steps 1-6 as specified |

## Deviations from the design

none

## Invariants

`invariants_touched` is `[]`. The change only decides which of two task reads the page keeps; no entry or absence count is read or written.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec playwright test tests/e2e/tsk-01-tasks.spec.ts` | 0 | 12 passed |
| `git diff --name-only` subset of `allowed_paths` | yes | the two files above |

## Regression test

| Run | Command | Exit | Failing assertion or result |
|-----|---------|------|-----------------------------|
| before the fix | `pnpm exec playwright test tests/e2e/tsk-01-tasks.spec.ts -g BUG-013` | 1 | `expect(getByTestId('tasks-page').getByTestId('loader')).toHaveCount(0)` — Expected 0, Received 1 |
| after the fix | same | 0 | 12 passed in the full file run |

## Testability contract

No new selectors. The test uses existing `tasks-page`, `loader`, `tasks-empty`, `tasks-day-heading`, `tasks-prev-day`, `tasks-next-day`.

## Open questions

none
