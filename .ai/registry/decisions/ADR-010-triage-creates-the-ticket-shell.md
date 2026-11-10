---
doc_version: 3
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-09]
---

# ADR-010 — `/triage` creates the ticket shell

## Status

`ACCEPTED by steward` — 2026-08-31.

**This is the first ADR accepted by an agent rather than by the operator**, under
[ADR-008](ADR-008-agents-may-accept-adrs.md). It qualifies because it works inside the envelope
ADR-007 opened — removing human steps from the path between an idea and a ticket — and supersedes
nothing. ADR-008's revert condition points at exactly this document: if the operator disagrees with
the decision below at merge, RULE-09 goes back to v1.

## Context

`/next-ticket` reported nothing runnable and was right for a reason nobody had written down.

`features.md` held four rows, `TEA-01` to `TEA-04`, promoted by `/triage` the same day under ADR-007.
`.ai/board/tickets/` held only `.gitkeep`, and every table in `backlog.md` was empty. **No command in
the loop turns a promoted feature row into a ticket.**

- `/pull-tickets` is the only command that creates a ticket shell, and it reads a tracker. This
  project has none: `allowed_list_ids` is `[]`, so it fails closed, correctly.
- `/next-ticket` is report-only by design — *"No file is written and nothing is invoked"* — so it
  cannot fill the gap without losing the property that makes it safe to run.
- `SETUP.md` describes the sequence as *"a human adds the feature row, and `/spec`"*, skipping the
  ticket's creation entirely.

**Two further inconsistencies surfaced with it**, both left behind by ADR-007:

- The Definition of Ready table says items 1, 3, 4 and 6 are produced at BACKLOG *by a human*, and
  item 1 specifically by *"a human, when promoting the idea"*. ADR-007 moved promotion to `product`.
- The stage ownership row for BACKLOG was changed to `orchestrator` by ADR-007, while the DoR table
  kept saying a human. Two documents, two owners, same stage.

The loop therefore had a hole exactly where the previous two ADRs had been removing them, and it was
invisible until a board with promoted features and no tickets existed to make it visible.

## Decision

**On a `PROMOTE` verdict, `/triage` creates the ticket alongside the feature row.** Per row:

1. `.ai/board/tickets/<ID>/ticket.yaml`, copied from `.ai/templates/ticket.yaml`, at `state: BACKLOG`.
2. Definition of Ready items **1, 3, 4 and 6** filled, since all four are produced at BACKLOG:
   `feature_ids`, `depends_on`, `schema_delta` (with its ADR linked when it is not `none`), and one
   feature group per ticket.
3. A row appended to the `## BACKLOG` section of `backlog.md`.

Items 2 and 5 stay empty — `invariants_touched` and `size_estimate` are the BA's, at SPEC, and the
gate is placed after SPEC precisely so they can be.

**The DoR table is corrected** to name the producing agent rather than "a human" for all four
BACKLOG items, matching the stage ownership table ADR-007 already changed.

**A promoted feature is a backlog item.** That is why the shell is created at promotion rather than
lazily at `/spec`: `backlog.md`'s `## BACKLOG` section means *"awaiting SPEC, ordered"*, and a
promoted row that appears nowhere in it is a decision to build something that the board cannot see.

## Rationale

The alternative was to have `/spec <ID>` create the shell on first use. It was rejected because it
leaves `backlog.md` empty until somebody already knows which ticket to specify — and knowing that is
what `/next-ticket` exists to answer. The board would be unable to report work that had been decided
on, which is the failure this ADR is fixing rather than a smaller version of it.

Adding a separate ticket-creation command was rejected as a command whose only job would be to
compensate for another command stopping one step short.

## Consequences

- `/idea` → `/triage` → `/next-ticket` → `/spec` runs with no human step anywhere in it.
- Every promoted feature appears on the board immediately, which is also the cost: a promotion that
  turns out to be premature now creates a ticket somebody has to close rather than a row somebody can
  ignore.
- `product` and `tech-lead-design` between them now set `schema_delta`, which is a technical
  judgement made before any design exists. It is a coarse one — `none`, or an ADR link — and DESIGN
  remains free to contradict it, but it is a claim made early and it can be wrong.

## Revert condition

**The first ticket that reaches SPEC with a `schema_delta` that DESIGN then contradicts**, or the
first backlog that accumulates shells for features nobody intends to build. Either means the shell is
being created too early, and `/spec` creating it lazily is the correction.

## Affected documents

| File | Change |
|---|---|
| `.claude/commands/triage.md` | PROMOTE creates the ticket and the backlog row |
| `.ai/01-operating-model.md` | The Definition of Ready table names the producing agent, not "a human" |
| `.ai/board/tickets/TEA-01` … `TEA-04` | Backfilled once, because the command was incomplete when it ran |
| `.ai/board/backlog.md` | The four rows those tickets should have produced |
