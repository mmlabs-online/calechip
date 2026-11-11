---
doc_version: 3
last_updated: 2026-11-11
governed_by: [RULE-01, RULE-02, RULE-04]
---

# ADR-094 — MemberList is scoped through reads that already exist, the picker asks the helper, and router role guards are MIR-17-g

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-11 — at `/plan MIR-17-f` (ADR-008, ADR-067).

This ADR splits MIR-17-f and replaces one prediction ADR-092 made in its *Context*. It reverses no
accepted decision.

## Context

Counted on 2026-11-11 at `origin/main` `a1a1319` (MIR-15-c shipped).

- **MemberList's three predicates are narrower than the database.** `canRemove`, `canPromote` and
  `canSetManager` (`src/routes/MemberList.tsx:351-361`) require `m.teamId === me.teamId`, the
  caller's roster team. `member_update_admin`, `promote_member_to_admin` and `set_member_role` all
  admit a row whose roster team is any of the caller's active teams:
  `member_roster_team_id(m.id) in (select member_team_ids(auth.uid()))`
  (`20261107230000_mir16b_is_org_admin.sql:787-795`, `20261107235000_mir16e_rename_admin_to_org_admin.sql:67`,
  `20261108200000_mir16h_member_role_drops_manager.sql:130`).
- **The manager toggle reads the wrong rank.** It labels and writes from `m.role`
  (`MemberList.tsx:215`, `:643`). Since MIR-17-d that is *manages any team* (ADR-091). But
  `set_member_role` writes the roster team's `team_role`. So a person who manages team B and is a
  member on roster team A is offered *Remove manager*. The write sets A to `member`, which is
  already true, so nothing changes.
- **ADR-092 predicted a new batched definer RPC for each row's roster team role.** None is needed:
  - The computed field `roster_team_role(public.member)` exists (MIR-16-c,
    `20261108090000_mir16c_manager_read_from_membership.sql:42-47`). It is granted to
    `authenticated`, and it wraps the definer `member_roster_team_role`.
  - `list_all_members()` is the definer read the admin's roster already uses
    (`src/lib/data/supabase.ts:2474`). The seam already selects computed fields over its rows
    (`MEMBER_COLUMNS`). So selecting `id, roster_team_role` over the same call gives every row's
    roster team role, including rows on the caller's non-primary teams. A table select would not
    return those rows: `member_select_team` admits only the primary team.
- **The caller's active team ids are an existing grant too.** `member_team_ids(uuid)` is granted
  to `authenticated` (`20261103120000_mir13_write_path_org_bound.sql:82`). MIR-15-e already calls a
  helper of this kind with the caller's own uid for an affordance: `isOwnOrgShared` calls
  `member_org_id` (ADR-079 decision 5).
- **The viewed-team picker** compares `role !== "admin"` at `src/lib/viewed-team.ts:61` and `:85`.
  Replacing those two comparisons is mechanical.
- **Router role guards are a design decision, not a replacement.** Every admin route is guarded on
  `member`, and the screen refuses in place *"because the refusal is what says why"*
  (`src/App.tsx`, the `/admin` and `/reports` route comments). ADR-089 *Context* said this decision
  belongs to the slice that makes it. Making it moves e2e refusal assertions. With it, MIR-17-f is
  about 16 files, which is `L`.

## Decision

1. **No migration.** MemberList reads two new seam functions, and each is built on an existing
   grant:
   - `listRosterTeamRoles()` selects `id, team_role:roster_team_role` over `list_all_members`;
   - `listOwnTeamIds()` calls `member_team_ids` with the caller's uid.
2. **The three predicates move to `src/lib/roles.ts` as pure functions over a `RosterScope`**:
   `mayRemoveMember`, `mayPromoteMember` and `maySetManager`. Each tests "the row's roster team is
   one of the caller's active teams". The toggle labels and writes from the row's roster team role.
   The picker asks `mayAdminister`. The client's affordance now matches what the database grants:
   no power is added or removed.
3. **Router role guards are MIR-17-g**, which decides between interception and the in-place
   refusals. MIR-17-f does not touch `src/App.tsx`.
4. **MIR-20 depends on MIR-17-g.**

## Options considered

- **A new definer RPC `list_roster_team_roles(uuid[])`**, as ADR-092 predicted. Rejected. It would
  return what an existing definer read plus an existing computed field already return, and it would
  add a migration that a human must apply (RULE-09).
- **Add `roster_team_role` to `MEMBER_COLUMNS` and a field to `Member`.** Rejected:
  - `tests/org-admin-role-mapping.test.ts:60-65` pins MIR-17-d AC-6, which says `MEMBER_COLUMNS` does
    not carry it;
  - every constructor of `Member` in fixtures and the mock would have to change, which is a shared
    type rippling outward (XL by the sizing table).
- **A table select `from("member").select("id, roster_team_role")`.** Rejected: `member_select_team`
  admits only the primary team, so the rows that motivate this ticket would be missing.
- **Keep router guards in MIR-17-f.** Rejected: about 16 files, `L`.

## Consequences

- After MIR-17-f, no file outside `src/lib/roles.ts` and the seams compares `role` with a literal.
- The scoping is observable only with a caller on more than one team. The mock has one team per
  member, so the pure predicates carry the multi-team cases in a unit test.

## Revert condition

`list_all_members` stops returning rows on the caller's non-primary teams, or `member_team_ids` loses
its grant to `authenticated`. Then decision 1 is revisited with a dedicated RPC.
