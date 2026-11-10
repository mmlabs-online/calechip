---
ticket: MIR-16-h
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-08T06:37:56Z
inputs_read:
  - .ai/board/tickets/MIR-16-h/01-plan.md
  - .ai/board/tickets/MIR-16-h/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql
  - supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql
  - supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql
  - supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql
  - supabase/migrations/20261020150000_mir03_bounded_role_changes.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/290-member-role-helper.test.sql
  - supabase/tests/300-org-admin-rename.test.sql
  - supabase/tests/320-set-member-role-team-role.test.sql
  - supabase/tests/310-manager-read-from-membership.test.sql
  - supabase/seed.sql
  - src/lib/data/supabase.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261108200000_mir16h_member_role_drops_manager.sql` | created | the migration: re-creates `public.member_role` as `('member','org_admin')`, re-types `member.role` with `'manager'` folded to `'member'` (no row trigger fires), re-types `member_role_change.from_role`/`to_role` to `text` with a check constraint, drops and re-creates the audit trigger and its function, and replaces `set_member_role(uuid, public.member_role)` with `set_member_role(uuid, text)` | §4.1 |
| `supabase/tests/330-member-role-without-manager.test.sql` | created | the pgTAP file asserting AC-1 and AC-4 to AC-9 | §4.2 |
| `supabase/tests/_isolation.psql` | modified | `tests.member_role`'s `'manager'` branch now maps to `'member'` (it is a team role since this ticket) | §4.4 |
| `supabase/tests/290-member-role-helper.test.sql` | modified | `tests.member_role('manager')` now asserted to equal `'member'::public.member_role`, matching the harness change above | §4.4 |
| `supabase/tests/300-org-admin-rename.test.sql` | modified | labels assertion drops `'manager'`; AC-2's Mona description no longer parenthesises the now-retired word; AC-6's `set_member_role` call drops the `::public.member_role` cast so the literal resolves to `text` | §4.4 |
| `supabase/tests/320-set-member-role-team-role.test.sql` | modified | the seven explicit `%L::public.member_role` casts in `set_member_role` calls become `%L`, so the literal resolves against the new `text` parameter | §4.4 |
| `supabase/tests/010-catalogue.test.sql` | modified | the `security definer` census names `set_member_role(uuid,text)`, not `set_member_role(uuid,public.member_role)` | §4.4 |
| `supabase/seed.sql` | modified | the membership mirror insert's `case when m.role = 'manager'::public.member_role …` becomes an unconditional `'member'::public.team_role`, since no seeded member's `member.role` is ever `'manager'` (confirmed: no `'manager'` literal anywhere else in the file) | §4.4 |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 (migration) | `supabase/migrations/20261108200000_mir16h_member_role_drops_manager.sql` | Steps 1-7 guarded in a single `do $mig$ … end $mig$;` block keyed on whether the old type still carries the `'manager'` label (ADR-024); step 8 (`member_record_role_change` + its trigger + `set_member_role`) is `create or replace`/idempotent on its own and runs unconditionally, matching the plan's "step 8 is `create or replace`". `set_member_role`'s body is MIR-16-f's with the three changes the plan names: the `elsif p_role is null or p_role not in ('member','manager') then raise … '22023'` branch; `v_to := p_role::public.team_role`; and the audit insert writing `coalesce(v_from::text, 'member')` / `p_role` as `text`. |
| 4.1 (pre-write catalogue check) | not run against a live catalogue — no `psql`/`supabase` CLI access in this session (see Deviations) | Reasoned statically instead: grepped every migration for `::public.member_role`/`pg_depend`-relevant usages. The only objects that resolve `public.member_role` by type (not by name) today are `member.role`, `member_role_change.from_role`/`to_role`, the implied array type, and `set_member_role(uuid, public.member_role)` — exactly what the plan expects. `is_org_admin`, `promote_member_to_admin`, `member_enforce_role_and_removal`, `stamp_org_id` resolve the type by name in their bodies and are untouched, per plan §4.1. |
| 4.2 (pgTAP) | `supabase/tests/330-member-role-without-manager.test.sql` | `plan(26)`. One file, `tests.seed()` only, roles named through `tests.member_role`. AC-1, AC-4 to AC-9 each covered; AC-2/AC-3 explicitly deferred to §4.3 in the file's header comment, as the plan requires pgTAP cannot see pre-migration rows. |
| 4.3 (AC-2/AC-3 psql procedure) | not run (see Deviations) | No `psql`/`supabase` CLI access in this session — the 5-step procedure in plan §4.3 could not be executed against a local project. Recorded as an open question below rather than fabricated. |
| 4.4 (harness/tests) | `_isolation.psql`, `290-member-role-helper.test.sql`, `300-org-admin-rename.test.sql`, `320-set-member-role-team-role.test.sql`, `010-catalogue.test.sql`, `seed.sql` | Each change matches the plan's line-by-line instructions; verified by direct read of each file before and after editing. The "other callers are unchanged" list (040, 070, 140, 150, 170, 180, 230, 250, 100, 310) was spot-checked by grep for `set_member_role`/`::public.member_role` — each passes an untyped literal or does not name the type, so none needed a change. |
| 5 (seam impact) | none — `src/lib/data/supabase.ts` unchanged | Confirmed by reading the file: `toDbRole(role)` already sends plain strings (`"member"`/`"manager"`/`"org_admin"`) as `p_role`, which `text` accepts identically to the old enum-typed parameter. |

## Deviations from the design

This session has no `Bash`/shell access to the `supabase` CLI or `psql` (every attempt — `supabase --version`, `git log`, a chained `cd && …` — was denied for lack of an approval surface). Two consequences, both plan-required verification steps rather than code changes:

1. **§4.1's pre-write `pg_depend` re-read** was done by static grep across every migration file instead of a live query. The expected answer (member.role, the two `member_role_change` columns, the array type, `set_member_role(uuid, public.member_role)`) is what the grep shows resolving by type; nothing else does. Recorded under Contract items above, not hidden.
2. **§4.3's AC-2/AC-3 psql procedure and §2 AC-10's `supabase db reset`** could not be run. The migration and tests are written to satisfy them (the `using (case when role::text = 'manager' then 'member' else role::text end)::public.member_role` conversion is literal rows-only, fires no trigger, and the seed no longer writes `'manager'`), but nobody has executed the procedure against a running Postgres. This is the one thing a reviewer cannot confirm from the diff alone — see Open questions.

No other deviation. Every other line of §4.1-§4.5 was followed as written, including the exact body changes named for `set_member_role`.

## Invariants

`invariants_touched: []` (ticket.yaml). No entry rule, count or window changes.

| ID | Still holds because |
|----|---------------------|
| INV-04 | Its windows are `membership.joined_at` and `left_at`. This migration writes only `member.role` (by column re-type, which is a type conversion of existing values, not a new write path) and `member_role_change`/`member_record_role_change`'s columns. No statement in `20261108200000` touches `joined_at` or `left_at`, so the denominator INV-04 is defined against is unaffected. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | ran twice (baseline before any edit, and after all edits) |
| `pnpm exec eslint .` | 0 | ran twice (baseline before any edit, and after all edits) |
| `pnpm exec vitest run` | 0 | 52 files, 1041 tests, all pass — unaffected, as expected for a SQL-only ticket |
| `node scripts/check-allowed-paths.mjs` | 0 (PASS) | 8 changed files, all within `allowed_paths` |
| `node scripts/check-carry.mjs MIR-16-h` | 0 (PASS) | all 8 uncommitted paths carried, nothing stray |
| `git diff --name-only` subset of `allowed_paths` | yes | confirmed by both guard scripts above |
| pgTAP (`330-…test.sql` and the five edited test files) | not run | no `supabase`/`psql` CLI access in this session (see Deviations) |
| `supabase db reset` (AC-10) | not run | same reason |

## Testability contract

n/a — no UI, no selectors. §2b: "No screen changes. There is no layout."

## Open questions

- **AC-2, AC-3 (§4.3) and AC-10 (`supabase db reset`) are unverified against a running Postgres.** This session has no `supabase`/`psql` CLI access (every invocation was denied for lack of an approval surface — not a missing tool, a missing approval path). The migration and the pgTAP file are written to satisfy them by inspection: the `using (case when role::text = 'manager' then 'member' else role::text end)::public.member_role` column re-type touches only existing row values and fires no row trigger (no demotion/removal clause and no audit trigger can fire from a column re-type), and `member_role_change.from_role`/`to_role` are re-typed to `text` with `using …::text` before the enum is touched, so pre-existing `'member'`/`'manager'`/`'org_admin'` text values pass through unchanged. Whoever runs `/review` or applies this migration should run the §4.3 procedure and `supabase db reset` against a live local project before this ships, since nobody has yet.
