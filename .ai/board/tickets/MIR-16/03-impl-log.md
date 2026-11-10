---
ticket: MIR-16
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-07T08:46:00Z
inputs_read:
  - .ai/board/tickets/MIR-16/01-plan.md
  - .ai/board/tickets/MIR-16/ticket.yaml
  - .ai/board/tickets/MIR-16/04-review.md
  - .ai/standards/testing-standards.md
  - .ai/standards/architecture.md
  - .ai/templates/impl-log.md
  - src/lib/data/system.ts
  - src/system/main.tsx
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - supabase/migrations/20260926100000_solo_issue_report.sql
  - supabase/migrations/20260926140000_solo_issue_report_images.sql
  - supabase/migrations/20261104150000_mir18_system_admin.sql
  - supabase/migrations/20261106120000_mir15b_org_public_holidays.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/060-removed-and-pending.test.sql
  - supabase/tests/160-read-path-org-bound.test.sql
  - supabase/tests/190-system-admin.test.sql
  - supabase/tests/200-org-management.test.sql
  - tests/e2e/mir-18-b-org-management.spec.ts
  - tests/e2e/mir-14-b-worklist-teams.spec.ts
  - src/main.tsx
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Rework note, 2026-11-07T08:46:00Z

`04-review.md` FAILed R5 on two findings and routed to `tech-lead-design`, which re-planned
`01-plan.md` § 4.2, § 4.3 and § 7 (`allowed_paths` gained `060-removed-and-pending.test.sql`). This
pass makes the two fixes the re-plan and the review authorised:

- **Finding 1 (plan gap, not charged to this agent).** The migration drops
  `issue_report_select_admin`, which `060-removed-and-pending.test.sql:72-74` relied on for `admin_t`'s
  AC-13 control. `issue_report` is removed from that control's array (`:76-78`), and `plan(87)`
  becomes `plan(86)` — one assertion fewer, matching the one array element removed. A comment at
  `:72-75` says where the control moved (270's AC-4).
- **Finding 2 (developer fix, per `04-review.md` Delegated decisions — not charged as a rework
  cycle).** `tests.seed()` writes a third report, by `member_t`, whose `created_at` defaults to
  `now()` (`_isolation.psql:158-159`) and so sorts before both fixture reports. AC-4's ordering
  assertion in `270-issue-reports-system-scope.test.sql` is restricted to R-P and R-D's ids
  (`where id in (...)`), which still proves newest-first across both orgs without depending on when
  the seed itself ran. A header comment (`:16-20`) and an inline one (`:135-138`) record why.

Everything else in this file is unchanged from the pass the review read (`produced_at:
2026-11-07T08:34:50Z`); only the two tables below were amended for these fixes.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261107210000_mir16_issue_reports_system_scope.sql` | created | drops the two `issue_report` policies and the one `storage.objects` policy that let an org admin read or mark a report; adds `issue_image_select_system` and the two `security definer` RPCs that are now the only door | § 4.1 |
| `supabase/tests/270-issue-reports-system-scope.test.sql` | created, then modified this pass | pgTAP coverage for AC-1 to AC-6, plus the policy census the design asks for; AC-4's order assertion restricted to R-P and R-D's ids, since `tests.seed()`'s own report sorts newest (review finding 2) | § 4.2 |
| `supabase/tests/010-catalogue.test.sql` | modified | the `security definer` census gains `list_issue_reports()` and `set_issue_report_status(uuid,public.issue_status)` | § 4.3 |
| `supabase/tests/160-read-path-org-bound.test.sql` | modified | the two "an admin still reads a T3 report / its image" assertions become "returns nothing to an admin" (MIR-16 removed the row they were asserting) | § 4.3 |
| `supabase/tests/060-removed-and-pending.test.sql` | modified this pass | `issue_report` comes out of `admin_t`'s AC-13 control array — an org admin now reads none, even on their own fixture; `plan(87)` → `plan(86)` (review finding 1; added to `allowed_paths` at the re-plan) | § 4.3 |
| `src/lib/data/system.ts` | modified | adds `SystemIssueReport`, `IssueFailureCode`, `IssueResult`, `ISSUE_FAILURE_MESSAGES`, the three `SystemSeam` methods, both implementations, and the test-only `__setMockIssueReports` | § 4.4 |
| `src/system/main.tsx` | modified | adds the `IssueReports` section (and its row component) to `OrgManagement`, after *National holidays*; exposes `window.__setMockIssueReports` on the mock build the way `src/main.tsx` exposes `window.__calechipMockSeam` | § 4.5 |
| `tests/e2e/mir-16-issue-reports.spec.ts` | created | one test per AC-7 to AC-11, plus one for the "Removed member" copy rule named in § 4.5 | § 4.6 |

No file outside this list was touched. `git diff --name-only` is exactly this list, a subset of `allowed_paths`.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 — migration | `supabase/migrations/20261107210000_mir16_issue_reports_system_scope.sql` | Written from the sibling pattern `20261106120000_mir15b_org_public_holidays.sql` already uses for its RPCs. `limit 500` is in the query, commented as `ISSUE_REPORT_LIMIT`, matching the design's own pseudocomment. |
| 4.2 — pgTAP | `supabase/tests/270-issue-reports-system-scope.test.sql` (`plan(31)`, unchanged) | One assertion or more per AC-1 to AC-6 as specified; AC-6 gets one throw per caller (Sam at aal1, Ada, Dora, Thanh) and per function, plus the two `anon` EXECUTE checks and the P0002 case. The four policy-existence assertions close the file. AC-4's order assertion now restricts to R-P and R-D (§ 4.2's addition at the re-plan; see Rework note above). |
| 4.3 — changed pgTAP | `supabase/tests/160-read-path-org-bound.test.sql:242-253`; `supabase/tests/010-catalogue.test.sql:72-74`; `supabase/tests/060-removed-and-pending.test.sql:72-78` (`plan(86)`) | `150-write-path-org-bound.test.sql:153` already asserts the write affects zero rows and needed no change (confirmed by reading it; it stays out of `allowed_paths` and was not touched). |
| 4.4 — panel seam | `src/lib/data/system.ts:38-45` (interface), `:188-225` (types), `:412-449` (supabase impl), `:665-688` (mock store + `__setMockIssueReports`), `:723-741` (mock methods) | Bucket name and TTL are literals (`"issue-report"`, `60 * 60`), as specified — the panel imports nothing from the member seam. |
| 4.5 — panel screen | `src/system/main.tsx` (`IssueReportRow`, `IssueReports`, rendered in `OrgManagement` after `<NationalHolidays />`) | Every test id in the design's table is present; copy is verbatim, including *Removed member* for a `null` author. |
| 4.6 — e2e | `tests/e2e/mir-16-issue-reports.spec.ts` | One test per AC-7 to AC-11, plus `AC-7b` for the *Removed member* copy case (part of § 4.5's copy list, not a numbered AC, so broken out rather than folded into AC-7's own assertions). |

## Deviations from the design

**§ 4.6's "AC-8 and AC-10 seed through `__setMockIssueReports` by a page init script."** The spec seeds by
calling `window.__setMockIssueReports` through `page.evaluate` immediately after `page.goto` and
before signing in — not through Playwright's `addInitScript`. `addInitScript` runs before any of the
document's own scripts, which is also before `src/system/main.tsx`'s module code has run and attached
`window.__setMockIssueReports` to `window` at all; calling it from an init script would need a second,
uncontracted global for the init script to hand a payload through (mirroring how
`adm-03-holiday-writes.spec.ts` seeds `calechip.mock.dedicatedOrgMembers` via `localStorage`, read once
at module load). Seeding via `page.evaluate` right after `page.goto` reaches the same place — strictly
before `IssueReports`'s mount effect, since sign-in is still several round trips away — using only the
one hook § 4.4 names, so RULE-04 is not stretched to cover a second invented name. Recorded here rather
than in a consultation: this is test wiring, not a contract field, and the two approaches are
behaviourally identical for every AC. The reviewer's R5 pass over § 4.6 (`04-review.md` row 53) found
this acceptable and did not re-open it.

No other deviation.

## Invariants

`invariants_touched: []` (`01-plan.md` § 2: *"An issue report is not an entry, carries no team, and no
invariant reads it."*). Confirmed unaffected: this ticket moves who may read and update
`public.issue_report` and its storage objects; it adds no table, column or constraint, and no existing
invariant's mechanism (INV-01 through INV-07, `.ai/standards/architecture.md` "Where invariants live")
names `issue_report` or `storage.objects` at all. The review's own R7 pass agreed (`04-review.md`
"R7 detail").

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | re-run after this pass's two SQL-only edits |
| `pnpm exec eslint .` | 0 | re-run after this pass's two SQL-only edits |
| `pnpm exec vitest run` | 0 | 51 files, 1027 tests, all pass — includes the seam-parity test, which now compares three new `SystemSeam` methods across both implementations |
| `pnpm exec playwright test` | not run | this environment has no browser/webServer available to the agent; the new spec is written against the established mock-build patterns (`mir-18-b-org-management.spec.ts`, `mir-14-b-worklist-teams.spec.ts`) and reviewed by hand against them |
| `pnpm db:test` (pgTAP) | not run | needs the local Supabase stack (`supabase start`), not available in this environment; the migration and both pgTAP edits this pass are written from the sibling pattern `20261106120000_mir15b_org_public_holidays.sql` / `200-org-management.test.sql` already use, and each file's own assertion count was re-checked against its `plan(n)` by grep after editing |
| `node scripts/check-allowed-paths.mjs` | 0 | `allowed-paths: PASS`, 16 changed files, all resolved against `ticket.yaml:16-27`'s current `allowed_paths` (post re-plan) |
| `node scripts/check-carry.mjs MIR-16` | 0 | `PASS — nothing stray`; 2 uncommitted paths this pass, both carried |
| `git diff --name-only` subset of `allowed_paths` | yes | this pass touched only `supabase/tests/060-removed-and-pending.test.sql` and `supabase/tests/270-issue-reports-system-scope.test.sql`, both in `ticket.yaml`'s current `allowed_paths` |

**On the two "not run" rows.** `ticket.yaml` sets `verification_required: false` for this phase, and
`.ai/standards/architecture.md` "Where authorization lives" already states the pattern this ticket
follows: a migration applies to a remote database only by a person (RULE-09), and the database tests
that exercise RLS need a running PostgreSQL this agent's environment does not have. Every sibling
migration and pgTAP file this ticket was written from (`20261106120000_mir15b_org_public_holidays.sql`,
`200-org-management.test.sql`, `190-system-admin.test.sql`) carries the identical header. The e2e
suite's `pnpm exec playwright test` command needs a browser binary and a dev server this environment
also does not provide; the new spec was written and re-read against two sibling specs that already
pass in CI for the same mock build. The review's own R5 note (`04-review.md` row 32) records the same
gap and that it is what let both findings through to review rather than to a local run.

## Testability contract

| selector | Exists at |
|----------|-----------|
| `system-issues` | `src/system/main.tsx:814` |
| `system-issues-open-count` (with `data-count`) | `src/system/main.tsx:817` |
| `system-issues-loading` | `src/system/main.tsx:787` |
| `system-issues-error` | `src/system/main.tsx:777` |
| `system-issues-retry` | `src/system/main.tsx:780` |
| `system-issues-empty` | `src/system/main.tsx:793` |
| `system-issue-row` (with `data-id`, `data-status`) | `src/system/main.tsx:651` |
| `system-issue-row-date` | `src/system/main.tsx:657` |
| `system-issue-row-org` | `src/system/main.tsx:660` |
| `system-issue-row-author` | `src/system/main.tsx:663` |
| `system-issue-row-kind` | `src/system/main.tsx:667` |
| `system-issue-row-page` | `src/system/main.tsx:672` |
| `system-issue-row-status` | `src/system/main.tsx:675` |
| `system-issue-row-message` | `src/system/main.tsx:687` |
| `system-issue-row-toggle` | `src/system/main.tsx:679` |
| `system-issue-row-error` | `src/system/main.tsx:710` (via `<OrgError testId="system-issue-row-error" .../>`) |
| `system-issue-row-image` | `src/system/main.tsx:697`, `:708` (minted and unavailable states) |

## Open questions

None that block. `.ai/standards/rbac-and-security.md`'s issue-report rows still need the human-only
standards edit `01-plan.md` § 1 names as out of scope for this ticket.

## Delegated decisions

None raised to `tech-lead-design` this pass — both fixes were fully specified by the re-plan
(`01-plan.md` § 4.3's new paragraph on `060`, § 4.2's new paragraph on the seed's third report) or
were the implementable half of a review finding the review itself (not this agent) routed and
pre-authorised (`04-review.md` Delegated decisions), so no `99-questions.md` was written.
