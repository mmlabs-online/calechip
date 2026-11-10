---
doc_version: 3
last_updated: 2026-11-08
governed_by: [RULE-01, RULE-02, RULE-04, RULE-09]
---

# ADR-085 — The manager rank is read from `membership.team_role` first, and `'manager'` leaves `public.member_role` in a second slice

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-08 — at `/plan MIR-16-c` (ADR-008, ADR-067).

This ADR narrows MIR-16-c as ADR-082 decision 1 described it, and adds one slice, MIR-16-f. It
reverses no accepted decision.

## Context

Counted on 2026-11-08 at `origin/main` `133deb1` (MIR-16-e shipped).

- **Nothing that decides a permission reads the global `'manager'` any more.** The entry decider is
  `may_decide_entry`, which reads `membership.team_role` (ADR-073 decision 2). `entry_update_manager`
  calls it (`20261107230000_mir16b_is_org_admin.sql:693-698`). `may_decide(uuid)` is now called only
  by tests: `010` (census), `100` (parity, `:210`) and `300` (AC-7).
- **Two things still read `member.role = 'manager'`:**
  - `membership_make_primary` derives the team role of a new primary row from it
    (`20261105210000_mir21b_writers_write_membership.sql:46-49`);
  - the member seam, which takes the application's `"manager"` from `member.role`
    (`src/lib/data/supabase.ts:1000`).
- **One thing still writes it.** `set_member_role` writes `member.role` and the primary row's
  `team_role` together. `member_record_role_change` audits only `member.role`
  (`20261020150000_mir03_bounded_role_changes.sql:59-75`).
- **Removing the value is the expensive half.** It has to:
  - move every manager row to `'member'`, which writes one audit row per manager unless the audit
    trigger is handled;
  - decide what `member_role_change` history rows holding `'manager'` become, since its
    `from_role` and `to_role` are typed on the enum;
  - re-create the type, and every function whose signature names it;
  - move `tests.seed()`, `seed.sql` and about eight pgTAP files that insert or assert `'manager'`.

  With the read side as well, that is about 18 files, which is `L`.

## Decision

1. **MIR-16-c is the read side.** The manager rank is read from `membership.team_role`, and nothing
   reads `member.role = 'manager'` afterwards. It ships three changes:
   - `public.member_roster_team_role(uuid)`, and the computed field
     `public.roster_team_role(public.member)` beside `roster_team_id`. Each returns the `team_role`
     of the `membership` row that `member_roster_team_id` reads;
   - `membership_make_primary` carries the person's current primary `team_role` onto the new primary
     row, and uses `'member'` when there is none. For every row the writers keep consistent, this
     answers what the global role answered;
   - the member seam takes the application's `"manager"` from `roster_team_role`.

   It also drops `may_decide(uuid)`. `member.role` keeps holding `'manager'`, and `set_member_role`
   keeps writing both columns.
2. **MIR-16-f is the write side and the removal.** It covers:
   - `set_member_role` writes `team_role` only;
   - manager rows move to `'member'`, with the audit question decided at its PLAN;
   - the history rows' meaning;
   - the type re-created without `'manager'`;
   - the seed, the harness and the fixtures.

   It plans its own count, and splits again if it is `L`.
3. **MIR-17 depends on MIR-16-f.** It already depends on MIR-16-c.

## Options considered

- **Plan the whole of ADR-082's MIR-16-c as one ticket.** Rejected: about 18 files, `L`.
- **Removal first, reads after.** Rejected. The seam and `membership_make_primary` would read a value
  that no longer exists. Reads first is the order MIR-21 used (ADR-077).
- **Keep `may_decide(uuid)`, re-pointed at `team_role`.** Rejected. Nothing calls it, and a
  global "is a manager somewhere" predicate is the per-team confusion ADR-073 removed from the
  decider.
- **Derive the application's `"manager"` from any active `manager` row, not the roster row.**
  Rejected for now. `Member.role` is one value per person until MIR-17 makes it per team, and the
  roster row is the one every other seam read already uses (ADR-077).

## Consequences

- Between MIR-16-c and MIR-16-f, `member.role = 'manager'` is written and read by nothing that
  decides anything. The audit trigger still records rank changes through it.
- MIR-16-f's PLAN owns the `member_role_change` history decision.

## Revert condition

A reader of `member.role = 'manager'` is found that `team_role` cannot answer, for example a hosted
object outside the local catalogue. That reader is moved in its own slice before MIR-16-f.
