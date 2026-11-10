---
ticket: MIR-16-d
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-07T13:12:40Z
inputs_read:
  - .ai/board/tickets/MIR-16-d/01-plan.md
  - .ai/board/tickets/MIR-16-d/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/steward/context.md
  - supabase/tests/_isolation.psql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/100-mock-parity.test.sql
  - supabase/tests/230-writers-write-membership.test.sql
  - supabase/tests/280-is-org-admin.test.sql
  - .ai/board/tickets/MIR-16-b/03-impl-log.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-16-d: implementation log

## Files touched

The ADR-084, MIR-16-e and MIR-16-c files in `allowed_paths` were written at PLAN and committed at
the PLAN checkpoint (`1cf0229`). This stage did not touch them.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/tests/_isolation.psql` | modified | adds the helper, and `tests.seed()` reaches `member.role` only through it | § 4.1; § 4.2 row 1 |
| `supabase/tests/040-member-self-writes.test.sql` | modified | the two `role::text` read-backs name the admin value through the helper | § 4.2 rows 2–3 |
| `supabase/tests/100-mock-parity.test.sql` | modified | `tests.parity_subject` and `parity_own_update`'s `v_value` map a role word through the helper; the `$parity$` document is untouched | § 4.2 rows 4–5 |
| `supabase/tests/120-composite-fks.test.sql` | modified | the two admin member inserts call the helper; the reserved `org_code` `'admin'` is untouched | § 4.2 row 6 |
| `supabase/tests/140-org-stamping-and-membership-mirror.test.sql` | modified | the admin member insert calls the helper | § 4.2 row 7 |
| `supabase/tests/220-roster-team-from-membership.test.sql` | modified | the two admin member inserts call the helper | § 4.2 row 8 |
| `supabase/tests/230-writers-write-membership.test.sql` | modified | the two admin inserts, and the AC-5 promote read-back compares to the helper as an enum | § 4.2 rows 9–10 |
| `supabase/tests/240-org-public-holidays.test.sql` | modified | the admin member insert calls the helper | § 4.2 row 11 |
| `supabase/tests/290-member-role-helper.test.sql` | created | the ten assertions for AC-1 to AC-3, none of which names the admin value | § 4.3 |
| `.ai/board/tickets/MIR-16-d/03-impl-log.md` | created | this log | stage artifact |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 helper | `supabase/tests/_isolation.psql:90-100` | Verbatim from the plan, comment included. After `tests.put_on_team`, before `tests.seed()`, above the `grant execute` line, so the grant covers it |
| 4.2 `tests.seed()` | `supabase/tests/_isolation.psql:135` | |
| 4.2 040 | `supabase/tests/040-member-self-writes.test.sql:43`, `:79` | |
| 4.2 100 `parity_subject` | `supabase/tests/100-mock-parity.test.sql:123` | |
| 4.2 100 `v_value` | `supabase/tests/100-mock-parity.test.sql:160-164` | Exactly the plan's text. Every `role` case in the `$parity$` document carries `admin` or `member`, so no case changes its value |
| 4.2 120 | `supabase/tests/120-composite-fks.test.sql:265-266` | |
| 4.2 140 | `supabase/tests/140-org-stamping-and-membership-mirror.test.sql:43` | |
| 4.2 220 | `supabase/tests/220-roster-team-from-membership.test.sql:35-36` | |
| 4.2 230 | `supabase/tests/230-writers-write-membership.test.sql:77-78`, `:322` | `:322` description unchanged |
| 4.2 240 | `supabase/tests/240-org-public-holidays.test.sql:81` | |
| 4.3 290 | `supabase/tests/290-member-role-helper.test.sql:1-51` | `plan(10)`, assertions 1–10 in the plan's order; 10/10 pass |
| 4.4 | — | PLAN's own writes, already in `1cf0229` |

**AC-4 listing.** `grep -n "'admin'"` over the harness and the seven files, minus `member_role('admin')`
calls, leaves only: the helper's comment and its `'admin'` branch (`_isolation.psql:91-92`, `:97`);
the three seed labels (`_isolation.psql:115`, `:120`, `:121`); the own-update subject label
(`100-mock-parity.test.sql:145`); and the reserved `org_code` (`120-composite-fks.test.sql:223`,
`:225`). The `$parity$` document spells `"admin"` in double quotes and is not edited.

**AC-5.** No `plan(n)` line is in the diff (`git diff -U0 | grep -c "plan("` → 0). Nothing under
`src/`, `tests/`, `supabase/migrations/`, `supabase/seed.sql` or `supabase/bootstrap.sql` changed.

## Deviations from the design

none

## Invariants

`invariants_touched: []`. No migration, function in `public`, policy, trigger or row changes. The
helper returns the same enum value each call site used to cast to, so every fixture row and every
assertion is the same as before.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 51 files, 1028 tests |
| `pnpm db:test` | 1 | 31 files, 1282 tests. `290` passes 10/10; every changed file passes. **One failure: `170-multi-team-decisions.test.sql` test 42** (`AC-20: admin_u does not select E`). Re-run with this stage's changes stashed: same failure, 30 files, 1272 tests. Pre-existing, recorded in `MIR-16-b/03-impl-log.md:96`, `MIR-15-b/03-impl-log.md:109` and earlier |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS; working-tree files are all inside `allowed_paths` |

## Testability contract

No UI; no selectors.

## Open questions

- `170-multi-team-decisions.test.sql` #42 still fails on `main`'s schema. Not this ticket's, and
  untouched by it; noted so the reviewer does not read it as a regression.
