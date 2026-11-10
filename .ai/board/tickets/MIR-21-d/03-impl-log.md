---
ticket: MIR-21-d
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-07T04:27:15Z
inputs_read:
  - .ai/board/tickets/MIR-21-d/01-plan.md
  - .ai/board/tickets/MIR-21-d/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - supabase/migrations/20261105210000_mir21b_writers_write_membership.sql
  - supabase/migrations/20261106130000_mir21c_membership_self_lock.sql
  - supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql
  - supabase/create-account.sql
  - supabase/tests/250-membership-self-lock.test.sql
  - supabase/tests/230-writers-write-membership.test.sql
  - supabase/tests/030-member-reads.test.sql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/070-definer-callers.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/150-write-path-org-bound.test.sql
  - supabase/tests/160-read-path-org-bound.test.sql
  - supabase/tests/190-system-admin.test.sql
  - supabase/tests/220-roster-team-from-membership.test.sql
  - supabase/tests/_isolation.psql
  - .ai/board/tickets/MIR-21-c/03-impl-log.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-21-d — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261107120000_mir21d_writers_stop_writing_team_id.sql` | created | `admit_member`, `reject_member`, `move_member` and `set_member_team` re-created without assigning `member.team_id` | § 4.1 |
| `supabase/tests/260-writers-stop-writing-team-id.test.sql` | created | pgTAP for AC-1 to AC-6, 18 assertions | § 4.2 |
| `supabase/create-account.sql` | modified | the approval `update` drops `team_id = v_team`; comment reworded | § 4.3 |
| `supabase/tests/030-member-reads.test.sql` | modified | four expected-set reads of `team_id` become `member_roster_team_id(id)` (`:12`, `:33`/`:34`, `:62`, `:78` after edit) | § 4.4 |
| `supabase/tests/040-member-self-writes.test.sql` | modified | two selected-tuple reads become `member_roster_team_id(id)` | § 4.4 |
| `supabase/tests/070-definer-callers.test.sql` | modified | two reads become `member_roster_team_id(id)` | § 4.4 |
| `supabase/tests/140-org-stamping-and-membership-mirror.test.sql` | modified | `tests.mirror_violations()` and its six `is(…)` retired (`plan(42)` → `plan(36)`); one remaining read of `team_id` becomes the roster team; header stops claiming the mirror | § 4.4 |
| `supabase/tests/150-write-path-org-bound.test.sql` | modified | two reads become `member_roster_team_id(id)` | § 4.4 |
| `supabase/tests/160-read-path-org-bound.test.sql` | modified | two reads become `member_roster_team_id(id)`, plus one more found beyond the table (see Deviations) | § 4.4 |
| `supabase/tests/190-system-admin.test.sql` | modified | one read becomes `member_roster_team_id(m.id)` | § 4.4 |
| `supabase/tests/230-writers-write-membership.test.sql` | modified | `tests.m21b_drift()`'s column-drift disjunct retired, its "on a team" disjunct moves to the roster team; two `results_eq` reads and one `is` read become the roster team; one `s.team_id` read from a returned row becomes `public.roster_team_id(s)`, found beyond the table (see Deviations); header drops the column claim | § 4.4 |
| `.ai/board/tickets/MIR-21-d/03-impl-log.md` | created | this log | gate |

The board and registry paths are not in this ticket's `allowed_paths` (01-plan.md § 7) and are not
touched here; `ticket.yaml`'s `state` transition is `/advance`'s to record.

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `admit_member` | `…mir21d_writers_stop_writing_team_id.sql:23-46` | `update` drops `team_id = p_team_id`; `membership_make_primary` call kept verbatim |
| 4.1 `reject_member` | `…mir21d_writers_stop_writing_team_id.sql:49-65` | `update` drops `team_id = null` |
| 4.1 `move_member` | `…mir21d_writers_stop_writing_team_id.sql:68-93` | the `update` becomes an `if not exists` existence check with the same five predicates and the same raise; `membership_make_primary` call kept |
| 4.1 `set_member_team` | `…mir21d_writers_stop_writing_team_id.sql:97-118` | the `update … returning` becomes a `select … into`; same two predicates, same `if not found` raise, same `return v_row` |
| 4.2 pgTAP | `supabase/tests/260-writers-stop-writing-team-id.test.sql` | AC-1 `:57`, AC-2 `:75`, AC-4 `:90` (run before AC-3 — see Deviations), AC-3 `:111`, AC-5 `:132`, AC-6 `:147`; `plan(18)` |
| 4.3 `create-account.sql` | `supabase/create-account.sql:150-152` | `update` sets `status` only; comment reworded to "the one column `decideMember`'s RPC still writes"; `:21`'s "with a null `team_id`" comment is untouched and stays true |
| 4.4 reads moved to the roster team | see Files touched table | every file in § 4.4's table, plus two reads found beyond it (160, 230 — Deviations) |

## Deviations from the design

- **Two reads of `member.team_id` found beyond § 4.4's table, fixed by the same rule it states.**
  `160-read-path-org-bound.test.sql:92` (`where team_id is not null and team_id <> …`, AC-2's "every
  member row K reads is on T1 or is K's own") and
  `230-writers-write-membership.test.sql:169` (`s.team_id` read off the row `set_member_team` returns,
  AC-12's "returns M on T1") both decide an assertion from the column. Both are now
  `public.member_roster_team_id(id)` and `public.roster_team_id(s)` respectively — the second is the
  row-accepting helper already used the same way in `250-membership-self-lock.test.sql` AC-6 and in
  this ticket's own AC-4. Neither changes `plan(n)` or the assertion's intent. Recorded here per
  01-plan.md § 4.4's "a read the Developer finds beyond this table follows the same rule and is
  listed in `03-impl-log.md`."
- **260's AC-4 block runs before its AC-3 block.** AC-4's "Given" needs M still on T1; AC-3 moves M to
  T2. 230-writers-write-membership.test.sql already reorders its AC blocks to keep each "Given" true
  (its own header comment says so), so the same reordering is used here rather than inventing a
  second M-shaped fixture member.

Everything else: `none`.

## Invariants

`invariants_touched: []` (ticket.yaml). No entry path, count or window changes.

| ID | Still holds because |
|----|---------------------|
| INV-04 | A removed member stops counting via `membership.left_at`, written by the mirror's removal branch (`member_sync_membership`'s `removed_at` clause). This ticket does not touch that trigger or that branch — the four rewritten functions never set `removed_at`, and `move_member`'s existence check still excludes a removed member (`m.removed_at is null`), unchanged from MIR-21-b. `260` does not exercise removal; `140` AC-9's removal step (now unlabelled as AC-9 since `mirror_violations()` is retired, but still run) and `230` AC-8 still pass. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-carry.mjs MIR-21-d` | 0 | PASS, 11 carried paths, nothing stray |
| `pnpm exec tsc --noEmit` | 0 | no TypeScript touched; confirms nothing else broke |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 51 files, 1025 tests |
| `pnpm db:test` | 1 | see below — the one new failure class is accepted by design, the other is a pre-existing baseline |
| `git diff --name-only` subset of `allowed_paths` | yes | plus this ticket's own folder |

**`pnpm db:test` detail.** 27 files, 1175 assertions. Every file this ticket touches is green:
`030`, `040`, `070`, `140`, `150`, `160`, `190`, `230` and the new `260` all report `ok`. Two files
report failures, neither of them this ticket's to fix:

- `170-multi-team-decisions.test.sql` test 42 ("AC-20: admin_u does not select E") — the pre-existing
  baseline failure recorded in `MIR-21-b/03-impl-log.md` and `MIR-21-c/03-impl-log.md`, excepted by
  that story's own AC-9, untouched by this ticket.
- `220-roster-team-from-membership.test.sql` tests 2 and 7 (AC-1 "member_roster_team_id(id) is not
  distinct from team_id on every row", AC-2 "roster_team_id(m) is not distinct from m.team_id on
  every row") — these two assertions are exactly the invariant this ticket's § 4.1 breaks on purpose
  (ADR-080 decision 2: the writers stop keeping the column equal to the roster team). 01-plan.md § 1
  names this file by ticket: *"Also `220` AC-1 and AC-2. All **MIR-21-e** (ADR-080 decision 3)."*
  `220` is not in this ticket's `allowed_paths`; MIR-21-e owns the fix.

No other file's assertion count or pass/fail status changed from the pre-ticket baseline.

## Testability contract

n/a — ADR-022 retired the plan's testability contract (plan section 8) along with QA; there is no
design section 6 for this ticket.

## Open questions

None that block.
