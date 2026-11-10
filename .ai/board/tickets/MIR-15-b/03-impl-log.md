---
ticket: MIR-15-b
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-06T08:17:06Z
inputs_read:
  - .ai/board/tickets/MIR-15-b/01-plan.md
  - .ai/board/tickets/MIR-15-b/ticket.yaml
  - .ai/standards/testing-standards.md
  - supabase/migrations/20260905120000_adm02_holiday.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261105120000_mir18b_org_management.sql
  - supabase/migrations/20261105180000_mir15_org_public_team_bound.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/150-write-path-org-bound.test.sql
  - supabase/tests/200-org-management.test.sql
  - src/lib/data/system.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/system/main.tsx
  - tests/e2e/mir-18-b-org-management.spec.ts
  - tests/e2e/adm-02-holidays.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-15-b — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261106120000_mir15b_org_public_holidays.sql` | created | The read bound, the three narrowed member write policies, the four `aal2`-gated RPCs and their grants | § 4.1 |
| `supabase/tests/240-org-public-holidays.test.sql` | created | AC-1 to AC-13 in pgTAP, 54 assertions, plus the policy swap | § 4.2 |
| `supabase/tests/150-write-path-org-bound.test.sql` | modified | `admin_t` is an Org public admin and can no longer insert a holiday; the `lives_ok` and its follow-up become a 42501 refusal and a zero count. `plan(46)` unchanged | § 4.3 |
| `supabase/tests/010-catalogue.test.sql` | modified | The four new definer functions join the census | § 4.4 |
| `src/lib/data/system.ts` | modified | Four functions on `SystemSeam`, their types and messages, in both implementations; the mock's "does not model holidays" comment amended | § 4.5 |
| `src/system/main.tsx` | modified | `NationalHolidays`, `NationalHolidayForm` and `HolidayRow`, rendered below the Orgs section | § 4.6, § 2b |
| `tests/e2e/mir-15-b-national-holidays.spec.ts` | created | AC-14 to AC-20 against the mock build | § 4.7 |
| `.ai/board/tickets/MIR-15-b/03-impl-log.md` | created | This log | gate |

Not touched although in `allowed_paths`: the ADR-079 file and `MIR-15-e/ticket.yaml`. Both were written at PLAN and needed no change here.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 read bound | `20261106120000_mir15b_org_public_holidays.sql` § 1 | `holiday_select_all` dropped, `holiday_select_own_org` created |
| 4.1 member writes | same file § 2 | MIR-13 bodies, `and not public.org_is_shared(org_id)` added — in both `using` and `with check` on update |
| 4.1 four RPCs | same file § 3 | Each: plpgsql, `security definer`, `search_path = ''`, `is_system_admin()` first, Org public resolved by `is_shared_tenant`. `list_` is `stable`, the three writes `volatile` |
| 4.1 grants | same file § 4 | `revoke all … from public, anon`; `grant execute … to authenticated`, for all four signatures |
| 4.2 pgTAP | `supabase/tests/240-org-public-holidays.test.sql` | Sam is `b24…a1`; `tests.authenticate_at` and `tests.shared_org` copied from 200 |
| 4.3 changed pgTAP | `supabase/tests/150-write-path-org-bound.test.sql:169-176` | As § 4.3 |
| 4.4 census | `supabase/tests/010-catalogue.test.sql:68-72` | Enum argument spelled `public.holiday_kind` |
| 4.5 seam interface and types | `src/lib/data/system.ts:51-92` | `NationalHolidayInput`, `HolidayFailureCode`, `HolidayResult`, `HOLIDAY_FAILURE_MESSAGES` with § 4.5's exact strings |
| 4.5 Supabase impl | `src/lib/data/system.ts:308-366` | `.limit(HOLIDAY_LIMIT)` on the list RPC; SQLSTATE → code mapping in `holidayFailureCode` |
| 4.5 mock | `src/lib/data/system.ts:565-577`, `:680-725` | Seeded with copies of `FIXTURE_HOLIDAYS`, gated on `mockMaySeeOrgs()` |
| 4.6 screen | `src/system/main.tsx:262-620`, rendered at `:767` | Every test id of § 4.6's table, and § 4.6's copy |
| 4.7 e2e | `tests/e2e/mir-15-b-national-holidays.spec.ts` | One test per AC-14 to AC-20 |

## Deviations from the design

none

## Delegated decisions

1. **A list at `HOLIDAY_LIMIT` is refused as `network`, not `invalid_holiday`.** § 4.5 says both: the
   `HolidayFailureCode` comment puts it under `invalid_holiday`, the prose under it says *"refused as
   `network` — the truncation rule ADM-02 set for `listHolidays`"*. Took the prose: it names its source,
   and "A date and a name are required." would be a wrong sentence to show for a truncated list. The
   type comment in `system.ts` says `22023` only.
2. **An empty date is refused by the form, and nothing is sent** (`main.tsx`, `NationalHolidayForm`
   `submit`), with `A date and a name are required.` An empty string cannot be cast to `date`;
   sent, PostgREST would answer `22007`, which maps to `network` and would show "Could not reach the
   server". The same pattern as MIR-18-b's `parseCap`. The mock refuses an empty date the same way.
   The name is still sent as given, so the RPC's `22023` is what AC-20's blank-name case shows on the
   real stack.
3. **After an edit the current year is re-read, even when the edit moved the row to another year.**
   § 4.6 makes the year follow only an add.
4. **Changing year closes any open form and confirmation, and shows `Loading holidays…` until the new
   year arrives.** Keeping the previous year's rows on screen under the new year's label would be a
   wrong list. A read counter discards a response that arrives after a later year was asked for.
5. **`main.tsx` imports the `Holiday` and `HolidayKind` types from `@/lib/domain/types`.** Type-only,
   and not the member app: the file's header bars `App.tsx`, `components/`, `routes/`, `hooks/` and
   `@/lib/data`. `system.ts` already imports from the same module.
6. **`system.ts` imports `FIXTURE_HOLIDAYS` from `@/lib/fixtures`**, as § 4.5 requires. That puts the
   fixtures module in the panel's bundle on the Supabase build too; it was already in the member
   bundle, and it holds no secret.

## Invariants

`invariants_touched: []`. A holiday carries no member and no team, and none of INV-01 to INV-07 reads
it. The bridge-day derivation's input stays single-valued per date for every reader: the read is now
bounded to the caller's org, and `holiday_org_id_date_key` is one row per (org, date).

## Verification run

| command | exit | result |
|---|---|---|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 50 files, 1013 tests |
| `pnpm exec playwright test` on `mir-15-b-national-holidays`, `mir-18-b-org-management`, `mir-18-system-panel` | 0 | 22 passed |
| `pnpm db:test` (local Supabase stack, Docker) | 1 | 25 files, 1125 tests. **`240` 54/54, `150` 46/46, `010` pass.** The only failure is `170` #42 (`AC-20: admin_u does not select E`), the pre-existing one recorded in `MIR-21/03-impl-log.md:111` and `MIR-21-b/03-impl-log.md:108` |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-carry.mjs MIR-15-b` | 0 | PASS — nothing stray |

The full Playwright suite was not run. The member app's specs that assert an Org public admin writes
holidays run against the member mock, which this ticket does not change (MIR-15-e).

## Open questions

None that block.

- **The member app still offers add, edit and delete to an Org public admin, and the database now
  refuses each one** — on the real stack only; the member mock still allows it. Known, and MIR-15-e's
  (ADR-079 decision 5). It should ship before or with this migration reaching the hosted project.
- **Applying the migration to the hosted project is human (RULE-09).**
