---
doc_version: 3
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-08, RULE-09]
---

# ADR-012 — DESIGN resizes without routing back to SPEC

## Status

`ACCEPTED by the operator` — 2026-08-31.

Recorded, not authored. The operator's words: *"tech-lead có quyền resize feature tự động k cần hỏi
ba"*, and, when told the change would not unblock the ticket in front of them,
*"áp dụng rule này trên các ticket sau. Tôi đang xử lí TEA-01 rồi k cần qtâm."*

**Applies from the next ticket. TEA-01 is out of scope and is being handled by the operator.**

## Context

Two fields carry size. `size_estimate` is the BA's judgement at SPEC, read from the story's scope,
and it gates the Definition of Ready. `size` is the Tech Lead's verdict at DESIGN, read from the
enumerated `allowed_paths`, and it decides whether the ticket splits.

The Sizing section said that when the two disagree the verdict wins **and DESIGN routes the ticket
back to SPEC**, on the grounds that an M that designs out to L means the story was under-specified.

That routing cost a full stage for information the design had already produced. The BA's second pass
would read the same design and reach the same size, because the size came from the enumerated file
list rather than from anything the story could have said differently.

## Decision

**The Tech Lead sets `size` at DESIGN and proceeds. A disagreement with `size_estimate` no longer
routes the ticket back to SPEC.**

The gap is recorded rather than routed: DESIGN states both numbers in `02-design.md` section 5 and
says in one line why they differ. `metrics.md` keeps the pair, so a BA whose estimates are
consistently low is visible in the data rather than through a stage that reruns.

**Per RULE-08 this was never rework and still is not.** No `rework_count` increments, in either
direction.

## What this decision does not change

**The Sizing table is untouched. `L` still must split at DESIGN, and `XL` still escalates.**

This is worth stating because the two are easy to conflate and were conflated when the decision was
made. A ticket that designs out to L is stopped by the split requirement, not by the disagreement —
so removing the routing does not let an L ticket proceed. It lets an S-estimated ticket that designs
out to M proceed, and it removes one of the two reasons an M-to-L ticket stops.

## Rationale

The alternative was to keep the routing and accept the extra pass, on the grounds that a wrong
estimate is a signal about the story. The signal is real; the routing was an expensive way to carry
it. Writing both numbers into the design and the metrics keeps the signal at the cost of a line
rather than a stage.

The stronger objection — that DESIGN now silently absorbs a specification defect — is answered by the
split requirement, which is the case where the defect actually matters and which still stops.

## Consequences

- A ticket whose estimate was low no longer loses a stage to being told so.
- **The under-specification signal moves from a blocking route to a recorded number.** A number
  nobody reads is weaker than a stage nobody can skip; `metrics.md` has to actually be looked at
  between tickets for this to keep working.
- DESIGN's verdict is now final for everything except the split threshold, which concentrates more
  judgement in one stage.

## Revert condition

**Three consecutive tickets where `size` exceeds `size_estimate`.** That is no longer a routing
event, so nothing will stop for it — which is exactly why it needs a number to watch. Three in a row
means SPEC is systematically under-reading scope and the routing was carrying real weight.

## Affected documents

| File | Change |
|---|---|
| `.ai/01-operating-model.md` | The Sizing section: the verdict wins and DESIGN proceeds |
| `.ai/board/metrics.md` | Records both numbers per ticket, so the revert condition is observable |
