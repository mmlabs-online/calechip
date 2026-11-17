---
ticket: BUG-012
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-17T13:10:00Z
inputs_read: [ .ai/board/tickets/BUG-012/01-plan.md, .ai/board/tickets/BUG-012/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/components/Modal.tsx` | modified | Escape listener moved from a passive effect to a layout effect, so it exists in the task that inserts the backdrop | §4.1 |
| `tests/e2e/tsk-02-overdue-prompt.spec.ts` | modified | new regression test dispatching Escape in the microtask after the prompt attaches | §4.2 |

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | `src/components/Modal.tsx:15` (import), `:36` (`useLayoutEffect`) | import, hook name and comment only; body and cleanup unchanged |
| 4.2 | `tests/e2e/tsk-02-overdue-prompt.spec.ts:175` | verbatim from the plan, between the AC-4 and AC-5 tests |

## Deviations from the design

none

## Invariants

`invariants_touched: []`. Listener attach timing in a presentational component reaches none of INV-01 to INV-07.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec playwright test tests/e2e/tsk-02-overdue-prompt.spec.ts --repeat-each=10 --workers=2 --retries=0` | 0 | 91 passed, existing AC-4 test included |
| `git diff --name-only` subset of `allowed_paths` | yes | the two files above |

## Regression test

| Run | Command | Exit | Failing assertion or result |
|-----|---------|------|-----------------------------|
| before the fix (Modal.tsx unchanged) | `pnpm exec playwright test tests/e2e/tsk-02-overdue-prompt.spec.ts -g "BUG-012" --repeat-each=10 --workers=2 --retries=0` | non-zero | 10 failed; each at `:197` `expect(getByTestId("overdue-prompt-modal")).toHaveCount(0)`, "14 × locator resolved to 1 element, unexpected value 1" |
| after the fix | same command | 0 | 11 passed (10 repeats plus the auth setup project), 0 failed |

## Testability contract

No new selector. The test uses existing `overdue-prompt-modal`, `overdue-prompt-close`.

## Open questions

none
