---
description: Build, mark the ticket DONE, and open a pull request
argument-hint: <TICKET-ID>
---

Run in the **orchestrator session** (`.ai/standards/session-model.md`). Nothing is dispatched.

Since ADR-048 this is **the only command in the loop that pushes**, and one of two that commit. Every
`/advance` ends with a checkpoint (`.claude/commands/handoff.md`) that commits the ticket's ship set
on `feat/<ID>` without pushing, so most of the ticket is already in local history when you arrive.
What is dirty is what step 3 writes, plus whatever the last checkpoint left behind.

*Until ADR-048 this paragraph read: "Since ADR-006 this is **the only command in the loop that
commits.** Every stage before it left the tree dirty, so the whole ticket — plan, source, tests, all
three artifacts — is sitting uncommitted when you arrive." CAL-12 lost all of that to one
`git switch` on 2026-10-01.*

**Preconditions — both gates `passed: true` with timestamps:** `plan` and `review`. Verify against
`ticket.yaml`, not against a summary.

*The gate set has changed twice. ADR-019 merged `spec` and `design` into `plan`; **ADR-022 removed
the QA stage and its gate.** A ticket shipped before 2026-09-01 carries four gates and one of TEA-02,
TEA-03 or TEA-04 carries a `qa` gate reading `waived: true`. Do not require either from a ticket
planned after that date, and never write a gate that no stage produces.*

Steps:

0. **Confirm the branch. Mode: stop** — the table in `.ai/standards/git-conventions.md`, *The branch
   check every ticket command runs*. `pwd`, `git branch --show-current`, `git fetch origin --quiet`,
   `git status --porcelain`, then `git switch feat/$ARGUMENTS && git pull --ff-only`.

   **If the branch does not exist, stop and report**; this command never creates one.

   **Expect a dirty tree — that is the normal state here, not a warning sign.** Since ADR-048 the
   `/advance` checkpoints have committed most of the ticket, so it is usually small; before ADR-048
   it was the whole ticket. What you must not find is work belonging to a *different*
   ticket: read `git status` in full and classify every path before staging anything. A file you
   cannot place belongs to a human, not to a guess.

1. Run the project's verify command — typecheck, lint, unit, build — named in
   `.ai/standards/testing-standards.md`. Any non-zero exit stops here. Tạm ignore bước này 
2. Confirm the full Definition of Done in `.ai/01-operating-model.md`, item by item — all five.
   **Item 3 is yours alone since ADR-022**: with no QA stage, `/ship` is the only place the four
   commands are required to exit 0, and step 1 is where you run them.
3. Set `state: DONE`, move the row to `## ARCHIVE` in `backlog.md`, append to `metrics.md`, **and set
   this feature's `Status` to `DONE` in `.ai/registry/features.md`.**

   **This step is the only writer of that column.** In the origin project it had no writer at all for
   two tickets and drifted silently. `Status` means **merged**, not gated — so you are writing the
   value the pull request you are about to open will make true, and a human merging it is what makes
   it so.

   `features.md` is registry plane, and since **ADR-023 it ships on `feat/$ARGUMENTS` with
   everything else** — it is one of the three paths in the *ship-owned set*, exempted by name in
   `scripts/check-allowed-paths.mjs`. It is still a CODEOWNERS path: say so explicitly in the pull
   request body at step 7, file by file. You are recording a state transition so a human can review
   it, not authoring a registry decision — RULE-01 is untouched.

   *This paragraph used to send `features.md` to a second branch and a second pull request. ADR-023
   ended that: a board that records a ship in a different pull request from the ship can be merged
   out of order, and PR #27 and PR #28 demonstrated it.*
4. **Classify the working tree.** `git status --porcelain`, and sort every dirty path against
   `allowed_paths` in `ticket.yaml`:

   - **The ship set — this is what you commit.** A path matching `allowed_paths`; a path under
     `.ai/board/tickets/$ARGUMENTS/`; or one of the three **ship-owned** paths —
     `.ai/board/backlog.md`, `.ai/board/metrics.md`, `.ai/registry/features.md`. Those three are what
     step 3 just wrote, and `scripts/check-allowed-paths.mjs` exempts them **by name** so they can
     ride on the ticket branch (ADR-023).
   - **Everything else — you do not commit it, and you do not branch it.** Model, standards, hooks,
     scripts, tooling, other tickets' folders, any registry path but `features.md`, stray files.

   A path you cannot classify is *everything else*; you never guess it into the ship set. The set is
   three names, not a category — `.ai/board/` is not exempt, `.ai/registry/` is not exempt. Adding a
   fourth is an edit to two arrays plus an ADR, never a decision made here.

   **Everything else stays dirty, and that is the correct outcome.** It is not this ticket's work, and
   `/ship` is not a general-purpose committer. Leave it in the tree and **name every such path in
   your reply**, so the operator can see what is waiting and which session owns it — model and tooling
   work belongs to `/thuki` on an `ops/<slug>` branch, and it goes there in its own session, not here.

   *Until ADR-023 this step produced a second branch and a second pull request. Print only the paths
   you are leaving behind; the commit is the record of the rest.*

   **`metrics.md` and `backlog.md` are yours and only yours.** No other command writes them — see
   *The one surface that still collides* in `.ai/standards/session-model.md`.

5. **Commit the ship set on `feat/$ARGUMENTS`.** Confirm the branch first; if it is anything else,
   stop. `git add` with explicit paths — never `-A`, never `.`. This is the **last** commit the
   ticket gets: whatever of the ship set is still dirty — at least the state transition, the board
   files and the `features.md` row — on top of the checkpoints `/advance` made (ADR-048). Message form per `.ai/standards/git-conventions.md`. Then
   `git push origin feat/$ARGUMENTS`, which prompts.

6. `node scripts/check-allowed-paths.mjs`. It diffs `origin/main...HEAD` — the **whole branch**, not
   your last commit. A FAIL here means the branch carries a file that is neither in `allowed_paths`
   nor ship-owned. **The fix is to take that file back out of the commit**, never to widen
   `allowed_paths` and never to add a name to the ship-owned set.

7. **Open the one pull request against `main`**, body linking `.ai/board/tickets/$ARGUMENTS/`,
   listing both gate timestamps, and naming `.ai/registry/features.md` as a CODEOWNERS path carried
   by this branch (step 3).

   **A ship opens exactly one pull request — ADR-023.** If you find yourself composing a second, stop:
   something is in the commit that step 4 should have left dirty.

   `gh pr create` when `gh auth status` reports a logged-in host. **When it does not, the fallback is
   not an improvisation — it is this, and it counts as step 7 completed:** print a
   `github.com/<owner>/<repo>/compare/main...feat/$ARGUMENTS?expand=1&title=…&body=…` URL with the
   title and body already percent-encoded into it, so the operator lands on a filled form and presses
   one button.

   **Check `gh auth status` before composing either, and never run `gh auth login`.** It is an
   interactive TUI: it waits on stdin for an account, a protocol, and a pasted device code, and from a
   non-interactive session it hangs until it is killed. Authenticating is the operator's to do, once,
   outside the loop.

   **This step failed on every ship that reached it in the origin project** — `gh` not installed,
   then `gh` unauthenticated — and each time the outcome was a ticket marked DONE with an empty PR
   column and a human left to guess the next move. A branch name is not a request; it is homework.
   Check `gh auth status` once, before the first ship, rather than discovering it at the last step.

8. **Retired by ADR-023.** This step cut an `ops/<slug>` branch for everything that was not the
   ticket and opened a second pull request. It no longer exists, and the step number is kept rather
   than reused so that tickets shipped before 2026-09-03 stay readable against the command that
   produced them.

   `ops/<slug>` is unchanged as a branch name — it is simply not `/ship`'s to cut. It belongs to the
   session that did the work, which for model, hooks, standards and tooling is `/thuki`.

9. If `tracker.sync_enabled` is true, push `gate_state` and `pr_url`. If it is false, skip silently —
   that is the expected state for early tickets.

10. **Sign off — and the pull request URL goes above the block**, with any paths step 4 left dirty. The next command and its folder are
    the *Tiếp theo* line of the block in `CLAUDE.md`; the PR link is the one thing a ship produces that
    the operator cannot get anywhere else, so it goes in the prose above it. **Uncommitted paths are
    the second thing**, one line, because nothing else will tell them. Everything else — the gates you
    checked, the files you classified, the commands you ran — stays out. `git show --stat`
    and the ticket folder hold all of it.

    Name the session, not just the command. RULE-13 makes a correct command in a reused session a
    verdict that was not really reached.

11. **Leave the branch where it is.** The pull request is open and the branch belongs to whoever
    merges it. Do not switch away, do not delete it, and do not update local `main` — the next
    `/spec` cuts from `origin/main` and fetches for itself.

    There is nothing to release: with one working directory nothing else is waiting for the name.

**The output is one open pull request. Never two, and never a merge.** ADR-023 makes the count one;
RULE-09 keeps every agent from merging, and `gh pr merge` is denied in settings. Under ADR-067 the
runner merges after you return, in its own code; you never do. **List every ADR accepted by
delegation on this branch (status `ACCEPTED by <agent> under the operator's delegation`) in the pull
request body**, under its own heading. That list is the operator's only view of those decisions
before they merge.

You push here and nowhere else. `/advance`'s checkpoint commits locally (ADR-048); this command
commits what remains, pushes, and opens the pull request. Two things are never yours: `main` as a target, and the merge.

**Definition of Done item 2 — "diff is a subset of `allowed_paths`" — is a statement about the
ticket branch, and since ADR-023 about `allowed_paths` plus the three ship-owned paths** — plus,
since ADR-054, the ticket's own promoting idea file when a session committed an edit to it. That file
passes CI but is still not in the ship set; you do not commit it. It was
written when nothing was ever committed, so it never had to say which branch it meant. It means
`feat/$ARGUMENTS`, and `scripts/check-allowed-paths.mjs` at step 6 is what decides it.
