---
ticket: MIR-18
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-05T01:02:31Z
inputs_read:
  - .ai/board/tickets/MIR-18/01-plan.md
  - .ai/board/tickets/MIR-18/03-impl-log.md
  - .ai/board/tickets/MIR-18/ticket.yaml
  - .ai/board/tickets/MIR-18-b/ticket.yaml
  - .ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md
  - .ai/registry/glossary.md
  - .ai/registry/invariants.md
  - .ai/standards/rbac-and-security.md
  - supabase/migrations/20261104150000_mir18_system_admin.sql
  - supabase/tests/190-system-admin.test.sql
  - supabase/config.toml
  - vite.config.ts
  - system.html
  - src/system/main.tsx
  - src/lib/data/system.ts
  - tests/e2e/mir-18-system-panel.spec.ts
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

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | **Committed:** `git diff --name-only origin/main...HEAD` minus the ticket folder, the three ship-owned paths and the ticket's own promoting idea file is a subset of `allowed_paths` — `node scripts/check-allowed-paths.mjs` exits 0 (ADR-041, ADR-054). **Uncommitted:** `node scripts/check-carry.mjs <ID>` exits 0 (ADR-043) | PASS | `.ai/board/tickets/MIR-18/ticket.yaml:16-28`, `.ai/board/tickets/MIR-18/01-plan.md:569-582`; `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-18, 16 changed file(s)` / `allowed-paths: PASS` (exit 0); `node scripts/check-carry.mjs MIR-18` → `check-carry: ticket MIR-18, 0 uncommitted path(s)` / `check-carry: PASS — nothing stray` (exit 0) |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm typecheck` (`tsc --noEmit`) exited 0 with no diagnostics |
| R3 | lint exit 0 on the changed lintable files (ADR-041) | PASS | `pnpm lint` (`eslint .`) exited 0 with no diagnostics across the repository (including `src/lib/data/system.ts`, `src/system/main.tsx`, `vite.config.ts`, `tests/e2e/mir-18-system-panel.spec.ts`) |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/lib/data/system.ts:14` is inside `src/lib/data/` and constructs its own client lazily at `src/lib/data/system.ts:59-65`; `src/system/main.tsx:8-16` imports only `react`, `react-dom/client`, `@/lib/data/system` and `../index.css` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `supabase/migrations/20261104150000_mir18_system_admin.sql:26-132`, `supabase/tests/190-system-admin.test.sql:14-168`, `supabase/config.toml:304-308`, `src/lib/data/system.ts:18-247`, `system.html:1-13`, `src/system/main.tsx:25-288`, `vite.config.ts:109-116`, `tests/e2e/mir-18-system-panel.spec.ts:1-129`, `.ai/standards/rbac-and-security.md:25-29,226-228` (`pnpm test` exited 0: 50 files, 1008 tests; `pnpm exec playwright test tests/e2e/mir-18-system-panel.spec.ts` exited 0: 9 passed) |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20261104150000_mir18_system_admin.sql:36-43` (RLS enabled, `revoke all ... from public, anon, authenticated`, `grant select ... to authenticated`, policy `system_admin_select_self` using `id = (select auth.uid())`), `:50-58` (`is_system_admin()` requires `aal = 'aal2'` and row in `public.system_admin`, revoked from `public, anon`, granted to `authenticated`), `:64-95` (`system_admin_refuse_member` and `member_refuse_system_admin` `before insert` triggers raising `42501`, both revoked from `public, anon, authenticated`), `:106-130` (`grant_system_admin(uuid)` deletes only `pending`, team-less member with no `membership` row, raises `42501` otherwise, revoked from `public, anon, authenticated`, granted to `service_role`); `.ai/standards/rbac-and-security.md:25-29,226-228` |
| R7 | No invariant violated (RULE-07) | PASS | `.ai/board/tickets/MIR-18/ticket.yaml:15` (`invariants_touched: []`); `supabase/migrations/20261104150000_mir18_system_admin.sql:113-125` (per-invariant check in `## R7 detail`) |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 Migration `supabase/migrations/20261104150000_mir18_system_admin.sql` (`begin; ... commit;`, idempotent, header cites ADR-074 decisions 1–5; table `public.system_admin`, RLS, grants, policy `system_admin_select_self`) | `supabase/migrations/20261104150000_mir18_system_admin.sql:4-17,26,32-43,132` | Yes — exact schema `(id uuid primary key references auth.users (id) on delete cascade, created_at timestamptz not null default now())`, RLS, grants and policy |
| § 4.1 `public.is_system_admin() returns boolean` (`language sql stable security invoker set search_path = ''`, `aal2` + `exists` check, grants) | `supabase/migrations/20261104150000_mir18_system_admin.sql:50-58` | Yes — verbatim SQL body and `revoke all ... from public, anon` / `grant execute ... to authenticated` |
| § 4.1 Disjointness trigger functions `public.system_admin_refuse_member()` and `public.member_refuse_system_admin()`, `BEFORE INSERT FOR EACH ROW` triggers, revokes | `supabase/migrations/20261104150000_mir18_system_admin.sql:64-95` | Yes — exact function bodies raising `42501`, `revoke all ... from public, anon, authenticated`, and `before insert` triggers on `public.system_admin` and `public.member` |
| § 4.1 `public.grant_system_admin(p_user_id uuid) returns void` (`language plpgsql security invoker set search_path = ''`, idempotent return, pending/team-less/membership-less delete, `42501` refusal, grants) | `supabase/migrations/20261104150000_mir18_system_admin.sql:106-130` | Yes — verbatim SQL body, `revoke all ... from public, anon, authenticated`, `grant execute ... to service_role` |
| § 4.2 pgTAP `supabase/tests/190-system-admin.test.sql` (`\ir _isolation.psql`, `plan(37)`, `tests.seed()`, local `aal` helper, AC-1 to AC-6 assertions, `rollback`) | `supabase/tests/190-system-admin.test.sql:14-168` | Yes — local `tests.authenticate_at(uuid, text)` at `:30-37` (`_isolation.psql` untouched), labelled assertions for AC-1 (`:50-67`), AC-2 (`:72-82`), AC-3 (`:87-97`), AC-4 (`:102-112`), AC-5 (`:117-143`), AC-6 (`:148-164`) |
| § 4.3 `supabase/config.toml` `[auth.mfa.totp]` `enroll_enabled = true` and `verify_enabled = true` | `supabase/config.toml:304-308` | Yes — only `[auth.mfa.totp]` modified |
| § 4.4 `src/lib/data/system.ts` (`SystemGate`, `TotpEnrolment`, `SystemSeam`, `systemSeamName`, `systemSeam`, lazy client with `storageKey: "calechip-system-auth"`, Supabase + mock implementations) | `src/lib/data/system.ts:18-43,59-155,161-247` | Yes — exact types and method signatures (`:18-43`), lazy client (`:59-65`), `supabaseGate` order (`:67-99`), `signIn` / `startEnrolment` / `verifyCode` / `signOut` (`:104-155`), mock implementation with § 2 fixtures (`:161-240`), and exports (`:245-247`) |
| § 4.5 `system.html` with `<meta name="robots" content="noindex, nofollow" />` and `/src/system/main.tsx` script | `system.html:1-13` | Yes — character-for-character match with `01-plan.md:479-491` |
| § 4.5 `src/system/main.tsx` (isolated imports, 6 screens driven by `SystemGate`, all § 4.5 `data-testid` attributes, `startEnrolment()` error handling, mock `seam-banner`) | `src/system/main.tsx:8-19,40-61,73-84,133-279` | Yes — all 17 test ids present (`system-panel-root` `:259`, `seam-banner` `:263`, `system-loading` `:136`, `system-signin-form`/`-email`/`-password`/`-submit`/`-error` `:142-168`, `system-not-authorised`/`-back` `:176-180`, `system-enrol`/`-qr`/`-secret` `:191-210`, `system-code-input`/`-submit`/`-error` `:42-55`, `system-verify` `:221`, `system-signed-in`/`-email` `:237-240`, `system-signout` `:226,247`) |
| § 4.6 `vite.config.ts` `build.rolldownOptions.input` with `main` and `system` | `vite.config.ts:109-116` | Yes — matches `01-plan.md:520-527` |
| § 4.7 E2E spec `tests/e2e/mir-18-system-panel.spec.ts` covering AC-7 to AC-14 | `tests/e2e/mir-18-system-panel.spec.ts:34-129` | Yes — AC-7 (`:34-40`), AC-8 (`:42-46`), AC-9 (`:48-53`), AC-10 (`:55-63`), AC-11 (`:65-84`), AC-12 (`:86-97`), AC-13 (`:99-110`), AC-14 (`:113-129`); all 9 tests pass |
| § 3 `.ai/standards/rbac-and-security.md` additions under `## Roles` and `## Authentication` | `.ai/standards/rbac-and-security.md:25-29,226-228` | Yes — matches wording in `01-plan.md:276-282` |
| § 6 / § 7 ADR-074, glossary `System admin` row, and `.ai/board/tickets/MIR-18-b/ticket.yaml` | `.ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md:1-115`, `.ai/registry/glossary.md:66`, `.ai/board/tickets/MIR-18-b/ticket.yaml:1-71` | Yes |

## R7 detail

`invariants_touched: []` (`.ai/board/tickets/MIR-18/ticket.yaml:15`). Verified independently against `.ai/registry/invariants.md:31-39`:

- No `public.entry` table, trigger, policy, or absence calculation (`src/lib/data/absence.ts`) is read or modified (`INV-01`, `INV-02`, `INV-03`, `INV-05`, `INV-06` untouched).
- The only write to an existing table is `public.grant_system_admin(uuid)` deleting a `public.member` row only when `m.status = 'pending' and m.team_id is null and not exists (select 1 from public.membership ms where ms.member_id = m.id)` (`supabase/migrations/20261104150000_mir18_system_admin.sql:113-121`), which is never on any team and owns no entry, so neither `INV-04` nor `INV-07` can be affected.

| Invariant | Held by | Citation |
|---|---|---|
| none (`invariants_touched: []`) | `grant_system_admin(uuid)` only deletes `pending`, team-less `public.member` rows with no `public.membership` row; no entry, team, membership or absence-count code is touched | `.ai/board/tickets/MIR-18/ticket.yaml:15`, `supabase/migrations/20261104150000_mir18_system_admin.sql:113-125` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS` — all eight checks R1 through R8 pass. The ticket advances to `DONE`.
