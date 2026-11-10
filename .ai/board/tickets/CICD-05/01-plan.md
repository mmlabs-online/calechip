---
ticket: CICD-05
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-14T02:40:58+00:00
inputs_read:
  - .ai/board/tickets/CICD-05/ticket.yaml
  - .ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-059-delivery-work-is-a-seventh-feature-group.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/steward/context.md
  - .ai/standards/tech-stack.md
  - .ai/board/tickets/CICD-04/01-plan.md
  - .ai/board/tickets/CICD-04/03-impl-log.md
  - .github/workflows/release.yml
  - .github/workflows/build-image.yml
  - .github/CODEOWNERS
  - .claude/agents/devops.md
  - Dockerfile
  - docker/nginx.conf
  - .env.example
  - docs/ops/branch-protection.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CICD-05 — Plan

## 0. Stated first

- **The implementer is `devops`, not `developer`** (ADR-059 § Consequences). Every path in § 7 is
  a workflow, a compose file or ops documentation.
- **Everything this ticket writes is a draft in this repository.** Nothing here runs. GitHub runs
  workflows only from the repository-root `.github/workflows/`, and reads `CODEOWNERS` only from
  the root, `.github/` or `docs/`. A `.github/` folder nested under `docs/ops/deployment-repo/` is
  therefore inert. The operator copies the drafts into the deployment repository by hand, following
  the README this ticket writes.
- **The feature row's blocking condition is unknown, not met.** The row says *"Blocked if the
  deployment repository holds real secrets"*. That repository is not attached to this session, and
  no repository under `didi-code0980` looks like it (CICD-04 § 0). Writing drafts here exposes
  nothing, so the plan proceeds. The condition becomes the first item of the README's *Before you
  apply* checklist (AC-17): applying the drafts stops there if the repository holds real secrets.
- **The CICD-04 contract is fixed, and this ticket consumes it unchanged.** The release workflow
  writes `apps/calechip/release.env` with one line
  `CALECHIP_IMAGE=mingming21400/calechip:vX.Y.Z@sha256:<64 hex>` (`release.yml:32-33,168`).
  `release.yml` is not in this ticket's paths.

## 1. Problem and scope

**Feature ID, transcribed from `.ai/registry/features.md`:**

> | CICD-05 | The deployment repository deploys only CaleChip from merged config, health-checks it and restores the previous version on failure — drafted in this repository | CICD | PLANNED | | From `.ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md`, re-triaged PROMOTE on 2026-10-13 after ADR-059 and ADR-060. Phase 5, **as drafts under `docs/ops/deployment-repo/`**: the deployment repository is not attached to this repository's sessions. Self-hosted runner on the WSL server, `concurrency: deploy-calechip`, `compose -p calechip`, health check with retries, revert-and-redeploy on failure. **No migrate step: RULE-09 keeps schema changes human**, and the container is static nginx. Blocked if the deployment repository holds real secrets (idea, open question 4). |

**Who gains what.** CICD-04 ends with a pull request in the deployment repository that pins
CaleChip to a version and a digest. Today nothing acts on that pull request when it merges. The
operator still has to log in to the WSL server and run compose by hand, and if the new version is
broken they find out from the tunnel and recover by memory.

This ticket hands the operator a ready-to-apply set of files for that repository:
- a CaleChip folder;
- a deploy workflow, which runs on the server's own runner when a change to that folder merges,
  deploys only CaleChip, checks it is healthy, and restores the previous version and records the
  revert if it is not;
- a path rule that keeps a release pull request inside its own app's folder;
- the notes for setting up the runner safely.

Merging the release pull request then becomes the whole deploy.

**In scope:**

1. `docs/ops/deployment-repo/README.md`: what the drafts are, the *Before you apply* checklist, the
   layout, how a deploy and a rollback behave, the runner setup and its security trade-off, and the
   secrets policy.
2. `docs/ops/deployment-repo/apps/calechip/compose.yml`: the CaleChip service, image from
   `${CALECHIP_IMAGE}`, on the tunnel's network, with a health check.
3. `docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml`: the deploy, health check,
   restore and notification, on the self-hosted runner.
4. `docs/ops/deployment-repo/.github/workflows/pr-scope.yml`: a pull request from
   `release/<app>-v…` may change only `apps/<app>/`.
5. `docs/ops/deployment-repo/.github/CODEOWNERS`: owner for the CaleChip folder.

**Out of scope, and where each item goes:**

- **Applying the drafts to the deployment repository**, registering the runner, creating the tunnel
  route and naming the network. The operator does these by hand, from the README. No agent writes to
  that repository.
- **Any migration step.** RULE-09: schema changes are human, and the container is static nginx with
  no database client. The README states the convention this implies instead (AC-19).
- **An env template for CaleChip.** The container reads no environment at runtime: every `VITE_*`
  value is baked in at build (`Dockerfile` header), and nginx's port is fixed in
  `docker/nginx.conf`. The only env file in the folder is `release.env`, which CICD-04 writes and
  which holds no secret. § 8, alternative 4.
- **A health check through the public tunnel URL.** The check runs against the container from the
  runner host. Whether the tunnel route is right is a one-time setup item in the README.
- **A notification channel** (Slack, mail). Notifying uses what already exists: a comment on the
  merged release pull request, and the run's own status and summary (AC-14). This is the same line
  CICD-03 drew.
- **Pipelines and folders for other apps.** The request's § 7 excludes them. `pr-scope.yml` is
  written for any `apps/<app>/`, because a rule that names only CaleChip would let every other app's
  pull request through.
- **`docs/ops/ci-cd.md`, the rollback runbook as its own document, the dry run with a forced
  health-check failure, and `tech-stack.md` § *Build and deployment*.** These belong to CICD-06.
  AC-21 and AC-22 are first observed there.
- **Any change to `release.yml`, `build-image.yml`, `Dockerfile` or `docker/**`.**
- **A staging environment.** It is assumed absent (idea, question 3).

`size_estimate`: **M**. There are three behaviours (deploy, restore, scope rule) across two
workflows, plus a document the operator follows by hand on a machine no agent can reach.

## 2. Acceptance criteria

### 2.0 Facts the criteria rest on

- **CICD-04's output** is the single file `apps/calechip/release.env`, whose only non-comment line
  is `CALECHIP_IMAGE=mingming21400/calechip:<tag>@sha256:<digest>`. `<tag>` matches
  `v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?` (`release.yml`, step `version`). A release pull
  request comes from the branch `release/calechip-<tag>`.
- **The health endpoint.** `GET /healthz` on port 3000 inside the container answers `200 ok`
  (`docker/nginx.conf`). The image's own `HEALTHCHECK` probes it with
  `wget -q --spider http://127.0.0.1:3000/healthz` every 30 s (`Dockerfile`).
- **A push made with `GITHUB_TOKEN` does not start another workflow run.** This is GitHub's
  documented rule. A revert pushed by the deploy workflow therefore cannot trigger itself in a loop.
- **The paths below are drafts.** "The deployment repository" in an AC means the copy the operator
  applies, where `docs/ops/deployment-repo/` maps to the repository root.

### 2.1 Criteria

AC-1 to AC-20 are checked from the files at this ticket's head. **AC-21 and AC-22 can only be
observed after the operator has applied the drafts** and registered the runner. CICD-06's dry run is
where they are first checked.

**The compose file**

**AC-1: one service, its image taken only from the release file**
- Given `docs/ops/deployment-repo/apps/calechip/compose.yml`
- When it is read
- Then it declares the top-level `name: calechip` and exactly one service, `calechip`
- And that service's `image:` is `${CALECHIP_IMAGE:?…}`, which fails with a message when
  `CALECHIP_IMAGE` is unset
- And no image reference, tag, digest or `latest` appears anywhere else in the file

**AC-2: no published port, and on the tunnel's network**
- Given the same file
- When it is read
- Then the service has no `ports:`
- And it joins one network, declared `external: true`
- And that network's `name:` is the placeholder `TODO-operator-tunnel-network`

**AC-3: the health check probes the endpoint the image already serves**
- Given the service's `healthcheck:`
- When it is read
- Then its `test` is `["CMD", "wget", "-q", "--spider", "http://127.0.0.1:3000/healthz"]`
- And it sets `interval: 5s`, `timeout: 3s`, `start_period: 5s` and `retries: 3`
- And the service sets `restart: unless-stopped`

**AC-4: the container is given no environment and no secret**
- Given the same file
- When it is read
- Then the service has no `environment:`, `env_file:`, `secrets:` or `volumes:`

**The deploy workflow**

**AC-5: it runs on a merge that touches CaleChip, and on nothing else**
- Given `docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml`
- When its `on:` block is read
- Then it is exactly `push` to `branches: [main]` with `paths: ['apps/calechip/**']`
- And it has no `pull_request`, `pull_request_target`, `workflow_dispatch` or `workflow_run`
  trigger

**AC-6: one deploy at a time, never cancelled**
- Given the same file
- When it is read
- Then its top-level `concurrency:` is `group: deploy-calechip` with `cancel-in-progress: false`

**AC-7: least privilege, on the server's runner**
- Given the same file
- When it is read
- Then its top-level `permissions:` is exactly `contents: write` and `pull-requests: write`
- And the job's `runs-on:` is `[self-hosted, linux, home-wsl]`
- And `secrets.` does not appear in the file (it uses only `github.token`)

**AC-8: placeholders left in the compose file stop the deploy**
- Given the `release` step, the first step after checkout
- When `apps/calechip/compose.yml` still contains `TODO-operator`
- Then the step exits non-zero with an error that names the file and the placeholder
- And nothing is pulled or started

**AC-9: no release yet means nothing is deployed, and the run is green**
- Given the `release` step
- When `apps/calechip/release.env` does not exist at the pushed commit (for example, the merge that
  first applies the layout)
- Then the step writes a notice that nothing has been released
- And it sets `skip=true`; every later step is skipped, and the run concludes `success`

**AC-10: only a version pinned by digest is deployed**
- Given the `release` step
- When `CALECHIP_IMAGE` in `release.env` does not match
  `^mingming21400/calechip:v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?@sha256:[0-9a-f]{64}$`, or the
  file holds the key more than once
- Then the step exits non-zero with an error that names the value
- And nothing is pulled or started, so a `:latest`, a bare tag or a bare digest is never deployed

**AC-11: the deploy is CaleChip's project only, and has no migrate step**
- Given the `deploy` step
- When it is read
- Then every compose command in it is
  `docker compose -p calechip -f apps/calechip/compose.yml --env-file apps/calechip/release.env …`
- And it runs `config --quiet`, then `pull`, then `up -d --wait --wait-timeout 120`, in that order
- And the file contains no `supabase`, `migrate`, `psql`, `down`, `-a`/`--all`, `system prune` or
  any compose command without `-p calechip`

**AC-12: a failed health check restores the previous release from git, then records the revert**
- Given the `rollback` step, with `if: failure() && steps.deploy.outcome == 'failure'`
- When the deploy step failed and the push's `before` commit held `apps/calechip/release.env`
- Then the step runs, in this order:
  1. `git restore --source="<before>" --staged --worktree -- apps/calechip`;
  2. the same `pull` and `up -d --wait --wait-timeout 120` against the restored files;
  3. a commit on `main` whose message names both the restored and the failed version;
  4. `git push origin HEAD:main`.
- And it then exits non-zero, so a restored deploy is still a red run

**AC-13: the refusals of the restore**
- Given the `rollback` step
- When `before` is all zeros, or `before` has no `apps/calechip/release.env`
- Then the step pushes nothing, reports in an error that no previous release exists, sets
  `result=no-previous` and exits non-zero
- And when the restored version also fails `up --wait`, the step does not commit or push, reports
  that both versions failed, sets `result=restore-failed` and exits non-zero
- And on a successful restore it sets `result=restored`

**AC-14: the outcome is reported on success and on failure**
- Given the `notify` step, with `if: always() && steps.release.outputs.skip != 'true'`
- When the run ends
- Then it writes one line to `$GITHUB_STEP_SUMMARY` naming the outcome: deployed, restored,
  restore-unpushed, no-previous, restore-failed, or did-not-complete
- And, when the pushed commit belongs to a pull request (`gh api
  repos/{repo}/commits/{sha}/pulls`), it posts the same line on that pull request with the run's
  URL, using `GH_TOKEN` set from `github.token`

**The scope rule and owners**

**AC-15: a release pull request may change only its own app's folder**
- Given `docs/ops/deployment-repo/.github/workflows/pr-scope.yml`
- When a pull request to `main` comes from a branch matching `^release/([a-z0-9-]+)-v[0-9]`
- Then the job `pr-scope` exits non-zero and lists every changed path that is outside `apps/<app>/`
- And for any other branch it exits zero and says no scope rule applies

**AC-16: the scope rule never touches the server**
- Given the same file
- When it is read
- Then `on:` is `pull_request` to `branches: [main]` only, and `runs-on:` is `ubuntu-latest`
- And `permissions:` is exactly `contents: read` and `pull-requests: read`
- And the head branch name reaches the script only through `env:`, never by `${{ }}` inside `run:`

**AC-17: CaleChip's folder has an owner**
- Given `docs/ops/deployment-repo/.github/CODEOWNERS`
- When it is read
- Then it holds `/apps/calechip/ @didi-code0980` and `/.github/ @didi-code0980`, with a header
  comment saying it is a draft for the deployment repository

**The README**

**AC-18: the operator can apply the drafts without asking anything**
- Given `docs/ops/deployment-repo/README.md`
- When it is read
- Then it has these sections, in this order: *What this is*, *Before you apply*, *Layout*,
  *How a deploy runs*, *How a failed deploy is restored*, *The runner*, *Secrets*
- And *Before you apply* is a numbered checklist whose **first item** is: if the deployment
  repository holds any real secret, stop and remove it (rotating it) before applying anything
- And the checklist covers these items:
  - the repository is private;
  - `TODO-operator-tunnel-network` is replaced with the network `cloudflared` is on;
  - the tunnel's ingress points at `http://calechip:3000`;
  - any hand-run CaleChip container on that network is stopped;
  - the server can pull `mingming21400/calechip` (it runs `docker login` if the image is
    private);
  - CICD-04's `DEPLOY_REPO` variable names this repository;
  - the deployment repository's branch protection lets `github-actions[bot]` push a revert to
    `main`

**AC-19: the README says what rollback does not cover**
- Given *How a failed deploy is restored*
- When it is read
- Then it says the restore covers the image and `apps/calechip/` only, and never the database
- And it says every migration must stay compatible with the previous release's image, because the
  pipeline applies none (RULE-09)
- And it says that a deploy which pushes a revert is still a red run

**AC-20: the README states the runner's trade-off**
- Given *The runner*
- When it is read
- Then it says the runner:
  - runs as a non-root user;
  - is registered to the deployment repository only;
  - carries the label `home-wsl`;
  - connects outbound only, which works behind the tunnel
- And it says that membership of the `docker` group is equivalent to root on the host
- And it says that no workflow with a `pull_request` trigger may target the self-hosted runner

**Post-apply** *(observable only after the operator applies the drafts)*

**AC-21: a merged release deploys and reports**
- Given the drafts applied, the runner online, and a CICD-04 release pull request for `vX.Y.Z`
- When it is merged
- Then a `deploy-calechip` run concludes `success`
- And `docker compose -p calechip ps` on the server shows `calechip` healthy on that image digest
- And the merged pull request carries the *deployed* comment

**AC-22: a failed health check restores the previous release** *(the forced-failure dry run is
CICD-06's)*
- Given a deployed `vA`, and a merged change to `apps/calechip/` that makes the health check fail
- When `deploy-calechip` runs
- Then it concludes `failure`
- And `calechip` is healthy on `vA`'s digest again
- And `main` carries a new commit that restores `apps/calechip/` to its state before the merge
- And the pull request carries the *restored* comment

**Invariants touched: `[]`.** INV-01 to INV-07 (`.ai/registry/invariants.md`) constrain entries and
the absence count. This ticket writes only documents and inert drafts, with no `src/**`, seam or
schema change.

**Open questions. None blocks the plan. Each one is a *Before you apply* item, so it blocks only
the application of the drafts.**

1. **Does the deployment repository hold real secrets?** This is the feature row's blocking
   condition. It is unknown because the repository is not attached. It is the first item of the
   README checklist (AC-18).
2. **The runner label `home-wsl` is this plan's proposal.** The idea's question 6 leaves it to the
   operator. Changing it is one `runs-on:` line and one README sentence.
3. **The name of the network `cloudflared` is on is unknown.** It is a deliberate placeholder that
   the deploy refuses to run past (AC-8), rather than a guess that would start a container on the
   wrong network.
4. **The code owner `@didi-code0980`** is the account this repository's own CODEOWNERS names. If
   the deployment repository belongs to a different account, the operator changes it when applying.
5. **Branch protection on the deployment repository's `main`** may refuse the revert push from
   `github-actions[bot]`. If it does, the restore still happens on the server, but the push fails,
   and the run's error says the repository and the server disagree. The README's checklist covers
   this (AC-18).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

*There is no screen in this ticket. What it originates is the deployment repository's folder layout
and the step order of § 4.*

## 3. Permission model

**No product role gains or loses anything.** No route, control, seam function or policy changes,
and check R6 reads `none`.

| Action | Who may | Where it is enforced |
|---|---|---|
| Copy the drafts into the deployment repository, register the runner, name the network | the operator only | by hand, from the README |
| Merge a release pull request (which deploys) | a human | RULE-09; the deployment repository's branch protection |
| Run a deploy | `deploy-calechip`, on push to that repository's `main` touching `apps/calechip/**` | `on:` (AC-5), and the runner being registered to that repository only (AC-20) |
| Touch any compose project other than `calechip` | nobody | AC-11: every command carries `-p calechip -f apps/calechip/compose.yml` |
| Push to the deployment repository's `main` | the `rollback` step only, one revert of `apps/calechip/`, after a successful restore | AC-12, AC-13; `contents: write` |
| Comment on a release pull request | the `notify` step only | `pull-requests: write` (AC-7, AC-14) |
| Change a folder outside the pull request's own app | refused for `release/<app>-v…` branches | `pr-scope` (AC-15), as a required check once the operator makes it one |
| Run code from a pull request on the server | nobody | no `pull_request` trigger in `deploy-calechip` (AC-5); `pr-scope` runs on `ubuntu-latest` (AC-16) |
| Change `docs/ops/**` in this repository | an agent writes it; the code owner approves at merge | this repository's CODEOWNERS |

**Denied:**
- No migration and no database access (AC-11).
- No `:latest` and no unpinned image (AC-10).
- No secret in any draft (AC-4, AC-7).
- No deploy from an unmerged change.
- No deploy of a compose file that still holds a placeholder (AC-8).

## 4. Contract

`docs/ops/deployment-repo/` maps to the deployment repository's root. The three YAML files below are
exact. The README is specified by AC-18 to AC-20 and written by the implementer.

### 4.1 `docs/ops/deployment-repo/apps/calechip/compose.yml`, exactly

```yaml
# CaleChip on the home server. DRAFT, kept in calechip/docs/ops/deployment-repo/ (CICD-05); copied to
# the deployment repository by the operator. See that folder's README before applying.
#
# The image comes only from release.env, which calechip's release workflow writes (CICD-04) as
#   CALECHIP_IMAGE=mingming21400/calechip:vX.Y.Z@sha256:<digest>
# Deploy with: docker compose -p calechip -f apps/calechip/compose.yml --env-file apps/calechip/release.env up -d --wait
#
# No ports, no environment, no secrets, no volumes: the container is static nginx on :3000, every
# VITE_* value is baked into the image, and cloudflared reaches it by service name on the network.

name: calechip

services:
  calechip:
    image: ${CALECHIP_IMAGE:?CALECHIP_IMAGE is unset - pass --env-file apps/calechip/release.env}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://127.0.0.1:3000/healthz"]
      interval: 5s
      timeout: 3s
      start_period: 5s
      retries: 3
    networks: [tunnel]

networks:
  tunnel:
    external: true
    # The network cloudflared is on. The deploy refuses to run while this placeholder is here.
    name: TODO-operator-tunnel-network
```

### 4.2 `docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml`, exactly

```yaml
name: deploy-calechip

# DRAFT for the deployment repository (calechip CICD-05). A merge to main that touches apps/calechip/
# deploys CaleChip, and only CaleChip, on the home server's self-hosted runner: pull the image
# pinned in release.env, start it, wait for /healthz. If it is not healthy, restore apps/calechip/ as
# it was before the push, redeploy that, and push the revert. A restored deploy is still a red run.
#
# No migrate step: schema changes are human (calechip RULE-09). Every migration must stay
# compatible with the previous release's image, because a restore never touches the database.

on:
  push:
    branches: [main]
    paths: ['apps/calechip/**']

permissions:
  contents: write # the revert push after a restore
  pull-requests: write # the outcome comment on the merged release PR

concurrency:
  group: deploy-calechip
  cancel-in-progress: false

env:
  APP_DIR: apps/calechip
  PROJECT: calechip

jobs:
  deploy:
    runs-on: [self-hosted, linux, home-wsl]
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - name: release
        id: release
        env:
          BEFORE: ${{ github.event.before }}
        run: |
          if grep -n 'TODO-operator' "$APP_DIR/compose.yml"; then
            echo "::error::$APP_DIR/compose.yml still holds a TODO-operator placeholder. Replace it before deploying. Nothing was started."
            exit 1
          fi
          if [ ! -f "$APP_DIR/release.env" ]; then
            echo "::notice::No $APP_DIR/release.env yet: nothing has been released. Nothing was deployed."
            echo "skip=true" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          pattern='^mingming21400/calechip:v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?@sha256:[0-9a-f]{64}$'
          image="$(sed -n 's/^CALECHIP_IMAGE=//p' "$APP_DIR/release.env")"
          if ! [[ "$image" =~ $pattern ]]; then
            echo "::error::CALECHIP_IMAGE in $APP_DIR/release.env is '$image', not one mingming21400/calechip:vX.Y.Z@sha256:<digest>. Nothing was started."
            exit 1
          fi
          previous=""
          if [ "$BEFORE" != "0000000000000000000000000000000000000000" ] \
             && git cat-file -e "$BEFORE:$APP_DIR/release.env" 2>/dev/null; then
            previous="$(git show "$BEFORE:$APP_DIR/release.env" | sed -n 's/^CALECHIP_IMAGE=//p')"
          fi
          {
            echo "skip=false"
            echo "image=$image"
            echo "previous=$previous"
          } >> "$GITHUB_OUTPUT"

      - name: deploy
        id: deploy
        if: steps.release.outputs.skip != 'true'
        run: |
          compose=(docker compose -p "$PROJECT" -f "$APP_DIR/compose.yml" --env-file "$APP_DIR/release.env")
          "${compose[@]}" config --quiet
          "${compose[@]}" pull
          "${compose[@]}" up -d --wait --wait-timeout 120

      - name: rollback
        id: rollback
        if: failure() && steps.deploy.outcome == 'failure'
        env:
          BEFORE: ${{ github.event.before }}
          FAILED: ${{ steps.release.outputs.image }}
          PREVIOUS: ${{ steps.release.outputs.previous }}
        run: |
          if [ -z "$PREVIOUS" ]; then
            echo "::error::$FAILED failed its health check and there is no previous release to restore. Nothing was pushed."
            echo "result=no-previous" >> "$GITHUB_OUTPUT"
            exit 1
          fi
          git restore --source="$BEFORE" --staged --worktree -- "$APP_DIR"
          compose=(docker compose -p "$PROJECT" -f "$APP_DIR/compose.yml" --env-file "$APP_DIR/release.env")
          if ! "${compose[@]}" pull || ! "${compose[@]}" up -d --wait --wait-timeout 120; then
            echo "::error::$FAILED failed its health check, and restoring $PREVIOUS failed too. Nothing was pushed."
            echo "result=restore-failed" >> "$GITHUB_OUTPUT"
            exit 1
          fi
          failed_version="${FAILED#*:}"; failed_version="${failed_version%%@*}"
          previous_version="${PREVIOUS#*:}"; previous_version="${previous_version%%@*}"
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git commit -m "Restore calechip ${previous_version}: ${failed_version} failed its health check"
          if ! git push origin HEAD:main; then
            echo "::error::Restored $PREVIOUS on the server, but the revert could not be pushed to main. The repository and the server disagree until it is."
            echo "result=restore-unpushed" >> "$GITHUB_OUTPUT"
            exit 1
          fi
          echo "result=restored" >> "$GITHUB_OUTPUT"
          echo "::error::$FAILED failed its health check. Restored $PREVIOUS and pushed the revert."
          exit 1

      - name: notify
        if: always() && steps.release.outputs.skip != 'true'
        env:
          GH_TOKEN: ${{ github.token }}
          DEPLOY: ${{ steps.deploy.outcome }}
          RESULT: ${{ steps.rollback.outputs.result }}
          IMAGE: ${{ steps.release.outputs.image }}
          PREVIOUS: ${{ steps.release.outputs.previous }}
          RUN_URL: ${{ github.server_url }}/${{ github.repository }}/actions/runs/${{ github.run_id }}
        run: |
          case "$DEPLOY:$RESULT" in
            success:)                  msg="deployed: \`$IMAGE\` is running and healthy." ;;
            failure:restored)          msg="restored: \`$IMAGE\` failed its health check; \`$PREVIOUS\` is running again and the revert is on main." ;;
            failure:restore-unpushed)  msg="restored, revert NOT pushed: \`$PREVIOUS\` is running, but main still pins \`$IMAGE\`." ;;
            failure:no-previous)       msg="no-previous: \`$IMAGE\` failed its health check and there was no earlier release to restore." ;;
            failure:restore-failed)    msg="restore-failed: \`$IMAGE\` failed its health check and so did \`$PREVIOUS\`. CaleChip needs a hand." ;;
            *)                         msg="did-not-complete: the deploy did not run to the end (deploy: ${DEPLOY:-not run}, restore: ${RESULT:-not run})." ;;
          esac
          {
            echo "### deploy-calechip"
            echo ""
            echo "$msg"
          } >> "$GITHUB_STEP_SUMMARY"
          pr="$(gh api "repos/$GITHUB_REPOSITORY/commits/$GITHUB_SHA/pulls" --jq '.[0].number // empty' || true)"
          if [ -n "$pr" ]; then
            gh pr comment "$pr" --repo "$GITHUB_REPOSITORY" --body "deploy-calechip — $msg Run: $RUN_URL"
          fi
```

### 4.3 `docs/ops/deployment-repo/.github/workflows/pr-scope.yml`, exactly

```yaml
name: pr-scope

# DRAFT for the deployment repository (calechip CICD-05). A pull request from release/<app>-v... may
# change only apps/<app>/. Any other pull request is not checked here. Runs on GitHub's runners,
# never on the self-hosted one: pull request code must never reach the server.

on:
  pull_request:
    branches: [main]

permissions:
  contents: read
  pull-requests: read

jobs:
  pr-scope:
    runs-on: ubuntu-latest
    timeout-minutes: 5
    steps:
      - name: changes stay in the app's folder
        env:
          GH_TOKEN: ${{ github.token }}
          HEAD_REF: ${{ github.head_ref }}
          PR: ${{ github.event.pull_request.number }}
        run: |
          if ! [[ "$HEAD_REF" =~ ^release/([a-z0-9-]+)-v[0-9] ]]; then
            echo "$HEAD_REF is not a release branch; no scope rule applies."
            exit 0
          fi
          app="${BASH_REMATCH[1]}"
          outside="$(gh pr diff "$PR" --repo "$GITHUB_REPOSITORY" --name-only | grep -v "^apps/$app/" || true)"
          if [ -n "$outside" ]; then
            echo "::error::A release pull request for $app may change only apps/$app/. Outside it:"
            echo "$outside"
            exit 1
          fi
          echo "Every change is under apps/$app/."
```

### 4.4 `docs/ops/deployment-repo/.github/CODEOWNERS`, exactly

```
# DRAFT for the deployment repository (calechip CICD-05). Each app's folder has its owner; the
# workflows are the operator's. Change the handle if the deployment repository belongs elsewhere.
/.github/        @didi-code0980
/apps/calechip/  @didi-code0980
```

### 4.5 The names are the contract

These names are fixed:
- workflow and job `deploy-calechip` / `deploy`;
- steps `release`, `deploy`, `rollback` and `notify`;
- outputs `steps.release.outputs.{skip,image,previous}` and `steps.rollback.outputs.result`, whose
  values are `restored`, `restore-unpushed`, `no-previous` and `restore-failed`;
- workflow and job `pr-scope`;
- the compose project and service `calechip`;
- the network key `tunnel`;
- the placeholder `TODO-operator-tunnel-network`;
- the runner label `home-wsl`.

CICD-06 documents these names.

**The implementer verifies these and does not recall them**, and records each one in the impl log:

1. **`docker compose up --wait --wait-timeout`** exists, and `--wait` fails non-zero when a
   service's health check reports unhealthy. Check the Compose v2 reference.
2. **`git restore --source=<commit> --staged --worktree -- <dir>` removes files that were added
   after `<commit>`.** If it does not, use `git rm -r --cached` plus `git checkout <commit> --` and
   say so.
3. **`gh pr diff --name-only`** exists in the `gh` on `ubuntu-latest`. If it does not, use
   `gh api repos/{repo}/pulls/{n}/files --paginate --jq '.[].filename'`.
4. **All three YAML files parse.** Validate with `yaml` in the session scratchpad, as CICD-03 and
   CICD-04 did. `docker` is not installed in this environment, so `docker compose config` cannot
   run here. Say so rather than claiming it was run.

**No container is started and no repository other than this one is touched**
(`.claude/agents/devops.md` § Containers).

## 5. Seam impact

**None.** No file under `src/` changes.

## 6. Schema delta

**`none`.** No migration, policy, trigger or constraint is involved, and AC-11 and AC-19 exist to
keep it that way. `requires_adr: true` refers to ADR-059, which the operator accepted on 2026-10-13.

## 7. allowed_paths

```yaml
allowed_paths:
  - "docs/ops/deployment-repo/README.md"
  - "docs/ops/deployment-repo/apps/calechip/compose.yml"
  - "docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml"
  - "docs/ops/deployment-repo/.github/workflows/pr-scope.yml"
  - "docs/ops/deployment-repo/.github/CODEOWNERS"
```

**Glossary:** `glossary_owed` is `[]`, so no row was written.

**Branch:** `feat/CICD-05`, cut from `origin/main` at `309091d` (CICD-04 merged). The CI path guard
is active on it.

**`size`: S (5 paths, up to 6). `size_estimate`: M.** They disagree, and the verdict stands
(ADR-012). The M counted two workflows' worth of behaviour. The S counts files.

## 8. Rejected alternatives

1. **The request's order: revert the commit, push it, then redeploy.** It was rejected for two
   reasons. Pushing first leaves the site broken for as long as the push takes, and longer if the
   push is refused. A refused push (branch protection) would also leave the broken version running.
   Restoring on the server first and pushing second puts service back first. If the push then fails,
   the run says plainly that the repository and the server disagree (`restore-unpushed`). Both are
   still "revert-and-redeploy", and the repository still records the revert.
2. **`git revert` of the pushed commit** instead of restoring `apps/calechip/` from `before`. It was
   rejected for three reasons:
   - A merge commit needs `-m 1`, and a squash merge does not.
   - A push of several commits needs a range.
   - A revert would also undo any other app's changes that rode in the same push.

   Restoring the CaleChip folder from `before` is the same result for CaleChip, whatever the merge
   shape, and it touches nothing else.
3. **Health-check with a `curl` loop from the runner against a published port.** That is closer to
   CICD-03's smoke test. It was rejected because it would need a host port that nothing else wants,
   and the tunnel reaches the container by name. Compose's `--wait` on the container's own health
   check needs no port and fails on exactly the condition the image already defines.
4. **An env template (`calechip.env.example`) beside the compose file**, as the request's layout
   example suggests. It was rejected because the container reads no runtime environment, so a
   template would be an empty file whose existence implies otherwise. The request's real concern,
   that no secret is committed, is met by AC-4, and the README's *Secrets* section says where one
   would live if CaleChip ever needed one.
5. **A `workflow_dispatch` "redeploy version X" button.** It would be convenient for a manual
   rollback. It was rejected because it deploys something that is not merged config, which is the
   request's first principle for this stage. A manual rollback is a revert pull request in the
   deployment repository, which deploys through the same path.

## Changelog

- `2026-10-14T02:40:58+00:00`: all sections written, gate PASS. Branch `feat/CICD-05` was created
  from `origin/main`. **One AC was amended after writing § 4:** AC-14's outcome list was missing
  `restore-unpushed`, the case where the restore worked but the revert push was refused (Open
  question 5). § 4.2 reports it, and AC-14 now names it. The behaviour came from the design, not
  from a source, and it is recorded here rather than folded in silently. Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.
