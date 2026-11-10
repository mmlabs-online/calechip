---
ticket: MIR-18
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-04T08:33:48Z
inputs_read:
  - .ai/board/tickets/MIR-18/01-plan.md
  - .ai/board/tickets/MIR-18/ticket.yaml
  - .ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md
  - .ai/standards/testing-standards.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/impl-log.md
  - supabase/tests/_isolation.psql
  - supabase/tests/180-entry-owners.test.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/migrations/20260913090000_solo_avatar_images.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261104090000_mir14b_entry_owners.sql
  - supabase/config.toml
  - vite.config.ts
  - index.html
  - eslint.config.js
  - playwright.config.ts
  - src/main.tsx
  - src/App.tsx
  - src/index.css
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - tests/e2e/seam.setup.ts
  - tests/e2e/tea-05-sign-in.spec.ts
  - node_modules/@supabase/auth-js 2.112.4 dist/module/lib/types.d.ts (Factor, listFactors, enroll, unenroll, challengeAndVerify, getAuthenticatorAssuranceLevel)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-18 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261104150000_mir18_system_admin.sql` | created | The account table, its policy and grants, `is_system_admin()`, the two disjointness triggers, and `grant_system_admin(uuid)` | § 4.1 |
| `supabase/tests/190-system-admin.test.sql` | created | pgTAP for AC-1 to AC-6, 37 assertions, with a local `aal` helper so `_isolation.psql` stays unedited | § 4.2, § 4.7 |
| `supabase/config.toml` | modified | TOTP `enroll_enabled` and `verify_enabled` on for the local stack. Nothing else changed | § 4.3 |
| `src/lib/data/system.ts` | created | The panel's own seam: its own client under `storageKey: "calechip-system-auth"`, the Supabase and mock implementations, chosen by the same test `index.ts` uses | § 4.4 |
| `system.html` | created | The panel's document, with `meta name="robots" content="noindex, nofollow"` | § 4.5 |
| `src/system/main.tsx` | created | The panel entry: six screens driven by `SystemGate`, the § 4.5 test ids, and its own copy of `seam-banner`. Imports only React, `@/lib/data/system` and `../index.css` | § 4.5, § 2b |
| `vite.config.ts` | modified | `build.rolldownOptions.input` names `index.html` and `system.html`, so the panel is a separate entry | § 4.6 |
| `tests/e2e/mir-18-system-panel.spec.ts` | created | AC-7 to AC-14 against the mock build | § 4.7 |
| `.ai/standards/rbac-and-security.md` | modified | The two paragraphs § 3 specifies: one under `## Roles` and one under `## Authentication`. `last_updated` bumped. No existing row changed | § 3 |

PLAN wrote the ADR, the glossary row and `MIR-18-b/ticket.yaml`, and they are untouched here.
`ticket.yaml` is also untouched: `/advance` transcribes the state, as at MIR-14-b's checkpoint.

## Contract items

| Plan item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 table, RLS, grants | `supabase/migrations/20261104150000_mir18_system_admin.sql:32-38` | As written in the plan |
| § 4.1 `system_admin_select_self` | `…_mir18_system_admin.sql:40-43` | |
| § 4.1 `is_system_admin()` | `…_mir18_system_admin.sql:50-58` | Revoked from `public, anon` (F-1 pattern) |
| § 4.1 the two trigger functions and their triggers | `…_mir18_system_admin.sql:64-95` | `BEFORE INSERT FOR EACH ROW`; both revoked from `public, anon, authenticated` |
| § 4.1 `grant_system_admin(uuid)` | `…_mir18_system_admin.sql:106-130` | `EXECUTE` granted to `service_role` only |
| § 4.2 pgTAP | `supabase/tests/190-system-admin.test.sql` | Every assertion is labelled `AC-n`, and each of AC-1 to AC-6 has at least one |
| § 4.3 TOTP | `supabase/config.toml:304-308` | |
| § 4.4 `SystemGate`, `TotpEnrolment`, `SystemSeam` | `src/lib/data/system.ts:18-45` | Names and signatures match § 4.4 |
| § 4.4 own client, own `storageKey`, lazy | `src/lib/data/system.ts:58-65` | |
| § 4.4 Supabase `gate()` | `src/lib/data/system.ts:67-99` | Order as specified: session, then own row (none means signing out with `scope: local` and returning `not-system-admin`), then AAL, then `rpc("is_system_admin")` |
| § 4.4 `signIn` / `startEnrolment` / `verifyCode` / `signOut` | `src/lib/data/system.ts:104-155` | `startEnrolment` unenrols every unverified TOTP factor (`factors.all`) first; `verifyCode` falls back to `factors.totp[0]` (verified only) |
| § 4.4 mock implementation | `src/lib/data/system.ts:157-240` | The three § 2 fixture accounts, `calechip-demo`, `246810`, a fixed secret, an inline SVG data URI |
| § 4.4 `systemSeamName`, `systemSeam` | `src/lib/data/system.ts:243-247` | The only runtime exports |
| § 4.5 `system.html` | `system.html` | Character for character as in the plan |
| § 4.5 entry module | `src/system/main.tsx` | On mount, `gate()`. When `enrol` arrives, `startEnrolment()` runs; if it throws, `system-code-error` shows the specified sentence |
| § 4.6 build input | `vite.config.ts:107-117` | |
| § 3 rbac paragraphs | `.ai/standards/rbac-and-security.md` § Roles, § Authentication | Wording as in § 3 |

## Deviations from the design

1. **`pending_p` is the seed's own row, not a second insert.** `tests.seed()` already creates
   `pending_p` (`_isolation.psql:20,98`) with the same label: `pending`, `team_id` null, no
   `membership` row (`member_sync_membership` inserts one only when `team_id` is not null,
   `20261103120000_mir13_write_path_org_bound.sql:102-114`). A second `auth.users` insert under that
   label would collide on the primary key. The seed's row is exactly the row the confirmation trigger
   creates, so AC-5's first clause tests the same thing.
2. **A third fixture, `sys_c`**, for AC-4's second clause. That clause needs a system admin whose
   email gets confirmed, and that confirmation must not touch `sys_a`, which the later assertions
   use. It is made the same way as `sys_a`.
3. **The member-app build now loads a shared chunk.** This answers § 4.6's `TODO(verify)`. With two
   inputs, Rolldown moves the dependencies both entries share (React, supabase-js) into
   `assets/src-*.js`. `dist/index.html` now loads `main-*.js`, a `modulepreload` of that chunk, and
   the CSS. Measured: `system-signin-form` appears only in `assets/system-*.js`;
   `calechip-system-auth` appears in no member-app asset; and the member-app string `app-root`
   appears in neither the shared chunk nor the panel chunk. The member app's behaviour is unchanged
   (see the e2e results below).

## Delegated decisions

- **`FailureCode` for both refusals is `invalid_credentials`** (§ 4.4 asks for "whichever means a
  refused credential"). A wrong password and a wrong TOTP code are both refused credentials, and no
  other existing code fits. `types.ts` is not edited.
- **AC-4 clause 2 relies on the existing exception handler.** `member_refuse_system_admin` raises
  `42501` inside `admit_allow_listed_member()`. That function's `exception when others` turns the
  error into a `warning` and returns `new`, so the `auth.users` update succeeds and no member row is
  written. This is ADR-074 decision 2 as written, and the admission function is not changed.
- **§ 4.1 `TODO(verify)` on the `delete from public.member`.** No migration creates a `BEFORE` or
  `AFTER DELETE` trigger on `public.member`; grepping `supabase/migrations/` for delete triggers on
  it returns nothing. Every foreign key into `member` is `on delete restrict` or `set null`, and the
  seed's `pending_p` owns no row in any referencing table. Nothing refuses the delete, so the
  function was not widened.
- **§ 4.1 `TODO(verify)` on `service_role`'s privileges.** No migration revokes anything from
  `service_role` (grep for it across `supabase/migrations/` finds no grant or revoke). It therefore
  keeps Supabase's default `ALL` on `public` tables, which includes `DELETE` on `member`, and it
  bypasses RLS. **This could not be executed here**, because `pnpm db:test` needs Docker (see
  below). The function stays `security invoker`, as § 4.1 requires.

## Invariants

`invariants_touched: []`. No entry, count, team or membership rule is read or written. The only
write to an existing table is `grant_system_admin`'s delete of a `pending`, team-less member with no
`membership` row. Such a member is outside INV-04's denominator (`removed_at` is irrelevant: they are
in no team) and owns no entry, so no count moves.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | Includes RULE-02 and the § Language rule over `src/system/` and `src/lib/data/system.ts` |
| `pnpm test` | 0 | 50 files, 1008 tests |
| `pnpm exec vite build` | 0 | Emits `dist/system.html` and `dist/index.html`; see deviation 3 |
| `pnpm exec playwright test tests/e2e/mir-18-system-panel.spec.ts tests/e2e/smoke.spec.ts tests/e2e/tea-05-sign-in.spec.ts` | 0 | 20 passed: all 8 MIR-18 tests, plus the smoke test and TEA-05 sign-in |
| `pnpm exec playwright test` (full suite) | 1 | 456 passed, 21 skipped, 5 failed. See the next three rows |
| — `evt-10-description.spec.ts` AC-2–4, AC-7 | — | **Pre-existing.** It also fails with `vite.config.ts` reverted to `HEAD`, a run of 33 passed and 2 failed that contains only these two |
| — `tsk-02-overdue-prompt.spec.ts` AC-2, `uie-09-admin-hub.spec.ts` AC-4 | — | **Flaky.** TSK-02 AC-2 failed 1 in 3 with the base config too; UIE-09 AC-4 passed on re-run |
| — `tsk-01-tasks.spec.ts` AC-13–15 | — | **Intermittent, and not shown to be pre-existing.** With this change it failed 2 in 3 in one `--repeat-each=3` run and passed 4 in 4 in the next. With the base config it passed 3 in 3. The test drives `page.clock.setFixedTime`, and the change adds one preloaded chunk to the member app. A load-order effect cannot be ruled out from these runs; R5 should look at it |
| `pnpm db:test` | 1 | **Not executed**: `docker: command not found (podman also not found)`. The migration and `190-system-admin.test.sql` have **not** run against PostgreSQL here. CI's `database` job runs the same command |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-carry.mjs MIR-18` | 0 | PASS: 9 uncommitted paths, all carried by `allowed_paths` |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `system-panel-root` | `src/system/main.tsx:259` |
| `seam-banner` (`data-seam="mock"`) | `src/system/main.tsx:263` |
| `system-loading` | `src/system/main.tsx:136` |
| `system-signin-form`, `-email`, `-password`, `-submit`, `-error` | `src/system/main.tsx:142, 145, 155, 164, 168` |
| `system-not-authorised`, `system-not-authorised-back` | `src/system/main.tsx:176, 180` |
| `system-enrol`, `system-enrol-qr`, `system-enrol-secret` | `src/system/main.tsx:191, 200, 210` |
| `system-code-input`, `system-code-submit`, `system-code-error` | `src/system/main.tsx:42, 51, 55` (one `CodeForm`, used by set-up and by verify) |
| `system-verify` | `src/system/main.tsx:221` |
| `system-signed-in`, `system-signed-in-email` | `src/system/main.tsx:237, 240` |
| `system-signout` | `src/system/main.tsx:226` (verify), `:247` (signed in) |

## Open questions

1. **The pgTAP file and the migration are unexecuted.** That is the largest residual risk. The
   assertions most likely to need a correction on first run:
   - the `throws_ok … '23503'` for an unknown uuid;
   - the three DML refusals in AC-6 (`42501`, which is `permission denied for table`).
   CI's `database` job is the first execution.
2. **AC-15 is manual and not done.** Following MIR-10's pattern, it is recorded in
   `.ai/board/tickets/MIR-18/verification.md` by a person, against a real stack with TOTP enabled in
   the hosted dashboard (RULE-09). That file does not exist yet.
3. **TSK-01 AC-13–15 intermittency**. See the verification table above.
