---
ticket: BUG-011
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-17T04:26:49Z
inputs_read:
  - .ai/board/tickets/BUG-011/ticket.yaml
  - .ai/board/tickets/BUG-011/00-bug-report.md
  - .ai/registry/features.md                  # MIR-19 row, :308
  - .ai/registry/invariants.md
  - .ai/board/tickets/MIR-19-d/01-plan.md     # § 2 AC-5, :150-153
  - .ai/board/tickets/MIR-19/01-plan.md       # § 2 AC-2, :112-115
  - .ai/board/tickets/BUG-005/01-plan.md      # sibling shape: a test acting before its screen settles
  - .ai/standards/testing-standards.md
  - docs/ops/e2e-quarantine.md                # neither test is registered
  - playwright.config.ts                      # fullyParallel, retries 0 outside CI
  - tests/e2e/mir-19-d-flip.spec.ts           # AC-5 test, :84-96
  - tests/e2e/mir-19-org-routing.spec.ts      # AC-2 test, :39-49
  - src/components/Sidebar.tsx                # home-year-link to="/year", :536
  - src/App.tsx                               # /year and /year/:year both mount YearOverview, :509-510
  - src/routes/YearOverview.tsx               # valid :130, <Navigate replace> :254, year-overview :332
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-011 — two end-to-end tests poll for an address the year screen replaces at once

## 1. Problem and scope

**Feature implemented, transcribed from `.ai/registry/features.md`:**

| ID | Title |
|---|---|
| MIR-19 | Every authenticated page is served under `/{org_code}` |

Nobody gains a capability. The suite does: two tests that assert MIR-19 behaviour stop failing at
random under parallel workers, so a red full-suite run means something again. The tests poll the
pathname for `/shared/year` right after clicking `home-year-link`. That address is real but momentary.
`YearOverview` with no `:year` renders `<Navigate to="/year/<current year>" replace />`, so the
settled address is `/shared/year/<yyyy>`. The poll passes only if its first sample lands inside that
window.

**Root cause: confirmed** (the report had it as *suspected*). Measured on `origin/main` `b2af013`:
`pnpm exec playwright test tests/e2e/mir-19-d-flip.spec.ts:84 tests/e2e/mir-19-org-routing.spec.ts:39 --workers=4 --repeat-each=25`
gave **12 failed, 39 passed** (the 51 includes the seam-guard setup). Of the 12:

- 6 are MIR-19 AC-2 (`mir-19-org-routing.spec.ts:45`), every one reading `/shared/year/2026`
- 5 are MIR-19-d AC-5 (`mir-19-d-flip.spec.ts:91`), every one reading `/shared/year/2026`
- 1 is MIR-19-d AC-5 at `:95`. The poll at `:91` caught the window, and `goBack()` then ran while the
  redirect was still in flight. The pathname read `/shared/month/2026-10`, but the page snapshot
  (`error-context.md`) shows the year overview rendered and `month-grid` absent. Same cause, second
  symptom: the test pressed Back faster than any person can, during the redirect. Nothing here shows
  that a Back pressed after the year screen has settled goes wrong.

The report's first open question is settled: no product source changes (see Out of scope and § 8).

**Out of scope:**

- `src/**`. `home-year-link` keeps `to="/year"` and `YearOverview` keeps its `replace` redirect.
  CAL-06/CAL-10 keep the clock out of routing (`src/App.tsx:484-504`), and pointing the link at
  `/year/<yyyy>` would put a clock in `Sidebar.tsx`, which says at `:529-531` that it holds no clock.
- Rewording AC-5 in `.ai/board/tickets/MIR-19-d/01-plan.md` and AC-2 in
  `.ai/board/tickets/MIR-19/01-plan.md`. Both are shipped artifacts of other tickets (additive only).
  Their criteria still hold. MIR-19 AC-2 says the *link* is `/shared/year`, and § 2 AC-2 below asserts
  exactly that, on the `href`. MIR-19-d AC-5 is about Back, and the `/shared/year` in its *When* is
  setup. This plan records the reading; it does not edit the old plans.
- The other flaky tests named in the operator's request (tsk-01:279, tsk-02:109, uie-10:208,
  uie-09:247, evt-07). Each gets its own `BUG-nnn`.
- `solo-admin-back-to-calendar.spec.ts:95`. It reads an `href`, not a pathname, so it is not subject
  to the redirect.
- `docs/ops/e2e-quarantine.md`. Neither test is registered there, so there is nothing to remove.

`size_estimate: S`. Two test files, a few lines each.

## 2. Acceptance criteria

Vocabulary: *the AC-5 test* is the test titled exactly `AC-5: the flip adds no history entry` in
`tests/e2e/mir-19-d-flip.spec.ts`. *The AC-2 test* is the test titled exactly
`AC-2: links inside the app keep the org` in `tests/e2e/mir-19-org-routing.spec.ts`. *The settled
year address* is a pathname matching `/^\/shared\/year\/\d{4}$/`.

**AC-1: the AC-5 test waits for the settled year screen before Back** (regression criterion, R10)
- Given the AC-5 test
- When it has clicked `home-year-link`
- Then it first asserts that `home-year-link` had `href` `/shared/year` before the click
- And it waits, with an auto-retrying `expect`, for `year-overview` to be visible
- And it polls the pathname until it matches the settled year address
- And only after that does it call `page.goBack()`
- And it no longer asserts that the pathname is `/shared/year`

**AC-2: the AC-2 test waits for the settled year screen before the logo**
- Given the AC-2 test
- When it has reached `/shared/month/2026-10` with `month-grid` visible
- Then it asserts that `home-year-link` has `href` `/shared/year`. This is MIR-19 AC-2's "no link drops
  the prefix", read from the link and not from a momentary address.
- And after clicking it, it waits for `year-overview` to be visible and polls the pathname until it
  matches the settled year address
- And only then does it click `shell-brand-logo`. The `/shared` assertion after that is unchanged.

**AC-3: nothing MIR-19-d AC-5 or MIR-19 AC-2 asserted is weakened**
- Given both tests after this ticket
- Then the AC-5 test still asserts, after `goBack()`, that the pathname is exactly
  `/shared/month/2026-10` and that `month-grid` is visible
- And both titles are unchanged character for character
- And no other test in either file changes in title or body
- And no `waitForTimeout` is added, no timeout is raised, and neither test is skipped, quarantined or
  marked `fixme`

**AC-4: the year is not pinned**
- Given either test
- Then the settled year address is matched with the regex above, never compared with a year computed
  in the test process. The browser's clock and the runner's clock can disagree at a year boundary.

**AC-5: the regression is proven by repetition, before and after** (regression criterion, R10)
- Given the production build the suite serves (`playwright.config.ts` `webServer`)
- When `pnpm exec playwright test tests/e2e/mir-19-d-flip.spec.ts:84 tests/e2e/mir-19-org-routing.spec.ts:39 --workers=4 --repeat-each=25 --retries=0`
  runs on `origin/main`
- Then at least one run fails. Measured at PLAN: 12 of 50, see § 1. The impl-log re-measures it and
  records the count.
- And when the same command runs with this ticket's change, 50 of 50 pass
- And the full suite runs once at 2 workers with `--retries=0`, and `03-impl-log.md` records its
  totals. Failures elsewhere are recorded, not fixed.
- And if any run of the two tests fails after the change, the ticket stops at FAIL with the failure
  recorded

**AC-6: no product source changes**
- Given `git diff origin/main --stat` at REVIEW
- Then it lists only paths in § 7 and this ticket's folder. `src/**` is untouched.

**Invariants touched: `[]`.** Two e2e tests' waits. No entry, member, team or count is read or written
by anything that changes. INV-01 to INV-07 constrain entries, membership and the absence count, and
none of them is touched.

**Open questions.** None that block. The report's four, settled here:
1. Reword the old plans' ACs? No. See Out of scope.
2. Pin the year or use a regex? Regex. See AC-4.
3. Fix `mir-19-org-routing.spec.ts:45` in the same ticket? Yes. Same cause, and it failed 6 of 25 at
   PLAN.
4. Point the link at `/year/<yyyy>`? No. See Out of scope and § 8.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(Nothing is laid out. No screen, element or class changes. The line is written because the gate
requires exactly one.)

## 3. Permission model

Nothing changes. Both tests sign in as `thanh@example.com`, a member of Org public (`shared`), who may
read the month and year screens (`.ai/standards/rbac-and-security.md:18`, "reads everyone's",
unchanged). No check on either side of the boundary is touched.

## 4. Contract

No exported signature, schema or type changes. The exact test text is below. The Developer may not
add names beyond these. Every test id used already exists: `home-year-link` is at
`src/components/Sidebar.tsx:536`, `year-overview` at `src/routes/YearOverview.tsx:332`, and
`month-grid` and `shell-brand-logo` are already used by these tests.

### 4.1 `tests/e2e/mir-19-d-flip.spec.ts`, the AC-5 test

Replace the two lines at `:90-91` (the click, and the poll for `"/shared/year"`) with:

```ts
    await expect(page.getByTestId("home-year-link")).toHaveAttribute("href", "/shared/year");
    await page.getByTestId("home-year-link").click();
    // BUG-011. `/shared/year` is replaced by `/shared/year/<yyyy>` at once (YearOverview's
    // <Navigate replace>); wait for the settled screen so Back is pressed after the redirect, not during.
    await expect(page.getByTestId("year-overview")).toBeVisible();
    await expect.poll(pathnameOf(page)).toMatch(/^\/shared\/year\/\d{4}$/);
```

The lines from `await page.goBack();` to the end of the test stay as they are.

Add one line to the file's header comment block (after `:9`):

```ts
// BUG-011: AC-5 waits for the settled year address (/shared/year/<yyyy>) before Back.
```

### 4.2 `tests/e2e/mir-19-org-routing.spec.ts`, the AC-2 test

Replace the two lines at `:44-45` with:

```ts
    await expect(page.getByTestId("home-year-link")).toHaveAttribute("href", "/shared/year");
    await page.getByTestId("home-year-link").click();
    // BUG-011. The link is `/shared/year`; the settled address is `/shared/year/<yyyy>`.
    await expect(page.getByTestId("year-overview")).toBeVisible();
    await expect.poll(() => new URL(page.url()).pathname).toMatch(/^\/shared\/year\/\d{4}$/);
```

`:47-48` (the logo click and the `/shared` poll) are unchanged. Add to the header comment block (after
`:10`):

```ts
// BUG-011: AC-2 reads the year link's href, then waits for the settled year address.
```

### 4.3 If `toHaveAttribute("href", "/shared/year")` fails

If the rendered `href` turns out not to be exactly `/shared/year`, for example because it is absolute
or carries a query, stop and record the observed value in `03-impl-log.md`. Do not loosen the
assertion. The PLAN-time page snapshot shows `/url: /shared/year`.

## 5. Seam impact

None. No function in `src/lib/data/` changes.

## 6. Schema delta

`none`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "tests/e2e/mir-19-d-flip.spec.ts"
  - "tests/e2e/mir-19-org-routing.spec.ts"
```

`glossary_owed` is `[]`, so no glossary row is written. `size: S` from two paths, which agrees with
`size_estimate: S`. ADR-012 is not engaged.

## 8. Rejected alternatives

- **Point `home-year-link` at `/year/<current year>`.** This would remove the transient address for
  every user as well as for the test. Rejected: it puts a clock in `Sidebar.tsx`, which deliberately
  holds none (`:529-531`). It also changes product behaviour to fix a test, and the redirect is correct
  as it is: it is `replace`, so it adds no history entry.
- **Match `^/shared/year(/\d{4})?$`**, as the report proposed, accepting either address. Rejected: it
  leaves the second symptom in place. A poll that accepts `/shared/year` can still pass inside the
  window and let `goBack()` race the redirect, which is the `month-grid` failure measured in § 1. The
  test has to wait for the settled screen, not just accept both addresses.
- **Pin `/shared/year/${new Date().getFullYear()}`.** Rejected under AC-4. The test process and the
  browser read different clocks, and at a year boundary they disagree.
- **Quarantine the two tests (ADR-060).** Rejected. The cause is known and the fix is a few lines.
  Quarantine is for a cause nobody can fix yet.

## Changelog

- `2026-11-17T04:26:49Z` — § 1 root cause moved from *suspected* to *confirmed* by a measured run on
  `origin/main` `b2af013`. A second symptom of the same cause was found (`goBack()` racing the
  redirect, `mir-19-d-flip.spec.ts:95`), which is why § 8 rejects the report's proposed either-address
  regex. Raised by tech-lead-design. Amended by tech-lead-design.
