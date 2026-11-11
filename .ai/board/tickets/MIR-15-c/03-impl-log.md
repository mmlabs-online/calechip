---
ticket: MIR-15-c
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-11T07:30:00Z
inputs_read:
  - .ai/board/tickets/MIR-15-c/01-plan.md
  - .ai/board/tickets/MIR-15-c/ticket.yaml
  - .ai/registry/decisions/ADR-093-a-system-admin-moves-one-team-out-of-org-public-and-every-link-to-a-person-who-stays-is-cut.md
  - supabase/migrations/20261009150000_evt07_guest_registration.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/tests/_isolation.psql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-15-c — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261111120000_mir15c_move_team_to_org.sql` | created | The nineteen keys deferrable, `list_shared_teams`, `move_team_to_org`, the two guard clauses, grants. | § 4.1 items 1 to 5 |
| `supabase/tests/350-move-team-to-org.test.sql` | created | pgTAP for AC-1 to AC-16, the nineteen-constraint check and the guard-did-not-widen check. | § 4.2 |
| `supabase/tests/010-catalogue.test.sql` | modified | The two RPCs added to the definer census under the MIR-15-c comment. | § 4.3 |
| `src/lib/data/system.ts` | modified | `SharedTeam`, `MoveTeamInput`, `TeamMoveSummary`, `MoveFailureCode`, `MoveResult`, `MOVE_FAILURE_MESSAGES`, two `SystemSeam` functions in both implementations. | § 4.4, § 5 |
| `src/system/main.tsx` | modified | `SharedTeams` and `MoveTeamForm`, rendered by `OrgManagement` between Orgs and National holidays. | § 4.5, § 2b |
| `tests/e2e/mir-15-c-move-team.spec.ts` | created | AC-17, AC-18, AC-19 against the mock build. | § 4.6 |

`ADR-093` is in `allowed_paths` and already existed from PLAN; it is not touched. `03-impl-log.md` is
this file.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 item 1 | migration section 1 | Nineteen statements, exactly as written. |
| 4.1 item 2 | migration `list_shared_teams` (line 60) | Columns qualified; `stable`, definer. |
| 4.1 item 3 | migration `move_team_to_org` (line 90) | Steps 1 to 14 in the plan's order, commented by number. |
| 4.1 item 4 | migration lines 372 and 470 | Both bodies copied from evt07 lines 92-181 and 192-255; one clause inserted first. |
| 4.1 item 5 | migration section 5 | |
| 4.2 | `supabase/tests/350-move-team-to-org.test.sql` | 89 assertions. |
| 4.3 | `supabase/tests/010-catalogue.test.sql` | |
| 4.4 | `src/lib/data/system.ts:212` (types), `:512`, `:523` (Supabase), `:787`, `:1047`, `:1055` (mock) | |
| 4.5 | `src/system/main.tsx:829` (`MoveTeamForm`), `:925` (`SharedTeams`), `:1194` (render) | |
| 4.6 | `tests/e2e/mir-15-c-move-team.spec.ts` | |

## Deviations from the design

None in what the code does. Three points where the plan's wording and the schema differ, resolved
without changing behaviour:

- **`role_in_team` (AC-8) is `team_role` in the schema.** The test reads `membership.team_role`. No
  code names either.
- **Step 6 uses `coalesce(e.team_id = p_team_id, false)`** rather than the bare comparison. An event
  with a null `team_id` would otherwise compare as `null is distinct from false` and refuse a move
  for an event that belongs to nobody on the team. Same for the event "side" in step 10.
- **Step 8 loops with a `record`** and collects two arrays, which step 11 joins with `unnest`, so
  the home-team rule is written once and used for both the `MT004` check and the re-point.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The count keeps its one definition over the membership rows that exist. The only rows deleted are ended rows that join a mover to a team that stays or a stayer to the moved team (step 10); nothing else about a window is written. Matches ADR-093 Consequences. |
| `INV-07` | Each entry still has exactly one owner. Only `primary_team_id` (step 11) and `org_id` (step 12) are written, and `primary_team_id` decides no count. |
| `INV-02` | `entry_enforce_decision` fires on every moved entry, but none of its substantive or decision columns changes; `350` asserts status, deciders, reason and every other column are unchanged for the three movers' entries, including an approved, a pending and a rejected one. |
| INV-01, 03, 05, 06 | Not reached: no date, portion, status or reason is written. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 54 files, 1063 tests |
| `pnpm exec playwright test` on the five panel specs (15-b, 15-c, 16, 18, 18-b) | 0 | 31 passed. The full suite was not run. |
| `node scripts/check-allowed-paths.mjs` | 0 | |
| `git diff --name-only` subset of `allowed_paths` | yes | plus three untracked new files, all listed |

**The database half was run, but not with `pnpm db:test`.** There is no Docker or Supabase CLI in this
environment. I built a throwaway PostgreSQL 16 cluster, stubbed `auth`, `storage`, `net`, `vault` and
the roles, applied all 69 migrations in order (including this one) with no error, and applied this one
a second time (idempotent). I ran `350-move-team-to-org.test.sql` against it through a minimal local
stand-in for the pgTAP functions it uses (`plan`, `ok`, `is`, `isnt`, `lives_ok`, `throws_ok`,
`results_eq`, `finish`): **89 of 89 assertions passed.** The stand-in compares `results_eq` rows by
text, not by type, so a column-type mismatch there would pass locally and fail under real pgTAP. I
checked the compared column types by hand (text, uuid, boolean, date, integer; `numeric` against the
same column of a copy). **`010-catalogue.test.sql` was not run** — its `set_eq` is not in the
stand-in; the two new census entries are the only change. The throwaway cluster is deleted. A real
`pnpm db:test` run is the reviewer's R-check and remains owed.

## Testability contract

The plan's § 4.5 table, every `data-testid` in `src/system/main.tsx`:

| selector | Exists at |
|----------|-----------|
| `system-teams` | `:1017` |
| `system-teams-loading` | `:963` |
| `system-teams-error`, `system-teams-retry` | `:953`, `:956` |
| `system-teams-empty` | `:969` |
| `system-teams-list` | `:975` |
| `system-team-row` (`data-team-id`) | `:988` |
| `system-team-name`, `system-team-members` | `:989`, `:992` |
| `system-team-move` | `:997` |
| `system-move-form` | `:866` |
| `system-move-target` | `:874` |
| `system-move-no-target` | `:890` |
| `system-move-submit`, `system-move-cancel` | `:904`, `:911` |
| `system-move-error` | `:916` |
| `system-move-done` | `:1022` |

## Open questions

- **AC-20 is asserted by reading `MoveTeamForm`**, as the plan says: the select lists
  `orgs.filter(!isSharedTenant)`; with none, `system-move-no-target` shows `Create an org first.` and
  **Move team** is disabled (`disabled={busy || !chosen}`). While the org list is still loading the
  form says `Loading orgs…` instead, which the plan does not specify; it only avoids showing "create an
  org first" before the answer is known.
- **The pgTAP fixture switches `event_attendance_guard` off for one insert.** Since MIR-15, Org public's
  guard refuses Bob attending Tam's event, so the cross-team attendance rows AC-5 cuts cannot be made
  through it. The fixture does what a pre-MIR-15 row looks like by disabling the trigger around that
  insert only, then enabling it. It needs table ownership, which the Supabase test runner has.
- The plan's `size_estimate` M held.
