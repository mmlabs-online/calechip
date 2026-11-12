---
ticket: MIR-18-c
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-11T08:37:10Z
inputs_read: [ .ai/board/tickets/MIR-18-c/01-plan.md, .ai/board/tickets/MIR-18-c/03-impl-log.md, .ai/board/tickets/MIR-18-c/ticket.yaml, .ai/registry/invariants.md, .ai/01-operating-model.md, "git diff origin/main...HEAD" ]
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

# MIR-18-c — review

Branch `feat/MIR-18-c`, two commits ahead of `origin/main` (`750ed59`, `12c2fe8`); working tree clean
at review time. Every command below was run by the reviewer, not read from `03-impl-log.md`.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-18-c, 16 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-18-c` → `0 uncommitted path(s)` / `PASS — nothing stray`. The 12 non-exempt paths match `ticket.yaml:19-30` one-for-one; the other 4 are the ticket folder and `.ai/board/backlog.md` (ship-owned). |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output. The new `rate_limited` literal is a member of `FailureCode` (`src/lib/domain/types.ts:136`). |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint src/lib/data/system.ts src/system/main.tsx tests/e2e/mir-18-c-code-lockout.spec.ts` exit 0; repo-wide `pnpm lint` exit 0 too, so no out-of-diff chore to note. |
| R4 | Nothing outside the seam reaches the datastore | PASS | The only datastore call added is in the seam, `src/lib/data/system.ts:365-371` (`mfa.challengeAndVerify`, existing client). The panel reaches it only through `systemSeam.verifyCode` / `systemSeam.gate` (`src/system/main.tsx:1291`, `:1297`); `main.tsx` imports no Supabase client. The hook runs inside Supabase Auth, not in any client (`supabase/config.toml:292-294`). |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail — 4.1 to 4.8 each located. |
| R6 | Permission gating matches § 3 | PASS | Panel HTML: `docker/nginx.conf:69-71` (`/system.html` → 404) and the only serving location generated at `Dockerfile:101`. Verify gate: hook `supabase/migrations/20261111180000_mir18c_mfa_verification_hook.sql:61-69`. Table write/read: `:23-33` (RLS on, `revoke all … from public, anon, authenticated`, `select, insert` + two policies to `supabase_auth_admin` only). Execute: `:75-76`. Panel/mock mapping is affordance only (`src/lib/data/system.ts:369-370`, `:942-946`), matching § 3's last paragraph. |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:17`); per-ID reasoning for INV-01 to INV-07 in R7 detail. |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. The only new runtime surface is a Supabase Auth hook, recorded in ADR-095 (`ticket.yaml:19`). |

Also run, not an R-check: `pnpm test` exit 0 (55 files, 1078 tests); `pnpm exec playwright test
tests/e2e/mir-18-c-code-lockout.spec.ts tests/e2e/mir-18-system-panel.spec.ts` — 13 passed (AC-13 to
AC-16 and MIR-18's suite). The `Dockerfile:101` `CMD` string was extracted and run under `sh` with
`/tmp/nginx` redirected and `nginx` stubbed: unset, `short`, the `/../` value, 129 × `a`, and a 34-char
value containing `;` each wrote the comment line and printed the exact stderr line without the value;
the 34-char fixture `P` wrote exactly the § 4.3 location block.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 table, check constraint, index | `supabase/migrations/20261111180000_mir18c_mfa_verification_hook.sql:10-21` | Yes — columns, `reason` check, `(user_id, attempted_at desc)` index as specified |
| 4.1 RLS, revoke, grants, two policies, schema usage | same file `:23-35` | Yes — idempotent `drop policy if exists` before each `create policy` (ADR-024) |
| 4.1 function header (`plpgsql volatile security invoker set search_path = ''`) and grants | `:37-38`, `:75-76` | Yes |
| 4.1 step 1 — parse, null → `22023` | `:40-47` | Yes |
| 4.1 step 2 — log `invalid_code` | `:49-52` | Yes |
| 4.1 step 3 — 15-minute count of `invalid_code` | `:55-59` | Yes; literals with ADR-095 comment `:54` |
| 4.1 step 4 — `>= 5`: `locked_out` when valid, reject message | `:61-69` | Yes; message text identical to § 4.1 |
| 4.1 step 5 — continue | `:71` | Yes |
| 4.2 config hook block | `supabase/config.toml:290-294` | Yes; placed after the commented `custom_access_token` block, nothing else changed |
| 4.3 nginx 404 + include | `docker/nginx.conf:68-75`, between `location = /index.html` (`:63`) and `location /` (`:78`) | Yes |
| 4.3 `CMD` validation, generated location, fallback line, stderr line, value never echoed | `Dockerfile:101`; comment paragraph `:96-100` | Yes — confirmed by running the extracted string (above). `version.json` write unchanged in its command; its `&&` became `;` so the second write always follows — nginx still refuses to start if the include is missing, which is the fail-closed outcome § 4.3 relies on |
| 4.3 generated location's headers | `Dockerfile:101` (printf body) | Yes — the location's `add_header` set replaces the server-level pair at `docker/nginx.conf:37-38`; it restates `nosniff` and sets `Referrer-Policy no-referrer`, as § 4.3 lists. `try_files /system.html =404` serves the found file in the current location without an internal redirect, so `location = /system.html` (`:69`) is not re-entered |
| 4.3 compose `env_file` + header sentence | `docs/ops/deployment-repo/apps/calechip/compose.yml:12-13`, `:23-28` | Yes |
| 4.3 README paragraph + Compose 2.24 | `docs/ops/deployment-repo/README.md:102-106`, `:200-201` | Yes — extended, not replaced; generator and URL form as specified |
| 4.4 constant `TOO_MANY_CODES` | `src/lib/data/system.ts:273` | Yes |
| 4.4 Supabase `verifyCode` → `rate_limited` on `mfa_verification_rejected` | `src/lib/data/system.ts:366-373` | Yes; the code exists in the installed `@supabase/auth-js@2.112.4` `ErrorCode` union (`dist/module/lib/error-codes.d.ts:6`) |
| 4.4 mock constants | `src/lib/data/system.ts:745-747` | Yes; `const` for the Map instead of `let` — declared deviation (`03-impl-log.md:49`), behaviour identical since it is never reassigned |
| 4.4 mock steps 1–4, factor mismatch not counted | `src/lib/data/system.ts:932-948` (mismatch `refused` before counting at `:932-934`) | Yes |
| 4.5 panel `verify` on `rate_limited` | `src/system/main.tsx:1294-1302` | Yes — `gate()`, `arrive`, then sign-in or code error; `arrive` clears only `codeError` (`:1252`), so the order is correct |
| 4.6 pgTAP | `supabase/tests/360-mfa-verification-hook.test.sql:13` `plan(29)`; AC-6 `:60-82` (11), AC-7 `:87-95` (3), AC-8 `:102-104` (2), AC-9 `:109-111` (2), AC-10 `:118-123` (4), AC-11 `:131-132` (1), AC-12 `:139-156` (6) | Yes — 29 counted by the reviewer; every AC-6 to AC-12 clause has an assertion |
| 4.7 Playwright | `tests/e2e/mir-18-c-code-lockout.spec.ts:8` (`PANEL`), `:40-75` one test per AC-13 to AC-16; `clock.install` before `goto` `:68-69`, `fastForward("15:01")` `:71` | Yes; passed when run |
| 4.8 standards | `.ai/standards/rbac-and-security.md:234-235`, `:252` | Yes |

The plan's AC-1 to AC-5 (container), AC-6 to AC-12 executed against Postgres, and AC-17 (real stack)
were not executed here: the host has a Docker client but no daemon
(`/var/run/docker.sock` absent) and no Postgres server. They are acceptance runs, not § 4 contract
items; `ticket.yaml:47` `verification_required: true` makes them a merge-time item, the same reading
`.ai/board/tickets/MIR-04/04-review.md:61` recorded. `.ai/board/tickets/MIR-18-c/verification.md`
does not exist yet, and the three `TODO(verify)` facts (`01-plan.md:313-315`, `:426-427`) remain open
until a person runs AC-17.

## R7 detail

`invariants_touched: []` (`ticket.yaml:17`). Each ledger ID (`.ai/registry/invariants.md:33-39`)
reasoned individually against the diff:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 (no overlapping entries per member) | Untouched — the diff creates no entry, reads no entry table, and changes no entry policy or trigger | migration writes only `public.mfa_failed_verification` (`supabase/migrations/20261111180000_mir18c_mfa_verification_hook.sql:50-51`, `:63-64`) |
| INV-02 (approved entry returns to pending on edit) | Untouched — no entry update path in the diff | `src/lib/data/system.ts:366-373`, `:932-948` are the only seam changes, both inside `verifyCode` |
| INV-03 (rejection carries a reason) | Untouched — the hook's `reject` is a Supabase Auth hook decision, not an entry rejection; no entry status is written | migration `:66-68` |
| INV-04 (one definition of the absence count) | Untouched — no count function, view or client calculation added or changed | full diff: `src/system/main.tsx:1294-1302` and the two seam hunks are the only TS changes |
| INV-05 (tentative still counts) | Untouched — same reason as INV-04 | as above |
| INV-06 (one portion per entry) | Untouched — no entry column or constraint changed | migration `:10-18` defines the only new table |
| INV-07 (one member, counted against every team) | Untouched — no membership or team row read or written; the pgTAP fixture users are `auth.users` rows with no confirmation, so no member row is created | `supabase/tests/360-mfa-verification-hook.test.sql:43-45` |

## Findings

None.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS` — R1 to R8 hold. Next state `DONE`.
