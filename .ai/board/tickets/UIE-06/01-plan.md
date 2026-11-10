---
ticket: UIE-06
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-08T08:49:36+07:00
inputs_read:
  - .ai/board/tickets/UIE-06/ticket.yaml
  - .ai/board/tickets/UIE-06/design/README.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md
  - .ai/registry/decisions/ADR-031-the-month-cell-renders-no-absence-count.md
  - .ai/standards/ui-design-system.md
  - .ai/01-operating-model.md
  - src/routes/MonthView.tsx
  - src/routes/WeekView.tsx
  - src/routes/YearView.tsx
  - src/components/AppShell.tsx
  - src/components/Sidebar.tsx
  - src/index.css
  - tests/e2e/cal-04-month-view.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
  - tests/e2e/adm-01-threshold.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# UIE-06 — the month grid becomes one ruled full-width card with taller cells, on the product's tokens

## 0. What was measured, and the one finding that changes § 7

**`depends_on: []` re-checked.** UIE-01 through UIE-05 are all `DONE` — UIE-05 shipped in PR #72
this morning, so the collision `ticket.yaml` § 3 warned about (both tickets wanting `src/index.css`)
cannot occur: UIE-05 needed no token and is merged. No live ticket claims a path. **ADR-031 is
`PROPOSED — awaiting the operator`**, confirmed at its own `## Status`, so § 5.1's refusal stands.

**§ 2's "already shipped" list is accurate**, verified in `src/routes/MonthView.tsx`: the day numeral
is top-left, the avatars are `rounded-full` chips wrapping under it, mint and peach are in place, the
cell carries no name or type label, an overloaded day's whole background is soft pink, Monday-first
with leading and trailing cells, and out-of-month days are grey. **A plan that did not know this would
rewrite working code to arrive where it already is.**

**§ 5.2 is confirmed, and it is worse than a stale comment — it is the reason § 3.7 needs a token.**
`MonthView.tsx:175` calls `seam.getTeam()` and `:347` computes `isOverloaded`. So
`src/index.css:141-143` — *"no calendar view computes an overload state, `seam.getTeam()` is
deliberately not called by any of them, and a token with no consumer is a colour nobody can check
against a screen"* — is false in all three clauses, and has been since CAL-04 shipped on 2026-09-04,
the day **before** those comments were written. **The consequence is § 4.6**: the token conversion
would leave the overloaded cell's `bg-rose-100` as the one raw Tailwind default among six tokens,
because the token that block refused is exactly the one it needs.

**Zero spec files are needed, and that is measured rather than hoped:**

- **No test addresses `month-weekday` at all**, so lifting the weekday strip out of `month-grid` is
  free — `cal-08` uses `month-grid` only as a readiness signal and `cal-04` counts `month-cell`.
- **No test asserts a class, a colour or a bounding box** on this screen. Every `toBeVisible()` in
  the three month-touching specs is on `month-grid`, `month-empty`, `month-entry-form` or a shell
  element, all of which survive.
- **`cal-08:499-503` asserts `data-day-status=""`, `data-bridge="false"` and `data-count=""` on an
  out-of-month October cell viewed from September** — the statelessness CAL-08 AC-14 requires, and
  the reason § 4.5's colour clause is not pedantry.

**One correction to § 3.4's arithmetic, in the same direction.** The pane is
`AppShell.tsx`'s `min-w-0 flex-1` with `px-6`; the grid is not capped by anything but its own
`max-w-5xl`. A six-row month at ~170px is ~1020px of cells before the weekday strip, and the
viewport below the 70px top bar is ~1010px. **§ 3.4 is right that an AC saying the grid fills the
viewport is unsatisfiable roughly half the year**, and § 4.4 writes `at least` instead.

## 1. Problem and scope

The feature ID this plan implements, transcribed from `.ai/registry/features.md` without paraphrase:

| ID | Capability | Group | Status | Invariants touched |
|---|---|---|---|---|
| UIE-06 | The month grid becomes one ruled full-width card with taller cells, on the product's tokens | UIE | PLANNED | [] |

**No role gains a capability.** This is the operator's second image of the day and the month grid is
**the only calendar surface the product's own palette never reached, and the only one still capping
its own width.** Three facts, each re-measured above: the grid is painted from Tailwind defaults —
`bg-white`, `bg-slate-100/60`, `bg-violet-100`, `bg-rose-100`, `bg-emerald-100`, `bg-orange-100` —
while `Sidebar.tsx:68-70` draws the legend that explains it from `bg-pto`, `bg-wfh` and `bg-holiday`,
**so the legend and the grid it explains are painted from two different palettes, permanently side by
side on screen**; `:314` is `mx-auto max-w-5xl` where the week and year views have both had that cap
deleted; and a cell is `min-h-24` against the image's ~170px, so the densest screen in the product is
drawn small in the middle of a screen with room for more — which is the one thing `CLAUDE.md`
§ *Visual direction* singles this screen out for.

**Out of scope.** The first three would each amend a registry row rather than a layout.

1. **Deleting `month-cell-count`.** The image deletes it and that is a domain amendment: CAL-04 AC-3
   states INV-04's formula in words, and § *Visual specification* puts behaviour and invariants
   outside the grant. **Position is arrangement; presence is domain.** ADR-031 is `PROPOSED` and
   awaiting the operator; this ticket is planned on the assumption the decision is not taken, does not
   anticipate it, and does not approximate it. **Nothing would catch the deletion if it happened
   here** — no test addresses that selector and every count assertion reads `data-count` on
   `month-cell` — which makes it more dangerous to treat as a restyle, not less.
2. **Deleting `month-threshold`.** The image is silent about it, not negative. It is
   `adm-01-threshold.spec.ts:222-224`'s **only proof that a saved threshold reaches the calendar**,
   and `MonthView.tsx:327-329` gives the reason it renders at all: an overloaded day is otherwise a
   colour with no explanation.
3. **Filling the bridge badge.** The image's badge is a filled pink pill; **pink is the overload
   fill**, and filling it paints the crowded-day colour onto a working day and gives soft pink a
   second meaning on one grid. The shipped badge is outlined with no fill and stays that way.
   `cal-08:254` asserts a count of one and would not catch this.
4. **Translating any copy into Vietnamese.** Every string in the image is Vietnamese. It reverses
   `.ai/standards/ui-design-system.md:46-48`, the operator's own instruction of 2026-09-03;
   `copyDebt` is empty and only ever shrinks; UIE-01 and UIE-05 each refused the identical request.
   **`CẦU` would fail the build rather than review** — the lint rule matches `JSXText` against
   `[À-ɏḀ-ỿ]` and `Ầ` is U+1EA6.
5. **The shell.** `Sidebar.tsx`, `TopBar.tsx`, `AppShell.tsx`, `App.tsx` — including the fourth
   legend row, the `TEAM (8)` roster, the `▾`, the icon buttons, the `Quản trị & Duyệt` pill and the
   floating `?`. **This includes the false comment at `Sidebar.tsx:63-64`**; § 4.7 explains why this
   plan corrects `index.css`'s copy of it and not the shell's.
6. **The week and year views**, and **`src/lib/fixtures.ts`** — the image's roster of eight is
   fictional and nothing may be asserted from it, including its overload arithmetic.
7. **An overload legend row anywhere.** It needs a team read the shell does not make. And if one is
   ever built it may not read `>50%`: the threshold is per-team and admin-settable, ADM-01 shipped
   it, and a fixed `50` becomes a lie the moment an admin uses the feature.
8. **Filling § *Colour* or § *Type*** in `.ai/standards/ui-design-system.md` — human plane, RULE-01,
   and still the steward's.
9. **Dark mode**, stated rather than left silent.

`size_estimate: S`. One component's layout plus one token, with much of the cell already shipped.

## 2. Acceptance criteria

**AC-1 — the grid fills the pane**
- Given a signed-in member on `/month/:month`
- When it renders
- Then the grid spans the full width of the content pane, with no centred maximum width of its own

**AC-2 — the weekday strip sits on the page ground, above the card**
- Given the month screen
- When it renders
- Then the seven weekday labels are outside the white card, on the page background, above it, each
  still addressable as `month-weekday` and reading `Mon` through `Sun`

**AC-3 — the grid is one ruled card**
- Given the month screen
- When it renders
- Then the day cells sit inside a single white rounded card with one soft shadow; cells are separated
  from one another by hairline rules rather than by gutters of background; and only the card's four
  outer corners are rounded

**AC-4 — cells are taller, and a six-row month still fits by scrolling**
- Given a month that occupies five rows, and separately one that occupies six
- When each renders
- Then every cell is at least 170px tall; in the five-row month the card reaches at least the bottom
  of the visible pane; and in the six-row month every row is reachable by scrolling the page, with no
  cell clipped and no scrollbar inside the card

**AC-5 — the out-of-month tint is the page ground and never the holiday colour**
- Given a month whose leading or trailing cells fall outside it, and a non-working holiday inside it
- When both render side by side
- Then the out-of-month cells carry the page-ground tint, the holiday cell carries the holiday
  lavender, and the two are distinguishable from one another without reading the numeral

**AC-6 — out-of-month cells stay stateless**
- Given a cell for a date outside the displayed month
- When it renders
- Then it carries `data-day-status=""`, `data-bridge="false"` and `data-count=""`, holds no
  `month-cell-holiday` and no `month-cell-bridge`, and shows no avatars

**AC-7 — every colour the grid paints comes from a named token**
- Given the card, the hairlines, the out-of-month tint, the holiday tint, the overloaded background,
  and the PTO and WFH avatar fills
- When the rendered styles are read
- Then each resolves through a token defined in `src/index.css`, and none is a framework default
  colour

**AC-8 — the grid and the sidebar legend agree**
- Given the sidebar's three legend swatches and the grid's PTO, WFH and holiday fills
- When both render on the same screen
- Then a swatch and the thing it explains are the same colour

**AC-9 — the count keeps the cell's top-right**
- Given an in-month cell with a non-zero absence count
- When it renders
- Then the day numeral is top-left and `month-cell-count` is top-right on the same line, and no other
  element occupies that line

**AC-10 — the bridge badge is outlined, unfilled, and does not displace the count**
- Given a bridge day
- When its cell renders
- Then `month-cell-bridge` is present exactly once, reads `Bridge`, is drawn as an outline with no
  background fill, and sits below the numeral-and-count line rather than on it

**AC-11 — the holiday name survives, on either kind of row and on an overloaded cell**
- Given a non-working holiday, a mandated working Saturday, and a holiday falling on an overloaded day
- When each cell renders
- Then `month-cell-holiday` is present in all three carrying `data-kind` and the holiday's name, and
  the overloaded cell still shows it

**AC-12 — the lavender tint still means one thing**
- Given a non-working holiday, a mandated working Saturday, a bridge day, and an overloaded day that
  is also a holiday
- When each renders
- Then only the non-working holiday is tinted lavender; the working Saturday is named but not tinted;
  the bridge day carries no lavender; and on the overloaded holiday the pink still wins the background

**AC-13 — one avatar per member, and the count still agrees with the faces**
- Given a member holding both a morning and an afternoon entry on one date, alongside another member
  holding a full day
- When that cell renders
- Then it shows two avatars — one per member — and `month-cell-count` shows the absence count for the
  date, which is not the number of avatars

**AC-14 — a tentative avatar is still visibly tentative**
- Given a tentative entry
- When its avatar renders inside the ruled grid
- Then it carries a dashed border at reduced opacity, distinguishable from the hairlines around the
  cell and from a settled avatar beside it

**AC-15 — the approved star survives**
- Given an approved entry
- When its avatar renders
- Then a star appears on it

**AC-16 — the threshold readout survives**
- Given any month
- When the screen renders
- Then `month-threshold` is present, carrying `data-threshold` and `data-current-members`, and states
  the stored threshold as a percentage

**AC-17 — drag-select still works on every in-month cell**
- Given an admin or member on the month screen
- When they press on one in-month cell and drag across others
- Then the range is selected, the selected cells are visibly ringed, and the entry panel opens — with
  the gesture reaching every in-month cell and no out-of-month cell

**AC-18 — the empty month still says so**
- Given a month with no entries
- When it renders
- Then `month-empty` is present with its sentence

**AC-19 — no selector is renamed or removed, and no test changes**
- Given the month view's selectors and data attributes before this change
- When the same screen is read after it
- Then every one is present with the same name on an element playing the same role, and the whole
  unit and end-to-end suite passes with no edit to any test file

**AC-20 — no string becomes Vietnamese**
- Given `src/` after this change
- When the lint command runs
- Then it exits 0, with no file added to `copyDebt`

**Invariants touched: `[INV-04, INV-05, INV-06]`.** § 6 of `ticket.yaml` names exactly these three
and instructs PLAN to look at them rather than copy the paragraph. Looked at, all three are engaged —
each by a different mechanism, and none because this ticket changes any arithmetic.

- **INV-04** — *no second definition of the absence count exists anywhere.* This ticket adds no
  number and removes none. It is engaged because **the month cell already shows one avatar per
  member, not per entry**, and that is only correct because the count beside them carries the
  arithmetic: a member holding an `am` and a `pm` entry is one face and one whole day of count. Take
  the count away — or let a taller cell tempt a rearrangement that changes which faces appear — and
  the faces become the only reading available, at which point the screen carries a second, wrong
  definition. AC-13 and § 1 item 1 are what forbid it.
- **INV-05** — *a tentative entry counts toward the absence count exactly as a non-tentative one
  does.* The dashed border at reduced opacity is what lets a reader see that an entry is tentative
  **while still being counted**. **A ruled grid is exactly where a border treatment gets lost against
  a new one**: hairlines between cells are also thin lines, and an avatar's dashed 1px border has to
  stay distinguishable from them. AC-14 states it as an outcome rather than a class.
- **INV-06** — *an entry carries exactly one portion, and that portion applies to every date in its
  range.* On this screen a half day's avatar is identical to a full day's, so **the count is the only
  surface on which INV-06 is visible here at all** — 0.5 in the corner is the whole of it. That is a
  different fact from INV-04's and it is why it is listed separately: INV-04 is about the count
  agreeing with the faces, INV-06 is about the count being the only place a portion is expressible.

INV-01, INV-02, INV-03 and INV-07 are properties of stored entries and their members. This ticket
writes nothing, reads nothing new, makes no seam call it did not make before, and does not open
`src/lib/data/absence.ts`.

**Open questions.**

1. **Whether a percentage min-height resolves through this chain — `min-h-screen` → `flex min-h-0
   flex-1` → `flex-1` — or needs an explicit `calc(…)` cannot be settled from source.** It needs a
   rendered viewport. § 4.4 states the property and names the likely declaration; the Developer
   measures. Inherited from UIE-05, where the same marker stood and the same answer applied.
2. **`Sidebar.tsx:63-64` carries the same false claim this plan corrects in `index.css`, and it is
   left standing.** § 4.7 explains the choice. It is a two-line fix for whoever next opens the shell.
3. **`--color-overload` is added with a legend row still absent**, so the product will have a named
   colour for a meaning the sidebar does not explain. That is a smaller inconsistency than the one it
   replaces — a raw framework default for the one colour that carries a domain meaning — but it is an
   inconsistency and § 1 item 7 is why it is not closed here.
4. **The image's sidebar shows eight members under five team subtitles**, contradicting INV-07 and the
   charter's one-team scope. **Second image in one day showing it, acted on nowhere.** The sidebar is
   out of scope; it is recorded in `design/README.md` § 4.1 and in `ticket.yaml` § 8.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

**The fifth time in this group and the same reason each time**: an image was shown in conversation on
2026-09-07 and **was never on disk**, so `product` wrote a hand transcription at the canonical path.
`.ai/standards/ui-design-system.md:115-119` describes moving an attached file; nothing was attached
in the sense that section means. **No second image was handed to `/plan`.** It is a different image
from UIE-05's and from the one UIE-02, UIE-03 and UIE-04 were built against.

**What the transcription gives, this plan takes**: the full-width grid, the weekday strip on the page
ground, one ruled card in place of 35 tiles, taller cells, a lavender out-of-month tint, and the
bridge badge moved toward the cell's top-right.

**What it asks for and this plan refuses**, each in § 1: the deleted cell count, the deleted
threshold readout, the filled bridge badge, and the Vietnamese.

**What it is silent about and this plan keeps anyway** — because **silence is not removal**: the
holiday name and its `data-kind`, the lavender holiday tint, the outlined bridge badge, the tentative
dashed border, the approved star, the empty-month sentence, the threshold readout, and the
drag-select gesture with its selection ring and entry panel. **The image shows no selected date and
no form, and drag-select is the only creation path on this screen.**

**One thing the transcription gets right and is worth recording as evidence it was drawn
deliberately**: against its roster of eight, a day with four avatars is not pink while days with five
and six are — which is `>` and not `>=`, agreeing exactly with INV-04 and CAL-04 AC-7.

## 3. Permission model

**Nothing changes.** This ticket re-lays-out one component: no control is added, no guard moved, no
seam function called that was not called before, and no data read that was not read before.

| Action | Who | Where the check lives | Changed here |
|---|---|---|---|
| Read the team's entries for a month | member | row-level select policy on `entry` (ADR-005) | no |
| Read the team's holidays and the team row | member | row-level select policies | no |
| Create an entry by drag-selecting a range | member, for themselves | the seam call the panel makes, then row-level security | no |
| Reach the month route with no session or no member row | anybody | the screen's own refusal states | no |

**Two things a layout rewrite breaks by deletion, and both are permission-shaped.** The refusal
states — `month-loading`, `month-not-on-a-team`, `month-sign-in`, `month-unavailable` — render
*instead of* the grid and sit outside it; AC-19 keeps them. And **the drag-select gesture is bound to
in-month cells only** (`onMouseDown` and `onMouseEnter` are `undefined` on out-of-month cells), which
is what stops a member declaring leave on a date the screen is not showing. **Rebuilding 35 tiles as
one ruled card must carry those two handlers onto every in-month cell and onto no other** — AC-17
states it and AC-6 is its negative half.

## 4. Contract

No seam function changes, no component gains a prop, no new file, and no test file is opened.

### 4.1 What is already true and is not rebuilt

The day numeral top-left; avatars as small filled round chips holding an emoji, wrapping under it;
mint WFH and peach PTO; no name, type label or note in the cell, only `title`; the overloaded day's
whole background pink rather than a badge; Monday-first with whole leading and trailing weeks;
out-of-month days greyed. **§ 4.5 is the only one of those this ticket changes, and it changes the
colour rather than the fact.**

### 4.2 AC-1 — the grid fills the pane

Delete `mx-auto max-w-5xl` from `MonthView.tsx:314`. `AppShell.tsx:40-42` already grants the width at
`min-w-0 flex-1`, `YearView.tsx:322` is `max-w-full`, and `WeekView.tsx:304-305` carries UIE-04's
comment recording the identical cap being deleted. Free.

### 4.3 AC-2 — the weekday strip lifts out of the grid

Today the seven labels are the first seven children **inside** `month-grid`. They become a sibling
row above the card, on the page ground, keeping `month-weekday` and reading `Mon`…`Sun`. **No test in
this repository asserts on `month-weekday`**, so this is free — and the labels stay English because
`T2`…`CN` is Vietnamese (§ 1 item 4) and because keeping them costs nothing either way.

### 4.4 AC-3 and AC-4 — one ruled card, taller cells, and `at least`

The 35 `rounded-xl` tiles with `gap-1` gutters become one `bg-card rounded-card shadow-soft`
container with `overflow-hidden`, holding a seven-column grid whose cells are separated by 1px
`--color-line` hairlines running edge to edge. `overflow-hidden` is what makes only the four outer
corners round while the cells stay rectangular.

**The height criterion is `at least`, never "fills the viewport".** The image shows five rows filling
the viewport exactly, and **five rows is a property of April 2026, not of a month**: 30 March to
3 May is exactly 5×7. A six-row month is ~1020px of cells before the weekday strip, against a ~1010px
viewport, so an AC saying the grid fills the viewport is unsatisfiable roughly half the year. So:
**each cell is `min-height: 170px`**, and the card is free to grow past the pane and scroll with it.
**`min-height`, never `height`** — the same answer UIE-05 reached for the week column, and the pane is
already the sole bounded scroller. The five-row case then fills the viewport as the image shows,
because 5 × 170 plus the strip is about the pane's height; the six-row case scrolls. *Open questions*
item 1 carries the one declaration that needs a browser to settle.

### 4.5 AC-5 and AC-6 — the out-of-month tint, and the clause that is an AC

The image tints out-of-month cells pale lavender; today they are grey. **Taken as drawn this is a
colour collision**: `CLAUDE.md` § *Visual direction* fixes lavender to holidays, CAL-08 spends
`--color-holiday: #c9bff0` there and nowhere else, and `src/index.css:137-138` records that the tokens
are named for what they **mean**. The image's own sidebar keeps a violet holiday legend row, so the
picture contradicts itself as well as the registry.

**The escape is in the transcription's own words**: its § 1.3 calls the page ground *"a pale lavender
off-white"*, which is `--color-bg: #f1effa` — already shipped, and not the same colour as `#c9bff0`.

> **The out-of-month tint is `--color-bg` and is never `--color-holiday`. An out-of-month cell and a
> non-working holiday cell must remain distinguishable side by side.**

**This is not pedantry.** CAL-08 AC-14 keeps out-of-month cells stateless — `cal-08:499-503` asserts
`data-count=""` on an October cell viewed from September — so an out-of-month day that *is* a holiday
is not tinted today. Without the clause an out-of-month 30th would look identical to an in-month
non-working holiday, and only the greyed numeral would tell them apart.

### 4.6 AC-7 and AC-8 — the token conversion, and the token it turns out to need

**This is the "second thing" `ticket.yaml` § 3.7 warns about, and this plan does it.** CAL-04's
criteria cite "lavender", "peach" and "mint" generically, so painting them from the tokens that mean
those words amends nothing — and it closes § 1's real defect, that the legend and the grid it explains
are painted from two different palettes.

| Today | Becomes | Note |
|---|---|---|
| `bg-white` (in-month cell) | `bg-card` | same colour |
| `bg-slate-100/60` (out-of-month) | `bg-bg` — the page ground | § 4.5 |
| `bg-violet-100` (holiday) | `bg-holiday` | now matches the sidebar swatch |
| `bg-orange-100` (PTO avatar) | `bg-pto` | now matches the sidebar swatch |
| `bg-emerald-100` (WFH avatar) | `bg-wfh` | now matches the sidebar swatch |
| `bg-rose-100` (overloaded) | `bg-overload` | **the token does not exist yet** |
| `gap-1` gutters | `--color-line` hairlines | § 4.4 |

**`--color-overload` is added to `src/index.css`, and this is why `src/index.css` is in
`allowed_paths`.** Without it the conversion leaves the one colour that carries a domain meaning as
the only raw framework default on the screen. **Its value is `#ffe4e6` — exactly today's
`rose-100` — so nothing changes visually**; this is tokenisation, not a colour decision. `CLAUDE.md`
§ *Visual direction* specifies the meaning in words ("a soft pink that is deliberately not an alarming
red") and re-picking the hex is a colour choice with a charter behind it, which is not this ticket's.

**It is named for what it means, not what it looks like**, following the convention that block already
states: `--color-overload`, never `--color-pink`.

### 4.7 The false comment — corrected in one file, reported in the other

`src/index.css:141-143` says *"NO `--color-overload`. … no calendar view computes an overload state,
`seam.getTeam()` is deliberately not called by any of them, and a token with no consumer is a colour
nobody can check against a screen."* **All three clauses are false** (§ 0), and this ticket makes the
first one obsolete by adding the token. **The comment is corrected in the same edit**, under
`.ai/steward/context.md` § *Autonomy*'s small-defect grant, and this sentence is the plan saying that
it did.

**`Sidebar.tsx:63-64` carries the same false claim and is deliberately left alone.** Correcting a
comment there would put a shell file in `allowed_paths`, and RULE-03's guard does not distinguish a
comment from a rewrite — the whole file becomes writable for the rest of the ticket. § 1 item 5 keeps
the shell shut and *Open questions* item 2 reports the line. **The sidebar's conclusion is still
right for a reason that is still true** — the *shell* makes no team read — so what is wrong there is
the stated reason and not the decision.

### 4.8 AC-9 and AC-10 — the top-right collision, resolved rather than inherited

`MonthView.tsx:389-396` is a `justify-between` row holding the numeral left and `month-cell-count`
right. `ticket.yaml` § 3.6 wants the bridge badge at top-right; § 5.1 says the count keeps the slot.
**Both are satisfiable and this is the stacking**: the numeral-and-count row is untouched, and the
badge moves to the **next line, right-aligned**. It reads as the cell's top-right corner without
competing for the line the count owns, and it is a real move from its current position beside the
holiday name. **The badge stays outlined and keeps the word `Bridge`** (§ 1 item 3).

### 4.9 AC-17 — the gesture must survive the rebuild

`onMouseDown` and `onMouseEnter` are on the cell element and are `undefined` for out-of-month cells;
the `selected` ring is `ring-2` on the same element. **Moving from 35 gutter-separated tiles to one
ruled card moves those handlers onto the new cell elements**, and the ring has to remain visible
against hairlines rather than against gaps. This is the one part of the rebuild with behaviour
attached, and `cal-04:203-217` asserts it.

### 4.10 The narrow-width question, decided

`ticket.yaml` § 7.8 requires PLAN to decide rather than inherit the absence. **The month grid gets no
breakpoint, and it keeps `grid-cols-7` at every width.** A month grid is seven columns by
construction — the alignment of weekdays down the page *is* the information, and a calendar that
reflows to fewer columns is not a calendar. The cells hold no prose, only a numeral and round chips,
so they shrink gracefully where the week view's chips could not. The taller cells are a `min-height`,
which does not fight a narrow viewport. **UIE-04's 1280px breakpoint belongs to the week view and does
not travel here by implication.**

## 5. Seam impact

**None.** No function in `src/lib/data/` is added, removed, renamed or changed;
`tests/seam-parity.test.ts` is untouched. The screen makes exactly the three seam calls it makes
today — `getTeam`, the entries read and `listHolidays` — and `src/lib/data/absence.ts` is not opened,
so INV-04's single implementation is untouched and this ticket adds no second one.

## 6. Schema delta

`none`. No migration, no policy, no trigger, no constraint, no column; nothing under `supabase/` is
opened. ADR-014 does not engage. Every file in scope sits above the data seam.

`requires_adr: false`, and § 1 is what keeps that honest: the three changes that would have needed a
human — removing `month-cell-count`, removing `month-threshold`, and filling the bridge badge — are
each refused, so the stop-and-ask `ticket.yaml` arms does not fire. ADR-031 remains `PROPOSED` and
this ticket neither waits on it nor anticipates it.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/UIE-06/**"
  - "src/routes/MonthView.tsx"
  - "src/index.css"
```

**Two files outside the ticket folder. `size: S`** — `.ai/01-operating-model.md:372` puts S at up to
six. **`size_estimate` and `size` agree at S**, so ADR-012 never engages. `ticket.yaml` withheld
triage's proposed S so PLAN would measure; measured, it is S, and it is S despite § 3.7's token
conversion because that conversion is a substitution inside a file already open plus one token in a
second.

**`src/index.css` is in, and § 2 predicted it probably would not be.** The reason is § 4.6: every
token the conversion needs already exists **except the one for the overloaded cell**, and
`src/index.css:141-143` refused that token on three clauses that are all false. Adding
`--color-overload` is what stops the conversion leaving the screen's one domain-bearing colour as its
only raw default.

**No spec file is in, and § 0 is the measurement rather than the hope.** No test addresses
`month-weekday`; no test asserts a class, a colour or a bounding box on this screen; every
`toBeVisible()` is on an element that survives; and every count and status assertion reads a
`data-*` attribute that § 4 preserves.

**`src/components/Sidebar.tsx` is deliberately out** although it carries the same false comment
§ 4.7 corrects in `index.css`. Putting it in would make the whole shell file writable for a two-line
comment fix.

## 8. Rejected alternatives

**1. Do the layout and skip the token conversion.** The smallest honest ticket: full width, one ruled
card, taller cells, and leave `bg-white` / `bg-violet-100` / `bg-orange-100` where they are. It keeps
`src/index.css` shut and makes the diff purely structural. **Rejected because the split palette is
half the defect § 1 names**, and it is the half a person actually sees: the sidebar legend and the
grid it explains sit side by side, permanently, painted from two different sets of colours. A ticket
that rebuilt this grid and left that standing would be the last cheap moment to fix it, spent.

**2. Add `--color-overload` and the sidebar's fourth legend row together, so the token has an
explanation.** The tidy version, and *Open questions* item 3 is the argument for it. **Rejected
because the legend row is a shell edit** (§ 1 item 5) and because it needs `overloadThreshold` from a
`seam.getTeam()` call the shell does not make — UIE-02 AC-11 and AC-20 already settled that. It would
also have to state the threshold, and **a row reading `>50%` becomes a lie the moment an admin uses
ADM-01**, which is a decision with more in it than a swatch.

**3. Take the image's lavender out-of-month tint literally.** It is what was drawn, and pale lavender
against white does read as "not this month". **Rejected because lavender is spent**: `CLAUDE.md`
§ *Visual direction* fixes it to holidays and CAL-08 spends `--color-holiday` there and nowhere else,
so an out-of-month cell and a non-working holiday cell would become the same colour — and CAL-08
AC-14 keeps out-of-month cells stateless, so the two could sit adjacent with only a greyed numeral
between them. § 4.5 uses `--color-bg` instead, which is what the transcription itself calls the page
ground.

**4. Move `month-cell-count` out of the top-right so the bridge badge can have it.** The image puts
nothing in the top-right but a badge, and the badge reads better in the corner. **Rejected because the
count is the domain fact and the badge is decoration on a day's meaning.** `ticket.yaml` § 5.1 states
it and § 2's invariant note is why: one avatar per member is only correct because the count carries
the arithmetic, and INV-06 has no other surface on this screen at all. § 4.8 puts the badge on the
next line instead, which costs the image nothing a reader would notice.

## Changelog

- `2026-09-08T08:49:36+07:00` — plan created. Raised by `tech-lead-design`.
- `2026-09-08T08:49:36+07:00` — **`src/index.css` entered § 7 after reading the source tree, and
  `invariants_touched` is `[INV-04, INV-05, INV-06]` rather than the `[]` § 6 offers as its first
  reading.** Sections 1 and 2 were drafted against `ticket.yaml` and the transcription, which predict
  `src/index.css` "probably not". **Reading it showed the opposite, for the reason § 5.2 half-found:**
  the comment refusing `--color-overload` is false in all three clauses, and the token it refused is
  the one thing § 3.7's conversion cannot complete without — otherwise the screen's only
  domain-bearing colour stays a raw framework default while six neighbours become tokens. AC-7 and
  AC-8 were added in response. **No AC was narrowed to fit what was easy to build**: AC-13, AC-14 and
  AC-16 are the three that cost the most and all three are things the image argues against. Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.
