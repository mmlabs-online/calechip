---
stage: TRIAGE
agent: product
produced_at: 2026-09-29T02:17:28.809Z
inputs_read:
  - CLAUDE.md
  - .ai/steward/context.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/features.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/standards/tech-stack.md
  - .ai/templates/idea.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-009-how-a-person-becomes-a-member.md
  - .ai/registry/decisions/ADR-027-the-datastore-becomes-sqlite-behind-a-written-server.md
  - .ai/registry/decisions/ADR-033-a-person-joins-by-signing-up-and-an-admin-decides-afterwards.md
  - .ai/registry/decisions/ADR-035-a-third-role-manager-decides-entries-and-nothing-else.md
  - .ai/registry/decisions/ADR-039-every-admin-manages-every-team.md
  - .ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - supabase/migrations/20260922150000_cal11_cross_team_reads.sql
  - .ai/board/ideas/2026-09-22-an-admin-manages-every-team-and-sees-only-one-calendar.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
verdict: "NEEDS-ADR"
verdict_reason: "Worth building and not covered — but charter refusals 4 and 5 forbid it as written, members have no cross-team read, and no feature group fits. ADR-045 removes both refusals and bounds the new cross-team exposure (ACCEPTED by the operator, from Q1/Q4/Q5/Q8 verbatim); ADR-046 adds the EVT group (ACCEPTED by product). The registry is stale against the operator's decision, not the idea wrong. No feature row until the re-triage."
ticket_id: ""
awaiting_adrs: [ADR-045, ADR-046]
operator_request: "Người dùng tạo event, người khác bấm tham gia; phạm vi mời: một team, người cụ thể, hoặc public"
---

# A gathering has nowhere to be announced or joined

**No verdict is written here.** This file is capture, not judgement. The verdict and any registry row
that follows one are written by `/triage`.

**No feature ID appears anywhere below.** An idea has none (RULE-01, ADR-007).

## Problem

*Derived from the request above; the operator stated a solution — events with a join button and
three invitation scopes — and the problem below is this file's derivation, not their words.*

A person who wants to gather others — a team lunch, a training, an offsite, a cross-team session —
has no place in the product to announce it, to say who it is for, or to find out who is coming. The
announcement goes to a chat thread, the headcount is collected by hand, and a cap ("twelve seats")
or a vetting step ("I pick who comes") is enforced by whoever is keeping the list.

Today the product cannot hold this at all, **and that is deliberate**: charter refusals 4 (*"never
model group activity"*) and 5 (*"never a booking tool — no invitations"*) forbid it. The operator
decided on 2026-09-29 to lift both (Q1). This idea is therefore two things in order: a charter
amendment with its ADR, and then the feature it permits.

## Who has it

Any approved member, on any rank, whenever they organise something for more than themselves. The
people invited are any approved member of any team.

## Evidence

The operator's request, above, is the evidence. No support thread, workaround or metric was cited.
No visual reference was attached; the screen layout is `tech-lead-design`'s under the carve-out in
`CLAUDE.md`.

**Questions asked at `/idea` on 2026-09-29, with the operator's answers verbatim.** The questions
were asked in Vietnamese with costed options; each is given here as asked, followed by the answer
exactly as selected or typed.

**Q1 — charter.** *"Request này đụng thẳng hai điều charter từ chối: #4 'never model group activity —
everyone registers independently' và #5 'never a booking tool — no invitations'
(.ai/00-charter.md). Event + mời + bấm tham gia chính là hai thứ đó. Anh chọn hướng nào?"*
Options: remove #4 and #5 / narrow amendment for a separate 'event' only / keep the charter.
**Answer: "Gỡ #4 và #5".**

This is the decision `/triage` needs to draft the ADR amending `.ai/00-charter.md` and to write
`ACCEPTED by the operator` against. The narrower option — keep #5 for entries, open only a separate
event concept — was offered and not chosen: both refusals are removed, not carved.

**Q2 — relation to entries and the absence count.** *"Tham gia một event có liên quan gì tới entry
(PTO/WFH) và số người vắng không?"* **Answer: "Không liên quan".** An event creates no entry, is not
counted in the absence count, and INV-04 is untouched. The option to draw events on the calendar
grids was offered separately and not chosen.

**Q3 — who creates.** *"Ai được tạo event?"* **Answer: "Mọi member".** Every rank.

**Q4 — public.** *"Scope 'public' nghĩa là ai thấy được? (Hiện member chỉ đọc được team mình; chỉ
admin đọc chéo team — ADR-040.)"* **Answer: "Mọi member mọi team".** Every approved member of every
team. Pending sign-ups are excluded — the alternative that included them was offered and not chosen.

**Q5 — specific people.** *"Scope 'người cụ thể': được mời ai?"* **Answer: "Bất kỳ team nào".** The
creator may invite any approved member of any team, so a member must be able to read the names of
people outside their own team — a cross-team read on `member` that does not exist today.

**Q6 — team scope.** *"Scope 'một team': người tạo chọn được team nào?"* **Answer: "Chỉ team của
mình".**

**Q7 — joining.** *"Bấm tham gia thì sao?"* Options: join instantly and withdraw / a seat cap / the
creator approves. **Answer, typed: "cho phép người tạo event chọn giới hạn hoặc không giới hạn số
người. Cho người tạo event chọn mode cần duyệt hoặc không cần."** Capacity is optional and set per
event; approval is a per-event mode chosen by the creator.

**Q8 — attendee list.** *"Ai thấy danh sách người đã tham gia?"* **Answer: "Ai thấy event thì thấy".**

**Q9 — edit and delete an event.** *"Sửa/xoá event: ai được?"* **Answer: "Người tạo + admin".**
A manager has no power here beyond a member's.

**Q10 — seat holding.** *"Event có giới hạn + cần duyệt: đơn đang chờ duyệt có giữ chỗ không?"*
**Answer: "Không, chỉ đếm approved".** Any number may request; once approved attendees reach the cap,
no further approval is possible. The capacity check sits on the approve action (and on the instant
join in the no-approval mode), and must hold under concurrent approvals.

**Q11 — dates.** *"Thời gian của event được mô tả thế nào?"* **Answer: "Chỉ ngày (có thể nhiều
ngày)".** A start date and an end date, no times.

**Q12 — rejection reason.** *"Người tạo từ chối đơn tham gia: có bắt buộc lý do không?"*
**Answer: "Không bắt buộc".** INV-03 does not extend to this.

**Q13 — changing an event after people are in.** *"Sau khi đã có người tham gia, người tạo hạ
capacity xuống dưới số đã duyệt, hoặc đổi mode/scope thì sao?"* **Answer: "Không cho hạ dưới số
hiện có".** Capacity may never be set below the current approved count; changing mode or scope
leaves those already in as they are.

**Q14 — fields.** *"Event có những trường nào ngoài ngày, scope, capacity, mode?"* **Answer: "Tên +
mô tả + địa điểm".** Name required; description and location free text, optional.

**Q15 — notification.** *"Người ta biết mình được mời / có event mới bằng cách nào?"*
**Answer: "Có email".** See Q20 — the email itself is split out.

**Q16 — when registration closes.** *"Khi nào đóng đăng ký tham gia?"* **Answer, typed: "deadline
đăng kí do người tạo event đặt".**

**Q17 — removing someone who is in.** *"Sau khi đã được duyệt/vào: ai có thể đưa một người ra?"*
(multi-select: self / creator / admin) **Answer: "Admin gỡ, Người tạo gỡ".**

**Q18 — self-withdrawal, confirming Q17.** *"Anh không chọn 'Tự rút'. Nghĩa là attendee đã vào/đã
được duyệt KHÔNG tự rút được … — đúng ý anh?"* **Answer: "Cho tự rút trước deadline".** An
attendee may withdraw, or cancel a pending request, before the deadline. Creator and admin may
remove an attendee (Q17).

**Q19 — deadline rules.** *"Deadline đăng ký do người tạo đặt: bắt buộc hay tuỳ chọn, và ràng buộc
với ngày event?"* **Answer: "Tuỳ chọn, ≤ ngày kết thúc".** Optional; when set it must be on or
before the end date; when not set, registration stays open until the end date.

**Q20 — email infrastructure.** *"Email: hiện KHÔNG có server (ADR-005), nên gửi mail cần thêm một
thành phần chạy phía server + một nhà cung cấp mail + secret. Làm sao?"* **Answer: "Tách thành
ticket sau".** This ticket is in-app only and does not touch ADR-005.

**Q21 — when email will be sent (recorded for the later idea).** *"Gửi email khi nào?"*
(multi-select) **Answer: "Event mới cho team/public, Được mời đích danh, Đơn được duyệt/từ chối/bị
gỡ".** Not chosen: mail when an event is edited or deleted.

**Q22 — approval for invitees.** *"Event scope 'người cụ thể' + mode cần duyệt: người được mời bấm
tham gia có phải chờ duyệt không?"* **Answer: "Có, mode áp cho mọi người".** An invitation decides
who can see and request; it is not a pre-approval.

**Q23 — creator's seat.** *"Người tạo event có tự động là attendee (chiếm 1 chỗ) không?"*
**Answer: "Không".**

**Q24 — admin on other people's events.** (multi-select) **Answer: "Đọc mọi event, Duyệt/từ chối
đơn".** An admin reads every event regardless of scope or team, and may decide join requests on any
event, in addition to edit, delete and remove-attendee (Q9, Q17).

**Q25 — visibility of a specific-people event.** *"Scope 'người cụ thể': người không được mời (kể cả
cùng team người tạo) có thấy event tồn tại không?"* **Answer: "Không thấy".** Only the creator, the
invitees and admins.

## Impact if ignored

Gatherings keep being organised in chat, with headcounts and caps kept by hand, and the product stays
exactly what the charter says — which the operator has now decided is narrower than they want.

## Constraints already known

- **Charter refusals 4 and 5 must be amended first**, by ADR (RULE-01). Q1 is the operator's words
  for it. The charter's *"Who uses it — one team"* and *"no negotiating a day with another person"*
  sentences are adjacent and should be read by the same ADR.
- **INV-04, INV-05, INV-07 are not touched** by construction (Q2): an event is not an entry and is
  not counted. `/plan` should still list them in `invariants_touched` if a shared surface is changed,
  per the "could plausibly affect" rule in `invariants.md`.
- **ADR-005 stands** (Q20): authorization is row-level security; no server.
- **Two new cross-team reads for members**, which have never existed — every member policy today is
  team-scoped through `member_team_id`:
  1. events in public scope, and events whose invite list names them, from any team (Q4, Q5);
  2. the names of approved members of other teams, to pick invitees from (Q5). This is new
     information exposure — a member of team A learning who is in team B — and belongs in the ADR,
     not only in the RBAC table.
  The 2026-09-11 migration header explains why a widened select policy on `member` silently changes
  `listMembers()` (INV-04's denominator); the invitee picker must not be built that way.
- **New rows in `.ai/standards/rbac-and-security.md`** for create, read, edit, delete an event;
  join/request, withdraw, decide a request, remove an attendee — with the manager column all
  default denials (Q9).
- **Capacity must hold under concurrency** (Q10, Q13): two approvals of the last seat, or an instant
  join racing an approval, must not exceed the cap. The same concern INV-01's note raises; a
  read-then-write check is not sufficient. Whether this becomes an invariant is `/triage`'s call.
- **The glossary has no `Event`, `Attendee`, `Invitation` or `Capacity`.** Rows needed.
- **Feature group.** None of CAL, ADM, TEA, UIE fits cleanly; a new prefix is a `features.md` change
  that `/triage` proposes.
- **Rejected requester re-requesting, a removed member's events, a manager's power** — see Guesses.

## Guesses — cheap to reverse, not asked

- A person whose request was rejected, or who was removed, may request again while registration is
  open. One attendance row per person per event, whose status changes.
- The creator may join their own event like anyone else in scope, subject to the event's mode; as the
  deciding party they may approve their own request.
- Switching an event from *approval required* to *open* leaves pending requests pending; the creator
  still decides them.
- Removing a person from a specific-people invite list does not remove them if they are already an
  attendee (consistent with Q13).
- A member later removed from their team (`removed_at`) keeps their created events and attendances in
  the data; they simply lose read access with the rest of the product.
- Deleting an event deletes its attendance rows.
- Registration closes at the end of the deadline date in `Asia/Ho_Chi_Minh`.

## Out of scope

- **Email, in every form** (Q20). A later idea, with the triggers in Q21 already decided, needing an
  ADR amending ADR-005 for a server-side sender and a mail provider.
- **Events on the month, week or year grids** (Q2). The grid's density is not spent on this.
- **Any link between an event and an entry or the absence count** (Q2).
- **Times of day** (Q11). Dates only.
- **Waitlist** when capacity is full. Not requested; full means full.
- **A mandatory rejection reason** (Q12).
- **Pending sign-ups seeing public events** (Q4).
- **Team scope on another team** (Q6).
- **Recurring events, reminders, comments, calendar export (.ics).** Not requested.
- **Any new power for `manager`** (Q9, Q24).

## Open questions

None the operator owes. What remains is `tech-lead-design`'s: the data shape of scope and the
invite list, the concurrency mechanism for capacity, the security-definer shape of the cross-team
member picker, and the screen layout.

## When the request is shaped like a solution

It was. `operator_request` keeps their sentence; `## Problem` is the derivation, marked.

## Triage verdict — NEEDS-ADR

*`product`, 2026-09-29. The front-matter is the live answer; this heading is for a person.*

**Worth building, and not already covered.** Nothing in the product holds a gathering, and nothing
could: the charter refuses it. The operator's 25 answers leave no behaviour or permission for PLAN to
invent. The seven items under *Guesses* are cheap to reverse and stay PLAN's to confirm or overturn.

**The registry disagrees with the operator, and the operator's decision is the newer one.**

- `.ai/00-charter.md:53-58` still carries refusals 4 and 5. Q1 removes both, in words.
- Every member read is own-team (ADR-018, whose revert condition fires on *any* cross-team read of
  `public.member`). Q4, Q5 and Q8 give members a cross-team read that has never existed.
- `.ai/registry/features.md` declares `CAL ADM TEA UIE`; none fits, and a fifth needs an ADR.

**Drafted and accepted — so the runner re-triages without stopping:**

- `.ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md` —
  `ACCEPTED by the operator`, quoting Q1, Q4, Q5, Q8. It adds one fence of `product`'s own, marked
  as such: the cross-team exposure is carried by a dedicated narrow read and **never** by widening
  `member_select_team`, because `listMembers()` is INV-04's denominator.
- `.ai/registry/decisions/ADR-046-evt-is-a-fifth-feature-group.md` — `ACCEPTED by product`, under
  ADR-008: it extends ADR-028's step 2 by area and supersedes nothing. `TEA` was rejected because its
  *invitations* already means joining the product.

**Two calls the idea asked `/triage` to make:**

- **Capacity is not issued as an invariant.** It becomes acceptance criteria at PLAN, held in the
  database under concurrency; `invariants.md` records only what the operator stated as one, and is
  not `product`'s to write. ADR-045 § *Consequences*.
- **Prefix:** `EVT`, per ADR-046.

**What the re-triage must carry into the ticket:** the charter edit is not applied here — `product`
does not rewrite a file it did not create in this run. It lands with the first `EVT` ticket (its
`allowed_paths` carries `.ai/00-charter.md`) or by `/thuki` first. The `EVT` prefix line, prefix-table
row and section land in the same change as the first `EVT` row. Glossary rows `Event`, `Attendee`,
`Invitation`, `Capacity` are owed at PROMOTE.

**No feature row, no ticket.**
