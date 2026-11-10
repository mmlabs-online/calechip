---
ticket: CICD-07
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-14T21:56:04+07:00
inputs_read:
  - .ai/board/tickets/CICD-07/01-plan.md
  - .ai/board/tickets/CICD-07/03-impl-log.md
  - .ai/board/tickets/CICD-07/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - .ai/01-operating-model.md
  - git diff origin/main...HEAD
  - docs/ops/deployment-repo/runner-setup.md
  - docs/ops/deployment-repo/.github/workflows/runner-check.yml
  - docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml
  - docs/ops/deployment-repo/.github/workflows/pr-scope.yml
  - docs/ops/deployment-repo/README.md
  - docs/ops/ci-cd.md
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

# CICD-07 — Review

Reviewed against the branch diff `origin/main...HEAD` (the `/advance` checkpoint committed the
implementation; `git status --porcelain` was empty at the start of this review). Nothing here was run
against the server or the deployment repository; every check is against the drafts as files.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (9 changed files; non-ticket, non-ship-owned paths are exactly the five in `ticket.yaml` `allowed_paths`). `node scripts/check-carry.mjs CICD-07` → `0 uncommitted path(s)`, `PASS — nothing stray`. |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0. No `.ts` file in the diff. |
| R3 | lint exit 0 on changed lintable files | PASS | The diff contains no lintable file (`.md`, `.yml` only). Repo-wide `pnpm exec eslint .` exit 0. |
| R4 | Nothing bypasses the data-access seam | PASS | No file under `src/` in the diff (`git diff --name-only origin/main...HEAD`); the five touched paths are under `docs/ops/`. |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail. `runner-check.yml` diffs empty against the plan § 4.2 block. |
| R6 | Permission gating matches § 3 | PASS | `runner-check.yml:8-9` `workflow_dispatch` only; `runner-check.yml:11` `permissions: {}`; no `secrets.` and no `actions/checkout` in `runner-check.yml:1-34`; `runner-check.yml:21-28` refuses uid 0 and any user other than `gh-runner`. Host side: `runner-setup.md:177-181` (no password login, `docker` only, not `sudo`), `runner-setup.md:232-233` (`sudo -l -U`), `runner-setup.md:241-242` (outbound only), `runner-setup.md:243-246` (no `pull_request` workflow on the label; only `pr-scope.yml:8` has one and it runs on `ubuntu-latest`, `pr-scope.yml:17`). `deploy-calechip.yml:11` trigger unchanged by the diff. |
| R7 | No invariant violated | PASS | `invariants_touched: []`; see R7 detail. |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` empty. `runner-check.yml` uses no action (`runner-check.yml:17-34`, `run:` steps only). |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 runner name `mmlabs-server`, label `mmlabs-server`, work dir `_work` | `runner-setup.md:207` | yes |
| § 4.1 `runs-on: [self-hosted, mmlabs-server]` | `deploy-calechip.yml:30`, `runner-check.yml:15` | yes |
| § 4.1 Linux user `gh-runner` | `runner-setup.md:177-178`, `runner-setup.md:215`, `runner-check.yml:25` | yes |
| § 4.1 scheduled task `mmlabs-server-wsl` | `runner-setup.md:104`, check `runner-setup.md:115` | yes |
| § 4.1 workflow `runner-check`, job `check`, steps `identity`, `docker` | `runner-check.yml:1`, `:14`, `:18`, `:30` | yes |
| § 4.1 runbook `runner-setup.md` at deployment-repo root | `docs/ops/deployment-repo/runner-setup.md:1`; layout `README.md:83` | yes |
| § 4.2 `runner-check.yml`, exactly | `runner-check.yml:1-34` | yes — `diff` against the plan block exit 0 |
| § 4.3 one changed line in `deploy-calechip.yml` | `deploy-calechip.yml:30`; branch diff is one `-`/`+` pair | yes |
| § 4.4 section order: opening + key | `runner-setup.md:3-19` | yes |
| § 4.4 Steps 1–8 in order (private, sleep, systemd, task, `.wslconfig`, host tools, user, register) | `runner-setup.md:23`, `:33`, `:54`, `:82`, `:121`, `:148`, `:167`, `:191` | yes |
| § 4.4 Hardening | `runner-setup.md:227-251` | yes |
| § 4.4 Workspace hygiene | `runner-setup.md:253-266` | yes |
| § 4.4 Verify 1, 2, 3 | `runner-setup.md:268-280` | yes |
| § 4.4 Before the repository is ever made public | `runner-setup.md:282-307` | yes |

The ACs that § 4 rests on, spot-checked against the files: AC-3 `runner-setup.md:62-63,69,77`;
AC-4 `:41-42,48-52`; AC-5 time limit zero `:103`, reason `:89-91`; AC-6 no version stated,
`TODO(verify)` `:135-137`; AC-8 token never written `:199-200`, `svc.sh` `:215-216,222`;
AC-10 `:260`, `:264-266`; AC-12 tokens only as `<registration token>` `:207` and `<removal token>`
`:303`; AC-15 `grep -rn home-wsl docs/` exit 1 (no match); AC-16 `README.md:24-26,60,82-83,152-163`,
trade-off and boxed rule retained `README.md:167-175`; AC-17 `ci-cd.md:34`, `ci-cd.md:264-265`.

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml`). Each registry invariant considered against the diff:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | untouched — no entry write path in the diff | diff paths: `docs/ops/**` only |
| INV-02 approval does not survive an edit | untouched — no entry update path in the diff | same |
| INV-03 rejection reason | untouched — no rejection path in the diff | same |
| INV-04 absence count | untouched — no count computation in the diff | same |
| INV-05 tentative counts | untouched — no count computation in the diff | same |
| INV-06 one portion per entry | untouched — no schema or entry shape in the diff | same |
| INV-07 one member, every team | untouched — no membership or count path in the diff | same |

All seven constrain calendar entries and their data (`.ai/registry/invariants.md:33-39`); the diff
contains no file under `src/`, no schema and no seam change.

## Findings

None.

## Verdict

PASS.
