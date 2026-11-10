# Standing up a project from this kit

This repository is an operating model with no product in it. The lifecycle, the gates, the eighteen
rules, the nine agents, the sixteen commands, the six hooks and the documentation audit all work as
shipped and are tested. What is missing is everything about *your* domain, and it is missing on
purpose: a charter, an invariant or a feature ID inherited from someone else's product is worse than
an empty one, because every agent reads it as true and nothing in the audit can tell that it
describes a different system.

**How to know it is ready.** `node scripts/check-docs.mjs` exits 0 on a fresh clone — it does that
today, with zero tickets — and its three configuration notes go away as you work through the steps
below. When the audit runs clean *and* prints no `note:` lines, the model is configured. Everything
after that is a ticket.

**Do not delete a `TODO(project):` marker without answering it.** They are the only record of what a
template could not know.

---

## Step 0 — the two commands that must work before anything else

```
node scripts/check-docs.mjs
node --test .claude/hooks/tests/*.test.mjs scripts/tests/*.test.mjs
```

The first must exit 0. The second must report 197 passing and 0 failing.

If either fails on an untouched clone, stop and fix that before writing a word of product content.
A guard that has never been observed to fire is not a control, it is a belief about a control — and
the whole point of the audit is that it is the one thing here you did not have to trust.

**The shell expands the test list on purpose.** `node --test <dir>` works on Node 20 and fails on
Node 23; the quoted-glob form needs Node 21 or later. Passing the expanded list works everywhere.

## Step 0.5 — the bootstrap. Already run, and deliberately removed

`scripts/init-project.mjs` ran on 2026-08-31 with `--name "CaleChip" --owner @didi-code0980`. It
stamped the `CLAUDE.md` heading, `@OWNER` in `.github/CODEOWNERS`, and the `name` in `package.json`.
`--prefixes` was not passed, so the feature prefixes are still step 7, by hand.

**The script and its tests were then deleted, and the reason is worth knowing before anyone restores
them.** The bootstrap anchors every edit on a placeholder string that the first run consumes, refuses
a second run, and has no `--force`. Its tests copied the *real repository* as their fixture — on
purpose, so the anchors were checked against the actual files rather than a fixture that would keep
passing after somebody reworded them. The consequence is that those ten tests can only pass **before
the bootstrap has ever been used**: running step 0.5 makes step 0 permanently unsatisfiable.

A red suite that can never go green is worse than no suite, because people stop reading it. So in a
stood-up project the bootstrap is dead code and its tests measure nothing. Both are in the history if
they are ever wanted: `git log -- scripts/init-project.mjs`.

Recorded as **MD-010** in `.ai/board/model-debt.md`, which also carries the fix the *template* needs —
this deletion is right here and wrong upstream.

## Step 1 — the charter. Nothing else can be checked against an absent one

`.ai/00-charter.md`

Write what the system is for, and — the half that earns the file — **what it refuses to do**. A scope
statement expands quietly; a refusal has to be argued with before it can be removed, and the argument
is what surfaces a change of direction.

**Gates on:** nothing. **Gated by:** nothing. It is first because every later step is easier to judge
against it, and because the first three tickets will push against at least one refusal.

## Step 2 — the vocabulary, before any agent starts naming things

`.ai/registry/glossary.md`

Domain nouns whose everyday meaning is wider or narrower than the meaning here, plus the process
terms this repository uses in a specific way. `.ai/standards/coding-standards.md` forbids
abbreviations that are not in this file, which is what makes the list load-bearing rather than
decorative.

**Gates on:** step 1. **Gated by:** every field name a design will contain.

## Step 3 — the invariants. This is the step people skip and regret

`.ai/registry/invariants.md`

Between five and fifteen statements that must hold in every reachable state. The test is whether a
violation means **the data is wrong**, not that a user is inconvenienced. A ledger of forty is a
requirements document wearing the wrong name.

Write the notes section for any invariant whose enforcement is not obvious from its one-line row —
especially the ones held by something weaker than the sentence implies. An invariant claimed and not
held is worse than one never claimed.

**Gates on:** steps 1 and 2. **Gated by:** every `invariants_touched` field, review check R8, and the
audit note that D2 has an empty ledger.

**Nothing enforces this and it still matters:** an ID is never renumbered and never reused. A number
you decide against goes under `## Unissued IDs`, where D2 will let documents cite it and refuse to let
anything use it.

## Step 4 — the architecture, because RULE-02 points at it

`.ai/standards/architecture.md`, then `.ai/standards/data-model.md`,
`.ai/standards/rbac-and-security.md`, `.ai/standards/ui-design-system.md`,
`.ai/standards/integrations.md`

Three things in the architecture file are load-bearing and the rest can wait:

1. **The data-access seam** — one directory, everything that reaches the datastore lives inside it.
   RULE-02 is unenforceable until it is named.
2. **The lint rule** that makes an import from outside the seam a build failure. Record it in the
   enforcement map in `.ai/registry/rules.md` at the same time, or that table is claiming something
   untrue.
3. **Where authorization lives** — one answer, not two.

`rbac-and-security.md` is what review check R6 compares an implementation against, so R6 is
unenforceable until the permission table exists. `data-model.md` is what RULE-04 depends on: the
Developer may not invent a field name, so every name has to exist there or in design section 1 first.

**Gates on:** step 3. **Gated by:** R2, R4, R6, and every design.

## Step 5 — the stack, the commands, and `CLAUDE.md`

`.ai/standards/tech-stack.md` first, then `.ai/standards/testing-standards.md` and
`.ai/standards/coding-standards.md`, then `CLAUDE.md` (Visual direction, the product sentence).

**`tech-stack.md` is the single source for what this project is built with** — language, framework,
datastore, runners, package manager. Every other document cites it. Two rules make it stay true, and
both are in the file: it records **majors, never resolved versions**, because a document that
restates the lockfile is wrong within a week; and it names, explicitly, every dependency that is
**past reliable recall**, which is an instruction to open the real config before writing against it.

`CLAUDE.md` moved to the end of this step on purpose. Its Stack section is now a pointer, so there is
nothing to write there until the file it points at exists.

The single most valuable thing in this step is the **command table** in `testing-standards.md`.
Typecheck, lint, unit and end-to-end are referred to *by role* everywhere else in this kit —
including in the Definition of Done — precisely so that one file knows their names. Fill that table
and a dozen documents become true at once.

Then add the same commands to:

- `.claude/settings.json`, so they stop generating permission prompts
- `REQUIRED_READONLY_ALLOW` in `.claude/hooks/tests/settings-integrity.test.mjs`, **in the same
  commit** — an allow rule the test does not know about is one a clobber can drop silently

**Gates on:** step 4. **Gated by:** IN_PROGRESS, QA, and `/ship`.

## Step 6 — the three constants that assume a directory layout

If the implementation source is not `src/` or the tests are not `tests/`, change exactly three
things and nothing else:

| File | Constant |
|---|---|
| `scripts/check-docs.mjs` | `SCAFFOLD_ROOTS` and `PATH_ROOTS` |
| `.claude/hooks/guard-read-scope.mjs` | `SOURCE_ROOTS` |

These are the only places in the kit that assume where code lives. `guard-read-scope.mjs` is what
holds RULE-05 — if it points at a directory that does not exist, QA can read the implementation and
its gate stops meaning anything.

## Step 7 — the feature registry, and the line that turns D1 on

`.ai/registry/features.md`

Two things, and neither can be guessed:

1. **The group prefixes** — three uppercase letters each, one per coherent area of the product, with
   the expansion written out. Fix the set once; extending it later requires an ADR.
2. **The machine-readable prefix line** in the Group prefixes section. This is what check D1 reads.
   While it is empty D1 checks nothing and says so; the moment it is filled, every document naming a
   feature ID that does not resolve becomes a finding.

Then one section per prefix, each with the row table and no rows. Rows arrive one at a time, from a
human, as ideas are promoted.

**Gates on:** step 3. **Gated by:** Definition of Ready item 1, and `/plan`.

## Step 8 — the repository plumbing

- **`.github/CODEOWNERS`** — replace `@OWNER`. Since ADR-004 this file is the *only* mechanism behind
  RULE-01. Until it names a real reviewer and branch protection requires their review, "the registry
  is human-only" is a sentence with nothing behind it.
- **`.github/workflows/`** — the workflows exist. The required checks are `verify`, `allowed-paths`
  and `mir-tracking`; the settings and the command that applies them are in
  `docs/ops/branch-protection.md`. `build-image` and `release` fail on every run until the four
  secrets, `DEPLOY_REPO_TOKEN` and the variable `DEPLOY_REPO` listed in
  [docs/ops/ci-cd.md § Secrets and variables](docs/ops/ci-cd.md#secrets-and-variables) are added.
  *Until 2026-10-13 this said "two workflows, exactly two status check names: `verify` and
  `allowed-paths`". CICD-02.*
- **Branch protection** — point it at those three names, and **not until `verify` has passed at least
  once.** A required check that has never passed blocks every pull request including yours, and the
  only way out is to disable the protection you just configured.
- **`.gitignore`** — add the build output and anything a generator writes.
- **`.mcp.json` and `.ai/registry/tracker.yaml`** — only if there is a tracker. Fill every ID from
  the tracker's own UI, by ID, never by name. **An empty `allowed_list_ids` blocks every call**, which
  is the correct shipping state; a project with no tracker leaves both alone and never runs
  `/pull-tickets` or `/sync-tracker`.

## Step 9 — the operator preferences

`.ai/steward/context.md`

The standing instructions arrive carrying the origin operator's preferences: decide and report rather
than ask, short while working and complete while deciding, verify before answering, hold the scope
exactly, and conversation in one language with artifacts in English.

**Confirm each one with your operator on the first steward run.** A preference that was never
re-checked is a guess with a citation. If the conversation language differs, two places change and
only two: the Language bullet in that file, and the four labels in the sign-off block in `CLAUDE.md`.

## Step 10 — one working directory

One clone, one dependency install, and every role launched in it.
[ADR-006](.ai/registry/decisions/ADR-006-single-working-directory.md) replaced the three worktrees
this step used to describe.

**Do not symlink the dependency directory.** It passes typecheck, lint and tests and is rejected by
some bundlers outright, so the failure stays hidden until the one command that needs a bundler runs —
and that command is usually `/ship`.

**What replaces the folder check.** `pwd` is now a constant, so the thing to read before the first
instruction of a session is `git branch --show-current` **and `git status`**. A ticket stays
uncommitted from `/plan` to `/ship`, so a dirty tree is not leftover noise — it is somebody's whole
ticket, and `git switch` will carry it onto whatever branch you arrive at.

---

## Ready

```
node scripts/check-docs.mjs
```

Zero errors and **no `note:` lines**. The notes are the checks telling you they are unconfigured; a
clean run with three notes means the audit works and the registry is still empty.

Then, in order: `/triage` in the product session — it writes the idea and rules on it in one run
(ADR-019) — which also writes the feature row and the ticket shell, and then `/plan`
in the BA session.

**The first ticket is the one that finds the problems.** Expect the charter to gain a refusal, the
invariant ledger to gain a note, and at least one `TODO(project):` you thought you had answered to
turn out to be answered wrongly. That is the loop working, not the loop failing — record each one in
`.ai/board/model-debt.md` and fix it between tickets rather than during one.

## What arrives already broken, and is written down rather than hidden

Read the carried-defects section in `.ai/board/model-debt.md` before the first ticket. Seven known
defects arrive with this kit because the code that produces them arrives with it. Two are worth
fixing on day one, while they are still free:

- **`bugfix/` branches run with RULE-03 unenforced.** Both path resolvers hard-code `feat/`. No
  bugfix branch exists yet in a fresh repository, which makes now the cheapest moment.
- **`scripts/check-allowed-paths.mjs` exits 0 on any branch not named `feat/<ID>`**, so ticket work
  committed on an `ops/` branch is never checked.

Also decide, while both files are still empty, whether `.ai/board/model-defects.md` survives beside
`.ai/board/model-debt.md`. The origin project kept both, numbered them independently, and never
merged them — so the same defect existed twice under two IDs and only one copy was ever updated.

## What this kit deliberately does not contain

No product code, no schema, no build configuration, no CI workflow bodies, and no tickets. The three
carried ADRs — the template, bounded agent chat, and the removal of the three file-write guards — are
framework decisions and each says so at the top. Every other decision the origin project made was
about its own domain and did not come along.

Three guards ship **on disk and unwired**, per ADR-004: `guard-project-root.mjs`,
`guard-registry.mjs` and `guard-allowed-paths.mjs`. That is carried forward as it was, not quietly
reversed. Their own tests still pass, so restoring them is one edit to `.claude/settings.json` plus
one list change in `.claude/hooks/tests/settings-integrity.test.mjs`. Read ADR-004 before deciding
either way — it names what the removal bought and what it cost.

**Nothing here has been run end to end in this repository.** The audit passes, all 211 tests pass,
and no ticket has ever moved through this copy of the loop. The first `/plan` through `/ship` is what
turns that from a claim into evidence.
