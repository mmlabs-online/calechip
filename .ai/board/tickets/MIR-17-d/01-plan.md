---
ticket: MIR-17-d
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-09T13:56:42Z
inputs_read:
  - .ai/board/tickets/MIR-17-d/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-085-the-manager-rank-is-read-from-membership-first-and-the-value-leaves-member-role-second.md
  - .ai/registry/decisions/ADR-086-set-member-role-writes-the-team-role-and-the-manager-value-is-removed-by-a-column-retype.md
  - .ai/registry/decisions/ADR-090-the-worklist-decides-per-row-from-list-entry-owners-and-the-rest-of-p4-2-is-mir-17-d.md
  - .ai/templates/plan.md
  - supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql
  - supabase/tests/010-catalogue.test.sql
  - src/lib/data/supabase.ts
  - src/lib/roles.ts
  - src/components/TopBar.tsx
  - src/components/AdminLayout.tsx
  - src/components/AdminTabs.tsx
  - src/routes/PendingEntries.tsx
  - tests/org-admin-role-mapping.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-17-d — whoever manages a team is a manager in the app, so the way into the worklist finds them

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:306`):

| ID | Feature | Group |
|---|---|---|
| MIR-17 | Client role checks take a team or org, every admin-only guard is replaced, and the router gains role guards | MIR |

**P4-2** (`.ai/board/plans/calechip-multi-tenancy-plan.md:239`): *"`mayAdminister`, `mayDecide`,
`mayDecideEntriesOf` all take a team or org parameter"*. **ADR-090 *Consequences*** says: *"A
second-team manager reaches the worklist by its address. The links that lead there still ask the
global rank until MIR-17-d."* **ADR-091 decision 1** (written at this PLAN) answers it in the seam
rather than in four components. The application's *manager* becomes *manages at least one team*.
The rest of P4-2 is MIR-17-e.

**Who gains what.** A person who manages a team other than their roster team now sees what every
manager sees: the *Pending approvals* link in the top bar, the manager's tab in the admin strip, and
the worklist itself. Since MIR-17-c, that worklist lets them decide that team's entries. Nobody who
is a manager today stops being one, and nobody who is not a manager becomes one.

`size_estimate: M`. The work is one migration and its pgTAP, `010`, the seam and one vitest, plus the
split's board overhead.

**Out of scope — and where each goes:**

- **`MemberList`'s toggles and predicates** go to **MIR-17-e** (ADR-091 *Consequences*: a
  second-team manager's *Remove manager* on a team they do not manage writes nothing until then).
- **`EditEntry`, `EventEditor`, `EventDetail`, `EventAttendancePanel`, the picker, `Sidebar`,
  `roles.ts`'s stale comment and router guards** go to **MIR-17-e**.
- **`TopBar`, `AdminLayout`, `AdminTabs` and `PendingEntries`** are not edited. They admit the new
  managers through `mayDecide(role)` (ADR-091 decision 2).
- **A per-team role on `Member`** is not added. That is `XL` (ADR-091 *Options considered*).
- **The mock seam** models one team per person, so it holds no second-team manager. It is unchanged.
- **`member_roster_team_role`** stays in the database, unused by the seam.

## 2. Acceptance criteria

Throughout: **Mona** manages T, her roster team. **Thanh** is a member of T. **Vu** is a member of T
who also holds an active, non-primary `membership` row on team T2 with `team_role = 'manager'`.
**Rae** is a removed manager of T. **Ada** is an org admin. AC-1 to AC-5 are observed against the
database. AC-6 is observed against the member seam's source.

**AC-1 — a roster-team manager manages a team**
- When `member_manages_a_team(Mona)` is read
- Then it is true

**AC-2 — a second-team manager manages a team**
- When `member_manages_a_team(Vu)` is read
- Then it is true, while `member_roster_team_role(Vu)` is `member`

**AC-3 — a member, an org admin who holds no manager row, and a pending sign-up do not**
- When `member_manages_a_team` is read for Thanh, Ada and a pending sign-up
- Then each is false

**AC-4 — a removed manager keeps the label they have today**
- When `member_manages_a_team(Rae)` is read
- Then it is true, matching `member_roster_team_role(Rae) = 'manager'`

**AC-5 — the computed field answers the same on rows the caller may read**
- Given Ada is signed in
- When she selects `manages_a_team` over `public.member` for T's roster
- Then each row's value equals `member_manages_a_team(id)`. `anon` holds no `EXECUTE` on either
  function

**AC-6 — the member seam reports a manager from `manages_a_team`**
- When `src/lib/data/supabase.ts` maps a member row
- Then the application's role is `"admin"` for `org_admin`, `"manager"` when `manages_a_team` is
  true, and `"member"` otherwise. `MEMBER_COLUMNS` selects `manages_a_team`, and no longer selects
  `roster_team_role`

**Invariants touched.** `[]`. Two read functions are added. No entry, count or window is read or
written differently.

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No screen changes. A second-team manager sees the existing manager affordances.

## 3. Permission model

No permission changes. The new functions are reads, and every control stays the database's
(`may_decide_entry`, ADR-073):

| Function | Security | `authenticated` | `anon` |
|---|---|---|---|
| `member_manages_a_team(uuid)` | definer, `search_path = ''`, stable | EXECUTE | none |
| `manages_a_team(public.member)` | invoker, the computed field, so it is passed only rows the caller's policies admit | EXECUTE | none |

The affordances this changes (the top bar link, the manager tab, the worklist's first check) are
affordances only (ADR-005). A second-team manager who opens them decides only what
`may_decide_entry` admits.

## 4. Contract

### 4.1 Migration — `supabase/migrations/20261109120000_mir17d_manages_a_team.sql`

The migration is idempotent (ADR-024) and wrapped in `begin; … commit;`.

```sql
-- ADR-091 decision 1. True when the person manages a team now, or — for a removed person — when the
-- row member_roster_team_role reads says manager, so a removed manager keeps today's label.
create or replace function public.member_manages_a_team(p_member uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
           select 1
             from public.membership ms
             join public.member m on m.id = ms.member_id
            where ms.member_id = p_member
              and ms.left_at is null
              and ms.team_role = 'manager'::public.team_role
              and m.status = 'approved'::public.member_status
              and m.removed_at is null)
      or coalesce(public.member_roster_team_role(p_member) = 'manager'::public.team_role, false);
$$;
revoke all on function public.member_manages_a_team(uuid) from public, anon;
grant execute on function public.member_manages_a_team(uuid) to authenticated;

create or replace function public.manages_a_team(p_member public.member) returns boolean
  language sql stable set search_path = '' as $$
  select public.member_manages_a_team(p_member.id);
$$;
revoke all on function public.manages_a_team(public.member) from public, anon;
grant execute on function public.manages_a_team(public.member) to authenticated;
```

### 4.2 pgTAP — `supabase/tests/340-manages-a-team.test.sql`

The file has one `plan(n)` and runs on `tests.seed()`, naming roles only through `tests.member_role`
and team roles through `tests.team_role_for` (ADR-087). It adds two fixtures as `postgres`:

- **team T2**, with a non-primary active row for `member_t` on T2 (`team_role = 'manager'`). That
  makes `member_t` the AC's Vu, and the file then uses `member_t2` for the AC's Thanh;
- **Rae**, a manager placed with `tests.put_on_team(…, 'manager')` and then removed by the owner.

It makes one assertion or more per AC-1 to AC-5. AC-5 runs as `admin_t` with
`tests.authenticate_as`. It uses `has_function_privilege('anon', …, 'EXECUTE')` for both
signatures.

### 4.3 `supabase/tests/010-catalogue.test.sql`

The definer census gains `'public.member_manages_a_team(uuid)'`, after
`'public.member_roster_team_role(uuid)'` (`:58`). `manages_a_team(public.member)` is invoker, and is
listed only if the census lists invokers, in the way MIR-16-c treated `roster_team_role`.

### 4.4 Member seam — `src/lib/data/supabase.ts`

- **`MEMBER_COLUMNS` (`:997-998`)** — `team_role:roster_team_role` becomes `manages_a_team`.
  `team_id:roster_team_id` stays.
- **`MemberRow` (`:982`)** — `team_role: "member" | "manager" | null;` becomes
  `manages_a_team: boolean;`.
- **`appRole` (`:969-971`)** —

  ```ts
  /** MIR-17-d, ADR-091 decision 1. The application's one role per person: org_admin from
   *  `member.role`, manager when the person manages any team (`manages_a_team`), member otherwise. */
  const appRole = (row: MemberRow): MemberRole =>
    row.role === "org_admin" ? fromDbRole(row.role) : row.manages_a_team ? "manager" : "member";
  ```

`fromDbRole`, `toDbRole`, `toMember` and `setRankThroughRpc` are unchanged.

### 4.5 vitest — `tests/org-admin-role-mapping.test.ts`

The MIR-16-c describe (`:51-72`) becomes *"MIR-17-d AC-6: appRole reads the manager rank from
manages_a_team"*, and its three cases change:

- `appRole`'s regex matches § 4.4's body;
- `MEMBER_COLUMNS` contains `manages_a_team` and not `roster_team_role`;
- `MemberRow` declares `manages_a_team: boolean;`.

The other cases are unchanged.

## 5. Seam impact

**`DataSeam`: no signature changes.** One column list, one row field and one mapping change in
`supabase.ts`. `MemberRole` is unchanged, the mock does not change, and seam parity is unaffected.
**`SystemSeam`: none.**

## 6. Schema delta

**Not `none`.** It adds two functions. No table, column, enum value, policy, trigger, constraint,
grant or row changes. **ADR-091**, accepted under ADR-067 at this PLAN. Applying it to the hosted
project is human-only (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-091-the-applications-manager-is-whoever-manages-a-team-and-the-rest-of-p4-2-is-mir-17-e.md"
  - ".ai/board/tickets/MIR-17-e/ticket.yaml"
  - ".ai/board/tickets/MIR-20/ticket.yaml"
  - "supabase/migrations/20261109120000_mir17d_manages_a_team.sql"
  - "supabase/tests/340-manages-a-team.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "src/lib/data/supabase.ts"
  - "tests/org-admin-role-mapping.test.ts"
```

`size: M`, from 8 paths, and `size_estimate` agrees. As ADR-090 described it, MIR-17-d was about 16
files, which is `L`, so the rest is MIR-17-e (ADR-091). MIR-20 now also depends on MIR-17-e.
`glossary_owed` is `[]`.

## 8. Rejected alternatives

- **Re-key `TopBar`, `AdminLayout` and `AdminTabs` on a new `mayDecideAnything()` seam read.**
  Rejected in ADR-091: four components would gain async state for one boolean the member row can
  carry.
- **A per-team role on `Member`.** Rejected: it changes a shared type, which is `XL`.
- **Define `manages_a_team` as active rows only.** That is simpler. Rejected: a removed manager would
  lose the *Manager* label they carry today on rosters that still list them (MIR-16-c AC-2's
  behaviour).

## Changelog

- `2026-11-09T13:56:42Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from P4-2 and ADR-090 *Consequences* before the source tree was read for 3–8. Reading it
  found two things:
  - every entry point asks `mayDecide(role)`, and `role` comes from one seam mapping, which moved the
    fix into the seam (ADR-091);
  - `roster_team_role` labels removed managers, which added AC-4 and the function's second disjunct.

  The rest of P4-2 moved to MIR-17-e. Amended by `tech-lead-design`.

## Delegated decisions

- **ADR-091**: the application's *manager* means *manages at least one team*, read through the new
  `manages_a_team` computed field. This supersedes ADR-085 decision 1's seam mapping. No entry-point
  component changes. MIR-17-e is the rest of P4-2, and MIR-20 depends on it.
