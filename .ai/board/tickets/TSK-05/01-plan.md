---
ticket: TSK-05
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-16T07:43:16+0700
inputs_read:
  - .ai/board/tickets/TSK-05/ticket.yaml
  - .ai/board/ideas/2026-10-15-ticking-a-task-done-waits-two-round-trips-and-locks-the-box.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/steward/context.md
  - .ai/board/tickets/TSK-01/01-plan.md
  - .ai/board/tickets/TSK-05/04-review.md
  - src/lib/task-tick.ts
  - src/routes/Tasks.tsx
  - src/lib/domain/types.ts
  - src/lib/data/mock.ts
  - tests/tasks.test.ts
  - tests/e2e/tsk-01-tasks.spec.ts
  - vite.config.ts
  - package.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# TSK-05 — Ticking a task done or not done changes on screen at once

## 1. Problem and scope

Transcribed from `.ai/registry/features.md`, `## TSK — Tasks`, without paraphrase:

| ID | Story | Group | Status |
|---|---|---|---|
| TSK-05 | Ticking a task done or not done changes on screen at once, and the server's answer confirms or undoes it | TSK | PLANNED |

The row's scope, each clause the operator's (the request verbatim, and Q1, Q2 in the idea's
§ *Evidence*): the tick box on `/tasks` changes done, its look and the row at once, before the write;
`setTaskDone` runs in the background with no disabled box and no spinner; success takes the returned
task as the truth with no reload; failure, `task_not_permitted` included, puts the task back and shows
the row's existing error; the last of several taps wins and a stale answer never overwrites a newer
state; edit, move, add and delete unchanged. **A ticked overdue task stays in `tasks-overdue`, shown as
done, until the next load** (Q1 *"B"*) — this amends TSK-01 AC-14. **A superseded tap's failure is not
shown** (Q2 *"A"*), only the last tap's. Through the seam only (RULE-02), `setTaskDone`'s contract and
every `data-testid` unchanged.

**Who gains what.** Every member using `/tasks` gains a tick box that answers the tap instead of the
network. Today a tap waits for the write and then for a reload of every list on the page, with the box
disabled throughout (`src/routes/Tasks.tsx:125-136`, `:211`), so a second tap is swallowed and a list
is ticked one slow item at a time. The tick is the screen's most frequent action; this ticket makes it
cost nothing visible, while the database stays the only thing that decides whether the change stands.

**The two guesses the idea left to PLAN** (its § *Open questions*), both **confirmed**:

1. **`tasks-overdue-count` drops at once on a tick**, though the row stays (AC-7). TSK-01 AC-13 defines
   the number as the count of tasks *not done and dated before today*; a row shown done is no longer
   one of them, so a count that kept it would contradict the row beside it.
2. **"The next load" is whatever already calls `load`** — day navigation, a page reload, or a
   successful edit, move, add or delete of any row (request item 6 keeps their reload). A ticked overdue
   row may therefore leave the section when the member edits a different task. Accepted as a
   consequence of item 6, not a defect.

**Out of scope.**

- **Edit, move, add and delete** keep their current flow, `busy` state and reload — request item 6.
- **The overdue prompt on app open** (`TSK-02`) — a different surface; whether it ticks optimistically
  is not decided here.
- **Changing `setTaskDone`'s contract**, adding a seam function, or a batch write for several ticks.
- **Offline queueing.** A tap whose request cannot be sent fails and rolls back like any other failure.
- **Retrying a failed tick automatically.** The member taps again.
- **Any visual change to the row** beyond the box no longer being disabled — § 2b.
- **Rewriting `.ai/board/tickets/TSK-01/01-plan.md`.** It is a shipped artifact; AC-14's amended text
  lives in this plan (AC-9) and in the TSK-01 test that asserts it.

`size_estimate: S` — one screen and one new pure module, no seam, schema or type change.

## 2. Acceptance criteria

"The member" is any signed-in, approved, not-removed person, as in TSK-01. "A row" is a `task-row`
in either list — the day's list (`tasks-list`) or the overdue section (`tasks-overdue`). "The box" is
the row's `task-done`. "The write" is the `setTaskDone(taskId, done)` call a tap makes through the seam.
"The value before the tap" is the done state the screen last received from the server for that task —
from the last load, or from the last successful write.

**AC-1 — the tap shows at once**
- Given a row whose box shows not done (or done)
- When the member presses the box
- Then, before the write answers, the row shows the other state: `data-done`, the box's `aria-checked`
  and `aria-label`, the title's strike-through and the box's fill all change; the task keeps its place
  in its list.
- And the box is never disabled, no loader or spinner appears for the tick, and the box keeps keyboard
  focus, so a second press (click, Space or Enter) acts on the same box at once.

**AC-2 — success takes the answer, with no reload**
- Given the member pressed the box and made no later press on that task
- When the write answers success
- Then the row shows the task the write returned, and no list is re-read because of the tick —
  neither `listTasks` nor `listOverdueTasks` is called.
- And the change persists across a reload of the page (TSK-01 AC-9's outcome, unchanged).

**AC-3 — failure puts it back and says why**
- Given the member pressed the box and made no later press on that task
- When the write answers a failure, whatever its code (`task_not_permitted` included), or the call
  itself throws or rejects
- Then the row returns to the value before the tap, and the row's message (the same `role="alert"` line
  that shows a failed edit or move) shows the failure's sentence: for `task_not_permitted`, *This task
  could not be changed. It may have been deleted.*; for a call that throws or rejects, *This task could
  not be saved.*
- And the message stays until the member presses that box again, or a later write for that task
  succeeds.

**AC-4 — the last press wins**
- Given the member presses the same box several times before the writes answer, in any rhythm
- When every write has answered successfully
- Then the row shows the value the last press set, and the stored task holds the same value (a reload
  shows it); no answer to an earlier press changes the row after a later press was made.
- And at most one write for a given task is outstanding at any moment, so the database applies them in
  the order they were sent. Presses on different tasks do not wait for each other.

**AC-5 — a superseded failure is not shown**
- Given the member pressed the box, then pressed it again before the first write answered
- When the first write fails
- Then no message is shown for that failure and the row is not rolled back by it; the failure is
  written to the browser console. Only a failure of the write that carries the last press's value
  reaches the screen (AC-3).

**AC-6 — a load does not undo a tick**
- Given a tick on a task is outstanding, or has succeeded, and a load of the page's lists (from another
  row's edit, move, add or delete, or from day navigation) began before that tick's write answered
- When that load answers after the write
- Then the row shows the tick's value, not the value the load read.

**AC-7 — a ticked overdue task stays in the section**
- Given today's page shows `tasks-overdue`
- When the member ticks a task in it
- Then the task stays in `tasks-overdue`, in its place, with its date chip, shown done (AC-1), until the
  page next loads; unticking it there shows it not done again.
- And `tasks-overdue-count` is the number of the section's rows shown not done: it drops by one at once
  on a tick, and rises by one on an untick or on a rolled-back failure (AC-3).
- And the section is present exactly when the last load returned at least one overdue task, so it stays
  visible, with a count of 0, when every task in it has been ticked; at the next load ticked tasks are
  not returned (TSK-01 AC-13, ADR-057 decision 7) and, when none remain, the section is absent. The next
  load is day navigation, a reload of the page, or a successful edit, move, add or delete on the page.

**AC-8 — everything else is unchanged**
- Given the member edits, moves, adds or deletes a task
- When they save
- Then TSK-01 AC-6, AC-8, AC-10, AC-11 and AC-12 hold exactly as before: the save control is disabled
  while the write runs, and the page reloads its lists after a success.
- And the tick reaches the database only through `seam.setTaskDone(taskId, done)`, whose signature and
  answers are unchanged; every selector in TSK-01 § 4.7 is still present with the same attributes.

**AC-9 — TSK-01 AC-14, as amended by this ticket**
- Given a task that is done, or a task dated today or later
- When today's page loads
- Then that task is not in `tasks-overdue`. Moving an overdue task to today or later removes it from the
  section once the move saves; **ticking an overdue task leaves it in the section, shown done, until the
  page next loads (AC-7)**; when a load finds none, the section is absent.
- *Was (TSK-01, 2026-10-15): "Ticking an overdue task, or moving it to today or later, removes it from
  the section at once; when none remain, the section is absent." Changed by the operator's answer Q1
  "B" in the idea file.*

**Invariants touched: `[]`.** Written explicitly. No entry is written or counted; the tick writes the
same `done` column through the same function as before. INV-01 to INV-07 are about entries.

**Open questions.** None. The two guesses the idea left are confirmed in § 1, each with its reason.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image exists in `.ai/board/tickets/TSK-05/design/` or in the idea file. **There is no new layout.**
The row, the box, the overdue card and the message line are TSK-01 § 2b's, unchanged. The only visible
differences:

- The box is never dimmed: it no longer carries `disabled`, so the `disabled:opacity-50` look never
  shows on it.
- A ticked row in the overdue section stays in the pink card, struck through and greyed with the mint
  box, exactly as a ticked row looks in the day's list; the header reads *Overdue · 0* when all are
  ticked.
- A failed tick's sentence appears in the row's existing red line under the row.

## 3. Permission model

**Unchanged, and held where TSK-01 holds it:** the `task_update_own` policy on `public.task` and the
column grant `update (date, title, note, done)` (TSK-01 § 3). A write to a task that is not the caller's
touches zero rows and the seam answers `task_not_permitted`.

**What this ticket adds is display, not authority.** The row shows a value before the database has
accepted it; that is an affordance and nothing else. When the database refuses, the row goes back
(AC-3), so the screen never keeps a value the database did not store. A member can only see and press
the boxes of their own tasks, because the page lists only what the policies return; nothing here
widens that.

**Denials, unchanged:** no teammate, manager or admin, of this team or another, can tick or untick
another member's task (TSK-01 AC-17); signed out, pending, rejected or removed callers are refused
every write (AC-18). R6 has nothing new to read.

## 4. Contract

### 4.1 New module — `src/lib/task-tick.ts`

Pure TypeScript, no React, no seam import — the write is passed in, so the module is tested in
vitest's `node` environment (`vite.config.ts:101`) with promises the test controls.

```ts
// TSK-05 — the optimistic tick. 01-plan.md § 4.1.
import type { Failure, Result, Task } from "@/lib/domain/types";

/** The write a tap makes. The page passes `(id, done) => seam.setTaskDone(id, done)` (RULE-02). */
export type TickWrite = (taskId: string, done: boolean) => Promise<Result<Task>>;

/** AC-3. The sentence for a write that throws or rejects — the seam's own `unknown` sentence. */
export const TICK_FAILED = "This task could not be saved.";

/** What a task's run of presses ended in. Emitted once per run, when no write for it is outstanding. */
export type TickOutcome =
  /** AC-2. The last write succeeded; `task` is the truth. */
  | { kind: "saved"; task: Task }
  /** AC-3. The write carrying the last press's value failed; `done` is the value before the tap. */
  | { kind: "failed"; taskId: string; done: boolean; failure: Failure }
  /** AC-4, AC-5. An earlier write failed, and the last press had already restored the value the server
   *  holds, so nothing was left to send and nothing is shown. */
  | { kind: "settled"; taskId: string; done: boolean };

export interface TaskTicker {
  /** AC-1, AC-4. Flip the value `shown(task)` currently has. `task.done` is the value before the tap
   *  when no run is open for this task. Calls `onChange` synchronously, before any write is issued. */
  tap(task: Task): void;
  /** AC-1. `task` with `done` replaced by the last press's value while a run is open; else `task`. */
  shown(task: Task): Task;
  /** AC-6. A counter, read by the page immediately before it starts a load. */
  mark(): number;
  /** AC-6. `task` with `done` replaced by the value of a run that ended after `mark` was read; else
   *  `task`. */
  reconcile(task: Task, mark: number): Task;
}

export function createTaskTicker(
  write: TickWrite,
  /** Something shown has changed — the page re-renders. */
  onChange: () => void,
  onOutcome: (outcome: TickOutcome) => void,
): TaskTicker;

/** AC-2, AC-3, AC-4. `list` with the outcome's server value written into the task it names: `saved`
 *  replaces the task with `outcome.task`; `failed` and `settled` replace only `done` with
 *  `outcome.done`. A task the list does not hold is left alone; the same array is returned when
 *  nothing changed. Added at the REVIEW FAIL of 2026-10-15 — see the Changelog. */
export function applyOutcome(list: Task[], outcome: TickOutcome): Task[];
```

**Behaviour the Developer implements, and the test asserts:**

- **Per task, one run** `{ confirmed, desired, seq, inFlight }`. `tap` opens a run when none is open
  (`confirmed = desired = task.done`), then sets `desired = !desired`, increments `seq`, and calls
  `onChange`. If no write is in flight it sends `write(taskId, desired)`, remembering the `seq` and
  value it sent.
- **One write in flight per task** (AC-4). A tap while one is in flight only changes `desired`.
- **When a write answers** (a rejection or a throw is converted to
  `{ ok: false, error: { code: "unknown", message: TICK_FAILED } }`):
  - success → `confirmed = result.value.done`, and the returned task is kept as the run's latest;
  - failure and `seq` has moved on since it was sent → `console.error` the failure with the task id,
    and nothing else (AC-5);
  - then, if `desired !== confirmed`, send `write(taskId, desired)` and wait again;
  - otherwise close the run and emit exactly one outcome: `saved` with the latest returned task when
    the write that just answered succeeded; `failed` with `done: confirmed` when it failed and its `seq`
    was the current one (AC-3); `settled` with `done: confirmed` when it failed but had been superseded.
  - On closing, record `{ done, at: ++counter }` for the task, which `reconcile` reads (AC-6).
- Nothing in the module reads a clock, sets a timer or debounces.

### 4.2 Screen — `src/routes/Tasks.tsx`

- **The page owns one ticker** for its lifetime (`useRef`, created once), with
  `write = (id, done) => seam.setTaskDone(id, done)`, `onChange` bumping a render counter, and
  `onOutcome`, which **for every kind first writes the outcome into both lists** —
  `tasks: applyOutcome(s.tasks, outcome), overdue: applyOutcome(s.overdue, outcome)` — because the run
  is closed by then and `shown` falls back to the lists, so they must hold the server's value:
  - `saved` → also clear that task's tick error;
  - `failed` → also set that task's tick error to `failure.message`;
  - `settled` → nothing further.

  *Was, until the REVIEW FAIL of 2026-10-15: `saved` replaced the task in both lists; `failed` set the
  error only; `settled` did nothing. That left the lists on the last load's value whenever a run had a
  successful write before its final failure — Changelog.*
- **Tick errors** are page state, `Record<string, string>` keyed by task id. A tap clears the tapped
  task's entry before calling `ticker.tap`.
- **`load`** reads `const mark = ticker.mark()` before its two requests, and stores
  `tasks.map((t) => ticker.reconcile(t, mark))` and the same for `overdue`. Nothing else in `load`
  changes.
- **Rows** receive `ticker.shown(task)` as `task`, plus two new props:
  `onTick(): void` (clears the error, then `ticker.tap(task)` with the **unshown** task from state) and
  `tickError: string | undefined`.
- **`TaskRow`**: the box's `onClick` is `onTick`; **`disabled={busy}` is removed from the box**; `run`,
  `busy` and every other control are unchanged (AC-8). The row's general message renders
  `errors.general ?? tickError`, in the existing `GeneralError`, in both view and move modes.
- **Row keys drop `done`**: `${task.id}:${task.date}:${task.title}:${task.note ?? ""}` in both lists, so
  a tap does not remount the row and the box keeps focus (AC-1).
- **The overdue count** is `ready.overdue.filter((t) => !ticker.shown(t).done).length`; the section's
  condition stays `isToday && ready.overdue.length > 0` (AC-7).
- **No `setTaskDone` call remains inside `run`.** The tick path never calls `onChanged`, `load`,
  `listTasks` or `listOverdueTasks` (AC-2).

### 4.3 Selectors

**None added, none removed, none renamed.** TSK-01 § 4.7 stands in full. What changes is only when
`task-row[data-done]`, `task-done[aria-checked]` and `tasks-overdue-count` change.

## 5. Seam impact

**None.** `setTaskDone(taskId: string, done: boolean): Promise<Result<Task>>` is called unchanged; no
function is added, removed or edited in `index.ts`, `supabase.ts` or `mock.ts`; `seam-parity.test.ts`
is untouched. No type in `src/lib/domain/types.ts` changes.

**Invariants — how each is held (R8).** None touched (§ 2). Nothing in `absence.ts`, `busy.ts` or
`day-status.ts` is read or edited.

**Tests.**

- **`tests/task-tick.test.ts`** (vitest, `node`), against `createTaskTicker` with a fake `write` whose
  answers the test resolves by hand:
  - AC-1: after `tap`, `shown(task).done` has flipped and `onChange` was called, before the write's
    promise is resolved; `write` was called once with the flipped value.
  - AC-2: success → one `saved` outcome carrying the returned task; `shown` returns the input again.
  - AC-3: a `task_not_permitted` failure → one `failed` outcome with the value before the tap and the
    seam's sentence; a rejected promise and a throwing `write` → `failed` with `TICK_FAILED`.
  - AC-4: three taps with the first write unresolved → `write` called once; resolving it sends exactly
    one more write with the last value (or none when the last value equals the answer); the final
    `saved` holds the last value; resolving answers out of the expected order is impossible by
    construction and asserted by counting calls in flight never above one. Two tasks tapped together
    each get a write at once.
  - AC-5: tap, tap, first write fails → no `failed` outcome, `console.error` called once (spied),
    `settled` emitted when the last value equals the server's; with a third tap, the following write's
    success yields `saved`.
  - AC-6: `mark()` before a tap's run closes, `reconcile` of a stale task after it closes returns the
    run's value; `mark()` after it closes returns the task unchanged.
  - **AC-3, AC-4 — a success before the final failure** (the REVIEW finding, both shapes): task loaded
    `done: false`; (a) tap, tap, write 1 (`true`) succeeds, write 2 (`false`) fails → the outcome is
    `failed` with `done: true`; (b) tap ×3, write 1 (`true`) succeeds, write 2 (`false`) fails while
    superseded → `settled` with `done: true`. In each, `applyOutcome([loadedTask], outcome)` then
    `shown(...)` reads `done: true` — the value the fake server holds — and not the loaded `false`.
  - `applyOutcome`: `saved` replaces the whole task; `failed` and `settled` change `done` only; a list
    without the task is returned unchanged (the same array).
- **`tests/e2e/tsk-05-optimistic-tick.spec.ts`**, through the screen against the mock seam, TSK-01's
  helpers and fixtures copied as that spec defines them:
  - AC-1: after a click the box is enabled, `aria-checked` and `data-done` have flipped, no
    `role="status"` loader is on the page, and the box is focused; pressing Space on it flips it back.
  - AC-4: five clicks in a row on one box land on done; a re-read (next day, previous day) shows done.
  - AC-7: on today with two overdue tasks, tick one → it stays in `tasks-overdue` with `data-done="true"`
    and its chip, count reads 1; untick → count 2; tick both → section visible, count 0; next day then
    *Today* → the section is absent.
- **`tests/e2e/tsk-01-tasks.spec.ts`**, the AC-13 to AC-15 test only (AC-9 here): after ticking *From
  the 12th*, assert it is still in `tasks-overdue` with `data-done="true"`; the existing move and
  final-absence assertions stand, and the comment `// AC-14.` cites TSK-05 AC-9.

**A gap, stated rather than hidden:** the mock seam has no hook to make `setTaskDone` fail or wait, and
adding one is a seam-file change this ticket does not need. Rollback and supersession (AC-3, AC-5) and
the before-the-answer ordering (AC-1) are therefore asserted against the module, not through the
screen; § 4.2 is short enough for R2 to read the wiring directly.

## 6. Schema delta

`none`. No table, column, policy, trigger, function or grant changes.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/task-tick.ts"
  - "src/routes/Tasks.tsx"
  - "tests/task-tick.test.ts"
  - "tests/e2e/tsk-05-optimistic-tick.spec.ts"
  - "tests/e2e/tsk-01-tasks.spec.ts"
```

**Glossary:** `glossary_owed: []`; no row written. *Task* and *Overdue* exist from TSK-01.

**Five paths: `size: S`, agreeing with `size_estimate: S`.** **Deliberately absent:** every seam file
(§ 5); `src/lib/domain/types.ts` (no type changes — a change there would be XL); `src/lib/data/mock.ts`
(§ 5's gap); `.ai/board/tickets/TSK-01/01-plan.md` (shipped artifact; § 1 Out-of-scope).

## 8. Rejected alternatives

**1. Send every press at once and discard stale answers by sequence number.** The idea named it first
and it is the common shape: each tap issues its own write, and only the answer to the newest is
applied. Rejected because it guarantees the *screen* shows the last press but not the *database*: two
concurrent `update`s on one row are applied in whatever order they reach PostgreSQL, so press 1 (done)
and press 2 (not done) can be stored as done while the screen, having applied press 2's answer, shows
not done — the next load then flips the row by itself. AC-4 requires the stored value to match. One
write in flight per task makes the order the send order at the cost of one extra round trip in a rapid
series, which the member does not see because the screen already shows the value.

**2. Debounce the presses and send only the final value** after a quiet interval. Fewest writes.
Rejected because it delays every single tap's write by the interval, which is a number nobody stated
(it would be invented here); a tap followed by leaving the page inside the interval is lost; and
coalescing while a write is in flight (alternative chosen) already sends only the values that matter,
without a timer.

**3. Keep the optimistic state inside `TaskRow`.** Smallest diff: a local `done` and a local
in-flight flag beside `busy`. Rejected because the overdue count is a page-level number that must see
every row's shown value (AC-7), a load replaces the page's lists and would need the row's state to
survive it (AC-6), and rows are keyed on their content today, so a row-local value disappears whenever
the row remounts.

## Changelog

- `2026-10-15T19:58:58+0700` — sections 1 and 2 were drafted from the idea file and TSK-01's plan
  before `src/routes/Tasks.tsx` was read in full. Reading it added two things to § 2, each a
  consequence of a request item rather than a new requirement: AC-1's *keeps keyboard focus* (the row's
  key includes `done`, so an optimistic flip would remount the box and drop focus, swallowing the very
  repeated press request item 5 is about), and AC-6 (edit, move, add and delete still reload, request
  item 6, and such a load is an older answer that request item 5 says must not overwrite a newer
  state). No AC was narrowed. Raised by `tech-lead-design`.
- `2026-10-16T07:43:16+0700` — § 4.1 gains `applyOutcome`; § 4.2's `onOutcome` writes every outcome
  into both lists, not only `saved`; § 5 names the two tests that would have caught it. **Raised by
  `tech-lead-review`** (`04-review.md` Finding 1, R5 *impossible as specified*): a run whose earlier
  write succeeded and whose final write failed, or was superseded and failed, closed with the correct
  `done` in its outcome, but the page discarded it, so the row fell back to the last load's value
  while the server held the other one, and the next load flipped it by itself. The defect was this
  plan's wiring, not the Developer's reading of it. No AC changes: AC-3 and AC-4 already required the
  right behaviour. `src/lib/task-tick.ts` gains one exported function and its existing behaviour is
  unchanged; `allowed_paths` and `size` are unchanged. Amended by `tech-lead-design`.
