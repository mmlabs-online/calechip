---
doc_version: 3
last_updated: 2026-11-08
governed_by: [RULE-01, RULE-02, RULE-04, RULE-09]
---

# ADR-086 — `set_member_role` writes the team role and audits it itself; `'manager'` is later removed by re-typing the column, and the audit history keeps its words as text

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-08 — at `/plan MIR-16-f` (ADR-008, ADR-067).

This ADR narrows MIR-16-f as ADR-085 decision 2 described it, and adds one slice, MIR-16-g. It also
settles the two questions ADR-085 left to this PLAN: the audit noise of moving the manager rows,
and what history rows holding `'manager'` become. It reverses no accepted decision.

## Context

Counted on 2026-11-08 at `origin/main` `d7ca219` (MIR-16-c shipped).

- **After MIR-16-c, nothing reads `member.role = 'manager'`.** `set_member_role` still writes it,
  together with the primary row's `team_role`
  (`20261107235000_mir16e_rename_admin_to_org_admin.sql:89-135`).
- **Moving the manager rows with an `update` is blocked twice.**
  - `member_enforce_role_and_removal` refuses any role change on a removed member, with no
    carve-out for a session with no user token
    (`20261107235000_mir16e_rename_admin_to_org_admin.sql:214-216`), and removed managers exist.
  - `member_record_role_change` would write one audit row per manager for a change no person made.
- **`alter table … alter column … type … using (…)` rewrites the column without firing a row
  trigger.** It converts the rows and leaves the audit trail alone.
- **`member_role_change.from_role` and `to_role` are typed `public.member_role`**
  (`20261020150000_mir03_bounded_role_changes.sql:39-40`). Once the type loses `'manager'`, history
  rows that recorded a promotion to manager cannot keep that word in an enum column.
- **The removal is `L` on its own.** It has to re-create the type, convert two tables, change
  `set_member_role`'s parameter type (it is in `010`'s census), and move the harness, `seed.sql` and
  about ten pgTAP files that insert or assert `'manager'`. With the write side as well it is about 19
  files.
- **The rank RPC's returned row is read through a `stable` computed field.** A `stable` function sees
  the snapshot taken when the calling statement began, so `roster_team_role` on the row
  `set_member_role` returns may not show the `team_role` that same call just wrote.
  `TODO(verify)` against a local project. The seam answer in decision 3 is correct either way.

## Decision

1. **MIR-16-f is the write side.** `set_member_role(uuid, public.member_role)` keeps its signature
   and its refusals.
   - It writes the primary row's `team_role` and no longer updates `member.role`.
   - When the team role actually changes, it inserts the `member_role_change` row itself:
     `from_role` is the old team role as `'manager'` or `'member'`, `to_role` is `p_role`, and
     `changed_by` is `auth.uid()`.
   - A call that changes nothing writes nothing, as the audit trigger's `when` clause did.

   From then on no function writes `'manager'` to `member.role`. Rows that already hold it are read
   by nothing.
2. **MIR-16-g removes the value**, in four steps:
   - `member.role` is converted by a column re-type, `'manager'` becoming `'member'`, which fires no
     row trigger;
   - `member_role_change.from_role` and `to_role` become `text`, with a check that admits
     `'member'`, `'manager'` and `'org_admin'`, so the history keeps the words it recorded;
   - `public.member_role` is re-created as `('member', 'org_admin')`;
   - `set_member_role`'s parameter, the audit trigger, the harness, the seed and the fixtures follow.

   It plans its own count, and splits again if it is `L`.
3. **The seam's `setMemberRole` returns the role it asked for.** On success it overrides the mapped
   row's `role` with the requested one, rather than trusting a `stable` read in the same statement.
4. **MIR-17 depends on MIR-16-g.**

## Options considered

- **Move the manager rows with an `update`, and disable the two triggers in the migration.** That is
  a smaller diff in MIR-16-g. Rejected: a re-type does the same with no trigger state to restore, and
  it is the step that has to happen anyway to change the type.
- **History rows: map `'manager'` to `'member'` in the enum.** Rejected: a promotion to manager would
  read as `member → member`, which is a false record.
- **History rows: delete the ones that name `'manager'`.** Rejected: an audit trail that loses rows
  when a schema changes is not an audit trail.
- **Audit team-role changes in a new table.** Rejected for now: no reader exists, and
  `member_role_change` already holds rank history in the words a person understood at the time.
- **One ticket for write and removal.** Rejected: about 19 files, `L`.
- **Make `member_roster_team_role` `volatile`** so the returned row reads fresh. Rejected: it would
  give up planner optimisations on every roster read to fix one response that the seam already knows
  the answer to.

## Consequences

- Between MIR-16-f and MIR-16-g, a person made manager after MIR-16-f has `member.role = 'member'`,
  and one made manager before it still has `'manager'`. Both are read as managers through
  `team_role`.
- `promote_member_to_admin` still updates `member.role` and is audited by the trigger, unchanged.

## Revert condition

A reader of `member.role = 'manager'` is found, or the column re-type is refused by a dependent
object the local catalogue does not show. Then MIR-16-g re-plans the conversion.
