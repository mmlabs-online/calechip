---
ticket: MIR-17-d
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-09T21:03:21+07:00
inputs_read:
  - .ai/board/tickets/MIR-17-d/01-plan.md
  - .ai/board/tickets/MIR-17-d/ticket.yaml
  - .ai/registry/decisions/ADR-091-the-applications-manager-is-whoever-manages-a-team-and-the-rest-of-p4-2-is-mir-17-e.md
  - supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql
  - supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/310-manager-read-from-membership.test.sql
  - supabase/tests/330-member-role-without-manager.test.sql
  - src/lib/data/supabase.ts
  - tests/org-admin-role-mapping.test.ts
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - .ai/board/tickets/MIR-16-c/03-impl-log.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261109120000_mir17d_manages_a_team.sql` | created | `member_manages_a_team(uuid)` and the computed field `manages_a_team(public.member)` | §4.1 |
| `supabase/tests/340-manages-a-team.test.sql` | created | pgTAP coverage of AC-1 to AC-5 | §4.2 |
| `supabase/tests/010-catalogue.test.sql` | modified | the security-definer census gains `member_manages_a_team(uuid)`, after `member_roster_team_role(uuid)`; `manages_a_team(public.member)` is invoker and not listed, in the way `roster_team_role(public.member)` is not | §4.3 |
| `src/lib/data/supabase.ts` | modified | `MEMBER_COLUMNS` selects `manages_a_team` instead of `team_role:roster_team_role`; `MemberRow` carries `manages_a_team: boolean` instead of `team_role`; `appRole` reads the manager rank from `row.manages_a_team` | §4.4 |
| `tests/org-admin-role-mapping.test.ts` | modified | the MIR-16-c describe became the MIR-17-d AC-6 describe, and its three cases were updated to match `appRole`'s new body, `MEMBER_COLUMNS`'s new column, and `MemberRow`'s new field | §4.5 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 `member_manages_a_team(uuid)` | `20261109120000_mir17d_manages_a_team.sql:19-33` | verbatim from the plan |
| §4.1 `manages_a_team(public.member)` | `20261109120000_mir17d_manages_a_team.sql:38-43` | verbatim from the plan |
| §4.2 pgTAP, one `plan(n)`, AC-1 to AC-5 | `supabase/tests/340-manages-a-team.test.sql` | `plan(13)`, 13 assertions (2 fixture + AC-1:1, AC-2:2, AC-3:3, AC-4:2, AC-5:3), counted and verified against the file. Fixtures: team T2; a second, active, non-primary `membership` row for `member_t` on T2 (`team_role = 'manager'`) written as `postgres`, which is Vu; `member_t2` (already in `tests.seed()`) is Thanh; Rae placed with `tests.put_on_team(…, 'manager')` on T and then removed, in the shape of `310-manager-read-from-membership.test.sql`'s own Rae fixture |
| §4.3 `010-catalogue.test.sql` census | `supabase/tests/010-catalogue.test.sql:58-60` | `manages_a_team(public.member)` is invoker and not `prosecdef`, so it is not added to this census — confirmed by reading the file's own rule for `roster_team_role(public.member)` immediately above before editing |
| §4.4 member seam | `src/lib/data/supabase.ts:968-971` (`appRole`), `:976-988` (`MemberRow`), `:997-998` (`MEMBER_COLUMNS`) | `fromDbRole`, `toDbRole`, `toMember` and `setRankThroughRpc` unchanged, as the plan specified |
| §4.5 vitest | `tests/org-admin-role-mapping.test.ts:51-73` | renamed describe, updated its three cases |

## Deviations from the design

`none`.

## Invariants

`invariants_touched: []`. Two read functions are added; no entry, count or window is read or written
differently — confirmed by reading `member_manages_a_team`'s body: it is a `select exists(...) or
coalesce(...)` over `membership` and `member.status`/`removed_at`, with no write anywhere in this
migration.

| ID | Still holds because |
|----|---------------------|
| (none touched) | No invariant in `.ai/registry/invariants.md` concerns a manager read; the migration adds two `stable` functions and no write path, table, column, policy, trigger, constraint or grant changed. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 54 files, 1051 tests, all pass (includes the 9-test `tests/org-admin-role-mapping.test.ts`, run alone first and then as part of the full suite) |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS, 6 changed files, all within `allowed_paths` (the other two `allowed_paths` entries — ADR-091, `MIR-17-e`'s and `MIR-20`'s `ticket.yaml` — were already written and committed at `/plan`'s `/advance` checkpoint, `c3dd833`) |
| `node scripts/check-carry.mjs MIR-17-d` | 0 | PASS — nothing stray, 5 carried paths |
| `git diff --name-only` subset of `allowed_paths` | yes | 3 modified + 2 untracked, all listed in `01-plan.md` §7 |

The pgTAP file (`340-manages-a-team.test.sql`) and the catalogue census edit were not run against a
live Postgres instance — none is reachable from this session, the same finding `MIR-16-c`'s
`03-impl-log.md` recorded, and applying a migration to the hosted project is human-only (RULE-09).
Their correctness was checked by hand: `member_manages_a_team`'s body was copied verbatim from the
plan's own § 4.1 code block (already reviewed and accepted there), the test's fixture rows were
checked against `tests.seed()`'s actual rows and `tests.put_on_team`'s actual `is_primary`
computation — which is why Vu's second row is a direct `insert` with `is_primary = false` rather than
a `tests.put_on_team` call: `put_on_team` sets `is_primary = (m.removed_at is null)`, which for an
active member would collide with `membership_one_active_primary_idx` against their existing primary
row — and the assertion count was hand-tallied against `plan(13)`. This is named here rather than
claimed as a passing run.

## Testability contract

Not produced for this ticket. Plan §2b: no screen changes, no layout, and
`.ai/standards/testing-standards.md` records that plan section 8 (the testability contract) and check
R7 are retired with the QA stage (ADR-022). The selector contract does not apply: this ticket touches
no component, and the one UI-adjacent file section 1 named out of scope (`TopBar`, `AdminLayout`,
`AdminTabs`, `PendingEntries`) is explicitly not edited.

## Open questions

None.
