---
ticket: MIR-17
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-08T07:33:41Z
inputs_read:
  - .ai/board/tickets/MIR-17/01-plan.md
  - .ai/board/tickets/MIR-17/ticket.yaml
  - .ai/registry/decisions/ADR-088-issue-reports-leave-the-member-app-first-and-the-rest-of-p4-2-is-mir-17-b.md
  - .ai/registry/decisions/ADR-082-the-role-split-goes-in-three-slices-and-issue-reports-go-to-the-system-panel-first.md
  - src/routes/IssueReports.tsx
  - src/components/AdminTabs.tsx
  - src/components/AdminLayout.tsx
  - src/components/ReportIssueButton.tsx
  - src/lib/data/mock.ts
  - tests/issue-reports.test.ts
  - tests/e2e/solo-report-issue.spec.ts
  - tests/e2e/uie-09-admin-hub.spec.ts
  - tests/e2e/solo-admin-tabs.spec.ts
  - src/lib/fixtures.ts
  - supabase/migrations/20261107210000_mir16_issue_reports_system_scope.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/IssueReports.tsx` | modified | Replaced the four-phase admin list with the one notice paragraph; no seam import, no `useAdminContext` | §4.3 |
| `src/components/AdminTabs.tsx` | modified | Removed the `Reports` entry from `ADMIN_TABS`; narrowed `AdminBadge` to `"openSignups"` | §4.1 |
| `src/components/AdminLayout.tsx` | modified | Dropped `openReports` from the badges record and the `countOpenIssueReports()` read; `refreshBadges` now reads `countPendingMembers()` only | §4.2 |
| `src/components/ReportIssueButton.tsx` | modified | Confirmation sentence no longer promises an admin reader | §4.4 |
| `src/lib/data/mock.ts` | modified | `countOpenIssueReports`, `issueImageUrls`, `listIssueReports`, `setIssueReportStatus` now answer every caller the post-MIR-16 emptiness; added test-only `__storedIssueReports()`; dropped the now-unused `ISSUE_REPORT_LIMIT` import | §4.5 |
| `tests/issue-reports.test.ts` | modified | `allReports()` reads `__storedIssueReports()` instead of the seam; merged `issue_report_select_admin`, `issue_report_update_admin` and `issueImageUrls` describes into one `MIR-17 AC-6` describe; rewrote the `countOpenIssueReports` admin case; dropped the now-unused `FIXTURE_REMOVED_MEMBER` import | §4.6 |
| `tests/e2e/solo-report-issue.spec.ts` | modified | Tests 4, 5, 10 replaced by `MIR-17 AC-1` (no tab, no badge) and `MIR-17 AC-3` (Quan's notice); test 6 becomes `MIR-17 AC-3` for Thanh; test 3 now asserts the AC-5 sentence; test 12's stale reports-badge assertion removed | §4.6 |
| `tests/e2e/uie-09-admin-hub.spec.ts` | modified | Dropped the `Reports` entry from `DESTINATIONS` (count falls to 7, restoring AC-3's title) | §4.6 |
| `tests/e2e/solo-admin-tabs.spec.ts` | modified | Dropped the `Reports` entry from `TABS`; test 5 now expects exactly one badge (`openSignups`) and asserts the reports badge is gone | §4.6 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 `AdminTabs.tsx` — Reports entry removed, `AdminBadge` narrowed | `src/components/AdminTabs.tsx:48` (type), `:144-153` (array, entry removed) | Comment at `:146-153` (old `:146-149`) naming the two specs kept, as the reason they changed here |
| §4.2 `AdminLayout.tsx` — badge record, read, header comment | `src/components/AdminLayout.tsx:51-53` (header), `:125-128` (badges state), `:142-154` (refreshBadges) | `refreshBadges` now issues exactly one seam call |
| §4.3 `IssueReports.tsx` — notice-only default export | `src/routes/IssueReports.tsx:13-21` | Imports no seam and no `useAdminContext`; route in `App.tsx` untouched (not in `allowed_paths`) |
| §4.4 `ReportIssueButton.tsx` — confirmation sentence | `src/components/ReportIssueButton.tsx:192-194` | `report-issue-sent` test id unchanged |
| §4.5 `mock.ts` — four bodies + `__storedIssueReports` | `src/lib/data/mock.ts:682-692` (`__storedIssueReports`), `:3458-3463` (`countOpenIssueReports`), `:3475-3480` (`issueImageUrls`), `:3482-3487` (`listIssueReports`), `:3489-3496` (`setIssueReportStatus`) | `createIssueReport` and the `reports`/`issueObjects` stores unchanged; supabase implementations untouched (not in `allowed_paths`) |
| §4.6 Tests — `tests/issue-reports.test.ts` | `allReports()` at `:45-50`; merged describe at `:131-172`; `countOpenIssueReports` describe at `:342-354` | AC-6 asserted per caller (Quan, Thanh, no session); sign-up count cases (`:372-401` in the new file) left unchanged as specified |
| §4.6 Tests — `solo-report-issue.spec.ts` | `MIR-17 AC-1` at `:113`, `MIR-17 AC-3` (Quan) at `:121`, `MIR-17 AC-3` (Thanh) at `:264`, AC-5 assertion in test 3 at `:106-110` | Test 11 kept asserting no tab, unedited |
| §4.6 Tests — `uie-09-admin-hub.spec.ts`, `solo-admin-tabs.spec.ts` | `DESTINATIONS`/`TABS` arrays, Reports entries removed | Counts fall by one; `solo-admin-tabs.spec.ts` test 5 narrowed from two badges to one |

## Deviations from the design

`none`. One clarification made without a design consultation, recorded as a delegated decision below
because it was an implementation detail the contract did not need to spell out.

## Delegated decisions

- **`allReports()`'s new body.** §4.5/§4.6 say "every case that read back through `listIssueReports` or
  `countOpenIssueReports` as an admin ... reads through `__storedIssueReports()` instead", citing seven
  line numbers in the pre-edit file. Rather than editing each call site individually, I rewrote the
  shared `allReports()` helper once to call `__storedIssueReports()` — every one of its ~15 call sites
  (including ones not in the cited list, e.g. the "nobody at all is refused" case at the old `:110-121`,
  and the image-upload cases at the old `:284-369`) needed the identical change for the identical
  reason, and a test that reads back what a write did is exactly what the helper exists for. The three
  cited describes that read the admin list directly (not through the helper) were merged into
  `MIR-17 AC-6` as instructed.
- **`eslint-disable-next-line` on `setIssueReportStatus`'s unused parameters.** §4.5's code block
  specifies `_reportId` and `_status` as the signature (kept for `DataSeam` arity, so seam parity is
  unaffected), but this repository's ESLint config has no `argsIgnorePattern` for underscore-prefixed
  unused arguments, so the literal signature failed `@typescript-eslint/no-unused-vars`. I added a
  one-line disable with a reason comment, following the precedent already in the codebase for exactly
  this situation (`src/lib/roles.ts:55`, an intentionally-unused parameter kept for a later ticket).
- **Comment and test-title accuracy passes.** Several long-standing comments named
  `issue_report_select_admin` / `issue_report_update_admin` as current policies (they are dropped by
  MIR-16) or claimed "two badges" / "the admin list" where only one tab or no list now exists. I
  updated these in the files I touched (`AdminTabs.tsx`, `AdminLayout.tsx`, `tests/issue-reports.test.ts`,
  both e2e spec files) so a comment inside `allowed_paths` does not assert something the code beside it
  now contradicts. No behaviour changed from this; it is description-of-code, not a contract item.

## Invariants

`invariants_touched: []` (ticket.yaml). None reasoned about further: an issue report is not an entry
and no invariant in `.ai/registry/invariants.md` reads it, which `01-plan.md` § 2 states and this
implementation does not touch anything that would change that (no entry, approval, or team-membership
logic is in any touched file).

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `node scripts/check-allowed-paths.mjs` | 0 | PASS — all changed files are in `allowed_paths` |
| `node scripts/check-carry.mjs MIR-17` | 0 | PASS — nothing stray |
| typecheck (`pnpm exec tsc --noEmit`) | 0 | clean |
| lint (`pnpm exec eslint .`) | 0 | clean after the `eslint-disable` noted above |
| unit tests (`pnpm exec vitest run`) | 0 | 52 files, 1032 tests, all pass |
| end-to-end (`pnpm exec playwright test`) | 0 | 505 tests: 483 passed, 21 skipped (pre-existing ADR-060 quarantine), 1 failed on the full parallel run — `tests/e2e/uie-10-sidebar.spec.ts` AC-3, a file outside `allowed_paths` whose `MIGRATED` list does not include `/reports`; re-run alone it passed (10/10), confirming the failure was worker-contention flake, not a regression from this ticket |
| `git diff --name-only` subset of `allowed_paths` | yes | confirmed by `check-allowed-paths.mjs` above |

## Testability contract

No design section 6 exists for this ticket (plan predates/does not use that template section); the
selectors exercised are `01-plan.md` § 2's own: `issue-reports-moved` (`src/routes/IssueReports.tsx:14`),
and the pre-existing `admin-hub-reports-link` / `admin-hub-reports-link-badge` / `reports` /
`report-row-toggle`, now asserted absent rather than present.

| selector | Exists at |
|----------|-----------|
| `issue-reports-moved` | `src/routes/IssueReports.tsx:14` |

## Open questions

None.
