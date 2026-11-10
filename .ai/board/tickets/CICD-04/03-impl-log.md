---
ticket: CICD-04
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-14T09:29:29+07:00
inputs_read:
  - .ai/board/tickets/CICD-04/01-plan.md
  - .ai/board/tickets/CICD-04/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/board/tickets/CICD-03/03-impl-log.md
  - "gh api repos/docker/buildx/contents/docs/reference/buildx_imagetools_{create,inspect}.md"
  - "gh api repos/docker/buildx/contents/util/imagetools/{create,printers}.go?ref=v0.37.2"
  - "gh api repos/actions/runner-images/contents/images/ubuntu/Ubuntu2404-Readme.md — Docker-Buildx 0.37.2"
  - "gh release create --help (gh 2.98.0)"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CICD-04 — Implementation log

The plan names `devops` as implementer (ADR-059). The file was written in the Developer session that
`/implement` runs in, as CICD-03's was, from § 4.1's text, with the one change below.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `.github/workflows/release.yml` | created | the only path in `allowed_paths`; promotes `:sha-<short>` to `:vX.Y.Z` by digest, opens the deployment PR, creates the Release | § 4.1 (whole), § 4.2 input names |
| `.ai/board/tickets/CICD-04/03-impl-log.md` | created | this stage's artifact | — (stage output) |
| `.ai/board/tickets/CICD-04/ticket.yaml` | modified | `state: REVIEW` on PASS | — (stage transition) |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 header comment, inputs named | `.github/workflows/release.yml:3-16` | verbatim |
| `on: push` tags `v*.*.*` only (AC-1) | `release.yml:18-20` | |
| `permissions: contents: write` (AC-2) | `release.yml:22-23` | no job-level permissions |
| `concurrency` per tag | `release.yml:26-28` | |
| `env.IMAGE`, `env.DEPLOY_FILE` | `release.yml:30-33` | |
| step `inputs present` (AC-3) | `release.yml:44-58` | names only, never echoes a value |
| step `version`, outputs `tag,commit,source,target,prerelease` (AC-4) | `release.yml:60-77` | |
| step `on main` (AC-5) | `release.yml:79-86` | |
| Buildx + login (AC-15) | `release.yml:88-93` | |
| step `image exists`, output `digest` (AC-6) | `release.yml:95-105` | |
| step `promote` (AC-7, AC-8) | `release.yml:110-126` | see Deviations |
| step `checkout deployment` (AC-10) | `release.yml:130-136` | |
| step `deployment pull request`, output `url` (AC-10, AC-11, AC-12) | `release.yml:138-181` | |
| step `github release` (AC-13) | `release.yml:186-196` | |
| step `summary` (AC-14) | `release.yml:200-214` | |
| `secrets.` in exactly the four places (AC-2) | `release.yml:46-48, 92-93, 136, 142` | |

## Deviations from the design

**One, authorised by § 4.1 fact 2.** `promote` runs
`docker buildx imagetools create --prefer-index=false --tag "$TARGET" "${IMAGE}@${DIGEST}"`, not the
same command without `--prefer-index=false` (`release.yml:122`, with a two-line comment at
`release.yml:108-109`). The reason is fact 2 below. The plan says that if a single-manifest copy does
not keep the digest, the command must change to one that copies the manifest unchanged, and the
comparison stays. The comparison is unchanged. AC-7's literal command text now has one more flag;
the registry write is still the only one, and it is still from `@<digest>` to `:<tag>`.

## The four facts the plan asked to verify, not recall

1. **`imagetools inspect --format '{{.Manifest.Digest}}'` prints the bare digest.**
   `util/imagetools/printers.go@v0.37.2`: for a single manifest (Docker schema2 or OCI), the template
   input `.Manifest` is the `ocispecs.Descriptor` itself, and for an index it is a struct with a
   `Digest digest.Digest` field. Either way `.Manifest.Digest` renders `sha256:…` with no newline.
   A missing tag makes the resolve fail, so the command exits non-zero. The template stands.
   `ubuntu-latest` (Ubuntu 24.04 image readme) ships Docker-Buildx 0.37.2.
2. **`imagetools create` from one single-platform source does *not* keep the digest by default.**
   `util/imagetools/create.go@v0.37.2` `combine()`: with one source and no annotations, it returns the
   original bytes only when the source is already an index or list, or when `preferIndex` is false.
   `--prefer-index` defaults to `true` (reference doc). In that case one manifest is wrapped in a new
   index, which has a new digest. `build-image` pushes with `docker push` from the classic store
   (CICD-03 impl log, fact 2), so it pushes one schema2 manifest. Unchanged, AC-7's comparison would
   fail every run. Hence the deviation. If the source is ever an index, the flag is a no-op, because
   an index is carbon-copied regardless.
3. **`gh release create` keeps `--notes` together with `--generate-notes`.** `gh 2.98.0` help:
   *"Additional release notes can be prepended to automatically generated notes by using the `--notes`
   flag."* The `--notes` line stands.
4. **The workflow parses.** `yaml@2.9.1` was installed in the session scratchpad, not the project, and
   no manifest changed (R8). `parseDocument` reported 0 errors, `on` = `{push:{tags:['v*.*.*']}}`,
   `permissions` = `{contents: write}`, and the twelve steps in § 4.1 order.

## Invariants

`invariants_touched: []`. No `src/**`, seam or schema file changes. The workflow renames an image tag
and opens a pull request in another repository. INV-01..INV-07 constrain entries and the absence
count, and this diff cannot reach them.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| unit tests | not run | no source file changed |
| `node scripts/check-allowed-paths.mjs` | 0 | `PASS`. It counted 0 changed files because the workflow is still untracked; `git status --porcelain` lists only `?? .github/workflows/release.yml` besides this ticket's board files |
| YAML parse (`yaml@2.9.1`, scratchpad) | 0 | fact 4 |

No tag was pushed and no registry was touched (`.claude/agents/devops.md` § Containers). AC-17 and
AC-18 can be observed only after merge.

## Testability contract

No UI and no selectors. The names that form the contract are at the lines in *Contract items*:
workflow/job `release`; the nine named steps; outputs
`steps.version.outputs.{tag,commit,source,target,prerelease}`, `steps.source.outputs.digest`,
`steps.pr.outputs.url`; env `IMAGE`, `DEPLOY_FILE`; `CALECHIP_IMAGE` inside `DEPLOY_FILE`.

## Open questions

1. **AC-9 says "`latest` does not appear anywhere in the file", but § 4.1's own text has
   `runs-on: ubuntu-latest`** (`release.yml:37`), as `build-image.yml` does. That is the runner
   label, not an image tag. The intent of AC-9, *"Never deploy `:latest`"*, holds: no image
   reference names `:latest`. The file follows § 4.1. The reviewer should read AC-9 as being about
   image tags. If it has to be literal, the runner label must be pinned to `ubuntu-24.04`, and that
   needs a plan amendment.
2. Plan open questions 1–3 stand. None of `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`,
   `DEPLOY_REPO_TOKEN` or `DEPLOY_REPO` exists yet. The first tag push after merge is a red run at
   `inputs present` until the operator adds them, and until the deployment repository has
   `apps/calechip/`.
