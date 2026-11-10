---
ticket: MIR-15-e
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-06T09:39:00Z
inputs_read:
  - .ai/board/tickets/MIR-15-e/01-plan.md
  - .ai/board/tickets/MIR-15-e/03-impl-log.md
  - .ai/board/tickets/MIR-15-e/ticket.yaml
  - .ai/templates/review-report.md
  - git diff origin/main...HEAD
  - eslint.config.js
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261105180000_mir15_org_public_team_bound.sql
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
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-15-e, 13 changed file(s)` … `allowed-paths: PASS` (exit 0). The 13 are the 9 paths of `ticket.yaml:18-27`, three files of the ticket folder, and `.ai/board/backlog.md` (ship-owned). `node scripts/check-carry.mjs MIR-15-e` → `0 uncommitted path(s)` / `check-carry: PASS — nothing stray` (exit 0) |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` → `tsc --noEmit`, no diagnostics, exit 0. `pnpm test` was also run: `Test Files 50 passed (50)`, `Tests 1019 passed (1019)`, exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` → `eslint .`, whole repo, no output, exit 0 |
| R4 | Nothing outside the seam reaches the datastore | PASS | `src/routes/Holidays.tsx:46` imports only `seam` from `@/lib/data`. The new reads are `seam.isOwnOrgShared()` at `src/routes/Holidays.tsx:183`, and the RPC calls stay inside the seam at `src/lib/data/supabase.ts:3033-3045`. The RULE-02 lint rule at `eslint.config.js:61-77` passes (R3) |
| R5 | Every §4 contract item implemented | PASS | see R5 detail |
| R6 | Permission gating matches §3 | PASS | Screen gate `src/routes/Holidays.tsx:274-275` = `me !== null && me.removedAt === null && me.role === "admin" && orgShared === "no"` (§3 last para, §4.4). Org-shared read only for an admin, with a throw giving `"unknown"`: `src/routes/Holidays.tsx:181-189`. No-org short-circuit for pending/removed/no member row: `src/routes/Holidays.tsx:170-172`. Mock writes need `currentAdmin()` ∧ `mockOrgOf === "dedicated"`: `src/lib/data/mock.ts:3024`, `:3059`, `:3088`. Lookups are limited to the caller's own org: `mock.ts:3061`, `:3090`. Mock read gives `[]` for no org: `mock.ts:2960-2961`. `mockOrgOf` returns null unless the member is approved and not removed: `mock.ts:579-583` |
| R7 | No invariant violated | PASS | `ticket.yaml:17` `invariants_touched: []`. See R7 detail |
| R8 | No dependency without an ADR | PASS | `git diff origin/main...HEAD --stat` lists 13 files, and neither `package.json` nor `pnpm-lock.yaml` is among them. The only new import in `src/` is the existing module `@/lib/data/mock` (`tests/holiday-writes.test.ts:33`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 `DataSeam.isOwnOrgShared(): Promise<boolean>` after `deleteHoliday`, doc comment | `src/lib/data/index.ts:1086-1093` | Yes, comment verbatim |
| §4.2 supabase `isOwnOrgShared`: `member_org_id(p_uid)` then `org_is_shared(p_org_id)`, throws on either error | `src/lib/data/supabase.ts:3033-3045`. RPC parameter names match `20261103120000_mir13_write_path_org_bound.sql:33` and `20261105180000_mir15_org_public_team_bound.sql:33` | Yes, body verbatim |
| §4.2 three refusal sentences | `src/lib/data/supabase.ts:1442-1447` | Yes, strings exact |
| §4.2 `listHolidays` comment rewritten to `holiday_select_own_org` / ADR-079 d3 | `src/lib/data/supabase.ts:2892-2896` | Yes; the body is unchanged |
| §4.3 `MockOrg` (internal) | `src/lib/data/mock.ts:541` | Yes |
| §4.3 `DEDICATED_ORG_STORAGE_KEY = "calechip.mock.dedicatedOrgMembers"`, read once at load | `src/lib/data/mock.ts:546`, `:548-561`, `:566`, through `sessionStore()` = `localStorage` (`mock.ts:267-273`) | Yes |
| §4.3 `__setDedicatedOrgMembersForTest(memberIds: string[]): void` | `src/lib/data/mock.ts:571-573` | Yes; a named export, not on `seam` |
| §4.3 `mockOrgOf` | `src/lib/data/mock.ts:579-583` | Yes |
| §4.3 `holidays: { org; row }[]`: Org public rows keep the fixture ids, the dedicated copy gets `newHolidayId()` | `src/lib/data/mock.ts:602-608` | Yes |
| §4.3 refusal sentences repeated verbatim | `src/lib/data/mock.ts:617-622` | Yes |
| §4.3 `listHolidays` limited to the caller's org, `[]` for null | `src/lib/data/mock.ts:2959-2968` | Yes |
| §4.3 `addHoliday`: caller rule, date-taken checked within the org, row stored under the org | `src/lib/data/mock.ts:3022-3042` | Yes |
| §4.3 `updateHoliday` / `deleteHoliday`: caller rule, lookup within own org, a miss is `not_permitted`, date-taken within the org | `src/lib/data/mock.ts:3057-3076`, `:3086-3095` | Yes |
| §4.3 mock `isOwnOrgShared` | `src/lib/data/mock.ts:3102-3104` | Yes |
| §4.3 stale comments rewritten | `src/lib/data/mock.ts:539-600` (table), `:2936-2944` (`listHolidays`) | Yes |
| §4.4 `View` gains `no-org`; `ready` gains `orgShared`; `OrgShared` type | `src/routes/Holidays.tsx:105-114` | Yes |
| §4.4 `load` steps 1–4 | `src/routes/Holidays.tsx:155-197`: the member read records a failure flag (`:156-162`), `no-org` (`:170-172`), `orgShared` (`:181-189`), `listHolidays` (`:196-197`) | Yes |
| §4.4 `mayWrite` | `src/routes/Holidays.tsx:274-275` | Yes |
| §4.4 `holidays-set-by-system`, rendered when `me?.role === "admin" && orgShared === "yes"`, `text-sm opacity-70`, under the header | `src/routes/Holidays.tsx:353-359` | Yes. The copy renders `Org public&rsquo;s`. That is the repository's JSX rendering of an apostrophe (13 uses across 8 files in `src/`), and no standard requires a straight quote |
| §4.4 `holidays-no-org`, the same card, no `role="alert"` | `src/routes/Holidays.tsx:252-261` | Yes, copy exact |
| §4.4 file header rewritten | `src/routes/Holidays.tsx:5-11`, `:21-25` | Yes |
| §4.5 App.tsx comment only | `src/App.tsx:541-548` | Yes; the route is unchanged |
| §4.6 `holiday-writes.test.ts`: Quan-D hooks, one `it` per AC-7…AC-12 | Hooks at `tests/holiday-writes.test.ts:101-108` (moved to file level, deviation 2). The ACs are at `:416`, `:445`, `:494`, `:522`, `:541`, `:554` | Yes. Deviation 1 (`stored()` always reads as `FIXTURE_ADMIN`, `seededDates`) follows directly from §4.3 limiting reads to the caller's org, and weakens no assertion |
| §4.6 `adm-03` existing tests as Quan-D; new AC-1, -2, -3, -4, -6 | `tests/e2e/adm-03-holiday-writes.spec.ts:109` (describe `beforeEach`). The new tests are at `:457`, `:467`, `:477`, `:505`, `:528`, and AC-6 uses the route-rewrite with an exactly-once check at `:533-548` | Yes. AC-4 reaches the screen by address (deviation 4), which matches the wording of AC-4 |
| §4.6 `adm-02` AC-7 becomes MIR-15-e AC-5 | `tests/e2e/adm-02-holidays.spec.ts:214-229` asserts `holidays-no-org` visible, and zero rows, year and beyond-calendar | Yes |
| §4.6 `cal-08` two `addHoliday` tests as Quan-D | `tests/e2e/cal-08-holiday-shading.spec.ts:377`, `:537` | Yes |

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml:17`, `01-plan.md:158`). There is no ID to reason through one at a time. The empty set itself was checked against the diff:

| Invariant | Held by | Citation |
|---|---|---|
| (none listed) | The diff touches only holiday rows, the new org-shared read and their tests. No entry-creation, decision, counting, overlap or busy-day path appears in `git diff origin/main...HEAD`. The 13 files are listed under R1, and the `src/` changes are limited to the holiday block of `mock.ts:536-622` / `:2936-3104`, the holiday and refusal blocks of `supabase.ts:1436-1447` / `:2892-2896` / `:3028-3045`, `Holidays.tsx`, one seam signature, and an `App.tsx` comment. No entry invariant is read or written by any changed line | `src/lib/data/mock.ts:3022-3104`; `src/lib/data/supabase.ts:3033-3045`; `src/routes/Holidays.tsx:155-197` |

The controls this screen hides are not invariants. They are still enforced below the interface, in the SQL write policies (MIR-15-b) and in the mock's caller checks at `mock.ts:3024`, `:3059`, `:3088`. The UI affordance is not what holds them.

## Findings

None.

## Verdict

PASS.
