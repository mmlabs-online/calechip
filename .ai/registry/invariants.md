---
doc_version: 4
last_updated: 2026-10-13
governed_by: [RULE-01, RULE-07, RULE-09]
---

# Domain invariants

These are the statements about the domain that must hold in every state the system can reach. They
are not requirements, not acceptance criteria, and not preferences. A requirement can be renegotiated
with a stakeholder; an invariant that stops holding means the data is wrong.

**This file is seeded once, at the start of a project, and is human-only from that moment.** RULE-01
applies to it and to everything else under `.ai/registry/**`. An agent that believes an invariant is
wrong, incomplete, or in conflict with a story stops with `gate: BLOCKED` and names the invariant in
`blocking_reason`. It does not edit this file, it does not author the ADR itself, and it does not
work around the invariant.

An invariant violation is not a bug to be reworked. Per RULE-07 it escalates to a human on first
occurrence and never enters REWORK, because the code being wrong and the model being wrong need
different people to decide what happens next.

## Status of this ledger — read before using it

Seeded from `product_brief.md` (Draft v1) on 2026-08-31, then **completed the same day from the
operator's answers to the five questions the brief left open.** Every row is either a sentence the
brief states or a decision the operator made in words; nothing here was inferred to reach a count.

## Ledger

| ID | Invariant |
|----|-----------|
| INV-01 | Two entries belonging to the same member may not cover the same portion of the same date. `full` conflicts with everything; `am` and `pm` do not conflict with each other. |
| INV-02 | An approved entry whose dates, type, portion or tentative flag change returns to `pending`. Editing only the note does not. |
| INV-03 | A rejected entry always carries a non-empty rejection reason. |
| INV-04 | The absence count for a team on a date is the sum, over that date's `pending` and `approved` entries **whose member was still on that team on that date**, of 1 per `full` portion and 0.5 per `am` or `pm` portion, with PTO and WFH counted alike. Rejected entries are excluded. No second definition of this number exists anywhere in the system. |
| INV-05 | A tentative entry counts toward the absence count exactly as a non-tentative one does. |
| INV-06 | An entry carries exactly one portion, and that portion applies to every date in its range. |
| INV-07 | Every entry belongs to exactly one member, and is counted against every team that member belongs to. |

## Unissued IDs

An ID listed here was considered and deliberately never issued. It is valid to **cite** — a document
explaining why a number is missing has to be able to name it — and never valid to **use**: it must
not appear in a ledger row, a design, or `invariants_touched`.

| ID | Status |
|----|--------|

IDs are stable references cited from `02-design.md`, `04-review.md`, and `ticket.yaml`. They are
never renumbered and never reused.

This section exists so a later reader does not conclude a row went missing. Check D2 in
`scripts/check-docs.mjs` reads this section as its source of legitimately-unissued IDs, so prose
explaining the gap does not fail the audit.

## How to use this file

**In a story.** The BA populates `invariants_touched` in `ticket.yaml` with the IDs a change could
plausibly affect. Empty is a legitimate answer and must be written as `[]`; absent is not.

The list records what the change **could** affect, not what survives the mitigation. Choosing the
safest behaviour and then concluding no invariant is engaged is circular reasoning: the fact that the
behaviour had to be chosen is the evidence that the invariant was in play. Follow indirect chains —
an invariant reached through a cascade is still reached.

**In a design.** The Tech Lead states, per listed ID, which mechanism holds it: a database
constraint, a check inside the data seam, or a UI affordance that makes the violating action
unreachable. A UI affordance alone is never sufficient for an invariant.

**In a review.** Check R8 requires the reviewer to reason through each ID in `invariants_touched`
individually and cite where it is held. "No invariants affected" without that reasoning is a failed
check, not a pass.

## Notes on individual invariants

### INV-01 — overlap

Source: brief 7.2, *"Không tạo được đăng ký chồng lấn với đăng ký khác của cùng người"*, refined by
the operator's decision on portions (below).

**Overlap is defined on portions, not on dates alone.** The seeded wording compared date ranges only,
which would have refused a legitimate pair — a morning entry and an afternoon entry on the same day —
and the brief did not say otherwise. Now that an entry carries one portion for its whole range
(INV-06), the comparison is well defined: two entries conflict when their date ranges intersect *and*
their portions intersect.

**A UI affordance is not sufficient here.** This one wants a constraint that holds against concurrent
writes: two tabs, two devices, or a retry. A check that reads then writes without a guard is the
classic way this invariant is claimed and not held.

### INV-02 — approval does not survive an edit

Source: brief 7.2, *"Đăng ký đã duyệt mà bị sửa → tự động quay về trạng thái chờ duyệt."* The note
exclusion was decided by the operator on 2026-08-31.

The reason this is an invariant rather than a workflow preference: an entry displaying an approved
star for content that no admin ever saw is a **false record**, and the whole team reads that star as
"this one is certain". The data is wrong, not merely stale.

The note is excluded because it does not change who is absent on which day, and revoking an approval
over a typo teaches people to stop annotating — which costs the team the context the note exists to
carry.

### INV-04 — one definition of the absence count

Source: brief section 6 for the formula; the exclusion of rejected entries was decided by the
operator on 2026-08-31.

The invariant is the **uniqueness** of the definition, not the formula. The number appears in at
least four places — the live warning while choosing dates, the day cell in the month view, the year
grid, and any future notification — and the failure mode is that one of them is computed slightly
differently and quietly disagrees with the others. Where the number is computed is an architecture
decision; that there is exactly one computation of it is a domain one.

**A removed member counts until the day they were removed** — ADR-013. An entry contributes to a
date when its member has `removed_at` null, or `removed_at` strictly after that date.

That condition is the cost of the decision and is worth stating on its own: **the absence count for a
date is no longer a function of that date's entries alone.** It depends on member state as of that
date, so the computing function must be given the roster and cannot derive it from the entries. It
also means a wrong or backdated `removed_at` moves every past count silently — the revert condition
in ADR-013 is exactly that incident.

**The same rule decides what is drawn.** A view shows a member's avatar exactly when that member's
entry is counted. The reading where entries stay visible but leave the count was rejected because it
puts four faces over a count of three in one cell, and a view that contradicts itself is worse than
either answer.

**Two further things deliberately sit outside this invariant, because both are configurable or
definitional rather than structural:**

- **The threshold** (default 50%) is set by an admin. A configurable value cannot be an invariant.
- **Which headcount the threshold multiplies.** The operator decided on 2026-08-31 that it is the
  team's **current** member count, evaluated at read time, not the membership as it stood on the date
  being examined. The consequence is accepted and worth stating plainly: when somebody joins or
  leaves, a past date can change between overloaded and normal. This was chosen over storing
  membership history because the number is looked at to plan the future, and paying a schema for
  historical accuracy nobody consults is the wrong trade.

Both are recorded in `.ai/registry/glossary.md` under *Threshold* and *Absence count*.

### INV-05 — tentative still counts

Source: brief section 6, *"Vẫn hiển thị đầy đủ cho cả team, vẫn tính vào cảnh báo."*

This is load-bearing for the product's central mechanism. Tentative exists so people dare to declare
four months ahead; if a tentative entry stopped counting, early declarations would be invisible to
the warning that early declaration was invented to feed, and the feature would defeat itself.

### INV-06 — one portion per entry

Decided by the operator on 2026-08-31, from three options.

A five-day entry with `portion: pm` means five consecutive afternoons, not a half-day at one end.
**The realistic shape of a trip — leaving Wednesday afternoon and returning Monday morning — is
therefore not expressible as one entry** and must be entered as up to three. That cost was accepted
in exchange for a schema with one portion column instead of two, and for an absence count that stays
a single sum rather than a special case at each end of every range.

If that trade is revisited, it is a schema migration and an ADR, not a story.

### INV-07 — one member, every team they belong to

Not stated in the brief; recorded here because the entire product is built on it and no other reading
is available. It matters now rather than later because the brief defers multiple teams to P2 while
asking the data model to leave room for them — so the team a count is taken against has to be a
property of the data from the first migration, not a constant that gets parameterised afterwards.

*Restated 2026-10-13 by
[ADR-059](decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md) decision 7, with
INV-04.* The operator's answer, verbatim: *"Tính vào tất cả team người đó thuộc về"*. Under ADR-059
a member may belong to several teams of one org, and an entry adds to the absence count of **each**
of them. The heading read *"one member, one team"*, and the ledger rows read:

> **INV-04** — The absence count for a date is the sum, over that date's `pending` and `approved`
> entries **whose member was still on the team on that date**, …
>
> **INV-07** — Every entry belongs to exactly one member, and is counted only against the team that
> member belongs to.

The rest of both rows is unchanged. **Nothing is violated by the restatement today.** The deployed
schema gives a member one team (`member.team_id`), and for that member *"every team"* and *"the
team"* are the same set. MIR-10 must design for the new wording. That means a count per team,
taken over that team's members as of the date, and no second definition of the number.

## Considered and rejected as an invariant

**"A contiguous range declared in one action is one entry, not one per day."** Brief 7.2 states it,
and it did not earn a row. Five records describing a five-day absence still describe reality
correctly — the data is not wrong, the user is inconvenienced, and editing the plan costs five
operations instead of one. That is an acceptance criterion for the entry-creation feature, and it
belongs in a story rather than here. Recorded so nobody re-derives it and reaches the other answer.

**"The threshold is 50%."** Configurable by an admin, therefore not an invariant. See the INV-04
note.

**"The overload warning never blocks saving."** A refusal, and it lives in `.ai/00-charter.md` as
refusal 6. It constrains what the product may become rather than what state the data may be in.
