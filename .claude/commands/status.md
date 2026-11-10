---
description: Read the board and report what is true, what is waiting on you, and what runs next
---

Run in the **steward session**. **Read only. This command writes nothing** — not `ticket.yaml`, not
`backlog.md`, not the session log.

## What this reads, and why it is not a session monitor

**Each Claude Code session is a separate process. This command cannot see what another session is
doing, and should not.**

That is not a limitation to work around. RULE-13 requires the reviewer to be blind to everything but
files, and a status command that could see into a live `tech-lead-review` session would be a channel
into the one role the model deliberately isolates. The same property that makes cross-session
visibility impossible is the property that makes the review worth running.

What it reads instead is the repository, which is the source of truth anyway. **A session is where
someone is typing; `ticket.yaml` is what is true.** A stage half-finished in an open tab has not
happened. If that feels like missing information, the missing information is the point: an artifact
on disk with a gate in its front-matter is a claim someone committed to, and an in-progress buffer is
not.

**Inputs:**

- every `.ai/board/tickets/*/ticket.yaml`
- `.ai/board/backlog.md`
- `.ai/board/model-debt.md`
- `.ai/steward/context.md`
- the tail of `.ai/board/metrics.md`
- `git log -10`, `git status`
- the front-matter `gate` field of each artifact in the active ticket's folder

## Output — this order, and nothing else

### 1. One line: what is happening right now

`EXA-01 at PLAN, blocked on the seam contract in section 4.`

If nothing is in flight, say so in one line. Do not pad it.

### 2. Board

| Ticket | State | Owner | Gates passed | Rework | Blocked on |
|---|---|---|---|---|---|

Owner comes from the stage ownership table in `.ai/01-operating-model.md`, keyed on state. Gates
passed comes from the `gates` map in `ticket.yaml` — **the `passed: true` entries with timestamps**,
not from the presence of an artifact file.

### 3. Waiting on you

**The important section.** Everything here names an exact action, not a topic.

- anything `ESCALATED`
- any unanswered question in a `99-questions.md` — a block with a `Q.` and no `A.`
- any 🟡 in a story
- any registry paste outstanding, per the session log in `.ai/steward/context.md`

**Empty is a valid and good answer.** Do not manufacture entries to make the section look
substantial. "Nothing is waiting on you" is a real result and the one the loop is supposed to produce.

### 4. Next command

Which slash command, in which session, derived from the state and the lifecycle table in
`.ai/01-operating-model.md`:

```
EXA-01 is READY. Run /implement EXA-01 in a fresh Developer session.
```

**If the next move is a human decision, say that instead** — do not name a command that cannot
usefully run. A ticket at `ESCALATED` has no command; it has a decision.

### 5. Model debt

One line. Open count by severity from `.ai/board/model-debt.md`.

### 6. Since last time

What changed since the last session-log entry in `.ai/steward/context.md`. If the log is empty, say
that this is the first session rather than reporting the whole repository as new.

## Rules for this command

- **Report only what the files say.** Every claim traces to a line you read.
- **If `backlog.md` and a `ticket.yaml` disagree, show both and name `ticket.yaml` as
  authoritative — do not silently reconcile.** Repairing the view is the orchestrator's job, and a
  status command that quietly fixed the disagreement would destroy the evidence that they had drifted.
  The drift is a finding.
- **Never claim a stage ran without a gate timestamp to cite.** An artifact file existing is not a
  gate passing; a `04-review.md` with `gate: FAIL` is a stage that ran and refused.
- Writes nothing, changes no state, and advances no ticket.

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
