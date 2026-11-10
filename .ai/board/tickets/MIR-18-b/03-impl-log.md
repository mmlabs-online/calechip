---
ticket: MIR-18-b
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-05T02:27:01Z
inputs_read:
  - .ai/board/tickets/MIR-18-b/01-plan.md
  - .ai/board/tickets/MIR-18-b/ticket.yaml
  - .ai/registry/decisions/ADR-075-a-system-admin-manages-orgs-through-three-aal2-gated-rpcs.md
  - .ai/standards/testing-standards.md
  - .ai/standards/rbac-and-security.md
  - .ai/board/tickets/MIR-18/03-impl-log.md
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261104150000_mir18_system_admin.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/190-system-admin.test.sql
  - src/lib/data/system.ts
  - src/system/main.tsx
  - tests/e2e/mir-18-system-panel.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-18-b — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261105120000_mir18b_org_management.sql` | created | The column and the three gated RPCs, transcribed from § 4.1 | § 4.1 |
| `supabase/tests/200-org-management.test.sql` | created | AC-1 to AC-8 in pgTAP, 64 assertions | § 4.2, § 4.6 |
| `supabase/tests/010-catalogue.test.sql` | modified | The definer census gains the three RPCs, so AC-12 of that file still passes | § 4.3 |
| `src/lib/data/system.ts` | modified | `OrgSummary`, `CreateOrgInput`, `UpdateOrgInput`, `OrgFailureCode`, `OrgResult`, the six messages, and `listOrgs`/`createOrg`/`updateOrg` in both implementations | § 4.4 |
| `src/system/main.tsx` | modified | The `signed-in` branch becomes `OrgManagement` (list, create form, edit form), and the card widens to `max-w-4xl` when signed in | § 4.5, § 2b |
| `tests/e2e/mir-18-b-org-management.spec.ts` | created | AC-9 to AC-14 against the mock build | § 4.6 |
| `.ai/standards/rbac-and-security.md` | modified | The one sentence § 3 gives, after the `system_admin` paragraph (line 29) | § 3 |
| `.ai/board/tickets/MIR-18-b/03-impl-log.md` | created | This file | gate |

`ADR-075` and `.ai/board/tickets/MIR-18-c/ticket.yaml` are in `allowed_paths` and were written and committed at PLAN (`70f51f4`). This stage did not touch them.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `licence_expires_at` | `supabase/migrations/20261105120000_mir18b_org_management.sql:35` | |
| 4.1 `list_orgs()` | same file `:42` | Word for word from the plan |
| 4.1 `create_org(text,text,text)` | same file `:74` | Word for word, with one comment added on the holiday insert |
| 4.1 `update_org(uuid,text,integer,integer,text,date)` | same file `:107` | Word for word |
| 4.1 grants | same file `:146-151` | Revoked from `public, anon`; granted to `authenticated` |
| 4.2 pgTAP | `supabase/tests/200-org-management.test.sql` | `sys_a` is `…00b1`; `tests.sys` and `tests.authenticate_at` copied from 190 |
| 4.3 census | `supabase/tests/010-catalogue.test.sql:60-63` | |
| 4.4 types and messages | `src/lib/data/system.ts:56-104` | `ORG_FAILURE_MESSAGES` is exported so the panel's own cap refusal shows the `invalid_org_field` text |
| 4.4 Supabase methods | `src/lib/data/system.ts:223-262`, mapping `:297` | `org_code_invalid` when the message names `org_code_shape` or `org_code_not_reserved` |
| 4.4 mock methods | `src/lib/data/system.ts:489-540`, fixtures `:367`, reserved list `:354` | Two orgs of § 2's panel table. Holidays are not modelled |
| 4.5 `OrgManagement` | `src/system/main.tsx:260` | Lists on arrival; reads the list again after each successful create or edit |
| 4.5 card width | `src/system/main.tsx:636` | |
| 4.6 e2e | `tests/e2e/mir-18-b-org-management.spec.ts` | `signInVerified(page)` is local to the file |

## Deviations from the design

1. **Both forms carry `noValidate`** (`src/system/main.tsx:88`, `:184`). With `type="number" min={1}`, the browser's own constraint check blocks the submission of `0` and `2.5`. No error element would render, and AC-13 could not pass. The inputs keep `type="number"` and `min=1` as § 2b specifies.
2. **The pgTAP file defines five helpers beyond the two § 4.2 names:** `tests.shared_org()`, `tests.snapshot()`, `tests.unchanged()`, and the tables `tests.created` and `tests.expected_order`. They are test-local fixtures. They exist because `public.org` cannot be read as `authenticated`, and because "refused" in § 2 includes "state as it was". `tests.unchanged()` compares the holiday row count and every `public.org` row's text against the last snapshot. All of it lives in `tests.*` and disappears with the `rollback`.

## Delegated decisions

- **The cap parse in § 4.5 contradicts itself.** It says a value that is "not an integer ≥ 1 after `Number(...)`" is refused in the panel, and then that "`0` is sent". Taken: **the panel refuses a value that is not an integer** (AC-13's `2.5`) **and sends every integer, `0` and negatives included**, so the database's refusal is exercised. This is the only reading under which both of AC-13's cases hold as written (`parseCap`, `src/system/main.tsx:48`).
- **The mock's check order** is shape/reserved, then duplicate, then name, then timezone. The database checks the timezone first. No AC submits two bad values at once, so the order is not observable in any test.
- **Mock ids for new orgs** are `…0000c002` upward. The fixtures are `…c000` (shared) and `…c001` (acme).
- **`ticket.yaml` is not edited here.** `/advance` writes `state` and `gates.*` (ADR-036).

## Invariants

`invariants_touched: []`.

| ID | Still holds because |
|----|---------------------|
| INV-04 | `create_org` copies holiday rows only into an org that it has just created. That org has no member and no team, so no count reads them. No entry, member, team or membership row is written. |
| (refusal 6, caps) | `max_members` and `max_teams` are stored and returned. No function, trigger or policy reads them (ADR-075 decision 6). |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 50 files, 1009 tests |
| `pnpm exec playwright test tests/e2e/mir-18-b-org-management.spec.ts tests/e2e/mir-18-system-panel.spec.ts` | 0 | 15 passed: the six MIR-18-b tests, MIR-18's eight unedited, and the seam guard |
| `pnpm exec playwright test` (full suite, `CI=1`) | 1 | 459 passed, 21 skipped (quarantine), 5 flaky (ADM-04 ×4, UIE-09 AC-4), 3 failed. See the next two rows |
| — `evt-10-description.spec.ts` AC-2–4, AC-7 | — | **Pre-existing.** MIR-18's log records the same two failing on its base config |
| — `evt-14-guest-sign-in.spec.ts` AC-9 | — | **Pre-existing.** It fails 2 in 3 under `--repeat-each=3` with these changes, and 2 in 3 with them stashed (on `HEAD` `70f51f4`). Neither spec loads `/system.html`, and AC-14 shows the member bundle does not carry the panel |
| `pnpm db:test` | — | **Not run**: `docker` is not installed, as in MIR-18. CI's `database` job is the real run |
| pgTAP on a throwaway local PostgreSQL 17 + pgTAP | — | **A stand-in, not Supabase.** The cluster was created with `initdb` in the session scratchpad. It had stub `anon`/`authenticated`/`service_role` roles, a stub `auth.users`, stub `auth.uid()`/`auth.jwt()` reading `request.jwt.claims`, and stub `net`, `vault` and `storage` schemas, with `extensions` on the search path. Every migration applied in order, including this one. **`200-org-management` 64/64 pass**; `190-system-admin` 37/37; `010-catalogue` passes, apart from its existing `todo` (F-1); `120` 92/92; `130` 9/9. Of the remaining files, `000-harness`, `160` (one storage error) and `170` (AC-20) fail, and they fail **identically on a second database built without this migration**, so they come from the stub or were already failing. The cluster was stopped afterwards |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-carry.mjs MIR-18-b` | 0 | PASS: 8 uncommitted paths, all carried |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `system-orgs`, `system-orgs-loading`, `system-orgs-error`, `system-orgs-retry` | `src/system/main.tsx:306, 300, 290, 293` |
| `system-org-row` (`data-org-code`) | `src/system/main.tsx:324` |
| `system-org-code`, `-name`, `-timezone`, `-max-members`, `-max-teams`, `-plan`, `-licence` | `src/system/main.tsx:325, 328, 331, 334, 335, 336, 339` |
| `system-org-shared`, `system-org-edit` | `src/system/main.tsx:343, 350` |
| `system-org-new` | `src/system/main.tsx:390` |
| `system-org-create-form`, `-code`, `-name`, `-timezone`, `-submit`, `-cancel`, `-error` | `src/system/main.tsx:85, 94, 106, 115, 122, 125, 129` |
| `system-org-edit-form`, `-code`, `-name`, `-max-members`, `-max-teams`, `-plan`, `-licence`, `-submit`, `-cancel`, `-error` | `src/system/main.tsx:181, 187, 193, 204, 215, 229, 238, 246, 249, 253` |
| `system-signed-in`, `system-signed-in-email`, `system-signout` | kept, inside `OrgManagement` |

## Open questions

1. **AC-15 is manual and not done.** It belongs in `.ai/board/tickets/MIR-18-b/verification.md`, recorded by a person against a real stack (RULE-09). That file does not exist yet.
2. **The pgTAP run above used a stub, not Supabase.** The likeliest real-stack differences are `is_system_admin()` reading the real `auth.jwt()` inside a definer call (the § 4.1 `TODO(verify)`) and PostgREST's error `message` text for 23514. The panel's `org_code_invalid` mapping depends on that text. On the stub, the gate refused at `aal1` and for `admin_t`, as AC-2, AC-5 and AC-7 require.
