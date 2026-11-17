---
ticket: BUG-009
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-17T03:45:00Z
inputs_read:
  - .ai/board/tickets/BUG-009/ticket.yaml
  - .ai/board/tickets/BUG-009/00-bug-report.md
  - .ai/board/tickets/UIE-09/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/standards/testing-standards.md
  - tests/e2e/uie-09-admin-hub.spec.ts
  - tests/e2e/adm-02-holidays.spec.ts
  - tests/e2e/support/org-prefix.ts
  - src/routes/Holidays.tsx
  - src/components/AdminTabs.tsx
  - src/App.tsx
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-009 — plan

## 1. Problem and scope

Feature implemented against, transcribed from `.ai/registry/features.md:211`:

| ID | Feature | Group | Status |
|----|---------|-------|--------|
| UIE-09 | An admin hub screen at `/admin`, reachable from one control in the top bar | UIE | DONE |

The criterion at stake is UIE-09 AC-4, `.ai/board/tickets/UIE-09/01-plan.md:139`: *"each destination
opens the screen it names … Then each opens the screen at its address, and each of those screens
renders exactly as it does today"*. The screen behind the holidays destination is governed separately
by ADM-02 AC-9 — `/holidays` with no year resolves to the caller's current year — which
`tests/e2e/adm-02-holidays.spec.ts:246-261` asserts.

Nobody gains a capability. What is repaired is the end-to-end gate: the UIE-09 AC-4 test asserts that
following the holidays link leaves the browser at an address ending in `/holidays`, an address the
product deliberately does not stay on. The test passes only when Playwright reads the URL before the
redirect lands, so under parallel workers it fails intermittently and every pull request carries a
red that means nothing. A gate that is red for no reason trains its readers to rerun instead of read.

**Root cause — settled at PLAN by reading the code, not by reproduction.** The report marked it
*suspected*. Three facts, each on disk, make it certain rather than likely:

1. `src/App.tsx:624-629` renders `<Holidays />` at `/holidays` (no `:year`).
2. `src/routes/Holidays.tsx:223` returns `<Navigate to={`/holidays/${currentYear()}`} replace />`
   whenever the year param is absent, before any ready-phase markup — so `holidays-year` never
   renders at `/holidays`, only at `/holidays/<yyyy>`.
3. `tests/e2e/uie-09-admin-hub.spec.ts:253` polls `toHaveURL(/\/holidays$/)` for that destination.
   Once the redirect has replaced the entry, no retry can match.

The assertion therefore holds only in the window between the click and the redirect. Reproduction in
this environment was not possible (no Playwright browser is installed here); the reasoning above does
not depend on it, and the regression criterion below makes the failure deterministic rather than
statistical.

**Out of scope.**

- The five other intermittent specs the operator listed alongside this one (`tsk-01:279`,
  `tsk-02:109`, `uie-10:208`, `evt-07`, `mir-19-d-flip AC-5`). Each is its own `BUG-nnn`.
- Pointing the hub link straight at `/holidays/<year>` (`src/components/AdminTabs.tsx:192`). Rejected
  in section 8; the product's behaviour is correct and is not changed by this ticket.
- Re-asserting *which* year the redirect chooses. That is ADM-02 AC-9 and is already asserted at
  `tests/e2e/adm-02-holidays.spec.ts:256`.
- Any change to `src/**`, to UIE-09's `01-plan.md`, or to the quarantine register (this test is not
  quarantined, and nothing here quarantines it).

`size_estimate: S` — one spec file, two edits in it.

## 2. Acceptance criteria

**AC-1 — the holidays destination is asserted at the address it settles on**
- Given a signed-in admin on `/admin`, running `tests/e2e/uie-09-admin-hub.spec.ts` test
  *"AC-4: each destination opens the screen it names"*
- When the `admin-hub-holidays-link` row is followed
- Then the test asserts the page URL matches `/holidays/` followed by exactly four digits at the end
  of the path, and does not assert that it ends in `/holidays`

**AC-2 — the other six destinations are asserted exactly as before**
- Given the same test
- When each of `admin-hub-pending-link`, `admin-hub-team-entries-link`, `admin-hub-members-link`,
  `admin-hub-allow-list-link`, `admin-hub-threshold-link` and `admin-hub-teams-link` is followed
- Then the URL is asserted to end in that destination's `path`, unchanged from today

**AC-3 — the URL is read after the screen has rendered, not before**
- Given the same test, for every destination
- When a link is followed
- Then the destination's landmark is asserted visible first and the URL is asserted second, so the
  URL assertion reads the address the screen settled on and never a transient one

**AC-4 — the link itself still points at `/holidays`**
- Given the same spec's test *"AC-3: the hub lists exactly seven destinations and no eighth"*
- When it reads `data-to` and `href` of the rows
- Then it still expects `/holidays` for the holidays row — `DESTINATIONS[].path` is unchanged

**AC-5 (regression) — R10**
- Test: `tests/e2e/uie-09-admin-hub.spec.ts`, test *"AC-4: each destination opens the screen it names"*,
  end-to-end, the level at which the defect is visible.
- On `origin/main` it fails intermittently under parallel workers:
  `CI=1 pnpm exec playwright test tests/e2e/uie-09-admin-hub.spec.ts:248 --repeat-each=30 --workers=2`
  produces failures at the URL assertion, received `…/holidays/<yyyy>`.
- **The deterministic form, which the Developer records in `02-impl-log.md`:** with AC-3's reordering
  applied and the `origin/main` URL expectation (`/holidays$`) left in place, the test fails on every
  run, because `holidays-year` exists only after the redirect. With AC-1's expectation it passes on
  every run, including `--repeat-each=30 --workers=2`.

**Refusals.** None changed. AC-6 and AC-7 of the same spec (member refused, member-less redirected)
are not edited.

**Invariants touched.** `[]` — a test-only change; no domain rule is read or written.

**Open questions.** None. The two in `00-bug-report.md` are decided here, under ADR-067 as ordinary
PLAN decisions on a test, not on behaviour:

- *Assert the settled URL, or re-point the hub link?* Assert the settled URL. ADM-02 AC-9 defines
  `/holidays` as the product's address for "this year", the sidebar link for members uses the same
  address, and AC-3 of this spec asserts it. See section 8.
- *Compute "this year" as adm-02 does?* No — match four digits. Which year is ADM-02's criterion and
  is asserted there; computing it here would couple UIE-09 to the runner's clock and fail across
  midnight on 31 December for a reason unrelated to the hub.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(There is no layout in this ticket: no file under `src/` is touched and nothing renders differently.)

## 3. Permission model

Unchanged. No route, guard, seam call or control is added, removed or re-gated. The spec still signs
in as `FIXTURE_ADMIN` for AC-4; the denials in its AC-2, AC-6 and AC-7 are not edited.

## 4. Contract

Test-only. One optional field is added to the element type of `DESTINATIONS` in
`tests/e2e/uie-09-admin-hub.spec.ts`, and it is the only new name this ticket introduces.

```ts
const DESTINATIONS: readonly {
  testId: string;
  path: string;
  landmarks: readonly [string, ...string[]];
  /** The address the screen settles on, when it is not `path` itself. Absent means `path$`. */
  settledPath?: RegExp;
}[] = [
  // … the six other entries unchanged, with no `settledPath` …
  {
    testId: "admin-hub-holidays-link",
    path: "/holidays",
    landmarks: ["holidays-year"],
    // ADM-02 AC-9: `/holidays` redirects to `/holidays/<yyyy>` (src/routes/Holidays.tsx:223). BUG-009.
    settledPath: /\/holidays\/\d{4}$/,
  },
  // …
];
```

Inside test *"AC-4: each destination opens the screen it names"*, the two assertions after the click
become, in this order:

```ts
await page.getByTestId(destination.testId).click();
await expect(landmarkOf(page, destination.landmarks)).toBeVisible();
await expect(page).toHaveURL(destination.settledPath ?? new RegExp(`${destination.path}$`));
```

Everything else in the loop body (the return leg through `shell-admin-link`) is unchanged. The
comment block above the URL assertion is the Developer's to adjust so it names BUG-009 and the order.

## 5. Seam impact

None.

## 6. Schema delta

none

## 7. allowed_paths

```yaml
allowed_paths:
  - "tests/e2e/uie-09-admin-hub.spec.ts"
```

`size: S` — one path. Agrees with `size_estimate: S`.

`glossary_owed` is `[]`; no glossary row is written and `.ai/registry/glossary.md` is not on the list.

## 8. Rejected alternatives

- **Point the hub link at `/holidays/<current year>`** (`AdminTabs.tsx:192`). It would make the
  original regex true with no redirect. Rejected: it changes product code to suit a test; it bakes a
  render-time clock read into a static tab table that has none today; it splits the address for one
  screen between two links (`Sidebar.tsx`'s member link stays `/holidays`); and it would change this
  spec's AC-3 href assertion and UIE-09's shipped behaviour for no user-visible gain.
- **`page.waitForURL(/\/holidays\/\d{4}$/)` before the existing assertion, holidays only.** Fixes the
  race but leaves a special case inline in the loop and keeps the URL read ahead of the landmark,
  which is the ordering that let a transient address be asserted in the first place. The data-driven
  `settledPath` plus landmark-first ordering fixes the class, not the instance.
- **Assert `/holidays/${new Date().getFullYear()}` as adm-02 does.** Rejected in section 2 *Open
  questions*: the year is ADM-02's criterion and the clock coupling adds a failure mode on
  31 December.
- **Quarantine the test under ADR-060.** The cause is known and the fix is two lines; a quarantine
  would trade a known defect for a register row and an expiry date.

## Changelog

- `2026-11-17T03:45:00Z` — all sections written. Root cause moved from *suspected* to settled by code
  reading (section 1); both report open questions decided (section 2). Raised by `tech-lead-design`.
  Amended by `tech-lead-design`.
