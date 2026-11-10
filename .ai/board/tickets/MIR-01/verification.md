---
ticket: MIR-01
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-21T16:36:00+07:00
purpose: "Manual verification of record for AC-1 to AC-9 — no automated path may hold a Supabase key (01-plan.md § 2, § 4.2)"
steps_written_by: developer
results_filled_by: operator
---

# MIR-01 — manual verification

**The developer wrote the steps. The operator fills in every `Result` line.** No agent fills in a
result, and no agent runs any of these commands: each one needs a key, and handing an agent a key is
the exposure this ticket ends (01-plan.md § 8).

Run part 1 **before** rotating, part 2 **after** the rotation and the deploy. Use Git Bash.

**Never write a key, a prefix of one, or any part of one into this file, a commit, a PR body or a
chat.** Keys live in shell variables only. Every `curl` below prints an HTTP status and discards the
body (`-o /dev/null`), so nothing that could echo a header reaches the terminal.

## Setup, once, in your shell

```
export SUPABASE_URL="https://<project-ref>.supabase.co"

# The old service role key, read from the leaked commit straight into a variable — never printed.
# If 5a29434 is missing locally: git fetch origin ops/architecture
OLD_SERVICE=$(git show 5a29434:.env | sed -n 's/^SUPABASE_SERVICE_ROLE_KEY=//p' | tr -d '\r"')
[ -n "$OLD_SERVICE" ] && echo "OLD_SERVICE set (${#OLD_SERVICE} chars)" || echo "OLD_SERVICE EMPTY"

# The old anon key. GitHub cannot show an Actions secret's value back, so copy it from the Supabase
# dashboard's API settings BEFORE rotating (TODO(verify): the exact page on the day). -s: no echo.
read -rs OLD_ANON; echo "OLD_ANON set (${#OLD_ANON} chars)"

# After rotation only: the new anon (or publishable) key, from the same page.
read -rs NEW_ANON; echo "NEW_ANON set (${#NEW_ANON} chars)"
```

`read -rs` keeps the value out of shell history and off the screen. Close the shell when done.

## Part 1: before rotation

### AC-1 — the old service role key's state is recorded

```
curl -s -o /dev/null -w '%{http_code}\n' "$SUPABASE_URL/rest/v1/member?select=id&limit=1" \
  -H "apikey: $OLD_SERVICE" -H "Authorization: Bearer $OLD_SERVICE"
```

Expected: any status. `2xx` means the key was live until rotation; `401` means it was already dead.
Either passes; an empty line does not.

Result:

## Part 2: after rotation and deploy

Rotate in the Supabase dashboard, then set the new anon (or publishable) value on the existing
Actions secret — name unchanged (01-plan.md § 1, *Out of scope*):

```
gh secret set VITE_SUPABASE_ANON_KEY     # paste the value at the prompt; it is not echoed
```

Update any developer `.env.local` that holds the old values. Merge this ticket's pull request, let
`build-image` run, release and deploy the resulting `mingming21400/calechip:sha-<7>` tag
([docs/ops/ci-cd.md](../../../../docs/ops/ci-cd.md) § *Cutting a release*).

### AC-2 — the old service role key is rejected

```
curl -s -o /dev/null -w '%{http_code}\n' "$SUPABASE_URL/rest/v1/member?select=id&limit=1" \
  -H "apikey: $OLD_SERVICE" -H "Authorization: Bearer $OLD_SERVICE"
```

Expected: not `2xx` (a non-2xx status returns no row).

Result:

### AC-3 — the old anon key is rejected

```
curl -s -o /dev/null -w '%{http_code}\n' "$SUPABASE_URL/auth/v1/settings" -H "apikey: $OLD_ANON"
```

Expected: not `2xx`.

Result:

Control — the same request with the new key, so a failure above is the key and not the URL:

```
curl -s -o /dev/null -w '%{http_code}\n' "$SUPABASE_URL/auth/v1/settings" -H "apikey: $NEW_ANON"
```

Expected: `200`.

Result:

### AC-4 — production runs on the new anon key

Sign in to production as an existing member. Expected: the calendar loads with their team's
entries, and `seam-banner` does not report the mock.

Result (image tag deployed, time, outcome):

### AC-5 — the email hand-off still works

As a member, invite someone to an event. Expected: the invitation email arrives (the trigger uses the
Vault secret `event_email_hook_secret`, not a Supabase key).

Result:

### AC-6 — a session open across the rotation does not break the app

In a browser signed in to production **before** the rotation, reload after AC-4 is deployed.
Expected: either the session continues, or the sign-in screen appears and signing in works. Never an
empty calendar or a seam error. Record which of the two happened — it also fills the second
*Consequences* bullet of `docs/ops/key-rotation.md`.

Result:

### AC-8 — no key is written anywhere (refusal)

Run on this ticket's branch, after the § 4.1 row in `docs/ops/key-rotation.md` is filled. Each
command prints a count of matching files; nothing printed means nothing found.

```
git grep -c -F "$OLD_SERVICE"
git grep -c -F "$OLD_ANON"
git grep -c -F "$NEW_ANON"
git diff origin/main -- . | grep -cE 'eyJ[A-Za-z0-9_-]{20,}|sb_(secret|publishable)_[A-Za-z0-9]'
```

Expected: the three `git grep` print nothing; the last prints `0`.

Result:

### AC-9 — the service role key stays out of CI (refusal)

```
gh secret list
gh variable list
```

Expected: secrets are exactly `DOCKERHUB_USERNAME`, `DOCKERHUB_TOKEN`, `VITE_SUPABASE_URL`,
`VITE_SUPABASE_ANON_KEY`, `DEPLOY_REPO_TOKEN`; the one variable is `DEPLOY_REPO`
([docs/ops/ci-cd.md](../../../../docs/ops/ci-cd.md) § *Secrets and variables*). No name carries a
service role or secret key.

Result:

## When every `Result` is filled

Fill the row in [docs/ops/key-rotation.md](../../../../docs/ops/key-rotation.md) (every field, and the
second *Consequences* bullet from AC-6), then the `Verified` cell of MIR-01 in
`.ai/board/plans/multi-tenancy-status.md`.
