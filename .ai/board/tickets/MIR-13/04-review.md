---
ticket: MIR-13
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-03T04:30:10Z
inputs_read:
  - .ai/board/tickets/MIR-13/01-plan.md
  - .ai/board/tickets/MIR-13/03-impl-log.md
  - .ai/board/tickets/MIR-13/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-071-writers-stamp-org-id-membership-mirrors-member-team-id-and-mir-13-splits-by-operation.md
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/bootstrap.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/120-composite-fks.test.sql
  - supabase/tests/130-backfill-org-public.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/150-write-path-org-bound.test.sql
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
| R1 | **Committed:** `git diff --name-only origin/main...HEAD` minus the ticket folder, the three ship-owned paths and the ticket's own promoting idea file is a subset of `allowed_paths` — `node scripts/check-allowed-paths.mjs` exits 0 (ADR-041, ADR-054). **Uncommitted:** `node scripts/check-carry.mjs MIR-13` exits 0 (ADR-043) | PASS | `.ai/board/tickets/MIR-13/ticket.yaml:16-26`; `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-13, 14 changed file(s) ... allowed-paths: PASS` (exit 0); `node scripts/check-carry.mjs MIR-13` → `check-carry: ticket MIR-13, 0 uncommitted path(s) / check-carry: PASS — nothing stray` (exit 0) |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm typecheck` (`tsc --noEmit`) exited 0 |
| R3 | lint exit 0 on the changed lintable files (ADR-041) | PASS | `pnpm lint` (`eslint .`) exited 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | No files under `src/` touched in `git diff --name-only origin/main...HEAD`; all SQL changes are in `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:1-950`, `supabase/bootstrap.sql:213-217`, and `supabase/tests/*` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:33-948`, `supabase/bootstrap.sql:213-217` (full mapping in `## R5 detail`) |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:95-166,178-255,371-948`; verified in `supabase/tests/140-org-stamping-and-membership-mirror.test.sql:164-307` and `supabase/tests/150-write-path-org-bound.test.sql:53-261` |
| R7 | No invariant violated (RULE-07) | PASS | `INV-02`, `INV-04`, `INV-07` held at `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:143-148,185-191,339-340,799-828` (per-ID reasoning in `## R7 detail`) |
| R8 | No dependency added without an ADR | PASS | `package.json:1-46` and `pnpm-lock.yaml:1-10` untouched in `git diff origin/main...HEAD` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `public.member_org_id(p_uid uuid) returns uuid` + grants | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:33-39,77,81` | Yes |
| § 4.1 `public.member_team_ids(p_uid uuid) returns setof uuid` + grants | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:43-52,78,82` | Yes |
| § 4.1 `public.member_primary_team_id(p_uid uuid) returns uuid` + grants | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:54-64,79,83` | Yes |
| § 4.1 `public.shares_active_team(p_a uuid, p_b uuid) returns boolean` + grants | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:66-73,80,84` | Yes |
| § 4.2 `public.member_sync_membership() returns trigger` + trigger `member_sync_membership` on `public.member` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:95-166` | Yes |
| § 4.3 `public.stamp_org_id() returns trigger` + 12 `<table>_stamp_org_id` `before insert` triggers | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:178-255` | Yes |
| § 4.5.1 MIR-12 idempotent backfill re-run | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:264-320` | Yes |
| § 4.5.2 AC-4 guard (`MIR-13: % entries have no primary team`) | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:324-334` | Yes |
| § 4.5.3 `SET NOT NULL` on 12 `org_id` columns and `entry.primary_team_id` + inline-scan header comment | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:17-19,337-349` | Yes |
| § 4.5.4 `holiday_date_key` dropped and `holiday_org_id_date_key unique (org_id, date)` added | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:353-358` | Yes |
| § 4.4 `create_team(text)` (unchanged body; stamped by `team_stamp_org_id`) | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:198-200,220-222,369` | Yes |
| § 4.4 `rename_team(uuid, text)` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:371-391` | Yes |
| § 4.4 `delete_team(uuid)` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:396-418` | Yes |
| § 4.4 `admit_member(uuid, uuid)` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:422-444` | Yes |
| § 4.4 `reject_member(uuid)` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:446-463` | Yes |
| § 4.4 `move_member(uuid, uuid)` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:465-488` | Yes |
| § 4.4 `set_member_team(uuid, uuid)` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:490-512` | Yes |
| § 4.4 `set_member_role(uuid, public.member_role)` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:516-550` | Yes |
| § 4.4 `promote_member_to_admin(uuid)` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:552-577` | Yes |
| § 4.4 `event_stamp()` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:583-593` | Yes |
| § 4.4 `may_manage_event(uuid, uuid)` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:595-603` | Yes |
| § 4.4 `is_event_audience(uuid, uuid)` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:606-620` | Yes |
| § 4.4 `invite_to_event(uuid, text[])` | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:625-754` | Yes |
| § 4.4 `member_update_admin` policy | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:758-767` | Yes |
| § 4.4 `member_decide_admin` policy | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:769-786` | Yes |
| § 4.4 `team_update_admin` policy | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:790-796` | Yes |
| § 4.4 `entry_update_admin` policy | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:799-808` | Yes |
| § 4.4 `entry_delete_admin` policy | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:810-816` | Yes |
| § 4.4 `entry_update_manager` policy | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:818-828` | Yes |
| § 4.4 `holiday_insert_admin`, `holiday_update_admin`, `holiday_delete_admin` policies | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:830-856` | Yes |
| § 4.4 `issue_report_update_admin` policy | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:858-868` | Yes |
| § 4.4 `busy_day_insert_own`, `busy_day_delete_own` policies | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:870-884` | Yes |
| § 4.4 `event_insert_own`, `event_update_manage`, `event_delete_manage` policies | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:886-918` | Yes |
| § 4.4 `event_invitee_insert_manage`, `event_attendance_delete_own`, `notification_update_own` policies | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:920-948` | Yes |
| § 4.6 `supabase/bootstrap.sql` explicit `membership` insert removed | `supabase/bootstrap.sql:213-217` | Yes |
| § 4.7 Seam and types unchanged | No files under `src/` modified | Yes |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-02 | The reset of an approved entry to `pending` when `start_date`, `end_date`, `type`, `portion` or `tentative` changes (while note-only edits keep approval) is enforced by the actor-blind `before update` trigger `entry_enforce_decision()`, which is untouched by this migration. Rewriting `entry_update_admin` and `entry_update_manager` to use `public.shares_active_team(member_id, (select auth.uid()))` only bounds RLS row visibility/check and cannot bypass the `before update` trigger. | `supabase/migrations/20260903120000_cal03_edit_delete_entry.sql:31-67`, `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:799-828` |
| INV-04 | The single absence-count formula in `absenceCountsFor` is untouched. On the database write path, `member_sync_membership()` closes every active `membership` window with `left_at = greatest(new.removed_at, ms.joined_at)` and `is_primary = false` when `removed_at` transitions from null to non-null, matching the exact day ADR-013 stops counting a removed member. | `src/lib/domain/absence.ts:62-97`, `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:143-148`, `supabase/tests/140-org-stamping-and-membership-mirror.test.sql:269-285` |
| INV-07 | Every `entry` has `org_id` and `primary_team_id` enforced `NOT NULL`; `stamp_org_id()` stamps `new.primary_team_id := public.member_primary_team_id(new.member_id)` and `new.org_id` from the author's `member` row on insert; `entry_member_org_fk` refuses a cross-org entry; and `member_sync_membership()` maintains exactly one active primary membership per unremoved member on a team. | `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:95-160,185-191,205-206,339-340`, `supabase/tests/140-org-stamping-and-membership-mirror.test.sql:112-118,188-215,225-307` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS` — all eight checks (R1–R8) pass and the ticket advances to `DONE` via `/advance MIR-13`.
