---
description: Direct work — plan, implement and report, outside the ticket loop
argument-hint: "[the request, text and/or images; optional if attached to the message]"
---

Dispatch the `solo` agent. It builds what the operator asked for, without the loop.

**This command skips every stage.** No story, no design, no review, no test report, no gate. That is
the point of it, and it is recorded as a deliberate exception in
`.ai/registry/decisions/ADR-033-solo-engineer.md` — not as an oversight.

## The request

**With an argument**, that is the request.

**Bare**, read the request from the attached message — its text, its images, or both. Do not ask the
operator to retype what they already attached.

There is no story and no design here, so **the request is the specification**. If it is ambiguous,
ask before building; one round of questions is cheaper than one wrong implementation.

## Always

**State which files you intend to create or change before changing them.** Not a summary of the
change — the list of paths, one line of reason each. Then wait for confirmation. That confirmation is
the only gate this path has.

**When images are attached, describe them back first** — elements, layout, states, interactions, and
explicitly what the image does not show. There is no reviewer downstream to catch a misread.

## Not this command's job

- **Work that already has a ticket.** If the request names a feature ID with a ticket under
  `.ai/board/tickets/`, say so and stop — that work belongs in the loop, and routing it here to avoid
  the gates is exactly the signal MD-032 exists to watch for.
- **Anything in `.ai/registry/**`.** Read-only to every agent under RULE-01, including the `OTHERS`
  row this command's own work produces. Print it for the operator to paste.
- **Committing.** Leave the tree dirty and name what changed. Merging is human — RULE-09.

## Last step: sign off

**End your reply with the block in `## Replying` (`CLAUDE.md`)**, plus the `OTHERS` row for pasting.
The first line carries the verify result — `pnpm typecheck`, `pnpm lint`, `pnpm test`, all three, run
not recalled. Read the two values rather than recalling them:

```
date '+%Y-%m-%d %H:%M %Z'
git branch --show-current
```
