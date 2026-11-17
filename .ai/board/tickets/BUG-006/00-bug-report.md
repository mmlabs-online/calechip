---
ticket: BUG-006
stage: TRIAGE
agent: orchestrator
produced_at: 2026-11-16T15:26:04Z
inputs_read:
  - tests/e2e/tsk-01-tasks.spec.ts
  - .ai/board/tickets/TSK-01/01-plan.md
  - .ai/registry/features.md
  - review and impl-log records cited under Actual
consulted: []
gate: PASS
blocking_reason: ""
next_state: BACKLOG
severity: S3
found_in: "local full-suite Playwright runs at 2 workers during MIR-04 … MIR-19-f reviews; origin/main 453e3b6 and later"
introduced_in: "unknown — `git blame` on `tests/e2e/tsk-01-tasks.spec.ts:279-285` and `src/routes/Tasks.tsx:636-661,930` ends at the squashed `41b0a1e` ('first commit'); the board record attributes the spec to TSK-01"
root_cause: suspected
batch: ops/record-bug-006
regression_of: ""
---

# BUG-006 — TSK-01 AC-13 to AC-15 e2e test fails intermittently under a two-worker run: it adds a task before the next day has rendered

## Report

Operator, 2026-11-16, choosing the next step after the MIR tickets: "File the flaky e2e as BUGs (Recommended)", the option worded "Use the new /bug command to record the flaky tests seen on every PR (tsk-01:279, tsk-02:109, uie-10:208, uie-09:247, evt-07, mir-19-d-flip AC-5) as BUG tickets". Preceded by "làm tiêpds đi". No image attached.

## Environment

- Where: local, `pnpm exec playwright test` against the mock seam, full suite with 2 workers (`fullyParallel`); reproduced on `origin/main` as well as on feature branches
- Role and scope: per the spec's own fixtures; no real person's data
- Browser: Playwright Chromium, default viewport

## Steps to reproduce

1. On `main`: `pnpm exec playwright test tests/e2e/tsk-01-tasks.spec.ts:279 --repeat-each=20 --workers=2`, alongside another spec for load (e.g. `tests/e2e/uie-10-sidebar.spec.ts`), or the full suite at 2 workers.
2. Observe an intermittent timeout at `:59` from `:284`.
3. Control: `--workers=1` passes.

## Expected

`.ai/board/tickets/TSK-01/01-plan.md` § 2 AC-13, AC-14, AC-15 (overdue section shown above today, removed when ticked or moved, absent on other days); feature row TSK-01 (`.ai/registry/features.md:253`). The spec must pass on every run.

## Actual

`addTask` visibility timeout at `tests/e2e/tsk-01-tasks.spec.ts:59`, called from `:284` — "From the 13th" never appears in `tasks-list`. Recorded: MIR-19-b `04-review.md:102` (1/77 on branch, 4/10 at `origin/main` 453e3b6); MIR-19-c `04-review.md:72` (fails 1/3 on origin/main 77efa17); MIR-19-e `04-review.md:45,109` (fails at 2 workers, passes at `--workers=1`); MIR-19-f `03-impl-log.md:64` (fails identically on a stashed baseline).

## Root cause

**suspected.** `tests/e2e/tsk-01-tasks.spec.ts:283-284` clicks `tasks-next-day` and calls `addTask` at once, without waiting for the new day (the AC-11 test at `:255-257` waits on the heading `data-day`). `src/App.tsx:714` mounts `<BrowserRouter>` without `useTransitions={false}`; react-router 7.18.3 wraps location updates in `React.startTransition`, so the previous day's `<AddTaskForm key={day}>` (`src/routes/Tasks.tsx:930`) stays mounted under load and `fill`/`click` land on it: the title is lost when the form remounts, or the task is created on 2030-03-12. Secondary: `load` in `src/routes/Tasks.tsx:636-657` has no staleness guard. Confirm: `--repeat-each=20 --workers=2 --trace=on` and read the trace at `:59`; then add `await expect(heading(page)).toHaveAttribute("data-day", "2030-03-13")` after `:283` and expect 0/20. Same pattern at `:85`, `:106`, `:138-139`, `:187`, `:212`.

`introduced_in`: unknown — `git blame` on `tests/e2e/tsk-01-tasks.spec.ts:279-285` and `src/routes/Tasks.tsx:636-661,930` ends at the squashed `41b0a1e` ("first commit"); the board record attributes the spec to TSK-01.

## Severity

S3 — test-only: the feature behaves as AC-13 to AC-15 say whenever the test waits; the cost is a full-suite gate that is red about 40% of runs, waived by hand in four reviews.

## Regression test, proposed

End-to-end, in the same spec: the race is between a real browser, React transitions and Playwright actionability, which a synchronous unit render cannot reproduce. Acceptance evidence: `--repeat-each` under `--workers=2` with 0 failures.

## Open questions

- Test only (wait on the day heading, or a shared `goNextDay` helper), or also the app (`load` ignores stale results; `useTransitions={false}` app-wide — that changes every route and may need an ADR)?
- Fix the five other unwaited day-arrow sites in the same spec at the same time?
- Same root cause as BUG-007 (`tsk-02`); the plan may decide to fix both from one helper, but each ticket owns its spec.

## Further reports
