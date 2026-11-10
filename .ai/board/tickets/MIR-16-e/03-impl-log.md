---
ticket: MIR-16-e
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-07T13:41:32Z
inputs_read:
  - .ai/board/tickets/MIR-16-e/01-plan.md
  - .ai/board/tickets/MIR-16-e/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - supabase/migrations/20261107230000_mir16b_is_org_admin.sql
  - supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql
  - supabase/migrations/20260912100000_solo_manager_role.sql
  - supabase/migrations/20261103210000_mir14_multi_team_decisions.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/280-is-org-admin.test.sql
  - supabase/tests/250-membership-self-lock.test.sql
  - supabase/tests/260-writers-stop-writing-team-id.test.sql
  - supabase/tests/270-issue-reports-system-scope.test.sql
  - supabase/tests/270-member-team-id-dropped.test.sql
  - supabase/tests/290-member-role-helper.test.sql
  - supabase/bootstrap.sql
  - supabase/seed.sql
  - src/lib/data/supabase.ts
  - tests/member-rpc-roster-team.test.ts
  - .ai/board/tickets/MIR-16-b/03-impl-log.md
  - .ai/board/tickets/MIR-16-b/04-review.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-16-e — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql` | created | the rename itself, and the five function bodies re-created with the new spelling | § 4.1 |
| `supabase/tests/300-org-admin-rename.test.sql` | created | AC-1 to AC-8, plus the `tests.member_role('admin')` read-back, 20 assertions on `tests.seed()` | § 4.2 |
| `supabase/tests/_isolation.psql` | modified | `tests.member_role`'s `'admin'` branch now returns `'org_admin'::public.member_role` | § 4.3 |
| `supabase/tests/250-membership-self-lock.test.sql` | modified | the one direct `'admin'` literal at the fixture insert becomes `tests.member_role('admin')` | § 4.3 |
| `supabase/tests/260-writers-stop-writing-team-id.test.sql` | modified | same | § 4.3 |
| `supabase/tests/270-issue-reports-system-scope.test.sql` | modified | same | § 4.3 |
| `supabase/tests/280-is-org-admin.test.sql` | modified | same | § 4.3 |
| `supabase/tests/270-member-team-id-dropped.test.sql` | modified | the AC-7 read-back's literal `'admin'::text` becomes `tests.member_role('admin')::text` | § 4.3 |
| `supabase/bootstrap.sql` | modified | the three `'admin'::public.member_role` sites (the already-bootstrapped check, the second-admin guard, the insert) become `'org_admin'::public.member_role` | § 4.3 |
| `supabase/seed.sql` | modified | the three `'admin',` role literals become `'org_admin',`, and the one comment that named the role | § 4.3 |
| `src/lib/data/supabase.ts` | modified | `DbMemberRole`, `fromDbRole`, `toDbRole`; `MemberRow.role` retyped; `toMember` and `setRankThroughRpc` go through the mapping | § 4.4 |
| `tests/org-admin-role-mapping.test.ts` | created | AC-9, AC-10: pins the seam's source text, the shape `tests/member-rpc-roster-team.test.ts` already uses | § 4.5 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1, the rename | `20261107235000_…sql`, step 1 | Guarded `do $$ … $$` so a second run is a no-op (ADR-024) |
| § 4.1, `is_org_admin(uuid,uuid)` | same file | From `20261107230000_mir16b_is_org_admin.sql:25-41`, respelled; comment that said "Still reads 'admin'" dropped |
| § 4.1, `promote_member_to_admin(uuid)` | same file | From `20261107230000:507-542`, respelled |
| § 4.1, `set_member_role(uuid, public.member_role)` | same file | From `20261107230000:595-640`, respelled |
| § 4.1, `member_enforce_role_and_removal()` | same file | From `20261107180000_mir21f_drop_member_team_id.sql:37-142`, respelled; demotion message now names "an org admin" (AC-4) |
| § 4.1, `may_decide(uuid)` | same file | From `20260912100000_solo_manager_role.sql:55-66`, respelled |
| § 4.2 | `300-org-admin-rename.test.sql` | AC-1 `:17`, AC-2 `:23-45`, AC-3 `:48-56`, AC-4 `:59-63`, AC-5 `:66-74`, AC-6 `:77-85`, AC-7 `:88-90`, AC-8 `:93-105`; `plan(20)` |
| § 4.3 | `_isolation.psql`, the five fixture files, `bootstrap.sql`, `seed.sql` | Exactly the lines § 4.3 named. `290-member-role-helper.test.sql` left untouched, as directed |
| § 4.4 | `src/lib/data/supabase.ts:963-981, 1003, 1230` (`DbMemberRole`/`fromDbRole`/`toDbRole` added before `MemberRow`; `MemberRow.role: DbMemberRole`; `toMember`'s `role: fromDbRole(row.role)`; `setRankThroughRpc`'s `.rpc("set_member_role", { …, p_role: toDbRole(role) })`) | No exported name or seam signature changed |
| § 4.5 | `tests/org-admin-role-mapping.test.ts` | Asserts `fromDbRole`, `toDbRole`, `toMember`'s use of `fromDbRole(`, the `p_role: toDbRole(` statement, and `MemberRow`'s `role: DbMemberRole` |

## Deviations from the design

none

## Invariants

`invariants_touched: []`. Confirmed: every re-created body (`is_org_admin`, `promote_member_to_admin`,
`set_member_role`, `member_enforce_role_and_removal`, `may_decide`) changes only the spelling of the
enum value its existing logic already compared against. No entry rule, absence count or window (the
INV-01–INV-07 subjects) is read or written by any of the five, and the migration's catalogue re-check
(plan § 4.1) found exactly the five bodies the plan named and no other function, policy or constraint
spelling the old value — confirmed against the real catalogue, not a static grep (see Verification
run, `pnpm db:test`).

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 52 files, 1034 tests (up from 51/1028 at MIR-16-b — the one new file, 5 new tests) |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS. 12 changed files, all in `allowed_paths` |
| `node scripts/check-carry.mjs MIR-16-e` | 0 | PASS. Nothing stray |
| `pnpm db:test` | 1 | 32 files, 1302 tests. `300` passes 20/20; `250`, `260`, `270-issue-reports`, `270-member-team-id-dropped` and `280` all pass. **One real failure, pre-existing**: `170-multi-team-decisions.test.sql` test 42 (`AC-20: admin_u does not select E`, have 1, want 0) — the same failure MIR-16-b's `03-impl-log.md` Open questions recorded and traced to MIR-21-f, confirmed there as reproducing with `20261107230000` removed. This migration touches none of `may_decide_entry`, `entry_select_decider` or `shares_active_team`, and the five bodies it does touch change only a label's spelling, not a boolean outcome, so this ticket does not change, cause or fix it. Two further `(TODO)` failures in `010-catalogue.test.sql` (AC-10) and `080-guest-tokens.test.sql` are pre-existing and marked TODO upstream; pg_prove does not count a TODO failure against the file |
| `git diff --name-only` / `git status --porcelain` subset of `allowed_paths` | yes | 12 files, all listed above |

## Testability contract

No selectors. The ticket has no UI (§ 2b).

## Open questions

- **`170-multi-team-decisions.test.sql` test 42** is unresolved model debt, not caused by this ticket.
  It already has no owner after MIR-16-b (that ticket's Open questions said the same and did not
  create one either). I am not creating a model-debt row or a ticket: I have no tracker access and
  `.ai/board/model-debt.md` is not in `allowed_paths`. Raising it here per the instruction to say so
  rather than work around it; `/ship` or a human is the next place this can be recorded.

## Delegated decisions

none — no `99-questions.md` was needed. The plan's § 4.1 catalogue re-check, § 4.3's five fixture
lines and § 4.4's three call sites were all unambiguous and matched the source tree exactly as
described.
