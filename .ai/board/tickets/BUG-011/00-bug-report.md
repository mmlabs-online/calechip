---
ticket: BUG-011
stage: TRIAGE
agent: orchestrator
produced_at: 2026-11-16T15:26:04Z
inputs_read:
  - tests/e2e/mir-19-d-flip.spec.ts
  - .ai/board/tickets/MIR-19-d/01-plan.md
  - .ai/registry/features.md
  - review and impl-log records cited under Actual
consulted: []
gate: PASS
blocking_reason: ""
next_state: BACKLOG
severity: S3
found_in: "local full-suite Playwright runs at 2 workers during MIR-04 … MIR-19-f reviews; origin/main 453e3b6 and later"
introduced_in: "1fceaaf5 (MIR-19-d, 'checkpoint after IMPLEMENT — gate BLOCKED', 2026-11-12), found with `git log -S'toBe('/shared/year')'` and `git blame -L 90,91`; the pattern was first written in f3a7f816 (MIR-19) at `mir-19-org-routing.spec.ts:45`. The redirect at `YearOverview.tsx:254` predates both (`41b0a1e`)"
root_cause: suspected
batch: ops/record-bug-006
regression_of: ""
---

# BUG-011 — MIR-19-d AC-5 e2e test fails intermittently: it polls for /shared/year, which the year page replaces with /shared/year/<year> at once

## Report

Operator, 2026-11-16, choosing the next step after the MIR tickets: "File the flaky e2e as BUGs (Recommended)", the option worded "Use the new /bug command to record the flaky tests seen on every PR (tsk-01:279, tsk-02:109, uie-10:208, uie-09:247, evt-07, mir-19-d-flip AC-5) as BUG tickets". Preceded by "làm tiêpds đi". No image attached.

## Environment

- Where: local, `pnpm exec playwright test` against the mock seam, full suite with 2 workers (`fullyParallel`); reproduced on `origin/main` as well as on feature branches
- Role and scope: per the spec's own fixtures; no real person's data
- Browser: Playwright Chromium, default viewport

## Steps to reproduce

1. On `main`: `pnpm exec playwright test tests/e2e/mir-19-d-flip.spec.ts tests/e2e/mir-19-org-routing.spec.ts --workers=2 --repeat-each=30`, or the full suite at 2 workers.
2. Expect occasional failures at `mir-19-d-flip.spec.ts:91` (and possibly `mir-19-org-routing.spec.ts:45`) receiving `/shared/year/2026`.
3. The file alone at `--workers=1` passes.

## Expected

`.ai/board/tickets/MIR-19-d/01-plan.md:150-153` AC-5 ("the flip adds no history entry … press the browser's Back / Then they are at `/shared/month/2026-10`, never at `/month/2026-10`"); feature row MIR-19 (`.ai/registry/features.md:308`). The criterion is about Back; "to `/shared/year`" is setup. The spec must pass on every run.

## Actual

MIR-19-f `04-review.md:42-43`: "41 passed, 1 failed: `mir-19-d-flip.spec.ts:84` AC-5 (`/shared/year/2026` where `/shared/year` was polled, `:91`). Rerun of that file alone, `--workers=1` → 10 passed". MIR-19-e `03-impl-log.md:59`: failed in the first full run, passed on rerun.

## Root cause

**suspected.** `home-year-link` (`src/components/Sidebar.tsx:536`) links to `/year`; `src/App.tsx:509` mounts `YearOverview` with no `:year`; `src/routes/YearOverview.tsx:130` makes `valid` false and `:254` `<Navigate … replace />`s to `/year/<current year>`. `tests/e2e/mir-19-d-flip.spec.ts:91` `expect.poll(pathnameOf(page)).toBe("/shared/year")` passes only if its first poll lands in that window; under two workers it reads `/shared/year/2026` and never sees `/shared/year` again. The failure is before `goBack()`, so the capture-phase popstate listener (`src/App.tsx:212-224`) and `ownOrgAddress` (`src/lib/org-path.ts`) are not reached; Back behaviour should be correct because the redirect is `replace`. The same latent flake is at `tests/e2e/mir-19-org-routing.spec.ts:45`. Confirm: `--repeat-each=50` at 2+ workers, every failure reading `/shared/year/2026`; or assert the settled address and see the flake disappear.

`introduced_in`: 1fceaaf5 (MIR-19-d, "checkpoint after IMPLEMENT — gate BLOCKED", 2026-11-12), found with `git log -S'toBe("/shared/year")'` and `git blame -L 90,91`; the pattern was first written in f3a7f816 (MIR-19) at `mir-19-org-routing.spec.ts:45`. The redirect at `YearOverview.tsx:254` predates both (`41b0a1e`).

## Severity

S3 — test-only; the product behaviour AC-5 describes (no extra history entry, Back lands on the org address) is not shown to be broken. Cost: false reds in full-suite runs; workaround is a rerun.

## Regression test, proposed

End-to-end, fixing AC-5 in the same spec: wait for `year-overview` and assert the settled `/shared/year/<current year>` (or `^/shared/year(/\d{4})?$`) before `goBack()`, proven under `--repeat-each` at 2+ workers; the same change at `mir-19-org-routing.spec.ts:45`.

## Open questions

- Reword AC-5 in the MIR-19-d plan to `/shared/year/<current year>`?
- Pin the year (test and browser clocks may differ at year-end) or use a regex?
- Include `mir-19-org-routing.spec.ts:45` in the same ticket (both spec paths in `allowed_paths`)?
- Point the link straight at `/year/<year>`? Probably not: CAL-06/CAL-10 keep the clock out of routing.

## Further reports
