---
ticket: BUG-009
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-17T04:04:13Z
inputs_read: [ .ai/board/tickets/BUG-009/00-bug-report.md, .ai/board/tickets/BUG-009/01-plan.md, .ai/board/tickets/BUG-009/03-impl-log.md, .ai/board/tickets/BUG-009/ticket.yaml, .ai/registry/invariants.md, .ai/registry/decisions/ADR-101-a-defect-is-recorded-by-bug-and-fixed-by-the-loop-with-a-regression-test.md, "git diff origin/main...HEAD", tests/e2e/uie-09-admin-hub.spec.ts, src/routes/Holidays.tsx, src/App.tsx, playwright.config.ts, tsconfig.json ]
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
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs` → `allowed-paths: ticket BUG-009, 6 changed file(s)` / `allowed_paths: tests/e2e/uie-09-admin-hub.spec.ts` / `allowed-paths: PASS`. The only non-exempt path is `tests/e2e/uie-09-admin-hub.spec.ts`, the single entry at `.ai/board/tickets/BUG-009/ticket.yaml:18`. `node scripts/check-carry.mjs BUG-009` → `0 uncommitted path(s)` / `PASS — nothing stray`; nothing carried. |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` (`tsc --noEmit`) exit 0, run by the reviewer. `tsconfig.json:19` includes `tests`, so the changed spec is in the program. |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` (`eslint .`) exit 0, repo-wide, run by the reviewer. Covers `tests/e2e/uie-09-admin-hub.spec.ts`. Nothing reported outside the diff. |
| R4 | No datastore access outside the seam (RULE-02) | PASS | The diff touches no `src/**` file (`git diff origin/main...HEAD --name-only -- src` is empty). The spec's only imports are `tests/e2e/uie-09-admin-hub.spec.ts:1` (`@playwright/test`) and `:2` (`./support/org-prefix`), and neither changed. The added lines `:59-60`, `:103-104` and `:262-265` reach no datastore. |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail. |
| R6 | Permission gating matches § 3 ("Unchanged") | PASS | AC-4 still signs in as admin through `openHubAsAdmin` at `tests/e2e/uie-09-admin-hub.spec.ts:253`. The diff has three hunks, at `:56-60`, `:100-104` and `:254-266`, and none of them touches AC-2, AC-6 or AC-7. No route or guard changed: `src/App.tsx:624-629` and `src/routes/Holidays.tsx:223` are identical to `origin/main`. |
| R7 | No invariant violated | PASS | See R7 detail. `invariants_touched: []` at `.ai/board/tickets/BUG-009/ticket.yaml:16`. |
| R8 | No dependency added without an ADR | PASS | `git diff origin/main...HEAD --name-only -- package.json pnpm-lock.yaml` is empty. The spec's import list at `tests/e2e/uie-09-admin-hub.spec.ts:1-2` is unchanged. |
| R10 | Regression test passes, and fails before the fix | PASS | Three runs, all by the reviewer, with the test named in `01-plan.md` § 2 AC-5. See R10 detail and *Delegated decisions*. |

## R5 detail

| Contract item (`01-plan.md` § 4) | Implemented at | Matches signature |
|---|---|---|
| `settledPath?: RegExp` added to the `DESTINATIONS` element type, with its doc comment | `tests/e2e/uie-09-admin-hub.spec.ts:59-60` | Yes. Optional, `RegExp`, the only new name. |
| Holidays entry: `path: "/holidays"` unchanged, `landmarks: ["holidays-year"]`, `settledPath: /\/holidays\/\d{4}$/`, comment citing ADM-02 AC-9 and BUG-009 | `tests/e2e/uie-09-admin-hub.spec.ts:100-105` | Yes. The regex is character-identical to § 4. |
| The six other entries carry no `settledPath` (AC-2) | `tests/e2e/uie-09-admin-hub.spec.ts:62-93`, `:106-110` | Yes |
| Loop body order: click, then landmark visible, then `toHaveURL(destination.settledPath ?? new RegExp(\`${destination.path}$\`))` (AC-1, AC-3) | `tests/e2e/uie-09-admin-hub.spec.ts:256`, `:260`, `:265` | Yes. The old URL-first line is removed, and the comment at `:262-264` names BUG-009 and the order. |
| Return leg unchanged | `tests/e2e/uie-09-admin-hub.spec.ts:274-276` | Yes. Not in the diff. |
| AC-4: the link still points at `/holidays` | `tests/e2e/uie-09-admin-hub.spec.ts:231`, `:236`, `:245` compare against `d.path`, which is still `/holidays` at `:101` | Yes |

## R7 detail

`invariants_touched` is `[]` (`.ai/board/tickets/BUG-009/ticket.yaml:16`). An empty list leaves no ID to reason through one by one. The check is therefore whether the empty list is true. Each registered invariant was considered against the diff:

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | Not engaged: no entry write path in the diff | `.ai/registry/invariants.md:33`. The diff touches no `src/**` file. |
| INV-02 approval does not survive an edit | Not engaged: no edit path in the diff | `.ai/registry/invariants.md:34`, same evidence |
| INV-03 a rejection carries a reason | Not engaged | `.ai/registry/invariants.md:35`, same evidence |
| INV-04 one definition of the absence count | Not engaged: no count is computed or asserted in the changed lines | `.ai/registry/invariants.md:36`. The changed lines are `tests/e2e/uie-09-admin-hub.spec.ts:59-60`, `:103-104` and `:262-265`. |
| INV-05 tentative still counts | Not engaged | `.ai/registry/invariants.md:37`, same evidence |
| INV-06 one portion per entry | Not engaged | `.ai/registry/invariants.md:38`, same evidence |
| INV-07 one member, every team | Not engaged | `.ai/registry/invariants.md:39`, same evidence |

The change asserts a URL in an end-to-end test and changes no product behaviour. The redirect it now asserts is `src/routes/Holidays.tsx:223`, which is unchanged.

## R10 detail

All three runs used `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`, `-g "AC-4: each destination"`, Chromium, and the repository's `vite build && vite preview` web server with `VITE_DATA_SEAM: "mock"`.

| Run | Subject | Command | Exit | Result |
|---|---|---|---|---|
| A, after the fix | `HEAD` spec, in tree | `CI=1 pnpm exec playwright test tests/e2e/uie-09-admin-hub.spec.ts -g "AC-4: each destination" --repeat-each=30 --workers=2 --reporter=line` | 0 | `31 passed (32.2s)`: 30 AC-4 runs plus the seam-guard setup, 0 flaky. Under `CI=1` the config allows one retry, and none was used. |
| B, before the fix, verbatim | `origin/main:tests/e2e/uie-09-admin-hub.spec.ts`, copied out of tree with only its two import specifiers made absolute, `retries: 0` | `pnpm exec playwright test --config <scratch>/pre/pw.config.ts -g "AC-4: each destination" --repeat-each=60 --workers=4 --reporter=json` | 1 | 7 of 60 failed, 53 passed. Every failure was at pre-fix `:253` with `Expected pattern: /\/holidays$/`, `Received string: "http://localhost:4173/shared/holidays/2026"`. This is the defect as reported. |
| C, before the fix, deterministic form (§ 2 AC-5) | `HEAD` spec with only `settledPath` set back to `/\/holidays$/`, out of tree, `retries: 0` | `pnpm exec playwright test --config <scratch>/det/pw.config.ts -g "AC-4: each destination" --repeat-each=30 --workers=2 --reporter=json` | 1 | 30 of 30 failed at `:265`, all with the same expected and received values as run B. |

`<scratch>` is `/tmp/claude-0/-home-user/95c73810-1bfe-5c7f-86e0-6efdcc6e5205/scratchpad/r10`.

`git status --porcelain` was empty before and after every run. No tracked file was modified.

These runs match the Developer's record at `03-impl-log.md` § *Regression test* (30/30 fail, then 30/30 pass), and they add run B, the verbatim `origin/main` ordering, which the Developer did not run.

## Delegated decisions

ADR-067. The verdict depended on the following decision, so it was taken here and judged against.

**How R10's "fails with the diff's non-test paths restored from `origin/main`" applies when the defect is in the test itself.** The diff's only code path is `tests/e2e/uie-09-admin-hub.spec.ts`, which is a test, so it has no non-test paths. Applied literally, the "restored" tree is `HEAD`, and the test passes on it (run A). Read that way, R10 would fail every fix whose defect lives in a test, and would route the failure to `developer` with an increment that RULE-08 forbids for a defect the Developer did not cause and cannot fix.

**Decision taken:** when the diff has no non-test paths, the "unfixed code" is the test file as it is on `origin/main`. R10 passes when that version fails and the branch version passes. Run B shows the first and run A shows the second. Run C is the plan's own deterministic form, added as corroboration.

The in-tree `git checkout origin/main -- tests/e2e/uie-09-admin-hub.spec.ts` was refused by the session's permission layer. Runs B and C were therefore executed from out-of-tree copies, so the working tree was never altered.

**For the steward, not this ticket:** `.ai/01-operating-model.md` § *Review checklist*, the R10 paragraph, and ADR-101 decision 7 do not cover a test-only defect. The rule above, or an equivalent, belongs in that text. This is a model gap and does not fail BUG-009.

## Findings

None.

## Verdict

PASS. BUG-009 advances to DONE.
