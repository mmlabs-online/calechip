---
ticket: UIE-06
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-08T09:14:23+07:00
inputs_read:
  - .ai/board/tickets/UIE-06/01-plan.md
  - .ai/board/tickets/UIE-06/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - src/routes/MonthView.tsx
  - src/routes/WeekView.tsx
  - src/components/AppShell.tsx
  - src/components/Sidebar.tsx
  - src/index.css
  - src/App.tsx
  - tests/e2e/cal-04-month-view.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
  - playwright.config.ts
  - node_modules/tailwindcss/theme.css
  - node_modules/tailwindcss/dist/lib.mjs
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# UIE-06 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/MonthView.tsx` | modified | the whole ticket: the width cap deleted, the weekday strip lifted out of `month-grid`, 35 tiles rebuilt as one ruled card with 170px rows, the six framework colours swapped for tokens, and the bridge badge moved off the holiday's row | § 4.2, § 4.3, § 4.4, § 4.5, § 4.6, § 4.8, § 4.9, § 4.10 |
| `src/index.css` | modified | adds `--color-overload`, the one token § 4.6's conversion needs and does not have, and corrects the comment at :141-143 that refused it on three false clauses | § 4.6, § 4.7 |
| `.ai/board/tickets/UIE-06/03-impl-log.md` | created | this file | — |

`git diff --name-only` returns exactly those three plus `.ai/board/tickets/UIE-06/ticket.yaml`
(state, below) and `.ai/board/tickets/UIE-06/01-plan.md` (PLAN's, uncommitted since ADR-006). Every
one is inside `allowed_paths`. **No test file was opened, and none needed to be** — § 7's claim held.

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.2 — the grid fills the pane (AC-1) | `src/routes/MonthView.tsx:383` | `mx-auto flex max-w-5xl flex-col gap-6` → `flex h-full flex-col gap-6`. Measured at 1563px: the card is 1299px wide, which is the pane less its own `px-6`. `documentScrollsSideways` is false at 1563px, 1280px and 1024px. |
| § 4.3 — the weekday strip lifts out (AC-2) | `src/routes/MonthView.tsx:424-430` | The seven labels were `month-grid`'s first seven children; they are now a sibling `grid grid-cols-7 gap-px` above the card, on the page ground. `gap-px` and not `gap-1` so the labels keep the cell grid's exact column geometry — measured, label 0 and cell 0 share `x=240` and `width=184.703125` at 1563px. Still `month-weekday`, still `Mon`…`Sun`. |
| § 4.4 — one ruled card, taller cells (AC-3, AC-4) | `src/routes/MonthView.tsx:441`, `:454-455` | Card is `flex flex-1 flex-col overflow-hidden rounded-card bg-card shadow-soft`; the grid inside is `grid flex-1 auto-rows-[minmax(170px,1fr)] grid-cols-7 gap-px bg-line`. **The hairlines ARE the gaps** — 1px of `--color-line` showing between cells that each paint their own opaque background. Measured: card `border-radius: 26px`, `overflow: hidden`, cell `border-top-left-radius: 0px`, grid background `rgb(228, 224, 244)` = `#e4e0f4` = `--color-line`. |
| § 4.5 — the out-of-month tint (AC-5, AC-6) | `src/routes/MonthView.tsx:498` | `bg-slate-100/60 text-slate-400` → `bg-bg text-ink-3`. Measured: an out-of-month cell is `rgb(241, 239, 250)` = `#f1effa` = `--color-bg`, against `--color-holiday` `#c9bff0` — distinguishable, and never the same colour. AC-6's three attributes are untouched code and `cal-08:499-503` still passes. |
| § 4.6 — the token conversion (AC-7, AC-8) | `src/routes/MonthView.tsx:498`, `:504`, `:511-512`, `:596`; `src/index.css:174` | The six from the plan's table, plus the two other framework defaults in the same class list — see *Deviations*. |
| § 4.7 — the false comment corrected in one file, reported in the other | `src/index.css:141-162` | Corrected here; `src/components/Sidebar.tsx:63-64` left standing and not opened, so no shell file entered `allowed_paths`. |
| § 4.8 — the top-right collision (AC-9, AC-10) | `src/routes/MonthView.tsx:520-528`, `:540-549` | The numeral-and-count row is byte-for-byte unchanged. The badge left the holiday's `flex flex-wrap` row and took its own `flex justify-end` line below it. Measured on 2026-10: the badge's right edge sits 8px from the cell's right edge — the cell's own `p-2` — and its top is below the numeral's bottom. Fill is `rgba(0, 0, 0, 0)`. |
| § 4.9 — the gesture survives (AC-17) | `src/routes/MonthView.tsx:518`, and the two handlers unchanged | `onMouseDown`/`onMouseEnter` were on the cell element and stayed on it; no cell element was replaced, only re-classed. The ring is now `ring-2 ring-inset ring-ink-3`. **`ring-inset` is not cosmetic** — Tailwind's default ring draws OUTSIDE the border box, and across a 1px hairline it would paint onto the neighbouring cell. Measured mid-drag across three cells: `rgb(143, 137, 179) 0px 0px 0px 2px inset`, three cells ringed. |
| § 4.10 — no breakpoint (decided at PLAN) | `src/routes/MonthView.tsx:455` | `grid-cols-7` is bare, at every width. Measured at 1024px: still seven columns, still 170px rows, no sideways document scroll. |

## Deviations from the design

**One, and it is an addition inside a class list the plan already had open — not a change of shape.**

§ 4.6's table names six conversions. The cell's class list held **two more framework defaults the
table does not list**, and both are converted:

| Also converted | Line | Why |
|---|---|---|
| `text-slate-400` → `text-ink-3` | `MonthView.tsx:498` | It is the *other half of the out-of-month treatment* — the same conditional, the same clause, the same visual state § 4.5 is about. Leaving it would satisfy AC-7's enumerated Given while failing its Then, *"none is a framework default colour"*, on the very treatment the AC names. |
| `ring-slate-400` → `ring-ink-3` | `MonthView.tsx:518` | The last framework colour in the grid. `#8f89b3` against the `#e4e0f4` hairlines, which is what § 4.9 asks the ring to stay legible against. |

Both are ink rather than fill, neither is in AC-7's Given, and neither changes a rendered *meaning*.
**They are declared here rather than left for the reviewer to find in the diff**, because R5 would
otherwise read two unplanned class changes as scope growth.

**Nothing else.** No selector renamed, no attribute added or dropped, no handler moved, no seam call
added, no prop added, no file created outside the ticket folder, no test opened, no string
translated, `month-cell-count` and `month-threshold` both kept, and the bridge badge still outlined.

## Colour, measured rather than asserted

`--color-overload: #ffe4e6` is claimed by § 4.6 to be *exactly* today's `bg-rose-100`. **Checked
against the installed Tailwind rather than recalled**, because v4 ships its palette in `oklch` and
not in v3's hex: `node_modules/tailwindcss/theme.css` gives `--color-rose-100: oklch(94.1% 0.03
12.58)`, and rasterising that in Chromium yields `[255, 228, 230]` — byte-identical to `#ffe4e6`.
**The overload cell does not change colour.** The other three fills deliberately do, and that
difference is AC-8, the whole point:

| | was (v4 default, rasterised) | is now |
|---|---|---|
| holiday | `violet-100` `#ede9fe` | `--color-holiday` `#c9bff0` |
| PTO avatar | `orange-100` `#ffedd4` | `--color-pto` `#ffcbaa` |
| WFH avatar | `emerald-100` `#d0fae5` | `--color-wfh` `#a9e2cd` |
| out-of-month | `slate-100/60` | `--color-bg` `#f1effa` |
| overloaded cell | `rose-100` `#ffe4e6` | `--color-overload` `#ffe4e6` — **no change** |

The first three are now the exact tokens `Sidebar.tsx:68-70` draws the legend swatches from, which
is AC-8 and is the defect § 1 named: the legend and the grid it explained were painted from two
different palettes, permanently side by side.

## 01-plan.md Open question 1, answered

**The question was whether a percentage min-height resolves through `min-h-screen` → `flex min-h-0
flex-1` → `flex-1`, or needs an explicit `calc(…)`. It needs a rendered viewport, so it was
rendered.** Probed against a real `vite preview` build at 1563×1010, 1563×1440 and 1280×800, on a
five-row month (April 2026), a six-row month (August 2026) and a month that holds entries
(September 2026).

**The percentage resolves, and no `calc()` is needed** — the same answer UIE-05 measured for the
week column. A calc would be wrong here for UIE-05's reason as well: `App.tsx:88` renders
`seam-banner` *above* the shell on every mock build, which is every build the acceptance suite
drives, so this screen's top edge measures 80px down rather than the top bar's 70px.

**But the declaration is `h-full` and not `min-h-full`, and measuring is what decided that.**

- `min-h-full` was written first. A percentage **minimum** on a box whose own height is indefinite
  resolves to `auto`, so the flex column below had no free space to distribute and
  `auto-rows-[minmax(170px,1fr)]` never reached its `1fr`. Measured at 1563×1440: five-row April
  stopped at 854px of cells with ~244px of empty pane beneath it. **That is AC-4's first clause
  failing.**
- With `h-full`: the same April measures 218.8px cells and a card bottom of 1324px in a 1360px pane
  — the 36px left over is `month-empty`, a sibling *below* the card. September, which holds entries
  and so draws no empty sentence, measures a card bottom of 1416px against a pane bottom of 1440px:
  exactly the pane's own `pb-6`. **AC-4's first clause passes.**
- **The clipping `h-full` looked like it would cause does not happen.** `h-full` is a hard height and
  the card carries `overflow-hidden`, but the card is a flex *item* whose `min-height: auto` is its
  content, so a six-row month makes the **card** 1025px and overflows the section rather than being
  cut by it. `card.scrollHeight === card.clientHeight` on every viewport and month shape probed, and
  cells hold their 170px. **AC-4's second clause passes: nothing scrolls inside the card.**

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The count was never touched. `month-cell-count` renders from the same `counts.get(date)` on the same line of the same `justify-between` row, and `absenceCountsFor` is still the only arithmetic on this screen — no filter, no length, no comparison was written into this file. The taller cell was the temptation § 2 warned about and it was not taken: `absentMembersFor` still decides which faces appear, so a member holding an `am` and a `pm` entry is still one face and one whole day of count. The badge that moved is `month-cell-bridge`, which carries no number. |
| `INV-05` | A tentative avatar still carries `border border-dashed border-current opacity-60`, unchanged, and it is still counted like any other entry because nothing about counting changed. The risk § 2 named was the dashed border getting lost against a new border treatment — **and the ruled grid deliberately has no borders at all.** The hairlines are `gap-px` over `bg-line` at `#e4e0f4`; the dashed avatar border is `currentColor` ink inside a `rounded-full` chip. They are a different colour, a different shape and a different scale, and no cell, card or chip gained a border in this change. |
| `INV-06` | `month-cell-count` survives, in the top-right, on the line it already owned — § 4.8 gave the bridge badge the next line rather than that slot precisely so it would. On this screen a half day's avatar is identical to a full day's, so `0.5` in the corner is the only place a portion is expressible here, and it is still drawn. Refusing the image's deletion of it (§ 1 item 1) is what keeps this true; ADR-031 stays `PROPOSED` and nothing here anticipates it. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | the typecheck command named in `.ai/standards/testing-standards.md:16` |
| `pnpm exec eslint .` | 0 | `:17`. AC-20: no file added to `copyDebt`, no Vietnamese string added |
| `pnpm exec vitest run` | 0 | `:18` — 186 passed, 10 files |
| `pnpm exec playwright test` | 0 | `:19` — **165 passed**, including all of `cal-04`, `cal-08` and `adm-01`. AC-19: no test file edited |
| `git diff --name-only` subset of `allowed_paths` | yes | three files under `src/` and the ticket folder; nothing else |

**AC-19 is the one worth stating plainly: the entire suite passes with no edit to any test file**,
which is what § 0 measured and § 7 predicted rather than hoped.

## Testability contract

01-plan.md carries no selector table (§ 4 says no selector is renamed or removed). This is the
before-and-after of every one on the screen, which is AC-19's evidence.

| selector | Exists at | changed? |
|----------|-----------|----------|
| `month-grid` | `src/routes/MonthView.tsx:454` | same name, same role — now holds only the 35/42 cells, the seven labels having left it (AC-2) |
| `month-weekday` | `:426` | same name, same text, now a sibling above the card |
| `month-cell` | `:471` | unchanged, with `data-date`, `data-in-month`, `data-count`, `data-overloaded`, `data-day-status`, `data-bridge` all untouched |
| `month-cell-count` | `:524` | unchanged, still top-right on the numeral's line |
| `month-cell-bridge` | `:543` | same name, same text, same outline — moved to its own right-aligned line (AC-10) |
| `month-cell-holiday` | `:559` | same name, same `data-kind`, same `title` — now its own line rather than sharing the badge's row |
| `month-avatar` | `:580` | unchanged, with `data-member-id`, `data-type`, `data-tentative`, `data-status` |
| `month-threshold` | `:399` | untouched, with `data-threshold` and `data-current-members` (AC-16) |
| `month-empty` | `:622` | untouched (AC-18) |
| `month-entry-panel` | `:631` | untouched |
| `month-loading` | `:311` | untouched |
| `month-not-on-a-team` / `month-sign-in` | `:319`, `:321` | untouched |
| `month-unavailable` | `:330` | untouched |

## Open questions

1. **The entry panel now opens below the fold, and this is a consequence of AC-4 that no criterion
   catches.** The card fills the pane by design, so `month-entry-panel` — the only creation path on
   this screen — renders under it. Measured at 1280×800: after a drag the form's top is at document
   `y = 1104`, roughly 300px below the viewport. **The gesture works and AC-17 passes**: the range
   selects, the cells ring, the panel opens, and `cal-04:199-217` passes unedited because Playwright
   scrolls to a locator. **A person does not get scrolled.** The same is true of `month-empty`.
   I did not fix it: the fix is a layout decision (move the panel above the grid, or scroll it into
   view) and originating layout is `tech-lead-design`'s grant, not the Developer's — 01-plan.md § 2b
   records that the image shows no form at all, so there is nothing to build against. **This is for
   the reviewer to route rather than for me to choose.**
2. **`src/components/Sidebar.tsx:63-64` still carries the false claim** that no calendar view
   computes an overload state. § 4.7's decision, carried out: the comment is corrected in
   `src/index.css` and reported here rather than fixed there, so no shell file entered
   `allowed_paths`. Two lines for whoever next opens that file.
3. **`--color-overload` now exists with no legend row to explain it**, which is 01-plan.md *Open
   questions* item 3, unchanged by anything built here. § 1 item 7 is why the row is not added: it
   needs a `seam.getTeam()` call the shell does not make, and it would have to state a threshold
   ADM-01 lets an admin change.
4. **`ticket.yaml`'s `gates.plan` is still `{ passed: false, at: null }` and `state` was `BACKLOG`
   when this stage started**, although `01-plan.md`'s front-matter reads `gate: PASS` and
   `next_state: READY`. I set `state: REVIEW` because this command instructs me to, and **I did not
   write the `plan` gate row** — that is not mine to record. `/ship` requires both gates, so somebody
   has to reconcile it before then.
