---
doc_version: 4
last_updated: 2026-10-13
governed_by: [RULE-01, RULE-09]
---

# Charter

What this system is for, and what it refuses to do.

Written from `product_brief.md` (Draft v1, Min). Where this file and the brief disagree, this file is
authoritative and the brief is history.

The product is **CaleChip**, named on 2026-08-31.

## What this is

A planning board on which every member of a team **declares in advance** when they intend to be on
leave (PTO) or working from home (WFH), for as far ahead as they know.

It exists because absence plans currently live in chat threads, in individual heads, or in an HR
request submitted too late to change anything. The cost is not administrative: it is a handover
arranged the night before, a deadline that slips, and the conversation nobody wants to have —
*"I already booked the flight."* Around public holidays it is worse and more predictable, because
everyone independently targets the same bridge day and none of them can see the others doing it.

The system's whole job is to make those plans visible early enough that the team can adjust. It
coordinates; it does not administer.

**Who uses it.** Organisations, each holding one or more teams, on one shared deployment. The
organisation is the tenant boundary: its data, configuration and holidays are isolated from every
other organisation's, and a person belongs to exactly one. Inside it a person may belong to several
teams, and reads the whole calendar of every team they belong to — transparency within a team is a
deliberate design decision, not an oversight in the permission model. A team is still the unit the
product was sized for, five to thirty people. Teams whose organisation has not bought a licence sit
together in a shared tenant, *Org public*, administered by the system admin, with every org-wide
visibility feature turned off.

*Amended 2026-10-13 by [ADR-059](registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md).*
This paragraph read:

> **Who uses it.** One team of five to thirty people. Every member reads the whole team's calendar —
> transparency is a deliberate design decision, not an oversight in the permission model.

It had been stale since ADR-039 made the product many-team on 2026-09-11. The operator decided the
multi-tenant scope on 2026-10-13. **What the amendment does not reach:** billing, licence expiry,
over-cap behaviour, how members are counted against a cap, self-serve org signup, and per-tenant
export or deletion are all undecided. ADR-059 lists them as open questions, and this paragraph says
nothing about any of them.

**What "working" looks like.** Plans are entered three to four weeks ahead rather than days ahead; a
day on which more than half the team is away is noticed while it is being created rather than
afterwards; and a lead can answer *"what does next month look like?"* in under ten seconds.

## What it refuses to do

Each of these is a capability the system will deliberately never grow. A refusal can be removed, but
only by arguing with the reason beside it — and that argument is the point.

1. **It will never track remaining leave quota.** Those numbers belong to the HR system. Two systems
   holding the same balance disagree eventually, and on the day they disagree every other number in
   this app stops being believed.

2. **It will never replace the official leave request.** This is a planning layer that sits *in front
   of* the HR process, not a substitute for it. An approval here is a team-coordination signal, not
   an employment decision.

3. **It will never do timekeeping, payroll, or hours tracking.** A different problem, an order of
   magnitude more complexity, and a class of risk this system is not built to carry.

<!-- Refusals 4 and 5 were removed by ADR-045. Their numbers are not reused: see the note below. -->

6. **A warning will never block an action.** Overload is reported, in detail, at the moment of
   choosing — and the person can always save anyway. The instant this system can refuse someone's
   plan it becomes an approval gate, which is refusal 2 arriving through the back door.

*Amended 2026-09-29 by [ADR-045](registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md).*
This list carried six refusals. Refusals 4 and 5 read:

> 4. **It will never model group activity.** Everyone registers independently. Whether people are
>    travelling together is outside the system.
>
> 5. **It will never be a booking tool.** No reserving slots, no invitations, no negotiating a day with
>    another person inside the app. This is an information board; the negotiating happens between
>    people.

The operator removed both, whole, so that a member may announce an event and others may join it,
across teams. A narrower amendment — keep refusal 5 for entries and open only a separate event
concept — was offered and not chosen. **What the removal does not reach:** an event is not an entry.
It creates no entry, is not in the absence count and is not drawn on the grids, so refusals 1, 2, 3
and 6 stand exactly as written, and a warning still blocks nothing. The cross-team exposure an event
opens, and the fence around it, are ADR-045's to state, not this file's.

**The remaining refusals keep their numbers.** Refusal 6 is cited by that number across the source,
the tests and the shipped tickets, and renumbering it would make every one of those citations point
at the wrong sentence — so 4 and 5 are retired rather than reused, as RULE-05's number is.

**These are refusals, not a backlog.** The brief's P2 list — multiple teams in one workspace,
role-based constraints, per-period thresholds, two-way HR sync, a year-end recap — is *deferred*, not
refused. Nothing above forbids them, and the data model is expected to leave room. *Multiple teams in
one workspace* has since been taken up: ADR-039 made the product many-team, and ADR-059 placed the
teams inside organisations.

## Roles

**Target — five roles at three scopes**, per
[ADR-059](registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md):

| Role | Scope |
|---|---|
| **System admin** | The whole deployment, from a separate panel. Reads an organisation's data only by impersonating, and impersonation is read-only, time-boxed and logged. |
| **Org admin** | One organisation. What the *Admin* row below becomes, bounded by its organisation. |
| **Manager** | One team. Decides that team's entries, **including their own** (recorded as self-approved; ADR-059 lifts ADR-035's ban), sets that team's configuration, and registers entries of their own like any member. |
| **Member** | One organisation, one or more of its teams. Reads the calendars of the teams they belong to, and each entry they make counts against every one of those teams. |
| **Guest** | No account. Reads and registers for a public event through its link, and nothing else (ADR-052). |

The powers inside each scope are ADR-059's and the multi-tenancy plan's: which configuration belongs
to which level, and how an entry owned by a member of several teams is approved. They reach
`.ai/standards/rbac-and-security.md` with the MIR item that builds them. This file names scopes,
not cells.

**Deployed today — three roles, until the role split ships (MIR-16, MIR-17).** Until then the table
below is what the running system enforces, and `.ai/standards/rbac-and-security.md` is still what a
review is checked against. The differences are narrow on purpose.

| Role | What only this role can do |
|---|---|
| **Member** | Create, edit and delete their **own** entries, at any time. Reads the whole team's calendar. |
| **Manager** | Everything a member can do, plus one thing: approve or reject **another** member's entry. Not their own, and nothing else — a manager edits no entry but their own, maintains no calendar, and lets nobody into the team. |
| **Admin** | Everything a manager can do, plus: edit or delete **any** member's entry, approve or reject entries **including their own**, maintain the holiday calendar including government-announced swap days, invite and remove members, promote a member to manager or admin, and set the overload threshold. |

*Amended 2026-09-12 by [ADR-035](registry/decisions/ADR-035-a-third-role-manager-decides-entries-and-nothing-else.md).*
This section read *"Two, and the difference is narrow on purpose"* and carried the two rows above
without the middle one. The operator asked for a manager role holding the approve permission; the
rank was inserted rather than the admin row being split, so that the sentence *everything the rank
below can do, plus* still describes every step. **The manager row is one power wide, and that is the
whole of what was decided** — every other cell of the permission table is denied for this role by
default rather than by decision, which `.ai/standards/rbac-and-security.md` marks in place.

*Amended 2026-08-31.* The admin row previously read *"approve or reject entries, maintain the holiday
calendar, invite people, and set the overload threshold"* and was silent on four powers the product
turns out to need. The operator decided all four that day: an admin may edit another member's entry,
may approve their own, may remove a member, and may promote one. The first is the one that changes
what the product is — an entry is no longer only its author's statement — and its cost is recorded
under *Known weaknesses* in `.ai/standards/rbac-and-security.md`, because until the change feed
arrives (brief P1) an admin's edit is indistinguishable from the member's own.

**Reading is not a privilege here.** Every member sees, in full, the entries of every other member of
the teams they belong to. This is the mechanism the product runs on, not a permission that was left
open — a plan nobody can see coordinates nothing.

*Amended 2026-10-13 by ADR-059.* This read *"Every member sees every other member's entries in
full"*, which was written when there was one team. The principle is unchanged. Only its reach is
named: a member's own teams, and never another organisation.

Rejection is the one admin action that must always carry a reason, because a rejection without one
gives the member nothing to act on.

`.ai/standards/rbac-and-security.md` expands this into the table design section 2 is checked against.

## What this document is not

Not a requirements list, not a roadmap, not a feature registry. Features live in
`.ai/registry/features.md` and are added by a human (RULE-01). A charter that starts listing features
has become a backlog with no ordering.
