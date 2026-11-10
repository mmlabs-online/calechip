---
ticket: CICD-03
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-13T15:07:53+00:00
inputs_read:
  - .ai/board/tickets/CICD-03/ticket.yaml
  - .ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-059-delivery-work-is-a-seventh-feature-group.md
  - .ai/templates/plan.md
  - .ai/steward/context.md
  - .ai/board/tickets/CICD-02/01-plan.md
  - .claude/agents/devops.md
  - .github/workflows/verify.yml
  - Dockerfile
  - docker/nginx.conf
  - .dockerignore
  - .env.example
  - "gh api repos/docker/{setup-buildx-action,login-action,build-push-action}/releases/latest — v4.4.1, v4.6.0, v7.4.0, 2026-10-13"
  - "gh api .../contents/action.yml at those tags — inputs as used in § 4.1; all three run node24"
  - "gh secret list, gh variable list — both empty, 2026-10-13"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CICD-03 — Plan

## 0. Stated first

- **Implementer: `devops`, not `developer`** (ADR-059 § Consequences). The one path in § 7 is a
  workflow; none is application code.
- **The repository holds no Actions secrets today** (`gh secret list` empty, 2026-10-13). The
  workflow this ticket adds runs only on push to `main`, so nothing fails before merge — but the
  first merge after this one fails at its first step until the operator adds the four secrets of
  § 4.2. That is the operator's action (secrets are repository settings), stated in Open question 1
  and in the workflow's header so it cannot be missed.

## 1. Problem and scope

**Feature ID, transcribed from `.ai/registry/features.md:255`:**

> | CICD-03 | Every merge to `main` builds one image, pushes it to Docker Hub tagged by its commit, and smoke-tests it against the image's health endpoint | CICD | PLANNED | | From `.ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md`, re-triaged PROMOTE on 2026-10-13 after ADR-059 and ADR-060. Phase 3. Buildx with the GHA cache, `mingming21400/calechip:sha-<short>`, secrets `DOCKERHUB_USERNAME` and `DOCKERHUB_TOKEN`. The health endpoint already exists: the `healthz` location in `docker/nginx.conf`, probed by the `Dockerfile` `HEALTHCHECK`. **Every `VITE_*` value is baked in at build** (`Dockerfile` header), so the build also needs the Supabase URL and anon key as Actions secrets, and one image serves one Supabase project. |

**Who gains what.** The operator, who builds and deploys by hand today, gets for every commit that
lands on `main` one image in Docker Hub whose tag names that commit, that has been started and has
answered its health endpoint before anyone can pull it. That image is the input CICD-04 promotes by
digest without rebuilding; without it there is nothing to release, and a hand-built image carries no
record of which commit or which Supabase project it was built from.

**In scope:**

1. `.github/workflows/build-image.yml`, new: on push to `main`, build the `Dockerfile` once with
   Buildx and the GHA cache, start the built image and probe `/healthz`, and only then push it as
   `mingming21400/calechip:sha-<short>`, writing tag and digest to the run summary.

**Out of scope — and where each goes:**

- **Adding the Actions secrets.** The operator, in repository settings (RULE-09 spirit; no workflow
  or agent writes a secret). Open question 1.
- **Promoting to `:vX.Y.Z`, any `:latest` tag, a GitHub Release** — CICD-04.
- **Deploying, the deployment repository, rollback** — CICD-05.
- **`docs/ops/ci-cd.md`, the secrets table, `tech-stack.md` § *Build and deployment*** — CICD-06.
- **A notification beyond GitHub's own failed-run notification.** The request's table says
  *"failure alerts"*; the feature row does not name a channel. A red run on `main` notifies its
  actor by GitHub default, and a channel (Slack, mail) would need a decision and a secret.
- **Gating the build on `verify`.** The build runs on every push to `main` independently of the
  gate (§ 8 alternative 2); once branch protection is applied, nothing reaches `main` red.
- **Changing `Dockerfile`, `docker/nginx.conf`, `.dockerignore`.** The image and its health
  endpoint exist and are used as they are. The stale `.dockerignore:9` comment (*"`VITE_*` values
  reach the build as --build-arg only, never from a file"* — the `Dockerfile` also accepts a
  BuildKit secret file) is left; it is not this ticket's surface.
- **Multi-platform images.** One platform, `linux/amd64`. Open question 2.
- **`.claude/agents/devops.md`'s stale *CI shape* and *Containers* TODOs** — model surface, `/thuki`.
- **A staging image.** Staging is assumed absent (idea, question 3); a second Supabase project
  would need a second build, because `VITE_*` values are baked in.

`size_estimate`: **S** — one new workflow file against an image and a health endpoint that exist.

## 2. Acceptance criteria

### 2.0 Facts the criteria rest on

- **The health endpoint:** `location = /healthz` returns `200` with body `ok\n`
  (`docker/nginx.conf`); the container listens on `3000` (`Dockerfile` `EXPOSE 3000`).
- **An empty `VITE_SUPABASE_URL` fails the image build** unless `VITE_DATA_SEAM=mock`
  (`Dockerfile`, the `RUN` before `pnpm run build`). So an image built without the secrets is
  refused at build, not pushed as a silent mock.
- **The `ARG`s are the intended CI path** (`Dockerfile`: *"The ARGs remain for CI or one-off
  overrides"*), and the values are public by design (`.env.example`; the `check=skip` line).
- **Current majors** (`gh api …/releases/latest`, 2026-10-13): `docker/setup-buildx-action` v4,
  `docker/login-action` v4, `docker/build-push-action` v7, all `runs: node24`; `actions/checkout@v7`
  is CICD-02's verified major.

### 2.1 Criteria

Criteria AC-1 to AC-10 are checked from the file at this ticket's head. **AC-11 and AC-12 can only
be observed after merge**, on the first push to `main` with the secrets in place; `/ship` records
them as not yet observable, and CICD-06's dry run of a merge is where they are first checked.

**AC-1 — the build runs on a push to `main`, and on nothing else**
- Given `.github/workflows/build-image.yml`
- When its `on:` block is read
- Then it is exactly `push` to `branches: [main]`; there is no `pull_request`, `pull_request_target`,
  `workflow_dispatch`, `tags` or other branch pattern

**AC-2 — least privilege, and secrets only where they are used**
- Given the same file
- When it is read
- Then its top-level `permissions:` is exactly `contents: read`; it contains no `: write`,
  `write-all` or `read-all`; and `secrets.` appears only in the `secrets present` step's `env`, the
  `docker/login-action` `with:`, and the `build-args` of the build step

**AC-3 — missing secrets fail the run first, by name, without printing a value**
- Given the `secrets present` step, the job's first step after checkout
- When any of `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`
  is empty
- Then the step exits non-zero and its output names every empty secret by name and echoes no secret
  value

**AC-4 — one image is built, with Buildx and the GHA cache, and loaded, not pushed, by the build**
- Given the build step
- When it is read
- Then it uses `docker/build-push-action@v7` after `docker/setup-buildx-action@v4`; `context: .`;
  `platforms: linux/amd64`; `load: true`; `push: false`; `cache-from: type=gha`;
  `cache-to: type=gha,mode=max`; and the workflow contains exactly one build step

**AC-5 — the tag names the commit, and there is no other tag**
- Given the workflow
- When the image reference it builds, runs and pushes is read
- Then it is `mingming21400/calechip:sha-<short>` where `<short>` is the first 7 characters of
  `github.sha`; no `latest`, no version tag and no second tag appears anywhere in the file

**AC-6 — the image carries the commit it was built from**
- Given the build step
- When its `labels:` are read
- Then they are `org.opencontainers.image.revision=${{ github.sha }}` and
  `org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}`

**AC-7 — `VITE_*` values reach the build as the two Supabase secrets, and nothing else is set**
- Given the build step's `build-args`
- When read
- Then they are exactly `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from the secrets of the same
  names; `VITE_DATA_SEAM` and `VITE_REQUIRE_EMAIL_CONFIRMATION` are not passed, so the image uses
  Supabase and email confirmation off — the configuration `.env.example` documents as current

**AC-8 — the smoke test runs the built image and probes its health endpoint before any push**
- Given the `smoke test` step, after the build step and before the push step
- When it runs
- Then it starts the built image detached with port `3000` published; retries
  `http://127.0.0.1:3000/healthz` once per second for at most 30 attempts; fails unless one attempt
  returns HTTP 200 with body `ok`; then requires `http://127.0.0.1:3000/` to return HTTP 200; and on
  any failure prints the container's logs before exiting non-zero

**AC-9 — a failed smoke test pushes nothing**
- Given the push step
- When its position and condition are read
- Then it comes after `smoke test`, has no `if:` that would run it after a failure (no `always()`,
  `failure()` or `!cancelled()`), and is the only step that writes to the registry; the smoke
  container is removed by a cleanup step that runs `if: always()`

**AC-10 — the pushed image is the tested image, and its digest is recorded**
- Given the push step
- When it is read
- Then it pushes the loaded `mingming21400/calechip:sha-<short>` with `docker push` — no second
  build — and writes the tag and the repository digest (`docker inspect` `RepoDigests`) to
  `$GITHUB_STEP_SUMMARY`

**AC-11 — post-merge: a merge produces the image** *(observable after merge only)*
- Given the four secrets set, and a commit pushed to `main`
- When the `build-image` run for it completes
- Then it concludes `success`, and `docker buildx imagetools inspect
  mingming21400/calechip:sha-<short>` resolves to the digest in that run's summary

**AC-12 — post-merge: a missing secret is a red run, not a pushed image** *(observable after merge
only)*
- Given the secrets absent (the state on 2026-10-13)
- When a commit is pushed to `main`
- Then `build-image` concludes `failure` at `secrets present`, and no `sha-<short>` tag for that
  commit exists in Docker Hub

**AC-13 — action majors**
- Given every `uses:` in `build-image.yml`
- When read
- Then each is one of `actions/checkout@v7`, `docker/setup-buildx-action@v4`,
  `docker/login-action@v4`, `docker/build-push-action@v7`, and no other action is used

**AC-14 — the refusals of scope**
- Given `git diff origin/main --stat` at this ticket's head
- When it is read
- Then the only path outside `.ai/board/tickets/CICD-03/` and the ship-owned set is
  `.github/workflows/build-image.yml`; `Dockerfile`, `docker/**`, `.dockerignore` and every other
  workflow are unchanged; no file contains a secret value

**Invariants touched: `[]`.** INV-01..INV-07 constrain entries and the absence count
(`.ai/registry/invariants.md`). This ticket changes no `src/**`, seam or schema; it builds the image
the `Dockerfile` already defines.

**Open questions — none blocking.**

1. **The four secrets do not exist yet.** The operator adds `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`
   (a Docker Hub access token with read/write on `mingming21400/calechip`, not the account password),
   `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` (the production project's) under *Settings →
   Secrets and variables → Actions*. Until then every push to `main` gives a red `build-image` run at
   its first step (AC-12), which is the intended loud failure. The two `VITE_*` names are this plan's
   choice — the row says *"the Supabase URL and anon key as Actions secrets"* without naming them —
   and match the build-arg names so the mapping is one-to-one.
2. **Platform: `linux/amd64` only — assumed.** The server is WSL2 Ubuntu on a Windows PC (request
   § 3), taken to be x86-64. An ARM host would need `linux/arm64` added, which also means QEMU and a
   smoke test that cannot run the foreign platform; not designed for here.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

*There is no screen in this ticket. The only arrangement it originates is the step order of § 4.1.*

## 3. Permission model

**No product role gains or loses anything.** No route, control, seam function or policy changes;
`.ai/standards/rbac-and-security.md` has nothing to apply and check R6 reads `none`.

| Action | Who may | Where enforced |
|---|---|---|
| Add or rotate the four Actions secrets | the operator only | repository settings, by hand |
| Push `mingming21400/calechip:sha-*` | the `build-image` workflow, on push to `main` only, after a passing smoke test | `on:` (AC-1), step order (AC-9), the Docker Hub token's scope |
| The workflow's `GITHUB_TOKEN` | `contents: read` | `permissions:` (AC-2) |
| Read the secrets | the three steps that use them | AC-2; GitHub never exposes secrets to `pull_request` runs from forks, and this workflow has no `pull_request` trigger at all |
| Change `.github/**` | an agent writes, the code owner approves at merge | `.github/CODEOWNERS` |

**Denied:** no pull-request run, no fork and no branch other than `main` can build or push an image
(AC-1). No workflow writes a secret or a repository setting. The token is never echoed (AC-3).

## 4. Contract

### 4.1 `.github/workflows/build-image.yml` — new, exactly

```yaml
name: build-image

# Every push to main builds ONE image from the Dockerfile, starts it, probes /healthz, and only then
# pushes it to Docker Hub as mingming21400/calechip:sha-<first 7 of the commit>. Nothing else is
# tagged here: :vX.Y.Z is promoted from this tag by digest, without rebuilding (CICD-04). CICD-03.
#
# Not a required check, and not gated on `verify` — branch protection keeps main green; this turns
# what is on main into an image.
#
# NEEDS FOUR ACTIONS SECRETS, added by the operator, or every run fails at `secrets present`:
#   DOCKERHUB_USERNAME, DOCKERHUB_TOKEN           — a Docker Hub access token, read/write on the repo
#   VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY     — the production project. Baked into the bundle at
#                                                   build (see the Dockerfile header): one image
#                                                   serves one Supabase project.

on:
  push:
    branches: [main]

permissions:
  contents: read

# One run per commit; a later merge never cancels an earlier build.
concurrency:
  group: build-image-${{ github.sha }}
  cancel-in-progress: false

env:
  IMAGE: mingming21400/calechip

jobs:
  build-image:
    runs-on: ubuntu-latest
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7

      - name: secrets present
        env:
          DOCKERHUB_USERNAME: ${{ secrets.DOCKERHUB_USERNAME }}
          DOCKERHUB_TOKEN: ${{ secrets.DOCKERHUB_TOKEN }}
          VITE_SUPABASE_URL: ${{ secrets.VITE_SUPABASE_URL }}
          VITE_SUPABASE_ANON_KEY: ${{ secrets.VITE_SUPABASE_ANON_KEY }}
        run: |
          missing=""
          for name in DOCKERHUB_USERNAME DOCKERHUB_TOKEN VITE_SUPABASE_URL VITE_SUPABASE_ANON_KEY; do
            [ -n "${!name}" ] || missing="$missing $name"
          done
          if [ -n "$missing" ]; then
            echo "::error::Missing Actions secrets:$missing — add them under Settings → Secrets and variables → Actions."
            exit 1
          fi

      - name: tag
        id: tag
        run: echo "ref=${IMAGE}:sha-${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"

      - uses: docker/setup-buildx-action@v4

      - uses: docker/login-action@v4
        with:
          username: ${{ secrets.DOCKERHUB_USERNAME }}
          password: ${{ secrets.DOCKERHUB_TOKEN }}

      - name: build
        uses: docker/build-push-action@v7
        with:
          context: .
          platforms: linux/amd64
          load: true
          push: false
          tags: ${{ steps.tag.outputs.ref }}
          labels: |
            org.opencontainers.image.revision=${{ github.sha }}
            org.opencontainers.image.source=${{ github.server_url }}/${{ github.repository }}
          build-args: |
            VITE_SUPABASE_URL=${{ secrets.VITE_SUPABASE_URL }}
            VITE_SUPABASE_ANON_KEY=${{ secrets.VITE_SUPABASE_ANON_KEY }}
          cache-from: type=gha
          cache-to: type=gha,mode=max

      - name: smoke test
        env:
          REF: ${{ steps.tag.outputs.ref }}
        run: |
          docker run -d --name smoke -p 3000:3000 "$REF"
          ok=""
          for i in $(seq 1 30); do
            if [ "$(curl -fsS http://127.0.0.1:3000/healthz 2>/dev/null)" = "ok" ]; then ok=1; break; fi
            sleep 1
          done
          if [ -z "$ok" ] || ! curl -fsS -o /dev/null http://127.0.0.1:3000/; then
            echo "::error::Smoke test failed: /healthz did not answer ok, or / did not answer 200."
            docker logs smoke
            exit 1
          fi
          echo "healthz ok after ${i}s; / answered 200"

      - name: remove smoke container
        if: always()
        run: docker rm -f smoke || true

      # Pushes the image that was just tested — the same local image, not a second build.
      - name: push
        env:
          REF: ${{ steps.tag.outputs.ref }}
        run: |
          docker push "$REF"
          digest="$(docker inspect --format '{{index .RepoDigests 0}}' "$REF")"
          {
            echo "### Image"
            echo ""
            echo "- Tag: \`$REF\`"
            echo "- Digest: \`$digest\`"
          } >> "$GITHUB_STEP_SUMMARY"
```

**Names are the contract.** Workflow and job `build-image`; step names `secrets present`, `tag`,
`build`, `smoke test`, `remove smoke container`, `push`; the step output `steps.tag.outputs.ref`;
the env `IMAGE`. CICD-04 reads the tag scheme `sha-<first 7 of the commit>` and must compute it the
same way.

**Note on `curl -fsS … /healthz`:** nginx returns `ok\n`; command substitution strips the trailing
newline, so the comparison is against `ok`.

**Implementer verifies, does not recall** (`tech-stack.md` § *Versions the model cannot recall*),
and records each in the impl log:

1. That `type=gha` cache works with the builder `setup-buildx-action@v4` creates by default, and with
   `load: true`, from `build-push-action@v7`'s README at `v7.4.0`. If `load` with that driver needs a
   different setting, the setting changes; the shape (one build, loaded, smoke-tested, then pushed)
   does not.
2. That `docker inspect` `RepoDigests` is populated after `docker push` on the runner's Docker
   engine. If the runner uses the containerd image store and the field is empty, take the digest
   from `docker buildx imagetools inspect "$REF" --format '{{json .Manifest.Digest}}'` instead, and
   say so.
3. The workflow parses: `actionlint` is not a project dependency and must not become one (R8), so
   validate with a YAML parse (`node -e` with the already-installed `yaml` package, if present, else
   `python -c 'import yaml'`) and state which was used.

**No container is started as part of this ticket's gate** (`.claude/agents/devops.md` § Containers).
The smoke test runs in Actions, after merge.

### 4.2 Secrets — names only

| Secret | Used by | Content |
|---|---|---|
| `DOCKERHUB_USERNAME` | `secrets present`, `docker/login-action` | Docker Hub account `mingming21400` |
| `DOCKERHUB_TOKEN` | `secrets present`, `docker/login-action` | a Docker Hub access token, read/write |
| `VITE_SUPABASE_URL` | `secrets present`, `build` build-arg | the production project URL |
| `VITE_SUPABASE_ANON_KEY` | `secrets present`, `build` build-arg | the production project anon key |

Never `SUPABASE_SERVICE_ROLE_KEY` (`.env.example`, *What must NEVER appear*).

## 5. Seam impact

**None.** No file under `src/` changes.

## 6. Schema delta

**`none`.** No migration, policy, trigger or constraint. `requires_adr: true` in `ticket.yaml` refers
to ADR-059, `ACCEPTED by the operator` on 2026-10-13.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".github/workflows/build-image.yml"
```

**Glossary:** `glossary_owed` is `[]`; no row written.

**Branch:** `feat/CICD-03`, cut from `origin/main` at `7f4c28e`. The CI path guard is active on it.

**`size`: S — 1 path. `size_estimate`: S. They agree.**

## 8. Rejected alternatives

1. **Push first, then pull by digest and smoke-test what is in the registry** — the request's own
   order (push, then smoke). It tests the registry copy rather than the local one. Rejected: a failed
   smoke test would leave a broken `:sha-<short>` in Docker Hub, and CICD-04's only existence check is
   *"`:sha-<short>` is present"* — it would promote the broken image. Smoke-then-push makes the tag's
   existence mean *it started and answered*, and pushing the loaded image is still one build.
2. **Trigger on `workflow_run` of `verify` succeeding on `main`.** Builds only green commits.
   Rejected: `workflow_run` executes the workflow file from the default branch with a different
   event payload (`github.sha` is not the triggering commit's — it must be read from
   `github.event.workflow_run.head_sha`), which is easy to get subtly wrong; and once branch
   protection is applied (CICD-02, CHECKPOINT 1) a red commit cannot reach `main`, so the gate would
   only add latency and a second place for the tag to be computed.
3. **Pass `VITE_*` as a BuildKit secret file** (`secrets: env=…`), the `Dockerfile`'s preferred local
   path. Keeps the values out of build-arg history. Rejected: the values are public by design and are
   inlined into the bundle anyway, so hiding them from image history protects nothing; the
   `Dockerfile` names build-args as the CI path; and assembling a multi-line secret file in YAML is
   more fragile than two build-args.
4. **`docker/metadata-action` for the tag and labels.** The idiomatic route, `type=sha` gives
   `sha-<7>`. Rejected: a fifth action, and an inline shell expression whose output CICD-04 can
   reproduce exactly is easier to keep in step than an action's default whose short length is a
   setting.

## Changelog

- `2026-10-13T15:07:53+00:00` — all sections written; gate PASS. Branch `feat/CICD-03` created from
  `origin/main`. No AC amended after reading the source tree. Raised by `tech-lead-design`.
  Amended by `tech-lead-design`.
