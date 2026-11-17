---
ticket: BUG-008
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-11-17T03:42:43+00:00
inputs_read: [ .ai/board/tickets/BUG-008/01-plan.md, .ai/board/tickets/BUG-008/03-impl-log.md, .ai/board/tickets/BUG-008/ticket.yaml, .ai/templates/review-report.md, .ai/01-operating-model.md, "git diff origin/main...HEAD", tests/e2e/uie-10-sidebar.spec.ts, src/routes/WeekView.tsx, src/components/TopBar.tsx, src/lib/period.ts, playwright.config.ts ]
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
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | `node scripts/check-allowed-paths.mjs`: "ticket BUG-008, 6 changed file(s) / allowed_paths: tests/e2e/uie-10-sidebar.spec.ts / allowed-paths: PASS" (exit 0). `node scripts/check-carry.mjs BUG-008`: "0 uncommitted path(s) / PASS — nothing stray" (exit 0). The only non-exempt path is `tests/e2e/uie-10-sidebar.spec.ts:135-164`, which `ticket.yaml:17-18` allows |
| R2 | typecheck exit 0 | PASS | `pnpm typecheck` → `tsc --noEmit`, exit 0, no output. `tsconfig.json` `include` covers `tests`, so the changed spec is in the program |
| R3 | lint exit 0 on changed lintable files | PASS | `pnpm lint` → `eslint .`, exit 0, no output. Repo-wide, so it covers `tests/e2e/uie-10-sidebar.spec.ts` (`eslint.config.js:51` ignores only `dist`, `node_modules`, `_figma`, `coverage`) |
| R4 | Nothing outside the seam reaches the datastore | PASS | The diff touches no `src/` file. The changed code at `tests/e2e/uie-10-sidebar.spec.ts:159-164` reads `page.url()` and two test IDs and imports nothing new |
| R5 | Every § 4 contract item implemented | PASS | See R5 detail. `tests/e2e/uie-10-sidebar.spec.ts:136` (`SETTLED_WEEK`), `:150-165` (helper), `:154-158` (dated BUG-008 paragraph). No throttle line in the committed spec (§ 4.2) |
| R6 | Permission gating matches § 3 | PASS | § 3 says unchanged. Sign-in is still `signInAt(page, "/week", ADMIN_EMAIL)` at `tests/e2e/uie-10-sidebar.spec.ts:222`, untouched; the admin assertion survives at `:164`; the AC-4 member-denial test at `:247` is outside the diff hunks |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`ticket.yaml:16`), reasoned in `01-plan.md` § 2. See R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only origin/main...HEAD -- package.json pnpm-lock.yaml` is empty. The helper uses only `Page` and `expect`, already imported by the spec |
| R10 | Regression test fails before, passes after | PASS | Command (plan AC-R): `pnpm exec playwright test tests/e2e/uie-10-sidebar.spec.ts -g "AC-3: every address" --repeat-each=24 --workers=2 --retries=0`. **HEAD:** exit 0, "25 passed (23.2s)". **Spec restored from `origin/main`:** exit 1, "6 failed, 19 passed (1.8m)". Every failure was `locator.click: Test timeout of 30000ms exceeded. - waiting for getByTestId('shell-week')` at the old helper's `uie-10-sidebar.spec.ts:150:16`, the click the plan's § 1 chain names. Restored with `git checkout HEAD -- tests/e2e/uie-10-sidebar.spec.ts`; `git status --porcelain` was empty afterwards |

AC-4, run additionally: `pnpm exec playwright test tests/e2e/uie-10-sidebar.spec.ts --retries=0` on HEAD → "13 passed (7.5s)", exit 0.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 module constant `SETTLED_WEEK = /\/week\/\d{4}-\d{2}-\d{2}$/` above the doc comment | `tests/e2e/uie-10-sidebar.spec.ts:135-136` | Yes, character for character |
| § 4.1 `returnToCalendar(page: Page): Promise<void>`, signature unchanged | `tests/e2e/uie-10-sidebar.spec.ts:150` | Yes |
| § 4.1 / AC-1: no `count()` or other one-shot existence query | `tests/e2e/uie-10-sidebar.spec.ts:159-164` | Yes. The only locator calls are `click()` at `:161` and `toHaveAttribute` at `:164` |
| § 4.1 / AC-1: decide from the URL path alone; press nothing on the bare week address or a settled one, otherwise click `shell-week` unchecked | `tests/e2e/uie-10-sidebar.spec.ts:159-162`, with `BARE_WEEK` at `:137-138` | Yes against AC-1. The § 4.1 snippet's literal `pathname !== "/week"` was replaced by `BARE_WEEK = /^(\/[^/]+)?\/week$/`. The literal does not hold AC-1's "on the bare `/week` … it presses nothing" once paths carry the org segment (`/shared/week`, MIR-19). The impl log records that the literal reproduced the timeout 4 of 25 times. The regex accepts `/week` and `/<org>/week` only, so AC-1 is implemented as written and the snippet's defect is not carried. It adds one test-local constant and no field name, data-testid or selector, so RULE-04 is not engaged |
| § 4.1 / AC-1: auto-retrying `expect(page).toHaveURL(SETTLED_WEEK)` | `tests/e2e/uie-10-sidebar.spec.ts:163` | Yes |
| § 4.1 / AC-1: ends asserting `shell-admin-link` `data-state="admin"` | `tests/e2e/uie-10-sidebar.spec.ts:164` | Yes |
| § 4.1: dated BUG-008 paragraph with an *"Until 2026-11-17: …"* quote, existing doc comment kept | `tests/e2e/uie-10-sidebar.spec.ts:140-149` kept; `:154-158` added | Yes |
| AC-2: AC-3 test, other tests and `signInAt` byte-identical; no `waitForTimeout`, no raised timeout | The diff has two hunks, both above `:167` (`test.describe`). `signInAt` ends at `:133`, unchanged. The only "timeout" in the diff is the comment word at `:157` | Yes |
| § 4.2: throttle never committed | No `setCPUThrottlingRate` in `tests/e2e/uie-10-sidebar.spec.ts` | Yes. The developer skipped the throttled measurement because the failure reproduced unthrottled at 12 of 25 (`03-impl-log.md` Open questions). AC-3's purpose was to show the cause under slowed timing; my unthrottled before run (6 of 25 failed at the predicted click) shows it directly |

Root-cause chain re-checked against the source. `src/routes/WeekView.tsx:632` redirects an anchorless week with `replace`. `src/lib/period.ts:320-321` returns `null` for a one-segment path. `src/components/TopBar.tsx:227` names the segment `${nav?.kind ?? "shell"}-${segment.kind}`.

## R7 detail

`invariants_touched` is `[]` (`ticket.yaml:16`): PLAN considered the invariants and found none engaged (`01-plan.md` § 2, "INV-01 to INV-07 constrain entries, membership and the absence count"). Each invariant was checked against the diff below.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 … INV-07 (all registry invariants) | Not reachable from the diff. The only changed executable lines are `tests/e2e/uie-10-sidebar.spec.ts:136,138,159-164`, a Playwright helper that reads `page.url()`, clicks a navigation link and asserts URL and attribute. It writes no entry, membership, team or count, and it changes no code under `src/`. Every server-side and seam-side rule holding these invariants is byte-identical to `origin/main` | `git diff --name-only origin/main...HEAD` lists no `src/` or `supabase/` path |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

None.

## Delegated decisions

- **How R10 applies to a test-only diff.** The diff has no non-test paths, so restoring "the diff's
  non-test paths from `origin/main`" would restore nothing, and the before run would be the fixed
  code. I took the reading the plan's AC-R states: the before run is the `origin/main` version of
  the spec. I restored `tests/e2e/uie-10-sidebar.spec.ts` itself, ran, and put it back from `HEAD`.
  That is the only counterfactual a defect in a test can have.

## Verdict

`PASS`. BUG-008 advances to DONE.
