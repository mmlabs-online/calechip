---
doc_version: 3
last_updated: 2026-11-07
governed_by: [RULE-01, RULE-02, RULE-04, RULE-09]
---

# ADR-082 — The role split (MIR-16) ships in three slices, issue reports go to the system panel first, and in Org public today's admins become its `org_admin`s

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-07 — at `/plan MIR-16` (ADR-008, ADR-067).

This ADR supersedes the half of ADM-07's design that gives every admin the issue reports, and it
settles one reading of ADR-059 decision 2 that no source settles (decision 3 below). It reverses no
other decision.

## Context

- **P4-1** (`.ai/board/plans/calechip-multi-tenancy-plan.md:230-236`) has six items: `system_admin`
  as its own account type, `member.role` becoming `org_admin` | `member` with `manager` moving to
  `membership.role_in_team`, `is_admin` replaced at about 25 call sites, `may_decide` gaining a team,
  four system-scope groups re-pointed, and the demotion trigger resolved.
- **Some of it is already built.** MIR-18 shipped `system_admin` as a separate table behind `aal2`
  (ADR-074). Phase 3 bounded every `is_admin` call site by `member_org_id`, so *today's admin* is
  already an admin of one org in every predicate. MIR-15-b moved Org public's holidays to the system
  panel (ADR-079). MIR-14 made the entry decider read `membership.team_role` (ADR-073).
- **What is left touches most of the schema.** Two items are behind it. Renaming the enum value
  `'admin'` breaks every `plpgsql` and `sql` body that spells it, because those bodies are stored as
  text. And removing `'manager'` from `public.member_role` requires re-creating the type.
  Together with the seam mapping, the bootstrap, the seed and the pgTAP fixtures that insert
  `role = 'admin'`, this is far more than 12 files (`.ai/01-operating-model.md` § Sizing).
- **Of the four system-scope groups** (audit A:486-492), the operator decided on 2026-10-12 that the
  sign-up queue belongs to `org_admin`, not `system_admin` (MIR-16 `ticket.yaml`). Holidays are
  already split: Org public's go to the system panel (ADR-079), and each dedicated org keeps its own.
  The event override is an org power: the event lives in an org, and a system admin has no member
  row and no member app. Only **issue reports** are product feedback about the deployment, which no
  org owns. ADR-074's *Consequences* already says MIR-16 points them at `is_system_admin()`.
- **Every existing member lives in Org public** (MIR-12). ADR-059 decision 2 says Org public is
  *"administered by `system_admin`"*, and decision 3 says `org_admin` is *"what today's `admin`
  becomes"*. For Org public's admins, the two sentences point in different directions.

## Decision

1. **MIR-16 splits by operation into three slices.**
   - **MIR-16 — issue reports go to the system panel.** `issue_report_select_admin`,
     `issue_report_update_admin` and the storage policy `issue_image_select_admin` are dropped. Only
     a system admin at `aal2` reads and triages reports. The panel does it through two `security
     definer` RPCs (ADR-075 decision 1's pattern) and a storage policy for the images.
   - **MIR-16-b — `admin` becomes `org_admin`.** The enum value is renamed, `is_admin(uid)` is
     replaced by `is_org_admin(uid, org_id)`, the demotion trigger is resolved, and the bootstrap,
     seed and fixtures follow. The member seam maps `'org_admin'` back to the application's `"admin"`
     until MIR-17, so no screen changes. It plans its own count, and splits again if it is `L`.
   - **MIR-16-c — `manager` leaves `member.role`.** `may_decide(uid)` and every policy that reads the
     global `manager` value move to `membership.team_role`, `set_member_role` writes a team role, and
     `'manager'` is removed from `public.member_role`.
2. **The event override and the sign-up queue stay org powers.** They are re-pointed to
   `is_org_admin` in MIR-16-b, not to `is_system_admin()`. ADR-074 *Consequences*' list of four
   groups for the system panel is narrowed to one, issue reports.
3. **In Org public, the members who hold `admin` today become its `org_admin`s.** Their reach inside
   Org public stays as MIR-13, MIR-15 and MIR-15-b bounded it. ADR-059 decision 2's *"administered by
   `system_admin`"* is carried by the system panel's doors: Org public's holidays (ADR-079), its org
   row (ADR-075), and now its issue reports. It is not carried by refusing every member an admin
   role. A further narrowing of an Org public `org_admin` to their own teams is a later decision, for
   `/idea`.
4. **Between MIR-16 and MIR-17, the member app's *Issue reports* screen reads nothing.** The database
   refuses every member, and the member mock stays looser than SQL on this one table. MIR-17
   replaces the screen's admin guard (P4-2, *IssueReports*) and brings the mock in line. This is the
   price ADR-076 decision 6 and ADR-079 decision 5 already paid once each.
5. **MIR-17 is blocked by MIR-16, MIR-16-b and MIR-16-c as well.** MIR-20 already depends on
   MIR-17, so it is blocked by both slices through MIR-17 and its `depends_on` is not edited.
   *Until the re-plan of 2026-11-07 this read "MIR-17 and MIR-20 are blocked by MIR-16-b and
   MIR-16-c as well", and MIR-20's `ticket.yaml` carried both IDs. The edit was redundant, and it
   was removed to keep MIR-16 at 12 paths when `060-removed-and-pending.test.sql` joined it.*

## Options considered

- **Plan all of P4-1 as one ticket.** Rejected: it is far more than 12 files.
- **`org_admin` first.** It is the heart of the split. Rejected as the first slice, because it is the
  slice most likely to split again. Issue reports are the one group whose destination is settled and
  whose change is self-contained.
- **Issue reports through policies for the system admin**, read with `from("issue_report")` like the
  member seam. Rejected. A system admin cannot read `public.member` or `public.org`, so the panel
  could not show who wrote a report or which org it came from. A definer RPC can join both, and it
  matches the panel's one pattern (ADR-075 decision 1).
- **Send the sign-up queue and the event override to the system panel as well**, which is ADR-074's
  reading. Rejected. The operator placed the queue with `org_admin`. A system admin has no session
  in the member app to override an event from, and the event belongs to an org.
- **In Org public, today's admins become managers of their teams**, so that only the system admin
  administers Org public. Rejected for now. It removes admitting sign-ups, creating teams and moving
  people from every free team at once, with no replacement door, and no source asks for that.

## Consequences

- `.ai/standards/rbac-and-security.md`'s issue-report rows go stale until a standards edit. That is
  human-only.
- ADM-07 is superseded: *an admin reads every report* stops being true at MIR-16.
- `supabase/tests/160-read-path-org-bound.test.sql` AC-8's two *"still returns a report from T3"*
  assertions become refusals.

## Revert condition

The operator decides issue reports belong to each org, or that Org public has no member `org_admin`.
The first reverses decision 1's first slice. The second supersedes decision 3, and MIR-16-b is
redesigned with it.
