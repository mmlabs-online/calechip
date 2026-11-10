---
ticket: MIR-18-b
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-05T05:04:30Z
inputs_read:
  - .ai/board/tickets/MIR-18-b/01-plan.md
  - .ai/board/tickets/MIR-18-b/03-impl-log.md
  - .ai/board/tickets/MIR-18-b/ticket.yaml
  - .ai/board/tickets/MIR-18-c/ticket.yaml
  - .ai/registry/decisions/ADR-075-a-system-admin-manages-orgs-through-three-aal2-gated-rpcs.md
  - .ai/registry/invariants.md
  - .ai/standards/rbac-and-security.md
  - supabase/migrations/20261105120000_mir18b_org_management.sql
  - supabase/tests/200-org-management.test.sql
  - supabase/tests/010-catalogue.test.sql
  - src/lib/data/system.ts
  - src/system/main.tsx
  - tests/e2e/mir-18-b-org-management.spec.ts
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
| R1 | **Committed:** `git diff --name-only origin/main...HEAD` minus the ticket folder, the three ship-owned paths and the ticket's own promoting idea file is a subset of `allowed_paths` — `node scripts/check-allowed-paths.mjs` exits 0 (ADR-041, ADR-054). **Uncommitted:** `node scripts/check-carry.mjs <ID>` exits 0 (ADR-043) | PASS | `.ai/board/tickets/MIR-18-b/ticket.yaml:20-29`, `.ai/board/tickets/MIR-18-b/01-plan.md:585-594`; `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-18-b, 13 changed file(s)` / `allowed-paths: PASS` (exit 0); `node scripts/check-carry.mjs MIR-18-b` → `check-carry: ticket MIR-18-b, 0 uncommitted path(s)` / `check-carry: PASS — nothing stray` (exit 0) |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm typecheck` (`tsc --noEmit`) exited 0 with no diagnostics |
| R3 | lint exit 0 on the changed lintable files (ADR-041) | PASS | `pnpm lint` (`eslint .`) exited 0 with no diagnostics across the repository (including `src/lib/data/system.ts`, `src/system/main.tsx`, `tests/e2e/mir-18-b-org-management.spec.ts`) |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/lib/data/system.ts:14` is inside `src/lib/data/`, constructs its client lazily at `src/lib/data/system.ts:126-132`, and performs all RPC calls inside `src/lib/data/system.ts:223-263`; `src/system/main.tsx:8-18` imports only `react`, `react-dom/client`, `@/lib/data/system` and `../index.css` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `supabase/migrations/20261105120000_mir18b_org_management.sql:29-153`, `supabase/tests/200-org-management.test.sql:18-320`, `supabase/tests/010-catalogue.test.sql:60-63`, `src/lib/data/system.ts:44-110,223-317,352-434,489-537`, `src/system/main.tsx:28-407,620,636`, `tests/e2e/mir-18-b-org-management.spec.ts:16-185`, `.ai/standards/rbac-and-security.md:29-33` (`pnpm test` exited 0: 50 files, 1009 tests; `pnpm exec playwright test tests/e2e/mir-18-b-org-management.spec.ts tests/e2e/mir-18-system-panel.spec.ts` exited 0: 15 passed) |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20261105120000_mir18b_org_management.sql:57-59` (`list_orgs()` refuses with `42501` unless `public.is_system_admin()`), `:80-82` (`create_org` same gate, copies holidays inside the definer function `:93-97`), `:119-128` (`update_org` same gate, refuses `v_org.is_shared_tenant` with `42501` `:126-128`, takes no `org_code` or `timezone`), `:146-151` (`revoke all ... from public, anon` and `grant execute ... to authenticated` on all three RPCs; `public.org` table privileges untouched); `.ai/standards/rbac-and-security.md:29-33` |
| R7 | No invariant violated (RULE-07) | PASS | `.ai/board/tickets/MIR-18-b/ticket.yaml:19` (`invariants_touched: []`); `supabase/migrations/20261105120000_mir18b_org_management.sql:87-97,130-137` (per-invariant check in `## R7 detail`) |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 Migration `supabase/migrations/20261105120000_mir18b_org_management.sql` (`begin; ... commit;`, idempotent, header cites ADR-075 decisions 1–7, `alter table public.org add column if not exists licence_expires_at timestamptz null`) | `supabase/migrations/20261105120000_mir18b_org_management.sql:1-35,153` | Yes — exact DDL and header citing ADR-075 decisions 1 to 7 |
| § 4.1 `public.list_orgs()` (`returns table (...)`, `language plpgsql stable security definer set search_path = ''`, `is_system_admin()` `42501` check, `order by o.is_shared_tenant desc, o.org_code asc`) | `supabase/migrations/20261105120000_mir18b_org_management.sql:42-68` | Yes — verbatim SQL body and return table signature |
| § 4.1 `public.create_org(p_org_code text, p_name text, p_timezone text) returns uuid` (`language plpgsql volatile security definer set search_path = ''`, `is_system_admin()` `42501`, `pg_timezone_names` `22023`, `btrim(p_name)` insert, holiday copy from `is_shared_tenant`) | `supabase/migrations/20261105120000_mir18b_org_management.sql:74-101` | Yes — verbatim SQL body |
| § 4.1 `public.update_org(p_org_id uuid, p_name text, p_max_members integer, p_max_teams integer, p_plan text, p_licence_expires_on date) returns void` (`language plpgsql volatile security definer set search_path = ''`, `is_system_admin()` `42501`, `P0002` not found, `is_shared_tenant` `42501`, update body) | `supabase/migrations/20261105120000_mir18b_org_management.sql:107-139` | Yes — verbatim SQL body |
| § 4.1 Grants (`revoke all on function ... from public, anon` and `grant execute ... to authenticated` for all three RPCs) | `supabase/migrations/20261105120000_mir18b_org_management.sql:146-151` | Yes — exact grants |
| § 4.2 pgTAP `supabase/tests/200-org-management.test.sql` (`\ir _isolation.psql`, `plan(64)`, `tests.seed()`, local `tests.sys` and `tests.authenticate_at`, fixtures, AC-1 to AC-8 labelled assertions, `rollback`) | `supabase/tests/200-org-management.test.sql:18-320` | Yes — local helpers at `:25-40`, fixtures `:69-77`, AC-1 (`:92-101`), AC-2 (`:106-126`), AC-3 (`:133-157`), AC-4 (`:162-179`), AC-5 (`:184-215`), AC-6 (`:220-237`), AC-7 (`:242-289`), AC-8 (`:294-317`) |
| § 4.3 Census `supabase/tests/010-catalogue.test.sql` adds `public.list_orgs()`, `public.create_org(text,text,text)`, `public.update_org(uuid,text,integer,integer,text,date)` | `supabase/tests/010-catalogue.test.sql:60-63` | Yes — exact three entries added to the `set_eq` array |
| § 4.4 `src/lib/data/system.ts` (`OrgSummary`, `CreateOrgInput`, `UpdateOrgInput`, `OrgFailureCode`, `OrgResult`, 6 refusal messages, `listOrgs` / `createOrg` / `updateOrg` in Supabase and mock seams) | `src/lib/data/system.ts:44-48,56-110,223-317,352-434,489-537` | Yes — exact interfaces, method signatures, refusal messages (`:98-106`), SQLSTATE mapping (`:297-317`), and mock checks/fixtures (`:352-434,489-537`) |
| § 4.5 `src/system/main.tsx` (`OrgManagement` replacing `signed-in` branch, `max-w-4xl` when signed in, re-reads `listOrgs()` after create/edit, all required `data-testid` attributes, cap validation) | `src/system/main.tsx:36-407,620,636` | Yes — all 26 test ids present (`system-orgs` `:306`, `-loading` `:300`, `-error` `:290`, `-retry` `:293`, `system-org-row` with `data-org-code` `:324`, `-code`/`-name`/`-timezone`/`-max-members`/`-max-teams`/`-plan`/`-licence` `:325-339`, `-shared` `:343`, `-edit` `:350`, `system-org-new` `:390`, `system-org-create-form`/`-code`/`-name`/`-timezone`/`-submit`/`-cancel`/`-error` `:85-129`, `system-org-edit-form`/`-code`/`-name`/`-max-members`/`-max-teams`/`-plan`/`-licence`/`-submit`/`-cancel`/`-error` `:181-253`, plus `system-signed-in`/`-email`/`system-signout` `:368-379`) |
| § 4.6 E2E `tests/e2e/mir-18-b-org-management.spec.ts` covering AC-9 to AC-14 with local `signInVerified(page)` | `tests/e2e/mir-18-b-org-management.spec.ts:16-185` | Yes — `signInVerified` (`:16-24`), AC-9 (`:51-69`), AC-10 (`:71-88`), AC-11 (`:90-110`), AC-12 (`:112-134`), AC-13 (`:136-166`), AC-14 (`:169-185`); all pass |
| § 3 `.ai/standards/rbac-and-security.md` sentence added after `system_admin` paragraph under `## Roles` | `.ai/standards/rbac-and-security.md:29-33` | Yes — exact wording from `01-plan.md:280-285` |
| § 6 / § 7 ADR-075 and `.ai/board/tickets/MIR-18-c/ticket.yaml` | `.ai/registry/decisions/ADR-075-a-system-admin-manages-orgs-through-three-aal2-gated-rpcs.md:1-93`, `.ai/board/tickets/MIR-18-c/ticket.yaml:1-52` | Yes |

## R7 detail

`invariants_touched: []` (`.ai/board/tickets/MIR-18-b/ticket.yaml:19`). Verified independently against `.ai/registry/invariants.md:31-39`:

- No `public.entry`, `public.member`, `public.team`, or `public.membership` table, trigger, policy, or absence calculation (`src/lib/data/absence.ts`) is read or modified (`INV-01`, `INV-02`, `INV-03`, `INV-05`, `INV-06`, `INV-07` untouched).
- `public.create_org` copies `public.holiday` rows from Org public only into the newly inserted `public.org` row (`supabase/migrations/20261105120000_mir18b_org_management.sql:87-97`), which has no teams and no members, so `INV-04`'s absence count for existing teams is unaffected.
- `max_members` and `max_teams` are stored and returned by `update_org` and `list_orgs` without enforcement (`supabase/migrations/20261105120000_mir18b_org_management.sql:60,132-133`), so charter refusal 6 is untouched.

| Invariant | Held by | Citation |
|---|---|---|
| none (`invariants_touched: []`) | `create_org` writes `public.org` and copies `public.holiday` rows only into the newly created org (which has no teams or members); `update_org` updates only `public.org` metadata; no entry, member, team, membership or absence-count logic is touched | `.ai/board/tickets/MIR-18-b/ticket.yaml:19`, `supabase/migrations/20261105120000_mir18b_org_management.sql:87-97,130-137` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS` — all eight checks R1 through R8 pass. The ticket advances to `DONE`.
