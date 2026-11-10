---
ticket: MIR-17
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-08T07:36:34Z
inputs_read:
  - .ai/board/tickets/MIR-17/01-plan.md
  - .ai/board/tickets/MIR-17/03-impl-log.md
  - .ai/board/tickets/MIR-17/ticket.yaml
  - .ai/templates/review-report.md
  - git diff origin/main...HEAD
  - src/App.tsx
  - src/routes/AdminHub.tsx
  - src/lib/data/system.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
verdict: PASS
failed_checks: []
invariant_violation: false
route_to: none
increments_rework: false
---

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-17, 16 changed file(s)` … `allowed-paths: PASS`. `node scripts/check-carry.mjs MIR-17` → `0 uncommitted path(s)` / `PASS — nothing stray`. The 12 non-exempt paths match `.ai/board/tickets/MIR-17/ticket.yaml:16-28`; the rest are the ticket folder and `.ai/board/backlog.md` (ship-owned) |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` → `tsc --noEmit`, exit 0, no output |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` → `eslint .`, exit 0, no output (repo-wide, so covers the diff). The one disable is scoped and reasoned: `src/lib/data/mock.ts:3493` |
| R4 | No datastore access outside the seam (RULE-02) | PASS | `src/routes/IssueReports.tsx:1-22` imports nothing at all; `src/components/AdminLayout.tsx:58` imports `seam` from `@/lib/data` only; no `src/` file imports `@/lib/data/mock` or `@/lib/data/supabase` (grep, 0 matches); `__storedIssueReports` (`src/lib/data/mock.ts:687`) has no `src/` caller, only `tests/issue-reports.test.ts:49`, `:139` |
| R5 | Every § 4 contract item implemented | PASS | see R5 detail |
| R6 | Permission gating matches § 3 | PASS | Tab/badge gone for everyone: `src/components/AdminTabs.tsx:48` (`AdminBadge = "openSignups"`), `:144-153` (entry removed, `admin-hub-allow-list-link` at `:132` is followed directly by `admin-hub-threshold-link` at `:155`). `/reports` notice for any member: route unchanged at `src/App.tsx:501-506` (guard is `membership.state === "member"`), component renders no role branch `src/routes/IssueReports.tsx:13-21`. Mock read/mark refused to all: `src/lib/data/mock.ts:3461-3463`, `:3478-3480`, `:3485-3487`, `:3494-3496`. Sending unchanged: `createIssueReport` not in the diff of `src/lib/data/mock.ts` |
| R7 | No invariant violated | PASS | `invariants_touched: []` at `.ai/board/tickets/MIR-17/ticket.yaml:15`; see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` returns nothing; the only import change removes one (`src/lib/data/mock.ts:114`) |

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 Reports entry removed from `ADMIN_TABS` | `src/components/AdminTabs.tsx:144-153` | yes |
| §4.1 `AdminBadge` becomes `"openSignups"` | `src/components/AdminTabs.tsx:48` | yes |
| §4.1 comment naming the two specs kept as the reason they change | `src/components/AdminTabs.tsx:151-153` | yes |
| §4.2 badge record loses `openReports` | `src/components/AdminLayout.tsx:126-128`, `:144` | yes |
| §4.2 `countOpenIssueReports()` read removed; `refreshBadges` reads `countPendingMembers()` only | `src/components/AdminLayout.tsx:142-155` (single call at `:151-152`) | yes |
| §4.2 header comment cites ADR-082 / ADR-088 | `src/components/AdminLayout.tsx:51-53` | yes |
| §4.3 default export renders only the notice, `data-testid="issue-reports-moved"`, AC-3 sentence | `src/routes/IssueReports.tsx:13-21` (testid `:16`, sentence `:19`) | yes |
| §4.3 no seam / `useAdminContext` import; `View`, `KIND_BADGE`, list markup gone; header says MIR-17/ADR-088 | `src/routes/IssueReports.tsx:1-12` (header; file has no imports) | yes |
| §4.3 route in `App.tsx` unchanged | `src/App.tsx:501-506`; `App.tsx` absent from the diff | yes |
| §4.4 confirmation sentence, `report-issue-sent` id unchanged | `src/components/ReportIssueButton.tsx:194`, `:185` | yes |
| §4.5 `countOpenIssueReports` → `0` | `src/lib/data/mock.ts:3461-3463` | yes |
| §4.5 `issueImageUrls` → `paths.map(() => null)` | `src/lib/data/mock.ts:3478-3480` | yes |
| §4.5 `listIssueReports` → `[]` | `src/lib/data/mock.ts:3485-3487` | yes |
| §4.5 `setIssueReportStatus(_reportId, _status)` → `refused("not_permitted", ISSUE_STATUS_REFUSED)` | `src/lib/data/mock.ts:3494-3496` | yes (arity 2, parity unaffected) |
| §4.5 each body comments ADR-082 d1 and MIR-16's migration | `src/lib/data/mock.ts:3457-3460`, `:3474-3477`, `:3482-3484`, `:3488-3492` | yes |
| §4.5 `__storedIssueReports(): IssueReport[]`, copies, newest first, beside `seam` | `src/lib/data/mock.ts:687-694` | yes |
| §4.6 `issue-reports.test.ts` reads back via `__storedIssueReports()` | `tests/issue-reports.test.ts:49` (`allReports()` helper — delegated decision in `03-impl-log.md` is within the contract's intent) | yes |
| §4.6 three describes merged into one `MIR-17 AC-6` with one `it` per caller | `tests/issue-reports.test.ts:135` (Quan, Thanh, no session) | yes |
| §4.6 sign-up count cases unchanged | `tests/issue-reports.test.ts` diff touches only one comment in that block | yes |
| §4.6 `solo-report-issue.spec.ts` tests 4/5/10 → AC-1 and AC-3 (Quan); 6 → AC-3 (Thanh); 3 follows AC-5 | `tests/e2e/solo-report-issue.spec.ts:113`, `:121`, `:266`, `:110` | yes |
| §4.6 tab-list copies drop `/reports`; counts fall by one | `tests/e2e/uie-09-admin-hub.spec.ts` (`DESTINATIONS` entry removed), `tests/e2e/solo-admin-tabs.spec.ts:226-227` | yes |

AC-2 (no `/reports` link on `/admin`) holds through §4.1: `src/routes/AdminHub.tsx:134-159` draws no links and relies on the strip. AC-4: `src/routes/IssueReports.tsx` has no imports, so it cannot call any seam function; `src/components/AdminLayout.tsx:142-155` calls only `countPendingMembers`. The system panel reads its own store, not the member mock: `src/lib/data/system.ts:874-893`. Vitest: `pnpm test` → 52 files, 1032 tests passed.

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| *(none — `invariants_touched` is empty)* | No IDs to reason through. I checked the empty list against the diff: every changed `src/` line is in issue-report display, the admin badge record, or the issue-report mock bodies. No entry, approval, overlap, team-membership or tenancy logic is touched. An issue report is not an entry (`01-plan.md` § 2). | `.ai/board/tickets/MIR-17/ticket.yaml:15`; changed lines limited to `src/lib/data/mock.ts:114`, `:676-694`, `:3457-3496`, `src/components/AdminLayout.tsx:51-155`, `src/components/AdminTabs.tsx:44-153`, `src/components/ReportIssueButton.tsx:191-194`, `src/routes/IssueReports.tsx:1-22` |

## Findings

None that fail a check.

## Verdict

`PASS` → DONE.
