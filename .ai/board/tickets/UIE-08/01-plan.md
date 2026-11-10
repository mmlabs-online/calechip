---
ticket: UIE-08
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-08T20:28:55+07:00
inputs_read:
  - .ai/board/tickets/UIE-08/ticket.yaml
  - .ai/board/tickets/UIE-08/design/README.md
  - .ai/board/ideas/2026-09-08-the-year-grid-is-the-last-calendar-surface-still-drawn-in-defaults.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-032-the-year-view-replaces-its-member-grid-with-twelve-month-cards.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/git-conventions.md
  - .ai/01-operating-model.md
  - .ai/steward/context.md
  - .ai/board/tickets/UIE-06/01-plan.md
  - src/routes/YearView.tsx
  - src/routes/MonthView.tsx
  - src/routes/WeekView.tsx
  - src/components/Sidebar.tsx
  - src/index.css
  - src/lib/data/mock.ts
  - eslint.config.js
  - ui-language.json
  - tests/e2e/cal-06-year-view.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# UIE-08 — the year grid is repainted onto the product's semantic tokens and its card treatment

## 0. What was measured, and the two findings that decide § 7

**`src/index.css` is NOT in `allowed_paths`, and `ticket.yaml` § 2 left that open.** Every token this
conversion needs already exists: `--color-pto` (`:168`), `--color-wfh` (`:169`), `--color-holiday`
(`:170`), `--color-bg` (`:102`), `--color-card` (`:103`), `--color-ink-2` (`:108`), `--radius-card`
(`:124`) and `--shadow-soft` (`:127-128`). **This is the one difference from UIE-06**, which had to
write `--color-overload` before its conversion could finish. Nothing is owed to the token file here,
so **one file changes.**

**No spec file is in, and that is a measurement rather than a hope.** `tests/e2e/cal-06-year-view.spec.ts`
and `tests/e2e/cal-08-holiday-shading.spec.ts` are the only two suites that address this screen — a
grep over `tests/` and `src/` for every `year-*` selector returns those two files and `src/App.tsx`.
**Neither asserts a class, a colour, a background or a bounding box**: the grep for `bg-`, `class`,
`toHaveCSS` and `background` across both returns nothing at all. Every count and status assertion they
make reads a `data-*` attribute, and § 4 renames none of them.

**ADR-032 re-checked at its own `## Status`: `PROPOSED — awaiting the operator`.** § 1's refusal of the
month cards and the summary band therefore stands, and this plan is written on the assumption that
decision is not taken.

**`depends_on: []` re-checked.** `## BACKLOG` in `.ai/board/backlog.md` holds this ticket and nothing
else live; every other row on the board is `DONE`. No live ticket claims `src/routes/YearView.tsx`.

## 1. Problem and scope

**Feature ID: UIE-08.** Transcribed from `.ai/registry/features.md` without paraphrase:

> The year grid is repainted onto the product's semantic tokens and its card treatment

> **The defect it answers, measured against the tree at this triage rather than recalled:** the year
> view is the LAST calendar surface UIE-01's and UIE-02's tokens never reached. `src/routes/YearView.tsx:385`
> paints a non-working holiday `bg-violet-200` against `bg-slate-100` and `:445` paints WFH
> `bg-emerald-200` and PTO `bg-orange-200`, all raw framework defaults, while `src/index.css:168-174`
> carries `--color-pto`, `--color-wfh`, `--color-holiday` and `--color-overload` and the sidebar legend
> beside this grid already draws from them — **so the legend and the grid it explains are painted from
> two different palettes, permanently side by side**, which is the identical defect UIE-06 closed on the
> month screen the day before. And `:339` is one `overflow-x-auto rounded-2xl bg-white p-4 shadow-sm`
> box: default radius and default shadow where `--radius-card` (`src/index.css:124`) and `--shadow-soft`
> (`:127-128`) exist and every other surface uses them.

> **Scope as promoted, all of it arrangement:** the four fills become the four tokens, and the outer
> box takes the card radius and the soft shadow.

**Which role gains what.** Neither role gains a capability — nothing is added, removed or gated, and no
read changes. What a **member** gains is that the swatch in the sidebar legend and the cell it explains
are finally the same colour, on the one screen where they sit permanently side by side and a year wide.
Today a person reading the year grid has to hold a second palette for one screen: peach in the legend
is `#ffcbaa` and peach in the grid is `#fed7aa`; mint is `#a9e2cd` against `#a7f3d0`; lavender is
`#c9bff0` against `#ddd6fe`. That is small per pixel and total across roughly 10,950 cells, and this is
the last place in the product where it is still true. **An admin gains exactly the same and nothing
more** — this screen has no admin control and § 3 keeps it that way.

**One in-scope edit that is not paint, stated here rather than discovered at REVIEW.**
`src/routes/YearView.tsx:174` still cites `MONTH_ENTRY_LIMIT` as the entry read's truncation mechanism.
CAL-09 removed that constant and its only reader — `src/lib/data/mock.ts:37-38` records the removal and
`:1248-1270` is the paging that replaced it, `TEAM_ENTRY_PAGE_SIZE` with `TEAM_ENTRY_MAX_PAGES`.
**This plan corrects that one comment line**, under the small-defect grant in `.ai/steward/context.md`
§ *Autonomy*: one line, in a file already open, nothing under `.ai/registry/**`. The refusal the
sentence describes is still correct and only its named mechanism is stale, so what changes is the
mechanism name and nothing else. `HOLIDAY_LIMIT` in the same comment is untouched, because it is still
true.

### Out of scope

1. **The twelve month cards, the four summary cards, and the removal of the member dimension.** The
   whole information architecture the reference draws is
   [ADR-032](../../../registry/decisions/ADR-032-the-year-view-replaces-its-member-grid-with-twelve-month-cards.md),
   status `PROPOSED — awaiting the operator`. Nine shipped domain acceptance criteria stop being
   observable under it — CAL-06 AC-3, AC-4, AC-5, AC-6, AC-8, AC-9, AC-10 and CAL-08 AC-7 and AC-11 —
   and `.ai/standards/ui-design-system.md:152-155` puts behaviour, permissions and invariants outside
   the layout grant. **Not anticipated here in any part**, the summary band included: it would be
   additive rather than destructive and it is still ADR-032's question.
2. **The peach→mint blend** the reference draws for a day carrying both a PTO and a WFH entry. It is a
   new day-level derivation — the set of types present on a date, team-wide — and
   `src/routes/YearView.tsx:18-22` forbids this file deriving anything of its own. A gradient is also
   not expressible in the token vocabulary: the four are flat hexes named for meaning
   (`src/index.css:137-139`, `:168-174`). Goes to ADR-032.
3. **`--color-overload` anywhere on this screen.** `src/routes/YearView.tsx:24-26` records that
   `seam.getTeam()` is deliberately not called and that no soft pink appears here. Adding it is a read
   and a domain state, not a colour — ADR-032 open question 5, and § 3 states the same refusal as a
   permission consequence.
4. **Every Vietnamese string in the reference** — `TỔNG ĐƠN PHÉP 2026`, `NGÀY PTO`, `NGÀY WFH`,
   `NGÀY LỄ LỚN`, `Tháng 01`…`Tháng 12`, `Trống`, `Lượt`, `đơn`, `ngày`, `Xem →`, and the weekday row
   `T2`…`CN`. The interface is English — `.ai/standards/ui-design-system.md` § *Language*, the
   operator's own instruction of 2026-09-03 — lint-enforced on JSX text under `src/`
   (`eslint.config.js:85-92`), so several of these **fail the build** rather than failing review, and
   `ui-language.json:21` carries an empty `copyDebt` that only ever shrinks. **UIE-01, UIE-05 and
   UIE-06 each refused the identical request; this is the fourth.**
5. **The shell entirely** — the sidebar, the top bar, the legend card, the `Quá tải (>50%)` row, the
   `▾` after the year, the palette and sign-out buttons, the `Quản trị & Duyệt` pill, and the floating
   `?`. **The trap UIE-05 and UIE-06 both named**: this ticket owns the grid, so nudging a sidebar
   swatch to match the cells it has just repainted will feel like finishing the job. It is still a
   shell edit — and after AC-1, AC-4 and AC-5 the swatches match by construction, because both sides
   then read the same token.
6. **`src/components/Sidebar.tsx:63-64`**, which carries the same three false clauses UIE-06 corrected
   in `src/index.css:141-143` and deliberately left standing there. Correcting a comment in a shell
   file puts the whole file in `allowed_paths`, and RULE-03's guard does not distinguish a comment from
   a rewrite. Reported as Open question 3.
7. **`src/routes/WeekView.tsx`**, including its copy of the same stale `MONTH_ENTRY_LIMIT` line at
   `:296`. A different file, and one line does not buy it a place in `allowed_paths`. Open question 4.
8. **Cell geometry, selectors and copy.** No cell resized, no `data-*` attribute moved or renamed, no
   `title` string reworded, no test file opened. AC-11 and AC-15 are the assertions.
9. **§ *Colour* and § *Type* in `.ai/standards/ui-design-system.md`.** Still bare `TODO(project)` stubs
   and human plane under RULE-01 — a developer may write a token in `src/index.css` and may not record
   it there. This is the fourth screen repainted against a palette with no document behind it. Open
   question 1.

`size_estimate`: **S**.

## 2. Acceptance criteria

Colours are given as the computed `rgb()` a browser resolves the token to, because that is what is
observable from outside the system; the hex beside it is the token's value in `src/index.css`.

**AC-1 — a non-working holiday in the day-status strip is drawn in the holiday token**
- Given the year view is in its `ready` phase and a date in the anchor year carries a holiday whose
  `nonWorkingReason` is `holiday`
- When the year grid is rendered
- Then the `year-daystatus-cell` whose `data-date` is that date has computed `background-color`
  `rgb(201, 191, 240)` — `--color-holiday`, `#c9bff0`, the same value the sidebar's `Holiday` legend
  swatch resolves to — and its `data-day-status` is still `holiday`

**AC-2 — every other day in the strip is drawn in the ground token**
- Given a date in the anchor year that is not a non-working holiday — an ordinary working day, a
  weekend, or a Saturday mandated `working`
- When the year grid is rendered
- Then that `year-daystatus-cell` has computed `background-color` `rgb(241, 239, 250)` — `--color-bg`,
  `#f1effa` — and its `data-day-status` value is unchanged from before this ticket

**AC-3 — a bridge day keeps its dot, in ink rather than in a framework grey**
- Given a date whose `data-bridge` is `true`
- When the year grid is rendered
- Then that cell's own background is AC-2's value — a bridge day is a working day and takes no
  lavender — and it contains exactly one `aria-hidden` dot whose computed `background-color` is
  `rgb(90, 84, 128)`, `--color-ink-2`, `#5a5480`

**AC-4 — a PTO cell is drawn in the PTO token**
- Given a member is away on a date and the entry the grid resolves for that cell is `pto`
- When the year grid is rendered
- Then the `year-cell` at that `data-date` in that member's `year-row` carries `data-type="pto"` and
  has computed `background-color` `rgb(255, 203, 170)` — `--color-pto`, `#ffcbaa`, the same value the
  sidebar's `Leave (PTO)` legend swatch resolves to

**AC-5 — a WFH cell is drawn in the WFH token**
- Given a member is away on a date and the entry the grid resolves for that cell is `wfh`
- When the year grid is rendered
- Then that `year-cell` carries `data-type="wfh"` and has computed `background-color`
  `rgb(169, 226, 205)` — `--color-wfh`, `#a9e2cd`, the same value the sidebar's `Working from home
  (WFH)` legend swatch resolves to

**AC-6 — an empty cell stays a faint rule, in the ground token**
- Given a member is not away on a date
- When the year grid is rendered
- Then that `year-cell` carries **no** `data-type` attribute and has computed `background-color`
  `rgb(241, 239, 250)` — `--color-bg` — so 365 columns still give the eye a grid to follow rather than
  a field of white

**AC-7 — the tentative treatment survives the substitution untouched**
- Given a member's entry on a date is tentative
- When the year grid is rendered
- Then that `year-cell` carries its `data-type`, has AC-4's or AC-5's computed `background-color` for
  its type, has computed `opacity` `0.5`, and still contains `year-cell-tentative` carrying the text
  `Tentative` — the fill carries no alpha of its own, so "away" and "settled" stay separable
  (CAL-06 AC-6, INV-05)

**AC-8 — the grid surface takes the card radius, the card ground and the soft shadow**
- Given the year view is in its `ready` phase
- When the year grid is rendered
- Then the element wrapping `year-grid` has computed `border-radius` `26px` (`--radius-card`),
  computed `background-color` `rgb(255, 255, 255)` (`--color-card`) and a computed `box-shadow` equal
  to `--shadow-soft`; and horizontal overflow still scrolls on that element and not on the page

**AC-9 — the sticky first column shows no seam against that surface**
- Given the year grid is scrolled horizontally
- When the sticky first column is rendered over the cells passing under it
- Then the ruler corner, the `Calendar` label, every member-name cell and the `Away` label each have
  the same computed `background-color` as AC-8's surface

**AC-10 — the four non-grid cards take the same treatment as the grid**
- Given the year view is in its `loading`, `not-on-a-team` or `unavailable` phase, or is `ready` for a
  year whose holiday read returned no rows
- When that card is rendered
- Then `year-loading`, `year-not-on-a-team`, `year-unavailable` and `year-holidays-empty` each have
  computed `border-radius` `26px`, computed `background-color` `rgb(255, 255, 255)` and a computed
  `box-shadow` equal to `--shadow-soft`, and each keeps its `data-testid`, its `role` where it has one,
  and its text exactly as shipped

**AC-11 — no selector, attribute or string changes (refusal)**
- Given `tests/e2e/cal-06-year-view.spec.ts` and `tests/e2e/cal-08-holiday-shading.spec.ts` as they
  stand on `origin/main`
- When they are run against this change with neither file edited
- Then both pass; and `year-grid`, `year-month-label` with `data-month`, `year-daystatus`,
  `year-daystatus-cell` with `data-date` / `data-day-status` / `data-bridge`, `year-row` with
  `data-member-id`, `year-row-avatar`, `year-row-name`, `year-cell` with `data-date` / `data-type`,
  `year-cell-tentative`, `year-total` with `data-date` / `data-count`, `year-loading`,
  `year-not-on-a-team`, `year-sign-in`, `year-unavailable` and `year-holidays-empty` all still exist
  under those names carrying the same values, and every `title` string is byte-identical

**AC-12 — filled-ness and counts are identical before and after (refusal, INV-04)**
- Given the mock seam over `src/lib/fixtures.ts` and the same anchor year
- When the year view is rendered before this change and after it
- Then for every `year-cell` the presence and value of `data-type` is identical, and for every
  `year-total` the value of `data-count` is identical — the repaint changes no filled-ness, no count
  and no row ordering, and introduces no second definition of the absence count

**AC-13 — no overload colour and no gradient reach this screen (refusal)**
- Given any state of the year view
- When it is rendered
- Then no element on the screen has computed `background-color` `rgb(255, 228, 230)`
  (`--color-overload`), and every `year-cell` and `year-daystatus-cell` has computed
  `background-image` `none`

**AC-14 — the screen stays English and the build stays clean (refusal)**
- Given the lint configuration at `eslint.config.js:85-92`
- When the lint runner is run over `src/`
- Then it reports nothing for `src/routes/YearView.tsx`, no rendered text node on the year screen
  contains a Vietnamese diacritic, and `ui-language.json:21`'s `copyDebt` is still empty

**AC-15 — cell geometry is unchanged (refusal)**
- Given the year grid in its `ready` phase
- When it is rendered
- Then `year-daystatus-cell` has computed `height` `12px` and `year-cell` computed `height` `16px`,
  each still has computed `border-radius` `2px`, the grid column template and the `gap-px` gutters are
  unchanged, and no cell gains or loses a border

### Invariants touched

**`[INV-04, INV-05, INV-06]`.**

- **INV-04** — the `Away` strip is `absenceCountsFor` and the grid beside it is `absentDatesByMember`;
  `src/routes/YearView.tsx:468-471` records that the two coming from one pass is what makes a
  divergence detectable at all. A repaint must put no filter, no sum and no `.length` over entries into
  this file — `:18-22` forbids it in terms. **AC-12 is the assertion**, and it is written as a
  before/after identity rather than as a promise about the source, because only the first can be
  observed from outside the system.
- **INV-05** — a tentative entry counts exactly as a settled one does, and on this screen the
  distinction is carried by `opacity-50` plus an `sr-only` word (`:446-460`) rather than by a border.
  **A token with alpha in it — or a fill whose own transparency composed with `opacity-50` — is where
  "tentative" and "settled" stop being distinguishable.** The three fills this ticket introduces are
  flat opaque hexes (`src/index.css:168-170`), so the distinction survives untouched. **AC-7 is the
  assertion.**
- **INV-06** — an entry carries exactly one portion and a one-day-wide cell cannot show a half day, so
  a `0.5` reads on this screen as a whole day. **That is true today and paint does not make it worse.**
  It is named so the plan records having looked rather than concluding it away; the fix would be cell
  geometry, which § 1 puts out of scope and AC-15 forbids.

### Open questions

Each is an assumption that ships, not a question that blocks. None changes an AC.

1. **The four token values still have no document behind them.** § *Colour* in
   `.ai/standards/ui-design-system.md` is a bare `TODO(project)` and is human plane under RULE-01, so
   `src/index.css` is the de-facto design system and this is the fourth screen conforming to it.
   Carried unchanged from UIE-01, UIE-05 and UIE-06 — recorded again because it has not moved.
2. **`--color-ink-2` for the bridge dot is a colour pick, and it is this plan's.** No existing token
   equals `slate-500` (`#64748b`), so any substitution moves a value. `#5a5480` on `--color-bg` is
   roughly 5.9:1 where `slate-500` is roughly 4.0:1, so the 4px dot gains contrast rather than losing
   it — but it is a pick with nothing behind it, and § 8 alternative 3 is where to argue with it.
3. **`src/components/Sidebar.tsx:63-64` still carries the three clauses UIE-06 found false** — that no
   calendar view computes an overload state, that `seam.getTeam()` is called by none of them, and that
   the token would have no consumer. `src/routes/MonthView.tsx` has called it since 2026-09-04. Left
   standing for UIE-06's reason: a comment fix would put a shell file in `allowed_paths`.
4. **`src/routes/WeekView.tsx:296` carries the same stale `MONTH_ENTRY_LIMIT` line** this plan corrects
   at `src/routes/YearView.tsx:174`. Different file, out of scope, reported so it is not read as
   already handled.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

**Sixth time in this group, and the same reason UIE-05 and UIE-06 gave.** An image was shown in
conversation on 2026-09-08 and **was never on disk** — `git ls-files` holds nothing for it and the
harness wrote no temp copy — so `product` wrote a hand transcription at the canonical path,
`.ai/board/tickets/UIE-08/design/README.md`. `.ai/standards/ui-design-system.md:108-119` describes
moving an **attached file**; nothing was attached in the sense that section means, and the
transcription says of itself that it is *evidence of intent* and *not a specification*. **A later
reader cannot check one sentence of it against the picture.** No second image was handed to `/plan`,
and it is a different image again from UIE-05's, UIE-06's, and the shell mockup UIE-02 through UIE-04
were built against.

**What the transcription gives, this plan takes**: that PTO is peach, WFH is mint and a holiday is
violet — which is the palette the product already holds — and that the surfaces on this screen are
rounded cards with a soft shadow. Nothing else in it is buildable here.

**What it asks for and this plan refuses**, each with its reason in § 1: the twelve month cards, the
four summary cards, the removal of the member dimension, the peach→mint blend, and every Vietnamese
string.

**What it is silent about and this plan keeps anyway — silence is not removal.** The sticky member
column and one row per roster member (CAL-06 AC-3); the month ruler; the `Calendar` day-status strip
with `data-day-status` and `data-bridge` (CAL-08 AC-7, AC-11); the `Away` totals strip carrying
`data-count` (CAL-06 AC-9, AC-10); the tentative treatment (CAL-06 AC-6); the `year-holidays-empty`
sentence (CAL-08 AC-8); and the three non-list states (CAL-06 AC-13, AC-14). It is also silent on
hover, focus, dark mode, any width below desktop, a year with no entries at all, and a leap year.
**None of those is a removal, and AC-11 is what says so in a form a reviewer can check.**

**One silence that matters more than it looks**: the picture draws no overloaded day anywhere,
although the sidebar legend it also draws carries the `Quá tải` row. It is therefore no evidence for an
overload colour on this screen, which agrees with `src/routes/YearView.tsx:24-26` and with § 1 item 3.

## 3. Permission model

**This screen is read-only for both roles and this ticket changes nothing about that.** The reads it
makes are `seam.listMembers()`, `seam.listTeamEntriesOverlapping(range)` and
`seam.listHolidays(holidayReadRange(range))` (`src/routes/YearView.tsx:165-169`), and all three are
granted to both roles in `.ai/standards/rbac-and-security.md`: `Read any entry in the team` ✅/✅
(`:31`), `Read the holiday calendar` ✅/✅ (`:38`), `Read the member list` ✅/✅ (`:40`). **No read is
added, removed or re-scoped**, and § 7 puts no data file in `allowed_paths`, so the set is closed by
the path list as well as by intent.

**Where the check lives: on the server side of the boundary, in the row-level security policies —
ADR-005.** Nothing in this file is an authorization mechanism and nothing in this ticket makes it one.
There is no interface-level gate here to weaken, because there is no control here at all.

**The denials, and they are held by absence rather than by a check.** No approve, no reject, no edit,
no delete, no create, and no draft panel — for either role. `src/routes/YearView.tsx:11-16` records
that this is the weakest mechanism in CAL-06's plan and how it is verified: by reading the imports and
finding no write function and no control. **This ticket adds neither**, and § 4 changes no import. An
admin reaching `seam.updateEntry` from a console still succeeds, correctly, because CAL-03 granted it;
what this surface guarantees is only that no write reaches it.

**The overload refusal is a permission consequence, not a colour one.** Painting an overloaded day
needs `seam.getTeam()` for `overloadThreshold` — a fourth read this screen does not make, that § 7's
path list does not enable, and that this plan does not grant.

**Check R6 reads this section: no role gate changes, no new capability, no new read, no new control.**

## 4. Contract

**No exported signature, prop type, state shape, module boundary or seam call changes.**
`src/routes/YearView.tsx` exports one default component taking no props, and that is unchanged:

```tsx
// src/routes/YearView.tsx — unchanged by this ticket
export default function YearView(): JSX.Element;
```

The import set is unchanged, the `useMemo` derivations are unchanged, the `columns` grid template is
unchanged, and no function is added to or removed from this file. **The contract of this ticket is the
class-string substitution**, and it is enumerated so the Developer invents no name:

| # | Line | Element | From | To |
|---|---|---|---|---|
| 1 | `:270` | `year-loading` | `rounded-2xl bg-white … shadow-sm` | `rounded-card bg-card … shadow-soft` |
| 2 | `:281` | `year-not-on-a-team` | `rounded-2xl bg-white … shadow-sm` | `rounded-card bg-card … shadow-soft` |
| 3 | `:296` | `year-unavailable` | `rounded-2xl bg-white … shadow-sm` | `rounded-card bg-card … shadow-soft` |
| 4 | `:339` | the grid surface | `overflow-x-auto rounded-2xl bg-white p-4 shadow-sm` | `overflow-x-auto rounded-card bg-card p-4 shadow-soft` |
| 5 | `:342` | ruler corner, sticky | `bg-white` | `bg-card` |
| 6 | `:367` | `Calendar` label, sticky | `bg-white` | `bg-card` |
| 7 | `:385` | day-status fill | `"bg-violet-200" : "bg-slate-100"` | `"bg-holiday" : "bg-bg"` |
| 8 | `:391` | bridge dot | `bg-slate-500` | `bg-ink-2` |
| 9 | `:412` | member-name cell, sticky | `bg-white` | `bg-card` |
| 10 | `:445` | member cell fill | `"bg-slate-100" : … "bg-emerald-200" : "bg-orange-200"` | `"bg-bg" : … "bg-wfh" : "bg-pto"` |
| 11 | `:476` | `Away` label, sticky | `bg-white` | `bg-card` |
| 12 | `:508` | `year-holidays-empty` | `rounded-2xl bg-white … shadow-sm` | `rounded-card bg-card … shadow-soft` |

Rows 7 and 10 in full, so neither ternary is re-derived:

```tsx
// :385
status?.nonWorkingReason === "holiday" ? "bg-holiday" : "bg-bg",

// :445
!mark ? "bg-bg" : mark.type === "wfh" ? "bg-wfh" : "bg-pto",
```

**Every name on the right already exists.** Tailwind 4's `@theme` generates the utility from the token
(`src/index.css:87-90`): `--color-pto` → `bg-pto`, `--color-wfh` → `bg-wfh`, `--color-holiday` →
`bg-holiday`, `--color-bg` → `bg-bg`, `--color-card` → `bg-card`, `--color-ink-2` → `bg-ink-2`,
`--radius-card` → `rounded-card`, `--shadow-soft` → `shadow-soft`. **Address them through utilities and
never through `var()`** — a utility is how Tailwind knows a token is used.

**Nothing enters the cell loop.** Rows 7, 8 and 10 are literal string swaps inside ternaries that
already exist and already run per cell. **No lookup, no derivation and no class function may be added**
— roughly 10,950 cells is why every cell is an element reading precomputed values rather than a
component (`src/routes/YearView.tsx:332-338`, `:363-365`), and the substitution is chosen so the
per-cell work is unchanged to the character.

**The thirteenth edit, and it is prose.** `src/routes/YearView.tsx:174` — the comment on the
`unavailable` branch stops citing `MONTH_ENTRY_LIMIT` and cites CAL-09's paging bound instead
(`TEAM_ENTRY_PAGE_SIZE` × `TEAM_ENTRY_MAX_PAGES`, `src/lib/data/mock.ts:37-38`, `:1248-1270`). The
sentence's claim — that the branch draws no grid rather than one missing the entries the read dropped —
is unchanged, and `HOLIDAY_LIMIT` in the same comment is untouched because it is still correct.

**Check R5 reads this section:** twelve class substitutions and one comment, in one file, with no
signature, no field name and no new identifier anywhere.

## 5. Seam impact

**None.** No function in `src/lib/data/index.ts` changes name, arity or behaviour; none is added; none
is removed. `src/routes/YearView.tsx` calls exactly the three it called before, and it goes on
importing `absenceCountsFor`, `absentDatesByMember`, `absentEntriesFor`, `eachDateInRange`,
`dayStatusesFor` and `holidayReadRange` directly, as it did. `tests/seam-parity.test.ts` has nothing to
see.

**RULE-02 is untouched**: this file names no implementation and imports neither `./supabase` nor
`./mock`, before or after.

## 6. Schema delta

**`none`.** No migration, no policy, no trigger, no constraint, no index and no column. Every file in
`allowed_paths` sits above the data-access seam and none contains SQL. ADR-014's test — a migration
touching a policy, trigger or constraint is not `none` — does not engage, because there is no migration
of any kind. `requires_adr: false`.

**The scoped clause in `ticket.yaml` is discharged rather than ignored.** That row said the correct
verdict from PLAN is `BLOCKED` with `requires_adr: true` if the plan concluded it needed anything the
picture draws beyond the four fills and the card treatment — a month card, a summary number, a
day-level fill, a gradient, or an overload colour. **It concluded none of those**: § 1 refuses all five
and no AC in § 2 reaches any of them. The two additions this plan makes beyond the literal phrase "the
four fills and the card treatment" — the four non-grid cards (contract rows 1, 2, 3, 12) and the bridge
dot (row 8) — are not things the picture draws, so neither triggers the clause.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/UIE-08/**"
  - "src/routes/YearView.tsx"
```

**One file outside the ticket folder. `size: S`** — `.ai/01-operating-model.md:372` puts S at up to
six. **`size_estimate` and `size` agree at S, so ADR-012 never engages**; § 1's estimate was written
before the source read and the count confirms it. `ticket.yaml` deliberately withheld triage's signal
so PLAN would measure rather than inherit; measured, it is S.

**`src/index.css` is out, and § 0 is the reason.** Every token the conversion needs already exists.
This is the one place UIE-08 is cheaper than UIE-06, which had to add `--color-overload` before its own
conversion could finish — and it is why this ticket is one file where that one was two.

**No spec file is in, and § 0 is the measurement rather than the hope.** The only two suites that
address this screen assert no class, no colour and no bounding box; every count and status assertion
they make reads a `data-*` attribute that § 4 preserves and AC-11 asserts. **A test asserting a computed
colour would be the honest home for AC-1 through AC-6**, and writing one would put a spec file in this
list — deliberately not done, for the reason § 8 alternative 5 gives.

**`src/components/Sidebar.tsx` is deliberately out**, although after this ticket its legend swatches
and the cells they explain finally resolve to the same values. Nothing there has to change for that to
be true — both sides read the same token — and putting a shell file in the list for a comment is the
trade UIE-06 already refused.

## 8. Rejected alternatives

1. **Build what the reference draws — twelve month cards, four summary cards, no member dimension.**
   Genuinely plausible: it is the picture the operator showed, and read against that image this plan
   looks like it refuses most of the request. **Rejected because it is not a layout change.** Nine
   shipped domain acceptance criteria stop being observable under it, and
   `.ai/standards/ui-design-system.md:152-155` puts behaviour and invariants outside the layout grant
   entirely. It is ADR-032's question, that ADR is `PROPOSED — awaiting the operator`, and ADR-008's
   test is to decide inside the envelope and ask before changing it. **The honest cost is stated in
   `ticket.yaml` § 5 and repeated here: if ADR-032 is later accepted, this ticket's work is thrown away
   rather than adjusted.** That is the one asymmetry with the UIE-06 / ADR-031 pair, where the pending
   change was a one-line deletion — and it is still not a reason to fold the two together, because
   folding them deletes nine criteria inside a ticket whose stated scope is a palette.

2. **Add a `--color-empty` token for the empty cell instead of reusing `--color-bg`.** Plausible: an
   empty cell is not the page ground, it is a rule inside a white card, and naming it separately would
   let it be repainted without touching the ground. **Rejected because `src/routes/MonthView.tsx:53`
   already maps the same meaning to `bg-bg`** — UIE-06 converted `bg-slate-100/60` to it — and a second
   ground token would give one meaning two answers on two neighbouring calendar screens. That is the
   defect this ticket exists to close, relocated rather than fixed.

3. **Leave the bridge dot as `bg-slate-500`.** The strongest alternative here and it nearly won. No
   existing token equals `#64748b`, so any substitution moves a value, and UIE-06's own rule for
   `--color-overload` was that tokenisation must not be a colour decision — *no pixel changes value*.
   By that rule the dot stays. **Rejected on the narrower ground that this ticket is not tokenisation
   at constant value in the first place**: AC-1, AC-4 and AC-5 all move a pixel, deliberately, because
   the whole defect is that the grid and the legend disagree. Against that, leaving one `slate-*` inside
   a grid whose stated purpose is that raw framework defaults are gone leaves the file half-converted
   for two characters, and `--color-ink-2` is darker than `slate-500` on `--color-bg`, so the 4px dot
   gains contrast rather than losing it. **It is still a pick, and Open question 2 is where to argue.**

4. **Leave the three non-list states and the empty-calendar card on `rounded-2xl` / `shadow-sm`.**
   Plausible: they are not the grid, and § 1 could have drawn the line at `:339`. **Rejected because
   `year-holidays-empty` renders directly under the repainted grid** — a 16px card against a 26px one,
   both visible at once, is the two-palettes defect in radius instead of colour. The other three are
   alternates of the same surface and cost three more lines in a file already open. `ticket.yaml` § 2
   named this as PLAN's call and as the only thing that could move the file count; it does not move it.

5. **Write a Playwright spec asserting the computed colours, so AC-1 through AC-6 have a named test.**
   Plausible, and the only alternative here that would make this plan's own criteria checkable by
   something other than a person reading. **Rejected on two grounds.** It would pin the hex values in a
   second place, so the next palette change breaks a test rather than repainting a screen — which is
   exactly what naming the tokens for meaning was meant to avoid (`src/index.css:137-139`). And there is
   no QA stage since ADR-022, so the spec would be written by the same session that wrote the criterion,
   against the same reading of it. **The trade is stated rather than hidden**: AC-1 through AC-6 and
   AC-8 through AC-10 are observable in principle and are checked by a reviewer reading § 4's table
   against the diff, not by a runner.

6. **Record the four values in `.ai/standards/ui-design-system.md` § *Colour* while a screen that uses
   them is open.** Plausible and overdue — four screens now conform to a palette with no document.
   **Rejected because that file is human plane under RULE-01**: a developer may write a token in
   `src/index.css` and may not record it there. It would also put a standards path in `allowed_paths`,
   which R1 and CI both check. It stays Open question 1, for the fourth time.

## Changelog

- `2026-09-08T20:28:55+07:00` — plan written. Raised by `tech-lead-design`. Authored by
  `tech-lead-design`.
- `2026-09-08T20:28:55+07:00` — **the order the template asks for was not followed exactly, and this
  entry is the substitute for the check ADR-019 removed.** § 1 and § 2 were drafted from `ticket.yaml`,
  the feature row and the transcription, but `src/index.css` and `src/routes/YearView.tsx` were read
  before § 2 was committed to the file, because AC-1 through AC-6 quote token values and a criterion
  citing a hex from memory is exactly the invention `CLAUDE.md` § *Working agreements* forbids. **No AC
  was weakened by what the read found.** Two were made stricter by it: AC-7 gained the clause about a
  fill carrying alpha of its own, and AC-12 was rewritten from a source-level claim ("this file contains
  no `.filter`") into a before/after identity on rendered `data-type` and `data-count`, because the
  first form cannot be observed from outside the system and RULE-16 requires that it can.
- `2026-09-08T20:28:55+07:00` — § 1 and § 7 record one edit beyond paint: the stale
  `MONTH_ENTRY_LIMIT` comment at `src/routes/YearView.tsx:174`, taken under the small-defect grant in
  `.ai/steward/context.md` § *Autonomy*. `ticket.yaml` § 8 asked PLAN to say which it did; this is it.
