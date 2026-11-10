# Branch protection on `main`

The repository settings that make the pull-request gate required: which checks must pass, who may
push to `main`, and what happens to a merged branch. **The operator applies them by hand, from this
document. No workflow and no agent does** — merging and its rules are permanently human (RULE-09).
Written by CICD-02.

## 1. Before you apply it

**`verify` must have passed on `main` at least once since CICD-02 merged.** The `verify` job is an
aggregate that CICD-02 introduced; before that merge it does not exist on `main` in this shape. A
required check that has never reported blocks every pull request, including the operator's, and the
only way out is to disable the protection just configured.

Check it:

```
gh run list --workflow verify.yml --branch main --limit 1 --json conclusion,headSha
```

Apply only when `conclusion` is `success` and `headSha` is at or after the CICD-02 merge.

## 2. Required checks — exactly three

| Check | Workflow | What it runs |
|---|---|---|
| `verify` | `.github/workflows/verify.yml` | Passes only when `static` (typecheck, lint, unit, documentation audit), `scripts` (hook and script tests), `database` (`pnpm db:test` — pgTAP against every migration) and both `e2e` shards all passed |
| `allowed-paths` | `.github/workflows/allowed-paths.yml` | `scripts/check-allowed-paths.mjs` — RULE-03 on the whole branch |
| `mir-tracking` | `.github/workflows/mir-tracking.yml` | `.github/scripts/check-mir-tracking.mjs` — the MIR status index and change log stay in step |

**Not required, deliberately:**

- **`ci-fast`** — runs on push to `feat/**` only, never on a pull request. It is feedback, not a
  gate; a required check that never reports on a pull request would block every merge.
- **`static`, `scripts`, `database`, `e2e (1/2)`, `e2e (2/2)`** — the jobs inside `verify`. They are not
  required so that the gate can be regrouped, or the shard count changed, without touching these
  settings. `verify` fails whenever any of them fails, is skipped or is cancelled.

## 3. The settings

- **Require status checks to pass before merging** — the three above.
- **Require branches to be up to date before merging** (`strict: true`).
- **Require a pull request before merging**, with **0** approvals.
- **Enforce for administrators** (`enforce_admins: true`) — no direct push to `main` by anyone,
  the operator included.
- **No force pushes** to `main`.
- **No deletion** of `main`.
- **Automatically delete head branches** after merge — a repository setting, not part of the
  protection payload.

The payload is [`branch-protection.json`](branch-protection.json), beside this file. It says exactly
what this list says.

## 4. Code-owner review — off, and why

`.github/CODEOWNERS` says RULE-01 has no mechanism until branch protection requires code-owner
review. But pull requests in this repository are opened under the code owner's own account
(`didi-code0980`), and GitHub does not let an author approve their own pull request — so
`require_code_owner_reviews: true` would block every merge. The payload ships it **off**, with
`required_approving_review_count: 0`.

**If pull requests start arriving under another account**, flip
`required_pull_request_reviews.require_code_owner_reviews` to `true` (and
`required_approving_review_count` to `1`) in `branch-protection.json`, then re-run the first command
in § 5.

## 5. Apply

From the repository root. Each line is valid in PowerShell and in bash.

```
gh api --method PUT repos/didi-code0980/calechip/branches/main/protection --input docs/ops/branch-protection.json
gh api --method PATCH repos/didi-code0980/calechip -F delete_branch_on_merge=true
```

## 6. Verify it took

```
gh api repos/didi-code0980/calechip/branches/main/protection --jq ".required_status_checks"
gh repo view --json deleteBranchOnMerge
```

The first lists the three contexts with `strict: true`; the second prints
`"deleteBranchOnMerge": true`.

## 7. Undo

```
gh api --method DELETE repos/didi-code0980/calechip/branches/main/protection
```

Auto-delete is undone separately, with `-F delete_branch_on_merge=false` on the second command in § 5.

## 8. What this changes for the loop

`/ship` still opens the pull request and the operator still merges; nothing in the loop's commands
changes. After this, an expired quarantine row (check D15, ADR-060) or any other red check blocks
every merge until it is fixed — which is the intent.
