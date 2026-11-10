---
ticket: TSK-03
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-17T23:14:24+0700
inputs_read:
  - .ai/board/tickets/TSK-03/ticket.yaml
  - .ai/board/ideas/2026-10-12-a-member-has-nowhere-to-plan-their-own-day-and-an-absence-hides-what-was-due.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md
  - .ai/templates/plan.md
  - .ai/steward/context.md
  - .ai/board/tickets/TSK-02/01-plan.md
  - src/components/EntryForm.tsx
  - src/components/OverloadWarning.tsx
  - src/routes/EditEntry.tsx
  - src/routes/MonthView.tsx
  - src/routes/NewEntry.tsx
  - src/routes/Tasks.tsx
  - src/lib/data/index.ts
  - src/lib/domain/types.ts
  - src/index.css
  - tests/e2e/tsk-01-tasks.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# TSK-03 — A member declaring PTO is warned about their own tasks on those days

## 1. Problem and scope

Transcribed from `.ai/registry/features.md`, `## TSK — Tasks`, without paraphrase:

| ID | Story | Group | Status |
|---|---|---|---|
| TSK-03 | A member declaring PTO is warned about their own tasks on those days, without being stopped | TSK | PLANNED |

The row's scope, each clause the operator's: a warning in the entry form beside the CAL-07 overload
warning when a PTO entry covers days holding the member's own tasks, and a PTO flag on the task page
(answer 4); warning only, saving is never blocked (Q11-A, charter refusal 6); PTO only, not WFH
(Q12-A). **It shows only when the entry is the viewer's own.** An admin editing another member's entry
(CAL-03) cannot read that member's tasks (ADR-057), so it shows nothing there by construction. Tasks
never move automatically (Q11-A). `schema_delta` none. `depends_on: [TSK-01]` — `DONE`, on
`origin/main`.

The operator's words, answer 4: *"Nhắc lúc book PTO, Và cả trong trang task"*; Q11: *"A: Chỉ cảnh
báo"*; Q12: *"A: Chỉ PTO"*.

**Who gains what.** Any signed-in member — whatever their role — booking leave today sees the team's
load (CAL-07) and nothing about what they themselves had planned for those days. This ticket puts
their own unfinished tasks for the chosen days in the form, at the moment of booking, which is where
the charter's *"handover arranged the night before"* starts; and marks a PTO day on the task page, so
a member planning a day sees that they will not be there.

**What PLAN reads into the operator's words, stated so it can be argued with.**

1. **"Tasks on those days" means tasks not yet done.** A done task is not at risk from an absence;
   listing it would make the warning longer without telling the member anything to act on.
2. **The warning ignores portion and tentative.** A half-day or tentative PTO still covers the day;
   the member decides whether a morning off matters to a task.
3. **"PTO on the task page" means an entry of type `pto` and status `pending` or `approved`** —
   the two statuses INV-04 counts as an absence. A rejected entry is not a plan to be away.
4. **The edit route warns too**, about the dates in the form, when the entry is the viewer's own. An
   edit is declaring PTO as much as a create is.

**Out of scope.**

- **Moving, ticking or editing a task from the warning or the flag** (Q11-A refused *"move all to
  the next working day"*; the task page already does each).
- **A warning or flag for WFH** (Q12-A).
- **Any reader but the owner** (ADR-057). An admin or manager editing another member's entry sees no
  task warning, theirs or the owner's.
- **Done tasks** in the warning (reading 1).
- **A flag on the overdue section's rows, the TSK-02 prompt, or any calendar view** — the week badge
  is `TSK-04`.
- **A link from the warning to the task page.** The month view's form is a dialog, and leaving it
  drops the draft.
- **Notifications or e-mail about tasks on PTO days** (ADR-057 decision 3).
- **Any seam, schema or shared-type change.**

`size_estimate: S` — one warning component in the form, one flag on one page, one small pure module,
no seam change.

## 2. Acceptance criteria

"The member" is any signed-in, approved, not-removed person — member, manager or admin. "An open task"
is a task of theirs that is not done. "The form" is any of the three entry forms:
`new-entry` (`/entries/new`), `month-entry` (the month view's dialog) and `edit-entry`
(`/entries/:id/edit`). `<p>` is the form's selector prefix. Selectors are in § 4.4.

### In the entry form

**AC-1 — warned about open tasks on the chosen days**
- Given the member has open tasks dated on some of the days chosen in the form, and the form's type
  is PTO
- When the chosen days stop changing for 300 ms
- Then `<p>-task-warning` is shown under the date grid, beside the overload warning, headed *You have
  N open tasks on these days* (*1 open task* when N is 1, N in `<p>-task-warning-count`), and lists
  each open task on a chosen day as a row (`<p>-task-warning-task`) with its date chip (*Thu 12 Mar*)
  and its title, ordered by date, then by creation.

**AC-2 — only chosen days, only open tasks**
- Given the member has tasks on days not chosen, done tasks on chosen days, and open tasks on chosen
  days, including days between two runs of a gapped selection
- When the warning is shown
- Then it lists the open tasks on chosen days only; no done task and no task on an unchosen day
  appears; and when no open task falls on a chosen day, no `<p>-task-warning` is shown.

**AC-3 — PTO only**
- Given the warning is shown
- When the member switches the type to WFH
- Then the warning is gone; switching back to PTO shows it again for the same days.

**AC-4 — portion and tentative do not matter**
- Given the warning is shown for a full day
- When the member picks morning or afternoon, or ticks tentative
- Then the warning still lists the same tasks.

**AC-5 — never blocks**
- Given the warning is shown
- When the member presses `<p>-submit`
- Then the entry is saved exactly as it would be without the warning; no task changes, moves or is
  ticked; the submit control is never disabled by the warning; and the warning uses `role="status"`,
  never `alert` (charter refusal 6).

**AC-6 — the viewer's own entry only**
- Given an admin opens `/entries/:id/edit` for another member's entry whose dates hold open tasks of
  that member and open tasks of the admin
- When the form shows those dates as PTO
- Then no `edit-entry-task-warning` is shown at any time — neither member's tasks are listed.
- And given the admin opens their own PTO entry the same way, the warning lists the admin's own open
  tasks on its dates.

**AC-7 — the viewer's own tasks only**
- Given a teammate has open tasks on the days the member chooses, and the member has none
- When the member's form shows PTO on those days
- Then no `<p>-task-warning` is shown (ADR-057 decisions 1 and 4).

**AC-8 — a failed read shows nothing**
- Given the task read, or the read that decides whose entry this is, fails
- When the form is shown
- Then no `<p>-task-warning` is shown, nothing else in the form changes, and the entry can be saved.

**AC-9 — a stale read never paints**
- Given the member changes the chosen days while an earlier read is in flight
- When the earlier read answers after the later one was asked
- Then what is shown describes only the days now chosen.

### On the task page

**AC-10 — a PTO day is flagged**
- Given the member has a PTO entry, pending or approved, covering a day
- When they view that day on `/tasks` (today or `/tasks/:day`)
- Then `tasks-pto-flag` is shown beside the day heading reading *On PTO*, followed by *· morning* or
  *· afternoon* for a half day and *· tentative* when tentative; and when the day has open tasks it
  adds *· N open tasks* (*1 open task*).

**AC-11 — not flagged otherwise**
- Given the viewed day is covered by none of the member's own entries, or only by a WFH entry, or only
  by a rejected PTO entry, or only by a teammate's PTO
- When they view it on `/tasks`
- Then no `tasks-pto-flag` is shown.

**AC-12 — the flag never changes the page's behaviour**
- Given `tasks-pto-flag` is shown
- When the member adds, ticks, edits, moves or deletes a task on that day
- Then each works exactly as it does on an unflagged day; and the open-task count in the flag follows
  the list without a reload.

**AC-13 — a failed entries read shows no flag**
- Given the member's entries cannot be read
- When `/tasks` loads
- Then no `tasks-pto-flag` is shown and the day's tasks are shown as before.

### Everything else

**AC-14 — no other effect**
- Given the warning or the flag is shown
- When the absence count, the overload warning, the notification bell, the TSK-02 prompt and the
  week, month and year views read any day
- Then each gives exactly what it gave before: this ticket writes nothing.

**Invariants touched: `[]`.** Written explicitly. A task is not an entry and is in no absence count
(ADR-057 decision 3); the warning reads entries only through the form's own state and the flag reads
the member's own entries without counting them, so INV-04, INV-05 and INV-07 are not engaged; INV-01,
INV-02, INV-03 and INV-06 are about entry writes, and nothing here writes one.

**Open questions.** None that block. The four readings in § 1 are this plan's and each changes one AC
if argued with: reading 1 (open tasks only) AC-1 and AC-2; reading 2 AC-4; reading 3 AC-10 and AC-11;
reading 4 AC-6.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image exists in `.ai/board/tickets/TSK-03/design/`, and the idea file carries none.

- **Form warning.** Directly under the overload warning(s), above the portion control — the slot
  CAL-07 already uses, so the two notices read together. A `rounded-xl` block in peach
  (`bg-pto/40`, the PTO colour softened so it reads as information about *your* PTO, distinct from
  the overload block's soft pink), `p-3 text-sm`. First line: a small check-list glyph and the bold
  heading *You have N open tasks on these days*. Then up to the rows: date chip in small grey
  (`text-ink-2`), title on one line truncated with an ellipsis. Past five rows the list scrolls inside
  the block (`max-h` about five rows), so a long PTO never pushes the save control off a phone screen.
  Last line, small grey: *Saving is not blocked. Move them on your task page if you need to.*
- **Task page flag.** A pill beside the day heading on the same line, `bg-pto text-pto-ink`,
  `rounded-full px-2 py-0.5 text-xs font-bold`: a small sun glyph, *On PTO · morning · 2 open tasks*.
  A tentative entry draws the pill with a dashed border at reduced opacity, the palette's tentative
  look. It wraps under the heading at phone width. No banner, no extra row in the list.

## 3. Permission model

**Nothing new is decided here.** The warning reads tasks through `listTasks`, held by `task_select_own`
(TSK-01 § 3, ADR-057 decision 2): `member_id = (select auth.uid()) and
public.member_team_id((select auth.uid())) is not null`, no admin, manager or team arm. The flag reads
entries through `listOwnEntries`, held by `entry_select_team` and narrowed to the caller in the query.

| Action | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|
| See own open tasks in the warning on own PTO | ✅ | ✅ | ✅ | `task_select_own` |
| See another member's tasks in the warning, any route | ❌ | ❌ | ❌ **ADR-057 d.1, d.4** | `task_select_own`; `listTasks` takes no member |
| See own tasks in the warning while editing another member's entry | ❌ | ❌ | ❌ | the component's owner check (§ 4.2) — an affordance; the read could only ever return the caller's own tasks, which is why it is not issued |
| See the PTO flag for own entries | ✅ | ✅ | ✅ | `entry_select_team`, narrowed by `listOwnEntries` |
| Any write | — | — | — | none is made |

**What an admin must not be able to do:** read, through the warning or the flag, any task but their
own. The viewed team (CAL-12, ADR-040) plays no part; neither component reads `useViewedTeam`.

**Why the owner check exists although the policy already holds privacy:** on another member's entry,
`listTasks` would return the *admin's own* tasks, which is a wrong warning, not a leak. The check
prevents the wrong warning; the policy prevents the leak.

## 4. Contract

**No seam, domain type or schema change.** Every field name below is new only in the new files and in
`EntryForm`'s render.

### 4.1 Pure module — `src/lib/pto-tasks.ts` (new)

No React, no seam import, no clock.

```ts
// TSK-03 — which tasks a PTO draft covers, and which PTO covers a day. 01-plan.md § 4.1.
import type { Entry, EntryPortion, Task } from "@/lib/domain/types";

/** AC-1, AC-2. The tasks in `tasks` that are not done and whose date is in `dates`, ordered by date,
 *  then by `createdAt`, then by `id`. Pure; does not mutate its input. */
export function openTasksOnDays(tasks: readonly Task[], dates: readonly string[]): Task[];

/** AC-10, AC-11. The first entry in `entries` with memberId === `memberId`, type "pto", status
 *  "pending" or "approved", and startDate <= `day` <= endDate; null when none. When several match,
 *  the one with the earliest startDate, then the smallest id. */
export function ptoCovering(entries: readonly Entry[], memberId: string, day: string): Entry | null;

/** AC-10. The flag's text after "On PTO": " · morning" for "am", " · afternoon" for "pm", "" for
 *  "full"; then " · tentative" when `tentative`; then " · 1 open task" / " · N open tasks" when
 *  openCount > 0. */
export function ptoFlagSuffix(portion: EntryPortion, tentative: boolean, openCount: number): string;
```

### 4.2 Component — `src/components/PtoTaskWarning.tsx` (new)

```ts
export interface PtoTaskWarningProps {
  /** The entry's owner, or null for the caller — EntryForm's own `ownerId`, passed through. */
  ownerId: string | null;
  type: EntryType;
  /** Every chosen day, sorted — EntryForm's `dates`, NOT one run (AC-2: a gapped selection's gap is
   *  not chosen). */
  dates: readonly string[];
  /** EntryForm's prefix: `new-entry`, `edit-entry` or `month-entry`. */
  testIdPrefix: string;
}
export default function PtoTaskWarning(props: PtoTaskWarningProps): JSX.Element | null;
```

- **Owner check, once on mount, keyed on `ownerId`.** `ownerId === null` → own. Otherwise
  `seam.getCurrentMember()`; own iff its `id === ownerId`. Not own, a null member, or a throw → render
  `null` for the component's life and never call `listTasks` (AC-6, AC-8).
- **Read.** When own, `type === "pto"` and `dates.length > 0`: after `dates` stops changing for 300 ms,
  `seam.listTasks(dates[0], dates[dates.length - 1])`. Each request carries a number; an answer that is
  not the latest is dropped (AC-9). Changing `dates` clears what is held before the new read. A throw →
  nothing (AC-8). `type` changing does **not** refetch: the fetched tasks are held and the component
  renders `null` while `type !== "pto"` (AC-3).
- **Render.** `openTasksOnDays(fetched, dates)`; empty → `null` (AC-2). Otherwise the block of § 2b
  with `role="status"`, `aria-live="polite"`. It receives nothing that reaches the submit control
  (AC-5, by construction, as `OverloadWarning`).
- Chip label `format(parseISO(date), "EEE d MMM")`, as `Tasks.tsx`.

### 4.3 Form and page

**`src/components/EntryForm.tsx`.** One element, after the `runs.map(… <OverloadWarning …/>)` block
and before the `gapped` sentence:

```tsx
<PtoTaskWarning ownerId={ownerId} type={type} dates={dates} testIdPrefix={testIdPrefix} />
```

No prop of `EntryFormProps` changes; `EditEntry.tsx`, `NewEntry.tsx` and `MonthView.tsx` are
untouched — the edit route already passes `ownerId={entry.memberId}`.

**`src/routes/Tasks.tsx`.**

- `const { member } = useShellContext();`
- `const [ownEntries, setOwnEntries] = useState<Entry[] | null>(null);` filled by one `useEffect` on
  mount calling `seam.listOwnEntries()`; a throw leaves it `null` (AC-13). **Separate from `load()`**,
  so a failed entries read never fails the task list, and a task change never re-reads entries.
- `const pto = ownEntries ? ptoCovering(ownEntries, member.id, day) : null;`
- `openCount` = the day's list (`ready.tasks`) counted by `ticker.shown(t).done === false` — the same
  shown state the rows use, so AC-12's count follows a tick at once.
- When `pto` is non-null, the pill beside `tasks-day-heading`:
  `On PTO{ptoFlagSuffix(pto.portion, pto.tentative, openCount)}`.

### 4.4 Selectors

| Id | Where | AC |
|---|---|---|
| `<p>-task-warning` | the warning block; `<p>` ∈ `new-entry`, `edit-entry`, `month-entry` | AC-1 to AC-9 |
| `<p>-task-warning-count` | N in the heading | AC-1 |
| `<p>-task-warning-task` | each row; `data-task-id`, `data-date` | AC-1, AC-2, AC-4 |
| `<p>-task-warning-date-chip`, `<p>-task-warning-title` | inside a row | AC-1 |
| `tasks-pto-flag` | the pill; `data-entry-id`, `data-portion`, `data-tentative`, `data-open-count` | AC-10 to AC-13 |

**Copy**, English: *You have N open tasks on these days* / *You have 1 open task on these days*;
*Saving is not blocked. Move them on your task page if you need to.*; *On PTO*, *· morning*,
*· afternoon*, *· tentative*, *· 1 open task* / *· N open tasks*.

## 5. Seam impact

**None.** `listTasks`, `getCurrentMember` and `listOwnEntries` are called as declared; no function is
added or changed, and `tests/seam-parity.test.ts` is untouched.

**Invariants — how each is held (R8).** None touched (§ 2). AC-14 is the fence: nothing in
`absence.ts`, `busy.ts`, `day-status.ts`, `OverloadWarning.tsx`, `draft-entry.ts`, any calendar route
or the notification code is edited.

**Tests.**

- **`tests/pto-tasks.test.ts`** (new), against the pure module:
  - `openTasksOnDays`: done excluded; unchosen day excluded, including a day inside a gap; order by
    date then `createdAt` then `id`; input not mutated (AC-1, AC-2).
  - `ptoCovering`: pending and approved PTO covering the day match; rejected, WFH, another member's,
    and a range not covering the day do not; first and last day of a range are covered; two matches →
    earliest start (AC-10, AC-11).
  - `ptoFlagSuffix`: each portion, tentative, 0 / 1 / N open (AC-10).
- **`tests/e2e/tsk-03-pto-task-warning.spec.ts`** (new), against the mock seam, clock pinned as in
  `tsk-01-tasks.spec.ts`. **A `page.goto` resets the mock's tables**, so every journey creates tasks on
  `/tasks` and then reaches the form or the page **by clicking** (sidebar, calendar), and changes user
  by sign-out and sign-in in the same page, as TSK-02 does.
  - AC-1, AC-2: two open tasks tomorrow, one done tomorrow, one the day after; in `/entries/new`
    choose tomorrow as PTO → warning, count 2, two rows with chips, not the done one; add the day
    after → count 3.
  - AC-3: switch to WFH → gone; back to PTO → shown.
  - AC-4: morning, then tentative → same rows.
  - AC-5: save → entry saved (the form's success path), tasks unchanged on `/tasks`.
  - AC-6: member creates tasks and a PTO entry tomorrow; sign out; admin signs in, creates their own
    task tomorrow, opens the member's entry edit by clicking → no `edit-entry-task-warning` after
    1 s; opens their own PTO entry tomorrow → warning lists the admin's task only.
  - AC-7: teammate's tasks tomorrow, member signs in and chooses tomorrow PTO → no warning.
  - AC-10, AC-12: PTO morning tomorrow with two open tasks → `/tasks` next day shows *On PTO ·
    morning · 2 open tasks*; tick one → *1 open task*.
  - AC-11: WFH tomorrow → no flag on that day; today with no entry → no flag.
  - The `month-entry` prefix: one journey through the month view's dialog → warning shown (AC-1).
  - AC-8, AC-9 and AC-13's failure paths are not driven here: the mock has no fault switch, and adding
    one is a seam-file change (TSK-05 § 5's reasoning). They are held by the component's structure,
    which § 4.2 specifies and R5 reads.
- **Existing suites unaffected by construction**: every `cal-0x` journey starts with an empty task
  table, so the warning never renders there; no existing spec is in `allowed_paths`. If one turns out
  to need a change, the Developer stops.

## 6. Schema delta

**`none`.** No table, column, policy, grant, function or trigger is touched. `requires_adr: true` in
`ticket.yaml` is satisfied by ADR-057 (`ACCEPTED by the operator`), which this ticket implements inside
its fence and does not amend.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/pto-tasks.ts"
  - "src/components/PtoTaskWarning.tsx"
  - "src/components/EntryForm.tsx"
  - "src/routes/Tasks.tsx"
  - "tests/pto-tasks.test.ts"
  - "tests/e2e/tsk-03-pto-task-warning.spec.ts"
```

**Glossary:** `glossary_owed` is `[]`. *Task* and *Overdue* already have rows (TSK-01); nothing is
written to `glossary.md`.

**Six paths: `size: S`, agreeing with `size_estimate: S`.** **Deliberately absent:**
`src/routes/EditEntry.tsx`, `NewEntry.tsx`, `MonthView.tsx` (the form carries the warning, and the edit
route already passes the owner); `src/components/OverloadWarning.tsx` (sits beside, untouched); every
file under `src/lib/data/` (§ 5).

## 8. Rejected alternatives

**1. Merge the task list into `OverloadWarning`.** One block under the grid, one debounce. Rejected:
`OverloadWarning` is per run and computes INV-04 from team rows; a task list is per selection, owner-
only and private. Folding a private read into the component INV-04 depends on puts ADR-057's fence and
INV-04's in one file, and AC-14 would then rest on review rather than on the file boundary.

**2. Pass `isOwn` from each route instead of resolving it in the component.** The edit route already
holds `me`. Rejected: it adds a prop to `EntryFormProps` and edits three routes, each of which must get
it right; resolving it next to the read, as `OverloadWarning` resolves its owner, keeps the rule in one
place and leaves the routes untouched.

**3. A new seam read `listOwnPtoOn(day)` for the task page flag.** Exact and small on the wire.
Rejected: a seam member in three implementations plus parity, for a list `listOwnEntries` already
returns bounded; the filtering is a pure function and testable without a datastore.

**4. Warning about every task on the days, done ones struck through.** Closer to *"tasks on those
days"* read literally. Rejected (reading 1): a done task asks nothing of the member, and the block's
job is to show what an absence puts at risk; a long PTO full of finished work would bury the one open
task.

## Changelog

- `2026-10-17T23:14:24+0700` — section 2 was written from the feature row, the idea file and ADR-057
  before the source tree was read for sections 3–8. Reading the code amended no AC. It confirmed AC-6's
  reason: `listTasks` takes no member, so on another member's entry it would return the admin's own
  tasks — a wrong warning rather than a leak — which § 3 now records. Raised by `tech-lead-design`.
