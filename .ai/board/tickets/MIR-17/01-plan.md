---
ticket: MIR-17
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-08T07:12:01Z
inputs_read:
  - .ai/board/tickets/MIR-17/ticket.yaml
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-082-the-role-split-goes-in-three-slices-and-issue-reports-go-to-the-system-panel-first.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - src/lib/roles.ts
  - src/App.tsx
  - src/routes/IssueReports.tsx
  - src/components/AdminTabs.tsx
  - src/components/AdminLayout.tsx
  - src/components/ReportIssueButton.tsx
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - tests/issue-reports.test.ts
  - tests/e2e/solo-report-issue.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-17 — issue reports leave the member app

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:306`):

| ID | Feature | Group |
|---|---|---|
| MIR-17 | Client role checks take a team or org, every admin-only guard is replaced, and the router gains role guards | MIR |

**P4-2** (`.ai/board/plans/calechip-multi-tenancy-plan.md:240`) says to *"replace every
`me.role !== "admin"` guard — … `IssueReports` …"*. **ADR-082 decision 4** says: *"Between MIR-16 and
MIR-17, the member app's Issue reports screen reads nothing … MIR-17 replaces the screen's admin guard
(P4-2, IssueReports) and brings the mock in line."* **ADR-088 decision 1** (written at this PLAN)
narrows MIR-17 to that guard. The rest of P4-2 is MIR-17-b.

**Who gains what.** Since MIR-16 an org admin opens *Reports* and sees an empty list, the tab badge
says nothing is waiting, and the report bubble promises the sender that an admin will read their
report. All three are now untrue, because reports go to the CaleChip team through the system panel
(ADR-082). After this ticket, an org admin no longer has a tab that leads to an empty screen. Anybody
who still opens `/reports` is told where reports go. A member sending a report is told who will read
it. The mock, which the e2e suite drives, stops showing admins reports the database will not give
them.

`size_estimate: M`. The work is three components, one route screen, the mock and four test files,
plus the split's board overhead.

**Out of scope — and where each goes:**

- **Everything else in P4-2** goes to **MIR-17-b** (ADR-088 decision 2). That covers:
  - role helpers taking a team;
  - the guards of AdminHub, NewSignups, Threshold, Teams, TeamEntries and Holidays;
  - `MemberList`'s predicates;
  - `mayEditEvent`;
  - the Teams label;
  - router guards;
  - the viewed-team picker.
- **Removing the four member-seam issue-report functions from `DataSeam`** is a later tidy, with its
  own ticket (ADR-088 decision 5). Their supabase implementations are unchanged.
- **Writing a report** (`createIssueReport`, the bubble's form, attachments) is unchanged except for
  the one sentence of AC-5.
- **The system panel's reports section** is MIR-16's, unchanged.
- **Renaming `MemberRole`'s `"admin"`** is not done (ADR-088 decision 3).
- **`.ai/standards/rbac-and-security.md`'s reports row** needs a standards edit, which is human-only.

## 2. Acceptance criteria

Throughout: **Quan** is an admin (`FIXTURE_ADMIN`) and **Thanh** a member (`FIXTURE_MEMBER`). AC-1 to
AC-5 are observed in the member app, against the mock build. AC-6 is observed against the mock seam.

**AC-1 — an admin's strip has no Reports tab**
- Given Quan is signed in
- When he opens any admin screen
- Then the tab strip has no *Reports* tab and no reports badge. The other tabs keep their order

**AC-2 — the admin hub has no Reports card**
- Given Quan is signed in
- When he opens `/admin`
- Then no link to `/reports` is shown

**AC-3 — `/reports` says where reports go, to anybody**
- Given Quan, and then Thanh, signed in
- When each opens `/reports`
- Then the screen shows `Reports are read by the CaleChip team, not by your organisation's admins.`
  It shows no list, no *Mark done* control and no image

**AC-4 — `/reports` issues no issue-report read**
- When `/reports` renders
- Then it calls none of `listIssueReports`, `setIssueReportStatus` or `issueImageUrls`, and the admin
  layout calls no `countOpenIssueReports`

**AC-5 — the sender is told who reads it**
- Given Thanh sends a report from the bubble
- When the confirmation shows
- Then it reads `Thanks — the CaleChip team will see this.`, and nothing on it mentions an admin or
  the reports page

**AC-6 — the mock answers issue-report reads as the database does**
- Given a stored report
- When `listIssueReports`, `countOpenIssueReports`, `issueImageUrls([path])` and
  `setIssueReportStatus(id, "done")` are called as Quan, as Thanh and with no session
- Then they return `[]`, `0`, `[null]` and `{ ok: false }` with `not_permitted` respectively, in
  every case, and the report's status is unchanged

**AC-7 — sending a report still works**
- Given Thanh is signed in
- When he sends a report with a message, with or without images
- Then the seam returns `{ ok: true }` and the report is stored, attributed to him, as before.
  `createIssueReport`'s refusals (a blank or over-long message, image count, type and size) are
  unchanged

**Invariants touched.** `[]`. An issue report is not an entry, and no invariant reads it.

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

- **`/reports`**: the admin area's card for refusals and empty states, holding one centred
  paragraph, `text-sm`, with the sentence of AC-3. There is no heading beyond the page's own, and no
  mascot, because nothing went wrong.
- **The bubble's confirmation**: the existing *sent* state, with the one sentence replaced (AC-5).
- **The tab strip and the hub**: the existing components with one entry fewer. Nothing is rearranged.

## 3. Permission model

No permission changes. The control is the database: since MIR-16 no member select or update policy
admits any member, and the storage read is a system admin's (ADR-082). Everything here removes an
affordance that pointed at a refusal.

| Action | Org admin | Manager | Member |
|---|---|---|---|
| See the *Reports* tab or badge | ❌ **new** | ❌ (unchanged) | ❌ (unchanged) |
| Open `/reports` | ✅ notice only | ✅ notice only | ✅ notice only **new** (was: refused screen) |
| Read, mark or see the images of a report (mock) | ❌ **new** | ❌ | ❌ |
| Send a report | ✅ | ✅ | ✅ |

## 4. Contract

### 4.1 `src/components/AdminTabs.tsx`

- The *Reports* entry (`:136-161`) is removed from `ADMIN_TABS`.
- `AdminBadge` (`:44`) becomes `"openSignups"`. The comments that count two badging tabs say one.
- The comment at `:146-149` naming the two specs that pin the order stays, as the reason those specs
  change here.

### 4.2 `src/components/AdminLayout.tsx`

- The badge record (`:120-123` and `:135`) loses `openReports`.
- The `countOpenIssueReports()` read (`:148-150`) is removed.
- `refreshBadges` reads `countPendingMembers()` only.
- The header comment (`:29-48`) says the reports badge went with ADR-082 and ADR-088.

### 4.3 `src/routes/IssueReports.tsx`

The default export renders only the notice:

```tsx
export default function IssueReports() {
  return (
    <p data-testid="issue-reports-moved" className="…">
      Reports are read by the CaleChip team, not by your organisation&rsquo;s admins.
    </p>
  );
}
```

It imports no seam and no `useAdminContext`. The file header says MIR-17 and ADR-088 replaced the
list, and that the list now lives in the system panel (MIR-16). Every other declaration in the file
(`View`, `KIND_BADGE`, the list markup) goes with the body. Its route in `src/App.tsx` is unchanged:
any signed-in member reaches the component.

### 4.4 `src/components/ReportIssueButton.tsx`

`:191`'s *"An admin will see this on the reports page."* becomes *"Thanks — the CaleChip team will see
this."*. The `report-issue-sent` test id is unchanged.

### 4.5 `src/lib/data/mock.ts`

Each body reproduces the database since MIR-16:

```ts
  async countOpenIssueReports(): Promise<number> { return 0; },
  async issueImageUrls(paths: string[]): Promise<(string | null)[]> { return paths.map(() => null); },
  async listIssueReports(): Promise<IssueReport[]> { return []; },
  async setIssueReportStatus(_reportId: string, _status: IssueStatus): Promise<Result<IssueReport>> {
    return refused("not_permitted", ISSUE_STATUS_REFUSED);
  },
```

Each carries a comment citing ADR-082 decision 1 (no member reads a report) and MIR-16's migration.

A test-only export beside `seam`, in the shape of `__sentEventEmails`:

```ts
/** Test-only, MIR-17. The reports the mock holds, as stored, for tests that check a write landed.
 *  Not part of the seam, so parity is untouched. */
export function __storedIssueReports(): IssueReport[];   // copies, newest first
```

`createIssueReport` and the stores `reports` and `issueObjects` are unchanged. `issueObjects` is still
written by uploads and is now read only by `__storedIssueReports`'s callers through `images` paths.

### 4.6 Tests

- **`tests/issue-reports.test.ts`.**
  - Every case that read back through `listIssueReports` or `countOpenIssueReports` as an admin
    (`:45`, `:58`, `:79`, `:93`, `:338`, `:363`, `:415`) reads through `__storedIssueReports()`
    instead.
  - The `issue_report_select_admin` and `issue_report_update_admin` describes (`:124-206`) and the
    `issueImageUrls` describe (`:372-412`) become one `describe("MIR-17 AC-6 …")`, with one `it` per
    caller of AC-6.
  - The sign-up count cases (`:439-469`) are unchanged.
- **`tests/e2e/solo-report-issue.spec.ts`.**
  - Tests 4, 5 and 10 (`:121`, `:144`, `:255`) are replaced by `MIR-17 AC-1` (no tab, no badge) and
    `MIR-17 AC-3` (Quan's notice).
  - Test 6 (`:319`) becomes `MIR-17 AC-3` for Thanh (the notice, not a refusal).
  - Test 11 (`:303`) keeps asserting no tab.
  - Test 3's confirmation assertion follows AC-5.
- **`tests/e2e/uie-09-admin-hub.spec.ts` and `tests/e2e/solo-admin-tabs.spec.ts`.** Their ordered
  copies of the tab list drop `/reports` and `admin-hub-reports-link`, and any count of tabs falls by
  one. This is the cost `AdminTabs.tsx:146-149` already records.

## 5. Seam impact

**`DataSeam`: no signature changes.** Four mock bodies change to the database's answers, and one
test-only export is added beside `seam`. The supabase implementations are unchanged. **Seam parity** compares
names and arity, so it is unaffected. **`SystemSeam`: none.**

## 6. Schema delta

`none`. No migration, policy or grant changes. The database already refuses every member (MIR-16).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-088-issue-reports-leave-the-member-app-first-and-the-rest-of-p4-2-is-mir-17-b.md"
  - ".ai/board/tickets/MIR-17-b/ticket.yaml"
  - ".ai/board/tickets/MIR-20/ticket.yaml"
  - "src/routes/IssueReports.tsx"
  - "src/components/AdminTabs.tsx"
  - "src/components/AdminLayout.tsx"
  - "src/components/ReportIssueButton.tsx"
  - "src/lib/data/mock.ts"
  - "tests/issue-reports.test.ts"
  - "tests/e2e/solo-report-issue.spec.ts"
  - "tests/e2e/uie-09-admin-hub.spec.ts"
  - "tests/e2e/solo-admin-tabs.spec.ts"
```

`size: M`, from 12 paths, and `size_estimate` agrees. P4-2 whole reaches role tests at 97 sites in
26 `src/` files, which is `L`, so the rest is MIR-17-b (ADR-088). MIR-20 now also depends on
MIR-17-b. `glossary_owed` is `[]`.

## 8. Rejected alternatives

- **Delete `IssueReports.tsx` and its route.** Rejected in ADR-088: a bookmarked address would land
  on the not-found path with no explanation.
- **Keep the tab and show the notice behind it.** Rejected: a tab is a promise that something is
  there to act on. The hub's own rule (`AdminTabs.tsx:40-42`) is that the strip carries destinations,
  not statements.
- **Leave the mock as it is**, admin-readable, because no screen reads it after this ticket.
  Rejected: the vitest suite would keep asserting an admin read the database refuses, and the next
  ticket that calls one of these functions would inherit a mock that lies.
- **Plan all of P4-2 here.** Rejected: `L`.

## Changelog

- `2026-11-08T07:12:01Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from P4-2, the audit, ADR-082 decision 4 and ADR-059 before the source tree was read for
  3–8. Reading it found three things:
  - P4-2 reaches 26 files, which narrowed the ticket to the issue-reports guard (ADR-088);
  - the bubble's confirmation promises an admin, which added AC-5;
  - `tests/issue-reports.test.ts` reads its writes back through the admin list, which added
    `__storedIssueReports` to § 4.5.

  Amended by `tech-lead-design`.

## Delegated decisions

- **ADR-088**: MIR-17 takes issue reports out of the member app, and MIR-17-b is the rest of P4-2.
  `MemberRole` keeps `"admin"`. A client "org parameter" is the caller's own org. The four
  member-seam issue-report functions stay on `DataSeam` until a later tidy. MIR-20 depends on
  MIR-17-b.
