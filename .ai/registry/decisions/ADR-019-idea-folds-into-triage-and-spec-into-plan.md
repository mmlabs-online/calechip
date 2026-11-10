---
doc_version: 3
last_updated: 2026-09-01
governed_by: [RULE-01, RULE-09]
---

# ADR-019 — IDEA folds into TRIAGE, and SPEC merges with DESIGN into PLAN

## Status

`ACCEPTED by the operator` — 2026-09-01.

Recorded, not authored. The operator asked what a small app that does not need high precision should
cut, was shown the measured cost of each option and what each one was carrying, and instructed:
*"đã tiến hành ship TEA-03 giờ bắt đầu tiến hành cắt bớt stage trong workflow."* The two stage cuts
below are the ones that were put in front of them by name.

## Context

Two tickets' worth of measurement, from `.ai/board/metrics.md` and the ticket folders:

| | Artifacts | Code shipped |
|---|---|---|
| TEA-01 | 2,350 lines across seven files | — |
| TEA-02 | 953 lines across four files | 1,765 lines |

`02-design.md` alone was 977 and 472 lines. `04-review.md`, which runs nine checks each citing
`file:line`, was 307 and 66. **The stages are cheap and the artifacts are expensive**, so cutting a
stage saves little unless the artifact goes with it.

Two places in the lifecycle carried a stage boundary that no longer bought what it cost:

- **IDEA and TRIAGE.** ADR-010 already moved ticket-shell creation into `/triage`, so IDEA's only
  remaining output was a file that the very next command read. Two commands, two dispatches, one
  document.
- **SPEC and DESIGN.** Two agents, two artifacts, two gates, for a `size: S` ticket touching six
  files or fewer. `size_estimate` is produced at SPEC, so the loop cannot know a ticket is small
  before SPEC has run — which rules out a conditional fast path and makes the merge all-or-nothing.

## Decision

**The state enum drops from twelve values to ten.**

```
TRIAGE -> [PROMOTE writes the feature row and the ticket shell] -> BACKLOG
  -> PLAN -> [DoR] -> READY -> IN_PROGRESS -> REVIEW -> QA -> DONE
```

1. **IDEA is removed. `/triage` absorbed it** and now accepts either a raw request or an existing
   idea filename, writing the idea file before ruling on it. `/idea` is retired.
2. **SPEC and DESIGN are removed, replaced by PLAN.** One artifact, `01-plan.md`, nine sections:
   sections 1 and 2 are what `01-story.md` carried, 3 through 9 are what `02-design.md` carried.
   `/spec` and `/design` are retired and `/plan` replaces both.
3. **`tech-lead-design` owns PLAN. `ba` is retired from the loop.** This is forced rather than
   chosen: `guard-read-scope.mjs` lists `ba` in `RESTRICTED` and blocks it from `src/`, so `ba`
   cannot write a design. The agent that keeps the stage has to be the one that can read the code.
4. **The `spec` and `design` gates in `ticket.yaml` merge into one `plan` gate.** Three gates now,
   not four: `plan`, `review`, `qa`.
5. **`/plan` inherits branch creation from `/spec`.** It is the only command that may bring a `feat/`
   branch into existence.
6. **RULE-05 goes to version 2**, its wording only: *Design section 6* becomes *Plan section 8*. The
   substance is untouched — QA still never reads the implementation source, and one section is still
   the only channel through which selectors reach it.

Retired commands, agents and templates are **kept with a retirement banner, never deleted.** A ticket
shipped before 2026-09-01 was written against them and has to stay readable against them.

## Rationale

**The alternative that was actually attractive: merge only for `size: S`.** Rejected on a fact rather
than a preference — `size_estimate` is DoR item 5, produced at SPEC by the agent the merge would
remove. The loop cannot branch on a size it has not computed yet, so a conditional merge would first
have to move size estimation to TRIAGE, where it would be a guess made before anyone had read the
feature. One cut became two, and the second one was worse than the thing it enabled.

**Rejected: cutting REVIEW instead.** It is the cheapest stage in the model by measured output and it
is now the only gate between an agent's code and `main`, QA being waived under ADR-017. The saving
would have been 66 lines and the loss would have been every check.

**Rejected: renumbering the whole artifact set** so `01-plan.md` is followed by `02-impl-log.md`.
`03-impl-log.md` and `04-review.md` keep their numbers and `02-` is left unused. A gap that says
something used to be here is cheaper to read than two numbering schemes separated by a date.

## Consequences

- **The separation between who writes acceptance criteria and who designs against them is gone.**
  This is the real cost and it is not recovered anywhere. One agent now writes an AC and then the
  design that has to satisfy it, so an AC quietly reshaped to fit what is convenient to build has
  nothing standing in its way. What replaces it is an ordering instruction — write sections 1 and 2
  in full, then read the source tree — and a Changelog entry required for any later amendment.
  **That is a habit, not a control. Nothing enforces it and no check can see it.**
- **`ba` no longer runs.** Its never-invent rules moved into `/plan` verbatim, because they were
  never about the role: no invented feature ID, no invented AC, no story written from a tracker
  description (RULE-17).
- **Two chat edges disappear** — `developer->ba` and `qa->ba`. They are removed from the ticket
  template rather than zeroed: an edge nobody can walk is a row that invites someone to try.
- **The failure routing table loses its only non-`tech-lead-design` non-`developer` destination.**
  R6 and an ambiguous AC used to route to `ba`; both now route to `tech-lead-design`, which is also
  the author. Per RULE-08 they still do not increment `rework_count`, and that now protects an agent
  from its own upstream defect rather than from someone else's.
- **Three documents bump `doc_version` for RULE-05's version change alone** — `test-plan.md`,
  `test-report.md`, `testing-standards.md` — because D9 fails when a doc cites a rule at a version
  above its own. The cascade is mechanical and it is the reason a one-word rule edit is never one
  file.
- **A ticket folder now holds five artifacts at most, three while QA is waived.**
- **`01-plan.md` will be long.** It is two documents in one and the nine sections are all required.
  The saving is one dispatch, one branch check, one gate and one session — not prose.

## Revert condition

**Two acceptance criteria in shipped tickets found to have been written to fit the implementation
rather than the problem.** Two, not one: a single instance is a mistake, and the pattern is what this
merge risks. Read from `01-plan.md` Changelog entries amending section 2 after section 4 was written,
and from any AC whose wording names an implementation detail.

**On revert:** restore SPEC as a stage owned by `ba`, split `01-plan.md` at the section 2/3 boundary,
and return RULE-05 to version 1. The retired files are kept precisely so this is a restoration rather
than a reconstruction.

A second signal, softer: **if `/plan` starts stopping with `gate: BLOCKED` on questions the BA used
to answer**, the merge moved work rather than removing it, and the saving was never real.

## Affected documents

| File | Moves to |
|---|---|
| `.ai/01-operating-model.md` | `doc_version` 4 |
| `.ai/registry/rules.md` | RULE-05 to version 2 |
| `.ai/standards/testing-standards.md` | `doc_version` 2 |
| `.ai/templates/test-plan.md` | `doc_version` 2 |
| `.ai/templates/test-report.md` | `doc_version` 2 |
| `.ai/templates/plan.md` | new |
| `.ai/templates/ticket.yaml`, `story.md`, `tech-design.md`, `impl-log.md`, `review-report.md`, `questions.md`, `idea.md` | amended or retired |
| `.claude/commands/plan.md` | new; `spec.md`, `design.md`, `idea.md` retired |
| `.claude/commands/triage.md`, `implement.md`, `review.md`, `qa.md`, `ship.md`, `next-ticket.md`, `status.md`, `sprint-status.md` | amended |
| `.claude/agents/ba.md` | retired; `tech-lead-design.md`, `developer.md`, `qa.md`, `tech-lead-review.md`, `product.md` amended |
| `.ai/standards/session-model.md`, `git-conventions.md`, `CLAUDE.md` | amended |
