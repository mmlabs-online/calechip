---
ticket: MIR-16-c
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-08T08:01:00+07:00
inputs_read:
  - .ai/board/tickets/MIR-16-c/01-plan.md
  - .ai/board/tickets/MIR-16-c/ticket.yaml
  - .ai/registry/decisions/ADR-085-the-manager-rank-is-read-from-membership-first-and-the-value-leaves-member-role-second.md
  - supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql
  - supabase/migrations/20261105210000_mir21b_writers_write_membership.sql
  - supabase/migrations/20261107230000_mir16b_is_org_admin.sql
  - supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql
  - supabase/migrations/20261107120000_mir21d_writers_stop_writing_team_id.sql
  - supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/220-roster-team-from-membership.test.sql
  - supabase/tests/290-member-role-helper.test.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/100-mock-parity.test.sql
  - supabase/tests/300-org-admin-rename.test.sql
  - src/lib/data/supabase.ts
  - tests/org-admin-role-mapping.test.ts
  - tests/member-rpc-roster-team.test.ts
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql` | created | the roster-team-role read helpers, `membership_make_primary`'s role source, and the `may_decide(uuid)` retirement | §4.1 |
| `supabase/tests/310-manager-read-from-membership.test.sql` | created | pgTAP coverage of AC-1 to AC-7 | §4.2 |
| `supabase/tests/010-catalogue.test.sql` | modified | the security-definer census drops `may_decide(uuid)` and gains `member_roster_team_role(uuid)` | §4.3 |
| `supabase/tests/100-mock-parity.test.sql` | modified | removed the SQL-side `may_decide` parity assertion and its `plan()` count; the JSON's `may_decide` field is unchanged (the mock's predicate) | §4.3 |
| `supabase/tests/300-org-admin-rename.test.sql` | modified | removed AC-7's three `may_decide` assertions (the function it tested is retired) and its `plan()` count | §4.3 |
| `src/lib/data/supabase.ts` | modified | `MEMBER_COLUMNS`/`MemberRow` carry `team_role`, and `appRole` maps the application's one role per person from the roster team role instead of `fromDbRole` alone | §4.4 |
| `tests/org-admin-role-mapping.test.ts` | modified | renamed the stale "uses fromDbRole(" case to match `toMember`'s new statement, and added the three AC-8 cases for `appRole` | §4.5 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 `member_roster_team_role(uuid)` | `20261108090000_mir16c_manager_read_from_membership.sql:17-28` | verbatim from the plan |
| §4.1 `roster_team_role(public.member)` | `20261108090000_mir16c_manager_read_from_membership.sql:30-35` | verbatim from the plan |
| §4.1 `membership_make_primary` re-created | `20261108090000_mir16c_manager_read_from_membership.sql:42-77` | `v_role` read from the member's current active primary row's `team_role` before that row closes, else `'member'` |
| §4.1 `may_decide(uuid)` dropped | `20261108090000_mir16c_manager_read_from_membership.sql:83` | no `cascade`; confirmed below that nothing but the two test files called it |
| §4.2 pgTAP, one `plan(n)`, AC-1 to AC-7 | `supabase/tests/310-manager-read-from-membership.test.sql` | `plan(25)`, 25 assertions, counted and verified against the file |
| §4.3 `010-catalogue.test.sql` census | `supabase/tests/010-catalogue.test.sql:41-44` (removal), `:56-59` (addition) | `roster_team_role(public.member)` is invoker and not `prosecdef`, so it is not added to this census (the file's own rule, confirmed by reading `:30-80` before editing) |
| §4.3 `100-mock-parity.test.sql` | `supabase/tests/100-mock-parity.test.sql:8-15` (header), `:100` (`plan(108)`), `:210` (assertion removed) | the JSON's `may_decide` field is unchanged, per plan |
| §4.3 `300-org-admin-rename.test.sql` | `supabase/tests/300-org-admin-rename.test.sql:4-7` (header), `:11` (`plan(17)`), AC-7 section removed | |
| §4.4 member seam | `src/lib/data/supabase.ts:968-971` (`appRole`), `:976-988` (`MemberRow`), `:1000` (`MEMBER_COLUMNS`), `:1008` (`toMember`) | `fromDbRole`, `toDbRole` and `setRankThroughRpc` unchanged, as the plan specified |
| §4.5 vitest | `tests/org-admin-role-mapping.test.ts:22-25`, `:51-70` | renamed one case, added three |

## Deviations from the design

`none`. One pre-implementation check the plan asked for (§4.1, before writing): `select p.proname from
pg_proc p where p.pronamespace = 'public'::regnamespace and p.prosrc ~ 'may_decide\('`. No live
database is reachable from this session, so the check was done by reading the source tree instead: a
text search for the literal `may_decide(` across `supabase/` found it only in the two test files this
ticket also edits (`100-mock-parity.test.sql`, `300-org-admin-rename.test.sql`) and in comments; the
one production call site, `entry_update_manager`'s original body in
`20261103120000_mir13_write_path_org_bound.sql:822`, was superseded by MIR-16-b's
`entry_update_manager` (`20261107230000_mir16b_is_org_admin.sql:693-698`), which calls
`may_decide_entry`, not `may_decide`. This is recorded here rather than treated as equivalent to the
plan's live-database query, since this session had no database to run it against.

## Invariants

`invariants_touched: []`. No entry rule, absence count or window changes.

| ID | Still holds because |
|----|---------------------|
| INV-04 | `membership_make_primary` writes `joined_at`/`left_at` exactly as before (verbatim close-then-open, or verbatim insert); only the source of the `team_role` value written to the new or promoted row changed, from `member.role` to the closing primary row's `team_role`. No window's start or end moved. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 52 files, 1038 tests, all pass |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS, 6 changed files (git's count at that point), all within `allowed_paths` |
| `node scripts/check-carry.mjs MIR-16-c` | 0 | PASS — nothing stray, 7 carried paths |
| `git diff --name-only` subset of `allowed_paths` | yes | 5 modified + 2 untracked, all listed in `01-plan.md` §7 |

The pgTAP files (`310-manager-read-from-membership.test.sql` and the three edited files) were not run
against a live Postgres instance — none is reachable from this session (confirmed no `supabase`/`psql`
process is available; RULE-09 also makes applying a migration to a hosted project human-only). Their
correctness was checked by hand against the schema read in `inputs_read` above: the fixture's
`tests.*` helpers, `tests.seed()`'s rows, and every function body the assertions exercise. This is
named here rather than claimed as a passing run.

## Testability contract

Not produced for this ticket. Plan §2b: no screen changes, no layout, and `.ai/standards/testing-standards.md`
records that plan section 8 (the testability contract) and check R7 are retired with the QA stage
(ADR-022). The selector contract does not apply: this ticket touches no component.

## Open questions

None. The one judgment call — verifying by source read rather than by a live `may_decide\(` query,
because no database was reachable from this session — is recorded under Deviations above rather than
as an open question, since it does not block the gate: the source-read result is unambiguous (only the
two test files this ticket already edits called the retired function).
