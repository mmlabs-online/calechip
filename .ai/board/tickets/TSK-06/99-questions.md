---
from: developer
to: tech-lead-design
asked_at: 2026-10-18T20:40:00+07:00
---

**Q.** `01-plan.md` § 4.1 makes `Task.timeOfDay` a **required** field (`string | null`), and § 7 lists
`tests/tasks.test.ts` and `tests/week-tasks.test.ts` as the test files that change. Three other test
files construct `Task` object literals directly and are not in `allowed_paths`; with the contract as
written, `pnpm exec tsc --noEmit` fails on each (measured, not predicted):

```
tests/overdue-prompt.test.ts(42,37): TS2741: Property 'timeOfDay' is missing ... required in type 'Task'.
tests/pto-tasks.test.ts(20,3):       TS2322: ... 'timeOfDay' ... 'undefined' is not assignable to 'string | null'.
tests/task-tick.test.ts(11,51):      TS2741: Property 'timeOfDay' is missing ... required in type 'Task'.
```

Each is a fixture builder (`fake`, `task`, `task`) for a pure function, the same shape as
`tests/week-tasks.test.ts`'s `task()`. § 5 checked callers of `listTasks` and `updateTask` but not
constructors of `Task`, which is how these were missed. The typecheck gate cannot pass without one of:

1. Add the three files to `allowed_paths`, with the instruction that each may change by exactly one
   line: `timeOfDay: null,` added to its `Task` literal. No assertion changes.
2. Make `timeOfDay` optional on `Task` — rejected by me: it weakens § 4.1's contract to save three
   lines, and `toTask` always sets it.

**My recommendation is 1.** RULE-03 forbids me editing them without it.

**A.** **Option 1, with the scope you stated. The plan was incomplete; the contract stands.**

`answered_at: 2026-10-18T20:09:49+07:00` by `tech-lead-design`. *The `date` on this machine read
earlier than this block's `asked_at`; the measured value is recorded rather than adjusted.*

Reproduced: `pnpm exec tsc --noEmit` reports exactly those three errors in files outside
`allowed_paths` (the remaining errors are in `src/routes/Tasks.tsx` and `tests/tasks.test.ts`, both
listed, and are your work in progress). § 5 checked the *callers* of the two changed seam functions
and not the *constructors* of the changed type; a required field added to a shared interface reaches
every object literal typed as it, and that is the property I did not check.

Option 2 is refused for your reason: `timeOfDay?:` would let a `Task` exist with the time neither set
nor declared absent, and § 4.1's `string | null` is what makes "no time" a value rather than an
omission.

**The permission.** `tests/overdue-prompt.test.ts`, `tests/pto-tasks.test.ts` and
`tests/task-tick.test.ts` are now in `allowed_paths`. In each, exactly one line changes: `timeOfDay:
null,` added to the fixture builder's `Task` literal (`fake`, `task`, `task` respectively), placed
after `note` to follow § 4.1's field order. No assertion, import, comment or other line changes. In
`pto-tasks.test.ts` the line goes before `...over`, so a test may still override it.

**Size — recorded, not hidden.** Seventeen paths. By `.ai/01-operating-model.md`'s table and this
repository's own precedent (EVT-03 to EVT-12: "a thirteenth path makes this L"), that is `L`, and it
already was at thirteen; § 7's "twelve source and test files remain the build" was a count that
excused itself. `size` in `ticket.yaml` now reads `L`. A split would not remove these three lines —
they follow `types.ts` into whichever half carries the type — so this answer does not depend on it,
and you may continue. Whether TSK-06 proceeds as `L` or is split is put to the operator.

RULE-08: `rework_count` does not increment; you routed it rather than editing outside
`allowed_paths`.

**Amended:** `01-plan.md` § 5 (constructors of `Task` named, the three fixtures listed), § 7 (three
paths added; seventeen paths; `size` M → L, with the disagreement against `size_estimate: M`
stated), and a Changelog entry. `ticket.yaml`: `allowed_paths`, `size` and its comment,
`chat_budget.developer->tech-lead-design.used` 0 → 1.
