---
ticket: BUG-008
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-17T03:38:56+00:00
inputs_read: [ .ai/board/tickets/BUG-008/01-plan.md, .ai/board/tickets/BUG-008/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `tests/e2e/uie-10-sidebar.spec.ts` | modified | `returnToCalendar` decides from the URL path and waits with `toHaveURL`; two module constants added | § 4.1 |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 helper + `SETTLED_WEEK` | `tests/e2e/uie-10-sidebar.spec.ts:145-166` | no `count()`; dated BUG-008 paragraph with "Until 2026-11-17" quote |
| 4.2 throttle | not applied | see Open questions |

## Deviations from the design

One, found by the regression run. § 4.1 tests `pathname !== "/week"`. The app now prefixes the org
segment (MIR-19, `src/lib/org-path.ts`), so the fixture's addresses are `/shared/week` and
`/shared/week/<date>`. The literal comparison sent the pre-redirect `/shared/week` down the click
branch and reproduced the same timeout (4 of 25 failed after the first edit). Replaced the literal by a
second constant `BARE_WEEK = /^(\/[^/]+)?\/week$/`. The principle in § 4.1 is unchanged: path-only
decision, no existence check, auto-retrying wait. `SETTLED_WEEK` was already unanchored at the start and
matched the prefixed form. Not consulted: it is one regex and inside the plan's stated intent.

## Invariants

`invariants_touched: []`. Only a test helper's control flow changed; no entry, member, team or count is read or written.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | not run | no unit-testable code touched (one e2e spec file) |
| `pnpm exec playwright test tests/e2e/uie-10-sidebar.spec.ts --retries=0` | 0 | 13 passed |
| `pnpm exec playwright test --retries=0` (full) | 1 | 548 passed, 3 failed: `adm-04-worklist` AC-11, `evt-09-create-invitation` AC-6 and `mir-14-b-worklist-teams` AC-13. None is in this spec; recorded, not fixed (§ 1) |
| `git diff --name-only` subset of `allowed_paths` | yes | only the spec file |

## Regression test

Command: `pnpm exec playwright test tests/e2e/uie-10-sidebar.spec.ts -g "AC-3: every address" --repeat-each=24 --workers=2 --retries=0`
(the runner reports 25 tests for 24 repeats; counts are quoted as reported).

| Run | Command | Exit | Failing assertion or result |
|-----|---------|------|-----------------------------|
| before the fix (origin/main helper) | as above | 1 | 12 failed, 13 passed. `locator.click: Test timeout of 30000ms exceeded. - waiting for getByTestId('shell-week')` at the helper's `click()`. An earlier identical run showed 10 passed with the rest failing |
| after the first edit (literal `/week`) | as above | 1 | 4 failed, 21 passed, same click timeout: the org prefix defeated the literal (see Deviations) |
| after the fix | as above | 0 | 25 passed, 0 failed |

## Testability contract

No selector is introduced. `shell-week` and `shell-admin-link` are read as they already exist.

## Open questions

- The § 4.2 CPU throttle was not used: the failure reproduced at 12 of 25 without it, so AC-3's
  throttled measurement adds nothing. The committed spec contains no throttle line.
- The three red tests in the full suite are separate defects and should each be recorded as a BUG.
