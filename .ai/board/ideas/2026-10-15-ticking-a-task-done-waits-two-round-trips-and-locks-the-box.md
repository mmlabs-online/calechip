---
stage: TRIAGE
agent: product
produced_at: 2026-10-15T19:53:14+0700
inputs_read:
  - src/routes/Tasks.tsx
  - src/lib/data/index.ts (TaskSeam: setTaskDone, listTasks, listOverdueTasks)
  - src/lib/data/supabase.ts (listTasks and listOverdueTasks ordering)
  - supabase/migrations/20261015120000_tsk01_task.sql
  - .ai/board/tickets/TSK-01/01-plan.md (AC-9, AC-13 to AC-15, selector table)
  - .ai/board/ideas/2026-10-12-a-member-has-nowhere-to-plan-their-own-day-and-an-absence-hides-what-was-due.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE          # not the routing input — see `verdict` below
verdict: PROMOTE
verdict_reason: "Worth doing and not covered: no ticket makes the tick optimistic. No ADR — the one reversal, TSK-01 AC-14, is an acceptance criterion PLAN amends; ADR-057 decision 7 (what overdue means) and listOverdueTasks are unchanged"
ticket_id: "TSK-05"
awaiting_adrs: []
operator_request: |
  Đánh dấu task done/undone theo kiểu optimistic ở src/routes/Tasks.tsx.

  Hiện trạng: nút toggle (Tasks.tsx:211-212) gọi run(() => seam.setTaskDone(task.id, !task.done)).
  run() bật busy, chờ API, rồi chờ onChanged() load lại toàn bộ danh sách. Vì vậy
  checkbox chỉ đổi sau hai vòng mạng và nút bị disabled trong lúc chờ.

  Muốn:
  1. Bấm là UI đổi ngay: trạng thái done, kiểu hiển thị, và vị trí của task trong
     danh sách overdue (nếu có) cập nhật tại chỗ trước khi gọi API.
  2. Gọi seam.setTaskDone ở nền. Không disable nút, không hiện spinner.
  3. Thành công: lấy Task trả về làm giá trị đúng, không load lại cả danh sách.
  4. Thất bại (kể cả task_not_permitted): trả task về trạng thái cũ và hiện thông báo
     lỗi đang dùng cho task đó. Không nuốt lỗi.
  5. Bấm liên tục nhiều lần: kết quả cuối cùng phải khớp với lần bấm cuối. Một response
     cũ về sau không được ghi đè trạng thái mới hơn.
  6. Chỉ áp dụng cho toggle done. Edit, move, add, delete giữ nguyên.

  Ràng buộc: chỉ đi qua seam (RULE-02), không đổi contract của setTaskDone, giữ nguyên
  data-testid. Thêm hoặc sửa test cho: đổi ngay, rollback khi lỗi, bấm liên tục.
---

# Ticking a task done waits for two network round trips, and the box is locked while it waits

## Problem

*Derived from the request above; the operator stated a solution, not a problem.*

A member who ticks or unticks a task on `/tasks` sees nothing happen until two network round trips
have finished — the write, then a reload of every list on the page — and the tick box is disabled
for that whole time. On a slow connection the box looks unresponsive, a second tap is swallowed by
the disabled state, and running down a list ticking several tasks is a wait per task.

What the code does today (read, not reported): the tick box at `src/routes/Tasks.tsx:206-212` calls
`run(() => seam.setTaskDone(task.id, !task.done))`; `run` (`:125-136`) sets `busy`, awaits the
write, then awaits `onChanged()`, which is the page's `load` (`:387-397`) — `listTasks` for the day
and, on today, `listOverdueTasks` — before anything on screen changes. The box is `disabled={busy}`
(`:211`).

## Who has it

Every member using `/tasks` (TSK-01), every time they tick or untick a task — the most frequent
action on that screen.

## Evidence

The operator's request, above, naming the lines and the two round trips. Confirmed against the
source (§ Problem).

**Questions asked at `/idea` on 2026-10-15, and the operator's answers, verbatim.**

**Q1. Tick một task trong mục *Overdue* thì nó đi đâu?** TSK-01 AC-14 says today *"Ticking an
overdue task … removes it from the section at once"*; the request says the task's place in the
overdue list is "cập nhật tại chỗ".
- A — disappears at once (count drops) before the API answers; on failure it comes back where it was,
  with the error. Matches AC-14; repeated tapping is impossible inside the overdue section.
- B — stays where it is, shown as done, until the next load. Reverses TSK-01 AC-14.

> Operator: **"1. B"**

**Q2. When a rapid series of taps ends with a successful last tap, but an *earlier* tap's request
fails after it, is that earlier failure shown?**
- A — no: only the *last* tap's failure rolls back and shows the message; a superseded tap's failure
  is not shown to the member (still written to the console, so it is not lost).
- B — yes: shown even though the box is already in the right state and there is nothing to roll back.

> Operator: **"2. A"**

**Settled from the repository, not asked:**
- In a day's list a tick never moves the task: `listTasks` orders by `date, created_at, id`
  (`src/lib/data/supabase.ts:4139-4141`), not by `done`. "Vị trí" in request item 1 therefore only
  concerns the *Overdue* section — and Q1-B settles that it does not move there either.
- The per-task error message already exists: each row's `GeneralError` shows the seam's `message`
  (`Tasks.tsx:298`), including `task_not_permitted`'s. Request item 4 reuses it.
- How "the last tap wins" is guaranteed — discard stale responses, serialise the writes, or send only
  the final value — is `tech-lead-design`'s at `/plan`, with the rejected alternative recorded in
  plan § 8.

## Impact if ignored

The tick box keeps feeling broken on any real connection: a tap that does nothing visible for a
second or more, a second tap that is silently dropped, and a list ticked one slow item at a time.

## Constraints already known

- **RULE-02** — the toggle goes through the seam only; `setTaskDone(taskId, done): Promise<Result<Task>>`
  (`src/lib/data/index.ts:1579`) keeps its contract (the operator's constraint).
- **Every `data-testid` in TSK-01's selector table stays** (`01-plan.md` § 4, the selector table), including `task-row`'s
  `data-done`.
- **TSK-01 AC-14 changes** (Q1-B): an overdue task ticked on the page stays visible in `tasks-overdue`,
  shown as done, until the page next loads; it is no longer removed "at once". PLAN amends that AC
  and its test in this ticket, and AC-13's "lists every one of them" still holds at load.
- **TSK-01 AC-9** (tick and untick) is the behaviour being made optimistic; its outcome is unchanged.
- No schema, policy or seam change is expected.

## Out of scope

- **Edit, move, add and delete** keep their current flow, `busy` state and reload — request item 6.
- **The overdue prompt on app open** (TSK-02) — a different surface; whether it should also tick
  optimistically is not decided here.
- **Changing `setTaskDone`'s contract**, or adding a batch write for several ticks.
- **Offline queueing**: a tap whose request cannot be sent fails and rolls back like any other failure.

## Open questions

None the operator must answer. Two points were *guessed* by `product` because they are cheap to
reverse; PLAN confirms or overturns each:

1. **The overdue count (`tasks-overdue-count`) drops at once** when a task in the section is ticked,
   even though the row stays visible (Q1-B) — the header counts tasks still not done; it rises again on
   untick or on a rolled-back failure. *Guess.*
2. **"The next load"** in Q1-B is whatever already calls `load` — day navigation, a page reload, or
   another row's edit, move, add or delete (whose `onChanged` still reloads, item 6). A ticked overdue
   row may therefore leave the section when the member edits a *different* task. *Guess; accepted as a
   consequence of item 6.*

## Triage verdict — PROMOTE, as `TSK-05`

**By `product`, 2026-10-15.** Worth doing — the tick is the screen's most frequent action and today it waits two round trips with the box locked — and not covered: TSK-01 shipped the blocking flow, and TSK-02 to TSK-04 are other surfaces.

**Not NEEDS-ADR.** Q1-B reverses TSK-01's **AC-14** (*"removes it from the section at once"*), which is an acceptance criterion, not a registry decision; PLAN rewrites it and its test in this ticket. ADR-057 decision 7 defines what *overdue* is — a passed date and not done — and that does not change: `listOverdueTasks` still returns only not-done past tasks, and a ticked row lingers in the section only until the page next loads. Q2-A changes what is shown, not what is stored. No schema, policy, seam or contract change; `schema_delta: none`.

**One feature, one ticket**, group `TSK`, `depends_on: [TSK-01]` (`DONE`). `glossary_owed: []` — *Task* and *Overdue* were written at TSK-01's PLAN, and *optimistic* is an implementation word, not a domain term.
