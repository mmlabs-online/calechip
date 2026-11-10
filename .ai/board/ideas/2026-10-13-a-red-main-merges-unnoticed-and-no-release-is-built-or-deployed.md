---
stage: TRIAGE
agent: product
produced_at: 2026-10-13T08:00:47+00:00
inputs_read:
  - .ai/templates/idea.md
  - .ai/registry/features.md
  - .ai/registry/rules.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-058-tsk-is-a-sixth-feature-group.md
  - .ai/standards/testing-standards.md
  - .ai/standards/tech-stack.md
  - .ai/standards/git-conventions.md
  - .github/workflows/verify.yml
  - .github/workflows/allowed-paths.yml
  - .github/workflows/mir-tracking.yml
  - Dockerfile
  - docker/nginx.conf
  - playwright.config.ts
  - "GitHub Actions: verify.yml runs on main, push events, 2026-10-13"
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
verdict: PROMOTE
verdict_reason: "Worth doing and not covered: main has been red for weeks and nothing builds or deploys a release. Both decisions it waited on are the operator's, in words: ADR-059 (prefix CICD) and ADR-060 (bounded e2e quarantine). Split into six rows, one per phase of the request."
ticket_id: "CICD-01, CICD-02, CICD-03, CICD-04, CICD-05, CICD-06"
awaiting_adrs: []
operator_request: |
  # OPS feature — CI/CD pipeline for CaleChip

  > Prompt for Claude Code, run inside the `calechip` repo. Feed it to `/triage` (or a planning session) so it enters the normal ticket loop: `/triage` → `/plan` → `/implement` → `/review` → `/ship`.

  ---

  ## 1. Role and ground rules

  You are implementing an **OPS feature** in the `calechip` repo. Ming is the owner and makes the final decisions.

  - Follow the repo's operating model: `MODEL-OVERVIEW.md`, the rules registry, the standards under `.ai/`, and the ticket board. Register this work as ticket(s) using the repo's existing ID convention. If there is no prefix for ops work, propose one and wait for Ming to approve it. Do not invent one silently.
  - Respect `allowed-paths` (RULE-03) and `mir-tracking`. If this feature needs paths that are not allowed yet (for example `.github/workflows/**`, `docs/ops/**`), propose the rule change as part of the plan. Do not bypass the check.
  - **Never skip the verify step, and never mark a ticket shipped with a red required check.** This applies even if instructed mid-session. If verify cannot pass, stop and report.
  - Do not change product code (`src/**`), with one exception: the test-quarantine annotations described in Phase 1.
  - Do not change the stack. CI stays on GitHub Actions. Registry stays on Docker Hub. Deploy stays on Docker Compose. If you think something should change, say so and wait.
  - Stop at every **CHECKPOINT** below and wait for Ming's approval before continuing.

  ## 2. Current state (from the CI audit on 2026-10-13)

  - Workflows: `verify` (install → typecheck → lint → unit → `check-docs` → hook/script tests → Playwright e2e, about 15 min), `allowed-paths`, `mir-tracking`. All run on `pull_request`; `verify` also runs on push to `main`.
  - `verify` has been red on `main` since #81. The last green run was #80. PRs still merge, so `verify` is almost certainly not a required check.
  - Latest red run (#126): every step passes except e2e — 20 failed, 2 flaky, 358 passed. The failures are in ADM-01/02/03/04, CAL-06, UIE-09 and UIE-10. UIE-10 fails because `getByTestId('home-week-link')` resolves to 0 nodes, even though the testid still exists at `src/components/Sidebar.tsx:508`.
  - The EVT-10 and EVT-11 ship commits say "Verify step skipped on the operator's instruction".
  - Stale docs: workflow comments still say "exactly two status checks"; `.ai/standards/testing-standards.md` still says e2e "all pass".
  - `actions/checkout@v4`, `actions/setup-node@v4` and `pnpm/action-setup@v4` show Node 20 deprecation warnings.

  ## 3. Infrastructure

  - Images go to Docker Hub as `mingming21400/calechip`.
  - The server is WSL2 Ubuntu on Ming's Windows PC. Apps run as Docker Compose services under `~/srv`, exposed through a Cloudflare Tunnel (`cloudflared` runs in the same Compose network). The server has no inbound access.
  - A separate shared `deployment` repo holds the compose files and env config for **all** apps, not only CaleChip.

  ## 4. Target pipeline

  | Stage | Trigger | Jobs | Blocks merge? |
  |---|---|---|---|
  | Dev feedback | push `feat/**` | lint, typecheck, unit | No |
  | PR gate | `pull_request` → `main` | lint, typecheck, unit, docs audit, hook tests, e2e | **Yes** (required, branch must be up to date) |
  | Main build | push `main` | build image, push `:sha-<short>`, smoke test | No — failure alerts |
  | Release | push tag `v*.*.*` on `main` | promote the existing `:sha` image to `:vX.Y.Z` (no rebuild), open a PR in `deployment` | — |
  | Deploy | merge to `deployment/main` touching the CaleChip path | self-hosted runner: pull, migrate, `compose up` (CaleChip project only), health check, revert on failure | Health check |

  Principles:
  - Build once, then promote by digest.
  - Deploy only merged config.
  - Never deploy `:latest`.
  - Every deploy has a rollback path.
  - Changes are scoped per app inside the shared `deployment` repo.

  ## 5. Phases

  ### Phase 0 — Discovery (read-only)

  Read the following and report back:
  - `.github/workflows/*`
  - `scripts/check-allowed-paths.mjs`, plus the rules registry and the ticket board conventions
  - Dockerfile(s), and whether an image is built today and how
  - The health/readiness endpoint, if one exists
  - How DB migrations run today, and the DB engine in use
  - e2e runtime per spec, to inform sharding

  Then present Ming with:
  1. A short plan.
  2. Ticket breakdown (one ticket per phase is fine).
  3. The answers to the open questions in §6, stated as your assumptions.

  **CHECKPOINT 0.**

  ### Phase 1 — Stabilise the gate

  1. Quarantine each failing e2e test with `test.fixme`, including a comment that references a tracking ticket. Group the tests by suspected root cause rather than one ticket per test. Record them all in a quarantine register (for example `docs/ops/e2e-quarantine.md`) with columns: test, suspected cause, first failing PR, ticket.
  2. For each group, find the first failing PR. Start from #81. Put this finding in the register.
  3. Mark the 2 flaky tests and give them a bounded retry. Do not hide them.
  4. Fix stale docs: the workflow comments, and the results table in `testing-standards.md`.
  5. Upgrade the deprecated actions to their current majors. Check the latest major on each action's releases page first; do not guess.

  Exit criterion: `main` is green.

  **CHECKPOINT 1.** Ming enables the required checks at this point, using the checklist from Phase 2.

  ### Phase 2 — Split CI

  1. Add a `ci-fast` workflow on push to `feat/**` that runs lint, typecheck and unit. It should finish in roughly 3 minutes or less.
  2. Make the PR workflow the full gate.
     - Cache the pnpm store and the Playwright browsers.
     - Shard e2e if Phase 0 showed it helps.
     - Add `concurrency` with `cancel-in-progress` for PRs.
  3. Keep `allowed-paths` and `mir-tracking` unchanged.
  4. Set explicit least-privilege `permissions:` on every workflow.
  5. Produce `docs/ops/branch-protection.md`. It should list:
     - the required checks, by exact job name,
     - "require branch up to date",
     - no direct push to `main`,
     - auto-delete head branches,
     - a ready-to-run `gh api` command.

     Ming applies these settings himself. Do not attempt to change repo settings.

  ### Phase 3 — Build on `main`

  1. Add a workflow that runs on push to `main`.
  2. Build with Buildx and use the GHA cache.
  3. Push the image tagged `:sha-<short>` to Docker Hub. Credentials come from the secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`.
  4. Run a smoke test: start the container and hit the health endpoint.
  5. If no health endpoint exists, stop and propose one as a separate ticket. Do not add it silently.

  ### Phase 4 — Release on tag

  On push of a tag matching `v*.*.*`, the workflow should:

  1. Fail if the tagged commit is not on `main`.
  2. Fail if `:sha-<short>` does not exist in the registry.
  3. Promote the image with `docker buildx imagetools create` to `:vX.Y.Z`. Do not rebuild.
  4. Open a PR in the `deployment` repo:
     - Branch: `release/calechip-vX.Y.Z`.
     - Change only the CaleChip path.
     - Pin the image by version **and digest**.
     - Authenticate with a GitHub App token or a fine-grained PAT stored as `DEPLOY_REPO_TOKEN`, scoped to that repo with contents + pull-requests permissions only.
  5. Create a GitHub Release with generated notes.

  ### Phase 5 — Deployment repo side

  This session only has the `calechip` repo. If the `deployment` repo is not attached, write the following as **drafts** under `docs/ops/deployment-repo/` for Ming to apply. If it is attached, open a separate PR there instead.

  1. **Layout proposal.** One folder per app, for example `apps/calechip/compose.yml` plus an env template. Add CODEOWNERS / path rules so each app can only change its own folder.
  2. **Deploy workflow.**
     - Trigger: push to `main` with paths filter `apps/calechip/**`.
     - Runs on a self-hosted runner on the WSL server. The runner connects outbound only, which works behind the tunnel. Use a label agreed with Ming.
     - Use `concurrency: deploy-calechip`, with no cancel-in-progress.
     - Steps: `git pull` → run migrations (as Phase 0 decided) → `docker compose -p calechip pull && up -d` → health check with retries and a timeout.
     - On failure: revert the deploy commit, push it, and redeploy. Notify on both success and failure.
  3. **Runner setup notes.** Run it as a non-root user and register it to this repo only. Document the security trade-off of a runner on the host machine.
  4. **Secrets.** Env files contain templates only. Real secrets live on the server or in GitHub Environments. Never commit them.

  ### Phase 6 — Verify and document

  1. Do a dry run of each workflow:
     - a test PR,
     - a merge,
     - a pre-release tag such as `v0.0.0-rc.1`,
     - a forced failure of the health check, to prove rollback works.
  2. Write `docs/ops/ci-cd.md`, covering:
     - an overview diagram,
     - each workflow and its trigger,
     - required secrets,
     - how to cut a release,
     - a rollback runbook,
     - "onboarding another app", noting which parts can become reusable workflows later.
  3. Update `MODEL-OVERVIEW.md` and `.ai/` standards wherever they describe CI.

  ## 6. Open questions — confirm in Phase 0 and do not assume silently

  1. **Staging.** Is there a staging environment? Default assumption: no, only the home server. If one exists, push to `main` auto-deploys staging.
  2. **Secrets.** Does the `deployment` repo currently contain real secrets? If yes, flag it as a blocker before Phase 5.
  3. **Migrations.** What is the DB engine and migration tool? Should migrations run as a one-off container before `up`? Are migrations backward compatible, which rollback requires?
  4. **Release cut.** Tag or `release/*` branch? Default assumption: tag. Use a branch only if a hotfix for an old version is needed.
  5. **Versioning.** Who decides the version number? Default assumption: manual tag.

  ## 7. Out of scope

  - Moving to Jenkins or Kubernetes.
  - Changes to auth/SSO.
  - Fixing the quarantined e2e tests themselves. Those are tracked separately.
  - Pipelines for other apps.

  ## 8. Acceptance criteria

  - [ ] `main` is green. Every quarantined test has a ticket and an entry in the register.
  - [ ] Required checks are documented, and Ming has applied them. A PR with a failing check cannot merge.
  - [ ] A push to `feat/**` gets lint/typecheck/unit feedback in roughly 3 minutes or less.
  - [ ] A merge to `main` produces `mingming21400/calechip:sha-<short>` and passes the smoke test.
  - [ ] A tag `vX.Y.Z` promotes the same digest without rebuilding and opens a scoped PR in `deployment`.
  - [ ] Merging that PR deploys only CaleChip. A failed health check reverts and restores the previous version.
  - [ ] No secrets are committed. Every workflow has explicit `permissions:`.
  - [ ] `docs/ops/ci-cd.md` and the rollback runbook exist, and the `.ai/` standards match reality.
---

# A red `main` merges unnoticed, and nothing builds, releases or deploys what was merged

## Problem

*Derived from the request above. The operator stated a solution (a five-stage CI/CD pipeline), not a
problem.*

Today three things are missing or broken:

1. **Nobody is stopped by a failing build.** `verify` has failed on every push to `main` for weeks,
   and pull requests merge anyway. A regression is noticed only when somebody reads the run.
2. **Nothing turns a merge into something runnable.** The repository has a working `Dockerfile`,
   but no workflow builds it, and no image is tagged by commit.
3. **Nothing puts a release on the server.** Deploying to the home server is a manual step whose
   inputs are recorded nowhere, and it has no rollback.

## Who has it

- **The operator (Ming), at every merge.** They are the only person who merges (RULE-09), and
  nothing on the pull request tells them `main` is already red.
- **The operator, at every release.** They build and deploy by hand.
- **Every agent stage that runs the suite**, including `/implement`, `/review` and `/ship`. These
  stages cannot tell a failure they caused from one already on `main`. That is why the EVT-10 and
  EVT-11 ships skipped verification.

## Evidence

**Checked on 2026-10-13 against GitHub Actions and the tree. These are my findings, not quotes.**

- **`verify` on `main` (push events), checked with `actions_list`:** the latest eight runs, from
  `#120` to `#127`, all end in `failure`. `#127` is the EVT-11 merge, run 277. I did not walk back
  to `#80`/`#81`; that part is the operator's audit.
- **The skip is recorded.** The EVT-11 ship commit on `origin/main` contains "Verify step skipped
  on the…". The `features.md` EVT-10 row says *"DoD item 3 not run at /ship: the operator said to
  skip step 1 (verify) for this ship"*.
- **Stale comment in `verify.yml:3`:** *"One of exactly two status checks. Branch protection points
  at the job name below"*. There are three workflows (`verify`, `allowed-paths`, `mir-tracking`).
- **Stale figures in `.ai/standards/testing-standards.md:35-36`:** *"12 files, 202 tests, all
  pass"* and *"171 tests in 18 spec files, all pass"*.
- **The standards forbid skips (`testing-standards.md:227`):** *"A skipped test left in the suite.
  Delete it or fix it; a skip is a passing test that checks nothing."* That bears directly on the
  `test.fixme` quarantine the request asks for.
- **Retries:** `playwright.config.ts:13` sets `retries: process.env.CI ? 1 : 0`, so a bounded CI
  retry already exists.
- **The image already exists:**
  - The `Dockerfile` builds a static Vite bundle and serves it from non-root nginx on port 3000.
  - **`/healthz` already exists** (`docker/nginx.conf`, plus `HEALTHCHECK` in the `Dockerfile`), so
    Phase 3's "stop if no health endpoint" does not trigger.
  - **Every `VITE_*` value is baked in at build time** (header of the `Dockerfile`). One image is
    therefore tied to one Supabase project.
- **Database:** PostgreSQL on hosted Supabase. Migrations are `supabase/migrations/*.sql`, applied
  by a human. RULE-09 says *"Schema changes and PR merges are permanently human."* Several recent
  migrations say in their headers that they are **unapplied**.
- **Deployment target:** `.ai/standards/tech-stack.md` § *Build and deployment* is still
  `TODO(project)`.
- **Branches:** `.ai/standards/git-conventions.md:33` names chore and tooling work `ops/<slug>`,
  and the allowed-paths check is inactive on those branches.
- **Prefixes:** `OPS-001`, `OPS-002` and `OPS-004` are existing ticket IDs that carry registry
  feature IDs from other groups. `OPS` is **not** a feature group. `features.md` § *Group prefixes*:
  *"Extending this set requires an ADR."*
- **Not checked:** e2e runtime per spec, the `deployment` repository (not attached to this
  session), whether that repository holds real secrets, and repository settings such as branch
  protection.

## Impact if ignored

- Every merge adds to a red baseline that nobody can attribute.
- Agent stages keep declaring "verify skipped", so a ticket's Definition of Done item 3 means
  nothing.
- A release stays a hand-built image with no record of which commit and which `VITE_*` values it
  carries, and no rollback.

## Constraints already known

- **RULE-09.** Merges and schema changes are human.
  - A pipeline may not apply `supabase/migrations/*` to the hosted database. The deploy job
    therefore has **no migrate step**: the container is static nginx and holds no database client.
  - Rollback of the app does not roll back the schema. Migrations must remain backward compatible
    with the previous image. That is a convention to write down, not a step to automate.
  - Branch protection and required checks are applied by the operator, never by a workflow.
- **RULE-03, `check-allowed-paths.mjs` and `mir-tracking`.** They stay unchanged, as the request
  says. A ticket that edits `.github/workflows/**` and `docs/ops/**` lists them in its
  `allowed_paths`. No rule changes.
- **The stack stays.** GitHub Actions, Docker Hub `mingming21400/calechip`, Docker Compose behind
  a Cloudflare Tunnel. Only `tech-stack.md` § *Build and deployment* gets filled in, and that is
  standards plane.
- **Build once, promote by digest** works only with one environment, because `VITE_*` values are
  baked into the image. A staging environment would need a second build.
- **The `testing-standards.md:227` refusal** has to be amended before any `test.fixme` lands. See
  ADR-060.
- **No invariant is engaged.** INV-01 to INV-07 concern entries.

## Out of scope

The request's § 7, plus:

- Applying migrations automatically, under RULE-09.
- Changing repository settings from a workflow.
- Writing to the `deployment` repository from this session. It is not attached, so Phase 5 becomes
  drafts under `docs/ops/deployment-repo/`.
- Fixing the quarantined tests.

## Open questions

Each one is answered in the ADR or Status line it names. **Answers 1 and 2 change which tickets
exist and what the test standards permit, so the loop stops on them.**

1. **How is this work filed?** ADR-059: as a seventh feature group (`DLV`, recommended, or `OPS`),
   or as `ops/<slug>` chore work outside the feature registry. The request says *"propose one and
   wait for Ming"*.
2. **May a failing e2e test be quarantined with `test.fixme`**, against `testing-standards.md:227`?
   ADR-060.
3. **Staging:** assumed none, as the request defaults. Confirm.
4. **Secrets in the `deployment` repository:** unknown, because it is not attached. If it holds real
   secrets, that blocks Phase 5, as the request says.
5. **Release cut and version:** a manual `vX.Y.Z` tag on `main`, as the request defaults. Confirm.
6. **Self-hosted runner label:** for the operator to choose. It is not needed until Phase 5.

## Proposed ticket breakdown — issued only after ADR-059

Recorded so the operator can judge ADR-059 against something concrete. These are not IDs.

| # | Phase | Ships | Needs |
|---|---|---|---|
| 1 | Stabilise the gate | Quarantine register, `test.fixme` per group, stale docs, action upgrades | ADR-060 |
| 2 | Split CI | `ci-fast`, full PR gate with cache, concurrency, `permissions:`, `docs/ops/branch-protection.md` | 1 green |
| 3 | Build on `main` | Buildx + GHA cache, `:sha-<short>` to Docker Hub, smoke test against `/healthz` | `VITE_*` and Docker Hub secrets |
| 4 | Release on tag | On-`main` and image-exists guards, `imagetools create`, PR to `deployment`, GitHub Release | `DEPLOY_REPO_TOKEN` |
| 5 | Deployment drafts | `docs/ops/deployment-repo/**`: layout, deploy workflow, runner notes, env template | Q4 |
| 6 | Docs | `docs/ops/ci-cd.md`, runbook, `tech-stack.md` § *Build and deployment* (human) | 2–5 |

---

## Triage verdict — NEEDS-ADR

**Worth doing.** Every claim in the request that I could check on disk or in Actions holds. The
pipeline's shape fits the stack. There is no feature ID to write it against, though, and its first
phase contradicts a standing test standard. Both are the operator's decisions.

- **ADR-059** (`PROPOSED`): how delivery work is filed, and the prefix if it is a group. A new group
  extends a set that *"requires an ADR"*, and the request reserves the choice to Ming.
- **ADR-060** (`PROPOSED`): a bounded e2e quarantine as an exception to `testing-standards.md:227`.
  That amends a human-only standard, so it is the operator's decision.

When neither is `PROPOSED`, the runner re-triages this file. On PROMOTE, `product` writes the rows
and ticket shells from the table above.

**Already answered from the repository, without an ADR:**
- The health endpoint exists (`/healthz`).
- No migrate step, under RULE-09.
- The image is environment-specific (`VITE_*` baked in).

---

## Re-triage verdict — PROMOTE, as `CICD-01` to `CICD-06` — **THIS IS THE LIVE VERDICT**

2026-10-13. The NEEDS-ADR above is left as the record of what was asked.

**The operator's answers, verbatim:**

- To ADR-059 (*"file the CI/CD work as A — `DLV`, B — `OPS`, or C — `ops/<slug>`?"*):
  **"lấy prefix là CICD"**. This is a new group, under the operator's own name. It is the first
  four-letter prefix, so `scripts/check-docs.mjs` D1 and its test were widened in the same change.
- To ADR-060 (*"allow quarantine with a ticket, a register row and a 30-day expiry?"*):
  **"-> đồng ý"**.

**Rows and tickets.** One per phase of the request, as its § 5 allows (*"one ticket per phase is
fine"*), in `features.md` § *CICD — CI/CD*:

| Ticket | Phase | Depends on |
|---|---|---|
| CICD-01 | 1 — stabilise the gate | — |
| CICD-02 | 2 — split CI, branch-protection checklist | CICD-01 |
| CICD-03 | 3 — build on `main` | CICD-01 |
| CICD-04 | 4 — release on tag | CICD-03 |
| CICD-05 | 5 — deployment repository, as drafts | CICD-04 |
| CICD-06 | 6 — verify and document | CICD-02, CICD-03, CICD-04, CICD-05 |

**Still open, and not blocking `CICD-01`:**
- Question 3, staging: assumed none.
- Question 4, secrets in the deployment repository: unknown. This blocks CICD-05 if they are real.
- Question 5, release cut and version: assumed a manual tag.
- Question 6, the runner label: needed at CICD-05.

**Owed to the standards plane**, by ADR-060, before `CICD-01` lands its first `test.fixme`: the
exception sentence at `testing-standards.md:227`, and the corrected figures at `:35-36`. This is
work for a human or `/thuki`, or for `CICD-01`'s own `allowed_paths` if `/plan` puts it there.

---

## Gap check — 2026-10-14, after `CICD-01` to `CICD-06` shipped (#130–#135)

The operator pasted the request again and asked for it to be checked and a new CICD feature created. Against § 8:

| Acceptance criterion | State on 2026-10-14 |
|---|---|
| `main` is green; every quarantined test has a ticket and a register row | Met — `verify` green on `main`; `docs/ops/e2e-quarantine.md` |
| Required checks documented and applied; a failing PR cannot merge | Documented in `docs/ops/branch-protection.md`; **not applied** — `main` reports *Branch not protected* |
| `feat/**` feedback in about three minutes | Met — `ci-fast` 39 s on #134 |
| A merge to `main` produces `:sha-<short>` and passes the smoke test | **Not met** — `build-image` red on every push to `main` at *secrets present*; no Actions secret exists |
| A tag promotes the same digest and opens a scoped PR in `deployment` | Built (`release.yml`); never run — `DEPLOY_REPO`, `DEPLOY_REPO_TOKEN` absent |
| Merging that PR deploys only CaleChip and a failed health check restores | Drafted only; the deployment repository is not attached |
| No secrets committed; explicit `permissions:` | Met |
| `ci-cd.md`, the rollback runbook, and the standards match | Met, except the runner runbook Phase 5 asks for |

**Two new rows, `CICD-07` and `CICD-08`**, in `features.md`: the runner runbook and the `mmlabs-server` label, which CICD-05 drafted as `home-wsl`; and the four dry runs, which CICD-06 deferred until after merge and which are blocked on operator actions.

**Not a ticket — the operator's, outside the loop:** the six Actions secrets, applying `docs/ops/branch-protection.md`, and applying `docs/ops/deployment-repo/**` to the deployment repository.

**A conflict to decide, recorded and not resolved here.** § 1 of the request says *"Never skip the verify step, and never mark a ticket shipped with a red required check. This applies even if instructed mid-session."* All six CICD ships skipped `/ship` step 1 on the operator's instruction, and `CICD-05` shipped with `allowed-paths` red on #134 (the `TopBar.tsx` exception).
