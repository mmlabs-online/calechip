# Setting up the runner `mmlabs-server`

**A draft, written by CICD-07, for the operator to run by hand, once, top to bottom, on the WSL
server and on the Windows host under it. No workflow and no agent runs any of it.** It leaves a
self-hosted GitHub Actions runner named and labelled `mmlabs-server`, registered to the deployment
repository only, running as the non-root user `gh-runner`, and back online after a Windows reboot
with nobody logged in. Every step ends with a **Check:** — a command, or a GitHub page, and the
output that means the step worked. Do not go on to the next step until the check passes.

**Where each command runs.** Each command block is headed with one of three places:

- *Windows, elevated PowerShell* — PowerShell opened with **Run as administrator** on the Windows
  host.
- *WSL, as your own user with sudo* — a shell in the WSL distro, as your usual account.
- *WSL, as `gh-runner`* — after `sudo -iu gh-runner` from your own user. `exit` returns to your own
  user.

Placeholders are in angle brackets. `<distro>` is the name of the WSL distro the runner lives in, as
printed by `wsl --list --verbose`.

## Steps

### 1. The deployment repository is private

**Stop here unless the deployment repository is private.** A self-hosted runner on a public
repository can be reached by anyone's pull request, and this runner's user is root on the server
(step 7). If the repository is ever to be made public, see
[Before the repository is ever made public](#before-the-repository-is-ever-made-public) first.

**Check:** on the deployment repository's page on GitHub, the badge next to its name reads
**Private**. (Or `gh repo view <owner>/<name> --json visibility` prints `"visibility":"PRIVATE"`.)

### 2. Windows does not sleep

A host that sleeps takes the runner with it, and verification 3 depends on the machine staying awake
after a reboot with nobody at it.

*Windows, elevated PowerShell:*

```powershell
powercfg /change standby-timeout-ac 0
powercfg /change hibernate-timeout-ac 0
```

**Check:**

```powershell
powercfg /query SCHEME_CURRENT SUB_SLEEP STANDBYIDLE
powercfg /query SCHEME_CURRENT SUB_SLEEP HIBERNATEIDLE
```

Each prints `Current AC Power Setting Index: 0x00000000` — 0, never.

### 3. systemd in WSL

The runner is installed as a systemd service (step 8), so systemd must be PID 1 in the distro.

*WSL, as your own user with sudo:* open `/etc/wsl.conf` with `sudoedit /etc/wsl.conf` and make sure
it contains this section. Keep any other section already in the file.

```ini
[boot]
systemd=true
```

Then restart the distro. *Windows, elevated PowerShell:*

```powershell
wsl --shutdown
```

and open a new WSL shell.

**Check:** *WSL, as your own user with sudo:*

```bash
ps -p 1 -o comm=
```

prints `systemd`.

### 4. The distro starts at boot — `mmlabs-server-wsl`

WSL starts a distro only when something asks for it, and stops it when nothing in it is running from
Windows. This step creates one scheduled task, `mmlabs-server-wsl`, that starts the distro at system
startup, whether or not anyone logs in, and keeps one process running in it so it is never stopped as
idle. systemd then starts the runner service inside it.

**The task has no execution time limit, and that is required.** Task Scheduler stops a task after
three days by default; stopping this task ends the process that keeps the distro up, so the distro,
and the runner with it, go down with no error anywhere.

The task runs as your own Windows account, because WSL distros belong to the user that installed
them. *Run whether the user is logged on or not* needs the account's password; `Get-Credential`
prompts for it, and Task Scheduler stores it. It is not written to any file or to the command history.

*Windows, elevated PowerShell* — replace `<distro>`:

```powershell
$cred      = Get-Credential -UserName "$env:USERDOMAIN\$env:USERNAME" -Message "Windows password for mmlabs-server-wsl"
$action    = New-ScheduledTaskAction -Execute "wsl.exe" -Argument "-d <distro> --exec /bin/sh -c 'exec sleep infinity'"
$trigger   = New-ScheduledTaskTrigger -AtStartup
$settings  = New-ScheduledTaskSettingsSet -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable
Register-ScheduledTask -TaskName "mmlabs-server-wsl" -Action $action -Trigger $trigger -Settings $settings -User $cred.UserName -Password $cred.GetNetworkCredential().Password -RunLevel Limited
Start-ScheduledTask -TaskName "mmlabs-server-wsl"
Remove-Variable cred
```

If you sign in to Windows with a Microsoft account, the user name the task needs may differ from
`$env:USERDOMAIN\$env:USERNAME`; `whoami` prints the one Windows uses.

**Check:**

```powershell
Get-ScheduledTask -TaskName mmlabs-server-wsl | Select-Object TaskName, State, @{n='TimeLimit';e={$_.Settings.ExecutionTimeLimit}}
```

prints `State` `Running` and `TimeLimit` `PT0S` (no limit). The proof that the task really brings
the distro up at boot is [verification 3](#verify).

### 5. `.wslconfig` idle timeout — only if the installed WSL supports it

**Optional, and checked, not assumed.** Step 4 is what keeps the distro up. A `.wslconfig` idle
timeout only changes how long the WSL virtual machine waits before shutting down once nothing is
running, and a key the installed WSL does not recognise does nothing.

*Windows, elevated PowerShell:*

```powershell
wsl --version
```

Compare the `WSL version` it prints with Microsoft's documentation of `.wslconfig`,
<https://learn.microsoft.com/windows/wsl/wsl-config>. **If that page does not document an
idle-timeout key under `[wsl2]` for your installed version, skip this step.** The minimum WSL version
that supports it is `TODO(verify)`: this runbook does not state one, because none was confirmed from
a source when it was written.

If it is documented, add the key exactly as the page names it to `%UserProfile%\.wslconfig` under
`[wsl2]`, with a value large enough not to matter while step 4's task is running, then run
`wsl --shutdown`.

**Check:** `wsl --version` and the documentation page agree that the key exists, and after
`wsl --shutdown` and `Start-ScheduledTask -TaskName mmlabs-server-wsl`,
`wsl --list --verbose` shows `<distro>` as `Running`. If you skipped the step, the check is that you
wrote down why.

### 6. Docker, Compose, `git` and `gh` are on the host

Installing Docker is not described here. `deploy-calechip` needs what
[README § The runner](README.md#the-runner) lists: Docker Compose v2 with `up --wait-timeout`,
`git` and `gh`.

**Check:** *WSL, as your own user with sudo:*

```bash
docker version --format '{{.Server.Version}}'
docker compose version
docker compose up --help | grep -- --wait-timeout
git --version
gh --version
```

Each prints a version, and the `grep` prints the `--wait-timeout` line. Verification 2 repeats the
Docker part as `gh-runner`.

### 7. The `gh-runner` user

A dedicated user, with no password login, in the `docker` group and in no admin group.

**`docker` membership is equivalent to root on the host.** Why that is accepted, and the rule it
depends on, are in [README § The runner](README.md#the-runner).

*WSL, as your own user with sudo:*

```bash
sudo adduser --disabled-password --gecos "" gh-runner
sudo usermod -aG docker gh-runner
```

Do **not** add `gh-runner` to `sudo`, `admin`, `wheel` or any other group.

**Check:**

```bash
id gh-runner
```

lists `docker` among the groups, and does not list `sudo`, `admin` or `wheel`.

### 8. Register the runner and install the service

The runner is registered to the deployment repository, never to an organisation. Take the download
commands and the registration token from the deployment repository's
**Settings → Actions → Runners → New self-hosted runner** page, choosing *Linux* and the host's
architecture. **This runbook deliberately pins no runner version**: the page always gives the current
one, with its checksum.

**The registration token is short-lived** (about an hour) **and is pasted straight into the command.
Never write it to a file, a note or the repository.**

*WSL, as `gh-runner`:*

```bash
mkdir -p ~/actions-runner && cd ~/actions-runner
# paste the Download commands from the page here: curl, the checksum check, tar
./config.sh --unattended --url <deployment repository URL> --token <registration token> --name mmlabs-server --labels mmlabs-server --work _work
exit
```

*WSL, as your own user with sudo:*

```bash
cd /home/gh-runner/actions-runner
sudo ./svc.sh install gh-runner
sudo ./svc.sh start
```

**Check:**

```bash
sudo ./svc.sh status
```

shows `Active: active (running)`, and the service runs as `gh-runner`.

## Hardening

Each item with its check. All are run *WSL, as your own user with sudo*, unless a GitHub page is
named.

- **`gh-runner` has no sudo rights.** `sudo -l -U gh-runner` prints that `gh-runner` is not allowed
  to run sudo.
- **The runner is registered to the deployment repository only.** Its
  **Settings → Actions → Runners** page lists `mmlabs-server`; if the repository belongs to an
  organisation, that organisation's **Settings → Actions → Runners** does not, and no other
  repository's does.
- **The runner's directory belongs to `gh-runner` and is not writable by anyone else.**
  `stat -c '%U %A' /home/gh-runner /home/gh-runner/actions-runner` prints `gh-runner` for both, with
  no `w` in the group or other positions. If it does, `sudo chmod go-w` the directory.
- **No port is opened for the runner.** It connects outbound to GitHub only and works behind the
  tunnel. `sudo ss -ltnp | grep -i -e Runner -e actions` prints nothing.
- **No workflow with a `pull_request` or `pull_request_target` trigger may target `mmlabs-server`.**
  This is the rule in [README § The runner](README.md#the-runner); every workflow added to the
  deployment repository is reviewed against it. Check, in a checkout of the deployment repository:
  `grep -l mmlabs-server .github/workflows/*.yml | xargs grep -l pull_request` prints nothing.
- **A Docker Hub login, if the image is private, is made as `gh-runner` and nowhere else.**
  *WSL, as `gh-runner`:* `docker login -u <Docker Hub user>`, typing the token at the prompt rather
  than on the command line. Docker keeps it in `gh-runner`'s own Docker config, which is the one
  credential on the server ([README § Secrets](README.md#secrets)). Check: `docker pull` of the image
  works as `gh-runner`.

## Workspace hygiene

- **Job workspaces live under `/home/gh-runner/actions-runner/_work`**, owned by `gh-runner`. The
  runner reuses them between jobs; nothing else should be written there.
- **Dangling images are the only thing to clean up**, by hand or on a schedule you choose:

  ```bash
  docker image prune -f
  ```

  That removes only untagged images no container uses.
- **Never run `docker system prune`, `docker image prune -a`, or any prune with `--volumes` on this
  host.** The server runs other apps' containers and volumes; those commands remove images a stopped
  service needs to start again, and data.

## Verify

The runner is **not ready for `deploy-calechip` until all three have passed**, in this order.

1. **Idle on GitHub.** The deployment repository's **Settings → Actions → Runners** page lists
   `mmlabs-server` as **Idle**, with the label `mmlabs-server`.
2. **It runs a job as `gh-runner` and reaches Docker.** With
   [`runner-check.yml`](.github/workflows/runner-check.yml) applied to the deployment repository, open
   **Actions → runner-check → Run workflow**. The run is green, its `identity` step prints
   `user: gh-runner`, and its `docker` step prints the server version, the Compose version and the
   `docker ps` table.
3. **Back online after a Windows reboot, with nobody logged in.** Reboot Windows and **do not log
   in**. Wait a few minutes, then, from another device, repeat verifications 1 and 2. Both pass.

## Before the repository is ever made public

**Remove the runner first.** On a public repository, anyone's pull request could reach a runner whose
user is root on the server.

Get a removal token from the deployment repository's **Settings → Actions → Runners →
`mmlabs-server` → Remove** page. Like the registration token, it is pasted straight into the command
and never written down.

*WSL, as your own user with sudo:*

```bash
cd /home/gh-runner/actions-runner
sudo ./svc.sh stop
sudo ./svc.sh uninstall
```

*WSL, as `gh-runner`:*

```bash
cd ~/actions-runner
./config.sh remove --token <removal token>
```

**Check:** the **Settings → Actions → Runners** page no longer lists `mmlabs-server`. Only then change
the repository's visibility.
