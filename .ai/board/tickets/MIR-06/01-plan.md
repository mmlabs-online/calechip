---
ticket: MIR-06
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-23T08:23:14+07:00
inputs_read:
  - .ai/board/tickets/MIR-06/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/tickets/MIR-05/01-plan.md
  - .ai/board/tickets/MIR-02/verification.md
  - .ai/board/tickets/MIR-03/verification.md
  - .ai/board/tickets/MIR-04/verification.md
  - supabase/tests/000-harness.test.sql
  - supabase/config.toml
  - supabase/seed.sql
  - scripts/db-test.mjs
  - supabase/migrations/*.sql
  - the test locations listed in ticket.yaml mir_detail
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-06 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md:295`:**

| ID | Title | Group | Status |
|---|---|---|---|
| MIR-06 | An SQL isolation suite proves each boundary as a real authenticated role against real policies | MIR | PLANNED |

**Plan item P1-2, transcribed from `.ai/board/plans/calechip-multi-tenancy-plan.md:112-122`:**
each test runs as a real authenticated role against real policies:

- A member cannot read another team's entries
- A member cannot read another team's members
- A member cannot alter their own role, status or team
- An admin cannot decide another team's entries
- A manager cannot decide outside their team
- A removed member reads nothing
- A pending member reads nothing
- Every `security definer` function rejects a caller who should not reach it
- Every `anon`-callable guest RPC leaks nothing beyond its token's event

`ticket.yaml` `mir_detail` adds the mock-only isolation assertions this suite must mirror (audit
A:879-911) and the definer list in audit §5 (A:724-738).

**Why it matters.** ADR-005 makes row-level security the only authorization mechanism, and
`architecture.md:97-99` says the permission-model test executes against a real PostgreSQL with a
token per role. MIR-05 shipped the harness (`pnpm db:test`, CI job `database`) and one self-test.
No boundary is yet proven: every isolation assertion in the repository runs against the mock
(audit §8), and `tests/cross-team-reads.test.ts:6-8` says its Supabase refusals "are exercised by no
test". This ticket gives the **reviewer of every later MIR ticket** — above all the phase-3 policy
rewrite (MIR-13), which is "unverifiable" without it (plan:103-104) — a suite that fails when a
boundary that holds today stops holding, and it surfaces, as named findings, any boundary that does
not hold today.

**Out of scope.**

- **Fixing any hole the suite finds.** A fix is a migration (RULE-09, ADR-014). A failing boundary is
  recorded as a finding (AC-12) and goes to the operator; it is not repaired here.
- **Fixing the mock and the mock/SQL parity test** (P1-3) — MIR-07. Including the comments at
  `tests/cross-team-reads.test.ts:6-8` and `tests/cross-team-role.test.ts:7-11`, which stay as they
  are; MIR-07 owns those files.
- **Un-pinning Playwright from the mock** (`tests/e2e/seam.setup.ts`). The three e2e locations in
  `mir_detail` are mirrored at the SQL level only.
- **Positive behaviour of each RPC** beyond the one control per refusal AC-13 requires. This is an
  isolation suite, not a functional suite for teams, events or guests.
- **Whether `authenticated` should execute the uid-taking predicates** (`is_admin`,
  `member_team_id`, `may_decide`, `is_event_*`, `may_manage_event`, `may_read_event`). Policies
  call them, so `authenticated` must; whether a member probing another uuid through them is a leak
  is undecided anywhere in the registry and is not asserted. `anon`'s access to them is asserted
  (AC-10).
- **`set_event_email` for a pending caller.** `rbac-and-security.md` denies the switch once
  *removed*; it says nothing of pending. Only removed is asserted.
- **Any migration, seed, `config.toml`, `scripts/db-test.mjs` or workflow change.** MIR-05's harness
  is used as shipped.
- **Standards edits** — `testing-standards.md:115-121`'s `TODO(project)` path for the
  permission-model test is human-plane; named in § 7.

`size_estimate: M` — nine test files and one fixture, no production code.

## 2. Acceptance criteria

Terms used below. **Team T** and **team U** are two fixture teams. A caller is *approved* when
`status = 'approved'` and `removed_at is null`. **Run as X** means: the transaction's role is
`authenticated` (or `anon`) and the JWT claims carry X's id, so `auth.uid()` returns X — never the
superuser. **Refused** means one of three outcomes, and each AC names which: *raises* an exact
SQLSTATE; *returns empty* (zero rows, or NULL / false for a scalar); *affects zero rows* (an
`update`/`delete` reports 0 rows and the row, re-read without RLS, is unchanged).

**AC-1 — every boundary assertion runs as a real role**
- Given any test file this ticket adds under `supabase/tests/`
- When `pnpm db:test` runs it
- Then every assertion about access is made while `current_user` is `authenticated` or `anon`, the
  file asserts that at least once per role it uses, and the file ends in `rollback` so no fixture
  survives it.

**AC-2 — a member cannot read another team's entries**
- Given approved members of T (rank member, and rank manager) and an entry of each status owned by
  a member of U
- When each, run as themselves, selects from `public.entry`, calls
  `list_team_entries_for_team(U)` and `list_team_entries_overlapping_for_team(U, <range covering the
  entries>)`
- Then the select returns no row whose member is on U (including with `status = 'pending'`, as the
  approval worklist reads it), and both RPCs return empty.

**AC-3 — a member cannot read another team's members**
- Given the same callers, and approved, removed and pending people on U
- When each selects from `public.member`, and calls `list_members_for_team(U)` and
  `list_member_directory()`
- Then the select returns no row with `team_id = U` and no pending row, and neither RPC returns a
  member of U.

**AC-4 — nobody alters their own role, status or team**
- Given an approved member, manager and admin of T, each acting on their own row
- When each runs `update public.member set role = …`, `set status = …`, `set team_id = U` on their
  own id, and calls `move_member(self, U)`, `set_member_team(self, U)`, `set_member_role(self,
  'manager')` and `promote_member_to_admin(self)`
- Then every one raises `42501`, and the row's `role`, `status` and `team_id` are unchanged.

**AC-5 — an admin cannot decide, edit or delete another team's entries, or write another team**
- Given an approved admin of T and a pending entry of a member of U
- When the admin sets that entry's `status` to `approved`, then to `rejected` with a reason, edits
  its `note`, deletes it, updates team U's `overload_threshold`, `wfh_need_approve` and
  `pto_need_approve`, and sets `removed_at` on a member of U
- Then each affects zero rows, and the entry, team U and the member of U are unchanged.

**AC-6 — a manager cannot decide outside their team**
- Given an approved manager of T and a pending entry of a member of U
- When the manager sets that entry's `status` to `approved`, then to `rejected` with a reason
- Then each affects zero rows and the entry is unchanged.

**AC-7 — a removed member reads nothing**
- Given a removed member of T (rank member) and a removed admin of T, and fixture rows in every
  table listed below on both T and U
- When each, run as themselves, selects from `entry`, `team`, `member`, `busy_day`, `event`,
  `event_attendance`, `event_invitee`, `event_guest`, `event_guest_link`,
  `event_email_invitation`, `notification`, `task` and `issue_report`, and calls `list_teams()`,
  `list_all_members()`, `list_members_for_team(T)`, `list_team_entries_for_team(T)`,
  `list_team_entries_overlapping_for_team(T, …)`, `list_member_directory()`,
  `list_event_guest_emails(<an event of T>)` and `guest_link_event_id(<an open token of T>)`
- Then every select returns zero rows **except** `member`, which returns exactly the caller's own
  row, and every RPC returns empty; and `select` on `member_role_change` raises `42501`.

**AC-8 — a pending member reads nothing**
- Given a pending sign-up (`team_id is null`, `status = 'pending'`)
- When they run the same reads as AC-7
- Then the same outcome as AC-7.

**AC-9 — every callable `security definer` function refuses the caller who should not reach it**
- Given each `security definer` RPC in § 4.5's table, and for each the callers that table names
  (approved member, approved manager, removed admin, and where the boundary is a team, an approved
  admin of the other team)
- When that caller calls it with the arguments the table names
- Then it is refused exactly as the table states (raises `42501`, or returns empty), and where the
  function writes, the target row is unchanged.

**AC-10 — `anon` reaches exactly the six guest functions and no table**
- Given the database with every migration applied
- When the catalogue is read for every function in schema `public`, and `anon` selects from each
  table in AC-7 plus `holiday` and `member_role_change`
- Then `has_function_privilege('anon', f, 'EXECUTE')` is true for exactly `get_guest_event(text)`,
  `list_guest_event_attendees(text)`, `get_guest_event_terms(text)`, `register_guest(text, text,
  text)`, `get_guest_registration(text)` and `cancel_guest_registration(text)`, and false for every
  other non-trigger function in `public`; neither `anon` nor `authenticated` holds EXECUTE on
  `notify(...)`; and every table select by `anon` raises `42501`. (`rbac-and-security.md` § *Signed
  out*.)

**AC-11 — a guest token reaches its own event and nothing else**
- Given two events, one on T and one on U, each with an open guest link (tokens *t₁*, *t₂*), an
  attending member and an attending guest, and a guest registration on each with a known manage
  token (*m₁*, *m₂*)
- When `anon` calls `get_guest_event`, `list_guest_event_attendees` and `get_guest_event_terms`
  with *t₁*, `get_guest_registration` with *m₁*, and each of the four with an unknown well-formed
  token and with *t₁* after its link row is deleted
- Then with *t₁* every result describes only the T event — its name, and attendee names drawn only
  from its own attendance and guests — the columns are exactly those named in § 4.6, no result
  carries an email, an id or a token; with *m₁* only the registration of *m₁* is returned; the
  unknown and the deleted token return empty; and `cancel_guest_registration(m₁)` changes the status
  of *m₁*'s registration only, leaving *m₂*'s unchanged.

**AC-12 — no definer function escapes the suite**
- Given the list of `security definer` functions in schema `public` that the suite declares in
  § 4.5, including the triggers it classifies as not callable
- When the suite reads `pg_proc` for every function in `public` with `prosecdef`
- Then the two sets are equal; a definer function added by a later migration fails the suite until it
  is classified.

**AC-13 — every refusal has a positive control**
- Given each refusal in AC-2 to AC-9 and AC-11
- When the suite runs
- Then the same file also asserts that an entitled caller performs the same read or write
  successfully against the same fixture (e.g. a member of U reads U's entry; an admin of T approves
  a T entry; *t₂* returns the U event), so a refusal cannot pass because the fixture is empty.

**AC-14 — a boundary that does not hold today is reported, not hidden**
- Given an assertion written to AC-2 to AC-12 that fails against the current migrations
- When the suite is run
- Then that assertion is kept exactly as specified, preceded by pgTAP `todo()` whose text starts
  `MIR-06 finding F-<n>:` and names the hole in one line; `03-impl-log.md` § *Findings* lists F-<n>
  with the migration `file:line` that permits it; and `pnpm db:test` exits 0. No assertion is
  inverted, weakened or deleted to make it pass.

**AC-15 — the mock-only assertions are mirrored**
- Given each location in `ticket.yaml` `mir_detail` § *Mock-only isolation assertions*
- When the suite runs
- Then each is covered by a named SQL assertion, per the mapping in § 4.7.

**Invariants touched: `[]`.** No migration, policy, trigger or seam function changes; the suite
writes only fixture rows inside a rolled-back transaction. INV-01, INV-02 and INV-07 hold on the
fixture writes by the existing constraint and triggers, which the tests do not alter. Written back to
`ticket.yaml`.

**Open questions.** None that block. Three readings are recorded as **assumptions**, and each ships:

1. *"Reads nothing"* (AC-7, AC-8) excludes the caller's own `member` row and the holiday calendar.
   `member_select_own` (`tea01_membership.sql:153`) has no status or removal condition, and the
   client reads that row to learn it is pending or removed (`supabase.ts` `readCurrentMember`);
   `holiday_select_all` (`adm02_holiday.sql:58`) is deliberately global (`rbac-and-security.md`,
   *Read the holiday calendar* — every role). Every other table is in AC-7.
2. *"An admin cannot decide another team's entries"* is read as the entry write paths only. Admins
   *reading* another team (`list_*_for_team`) and administering teams across the deployment
   (`create_team`, `admit_member`, `move_member`) are by design today (CAL-11, `solo_many_teams`)
   and are not refusals.
3. *"Every `security definer` function"* (AC-9) is the callable RPCs. Trigger functions cannot be
   invoked as an RPC by any role; they are classified in AC-12 rather than called. The uid-taking
   predicates are covered for `anon` in AC-10 (see Out of scope).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

*(This ticket has no screen; nothing visual is designed.)*

## 3. Permission model

The suite asserts the rows of `rbac-and-security.md` § *The permission table* that are team or
status boundaries, and § *Signed out*. Where each check lives, as asserted:

| Boundary | Held by (server side) | AC |
|---|---|---|
| Entry reads, own team | `entry_select_team` (`cal01_entry.sql:203`) via `member_team_id` | 2, 7, 8 |
| Member reads, own team | `member_select_team` (`tea03:34`), `member_select_own`, `member_select_pending_admin` | 3, 7, 8 |
| Own role/status/team | column grants revoked (`mir02:163`) + `member_enforce_role_and_removal` (`mir02:45`) | 4 |
| Entry decide/edit/delete | `entry_update_admin`/`entry_delete_admin` (`cal03:80,101`), `entry_update_manager` (`solo_manager_role.sql:90`), `entry_enforce_decision` | 5, 6 |
| Team writes | `team_update_admin` (`adm01:62`) | 5 |
| Member removal | `member_update_admin` (`tea04:42`) | 5 |
| Removed / pending | `member_team_id` / `is_admin` / `may_decide` return NULL/false unless approved and not removed (`solo_member_approval.sql:57,69`, `solo_manager_role.sql:55`) | 7, 8 |
| Definer RPCs | each function's own `is_admin` / `may_manage_event` / team condition | 9 |
| Signed out | function grants (`evt06:109-112`, `evt07` § 7); no `anon` policy or table grant | 10, 11 |

Denials asserted, per role: member — every row above; manager — entry edit/delete of others, any
admin RPC, decide outside T; admin — anything on U's entries, U's team row and U's members, own
role/status/team; removed and pending — every read; `anon` — every table, every non-guest function.
No interface check exists or is tested.

## 4. Contract

### 4.1 Files

All under `supabase/tests/`. `pnpm db:test` (MIR-05) runs every `*.test.sql` there.

| File | ACs |
|---|---|
| `_isolation.psql` | fixture and helpers, included by every file below; not a test itself |
| `010-catalogue.test.sql` | 10 (privileges), 12 |
| `020-entry-reads.test.sql` | 2, 13 |
| `030-member-reads.test.sql` | 3, 13 |
| `040-member-self-writes.test.sql` | 4, 13 |
| `050-cross-team-writes.test.sql` | 5, 6, 13 |
| `060-removed-and-pending.test.sql` | 7, 8 |
| `070-definer-callers.test.sql` | 9, 13 |
| `080-guest-tokens.test.sql` | 10 (table selects), 11, 13 |
| `090-event-boundaries.test.sql` | 15 (event rows of § 4.7), 13 |

Each test file has this shape:

```sql
begin;
\ir _isolation.psql
select plan(<n>);
select tests.seed();
-- assertions
select * from finish();
rollback;
```

**`\ir` is the one unverified mechanism.** `TODO(verify)`: that `supabase test db` (pg_prove → psql)
resolves `\ir` relative to the test file. If it does not, the developer moves the helpers into
`001-isolation-helpers.test.sql`, which creates them and **commits** (a local database rebuilt by
`db reset` before every run, so nothing persists past it), and each file drops the `\ir` line. The
function names and behaviour below are identical either way; the developer records which was used in
`03-impl-log.md`. The `.psql` extension keeps the fixture out of the `*.test.sql` run.

### 4.2 Helpers — schema `tests`, created by `_isolation.psql` inside the file's transaction

`create extension if not exists pgtap with schema extensions;` then `create schema tests;`
`grant usage on schema tests to anon, authenticated;` and execute on every function below to
`anon, authenticated`. All `security invoker`, `set search_path = ''`.

```sql
-- Seed the fixture of § 4.3 as the superuser. Called once per file, before any authenticate.
tests.seed() returns void

-- Become X: set_config('request.jwt.claims', json_build_object('sub', p_id, 'role',
-- 'authenticated')::text, true) and set_config('role', 'authenticated', true).
tests.authenticate_as(p_id uuid) returns void

-- Become signed out: claims '{"role":"anon"}', role 'anon'.
tests.authenticate_anon() returns void

-- Back to the session user: set_config('role', 'none', true), claims ''.
tests.clear_authentication() returns void

-- Execute p_sql (one update or delete) and return GET DIAGNOSTICS ROW_COUNT. Runs as the current
-- role, so RLS applies. Exists because a data-modifying CTE cannot sit inside pgTAP's is().
tests.rows_affected(p_sql text) returns bigint
```

Refusal forms, used exactly: *raises* → `throws_ok(<sql>, '42501', null, <description>)`;
*returns empty* → `is_empty(<sql>, …)` or `is(<scalar>, null, …)` / `is(<bool>, false, …)`;
*affects zero rows* → `is(tests.rows_affected(<sql>), 0::bigint, …)` followed, after
`tests.clear_authentication()`, by `results_eq` of the target row against its value before.

### 4.3 Fixture — `tests.seed()`

Fixed uuids, declared once as constants at the top of `_isolation.psql`, of the form
`'00000000-0000-4000-8000-0000000000NN'` with `NN` as listed. Tests refer to them by these names
only. Names are fixture labels, not schema fields.

| Label | NN | What |
|---|---|---|
| `team_t` / `team_u` | 01 / 02 | two teams, both approval flags `true`, threshold 0.5 |
| `admin_t`, `manager_t`, `member_t`, `member_t2` | 11-14 | approved, on T, roles admin, manager, member, member |
| `removed_t` | 15 | on T, role member, `removed_at` set |
| `removed_admin_t` | 16 | on T, role admin, `removed_at` set |
| `admin_u`, `manager_u`, `member_u`, `member_u2` | 21-24 | approved, on U, roles as T |
| `removed_u` | 25 | on U, role member, `removed_at` set |
| `pending_p` | 31 | `team_id` null, `status` pending |
| `entry_t`, `entry_u` | 41 / 42 | pending entries of `member_t` / `member_u`, `pto`, `full`, 2026-11-02..03 |
| `entry_u_approved` | 43 | approved entry of `member_u2`, 2026-11-04 |
| `event_t`, `event_u` | 51 / 52 | `scope = 'team'`, creators `member_t` / `member_u`, end date 2099-12-31 |
| `event_t_public`, `event_u_public` | 53 / 54 | `scope = 'public'`, same creators |

Plus, all by `insert` as the superuser:
- an `auth.users` row per person (id, email `<label>@mir06.test`, `email_confirmed_at` **null** so
  `admit_allow_listed_member` admits nobody), then the `member` row directly;
- a `busy_day` row for `member_t` and `member_u`; a `task` row and a `notification` row each for
  `member_t` and for `removed_t` (so AC-7 proves a removed member cannot read even their own); none
  for `pending_p`; an `issue_report` row by `member_t`;
- an `event_invitee` row on `event_t` and `event_u` (each naming the second member of its team);
- `event_attendance` `attending` for `member_t2` on `event_t_public` and `member_u2` on
  `event_u_public`;
- an `event_guest_link` on `event_t`, `event_u`, `event_t_public`, `event_u_public` with tokens
  `repeat('a',64)`, `repeat('b',64)`, `repeat('c',64)`, `repeat('d',64)` respectively;
- one `event_guest` on each public event, `manage_token_hash = encode(sha256(convert_to(<m>,
  'UTF8')), 'hex')` for manage tokens `repeat('e',64)` (T) and `repeat('f',64)` (U), names `Guest T`
  / `Guest U`, emails `guest-t@mir06.test` / `guest-u@mir06.test`;
- one `event_email_invitation` on each team event.

Columns not named take their defaults; every column used exists in the migrations as of
`20261020180000_mir04_scoped_member_directory.sql`. Rows are inserted with `auth.uid()` null, so the
`notify*` and `email_*` triggers do nothing or warn; a warning is not a failure.

### 4.4 Read and write assertions (AC-2 to AC-8)

- **AC-2**, as `member_t` and `manager_t`: `select id from public.entry where member_id in
  (member_u, member_u2)` empty; same with `and status = 'pending'` empty;
  `list_team_entries_for_team(team_u)` and `list_team_entries_overlapping_for_team(team_u,
  '2026-11-01', '2026-11-30')` empty. Control: as `member_u`, `entry_u` is visible.
- **AC-3**, as `member_t` and `manager_t`: `select id from public.member where team_id = team_u or
  team_id is null` empty; `list_members_for_team(team_u)` empty; `select id from
  list_member_directory() where team_id = team_u` empty. Control: `member_t2` visible to `member_t`.
- **AC-4**, as each of `member_t`, `manager_t`, `admin_t` on own id: the three direct updates and the
  four RPC calls raise `42501`; re-read without RLS, `role, status, team_id` unchanged.
- **AC-5**, as `admin_t`: zero rows for
  `update public.entry set status = 'approved' where id = entry_u`;
  `update public.entry set status = 'rejected', rejection_reason = 'x' where id = entry_u`;
  `update public.entry set note = 'x' where id = entry_u`;
  `delete from public.entry where id = entry_u`;
  `update public.team set overload_threshold = 0.9 where id = team_u`;
  `update public.team set wfh_need_approve = false, pto_need_approve = false where id = team_u`;
  `update public.member set removed_at = now() where id = member_u`.
  Control: as `admin_t`, the first statement on `entry_t` affects 1 row.
- **AC-6**, as `manager_t`: the first two statements of AC-5 affect zero rows. Control: on `entry_t`,
  1 row.
- **AC-7/AC-8**, as each of `removed_t`, `removed_admin_t`, `pending_p`: `select count(*)` is 0 on
  every table AC-7 names except `member`, where `select id from public.member` equals exactly the
  caller's id; each RPC empty (`list_event_guest_emails(event_t_public)`,
  `guest_link_event_id(repeat('a',64))` → null); `select * from public.member_role_change` raises
  `42501`.

### 4.5 Definer catalogue (AC-9, AC-12)

`010-catalogue.test.sql` asserts `set_eq` between `select p.oid::regprocedure::text from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.prosecdef` and the literal list of every
function in the three tables below, in `regprocedure` text form.

**RPCs — called in `070-definer-callers.test.sql`.** *M* = `member_t`, *Mg* = `manager_t`, *RA* =
`removed_admin_t`, *AT* = `admin_t` acting on U. Unchanged = re-read without RLS.

| Function | Callers | Arguments | Refusal |
|---|---|---|---|
| `list_teams()` | M, Mg, RA | — | empty |
| `list_all_members()` | M, Mg, RA | — | empty |
| `create_team(text)` | M, Mg, RA | `'x'` | raises 42501; `team` count unchanged |
| `rename_team(uuid, text)` | M, Mg, RA | `team_u, 'x'` | raises 42501; name unchanged |
| `delete_team(uuid)` | M, Mg, RA | `team_u` | raises 42501; team exists |
| `admit_member(uuid, uuid)` | M, Mg, RA | `pending_p, team_t` | raises 42501; still pending |
| `reject_member(uuid)` | M, Mg, RA | `pending_p` | raises 42501; still pending |
| `move_member(uuid, uuid)` | M, Mg, RA | `member_u, team_t` | raises 42501; still on U |
| `set_member_team(uuid, uuid)` | M, Mg, RA, AT | `member_u, team_u` | raises 42501 |
| `set_member_role(uuid, member_role)` | M, Mg, RA, AT | `member_u, 'manager'` | raises 42501; role unchanged |
| `promote_member_to_admin(uuid)` | M, Mg, RA, AT | `member_u` | raises 42501; role unchanged |
| `list_members_for_team(uuid)` | M, Mg, RA | `team_u` | empty |
| `list_team_entries_for_team(uuid)` | M, Mg, RA | `team_u` | empty |
| `list_team_entries_overlapping_for_team(uuid, date, date)` | M, Mg, RA | `team_u, '2026-11-01', '2026-11-30'` | empty |
| `list_member_directory()` | `removed_t`, `pending_p` | — | empty |
| `set_event_email(boolean)` | `removed_t` | `false` | returns null; `event_email_enabled` unchanged |
| `invite_to_event(uuid, text[])` | M, Mg, RA | `event_u_public, array['z@mir06.test']` | raises 42501; no `event_email_invitation` row added |
| `list_event_guest_emails(uuid)` | M, Mg, `member_u2` | `event_u_public` | empty |
| `guest_link_event_id(text)` | M, `removed_t`, `pending_p` | `repeat('b',64)` | null |

Controls (AC-13): `admin_t` gets non-empty `list_teams()`; `admin_t` `set_member_role(member_t,
'manager')` succeeds; `member_u` (creator) gets `Guest U`'s email from
`list_event_guest_emails(event_u_public)`; `member_u` gets `event_u` from
`guest_link_event_id(repeat('b',64))`.

**Predicates — not called; covered by AC-10's `anon` privilege check:** `is_admin(uuid)`,
`member_team_id(uuid)`, `may_decide(uuid)`, `is_event_invitee(uuid, uuid)`,
`may_manage_event(uuid, uuid)`, `event_registration_open(uuid)`, `is_event_audience(uuid, uuid)`,
`is_event_participant(uuid, uuid)`, `may_read_event(uuid, uuid)`, and the internal
`notify(uuid[], notification_kind, uuid, text)`.

**Guest functions — `080-guest-tokens.test.sql`:** the six of AC-10.

**Triggers — classified, not called:** `admit_allow_listed_member()`, `sync_member_last_sign_in()`,
`sync_member_email()`, `member_record_role_change()`, `event_stamp()`, `event_attendance_guard()`,
`event_capacity_guard()`, `event_guest_guard()`, `notify_event_created()`, `notify_event_updated()`,
`notify_event_cancelled()`, `notify_event_invited()`, `notify_attendance_inserted()`,
`notify_attendance_changed()`, `notify_attendance_deleted()`, `email_notification()`,
`email_invitation()`.

If `pg_proc` disagrees with this list on the current migrations, the developer corrects the list to
match `pg_proc` — the list is a census, not a requirement — and records each difference in
`03-impl-log.md`. A function added to the RPC table that way needs a row with callers and refusal;
the developer stops and asks the tech lead (chat budget) rather than inventing its refusal.

### 4.6 Guest assertions (AC-10, AC-11)

Under `tests.authenticate_anon()`:
- `get_guest_event(repeat('c',64))` — columns exactly `(name, description, location, start_date,
  end_date, capacity, seats_taken)` (`columns_are` is for tables; assert with `results_eq` against a
  typed row), name = `event_t_public`'s.
- `list_guest_event_attendees(repeat('c',64))` — single column `display_name`; the set is
  `{member_t2's display_name, 'Guest T'}`; never `member_u2`'s name nor `'Guest U'`.
- `get_guest_event_terms(repeat('c',64))` — one row.
- `get_guest_registration(repeat('e',64))` — one row, `guest_name = 'Guest T'`.
- With `repeat('9',64)` and with `repeat('c',64)` after `delete from public.event_guest_link where
  token = repeat('c',64)` (done as superuser): the three token reads return empty;
  `get_guest_registration(repeat('9',64))` empty.
- `cancel_guest_registration(repeat('e',64))` returns `'cancelled'`; `Guest U`'s status unchanged.
- Each of `select … from public.<t>` for the AC-7 tables, `holiday` and `member_role_change`
  raises `42501`.

The privilege half of AC-10 lives in `010-catalogue.test.sql`: `set_eq` of
`select p.oid::regprocedure::text from pg_proc p where p.pronamespace = 'public'::regnamespace and
p.prorettype <> 'trigger'::regtype and has_function_privilege('anon', p.oid, 'EXECUTE')` against
the six; and `ok(not has_function_privilege(r, 'public.notify(uuid[], public.notification_kind,
uuid, text)', 'EXECUTE'))` for `r` in `anon`, `authenticated`.

### 4.7 Mirror of the mock-only assertions (AC-15)

| Mock location (ticket `mir_detail`) | SQL assertion |
|---|---|
| `entry-decision.test.ts:286-300` | AC-5 approve `entry_u` |
| `pending-entries.test.ts:182-183` | AC-2 `status = 'pending'` select |
| `seam-parity.test.ts:84-92` | AC-3-style: `select id from public.team` as `member_t` = `{team_t}`; as `member_u` = `{team_u}` (`030`) |
| `seam-parity.test.ts:127-136` | AC-2 select, with the `member_u` control |
| `cross-team-reads.test.ts:52` | AC-9 control: `list_members_for_team(team_t)` as `admin_t` holds no U member |
| `cross-team-reads.test.ts:117-174` | AC-2, AC-3 RPCs as member and manager; AC-7 as removed; AC-10 anon; `list_members_for_team('00000000-0000-4000-8000-0000000000ff')` as `admin_t` empty (`070`) |
| `cross-team-role.test.ts:76, 86, 100` | AC-9 `set_member_role` rows (member, manager, removed admin, other-team admin); anon via AC-10 |
| `cross-team-role.test.ts:138` | AC-5 `removed_at` on `member_u` |
| `threshold.test.ts:130-137` | AC-5 `overload_threshold` |
| `approval-settings.test.ts:101-109` | AC-5 approval flags |
| `events.test.ts:207-221` | `090`: `event_t` invisible to `member_u` and `member_u2`; `event_u` invisible to `member_t` and `manager_t`; control `member_u2` reads `event_u` |
| `events.test.ts:485-505` | `090`: `member_t2` and `manager_t` (non-creators) `update public.event set name = 'x' where id = event_t` and `delete … where id = event_t` affect zero rows; `event_invitee` of `event_t` unchanged |
| `event-attendance.test.ts:367-386` | `090`: insert into `event_attendance (event_id, member_id)` raises `42501` for `member_u` on `event_t`, `admin_t` on `event_u`, `manager_t` on `event_u`, `pending_p` on `event_t_public`; control `member_t2` on `event_t` succeeds |
| `guest-link.test.ts:167-174` | `090`: `delete from event_guest_link where event_id = event_t` affects zero rows for `manager_t`, `member_t2` and `member_u`, and the link survives; then, after the superuser deletes that link, `insert into event_guest_link (event_id) values (event_t)` raises `42501` for the same three. Control: `member_t` (creator) inserts it |
| `viewed-team.test.ts:179-183` | AC-2 / AC-3 RPCs as `member_t` |
| e2e `cal-03-admin-edit-entry.spec.ts:412-427` | AC-2 select as `admin_t` on `entry_u` — empty (`020`) |
| e2e `cal-04-month-view.spec.ts:159-167` | AC-2 select over 2026-11-02..03 as `member_t` |
| e2e `cal-12-team-picker.spec.ts:111-121` | `seam-parity.test.ts:84-92` row |

## 5. Seam impact

None. `src/` is not touched.

## 6. Schema delta

`none`. No migration is added or edited. The `tests` schema and every fixture row exist only inside
a rolled-back transaction on the local stack (or, under § 4.1's fallback, only in the disposable local
database). `requires_adr: false`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/tests/_isolation.psql"
  - "supabase/tests/001-isolation-helpers.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "supabase/tests/020-entry-reads.test.sql"
  - "supabase/tests/030-member-reads.test.sql"
  - "supabase/tests/040-member-self-writes.test.sql"
  - "supabase/tests/050-cross-team-writes.test.sql"
  - "supabase/tests/060-removed-and-pending.test.sql"
  - "supabase/tests/070-definer-callers.test.sql"
  - "supabase/tests/080-guest-tokens.test.sql"
  - "supabase/tests/090-event-boundaries.test.sql"
  - ".ai/board/tickets/MIR-06/**"
```

`001-isolation-helpers.test.sql` is listed only for § 4.1's fallback; exactly one of it and
`_isolation.psql` ships.

`size: M` — ten paths outside the ticket folder that ship. Agrees with `size_estimate`.

`glossary_owed` is `[]`; no rows written.

**Owed to the human plane, not writable here:** `testing-standards.md:115-121` — the
permission-model test's `TODO(project)` path can name `supabase/tests/` once this merges.

## 8. Rejected alternatives

**One file per role (member, manager, admin, removed, pending, anon) instead of one per boundary.**
It mirrors the permission table's columns and makes "everything a removed member may not do" one
read. Rejected: the plan item and the phase-3 rewrite are organised by boundary — MIR-13 rewrites a
policy and needs the one file that proves that policy, across every role — and a per-role layout
would spread each policy's proof over six files, so a reviewer of a policy change could not tell
whether every role was still covered.

**Reusing `supabase/seed.sql` as the fixture**, which `testing-standards.md` § *Fixtures* prefers so
tests and seed cannot drift. Rejected: MIR-05 disabled the seed for `db reset` because its guard
refuses without `calechip.seed_target=local` (`config.toml` `[db.seed]`, MIR-05 plan § 8), the seed
holds one team (`seed.sql:51`) where every boundary here needs two, and it has no removed, pending or
guest rows. A second team added to it would change what the mock fixtures (`src/lib/fixtures.ts`)
must mirror — MIR-07's file, not this ticket's.

**Writing a failing boundary as an expected failure (asserting the hole) instead of `todo()`.** It
keeps CI green too, and states today's behaviour precisely. Rejected: when the hole is fixed, an
assertion of the hole goes red and has to be rewritten; a `todo()` around the correct assertion goes
"unexpectedly passing" and only the `todo()` line is removed — the specified behaviour is the one
written down from the start.

## Changelog

- 2026-10-23T08:23:14+07:00 — sections 1-8 written. Raised by tech-lead-design. Sections 1 and 2
  were drafted from the plan item and `mir_detail` before § 4's source read; reading the migrations
  added the three assumptions under *Open questions* (own `member` row and holidays excepted from
  "reads nothing"; admin cross-team administration is by design; triggers classified, not called)
  and the `notify(...)` row of AC-10. No AC was narrowed to fit the code.
