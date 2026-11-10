---
description: Record a finished stage — transcribe its gate and next state into ticket.yaml
argument-hint: <TICKET-ID>
---

Run in the **orchestrator session** (`.ai/standards/session-model.md`). Nothing is dispatched.

**This is the loop step `.ai/01-operating-model.md` has always specified and never had a file for.**
Its pseudo-code reads `read result front-matter / PASS -> t.state = next_state ; FAIL -> REWORK,
route per table`. Until ADR-036 no command did that, so `ticket.yaml` never passed through `PLAN`,
`READY` or `REWORK`, `gates.plan` and `gates.review` were never written by anybody, and `/ship`'s own
precondition — *both gates `passed: true` with timestamps* — could only be met by backfilling it as
an act of judgement at ship time. Eighteen tickets went `BACKLOG -> REVIEW` on disk before this
command existed.

## You transcribe. You do not judge.

**Every value you write is copied from an artifact's front-matter.** You do not read the code, you
do not read the plan's prose, and you do not form a view about whether the work is good. A gate you
granted is not a gate — `.claude/agents/orchestrator.md`.

If the front-matter you need is absent, malformed, or contradicts itself, **write nothing and stop**,
naming the file and the field. A missing field is not a `false`.

## What you read

| Ticket state | Stage that just ran | Artifact you read |
|---|---|---|
| `BACKLOG` | PLAN | `01-plan.md` |
| `READY` | IN_PROGRESS | `03-impl-log.md` |
| `REVIEW` | REVIEW | `04-review.md` |
| `REWORK` | whichever stage was routed to | that stage's own artifact |

**Idempotent.** If `ticket.yaml` already records what the artifact says, report `already recorded`
and write nothing. `/implement` sets `state: REVIEW` itself, so that transition will usually already
be on disk when you arrive; that is not an error.

## What you write

Only `.ai/board/tickets/<ID>/ticket.yaml` and `.ai/board/backlog.md`. Never an artifact, never code,
never `.ai/registry/**`.

**Then one commit — the checkpoint, ADR-048.** You write nothing more, but you persist what the
stage left: see *Last — the checkpoint* below.

### Out of PLAN — `gate: PASS` in `01-plan.md`

1. Set `gates.plan: { passed: true, at: <ISO8601 from `date`> }`.
2. **Evaluate the Definition of Ready**, all six items, from `.ai/01-operating-model.md`. It is a
   mechanical check against `ticket.yaml` and `.ai/registry/features.md`; nothing here is a judgement
   call.
3. All six pass → `state: READY`, move the row to `## READY` in `backlog.md`.
4. Any item fails → `state: BACKLOG`, name the failing item number and its text in your reply, and
   leave the row in `## BACKLOG`. **This is not REWORK and `rework_count` does not move** — nothing
   has been built and the defect is in the specification or the registry.

On `gate: FAIL` or `BLOCKED` in `01-plan.md`, set `state: BACKLOG` and stop; on `BLOCKED` say what
`blocking_reason` holds.

### Out of IN_PROGRESS — `gate: PASS` in `03-impl-log.md`

Set `state: REVIEW`. There is no gate key for IN_PROGRESS; `gates` has exactly two rows, `plan` and
`review`.

### Out of REVIEW — read the five routing fields in `04-review.md`

`verdict`, `failed_checks`, `invariant_violation`, `route_to`, `increments_rework`. The valid
combinations are tabulated in `.ai/templates/review-report.md`.

**Refuse and stop if `verdict` and `gate` disagree.** That artifact is void and the stage re-runs in
a clean session (RULE-13).

**Route on `invariant_violation` and `route_to`. Never on a check number.** The numbers drifted for
three weeks and the drift is why this rule is written down — ADR-036.

| Read | Write |
|---|---|
| `verdict: PASS` | `gates.review: { passed: true, at: <ISO8601> }`. **Leave `state: REVIEW`** — `/ship` is what sets `DONE` |
| `invariant_violation: true` | `state: ESCALATED`. **Never increment.** RULE-07 escalates on first occurrence and never enters REWORK |
| `route_to: human`, or `verdict: BLOCKED` | `state: ESCALATED` |
| `route_to: developer` | `state: REWORK`; `rework_count += 1` when `increments_rework: true` |
| `route_to: tech-lead-design` | `state: REWORK`; **do not increment** — RULE-08, an upstream defect must not burn the Developer's budget |

**After incrementing, apply RULE-06 in the same step:** `rework_count >= 2` → `state: ESCALATED`.
There is no third attempt, and the check belongs here rather than in the next stage's preamble,
because a stage that has already been dispatched has already cost what RULE-06 exists to cap.

## Last — the checkpoint

**After the transition is written, and on every outcome** — PASS, FAIL, BLOCKED, REWORK, ESCALATED,
a DoR demotion, and `already recorded` — run `.claude/commands/handoff.md` steps 0 to 3 for this
ticket. It commits the ticket's ship set on `feat/<ID>` and nothing else; it does not push.

**Skip it only when you stopped without writing** because front-matter was absent or
self-contradictory: the stage re-runs, and a checkpoint of a void artifact is not one.

*Added 2026-10-01 by ADR-048. Until then this command wrote and never committed, and nothing before
`/ship` did — ADR-006's single commit point. CAL-12 lost four artifacts and its source and tests to
one `git switch`, which is the revert condition ADR-006 named.* If the checkpoint stops — wrong
branch, or `check-allowed-paths` FAIL — the transition you recorded stands; say so in your one line
and name what stopped it.

## You do NOT

- **Grant a gate the artifact did not.** You copy `gate`; you never compute it.
- **Edit an artifact.** If `01-plan.md` is wrong, the fix is to re-run PLAN, not to correct the file
  you are reading.
- **Touch `.ai/registry/**`.** RULE-01.
- **Move a ticket to `DONE`.** That is `/ship`'s, and it happens when the pull request is opened.
- **Repair a disagreement by editing `ticket.yaml` to match `backlog.md`.** `ticket.yaml` is
  authoritative; `backlog.md` is the view, and the view is what you fix.

## Your reply

Per `## Replying` in `CLAUDE.md`. One line above the block, naming the transition you recorded, the
artifact you read it from and the checkpoint's short sha (or `nothing to checkpoint`) — or, on a stop, the field that was missing and the file it was
missing from. On a DoR failure, the failing item number and its text; that is the whole value of the
reply and it is what routes the ticket next.
