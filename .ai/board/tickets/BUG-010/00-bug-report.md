---
ticket: BUG-010
stage: TRIAGE
agent: orchestrator
produced_at: 2026-11-16T15:26:04Z
inputs_read:
  - tests/e2e/evt-07-guest-registration.spec.ts
  - .ai/board/tickets/EVT-07/01-plan.md
  - .ai/registry/features.md
  - review and impl-log records cited under Actual
consulted: []
gate: PASS
blocking_reason: ""
next_state: BACKLOG
severity: S3
found_in: "local full-suite Playwright runs at 2 workers during MIR-04 … MIR-19-f reviews; origin/main 453e3b6 and later"
introduced_in: "unknown — `git log -L` on `:123-125` and `:167-169` ends at the squashed `41b0a1e`; by the board record the spec was created by EVT-07 (`EVT-07/03-impl-log.md:53`) and edited by EVT-13 (`EVT-13/03-impl-log.md:38`), which kept the double navigation"
root_cause: suspected
batch: ops/record-bug-006
regression_of: ""
---

# BUG-010 — EVT-07 guest-registration e2e tests fail intermittently: two back-to-back client navigations merge, so the guest page never remounts and the form never returns

## Report

Operator, 2026-11-16, choosing the next step after the MIR tickets: "File the flaky e2e as BUGs (Recommended)", the option worded "Use the new /bug command to record the flaky tests seen on every PR (tsk-01:279, tsk-02:109, uie-10:208, uie-09:247, evt-07, mir-19-d-flip AC-5) as BUG tickets". Preceded by "làm tiêpds đi". No image attached.

## Environment

- Where: local, `pnpm exec playwright test` against the mock seam, full suite with 2 workers (`fullyParallel`); reproduced on `origin/main` as well as on feature branches
- Role and scope: per the spec's own fixtures; no real person's data
- Browser: Playwright Chromium, default viewport

## Steps to reproduce

1. On `main`: `pnpm exec playwright test tests/e2e/evt-07-guest-registration.spec.ts --repeat-each=30 --workers=2` under CPU load, or the full suite at 2 workers.
2. Watch for a timeout at `:169` or at `:125` with `guest-registered` still visible.

## Expected

`.ai/board/tickets/EVT-07/01-plan.md` § 2 AC-4 (l.148), AC-5 (l.158), and AC-3 (l.137: "reloading the guest page shows the form again, not the link"); feature row EVT-07 (`.ai/registry/features.md:233`). The spec must pass on every run.

## Actual

No assertion text or trace was kept. MIR-19-d `04-review.md:37,79` names `tests/e2e/evt-07-guest-registration.spec.ts:149` ("Pre-existing e2e flake"; also failed on an export of `origin/main`). MIR-19-f `03-impl-log.md:64`: "failed on a different test in each of two runs … load flakiness (2 workers)".

## Root cause

**suspected.** The spec does `navigate(page, "/")` then `navigate(page, address)` back to back (`:167-169` in the AC-4/AC-5 test, `:123-125` in the AC-1 test); each `navigate` (`:71-76`) is `pushState` plus `popstate`. `src/App.tsx:714` `<BrowserRouter>` runs location updates in `React.startTransition`; under load the render of `/` has not committed when the second `popstate` arrives, React merges the transitions and renders only `/guest/:token` — already on screen — so `GuestEvent` does not remount, its effect (`src/routes/GuestEvent.tsx:145-174`) does not rerun, and `GuestRegisterPanel` keeps its `receipt` (`:398`, `:436`). The page still shows `guest-registered`: `fill` at `:169` or `toBeVisible` at `:125` times out. Two tests share the pattern, matching "a different test in each of two runs". Confirm: a failing trace with `guest-registered` visible at `:169`/`:125`; or fire both navigations inside one `page.evaluate` (form never reappears); or insert `await expect(page.getByTestId("sign-in-submit")).toBeVisible()` between them and expect 0 failures under `--repeat-each=30` with CPU throttling.

`introduced_in`: unknown — `git log -L` on `:123-125` and `:167-169` ends at the squashed `41b0a1e`; by the board record the spec was created by EVT-07 (`EVT-07/03-impl-log.md:53`) and edited by EVT-13 (`EVT-13/03-impl-log.md:38`), which kept the double navigation.

## Severity

S3 — nothing a user sees is broken: a real reload remounts the page; AC-4 and AC-5 are also covered by `tests/guest-registration.test.ts`. Cost: false failures in local review runs (MIR-19-d, MIR-19-f).

## Regression test, proposed

End-to-end, in the same spec: wait for `/` to finish rendering before the second `navigate`, proven with `--repeat-each` under CPU throttling plus the same-`evaluate` repro to show the wait is what is needed.

## Open questions

- Fix in the test, or in the app (`useTransitions={false}` on `BrowserRouter`, or key `GuestEvent` by `location.key`)? Either app change reaches beyond the flake.
- Add a `navigate` helper that waits after each call? Check `evt-14-guest-sign-in.spec.ts:186,202,275` for the same hazard.
- Capture a trace before fixing, to confirm rather than infer the cause?

## Further reports
