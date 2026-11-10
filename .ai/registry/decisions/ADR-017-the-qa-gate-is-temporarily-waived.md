---
doc_version: 3
last_updated: 2026-09-01
governed_by: [RULE-01, RULE-09]
---

# ADR-017 — The QA stage is temporarily waived

## Status

`SUPERSEDED by ADR-021` — 2026-09-01. Accepted by the operator earlier the same day; superseded that
afternoon when all three of its revert conditions had fired. It stood for roughly four hours and three
tickets — TEA-02, TEA-03 and TEA-04 — every one of which shipped untested and stays that way.

The original acceptance, kept because the record is the point:

Recorded, not authored. The operator's instruction, verbatim: *"tôi muốn tạm thời flow bỏ qua state
qa testing"*. The word that governs this ADR is **tạm thời** — the decision is explicitly temporary,
so it is written as a switch with a revert condition rather than as a change to the model's shape.

## Context

The loop's lifecycle runs `REVIEW -> QA -> DONE`. The Definition of Done requires four gates
`passed: true`, and two of its six items — *every AC maps to a named test*, *unit and end-to-end
tests exit 0* — are produced only at QA.

**This has already been bypassed once, informally.** TEA-01 shipped with its QA gate marked passed by
an operator waiver recorded in `06-test-report.md` and repeated in `backlog.md`: ten of its twelve
acceptance criteria have no test, and the permission-model test named in its design was never
written, because no database was provisioned. Under ADR-005 the row-level policies *are* the authorization model, so what
went unverified there was the authorization model.

TEA-02 is at REVIEW as this is written, and would reach the same gate against the same missing
infrastructure.

So the choice is not between running QA and skipping it. It is between skipping it once per ticket by
improvisation, each time in a different place and a different form, and skipping it by one declared
switch that can be read, counted and turned off.

## Decision

**While this ADR's `Status` is `ACCEPTED`, the loop runs `REVIEW -> DONE` and the QA stage is not
entered.**

- `QA` stays in the state enum and keeps its row in the stage ownership table. It is an unvisited
  state, not a deleted one — reversal is deleting one section, not reconstructing a stage.
- On PASS, `04-review.md` writes `next_state: DONE` instead of `next_state: QA`.
- `/ship` requires three gates passed — `spec`, `design`, `review` — plus `gates.qa` carrying
  `waived: true` with `by: ADR-017` and a date. A `qa` gate that is neither passed nor waived still
  stops the ship.
- **Definition of Done items 3 and 4 are suspended for the duration**, and `/ship` records that in
  the pull request body rather than confirming them. Items 1, 2, 5 and 6 are unaffected.
- `/qa` is not deleted and still runs correctly if the operator invokes it by hand. What the waiver
  removes is the automatic entry into the stage and the gate's power to block a ship.

**No ticket shipped under this waiver may be described as tested.** `backlog.md` names the waiver on
every archive row that used it, in the form TEA-01 already established.

## Rationale

The alternative was to remove `QA` from the enum, the ownership table, the routing table, the dispatch
loop and the artifact map. That is the honest shape for a permanent decision and the wrong shape for a
temporary one: it costs a dozen coordinated edits, check D10 fails partway through, and the reversal
is a reconstruction from memory rather than a deletion. *Tạm thời* rules it out.

A second alternative — leave the model alone and keep waiving per ticket, as TEA-01 did — was
rejected because it is what produced this ADR. An exception made in the artifact of the ticket that
wanted it is invisible to anyone counting how often it happens, and *how often it happens* is the only
number that can end it.

## Consequences

- **Every ticket shipping from today onward is untested.** Not lightly tested — untested, with no
  automated evidence that any acceptance criterion holds. This is the cost and it is accepted
  knowingly.
- **What is unverified is disproportionately the authorization model.** ADR-005 puts authorization in
  row-level policies, and `.ai/standards/rbac-and-security.md` records that a too-permissive policy
  fails open and silently. A missing test there produces no error and no log.
- **The debt is not visible in the diff.** A ticket that skipped QA looks identical to one that passed
  it except for one field, which is why `backlog.md` must name it per ticket.
- RULE-05, RULE-13 and the `qa` chat budgets are dormant, not repealed. They govern the stage again
  the moment it is re-entered.
- `05-test-plan.md` and `06-test-report.md` are not produced, so the ticket folder shipped under this
  waiver has four artifacts, not six.

## Revert condition

**Whichever comes first:**

1. **The first defect found in a shipped ticket that a QA test would have caught.** One is enough.
   Observed in a `BUG-nnn` ticket; the revert is immediate and does not wait for a count.
2. **Three tickets reach DONE under this waiver.** Counted from `.ai/board/metrics.md` archive rows.
   Three is the point at which the untested surface is larger than any single QA pass can retire, and
   the waiver stops being temporary in anything but name.
3. **A database is provisioned and the four commands in `.ai/standards/testing-standards.md` run.**
   The stated cause of TEA-01's waiver was that they cannot; when that stops being true the reason for
   this one is gone.

**On revert:** set this ADR's `Status` to `SUPERSEDED`, delete *The QA stage is waived* from
`.ai/01-operating-model.md`, and open a ticket to retire the untested surface accumulated under it.
The reverting change owes a list of every ticket that shipped waived.

## Affected documents

| File | Moves to |
|---|---|
| `.ai/01-operating-model.md` | `doc_version` 3 |
| `.claude/commands/ship.md` | — (no front-matter version) |
| `.claude/commands/review.md` | — |
| `.claude/commands/qa.md` | — |
| `.ai/templates/ticket.yaml` | — |

`.ai/registry/rules.md` is **not** amended. No rule is changed by this ADR — RULE-05 and RULE-13 still
say what they said, and a stage that is not entered does not need its rules rewritten.
