---
ticket: BUG-010
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-17T04:07:33+00:00
inputs_read:
  - .ai/board/tickets/BUG-010/ticket.yaml
  - .ai/board/tickets/BUG-010/00-bug-report.md
  - .ai/registry/features.md                     # EVT-07 row, :233
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-101-a-defect-is-recorded-by-bug-and-fixed-by-the-loop-with-a-regression-test.md  # decision 7
  - .ai/01-operating-model.md                    # R10, :144, :177-183
  - .ai/board/tickets/EVT-07/01-plan.md          # § 2 AC-3 :137, AC-4, AC-5
  - feat/BUG-006:.ai/board/tickets/BUG-006/01-plan.md   # sibling: same transition mechanism, R10 on a test-only diff
  - feat/BUG-008:.ai/board/tickets/BUG-008/04-review.md # R10 as run on a test-only diff, :31, :68-72
  - docs/ops/e2e-quarantine.md                   # evt-07 is not registered
  - playwright.config.ts                         # fullyParallel :11, retries :13
  - tests/e2e/evt-07-guest-registration.spec.ts
  - tests/e2e/evt-14-guest-sign-in.spec.ts       # :36-41, :186, :202, :275-277
  - src/App.tsx                                  # <BrowserRouter> :714, /guest/:token :783-791, SignIn :805
  - src/routes/GuestEvent.tsx                    # effect :145-174, GuestRegisterPanel :383, receipt :398, :436-438
  - src/routes/SignIn.tsx                        # sign-in-submit :124, the only element carrying it
  - node_modules/.pnpm/react-router@7.18.3_react-dom@19.2.8_react@19.2.8__react@19.2.8/node_modules/react-router/dist/development/chunk-BV7QT456.mjs  # BrowserRouter :10492-10514
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-010 — the EVT-07 spec navigates twice before the first navigation has rendered

## 1. Problem and scope

**Feature implemented, transcribed from `.ai/registry/features.md`:**

| ID | Title |
|---|---|
| EVT-07 | A guest registers for an opened event with a name and an email, and manages it from a link shown once |

EVT-07 is `DONE`. This ticket changes none of its behaviour. It makes two end-to-end tests in
`tests/e2e/evt-07-guest-registration.spec.ts` deterministic under a two-worker run — the AC-1/AC-3
test and the AC-4/AC-5 test — which MIR-19-d (`04-review.md:37,79`) and MIR-19-f
(`03-impl-log.md:64`) recorded failing on `origin/main` and waived. The capability regained is the
reviewer's and the operator's: a full-suite run at two workers that is red only when something is
actually broken.

**Root cause — `suspected` in the report; settled here from the source, to be confirmed at
IMPLEMENT (AC-5).** `src/App.tsx:714` mounts `<BrowserRouter>` with no `useTransitions` prop, and
react-router 7.18.3's `BrowserRouter` then applies every history change inside
`React.startTransition` (`chunk-BV7QT456.mjs:10504-10510`). Each test returns to the guest page
with two back-to-back calls of the spec's `navigate` helper — `navigate(page, "/")` then
`navigate(page, address)` (`:123-124` and `:167-168`) — each a `pushState` plus a `popstate`
(`:71-76`), with nothing between them that waits for `/` to render. Under load the second transition
arrives before the first has committed; React renders only the latest location, `/guest/:token`
with the same token, which is already on screen. `GuestEvent` therefore never unmounts, its load
effect (`src/routes/GuestEvent.tsx:145-174`, keyed on `token`) does not re-run, and
`GuestRegisterPanel` keeps its `receipt` state (`:398`), so `guest-registered` stays on screen
(`:436-438`) and `guest-register-name` never appears. `toBeVisible` at `:125` or `fill` at `:169`
times out — one test in one run, the other in another, matching MIR-19-f's "a different test in each
of two runs". A person cannot press two navigations inside one frame; the spec can.

**The fix:** wait for the sign-in screen between the two navigations. Both tests are signed out at
that point (`signOut` at `:108` and `:154`), and signed out `/` renders `SignIn`
(`src/App.tsx:805`), which is the only element in `src/` carrying `sign-in-submit`
(`src/routes/SignIn.tsx:124`). Once it is visible, `/` has committed and the guest route has
unmounted, so the second navigation mounts a fresh `GuestEvent`. This is the wait
`evt-14-guest-sign-in.spec.ts:276` already makes at the same step.

**Decisions on the report's open questions:**

1. **Test only, not the app.** Both app changes reach beyond the flake (§ 8 alternatives 1 and 2).
2. **No waiting `navigate` helper.** `navigate` goes to any address and cannot know what that address
   renders when ready, so there is nothing generic for it to wait on. The other double navigations
   were checked: every other `navigate` in this spec is followed by an auto-retrying assertion or an
   action that waits (`signInAgain` → `fillSignIn` at `:21`), or goes to a different route, which
   remounts whatever was on screen. `evt-14-guest-sign-in.spec.ts` is not affected: `:275-277`
   already waits, and `:186` and `:202` go through `submitSignIn`, which waits for `sign-in-submit`
   first (`:37`).
3. **A trace is captured, not required before the fix** — AC-5 records it either way.

**Out of scope:**

- **Any change to `src/`** — neither `useTransitions={false}` on `<BrowserRouter>` nor keying
  `GuestEvent` by `location.key` (§ 8).
- **Any other spec file**, including `evt-14-guest-sign-in.spec.ts` (decision 2 above), and the other
  files that use a `navigate` helper (`evt-06`, `evt-10`, `evt-11`, `uie-12`). None is reported here;
  each gets its own record if it flakes.
- **`playwright.config.ts`** — `workers`, `fullyParallel` and `retries` are the load the spec must
  survive, not the defect.
- **Any assertion, title or fixture in the spec**, and the `navigate` helper itself.
- **`docs/ops/e2e-quarantine.md`** — the spec has no row there, so there is nothing to delete.

**`size_estimate: S`** — one file, two inserted waits with their comments.

## 2. Acceptance criteria

Vocabulary: *the spec* is `tests/e2e/evt-07-guest-registration.spec.ts`. *The AC-1 test* is the test
in it titled exactly
`AC-1, AC-3, AC-11, AC-12, AC-14: a guest registers, keeps the link, reads it and cancels`. *The
AC-4 test* is the test titled exactly
`AC-4, AC-5: a bad field and a repeated email are named, and nothing is saved`. *The baseline* is the
spec as it is on `origin/main`.

**AC-1 — the AC-1 test returns to the guest page only after `/` has rendered**
- Given the AC-1 test
- When it has called `navigate(page, "/")` after copying the manage link
- Then its next statement waits, with an auto-retrying `expect`, for `sign-in-submit` to be visible
- And only after that does it call `navigate(page, address)` and assert that `guest-register-name`
  is visible and `guest-manage-link` has count 0

**AC-2 — the AC-4 test returns to the guest page only after `/` has rendered**
- Given the AC-4 test
- When it has called `navigate(page, "/")` after `registerAsGuest(page, "Lan", "lan@example.com")`
- Then its next statement waits, with an auto-retrying `expect`, for `sign-in-submit` to be visible
- And only after that does it call `navigate(page, address)` and fill `guest-register-name`

**AC-3 — no assertion of EVT-07 is weakened**
- Given the spec after this ticket
- Then every test's title is unchanged character for character, and the number of tests is unchanged
- And `git diff origin/main -- tests/e2e/evt-07-guest-registration.spec.ts` shows only added lines,
  exactly those of § 4, and no removed or changed line
- And no `waitForTimeout` is added, and no timeout or retry is raised anywhere

**AC-R — regression criterion (ADR-101 decision 7): both tests fail on the baseline and pass after the change** *(read by review check R10)*
- Given the production build the suite serves (`playwright.config.ts` `webServer`)
- When `pnpm exec playwright test tests/e2e/evt-07-guest-registration.spec.ts -g "AC-1, AC-3, AC-11|AC-4, AC-5:" --repeat-each=30 --workers=2 --retries=0`
  runs against **the baseline** spec
- Then at least one run fails, at `:125` (`guest-register-name` not visible) or at `:169`
  (`fill` on `guest-register-name`), and `03-impl-log.md` § *Regression test* records the command,
  the exit code, the pass and fail counts, and the failing assertion
- And when the same command runs against the spec after this ticket, 60 of 60 pass with exit code 0,
  recorded beside it
- And if the baseline run does not fail, it is repeated once with the temporary throttle of § 4.2 in
  both tests; if it still does not fail, the impl-log says the failure was not reproduced on this
  machine, the change still ships, and the after-run is made under the same throttle
- **How R10 reads this on a test-only fix** (the reading BUG-006 and BUG-008 shipped under,
  `feat/BUG-008:…/04-review.md:68-72`): the diff has no non-test path, so restoring "the diff's
  non-test paths from `origin/main`" restores nothing. The reviewer's *before* run is this command
  with the spec itself restored from `origin/main`
  (`git checkout origin/main -- tests/e2e/evt-07-guest-registration.spec.ts`); the *after* run is the
  same command on `HEAD`, after `git checkout HEAD -- tests/e2e/evt-07-guest-registration.spec.ts`

**AC-4 — the whole spec still passes, alone and in the full suite**
- Given the same build
- When `pnpm exec playwright test tests/e2e/evt-07-guest-registration.spec.ts --retries=0` runs once,
  and the full suite runs once with `pnpm exec playwright test --workers=2 --retries=0`
- Then every test in the spec passes both times, and `03-impl-log.md` records the full suite's totals
- And failures elsewhere in the full suite are recorded by spec and title, not fixed

**AC-5 — the cause is confirmed, and the result recorded either way**
- Given the baseline spec, with temporary and uncommitted edits only
- When (a) the AC-R baseline run is made with `--trace=retain-on-failure`, and (b) the two
  navigations at `:123-124` of the AC-1 test are replaced, temporarily, by the single same-task
  probe of § 4.3 and the AC-1 test is run once with `--retries=0`
- Then `03-impl-log.md` records, for (a), whether a failing trace shows `guest-registered` on screen
  at the failing step, and for (b), whether `guest-register-name` fails to appear
- And if either does not show what § 1 predicts, the impl-log says the cause remains unconfirmed and
  names what was seen; the change still ships if AC-R's after-run passes
- And neither probe nor any throttle line is present in the committed spec

**Invariants touched: `[]`.** Two waits in one test file. No entry, member, team, event, guest or
count is read or written by anything that changes; INV-01 to INV-07 constrain entries, membership and
the absence count, none of which is touched.

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(Nothing is laid out: no screen, element, class or `data-testid` changes. The line is written because
the gate requires exactly one.)

## 3. Permission model

None changes. Both tests act as `thanh@example.com` (FIXTURE_MEMBER) to create and open the event, and
then as a signed-out caller on `/guest/:token` — the EVT-06 and EVT-07 rows of
`.ai/standards/rbac-and-security.md`, unchanged. The added wait reads the sign-in screen, which every
signed-out caller sees. Nothing on either side of the boundary is touched.

## 4. Contract

### 4.1 `tests/e2e/evt-07-guest-registration.spec.ts`

Two insertions; every existing line of the file is unchanged.

**In the AC-1 test**, between line 123 (`    await navigate(page, "/");`) and line 124
(`    await navigate(page, address);`), insert exactly:

```ts
    // BUG-010. <BrowserRouter> applies each history change in a transition. A second navigation
    // before `/` has rendered merges with the first, the guest page is never left, and the receipt
    // stays on screen. Wait for `/` (signed out: the sign-in screen) before going back.
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
```

**In the AC-4 test**, between line 167 (`    await navigate(page, "/");`) and line 168
(`    await navigate(page, address);`), insert exactly:

```ts
    // BUG-010. As in the AC-1 test: let `/` render before going back, or the guest page keeps
    // showing the registration it just made.
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();
```

No import is added — `expect` is already imported at `:1`. No new name, `data-testid` or helper is
introduced; `sign-in-submit` is an existing test ID (`src/routes/SignIn.tsx:124`, awaited at `:21`
and `:80` of this spec).

### 4.2 The throttle for AC-R's fallback — temporary, never committed

As the first lines inside the AC-1 test body and the AC-4 test body, for the measurement runs only:

```ts
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Emulation.setCPUThrottlingRate", { rate: 6 });
```

### 4.3 The same-task probe for AC-5 (b) — temporary, never committed

In the baseline AC-1 test, replace lines 123-124 with:

```ts
    await page.evaluate((url) => {
      window.history.pushState({}, "", "/");
      window.dispatchEvent(new PopStateEvent("popstate"));
      window.history.pushState({}, "", url);
      window.dispatchEvent(new PopStateEvent("popstate"));
    }, new URL(address, "http://x").pathname);
```

Both navigations then land before React can render either, which is the merge § 1 predicts in its
limiting case. Restore the line pair with `git checkout -- tests/e2e/evt-07-guest-registration.spec.ts`
before writing § 4.1.

## 5. Seam impact

None. No function in `src/lib/data/` changes, and nothing calls the mock seam that did not before.

## 6. Schema delta

`none`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "tests/e2e/evt-07-guest-registration.spec.ts"
```

`glossary_owed` is `[]`; no glossary row is written. `size: S` from one path; agrees with
`size_estimate: S`, ADR-012 not engaged.

## 8. Rejected alternatives

1. **`useTransitions={false}` on `<BrowserRouter>` (`src/App.tsx:714`).** Rejected: it changes how
   every route in the product renders a navigation, to serve one spec; and it does not close the
   window anyway — two `popstate`s in quick succession produce two non-transition updates that React
   still batches when they land before a render, which is the same-task case of § 4.3.
2. **Key `GuestEvent` by `location.key`, so every history entry remounts it.** Makes the merged
   navigation show the form. Rejected: the manage link is shown **once** (EVT-07 AC-3, ADR-052
   decision 6) and lives only in `GuestRegisterPanel`'s state, so any future navigation that lands on
   the same address — a query change, a `replace` — would silently destroy it. It also changes EVT-14
   AC-6's page-view boundary for the dismissed prompt. Both are shipped behaviour changed to serve a
   test.
3. **A `navigate` helper that waits after every call** (the report's open question 2). Rejected:
   the helper goes to arbitrary addresses and has nothing generic to wait for — the URL is already
   updated synchronously by `pushState`, so waiting on it proves nothing — and a per-call "ready"
   argument would touch fifteen call sites to fix two.
4. **Wait on `guest-registered` having count 0 instead of on `sign-in-submit`.** Rejected: it is
   true both when `/` has rendered and when it has not yet started to, so it does not order the two
   navigations; `sign-in-submit` exists only on `/`.
5. **Register the spec in `docs/ops/e2e-quarantine.md` as flaky and rely on the CI retry.**
   Rejected: the cause is known and the fix is two lines; the register is for failures that cannot
   yet be fixed.

## Changelog

- `2026-11-17T04:07:33+00:00` — all sections written. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
