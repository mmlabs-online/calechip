---
ticket: TSK-05
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-16T07:50:33+0700
inputs_read:
  - .ai/board/tickets/TSK-05/01-plan.md
  - .ai/board/tickets/TSK-05/ticket.yaml
  - .ai/board/tickets/TSK-05/04-review.md
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/steward/context.md
  - src/routes/Tasks.tsx
  - src/lib/domain/types.ts
  - tests/tasks.test.ts
  - tests/e2e/tsk-01-tasks.spec.ts
  - eslint.config.js
  - vite.config.ts
  - playwright.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# TSK-05 — implementation log

## Rework cycle — 2026-10-16, after the REVIEW FAIL of 2026-10-15

`04-review.md` Finding 1 (R5, routed to `tech-lead-design`); `01-plan.md` amended § 4.1 and § 4.2 on
2026-10-16 (Changelog). This cycle implements the amendment and nothing else.

| file | change | contract item |
|------|--------|---------------|
| `src/lib/task-tick.ts` | added `applyOutcome(list, outcome)` at `:61`; `createTaskTicker` unchanged | § 4.1 `applyOutcome` |
| `src/routes/Tasks.tsx` | `onOutcome` (`:413-426`) writes every outcome into both lists with `applyOutcome`, then clears the error on `saved` and sets it on `failed`; the `saved`-only `swap` is gone | § 4.2 `onOutcome` |
| `tests/task-tick.test.ts` | two tests for Finding 1's shapes — (a) tap, tap, write 1 succeeds, write 2 fails → `failed`, `done: true`; (b) tap, tap, write 1 succeeds, tap, write 2 fails superseded → `settled`, `done: true` — each asserting `shown(applyOutcome([loaded], outcome)).done` is `true`; three `applyOutcome` tests | § 5 Tests, rework bullets |

Shape (b) interleaves the third tap after write 1 answers: with three taps before any answer the run
wants `true`, write 1's `true` closes it as `saved`, and no write 2 exists. The plan's "tap ×3" is
read as three taps in the run, which is the only order that produces the superseded failure it names.

Verification, this cycle: `pnpm exec tsc --noEmit` 0; `pnpm exec eslint .` 0;
`pnpm exec vitest run tests/task-tick.test.ts` 0 (19 passed); `pnpm exec playwright test
tests/e2e/tsk-05-optimistic-tick.spec.ts tests/e2e/tsk-01-tasks.spec.ts` 0 (13 passed);
`pnpm exec vitest run` 1 — 820 passed, the same single `tests/event-email.test.ts` failure as the
first cycle, not this ticket's.

`ticket.yaml` is not touched; `/advance` records the gate and the state (ADR-036).

## First cycle — 2026-10-15

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/task-tick.ts` | created | The optimistic tick as a pure module (one run per task, one write in flight, outcomes, reconcile), so ordering can be tested without the screen | § 4.1 |
| `src/routes/Tasks.tsx` | modified | Wire the ticker into the page: box no longer disabled and no longer calls `run`, rows get the shown task, tick errors, `load` reconciles, keys drop `done`, overdue count reads shown values | § 4.2 |
| `tests/task-tick.test.ts` | created | Module tests for AC-1 to AC-6 with hand-resolved writes | § 5 Tests, first bullet |
| `tests/e2e/tsk-05-optimistic-tick.spec.ts` | created | Screen tests for AC-1, AC-4, AC-7 against the mock seam | § 5 Tests, second bullet |
| `tests/e2e/tsk-01-tasks.spec.ts` | modified | AC-13 to AC-15 test: a ticked overdue task now stays in the section (TSK-05 AC-9); the move targets the other row by title since two rows now carry `task-move` | § 5 Tests, third bullet |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `TickWrite`, `TICK_FAILED`, `TickOutcome`, `TaskTicker`, `createTaskTicker` | `src/lib/task-tick.ts:17`, `:20`, `:23`, `:32`, `:58` | Signatures exactly as § 4.1 |
| 4.1 one run per task, `tap` opens it, flips `desired`, bumps `seq`, calls `onChange` before sending | `src/lib/task-tick.ts:111` | |
| 4.1 one write in flight per task | `src/lib/task-tick.ts:69`, `:111` | `send` only when `!run.inFlight` |
| 4.1 throw or reject → `{ code: "unknown", message: TICK_FAILED }` | `src/lib/task-tick.ts:69` | sync throw caught; rejection handled by `then`'s second argument |
| 4.1 answer: success sets `confirmed`; superseded failure `console.error`s; resend when `desired !== confirmed`; else close with one outcome and record `{ done, at: ++counter }` | `src/lib/task-tick.ts:84` | A current-seq failure sets `desired = confirmed` first — see Deviations 1 |
| 4.1 no clock, timer or debounce | `src/lib/task-tick.ts` | none present |
| 4.2 one ticker for the page's lifetime, `useRef`, three callbacks | `src/routes/Tasks.tsx:408-425` | |
| 4.2 `saved` replaces the task in both lists and clears its error; `failed` sets the error; `settled` re-render only | `src/routes/Tasks.tsx:413-422` | the re-render comes from `onChange`, which `answer` calls after every close |
| 4.2 tick errors as `Record<string, string>`; a tap clears its entry before `ticker.tap` | `src/routes/Tasks.tsx:404`, `:477-480` | |
| 4.2 `load` reads `mark` before its requests and reconciles both lists | `src/routes/Tasks.tsx:429`, `:438-439` | `ticker` added to `useCallback` deps; it is stable |
| 4.2 rows get `ticker.shown(task)`, `onTick` (with the unshown task), `tickError` | `src/routes/Tasks.tsx:551-557`, `:569-575` | |
| 4.2 box `onClick` is `onTick`; `disabled={busy}` removed from the box only | `src/routes/Tasks.tsx:221` | save buttons keep `disabled={busy}` at `:202`, `:296` |
| 4.2 `errors.general ?? tickError` in view and move modes | `src/routes/Tasks.tsx:307` | edit mode's own `GeneralError` unchanged |
| 4.2 row keys drop `done` | `src/routes/Tasks.tsx:483` | |
| 4.2 overdue count from shown values; section condition unchanged | `src/routes/Tasks.tsx:543-544`, `:538` | |
| 4.2 no `setTaskDone` inside `run`; tick never calls `onChanged`/`load` | `src/routes/Tasks.tsx:411` is the only `setTaskDone` | |
| 4.3 selectors unchanged | see Testability contract | |

## Deviations from the design

1. **A failure of the current write sets `desired = confirmed` before the resend check.** § 4.1's
   bullet order reads "then, if `desired !== confirmed`, send". Applied literally, a current failure
   always has `desired !== confirmed` (that is why it was sent), so it would resend forever and never
   emit `failed`. AC-3 requires the rollback and one `failed` outcome, so the rollback comes first.
   This is the reading AC-3 needs, not a change of behaviour.
2. **No `latest` field on the run.** § 4.1 says the returned task "is kept as the run's latest". A
   `saved` outcome is only emitted when the write that just answered succeeded, so that write's
   result *is* the latest. The field would never be read and was removed.
3. **`shown` and `reconcile` return the input object itself when the value they would set equals
   `task.done`**, not only when there is no run or record. Same `done`, same object; it saves an
   allocation per row per render and lets the tests assert identity.

## Invariants

`invariants_touched: []`. No entry is written or counted; the tick writes the same `done` column
through the same `seam.setTaskDone`. `absence.ts`, `busy.ts` and `day-status.ts` were not read or
edited.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run tests/task-tick.test.ts` | 0 | 14 passed |
| `pnpm exec vitest run` | 1 | 815 passed, 1 failed: `tests/event-email.test.ts` › *§ 2b: table layout … one image — the logo*. **Fails identically on `HEAD` with this ticket's files stashed**, so it is not this ticket's. Not in `allowed_paths`; left for whoever owns EVT email |
| `pnpm exec playwright test tests/e2e/tsk-05-optimistic-tick.spec.ts tests/e2e/tsk-01-tasks.spec.ts` | 0 | 13 passed |
| `git diff --name-only` + untracked ⊆ `allowed_paths` | yes | plus this log and `ticket.yaml` (board plane), and the untracked idea file this ticket was triaged from, which predates this stage |

## Testability contract

No selector added, removed or renamed (§ 4.3). The three whose timing changes:

| selector | Exists at |
|----------|-----------|
| `task-row` (`data-done`) | `src/routes/Tasks.tsx:168` |
| `task-done` (`aria-checked`, now never `disabled`) | `src/routes/Tasks.tsx:216` |
| `tasks-overdue-count` | `src/routes/Tasks.tsx:543` |

Every other TSK-01 § 4.7 selector is at its TSK-01 place, shifted by the added lines.

## Open questions

- The e2e AC-1 test scopes its "no loader" check to `tasks-page`. The app shell's demo banner also
  carries `role="status"` and is always present in the mock build, so a page-wide check can never
  pass.
