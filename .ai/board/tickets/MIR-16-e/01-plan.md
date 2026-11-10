---
ticket: MIR-16-e
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-07T13:32:50Z
inputs_read:
  - .ai/board/tickets/MIR-16-e/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-082-the-role-split-goes-in-three-slices-and-issue-reports-go-to-the-system-panel-first.md
  - .ai/registry/decisions/ADR-084-the-fixtures-name-the-admin-role-through-one-helper-before-the-value-is-renamed-in-place.md
  - .ai/templates/plan.md
  - supabase/migrations/20260912100000_solo_manager_role.sql
  - supabase/migrations/20261020150000_mir03_bounded_role_changes.sql
  - supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql
  - supabase/migrations/20261107230000_mir16b_is_org_admin.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/250-membership-self-lock.test.sql
  - supabase/tests/260-writers-stop-writing-team-id.test.sql
  - supabase/tests/270-issue-reports-system-scope.test.sql
  - supabase/tests/270-member-team-id-dropped.test.sql
  - supabase/tests/280-is-org-admin.test.sql
  - supabase/tests/290-member-role-helper.test.sql
  - supabase/bootstrap.sql
  - supabase/seed.sql
  - src/lib/data/supabase.ts
  - tests/member-rpc-roster-team.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-16-e — the value `admin` is renamed `org_admin` in place

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:305`):

| ID | Feature | Group |
|---|---|---|
| MIR-16 | The database splits admin into system_admin, org_admin and a per-team manager | MIR |

**P4-1** (`.ai/board/plans/calechip-multi-tenancy-plan.md:232`): *"`member.role` becomes `org_admin` |
`member`"*. **ADR-084 decision 2**, the slice this ticket ships, has four parts:

- one migration that runs `alter type … rename value 'admin' to 'org_admin'` and re-creates the five
  bodies;
- the helper's `'admin'` branch, `bootstrap.sql` and `seed.sql`;
- the member seam, which maps `'org_admin'` to the application's `"admin"` both ways until MIR-17;
- the last five fixture files.

**ADR-082 decision 3:** in Org public, today's admins become its `org_admin`s. The rename carries the
rows.

**Who gains what.** Nobody's power changes. After this ticket the database names the role an org
admin holds `org_admin`. `system_admin` exists as a separate account (ADR-074), so a reader can no
longer take one admin for the other. Every existing admin is an `org_admin` of their org from the
moment the migration applies. There is no window in which two values mean one role (ADR-084
decision 3). The member app keeps saying *admin* until MIR-17.

`size_estimate: M` — one migration, its pgTAP, the harness helper, five fixture files, bootstrap,
seed, the seam, and one vitest.

**Out of scope — and where each goes:**

- **The application's `MemberRole`, `"admin"` in `src/`, `mayAdminister`, and every
  `role !== "admin"` guard** go to **MIR-17** (P4-2). The seam maps both ways so no screen changes
  here.
- **`'manager'` leaving `public.member_role`, and `may_decide` retiring**, go to **MIR-16-c**.
  `may_decide` is re-created here only to respell `'admin'`.
- **The mock seam** (`src/lib/data/mock.ts`) speaks the application's vocabulary and does not
  change.
- **`290-member-role-helper.test.sql`** is not edited. Its assertions hold on both sides of the
  rename (ADR-084 decision 1).
- **Historical migration bodies** that spell `'admin'` are superseded definitions and are never
  edited (ADR-024).
- **Messages that say "admin"** inside `raise exception` texts (`'only an admin can …'`) are words
  for a person, not values, and are unchanged. The one exception is the demotion message, which names
  the role (AC-4).
- **The `org_code` reserved word `'admin'`** (`org_code_not_reserved`, `src/lib/data/system.ts:605`)
  is unrelated text and is unchanged.
- **`.ai/standards/data-model.md` and `rbac-and-security.md`** need a standards edit, which is
  human-only.

## 2. Acceptance criteria

Throughout: **Ada** is an approved admin of Org public (`admin_t` in `tests.seed()`). **Thanh** is an
approved member of her team. AC-1 to AC-8 are observed against the database. AC-9 and AC-10 are
observed against the member seam's source.

**AC-1 — the type has `org_admin` and not `admin`**
- When the labels of `public.member_role` are read
- Then they are exactly `member`, `manager`, `org_admin`, in that order

**AC-2 — every existing admin row is now `org_admin`, and nothing else moved**
- Given the rows that held `admin` before the migration
- When their `role` is read after it
- Then each reads `org_admin`, every other row's role is unchanged, and no `member_role_change` row
  was written by the migration

**AC-3 — an org admin is still an org admin**
- When `is_org_admin(Ada, Org public)` is read
- Then it is true
- And Ada can still do what she could before: admit a pending sign-up of her org

**AC-4 — an org admin still cannot be demoted, and the refusal names the role**
- Given Ada
- When the owner updates Ada's `role` to `member`
- Then it is refused with `42501` and the message `an org admin may not be demoted`

**AC-5 — promotion writes `org_admin`**
- Given Ada is signed in
- When she calls `promote_member_to_admin(Thanh)`
- Then the returned row's `role` is `org_admin`, and `is_org_admin(Thanh, Org public)` is true

**AC-6 — the rank door still refuses promotion to the admin role**
- Given Ada is signed in
- When she calls `set_member_role(Thanh, 'org_admin')`
- Then it is refused with `42501`, and Thanh's role is unchanged

**AC-7 — `may_decide` still admits an org admin and a manager**
- When `may_decide` is read for Ada and for a manager
- Then it is true for both, and false for Thanh

**AC-8 — no public function body spells the old value**
- When the source of every function in schema `public` is read from the catalogue
- Then none contains `'admin'::public.member_role`, and none compares `role::text` with `'admin'`

**AC-9 — the member seam reads `org_admin` as the application's admin**
- When `src/lib/data/supabase.ts` maps a member row whose `role` is `org_admin`
- Then the application receives `role: "admin"`. Rows with `member` and `manager` pass through
  unchanged

**AC-10 — the member seam sends `org_admin` when the application says admin**
- When `setMemberRole(id, "admin")` is called on the member seam
- Then the `p_role` argument sent to `set_member_role` is `org_admin`, so the database answers
  `42501` (AC-6) and the seam maps it to its existing refusal, rather than `22P02` for a value that
  does not exist

**Invariants touched.** `[]`. `member_enforce_role_and_removal`, `may_decide`, `set_member_role` and
`promote_member_to_admin` are re-created, but only the spelling of one enum value changes. No entry
rule, absence count or window is read or written by those changes, so INV-01 to INV-07 are untouched.

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No screen changes. There is no layout.

## 3. Permission model

There is no change to who may do what. Each refusal below is the one that holds today, with the new
spelling:

| Action | Org admin | Manager | Member | No member row |
|---|---|---|---|---|
| `is_org_admin(self, own org)` | true | false | false | false |
| Promote to `org_admin` (`promote_member_to_admin`) | ✅ on a shared team | ❌ 42501 | ❌ 42501 | ❌ |
| `set_member_role(x, 'org_admin')` | ❌ 42501 (ADR-065 decision 2) | ❌ | ❌ | ❌ |
| Demote an `org_admin` | ❌ 42501, by every path, owner included | ❌ | ❌ | ❌ |

All the checks are server-side, in the re-created bodies. The seam mapping (§ 4.4) is a translation,
not a check.

## 4. Contract

### 4.1 Migration — `supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql`

The migration is wrapped in `begin; … commit;`. `rename value` may run inside a transaction (ADR-084
*Consequences*).

```sql
-- 1. The rename. Updates no row, fires no trigger, writes no member_role_change row.
--    Guarded so a second run is a no-op (ADR-024):
do $$
begin
  if exists (select 1 from pg_enum e join pg_type t on t.oid = e.enumtypid
              where t.typname = 'member_role' and t.typnamespace = 'public'::regnamespace
                and e.enumlabel = 'admin') then
    alter type public.member_role rename value 'admin' to 'org_admin';
  end if;
end $$;

-- 2. The five bodies, each `create or replace` from its LATEST definition, with only the value
--    respelled. Name, signature, return type, volatility, security mode and search_path unchanged, so
--    grants are kept:
--    - public.is_org_admin(uuid, uuid)          from 20261107230000_mir16b_is_org_admin.sql (:25-40)
--        m.role = 'org_admin'::public.member_role
--    - public.promote_member_to_admin(uuid)     from 20261107230000 (§ around :505-540)
--        set role = 'org_admin'::…, and m.role <> 'org_admin'::…
--    - public.set_member_role(uuid, public.member_role)  from 20261107230000 (§ around :595-640)
--        if p_role = 'org_admin'::… then raise … '42501'; and m.role <> 'org_admin'::…
--    - public.member_enforce_role_and_removal()  from 20261107180000_mir21f_drop_member_team_id.sql (:37-…)
--        if old.role = 'org_admin'::public.member_role and new.role is distinct from old.role then
--          raise exception 'an org admin may not be demoted' using errcode = '42501';
--      The trigger that points at it is not touched.
--    - public.may_decide(uuid)                   from 20260912100000_solo_manager_role.sql (:55-66)
--        m.role::text in ('org_admin', 'manager')
--    Comments that say "Still reads 'admin'" (MIR-16-b) are dropped from the re-created bodies.
```

Before writing the bodies, the Developer re-reads the catalogue: `select p.proname from pg_proc p
where p.pronamespace = 'public'::regnamespace and p.prosrc ~ '''admin'''`. Every hit that uses
`'admin'` as a role value is in the list above. A hit outside the list is added to the migration on
the same rule and named in `03-impl-log.md`. A hit that is only message text (`'only an admin can
…'`) is left alone.

### 4.2 pgTAP — `supabase/tests/300-org-admin-rename.test.sql`

The file has one `plan(n)` and runs on `tests.seed()`. It names roles only through
`tests.member_role` (ADR-084 decision 5), except where an assertion is about the label itself:

- **AC-1:** `enum_has_labels('public', 'member_role', array['member', 'manager', 'org_admin'], …)`.
- **AC-2:** `admin_t`, `admin_u` and `removed_admin_t` read `role::text = 'org_admin'`.
  `member_t` and `manager_t` are unchanged. `member_role_change` holds no row for the seed's people.
- **AC-3:** `is_org_admin(admin_t, Org public)` is true, and as `admin_t`, `admit_member(pending_p,
  team_t)` lives.
- **AC-4:** as owner, `throws_ok($$update public.member set role = 'member' where id = …admin_t$$,
  '42501', 'an org admin may not be demoted', …)`.
- **AC-5:** as `admin_t`, `promote_member_to_admin(member_t2)` returns `role::text = 'org_admin'`.
- **AC-6:** as `admin_t`, `set_member_role(member_t, 'org_admin')` throws `42501`, and the role is
  unchanged.
- **AC-7:** `may_decide` is true for `admin_t` and `manager_t`, and false for `member_t`.
- **AC-8:** zero `public` functions whose `prosrc ~ '''admin''::public\.member_role'` or
  `prosrc ~* 'role::text\s+in\s*\([^)]*''admin'''`.
- `tests.member_role('admin') = 'org_admin'::public.member_role`.

### 4.3 Harness, fixtures, bootstrap, seed

- **`_isolation.psql:97`** becomes `when 'admin' then 'org_admin'::public.member_role`. The `:90-93`
  comment changes from future to past tense.
- **The five fixture files.** Each direct `'admin'` becomes `tests.member_role('admin')`:
  - `250-membership-self-lock.test.sql:48`
  - `260-writers-stop-writing-team-id.test.sql:46`
  - `270-issue-reports-system-scope.test.sql:68`
  - `280-is-org-admin.test.sql:54`
  - `270-member-team-id-dropped.test.sql:151`, a read-back:
    `values (tests.member_role('admin')::text, 'approved'::text)`

  `plan(n)` is unchanged in each.
- **`bootstrap.sql:142`, `:161` and `:208`.** Each `'admin'::public.member_role` becomes
  `'org_admin'::public.member_role`. User-facing `raise` messages that say "admin" are unchanged.
- **`seed.sql:96`, `:155` and `:310`.** Each `'admin',` becomes `'org_admin',`. The `:117` comment
  says role `'org_admin'`.

### 4.4 Member seam — `src/lib/data/supabase.ts`

```ts
/** MIR-16-e, ADR-084 decision 2. The database's spelling of a member's role. The application keeps
 *  `MemberRole` ("member" | "manager" | "admin") until MIR-17; these two functions are the only
 *  place the two vocabularies meet. */
type DbMemberRole = "member" | "manager" | "org_admin";

const fromDbRole = (role: DbMemberRole): MemberRole => (role === "org_admin" ? "admin" : role);
const toDbRole = (role: MemberRole): DbMemberRole => (role === "admin" ? "org_admin" : role);
```

- `MemberRow.role` (`:968`) becomes `DbMemberRole`.
- `toMember` (`:992`) becomes `role: fromDbRole(row.role)`.
- `setRankThroughRpc` (`:1219`) sends `p_role: toDbRole(role)`. The statement keeps
  `.select(MEMBER_COLUMNS)`, which `tests/member-rpc-roster-team.test.ts` pins.

No exported name or seam signature changes.

### 4.5 vitest — `tests/org-admin-role-mapping.test.ts`

This is a source-text test of `src/lib/data/supabase.ts`, the shape of
`tests/member-rpc-roster-team.test.ts`, because the real seam cannot run without a project. It checks:

- **AC-9:** the source declares `fromDbRole` mapping `"org_admin"` to `"admin"`, and `toMember`'s
  `role:` uses `fromDbRole(`.
- **AC-10:** the `rpc("set_member_role"` statement passes `p_role: toDbRole(`.
- `MemberRow` types `role` as `DbMemberRole`.

## 5. Seam impact

**`DataSeam`: no signature changes.** `supabase.ts` changes internally: every row read through
`toMember` and the one `p_role` argument. `MemberRole` in `src/lib/domain/types.ts` is unchanged, so
this is not a shared type change (operating model § Sizing, XL). The mock does not change, and seam
parity is unaffected. **`SystemSeam`: none.**

## 6. Schema delta

**Not `none`.** It renames one enum value and re-creates five function bodies, one of them a trigger
function. No table, column, policy, constraint, index, grant or row statement is made; the rename
carries every row, including `member_role_change.from_role` and `to_role`, which are typed
`public.member_role` (`20261020150000_mir03_bounded_role_changes.sql:39-40`), so the audit history
reads `org_admin` too. **ADR-084** decision 2 is the decision, and it is accepted, so no new ADR is
needed. Applying it to the hosted project is human-only (RULE-09).

Hosted-only objects are not inspected here. ADR-084's revert condition (a hosted object storing the
value as text) is checked by the person who applies the migration, with the query in § 4.1 run
against the hosted catalogue first.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql"
  - "supabase/tests/300-org-admin-rename.test.sql"
  - "supabase/tests/_isolation.psql"
  - "supabase/tests/250-membership-self-lock.test.sql"
  - "supabase/tests/260-writers-stop-writing-team-id.test.sql"
  - "supabase/tests/270-issue-reports-system-scope.test.sql"
  - "supabase/tests/270-member-team-id-dropped.test.sql"
  - "supabase/tests/280-is-org-admin.test.sql"
  - "supabase/bootstrap.sql"
  - "supabase/seed.sql"
  - "src/lib/data/supabase.ts"
  - "tests/org-admin-role-mapping.test.ts"
```

`size: M`, from 12 paths, and `size_estimate` agrees. MIR-16-d's rough count was about 11. The
twelfth is the vitest for the seam mapping, which no other test reaches. No new function is added,
so `010-catalogue.test.sql`'s definer census is unchanged. `glossary_owed` is `[]`: *org admin* is
named in ADR-059 and the glossary is not edited here.

## 8. Rejected alternatives

- **Change `MemberRole` to `"org_admin"` in this ticket.** That removes the seam mapping. Rejected:
  it changes a shared type module, which every screen and the mock read. That is XL, and it is
  MIR-17's P4-2.
- **Map in the database instead**: a view or a computed field that returns `'admin'` text to the
  client. Rejected: a second spelling of the role in the schema is the two-values window ADR-084
  decision 3 refuses.
- **Keep the demotion message as `an admin may not be demoted`.** It is one less change. Rejected:
  ticket `mir_detail` names the message, and *admin* is now ambiguous between `org_admin` and
  `system_admin`. No test or screen asserts the old text: a grep outside migrations finds it only in
  two board documents.
- **Skip the vitest and rely on pgTAP.** Rejected: pgTAP cannot see the seam, and AC-10's
  `22P02`-instead-of-`42501` regression is exactly the one that would ship unseen.

## Changelog

- `2026-11-07T13:32:50Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from the ticket, ADR-082 and ADR-084 before the source tree was read for 3–8. Reading it
  added AC-2's audit-row clause, after finding `member_role_change` typed on the enum. It added AC-10
  and the vitest, after finding no existing test reaches `supabase.ts`'s role mapping. It also
  confirmed the five fixture lines and the bootstrap and seed lines `mir_detail` named. Amended by
  `tech-lead-design`.
