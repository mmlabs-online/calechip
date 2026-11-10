---
ticket: MIR-13-b
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-03T07:30:37Z
inputs_read:
  - .ai/board/tickets/MIR-13-b/01-plan.md
  - .ai/board/tickets/MIR-13-b/03-impl-log.md
  - .ai/board/tickets/MIR-13-b/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-072-reads-that-feed-the-absence-count-resolve-to-the-primary-team.md
  - supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql
  - supabase/tests/160-read-path-org-bound.test.sql
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
| R1 | **Committed:** `git diff --name-only origin/main...HEAD` minus the ticket folder, the three ship-owned paths and the ticket's own promoting idea file is a subset of `allowed_paths` — `node scripts/check-allowed-paths.mjs` exits 0 (ADR-041, ADR-054). **Uncommitted:** `node scripts/check-carry.mjs MIR-13-b` exits 0 (ADR-043) | PASS | `.ai/board/tickets/MIR-13-b/ticket.yaml:18-21`; `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-13-b, 7 changed file(s) ... allowed-paths: PASS` (exit 0); `node scripts/check-carry.mjs MIR-13-b` → `check-carry: ticket MIR-13-b, 0 uncommitted path(s) / check-carry: PASS — nothing stray` (exit 0) |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm typecheck` (`tsc --noEmit`) exited 0 |
| R3 | lint exit 0 on the changed lintable files (ADR-041) | PASS | `pnpm lint` (`eslint .`) exited 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | No files under `src/` touched in `git diff --name-only origin/main...HEAD`; all changes are in `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:1-394` and `supabase/tests/160-read-path-org-bound.test.sql:1-280` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:34-392` (full mapping in `## R5 detail`) |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:34-392`; verified in `supabase/tests/160-read-path-org-bound.test.sql:70-278` |
| R7 | No invariant violated (RULE-07) | PASS | `INV-04`, `INV-07` held at `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:34-56,336-358` and `src/lib/data/absence.ts:197-207` (per-ID reasoning in `## R7 detail`) |
| R8 | No dependency added without an ADR | PASS | `package.json:1-53` and `pnpm-lock.yaml:1-10` untouched in `git diff origin/main...HEAD` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `member_select_team` policy on `public.member` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:34-37` | Yes |
| § 4.1 `team_select_own` policy on `public.team` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:39-42` | Yes |
| § 4.1 `entry_select_team` policy on `public.entry` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:44-47` | Yes |
| § 4.1 `busy_day_select_team` policy on `public.busy_day` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:49-56` | Yes |
| § 4.2 `public.may_read_event(p_event_id uuid, p_uid uuid) returns boolean` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:64-80` | Yes |
| § 4.2 `event_select_visible` policy on `public.event` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:82-96` | Yes |
| § 4.2 `event_attendance_select_visible` policy on `public.event_attendance` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:98-107` | Yes |
| § 4.2 `event_guest_select_visible` policy on `public.event_guest` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:109-117` | Yes |
| § 4.2 `notification_select_own` policy on `public.notification` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:119-125` | Yes |
| § 4.2 `task_select_own`, `task_insert_own`, `task_update_own`, `task_delete_own` policies on `public.task` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:127-161` | Yes |
| § 4.2 `public.notify_event_created() returns trigger` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:166-187` | Yes |
| § 4.2 `public.save_event(...) returns public.event` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:191-260` | Yes |
| § 4.2 `public.list_member_directory() returns table(...)` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:264-297` | Yes |
| § 4.3 `public.list_teams() returns setof public.team` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:304-311` | Yes |
| § 4.3 `public.list_all_members() returns setof public.member` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:313-321` | Yes |
| § 4.3 `public.list_members_for_team(p_team_id uuid) returns setof public.member` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:323-332` | Yes |
| § 4.3 `public.list_team_entries_for_team(p_team_id uuid) returns setof public.entry` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:336-345` | Yes |
| § 4.3 `public.list_team_entries_overlapping_for_team(p_team_id uuid, p_start date, p_end date) returns setof public.entry` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:347-358` | Yes |
| § 4.3 `member_select_pending_admin` policy on `public.member` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:360-368` | Yes |
| § 4.3 `issue_report_select_admin` policy on `public.issue_report` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:370-376` | Yes |
| § 4.3 `issue_image_select_admin` policy on `storage.objects` | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:383-392` | Yes (resolves org via `public.issue_report` so caller RLS does not hide non-primary team or removed reporters; see `## Delegated decisions`) |
| § 4.4 Seam and types unchanged | No files under `src/` modified | Yes |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 | `absenceCountsFor` in `src/lib/data/absence.ts` remains the sole computation of the absence count and is untouched. The four policy-filtered inputs it consumes (`member_select_team`, `team_select_own`, `entry_select_team`, `busy_day_select_team`) resolve to `public.member_primary_team_id((select auth.uid()))`, keeping the roster, entries and threshold scoped to a single team rather than a multi-team union, and no SQL statement in the migration consults `overload_threshold`. | `src/lib/data/absence.ts:197-207`, `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:34-56`, `supabase/tests/160-read-path-org-bound.test.sql:87-116` |
| INV-07 | Every entry belongs to one member (`entry.member_id NOT NULL`, `entry.primary_team_id NOT NULL`, stamped by `stamp_org_id()` in MIR-13) and is visible and counted on its author's primary team via `entry_select_team` and `list_team_entries*_for_team` (`public.member_primary_team_id(e.member_id)`). Under ADR-071's mirror (`member_sync_membership`) and `membership_one_active_primary_idx`, no writer creates a second active membership until the secondary-team calendar feature ships (ADR-072 decision 5). | `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:44-47,336-358`, `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:54-64,95-160,185-191`, `supabase/tests/160-read-path-org-bound.test.sql:97-105,209-215` |

## Delegated decisions

- Accepted the Developer's implementation of `issue_image_select_admin` (`supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql:383-392`), which checks `exists (select 1 from public.issue_report r where r.member_id::text = (storage.foldername(objects.name))[1] and r.org_id = public.member_org_id((select auth.uid())))` instead of querying `public.member`. Because subqueries in RLS policies execute under the caller's RLS, querying `public.member` (restricted by `member_select_team` to the caller's primary team) would hide images uploaded by reporters on other teams in the same org (e.g. T3) or removed reporters, violating plan § 3 ("an admin, in the admin's own org") and AC-8 (`supabase/tests/160-read-path-org-bound.test.sql:241-245`).

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS` — all eight checks (R1–R8) pass and the ticket advances to `DONE` via `/advance MIR-13-b`.
