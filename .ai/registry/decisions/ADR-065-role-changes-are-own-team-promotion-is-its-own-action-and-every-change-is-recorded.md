---
doc_version: 3
last_updated: 2026-10-20
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-065 — Role changes are own-team, promotion to admin is its own action, and every role change is recorded

## Status

`ACCEPTED by the operator` — 2026-10-20, in the `/plan MIR-03` session. The first `/plan MIR-03`
stopped `BLOCKED` and put two questions to the operator with options. The options as worded are in
the BLOCKED version of `.ai/board/tickets/MIR-03/01-plan.md` § 2 (2026-10-20T14:50:40+07:00), and
the chat that carried them is summarised here. The operator answered, verbatim:

> **"Q1. A**
> **Q2. A"**

- **Q1 A** — *"Own team only — `set_member_role` adds `m.team_id = public.member_team_id(auth.uid())`.
  Supersedes ADR-044 Decision 1, so it needs a new ADR the operator accepts."*
- **Q2 A** — *"A separate definer function, admin-only, target on the caller's own team, with the
  confirmation dialog the client already draws."*

**Correction to the premise of Q2 A, made by `tech-lead-design` when it read the source, before any
code was written.** The client draws **no** confirmation dialog for promotion. TEA-04 decided against
one (`src/routes/MemberList.tsx`, the comment above `onPromote`), and the only confirmation on that
screen is for removal. The option the operator chose was described as one that had a confirmation.
Decision 3 below therefore **adds** one, so that the operator gets the option they chose. If the
operator meant "no confirmation", decision 3's second sentence comes out and nothing else changes.

Written by `tech-lead-design` under ADR-008. It records the operator's decision. The supersession it
makes is the operator's, not the agent's.

## Context

`public.set_member_role` (`supabase/migrations/20260924100000_solo_cross_team_role.sql:92-120`) is
gated by `public.is_admin` and nothing else. It admits any approved, non-removed, non-admin member on
any team, it accepts `p_role = 'admin'`, and it records nobody. The audit flags it as a cross-team
write that can promote to admin (`.ai/board/audits/multi-tenancy-audit-2026-10-12.md` § 4 and
§ TEA-08), and `.ai/standards/rbac-and-security.md` lists it as known weakness A3. The schema holds
two actor fields, `entry.approved_by` and `notification.actor_id`, and there is no log table.

Plan item P0-3 (`.ai/board/plans/calechip-multi-tenancy-plan.md:83-86`) asks for three things: a
team or org condition, promotion to admin refused on this path and made a separately gated action,
and an actor on every role change.

ADR-044 Decision 1 (`ACCEPTED by the operator`, 2026-09-24) gave every admin rank changes on every
team, and that is why the function has no team condition. A team condition reverses that decision.
An org condition does not, but there is no `org` until MIR-12, so today it would bound nothing.

## Decision

1. **Supersedes ADR-044 Decision 1.** An admin sets the rank of a member **of the admin's own team**
   only (`member` ⇄ `manager`). `public.set_member_role` adds
   `m.team_id = public.member_team_id(auth.uid())` to its `where`. The refusal stays the single
   `42501` it already answers for every other non-match. ADR-044 Decisions 2, 3 and 4 stand:
   demotion is still undecided, removal is still own-team, and the write is still a definer function
   with no table policy widened.
2. **`set_member_role` refuses `p_role = 'admin'`**, with a `42501`, before it looks at any row.
   Promotion to admin no longer goes through this function.
3. **Promotion to admin is its own definer function,
   `public.promote_member_to_admin(p_member_id uuid)`.** It is admin-only, and the target must be an
   approved, non-removed member or manager **of the caller's own team**. In the client it gets its
   own confirmation dialog, because the action cannot be undone from any screen: *Demote an admin* is
   still not decided.
4. **Every change to `public.member.role`, by any path, writes one row to a new append-only table,
   `public.member_role_change`.** The row holds the member, the role before, the role after, the
   actor and the time. An `after update of role` trigger writes it, so no function has to remember
   to. The actor is `auth.uid()`, and it is null when the change comes from outside an
   authenticated request (a migration, the SQL editor, the service role). The table has row-level
   security on, has **no** policy, and `anon` and `authenticated` hold no privilege on it. Nobody
   reads or writes it through the API. Reading it in the product is MIR-20's.

## Rationale

**Rejected: the org condition (Q1 B).** ADR-059 Decision 6 already says ADR-044's "every team" means
"every team of the caller's org" once org isolation ships. Choosing that reading reverses nothing,
but with no `org` it bounds nothing, and phase 0's exit criterion *"Role changes are bounded and
logged"* (plan:96) would be met in name only. Bounding to the team closes the exposure today. That
includes exposure between unrelated teams, which MIR-12 will put together in *Org public*. MIR-13
widens the bound again to the org, for `org_admin`, when that role exists.

**Rejected: no in-product promotion (Q2 B), and a two-admin rule (Q2 C).** B removes a shipped TEA-04
control until MIR-18 exists. C adds a pending-promotion workflow, which is larger than phase 0's
48-hour goal (plan:62).

**A trigger rather than an insert in each function.** It records every path, including ones that
are not written yet. A function cannot leave it out by mistake, and the SQL editor is recorded too,
with a null actor.

## Consequences

- **ADR-044's defect comes back, solved the other way.** The `/members` screen lists every team
  (`list_all_members`), so the screen must stop drawing *Make manager*, *Remove manager* and
  *Promote* on another team's row. That check in the screen is an affordance (ADR-005). The function
  is the control.
- **`move_member` is still any-team (ADR-039).** An admin can therefore move somebody onto their own
  team and then change that person's rank. This is not a bypass: it is two actions, both recorded
  (the move as it is today, the rank in `member_role_change`). It closes when MIR-13 bounds
  `move_member`.
- **An admin on a team with no other admin is still the only person who can promote there.** That
  is unchanged.
- **The function and the trigger are not verified against a running PostgreSQL** until MIR-05.
  Verification is manual, recorded in `verification.md` in the MIR-03 ticket folder (written at IN_PROGRESS).

## Revert condition

The operator decides that an admin manages ranks on every team again. Decision 1's conjunct then
comes out through a new ADR. Decisions 2 to 4 do not depend on it.

## Affected documents

| Document | Change | Who |
|---|---|---|
| `ADR-044-an-admin-sets-a-rank-on-any-team.md` | A supersession note under § Status naming this ADR and Decision 1. Body unchanged | MIR-03 |
| `.ai/standards/rbac-and-security.md` | *Promote a member to manager*, *Demote a manager to member* and *Promote a member or a manager to admin* gain "own team". Known weakness A3 closes | human — standards are human-only |
| `.ai/standards/data-model.md` | New table `member_role_change` | human — standards are human-only |
| `supabase/db.sql` | Not updated. MIR-08 regenerates or retires it | — |
