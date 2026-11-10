---
ticket: MIR-16-h
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-08T06:29:59Z
inputs_read:
  - .ai/board/tickets/MIR-16-h/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/decisions/ADR-084-the-fixtures-name-the-admin-role-through-one-helper-before-the-value-is-renamed-in-place.md
  - .ai/registry/decisions/ADR-086-set-member-role-writes-the-team-role-and-the-manager-value-is-removed-by-a-column-retype.md
  - .ai/registry/decisions/ADR-087-the-fixtures-stop-deriving-a-team-role-from-member-role-before-manager-is-removed.md
  - .ai/templates/plan.md
  - supabase/migrations/20260901120000_tea04_member_writes.sql
  - supabase/migrations/20261020150000_mir03_bounded_role_changes.sql
  - supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql
  - supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/100-mock-parity.test.sql
  - supabase/tests/290-member-role-helper.test.sql
  - supabase/tests/300-org-admin-rename.test.sql
  - supabase/tests/310-manager-read-from-membership.test.sql
  - supabase/tests/320-set-member-role-team-role.test.sql
  - supabase/seed.sql
  - src/lib/data/supabase.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-16-h — `'manager'` leaves `public.member_role`

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:305`):

| ID | Feature | Group |
|---|---|---|
| MIR-16 | The database splits admin into system_admin, org_admin and a per-team manager | MIR |

**P4-1** (`.ai/board/plans/calechip-multi-tenancy-plan.md:232`): *"`member.role` becomes `org_admin` |
`member`"*. **ADR-070 § 1**: `public.member_role` is (`'member'`, `'org_admin'`) in Phase 4.
**ADR-086 decision 2** sets out three moves:

- `member.role` is converted by a column re-type, `'manager'` becoming `'member'`, which fires no
  row trigger;
- `member_role_change.from_role` and `to_role` become `text`, with a check, so the history keeps
  the words it recorded;
- the type is re-created.

**ADR-087 decision 2** adds three more:

- `set_member_role`'s parameter becomes `text`, so `'org_admin'` is still refused with `42501`;
- `tests.member_role('manager')` returns `'member'`;
- `290` and `300` follow.

**Who gains what.** Nobody's power changes. After this ticket a person's global role is one of two
things, `member` or `org_admin`, and *manager* exists only where it is decided and read: on the team
(ADR-073, MIR-16-c, MIR-16-f). The audit trail still says, in its own words, who was made a manager
and when. This is the last slice of P4-1's database half, and it closes MIR-16's feature row.

`size_estimate: M`. The work is one migration and its pgTAP, `010`, the harness, three pgTAP files
and the seed.

**Out of scope — and where each goes:**

- **The application's `MemberRole` (`"member" | "manager" | "admin"`), `mayDecide`, and per-team
  ranks on screen** go to **MIR-17**. The member seam is unchanged. It still sends `"manager"` and
  `"member"` as `p_role` words, which `text` accepts, and it still reads the manager rank from
  `roster_team_role` (MIR-16-c).
- **The mock seam** speaks the application's vocabulary and does not change.
- **`310` AC-6**, where the owner sets Thanh's `member.role` to *manager*, becomes a no-op through
  `tests.member_role`. It still passes, and it is left unchanged and noted. Retiring it is a
  test-tidy for a later ticket, not a contract change.
- **Reading `member_role_change` in the product** goes to MIR-20
  (`20261020150000_mir03_bounded_role_changes.sql:46`).
- **`.ai/standards/data-model.md`, `rbac-and-security.md`, and the glossary's *Manager* row** need a
  standards or registry edit with an ADR, at MIR-17, once the per-team rank is visible.

## 2. Acceptance criteria

AC-1 and AC-4 to AC-9 are observed against the database, by pgTAP. AC-2 and AC-3 describe the
conversion of rows that exist before the migration runs, so the pgTAP suite cannot reach them. They
are observed by the psql procedure in § 4.3, as MIR-13 observed its backfill.

**AC-1 — the type has exactly two values**
- When the labels of `public.member_role` are read
- Then they are `member`, `org_admin`, in that order. `'manager'::public.member_role` raises `22P02`

**AC-2 — every manager row becomes a member row, and nothing else moves**
- Given, before the migration, rows with `role` `manager`, `member` and `org_admin`, removed or not
- When the migration runs
- Then each former `manager` row reads `member` and every other row is unchanged. Their `membership`
  rows, including `team_role`, are unchanged. No `member_role_change` row is written. No row is
  refused, removed managers included

**AC-3 — the audit history keeps its words**
- Given, before the migration, `member_role_change` rows `member → manager` and `manager → member`
- When the migration runs
- Then they read `'member'` and `'manager'` as text, exactly as before

**AC-4 — the history accepts only the words it has ever used**
- When the owner inserts a `member_role_change` row with `to_role = 'owner'`
- Then it is refused with `23514`

**AC-5 — a rank change still works and is still audited**
- Given Ada (`admin_t`) is signed in
- When she calls `set_member_role(Thanh, 'manager')`, then `set_member_role(Thanh, 'member')`
- Then Thanh's primary `team_role` is `manager`, then `member`. Two audit rows are written,
  `member → manager` and `manager → member`, by Ada, as text. Thanh's `member.role` is `member`
  throughout

**AC-6 — the rank door's refusals hold, and say why**
- When Ada calls `set_member_role(Thanh, 'org_admin')`
- Then it is refused with `42501`
- And when she calls `set_member_role(Thanh, 'owner')`
- Then it is refused with `22023`
- And in both cases no `membership` row and no audit row changes

**AC-7 — promotion is still audited by the trigger, as text**
- When Ada calls `promote_member_to_admin(member_t2)`
- Then `member_t2`'s role is `org_admin`, and exactly one audit row `member → org_admin` by Ada is
  written

**AC-8 — an org admin is still an org admin and still cannot be demoted**
- When `is_org_admin(Ada, Org public)` is read, and the owner updates Ada's role to `member`
- Then the first is true, and the second is refused with `42501` and
  `an org admin may not be demoted`

**AC-9 — nothing is left on the old type**
- When the catalogue is read
- Then no type named `member_role_old` exists. `set_member_role(uuid, public.member_role)` does not
  exist and `set_member_role(uuid, text)` does. `anon` holds no `EXECUTE` on it. No `public` function
  body contains `'manager'::public.member_role`

**AC-10 — a fresh local project still seeds**
- When `supabase db reset` applies the migrations and `seed.sql`
- Then it succeeds, and every seeded member on a team has exactly one active primary `membership`
  row with `team_role = 'member'`. The seed holds no manager

**Invariants touched.** `[]`. No entry rule, count or window changes. INV-04's windows are
`membership.joined_at` and `left_at`, which this migration does not write (AC-2).

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No screen changes. There is no layout.

## 3. Permission model

No change to who may do what. `set_member_role(uuid, text)` carries the refusals of the function it
replaces (`20261108150000_mir16f_set_member_role_writes_team_role.sql:30-52`), plus one more: a word
that is not a rank is refused with `22023`.

| Caller | `'member'` / `'manager'` | `'org_admin'` | anything else |
|---|---|---|---|
| Org admin, an eligible `x` | ✅ | ❌ 42501 | ❌ 22023 |
| Org admin, any other `x` | ❌ 42501 | ❌ 42501 | ❌ 22023 |
| Manager, member, no member row | ❌ 42501 | ❌ 42501 | ❌ 42501 (the door check comes first) |
| `anon` | no EXECUTE | no EXECUTE | no EXECUTE |

`member_role_change` stays as it is: RLS on, no policy, and every client grant revoked
(`20261020150000_mir03_bounded_role_changes.sql:45-48`).

## 4. Contract

### 4.1 Migration — `supabase/migrations/20261108200000_mir16h_member_role_drops_manager.sql`

The migration is wrapped in `begin; … commit;`. Steps 1–7 run inside one guard,
`do $mig$ begin if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid where
t.typnamespace = 'public'::regnamespace and t.typname = 'member_role' and e.enumlabel = 'manager')
then … end if; end $mig$;`, so a second run is a no-op (ADR-024). Step 8 is `create or replace`.

```sql
-- 1. The audit trigger names `role` in its column list and WHEN clause, which blocks a re-type of
--    the column. Dropped here and re-created in step 8.
drop trigger if exists member_record_role_change on public.member;

-- 2. The history keeps its words (ADR-086 decision 2).
alter table public.member_role_change
  alter column from_role type text using from_role::text,
  alter column to_role   type text using to_role::text;
alter table public.member_role_change
  add constraint member_role_change_roles_known
  check (from_role in ('member', 'manager', 'org_admin') and to_role in ('member', 'manager', 'org_admin'));

-- 3. The only function whose signature names the type.
drop function if exists public.set_member_role(uuid, public.member_role);

-- 4. – 7. The type swap. A column re-type fires no row trigger, so neither the demotion and
--    removed-member clauses of member_enforce_role_and_removal nor the audit trigger is met.
alter type public.member_role rename to member_role_old;
create type public.member_role as enum ('member', 'org_admin');
alter table public.member alter column role drop default;
alter table public.member
  alter column role type public.member_role
  using (case when role::text = 'manager' then 'member' else role::text end)::public.member_role;
alter table public.member alter column role set default 'member'::public.member_role;
drop type public.member_role_old;   -- no cascade: anything still on the old type makes this fail

-- 8. Re-created against the new type.
create or replace function public.member_record_role_change() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.member_role_change (member_id, from_role, to_role, changed_by)
  values (new.id, old.role::text, new.role::text, (select auth.uid()));
  return null;
end;
$$;
revoke all on function public.member_record_role_change() from public;
create trigger member_record_role_change
  after update of role on public.member
  for each row
  when (old.role is distinct from new.role)
  execute function public.member_record_role_change();

create or replace function public.set_member_role(p_member_id uuid, p_role text)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
  -- MIR-16-f's body (20261108150000 :25-76), with three changes:
  --   - after the door check:  if p_role = 'org_admin' then raise … '42501' (unchanged message);
  --       elsif p_role is null or p_role not in ('member', 'manager') then
  --         raise exception 'not a rank: %', p_role using errcode = '22023';
  --   - v_to := p_role::public.team_role;
  --   - the audit insert writes text: from_role = coalesce(v_from::text, 'member'), to_role = p_role.
  --   Every other line verbatim, including `m.role <> 'org_admin'::public.member_role`.
$$;
revoke all on function public.set_member_role(uuid, text) from public, anon;
grant execute on function public.set_member_role(uuid, text) to authenticated;
```

Before writing, the Developer re-reads the catalogue for dependents of the type:

```sql
select classid::regclass, objid, deptype
  from pg_depend
 where refobjid = 'public.member_role'::regtype;
```

The expected answer is the `member.role` column, `member_role_change`'s two columns, the array type,
and `set_member_role(uuid, public.member_role)`. Anything else is handled in step 3's manner and
listed in `03-impl-log.md`. Function bodies are text, so `is_org_admin`,
`member_enforce_role_and_removal` and `promote_member_to_admin` resolve the new type by name and are
not re-created.

### 4.2 pgTAP — `supabase/tests/330-member-role-without-manager.test.sql`

The file has one `plan(n)` and runs on `tests.seed()`, naming roles through `tests.member_role`
(ADR-084 decision 5). Audit rows are read as the owner. Each of AC-1 and AC-4 to AC-9 gets one or
more assertions:

- **AC-1:** `enum_has_labels('public', 'member_role', array['member', 'org_admin'], …)`, and
  `throws_ok($$select 'manager'::public.member_role$$, '22P02', …)`.
- **AC-4:** `throws_ok` on an owner insert with `to_role = 'owner'`, expecting `23514`.
- **AC-9:**
  - `hasnt_type('public', 'member_role_old')`;
  - `hasnt_function('public', 'set_member_role', array['uuid', 'member_role'])`;
  - `has_function('public', 'set_member_role', array['uuid', 'text'])`;
  - `has_function_privilege('anon', 'public.set_member_role(uuid, text)', 'EXECUTE')` is false;
  - a `prosrc` regex count of zero for `'manager'::public.member_role`;
  - `col_type_is('public', 'member_role_change', 'from_role', 'text')` and the same for `to_role`.

### 4.3 AC-2 and AC-3 — the psql procedure

Recorded in `03-impl-log.md`, against a local project:

1. `supabase db reset` to `20261108150000`, the migration before this one.
2. As the owner, insert three kinds of member: a `manager` on team T, a removed `manager` placed with
   a closed `membership` row, and a `member`. Insert two `member_role_change` rows,
   `member → manager` and `manager → member`.
3. Snapshot `member`, `membership` and `member_role_change`.
4. Apply `20261108200000`.
5. Diff the snapshots. The expected diff is the two former managers' `role`, now `member`, and
   nothing else.

### 4.4 Harness and tests

- **`_isolation.psql:94-100`.** `tests.member_role` maps `'manager'` to `'member'`:
  `when 'admin' then 'org_admin'::public.member_role when 'manager' then 'member'::public.member_role
  else p_role::public.member_role`. The comment says *manager* is a team role since MIR-16-h, and
  that `tests.team_role_for` is where it lives.
- **`290-member-role-helper.test.sql:27-28`.** This becomes `is(tests.member_role('manager'),
  'member'::public.member_role, 'AC-2: manager maps to member — a team role since MIR-16-h')`.
  `plan(10)` is unchanged.
- **`300-org-admin-rename.test.sql`.** Three changes, and `plan(17)` is unchanged:
  - `:21-22` labels become `array['member', 'org_admin']`, with the label *(member, org_admin)*;
  - `:37`'s description becomes `'AC-2: Mona''s role is unchanged'`;
  - `:82` loses the cast: `select public.set_member_role(%L::uuid, 'org_admin')`.
- **`320-set-member-role-team-role.test.sql`.** At `:40`, `:71`, `:103`, `:126`, `:133`, `:140`
  and `:145`, `%L::public.member_role` becomes `%L`, so the literal resolves to `text`. `plan(n)` is
  unchanged.
- **`010-catalogue.test.sql:30`.** `'public.set_member_role(uuid,public.member_role)'` becomes
  `'public.set_member_role(uuid,text)'`.
- **`seed.sql:489-490`.** The `case` becomes `'member'::public.team_role`. The comment above it says
  the seed holds no manager.

The other callers are unchanged, and each was read to confirm it:

- `040:23`, `070`, `140:242`, `150:118`, `170:382`, `180:122`, `230`, and `250` (after MIR-16-g)
  pass an untyped literal, which resolves to `text`.
- `100`'s `manager` subjects insert as `member` with `team_role` `manager` (MIR-16-g). Their expected
  predicates (`is_admin`, `has_team`) are unchanged.
- `310`: see § 1.

## 5. Seam impact

None. `src/lib/data/supabase.ts` sends `p_role: toDbRole(role)`, which is `"member"`, `"manager"` or
`"org_admin"`. `text` accepts all three. `org_admin` is still refused with `42501`, so MIR-16-e AC-10
holds. `DbMemberRole` keeps `"manager"` as a `p_role` word until MIR-17. The mock does not change.

## 6. Schema delta

**Not `none`.** It re-creates the enum type, re-types three columns, adds one check constraint,
drops and re-creates one trigger and its function, and replaces `set_member_role`'s signature. **ADR-086**
decision 2 and **ADR-087** decision 2 are the decisions, and both are accepted, so no new ADR is
needed. Applying the migration to the hosted project is human-only (RULE-09). The person applying it
first runs § 4.1's `pg_depend` query against the hosted catalogue. An extra dependent there is
ADR-086's revert condition.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20261108200000_mir16h_member_role_drops_manager.sql"
  - "supabase/tests/330-member-role-without-manager.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "supabase/tests/_isolation.psql"
  - "supabase/tests/290-member-role-helper.test.sql"
  - "supabase/tests/300-org-admin-rename.test.sql"
  - "supabase/tests/320-set-member-role-team-role.test.sql"
  - "supabase/seed.sql"
```

`size: M`, from 8 paths, and `size_estimate` agrees. MIR-16-g's rough count was about seven. The
eighth is `320`, whose seven explicit `::public.member_role` casts it did not list.
`glossary_owed` is `[]`.

## 8. Rejected alternatives

- **Move the rows with an `update`, with the triggers disabled.** Rejected in ADR-086 *Options
  considered*. The re-type has to happen anyway, and it fires no row trigger.
- **`set_member_role(uuid, public.team_role)`.** Rejected in ADR-087 *Options considered*: the
  seam's `'org_admin'` would fail as `22P02`, not `42501`.
- **Keep `'manager'` in the enum and stop using it.** Rejected: P4-1 and ADR-070 § 1 name the
  two-value type. A value nothing may write, which the database still accepts, is a second spelling
  of the manager rank.
- **Assert AC-2 and AC-3 in pgTAP by re-running the conversion inside the test.** Rejected: the test
  would exercise a copy of the migration's statements, not the migration. The psql procedure runs the
  real file against real rows, the way MIR-13 verified its backfill.

## Changelog

- `2026-11-08T06:29:59Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from the ticket, ADR-070, ADR-086 and ADR-087 before the source tree was read for 3–8.
  Reading it found three things:
  - the audit trigger's `update of role … when (old.role …)` blocks the column re-type, which added
    step 1 and its re-creation;
  - `320`'s and `300`'s explicit casts would stop resolving against a `text` parameter, which added
    both files;
  - pgTAP cannot see pre-migration rows, which moved AC-2 and AC-3 to the psql procedure.

  It also added AC-6's `22023` for a word that is not a rank. That refusal is new, and it is
  recorded here as this PLAN's. Amended by `tech-lead-design`.
