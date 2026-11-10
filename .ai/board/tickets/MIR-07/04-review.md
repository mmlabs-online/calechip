---
ticket: MIR-07
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-23T09:54:28+07:00
inputs_read:
  - .ai/board/tickets/MIR-07/01-plan.md
  - .ai/board/tickets/MIR-07/03-impl-log.md
  - .ai/board/tickets/MIR-07/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - .ai/standards/architecture.md
  - src/lib/data/mock.ts
  - src/lib/roles.ts
  - supabase/tests/100-mock-parity.test.sql
  - tests/mock-sql-parity.test.ts
  - tests/signup-confirmation.test.ts
  - tests/cross-team-reads.test.ts
  - tests/cross-team-role.test.ts
  - src/routes/PendingEntries.tsx
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

# MIR-07 — review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing uncommitted is stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: PASS` (11 changed files; `.ai/board/backlog.md` is ship-owned). `node scripts/check-carry.mjs MIR-07` → `0 uncommitted path(s)`, `PASS — nothing stray`. Source paths: `src/lib/data/mock.ts`, `src/lib/roles.ts`, `supabase/tests/100-mock-parity.test.sql`, `tests/mock-sql-parity.test.ts`, `tests/signup-confirmation.test.ts`, `tests/cross-team-reads.test.ts`, `tests/cross-team-role.test.ts` — all in `ticket.yaml` `allowed_paths` |
| R2 | typecheck exit 0, whole program | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint` on the six changed `.ts` files → exit 0; `pnpm exec eslint .` → exit 0 (nothing outside the diff to route) |
| R4 | Nothing outside the seam reaches the datastore (RULE-02) | PASS | Production changes are inside the mock seam (`src/lib/data/mock.ts:340`, `:349`, `:408-412`, `:1311-1313`, `:1885-1888`) and a pure predicate (`src/lib/roles.ts:51`); no datastore client import added. `no-restricted-imports` (`eslint.config.js:64`) passes under R3 |
| R5 | Every plan § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches plan § 3 | PASS | `is_admin` → `adminOf` approved ∧ not removed ∧ admin (`src/lib/data/mock.ts:408-412`); `member_team_id` → approved ∧ not removed (`src/lib/data/mock.ts:1311-1313`); `may_decide` → `me.status === "approved"` first conjunct (`src/lib/roles.ts:51`), consumed by entry decisions at `src/lib/data/mock.ts:1416`; own-row write refuses any key outside `displayName`, `avatar` (`src/lib/data/mock.ts:1885-1888`). UI caller `src/routes/PendingEntries.tsx:621` passes the signed-in approved member, so no visible change |
| R7 | No invariant violated (RULE-07) | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --stat origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; new imports are `node:fs`, `node:url`, `vitest` (`tests/mock-sql-parity.test.ts:15-17`), all existing |

`pnpm exec vitest run` → 49 files, 987 passed.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| `adminOf(uid)` / `currentAdmin()` = `is_admin` | `src/lib/data/mock.ts:408-412` | yes |
| `memberTeamId(uid)` = `member_team_id` | `src/lib/data/mock.ts:1311-1313` | yes |
| `eventIsAdmin` comment corrected, function unchanged | `src/lib/data/mock.ts:721-723` | yes — dated line appended (additive) |
| `updateOwnProfile` `OWN_PROFILE_KEYS` refusal, existing code and sentence | `src/lib/data/mock.ts:1885-1888` | yes — placed right after the `me`/removed lookup at `:1875-1878`, before trimming and every other check |
| `__putMemberForTest(member: Member): void` | `src/lib/data/mock.ts:340` | yes |
| `__permissionDecisions(uid)` → `{ isAdmin, memberTeamId, mayDecide }`, owner id `""` | `src/lib/data/mock.ts:349-360` | yes |
| `mayDecideEntriesOf` gains `status === "approved"` first | `src/lib/roles.ts:51` | yes; `mayDecide`/`mayAdminister` unchanged |
| Case table: one file, one dollar-quoted literal, two markers | `supabase/tests/100-mock-parity.test.sql:19-98` | yes — 36 `predicates` (`:22-57`), 36 `own_update` (`:60-95`), field names and domains as § 4.2 |
| pgTAP `plan(36*3+36)`, seed, subjects, assertions | `supabase/tests/100-mock-parity.test.sql:100`, `:101`, `:130-145`, `:197-210` | yes — `plan(144)` |
| `tests.parity_own_update(p_case jsonb) returns text` | `supabase/tests/100-mock-parity.test.sql:151-192` | yes — in-function `authenticate_as` form; `TODO(verify)` resolved per impl log |
| vitest reads the SQL file, never copies the table | `tests/mock-sql-parity.test.ts:40-73` | yes |
| Shape assertions: 2 markers, 36/36 rows, full cross product, no duplicates | `tests/mock-sql-parity.test.ts:143`, `:155-166`, `:183-190` | yes |
| Per-row predicate and own-update tests named `AC-5 <id>` / `AC-6 <id>` | `tests/mock-sql-parity.test.ts:169`, `:193` | yes |
| AC-1, AC-2, AC-3 seam-level tests | `tests/mock-sql-parity.test.ts:227`, `:244`, `:259` | yes |
| AC-7 rename, assertions unchanged | `tests/signup-confirmation.test.ts:195`, `:208-213` | yes |
| AC-8 dated corrections, originals kept | `tests/cross-team-reads.test.ts:10-14`, `tests/cross-team-role.test.ts:19-21` | yes |

**§ 4.2's count.** The plan states the rule "`allowed` exactly for `display_name` and `avatar` on every
subject except `removed`" and then the count "8 rows". Five subjects × two columns is 10; the table
follows the rule (`supabase/tests/100-mock-parity.test.sql:60-61,66-67,72-73,78-79,84-85`), which
agrees with `member_update_own` carrying no status clause. The plan's arithmetic was wrong, not the
implementation. Not a finding.

## R7 detail

`invariants_touched: []`. The two invariants the change could reach are checked individually.

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 (absence count, members on the team) | `approvedMemberIds` is built on `memberTeamId`; it now drops a non-approved row with a `teamId`, which SQL's `member_team_id` already drops. No count path changed; no seeded fixture is such a row | `src/lib/data/mock.ts:982`, `:1311-1313` |
| INV-07 (every entry belongs to one member, counted against that member's team) | Entry ownership and team attribution are untouched; only who the mock treats as on-team changed, matching SQL | `src/lib/data/mock.ts:1311-1313` |
| INV-01, 02, 03, 05, 06 | No entry write, portion, tentative or rejection-reason logic is in the diff. The decision guard still runs at the same place with a stricter actor predicate | `src/lib/data/mock.ts:1416`, `src/lib/roles.ts:50-54` |

## Findings

None.

Recorded for the operator, not a gate item: `pnpm db:test` was not run by the developer and could not
be run here (no Docker on this machine either). The pgTAP half was verified only on the developer's
scratch rig (`03-impl-log.md`, *Verification run*). Run `pnpm db:test` once before merge.

## Verdict

PASS.
