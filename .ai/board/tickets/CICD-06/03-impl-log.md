---
ticket: CICD-06
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-14T07:52:37+00:00
inputs_read:
  - .ai/board/tickets/CICD-06/01-plan.md
  - .ai/board/tickets/CICD-06/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/steward/context.md
  - .ai/standards/tech-stack.md
  - .github/workflows/ci-fast.yml
  - .github/workflows/verify.yml
  - .github/workflows/allowed-paths.yml
  - .github/workflows/mir-tracking.yml
  - .github/workflows/build-image.yml
  - .github/workflows/release.yml
  - docs/ops/branch-protection.md
  - docs/ops/deployment-repo/README.md
  - docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml
  - docs/ops/deployment-repo/.github/workflows/pr-scope.yml
  - docs/ops/deployment-repo/.github/CODEOWNERS
  - docs/ops/deployment-repo/apps/calechip/compose.yml
  - Dockerfile
  - docker/nginx.conf
  - .gitignore
  - MODEL-OVERVIEW.md
  - SETUP.md
  - scripts/check-docs.mjs (D5)
  - .ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md
  - "GitHub API, read-only, 2026-10-14: gh run list --limit 25; gh run view 38513432948 --log; gh run view 38524736841 --log-failed; gh pr view 134; gh pr list --state merged --limit 3"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CICD-06 — Implementation log

Written in the Developer session. The plan names `devops` as implementer (§ 0, ADR-059); every
path touched is documentation or a workflow comment, inside `allowed_paths`, with no behaviour change.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `docs/ops/ci-cd.md` | created | the single page for the pipeline, secrets, release, rollback, dry runs and onboarding | § 4.1, § 4.2, § 4.3, § 4.4; AC-1 to AC-11 |
| `.ai/standards/tech-stack.md` | modified | § *Build and deployment* still read `TODO(project)`; replaced by the facts on `main`, with link and *Until* line; front-matter bumped | AC-12 |
| `MODEL-OVERVIEW.md` | modified | source-table row pointing at `docs/ops/ci-cd.md` | AC-13 |
| `SETUP.md` | modified | step 8 now says `build-image` and `release` fail until the secrets and variable are added, with a link; *Until* line kept | AC-13 |
| `.github/workflows/allowed-paths.yml` | modified | header line 3 said "One of three workflows"; there are six. Comment lines only | AC-13 |
| `.ai/board/tickets/CICD-06/03-impl-log.md` | created | this log | gate |
| `.ai/board/tickets/CICD-06/ticket.yaml` | modified | `state` → `REVIEW` | gate |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 heading skeleton | `docs/ops/ci-cd.md` — every `##`/`###` | exactly the listed headings, in order; one intro paragraph above *Overview*, no extra heading |
| 4.2 record table header | `docs/ops/ci-cd.md` § *Dry runs* › *Record* | header verbatim; conclusions are `failure`, `failure`, `not run`, `not run` |
| 4.3 forced-failure change | `docs/ops/ci-cd.md` § *Dry runs* › *4. Forced health-check failure* | YAML verbatim, on a non-`release/*` branch |
| 4.4 where else | `docs/ops/ci-cd.md` § *Where else this is written* | the six links, and "the workflow is right" |

AC-2: the Mermaid labels write `:sha-<7>` as `:sha-#lt;7#gt;` — Mermaid's entity escape, because a
literal `<7>` inside a label is parsed as an HTML tag and dropped. The prose under the diagram states
`:sha-<7>` → `:vX.Y.Z` by digest in plain text.

AC-8: the *Pull request* row records PR #134, the latest merged pull request, as found — its
`allowed-paths` run is red. Choosing the green #133 instead would have recorded a better-looking row
by selection; #133 is named in the waiting-on list instead.

## Deviations from the design

1. **AC-12 wording: `GET :3000/healthz`, not `GET /healthz`, in `tech-stack.md`.** Check D5 of
   `scripts/check-docs.mjs` (line 378) reads any `/name` token in a human-owned document as a slash
   command, and `/healthz` failed the audit (errors: 1). Prefixing the port keeps the fact and the
   port, and satisfies D5. `docs/ops/ci-cd.md` is not in D5's corpus and keeps `/healthz`.
2. **AC-10, the *Pull request* row's waiting-on item is not drawn from the plan's set.** The plan
   assumed that only setup gaps would make a row not `success`; the observed failure is a scope
   violation in #134 (`src/components/TopBar.tsx`, chore commits on `feat/CICD-05`) that merged
   because `main` is unprotected. The item says so and points at branch protection.

## Invariants

`invariants_touched: []`. No file under `src/**`, the seam or the schema is touched, so INV-01 to
INV-07, which constrain entries and the absence count, cannot be reached by this diff.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `node scripts/check-docs.mjs` | 0 | errors 0, warnings 2 (D8, pre-existing), pending 7 (D6, pre-existing). Was 1 error (D5 `/healthz`) before deviation 1 |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS, ticket CICD-06 |
| `git diff origin/main -- .github/workflows/allowed-paths.yml` | — | comment lines only (AC-13) |
| `grep -E 'ghp_\|github_pat_\|dckr_pat\|eyJ' docs/ops/ci-cd.md` | 1 | no token-shaped string (AC-4) |
| unit tests | not run | no code changed |

## Testability contract

No selector; no screen in this ticket.

## Open questions

1. **#134 merged with a red required check.** `allowed-paths` run 38513432948 failed on
   `src/components/TopBar.tsx`, which is now on `main` through a ticket branch. Not this ticket's to
   fix; recorded in the dry-run table and named to the operator. Applying
   `docs/ops/branch-protection.md` is what prevents a repeat.
