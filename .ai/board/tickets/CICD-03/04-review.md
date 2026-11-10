---
ticket: CICD-03
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-13T22:26:40+07:00
inputs_read:
  - .ai/board/tickets/CICD-03/01-plan.md
  - .ai/board/tickets/CICD-03/03-impl-log.md
  - .ai/board/tickets/CICD-03/ticket.yaml
  - .github/workflows/build-image.yml
  - "git diff origin/main...HEAD (5 paths); git status --porcelain (clean)"
  - .ai/registry/invariants.md
  - .ai/standards/testing-standards.md
  - .ai/01-operating-model.md
  - eslint.config.js
  - Dockerfile
  - docker/nginx.conf
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

# CICD-03 — Review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff within `allowed_paths`; nothing stray uncommitted | PASS | `git diff --name-only origin/main...HEAD` = `.ai/board/backlog.md` (ship-owned), three files under `.ai/board/tickets/CICD-03/` (exempt), `.github/workflows/build-image.yml` = `ticket.yaml:16`, the sole allowed path. `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS`, exit 0. `node scripts/check-carry.mjs CICD-03` → `0 uncommitted path(s)`, `check-carry: PASS — nothing stray`, exit 0 |
| R2 | typecheck exit 0, whole program | PASS | `pnpm exec tsc --noEmit` (`testing-standards.md:16`) run by this reviewer: exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint .` (`testing-standards.md:17`) run by this reviewer, repo-wide: exit 0, no output. The diff holds no lintable source file (one `.yml`) |
| R4 | Nothing bypasses the data-access seam (RULE-02) | PASS | No `src/**` path in the diff; the only non-board change is `.github/workflows/build-image.yml:1-115`, which imports nothing. Seam rule intact at `eslint.config.js:64` and lint exits 0 |
| R5 | Every § 4 contract item implemented | PASS | `.github/workflows/build-image.yml:1-115` is byte-identical to `01-plan.md:243-357` (`diff` of the two extracts returns no difference). Per-item rows below |
| R6 | Permission gating matches plan § 3 | PASS | Plan § 3 (`01-plan.md:224-236`) changes no product role. Its CI rows hold: push trigger `main` only at `build-image.yml:16-18`; `contents: read` only at `build-image.yml:20-21`; `secrets.` appears only at `build-image.yml:40-43`, `:62-63`, `:77-78` (the three steps § 3 names); no secret is echoed — `build-image.yml:50` prints only names; push only after smoke test, no `if:` at `build-image.yml:104-108` |
| R7 | No invariant violated (RULE-07) | PASS | `invariants_touched: []` at `ticket.yaml:14`; per-ID reasoning below, INV-01..INV-07 at `invariants.md:33-39` |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty (0 lines). The four `uses:` at `build-image.yml:36,58,60,66` are GitHub Actions, not package dependencies, and are the four majors the plan fixes (`01-plan.md:189-190`). The impl log's `yaml@2.9.1` went to the session scratchpad, not the manifest (`03-impl-log.md:66-69`), confirmed by the empty manifest diff |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| Header comment naming the four secrets | `build-image.yml:3-14` | yes — verbatim `01-plan.md:245-256` |
| AC-1 `on: push: branches: [main]`, nothing else | `build-image.yml:16-18` | yes |
| AC-2 `permissions: contents: read` only; secrets in three places | `build-image.yml:20-21`; `:40-43`, `:62-63`, `:77-78` | yes |
| `concurrency` per commit, no cancel | `build-image.yml:24-26` | yes |
| `env.IMAGE: mingming21400/calechip` | `build-image.yml:28-29` | yes |
| AC-3 step `secrets present`, first after checkout, names missing secrets, exits 1 | `build-image.yml:38-52` | yes — `${!name}` indirection tests emptiness without printing a value (`:47`) |
| AC-5 step `tag`, output `ref` = `${IMAGE}:sha-${GITHUB_SHA::7}`, the only tag | `build-image.yml:54-56`, used at `:72`, `:84`, `:106` | yes — no `latest` or version tag in the file |
| AC-13 action majors | `build-image.yml:36`, `:58`, `:60`, `:66` | yes — checkout@v7, setup-buildx@v4, login@v4, build-push@v7, no others |
| AC-4 one build, Buildx, `load: true`, `push: false`, `linux/amd64`, gha cache | `build-image.yml:65-80` | yes — exactly one build step |
| AC-6 OCI `revision` and `source` labels | `build-image.yml:73-75` | yes |
| AC-7 build-args exactly the two Supabase secrets | `build-image.yml:76-78` | yes — `VITE_DATA_SEAM`, `VITE_REQUIRE_EMAIL_CONFIRMATION` not passed; they default to `""` at `Dockerfile:40-41` |
| AC-8 step `smoke test`: run detached on 3000, 30×1s `/healthz` = `ok`, then `/` 200, logs on failure | `build-image.yml:82-97` | yes — port matches `Dockerfile:81`, endpoint `docker/nginx.conf:40` |
| AC-9 cleanup `if: always()`; push after smoke test, no failure-tolerant `if:` | `build-image.yml:99-101`; `:104-108` | yes |
| AC-10 `docker push` of the loaded image, tag and `RepoDigests` digest to `$GITHUB_STEP_SUMMARY` | `build-image.yml:104-115` | yes — no second build |
| § 4.2 secret names | `build-image.yml:40-43`, `:62-63`, `:77-78` | yes — no `SUPABASE_SERVICE_ROLE_KEY` anywhere in the file |
| AC-14 scope refusals | `git diff --name-only origin/main...HEAD` (see R1) | yes — `Dockerfile`, `docker/**`, `.dockerignore` and other workflows unchanged |

AC-11 and AC-12 are post-merge observations by the plan's own terms (`01-plan.md:101-103`) and are not a REVIEW-time contract item.

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml:14`). Each ID was still reasoned through against the diff, whose only non-board path is a CI workflow that builds the existing `Dockerfile` unchanged.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no overlapping entries for one member | The database exclusion constraint, untouched: no migration, `src/**` or seam path in the diff | `invariants.md:33`; diff path list under R1 |
| INV-02 — approval revoked on edit of dates/type/portion/tentative | Existing database/seam mechanism, untouched; the workflow writes no entry | `invariants.md:34`; `build-image.yml:1-115` contains no data access |
| INV-03 — rejection carries a reason | Existing constraint, untouched | `invariants.md:35` |
| INV-04 — one definition of the absence count | Computed on read in unchanged source; no `src/**` in diff | `invariants.md:36` |
| INV-05 — tentative counts toward absence | Same computation, unchanged | `invariants.md:37` |
| INV-06 — one portion per entry | Schema, unchanged (`schema_delta: none`, `ticket.yaml:18`) | `invariants.md:38` |
| INV-07 — entry belongs to exactly one member and team | Schema, unchanged | `invariants.md:39`; `ticket.yaml:18` |

The build-args at `build-image.yml:76-78` select which Supabase project the bundle talks to; they do not alter any policy, constraint or seam function that holds the ledger above.

## Findings

None.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS`. All eight checks pass; the ticket advances to DONE.
