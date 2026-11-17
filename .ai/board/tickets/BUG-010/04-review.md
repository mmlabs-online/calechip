---
ticket: BUG-010
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-17T04:23:01+00:00
inputs_read: [ .ai/board/tickets/BUG-010/01-plan.md, .ai/board/tickets/BUG-010/03-impl-log.md, .ai/board/tickets/BUG-010/ticket.yaml, .ai/board/tickets/BUG-010/00-bug-report.md, .ai/templates/review-report.md, .ai/01-operating-model.md, .ai/registry/invariants.md, .ai/registry/decisions/ADR-101-a-defect-is-recorded-by-bug-and-fixed-by-the-loop-with-a-regression-test.md, "git diff origin/main...HEAD", tests/e2e/evt-07-guest-registration.spec.ts, src/App.tsx, src/routes/SignIn.tsx, playwright.config.ts ]
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
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs`: "ticket BUG-010, 6 changed file(s) / allowed_paths: tests/e2e/evt-07-guest-registration.spec.ts / allowed-paths: PASS" (exit 0). `node scripts/check-carry.mjs BUG-010`: "0 uncommitted path(s) / PASS — nothing stray" (exit 0). The only non-exempt path is `tests/e2e/evt-07-guest-registration.spec.ts:124-127,172-174`, allowed by `ticket.yaml:15-16` |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` → `tsc --noEmit`, exit 0, no diagnostics. `tsconfig.json:19` includes `tests`, so the changed spec is in the program |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` → `eslint .`, exit 0, no output. Repo-wide, so it covers the spec; `eslint.config.js:51` ignores only `dist`, `node_modules`, `_figma`, `coverage` |
| R4 | Nothing outside the seam reaches the datastore | PASS | The diff adds only `expect(page.getByTestId("sign-in-submit")).toBeVisible()` at `tests/e2e/evt-07-guest-registration.spec.ts:127` and `:174`, a DOM read through Playwright. No import is added (`:1` unchanged); no `src/lib/data` or datastore reference exists in the spec |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail |
| R6 | Permission gating matches § 3 | PASS | § 3: no change. Both tests still sign out before the guest steps (`tests/e2e/evt-07-guest-registration.spec.ts:108`, `:158`), and the added wait reads the signed-out sign-in screen `src/App.tsx:805` → `src/routes/SignIn.tsx:124`, which every signed-out caller sees. No role, route or guard line is in the diff |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:14`), reasoned in `01-plan.md` § 2. Per-ID reasoning in R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. The insertion uses `expect`, already imported at `tests/e2e/evt-07-guest-registration.spec.ts:1` |
| R10 | Regression test fails before, passes after | PASS | Command (plan AC-R): `pnpm exec playwright test tests/e2e/evt-07-guest-registration.spec.ts -g "AC-1, AC-3, AC-11\|AC-4, AC-5:" --repeat-each=30 --workers=2 --retries=0`. **After (HEAD):** exit 0, "61 passed (49.6s)" — 60 of 60 plus the seam setup; a second HEAD run of the same command, "61 passed (51.4s)". **Before (spec as on `origin/main`):** exit 1, "4 failed, 57 passed (1.1m)", no throttle. Three failures are `expect(getByTestId('guest-register-name')).toBeVisible()` "element(s) not found" at baseline `:125`; one is `locator.fill: Test timeout of 30000ms exceeded … waiting for getByTestId('guest-register-name')` at baseline `:169`. Both are the failing lines `01-plan.md` § 2 AC-R names and § 1 predicts. `git status --porcelain` empty before and after. How the before-run was made: *Delegated decisions* |

AC-4 of the plan, spec alone: covered by the two HEAD runs above for the two named tests; the impl-log's single full-spec run (6 passed) and full-suite run (549 passed, 2 failed in `tsk-01-tasks.spec.ts:279` and `tsk-02-overdue-prompt.spec.ts:109`, neither in the diff) were not re-run here and are not gate items.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 AC-1 test insertion, between `navigate(page, "/")` and `navigate(page, address)` | `tests/e2e/evt-07-guest-registration.spec.ts:124-127` (between `:123` and `:128`) | Yes — three comment lines and the wait, character for character as § 4.1 |
| § 4.1 AC-4 test insertion, same position | `tests/e2e/evt-07-guest-registration.spec.ts:172-174` (between `:171` and `:175`) | Yes — two comment lines and the wait, as § 4.1 |
| § 4.1 "every existing line unchanged", AC-3 "only added lines" | `git diff origin/main...HEAD -- tests/e2e/evt-07-guest-registration.spec.ts`: two hunks, 7 `+` lines, 0 `-` lines; titles at `:100` and `:153` unchanged | Yes |
| § 4.2 throttle, § 4.3 probe — never committed | Absent: no `newCDPSession`, `setCPUThrottlingRate` or second `pushState` in the HEAD spec beyond the helper at `:71-76` | Yes |

## R7 detail

`invariants_touched` is `[]`. Each registry invariant was checked against a diff that adds two Playwright waits to one e2e spec and touches no file under `src/`.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 overlap | Unchanged seam and domain code; the diff writes no entry | `.ai/registry/invariants.md:33`; diff limited to `tests/e2e/evt-07-guest-registration.spec.ts:124-127,172-174` |
| INV-02 approval reset on edit | No entry is edited by anything in the diff | `.ai/registry/invariants.md:34`; same diff lines |
| INV-03 rejection reason | No rejection path touched | `.ai/registry/invariants.md:35`; same diff lines |
| INV-04 absence count | No count computed or read; the spec drives guests and events only | `.ai/registry/invariants.md:36`; same diff lines |
| INV-05 tentative counts | No entry or count touched | `.ai/registry/invariants.md:37`; same diff lines |
| INV-06 one portion | No entry written | `.ai/registry/invariants.md:38`; same diff lines |
| INV-07 one member, every team | No membership or entry written | `.ai/registry/invariants.md:39`; same diff lines |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

None.

## Delegated decisions

- **How R10 applies to a test-only diff.** The diff has no non-test path, so restoring "the diff's
  non-test paths from `origin/main`" restores nothing. I took the reading `01-plan.md` § 2 AC-R
  states, and BUG-008 shipped under: the before-run is the `origin/main` version of the spec against
  the same app.
- **Where the before-run was made.** `git checkout origin/main -- tests/e2e/evt-07-guest-registration.spec.ts`
  was refused by the harness's permission classifier. Rather than touch the tree another way, the
  baseline spec was written from `git show origin/main:tests/e2e/evt-07-guest-registration.spec.ts`
  into the session scratchpad, beside a copy of `tests/e2e/seam.setup.ts`, and run with a config
  that imports `playwright.config.ts` and overrides only `testDir` and `webServer.cwd`
  (`/home/user/calechip`). The served app, the seam guard, the command's filters, workers, repeats
  and retries are the same as the HEAD run; only the spec text differs, by exactly the 7 lines of the
  diff (`git diff --no-index --stat`: 7 insertions). The working tree was never modified.
- **The impl-log's "not reproduced" does not bind R10.** `03-impl-log.md` § *Regression test*
  records 0 failures in two baseline runs; on this machine the unthrottled baseline failed 4 of 60.
  R10 is decided by the reviewer's own runs, and those show the test failing before and passing
  after.

## Verdict

`PASS`. BUG-010 advances to DONE.
