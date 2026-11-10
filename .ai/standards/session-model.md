---
doc_version: 3
last_updated: 2026-10-01
governed_by: [RULE-11, RULE-12, RULE-13, RULE-14, RULE-15, RULE-16]
---

# Session model

How the agents in this system are actually started, how long they live, and how they talk. RULE-11
through RULE-16 state the policy in `.ai/registry/rules.md`; this file states the transport and the
lifecycle that deliver it. Nothing here restates a rule.

## Lifetimes

| Agent | Session | Closes when |
|---|---|---|
| `orchestrator` | persistent | end of run |
| `ba` | — | retired by ADR-019; the role left the loop |
| `tech-lead-design` | persistent | end of run |
| `developer` | ephemeral | ticket DONE or ESCALATED — survives REWORK |
| `tech-lead-review` | ephemeral | after **each** verdict, including a re-review |
| `qa` | ephemeral | after **each** verdict |
| `product` | ephemeral | task done |
| `devops` | ephemeral | task done |

**Roles that get asked stay alive; roles that pass judgement die after speaking.**

The BA and the Tech Lead are the ones asked to explain what they meant, sometimes several tickets
later. A session that still holds the reasoning behind a decision answers that better than one
re-reading its own artifact cold.

A reviewer is the opposite case. A `tech-lead-review` session that remembers working through R4 on
the previous pass will not genuinely work through it again — but the code changed between passes, and
that is the whole reason a second pass exists. Its memory is a liability rather than an asset, so it
dies after each verdict and the next review starts from files. The same argument applies to QA, which
is why neither is on the persistent list.

`developer` sits between the two. It is ephemeral, but it **survives REWORK**, because rework is a
continuation of the same task with new information rather than a new task. Restarting it every cycle
would spend the RULE-06 budget on re-deriving the design instead of on fixing what the reviewer
actually found.

## The orchestrator is the lead session

It is not a subagent. It reads the board, decides what comes next, and **prints the command and the
session it belongs in**. It never invokes a stage owner.

This is what makes the table above enforceable rather than aspirational. A subagent cannot open a
fresh top-level session for a reviewer, and it cannot keep the BA's session alive across tickets — so
a dispatching orchestrator would have to simulate both, and RULE-13 would once again rest on an
agent's good behaviour. A printed instruction that a human runs is a real context boundary. A nested
call is not.

## One ticket, six commands

Each line is run in the session named. The orchestrator prints the next line after each gate.

`BACKLOG -> PLAN -> [DoR] -> READY -> IN_PROGRESS -> REVIEW -> DONE`

| # | Command | Session | Produces |
|---|---|---|---|
| 1 | `/plan EXA-01` | Tech Lead — persistent | `01-plan.md`, plus `invariants_touched`, `size_estimate`, `size` and `allowed_paths` in `ticket.yaml` |
| — | `/next-ticket` | orchestrator — lead | the DoR evaluation; `PLAN -> READY` on a pass, back to `BACKLOG` on a fail |
| 3 | `/implement EXA-01` | Developer — fresh, kept until DONE or ESCALATED | code, `03-impl-log.md` |
| 4 | `/review EXA-01` | **fresh session, discarded after the verdict** | `04-review.md` |
| 5 | `/qa EXA-01` | **fresh session, discarded after the verdict** | `05-test-plan.md`, `06-test-report.md`, the tests |
| 6 | `/ship EXA-01` | orchestrator — lead | PR opened; a human merges (RULE-09) |

**The unnumbered row is not optional.** PLAN runs directly out of BACKLOG, and DoR is evaluated
between PLAN and READY, because two of its six items are PLAN's output. The Tech Lead does not promote its
own ticket to READY — that evaluation belongs to the orchestrator, and an agent that walks its own
work past the gate judging it has removed the gate.

On a FAIL at step 4 or 5, the failure routes per the table in `.ai/01-operating-model.md`. Re-running
`/review` opens **another** fresh session — a re-review never reuses the session that produced the
previous verdict.

## Chat is a file

There is no live message channel. A question is a file write; an answer is an amendment.

- The asking session writes `.ai/board/tickets/<ID>/99-questions.md`. Its front-matter carries
  `to: <agent>` and `asked_at: <ISO8601>`.
- The answering session amends **its own artifact** — the story, the design — appends a `## Changelog`
  line, and writes the answer into `99-questions.md` under the question.
- `.claude/hooks/chat-guard.mjs` inspects writes to `99-questions.md`: it blocks when `to:` names a
  pair the topology forbids before a verdict exists, and it counts entries against `chat_budget`.

The reason to prefer this over a message API is RULE-14. A clarification that reveals an incomplete
upstream artifact must amend that artifact — and with a file transport there is nowhere else for the
answer to live. It cannot be said and forgotten, because saying it is writing it down. A message
channel makes the amendment a second, skippable step; a file makes it the only step.

It also means `consulted` in the artifact front-matter is checkable. `99-questions.md` is the record,
so an artifact claiming no consultation while a question sits in the file is a detectable provenance
failure rather than a matter of trust.

## One working directory

**There is one folder, one clone, one working tree.** Every session — every role — is launched in it.
Decided in [ADR-006](../registry/decisions/ADR-006-single-working-directory.md), which replaced three
git worktrees and a branch that travelled between them.

### What this changes, and what it does not

**It does not change isolation.** RULE-13 asks that REVIEW and QA see files only, with no message
channel and no inherited context, and that was always a property of *sessions* rather than of
folders. A fresh `tech-lead-review` session reads files; it reads them just as freshly from a working
tree it happens to share with the session that wrote them. The lifetimes table at the top of this
file is untouched.

**It does change how many tickets can be in flight: one.** A single working tree holds a single
branch. Two tickets cannot be live, so the parallel-dispatch condition in
`.ai/01-operating-model.md` is now unreachable rather than merely hard to satisfy. WIP is 1 because
git makes it 1.

**It removes a failure mode entirely.** Since ADR-004 unwired `guard-project-root.mjs`, nothing
stopped a session launched in the wrong folder from writing to the wrong branch — it was held by
asking every session to check `pwd` first, which is a convention and not a control. With one folder
there is nowhere else to be.

### One ticket, a checkpoint per stage

**`handoff` is back, as a commit checkpoint only** — ADR-048, 2026-10-01. The original had two jobs:
commit a lane's work so the next lane could read it, and release the branch name for another
worktree. With one folder both stay unnecessary. What returned is the third thing it did by side
effect: **keep the work in history.** Every `/advance` ends with one local commit of the ship set on
`feat/<ID>`; `/ship` commits the rest and is still the only push.

*Until ADR-048 this section read "`handoff` no longer exists" and "A ticket is committed once, at
`/ship`." ADR-006's revert condition — the first lost ticket — was met by CAL-12.*

### The one thing this makes dangerous

**`git branch --show-current` and `git status` before the first instruction of every session.** Not
`pwd` any more — the folder is a constant. The branch and the tree are not.

Since ADR-048 the work of every stage up to the last `/advance` is in local history. **What the
current stage has written is not**, nor are carried paths outside the ship set (MD-042), and nothing
is pushed until `/ship`. So:

- **A dirty tree is a stop, in every ticket command.** `git switch` carries modified and untracked
  files onto whichever branch is arrived at, and that is how one ticket's work lands on another
  ticket's branch. `.ai/standards/git-conventions.md` states the check; under ADR-006 it stopped
  being defence in depth and became the only defence.
- **Nothing is on the remote until the end**, so there is no CI result until `/ship` runs.

ADR-006 recorded both as accepted costs and named the revert condition: the first time a ticket's
work is lost or lands on the wrong branch. It happened on CAL-12 and ADR-048 is the reversal.

### The surface that used to collide

`.ai/board/metrics.md` and `.ai/board/backlog.md`. Every ticket appends to both and no
`allowed_paths` covers either. Under three lanes this needed a rule naming one writer; with one
working tree and one live ticket there is only ever one branch appending to them, and `/ship` is the
only command that writes them because it is the only command that commits.

### Provisioning

One clone, one dependency install.

TODO(project): write the exact install command here, with any flags a local toolchain needs, and
state the condition under which those flags stop being safe.

`settings.local.json` under `.claude/` is gitignored and stays on the machine that granted the
permissions. `settings.json` is tracked, so the deny list and the hooks arrive with the clone.

## Every reply ends with a sign-off

The block itself is in `CLAUDE.md`, which is the one file every session loads, so it is defined once
and reproduced nowhere.

**What it is for.** Six ticket commands and nine agents mean the operator's real question after any
reply is the same four things: who answered, whether it passed, where the repository is now, and what
to type next. Before this, each of the four was somewhere different — the
gate in an artifact's front-matter, the branch nowhere at all, the next command sometimes printed and
sometimes not. Putting them in a fixed place at a fixed time is worth more than any one of them.

**Two failure modes it must not have**, and both are likelier than they look:

- **A fabricated timestamp or branch.** Both are cheap to read — `date` and
  `git branch --show-current` — and both are exactly the kind of value a language model will supply
  from context rather than from the machine. A sign-off is a claim about the state of a repository. An
  invented one is worse than none, because it looks like it was measured. An agent holding no `Bash`
  tool writes `unavailable` and says why; `product` is the case that exists today.
- **The block leaking into an artifact.** It is conversation, addressed to one reader. Artifacts carry
  front-matter with `gate`, `produced_at` and `inputs_read`, and that is the record. A sign-off pasted
  into `01-plan.md` is noise in a document that a reviewer, a QA session and a human all read later.

**It does not replace the gate.** The gate is in the artifact's front-matter and the sign-off quotes
it. If the two ever disagree, the artifact is right — a sign-off is a summary and summaries drift.

## Phase 2 — a live multi-agent session

The intended next step is to move PLAN and IN_PROGRESS onto a live shared session, so the
constructing roles share context, while REVIEW and QA stay exactly as they are: fresh, isolated,
files only. The isolation of the judging roles is not negotiable and is not what this changes.

It is not adopted, and the reasons are worth stating plainly rather than discovering later:

- **Experimental.** The feature is behind a flag and its behaviour may change. Building the loop's
  correctness on it now would mean debugging the harness and the process at the same time.
- **Several times the tokens.** A live multi-agent session re-sends shared context on every turn.
  That is affordable for a hard design conversation and wasteful for the routine tickets that make up
  most of a board.
- **Team configuration lives outside the repository.** This is the serious one. Everything else
  governing this system — rules, invariants, permissions, hooks — is in the repo, reviewable in a pull
  request, and covered by CODEOWNERS. A team definition in a home directory is none of those things:
  it cannot be reviewed, it drifts per machine, and a change to it changes how agents collaborate with
  no diff anywhere. Until that configuration can be committed, adopting it would move a load-bearing
  part of the process out of version control, which is the opposite of what the two-plane model is for.

**Revisit when** team configuration can live in the repository, or when the file transport above is
measured to be the bottleneck. Not before. The current transport is slower per clarification and
fully auditable, and auditability is what is being validated on the first tickets.
