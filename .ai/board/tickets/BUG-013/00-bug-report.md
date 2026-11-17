---
ticket: BUG-013
stage: TRIAGE
agent: orchestrator
produced_at: 2026-11-17T12:22:54Z
inputs_read:
  - src/routes/Tasks.tsx
  - .ai/board/tickets/TSK-01/01-plan.md
  - .ai/board/tickets/BUG-006/01-plan.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: BACKLOG
severity: S2
found_in: "unknown — found by reading code at BUG-006 PLAN, 2026-11-17; not seen on screen"
introduced_in: "unknown — `git blame` on `src/routes/Tasks.tsx:636-657` and `:701` ends at the squashed `41b0a1e` ("first commit"); TSK-06 last reshaped `load` into one read of the week"
root_cause: suspected
batch: ops/record-bug-012
regression_of: ""
---

# BUG-013 — The task page can stay on its loader when a slow read of a day the member has already left lands after the read of the new day

## Report

Operator, 2026-11-17: "ghi các flake còn lại thành bug đi", after the orchestrator listed the flakes still unrecorded at the end of the BUG-006 to BUG-011 batch: TSK-02 AC-4 (the Escape step), `adm-04` AC-11, `evt-09` AC-6, `mir-14-b` AC-13, and the stale load in `src/routes/Tasks.tsx:636-657`. No image attached.

## Environment

- Where: any, the task page `/{org}/tasks/<day>`; most likely on a slow network
- Role and scope: member, their own tasks
- Browser: any

## Steps to reproduce

1. Open the task page on day D.
2. Before D's read returns, press `tasks-next-day` (or the previous-day control) once.
3. Let the read for D+1 return first, then D's (a slow first read; in a test, delay `listTasks` for the first call only).
4. The page stays on its loader for D+1 until another load runs.

## Expected

`.ai/board/tickets/TSK-01/01-plan.md` § 2 **AC-2 — day navigation**: *"When they press the previous-day control (`tasks-prev-day`) or the next-day control (`tasks-next-day`) / Then the page shows day D−1 or D+1 respectively, at the address `/tasks/<that day, yyyy-MM-dd>`, and lists that day's tasks"*. Feature row `TSK-01` (`.ai/registry/features.md:253`).

## Actual

Not observed on screen. By reading: the page is left on the loader for the new day, with no error, until something triggers another load.

## Root cause

**suspected.** `load` (`src/routes/Tasks.tsx:636-657`) writes whatever its read returns with `setState({ phase: "ready", day, … })`, and nothing discards a result for a day the page has already left. The render takes the state only when `state.day === day` (`:701`), so when D's late result lands after D+1's, `ready` is `null` for D+1 and stays null: the effect at `:659-661` does not run again because `load` has not changed. TSK-05 AC-6 guards ticks against a load (`ticker.mark()`, `:637`); nothing guards one load against an older one. Recorded as out of scope in `.ai/board/tickets/BUG-006/01-plan.md:74-80` and § 8 alternative 2. Confirm: a unit or component test that delays the seam's first `listTasks` and resolves the second first, then asserts `tasks-day-heading` for D+1 and no loader.

## Severity

S2 — day navigation, a shipped acceptance criterion, can leave the screen on its loader; the workaround is to move day again or reload.

## Regression test, proposed

Unit or component level with the mock seam, where the order in which two reads resolve can be controlled exactly; an end-to-end test could only make the order likely, not certain.

## Open questions

- Drop a stale result, or cancel the earlier read? Either keeps AC-2 as written; neither changes the seam's contract.
- Does the same pattern exist in the other screens that read by a route parameter (week, month, year)? That is a separate record if so.

## Further reports

None.
