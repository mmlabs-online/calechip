---
ticket: BUG-008
stage: TRIAGE
agent: orchestrator
produced_at: 2026-11-16T15:26:04Z
inputs_read:
  - tests/e2e/uie-10-sidebar.spec.ts
  - .ai/board/tickets/UIE-10/01-plan.md
  - .ai/registry/features.md
  - review and impl-log records cited under Actual
consulted: []
gate: PASS
blocking_reason: ""
next_state: BACKLOG
severity: S3
found_in: "local full-suite Playwright runs at 2 workers during MIR-04 … MIR-19-f reviews; origin/main 453e3b6 and later"
introduced_in: "unknown — `git log -S returnToCalendar` / `git log -L145,154` end at the squashed `41b0a1e`; the in-file note 'AMENDED 2026-10-19' (switch to `shell-week`) is the likely origin, with no board record (a `/solo` edit)"
root_cause: suspected
batch: ops/record-bug-006
regression_of: ""
---

# BUG-008 — UIE-10 AC-3 e2e test fails intermittently: returnToCalendar checks for shell-week, then the /week redirect renames it to week-week before the click

## Report

Operator, 2026-11-16, choosing the next step after the MIR tickets: "File the flaky e2e as BUGs (Recommended)", the option worded "Use the new /bug command to record the flaky tests seen on every PR (tsk-01:279, tsk-02:109, uie-10:208, uie-09:247, evt-07, mir-19-d-flip AC-5) as BUG tickets". Preceded by "làm tiêpds đi". No image attached.

## Environment

- Where: local, `pnpm exec playwright test` against the mock seam, full suite with 2 workers (`fullyParallel`); reproduced on `origin/main` as well as on feature branches
- Role and scope: per the spec's own fixtures; no real person's data
- Browser: Playwright Chromium, default viewport

## Steps to reproduce

1. On `main`: `pnpm exec playwright test tests/e2e/uie-10-sidebar.spec.ts:208 --repeat-each=24 --workers=2`.
2. Expect about 5/24 to fail with the `locator.click` timeout at `:150`.

## Expected

`.ai/board/tickets/UIE-10/01-plan.md:156-159` AC-3 ("every address the sidebar gave up is still reachable in two steps"); feature row UIE-10 (`.ai/registry/features.md:212`). The spec must pass on every run. (The test now asserts `/signups` and `/setting` where AC-3 still names `/allow-list` and `/threshold`, after SOLO 2026-09-10/11.)

## Actual

`locator.click: Test timeout of 30000ms exceeded` at `tests/e2e/uie-10-sidebar.spec.ts:150`. Recorded: MIR-19-d `04-review.md:38-39` (`--repeat-each=24`: 5/24 fail on `origin/main`, 7/24 on the branch, always at `:150`); MIR-19-b `04-review.md:98-100` (failed 2/3 alone on the branch, 1/3 at `origin/main` 453e3b6); MIR-19-e `04-review.md:45,109`; MIR-17-g `04-review.md:72`.

## Root cause

**suspected.** `returnToCalendar` (`tests/e2e/uie-10-sidebar.spec.ts:145-154`) does `count() > 0` and then `click()` on `shell-week` (`:149-150`) — check-then-act. On the first iteration (`:223`) after `signInAt(page, "/week", …)` (`:123-133`, which waits only for `shell-sidebar`), the bare `/week` makes `periodNavFor` (`src/lib/period.ts` ~:317) return null, so `src/components/TopBar.tsx` (~:226-236) names the segment `shell-week`; `src/routes/WeekView.tsx:632` then `<Navigate replace>`s to `/week/<today>`, and the segment becomes `week-week`. Under load `count()` sees the transient node and `click()` waits 30 s for a node that is gone. Confirm: a failing trace showing iteration 0 at `/week/YYYY-MM-DD` with `week-week` present; or wait for the settled URL in `signInAt` and rerun `--repeat-each=24 --workers=2` expecting 0/24.

`introduced_in`: unknown — `git log -S returnToCalendar` / `git log -L145,154` end at the squashed `41b0a1e`; the in-file note "AMENDED 2026-10-19" (switch to `shell-week`) is the likely origin, with no board record (a `/solo` edit).

## Severity

S3 — the defect is in the test; the redirect and segment rename are intended and every AC-3 destination is reachable. Cost: an intermittent red full suite explained away by at least four reviews.

## Regression test, proposed

End-to-end, in the same spec: start AC-3 from the bare `/week`, with the helper clicking without a separate existence check and waiting for the settled `/week/<date>` URL. Acceptance: `--repeat-each=24 --workers=2` at 0 failures.

## Open questions

- Test only, or make the shared `signInAt` wait for URL settlement across specs (same pattern in `tsk-01-tasks.spec.ts:111`, `solo-admin-back-to-calendar.spec.ts:126,136`)?
- Or change the app so `/week` is already `nav.kind = week` (as `/` is)? That breaks the `shell-week` selector contract relied on by `solo-admin-back-to-calendar.spec.ts:93` and `tsk-01:111`.
- Update AC-3's wording to the current destinations?

## Further reports
