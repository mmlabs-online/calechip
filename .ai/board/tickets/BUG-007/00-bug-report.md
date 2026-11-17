---
ticket: BUG-007
stage: TRIAGE
agent: orchestrator
produced_at: 2026-11-16T15:26:04Z
inputs_read:
  - tests/e2e/tsk-02-overdue-prompt.spec.ts
  - .ai/board/tickets/TSK-02/01-plan.md
  - .ai/registry/features.md
  - review and impl-log records cited under Actual
consulted: []
gate: PASS
blocking_reason: ""
next_state: BACKLOG
severity: S3
found_in: "local full-suite Playwright runs at 2 workers during MIR-04 … MIR-19-f reviews; origin/main 453e3b6 and later"
introduced_in: "unknown — `git log -S` on 'Tomorrow's' in the spec ends at the squashed `41b0a1e`; the board record attributes the test to TSK-02 (`TSK-02/03-impl-log.md:40`)"
root_cause: suspected
batch: ops/record-bug-006
regression_of: ""
---

# BUG-007 — TSK-02 AC-2 e2e test fails intermittently under a two-worker run: it adds a task before the next day has rendered

## Report

Operator, 2026-11-16, choosing the next step after the MIR tickets: "File the flaky e2e as BUGs (Recommended)", the option worded "Use the new /bug command to record the flaky tests seen on every PR (tsk-01:279, tsk-02:109, uie-10:208, uie-09:247, evt-07, mir-19-d-flip AC-5) as BUG tickets". Preceded by "làm tiêpds đi". No image attached.

## Environment

- Where: local, `pnpm exec playwright test` against the mock seam, full suite with 2 workers (`fullyParallel`); reproduced on `origin/main` as well as on feature branches
- Role and scope: per the spec's own fixtures; no real person's data
- Browser: Playwright Chromium, default viewport

## Steps to reproduce

1. On `main`: `pnpm exec playwright test tests/e2e/tsk-02-overdue-prompt.spec.ts:109 --repeat-each=30 --workers=2`, or the full suite at 2 workers.
2. The test signs in on 2030-03-12, adds and ticks "Done already", clicks Next day, adds "Tomorrow's" at once.
3. Observe an intermittent timeout at `:55`; alone it usually passes.

## Expected

`.ai/board/tickets/TSK-02/01-plan.md` § 2 AC-2 ("not shown when nothing is overdue … no `overdue-prompt` is shown"); feature row TSK-02 (`.ai/registry/features.md:254`). The spec must pass on every run.

## Actual

`addTask` at `tests/e2e/tsk-02-overdue-prompt.spec.ts:55` never sees "Tomorrow's" in `tasks-list` (timeout). Recorded: MIR-19-c `04-review.md:72` ("fails deterministically on origin/main 77efa17 as well"); MIR-19-d `04-review.md:33-37,79` and `03-impl-log.md:58` ("timing flake: it passes on rerun"); MIR-19-e `03-impl-log.md:59`; MIR-18 `03-impl-log.md:138` ("failed 1 in 3 with the base config too"); MIR-04 `03-impl-log.md:97`. The records conflict on "deterministic"; the weight of evidence is a load race.

## Root cause

**suspected.** `tests/e2e/tsk-02-overdue-prompt.spec.ts:115-116` clicks `tasks-next-day` and calls `addTask(page, "Tomorrow's")` without waiting for the heading to read `DAY_2` (the `twoOverdue` setup waits at `:84`, `:87`, which is why AC-1 and AC-3 are stable). Same mechanism as BUG-006: `src/App.tsx:714` `<BrowserRouter>` runs location updates as transitions, so the DAY_1 `<AddTaskForm key={day}>` (`src/routes/Tasks.tsx:930`) receives the input, then unmounts when `ready` turns null (`Tasks.tsx:701`). `OverduePrompt` module state (`src/lib/overdue-prompt.ts:13-22`) is not involved: the failure is before `reopen` (`:119`). Confirm: `--repeat-each=30 --workers=4` (or CPU throttling) with a trace at `:55`; then add `await expect(heading(page)).toHaveAttribute("data-day", DAY_2)` after `:115` and expect 0 failures.

`introduced_in`: unknown — `git log -S` on "Tomorrow's" in the spec ends at the squashed `41b0a1e`; the board record attributes the test to TSK-02 (`TSK-02/03-impl-log.md:40`).

## Severity

S3 — test synchronisation race; the feature works as written. Its cost is a red full suite that has made five reviews write "pre-existing" waivers.

## Regression test, proposed

End-to-end, in the same spec, proven with `--repeat-each` under load. If the plan chooses an app-side fix, add a Vitest component test that `AddTaskForm` input is neither lost nor misdated across a day change.

## Open questions

- Test only (wait on the day heading as `twoOverdue` does), or also the app (`useTransitions={false}`, or disable the add form while the view is still on the old day)?
- Shares its root cause with BUG-006; one helper could serve both specs.
- Re-baseline with a repeat run, since one record called it deterministic.

## Further reports
