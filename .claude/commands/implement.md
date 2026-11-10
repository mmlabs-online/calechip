---
description: Run the IN_PROGRESS stage — the Developer implements the design
argument-hint: <TICKET-ID>
---

Run in the **Developer session**, on branch `feat/$ARGUMENTS`.

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
- **The branch does not exist — stop and report to the operator.** Do not create it. Only `/plan`
  creates a `feat/` branch. Arriving here with no branch means PLAN never ran, or the ID is wrong,
  and the two need different answers. Say which you cannot rule out.

The story and the design arrive **uncommitted, in the working tree** — since ADR-006 a ticket is
committed once, at `/ship`. Read them from disk; do not expect them in history and do not go looking
for a pushed branch.

A branch that does not exist at all means PLAN never ran. That is not fixed by starting from `main`:
`01-plan.md` would be missing and `allowed_paths` with it, and RULE-03 would then have nothing to
enforce.

 That session is ephemeral but
**survives REWORK** — keep it open until the ticket is DONE or ESCALATED, and re-run this command in
the same session on a rework cycle. Restarting it every cycle would spend the RULE-06 budget
re-deriving the design instead of fixing what the reviewer found
(`.ai/standards/session-model.md`).

**Artifacts in:** `ticket.yaml`, `01-plan.md`, `.ai/standards/**`
**Artifacts out:** code inside `allowed_paths`, and
`.ai/board/tickets/$ARGUMENTS/03-impl-log.md`
**Template:** `.ai/templates/impl-log.md`

**Gate:** the typecheck and lint commands named in `.ai/standards/testing-standards.md` exit 0;
every contract item in plan section 4 is
implemented; `03-impl-log.md` lists every file touched with a one-line reason.

**Run each verify command on its own, in exactly the form named.** Use `node scripts/check-allowed-paths.mjs`,
`node scripts/check-carry.mjs <ID>`, `pnpm typecheck`, `pnpm lint`, `pnpm test`, or the `pnpm exec`
forms in `.ai/standards/testing-standards.md`. One per Bash call. The exit code is in the tool
result, so do not add `; echo "EXIT=$?"`, a `cd`, or a pipe. Under the runner nothing can approve a
prompt, so a compound command is denied even when each part is allowed. That is how MIR-08's first
review lost R1–R3 (run 20261023-065554).

Check the branch first. `guard-allowed-paths.mjs` resolves the ticket from `feat/<ID>`, so work done
on another branch name runs with the path guard inactive.

The Developer may consult `tech-lead-design` by writing
`.ai/board/tickets/$ARGUMENTS/99-questions.md` with `to:` naming the agent. It may not address
`tech-lead-review` or `qa` before their verdicts exist — `chat-guard.mjs` blocks that write
(RULE-12).

**Do not address `99-questions.md` to the operator for a decision you can recommend an answer to.**
Under ADR-067 the runner stops on such a file and nobody is waiting to answer it. Take the option you
recommend, record it under `## Delegated decisions` in `03-impl-log.md`, and continue. Address the
operator only for a fact only a person holds.

On PASS, set the ticket to `REVIEW` and **print the next command and its session** — do not invoke
it:

```
IN_PROGRESS passed. Run /review EXA-01 in a FRESH session, discarded after the verdict.
```

The reviewer's session must be new. It never inherits this one: a reviewer holding the developer's
framing has lost the independence that makes the review worth running, before the first check is
evaluated (RULE-13).

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
