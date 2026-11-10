---
ticket: MIR-16-f
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-08T01:41:03Z
inputs_read: [ .ai/board/tickets/MIR-16-f/01-plan.md, .ai/board/tickets/MIR-16-f/03-impl-log.md, .ai/board/tickets/MIR-16-f/ticket.yaml, .ai/registry/invariants.md, .ai/templates/review-report.md, "git diff origin/main...HEAD", supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql ]
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

# MIR-16-f — review, pass 2 (after rework 1)

The session was new. The verify commands were run here, one per call. The working tree was clean
(`git status --porcelain` printed nothing), so the subject is `git diff origin/main...HEAD`: 14 files.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed ⊆ `allowed_paths`, uncommitted carried | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-16-f, 14 changed file(s) … allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-16-f` → `0 uncommitted path(s) … PASS — nothing stray`. The non-ticket paths in the diff are exactly `ticket.yaml:20-28` plus `.ai/board/backlog.md` (ship-owned) |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm lint` (`eslint .`) exit 0, no output, repo-wide. That covers `src/lib/data/supabase.ts` and `tests/org-admin-role-mapping.test.ts` |
| R4 | Data-access seam (RULE-02) | PASS | The only application change is inside the seam, at `src/lib/data/supabase.ts:1240-1243`. `tests/org-admin-role-mapping.test.ts:75-83` reads source and imports no datastore client. The seam lint rule passed under R3 |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail. The previous pass's finding is fixed: `supabase/tests/320-set-member-role-team-role.test.sql:166` captures `(\S+)` after `set role =`, and `:171` counts any capture not starting `'org_admin'`. That counts `p_role`, the pre-ticket shape (`20261107235000_…sql:109`) |
| R6 | Permission gating matches § 3 | PASS | `20261108150000_mir16f_…sql:30-38` keeps the org-admin guard and the `org_admin` refusal, word for word with `20261107235000_…sql:98-106`. `:42-52` keeps the five predicates of `:112-116` and the single `42501` of `:120-122`. All of it is server-side inside the `security definer` body (`:24`). `create or replace` with the same signature (`:22`) keeps the grants. pgTAP `320…:127,134,142,146` cover the four refusals |
| R7 | No invariant violated (RULE-07) | PASS | `invariants_touched: []` (`ticket.yaml:18`). Reasoning by invariant is in R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD` lists no `package.json` and no `pnpm-lock.yaml`. The changes are SQL and TS only (`src/lib/data/supabase.ts:1240-1243`, `tests/org-admin-role-mapping.test.ts:75-83`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 migration, `begin … commit` | `supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql:20,79` | yes |
| § 4.1 `create or replace set_member_role(uuid, public.member_role) returns public.member`, definer, `search_path = ''` | `…mir16f…sql:22-24` | yes. Same signature as `20261107235000_…sql:89-93` |
| § 4.1 guards and predicates as a `select … into v_row` (no write to `member`) | `…mir16f…sql:30-52` | yes, verbatim with plan `01-plan.md:169-191` |
| § 4.1 `v_to` mapping, `v_from` read from the primary row | `…mir16f…sql:54-59` | yes |
| § 4.1 `if v_from is distinct from v_to`: update `team_role, updated_at`, then insert `member_role_change` | `…mir16f…sql:62-73` | yes |
| § 4.1 header cites ADR-086 d1, says `member.role` is no longer written, and says legacy rows are MIR-16-g's | `…mir16f…sql:1-14` | yes |
| § 4.2 pgTAP file, `plan(23)` on `tests.seed()`, Una on `team_u`, pending entry for `member_t2` | `supabase/tests/320-set-member-role-team-role.test.sql:15-33` | yes |
| § 4.2 AC-1 | `320…:38-52` | yes |
| § 4.2 AC-2, audit count and row content | `320…:57-64` | yes |
| § 4.2 AC-3, legacy manager to member, audit, `member.role` untouched | `320…:69-89` | yes |
| § 4.2 AC-4, md5 membership digest and audit count before and after | `320…:94-113` | yes |
| § 4.2 AC-5, four refusals, no audit or membership change | `320…:118-154` | yes |
| § 4.2 AC-6, regex admits only `org_admin` | `320…:164-174` | yes. Fixed in rework 1 |
| § 4.2 AC-7, Thanh approves through `entry_update_manager` | `320…:179-185` | yes |
| § 4.3 070 control reads `member_roster_team_role` | `supabase/tests/070-definer-callers.test.sql:134-135` | yes. `plan(73)` is unchanged |
| § 4.3 230 AC-5 asserts `member.role` stays `member` | `supabase/tests/230-writers-write-membership.test.sql:314-316` | yes. `plan(84)` is unchanged |
| § 4.4 seam returns `{ ...toMember(data), role }`, rpc and select unchanged | `src/lib/data/supabase.ts:1232-1235,1240-1243` | yes. `role: MemberRole` is the parameter at `:1227` |
| § 4.5 vitest AC-8 | `tests/org-admin-role-mapping.test.ts:75-83` | yes |

Run here: `pnpm test` gives 52 files and 1040 tests passed. `pnpm exec supabase db reset --local`
then `pnpm exec supabase test db --local supabase/tests` gives `320-…` ok, `070-…` ok and `230-…` ok.

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml:18`). Each registered invariant was still checked against
the diff (`.ai/registry/invariants.md:33-39`):

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | The diff writes no `entry` row. The migration writes only `membership.team_role`, `membership.updated_at` and `member_role_change` | `…mir16f…sql:63-72` |
| INV-02 approval does not survive an edit | No entry edit path is touched. AC-7's approval goes through the existing policy | `…mir16f…sql:63-72`; `320…:180-181` |
| INV-03 rejection reason | No reject path is touched | `…mir16f…sql:63-72` |
| INV-04 one absence count, team windows | The update's `set` list is `team_role, updated_at` only. `joined_at` and `left_at` are not written, and `left_at` is only a filter | `…mir16f…sql:63-65` |
| INV-05 tentative counts | No count, view or entry column is touched | `…mir16f…sql:63-72` |
| INV-06 one portion | No entry column is touched | `…mir16f…sql:63-72` |
| INV-07 one member, every team | No membership row is inserted or ended. The update filters to the existing active primary row | `…mir16f…sql:63-65` |

Every one of these is held by the server-side function body. None depends on a UI affordance.

## Findings

None that gate.

**For a human, as an `OPS-nnn` chore, not part of this gate.** The full local pgTAP suite fails one
assertion: `supabase/tests/170-multi-team-decisions.test.sql:215`, test 42, *"AC-20: admin_u does
not select E"*, have 1, want 0. MIR-16-f did not cause it:

- That file's only `set_member_role` call is at `:382`, after `:215`.
- `supabase/tests/_isolation.psql` never calls `set_member_role`.
- The migration replaces only `set_member_role` (`…mir16f…sql:22`).

The file is outside `allowed_paths`, so no loop role on this ticket can fix it.

## Verdict

PASS. MIR-16-f advances to DONE.
