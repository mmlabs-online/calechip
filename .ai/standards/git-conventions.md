---
doc_version: 6
last_updated: 2026-10-13
governed_by: [RULE-03, RULE-09, RULE-10]
---

# Git conventions

## Line endings

`.gitattributes` sets `* text=auto eol=lf`, with explicit `eol=lf` for `.mjs`, `.md`, `.json`,
`.yaml`, and `.yml`. It should be the first file in a repository, before any other content, so that
nothing is ever committed with the wrong endings.

A system `core.autocrlf=true` does not override it — `.gitattributes` wins per path. Do not configure
an editor or a hook to change this.

This matters more than it looks. CRLF in a `.mjs` file that another tool executes, or in a fixture a
test compares against, produces failures that reproduce on one machine and not another.

## Branches

One branch per ticket. **The name is not decoration** — `.claude/hooks/guard-allowed-paths.mjs` and
`scripts/check-allowed-paths.mjs` both resolve the active ticket by parsing it, and both treat
anything that does not begin `feat/` as chore work and let it through unchecked.

### The four names

| Kind | Pattern | Example | Cut from | Path guard |
|---|---|---|---|---|
| Feature ticket | `feat/<FEATURE-ID>` | `feat/EXA-01` | `origin/main` | **active** |
| Bugfix on a shipped feature | `bugfix/BUG_<FEATURE-ID>_<NN>` | `bugfix/BUG_ORD-01_01` | `origin/main` | inactive |
| Chore, model, tooling | `ops/<slug>` | `ops/single-folder` | `origin/main` | inactive, correctly |
| — | `fix/` | — | — | **retired** |

`<FEATURE-ID>` is a row in `.ai/registry/features.md` and nothing else — RULE-17, and check D1 fails
the audit on an ID that does not resolve. `<NN>` is two digits, sequential per feature, starting `01`.
The bug ID carries its parent feature inside it on purpose: a bug branch that cannot be traced to a
feature is a bug nobody can decide the priority of.

**`fix/` is retired**, replaced by `bugfix/` with a structured ID. It had no ID scheme, so two defects
on the same feature produced two branch names with nothing in common.

**`bugfix/` runs with the path guard disabled, and that is a defect rather than a decision.** Both
resolvers hard-code the string `feat/`. A bugfix branch therefore gets no `allowed_paths` enforcement
at write time and no CI check on the diff — for work that touches shipped code, which is when it
matters most. This is carried from the origin project unfixed, deliberately: the fix is a change to
two guarded files with their own tests, and it is worth reviewing on its own. **No `bugfix/` branch
exists in a fresh repository, which makes the moment you adopt this kit the cheapest one to fix it.**
Record it in `.ai/board/model-debt.md` on day one so it is not discovered by the first hotfix.

### The branch check every ticket command runs

Every command that takes a `<TICKET-ID>` opens with the same four reads, before it writes anything:

```
pwd
git branch --show-current
git fetch origin --quiet
git status --porcelain
```

Then one of two modes. **Which mode a command is in is stated in that command's step 0 and is not the
running agent's to choose.**

| Mode | Commands | When the branch does not exist |
|---|---|---|
| **create** | `/plan` only | `git switch -c feat/<ID> origin/main` |
| **stop** | every other ticket command | **Stop and report to the operator.** Do not create it. |

**Only `/plan` may bring a `feat/` branch into existence.** Every later stage arriving at a missing
branch means something upstream did not happen — PLAN was never run, or the branch was never created,
or the ID is wrong. Creating it there would manufacture an empty branch that looks like progress and
hides which of the three it was.

Common to both modes, in every command:

- **A dirty tree is a stop.** `git switch` carries modified and untracked files onto the branch you
  arrive at, which is how one ticket's artifacts land on another ticket's branch. Print the paths and
  say which ticket they belong to. **One exception, `/plan` only:** the ticket's own triage output —
  the list in `.claude/commands/plan.md` step 0, *carried* — rides onto the new branch, because a
  PROMOTE cannot leave a clean tree before the first `/advance` checkpoint commits anything (ADR-048). It is carried, not committed:
  `/ship`'s ship set is unchanged. *Added 2026-09-22 by `/thuki`, after run
  20260922-142836-510fe05c stopped CAL-11 on its own triage output.*
- **Existence is two refs, not one.** Check `refs/heads/<branch>` and `refs/remotes/origin/<branch>`
  separately. A branch that was pushed and then merged still exists on the remote after the local one
  is deleted, and a branch created locally and never pushed exists only here.
- **Cut from `origin/main`, never local `main`.** No lane checks `main` out, so nothing updates it;
  a branch cut from local `main` looks correct and silently omits everything merged since.

## Commits

**Agents commit in two commands, both keyed to the command rather than to a role, and push in one.**
Stage commands (`/plan`, `/implement`, `/review`) leave the working tree dirty; the commit that
follows each of them is `/advance`'s, not theirs.

**Two commit points per ticket — the checkpoint and the ship.**
[ADR-048](../registry/decisions/ADR-048-handoff-returns-as-a-commit-checkpoint.md) restored `handoff`
as a plain checkpoint after ADR-006's revert condition occurred on CAL-12 (2026-10-01): a whole
ticket, never `git add`ed, lost to one switch from `feat/CAL-12` to `main`.

| Command | Run by | Commits | Pushes |
|---|---|---|---|
| `/handoff`, as the last step of every `/advance` | `orchestrator` | the ship set as it stands — `/ship` step 4's rule — on `feat/<ID>` | **no** |
| `/ship` | `orchestrator` | what remains of the ship set: at least `state: DONE`, the board files, the `features.md` row — then the pull request | yes, and it prompts |

**A checkpoint is not an assertion that the gates passed.** It runs after FAIL and BLOCKED too,
because a failed stage's artifact is the record of why. The pull request, not a commit, is what
claims the ticket is done.

**What ADR-048 does not restore.** Nothing is pushed before `/ship`, so there is still no continuous
integration result until the end, and the clone is still a single point of loss. Both are recorded in
the ADR as open for the operator.

*Until ADR-048 this section read: "**One commit point per ticket, and it is `/ship`.** ADR-006
removed `handoff` along with the three worktrees it existed to serve … Everything a ticket produces
stays uncommitted from `/plan` to `/ship`. There is no intermediate save point." The cost it named
was paid by CAL-12.*

**The dirty-tree stop above stays.** With checkpoints, at most one stage's work is uncommitted at a
time — still enough to lose, and `git switch` still carries modified and untracked files onto
whichever branch is arrived at. Carried paths outside the ship set, such as the idea file, are not
covered by any checkpoint (MD-042).

**RULE-09 is unchanged and needs no ADR to permit this.** It names schema changes, ADRs, registry
edits and PR merges. Committing was never among them — the prohibition lives here, in a standard, and
it is this standard that carries the exception. Recorded because the shape recurs: a belief about
what a rule says, held confidently by every document that cites it, and contradicted by the ledger.

### What the orchestrator decides

How the work is grouped at `/ship`. The checkpoint is one commit with a fixed message form —
`.claude/commands/handoff.md`. At `/ship` it classifies the working tree, chooses which files form one coherent
change, how many commits there are, and what each message says. That judgement is its own and this
document does not constrain it.

### What it does not decide

**What may go on the branch at all, because CI is branch-scoped and not commit-scoped.**
`scripts/check-allowed-paths.mjs` computes its diff as `origin/main...HEAD` — the whole branch.
Splitting out-of-scope work into separate *commits* on `feat/<TICKET-ID>` therefore buys nothing: the
`allowed-paths` check still sees every file on the branch, fails, and branch protection then blocks
the very merge a human is meant to perform.

**A ship is one branch and one pull request** —
[ADR-023](../registry/decisions/ADR-023-one-pull-request-per-ship.md).

| Set | Contents | Branch | Result |
|---|---|---|---|
| Ship | paths matching `allowed_paths`, plus `.ai/board/tickets/<TICKET-ID>/**`, plus the ship-owned set | `feat/<TICKET-ID>` | the ticket's pull request — the only one |
| Everything else | model, standards, hooks, scripts, tooling, any registry path but `features.md` that `allowed_paths` does not name — `glossary.md` is in the ship set when PLAN listed it (ADR-047) | not committed by `/ship`; left dirty | the session that wrote it lands it on `ops/<slug>` |

**The ship-owned set is exactly three files** — `.ai/board/backlog.md`, `.ai/board/metrics.md`,
`.ai/registry/features.md`. They are what `/ship` step 3 writes, they sit outside every ticket's
`allowed_paths`, and `scripts/check-allowed-paths.mjs` exempts them **by name** so they can ride on
the ticket branch. It is three names and not a category: `.ai/board/` is not exempt and
`.ai/registry/` is not exempt, and a fourth name is an edit to that array plus an ADR.

**Since ADR-041 review check R1 exempts the same three names, plus the ticket folder.** Until then
the exemption was CI's alone, and a reviewer reading this section correctly concluded so — CAL-11's
review cites these lines for exactly that, then failed R1 on the `backlog.md` write that `/triage`
and `/advance` make on every ticket. Two readers of one diff now reach one verdict.

**Since ADR-054 both readers also exempt the ticket's own promoting idea file — committed on the
ticket branch, not shipped by it.** "Own" is `isOwnIdea` in `scripts/lib/entry.mjs`, the predicate
`planCarry` uses: the idea's `ticket_id` names the ticket (a split PROMOTE's `"A-01, A-02"` names
both), or the ticket's `ticket.yaml` cites the idea's path. It is not a category — every other idea
file is a violation, and so is deleting the ticket's own. **The ship set above is unchanged:** `/ship`
and `/handoff` still do not commit the idea file, so a session that records an operator answer in it
commits that edit itself (MD-042, MD-043). The exemption makes such a commit pass; it does not make
it happen.

*Before ADR-023 those three went to a second `ops/` branch and a second pull request. The cost was
demonstrated rather than argued: PR #27 and PR #28 had to be merged together, or the board claimed a
ship that `main` did not carry.*

Committing `features.md` on the ticket branch is not a rule being bent. `.github/CODEOWNERS` requires
human review on the registry, the standards, `.claude/`, `.github/` and `.mcp.json`. That is what
makes recording such a change safe to automate: the orchestrator records it, a human still approves
it. **Recording is not authoring.** RULE-01 governs who *writes* the registry, and that is untouched
by this exception.

**`ops/<slug>` is unchanged as a branch name, and it is no longer `/ship`'s to cut.** Model, hook,
standards and tooling work goes there in the session that produced it — `/thuki` for the model — and
is never folded into a ticket's ship.

#### Landing `ops/` work while a ticket is in flight — the step that is always forgotten

**Under ADR-006 every role shares one working directory, so steward work is written into the same
tree a ticket is living in.** Pushing it to `ops/<slug>` does not remove it from that tree: the files
stay modified or untracked on `feat/<TICKET-ID>`, and `scripts/check-carry.mjs` correctly calls them
stray, which fails R1 on a ticket that did nothing wrong.

**So landing is three steps, not two, and the third is not optional:**

1. Build the branch **without moving `HEAD`**. A `git switch` on a tree holding an uncommitted ticket
   is the loss ADR-006 names. Use plumbing against `origin/main` — `git hash-object -w`, a throwaway
   `GIT_INDEX_FILE`, `git write-tree`, `git commit-tree`, `git update-ref` — then push and open the
   pull request.
2. **Verify the content is on the pushed branch** before touching the tree: `git hash-object <path>`
   against `git ls-tree <branch> -- <path>` for every file. Nothing below is safe until this passes.
3. **Restore the working tree to `HEAD`.** `rm` the files the work created, `git checkout --` the
   ones it modified. `node scripts/check-carry.mjs <TICKET-ID>` must return to exit 0.

**Step 3 restores rather than waits for a merge.** Syncing the ticket branch also clears the tree,
but only after a human has merged the pull request — which leaves the ticket blocked in the meantime,
for no reason, since the content is already safe on a pushed branch. Restore now; the ticket branch
picks the work up from `main` at its own next sync.

*Written 2026-09-23 after it cost two reviews. ADR-043's own landing (PR #93) left all nine of its
files dirty on `feat/CAL-11` and failed that ticket's R1 a second time; ADR-042 (PR #92) escaped only
because an unrelated `git switch` happened to clean the tree. Both were the steward's, and the
steward is the role this happens to most, because it is the one that works on the model while a
ticket is running.*

Two limits are not the orchestrator's to weigh:

- **`main` is never a commit or a push target.** `git push origin main` and `git push --force` stay
  denied in settings.
- **No agent merges.** RULE-09. `gh pr merge` stays denied to every agent. The runner's own code
  merges after its merge gate passes — ADR-067.

`git push origin feat/*` is on the allow list since ADR-067. *Until then: "`git push` is deliberately
absent from the allow list, so every push prompts once. That prompt is the last point at which a human
sees a branch name before history exists."*

### The second exception: a direct instruction

**Any agent may commit and push when the operator instructs it to, in that session, for that work.**
The authorization is the instruction; it does not generalize to the next run, and no agent infers it
from having been given it before.

This is stated rather than left implicit because the alternative is worse in both directions.
Unstated, it makes the first paragraph of this section false the first time an operator says "commit
this" to anything but the orchestrator — and a standard that everyone routinely violates stops being
read as a standard. Stated too broadly, it becomes the exception that swallows the rule. So it is
narrow on purpose: an instruction, in the session, for the work in front of it. Two things it never
grants, because they are not this document's to grant: a merge (RULE-09) and a write to
`.ai/registry/**` (RULE-01).

Work that is not a ticket does not go on `feat/<TICKET-ID>` — that name activates the path guard
against a ticket the work has nothing to do with. Chore work is `ops/<slug>`.

The message references the ticket ID and the stage, whoever writes it:

```
<TICKET-ID>: implement the order list read path

Design contract items 1-4. Files listed in 03-impl-log.md.
```

## Pull requests

`/ship`'s terminal output is an **open pull request**, never a merge. Under RULE-09 v3 a pull request
is merged by a person, or by `scripts/run-loop.mjs` itself once `mergeGate` passes (ADR-067). The
gate is every reported check green; when no check reports, it is local typecheck, lint and unit
exiting 0. *Until 2026-10-23: "Per RULE-09, merges are permanently human."*

`/ship` runs the build, marks the ticket DONE, and opens **one** PR with `gh pr create` — ADR-023.
`gh pr merge` is in the settings deny list, so an agent that tries to merge is blocked rather than
trusted not to.

The PR body links the ticket folder, lists the gate timestamps, and names `.ai/registry/features.md`
as a CODEOWNERS path the branch carries.

## Protected operations

Denied in `.claude/settings.json`:

- `git push --force`
- `git push origin main`
- `git reset --hard`
- `gh pr merge`

`git reset --hard` is denied because an agent recovering from a confusing state will reach for it,
and the state it discards includes the artifacts that explain how the confusion happened.

## Branch protection

Points at exactly three status checks: `verify`, `allowed-paths` and `mir-tracking`. The settings
and the command that applies them are in `docs/ops/branch-protection.md`, and the operator applies
them by hand (RULE-09).
*Until 2026-10-13 this said "exactly two status checks: `verify` and `allowed-paths`" — `mir-tracking`
already existed. CICD-02.*

**Do not enable it until the `verify` workflow has passed at least once.** A required check that has
never passed blocks every pull request, including the operator's, and the only way out is to disable
the protection you just configured.

`verify` is the aggregate job of the parallel jobs in `.github/workflows/verify.yml`, and `ci-fast`
is feedback on push to `feat/**`, not a gate.
*Until 2026-10-13 this said "TODO(project): `.github/workflows/` ships empty in this kit." CICD-02.*

## CODEOWNERS

`.github/CODEOWNERS` requires human review on `.ai/registry/`, `.ai/standards/`, `.claude/`,
`.github/`, and `.mcp.json`. These are the paths where RULE-01 and RULE-09 apply, and CODEOWNERS is
the mechanism that makes them apply to a pull request rather than only to a hook.

TODO(project): add the schema directory to that list once the datastore is chosen. A migration is
RULE-09 human, and CODEOWNERS is where that becomes true of a pull request.

## Git is the source of truth

RULE-10. The tracker mirrors state and is never read back to decide what happens next. A ticket's
state is what `ticket.yaml` says on disk, not what a tracker status field says.
