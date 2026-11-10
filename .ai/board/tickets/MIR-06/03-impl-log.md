---
ticket: MIR-06
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-23T08:50:00+07:00
inputs_read:
  - .ai/board/tickets/MIR-06/01-plan.md
  - .ai/board/tickets/MIR-06/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - .ai/standards/rbac-and-security.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/tickets/MIR-05/03-impl-log.md
  - supabase/tests/000-harness.test.sql
  - scripts/db-test.mjs
  - .github/workflows/verify.yml
  - supabase/migrations/*.sql (all 45)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-06 — implementation log

**Every contract item in plan § 4 is built. The suite is 309 assertions in nine files; against all 45
migrations it gives 305 `ok`, 4 `not ok # TODO` (three findings, F-1 to F-3), and no real failure.**

**It was not run by `pnpm db:test`.** Docker is not installed on this machine (Docker Desktop has been
removed; `/usr/local/bin/docker` is a dangling link), so the Supabase local stack cannot start. And
CI's `database` job will not run it on the pull request either: `verify.yml:15-19` triggers on
`release/**` only (operator, 2026-10-17). It was run instead on a scratch rig, described under
*Verification run*, which is the evidence below and is not committed. **The reviewer, or the operator
before merge, should run `pnpm db:test` once on a machine with Docker** — that is the only run that
exercises the real Supabase image and the CLI's `pg_prove`.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/tests/_isolation.psql` | created | The fixture and helpers every test file includes with `\ir`; the `tests` schema lives and dies inside each file's transaction | § 4.1, § 4.2, § 4.3 |
| `supabase/tests/010-catalogue.test.sql` | created | The definer census and the anon EXECUTE set, read from `pg_proc` | § 4.5 (AC-12), § 4.6 privilege half (AC-10) |
| `supabase/tests/020-entry-reads.test.sql` | created | Entry reads across teams, by table and by RPC | § 4.4 AC-2, § 4.7 entry rows |
| `supabase/tests/030-member-reads.test.sql` | created | Member and team reads across teams | § 4.4 AC-3, § 4.7 seam-parity / cal-12 rows |
| `supabase/tests/040-member-self-writes.test.sql` | created | Own role/status/team, by table and by the four RPCs, for member, manager and admin | § 4.4 AC-4 |
| `supabase/tests/050-cross-team-writes.test.sql` | created | Admin and manager writes on the other team's entries, team row and members | § 4.4 AC-5, AC-6, § 4.7 write rows |
| `supabase/tests/060-removed-and-pending.test.sql` | created | Every table and RPC of AC-7, for removed_t, removed_admin_t and pending_p | § 4.4 AC-7, AC-8 |
| `supabase/tests/070-definer-callers.test.sql` | created | Every row of the § 4.5 RPC table, with its unchanged-target re-read | § 4.5 AC-9, § 4.7 cross-team-reads / cross-team-role rows |
| `supabase/tests/080-guest-tokens.test.sql` | created | anon table selects and the guest-token boundary | § 4.6 AC-10 table half, AC-11 |
| `supabase/tests/090-event-boundaries.test.sql` | created | Event visibility, edit/delete, attendance and guest-link boundaries | § 4.7 events / event-attendance / guest-link rows |
| `.ai/board/tickets/MIR-06/03-impl-log.md` | created | This log | gate |

`001-isolation-helpers.test.sql` was not created: `\ir` worked (§ 4.1's `TODO(verify)`, below).

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 file layout and per-file shape | each `0n0-*.test.sql` | `begin; \ir _isolation.psql; plan(n); tests.seed(); … finish(); rollback;`. 010 and 080 add `set local search_path = extensions` so `regprocedure` and `pg_get_function_result` text prints `public.`-qualified whatever the session path is |
| 4.1 `\ir` mechanism | `_isolation.psql` | `TODO(verify)` half-resolved: psql 17 `-f` resolves `\ir` relative to the test file (rig run). pg_prove runs each file through psql the same way, and `supabase test db` is given the directory `supabase/tests` (`scripts/db-test.mjs:34`), so `_isolation.psql` is beside each test. Whether the CLI's container mounts the whole directory is still unverified — no Docker here |
| 4.2 `tests.seed()` | `_isolation.psql:74` | |
| 4.2 `tests.authenticate_as(uuid)` | `_isolation.psql:32` | claims `{"sub","role"}` + `role = authenticated`, both transaction-local |
| 4.2 `tests.authenticate_anon()` | `_isolation.psql:42` | |
| 4.2 `tests.clear_authentication()` | `_isolation.psql:51` | `role = none`, claims `''` |
| 4.2 `tests.rows_affected(text)` | `_isolation.psql:61` | |
| 4.2 grants | `_isolation.psql:10`, last line | usage on `tests`, execute on every function, to `anon, authenticated` |
| 4.3 fixture | `_isolation.psql:74-165` | every row of the table and the bullet list; ids through `tests.id(label)` (see Deviations) |
| 4.4 AC-2 | `020-entry-reads.test.sql` | member_t and manager_t; control member_u; plus admin_t RPC controls |
| 4.4 AC-3 | `030-member-reads.test.sql` | directory assertion carries `todo` F-3 |
| 4.4 AC-4 | `040-member-self-writes.test.sql:9` (`tests.self_writes`) | 3 callers × 7 refusals, then the owner re-read |
| 4.4 AC-5 / AC-6 | `050-cross-team-writes.test.sql` | 7 + 2 zero-row writes, three owner re-reads, controls by admin_t, admin_u, manager_u, member_u |
| 4.4 AC-7 / AC-8 | `060-removed-and-pending.test.sql:9` (`tests.reads_nothing`) | 12 tables + `member` own row + 8 RPCs + `member_role_change` 42501, × 3 callers |
| 4.5 AC-12 census | `010-catalogue.test.sql` | `pg_proc` agreed with the plan's list exactly: 52 functions (19 RPC + 10 predicate + 6 guest + 17 trigger). No difference to record |
| 4.5 AC-9 RPC table | `070-definer-callers.test.sql:11` (`tests.refused`) | every row, every caller, every refusal form; the four controls |
| 4.6 AC-10 privileges | `010-catalogue.test.sql` | anon EXECUTE set carries `todo` F-1; `notify(...)` for anon and authenticated |
| 4.6 AC-10 tables / AC-11 | `080-guest-tokens.test.sql` | 15 tables (AC-7's twelve, `member`, `holiday`, `member_role_change`); `busy_day` carries `todo` F-2 |
| 4.7 mirror | named in each assertion's description | every row of the § 4.7 table; the description quotes the mock location |
| AC-1 | first assertion of each file | `is(current_user, 'authenticated' / 'anon')`; every access assertion runs after `authenticate_*` |
| AC-13 | each file's `AC-13 control` assertions | a control per refusal family, against the same fixture row |
| AC-14 | three `todo()` calls, § *Findings* | no assertion inverted, weakened or deleted |

## Findings (AC-14)

Each is an assertion written exactly as the plan specifies, failing against today's migrations,
preceded by `todo('MIR-06 finding F-<n>: …')`. pgTAP reports them `not ok … # TODO`, which TAP counts
as passing, so the suite exits 0. None is fixed here — a fix is a migration (plan § 1, Out of scope).

**F-1 — `anon` may execute 18 functions besides the six guest functions.** (AC-10, `010`.)
Supabase's default privileges grant EXECUTE on every new function in `public` to `anon` and
`authenticated` directly, and these migrations revoke only `from public`, which does not touch a
direct grant. The functions and the line that permits each:
`is_admin(uuid)`, `member_team_id(uuid)` — `20260831150024_tea01_membership.sql:70`;
`reject_entries(uuid[],text)` — `20260905230000_adm06_reject_entries.sql:98`;
`list_teams()`, `list_all_members()`, `create_team(text)`, `rename_team(uuid,text)`,
`delete_team(uuid)`, `admit_member(uuid,uuid)`, `move_member(uuid,uuid)` —
`20260911180000_solo_many_teams.sql:215-221`;
`may_decide(uuid)` — `20260912100000_solo_manager_role.sql:69`;
`list_members_for_team(uuid)`, `list_team_entries_for_team(uuid)`,
`list_team_entries_overlapping_for_team(uuid,date,date)` — `20260922150000_cal11_cross_team_reads.sql:67-69`;
`set_member_role(uuid,member_role)` — `20260924100000_solo_cross_team_role.sql:126`, restated at
`20261020150000_mir03_bounded_role_changes.sql:121`;
`promote_member_to_admin(uuid)` — `mir03:158`;
`reject_member(uuid)`, `set_member_team(uuid,uuid)` — `20261020120000_mir02_member_self_writes.sql:232,234`.
Every one of the RPCs refuses a null `auth.uid()` in its body, so this is not a write path for
`anon`. The predicates are the exposure: `is_admin` and `member_team_id` answer "is this uuid an
admin" and "which team is this uuid on" for any uuid, signed out. The evt-era migrations
(`evt01:189` onwards) already write `from public, anon`, which is the fix shape.

**F-2 — `anon` holds SELECT on `public.busy_day`.** (AC-10, `080`.)
`20260911090000_solo_busy_day.sql:79` revokes `from authenticated` only, so the default grant to
`anon` survives. RLS has no `anon` policy, so the select returns zero rows rather than raising
`42501` — no row leaks today; the second lock (the grant) is missing, which is exactly
`rbac-and-security.md` known weakness 1.

**F-3 — `list_member_directory()` returns members of U to a member and a manager of T.** (AC-3, `030`,
two assertions.) The fixture's public events are created by `member_u` and attended by `member_u2`,
and `20261020180000_mir04_scoped_member_directory.sql:33-45` adds exactly those people (ADR-066,
accepted by the operator 2026-10-20). **This is very probably not a hole but a mis-specified AC-3:**
the plan says "neither RPC returns a member of U" without excepting the people ADR-066 lets the
caller see. Kept as specified, per AC-14. Needs a decision — see Open questions.

## Deviations from the design

1. **`tests.id(label)`, a sixth helper.** § 4.3 says the uuids are "declared once as constants at the
   top of `_isolation.psql`" and tests use the labels only. A psql variable cannot be read inside a
   pgTAP SQL string or a helper function, and would not survive § 4.1's fallback, so the constants
   are one immutable SQL function over a `values` list (`_isolation.psql:14`). Same labels, same NN.
2. **Attendance inserts name `event_id` only.** § 4.7 writes `insert into event_attendance (event_id,
   member_id)`. `member_id` has no insert grant (`evt02:453`, `grant insert (event_id)`), so that
   statement raises 42501 on the column privilege for every caller — the four refusals would pass
   for the wrong reason and the `member_t2` control could never succeed. The tests insert
   `(event_id)` and let `member_id` default to `auth.uid()`, as the client does; the refusal then
   comes from `event_attendance_insert_own` / `event_attendance_guard`, which is the boundary.
3. **Helper functions per file** (`tests.self_writes`, `tests.reads_nothing`, `tests.reads_something`,
   `tests.refused`, `tests.anon_reads_no_table`, `tests.attend_refused`, `tests.guest_link_refused`),
   created in the file that uses them, inside its transaction. They loop the same assertion over the
   callers § 4.4/§ 4.5 name; they add no behaviour.
4. **Extra assertions beyond the letter of § 4**, all of them positive controls or shape checks:
   the four `pg_get_function_result` checks in `080` (how AC-11's "no email, id or token" is
   asserted for every guest read, since `columns_are` is for tables), the `t₂` attendee set, and
   per-table controls in `060`.
5. **`ticket.yaml` not edited.** The command text says "set the ticket to REVIEW"; ADR-036 and
   `01-operating-model.md:347-348` make that `/advance`'s write, from `next_state` above.

## Invariants

`invariants_touched: []`. No migration, policy, trigger, grant or seam function is changed; every
write is a fixture row or a test statement inside a transaction that ends in `rollback`.

| ID | Still holds because |
|----|---------------------|
| INV-01 | The fixture's entries do not overlap per member (`member_t`, `member_u` 11-02..03; `member_u2` 11-04), and `entry_no_overlapping_portion` is untouched |
| INV-07 | Members are inserted with their team by the session user; no test path changes `team_id` except the `move_member` / `set_member_team` controls, through the existing functions and trigger |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm db:test` | not run | No Docker on this machine (see top). Not run by CI on the PR either (`verify.yml:15-19`) |
| scratch rig, all ten test files | 0 failures | 309 assertions: 305 `ok`, 4 `not ok # TODO` (F-1, F-2, F-3 ×2), 0 plan mismatches, 0 errors |
| `git status --porcelain` ⊆ `allowed_paths` | yes | ten paths under `supabase/tests/` plus this file |

**The rig**, so the reviewer can judge what it proves. Homebrew PostgreSQL 17.11 and pgTAP 1.3.3 built
from source, in the session scratchpad, not committed. Before the migrations it creates what the
Supabase image provides and the migrations reference: roles `anon`, `authenticated`, `service_role`;
schemas `auth` (`users`, `uid()` reading `request.jwt.claims` as Supabase's does), `extensions`,
`storage`, `vault`, `net` (`http_post` stub; the one `create extension if not exists pg_net` line is
skipped in a copy); `supabase_migrations.schema_migrations`; and **Supabase's default privileges** —
`alter default privileges in schema public grant all on tables, functions, sequences to anon,
authenticated, service_role`. F-1 and F-2 depend on that last line being true of the real image. If
it is not, those two assertions pass and pgTAP reports them as unexpectedly passing TODOs — the
suite still exits 0, and the `todo()` lines come out. Every file was run with pg_prove's psql flags
(`-qtAX -v ON_ERROR_ROLLBACK=1 -v ON_ERROR_STOP=1 -f`).

## Testability contract

No selectors: this ticket has no screen (plan § 2b).

## Open questions

1. **F-3: amend AC-3 or treat it as a hole?** Two options for the tech lead / operator:
   (a) amend AC-3 to "no member of U the caller shares no event or notification with" and drop the
   `todo`; (b) keep it as a finding against ADR-066. The developer's reading is (a), since ADR-066 is
   an accepted operator decision; nothing was changed pending that call.
2. **F-1 and F-2 need a migration** (`revoke … from anon` on the 18 functions and on `busy_day`).
   That is a new ticket, not this one.
3. **`pnpm db:test` on real Supabase** has not been run for this suite. It needs a machine with
   Docker; CI on `release/**` will run it eventually, but not before this merges.
4. Owed to the human plane, from plan § 7: `testing-standards.md:115-121` can name `supabase/tests/`
   as the permission-model test's path once this merges.
