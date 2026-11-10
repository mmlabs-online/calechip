---
doc_version: 3
last_updated: 2026-09-01
governed_by: [RULE-05, RULE-07, RULE-08, RULE-12, RULE-13, RULE-16]
---

# Template: test report

> **RETIRED — ADR-022.** `06-test-report.md` is no longer produced: the QA stage was removed on
> 2026-09-01. Kept, not deleted, so TEA-01's copy stays readable against the template it was
> written from. Do not write a new artifact from it.


Written by `qa` as `06-test-report.md`. Copy everything below the line.

**Isolated dispatch** (RULE-13). `chat_before_verdict` must be `none`; this is an attestation
(RULE-12), and if it cannot truthfully be written the stage re-runs in a clean session.

---

```yaml
---
ticket: <ID>
stage: QA
agent: qa
produced_at: <ISO8601>
inputs_read: [ .ai/board/tickets/<ID>/01-plan.md, .ai/board/tickets/<ID>/05-test-plan.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---
```

## Results

| Suite | Command | Exit code | Passed | Failed | Skipped |
|---|---|---|---|---|---|
| unit | the command named in `.ai/standards/testing-standards.md` |  |  |  |  |
| e2e | the command named in `.ai/standards/testing-standards.md` |  |  |  |  |

A non-zero exit is a gate failure regardless of how the individual counts read. A skipped test counts
as absent coverage, not as a pass.

## AC coverage

| AC | Test name | Result |
|---|---|---|

Every AC from the story appears here. The Definition of Done requires the mapping to be complete;
five ACs and four rows is not done, and the missing one is the one that will break.

## Failures

For each failure: what was expected, what happened, and which routing row it falls under.

| # | Test | Expected | Actual | Routes to | Increments rework_count |
|---|---|---|---|---|---|

Routing is from the failure routing table in `.ai/01-operating-model.md`. Behaviour that is wrong
routes to `developer` and increments. An AC that turned out to be ambiguous or untestable routes to
`ba` and does not increment, per RULE-08 — a Developer must not spend its RULE-06 budget on a defect
it did not cause.

## Invariant observations

Per ID in `invariants_touched`: held, or violated with evidence.

| Invariant | Held | Evidence |
|---|---|---|

**A violation is not a test failure to be reworked.** Per RULE-07 it escalates on first occurrence:
set `gate: FAIL`, `next_state: ESCALATED`, and name the invariant ID in `blocking_reason`. Do not
propose a fix; the question of whether the code or the model is wrong is not QA's to answer.

## Selector gaps encountered

Anything needed that design section 6 did not provide, and what was done about it. If a test was
written against a selector not in section 6, say so — that is a RULE-05 breach and the report is more
useful for admitting it than for hiding it.

## Verdict

`PASS`, `FAIL` with routing, or `BLOCKED` with a reason.
