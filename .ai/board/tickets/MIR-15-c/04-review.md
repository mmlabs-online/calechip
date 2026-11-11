---
ticket: MIR-15-c
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-11T07:32:40Z
inputs_read:
  - .ai/board/tickets/MIR-15-c/01-plan.md
  - .ai/board/tickets/MIR-15-c/03-impl-log.md
  - .ai/board/tickets/MIR-15-c/ticket.yaml
  - git diff origin/main...HEAD (bec0134)
  - .ai/registry/invariants.md
  - supabase/migrations/20261009150000_evt07_guest_registration.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/migrations/20261103210000_mir14_multi_team_decisions.sql
  - supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql
  - supabase/tests/_isolation.psql
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

# MIR-15-c — review

Branch `feat/MIR-15-c` at `bec0134`, tree clean (`git status --porcelain` empty). Every verify command
below was run by this reviewer; none is taken from `03-impl-log.md`.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-15-c, 11 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-15-c` → `0 uncommitted path(s)` … `PASS — nothing stray`. The 11 = the 7 `allowed_paths` + the ticket folder's 3 files + `.ai/board/backlog.md` (SHIP_OWNED). |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output. |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`) exit 0, no output — repo-wide, so no out-of-diff error either. |
| R4 | No datastore access outside the seam (RULE-02) | PASS | `src/system/main.tsx:22` imports only from `@/lib/data/system`; the two new calls go through the seam at `src/system/main.tsx:935` (`systemSeam.listSharedTeams()`) and in `MoveTeamForm` (`systemSeam.moveTeamToOrg`). The `rpc` calls live only in `src/lib/data/system.ts:512-536`. Enforced by `no-restricted-imports` on `@supabase/*` (`eslint.config.js:64-69`), which R3 ran clean. |
| R5 | Every § 4 contract item implemented | PASS | Detail below. |
| R6 | Permission gating matches § 3 | PASS | `42501` before any row read: `supabase/migrations/20261111120000_mir15c_move_team_to_org.sql:69-71` (list), `:107-109` (move). Grants `:547-550` — revoked from `public, anon`, executable by `authenticated`. Guard clause grants nothing: `authenticated` still holds `update (status)` only, and the bypass requires every column but `org_id` to be equal (`:378-383`, `:476-481`). Seam mock mirrors the gate (`src/lib/data/system.ts:1048`, `:1056`). pgTAP 350 assertions 2-12 (Tam, an org admin of Org public, Sam at `aal1` all `42501`; `anon` holds no EXECUTE) passed under real pgTAP. |
| R7 | No invariant violated | PASS | Per-ID detail below. |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD --stat -- package.json pnpm-lock.yaml` is empty; the only new import is `FIXTURE_OTHER_TEAM`, `FIXTURE_OTHER_TEAM_MEMBER`, `FIXTURE_TEAM` from the in-repo `@/lib/fixtures` (`src/lib/data/system.ts:17-24`). |

### The database half — run by this reviewer

`pnpm db:test` cannot run here (no Docker daemon). Because `verification_required: true`, the database
half was not taken from the impl log. **Real pgTAP** (`postgresql-16-pgtap`) was installed into a
throwaway PostgreSQL 16.15 cluster with a minimal Supabase stand-in (roles, `auth.uid()/jwt()`,
`auth.users`, `storage`, `net`, `vault`; `pg_net` line stubbed):

- All 69 migrations applied in order, exit 0; the MIR-15-c migration re-applied a second time, exit 0
  (ADR-024 idempotence).
- `350-move-team-to-org.test.sql`: plan `1..89`, **89 ok, 0 not ok**.
- `010-catalogue.test.sql`: plan `1..5`, the definer census (ok 2) passes with the two new entries
  (`supabase/tests/010-catalogue.test.sql:80-82`); `not ok 3` is the pre-existing `# TODO MIR-06 F-1`.
- **Regression check:** the whole suite was run against this database and against a second one built
  from the same migrations **minus** this ticket's. Identical outside 350/010: every file passes on
  both, except `000-harness` (needs the CLI's `supabase_migrations` table — harness artefact) and
  `170-multi-team-decisions` `not ok 42`, which fails **identically on the baseline without this
  migration**, so it is not caused by MIR-15-c. In particular `120-composite-fks` (92/92) still passes
  with the nineteen keys deferrable.
- The cluster was deleted afterwards.

Also run: `pnpm test` (vitest) — 54 files, 1063 tests, exit 0; `pnpm exec playwright test
tests/e2e/mir-15-c-move-team.spec.ts tests/e2e/mir-18-b-org-management.spec.ts` — 10 passed.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 item 1 — nineteen keys `deferrable initially immediate` | `supabase/migrations/20261111120000_mir15c_move_team_to_org.sql:35-53` | Yes — the nineteen statements verbatim; pgTAP 350 ok 1 checks `condeferrable`/`condeferred` on all nineteen. Cross-checked against every `*_org_fk` in `20261027120000_mir11_composite_foreign_keys.sql` and `entry_rejected_by_org_fk` (`20261103210000_mir14_multi_team_decisions.sql:43`): 19 of 19. |
| § 4.1 item 2 — `list_shared_teams()` | `…mir15c….sql:60-84` | Yes — `returns table (id, name, active_members integer, created_at)`, `stable security definer set search_path = ''`, qualified columns, `order by t.name, t.id`. |
| § 4.1 item 3 — `move_team_to_org(uuid, uuid)` steps 1-14 | `…mir15c….sql:90-362`: gate `:107`; locks `:112-119`; 22023 `:122-128`; movers `:132-150`; MT001 `:153-164`; MT002 `:167-175`; MT003 `:178-190`; home team / MT004 `:194-226`; defer `:229-240`; cut `:244-279`; re-point `:283-294`; move `:297-343`; immediate `:346-357`; return `:360` | Yes. Two wording deviations, both declared in the impl log and both behaviour-preserving: `coalesce(e.team_id = p_team_id, false)` (`:171`, `:251`, `:260`, `:269`) so a null-team event does not compare as null; step 8 as a loop collecting arrays reused by step 11 (`:291`). |
| § 4.1 item 4 — two guard clauses | `…mir15c….sql:372-468` (`event_guest_guard`), `:470-540` (`event_attendance_guard`) | Yes — `diff` of each body against `20261009150000_evt07_guest_registration.sql:92-181` and `:192-255` shows only the inserted seven-line clause. No later migration redefines either guard (only `is_event_audience` is re-created, in mir13 and mir15), so evt07 is the latest body and nothing is regressed. pgTAP 350 ok 40-41: a disallowed status change still meets `invalid_attendance_change`. |
| § 4.1 item 5 — privileges | `…mir15c….sql:547-550` | Yes. |
| § 4.2 — pgTAP 350 | `supabase/tests/350-move-team-to-org.test.sql` (`plan(89)`) | Yes — AC-1…AC-16, the constraint check (ok 1) and the guard check (ok 40-41); 89/89 under real pgTAP. |
| § 4.3 — census | `supabase/tests/010-catalogue.test.sql:80-82` | Yes — comment and both signatures. |
| § 4.4 — seam types and `MOVE_FAILURE_MESSAGES` | `src/lib/data/system.ts:216-262` | Yes — `SharedTeam`, `MoveTeamInput`, `TeamMoveSummary`, `MoveFailureCode`, `MoveResult<T>` and the eight messages match the plan character for character. |
| § 4.4 — `SystemSeam` members | `src/lib/data/system.ts:74`, `:76` | Yes. |
| § 4.4 — Supabase implementation | `src/lib/data/system.ts:512-536`; row types, `toSharedTeam`, `moveFailureCode` (SQLSTATE map) and `moveDetail` (`error.details` → `detail`) after it | Yes. `moveDetail` is a private helper the plan's prose implies ("puts PostgREST's `error.details` … into `detail`"). |
| § 4.4 — mock implementation | `mockSharedTeams` (`src/lib/data/system.ts` beside `mockOrgs`, after `:783`); `listSharedTeams` `:1047-1053`; `moveTeamToOrg` `:1055-1067` | Yes — gate, `move_target_missing`, `invalid_move`, `member_on_other_team` with `FIXTURE_OTHER_TEAM_MEMBER.displayName`, splice, `deletedLinks: 0`. |
| § 4.5 — `SharedTeams`, `MoveTeamForm`, placement | `src/system/main.tsx:829` (`MoveTeamForm`), `:925` (`SharedTeams`), `:1194` (rendered between the Orgs section and `<NationalHolidays />`) | Yes — every `data-testid` of the § 4.5 table present; success text exactly `Moved ${team.name} to ${chosen.name} — ${movedMembers} members, ${deletedLinks} links removed.`; alert `role="alert"` with `In the way: ${detail}` only when non-null; list re-reads after success. |
| § 2 AC-20 — read from the component | `src/system/main.tsx:947` (targets = `!org.isSharedTenant`), `:890` (`Create an org first.`), `:907` (`disabled={busy \|\| !chosen}`) | Yes. The extra `Loading orgs…` line while `orgs === null` is outside the contract and changes no specified behaviour. |
| § 4.6 — e2e | `tests/e2e/mir-15-c-move-team.spec.ts:34` (AC-17), `:42` (AC-18), `:55` (AC-19) | Yes — 3/3 passed in this review. |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| `INV-04` | The invariant is "the **uniqueness** of the definition, not the formula" (`.ai/registry/invariants.md:110-113`). The diff adds no computation of the count anywhere: no file under `src/lib/domain/` or `src/lib/data/absence.ts` (where `absenceCountsFor` lives, `src/lib/data/absence.ts:197`) is touched, and no SQL count function is created. The one definition still runs over the `membership` rows that exist. The only membership rows deleted are ended rows whose member and team would land in different orgs (`…mir15c….sql:274-277`); such a row cannot exist after the move under ADR-070's composite key `membership_team_org_fk`/`membership_member_org_fk`, and the entries those windows covered move to the other org with their member (`:309-311`), so no stayer's window and no stayer's entry changes. Rex's closed row on T, which stays on the moved side, is kept (pgTAP 350 ok 74). | `src/lib/data/absence.ts:197`; `supabase/migrations/20261111120000_mir15c_move_team_to_org.sql:274-277`, `:305-311` |
| `INV-07` | Each entry still belongs to exactly one member: no statement writes `entry.member_id` — the only entry writes are `primary_team_id` (`:283-294`) and `org_id` (`:309-311`). The count is taken over membership, not `primary_team_id`, so the re-point changes no team an entry is counted against. A mover's entries all go with the member (`:309-311`), so none is left in an org its owner is not in. | `supabase/migrations/20261111120000_mir15c_move_team_to_org.sql:283-294`, `:309-311` |
| `INV-02` | `entry_enforce_decision` still fires on every moved entry. Its substantive-edit clause returns an approved entry to `pending` only when `start_date`, `end_date`, `type`, `portion` or `tentative` change (`supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:297-302`); the move names only `primary_team_id` and `org_id` (`…mir15c….sql:284`, `:310`), neither of which is in that list. The trigger function itself is not touched by the diff. Held in the database, not the UI: pgTAP 350 ok 66-69 assert the approved entry stays approved by Tam, the rejected entry keeps its decider and reason, and status/deciders/dates/type/portion/note are unchanged for all three movers. | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:297-302`; `supabase/migrations/20261111120000_mir15c_move_team_to_org.sql:283-311` |

Not in `invariants_touched` and not reached: INV-01, INV-03, INV-05, INV-06 — no date, portion, status
or reason column is written by any statement of `move_team_to_org` (`…mir15c….sql:283-343`).

## Findings

None.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | — | — | — |

Not findings against this ticket, recorded so they are not lost:

- `supabase/tests/170-multi-team-decisions.test.sql` assertion 42 (`AC-20: admin_u does not select E`)
  failed in this reviewer's stand-in cluster **with and without** this migration. It may be a property
  of the stand-in (no real Supabase roles/defaults) rather than of the schema; CI's `database` job is
  the authority. If CI also fails it, it is a pre-existing `OPS-nnn` chore, not MIR-15-c's.

## Delegated decisions

None. Nothing in this verdict waited on a decision.

## Verdict

**PASS.** R1-R8 pass, each cited above. `next_state: DONE`.
