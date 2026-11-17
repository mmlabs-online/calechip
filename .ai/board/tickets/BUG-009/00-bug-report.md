---
ticket: BUG-009
stage: TRIAGE
agent: orchestrator
produced_at: 2026-11-16T15:26:04Z
inputs_read:
  - tests/e2e/uie-09-admin-hub.spec.ts
  - .ai/board/tickets/UIE-09/01-plan.md
  - .ai/registry/features.md
  - review and impl-log records cited under Actual
consulted: []
gate: PASS
blocking_reason: ""
next_state: BACKLOG
severity: S3
found_in: "local full-suite Playwright runs at 2 workers during MIR-04 … MIR-19-f reviews; origin/main 453e3b6 and later"
introduced_in: "unknown — `git log -S` on `admin-hub-holidays-link`, the `:253` regex and the `Navigate` line all end at the squashed `41b0a1e`; the spec attributes the holidays destination to SOLO 2026-09-12 (no ticket)"
root_cause: suspected
batch: ops/record-bug-006
regression_of: ""
---

# BUG-009 — UIE-09 AC-4 e2e test fails intermittently: it asserts /holidays, which the page redirects to /holidays/<year> at once

## Report

Operator, 2026-11-16, choosing the next step after the MIR tickets: "File the flaky e2e as BUGs (Recommended)", the option worded "Use the new /bug command to record the flaky tests seen on every PR (tsk-01:279, tsk-02:109, uie-10:208, uie-09:247, evt-07, mir-19-d-flip AC-5) as BUG tickets". Preceded by "làm tiêpds đi". No image attached.

## Environment

- Where: local, `pnpm exec playwright test` against the mock seam, full suite with 2 workers (`fullyParallel`); reproduced on `origin/main` as well as on feature branches
- Role and scope: per the spec's own fixtures; no real person's data
- Browser: Playwright Chromium, default viewport

## Steps to reproduce

1. On `main`: `CI=1 pnpm exec playwright test tests/e2e/uie-09-admin-hub.spec.ts:248 --repeat-each=30 --workers=2`.
2. Expect an occasional failure at `:253` with the received URL ending in `/holidays/2026`.

## Expected

`.ai/board/tickets/UIE-09/01-plan.md:139` AC-4 ("each destination opens the screen it names"); feature row UIE-09 (`.ai/registry/features.md:211`). ADM-02 AC-9 separately requires `/holidays` to redirect to the current year (`src/routes/Holidays.tsx:69,120-124`; asserted by `tests/e2e/adm-02-holidays.spec.ts:256`). The spec must pass on every run.

## Actual

MIR-17-g `04-review.md:50`: "The failure was `tests/e2e/uie-09-admin-hub.spec.ts:252` (`/holidays` landed on `/holidays/2026`) … Re-run alone, that spec passed 13/13 on this branch and 13/13 on `origin/main`"; `:72`: "AC-4 … failed twice under two workers". The assertion is now at `:253`.

## Root cause

**suspected.** `tests/e2e/uie-09-admin-hub.spec.ts:253` asserts `toHaveURL(new RegExp(`${destination.path}$`))`; for the holidays destination (`DESTINATIONS` at `:97-101`, added by SOLO 2026-09-12) that requires the URL to end in `/holidays`. `src/routes/Holidays.tsx:223` `<Navigate to={`/holidays/${currentYear()}`} replace />` runs in an effect after the first render, so `/holidays` exists for milliseconds; once the URL is `/holidays/2026` the retries can never match. Under two workers the redirect wins. Confirm: `--repeat-each=50 --workers=4` on `:248`, failures only on the holidays iteration; or `page.waitForURL(/\/holidays\/\d{4}$/)` before `:253`.

`introduced_in`: unknown — `git log -S` on `admin-hub-holidays-link`, the `:253` regex and the `Navigate` line all end at the squashed `41b0a1e`; the spec attributes the holidays destination to SOLO 2026-09-12 (no ticket).

## Severity

S3 — users are not affected; the app follows ADM-02 AC-9. Only the e2e gate is unreliable; rerunning alone is the workaround.

## Regression test, proposed

End-to-end, in the same spec: the holidays destination asserts the settled address (`/holidays/<this year>` or `/holidays/\d{4}`), computing the year as `adm-02-holidays.spec.ts` does, while AC-3 keeps asserting the link's href `/holidays`.

## Open questions

- Assert the settled URL in the test, or point the hub link straight at `/holidays/<year>` (changes `src/components/AdminTabs.tsx:192` and AC-3's href assertion)?
- Compute "this year" as adm-02 does, so it survives New Year and a different browser clock?

## Further reports
