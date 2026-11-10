---
ticket: MIR-14
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-03T17:31:50+07:00
inputs_read:
  - .ai/board/tickets/MIR-14/01-plan.md
  - .ai/board/tickets/MIR-14/03-impl-log.md
  - .ai/board/tickets/MIR-14/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-073-one-decider-on-any-of-the-owners-teams-decides-a-multi-team-entry.md
  - .ai/standards/rbac-and-security.md
  - supabase/migrations/20261103210000_mir14_multi_team_decisions.sql
  - supabase/tests/170-multi-team-decisions.test.sql
  - supabase/tests/010-catalogue.test.sql
  - src/lib/roles.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - tests/manager-role.test.ts
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
| R1 | **Committed:** `git diff --name-only origin/main...HEAD` minus the ticket folder, the three ship-owned paths and the ticket's own promoting idea file is a subset of `allowed_paths` — `node scripts/check-allowed-paths.mjs` exits 0 (ADR-041, ADR-054). **Uncommitted:** `node scripts/check-carry.mjs <ID>` exits 0 (ADR-043) | PASS | `.ai/board/tickets/MIR-14/ticket.yaml:16-27` — `node scripts/check-allowed-paths.mjs` exited 0 (`allowed-paths: ticket MIR-14, 14 changed file(s) ... allowed-paths: PASS`); `node scripts/check-carry.mjs MIR-14` exited 0 (`check-carry: ticket MIR-14, 0 uncommitted path(s) / check-carry: PASS — nothing stray`) |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm typecheck` (`tsc --noEmit`) exited 0 with 0 errors |
| R3 | lint exit 0 on the changed lintable files (ADR-041) | PASS | `pnpm lint` (`eslint .`) exited 0 with 0 errors across the repository |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/lib/roles.ts:14` imports only `@/lib/domain/types`; all datastore and mock state changes live inside `src/lib/data/mock.ts:1371-1472` and `src/lib/data/supabase.ts:1499-1500` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:28-316`, `supabase/tests/170-multi-team-decisions.test.sql:1-411`, `supabase/tests/010-catalogue.test.sql:56-88`, `src/lib/roles.ts:56-57`, `src/lib/data/mock.ts:1371-1472`, `src/lib/data/supabase.ts:1499-1500`, `tests/manager-role.test.ts:160-262` (`pnpm test` exited 0: 49 files, 999 tests passed) |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:36-45` (columns ungranted on wire), `:60-81` (`may_decide_entry`), `:90-105` (`entry_update_manager`, `entry_select_decider`), `:183-236` (clauses (a), (a1), (a2)); `.ai/standards/rbac-and-security.md:19`, `:53`, `:275-277`, `:331`, `:344-345` |
| R7 | No invariant violated (RULE-07) | PASS | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:102-105`, `:128-135`, `:260-310`; `src/lib/data/mock.ts:1450-1465`, `:2294-2303` |
| R8 | No dependency added without an ADR | PASS | `package.json:1-46` — `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty; no dependency added or modified |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 Columns `rejected_by`, `rejected_at`, `self_approved` + `entry_rejected_by_org_fk` (idempotent, no backfill noted in header) | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:18-21`, `:36-45` | Yes — exact types, defaults, and composite FK `(rejected_by, org_id) references public.member (id, org_id) on delete restrict` |
| § 4.1 Helper `public.may_decide_entry(p_uid uuid, p_owner uuid) returns boolean` + grants | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:60-81` | Yes — `language sql stable security definer set search_path = ''`, revoked from `public, anon`, granted to `authenticated` |
| § 4.1 Policy `entry_update_manager` rewritten + `entry_select_decider` added | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:90-105` | Yes — `entry_update_manager` uses `not public.is_admin((select auth.uid())) and public.may_decide_entry(...)`; `entry_select_decider` uses `public.may_decide_entry((select auth.uid()), member_id)` |
| § 4.1 `public.entry_apply_approval_setting()` `security definer` with `bool_or` across `member_team_ids` | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:119-149` | Yes — `security definer set search_path = ''`, clears `self_approved`, `rejected_by`, `rejected_at` on auto-approve, revoked from `public, anon` |
| § 4.1 `public.entry_enforce_decision()` clauses (a), (a1), (a2), (b), (c) | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:156-314` | Yes — (a) calls `may_decide_entry`; (a1) refuses non-admin when `old.status = 'rejected'` and `old.rejected_by is distinct from v_uid` with 42501; (a2) masks the three new columns; (b) records `self_approved`, `rejected_by`, `rejected_at`; (c) resets all three on substantive edits |
| § 4.2 pgTAP `supabase/tests/170-multi-team-decisions.test.sql` covering AC-1 to AC-20 | `supabase/tests/170-multi-team-decisions.test.sql:13-411` | Yes — `plan(96)` with labelled assertions for every criterion AC-1 through AC-20 |
| § 4.2 Definer census in `supabase/tests/010-catalogue.test.sql` | `supabase/tests/010-catalogue.test.sql:56-57`, `:86-87` | Yes — adds `'public.may_decide_entry(uuid,uuid)'` and `'public.entry_apply_approval_setting()'` |
| § 4.3 `mayDecideEntriesOf(me: Member, ownerId: string): boolean` in `src/lib/roles.ts` | `src/lib/roles.ts:56-57` | Yes — keeps second parameter, returns `me.status === "approved" && me.removedAt === null && mayDecide(me.role)` |
| § 4.3 Mock `rejectedByOf`, `applyDecision`, `updateEntry` reset, and `rejectEntries` batch guard | `src/lib/data/mock.ts:1410-1465`, `:2302`, `:3234-3246` | Yes — module-private `Map<string, string>`, refuses overturning another's rejection with `entry_decision_not_permitted`, clears on leaving `rejected` or INV-02 substantive edit, refuses whole batch in `rejectEntries` if any moving row fails |
| § 4.4 `DECISION_REFUSED` sentence in both `mock.ts` and `supabase.ts` | `src/lib/data/mock.ts:1371-1372`, `src/lib/data/supabase.ts:1499-1500` | Yes — identical literal string matching § 4.4 verbatim, tested in `tests/manager-role.test.ts:199-261` |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| `INV-02` | `public.entry_enforce_decision()` clause (c) runs last on `BEFORE UPDATE` and resets `status` to `'pending'`, nulling `approved_by`, `approved_at`, `rejection_reason`, `rejected_by`, `rejected_at`, and setting `self_approved := false` whenever `start_date`, `end_date`, `type`, `portion`, or `tentative` changes on a non-pending entry while leaving `note`-only edits untouched; reproduced in the mock seam's `updateEntry` which also deletes the `rejectedByOf` entry. | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:297-310`, `src/lib/data/mock.ts:2287-2303`, `supabase/tests/170-multi-team-decisions.test.sql:323-352` |
| `INV-03` | The table constraint `entry_rejection_reason_iff_rejected` is untouched, `reject_entries` keeps its non-empty `btrim` guard, and `public.entry_enforce_decision()` clause (b) nulls `rejection_reason` on every transition out of `'rejected'` while keeping the non-empty reason and updating `rejected_by`/`rejected_at` when rewriting a rejection reason. | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:260-284`, `src/lib/data/mock.ts:1450-1465`, `supabase/tests/170-multi-team-decisions.test.sql:177-188` |
| `INV-07` | An entry's teams are derived from `public.member_team_ids(owner)` for both `entry_apply_approval_setting()` (`bool_or` across all active teams of the owner) and `may_decide_entry(p_uid, p_owner)`. `entry_select_decider` admits rows to a decider without widening `entry_select_team` or `member_select_team`, and `absenceCountsFor` filters by the team's roster (`src/lib/data/absence.ts:135-144`), so no absence count is altered by decider visibility. | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:60-76`, `:102-105`, `:128-135`, `supabase/tests/170-multi-team-decisions.test.sql:205-215` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS` — all eight checks R1 through R8 pass. The ticket advances to `DONE`.
