---
ticket: MIR-16-d
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-07T13:24:00Z
inputs_read:
  - .ai/board/tickets/MIR-16-d/01-plan.md
  - .ai/board/tickets/MIR-16-d/03-impl-log.md
  - .ai/board/tickets/MIR-16-d/ticket.yaml
  - .ai/templates/review-report.md
  - .ai/registry/invariants.md
  - .ai/board/tickets/MIR-16-b/03-impl-log.md
  - "git diff origin/main...HEAD (16 files)"
  - supabase/tests/_isolation.psql
  - supabase/tests/100-mock-parity.test.sql
  - supabase/tests/290-member-role-helper.test.sql
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

# MIR-16-d: review

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-16-d, 16 changed file(s) … allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-16-d` → `0 uncommitted path(s) … PASS — nothing stray`. Every path in the branch diff is either in `ticket.yaml` `allowed_paths`, the ticket folder, or `.ai/board/backlog.md` (ship-owned) |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`) exit 0, no output. The diff has no lintable file (only `.sql`, `.psql`, `.md`, `.yaml`) |
| R4 | No datastore access outside the seam | PASS | `git diff --name-only origin/main...HEAD -- src tests` is empty. Every code change is pgTAP fixture code under `supabase/tests/`, e.g. `supabase/tests/_isolation.psql:94`, `supabase/tests/290-member-role-helper.test.sql:1` |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | No grant, policy, role or definer function changes: no file under `supabase/migrations/` in the diff. The helper is created in the rolled-back `tests` schema (`supabase/tests/_isolation.psql:9`, `:94`), above the harness's existing grant (`supabase/tests/_isolation.psql:200`), so `anon` and `authenticated` may execute it. It has no `security definer` (`supabase/tests/_isolation.psql:94-95`), so it runs as invoker, as § 3 states. `grep -rn "tests\.member_role" supabase/migrations` finds nothing |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`.ai/board/tickets/MIR-16-d/ticket.yaml`). See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 helper `tests.member_role(text) returns public.member_role`, `language sql stable set search_path = ''`, after `put_on_team`, before `seed()`, above the grant | `supabase/tests/_isolation.psql:90-100` (after `put_on_team` ending `:88`; `seed()` follows; grant at `:200`) | Yes. Body is the plan's text verbatim |
| § 4.2 `tests.seed()` | `supabase/tests/_isolation.psql:135` | Yes, `tests.member_role(v_person.role)` |
| § 4.2 040 ×2 | `supabase/tests/040-member-self-writes.test.sql:43`, `:79` | Yes, `tests.member_role('admin')::text` |
| § 4.2 100 `parity_subject` | `supabase/tests/100-mock-parity.test.sql:123` | Yes |
| § 4.2 100 `v_value` | `supabase/tests/100-mock-parity.test.sql:160-164` | Yes, the plan's three-branch `case` exactly. Subject label `'admin'` at `:145` untouched; `$parity$` document not in the diff |
| § 4.2 120 ×2 | `supabase/tests/120-composite-fks.test.sql:265-266` | Yes. Reserved `org_code` `'admin'` at `:223`, `:225` untouched |
| § 4.2 140 | `supabase/tests/140-org-stamping-and-membership-mirror.test.sql:43` | Yes |
| § 4.2 220 ×2 | `supabase/tests/220-roster-team-from-membership.test.sql:35-36` | Yes |
| § 4.2 230 inserts ×2 | `supabase/tests/230-writers-write-membership.test.sql:77-78` | Yes |
| § 4.2 230 read-back | `supabase/tests/230-writers-write-membership.test.sql:322` | Yes, `is(s.role, tests.member_role('admin'), …)`, description unchanged |
| § 4.2 240 | `supabase/tests/240-org-public-holidays.test.sql:81` | Yes |
| § 4.3 `290-member-role-helper.test.sql`, `plan(10)`, assertions 1–10 in order | `supabase/tests/290-member-role-helper.test.sql:13` (`plan(10)`), `:17-48` (assertions 1–10 in the plan's order and form); `pnpm db:test` → `290-member-role-helper.test.sql … ok` | Yes |
| § 4.4 ADR-084, MIR-16-e ticket, MIR-16-c `depends_on` | Committed at PLAN checkpoint `1cf0229`; present in the branch diff | Yes |
| AC-4 listing | `grep -n "'admin'"` over the harness and seven files, minus `member_role('admin')` calls, leaves only: helper comment and branch `supabase/tests/_isolation.psql:91-92`, `:97`; seed labels `:115`, `:120`, `:121` (reach `role` only through `:135`); subject label `supabase/tests/100-mock-parity.test.sql:145` (reaches `role` only through `:123`); reserved `org_code` `supabase/tests/120-composite-fks.test.sql:223`, `:225` | Yes, every remaining occurrence is in an allowed category |
| AC-5 | No `plan(` line in the diff; `git diff --name-only origin/main...HEAD -- src tests supabase/migrations supabase/seed.sql supabase/bootstrap.sql` empty; `pnpm test` 51 files, 1028 tests passed; `pnpm db:test` every changed file `ok` | Yes, see Findings for the one unrelated `db:test` failure |

## R7 detail

`invariants_touched` is `[]`. No ID to reason through individually; the reason none is touched:

| Invariant | Held by | Citation |
|---|---|---|
| (none in `invariants_touched`) | The diff changes no migration, function in `public`, policy, trigger or seed row, so no invariant's enforcement point (INV-01 to INV-07, `.ai/registry/invariants.md:33-39`) moves. The helper returns the same enum value each call site cast to before (`supabase/tests/_isolation.psql:96-99`), so fixtures insert identical rows | `git diff --name-only origin/main...HEAD -- supabase/migrations supabase/seed.sql supabase/bootstrap.sql` empty |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | None against this ticket. | — | — |

**Outside the diff, for a human:** `pnpm db:test` exits 1 on one assertion,
`supabase/tests/170-multi-team-decisions.test.sql` test 42 (`AC-20: admin_u does not select E`,
have 1, want 0). That file is not in this branch's diff, and the same failure is recorded before this
ticket at `.ai/board/tickets/MIR-16-b/03-impl-log.md:86` and `:96`. It does not bear on R1–R8 here.
It has now been carried through at least three tickets and wants an `OPS-nnn` chore of its own.

## Verdict

PASS. The ticket advances to DONE.
