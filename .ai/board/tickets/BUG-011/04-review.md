---
ticket: BUG-011
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-17T09:10:30Z
inputs_read: [ .ai/board/tickets/BUG-011/01-plan.md, .ai/board/tickets/BUG-011/03-impl-log.md, .ai/board/tickets/BUG-011/ticket.yaml, .ai/registry/invariants.md, .ai/templates/review-report.md, .ai/01-operating-model.md, .ai/registry/decisions/ADR-101-a-defect-is-recorded-by-bug-and-fixed-by-the-loop-with-a-regression-test.md ]
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

Diff reviewed: `git diff origin/main...HEAD` (`origin/main` `b2af013`, `HEAD` `cac9840`, commits
`adc26d2`, `cac9840`). Working tree clean before and after (`git status --porcelain` empty;
`test-results/` is git-ignored). Every command below was run by this reviewer, one per call.

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed diff ⊆ `allowed_paths`; nothing stray uncommitted | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket BUG-011, 7 changed file(s)` / `allowed-paths: PASS`. Non-ticket, non-ship-owned paths in the diff: `tests/e2e/mir-19-d-flip.spec.ts`, `tests/e2e/mir-19-org-routing.spec.ts` — exactly `ticket.yaml` `allowed_paths`. `node scripts/check-carry.mjs BUG-011` → `0 uncommitted path(s)` / `PASS — nothing stray` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, no diagnostics; covers the new `.toMatch(RegExp)` calls at `tests/e2e/mir-19-d-flip.spec.ts:96` and `tests/e2e/mir-19-org-routing.spec.ts:49` |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm exec eslint tests/e2e/mir-19-d-flip.spec.ts tests/e2e/mir-19-org-routing.spec.ts` exit 0, no output; repo-wide `pnpm lint` (`eslint .`) also exit 0 — nothing outside the diff to report |
| R4 | No datastore access outside the seam (RULE-02) | PASS | No `src/**` path in the diff. Added statements are Playwright locator/URL reads only: `tests/e2e/mir-19-d-flip.spec.ts:91-96`, `tests/e2e/mir-19-org-routing.spec.ts:45-49`; neither imports `src/lib/data/` nor touches the mock seam |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches plan § 3 ("Nothing changes") | PASS | Both tests still sign in as `thanh@example.com` via unchanged helpers (`tests/e2e/mir-19-d-flip.spec.ts:13`, `tests/e2e/mir-19-org-routing.spec.ts:14`, `:26-29`); no route, guard or `.ai/standards/rbac-and-security.md` change in the diff. Member read right unchanged at `.ai/standards/rbac-and-security.md:18` |
| R7 | No invariant violated (RULE-07) | PASS | `ticket.yaml` `invariants_touched: []`; per-ID reasoning in R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD -- package.json pnpm-lock.yaml` is empty (0 lines); imports unchanged at `tests/e2e/mir-19-d-flip.spec.ts:1` and `tests/e2e/mir-19-org-routing.spec.ts:1` |
| R10 | Regression test fails on unfixed code, passes on the branch (ADR-101) | PASS | Both runs below, and the reading recorded under *Delegated decisions* |

### R10 runs

The regression criteria are plan § 2 AC-1 and AC-5 (test titles `AC-5: the flip adds no history entry`
and `AC-2: links inside the app keep the org`, command fixed by AC-5).

1. **Unfixed** — `git checkout origin/main -- tests/e2e/mir-19-d-flip.spec.ts tests/e2e/mir-19-org-routing.spec.ts`, then
   `pnpm exec playwright test tests/e2e/mir-19-d-flip.spec.ts:84 tests/e2e/mir-19-org-routing.spec.ts:39 --workers=4 --repeat-each=25 --retries=0 --reporter=line`
   → **exit 1, 13 failed, 38 passed** (51 incl. seam-guard setup). Failures: 6 × AC-2 at
   `mir-19-org-routing.spec.ts:45` (`Expected "/shared/year"`, `Received "/shared/year/2026"`);
   7 × AC-5, at `mir-19-d-flip.spec.ts:91` (same received value) and at `:95` (`month-grid` not found
   after `goBack()` — the second symptom plan § 1 names).
2. **Fixed** — `git checkout HEAD -- <the same two paths>`, then
   `pnpm exec playwright test tests/e2e/mir-19-d-flip.spec.ts:85 tests/e2e/mir-19-org-routing.spec.ts:40 --workers=4 --repeat-each=25 --retries=0 --reporter=line`
   → **exit 0, 51 passed** (50 test runs + setup). Line numbers shift by one because of the header lines
   at `tests/e2e/mir-19-d-flip.spec.ts:10` and `tests/e2e/mir-19-org-routing.spec.ts:11`.

`git status --porcelain` empty afterwards.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 — AC-5 test: href assertion, click, comment, `year-overview` wait, settled-address poll replacing `:90-91` | `tests/e2e/mir-19-d-flip.spec.ts:91-96`; `goBack()` and the two assertions after it unchanged at `:98-100` (AC-3) | Yes — character-identical to the plan block. Old `toBe("/shared/year")` removed (AC-1 last clause). Regex `/^\/shared\/year\/\d{4}$/`, no computed year (AC-4) |
| § 4.1 — header line | `tests/e2e/mir-19-d-flip.spec.ts:10` | Yes, identical |
| § 4.2 — AC-2 test: href assertion, click, comment, `year-overview` wait, settled-address poll replacing `:44-45` | `tests/e2e/mir-19-org-routing.spec.ts:45-49`; logo click and `/shared` poll unchanged at `:51-52` | Yes — character-identical to the plan block |
| § 4.2 — header line | `tests/e2e/mir-19-org-routing.spec.ts:11` | Yes, identical |
| § 4.3 — stop if `href` is not exactly `/shared/year` | not triggered: the assertion at `tests/e2e/mir-19-d-flip.spec.ts:91` and `tests/e2e/mir-19-org-routing.spec.ts:45` passed in all 50 fixed runs above | n/a — conditional path not taken |

AC-3: both diff hunks are confined to the header and the two named tests; titles unchanged
(`tests/e2e/mir-19-d-flip.spec.ts:85`, `tests/e2e/mir-19-org-routing.spec.ts:40`). A grep for
`waitForTimeout|fixme|skip|timeout` in both files returns nothing. AC-6: the diff touches no `src/**`
path. Test ids used exist: `home-year-link` at `src/components/Sidebar.tsx:536`, `year-overview` at
`src/routes/YearOverview.tsx:332`; the redirect the tests now wait past is
`src/routes/YearOverview.tsx:254`.

## R7 detail

`invariants_touched: []` (`.ai/board/tickets/BUG-011/ticket.yaml`). The ledger holds INV-01–INV-07
(`.ai/registry/invariants.md:33-39`). The diff is two e2e spec files, lines
`tests/e2e/mir-19-d-flip.spec.ts:10,91-96` and `tests/e2e/mir-19-org-routing.spec.ts:11,45-49`; no
product code changes, so each invariant is held by code this ticket does not touch.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no overlapping portions per member | Unchanged entry-write code; the diff creates or edits no entry | `.ai/registry/invariants.md:33`; diff ranges above, no `src/**` path |
| INV-02 — approved entry returns to pending on edit | Unchanged; no entry edit in the diff | `.ai/registry/invariants.md:34`; diff ranges above |
| INV-03 — rejection carries a reason | Unchanged; no approval/rejection action in the diff | `.ai/registry/invariants.md:35`; diff ranges above |
| INV-04 — single definition of the absence count | Unchanged; nothing computes or reads a count — the tests read only `pathname` and test-id visibility | `.ai/registry/invariants.md:36`; `tests/e2e/mir-19-d-flip.spec.ts:94-96`, `tests/e2e/mir-19-org-routing.spec.ts:48-49` |
| INV-05 — tentative counts like non-tentative | Unchanged; no count or tentative flag touched | `.ai/registry/invariants.md:37`; diff ranges above |
| INV-06 — one portion per entry, over its whole range | Unchanged; no entry shape touched | `.ai/registry/invariants.md:38`; diff ranges above |
| INV-07 — every entry belongs to one member, counted on every team | Unchanged; no membership or team read/write in the diff | `.ai/registry/invariants.md:39`; diff ranges above |

## Delegated decisions

ADR-067. **R10 on a defect that lives in the test itself.** The operating-model procedure restores
"the diff's non-test paths" from `origin/main`. This diff has none — the defect and the fix are both in
the two spec files, and plan § 1 puts `src/**` out of scope. Read literally, R10 would restore nothing,
run the fixed test against identical product code, and see it pass, which is not a test of anything.
Taken: the "unfixed code" for a test-only defect is the `origin/main` version of the changed test files,
which is exactly the before/after measurement plan § 2 AC-5 specifies. Judged against that reading;
both runs are cited above. Recommended for the steward: state this case in ADR-101 § 7 or the R10 text
so the next test-only `BUG-nnn` reviewer does not have to delegate it again.

## Findings

None.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

`PASS`. BUG-011 advances to DONE.
