---
ticket: MIR-21
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-05T10:15:00Z
inputs_read:
  - .ai/board/tickets/MIR-21/01-plan.md
  - .ai/board/tickets/MIR-21/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/templates/impl-log.md
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/160-read-path-org-bound.test.sql
  - src/lib/data/supabase.ts
  - tests/roster-excludes-signups.test.ts
consulted:
  - with: tech-lead-design
    asked: "§ 4.4's listMembers filter change breaks tests/roster-excludes-signups.test.ts:67-69, which pins the old string and is outside allowed_paths. Can allowed_paths gain it?"
    answer: "Yes. allowed_paths gains the file, for the :67-69 regex and title only, citing ADR-077. § 4.4, § 7 and the Changelog amended; ticket.yaml matched; 11 paths, size M, gate unchanged."
    resulted_in_amendment: true
  - with: tech-lead-design
    asked: "check-allowed-paths and check-carry fail on the deleted ADR-076 side of the PLAN renumber, because allowed_paths lists only ADR-077. Add the ADR-076 path?"
    answer: "Yes. allowed_paths gains the ADR-076 path as the deleted side of the renumber, deletion only, no writes. § 7, Changelog and ticket.yaml amended; 12 paths, size M, gate unchanged."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-21 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql` | created | the helper, the computed field, and the three policies and three read functions moved off `member.team_id` | § 4.1, § 4.2, § 4.3 |
| `supabase/tests/220-roster-team-from-membership.test.sql` | created | one assertion block per AC-1 to AC-8 and AC-10, with fixtures made through today's writers | § 4.5 |
| `supabase/tests/010-catalogue.test.sql` | modified | the definer census gains `member_roster_team_id(uuid)`; without it AC-12 fails, as it did on the first run | § 4.6 |
| `src/lib/data/supabase.ts` | modified | `MEMBER_COLUMNS` selects `team_id:roster_team_id`, three filters name `roster_team_id`, `listAllMembers` selects `MEMBER_COLUMNS`, and the three comments are updated | § 4.4 |
| `tests/roster-excludes-signups.test.ts` | modified | its source-text regex pinned `.not("team_id", …)`, so it moves with § 4.4's filter. Added to `allowed_paths` by consultation 1 | § 4.4 (amended) |
| `.ai/board/tickets/MIR-21/99-questions.md` | created | the two consultations above | — |
| `.ai/board/tickets/MIR-21/03-impl-log.md` | created | this file | — |

**Already dirty when IN_PROGRESS began, and not written by this stage:**
- `01-plan.md`, `ticket.yaml`, the four `depends_on` ticket files, `MIR-21-b/ticket.yaml`, and the
  ADR-076 → ADR-077 rename. These come from the PLAN changelog's operator-raised renumber at
  09:53:29Z.
- `tech-lead-design` then amended `01-plan.md` and `ticket.yaml` again during this stage, in
  answer to the consultations.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `member_roster_team_id(uuid)`, definer, grants | migration `:35-49` | body verbatim from the plan; revoked from `public, anon`, granted to `authenticated` |
| 4.1 `roster_team_id(public.member)`, invoker, grants | migration `:53-58` | |
| 4.2 `member_select_team` | migration `:65-68` | |
| 4.2 `member_select_pending_admin` | migration `:70-78` | |
| 4.2 `busy_day_select_team` | migration `:80-86` | |
| 4.3 `list_all_members()` | migration `:92-100` | |
| 4.3 `list_members_for_team(uuid)` | migration `:102-111` | |
| 4.3 `list_member_directory()` | migration `:117-` | select list and join on `member_primary_team_id(m.id)`; clause (b) is `shares_active_team(m.id, auth.uid())`; output column still `team_id` |
| 4.4 `MEMBER_COLUMNS` | `src/lib/data/supabase.ts:983-984` | |
| 4.4 `listPendingMembers` | `src/lib/data/supabase.ts:1671` | |
| 4.4 `countPendingMembers` | `src/lib/data/supabase.ts:3400` | |
| 4.4 `listMembers` | `src/lib/data/supabase.ts:1754` | |
| 4.4 `listAllMembers` gains `.select(MEMBER_COLUMNS)` | `src/lib/data/supabase.ts:2437-2441` | |
| 4.4 comments | `:1657-1659`, `:1741-1744`, `:3390` | they now name `roster_team_id` and ADR-077; the reasoning is unchanged |
| 4.5 pgTAP 220 | `supabase/tests/220-roster-team-from-membership.test.sql` | 27 assertions. AC-1 runs over every row, the seed's included |
| 4.6 catalogue | `supabase/tests/010-catalogue.test.sql:56-57` | |

## Deviations from the design

- **`tests/roster-excludes-signups.test.ts` is edited.** The plan as first written did not list it.
  Consultation 1 authorised it, and § 4.4 and § 7 were amended before the edit.
- **§ 4.5 fixtures: A and K are inserted directly**, the way `tests.seed()` inserts every member. M,
  R, V, P and J go through `admit_member`, `move_member`, `reject_member` and the removal update. An
  admin cannot be created through any writer without an admin already existing.
- **AC-9's "same `Member` values against the fixtures"** is shown at the SQL level: AC-3, AC-5 and
  AC-6 read the same predicates the seam sends. It is not shown through PostgREST (see Open
  questions 1).

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The roster and busy days that feed the count still include removed members on their old team. `member_roster_team_id` returns the team of the row their removal closed (migration `:42`). 220 AC-3 sees R on M's roster and AC-4 sees R's busy day. A mutant that used `member_primary_team_id` alone failed AC-1, AC-2, AC-3, AC-4 and AC-6: six assertions (tests 2, 3, 7, 8, 10, 15). The caller side is still `member_primary_team_id(auth.uid())`, so the count stays one team's (ADR-072 decision 1) |
| `INV-07` | These reads have one source, `membership`, and stay single-valued: one row per member, on the active primary row (`order by … limit 1`). 220 AC-1 shows the answer equals `member.team_id` on every row, the seed's 12 members included. 160's K, who has a non-primary row on a second team, is unchanged |

## Verification run

There is no Docker, so `pnpm db:test` cannot start the Supabase stack (as in MIR-13-b and MIR-18-b).
The database suite ran on a scratch Homebrew PostgreSQL 17.11 cluster with pgTAP:
- the Supabase roles and the `auth`, `storage`, `vault` and `net` schemas were stubbed;
- `create extension pg_net` was skipped;
- `extensions` was put on the search path;
- every migration was applied in order;
- each test file was run with `psql -f`.

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 50 files, 1010 tests. Before the test edit: 1 failure, `roster-excludes-signups.test.ts:68` |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS. Before consultation 2 it failed on the ADR-076 rename source only |
| `node scripts/check-carry.mjs MIR-21` | 0 | PASS, nothing stray. Before consultation 2 it failed on the same path |
| pgTAP baseline, before the migration | — | 18 files pass. Three fail, and none is in a file this ticket touches: `000` (no `supabase_migrations` schema on the stub), `160` (aborts at `:260` with `invalid input syntax for type json`, 44/49 run), and `170` #42 (`AC-20: admin_u does not select E`) |
| pgTAP after the migration, all 21 files | — | No new failure. The same three fail in the same way; `010` 5/5 with its existing `todo`; `220` 27/27 |
| 220 against a mutant helper (`member_primary_team_id` only) | — | Fails tests 2, 3, 7, 8, 10 and 15, so the file bites |
| Second apply of the migration | 0 | Idempotent (ADR-024) |
| `git diff --name-only` ⊆ `allowed_paths` | yes | Plus this ticket's own files |

## Testability contract

Not applicable. No screen changes (plan § 2b).

## Open questions

1. **§ 4.4's `TODO(verify)` is not verified against a running PostgREST.** That covers the alias
   `team_id:roster_team_id` on a computed field, an `is` filter on a computed field, and
   `.select(...)` with a computed field on a `setof public.member` RPC.
   - There is no Docker for the Supabase stack.
   - A standalone PostgREST binary was downloaded to the session scratchpad. Running it was denied
     by the session's permission policy, so nothing was run.
   - None of the three was *refused*, so § 4.4's stop-and-route condition was not met.
   - CI's `database` and e2e jobs are the first real run.
   - If PostgREST refuses any of the three, it surfaces as a seam error on the roster, the sign-up
     queue or the Members screen. Per § 4.4 it then routes to `tech-lead-design`, and a view or a
     second RPC must not be substituted.
2. **The baseline failures in `160` and `170` on the scratch stub** are present before this
   migration and unchanged after it. They are most likely stub artefacts: MIR-13-b's harness ran
   `160` at 49/49. CI's real run is what decides.
3. **The `removeMember`, `setMemberTeam` and `updateMember` writes return their row through
   `.select(MEMBER_COLUMNS)`**, so their representation now carries the computed field. This rests
   on the same unverified PostgREST behaviour as item 1.
