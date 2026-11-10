---
ticket: CICD-05
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-14T03:47:45+00:00
inputs_read:
  - .ai/board/tickets/CICD-05/01-plan.md
  - .ai/board/tickets/CICD-05/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/board/tickets/CICD-04/03-impl-log.md
  - .claude/agents/devops.md
  - docs/ops/branch-protection.md
  - "gh api repos/docker/compose/contents/docs/reference/compose_up.md (--wait, --wait-timeout)"
  - "gh api repos/docker/compose/contents/pkg/compose/{start,service_containers}.go and pkg/e2e/up_test.go"
  - "gh api repos/actions/runner-images/contents/images/ubuntu/Ubuntu2404-Readme.md (GitHub CLI 2.102.0)"
  - "gh pr diff --help (gh 2.98.0)"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CICD-05 — Implementation log

The plan names `devops` as implementer (ADR-059). The files were written in the Developer session
that `/implement` runs in, as CICD-03's and CICD-04's were. The three YAML files and `CODEOWNERS`
were extracted mechanically from the fenced blocks of plan § 4.1 to § 4.4, so they are byte-for-byte
the contract. The README was written from AC-18 to AC-20.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `docs/ops/deployment-repo/apps/calechip/compose.yml` | created | CaleChip's service, image only from `release.env` | § 4.1; AC-1..AC-4 |
| `docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml` | created | deploy, health check, restore, notify on the self-hosted runner | § 4.2; AC-5..AC-14 |
| `docs/ops/deployment-repo/.github/workflows/pr-scope.yml` | created | a `release/<app>-v…` PR may change only `apps/<app>/` | § 4.3; AC-15, AC-16 |
| `docs/ops/deployment-repo/.github/CODEOWNERS` | created | owner of `.github/` and `apps/calechip/` | § 4.4; AC-17 |
| `docs/ops/deployment-repo/README.md` | created | how the operator applies the drafts; specified by AC, not by text | § 4 (README); AC-18..AC-20 |
| `.ai/board/tickets/CICD-05/03-impl-log.md` | created | this stage's artifact | — (stage output) |
| `.ai/board/tickets/CICD-05/ticket.yaml` | modified | `state: IN_PROGRESS` at start, `REVIEW` on PASS | — (stage transition) |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `name: calechip`, one service (AC-1) | `apps/calechip/compose.yml:11-13` | |
| 4.1 `image: ${CALECHIP_IMAGE:?…}` (AC-1) | `compose.yml:15` | the only image reference |
| 4.1 health check, `restart` (AC-3) | `compose.yml:16-22` | |
| 4.1 external network, placeholder (AC-2) | `compose.yml:23-29` | no `ports:`, `environment:`, `env_file:`, `secrets:`, `volumes:` (AC-4) |
| 4.2 `on:` push `main`, `apps/calechip/**` (AC-5) | `deploy-calechip.yml:11-14` | |
| 4.2 `permissions:` (AC-7) | `deploy-calechip.yml:16-18` | `secrets.` appears nowhere |
| 4.2 `concurrency:` (AC-6) | `deploy-calechip.yml:20-22` | |
| 4.2 `runs-on: [self-hosted, linux, home-wsl]` (AC-7) | `deploy-calechip.yml:30` | |
| 4.2 step `release`, outputs `skip,image,previous` (AC-8..AC-10) | `deploy-calechip.yml:37-66` | |
| 4.2 step `deploy` (AC-11) | `deploy-calechip.yml:68-75` | `config --quiet`, `pull`, `up -d --wait --wait-timeout 120`, all `-p calechip` |
| 4.2 step `rollback`, output `result` (AC-12, AC-13) | `deploy-calechip.yml:77-109` | restore at :90, push at :102 |
| 4.2 step `notify` (AC-14) | `deploy-calechip.yml:111-137` | summary at :133, PR lookup at :134, comment at :136 |
| 4.3 `on:`, `permissions:`, `runs-on: ubuntu-latest` (AC-16) | `pr-scope.yml:7-17` | |
| 4.3 head ref only through `env:` (AC-16) | `pr-scope.yml:23,26` | |
| 4.3 scope check (AC-15) | `pr-scope.yml:26-37` | |
| 4.4 CODEOWNERS (AC-17) | `.github/CODEOWNERS:1-4` | |
| AC-18 section order | `README.md:7,33,67,87,116,145,170` | *What this is* … *Secrets* |
| AC-18 checklist, item 1 is secrets | `README.md:36-38` | private :39, network :41, ingress :44, hand-run container :46, pull :48, `DEPLOY_REPO` :50, bot push :52 |
| AC-19 | `README.md:116-143` | image and folder only, never the database; migrations compatible with the previous image (RULE-09); a revert is still a red run |
| AC-20 | `README.md:145-168` | non-root, this repository only, `home-wsl`, outbound only; `docker` group = root; no `pull_request` workflow on the self-hosted runner |
| 4.5 names | as above | every fixed name present, none added |

## Deviations from the design

`none`. All four facts in § 4.5 held, so no fallback was used.

## The four facts the plan asked to verify, not recall

1. **`docker compose up --wait --wait-timeout` exists, and `--wait` fails non-zero on an unhealthy
   service.** `docs/reference/compose_up.md`: `--wait` *"Wait for services to be running|healthy.
   Implies detached mode."*; `--wait-timeout` *"Maximum duration in seconds…"*.
   `pkg/compose/start.go:82-99` calls `waitDependencies` when `Wait` is set and returns
   `application not healthy after <timeout>` on timeout; `service_containers.go:576-577` returns
   `container <name> is unhealthy` for an unhealthy container. `pkg/e2e/up_test.go`
   `TestUpServiceUnhealthy` asserts exit code 1. The server's Compose version is unknown; the README
   names Compose v2 with `--wait-timeout` as a runner prerequisite.
2. **`git restore --source=<commit> --staged --worktree -- <dir>` removes files added after
   `<commit>`.** Run in the scratchpad, git 2.39.0: a file added in the second commit was removed
   (`D  apps/calechip/added.txt`), and the modified file was restored and staged
   (`M  apps/calechip/release.env`). The `git rm` fallback is not needed.
3. **`gh pr diff --name-only` exists.** `gh pr diff --help` on gh 2.98.0 lists it; `ubuntu-latest`
   (Ubuntu 24.04 readme) ships GitHub CLI 2.102.0. The `gh api …/files` fallback is not needed.
4. **All three YAML files parse.** `yaml@2.9.1`, installed in the session scratchpad, not the project
   (no manifest changed, R8): 0 errors, 0 warnings each. `deploy-calechip`: `on` =
   `{push:{branches:[main],paths:['apps/calechip/**']}}`, steps checkout, `release`, `deploy`,
   `rollback`, `notify`. `pr-scope`: `on` = `{pull_request:{branches:[main]}}`. **`docker` is not
   installed here, so `docker compose config` was not run.**

Also checked: the AC-10 pattern, run in bash, accepts `v1.2.3@sha256:<64 hex>` and
`v1.2.3-rc.1@sha256:<64 hex>`, and rejects `:latest`, a bare tag, and a two-line value. The version
extraction in `rollback` yields `v1.2.3`.

## Invariants

`invariants_touched: []`. No `src/**`, seam or schema file changes. The diff is inert drafts and a
document under `docs/ops/`; INV-01..INV-07 constrain entries and the absence count, and nothing here
can reach them.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| unit tests | not run | no source file changed |
| `node scripts/check-allowed-paths.mjs` | 0 | `PASS` |
| `node scripts/check-docs.mjs` | 0 | `errors: 0  warnings: 2  pending: 7`, all pre-existing |
| YAML parse (`yaml@2.9.1`, scratchpad) | 0 | fact 4 |

No container was started and no repository other than this one was touched
(`.claude/agents/devops.md` § Containers). AC-21 and AC-22 can be observed only after the operator
applies the drafts; CICD-06's dry run is the first place they are checked.

## Testability contract

No UI and no selectors. The names that form the contract are § 4.5's, at the lines in *Contract
items*.

## Open questions

1. **AC-11 says the file contains no `migrate`, but § 4.2's own header comment says "No migrate
   step" and "Every migration"** (`deploy-calechip.yml:8-9`). Those are the comment that states the
   refusal, not a step. The intent of AC-11, no migrate step, holds: no command in the file touches a
   database. The file follows § 4.2 exactly. This is the same shape as CICD-04's AC-9 and
   `ubuntu-latest`. The reviewer should read AC-11 as being about commands; a literal reading needs
   a plan amendment to the comment.
2. **In the `no-previous` case the failed container is left running** under `restart:
   unless-stopped`, as `up` left it. § 4.2 specifies no stop, and adding `stop` would be a compose
   command the contract does not have. The README says so (`README.md:133-134`).
3. Plan open questions 1–5 stand. Each is a *Before you apply* item in the README.
