---
doc_version: 3
last_updated: 2026-11-09
governed_by: [RULE-01, RULE-02, RULE-04, RULE-09]
---

# ADR-091 — The application's *manager* is whoever manages a team, read through `manages_a_team`, and the rest of P4-2 is MIR-17-e

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-09 — at `/plan MIR-17-d` (ADR-008, ADR-067).

**This ADR supersedes ADR-085 decision 1's third bullet** (*"the member seam takes the application's
`"manager"` from `roster_team_role`"*). It takes the option ADR-085 *Options considered* rejected
*"for now … until MIR-17 makes it per team"*, and it does so at MIR-17. It also splits MIR-17-d.

## Context

Counted on 2026-11-09 at `origin/main` `6428bba` (MIR-17-c shipped).

- **Since MIR-17-c the worklist decides per team** (ADR-090). Every way into it still asks the
  global rank, `mayDecide(me.role)`:
  - `TopBar.tsx:304-308`;
  - `AdminLayout.tsx:189`;
  - `AdminTabs.tsx:315`, the manager's one tab;
  - the screen's own first check.

  The application's `"manager"` is the roster team's `team_role`
  (`src/lib/data/supabase.ts:970-971`, MIR-16-c). So a person who manages only a second team is
  `"member"`, and they find no way in.
- **Making the role per team on the client changes `Member`**, a shared type that every screen and
  the mock read. That is `XL` (`.ai/01-operating-model.md` § Sizing).
- **The application's role is used for affordances only** (ADR-005). Every control is the database's,
  and that is per team (`may_decide_entry`).
- **The rest of MIR-17-d** covers `MemberList`, `EditEntry`, `EventEditor`, `EventDetail`,
  `EventAttendancePanel`, the picker, `Sidebar`, the `roles.ts` comment and router guards. That is
  about 16 files with this slice, which is `L`.

## Decision

1. **The application's `"manager"` means *manages at least one team*.** A new definer
   `public.member_manages_a_team(uuid)`, and its computed field `public.manages_a_team(public.member)`,
   answer true when either holds:
   - the person holds `team_role = 'manager'` on an active `membership` row, and is approved and not
     removed;
   - or `member_roster_team_role(id) = 'manager'`, which keeps a removed manager labelled as one, as
     today.

   The seam selects it, and `appRole` reads it in place of `team_role:roster_team_role`. Every answer
   that is `"manager"` today stays `"manager"`. A second-team manager becomes one.
2. **No client entry point changes.** `TopBar`, `AdminLayout`, `AdminTabs` and the worklist's first
   check admit a second-team manager because `mayDecide(role)` now says yes.
3. **MIR-17-e is the rest of P4-2**, and MIR-20 depends on it. It plans its own count, and splits
   again if it is `L`.

## Options considered

- **A per-team role on `Member`** (`teamRoles: { teamId, teamRole }[]`). Rejected: `XL`.
- **A seam read `mayDecideAnything()`, called by each entry point.** Rejected: four components would
  each gain an async read and a loading state for one boolean, when the member row is already read
  everywhere.
- **Keep the roster semantics and leave the links for later.** Rejected: MIR-17-c's gain stays
  unreachable without typing the address.

## Consequences

- On a roster, a person who manages another team shows the *Manager* badge.
  - `MemberList`'s *Make manager* / *Remove manager* toggle reads the same role. For that person, on
    a team they do not manage, it offers *Remove manager*, which writes nothing (MIR-16-f AC-4).
    MIR-17-e scopes the toggle.
  - After such a call, `setMemberRole` returns the requested rank (ADR-086 decision 3), and the next
    read shows the true one.
- `member_roster_team_role` stays in the database. The seam no longer selects it.

## Revert condition

`Member` gains a per-team role. Then decision 1's one-value summary is replaced by the per-team
value, and `manages_a_team` is dropped.
