---
doc_version: 3
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-09, RULE-13]
---

# ADR-006 — One working directory, and commits only at `/ship`

## Status

`ACCEPTED by the operator` — 2026-08-31.

**Reversed in part on 2026-10-01 by [ADR-048](ADR-048-handoff-returns-as-a-commit-checkpoint.md)**,
on the operator's instruction, because the revert condition below occurred: CAL-12's uncommitted work
was lost when the tree moved from `feat/CAL-12` to `main`. `handoff` is back as a commit checkpoint;
*"A ticket is committed once, at `/ship`"* no longer holds. One working directory, WIP 1 and the
session lifetimes stand. The text below is unchanged and records what was decided then.

Recorded, not authored. The operator's words: *"k dùng worktree nữa, chỉ dùng 1 folder chính để
work"*, and, when asked whether `handoff` kept a purpose without worktrees, *"Bỏ hẳn — chỉ commit ở
`/ship`"*.

## Context

The model this replaces used three git worktrees — a design lane, an implement lane, and a model lane
— with one `feat/<ID>` branch travelling between the first two. `handoff` existed to serve that
arrangement and did two things: it committed and pushed a lane's work so the *next* lane could read
it, and it released the branch name with `git switch --detach`, because git refuses one branch in two
worktrees.

The arrangement bought one thing: a second feature could be specified and designed while the first
was being implemented, because only the implement lane writes source.

It cost, in the origin project and here: three folders to provision, dependencies installed three
times, `settings.local.json` copied by hand into each, a branch-exclusivity failure that surfaces in
the *other* folder minutes later, and — since ADR-004 unwired `guard-project-root.mjs` — no mechanism
at all preventing a session launched in the wrong folder from writing to the wrong branch. That last
one was mitigated by asking every session to check `pwd` first, which is a convention rather than a
control.

No ticket has ever run through this repository, so the parallelism was never used and the cost was
never repaid.

## Decision

**One working directory. No worktrees, no lanes.**

`handoff` is removed, and with it the mid-ticket commits. **A ticket is committed once, at `/ship`.**

Session lifetimes are unchanged and RULE-13 is untouched: `tech-lead-review` and `qa` still run in
fresh sessions discarded after each verdict, `ba` and `tech-lead-design` still persist. **Isolation
was always a property of sessions, not of folders** — a fresh session reads files, and it reads them
just as freshly from a working tree it shares with the session that wrote them.

## Rationale

The alternative considered was keeping `handoff` as a plain mid-ticket commit checkpoint, dropping
only the worktree and branch-release mechanics. That would have preserved CI feedback partway through
a ticket and bounded the amount of uncommitted work.

The operator chose the simpler model, with the costs below stated before the choice was made. One
folder, one branch, one commit point, one command fewer is a model that can be held in the head, and
this loop has no track record yet that would justify paying for parallelism it has not needed.

## Consequences

What becomes true:

- **WIP is 1 structurally, not by policy.** One working tree holds one branch, so two tickets cannot
  be in flight. The parallel-dispatch condition in `.ai/01-operating-model.md` becomes unreachable
  rather than merely unsatisfiable.
- **The lane-confusion failure mode disappears.** There is nowhere else to be.
- **Provisioning is one clone and one install.** No `settings.local.json` to copy, no branch
  exclusivity, no `git switch --detach`.
- **`/ship` remains the single writer of `metrics.md` and `backlog.md`**, and now trivially so.

**What becomes harder, and these are the accepted costs rather than surprises:**

- **The entire ticket — story, design, source, tests, artifacts — sits uncommitted until `/ship`.**
  A session ending badly, a `git switch` on a dirty tree, or a mistaken `git restore` loses all of
  it. There is no intermediate save point.
- **No continuous integration runs until the ticket ships.** `verify` and `allowed-paths` first see
  the work at the end, so a failure that a mid-ticket run would have caught in minutes is found after
  every stage has been paid for.
- **`git switch` with a dirty tree is now the principal hazard.** It carries modified and untracked
  files onto whichever branch is arrived at, which is how one ticket's artifacts land on another
  ticket's branch. `.ai/standards/git-conventions.md` already makes a dirty tree a stop in every
  ticket command; under this decision that check stops being defence in depth and becomes the only
  defence.
- **A defect found late is expensive in a way it was not before.** Nothing is in history, so there is
  nothing to bisect and nothing to revert to.

## Revert condition

**The first time a ticket's work is lost, or lands on the wrong branch.** One occurrence is enough:
the whole cost of this decision is concentrated in that single failure, and it is not a judgement
call to observe.

A second, weaker signal: if two consecutive `/ship` runs fail on a check that a mid-ticket run would
have caught cheaply, the absence of intermediate CI is costing more than the simplification is
worth.

Either reverses this by restoring `handoff` as a commit checkpoint — which does not require
restoring worktrees, since the two were separable all along.

## Affected documents

| File | Change |
|---|---|
| `.ai/standards/session-model.md` | The worktree, lane and handoff sections replaced by one on the single working directory |
| `.ai/standards/git-conventions.md` | Commit points reduced to `/ship`; the dirty-tree stop strengthened |
| `.ai/01-operating-model.md` | WIP section; `handoff` removed from the command list |
| `CLAUDE.md` | Working agreements; the command list; the sign-off block no longer names a folder |
| `SETUP.md` | Step 10 is now one clone rather than three worktrees |
| The `handoff` command file | Deleted |
| `.claude/commands/spec.md`, `design.md`, `implement.md`, `review.md`, `qa.md`, `ship.md` | `handoff` references removed |
| `.claude/agents/orchestrator.md`, `ba.md` | Lane and handoff references removed |
| `.claude/PERMISSIONS.md` | Worktree rationale removed |
