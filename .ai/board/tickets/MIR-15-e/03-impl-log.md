---
ticket: MIR-15-e
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-06T16:36:32Z
inputs_read:
  - .ai/board/tickets/MIR-15-e/01-plan.md
  - .ai/board/tickets/MIR-15-e/ticket.yaml
  - .ai/standards/testing-standards.md
  - supabase/migrations/20261106120000_mir15b_org_public_holidays.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261105120000_mir18b_org_management.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/fixtures.ts
  - src/routes/Holidays.tsx
  - src/App.tsx
  - tests/holiday-writes.test.ts
  - tests/seam-parity.test.ts
  - tests/e2e/adm-02-holidays.spec.ts
  - tests/e2e/adm-03-holiday-writes.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
  - tests/e2e/mir-14-b-worklist-teams.spec.ts
  - docs/ops/e2e-quarantine.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/data/index.ts` | modified | Added `isOwnOrgShared(): Promise<boolean>` to `DataSeam`, directly after `deleteHoliday` | §4.1 |
| `src/lib/data/supabase.ts` | modified | Implemented `isOwnOrgShared`; widened the three holiday refusal sentences to name Org public's exception; rewrote the stale `holiday_select_all`/`using (true)` comment on `listHolidays` | §4.2 |
| `src/lib/data/mock.ts` | modified | Added `MockOrg`, `DEDICATED_ORG_STORAGE_KEY`, `readDedicatedOrgMemberIds`, `dedicatedOrgMemberIds`, `__setDedicatedOrgMembersForTest`, `mockOrgOf`; reshaped the `holiday` table to `{ org, row }[]`, seeded with a dedicated-org copy; rewrote `listHolidays`/`addHoliday`/`updateHoliday`/`deleteHoliday` to scope by org; added `isOwnOrgShared`; widened the refusal sentences; rewrote the stale comments | §4.3 |
| `src/routes/Holidays.tsx` | modified | Added the `no-org` phase and `OrgShared` type; `load` now resolves `no-org` and `orgShared` before reading; `mayWrite` gates on `orgShared === "no"`; added `holidays-set-by-system` and `holidays-no-org` markup; rewrote the file header comment | §4.4 |
| `src/App.tsx` | modified | Rewrote the route comment at the Holidays route to describe `holiday_select_own_org` and the no-org case rather than `holiday_select_all` | §4.5 |
| `tests/holiday-writes.test.ts` | modified | Moved the dedicated-org/`restore` hooks to file level so every existing test runs as Quan-D; changed `stored()` to pin its reader to `FIXTURE_ADMIN` (load-bearing once reads are org-scoped); changed `seededIds` to `seededDates` (the dedicated org's seeded rows carry fresh ids); added a `MIR-15-e` describe block, one `it` per AC-7 to AC-12 | §4.6 |
| `tests/e2e/adm-02-holidays.spec.ts` | modified | Renamed the former AC-7 ("a signed-in caller who is on no team still reads the calendar") to `MIR-15-e AC-5` and rewrote its body and surrounding comments for the opposite behaviour | §4.6 |
| `tests/e2e/adm-03-holiday-writes.spec.ts` | modified | Added `placeAdminInDedicatedOrg`; every existing test now runs as Quan-D via the describe-level `beforeEach`; added a `MIR-15-e` describe block with `AC-1`, `AC-2`, `AC-3`, `AC-4` and `AC-6` | §4.6 |
| `tests/e2e/cal-08-holiday-shading.spec.ts` | modified | Added `placeAdminInDedicatedOrg`; called it before the two tests that call `addHoliday` (`:374` and `:536` after the edit), so the admin who adds is Quan-D | §4.6 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 `isOwnOrgShared` on `DataSeam` | `src/lib/data/index.ts:1087-1093` | Doc comment transcribed verbatim from the plan |
| §4.2 supabase `isOwnOrgShared` | `src/lib/data/supabase.ts:3033-3045` | `member_org_id` then `org_is_shared`, throws on either RPC error |
| §4.2 refusal sentences | `src/lib/data/supabase.ts:1430-1443` | Exact strings from §4.2, split across lines for width only |
| §4.2 stale comment rewrite | `src/lib/data/supabase.ts:2881-2886` | Cites `holiday_select_own_org` and ADR-079 decision 3 |
| §4.3 `MockOrg` | `src/lib/data/mock.ts:538-541` | Internal, not exported |
| §4.3 `DEDICATED_ORG_STORAGE_KEY` | `src/lib/data/mock.ts:543-546` | `"calechip.mock.dedicatedOrgMembers"`, exact key from the plan |
| §4.3 `dedicatedOrgMemberIds` | `src/lib/data/mock.ts:548-566` | Read once at module load via `readDedicatedOrgMemberIds`, mirroring `SESSION_STORAGE_KEY`'s pattern |
| §4.3 `mockOrgOf` | `src/lib/data/mock.ts:579-583` | `member_org_id` reproduced: null unless approved and not removed |
| §4.3 `holidays` table reshape | `src/lib/data/mock.ts:591-608` | Org public under original fixture ids, dedicated org under fresh `newHolidayId()` ids |
| §4.3 `__setDedicatedOrgMembersForTest` | `src/lib/data/mock.ts:568-573` | Named export beside `seam`, untouched by `tests/seam-parity.test.ts` |
| §4.3 `listHolidays` | `src/lib/data/mock.ts:2936-2977` | `[]` for a caller `mockOrgOf` cannot place; scoped by org otherwise |
| §4.3 `addHoliday`/`updateHoliday`/`deleteHoliday` | `src/lib/data/mock.ts:3017-3096` | Each requires `currentAdmin()` AND `mockOrgOf(me.id) === "dedicated"`; lookups and the date-taken check scoped to the caller's own org |
| §4.3 mock `isOwnOrgShared` | `src/lib/data/mock.ts:3097-3103` | `mockOrgOf(currentMemberId) === "org_public"` |
| §4.4 `View`/`OrgShared` | `src/routes/Holidays.tsx:101-114` | `no-org` phase added; `OrgShared` is `"yes" \| "no" \| "unknown"` |
| §4.4 `load` | `src/routes/Holidays.tsx:136-192` (approx.) | Member-read-failed flag added; no-org short-circuit before `listHolidays`; `orgShared` resolved only for an admin |
| §4.4 `mayWrite` | `src/routes/Holidays.tsx:266-275` | Adds `orgShared === "no"` |
| §4.4 markup | `src/routes/Holidays.tsx:249-261` (`holidays-no-org`), `:353-358` (`holidays-set-by-system`) | Copy transcribed verbatim from §4.4's table |
| §4.5 App.tsx comment | `src/App.tsx:540-548` | Replaces the sentence named in the plan |
| §4.6 tests | see Files touched | One `it`/`test` per AC named in the plan, plus the existing-test adaptations the org scoping requires |

## Deviations from the design

1. **`tests/holiday-writes.test.ts`: `stored()` is pinned to read as `FIXTURE_ADMIN`, and `seededIds` became `seededDates`.** Not named in the plan's contract, which only specified the `beforeEach`/`afterEach` dedicated-org switch. Necessary consequence of §4.3's org-scoped `listHolidays`: several existing tests capture a `before` snapshot, switch `__setCurrentMember` to a different role to attempt a refused write, and then compare `stored()` against `before` — once `listHolidays` depends on the *current* caller's org, an unpinned `stored()` would read a different org (or `[]`) at that second call and the comparison would be comparing two different things rather than "unchanged". Pinning the reader to `FIXTURE_ADMIN` (who is Quan-D for the duration of every test, by the file-level hook) keeps every existing `before`/`after` assertion meaningful. `seededIds` had to become `seededDates` for the same root cause: the dedicated org's seeded rows are copies under fresh ids from `newHolidayId()` (§4.3), so the original fixture ids never appear in Quan-D's table and `restore()` would otherwise delete the seeded rows themselves on the first cleanup.
2. **The dedicated-org `beforeEach`/`afterEach` pair in `tests/holiday-writes.test.ts` is file-level, not inside the `ADM-03` describe block.** Needed so the new `MIR-15-e` describe block also defaults to Quan-D (its own tests override per-case where the criterion needs Quan to stay Org public's admin).
3. **`tests/e2e/adm-03-holiday-writes.spec.ts`: the `MIR-15-e` describe block carries no shared `beforeEach` that navigates.** `DEDICATED_ORG_STORAGE_KEY` is read once at module load, so `placeAdminInDedicatedOrg` must run before the *first* `page.goto`; a shared `beforeEach` that navigated first (the pattern the `ADM-03` describe block above it uses) would make `AC-3`'s and `AC-6`'s own call to it arrive one document load too late. A `startSignedOut` helper replaces the two lines that `beforeEach` used to own, called by each test in whichever order its own criterion needs.
4. **`tests/e2e/adm-03-holiday-writes.spec.ts`, `MIR-15-e AC-4`, reaches `/holidays/2026` by address rather than through `openCalendar`/`reachHolidays`.** Discovered by running the suite: `reachHolidays` falls back to `shell-admin-link` when neither the sidebar's `home-holidays-link` nor an admin tab is present, and for a member calling this test that control does not exist either — because `home-holidays-link` is currently removed from the sidebar for every role (BUG-003, `docs/ops/e2e-quarantine.md:36-37`, the same already-quarantined regression `adm-03-holiday-writes.spec.ts`'s own `AC-14` and `AC-18` are `test.fixme` over). The click then hangs for the full test timeout. `docs/ops/e2e-quarantine.md` is not in this ticket's `allowed_paths`, so a new row could not be added there even if this were a new quarantine; it is not one — AC-4's own wording in §2 ("When he opens `/holidays/2026`") is already an address, and reaching it by address exercises the same screen without depending on the sidebar link BUG-003 already affects. No `test.fixme` was needed because the test passes this way.

All other behaviour matches §§1–8 as written.

## Invariants

| ID | Still holds because |
|----|---------------------|
| (none — `invariants_touched: []`) | A holiday carries no member and no team (`src/lib/domain/types.ts:711-717`); nothing in this ticket's diff adds a member or team reference to a holiday row, in either seam implementation. The entry-side invariants (INV-01 to INV-07) read entries and busy days, neither of which this ticket's diff touches. No entry-creation, decision, or counting path was edited. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `node scripts/check-allowed-paths.mjs` | 0 | `allowed-paths: PASS`, 9 changed files, all in `allowed_paths` |
| `node scripts/check-carry.mjs MIR-15-e` | 0 | `check-carry: PASS — nothing stray` |
| `pnpm exec tsc --noEmit` | 0 | no output |
| `pnpm exec eslint .` | 0 | no output |
| `pnpm exec vitest run` | 0 | 50 files, 1019 tests, all pass |
| `pnpm exec playwright test` | 1 | 478 passed, 21 skipped (quarantined, unrelated), 1 failed — `tests/e2e/evt-02-attendance.spec.ts` AC-28, registered as flaky in `.ai/standards/testing-standards.md` (unrelated file, untouched by this ticket). The three touched spec files were also run in isolation, twice, with 0 failures each time. |
| `git diff --name-only` subset of `allowed_paths` | yes | confirmed by `check-allowed-paths.mjs` and `check-carry.mjs` above |

## Testability contract

No `02-design.md`/testability contract exists for this ticket (ADR-019 merged SPEC and DESIGN into PLAN). The selectors below are from `01-plan.md` §4.4.

| selector | Exists at |
|----------|-----------|
| `holidays-set-by-system` | `src/routes/Holidays.tsx:356` |
| `holidays-no-org` | `src/routes/Holidays.tsx:255` |

## Open questions

None. `01-plan.md` §2 *Open questions* records none that block, and nothing arose during implementation that was not already covered by the plan or resolved as a Deviation above.
