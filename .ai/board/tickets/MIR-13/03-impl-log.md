---
ticket: MIR-13
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-03T02:54:16Z
inputs_read:
  - .ai/board/tickets/MIR-13/01-plan.md
  - .ai/board/tickets/MIR-13/ticket.yaml
  - .ai/registry/decisions/ADR-071-writers-stamp-org-id-membership-mirrors-member-team-id-and-mir-13-splits-by-operation.md
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - .ai/board/tickets/MIR-12/03-impl-log.md
  - supabase/migrations/ (the latest definition of every function and policy in plan § 4.4)
  - supabase/bootstrap.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/120-composite-fks.test.sql
  - supabase/tests/130-backfill-org-public.test.sql
  - scripts/db-test.mjs
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-13 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql` | created | The one migration of plan § 4, in the section order § 4 requires | § 4.1, § 4.2, § 4.3, § 4.4, § 4.5 |
| `supabase/bootstrap.sql` | modified | The explicit `membership` insert would now collide with the row the mirror trigger writes | § 4.6 (AC-10) |
| `supabase/tests/010-catalogue.test.sql` | modified | The definer census gains the four helpers and the two trigger functions | AC-17 |
| `supabase/tests/120-composite-fks.test.sql` | modified | Five assertions collided with the mirror's rows or with the org-bounded audience; each still tests the FK it named. See *Deviations* 1 | AC-17 |
| `supabase/tests/130-backfill-org-public.test.sql` | modified | MIR-12's AC-8 and AC-9 asserted "nullable, unique (date), until MIR-13" | AC-17 |
| `supabase/tests/140-org-stamping-and-membership-mirror.test.sql` | created | AC-1, AC-2, AC-5 to AC-9 | § 7 coverage |
| `supabase/tests/150-write-path-org-bound.test.sql` | created | AC-11 to AC-16, AC-18 | § 7 coverage |
| `.ai/board/tickets/MIR-13/03-impl-log.md` | created | This log | gate |
| `.ai/board/tickets/MIR-13/ticket.yaml` | modified | `state: REVIEW`, which `/implement` sets on PASS (`.claude/commands/advance.md:35`) | gate |

The three registry and board paths in `allowed_paths` (ADR-071, `MIR-13-b/ticket.yaml`,
`MIR-21/ticket.yaml`) were written at PLAN and committed at `7d944a3`. This stage did not touch them.

## Contract items

All line numbers are in `supabase/migrations/20261103120000_mir13_write_path_org_bound.sql` unless
another file is named.

| Plan item | Implemented at | Notes |
|-----------|----------------|-------|
| § 4.1 `member_org_id` | `:33` | Exact text of the plan |
| § 4.1 `member_team_ids` | `:43` | Exact |
| § 4.1 `member_primary_team_id` | `:54` | Exact |
| § 4.1 `shares_active_team` | `:66` | Exact |
| § 4.1 grants | `:77-84` | `revoke … from public, anon`; `grant execute … to authenticated`. See *Deviations* 3 |
| § 4.2 `member_sync_membership()` + trigger | `:95`, `:164` | `after insert or update of team_id, role, removed_at`. The four rules of ADR-071 decision 2. A move onto a team the member already holds an active row on promotes that row (and sets its `team_role`) instead of inserting |
| § 4.3 `stamp_org_id()` | `:178` | Sets `org_id` only when null, from the ADR-071 table. For `entry` also `primary_team_id` from `member_primary_team_id(member_id)` when null. Parent lookups read the row by id with no status filter |
| § 4.3 twelve triggers | `:221-256` | `<table>_stamp_org_id`, `before insert … for each row` |
| § 4.5.1 MIR-12 backfill re-run | `:261-320` | Copied from `20261031120000_mir12_backfill_org_public.sql`. MIR-12's `raise notice` for orphan entries is dropped because § 4.5.2 refuses on the same condition |
| § 4.5.2 AC-4 guard | `:322-333` | `raise exception 'MIR-13: % entries have no primary team'`, with a hint query |
| § 4.5.3 `SET NOT NULL` ×13 | `:336-349` | Header comment on the inline scan at `:17-19` |
| § 4.5.4 holiday key swap | `:353-358` | `drop constraint if exists`, and `add constraint` guarded for a re-run |
| § 4.4 `create_team` | unchanged | `team_stamp_org_id` supplies the caller's org (AC-12, 150 test 16) |
| § 4.4 `rename_team` | `:371` | `and org_id = member_org_id(caller)` on the update |
| § 4.4 `delete_team` | `:396` | Org check, then the unchanged occupancy check, then delete. See *Delegated decisions* 1 |
| § 4.4 `admit_member` | `:422` | Team check and update both bound to the caller's org |
| § 4.4 `reject_member` | `:446` | Update bound to the caller's org |
| § 4.4 `move_member` | `:465` | Team check and update both bound to the caller's org |
| § 4.4 `set_member_team` | `:490` | `v_team` removed; `m.team_id in (select member_team_ids(caller)) and p_team_id = m.team_id` |
| § 4.4 `set_member_role` | `:516` | `m.org_id = member_org_id(caller)`. Rewrite rule 3 applied as well: `m.team_id in (select member_team_ids(caller))`. See *Deviations* 4 |
| § 4.4 `promote_member_to_admin` | `:552` | Rewrite rule 3 |
| § 4.4 `event_stamp()` | `:583` | `new.team_id := member_primary_team_id(new.creator_id)` |
| § 4.4 `may_manage_event` | `:595` | As the plan |
| § 4.4 `is_event_audience` | `:606` | Rewrite rules, plus `e.org_id = member_org_id(p_uid)` on the whole disjunction |
| § 4.4 `invite_to_event` | `:625` | EVT-12's body with two changes only: the address lookup adds `m.org_id = (event's org)`; the team conversion reads `v_team in (select member_team_ids(m.id))` |
| § 4.4 policies (18) | `:759-948` | Each `drop policy if exists` then `create policy`, same command, `to authenticated`, the clauses of the plan table |
| § 4.6 `bootstrap.sql` | `supabase/bootstrap.sql:213-217` | The insert is replaced by a comment naming the trigger |
| § 4.7 seam and types | — | No change. `git diff --stat` touches nothing under `src/` |

## Deviations from the design

1. **Five assertions in `120-composite-fks.test.sql` changed beyond the one AC-17 names.** AC-17
   lists only the same-org acceptance at `:299-305`. Four more stopped reaching the constraint they
   test once MIR-13 was in place:
   - **Two cross-org `membership` refusals** inserted `is_primary = true`. The mirror trigger already
     wrote Ada's and Cy's active primary rows, so they were refused with `23505` by
     `membership_one_active_primary_idx` before the FK. They now insert `is_primary = false` and get
     the FK's `23503` again.
   - **Two `event_attendance` cross-org refusals** are now refused first by `event_attendance_guard`
     with `42501`, because `is_event_audience` is org-bounded (AC-15). That is the intended
     behaviour. The test disables that one trigger for those two statements, inside its rolled-back
     transaction, so the two FKs are still what the assertions test.
   - **The same-org acceptance** inserts a closed row (`left_at` set), not an active primary one.

   No expected SQLSTATE changed, and no assertion was removed.
2. **AC-10 is verified by the psql procedure below, not in `140`.** The plan's coverage line puts it
   in `140`. Running `bootstrap.sql` from a test needs `\ir ../bootstrap.sql`. `supabase test db
   supabase/tests` mounts that directory into the pg_prove container, and I could not confirm that
   a parent path resolves there: there is no Docker on this machine (*Verification run*).
   `TODO(verify)`: if it does resolve, AC-10 can move into `140`. The procedure runs the real file,
   so this is a choice of harness, not a weaker check.
3. **The four helpers and the two trigger functions also revoke `anon`.** Plan § 4 gives the house
   pattern as `revoke all … from public`. Supabase's default privileges grant `anon` directly, so
   `from public` alone leaves that grant in place. That is finding F-1, the open `todo` in
   `010-catalogue.test.sql`. `evt01_event.sql` already revokes `from public, anon`. AC-18 asks only
   that `public` holds nothing, and this is stricter.
4. **`set_member_role` gets rewrite rule 3 as well as the org conjunct.** The plan's function table
   names only the org conjunct, but § 4.4 says the rewrite rules apply "to each body listed below".
   That body contains `m.team_id = member_team_id(caller)`, which is the rule-3 pattern. Leaving it
   unchanged would make the function single-team while `promote_member_to_admin` beside it became
   multi-team.

## Delegated decisions

1. **`delete_team` checks the org before the occupancy check.** AC-12 requires
   `delete_team(T2)` → `42501`, and T2 has people on it. If occupancy were checked first, the
   answer would be `23503`. That breaks AC-12, and it also tells an admin of Org A that a team of
   Org B exists and is occupied. Plan § 4.4 says the occupancy check is "unchanged", and it is: it
   now runs after an added `if not exists (team in caller's org) → 42501 'no such team'`. The
   `where … and org_id = …` on the delete stays, as the plan specifies.
2. **The mirror sets `team_role` on a row it promotes to primary**, as well as on one it inserts.
   ADR-071 decision 2 says the mirror keeps the active primary row equal to what the backfill rule
   gives for the member's current row. The backfill derives `team_role` from `role`.

## Invariants

| ID | Still holds because |
|----|---------------------|
| INV-04 | The mirror closes every active `membership` window at `greatest(removed_at, joined_at)` when `removed_at` is set (`:143-148`). That is the day ADR-013 stops counting the member. `140` AC-9 asserts no active row after removal and `left_at >= joined_at` on every closed row. `absenceCountsFor` is untouched, so there is still one definition of the count. |
| INV-07 | `entry.primary_team_id` is `NOT NULL` (`:340`) and is stamped from the author's active primary team (`:184-193`). `entry_member_org_fk` keeps the entry in its member's org (`140` AC-7). The mirror keeps one active primary row per member (`140` AC-9 invariant, asserted after every step), so "the team the member belongs to" is still exactly one team. |
| INV-02 | `entry_update_admin` and `entry_update_manager` were re-created with new team predicates only. The reset to `pending` is done by `entry_enforce_decision()`, which is actor-blind and untouched, and no policy can bypass a `before update` trigger. `050-cross-team-writes` and `060-removed-and-pending` pass unchanged. |

## Verification run

**No Docker on this machine.** `/usr/local/bin/docker` points into a removed
`/Applications/Docker.app`, so `pnpm db:test` cannot start the Supabase stack. The equivalent was
run on a scratch PostgreSQL 17.11 cluster (Homebrew, the same major as `supabase/config.toml:41`)
with pgTAP. That cluster had stub `auth`, `storage`, `vault` and `net` schemas and the `anon`,
`authenticated` and `service_role` roles. Every migration was applied in order, with only
`create extension if not exists pg_net` replaced by a stub `net.http_post`. Each test file was then
run with `psql -f`. **`pnpm db:test` itself is still owed** (see *Open questions*).

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 49 files, 993 tests. Includes `tests/draft-entry.test.ts` AC-14: the migration does not mention `overload_threshold` (AC-19) |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-carry.mjs MIR-13` | 0 | PASS, nothing stray |
| pgTAP, all 16 files, scratch PG17 | 0 | Baseline before the migration: 14 files pass (030 carries its 2 pre-existing `todo`s). After: 16 files pass. 140: 42/42. 150: 46/46 |
| Mutation check | — | With `may_manage_event` and `admit_member` restored to their pre-MIR-13 bodies, `150` fails tests 7, 17, 40 and 42 (AC-12, AC-15). The tests detect the defect they target |
| Second apply of the migration | 0 | Idempotent (ADR-024) |
| `git diff --name-only` ⊆ `allowed_paths` | yes | Plus this ticket's own `03-impl-log.md` and `ticket.yaml` |

### AC-3, AC-4, AC-10 — psql procedure

The plan names `supabase db reset --version 20261031120000` then `supabase migration up`. Both flags
exist on the installed CLI 2.116.0 (`--version string  Reset up to the specified version`; `migration
up --local`). Both need Docker, so the scratch harness did the same steps: rebuild from every
migration up to and including `20261031120000`, run the owner-side inserts, then apply the later
migration.

**AC-3.** At MIR-12, as the owner: one team, one approved member on it, one entry, one `busy_day`,
and one holiday, all with `org_id` null (the entry's `primary_team_id` null too). Before:

```
 team_org | member_org | entry_org | entry_ptid | busy_day_org | holiday_org
----------+------------+-----------+------------+--------------+-------------
          |            |           |            |              |
```

The migration applied with exit 0. After:

```
 team_shared | member_shared | entry_shared | entry_ptid_is_members_team | busy_day_shared | holiday_shared | active_primary
-------------+---------------+--------------+----------------------------+-----------------+----------------+----------------
 t           | t             | t            | t                          | t               | t              |              1
```

A second apply of the same file exited 0.

**AC-4.** At MIR-12, a pending member with `team_id` null and one entry for it. Applying the
migration:

```
ERROR:  MIR-13: 1 entries have no primary team
HINT:  select e.id, e.member_id from public.entry e where e.primary_team_id is null;
exit=1
```

Afterwards, `not_null_columns = 0` across the thirteen columns, and `mir13_triggers = 0`. The whole
transaction rolled back.

**AC-10.** On a fresh database with every migration applied, with an `auth.users` row for
`zero@mir13.test`:
`PGOPTIONS="-c calechip.bootstrap_email=zero@mir13.test -c calechip.bootstrap_team_name=Bootstrap" psql --single-transaction -f supabase/bootstrap.sql`
→ `DO`, exit 0. Admin zero then has `active_primary_rows = 1`, with `team_role = 'member'`, and
`all_rows = 1`.

## Testability contract

No selectors. This ticket changes no screen (plan § 2b).

## Open questions

1. **`pnpm db:test` has not run on the real Supabase stack.** Everything above ran on PG17 with stub
   platform schemas. The stubs cover what the migrations call. They do not reproduce Supabase's
   default privileges, its `auth` triggers, or the pg_prove runner. CI's `database` job
   (`verify.yml`) runs the real command, and so does any machine with Docker.
2. **`email_invitation()` (EVT-12) still looks up a member by address with no org condition**
   (`20261014090000_evt12_invite_every_scope.sql:227-234`). After this ticket, `invite_to_event`
   treats another org's member as an outsider: it opens the guest link and writes the invitation
   (AC-16). The trigger finds that same person as a member who cannot read the event, so it returns
   without mailing. The result is a guest invitation that is never sent. Nothing triggers this
   until a second org exists (MIR-18). The plan does not list the function, so it was not changed.
   It fits MIR-13-b or MIR-15. The fix is the same one-line condition `invite_to_event` gained.
3. **Read-slice effects seen while testing, for MIR-13-b:** `member_select_team` and
   `entry_select_team` still read `member_team_id`. A non-primary membership therefore grants
   write *policy* reach to rows the caller cannot *see*, so an update of such a row affects
   nothing. `140` and `150` work around this explicitly, with comments. It cannot occur in
   production until something writes a non-primary row, and under this ticket only tests do.
