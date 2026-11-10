---
description: Report the next actionable ticket without starting it
---

Run in the **orchestrator session — the lead session**, in report-only mode. The orchestrator is not
a subagent and does not invoke a stage owner; see `.ai/standards/session-model.md`.

**Input:** every `.ai/board/tickets/*/ticket.yaml`, plus `.ai/board/backlog.md`
**Output:** a report to the operator. **No file is written and nothing is invoked.**

## Where the gate sits

`BACKLOG -> PLAN -> [DoR] -> READY -> IN_PROGRESS`

**PLAN runs directly out of BACKLOG. DoR is evaluated at the PLAN to READY transition, not before
PLAN.** Two of its six items — `invariants_touched` and `size_estimate` — are produced at PLAN, so a
gate ahead of PLAN would be asking for fields that do not exist yet. A ticket at BACKLOG is therefore
*not* required to pass DoR to be dispatched; it is required to pass DoR to leave PLAN.

This is the third placement of this gate. The first two put it ahead of its own inputs; check D13
exists so a fourth attempt fails loudly instead of deadlocking the board.

## Report

1. **The next actionable ticket**, which is whichever comes first:
   - the top row of `## READY` in `backlog.md` whose state is not `DONE` — ready to design; or
   - the top row of `## BACKLOG` — ready to specify
2. For a ticket at **PLAN or later**, its full Definition of Ready evaluation, item by item, pass or
   fail, naming the producing stage of any item that fails
3. For a ticket at **BACKLOG**, only the items produced at BACKLOG — items 1, 3, 4 and 6. Do not
   report items 2 and 5 as failures: the BA has not run, and reporting an unwritten field as a defect
   trains the reader to ignore this section
4. Any ticket in `ESCALATED` — these halt the loop and are reported first
5. Current WIP against the limit
6. Any disagreement between `backlog.md` and a `ticket.yaml`, naming which is authoritative
   (`ticket.yaml` always is)

Do not demote a ticket here. **`/advance <ID>` is the command that changes state** — it reads the
last stage artifact’s front-matter and transcribes the gate and the next state into `ticket.yaml`
(ADR-036). This command reports; it writes nothing.

## Finish

**Print the next command and the session it belongs in**, exactly one line:

```
EXA-01 is at BACKLOG and its BACKLOG-produced DoR items pass. Run /plan EXA-01 in the Tech Lead session.
```

```
EXA-01 is READY. Run /implement EXA-01 in a fresh Developer session.
```

If nothing is runnable, say what is blocking instead. Never invoke the stage owner — a printed
instruction the operator runs is a real session boundary, and that boundary is what RULE-13 relies
on.

Definition of Ready is in `.ai/01-operating-model.md`. Session lifetimes are in
`.ai/standards/session-model.md`.

---

## Last step: sign off

**End your reply with the block in `## Replying` (`CLAUDE.md`).** It is not a footer on the reply —
for most runs it *is* the reply. Do not stop at the step above and leave the operator to work out who
answered, whether it passed, where the repository is, and what runs next.

This command writes no artifact and passes no gate, so the first line ends `gate n/a`. *Tiếp theo* names
whatever the board says runs next, **with the session it belongs in** — not a topic, a command.
Read the two values rather than recalling them:

```
date '+%Y-%m-%d %H:%M %Z'
git branch --show-current
```

A remembered timestamp or branch is the one part of this block that can be wrong while looking right.
