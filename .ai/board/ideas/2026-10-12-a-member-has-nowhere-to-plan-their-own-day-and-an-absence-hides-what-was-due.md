---
stage: TRIAGE
agent: product
produced_at: 2026-10-12T10:27:12Z
inputs_read:
  - CLAUDE.md
  - .ai/00-charter.md
  - .ai/registry/features.md
  - .ai/templates/idea.md
  - .ai/board/backlog.md
  - .claude/commands/triage.md
  - .ai/registry/decisions/ADR-000-template.md
  - .ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md
  - .ai/registry/decisions/ADR-046-evt-is-a-fifth-feature-group.md
  - .ai/registry/decisions/ADR-056-an-event-description-is-sanitised-html-from-one-editor.md
  - supabase/migrations/20261008120000_evt04_notification.sql
  - .ai/registry/glossary.md
  - .ai/templates/ticket.yaml
consulted: [tech-lead-design]
gate: PASS
blocking_reason: ""
next_state: TRIAGE
verdict: "PROMOTE"
verdict_reason: "Worth building and not covered: a member has nowhere in the product to keep their own day's work, and booking PTO is blind to it; nothing on the board proposes it. It is the first member-written data nobody else reads, an exception to the charter's transparency, so ADR-057 is owed. Answer 1, F1 and F2 are quoted verbatim, so it is ACCEPTED by the operator and supersedes nothing. ADR-058 adds the TSK group (ACCEPTED by product, ADR-046 precedent). Split here (MD-017) into four rows on one foundation."
ticket_id: "TSK-01, TSK-02, TSK-03, TSK-04"
awaiting_adrs: []
operator_request: "Tôi muốn thêm tính năng cho riêng mỗi user. Về việc lên danh sách task cho ngày. Brainstorm cho idea này"
---

# A member has nowhere to plan their own day, and an absence hides what was due on it

**No verdict is written here.** This file is capture, not judgement. The verdict and any registry row
that follows one are written by `/triage`.

## Problem

*Derived from the request above and the brainstorm that followed it. The operator stated a
solution, not a problem.*

A member's work for a given day lives outside CaleChip, so when they declare PTO the product cannot
tell them what was due on those days. The charter's own cost, *"a handover arranged the night
before"* (`.ai/00-charter.md`), begins exactly there: the person booking the leave does not see, at
the moment of booking, what they had planned for the days they are leaving. Separately, unfinished
work from earlier days has no place to resurface, so it quietly drops.

## Who has it

Every member, daily for their own planning, and at the moment of declaring PTO.

## Evidence

The operator's request, verbatim above. A brainstorm (2026-10-12) offered four directions:
- A: tasks on a day, warned when that day becomes PTO.
- B: a handover list.
- C: a WFH-day plan.
- D: a plain to-do list.

**The operator chose: "đi theo hướng A"**, and answered the brainstorm's seven questions in one
message, quoted verbatim:

> 1. Tạm thời scope sẽ là riêng tuyệt đối
> 2. có hẳn 1 danh sách theo ngày. Ví dụ hôm nay thứ 3, khi bật app lên mà task trước thứ 3 còn chưa
>    tick done thì hiện thông báo cho user để tick hoàn thành hoặc cho 1 option move tất cả qua thứ 3.
> 3. Chưa cần bây giờ. Note lại vào todo để sau này làm
> 4. Nhắc lúc book PTO, Và cả trong trang task
> 5. có cho phép lặp lại. Note lại vào todo để sau này làm
> 6. Không đồng bộ
> 7. 1 trang riêng. Trên calendar hiện tại chỉ hiện cho thấy số lượng task và số lượng hoàn thành
>    trong ngày (nếu có). Ví dụ "icon task" 5/10

The brainstorm questions they answer, in order:
1. Private or team-visible.
2. A dated list, with carry-over.
3. Handover (B) now.
4. Where the PTO reminder shows.
5. Recurrence, priority, labels.
6. Sync with ClickUp or Jira.
7. Where tasks are displayed.

Follow-up questions at `/idea`, with each answer as picked, verbatim:

**F1: confirming the ADR.** Asked: *"CaleChip có thêm dữ liệu riêng tư đầu tiên: task cá nhân theo
ngày, chỉ chủ sở hữu đọc và ghi được, admin cũng không đọc được, ngoại lệ với nguyên tắc minh bạch
của charter. Task không bao giờ mang giờ (ước tính hay đã làm), để không chạm refusal 3. Charter
được bổ sung một đoạn ghi điều này." Đúng ý anh/chị không?*
**Answer: "Task chỉ có 2 trạng thái done hay chưa. Không mang thời gian cụ thể, chỉ tính theo ngày,
qua ngày hôm sau thì gọi là quá hạn".** The answer restates and sharpens the no-time half. The
privacy half, owner-only with admins included, rests on answer 1, *"riêng tuyệt đối"*. `/triage`
should read the two together. If it judges that "admin cũng không đọc được" needs words of its own,
that is the one question to ask.

**F2: the privacy half, asked at the start of `/triage` on 2026-10-12.** Asked: *"Để ADR ghi
'ACCEPTED by the operator' có căn cứ rõ ràng, xin xác nhận: task cá nhân chỉ chủ sở hữu đọc và ghi
được; admin và manager cũng không đọc được (kể cả qua DB khi dùng app); charter được bổ sung một
đoạn ghi ngoại lệ này với nguyên tắc minh bạch."* A: đúng; B: admin được đọc.
**Answer: "A: Đúng".** This closes the gap F1 left.

**Q8: what a task carries.** A: a title and done/not done; B: as A plus a short plain-text note;
C: as B plus a priority.
**Answer: "B: + ghi chú ngắn".**

**Q9: when the overdue prompt shows.** A: once a day, dismissable; B: every time the app opens while
overdue tasks remain; C: as A plus delete. In each, the prompt offers ticking tasks done or moving
all of them to today.
**Answer: "B: Mỗi lần mở app".**

**Q10: which calendar view shows the task count** (the viewer's own tasks only). Month / Week / Year.
**Answer: "Week".**

**Q11: what the PTO reminder does.** It never blocks saving (refusal 6). A: a warning only, in the
PTO form like the overload warning, listing the tasks; B: as A plus "move all to the next working
day after the PTO".
**Answer: "A: Chỉ cảnh báo".**

**Q12: PTO only, or WFH too.**
**Answer: "A: Chỉ PTO".**

**Q13: which dates a task may be created on.** A: today and later, with past tasks still viewable,
tickable and movable; B: any date.
**Answer: "A: Hôm nay và tương lai".**

## Impact if ignored

Members keep their day's work somewhere else. Booking PTO keeps happening blind to what was planned
for those days, and the handover is still arranged the night before.

## Constraints already known

- **A new ADR is owed. It is the first private data in the product.** Today every member reads the
  whole team's calendar by design (`.ai/00-charter.md` § *Who uses it*). A task is readable and
  writable by its owner only, and not by an admin or a manager (answer 1, *"riêng tuyệt đối"*).
  The charter gains a paragraph recording this exception. The confirmation is F1 together with
  answer 1; see § Evidence.
- **Charter refusal 3 stands.** A task has exactly two states, done and not done. It carries no
  time, no estimate and no hours, only a date. It is *overdue* once its date has passed while it
  is not done (F1).
- **Charter refusal 6 stands.** The PTO reminder never blocks saving (Q11-A).
- **The reminder fires for PTO only** (Q12-A). It shows in the PTO entry form, where the overload
  warning already shows (CAL-07), and on the task page (answer 4). An admin or manager creating or
  editing another person's entry (CAL-03) cannot read that person's tasks, so no reminder is shown
  to them. A task is not an entry, and INV-04, INV-05 and INV-07 are not engaged: tasks never
  enter an absence count.
- **The week view shows only the viewer's own count** (Q10, answer 7). The count is an icon plus
  done/total, e.g. 5/10, and shows only on days that have tasks. Month and year views get nothing.
  `CLAUDE.md` § *Visual direction*: density wins on the grid, so the count must not cost a row.

## Out of scope

**Deferred by the operator: the "todo" the operator asked to note, each a later idea:**
- **Handover**, i.e. giving a task to a colleague (direction B; answer 3 *"Note lại vào todo để
  sau này làm"*).
- **Recurring tasks** (answer 5 *"có cho phép lặp lại. Note lại vào todo để sau này làm"*).

Decided against:
- Sync with ClickUp, Jira or any tracker (answer 6).
- Any time on a task: hours, estimates, a time of day (F1, refusal 3).
- Priority and labels (Q8-B).
- Moving tasks automatically on PTO (Q11-A).
- A reminder for WFH (Q12-A).
- Creating a task on a past date (Q13-A).
- A task count on the month or year views (Q10).
- Any reader but the owner, admins included (answer 1).
- Directions C (WFH-day plan) and D (plain to-do), as offered at the brainstorm.

## Open questions

None the operator owns, unless `/triage` finds F1 plus answer 1 insufficient for the ADR (see
§ Evidence). Assumptions this file made rather than asked, each cheap to reverse and each PLAN's to
overrule:

1. **The overdue prompt lists every not-done task dated before today.** Each can be ticked done
   individually. One action, "move all to today", re-dates all of them to today. It closes for the
   current page load and returns on the next app open (Q9-B).
2. **"Today" is the member's local calendar date in the browser.** The product has no per-user
   timezone.
3. **Tasks can be edited, deleted, re-dated and un-ticked** on the task page.
4. **The task page is one dated list.** It opens on today, has navigation by day, and includes a
   way to see overdue tasks. Its layout is `tech-lead-design`'s under the visual carve-out.
5. **A removed member's tasks stay**, unreadable by anyone, consistent with soft delete
   (TEA-04). Nothing reads them.

# Triage verdict — PROMOTE, as `TSK-01`, `TSK-02`, `TSK-03` and `TSK-04`

`product` at /triage, 2026-10-12T10:33:36Z. `tech-lead-design` was consulted for the technical half
and wrote nothing.

**Not REJECT.** No feature row or open ticket gives a member a place for their own day's work. The PTO
form warns about the team's load (CAL-07) and says nothing about what the person booking had planned.
Nothing on the board covers this.

**An ADR is owed, and the operator signed its decisions.** A task is member-written data that no one
else reads, admins and managers included. That is an exception to the charter's *"Reading is not a
privilege here"*.
[ADR-057](../../registry/decisions/ADR-057-a-task-is-readable-and-writable-by-its-owner-only.md)
records answer 1 (*"riêng tuyệt đối"*), F1 and F2 (*"A: Đúng"*), each quoted verbatim from
§ *Evidence*, so it is `ACCEPTED by the operator`. F2 closes the gap F1 left, so the question this file
said `/triage` might need to ask has already been asked and answered. ADR-057 supersedes nothing.
ADR-040's cross-team admin read is not extended to tasks. The guarantee covers every token the app
issues. It does not cover the Supabase project owner, the dashboard or the service-role key, which
matches F2's *"khi dùng app"*.

**One correction to the technical half, measured rather than taken.** A task is not the first
owner-only data in the product. `public.notification` is already selectable by its recipient only
(`supabase/migrations/20261008120000_evt04_notification.sql:398-410`). A task is the first data a
member *writes* that nobody else reads, and the charter's sentence is about exactly that, so the
amendment is still owed. The notification policies are the precedent for the shape. ADR-057
§ *Context* records this.

**A new group.** A task is not an entry, so it is not `CAL`. It is private, so it is not `EVT`, and
ADR-028 step 2 excludes `UIE`.
[ADR-058](../../registry/decisions/ADR-058-tsk-is-a-sixth-feature-group.md) adds `TSK`, *Tasks — a
member's own private, dated list*. It is `ACCEPTED by product` under ADR-008, inside the envelope
ADR-057 opens, on ADR-046's precedent.

**Four rows, split here and not at PLAN (MD-017).** Each of the last three depends only on the first.

- **`TSK-01` is the foundation.** It covers the `task` table with owner-only policies, the task page
  (create, edit, delete, tick, untick, re-date, day navigation, an overdue section), a seam read by
  date range, and a sidebar link. `schema_delta`: the new table and its policies. `depends_on: []`.
  `glossary_owed: [Task, Overdue]`.
- **`TSK-02` is the overdue prompt**, on every app open (Q9-B): tick each done, or move all to today.
  `schema_delta` none. `depends_on: [TSK-01]`.
- **`TSK-03` is the PTO warning**, in the entry form beside the CAL-07 overload warning and as a flag on
  the task page (answer 4, Q11-A, Q12-A). It never blocks saving. It shows only when the entry is the
  viewer's own, so an admin editing someone else's entry (CAL-03) sees nothing. `schema_delta` none.
  `depends_on: [TSK-01]`.
- **`TSK-04` is the week badge**: the viewer's own done/total in each day's header, week view only
  (Q10, answer 7). `schema_delta` none. `depends_on: [TSK-01]`.

**Deferred by the operator, recorded and not issued.** Handover (direction B, answer 3) and recurring
tasks (answer 5) are each a later idea. Neither has a row or an ID. Handover is the first that would
let someone other than the owner see a task, so it needs a new ADR superseding ADR-057 before it can be
promoted.

**PLAN still decides two things.** First, whether the database rejects an insert dated before today
(Q13-A says the rule; where it is held is PLAN's). Second, which clock decides "today": the browser's
local date (assumption 2 above) or `Asia/Ho_Chi_Minh`. The five assumptions in § *Open questions* are
still PLAN's to overrule.

**What this verdict wrote:** ADR-057 and ADR-058; the `TSK` prefix, its table row, a paragraph and the
`## TSK — Tasks` section in `features.md`, with four rows at `PLANNED`; four ticket shells at
`BACKLOG`; and rows 5 to 8 of `## BACKLOG`. **Owed and not written here:** the charter paragraph under
§ *Roles* and the no-time sentence beside refusal 3, plus the `task` rows in `rbac-and-security.md`
and `data-model.md`. Those are human and standards plane, so `/thuki` lands them, or `/plan` of
`TSK-01` puts them in `allowed_paths` with approval.
