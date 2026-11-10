---
ticket: MIR-15-b
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-06T08:32:49Z
inputs_read:
  - .ai/board/tickets/MIR-15-b/01-plan.md
  - .ai/board/tickets/MIR-15-b/03-impl-log.md
  - .ai/board/tickets/MIR-15-b/ticket.yaml
  - .ai/templates/review-report.md
  - supabase/migrations/20261106120000_mir15b_org_public_holidays.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261104150000_mir18_system_admin.sql
  - supabase/migrations/20261105180000_mir15_org_public_team_bound.sql
  - supabase/tests/240-org-public-holidays.test.sql
  - supabase/tests/150-write-path-org-bound.test.sql
  - supabase/tests/010-catalogue.test.sql
  - src/lib/data/system.ts
  - src/system/main.tsx
  - "git diff origin/main...HEAD"
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

# MIR-15-b — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-15-b, 13 changed file(s) … allowed-paths: PASS` (the four non-allowed paths are the ticket folder and `.ai/board/backlog.md`, ship-owned). `node scripts/check-carry.mjs MIR-15-b` → `0 uncommitted path(s) … PASS — nothing stray` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`) exit 0, repo-wide, no output |
| R4 | Nothing bypasses the seam (RULE-02) | PASS | `src/system/main.tsx:10-18` imports only `@/lib/data/system`, `:19` a type-only import from `@/lib/domain/types`; every holiday call goes through `systemSeam` (`main.tsx:293-294`, `:374`, `:410`). The only datastore client is in the panel seam itself, `src/lib/data/system.ts:14`, `:308-364` |
| R5 | Every § 4 contract item implemented | PASS | R5 detail below |
| R6 | Permission gating matches § 3 | PASS | Server-side: `20261106120000_mir15b_org_public_holidays.sql:89-91`, `:112-114`, `:135-137`, `:160-162` (`is_system_admin()` first, which requires `aal2`: `20261104150000_mir18_system_admin.sql:50-54`); Org public resolved in-function, never from the caller (`:92`, `:115`, `:138`, `:163`), so a dedicated row is `P0002` (`:147-151`, `:166-170`); member writes exclude the shared tenant (`:46`, `:55`, `:60`, `:69`); read bounded to own org (`:32-34`, with `member_org_id` approved-and-unremoved only, `20261103120000_mir13_write_path_org_bound.sql:33-39`); `anon` revoked (`:179-182`). Every row of § 3 asserted in `supabase/tests/240-org-public-holidays.test.sql:105-121` (reads), `:143-190` (direct writes), `:197-241` (door refusals, anon), `:256-268` (P0002). No other `holiday` select policy exists on the branch, so the replacement is not undercut by a permissive sibling |
| R7 | No invariant violated | PASS | `invariants_touched: []`; R7 detail below |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. `src/lib/data/system.ts:17` imports the in-repo `@/lib/fixtures`, as § 4.5 requires |

**Tests run by this review, not taken from the log.** `pnpm db:test`: 25 files, 1125 tests;
`240-org-public-holidays` ok (54), `150-write-path-org-bound` ok, `010-catalogue` ok. Exit 1 on one
failure only — `170-multi-team-decisions.test.sql` #42 *"AC-20: admin_u does not select E"*, which
reads `entry` and nothing this diff touches, and is recorded pre-existing at
`.ai/board/tickets/MIR-21/03-impl-log.md:111`. `pnpm test`: 50 files, 1013 passed.
`pnpm exec playwright test tests/e2e/mir-15-b-national-holidays.spec.ts`: 8 passed (AC-14 to AC-20
plus the seam guard).

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 drop `holiday_select_all`, create `holiday_select_own_org` | `supabase/migrations/20261106120000_mir15b_org_public_holidays.sql:30-34` | Yes |
| § 4.1 `holiday_insert_admin` + shared-tenant conjunct | same file `:40-47` | Yes |
| § 4.1 `holiday_update_admin`, conjunct in `using` and `with check` | same file `:49-61` | Yes |
| § 4.1 `holiday_delete_admin`, conjunct in `using` | same file `:63-70` | Yes |
| § 4.1 `list_national_holidays(date, date)` returns table (id, date, name, kind, created_at), stable, ascending, qualified columns | same file `:77-101` | Yes |
| § 4.1 `add_national_holiday(date, text, holiday_kind) returns uuid`, 22023 on blank, btrim, 23505 uncaught | same file `:104-126` | Yes |
| § 4.1 `update_national_holiday(uuid, date, text, holiday_kind) returns void`, 22023, P0002 | same file `:128-153` | Yes |
| § 4.1 `delete_national_holiday(uuid) returns void`, P0002 | same file `:155-172` | Yes |
| § 4.1 every function plpgsql, `security definer`, `search_path = ''`, 42501 first | same file `:85`, `:107`, `:131`, `:156`; checks `:89`, `:112`, `:135`, `:160` | Yes |
| § 4.1 grants: revoke from public, anon; execute to authenticated | same file `:179-186` | Yes |
| § 4.1 wrapped in `begin; … commit;` | same file `:24`, `:188` | Yes |
| § 4.2 pgTAP AC-1 to AC-13 + policy swap | `supabase/tests/240-org-public-holidays.test.sql:93-100` (swap), AC-11 `:105-112`, AC-12 `:117-121`, AC-10 `:126-138`, AC-1 `:143-153`, AC-2 `:158-168`, AC-3 `:173-190`, AC-8 `:195-241`, AC-7 `:246-251`, AC-9 `:256-268`, AC-6 `:273-282`, AC-4 `:287-297`, AC-13 `:302-313`, AC-5 `:318-333`; `plan(54)` `:21` | Yes |
| § 4.3 150's `lives_ok` → `throws_ok 42501`, follow-up → zero count, `plan(46)` unchanged | `supabase/tests/150-write-path-org-bound.test.sql:169-176` | Yes |
| § 4.4 census, four signatures, enum schema-qualified | `supabase/tests/010-catalogue.test.sql:68-72` | Yes |
| § 4.5 `SystemSeam` four functions | `src/lib/data/system.ts:51-58` | Yes |
| § 4.5 `NationalHolidayInput`, `HolidayFailureCode`, `HolidayResult`, `HOLIDAY_FAILURE_MESSAGES` (exact strings) | `src/lib/data/system.ts:65-88` | Yes |
| § 4.5 Supabase impl, `.limit(HOLIDAY_LIMIT)`, `>= HOLIDAY_LIMIT` refused as `network`, `created_at`→`createdAt`, SQLSTATE mapping | `src/lib/data/system.ts:308-364`, `:317`, `:373-375`, `:377-390` | Yes (the limit-as-`network` reading is the impl log's delegated decision 1; § 4.5's prose names it) |
| § 4.5 mock: seeded from `FIXTURE_HOLIDAYS`, gated on `mockMaySeeOrgs()`, refusals, comment amended | `src/lib/data/system.ts:565-575`, `:680-721`, `:477-478` | Yes |
| § 4.6 `NationalHolidays` after the Orgs section; `NationalHolidayForm`; year state; reload after write; year follows an add | `src/system/main.tsx:359-540`, `:267-355`, rendered `:767`; year follows add `:401` | Yes |
| § 4.6 test ids and copy | `src/system/main.tsx:262-265` (effect labels), `:446` (empty), `:591` (`alertdialog`), and throughout `:267-620` | Yes |
| § 4.7 e2e, one test per AC-14 to AC-20 | `tests/e2e/mir-15-b-national-holidays.spec.ts:98`, `:117`, `:136`, `:142`, `:158`, `:174`, `:197` | Yes |

## R7 detail

`invariants_touched` is `[]` (`.ai/board/tickets/MIR-15-b/ticket.yaml`, plan § 2). Reasoned
individually: no INV-01 to INV-07 reads `public.holiday` — the diff changes only holiday policies and
four functions that read and write `public.holiday` alone
(`supabase/migrations/20261106120000_mir15b_org_public_holidays.sql:30-172`); no entry, member,
team, membership or event row is written. The one derived consumer, the bridge-day derivation, needs
one row per date per reader, which the read bound now gives: `holiday_select_own_org`
(`:32-34`) restricts a reader to one org, and `holiday_org_id_date_key` is unique per (org, date) —
asserted at `supabase/tests/240-org-public-holidays.test.sql:105-112` and `:273-282`.

| Invariant | Held by | Citation |
|---|---|---|
| — (none touched) | n/a | `supabase/migrations/20261106120000_mir15b_org_public_holidays.sql:30-172` touches only `public.holiday` |

## Findings

None.

## Verdict

PASS.
