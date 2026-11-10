---
doc_version: 3
last_updated: 2026-09-01
governed_by: [RULE-01, RULE-16]
---

# Template: idea

Written by `product` into `.ai/board/ideas/`. Filename: `<yyyy-mm-dd>-<kebab-slug>.md`.

An idea is not a ticket and does not have a feature ID. Only a human can create a feature ID
(RULE-01), and that happens after triage.

Copy everything below the line.

---

```yaml
---
stage: TRIAGE
agent: product
produced_at: <ISO8601>
inputs_read: []
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE          # not the routing input — see `verdict` below
verdict: ""                 # "" until triaged, then REJECT | NEEDS-ADR | PROMOTE
verdict_reason: ""          # one line. Why this verdict, not one of the other two
ticket_id: ""               # the ticket a PROMOTE created. Empty on REJECT and NEEDS-ADR
awaiting_adrs: []           # NEEDS-ADR only: every ADR the verdict waits on, e.g. [ADR-039, ADR-040]
operator_request: ""        # the request as it arrived, VERBATIM. Never edited, never tidied
---
```

**`verdict`, `verdict_reason` and `ticket_id` are read from this file by `scripts/run-loop.mjs`** —
ADR-037. Before they existed the verdict lived only in a Markdown heading, in at least eight observed
shapes across this directory, and `gate:` was `PASS` on every idea file including the one that was
REJECTed — so nothing on disk distinguished a rejected idea from a promoted one without reading the
prose. Two files carry two verdicts, an original and a re-triage, and only one of them marks which is
live, in bold. Fill the three fields; keep writing the heading as well, for a human reader.

**`operator_request` holds the request as it arrived.** Not a summary of it, not a tidied version,
not the problem statement derived from it. If the operator wrote a solution — *"add a dark mode
toggle to the sidebar"* — that sentence goes here unchanged, and the problem it implies is worked out
separately in `## Problem` and marked as your derivation. See *When the request is shaped like a
solution* below.

## Problem

What is wrong or missing today, in terms of what a person cannot do. No solution here — an idea that
opens with a solution has already skipped the step where the problem is checked.

## Who has it

Which role, and how often. "A supervisor, every time an order is reassigned" is usable. "Users" is
not.

## Evidence

What makes this real rather than imagined. A support request, an observed workaround, a rule in the
registry that has no surface. If there is none, say so — an idea with no evidence can still be worth
recording, but it should not look like one with evidence.

**A screenshot or mockup goes here, and here only, at this stage.** Record it as
`Visual reference: <path>` and say in one line what it is meant to settle. On PROMOTE it moves into
the ticket's `design/` folder and becomes that ticket's reference; on REJECT or NEEDS-ADR it stays
here as evidence about a problem, which is all it ever was. `.ai/standards/ui-design-system.md`
§ *Visual specification*.

## Impact if ignored

What continues to happen. Prefer a concrete consequence over a severity word.

## Constraints already known

Invariants that clearly apply, roles involved, anything in `.ai/registry/` that bounds the solution
space. Cite IDs.

## Out of scope

What this idea explicitly does not cover. Writing this now is what stops the eventual ticket from
growing during PLAN.

## Open questions

Anything that must be answered before this can be triaged. A question here is better than an
assumption in the next artifact.

## When the request is shaped like a solution

**Most operator requests arrive as solutions, and that is not a defect in the request.** "Add a
column for last sign-in" is how people think; "members cannot tell who has stopped using the board"
is what the idea file needs. The job here is to derive the second from the first — not to send the
first back.

Three rules, and the first two are what stop a derivation from becoming an invention:

1. **`operator_request` keeps their words exactly.** It is the only thing in this file that is not
   yours, and it is what a reviewer six tickets later compares your problem statement against.
2. **Mark the problem statement as your own derivation**, in one line under `## Problem`: *"Derived
   from the request above; the operator stated a solution, not a problem."* A derived problem that
   reads as reported fact is the quiet start of a ticket nobody asked for.
3. **Never REJECT an idea for being solution-shaped.** REJECT means *not worth doing, or already
   covered*. The shape of the sentence is not evidence of either, and a triage that rejects on shape
   teaches the operator to write worse requests rather than better ones. If the solution as stated is
   wrong, that is a PROMOTE whose problem statement differs from the request, or a NEEDS-ADR — both
   of which say so in `verdict_reason`.
