---
trigger: always_on
description: "CaleChip's project instructions are CLAUDE.md, inlined here, plus what does not carry over from Claude Code to Antigravity."
---

# Project instructions: `CLAUDE.md`

This repository is driven from Claude Code. Its instructions are written once, in `CLAUDE.md`, and
are inlined at the end of this file. **Treat them as this project's instructions in full** — they are
not advice for a different tool. Where they name a Claude Code mechanism, the section below says what
that means here.

**Before your first reply in a conversation, also read § *Standing instructions* in
`.ai/steward/context.md`.** `CLAUDE.md` requires it of every agent. It is not inlined because the file
is far past the 24,000-byte rule limit.

The slash commands are in `.agents/skills/<name>/SKILL.md`, one per live command in
`.claude/commands/`. Each is a pointer to the command file, never a copy. `/spec`, `/design` and `/qa`
are retired and deliberately have none.

## What does not carry over from Claude Code

Antigravity reads nothing under `.claude/`. Four things the commands assume are therefore absent, and
a command will not tell you so, because it was written where they exist.

- **The deny list in `.claude/settings.json`.** Claude Code refuses `git push --force`,
  `git push origin main`, `git reset --hard` and `gh pr merge` outright. Here nothing refuses them.
  **Never run any of the four.** RULE-09 (humans merge) is otherwise enforced only by whatever branch
  protection GitHub has applied (`.ai/standards/git-conventions.md` § *Branch protection*).
- **The hooks in `.claude/hooks/`.** None run: `chat-guard`, `guard-read-scope` and
  `guard-tracker-scope` are wired in Claude Code and are not wired here. `.claude/PERMISSIONS.md` §
  *Hooks* says what each one guards.
- **Agent dispatch from `.claude/agents/`.** Where a command says *Dispatch `<agent>`*, read
  `.claude/agents/<agent>.md` and work as that role yourself, and use that name in the sign-off. Its
  `tools:` restriction is not enforced here; hold to it anyway. RULE-13 still applies: **run `/review`
  in a new conversation**, never one that ran an earlier stage of the same ticket.
- **The tracker server in `.mcp.json`.** Antigravity does not load it. `/pull-tickets` and
  `/sync-tracker` have no tracker tools here: stop and say so rather than improvising one.

**RULE-03 is not weakened by any of this.** Its hook is unwired in Claude Code too (ADR-004). It is
enforced by review check R1 and by `scripts/check-allowed-paths.mjs` in CI, and both still run on
work done here.

**`/auto` and `node scripts/run-loop.mjs` start Claude Code, not Antigravity.** The runner spawns the
`claude` binary for every stage. It needs that CLI installed and signed in, and the stages it runs have
every guard above.

**`/plan` is also an Antigravity built-in.** Whether the workspace skill or the built-in answers
`/plan` is TODO(verify) — the docs rank a workspace skill above a built-in *skill*, and do not say
whether the built-in `/plan` is one. If the person typed `/plan <TICKET-ID>` and you are not
following `.claude/commands/plan.md`, stop and say so. *"Run the `plan` skill for `<TICKET-ID>`"*
names the workspace skill without ambiguity.

---

@[CLAUDE.md](../../CLAUDE.md)
