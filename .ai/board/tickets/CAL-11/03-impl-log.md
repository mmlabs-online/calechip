---
ticket: CAL-11
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-23T00:16:38+0700
inputs_read:
  - .ai/board/tickets/CAL-11/01-plan.md
  - .ai/board/tickets/CAL-11/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/architecture.md
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/data/absence.ts
  - src/lib/fixtures.ts
  - tests/seam-parity.test.ts
  - tests/manager-role.test.ts
  - tests/draft-entry.test.ts
  - node_modules/.pnpm/@supabase+postgrest-js@2.112.4/node_modules/@supabase/postgrest-js/dist/index.d.cts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260922150000_cal11_cross_team_reads.sql` | created | the three `security definer` read functions and their six privilege statements, verbatim to plan section 4.1 | §4.1 |
| `src/lib/data/index.ts` | modified | added the three `DataSeam` declarations (`listMembersForTeam`, `listTeamEntriesForTeam`, `listTeamEntriesOverlappingForTeam`), placed after `listAllMembers` per plan | §4.2 |
| `src/lib/data/supabase.ts` | modified | added the three real implementations, each an `.rpc()` call matching its migration function, following the own-team twins' column list, order and truncation/completeness refusals | §4.3 |
| `src/lib/data/mock.ts` | modified | added the three mock implementations reproducing each SQL function body, `is_admin`/`currentAdmin()` tested first | §4.4 |
| `tests/cross-team-reads.test.ts` | created | new unit test file asserting AC-1 through AC-9 (AC-10–AC-12 held by the existing suite, unedited, per plan section 4.5) | §4.5 |

No other file was touched. `.ai/board/backlog.md` shows modified in `git status` but was not touched in this stage — it was already dirty when this session started (PLAN's output).

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 migration | `supabase/migrations/20260922150000_cal11_cross_team_reads.sql:1-71` | transcribed verbatim from plan section 4.1; `begin;`/`commit;`, `create or replace`, idempotent, no `order by` in the functions |
| §4.2 seam interface | `src/lib/data/index.ts:696-732` | three declarations, arity 1, 1, 2; parameter names `teamId`, `range` as specified; docblocks transcribed from the plan |
| §4.3 Supabase implementation | `src/lib/data/supabase.ts:1510-1626` (`listMembersForTeam` at 1520, `listTeamEntriesForTeam` at 1543, `listTeamEntriesOverlappingForTeam` at 1569) | each maps rows with the existing `toMember`/`toEntry` and the existing `MEMBER_COLUMNS`/`ENTRY_COLUMNS`; the overlapping read reuses the exact page-and-assemble loop and refusal messages `listTeamEntriesOverlapping` uses, with the request replaced by the named RPC call and no `.filter("date_range", …)` |
| §4.4 mock implementation | `src/lib/data/mock.ts:1525-1629` (`listMembersForTeam` at 1535, `listTeamEntriesForTeam` at 1558, `listTeamEntriesOverlappingForTeam` at 1585) | each reproduces its SQL function body, `currentAdmin()` first; `listMembersForTeam` filters `m.teamId === teamId` directly (the SQL compares the row's own `team_id`, not through `member_team_id`); the two entry reads use `sameTeam(memberTeamId(e.memberId), teamId)`, matching `entry_select_team`'s left side |
| §4.5 tests | `tests/cross-team-reads.test.ts` | AC-1 (`:36-55`), AC-2 (`:57-67`), AC-3 (`:69-81`), AC-4 (`:83-98`), AC-5 (`:100-115`), AC-6 (`:117-126`), AC-7 (`:128-150`), AC-8 (`:152-175`), AC-9 (`:217-256`) |

## Deviations from the design

1. **AC-1's negative half is asserted by `status !== "pending"` and `teamId === FIXTURE_TEAM.id`, not by `not.toContain(FIXTURE_PENDING_SIGNUP.id)` as the plan's test outline (§4.5) implies.** Found while running the test: `FIXTURE_PENDING_SIGNUP.id` (`fixtures.ts:158`) and `FIXTURE_SECOND_ADMIN.id` (`fixtures.ts:206`) are the **same literal**, `88888888-8888-4888-8888-888888888888` — a pre-existing collision in `src/lib/fixtures.ts`, which is outside this ticket's `allowed_paths` and was not touched. `FIXTURE_SECOND_ADMIN` is an approved admin on `FIXTURE_TEAM` and legitimately appears in `listMembersForTeam(FIXTURE_TEAM.id)`'s result; because it shares an id with the pending sign-up, an assertion keyed on that id fails for a reason that has nothing to do with the function under test. The read itself is correct — `listMembersForTeam` filters on `teamId`, and `FIXTURE_PENDING_SIGNUP.teamId` is `null`, so it is excluded regardless of the id collision. The test now asserts the same fact (no pending sign-up in the result, no row of another team) without depending on the colliding id. **Not consulted** — the fix is a test-only workaround for a fixture defect out of scope, not a design question; the defect itself is flagged below for the operator.
2. No other deviation. Section 4's SQL, seam declarations and implementation bodies are as specified; no field name, function name or signature was invented.

## Invariants

| ID | Still holds because |
|----|---------------------|
| INV-04 | `listMembersForTeam` returns removed members carrying `removedAt` (verified by AC-1: `FIXTURE_REMOVED_MEMBER` is present with its `removedAt` intact), `listTeamEntriesOverlappingForTeam` applies the same team predicate the policy does with no status filter (verified by AC-4, which asserts deep equality with the own-team read including `status`), and AC-5's test calls the single `absenceCountsFor` (`src/lib/data/absence.ts:197`) both ways and asserts the two count maps are equal and non-trivial (`tests/cross-team-reads.test.ts:100-115`). No arithmetic was added to either seam implementation. |
| INV-05 | `listTeamEntriesForTeam` and `listTeamEntriesOverlappingForTeam` carry the whole row with no `tentative` filter, in both `supabase.ts` and `mock.ts`; AC-3 and AC-4 compare every field against the own-team read, which would fail if a field were dropped or a tentative row were filtered. |
| INV-07 | Both entry functions' predicate compares `member_team_id(e.member_id) = p_team_id` (migration) / `sameTeam(memberTeamId(e.memberId), teamId)` (mock) — the member's **current** team, never a stored team on the entry row (there is none to store). No entry-side team column was added. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| typecheck (`pnpm exec tsc --noEmit`) | 0 | whole repository |
| lint (`pnpm exec eslint .`) | non-zero, but not on any file this ticket touched — see note below | |
| unit tests (`pnpm exec vitest run`) | 0 | 22 files, 330 tests, all pass (`tests/cross-team-reads.test.ts` contributes 14) |
| `git diff --name-only` subset of `allowed_paths` | yes | `supabase/migrations/20260922150000_cal11_cross_team_reads.sql`, `src/lib/data/index.ts`, `src/lib/data/supabase.ts`, `src/lib/data/mock.ts`, `tests/cross-team-reads.test.ts` — all five listed in `ticket.yaml:24-29`; `.ai/board/backlog.md` is PLAN's output, not this stage's, and is outside `allowed_paths` but was not written here |

**Note on lint.** `pnpm exec eslint .` (whole repository) exits non-zero: `scripts/run-loop.mjs` (4 errors: `no-useless-assignment`, `no-control-regex`, two `no-useless-escape`) and `src/components/Sidebar.tsx` (1 error: `@typescript-eslint/no-unused-vars` on `NAV_LINK`). Neither file is in this ticket's `allowed_paths`, neither was touched in this stage (`git status --porcelain` on both is empty), and both errors are present at `HEAD` (`704a490`, the branch point) before this ticket's changes — confirmed by running lint scoped to only the five files this ticket touched, which is clean:
`pnpm exec eslint tests/cross-team-reads.test.ts src/lib/data/index.ts src/lib/data/supabase.ts src/lib/data/mock.ts` — exit 0.
Flagged for the operator; not this ticket's to fix under RULE-03.

## Testability contract

None — this ticket ships no screen, hook or component (01-plan.md § Out of scope 1, § 2b). No selector is added.

## Open questions

None blocking. Two items are flagged above for the operator, neither blocking this gate:

1. **`src/lib/fixtures.ts:158` and `:206` — `FIXTURE_PENDING_SIGNUP` and `FIXTURE_SECOND_ADMIN` share the literal id `88888888-8888-4888-8888-888888888888`.** In the real schema `member.id` is the primary key (the `auth.users` id), so this state is impossible against a running Postgres — it is a fixture-authoring defect. It did not corrupt any assertion already in the suite (nothing before this ticket compared these two rows by id), but it made one of this ticket's own AC-1 assertions unsound until reworded (see *Deviations* above). Worth a fixture fix in a ticket whose `allowed_paths` includes `src/lib/fixtures.ts`.
2. **Whole-repository lint is not green at the branch point**, per the *Note on lint* above. Both failing files are pre-existing and out of this ticket's scope; noted so the reviewer does not attribute them to this diff.
