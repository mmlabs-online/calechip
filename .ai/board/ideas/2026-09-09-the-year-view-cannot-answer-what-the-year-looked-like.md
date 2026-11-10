---
stage: TRIAGE
agent: product
produced_at: 2026-09-09
inputs_read:
  - product_brief.md:101-110
  - .ai/00-charter.md:37-62
  - .ai/registry/invariants.md:33-39
  - .ai/registry/features.md:66-105
  - .ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md:55-83
  - .ai/registry/decisions/ADR-031-the-month-cell-renders-no-absence-count.md:1-45
  - .ai/registry/decisions/ADR-000-template.md
  - .ai/board/backlog.md
  - .ai/board/model-debt.md:27-30
  - .ai/board/tickets/UIE-08/design/README.md
  - .ai/board/tickets/CAL-06/01-plan.md:124-208
  - .ai/board/tickets/CAL-08/01-plan.md:172-209
  - .ai/templates/idea.md
  - .ai/templates/ticket.yaml
  - src/App.tsx:320-332
  - src/routes/YearView.tsx:315-354,403-440
  - src/components/TopBar.tsx:66-75
  - src/lib/data/index.ts:228-232,500-512,540-546
  - src/lib/data/absence.ts:185-224
consulted: [tech-lead-design]
gate: PASS
blocking_reason: ""
next_state: BACKLOG
---

## Problem

**The year view answers one question, per member: *who is away, and when*. It cannot answer *what did
this year look like*.** How many entries the team declared. How the load falls across the months.
Which months are empty.

The screen is a member × day matrix — one row per member, 365 day columns, a month ruler above it
(`src/routes/YearView.tsx:321`, `:348`, `:409`, `:433`). Every fact it holds is at the granularity of
one person on one day. **Nothing on it aggregates.** A per-day total exists (CAL-06 AC-9, AC-10) but
it is a column reading, not a period reading, so there is no number anywhere on the screen for a
month, a quarter or the year.

The consequence is arithmetic done by eye. That file's own comment puts the cell count at **10,950**
(`:339`). To learn that March is empty, a person scans 31 columns across every row and finds nothing;
to learn that April is the busy month, they do it twelve times and compare their impressions. The
answer is present in the pixels and absent as a value, which is the same as absent for anyone who has
to act on it.

## Who has it

**Any member**, and specifically **the person doing long-range planning, every time they open the
year.** The brief assigns this screen exactly that job — `product_brief.md:105` gives *View Năm* the
purpose *"Lập kế hoạch dài hạn"* and describes its content as *"Mỗi người một hàng, 365 cột nhỏ"*.
The purpose and the content are the mismatch: the row-per-person layout was chosen for *"ai nghỉ
nhiều, cụm nào chồng nhau"* — who takes a lot and where the clusters overlap — and neither of those
is a quantity the screen states.

It is not occasional. The year view has one route and one form (`src/App.tsx:331-332`), so every
arrival at `/year/:yyyy` gets the matrix and nothing else.

## Evidence

**Visual reference:** `.ai/board/tickets/CAL-10/design/year-overview-2026-09-08.jpg`

**That path is a real file — a JPEG on disk, not a transcription.** It is the first design image this
repository has ever held; every previous `design/README.md` on this board is a hand transcription
written because the picture existed only in a conversation, which is the defect recorded as **MD-030**
(`.ai/board/model-debt.md:30`). What it is meant to settle: the shape the operator wants for the
answer — a twelve-month overview with a summary band above it — rather than any change to the member
grid.

Three further facts, none of them opinion:

1. **This is the same image the operator showed on 2026-09-08**, transcribed by hand at
   `.ai/board/tickets/UIE-08/design/README.md`. That transcription remains readable and is still the
   only prose description of the picture; it is now checkable against the picture for the first time.
2. **The request was split at that triage and only the repaint half shipped.** UIE-08 recoloured the
   grid that exists. `src/routes/YearView.tsx` is still the member matrix — `year-row` at `:409`,
   `year-cell` at `:433`, the month ruler at `:348`, the `9rem repeat(365, 0.5rem)` template at
   `:321`. The restructure half has never been built and has no row.
3. **This exact restructure was already ruled NEEDS-ADR on 2026-09-08, and the decision was lost.**
   `ADR-032-the-year-view-replaces-its-member-grid-with-twelve-month-cards.md` was drafted in full and
   left `PROPOSED — awaiting the operator`; it **exists on no ref**, while eight documents cite it —
   8 of the 9 errors `main`'s own documentation audit currently fails with. The idea file behind it,
   `2026-09-08-the-year-view-is-the-only-screen-that-shows-who-declared-nothing.md`, is gone with it.
   Recorded as **MD-031** (`.ai/board/model-debt.md:29`). This idea therefore restates a problem that
   was stated once and cannot be read.

## Impact if ignored

The year view keeps being the screen people open for long-range planning and close without an answer,
and the work moves somewhere the product cannot see it — a spreadsheet, or a question in chat. The
charter's premise is *see a crowded day while it is being created rather than the night before*; a
crowded **month** is not visible at all today, and the person who would notice it is the one this
screen was built for.

And the loss compounds: the operator has now asked for this twice, on the same picture, and the second
ask exists only because the first ask's decision is not in the repository.

## Constraints already known

- **INV-04** (`.ai/registry/invariants.md:36`) — one definition of the absence count, *"with PTO and
  WFH counted alike"*, and *"No second definition of this number exists anywhere in the system."* The
  implementation is documented as never consulting `type` (`src/lib/data/absence.ts:190-191`). **Any
  number on this screen that separates PTO from WFH is a new quantity, not INV-04's, and must be
  written as such.**
- **INV-05** — a tentative entry counts as a non-tentative one does. **INV-06** — one portion per
  entry, so half days exist and a total can be fractional. **INV-07** — one team.
- **Charter refusal 1** (`.ai/00-charter.md:42`) — *"It will never track remaining leave quota."*
  **Brushed, not crossed.** Counting what was declared is not a balance, and the cards hold none. The
  boundary is verbal and must be held at PLAN: **no label on this screen may read *remaining*, *left*,
  *balance*, *quota* or *allowance*, and no allowance figure goes on it.**
- **The interface is English and it is lint-enforced** — `.ai/standards/ui-design-system.md:46-48`,
  the operator's instruction of 2026-09-03, with `eslint.config.js:84-92` reporting a Vietnamese
  diacritic in JSX text as a build failure (`.ai/board/tickets/UIE-08/design/README.md:227-228`).
  Every string in the picture is Vietnamese. **None of it may be transcribed.**
- **RULE-01** — feature and glossary rows aside, a registry change needs an ADR and a human.
- **ADR-028's four-step boundary test** (`:61-83`) decides the group. Applied in the verdict below.

## Out of scope

- **`--color-overload` on this screen.** Whether an overloaded day is marked here is a domain state,
  not a colour choice; UIE-08 refused it on the grid for that reason and this idea does not reopen it.
  The picture is silent on it too (`UIE-08/design/README.md:142-143`).
- **The P1 change feed.** Nothing here notifies anyone.
- **Anything in the shell.** `src/components/TopBar.tsx:72-74` already renders `Week` / `Month` /
  `Year`, so the switcher needs no edit; the sidebar is untouched.
- **The sidebar's five sub-team subtitles in the image.** They contradict INV-07 and the charter's
  one-team scope, have been recorded three times and acted on nowhere
  (`UIE-08/design/README.md:262-264`). **Nobody may read them as a requirement**, here least of all —
  the picture is now on disk and easier to mistake for a specification.

## Open questions

1. ***THE FOUR SUMMARY NUMBERS' DEFINITIONS ARE NOT READABLE OFF THE PICTURE, AND THE PICTURE'S OWN
   FIGURES DO NOT AGREE WITH EACH OTHER.*** `TỔNG ĐƠN PHÉP 2026` reads `21 đơn` while `NGÀY PTO` and
   `NGÀY WFH` read `10` and `11` *lượt* — `10 + 11 = 21` mixes two units in one identity
   (`UIE-08/design/README.md:90-93`). Separately, `Tháng 04` alone carries `21 Lượt` (`:108-109`) while
   drawing **fifteen** absence days (`:133-134`, sixteen marked days of which 30/4 is a holiday). The
   numbers must be **defined at PLAN as acceptance criteria**, not read off the image.
2. **`TỔNG ĐƠN PHÉP` is wrong even in its own language** — `phép` is leave, and a WFH day is not
   leave, so the card's label contradicts the two beneath it. The copy is English anyway, but whoever
   writes the English must not translate this label.
3. **A day that carries both a PTO and a WFH entry.** The picture answers with a peach→mint gradient
   across one pill (`UIE-08/design/README.md:127-129`); the token set is flat hexes named for meaning
   and **no gradient token exists** (`:220`). Undecided, and it is a design decision rather than an
   invention — `.ai/standards/ui-design-system.md` § *Visual specification* grants the arrangement to
   PLAN.
4. **Whether the retained member grid is reachable from the overview, and from where.** The picture
   draws no link to it, because the picture does not know it survives.

---

# Verdict — PROMOTE, as CAL-10

## The boundary test, run in order (ADR-028:61-83)

**Step 1 — does something written down say what this surface should be, and does the surface not
match it?** **No.** Nothing in the registry, the standards or any shipped plan says the year view
should be twelve month cards. **The only document that would is ADR-032, and it does not exist and was
never accepted** — MD-031 records that it is on no ref, and its status when last seen was `PROPOSED —
awaiting the operator`, which is not a statement about what the surface should be. Meanwhile CAL-06's
fourteen criteria describe the member grid and the member grid holds them. There is no contradiction a
reader can point at, so this is **not** a `BUG`.

**Step 2 — could the product do something afterwards that it could not do before?** **Yes, and this
is the step that fires.** Afterwards the product answers *"how many PTO days did the team declare this
year"* and *"which months are busy"*. **It can answer neither today**, from any screen: no surface in
the product states a period total, and INV-04's implementation never separates `type`
(`src/lib/data/absence.ts:190-191`), so the PTO/WFH split is a quantity the system has never computed
anywhere.

`ADR-028:69-72` disposes of the obvious objection — that this is a screen and screens are `UIE`:

> **A new capability brings its own screen, and that screen is part of the capability**, not a
> separate `UIE` row. This is the boundary most likely to be got wrong, because almost every
> capability ticket contains visual work.

Steps 3 and 4 are not reached.

## The row

**Group `CAL`** — Calendar, viewing (`features.md:70`), by area. **Next free number is `CAL-10`**:
`CAL-09` is the last row in that table (`features.md:105`).

Written by `product` at this triage under ADR-007: one row in `.ai/registry/features.md`, citing this
file. `Invariants touched` is left **empty** — that is PLAN's, and this triage did not measure it.

## `requires_adr: true`, and precisely why

Not because the screen is new. **Because the operator's second choice moves a route that five shipped
acceptance criteria are written against**, and rewording a shipped criterion is a registry-grade act
that must be recorded rather than absorbed into a plan:

| Criterion | Line | What it says |
|---|---|---|
| CAL-06 AC-1 | `CAL-06/01-plan.md:129-132` | *"they open `/year/2026`"* → *"the grid renders 365 day columns"* |
| CAL-06 AC-2 | `:134-137` | *"they open `/year/2028`"* → *"366 day columns"* |
| CAL-06 AC-13 | `:197-201` | *"`/year/2026` is opened"* in each of the three non-list states |
| CAL-06 AC-14 | `:203-207` | *"it shows the failure state and **draws no grid**"* |
| CAL-08 AC-7 | `CAL-08/01-plan.md:178-183` | *"they open `/year/2026`"* → *"the grid carries one day-status element per date"* |

**Four of the five name the address literally. AC-14 does not, and it is on this list for a different
reason** — its subject is *the grid*, and after the change that noun names a screen at a different
address while the refusal it states must hold at both. It needs the same rewording work even though it
contains no URL. Stated here rather than glossed, because the distinction is what separates it from
**CAL-08 AC-11** (`:203-207`), which says *"the year grid"* in a comparison of three surfaces and
**stays true untouched**.

**Seven CAL-06 criteria are also safe** — AC-3, AC-4, AC-5, AC-6, AC-8, AC-9, AC-10 all open *"When
the year renders"* with no address, and all describe the member grid, which is retained. **CAL-06
AC-12** (`:191-195`) wants the year view to offer *"a link back to the month"*; the card footer's
`Xem →` satisfies it **if and only if it targets `/month/yyyy-MM`**, which is a constraint on PLAN
rather than a change to the criterion.

## The ADR, and where it was written

`.ai/registry/decisions/ADR-032-the-year-view-replaces-its-member-grid-with-twelve-month-cards.md`,
**at that exact filename deliberately** — eight documents already cite it, and landing a real file
there closes 8 of the 9 errors `main`'s audit fails with (MD-031). Under the operator's answer the
title remains accurate.

Its status is **`ACCEPTED by the operator` — 2026-09-09**, and that is written only because the
operator made both choices in words in this conversation. Both are quoted in the ADR's § *Status* so a
reviewer can see what is being recorded and check that nothing was strengthened in the recording.

## What this triage wrote

- This file, and this verdict.
- `.ai/registry/features.md` — the `CAL-10` row, `PLANNED`, citing this file and ADR-032.
- `.ai/registry/decisions/ADR-032-...md` — the decision, at the cited path.
- `.ai/board/tickets/CAL-10/ticket.yaml` — the shell (ADR-010), `state: BACKLOG`,
  `requires_adr: true`, `invariants_touched` and `size_estimate` **empty** because both are PLAN's.
- `.ai/board/tickets/CAL-10/design/README.md` — pointing at the sibling JPEG, which is the reference.
- `.ai/board/backlog.md` — one row appended to `## BACKLOG`. **`product` asserts nothing about its
  position**; it is row 1 because the table was empty, not because anybody placed it there.

**No acceptance criteria are written here.** The four summary numbers have no definitions yet
(*Open questions* 1) and writing them is `tech-lead-design`'s at PLAN.
