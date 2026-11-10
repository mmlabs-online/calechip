---
description: RETIRED by ADR-022 — the QA stage was removed. Do not run.
argument-hint: <TICKET-ID>
---

> **RETIRED — ADR-022.** The QA stage no longer exists and no command routes here. Everything
> below describes a stage that was removed on 2026-09-01; it is kept, not deleted, so the four
> tickets shipped before then stay readable against the loop that produced them.
>
> **Do not run this.**

Run in a **fresh session that is discarded after the verdict** — files only, no message channel
(RULE-13). You are `qa`; nothing is dispatched. A re-run after rework opens another new session, for
the same reason the reviewer does (`.ai/standards/session-model.md`).

## Step 0 — confirm the branch before writing anything

**Mode: stop.** Run the four reads and follow the table in `.ai/standards/git-conventions.md`,
*The branch check every ticket command runs*. This command may **not** create `feat/$ARGUMENTS`.

```
pwd
git branch --show-current
git fetch origin --quiet
git status --porcelain
```

- Already on `feat/$ARGUMENTS` — proceed.
- Elsewhere or detached, tree clean, the branch exists on `refs/heads` or `refs/remotes/origin` —
  `git switch feat/$ARGUMENTS` (add `-c feat/$ARGUMENTS origin/feat/$ARGUMENTS` when it is
  remote-only), then `git pull --ff-only`.
- Tree dirty — **stop.** Print the paths and say which ticket they belong to.
- **The branch does not exist — stop and report to the operator.** Do not create it. Only `/plan`
  creates a `feat/` branch. Arriving here with no branch means PLAN never ran, or the ID is wrong,
  and the two need different answers. Say which you cannot rule out.

**Artifacts in:** **sections 1, 2 and 8 of `01-plan.md` only**. Do not pass the whole
ticket folder — a QA agent that can see `04-review.md` is testing the reviewer's conclusions instead
of the story.

**Artifacts out:** the test tree, `.ai/board/tickets/$ARGUMENTS/05-test-plan.md`,
`.ai/board/tickets/$ARGUMENTS/06-test-report.md`
**Templates:** `.ai/templates/test-plan.md`, `.ai/templates/test-report.md`

**Gate:** every `AC-n` maps to at least one named test; the unit and end-to-end commands named in
`.ai/standards/testing-standards.md` exit 0.

QA never reads the implementation source (RULE-05), enforced by `guard-read-scope.mjs`. A selector
not in design
section 6 does not exist; a gap is raised by writing
`.ai/board/tickets/$ARGUMENTS/99-questions.md` with `to: tech-lead-design`, and is fixed by amending
section 6 — not by answering in place. You may not address `developer` or `tech-lead-review` before
their verdicts exist; `chat-guard.mjs` blocks that write (RULE-12).

Behaviour that is wrong routes to `developer` and increments `rework_count`. An ambiguous or
untestable AC routes to `tech-lead-design` and does not (RULE-08). An invariant violation escalates (RULE-07).

## You do not touch `ticket.yaml`, and you never mark a ticket DONE

**Write the verdict into `06-test-report.md`'s front-matter and stop.** The QA row of the stage
ownership table in `.ai/01-operating-model.md` writes the test tree, `05-` and `06-` — not `ticket.yaml`.
`DONE` belongs to `orchestrator` at `/ship`, after the full Definition of Done and the pull request. A
QA session that marked a ticket DONE would skip both, and the board would claim a ship that never
happened.

Same reason as the reviewer's: RULE-13 discards you after each verdict so the next pass starts cold,
and a verdict that advances its own board is deciding and executing in one act.

## Your reply is four lines

Per `## Replying` in `CLAUDE.md`. Do not tabulate the ACs or restate the test counts — `05-test-plan.md`
and `06-test-report.md` hold them, and they are what the gate is read from. On PASS, say so. On FAIL,
give the failing criterion and where it routes.

On PASS the next command and its session go in the sign-off's *Tiếp theo* line, not in a block of
their own. For reference, it reads:

```
QA passed. Run /ship EXA-01 in the orchestrator session.
```

Then end this session. On FAIL, print the routed command instead and still end this session.

---

## Last step: sign off

**End your reply with the block in `## Replying` (`CLAUDE.md`).** It is not a footer on the reply —
for most runs it *is* the reply. Do not stop at the step above and leave the operator to work out who
answered, whether it passed, where the repository is, and what runs next.

The *first* line quotes the `gate` from the front-matter you just wrote. *Tiếp theo* names the next
stage command **and the session it belongs in** — RULE-13 makes a correct command in a reused
session a verdict that was not really reached.
Read the two values rather than recalling them:

```
date '+%Y-%m-%d %H:%M %Z'
git branch --show-current
```

A remembered timestamp or branch is the one part of this block that can be wrong while looking right.
