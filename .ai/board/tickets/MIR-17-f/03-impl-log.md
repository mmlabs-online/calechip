---
ticket: MIR-17-f
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-11T08:20:00Z
inputs_read: [ .ai/board/tickets/MIR-17-f/01-plan.md, .ai/board/tickets/MIR-17-f/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/domain/types.ts` | modified | adds `TeamRole` and `RosterTeamRole` (additive) | §4.1 |
| `src/lib/data/index.ts` | modified | declares `listRosterTeamRoles` and `listOwnTeamIds` in `DataSeam`; imports `RosterTeamRole` | §4.2 |
| `src/lib/data/supabase.ts` | modified | the two reads over `list_all_members` + `roster_team_role` and `member_team_ids`, `toTeamId` | §4.2 |
| `src/lib/data/mock.ts` | modified | mock versions of the two reads (one team per member) | §4.2 |
| `src/lib/roles.ts` | modified | `RosterScope`, `NO_ROSTER_SCOPE`, `mayRemoveMember`, `mayPromoteMember`, `maySetManager`, `managerToggleFor` | §4.3 |
| `src/routes/MemberList.tsx` | modified | scope read for admins, predicates and toggle through the helpers, no literal role compare | §4.4 |
| `src/lib/viewed-team.ts` | modified | the picker's two role tests ask `mayAdminister` | §4.5 |
| `tests/role-guards.test.ts` | modified | AC-8: two files added to `FILES`, title updated | §4.6 |
| `tests/member-list-scope.test.ts` | created | AC-1 to AC-5 | §4.6 |
| `.ai/board/tickets/MIR-17-f/03-impl-log.md` | created | this log | n/a |

The ADR and the MIR-17-g / MIR-20 ticket files in `allowed_paths` were written at PLAN and not touched here.

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| 4.1 | `src/lib/domain/types.ts` after `MemberRole` | as specified |
| 4.2 | `index.ts` after `listAllMembers`; `supabase.ts` after `listAllMembers` and above `toMember`'s neighbour consts; `mock.ts` before `listPendingMembers`' sibling approve block | as specified |
| 4.3 | `src/lib/roles.ts` | as specified |
| 4.4 | `src/routes/MemberList.tsx` | the row map became a block body (`shown.map((member) => { const teamRole = …; return (…); })`) to hold `teamRole` for the toggle |
| 4.5 | `src/lib/viewed-team.ts` | as specified |
| 4.6 | the two test files | as specified |

## Deviations from the design

none. The only liberty is the block-bodied `shown.map` above, which the plan's § 4.4 row implies (`const teamRole = scope.teamRoles.get(member.id)`).

## Invariants

`invariants_touched` is `[]`. INV-04: the roster each role reads is the same call as before; the two new reads feed affordances only. INV-07: no entry path changes.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 55 files, 1077 tests |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS; working-tree changes are all inside `allowed_paths` |

Not run: `tests/e2e/**` (Playwright). AC-6 rests on the mock's `teamRole` equalling `member.role` for member/manager, so labels and `data-role` are unchanged.

## Testability contract

No selector added or renamed. `member-list-row-manager` keeps its id; its `data-role` now comes from the row's roster team role, identical on the mock.

## Open questions

`TODO(verify)` carried from § 4.2: PostgREST's JSON shape for `member_team_ids`; `toTeamId` accepts a bare string or `{ member_team_ids }` and throws otherwise. Needs a provisioned project to confirm.
