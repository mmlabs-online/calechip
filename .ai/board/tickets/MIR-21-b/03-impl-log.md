---
ticket: MIR-21-b
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-05T21:33:00+07:00
inputs_read:
  - .ai/board/tickets/MIR-21-b/01-plan.md
  - .ai/board/tickets/MIR-21-b/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261104150000_mir18_system_admin.sql
  - supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql
  - supabase/migrations/20261020120000_mir02_member_self_writes.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/160-read-path-org-bound.test.sql
  - supabase/tests/190-system-admin.test.sql
  - supabase/tests/220-roster-team-from-membership.test.sql
  - supabase/create-account.sql
consulted:
  - with: tech-lead-design
    asked: "160 AC-9's fixture writes member.team_id directly and relied on the removed mirror team-change branch; it now aborts at :267 (attendance_not_permitted). May 160 join allowed_paths, limited to that fixture?"
    answer: "Accepted. 160 joins allowed_paths, limited to the AC-9 fixture at :263-268: call membership_make_primary after the first update, close the row after the second, an ADR-078 comment beside each. No assertion or plan count changes. 170 #42 is pre-existing and not this ticket's."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-21-b — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261105210000_mir21b_writers_write_membership.sql` | created | The one migration of the contract: helper, eight writers, the policy, the narrowed mirror | § 4.1, § 4.2, § 4.3, § 4.4 |
| `supabase/create-account.sql` | modified | With the mirror's team-change branch gone, the approved branch must write the primary row itself | § 4.5 |
| `supabase/tests/230-writers-write-membership.test.sql` | created | 84 assertions, one block per AC-1 to AC-14 | § 4.6 |
| `supabase/tests/160-read-path-org-bound.test.sql` | modified | Its AC-9 fixture relied on the removed mirror branch; two added statements write and close the row the writers now write. No assertion changed | § 4.6 as amended (consultation 1) |
| `.ai/board/tickets/MIR-21-b/99-questions.md` | created | The consultation above, and its answer | — (RULE-12 channel) |
| `.ai/board/tickets/MIR-21-b/03-impl-log.md` | created | This file | gate |

`01-plan.md` and `ticket.yaml` were amended by `tech-lead-design` in its answer (160 in `allowed_paths`,
`chat_budget` used 1), not by this agent. The ADR-078 and the five sibling `ticket.yaml` paths were
written and committed at PLAN; nothing further was owed on them here (plan § 7).

## Contract items

| Item | Implemented at | Notes |
|------|----------------|-------|
| § 4.1 `membership_make_primary` | `20261105210000_…sql:39-76` | Body as specified, character for character. `revoke … from public, anon, authenticated` |
| § 4.2 `delete_team` | `…sql:86-108`, predicate `:97` | |
| § 4.2 `admit_member` | `…sql:113-137`, predicate `:128`, helper `:135` | `set` list unchanged |
| § 4.2 `reject_member` | `…sql:139-156`, predicate `:149` | No `membership` write |
| § 4.2 `move_member` | `…sql:158-183`, predicate `:173`, helper `:181` | |
| § 4.2 `set_member_team` | `…sql:187-210`, predicates `:200-201` | `set` and `returning` unchanged |
| § 4.2 `set_member_role` | `…sql:214-256`, predicate `:234`, `membership` update `:246` | |
| § 4.2 `promote_member_to_admin` | `…sql:258-288`, predicate `:271`, `membership` update `:281` | |
| § 4.2 `grant_system_admin` | `…sql:293-315` | `and m.team_id is null` deleted; grants re-stated as in mir18 |
| § 4.2 order: `member` before `membership` | every writer above | The helper / `membership` update follows the `not found` check |
| § 4.3 `member_update_admin` | `…sql:324-333` | `for update to authenticated`, both clauses as specified |
| § 4.4 mirror function | `…sql:341-375` | INSERT and removal branches verbatim from `mir13:95-160`; team and rank branches removed; `v_team_role` kept |
| § 4.4 trigger | `…sql:379-382` | `after insert or update of removed_at` |
| § 4.5 `create-account.sql` | `create-account.sql:156-159` | Comment cites ADR-078; one `perform` after the `update` at `:152` |
| § 4.6 pgTAP | `230-…test.sql` | AC-10 `:90`, AC-13 `:109`, AC-14 `:147`, AC-12 first half `:165`, AC-7 `:183` and `:360`, AC-1 `:222`, AC-2 `:242`, AC-3 `:264`, AC-4 `:290`, AC-5 `:303`, AC-6 `:324`, AC-8 `:339`, AC-11 `:363`, AC-12 grant `:377`; AC-9 after every step |
| AC-14 second half (source text) | `grep -n "membership_make_primary\|update public.member" supabase/create-account.sql` → `152: update public.member`, `159: perform public.membership_make_primary(v_id, v_team);` | The call follows the `update`, in the approved branch |

## Deviations from the design

- **160 changed, though § 4.6 said no existing test would.** Declared and authorised: consultation 1,
  amendment by `tech-lead-design` in `01-plan.md` § 4.6 / § 7. The edit is exactly the scope it set.
- **Fixture P3.** § 2 lists P1 and P2 only. AC-12's grant needs a pending member with no
  `membership` row, and by then P1 is admitted and P2 rejected. P3 is a third pending sign-up used
  only there. It is a test fixture, not a schema field or criterion.
- **Step order in 230.** AC-12's first half and most of AC-7 run before AC-1, and AC-7's W refusal
  after AC-8, because each AC's *Given* requires it (M on T1; W removed). The AC numbering is kept in
  the assertion labels.

Nothing else.

## Delegated decisions

- **Close, not delete, in the 160 fixture.** Closing reproduces the exact state the mirror left
  before this ticket (one closed row, no active row). Accepted by `tech-lead-design`.
- **`service_role` in AC-12 via `set local role service_role`.** No earlier test does this. The ids
  are resolved with `\gset` first, because `tests` is granted to `anon` and `authenticated` only.
  It passes.

## Invariants

| ID | Still holds because |
|----|---------------------|
| INV-04 | `joined_at`/`left_at` are now written by `membership_make_primary`, whose values are the mirror's own (`now()` to open, `now()` to close; removal close unchanged at `greatest(removed_at, joined_at)`). 230 AC-1 to AC-4 and AC-8 check each value, and AC-9 finds zero drift after every step. |
| INV-07 | The active `membership` set is produced by the writers directly; AC-3 shows a held non-primary row is promoted, not duplicated, and AC-9 shows the column and `member_roster_team_id` agree on every row of `public.member`, the seed's included, after each step. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 50 files, 1012 tests |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS, after the amendment |
| `node scripts/check-carry.mjs MIR-21-b` | 0 | PASS, nothing stray |
| `pnpm db:test`, baseline (ticket stashed) | 1 | Only `170` #42 fails (`AC-20: admin_u does not select E`), pre-existing, already recorded in `MIR-21/03-impl-log.md:111` |
| `pnpm db:test`, migration only | 1 | `230` 84/84; new failure `160` (aborts at `:267`, 44/49) → consultation 1; `170` #42 as baseline |
| `pnpm db:test`, after the 160 fixture | 1 | 24 files, 1071 tests. `160` and `230` pass; the only failure is `170` #42, as baseline |
| Second apply of the migration (`psql -v ON_ERROR_STOP=1` into the local db) | 0 | Idempotent (ADR-024) |
| `git diff --name-only` ⊆ `allowed_paths` | yes | |

Not run: a mutant check that 230 fails against the old writers. Its AC-1, AC-2 and AC-5 assertions
read `membership` rows only the new code writes once the mirror branch is gone, so the old writers
plus the new trigger would fail them; this is reasoned, not measured.

## Testability contract

No selectors: no screen changes (plan § 2b).

## Open questions

- `170` #42 still fails on `main`. It is not this ticket's, and it now has two impl logs naming it.
