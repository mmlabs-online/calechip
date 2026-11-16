---
doc_version: 3
last_updated: 2026-11-16
governed_by: [RULE-01, RULE-03, RULE-06, RULE-08, RULE-09]
---

# ADR-101 — A defect is recorded by `/bug` as a `BUG-nnn` ticket, and fixed by the loop with a regression test that fails before the fix

## Status

`PROPOSED` — 2026-11-16, by the steward, at the owner's request.

**Not `ACCEPTED`.** The owner asked for the behaviour below in words, but the request reached this
repository through another session, not in a conversation here that can be quoted as the operator's
acceptance of this text. Under ADR-008 an agent does not accept an ADR that changes the envelope, and
this one adds a command, a commit point and a review check. The operator accepts it by editing this
line to `ACCEPTED by the operator`, or rejects it, at the pull request that carries it (RULE-01,
CODEOWNERS). The precedent is ADR-038, which un-retired `/idea` the same way.

The behaviour asked for, as relayed: `/bug "<description>"` records a bug as a ticket — found in and
introduced in, steps, expected and actual, a root cause marked confirmed or suspected with
`file:line`, severity S1–S3 — investigating read-only and checking for a duplicate first. It then asks
the operator three options: **A)** open a pull request carrying only the record and stop; **B)**
record another bug on the same batch branch, then ask again; **C)** fix the whole batch now through
the normal loop and open **one** pull request. Every fix has a regression test that fails before the
fix; the reviewer rejects without it; agents never merge.

## Context

**The ID exists and the intake does not.** `.ai/01-operating-model.md` § *ID scheme* has said
*"Defects are `BUG-nnn`"* since the template, and five `BUG-nnn` tickets have shipped. None of them
came in the same way:

- `BUG-001` and `BUG-002` were written by `product` at `/triage`, from an idea file — a defect
  pushed through an intake built to judge a *request*, whose gate is *"a problem and not a
  solution"* and whose PROMOTE issues a feature ID a defect does not need.
- `BUG-003`, `BUG-004` and `BUG-005` were written by `developer` at CICD-01 `/implement`, from that
  ticket's plan — each `ticket.yaml` says in its first line *"not by /triage (ADR-010)"*.
  `.ai/board/backlog.md` still records that they had no backlog row and that *"placing them is the
  operator's"*.

None of the five records which release the defect was found in, which commit introduced it, how bad
it is, or whether its cause was reproduced or guessed. `BUG-003` carries all of that, but only as
free-text comments at the end of its `ticket.yaml`.

**Nothing requires a fix to prove it fixed anything.** The review checklist is R1–R8. None of the
eight asks whether a test reproduces the defect, so a `BUG-nnn` ticket can pass review on a diff that
changes code no test exercises. A defect that recurs is then found again by a person, the same way it
was found the first time.

**The loop is one ticket, one branch, one pull request.** ADR-006 holds one working directory and
WIP 1. `/plan` is the only command that creates `feat/<ID>`
(`.ai/standards/git-conventions.md` § *The branch check every ticket command runs*). ADR-023 makes a
ship one branch and one pull request, and RULE-03's CI mechanism, `scripts/check-allowed-paths.mjs`,
resolves *one* ticket from the branch name `feat/<ID>`. Option C as asked — one pull request for a
batch of fixes — needs all four changed. See *Decision 6* and *Open questions*.

**Bugs ship on `feat/BUG-nnn`, not on `bugfix/`.** `git-conventions.md` § *The four names* still
lists `bugfix/BUG_<FEATURE-ID>_<NN>`. The operator moved `BUG-001` to `feat/BUG-001` on 2026-09-03,
because only a `feat/` branch puts the ticket under the path guard. `BUG-003` to `BUG-005` followed:
`feat/BUG-003`, `feat/BUG-004` and `feat/BUG-005` are on `origin`. This ADR follows that practice and
does not touch the stale row.

## Decision

1. **`/bug "<description>"` is a new intake command** — `.claude/commands/bug.md`, with the
   Antigravity shim `.agents/skills/bug/SKILL.md` (check D16). It runs in a fresh session that acts
   as the orchestrator, like `/run-ticket`, because option C dispatches the loop's stage agents and
   only the lead session can. It does not extend `/triage` or `/idea`. See *Rationale*.

2. **The ID is `BUG-nnn`**, the existing scheme: the next number after the highest `BUG-nnn` on
   `origin/main`, on the current batch branch, and on any `origin/feat/BUG-*` or `ops/record-*` ref.
   It issues **no feature ID**. `feature_ids` names the shipped feature whose behaviour is broken, so
   Definition of Ready item 1 holds without a write to `features.md`. If no row in `features.md`
   covers the broken behaviour, the request is for missing behaviour, not a defect. `/bug` then stops
   and names `/idea`. A defect in the operating model itself goes to `/thuki` and
   `.ai/board/model-debt.md`. It is not a `BUG-nnn`, as `.ai/board/model-defects.md` already says.

3. **A record is three things, and only these:**
   - `.ai/board/tickets/<ID>/ticket.yaml`, copied from `.ai/templates/ticket.yaml`, `state: BACKLOG`,
     with DoR items 1, 3, 4 and 6 filled the way `/triage` fills them (ADR-010). `invariants_touched`
     and `size_estimate` stay empty for PLAN.
   - `.ai/board/tickets/<ID>/00-bug-report.md`, from the new template `.ai/templates/bug-report.md`.
     Its front-matter carries `severity` (S1–S3), `found_in`, `introduced_in` and `root_cause`
     (`confirmed` | `suspected` | `unknown`). Its body holds the report verbatim, environment, steps,
     expected, actual, and the root cause with `file:line`.
   - One row **appended** to `## BACKLOG` in `.ai/board/backlog.md`. It is appended, not placed:
     the backlog is ordered by a human (§ *Backlog*), and severity informs the operator's placement
     but does not perform it. `/status` names an S1 that is not at the top.

4. **The investigation is read-only, and the duplicate check comes first.** `/bug` reads source,
   history and tests, and runs the existing tests or the app. It writes nothing in the tree but the
   record. A report that matches an open `BUG-nnn` is appended to that ticket's
   `00-bug-report.md` § *Further reports* instead of becoming a second ticket. A report that matches
   a `DONE` one is a regression and gets a new ID that cites the old one.

5. **A batch lives on `ops/record-<first-id>`, cut from `origin/main`.** Each record is one local
   commit on that branch, `<ID>: record — <title>`. This is a **third commit point**, beside the
   `/advance` checkpoint and `/ship`. ADR-048's reason applies to it: an uncommitted record is lost
   by the next `git switch`. **Nothing is pushed until the operator picks A.**

6. **After each record, `/bug` asks the operator one question with three options**, in the
   conversation language:
   - **A — open the record pull request and stop.** Push the batch branch, open one pull request
     into `main` that carries only the records, and stop. Once a person merges it, `/run-ticket
     <ID>` finds the ticket on `main` like any other. This push and this pull request are the
     operator's instruction in the session, which `git-conventions.md` § *The second exception*
     already allows. `git push *` stays an `ask` rule, so the operator also approves the push itself.
   - **B — record another bug on the same branch, then ask again.**
   - **C — fix the batch now.** For each bug, S1 first and then in record order, `/bug` brings that
     bug's record onto a fresh tree and runs `/run-ticket <ID>` from its § 1. That is the normal
     loop, unchanged: `/plan` creates `feat/<ID>` from `origin/main`, the stage agents run as
     subagents, `/ship` opens that ticket's pull request. **This gives one pull request per bug, not
     one for the batch** — *Open questions* 1. C needs WIP 0: if another ticket is between `PLAN`
     and `REWORK`, C is not offered.

7. **A `BUG-nnn` fix carries a regression test that fails before the fix.**
   - **PLAN.** `01-plan.md` § 2 has a regression criterion that names the test file and the test,
     and states that it fails on `origin/main` and passes after the change. `/plan` reads
     `00-bug-report.md` as well as `ticket.yaml` (`ARTIFACTS_FOR[PLAN]`).
   - **IMPLEMENT.** The developer writes that test **before** the fix, runs it against the unfixed
     code, and records the failing run in `03-impl-log.md` § *Regression test*: the command, the exit
     code, and the failing assertion. The passing run after the fix goes beside it.
   - **REVIEW, check R10.** On a `BUG-nnn` ticket, the regression test the plan names exists and
     passes. With the diff's non-test paths restored from `origin/main`, it fails. The reviewer
     re-runs it that way and cites both runs. A failure routes to `developer` and increments
     `rework_count`. If `01-plan.md` names no regression test, the failure routes to
     `tech-lead-design` and does not increment (RULE-08).
   - **R10, not R9.** ADR-033 accepted an R9 that never landed in the checklist. Taking its number
     would make that ADR cite a check that means something else.

8. **Nothing about merging changes.** RULE-09 v3 stands. No agent merges a record pull request or a
   fix pull request. The runner's `mergeGate` (ADR-067) never sees a record pull request, because
   the runner does not open one.

## Rationale

**Why a new command, not `/triage` with a bug branch.** `/triage` is `product` and
`tech-lead-design` judging a request, and `product` holds no `Bash`. A defect needs the opposite
shape. It needs no judgement on whether it is worth doing, and no feature ID. It does need
`git log -S`, a test run and a reproduction, none of which `product` can perform. Folding it in would
also put a BUG verdict beside REJECT, NEEDS-ADR and PROMOTE, which `scripts/run-loop.mjs` routes on
(ADR-037). That is a fourth verdict the runner does not know, added to save one command file.

**Why not `/idea`.** `/idea` writes the file that an unattended run starts from, with the verdict
left empty (ADR-038). A bug record is not an idea waiting for a verdict. Expected against actual is
already a problem statement, and the *"problem, not a solution"* gate adds nothing to it. `/idea`
also runs as `product`, without `Bash`.

**Why one pull request per bug under C, when one for the batch was asked.** One pull request for
several tickets needs four things this repository forbids today. `check-allowed-paths.mjs` resolves
one ticket per branch, so a second ticket's source files fail CI as out of `allowed_paths`, or pass
unchecked on a non-`feat/` branch. That trades away RULE-03's only CI mechanism (ADR-004). `/plan`
would have to cut from a batch branch rather than `origin/main`. `/ship` would have to ship several
tickets in one PR (ADR-023). WIP 1 (ADR-006) would have to hold several tickets in flight on one
branch. Each is an envelope change that ADR-008 reserves for the operator. Option C therefore does
everything asked except the single pull request, and says so in the option's own text.

**Why `ops/record-*` and not `feat/BUG-nnn` for the record.** A record pull request on `feat/<ID>`
would be merged and leave `origin/feat/<ID>` behind. The next `/plan <ID>` step 0 finds that branch
and switches to it, now behind `main`. `ops/` is the chore namespace, and `check-allowed-paths.mjs`
correctly checks nothing on it, because the record touches only the ticket folder and `backlog.md`.

**Alternative considered and rejected — leave the record uncommitted, like `/triage`'s output.**
`/plan` step 0 carries one ticket's folder and treats a second ticket's folder as stray. A batch of
uncommitted records would therefore stop the first `/plan` of option C, and a `git switch` would put
the whole batch at risk, which is how CAL-12 was lost.

## Consequences

**Better.** A defect has one way in, and its record says how bad it is, where it came from and
whether the cause was seen or guessed. A fix cannot reach `DONE` without a test that would have
caught it. The duplicate check stops one defect becoming two tickets.

**Worse, and real.**

- **A third commit point.** CLAUDE.md and `git-conventions.md` § *Commits* each said two. Both are
  amended here.
- **A ticket shell can now live on a branch that is not `main` and not its own `feat/` branch.**
  ID allocation therefore has to read refs as well as the tree. A record branch that is never pushed
  and never fixed is invisible to everyone but the clone it sits in.
- **Option A means a person's merge before the fix can start.** That is a wait the loop did not
  have.
- **Option C produces N pull requests, not one** — the owner's request, unmet.
- **R10 costs a second test run per review**, and an end-to-end regression test is a slow one.
- **The reviewer restores source files from `origin/main` in the working tree to run R10**, then
  restores them from `HEAD`. The `/advance` checkpoint (ADR-048) commits the implementation before
  review, so `HEAD` is a complete copy. The tree must be clean again afterwards, or the review is
  void.

## Open questions — the owner's

1. **One pull request for a batch under C.** It needs `check-allowed-paths.mjs` to resolve several
   tickets from one branch, a batch branch name under the path guard, `/plan` cutting from that
   branch, `/ship` shipping several tickets in one pull request, and ADR-006 and ADR-023 amended.
   None of it is implemented. If the owner wants it, the steward drafts that ADR.
2. **Should an S1 be placed at the top automatically?** Today it is appended, and `/status` flags
   it. Automatic placement would amend `.ai/01-operating-model.md` § *Backlog* (*"A human reorders
   rows"*) and `orchestrator.md` (*"Decide priority"*).
3. **The `bugfix/` row in `git-conventions.md`** contradicts every bug shipped so far. Retiring it
   is a separate standards change.

## Revert condition

Any one of these:

- **One `BUG-nnn` ID is issued twice.** The ref scan in decision 2 is then not enough, and records
  go back to being uncommitted on `main`'s tree.
- **A shipped `BUG-nnn` regression test turns out to pass on the code before its fix.** R10 then
  checks something other than what it claims, and is tightened or removed.
- **Two record pull requests in a row stay unmerged for more than seven days** while `/run-ticket`
  cannot see their tickets. Option A is then a queue nobody empties, and it is withdrawn in favour of
  C.

## Affected documents

| File | Change | `doc_version` |
|---|---|---|
| `.claude/commands/bug.md` | new | — |
| `.agents/skills/bug/SKILL.md` | new, the D16 shim | — |
| `.ai/templates/bug-report.md` | new | 1 |
| `.ai/01-operating-model.md` | § *ID scheme*, `ARTIFACTS_FOR[PLAN]`, R10 in the checklist and in failure routing, the REVIEW gate | 12 → 13 |
| `.ai/templates/review-report.md` | R10 row | 6 → 7 |
| `.ai/templates/impl-log.md` | § *Regression test* | 1 → 2 |
| `.ai/standards/git-conventions.md` | § *Commits*: the record commit | 6 → 7 |
| `.claude/commands/plan.md` | the regression criterion on a `BUG-nnn` ticket | — |
| `.claude/commands/implement.md` | the regression test first, and the red run recorded | — |
| `.claude/commands/review.md` | R10 in the gate | — |
| `.claude/commands/run-ticket.md` | preflight accepts the bug's own record when `/bug` C prepared it | — |
| `.claude/commands/status.md` | *Waiting on you*: an S1 not at the top, an unpushed record branch | — |
| `CLAUDE.md` | the command list, and the commit points | — |
