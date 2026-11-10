---
ticket: CICD-03
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-13T22:24:01+07:00
inputs_read:
  - .ai/board/tickets/CICD-03/01-plan.md
  - .ai/board/tickets/CICD-03/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - "gh api repos/docker/build-push-action/contents/README.md?ref=v7.4.0"
  - "gh api repos/docker/setup-buildx-action/contents/action.yml?ref=v4.4.1"
  - "gh api repos/actions/runner-images/contents/images/ubuntu/Ubuntu2404-Readme.md, scripts/build/install-docker.sh"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CICD-03 — Implementation log

The plan names `devops` as implementer (ADR-059); the file was written in the Developer session that
`/implement` runs in, to the plan's § 4.1 text verbatim.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `.github/workflows/build-image.yml` | created | the only path in `allowed_paths`; builds, smoke-tests and pushes `sha-<short>` on push to `main` | § 4.1 (whole), § 4.2 secret names |
| `.ai/board/tickets/CICD-03/03-impl-log.md` | created | this stage's artifact | — (stage output) |
| `.ai/board/tickets/CICD-03/ticket.yaml` | modified | `state: REVIEW` on PASS | — (stage transition) |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 header comment, four secrets named | `.github/workflows/build-image.yml:3-14` | verbatim |
| 4.1 `on: push` to `main` only (AC-1) | `build-image.yml:16-18` | |
| 4.1 `permissions: contents: read` (AC-2) | `build-image.yml:20-21` | |
| 4.1 `concurrency` per commit | `build-image.yml:24-26` | |
| 4.1 `env.IMAGE` | `build-image.yml:28-29` | |
| 4.1 step `secrets present` (AC-3) | `build-image.yml:38-52` | names only, never echoes a value |
| 4.1 step `tag`, output `ref` (AC-5) | `build-image.yml:54-56` | `sha-${GITHUB_SHA::7}` |
| 4.1 Buildx + login (AC-13) | `build-image.yml:58-63` | |
| 4.1 step `build` (AC-4, AC-6, AC-7) | `build-image.yml:65-80` | `load: true`, `push: false`, gha cache, two labels, two build-args |
| 4.1 step `smoke test` (AC-8) | `build-image.yml:82-97` | |
| 4.1 step `remove smoke container`, `if: always()` (AC-9) | `build-image.yml:99-101` | |
| 4.1 step `push`, digest to summary (AC-9, AC-10) | `build-image.yml:104-115` | no `if:` |
| 4.2 secret names | `build-image.yml:40-43, 62-63, 77-78` | AC-2: `secrets.` appears only in these three places |

## Deviations from the design

`none`. The file is § 4.1 byte-for-byte.

## The three facts the plan asked to verify, not recall

1. **`type=gha` cache and `load: true` with the default builder.** `setup-buildx-action@v4.4.1`
   `action.yml`: `driver` defaults to `docker-container`. `build-push-action@v7.4.0` README: the
   `docker-container` driver is the one recommended "to be able to … export cache", and `load` is
   "a shorthand for `--output=type=docker`", which that driver supports. No setting changes.
2. **`RepoDigests` after `docker push`.** `actions/runner-images` `Ubuntu2404-Readme.md` lists
   Docker Server 28.0.4, and `install-docker.sh` sets no containerd snapshotter — the classic image
   store, where `docker push` populates `RepoDigests`. The `docker inspect` line stands as written.
   See open question 1.
3. **The workflow parses.** No YAML parser is installed in the project (`require.resolve('yaml')`
   fails; Python has no `yaml` module). `yaml@2.9.1` was installed into the session scratchpad — not
   the project, no manifest or lockfile change (R8) — and `parseDocument` returned zero errors, `on`
   keys `[push]`, `permissions` `{contents: read}`, and the nine steps in § 4.1 order.

## Invariants

`invariants_touched: []`. No `src/**`, seam or schema file changes; the workflow builds the image
the existing `Dockerfile` defines, so INV-01..INV-07, which constrain entries and the absence count,
are not reachable from this diff.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| unit tests | not run | no source file changed |
| `node scripts/check-allowed-paths.mjs` | 0 | `allowed-paths: PASS` |
| YAML parse (`yaml@2.9.1`, scratchpad) | 0 | see fact 3 |

No container was started (`.claude/agents/devops.md` § Containers). AC-11 and AC-12 are observable
only after merge.

## Testability contract

No UI; no selectors. The names that are the contract — workflow/job `build-image`, steps
`secrets present`, `tag`, `build`, `smoke test`, `remove smoke container`, `push`, output
`steps.tag.outputs.ref`, env `IMAGE` — are at the lines in *Contract items* above.

## Open questions

1. **`ubuntu-latest` can move to Docker 29**, whose fresh installs default to the containerd image
   store. If `RepoDigests` comes back empty there, `{{index .RepoDigests 0}}` fails the `push` step
   *after* the push has succeeded — a red run with the image in Docker Hub. The plan's named fallback
   is `docker buildx imagetools inspect`; not applied, because the runner verified today uses the
   classic store and the plan makes the fallback conditional on that.
2. Plan open question 1 stands: the four secrets do not exist, so the first push to `main` after
   merge is a red run at `secrets present` (AC-12) until the operator adds them.
