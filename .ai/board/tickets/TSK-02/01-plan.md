---
ticket: TSK-02
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-17T20:14:23+0700
inputs_read:
  - .ai/board/tickets/TSK-02/ticket.yaml
  - .ai/board/ideas/2026-10-12-a-member-has-nowhere-to-plan-their-own-day-and-an-absence-hides-what-was-due.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/steward/context.md
  - .ai/board/tickets/TSK-01/01-plan.md
  - .ai/board/tickets/TSK-05/01-plan.md
  - src/App.tsx
  - src/main.tsx
  - src/hooks/useSession.ts
  - src/components/AppShell.tsx
  - src/components/Modal.tsx
  - src/routes/Tasks.tsx
  - src/lib/task-tick.ts
  - src/lib/data/mock.ts
  - eslint.config.js
  - tests/e2e/tsk-01-tasks.spec.ts
  - tests/e2e/tsk-05-optimistic-tick.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# TSK-02 — Each time the app opens, a member is shown their overdue tasks

## 1. Problem and scope

Transcribed from `.ai/registry/features.md`, `## TSK — Tasks`, without paraphrase:

| ID | Story | Group | Status |
|---|---|---|---|
| TSK-02 | Each time the app opens, a member is shown their overdue tasks and can tick them or move them all to today | TSK | PLANNED |

The row's scope, each clause the operator's: a prompt every time the app opens while any of the
member's own tasks is overdue (answer 2, Q9-B); it offers ticking each done or moving all of them to
today (answer 2). Overdue means the date has passed and the task is not done (F1). It lists only the
viewer's own tasks (ADR-057). `schema_delta` none. `depends_on: [TSK-01]` — `DONE`, on `origin/main`.

The operator's words, answer 2: *"khi bật app lên mà task trước thứ 3 còn chưa tick done thì hiện
thông báo cho user để tick hoàn thành hoặc cho 1 option move tất cả qua thứ 3"*; Q9: *"B: Mỗi lần mở
app"*.

**Who gains what.** Every member — whatever their role — today learns that something slipped only if
they go to `/tasks` and look at its overdue section. Work that is not looked at quietly drops, which is
half of the idea's problem statement. This ticket puts the slipped work in front of the member at the
one moment they are certain to be present — opening CaleChip — and makes the two common answers, *I did
it* and *I'll do it today*, one press each.

**What PLAN reads into the operator's words, stated so it can be argued with.**

1. **"Opening the app" is the signed-in shell coming up for a member after a page load or a sign-in.**
   A page load is opening CaleChip, reloading it, or opening it in a new tab. Moving between screens
   inside the app is not an opening; neither is the session being re-read in place (a profile save,
   `refreshMembership`), nor the date turning over while the app stays open.
2. **The prompt can be closed without acting, and comes back at the next opening while anything is
   still overdue.** Q9-B dropped A's *"dismissable"* in the sense of *once a day*, not in the sense of
   *cannot be closed*: a dialog that cannot be closed would stop the member using the app until they
   answered it, and `CLAUDE.md` says a warning here never blocks an action.
3. **"Move all" moves the tasks the prompt shows as not done at the moment of the press.** A task
   ticked done in the prompt is no longer overdue (glossary *Overdue*) and stays on its date.
4. **"Today" is `eventToday()`, the calendar date in `Asia/Ho_Chi_Minh`** — TSK-01 § 1 decision 1,
   unchanged; the glossary row *Overdue* records the same clock.

**Out of scope.**

- **Editing, deleting or moving a single task from the prompt.** The operator named two actions; the
  rest stay on `/tasks` (TSK-01 AC-10 to AC-12).
- **Moving overdue tasks to any day other than today** — answer 2 says today.
- **Showing the prompt again when the date turns over while the app is open**, or on any timer.
- **A "don't show again" or "not today" setting**, or remembering a dismissal across openings (Q9-B
  chose every opening over A's once a day).
- **Any change to `/tasks`' own overdue section** (TSK-01 AC-13 to AC-15, as amended by TSK-05 AC-9),
  beyond reloading after the prompt changed something (AC-10).
- **Any reader but the owner** (ADR-057). No admin or manager is ever told about another person's
  overdue tasks.
- **Notifications, e-mail or the notification bell.** The prompt is on screen only; ADR-057 decision 3
  keeps tasks out of every pipe.
- **The PTO warning** (`TSK-03`) and **the week badge** (`TSK-04`).
- **A bulk seam write.** "Move all" is the existing `moveTask`, once per task (§ 8, alternative 1).

`size_estimate: S` — one dialog in the shell, one small pure module, a one-line reload hook on
`/tasks`, no seam, schema or shared-type change.

## 2. Acceptance criteria

"Today" is `eventToday()` at the moment the prompt reads (§ 1, reading 4). "The member" is any
signed-in, approved, not-removed person — member, manager or admin alike. "Overdue" is the glossary's:
dated before today and not done. Selectors are in § 4.4.

### When it shows

**AC-1 — shown at opening when something is overdue**
- Given a member who has one or more overdue tasks
- When they open the app on any screen inside the shell, by loading the page or by signing in
- Then the dialog `overdue-prompt` is shown over that screen, headed *You have N overdue tasks* (*1
  overdue task* when N is 1, N in `overdue-prompt-count`), and lists every overdue task of theirs —
  whatever its date — oldest date first, then in creation order; each row (`overdue-prompt-row`) shows
  its date (`overdue-prompt-date-chip`, *Mon 12 Oct*) and its title, and none shows a time.

**AC-2 — not shown when nothing is overdue**
- Given a member whose tasks are all done or dated today or later, or who has no task at all
- When they open the app
- Then no `overdue-prompt` is shown, and the screen behaves exactly as it did before this ticket.

**AC-3 — once per opening**
- Given the prompt was shown at an opening, whether it was then answered or closed
- When the member moves between screens inside the app, or their session is re-read in place (saving
  their profile)
- Then the prompt is not shown again.
- And given they then reload the page, or sign out and sign in again, while one or more tasks are still
  overdue, then the prompt is shown again (Q9-B).

**AC-4 — never blocks**
- Given the prompt is shown
- When the member presses `overdue-prompt-close`, presses Escape, or presses the backdrop
- Then the prompt closes, no task changes because it closed, and the screen beneath is usable.

### Tick each done

**AC-5 — tick and untick in the prompt**
- Given the prompt lists an overdue task
- When the member ticks its box (`overdue-prompt-done`), and may later untick it
- Then the row is shown done (title struck through, `data-done="true"`) at once, before the server
  answers, and then not done; the task stays in the prompt in its place; `overdue-prompt-count` counts
  the rows shown not done; and the change persists — `/tasks` shows the task's new state.

**AC-6 — a refused tick is put back**
- Given the member ticks or unticks a task in the prompt
- When the write is refused or fails
- Then the row returns to the state the server holds and shows the failure's sentence under it
  (`overdue-prompt-row-error`); the last of several presses on one box is the one stored, and only its
  failure is shown — TSK-05 AC-3 to AC-5, applied to the prompt.

### Move all to today

**AC-7 — move all**
- Given the prompt lists overdue tasks, some of which the member may have ticked done in it
- When they press `overdue-prompt-move-all` (*Move all to today*)
- Then every task shown not done at that moment is re-dated to today, keeping its title, note and done
  state; the tasks shown done keep their dates; and when every move succeeds the prompt closes. The
  moved tasks are then in today's list on `/tasks` and in no overdue list.

**AC-8 — move all with a failure**
- Given the member presses *Move all to today*
- When one or more of the moves is refused or fails
- Then the tasks that moved leave the prompt, the ones that did not stay in it with the failure's
  sentence under each (`overdue-prompt-row-error`), and the prompt stays open; pressing *Move all to
  today* again tries only the tasks still shown not done.

**AC-9 — nothing left to move**
- Given every task in the prompt is shown done
- When the prompt renders
- Then `overdue-prompt-move-all` is disabled, and `overdue-prompt-close` closes the prompt.
- And while a *Move all* is in progress, `overdue-prompt-move-all` is disabled.

### Everything else

**AC-10 — `/tasks` agrees once the prompt closes**
- Given the prompt was opened over `/tasks` (any day), and a task was ticked, unticked or moved in it
- When the prompt closes
- Then the page beneath shows the tasks as they now stand — a moved task in today's list and out of
  the overdue section, a ticked task shown done — without the member reloading.

**AC-11 — the viewer's own tasks only**
- Given a manager or an admin whose teammates, or members of any team they can view, have overdue
  tasks, and who has none of their own
- When they open the app
- Then no prompt is shown; and in every case the prompt lists the opener's own tasks and nobody
  else's (ADR-057 decisions 1 and 4).

**AC-12 — a failed read shows nothing**
- Given the overdue read fails at opening
- When the app comes up
- Then no prompt is shown and nothing else on the screen changes; the next opening reads again.

**AC-13 — no other effect**
- Given the prompt is shown, answered or closed
- When the absence count, the overload warning, the notification bell and the week, month and year views
  read any day
- Then each gives exactly what it gave before: the prompt writes only `done` and `date` on the
  member's own tasks, through `setTaskDone` and `moveTask`.

**Invariants touched: `[]`.** Written explicitly. A task is not an entry and is in no absence count
(TSK-01 AC-21, ADR-057 § *Affected documents*), so INV-04, INV-05 and INV-07 are not engaged; INV-01,
INV-02, INV-03 and INV-06 are about entries, and nothing here writes one.

**Open questions.** None that block. Two readings in § 1 are this plan's and cheap to argue with:
reading 1 (a sign-in counts as an opening; a profile save does not) and reading 2 (the prompt can be
closed). If the operator meant *cannot be closed until answered*, AC-4 is the one criterion that
changes.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image exists in `.ai/board/tickets/TSK-02/design/`, and the idea file carries none.

- **Frame.** The existing `Modal` (`testIdPrefix="overdue-prompt"`): blurred backdrop, `rounded-card`
  white card at most 512 pixels wide, the round close button top right. At phone width it fills the
  width less a 16-pixel gutter.
- **Header.** A small soft-pink pill (`bg-overload`, the palette's *needs attention, not alarm*
  colour, as `/tasks`' overdue section uses) holding a check-list glyph, then an `h1` in the rounded
  face: *You have 3 overdue tasks*. Under it one grey line: *Tick what you finished, or bring the rest
  to today.*
- **List.** The `/tasks` row look, compressed: a round checkbox on the left (mint when ticked), the
  date chip in small grey (*Mon 12 Oct*), then the title in `text-sm` bold on one line, truncated with
  an ellipsis. No note, no Edit/Move/Delete. A done row is struck through and greyed and does not move.
  The list scrolls inside the card past about six rows. A row's error sits under it in small red.
- **Footer.** Left to right: the primary pill *Move all to today*, then the outline pill *Close*
  (`overdue-prompt-dismiss`, the same as the round close control). Stacked full width at phone width,
  primary on top.
- **Charm, sparingly.** None beyond the header pill — this dialog stands between the member and the
  screen they opened, so it is short and gets out of the way.

## 3. Permission model

**Nothing new is decided here.** The prompt reads through `listOverdueTasks` and writes through
`setTaskDone` and `moveTask`, all three TSK-01's, held by the four owner-only policies on `public.task`
(TSK-01 § 3, ADR-057 decision 2): `member_id = (select auth.uid()) and
public.member_team_id((select auth.uid())) is not null`, with no admin, manager or team arm.

| Action | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|
| See own overdue tasks in the prompt | ✅ | ✅ | ✅ | `task_select_own` |
| See anyone else's overdue tasks, any team | ❌ | ❌ | ❌ **ADR-057 d.4** | `task_select_own`; `listOverdueTasks` takes no member |
| Tick, untick own task | ✅ | ✅ | ✅ | `task_update_own`, update grant on `done` |
| Move own task to today | ✅ | ✅ | ✅ | `task_update_own`, update grant on `date`; the seam's `task_date_past` cannot fire, since the target is today |
| Change anyone else's task | ❌ | ❌ | ❌ | `task_update_own`; zero rows → `task_not_permitted` |
| See the prompt while pending, rejected, removed or signed out | ❌ | ❌ | ❌ | the shell is not mounted for them (`App.tsx`); were it reached, `member_team_id` returns no rows |

**What an admin must not be able to do:** be prompted about, or read through the prompt, any task but
their own — the viewed team (CAL-12, ADR-040) plays no part; the prompt never reads `useViewedTeam`.

**Interface affordances, not controls:** mounting only inside the member shell; the once-per-opening
gate; the disabled *Move all*. Each is commented as such.

## 4. Contract

**No seam, domain type or schema change.** Every field name below is new only in the two new files
and `ShellContext`.

### 4.1 Pure module — `src/lib/overdue-prompt.ts` (new)

No React, no seam import, no clock (RULE-02: the component passes the writes in, as
`src/lib/task-tick.ts` does).

```ts
// TSK-02 — the overdue prompt's two decisions that are not drawing. 01-plan.md § 4.1.
import type { Failure, Result, Task } from "@/lib/domain/types";

/** AC-3. True the first time it is called for `memberId` since the page loaded or since
 *  `forgetOverduePrompt()`; false on every later call for the same member. Module state, so a
 *  remount of the shell (a session re-read in place, StrictMode's double effect) is not an opening. */
export function claimOverduePrompt(memberId: string): boolean;

/** AC-3. Called after a successful sign-out, so the next sign-in is an opening. */
export function forgetOverduePrompt(): void;

/** The write one move makes. The component passes `(id, date) => seam.moveTask(id, date)`. */
export type MoveWrite = (taskId: string, date: string) => Promise<Result<Task>>;

/** AC-8. The sentence for a move that throws or rejects — the seam's own `unknown` sentence. */
export const MOVE_FAILED = "This task could not be saved.";

export interface MoveAllResult {
  /** The saved rows, in the order given. */
  moved: Task[];
  /** One per task whose move returned `ok: false` or threw, in the order given. */
  failed: { taskId: string; failure: Failure }[];
}

/** AC-7, AC-8. Moves each of `tasks` to `today`, ONE AT A TIME in the order given, never stopping at a
 *  failure. A throw or rejection is `{ code: "unknown", message: MOVE_FAILED }`. Never throws. */
export function moveAllToToday(tasks: Task[], today: string, move: MoveWrite): Promise<MoveAllResult>;
```

### 4.2 Component — `src/components/OverduePrompt.tsx` (new)

```ts
export interface OverduePromptProps {
  /** The signed-in member's id, from the shell — the gate's key, never a read parameter. */
  memberId: string;
  /** AC-10. Called once when the prompt closes, if any tick or move in it was saved. */
  onTasksChanged(): void;
}
export default function OverduePrompt(props: OverduePromptProps): JSX.Element | null;
```

- **On mount**, in one `useEffect` keyed on `memberId`: if `claimOverduePrompt(memberId)` is false,
  nothing. Otherwise `today = eventToday()` is read once and kept for the prompt's life, then
  `seam.listOverdueTasks(today)`; a non-empty answer opens the prompt (AC-1), an empty one does nothing
  (AC-2), a throw is `console.error` and nothing (AC-12). **The effect does not discard its read on
  cleanup**: under StrictMode the second run's claim is false, so a first run that ignored its own
  answer would show nothing, ever.
- **Ticks** go through `createTaskTicker((id, done) => seam.setTaskDone(id, done), …)` and
  `applyOutcome` from `src/lib/task-tick.ts`, unchanged — the same optimistic run `/tasks` uses
  (AC-5, AC-6). `overdue-prompt-count` is the rows with `ticker.shown(t).done === false`.
- **Move all** passes `list.filter((t) => !ticker.shown(t).done)` to `moveAllToToday(…, today, (id, d) =>
  seam.moveTask(id, d))`, disables the button while it runs (AC-9), removes `moved` from the list, sets
  each `failed` sentence on its row (AC-8), and closes when `failed` is empty (AC-7).
- **Close** (the `Modal`'s `onClose`, and `overdue-prompt-dismiss`) hides the prompt and, if any
  `saved` tick outcome or any move was recorded, calls `onTasksChanged()` once (AC-10).
- No `useViewedTeam`, no member read, no `listTasks` (AC-11).

### 4.3 Shell and page

**`src/components/AppShell.tsx`.**

```ts
export interface ShellContext {
  member: Member;
  refreshMembership(): void;
  /** TSK-02 AC-10. Rises by one each time the overdue prompt closes having changed a task. A screen
   *  that shows tasks reloads when it changes. A number, so it is safe in a dependency list. */
  tasksRevision: number;
}
```

- `const [tasksRevision, setTasksRevision] = useState(0)`, passed in the `Outlet` context.
- `<OverduePrompt memberId={member.id} onTasksChanged={() => setTasksRevision((n) => n + 1)} />`,
  rendered beside `ReportIssueButton`, outside the scrolling pane.
- `Sidebar` receives a `signOut` that calls the shell's `signOut` and, **on `ok` only**,
  `forgetOverduePrompt()` (AC-3). `AppShellProps` is unchanged.

**`src/routes/Tasks.tsx`.** `const { tasksRevision } = useShellContext();` and `tasksRevision` added to
the dependency list of the `useEffect` that calls `load()` — not to `load`'s own `useCallback`. Nothing
else on the page changes.

### 4.4 Selectors

| Id | Where | AC |
|---|---|---|
| `overdue-prompt-modal` | the `Modal` backdrop (its prefix + `-modal`) | AC-1, AC-4 |
| `overdue-prompt-close` | the `Modal`'s round close control | AC-4 |
| `overdue-prompt` | the dialog's content root | AC-1, AC-2 |
| `overdue-prompt-count` | N in the heading | AC-1, AC-5 |
| `overdue-prompt-row` | each task; `data-task-id`, `data-date`, `data-done="true"\|"false"` | AC-1, AC-5, AC-7, AC-8 |
| `overdue-prompt-date-chip`, `overdue-prompt-title` | inside a row | AC-1 |
| `overdue-prompt-done` | the row's box, `role="checkbox"`, `aria-checked` | AC-5, AC-6 |
| `overdue-prompt-row-error` | under a row, `role="alert"` | AC-6, AC-8 |
| `overdue-prompt-move-all` | *Move all to today* | AC-7, AC-8, AC-9 |
| `overdue-prompt-dismiss` | *Close* pill in the footer | AC-4, AC-9 |

**Copy**, English (§ *Language*): *You have N overdue tasks* / *You have 1 overdue task*; *Tick what
you finished, or bring the rest to today.*; *Move all to today*; *Close*. `aria-label` of the dialog:
*Overdue tasks*.

## 5. Seam impact

**None.** `listOverdueTasks`, `setTaskDone` and `moveTask` are called as TSK-01 declared them; no
function is added, no signature or body changes, and `tests/seam-parity.test.ts` is untouched.
`src/lib/task-tick.ts` is imported unchanged.

**Invariants — how each is held (R8).** None touched (§ 2). AC-13 is the fence: nothing in
`absence.ts`, `busy.ts`, `day-status.ts`, any calendar route or the notification code is edited.

**Tests.**

- **`tests/overdue-prompt.test.ts`** (new), against the module and the mock seam:
  - AC-3: `claimOverduePrompt("a")` true, then false; `"b"` after `"a"` true; after
    `forgetOverduePrompt()`, `"a"` true again.
  - AC-7: three overdue tasks of the fixture member, `moveAllToToday` with `seam.moveTask` → all three
    `moved`, each read back by `listTasks(today, today)` with title, note and done unchanged, and
    `listOverdueTasks(today)` empty.
  - AC-8: a `move` stub refusing the second, throwing on the third → `moved` holds the first,
    `failed` holds the second's failure and the third as `unknown` / `MOVE_FAILED`, in order; and the
    stub was called three times, sequentially (the second call starts after the first resolves).
  - AC-11: a teammate's overdue task and an admin signed in → `listOverdueTasks` returns none of it,
    and `moveAllToToday` given that task's row is `task_not_permitted` with the row unchanged for its
    owner.
- **`tests/e2e/tsk-02-overdue-prompt.spec.ts`** (new), through the screen against the mock seam.
  **A `page.goto` resets the mock's tables** (`tsk-01-tasks.spec.ts`' header), so the opening under
  test is a **sign-out and sign-in in the same page**: create tasks on `/tasks`, move the clock forward
  with `page.clock.setFixedTime`, sign out, sign in.
  - AC-1: two overdue and one done-past and one today → prompt, count 2, rows oldest first with chips.
  - AC-2: only done-past and today tasks → no `overdue-prompt` after sign-in.
  - AC-3: prompt closed, navigate to the week view and back → not shown; sign out and in → shown again.
  - AC-4: close by the round control, by Escape, by *Close* → gone, rows unchanged on `/tasks`.
  - AC-5: tick one → `data-done="true"`, count drops, row stays; close; `/tasks` shows it done.
  - AC-7: tick one, *Move all* → prompt closes; `/tasks` today lists the other, the ticked one stays on
    its date.
  - AC-9: tick all → *Move all* disabled.
  - AC-10: with the prompt open after sign-in, move the router to `/tasks` in the same page —
    `history.pushState` then a `popstate` event, which `BrowserRouter` follows without a load, so the
    tables survive — and wait for `tasks-overdue`; then *Move all* → `tasks-overdue` gone and the moved
    titles in `tasks-list`, with no further navigation.
  - AC-6 and AC-8's failure paths are asserted in the module test, not here: the mock has no fault
    switch, and adding one is a seam-file change (TSK-05 § 5's reasoning).
- **Existing suites are unaffected by construction**: every `tsk-01` and `tsk-05` journey opens the app
  by `goto` with an empty task table, so nothing is overdue at opening; neither file is in
  `allowed_paths`. If one turns out to need a change, the Developer stops.

## 6. Schema delta

**`none`.** No table, column, policy, grant, function or trigger is touched. `requires_adr: true` in
`ticket.yaml` is satisfied by ADR-057 (`ACCEPTED by the operator`), which this ticket implements inside
its fence and does not amend.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/overdue-prompt.ts"
  - "src/components/OverduePrompt.tsx"
  - "src/components/AppShell.tsx"
  - "src/routes/Tasks.tsx"
  - "tests/overdue-prompt.test.ts"
  - "tests/e2e/tsk-02-overdue-prompt.spec.ts"
```

**Glossary:** `glossary_owed` is `[]`. *Task* and *Overdue* already have rows (TSK-01); nothing is
written to `glossary.md`.

**Six paths: `size: S`, agreeing with `size_estimate: S`.** **Deliberately absent:** `src/App.tsx`
(the shell already mounts only for `membership.state === "member"`); `src/components/Sidebar.tsx`
(it receives the wrapped `signOut` through its existing prop); `src/components/Modal.tsx` and
`src/lib/task-tick.ts` (used as they are); every file under `src/lib/data/` (§ 5); both existing TSK
e2e specs (§ 5).

## 8. Rejected alternatives

**1. A bulk seam function, `moveTasks(ids, date)`, one `update … where id = any(…)`.** One round trip
instead of N, and atomic. Rejected: it is a new seam member in three implementations plus a parity
test, for a list that is a handful of rows; it makes AC-8 all-or-nothing where the per-task answer
tells the member exactly which task did not move; and `moveTask` already carries the `task_date_past`
refusal and the zero-rows answer the policy needs.

**2. Mounting the prompt on the home calendar only**, or as an inline banner above the screen rather
than a dialog. Quieter, and no reload hook on `/tasks`. Rejected: answer 2 and Q9-B say *when the app
opens*, and a member who lands on `/tasks`, `/events` or a deep link opens the app as surely as one
who lands on `/`; a banner that each route has to render is the hand-extended condition `AppShell`'s
header warns against.

**3. Remembering the opening in `sessionStorage`.** It would survive the shell remounting without a
module variable. Rejected: it also survives a reload, and a reload is an opening (AC-3, Q9-B).

**4. Reusing `/tasks`' `TaskRow` inside the prompt.** One row component. Rejected: it carries Edit,
Move and Delete, which are out of scope here, and exporting it from a route file to a component
inverts the dependency direction for a row that is three elements.

## Changelog

- `2026-10-17T20:14:23+0700` — section 2 was written from the feature row, the idea file and ADR-057
  before the source tree was read for sections 3–8. Reading the code amended no AC; it moved one test
  approach — the e2e "opening" is a sign-out and sign-in, because `page.goto` resets the mock — which
  AC-1 and AC-3 already named as openings. Raised by `tech-lead-design`.
