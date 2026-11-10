---
ticket: MIR-07
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-23T09:30:08+07:00
inputs_read:
  - .ai/board/tickets/MIR-07/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/standards/architecture.md
  - .ai/standards/testing-standards.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/tickets/MIR-02/01-plan.md
  - .ai/board/tickets/MIR-06/01-plan.md
  - .ai/board/tickets/MIR-06/03-impl-log.md
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/migrations/20260910093000_solo_profile_self_update.sql
  - supabase/migrations/20260912100000_solo_manager_role.sql
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - supabase/migrations/20261020120000_mir02_member_self_writes.sql
  - supabase/tests/_isolation.psql
  - scripts/db-test.mjs
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/data/index.ts
  - src/lib/roles.ts
  - src/lib/fixtures.ts
  - tests/signup-confirmation.test.ts
  - tests/cross-team-reads.test.ts
  - tests/cross-team-role.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-07 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md:296`:**

| ID | Title | Group | Status |
|---|---|---|---|
| MIR-07 | The mock is no looser than SQL on any permission decision, and a parity test enforces it | MIR | PLANNED |

**Plan item P1-3, transcribed from `.ai/board/plans/calechip-multi-tenancy-plan.md:124-127`:**

- `mock.ts:366-369` `currentAdmin` does not check `status === 'approved'`; the real `is_admin` does. Align it.
- Make `updateOwnProfile` in the mock accept the same column set the real grant allows, so the mock can express the attack
- Add a parity test that fails when mock and SQL disagree on a permission decision

`ticket.yaml` `mir_detail` adds: `tests/signup-confirmation.test.ts:195-211` is named for a refusal the
mock does not implement — it refuses only a team that does not exist (audit A:756-760).

**Why it matters.** Every component and unit test in the repository runs against the mock
(audit §8). A mock that admits what SQL refuses makes a test pass against a missing control, and
nothing reports it. MIR-06 now proves the SQL boundaries; this ticket ties the mock to them, so the
**developer and reviewer of every later MIR ticket** — above all the phase-3 policy rewrite (MIR-13),
which will change these predicates — get a red test the moment one side moves without the other,
instead of a green suite that describes a datastore that no longer exists.

**Line numbers have moved.** `currentAdmin` is at `mock.ts:378-381` on `origin/main` today; the plan
item's `366-369` is the audit's snapshot. Same function, same defect.

**The attack is already closed in SQL.** MIR-02 revoked `update (role, status, team_id)` and added a
trigger clause (`20261020120000_mir02_member_self_writes.sql:62-66,163`), and MIR-06 AC-4 asserts the
refusal. "Express the attack" is therefore read as: the mock receives the same own-row write and
refuses it the way SQL does, rather than being structurally unable to see it (§ 2, AC-5; Open
questions, assumption 2).

**Out of scope.**

- **Any change to SQL** — migration, policy, grant, function. The mock moves to SQL, never the
  reverse. A parity case that SQL answers wrongly is MIR-06's finding territory, not a fix here.
- **`admit_member` accepting any team** (audit A:756-760 item 2's substance). SQL `admit_member`
  checks only that the team exists (`solo_many_teams.sql:157`), and the mock does the same
  (`mock.ts:1679`), so mock and SQL agree. The own-team bound is MIR-13's. This ticket corrects only
  the test's name, which claims a refusal neither side implements (AC-7).
- **`src/lib/data/supabase.ts`.** Its `updateOwnProfile` names two columns in its PATCH body and
  never sends a third; the database refuses the third anyway. Making it reject unknown input keys
  would be a change to the real seam with no permission decision behind it.
- **Changing `UpdateOwnProfileInput`** (`src/lib/data/index.ts:72`). The seam's type stays two
  fields; the attack reaches the mock through a cast in the test, as it reaches PostgREST through a
  hand-written PATCH.
- **Every mock seam function's own policy reproduction.** Per-function policies that carry no
  status clause in SQL (`entry_insert_own`, `entry_delete_own`, `member_update_own`) carry none in
  the mock either, and are not touched. This ticket aligns the three **shared predicates**
  (`is_admin`, `member_team_id`, `may_decide`) and the own-row column set; a seam function that
  bypasses the predicates with its own inline check is not audited here.
- **Un-pinning Playwright from the mock** (`tests/e2e/seam.setup.ts`).
- **MIR-06's findings F-1 to F-3.** They are SQL holes and need migrations.
- **Standards edits.** `testing-standards.md:115-121` `TODO(project)` names no path for the
  permission-model test; human plane. Named in § 7.

`size_estimate: M` — two production files changed by a few lines each, two new test files, three
test files with comment or name corrections; no SQL.

## 2. Acceptance criteria

Terms. **Subject** is a member row in a stated state: `role`, `status`, removed or not, on a team or
not. **The case table** is the single JSON document of § 4.2, held in one file and read by both
suites. **Team T / team U** are two teams that both suites create or seed. **Refused**, for a SQL own-row
write, is either SQLSTATE `42501` raised or zero rows affected, with the row unchanged; for the
mock it is `ok: false` with the row unchanged. **Allowed** is one row written and the new value
read back.

**AC-1 — the mock's admin predicate is `is_admin`**
- Given a subject with `role = 'admin'` whose `status` is `pending` or `rejected`, or who is removed
- When that subject is the current member of the mock and calls any mock seam function gated on
  being an admin (e.g. `listPendingMembers`, `decideMember`, `createTeam`)
- Then it is treated exactly as a non-admin: an empty list or a `not_permitted` refusal, and nothing
  is written.

**AC-2 — the mock's team predicate is `member_team_id`**
- Given a subject with a `teamId` set whose `status` is not `approved`
- When the mock answers "which team is this caller on"
- Then it answers no team, as `public.member_team_id` does, so every mock path built on that
  answer (entry reads, entry decisions, events, busy days) treats the subject as on no team.

**AC-3 — the mock's decider predicate is `may_decide`**
- Given a subject with `role` `admin` or `manager` whose `status` is not `approved`
- When the mock decides whether that subject may approve or reject an entry
- Then it refuses, as `public.may_decide` does.

**AC-4 — one case table, both suites**
- Given the case table of § 4.2
- When `pnpm exec vitest run` runs `tests/mock-sql-parity.test.ts` and `pnpm db:test` runs
  `supabase/tests/100-mock-parity.test.sql`
- Then both read the **same bytes** — the table exists in exactly one file — and each asserts every
  case against its own side: the vitest file against the mock, the pgTAP file against real SQL run
  as the stated role. A case whose expected answer is wrong for either side fails that side's suite.

**AC-5 — the predicate cases are the whole matrix**
- Given the `predicates` half of the case table
- When the vitest file reads it
- Then it asserts there are exactly 36 rows, one for each combination of `role` ∈ {member, manager,
  admin} × `status` ∈ {pending, approved, rejected} × `removed` ∈ {false, true} × `on_team` ∈
  {false, true}, with no duplicate — so a case cannot be deleted to make a side pass; and for each
  row, both suites assert `is_admin`, `has_team` and `may_decide` equal the row's expected values.

**AC-6 — the own-row write cases, the attack included**
- Given the `own_update` half of the case table: six subjects × six columns of `member`
  (`display_name`, `avatar`, `role`, `status`, `team_id`, `removed_at`)
- When each subject writes that one column on their own row — in SQL as `authenticated` with their
  own JWT, by `update public.member set <column> = <value> where id = <self>`; in the mock by
  `updateOwnProfile` with that column added to the input
- Then the result is the row's `expected` (`allowed` or `refused`) on both sides, and a refused
  write leaves every column of the row unchanged. The vitest file asserts there are exactly 36 rows
  with no duplicate (subject, column) pair.

**AC-7 — the signup test says what it checks**
- Given `tests/signup-confirmation.test.ts`, the test currently named "refuses an approval that names
  a team the admin is not on"
- When it is read
- Then its name and comment state what it asserts — an approval naming a team that does not exist
  is refused — and its assertions are unchanged.

**AC-8 — the two "exercised by no test" comments are corrected**
- Given `tests/cross-team-reads.test.ts:6-8` and the header of `tests/cross-team-role.test.ts`
  (both say the Supabase refusal is exercised by no test)
- When they are read
- Then each original sentence is kept and followed by a dated `MIR-07` line naming the
  `supabase/tests/*.test.sql` file that now exercises it (MIR-06), so the claim is corrected without
  rewriting history.

**AC-9 — nothing else changed**
- Given the full unit suite before and after
- When `pnpm exec vitest run` runs
- Then every pre-existing test passes with its assertions unchanged, apart from AC-7's rename; a
  pre-existing test that fails because it relied on the looser mock is a finding recorded in
  `03-impl-log.md` and stopped on, not edited to pass.

**Invariants touched: `[]`.** No entry, count or portion logic changes; INV-01 to INV-07 are about
entries and absence counts, and this ticket changes who the mock treats as admin, on-team or
decider, and nothing about what an entry is. Written back to `ticket.yaml`.

**Open questions.** None that block. Three readings are recorded as **assumptions**, and each ships:

1. *"Any permission decision"* is read as the three shared predicates and the own-row column set —
   the decisions the plan item and the audit name (A:907-910). A per-function inline check that
   disagrees with its policy is not searched for; see Out of scope.
2. *"Accept the same column set the real grant allows, so the mock can express the attack"* is read
   as: the mock **receives** any column the attacker can name, and answers each exactly as SQL does
   today. The real grant to `authenticated` on `member` is `update (display_name, avatar,
   removed_at)` after MIR-02; `removed_at` on one's own row is refused by the trigger clause
   *an admin may not remove themselves* (`mir02:136-139`), so the own-row set that is **allowed** is
   `display_name, avatar`, which is what the mock writes. The change is that the mock stops silently
   ignoring the other keys and refuses them.
3. *"Mock and SQL disagree"* is enforced as *both agree with one written table*. That is stronger
   than a live comparison — it also fails when both are wrong in the same direction — and it is the
   only form both CI jobs can run independently (§ 8).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

*(This ticket has no screen; nothing visual is designed.)*

## 3. Permission model

No permission changes. The mock is a second implementation of controls held in SQL; this ticket
makes it agree with them. Authority for each decision, all server side:

| Decision | SQL authority | Mock reproduction after this ticket |
|---|---|---|
| Is an admin | `public.is_admin` — approved, not removed, `role = 'admin'` (`solo_member_approval.sql:69-77`) | `currentAdmin()` / `adminOf(uid)`, same three conjuncts |
| Is on a team | `public.member_team_id` — approved, not removed (`solo_member_approval.sql:57-63`) | `memberTeamId(uid)`, same two conjuncts |
| May decide | `public.may_decide` — approved, not removed, admin or manager (`solo_manager_role.sql:55-64`) | `mayDecideEntriesOf` in `src/lib/roles.ts`, plus `status === "approved"` |
| Own-row write, which columns | grant `update (display_name, avatar, removed_at)`; revoke of `role, status, team_id` (`mir02:163`); `member_update_own` (`solo_profile_self_update.sql:66-69`); trigger `member_enforce_role_and_removal` (`mir02:62-66,136-139`) | `updateOwnProfile`: refuses any input key outside `displayName`, `avatar` |

Denials asserted by the case table: a non-approved or removed admin is not admin; a non-approved or
removed member has no team; a non-approved or removed manager or admin may not decide; nobody writes
their own `role`, `status`, `team_id` or `removed_at`; a removed person writes nothing on their own
row. The UI is unaffected: `roles.ts` callers (`TopBar.tsx`, `AdminLayout.tsx`, `PendingEntries.tsx`)
render for a signed-in approved member, and a non-approved person never reaches them.

## 4. Contract

### 4.1 Production changes

**`src/lib/data/mock.ts`**

```ts
// `public.is_admin(p_uid)`, reproduced: approved, not removed, admin.
const adminOf = (uid: string | null): Member | null => {
  const m = members.find((x) => x.id === uid) ?? null;
  return m && m.status === "approved" && m.removedAt === null && m.role === "admin" ? m : null;
};
const currentAdmin = (): Member | null => adminOf(currentMemberId);

// `public.member_team_id(p_uid)`, reproduced: approved and not removed.
const memberTeamId = (memberId: string | null): string | null =>
  members.find((m) => m.id === memberId && m.removedAt === null && m.status === "approved")
    ?.teamId ?? null;
```

The comments above `currentAdmin` (`mock.ts:374-377`) and above `eventIsAdmin` (`mock.ts:688-689`,
which says `currentAdmin()` does not carry the status clause) are corrected in place to say it now
does. `eventIsAdmin` itself is unchanged.

`updateOwnProfile` gains, **before** any other check after the `me` lookup:

```ts
// The columns `authenticated` may write on its own row and have the write succeed: `display_name`
// and `avatar`. Any other key is a column the grant revokes or the trigger refuses — MIR-02.
const OWN_PROFILE_KEYS: readonly string[] = ["displayName", "avatar"];
if (Object.keys(input).some((k) => !OWN_PROFILE_KEYS.includes(k))) {
  return refused("not_permitted", "Your profile could not be saved.");
}
```

The refusal sentence is the one the function already uses for a removed caller; no new code or
sentence is added.

Two test-only named exports beside `seam`, in the shape of `__setCurrentMember` (`mock.ts:332`), so
`tests/seam-parity.test.ts`, which compares the keys of `seam`, is untouched:

```ts
/** Test-only. Inserts `member`, or replaces the row with the same id. */
export function __putMemberForTest(member: Member): void

/** Test-only. The three shared predicates as the mock answers them for `uid`, without touching
 *  the session. `mayDecide` passes an owner id of "" so the own-entry clause is inert. */
export function __permissionDecisions(uid: string): {
  isAdmin: boolean;            // adminOf(uid) !== null
  memberTeamId: string | null; // memberTeamId(uid)
  mayDecide: boolean;          // me !== undefined && mayDecideEntriesOf(me, "")
}
```

**`src/lib/roles.ts`** — `mayDecideEntriesOf` gains `me.status === "approved" &&` as its first
conjunct, and its doc comment names `public.may_decide`'s status clause. `mayDecide(role)` and
`mayAdminister(role)` are role-only and unchanged.

### 4.2 The case table

**One file holds it: `supabase/tests/100-mock-parity.test.sql`**, as a single dollar-quoted JSON
literal opened by `$parity$` and closed by the next `$parity$`. Exactly two occurrences of `$parity$`
exist in that file. The JSON is:

```json
{
  "predicates": [
    { "id": "P-01", "role": "member", "status": "pending", "removed": false, "on_team": false,
      "is_admin": false, "has_team": false, "may_decide": false }
  ],
  "own_update": [
    { "id": "U-01", "subject": "approved_member", "column": "display_name",
      "value": "Parity Name", "expected": "allowed" }
  ]
}
```

Field names and domains, exactly:

| Field | Values |
|---|---|
| `predicates[].id` | `P-01` … `P-36` |
| `role` | `member` \| `manager` \| `admin` |
| `status` | `pending` \| `approved` \| `rejected` |
| `removed` | boolean — `removed_at` set |
| `on_team` | boolean — `team_id` is team T, else null |
| `is_admin`, `has_team`, `may_decide` | boolean, **written by hand per row** from the SQL definitions in § 3; never computed in either test |
| `own_update[].id` | `U-01` … `U-36` |
| `subject` | `approved_member` \| `approved_manager` \| `approved_admin` \| `pending` \| `rejected` \| `removed` |
| `column` | `display_name` \| `avatar` \| `role` \| `status` \| `team_id` \| `removed_at` |
| `value` | string; for `team_id` the symbol `"U"` (team U's id on each side); for `removed_at` the symbol `"now"` |
| `expected` | `allowed` \| `refused` |

Own-update subjects: `approved_member`, `approved_manager`, `approved_admin` are approved, on T, not
removed, with the named role; `pending` is `role member`, `status pending`, no team; `rejected` is
`role member`, `status rejected`, no team; `removed` is `role member`, approved, on T, removed. Each
own-update case uses **its own subject row** (36 rows), so an allowed write in one case cannot change
another case's starting state.

Values: `display_name` → `"Parity Name"`; `avatar` → an entry of `AVATAR_CHOICES` other than the
subject's starting avatar (`TODO(verify)`: that `"2.png"` is in `AVATAR_CHOICES` under vitest; if not,
the developer writes one that is and records it); `role` → `"admin"`, except `"member"` for
`approved_admin`; `status` → `"approved"` for `pending` and `rejected`, `"pending"` otherwise;
`team_id` → `"U"`; `removed_at` → `"now"`.

Expected, from § 3: `allowed` exactly for `display_name` and `avatar` on every subject except
`removed` (8 rows); `refused` for the other 28.

### 4.3 The pgTAP file — `supabase/tests/100-mock-parity.test.sql`

Shape, as MIR-06's files:

```sql
begin;
\ir _isolation.psql
-- the case table, § 4.2, as: create temp table parity as select $parity$ {…} $parity$::jsonb as doc;
select plan(<36 * 3 + 36>);
select tests.seed();            -- for team_t and team_u only
-- subjects inserted as the superuser: one auth.users row (email_confirmed_at null) and one
-- public.member row per subject, ids '00000000-0000-4000-8000-000000007NNN'
-- predicates: is(public.is_admin(id), …), is(public.member_team_id(id) is not null, …),
--             is(public.may_decide(id), …) — one assertion each, description = case id
-- own_update: is(tests.parity_own_update(<case>), <expected>, <case id>)
select * from finish();
rollback;
```

One helper, created in this file inside the transaction (not in `_isolation.psql`, which is MIR-06's):

```sql
-- Runs one own-row write as the subject and answers 'allowed' or 'refused'. 'allowed' only if one
-- row was affected AND the column reads back the new value; 'refused' on zero rows or SQLSTATE
-- 42501, after checking (as the superuser) that the row is unchanged. Any other error is re-raised.
tests.parity_own_update(p_case jsonb) returns text
```

`TODO(verify)`: that `set_config('role', …)` inside `tests.parity_own_update` (via
`tests.authenticate_as`) applies to the dynamic `update` executed in the same function. MIR-06's
helpers set the role in a function and run the statement outside it. If it does not, the developer
unrolls the 36 cases as `select tests.authenticate_as(…); select is(tests.rows_affected(…), …);`
pairs and records which form was used in `03-impl-log.md`; the case table and the assertions are the
same either way.

### 4.4 The vitest file — `tests/mock-sql-parity.test.ts`

- Reads `supabase/tests/100-mock-parity.test.sql` with `readFileSync`, takes the text between the two
  `$parity$` markers, `JSON.parse`s it. **The table is never copied into the test file.**
- Asserts: exactly two markers; 36 `predicates` rows covering the full cross product with no
  duplicate; 36 `own_update` rows with no duplicate (`subject`, `column`) pair.
- Predicates: for each row, a fresh `Member` (spread of a fixture member, new id, the row's state;
  team T = `FIXTURE_TEAM.id`, team U = `FIXTURE_OTHER_TEAM_ID`) is put with `__putMemberForTest`,
  and `__permissionDecisions(id)` is compared field by field: `isAdmin` ↔ `is_admin`,
  `memberTeamId !== null` ↔ `has_team`, `mayDecide` ↔ `may_decide`.
- Own update: for each row, the subject is put, `__setCurrentMember(id)`, then `updateOwnProfile` is
  called with `{ displayName: <current>, avatar: <current> }` plus the row's column — `display_name`
  and `avatar` replace their field; `role`, `status`, `team_id`, `removed_at` are added under the
  mock's key (`role`, `status`, `teamId`, `removedAt`) cast through `unknown as UpdateOwnProfileInput`.
  `ok` ↔ `allowed`; on refused, the stored row equals the row before the call.
- Test names carry the AC and the case id: ``AC-5 ${id}`` / ``AC-6 ${id}``.
- AC-1, AC-2, AC-3 each get one named seam-level test against the mock as described in § 2 (a
  pending admin gets `[]` from `listPendingMembers` and `not_permitted` from `createTeam`; an
  approved-status-cleared member's entries are invisible to a teammate; a pending manager's
  `approveEntry` is refused).

## 5. Seam impact

**None to the seam.** No seam function is added, removed or re-typed; `seam`'s keys and arities are
unchanged, so `tests/seam-parity.test.ts` is untouched. Inside the mock, `currentAdmin`,
`memberTeamId` and `updateOwnProfile` change behaviour as § 4.1 states; two test-only named exports
are added beside `seam`. `src/lib/data/supabase.ts` does not change.

## 6. Schema delta

`none`. No migration, policy, trigger, grant or constraint is written or altered. The pgTAP file
creates a helper function and rows inside a transaction that rolls back.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/data/mock.ts"
  - "src/lib/roles.ts"
  - "tests/mock-sql-parity.test.ts"
  - "supabase/tests/100-mock-parity.test.sql"
  - "tests/signup-confirmation.test.ts"
  - "tests/cross-team-reads.test.ts"
  - "tests/cross-team-role.test.ts"
  - ".ai/board/tickets/MIR-07/**"
```

`glossary_owed` is `[]`; no glossary row is written.

`size: M` — seven source paths, no SQL. Agrees with `size_estimate`.

Named, not written: `testing-standards.md:115-121` could cite `tests/mock-sql-parity.test.ts` beside
the permission-model test path — a standards edit, human plane.

## 8. Rejected alternatives

**A live comparison: one vitest file that runs every case against both the mock and a local Supabase
through `supabase.ts`.** It is the literal reading of "fails when mock and SQL disagree". Rejected:
the unit job has no database, so the file would have to skip without one — and a parity test that
skips by default is the green-by-absence the audit is about; running it in the `database` job instead
adds a second Node toolchain step there and a signed-in client per role. It also compares only
through the seam, which cannot send the attack (`supabase.ts` names two columns). The shared table
needs neither, and each half runs in the job that already exists.

**Keeping the table in its own JSON file under `supabase/tests/`, loaded by psql.** Cleaner for
the vitest side. Rejected: getting the file's contents into pgTAP needs a psql backtick `\set` or a
server-side read inside the CLI's containers, and MIR-06 could not even confirm the container mounts
the whole directory (`MIR-06/03-impl-log.md:61`). A dollar-quoted literal in the test file has no
such dependency, and the vitest side reads the real file either way.

**Exporting the mock predicates and asserting them against a truth table computed from a formula.**
Shorter. Rejected: a formula in the test is a third implementation written from the same
understanding as the other two — the failure `testing-standards.md` § *Fixtures that share the
implementation's assumptions* records. Hand-written rows are the independent source.

## Changelog

- 2026-10-23T09:30:08+07:00 — sections 1-8 written. Raised by tech-lead-design. Sections 1 and 2
  were drafted from the plan item, `mir_detail` and the audit before § 4's source read. Reading the
  source added two things to § 2: AC-2 and AC-3 (`memberTeamId` and `mayDecideEntriesOf` lack the
  same status clause `currentAdmin` lacks — the plan item names only `currentAdmin`, and the title's
  "any permission decision" covers all three), and assumption 2 (MIR-02 had already closed the attack
  in SQL, so "express the attack" became "receive it and refuse it"). No AC was narrowed.
