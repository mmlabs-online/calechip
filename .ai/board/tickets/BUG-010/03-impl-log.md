---
ticket: BUG-010
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-17T04:40:00+00:00
inputs_read: [ .ai/board/tickets/BUG-010/01-plan.md, .ai/board/tickets/BUG-010/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `tests/e2e/evt-07-guest-registration.spec.ts` | modified | two added waits for `sign-in-submit` between `navigate(page, "/")` and `navigate(page, address)` | §4.1 (both insertions) |
| `.ai/board/tickets/BUG-010/03-impl-log.md` | created | this log | n/a |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 AC-1 test insertion | `tests/e2e/evt-07-guest-registration.spec.ts:124-128` | comment and wait exactly as specified |
| 4.1 AC-4 test insertion | `tests/e2e/evt-07-guest-registration.spec.ts:172-175` | comment and wait exactly as specified |
| 4.2 throttle, 4.3 probe | not committed | used for measurement only, reverted with `git checkout` |

## Deviations from the design

none

## Invariants

`invariants_touched: []`. Two waits in one test file; no entry, member, team, event, guest or count is read or written.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm exec playwright test tests/e2e/evt-07-guest-registration.spec.ts --retries=0` | 0 | 6 passed |
| `pnpm exec playwright test --workers=2 --retries=0` | 1 | 549 passed, 2 failed, both outside this ticket (below) |
| `git diff --name-only` subset of `allowed_paths` | yes | only the spec; 7 added lines, 0 removed |

AC-4 full-suite failures, recorded and not fixed: `tests/e2e/tsk-01-tasks.spec.ts:279` "AC-13 to AC-15: overdue shows on today, oldest first, and empties as tasks are handled", and `tests/e2e/tsk-02-overdue-prompt.spec.ts:109` "AC-2: nothing overdue — no prompt" (`addTask` at :55, task title not visible). Neither touches EVT-07.

## Regression test

Command (AC-R): `pnpm exec playwright test tests/e2e/evt-07-guest-registration.spec.ts -g "AC-1, AC-3, AC-11|AC-4, AC-5:" --repeat-each=30 --workers=2 --retries=0` (the "61 tests" count includes one setup test).

| Run | Command | Exit | Failing assertion or result |
|-----|---------|------|-----------------------------|
| before the fix, plain | AC-R command with `--trace=retain-on-failure` | 0 | 61 passed. **Not reproduced.** |
| before the fix, throttled (plan 4.2, rate 6, both tests) | same | 0 | 61 passed. **Not reproduced** under CPU throttling either. |
| before the fix, deterministic probe (plan 4.3, AC-1 test, 1 run) | `playwright test … -g "AC-1, AC-3, AC-11" --retries=0 --workers=1` | 1 | `expect(getByTestId('guest-register-name')).toBeVisible()` failed, "element(s) not found" at the line after the probe. |
| after the fix | AC-R command | 0 | 61 passed (60 of 60 plus setup) |

The flake did not reproduce on this machine in two 30x2 runs, so per AC-R the fix ships and the plain after-run (not the throttled one, because the throttled baseline did not fail either) is the one recorded.

AC-5 (a): no failing trace exists, because the baseline never failed. Unconfirmed from traces.
AC-5 (b): confirmed. When both navigations land in one task, the guest page never remounts and `guest-register-name` does not appear. The error-context snapshot of the failure contains the registration receipt text, consistent with `guest-registered` staying on screen (the grep matched 5 lines; I did not read it line by line). That is the merge § 1 predicts in its limiting case. It shows the mechanism is possible, not that it is what failed in MIR-19-d and MIR-19-f.

## Testability contract

No selector is added or changed. `sign-in-submit` already exists at `src/routes/SignIn.tsx:124`.

## Open questions

- The reported flake did not reproduce in 60 baseline runs, so R10's "before" half will most likely pass on the baseline too, as the plan's AC-R fallback anticipated. The reviewer should not treat that as a defect in the change.
- Two unrelated full-suite failures in TSK-01 and TSK-02 under `--workers=2`. They may be a separate flake and deserve their own `/bug`.
