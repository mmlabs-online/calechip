---
doc_version: 3
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-09]
---

# ADR-008 — An agent may accept an ADR, under its own name

## Status

`ACCEPTED by the operator` — 2026-08-31.

Recorded, not authored. The operator asked why a human step remained after ADR-007 removed the
feature-row step, was shown that RULE-09 is a different rule covering ADRs, and chose to amend it:
*"Đổi luôn — agent tự accept ADR."*

## Context

ADR-007 removed the human step between TRIAGE and BACKLOG. The next ticket stopped anyway, on a
`NEEDS-ADR` verdict, and the operator's objection was reasonable: they had asked for a loop that does
not stop.

Two different things were tangled in that stop, and only one of them was a defect.

**The defect.** `.claude/commands/triage.md` said a verdict may be `NEEDS-ADR` and never said who
writes the ADR, so the `product` agent handed the operator homework — *"anh viết ADR"*. That
contradicted how every ADR in this repository was actually produced: 005, 006 and 007 were each a
sentence from the operator and a document written by an agent. The operator has not written a line of
any of them.

**The rule.** RULE-09 named ADRs among the permanently human actions. Under it, an agent could draft
an ADR but not accept one, so a decision nobody had made yet still required a person to say the
sentence.

## Decision

**RULE-09 is amended** from *"Schema changes, ADRs, registry edits, and PR merges are permanently
human"* to:

> Schema changes and PR merges are permanently human. An ADR may be accepted by an agent, recorded
> under that agent's name; `ACCEPTED by the operator` remains a claim about a person.

Version 1 to 2. Registry edits are governed by RULE-01, which ADR-007 already amended.

*Check D8 reports the quotation above as a 100% restatement of RULE-09 without `verbatim_in`. That is
expected and must not be "fixed" by rewording: an ADR recording an amendment is a snapshot of what the
rule became on a date, not a copy that should be kept in step. Recorded as MD-012.*

**The `Status` line carries who decided, and the distinction is not cosmetic.**

| Status | Means |
|---|---|
| `ACCEPTED by the operator` | A person said it, in words that can be quoted. Writing this without that having happened is forging a signature, and remains so. |
| `ACCEPTED by <agent>` | An agent decided. Reviewed at merge under CODEOWNERS, like any other registry change. |

**An agent still asks rather than decides when the ADR would supersede or reverse an accepted one.**
That is not a residual permission gate; it is the difference between making a decision inside an
existing envelope and changing the envelope. `.claude/commands/triage.md` states the test.

## Rationale

The alternative was to keep RULE-09 and fix only the command — the agent drafts the whole ADR,
options, trade-offs, recommendation and revert condition, and asks the operator one question. That
was recommended, on the grounds that it is what has actually worked all day and costs the operator a
single sentence.

The operator chose the broader change with the cost stated in front of them. Recorded that way rather
than softened: the recommendation was not taken, and the reasoning above is why it was made.

## Consequences

- **The loop no longer stops on `NEEDS-ADR`** where the decision sits inside what is already decided.
- **`ACCEPTED by the operator` keeps its meaning**, which is the whole reason a second status value
  exists rather than a relaxed rule.

**What becomes weaker:**

- **An architecture decision can now be made with no human in the loop until merge.** The operator
  sees it in a pull request, after the story, the design and possibly the code were built on it.
- **The reviewer's burden moves.** Previously a decision arrived as a question and cost one sentence
  to answer; now it arrives as a finished document that has to be read to be disagreed with, and
  reading a well-argued ADR is more expensive than answering a question.
- **`ACCEPTED by <agent>` will accumulate.** A repository whose decision record is mostly
  agent-signed is a repository where nobody has to have understood the decisions.

## Revert condition

**The first ADR accepted by an agent that the operator disagrees with at merge.** Not "would have
worded differently" — disagrees with the decision. One occurrence restores RULE-09, because the whole
value of the amendment was avoiding a question that turns out to have been worth asking.

A second signal, slower and worth watching: if three consecutive tickets ship with agent-accepted
ADRs the operator never read before merging, the record has stopped being a decision log and become
paperwork.

## Affected documents

| File | Change |
|---|---|
| `.ai/registry/rules.md` | RULE-09 text amended, version 1 to 2, enforcement map |
| `.ai/registry/decisions/ADR-000-template.md` | The `Status` section carries both forms and the test between them |
| `.claude/commands/triage.md` | `NEEDS-ADR` drafts the ADR; states when an agent decides and when it asks |
| `.ai/standards/tech-stack.md`, `.ai/templates/tech-design.md` | `doc_version` to 2, because check D9 fails a document citing a rule at a version above its own |
