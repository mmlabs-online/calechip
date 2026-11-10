---
ticket: CICD-07
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-14T20:48:21+07:00
inputs_read:
  - .ai/board/tickets/CICD-07/ticket.yaml
  - .ai/board/tickets/CICD-08/ticket.yaml
  - .ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/templates/plan.md
  - .ai/steward/context.md
  - .ai/board/tickets/CICD-05/01-plan.md
  - .ai/board/tickets/CICD-05/ticket.yaml
  - docs/ops/deployment-repo/README.md
  - docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml
  - docs/ops/ci-cd.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CICD-07 — Plan

## 0. Stated first

- **The implementer is `devops`, not `developer`** (ADR-059 § Consequences). Every path in § 7 is a
  workflow draft or ops documentation.
- **Everything this ticket writes is a draft in this repository, and nothing in it runs.** As in
  CICD-05: `docs/ops/deployment-repo/` maps to the deployment repository's root, a `.github/` folder
  nested here is inert, and the operator applies the drafts by hand. The deployment repository is
  still not attached to this session.
- **No agent registers, starts or reboots anything.** The runbook is for the operator to run on the
  WSL server and on Windows. Every step in it ends with a check the operator runs and the output that
  means the step worked, because no reviewer of this ticket can observe the server.
- **The feature row is the specification.** Its list — private-repo precondition, `systemd=true`,
  sleep off, a Task Scheduler entry, `.wslconfig` only if supported, `gh-runner`, repo-level
  registration with `--unattended` and `svc.sh`, name and label `mmlabs-server`, hardening, workspace
  hygiene, three verification steps — becomes AC-1 to AC-12 one item at a time. Where the row names a
  topic and not its content (*hardening*, *workspace hygiene*), the items under it are composed here
  from the existing README's runner section and the request's Phase 5 item 3, and § 2b says so.
- **A fact this plan cannot confirm stays unconfirmed.** In particular, the WSL version that first
  supports a `.wslconfig` idle timeout is not stated here and must not be stated in the runbook
  without a source (AC-6).

## 1. Problem and scope

**Feature ID, transcribed from `.ai/registry/features.md`:**

> | CICD-07 | The self-hosted runner on the WSL server has a hand-run setup runbook, and the deploy workflow selects it by the label `mmlabs-server` | CICD | PLANNED | | From `.ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md`, gap check on 2026-10-14 against the request after CICD-01..06 shipped. Phase 5's runner runbook was not drafted: CICD-05 put a short *The runner* section in `docs/ops/deployment-repo/README.md` and labelled the runner `home-wsl`, where the request fixes `mmlabs-server`. Ships `docs/ops/deployment-repo/runner-setup.md` as a draft for the operator to run by hand: private-repo precondition (remove the runner before the repo ever goes public), WSL2 `systemd=true`, Windows sleep off, a Task Scheduler entry starting the distro at boot, `.wslconfig` idle timeout only if the installed WSL version supports it (checked, not assumed), a dedicated non-root `gh-runner` user in the `docker` group, repo-level registration on `deployment` with `--unattended` and `svc.sh`, name and label `mmlabs-server`, hardening, workspace hygiene, and the three verification steps (Idle on GitHub, a `workflow_dispatch` `docker ps` job, back online after a Windows reboot). `deploy-calechip.yml` and the README move to `runs-on: [self-hosted, mmlabs-server]`. Drafts only; the deployment repository is still not attached. |

**Who gains what.** CICD-05's deploy workflow waits for a runner that nobody has been told how to set
up: the README lists four properties it must have, and the label it selects by, `home-wsl`, is not
the one the operator chose. The operator — the only person who can touch the WSL server — gains an
ordered runbook they can follow once, top to bottom, that leaves a runner which survives a Windows
reboot, cannot run as root, and is provably reachable by a job before the first real deploy depends
on it. CICD-08's dry runs are blocked on exactly this (its row: *"the runner registered per
CICD-07"*).

**In scope:**

1. `docs/ops/deployment-repo/runner-setup.md` — new: the runbook.
2. `docs/ops/deployment-repo/.github/workflows/runner-check.yml` — new: the `workflow_dispatch` job
   the runbook's second and third verification steps run.
3. `docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml` — `runs-on:` only.
4. `docs/ops/deployment-repo/README.md` — the label, the layout, step 9 of *Before you apply*, and
   *The runner* pointing at the runbook.
5. `docs/ops/ci-cd.md` — one row in the workflow table and one link, so the page CICD-06 wrote stays
   true.

**Out of scope, and where each item goes:**

- **Running the runbook** — creating the user, registering, rebooting, the three verifications. The
  operator, by hand. CICD-08 depends on it having been done.
- **Applying any draft to the deployment repository.** The operator, from the README, as for CICD-05.
- **A setup script** that performs the runbook. § 8, alternative 3.
- **Ephemeral or just-in-time runners, runner groups, or an organisation-level runner.** The request
  says *register it to this repo only*; § 8, alternative 4.
- **Any change to the deploy logic** — triggers, steps, restore, notify. Only the `runs-on:` line of
  `deploy-calechip.yml` moves.
- **Editing CICD-05's shipped artifacts** (`.ai/board/tickets/CICD-05/**`), which keep `home-wsl` as
  the record of what was planned then.
- **`.ai/standards/tech-stack.md`.** It names no label (checked: no `home-wsl` in `.ai/standards/`),
  and it is the standards plane.
- **Monitoring or alerting on the runner going offline.** Not in the request. A runner that is
  offline shows as a queued `deploy-calechip` run; the runbook's verification 3 is the only check.
- **The four dry runs.** CICD-08.

`size_estimate`: **S**. One runbook, one twenty-line workflow, a one-line change, and two doc edits;
no behaviour of any existing workflow changes.

## 2. Acceptance criteria

### 2.0 Facts the criteria rest on

- **The deployment repository maps from `docs/ops/deployment-repo/`** (README § *What this is*).
  "The deployment repository" in an AC means the copy the operator applies.
- **A self-hosted runner gets the default labels `self-hosted`, the OS and the architecture**, plus
  any given with `--labels`. A job's `runs-on:` list must be a subset of the runner's labels.
- **`deploy-calechip` must never be reachable from a pull request**, because the runner's user is in
  `docker`, which is root on the host (README § *The runner*, the boxed rule). This ticket adds a
  second workflow on that runner and must keep the rule true.

### 2.1 Criteria

AC-1 to AC-17 are checked from the files at this ticket's head. **None of them claims the runner
exists.** Whether the runbook works is observed when the operator runs it, and recorded by CICD-08.

**The runbook — `docs/ops/deployment-repo/runner-setup.md`**

**AC-1: a hand-run, ordered, checkable draft**
- Given `docs/ops/deployment-repo/runner-setup.md`
- When it is read
- Then its opening paragraph says it is a draft written by CICD-07, run by hand by the operator, and
  that no workflow or agent runs it
- And its steps are numbered in the order they must be run
- And every step ends with a **Check:** line giving a command (or a GitHub page) and the output that
  means the step worked
- And each command says where it runs: *Windows, elevated PowerShell*; *WSL, as your own user with
  sudo*; or *WSL, as `gh-runner`*

**AC-2: the private-repository precondition, and removal before going public**
- Given the same file
- When its first step is read
- Then it says to stop unless the deployment repository is private, with the check (the repository's
  visibility on GitHub)
- And a section titled **Before the repository is ever made public** says the runner must be removed
  first, and gives the removal commands: stopping and uninstalling the service with `svc.sh`, then
  `./config.sh remove --token <removal token>` as `gh-runner`
- And it says why: on a public repository, anyone's pull request could reach a runner that is root
  on the server

**AC-3: systemd in WSL2**
- Given the same file
- When the systemd step is read
- Then it sets `systemd=true` under `[boot]` in `/etc/wsl.conf`
- And it restarts the distro with `wsl --shutdown` from Windows
- And its check is that `ps -p 1 -o comm=` prints `systemd`

**AC-4: Windows does not sleep**
- Given the same file
- When the sleep step is read
- Then it runs `powercfg /change standby-timeout-ac 0` and `powercfg /change hibernate-timeout-ac 0`
  in an elevated PowerShell
- And its check shows both timeouts on AC power are 0 (never)

**AC-5: the distro starts at boot, without anyone logging in**
- Given the same file
- When the Task Scheduler step is read
- Then it creates one scheduled task named `mmlabs-server-wsl` with a command the operator pastes into
  an elevated PowerShell
- And the task triggers at system startup, runs whether or not a user is logged on, and has no
  execution time limit
- And its action starts the WSL distro and keeps a process running in it, so the distro is not shut
  down as idle
- And the step says why the time limit must be off (a task stopped after the default limit takes the
  distro, and the runner, down with it)
- And its check is the task's state from `Get-ScheduledTask -TaskName mmlabs-server-wsl`; the proof
  that it works is verification 3 (AC-11)

**AC-6: the `.wslconfig` idle timeout is conditional, and checked**
- Given the same file
- When the `.wslconfig` step is read
- Then it starts with `wsl --version`, run on Windows, and tells the operator to compare the
  installed version against Microsoft's documentation of `.wslconfig` before adding any idle-timeout
  key
- And it says to skip the step when the installed version does not document the key, because AC-5's
  task is what keeps the distro up
- And the runbook states **no** minimum WSL version unless it cites the source of that number;
  where it cannot, the text carries `TODO(verify)` instead of a number

**AC-7: a dedicated non-root user, in `docker`, not in `sudo`**
- Given the same file
- When the user step is read
- Then it creates the user `gh-runner` with no password login, and adds it to the `docker` group
- And it does not add `gh-runner` to `sudo` or any admin group
- And its check is `id gh-runner`, whose output lists `docker` and does not list `sudo`
- And the step states that `docker` membership is equivalent to root on the host, linking the
  README's *The runner* for the trade-off rather than restating it

**AC-8: repository-level registration, unattended, as a service**
- Given the same file
- When the registration step is read
- Then it takes the download commands and the registration token from the deployment repository's
  **Settings → Actions → Runners → New self-hosted runner** page, never from an organisation's
  settings, and says the runbook deliberately pins no runner version
- And it runs, as `gh-runner`, `./config.sh --unattended --url <deployment repository URL>
  --token <registration token> --name mmlabs-server --labels mmlabs-server --work _work`
- And it installs and starts the service with `sudo ./svc.sh install gh-runner`, then
  `sudo ./svc.sh start`
- And its check is `sudo ./svc.sh status` showing the service active
- And it says the registration token is short-lived and is never written to a file, a note or the
  repository

**AC-9: hardening**
- Given the same file
- When its **Hardening** section is read
- Then it lists, each with a check where one exists:
  - `gh-runner` has no sudo rights (`sudo -l -U gh-runner` reports it may not run sudo);
  - the runner is registered to the deployment repository only, and appears under no organisation;
  - the runner's directory is owned by `gh-runner` and is not writable by other users;
  - no port is opened for the runner: it connects outbound only;
  - **no workflow with a `pull_request` or `pull_request_target` trigger may target
    `mmlabs-server`**, quoting the README's rule by link;
  - a Docker Hub login, if the image is private, is made as `gh-runner` and nowhere else

**AC-10: workspace hygiene**
- Given the same file
- When its **Workspace hygiene** section is read
- Then it says job workspaces live under the runner's `_work` directory and are owned by `gh-runner`
- And it gives a cleanup command for dangling images only, `docker image prune -f`, to be run by hand
  or on a schedule the operator chooses
- And it says never to run `docker system prune`, `docker image prune -a` or any prune with
  `--volumes` on this host, because the host runs other apps' containers and volumes

**AC-11: the three verifications, in this order**
- Given the same file
- When its **Verify** section is read
- Then verification 1 is the deployment repository's **Settings → Actions → Runners** page showing
  `mmlabs-server` as **Idle**, with the label `mmlabs-server`
- And verification 2 is running `runner-check` from the Actions tab (**Run workflow**) and seeing it
  green, with the log naming `gh-runner` and printing `docker ps` output
- And verification 3 is rebooting Windows, **not logging in**, waiting, then repeating verifications
  1 and 2 from another device, both passing
- And it says the runner is not ready for `deploy-calechip` until all three have passed

**AC-12: no secret in the runbook**
- Given the same file
- When it is read
- Then every token appears only as a placeholder in angle brackets (`<registration token>`,
  `<removal token>`), and no command writes a token to disk

**The verification workflow — `docs/ops/deployment-repo/.github/workflows/runner-check.yml`**

**AC-13: manual only, no permissions, on the runner**
- Given `runner-check.yml`
- When it is read
- Then it is exactly the file in § 4.2
- And its `on:` is `workflow_dispatch` and nothing else
- And its top-level `permissions:` is `{}`, it has no `actions/checkout` step, and `secrets.` does not
  appear in it

**AC-14: it refuses to pass as root or as the wrong user**
- Given the `identity` step
- When the job runs as uid 0, or as any user other than `gh-runner`
- Then the step exits non-zero with an error naming the user found and `runner-setup.md`
- And when it runs as `gh-runner`, the `docker` step prints the server version, the Compose version
  and `docker ps`, and the job is green only if all three succeed

**The deploy workflow, the README and the pipeline page**

**AC-15: `deploy-calechip` selects `mmlabs-server`, and nothing else changes**
- Given `deploy-calechip.yml`
- When it is diffed against `origin/main`
- Then the only changed line is the job's `runs-on:`, which is now `[self-hosted, mmlabs-server]`
- And neither `home-wsl` nor `linux` appears as a label in the file

**AC-16: the README names the new label and points at the runbook**
- Given `docs/ops/deployment-repo/README.md`
- When it is read
- Then `home-wsl` appears nowhere in it
- And *The runner* says the runner's name and its one added label are both `mmlabs-server`, that the
  workflows select it with `[self-hosted, mmlabs-server]`, and links `runner-setup.md` for setting it
  up; it keeps the trade-off paragraph and the boxed `pull_request` rule
- And step 9 of *Before you apply* says to set up the runner with `runner-setup.md` and pass its three
  verifications before the first merge that touches `apps/calechip/`
- And the *Layout* block lists `runner-setup.md` at the root and `runner-check.yml` under
  `.github/workflows/`, and the list under *What this is* names `runner-check.yml` with one line on
  what it is for

**AC-17: the pipeline page stays true**
- Given `docs/ops/ci-cd.md`
- When it is read
- Then the *Workflows* table has a `runner-check` row: deployment repository,
  `.github/workflows/runner-check.yml` — *draft, not applied*; trigger `workflow_dispatch`; *on the
  self-hosted runner: proves it runs as `gh-runner` and reaches Docker*; required check *no*;
  written by CICD-07
- And *Where else this is written* links `deployment-repo/runner-setup.md`
- And `grep -rn home-wsl docs/` returns nothing

**Invariants touched: `[]`.** INV-01 to INV-07 constrain calendar entries and their data; this
ticket changes no file under `src/`, no schema and no seam. Written back to `ticket.yaml`.

**Open questions.** None that blocks. Two facts are deliberately left to the operator at run time and
are marked in the runbook rather than guessed here: the WSL version's support for an idle-timeout key
(AC-6), and the name of the WSL distro the task starts (a placeholder `<distro>`, read from
`wsl --list --verbose`).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(There is no screen. What is originated here is the runbook's arrangement — its step order, the
**Check:** convention, and the items under *Hardening* and *Workspace hygiene*, which the feature row
names only as topics — and the `runner-check` workflow, which the row names only as *a
`workflow_dispatch` `docker ps` job*.)

## 3. Permission model

There is no application role involved: nothing here reaches the CaleChip app, its seam or its
datastore. The permissions that matter are GitHub's and the host's.

| Who / what | May | Must not |
|---|---|---|
| `runner-check` workflow | run on `mmlabs-server` when someone with write access to the deployment repository presses **Run workflow** | hold any `GITHUB_TOKEN` permission (`permissions: {}`); read a secret; be started by a push, a schedule or a pull request |
| `deploy-calechip` workflow | unchanged from CICD-05 (`contents: write`, `pull-requests: write`) | be started by a pull request (unchanged) |
| `gh-runner` user | run jobs, use Docker | use sudo; own anything outside its home and the runner directory; log in with a password |
| The runner | poll GitHub outbound | accept inbound connections; be registered to any other repository or to an organisation |
| An agent | write these drafts in this repository | register, configure or remove the runner; write to the deployment repository |

Where each lives: the workflow permissions in the workflow files (§ 4); the host permissions are
enforced by Linux and checked by the runbook's **Check:** lines (AC-7, AC-9); the trigger rule is the
README's, enforced by review of the deployment repository's `CODEOWNERS`, as in CICD-05.

## 4. Contract

### 4.1 The names are the contract

| Name | Where it appears | Value |
|---|---|---|
| Runner name | `config.sh --name`, GitHub's runner page | `mmlabs-server` |
| Runner label | `config.sh --labels`, every `runs-on:` | `mmlabs-server` |
| `runs-on:` | `deploy-calechip.yml`, `runner-check.yml` | `[self-hosted, mmlabs-server]` |
| Linux user | runbook, `svc.sh install`, `runner-check` | `gh-runner` |
| Work directory | `config.sh --work` | `_work` |
| Scheduled task | runbook | `mmlabs-server-wsl` |
| Workflow | deployment repository | `runner-check`, job `check`, steps `identity`, `docker` |
| Runbook | deployment repository root | `runner-setup.md` |

### 4.2 `docs/ops/deployment-repo/.github/workflows/runner-check.yml`, exactly

```yaml
name: runner-check

# DRAFT for the deployment repository (calechip CICD-07). Run by hand from the Actions tab to prove
# the self-hosted runner mmlabs-server picks up a job, runs it as gh-runner and not as root, and
# reaches Docker. runner-setup.md § Verify runs it after registration and after a Windows reboot.
# workflow_dispatch only: no push, schedule or pull request may start a job on this runner here.

on:
  workflow_dispatch:

permissions: {}

jobs:
  check:
    runs-on: [self-hosted, mmlabs-server]
    timeout-minutes: 5
    steps:
      - name: identity
        run: |
          echo "runner: $RUNNER_NAME  user: $(id -un)  groups: $(id -Gn)"
          if [ "$(id -u)" = "0" ]; then
            echo "::error::The runner is running as root. runner-setup.md requires the gh-runner user."
            exit 1
          fi
          if [ "$(id -un)" != "gh-runner" ]; then
            echo "::error::The runner is running as $(id -un), not gh-runner. See runner-setup.md."
            exit 1
          fi

      - name: docker
        run: |
          docker version --format 'docker server {{.Server.Version}}'
          docker compose version
          docker ps
```

### 4.3 `deploy-calechip.yml`, the one changed line

```yaml
    runs-on: [self-hosted, mmlabs-server]
```

replacing `runs-on: [self-hosted, linux, home-wsl]` at the `deploy` job. Nothing else in the file
changes, including its header comment.

### 4.4 `runner-setup.md`, its sections in order

1. Opening paragraph (AC-1), then a one-paragraph *Where each command runs* key.
2. **Steps**, numbered:
   1. The deployment repository is private (AC-2).
   2. Windows does not sleep (AC-4).
   3. systemd in WSL (AC-3).
   4. The distro starts at boot — `mmlabs-server-wsl` (AC-5).
   5. `.wslconfig` idle timeout, only if supported (AC-6).
   6. Docker, Compose v2 with `up --wait-timeout`, `git` and `gh` on the host — a check only, citing
      the README's host requirements; installing Docker is not described.
   7. The `gh-runner` user (AC-7).
   8. Register the runner and install the service (AC-8).
3. **Hardening** (AC-9).
4. **Workspace hygiene** (AC-10).
5. **Verify** — verifications 1, 2, 3 (AC-11).
6. **Before the repository is ever made public** (AC-2).

Sleep comes before systemd so that every later step runs on a host that will still be awake for
verification 3.

## 5. Seam impact

None. No file under `src/` changes.

## 6. Schema delta

`none`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "docs/ops/deployment-repo/runner-setup.md"
  - "docs/ops/deployment-repo/.github/workflows/runner-check.yml"
  - "docs/ops/deployment-repo/.github/workflows/deploy-calechip.yml"
  - "docs/ops/deployment-repo/README.md"
  - "docs/ops/ci-cd.md"
```

`glossary_owed` is `[]`; no glossary row is written and `.ai/registry/glossary.md` is not on the list.

`size`: **S** — five paths, two of them new. It agrees with `size_estimate`.

## 8. Rejected alternatives

1. **Keep `home-wsl` and add `mmlabs-server` beside it, or keep `linux` in `runs-on:`.** Rejected:
   the feature row fixes `runs-on: [self-hosted, mmlabs-server]`, and a second label that nothing
   selects is a second name for the same machine to keep true. `linux` is a default label the runner
   gets anyway; dropping it from `runs-on:` changes which runner is picked only if a second
   `mmlabs-server` runner on another OS existed, which the runbook does not create.
2. **The `docker ps` check as a YAML snippet inside the runbook**, pasted into a temporary workflow and
   deleted afterwards. Genuinely smaller — one file fewer. Rejected because verification 3 has to be
   repeated after every reboot that matters, a snippet cannot be reviewed or linted as a workflow,
   and a temporary file the operator adds and removes by hand is a file that sometimes stays. As a
   draft with `permissions: {}` and `workflow_dispatch` only, it is safe to keep.
3. **A setup script that performs the runbook.** Rejected: the row says *hand-run*; the steps span
   elevated Windows PowerShell, root in WSL and the `gh-runner` user, so one script would need the
   highest of the three for all of it; the registration token would have to pass through it; and a
   script that fails halfway leaves a host in a state no **Check:** line describes. The project's
   working agreement also keeps executable shell files out of this repository.
4. **An ephemeral (just-in-time) runner, or an organisation-level runner group.** Ephemeral runners
   would clean the workspace by construction and answer *workspace hygiene* better. Rejected: they
   need something on the host to request a new registration per job, which means a long-lived
   credential with admin rights on the repository stored on the server — the opposite of the
   request's *register it to this repo only* and of CICD-05's no-secret-in-the-drafts line.

## Changelog

- `2026-10-14T20:48:21+07:00` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2
  were written from the feature row and the idea file before the drafts were read; reading
  `deploy-calechip.yml` and the README added no AC and amended none. AC-17 (`ci-cd.md`) was added
  after reading `docs/ops/ci-cd.md`, whose workflow table would otherwise go stale with the new
  `runner-check` workflow.
