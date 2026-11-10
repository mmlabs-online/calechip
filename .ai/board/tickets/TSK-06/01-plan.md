---
ticket: TSK-06
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-18T20:06:00+0700
inputs_read:
  - .ai/board/tickets/TSK-06/ticket.yaml
  - .ai/board/ideas/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time.md
  - .ai/board/tickets/TSK-06/design/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time.png
  - .ai/board/tickets/TSK-06/design/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time-row-actions-1.png
  - .ai/board/tickets/TSK-06/design/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time-row-actions-2.png
  - .ai/board/tickets/TSK-06/design/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time-row-actions-3.png
  - .ai/registry/features.md (TSK-01 to TSK-06)
  - .ai/registry/decisions/ADR-062-a-task-may-carry-an-optional-time-of-day.md
  - .ai/registry/decisions/ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md (via ADR-062)
  - .ai/registry/glossary.md (Task, Overdue)
  - .ai/templates/plan.md
  - .ai/board/tickets/TSK-01/01-plan.md § 2
  - .ai/board/tickets/TSK-05/01-plan.md § 7
  - src/routes/Tasks.tsx
  - src/lib/domain/types.ts (Task, FailureCode, TASK_*_MAX)
  - src/lib/data/index.ts (CreateTaskInput, UpdateTaskInput, the TSK-01 seam block)
  - src/lib/data/supabase.ts (TaskRow, TASK_COLUMNS, toTask, taskText, updateTaskRow, the task methods)
  - src/lib/data/mock.ts (byTaskOrder, updateOwnTask, the task methods)
  - src/lib/week-tasks.ts
  - src/lib/period.ts (shiftDay, mondayIndex, weekLabel)
  - supabase/migrations/20261015120000_tsk01_task.sql
  - tests/tasks.test.ts (AC-20, AC-22)
  - tests/e2e/tsk-01-tasks.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# TSK-06 — plan

## 1. Problem and scope

**Implements, transcribed from `.ai/registry/features.md`:**

> **TSK-06** — The task page shows the week around the selected day, with progress, and a task may
> carry an optional time of day

SCOPE, as the row records it, each clause the operator's answer in the idea's § Evidence: the
arrangement of the attached mockup, a week strip, the day's list with a progress bar, an add form
under it and a week summary card, with every string in English (Q1); an optional time of day on a
task, empty by default, extra information only (Q2), driving nothing but display and the day's
order; that order is not-done before done, then timed tasks by time, then untimed by creation (Q5);
edit, delete, move to a date, the overdue list with "move all to today", and the PTO flag all kept
(Q4); edit, move and delete as three icon buttons at the right of each row, with tooltips (the
row-action images). Out: priority (Q3), a one-tap "move to tomorrow" (Q10), reminders (Q6, Q7).
Overdue stays by date alone (ADR-057 decision 7). Decided by ADR-062, `ACCEPTED by the operator`.

**Who gains what.** Every signed-in member (any role — a task is owned the same way by all) opening
`/tasks` sees, without stepping day by day, how their own week stands: which days hold tasks, which
are finished, how much is left. They can say *when* in a day a task falls, and a day's list puts what
is still open first and the timed items in time order. Nothing about who can read a task changes.

**Decisions this plan takes, each cheap to reverse.** The idea left these to PLAN as `product`'s
guesses; each is confirmed here unless stated.

1. **The week is Monday to Sunday containing the viewed day**, the calendar's week (`mondayIndex`).
2. **One strip cell per day** reads `✓` when the day has tasks and all are done, `done/total` when
   some are not, `–` when the day has none (the idea's guess, confirmed). A cell is a link to
   `/tasks/<that day>`.
3. **The strip's arrows move the viewed day by seven days**, so the weekday is kept.
4. **The day arrows of TSK-01 AC-2 stay**, moved beside the day card's heading. The mockup has none.
   They are kept because TSK-01 AC-2 is a shipped criterion and five end-to-end specs walk days with
   them; recorded in § 2b as the plan's own addition.
5. **The progress bar and the summary count the tasks as shown**, so a tick moves them at once — the
   same rule TSK-03's PTO-flag count follows.
6. **The day's order is applied when the list is read, not on a tick.** A ticked row stays where it
   is until the page next reads its list (TSK-01 AC-9, TSK-05 AC-7's precedent). A row that jumped
   under the pointer would take the focus with it and break TSK-05's "the box keeps focus".
7. **The time is entered with the browser's own time field** (`<input type="time">`, 24-hour value
   `HH:MM`), set, changed and cleared in the add form and the edit form. Move keeps it.
8. **The overdue list keeps its order** (oldest date, then creation) and shows a task's time beside
   its date chip when it has one.

**Out of scope.**

- Priority levels (Q3) — the mockup's *Cao / Vừa / Thấp* chips and picker are not drawn.
- A one-tap "move to tomorrow" (Q10), and the mockup's summary caption that announces it.
- Reminders, notifications or any behaviour driven by the time (Q6, Q7) — a separate idea that needs
  a scheduler ADR.
- An end time, a duration, an estimate or hours (ADR-062 decision 6).
- The time in any count, badge, warning or overdue test (ADR-062 decision 4): TSK-04's week badge,
  TSK-03's PTO warning and TSK-02's prompt read nothing new.
- A Vietnamese interface (Q1).
- The mockup's squirrel illustration beside the heading — no such asset exists in the app; a
  mascot is the design system's to add, not this ticket's.
- Anyone else's tasks, in any role (ADR-057).
- `.ai/standards/data-model.md`, `.ai/standards/rbac-and-security.md`, `.ai/00-charter.md` and
  ADR-057's `## Status` note — ADR-062 § *Affected documents*, human and standards plane; owed to
  `/thuki` with their text in § 6.

**`size_estimate: M`.** One additive migration, one field through the seam, one page rearranged.

## 2. Acceptance criteria

"Today" is the calendar date in `Asia/Ho_Chi_Minh` (TSK-01 § 1 decision 1). "The member" is any
signed-in, approved, not-removed person. "The viewed day" is the day in the address, or today. "The
week" is Monday to Sunday containing the viewed day. Selectors are in § 4.6. Every visible string
below is exact.

### The time of day — ADR-062

**AC-1 — add with or without a time**
- Given the member views today or a later day
- When they enter a title, optionally a note, optionally a time in `task-add-time`, and press
  `task-add-submit`
- Then the task is created with that time, or with no time when the field was left empty; the title,
  note and time fields are cleared; and a timed task's row shows its time as `HH:MM` (24-hour,
  `task-time`), while an untimed task's row shows no time element at all.

**AC-2 — edit sets, changes and clears the time**
- Given a task of the member's on any day, timed or not
- When they open its edit form (`task-edit`), which shows the current time in `task-edit-time` (empty
  when none), change or clear the time, and press `task-edit-save`
- Then the task shows the new time, or none when cleared, and keeps its date and done state; and
  `task-edit-cancel` leaves it unchanged.

**AC-3 — a move keeps the time**
- Given a task with a time
- When the member moves it to another date (TSK-01 AC-11)
- Then on that date it carries the same time.

**AC-4 — only a whole-minute time of day is accepted**
- Given any caller asks the seam to create or edit a task with a time that is not `HH:MM` on a
  24-hour clock (for example `24:00`, `7:05`, `14:00:30`, `noon`)
- When the write is attempted
- Then it is refused with `invalid_task_time` and nothing is written; on the page the message
  *Pick a time as HH:MM, or leave it empty.* is shown beside the time field.
- And an empty string is treated as no time, never refused.

**AC-5 — the time drives nothing else**
- Given a task dated today with a time earlier than the current time, not done
- When today's page, the overdue prompt (TSK-02), the week view badge (TSK-04) and the PTO warning
  (TSK-03) read it
- Then it is not overdue and not in `tasks-overdue`; the badge and the warning count it exactly as an
  untimed task; and no notification is created.

**AC-6 — the only time-bearing column** *(amends TSK-01 AC-20, per ADR-062 § Consequences)*
- Given the task table after every migration, and the `Task` domain type
- When they are read
- Then `time_of_day` (type `time`, nullable, whole minutes by `task_time_of_day_shape`) is the only
  column holding a time, and `timeOfDay` the only such field; neither has a column or field holding
  an end time, an interval, an estimate, a duration, hours worked or a reminder lead time.

**AC-7 — the time is the owner's like every other field**
- Given member A has a timed task T
- When a teammate, a manager of A's team, an admin of A's team, or an admin of another team lists
  tasks over T's date, or asks the seam to edit T's time
- Then the list holds none of A's tasks and the edit is refused with `task_not_permitted` — TSK-01
  AC-16 and AC-17, unchanged, with the new column included.

### The day's order — ADR-062 decision 5

**AC-8 — the order of one day's list** *(amends TSK-01 AC-1, AC-6 and AC-22)*
- Given a day holding, in creation order: untimed not-done U1, timed 16:30 not-done A, untimed done
  D1, timed 09:30 done B, timed 14:00 not-done C, untimed not-done U2
- When the page reads that day, or a caller lists tasks over a range including it
- Then the day's tasks come in the order C, A, U1, U2, B, D1: not-done before done; within each,
  timed first by ascending time, then untimed by creation; ties by creation, then id. Across days, the
  range read stays ordered by date first.

**AC-9 — a tick does not reorder until the next read** *(amends TSK-01 AC-9)*
- Given the day's list as AC-8 shows it
- When the member ticks C
- Then C shows done at once and stays where it is; the next time the page reads the list (a
  navigation, an edit, a move, an add, a delete, a reload) C sits in the done group by AC-8's rule.

**AC-10 — the overdue list keeps its order**
- Given overdue tasks, some timed
- When `tasks-overdue` renders
- Then its order is TSK-01 AC-13's (oldest date first, then creation), not AC-8's, and each timed
  row shows its time after its date chip.

### The week strip

**AC-11 — seven days, Monday to Sunday**
- Given the member views day D
- When the page renders
- Then `tasks-week-strip` shows `tasks-week-label` reading *Week* followed by the week's span in the
  calendar's form (for example *Week 27 Apr – 3 May 2026*), and seven `tasks-week-day` cells in order
  Monday to Sunday, each carrying `data-day` (`yyyy-MM-dd`), the weekday abbreviation (*Mon* … *Sun*)
  and the day of the month; the cell for D carries `aria-current="date"` and the selected look, and
  the cell for today, when in the week, carries `data-today="true"`.

**AC-12 — each day's mark**
- Given the member's own tasks in the week
- When the strip renders
- Then each cell's `tasks-week-day-mark` reads `✓` when that day has tasks and all are done,
  `done/total` (for example `1/3`) when some are not, and `–` when it has none; and the cell's
  accessible name says the same in words: *Monday 27 April, 2 of 2 tasks done*, *… 1 of 3 tasks
  done*, *… no tasks*.

**AC-13 — choosing a day and moving a week**
- Given the strip for the week of D
- When the member presses a cell, or `tasks-prev-week`, or `tasks-next-week`
- Then the page shows that cell's day, or D − 7, or D + 7, at `/tasks/<that day>`.

**AC-14 — the day arrows and Today stay** *(TSK-01 AC-2, unchanged in behaviour)*
- Given the member views day D
- When they press `tasks-prev-day`, `tasks-next-day` or `tasks-today`
- Then TSK-01 AC-2 holds as written: D − 1, D + 1, and today; `tasks-today` is absent when D is today.

### The day card

**AC-15 — the heading**
- Given the member views day D
- When the page renders
- Then `tasks-day-heading` (still carrying `data-day`) reads the day in TSK-01's form (*Wednesday, 29
  April 2026*), prefixed *Today · * when D is today; the PTO flag (TSK-03) sits beside it unchanged.

**AC-16 — the day's progress**
- Given the viewed day holds at least one task
- When the list renders, and after each tick
- Then `tasks-day-progress` shows a bar filled to done ÷ total and the text `done/total`, with
  `data-done` and `data-total`, counting the tasks as shown (a tick changes it at once); and
  `tasks-day-progress` is absent when the day holds none (TSK-01 AC-4's empty state stands).

**AC-17 — the row**
- Given a task in the day's list or the overdue list
- When it renders
- Then it shows, top to bottom: the round tick box with the title (struck through when done) and the
  note under it (both as TSK-01 drew them); and, only when timed, a clock icon with the time; a done
  row is drawn on a muted background.

**AC-18 — the three row actions**
- Given any row, done or not, in either list
- When the pointer rests on the row, or keyboard focus is inside it, or the screen is narrower than
  the `md` breakpoint
- Then three icon buttons are visible at the row's right, in order: `task-edit` (a pencil, accessible
  name and tooltip *Edit task*), `task-move` (a right arrow, *Move to a date*), `task-delete` (a bin,
  *Delete task*); each tooltip shows on hover and on focus; the bin's hover state is the soft pink
  tint; and each opens TSK-01's existing edit, move and delete flows (delete keeps its confirmation).
- And at rest, on a pointer screen, with no focus inside, they are not visible.

**AC-19 — the add form under the list**
- Given the member views today or a later day
- When the page renders
- Then `task-add-form` sits under the list, inside the day card, with in order: the title field
  (placeholder *Add a task*), the note field (placeholder *Note (optional)*), and one line holding the
  time field (`task-add-time`, empty by default) on the left and `task-add-submit` (*Add*) on the
  right; on an earlier day TSK-01 AC-7 holds as written.

**AC-20 — the overdue section is where it was**
- Given today has overdue tasks
- When the member views today
- Then `tasks-overdue` sits inside the day card, above the day's list, as TSK-01 AC-13 to AC-15 and
  TSK-05 AC-7 say.

### The week summary

**AC-21 — the summary card**
- Given the member's own tasks in the week
- When the page renders, and after each tick
- Then `tasks-week-summary` is headed *This week*, shows a bar filled to done ÷ total with the text
  `done/total`, and two tiles: `tasks-week-done` (the number done, labelled *Done*, mint) and
  `tasks-week-left` (the number not done, labelled *Left*, peach), counting the tasks as shown; with
  no task in the week it shows `0/0`, an empty bar and two zeros.

**AC-22 — isolation of the week reads**
- Given member A and teammate B each hold tasks in the same week
- When A views `/tasks`
- Then every mark, progress and summary number counts A's tasks only.

**Invariants touched: `[]`.** Written explicitly. A task is not an entry and is in no absence count
(TSK-01 AC-21); the time enters no count (AC-5), so INV-04, INV-05 and INV-07 are not engaged — ADR-062
§ *Affected documents* reaches the same answer. INV-01, INV-02, INV-03 and INV-06 concern entries.

**Open questions.** None that block. Three values are this plan's own and cheap to argue with: the
strings *Week*, *This week*, *Done*, *Left*, *Edit task*, *Move to a date*, *Delete task* and the time
refusal sentence (translations of the mockup's, per Q1); decision 6 (a tick does not reorder); and
decision 4 (the day arrows kept).

### 2b. Visual reference

Visual reference: design/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time.png and design/…-row-actions-1.png, …-2.png, …-3.png — attached at TRIAGE by the operator.

Spent above: the strip (AC-11 to AC-13), the heading (AC-15), the day progress (AC-16), the row and
its time (AC-17), the three row actions in order with tooltips and the pink bin (AC-18), the add form
under the list with the time on the bottom line and *Add* at the right (AC-19), the summary card with
two tinted tiles (AC-21).

**What the plan does differently from the images, deliberately:** priority chips and picker dropped
(Q3); the summary's *move to tomorrow* caption dropped (Q10); the squirrel illustration not drawn
(§ 1 Out-of-scope); day arrows added beside the heading (§ 1 decision 4); *Back to today* absent while
viewing today, although the main image shows it there, because TSK-01 AC-2 says so and a control that
does nothing is noise. Strings in English (Q1).

**Layout the images do not settle, the Tech Lead's own:**

- **Frame.** The page widens from 640 to at most 1040 pixels, centred, 16-pixel gutter at phone width.
  Header row: *My tasks* (`h1`) with the subtitle *Plan your tasks by day and tick them off.* under
  it; `tasks-today` as the outline pill at the right of the header row.
- **Strip.** A card, full width: `tasks-prev-week` `‹` left, label centred, `tasks-next-week` `›`
  right; under them seven equal rounded cells in a grid (`grid-cols-7`). Each cell: weekday in small
  caps grey, day number bold, mark under it (mint `✓`, grey `–`, ink `done/total`). The selected cell
  is filled `ink` with white text; today's cell carries a small dot under the mark. At phone width the
  cells shrink, the weekday shortens to its first letter only if the cell is under 40 pixels.
- **Below the strip, two columns from `lg`**: the day card (flexible) and the summary card (fixed 260
  pixels) side by side, top-aligned; one column below `lg`, the summary under the day card.
- **Day card.** Heading row: `tasks-day-heading` and the PTO flag on the left, `tasks-prev-day` and
  `tasks-next-day` (32-pixel round arrows) on the right. Under it the progress bar (mint fill on the
  `field` track, rounded) with `done/total` at its right. Then the overdue section, then the rows as
  separate rounded bordered cards with an 8-pixel gap; the hovered row's border darkens to `ink-3`.
- **Add form.** A rounded `field`-tinted panel under the rows: title and note as white rounded
  inputs, then a line with the time input (white pill) and the primary pill *+ Add* at the right.
- **Time on a row.** `lucide` `Clock` at 12 pixels and the time in `text-xs` tabular figures, grey,
  on its own line under the note.
- **Tooltips.** A small dark (`ink`) label with white `text-xs`, under the button, shown on hover and
  on `focus-visible`, drawn by the page; the button's `aria-label` holds the same text.

## 3. Permission model

Unchanged from TSK-01 § 3 and ADR-057; ADR-062 decision 7 adds nothing to it.

| Action | Who | Where the check lives |
|--------|-----|------------------------|
| Read a task's time (lists, strip, summary) | The owner only | `task_select_own` policy; the seam passes no member |
| Set or clear a time on create | The creator, who becomes the owner | `task_insert_own`; `time_of_day` joins the insert column grant |
| Change or clear a time on edit | The owner only | `task_update_own`; `time_of_day` joins the update column grant |
| Read or write another member's task's time — teammate, manager, admin, any team | **Denied** | Same policies; refusal is `task_not_permitted` (AC-7) |
| Anonymous | **Denied** | No grant to `anon` (revoked again in the migration) |

The seam's `invalid_task_time` refusal is an affordance; `task_time_of_day_shape` and the `time` type
are the control. The page's hidden actions, the time field and the day arrows are affordances only.

## 4. Contract

### 4.1 Domain — `src/lib/domain/types.ts`

```ts
/** TSK-01, TSK-06. One task: the caller's own, always. ADR-062: one optional time of day, as extra
 *  information only; NO OTHER TIME-BEARING FIELD (end time, duration, estimate, hours, lead time). */
export interface Task {
  id: string;
  memberId: string;
  date: string; // yyyy-MM-dd
  title: string;
  note: string | null;
  timeOfDay: string | null; // "HH:MM", 24-hour, wall-clock Asia/Ho_Chi_Minh; null = no time (ADR-062)
  done: boolean;
  createdAt: string;
}

// FailureCode gains, after "invalid_task_note":
  // TSK-06. A time that is not "HH:MM" on a 24-hour clock — AC-4. Refused in the SEAM before the
  // request; the `time` type and `task_time_of_day_shape` (23514) are the control.
  | "invalid_task_time"
```

### 4.2 Seam inputs — `src/lib/data/index.ts`

```ts
export interface CreateTaskInput {
  date: string;
  title: string;
  note: string | null;
  /** TSK-06. Absent, null or "" = no time. Otherwise "HH:MM". */
  timeOfDay?: string | null;
}

/** A full replacement of title, note and time — never the date (moveTask). */
export interface UpdateTaskInput {
  title: string;
  note: string | null;
  /** TSK-06. Required: null or "" clears the time. */
  timeOfDay: string | null;
}
```

No method is added, removed or renamed. Changed doc comments:

- `listTasks(from, to)` — ordered `date`, then `done` (false first), then `timeOfDay` ascending with
  null last, then `createdAt`, then `id` (AC-8). Everything else unchanged.
- `listOverdueTasks(today)` — order unchanged (AC-10).
- `createTask`, `updateTask` — refuse in the order title, note, time, then (create only) date.
- `moveTask` — writes the date only; the time is kept (AC-3).

### 4.3 Shared rules, repeated in `supabase.ts` and `mock.ts` (the file's own pattern)

```ts
const TASK_TIME_INVALID = "Pick a time as HH:MM, or leave it empty.";

/** AC-4. "" and null are no time; "HH:MM" 00:00..23:59 is a time; anything else refuses. */
function taskTime(
  value: string | null | undefined,
): { ok: true; timeOfDay: string | null } | { ok: false; error: Failure } {
  if (value === undefined || value === null || value === "") return { ok: true, timeOfDay: null };
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    return { ok: false, error: { code: "invalid_task_time", message: TASK_TIME_INVALID } };
  }
  return { ok: true, timeOfDay: value };
}
```

### 4.4 Real seam — `src/lib/data/supabase.ts`

```ts
interface TaskRow { /* … as today … */ time_of_day: string | null; }   // Postgres returns "HH:MM:SS"
const TASK_COLUMNS = "id, member_id, date, title, note, time_of_day, done, created_at";
// toTask: timeOfDay: row.time_of_day === null ? null : row.time_of_day.slice(0, 5)
// updateTaskRow values gain: time_of_day?: string | null
// listTasks: .order("date").order("done").order("time_of_day", { nullsFirst: false })
//            .order("created_at").order("id")
// createTask insert: { date, title, note, time_of_day }
// updateTask: updateTaskRow(taskId, { title, note, time_of_day })
// listOverdueTasks, moveTask, setTaskDone, deleteTask: unchanged apart from TASK_COLUMNS.
```

### 4.5 Mock seam — `src/lib/data/mock.ts`

```ts
// createTask row gains timeOfDay; updateTask writes { title, note, timeOfDay }; updateOwnTask's
// values type gains timeOfDay?: string | null.
// listTasks sorts by `byDayOrder`; listOverdueTasks keeps `byTaskOrder`.
const byDayOrder = (a: Task, b: Task): number =>
  a.date !== b.date ? (a.date < b.date ? -1 : 1)
  : a.done !== b.done ? (a.done ? 1 : -1)
  : a.timeOfDay !== b.timeOfDay
    ? a.timeOfDay === null ? 1 : b.timeOfDay === null ? -1 : a.timeOfDay < b.timeOfDay ? -1 : 1
  : byTaskOrder(a, b);
```

### 4.6 Pure helpers — `src/lib/week-tasks.ts` (extended; `taskTalliesFor` reused)

```ts
/** TSK-06 AC-11. The seven yyyy-MM-dd days, Monday first, of the week holding `day`. */
export function weekDaysOf(day: string): string[];

/** TSK-06 AC-12. "✓" when total > 0 and done === total; "done/total" when total > 0; "–" (U+2013) otherwise. */
export function stripMark(tally: DayTaskTally | undefined): string;

/** TSK-06 AC-12. "Monday 27 April, 2 of 2 tasks done" / "…, no tasks". */
export function stripCellLabel(day: string, tally: DayTaskTally | undefined): string;

/** TSK-06 AC-21. Sum over the map; { done: 0, total: 0 } when empty. */
export function weekTotals(tallies: ReadonlyMap<string, DayTaskTally>): DayTaskTally;
```

### 4.7 The page — `src/routes/Tasks.tsx`

- **One read for the list, the strip and the summary:** `seam.listTasks(weekDaysOf(day)[0],
  weekDaysOf(day)[6])`, replacing `listTasks(day, day)`. The day's list is that result filtered to
  `date === day`, in the seam's order. `LoadState.ready` gains `week: Task[]` (the whole read) and
  keeps `tasks` (the day) and `overdue`. Tallies are `taskTalliesFor(week.map(ticker.shown), …)`, so
  counts follow a tick (§ 1 decision 5).
- `ticker`'s `applyOutcome` is applied to `week` as well as `tasks` and `overdue`.
- `rowKey` gains `timeOfDay`.
- `Field` gains `"time"`; `fieldOf` maps `invalid_task_time` → `"time"`; `Errors` gains `time`.
- `AddTaskForm` sends `timeOfDay: time` (the field's value, `""` when empty); clears it on success.
- `TaskRow` edit form sends `{ title, note, timeOfDay: time }`, opening with `task.timeOfDay ?? ""`.

**Selectors.** Every TSK-01..05 `data-testid` is kept with its meaning. New:

| `data-testid` | Element | Attributes |
|---|---|---|
| `tasks-week-strip` | the strip card | — |
| `tasks-week-label` | the week span | — |
| `tasks-prev-week`, `tasks-next-week` | the strip's arrows | `aria-label` *Previous week*, *Next week* |
| `tasks-week-day` | each of the 7 cells (a link) | `data-day`, `data-today="true"` on today, `aria-current="date"` on the viewed day, `aria-label` per AC-12 |
| `tasks-week-day-mark` | the mark inside a cell | — |
| `tasks-day-progress` | the day's bar and text | `data-done`, `data-total` |
| `tasks-week-summary` | the summary card | `data-done`, `data-total` |
| `tasks-week-done`, `tasks-week-left` | the two tiles' numbers | — |
| `task-time` | a row's time | `data-time="HH:MM"` |
| `task-add-time`, `task-edit-time` | the time inputs (`type="time"`) | `aria-label` *Time (optional)* |

`task-field-error` gains `data-field="time"`.

## 5. Seam impact

**No function is added, removed or renamed; the seam-parity test is unaffected.** Shapes change:
`Task` gains `timeOfDay`; `CreateTaskInput` gains optional `timeOfDay`; `UpdateTaskInput` gains
required `timeOfDay`; `FailureCode` gains `invalid_task_time`. Behaviour changes: `listTasks`' order
(AC-8), and `createTask` / `updateTask` refuse `invalid_task_time`. Both implementations change
together (§ 4.4, § 4.5), and the mock's order reproduces the real `order by` clause for clause.

Callers of `listTasks` outside the page — `WeekView.tsx` (TSK-04 badge) and `PtoTaskWarning.tsx`
(TSK-03) — only count, so the new order changes nothing they show. Callers of `updateTask` outside
the page are tests only (`tests/tasks.test.ts`), which pass `timeOfDay: null`.

**Constructors of `Task`** — *added 2026-10-18T20:09, missed at first writing (99-questions.md).*
A required field on a shared interface reaches every object literal typed as it, not only the seam's
callers. Three test fixture builders outside the files above build `Task` literals for pure
functions: `fake` in `tests/overdue-prompt.test.ts`, `task` in `tests/pto-tasks.test.ts` and `task`
in `tests/task-tick.test.ts`. Each gains exactly one line, `timeOfDay: null,` after `note`, and
nothing else in them changes.

## 6. Schema delta

**Not `none`.** ADR-062, `ACCEPTED by the operator`. New file
`supabase/migrations/20261018120000_tsk06_task_time_of_day.sql`, additive and idempotent (ADR-024),
in one transaction:

```sql
begin;
alter table public.task add column if not exists time_of_day time without time zone null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'task_time_of_day_shape') then
    alter table public.task add constraint task_time_of_day_shape
      check (time_of_day is null or extract(second from time_of_day) = 0);
  end if;
end $$;
revoke all on public.task from anon, authenticated;
grant select, delete on public.task to authenticated;
grant insert (date, title, note, time_of_day) on public.task to authenticated;
grant update (date, title, note, done, time_of_day) on public.task to authenticated;
commit;
```

It touches a constraint and grants, so it is not `none` (ADR-014). No policy, function, trigger,
view or publication is created or altered (ADR-062 decision 7). The TSK-01 migration is not edited.
`supabase/db.sql` holds no `task` table today (TSK-01 did not level it), so nothing is brought level
here. **Applying the migration is human (RULE-09).**

**Owed to `/thuki`, human and standards plane, not in `allowed_paths`:** ADR-057 `## Status` gains
*"Decision 6's time-of-day clause and revert condition 2, as to a time of day, SUPERSEDED by
ADR-062"*; `data-model.md` gains the `task` entity with `time_of_day time null`, the check, and the
order of ADR-062 decision 5; `rbac-and-security.md` adds `time_of_day` to the task grant lists if it
lists them; the charter's no-time sentence reads as ADR-062 § *Affected documents* gives it.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/glossary.md"
  - "supabase/migrations/20261018120000_tsk06_task_time_of_day.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/week-tasks.ts"
  - "src/routes/Tasks.tsx"
  - "tests/tasks.test.ts"
  - "tests/week-tasks.test.ts"
  - "tests/task-time.test.ts"
  - "tests/e2e/tsk-06-task-week.spec.ts"
  - "tests/e2e/tsk-01-tasks.spec.ts"
  - ".ai/registry/decisions/ADR-062-a-task-may-carry-an-optional-time-of-day.md"
  - "tests/overdue-prompt.test.ts"
  - "tests/pto-tasks.test.ts"
  - "tests/task-tick.test.ts"
```

**`tests/overdue-prompt.test.ts`, `tests/pto-tasks.test.ts`, `tests/task-tick.test.ts`** — *added
2026-10-18T20:09.* One line each, `timeOfDay: null,` in the fixture builder's `Task` literal (§ 5,
*Constructors of `Task`*). No assertion, import or comment changes; in `pto-tasks.test.ts` the line
sits before `...over`.

**ADR-062:** listed because it is this ticket's schema ADR, drafted at /triage and ACCEPTED by the
operator, and it ships in this ticket's PR; the Developer does not edit it.

**Glossary:** rows written for *Task* (amended: the "carries no time of day" clause, reversed by
ADR-062, with the old wording kept as the file does) and *Time of day* (new).

**`tests/tasks.test.ts`** carries TSK-01 AC-20's test, which is narrowed, not deleted (AC-6): the TSK-01
migration's columns stay asserted; a new assertion reads the TSK-06 migration for exactly one
time-bearing column, `time_of_day time`, and no `interval`, `timetz`, duration, estimate, hours or
lead-time column; the `Task` key list gains `timeOfDay`. Its `updateTask` calls gain `timeOfDay:
null`. **`tests/e2e/tsk-01-tasks.spec.ts`** is listed only for AC-9's amendment, should a check of the
row order after a reload need it.

**Seventeen paths: `size: L`, disagreeing with `size_estimate: M`.** *Until 2026-10-18T20:09:
"Fourteen paths: `size: M`, agreeing with `size_estimate: M`", and the paragraph below.* By the
operating model's table and the EVT-03 to EVT-12 precedent ("a thirteenth path makes this L") this
ticket was `L` from its thirteenth path; the paragraph below counted only the files the Developer
writes, a convention no other plan uses, and it excused the count rather than measuring it. The gap
against the estimate is the shared-type ripple (§ 5) and the ADR carried into the PR. A split would
not remove the three fixture lines — they follow `types.ts` into whichever half carries the type.
Whether TSK-06 proceeds as `L` or splits is put to the operator.

*Superseded:* **Fourteen paths: `size: M`, agreeing with `size_estimate: M`.** *Until 2026-10-18T20:06: "Thirteen
paths".* The fourteenth is an already-written, ACCEPTED ADR carried into the PR, not a file the
Developer writes, so it changes neither the size nor the split answer: twelve source and test files
remain the build.

## 8. Rejected alternatives

1. **Order the day's list in the page, leave `listTasks` ordered by creation.** No seam behaviour
   change and no AC-22 amendment. Rejected: ADR-062 decision 5 states the order as a datastore
   `order by`, and putting it in the page leaves the mock and the real seam free to disagree with the
   page's sort — a second copy of the rule, outside the seam, that the parity tests cannot see.
2. **Re-sort on every tick, so a done task drops at once.** Matches Q5 more literally. Rejected (§ 1
   decision 6): the row moves under the pointer, the focused box is detached and loses focus (TSK-05
   relies on it keeping focus), and a mis-tap becomes a hunt for the row.
3. **Three reads: the day, the week and the overdue list.** Rejected: the day is inside the week, and
   two reads of the same rows can disagree mid-tick; one week read and a filter cannot.
4. **Drop the day arrows as the mockup does.** Rejected for now (§ 1 decision 4): it reverses a
   shipped criterion and rewrites five end-to-end specs for no gain the operator asked for; the strip
   already gives the shorter path.
5. **A bespoke `HH:MM` text field instead of `type="time"`.** Rejected: the native field gives the
   keyboard, the 24-hour value and validation for free; the seam still refuses anything malformed.

## Changelog

- `2026-10-18T19:54:57+0700` — sections 1 to 8 written. § 2 was drafted from the feature row, the
  idea and ADR-062 before the source was read; reading `Tasks.tsx` and `tests/e2e/` added § 1 decisions
  4 and 6 and AC-9, AC-14 (kept day arrows, no reorder on tick), and nothing was narrowed. Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.
- `2026-10-18T20:06:00+0700` — § 7 gains `.ai/registry/decisions/ADR-062-a-task-may-carry-an-optional-time-of-day.md`.
  Reason: the `/advance` checkpoint `8d7f0c7` carries that ADR (drafted at /triage, ACCEPTED by the
  operator) and `check-allowed-paths.mjs` failed on it; the operator chose to list it. Thirteen paths
  become fourteen; `size` stays M. Raised by the operator. Amended by `tech-lead-design`.
- `2026-10-18T20:09:49+0700` — § 5 gains *Constructors of `Task`*; § 7 gains
  `tests/overdue-prompt.test.ts`, `tests/pto-tasks.test.ts` and `tests/task-tick.test.ts`, one line
  each (`timeOfDay: null,`). Reason: § 4.1's required `timeOfDay` fails `tsc --noEmit` in all three
  fixture builders (reproduced); § 5 had checked seam callers, not type constructors. Making the field
  optional was rejected (99-questions.md). Fourteen paths become seventeen and `size` is corrected
  M → L: it was already L at thirteen by the table, and § 7's prose had counted around it. Raised by
  `developer`. Amended by `tech-lead-design`.
