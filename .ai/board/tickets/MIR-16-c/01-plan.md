---
ticket: MIR-16-c
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-08T00:48:43Z
inputs_read:
  - .ai/board/tickets/MIR-16-c/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/decisions/ADR-073-one-decider-on-any-of-the-owners-teams-decides-a-multi-team-entry.md
  - .ai/registry/decisions/ADR-077-a-members-roster-team-is-read-from-membership-and-mir-21-splits-reads-first.md
  - .ai/registry/decisions/ADR-082-the-role-split-goes-in-three-slices-and-issue-reports-go-to-the-system-panel-first.md
  - .ai/registry/decisions/ADR-084-the-fixtures-name-the-admin-role-through-one-helper-before-the-value-is-renamed-in-place.md
  - .ai/templates/plan.md
  - supabase/migrations/20261020150000_mir03_bounded_role_changes.sql
  - supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql
  - supabase/migrations/20261105210000_mir21b_writers_write_membership.sql
  - supabase/migrations/20261107230000_mir16b_is_org_admin.sql
  - supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql
  - supabase/tests/100-mock-parity.test.sql
  - supabase/tests/300-org-admin-rename.test.sql
  - src/lib/data/supabase.ts
  - tests/org-admin-role-mapping.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-16-c — the manager rank is read from `membership.team_role`

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:305`):

| ID | Feature | Group |
|---|---|---|
| MIR-16 | The database splits admin into system_admin, org_admin and a per-team manager | MIR |

**P4-1** (`.ai/board/plans/calechip-multi-tenancy-plan.md:232`) says: *"team-level `manager` moves to
`membership.role_in_team`"*. **ADR-070 § 1** says: *"In Phase 4 (MIR-16), `manager` moves to
`membership.role_in_team`"*. The column is named `team_role` on disk (MIR-11).

**ADR-085 decision 1** (written at this PLAN) narrows this ticket to the read side: the manager rank
is read from `membership.team_role`, nothing reads `member.role = 'manager'` afterwards, and
`may_decide(uuid)` is dropped. The write side and the removal of the value are MIR-16-f.

**Who gains what.** Nobody's power changes. The decider already reads the per-team role (ADR-073).
After this ticket, the member app's notion of *manager*, and the team role a person carries onto a
team they are moved to, both come from the same per-team record that decides entries. So the global
value can be removed in the next slice without anyone losing their rank.

`size_estimate: M`. The work is one migration and its pgTAP, three changed pgTAP files, the seam and
one vitest, plus the split's board overhead.

**Out of scope — and where each goes:**

- **`set_member_role` writing `team_role` only, moving manager rows to `member`, the audit history
  in `member_role_change`, re-creating `public.member_role` without `'manager'`, and the seed,
  harness and fixtures that insert `'manager'`** all go to **MIR-16-f** (ADR-085 decision 2).
- **The application's `MemberRole`, and per-team roles on screen,** go to **MIR-17** (P4-2).
  `Member.role` stays one value per person here.
- **The mock seam** speaks the application's vocabulary. It already reports a manager the same way,
  and it does not change.
- **`100-mock-parity.test.sql`'s JSON document** keeps its `may_decide` field. Only the SQL assertion
  goes, because the function goes (§ 4.3).
- **A per-team audit of team-role changes** goes to MIR-16-f's PLAN.

## 2. Acceptance criteria

Throughout: **Mona** is an approved manager of team T (`manager_t` in `tests.seed()`), with her
active primary `membership` row on T at `team_role = 'manager'`. **Thanh** is an approved member of T
(`member_t`). **Ada** is an approved `org_admin` of T's org (`admin_t`). **Rae** is a removed manager
of T (written by § 4.2's fixture). AC-1 to AC-7 are observed against the database. AC-8 is observed
against the member seam's source.

**AC-1 — each person's roster team role is readable**
- When `member_roster_team_role(id)` is read for Mona, Thanh and Ada
- Then it is `manager`, `member` and `member` respectively. The computed field
  `roster_team_role(member)` gives the same answers on the rows the caller can select

**AC-2 — a removed manager's roster team role is the one on their closed row**
- Given Rae
- When `member_roster_team_role(Rae)` is read
- Then it is `manager`, the `team_role` of the row `member_roster_team_id(Rae)` reads

**AC-3 — a person with no roster team has none**
- When `member_roster_team_role` is read for a pending sign-up
- Then it is null

**AC-4 — a manager moved to another team is still a manager there**
- Given Ada is signed in, and Mona is on T with `team_role = 'manager'`
- When Ada calls `move_member(Mona, T2)`
- Then Mona's active primary row is on T2 with `team_role = 'manager'`, and her T row is closed

**AC-5 — a member moved, or a sign-up admitted, is a member there**
- When Ada calls `move_member(Thanh, T2)`, and `admit_member(<pending>, T)`
- Then each new active primary row has `team_role = 'member'`

**AC-6 — moving no longer reads the global role**
- Given Thanh's `member.role` is set to `manager` by the owner, while his primary row stays at
  `team_role = 'member'`
- When Ada calls `move_member(Thanh, T2)`
- Then Thanh's new primary row has `team_role = 'member'`. It follows the row, not the column

**AC-7 — `may_decide` is gone, and nothing used it**
- When the catalogue is read
- Then `public.may_decide(uuid)` does not exist, and `entry_update_manager` still lets Mona decide
  Thanh's pending entry

**AC-8 — the member seam reports a manager from the roster team role**
- When `src/lib/data/supabase.ts` maps a member row
- Then the application's `role` is `"admin"` when the database role is `org_admin`. Otherwise it is
  `"manager"` when `team_role` (selected as `roster_team_role`) is `manager`, and `"member"` in every
  other case

**Invariants touched.** `[]`. No entry rule, absence count or window changes. INV-04's windows are
`membership.joined_at` and `left_at`. `membership_make_primary` writes them exactly as before, and
only the source of `team_role` changes.

**Open questions.** None that block. The `member_role_change` history question is MIR-16-f's, and it
is named in its `ticket.yaml`.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No screen changes. There is no layout.

## 3. Permission model

No permission changes. `entry_update_manager` and `may_decide_entry` are untouched. The two new
functions are reads:

| Function | Security | `authenticated` | `anon` |
|---|---|---|---|
| `member_roster_team_role(uuid)` | definer, `search_path = ''` | EXECUTE | none |
| `roster_team_role(public.member)` | invoker, the computed field, so a caller passes only a row its policies let it read | EXECUTE | none |

`membership_make_primary` stays owner-only (`revoke … from public, anon, authenticated`).

## 4. Contract

### 4.1 Migration — `supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql`

The migration is idempotent (ADR-024) and wrapped in `begin; … commit;`.

```sql
-- 1. The roster team role, in the shape of member_roster_team_id
--    (20261105150000_mir21_reads_off_member_team_id.sql:35-58): the same row, its team_role.
create or replace function public.member_roster_team_role(p_member uuid) returns public.team_role
  language sql stable security definer set search_path = '' as $$
  select ms.team_role
    from public.membership ms
    join public.member m on m.id = ms.member_id
   where ms.member_id = p_member
     and (   (m.removed_at is null     and ms.left_at is null and ms.is_primary)
          or (m.removed_at is not null and ms.left_at = greatest(m.removed_at, ms.joined_at)))
   order by ms.joined_at desc, ms.id
   limit 1;
$$;
revoke all on function public.member_roster_team_role(uuid) from public, anon;
grant execute on function public.member_roster_team_role(uuid) to authenticated;

create or replace function public.roster_team_role(p_member public.member) returns public.team_role
  language sql stable set search_path = '' as $$
  select public.member_roster_team_role(p_member.id);
$$;
revoke all on function public.roster_team_role(public.member) from public, anon;
grant execute on function public.roster_team_role(public.member) to authenticated;

-- 2. membership_make_primary, from 20261105210000_mir21b_writers_write_membership.sql:39-76, with
--    one change: v_role is the team_role of the member's current active primary row, else 'member'.
--      select m.org_id into v_org from public.member m where m.id = p_member_id;
--      select coalesce((select ms.team_role from public.membership ms
--                        where ms.member_id = p_member_id and ms.left_at is null and ms.is_primary),
--                      'member'::public.team_role)
--        into v_role;
--    Read BEFORE the close of the old primary row. Everything else verbatim, including the revoke.

-- 3. may_decide retires (ADR-085 decision 1). No `cascade`: a policy that still referenced it would
--    make this statement fail, which is the check that nothing does.
drop function if exists public.may_decide(uuid);
```

Before writing, the Developer runs `select p.proname from pg_proc p where p.pronamespace =
'public'::regnamespace and p.prosrc ~ 'may_decide\('`. Function bodies do not record a dependency,
so a body that calls `may_decide(` without `_entry` would fail only at run time. The expected
answer is that only `may_decide_entry` matches. Anything else goes in `03-impl-log.md`, and the plan
is consulted.

### 4.2 pgTAP — `supabase/tests/310-manager-read-from-membership.test.sql`

The file has one `plan(n)` and runs on `tests.seed()`, naming roles only through `tests.member_role`
(ADR-084 decision 5). Its extra fixture is written as `postgres`:

- team T2 in Org public;
- Rae, a manager inserted without `team_id` and placed on T with `tests.put_on_team`, then removed by
  the owner;
- one pending `entry` by Thanh.

It makes one assertion or more per AC-1 to AC-7. For AC-6, the owner sets
`update public.member set role = tests.member_role('manager') where id = tests.id('member_t')` and
leaves his membership row alone. AC-7 uses `hasnt_function('public', 'may_decide', array['uuid'])`.
It also asserts that `anon` lacks EXECUTE on both new functions.

### 4.3 Changed pgTAP

- **`010-catalogue.test.sql:42`.** `'public.may_decide(uuid)'` comes out of the definer census, and
  `'public.member_roster_team_role(uuid)'` goes in. `roster_team_role(public.member)` is invoker. It
  goes in only if the census lists invokers too, which the Developer reads at `:30-80`.
- **`100-mock-parity.test.sql:210-211`.** The `may_decide` assertion and the line that reads it are
  removed, and `plan(144)` becomes `plan(108)`, because the 36 rows lose one assertion each. The
  JSON's `may_decide` field stays: it is the mock's predicate, and the document's other reader is the
  mock side. The `:9` header stops naming `public.may_decide`.
- **`300-org-admin-rename.test.sql:84-88`.** AC-7's three `may_decide` assertions are removed, and
  `plan(20)` becomes `plan(17)`. The header comment says MIR-16-c retired the function.

### 4.4 Member seam — `src/lib/data/supabase.ts`

- **`MEMBER_COLUMNS` (`:983-984`)** appends `, team_role:roster_team_role`. Its `team_id:roster_team_id`
  stays, because `tests/member-rpc-roster-team.test.ts` pins it.
- **`MemberRow` (`:976` area)** gains `team_role: "member" | "manager" | null;`.
- A new function, directly after `toDbRole`:

  ```ts
  /** MIR-16-c, ADR-085 decision 1. The application's one role per person: org_admin from
   *  `member.role`, manager from the roster team's `team_role`, member otherwise. */
  const appRole = (row: MemberRow): MemberRole =>
    row.role === "org_admin" ? fromDbRole(row.role) : row.team_role === "manager" ? "manager" : "member";
  ```
- **`toMember`.** `role: fromDbRole(row.role)` becomes `role: appRole(row)`.
- `fromDbRole`, `toDbRole` and `setRankThroughRpc` are unchanged.

### 4.5 vitest — `tests/org-admin-role-mapping.test.ts`

Its *"toMember's role: uses fromDbRole("* case (`:22-25`) becomes *"toMember's role: uses
appRole(row)"*. Three cases are added:

- **AC-8:** `appRole` is declared with `fromDbRole(row.role)` on the `org_admin` arm and
  `row.team_role === "manager"`;
- `MEMBER_COLUMNS` contains `team_role:roster_team_role`;
- `MemberRow` declares `team_role`.

The other four cases are unchanged.

## 5. Seam impact

**`DataSeam`: no signature changes.** `supabase.ts` changes one column list, one row type and one
mapping. `MemberRole` is unchanged. The mock does not change, and seam parity is unaffected.
**`SystemSeam`: none.**

## 6. Schema delta

**Not `none`.** It adds two functions, re-creates `membership_make_primary`, and drops `may_decide`.
No table, column, enum value, policy, trigger, constraint, grant or row changes. **ADR-085**, accepted
under ADR-067 at this PLAN. Applying it to the hosted project is human-only (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-085-the-manager-rank-is-read-from-membership-first-and-the-value-leaves-member-role-second.md"
  - ".ai/board/tickets/MIR-16-f/ticket.yaml"
  - ".ai/board/tickets/MIR-17/ticket.yaml"
  - "supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql"
  - "supabase/tests/310-manager-read-from-membership.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "supabase/tests/100-mock-parity.test.sql"
  - "supabase/tests/300-org-admin-rename.test.sql"
  - "src/lib/data/supabase.ts"
  - "tests/org-admin-role-mapping.test.ts"
```

`size: M`, from 10 paths, and `size_estimate` agrees. As ADR-082 described it, MIR-16-c counted about
18 files (ADR-085 *Context*), which is `L`. The write side and the removal moved to MIR-16-f.
MIR-16-f depends on this ticket, and MIR-17 now depends on MIR-16-f. `glossary_owed` is `[]`. The
glossary row *Manager* is about to go stale. That needs a registry change with an ADR, which belongs
at MIR-16-f or MIR-17 once the per-team rank is visible, and it is not written here.

## 8. Rejected alternatives

- **One ticket for the whole move.** Rejected: about 18 files (ADR-085 *Options considered*).
- **Keep `may_decide`, re-pointed to `team_role` "on any team".** Rejected: nothing calls it, and a
  global "manager somewhere" predicate is the confusion ADR-073 decision 2 removed.
- **`membership_make_primary` takes the team role as a parameter from each caller.** It is more
  explicit. Rejected: it changes the signature, and both callers would have to answer the same
  question this function answers here.
- **Derive the app's `"manager"` from `member.role` until MIR-16-f.** That needs no seam change.
  Rejected: MIR-16-f could then not move the rows without the app losing every manager, so the seam
  would have to change there instead. Doing it here makes MIR-16-f purely a database slice.

## Changelog

- `2026-11-08T00:48:43Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from the ticket, ADR-070, ADR-073 and ADR-082 before the source tree was read for 3–8.
  Reading it found three things:
  - `may_decide` has no caller but tests, which made the retirement a drop;
  - `membership_make_primary` reads the global role, which added AC-4 to AC-6;
  - removing the value with its fixtures and history is `L`, which split it to MIR-16-f (ADR-085).

  It also added AC-2 for removed managers, whose active row is closed. Amended by `tech-lead-design`.

## Delegated decisions

- **ADR-085**: MIR-16-c is the read side (the roster team role, `membership_make_primary`, the seam
  mapping, and `may_decide` dropped). MIR-16-f is the write side and the removal of `'manager'`.
  MIR-17 depends on MIR-16-f.
