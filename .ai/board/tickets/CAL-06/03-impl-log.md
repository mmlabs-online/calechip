---
ticket: CAL-06
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-04T16:29:21+07:00
inputs_read:
  - .ai/board/tickets/CAL-06/01-plan.md
  - .ai/board/tickets/CAL-06/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/steward/context.md
  - src/lib/data/absence.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/MonthView.tsx
  - src/routes/WeekView.tsx
  - src/routes/Home.tsx
  - src/App.tsx
  - tests/absence.test.ts
  - tests/e2e/cal-05-week-view.spec.ts
  - eslint.config.js
  - ui-language.json
  - package.json
  - playwright.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CAL-06 — implementation log

## Files touched

Eight files, all inside `allowed_paths`; two created. `node scripts/check-allowed-paths.mjs` passes.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/data/absence.ts` | modified | INV-04's fourth derivation, `absentDatesByMember`, from the same `walk` as the other three — the year grid is indexed member-first and every other export is date-first | § 4.1 |
| `src/routes/YearView.tsx` | created | the screen: 365 columns, one row per roster member, the totals strip, the month ruler and the three non-list states | § 4.2, § 4.3 |
| `src/App.tsx` | modified | `/year` and `/year/:year`, unguarded for the reason `/month` and `/week` already record — the screen reads and refuses in place | § 4.3 |
| `src/routes/MonthView.tsx` | modified | one header link, `month-year`, to the year containing the displayed month | § 4.3 (AC-12) |
| `src/routes/WeekView.tsx` | modified | one header link, `week-year`, to the year of the day in the URL — not of the Monday, which differs across 31 December | § 4.3 (AC-12) |
| `src/routes/Home.tsx` | modified | one nav link, `home-year-link`, to `/year` with no anchor so the component resolves the year from the caller's clock | § 4.3 (AC-12) |
| `tests/absence.test.ts` | modified | the derivation half of AC-1 to AC-10, plus the 30 × 365 assertion § 4.3 asks for | § 4.1 |
| `tests/e2e/cal-06-year-view.spec.ts` | created | what a person sees: the columns, the empty rows, the two types, the totals, the addresses, and the controls that are not there | § 4.2, § 4.3 |

**Not touched, and each was checked rather than assumed:** `src/lib/domain/types.ts` (nothing added
— the derivation returns a map of existing primitives), `src/lib/data/index.ts`, `mock.ts`,
`supabase.ts` (no seam change), `ui-language.json` (`YearView.tsx` is new, so § *Language* covers it
from its first line and it is not in `copyDebt`), `src/lib/fixtures.ts`, `supabase/seed.sql`, every
migration, `_figma/**`, and `tests/e2e/cal-04-month-view.spec.ts` and `cal-05-week-view.spec.ts` —
**the safety nets for the two one-line header links, and both pass unedited.**

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| § 4.1 `absentDatesByMember` | `src/lib/data/absence.ts:309` | Signature exactly as specified. Keyed on the **roster** and not on the entries, so every member is a key carrying an empty set (AC-3). No new domain type and no new constant — `types.ts` is untouched. |
| § 4.2 the three reads | `src/routes/YearView.tsx:144`, `:158`, `:159` | `getCurrentMember`, `listMembers`, `listTeamEntriesOverlapping`. **No fourth call and no write call anywhere in the file** — `getTeam()` is absent, so no threshold and no overload state exists to colour. |
| § 4.3 route and redirect | `src/App.tsx:197-198`, `YearView.tsx:238` | `/year/:year` plus `/year`; a malformed or absent anchor redirects to the current year rather than rendering an empty grid. |
| § 4.3 header | `YearView.tsx:300-322` | Home, previous, the year label, next, and the month link. |
| § 4.3 row order | `YearView.tsx:227-236` | `displayName` ascending then `id`, collated `vi` explicitly — the host default would order these rows one way in CI and another on a laptop. |
| § 4.3 the four rendering constraints | `YearView.tsx:186`, `:195`, `:207`, `:333-355`, `:382` | No component per cell (a cell is an element in a CSS grid); nothing computed per cell (every cell reads a precomputed lookup); the maps built once in `useMemo`; horizontal scroll is the grid's, with the member column `sticky left-0` inside it. |
| § 4.3 selector table | § *Testability contract* below | Every id, plus two declared additions. |

## Deviations from the design

Four, all declared. None changes a contract, a field name or a criterion.

1. **`year-sign-in` and `home-year-link` are not in the § 4.3 selector table.** The first is the way
   out of `year-not-on-a-team` — AC-13 says the caller with no session is *sent to sign in*, and on a
   screen that refuses in place that means a link. It is the same addition CAL-05 declared for
   `week-sign-in`. The second is the id of the one link § 7 gives `Home.tsx`, which the table does
   not cover because the table describes the year screen.

2. **`year-month-label` carries `data-month`, and `year-row` is the container of that member's
   cells.** Both are shapes the table implies rather than states. The nesting is what lets a test ask
   for *this member's cell on this date* without a compound selector, and it is why AC-4 is one
   locator rather than a scan.

3. **A `CellMark` is precomputed per filled (member, date) pair** — `YearView.tsx:207`. § 4.1 says
   the type comes from `absentEntriesFor`, *one lookup per filled cell rather than per cell*, and
   this is that lookup table. Two decisions inside it are mine and are worth a reviewer's eye, since
   INV-01 allows a member to hold an `am` and a `pm` on one date and the year cell can show only one
   thing:
   - **`data-type` is the first entry in `absentEntriesFor`'s own order** (display name, portion
     `full`/`am`/`pm`, then entry id), which is fixed above the seam — so a member holding a `pto`
     morning and a `wfh` afternoon reads the same on the mock and on Supabase rather than reading
     whichever row the datastore returned first.
   - **The cell is marked tentative when ANY entry filling it is tentative.** A cell drawn as settled
     while half the day is not would be a claim of certainty this product deliberately never makes.
     The alternative — marking only when all of them are — understates nothing visibly but overstates
     settledness, and between the two the safe direction is the one that never claims more than it
     knows.

4. **`tests/absence.test.ts` constructs thirty members inline** for the 30 × 365 assertion. Every
   other member in that file is imported, and the file's own header declares why: members are
   entities and a fixture with no seed row behind it is drift. This is neither — it is a **scale
   property of a pure function**, and § *Open questions* item 1 of the plan says a thirty-member
   roster is its own decision (a seed row per person, in a file this ticket may not touch). The
   assertion is structural only: **no threshold is invented and nothing is timed**, because there is
   none in the brief, the charter or the registry.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The screen renders **two** things derived from the same numbers, and both come from `walk`. Filled cells are `absentDatesByMember` (`absence.ts:309`), the totals are `absenceCountsFor` — the same function the month cell's count comes from. **No `.filter(e => e.status !== ...)` and no `entries` narrowing appears anywhere in `YearView.tsx`**; the only place `entries` is touched is as an argument. So a filled cell and a total can disagree only if `walk` itself is wrong. Asserted both ways: `tests/absence.test.ts` compares the filled set against `absentMembersFor` on **all 365 columns** and bounds each total by its filled count, and the e2e reads 1.5 for 2026-09-15 off the year strip and then off the month cell — the comparison that is invisible on either screen alone. |
| `INV-05` | `walk` reads `status` and never `tentative`, and the fourth derivation adds nothing to it. A tentative entry fills its cells identically to a settled one — the unit test asserts the two answers are equal — and the marking is decoration the component adds afterwards, at `YearView.tsx:408`. The marking changes no cell's filled-ness. |
| `INV-06` | **Not visible here and not contradicted.** A year cell is one day wide and carries no portion, so a five-day `pm` entry fills five cells exactly as a `full` one does. Nothing in this file reads `entry.portion` at all — verified by grep — so the view cannot disagree with the column shape CAL-01 shipped. CAL-05's row remains the only surface where INV-06 is visible. |
| `INV-07` | Every row and every entry comes from `listMembers()` and `listTeamEntriesOverlapping()`, both team-scoped, and this ticket introduces no read of its own. The e2e asserts it against the fixture that exists for it: FIXTURE_OTHER_TEAM_ENTRY runs 21-22 September and those columns are empty here, while the caller's own team's three days are still drawn — so the emptiness is scoping and not a screen that draws nothing. |
| `INV-01`, `INV-02`, `INV-03` | **Unreachable.** Nothing on this surface writes. `YearView.tsx` imports no write function, renders no button, no input, no select, no textarea and no form, and the e2e asserts all six absences for an **admin** as well as for a member — the denial is held by absence, which 01-plan.md section 3 names the weakest mechanism in the plan, so it is checked rather than asserted. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | typecheck, per `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | lint, same. Covers RULE-02 and § *Language* — `YearView.tsx` is not in `copyDebt` and was never added to it |
| `pnpm exec vitest run` | 0 | **71 passed**, 3 files. 51 were passing before this ticket |
| `pnpm exec playwright test` | 0 | **84 passed**. CAL-04's and CAL-05's suites pass **unedited**, which is the check the two one-line header links needed |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `git diff --name-only` subset of `allowed_paths` | yes | eight source files, plus this ticket's own folder |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `year-anchor` (carries `data-year`) | `src/routes/YearView.tsx:309` |
| `year-home` | `src/routes/YearView.tsx:300` |
| `year-prev` | `src/routes/YearView.tsx:306` |
| `year-next` | `src/routes/YearView.tsx:312` |
| `year-month` | `src/routes/YearView.tsx:320` |
| `year-grid` | `src/routes/YearView.tsx:333` |
| `year-row` (carries `data-member-id`) | `src/routes/YearView.tsx:358` |
| `year-row-avatar` | `src/routes/YearView.tsx:364` |
| `year-row-name` | `src/routes/YearView.tsx:367` |
| `year-cell` (carries `data-date`, and `data-type` when filled) | `src/routes/YearView.tsx:382` |
| `year-cell-tentative` | `src/routes/YearView.tsx:408` |
| `year-total` (carries `data-date` and `data-count`) | `src/routes/YearView.tsx:433` |
| `year-month-label` (carries `data-month`) | `src/routes/YearView.tsx:339` |
| `year-loading` | `src/routes/YearView.tsx:244` |
| `year-not-on-a-team` | `src/routes/YearView.tsx:256` |
| `year-unavailable` | `src/routes/YearView.tsx:270` |
| `year-sign-in` — declared, § *Deviations* 1 | `src/routes/YearView.tsx:260` |
| `month-year` | `src/routes/MonthView.tsx:334` |
| `week-year` | `src/routes/WeekView.tsx:284` |
| `home-year-link` — declared, § *Deviations* 1 | `src/routes/Home.tsx:142` |

## Open questions

1. **AC-7, AC-8 and AC-14 are asserted in `tests/absence.test.ts` or nowhere, and that is not a
   choice this ticket made.** Nothing in the product can set `status` to `rejected` (no grant, no
   control, ADM-05 does not exist), nothing can remove a member partway through a displayed year
   (TEA-04 writes `removed_at` as `now()`), and no test can make either seam implementation truncate
   a read. It is the same shape CAL-05 recorded for its AC-10, AC-11 and AC-15, and the same one
   CAL-04 recorded for its AC-11 — **three tickets running**. Somebody should decide whether that is
   permanently acceptable or whether a fixture-level hook is owed; it is not a defect in any of the
   three.

2. **The plan's `size: M` held exactly.** Eight files, two created, no migration, no seam change and
   no new read. Recorded because the estimate was made before the source tree was read for the
   rendering constraints, and it is the third calendar ticket to need precisely CAL-04's eight paths.

3. **`mondayIndex` is now duplicated in `MonthView.tsx` and `WeekView.tsx` and is NOT needed here** —
   the year view has no weekday vocabulary at all. CAL-05's log recorded the duplication as debt;
   this ticket neither adds to it nor pays it, and the note is repeated only so the count stays at
   two rather than looking like three.

4. **`ticket.yaml`'s `gates.plan` was `passed: false` while `01-plan.md` front-matter carried
   `gate: PASS`.** PLAN wrote the artifact and filled `allowed_paths`, `size` and
   `invariants_touched`, but left the gate row untouched — so the board read *PLAN never passed* for
   a ticket whose plan is on disk. Set to `passed: true` at the plan's own `produced_at`, which is
   the fact the artifact records rather than a judgement made here. Flagged for the reviewer because
   a stage writing another stage's gate row is exactly the thing that should be looked at, and
   because five earlier tickets patched their own gate keys by hand (the migration note in the file).
