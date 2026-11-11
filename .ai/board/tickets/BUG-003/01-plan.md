---
ticket: BUG-003
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-11T03:23:57+00:00
inputs_read:
  - .ai/board/tickets/BUG-003/ticket.yaml
  - .ai/registry/features.md            # UIE-10 row
  - .ai/registry/invariants.md
  - .ai/standards/rbac-and-security.md  # "Read the holiday calendar" — all three roles
  - .ai/01-operating-model.md           # § Sizing
  - .ai/board/ideas/2026-09-09-the-sidebar-holds-every-address-and-grows-with-the-role.md
  - .ai/board/tickets/CICD-01/01-plan.md   # § 2.0 bisect + sufficiency, § 8 alternative 1
  - .ai/board/tickets/CICD-01/04-review.md
  - .ai/board/tickets/MIR-15-e/03-impl-log.md
  - .ai/board/tickets/UIE-10/01-plan.md
  - docs/ops/e2e-quarantine.md
  - scripts/check-docs.mjs               # D15
  - src/components/Sidebar.tsx
  - src/components/AdminTabs.tsx
  - src/components/TopBar.tsx
  - src/lib/roles.ts
  - src/lib/period.ts
  - tests/role-guards.test.ts
  - tests/e2e/uie-10-sidebar.spec.ts
  - tests/e2e/uie-09-admin-hub.spec.ts
  - tests/e2e/adm-02-holidays.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-003 — restore the sidebar's general links and lift their twenty quarantines

## 1. Problem and scope

**Feature implemented** — transcribed from `.ai/registry/features.md` (row title; the row's notes are
long and are cited, not copied):

| ID | Title | Status |
|---|---|---|
| UIE-10 | The sidebar gives up its admin links and restyles its roster; the specs route through the hub | DONE |

The row's own decision, verbatim: **"THE THREE GENERAL LINKS STAY — `home-week-link`,
`home-year-link`, `home-holidays-link` — AND THIS IS A DECISION TAKEN AT TRIAGE, NOT AN OVERSIGHT."**

**What is broken.** The sidebar `<nav>` that renders those three links is wrapped in a JSX comment
(`src/components/Sidebar.tsx:533-545` today; `:507-519` when CICD-01 bisected it), introduced by
commit `2259136` "chaneg UI" and first reaching `main` in PR #87. Twenty shipped end-to-end criteria
across ADM-01, ADM-02, ADM-03, ADM-04, CAL-06, UIE-09 and UIE-10 have failed since and are
quarantined as `test.fixme` against this ticket (`docs/ops/e2e-quarantine.md`, 20 rows), with an
expiry of **2026-11-12**. CICD-01 § 2.0 showed one cause explains all twenty: removing only the two
comment delimiters made the whole group pass.

**Who gains what.** A **member** regains their only route to the national holiday calendar —
`/holidays` is linked from exactly one place for a member (`AdminTabs.tsx:192` is admin-only through
`mayAdminister`), and reading that calendar is a permission every role holds
(`rbac-and-security.md:65`). **Every role** regains a route back to a calendar from the routes where
the top bar draws no period switcher (`TopBar.tsx:150` gates it on `periodNavFor`, which returns
`null` off the period routes). And the twenty criteria run again instead of being skipped.

**The decision this ticket owed** (its `ticket.yaml`: "restoring the links versus rewording the
shipped criteria is this ticket's decision"): **restore the links.** Reasons in § 8. No shipped
criterion is reworded.

**Out of scope**

1. Any change to the links' look, order, labels or targets — they come back exactly as they were
   shipped by UIE-10, with one mechanical change to the role test (§ 4.1).
2. Any other quarantine row: `evt-09` (BUG-004) and the two *flaky* rows (BUG-005) stay as they are.
3. `tests/e2e/adm-03-holiday-writes.spec.ts` › `MIR-15-e AC-4`, which reaches `/holidays/2026` by
   address as a workaround for this bug (MIR-15-e impl-log deviation 4). It passes either way and its
   criterion is written as an address; changing it is not needed to close this ticket.
4. Folding the `reachHolidays` helper's fallback through `shell-admin-link`
   (`adm-02-holidays.spec.ts:89-108`). It works once the member link exists again.
5. A test asserting the manager's view of the three links. No shipped criterion names a manager here;
   inventing one is not a PLAN output. The behaviour follows from § 4.1 and is described in § 3.
6. Any redesign of the sidebar the `2259136` change may have been reaching for. If the operator wants
   the links gone, that is a new idea through `/idea`, and it has to answer UIE-10's triage findings
   (the stranded `/holidays`, the non-period routes) — not a silent comment.

**`size_estimate`: M** — one source file, seven spec files and the register.

## 2. Acceptance criteria

The twenty quarantined criteria are not restated: each is a shipped AC of its own ticket and is
asserted by its existing test, by title, unchanged. The criteria below are what *this* ticket must
make true.

**AC-1 — the three general links render again, by role**
- Given a signed-in **member**
- When any route inside the shell is open
- Then `home-week-link`, `home-year-link` and `home-holidays-link` each resolve to exactly one node in
  the sidebar
- And given a signed-in **admin** on the same routes, `home-week-link` and `home-year-link` each
  resolve to exactly one node and `home-holidays-link` resolves to **zero** — an admin's route to the
  calendar is the hub's `admin-hub-holidays-link`, and neither role is offered two.

**AC-2 — the links go where they went**
- Given the sidebar is rendered
- When `home-week-link`, `home-year-link` or `home-holidays-link` is pressed
- Then the address becomes `/week`, `/year` or `/holidays` respectively, each with no anchor, and the
  screen resolves the current period from the caller's clock.

**AC-3 — the twenty quarantined tests run, and pass**
- Given the twenty tests listed in `docs/ops/e2e-quarantine.md` with Ticket `BUG-003`
- When the end-to-end suite runs (`pnpm e2e`)
- Then each of them is declared with `test(` rather than `test.fixme(`, its title is unchanged, the
  `// QUARANTINED BUG-003 …` comment above it is gone, and it passes.

**AC-4 — the register no longer carries them**
- Given the twenty tests run again
- When `node scripts/check-docs.mjs` runs
- Then `docs/ops/e2e-quarantine.md` has no row whose Ticket is `BUG-003`, the BUG-004 and BUG-005 rows
  are byte-identical to before, and D15 reports nothing.

**AC-5 — the refusal still holds (no role gate moves)**
- Given a signed-in member
- When the sidebar is rendered
- Then no admin-only link (`home-pending-entries-link`, `home-team-entries-link`,
  `home-allow-list-link`, `home-threshold-link`) is rendered — UIE-10 AC-1 is unchanged by the restore
- And the role test that hides `home-holidays-link` from an admin is `mayAdminister(member.role)`, so
  `tests/role-guards.test.ts` (MIR-17-b / MIR-17-e AC-4: no literal role comparison in
  `src/components/Sidebar.tsx`) still passes.

**Invariants touched: `[]`.** INV-01 … INV-07 range over `entry` and `member` rows and the absence
count. This change renders three links and edits test declarations; it writes no row, reads no
entry, and calls no seam function.

**Open questions:** none. The one decision the ticket carried is taken in § 1 and argued in § 8.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(The layout is UIE-10's shipped one, restored unchanged — nothing in it is newly arranged by this
plan.)

## 3. Permission model

Navigation is an affordance, never a control (ADR-005). No route guard changes.

| Control | member | manager | admin | Server side |
|---|---|---|---|---|
| `home-week-link` → `/week` | shown | shown | shown | route needs a session |
| `home-year-link` → `/year` | shown | shown | shown | route needs a session |
| `home-holidays-link` → `/holidays` | shown | shown | **hidden** — the hub tab is the admin's route | route needs a session, not a role; `holiday_select_all` is the read policy |

Denials: none is added or removed. The manager row follows from `AdminTabs.tsx:197` (`forManager:
false`) and `:315`: a manager is not offered `admin-hub-holidays-link`, so the sidebar link is their
route, and every role ends with exactly one. The four admin links stay removed for every role (AC-5).

## 4. Contract

No new function, type, field, prop or selector. Every name below already exists.

### 4.1 `src/components/Sidebar.tsx`

1. **Import** — line 75 becomes exactly:

   ```ts
   import { mayAdminister, ROLE_LABELS } from "@/lib/roles";
   ```

2. **The `<nav>` block** — remove the `{/* ` that opens it and the ` */}` that closes it, and change
   the one role test. The result is exactly:

   ```tsx
   <nav className="flex flex-col gap-0.5">
     <Link data-testid="home-week-link" to="/week" className={NAV_LINK}>
       This week
     </Link>
     <Link data-testid="home-year-link" to="/year" className={NAV_LINK}>
       The year
     </Link>
     {mayAdminister(member.role) ? null : (
       <Link data-testid="home-holidays-link" to="/holidays" className={NAV_LINK}>
         Public holidays
       </Link>
     )}
   </nav>
   ```

   `member.role === "admin"` must not come back verbatim: `tests/role-guards.test.ts:37` fails on a
   literal role comparison in this file. `mayAdminister` is `role === "admin"` exactly
   (`src/lib/roles.ts`), so behaviour is identical and matches `AdminTabs.tsx:315`.

3. **`NAV_LINK`'s comment (`:105-107`)** — delete the line
   `// eslint-disable-next-line @typescript-eslint/no-unused-vars` (the constant is used again), and
   replace the two comment lines above it with exactly:

   ```ts
   // The look of the three general links in the sidebar <nav>. That <nav> was commented out by
   // 2259136 ("chaneg UI") and restored by BUG-003 — 20 shipped e2e criteria depend on it.
   ```

4. **The long comment above the `<nav>`** (`:496-532`) is left as it stands; it describes the block
   correctly once the block renders. Append nothing else.

### 4.2 The seven spec files — for each of the twenty tests

For every test whose register row names `BUG-003`, in:

`tests/e2e/adm-01-threshold.spec.ts` (1), `tests/e2e/adm-02-holidays.spec.ts` (9),
`tests/e2e/adm-03-holiday-writes.spec.ts` (2), `tests/e2e/adm-04-worklist.spec.ts` (1),
`tests/e2e/cal-06-year-view.spec.ts` (1), `tests/e2e/uie-09-admin-hub.spec.ts` (3),
`tests/e2e/uie-10-sidebar.spec.ts` (3)

- delete the line `  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.`
- change `test.fixme(` on the next line to `test(`
- change nothing else — not the title, not the body. D15 matches register rows by file and title.

After the edit `grep -rn "BUG-003" tests/` returns nothing and
`grep -rn "test.fixme" tests/e2e/` returns only `evt-09-create-invitation.spec.ts`.

### 4.3 `docs/ops/e2e-quarantine.md`

Delete the twenty table rows whose Ticket cell is `BUG-003` (today lines 26-45). Leave the header,
the prose and the three other rows untouched. This is the ADR-060 exit "fixed (the test runs again and
the row is deleted)".

### 4.4 Verification the Developer runs

```
pnpm typecheck
pnpm lint
pnpm test                    # includes tests/role-guards.test.ts
node scripts/check-docs.mjs  # D15 clean
CI=1 pnpm exec playwright test tests/e2e/adm-01-threshold.spec.ts tests/e2e/adm-02-holidays.spec.ts tests/e2e/adm-03-holiday-writes.spec.ts tests/e2e/adm-04-worklist.spec.ts tests/e2e/cal-06-year-view.spec.ts tests/e2e/uie-09-admin-hub.spec.ts tests/e2e/uie-10-sidebar.spec.ts
```

The last line is the CICD-01 sufficiency selection; it must report the twenty as passed, not skipped,
and no failures. Record the counts in `03-impl-log.md`.

## 5. Seam impact

none.

## 6. Schema delta

none. No migration, policy, trigger or constraint.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/components/Sidebar.tsx"
  - "tests/e2e/adm-01-threshold.spec.ts"
  - "tests/e2e/adm-02-holidays.spec.ts"
  - "tests/e2e/adm-03-holiday-writes.spec.ts"
  - "tests/e2e/adm-04-worklist.spec.ts"
  - "tests/e2e/cal-06-year-view.spec.ts"
  - "tests/e2e/uie-09-admin-hub.spec.ts"
  - "tests/e2e/uie-10-sidebar.spec.ts"
  - "docs/ops/e2e-quarantine.md"
```

Nine files → **`size: M`**, agreeing with `size_estimate: M`; ADR-012 is not engaged.
`glossary_owed` is `[]`, so no glossary row is written and `.ai/registry/glossary.md` is not listed.

## 8. Rejected alternatives

1. **Reword the twenty shipped criteria to match a sidebar with no links, and delete or rewrite their
   tests.** This is what `2259136` would require if it was the intended end state. Rejected: UIE-10's
   triage established, and the code still confirms, that the links are load-bearing — a member has no
   other route to `/holidays` (`AdminTabs.tsx:192` is behind `mayAdminister`), and on the non-period
   routes the top bar draws no switcher (`TopBar.tsx:150`, `period.ts` `periodNavFor` → `null`), so
   the week and year links are the only way back to a calendar from three screens. Rewording would
   amend accepted criteria in five DONE features (ADM-02 AC-15 among them, which protects a member's
   access to the national calendar) on the strength of a commit message that gives no reason. It
   would also need a replacement route for a member, i.e. new design and new criteria — a feature,
   not a bug fix.
2. **Uncomment the block verbatim** — the CICD-01 sufficiency experiment, "one line". Rejected as
   written because the tree moved since that experiment: MIR-17-b/e added
   `tests/role-guards.test.ts`, which forbids `member.role === "admin"` in `Sidebar.tsx`, so the
   verbatim restore turns `pnpm test` red. § 4.1 uses `mayAdminister`, identical in behaviour.
3. **Re-date the twenty register rows and defer.** Only the operator may re-date a row (register
   prose), and it would leave a member with no route to the holiday calendar for another 30 days
   with the fix already known.

## Changelog

- `2026-11-11T03:23:57+00:00` — all sections written. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
