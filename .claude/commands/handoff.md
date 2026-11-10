---
description: Checkpoint a ticket — commit its ship set on feat/<ID>, no push, no pull request
argument-hint: <TICKET-ID>
---

Run in the **orchestrator session** (`.ai/standards/session-model.md`). Nothing is dispatched.

**This runs as the last step of every `/advance`** — ADR-048. You will rarely type it. Run it on its
own only when a human wants a save point partway through a stage.

**Why it exists.** ADR-006 removed the original `handoff`, which served three worktrees, and made
`/ship` the only commit a ticket got. Its revert condition — *the first time a ticket's work is lost*
— was met by CAL-12 on 2026-10-01: four artifacts, three new source and test files and nine modified
files, never `git add`ed, gone. This command is that `handoff` without the worktree, the lane and the
branch release. It commits; that is all it does.

## 0. Confirm the branch. Mode: stop

The table in `.ai/standards/git-conventions.md`, *The branch check every ticket command runs*.

```
git branch --show-current
git status --porcelain=v1 --untracked-files=all
```

**You must already be on `feat/$ARGUMENTS`. If you are not, stop and say where you are.** Do not
switch: a checkpoint is a claim about the work in this tree, and `git switch` on a dirty tree is the
loss this command exists to prevent. Do not create the branch — only `/plan` does.

A clean tree is not an error. Report `nothing to checkpoint` and stop.

## 1. Classify — by `/ship` step 4's rule, not your own

The **checkpoint set** is exactly `/ship`'s ship set at this moment
(`.claude/commands/ship.md` step 4, ADR-023):

- a path matching `allowed_paths` in `ticket.yaml`;
- a path under `.ai/board/tickets/$ARGUMENTS/`;
- `.ai/board/backlog.md`, `.ai/board/metrics.md`, `.ai/registry/features.md`.

**Everything else stays dirty** — the idea file, other tickets' shells, drafted ADRs, model and
tooling work, anything you cannot place. A path you cannot classify is never guessed into the set.
Do not print the classification; the commit is the record.

## 2. Commit, on `feat/$ARGUMENTS`

`git add` with explicit paths — never `-A`, never `.`. One commit. Message:

```
<TICKET-ID>: checkpoint after <STAGE> — gate <PASS|FAIL|BLOCKED>

ADR-048. Not a ship: nothing pushed, no pull request.
```

`<STAGE>` and the gate are copied from the artifact `/advance` just read. When run on its own,
mid-stage, write `checkpoint mid-<STAGE>` and no gate.

## 3. `node scripts/check-allowed-paths.mjs`

It diffs `origin/main...HEAD`, the whole branch. It should pass by construction, since you committed
only the ship set. **A FAIL means the classification in step 1 was wrong.** Say which path and stop —
do not amend history, do not reset, and never widen `allowed_paths`. `/ship` step 6 runs the same
check and the operator decides the repair.

## What this command never does

- **Push.** `git push` is absent from `permissions.allow`, and pushing is `/ship`'s — ADR-048 § *Open
  for the operator*.
- **Open a pull request.** That is `/ship` step 7.
- **Switch, create or release a branch.** There is one working tree and nothing else wants the name.
- **Change `state:` or any gate.** `/advance` records; you persist.
- **Commit a path outside the checkpoint set**, whoever wrote it. Model work is `/thuki`'s, on
  `ops/<slug>`.
- **Merge, or target `main`.** RULE-09.

## Your reply

When run inside `/advance`, nothing of your own — `/advance`'s reply names the commit in its one line.
When run alone, per `## Replying` in `CLAUDE.md`: the short sha above the block, and any path that
stopped you.
