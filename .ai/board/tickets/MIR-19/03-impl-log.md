---
ticket: MIR-19
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-11T13:20:00Z
inputs_read: [ .ai/board/tickets/MIR-19/01-plan.md, .ai/board/tickets/MIR-19/ticket.yaml, src/App.tsx, src/hooks/useSession.ts, src/lib/data/index.ts, src/lib/data/supabase.ts, src/lib/data/mock.ts, supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql, supabase/migrations/20261103120000_mir13_write_path_org_bound.sql, supabase/tests/010-catalogue.test.sql, supabase/tests/_isolation.psql, tests/route-role-guards.test.ts ]
consulted:
  - with: tech-lead-design
    asked: "010-catalogue.test.sql's census of security definer functions fails on the new own_org_code(); the file is outside allowed_paths. Add the file and one census line? (written to 99-questions.md; no answer yet)"
    answer: "pending"
    resulted_in_amendment: false
chat_before_verdict: none
gate: BLOCKED
blocking_reason: "Plan defect: supabase/tests/010-catalogue.test.sql (AC-12 census of public security definer functions) must list public.own_org_code(), and the file is not in allowed_paths (RULE-03). Without the one-line edit the pgTAP suite is red. Everything else in plan section 4 is implemented; typecheck, lint, unit tests and build exit 0."
next_state: IN_PROGRESS
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261111150000_mir19_own_org_code.sql` | created | `own_org_code()` and `tasks` joins `org_code_not_reserved`, guarded and idempotent | § 4.1 |
| `supabase/tests/370-own-org-code.test.sql` | created | pgTAP for AC-12 and the database half of AC-13 | § 4.6 |
| `src/lib/org-path.ts` | created | `isOrgCode`, `splitOrgPath`, `orgPath`, `routerBase`, the reserved list copy | § 4.2 |
| `src/lib/data/index.ts` | modified | `getOwnOrgCode()` on `DataSeam` | § 4.3 |
| `src/lib/data/supabase.ts` | modified | `rpc("own_org_code")`, throws on transport error | § 4.3 |
| `src/lib/data/mock.ts` | modified | `getOwnOrgCode()` over `mockOrgOf`, with the two code constants | § 4.3 |
| `src/hooks/useSession.ts` | modified | `orgCode` read in the same `resolve()` pass, only for an approved member | § 4.4 |
| `src/App.tsx` | modified | basename state and crossings, `EnterOrg`, `LeaveOrg`, `OrgNotFound`, `shellRoutes` written once and placed in both tables | § 4.5 |
| `tests/org-path.test.ts` | created | AC-13 client half, AC-14, helper examples, migration-array equality | § 4.6 |
| `tests/e2e/mir-19-org-routing.spec.ts` | created | one test per AC-1 to AC-11 | § 4.6 |
| `.ai/board/tickets/MIR-19/99-questions.md` | created | the question above | RULE-15 |

ADR-097 and `.ai/board/tickets/MIR-19-b/ticket.yaml` were written at PLAN and are unchanged here.

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | the migration | the 50 MIR-11 tokens verbatim, then `tasks`; constraint name unchanged |
| 4.2 | `src/lib/org-path.ts` | `isOrgCode` also checks length 2..32 explicitly |
| 4.3 | the three seam files | same name and arity in both implementations |
| 4.4 | `src/hooks/useSession.ts` | a throw falls into the existing catch (signed-out) |
| 4.5 | `src/App.tsx` | `<BrowserRouter key={base} basename={base}>`; popstate listener; `cross()` replaces history; `OrgNotFound` button pushes |
| 4.6 | the three test files | see Verification |

## Deviations from the design

- **`LeaveOrg` takes a `kind` prop** (`through`, `sign-in`, `root`) rather than being a single
  `cross`-only component, so one component serves the three crossings § 4.5 names. Behaviour is as
  specified.
- **AC-10 e2e covers `not-on-a-team` only.** The mock has no seeded credential for a pending member
  (`moi@example.com` has no `FIXTURE_CREDENTIALS` row). Pending takes the same arm
  (`membership.state !== "member"`).
- **`LeaveOrg` for a signed-out caller builds `orgPath(base, pathname) + search`** so `/shared` gives
  `next=%2Fshared`, not `%2Fshared%2F`.

## Invariants

`invariants_touched: []`. This ticket routes, writes no entry and computes no count.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 57 files, 1109 tests, includes `tests/org-path.test.ts` and `tests/route-role-guards.test.ts` |
| `pnpm build` | 0 | |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| pgTAP `370-own-org-code.test.sql` | not run | no PostgreSQL in this environment |
| Playwright `mir-19-org-routing.spec.ts` | not run | browsers cannot be installed here (`playwright install chromium` fails); the spec is typechecked and linted only |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `org-not-found` | `src/App.tsx` (`OrgNotFound`) |
| `org-not-found-home` | `src/App.tsx` (`OrgNotFound`) |

## Open questions

The `010-catalogue.test.sql` census line, above. Unrun suites (pgTAP, Playwright) are for CI or the
reviewer's environment.
