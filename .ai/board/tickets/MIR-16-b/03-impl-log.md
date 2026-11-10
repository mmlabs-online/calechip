---
ticket: MIR-16-b
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-07T12:03:07Z
inputs_read:
  - .ai/board/tickets/MIR-16-b/01-plan.md
  - .ai/board/tickets/MIR-16-b/ticket.yaml
  - .ai/steward/context.md
  - .ai/templates/impl-log.md
  - .ai/board/tickets/MIR-21-f/03-impl-log.md
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/100-mock-parity.test.sql
  - supabase/tests/150-write-path-org-bound.test.sql
  - supabase/tests/170-multi-team-decisions.test.sql
  - supabase/tests/270-issue-reports-system-scope.test.sql
  - "supabase/migrations/*.sql: the latest `create policy` of each of the 12 policies in § 4.1"
  - "local database catalogue after 20261107210000: pg_get_functiondef of the 19 functions, pg_policies, proacl"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-16-b: implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261107230000_mir16b_is_org_admin.sql` | created | adds the predicate, re-points every call site, drops `is_admin` | § 4.1 steps 1–3 |
| `supabase/tests/280-is-org-admin.test.sql` | created | AC-1 to AC-7, 45 assertions on the § 4.2 fixture | § 4.2 |
| `supabase/tests/010-catalogue.test.sql` | modified | the definer census names a function that no longer exists | § 4.3, line 41 |
| `supabase/tests/100-mock-parity.test.sql` | modified | the parity check called the dropped function | § 4.3, line 203 |

The four § 4.4 paths (ADR-083, MIR-16-d/-c and MIR-17 `ticket.yaml`) were written and committed at
PLAN (`3ad47b6`). Nothing in them was changed here.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 step 1, `is_org_admin(uuid,uuid)` | `20261107230000_mir16b_is_org_admin.sql:25-41` | Text as in the plan. `revoke … from public, anon`, `grant … to authenticated` |
| 4.1 step 2, 19 functions / 20 sites | same file, `:49-660` | Form C at 18 sites, Form R (`e.org_id`) at `:445` (`may_manage_event`) and `:461` (`may_read_event`) |
| 4.1 step 2, 12 policies | same file, `:670-804` | Form C: `entry_*` (3), `member_update_admin`, `team_update_admin`. Form R (`org_id`): `event_*` (3), `holiday_*` (3), `member_select_pending_admin` |
| 4.1 step 3, drop `is_admin(uuid)` | same file, `:810` | No `cascade` |
| 4.2 | `280-is-org-admin.test.sql` | AC-1 `:79`, AC-2 `:88`, AC-3 `:113`, AC-4 `:139`, AC-5 `:178`, AC-6 `:206`, AC-7 `:225`; `plan(45)` |
| 4.3 | `010-catalogue.test.sql:41`, `100-mock-parity.test.sql:203` | Exactly the replacements § 4.3 names. `plan(5)`, the JSON key and the label unchanged |

**How "byte for byte the same, except for the call" was checked**, so the reviewer can repeat it:

- The 19 function bodies were taken from `pg_get_functiondef` with `search_path = ''`, so every type in
  each header is schema-qualified. The call was rewritten by a script that refused to emit unless it
  found exactly 19 functions and 20 sites.
- After the migration was applied, every `public` function's `prosrc` was compared with its value
  before. Each new call was mapped back to `public.is_admin(X)` first. `prosecdef`, `provolatile`,
  `proconfig` and `proacl` were compared too. The only differences were `is_admin` removed and
  `is_org_admin` added. So the grants on the 19 functions are unchanged, and none is restated.
- The 12 policies were written from the source text of their latest `create policy` in
  `supabase/migrations/`. The deparsed `qual` and `with_check` from `pg_policies` were then compared,
  with the same reverse mapping, against the deparse taken before. They were identical. `cmd`,
  `roles` (`{authenticated}`) and `permissive` were checked as well.
- Applying the migration a second time succeeds. The only output is the `drop function if exists`
  notice (ADR-024).

## Deviations from the design

none

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-02` | `entry_enforce_decision`'s re-created `prosrc` is identical to the old one except at `:180` and `:207`. The `prosrc` diff above shows it. So clause (c), which returns an edited approved entry to `pending`, is the same text. The CAL, ADM and `170` files that assert it pass, except 170 test 42, which is unrelated (see Open questions) |
| `INV-03` | Same body, so the code that nulls or keeps `rejection_reason` beside `entry_rejection_reason_iff_rejected` is unchanged. Its 170 assertions (AC-15 and AC-16) pass |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 51 files, 1028 tests. No file changed (AC-8) |
| `pnpm db:test` | 1 | 30 files, 1272 tests. `280` passes 45/45. **One failure: `170-multi-team-decisions.test.sql` test 42**. It fails the same way with this migration removed (see Open questions) |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS. 7 changed files, all in `allowed_paths` |
| `node scripts/check-carry.mjs MIR-16-b` | 0 | PASS. Nothing stray |

## Testability contract

No selectors. The ticket has no UI (§ 2b).

## Open questions

- **`170-multi-team-decisions.test.sql` test 42** (`AC-20: admin_u does not select E`, have 1, want
  0) was checked against a database reset **without** `20261107230000`, with `010` and `100`
  reverted. It fails there in the same way, so this ticket did not cause it. MIR-21-f already
  recorded it (`.ai/board/tickets/MIR-21-f/03-impl-log.md:115`). It is not in
  `.ai/board/model-debt.md`. The likely cause is the test, not the policy. At that point `member_t`
  holds a second-team row on U (`170:86-87`). `admin_u` is an admin on U. So
  `may_decide_entry(admin_u, member_t)` is true, and `entry_select_decider` admits the row. That
  holds under `is_admin` and under `is_org_admin`. The file is outside `allowed_paths`, so it is
  untouched. AC-8 ("every file passes") is therefore met except for this one assertion. It needs an
  owner: a model-debt row at `/ship`, or a ticket.
- The ticket's `state` is left for `/advance` to write from this front-matter (ADR-036), as at PLAN.

## Delegated decisions

- **Grants on the 19 functions are not restated.** The plan says "Grants follow, because `create or
  replace` keeps them". I read that as "they carry over", and the `proacl` comparison confirms it. A
  restated grant could drift from what the original migrations granted.
- **The event "title" in AC-5 is the column `name`.** `event` has no `title` column.
