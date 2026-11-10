---
ticket: MIR-11
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-27T04:38:30Z
inputs_read:
  - .ai/board/tickets/MIR-11/01-plan.md
  - .ai/board/tickets/MIR-11/03-impl-log.md
  - .ai/board/tickets/MIR-11/ticket.yaml
  - .ai/board/tickets/MIR-11/verification.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/registry/boundaries.json
  - .ai/standards/data-model.md
  - .ai/standards/architecture.md
  - .ai/standards/testing-standards.md
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/tests/120-composite-fks.test.sql
  - supabase/tests/010-catalogue.test.sql
  - src/lib/data/absence.ts
  - eslint.config.js
  - package.json
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
| R1 | **Committed:** `git diff --name-only origin/main...HEAD` minus the ticket folder, the three ship-owned paths and the ticket's own promoting idea file is a subset of `allowed_paths` — `node scripts/check-allowed-paths.mjs` exits 0 (ADR-041, ADR-054). **Uncommitted:** `node scripts/check-carry.mjs <ID>` exits 0 (ADR-043) | PASS | `.ai/board/tickets/MIR-11/ticket.yaml:16-19`, `.ai/board/tickets/MIR-11/01-plan.md:685-688`; `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-11, 7 changed file(s)` / `allowed_paths: supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql, supabase/tests/120-composite-fks.test.sql, .ai/board/tickets/MIR-11/**` / `allowed-paths: PASS` (exit 0); `node scripts/check-carry.mjs MIR-11` → `check-carry: ticket MIR-11, 0 uncommitted path(s)` / `check-carry: PASS — nothing stray` (exit 0) |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm typecheck` (`tsc --noEmit`, `package.json:10`) exited 0 with no output |
| R3 | lint exit 0 on the changed lintable files (ADR-041) | PASS | `pnpm lint` (`eslint .`, `package.json:11`, `eslint.config.js:50-94`) exited 0 with no output |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `eslint.config.js:20,60-79` and `.ai/registry/boundaries.json:17-32` restrict `@supabase/*` imports to `src/lib/data/`; no file under `src/**` is touched in `origin/main...HEAD` (`.ai/board/tickets/MIR-11/01-plan.md:658-662`) |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:1-442`, `supabase/tests/120-composite-fks.test.sql:1-581`, `.ai/board/tickets/MIR-11/verification.md:1-154` |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:75-98,174-177,203-204,222-438`, `supabase/tests/120-composite-fks.test.sql:57-67,109-119,237-241,278-496`, `supabase/tests/010-catalogue.test.sql:16-96` |
| R7 | No invariant violated (RULE-07) | PASS | `.ai/registry/invariants.md:36,39`, `src/lib/data/absence.ts:106-107,121-148,197-207`, `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:161-202,222-241`, `supabase/tests/120-composite-fks.test.sql:82-107,278-338` |
| R8 | No dependency added without an ADR | PASS | `package.json:20-52` is unchanged in `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 item 1 — `public.team_role` enum (`'member'`, `'manager'`) | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:22-25` | Yes — `create type public.team_role as enum ('member', 'manager')` inside idempotent `do $$ ... exception when duplicate_object then null; end $$;` |
| § 4.1 item 2 — `public.org` table, constraints (`org_org_code_key`, `org_code_shape`, `org_code_not_reserved`, `org_name_not_blank`, `org_plan_not_blank`, `org_timezone_not_blank`, `org_max_members_positive`, `org_max_teams_positive`), `org_one_shared_tenant_idx`, `org_enforce_immutable_org_code()` trigger, RLS enabled and privileges revoked from `public, anon, authenticated` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:30-98` | Yes — columns (`:31-41`), constraints (`:43-68`, with the union of all 29 `ADR-070` § 2 and `01-plan.md` § 4.1 reserved tokens at `:48-63`), `org_one_shared_tenant_idx` (`:71-73`), `org_enforce_immutable_org_code()` (`security invoker set search_path = ''`, `:75-95`), and `enable row level security` + `revoke all` (`:97-98`) match `01-plan.md:196-258` |
| § 4.1 item 3 — Parent tables `public.team`, `public.member`, `public.event`: nullable `org_id`, `<table_name>_org_id_fkey`, `unique (id, org_id)` (`team_id_org_id_key`, `member_id_org_id_key`, `event_id_org_id_key`), and `<table_name>_org_id_idx` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:103-155` | Yes — `team` (`:103-119`), `member` (`:121-137`), and `event` (`:139-155`) match `01-plan.md:262-315` (with `when duplicate_object or duplicate_table then null` at `:116,134,152` for PG 17 unique-constraint idempotency) |
| § 4.1 item 4 — `public.membership` table, `membership_id_org_id_key`, composite FKs (`membership_team_org_fk`, `membership_member_org_fk`), checks (`membership_left_after_joined`, `membership_inactive_not_primary`), partial unique indexes (`membership_active_team_member_idx`, `membership_one_active_primary_idx`), supporting indexes (`membership_member_active_idx`, `membership_org_id_idx`, `membership_team_history_idx`), RLS enabled and privileges revoked | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:161-204` | Yes — table and constraints (`:161-182`), partial unique indexes (`:184-190`), supporting indexes (`:192-201`), and RLS + privilege revocation (`:203-204`) match `01-plan.md:319-362` |
| § 4.1 item 5a — `public.entry`: nullable `org_id` and `primary_team_id`, `entry_org_id_fkey`, composite FKs (`entry_member_org_fk`, `entry_primary_team_org_fk`, `entry_approved_by_org_fk`), and indexes (`entry_org_id_idx`, `entry_primary_team_org_idx`) | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:211-244` | Yes — matches `01-plan.md:369-402` |
| § 4.1 item 5b — `public.holiday`: nullable `org_id`, `holiday_org_id_fkey`, `holiday_org_id_idx` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:247-257` | Yes — matches `01-plan.md:405-415` |
| § 4.1 item 5c — `public.busy_day`: nullable `org_id`, `busy_day_org_id_fkey`, `busy_day_member_org_fk`, `busy_day_org_id_idx` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:260-277` | Yes — matches `01-plan.md:418-435` |
| § 4.1 item 5d — `public.issue_report`: nullable `org_id`, `issue_report_org_id_fkey`, `issue_report_member_org_fk`, `issue_report_org_id_idx` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:280-297` | Yes — matches `01-plan.md:438-455` |
| § 4.1 item 5e — `public.event` composite FKs: `event_creator_org_fk` and `event_team_org_fk` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:300-312` | Yes — matches `01-plan.md:458-470` |
| § 4.1 item 5f — `public.event_invitee`: nullable `org_id`, `event_invitee_org_id_fkey`, `event_invitee_event_org_fk` (`on delete cascade`), `event_invitee_member_org_fk` (`on delete restrict`), `event_invitee_org_id_idx` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:315-339` | Yes — matches `01-plan.md:473-497` |
| § 4.1 item 5g — `public.event_attendance`: nullable `org_id`, `event_attendance_org_id_fkey`, `event_attendance_event_org_fk` (`on delete cascade`), `event_attendance_member_org_fk` (`on delete restrict`), `event_attendance_org_id_idx` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:342-366` | Yes — matches `01-plan.md:500-524` |
| § 4.1 item 5h — `public.event_guest_link`: nullable `org_id`, `event_guest_link_org_id_fkey`, `event_guest_link_event_org_fk` (`on delete cascade`), `event_guest_link_org_id_idx` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:369-386` | Yes — matches `01-plan.md:527-544` |
| § 4.1 item 5i — `public.event_guest`: nullable `org_id`, `event_guest_org_id_fkey`, `event_guest_event_org_fk` (`on delete set null (event_id)`), `event_guest_org_id_idx` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:389-406` | Yes — matches `01-plan.md:547-564` |
| § 4.1 item 5j — `public.notification`: nullable `org_id`, `notification_org_id_fkey`, `notification_recipient_org_fk` (`on delete restrict`), `notification_actor_org_fk` (`on delete restrict`), `notification_event_org_fk` (`on delete set null (event_id)`), `notification_org_id_idx` | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:409-440` | Yes — matches `01-plan.md:567-598` |
| § 4.2 — pgTAP test suite `supabase/tests/120-composite-fks.test.sql`: catalogue & constraint inventory (AC-1..AC-3), `public.org` checks & immutability trigger (AC-1), two-tenant fixture (`Org A`, `Org B`), 18 composite FK cross-org `23503` refusals & same-org `lives_ok` checks (AC-2, AC-4, AC-5, AC-6), and `ON DELETE CASCADE` / `ON DELETE SET NULL (event_id)` verification (AC-7) | `supabase/tests/120-composite-fks.test.sql:1-581` | Yes — `plan(92)` (`:7`), catalogue/constraint/index/RLS/privilege checks (`:14-211`), `org` check/immutability/singleton tests and `Org A`/`Org B` fixture (`:218-271`), all 18 composite FK `throws_ok(..., '23503')` and same-org `lives_ok` checks (`:278-545`), and `Event A` deletion cascade + `ON DELETE SET NULL (event_id)` preservation checks (`:548-578`) |
| § 4.3 — Phase 3 verification artifact `.ai/board/tickets/MIR-11/verification.md` recording `AC-1`..`AC-9` verification and pgTAP execution output (`RULE-16`) | `.ai/board/tickets/MIR-11/verification.md:1-154` | Yes — `AC-1`..`AC-9` verification table (`:11-24`), `pnpm db:test` output (`:27-37`), and full PostgreSQL 17.11 + pgTAP 1.3.3 suite output (`000`–`120`, 558 assertions, `120-composite-fks.test.sql` `1..92` all `ok`, `:39-154`) |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| `INV-04` — The absence count for a team on a date is the sum, over that date's `pending` and `approved` entries whose member was still on that team on that date, of 1 per `full` portion and 0.5 per `am` or `pm` portion, with PTO and WFH counted alike; rejected entries excluded; no second definition exists anywhere in the system | `absenceCountsFor` in `src/lib/data/absence.ts:106-107,121-148,197-207` remains untouched and is the sole computation of the absence count (no SQL view, RPC or second TypeScript function is added in `MIR-11`). At the database schema layer, `public.membership` introduces the `[joined_at, left_at)` historical membership interval (`joined_at timestamptz not null default now()`, `left_at timestamptz null`), enforced by `membership_left_after_joined check (left_at is null or left_at >= joined_at)`, `membership_inactive_not_primary check (left_at is null or is_primary = false)`, partial unique indexes `membership_active_team_member_idx` and `membership_one_active_primary_idx`, and supporting index `membership_team_history_idx on public.membership (team_id, joined_at, left_at)` so temporal team membership windows are preserved when a member leaves a team. | `src/lib/data/absence.ts:106-107,121-148,197-207`, `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:161-202`, `supabase/tests/120-composite-fks.test.sql:69-107` |
| `INV-07` — Every entry belongs to exactly one member, and is counted against every team that member belongs to | `public.entry` retains `member_id uuid not null` and gains composite foreign keys `entry_member_org_fk` (`(member_id, org_id) references public.member (id, org_id) on delete restrict`) and `entry_primary_team_org_fk` (`(primary_team_id, org_id) references public.team (id, org_id) on delete restrict`), while `public.membership` enforces `membership_team_org_fk` (`(team_id, org_id) references public.team (id, org_id) on delete restrict`) and `membership_member_org_fk` (`(member_id, org_id) references public.member (id, org_id) on delete restrict`). Every cross-org pairing between an entry, member, or team is refused at the PostgreSQL constraint layer with SQLSTATE `23503`. | `supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:173-177,222-241`, `supabase/tests/120-composite-fks.test.sql:278-338` |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS`
