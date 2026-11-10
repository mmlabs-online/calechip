---
doc_version: 3
last_updated: 2026-09-01
governed_by: [RULE-05, RULE-13, RULE-16]
---

# Template: test plan

> **RETIRED — ADR-022.** `05-test-plan.md` is no longer produced: the QA stage was removed on
> 2026-09-01. Kept, not deleted, so TEA-01's copy stays readable against the template it was
> written from. Do not write a new artifact from it.


Written by `qa` as `05-test-plan.md`. Copy everything below the line.

**You receive the story and section 6 of the design. You do not read the implementation source**
(RULE-05). A selector that is not in section 6 does not exist; if you need one, ask
`tech-lead-design` — that edge is allowed and points backwards.

**Isolated dispatch** (RULE-13). No message channel to `developer` or `tech-lead-review`.

---

```yaml
---
ticket: <ID>
stage: QA
agent: qa
produced_at: <ISO8601>
inputs_read: [ .ai/board/tickets/<ID>/01-plan.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: QA
---
```

## Coverage map

Every AC from the story maps to at least one named test. The test name contains the AC ID.

| AC | Test name | Level | Selectors used |
|---|---|---|---|
| AC-1 |  | unit / component / e2e | from design section 6 |

An AC with no row is a gate failure. An AC that cannot be given a row because it is unobservable from
outside the system is not a QA problem — it routes to `tech-lead-design`, and per RULE-08 it does not increment the
Developer's rework count.

## Refusal cases

The tests that assert something is *not* possible: the second write refused, the conflicting state
rejected, the role that must not see a control. Cite the invariant ID each one probes.

A suite with no refusal tests passes when the check is deleted.

## Invariant probes

For each ID in `invariants_touched`, the test that would fail if it stopped holding. If there is no
such test, say so explicitly rather than leaving the row out.

| Invariant | Probe test | If absent, why |
|---|---|---|

## Fixtures

Which fixtures from the shared fixture module named in `.ai/standards/testing-standards.md` this plan
uses. Do not invent entities inline — a fixture that exists only in one test file drifts from the
seed and produces failures that reproduce in CI and not locally.

## Out of scope for this plan

What is deliberately not tested here and why. Performance, accessibility beyond the standards
baseline, and anything behind an unapproved schema belong here rather than being silently skipped.

## Selector gaps

Controls an AC needs that design section 6 does not list. Each one is a blocker, not a workaround.
Raise with `tech-lead-design`, record it in `consulted`, and expect section 6 to be amended
(RULE-14).
