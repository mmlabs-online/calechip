---
doc_version: 3
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-09, RULE-17]
---

# ADR-007 — `/triage` issues feature IDs; the human step moves to merge

## Status

`ACCEPTED by the operator` — 2026-08-31.

Recorded, not authored. The operator's words: *"tôi không muốn có đoạn người thêm row. mọi thứ tự
động cho tôi."*

## Context

The lifecycle placed a mandatory human step between TRIAGE and BACKLOG: a person added the feature
row to `.ai/registry/features.md`, and no agent could. `/spec` refuses a ticket whose feature IDs do
not resolve, so that step gated every ticket.

**Two documents in this repository already disagreed about it.** The standing instructions in
`.ai/steward/context.md`, in force since 2026-08-23, say: *"Feature rows, glossary entries, tracker
fields — write them. They are a work queue. This is the whole friction ADR-004 removed and there is
no reason to hesitate."* The operating model said the opposite. A model that contradicts the
operator's own standing preference is not a stricter model, it is an inconsistent one.

RULE-01 as written required *an ADR and human approval* for any change under `.ai/registry/**`.
Applied literally to a feature row that means an architecture decision record per line of a work
queue, which nobody has ever done or intended.

## Decision

**On a `PROMOTE` verdict, the `product` agent writes the feature row itself.** The human step between
TRIAGE and BACKLOG is removed. `BACKLOG` remains a state; its owner becomes `orchestrator`.

**RULE-01 is amended** from *"requires an ADR and human approval"* to *"requires human approval, and
an ADR for everything except feature and glossary rows"*. Version 1 to 2. Human approval is unchanged
and still happens where the rule always said enforcement lives: CODEOWNERS review on the pull
request.

Three constraints make this safe enough to be worth doing, and none of them is decoration:

1. **The ID is issued at TRIAGE by `product`, never at SPEC by `ba`.** The role that will write the
   story is not the role that grants the ID it writes against. This is the same maker-and-judge
   separation the rest of the model runs on, and it is the part of the removed human step that
   actually carried the weight.
2. **Every row written by triage cites the idea file it came from**, in the `Notes` column. A
   fabricated feature then has no provenance, and the reviewer has something concrete to check rather
   than a plausible-looking line.
3. **The row is still uncommitted when written** (ADR-006) and reaches the operator on the `ops/`
   branch at `/ship`, under CODEOWNERS.

## Rationale

The alternative was to keep the human step. It was rejected because it had already stopped being a
control in practice: the operator's standing instruction told every steward run to write feature rows
freely, so the step survived as text rather than as behaviour, and text that everybody is instructed
to ignore is worse than no text.

The narrower alternative — automate the write but require an ADR per row — was rejected as
unserious. An ADR is for a decision with a revert condition; a feature row is a queue entry.

## Consequences

What becomes true:

- A promoted idea reaches `/spec` without stopping. That is the whole of what was asked for.
- The registry and the standing instructions agree for the first time.

**What becomes weaker, stated plainly because it is the cost:**

- **D1 no longer catches an invented feature, only a dangling citation.** Its job was to fail the
  audit on a feature ID that resolves to no row. With `product` able to write the row, the loop can
  go idea → ID → row → story with no human in between, and D1 passes throughout. What still catches a
  fabricated feature is the provenance requirement above and the operator reading the pull request.
- **The reviewer sees the row later than before** — at `/ship`, after the story was written and the
  design was done. A feature that should never have existed is discovered after it has been paid for.
- **RULE-01 protects less than it did.** It still requires human approval for everything under
  `.ai/registry/**`; it no longer requires an ADR for two row-shaped files. `rules.md`,
  `invariants.md` and `decisions/` are unchanged and still need one.

## Revert condition

**The first feature row that reaches a pull request and should not exist** — an ID nobody asked for,
a row whose cited idea file does not exist, or a feature the operator does not recognise. One
occurrence restores the human step between TRIAGE and BACKLOG.

Watch it deliberately on the first three tickets rather than waiting to notice.

## Affected documents

| File | Change |
|---|---|
| `.ai/registry/rules.md` | RULE-01 text amended, version 1 to 2, enforcement map |
| `CLAUDE.md` | The verbatim copy of RULE-01, which check D7 compares character for character |
| `.ai/01-operating-model.md` | Lifecycle diagram, the paragraph naming the human step, stage ownership for TRIAGE and BACKLOG |
| `.claude/commands/triage.md` | `PROMOTE` writes the row |
| `.claude/agents/product.md` | May write `.ai/registry/features.md` |
| `.ai/registry/features.md` | Records where rows now come from |
| Every document citing RULE-01 in `governed_by` | `doc_version` raised to 2, because check D9 fails a document citing a rule at a version above its own |
