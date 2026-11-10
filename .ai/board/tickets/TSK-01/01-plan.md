---
ticket: TSK-01
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-15T15:57:31+0700
inputs_read:
  - .ai/board/tickets/TSK-01/ticket.yaml
  - .ai/board/ideas/2026-10-12-a-member-has-nowhere-to-plan-their-own-day-and-an-absence-hides-what-was-due.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md
  - .ai/registry/decisions/ADR-058-tsk-is-a-sixth-feature-group.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/00-charter.md
  - .ai/standards/architecture.md
  - .ai/standards/data-model.md
  - .ai/steward/context.md
  - .ai/board/tickets/EVT-01/ticket.yaml
  - .ai/board/tickets/EVT-04/01-plan.md
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - src/lib/event-registration.ts
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/App.tsx
  - src/components/Sidebar.tsx
  - src/components/TopBar.tsx
  - tests/seam-parity.test.ts
  - tests/manager-role.test.ts
  - tests/e2e/uie-10-sidebar.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# TSK-01 — A member keeps a private list of tasks for each day

## 1. Problem and scope

Transcribed from `.ai/registry/features.md`, `## TSK — Tasks`, without paraphrase:

| ID | Story | Group | Status |
|---|---|---|---|
| TSK-01 | A member keeps a private list of tasks for each day, and only they can read or change it | TSK | PLANNED |

The row's scope, each clause the operator's answer in the idea's § *Evidence*: owner-only read and
write, admins and managers denied (answer 1, F2-A); a dated list (answer 2); a task carries a title and
a short plain-text note (Q8-B), two states and no time (F1); created today or later, while past tasks
stay viewable, tickable and movable (Q13-A); its own page (answer 7). The page opens on today, with day
navigation, an overdue section, create, edit, delete, tick, untick and re-date, and a sidebar link. A
seam read by date range. Decided by
[ADR-057](../../../registry/decisions/ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md)
(`ACCEPTED by the operator`) and
[ADR-058](../../../registry/decisions/ADR-058-tsk-is-a-sixth-feature-group.md) (`ACCEPTED by product`).

**Who gains what.** Every member — whatever their role — gains one place inside CaleChip to write down
what they mean to do on a given day, tick it off, and see what slipped. Today that list lives outside
the product, so nothing CaleChip shows when leave is booked can know what the person had planned for
those days. This ticket is the foundation the other three `TSK` rows build on (`TSK-02`'s prompt,
`TSK-03`'s PTO warning, `TSK-04`'s week badge): it creates the data and the only page that writes it,
and it creates them private — the first thing a member writes that nobody else, admins included, can
read.

**The two decisions the triage left to PLAN.**

1. **"Today" is the calendar date in `Asia/Ho_Chi_Minh`**, read through the existing
   `eventToday()` in `src/lib/event-registration.ts` — not the browser's local date (the idea's
   assumption 2, overruled). One clock already decides "today" for EVT-02's registration deadline in
   the browser and in the database; a second clock in a second feature would let a task be *overdue*
   while an event registration closing the same day is still *open*. The product has no per-user
   timezone and its users are in one zone.
2. **The database does not reject a task dated before today.** The rule *today or later* (Q13-A) is
   held by the page and refused by the seam before any request is issued; it is not held by a
   trigger or a policy. § 8 alternatives 1 and 2 give the reasons: ADR-057 decision 3 says in terms
   *"No trigger or notify fires on it"*, and a policy can hold the insert half but not the re-date half.
   A direct API call that dates a task in the past changes only the caller's own private list, which
   nobody else can read — the rule is a product rule about the owner's own data, not an authorization
   control and not an invariant.

**Out of scope.**

- **The overdue prompt on every app open, with "move all to today"** — `TSK-02`. This ticket's overdue
  section offers per-task tick and move only.
- **The PTO warning** in the entry form and on the task page — `TSK-03`.
- **The done/total badge on the week view** — `TSK-04`. No calendar screen changes here.
- **Handover** (giving a task to a colleague) and **recurring tasks** — deferred by the operator
  (answers 3 and 5); no row, no ID.
- **Any reader but the owner**, admins and managers included (ADR-057 decisions 1–4).
- **Any time on a task** — time of day, estimate, duration, hours (ADR-057 decision 6, refusal 3).
- **Priority, labels, ordering by hand, drag and drop** (Q8-B).
- **Sync with any tracker** (answer 6).
- **Creating a task on a past date** (Q13-A).
- **Bulk actions** of any kind (bulk tick, bulk delete, bulk move).
- **The charter paragraph, the no-time sentence beside refusal 3, and the `task` rows in
  `rbac-and-security.md` and `data-model.md`.** Owed by ADR-057 § *Affected documents*; not in this
  ticket's `allowed_paths` — § 6 says why and gives the text.
- **A database-held date floor** — decision 2 above.

`size_estimate: M` — one table, one page, one link, seven seam functions, no change to any existing
function, policy or screen beyond a route and a link.

## 2. Acceptance criteria

"Today" below is always the calendar date in `Asia/Ho_Chi_Minh` at the moment of the action (§ 1
decision 1). "The member" is any signed-in, approved, not-removed person — member, manager or admin
alike, since a task is owned the same way by every role. Selectors are in § 4.5.

### The page

**AC-1 — the page opens on today**
- Given a signed-in member
- When they open `/tasks`
- Then the page shows today's date as its heading (`tasks-day-heading`, `data-day="<today yyyy-MM-dd>"`)
  and lists the member's tasks dated today, in the order they were created.

**AC-2 — day navigation**
- Given the member is on the task page for day D
- When they press the previous-day control (`tasks-prev-day`) or the next-day control (`tasks-next-day`)
- Then the page shows day D−1 or D+1 respectively, at the address `/tasks/<that day, yyyy-MM-dd>`, and
  lists that day's tasks; and when D is not today, the `tasks-today` control is present and returns the
  page to today; when D is today, `tasks-today` is absent.

**AC-3 — an unreadable address falls back to today**
- Given the member opens `/tasks/<anything that is not a valid yyyy-MM-dd calendar date>`
- When the page loads
- Then they land on `/tasks` showing today.

**AC-4 — the empty state**
- Given the member has no task on the viewed day
- When the page shows that day
- Then `tasks-empty` is shown in place of the list: for today or a later day it reads *Nothing planned
  yet. Add the first task below.*; for an earlier day it reads *Nothing was planned for this day.*

**AC-5 — the sidebar link**
- Given any signed-in member, manager or admin on any screen inside the shell
- When the sidebar renders
- Then it carries exactly one `nav-tasks-link` reading *My tasks* that leads to `/tasks`, marked
  `aria-current="page"` while the address is `/tasks` or `/tasks/<day>`, and not otherwise.

### Writing a task

**AC-6 — create on today or a later day**
- Given the member views today or a later day
- When they enter a title, optionally a note, and press `task-add-submit`
- Then a task appears at the end of that day's list, not done, with the title and note as entered with
  surrounding whitespace removed (a note that is empty once trimmed is stored as no note); the title
  and note fields are cleared; and the task does not appear on any other day.

**AC-7 — no create on an earlier day**
- Given the member views a day before today
- When the page renders
- Then `task-add-form` is absent and `tasks-past-day-note` reads *Past days take no new tasks.*
- And given any caller asks the seam to create a task dated before today, then the seam answers
  `task_date_past` and nothing is written.

**AC-8 — title and note bounds**
- Given the member creates or edits a task
- When the title is empty once trimmed, or longer than 200 characters, or the note is longer than 1000
  characters once trimmed
- Then the write is refused with `invalid_task_title` or `invalid_task_note` respectively, the message
  is shown beside the field it concerns, and nothing is written.

**AC-9 — tick and untick**
- Given a task of the member's on any day, including a day before today
- When they tick its checkbox (`task-done`), and later untick it
- Then the task is shown done (title struck through, `data-done="true"`) and then not done
  (`data-done="false"`), the change persists across a reload of the page, and the task stays where it
  is in the list.

**AC-10 — edit title and note**
- Given a task of the member's on any day, including a day before today
- When they press `task-edit`, change the title and/or the note, and press `task-edit-save`
- Then the task shows the new title and note, keeps its date and its done state; and pressing
  `task-edit-cancel` instead leaves it unchanged.

**AC-11 — re-date (move)**
- Given a task of the member's on any day, including a day before today
- When they press `task-move`, pick today or a later date, and press `task-move-save`
- Then the task leaves the viewed day's list and appears on the picked day, keeping its title, note and
  done state.
- And given the picked date is before today, then the move is refused with `task_date_past`, the
  message is shown beside the date field, and the task does not move. The date field offers nothing
  earlier than today.

**AC-12 — delete, with a confirmation**
- Given a task of the member's
- When they press `task-delete`
- Then a confirmation (`task-delete-confirm`) asks *Delete this task?*; confirming removes the task for
  good; cancelling leaves it unchanged.

### Overdue

**AC-13 — the overdue section**
- Given the member has one or more tasks that are not done and dated before today
- When they view today's page
- Then `tasks-overdue` is shown above today's list, headed *Overdue* with the number of such tasks, and
  lists every one of them — whatever their date — oldest date first, then in creation order, each
  showing its date; and each can be ticked, edited, moved and deleted exactly as AC-9 to AC-12 say.

**AC-14 — what is not overdue**
- Given a task that is done, or a task dated today or later
- When today's page renders
- Then that task is not in `tasks-overdue`. Ticking an overdue task, or moving it to today or later,
  removes it from the section at once; when none remain, the section is absent.

**AC-15 — overdue shows on today only**
- Given the member views any day other than today
- When the page renders
- Then `tasks-overdue` is absent.

### Privacy — ADR-057

**AC-16 — nobody else reads a task**
- Given member A has tasks, some done and some overdue
- When, through the seam, (a) a teammate of A, (b) a manager of A's team, (c) an admin of A's team, and
  (d) an admin of another team each list tasks over a range covering all of A's dates, and list overdue
  tasks
- Then each receives none of A's tasks — only their own, if any.

**AC-17 — nobody else writes a task**
- Given member A has a task T
- When each caller in AC-16 (a) to (d) asks the seam to edit, move, tick, untick or delete T
- Then each is refused with `task_not_permitted`, and T is unchanged when A next reads it — the same
  answer whether or not T exists, so it confirms nothing.
- And creating a task takes no owner: whoever creates it owns it.

**AC-18 — no session, no standing**
- Given a caller who is signed out, or whose sign-up is pending or rejected, or who has been removed
  from the team
- When they list tasks, list overdue tasks, or attempt any write
- Then every read returns an empty list and every write is refused with `task_not_permitted`; a
  removed member's tasks are kept and nobody reads them.

**AC-19 — no other path reaches a task**
- Given the migration that creates the task table
- When it is read
- Then no `security definer` function in it reads the task table; no trigger is created on it; it is
  added to no publication; none of its policies names `is_admin`, `may_decide`, a team, or any
  condition other than the caller owning the row and being an approved, not-removed member; and the
  anonymous role holds no grant on it.

**AC-20 — a task carries no time**
- Given the task table and the `Task` domain type
- When they are read
- Then neither has a column or field holding a time of day, an estimate, a duration or hours worked;
  the page shows a task's date and nothing finer.

### Isolation

**AC-21 — tasks change nothing else**
- Given the member creates, ticks and deletes tasks on a day
- When the absence count, the overload warning and the week, month and year views read that day
- Then each gives exactly what it gave before: a task is not an entry and is in no count.

### The seam's range read

**AC-22 — a read by date range**
- Given the caller has tasks on several days
- When they list tasks from day F to day T inclusive
- Then they receive exactly their tasks with F ≤ date ≤ T, ordered by date, then creation, then id;
  and F after T returns an empty list.

**Invariants touched: `[]`.** Written explicitly. A task is not an entry and enters no absence count
(AC-21), so INV-04, INV-05 and INV-07 are not engaged — ADR-057 § *Affected documents* reaches the same
conclusion. INV-01, INV-02, INV-03 and INV-06 are about entries and nothing here writes one.

**Open questions.** None that change the ACs. The two decisions ADR-057 and the triage left to PLAN are
taken in § 1. Two values are this plan's own and are cheap to argue with: the title limit (200
characters) and the note limit (1000 characters) — the operator said *"ghi chú ngắn"* and gave no
number.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image exists in `.ai/board/tickets/TSK-01/design/` or in the idea file.

- **Address and frame.** `/tasks` and `/tasks/:day`, inside the shell like `/events`: sidebar on the
  left, top bar unchanged, the page in the content pane on `bg-card`, `rounded-card`, a single column
  at most 640 pixels wide, centred, with a 16-pixel gutter at phone width.
- **Header row.** On the left an `h1` *My tasks* in the rounded face, and under it the viewed day as
  *Thursday, 15 October 2026* (`tasks-day-heading`). On the right, the same 32-pixel round
  `ICON_BUTTON` arrows the period navigation uses — previous day, next day — and between them the
  outline pill *Today* (`PILL_OUTLINE`), present only when the viewed day is not today.
- **Overdue section, today only.** A card on the soft pink overload tint — the palette's "needs
  attention, not alarm" colour, per `CLAUDE.md` § *Visual direction* — headed *Overdue · 3*. Each row
  is a task row (below) with its date as a small grey chip before the title (*Mon 12 Oct*).
- **The day's list.** Rows separated by a hairline. Each row: a round checkbox on the left (mint when
  ticked), the title in `text-sm` bold, the note under it in `text-xs` grey on at most two lines; a done
  task's title is struck through and greyed, and stays in place. On the right, three quiet text buttons
  *Edit*, *Move*, *Delete*, visible on hover and always visible at phone width.
- **Edit in place.** *Edit* turns the row into a title input and a note textarea with *Save* and
  *Cancel*. *Move* turns it into a date input (minimum today) with *Move* and *Cancel*. Field errors
  sit directly under the field.
- **Add form, below the list** on today and later days: a title input with the placeholder *Add a
  task*, a note textarea (two rows, placeholder *Note (optional)*), and a primary pill *Add*. On an
  earlier day the form is replaced by one grey line, *Past days take no new tasks.*
- **Empty.** The two sentences of AC-4, centred, in the friendly tone `CLAUDE.md` reserves charm for.
- **Delete confirmation.** The existing `Modal`, *Delete this task?*, with *Delete* (primary) and
  *Cancel*.
- **Sidebar.** One link *My tasks* in a small `<nav>` directly under the brand block, styled as the
  shell's nav links; nothing else in the sidebar moves.
- **Nothing on any calendar screen.** No dot, badge, count or colour (`TSK-04` owns the week badge).

## 3. Permission model

**Every check below is held in PostgreSQL** — four row-level policies and the column grants on
`public.task` — per ADR-005. Nothing in the seam or on the page is a control; each affordance carries a
comment saying so.

The predicate, identical in all four policies (ADR-057 decision 2, plus the narrowing arm it allows):

```sql
member_id = (select auth.uid())
and public.member_team_id((select auth.uid())) is not null
```

| Action | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|
| Read own tasks | ✅ | ✅ | ✅ | `task_select_own` |
| Read another person's tasks, any team | ❌ | ❌ **ADR-057 d.1** | ❌ **ADR-057 d.1, d.4** | same — no `is_admin`, no `may_decide`, no team arm |
| Create a task | ✅ own only | ✅ own only | ✅ own only | `task_insert_own` `with check`; `member_id` not in the insert grant, so it takes `default auth.uid()` |
| Create a task for someone else | ❌ | ❌ | ❌ | the insert grant omits `member_id`, and the `with check` refuses any other value |
| Edit, move, tick, untick own task | ✅ | ✅ | ✅ | `task_update_own` (`using` and `with check`); update grant on `date`, `title`, `note`, `done` only |
| Change another person's task | ❌ | ❌ | ❌ | same; zero rows updated → `task_not_permitted` |
| Change `member_id`, `id` or `created_at` | ❌ | ❌ | ❌ | no update grant on them (42501) |
| Delete own task | ✅ | ✅ | ✅ | `task_delete_own` |
| Delete another person's task | ❌ | ❌ | ❌ | same; zero rows deleted → `task_not_permitted` |
| Anything above while pending, rejected or removed | ❌ | ❌ | ❌ | `member_team_id(uid) is not null` in all four |
| Anything as `anon` | ❌ | ❌ | ❌ | `revoke all … from anon`; no grant; policies are `to authenticated` |

**What an admin must not be able to do**, stated because almost every other policy in the schema has
an admin arm and copying one here is the natural mistake: read, count, change or delete anybody
else's task, on their own team or any other. ADR-040's cross-team admin read is not extended to tasks
(ADR-057 decision 4). The tests assert the admin's and the manager's denials by name (AC-16, AC-17).

**`member_team_id` is a `security definer` function, and it does not read `public.task`.** It reads
`public.member` for the caller. ADR-057 decision 3 forbids a definer function that reads a task; this
one is the shared narrowing arm the notification policies already carry, and it answers only "is the
caller an approved, not-removed member".

**The scope of the guarantee** is every token the app issues (ADR-057 decision 5). The project owner,
the dashboard and the service-role key bypass row-level security by design; the migration header says
so in one line.

**Interface affordances, not controls:** the route renders only for `membership.state === "member"`;
the add form is hidden on past days; the move date field's minimum is today; the seam refuses
`task_date_past`, `invalid_task_title` and `invalid_task_note` before a request is issued.

**Where this cannot be verified today.** As `EVT-01` § 3 and `EVT-04` § 3 record, a permission test
against a real PostgreSQL is still owed project-wide. The mock reproduces the four policies clause for
clause (ADR-057 § *Consequences*: *"The mock seam must reproduce the policies clause for clause"*);
the migration is asserted by reading the file (AC-19, AC-20). The migration header says it has not
been run against PostgreSQL.

## 4. Contract

### 4.1 Domain types — `src/lib/domain/types.ts`

Appended after the `EVT-13` block, or at the end of the file. **Additive; no existing type changes
shape** — `FailureCode` gains four members, as every feature has added them.

```ts
// TSK-01, 01-plan.md section 4.1. ADR-057.

/** TSK-01. One task: the caller's own, always — no other person's task ever reaches the browser.
 *  NO TIME FIELD OF ANY KIND, and there must never be one (ADR-057 decision 6, charter refusal 3). */
export interface Task {
  id: string;
  memberId: string;
  date: string; // yyyy-MM-dd
  title: string; // trimmed, 1..TASK_TITLE_MAX characters
  note: string | null; // trimmed, 1..TASK_NOTE_MAX characters, or null
  done: boolean;
  createdAt: string; // ISO 8601 instant; ordering only, never displayed
}

/** TSK-01. Bounds, in characters. Mirrored by `task_title_shape` and `task_note_shape`. */
export const TASK_TITLE_MAX = 200;
export const TASK_NOTE_MAX = 1000;
```

Added to the `FailureCode` union, before `| "unknown"`:

```ts
  // TSK-01. Title empty once trimmed, or over TASK_TITLE_MAX — AC-8. Refused in the SEAM before the
  // request; `task_title_shape` (23514) is the control.
  | "invalid_task_title"
  // TSK-01. Note over TASK_NOTE_MAX once trimmed — AC-8. `task_note_shape` (23514) is the control.
  | "invalid_task_note"
  // TSK-01. A create or a move to a date before today in Asia/Ho_Chi_Minh — AC-7, AC-11. Refused in
  // the SEAM only; the database holds no date floor (01-plan.md § 1 decision 2).
  | "task_date_past"
  // TSK-01. 42501, no session, or a write that touched zero rows — AC-17, AC-18. Never confirms that
  // the task exists.
  | "task_not_permitted"
```

### 4.2 Seam — `src/lib/data/index.ts`

```ts
/** TSK-01. A new task's three fields. NO `memberId`: the row is the caller's, by the column default
 *  and the policy, and a parameter would imply a caller could name someone else (CreateEntryInput's
 *  reasoning). NO `done`: a task is created not done. */
export interface CreateTaskInput {
  date: string; // yyyy-MM-dd, today or later in Asia/Ho_Chi_Minh
  title: string;
  note: string | null;
}

/** TSK-01. A full replacement of title and note, never the date — re-dating is `moveTask`, because it
 *  carries a refusal (`task_date_past`) an edit of a past task's title must not meet. */
export interface UpdateTaskInput {
  title: string;
  note: string | null;
}
```

Appended to `DataSeam`, after the `EVT-08` block:

```ts
  // -------------------------------------------------------------------------
  // TSK-01 — a member's own tasks. 01-plan.md section 4.2. ADR-057.
  //
  // Seven functions. Every read and write is the CALLER'S OWN ROWS ONLY — the four policies on
  // `public.task` have no admin, manager or team arm. "Today" is `eventToday()`, Asia/Ho_Chi_Minh.
  // -------------------------------------------------------------------------

  /** TSK-01 AC-1, AC-22. The caller's tasks with from <= date <= to, ordered `date`, `createdAt`,
   *  `id` ascending. Empty when from > to (no round trip), signed out, or not an approved member.
   *  Bounded by DATASTORE_MAX_ROWS and throws at the bound. Throws on any other read failure. */
  listTasks(from: string, to: string): Promise<Task[]>;

  /** TSK-01 AC-13, AC-14. The caller's tasks with done = false and date < today, ordered `date`,
   *  `createdAt`, `id` ascending. `today` is the caller's `eventToday()`, passed in so the screen and
   *  the read agree on one instant. Empty signed out. Bounded and throwing as `listTasks`. */
  listOverdueTasks(today: string): Promise<Task[]>;

  /** TSK-01 AC-6, AC-7, AC-8. Trims title and note (an empty note becomes null), then refuses
   *  `invalid_task_title`, `invalid_task_note`, or `task_date_past` (date < eventToday()) before the
   *  request. Returns the saved row. 42501 or no session is `task_not_permitted`. */
  createTask(input: CreateTaskInput): Promise<Result<Task>>;

  /** TSK-01 AC-8, AC-10. Trims and refuses as `createTask` does for title and note; the date is not
   *  written. Zero rows updated is `task_not_permitted`. Returns the saved row. */
  updateTask(taskId: string, input: UpdateTaskInput): Promise<Result<Task>>;

  /** TSK-01 AC-11. Refuses `task_date_past` when date < eventToday(), before the request. Writes the
   *  date only. Zero rows updated is `task_not_permitted`. Returns the saved row. */
  moveTask(taskId: string, date: string): Promise<Result<Task>>;

  /** TSK-01 AC-9. Writes `done` only. Zero rows updated is `task_not_permitted`. Returns the saved
   *  row. */
  setTaskDone(taskId: string, done: boolean): Promise<Result<Task>>;

  /** TSK-01 AC-12. Deletes and reads back what it removed; zero rows is `task_not_permitted`, not
   *  success — `deleteEvent`'s shape. */
  deleteTask(taskId: string): Promise<Result<void>>;
```

**The sentences**, each the `message` of its `Failure`, in English (§ *Language*):

| Code | Sentence |
|---|---|
| `invalid_task_title` | `Give the task a title of at most 200 characters.` |
| `invalid_task_note` | `Keep the note to at most 1000 characters.` |
| `task_date_past` | `A task can be dated today or later.` |
| `task_not_permitted` | `This task could not be changed. It may have been deleted.` |
| `unknown` (any other error) | `This task could not be saved.` |

### 4.3 Database — `supabase/migrations/20261015120000_tsk01_task.sql`

One transaction, idempotent in ADR-024's shape. The header states it has not been run against
PostgreSQL, and that the service-role key and the dashboard bypass every policy below (ADR-057
decision 5).

```sql
create table if not exists public.task (
  id          uuid        primary key default gen_random_uuid(),
  member_id   uuid        not null default auth.uid() references public.member (id),
  date        date        not null,
  title       text        not null,
  note        text        null,
  done        boolean     not null default false,
  created_at  timestamptz not null default now(),
  constraint task_title_shape check (btrim(title) = title and title <> '' and char_length(title) <= 200),
  constraint task_note_shape  check (note is null or (btrim(note) = note and note <> '' and char_length(note) <= 1000))
);

create index if not exists task_member_date on public.task (member_id, date);

alter table public.task enable row level security;

-- Four policies, `to authenticated`, `(select auth.uid())` wrapped, drop-then-create. NO is_admin, NO
-- may_decide, NO team arm in any of them — ADR-057 decisions 1, 2 and 4.
-- task_select_own  for select  using (<predicate>)
-- task_insert_own  for insert  with check (<predicate>)
-- task_update_own  for update  using (<predicate>) with check (<predicate>)
-- task_delete_own  for delete  using (<predicate>)
-- where <predicate> is the two-line expression in § 3.

revoke all on public.task from anon, authenticated;
grant select, delete on public.task to authenticated;
grant insert (date, title, note) on public.task to authenticated;
grant update (date, title, note, done) on public.task to authenticated;
```

**Nothing else.** No function, no trigger, no `notify`, no publication, no view (ADR-057 decision 3,
AC-19). `member_id` references `member` with the default `restrict`, as every other reference to
`member` does — a member row is never deleted (ADR-013), so a removed member's tasks stay (AC-18).

### 4.4 Supabase implementation notes — `src/lib/data/supabase.ts`

- `TASK_COLUMNS = "id, member_id, date, title, note, done, created_at"`; a `toTask` row mapper beside
  `toEvent`.
- `listTasks`: `from("task").select(TASK_COLUMNS).gte("date", from).lte("date", to)` ordered `date`,
  `created_at`, `id` ascending, `.limit(DATASTORE_MAX_ROWS)`, throwing at the bound with
  `listEventGuests`' sentence shape. **No `.eq("member_id", …)`**: the policy is the filter, and a
  client-side filter would make the test of AC-16 pass whatever the policy said. `42501` and
  `PGRST301` return `[]`.
- `listOverdueTasks`: the same with `.eq("done", false).lt("date", today)`.
- `createTask`: `insert({ date, title, note }).select(TASK_COLUMNS).single()`.
- `updateTask`, `moveTask`, `setTaskDone`: `update({...}).eq("id", taskId).select(TASK_COLUMNS)`;
  zero rows → `task_not_permitted`.
- `deleteTask`: `delete().eq("id", taskId).select("id")`; zero rows → `task_not_permitted`.
- Errors matched on SQLSTATE, never on the message: `42501`, `PGRST301`, `22P02` → `task_not_permitted`;
  `23514` → `unknown` (unreachable, since the seam refuses both shapes first); anything else
  `unknown`.

### 4.5 Mock — `src/lib/data/mock.ts`

An in-memory `tasks` array and a named export `__resetTasks()` beside `seam` (test-only, not a seam
member — `__resetEvents()`'s shape). One `ownsTask(row)` helper reproducing § 3's predicate:
`row.memberId === currentMemberId && memberTeamId(currentMemberId) !== null`, used by every read
filter and every write, with no role clause. The same pre-request refusals as the real seam, in the
same order.

### 4.6 Screen — `src/routes/Tasks.tsx`, `src/App.tsx`, `src/components/Sidebar.tsx`

- **`App.tsx`**: `/tasks` and `/tasks/:day`, each
  `membership.state === "member" ? <Tasks /> : <Navigate to="/" replace />`, beside the `/events`
  routes.
- **`Tasks.tsx`**: reads `:day`; absent → today; not a valid `yyyy-MM-dd` calendar date →
  `<Navigate to="/tasks" replace />` (AC-3). Calls `listTasks(day, day)`, and on today
  `listOverdueTasks(today)`; reloads both after every successful write. One `eventToday()` call per
  render pass decides today.
- **`Sidebar.tsx`**: one `<nav>` holding one `<Link data-testid="nav-tasks-link" to="/tasks">My
  tasks</Link>` directly under `shell-brand`, `aria-current="page"` when the pathname is `/tasks` or
  starts with `/tasks/`. No button, form, input or select is added (UIE-10 AC-10 counts them).

### 4.7 Selectors

| Id | Where | AC |
|---|---|---|
| `nav-tasks-link` | sidebar link *My tasks* | AC-5 |
| `tasks-page` | the page root | AC-1 |
| `tasks-day-heading` | the viewed day; `data-day="yyyy-MM-dd"` | AC-1, AC-2 |
| `tasks-prev-day`, `tasks-next-day` | the two arrows, `aria-label="Previous day"`, `"Next day"` | AC-2 |
| `tasks-today` | the *Today* pill; absent on today | AC-2 |
| `tasks-list` | the day's list | AC-1, AC-6 |
| `tasks-empty` | in place of the list | AC-4 |
| `task-row` | each task, in both lists; `data-task-id`, `data-date`, `data-done="true"|"false"` | AC-6–AC-14 |
| `task-title`, `task-note`, `task-date-chip` | inside a row; the chip only in the overdue section | AC-6, AC-13 |
| `task-done` | the row's checkbox, `role="checkbox"`, `aria-checked` | AC-9 |
| `task-edit`, `task-move`, `task-delete` | the row's three actions | AC-10–AC-12 |
| `task-edit-title`, `task-edit-note`, `task-edit-save`, `task-edit-cancel` | edit mode | AC-10 |
| `task-move-date`, `task-move-save`, `task-move-cancel` | move mode; `task-move-date` has `min` = today | AC-11 |
| `task-field-error` | under the field it concerns; `data-field="title"|"note"|"date"` | AC-7, AC-8, AC-11 |
| `task-delete-confirm`, `task-delete-confirm-yes`, `task-delete-confirm-no` | the modal | AC-12 |
| `task-add-form`, `task-add-title`, `task-add-note`, `task-add-submit` | the add form | AC-6, AC-7 |
| `tasks-past-day-note` | replaces the add form on an earlier day | AC-7 |
| `tasks-overdue`, `tasks-overdue-count` | the section and its number | AC-13–AC-15 |

## 5. Seam impact

**Seven functions added:** `listTasks`, `listOverdueTasks`, `createTask`, `updateTask`, `moveTask`,
`setTaskDone`, `deleteTask` — each in `index.ts`, `supabase.ts` and `mock.ts` with the same name and
arity, which `tests/seam-parity.test.ts` checks without edit.

**No existing function changes signature, and no existing function's body changes.** No existing type
changes shape; `FailureCode` gains four members. `eventToday()` is imported, not edited. Not XL under
the operating model's sizing table: no existing caller must change.

**Invariants — how each is held (R8).** None touched (§ 2). AC-21 is the fence: the test creates,
ticks and deletes tasks on a day and asserts the absence count and the busy/overload reads for that day
are unchanged — nothing in `absence.ts`, `busy.ts` or `day-status.ts` is edited, and no seam function
that reads entries reads `tasks`.

**Tests.**

- **`tests/tasks.test.ts`**, against the mock, one `describe` per AC group: AC-6 to AC-12 at the seam
  (including the four refusals and their order); AC-13 and AC-14 through `listOverdueTasks`; AC-16 and
  AC-17 with four callers by name — a teammate, a manager (promoted with `setMemberRole` and put back,
  `tests/manager-role.test.ts`' shape), an admin of the same team and an admin of another team —
  each asserted to read zero of the owner's rows and to be refused every write, with the owner's row
  read back unchanged; AC-18 signed out and as `FIXTURE_REMOVED_MEMBER`; AC-21; AC-22 including
  `from > to`. **AC-19 and AC-20 by reading the migration file**: no `security definer`, no `create
  trigger`, no `publication`, no `is_admin` or `may_decide`, no `to anon`/`grant … anon`, and no column
  whose name or type is a time of day, interval or duration; and by asserting the keys of a `Task`
  returned from the mock are exactly the seven of § 4.1.
- **`tests/e2e/tsk-01-tasks.spec.ts`**, through the screen against the mock seam: AC-1 to AC-12 for a
  member; AC-13 to AC-15 with a task created, then moved by the browser clock (`page.clock`) a day
  forward so it is overdue; AC-5 for each of member, manager and admin.

## 6. Schema delta

**One table, one index, four policies, and its grants** — § 4.3. Not `none`: a new table and policies
(ADR-014).

**ADR:** [ADR-057](../../../registry/decisions/ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md),
`ACCEPTED by the operator`, which `ticket.yaml`'s `requires_adr: true` cites. Inside its fence: owner
only (decision 1), the predicate and nothing else but the allowed narrowing arm (2), no other read path
(3), no admin reach (4), no time (6). No existing table, policy, trigger or function is touched.

**Applying it is human** (RULE-09). `supabase/db.sql` is not updated (MD-033).

**Owed by ADR-057 § *Affected documents*, and not in this ticket's paths.** The precedent is EVT-01's,
where the charter and both standards rows went to `/thuki` (`EVT-01/ticket.yaml`, the comment under
`allowed_paths`). Two reasons apply here: the charter and `.ai/standards/**` are human plane
(`CLAUDE.md` § *Two planes*), and the three would take this ticket from eleven paths to fourteen, which
is `L` and must split — splitting a privacy paragraph away from the code it describes would be worse
than landing it beside the ticket through `/thuki`. **The text, so `/thuki` transcribes rather than
authors:**

- `.ai/00-charter.md` § *Roles*, after the *"Reading is not a privilege here"* paragraph: *"**Tasks
  are the exception.** A task (`TSK`) is a member's own list for a day, and only its owner reads or
  writes it — no teammate, manager or admin, through any token the app issues. Added 2026-10-12 by
  ADR-057, from the operator's answer 'riêng tuyệt đối'."* And beside refusal 3: *"A task carries a
  date and two states, done and not done, and never a time, an estimate or hours (ADR-057 decision
  6)."*
- `.ai/standards/data-model.md` § *Entities*: a `### task` entity transcribed from § 4.3.
- `.ai/standards/rbac-and-security.md` § *The permission table*: the § 3 rows, with ADR-057
  decision 5's scope and the footnote ADR-057 § *Consequences* asks for (the first table where an
  admin is denied a read the rank below cannot do either).

Until they land, `/ship` names them as owed.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/glossary.md"
  - "supabase/migrations/20261015120000_tsk01_task.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/App.tsx"
  - "src/components/Sidebar.tsx"
  - "src/routes/Tasks.tsx"
  - "tests/tasks.test.ts"
  - "tests/e2e/tsk-01-tasks.spec.ts"
```

**Glossary:** the *Task* and *Overdue* rows were written at this stage (ADR-047), and are the only
glossary change.

**Eleven paths: `size: M`, agreeing with `size_estimate: M`.** A thirteenth makes this `L`. **Deliberately
absent:** `src/components/TopBar.tsx` (the brand logo already links to `/`, so the page needs no
*Calendar* pill); `src/lib/event-registration.ts` (`eventToday()` is imported unchanged);
`src/lib/data/absence.ts`, `busy.ts`, `day-status.ts` and every calendar route (AC-21 — if one needs an
edit, something is wrong and the Developer stops); `src/components/Modal.tsx` (used as is);
`supabase/db.sql` (MD-033); the charter and both standards files (§ 6). The schema change is covered by
an accepted ADR, which is how `EVT-01` and `EVT-04` were sized M under the same table.

## 8. Rejected alternatives

**1. A `before insert or update of date` trigger refusing a date before today in `Asia/Ho_Chi_Minh`.**
The triage named it and it is genuinely the tidiest way to hold Q13-A in the database: one clock, both
writes, a distinct errcode. Rejected because ADR-057 decision 3 says in terms *"No trigger or notify
fires on it"*. The sentence sits under *no other read path*, and a guard reading only `NEW` arguably
leaks nothing — but a reviewer holding R8 against the literal decision would be right to fail it, and
reinterpreting an operator-accepted ADR is not this stage's to do. What the trigger would protect is
the owner's own private list from the owner's own direct API call; that is not worth the argument.

**2. A date clause in the insert policy's `with check`**, `date >= (now() at time zone
'Asia/Ho_Chi_Minh')::date`. No trigger, and ADR-057 decision 2 allows narrowing. Rejected because it
holds half the rule: an update policy cannot compare `NEW.date` with `OLD.date`, so the move half
stays in the seam anyway; and a refusal arrives as `42501`, indistinguishable from *not yours*, so the
seam's sentence would be wrong at the midnight boundary where the browser and the database disagree on
the day.

**3. The browser's local date as "today"** — the idea's assumption 2. Cheaper (no import) and right for
a member abroad. Rejected for one clock across the product: EVT-02 already decides "today" in
`Asia/Ho_Chi_Minh` in both the browser and the database, and `TSK-03` will compare task dates against
PTO dates that are themselves Vietnamese calendar days.

**4. One `updateTask` carrying the date too**, instead of a separate `moveTask`. One function fewer.
Rejected because the date floor applies only when the date *changes*: editing the title of a task dated
last Monday must succeed, and a full-replacement update cannot tell "unchanged past date" from "moved
to a past date" without a read first. Splitting the operation makes the refusal belong to exactly one
call.

## Changelog

- `2026-10-15T15:57:31+0700` — section 2 was written before the source tree was read for sections 3–8,
  and no AC was amended after it. Raised by `tech-lead-design`.
