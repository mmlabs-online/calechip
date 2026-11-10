---
doc_version: 2
last_updated: 2026-09-20
governed_by: [RULE-01, RULE-06, RULE-07, RULE-08, RULE-13]
---

# ADR-036 — The loop runs unattended, and the review verdict becomes machine-routable

## Status

`PROPOSED` — 2026-09-20, by the steward, at the operator's instruction to build an unattended loop
runner.

**Not `ACCEPTED`.** This ADR changes the review gate and amends `.ai/registry/rules.md`, both of
which RULE-01 places behind the operator's approval at the pull request. ADR-008 permits an agent to
accept an ADR under its own name; it does not permit one to write `ACCEPTED by the operator`, which
is a claim about a person. The operator asked for the runner to be built; they have not yet seen what
building it required.

**Number.** `ADR-033` is already assigned to two different decisions on disk, and a third,
`ADR-033-solo-engineer.md`, is cited by `/solo` and does not exist. 036 is the next number that is
free under every reading.

## Context

**Today a human is the transport layer.** `/next-ticket` prints *"Run /plan EXA-01 in the
tech-lead-design session"*, and a person reads that line and types it. Everything else in the loop is
already written down: which agent owns which stage, which artifacts it may read, which session it
runs in, how a failure routes. The only undone part is the hands.

Three things were found while reading the loop against the idea of running it without those hands,
and each is a defect that a human reader absorbs without noticing.

### 1. The review verdict named a check number, and the number disagreed with itself

`.ai/01-operating-model.md` has R7 as the invariant check, escalating to a human on first occurrence
(RULE-07), and R8 as the dependency check, routed to `developer` with `rework_count` incrementing.

Four other places said otherwise. `.ai/registry/rules.md` mapped RULE-07 to *"Review check R8"*.
`.claude/agents/tech-lead-review.md` carried a section headed *"R8 is different"* describing the
invariant check. `.claude/agents/orchestrator.md` said *"R8 never enters REWORK (RULE-07)"*. And
`.ai/templates/review-report.md` — the file the reviewer copies from — listed R7 as the invariant
check in its checklist and then, eleven lines below, headed the per-invariant section *"R8 detail"*.

**A person routing from that verdict corrects for it silently.** A script cannot. An invariant
violation reported under the number that the routing table sends to `developer` enters REWORK and
burns a rework cycle, and RULE-07 — *escalates on first occurrence, never enters REWORK* — fails
without anything appearing to go wrong. That is the exact failure the rule exists to make impossible.

Residue of ADR-022, which removed the QA stage and renumbered the checklist. The same removal left
`R1-R9` in two command descriptions, *"all nine pass"* in `/review`'s own reply instructions eight
lines after it says *"R1 through R8"*, and `next_state: QA` in the review template — a value that is
not in the state enum, which a script reading `next_state` literally would have been handed.

### 2. Nothing advanced `ticket.yaml`, and nothing wrote `gates.*`

`.ai/01-operating-model.md` specifies an orchestrator loop that evaluates the Definition of Ready,
sets `state`, and records the gate. `.ai/standards/session-model.md` assigns that work to
`/next-ticket`. `/next-ticket` says, in its own words, *"No file is written and nothing is invoked"*,
and defers to *"the orchestrator loop"* — which existed only as pseudo-code.

The consequences are on disk and were already noticed there. `CAL-10/ticket.yaml` records itself as
*"the eighteenth ticket to go BACKLOG -> REVIEW on disk"*. No command writes `gates.plan` or
`gates.review`, yet `/ship` requires both to be `passed: true` with timestamps and says *"verify
against `ticket.yaml`, not against a summary"* — so on CAL-10 they were backfilled at ship time as an
act of judgement. That backfill is precisely the human step the runner is meant to replace, and a
runner that inherited it would be forging a gate rather than reading one.

### 3. The session lifetimes were a description of good behaviour

RULE-13 requires REVIEW to run in isolated dispatch, files only, no inherited context. The operating
model explains why in terms that are hard to improve on: a reviewer that remembers checking R4 last
time will not really check it again, and the code changed between passes, which is the entire reason
there is a second pass.

But nothing started those sessions. Whether the reviewer was fresh depended on which window a person
typed into. `/review` says *"a fresh session that is discarded after the verdict"* — an instruction
to a human, with no mechanism under it.

## Decision

### The runner is a process launcher, not an orchestrator

`scripts/run-loop.mjs` reads the board, decides the next step in deterministic code, and spawns that
step as **its own top-level `claude` process** with `--agent` and an explicit session id.

**The orchestrator still does not dispatch.** It is one of the agents the runner spawns. The reason
the operating model gives for that rule is unchanged and is in fact the reason this design works: a
subagent cannot open a fresh top-level session, so an orchestrator that dispatched would have to fake
the session boundary. A separate OS process is not a fake boundary. It is the same boundary a human
running the printed command produces, created by a script instead of by hands.

The session policy is therefore enforced rather than described:

| Agent | Policy |
|---|---|
| `orchestrator`, `tech-lead-design` | persistent — one session id, resumed |
| `developer` | one session per ticket, resumed across REWORK, discarded at DONE or ESCALATED |
| `tech-lead-review` | **a new session id every time, under every entry path, asserted in code** |
| `product`, `devops` | fresh per task |

**The runner never commits, pushes, merges, edits `ticket.yaml`, or writes a stage artifact.** It
reads state and starts processes.

### `/advance` is added — the loop step that was specified and never had a file

`.claude/commands/advance.md`. It runs in the orchestrator session, reads the front-matter of the
artifact the last stage produced, and transcribes the gate and the next state into `ticket.yaml`. It
evaluates the Definition of Ready coming out of PLAN. It applies RULE-06 and RULE-08 when recording a
rework.

**It transcribes; it does not judge.** If the front-matter it needs is absent or contradicts itself,
it writes nothing and stops, naming the file and the field. This keeps the reviewer's hands off
`ticket.yaml` — `/review` still writes its verdict into `04-review.md` and nothing else — while
giving the board a writer.

### The review verdict carries routing fields, and routing never reads a check number

`.ai/templates/review-report.md` gains five front-matter fields, filled on every review including a
pass: `verdict`, `failed_checks`, `invariant_violation`, `route_to`, `increments_rework`.

**`/advance` and the runner route on `invariant_violation` and `route_to`.** Never on a number. The
numbers drifted for three weeks across four files and nothing caught it; a boolean named for what it
means cannot drift the same way, because there is no second number for it to disagree with.

`verdict` must equal `gate`. A disagreement voids the artifact and the stage re-runs in a clean
session — a cheap cross-check bought by the one field that is otherwise redundant.

The numbering is also made to agree everywhere, with `.ai/01-operating-model.md` as the source: R7 is
the invariant check, R8 is the dependency check.

### `/ship` is where the unattended run stops, for now

`git push` is deliberately absent from `permissions.allow`, and `.claude/PERMISSIONS.md` gives the
reason: *"every push prompts once. That prompt is the last point at which a human sees a branch name
before history exists."*

That control is not reversed here. Unattended there is nobody to answer the prompt, so the runner
**refuses to start `/ship`** rather than discovering the denial halfway through it — `/ship` commits
at its step 5 and pushes immediately after, so a denial mid-command leaves history written and no
pull request open. The runner stops with the ticket reviewed, its gates recorded, and the two
commands the operator needs to finish it.

Allowing `Bash(git push origin feat/*)` would close that gap and would reverse a documented control.
It is the operator's to decide and wants its own ADR.

## Consequences

**A ticket can go from BACKLOG to a reviewed, gated, committed state with no human in the loop**, and
stops at exactly the points the rules reserve for a person: an invariant violation, a route to a
human, a BLOCKED artifact, an exhausted chat budget, a question addressed to the operator, two failed
rework cycles, and the push.

**RULE-13 stops depending on which window someone typed into.** This is the largest change and it is
not visible in any artifact. The reviewer's independence was previously a property of operator
discipline; it is now a property of how the process was started, asserted by a test.

**`ticket.yaml` becomes true.** `state` passes through `PLAN`, `READY` and `REWORK` for the first
time, and `gates.*` is written by the command that read the gate rather than backfilled by the
command that requires it. Historic tickets keep the gap; nothing rewrites them.

**A third copy of a `ticket.yaml` reader now exists**, in `scripts/lib/ticket-yaml.mjs`, alongside
the inline ones in `scripts/check-allowed-paths.mjs` and `.claude/hooks/guard-allowed-paths.mjs`. The
hook's own comment argues the two should share no library, and the same argument applies to a third
consumer; the cost is that `ticket.yaml`'s shape is now described in three places and nothing checks
that they agree.

**The design's load-bearing assumption was measured on 2026-09-21 and holds.** Everything above
depends on one thing: that a headless `claude` process can be made into a named project agent, with
the project's own commands, settings and CLAUDE.md loaded. It can. The probe was

    claude -p "/next-ticket" --agent orchestrator --setting-sources "user,project,local" --output-format json

and its result carries four separate confirmations: the reply signs off as `orchestrator` in the
CLAUDE.md block format, so the agent definition and CLAUDE.md both loaded; `/next-ticket` resolved
as a project command and produced a correct board report; `"modelUsage"` names `claude-sonnet-5`,
which is the `model: sonnet` in `.claude/agents/orchestrator.md` rather than the session default;
and `"subagent_stats":{"spawned":0}` — **the orchestrator did not dispatch**, which is the rule the
whole arrangement rests on. `permission_denials` was empty.

That run also produced the only cost figure this project has: **$0.2434 for one read-only step**
that wrote nothing. A ticket is up to twelve steps and most are not read-only, so the runner now
passes `--max-budget-usd` on every spawn.

**The runner cannot be exercised end to end today.** All 36 tickets are `DONE` and `backlog.md` is
empty, so there is no ticket for it to carry. The routing, the stop conditions and the session policy
are covered by tests against fixtures; the spawning is not, and will not be until a real ticket
exists.

**Nothing here touches what the product is.** The charter, the invariants and the RBAC model are
unchanged. This ADR is entirely about who types the next command.

## Alternatives rejected

**Dispatch the stages as subagents from one session.** Rejected outright, and it is the reason the
runner is a separate process at all: a subagent inherits its parent's context, so REVIEW would be
isolated only by the agent's willingness to pretend it had not read the conversation. RULE-13 would
go back to being a description.

**Let the runner write `ticket.yaml` itself.** It is the shortest path and it was refused. The runner
would then be granting the gates it also reads, which is the same defect as a reviewer advancing the
board it is judging. `/advance` costs one extra process per stage and keeps the recording step
auditable — it leaves a session, a cost and a reply, the same as every other stage.

**Have `/review` write its own gate into `ticket.yaml`.** Cheaper than `/advance`, and it would
delete the separation `/review` spends four paragraphs defending.

**Fix the numbering and stop there.** The numbering fix alone makes routing correct today and leaves
it one ADR away from drifting again. The boolean is what makes the next renumbering harmless.

## Changed by this ADR

| File | Change |
|---|---|
| `.ai/registry/rules.md` | RULE-07's mechanism cell: `R8` to `R7` |
| `.ai/01-operating-model.md` | The printed instruction is run by a human **or the runner**; `/advance` named as the writer of `state` and `gates` |
| `.ai/templates/review-report.md` | Five routing fields; `R8 detail` to `R7 detail`; `next_state: QA` to `DONE`/`REWORK`/`ESCALATED` |
| `.ai/templates/plan.md`, `.ai/templates/impl-log.md` | ADR-019 section-number residue: `design section 1` is `plan section 4` |
| `.claude/commands/advance.md` | **New** |
| `.claude/commands/review.md`, `next-ticket.md`, `plan.md`, `implement.md` | Fill the routing fields; point at `/advance`; R9 and section-count residue |
| `.claude/agents/tech-lead-review.md`, `orchestrator.md`, `tech-lead-design.md`, `developer.md`, `devops.md` | R7/R8/R9 numbering and the routing prose that a number swap alone would leave wrong |
| `scripts/run-loop.mjs`, `scripts/lib/ticket-yaml.mjs` | **New** |
| `scripts/tests/run-loop.test.mjs`, `scripts/tests/ticket-yaml.test.mjs` | **New** |
| `.claude/settings.json` | `Bash(git pull --ff-only)`. No deny weakened; `gh pr merge` and `git push` untouched |
| `.gitignore` | `.runner/` |
