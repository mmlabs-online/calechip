---
doc_version: 2
last_updated: 2026-08-10
governed_by: [RULE-01, RULE-11, RULE-12, RULE-13, RULE-14, RULE-15, RULE-16]
---

# ADR-001 — Bounded agent chat

> **Inherited from the origin project this kit was extracted from.** ADR-001 was decided
> there, against a real loop, and is carried into this template unchanged in substance because the
> decision is about the process rather than about that product. It is in force here as written. If
> this project reaches a different conclusion, supersede it with a new ADR rather than editing this
> one — the record of what was decided first is what makes the second decision legible.

## Status

`ACCEPTED` — 2026-08-10, at bootstrap, by the operator.

## Context

The initial position on this system was an outright ban on agent-to-agent conversation. Every handoff
would be a file, every question would be a rejected artifact, and an agent that needed something it
did not have would fail its gate and hand the problem back upstream.

The reasoning behind the ban was sound but the diagnosis behind it was not. The failure mode being
guarded against is real and worth naming precisely: in multi-agent systems where agents converse
freely, the design stops living in the design document and starts living in the transcript. Six
tickets later, when an output is wrong, there is no artifact that explains why the code looks the way
it does, because the binding decision was made in a conversation nobody can reconstruct. Reviews
degrade into negotiation, because a reviewer who has been talking to the developer for twenty
messages has already absorbed the developer's framing before writing a single line of the verdict.

But a ban has a cost that is paid on every single ticket, not only on the pathological ones. A
Developer who finds that the design's section 1 omits a field name has exactly one move: fail the
gate, return to DESIGN, wait for a re-dispatch, and start over with a fresh context. That is a full
round trip and a full context rebuild to answer a question that takes one sentence. Multiply by the
frequency of small underspecifications — which is high, because designs are written before the code
exists — and the ban makes the loop slow enough that a human starts bypassing it.

The distinction that resolves this is between two things a ban conflates:

|  | Clarification | Adjudication |
|---|---|---|
| Shape | question then answer | position, negotiation, verdict |
| Direction | downstream asks upstream what was intended | judge and judged converge on an outcome |
| Effect on the artifact | improves accuracy | contaminates it |

Chat did not cause the failure mode. Chat *replacing the verdict* did.

## Decision

Agents may converse, under six constraints, recorded as RULE-11 through RULE-16 in
`.ai/registry/rules.md`. In summary of what they jointly produce:

Conversation is permitted only along edges that point backwards, toward whoever declared intent. A
Developer may ask the Tech Lead what a design section meant. QA may ask the BA what an acceptance
criterion covers. Nobody may talk to the agent who will judge their work until that judgement exists
as a file. Every conversation is bounded at six messages per pair per ticket, and exhaustion produces
a BLOCKED artifact rather than a longer conversation. Every conversation that changed anything must
appear in the consuming artifact's `consulted` front-matter block, and if it revealed that an
upstream artifact was incomplete, that artifact is amended — answering in chat alone is prohibited.
Artifacts stand alone; "as discussed" is banned. REVIEW and QA run as isolated dispatch with no
message channel at all.

The full rule text lives in `.ai/registry/rules.md` and is not restated here.

## Rationale

**Alternative 1 — the original ban.** Costs one full dispatch and one context rebuild per
clarification, on a class of clarification that is frequent and cheap to answer. Rejected on cost,
not on principle; if the metrics below turn, it comes back.

**Alternative 2 — unbounded chat with logging.** Log everything and trust the review to catch
contamination. Rejected because a log is not a constraint. The contamination it is meant to catch is
precisely the kind that makes the reviewer stop looking for it.

**Alternative 3 — chat allowed but artifacts optional.** Rejected outright. This is the failure mode
itself, adopted deliberately.

The chosen design keeps the property that made the ban attractive — the artifact is the only binding
output — while removing the cost that made it impractical. It does this by constraining direction
(backwards only), participants (never your judge), volume (six messages), and provenance (recorded or
it did not happen).

## Consequences

**What gets better.** One dispatch saved per clarification. Underspecified designs get amended
instead of silently worked around, which means the design document stays true, which is the thing the
ban was trying to protect in the first place.

**What gets worse, and this is the real cost.** Constructing agents — BA, Tech Lead, Developer — can
now converge on a shared wrong understanding. Three agents that talked to each other and agreed are
more confident and no more correct than three that did not. A ban made this impossible by
construction; bounded chat makes it merely detectable.

Detection is exactly what REVIEW and QA are for, and it is why they stay outside the chat topology
entirely (RULE-13). The reviewer's value is that it has not been in the room. The moment a reviewer
joins the conversation, the system has spent its only independent check to save one dispatch, which
is a bad trade at any volume.

**What this obligates.** The `consulted` block becomes load-bearing. An artifact whose content
reflects a conversation but whose `consulted` block is empty is a gate failure, not a formatting
nit — it is a provenance lie, and provenance is how a bad output gets diagnosed six tickets later.
`chat_before_verdict: none` on a review or test report is an attestation with the same weight.

## Revert condition

**Amendment rate falls below 40%.**

Amendment rate is the proportion of clarifications that resulted in an upstream artifact being edited
(`resulted_in_amendment: true` in the `consulted` block), tracked in `.ai/board/metrics.md`. The
target is 60% or above.

Below 40% means clarifications are being answered in chat and left there. That is the precise
signature of artifacts having stopped being the source of truth and the real design having moved into
transcripts — the failure mode this ADR claims to have avoided. If that number is observed over any
ten consecutive tickets, RULE-11 through RULE-16 are struck and the ban is reinstated.

A secondary signal, not itself a revert trigger but a reason to look: clarifications per ticket
consistently at or near the six-message budget. A pair that always exhausts its budget is not
clarifying, it is negotiating.

## Affected documents

| File | Must reach |
|------|------------|
| `.ai/registry/rules.md` | doc_version 1 — RULE-11 through RULE-16 present |
| `.ai/01-operating-model.md` | doc_version 1 — chat topology table, front-matter schema |
| `.ai/board/metrics.md` | doc_version 1 — amendment rate row and target |
| `.claude/agents/developer.md` | RULE-12 pairs stated in the "You do NOT" section |
| `.claude/agents/qa.md` | no message channel stated |
| `.claude/agents/tech-lead-review.md` | no message channel stated |
