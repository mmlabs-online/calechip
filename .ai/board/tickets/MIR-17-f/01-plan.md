---
ticket: MIR-17-f
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-11T08:04:23Z
inputs_read:
  - .ai/board/tickets/MIR-17-f/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-089-the-admin-screen-guards-go-through-the-role-helpers-first-and-the-rest-of-p4-2-is-mir-17-c.md
  - .ai/registry/decisions/ADR-092-the-entry-and-event-affordances-ask-the-role-helpers-and-the-rest-of-p4-2-is-mir-17-f.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/tickets/MIR-17-e/01-plan.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql
  - supabase/migrations/20261107230000_mir16b_is_org_admin.sql
  - supabase/migrations/20261107235000_mir16e_rename_admin_to_org_admin.sql
  - supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql
  - supabase/migrations/20261108200000_mir16h_member_role_drops_manager.sql
  - supabase/migrations/20261109120000_mir17d_manages_a_team.sql
  - src/lib/roles.ts
  - src/lib/viewed-team.ts
  - src/hooks/useViewedTeam.tsx
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/routes/MemberList.tsx
  - src/App.tsx
  - tests/role-guards.test.ts
  - tests/org-admin-role-mapping.test.ts
  - tests/seam-parity.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-17-f — MemberList's controls are scoped to the caller's teams, and the picker asks the helper

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:306`):

| ID | Feature | Group |
|---|---|---|
| MIR-17 | Client role checks take a team or org, every admin-only guard is replaced, and the router gains role guards | MIR |

**P4-2** (`.ai/board/plans/calechip-multi-tenancy-plan.md:238-244`) asks for these bullets:

- *"`canRemove`, `canPromote`, `canSetManager` scoped correctly (`MemberList.tsx:349-366`)"*;
- *"Replace every `me.role !== "admin"` guard"*;
- *"Router has no role guards at all; add them"*.

**ADR-092 decision 4** gives MIR-17-f three parts:

- `MemberList`'s predicates and manager toggle;
- the viewed-team picker;
- router role guards.

**ADR-094**, written at this PLAN, does two things:

- **decision 3** moves router guards to **MIR-17-g**;
- **decision 1** replaces ADR-092's predicted RPC with two reads that already exist.

**Who gains what.** An org admin on more than one team opens *Members*. Today they get *Delete
account*, *Promote* and *Make manager* only on rows of their roster team. The database allows those
three writes on a row of any team the admin is active on. After this ticket, the controls appear on
exactly those rows.

The manager toggle also says what it will do. Today it reads *manages any team*. So someone who
manages team B and is a plain member of roster team A is offered *Remove manager*, and pressing it
writes nothing. After this ticket the toggle reads the rank on the row's roster team, which is the
rank the write changes. The picker's two role tests ask `mayAdminister`. With this ticket, no
component compares `role` with a literal.

`size_estimate: M`. The work is one screen, the picker's two lines, two new read-only seam functions
in two implementations, three pure predicates, two tests, and the split's board overhead.

**Out of scope — and where each goes:**

- **Router role guards** (`src/App.tsx`) go to **MIR-17-g** (ADR-094 decision 3). That ticket
  decides between interception and the screens' in-place refusals (ADR-089 *Context*).
- **`mayAdminister` and `mayDecide` gaining a team or org parameter** (P4-2 bullet 1) is not done
  here. ADR-092 decision 4 does not list it for MIR-17-f. The per-team half that MemberList needs is
  carried by `RosterScope` (§ 4.3). The decide half is carried by `listEntryOwners` (ADR-090).
- **`canPromote`'s rank condition** stays `m.role === "member"`, the any-team rank. The database
  would also promote a manager. Widening the affordance is a behaviour change nobody asked for.
- **The `Edit` panel** (`setMemberTeam`) and **`View info`** are unchanged.
- **Which rows the roster shows** is unchanged. The admin still reads `listAllMembers` and a member
  still reads `listMembers` (INV-04's denominator).
- **The mock gains no multi-team membership.** It holds one team per member, and modelling more is a
  mock-wide change. The multi-team cases are proven on the pure predicates (AC-1, AC-2).
- **`tests/e2e/**`** is not edited. On the single-team mock every control is drawn exactly as today
  (AC-6).
- **No migration, no policy, no grant.** The database already grants what the client will now
  offer.

## 2. Acceptance criteria

Throughout:

- **Quan** is an org admin. His roster team is **A**, and he is also active on team **B**.
- **Bình** is a member on roster team B.
- **Chi** is a member on team **C**, where Quan is not active.
- **Vu**'s roster team is A, where his team role is `member`. He manages team B, so his `role` is
  `"manager"` (ADR-091).
- **Mona** is a manager and **Thanh** a member, both on A.

AC-1 to AC-5 are observed through the unit tests in `tests/member-list-scope.test.ts`. AC-6 is
observed in the member app against the mock build. AC-7 and AC-8 are observed against the source.

**AC-1 — an admin is offered the three controls on any of their active teams**
- Given Quan's `RosterScope` has `ownTeamIds` `[A, B]`, and `teamRoles` maps Bình to `member`
- When `mayRemoveMember`, `mayPromoteMember` and `maySetManager` are asked about Quan and Bình
- Then all three are `true`

**AC-2 — and on no other row**
- Given the same scope
- When the three predicates are asked about Quan and Chi (team C), and about Quan and himself
- Then all three are `false` for both
- And `mayPromoteMember` and `maySetManager` are `false` for a row whose `role` is `"admin"`, on team
  A
- And `maySetManager` is `false` for a row on team A that has no entry in `teamRoles`

**AC-3 — nobody but an admin is offered any of them**
- Given Mona and Thanh, each with a scope whose `ownTeamIds` is `[A]` and whose `teamRoles` covers
  every row
- When the three predicates are asked about either of them and any other row on A
- Then all three are `false`

**AC-4 — the manager toggle follows the roster team's rank**
- Given Vu's roster team role is `member` while his `role` is `"manager"`
- When `managerToggleFor("member")` and `managerToggleFor("manager")` are asked
- Then the first is `{ label: "Make manager", next: "manager" }` and the second is
  `{ label: "Remove manager", next: "member" }`
- And `MemberList.tsx` takes the toggle's label, `data-role` and the role it writes from the row's
  `teamRoles` entry, never from `member.role`. So Quan is offered *Make manager* on Vu's row, and
  pressing it calls `setMemberRole(Vu, "manager")`

**AC-5 — the two reads answer only what the database would**
- When the mock seam's `listOwnTeamIds()` is called as Quan's fixture admin, then as nobody, then
  as a removed member
- Then it returns `[<the admin's teamId>]`, then `[]`, then `[]`
- And when the mock's `listRosterTeamRoles()` is called as an admin, it returns one
  `{ memberId, teamRole }` per member with a team. `teamRole` is `"manager"` exactly where that
  member's `role` is `"manager"`, and `"member"` otherwise
- And when it is called as a member or as nobody, it returns `[]`
- And the supabase seam's `listRosterTeamRoles` calls `rpc("list_all_members")` and selects
  `roster_team_role`. Its `listOwnTeamIds` calls `rpc("member_team_ids", …)`

**AC-6 — on the mock build, the Members screen is unchanged for every role**
- When the fixture admin, a manager and a member each open `/members`
- Then each is offered the same row controls, with the same labels and `data-role` values, as before
  this ticket. `tests/e2e/solo-member-admin.spec.ts` passes unedited

**AC-7 — the picker behaves exactly as before**
- When `resolveViewedTeam` and `pickableTeams` are exercised by `tests/viewed-team.test.ts`
- Then it passes unedited

**AC-8 — no file outside the role helpers and the seams compares `role` with a literal**
- When `src/routes/MemberList.tsx` and `src/lib/viewed-team.ts` are read with comments stripped
- Then neither matches `role (===|!==) "admin"|"manager"`, and each imports from `@/lib/roles`

**Invariants touched.** `[]`.

- **INV-04**: the roster each role reads is the same call as today. The two new reads feed
  affordances only, and no count reads them.
- **INV-07**: no entry path changes.

**Open questions.** None that block. One `TODO(verify)` is in § 4.2: the JSON shape PostgREST returns
for a `setof uuid` function. The mapper accepts both plausible shapes and throws on anything else.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No layout changes. The same three buttons, in the same place, appear on a different set of rows.

## 3. Permission model

Every line is an affordance (ADR-005). The control is the database's and none changes.

| Control on screen | Affordance (this ticket) | Control (unchanged) |
|---|---|---|
| *Delete account* | `mayRemoveMember` | `member_update_admin`: `is_org_admin` and `member_roster_team_id(id) in member_team_ids(auth.uid())` (`20261107230000:787-795`) |
| *Promote* | `mayPromoteMember` | `promote_member_to_admin`: org admin, row's roster team in the caller's teams, approved, not removed, not org admin (`20261107235000:51-75`) |
| *Make / Remove manager* | `maySetManager`, label from `managerToggleFor` | `set_member_role(uuid, text)`: same bound, never `org_admin` (`20261108200000:106-158`) |
| Picker options and `?team=` | `mayAdminister` in `viewed-team.ts` | `list_teams`, `list_*_for_team` test `is_org_admin` in their bodies |

**Denials.**

- A manager or member is offered none of the three controls (AC-3).
- An admin is offered none of them on their own row, on a row of a team they are not active on
  (AC-2), or on a row whose roster team role could not be read.

The new reads do not change who sees what:

- `listRosterTeamRoles` is `list_all_members`, which answers a non-admin with an empty list;
- `listOwnTeamIds` asks only for the caller's own uid.

## 4. Contract

### 4.1 `src/lib/domain/types.ts` — additive

```ts
/** MIR-17-f, ADR-094. A person's rank on one team — `public.team_role`. */
export type TeamRole = "member" | "manager";

/** MIR-17-f, ADR-094. One roster row's rank on its roster team — the computed field
 *  `public.roster_team_role(member)`. A row whose roster team role reads null is not returned. */
export interface RosterTeamRole {
  memberId: string;
  teamRole: TeamRole;
}
```

No existing type changes. `Member` gains no field (ADR-094, *Options considered*).

### 4.2 The seam — two new functions, both read-only

**`src/lib/data/index.ts`**, in `DataSeam`, after `listAllMembers`:

```ts
  /**
   * MIR-17-f, ADR-094 decision 1. Each roster row's rank on its roster team, for MemberList's
   * manager toggle. `list_all_members` with the computed field `roster_team_role` selected over it:
   * the admin's roster, including rows on the caller's non-primary teams. A non-admin gets [].
   * THROWS on a transport failure or a truncated read, the shape `listAllMembers` uses.
   */
  listRosterTeamRoles(): Promise<RosterTeamRole[]>;

  /**
   * MIR-17-f, ADR-094 decision 1. The caller's active team ids: `public.member_team_ids` for the
   * signed-in user. [] for no session, and for a caller not approved or removed (the function
   * returns no row for either). An affordance for MemberList; the write functions are the control.
   * THROWS on a transport failure.
   */
  listOwnTeamIds(): Promise<string[]>;
```

`RosterTeamRole` is added to that file's `import type { … } from "@/lib/domain/types"`.

**`src/lib/data/supabase.ts`**:

```ts
/** MIR-17-f. The two columns `listRosterTeamRoles` reads over `list_all_members`. */
const ROSTER_TEAM_ROLE_COLUMNS = "id, team_role:roster_team_role";

interface RosterTeamRoleRow {
  id: string;
  team_role: TeamRole | null;
}

  async listRosterTeamRoles(): Promise<RosterTeamRole[]> {
    const { data, error } = await client()
      .rpc("list_all_members")
      .select(ROSTER_TEAM_ROLE_COLUMNS)
      .limit(ROSTER_LIMIT);
    if (error) throw new Error(`listRosterTeamRoles failed: ${error.message}`);
    if (!Array.isArray(data)) throw new Error("listRosterTeamRoles received a body that is not a list");
    if (data.length >= ROSTER_LIMIT) {
      throw new Error(
        `listRosterTeamRoles returned ${data.length} rows at the ${ROSTER_LIMIT} limit: the roster ` +
          `may be truncated and must not be consumed`,
      );
    }
    return (data as RosterTeamRoleRow[]).flatMap((row) =>
      row.team_role === null ? [] : [{ memberId: row.id, teamRole: row.team_role }],
    );
  },

  async listOwnTeamIds(): Promise<string[]> {
    const { data: auth } = await client().auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return [];

    const { data, error } = await client().rpc("member_team_ids", { p_uid: uid });
    if (error) throw new Error(`listOwnTeamIds failed: ${error.message}`);
    if (!Array.isArray(data)) throw new Error("listOwnTeamIds received a body that is not a list");
    return data.map(toTeamId);
  },
```

`toTeamId` is a module-level function in the same file:

```ts
/** MIR-17-f. One element of `member_team_ids`' body. TODO(verify): PostgREST's shape for a
 *  `setof uuid` function — a bare string per element, or `{ member_team_ids: string }`. Both are
 *  accepted; anything else THROWS, so a third shape fails closed rather than offering a control. */
function toTeamId(element: unknown): string {
  if (typeof element === "string") return element;
  if (
    typeof element === "object" && element !== null &&
    typeof (element as { member_team_ids?: unknown }).member_team_ids === "string"
  ) {
    return (element as { member_team_ids: string }).member_team_ids;
  }
  throw new Error("listOwnTeamIds received an element that is not a team id");
}
```

`MEMBER_COLUMNS`, `MemberRow`, `toMember` and `appRole` are unchanged. MIR-17-d AC-6 still holds.

**`src/lib/data/mock.ts`**, beside `listAllMembers`:

```ts
  // MIR-17-f. `list_all_members` + `roster_team_role`: the mock holds one team per member, so the
  // roster team role IS the manager rank, and an admin's team role is `member` (promotion writes it).
  async listRosterTeamRoles(): Promise<RosterTeamRole[]> {
    if (!currentAdmin()) return [];
    return members
      .filter((m) => m.teamId !== null)
      .map((m) => ({ memberId: m.id, teamRole: m.role === "manager" ? "manager" : "member" }));
  },

  // MIR-17-f. `member_team_ids(auth.uid())`: one team per member here.
  async listOwnTeamIds(): Promise<string[]> {
    const me = members.find((m) => m.id === currentMemberId);
    if (!me || me.status !== "approved" || me.removedAt !== null || me.teamId === null) return [];
    return [me.teamId];
  },
```

`tests/seam-parity.test.ts` covers names and arity (both 0) unedited.

### 4.3 `src/lib/roles.ts` — the scope and the three predicates

```ts
import type { Member, MemberRole, TeamRole } from "@/lib/domain/types";

/**
 * MIR-17-f, ADR-094 decision 2. What MemberList knows about the caller's reach over the roster.
 * `ownTeamIds` is `member_team_ids(auth.uid())`; `teamRoles` is each row's roster team role.
 */
export interface RosterScope {
  ownTeamIds: readonly string[];
  teamRoles: ReadonlyMap<string, TeamRole>;
}

/** The scope of a caller who administers nothing: no team, no rank read. */
export const NO_ROSTER_SCOPE: RosterScope = { ownTeamIds: [], teamRoles: new Map() };

/** An admin, not the row itself, and the row's roster team is one of the caller's active teams —
 *  the bound `member_update_admin`, `promote_member_to_admin` and `set_member_role` share. */
const administersRow = (me: Member, m: Member, scope: RosterScope): boolean =>
  mayAdminister(me.role) && m.id !== me.id && m.teamId !== null && scope.ownTeamIds.includes(m.teamId);

export const mayRemoveMember = (me: Member, m: Member, scope: RosterScope): boolean =>
  administersRow(me, m, scope);

export const mayPromoteMember = (me: Member, m: Member, scope: RosterScope): boolean =>
  administersRow(me, m, scope) && m.role === "member";

export const maySetManager = (me: Member, m: Member, scope: RosterScope): boolean =>
  administersRow(me, m, scope) && !mayAdminister(m.role) && scope.teamRoles.has(m.id);

/** The manager toggle for a row whose roster team role is `teamRole`: what it says, and what it writes. */
export const managerToggleFor = (
  teamRole: TeamRole,
): { label: "Make manager" | "Remove manager"; next: TeamRole } =>
  teamRole === "manager"
    ? { label: "Remove manager", next: "member" }
    : { label: "Make manager", next: "manager" };
```

Each exported function carries a docblock saying it is an affordance (ADR-005) and naming its
control from § 3. `mayAdminister`, `mayDecide`, `mayDecideEntriesOf`, `ROLE_LABELS` and
`ROLE_BADGE_COLORS` are unchanged.

### 4.4 `src/routes/MemberList.tsx`

| Line (2026-11-11) | Before | After |
|---|---|---|
| `:24` import | `ROLE_BADGE_COLORS, ROLE_LABELS` | also `managerToggleFor, mayAdminister, mayPromoteMember, mayRemoveMember, maySetManager, NO_ROSTER_SCOPE, type RosterScope` |
| `:23` import | `Failure, Member, MemberRole, Team` | also `TeamRole` |
| `:86` `View` ready | `{ phase: "ready"; me; roster; teams }` | adds `scope: RosterScope` |
| `:151` | `const isAdmin = me.role === "admin";` | `const isAdmin = mayAdminister(me.role);` |
| `:152-158` | `Promise.all([roster, teams])` | admin: `Promise.all([seam.listAllMembers(), seam.listTeams(), seam.listOwnTeamIds(), seam.listRosterTeamRoles()])`, then `scope = { ownTeamIds, teamRoles: new Map(roles.map((r) => [r.memberId, r.teamRole])) }`. Non-admin: today's two reads and `scope = NO_ROSTER_SCOPE` |
| `:207` | `onSetManager(member: Member)` | `onSetManager(member: Member, teamRole: TeamRole)`; writes `seam.setMemberRole(member.id, managerToggleFor(teamRole).next)` |
| `:351-361` | three inline predicates comparing `m.teamId === me.teamId` | `canRemove = (m) => mayRemoveMember(me, m, scope)`, `canPromote = (m) => mayPromoteMember(me, m, scope)`, `canSetManager = (m) => maySetManager(me, m, scope)` |
| `:419` | `me.role === "admin"` | `mayAdminister(me.role)` |
| `:628-644` toggle | `data-role={member.role}`, label from `member.role === "manager"`, `onSetManager(member)` | with `const teamRole = scope.teamRoles.get(member.id)`, drawn when `teamRole !== undefined && canSetManager(member)`; `data-role={teamRole}`, label `managerToggleFor(teamRole).label`, `onSetManager(member, teamRole)` |

- The admin's four reads stay in the existing `try`. A throw from either new read renders
  `member-list-unavailable`, as any other read failure does today. No partial screen is drawn.
- The comments above the predicates (`:338-349`, `:356-359`) and at `:628-631` are rewritten to
  cite ADR-094 and the roster team role. Every `data-testid` is unchanged.

### 4.5 `src/lib/viewed-team.ts`

| Line | Before | After |
|---|---|---|
| `:61` | `if (role !== "admin") return …` | `if (!mayAdminister(role)) return …` |
| `:85` | `if (role !== "admin" \|\| teams.length <= 1) return [];` | `if (!mayAdminister(role) \|\| teams.length <= 1) return [];` |
| `:46`, `:82` comments | name `role !== "admin"` / `role === "admin"` | name `mayAdminister(role)` |

Plus `import { mayAdminister } from "@/lib/roles";`. The header's *"pure logic"* claim still holds,
because `roles.ts` imports only domain types.

### 4.6 Tests

- **`tests/role-guards.test.ts`.**
  - `FILES` gains `"src/routes/MemberList.tsx"` and `"src/lib/viewed-team.ts"`, under a
    `// MIR-17-f, AC-8` comment.
  - The first describe's title becomes
    `"MIR-17-b AC-4, MIR-17-e AC-4, MIR-17-f AC-8: the fourteen files ask the role helpers"`.
- **`tests/member-list-scope.test.ts`** (new). It has one `describe` per AC, from AC-1 to AC-5, and
  each `it` is prefixed `AC-n:`.
  - AC-1 to AC-3 build `Member` values with spread over `FIXTURE_ADMIN` and `FIXTURE_MEMBER` from
    `@/lib/fixtures`, with literal team ids `"team-a"`, `"team-b"` and `"team-c"`.
  - AC-4 calls `managerToggleFor`. It also reads `MemberList.tsx`'s source and asserts that it
    contains `scope.teamRoles.get(member.id)` and `managerToggleFor(`.
  - AC-5 drives the mock through `__setCurrentMember`, and reads `supabase.ts`'s source for
    `rpc("list_all_members")` with `roster_team_role` inside `listRosterTeamRoles`, and for
    `rpc("member_team_ids"` inside `listOwnTeamIds`.

## 5. Seam impact

Two functions are added to `DataSeam`, and to both implementations with the same name and arity 0:
`listRosterTeamRoles` and `listOwnTeamIds`. No existing function's signature or behaviour changes.

## 6. Schema delta

`none`. The two reads use existing objects and grants:

- `list_all_members()`, the definer read the admin roster uses;
- the computed field `roster_team_role(public.member)`, from
  `20261108090000_mir16c_manager_read_from_membership.sql:42-47`, granted to `authenticated`;
- `member_team_ids(uuid)`, granted to `authenticated` at `20261103120000:82`.

ADR-094 decision 1 replaces the RPC that ADR-092 *Context* predicted. `requires_adr` stays `true`,
because ADR-094 is this ticket's ADR.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-094-memberlist-is-scoped-through-reads-that-already-exist-and-router-guards-are-mir-17-g.md"
  - ".ai/board/tickets/MIR-17-g/ticket.yaml"
  - ".ai/board/tickets/MIR-20/ticket.yaml"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/roles.ts"
  - "src/lib/viewed-team.ts"
  - "src/routes/MemberList.tsx"
  - "tests/role-guards.test.ts"
  - "tests/member-list-scope.test.ts"
```

- **Size.** `size: M`, from 12 paths, and `size_estimate` agrees. With router guards
  (`src/App.tsx`, a guard component, and the e2e refusal specs it would move), MIR-17-f counted about
  16, which is `L`. Router guards split to MIR-17-g (ADR-094).
- **Board and registry writes made at this PLAN:**
  - the ADR, under ADR-067;
  - MIR-17-g's `ticket.yaml`;
  - `MIR-17-g` added to MIR-20's `depends_on`.
- **Not XL.** `types.ts` gains two types and changes none, so no existing caller changes. The seam
  gains two functions and changes none (operating model § *Sizing*).
- `useViewedTeam.tsx`, which the ticket's `mir_detail` cites, already asks `mayAdminister` (`:56`),
  so it is not listed.
- `glossary_owed` is `[]`.

## 8. Rejected alternatives

- **A new definer RPC `list_roster_team_roles(uuid[])`**, as ADR-092 predicted. Rejected:
  `list_all_members` plus the existing computed field already returns this. The RPC would add a
  migration that a human must apply (RULE-09).
- **`roster_team_role` in `MEMBER_COLUMNS`, plus a `Member.rosterTeamRole` field.** Rejected for two
  reasons:
  - it breaks MIR-17-d AC-6 (`tests/org-admin-role-mapping.test.ts:60-65`);
  - every `Member` constructor in the fixtures and the mock would have to change.
- **A table select `from("member").select("id, roster_team_role")`.** Rejected: `member_select_team`
  admits only the primary team, so rows on a second team, which are the rows this ticket is about,
  would be missing.
- **Keep the predicates inline in `MemberList.tsx`.** Rejected: the mock has one team per member, so
  the multi-team cases could not be shown anywhere. As pure functions they are unit-tested directly.
- **Keep router guards here.** Rejected: about 16 files (`L`), and a design decision that moves e2e
  refusal assertions (ADR-089 *Context*).

## Changelog

- `2026-11-11T08:04:23Z` — all sections written. Raised by `tech-lead-design`, amended by
  `tech-lead-design`. Sections 1 and 2 were drafted from P4-2, ADR-092 and the ticket's
  `mir_detail` before the source tree was read for sections 3 to 8. Reading the tree found three
  things:
  - `roster_team_role` and `member_team_ids` already exist and are granted, so ADR-092's predicted RPC
    and its migration fell away. `schema_delta` is `none`.
  - A table select cannot see a second team's rows, which is why the read goes over
    `list_all_members`.
  - The mock cannot express a second team. So AC-1 to AC-4 were moved onto pure predicates, and AC-6
    pins the mock build as unchanged.

  Router guards split to MIR-17-g. The ticket's title still names them. It is the creator's, and this
  section and ADR-094 record the narrowing.

## Delegated decisions

- **ADR-094**:
  - MemberList is scoped through `list_all_members` + `roster_team_role` and `member_team_ids`, with
    no migration;
  - the three predicates and the toggle move to `roles.ts` as pure functions;
  - the picker asks `mayAdminister`;
  - router guards are MIR-17-g, and MIR-20 depends on it.
