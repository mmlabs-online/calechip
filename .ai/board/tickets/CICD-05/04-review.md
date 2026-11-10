---
ticket: CICD-05
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-14T04:32:23+00:00
inputs_read:
  - .ai/board/tickets/CICD-05/01-plan.md
  - .ai/board/tickets/CICD-05/03-impl-log.md
  - .ai/board/tickets/CICD-05/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/01-operating-model.md
  - .ai/standards/git-conventions.md
  - .ai/steward/context.md
  - "git diff origin/main...HEAD (origin/main 309091d, HEAD 316d1d8)"
  - "git show 316d1d8 (the operator decision commit)"
  - "git status --porcelain (clean)"
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

# CICD-05 — Review (second pass)

Re-review after the operator resolved the first pass's `ESCALATED` (R1, `src/components/TopBar.tsx`)
by choosing to ship that file with the ticket as an accepted exception, recorded at
`.ai/board/tickets/CICD-05/ticket.yaml:21-24` and in commit `316d1d8`. Every check below was re-run in
this session; nothing is carried from the first pass.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; uncommitted carry | PASS | **Committed:** `node scripts/check-allowed-paths.mjs` → exit 1, `FAIL — files outside allowed_paths (RULE-03): - src/components/TopBar.tsx`, and that file only. Every path the Developer wrote is in `allowed_paths` (`ticket.yaml:16-20` against `03-impl-log.md` § *Files touched*). `TopBar.tsx` entered through operator-requested chore commits `7e02a0e`, `88a0b3b`, `6685204`, not through IN_PROGRESS; R1 "judges what the Developer wrote, and nothing else" (`.ai/01-operating-model.md:149`), and the operator has accepted the file explicitly (`ticket.yaml:21-24`). **Uncommitted:** `node scripts/check-carry.mjs CICD-05` → exit 0, `0 uncommitted path(s)`, `PASS — nothing stray`. |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint src/components/TopBar.tsx` → exit 0, the only lintable file in the diff (the five drafts are YAML, CODEOWNERS and Markdown). Repo-wide `pnpm exec eslint .` → exit 0; no chore to route. |
| R4 | Nothing outside the seam reaches the datastore | PASS | No datastore reference in the diff. The drafts drive only Docker and git (`docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml:69-75`, `:90`, `:102`); the `TopBar.tsx` change is a pathname test and a `<Link>` (`src/components/TopBar.tsx:103`, `:241-245`). |
| R5 | Every § 4 contract item implemented | PASS | Plan § 4.1–4.4 fenced blocks (`01-plan.md` lines 385-413, 419-555, 561-597, 603-606) extracted and `diff`ed against the four files: no difference. README per AC-18..AC-20 — see R5 detail. |
| R6 | Permission gating matches plan § 3 | PASS | § 3: no product role changes. `deploy-calechip.yml:11-14` (push to `main`, `apps/calechip/**` only, no `pull_request`), `:16-18` (`contents: write`, `pull-requests: write`), `:30` (`[self-hosted, linux, home-wsl]`); `pr-scope.yml:7-9`, `:11-13` (read-only), `:17` (`ubuntu-latest`), head ref via `env:` at `:23`. No `secrets.` in either file. |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:25`). See R7 detail. |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` → empty. `actions/checkout` in `deploy-calechip.yml` is an action inside an inert draft under `docs/`, not a project dependency. |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `name: calechip`, one service (AC-1) | `docs/ops/deployment-repo/apps/calechip/compose.yml:11-14` | yes — byte-identical to § 4.1 |
| 4.1 `image: ${CALECHIP_IMAGE:?…}`, sole image reference (AC-1) | `compose.yml:15` | yes |
| 4.1 healthcheck, `restart` (AC-3) | `compose.yml:16-22` | yes |
| 4.1 external network, placeholder `TODO-operator-tunnel-network` (AC-2); no ports/env/secrets/volumes (AC-4) | `compose.yml:23-29` | yes |
| 4.2 `on:` (AC-5) | `.github/workflows/deploy-calechip.yml:11-14` | yes — byte-identical to § 4.2 |
| 4.2 `permissions:` (AC-7) | `deploy-calechip.yml:16-18` | yes |
| 4.2 `concurrency:` (AC-6) | `deploy-calechip.yml:20-22` | yes |
| 4.2 `runs-on` (AC-7) | `deploy-calechip.yml:30` | yes |
| 4.2 step `release`, outputs `skip,image,previous` (AC-8..AC-10) | `deploy-calechip.yml:37-66` | yes |
| 4.2 step `deploy`, `-p calechip`, `config --quiet` → `pull` → `up -d --wait --wait-timeout 120` (AC-11) | `deploy-calechip.yml:68-75` | yes |
| 4.2 step `rollback`, `if: failure() && steps.deploy.outcome == 'failure'`, restore, push, `result` (AC-12, AC-13) | `deploy-calechip.yml:77-109`; restore `:90`, push `:102` | yes |
| 4.2 step `notify`, `if: always() && …skip != 'true'`, summary, PR comment via `GH_TOKEN` (AC-14) | `deploy-calechip.yml:111-137`; `:112`, `:114`, `:133` | yes |
| 4.3 `pr-scope` (AC-15, AC-16) | `.github/workflows/pr-scope.yml:1-37`; regex `:26` | yes — byte-identical to § 4.3 |
| 4.4 CODEOWNERS (AC-17) | `.github/CODEOWNERS:1-4` | yes — byte-identical to § 4.4 |
| AC-18 section order | `docs/ops/deployment-repo/README.md:7,33,67,87,116,145,170` | yes |
| AC-18 checklist, item 1 = secrets; private, network, ingress, hand-run container, pull, `DEPLOY_REPO`, bot push | `README.md:37,40,42,45,47,49,51,53` | yes |
| AC-19 image and folder only, never the database; migrations compatible (RULE-09); a revert is still red | `README.md:128-129`, `:137-140` | yes |
| AC-20 non-root, this repo only, `home-wsl`, outbound only; `docker` group = root; no `pull_request` on the self-hosted runner | `README.md:150-156`, `:161-168` | yes |
| 4.5 fixed names | as above; none added | yes |

AC-11's "the file contains no `migrate`" is read as being about commands. The only occurrence is the
header comment at `deploy-calechip.yml:8`, which § 4.2 specifies verbatim in a file given "exactly";
the literal reading would make § 4.2 contradict AC-11. No command in the file reaches a database.

## R7 detail

`invariants_touched` is empty. Reasoned anyway against INV-01..INV-07, which constrain entries and the
absence count:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01..INV-07 | Not reachable. The five drafts are inert files under `docs/ops/` that nothing in this repository executes. The accepted `TopBar.tsx` change adds a navigation link shown on `/events*` and reuses the same pathname test for `aria-current`; it changes no entry, count, route or permission path | `deploy-calechip.yml:1-137`; `src/components/TopBar.tsx:103`, `:241-245`, `:302` |

## Findings

None that fail the gate.

**For whoever merges:** `scripts/check-allowed-paths.mjs` still exits 1 on this branch because of
`src/components/TopBar.tsx`, so the same check in CI will be red on the pull request. That is the
consequence the operator accepted at `ticket.yaml:24`; it is stated here so the red check is not read
as a new defect.

## Verdict

`PASS`. The CICD-05 deliverable matches plan § 4 byte for byte and AC-18..AC-20 in the README;
`rework_count` unchanged.
