---
ticket: MIR-18-c
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-11T08:35:00Z
inputs_read: [ .ai/board/tickets/MIR-18-c/01-plan.md, .ai/board/tickets/MIR-18-c/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-18-c — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261111180000_mir18c_mfa_verification_hook.sql` | created | the log table, its RLS and grants, and the hook function | § 4.1 |
| `supabase/config.toml` | modified | enables the hook on the local stack | § 4.2 |
| `docker/nginx.conf` | modified | 404 for `/system.html`; include of the generated panel location | § 4.3 |
| `Dockerfile` | modified | `CMD` validates `CALECHIP_SYSTEM_PATH` and writes `/tmp/nginx/system-panel.conf` | § 4.3 |
| `docs/ops/deployment-repo/apps/calechip/compose.yml` | modified | optional `env_file` for the path, header comment | § 4.3 |
| `docs/ops/deployment-repo/README.md` | modified | names the variable, its file, the generator, the Compose 2.24 requirement | § 4.3 |
| `src/lib/data/system.ts` | modified | `rate_limited` from the real seam on `mfa_verification_rejected`; the mock's own count | § 4.4 |
| `src/system/main.tsx` | modified | `verify` re-reads the gate on `rate_limited` and shows the message where the visitor now is | § 4.5 |
| `supabase/tests/360-mfa-verification-hook.test.sql` | created | pgTAP for AC-6 to AC-12 (29 assertions) | § 4.6 |
| `tests/e2e/mir-18-c-code-lockout.spec.ts` | created | Playwright for AC-13 to AC-16 | § 4.7 |
| `.ai/standards/rbac-and-security.md` | modified | one sentence in Authentication, one Secrets row | § 4.8 |

`.ai/registry/decisions/ADR-095-...md` is in `allowed_paths` and was written at PLAN; not touched here.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 | migration, whole file | steps 1 to 5 in order; limits are literals citing ADR-095 decision 4; `security invoker`, `search_path = ''` |
| 4.2 | `supabase/config.toml`, after the `custom_access_token` comment | nothing else changed |
| 4.3 nginx | `docker/nginx.conf`, before `location /` | |
| 4.3 Dockerfile | `Dockerfile` `CMD` | still one `sh -c`; version.json step unchanged |
| 4.3 compose / README | the two files | |
| 4.4 | `system.ts:273`, `:370`, `:745`, `:942` | `mockCodeFailures` is a `const` Map (plan said `let`; never reassigned, lint-clean) |
| 4.5 | `main.tsx:1294` | no new state or testid |
| 4.6, 4.7, 4.8 | as listed above | |

## Deviations from the design

- `mockCodeFailures` declared `const`, not `let` (§ 4.4). Same behaviour; it is never reassigned.
- Otherwise none.

## Invariants

`invariants_touched: []`. No entry, count, team, membership or role is read or written; the only new
rows are in a new table keyed on `auth.users`.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 55 files, 1078 tests |
| `pnpm exec playwright test` on `mir-18-c-code-lockout.spec.ts` and `mir-18-system-panel.spec.ts` | 0 | 13 passed (AC-13 to AC-16, and MIR-18's suite unchanged) |
| `git diff --name-only` subset of `allowed_paths` | yes | plus two untracked new files, both listed in `allowed_paths` |
| the `CMD` shell logic, extracted and run with `nginx` replaced by `echo` | ok | valid 34-char value writes the exact location block; unset, `short`, a value with `/../`, and 129 `a` each write the comment line, print the stderr line, and never echo the value |

## NOT run, and why

This sandbox has no Docker daemon, no nginx and no PostgreSQL server. So **not executed**:

- **AC-1 to AC-5** (container, `curl`): `verification.md` is therefore not written. One point to check
  there: the panel location serves `/system.html` through `try_files /system.html =404`, which nginx
  documents as serving a non-last file in the current location without re-matching, so it should not
  fall into `location = /system.html { return 404; }`. Unconfirmed by running.
- **AC-6 to AC-12** (pgTAP, `pnpm db:test`): `360-mfa-verification-hook.test.sql` is written and its
  assertion count (29) counted by hand, but never run. CI's `database` job is the first execution.
- **AC-17** (real stack): the event keys `user_id`, `factor_id`, `valid`, the hook's call on an invalid
  code, and whether a rejection ends the session remain `TODO(verify)`. `verification_required: true`
  stays open until a person runs it.

## Testability contract

No new `data-testid`. Existing ones used: `system-verify`, `system-code-input`, `system-code-submit`,
`system-code-error`, `system-signin-form`, `system-signin-email`, `system-signin-password`,
`system-signin-submit`, `system-signin-error`, `system-signed-in`.

## Open questions

None for design. The three `TODO(verify)` facts above are for AC-17.
