---
description: Run every stage of one ticket inside this session — subagents for PLAN, IMPLEMENT and REVIEW, this session for /advance and /ship — until a pull request or a stop
argument-hint: "<TICKET-ID>"
---

Run in a **fresh session that acts as the orchestrator** for ticket `$ARGUMENTS`. Modelled on
stoktok's run command: this session drives the loop and dispatches the three stage agents as **subagents**,
so every stage runs with this session's permissions. That is the difference from `/auto`, whose
runner (ADR-036) starts each stage as its own `claude -p` process. Those processes cannot ask for
permission and are refused any command that needs it (run `20261111-023147-54dc40`: `/plan`
was denied `git switch -c feat/CICD-08`).

| | `/auto` (runner) | `/run-ticket` (this) |
|---|---|---|
| A stage runs as | its own `claude -p` process | a subagent of this session |
| Permissions | none can be granted mid-run | this session's |
| Ends at | merge, once `mergeGate` passes (ADR-067) | the open pull request — this command never merges |

## The rules this command keeps

- **You write no stage artifact.** `01-plan.md`, `03-impl-log.md` and `04-review.md` are written by
  the stage agents only. You never edit one to change an outcome.
- **You do exactly what `/advance` and `/ship` say**, by reading `.claude/commands/advance.md` and
  `.claude/commands/ship.md` and following them as the orchestrator. Those two are not dispatched.
- **RULE-13: the reviewer gets files only.** Every `/review` is a **new** `tech-lead-review` subagent
  (never `fork`, never continued with SendMessage), and its prompt is the ticket id and the command
  file, nothing else. You do not summarise the plan, the diff or the implementation for it.
- **RULE-12: you relay no message** between the Developer and the reviewer.
- **RULE-09: no agent merges.** `gh pr merge` stays denied. The run ends at the pull request.
- **One ticket, one branch, one working tree** (ADR-006). You never `git switch` on a dirty tree.

## 0. Preflight — stop and report on any failure

1. `$ARGUMENTS` is a ticket id and `.ai/board/tickets/<ID>/ticket.yaml` exists. Otherwise stop: for a
   new idea, use `/idea` then `/triage`.
2. Read its `state`. `DONE` → stop, nothing to do. `ESCALATED` → stop, it is a human decision.
3. `git fetch origin --quiet`, then `git status --porcelain --untracked-files=all` must be empty.
4. Be on `feat/<ID>` if it exists (locally or on `origin`). Otherwise be on `main` at `origin/main`
   and leave the branch to `/plan` step 0, which is the only command that may create it.

## 1. The loop

Repeat until a stop. At the top of each turn, **re-read `ticket.yaml`** (it is the only state) and pick
the step from this table. It is `nextStep` in `scripts/run-loop.mjs`, which is derived from the
routing tables in `.ai/01-operating-model.md`.

| `state` | Step | Who runs it |
|---|---|---|
| `BACKLOG` | `/plan <ID>`, then `/advance <ID>` | subagent `tech-lead-design`, then you |
| `PLAN` | `/advance <ID>` | you |
| `READY` | `/implement <ID>`, then `/advance <ID>` | subagent `developer`, then you |
| `IN_PROGRESS`, `03-impl-log.md` `gate: PASS` | `/advance <ID>` | you |
| `IN_PROGRESS`, anything else | `/implement <ID>`, then `/advance <ID>` | subagent `developer`, then you |
| `REVIEW`, `gates.review.passed` not `true` | `/review <ID>`, then `/advance <ID>` | **new** subagent `tech-lead-review`, then you |
| `REVIEW`, `gates.review.passed: true` | `/ship <ID>` | you, then stop |
| `REWORK`, `04-review.md` `route_to: developer` | `/implement <ID>`, then `/advance <ID>` | subagent `developer`, then you |
| `REWORK`, `route_to: tech-lead-design` | `/plan <ID>`, then `/advance <ID>` | subagent `tech-lead-design`, then you |
| anything else (`BLOCKED`, `ESCALATED`, `REWORK` with no runnable route) | stop | — |

**How to dispatch a stage.** Use the Agent tool with `subagent_type` set to the agent in the table.
Give it this prompt and nothing more:

> You are `<agent>`, running `/<command> <ID>` for the orchestrator. Read `CLAUDE.md`, the standing
> instructions in `.ai/steward/context.md`, and `.claude/commands/<command>.md`, and follow that
> command exactly with `$ARGUMENTS` = `<ID>`. You are a subagent: you dispatch nothing. The
> orchestrator will run `/advance` after you. End with the sign-off block.

- **Keep the `tech-lead-design` and `developer` agents for the whole run.** Note each one's agent id
  the first time, and on a re-plan or a rework continue that same agent with SendMessage. That keeps
  the persistent sessions of `.ai/standards/session-model.md`. The reviewer is the exception, and is
  new every time.
- Wait for the subagent's result. Do not run anything in parallel: one working tree, one stage at a
  time.

**After every step, check that the board moved.** Compare `state`, `gates.plan`, `gates.review` and
`rework_count` before and after the step and its `/advance`. If none changed, stop. The stage ran but
recorded nothing, usually because it stopped in step 0. Quote its last message.

**Limits.** Stop after 12 steps for this ticket. RULE-06 escalation happens inside `/advance`, which
sets `ESCALATED` on the second failed rework cycle. The next turn of this loop then stops on it.

## 2. When it ends

- **After `/ship`**, `ticket.yaml` is `DONE` and a pull request is open. Read its URL from the
  ticket, or from `/ship`'s own output.
- **On a stop**, nothing is undone. The tree stays on `feat/<ID>`, with whatever the last `/advance`
  checkpoint committed.

## Your reply

Per `## Replying` in `CLAUDE.md`. Above the block, only:

- **how it ended**: the pull request URL, or the stage it stopped at;
- **if it stopped**: what the operator has to decide, quoted from the artifact or the agent's last
  message, and the command that resumes it (`/run-ticket <ID>` again picks up from `ticket.yaml`).

The gate in the first line is the last gate a stage artifact recorded. *Tiếp theo* is the merge of the
pull request by a person, or the decision that stopped the run.
