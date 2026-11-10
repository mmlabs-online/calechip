---
doc_version: 3
last_updated: 2026-10-12
governed_by: [RULE-01, RULE-09]
---

# ADR-057 — A task is a member's own: readable and writable by its owner only, and it carries no time

## Status

`ACCEPTED by the operator` — 2026-10-12, in words, at `/idea` and at the start of `/triage` of
`.ai/board/ideas/2026-10-12-a-member-has-nowhere-to-plan-their-own-day-and-an-absence-hides-what-was-due.md`
§ *Evidence*. Drafted by `product` at `/triage` of that file, 2026-10-12T10:33:36Z, from a technical
half supplied by `tech-lead-design`, consulted and writing nothing.

**Recorded, not authored.** The operator's words, verbatim from § *Evidence*:

> Answer 1 (private or team-visible): **"Tạm thời scope sẽ là riêng tuyệt đối"**
>
> F1 (no time on a task): **"Task chỉ có 2 trạng thái done hay chưa. Không mang thời gian cụ thể, chỉ
> tính theo ngày, qua ngày hôm sau thì gọi là quá hạn"**
>
> F2 (asked: *"task cá nhân chỉ chủ sở hữu đọc và ghi được; admin và manager cũng không đọc được (kể
> cả qua DB khi dùng app); charter được bổ sung một đoạn ghi ngoại lệ này với nguyên tắc minh bạch."*
> A: đúng; B: admin được đọc): **"A: Đúng"**

F1 settled the no-time half and left the privacy half resting on answer 1 alone. F2 asked the
privacy half in its own words, admins and managers named, and the operator picked A. The two are
read together, as the idea file asked.

**What is not the operator's, and is named rather than folded in.** The mechanism in decisions 2 to
4 is `tech-lead-design`'s technical consequence of F2, not a separate answer. The scope of the
guarantee in decision 5 is read from F2's own parenthesis, *"khi dùng app"*. **Answer 1 says
*"Tạm thời"* — for now.** This ADR records the decision as it stands. Widening it later is a new ADR
that supersedes this one, not an edit.

**Supersedes nothing.** It narrows, for one new table, a principle the charter states for entries:
it reverses no accepted ADR. [ADR-040](ADR-040-an-admin-reads-any-teams-calendar-read-only.md) stands
in full and is not extended to tasks (decision 4). [ADR-005](ADR-005-authorization-in-rls.md) stands
in full. Authorization stays in row-level security, and this ADR adds a table with policies in that
shape.

## Context

- `.ai/00-charter.md` § *Roles*: *"**Reading is not a privilege here.** Every member sees every other
  member's entries in full."* Every member-authored row in the product today (entries, events,
  attendance) is readable by at least the author's team, and an admin reads more: ADR-040 lets an
  admin read any team's calendar through `security definer` functions testing `public.is_admin`.
- **A correction to the technical half, measured at this triage.** `tech-lead-design` called a task
  *"the first owner-only data"*. That is not quite true. `public.notification` is already owner-only:
  `notification_select_own` and `notification_update_own` test `recipient_id = (select auth.uid())`
  (`supabase/migrations/20261008120000_evt04_notification.sql:398-410`), and EVT-04's row says
  *"nobody, admin included, reads another person's notifications"*. What is new is narrower: **a task
  is the first data a member *writes* that nobody else reads.** A notification is written by the
  database about an event the recipient can already read. A task is the member's own statement, and
  that is exactly what the charter's sentence is about. The notification policies are the precedent
  for the shape, and the charter is still owed its paragraph.
- Charter refusal 3: *"It will never do timekeeping, payroll, or hours tracking."* A to-do list with
  an estimate or a time column is one step from timesheet data.
- INV-04's absence count, the overload warning (CAL-07) and the notification and email pipes
  (ADR-050, ADR-051) read entries and events. None of them has any reason to read a task.

## Decision

1. **A task belongs to exactly one member, its owner, and only the owner reads or writes it**
   (answer 1, F2-A). Admins and managers are excluded by name. The owner can create, edit, delete,
   tick, untick and re-date.
2. **Row-level security on `public.task` is `member_id = (select auth.uid())` and nothing else.** No
   `public.is_admin` arm, no `may_decide` arm, no team arm, on any of select, insert, update or
   delete. `member_id` defaults to `auth.uid()`. `/plan` decides whether to add the narrowing arm the
   notification policies carry (`public.member_team_id(...) is not null`). It may only narrow.
3. **No other read path reaches a task.** No `security definer` function reads `public.task`. No
   trigger or notify fires on it. It is in no realtime publication. It is not an input to INV-04, the
   overload warning, or any count but the owner's own.
4. **ADR-040's cross-team admin read is explicitly not extended to tasks.** An admin viewing another
   team's calendar sees that team's entries, and no task of anyone's, including on the week view's
   task badge (TSK-04), which shows the viewer's own tasks only.
5. **The scope of the guarantee is every token the app issues** (F2, *"kể cả qua DB khi dùng
   app"*). An anonymous key, or any signed-in member's key including an admin's, calling the API
   directly reads no task but its own. **It does not cover the Supabase project owner, the
   dashboard, or the service-role key.** Those bypass row-level security by design, and no policy can
   promise otherwise. That limit is stated here so nobody reads the guarantee as more than it is.
6. **A task has exactly two states, done and not done, and carries no time** (F1). No time of day, no
   estimate, no hours worked, no duration. It carries a date, and per the idea's Q8-B a title and a
   short plain-text note. Refusal 3 stands untouched.
7. **A task is overdue when its date has passed and it is not done** (F1, *"qua ngày hôm sau thì gọi
   là quá hạn"*). Which clock decides "today", the browser's or `Asia/Ho_Chi_Minh`, is `/plan`'s.
8. **The charter is amended** (F2-A). One paragraph goes under § *Roles*, after *"Reading is not a
   privilege here"*, recording tasks as the exception and why. One sentence goes beside refusal 3,
   recording that a task carries no time. This ADR names the amendment, and it does not make it. See
   § *Affected documents*.

## Rationale

**Rejected: admins may read tasks** (F2-B, offered and not chosen). It matches the charter's
transparency and ADR-040's admin reach. But a list a member knows their admin reads is a list they
curate for the admin. The product would then hold a soft activity record, which is refusal 3's risk
arriving by another door.

**Rejected: team-visible tasks**, the brainstorm's other half of question 1. That is a shared work
tracker, which answer 6 refused (*"Không đồng bộ"*, no ClickUp or Jira) and which the charter does
not describe.

**Rejected: an owner-only policy plus an admin-only `security definer` read "for support".** It is
F2-B with extra steps, and the first such function would become the precedent for the next one.

**Rejected: a priority, an estimate or a time-of-day column "left nullable for later".** F1 refuses
time outright, and Q8-B refused priority. A nullable column is a decision deferred to whoever first
fills it.

## Consequences

- **The charter's transparency sentence stops being universal.** A reader of § *Roles* must find the
  paragraph this ADR owes, or they will read every table as team-readable. Until the amendment lands,
  the charter is wrong about tasks.
- **No admin can help with a task problem.** Support for a lost or wrong task goes through the
  project owner with the service-role key, outside the app, or not at all. That is the cost of
  *"riêng tuyệt đối"*, and it is accepted.
- **A removed member's tasks become unreadable by anyone in the app** (the idea's assumption 5,
  consistent with TEA-04 soft delete). They are kept, and nothing reads them.
- **Testing the denials is the whole proof.** A permission test must show that a teammate, a manager
  and an admin each get zero rows and that every write they attempt is refused. A test that only
  shows the owner succeeding proves nothing about this ADR. The mock seam must reproduce the policies
  clause for clause, as EVT-01's did.
- **The PTO reminder (TSK-03) can only ever be shown to the task's owner.** On CAL-03, where an admin
  edits another member's entry, there is nothing to show, by construction rather than by a check.
- **`rbac-and-security.md` gains its first table where an admin is denied a read.** The permission
  table's *"everything the rank below can do, plus"* reading needs a footnote.

## Revert condition

Any one occurrence:

1. **Any caller other than the owner, holding a token the app issued, reads or writes a task row**,
   through a policy, a function, a trigger, a view, a publication or a seam method. On observation:
   it is a security defect against this ADR and is fixed before anything else ships. The fix
   restores this ADR. It does not amend it.
2. **A task gains a time-bearing field** (time of day, estimate, duration, hours) without a new ADR.
   On observation: the field is removed. Refusal 3 is argued with in the charter first, or not at all.
3. **The operator asks for admins or anyone else to read tasks.** Answer 1 said *"Tạm thời"*. On
   observation: a new ADR supersedes this one. This one is not edited.

## Affected documents

| File | Change |
|------|--------|
| `.ai/00-charter.md` | One paragraph under § *Roles* after *"Reading is not a privilege here"*, and one no-time sentence beside refusal 3. **Human plane, not written at triage**: `/thuki` lands it, or `/plan` of `TSK-01` puts it in `allowed_paths` with approval, the EVT-01 precedent. |
| `.ai/standards/rbac-and-security.md` | A `task` row: owner only, admin and manager denied, with the decision 5 scope stated. Standards plane. |
| `.ai/standards/data-model.md` | `public.task`: `member_id`, `date`, `title`, `note`, `done`, length checks, no time column. Standards plane. |
| `.ai/registry/features.md` | `TSK-01` to `TSK-04` cite this ADR. |
| `.ai/registry/glossary.md` | *Task* and *Overdue*, owed under ADR-047 and written at `/plan` of `TSK-01`. |
| `.ai/registry/invariants.md` | None. A task is in no absence count, and INV-04, INV-05 and INV-07 are not engaged. No invariant is issued: no operator words make owner-only privacy an invariant rather than this ADR's decision. |
