---
doc_version: 3
last_updated: 2026-10-01
governed_by: [RULE-01, RULE-03, RULE-09]
---

# ADR-048 — `handoff` returns as a commit checkpoint

## Status

`ACCEPTED by the operator` — 2026-10-01, **for the reversal, not for this wording.**

Recorded, not authored. The operator's instruction, verbatim:

> *"Điều kiện revert của ADR-006 đã xảy ra lần đầu: toàn bộ công việc chưa commit của CAL-12 mất khi
> cây làm việc chuyển từ feat/CAL-12 sang main. […] Viết ADR khôi phục handoff làm commit checkpoint,
> đúng cách ADR-006 § Revert condition tự nêu"*

— the revert condition of ADR-006 has occurred for the first time; write the ADR that restores
`handoff` as a commit checkpoint, in the way ADR-006 § *Revert condition* itself names.

**What the operator decided is the reversal and its shape as ADR-006 states it:** `handoff` back,
as a commit checkpoint, without worktrees. **Everything below that sentence is the steward's** — when
the checkpoint runs, who runs it, what it commits, and that it does not push. The operator has not
read it. Their acceptance of the mechanics is the review of the pull request that carries this file,
under CODEOWNERS; until that merge only the reversal is theirs.

## Context

[ADR-006](ADR-006-single-working-directory.md) removed `handoff` and made `/ship` the single commit
point of a ticket. It named the cost in advance — *"A session ending badly, a `git switch` on a dirty
tree, or a mistaken `git restore` loses all of it. There is no intermediate save point."* — and named
its own revert condition:

> **The first time a ticket's work is lost, or lands on the wrong branch.** One occurrence is enough
> […] Either reverses this by restoring `handoff` as a commit checkpoint — which does not require
> restoring worktrees, since the two were separable all along.

**It happened on CAL-12.** The record is the operator's account, and nothing here is added to it:

- Lost: `01-plan.md` (30,768 B), `03-impl-log.md` (11,026 B), `04-review.md` (10,122 B),
  `99-questions.md` (6,332 B); three new files — `viewed-team.ts` in the source library folder,
  its unit test `viewed-team.test.ts`, and the end-to-end spec `cal-12-team-picker.spec.ts` (named
  by file name, not path: they exist nowhere, and check D6 reads a path as a claim that they do);
  modifications to nine tracked files; and a § *Re-triage verdict* (+54 lines) in
  `.ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md`.
- Not recoverable. Every ref, `git fsck --lost-found` and both stashes were searched. None of the
  files had ever been `git add`ed, so no object exists for any of them.

One fact is checkable from the repository and agrees: the reflog of this working tree records
`checkout: moving from feat/CAL-12 to main`, and `feat/CAL-12` points at the same commit as `main`
(`5be0153`) — the branch carries nothing. `.ai/board/tickets/CAL-12/ticket.yaml` on `main` is still
the `BACKLOG` shell `/triage` wrote. **How the switch came to discard the files is not recorded, and
this ADR does not guess it.** It does not need to: ADR-006 made the revert condition the loss, not its
cause.

## Decision

**`handoff` returns, as a plain commit checkpoint. No worktrees, no lanes, no branch release, no
push, no pull request.**

1. **`/handoff <ID>` is a command again** — `.claude/commands/handoff.md`. It commits the
   ticket's *checkpoint set* on `feat/<ID>` and does nothing else.

2. **The checkpoint set is `/ship`'s ship set, as it stands at that moment** — paths matching
   `allowed_paths`, `.ai/board/tickets/<ID>/**`, and the three ship-owned paths
   (`.ai/board/backlog.md`, `.ai/board/metrics.md`, `.ai/registry/features.md`; ADR-023). One
   classification, not a second one: `/ship` step 4 is the definition and `/handoff` cites it.
   Everything else stays dirty, exactly as `/ship` leaves it.

3. **It runs at the end of every `/advance`** that has a recorded transition behind it — out of PLAN,
   out of IN_PROGRESS, out of REVIEW, including FAIL, BLOCKED, REWORK and ESCALATED outcomes. A
   failed stage's artifact is the most expensive thing to lose, because it is the record of why.
   `/advance` already runs after every stage, in the `orchestrator` session, attended and under
   `scripts/run-loop.mjs` alike — so the checkpoint needs no new step in the runner and no new
   session. `/handoff` may also be run on its own, in the `orchestrator` session, when a human wants
   a save point mid-stage.

4. **It never pushes.** A local commit is what survives a `git switch`, a `git restore` and a
   `git clean`, which is the failure ADR-006 named. `git push` stays absent from `permissions.allow`
   (`.claude/PERMISSIONS.md`), and under the runner `--permission-prompts none` would deny it — the
   reason the runner already refuses to start `/ship`. Pushing remains `/ship`'s.

5. **It never moves `HEAD` and never creates a branch.** It must already be on `feat/<ID>`; if it is
   not, it stops and says so. `/plan` is still the only command that creates a `feat/` branch
   (`.ai/standards/git-conventions.md`, *The branch check every ticket command runs*).

**What this amends, line by line:**

| Where | Text this contradicts | Now |
|---|---|---|
| ADR-006 § *Decision* | *"`handoff` is removed, and with it the mid-ticket commits. **A ticket is committed once, at `/ship`.**"* | Reversed for commits. One working directory, WIP 1 and RULE-13 stand unchanged |
| `CLAUDE.md` § *Working agreements* | *"Humans merge. Agents commit at `/ship` only. Every stage leaves the tree dirty, from `/plan` all the way to the end."* | Agents commit at the `/advance` checkpoint and at `/ship` |
| `CLAUDE.md` § *Working agreements* | *"A whole ticket stays uncommitted until `/ship`"* | Uncommitted until the next checkpoint |
| `.ai/standards/git-conventions.md` § *Commits* | *"One commit point per ticket, and it is `/ship`."* | Two commands commit; only `/ship` pushes |
| `.ai/standards/session-model.md` § *One ticket, one commit* | *"`handoff` no longer exists."* / *"A ticket is committed once, at `/ship`."* | Superseded |
| `.claude/agents/orchestrator.md` | *"Commit anywhere except `/ship`. No stage transition commits, ever."* | The checkpoint is the one transition that commits |
| `.claude/commands/ship.md` | *"the only command in the loop that commits"*; step 5 *"the **only** commit the ticket gets"* | `/ship` commits what remains and is the only one that pushes |

**What it does not amend:**

- **ADR-023.** A ship is still one branch and one pull request. The checkpoint commits only the ship
  set, so nothing reaches `feat/<ID>` that `/ship` would not have put there, and
  `scripts/check-allowed-paths.mjs` judges the same branch content it always did.
- **RULE-09.** It names schema changes, PR merges and ADR acceptance. Committing was never in it —
  `.ai/standards/git-conventions.md` § *Commits* records the same reading — and merging stays human.
- **RULE-03 and check R1.** R1 already has two subjects (ADR-043): the committed
  `origin/main...HEAD` diff and the uncommitted tree through `scripts/check-carry.mjs`. A checkpoint
  moves the ticket's paths from the second subject to the first; both are still read. The checkpoint
  cannot launder an out-of-scope write, because a path outside `allowed_paths` is not in the set it
  commits — it stays dirty and `check-carry` reports it stray.
- **ADR-006's other decisions.** One working directory, WIP 1 by git, and session lifetimes.

## Rationale

ADR-006 § *Rationale* had already priced this alternative: *"keeping `handoff` as a plain mid-ticket
commit checkpoint, dropping only the worktree and branch-release mechanics. That would have preserved
CI feedback partway through a ticket and bounded the amount of uncommitted work."* The operator chose
the simpler model then, with the loss stated as an accepted cost, and named the occurrence that would
end the acceptance. It has occurred.

**Why at `/advance`, rather than as a separate step after it.** A separate `/handoff` step is a
fourth process per stage under the runner and a command a person has to remember attended. ADR-036's
history is the argument against the second: the loop specified a recording step for weeks and no
command performed it. Folding the checkpoint into the step that already runs after every stage means
it cannot be skipped without skipping the recording too.

**Why not push.** Pushing would restore the second thing ADR-006 priced — CI partway through a ticket
— and it would make the work survive the loss of the clone, which a local commit does not. It is
rejected here, not on merit, because it needs a permission the operator has deliberately withheld:
`git push` is absent from the allow list so that *"the last point at which a human sees a branch name
before history exists"* stays a prompt (`git-conventions.md` § *Landing `ops/` work*). Widening that is
the operator's call and is offered below, not taken.

**Why the ship set and not a wider one.** The alternative is to commit everything the ticket's
sessions left dirty. Rejected for the reason ADR-023 rejected the same widening at `/ship`: it
launders any out-of-scope write through the one step allowed to commit.

## Consequences

**What becomes true.**

- A ticket's work survives a `git switch`, `git restore` or `git clean` from the first `/advance`
  onward. At most one stage's work is uncommitted at any time.
- History exists mid-ticket, so there is something to diff, bisect and revert to.
- `check-allowed-paths.mjs` stops being vacuous at IN_PROGRESS and REVIEW. Every implementation log
  and review since ADR-006 has noted that it reported `0 changed file(s)`; after a checkpoint it reads
  the real branch.
- The next stage's step 0 meets a tree that is clean of the ticket's own work, which is the state the
  dirty-tree stop always assumed.

**What becomes harder, and these are accepted rather than surprises.**

- **A commit no longer asserts that the gates passed.** ADR-006 kept the single commit partly because
  *"a commit is an assertion that a change is coherent"*. A checkpoint after a FAIL commits work that
  failed its gate. The commit message says which stage and which gate; the pull request, not the
  commit, is what asserts the ticket is done.
- **`/advance` is no longer write-only to `ticket.yaml` and `backlog.md`.** It now also stages and
  commits. Its *You transcribe; you do not judge* contract is unchanged: the checkpoint set is
  computed by `/ship` step 4's rule, not by judgement.
- **No CI until `/ship` still holds**, because nothing is pushed. ADR-006's weaker revert signal —
  two consecutive `/ship` runs failing on a check a mid-ticket run would have caught — is not
  answered by this ADR.
- **The clone itself is still a single point of loss.** A local commit does not survive a deleted
  folder or a dead disk.
- **Carried paths outside the ship set are not covered.** The idea file a ticket was promoted from,
  other tickets' shells, and any ADR `/triage` drafted are *carried* by `planCarry`, not committed by
  `/ship`, so not committed by the checkpoint either. The § *Re-triage verdict* lost alongside CAL-12
  was exactly such a path. That gap is MD-042 in `.ai/board/model-debt.md`, and it is not closed here.

## Open for the operator — not decided by this ADR

1. **Push at the checkpoint?** Allow `Bash(git push origin feat/*)` and have `/handoff` push after
   committing. Buys mid-ticket CI and survival of the clone; costs the push prompt that is currently
   the last human look at a branch name, and reverses a documented control in
   `.claude/PERMISSIONS.md`.
2. **Carried paths** — MD-042's fix shape.

## Revert condition

**A ticket's review or ship is wrong because of a checkpoint commit** — a path reached `feat/<ID>`
through `/handoff` that `/ship` step 4 would have left dirty, or a reviewer judged a checkpointed
change as already approved because it was in history. Either means the shared classification has
drifted or the commit is being read as an assertion it does not make. Narrow the checkpoint to
`.ai/board/tickets/<ID>/**` only — the artifacts, which are what a ticket cannot regenerate — and
leave source and tests to `/ship`.

## Affected documents

| File | Change | `doc_version` |
|---|---|---|
| `.ai/registry/decisions/ADR-006-single-working-directory.md` | Status note: commits reversed by this ADR | unchanged |
| `.claude/commands/handoff.md` | New — the checkpoint | — |
| `.claude/commands/advance.md` | Final step: run the checkpoint; *What you write* | — |
| `.claude/commands/ship.md` | Header, step 5, closing paragraph | — |
| `.claude/commands/review.md` | *Artifacts in*: the branch diff and the working tree | — |
| `.claude/commands/plan.md` | Step 0's reason for a dirty tree | — |
| `.claude/agents/orchestrator.md` | Commit bullet; *The whole ticket arrives uncommitted* | — |
| `.ai/standards/git-conventions.md` | § *Commits* | 3 → 4 |
| `.ai/standards/session-model.md` | § *One ticket, one commit*; § *The one thing this makes dangerous* | 2 → 3 |
| `.ai/01-operating-model.md` | R1 note; the loop pseudo-code | 10 → 11 |
| `CLAUDE.md` | Two working agreements; the command list | — |
| `MODEL-OVERVIEW.md` | The one-line commit agreement | — |
| `scripts/check-carry.mjs`, `scripts/run-loop.mjs` | Header comments only; no behaviour change | — |
| `.ai/board/model-debt.md` | MD-042 | 9 → 10 |
