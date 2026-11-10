---
name: handoff
description: Checkpoint a ticket — commit its ship set on feat/<ID>, no push, no pull request
---

# `/handoff` — Antigravity shim

**This file is an adapter, not the command.** The command is `.claude/commands/handoff.md` and that
is its only copy. Nothing below restates it; if this file and that one ever seem to disagree, that one
wins.

1. **Run this only when the person typed `/handoff`.** If you opened this skill on your own
   judgement, stop and ask whether they meant to run it. The loop's commands move tickets, commit and
   push.
2. **If you have not already in this conversation**, read `CLAUDE.md` and § *Standing instructions*
   in `.ai/steward/context.md`.
3. **Read `.claude/commands/handoff.md` and follow it exactly.** Wherever it says `$ARGUMENTS`, use
   the text the person typed after `/handoff` — empty if there was none.
4. **The command was written for Claude Code.** `.agents/rules/claude-md.md` § *What does not carry
   over* says which of its guards, permissions and dispatches do not exist here, and what to do
   instead.
