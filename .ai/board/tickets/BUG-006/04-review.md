---
ticket: BUG-006
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-17T02:07:41Z
inputs_read:
  - .ai/board/tickets/BUG-006/ticket.yaml
  - .ai/board/tickets/BUG-006/00-bug-report.md
  - .ai/board/tickets/BUG-006/01-plan.md
  - .ai/board/tickets/BUG-006/03-impl-log.md
  - git diff origin/main...HEAD
  - tests/e2e/tsk-01-tasks.spec.ts
  - src/routes/Tasks.tsx            # test IDs :818, :843, :852
  - .ai/registry/invariants.md      # INV-01 .. INV-07, :33-39
  - playwright.config.ts
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

# BUG-006 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket BUG-006, 6 changed file(s)` / `allowed_paths: tests/e2e/tsk-01-tasks.spec.ts` / `allowed-paths: PASS`. `node scripts/check-carry.mjs BUG-006` → `0 uncommitted path(s)` / `PASS — nothing stray`. Only non-board path in `git diff --name-only origin/main...HEAD` is `tests/e2e/tsk-01-tasks.spec.ts`, = `ticket.yaml` `allowed_paths` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output, run by the reviewer |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`, repo-wide, covers `tests/e2e/tsk-01-tasks.spec.ts`) exit 0, no output, run by the reviewer. No out-of-diff errors to route |
| R4 | No datastore access outside the seam | PASS | The diff touches only `tests/e2e/tsk-01-tasks.spec.ts`; its imports are `@playwright/test` and `./support/org-prefix` (`tests/e2e/tsk-01-tasks.spec.ts:1-2`), unchanged; `stepDay` (`:70-73`) only clicks and reads a DOM attribute. No `src/lib/data/` change |
| R5 | Every § 4 contract item implemented | PASS | § 4.1 at `tests/e2e/tsk-01-tasks.spec.ts:67-73`; § 4.2 at the thirteen lines in R5 detail; § 4.3 not committed — `git diff origin/main...HEAD` contains no `newCDPSession`/`setCPUThrottlingRate` |
| R6 | Permission gating matches § 3 | PASS | § 3: nothing changes. `signIn` (`tests/e2e/tsk-01-tasks.spec.ts:42-46`) and every fixture are untouched by the diff; no `src/` file in the diff |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml`); each INV reasoned in R7 detail below |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; no import added (`tests/e2e/tsk-01-tasks.spec.ts:1-2`) |
| R10 | Regression test fails before, passes after | PASS | Named test: `01-plan.md` § 2 AC-4, the overdue test `tests/e2e/tsk-01-tasks.spec.ts:287` (`origin/main:279`). See R10 detail |

## R10 detail

Test-only fix: the diff has no non-test path, so per `01-plan.md` § 2 AC-4 the *before* run takes
the spec itself from `origin/main`. Both runs by the reviewer, command
`pnpm exec playwright test tests/e2e/tsk-01-tasks.spec.ts tests/e2e/uie-10-sidebar.spec.ts --repeat-each=20 --workers=2 --retries=0 --reporter=line`.

| Run | Setup | Exit | Result |
|---|---|---|---|
| before | `git checkout origin/main -- tests/e2e/tsk-01-tasks.spec.ts` | 1 | 412 passed, 29 failed. **17 of 20** repeats of `tsk-01-tasks.spec.ts:279` (the overdue test) failed, every one at `addTask` `tests/e2e/tsk-01-tasks.spec.ts:59` called from `:284:5`: `expect(locator).toBeVisible()` on `getByTestId('tasks-list').getByTestId('task-title').filter({ hasText: 'From the 13th' })`, `element(s) not found` — the failure recorded in `00-bug-report.md` § Actual. The other 12 failures are `uie-10-sidebar.spec.ts:208` at `:150` |
| after | `git checkout HEAD -- tests/e2e/tsk-01-tasks.spec.ts` | 1 | 431 passed, 10 failed. **Every test in `tsk-01-tasks.spec.ts` passed 20 of 20**, the overdue test included. All 10 failures are `uie-10-sidebar.spec.ts:208` (the load companion) |

`git status --porcelain` empty after both runs.

The after run's exit 1 comes entirely from the load companion, which failed on the baseline too
(12 of 20) and is outside `allowed_paths`; see Delegated decisions.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `stepDay` + comment, after `heading` | `tests/e2e/tsk-01-tasks.spec.ts:67-73` (after `heading` at `:65`, one blank line) | Yes — `(page: Page, arrow: "tasks-prev-day" \| "tasks-next-day", day: string): Promise<void>`, click then `expect(heading(page)).toHaveAttribute("data-day", day)`, verbatim |
| § 4.2 `:85` → TOMORROW | `:93` | Yes |
| § 4.2 `:106` → TOMORROW | `:114` | Yes |
| § 4.2 `:132` → prev, YESTERDAY | `:140` | Yes |
| § 4.2 `:138` → TODAY | `:146` | Yes |
| § 4.2 `:139` → TOMORROW | `:147` | Yes |
| § 4.2 `:187` → TOMORROW | `:195` | Yes |
| § 4.2 `:194` → prev, YESTERDAY | `:202` | Yes |
| § 4.2 `:212` → TOMORROW | `:220` | Yes |
| § 4.2 `:213` → prev, TODAY | `:221` | Yes |
| § 4.2 `:255` → TOMORROW | `:263` | Yes |
| § 4.2 `:256` → DAY_AFTER | `:264` | Yes |
| § 4.2 `:283` → TOMORROW (AC-2) | `:291` | Yes |
| § 4.2 `:301` → prev, `"2030-03-14"` | `:309` | Yes |
| § 4.3 throttle never committed | absent from the diff | Yes |

AC-1: no literal `getByTestId("tasks-next-day")` or `getByTestId("tasks-prev-day")` remains in the
spec; every arrow click goes through `stepDay` (`:71`). AC-3: the diff removes exactly thirteen lines,
all of them the arrow clicks above; no title, `expect`, timeout or `waitForTimeout` is touched.
AC-7: test IDs used exist at `src/routes/Tasks.tsx:818` (`tasks-day-heading`, `data-day={day}`),
`:843`, `:852`; no `data-testid` and no import added.

## R7 detail

`invariants_touched: []`. The diff changes the order of a test's own steps and reads one DOM
attribute; it writes no entry, task, membership or count, and changes no `src/` file.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | Unaffected: no entry created or validated by changed code | `.ai/registry/invariants.md:33`; diff only `tests/e2e/tsk-01-tasks.spec.ts` |
| INV-02 approval reset on edit | Unaffected: no entry edited | `.ai/registry/invariants.md:34` |
| INV-03 rejection reason | Unaffected: no rejection path touched | `.ai/registry/invariants.md:35` |
| INV-04 absence count | Unaffected: tasks are not in the count, no counting code changed | `.ai/registry/invariants.md:36` |
| INV-05 tentative counts | Unaffected, as INV-04 | `.ai/registry/invariants.md:37` |
| INV-06 one portion | Unaffected: no entry written | `.ai/registry/invariants.md:38` |
| INV-07 one member, every team | Unaffected: no membership or entry written | `.ai/registry/invariants.md:39` |

## Findings

None.

## Delegated decisions

- **AC-4's "with exit code 0" on the after run is read as "every test in the spec passes".** The
  AC-4 command co-runs `tests/e2e/uie-10-sidebar.spec.ts` purely as load (`01-plan.md` § 2
  vocabulary), and its `:208` test fails at `:150` on the baseline (12/20) and on the branch (10/20)
  alike. The file is outside `allowed_paths`, so no loop role can make that exit 0 (RULE-03); the
  regression criterion R10 judges is the overdue test, which went from 17/20 failing to 20/20
  passing. `uie-10-sidebar.spec.ts:208` is a candidate for its own `/bug`, as `03-impl-log.md`
  already records.
- **AC-6 is satisfied as written.** The developer's traced baseline repeats did not fail, and the
  log leaves the cause `suspected`. The reviewer's 17 failures all land at `:59` from `:284`, as
  the plan § 1 predicts, but no trace was read, so the cause stays `suspected`.

## Verdict

PASS.
