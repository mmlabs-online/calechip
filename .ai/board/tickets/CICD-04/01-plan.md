---
ticket: CICD-04
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-14T02:13:31+00:00
inputs_read:
  - .ai/board/tickets/CICD-04/ticket.yaml
  - .ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-059-delivery-work-is-a-seventh-feature-group.md
  - .ai/templates/plan.md
  - .ai/steward/context.md
  - .ai/board/tickets/CICD-03/01-plan.md
  - .ai/board/tickets/CICD-03/03-impl-log.md
  - .github/workflows/build-image.yml
  - "gh api repos/{actions/checkout,docker/setup-buildx-action,docker/login-action}/releases/latest — v7.0.1, v4.4.1, v4.6.0, 2026-10-14"
  - "gh secret list, gh variable list — both empty, 2026-10-14"
  - "gh repo list didi-code0980 — no deployment repository among the ten listed, 2026-10-14"
  - "git tag, git ls-remote --heads origin 'release/*', gh release list — v1.0.0, v2.0; release/v1.0, release/v2.0; Release v2.0, 2026-10-14"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CICD-04 — Plan

## 0. Stated first

- **The implementer is `devops`, not `developer`** (ADR-059 § Consequences). The only path in § 7
  is a workflow.
- **None of the inputs this workflow needs exist yet.** On 2026-10-14 `gh secret list` and
  `gh variable list` are both empty. CICD-03's four secrets are still missing. This ticket adds
  `DEPLOY_REPO_TOKEN` and the variable `DEPLOY_REPO`, and no deployment repository is visible to
  the `didi-code0980` account. The workflow runs only on a version-tag push, so nothing fails before
  someone pushes a tag. The first tag pushed before the operator adds these inputs fails at its
  first step, and the failure names what is missing (AC-3).
- **This plan fixes the file the deployment PR writes**, `apps/calechip/release.env` (§ 4.1). That
  file sits in a layout CICD-05 drafts later, because the repository is not attached. CICD-05 has to
  consume that file or change the one `env` line that names it. This is recorded in Open question 2.

## 1. Problem and scope

**Feature ID, transcribed from `.ai/registry/features.md`:**

> | CICD-04 | A version tag on `main` promotes the image already built for that commit, by digest and without rebuilding, and opens a release pull request in the deployment repository | CICD | PLANNED | | From `.ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md`, re-triaged PROMOTE on 2026-10-13 after ADR-059 and ADR-060. Phase 4. Fails if the tagged commit is not on `main` or `:sha-<short>` is absent; `docker buildx imagetools create` to `:vX.Y.Z`; PR on `release/calechip-vX.Y.Z` in the deployment repository, CaleChip path only, pinned by version **and digest**, through `DEPLOY_REPO_TOKEN` (contents + pull-requests only); a GitHub Release with generated notes. Version is a manual tag (the request's default). |

**Who gains what.** Today the operator cuts a release by hand: a `release/vX.Y` branch, a tag and a
GitHub Release (`v2.0` was cut that way on 2026-10-14). Nothing ties that release to an image. With
this ticket, pushing one `vX.Y.Z` tag on a commit already on `main` does three things. It gives the
image CICD-03 built and smoke-tested for that commit a version name in Docker Hub, as the same
bytes. It opens a pull request in the deployment repository that pins CaleChip to that version and
digest. It records the release on GitHub. The pull request is the input CICD-05 deploys from.
Merging it stays a human act, so the release becomes a reviewable change rather than a hand-typed
command on the server.

**In scope:**

1. `.github/workflows/release.yml`, new. On push of a `v*.*.*` tag it:
   - refuses a malformed tag, a commit not on `main` and an absent `:sha-<short>`;
   - promotes `:sha-<short>` to `:vX.Y.Z` by digest with `docker buildx imagetools create`;
   - opens the deployment pull request;
   - creates the GitHub Release, last.

**Out of scope, and where each item goes:**

- **Adding the secrets and the variable**, and **creating the fine-grained token**. The operator
  does this in repository settings and on their GitHub account. No workflow or agent writes a
  secret. See Open question 1.
- **The deployment repository's layout, its compose file, its deploy workflow and the runner.**
  These belong to CICD-05, as drafts under `docs/ops/deployment-repo/`. This ticket fixes only the
  one file it writes there (§ 4.1, Open question 2).
- **Deploying, the health check after deploy, and rollback.** CICD-05.
- **`docs/ops/ci-cd.md`, the release runbook and the secrets table.** CICD-06.
- **Running the workflow** (the `v0.0.0-rc.1` dry run). That is CICD-06 Phase 6. AC-17 and AC-18
  are first observed there.
- **Choosing or computing the version number.** It is a manual tag, as the feature row says. There
  is no semantic-release, no changelog tool and no version bump in a file.
- **A `release/*` branch in this repository.** The request defaults to a tag (question 4). The
  existing `release/v1.0` and `release/v2.0` branches and the `v1.0.0` and `v2.0` tags are left
  untouched. Open question 3.
- **Any `:latest` tag, or any tag other than `:vX.Y.Z`.** The request's principle is *"Never deploy
  `:latest`"*.
- **Changing `build-image.yml`.** Its tag scheme is read here and reproduced exactly (AC-6).
- **A notification beyond GitHub's own notice of a failed run.** CICD-03 drew the same line, for the
  same reason.
- **Verifying the image's `org.opencontainers.image.revision` label against the full commit.** The
  7-character tag is the key that CICD-03 and the feature row both name. § 8, alternative 4.

`size_estimate`: **M**. It is one new workflow, but it acts on three systems: this repository,
Docker Hub and a second repository. It also carries more refusals than CICD-03.

## 2. Acceptance criteria

### 2.0 Facts the criteria rest on

- **The source tag.** CICD-03 pushes `mingming21400/calechip:sha-<short>`, where `<short>` is the
  first 7 characters of the full commit SHA (`build-image.yml`, step `tag`:
  `sha-${GITHUB_SHA::7}`).
- **The trigger glob.** In GitHub's filter syntax `*` matches any characters except `/`. So
  `v*.*.*` matches `v1.2.3` and `v0.0.0-rc.1`, and also `vx.y.z`. It does not match `v2.0`. The
  format check in AC-4 is therefore a real check, not a repeat of the trigger.
- **Current majors** (`gh api …/releases/latest`, 2026-10-14): `actions/checkout` v7,
  `docker/setup-buildx-action` v4, `docker/login-action` v4. These are the same majors
  `build-image.yml` uses.

### 2.1 Criteria

AC-1 to AC-16 are checked from the file at this ticket's head. **AC-17 and AC-18 can only be
observed after merge**, once the inputs in § 4.2 exist and the deployment repository has the CaleChip
folder. `/ship` records them as not yet observable. CICD-06's tag dry run is where they are first
checked.

**AC-1: the workflow runs on a version-tag push and on nothing else**
- Given `.github/workflows/release.yml`
- When its `on:` block is read
- Then it is exactly `push` with `tags: ['v*.*.*']`
- And it has no `branches`, `pull_request`, `pull_request_target`, `workflow_dispatch`,
  `workflow_run` or `release` trigger

**AC-2: least privilege, and secrets only where they are used**
- Given the same file
- When it is read
- Then its top-level `permissions:` is exactly `contents: write`
- And no job-level `permissions:` widens it, and no `write-all` or `read-all` appears
- And `secrets.` appears only in these four places:
  - the `inputs present` step's `env`;
  - `docker/login-action`'s `with:`;
  - the deployment checkout's `token:`;
  - the `deployment pull request` step's `env`

**AC-3: missing inputs fail the run first, by name, and print no value**
- Given the `inputs present` step, the first step after the checkout of this repository
- When any of `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN` or `DEPLOY_REPO_TOKEN` (secrets), or
  `DEPLOY_REPO` (variable), is empty
- Then the step exits non-zero
- And its output names every empty input and echoes no secret value

**AC-4: a malformed tag is refused before any registry call**
- Given the `version` step, which runs before `docker/login-action`
- When the pushed tag does not match `^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$`
- Then the step exits non-zero with an error that names the tag
- And no later step runs
- And when the tag matches and contains a `-`, the step's output `prerelease` is `true`; otherwise
  it is `false`

**AC-5: a tag on a commit that is not on `main` is refused before any registry call**
- Given the `on main` step, which runs after `version` and before `docker/login-action`
- When the commit the tag resolves to (`git rev-parse "<tag>^{commit}"`) is not an ancestor of
  `origin/main`
- Then the step exits non-zero with an error that names the tag and the commit
- And no image is promoted, no deployment branch is pushed and no Release is created

**AC-6: an absent source image is refused, and nothing is promoted**
- Given the `image exists` step
- When `mingming21400/calechip:sha-<short>` does not resolve in Docker Hub, where `<short>` is the
  first 7 characters of the tagged commit (the same scheme as `build-image.yml`)
- Then the step exits non-zero with an error that:
  - names the missing reference;
  - says `build-image` must succeed for that commit first, and that this run can then be re-run
- And no image is promoted, no deployment branch is pushed and no Release is created

**AC-7: the promotion copies by digest and builds nothing**
- Given the workflow
- When it is read
- Then it contains no `docker/build-push-action`, no `docker build`, no `docker buildx build` and
  no `docker push`
- And the only registry write is `docker buildx imagetools create --tag
  mingming21400/calechip:<tag> mingming21400/calechip@<digest>`, where `<digest>` is the source
  image's digest read in `image exists`
- And after it, the `promote` step requires `:<tag>` to resolve to exactly `<digest>` and exits
  non-zero otherwise

**AC-8: a version tag is never moved**
- Given the `promote` step
- When `mingming21400/calechip:<tag>` already exists in Docker Hub
- Then, if it resolves to a digest other than the source digest, the step exits non-zero with an
  error naming both digests, and does not run `imagetools create`
- And, if it resolves to the same digest, the step skips `imagetools create` and the run continues

**AC-9: no other image tag**
- Given the workflow
- When every image reference in it is read
- Then the only tags it writes or names as a target are `:<tag>`; `:sha-<short>` is only read
- And `latest` does not appear anywhere in the file

**AC-10: the deployment pull request changes one file, pinned by version and digest**
- Given the deployment checkout and the `deployment pull request` step
- When they are read
- Then the checkout:
  - uses `actions/checkout@v7`;
  - has `repository: ${{ vars.DEPLOY_REPO }}`, `ref: main`, `path: deployment` and
    `token: ${{ secrets.DEPLOY_REPO_TOKEN }}`
- And the step:
  - creates the branch `release/calechip-<tag>`;
  - writes `apps/calechip/release.env` whose only non-comment line is
    `CALECHIP_IMAGE=mingming21400/calechip:<tag>@<digest>`;
  - exits non-zero unless `git status --porcelain --untracked-files=all` lists exactly that one
    path;
  - commits it, pushes the branch, and opens a pull request against `main` with
    `gh pr create --repo "$DEPLOY_REPO"`, using `GH_TOKEN` set from `DEPLOY_REPO_TOKEN`

**AC-11: no CaleChip folder in the deployment repository means no pull request**
- Given the `deployment pull request` step
- When the deployment repository's `main` has no `apps/calechip/` directory
- Then the step exits non-zero with an error that names the repository and the missing directory
- And it pushes nothing to the deployment repository

**AC-12: a re-run reuses an open pull request rather than opening a second one**
- Given the `deployment pull request` step
- When the branch `release/calechip-<tag>` already exists in the deployment repository
- Then, if an open pull request has that branch as its head, the step writes that pull request's
  URL to its output and pushes nothing
- And otherwise the step exits non-zero with an error that names the branch

**AC-13: the GitHub Release comes last, with generated notes**
- Given the `github release` step, the last step that writes anything
- When its position and command are read
- Then it comes after `deployment pull request` and has no `if:`
- And it runs `gh release create "<tag>"` with `--verify-tag`, `--generate-notes` and
  `--title "<tag>"`
- And it adds `--prerelease` exactly when `version`'s `prerelease` output is `true`
- And it uses the workflow's own token (`github.token`), not `DEPLOY_REPO_TOKEN`

**AC-14: the run records what it did**
- Given a run that succeeds
- When its `$GITHUB_STEP_SUMMARY` is read
- Then it lists the tag, the full commit SHA, the source reference, the promoted reference with its
  digest, and the deployment pull request's URL

**AC-15: action majors**
- Given every `uses:` in `release.yml`
- When they are read
- Then each one is `actions/checkout@v7`, `docker/setup-buildx-action@v4` or
  `docker/login-action@v4`, and no other action is used

**AC-16: the refusals of scope**
- Given `git diff origin/main --stat` at this ticket's head
- When it is read
- Then the only path outside `.ai/board/tickets/CICD-04/` and the ship-owned set is
  `.github/workflows/release.yml`
- And `build-image.yml` and every other workflow are unchanged, and no file contains a secret value

**AC-17: post-merge, a release tag on `main` promotes, proposes and releases** *(observable after
merge only)*
- Given the inputs of § 4.2 set, a deployment repository whose `main` has `apps/calechip/`, and a
  commit on `main` whose `build-image` run succeeded
- When `v0.0.0-rc.1` is pushed on that commit
- Then the `release` run concludes `success`
- And `docker buildx imagetools inspect mingming21400/calechip:v0.0.0-rc.1` resolves to the same
  digest as `:sha-<short>`
- And an open pull request exists in the deployment repository from `release/calechip-v0.0.0-rc.1`
  that changes only `apps/calechip/release.env`
- And a GitHub Release `v0.0.0-rc.1` exists, marked pre-release

**AC-18: post-merge, an off-`main` tag promotes nothing** *(observable after merge only)*
- Given a commit that is not on `main`, whether or not it has an image
- When a `vX.Y.Z` tag is pushed on it
- Then the `release` run concludes `failure` at `on main`
- And no `:vX.Y.Z` tag exists in Docker Hub, no `release/calechip-vX.Y.Z` branch exists in the
  deployment repository, and no GitHub Release exists for that tag

**Invariants touched: `[]`.** INV-01 to INV-07 (`.ai/registry/invariants.md`) constrain entries and
the absence count. This ticket changes no `src/**`, seam or schema file. It moves an image tag and
opens a pull request in another repository.

**Open questions. None of them blocks the plan; each one blocks only the first real run.**

1. **The inputs do not exist yet**, and neither do CICD-03's (2026-10-14). The operator needs to:
   - Add the secret `DEPLOY_REPO_TOKEN`. This is a fine-grained personal access token, or a GitHub
     App installation token, limited to the deployment repository with *Contents: read and write*,
     *Pull requests: read and write* and nothing else, as the feature row says.
   - Add the repository **variable** `DEPLOY_REPO` as `owner/name`. It is a name, not a credential,
     so it is a variable.
   - Make sure `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN` exist (CICD-03 already requires them).

   Until this is done, a tag push gives a red `release` run at `inputs present`, and no deployment
   repository is touched. The deployment repository's owner and name are not recorded anywhere in
   this repository, and no repository under `didi-code0980` looks like it. That is why the name is a
   variable and not a literal.
2. **The file the pull request writes, `apps/calechip/release.env`, is chosen by this plan.** It
   follows the request's example layout (`apps/calechip/…`) and holds one line,
   `CALECHIP_IMAGE=mingming21400/calechip:vX.Y.Z@sha256:…`. Docker resolves an image reference with
   both a tag and a digest by its digest, which is the "pinned by version **and** digest" the row
   asks for. **CICD-05's compose draft has to read `${CALECHIP_IMAGE}` from that file**, for example
   with `--env-file release.env`. If it chooses a different file, it changes this workflow's
   `DEPLOY_FILE` line in the same ticket. This is not invented domain data: it is the contract
   between two workflows this loop writes, stated where the first of them is designed.
3. **The repository already has a different release practice.** There are `release/v1.0` and
   `release/v2.0` branches, the tags `v1.0.0` (on `release/v1.0`, not on `main`) and `v2.0`, and a
   GitHub Release `v2.0` created 2026-10-14. This workflow follows the request's default and the
   feature row: a three-part `vX.Y.Z` tag on `main`.
   - A two-part tag such as `v2.0` does not trigger it.
   - Re-pushing `v1.0.0` would be refused at `on main`.
   - The next version is the operator's choice, and it must be three-part for a release to happen.

   This plan does not decide whether those branches continue. That is CICD-06's runbook to state.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

*There is no screen in this ticket. The only arrangement it originates is the step order of § 4.1.*

## 3. Permission model

**No product role gains or loses anything.** No route, control, seam function or policy changes.
`.ai/standards/rbac-and-security.md` has nothing to apply here, and check R6 reads `none`.

| Action | Who may | Where it is enforced |
|---|---|---|
| Push a `vX.Y.Z` tag | anyone with push access to this repository (today the operator) | repository access; tag protection rules are a repository setting and are not in scope |
| Promote `:sha-<short>` to `:vX.Y.Z` | the `release` workflow only, for a commit on `main` whose image exists | `on:` (AC-1), `on main` (AC-5), `image exists` (AC-6) |
| Move an existing `:vX.Y.Z` | nobody | `promote` refuses a different digest (AC-8) |
| Write to the deployment repository | the `deployment pull request` step only, as one new branch and one pull request | `DEPLOY_REPO_TOKEN`'s scope (contents + pull-requests, that repository only); AC-10 and AC-11 |
| Merge the deployment pull request | a human | RULE-09; the token has no admin or bypass permission |
| Create the GitHub Release | the `github release` step only, with the workflow's own token | `permissions: contents: write` (AC-2), and `--verify-tag` |
| Add or rotate the secrets and the variable | the operator only | repository settings, by hand |
| Change `.github/**` | an agent writes it; the code owner approves at merge | `.github/CODEOWNERS` |

**Denied:**
- No pull request, fork, branch push or manual dispatch can run this workflow (AC-1).
- No step builds or pushes image bytes (AC-7).
- No step writes `:latest` (AC-9).
- No step merges anything, in either repository.
- `DEPLOY_REPO_TOKEN` is never given to the Release step, and `github.token` is never used against
  the deployment repository (AC-13, AC-10).

## 4. Contract

### 4.1 `.github/workflows/release.yml`, new, exactly

```yaml
name: release

# A version tag vX.Y.Z on a commit already on main promotes the image build-image pushed for that
# commit (mingming21400/calechip:sha-<first 7>) to :vX.Y.Z by digest, without rebuilding. It then opens
# a pull request in the deployment repository that pins CaleChip to that version and digest, and
# last creates a GitHub Release with generated notes. CICD-04.
#
# Nothing here builds an image and nothing here deploys: merging the deployment PR is human (RULE-09).
# A two-part tag (v2.0) does not trigger this; a tag on a commit not on main is refused.
#
# NEEDS, added by the operator, or every run fails at `inputs present`:
#   secrets   DOCKERHUB_USERNAME, DOCKERHUB_TOKEN — the same two build-image uses
#   secret    DEPLOY_REPO_TOKEN — a fine-grained token on the deployment repository ONLY,
#                                 Contents + Pull requests read/write, nothing else
#   variable  DEPLOY_REPO       — the deployment repository, as owner/name
# The deployment repository's main must already hold apps/calechip/ (CICD-05's layout).

on:
  push:
    tags: ['v*.*.*']

permissions:
  contents: write # gh release create; nothing else is written with this token

# One run per tag; a later tag never cancels an earlier release.
concurrency:
  group: release-${{ github.ref }}
  cancel-in-progress: false

env:
  IMAGE: mingming21400/calechip
  # The one file the deployment pull request changes. CICD-05's compose reads CALECHIP_IMAGE from it.
  DEPLOY_FILE: apps/calechip/release.env

jobs:
  release:
    runs-on: ubuntu-latest
    timeout-minutes: 15
    steps:
      - uses: actions/checkout@v7
        with:
          fetch-depth: 0

      - name: inputs present
        env:
          DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
          DOCKERHUB_TOKEN: ${{ secrets.DOCKERHUB_TOKEN }}
          DEPLOY_REPO_TOKEN: ${{ secrets.DEPLOY_REPO_TOKEN }}
          DEPLOY_REPO: ${{ vars.DEPLOY_REPO }}
        run: |
          missing=""
          for name in DOCKERHUB_USERNAME DOCKERHUB_TOKEN DEPLOY_REPO_TOKEN DEPLOY_REPO; do
            [ -n "${!name}" ] || missing="$missing $name"
          done
          if [ -n "$missing" ]; then
            echo "::error::Missing Actions secrets or variables:$missing — add them under Settings → Secrets and variables → Actions."
            exit 1
          fi

      - name: version
        id: version
        run: |
          tag="$GITHUB_REF_NAME"
          if ! [[ "$tag" =~ ^v[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]]; then
            echo "::error::Tag $tag is not vMAJOR.MINOR.PATCH or vMAJOR.MINOR.PATCH-prerelease. Nothing was promoted."
            exit 1
          fi
          commit="$(git rev-parse "${tag}^{commit}")"
          prerelease=false
          if [[ "$tag" == *-* ]]; then prerelease=true; fi
          {
            echo "tag=$tag"
            echo "commit=$commit"
            echo "source=${IMAGE}:sha-${commit::7}"
            echo "target=${IMAGE}:${tag}"
            echo "prerelease=$prerelease"
          } >> "$GITHUB_OUTPUT"

      - name: on main
        env:
          COMMIT: ${{ steps.version.outputs.commit }}
        run: |
          if ! git merge-base --is-ancestor "$COMMIT" origin/main; then
            echo "::error::Tag $GITHUB_REF_NAME points at $COMMIT, which is not on main. Nothing was promoted."
            exit 1
          fi

      - uses: docker/setup-buildx-action@v4

      - uses: docker/login-action@v4
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: image exists
        id: source
        env:
          SOURCE: ${{ steps.version.outputs.source }}
        run: |
          if ! digest="$(docker buildx imagetools inspect "$SOURCE" --format '{{.Manifest.Digest}}')" \
             || [[ "$digest" != sha256:* ]]; then
            echo "::error::$SOURCE is not in Docker Hub. build-image pushes it after a merge to main — wait for that run to succeed, then re-run this one. Nothing was promoted."
            exit 1
          fi
          echo "digest=$digest" >> "$GITHUB_OUTPUT"

      # Copies the manifest already in Docker Hub under a second name. No image bytes are built or pushed.
      - name: promote
        env:
          TARGET: ${{ steps.version.outputs.target }}
          DIGEST: ${{ steps.source.outputs.digest }}
        run: |
          if existing="$(docker buildx imagetools inspect "$TARGET" --format '{{.Manifest.Digest}}' 2>/dev/null)"; then
            if [ "$existing" != "$DIGEST" ]; then
              echo "::error::$TARGET already exists at $existing, not $DIGEST. A version tag is never moved."
              exit 1
            fi
            echo "$TARGET is already $DIGEST — nothing to promote."
          else
            docker buildx imagetools create --tag "$TARGET" "${IMAGE}@${DIGEST}"
          fi
          promoted="$(docker buildx imagetools inspect "$TARGET" --format '{{.Manifest.Digest}}')"
          if [ "$promoted" != "$DIGEST" ]; then
            echo "::error::$TARGET resolves to $promoted, not $DIGEST. The promotion did not copy the image."
            exit 1
          fi

      - name: checkout deployment
        uses: actions/checkout@v7
        with:
          repository: ${{ vars.DEPLOY_REPO }}
          ref: main
          path: deployment
          token: ${{ secrets.DEPLOY_REPO_TOKEN }}

      - name: deployment pull request
        id: pr
        working-directory: deployment
        env:
          GH_TOKEN: ${{ secrets.DEPLOY_REPO_TOKEN }}
          DEPLOY_REPO: ${{ vars.DEPLOY_REPO }}
          TAG: ${{ steps.version.outputs.tag }}
          COMMIT: ${{ steps.version.outputs.commit }}
          TARGET: ${{ steps.version.outputs.target }}
          DIGEST: ${{ steps.source.outputs.digest }}
        run: |
          branch="release/calechip-${TAG}"
          dir="$(dirname "$DEPLOY_FILE")"
          if [ ! -d "$dir" ]; then
            echo "::error::$DEPLOY_REPO has no $dir/ on main. Apply the CaleChip layout there first (CICD-05). Nothing was pushed."
            exit 1
          fi
          if git ls-remote --exit-code --heads origin "$branch" >/dev/null; then
            url="$(gh pr list --repo "$DEPLOY_REPO" --head "$branch" --state open --json url --jq '.[0].url // empty')"
            if [ -z "$url" ]; then
              echo "::error::$branch already exists in $DEPLOY_REPO with no open pull request. Delete the branch, then re-run."
              exit 1
            fi
            echo "Reusing the open pull request $url."
            echo "url=$url" >> "$GITHUB_OUTPUT"
            exit 0
          fi
          git switch -c "$branch"
          {
            echo "# Written by the calechip release workflow for ${TAG} (commit ${COMMIT}). Do not edit by hand."
            echo "CALECHIP_IMAGE=${TARGET}@${DIGEST}"
          } > "$DEPLOY_FILE"
          changed="$(git status --porcelain --untracked-files=all | awk '{print $2}')"
          if [ "$changed" != "$DEPLOY_FILE" ]; then
            echo "::error::Expected exactly $DEPLOY_FILE to change; got: ${changed:-nothing}. Nothing was pushed."
            exit 1
          fi
          git config user.name "github-actions[bot]"
          git config user.email "41898282+github-actions[bot]@users.noreply.github.com"
          git add -- "$DEPLOY_FILE"
          git commit -m "calechip ${TAG}"
          git push origin "$branch"
          url="$(gh pr create --repo "$DEPLOY_REPO" --base main --head "$branch" \
            --title "calechip ${TAG}" \
            --body "Pins CaleChip to \`${TARGET}@${DIGEST}\`, built from ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/commit/${COMMIT}. Opened by ${GITHUB_SERVER_URL}/${GITHUB_REPOSITORY}/actions/runs/${GITHUB_RUN_ID}. Merging deploys it.")"
          echo "url=$url" >> "$GITHUB_OUTPUT"

      # Last, so a Release on GitHub means the image was promoted and the deployment PR exists.
      - name: github release
        env:
          GH_TOKEN: ${{ github.token }}
          TAG: ${{ steps.version.outputs.tag }}
          PRERELEASE: ${{ steps.version.outputs.prerelease }}
          TARGET: ${{ steps.version.outputs.target }}
          DIGEST: ${{ steps.source.outputs.digest }}
          PR_URL: ${{ steps.pr.outputs.url }}
        run: |
          flags=(--verify-tag --generate-notes --title "$TAG")
          if [ "$PRERELEASE" = true ]; then flags+=(--prerelease); fi
          gh release create "$TAG" "${flags[@]}" \
            --notes "Image: \`${TARGET}@${DIGEST}\` · Deployment pull request: ${PR_URL}"

      - name: summary
        env:
          TAG: ${{ steps.version.outputs.tag }}
          COMMIT: ${{ steps.version.outputs.commit }}
          SOURCE: ${{ steps.version.outputs.source }}
          TARGET: ${{ steps.version.outputs.target }}
          DIGEST: ${{ steps.source.outputs.digest }}
          PR_URL: ${{ steps.pr.outputs.url }}
        run: |
          {
            echo "### Release ${TAG}"
            echo ""
            echo "- Commit: \`$COMMIT\`"
            echo "- Source: \`$SOURCE\`"
            echo "- Promoted: \`${TARGET}@${DIGEST}\`"
            echo "- Deployment pull request: $PR_URL"
          } >> "$GITHUB_STEP_SUMMARY"
```

**The names are the contract.** These names are fixed:
- workflow and job `release`;
- steps `inputs present`, `version`, `on main`, `image exists`, `promote`, `checkout deployment`,
  `deployment pull request`, `github release` and `summary`;
- outputs `steps.version.outputs.{tag,commit,source,target,prerelease}`,
  `steps.source.outputs.digest` and `steps.pr.outputs.url`;
- env `IMAGE` and `DEPLOY_FILE`;
- the variable `CALECHIP_IMAGE` inside `DEPLOY_FILE`.

CICD-05 reads the last two.

**The implementer verifies these and does not recall them** (`tech-stack.md` § *Versions the model
cannot recall*), and records each one in the impl log:

1. **`docker buildx imagetools inspect <ref> --format '{{.Manifest.Digest}}'` prints the bare
   `sha256:…` digest** for the single-platform image `build-image` pushes, and exits non-zero for a
   tag that does not exist. CICD-03 named the same format but never ran it. If the field differs,
   change the template. The shape stays: read digest → create from digest → compare.
2. **`imagetools create` from a single source manifest keeps the digest.** buildx's documentation or
   source should say that one source with no annotations is copied as-is. If it says otherwise, then
   AC-7's comparison would fail every run, and the promotion command must change to one that copies
   the manifest unchanged. The comparison itself stays.
3. **`gh release create` accepts `--notes` together with `--generate-notes`** and keeps both, with
   the notes given first. Check this in the `gh` manual for the version on `ubuntu-latest`. If it
   does not, drop the `--notes` and leave the image line to the summary only, and say so.
4. **The workflow parses.** Use the same method as CICD-03: `yaml` in the session scratchpad, not
   the project (R8).

**No tag is pushed and no registry is touched as part of this ticket's gate**
(`.claude/agents/devops.md` § Containers). The workflow first runs in CICD-06's dry run.

### 4.2 Inputs, names only

| Name | Kind | Used by | Content |
|---|---|---|---|
| `DOCKERHUB_USERNAME` | secret | `inputs present`, `docker/login-action` | the same secret `build-image` uses |
| `DOCKERHUB_TOKEN` | secret | `inputs present`, `docker/login-action` | the same secret `build-image` uses. It needs write access, because `imagetools create` pushes a tag |
| `DEPLOY_REPO_TOKEN` | secret | `inputs present`, `checkout deployment`, `deployment pull request` | a fine-grained token: the deployment repository only, *Contents* and *Pull requests* read/write |
| `DEPLOY_REPO` | variable | `inputs present`, `checkout deployment`, `deployment pull request` | `owner/name` of the deployment repository |

`VITE_*` values are not used here, because nothing is built.

## 5. Seam impact

**None.** No file under `src/` changes.

## 6. Schema delta

**`none`.** No migration, policy, trigger or constraint is involved. `requires_adr: true` in
`ticket.yaml` refers to ADR-059, which the operator accepted on 2026-10-13.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".github/workflows/release.yml"
```

**Glossary:** `glossary_owed` is `[]`, so no row was written.

**Branch:** `feat/CICD-04`, cut from `origin/main` at `f55092d`. The CI path guard is active on it.

**`size`: S (1 path). `size_estimate`: M.** They disagree, and the verdict stands (ADR-012). The M
counted the three systems the workflow acts on. The S counts files, and there is one.

## 8. Rejected alternatives

1. **Pull `:sha-<short>`, `docker tag` it, and `docker push` `:vX.Y.Z`.** This is the obvious
   route and works with any registry. It was rejected for two reasons. First, the pushed manifest
   can be re-serialised, so the digest can change, and the digest is exactly what the deployment
   pull request pins. Second, it moves image bytes through the runner for what is only a rename.
   `imagetools create` is what the feature row names, and AC-7's digest comparison proves the copy
   on every run.
2. **Push the deployment branch with the workflow's own `GITHUB_TOKEN`, or use one token for both
   repositories.** This is one secret fewer. It was rejected because `GITHUB_TOKEN` cannot write to
   another repository at all. A single broad token would also give the Release step write access to
   the deployment repository, and the deployment step write access to this one. The row asks for a
   token scoped to the deployment repository, with contents and pull-requests only.
3. **Wait for `build-image` to finish when `:sha-<short>` is absent** (poll, or trigger on
   `workflow_run`). A tag pushed seconds after a merge would then just work. It was rejected
   because the row says *"Fails if … `:sha-<short>` is absent"*. Polling also makes "is this image
   going to exist" a timeout question rather than a fact. A re-run after `build-image` succeeds
   costs one click, and the error says so (AC-6).
4. **Also check that the source image's `org.opencontainers.image.revision` label equals the full
   tagged commit.** This would guard against two commits sharing a 7-character prefix. It was
   rejected for now: such a collision is improbable at this repository's size, and the label's place
   in `imagetools inspect` output differs by manifest shape, which adds a fact to verify for little
   gain. If it is ever needed, it is one more step before `promote`.
5. **Have the deployment pull request edit the CaleChip compose file's `image:` line directly**
   rather than a dedicated `release.env`. That is one file fewer in the deployment repository. It
   was rejected because the workflow would have to parse and rewrite YAML it does not own, in a
   layout that does not exist yet. A file the workflow fully owns and fully rewrites is what makes
   the AC-10 check ("exactly this path changed") meaningful.

## Changelog

- `2026-10-14T02:13:31+00:00`: all sections written, gate PASS. Branch `feat/CICD-04` was created
  from `origin/main`. No AC was amended after reading the source tree. AC-6's tag scheme and AC-15's
  majors come from `build-image.yml` and are recorded in § 2.0 as facts, not as amendments. Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.
