---
doc_version: 3
last_updated: 2026-11-08
governed_by: [RULE-01, RULE-02, RULE-04]
---

# ADR-088 — Issue reports leave the member app first, and the rest of P4-2 is MIR-17-b

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-08 — at `/plan MIR-17` (ADR-008, ADR-067).

This ADR splits MIR-17 and records two reading decisions for the slices that follow. It reverses no
accepted decision. It carries out ADR-082 decision 4: *"MIR-17 replaces the screen's admin guard
(P4-2, IssueReports) and brings the mock in line."*

## Context

Counted on 2026-11-08 at `origin/main` `0b1cf64` (MIR-16-h shipped; P4-1 is complete).

- **P4-2** (`.ai/board/plans/calechip-multi-tenancy-plan.md:238-244`) names six items:
  - role helpers that take a team or org;
  - seven `me.role !== "admin"` guards;
  - `MemberList`'s three predicates;
  - `mayEditEvent`;
  - the Teams label;
  - router role guards.

  A grep for role tests in `src/` finds 97 sites in 26 files. Done whole, that is far more than
  12 files.
- **Since MIR-16, the member app's *Reports* screen reads nothing.** The database refuses every
  member, the tab badge reads `0`, and the screen draws an empty list for an admin (ADR-082
  decision 4). The mock still lets an admin read and mark reports, so the e2e suite asserts a
  behaviour the product no longer has. The report bubble tells a member *"An admin will see this on
  the reports page"* (`src/components/ReportIssueButton.tsx:191`), which is now false.
- **The application's role word is `"admin"`**, and the member seam maps `org_admin` to it
  (MIR-16-e). Renaming `MemberRole` changes a shared type module that every screen and the mock
  read. That is `XL` (`.ai/01-operating-model.md` § Sizing), and nobody would see it.
- **A person belongs to exactly one org** (ADR-059 decision 1), and every org-scoped read is bounded
  by the database. On the client, *"takes an org"* has one possible value, the caller's own.

## Decision

1. **MIR-17 takes issue reports out of the member app.**
   - The *Reports* tab and its badge go.
   - `/reports` says reports are now read by the CaleChip team.
   - The report bubble's confirmation stops promising an admin.
   - The mock's issue-report reads answer every member as the database does: an empty list, a zero
     count, a refused status change and null image URLs.

   Writing a report is unchanged.
2. **MIR-17-b is the rest of P4-2.** It plans its own count, and splits again if it is `L`. It covers:
   - per-team role checks, through a new member-seam read of the caller's team roles;
   - the remaining guards;
   - `MemberList`'s predicates;
   - `mayEditEvent`;
   - the Teams label;
   - router guards;
   - the viewed-team picker.
3. **`MemberRole` keeps `"admin"`.** *Org admin* is the database's word. The application's stays,
   because the seam is where the two vocabularies meet (MIR-16-e).
4. **The client's "org parameter" is the caller's own org.** A role helper that *takes an org*
   answers about the caller's org only. It needs no org id on the client.
5. **The four member-seam issue-report functions stay on `DataSeam`**, unused by any screen after
   MIR-17. Removing a seam function changes the seam's contract, and that belongs to a ticket that
   does nothing else. It is not created here.
6. **MIR-20 depends on MIR-17-b.**

## Options considered

- **All of P4-2 in one ticket.** Rejected: far more than 12 files.
- **Split P4-2 into four named slices now**, as ADR-080 did for MIR-21. Rejected: each new ticket
  costs a path here, and the counts that would fix their boundaries belong to MIR-17-b's PLAN, which
  reads the screens it changes.
- **Keep the *Reports* screen for org admins, reading their own org's reports.** Rejected: ADR-082
  decision 1 put reports at system scope, and no source reverses it.
- **Delete `IssueReports.tsx` and the `/reports` route.** Rejected for now. A person with the
  address bookmarked would reach the not-found path with no explanation, and the notice costs one
  component.
- **Rename `MemberRole`'s `"admin"` to `"org_admin"`.** Rejected: it is `XL`, and nobody sees it.

## Consequences

- `listIssueReports`, `setIssueReportStatus`, `countOpenIssueReports` and `issueImageUrls` on
  `DataSeam` have no caller in `src/` after MIR-17. That is recorded as cruft for a later tidy.
- The *Reports* row in `.ai/standards/rbac-and-security.md` stays stale until a standards edit,
  which is human-only.

## Revert condition

The operator decides an org admin reads their org's issue reports. That reverses ADR-082 decision 1
as well, and the screen returns with an org-bounded read.
