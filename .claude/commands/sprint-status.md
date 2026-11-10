---
description: Render the board from every ticket.yaml
---

Dispatch `orchestrator` in report-only mode. **No file is written.**

Read every `.ai/board/tickets/*/ticket.yaml` and render:

| Ticket | State | Size | Rework | Gates passed | Chat used | Blocked on |
|---|---|---|---|---|---|---|

Then report, in this order:

1. **Escalations.** Any ticket in `ESCALATED`, with its `blocking_reason`. These come first because
   they halt rather than queue.
2. **WIP** against the limit, counting states PLAN through REVIEW.
3. **Drift.** Any disagreement between `backlog.md` and a `ticket.yaml`. `ticket.yaml` is
   authoritative; name what would be repaired, but do not repair it here.
4. **Budget pressure.** Any `chat_budget` pair at or near its maximum — a pair that always exhausts
   its budget is negotiating rather than clarifying.
5. **DoR failures** among tickets sitting in READY.

This is a read of the board plane. It does not change state, dispatch a stage, or touch the tracker.

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
