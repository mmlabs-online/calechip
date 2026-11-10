---
ticket: MIR-08
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-23T07:28:26Z
inputs_read: [ .ai/board/tickets/MIR-08/01-plan.md, .ai/board/tickets/MIR-08/03-impl-log.md, .ai/board/tickets/MIR-08/ticket.yaml, .ai/templates/review-report.md, .ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md, .ai/registry/decisions/ADR-068-db-sql-is-retired-and-the-migrations-are-the-only-schema-source.md ]
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

# MIR-08 — review

Re-review in a fresh session. The previous pass (run 20261023-065554) was BLOCKED because R1–R3
could not be run. This pass ran all of them.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; carry has no stray path | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-08, 11 changed file(s)` … `allowed-paths: PASS` (exit 0). `node scripts/check-carry.mjs MIR-08` → `0 uncommitted path(s)` / `PASS — nothing stray` (exit 0). The non-ticket, non-ship-owned paths in `git diff --name-only origin/main...HEAD` are the five in `.ai/board/tickets/MIR-08/ticket.yaml:17-21`. |
| R2 | typecheck exit 0, whole program | PASS | `pnpm typecheck` (`tsc --noEmit`) exited 0 with no diagnostics. |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm lint` (`eslint .`, repo-wide) exited 0 with no output. This covers `src/lib/data/supabase.ts` and `src/routes/MonthView.tsx`. The earlier `scripts/run-loop.mjs:46` error has been fixed. `pnpm test`: 49 files, 987 tests passed (exit 0). |
| R4 | Nothing bypasses the data-access seam (RULE-02) | PASS | The only `src/` changes are comment lines: `src/lib/data/supabase.ts:2304-2305` and `src/routes/MonthView.tsx:293-294`. No import, call or identifier changed (`git diff origin/main...HEAD -- src/`). |
| R5 | Every plan §4 contract item is implemented | PASS | See R5 detail. |
| R6 | Permission gating matches plan §3 | PASS | Plan §3 (`01-plan.md:126-128`) changes no capability. `git diff --name-only origin/main...HEAD` touches nothing under `supabase/migrations/`, `supabase/tests/`, `supabase/seed.sql` or `supabase/config.toml` (AC-2). The deleted `supabase/db.sql` is not read by any code, script or CI step: `git grep -n "db\.sql" -- src scripts .github package.json` finds nothing. The only hits under `supabase/` are historical comments in migrations, such as `supabase/migrations/20260904100000_cal04_team_select.sql:7`. Plan §1 (`01-plan.md:69-70`) places these out of scope as records of their time. |
| R7 | No invariant violated (RULE-07) | PASS | See R7 detail. |
| R8 | No dependency added without an ADR | PASS | `package.json` and `pnpm-lock.yaml` are absent from `git diff --name-only origin/main...HEAD`. |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| Delete `supabase/db.sql` (`01-plan.md:133`) | `supabase/db.sql` is deleted in the branch diff (1091 lines removed) and absent from the tree (AC-1) | n/a, a deletion |
| Replace `(db.sql 9.1)` in `supabase.ts` (`01-plan.md:134-136`) | `src/lib/data/supabase.ts:2304-2305` | Yes. The sentence is unchanged and the citation is now ``(`supabase/migrations/20260904100000_cal04_team_select.sql`)``. The cited file has the grant at `supabase/migrations/20260904100000_cal04_team_select.sql:34` and the policy at `:36`, so the claim checks out. |
| The same replacement in `MonthView.tsx` | `src/routes/MonthView.tsx:293-294` | Yes. The sentence is otherwise unchanged (AC-3). No `db.sql` string remains in either file (`git grep` across `src` is empty). |
| AC-6: ADR status lines (written at PLAN) | `.ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md:11` (`SUPERSEDED by ADR-068`, original kept at `:13`); `.ai/registry/decisions/ADR-068-db-sql-is-retired-and-the-migrations-are-the-only-schema-source.md:11` | Yes |

AC-5 (the CI `database` job) is a check on the pull request and cannot be run from this session. No
migration changed (R6), so this diff gives that job nothing new to build.

## R7 detail

`invariants_touched: []` (`.ai/board/tickets/MIR-08/ticket.yaml:15`), so there is no ID to reason
through. I checked independently that the empty list is correct:

- The diff creates, alters or drops no row, policy, function, grant or migration (R6 citation).
- The `src/` changes are comments only (`src/lib/data/supabase.ts:2304-2305`, `src/routes/MonthView.tsx:293-294`).
- The deleted file was never executed by a build, test or CI step (empty `git grep` across `src scripts .github package.json`).

| Invariant | Held by | Citation |
|---|---|---|
| none touched | n/a | `.ai/board/tickets/MIR-08/ticket.yaml:15` |

## Findings

None.

## Delegated decisions

None.

## Verdict

`PASS`.
