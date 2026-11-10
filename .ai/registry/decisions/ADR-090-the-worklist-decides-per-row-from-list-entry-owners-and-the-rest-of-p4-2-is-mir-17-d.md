---
doc_version: 3
last_updated: 2026-11-09
governed_by: [RULE-01, RULE-02, RULE-04]
---

# ADR-090 — The approval worklist decides per row from `list_entry_owners`, with no new RPC, and the rest of P4-2 is MIR-17-d

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-09 — at `/plan MIR-17-c` (ADR-008, ADR-067).

This ADR splits MIR-17-c as ADR-089 decision 2 described it. It also replaces that ticket's
predicted RPC with a read the seam already has. It reverses no accepted decision.

## Context

Counted on 2026-11-09 at `origin/main` `7271613` (MIR-17-b shipped).

- **`public.list_entry_owners(uuid[])` returns exactly the owners the caller may decide.** Its only
  filter is `may_decide_entry(auth.uid(), m.id)`
  (`20261104090000_mir14b_entry_owners.sql:28-37`), which is the per-team decider rule (ADR-073
  decision 2). `PendingEntries` already calls it for every owner on the page: `unresolvedOwners`
  against an empty map asks for all of them (`src/routes/PendingEntries.tsx:200-202`, `:284-287`,
  `:342`).
- **The screen still decides from the global rank.** It refuses unless `mayDecide(me.role)`
  (`:262`), and it draws a row's controls from `mayDecideEntriesOf(me, ownerId)` (`:688`), which
  ignores the owner. So a person who manages a second team but holds `member` on their roster team is
  refused the worklist, while the database would let them decide.
- **The not-decidable branch's sentence** (*"Your own entry — an admin decides it."*, `:692`) has
  been wrong since ADR-073 decision 3, which lets a manager decide their own entry.
- **The rest of MIR-17-c is about 18 files:** `MemberList`, `EditEntry`, `EventEditor`,
  `EventDetail`, `EventAttendancePanel`, the picker, `Sidebar`, `TopBar` and router guards. That is
  `L`.

## Decision

1. **MIR-17-c makes the worklist per-team.**
   - A row's decide controls are drawn exactly when its owner is among the owners `listEntryOwners`
     returned for the page.
   - The screen refuses only a caller with no member row, or one who holds no deciding rank *and*
     may decide none of the page's owners.
   - The not-decidable sentence says what is true.

   There is no new RPC and no schema change.
2. **MIR-17-d is the rest of P4-2.** It plans its own count, and splits again if it is `L`. It
   includes the entry points that still ask the global rank: `TopBar`'s and `AdminLayout`'s pending
   link, and `AdminTabs`' manager tab.
3. **MIR-20 depends on MIR-17-d.**

## Options considered

- **A new `list_my_team_roles()` RPC**, as MIR-17-c's ticket predicted. Rejected: the worklist's
  question is about each entry's owner, and the database already answers it per owner. A team-role
  list would make the client re-derive `may_decide_entry`, a second definition of the rule.
- **Filter the worklist to decidable rows only.** Rejected: `listPendingEntries` pages and counts
  server-side, so a client filter would make the page sizes and the total wrong.
- **Leave the screen guard on the global rank.** Rejected: that keeps the second-team manager out,
  which is the defect P4-2 names.

## Consequences

- A second-team manager reaches the worklist by its address. The links that lead there still ask
  the global rank until MIR-17-d.
- The mock models one team per person, so it cannot show the second-team case. The source-text test
  pins the screen's rule. The database half is `may_decide_entry`'s own pgTAP (MIR-14).

## Revert condition

`list_entry_owners` gains a filter other than `may_decide_entry`. Then decision 1's per-row rule
reads the wrong set, and a dedicated read is needed.
