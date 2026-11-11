---
ticket: MIR-17-f
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-11T08:15:30Z
inputs_read: [ .ai/board/tickets/MIR-17-f/01-plan.md, .ai/board/tickets/MIR-17-f/03-impl-log.md, .ai/board/tickets/MIR-17-f/ticket.yaml, .ai/registry/invariants.md, .ai/01-operating-model.md, "git diff origin/main...HEAD" ]
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

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff within `allowed_paths`; nothing uncommitted stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-17-f, 16 changed file(s)` … `allowed-paths: PASS` (the 16 = the 12 `allowed_paths` minus the ADR/MIR-17-g/MIR-20 files written at PLAN, plus the ticket folder and `.ai/board/backlog.md`, SHIP_OWNED); `node scripts/check-carry.mjs MIR-17-f` → `0 uncommitted path(s)` / `PASS — nothing stray`. `allowed_paths` at `.ai/board/tickets/MIR-17-f/ticket.yaml:17-29` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output, run by this reviewer |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`) exit 0, no output — repo-wide, so the changed files are covered and nothing outside the diff errors |
| R4 | No datastore access outside the seam (RULE-02) | PASS | The two new reads are in the seam only: `src/lib/data/supabase.ts:2514-2543`, `src/lib/data/mock.ts:1794-1806`, declared at `src/lib/data/index.ts:819`, `:827`. `src/lib/roles.ts:14` imports only domain types; `src/lib/viewed-team.ts:27` imports only `@/lib/roles`; `src/routes/MemberList.tsx:169-170` calls `seam.*`. No `@supabase`/`createClient` import in any changed non-seam file (grep empty). Lint (which carries the boundary rule) exit 0 |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches plan § 3 | PASS | `administersRow` `src/lib/roles.ts:78-79` = org admin ∧ not self ∧ row's roster team ∈ caller's active teams — the bound in `member_update_admin` (`supabase/migrations/20261107230000_mir16b_is_org_admin.sql:787-795`), `promote_member_to_admin` (`20261107235000_mir16e_rename_admin_to_org_admin.sql:67`) and `set_member_role` (`20261108200000_mir16h_member_role_drops_manager.sql:114`, `:130`). Denials: non-admin → `NO_ROSTER_SCOPE` `src/routes/MemberList.tsx:172-175` and `mayAdminister(me.role)` false at `roles.ts:79`; self excluded `roles.ts:79`; unread roster role → no toggle `roles.ts:100`, `MemberList.tsx:652`. Picker `viewed-team.ts:62`, `:86`. Reads grant only what § 3 says: `list_all_members` is the admin roster (`20261105150000_mir21_reads_off_member_team_id.sql:92`), `member_team_ids` asked for the caller's own uid only (`supabase.ts:2534-2538`) |
| R7 | No invariant violated | PASS | See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD --stat -- package.json pnpm-lock.yaml` is empty; no new import outside `@/` in the diff (`roles.ts:14`, `viewed-team.ts:27`, `MemberList.tsx:23-34`) |

Verify runs (this reviewer): `pnpm test` → `Test Files 55 passed (55)`, `Tests 1077 passed (1077)`, exit 0.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `TeamRole` | `src/lib/domain/types.ts:24` | yes |
| § 4.1 `RosterTeamRole` | `src/lib/domain/types.ts:28-31` | yes; no existing type changed |
| § 4.2 `DataSeam.listRosterTeamRoles()` | `src/lib/data/index.ts:819`, import `:30` | yes, `Promise<RosterTeamRole[]>` |
| § 4.2 `DataSeam.listOwnTeamIds()` | `src/lib/data/index.ts:827` | yes, `Promise<string[]>` |
| § 4.2 `ROSTER_TEAM_ROLE_COLUMNS`, `RosterTeamRoleRow` | `src/lib/data/supabase.ts:1019-1024` | yes, `"id, team_role:roster_team_role"` |
| § 4.2 `toTeamId` (fails closed on a third shape) | `src/lib/data/supabase.ts:1029-1038` | yes |
| § 4.2 supabase `listRosterTeamRoles` (limit, truncation throw, null filtered) | `src/lib/data/supabase.ts:2514-2530` | yes |
| § 4.2 supabase `listOwnTeamIds` (no session → `[]`, `rpc("member_team_ids", { p_uid })`) | `src/lib/data/supabase.ts:2533-2542`; param name matches `20261103120000_mir13_write_path_org_bound.sql:43` | yes |
| § 4.2 mock `listRosterTeamRoles` | `src/lib/data/mock.ts:1794-1799` | yes |
| § 4.2 mock `listOwnTeamIds` | `src/lib/data/mock.ts:1802-1806` | yes |
| § 4.3 `RosterScope`, `NO_ROSTER_SCOPE` | `src/lib/roles.ts:68-74` | yes |
| § 4.3 `administersRow` | `src/lib/roles.ts:78-79` | yes |
| § 4.3 `mayRemoveMember` / `mayPromoteMember` / `maySetManager` | `src/lib/roles.ts:85-86`, `:92-93`, `:99-100` | yes, each with ADR-005 docblock naming its control |
| § 4.3 `managerToggleFor` | `src/lib/roles.ts:103-108` | yes |
| § 4.4 imports | `src/routes/MemberList.tsx:23-34` | yes |
| § 4.4 `View.ready.scope` | `src/routes/MemberList.tsx:96` | yes |
| § 4.4 `isAdmin = mayAdminister(me.role)` | `src/routes/MemberList.tsx:161` | yes |
| § 4.4 four reads inside the `try`, scope built, non-admin `NO_ROSTER_SCOPE` | `src/routes/MemberList.tsx:164-176`; catch `:177` → `member-list-unavailable` `:331` | yes |
| § 4.4 `onSetManager(member, teamRole)` writes `managerToggleFor(teamRole).next` | `src/routes/MemberList.tsx:225`, `:233` | yes |
| § 4.4 three predicates delegate | `src/routes/MemberList.tsx:369`, `:370`, `:376` | yes |
| § 4.4 intro sentence | `src/routes/MemberList.tsx:434` | yes |
| § 4.4 toggle from `scope.teamRoles.get`, `data-role={teamRole}`, label from helper | `src/routes/MemberList.tsx:523`, `:652`, `:655`, `:659`, `:663` | yes; block-bodied map is the impl log's stated liberty and is implied by the plan row |
| § 4.5 picker | `src/lib/viewed-team.ts:27`, `:47`, `:62`, `:83`, `:86` | yes |
| § 4.6 `role-guards.test.ts` FILES + title | `tests/role-guards.test.ts:34-36`, `:42` | yes |
| § 4.6 `member-list-scope.test.ts`, one describe per AC-1…AC-5 | `tests/member-list-scope.test.ts:49`, `:57`, `:77`, `:96`, `:109` | yes |

## R7 detail

`invariants_touched` is `[]` (`.ai/board/tickets/MIR-17-f/ticket.yaml:16`). The plan names two invariants this screen sits near; each is reasoned individually.

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 (`.ai/registry/invariants.md:36`) — one definition of the absence count | The roster each role reads is the same call as before (`listAllMembers` for an admin, `listMembers` otherwise); the two new reads feed only the three affordance predicates and the toggle label, never a count. No count function, view or SQL is in the diff | `src/routes/MemberList.tsx:167`; consumers of the new reads only at `src/lib/roles.ts:78-100` and `src/routes/MemberList.tsx:523` |
| INV-07 (`.ai/registry/invariants.md:39`) — every entry belongs to exactly one member, counted against every team | No entry read or write path is in the diff: the changed source files are the roster screen, the role helpers, the picker and two read-only seam functions. Nothing in the diff writes `entry` or membership | `src/lib/data/supabase.ts:2514-2542` and `src/lib/data/mock.ts:1794-1806` are reads only; `onSetManager` writes `setMemberRole` (`src/routes/MemberList.tsx:231-234`), a team-rank write, not an entry |

Neither invariant is held by a UI affordance: the database controls cited under R6 are unchanged by this ticket (no migration in the diff).

## Findings

None.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

The impl log's carried `TODO(verify)` (PostgREST's body shape for `member_team_ids`, `src/lib/data/supabase.ts:1026-1028`) is the plan's own open question and fails closed; it is not a defect of this diff.

## Verdict

`PASS`. MIR-17-f advances to DONE.
