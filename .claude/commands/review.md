---
description: Run the REVIEW stage — R1 to R8 in isolated dispatch, verdict to 04-review.md
argument-hint: <TICKET-ID>
---

Run in a **fresh session that is discarded after the verdict** — files only, no message channel
(RULE-13). You are `tech-lead-review`; nothing is dispatched.

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

**The session must be new every time, including on a re-review.** A session that remembers working
through R4 last pass will not genuinely work through it again, and the code changed between passes —
which is the entire reason there is a second pass. Reviewer memory is a liability, not an asset
(`.ai/standards/session-model.md`).

You have no channel to the Developer and you did not talk to one. `chat_before_verdict` must be
`none`; if it cannot truthfully be, the review is void and this stage re-runs in a clean session.

**Artifacts in:** `01-plan.md`, `03-impl-log.md`, `git diff origin/main...HEAD` **and** the working
tree (`git status`, `git diff`), `.ai/registry/**`. Since ADR-048 the `/advance` checkpoint commits
the implementation before you run, so `git diff` alone is empty — read the branch diff.
**Artifact out:** `.ai/board/tickets/$ARGUMENTS/04-review.md`
**Template:** `.ai/templates/review-report.md`

**Gate:** R1 through R8, each citing `file:line`. An item with no citation counts as failed.

**Fill the five routing fields in the front-matter, every time, including on a PASS.** `verdict`,
`failed_checks`, `invariant_violation`, `route_to`, `increments_rework` — the valid combinations are
tabulated in `.ai/templates/review-report.md`. `/advance` and `scripts/run-loop.mjs` route on
`invariant_violation` and `route_to` and never on a check number (ADR-036). `verdict` must equal
`gate`; a disagreement voids the artifact and the stage re-runs in a clean session.

On FAIL, route per the failure routing table in `.ai/01-operating-model.md`, which encodes RULE-08 in
its third column. Read the column; do not decide the increment yourself.

**An R7 failure does not enter REWORK.** It escalates to a human on first occurrence (RULE-07): name
the invariant, write `next_state: ESCALATED`, and halt.

**Any other `BLOCKED` falls under ADR-067.** If the verdict waits on a decision you can recommend an
answer to, take that answer, record it under `## Delegated decisions` in `04-review.md`, and judge
against it. `route_to: human` is for RULE-07 and for a fact only a person holds.

**Run each verify command on its own, in exactly the form named.** Use `node scripts/check-allowed-paths.mjs`,
`node scripts/check-carry.mjs <ID>`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, or the `pnpm exec`
forms in `.ai/standards/testing-standards.md`. One per Bash call. The exit code is in the tool
result, so do not add `; echo "EXIT=$?"`, a `cd`, or a pipe. Under the runner nothing can approve a
prompt, so a compound command is denied even when each part is allowed. That is how MIR-08's first
review lost R1–R3 (run 20261023-065554).

## You do not touch `ticket.yaml`

**Write the verdict into `04-review.md`'s front-matter and stop.** `gate`, `blocking_reason` and
`next_state` are the whole of your output; the `orchestrator` reads them and moves the board
(`.ai/01-operating-model.md`, stage ownership — the REVIEW row writes `04-review.md` and nothing
else).

This is not bookkeeping etiquette. **A verdict that advances the board it is judging has no separation
left.** RULE-13 discards you after each verdict precisely so the next pass starts cold; a reviewer that
can also mark a ticket QA is deciding and executing in one act, and nothing between the two is
reviewable. If the front-matter and the board ever disagree, the artifact is the record and the board
is a view.

## Your reply is four lines

Per `## Replying` in `CLAUDE.md`. **Do not tabulate R1 to R8 in chat.** `04-review.md` holds every
check with its `file:line`, that is the artifact the gate is read from, and a summary of it in chat is
a copy that cannot be cited. *All eight pass* is one sentence; a FAIL needs the failing check and why,
and nothing about the ones that passed.

Never cite `04-review.md`'s own line numbers as evidence for its own conclusions — R-checks cite the
implementation, and quoting your own report back proves nothing.

Name the ticket by its ID. Not `ticket.yaml`, not "the ticket" — `EXA-01`.

Then end this session.

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
