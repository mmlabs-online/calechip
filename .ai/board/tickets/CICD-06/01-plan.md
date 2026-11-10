---
ticket: CICD-06
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-14T07:09:41+00:00
inputs_read:
  - .ai/board/tickets/CICD-06/ticket.yaml
  - .ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-059-delivery-work-is-a-seventh-feature-group.md
  - .ai/templates/plan.md
  - .ai/steward/context.md
  - .ai/standards/tech-stack.md
  - .ai/standards/git-conventions.md
  - .ai/board/tickets/CICD-05/01-plan.md
  - .github/workflows/verify.yml
  - .github/workflows/ci-fast.yml
  - .github/workflows/allowed-paths.yml
  - .github/workflows/mir-tracking.yml
  - .github/workflows/build-image.yml
  - .github/workflows/release.yml
  - docs/ops/branch-protection.md
  - docs/ops/deployment-repo/README.md
  - Dockerfile
  - .gitignore
  - MODEL-OVERVIEW.md
  - SETUP.md
  - "GitHub Actions and repository API, read-only, 2026-10-14: gh run list; gh run view 38524736841 --log-failed; actions/secrets total_count; actions/variables total_count; branches/main/protection"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CICD-06 — Plan

## 0. Stated first

- **The implementer is `devops`, not `developer`** (ADR-059 § Consequences). Every path in § 7 is a
  workflow comment, ops documentation or a standards page about the build.
- **Three of the four dry runs cannot pass today, and no agent can make them pass.** Read on
  2026-10-14 through the GitHub API: the repository has **0 Actions secrets and 0 Actions
  variables**, and `main` is **not protected** (`branches/main/protection` → 404). The merge of
  #134 ran `build-image` run 38524736841, which failed at `secrets present` with *"Missing Actions
  secrets: DOCKERHUB_USERNAME DOCKERHUB_TOKEN VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY"*. The
  deployment-repository drafts (CICD-05) are not applied anywhere an agent can see.
  - So this ticket **writes the dry-run procedure and records what was actually observed**, with run
    IDs. It does not claim a dry run passed that did not run.
  - Pushing a tag, adding a secret, applying protection and merging in the deployment repository are
    the operator's (RULE-09, and the deny list in `git-conventions.md`). The tag and forced-failure
    dry runs are therefore post-merge criteria (AC-14, AC-15), observable only after the operator's
    setup, exactly as CICD-05 AC-21/AC-22 were.
- **`DONE` for this row means the documents merged**, not that the pipeline has run end to end.
  ADR-059 names Phase 6's dry run as what closes the gap between *merged* and *working* for this
  group; the record in `docs/ops/ci-cd.md` § *Dry runs* is where that gap stays visible until the
  operator closes it.

## 1. Problem and scope

**Feature ID, transcribed from `.ai/registry/features.md`:**

> | CICD-06 | The pipeline, its secrets, how to cut a release and how to roll one back are written down, and the standards that describe CI match it | CICD | PLANNED | | From `.ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md`, re-triaged PROMOTE on 2026-10-13 after ADR-059 and ADR-060. Phase 6. `docs/ops/ci-cd.md` with the overview, every workflow and trigger, secrets, release steps, the rollback runbook and onboarding another app; dry runs of a PR, a merge, a pre-release tag and a forced health-check failure. `tech-stack.md` § *Build and deployment* and `MODEL-OVERVIEW.md` follow — standards plane. |

**Who gains what.** CICD-01 to CICD-05 left six workflows in this repository and a set of drafts for
the deployment repository, each documented only in its own header comment and its own ticket. The
operator — the only person who adds secrets, applies branch protection, pushes a version tag and
merges a deploy — has no single page that says what runs when, what each run needs, how to cut a
release, and what to do when one is bad. Every agent stage that reads `tech-stack.md` still finds
*"Build and deployment: TODO(project)"*. This ticket writes that page, records which parts of the
pipeline have actually been seen working, and brings the standards that describe the build into line
with what is on `main`.

**In scope:**

1. `docs/ops/ci-cd.md`: overview diagram, every workflow and its trigger, secrets and variables, how
   to cut a release, the rollback runbook, the dry-run procedure and record, onboarding another app.
2. `.ai/standards/tech-stack.md` § *Build and deployment*: the `TODO(project)` replaced by what is
   true.
3. `MODEL-OVERVIEW.md`: a source-table row pointing at `docs/ops/ci-cd.md`.
4. `SETUP.md` step 8: the secrets and the variable the workflows need, by pointer.
5. `.github/workflows/allowed-paths.yml`: its header comment *"One of three workflows"* is stale —
   there are six. Comment only.

**Out of scope, and where each item goes:**

- **Adding Actions secrets or variables, applying branch protection, pushing any tag, and anything in
  the deployment repository.** The operator, from the document this ticket writes. No workflow and
  no agent does them.
- **Making the tag and forced-failure dry runs pass.** They wait on the operator's setup; § *Dry
  runs* lists what each waits on (AC-10). They are first observed as AC-14 and AC-15.
- **Any change to a workflow's behaviour** — `on:`, `jobs:`, `steps:`, `permissions:`, `env:`. The
  only workflow edit is one comment line (AC-12).
- **Reusable workflows** for other apps. The onboarding section names which parts could become one;
  building it is a later row.
- **Pipelines for other apps** (the request's § 7), staging (assumed none, idea question 3), and a
  notification channel beyond what CICD-05 already does.
- **`docs/ops/deployment-repo/**`, `docs/ops/branch-protection.md`, `docs/ops/e2e-quarantine.md`.**
  `ci-cd.md` links to them and restates none of their content.
- **`git-conventions.md` § *Branch protection* and `testing-standards.md`.** Both were brought into
  line by CICD-02 and CICD-01 and are still true: the three required checks are `verify`,
  `allowed-paths` and `mir-tracking`; `ci-fast`, `build-image` and `release` are not gates.

`size_estimate`: **M**. One substantial new document whose every claim must be checked against six
workflows and a draft set, plus four small edits elsewhere.

## 2. Acceptance criteria

### 2.0 Facts the criteria rest on

- **The six workflows and their triggers**, on `main` at `c4bb195`:

  | Workflow | Trigger | Required check |
  |---|---|---|
  | `ci-fast` | push to `feat/**` | no |
  | `verify` | `pull_request`; push to `main` | yes — job `verify` |
  | `allowed-paths` | `pull_request` | yes |
  | `mir-tracking` | `pull_request` (opened, edited, synchronize, reopened) | yes |
  | `build-image` | push to `main` | no |
  | `release` | push of a tag matching `v*.*.*` | no |

- **What they need** (the workflows' own header comments): `build-image` needs the secrets
  `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`;
  `release` needs `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, the secret `DEPLOY_REPO_TOKEN` and the
  variable `DEPLOY_REPO`. The deployment repository's drafted workflows use `github.token` only.
- **`release` accepts a pre-release tag** `vX.Y.Z-<suffix>` and marks its GitHub Release as a
  pre-release (`release.yml`, step `version`).
- **The build output directory is `dist/`**, already in `.gitignore`; the image is static nginx on
  port 3000 with `GET /healthz` (`Dockerfile`, `docker/nginx.conf`).

### 2.1 Criteria

AC-1 to AC-13 are checked from the files at this ticket's head. AC-14 and AC-15 are observable only
after the operator's setup.

**`docs/ops/ci-cd.md`**

**AC-1: the sections, in order**
- Given `docs/ops/ci-cd.md`
- When it is read
- Then its `##` headings are, in this order: *Overview*, *Workflows*, *Secrets and variables*,
  *Cutting a release*, *Rollback runbook*, *Dry runs*, *Onboarding another app*, *Where else this is
  written*

**AC-2: the overview is a diagram of the five stages**
- Given § *Overview*
- When it is read
- Then it holds one fenced ` ```mermaid ` block whose nodes include, in flow order: a push to
  `feat/**`, a pull request, a merge to `main`, a `v*.*.*` tag, a merge in the deployment repository
- And each stage node names the workflow that runs there (`ci-fast`; `verify` + `allowed-paths` +
  `mir-tracking`; `build-image`; `release`; `deploy-calechip`)
- And the image moves `:sha-<7>` → `:vX.Y.Z` by digest, with no second build shown

**AC-3: every workflow, its trigger, and whether it gates**
- Given § *Workflows*
- When it is read
- Then it has one table row per file in `.github/workflows/` — exactly the six in § 2.0 — plus one row
  each for the deployment repository's drafted `deploy-calechip` and `pr-scope`, marked *draft, not
  applied*
- And each row gives the file path, the trigger, what it does in one line, whether it is a required
  check, and the ticket that wrote it
- And the required checks named are exactly `verify`, `allowed-paths`, `mir-tracking`, with a link to
  `branch-protection.md` and no restated settings

**AC-4: every secret and variable, where it is set, and who reads it**
- Given § *Secrets and variables*
- When it is read
- Then it has one row each for `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `VITE_SUPABASE_URL`,
  `VITE_SUPABASE_ANON_KEY`, `DEPLOY_REPO_TOKEN` (secrets) and `DEPLOY_REPO` (variable), and no other
- And each row gives: kind, the repository it is set in, the workflows that read it, and the scope or
  value it must have — `DEPLOY_REPO_TOKEN` as a fine-grained token on the deployment repository only,
  Contents and Pull requests read/write; `DEPLOY_REPO` as `owner/name`
- And it states that the `VITE_*` values are baked into the image at build, so one image serves one
  Supabase project, and that `SUPABASE_SERVICE_ROLE_KEY` is never an Actions secret here
- And it states that the deployment repository needs no secret (its workflows use `github.token`)
- And the file contains no secret value, token or key — only names

**AC-5: cutting a release is a numbered procedure**
- Given § *Cutting a release*
- When it is read
- Then it is a numbered list that covers, in order:
  - the commit is on `main` and its `build-image` run succeeded (`:sha-<7>` exists);
  - choosing `vX.Y.Z`, by the operator, by hand (idea question 5);
  - the exact commands `git tag vX.Y.Z <sha>` and `git push origin vX.Y.Z`;
  - what `release` then does and the two refusals it can return (tag not on `main`; `:sha-<7>` not
    in Docker Hub);
  - reviewing and merging the `release/calechip-vX.Y.Z` pull request in the deployment repository,
    which is the deploy;
  - how to confirm it: the `deploy-calechip` run, and the *deployed* comment on that pull request
- And it states that a tag with only two parts (`v2.0`) triggers nothing

**AC-6: the rollback runbook covers three cases and the database**
- Given § *Rollback runbook*
- When it is read
- Then it has three sub-cases, each with the steps to take:
  1. **the health check failed** — automatic: what the run shows, the four `result` values
     (`restored`, `no-previous`, `restore-failed`, `restore-unpushed`) and what to do for each that is
     not `restored`, linking to `deployment-repo/README.md` rather than restating the mechanism;
  2. **the release is healthy but wrong** — a revert pull request of the release merge in the
     deployment repository, merged by a human, which deploys the previous pin through the same path;
  3. **the pipeline itself is down** (runner offline, GitHub unavailable) — on the server, the
     single `docker compose -p calechip -f apps/calechip/compose.yml --env-file apps/calechip/release.env up -d --wait`
     run from a checkout of the previous commit, followed by bringing the repository back in line
- And it states that no rollback touches the database, and that every migration must stay compatible
  with the previous release's image (RULE-09)
- And it states that `:latest` is never deployed and never a rollback target

**AC-7: the dry-run procedure**
- Given § *Dry runs*
- When it is read
- Then it has one numbered sub-section per dry run, in this order: *Pull request*, *Merge to main*,
  *Pre-release tag*, *Forced health-check failure*
- And each gives the steps, who performs them, and the expected outcome
- And *Pre-release tag* uses `v0.0.0-rc.1` on a commit whose `build-image` run succeeded, and
  expects: a `:v0.0.0-rc.1` tag with the same digest as `:sha-<7>`, a `release/calechip-v0.0.0-rc.1`
  pull request in the deployment repository, and a GitHub Release marked pre-release
- And *Forced health-check failure* starts from a healthy deployed release and merges, in the
  deployment repository, a change to `apps/calechip/compose.yml` whose `healthcheck.test` is
  `["CMD", "false"]`; it expects a red `deploy-calechip` run with `result=restored`, the service
  healthy on the previous digest, and a restore commit on that repository's `main`

**AC-8: the record of what was observed — never a claim of what was not**
- Given the table at the end of § *Dry runs*
- When it is read
- Then it has exactly four rows, one per dry run, with columns: dry run, date observed, run URL(s),
  conclusion, notes
- And the *Pull request* row records the workflow runs of a real merged pull request, read with
  `gh run list` / `gh run view` at implementation time, with each run's URL and actual conclusion
- And the *Merge to main* row records the `verify` and `build-image` runs of the latest merge to
  `main` at implementation time, with their actual conclusions; where `build-image` failed at
  `secrets present`, the row says so in those words
- And the *Pre-release tag* and *Forced health-check failure* rows read `not run` in the conclusion
  column, and nothing in the date or URL column

**AC-9: a failed or skipped row is not hidden**
- Given the same table
- When any recorded conclusion is not `success`
- Then the notes cell names the failing step and the cause from the run's log, in a phrase
- And no row reads `success` without a run URL

**AC-10: what each unrun dry run waits on**
- Given § *Dry runs*, after the table
- When it is read
- Then a list names, for each row not `success`, what must be true first, drawn from this set: the
  four `build-image` secrets; `DEPLOY_REPO_TOKEN` and `DEPLOY_REPO`; the deployment repository
  drafts applied (`deployment-repo/README.md` § *Before you apply*); the runner online; a release
  already deployed (for the forced failure)
- And it says that the operator updates the table when a dry run is performed

**AC-11: onboarding another app**
- Given § *Onboarding another app*
- When it is read
- Then it lists, as a numbered procedure, what a second app needs: its own image repository, its own
  `build-image` and `release` in its own repository, a folder `apps/<app>/` in the deployment
  repository, a `deploy-<app>` workflow with its own `concurrency` group and compose project name,
  and a CODEOWNERS line
- And it says that `pr-scope` already covers any `apps/<app>/` and needs no change
- And it names, as later candidates for reusable workflows, the build-and-smoke, the
  promote-by-digest, and the deploy-health-restore steps — and says none exists yet

**The other files**

**AC-12: `tech-stack.md` § *Build and deployment* states what is true**
- Given `.ai/standards/tech-stack.md` § *Build and deployment*
- When it is read
- Then it no longer contains `TODO(project)`
- And it states: build output `dist/` (ignored in `.gitignore`); the container is static nginx on
  port 3000 with `GET /healthz`; the image `mingming21400/calechip` on Docker Hub, `:sha-<7>` from
  each merge to `main` and `:vX.Y.Z` promoted by digest; the target is Docker Compose on the operator's
  WSL2 home server behind a Cloudflare Tunnel, deployed from the separate deployment repository by a
  self-hosted runner; `VITE_*` values baked in at build, so one image serves one Supabase project;
  no staging environment; CI on GitHub Actions
- And it links to `docs/ops/ci-cd.md` for everything else, and records the old line as
  *"Until 2026-10-14 this said …"*, as the standards do elsewhere
- And the front-matter `last_updated` is `2026-10-14` and `doc_version` is incremented by one

**AC-13: the pointers, and the stale comment**
- Given `MODEL-OVERVIEW.md`
- When its first table is read
- Then it has a row `| CI/CD pipeline, secrets, release and rollback | [docs/ops/ci-cd.md](docs/ops/ci-cd.md) |`
- And given `SETUP.md` step 8, its `.github/workflows/` bullet says that `build-image` and `release`
  fail until the secrets and the variable listed in `docs/ops/ci-cd.md` § *Secrets and variables* are
  added, with a link, and keeps the *"Until …"* line already there
- And given `.github/workflows/allowed-paths.yml`, line 3 no longer says *"One of three workflows"*;
  it says it is one of the three required checks, names them, and links `docs/ops/ci-cd.md`
- And `git diff origin/main -- .github/workflows/allowed-paths.yml` touches comment lines only

**Post-setup** *(observable only after the operator adds the secrets and the variable, and applies
the deployment-repository drafts)*

**AC-14: the pre-release tag dry run**
- Given a commit on `main` whose `build-image` run succeeded, and `release`'s inputs present
- When the operator pushes `v0.0.0-rc.1` on it
- Then `release` concludes `success`
- And `mingming21400/calechip:v0.0.0-rc.1` has the same digest as `:sha-<7>`
- And the deployment repository has an open `release/calechip-v0.0.0-rc.1` pull request
- And a GitHub Release `v0.0.0-rc.1` exists, marked pre-release
- And the operator records the row in § *Dry runs*

**AC-15: the forced health-check failure dry run**
- Given a release deployed and healthy through `deploy-calechip`
- When a change setting `healthcheck.test` to `["CMD", "false"]` is merged to the deployment
  repository's `main`
- Then `deploy-calechip` concludes `failure` with `result=restored`
- And `calechip` is healthy on the previous digest
- And that repository's `main` carries the restore commit
- And the operator records the row in § *Dry runs*

**Invariants touched: `[]`.** INV-01 to INV-07 (`.ai/registry/invariants.md`) constrain entries and
the absence count. This ticket writes documents and one workflow comment, with no `src/**`, seam or
schema change.

**Open questions. None blocks the plan.**

1. **Whether the operator adds the secrets before or after this merges** changes only the two
   *not run* rows, never the documents. AC-8 records whatever is true at implementation time.
2. **The runner label `home-wsl`** is still CICD-05's proposal (idea question 6). `ci-cd.md` cites
   it from `deployment-repo/README.md` and does not restate it as settled.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

*There is no screen in this ticket. What it originates is the section order of `docs/ops/ci-cd.md`
(AC-1) and the shape of the overview diagram (AC-2).*

## 3. Permission model

**No product role gains or loses anything.** No route, control, seam function or policy changes;
check R6 reads `none`.

| Action | Who may | Where it is enforced |
|---|---|---|
| Write the documents and the one comment | `devops`, inside `allowed_paths` | RULE-03; `allowed-paths` in CI; R1 |
| Read run results for the dry-run record | `devops`, read-only (`gh run list`, `gh run view`) | the agent's tools; nothing it runs writes to GitHub |
| Add secrets and variables, apply branch protection | the operator only | repository settings; RULE-09 |
| Push a version tag, including `v0.0.0-rc.1` | the operator only | `git-conventions.md` deny list; this plan gives agents no tag step |
| Merge in the deployment repository (deploy, forced failure) | a human | RULE-09 |
| Change `.ai/standards/**`, `.github/**` in this repository | an agent writes; the code owner approves at merge | `.github/CODEOWNERS` |

**Denied:** no secret value in any file (AC-4); no workflow behaviour change (AC-13); no dry-run row
reading `success` without a run that shows it (AC-8, AC-9); no agent pushes a tag or touches
repository settings.

## 4. Contract

No code, no entry point, no field. The contract is the document structure fixed by AC-1 to AC-13.
Three pieces are exact:

### 4.1 `docs/ops/ci-cd.md` — heading skeleton, exactly

```markdown
# CI/CD — how CaleChip is checked, built, released and deployed

## Overview
## Workflows
## Secrets and variables
## Cutting a release
## Rollback runbook
### 1. The health check failed after a deploy
### 2. The release is healthy but wrong
### 3. The pipeline itself is down
## Dry runs
### 1. Pull request
### 2. Merge to main
### 3. Pre-release tag
### 4. Forced health-check failure
### Record
## Onboarding another app
## Where else this is written
```

§ *Overview* holds the diagram and at most one short paragraph. The `###` headings are as listed;
the implementer adds no other `##` heading.

### 4.2 The dry-run record table header, exactly

```markdown
| Dry run | Date observed | Run URL(s) | Conclusion | Notes |
|---|---|---|---|---|
```

*Conclusion* is one of `success`, `failure`, `not run`.

### 4.3 The forced-failure change, exactly

In the deployment repository's `apps/calechip/compose.yml`, on a branch that is **not**
`release/*` (so `pr-scope` does not apply):

```yaml
    healthcheck:
      test: ["CMD", "false"]
```

### 4.4 § *Where else this is written*

A list of links with one line each, and no restated content: `docs/ops/branch-protection.md`,
`docs/ops/deployment-repo/README.md`, `docs/ops/e2e-quarantine.md`, `.ai/standards/tech-stack.md`
§ *Build and deployment*, `.ai/standards/git-conventions.md` § *Branch protection*, and each
workflow's header comment. It says that where this page and a workflow disagree, the workflow is
right.

## 5. Seam impact

none.

## 6. Schema delta

none.

## 7. allowed_paths

```yaml
allowed_paths:
  - "docs/ops/ci-cd.md"
  - ".ai/standards/tech-stack.md"
  - "MODEL-OVERVIEW.md"
  - "SETUP.md"
  - ".github/workflows/allowed-paths.yml"
```

`glossary_owed` is `[]`; no glossary row is written.

`size`: **S** — five paths. It disagrees with `size_estimate` **M**: the weight is in checking one
document against six workflows and a draft set, which a path count does not see. The verdict
stands (ADR-012).

## 8. Rejected alternatives

1. **Run the tag dry run from this ticket** (the implementer pushes `v0.0.0-rc.1`). Rejected: a tag
   push is an outward action on the shared remote that the request reserves to the operator, and
   today it would fail at `inputs present` anyway — 0 secrets, 0 variables. It would produce a red
   run and a stray tag to prove a fact the API already shows.
2. **Block this ticket until the operator has added the secrets and applied the deployment drafts**,
   so all four dry runs pass before `DONE`. Plausible — the request's acceptance list pairs the
   document with working dry runs. Rejected because the documents are the operator's instructions
   for that very setup; holding them back until the setup is done inverts the order. The gap is
   kept visible instead: AC-8 refuses a `success` without a run, and AC-10 names what each row waits
   on.
3. **Put the pipeline description into `tech-stack.md` and `git-conventions.md` instead of a new
   `docs/ops/ci-cd.md`.** Rejected: the standards plane is read by every agent stage and should name
   the shape once; release and rollback steps are an operator runbook, and the request names the
   file. `tech-stack.md` gets the facts and a link (AC-12).
4. **Rewrite every workflow header comment to point at `ci-cd.md`.** Rejected: five of six headers
   are accurate today, and editing them widens `allowed_paths` into files whose behaviour must not
   change. Only the one stale line is fixed (AC-13).

## Changelog

- `2026-10-14T07:09:41+00:00` — sections 1 and 2 written from the feature row and the idea file;
  § 2.0 and AC-8/AC-10 were then sharpened after reading the API (0 secrets, 0 variables, `main`
  unprotected, `build-image` failing at `secrets present`): the original intent "dry runs of a PR, a
  merge, a pre-release tag and a forced health-check failure" became "procedure for all four, record
  of what was observed, and AC-14/AC-15 post-setup". Reason: an AC requiring four green runs could not
  be met by any implementation. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
