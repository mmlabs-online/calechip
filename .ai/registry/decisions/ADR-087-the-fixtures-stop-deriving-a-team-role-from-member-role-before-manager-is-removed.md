---
doc_version: 3
last_updated: 2026-11-08
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-087 — The pgTAP fixtures stop deriving a team role from `member.role`, and stop spelling `'manager'` as a member role, before the value is removed

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-08 — at `/plan MIR-16-g` (ADR-008, ADR-067).

This ADR narrows MIR-16-g as ADR-086 decision 2 described it, and adds one slice, MIR-16-h. It uses
ADR-084's shape: move the tests onto helpers first, then change the value. It reverses no accepted
decision. ADR-086 decision 2's steps for the removal are unchanged and move to MIR-16-h whole.

## Context

Counted on 2026-11-08 at `origin/main` `37ec842` (MIR-16-f shipped).

- **Every fixture already names a member role through `tests.member_role`**, except for a handful of
  literal `'manager'` values (`040:15`, `:44`; `250:124`, `:219`, which are explicit
  `::public.member_role` casts; `270-member-team-id-dropped:134`; `300:35`; `320:88`).
- **`tests.put_on_team` derives the team role from `member.role`**
  (`supabase/tests/_isolation.psql:77-88`). After the removal no member row says `'manager'`, so every
  seeded manager would land on their team as a `member`, and the decider tests (170, 180, 310, 320)
  would lose their managers.
- **Done whole, the removal is about 13 files**, which is `L`. That is the migration, its test,
  `010`, the harness, the seed, 040, 100, 250, 270-member, 290, 300, 310 and 320.
- **Once the fixtures say what team role they mean, and stop spelling the value**, the removal
  touches only the migration, its test, `010`, the helper's `'manager'` branch, `290`, `300`'s label
  assertion and `seed.sql`.

## Decision

1. **MIR-16-g moves the fixtures, and changes no migration.**
   - `tests.team_role_for(p_role text) returns public.team_role` is added: `'manager'` →
     `'manager'`, anything else → `'member'`.
   - `tests.put_on_team` gains `p_team_role public.team_role default 'member'` and stops reading
     `member.role`.
   - `tests.seed()` and `100`'s `tests.parity_subject` pass `tests.team_role_for(<application role>)`.
   - `310`'s removed manager passes `'manager'`.
   - The literal `'manager'` member-role values listed in *Context* are replaced. A value written to
     `member.role` becomes `tests.member_role(…)`. An assertion of a seeded manager's member role
     becomes `tests.member_role('manager')::text`. An argument to `set_member_role` becomes a plain
     `'manager'` literal, with no cast.
2. **MIR-16-h removes the value**, as ADR-086 decision 2 describes. It also covers:
   - `set_member_role`'s parameter becomes `text`, so a `'manager'` argument is still accepted, and
     an `'org_admin'` argument is still refused with `42501` rather than `22P02`;
   - `tests.member_role('manager')` returns `'member'`;
   - `290`'s *manager maps to manager* assertion and `300`'s label assertion follow.
3. **MIR-17 depends on MIR-16-h.**

## Options considered

- **The removal in one ticket.** Rejected: about 13 files, `L`.
- **`put_on_team` keeps deriving from `member.role`, and MIR-16-h re-points it.** Rejected. That puts
  the harness and 100 back into MIR-16-h, which is the size problem.
- **`set_member_role` takes `public.team_role` in MIR-16-h.** Rejected. The member seam sends
  `'org_admin'` for the application's `"admin"` (MIR-16-e AC-10). Against `team_role` that would fail
  as `22P02`, not the `42501` refusal the seam maps.

## Consequences

- Between MIR-16-g and MIR-16-h, `tests.member_role('manager')` still returns `'manager'`, and the
  seed's managers still hold it on `member.role`. Their team role now comes from the fixture's own
  words, not from that column.

## Revert condition

None. This re-orders work and decides no product behaviour. If MIR-16-h counts `L`, its PLAN splits
it.
