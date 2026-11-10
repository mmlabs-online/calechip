---
doc_version: 1
last_updated: 2026-11-03
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-073 — One decider on any of the owner's teams decides a multi-team entry; a manager may decide their own; a manager may not overturn another person's rejection

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)` — 2026-11-03, at
`/plan MIR-14`.

**This ADR supersedes [ADR-035](ADR-035-a-third-role-manager-decides-entries-and-nothing-else.md)
§ Decision item 3** (*a manager may not decide their own entry*). The operator agreed the reversal in
the multi-tenancy plan (`.ai/board/plans/calechip-multi-tenancy-plan.md:34`: *"A manager **may**
approve their own entry, recorded as `self_approved = true`"*). This ADR records that agreement and the
design choices the plan left open. It does not claim the operator wrote it. ADR-035's other items
stand.

It also narrows one power ADR-035 gave a manager: re-deciding an entry another person rejected
(decision 4).

## Context

Plan item P3-5 (`calechip-multi-tenancy-plan.md:196-204`) and the agreed approval rules
(`:30-35`):

- If a person belongs to several teams and **any one** of them requires approval, the entry requires
  approval.
- **One** manager's decision is enough. First decision wins; other queues clear.
- One rejection rejects the entry. No mixed state.
- A manager **may** approve their own entry, recorded as `self_approved = true`.
- If a team has no manager, approval authority falls to `org_admin`.

What the database does after MIR-13 and MIR-13-b:

- `entry_apply_approval_setting` reads the switches of `member.team_id` only
  (`20260911170000_solo_approval_settings.sql:102-129`). It is `security invoker`, so it cannot read
  a team row the inserting caller cannot select. `team_select_own` admits the primary team only
  (ADR-072 decision 1).
- `entry_update_manager` admits `may_decide(caller) and shares_active_team(owner, caller)`
  (`20261103120000_mir13_write_path_org_bound.sql:818-827`). `may_decide` reads the global
  `member.role`, so a manager on team A is a decider on every team they share with anyone.
- `entry_enforce_decision()` clause (a) refuses a manager their own entry
  (`20260913120000_solo_manager_decision_generated_columns.sql:58-61`). Clause (b) nulls
  `approved_by` on a rejection and records no rejecter (`:107-109`).
- `entry_select_team` admits entries of the caller's primary team only (ADR-072 decision 1). A
  manager of a member's second team cannot select that member's entries, so a PATCH from them is
  filtered to zero rows.
- ADR-070 § 4 fixed three columns for this ticket: `rejected_by uuid null` with
  `entry_rejected_by_org_fk`, `rejected_at timestamptz null`, and
  `self_approved boolean not null default false`.
- No writer creates a second active `membership` row today. The mirror writes one per member
  (ADR-071 decision 2). Multi-team behaviour is therefore reachable only from fixtures until a
  writer exists (ADR-072 decision 5).

## Decision

1. **An entry's teams are derived, not stored.** The teams an entry affects are the owner's active
   teams, `member_team_ids(owner)`, read at the moment of the question. INV-07 already defines an
   entry as counted against every team its member belongs to, and a stored copy would be a second
   record of membership that drifts the day a member joins or leaves a team.
2. **A decider of an entry is either:**
   - an admin who shares an active team with the owner — today's `entry_update_admin`, unchanged; or
   - a member whose active `membership` row on one of the owner's active teams has
     `team_role = 'manager'`.

   The manager half reads the per-team role ADR-070 § 1 created, not the global `member.role`.
   Under the mirror the two agree on the primary team. On a second team only `team_role` can say
   who manages it. One helper, `public.may_decide_entry(p_uid, p_owner)`, states this once. The
   update policy, the new select policy and clause (a) of the trigger all call it.
3. **A manager may decide their own entry** (supersedes ADR-035 item 3). `self_approved` is set
   whenever an approval is made by the entry's owner. That includes an admin, whose self-approval is
   known weakness 4 and has had no record until now. It is cleared whenever the entry leaves
   `approved`.
4. **First decision wins, and any rejection rejects.** The decision belongs to the entry, not to a
   team, so one decision moves the entry out of `pending` and out of every queue at once. A second
   decider writing against a stale view is handled as follows:
   - approving an entry that is already approved changes nothing, and `approved_by` stays the first
     approver;
   - rejecting an approved entry is permitted to any decider — *one rejection rejects*;
   - **approving an entry someone else rejected, or rewriting the reason on someone else's
     rejection, is refused to a manager** (42501). Only the rejecter or an admin may change a
     rejection.

   An admin keeps every transition ADM-05 AC-11 lists, including `rejected → approved`. The admin is
   the fallback and the override, and MIR-16 revisits that rank.
5. **`rejected_by` and `rejected_at` are written by the database**, from `auth.uid()` and `now()`,
   on a transition into `rejected` and on every change to the reason. That way they always name
   whoever stated the reason currently shown. They are nulled whenever the entry leaves `rejected`.
   This covers the batch: `reject_entries` is `security invoker`, so each row records the caller.
6. **The approval switches are OR-ed across the owner's active teams.**
   `entry_apply_approval_setting` becomes `security definer` so it can read a second team's
   switches the inserting caller cannot select. It reads, and writes only `NEW`. An owner with no
   active team stays `pending`, as today.
7. **"Falls back to `org_admin`" means the team's admin until MIR-16.** Until the role split,
   `org_admin` is `is_admin`, and Org public holds every existing team. A fallback to every admin in
   the org would let one team's admin decide entries of unrelated teams in the shared tenant — the
   exposure MIR-15 is about to close elsewhere. The admin half of decision 2 is therefore the
   fallback: it is team-bounded, and it applies whether or not the team has a manager.
8. **A decider can read the entries they may decide.** A new permissive select policy,
   `entry_select_decider`, admits `may_decide_entry(caller, member_id)`. Without it decision 2 is
   unreachable from the wire, because an update filters by the select policies. It does not change
   the absence count: `absenceCountsFor` drops an entry whose member is not on the roster
   (`src/lib/data/absence.ts:135-144`), and the roster stays primary-team (ADR-072).
9. **MIR-14 splits by operation.** MIR-14 is the decision. MIR-14-b is the queue: owner names
   across teams, the teams each entry affects shown on the worklist, and the empty-queue fallback.

## Options considered

- **Store the affected teams on the entry** (a `team_ids uuid[]` column or an `entry_team` table)
  so each queue reads its own rows. Rejected. ADR-070 fixed no such column, and the set is already
  `membership`. A stored copy needs a trigger on every membership change, or it goes stale exactly
  when a member moves.
- **Refuse every re-decision of a non-pending entry**, so the first decision is final for everyone.
  Rejected. It removes ADM-05 AC-4 and AC-11 (`rejected → approved`, the reason edit) from the
  admin. It also contradicts *one rejection rejects* when the first decision was an approval.
- **Optimistic concurrency at the seam** — `approveEntry(entryId, from)` sending
  `status=eq.<from>`. Rejected. It changes the signature of two existing seam functions and their
  callers, which is XL (`.ai/01-operating-model.md` § Sizing). It also guards only the screens that
  pass `from`, while the trigger guards the wire.
- **Fall back to every admin of the org.** Rejected for Phase 3 by decision 7.
- **Keep `may_decide` (global `member.role`) as the manager test.** Rejected. A manager of team A
  who is an ordinary member of team B would decide team B's entries. That is the per-team power
  ADR-070 § 1 created `team_role` to bound.

## Consequences

- `.ai/standards/rbac-and-security.md`: the manager cell of *Approve or reject their own entry*
  becomes ✅. Known weakness 4 extends to managers, and `self_approved` records it. Audit A10's
  rejection half is closed; auto-approval still records no actor.
- `src/lib/roles.ts` `mayDecideEntriesOf` loses its own-entry clause. The mock follows, and keeps a
  private record of who rejected each entry so decision 4 is observable without a database.
- MIR-14-b owns the queue across teams and the "teams affected" display. MIR-16 owns moving the
  admin half of decision 2 to `org_admin`.

## Revert condition

Revert if the operator decides that a multi-team entry needs a decision from every team (consensus)
rather than one, or that a manager may never decide their own entry. Revisit decision 7 at MIR-16,
when `org_admin` exists apart from team membership.
