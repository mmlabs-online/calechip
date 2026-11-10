---
doc_version: 2
last_updated: 2026-09-09
governed_by: [RULE-01, RULE-07, RULE-08, RULE-13]
---

# ADR-033 — Review check R9 compares the built screen to its reference image

## Status

**`ACCEPTED by the operator` — 2026-09-09.**

The operator asked why the year view does not look like the design image, was shown the two
defensible answers `.ai/board/model-debt.md` MD-030 item (3) had parked on them since 2026-09-09, and
chose the first in those words: **add a visual check at REVIEW.** The alternative offered and not
taken was to accept explicitly that the image is spent at PLAN and never re-read.

That decision is recorded here rather than in the model-debt row because it changes the review gate,
which is `.ai/01-operating-model.md`'s to state and RULE-01's to govern.

## Context

**Nothing in this loop has ever compared a built screen to the picture it was built from.**
`.ai/standards/ui-design-system.md` § *An image binds nothing by itself* said so in terms: *"No stage
downstream ever reopens it."* The reviewer judges R1–R8 against `01-plan.md`; there is no visual
check at REVIEW, none in CI, and no QA stage since ADR-022. Fidelity rested entirely on how
completely `01-plan.md` § 2b converted a picture into acceptance criteria, in one pass, with no
verification loop.

**The gap was predicted before it was observed.** MD-030 recorded, as its second consequence, that
*"the built UI does not match the image, and cannot be shown to, because what travels downstream is
prose"* — and named the fidelity half as a separate decision belonging to the operator, *"because it
costs a stage."*

**CAL-10 is what made it visible, and it is the strongest possible case for the defect.** That ticket
had everything the model can currently give a screen: a real JPEG on disk at the canonical path — the
first in 33 tickets — read at PLAN and listed in `01-plan.md`'s own `inputs_read`; R1–R8 all PASS on
one pass; no rework, no consultation, no amendment. The shipped screen still differs from the image
in five places. Four of those five are recorded refusals in § 1 *Out of scope* and are correct. **The
model had no way to tell the operator that**, because it had no mechanism that looks at both.

## Decision

**A ninth review check, R9.** It is added to the checklist in `.ai/01-operating-model.md`, to
`.ai/templates/review-report.md`, and to the `/review` gate.

**R9 — Every visible difference between the built screen and the reference image is accounted for in
`01-plan.md`, as an acceptance criterion or as an Out-of-scope refusal.**

Four properties, each of which is the reason the check is worth having rather than a detail of it:

1. **It is falsifiable, and *"looks like the screenshot"* is not.** The standard already refuses that
   phrase as an acceptance criterion, on the grounds that it cannot be observed from outside the
   system by a reader who cannot ask a question. R9 does not ask whether the screen *resembles* the
   picture. It asks whether every difference has a written home. That is a question with an answer, a
   citation, and a wrong answer.

2. **It runs only where a reference exists.** R9 engages when
   `.ai/board/tickets/<ID>/design/` holds an image file. With no image it is `n/a` and the reviewer
   writes the reason — today that is nine folders out of ten, which is MD-030's other half and is not
   this decision's to fix. **A check that fails a ticket for having no picture would stop the loop
   over a defect nobody in the loop can repair.**

3. **A transcription is not a reference.** A `design/README.md` with no sibling image file is prose
   about a picture, and comparing a screen to prose is the unfalsifiable judgement R9 exists to
   avoid. It does not satisfy R9's precondition.

4. **The capture mechanism ships with the check.** `scripts/capture-screen.mjs` signs in as a fixture
   member, navigates to a route, and writes a PNG the reviewer reads. **This is the whole difference
   between R9 and the instruction MD-030 is about.** `/triage` and `/plan` were told for months to
   `move` an attached image into the ticket folder; no role could write image bytes, so the step
   degraded silently into prose for 33 tickets. Writing R9 with no way to take the screenshot would
   reproduce that defect one stage further down.

**The PNG is a review artifact and is not committed.** `04-review.md` records what was seen, which is
the durable half; a screenshot in git is a second copy that is stale on the next commit.

## Failure routing

An unaccounted difference is one of two defects, and they route differently — the same split R5
already carries, for the same RULE-08 reason:

| Failing | Route to | Increments `rework_count` |
|---|---|---|
| R9, the difference contradicts an acceptance criterion the plan states | `developer` | Yes |
| R9, the difference is a decision the picture makes that the plan never converted | `tech-lead-design` | No |

**The second is the common one and it must not be charged to the Developer.** A developer who built
exactly what § 2b wrote has done their work; that the picture said more than § 2b captured is a PLAN
defect. RULE-08 exists for precisely this.

## Consequences

1. **ADR-022's renumbering is finished as part of this change, and had to be.** That ADR removed the
   old R7 and renumbered R8/R9 to R7/R8 — and five files kept saying `R1 to R9` or naming R9 as the
   dependency check: `.claude/commands/review.md:2`, `.claude/agents/tech-lead-review.md:3`,
   `.claude/agents/developer.md:29`, `.claude/agents/devops.md:65`,
   `.claude/agents/tech-lead-design.md:52`. Two reviewers recorded it — `ADM-01/04-review.md:44` and
   `UIE-01/04-review.md:225` — and nothing acted on it. **Introducing a real R9 on top of a stale R9
   would have given one number two meanings**, so the cleanup is a precondition of this decision and
   not a tidy-up beside it.

2. **`.ai/templates/review-report.md` carried three more of the same debt** and is corrected here:
   front-matter `next_state: QA`, a stage ADR-022 deleted; a `## R8 detail` heading over what is the
   R7 invariant section; and *"R8 does not route to REWORK. Per RULE-07 it escalates"*, which is true
   of R7 and false of R8. Every reviewer since ADR-022 has silently corrected the first one.

3. **`.ai/standards/ui-design-system.md` § *An image binds nothing by itself* is no longer true** and
   is amended rather than deleted. An image on disk now binds one thing: that a difference from it be
   written down somewhere. It still specifies nothing by itself, and § 2b still carries the whole
   burden of converting it.

4. **REVIEW gets slower on tickets with a reference image.** One build, one screenshot per screen,
   and a reading. Accepted: it is one of ten tickets today, and the alternative on offer was to keep
   shipping screens nobody compares.

5. **MD-030 item (3) is discharged.** Items (1) and (2) are not — the `move` verb still stands in two
   command files and there is still no D-check counting transcriptions without a sibling image. The
   row stays open.

## Rejected alternative

**Accept explicitly that the image is spent at PLAN and never re-read.** This was the second option
put to the operator and it is genuinely defensible: it is what the model does today, it costs no
stage, and it puts the whole weight on § 2b where the picture is still fresh. It was rejected because
the operator asked the question that only a comparison can answer — *why does this not look like the
picture* — and under this option the model's honest reply is permanently *nobody looked*.

Its real merit is preserved in R9's shape: R9 does not reopen the image as a specification. It reopens
it exactly once, to ask whether the plan already said everything the picture said.
