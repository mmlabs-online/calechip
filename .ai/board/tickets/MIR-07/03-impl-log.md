---
ticket: MIR-07
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-23T09:48:45+07:00
inputs_read:
  - .ai/board/tickets/MIR-07/01-plan.md
  - .ai/board/tickets/MIR-07/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/board/tickets/MIR-06/03-impl-log.md
  - .ai/board/tickets/CAL-11/01-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - supabase/tests/_isolation.psql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/060-removed-and-pending.test.sql
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260901120000_tea04_member_writes.sql
  - supabase/migrations/20260910093000_solo_profile_self_update.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - supabase/migrations/20260912100000_solo_manager_role.sql
  - supabase/migrations/20261020120000_mir02_member_self_writes.sql
  - src/lib/data/mock.ts
  - src/lib/data/index.ts
  - src/lib/roles.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/lib/avatars.ts
  - tests/signup-confirmation.test.ts
  - tests/cross-team-reads.test.ts
  - tests/cross-team-role.test.ts
  - tests/entry-decision.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-07 — implementation log

**Every contract item in plan § 4 is built. Both halves of the parity suite pass against the same
case table: vitest 79 tests against the mock, pgTAP 144 assertions against real SQL.** The unit suite
went from 908 to 987 passing, with no pre-existing test edited except AC-7's rename and the two AC-8
comments.

**`pnpm db:test` was not run** — no Docker on this machine, the same position as MIR-06. The pgTAP
file was run instead on the scratch rig MIR-06 describes (`MIR-06/03-impl-log.md` § *Verification
run*): Homebrew PostgreSQL 17.11, pgTAP 1.3.3, a bootstrap standing in for the Supabase image, all 45
migrations applied in order, every test file run with pg_prove's psql flags. Not committed. **The
reviewer or the operator should run `pnpm db:test` once on a machine with Docker before merge.**

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/data/mock.ts` | modified | `currentAdmin` and `memberTeamId` lacked SQL's `status = 'approved'`; `updateOwnProfile` silently ignored keys SQL refuses; the parity suite needs two test-only exports | § 4.1 `adminOf`/`currentAdmin`, `memberTeamId`, `OWN_PROFILE_KEYS`, `__putMemberForTest`, `__permissionDecisions`, the two comments |
| `src/lib/roles.ts` | modified | `mayDecideEntriesOf` lacked `public.may_decide`'s status clause | § 4.1 `roles.ts` |
| `supabase/tests/100-mock-parity.test.sql` | created | the one copy of the case table, and its assertions against SQL | § 4.2, § 4.3; AC-4, AC-5, AC-6 |
| `tests/mock-sql-parity.test.ts` | created | the same case table asserted against the mock, plus the seam-level AC-1 to AC-3 tests | § 4.4; AC-1 to AC-6 |
| `tests/signup-confirmation.test.ts` | modified | the test's name claimed a refusal neither side implements | AC-7 |
| `tests/cross-team-reads.test.ts` | modified | header said the SQL refusal was exercised by no test; MIR-06 now exercises it | AC-8 |
| `tests/cross-team-role.test.ts` | modified | same, for `set_member_role` / `promote_member_to_admin` | AC-8 |
| `.ai/board/tickets/MIR-07/03-impl-log.md` | created | this log | gate |

`ticket.yaml` is not touched: `state` and `gates.*` are written by `/advance` from this file's
front-matter (ADR-036), as MIR-06's IN_PROGRESS checkpoint did.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| `adminOf` / `currentAdmin` = `is_admin` | `src/lib/data/mock.ts:408-412` | three conjuncts; comment above it gains a dated MIR-07 paragraph |
| `memberTeamId` = `member_team_id` | `src/lib/data/mock.ts:1311-1313` | `status === "approved"` added; dated comment above |
| `eventIsAdmin` comment | `src/lib/data/mock.ts:721` | one dated line appended; function unchanged |
| `updateOwnProfile` own-row key set | `src/lib/data/mock.ts:1885-1888` | after the `me`/removed check, before every other check; same code and sentence as the removed refusal |
| `__putMemberForTest` | `src/lib/data/mock.ts:340` | insert or replace by id; stores a copy |
| `__permissionDecisions` | `src/lib/data/mock.ts:349` | `isAdmin`, `memberTeamId`, `mayDecide` exactly as § 4.1 names them |
| `mayDecideEntriesOf` status clause | `src/lib/roles.ts:51` | first conjunct; doc comment names `may_decide`'s clause |
| case table, one file, two markers | `supabase/tests/100-mock-parity.test.sql:19-97` | 36 + 36 rows, every expected value literal |
| pgTAP plan and assertions | `supabase/tests/100-mock-parity.test.sql:100`, `:205-221` | `plan(144)` = 36 × 3 + 36 |
| `tests.parity_own_update` | `supabase/tests/100-mock-parity.test.sql:151-199` | see *Deviations* item 3 for the `TODO(verify)` |
| vitest reads the SQL file, asserts shape | `tests/mock-sql-parity.test.ts:40-76`, `:139-180` | marker count 2; 36/36 rows; full cross product; no duplicate (subject, column) or id |
| AC-1, AC-2, AC-3 seam tests | `tests/mock-sql-parity.test.ts` § *AC-1 to AC-3* | pending admin; teammate with status `rejected`; pending manager's `approveEntry` |

No field name was introduced that § 4 does not name. `OWN_PROFILE_KEYS`, `adminOf`, the two
exports and their return fields are all § 4.1's.

## Deviations from the design

1. **§ 4.2's counts are wrong; its rule is followed.** § 4.2 says *"`allowed` exactly for
   `display_name` and `avatar` on every subject except `removed` (8 rows); `refused` for the other
   28."* Five subjects × two columns is **10** allowed and **26** refused. The table follows the
   rule, not the count: `pending` and `rejected` may write their own name and avatar in SQL, because
   `member_update_own` is `id = auth.uid() and removed_at is null` with no status clause
   (`solo_profile_self_update.sql:66-69`), and § 1 *Out of scope* says that policy is not touched.
   The rig confirms 10 `allowed` (U-01, 02, 07, 08, 13, 14, 19, 20, 25, 26). No consultation —
   the plan's own rule decides it.
2. **AC-8, `tests/cross-team-reads.test.ts`: the added line does not say MIR-06 exercises AC-12.**
   The original sentence is about CAL-11 AC-12, whose "refusals" are the completeness throws in
   `supabase.ts` — TypeScript, which no pgTAP file runs. The dated MIR-07 line names the SQL files
   that now exercise the three definer reads' own refusals (`020-entry-reads`, `030-member-reads`,
   `070-definer-callers`) and says AC-12's throws are still untested. Saying otherwise would replace
   one false comment with another.
3. **§ 4.3 `TODO(verify)` resolved: the in-function form works.** `tests.authenticate_as` inside
   `tests.parity_own_update` applies to the dynamic `update` executed after it in the same function.
   The 36 cases were not unrolled.
4. **§ 4.2 `TODO(verify)` resolved:** `"2.png"` is in `AVATAR_CHOICES` under vitest; a test asserts
   it, so a folder change that removes it fails as that and not as a permission disagreement.
5. **The comments above `currentAdmin` and `eventIsAdmin` are corrected by a dated appended line, not
   rewritten** — "Additive only" in `CLAUDE.md`. The ADM-01/ADM-03 comments further down that say
   `currentAdmin()` "already filters `removedAt === null` and `role === "admin"`" are still true and
   were left.

## Invariants

`invariants_touched: []`.

| ID | Still holds because |
|----|---------------------|
| INV-01 to INV-07 | each is about entries, portions or absence counts; this ticket changes only who the mock treats as admin, on-team or decider, and which `member` columns an own-row write may name. No entry is created, moved or counted differently for an **approved** member — and only approved members reach the screens. `approvedMemberIds` (`mock.ts:982-984`) is built on `memberTeamId` and now also drops a non-approved row with a `teamId`; no seeded fixture is such a row (`FIXTURE_PENDING_SIGNUP` has no team), so no seeded count changes, and SQL's `member_team_id` already drops it |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 49 files, 987 passed (baseline before any change: 48 files, 908 passed) |
| `pnpm exec vitest run tests/mock-sql-parity.test.ts` | 0 | 79 passed |
| mutation, mock side | — | each of the four clauses removed in turn: `adminOf` status → 5 fail; `memberTeamId` status → 7 fail; `mayDecideEntriesOf` status → 8 fail; `OWN_PROFILE_KEYS` check → 20 fail. Files restored after each |
| `pnpm db:test` | not run | no Docker on this machine |
| scratch rig, all eleven SQL test files | 0 | `100-mock-parity`: `1..144`, 144 `ok`, 0 `not ok`. The ten MIR-06 files unchanged: only their three known `# TODO` findings (F-1, F-2, F-3) |
| mutation, SQL side | — | a copy with P-29 `is_admin`, U-19 and U-21 `expected` flipped failed exactly those three; copy deleted |
| `node scripts/check-docs.mjs` | 0 | 0 errors |
| `git status --porcelain` ⊆ `allowed_paths` | yes | seven paths plus this file |

## Testability contract

No selector: this ticket has no screen (01-plan.md § 2b).

## Open questions

None blocking. Two for the reviewer to judge rather than rediscover:

- **AC-9 found nothing.** No pre-existing test relied on the looser mock; the 908 passed unedited.
- **Per-function inline checks were not audited** (01-plan.md § 1, *Out of scope*). Several seam
  functions — `approveEntry`, `rejectEntry`, `updateOwnProfile` itself — look up `me` with only
  `removedAt === null` and lean on `memberTeamId` or `mayDecideEntriesOf` for the rest, so they now
  inherit the status clause through those. Any that bypass all three shared predicates were not
  searched for.
