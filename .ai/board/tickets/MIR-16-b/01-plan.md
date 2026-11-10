---
ticket: MIR-16-b
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-07T09:06:54Z
inputs_read:
  - .ai/board/tickets/MIR-16-b/ticket.yaml
  - .ai/board/tickets/MIR-16/01-plan.md
  - .ai/board/tickets/MIR-16-c/ticket.yaml
  - .ai/board/tickets/MIR-17/ticket.yaml
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md
  - .ai/registry/decisions/ADR-082-the-role-split-goes-in-three-slices-and-issue-reports-go-to-the-system-panel-first.md
  - .ai/steward/context.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261107210000_mir16_issue_reports_system_scope.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/100-mock-parity.test.sql
  - supabase/tests/270-issue-reports-system-scope.test.sql
  - src/lib/data/supabase.ts
  - "local database catalogue, migrations through 20261107180000: pg_proc, pg_policies, pg_depend, routine_privileges"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-16-b: the role split, slice 2. `is_org_admin(uid, org_id)` replaces `is_admin(uid)`

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:305`):

| ID | Feature | Group |
|---|---|---|
| MIR-16 | The database splits admin into system_admin, org_admin and a per-team manager | MIR |

**Plan item P4-1, the bullet this slice ships** (`.ai/board/plans/calechip-multi-tenancy-plan.md:234`):
*"Replace `is_admin(uid)` with `is_org_admin(uid, org_id)` and `is_system_admin(uid)` across ~25 call
sites"*. The `is_system_admin` half shipped with MIR-18 and MIR-16. **ADR-082 decision 2:** the
sign-up queue and the event override stay org powers and are re-pointed to `is_org_admin`.
**ADR-083** (written at this PLAN) splits ADR-082's MIR-16-b in two. This ticket replaces the
predicate. The new MIR-16-d renames the value `'admin'`.

**Who gains what.** Nobody gains or loses a power. That is the point of this slice. Every admin check
in the database today asks *is this person an admin?* and then, separately, *of the same org as the
row?* After this slice each check asks one question: *is this person an admin of this org?* The org
is named at the call. The predicate that cannot name an org, `is_admin(uid)`, stops existing, so a
later check cannot be written without one. MIR-16-c and MIR-17 build on that.

`size_estimate: M`: one migration, its pgTAP, two changed pgTAP files, and the split's board and
registry overhead.

**Out of scope, and where each goes:**

- **Renaming the enum value `'admin'` to `'org_admin'`** goes to **MIR-16-d** (ADR-083 decision 2).
  It also takes every body that spells `'admin'`, the demotion trigger's wording, `bootstrap.sql`,
  `seed.sql`, the pgTAP fixtures that insert `'admin'`, and the member seam's mapping. Until then
  `is_org_admin` reads `role = 'admin'`.
- **The demotion trigger** (`member_enforce_role_and_removal`, `profile_self_update:165`) is not
  re-created here. Its ambiguity is settled by ADR-083 decision 3, and its wording goes to MIR-16-d.
- **`may_decide(uid)` and `'manager'`** go to **MIR-16-c**, as before.
- **Removing the `org_id = member_org_id(…)` conjuncts that the new argument makes redundant.** They
  stay word for word, so that each change is one call expression and can be reviewed as one.
- **Comments in `src/lib/data/supabase.ts` and `src/lib/data/index.ts` that say `is_admin`.** They are
  not behaviour. MIR-17 rewrites those guards.
- **Narrowing an Org public admin to their own teams.** That is a later decision, for `/idea`
  (ADR-082 decision 3).
- **Revoking `anon`'s `EXECUTE` on the other predicates** (`010-catalogue` todo, MIR-06 F-1). Only
  the new function is created without it.

## 2. Acceptance criteria

The cast: **Ada** is `admin_t`, an approved admin of Org public. **Mona** is `manager_t`, **Thanh**
is `member_t`, **Rex** is `removed_admin_t`, and **Pat** is `pending_p`. All four are in Org public,
all from `tests.seed()`. **Dora** is an approved admin of a dedicated org, **Org D**, on its team
**D1**. **Dan** is an approved member of Org D on D1. **Pia** signed up to Org D, is pending and is on
no team. **Sam** is a system admin and has no member row. Every AC is observed against the database
as the caller.

**AC-1: `is_org_admin` says yes for an admin of the org named**
- When `public.is_org_admin(Ada, Org public)` and `public.is_org_admin(Dora, Org D)` are called
- Then each returns `true`

**AC-2: and no for every other pair**
- When `is_org_admin` is called for these pairs: (Ada, Org D), (Dora, Org public), (Mona, Org public),
  (Thanh, Org public), (Rex, Org public), (Pat, Org public), (Sam, Org public), (Sam, Org D), (an id
  that is no one, Org public), and (Ada, `null`)
- Then each returns `false`, and none raises

**AC-3: `is_admin` is gone, and nothing calls it**
- Then `public.is_admin(uuid)` does not exist
- And no function in `public` has a body that matches `public\.is_admin\s*\(`
- And no policy in any schema has a `USING` or `WITH CHECK` expression that calls `is_admin(`
- And `public.is_org_admin(uuid,uuid)` is `security definer`. `authenticated` holds `EXECUTE` on it,
  and `anon` does not

**AC-4: the sign-up queue and the admin lists stay org powers**
- When Ada calls `admit_member(Pia, D1)`, and Sam does the same
- Then each call is refused with `42501`, and Pia stays `pending` on no team
- When Dora calls `admit_member(Pia, D1)`
- Then Pia is `approved` and on D1
- When Dora calls `list_teams()`
- Then she gets D1 and no Org public team. When Ada calls it, she gets Org public's teams and not D1

**AC-5: the event override stays an org power**
- Given event **E-D** in Org D, created by Dan for team D1
- When Ada updates E-D's title, and then deletes E-D
- Then each affects zero rows, and E-D is unchanged
- And `may_manage_event(E-D, Ada)` is `false`
- When Dora updates E-D's title
- Then one row is affected and the title reads back as written. `may_manage_event(E-D, Dora)` is
  `true`

**AC-6: a dedicated org's holidays are written by its own admin**
- When Dora inserts a holiday with `org_id` Org D
- Then it is stored
- When Ada inserts a holiday with `org_id` Org D
- Then it is refused with `42501`, and no row is stored

**AC-7: the entry decider's admin half stays an org power**
- Given Dan's `pending` PTO entry **N-D** (Org D, D1 requires approval for PTO)
- When Ada updates N-D's `status` to `approved`
- Then zero rows are affected, and N-D stays `pending`
- When Dora updates N-D's `status` to `approved`
- Then N-D is `approved`

**AC-8: everything else behaves as before**
- When `pnpm db:test` runs
- Then every file passes. The only existing test files changed are `010-catalogue.test.sql` and
  `100-mock-parity.test.sql`, each as § 4.3 states
- And `pnpm test` passes with no file changed

AC-8 is the regression proof for the call sites in § 4.1 that AC-4 to AC-7 do not sample. Each of
those powers is already asserted, for its own org and against another org, by the files listed in
§ 4.3.

**Invariants touched.** `[INV-02, INV-03]`. `entry_enforce_decision` is re-created. Its clause (c)
returns an edited approved entry to `pending` (INV-02). It also nulls or keeps `rejection_reason`
next to the `entry_rejection_reason_iff_rejected` check (INV-03). The only change is the call
expression on two lines. But a re-created trigger body is a whole body, and a mistake copying it
would break both invariants. `170-multi-team-decisions` and the CAL and ADM pgTAP files assert both
invariants, and AC-8 runs them.

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

There is no screen in this slice. Nothing in `src/` changes, and no layout is originated.

## 3. Permission model

Every check is on the server side of the boundary. No application gate changes.

| Caller | `is_org_admin(caller, own org)` | `is_org_admin(caller, other org)` | Every power in § 4.1 |
|---|---|---|---|
| Approved, not removed admin | `true` | `false` | ✅ own org only, as today |
| Manager, member | `false` | `false` | unchanged (manager paths read `may_decide` and `may_decide_entry`, not this) |
| Removed, pending or rejected | `false` | `false` | ❌ as today |
| System admin (no member row) | `false` | `false` | ❌ as today. The panel uses its own RPCs (ADR-075, ADR-079, ADR-082) |
| `anon` | no `EXECUTE` on `is_org_admin` | | ❌ no grant on the RPCs that matter (MIR-06) |

The denials the tests assert: AC-2 for every non-admin and every cross-org pair. AC-4 to AC-7 for an
admin of another org and for a system admin. AC-3 for `anon`'s `EXECUTE`.

## 4. Contract

### 4.1 Migration: `supabase/migrations/20261107230000_mir16b_is_org_admin.sql`

The migration is idempotent (ADR-024) and wrapped in `begin; … commit;`.

**Step 1: the predicate.**

```sql
create or replace function public.is_org_admin(p_uid uuid, p_org_id uuid)
  returns boolean
  language sql stable security definer set search_path = ''
as $$
  -- MIR-16-b, ADR-083. Still reads 'admin'. MIR-16-d renames the value to 'org_admin'.
  select exists (
    select 1 from public.member m
    where m.id = p_uid
      and m.org_id = p_org_id
      and m.removed_at is null
      and m.status = 'approved'::public.member_status
      and m.role = 'admin'::public.member_role
  );
$$;

revoke all on function public.is_org_admin(uuid, uuid) from public, anon;
grant execute on function public.is_org_admin(uuid, uuid) to authenticated;
```

**Step 2: every call site.** `X` is the call's existing argument, unchanged: `(select auth.uid())`,
`v_uid` or `p_uid`. Two forms:

- **Form C**, the caller's own org: `public.is_admin(X)` becomes
  `public.is_org_admin(X, public.member_org_id(X))`.
- **Form R**, the row's org. Used only where the same conjunction already requires
  `<row>.org_id = public.member_org_id(X)`: `public.is_admin(X)` becomes
  `public.is_org_admin(X, <row>.org_id)`. The existing conjunct stays.

A person belongs to exactly one org, so both forms answer exactly what `is_admin(X)` answered at the
same site.

**Functions.** Each is re-created with `create or replace`, from its current definition
(`pg_get_functiondef` after `20261107210000`). The body, signature, volatility, `security` and
`search_path` are byte for byte the same, except for the call expression. Grants follow, because
`create or replace` keeps them.

| Function | Sites | Form |
|---|---|---|
| `admit_member(uuid,uuid)` | 1 | C |
| `create_team(text)` | 1 | C |
| `delete_team(uuid)` | 1 | C |
| `entry_enforce_decision()` | 2 (`v_uid`) | C |
| `list_all_members()` | 1 | C |
| `list_member_directory()` | 1 | C |
| `list_members_for_team(uuid)` | 1 | C |
| `list_team_entries_for_team(uuid)` | 1 | C |
| `list_team_entries_overlapping_for_team(uuid,date,date)` | 1 | C |
| `list_teams()` | 1 | C |
| `may_decide_entry(uuid,uuid)` | 1 (`p_uid`) | C |
| `may_manage_event(uuid,uuid)` | 1 (`p_uid`) | R, `e.org_id` |
| `may_read_event(uuid,uuid)` | 1 (`p_uid`) | R, `e.org_id` |
| `move_member(uuid,uuid)` | 1 | C |
| `promote_member_to_admin(uuid)` | 1 | C |
| `reject_member(uuid)` | 1 | C |
| `rename_team(uuid,text)` | 1 | C |
| `set_member_role(uuid,public.member_role)` | 1 | C |
| `set_member_team(uuid,uuid)` | 1 | C |

That is 19 functions and 20 sites. No re-created body keeps a comment that contains `public.is_admin(`.

**Policies.** Each is dropped with `drop policy if exists` and created again with the same name,
table, command and roles (`to authenticated`). Its `USING` and `WITH CHECK` are the current
expressions (`pg_policies` after `20261107210000`) with only the call replaced.

| Policy | Clause(s) | Form |
|---|---|---|
| `entry_delete_admin` on `public.entry` | USING | C |
| `entry_update_admin` on `public.entry` | USING | C |
| `entry_update_manager` on `public.entry` | USING (`not …`) | C |
| `event_delete_manage` on `public.event` | USING | R, `org_id` |
| `event_select_visible` on `public.event` | USING | R, `org_id` |
| `event_update_manage` on `public.event` | USING, WITH CHECK | R, `org_id` |
| `holiday_delete_admin` on `public.holiday` | USING | R, `org_id` |
| `holiday_insert_admin` on `public.holiday` | WITH CHECK | R, `org_id` |
| `holiday_update_admin` on `public.holiday` | USING, WITH CHECK | R, `org_id` |
| `member_select_pending_admin` on `public.member` | USING | R, `org_id` |
| `member_update_admin` on `public.member` | USING | C |
| `team_update_admin` on `public.team` | USING, WITH CHECK | C |

That is 12 policies. MIR-16 already dropped the other three that called it (`issue_report_select_admin`,
`issue_report_update_admin`, `issue_image_select_admin`).

**Step 3: the old predicate.**

```sql
drop function if exists public.is_admin(uuid);   -- no cascade: a missed policy fails the migration
```

No table, column, constraint, index, enum, row or table grant changes.

### 4.2 pgTAP: `supabase/tests/280-is-org-admin.test.sql`

The file has one `plan(n)` and runs on `tests.seed()`. On top of the seed, as `postgres`, it
creates the following, following `270-issue-reports-system-scope.test.sql:31-80`:

- **A fixture-id function `tests.m16b(label)`**, with the prefix `c2800000-0000-4000-8000-0000000000`.
- **Org D** (`org_code 'org-d-mir16b-280'`), with team D1. D1 requires approval for PTO, which is the
  column default.
- **Dora (`admin`) and Dan (`member`)**, approved, inserted without `team_id` and placed with
  `tests.put_on_team`. **Pia**, `pending`, on no team. All three are in Org D.
- **A `system_admin` row for Sam**, created with `grant_system_admin`.
- **Event E-D**: Org D, created by Dan, scope `team`, team D1.
- **Entry N-D**: Dan's `pending` PTO for one full day.
- **A `tests.shared_org()` helper** for Org public's id, as in 270.

`tests.authenticate_as` comes from `_isolation.psql`. The file makes one assertion or more per AC-1
to AC-7. AC-2 gets one per pair. AC-3 gets one each for: the function not existing
(`hasnt_function`), the `pg_proc` census, the `pg_policies` census, `prosecdef`, and the two
`has_function_privilege` checks. A refusal is asserted with `throws_ok(…, '42501', …)`. A row count
of zero is asserted by an update or delete inside a `with … returning` counted as the caller, then
re-read as `postgres`.

### 4.3 Changed pgTAP

- **`010-catalogue.test.sql:41`.** In the definer census, `'public.is_admin(uuid)'` becomes
  `'public.is_org_admin(uuid,uuid)'` under the same *predicates* comment. `plan(5)` is unchanged.
- **`100-mock-parity.test.sql:203`.** `public.is_admin(tests.parity_id(c->>'id'))` becomes
  `public.is_org_admin(tests.parity_id(c->>'id'), public.member_org_id(tests.parity_id(c->>'id')))`.
  The JSON key `is_admin`, the label `'AC-5 %s: is_admin'` and the parity document are unchanged:
  the mock's predicate keeps its name until MIR-17.
- **Unchanged, and run by AC-8 as the regression proof**:
  - `150-write-path-org-bound`, `160-read-path-org-bound` and `170-multi-team-decisions`
  - `180-entry-owners`, `200-org-management` and `210-org-public-team-bound`
  - `230-writers-write-membership`, `240-org-public-holidays` and `070-definer-callers`

  None of them names `is_admin`. Each asserts behaviour through the RPCs and policies in § 4.1.

### 4.4 Tickets and registry written at this PLAN

- **`ADR-083`**, new: the predicate first, the rename as MIR-16-d.
- **`.ai/board/tickets/MIR-16-d/ticket.yaml`**, new, `BACKLOG`. It depends on MIR-16-b and carries the
  rename's `mir_detail`.
- **`.ai/board/tickets/MIR-16-c/ticket.yaml`**: `depends_on` gains `MIR-16-d` (ADR-083 decision 4).
- **`.ai/board/tickets/MIR-17/ticket.yaml`**: `depends_on` gains `MIR-16-d`.
- **This ticket's `ticket.yaml`**: title, `schema_delta`, `mir_detail` and `expected_impact` are
  narrowed to this slice.

## 5. Seam impact

**None.** No seam function in either implementation calls `is_admin`. Each reaches an RPC or a
policy that keeps its name, its signature and its answer. Neither `src/lib/data/supabase.ts` nor
`mock.ts` changes.

## 6. Schema delta

**Not `none`** (ADR-014). One `security definer` function is added and one is dropped. 19 function
bodies are re-created, one of them a trigger function (`entry_enforce_decision`). 12 policies are
dropped and re-created. No table, column, constraint, index, enum value, grant on a table, or row
changes. **ADR-083**, accepted under ADR-067 at this PLAN, amends ADR-082 decision 1. Applying the
migration to the hosted project is human-only (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-083-is-org-admin-replaces-is-admin-before-the-admin-value-is-renamed.md"
  - ".ai/board/tickets/MIR-16-d/ticket.yaml"
  - ".ai/board/tickets/MIR-16-c/ticket.yaml"
  - ".ai/board/tickets/MIR-17/ticket.yaml"
  - "supabase/migrations/20261107230000_mir16b_is_org_admin.sql"
  - "supabase/tests/280-is-org-admin.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "supabase/tests/100-mock-parity.test.sql"
```

**`size: M`, from 8 paths, and `size_estimate` agrees.** As ADR-082 described it, the ticket would
have been about 19 paths, which is `L`. The rename reaches 13 pgTAP fixture files plus
`_isolation.psql`, `seed.sql`, `bootstrap.sql` and `supabase.ts`. So it split at this PLAN, and the
rename became MIR-16-d (ADR-083). `glossary_owed` is `[]`, so no glossary row is written.

## 8. Rejected alternatives

- **Form C at every site**, even where a row's org is in reach. That would be uniform, and just as
  correct. Rejected for the event, holiday and pending-member sites: there the action happens *in* a
  row's org, and naming that org is what the parameter is for. Where no row carries an org, as with
  the door checks of RPCs, Form C is the only honest argument.
- **Drop the redundant `org_id = member_org_id(…)` conjuncts beside Form R.** That is a tidier end
  state. Rejected for now: it turns a one-expression change into a predicate rewrite at nine
  sites, in the slice whose whole claim is "nothing changes".
- **Rename the value first** (ADR-082's original order). Rejected in ADR-083: the rename is the `L`
  half.
- **Keep `is_admin(uid)` as a thin wrapper.** Rejected: a later check could still be written with no
  org, and P4-1 says *replace*.

## Changelog

- `2026-11-07T09:06:54Z`: all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from P4-1, ADR-082 and this ticket's `mir_detail`, before the catalogue was read for 3–8.
  Reading it gave the count: about 19 paths for the ticket as `mir_detail` described it. That
  narrowed §§ 1–2 to the predicate. The rename's ACs (a promoted member reads back as `org_admin`,
  the seam still reports `"admin"`) were never written here. They belong to MIR-16-d's PLAN, which
  writes its own. AC-7 was added after reading `entry_update_admin`. Amended by `tech-lead-design`.

## Delegated decisions

- **ADR-083**: MIR-16-b replaces `is_admin(uid)` with `is_org_admin(uid, org_id)` at every call
  site and drops `is_admin`. Renaming `'admin'` to `'org_admin'` becomes a fourth slice, MIR-16-d.
  The demotion trigger's ambiguity between two admin kinds is closed by ADR-074's separate table.
  MIR-16-c and MIR-17 now also depend on MIR-16-d. This amends ADR-082 decision 1.
