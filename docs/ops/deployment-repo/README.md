# The deployment repository — drafts

The files that turn a merged release pull request in the deployment repository into a deploy of
CaleChip on the home server. **The operator applies them by hand, from this document. No workflow
and no agent writes to the deployment repository.** Written by CICD-05.

## What this is

CICD-04's `release` workflow ends with a pull request in the deployment repository. That pull request
changes one file, `apps/calechip/release.env`, to two lines:

```
CALECHIP_IMAGE=mingming21400/calechip:vX.Y.Z@sha256:<64 hex>
CALECHIP_VERSION=vX.Y.Z
```

`CALECHIP_VERSION` is the version the sidebar footer shows. `compose.yml` passes it to the
container, which serves it as `/version.json`. The image cannot carry it: it is built before the tag
exists and promoted by digest without rebuilding.

The drafts in this folder make merging that pull request the whole deploy:

- `apps/calechip/compose.yml`: the CaleChip service, its image taken only from `release.env`.
- `.github/workflows/deploy-calechip.yml`: on a merge to `main` that touches `apps/calechip/`, deploy
  CaleChip on the server's own runner, wait for its health check, and restore the previous version
  if it is not healthy.
- `.github/workflows/pr-scope.yml`: a pull request from `release/<app>-v…` may change only
  `apps/<app>/`.
- `.github/workflows/runner-check.yml`: run by hand from the Actions tab, it proves the self-hosted
  runner picks up a job, runs it as `gh-runner` and not as root, and reaches Docker.
- `runner-setup.md`: the runbook that sets up that runner, run by hand on the server.
- `.github/CODEOWNERS`: the owner of the workflows and of CaleChip's folder.

**This folder maps to the deployment repository's root.** `docs/ops/deployment-repo/apps/calechip/`
becomes `apps/calechip/`, and `docs/ops/deployment-repo/.github/` becomes `.github/`.

**Nothing here runs in this repository.** GitHub runs workflows only from the root
`.github/workflows/` and reads `CODEOWNERS` only from the root, `.github/` or `docs/`, so a
`.github/` folder nested here is inert.

## Before you apply

Work through these in order. Each one stops the apply until it is true.

1. **If the deployment repository holds any real secret, stop.** Remove it, rotate it at its source,
   and only then go on. A secret that was ever committed is already exposed in history; deleting the
   file does not unexpose it.
2. **The deployment repository is private.** The workflows and the compose file describe the server's
   layout.
3. **Replace `TODO-operator-tunnel-network`** in `apps/calechip/compose.yml` with the name of the
   Docker network `cloudflared` is on (`docker network ls`, then `docker inspect <cloudflared
   container>`). The deploy refuses to run while the placeholder is there.
4. **The tunnel's ingress for CaleChip points at `http://calechip:3000`.** `cloudflared` reaches the
   container by its service name on that network; no host port is published.
5. **Stop any CaleChip container started by hand on that network.** Two containers answering to
   `calechip` on one network make the tunnel's target ambiguous.
6. **The server can pull `mingming21400/calechip`.** If the image is private, run `docker login` once
   on the server, as the runner's user.
7. **CICD-04's `DEPLOY_REPO` variable**, in this repository's settings, names the deployment
   repository as `owner/name`.
8. **The deployment repository's branch protection on `main` lets `github-actions[bot]` push.** A
   restore pushes one revert commit to `main`. If protection refuses it, the server is restored but
   the run ends `restore-unpushed`, and the repository and the server disagree until someone pushes
   the revert by hand.
9. **Set up the runner with [runner-setup.md](runner-setup.md)** and pass its three verifications
   before the first merge that touches `apps/calechip/`.
10. **Change `@didi-code0980` in `.github/CODEOWNERS`** if the deployment repository belongs to
    another account.
11. Optionally, make `pr-scope` a required check on the deployment repository's `main`, once it has
    passed at least once.

The first merge that applies the layout carries no `release.env` yet. Its `deploy-calechip` run is
green and deploys nothing. The first deploy is the merge of CICD-04's first release pull request.

## Layout

```
apps/
  calechip/
    compose.yml        # this folder's draft
    release.env        # written by CICD-04's release pull request; never by hand
.github/
  CODEOWNERS
  workflows/
    deploy-calechip.yml
    pr-scope.yml
    runner-check.yml
runner-setup.md        # the runner's setup runbook
```

Every app has its own folder under `apps/`, and its own deploy workflow that triggers on that folder
only. `pr-scope` already covers any `apps/<app>/`.

`release.env` holds no secret: an image name, a tag and a digest. The only environment CaleChip
reads at runtime is `CALECHIP_VERSION`, the label in the sidebar footer. Every `VITE_*` value is
baked into the image at build, and nginx's port is fixed.

## How a deploy runs

`deploy-calechip` runs on a push to `main` that changes anything under `apps/calechip/`, which in
practice is a merged release pull request. It runs on the server's runner, one at a time
(`concurrency: deploy-calechip`, never cancelled), and has four steps:

1. **`release`.** Refuses to continue if `compose.yml` still holds a `TODO-operator` placeholder.
   With no `release.env`, it says nothing has been released and the run ends green. Otherwise it
   reads `CALECHIP_IMAGE` and refuses anything that is not
   `mingming21400/calechip:vX.Y.Z@sha256:<digest>`: no `:latest`, no bare tag, no bare digest. It
   also reads the image the push replaced, from the commit before it.
2. **`deploy`.** Runs, against CaleChip's project only:

   ```
   docker compose -p calechip -f apps/calechip/compose.yml --env-file apps/calechip/release.env config --quiet
   … pull
   … up -d --wait --wait-timeout 120
   ```

   `--wait` returns non-zero if the container reports unhealthy, or is not healthy within 120
   seconds. The health check is the image's own `/healthz` on port 3000, probed every 5 seconds.
3. **`rollback`.** Runs only if `deploy` failed. See the next section.
4. **`notify`.** Writes the outcome to the run's summary and, when the pushed commit belongs to a
   pull request, comments the same line on it with the run's URL. The outcomes are `deployed`,
   `restored`, `restore-unpushed`, `no-previous`, `restore-failed` and `did-not-complete`.

There is **no migrate step**. Schema changes are human (RULE-09), and the container is static nginx
with no database client.

## How a failed deploy is restored

When `deploy` fails, `rollback`:

1. restores `apps/calechip/` to its state at the push's `before` commit, files added since included;
2. pulls and starts that version, with the same `--wait`;
3. commits the restore on `main`, naming the restored and the failed version;
4. pushes that commit.

The server is restored before the repository, so service comes back first. A push made with the
workflow's own token does not start another run, so the revert does not redeploy itself.

**A deploy that pushes a revert is still a red run.** Red means the version that was merged is not
the one running.

It refuses, and pushes nothing, in two cases:

- **`no-previous`:** the push's `before` commit has no `release.env`, so there is nothing to go back
  to. CaleChip is left as `up` left it.
- **`restore-failed`:** the previous version failed its health check too. CaleChip needs a hand.

**The restore covers the image and `apps/calechip/` only. It never touches the database.** Because
the pipeline applies no migration (RULE-09), every migration must stay compatible with the previous
release's image. A migration that the previous image cannot run against makes a restore bring back a
broken site.

A manual rollback is a revert pull request in the deployment repository. It deploys through the same
path, and there is deliberately no "redeploy version X" button: only merged config is deployed.

## The runner

`deploy-calechip` and `runner-check` run on a self-hosted GitHub Actions runner on the WSL server.
Its name and its one added label are both `mmlabs-server`, and the workflows select it with
`runs-on: [self-hosted, mmlabs-server]`. **Set it up with [runner-setup.md](runner-setup.md)**, which
leaves it so that:

- **it runs as a dedicated non-root user**, `gh-runner`, not as root and not as the operator's own
  account;
- **it is registered to the deployment repository only**, never to an organisation or to this
  repository;
- **it carries the label `mmlabs-server`**, which is the only label the workflows select it by beyond
  `self-hosted`;
- **it connects outbound only.** The runner polls GitHub; nothing reaches into the server, so it
  works behind the tunnel with no port opened.

The host also needs Docker Compose v2 with `up --wait-timeout`, `git` and `gh`, on the runner user's
`PATH`.

**The trade-off.** To run `docker compose`, the runner's user must be in the `docker` group, and
**membership of the `docker` group is equivalent to root on the host**: any job on that runner can
mount the host's filesystem into a container. That is accepted because only merged config runs
there, and it holds only while this rule does:

> **No workflow with a `pull_request` trigger may target the self-hosted runner.** A pull request's
> code would run as that user, which is root on the server. `pr-scope` runs on `ubuntu-latest` for
> this reason, and `deploy-calechip` has no pull request trigger.

## Secrets

**None of these drafts holds or reads a secret.** `deploy-calechip` uses only the workflow's own
`github.token`, for the revert push and the pull request comment. `pr-scope` uses the same token,
read-only. `release.env` holds an image reference.

The one credential the server may need, a Docker Hub login to pull a private image, lives in the
runner user's Docker config on the server (`docker login`), never in the repository.

If CaleChip ever needs a runtime secret, it goes on the server, outside the repository, and is passed
to compose from there; or in the deployment repository's Actions secrets. **It is never committed**,
not even to a private repository, and that change needs its own ticket.
