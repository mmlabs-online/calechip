---
doc_version: 2
last_updated: 2026-09-20
governed_by: [RULE-01, RULE-07, RULE-17, RULE-18]
---

# ADR-037 — TRIAGE is runner-driven, and the triage verdict becomes a field

## Status

`PROPOSED` — 2026-09-20, by the steward, at the operator's instruction to give the runner one entry
point for ideas and existing tickets.

**Not `ACCEPTED`.** It changes a template in the permanent plane and adds a command, both of which
RULE-01 places behind the operator's approval at the pull request. It extends ADR-036 and shares its
status; neither is in force until merged.

## Context

ADR-036 gave the loop a runner that carries an **existing ticket** from BACKLOG to a reviewed,
gated, committed state. It could not start from an idea, and the reason was not the runner.

**The triage verdict was not on disk in any form a program could read.**

- `gate:` is `PASS` on **every** file in `.ai/board/ideas/`, including the one whose verdict was
  REJECT. A runner trusting `gate` would have promoted a rejected idea.
- `next_state:` is `TRIAGE` on some promoted ideas and `BACKLOG` on others. Both were promoted.
- The verdict itself lives in a free-form Markdown heading. Eight shapes are on disk, among them
  `## Triage verdict: PROMOTE`, `# Verdict — PROMOTE, as CAL-10`, and
  `# Re-triage verdict — PROMOTE, as \`UIE-07\` — **THIS IS THE LIVE VERDICT**`. Two files carry two
  verdicts, and only one of them marks which is live — in bold prose.
- The issued ticket id is in the heading text, in a `features.md` `Notes` cell, and in the name of a
  directory. Nowhere as a value.

So the question "what did triage decide, and what ticket did it create" had no answer that did not
involve reading English. **Routing on model output is the one thing the whole design is built to
avoid**, and this was the last place it would have been unavoidable.

**Second, an operator's request arrives as a solution, and the TRIAGE gate wants a problem.** The
gate reads: *an idea file exists stating a problem and not a solution*. Read strictly by an agent
with nobody to check with, that turns "add a column for last sign-in" into a REJECT — which teaches
the operator to write worse requests rather than better ones, and loses the request entirely.

**Third, an unattended TRIAGE cannot ask a follow-up.** Every question it would have asked in chat
becomes either an `## Open questions` entry or, worse, an assumption in the next artifact.
`.ai/templates/plan.md` states the stakes in one line: *"A question here blocks; an assumption here
ships."*

## Decision

### The verdict becomes three fields, and the runner reads them from disk

`.ai/templates/idea.md` gains `verdict`, `verdict_reason`, `ticket_id` and `operator_request` in its
front-matter, and `/triage` fills them. The heading stays, for a person.

`scripts/lib/entry.mjs` reads the verdict from front-matter and **never** from a reply. On a
re-triage the fields are overwritten and both headings stay in the body: the front-matter is the live
answer, the body is the history.

### One entry point, resolved in a fixed order

`node scripts/run-loop.mjs auto [<input>]` resolves, in deterministic code:

1. an explicit flag — `--idea`, `--idea-file`, `--ticket`, `--tracker` — wins and skips detection
2. nothing at all → ask the orchestrator what is next
3. an existing path under `.ai/board/ideas/` → TRIAGE, or enter at the recorded ticket if promoted
4. a ticket id **whose `ticket.yaml` exists** → enter at its recorded state
5. a ticket id whose `ticket.yaml` **does not** exist → **error**
6. a tracker id or URL → refused, see below
7. anything else → free text: INTAKE, then TRIAGE

**Step 5 is the one that matters.** A string shaped like a ticket id that names no ticket is an
error and never falls through to "treat it as an idea". Falling through would turn one mistyped
character into an idea file, a feature row and a ticket — three board and registry writes from a
typo, discovered at the pull request.

### Intake asks before anything is written

`product` is run headless with a JSON schema and proposes at most seven questions whose answers would
change **behaviour, permissions, an invariant, scope or size**. Layout questions are excluded: the
carve-out added 2026-09-04 makes the visual arrangement of a screen `tech-lead-design`'s to
originate, so a layout question spends one of a very small number of questions on the one thing
nobody is blocked by. Answers are read from stdin and stored **verbatim**.

This is the only interactive moment of a run, and it happens before any file exists.

### The operator's words are preserved, and a solution-shaped request is never rejected for its shape

`operator_request` holds the request exactly as it arrived. The problem statement is derived
separately and **marked as the agent's derivation** — a derived problem that reads as reported fact
is the quiet start of a ticket nobody asked for.

`/triage` is instructed, in terms, never to REJECT for shape. REJECT means *not worth doing, or
already covered*; the shape of a sentence is evidence of neither.

### Tracker entry is refused, and the refusal is the finding

Two independent blockers, both on disk:

- `.ai/registry/tracker.yaml` ships with `allowed_list_ids: []`, and RULE-18 reads that as **block
  every call** rather than as no restriction. The file says so in its own header.
- A pulled ticket has no path to `feature_ids`. `/pull-tickets` writes only
  `tracker.raw_description`; RULE-17 makes that third-party data rather than a specification; and
  ADR-007 puts ID issuance at TRIAGE. Without Definition of Ready item 1 the ticket cannot reach
  READY.

The runner names both and offers the route that does work — putting the description through triage as
a quoted idea. **Issuing a feature ID to close the gap is exactly the invention the charter forbids.**

### Two checks between PLAN and READY

An `## OPEN QUESTIONS` entry touching behaviour, permissions or an invariant stops the run; a
layout-only one never does; **an entry that cannot be classified is treated as blocking.** A size of
`L` stops for the split and `XL` stops for escalation, per the operating model's sizing table.

### Every run writes a report

`.runner/<run-id>/REPORT.md`, on every path including an early stop, written from a `process.on
("exit")` hook rather than from eleven separate exit points. It records how the input was resolved,
the intake questions and answers verbatim, the verdict, the ticket, the PR, the cost — and two lists
that exist nowhere else:

- **the registry rows this run wrote**, which await approval at the pull request (RULE-01)
- **the paths left dirty that nothing will commit** — `/triage` writes `.ai/board/ideas/**` and any
  ADR it drafts, and `/ship`'s ship set contains neither. MD-031 records a shipped ticket citing an
  ADR and an idea file that exist on no ref. The runner cannot fix that, because it never commits;
  it names them every run instead.

### `/auto` ships, with its limitation on its face

`.claude/commands/auto.md` starts the runner detached and returns three paths. A detached process has
no stdin, so **it passes `--no-ask` and the intake questions are never asked** — which the command
file says at the top, before the instructions, because the person choosing between `/auto` and the
terminal is choosing exactly that.

It also notes that a detached process is not subject to the session's own checks on spawning agents.
One such check refused a direct spawn while ADR-036 was being built. That is a reason to prefer the
terminal when those checks are wanted, and it belongs where someone will read it.

## Consequences

**A request in words can become an open pull request with one command**, stopping at the points the
rules reserve for a person: REJECT, NEEDS-ADR, a blocking open question, a split, an escalation, an
invariant violation, and the push.

**Two things that were only ever prose are now values**: the triage verdict and the operator's
original words. The second matters more than it looks — `operator_request` is the only line in an
idea file that is not the agent's, and it is what a reviewer compares the problem statement against.

**Historic idea files have none of the new fields**, so the runner refuses to route on them and says
why. Nothing rewrites them; a re-triage adds the fields.

**The layout/blocking classifier is a word list, and word lists are wrong sometimes.** It errs
towards stopping: an entry it cannot classify blocks the run. The cost of that choice is a stop the
operator did not need; the cost of the other choice is a permission decided by a `tech-lead-design`
assumption that no one reviewed.

**Tracker entry remains unbuilt** and will stay that way until a tracker is configured and a pulled
ticket has some path to a feature ID. Both are decisions, not code.

## Alternatives rejected

**Parse the verdict out of the reply.** It is the only option that needs no template change, and it
makes the most important branch in the system depend on a sentence a model could phrase differently
on a re-read. The eight heading shapes already on disk are the evidence.

**Make TRIAGE reject solution-shaped requests, per the gate read strictly.** It satisfies the gate
and loses the request. It also punishes the operator for writing the way people write.

**Ask the intake questions per stage, as they arise.** It spreads interruption across the run and
removes the property that makes this design worth having: after intake, nobody has to be at the
keyboard.

**Let the runner issue a feature ID for a tracker-pulled ticket.** One line of code and the end of
the no-invention rule.

## Changed by this ADR

| File | Change |
|---|---|
| `.ai/templates/idea.md` | `verdict`, `verdict_reason`, `ticket_id`, `operator_request`; a section on solution-shaped requests |
| `.claude/commands/triage.md` | Fill the new fields; the runner-dispatched path; never REJECT on shape; the supplied clock |
| `.ai/01-operating-model.md` | The TRIAGE row names the machine-readable verdict |
| `CLAUDE.md` | The command list: `/advance` and `/auto` added, `/qa` removed, `/solo` named |
| `scripts/lib/entry.mjs`, `scripts/lib/prompts.mjs` | **New** |
| `scripts/run-loop.mjs` | Resolver, intake, TRIAGE, the two post-PLAN checks, the report |
| `scripts/tests/entry.test.mjs` | **New** |
| `.claude/commands/auto.md` | **New** |
