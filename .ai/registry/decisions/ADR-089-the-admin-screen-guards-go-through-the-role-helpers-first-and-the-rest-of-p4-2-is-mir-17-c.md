---
doc_version: 3
last_updated: 2026-11-08
governed_by: [RULE-01, RULE-02, RULE-04]
---

# ADR-089 — The admin screens' guards go through the role helpers first, and the rest of P4-2 is MIR-17-c

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-08 — at `/plan MIR-17-b` (ADR-008, ADR-067).

This ADR splits MIR-17-b as ADR-088 decision 2 described it. It reverses no accepted decision.

## Context

Counted on 2026-11-08 at `origin/main` `7774e03` (MIR-17 shipped).

- **Literal role tests remain in 17 `src/` files outside `src/lib/roles.ts` and the two seams**
  (grep `role (!|=)== "(admin|manager)"`). These are the ones that matter here:
  - six screen guards and one layout guard: `AdminHub:72`, `NewSignups:76`, `Threshold:125`,
    `Teams:81`, `TeamEntries:82`, `Holidays:181`, `:275`, `:355`, and `AdminLayout:143`;
  - the Teams label: `Teams:337`, which labels a manager *Member*;
  - the entry and event affordances: `EditEntry:88`, `EventEditor:282`, `EventDetail:87`,
    `EventAttendancePanel:138` and `MemberList`;
  - the viewed-team picker: `viewed-team.ts:61`, `:85`;
  - `Sidebar:540`.
- **The per-team decide check needs a read the client does not have.** It needs the caller's active
  memberships and their team roles. `membership` has no client grant, so this is a new RPC: a schema
  change, with its own ADR.
- **The router's role guards meet an existing, documented design.** Each admin screen refuses a
  member in place, *"because the refusal is what says why"* (`src/App.tsx`, the `/admin` route
  comment). Dozens of e2e assertions address those per-screen refusals. A router guard that
  intercepts first replaces all of them, and that design decision belongs to the slice that makes it.
- Done whole, MIR-17-b is about 25 files, which is `L`.

## Decision

1. **MIR-17-b moves the admin screens' guards onto the role helpers, and fixes the Teams label.**
   - `AdminHub`, `NewSignups`, `Threshold`, `Teams`, `TeamEntries`, `Holidays` and `AdminLayout` ask
     `mayAdminister`, or `mayDecide` where the screen is a decider's, instead of comparing `role`
     with a literal.
   - `Teams` labels a person through `ROLE_LABELS`.
   - No screen's behaviour or refusal changes. A source-text test pins that these files hold no
     literal role comparison.
2. **MIR-17-c is the rest of P4-2.** It plans its own count, and splits again if it is `L`. It
   covers:
   - per-team decide, through a new read of the caller's team roles;
   - `MemberList`'s predicates, `EditEntry`, `EventEditor`, `EventDetail` and
     `EventAttendancePanel`;
   - the viewed-team picker;
   - `Sidebar` and `TopBar`;
   - router role guards, with the decision on intercepting versus the screens' in-place refusals.
3. **MIR-20 depends on MIR-17-c.**

## Options considered

- **All of MIR-17-b in one ticket.** Rejected: about 25 files, `L`.
- **Per-team decide first.** It is the substantive change. Rejected as this slice, because it needs
  an RPC and an ADR of its own, and its count is not settled until its PLAN reads `PendingEntries` and
  the mock's decider.
- **Router guards first.** Rejected as this slice: it reopens a documented design, and it moves the
  e2e refusal assertions.

## Consequences

- After MIR-17-b, `mayAdminister` is the one definition of *may administer* for the admin screens.
  MIR-17-c can change what it asks (a team, an org) in one place for them.

## Revert condition

None. This re-orders work and decides no behaviour.
