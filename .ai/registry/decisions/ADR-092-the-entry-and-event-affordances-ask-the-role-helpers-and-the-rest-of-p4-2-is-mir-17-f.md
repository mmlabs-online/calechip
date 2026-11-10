---
doc_version: 3
last_updated: 2026-11-09
governed_by: [RULE-01, RULE-02, RULE-04]
---

# ADR-092 — The entry and event affordances ask the role helpers; `mayEditEvent` needs no team comparison; the rest of P4-2 is MIR-17-f

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-09 — at `/plan MIR-17-e` (ADR-008, ADR-067).

This ADR splits MIR-17-e and settles one P4-2 bullet by reading the database. It reverses no
accepted decision.

## Context

Counted on 2026-11-09 at `origin/main` `f6ac9da` (MIR-17-d shipped).

- **Four literal role tests remain in entry and event components**: `EditEntry.tsx:88`,
  `EventEditor.tsx:282`, `EventDetail.tsx:87` and `EventAttendancePanel.tsx:138`. *Until the re-plan
  of 2026-11-09 this listed a fifth, `Sidebar.tsx:540`. That line is inside a JSX comment that has
  rendered nothing since UIE-10 (MIR-17-e `04-review.md`, finding 1).*
- **P4-2 says *"`mayEditEvent` currently has no team comparison"*** (`plan:242`). Since MIR-13 and
  MIR-16-b, the database rule it mirrors is `may_manage_event`. That rule admits the creator who
  holds an active team, or an org admin of the event's org
  (`20261107230000_mir16b_is_org_admin.sql`). It compares no team either. A client can see only its
  own org's events, so *"creator, or admin"* is already the database's rule on every event the
  client can see.
- **`MemberList`'s manager toggle cannot be scoped from the client today.**
  - Since MIR-17-d, `Member.role` is `"manager"` for anyone who manages any team (ADR-091).
  - The toggle writes the roster team's `team_role`, and no field on `Member` carries that.
  - Scoping it needs a batched read of each row's roster team role, which is a new RPC. Along with
    the picker and router guards, that makes MIR-17-e about 15 files, which is `L`.
- **`roles.ts`'s `mayDecideEntriesOf` comment** says its `ownerId` is *"kept for MIR-17"*. Since
  ADR-090 only the mock reads it.

## Decision

1. **MIR-17-e moves the four components onto `mayAdminister`.** No behaviour changes.
2. **`mayEditEvent` keeps *creator, or admin*.** P4-2's team-comparison bullet is answered by
   `may_manage_event`, which is org-bounded and has no team clause. Adding one on the client would
   draw a narrower affordance than the database grants.
3. **`roles.ts`'s comment says what is true.** `mayDecideEntriesOf` is the mock's decider, and the
   worklist decides per owner (ADR-090).
4. **MIR-17-f is the rest of P4-2**, and MIR-20 depends on it:
   - `MemberList`'s predicates and manager toggle, with the batched roster-team-role read they
     need;
   - the viewed-team picker;
   - router role guards.

## Options considered

- **Add a team comparison to `mayEditEvent`.** Rejected (decision 2): it disagrees with the database
  in the direction that hides a power the admin has.
- **Plan `MemberList` here.** Rejected: it needs an RPC and an ADR, which makes this slice `L`.
- **One more split, now, into three tickets.** Rejected: each costs a path, and MIR-17-f's own PLAN
  counts its parts.

## Consequences

- After MIR-17-e, no component outside `src/lib/roles.ts` and the seams compares `role` with a
  literal, except `MemberList` and `viewed-team.ts`, which are MIR-17-f's.

## Revert condition

`may_manage_event` gains a team clause. Then decision 2 is revisited with it.
