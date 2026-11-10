---
doc_version: 3
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-07, RULE-09]
---

# ADR-013 — A removed member's entries count until the day they were removed

## Status

`ACCEPTED by the operator` — 2026-08-31.

Recorded, not authored. Offered three readings; the operator chose *"tính trước ngày xoá, không tính
sau"* — count before the removal date, not after.

## Context

`/triage` on CAL-07 reported this as blocking READY for CAL-04 and CAL-07, and described it as an
amendment the operator had already made in words. **It was not.** The operator's decision of
2026-08-31 was *"admin xoá, giữ lại đăng ký"* — entries survive a removal — and the consequence
recorded against it was about the **denominator**: team size drops, so a past date can flip between
overloaded and normal.

Whether those surviving entries still count is a separate question about the **numerator**, and
nobody had answered it. Writing it up as already-decided would have put a signature on a sentence
the operator never said, which is the one thing `.ai/steward/context.md` is most explicit about.

**The question was real even though its provenance was wrong**, and the observation that surfaced it
is the sharpest thing in the report: under a reading where entries stay visible but leave the count,
**a month cell shows four avatars over a count of three**. A view that contradicts itself in the same
cell is worse than either answer.

Three readings were possible. Counting a departed member forever warns about crowding that cannot
happen. Hiding them entirely rewrites the past, erasing the evidence behind the brief's own success
metric — *"số ngày quá tải thực tế xảy ra"* in section 9 — and turning a week that genuinely needed
four handovers into a week that looks like three.

## Decision

**An entry counts toward a date if the member was still on the team on that date.**

Formally, INV-04's numerator sums the date's `pending` and `approved` entries whose member has
`removed_at` null, **or** `removed_at` strictly after that date.

**The same rule decides what is drawn.** A cell shows an avatar exactly when that member's entry is
counted, so the number and the faces above it can never disagree. That is not a UI preference; it is
the reason this reading was chosen over the one that made the two diverge.

## Consequences

- The past stays true. A week that needed four handovers still reads as four, and the brief's
  overloaded-day metric keeps its evidence.
- The future stops warning about absences that cannot occur.
- **INV-04 gains a time-dependent condition**, which is a real cost: the absence count for a date is
  no longer a function of that date's entries alone. It now depends on member state as of that date.
- **The counting function must receive the roster, including `removed_at` per member.** It cannot
  fetch it: `/triage` had already required a pure `absenceCountsFor(entries, range, roster)` for
  CAL-07, so that an unsaved draft entry can be scored before it is written. This decision needs the
  same argument for a different reason, and the two agree.
- `metrics.md` figures computed before this date used the old numerator, where they used one at all.

## Revert condition

**The first time somebody asks why a past date's count changed after a removal and the answer is
"it did not, and that is the bug".** Concretely: if a member is removed with a `removed_at` that is
wrong or backdated, every past count moves with it, silently and everywhere. One such incident means
`removed_at` is carrying more weight than an administrative timestamp should, and the correction is
to snapshot the count rather than derive it — which contradicts INV-04 and would need its own ADR.

## Affected documents

| File | Change |
|---|---|
| `.ai/registry/invariants.md` | INV-04's row and note; `doc_version` to 3 |
| `.ai/registry/glossary.md` | *Absence count*, in the same commit — a ledger and a glossary that disagree are worse than either being wrong alone |
| `.ai/registry/features.md` | The blocking markers on CAL-04 and CAL-07 are closed |
| `.ai/board/tickets/CAL-07/ticket.yaml` | The same marker |
