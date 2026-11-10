---
ticket: CICD-07
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-14T21:13:14+07:00
inputs_read:
  - .ai/board/tickets/CICD-07/01-plan.md
  - .ai/board/tickets/CICD-07/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/board/tickets/CICD-05/03-impl-log.md
  - docs/ops/deployment-repo/README.md
  - docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml
  - docs/ops/deployment-repo/.github/workflows/pr-scope.yml
  - docs/ops/ci-cd.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CICD-07 — Implementation log

The plan names `devops` as implementer (ADR-059). The files were written in the Developer session
that `/implement` runs in, as CICD-05's were. `runner-check.yml` was extracted mechanically from the
fenced block of plan § 4.2 and diffs empty against it. The runbook was written from AC-1 to AC-12 in
the section order of § 4.4. Everything here is a draft; nothing was run against a server or the
deployment repository.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `docs/ops/deployment-repo/runner-setup.md` | created | the hand-run runbook for `mmlabs-server` | § 4.1, § 4.4; AC-1..AC-12 |
| `docs/ops/deployment-repo/.github/workflows/runner-check.yml` | created | the `workflow_dispatch` job verifications 2 and 3 run | § 4.2; AC-13, AC-14 |
| `docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml` | modified | `runs-on:` moves to the new label; nothing else | § 4.3; AC-15 |
| `docs/ops/deployment-repo/README.md` | modified | label, *What this is*, step 9, *Layout*, *The runner* point at the runbook | AC-16 |
| `docs/ops/ci-cd.md` | modified | `runner-check` row and runbook link, so the page stays true | AC-17 |
| `.ai/board/tickets/CICD-07/ticket.yaml` | modified | `state: REVIEW`, `branch: feat/CICD-07` | `/implement` on PASS |
| `.ai/board/tickets/CICD-07/03-impl-log.md` | created | this log | gate |

## Contract items

| Item | Implemented at | Notes |
|------|----------------|-------|
| § 4.1 runner name / label `mmlabs-server` | `runner-setup.md:207` (`config.sh … --name mmlabs-server --labels mmlabs-server --work _work`) | |
| § 4.1 `runs-on: [self-hosted, mmlabs-server]` | `deploy-calechip.yml:30`, `runner-check.yml:15` | |
| § 4.1 user `gh-runner` | `runner-setup.md` § 7, § 8 (`svc.sh install gh-runner`), `runner-check.yml` `identity` | |
| § 4.1 scheduled task `mmlabs-server-wsl` | `runner-setup.md` § 4 | |
| § 4.1 workflow `runner-check`, job `check`, steps `identity`, `docker` | `runner-check.yml` | byte-for-byte § 4.2 |
| § 4.2 | `docs/ops/deployment-repo/.github/workflows/runner-check.yml` | `diff` against the plan block is empty |
| § 4.3 | `deploy-calechip.yml:30` | `git diff` shows one changed line |
| § 4.4 section order | `runner-setup.md:21` *Steps* 1–8 (lines 23–191), *Hardening* :227, *Workspace hygiene* :253, *Verify* :268, *Before the repository is ever made public* :282 | |
| AC-16 | `README.md:24-26` (What this is), `:60` (step 9), `:82-83` (Layout), `:152-163` (The runner) | trade-off paragraph and boxed rule kept unchanged |
| AC-17 | `ci-cd.md:34` (row), `:264-265` (link) | `grep -rn home-wsl docs/` returns nothing |

## Deviations from the design

none. Choices the plan left open, made here and declared so the reviewer does not rediscover them:

- **AC-5, the task's account.** The task runs as the operator's own Windows account with a stored
  password (`Register-ScheduledTask -User -Password`), because WSL distros are per-user and *run
  whether the user is logged on or not* needs the password. It is taken with `Get-Credential` so it
  never appears in the command line or history; Task Scheduler stores it. A `SYSTEM` task would not
  see the operator's distro.
- **AC-5, keeping the distro up.** The action is `wsl.exe -d <distro> --exec /bin/sh -c 'exec sleep
  infinity'`; the long-running `wsl.exe` is what stops WSL treating the distro as idle.
- **AC-6.** The runbook names no key and no minimum version; it sends the operator to Microsoft's
  `.wslconfig` page and carries `TODO(verify)` for the version.
- **AC-9, the Docker Hub login.** `docker login` stores the credential in `gh-runner`'s Docker config
  by design; that is the README's existing *one credential on the server*. The runbook has it typed
  at the prompt, never on the command line, so AC-12's *no command writes a token to disk* holds for
  every token the runbook itself handles (registration and removal).
- **AC-9, the trigger-rule check.** Given as
  `grep -l mmlabs-server .github/workflows/*.yml | xargs grep -l pull_request` printing nothing.
  Against the drafts as they stand, `pull_request` appears only in `pr-scope.yml`, which runs on
  `ubuntu-latest`.

## Invariants

`invariants_touched: []`. INV-01..INV-07 constrain calendar entries and their data; no file under
`src/`, no schema and no seam changed.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `node scripts/check-docs.mjs` | 0 | errors 0, warnings 2 — both pre-existing, neither names a file this ticket touched |
| `npx yaml-lint runner-check.yml` | 0 | |
| `diff` plan § 4.2 vs `runner-check.yml` | 0 | identical |
| `grep -rn home-wsl docs/` | 1 | no match — AC-15, AC-17 |
| `git status --porcelain` subset of `allowed_paths` + ticket folder | yes | |

Unit tests were not run: no code changed.

## Testability contract

No selectors; there is no screen.

## Open questions

- **Not verifiable from this repository:** whether the task in § 4 brings the distro up at boot
  without a login, and whether the runner registers. Both are observed by the operator through the
  runbook's verification 3, and recorded by CICD-08.
