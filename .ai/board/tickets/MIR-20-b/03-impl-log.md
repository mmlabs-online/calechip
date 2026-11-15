---
ticket: MIR-20-b
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-12T08:36:00Z
inputs_read: [ .ai/board/tickets/MIR-20-b/01-plan.md, .ai/board/tickets/MIR-20-b/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-20-b — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261112210000_mir20b_impersonation_log_read.sql` | created | the one definer read, `public.list_impersonation_log()`, with its grants | § 4.1 |
| `supabase/tests/400-impersonation-log.test.sql` | created | pgTAP for AC-6 to AC-14 (29 assertions, `plan(29)`) | § 4.5, AC-6..AC-14 |
| `supabase/tests/010-catalogue.test.sql` | modified | the definer census gains `public.list_impersonation_log()` | § 4.5, AC-14 |
| `src/lib/data/index.ts` | modified | `IMPERSONATION_LOG_LIMIT`, `ImpersonationLogEntry`, `DataSeam.listImpersonationLog` | § 4.2 |
| `src/lib/data/supabase.ts` | modified | `ImpersonationLogRow`, mapper, `listImpersonationLog()` over the RPC | § 4.2 |
| `src/lib/data/mock.ts` | modified | seeded three-session log and `listImpersonationLog()` reproducing the function | § 4.3 |
| `src/components/ImpersonationLog.tsx` | created | the *Support access* section (loading, error, empty, table, truncated) | § 4.4 |
| `src/routes/MemberList.tsx` | modified | renders the section after the roster when `mayDecide(me.role)` | § 4.4 |
| `tests/impersonation-log.test.ts` | created | Vitest for AC-5 against the mock | § 4.5, AC-5 |
| `tests/e2e/mir-20-b-impersonation-log.spec.ts` | created | Playwright for AC-1 to AC-4 | § 4.5, AC-1..AC-4 |

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | migration file | Predicate and column list as written; the effective end is `coalesce(i.ended_at, case when i.expires_at <= now() then i.expires_at end)` |
| 4.2 | `src/lib/data/index.ts` (interface and constant), `supabase.ts`, `mock.ts` | Same method name and arity in both implementations; `seam-parity` passes unedited |
| 4.3 | `src/lib/data/mock.ts`, `seedImpersonationLog` and `listImpersonationLog` | Seed ids `ab000000-0000-4000-8000-00000000000{1,2,3}` |
| 4.4 | `src/components/ImpersonationLog.tsx`, `src/routes/MemberList.tsx` | Every `data-testid` of the § 4.4 table exists |
| 4.5 | the three test files above | |

## Deviations from the design

none.

## Invariants

`invariants_touched` is `[]`. The function reads `impersonation`, `impersonation_action` and, for the
caller only, `member` and `membership`; no entry, absence count, approval or portion is read or
written, so INV-04 and INV-07 are not touched.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `node scripts/check-allowed-paths.mjs` | 0 | PASS, 10 paths allowed |
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 63 files, 1227 tests |
| `pnpm exec playwright test tests/e2e/mir-20-b-impersonation-log.spec.ts` | 0 | 4 specs + seam guard |

**Not run: the pgTAP files.** No PostgreSQL is available in this environment (`pg_isready`: no
response), so `400-impersonation-log.test.sql` and the edited census in `010-catalogue.test.sql` were
written against the schema and `390-impersonation.test.sql`'s conventions but never executed. The
assertion count was checked by counting `select is/ok/results_eq/throws_ok/lives_ok` lines (29).
Applying the migration and running them is a person's step (RULE-09). Things most likely to need a
touch on a first run: the `member` and `membership` inserts for `pleft` and `prem` (raw inserts,
bypassing `tests.put_on_team`), and `move_team_to_org` accepting the P1 movers in AC-13.

## Testability contract

All ids are in `src/components/ImpersonationLog.tsx`: `impersonation-log`, `-loading`, `-error`,
`-retry`, `-empty`, `-table`, `-row` (with `data-impersonation-id`), `-started`, `-actor`, `-scope`,
`-reason`, `-ended`, `-reads`, `-truncated`.

## Open questions

none.
