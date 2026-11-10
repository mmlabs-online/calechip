---
description: Run the DESIGN stage — the Tech Lead writes 02-design.md and fills allowed_paths
argument-hint: <TICKET-ID>
---

> **`/design` is retired — ADR-019.** SPEC and DESIGN were merged into one stage. Run
> `/plan <TICKET-ID>` instead. Kept, not deleted, so tickets shipped before 2026-09-01 stay readable.

Run in the **Tech Lead session**, which is persistent and lives until the end of the run
(`.ai/standards/session-model.md`). You are `tech-lead-design`; nothing is dispatched.

## Step 0 — confirm the branch before writing anything

**Mode: stop.** Run the four reads and follow the table in `.ai/standards/git-conventions.md`,
*The branch check every ticket command runs*. This command may **not** create `feat/$ARGUMENTS`.

```
pwd
git branch --show-current
git fetch origin --quiet
git status --porcelain
```

- Already on `feat/$ARGUMENTS` — proceed.
- Elsewhere or detached, tree clean, the branch exists on `refs/heads` or `refs/remotes/origin` —
  `git switch feat/$ARGUMENTS` (add `-c feat/$ARGUMENTS origin/feat/$ARGUMENTS` when it is
  remote-only), then `git pull --ff-only`.
- Tree dirty — **stop.** Print the paths and say which ticket they belong to.
- **The branch does not exist — stop and report to the operator.** Do not create it. Only `/spec`
  creates a `feat/` branch. Arriving here with no branch means SPEC never ran, or the ID is wrong,
  and the two need different answers. Say which you cannot rule out.

**Artifacts in:** `ticket.yaml`, `01-story.md`, `.ai/registry/**`, `.ai/standards/**`
**Artifacts out:** `.ai/board/tickets/$ARGUMENTS/02-design.md`, plus `allowed_paths` written back
into `ticket.yaml`
**Template:** `.ai/templates/tech-design.md`

**Gate:** all seven sections complete; `allowed_paths` enumerated; `size` set.

`size` is your verdict, counted from the `allowed_paths` you just enumerated — S, M, L or XL. It is a
different field from the BA's `size_estimate`, which gates DoR and is an estimate from the story.
When they disagree the verdict wins, and the gap is worth reporting: a story estimated M that designs
out to L means the story was under-specified, so route it back to `ba` rather than splitting silently.

No source file can be written until this stage fills `allowed_paths` — the guard blocks on an empty
list by design. Section 6 is what RULE-05 makes load-bearing: get it wrong and QA cannot
address the UI at all.

If the ticket needs a schema change, set `schema_delta` and `requires_adr: true`, stop with BLOCKED,
and state the decision needed. A human writes the ADR (RULE-09).

On PASS, set the ticket to `IN_PROGRESS` and **print the next command and its session** — do not
invoke it:

```
DESIGN passed. Run /implement EXA-01 in a fresh Developer session (keep it until DONE or ESCALATED).
```

---

## Last step: sign off

**End your reply with the block in `## Replying` (`CLAUDE.md`).** It is not a footer on the reply —
for most runs it *is* the reply. Do not stop at the step above and leave the operator to work out who
answered, whether it passed, where the repository is, and what runs next.

The *first* line quotes the `gate` from the front-matter you just wrote. *Tiếp theo* names the next
stage command **and the session it belongs in** — RULE-13 makes a correct command in a reused
session a verdict that was not really reached.
Read the two values rather than recalling them:

```
date '+%Y-%m-%d %H:%M %Z'
git branch --show-current
```

A remembered timestamp or branch is the one part of this block that can be wrong while looking right.
