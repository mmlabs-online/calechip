---
ticket: MIR-16-f
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-08T01:15:47Z
inputs_read:
  - .ai/board/tickets/MIR-16-f/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-065-role-changes-are-own-team-promotion-is-its-own-action-and-every-change-is-recorded.md
  - .ai/registry/decisions/ADR-084-the-fixtures-name-the-admin-role-through-one-helper-before-the-value-is-renamed-in-place.md
  - .ai/registry/decisions/ADR-085-the-manager-rank-is-read-from-membership-first-and-the-value-leaves-member-role-second.md
  - .ai/templates/plan.md
  - supabase/migrations/20261020150000_mir03_bounded_role_changes.sql
  - supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql
  - supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/070-definer-callers.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/170-multi-team-decisions.test.sql
  - supabase/tests/230-writers-write-membership.test.sql
  - supabase/tests/250-membership-self-lock.test.sql
  - supabase/tests/300-org-admin-rename.test.sql
  - src/lib/data/supabase.ts
  - tests/org-admin-role-mapping.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-16-f — `set_member_role` writes the team role, not `member.role`

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:305`):

| ID | Feature | Group |
|---|---|---|
| MIR-16 | The database splits admin into system_admin, org_admin and a per-team manager | MIR |

**ADR-085 decision 2** gives this ticket *"the write side and the removal"*, starting with
*"`set_member_role` writes `team_role` only"*. **ADR-086 decision 1**, written at this PLAN, narrows
it to the write side. The rank door writes the primary row's `team_role` and the audit row itself,
and stops writing `member.role`. The removal of `'manager'` from the type moves to MIR-16-g (ADR-086
decision 2).

**Who gains what.** Nobody's power changes. After this ticket, making someone a manager, or making a
manager a member again, records the rank only where it is read: the per-team row that decides
entries (ADR-073) and that the member app reads (MIR-16-c). The global value stops being written,
which is what lets MIR-16-g remove it without converting anything a person did after today. The
audit trail keeps recording every rank change, with the same row shape as before.

`size_estimate: M`. The work is one migration and its pgTAP, two changed pgTAP files, the seam and
one vitest, plus the split's board overhead.

**Out of scope — and where each goes:**

- **Removing `'manager'` from `public.member_role`, converting the legacy rows, re-typing
  `member_role_change`, and the harness, seed and fixtures that insert `'manager'`** all go to
  **MIR-16-g** (ADR-086 decision 2).
- **`promote_member_to_admin`** still updates `member.role` to `org_admin`, and the trigger still
  audits it. That is unchanged.
- **`member_record_role_change`**, the trigger, is unchanged. It still fires on any `member.role`
  change, and after this ticket only promotion makes one.
- **The application's `MemberRole` and per-team ranks on screen** go to **MIR-17**.
- **The mock seam** keeps its own rank record in the application's vocabulary and does not change.

## 2. Acceptance criteria

Throughout: **Ada** is an approved `org_admin` of team T (`admin_t`). **Thanh** is an approved
member of T (`member_t`). **Mona** is an approved manager of T (`manager_t`), whose `member.role`
still reads `manager` because the seed predates this ticket. AC-1 to AC-7 are observed against the
database. AC-8 is observed against the member seam's source.

**AC-1 — making someone a manager writes their team role, not their member role**
- Given Ada is signed in
- When she calls `set_member_role(Thanh, 'manager')`
- Then Thanh's active primary row has `team_role = 'manager'`, his `member.role` is still `member`,
  and `member_roster_team_role(Thanh)` is `manager`

**AC-2 — and it is audited once, with the words of the change**
- Given AC-1
- When `member_role_change` is read as the owner
- Then it holds exactly one new row for Thanh: `from_role = 'member'`, `to_role = 'manager'`,
  `changed_by = Ada`

**AC-3 — making a manager a member again works for a legacy manager too**
- Given Ada is signed in
- When she calls `set_member_role(Mona, 'member')`
- Then Mona's active primary row has `team_role = 'member'`, and one audit row
  `manager → member` by Ada is written
- And Mona's `member.role` is not changed by the call

**AC-4 — a call that changes nothing writes nothing**
- Given Thanh's team role is `manager`
- When Ada calls `set_member_role(Thanh, 'manager')` again
- Then it succeeds, returns Thanh's row, and writes no audit row and no `membership` change

**AC-5 — the refusals are unchanged**
- When Ada calls `set_member_role(Thanh, 'org_admin')`
- Then it is refused with `42501`
- And when Thanh calls `set_member_role(Mona, 'member')`, when Ada calls it on an approved member of
  a team she does not share, and when Ada calls it on herself, each is refused with `42501`
- And in every case no `membership` row and no audit row changes

**AC-6 — nobody writes `'manager'` to `member.role` any more**
- When the catalogue is read
- Then no `public` function body updates `member.role` to a value other than `org_admin`
  (`set role = 'org_admin'` in `promote_member_to_admin` is the only `set role` left)

**AC-7 — the decider still follows the team role**
- Given AC-1
- When Thanh updates a pending entry of another member of T to `approved`
- Then it succeeds through `entry_update_manager`

**AC-8 — the member seam returns the rank it set**
- When `setMemberRole(id, role)` succeeds on the member seam
- Then the returned member's `role` is the `role` argument. It is not the value read back through
  the computed field in the same statement

**Invariants touched.** `[]`. No entry rule, count or window changes. INV-04's windows are
`membership.joined_at` and `left_at`, which `set_member_role` does not write. It writes only
`team_role` and `updated_at`, as it did before.

**Open questions.** None that block. `TODO(verify)`: whether `roster_team_role` on the row
`set_member_role` returns sees the new `team_role` (ADR-086 *Context*). AC-8's seam answer is
correct either way. The Developer records the observed answer in `03-impl-log.md` if a local
project is available.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No screen changes. There is no layout.

## 3. Permission model

No change to who may call what. `set_member_role` keeps every refusal it has
(`20261107235000_mir16e_rename_admin_to_org_admin.sql:98-122`). The checks are server-side, inside the
`security definer` body:

| Caller | `set_member_role(x, 'manager' \| 'member')` | `set_member_role(x, 'org_admin')` |
|---|---|---|
| Org admin, `x` on a shared active team, same org, approved, not removed, not an org admin | ✅ | ❌ 42501 |
| Org admin, any other `x` (another team, another org, pending, removed, an org admin, self) | ❌ 42501 | ❌ 42501 |
| Manager or member | ❌ 42501 | ❌ 42501 |

A self-call is already refused by the `m.role <> 'org_admin'` predicate, because the caller is an
org admin. `membership_refuse_own_rows` would refuse it again with the same message.

## 4. Contract

### 4.1 Migration — `supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql`

The migration is wrapped in `begin; … commit;`. It is a `create or replace` with the same signature,
so its grants are kept (ADR-024).

```sql
create or replace function public.set_member_role(p_member_id uuid, p_role public.member_role)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row  public.member;
  v_from public.team_role;
  v_to   public.team_role;
begin
  if not public.is_org_admin((select auth.uid()), public.member_org_id((select auth.uid()))) then
    raise exception 'only an admin can change a rank' using errcode = '42501';
  end if;

  -- ADR-065 decision 2.
  if p_role = 'org_admin'::public.member_role then
    raise exception 'promotion to admin is promote_member_to_admin, not a rank change'
      using errcode = '42501';
  end if;

  -- The five predicates of 20261107235000 :110-116, as a select: nothing on `member` is written.
  select m.* into v_row
    from public.member m
   where m.id = p_member_id
     and public.member_roster_team_id(m.id) in (select public.member_team_ids((select auth.uid())))
     and m.org_id = public.member_org_id((select auth.uid()))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'org_admin'::public.member_role;

  if not found then
    raise exception 'that rank could not be changed' using errcode = '42501';
  end if;

  v_to := case when p_role = 'manager'::public.member_role
               then 'manager'::public.team_role else 'member'::public.team_role end;

  select ms.team_role into v_from
    from public.membership ms
   where ms.member_id = p_member_id and ms.left_at is null and ms.is_primary;

  -- ADR-086 decision 1. A change writes the row and its audit; no change writes nothing.
  if v_from is distinct from v_to then
    update public.membership ms
       set team_role = v_to, updated_at = now()
     where ms.member_id = p_member_id and ms.left_at is null and ms.is_primary;

    insert into public.member_role_change (member_id, from_role, to_role, changed_by)
    values (p_member_id,
            case when v_from = 'manager'::public.team_role
                 then 'manager'::public.member_role else 'member'::public.member_role end,
            p_role,
            (select auth.uid()));
  end if;

  return v_row;
end;
$$;
```

The header comment cites ADR-086 decision 1. It also says that `member.role` is no longer written
here, and that legacy `'manager'` rows are MIR-16-g's.

### 4.2 pgTAP — `supabase/tests/320-set-member-role-team-role.test.sql`

The file has one `plan(n)` and runs on `tests.seed()`, naming roles through `tests.member_role`
(ADR-084 decision 5). Its extra fixture, written as `postgres`, has two parts:

- an approved member `Una` placed with `tests.put_on_team` on `team_u`, a team Ada does not share;
- one pending `entry` by `member_t2`, for AC-7.

Audit rows are read as the owner. Each AC-1 to AC-7 gets one or more assertions:

- AC-2 and AC-3 count `member_role_change` rows by `member_id` before and after;
- AC-4 compares a `membership` digest (`md5(string_agg(ms::text, …))`, the shape of
  `tests.m21b_ms`) and the audit count before and after;
- AC-6 asserts zero `public` functions whose `prosrc ~* 'set\s+role\s*=\s*(?!''org_admin'')'`, or an
  equivalent regex that admits only `org_admin` as the assigned value.

### 4.3 Changed pgTAP

- **`070-definer-callers.test.sql:134-135`.** *"the set_member_role control wrote member_t"* becomes
  `is(public.member_roster_team_role(tests.id('member_t')), 'manager'::public.team_role, 'AC-13
  control: the set_member_role control wrote member_t''s team role — MIR-16-f')`. `plan(73)` is
  unchanged.
- **`230-writers-write-membership.test.sql:314-315`.** *"returns R as manager"* becomes
  `is(s.role::text, 'member', 'AC-5: set_member_role(R, manager) leaves R''s member.role at member —
  MIR-16-f')`. The team-role assertion at `:317-320` already proves the write. `plan(84)` is
  unchanged.
- The other `set_member_role` callers stay green unchanged, and were read to confirm it:
  - 040 (`:23` self, `:64` control): self is refused, the control lives;
  - 140 `:242-248` and 170/180 (`:382`, `:122`): these read `team_role`;
  - 250 `:124`, `:219`: these read `team_role` and `roster_team_id`;
  - 300 `:81-85`: a refusal that leaves the role at `member`.

### 4.4 Member seam — `src/lib/data/supabase.ts`

In `setRankThroughRpc` (`:1225-1241`), the success return becomes:

```ts
  // MIR-16-f, ADR-086 decision 3. The rank was written to `membership.team_role` by this call; the
  // computed field read over the returned row may see the statement's starting snapshot, so the
  // rank the call set is the answer.
  return { ok: true, value: { ...toMember(data), role } };
```

The `rpc("set_member_role", { p_member_id: memberId, p_role: toDbRole(role) })` statement and its
`.select(MEMBER_COLUMNS)` are unchanged. Two tests pin them: `tests/member-rpc-roster-team.test.ts`
and `tests/org-admin-role-mapping.test.ts`.

### 4.5 vitest — `tests/org-admin-role-mapping.test.ts`

Add one case for **AC-8**: `setRankThroughRpc`'s body contains `value: { ...toMember(data), role }`.
The existing cases are unchanged.

## 5. Seam impact

**`DataSeam`: no signature changes.** One return expression in `supabase.ts` changes. `MemberRole`
is unchanged, the mock does not change, and seam parity is unaffected. **`SystemSeam`: none.**

## 6. Schema delta

**Not `none`.** One `security definer` function body is re-created with the same signature. No
table, column, enum value, policy, trigger, constraint, grant or row changes. **ADR-086**, accepted
under ADR-067 at this PLAN. Applying it to the hosted project is human-only (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-086-set-member-role-writes-the-team-role-and-the-manager-value-is-removed-by-a-column-retype.md"
  - ".ai/board/tickets/MIR-16-g/ticket.yaml"
  - ".ai/board/tickets/MIR-17/ticket.yaml"
  - "supabase/migrations/20261108150000_mir16f_set_member_role_writes_team_role.sql"
  - "supabase/tests/320-set-member-role-team-role.test.sql"
  - "supabase/tests/070-definer-callers.test.sql"
  - "supabase/tests/230-writers-write-membership.test.sql"
  - "src/lib/data/supabase.ts"
  - "tests/org-admin-role-mapping.test.ts"
```

`size: M`, from 9 paths, and `size_estimate` agrees. As ADR-085 described it, MIR-16-f was about 19
files, which is `L` (ADR-086 *Context*). The removal moved to MIR-16-g, which MIR-17 now also
depends on. `glossary_owed` is `[]`.

## 8. Rejected alternatives

- **Keep writing `member.role` alongside `team_role` until MIR-16-g.** That needs no change here.
  Rejected: every rank change made between now and MIR-16-g would add a row MIR-16-g has to convert,
  and the audit would keep recording a value nothing reads.
- **Audit through a new trigger on `membership.team_role`.** Rejected: `membership_make_primary`
  writes `team_role` on every move and admit. A trigger could not tell a rank change from a move
  without reading intent it does not have.
- **Change the parameter to `public.team_role` now.** Rejected: it changes the signature, which is in
  `010`'s census and cast explicitly in 250. That change belongs with the type re-creation in
  MIR-16-g, where the parameter has to change anyway.
- **Move the legacy manager rows here with an `update`.** Rejected: the removed-member clause
  refuses it, and it would write an audit row per manager (ADR-086 *Context*). MIR-16-g re-types
  the column instead.

## Changelog

- `2026-11-08T01:15:47Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from the ticket and ADR-085 before the source tree was read for 3–8. Reading it found
  three things:
  - removed managers make an `update`-based move impossible under the current trigger, which led to
    ADR-086 decision 2's re-type;
  - removing the value with its fixtures is about 19 files (`L`), which led to the split to
    MIR-16-g;
  - the returned row's `team_role` may be read from a stale snapshot, which added AC-8 and § 4.4.

  Amended by `tech-lead-design`.

## Delegated decisions

- **ADR-086**: MIR-16-f is the write side (`set_member_role` writes `team_role` and its own audit
  row, and no longer writes `member.role`). MIR-16-g removes `'manager'` by re-typing `member.role`,
  which fires no row trigger, and `member_role_change` keeps its history as text. The seam returns
  the requested rank. MIR-17 depends on MIR-16-g.
