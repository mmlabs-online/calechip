---
ticket: CICD-02
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-13T14:49:29+00:00
inputs_read:
  - .ai/board/tickets/CICD-02/ticket.yaml
  - .ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-059-delivery-work-is-a-seventh-feature-group.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/steward/context.md
  - .ai/standards/tech-stack.md
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/board/tickets/CICD-01/01-plan.md
  - .claude/agents/devops.md
  - .github/workflows/verify.yml
  - .github/workflows/allowed-paths.yml
  - .github/workflows/mir-tracking.yml
  - .github/scripts/check-mir-tracking.mjs
  - .github/CODEOWNERS
  - scripts/check-allowed-paths.mjs
  - playwright.config.ts
  - package.json
  - SETUP.md
  - "gh api actions/runs/38369706746/jobs — verify on main, #129, per-step timings"
  - "gh api actions/runs/38415644608/jobs — verify on the CICD-01 PR, steps up to install browsers"
  - "gh repo view — visibility PUBLIC, deleteBranchOnMerge false, 2026-10-13"
  - "gh api repos/actions/cache/releases/latest — v6.1.0; action.yml runs node24"
  - "local: pnpm exec playwright test --list --shard=1/2 and --shard=2/2"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CICD-02 — Plan

## 0. Stated first

- **Implementer: `devops`, not `developer`.** ADR-059 § Consequences says `/plan` names which agent
  implements a `CICD` ticket. Every path in § 7 is CI or documentation; none is application code.
- **This design keeps exactly one required gate name from `verify.yml`, and it is still `verify`.**
  `.claude/agents/devops.md:37-41` says *"Exactly two status check names … Do not split into six"*.
  The PR gate below does run as several jobs — that is how it gets parallel e2e shards and caches —
  but branch protection points at one aggregate job named `verify` and never at the others, so the
  thing that sentence protects (one name to configure, independent of how the gate is arranged
  inside) holds. The sentence's literal count ("two") is stale either way, because `mir-tracking`
  exists; `devops.md` is model surface and is `/thuki`'s, named in § 1 Out of scope.

## 1. Problem and scope

**Feature ID, transcribed from `.ai/registry/features.md:254`:**

> | CICD-02 | A push to a feature branch gets lint, typecheck and unit results within about three minutes, and a pull request runs the full gate as named, required checks | CICD | PLANNED | | From `.ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md`, re-triaged PROMOTE on 2026-10-13 after ADR-059 and ADR-060. Phase 2. `ci-fast` on push to `feat/**`; the PR workflow is the full gate with pnpm and Playwright caches, `concurrency`, and explicit least-privilege `permissions:` on every workflow. `allowed-paths` and `mir-tracking` unchanged. Ships `docs/ops/branch-protection.md`; **the operator applies branch protection himself** (RULE-09) — no workflow changes repository settings. |

**Who gains what.** Whoever pushes a `feat/**` branch — today an agent at `/ship`, tomorrow anyone —
gets lint, typecheck and unit results in minutes instead of waiting on a single 16-minute job whose
e2e step dominates it (run 281: 11 min 04 s of 16 min 06 s). The operator, who alone merges
(RULE-09), gets a pull-request gate whose result is one stable, named check that can be made
required — and a written, ready-to-run list of the settings that make it required, so that after
CHECKPOINT 1 a red pull request cannot merge, including theirs. CICD-01 made `main` green; this ticket
makes staying green enforceable.

**In scope** (the request's § 5 Phase 2, and the feature row):

1. `.github/workflows/ci-fast.yml`, new: lint, typecheck, unit on push to `feat/**`.
2. `.github/workflows/verify.yml` reshaped into parallel jobs with one aggregate `verify` job; pnpm
   store cache in every installing job; Playwright browser cache; e2e in two shards; `concurrency`;
   explicit `permissions:`.
3. `allowed-paths.yml` and `mir-tracking.yml`: a `permissions:` block added, nothing else.
4. `docs/ops/branch-protection.md` and the payload it applies, `docs/ops/branch-protection.json`.
5. The stale "exactly two status checks" text that CICD-01 handed on (its § 1 Out of scope):
   `.ai/standards/git-conventions.md:276-284` and `SETUP.md:181-184`.

**Out of scope — and where each goes:**

- **Applying branch protection, auto-delete, or any repository setting.** The operator, by hand,
  from the document (RULE-09; feature row). No workflow and no agent calls a settings endpoint.
- **`.claude/agents/devops.md:37-45`** (*"Exactly two status check names"*, *"`.github/workflows/`
  ships empty"*). Model surface — `/thuki`. This plan's § 0 says why the design does not violate it.
- **`.ai/standards/rbac-and-security.md:314`** cites `verify.yml:39` and `:51`; those line numbers
  move. A line citation in an audit table is a snapshot; nothing here re-points it.
- **`ci-fast` on `claude/**` or any branch other than `feat/**`.** The feature row names `feat/**`.
- **Building, pushing or smoke-testing an image** — CICD-03. **Tags, releases** — CICD-04.
- **Fixing or un-quarantining any e2e test** — the `BUG-nnn` tickets CICD-01 issued.
- **Changing `playwright.config.ts`** (workers, retries, reporter). Sharding is a CLI flag in the
  workflow; the config stays byte-identical.
- **Requiring code-owner review** in branch protection. Open question 1 — the document states the
  conflict and leaves the switch off; the operator decides.
- **`tech-stack.md` § *Build and deployment*** and `docs/ops/ci-cd.md` — CICD-06.

`size_estimate`: **M** — four workflows, two new documents and two stale passages, before any design.

## 2. Acceptance criteria

### 2.0 Facts the criteria rest on

- **Where the time goes** (run 281, `verify` on `main`, #129): install 4 s, typecheck 8 s, lint 6 s,
  unit 7 s, documentation audit 41 s, hook and script tests 3 min 28 s, install browsers 21 s,
  end-to-end 11 min 04 s. The CICD-01 PR run (38415644608) repeats the shape: checkout to unit in
  27 s, hook and script tests 2 min 40 s. So `ci-fast`'s three steps cost well under a minute of the
  three-minute budget, and the PR gate's critical path is e2e.
- **Sharding is safe for the seam guard.** `playwright test --list --shard=1/2` and `--shard=2/2`,
  run locally on 2026-10-13, each list the `seam-guard` project once (194 tests per shard). The guard
  runs in every shard, so a shard cannot run dependent tests with the guard unrun.
- **The repository is public, `deleteBranchOnMerge` is `false`** (`gh repo view`, 2026-10-13).
- **`actions/cache` latest is `v6.1.0`, `runs: node24`** (`gh api`, 2026-10-13). The other three
  majors are CICD-01's verified set: `checkout@v7`, `setup-node@v7`, `pnpm/action-setup@v6`.
- **`mir-tracking` reads the event payload file, not the API**
  (`.github/scripts/check-mir-tracking.mjs:14`, `:52`), and `allowed-paths` only runs `git`
  (`scripts/check-allowed-paths.mjs`). Both need `contents: read` and nothing more.

### 2.1 Criteria

**AC-1 — a push to a feature branch runs `ci-fast`, and only lint, typecheck and unit**
- Given `.github/workflows/ci-fast.yml` at this ticket's head
- When it is read
- Then it triggers on `push` to `feat/**` and on nothing else; it has one job, `ci-fast`; and that
  job's named steps are exactly `lint`, `typecheck`, `unit`, in that order, after checkout, pnpm,
  node and `pnpm install --frozen-lockfile`, with the commands of § 4.1

**AC-2 — `ci-fast` answers within three minutes**
- Given the push of `feat/CICD-02` at `/ship`
- When the `ci-fast` run it triggers completes
- Then it concludes `success`, and its duration from `created_at` to `updated_at` is 3 min 00 s or
  less; the figure is recorded in the ship notes or the PR body

**AC-3 — `ci-fast` does not run where it was not asked to**
- Given `ci-fast.yml`
- When its `on:` block is read
- Then there is no `pull_request`, no `main`, and no branch pattern other than `feat/**`

**AC-4 — `ci-fast` is never confused with the gate**
- Given every workflow file
- When job ids and `name:` values are read
- Then no job outside `verify.yml` is named `verify`, `allowed-paths` or `mir-tracking`, and
  `ci-fast` appears in no required-check list in `docs/ops/branch-protection.md` or `.json`

**AC-5 — the pull-request gate runs every step it ran before, once**
- Given `verify.yml` at this ticket's head and at `origin/main`
- When their named steps are compared
- Then `typecheck`, `lint`, `unit`, `documentation audit`, `hook and script tests` and `end-to-end`
  each appear exactly once in the new file's job set (`end-to-end` once in the matrix job), with the
  same command as before except `end-to-end`, which gains only `--shard=${{ matrix.shard }}/2`; and
  the triggers are unchanged (`pull_request`, `push` to `main`)

**AC-6 — one aggregate job is the gate, and it fails unless everything passed**
- Given the `verify` job in `verify.yml`
- When it is read
- Then it `needs` `static`, `scripts` and `e2e`; runs `if: ${{ !cancelled() }}`; and its only step
  exits non-zero unless all three `needs.<id>.result` values are exactly `success` — so a failed,
  skipped or cancelled upstream job makes `verify` fail, never pass

**AC-7 — the shards together are the whole suite**
- Given the `verify` run on this ticket's pull request
- When the two `e2e (1/2)` and `e2e (2/2)` job logs are read
- Then both conclude `success`, each reports the `seam-guard` project, and their passed + skipped +
  flaky totals sum to the suite's count (the CICD-01 figure was 366 passed, 21 skipped; a count that
  differs is recorded with the reason, not adjusted)

**AC-8 — the pull request's checks are green and named as documented**
- Given this ticket's pull request
- When its checks are listed
- Then `verify`, `allowed-paths` and `mir-tracking` each conclude `success`, and those three strings
  are exactly the required checks in `docs/ops/branch-protection.json`

**AC-9 — the caches are configured and used**
- Given every job in `verify.yml` and `ci-fast.yml` that runs `pnpm install`
- When it is read
- Then `actions/setup-node@v7` carries `cache: pnpm`; and each `e2e` shard caches
  `~/.cache/ms-playwright` under the key of § 4.2, installs browsers with `--with-deps` only on a
  miss and runs `playwright install-deps chromium` on a hit; and the `e2e` job log on this pull
  request shows the cache step either restoring or saving that key

**AC-10 — superseded pull-request runs are cancelled, merges to `main` never are**
- Given `verify.yml` and `ci-fast.yml`
- When their `concurrency:` blocks are read
- Then `verify` groups a pull request's runs by its number with `cancel-in-progress` true for
  `pull_request` events, and gives every `push` run its own group (so no merge to `main` is
  cancelled or dropped as a superseded pending run); `ci-fast` groups by ref and cancels in progress

**AC-11 — every workflow states least privilege**
- Given the four files under `.github/workflows/`
- When each is read
- Then each has a top-level `permissions:` of exactly `contents: read`; the `verify` aggregate job
  has `permissions: {}`; no file contains `: write`, `write-all`, `read-all` or `secrets.`

**AC-12 — `allowed-paths` and `mir-tracking` change by their permissions block only**
- Given `git diff origin/main -- .github/workflows/allowed-paths.yml .github/workflows/mir-tracking.yml`
- When it is read
- Then the only added lines are the § 4.4 block, and no line is removed

**AC-13 — no workflow changes repository settings**
- Given the four workflow files
- When every `run:` is read
- Then none invokes `gh`, `curl` or any `api.github.com` endpoint

**AC-14 — the branch-protection document is complete and ready to run**
- Given `docs/ops/branch-protection.md`
- When it is read
- Then it contains, in the order of § 4.5: the three required checks by exact name and why only
  those three; *require branches to be up to date*; no direct push to `main`, admins included;
  auto-delete head branches; the precondition that `verify` has passed on `main` once; the two
  ready-to-run `gh api` commands of § 4.5 verbatim; a verification command; and how to undo it

**AC-15 — the payload says exactly what the document says**
- Given `docs/ops/branch-protection.json`
- When `node -e "JSON.parse(require('fs').readFileSync('docs/ops/branch-protection.json','utf8'))"` runs
- Then it exits 0, and the parsed object equals § 4.6 field for field

**AC-16 — no standing document claims two status checks**
- Given `.ai/standards/git-conventions.md` and `SETUP.md`
- When each is read
- Then neither contains "exactly two status check" or "Do not split into six"; each names
  `verify`, `allowed-paths` and `mir-tracking` and points to `docs/ops/branch-protection.md`; each
  keeps the old sentence as an *Until 2026-10-13 …* history line; `git-conventions.md`
  `doc_version` is 6

**AC-17 — every action is at its verified major**
- Given every `uses:` line in the four workflows
- When read
- Then each is one of `actions/checkout@v7`, `pnpm/action-setup@v6`, `actions/setup-node@v7`,
  `actions/cache@v6`, and no other action is used

**AC-18 — the refusals of scope**
- Given `git diff origin/main --stat` at this ticket's head
- When it is read
- Then nothing under `src/`, `tests/`, `scripts/` or `.claude/` is touched, `playwright.config.ts`
  is unchanged, and every path is in `allowed_paths` or `.ai/board/tickets/CICD-02/` or the
  ship-owned set

**Invariants touched: `[]`.** INV-01..INV-07 constrain entries and the absence count
(`.ai/registry/invariants.md`). This ticket changes no `src/**`, no seam and no schema; it rearranges
where checks run and documents a repository setting.

**Open questions.**

1. **Code-owner review in branch protection — not blocking.** `.github/CODEOWNERS:9-11` says RULE-01
   has no mechanism until branch protection requires code-owner review. But pull requests in this
   repository are opened under the code owner's own account (`didi-code0980`), and GitHub does not
   let an author approve their own pull request, so `require_code_owner_reviews: true` would block
   every merge. The payload ships it **off** with `required_approving_review_count: 0`, and the
   document states the trade-off. The operator turns it on if pull requests start arriving under
   another account.
2. **Shard count — not blocking.** Two, chosen from run 281's profile, not measured on a green
   suite (§ 8 alternative 3). The `/implement` log records each shard's duration; a third shard is a
   one-character change and no setting changes, because neither shard is a required check.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

*There is no screen in this ticket. The only arrangement it originates is the order of the
branch-protection document's sections (§ 4.5).*

## 3. Permission model

**No product role gains or loses anything.** No route, control, seam function or policy changes;
`.ai/standards/rbac-and-security.md` has nothing to apply and check R6 reads `none`.

The controls this ticket touches are repository controls:

| Action | Who may | Where enforced |
|---|---|---|
| Apply branch protection, auto-delete head branches | the operator only | RULE-09; repository settings, by hand from `docs/ops/branch-protection.md` |
| Merge a pull request | the operator only, and after protection only when `verify`, `allowed-paths`, `mir-tracking` pass on an up-to-date branch | RULE-09; GitHub branch protection, `enforce_admins: true` |
| Push directly to `main` | nobody, after protection — admins included | branch protection |
| A workflow's `GITHUB_TOKEN` | `contents: read`; the aggregate job nothing | `permissions:` in each file |
| Change `.github/**`, `.ai/standards/**` | an agent writes, the code owner approves at merge | `.github/CODEOWNERS` |

**Denied:** no workflow is given a write scope, a secret, or a call to a settings endpoint (AC-11,
AC-13). No agent runs the § 4.5 commands.

## 4. Contract

### 4.1 `.github/workflows/ci-fast.yml` — new, exactly

```yaml
name: ci-fast

# Fast feedback on a feature branch: lint, typecheck and unit, nothing else. Not a required check —
# the pull request's `verify` is the gate, and docs/ops/branch-protection.md names it. CICD-02.
#
# The three commands are named by role in .ai/standards/testing-standards.md. Keep them in step with
# that table and with the `static` job in verify.yml.

on:
  push:
    branches: ["feat/**"]

permissions:
  contents: read

concurrency:
  group: ci-fast-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci-fast:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: lint
        run: pnpm exec eslint .

      - name: typecheck
        run: pnpm exec tsc --noEmit

      - name: unit
        run: pnpm exec vitest run
```

### 4.2 `.github/workflows/verify.yml` — replaced, exactly this shape

Header comment, replacing `:3-4` and keeping `:6-8` (the "do not enable until it has passed once"
paragraph) verbatim:

```yaml
name: verify

# The pull-request gate, and the same gate on every push to main. Branch protection requires ONE job
# from this file: `verify`, at the bottom, which passes only when every other job here passed. The
# other job names — static, scripts, e2e (n/2) — are deliberately not required, so regrouping steps
# or changing the shard count never touches repository settings. The required list is
# docs/ops/branch-protection.md. CICD-02.
#
# Do not enable branch protection until this has passed once. A required check that has never passed
# blocks every pull request, including the operator's, and the only way out is to disable the
# protection just configured.
```

Body:

```yaml
on:
  pull_request:
  push:
    branches: [main]

permissions:
  contents: read

# A pull request's newer run cancels its older one. A push to main gets its own group (run_id), so no
# merge is ever cancelled or dropped as a superseded pending run.
concurrency:
  group: verify-${{ github.event.pull_request.number || github.run_id }}
  cancel-in-progress: ${{ github.event_name == 'pull_request' }}

jobs:
  static:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # The four commands are named by role in .ai/standards/testing-standards.md, which is the only
      # file that knows their invocations. Keep these, end-to-end below, and ci-fast.yml in step with
      # that table.
      - name: typecheck
        run: pnpm exec tsc --noEmit

      - name: lint
        run: pnpm exec eslint .

      - name: unit
        run: pnpm exec vitest run

      - name: documentation audit
        run: node scripts/check-docs.mjs

  scripts:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      - name: hook and script tests
        run: node --test .claude/hooks/tests/*.test.mjs scripts/tests/*.test.mjs

  e2e:
    name: e2e (${{ matrix.shard }}/2)
    runs-on: ubuntu-latest
    timeout-minutes: 30
    strategy:
      fail-fast: false
      matrix:
        shard: [1, 2]
    steps:
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm

      - run: pnpm install --frozen-lockfile

      # Keyed by the installed Playwright version, not the lockfile hash, so an unrelated dependency
      # bump does not throw the browsers away.
      - name: playwright version
        id: pw
        run: echo "version=$(pnpm exec playwright --version | awk '{print $2}')" >> "$GITHUB_OUTPUT"

      - name: cache browsers
        id: pw-cache
        uses: actions/cache@v6
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ steps.pw.outputs.version }}

      # The cache holds the browser binaries, not the OS packages they need, so a hit still installs
      # those.
      - name: install browsers
        if: steps.pw-cache.outputs.cache-hit != 'true'
        run: pnpm exec playwright install --with-deps chromium

      - name: install browser system dependencies
        if: steps.pw-cache.outputs.cache-hit == 'true'
        run: pnpm exec playwright install-deps chromium

      - name: end-to-end
        run: pnpm exec playwright test --shard=${{ matrix.shard }}/2

  verify:
    needs: [static, scripts, e2e]
    if: ${{ !cancelled() }}
    runs-on: ubuntu-latest
    timeout-minutes: 5
    permissions: {}
    steps:
      - name: every gate job passed
        env:
          STATIC: ${{ needs.static.result }}
          SCRIPTS: ${{ needs.scripts.result }}
          E2E: ${{ needs.e2e.result }}
        run: |
          echo "static=$STATIC scripts=$SCRIPTS e2e=$E2E"
          [ "$STATIC" = success ] && [ "$SCRIPTS" = success ] && [ "$E2E" = success ]
```

**Names are the contract.** Job ids `static`, `scripts`, `e2e`, `verify`; the matrix display name
`e2e (1/2)`, `e2e (2/2)`; step names as written. `verify` is the only one any document requires.

**Implementer verifies, does not recall** (`tech-stack.md` § *Versions the model cannot recall*):
that `playwright --version` prints `Version <x.y.z>` on the installed 1.62.1 (adjust the `awk` field
if not, and say so in the impl log); and that `actions/cache@v6`'s `cache-hit` output is still the
string `'true'` on an exact-key hit — from its `action.yml` at `v6.1.0`.

### 4.3 Step order note

`static` keeps the old order (typecheck, lint, unit, documentation audit). `ci-fast` uses the
feature row's order (lint, typecheck, unit). Both orders are deliberate: `verify.yml` is unchanged
where it need not change, and `ci-fast` follows its row.

### 4.4 `allowed-paths.yml` and `mir-tracking.yml` — this block only

Inserted between the `on:` block and `jobs:`, separated by one blank line on each side, identical in
both files:

```yaml
permissions:
  contents: read
```

### 4.5 `docs/ops/branch-protection.md` — new

Front-matter none (it is an ops document, like `docs/ops/e2e-quarantine.md`). Sections, in order:

1. **Title and one paragraph:** what this is (the settings that make the gate required), that the
   operator applies it by hand and no workflow or agent does (RULE-09), and that it was written by
   CICD-02.
2. **Before you apply it:** `verify` must have passed on `main` at least once since CICD-02 merged
   (the aggregate job is new); a required check that has never reported blocks every pull request.
   One command to check it:
   `gh run list --workflow verify.yml --branch main --limit 1 --json conclusion,headSha`
3. **Required checks — exactly three:** `verify`, `allowed-paths`, `mir-tracking`. One line each on
   what it runs. Then: *not* `ci-fast` (push-only, feedback), *not* `static`, `scripts`, `e2e (n/2)`
   (inside `verify`, deliberately unrequired so the gate can be rearranged without touching settings).
4. **The settings,** as a list: require status checks, **require branches to be up to date before
   merging**; require a pull request before merging, 0 approvals; **enforce for administrators**, so
   no direct push to `main` by anyone; no force pushes; no deletions; **automatically delete head
   branches**.
5. **Code-owner review — off, and why:** the § 2.1 Open question 1 text, and the one field to flip
   if that changes.
6. **Apply** — two commands, verbatim, run from the repository root, each valid in PowerShell and in
   bash:
   ```
   gh api --method PUT repos/didi-code0980/calechip/branches/main/protection --input docs/ops/branch-protection.json
   gh api --method PATCH repos/didi-code0980/calechip -F delete_branch_on_merge=true
   ```
7. **Verify it took:**
   `gh api repos/didi-code0980/calechip/branches/main/protection --jq ".required_status_checks"`
   and `gh repo view --json deleteBranchOnMerge`.
8. **Undo:** `gh api --method DELETE repos/didi-code0980/calechip/branches/main/protection`.
9. **What this changes for the loop, in two sentences:** `/ship` still opens the pull request and
   the operator still merges; after this, an expired quarantine row (check D15, ADR-060) or any
   other red check blocks every merge until it is fixed — which is the intent.

### 4.6 `docs/ops/branch-protection.json` — new, exactly

```json
{
  "required_status_checks": {
    "strict": true,
    "checks": [
      { "context": "verify" },
      { "context": "allowed-paths" },
      { "context": "mir-tracking" }
    ]
  },
  "enforce_admins": true,
  "required_pull_request_reviews": {
    "dismiss_stale_reviews": false,
    "require_code_owner_reviews": false,
    "required_approving_review_count": 0
  },
  "restrictions": null,
  "required_linear_history": false,
  "allow_force_pushes": false,
  "allow_deletions": false,
  "required_conversation_resolution": false
}
```

**Implementer verifies against the GitHub REST reference for "Update branch protection"**, not from
memory: that these field names are current, that `checks[].context` without `app_id` is accepted,
and that `restrictions: null` is valid for a personal repository. A field the reference no longer
accepts is corrected and the change recorded in the impl log — never left for the operator to
discover when the command fails.

### 4.7 `.ai/standards/git-conventions.md` — `## Branch protection`

- Front-matter: `doc_version: 5` → `6`; `last_updated` → the implementation date.
- `:276` — *"Points at exactly two status checks: `verify` and `allowed-paths`."* becomes:
  *"Points at exactly three status checks: `verify`, `allowed-paths` and `mir-tracking`. The settings
  and the command that applies them are in `docs/ops/branch-protection.md`, and the operator applies
  them by hand (RULE-09)."* followed by the history line *"Until 2026-10-13 this said "exactly two
  status checks: `verify` and `allowed-paths`" — `mir-tracking` already existed. CICD-02."*
- `:278-280`, the "do not enable until verify has passed" paragraph: unchanged.
- `:282-284`, the `TODO(project): .github/workflows/ ships empty` paragraph: replaced by one sentence
  saying `verify` is the aggregate of the parallel jobs in `.github/workflows/verify.yml`, and
  `ci-fast` is feedback on `feat/**`, not a gate; plus an *Until 2026-10-13* line quoting the TODO's
  first sentence.

### 4.8 `SETUP.md` — Step 8, two bullets

- `:181-182` (*"two workflows, exactly two status check names … Do not split into six. Details in the
  placeholder in that directory."*) becomes: the workflows exist; the required checks are `verify`,
  `allowed-paths`, `mir-tracking`; see `docs/ops/branch-protection.md`. Followed by an
  *Until 2026-10-13* line quoting the old first clause.
- `:183` (*"point it at those two names"*) becomes *"point it at those three names"*. The rest of the
  bullet is unchanged.

## 5. Seam impact

**None.** No file under `src/` changes.

## 6. Schema delta

**`none`.** No migration, policy, trigger or constraint. `requires_adr: true` in `ticket.yaml` refers
to ADR-059, `ACCEPTED by the operator` on 2026-10-13.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".github/workflows/ci-fast.yml"
  - ".github/workflows/verify.yml"
  - ".github/workflows/allowed-paths.yml"
  - ".github/workflows/mir-tracking.yml"
  - "docs/ops/branch-protection.md"
  - "docs/ops/branch-protection.json"
  - ".ai/standards/git-conventions.md"
  - "SETUP.md"
```

**Glossary:** `glossary_owed` is `[]`; no row written.

**Branch:** `feat/CICD-02`, cut from `origin/main` at `9bee3b2`. The CI path guard is active on it.

**`size`: M — 8 paths. `size_estimate`: M. They agree.**

## 8. Rejected alternatives

1. **Keep `verify` one sequential job and only add caches and `concurrency`.** Smallest diff, and
   `devops.md:37`'s "two names" reading stays literally true. Rejected: e2e is 11 of 16 minutes and
   runs after 4½ minutes of unrelated steps, so caching shaves seconds (install is already 4 s) while
   the critical path stays ~16 minutes; the request asks for sharding where Phase 0 shows it helps,
   and run 281 shows it does.
2. **Make each job a required check** (`static`, `scripts`, `e2e (1/2)`, `e2e (2/2)`). The usual
   GitHub shape, no aggregate job. Rejected: matrix job names embed the shard count, so changing
   `2` to `3` would require editing repository settings in lockstep — and a required check that
   stops reporting blocks every pull request until someone notices. The aggregate keeps the required
   list at one stable name per workflow, which is what `devops.md` was protecting.
3. **Four shards, or none.** Four would cut e2e further on a 4-vCPU public runner, but each shard
   repeats install, browser setup and `vite build` (the `webServer` command), so the fixed cost
   grows while the test share shrinks, and no green full-suite timing exists yet to size it against.
   None leaves the critical path where it is. Two is the measured-enough choice; Open question 2.
4. **Run `ci-fast` on `pull_request` too, or put it in `verify.yml`.** Rejected: on a pull request
   `verify` already runs the same three commands in `static`; a second copy doubles minutes for no
   new signal, and placing it in `verify.yml` would make its triggers the gate's.
5. **Apply branch protection from a workflow or a script in this ticket.** Fewer manual steps.
   Rejected outright: the feature row and RULE-09 reserve it to the operator, and it would need a
   token with administration scope in the repository.

## Changelog

- `2026-10-13T14:49:29+00:00` — all sections written; gate PASS. Branch `feat/CICD-02` created from
  `origin/main`. No AC amended after reading the source tree. Raised by `tech-lead-design`.
  Amended by `tech-lead-design`.
