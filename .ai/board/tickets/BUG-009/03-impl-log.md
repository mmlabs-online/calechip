---
ticket: BUG-009
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-17T03:47:00Z
inputs_read: [ .ai/board/tickets/BUG-009/01-plan.md, .ai/board/tickets/BUG-009/ticket.yaml ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `tests/e2e/uie-09-admin-hub.spec.ts` | modified | Added optional `settledPath` to `DESTINATIONS`, set it for the holidays row, and reordered AC-4 so the landmark is asserted before the URL, which uses `settledPath ?? path$` | §4 (type field, holidays entry, loop body), AC-1, AC-2, AC-3 |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| `settledPath?: RegExp` on the element type | `tests/e2e/uie-09-admin-hub.spec.ts:59-60` | Only new name, as the contract says |
| holidays entry `settledPath: /\/holidays\/\d{4}$/` | `tests/e2e/uie-09-admin-hub.spec.ts:103-104` | `path` stays `/holidays` (AC-4); six other entries untouched (AC-2) |
| click, landmark visible, then URL | `tests/e2e/uie-09-admin-hub.spec.ts:255-266` | Comment names BUG-009 and the order; return leg unchanged |

## Deviations from the design

none

## Invariants

`invariants_touched` is `[]`. A test-only edit reads and writes no domain rule.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `git diff --name-only` subset of `allowed_paths` | yes | only `tests/e2e/uie-09-admin-hub.spec.ts` |

Unit tests were not run (test-only change to one e2e spec). Playwright runs are in the section below.

## Regression test

Run with Chromium from `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers`. The plan's `:248` line filter no
longer matches after the edit shifted the test to line 252, so `-g "AC-4: each destination"` selects the
same test. Each run reports "N+1 passed" because the auth setup project counts as one.

| Run | Command | Exit | Failing assertion or result |
|-----|---------|------|-----------------------------|
| before the fix (landmark first, `settledPath` temporarily `/\/holidays$/`) | `CI=1 pnpm exec playwright test tests/e2e/uie-09-admin-hub.spec.ts -g "AC-4: each destination" --repeat-each=30 --workers=2 --reporter=line` | 1 | 30 failed of 30 (setup passed): `expect(page).toHaveURL(expected) failed`, Expected pattern `/\/holidays$/`, Received `http://localhost:4173/shared/holidays/2026` |
| after the fix (`settledPath: /\/holidays\/\d{4}$/`) | same command | 0 | 30 of 30 passed (31 passed including setup, 32.0s) |

The before run was done by temporarily reverting only the `settledPath` value, then restoring it. The
final file holds the fixed value. This matches the plan's deterministic form. The original
`origin/main` ordering (URL before landmark) was not run.

## Testability contract

No selector is added or renamed. Existing ids used: `admin-hub-holidays-link`, `holidays-year`,
`shell-admin-link`, `admin-hub`.

## Open questions

- `01-plan.md` § 2 AC-5 says the record goes in `02-impl-log.md`; the command and template name
  `03-impl-log.md`, which is what this file is.
- The plan's `:248` line filter is stale after the edit (test is now at line 252); use `-g`.
