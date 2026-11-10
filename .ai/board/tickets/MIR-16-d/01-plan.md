---
ticket: MIR-16-d
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-07T12:41:59Z
inputs_read:
  - .ai/board/tickets/MIR-16-d/ticket.yaml
  - .ai/board/tickets/MIR-16-b/01-plan.md
  - .ai/board/tickets/MIR-16-c/ticket.yaml
  - .ai/board/tickets/MIR-17/ticket.yaml
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-082-the-role-split-goes-in-three-slices-and-issue-reports-go-to-the-system-panel-first.md
  - .ai/registry/decisions/ADR-083-is-org-admin-replaces-is-admin-before-the-admin-value-is-renamed.md
  - .ai/steward/context.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - supabase/tests/_isolation.psql
  - supabase/tests/000-harness.test.sql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/100-mock-parity.test.sql
  - supabase/tests/120-composite-fks.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/220-roster-team-from-membership.test.sql
  - supabase/tests/230-writers-write-membership.test.sql
  - supabase/tests/240-org-public-holidays.test.sql
  - supabase/tests/270-member-team-id-dropped.test.sql
  - supabase/seed.sql
  - supabase/bootstrap.sql
  - src/lib/data/supabase.ts
  - tests/mock-sql-parity.test.ts
  - tests/role-change-bounds.test.ts
  - tests/member-rpc-roster-team.test.ts
  - "local database catalogue, migrations through 20261107230000: pg_proc, pg_policies, pg_constraint, pg_attrdef, pg_index, pg_enum, pg_trigger"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-16-d: the role split, slice 4. The pgTAP fixtures name the admin role through one helper, `tests.member_role`

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:305`):

| ID | Feature | Group |
|---|---|---|
| MIR-16 | The database splits admin into system_admin, org_admin and a per-team manager | MIR |

**Plan item P4-1, the bullet this work serves** (`.ai/board/plans/calechip-multi-tenancy-plan.md:233`):
*"`member.role` becomes `org_admin` | `member`; team-level `manager` moves to
`membership.role_in_team`"*. **ADR-083 decision 2** gave MIR-16-d the rename of `'admin'` to
`'org_admin'`, and said that if it counts `L`, its PLAN chooses the split. It counts `L` (§ 7).
**ADR-084**, written at this PLAN, splits it in two:

- **This ticket (MIR-16-d)** adds one pgTAP helper. The test harness and seven fixture files then
  name the admin role through it.
- **MIR-16-e** renames the value in place, with `alter type … rename value`, and moves the last five
  fixture files.

**Who gains what.** No role gains or loses anything, and no user sees a change. The beneficiary is
the next slice. Today, renaming the value means editing every test that spells it, all at once and
in one ticket. After this slice, the helper is the one place in `supabase/tests/` that spells the
database value of the admin role, for the harness and seven of the twelve files. MIR-16-e changes
that one branch and five files, instead of thirteen.

`size_estimate: M`: the harness, seven changed pgTAP files and one new one, and the split's ADR and
ticket overhead. Every change is in test code.

**Out of scope, and where each goes:**

- **The rename itself.** That is `alter type public.member_role rename value 'admin' to 'org_admin'`,
  the five bodies that spell `'admin'`, `bootstrap.sql`, `seed.sql`, and the seam's mapping of
  `'org_admin'` to `"admin"`. It goes to **MIR-16-e** (ADR-084 decision 2).
- **The fixture files 250, 260, 270-issue-reports, 270-member-team-id-dropped and 280.** They still
  spell `'admin'` after this slice and go to **MIR-16-e**, by count (§ 7).
- **Expand-then-contract** (`'org_admin'` added beside `'admin'`). Rejected by ADR-084 decision 3.
- **The demotion trigger's wording** (`member_enforce_role_and_removal`). MIR-16-e re-creates it.
- **Any change in `src/`**, including `MemberRole` and the mock. MIR-17 decides the application's
  vocabulary.
- **The `org_code` value `'admin'`** in `120-composite-fks.test.sql` and `200-org-management.test.sql`.
  It is a reserved org code, not a role, and it is not touched.
- **`may_decide(uid)` and `'manager'`.** They go to **MIR-16-c**, as before.

## 2. Acceptance criteria

The cast is from `tests.seed()`. **Ada** is `admin_t`, an approved admin of Org public on team T.
**Thanh** is `member_t`, an approved member on T. Every AC is observed with `pnpm db:test` against
the local database, or by reading the files named.

**AC-1: the helper exists, in the test schema only**
- Given a pgTAP file that runs `\ir _isolation.psql`
- Then `tests.member_role(text)` exists, and its return type is `public.member_role`
- And `authenticated` and `anon` may execute it
- And no migration creates it. `supabase/migrations/` has no file that names `member_role(` in the
  schema `tests`

**AC-2: it returns the database value for each application role word**
- When `tests.member_role('member')` and `tests.member_role('manager')` are called
- Then they return `'member'::public.member_role` and `'manager'::public.member_role`
- When `tests.member_role(null)` is called
- Then it returns `null`
- When `tests.member_role('owner')` is called
- Then it raises `22P02`

**AC-3: its admin value is the value the database treats as admin**
- When Ada's `role` is read
- Then it equals `tests.member_role('admin')`, and `public.is_org_admin(Ada, Org public)` is `true`
- When Ada calls `public.promote_member_to_admin(Thanh)`
- Then the returned row's `role` equals `tests.member_role('admin')`
- And `public.is_org_admin(Thanh, Org public)` is then `true`

These assertions do not name a value, so they hold before and after MIR-16-e's rename.

**AC-4: the harness and the seven files name the admin role only through the helper**
- Given `supabase/tests/_isolation.psql` and the files 040, 100, 120, 140, 220, 230 and 240
- When every occurrence of the literal `'admin'` in them is listed
- Then each one is one of these:
  - an argument of `tests.member_role(`;
  - a role label in the `values` list of `tests.seed()`, or in the own-update subject table of
    `100-mock-parity.test.sql`. Each label reaches the `role` column only through
    `tests.member_role`;
  - inside the `$parity$` document of `100-mock-parity.test.sql`, which is the application's
    vocabulary and is read by `tests/mock-sql-parity.test.ts`;
  - the reserved `org_code` in `120-composite-fks.test.sql` (its *reserved `org_code`* assertion);
  - the `'admin'` branch of the helper's own body.
- And no `insert` into `public.member`, and no read-back of `member.role`, in those files spells the
  value directly

**AC-5: nothing else changes**
- When `pnpm db:test` runs
- Then every file passes, and the `plan(n)` of each of the seven changed files is unchanged
- And `pnpm test` passes with no file under `tests/` or `src/` changed
- And no file under `supabase/migrations/`, and neither `supabase/seed.sql` nor
  `supabase/bootstrap.sql`, is changed

**Invariants touched.** `[]`. No migration, function, policy, trigger or row changes. The seven
fixture files assert the same things as before, through the same rows. `tests.seed()` inserts the
same twelve people with the same roles.

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

There is no screen in this slice. Nothing in `src/` changes, and no layout is originated.

## 3. Permission model

**No permission changes.** No role, grant, policy or definer function changes.

The helper lives in the schema `tests`. `_isolation.psql` creates that schema inside each test
file's own transaction, and every file ends with `rollback`. So the helper exists only during a test
run on the local stack. It never reaches the hosted project, and no application role can call it
there. Within a run it gets the harness's existing grant: `grant execute on all functions in schema
tests to anon, authenticated` (`_isolation.psql:188`). `100-mock-parity`'s `tests.parity_own_update`
runs as `authenticated` and calls it.

The helper is `security invoker`. It reads no table.

## 4. Contract

### 4.1 The helper, in `supabase/tests/_isolation.psql`

It goes after `tests.put_on_team` and before `tests.seed()`, which calls it. It is above the
`grant execute on all functions in schema tests` line.

```sql
-- MIR-16-d, ADR-084 decision 1. **THE ONE PLACE A TEST SPELLS THE DATABASE VALUE OF THE ADMIN
-- ROLE.** A test names a role in the application's words ('member', 'manager', 'admin') and this
-- returns the public.member_role value that means it. MIR-16-e renames 'admin' to 'org_admin' and
-- changes the first branch, and no test that calls this changes with it.
create function tests.member_role(p_role text) returns public.member_role
  language sql stable set search_path = '' as $$
  select case p_role
           when 'admin' then 'admin'::public.member_role
           else p_role::public.member_role
         end;
$$;
```

### 4.2 Call sites

`R` below is the application role word, unchanged where it already appears.

| File | Line(s) on 2026-11-07 | Today | After |
|---|---|---|---|
| `_isolation.psql` | 123 (in `tests.seed()`) | `v_person.role::public.member_role` | `tests.member_role(v_person.role)` |
| `040-member-self-writes` | 43 | `'admin'` in a `role::text` read-back | `tests.member_role('admin')::text` |
| `040-member-self-writes` | 79 | `'admin'` in a `role::text` read-back | `tests.member_role('admin')::text` |
| `100-mock-parity` | 123 (in `tests.parity_subject`) | `p_role::public.member_role` | `tests.member_role(p_role)` |
| `100-mock-parity` | 160–163 (`v_value` in `tests.parity_own_update`) | `case p_case->>'value' when 'U' then … else p_case->>'value' end` | see below |
| `120-composite-fks` | 265, 266 | `'admin'` in an `insert … values` | `tests.member_role('admin')` |
| `140-org-stamping-and-membership-mirror` | 43 | same | same |
| `220-roster-team-from-membership` | 35, 36 | same | same |
| `230-writers-write-membership` | 77, 78 | same | same |
| `230-writers-write-membership` | 322 | `is(s.role::text, 'admin', …)` | `is(s.role, tests.member_role('admin'), …)`, with the same description |
| `240-org-public-holidays` | 81 | `'admin'` in an `insert … values` | `tests.member_role('admin')` |

**`100-mock-parity`'s `v_value`**, exactly:

```sql
  v_value  text := case
                     when p_case->>'value' = 'U' then tests.id('team_u')::text
                     when p_case->>'column' = 'role' then tests.member_role(p_case->>'value')::text
                     else p_case->>'value'
                   end;
```

The JSON document between the `$parity$` markers is not edited. Nor is the own-update subject
table's label `'admin'` (line 145), nor any `plan(n)`. Every other line in the eight files stays as
it is, comments included.

### 4.3 New pgTAP: `supabase/tests/290-member-role-helper.test.sql`

The header follows `280-is-org-admin.test.sql`: `begin;`, `\ir _isolation.psql`,
`set local search_path = extensions, public;`, `select plan(10);`, `select tests.seed();`. It ends
with `select * from finish(); rollback;`. These are the ten assertions, in order:

| # | AC | Assertion |
|---|---|---|
| 1 | AC-1 | `has_function('tests', 'member_role', array['text'], …)` |
| 2 | AC-1 | `ok(prorettype = 'public.member_role'::regtype)` from `pg_proc` for `'tests.member_role(text)'::regprocedure` |
| 3 | AC-2 | `is(tests.member_role('member'), 'member'::public.member_role, …)` |
| 4 | AC-2 | `is(tests.member_role('manager'), 'manager'::public.member_role, …)` |
| 5 | AC-2 | `ok(tests.member_role(null) is null, …)` |
| 6 | AC-2 | `throws_ok($$select tests.member_role('owner')$$, '22P02', null, …)` |
| 7 | AC-3 | `is((select role from public.member where id = tests.id('admin_t')), tests.member_role('admin'), …)` |
| 8 | AC-3 | `ok(public.is_org_admin(tests.id('admin_t'), public.member_org_id(tests.id('admin_t'))), …)` |
| 9 | AC-3 | As Ada (`tests.authenticate_as`): `is((select s.role from public.promote_member_to_admin(tests.id('member_t')) s), tests.member_role('admin'), …)`, then `tests.clear_authentication()` |
| 10 | AC-3 | `ok(public.is_org_admin(tests.id('member_t'), public.member_org_id(tests.id('member_t'))), …)` |

AC-1's `EXECUTE` grant and its *no migration* half, AC-4 and AC-5 are file and run facts. They are
checked at review by reading and listing the files, and by `pnpm db:test` and `pnpm test`. They are
not pgTAP assertions.

### 4.4 Tickets and registry written at this PLAN

- **`ADR-084`**, new: the helper first, then the rename in place, with no expand-then-contract.
- **`.ai/board/tickets/MIR-16-e/ticket.yaml`**, new, `BACKLOG`. It depends on MIR-16-d and carries
  the rename's `mir_detail`, counted against the catalogue.
- **`.ai/board/tickets/MIR-16-c/ticket.yaml`**: `depends_on` gains `MIR-16-e` (ADR-084 decision 4).
  MIR-17 already depends on MIR-16-c, so it is not edited.
- **This ticket's `ticket.yaml`**: title, `schema_delta`, `mir_detail` and `expected_impact` are
  narrowed to this slice.

## 5. Seam impact

**None.** No file under `src/` changes. `tests/mock-sql-parity.test.ts` reads only the text between
the `$parity$` markers of `100-mock-parity.test.sql`, and that text is not edited.

## 6. Schema delta

**`none`.** No migration is added. The helper is created inside each pgTAP transaction, in the
schema `tests`, and rolled back with it. No table, column, function in `public`, policy, trigger,
constraint, enum value, grant or row changes. `requires_adr` stays `true` for the split, recorded in
**ADR-084** and accepted under ADR-067 at this PLAN. The schema change it plans is MIR-16-e's.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-084-the-fixtures-name-the-admin-role-through-one-helper-before-the-value-is-renamed-in-place.md"
  - ".ai/board/tickets/MIR-16-e/ticket.yaml"
  - ".ai/board/tickets/MIR-16-c/ticket.yaml"
  - "supabase/tests/_isolation.psql"
  - "supabase/tests/290-member-role-helper.test.sql"
  - "supabase/tests/040-member-self-writes.test.sql"
  - "supabase/tests/100-mock-parity.test.sql"
  - "supabase/tests/120-composite-fks.test.sql"
  - "supabase/tests/140-org-stamping-and-membership-mirror.test.sql"
  - "supabase/tests/220-roster-team-from-membership.test.sql"
  - "supabase/tests/230-writers-write-membership.test.sql"
  - "supabase/tests/240-org-public-holidays.test.sql"
```

**`size: M`, from 12 paths, and `size_estimate` agrees.** As ADR-083 described it, the ticket would
be about 18 paths, which is `L`. It split at this PLAN, and MIR-16-e was counted at about 11
(ADR-084). Where to cut was decided by count: the helper and the harness had to be here, and the
seven fixture files are the most this slice holds at 12. `glossary_owed` is `[]`, so no glossary row
is written.

## 8. Rejected alternatives

- **Expand then contract** (ADR-083's expectation). Add `'org_admin'`, have writers write it, have
  readers accept both, move the rows, then retire `'admin'`. Rejected in ADR-084. The demotion
  trigger refuses every change away from `'admin'`, so moving the rows means re-creating the trigger
  with an exception. Each admin would get an audit row nobody caused. And two values would mean one
  role for at least one slice. A rename in place has none of these.
- **Move the fixtures straight to `'org_admin'`, split by file.** Rejected: before the rename,
  `'org_admin'` is not a value, so any file moved early fails.
- **A helper per role, `tests.org_admin_role()`.** It is shorter at the call. Rejected because
  `tests.seed()` and `100-mock-parity` hold the role as a text label and would need a `case` at each
  site. One function from the application's word to the database value serves both shapes. It is
  also where the tests follow if MIR-17 renames the application's `"admin"`.
- **Do not rename; `'admin'` means org admin** (ADR-083's revert condition). Rejected in ADR-084:
  P4-1 and ADR-082 decision 3 name the value `org_admin`.

## Changelog

- `2026-11-07T12:41:59Z`: all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  first drafted from ADR-083 decision 2 and this ticket's `mir_detail` as the rename itself. The
  catalogue then showed two things. The demotion trigger refuses any row moving off `'admin'`. And
  the rename counted about 18 paths. So §§ 1–2 were narrowed to the helper, and the rename's ACs (a
  promoted member reads back as `org_admin`, the seam still reports `"admin"`) were never written
  here. They belong to MIR-16-e's PLAN, which writes its own. AC-3 was written so that it holds on
  both sides of the rename, after the count showed that MIR-16-e must not need to edit
  `290-member-role-helper.test.sql`. Amended by `tech-lead-design`.

## Delegated decisions

- **ADR-084**: MIR-16-d adds `tests.member_role(text)` and moves the harness and seven fixture
  files onto it. MIR-16-e renames `'admin'` to `'org_admin'` in place, with `alter type … rename
  value`, in one migration with the five bodies. Expand-then-contract is not used. MIR-16-c also
  depends on MIR-16-e. This takes the choice ADR-083 decision 2 left to this PLAN, in a different
  shape from the one it expected.
