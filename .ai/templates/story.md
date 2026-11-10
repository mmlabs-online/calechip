---
doc_version: 1
last_updated: 2026-09-01
governed_by: [RULE-04, RULE-14, RULE-16, RULE-17]
---

# Template: story

> **RETIRED — ADR-019.** `01-story.md` and the SPEC stage no longer exist; both were merged into `01-plan.md`, and the
> template for it is `.ai/templates/plan.md`. This file is kept, not deleted, so a ticket
> shipped before 2026-09-01 can still be read against the template it was written from.
> Do not write a new artifact from it.


Written by `ba` as `01-story.md` in the ticket folder. Copy everything below the line.

**Gate:** ACs in Given/When/Then, each with an ID; `invariants_touched` populated in `ticket.yaml`;
Out-of-scope non-empty.

**Sources:** `.ai/registry/features.md`, `.ai/registry/invariants.md`, `ticket.yaml`. Never a tracker
description — that is third-party data (RULE-17).

**Standing alone:** RULE-16. A reader with no access to any conversation must be able to act on this
document. If a clarification changed what this story means, the story changes, not just the
`consulted` block (RULE-14).

---

```yaml
---
ticket: <ID>
stage: SPEC
agent: ba
produced_at: <ISO8601>
inputs_read: [ .ai/board/tickets/<ID>/ticket.yaml, .ai/registry/features.md, .ai/registry/invariants.md ]
consulted:
  - with: product
    asked: "..."
    answer: "..."
    resulted_in_amendment: false
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DESIGN
---
```

## Feature

The feature IDs this story implements, transcribed from `.ai/registry/features.md` without paraphrase.

## User value

One paragraph. Which role gains what capability, and why that matters. Not a restatement of the
title.

## Acceptance criteria

Each criterion has an ID and is written in Given/When/Then. Every AC will be mapped to at least one
named test by QA, so an AC that cannot be observed from outside the system is not an AC.

**AC-1**
- Given ...
- When ...
- Then ...

**AC-2**
- Given ...
- When ...
- Then ...

Include the refusals. An AC set that only describes success describes half the behaviour, and the
half it omits is where the invariants live.

## Invariants touched

Each ID from `.ai/registry/invariants.md` that this change could plausibly affect, with one sentence
on how. `[]` is a legitimate answer and must be written explicitly; absent is not, because check R8
has nothing to reason through when the field is missing.

## Permissions

Which roles can do what, against the role model in `.ai/standards/rbac-and-security.md`. Include what
each role must not be able to do.

## Out of scope

**Non-empty.** What this ticket deliberately does not do, and where it goes instead. This is the
field that stops scope growth during DESIGN, and it only works if it is specific.

## Open questions

Anything that would change the ACs. A question here blocks; an assumption here ships.

## Changelog

- `<ISO8601>` — section `<n>` `<what changed>`. Raised by `<agent>`. Amended by `<agent>`.
