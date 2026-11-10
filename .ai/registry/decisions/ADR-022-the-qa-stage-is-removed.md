---
doc_version: 3
last_updated: 2026-09-01
governed_by: [RULE-01, RULE-09]
---

# ADR-022 — The QA stage is removed

## Status

`ACCEPTED by the operator` — 2026-09-01.

Recorded, not authored. Asked whether they wanted the stage deferred, waived again for one ticket, or
removed, and given the cost of each; the operator answered *"tôi muốn bỏ hẳn QA"* — remove it
outright. The steward disagreed once, in a sentence, and complied in full.

**This is a removal, not a waiver.** ADR-017 was written as a switch precisely because the operator
said *tạm thời*; nothing about this one is temporary, so it is executed as the dozen coordinated
edits that a permanent decision earns and a temporary one does not.

## Context

The QA stage ran `05-test-plan.md`, `06-test-report.md` and the test tree, in an isolated session,
against the plan's testability contract and nothing else.

Its history in this repository is four days long and worth stating plainly, because the last day of it
is the argument against this ADR:

- TEA-01 shipped with its QA gate passed by an ad-hoc operator waiver. Ten of twelve criteria had no
  test.
- ADR-017 waived the stage. TEA-02, TEA-03 and TEA-04 shipped under it, untested.
- ADR-021 reverted the waiver when all three of its revert conditions fired.
- **QA then ran exactly once, on TEA-05, and returned `gate: FAIL`.** Its `blocking_reason`:
  *"playwright test exits 1 (13 failures): e2e suite is unpinned (BUG-001) and runs against live
  Supabase project where new test accounts are unseeded."*

So the stage being removed here found a real defect on its only unimpeded run, and that defect —
BUG-001 — is being fixed as this is written. **That is the strongest fact against this decision and it
belongs in the ADR rather than in a chat message that scrolls away.** The operator was told it before
confirming.

## Decision

**The QA stage is removed from the model.** The lifecycle is:

```
TRIAGE -> BACKLOG -> PLAN -> [DoR] -> READY -> IN_PROGRESS -> REVIEW -> DONE
```

1. **The state enum drops to nine values.** `QA` is gone from the enum, from the stage ownership
   table, from the failure routing table, from `ARTIFACTS_FOR` and from the WIP count.
2. **`ticket.yaml` has two gates: `plan` and `review`.** The `qa` gate is gone. Tickets planned before
   2026-09-01 keep the key they were created with, and three of them carry `waived: true`.
3. **RULE-05 is retired**, at version 3. It read *QA never reads the implementation source; plan
   section 8 is the only channel through which selectors reach QA.* With no QA the rule has no
   subject. **Its number is retired with it and is never reused** — seventeen of eighteen rules are in
   force.
4. **RULE-13 goes to version 2**, wording only: *REVIEW runs in isolated dispatch with files only.*
   The isolation requirement is unchanged for the stage that still exists.
5. **Plan section 8, the testability contract, is removed.** The plan has eight sections; *Rejected
   alternatives* moves into 8. QA was its only reader.
6. **Review check R7 is removed** and R8, R9 renumber to R7, R8. The reviewer runs R1 through R8.
7. **Definition of Done drops to five items.** The one removed is *every AC maps to a named test*,
   which had no producer once QA did. **Item 3 — typecheck, lint, unit and end-to-end exit 0 —
   survives and is now `/ship`'s alone.**
8. **`/qa`, the `qa` agent, and the test-plan and test-report templates are retired**, with banners,
   not deleted. Four tickets were shipped against them and have to stay readable.
9. **`guard-read-scope.mjs` stays wired and stays tested**, and is now inert: both roles it restricted
   are retired, `ba` by ADR-019 and `qa` by this ADR. Deleting a guard is the one direction that fails
   silently.

## Rationale

The operator's reason is throughput, and it is theirs to weigh. What follows is why the removal takes
this shape rather than a different one.

**Rejected: waive again, per ticket.** That is what ADR-017 was, and MD-016 records what happened to
it — a temporary switch whose expiry gets renegotiated at the moment it becomes inconvenient. If the
answer is that QA does not run here, the model should say so once rather than grant an exception every
Tuesday.

**Rejected: keep the stage and make it advisory** — run it, record the verdict, never block. An
advisory gate is read as noise within two tickets, and it would have left TEA-05's `FAIL` sitting in
the record with nothing acting on it. A gate that cannot stop anything is worse than an absent one,
because it costs the same and buys nothing.

**Rejected: removing item 3 from the Definition of Done along with the stage.** It was tempting for
consistency — with nobody writing tests, requiring the suites to pass is requiring somebody else's
tests to keep passing. It stays because the suites that exist are the only remaining evidence that
anything works, and `/ship` is the last place anyone looks at them.

**Rejected: deleting the retired files.** Four tickets were produced against `/qa`, the `qa` agent and
the two templates. A repository where a shipped artifact cannot be read against the template that
produced it has lost the ability to audit its own history.

## Consequences

- **Nobody writes tests.** Not "fewer tests" — no stage produces one, no gate requires one, and no
  role has it in its definition. The Developer's agent file was amended to say so explicitly, because
  the previous wording handed the acceptance suite to QA.
- **The three tickets that shipped under ADR-017 stay untested permanently.** ADR-021 owed a ticket to
  retire that surface. **This ADR does not discharge it and no stage now exists that could.** Under
  ADR-005 all three are row-level policy work, which is the whole authorization model.
- **`/ship` item 3 is the last check on the test suites, and it is already being bypassed by hand.**
  `/ship` step 1 carries an operator annotation reading *"Tạm ignore bước này"*. With QA gone, that
  annotation is the difference between the suites being checked and not being checked at all.
- **The defect QA found on its only run is still open.** BUG-001 is being fixed elsewhere; nothing in
  the model would have surfaced it after this ADR.
- **R7's disappearance means no check verifies that a selector exists in the markup.** `data-testid`
  remains the attribute — the existing tests address it — but nothing enumerates selectors and nothing
  reports a missing one.
- The loop is now three stages: PLAN, IN_PROGRESS, REVIEW. **REVIEW is the only gate between an
  agent's code and `main`.**

## Revert condition

**Two defects reaching a merged pull request that a test would have caught.** Two rather than one,
because the first is a mistake and the second is a pattern — and because QA has already demonstrated
it catches exactly this class, so the counterfactual is not speculative. Read from `BUG-nnn` tickets
whose cause is a behaviour no automated check exercised.

**On revert:** restore `QA` to the enum and the stage ownership table, un-retire `/qa`, the `qa`
agent and the two templates, restore RULE-05 to version 2 and plan section 8, and put R7 back. The
retired files are kept so this is a restoration rather than a reconstruction.

A second signal, and it measures something different: **`/ship` item 3 bypassed on two consecutive
tickets.** That would mean the four commands are not being run anywhere at all, which is further than
this decision went — the operator removed a stage, not the tests. It is a signal to restore a check,
not necessarily this stage.

## Affected documents

| File | Change |
|---|---|
| `.ai/registry/rules.md` | RULE-05 retired at v3; RULE-13 to v2; three enforcement-map rows |
| `.ai/01-operating-model.md` | `doc_version` 6 — lifecycle, enum, ownership, plan sections, R-checks, routing, dispatch loop, `ARTIFACTS_FOR`, Definition of Done, session lifecycle |
| `.ai/templates/ticket.yaml` | enum, gates, `chat_budget` |
| `.ai/templates/plan.md` | section 8 removed, nine sections to eight, `governed_by` drops RULE-05 |
| `.ai/templates/review-report.md` | R7 row removed, R8 and R9 renumbered, section pointers corrected |
| `.ai/templates/test-plan.md`, `.ai/templates/test-report.md` | retired with banners |
| `.claude/commands/qa.md`, `.claude/agents/qa.md` | retired with banners |
| `.claude/commands/ship.md`, `review.md`, `sprint-status.md` | gates, R-check range, WIP range |
| `.claude/agents/developer.md`, `tech-lead-design.md` | test ownership, testability contract |
| `.ai/standards/session-model.md`, `testing-standards.md`, `ui-design-system.md` | lifecycle line, selector contract, `doc_version` |
| `.claude/hooks/guard-read-scope.mjs` | header only — kept wired, kept tested, now inert |
| `CLAUDE.md` | 17 of 18 rules in force |
