---
ticket: MIR-05
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-21T23:11:33+07:00
inputs_read:
  - .ai/board/tickets/MIR-05/01-plan.md
  - .ai/board/tickets/MIR-05/03-impl-log.md
  - .ai/board/tickets/MIR-05/99-questions.md
  - .ai/board/tickets/MIR-05/ticket.yaml
  - .ai/templates/review-report.md
  - git diff origin/main...HEAD
  - supabase/migrations/20260905120100_adm02_holiday_seed.sql
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

# MIR-05 — review (second pass)

The first pass (2026-10-21T21:45:38+07:00) was BLOCKED only on the precondition in
`99-questions.md` option A: `supabase/migrations/20260905120100_adm02_holiday_seed.sql` did not
parse. That file was filled on `main` by `5003356` (PR #169) and reached this branch in merge
`3bb17a4`; it now parses (`supabase/migrations/20260905120100_adm02_holiday_seed.sql:30-34`). This
pass re-ran every check from cold.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed subset of `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `14 changed file(s)`, `allowed-paths: PASS` (all in `ticket.yaml:16-25` or the ticket folder / `.ai/board/backlog.md`). `node scripts/check-carry.mjs MIR-05` → `0 uncommitted path(s)`, `PASS — nothing stray` |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint .` exit 0 (covers `scripts/db-test.mjs`, `scripts/tests/db-test.test.mjs`) |
| R4 | No datastore access outside the seam | PASS | `src/` untouched by the diff; `scripts/db-test.mjs:9-11` imports only `node:` modules; `scripts/db-test.mjs:44-47` spawns the Supabase CLI and nothing else |
| R5 | Every plan § 4 contract item implemented | PASS | see R5 detail |
| R6 | Permission gating matches plan § 3 | PASS | refusal `scripts/db-test.mjs:13,16-23,39-42` — observed: `--linked` and `--db-url=x` each print the refusal and exit 2; `--local` on reset/test `scripts/db-test.mjs:32-33`; `database` job has no `environment:` `.github/workflows/verify.yml:83-99` (siblings carry it at :33, :64, :104); seed disabled `supabase/config.toml:65-70` and `supabase/seed.sql` absent from the diff |
| R7 | No invariant violated | PASS | `ticket.yaml:15` `invariants_touched: []`; `git diff --stat origin/main...HEAD` touches no file under `supabase/migrations/` or `src/` |
| R8 | No dependency added without an ADR | PASS | `package.json:14` adds a script only; `supabase` `^2.116.0` already on `origin/main` (`git show origin/main:package.json` line 45) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `db:test` script | `package.json:14` | yes |
| 4.2 `REFUSED_FLAGS` | `scripts/db-test.mjs:13` | yes |
| 4.2 `refusedFlag(argv)` | `scripts/db-test.mjs:16-23` | yes — exact or `<flag>=` |
| 4.2 `steps()` | `scripts/db-test.mjs:26-35` | yes — identical to plan's array |
| 4.2 `main` refusal, exit 2, nothing spawned | `scripts/db-test.mjs:38-42` | yes — message verbatim |
| 4.2 `main` stops at first failing step, prints `<name> failed (exit <n>)` | `scripts/db-test.mjs:43-53` | yes |
| 4.2 `spawnSync` `stdio: inherit`, `shell: win32` | `scripts/db-test.mjs:44-47` | yes |
| 4.3 harness test | `supabase/tests/000-harness.test.sql:2-15` | yes — verbatim plus header comment |
| 4.4 `config.toml`, seed disabled with AC-6 comment | `supabase/config.toml:5,65-70` | yes |
| 4.4 `supabase/.gitignore` as generated | `supabase/.gitignore:1-8` | yes |
| 4.5 `database` job | `.github/workflows/verify.yml:81-99` | yes — steps exactly as plan |
| 4.5 `verify` needs/env/check | `.github/workflows/verify.yml:117,128,131-132` | yes |
| 4.5 header job list | `.github/workflows/verify.yml:5` | yes |
| 4.6 script tests | `scripts/tests/db-test.test.mjs:10-45` | yes — `node --test` 6/6 pass |
| 4.7 branch-protection doc | `docs/ops/branch-protection.md:27,35` | yes |

**Observed end to end at HEAD, tree clean:** `pnpm db:test` exit 0 — 45 `Applying migration` lines
for 45 files in `supabase/migrations/`, including `20260905120100_adm02_holiday_seed.sql`; no
`Seeding data` line (AC-6); `000-harness.test.sql .. ok`, `Files=1, Tests=4`, `Result: PASS`
(AC-1, AC-4). AC-2 and AC-3 rest on `03-impl-log.md` § Verification run (scratch-copy failing test;
the real unparseable file on the second run) and on `scripts/db-test.mjs:48-52`.

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| (none — `invariants_touched: []`) | No table, policy, trigger, constraint or seam function changes | `ticket.yaml:15`; `git diff --stat origin/main...HEAD` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| 1 | — (observation, not an R-check; outside `allowed_paths`) | `supabase/migrations/20260905120100_adm02_holiday_seed.sql:31-33` holds two rows (2026-01-01, 2027-01-01) and its banner at :4 still reads "THIS FILE IS EMPTY OF ROWS". It parses, which is all MIR-05 needs; the twelve-month coverage its own banner asks for is ADM-02 Open question 1 and remains owed by a human. | human (ADM-02, not this ticket) | false |

## Verdict

`PASS`. R1–R8 pass and the precondition that blocked the first pass is met at HEAD.
