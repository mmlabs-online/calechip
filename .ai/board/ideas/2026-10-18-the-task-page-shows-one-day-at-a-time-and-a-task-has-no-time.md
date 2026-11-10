---
stage: TRIAGE
agent: product
produced_at: 2026-10-18T19:39:35+0700
inputs_read:
  - src/routes/Tasks.tsx (selector set: tasks-page, tasks-list, task-row, task-done, task-edit, task-move, task-delete, tasks-overdue, tasks-pto-flag, tasks-prev-day, tasks-next-day, tasks-today)
  - supabase/migrations/20261015120000_tsk01_task.sql (columns id, member_id, date, title, note, done, created_at — no time, no priority)
  - .ai/standards/ui-design-system.md § Language
  - .ai/registry/decisions/ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md
  - supabase/migrations/20261008120000_evt04_notification.sql, supabase/functions/send-event-email (no scheduler exists)
  - .ai/board/ideas/2026-10-15-ticking-a-task-done-waits-two-round-trips-and-locks-the-box.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE          # not the routing input — see `verdict` below
verdict: PROMOTE
verdict_reason: "Worth building and covered by no shipped TSK row; its one schema decision, an optional time of day, is ADR-062, ACCEPTED by the operator (Q11)."
ticket_id: "TSK-06"
awaiting_adrs: []
operator_request: "thay đổi UI của page task như hình trên"
---

# The task page shows one day at a time, and a task has no time

## Problem

*Derived from the request above; the operator stated a solution (a mockup), not a problem.*

`/tasks/<day>` shows one day's list with previous/next arrows. A member cannot see where they stand
on the week: which days already have tasks, which are finished, and how much is left. Nor can they
say *when* in the day a task falls. Today a task has a date and no time, so a 14:00 item and an
item for anytime that day look the same, and appear in the order they were created.

## Who has it

Every member who uses `/tasks`, each time they open it to plan or check off a day.

## Evidence

Visual reference: `.ai/board/tickets/TSK-06/design/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time.png`
(moved from `.ai/board/ideas/` at `/triage` on PROMOTE).
It settles the **arrangement** of the screen: a week strip on top, the selected day's list with a
progress bar, an add form under the list, and a week summary card on the side. The strings in it are
Vietnamese and the product is English (Q1). It also shows a priority level, which is rejected (Q3).

Visual reference, the row's actions:
`.ai/board/tickets/TSK-06/design/2026-10-18-the-task-page-shows-one-day-at-a-time-and-a-task-has-no-time-row-actions-1.png`,
`…-row-actions-2.png` and `…-row-actions-3.png` in the same folder (moved from `.ai/board/ideas/`
at `/triage` on PROMOTE). These settle **where Q4's edit, move and delete sit**:
three icon buttons at the right of the row, in the order pencil (edit), arrow (move to a date) and
bin (delete). Each has a tooltip, and the bin turns pink on hover. The operator, sending them on
2026-10-18: *"UI của mỗi task trong list có thêm Nút edit, xóa, và move ngày"*. The arrow is the
existing **Move to a date**, not Q10's rejected one-tap "move to tomorrow". The tooltip strings are
Vietnamese and become English (Q1).

Questions asked at `/idea` on 2026-10-18, with the operator's answers verbatim:

- **Q1. Language.** The mockup is in Vietnamese. `ui-design-system.md` § Language says every UI
  string is English (the operator, 2026-09-03: *"tôi muốn tất cả content đều là tiếng anh"*).
  — **"Giữ tiếng Anh (Recommended)"**. Take the layout, translate the strings; the standard is unchanged.
- **Q2. Time on a task.** The mockup shows 14:00 and 16:30; a task has no time today.
  — **"có thể thêm giờ hoặc không, default là không có giờ. coi như giờ là là extra info"**.
  An optional time of day, empty by default, extra information.
- **Q3. Priority (Cao / Vừa / Thấp).** — **"Không thêm ưu tiên"**.
- **Q4. Shipped behaviour the mockup does not show:** edit, delete, move to another date (TSK-01),
  the overdue list and "move all to today" (TSK-02), the PTO flag on a day (TSK-03).
  — **"Giữ tất cả (Recommended)"**. All of it stays, in the new arrangement.
- **Q5. Does the time change the order of a day's tasks?** (Today: creation order.)
  — **"Chưa xong trước, rồi theo giờ"**. Not-done tasks first and done tasks after. Within each group,
  tasks with a time come first in time order, then tasks without a time in creation order.
- **Q6. Does the time do anything besides being shown (a reminder, a notification, a block on the
  calendar)?** — **"Có nhắc việc"**. Followed by Q7.
- **Q7. A reminder needs a background scheduler, which the app does not have. Same ticket or a
  separate one?** — **"Tách thành idea riêng (Recommended)"**. See `## Out of scope`.
- **Q8. Reminder channel** (kept for the reminder idea). — **"Thông báo trong app"**.
- **Q9. Reminder timing** (kept for the reminder idea). — **"Người dùng tự chọn"**.
- **Q10. The mockup's caption says unfinished tasks move to tomorrow with an arrow button. Add a
  one-tap "move to tomorrow"?** — **"Không, chỉ giữ Move"**. The caption is dropped from the design.

- **Q11, asked at `/triage` on 2026-10-18, because the time reverses part of an accepted ADR.**
  *"ADR-062 thay thế một phần ADR-057 (quyết định 6 — câu trả lời F1 của bạn ngày 2026-10-12: "Task
  chỉ có 2 trạng thái done hay chưa. Không mang thời gian cụ thể, chỉ tính theo ngày"): task được có
  giờ trong ngày, tuỳ chọn, mặc định trống, chỉ để hiển thị và sắp xếp. Vẫn KHÔNG có ước lượng, thời
  lượng, giờ làm hay nhắc việc; "quá hạn" vẫn tính theo ngày; từ chối số 3 của charter giữ nguyên.
  Đồng ý?"* — **"Đồng ý"**. ADR-062 is `ACCEPTED by the operator` on this quote.

**Guesses made by `product`. Each is cheap to reverse, and PLAN may overrule any of them:**

- Week strip, one cell per day Monday–Sunday: `✓` when the day has tasks and all are done, `done/total`
  when some are not, `–` when the day has none. Selecting a cell opens `/tasks/<that day>`; the
  strip's arrows move a week.
- Week summary: the viewer's own tasks dated in the shown week, as done / total, plus the count done
  and the count remaining (not done).
- Day progress bar: done / total for the selected day.
- The time is a time of day `HH:MM` with no time zone of its own, read like every date in the app
  (Asia/Ho_Chi_Minh). It can be set, changed and cleared when adding and when editing. A move to
  another date keeps it.
- The overdue list (TSK-02) keeps its current order and shows a task's time when it has one.
- Row actions: the three icons sit at the right of every row, done or not, in both the day list and
  the overdue list. They are shown on hover and on keyboard focus, and always on a touch screen,
  which has no hover. Each icon has an accessible name equal to its tooltip. They open the existing
  edit, move and delete flows. Edit covers title, note and now the time; delete keeps its confirm
  step. The mockup's tooltip on the pencil reads *"Sửa tiêu đề"* (edit title), but the existing edit
  also covers the note. That is kept rather than narrowed.

## Impact if ignored

The page stays one day at a time. To see how the week is going, a member has to step through seven
days one by one, and nothing on the page says when a task is due within its day.

## Constraints already known

- **A schema change.** An optional time needs a new nullable column on `public.task`. That is a
  migration, so `schema_delta` is not `none` and RULE-09 wants its ADR before the ticket exists.
- ADR-057: a task is readable and writable by its owner only. The week strip and the summary read
  only the viewer's own tasks, through the same `task_select_own` policy.
- `ui-design-system.md` § Language: every new string is English, and the lint enforces it.
- TSK-01 to TSK-05 acceptance tests keep passing. The order of a day's list changes (Q5), so any
  TSK-01 criterion that fixes creation order is amended at PLAN rather than broken.
- TSK-04's week-view badge counts tasks, not times, and is unchanged.

## Out of scope

- **Priority levels** (Q3).
- **A one-tap "move to tomorrow" button** (Q10). Move, to any date, stays as it is.
- **Reminders** (Q6, Q7). They belong to a separate idea, which carries Q8 (*"Thông báo trong app"*,
  using the EVT-04 notification bell) and Q9 (*"Người dùng tự chọn"*, so a per-task lead time, which
  is one more column). That idea also needs an ADR for the scheduler, since nothing in the app runs
  on a clock today.
- A Vietnamese interface (Q1).
- Showing tasks on the calendar grids beyond TSK-04's existing week badge.
- Anyone else's tasks, in any role.

## Open questions

None for this idea. The reminder idea still has decisions open: which lead times are offered, the
default, and what happens when a task's date, time or done state changes after its reminder fires.
They are asked when that idea is captured.

## Triage verdict — PROMOTE, as TSK-06

*By `product`, 2026-10-18T19:45:54+0700.*

**PROMOTE.** The problem is real for every member who uses `/tasks`, and no shipped row covers it:
TSK-01 gave the page one day at a time and a task with no time, TSK-04's week badge is on the
calendar and not on the task page. Not worth splitting: the week strip, the summary, the progress bar
and the row actions are one rearrangement of one page, and the time is one column that the same page
sets, shows and orders by.

**The schema decision is made.** [ADR-062](../../registry/decisions/ADR-062-a-task-may-carry-an-optional-time-of-day.md)
is `ACCEPTED by the operator` on Q11 above. It supersedes ADR-057 decision 6 in part, and only as to
a time of day. `awaiting_adrs` is `[]`.

**Feature row:** `TSK-06` in `.ai/registry/features.md`, `PLANNED`, written by `product` (ADR-007).
**Ticket:** `.ai/board/tickets/TSK-06/ticket.yaml`, `state: BACKLOG`, `depends_on: [TSK-01, TSK-02,
TSK-03, TSK-05]`, all `DONE` (the page, the overdue list, the PTO flag and the tick it rearranges;
TSK-04's badge is unchanged). `schema_delta` is not `none` and cites ADR-062.
**Images:** moved to `.ai/board/tickets/TSK-06/design/` and cited from § *Evidence*.

**Owed, and PLAN's:** the glossary row *Task* says it *"carries no time of day"*, which ADR-062
reverses, and *Time of day* has no row; both are in `glossary_owed`. TSK-01 AC-20 and its test are
amended, not deleted (ADR-062 § *Consequences*). The ADR-057 `## Status` note and the `data-model.md`
`task` entity are ADR-062 § *Affected documents*, human and standards plane. `invariants_touched`
and `size_estimate` are PLAN's and left empty. The guesses in § *Evidence* are PLAN's to confirm or
overrule.
