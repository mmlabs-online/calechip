---
ticket: CICD-04
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-14T02:33:56+00:00
inputs_read:
  - .ai/board/tickets/CICD-04/01-plan.md
  - .ai/board/tickets/CICD-04/03-impl-log.md
  - .ai/board/tickets/CICD-04/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - .github/workflows/release.yml
  - "git diff origin/main...HEAD (3 files); git status --porcelain (clean)"
  - "node scripts/check-allowed-paths.mjs; node scripts/check-carry.mjs CICD-04"
  - "pnpm exec tsc --noEmit; pnpm exec eslint ."
  - "gh api repos/docker/buildx/contents/{util/imagetools/create.go,commands/imagetools/create.go}?ref=v0.37.2"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
verdict: PASS
failed_checks: []
invariant_violation: false
route_to: none
increments_rework: false
---

# CICD-04 — Review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff within `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket CICD-04, 3 changed file(s)` / `allowed-paths: PASS`, exit 0. Changed outside the ticket folder: `.github/workflows/release.yml:1-216` only. `node scripts/check-carry.mjs CICD-04` → `0 uncommitted path(s)` / `PASS — nothing stray`, exit 0 |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 (no source file in the diff) |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint .` exit 0, no output; the diff holds no lintable file |
| R4 | No datastore access outside the seam (RULE-02) | PASS | No `src/**` in the diff; `.github/workflows/release.yml:1-216` talks only to git, Docker Hub and GitHub |
| R5 | Every § 4 contract item implemented (RULE-04) | PASS | `diff` of plan § 4.1 against `.github/workflows/release.yml` differs only at `:108-109` (comment) and `:122` (`--prefer-index=false`), the change § 4.1 fact 2 authorises. Detail below |
| R6 | Permission gating matches § 3 | PASS | § 3 changes no product role. Workflow gating: `:18-20` (tag trigger only), `:22-23` (`contents: write`, no job-level widening), `:79-86` (on main), `:115-119` (never move a tag), `:136,142` (`DEPLOY_REPO_TOKEN` only for the deployment repo), `:188` (`github.token` only for the Release) |
| R7 | No invariant violated (RULE-07) | PASS | `invariants_touched: []` (`ticket.yaml:16`); no `src/**`, seam or schema file in the diff. Detail below |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; the actions used (`release.yml:40,88,90,131`) are the majors already in `build-image.yml`, per AC-15 |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| Header comment, named inputs | `release.yml:3-16` | yes, verbatim |
| AC-1 trigger `push` tags `v*.*.*`, nothing else | `release.yml:18-20` | yes |
| AC-2 `permissions: contents: write`; `secrets.` in four places | `release.yml:22-23`; `:46-48`, `:92-93`, `:136`, `:142` | yes. `grep secrets.` finds exactly those lines |
| Concurrency per tag, no cancel | `release.yml:26-28` | yes |
| `env.IMAGE`, `env.DEPLOY_FILE` | `release.yml:30-33` | yes |
| AC-3 `inputs present`, names only | `release.yml:44-58` | yes. Uses `${!name}` and prints only names |
| AC-4 `version`, regex, outputs `tag,commit,source,target,prerelease` | `release.yml:60-77` | yes. Runs before login (`:90`) |
| AC-5 `on main` | `release.yml:79-86` | yes. `fetch-depth: 0` at `:42` provides `origin/main` and the tag |
| AC-15 action majors | `release.yml:40,88,90,131` | yes: checkout@v7, setup-buildx@v4, login@v4 only |
| AC-6 `image exists`, output `digest` | `release.yml:95-105` | yes. Error names the reference, `build-image` and the re-run |
| AC-7 copy by digest, no build or push, post-check | `release.yml:122`, `:124-128` | yes, with one authorised flag. Plan § 4.1 fact 2 says that if a single-manifest copy does not keep the digest, the command changes and the comparison stays. Verified independently: `commands/imagetools/create.go@v0.37.2:403` defaults `prefer-index` to `true`, and `util/imagetools/create.go@v0.37.2:116-117` returns the source bytes unchanged only when `!preferIndex`. Without the flag the AC-7 comparison would fail every run. No `docker build`, `buildx build`, `build-push-action` or `docker push` appears in the file |
| AC-8 never move a tag | `release.yml:115-120` | yes. A different digest exits before `create`; the same digest skips it |
| AC-9 no other image tag | `release.yml:74-75`, `:122` | yes. `:sha-` is only read (`:74`, `:98-100`), and only `:<tag>` is written. The one `latest` in the file is the runner label `ubuntu-latest` at `:37`. That label is part of § 4.1's exact text, and AC-9's *When* clause scopes it to image references. Read that way, it holds |
| AC-10 deployment checkout and one-file PR | `release.yml:130-136`; `:149`, `:166-169`, `:170-174`, `:177-182` | yes. Branch `release/calechip-<tag>`, `CALECHIP_IMAGE=<target>@<digest>`, exact-path check, `gh pr create --repo "$DEPLOY_REPO"` with `GH_TOKEN` from `DEPLOY_REPO_TOKEN` (`:142`) |
| AC-11 no `apps/calechip/` means no PR | `release.yml:150-154` | yes. Exits before any push |
| AC-12 re-run reuses the open PR | `release.yml:155-164` | yes |
| AC-13 Release last, no `if:` | `release.yml:186-198` | yes. `--verify-tag --generate-notes --title`, `--prerelease` on `true`, `github.token` |
| AC-14 step summary | `release.yml:200-216` | yes. Lists tag, commit, source, promoted reference with digest, and PR URL |
| AC-16 scope | `git diff --name-only origin/main...HEAD` | yes. Only `release.yml` outside the ticket folder; `build-image.yml` unchanged |
| AC-17, AC-18 | — | observable after merge only (plan § 2.1); not a gate item here |
| Contract names (§ 4.1 *The names are the contract*) | `release.yml:1,36`, steps `:44,60,79,95,110,130,138,186,200`, ids `:61,96,139`, env `:31,33`, `CALECHIP_IMAGE` `:168` | yes |

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml:16`). Each invariant was considered against the diff:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01..INV-07 | Not reachable. They constrain entries and the absence count, and they live behind the seam in `src/**` and the schema. The diff touches neither. | `git diff --name-only origin/main...HEAD` → `.github/workflows/release.yml` plus this ticket's board files |

## Findings

None.

## Verdict

PASS. All eight checks pass, and the ticket advances to DONE at `/ship`.
