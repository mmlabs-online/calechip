---
ticket: MIR-14
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-03T10:18:12Z
inputs_read:
  - .ai/board/tickets/MIR-14/01-plan.md
  - .ai/board/tickets/MIR-14/ticket.yaml
  - .ai/registry/decisions/ADR-073-one-decider-on-any-of-the-owners-teams-decides-a-multi-team-entry.md
  - .ai/standards/testing-standards.md
  - .ai/standards/rbac-and-security.md
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260903143000_cal02_own_entry_writes.sql
  - supabase/migrations/20260905230000_adm06_reject_entries.sql
  - supabase/migrations/20260911170000_solo_approval_settings.sql
  - supabase/migrations/20260913120000_solo_manager_decision_generated_columns.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/160-read-path-org-bound.test.sql
  - src/lib/roles.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - tests/manager-role.test.ts
  - tests/bulk-rejection.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-14 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql` | created | The whole database half: three columns + FK, `may_decide_entry`, two policies, the definer approval trigger, the amended decision trigger | § 4.1 |
| `supabase/tests/170-multi-team-decisions.test.sql` | created | pgTAP for AC-1 to AC-20, each assertion labelled `AC-n` | § 4.2 |
| `supabase/tests/010-catalogue.test.sql` | modified | The definer census fails on any unclassified definer function; two are added | § 4.2 |
| `src/lib/roles.ts` | modified | `mayDecideEntriesOf` drops the own-entry clause (ADR-073 decision 3) | § 4.3 |
| `src/lib/data/mock.ts` | modified | Own-entry refusal gone; clause (a1) reproduced with `rejectedByOf`; new sentence | § 4.3, § 4.4 |
| `src/lib/data/supabase.ts` | modified | `DECISION_REFUSED` text, identical to the mock's | § 4.4 |
| `tests/manager-role.test.ts` | modified | ADR-035 item 3 suite rewritten to the reversed rule (AC-21) and AC-22 added | § 7 |
| `.ai/standards/rbac-and-security.md` | modified | Manager permission cell, `manager` rank line, known weakness 4, A10 rejection half, MIR-14 paragraph marked done | § 7 |
| `.ai/board/tickets/MIR-14/03-impl-log.md` | created | This log | gate |

`tests/bulk-rejection.test.ts` was **not** touched: no case there asserts the manager own-entry
refusal or the old sentence (§ 7 makes it conditional). `ADR-073` and `MIR-14-b/ticket.yaml` were
written at PLAN and needed no change.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 columns + `entry_rejected_by_org_fk` | `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql:36-45` | Verbatim from the plan; no backfill, said in the header (`:18-21`) |
| 4.1 `may_decide_entry` + grants | `…mir14_multi_team_decisions.sql:60-81` | Verbatim |
| 4.1 `entry_update_manager` | `…mir14_multi_team_decisions.sql:90-95` | Verbatim |
| 4.1 `entry_select_decider` | `…mir14_multi_team_decisions.sql:102-105` | Verbatim |
| 4.1 `entry_apply_approval_setting()` definer, OR-ed | `…mir14_multi_team_decisions.sql:119-149` | Verbatim; trigger itself not re-created |
| 4.1 `entry_enforce_decision()` (a) + (a1) | `…mir14_multi_team_decisions.sql:183-207` | Replaces the `may_decide` and own-entry refusals |
| 4.1 (a2) per-team guard, wider mask | `…mir14_multi_team_decisions.sql:227-235` | |
| 4.1 (b) | `…mir14_multi_team_decisions.sql:260-284` | Verbatim branch structure |
| 4.1 (c) clears the three new columns | `…mir14_multi_team_decisions.sql:296-311` | |
| 4.2 pgTAP, AC-1 … AC-20 | `supabase/tests/170-multi-team-decisions.test.sql` | `plan(96)` |
| 4.2 census entries | `supabase/tests/010-catalogue.test.sql:56-57`, `:86-87` | Under `-- MIR-14 helper` / `-- MIR-14 trigger` |
| 4.3 `mayDecideEntriesOf` | `src/lib/roles.ts:55-57` | Second parameter kept, unused, lint-disabled with a reason |
| 4.3 mock `rejectedByOf` + refusal | `src/lib/data/mock.ts:1410-1414`, `:1430-1432`, `:1461-1465` | Set on entry into `rejected` and on a reason change; deleted on leaving `rejected` |
| 4.3 INV-02 reset clears the key | `src/lib/data/mock.ts:2302` | |
| 4.3 `rejectEntries` per-row refusal, whole batch | `src/lib/data/mock.ts:3230-3245` | |
| 4.4 sentence, both seams | `src/lib/data/mock.ts:1371`, `src/lib/data/supabase.ts:1499` | Identical; asserted by `tests/manager-role.test.ts` AC-22 |

## Deviations from the design

none

## Delegated decisions

- **AC-12 "approved_at is unchanged" is asserted as `approved_at = now()`.** pgTAP runs the file in one
  transaction, so `now()` is constant and the first approval's stamp cannot differ from a second one
  inside the file. The assertion still fails if a second approval rewrote the column to anything else,
  but cannot distinguish "rewritten with the same clock". The same limit applies to AC-15's
  "a new `rejected_at`", asserted as non-null. Taken rather than splitting the file into transactions,
  which `_isolation.psql` is not built for.
- **AC-22 on the supabase seam is checked by source, not by a call.** The test asserts
  `src/lib/data/supabase.ts` contains the exact sentence literal; the 42501 → `entry_decision_not_permitted`
  mapping is unchanged and already covered. No supabase-seam harness exists inside `allowed_paths`.
- **The mock's rejected rows with no `rejectedByOf` key** (fixture rows rejected at seed) behave as
  pre-MIR-14 database rows: only an admin may change them. That is the database's behaviour for a null
  `rejected_by`, so the mock follows it. No existing test depended on a manager changing one (999 pass).

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-02` | Clause (c) keeps its condition and still runs last; it now also nulls `rejected_by`, `rejected_at` and `self_approved`, so a substantive edit leaves no decision record of any kind (pgTAP AC-18; mock `updateEntry` deletes the rejecter key). A `note`-only edit still moves nothing (AC-18 second half). |
| `INV-03` | `entry_rejection_reason_iff_rejected` is untouched; every branch of (b) that leaves `rejected` still nulls `rejection_reason`, and a reason rewrite stays a `rejected` row with a non-empty reason — it only moves `rejected_by`/`rejected_at` (AC-15). `reject_entries` keeps its `btrim` refusal. |
| `INV-07` | "Every team that member belongs to" is read as `member_team_ids(owner)` for both the deciders and the approval switches. No count-feeding read changed: `entry_select_team` (primary team, ADR-072) is untouched, and `entry_select_decider` admits only rows the caller may decide; the roster read is unchanged (AC-20). |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 49 files, 999 tests |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-carry.mjs MIR-14` | 0 | PASS — nothing stray |
| `pnpm db:test` | not run | No `supabase` CLI and no `docker` on this machine. The migration and `170-*.test.sql` have **not** been executed against PostgreSQL. CI's `database` job runs the same command. |

## Testability contract

No selector in this slice: the plan adds no UI element (§ 2b). The manager's own rows on `/pending`
gain the existing approve/reject controls through `mayDecideEntriesOf`.

## Open questions

- **The pgTAP file and the migration are unexecuted here** (see the table above). `ticket.yaml` sets
  `verification_required: true`; a passing mock test is not verification. The reviewer should treat
  CI's `database` job as the first execution of both files.
