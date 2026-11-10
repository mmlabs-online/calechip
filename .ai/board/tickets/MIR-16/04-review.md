---
ticket: MIR-16
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-07T08:48:00Z   # second pass, after the re-plan of 08:41:16Z and /implement of 08:46:00Z. First pass (FAIL R5) is at this path in git history
inputs_read: [ .ai/board/tickets/MIR-16/01-plan.md, .ai/board/tickets/MIR-16/03-impl-log.md, .ai/board/tickets/MIR-16/ticket.yaml, .ai/registry/invariants.md ]
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
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket MIR-16, 17 changed file(s)` … `allowed-paths: PASS`. The non-exempt paths of `git diff --name-only origin/main...HEAD` (ADR-082, MIR-16-b/-c/MIR-17 `ticket.yaml`, the migration, 010/060/160/270 pgTAP, `src/lib/data/system.ts`, `src/system/main.tsx`, the e2e spec) are each listed at `ticket.yaml:17-28`; `.ai/board/backlog.md` is ship-owned. `node scripts/check-carry.mjs MIR-16` → `0 uncommitted path(s)`, `PASS — nothing stray` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no diagnostics |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`) exit 0, no output — covers `src/lib/data/system.ts`, `src/system/main.tsx`, `tests/e2e/mir-16-issue-reports.spec.ts`. No out-of-diff errors to route |
| R4 | Nothing outside the data-access seam reaches the datastore | PASS | `src/system/main.tsx:734`, `:745`, `:763` call only `systemSeam.*`; `src/system/main.tsx` has zero `supabase` occurrences. The client is used only inside the seam, `src/lib/data/system.ts:410`, `:424`, `:435` (import at `:14`). Enforced by `eslint.config.js:69` (`@supabase/*` restricted outside the seam), and lint passes |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail. Both first-pass findings are closed: `supabase/tests/060-removed-and-pending.test.sql:76-78` drops `issue_report` from `admin_t`'s control with `plan(86)` at `:6`; `supabase/tests/270-issue-reports-system-scope.test.sql:139-146` restricts the AC-4 ordering to R-P and R-D |
| R6 | Permission gating matches § 3 | PASS | Both RPCs refuse first unless `is_system_admin()`: migration `20261107210000_mir16_issue_reports_system_scope.sql:70-72`, `:88-90`; `is_system_admin()` requires `aal2` (`20261104150000_mir18_system_admin.sql:52`). Org-admin table read/update and image read removed: migration `:34-36`. Image read for system admin only: `:44-46`. `anon` revoked, `authenticated` granted: `:103-106`. Insert path untouched (no `issue_report_insert_own` line in the migration). Panel mock gate `src/lib/data/system.ts:875`, `:884` |
| R7 | No invariant violated | PASS | `ticket.yaml:15` `invariants_touched: []`; confirmed against `.ai/registry/invariants.md:33-39` — see R7 detail |
| R8 | No dependency added without an ADR | PASS | `package.json` is absent from `git diff --name-only origin/main...HEAD`. The new `date-fns` import (`src/system/main.tsx:10`) is an existing dependency (`package.json:27`) |

Also run: `pnpm test` exit 0 (51 files, 1027 tests). `pnpm db:test` and Playwright were not run here or by the Developer (`03-impl-log.md:118-119`); neither is an R-check, and `ticket.yaml:45` sets `verification_required: false`. The pgTAP and e2e files were read against their fixtures by hand instead (R5 detail).

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 drop three policies | `supabase/migrations/20261107210000_mir16_issue_reports_system_scope.sql:34-36` | yes |
| § 4.1 `issue_image_select_system`, idempotent | migration `:43-46` | yes |
| § 4.1 `list_issue_reports()`: plpgsql, stable, definer, `search_path=''`, 42501 guard first, 11 columns, left join member, join org, `created_at desc, id desc`, limit 500 | migration `:54-82` | yes |
| § 4.1 `set_issue_report_status(uuid, issue_status)`: volatile, guard, update, P0002 on not found | migration `:84-96` | yes |
| § 4.1 grants; `begin … commit` | migration `:103-106`; `:28`, `:108` | yes |
| § 4.2 fixture: Org D/D1, Dora and Dan via `put_on_team` without `team_id`, Sam, R-P, R-D with image and storage row | `supabase/tests/270-issue-reports-system-scope.test.sql:59-82`. `org_id` omitted on insert is stamped from the author by `stamp_org_id` (`20261107180000_mir21f_drop_member_team_id.sql:205-206`) | yes |
| § 4.2 AC-1, AC-2, AC-3 | 270 `:93-96`, `:102-118`, `:123-128` | yes |
| § 4.2 AC-4, ordering restricted to R-P and R-D (re-plan) plus field checks | 270 `:139-146`, `:147-172` | yes. Seed author `member_t` has display name `member_t` (`_isolation.psql:121-122`), matching `:167` |
| § 4.2 AC-5 | 270 `:178-193` | yes |
| § 4.2 AC-6: four callers × two functions, R-P stays open, P0002, two `anon` checks | 270 `:198-224`, `:227`, `:231-233`, `:236-239` | yes |
| § 4.2 policy census | 270 `:244-263` | yes. `plan(31)` at `:28` equals the 31 assertions counted |
| § 4.3 160 changes, `plan(n)` unchanged | `supabase/tests/160-read-path-org-bound.test.sql:242-243`, `:249-253` (one-for-one replacement) | yes |
| § 4.3 060: `issue_report` out of `admin_t` control, `plan(86)`, `:17` kept | `supabase/tests/060-removed-and-pending.test.sql:6`, `:76-78`, `:17` | yes. `reads_something` emits one assertion per array element (`:64-66`), so −1 element is −1 assertion |
| § 4.3 010 definer census | `supabase/tests/010-catalogue.test.sql:72-74` | yes. No pgTAP file outside 270 names the three dropped policies (grep of `supabase/tests` for `issue_image`/`issue_report_*_admin`) |
| § 4.3 150 unchanged | not in the diff; `150-write-path-org-bound.test.sql:153`, `:186` still assert 0 rows / `open` | yes |
| § 4.4 `SystemSeam` three methods | `src/lib/data/system.ts:60`, `:62`, `:65` | yes |
| § 4.4 types, failure codes, messages | `src/lib/data/system.ts:167`, `:181`, `:186`, `:190` | yes, verbatim |
| § 4.4 Supabase impl, limit refusal, literals | `src/lib/data/system.ts:408-442` (`:415` limit, `:435` `"issue-report"`, `60 * 60`) | yes |
| § 4.4 mock store from `FIXTURE_ISSUE_REPORT`, `mockMaySeeOrgs` gate, `issue_not_found`, null URLs, `__setMockIssueReports` | `src/lib/data/system.ts:704-727`, `:874-893`. `memberName` from `FIXTURE_MEMBER`, the member `FIXTURE_ISSUE_REPORT.memberId` names (`src/lib/fixtures.ts:589`) | yes |
| § 4.5 `IssueReports` after *National holidays*; load on mount, reload after success, mint per load | `src/system/main.tsx:974-976`; `:730-753` (mount effect `:753`), `:768` | yes |
| § 4.5 test ids | `src/system/main.tsx:651-708`, `:777-817` | yes, every id in the table |
| § 4.5 copy incl. *Removed member* | `src/system/main.tsx:633-634`, `:664`, `:684`, `:711`, `:781`, `:788`, `:794`, `:816`, `:818` | yes |
| § 4.6 e2e, one test per AC-7 to AC-11, sign-in as mir-18-b, AC-11 route rewrite | `tests/e2e/mir-16-issue-reports.spec.ts:134`, `:170`, `:178`, `:196`, `:212`; `:95-102`; `:113-132`. The supabase impl is constant-folded out of a mock build (`src/lib/data/system.ts:897`, `:901`), so the one-match expectation at `:123` holds | yes. Seeding by `page.evaluate` instead of an init script is the recorded deviation (`03-impl-log.md:86-98`); it uses only the hook § 4.4 names |

## R7 detail

| Invariant | Held by | Citation |
|---|---|---|
| *(none: `invariants_touched: []`)* | n/a — every registered invariant, INV-01 to INV-07, is a property of `entry` rows or the absence count over them (`.ai/registry/invariants.md:33-39`). The diff's only schema change touches `public.issue_report` policies, one `storage.objects` policy and two new functions that read/update `issue_report` alone; no `entry`, `membership` or count function is created, replaced or dropped | `ticket.yaml:15`; `01-plan.md:151-152`; migration `:34-106` |

## Findings

None.

## Verdict

`PASS`. R1 to R8 all hold.
