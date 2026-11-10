---
ticket: TSK-04
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-17T16:40:00Z
inputs_read:
  - .ai/board/tickets/TSK-04/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md
  - .ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md
  - .ai/board/ideas/2026-10-12-a-member-has-nowhere-to-plan-their-own-day-and-an-absence-hides-what-was-due.md
  - .ai/standards/architecture.md
  - .ai/standards/ui-design-system.md
  - src/routes/WeekView.tsx
  - src/hooks/useViewedTeam.tsx
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/pto-tasks.ts
  - tests/e2e/tsk-03-pto-task-warning.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# TSK-04 — PLAN

## 1. Problem and scope

**Feature row, transcribed from `.ai/registry/features.md`:**

> | TSK-04 | The week view shows, in each day's header, how many of the viewer's own tasks are done out of the total | TSK | PLANNED | | From the same idea file and verdict as `TSK-01`, and `depends_on: [TSK-01]`. **SCOPE, each clause the operator's:** an icon and done/total, e.g. 5/10, on days that hold tasks (answer 7), in the week view only and not the month or year view (Q10). It counts the viewer's own tasks, never anyone else's, and never on another team's calendar viewed through ADR-040 (ADR-057 decision 4). It must not cost a row, since density wins on the grid (`CLAUDE.md` § *Visual direction*). It is not an absence count and never feeds `absenceCountsFor`. `schema_delta` none. `Invariants touched` is PLAN's. |

A **member** (any signed-in role, since a task is everyone's own) looking at their team's week can see,
without leaving the calendar, how much of each day's personal plan is done — the operator's answer 7,
*"Trên calendar hiện tại chỉ hiện cho thấy số lượng task và số lượng hoàn thành trong ngày (nếu có).
Ví dụ 'icon task' 5/10"*. It matters because the week is where a member plans absence: seeing "0/6"
on Thursday while looking at who is out on Thursday is the cheapest moment to notice a conflict, and
it costs nothing to members who keep no tasks because nothing is drawn for them.

**Out of scope:**
- A count on the month view or the year view (Q10, *"Week"*). Those screens are not opened.
- Listing, ticking, editing or creating tasks from the week view. The badge is read-only; the task
  page (`/tasks`, TSK-01) is the only write surface. The badge is not a link either — see § 8.
- Anyone else's tasks, for any role, on any team (ADR-057 decisions 1, 3, 4).
- Any badge on another team's calendar viewed through ADR-040, including the admin's own tasks
  (feature row; ADR-057 decision 4).
- Refreshing the count live when a task changes on another tab or page. It is read when the week loads.
- Overdue marking on the badge. "Overdue" is TSK-02's prompt and the task page's section, not this.
- Any input to `absenceCountsFor`, the overload warning, or the UIE-07 footer count.

`size_estimate: S` — one read already in the seam, one pure helper, one screen.

## 2. Acceptance criteria

The seeded viewer below is any signed-in member viewing **their own team's** week, `/week/<day>`, unless
an AC says otherwise. "The day's header" is the element `week-day-label` inside the `week-day` whose
`data-date` is that day.

**AC-1 — a day with tasks shows icon and done/total**
- Given the viewer owns 10 tasks dated D in the displayed week, 5 of them done
- When the week view finishes loading
- Then D's header contains `week-day-tasks` with the text `5/10`, an icon, and an accessible name of
  `5 of 10 tasks done`

**AC-2 — a day without tasks shows nothing**
- Given the viewer owns no task dated D
- When the week view finishes loading
- Then D's header contains no `week-day-tasks` element

**AC-3 — all done and none done**
- Given the viewer owns 3 tasks dated D, all done, and 2 tasks dated E, none done
- When the week view finishes loading
- Then D's badge reads `3/3` and E's badge reads `0/2`; both are shown (a day with tasks always shows
  its badge, whatever the ratio)

**AC-4 — each day counts only its own date**
- Given the viewer owns tasks dated Monday, Wednesday and the following Monday
- When the week of the first Monday finishes loading
- Then Monday's and Wednesday's badges count only their own day's tasks, and no day of the displayed
  week counts the following Monday's task

**AC-5 — another member's tasks are never counted**
- Given member A owns 2 tasks dated D, and member B on the same team owns 4 tasks dated D
- When B views the week containing D
- Then D's badge reads `n/4` for B's own tasks only; and when A views it, `m/2`
- And a member who owns no tasks sees no `week-day-tasks` anywhere, whatever their teammates own

**AC-6 — admins and managers see only their own**
- Given a teammate owns tasks dated D and the admin (or manager) of the team owns none
- When the admin (or manager) views their own team's week containing D
- Then no `week-day-tasks` is shown on D

**AC-7 — no badge on another team's calendar (ADR-040)**
- Given an admin owns tasks dated D, and views another team's week containing D through the team picker
- When that week finishes loading
- Then no `week-day-tasks` element is shown on any day
- And switching back to the admin's own team shows the badge on D again

**AC-8 — month and year views show no count**
- Given the viewer owns tasks dated D
- When the viewer opens the month view and the year view containing D
- Then neither screen contains a `week-day-tasks` element, or any task count

**AC-9 — the badge costs no row**
- Given the viewer owns tasks dated D, and owns none dated E, both in the displayed week and neither a
  holiday nor a bridge day
- When the week view finishes loading
- Then D's `week-day-label` and E's `week-day-label` have the same rendered height
- And D's badge sits on the same line as D's `dd/MM` date (the same parent element)

**AC-10 — the count reflects ticks made on the task page**
- Given the viewer owns 2 not-done tasks dated D and D's badge reads `0/2`
- When the viewer ticks one done on `/tasks` and returns to the week view through the sidebar
- Then D's badge reads `1/2`

**AC-11 — the absence count is unchanged by tasks**
- Given the viewer owns tasks dated D
- When the week view finishes loading
- Then D's `week-day`'s `data-count` and `week-day-count` text are exactly what they are with no tasks

**AC-12 — a failed task read does not cost the grid, and says so**
- Given the task read fails (throws)
- When the week view loads
- Then every day, row and count of the grid is drawn as normal, no `week-day-tasks` is shown, and
  `week-tasks-unavailable` is shown with the text `Your task counts could not be loaded.`
- And when the task read succeeds, `week-tasks-unavailable` is absent

**AC-13 — a signed-out visitor or a member with no team sees no badge**
- Given the week view shows `week-not-on-a-team` or `week-unavailable`
- Then no `week-day-tasks` and no `week-tasks-unavailable` is shown

**Invariants touched:** `[]`. INV-04 (one definition of an absence count) is the nearest, and it is
not engaged: tasks are not entries, the tally is computed by a separate function over a separate read,
and AC-11 holds the absence count unchanged. INV-05 and INV-07 concern entries only. ADR-057's
owner-only rule is a decision, not a registry invariant, and is held by § 3.

**Open questions:** none.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

The layout, as decided here:

- The badge sits **on the date line** of the day header — the existing centred row holding the
  optional `Today` pill and `dd/MM` — **after the date**, separated by the same `gap-1`. That line is
  a `flex` row already; the weekday name stays alone on its line. The SOLO 2026-09-11 note in
  `WeekView.tsx` records that a third stacked child of the label cost a line; this shape does not add
  a child to the stack.
- Content: the `ListChecks` icon (already the task icon in `PtoTaskWarning.tsx`) at 12px, then
  `done/total` in `text-[11px]` tabular figures. Worst case on today's column, `TODAY 11/09 ✓10/10`,
  fits the ~161px column.
- Colour: neutral ink at reduced opacity, matching the date beside it, with **no** peach, mint,
  lavender or pink — each already means something about a day (`ui-design-system.md`; UIE-06 § 4.6).
  When all are done the text is not recoloured; the ratio says it.
- `week-tasks-unavailable` sits where `week-events-unavailable` sits, as a second `text-xs` status line.

## 3. Permission model

| Action | Member | Manager | Admin | Where enforced |
|---|---|---|---|---|
| See own task tally on own team's week | yes | yes | yes | RLS `task_select_own` (`member_id = auth.uid()`), via `listTasks` |
| See another member's tasks or tally | **no** | **no** | **no** | RLS; no other read path exists (ADR-057 decisions 2, 3) |
| See any tally on another team's week (ADR-040) | n/a | n/a | **no** | Client: the read is not issued when `viewed.kind !== "own"`. RLS would still return only the admin's own rows; the client gate enforces the feature row's "never on another team's calendar", which is a display rule, not a privacy one |
| Change a task from the week view | **no** | **no** | **no** | No write is imported or called; `/tasks` remains the only write surface |

The privacy boundary lives entirely server-side in the TSK-01 policies, which this ticket does not
touch. The cross-team suppression is a presentation rule and correctly lives in the screen.

## 4. Contract

### 4.1 New pure module `src/lib/week-tasks.ts`

```ts
// TSK-04 — the viewer's own done/total per day of a week. Pure: no React, no seam, no clock.
import type { DateRange, Task } from "@/lib/domain/types";

/** One day's tally. `total >= 1` always — a day with no task has no entry. */
export interface DayTaskTally {
  done: number;
  total: number;
}

/** AC-1..AC-4. For each date in `range` (inclusive) that holds at least one task in `tasks`, its
 *  tally. Tasks outside `range` are ignored. Days without tasks are absent from the map. Pure; does
 *  not mutate its input. Does not filter by owner — `listTasks` returns only the caller's rows. */
export function taskTalliesFor(
  tasks: readonly Task[],
  range: DateRange,
): ReadonlyMap<string, DayTaskTally>;

/** AC-1. The badge's visible text: `${done}/${total}`. */
export function tallyText(tally: DayTaskTally): string;

/** AC-1. The badge's accessible name: `${done} of ${total} tasks done`; "task" when total === 1. */
export function tallyLabel(tally: DayTaskTally): string;
```

### 4.2 `src/routes/WeekView.tsx`

State: the `ready` phase of `View` gains two fields, set the way `events` and `eventsFailed` are.

```ts
tasks: Task[];          // [] until read, and always [] when viewed.kind !== "own"
tasksFailed: boolean;   // true only when the task read threw
```

Load order (inside `load`, after `setView({ phase: "ready", … })`): the task read runs **in the same
post-grid block as the event layer, in parallel with it, but caught separately**, so one layer's
failure never hides the other's. Only when `viewed.kind === "own"`:

```ts
const tasks = await seam.listTasks(range.start, range.end);
```

On throw: `tasksFailed: true`, `tasks` stays `[]`. Stale-load guard (`stale()`) applies as to events.

Render:

```ts
const tallies = useMemo(
  () => (view.phase === "ready" && range ? taskTalliesFor(view.tasks, range) : new Map()),
  [view, range],
);
```

Inside the date-line `<span className="flex items-center justify-center gap-1">`, after the date span:

```tsx
{tally ? (
  <span data-testid="week-day-tasks" data-done={tally.done} data-total={tally.total}
        aria-label={tallyLabel(tally)} title={tallyLabel(tally)} …>
    <ListChecks aria-hidden … />{tallyText(tally)}
  </span>
) : null}
```

Beside `week-events-unavailable`:

```tsx
{view.tasksFailed ? (
  <p data-testid="week-tasks-unavailable" role="status" className="text-xs text-ink-3">
    Your task counts could not be loaded.
  </p>
) : null}
```

### 4.3 Selectors

| `data-testid` | Element | Attributes |
|---|---|---|
| `week-day-tasks` | the badge, inside `week-day-label` | `data-done`, `data-total`, `aria-label` |
| `week-tasks-unavailable` | status line, AC-12 | — |

Every existing `data-testid` in `WeekView.tsx` is unchanged.

## 5. Seam impact

**None.** `listTasks(from, to)` exists in the interface (`src/lib/data/index.ts:1557`) and in both
implementations with owner-only filtering; it is called as is. No seam file is in `allowed_paths`.

AC-12's failure path is not drivable in e2e — the mock has no fault switch and adding one is a seam
change (the same limit TSK-03's spec records). It is held by the structure in § 4.2 and by a unit test
of `taskTalliesFor` on `[]`; the e2e spec covers the success paths.

## 6. Schema delta

`none`. No table, policy, trigger or constraint is touched. `requires_adr: true` stands only because
ADR-057 (accepted) governs the feature; no new ADR is owed.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/week-tasks.ts"
  - "src/routes/WeekView.tsx"
  - "tests/week-tasks.test.ts"
  - "tests/e2e/tsk-04-week-task-badge.spec.ts"
```

`glossary_owed` is `[]` (the terms *Task* and *Overdue* were written by TSK-01), so the glossary is
not on this list.

`size: S` — four paths, two of them new tests. Agrees with `size_estimate`.

## 8. Rejected alternatives

**1. Put the tally in the day's footer strip beside the UIE-07 absence count.** Plausible because the
footer already holds a small number. Rejected: it places a personal count next to the team's absence
count in the same visual form, inviting a reader to add or compare them — the confusion the feature
row names ("It is not an absence count"). The header, where the operator's answer and the row put it,
keeps them apart.

**2. Read tasks in the main `Promise.all` with roster and entries.** One round trip fewer in latency
terms. Rejected: a failure there sends the whole screen to `week-unavailable`, so a broken private
task read would hide the team's absences — a personal convenience costing the shared screen. The
event layer's post-grid, separately caught read is the established pattern for a non-count layer.

**3. Make the badge a link to `/tasks` on that day.** Cheap and useful. Rejected for this ticket: no
operator answer asks for it, the task page's URL does not carry a day today (TSK-01 opens on today
with in-page navigation), and adding a day parameter would widen scope into `Tasks.tsx`. A later
idea can add it.

## Changelog

- 2026-10-17T16:40:00Z — first version. Sections 1 and 2 written from the feature row, the idea file
  and ADR-057 before the source tree was read. On reading `WeekView.tsx`, AC-9 gained its second
  clause (same parent as the date) after the SOLO 2026-09-11 note showing a stacked child costs a
  line; AC-12 was added on finding the event layer's separately-caught pattern, as a refusal that the
  first draft omitted. No AC was narrowed. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
