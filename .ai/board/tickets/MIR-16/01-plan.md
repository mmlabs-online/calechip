---
ticket: MIR-16
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-07T08:41:16Z   # re-plan after REVIEW FAIL R5; first written 2026-11-07T08:17:01Z
inputs_read:
  - .ai/board/tickets/MIR-16/ticket.yaml
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/decisions/ADR-073-one-decider-on-any-of-the-owners-teams-decides-a-multi-team-entry.md
  - .ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md
  - .ai/steward/context.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - supabase/migrations/20260926100000_solo_issue_report.sql
  - supabase/migrations/20260926140000_solo_issue_report_images.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql
  - supabase/migrations/20261104150000_mir18_system_admin.sql
  - supabase/tests/150-write-path-org-bound.test.sql
  - supabase/tests/160-read-path-org-bound.test.sql
  - supabase/tests/060-removed-and-pending.test.sql
  - .ai/board/tickets/MIR-16/04-review.md
  - src/lib/data/supabase.ts
  - src/lib/data/system.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-16 — the role split, slice 1: issue reports go to the system panel

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:305`):

| ID | Feature | Group |
|---|---|---|
| MIR-16 | The database splits admin into system_admin, org_admin and a per-team manager | MIR |

**Plan item P4-1, the bullet this slice ships** (`.ai/board/plans/calechip-multi-tenancy-plan.md:235`):
*"Re-point the four system-scope groups: sign-up queue, holidays, issue reports, event override"*.
This slice covers the issue-reports group. **ADR-074 *Consequences*:** *"MIR-16 re-points the four
system-scope groups … onto `is_system_admin()`."* **ADR-082 decision 1** (written at this PLAN)
splits P4-1 into MIR-16 (issue reports), MIR-16-b (`org_admin`) and MIR-16-c (per-team `manager`).
Decision 2 keeps the sign-up queue and the event override as org powers, per the operator's decision
of 2026-10-12 recorded in this ticket.

**Who gains what.** An issue report is feedback about the product. Today every admin of the org it
was written in reads it and marks it done, and in Org public that is every admin of every free team
(`20261103180000_mir13b_read_path_org_bound.sql:370-392`). After this slice only a system admin, at
`aal2`, reads reports and marks them done. They see reports from every org, with the org and the
author named, in the system panel. No org's admin reads another person's feedback any more.

`size_estimate: M` — one migration, its pgTAP, two changed pgTAP files, the panel seam and screen,
one e2e spec, and the split's board overhead.

**Out of scope — and where each goes:**

- **`org_admin`, `is_org_admin`, the demotion trigger, the sign-up queue and the event override**
  all go to **MIR-16-b** (ADR-082 decisions 1–2).
- **`manager` leaving `member.role`, and `may_decide`** go to **MIR-16-c**.
- **The member app's *Issue reports* screen, its tab badge, and the member mock's issue-report
  reads** (`src/routes/IssueReports.tsx`, `countOpenIssueReports`, `src/lib/data/mock.ts`) go to
  **MIR-17**, which replaces that screen's admin guard (P4-2). Until then the screen reads nothing
  against the database, and the mock still lets an admin read (ADR-082 decision 4).
- **Writing a report** (`createIssueReport`, `issue_report_insert_own`, `issue_image_insert_own`) is
  unchanged. Every member still files reports.
- **Deleting a report, or editing its text.** Neither exists today, and neither is added.
- **Filtering the panel list by org or status.** Not asked for. The list is newest first, as the
  member screen is.
- **`.ai/standards/rbac-and-security.md`'s issue-report rows** need a standards edit, which is
  human-only.

## 2. Acceptance criteria

Throughout: **Sam** is a system admin. *At aal2* and *at aal1* name the assurance level of his
session. **Ada** is an approved `admin` of Org public. **Dora** is an approved `admin` of a dedicated
org, Org D. **Thanh** is an approved member of Org public who has written report **R-P**. **Dan** is
a member of Org D who has written report **R-D**, with one image. AC-1 to AC-6 are observed against
the database as the caller. AC-7 to AC-11 are observed in the system panel.

**AC-1 — no org admin reads a report**
- Given R-P and R-D exist
- When Ada and Dora each select from `public.issue_report`
- Then each gets zero rows

**AC-2 — nor marks one done**
- When Ada updates R-P's `status` to `done`, and Dora does the same to R-D
- Then each affects zero rows, and both reports stay `open`

**AC-3 — nor reads a report's image**
- When Dora selects R-D's image from `storage.objects`, or mints a signed URL for it
- Then she gets zero rows, and no URL

**AC-4 — a system admin at aal2 lists every org's reports**
- Given Sam at aal2
- When he calls `list_issue_reports()`
- Then he gets R-P and R-D, newest first. Each carries its id, its org's id and name, its author's
  id and display name, kind, message, page, status, created_at and image paths

**AC-5 — and marks one done, and open again**
- Given Sam at aal2
- When he calls `set_issue_report_status(R-D, 'done')`, then `set_issue_report_status(R-D, 'open')`
- Then R-D is `done` after the first call and `open` after the second

**AC-6 — nobody else uses the door**
- When Sam at aal1, Ada, Dora and Thanh each call `list_issue_reports()` and
  `set_issue_report_status(R-P, 'done')`
- Then every call is refused with `42501`, R-P stays `open`, and `anon` holds no `EXECUTE` on either
  function
- And when Sam at aal2 calls `set_issue_report_status` with an id that is no report
- Then it is refused with `P0002`

**AC-7 — the panel shows the reports**
- Given Sam is signed in to the panel at aal2
- When the signed-in screen loads
- Then an *Issue reports* section lists one row per report, newest first. Each row shows its date,
  org, author, kind, page, message and status

**AC-8 — the panel says when there are none**
- Given there are no reports
- When the section loads
- Then it shows `No issue reports.` and no row

**AC-9 — the panel marks a report done, and open again**
- When Sam presses *Mark done* on an open report
- Then that row shows `Done` and offers *Reopen*
- And when he presses *Reopen*, it shows `Open` and offers *Mark done*

**AC-10 — the panel shows a report's images**
- Given a report with image paths
- When its row is shown
- Then there is one image slot per path, in order. A slot whose URL could not be minted says
  `Image unavailable`

**AC-11 — the panel says when a status change was refused**
- Given the change is refused
- When Sam presses *Mark done* or *Reopen*
- Then the row keeps its status and shows the refusal's message

**Invariants touched.** `[]`. An issue report is not an entry, carries no team, and no invariant
reads it.

**Open questions.** None that block. ADR-082 decision 3 (Org public's admins become its
`org_admin`s) is MIR-16-b's to build, and it is recorded so that MIR-16-b does not re-open it.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

The panel's signed-in screen (`src/system/main.tsx`, `OrgManagement`) gains a third `<section>`, below
*National holidays*, in the same card style:

1. **Header:** `<h2>` *Issue reports*, with the open count as a muted label: *{n} open*.
2. **List:** one row per report, dense, newest first. Line one holds the date (`yyyy-MM-dd HH:mm`,
   tabular), the org name, the author, the kind as a small pill (*Bug* / *Idea* / *Other*), the page
   in monospace, the status, and on the right *Mark done* or *Reopen*. Line two is the message, in
   full, wrapped. Line three, only when there are images, holds a row of thumbnails (64 px, rounded),
   each linking to its URL in a new tab.
3. **States:** `Loading issue reports…` (status); the error with *Try again* (alert);
   `No issue reports.` when the list is empty.

## 3. Permission model

Every check is on the server side of the boundary. The panel's gate is an affordance, and the
control is `public.is_system_admin()` inside each RPC and in the storage policy.

| Action | Sam at aal2 | Sam at aal1 | Org admin (any org) | Member | anon |
|---|---|---|---|---|---|
| Insert a report (`issue_report_insert_own`, unchanged) | ❌ no member row | ❌ | ✅ own | ✅ own | ❌ |
| `select` on `public.issue_report` | ❌ 0 rows (reads via RPC) | ❌ 0 rows | ❌ 0 rows **new** | ❌ 0 rows | ❌ no grant |
| `update (status)` on `public.issue_report` | ❌ 0 rows | ❌ | ❌ 0 rows **new** | ❌ | ❌ |
| `list_issue_reports()` | ✅ every org | ❌ 42501 | ❌ 42501 | ❌ 42501 | ❌ no EXECUTE |
| `set_issue_report_status(uuid, issue_status)` | ✅ | ❌ 42501 | ❌ 42501 | ❌ 42501 | ❌ no EXECUTE |
| `select` on `storage.objects`, bucket `issue-report` | ✅ `issue_image_select_system` | ❌ | ❌ **new** | ❌ | ❌ |

These are the denials the tests assert: AC-1, AC-2 and AC-3 for every org admin, and AC-6 for every
caller except a system admin at aal2.

## 4. Contract

### 4.1 Migration — `supabase/migrations/20261107210000_mir16_issue_reports_system_scope.sql`

The migration is idempotent (ADR-024) and wrapped in `begin; … commit;`.

```sql
-- 1. Member reads and writes end (ADR-082 decision 1).
drop policy if exists issue_report_select_admin on public.issue_report;
drop policy if exists issue_report_update_admin on public.issue_report;
drop policy if exists issue_image_select_admin on storage.objects;

-- 2. Images, for the panel's signed URLs.
drop policy if exists issue_image_select_system on storage.objects;
create policy issue_image_select_system on storage.objects
  for select to authenticated
  using (bucket_id = 'issue-report' and public.is_system_admin());

-- 3. The door. Both: language plpgsql, security definer, set search_path = '', first statement
--      if not public.is_system_admin() then
--        raise exception 'not a system admin' using errcode = '42501';
--      end if;

create or replace function public.list_issue_reports()
  returns table (
    id uuid, org_id uuid, org_name text, member_id uuid, member_name text,
    kind public.issue_kind, message text, page text, status public.issue_status,
    created_at timestamptz, images text[]
  )
  -- stable. Every row of public.issue_report r, left join public.member m on m.id = r.member_id,
  -- join public.org o on o.id = r.org_id; member_name = m.display_name.
  -- order by r.created_at desc, r.id desc; limit 500 (ISSUE_REPORT_LIMIT).
  -- Columns qualified: the `returns table` names are PL/pgSQL variables.

create or replace function public.set_issue_report_status(p_id uuid, p_status public.issue_status)
  returns void
  -- volatile. update public.issue_report r set status = p_status where r.id = p_id;
  -- if not found then raise exception 'issue report not found' using errcode = 'P0002'; end if;

-- 4. Grants.
revoke all on function public.list_issue_reports() from public, anon;
grant execute on function public.list_issue_reports() to authenticated;
revoke all on function public.set_issue_report_status(uuid, public.issue_status) from public, anon;
grant execute on function public.set_issue_report_status(uuid, public.issue_status) to authenticated;
```

Table grants (`grant select`, `grant update (status)`, `grant insert (…)` to `authenticated`) are
unchanged. With no select or update policy left for a member, they admit zero rows. Keeping them
keeps this slice off the grant layer, which MIR-17 or a later tidy-up may revoke.

### 4.2 pgTAP — `supabase/tests/270-issue-reports-system-scope.test.sql`

The file has one `plan(n)` and runs on `tests.seed()` (Org public; `admin_t` is Ada, `member_t` is
Thanh). On top of the seed, as `postgres`, it creates:

- Org D, with team D1;
- Dora (`admin`) and Dan, both inserted **without `team_id`** and given `membership` rows with
  `tests.put_on_team` (ADR-080 decision 5);
- a `system_admin` row for Sam;
- R-P by Thanh and R-D by Dan, with `images = '{<dan uid>/d1.png}'`, and a `storage.objects` row for
  that path in bucket `issue-report`.

**`tests.seed()` already holds a third report**, written by `member_t` with `created_at` defaulting
to `now()` (`_isolation.psql:158-159`). It is therefore the newest row `list_issue_reports()`
returns. AC-4's ordering assertion either restricts to R-P and R-D (`where id in (…)`, still
`created_at desc`) or expects all three rows with the seed row first. Either way it must prove
newest-first ordering and the presence of both orgs. *Added at the re-plan of 2026-11-07. Review
finding 2, `04-review.md`.*

`tests.authenticate_at` is used as `200-org-management.test.sql` defines it. The file makes one
assertion or more per AC-1 to AC-6. AC-6 gets one per caller and function, plus a
`has_function_privilege('anon', …)` check per signature. It also asserts that
`issue_report_select_admin`, `issue_report_update_admin` and `issue_image_select_admin` no longer
exist and that `issue_image_select_system` does.

### 4.3 Changed pgTAP

- **`160-read-path-org-bound.test.sql:242-243`.** *"AC-8: public.issue_report still returns a report
  from T3"* becomes `is_empty(…, 'AC-8: public.issue_report returns nothing to an admin — MIR-16,
  ADR-082')`.
- **`160-read-path-org-bound.test.sql:249-253`.** The `storage.objects` *"still returns the image"*
  case becomes the matching `not exists`. `plan(n)` is unchanged.
- **`060-removed-and-pending.test.sql:72-74`.** `'issue_report'` comes out of `admin_t`'s AC-13
  control array, because an org admin now reads none, and `plan(87)` becomes `plan(86)`. The
  *reads nothing* half (`:17`) stays as written: removed and pending callers still read no report.
  The control that a report is readable by somebody entitled is now 270's AC-4. *Added at the
  re-plan of 2026-11-07. Review finding 1, `04-review.md`.*
- **`150-write-path-org-bound.test.sql:153`, `:186`.** These still hold, since zero rows were
  affected and the report is still `open`, so the file is unchanged and stays out of
  `allowed_paths`.
- **`010-catalogue.test.sql`.** Its definer census gains
  `'public.list_issue_reports()'` and
  `'public.set_issue_report_status(uuid,public.issue_status)'`, after the MIR-15-b lines. Its policy
  census, wherever it names the three dropped policies, follows § 4.1.

### 4.4 Panel seam — `src/lib/data/system.ts`

Added to `SystemSeam`, after `deleteNationalHoliday`:

```ts
  /** `rpc("list_issue_reports")`, newest first. Never throws. MIR-16. */
  listIssueReports(): Promise<IssueResult<SystemIssueReport[]>>;
  /** `rpc("set_issue_report_status", { p_id, p_status })`. Never throws. */
  setIssueReportStatus(reportId: string, status: IssueStatus): Promise<IssueResult<null>>;
  /** `storage.from("issue-report").createSignedUrls(paths, 3600)`. Same order and length; `null`
   *  where a URL was not minted. Never throws. */
  issueImageUrls(paths: string[]): Promise<(string | null)[]>;
```

```ts
import type { IssueKind, IssueStatus } from "@/lib/domain/types";
import { ISSUE_REPORT_LIMIT } from "@/lib/domain/types";

export interface SystemIssueReport {
  id: string;
  orgId: string;
  orgName: string;
  memberId: string;
  memberName: string | null; // null when the author's member row is gone
  kind: IssueKind;
  message: string;
  page: string;
  status: IssueStatus;
  createdAt: string; // ISO 8601
  images: string[];  // storage paths, in the order written
}

export type IssueFailureCode =
  | "not_permitted"   // 42501
  | "issue_not_found" // P0002
  | "network";        // anything else, a throw, or the list reaching ISSUE_REPORT_LIMIT

export type IssueResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: IssueFailureCode; message: string } };

export const ISSUE_FAILURE_MESSAGES: Record<IssueFailureCode, string> = {
  not_permitted: "You do not have permission to do that.",
  issue_not_found: "That report no longer exists. Reload to see the current list.",
  network: "Could not reach the server. Try again.",
};
```

RPC rows map snake_case to these names one for one. A list of `>= ISSUE_REPORT_LIMIT` rows is refused
as `network`, the truncation rule `listIssueReports` already applies (`supabase.ts:3497-3502`). The
bucket name and TTL are written here as literals, `"issue-report"` and `60 * 60`, because the panel
imports nothing from the member seam (`main.tsx:3-5`). `IssueKind`, `IssueStatus` and
`ISSUE_REPORT_LIMIT` are existing exports of `src/lib/domain/types.ts` (`:906`, `:915`, `:1000`).

**Mock** (same file): a store seeded with one copy of `FIXTURE_ISSUE_REPORT` (`src/lib/fixtures.ts:587`),
with `orgName: "Org public"` and `memberName` taken from the fixture member it names. The store is
gated on `mockMaySeeOrgs()`. An unknown id is refused as `issue_not_found`. `issueImageUrls` returns
`null` for every path. A test-only export, `__setMockIssueReports(rows: SystemIssueReport[])`, sits
beside `systemSeam` so the e2e and unit tests can reach AC-8 and AC-10.

### 4.5 Panel screen — `src/system/main.tsx`

An `IssueReports` component, rendered by `OrgManagement` after the *National holidays* section. It
loads on mount. After any successful status change it reloads the list. It mints image URLs once per
load, for every report that has images.

Test ids (the e2e spec reads only these):

| id | element |
|---|---|
| `system-issues` | the section |
| `system-issues-open-count` | the *{n} open* label, with `data-count` |
| `system-issues-loading`, `system-issues-error`, `system-issues-retry`, `system-issues-empty` | the states |
| `system-issue-row` | one report, with `data-id` and `data-status` |
| `system-issue-row-date`, `system-issue-row-org`, `system-issue-row-author`, `system-issue-row-kind`, `system-issue-row-page`, `system-issue-row-message`, `system-issue-row-status` | its fields |
| `system-issue-row-toggle` | *Mark done* / *Reopen* |
| `system-issue-row-error` | the refusal line under the row |
| `system-issue-row-image` | one image slot |

Copy, exactly: *Issue reports*, *{n} open*, *Bug*, *Idea*, *Other*, *Open*, *Done*, *Mark done*,
*Reopen*, *Image unavailable*, *Loading issue reports…*, *No issue reports.*, *Try again*. An author
whose name is `null` is shown as *Removed member*.

### 4.6 e2e — `tests/e2e/mir-16-issue-reports.spec.ts`

The spec runs against the mock build and signs in as `mir-18-b-org-management.spec.ts:15-23` does. It
has one test per AC-7 to AC-11. AC-8 and AC-10 seed through `__setMockIssueReports` by a page init
script. AC-11 uses the `mir-14-b` route-rewrite pattern on `setIssueReportStatus`.

## 5. Seam impact

**`DataSeam`: none.** `listIssueReports`, `setIssueReportStatus`, `countOpenIssueReports` and
`issueImageUrls` keep their signatures. Against the database they now return nothing to every
member, which MIR-17 turns into a screen change. **`SystemSeam` gains three functions** (§ 4.4), in
both of its implementations. **The member mock is looser than SQL on issue reports until MIR-17**
(ADR-082 decision 4).

## 6. Schema delta

**Not `none`** (ADR-014). Three policies are dropped (two on `public.issue_report`, one on
`storage.objects`), one storage policy is added, and two `security definer` functions are added. No
table, column, constraint, index, grant or row changes. **ADR-082**, accepted under ADR-067 at this
PLAN. Applying the migration to the hosted project is human-only (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-082-the-role-split-goes-in-three-slices-and-issue-reports-go-to-the-system-panel-first.md"
  - ".ai/board/tickets/MIR-16-b/ticket.yaml"
  - ".ai/board/tickets/MIR-16-c/ticket.yaml"
  - ".ai/board/tickets/MIR-17/ticket.yaml"
  - "supabase/migrations/20261107210000_mir16_issue_reports_system_scope.sql"
  - "supabase/tests/270-issue-reports-system-scope.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "supabase/tests/160-read-path-org-bound.test.sql"
  - "supabase/tests/060-removed-and-pending.test.sql"
  - "src/lib/data/system.ts"
  - "src/system/main.tsx"
  - "tests/e2e/mir-16-issue-reports.spec.ts"
```

`size: M`, from 12 paths, and `size_estimate` agrees. At the re-plan of 2026-11-07, `060` came in and
`.ai/board/tickets/MIR-20/ticket.yaml` went out. MIR-20's edit was reverted on the branch, so it no
longer differs from `origin/main`, because MIR-20 is already blocked through MIR-17 (ADR-082
decision 5, amended). The count stays 12. Without the swap it would have been 13, which is `L`. Whole, P4-1 would touch more than 12 files. The
enum rename alone re-creates every function body that spells `'admin'`, and it reaches the seam, the
bootstrap, the seed and the pgTAP fixtures. So it split here (ADR-082). `glossary_owed` is `[]`. The
term *system admin* already has a row, so no row is written.

## 8. Rejected alternatives

- **`org_admin` first**, as P4-1 lists it. Rejected for this slice, as ADR-082 *Options considered*
  records: it is the slice most likely to split again. Issue reports are settled and self-contained.
- **Policies for the system admin on `issue_report`, read through `from("issue_report")`.** Rejected.
  The panel could not name the org or the author, because a system admin reads neither `member` nor
  `org`, and it would depart from ADR-075 decision 1's pattern.
- **Revoke `select` and `update (status)` from `authenticated` in the same migration.** That is a
  tidier end state. Rejected for now: `countOpenIssueReports` and `listIssueReports` on the member
  seam would turn from an empty answer into a `42501` throw. That would put the member app's admin
  tab into its error phase until MIR-17, which is a worse interim than an empty list.
- **Take the member app's *Issue reports* screen out here.** That closes the interim gap. Rejected:
  it is the P4-2 guard MIR-17 owns, and it would add the screen, the tab strip, the router, the mock
  and two test files to a ticket already at 12.

## Changelog

- `2026-11-07T08:17:01Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from P4-1, the audit, ADR-059, ADR-073 and ADR-074 before the source tree was read for
  3–8. Reading it showed that phase 3 had already bounded every `is_admin` site by org, and that an
  enum rename re-creates every body spelling `'admin'`. That moved the split from "by role" to "issue
  reports first" (ADR-082), and it added AC-3 for the storage policy that a table-only change would
  have missed. Amended by `tech-lead-design`.
- `2026-11-07T08:41:16Z` — re-plan after REVIEW FAIL on R5 (`04-review.md`), raised by `tech-lead-review` and
  amended by `tech-lead-design`. **§ 4.3** gains `060-removed-and-pending.test.sql:72-74` (finding 1):
  dropping `issue_report_select_admin` breaks its `admin_t` control. That was a gap in this plan, not
  a Developer defect. **§ 4.2** now states that `tests.seed()` holds a third, newest report (finding
  2), so the Developer's AC-4 fix has a contract to meet. **§ 7** adds 060 and drops
  `.ai/board/tickets/MIR-20/ticket.yaml`, whose edit is reverted (ADR-082 decision 5 amended). No AC
  changes.

## Delegated decisions

- **ADR-082** — MIR-16 splits into MIR-16 (issue reports to the system panel), MIR-16-b (`org_admin`)
  and MIR-16-c (per-team `manager`). The sign-up queue and the event override stay org powers. In
  Org public, today's admins become its `org_admin`s. This narrows ADR-074 *Consequences*' four
  system-scope groups to one, and supersedes ADM-07's *every admin reads every report*. Decision 5 was
  amended at the re-plan: MIR-20 is blocked through MIR-17, so its own `depends_on` is not edited.
