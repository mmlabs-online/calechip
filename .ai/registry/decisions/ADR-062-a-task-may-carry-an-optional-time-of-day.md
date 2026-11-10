---
doc_version: 3
last_updated: 2026-10-18
governed_by: [RULE-01, RULE-09]
---

# ADR-062 — A task may carry an optional time of day, empty by default, and nothing reads it but its owner's page

## Status

`ACCEPTED by the operator` — 2026-10-18. Asked the one question below, in the `/triage` session,
the operator answered **"Đồng ý"**. Recorded verbatim as Q11 in the idea file's § *Evidence*.

*Until then `PROPOSED`, and the paragraphs below are why.* Drafted by `tech-lead-design` at `/triage` of
`.ai/board/ideas/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time.md`,
2026-10-18T19:45:54+0700.

**Why this is not `ACCEPTED by the operator`, although the operator's words are on file.** The idea's
§ *Evidence* records, verbatim:

> Q2 (time on a task): **"có thể thêm giờ hoặc không, default là không có giờ. coi như giờ là là
> extra info"**
>
> Q5 (order): **"Chưa xong trước, rồi theo giờ"**

Those words settle *what* is wanted. They do not settle that it **reverses an accepted ADR**, because
Q2 was asked as *"a task has no time today"* and not as a reversal. [ADR-057](ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md)
decision 6 is the operator's own F1, 2026-10-12: *"Task chỉ có 2 trạng thái done hay chưa. Không
mang thời gian cụ thể, chỉ tính theo ngày"*, and its revert condition 2 says a time-bearing field
without a new ADR is removed, and that *"Refusal 3 is argued with in the charter first, or not at
all."* This ADR is that new ADR. It supersedes ADR-057 **in part**, so the `/triage` rule and
ADR-008 require the operator to sign the reversal rather than an agent reading it into Q2.

**The one question.** *ADR-062 thay thế một phần ADR-057 (quyết định 6 — câu trả lời F1 của anh/chị
ngày 2026-10-12: "Không mang thời gian cụ thể"): task được có **giờ trong ngày, tuỳ chọn, mặc định
trống**, chỉ để hiển thị và sắp xếp. Vẫn KHÔNG có ước lượng, thời lượng, giờ làm hay nhắc việc;
"quá hạn" vẫn tính theo ngày; từ chối số 3 của charter giữ nguyên. Đồng ý?* To answer, edit this
line to `ACCEPTED by the operator — <date>` or `REJECTED by the operator — <date>`.

**Supersedes in part:** ADR-057 decision 6 (the *"no time of day"* clause only) and revert condition
2 (only as it applies to a time of day). Every other decision of ADR-057 stands in full: ownership,
the four policies, decision 3's *no other read path*, decision 5's scope, decision 7's overdue rule.
[ADR-005](ADR-005-authorization-in-rls.md) and [ADR-058](ADR-058-tsk-is-a-sixth-feature-group.md)
stand in full.

## Context

- `public.task` (`supabase/migrations/20261015120000_tsk01_task.sql`) has seven columns: `id`,
  `member_id`, `date`, `title`, `note`, `done`, `created_at`. None holds a time. A day's list is in
  creation order.
- ADR-057 decision 6 refused *"time of day, estimate, hours worked, duration"* as one set, on charter
  refusal 3 (*"It will never do timekeeping, payroll, or hours tracking"*). Its rationale rejected a
  nullable time column *"left nullable for later"* as a decision deferred to whoever fills it.
- The operator now asks for exactly one member of that set, a time of day, optional and empty by
  default, as *"extra info"* (Q2), and for it to order a day's list after done state (Q5). Reminders
  were asked (Q6) and split to a separate idea (Q7), so this ADR gives the time **no behaviour**.
- The code states the old decision in several places that must change together: `Task` in
  `src/lib/domain/types.ts` (*"NO TIME FIELD OF ANY KIND, and there must never be one"*), `TaskRow`
  and `TASK_COLUMNS` in `src/lib/data/supabase.ts`, `src/routes/Tasks.tsx` (*"NO TIME OF ANY KIND IS
  SHOWN"*, TSK-01 AC-20), and `tests/tasks.test.ts` § *TSK-01 AC-20 — a task carries no time*, which
  asserts the exact seven columns and the exact seven `Task` keys.
- `.ai/standards/data-model.md` (doc_version 8) has no `task` entity yet. ADR-057 owed it and it has
  not landed.
- Nothing in the app runs on a clock (the idea's § *Inputs read*: no scheduler exists).

## Decision

1. **`public.task` gains one column, `time_of_day time without time zone null`, default null.** A
   task with no time is the default and the normal case (Q2, *"default là không có giờ"*).
2. **Whole minutes only.** `constraint task_time_of_day_shape check (time_of_day is null or
   extract(second from time_of_day) = 0)`. The seam carries it as `timeOfDay: string | null`, `HH:MM`,
   24-hour. It has no time zone of its own and is read, like every date in the app, as wall-clock time
   in `Asia/Ho_Chi_Minh`.
3. **The owner writes it like any other field.** The column-level grants become `insert (date, title,
   note, time_of_day)` and `update (date, title, note, done, time_of_day)`. It can be set, changed and
   cleared when adding and when editing. Moving a task to another date keeps its time.
4. **It is extra information and drives nothing** (Q2, *"coi như giờ là là extra info"*). It is shown
   and it orders a day's list, and that is all. **A task is still overdue by its date alone** (ADR-057
   decision 7, unchanged): a 09:00 task is not overdue at 10:00 the same day. It is in no count, no
   badge, no warning, no notification and no reminder.
5. **The order of one day's list** (Q5): not-done before done; within each group, tasks with a time
   first in ascending `time_of_day`, then tasks without one in ascending `created_at`. In SQL terms,
   `order by done, time_of_day nulls last, created_at`. Where the order is applied, datastore or
   seam, is `/plan`'s, provided the mock and Supabase seams give the same order. The overdue list
   (TSK-02) keeps its own order.
6. **No other time-bearing field.** No end time, no duration, no estimate, no hours worked, no
   reminder lead time. Each still needs its own ADR, argued against charter refusal 3. A reminder in
   particular needs the scheduler ADR the reminder idea already names.
7. **Ownership and isolation are unchanged** (ADR-057 decisions 1 to 5). The four policies are not
   touched: the new column is read and written under `task_select_own`, `task_insert_own`,
   `task_update_own` and `task_delete_own` exactly as the other columns are. No function, trigger,
   notify, view or publication reads it.

## Rationale

**Chosen: a nullable `time` column (decision 1).** It is exactly what Q2 describes: optional, empty
by default, a wall-clock time inside a day the row already dates. PostgreSQL's `time` sorts
natively, so Q5's order is one `order by`. `date` stays the single truth for which day a task is on,
so overdue (ADR-057 decision 7), move (TSK-01), the overdue prompt (TSK-02), the PTO flag (TSK-03)
and the week badge (TSK-04) read nothing new. Cost: one nullable column, two grant lists re-issued,
and one more field in the mock to keep clause-for-clause with the datastore.

**Rejected: a `timestamptz` (`due_at`) replacing or beside `date`.** Beside `date`, the day is stored
twice, and a move must rewrite both or they disagree. Replacing `date`, every existing reader of
`date` changes, a task with no time needs a sentinel instant, and a zone-bearing instant reopens the
*"which clock decides today"* question ADR-057 decision 7 handed to `/plan` and TSK-01 already
answered. It also reads as a deadline, which is a step toward the timekeeping refusal 3 guards.

**Rejected: `text` holding `HH:MM` with a pattern check.** It sorts correctly when zero-padded, but
the datastore no longer knows it is a time, `24:00` and `07:5` need their own clauses, and every
reader parses it. `time` gives the same storage with the type doing the checking.

**Rejected: two `smallint` columns, hour and minute.** Two nullable columns that must be null
together need a cross-column check, and ordering needs both. No gain over one `time`.

**Rejected: the time typed into the title or the note.** No schema change, and that is its only
merit. It cannot be ordered (Q5), cannot be cleared separately, and a convention inside free text is
a field nobody declared (RULE-04).

**Rejected: also adding a reminder lead time now, "since the reminder idea will want it".** That is
ADR-057's own rejected *"nullable for later"*, and Q7 split reminders out.

## Consequences

- **What gets worse: refusal 3's guard is now one field thinner.** ADR-057 refused the whole family
  of time-bearing fields together. With a time of day admitted, the next request (an end time, a
  duration) is a smaller step and will look like a natural extension. Decision 6 exists so that step
  is an ADR and a charter argument, not a column.
- **What gets worse: the reminder idea now has a target.** A time of day invites *"remind me at
  14:00"*. That idea still needs a scheduler, a lead-time column and its own ADR. This ADR gives it
  none of them.
- **What gets worse: TSK-01's AC-20 and its test are reversed.** `tests/tasks.test.ts` § *AC-20*
  asserts no column matching `/time/` and exactly seven `Task` keys. The ticket that implements this
  ADR must amend AC-20 in its plan and replace that test with one asserting `time_of_day` is the
  only time-bearing column, and that no `interval`, `timetz`, duration, estimate or hours column
  exists. Deleting the test rather than narrowing it would lose the remaining guard.
- **The day's order changes for everyone**, including members who never set a time: done tasks move
  below not-done ones (Q5). Any TSK-01 criterion fixing creation order is amended at `/plan`.
- **The migration is additive and idempotent** (ADR-024): `alter table ... add column if not exists`,
  the constraint added guarded, grants revoked and re-granted. Existing rows get null, which is the
  correct value for every one of them. Applying it is human (RULE-09).
- **A time zone cannot be inferred from the value.** A member travelling outside `Asia/Ho_Chi_Minh`
  sees `14:00` as written. That is intended: it is a note about the member's own day, not an instant.
- **Privacy is unchanged** (ADR-057). The column inherits the owner-only policies and the decision 5
  scope, including its stated limit: the project owner and the service-role key can read it.

## Revert condition

Any one occurrence:

1. **Anything other than the owner's own task page and the seam reads `time_of_day`** to decide
   something: a count, an overdue test, a badge, a warning, a notification, a scheduler, a report.
   On observation: that reader is removed, or the reminder ADR that authorises it is written first.
   This ADR is not edited to allow it.
2. **A second time-bearing field appears on `public.task`** (end time, duration, estimate, hours,
   lead time) without its own ADR. On observation: the field is removed, as ADR-057 revert condition
   2 already says.
3. **The operator says the time is not wanted after all**, or asks for it to become required. On
   observation: a new ADR supersedes this one; a drop-column migration is human (RULE-09).
4. **The operator rejects the Status question above.** On observation: this ADR is marked
   `REJECTED`, ADR-057 decision 6 stands as written, and the idea proceeds without Q2 and Q5's
   time clause.

## Affected documents

| File | Change |
|------|--------|
| `.ai/registry/decisions/ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md` | On acceptance, its `## Status` gains *"Decision 6's time-of-day clause and revert condition 2, as to a time of day, SUPERSEDED by ADR-062"*. Registry plane, human approval (RULE-01). Not written by this draft. |
| `.ai/00-charter.md` | The no-time sentence ADR-057 owed beside refusal 3 has not landed. When it does, it reads that a task carries no duration, estimate or hours, and may carry an optional time of day as information only (ADR-062). Human plane. |
| `.ai/standards/data-model.md` | doc_version 8 → 9. The `task` entity ADR-057 owed, now including `time_of_day time null`, the `task_time_of_day_shape` check, and the day order of decision 5. Standards plane. |
| `.ai/standards/rbac-and-security.md` | Only if it lists the task column grants: `time_of_day` joins the insert and update lists. No policy change. |
| `supabase/migrations/<timestamp>_<ticket>_task_time_of_day.sql` | New, additive, idempotent: the column, the check, the re-issued grants. The TSK-01 migration is not edited. |
| `supabase/db.sql` | Brought level under MD-033, as for TSK-01. |
| `src/lib/domain/types.ts` | `Task` gains `timeOfDay: string \| null` (`HH:MM`); its *"NO TIME FIELD OF ANY KIND"* comment is rewritten to cite ADR-062 decision 6. |
| `src/lib/data/supabase.ts` | `TaskRow` gains `time_of_day: string \| null`, `TASK_COLUMNS` gains `time_of_day`, `toTask` maps it to `HH:MM`. |
| `src/lib/data/index.ts`, `src/lib/data/mock.ts` | The create and update inputs gain the optional time; the mock reproduces the check and the order. Exact signatures are `/plan`'s § 4. |
| `src/routes/Tasks.tsx`, `tests/tasks.test.ts` | TSK-01 AC-20 amended at `/plan` of the implementing ticket, per § *Consequences*. |
| `.ai/registry/features.md` | The implementing ticket's row cites ADR-062. `product`'s, not this draft's. |
| `.ai/registry/invariants.md` | None. The time enters no invariant; INV-04, INV-05 and INV-07 are not engaged. |
