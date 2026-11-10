---
description: Run the SPEC stage — the BA writes 01-story.md
argument-hint: <TICKET-ID>
---

> **`/spec` is retired — ADR-019.** SPEC and DESIGN were merged into one stage. Run
> `/plan <TICKET-ID>` instead; it inherited this command's branch-creation role and its
> never-invent rules. Kept, not deleted, so tickets shipped before 2026-09-01 stay readable.

Run in the **BA session**. It is persistent and lives
until the end of the run (`.ai/standards/session-model.md`). You are the BA; nothing is dispatched.

## Step 0 — put yourself on `feat/$ARGUMENTS` before writing anything

**Mode: create. `/spec` is the only command permitted to bring a `feat/` branch into existence** —
see *The branch check every ticket command runs* in `.ai/standards/git-conventions.md`. Every later
stage arriving at a missing branch stops and reports instead, because at that point a missing branch
means something upstream did not happen and manufacturing one hides which.

**Run this first, every time, including a re-run.** You hold `Bash` for this and only this
(`.claude/agents/ba.md`). **Run them; do not report them.** The branch you ended on is one line of the
sign-off and the story's `inputs_read` carries it into the artifact — that is the audit trail, and it
outlives a chat transcript. Print only when a row below says stop.

```
pwd
git branch --show-current
git fetch origin --quiet
git status --porcelain
```

Then take exactly one of four paths:

| What you found | What you do |
|---|---|
| Already on `feat/$ARGUMENTS` | Nothing. Proceed to the story. |
| On another branch, or detached, **and the tree is dirty** | **STOP.** Print the dirty paths and say which ticket they belong to. Do not switch. |
| On another branch or detached, tree clean, `feat/$ARGUMENTS` **exists** | `git switch feat/$ARGUMENTS` — or `git switch -c feat/$ARGUMENTS origin/feat/$ARGUMENTS` when it exists only on the remote. |
| On another branch or detached, tree clean, `feat/$ARGUMENTS` **does not exist** | `git switch -c feat/$ARGUMENTS origin/main` |

**Existence is checked, not assumed:** `git show-ref --verify --quiet refs/heads/feat/$ARGUMENTS`,
then `refs/remotes/origin/feat/$ARGUMENTS`. Two separate refs and they can disagree — a branch
pushed by an earlier `/ship` exists on the remote after the local one is deleted, and a branch created
here and never shipped exists only locally.

### Four things that will bite, each for a different reason

**Cut from `origin/main`, never from local `main`.** Local `main` is routinely many commits behind —
nothing in this loop updates it, because no session ever checks it out. A branch cut from a stale local
`main` looks correct and is missing whatever merged since, and the gap surfaces as a conflict at
`/ship`. This is the one place the operator's instruction is realised rather than followed literally:
"back to main" means the current `main`, which is `origin/main`.

**A dirty tree is a stop, not a problem to route around.** `git switch` carries modified and untracked
files onto the branch you arrive at. That is how one ticket's story lands on another ticket's branch.
Since ADR-006 a ticket stays uncommitted until `/ship`, so a dirty tree is not leftover noise — it is
somebody's whole ticket. Print the paths, say which ticket they belong to, and stop.

**One working directory, one branch, one ticket.** There is nowhere else to be and nothing to hand
over. If `feat/<other>` is checked out with work on it, that ticket is still in flight and this one
does not start yet.

### What step 0 is not

Not a commit, not a push, not a stash. Branch creation is not persistence:
`.ai/standards/git-conventions.md` grants the commit exception to `/ship` alone, and this step is not
it. Record the branch you ended on in the story's `inputs_read` front-matter so the
decision is legible from the artifact.

**Artifacts in:** `.ai/board/tickets/$ARGUMENTS/ticket.yaml`, `.ai/registry/**`
**Artifacts out:** `.ai/board/tickets/$ARGUMENTS/01-story.md`, plus `invariants_touched` and
`size_estimate` written back into `ticket.yaml`
**Template:** `.ai/templates/story.md`

**SPEC runs directly out of BACKLOG, and DoR is evaluated after it** — `BACKLOG -> SPEC -> [DoR] ->
READY`. Two DoR items are yours: `invariants_touched` and `size_estimate`. Leaving either unwritten
does not fail this stage quietly; it fails the gate immediately after it, and the ticket returns to
BACKLOG.

**Gate:** acceptance criteria in Given/When/Then, each with an ID; `invariants_touched` populated in
`ticket.yaml`; Out-of-scope non-empty; `size_estimate` set to S or M.

`size_estimate` is yours and only yours. It is an estimate from the story's scope and its Out-of-scope
section — not a verdict on the implementation, which is `size`, set by the Tech Lead at DESIGN from
the enumerated `allowed_paths`. A ticket you cannot estimate as S or M is not refined enough for this
stage to pass; say so rather than guessing.

On PASS, record the transition in `.ai/board/metrics.md` and **print the next command and its
session** — do not invoke it:

```
SPEC passed. Run /next-ticket in the orchestrator session to evaluate DoR.
```

**Do not set the ticket to `READY` yourself.** DoR is the orchestrator's evaluation, and an agent
that promotes its own output past the gate that judges it has removed the gate. Leave the state at
`SPEC`.

On FAIL or BLOCKED, record the reason, print nothing to run next, and stop.

The BA does not read the implementation source and does not take a story from a tracker description
(RULE-05,
RULE-17). Policy is in `.ai/01-operating-model.md`.

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
