---
doc_version: 3
last_updated: 2026-10-20
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-066 — The member directory is the caller's own team plus the people they already share an event with; the invitee check is audited and unchanged

## Status

`ACCEPTED by the operator` on 2026-10-20, in the `/plan MIR-04` session. The first `/plan MIR-04`
stopped `BLOCKED` and put two questions to the operator, with options. The questions and options as
worded are in the BLOCKED version of `.ai/board/tickets/MIR-04/01-plan.md` § 2
(2026-10-20T15:23:22+07:00). The operator answered, verbatim:

> **"Q1. B**
> **Q2. B"**

- **Q1 B**: *"The caller's own team, **plus** anyone the caller already has a reason to see: the
  creator, invitees and attendees of an event the caller may read (`may_read_event`), and the actor
  of a notification addressed to the caller. The picker offers teammates only."*
- **Q2 B**: *"Keep any team, and record the audit only."*

**`tech-lead-design` narrowed one clause of Q1 B when it read the source, before any code was
written.** Under today's policies, only someone who may manage an event reads its invitee list
(`event_invitee_select_manage`, `20260929120000_evt01_event.sql:299-301`). A reader who is merely
invited, or reads a public event, never sees who else is named, and EVT-01 AC-13 asserts that. If the
directory added the invitees of every event the caller *reads*, any reader could learn invitee names
that they cannot learn today. So decision 2(c) below takes invitees **only from events the caller may
manage**. That is what the editor and the detail page need in order to show names. If the operator
meant the wider reading, 2(c) changes `may_manage_event` to `may_read_event` and nothing else changes.

Written by `tech-lead-design` under ADR-008. It records the operator's decision. The supersession it
makes belongs to the operator, not to the agent.

## Context

`public.list_member_directory()` (`20260929120000_evt01_event.sql:154-163`) returns every approved,
not-removed member of every team, with team name, to any caller who has a team. The multi-tenancy
audit flags it as **⚠ CROSS** (`.ai/board/audits/multi-tenancy-audit-2026-10-12.md:394`). Plan item
P0-4 (`.ai/board/plans/calechip-multi-tenancy-plan.md:88-90`) asks to scope it to the caller's own
teams, and to audit the invitee check, which only requires an invitee to have a team.

ADR-045 Decision 3 (`ACCEPTED by the operator`, 2026-09-29) granted that read: *"To choose
invitees, a creator may read the identity of approved members of every team (Q5)"*, and the attendee
list of any readable event (Q8). The directory is also the only way the client turns a member id into
a name. It does that for creators on the event list, attendees on the detail page, and notification
actors. A plain own-team scope would turn every cross-team name the product legitimately shows into
*Former member*.

## Decision

1. **Supersedes the picker clause of ADR-045 Decision 3.** A non-admin creator chooses named invitees
   from the members of **their own team** on the screen. Every other clause of Decision 3 stands:
   members of any team still read a public event (Q4), an event that names them (Q5, Q25), and the
   attendees of any event they may read (Q8).
2. **`public.list_member_directory()` returns, to a caller who has a team, every approved,
   not-removed member M for whom at least one of these holds:**
   - (a) the caller is an admin (unchanged, since admins already read every event and every team,
     per ADR-040 and ADR-045 point 5);
   - (b) M is on the caller's team;
   - (c) M is the creator of an event the caller may read (`may_read_event`), or an invitee of an
     event the caller may manage (`may_manage_event`);
   - (d) M has an attendance row on an event the caller may read that `event_attendance_select_visible`
     would show the caller: attending, or any state when the caller may manage that event;
   - (e) M is the actor of a notification whose recipient is the caller.

   The same five columns are returned and nothing else (ADR-045 point 4). A caller with no team still
   receives an empty list.
3. **The invitee check is unchanged, by decision.** `save_event` (`evt02:192-197`), the policy
   `event_invitee_insert_manage` (`evt01:306-311`) and `invite_to_event`'s member branch (ADR-061,
   `20261014090000_evt12_invite_every_scope.sql`) still admit a member of any team. The audit is
   recorded in `.ai/board/tickets/MIR-04/01-plan.md` § 4.5. The org bound arrives with MIR-13 and
   MIR-15, under ADR-059 decision 6.
4. **No policy on `public.member` changes.** `listMembers()` remains INV-04's denominator, as
   ADR-045 point 4 requires.

## Rationale

**Rejected: own team only (Q1 A).** It was offered and not chosen. It would have hidden names that
the product shows legitimately (ADR-045 Q8).

**Rejected: no change until MIR-15 (Q1 C).** It was offered and not chosen. It would leave the phase
0 exit criterion *"No endpoint returns members outside the caller's scope"* (plan:97) unmet.

**Rejected: narrow the invitee check to the event's team (Q2 A).** It was offered and not chosen.

## Consequences

- **The API accepts an invitee the screen no longer offers.** A non-admin who already holds another
  team's member id, or who knows their email (ADR-061), can still name them. The named person then
  reads the event, and its creator's directory resolves them through 2(c). This gap is known and
  chosen, not an oversight.
- **A cross-team name now appears to a caller only after an event connects the two people.** A
  member can no longer list every team's roster.
- **The directory now depends on `may_read_event` and `may_manage_event`.** If either predicate is
  widened, the directory widens with it. A future change to either must be read against this ADR.
- **The picker for an admin is unchanged.** It still offers every team, which is decision 2(a), and
  that waits for MIR-16/MIR-17.

## Revert condition

**Once is enough:** `list_member_directory()` returns, to a non-admin, a member of another team who
satisfies none of 2(c), 2(d) or 2(e). If that is observed, the function is wrong and MIR-04 reopens
as a `BUG-nnn`, while this ADR stands.

## Affected documents

| File | Change |
|------|--------|
| `.ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md` | A supersession note under § Status. The body is kept |
| `.ai/standards/rbac-and-security.md` | The *read the invitee picker* row. Human-owned, and owed |
