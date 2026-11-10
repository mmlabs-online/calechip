---
ticket: MIR-21-f
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-07T07:44:30Z
inputs_read:
  - .ai/board/tickets/MIR-21-f/01-plan.md
  - .ai/board/tickets/MIR-21-f/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - supabase/migrations/20261020120000_mir02_member_self_writes.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql
  - supabase/migrations/20261105210000_mir21b_writers_write_membership.sql
  - supabase/migrations/20261107120000_mir21d_writers_stop_writing_team_id.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/070-definer-callers.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/170-multi-team-decisions.test.sql
  - supabase/tests/260-writers-stop-writing-team-id.test.sql
  - src/lib/data/supabase.ts
consulted:
  - with: tech-lead-design
    asked: "070-definer-callers.test.sql:117 filters list_members_for_team (setof public.member) rows by team_id; it passes before the drop and aborts after it. Add it to allowed_paths with the filter read from member_roster_team_id?"
    answer: "Agreed. 01-plan.md § 4.12 added; 070 added to § 7 and ticket.yaml allowed_paths (12 paths, size M). Only line 117's query string changes; plan(73) stays."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-21-f — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql` | created | the drop: policy, self-lock clause, mirror INSERT branch and event, `stamp_org_id`'s team lookup, `member_team_id(uuid)`, index, column — in dependency order, no `cascade` | §4.1 |
| `supabase/tests/270-member-team-id-dropped.test.sql` | created | AC-1 to AC-10, 28 assertions | §4.2 |
| `supabase/tests/010-catalogue.test.sql` | modified | the census named a function that no longer exists | §4.3 |
| `supabase/tests/040-member-self-writes.test.sql` | modified | the `update … set team_id` probe targets a dropped column; `plan(29)`→`plan(26)`; header comment "seven"→"six" refusals | §4.5 |
| `supabase/tests/070-definer-callers.test.sql` | modified | its `team_id` filter on `list_members_for_team` rows broke with the column; reads `member_roster_team_id(id)` instead | §4.12 (added by consultation) |
| `supabase/tests/100-mock-parity.test.sql` | modified | fixture writes `membership` via `put_on_team`; `has_team` reads `member_primary_team_id`; `undefined_column` counts as a refusal; case table byte-identical | §4.4 |
| `supabase/tests/110-schema-cleanup.test.sql` | modified | AC-1 asserted the index exists; now asserts it is dropped | §4.6 |
| `supabase/tests/160-read-path-org-bound.test.sql` | modified | M2/P2 fixtures and AC-9 updates stop naming `team_id`; AC-1 asserts the helper is dropped | §4.7 |
| `supabase/tests/230-writers-write-membership.test.sql` | modified | AC-10 asserted the trigger's INSERT event, which this ticket removes | §4.8 |
| `supabase/tests/240-org-public-holidays.test.sql` | modified | Dora/Dan inserted with `org_id`, membership written by `put_on_team`; header comment updated | §4.9 |
| `.ai/standards/data-model.md` | modified | documents the column as dropped, keeping the old text in italics | §4.10 |
| `.ai/standards/rbac-and-security.md` | modified | documents `member_decide_admin` as dropped and the helper rename | §4.11 |
| `.ai/board/tickets/MIR-21-f/99-questions.md` | created | the consultation on 070 (board file, not code) | — |

`01-plan.md` and `ticket.yaml` were amended by `tech-lead-design` during the consultation, not by me.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 step 1 | `20261107180000_mir21f_drop_member_team_id.sql:27` | |
| 4.1 step 2 | same file `:37`, clause at `:53-58` | Built by script from `mir02…sql:45-151` (the plan said `:45-150`; line 151 is the closing `$$;`). `diff` against the source shows only the planned changes: one comment line swapped, the `team_id` condition line removed |
| 4.1 step 3 | same file `:151-170` | verbatim from plan § 4.1 |
| 4.1 step 4 | same file `:178-218`, arm at `:201-204` | from `mir13…sql:178-218`; `diff` shows only the `when 'member'` arm changed |
| 4.1 steps 5, 6 | same file `:225`, `:231-232` | |
| 4.2 | `270-member-team-id-dropped.test.sql` | `plan(28)`; AC-8 runs last (`:193`) because it removes M, whom AC-9 and AC-10 need active |
| 4.3 | `010-catalogue.test.sql` (line removed) | `plan(5)` unchanged |
| 4.4 | `100-mock-parity.test.sql:9`, `:129`, `:180`, `:206` | `$parity$` block compared byte-for-byte before and after by the edit script; marker still appears exactly twice |
| 4.5 | `040-member-self-writes.test.sql:5` | |
| 4.6 | `110-schema-cleanup.test.sql:8` | |
| 4.7 | `160-read-path-org-bound.test.sql:45-50`, `:84`, `:268`, `:273` | |
| 4.8 | `230-writers-write-membership.test.sql:104-105` | |
| 4.9 | `240-org-public-holidays.test.sql:8`, `:80-84` | |
| 4.10 | `data-model.md:39`, `:43`, `:51`, `:375` | |
| 4.11 | `rbac-and-security.md:163-165`, `:189-190` | |
| 4.12 | `070-definer-callers.test.sql:117` | |

## Deviations from the design

- **070 was added to scope** (consultation above; plan § 4.12). The plan's sweep missed that
  `list_members_for_team` returns `setof public.member`, so a test filtering its rows by `team_id`
  breaks. The seam is unaffected: it selects `team_id:roster_team_id`, a computed field.
- **040's header comment** "The seven refusals" became "The six refusals", to match the deleted probe.
  Not in § 4.5; one word, same file.
- **270 orders AC-8 after AC-9 and AC-10** (see above). Every AC from the plan is asserted.

## Invariants

| ID | Still holds because |
|----|---------------------|
| INV-04 | The removal branch that writes `left_at = greatest(removed_at, joined_at)` is copied verbatim, and its trigger still fires on `update of removed_at`. 270 AC-8 asserts the T1 row is closed on the removal day and the roster team still reads T1. |
| INV-07 | After the drop `membership` is the only record of a member's teams. Nothing can read a second one. `stamp_org_id`'s `entry` arm still takes `primary_team_id` from `member_primary_team_id`, which reads `membership`. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 51 files, 1026 tests. Includes `tests/mock-sql-parity.test.ts`, unchanged |
| `pnpm db:test` | 1 | 28 files, 1197 tests. **One failure: `170-multi-team-decisions.test.sql` test 42**, which was already failing before this ticket (see Open questions). Every file this ticket touches passes, 270 included |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-carry.mjs MIR-21-f` | 0 | PASS, nothing stray |

Baseline runs on the local stack with this ticket's migration moved aside: `070` PASS and
`170` FAIL (test 42). With the migration applied, `070` failed until the § 4.12 change, then
passed. `170` fails the same way either way.

## Testability contract

No selectors: the ticket has no UI.

## Open questions

- **`170-multi-team-decisions.test.sql` test 42** (`AC-20: admin_u does not select E`, have 1, want 0)
  fails on this branch both without and with this ticket's migration. This ticket did not cause it and
  does not touch it. AC-11 ("every test passes") therefore cannot be fully met in this ticket. The
  reviewer or `/ship` should record it in `.ai/board/model-debt.md`, or hand it to whichever ticket
  owns that read path. My guess is that a later read policy let an admin of the other team select the
  entry. I did not investigate that.
- The plan's § 1 prose chores (comments naming `member_team_id` and `member_decide_admin` in `src/`,
  `150:157-160`, `create-account.sql:21`) are untouched, as planned.

## Delegated decisions

- Ordered 270's AC-8 last, so that the removal does not invalidate the "Given" of AC-9 and AC-10.
- AC-6's `results_eq` orders by `status::text` rather than `display_name`, so the order does not depend
  on collation.
