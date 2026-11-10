---
doc_version: 3
last_updated: 2026-08-10
governed_by: [RULE-01, RULE-09]
---

# ADR-000 — Template

> **Inherited from the origin project this kit was extracted from.** This template was decided
> there, against a real loop, and is carried into this template unchanged in substance because the
> decision is about the process rather than about that product. It is in force here as written. If
> this project reaches a different conclusion, supersede it with a new ADR rather than editing this
> one — the record of what was decided first is what makes the second decision legible.

Copy this file to `ADR-nnn-<kebab-title>.md`. Numbers are sequential and never reused.

**An agent can write one, and should not do so lightly.** `guard-registry.mjs` is
unwired (ADR-004), so the write no longer fails. What still holds is RULE-01 — an ADR and human
approval — and RULE-09, which names ADRs among the permanently human actions. Enforcement is
`.github/CODEOWNERS` review on the pull request rather than a blocked write.

The distinction that matters: an agent may **record** a decision a human made, naming who made it and
when. An agent may not **make** one and write it up as though a human had. The `## Status` line is the
test — if it says `ACCEPTED by the operator`, that has to have happened, in words, somewhere a person
can be shown.

An agent that needs a registry change sets `gate: BLOCKED` on its own artifact, states the requested
decision in `blocking_reason`, and stops. A human writes the ADR. This is the intended flow, not a
limitation to be routed around: the value of an ADR is that a person decided, and an ADR written by
the agent that wanted the exception is not evidence of a decision.

## Status

`PROPOSED` | `ACCEPTED by the operator` | `ACCEPTED by <agent>` | `SUPERSEDED by ADR-nnn` | `REJECTED`

State the date the status last changed.

**The two forms of `ACCEPTED` are not interchangeable** — ADR-008.

- `ACCEPTED by the operator` is a claim about a person. It has to have happened, in words somewhere a
  person can be shown. Writing it otherwise is forging a signature, and that has not changed.
- `ACCEPTED by <agent>` is an agent's own decision, reviewed at merge under CODEOWNERS like any other
  registry change.

**An agent asks rather than decides when the ADR would supersede or reverse an accepted one.** That
is the difference between deciding inside an existing envelope and changing the envelope.

## Context

What is true right now that makes a decision necessary. Facts, not preferences. If the decision was
triggered by a specific ticket, name it. If it was triggered by a rule or invariant being unworkable
as written, cite the ID.

## Decision

One paragraph, active voice, present tense. If the decision changes a rule, state the rule ID and the
old and new text. If it changes an invariant, state the ID.

## Rationale

Why this and not the alternatives. Name at least one alternative and say what it costs.

## Consequences

What becomes true, including what becomes harder. An ADR that lists only benefits has not been
thought through.

## Revert condition

**Required. An ADR without one is a preference, not a decision.**

State the observable signal that means this decision was wrong, and what happens when it is observed.
Prefer a number from `.ai/board/metrics.md` over a judgement call.

## Affected documents

Every file whose `governed_by` or content changes as a result, with the `doc_version` each must move
to. Check D9 fails until this list is worked through.
