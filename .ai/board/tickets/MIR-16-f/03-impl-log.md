---
ticket: MIR-16-f
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-08T08:40:00Z
inputs_read:
  - .ai/board/tickets/MIR-16-f/01-plan.md
  - .ai/board/tickets/MIR-16-f/ticket.yaml
  - .ai/registry/decisions/ADR-086-set-member-role-writes-the-team-role-and-the-manager-value-is-removed-by-a-column-retype.md
  - .ai/board/tickets/MIR-16-g/ticket.yaml
  - .ai/board/tickets/MIR-17/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql
  - supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql
  - supabase/migrations/20261020150000_mir03_bounded_role_changes.sql
  - supabase/migrations/20261103210000_mir14_multi_team_decisions.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/070-definer-callers.test.sql
  - supabase/tests/230-writers-write-membership.test.sql
  - supabase/tests/250-membership-self-lock.test.sql
  - supabase/tests/300-org-admin-rename.test.sql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/170-multi-team-decisions.test.sql
  - src/lib/data/supabase.ts
  - tests/org-admin-role-mapping.test.ts
  - .ai/board/tickets/MIR-16-f/04-review.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Rework 1 — response to `04-review.md` (FAIL, R5, routed here)

The reviewer found that `320-set-member-role-team-role.test.sql`'s AC-6 assertion extracted only
quoted literals (`'([a-z_]+)'`), so it could never see a non-literal assignment such as
`set role = p_role` — the pre-ticket `set_member_role`'s exact shape — and would therefore pass
against the function this ticket replaces. Finding 1, routed to developer, implementable.

**Fix**, in `320-set-member-role-team-role.test.sql` only: the AC-6 query now captures whatever
token immediately follows `set\s+role\s*=\s*` (`(\S+)`, not just a quoted literal), and asserts that
every captured token starts with the literal `'org_admin'`. That catches both a quoted literal
naming some other role and a bare identifier/parameter, which is what plan §4.2 asks for ("a regex
that admits only `org_admin` as the assigned value"). Re-run locally after a full `supabase db
reset --local`: `320` still passes 23/23, and `070`/`230` are unaffected (not touched this round).
No other file changed in this rework cycle — `03-impl-log.md`'s "Deviations: none" from the first
pass still stands; this was a defect in the test's own regex, not a deviation from the design.

The review's second note (recorded for a human, not part of the gate) pointed out this log
previously said `170-multi-team-decisions.test.sql` "does not call `set_member_role` … anywhere",
which is wrong — it does, at `:382`, after the unrelated failing assertion at `:215`. Corrected below.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql` | created | re-creates `set_member_role` so it writes `membership.team_role` and its own `member_role_change` audit row, and no longer writes `member.role` | §4.1 |
| `supabase/tests/320-set-member-role-team-role.test.sql` | created, then modified in rework 1 | pgTAP for AC-1 to AC-7 against the re-created function, plus the extra fixture (Una on Team U, a pending entry for `member_t2`) the design specified; AC-6's regex fixed in rework 1 to also catch a non-literal assignment | §4.2 |
| `supabase/tests/070-definer-callers.test.sql` | modified | the AC-13 control at :134-135 now reads `member_roster_team_role`, since `set_member_role` no longer writes `member.role` | §4.3 |
| `supabase/tests/230-writers-write-membership.test.sql` | modified | the AC-5 assertion at :314-315 now asserts the returned `member.role` stays `member` after a promotion to manager | §4.3 |
| `src/lib/data/supabase.ts` | modified | `setRankThroughRpc`'s success return now overrides `role` with the requested rank, since the computed field over the returned row may read the statement's starting snapshot (ADR-086 decision 3) | §4.4 |
| `tests/org-admin-role-mapping.test.ts` | modified | added the AC-8 case asserting `setRankThroughRpc`'s body contains the override | §4.5 |

No other file was touched. `.ai/registry/decisions/ADR-086-...md`, `.ai/board/tickets/MIR-16-g/ticket.yaml` and `.ai/board/tickets/MIR-17/ticket.yaml` are in `allowed_paths` but were already written and committed by `tech-lead-design` at `/plan`; nothing in plan section 4 asked this stage to change them further, and `git status` showed them clean before this stage started, so they are listed here only for completeness and carry no diff from this stage.

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 migration | `supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql` | Copied verbatim from the design's SQL block; same signature, `create or replace`, grants kept (ADR-024) |
| §4.2 pgTAP | `supabase/tests/320-set-member-role-team-role.test.sql` | `plan(23)`; AC-1 to AC-7 against the database, run on `tests.seed()` plus the two-part extra fixture (Una on Team U; one pending entry for `member_t2`) |
| §4.2 AC-6 (rework 1 fix) | `320-set-member-role-team-role.test.sql:159-172` | Now captures the token after `set role =` (`\S+`), literal or identifier, and checks it starts with `'org_admin'`; catches `set role = p_role`, which the first-pass literal-only regex missed |
| §4.3 changed pgTAP (070) | `supabase/tests/070-definer-callers.test.sql:134-135` | Control now reads `member_roster_team_role`; `plan(73)` unchanged |
| §4.3 changed pgTAP (230) | `supabase/tests/230-writers-write-membership.test.sql:314-315` | AC-5 now asserts `member.role` stays `member`; `plan(84)` unchanged |
| §4.4 member seam | `src/lib/data/supabase.ts` `setRankThroughRpc` | Success return is `{ ...toMember(data), role }` |
| §4.5 vitest | `tests/org-admin-role-mapping.test.ts` | New `describe` block, one `it` for AC-8 |

AC-8 is observed against the member seam's source (01-plan.md § 2), which is what the new vitest case does; it is not exercised in pgTAP.

## Deviations from the design

`none`. The migration body, the two changed pgTAP assertions, and the seam change were implemented
exactly as the design's SQL and TypeScript fragments specify. The new pgTAP file's extra fixture (a
new fixture id function, Una's insert, the pending entry) was not given literal SQL by the design —
only the shape in prose (§4.2) — so the specific uuid prefix and the exact assertions are this
stage's own construction from that prose, following the id-helper convention already used by
`250-membership-self-lock.test.sql` (`tests.m21c`) and `170-multi-team-decisions.test.sql`
(`tests.m14`). No field name, permission or invariant was invented; every value asserted comes from
`01-plan.md` §2's acceptance criteria text.

## Invariants

| ID | Still holds because |
|----|---------------------|
| (none — `invariants_touched: []`) | `set_member_role` still writes only `membership.team_role` and `updated_at`, as before. INV-04's windows (`membership.joined_at`, `left_at`) are untouched by this migration; the new pgTAP file's AC-4 and AC-5 assertions confirm no membership row changes on a no-op or a refusal. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | re-run in rework 1; no TS file changed this round |
| `pnpm exec eslint .` | 0 | re-run in rework 1 |
| `pnpm exec vitest run` | 0 | 52 files, 1040 tests, all pass; re-run in rework 1 |
| `node scripts/check-allowed-paths.mjs` | 0 | rework 1: 14 changed files (13 already committed at the prior `/advance`, this cycle's own edit uncommitted), all within `allowed_paths` |
| `node scripts/check-carry.mjs MIR-16-f` | 0 | rework 1: 1 uncommitted path (`320-set-member-role-team-role.test.sql`), carried from `allowed_paths` |
| `git diff --name-only` subset of `allowed_paths` | yes | confirmed by the two checks above |
| `pnpm exec supabase db reset --local` then `pnpm exec supabase test db --local supabase/tests` | — | local-only pgTAP run against the real migrations (not one of the four mandatory commands, run anyway since a local project was available — see Open questions). Re-run after the AC-6 fix: `320-set-member-role-team-role.test.sql` passes 23/23; `070` and `230` still pass in full; the only suite-wide failure is the pre-existing, unrelated `170` AC-20 (see Open questions). |

## Testability contract

Not applicable. ADR-022 retired the QA stage and plan section 8/testability contract with it; this
ticket's `01-plan.md` carries no plan section 6 selector list (it is a schema-only change with no
screen, per §2b).

## Open questions

- **`TODO(verify)` from 01-plan.md §2, resolved.** Against the local project, `member_roster_team_role`
  on the row `set_member_role` returns DOES see the `team_role` the same call just wrote (the AC-1
  and AC-3 pgTAP assertions, which call `set_member_role` and then separately read
  `member_roster_team_role` in the next statement, both pass; and the function is `stable`, scoped to
  one statement's snapshot, so the *same* statement's own write is visible to it). This does not
  change §4.4: the seam still overrides `role` with the requested rank rather than relying on this,
  because the computed field is read by a *different* statement — the `.select(...)` that follows the
  `.rpc(...)` call — and ADR-086's own reasoning is about a later statement's snapshot, not this one.
- **Pre-existing failure, unrelated to this ticket, outside `allowed_paths` — confirmed by the
  reviewer too.** The full local pgTAP suite (`supabase/tests/`, every file, not just the ones this
  ticket may touch) has one unrelated failure both before and after rework 1:
  `170-multi-team-decisions.test.sql` test 42, AC-20 "admin_u does not select E" — the row is
  selected (count 1) where the test expects 0, at `:215`. **Correction to this log's first pass**:
  that file DOES call `set_member_role`, at `:382` — the reviewer caught that this log previously
  said it did not. The call at `:382` runs after the failing assertion at `:215` and is on a
  different entry; it is not what AC-20 reads, and `20261108150000_mir16f_…sql` changes no object
  `may_decide_entry`, `is_admin`, `shares_active_team` or any `entry_select_*` policy depends on, so
  the failure is unrelated to this ticket's migration. `04-review.md` reached the same conclusion and
  recorded it as an OPS chore for a human (ADR-041 shape), not part of the R5 gate. Not fixed here:
  `170-...test.sql` is not in `allowed_paths`, and nothing in `01-plan.md` §4 names it.
