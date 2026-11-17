---
ticket: BUG-008
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-17T03:19:41+00:00
inputs_read:
  - .ai/board/tickets/BUG-008/ticket.yaml
  - .ai/board/tickets/BUG-008/00-bug-report.md
  - .ai/registry/features.md                # UIE-10 row, :212
  - .ai/registry/invariants.md
  - .ai/board/tickets/UIE-10/01-plan.md     # § 2 AC-3, :156-159
  - .ai/board/tickets/BUG-005/01-plan.md    # sibling shape: flaky e2e, CPU throttle measurement
  - .ai/standards/testing-standards.md
  - docs/ops/e2e-quarantine.md              # no row for this test
  - playwright.config.ts                    # fullyParallel, retries, webServer
  - tests/e2e/uie-10-sidebar.spec.ts        # signInAt :123-133, returnToCalendar :145-154, AC-3 test :208-234
  - src/routes/WeekView.tsx                 # :632 <Navigate replace> when the anchor is absent
  - src/components/TopBar.tsx               # :133 segment targets; :219-227 segment id `${nav?.kind ?? "shell"}-${kind}`; :300-310 shell-admin-link
  - src/lib/period.ts                       # periodNavFor :296-321, returns null for a one-segment path
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-008 — plan

## 1. Problem and scope

**Feature implemented (transcribed from `.ai/registry/features.md:212`):**

| ID | Title | Status |
|---|---|---|
| UIE-10 | The sidebar gives up its admin links and restyles its roster; the specs route through the hub | DONE |

This ticket changes no product behaviour. It repairs the end-to-end test that states UIE-10 AC-3
(`.ai/board/tickets/UIE-10/01-plan.md:156-159`, "every address the sidebar gave up is still reachable
in two steps"). The test fails intermittently under the full suite's parallel load, and at least four
reviews (MIR-19-d, MIR-19-b, MIR-19-e, MIR-17-g) recorded the red and explained it away. Who gains:
every reviewer and developer, because a red full suite will mean something again. An admin gains
nothing new; the AC-3 property itself already holds.

**Root cause, settled at PLAN from the source (the report marked it *suspected*).** The browser
could not be installed in the planning environment (`playwright install chromium` failed to download),
so it was not reproduced here. The chain below was confirmed by reading the code, and every link has
a line reference:

1. The AC-3 test begins with `signInAt(page, "/week", ADMIN_EMAIL)` (`:211`). `signInAt` does
   `page.goto("/week")` and waits only for `shell-sidebar` (`:131-132`).
2. `/week` has one path segment, so `periodNavFor` returns `null` (`src/lib/period.ts:320-321`), and
   the top bar names its Week segment `shell-week` (`src/components/TopBar.tsx:227`,
   `` `${nav?.kind ?? "shell"}-${segment.kind}` ``).
3. `WeekView` renders `<Navigate … replace />` to `/week/<today>` when the anchor is absent
   (`src/routes/WeekView.tsx:632`). Once that runs, `nav.kind` is `week` and the same segment is
   renamed `week-week`.
4. `returnToCalendar` (`:145-154`) checks `shell-week` with `count() > 0` and then calls `click()`.
   That is a check followed by a separate action. When `count()` lands before the redirect it sees 1,
   the redirect then removes the node, and `click()` waits 30 s for a `shell-week` that will not
   come back. The result is the recorded timeout at `:150`.

The defect is in the test. The redirect and the rename are both intended behaviour (`TopBar.tsx:219-220`
records the naming rule).

**`size_estimate`: S.** One helper in one spec file.

**Out of scope:**

- **The same `shell-week` timing in other specs**: `tsk-01-tasks.spec.ts:111` and
  `solo-admin-back-to-calendar.spec.ts:126,136`. The operator asked for each flaky test to be
  recorded as its own BUG ticket (`00-bug-report.md` § Report), so each one gets its own diagnosis.
  This ticket does not touch them. The open question about a shared `signInAt` is decided below.
- **Any change to the app.** `/week` will not be made `nav.kind = week`, and the redirect and segment
  naming stay as they are (§ 8, alternative 1).
- **UIE-10 AC-3's wording.** It still names `/allow-list` and `/threshold`, but the test asserts
  `/signups` and `/setting` after SOLO 2026-09-10/11. That plan belongs to a DONE ticket and is not
  in this ticket's `allowed_paths`. The rename was made by `/solo` and is recorded in the spec's own
  comments (`:87-89`, `:95`). Correcting the shipped plan is a separate decision, and this ticket does
  not edit it.
- **The quarantine register.** This test has no row in `docs/ops/e2e-quarantine.md`, and the fix adds
  none.
- **`signInAt`, every other test in the file, `playwright.config.ts`** (workers, retries, timeouts).

## 2. Acceptance criteria

Vocabulary used below:
- *The spec* is `tests/e2e/uie-10-sidebar.spec.ts`.
- *The AC-3 test* is the test in the spec titled exactly
  `AC-3: every address the sidebar gave up is still reachable in two steps`.
- *The helper* is the spec's `returnToCalendar(page)`.
- *A settled week address* is a URL whose path matches `/week/YYYY-MM-DD`.

**AC-1 — the helper makes no separate existence check**
- Given the helper
- When it is called
- Then it calls no `count()`, `isVisible()` or any other one-shot existence query on any locator
- And it decides whether to press the Week segment from the page's current URL path alone:
  - on the bare `/week` or a settled week address it presses nothing
  - on any other path it clicks `shell-week`, with no check before the click
- And it then waits, with an auto-retrying `expect(page).toHaveURL`, for a settled week address
- And it still ends by asserting `shell-admin-link` has `data-state="admin"`

**AC-2 — no assertion of UIE-10 AC-3 is weakened**
- Given the spec after this ticket, diffed against `origin/main`
- Then the AC-3 test's title and body are byte-identical
- And every other test in the spec is unchanged in title and body, and so is `signInAt`
- And no `waitForTimeout` is added, and no timeout is raised anywhere

**AC-R — regression: the AC-3 test passes under the load that failed it** *(read by review check R10)*
- Given the production build the suite serves (`playwright.config.ts` `webServer`)
- When `pnpm exec playwright test tests/e2e/uie-10-sidebar.spec.ts -g "AC-3: every address" --repeat-each=24 --workers=2 --retries=0`
  runs on `origin/main`
- Then at least one of the 24 runs fails at the helper's `click()`. Four reviews have already recorded
  this: 5/24 at MIR-19-d `04-review.md:38-39`, plus MIR-19-b, MIR-19-e and MIR-17-g
- And when the same command runs with this ticket's change, 24 of 24 pass
- And `03-impl-log.md` records both counts as measured on the developer's machine. A run without the
  change that shows 0 failures is recorded as is, under the § 4.2 throttle as well, and does not
  block the change

**AC-3 — the cause is tested under slowed timing, and the result is recorded either way**
- Given the temporary, uncommitted CPU throttle in § 4.2, placed at the top of the AC-3 test body
- When the AC-R command runs once without this ticket's change and once with it
- Then `03-impl-log.md` records both pass counts
- And the committed spec contains no throttle line

**AC-4 — the whole spec still passes, alone and in the full suite**
- Given the spec after this ticket
- When `pnpm exec playwright test tests/e2e/uie-10-sidebar.spec.ts --retries=0` runs once, and
  the full suite runs once with `--retries=0`
- Then every test in the spec passes both times, and `03-impl-log.md` records the full suite's totals
- And failures elsewhere in the full suite are recorded, not fixed (§ 1 Out of scope)

**Invariants touched: `[]`.** Only one test helper's control flow changes. No entry, member, team or
count is read or written by changed code. INV-01 to INV-07 constrain entries, membership and the
absence count, and none of those is touched.

**Open questions.** None block. The report's three questions are decided here; none of them reverses
an ADR (ADR-067):
1. *Test only, or a shared `signInAt` that waits for URL settlement across specs?* **Test only, and
   only the helper.** There is no shared `signInAt`: each spec defines its own. The other two specs
   named are separate flaky reports with their own diagnoses (§ 1). In this spec the helper is
   called only by the AC-3 test (`:223`), so no other test reaches the race.
2. *Change the app so `/week` is already `nav.kind = week`?* **No.** § 8, alternative 1.
3. *Update AC-3's wording to the current destinations?* **Not in this ticket.** § 1 Out of scope.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(No screen changes. There is no layout to originate.)

## 3. Permission model

Unchanged. The test signs in as the fixture admin (`quan@example.com`), exactly as it does today.
No role gate, denial or server-side check is added, removed or moved. The member denial for
`shell-admin-link` stays asserted by the AC-4 test of the spec, which is untouched.

## 4. Contract

### 4.1 `tests/e2e/uie-10-sidebar.spec.ts`: the helper

Replace the body of `returnToCalendar` (`:145-154`) with the version below, and add the one module
constant directly above the function's doc comment. The signature does not change. Keep the existing
doc comment, and add a dated `BUG-008` paragraph to it saying why the check was removed. Use the
spec's own convention: a one-line *"Until 2026-11-17: …"* quote of the replaced approach.

```ts
/** BUG-008. A week address after the anchorless `/week` has redirected (`WeekView.tsx:632`). */
const SETTLED_WEEK = /\/week\/\d{4}-\d{2}-\d{2}$/;

async function returnToCalendar(page: Page): Promise<void> {
  const { pathname } = new URL(page.url());
  if (pathname !== "/week" && !SETTLED_WEEK.test(pathname)) {
    await page.getByTestId("shell-week").click();
  }
  await expect(page).toHaveURL(SETTLED_WEEK);
  await expect(page.getByTestId("shell-admin-link")).toHaveAttribute("data-state", "admin");
}
```

Why this cannot race, in both cases the AC-3 test produces:
- **First iteration.** The path is `/week` (before the redirect) or `/week/<date>` (after it). Both
  paths take the no-click branch, and `toHaveURL` retries until the redirect has happened.
- **Later iterations.** The previous iteration ended by asserting the destination's landmark as
  visible, on a path with no period (`/entries/pending`, `/entries/team`, `/signups`). There,
  `periodNavFor` returns `null` and `shell-week` is stable, so the unconditional click resolves.
  `shell-week` points at `/week` (`TopBar.tsx:133`, `nav?.weekTo ?? "/week"`), and that redirects
  in turn.
  `toHaveURL` absorbs the redirect.

Names introduced: `SETTLED_WEEK`. No other identifier and no `data-testid` is introduced. The test
IDs read are `shell-week` and `shell-admin-link`, both already shipped.

### 4.2 The throttle for AC-3 (temporary, never committed)

Used only for the measurement runs. These are the first lines inside the AC-3 test body:

```ts
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 4 });
```

A "without" run applies the throttle to the `origin/main` version of the helper. Remove both lines
before commit. `git diff origin/main -- tests/e2e/uie-10-sidebar.spec.ts` then shows only § 4.1.

## 5. Seam impact

None. No function in the data-access seam is read differently or changed.

## 6. Schema delta

`none`. No migration, policy, trigger or constraint is involved.

## 7. allowed_paths

```yaml
allowed_paths:
  - "tests/e2e/uie-10-sidebar.spec.ts"
```

`glossary_owed` is `[]`, so no glossary row is written. `size: S`, counted from one path. It agrees
with `size_estimate: S`, so ADR-012 is not engaged.

## 8. Rejected alternatives

1. **Change the app so the anchorless `/week` already counts as a week screen** (`periodNavFor`
   returns `kind: "week"` for `/week`, as it does for `/`). This removes the rename at its source.
   Rejected for three reasons. It changes shipped behaviour to fix a test. It breaks the `shell-week`
   contract that `solo-admin-back-to-calendar.spec.ts:93` and `tsk-01-tasks.spec.ts:111` assert. And
   the defect is the test's check followed by a separate action, which would remain for the next
   transient node.
2. **Make `signInAt` wait for a settled week address when `path` is `/week`.** This also closes the
   window, and it is the report's first suggestion. Rejected as the sole fix because it leaves the
   check-then-act inside the helper. Any future caller that reaches the helper on a page still
   rendering would hit the same race. It also widens the change into a function that eleven other
   call sites in the spec use, without need.
3. **Replace the check with `shell-week.or(week-week)` and click whichever resolves.** Rejected:
   clicking `week-week` on `/week/<today>` is a no-op that still costs a navigation. The `.or()`
   locator can also resolve to the transient `shell-week` and hit the same detach.
4. **Reduce workers for the spec, or raise the test timeout.** Rejected: that hides the race rather
   than removing it, and AC-2 forbids raising a timeout.
5. **Quarantine the test under ADR-060.** Rejected: the cause is known and the fix is a few lines.
   Quarantine is for a failure that cannot be repaired yet.

## Changelog

- `2026-11-17T03:19:41+00:00`: all sections written. The root cause was moved from *suspected* to
  settled by reading the source (§ 1). It was not reproduced here because no browser could be
  installed. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
