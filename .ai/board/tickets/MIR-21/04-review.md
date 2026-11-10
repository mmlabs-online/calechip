---
ticket: MIR-21
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-05T10:21:06Z
inputs_read:
  - .ai/board/tickets/MIR-21/01-plan.md
  - .ai/board/tickets/MIR-21/03-impl-log.md
  - .ai/board/tickets/MIR-21/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-077-a-members-roster-team-is-read-from-membership-and-mir-21-splits-reads-first.md
  - supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql
  - supabase/tests/220-roster-team-from-membership.test.sql
  - supabase/tests/010-catalogue.test.sql
  - src/lib/data/supabase.ts
  - tests/roster-excludes-signups.test.ts
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
| R1 | **Committed:** `git diff --name-only origin/main...HEAD` minus the ticket folder, the three ship-owned paths and the ticket's own promoting idea file is a subset of `allowed_paths` — `node scripts/check-allowed-paths.mjs` exits 0 (ADR-041, ADR-054). **Uncommitted:** `node scripts/check-carry.mjs MIR-21` exits 0 (ADR-043) | PASS | `.ai/board/tickets/MIR-21/ticket.yaml:16-28`; `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-21, 9 changed file(s) ... allowed-paths: PASS` (exit 0); `node scripts/check-carry.mjs MIR-21` → `check-carry: ticket MIR-21, 16 uncommitted path(s) (all carried) / check-carry: PASS — nothing stray` (exit 0) |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm typecheck` (`tsc --noEmit`) exited 0 |
| R3 | lint exit 0 on the changed lintable files (ADR-041) | PASS | `pnpm lint` (`eslint .`) exited 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | Only `src/lib/data/supabase.ts:983-984,1671,1754,2438-2441,3400` is modified under `src/`; `eslint.config.js:60-79` enforces `no-restricted-imports` on `@supabase/*` outside `src/lib/data/**` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:35-150`, `src/lib/data/supabase.ts:983-3400`, `supabase/tests/220-roster-team-from-membership.test.sql:1-194`, `supabase/tests/010-catalogue.test.sql:56-57`, `tests/roster-excludes-signups.test.ts:67-70` (full mapping in `## R5 detail`) |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:35-150`; verified in `supabase/tests/220-roster-team-from-membership.test.sql:87-191` and `supabase/tests/010-catalogue.test.sql:56-57,102-116` |
| R7 | No invariant violated (RULE-07) | PASS | `INV-04`, `INV-07` held at `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:35-45,65-68,80-86`, `src/lib/data/absence.ts:197-207`, and `supabase/tests/220-roster-team-from-membership.test.sql:64-105` (per-ID reasoning in `## R7 detail`) |
| R8 | No dependency added without an ADR | PASS | `package.json:1-53` and `pnpm-lock.yaml:1-10` untouched in `git diff origin/main...HEAD` and working tree |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `public.member_roster_team_id(p_member uuid) returns uuid` (`security definer`, grants) | `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:35-49` | Yes |
| § 4.1 `public.roster_team_id(p_member public.member) returns uuid` (`invoker`, grants) | `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:53-58` | Yes |
| § 4.2 `member_select_team` policy on `public.member` | `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:65-68` | Yes |
| § 4.2 `member_select_pending_admin` policy on `public.member` | `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:70-78` | Yes |
| § 4.2 `busy_day_select_team` policy on `public.busy_day` | `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:80-86` | Yes |
| § 4.3 `public.list_all_members() returns setof public.member` | `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:92-100` | Yes |
| § 4.3 `public.list_members_for_team(p_team_id uuid) returns setof public.member` | `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:102-111` | Yes |
| § 4.3 `public.list_member_directory() returns table(id uuid, display_name text, avatar text, team_id uuid, team_name text)` | `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:117-150` | Yes |
| § 4.4 `MEMBER_COLUMNS` selects `team_id:roster_team_id` | `src/lib/data/supabase.ts:983-984` | Yes |
| § 4.4 `listPendingMembers` filters `.is("roster_team_id", null)` | `src/lib/data/supabase.ts:1671` | Yes |
| § 4.4 `countPendingMembers` filters `.is("roster_team_id", null)` | `src/lib/data/supabase.ts:3400` | Yes |
| § 4.4 `listMembers` filters `.not("roster_team_id", "is", null)` and `tests/roster-excludes-signups.test.ts` updated | `src/lib/data/supabase.ts:1754`, `tests/roster-excludes-signups.test.ts:67-70` | Yes |
| § 4.4 `listAllMembers` calls `.select(MEMBER_COLUMNS)` before `.limit(ROSTER_LIMIT)` | `src/lib/data/supabase.ts:2438-2441` | Yes |
| § 4.4 Comments in `src/lib/data/supabase.ts` updated to name `roster_team_id` and ADR-077 | `src/lib/data/supabase.ts:1657-1660,1741-1744,3390-3391` | Yes |
| § 4.5 pgTAP suite `supabase/tests/220-roster-team-from-membership.test.sql` (AC-1 to AC-8, AC-10) | `supabase/tests/220-roster-team-from-membership.test.sql:1-194` | Yes |
| § 4.6 Catalogue definer census gains `public.member_roster_team_id(uuid)` | `supabase/tests/010-catalogue.test.sql:56-57` | Yes |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 | `absenceCountsFor` in `src/lib/data/absence.ts` remains the sole computation of the absence count and is untouched. The roster and busy-day reads that feed it (`member_select_team` and `busy_day_select_team`) resolve the member's roster team via `public.member_roster_team_id`, which returns the active primary team (`m.removed_at is null and ms.left_at is null and ms.is_primary`) or, for a removed member, the team of the membership row closed by removal (`m.removed_at is not null and ms.left_at = greatest(m.removed_at, ms.joined_at)`). Removed members therefore remain on their team's roster and busy-day read so past dates continue to count their entries until `removed_at` (ADR-013), and the caller side stays `public.member_primary_team_id((select auth.uid()))` (ADR-072 decision 1). | `src/lib/data/absence.ts:197-207`, `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:35-45,65-68,80-86`, `supabase/tests/220-roster-team-from-membership.test.sql:64-74,87-105` |
| INV-07 | Every reader of a member's team (`member_select_team`, `member_select_pending_admin`, `busy_day_select_team`, `list_all_members`, `list_members_for_team`, `list_member_directory`, and the seam via `roster_team_id`) now derives the team from `public.membership` rather than `member.team_id`. `member_roster_team_id` returns at most one team per member (`order by ms.joined_at desc, ms.id limit 1`), matching `member.team_id` on every row under ADR-071's mirror (`member_sync_membership`). | `supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql:35-58,65-150`, `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:95-160`, `supabase/tests/220-roster-team-from-membership.test.sql:64-82` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS` — all eight checks (R1–R8) pass and the ticket advances to `DONE` via `/advance MIR-21`.
