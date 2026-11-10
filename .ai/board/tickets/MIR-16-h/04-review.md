---
ticket: MIR-16-h
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-08T06:45:10Z
inputs_read: [ .ai/board/tickets/MIR-16-h/01-plan.md, .ai/board/tickets/MIR-16-h/03-impl-log.md, .ai/board/tickets/MIR-16-h/ticket.yaml, .ai/templates/review-report.md, .ai/registry/invariants.md, .ai/standards/architecture.md, .ai/01-operating-model.md, supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql, src/lib/data/supabase.ts ]
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

# MIR-16-h — review

Subject: `git diff origin/main...HEAD` (12 files), plus the working tree, which is clean
(`git status --porcelain` empty).

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed paths ⊆ `allowed_paths`; nothing uncommitted is stray | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-16-h, 12 changed file(s)` … `allowed-paths: PASS`, exit 0. The 12 are the 8 paths at `ticket.yaml:20-27`, plus the ticket folder (3 files) and `.ai/board/backlog.md`, which is SHIP_OWNED. `node scripts/check-carry.mjs MIR-16-h` → `0 uncommitted path(s)` / `PASS — nothing stray`, exit 0 |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`), exit 0, no diagnostics. Run by this reviewer |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm lint` (`eslint .`), exit 0, no findings, repo-wide. The diff has no TS/JS file. Run by this reviewer. `pnpm test`: 52 files and 1041 tests passed |
| R4 | Nothing outside the data-access seam reaches the datastore (RULE-02) | PASS | The diff touches only `supabase/**` and the ticket folder. No file under `src/` changed, so nothing new imports the client outside `src/lib/data/` (`.ai/standards/architecture.md:17`). The only caller is still the seam: `src/lib/data/supabase.ts:1233` `.rpc("set_member_role", { p_member_id, p_role: toDbRole(role) })`, and its string `p_role` resolves to the new `text` parameter at `supabase/migrations/20261108200000_mir16h_member_role_drops_manager.sql:109` |
| R5 | Every § 4 contract item is implemented | PASS | See *R5 detail*. Every item was executed against the local Postgres 17.6 at `20261108150000`; see *Evidence executed by this reviewer* |
| R6 | Permission gating matches plan § 3 | PASS | Door check first, `42501`: `…20261108200000…sql:114-116`. `'org_admin'` is refused `42501`: `:119-121`. Any other word is refused `22023`, after the door check: `:122-123`. Other `x` (not on the caller's teams, another org, not approved, removed, an org admin) is refused `42501`: `:128-138`. `anon` has no EXECUTE and `authenticated` does: `:159-160`, and the live catalogue reads `has_function_privilege` anon=`f`, authenticated=`t`. `member_role_change` RLS and grants are untouched, because no statement in the file touches its policies or grants |
| R7 | No invariant violated (RULE-07) | PASS | `invariants_touched: []` (`ticket.yaml:18`). Per-ID reasoning is in *R7 detail* |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. The diff stat lists neither file |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `begin; … commit;` wrapper | `…20261108200000…sql:22`, `:162` | yes |
| § 4.1 Steps 1–7 inside the `pg_enum` 'manager' guard (ADR-024) | `:24-72`, guard `:26-30` | yes. A second run inside a transaction ran clean (see Evidence) |
| § 4.1 Step 1: drop the audit trigger | `:36` | yes |
| § 4.1 Step 2: `from_role`/`to_role` → `text`; check `member_role_change_roles_known` | `:42-48` | yes. Live: `CHECK ((from_role = ANY (ARRAY['member','manager','org_admin'])) AND (to_role = ANY (…)))` |
| § 4.1 Step 3: drop `set_member_role(uuid, public.member_role)` | `:53` | yes |
| § 4.1 Steps 4–7: rename aside, create `('member','org_admin')`, drop default, re-type with `manager→member`, restore default, drop old type without cascade | `:62-69` | yes. Live labels are `member,org_admin`. Default is `'member'::member_role`. `member_role_old` count is 0 |
| § 4.1 Step 8: `member_record_role_change()` writes `::text`; revoke from public; trigger re-created `after update of role … when (old.role is distinct from new.role)` | `:80-96` | yes. The live `pg_get_triggerdef` matches |
| § 4.1 `set_member_role(p_member_id uuid, p_role text)`: MIR-16-f's body with three named changes | `:106-158` | yes. It was compared line by line with `20261108150000…sql:22-77`. The only deltas are `:119-123` (org_admin text compare plus the new `22023` elsif), `:140` (`v_to := p_role::public.team_role`) and `:152-153` (`coalesce(v_from::text,'member')`, `p_role`). `:134` keeps `m.role <> 'org_admin'::public.member_role` |
| § 4.1 revoke from public, anon; grant to authenticated | `:159-160` | yes |
| § 4.1 Pre-write `pg_depend` check | Done statically by the Developer (`03-impl-log.md` *Deviations* 1). Re-run live by this reviewer before execution: the dependents were the array type, `member.role`, its default, `member_role_change` cols 3 and 4, and `set_member_role(uuid,member_role)`. That is exactly the expected set. `member.role`'s only non-default dependent was the audit trigger, which step 1 drops | yes |
| § 4.2 `330-member-role-without-manager.test.sql`: one `plan(n)`, `tests.seed()`, AC-1 and AC-4 to AC-9 | `supabase/tests/330-member-role-without-manager.test.sql:14` `plan(26)`. AC-1 `:20-23`, AC-4 `:29-33`, AC-5 `:38-71`, AC-6 `:76-96`, AC-7 `:101-112`, AC-8 `:117-122`, AC-9 `:127-144` | yes. 26 assertions counted, 26 planned. Executed: `ok 1` … `ok 26` |
| § 4.3 AC-2 and AC-3 psql procedure | Not run by the Developer (`03-impl-log.md:52`, disclosed). **Executed by this reviewer** (see Evidence) | yes. Only the two former managers' `role` changed (`manager→member`). Member count 5→5. `membership` diff 0 rows. `member_role_change` diff 0 rows, and both rows are `text` with their words kept. A removed manager and a removed org_admin were not refused |
| § 4.4 `_isolation.psql`: `'manager'` → `'member'`, with a comment | `supabase/tests/_isolation.psql:104-106`, `:111` | yes |
| § 4.4 `290:27-28` | `supabase/tests/290-member-role-helper.test.sql:27-28` | yes. `plan(10)` is unchanged |
| § 4.4 `300`: labels, Mona description, cast removed | `supabase/tests/300-org-admin-rename.test.sql:21-22`, `:37`, `:82` | yes |
| § 4.4 `320`: seven `%L::public.member_role` → `%L` | `supabase/tests/320-set-member-role-team-role.test.sql:40`, `:71`, `:103`, `:126`, `:133`, `:140`, `:145` | yes |
| § 4.4 `010:30` census signature | `supabase/tests/010-catalogue.test.sql:30` | yes |
| § 4.4 `seed.sql:489-490` → `'member'::public.team_role`, with a comment | `supabase/seed.sql:487-488`, `:491` | yes. No other `manager` or `member_role` text remains in `seed.sql` (grep) |
| § 5 Seam: none | `src/` is unchanged. `src/lib/data/supabase.ts:1233` | yes |

### Evidence executed by this reviewer

The runner allowed `docker exec … psql` against `supabase_db_calechip`, and denied the `supabase` CLI,
`docker cp`, host `psql` and `node` on a scratch script. The local DB stood at `20261108150000`
(`supabase_migrations.schema_migrations`).

- **The migration applies to the real local schema.** Its body ran without error (see *Side effect* below).
  Afterwards the catalogue reads:
  - `member_role` = `member,org_admin`;
  - `from_role` and `to_role` are `text`;
  - the only `set_member_role` is `set_member_role(uuid,text)`;
  - `member_role_old` is absent;
  - the check constraint is present;
  - the trigger is re-created;
  - no `public` function body casts `'manager'` to `member_role`. The remaining type references,
    in `is_org_admin`, `member_enforce_role_and_removal`, `promote_member_to_admin` and
    `admit_allow_listed_member`, name only `member` or `org_admin`.
- **pgTAP `330`**, inlined with `_isolation.psql` and fed to psql: `1..26`, `ok 1`–`ok 26`, then
  `ROLLBACK`.
- **AC-2 and AC-3**, in one transaction that was rolled back:
  1. The pre-migration three-label type and the enum-typed audit columns were rebuilt.
  2. Five members were inserted: a manager, a removed manager, a member, an org_admin and a removed
     org_admin. Four `membership` rows were inserted, one of them closed, and two audit rows
     (`member→manager`, `manager→member`).
  3. Snapshots were taken, then the migration's statements were run verbatim. The scratch copy was
     checked with `git diff --no-index` against the committed file, which differs only by the
     `begin;` and `commit;` lines.
  4. The diff showed exactly the two former managers going `manager→member` and nothing else.

AC-10 (`supabase db reset`) was not executed, because the CLI was denied. It holds by inspection.
Every seeded `member` insert names `org_admin` or `member`, and the membership mirror now writes
`'member'::public.team_role` unconditionally (`seed.sql:491`).

### Side effect — for the operator

My first probe piped the migration body (without its `begin;`/`commit;`) into psql in autocommit
mode. **`20261108200000` is therefore now applied to the local `supabase_db_calechip` database, and it
is not recorded in `supabase_migrations.schema_migrations`.** Nothing in the repository, the registry
or any hosted project was touched.

The file is idempotent: the guard is false on a second run, and step 8 is `create or replace`. So a
later `supabase migration up` re-applies it as a no-op and records it, and `supabase db reset` restores
a clean state either way. A person should still know that the local DB is ahead of its migration
table. This is a reviewer error, not a finding against the ticket.

## R7 detail

`invariants_touched: []` (`ticket.yaml:18`). No ID is listed, so each invariant the change could
plausibly reach was reasoned through individually:

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 (absence count, membership windows) | No statement writes `membership`, or its `joined_at` or `left_at`. The migration's writes are DDL on `member.role` and `member_role_change`, plus the `set_member_role` body, whose only `membership` write is `team_role` and `updated_at`, the same as MIR-16-f. Executed: `membership` diff across the migration was 0 rows | `…20261108200000…sql:42-48`, `:64-68`, `:146-149`; `20261108150000…sql:63-65` |
| INV-07 (one member, counted against every team they belong to) | `membership` rows are unchanged (0-row diff). No `entry` row or column is touched | same as above |
| INV-01, 02, 03, 05, 06 (entry overlap, approval reset, rejection reason, tentative counting, portion) | No statement touches `public.entry` or its triggers | `…20261108200000…sql:22-162` (entire file: tables named are `member`, `member_role_change`, `membership` only) |

Not a registry invariant, but the demotion guard is the property the type swap could have bypassed.
It is held. The re-type fires no row trigger, so `member_enforce_role_and_removal` never met a
"demotion", and after the migration it still refuses one. Executed: `330` `ok 19`. The refusal is
in the DB trigger and not in a UI affordance.

## Findings

None.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

**Note for a human (not a gate item).** `src/lib/data/supabase.ts:1252-1254` still says `22P02` is
PostgREST failing to cast to `public.member_role`. That cast no longer happens: a non-rank word now
reaches the body and gets `22023`. Both codes fall to the `default` branch at `:1261`, so behaviour
is unchanged. The comment is stale, and it belongs to MIR-17, which § 1 assigns the seam vocabulary.

## Verdict

`PASS`. Every R1–R8 check holds. The ticket advances to DONE.
