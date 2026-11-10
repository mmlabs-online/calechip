---
description: The model steward — governance, rules, commands, hooks, checks, and the registry
argument-hint: "[task or question, optional]"
---

Dispatch the `steward` agent. It maintains the operating model; it never does ticket work.

## With no argument, or a free-text question about project state

**Run the `/status` report first, then answer against it.**

"How is the project going", "where are we", "what is blocked", "what should I do next" — all of these
are questions about the board, and the board is on disk. Produce the full `/status` output, then
answer the question in a few lines using what it showed.

**Never answer from memory of a prior session.** A steward session that has been resumed after a gap
holds a picture of the repository as it was when the session was suspended, and the operator has been
working since. Read the files. The one failure mode this rule exists to prevent is a confident,
fluent, out-of-date answer — which is worse than no answer, because it does not look wrong.

After the `/status` output, add:

- open debt items by ID and severity, from `.ai/board/model-debt.md`
- standing instructions currently in force, from `.ai/steward/context.md`
- the last session log entry

Then **wait**. No argument means no task.

## With an argument

Take it as the task. Read `.ai/steward/context.md` first — standing instructions are durable operator
preferences and they apply to this run whether or not the current message repeats them.

## Always

**State which files you intend to change before changing them.** Not a summary of the change — the
list of paths.

**Announce and proceed, everywhere.** The standing instructions in `.ai/steward/context.md` revised
this on 2026-08-23 — *decide and report, do not ask* — and that revision named these four paths
specifically. Announcing intent is not asking permission: state the paths, then act in the same turn.

The four paths below still deserve more care than the rest, and the care is **in what you write, not
in whether you stop**:

| Path | What extra care means here |
|---|---|
| `.ai/registry/**` | Feature rows, glossary and tracker fields: write them freely. `rules.md`, `invariants.md`, `decisions/`: write them only to record a decision the operator made in words you can point at. An ADR marked `ACCEPTED by the operator` that they did not accept is a forged signature, not initiative. `.github/CODEOWNERS` forces their review at merge time regardless |
| `.ai/01-operating-model.md` | Every agent's lifecycle, gates and routing. Cite the line you are contradicting |
| `.ai/00-charter.md` | What the system refuses to do. A change here changes what the product is |
| `.claude/hooks/**` | A weakened guard fails silently. Run `node --test .claude/hooks/tests/*.test.mjs scripts/tests/*.test.mjs` in the same turn, and say the result |

*This table read "stop-and-ask" until the day after the instruction that replaced it. The command
outlived its own policy, which no `/docs-audit` check can catch — none compares a command against
the standing instructions.*

## Landing what you wrote

**Model work goes on `ops/<slug>`, and landing it is three steps.** The third is restoring the
working tree, and it is the one that gets skipped — `.ai/standards/git-conventions.md` §
*Landing `ops/` work while a ticket is in flight* has the procedure and the commands.

Skipping it is not cosmetic. Every role shares one working directory (ADR-006), so files you pushed
stay dirty on whatever `feat/<TICKET-ID>` is checked out, and the next `/review` fails R1 on a ticket
that did nothing wrong. It has happened twice: ADR-042 escaped by luck, ADR-043 did not.

**Before you sign off, run `node scripts/check-carry.mjs <TICKET-ID>` for whatever ticket is in
flight.** Exit 0, or say in the reply what you left dirty and why. A `landed` line means restore; a
`stray` line means the work is on no ref and deleting it loses it.

## Not this command's job

Ticket work. If the answer is "run `/plan EXA-01`", say that and stop — do not run it, and do not
write the artifact yourself. The steward's judgement about a story is worth less than the BA's, and
an artifact written by the wrong agent has a provenance nobody can audit later.

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
