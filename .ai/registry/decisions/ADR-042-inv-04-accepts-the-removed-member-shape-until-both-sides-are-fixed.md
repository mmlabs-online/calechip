---
doc_version: 3
last_updated: 2026-09-23
governed_by: [RULE-01, RULE-07, RULE-09]
---

# ADR-042 — INV-04 accepts the removed-member shape until both sides are fixed together

## Status

`ACCEPTED by the operator` — 2026-09-23, in words, at the RULE-07 escalation of CAL-11's review.
Verbatim:

> "Nhận shape parity, mở ticket riêng sửa INV-04 — CAL-11 giữ nguyên, đi tiếp tới /ship. Mở một
> ticket mới sửa INV-04 cho cả own-team lẫn cross-team cùng lúc — đúng với điều kiện revert của
> ADR-040 là hai cách xem không được lệch số. Nợ được ghi lại chứ không biến mất."

**This ADR records a decision; it does not make one.** The words above are the operator's answer to
the question `04-review.md` routed to a human. They are already quoted inside
`.ai/board/tickets/CAL-11/01-plan.md` § *Notes for the operator* 1, which is where they were first
written down. They are moved into the registry here because a ticket folder is not where the next
reviewer looks, and because RULE-07's mechanism is *a human decides* — the durable form of that in
this repository is an ADR, not a note inside the artifact that raised the question.

## Context

**INV-04 as fixed by [ADR-013](ADR-013-removed-members-count-until-removal.md) counts a removed
member's entry on every date strictly before `removed_at`.** ADR-013 names the alternative it
rejected in terms: *hiding them entirely rewrites the past.*

**The implementation has never done that, and the defect predates CAL-11.** `entry_select_team`
compares `public.member_team_id(member_id)`, and that function answers null for a removed member
(`supabase/migrations/20260831150024_tea01_membership.sql:64-68`). So a removed member's entries are
invisible to the own-team read on **every** date, including the ones before their removal where
INV-04 says they still count. `src/lib/data/mock.ts:1402-1405` records the shape as deliberate.

**CAL-11 mirrors that predicate into three new cross-team reads** —
`supabase/migrations/20260922150000_cal11_cross_team_reads.sql:51` and `:63`, copied in
`src/lib/data/mock.ts:1562` and `:1589`. `01-plan.md` § *Invariants touched* knew this before
implementation and chose parity rather than divergence, because
[ADR-040](ADR-040-an-admin-reads-any-teams-calendar-read-only.md)'s revert condition is exactly that
the two views must not disagree on a count.

**`/review CAL-11` returned `gate: FAIL` with `invariant_violation: true` on R7 and
`route_to: human`** (`.ai/board/tickets/CAL-11/04-review.md`, 2026-09-23). RULE-07 escalates an
invariant violation to a human on first occurrence and never routes it to REWORK, because the code
being wrong and the model being wrong need different people to decide what happens next. This ADR is
what that escalation produced.

## Decision

1. **CAL-11 ships the parity shape.** Its three new reads keep
   `public.member_team_id(e.member_id) = p_team_id`. No acceptance criterion is relaxed and none is
   edited — AC-5 asserts that the cross-team and own-team counts are **the same number**, which they
   are, and it never asserted that the number is right for a removed member.

2. **INV-04 is knowingly not held for a removed member's entries**, on the own-team reads and on the
   cross-team reads alike. This is an accepted deviation, not a claim that the invariant is
   satisfied. The reviewer's R7 finding stands exactly as written and nothing here contradicts it.

3. **The fix is one ticket that changes both sides together** — `entry_select_team`, the three
   functions of `01-plan.md` § 4.1, and both seam implementations. **Never one side and then the
   other:** fixing one alone would make the two views disagree on a count, which trips ADR-040's
   revert condition rather than discharging this debt.

4. **The fix attributes an entry by the member's team on the entry's dates** — ADR-013's condition,
   `removed_at` null **or** strictly after that date — instead of by `public.member_team_id(...)` as
   of now. That changes a shipped own-team read and a policy, so it carries a schema delta under
   ADR-014 and is its own PLAN to price.

5. **Opening that ticket needs a feature row in `.ai/registry/features.md`**, which is human plane
   under RULE-01. Until the row exists the debt is recorded and not scheduled.

## Rationale

**Why parity rather than fixing it inside CAL-11.** CAL-11's whole subject is a second way of reading
the same data, and ADR-040 accepted it on the condition that the two ways agree. A ticket that fixed
the count on one side while shipping the second side would deliver two views that disagree on their
first day — the precise outcome ADR-040 said would justify reverting it.

**Why the deviation is acceptable to hold open.** The product's stated job is to make **future**
plans visible early (`.ai/00-charter.md` § *What "working" looks like*). The rows this deviation
loses belong to people who have left the team, on dates that have passed. Nothing a person is
planning around is affected. That is a reason to schedule the fix rather than to block on it; it is
not a reason to call the invariant satisfied, which is why point 2 says so plainly.

**Why an ADR and not only the plan note.** `01-plan.md` lives in a ticket folder that is committed at
`/ship` and then rarely reopened. INV-04 is cited from designs, reviews and `ticket.yaml` across the
board, and the next reviewer to reason through it will read `invariants.md` and the decisions
directory — not a shipped ticket's prose. A debt recorded only where it was discovered is a debt that
is discovered again.

## Consequences

- **A removed member's past absences are absent from every count and every view**, on both sides of
  the seam, including dates before their removal. A past date can therefore read as less crowded than
  it was.
- **The screen does not contradict itself**, which is the one thing that stays true: INV-04's drawing
  rule says a view shows a member's avatar exactly when that member's entry is counted, and here
  neither happens. The count and the faces agree — both are wrong in the same direction, and no cell
  shows four faces over a count of three.
- **`invariants.md` is not amended.** INV-04's text stays as ADR-013 fixed it, because the invariant
  is what must hold, not what currently does. This ADR is the record of the gap between them.
- **Review check R7 will keep reporting this** against any ticket that touches these reads, and that
  is correct. A reviewer may cite this ADR as the accepted deviation; it may not cite it as the
  invariant being held.

## Revert condition

**If the two views ever disagree on a count for the same team and date, revert CAL-11** — that is
ADR-040's condition and this ADR does not weaken it.

**If a removed member's missing absences are observed to change a decision somebody made** — a
handover planned against a past month that reads emptier than it was — the fix stops being scheduled
work and becomes the next ticket.

## Affected documents

| Document | What it owes |
|---|---|
| `.ai/registry/invariants.md` | Nothing to the ledger row. The INV-04 note may cite this ADR beside ADR-013 so a reader of the invariant sees the gap without finding the ticket. |
| `.ai/registry/features.md` | The feature row for the fix ticket — decision 5. Human plane, RULE-01. |
| `.ai/board/tickets/CAL-11/01-plan.md` | Nothing. § *Notes for the operator* 1 already carries the words and the debt; this ADR is where they now live for readers outside the ticket. |
