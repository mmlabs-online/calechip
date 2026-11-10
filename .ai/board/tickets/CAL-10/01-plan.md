---
ticket: CAL-10
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-09T09:42:15+0700
inputs_read:
  - .ai/board/tickets/CAL-10/ticket.yaml
  - .ai/board/tickets/CAL-10/design/README.md
  - .ai/board/tickets/CAL-10/design/year-overview-2026-09-08.jpg
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-032-the-year-view-replaces-its-member-grid-with-twelve-month-cards.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/ui-design-system.md
  - .ai/01-operating-model.md
  - .ai/board/tickets/CAL-06/01-plan.md
  - .ai/board/tickets/CAL-08/01-plan.md
  - src/App.tsx
  - src/routes/YearView.tsx
  - src/routes/MonthView.tsx
  - src/components/TopBar.tsx
  - src/components/Sidebar.tsx
  - src/lib/period.ts
  - src/lib/data/absence.ts
  - src/lib/data/day-status.ts
  - src/lib/data/index.ts
  - src/index.css
  - tests/e2e/cal-06-year-view.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
  - eslint.config.js
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CAL-10 — year overview: twelve month cards with a year summary band

## 1. Problem and scope

### The feature row, transcribed

| ID | Title | Group | Status | Invariants touched |
|----|-------|-------|--------|--------------------|
| CAL-10 | Year overview — twelve month cards with a year summary band | CAL | PLANNED | *(empty in the registry — this plan fills it)* |

Four sentences of that row bind this plan and are transcribed rather than paraphrased:

- *"The problem is not that the screen should look like a picture"* — it is that the year view
  answers *"who is away, and when"* per member and cannot answer *"what did this year look like"*.
- *"THE FOUR SUMMARY NUMBERS HAVE NO DEFINITIONS AND THEY ARE NOT READABLE OFF THE PICTURE — THEY
  MUST BE WRITTEN AS ACCEPTANCE CRITERIA AT PLAN."*
- *"`NGÀY PTO` / `NGÀY WFH` split by `type`, which INV-04's implementation is documented as never
  doing … so they are a **new quantity** that must sum exactly to INV-04's total for the period."*
- *"`TỔNG ĐƠN PHÉP` is wrong even in Vietnamese: `phép` is leave and a WFH day is not leave, so the
  card contradicts the two beneath it."*

### What capability this buys, and for whom

Every **member** gains an answer to a question the product cannot answer today: what the year looked
like. No surface states a total for a month, a quarter or a year, so learning that March was empty
means reading 10,950 cells (`src/routes/YearView.tsx:339`). `/year/:yyyy` becomes an overview — four
summary numbers above twelve month cards, each card drawing that month's days as tinted pills with a
count and a link into the month view. The per-member 365-column grid is not deleted; it moves,
behaviourally unchanged, to `/year/:yyyy/members`.

The route move is not this plan's decision to make or to reopen: it is
[ADR-032](../../../registry/decisions/ADR-032-the-year-view-replaces-its-member-grid-with-twelve-month-cards.md),
`ACCEPTED by the operator` on 2026-09-09, option 3 of three. `requires_adr` is `true` and the ADR
already exists, so PLAN builds inside it.

### The five reworded criteria, and the nine that are not touched

ADR-032 § *Consequences* item 1 obliges this ticket to reword five shipped acceptance criteria, and
says in terms that it happens *"at CAL-10's PLAN, by `tech-lead-design`, not here"*. They are address
changes and nothing else — no criterion's substance moves, and none of them is failing:

| Criterion | File and line | Change |
|---|---|---|
| CAL-06 AC-1 | `.ai/board/tickets/CAL-06/01-plan.md:129-132` | `/year/2026` → `/year/2026/members` |
| CAL-06 AC-2 | `:134-137` | `/year/2028` → `/year/2028/members` |
| CAL-06 AC-13 | `:197-201` | `/year/2026` → `/year/2026/members` in all three states |
| CAL-06 AC-14 | `:203-207` | no address; *the grid* now names one of two screens, so the refusal is stated to hold on both |
| CAL-08 AC-7 | `.ai/board/tickets/CAL-08/01-plan.md:178-183` | `/year/2026` → `/year/2026/members` |

**Nine criteria are deliberately not touched**, and a reviewer should check this list as carefully as
the one above: CAL-06 AC-3, AC-4, AC-5, AC-6, AC-8, AC-9 and AC-10 open *"When the year renders"*,
carry no address and describe the retained grid; CAL-08 AC-11 says *"the year grid"* in a
three-surface comparison and stays true as written; and CAL-06 AC-12 requires *"a link back to the
month"*, which the top bar's `Month` segment has satisfied on every period screen since UIE-02 and
which the card footer's `Xem →` satisfies again — this plan targets it at `/month/yyyy-MM`, which
binds this ticket rather than changing that criterion.

### Out of scope

- **Deleting or changing the member grid.** ADR-032 keeps it. It moves address and nothing else; its
  behaviour, its markup, its test ids and UIE-08's repaint of it all survive intact (ADR-032 §
  *Consequences* item 6).
- **Vietnamese copy.** Every string in the picture is Vietnamese and the interface is English,
  lint-enforced as a build failure (`eslint.config.js:83-92`). No label on this screen is a
  translation of a label in the picture, and `TỔNG ĐƠN PHÉP` is not translated at all — § 2 replaces
  it with a different quantity for the reason the registry row gives.
- **Any word meaning a balance.** Charter refusal 1 (`.ai/00-charter.md:42`) is brushed and not
  crossed: counting what was declared is not a quota. No label reads `remaining`, `left`, `balance`,
  `quota` or `allowance`, and no allowance figure appears.
- **`--color-overload` on this screen.** A domain state, not a colour; the picture is silent on it
  and UIE-08 refused it on the grid for the same reason. `seam.getTeam()` is therefore not called,
  exactly as `YearView.tsx` already refuses to call it.
- **The smooth peach→mint gradient pill.** The token set is flat hexes named for meaning and no
  gradient token exists (`design/README.md` § 3). § 2b takes a hard 50/50 split of the two existing
  tokens instead, which invents no colour. A true gradient wants a token and therefore its own
  decision.
- **The sidebar's five sub-team subtitles in the image.** They contradict INV-07 and the charter's
  one-team scope, and have been recorded three times and acted on nowhere. The picture being real
  makes this misreading easier rather than harder.
- **Any shell edit.** `src/components/TopBar.tsx:72-74` already renders Week / Month / Year and
  `Sidebar.tsx:205` already links `/year`. Neither file is touched. `src/lib/period.ts` **is**
  touched, and § 7 says why that is not the same thing.
- **A per-quarter number.** The registry row names the month, the quarter and the year as the
  question; the picture draws months and a year. A quarter has no card in the picture and no
  definition anywhere, and inventing one is exactly what § 2b's grant does not cover.
- **Reconsidering the month cell's day-of-month numeral.** ADR-032 § *Consequences* item 2 accepts
  that a half day and a full day tint the same pill on this screen, and says in terms that this must
  not be taken as a reason to reopen ADR-031.
- **Restoring the picture's `21 đơn` as an entry count.** § 2 defines card 1 as a different quantity;
  a count of entry rows appears nowhere in the product and has no definition in any document.

`size_estimate`: **M**. One new screen, one route change, one additive derivation, two shipped plan
files reworded, and three end-to-end specs.

## 2. Acceptance criteria

Observable through the interface or through `pnpm test`. The selector attribute is `data-testid`.

**AC-1 — `/year/:yyyy` renders the overview**
- Given a signed-in member
- When they open `/year/2026`
- Then the screen renders a summary band of four cards above twelve month cards, and no per-member
  row and no 365-column grid appears

**AC-2 — the member grid is retained at its new address, unchanged**
- Given a signed-in member
- When they open `/year/2026/members`
- Then the per-member grid renders exactly as it does today — one row per member of the team
  including members with no entries, 365 day columns, the day-status strip, and the per-day totals

**AC-3 — an anchorless or malformed year resolves on the screen it was asked for**
- Given a signed-in member
- When they open `/year`, and separately `/year/banana`, and separately `/year/banana/members`
- Then the first two resolve to the overview for the current year, and the third resolves to the
  member grid for the current year — a malformed address never moves the caller between the two
  screens

**AC-4 — twelve month cards, in calendar order, Monday first**
- Given the overview for any year
- When it renders
- Then there are exactly twelve month cards in January-to-December order, each carrying a weekday row
  reading Mon to Sun, and each drawing one day cell per date of that month and no date of any other
  month

**AC-5 — the summary band's first card is INV-04's total for the year**
- Given the overview for a year
- When the first summary card is read
- Then it states the sum, over every date of that year, of `absenceCountsFor`'s value for that date —
  the same number and the same unit as the per-day totals on the member grid, and computed by no
  other means

**AC-6 — the PTO and the WFH cards partition that total exactly**
- Given the overview for a year
- When the second and third summary cards are read
- Then the second states the part of AC-5's total contributed by entries whose `type` is `pto`, the
  third states the part contributed by entries whose `type` is `wfh`, and the two add up to AC-5's
  figure exactly, for every dataset

**AC-7 — the fourth card counts non-working public holidays**
- Given the overview for a year, and a holiday calendar containing both `non_working` rows and a
  `working` row (a mandated Saturday)
- When the fourth summary card is read
- Then it states the number of dates in that year whose day status is a non-working holiday, and the
  mandated Saturday is not among them

**AC-8 — a fractional total is shown as a fraction and never rounded**
- Given a year in which exactly one member declares one `am` half day and nothing else
- When the overview renders
- Then the first summary card and that month's card both read `0.5`, and neither reads `0` nor `1`

**AC-9 — a month card states its own count, and says so in words when it is zero**
- Given a year in which one month has entries and another has none
- When the overview renders
- Then the first month's card header states that month's total in the same unit as AC-5, and the
  second month's card header states in words that the month is empty rather than showing `0`

**AC-10 — a day cell is tinted by what is declared on it**
- Given a date on which only PTO is declared, a date on which only WFH is declared, a date on which
  both are declared, and a date on which nothing is declared
- When the month card renders
- Then the four cells are respectively PTO-tinted, WFH-tinted, tinted with both, and untinted, and
  each cell carries the day-of-month numeral

**AC-11 — a non-working holiday is lavender and outranks the type tint**
- Given a non-working holiday on which entries are also declared
- When the month card renders
- Then the cell is lavender, and the entries declared on it are still included in that month's count
  and in the summary band

**AC-12 — the counts and the faces come from one pass and cannot disagree**
- Given any date drawn on the overview
- When the month card's footer is read
- Then the members shown are exactly those whose entries are counted for that month, and no
  filtering, summing or counting of entries is performed anywhere in the overview's own code

**AC-13 — every card links into the month view**
- Given the overview for 2026
- When the link in the card for April is followed
- Then the month view for `2026-04` opens

**AC-14 — the three non-list states**
- Given a caller with no session, a signed-in caller with no member row, and a read that fails
- When `/year/2026` is opened in each case
- Then the first is sent to sign in, the second sees the member-less state, and the third sees a
  failure state and no cards

**AC-15 — a read that cannot be proved complete draws nothing**
- Given a year whose entry read or holiday read throws, including the completeness refusal
  `listTeamEntriesOverlapping` has raised since CAL-09
- When the overview resolves
- Then it shows the failure state and draws no summary band and no month card, rather than a band
  whose numbers are computed from part of the year

**AC-16 — stepping the year from the member grid stays on the member grid**
- Given a member on `/year/2026/members`
- When they use the previous-year and next-year controls
- Then they arrive at `/year/2025/members` and `/year/2027/members`, and not at the overview

**AC-17 — the interface is in English**
- Given the overview
- When every string it renders is read
- Then none contains a Vietnamese diacritic, and no label reads `remaining`, `left`, `balance`,
  `quota` or `allowance`

### Invariants touched

- **INV-04** — engaged directly and in the one way ADR-032 warns about. Every number on this screen
  is INV-04's number or a declared decomposition of it: the summary band's first card is the year's
  total from `absenceCountsFor`, each month card's header is that month's total from the same
  function, and the PTO/WFH pair is produced by the **same `walk`** in `src/lib/data/absence.ts` with
  the same weights, so the partition sums exactly by construction rather than by assertion. Held by
  AC-5, AC-6, AC-8, AC-9 and AC-12, and by § 4.1's requirement that the overview computes no
  arithmetic of its own.
- **INV-05** — engaged because a tentative entry must count here exactly as it does elsewhere. Held
  by reuse: `walk` never consults `tentative`, and the overview adds no filter.
- **INV-07** — engaged because the summary band is the first number in the product that aggregates a
  whole year across the whole team; a read scoped differently would put another team's entries in it.
  Held by `entry_select_team` and by the overview making the same four seam calls the year grid
  makes. Also held negatively: the picture's five sub-team subtitles are refused in Out-of-scope for
  exactly this reason.

Not engaged, decided rather than omitted: **INV-01**, **INV-02**, **INV-03** and **INV-06** — this
ticket writes no entry, edits none and constructs no entry value. INV-06's usual surface, the
in-cell count, is discussed under ADR-032 § *Consequences* item 2 and is a known accepted loss on
this screen, not an amendment.

### Open questions

**None blocking.** Three things the ticket and the design README left open are decided here:

1. *What the four summary numbers are.* Decided at AC-5 to AC-7. The picture cannot supply them —
   its own figures mix units and are fictional against the fixtures — so they are written here. The
   one that changes the picture's meaning is card 1: the picture labels it `TỔNG ĐƠN PHÉP 2026`,
   *total leave requests*, and the registry row records that this is wrong even in Vietnamese. It
   becomes **the year's absence total**, the same quantity and unit as the two cards beneath it, so
   the band reads as an identity a person can check on screen — `PTO + WFH = total`. That is
   ADR-032's revert condition made visible rather than merely asserted.
2. *How a day carrying both a PTO and a WFH entry is drawn.* Decided at AC-10 and § 2b: a hard 50/50
   split of `--color-pto` and `--color-wfh`, composed from the two existing tokens. No token is
   invented and no gradient token is added.
3. *Whether a holiday or a type tint wins on a day that is both.* Decided at AC-11: the holiday wins,
   which is the picture's own reading and matches `MonthView.tsx`'s precedent that a non-working
   holiday is lavender. The cost is stated rather than hidden — that cell no longer shows what type
   was declared on it, which is a real loss the month view does not have because it also draws
   avatars. The entries still count, so no number lies.

One assumption that ships: **the year read is a single range read and stays one.**
`listTeamEntriesOverlapping({start: yyyy-01-01, end: yyyy-12-31})` is the read the year grid already
makes and it has been paged and complete-or-throw since CAL-09, so twelve month cards need twelve
slices of one result rather than twelve reads. If a future month card is ever fetched on its own, the
summary band and the cards can disagree about the same year, which is what AC-12 and § 4.1 exist to
prevent.

### 2b. Visual reference

```
Visual reference: design/year-overview-2026-09-08.jpg — attached at TRIAGE by the operator.
```

It is the first real image on this board rather than a hand transcription (`design/README.md`), and
`.ai/standards/ui-design-system.md` § *Visual specification* still governs what it is: evidence of
intent, not a specification, because *"looks like the screenshot"* cannot be observed by a reader who
cannot ask a question. **So it is spent above, in section 2**, and what follows is only the
arrangement it settles and the three things it does not.

**What the image decides, and where each decision became a criterion.** Four summary cards in one
row above twelve month cards in a four-by-three arrangement (AC-1, AC-4). Each month card: the month
name at the left of its header and its count at the right, or the word for empty in that same slot
(AC-9); a seven-column weekday row reading Monday first (AC-4); one pill per date carrying the
day-of-month numeral, leading blanks where the month does not start on a Monday (AC-4, AC-10); a
footer holding the overlapping faces of the members counted in that month and a link into the month
view (AC-12, AC-13). Untinted days are the page's own pale lavender pill; PTO is peach, WFH is mint,
a holiday is lavender (AC-10, AC-11). The summary card is an uppercase label above a large figure and
a small unit word, and the label is tinted to match the quantity it names.

**Three arrangements the image leaves ambiguous, decided here and marked as mine.** Its empty months
put the link at the left while April puts it at the right, because April's footer also carries faces
— so **the link is always at the right of the footer and the faces always at the left**, and an empty
month's footer holds the link alone. Its `+4` overflow chip is drawn without a rule for when it
appears — **faces overflow after four**. And it draws no focus, hover or keyboard state anywhere —
**the card's link takes the same focus treatment every other link in the product already carries**.

**What the image is not allowed to decide, restated because the file being real makes it easier to
mistake for a requirement.** Its Vietnamese strings, its four figures, its `21 Lượt` against fifteen
drawn days, its smooth gradient pill, and its sidebar's five sub-team subtitles. Each is refused in
§ 1 Out-of-scope or replaced by a criterion in § 2.

## 3. Permission model

**No change, and no policy is added.** Every read this screen makes was already permitted, and the
overview is a second presentation of data the year grid already shows to the same roles.

| Action | `member` | `admin` |
|---|---|---|
| Read any entry in the team | ✅ | ✅ |
| Read the member list | ✅ | ✅ |
| Read the holiday calendar | ✅ | ✅ |

Transcribed from `.ai/standards/rbac-and-security.md:31` and its derived-and-confirmed member-list
row at `:63-68`. The controls are `entry_select_team`, `member_select_team` and `holiday_select_all`,
all in the datastore (ADR-005). The screen is **read-only for both roles**, and as on the year grid
that denial is held by absence rather than by a check: no write function is imported and no control
renders one. `YearView.tsx` names that the weakest mechanism in its own plan and this screen inherits
the same weakness rather than a new one.

**Neither route is guarded**, matching `/year`, `/month` and `/week` (`src/App.tsx:325-332`): a caller
with no member row reaches the component and is refused by it, because the refusal is what says why
and a redirect leaves somebody who followed a shared year link with nothing to read (AC-14).

**Two denials worth stating because the summary band is new.** No figure on this screen is
per-member, so it grants no ability to read one member's year that the grid did not already grant.
And no figure is an entitlement — the band counts what was declared, which is why Out-of-scope
forbids every word that would make it read as a balance.

## 4. Contract

### 4.1 The one new derivation — `src/lib/data/absence.ts`, additive

```ts
/** The part of INV-04's total contributed by each entry type. Both halves, always present. */
export interface AbsenceByType {
  pto: number;
  wfh: number;
}

/**
 * CAL-10 AC-6. INV-04's total for `range`, SPLIT BY `type`.
 *
 * NOT A SECOND DEFINITION, and the construction is the argument. It walks the SAME `walk` as
 * `absenceCountsFor`, applies the SAME `WEIGHT`, and inherits the same rejected-entry, tentative and
 * membership rules; the only thing it adds is which of two accumulators receives the weight. Because
 * every counted entry has exactly one `type`, `pto + wfh` equals `absenceCountsFor`'s total over the
 * same range for every dataset — an identity, not an assertion that could drift.
 *
 * ADR-032 Consequences item 4 is the reason this function exists at all and the reason it is HERE:
 * `absenceCountsFor` is documented as never consulting `type` (:190-191) and INV-04 forbids a second
 * definition of the number, so the split had to be a NEW quantity derived from the ONE pass rather
 * than a filter written on a screen.
 */
export function absenceByTypeFor(
  entries: readonly Entry[],
  range: DateRange,
  roster: readonly Member[],
): AbsenceByType;
```

Nothing else in that module changes. `absenceCountsFor`, `absentMembersFor`, `absentEntriesFor` and
`absentDatesByMember` keep their signatures and their bodies.

### 4.2 The routes — `src/App.tsx`

```tsx
<Route path="/year" element={<YearOverview />} />
<Route path="/year/:year" element={<YearOverview />} />
<Route path="/year/:year/members" element={<YearView />} />
```

Three lines where there were two. `YearView` is imported and rendered exactly as it is today; only
the `path` it is mounted at changes. There is deliberately **no `/year/members` route**: the grid is
always anchored by a year, and the anchorless case is `/year`, which is the overview.

### 4.3 The screen — `src/routes/YearOverview.tsx`, new

The same four-phase shape the three period screens already use, so the states are the states a reader
already knows:

```tsx
type View =
  | { phase: "loading" }
  | { phase: "not-on-a-team" }
  | { phase: "unavailable" }
  | { phase: "ready"; roster: Member[]; entries: Entry[]; holidays: Holiday[] };
```

The reads, in one `Promise.all`, identical to `YearView.tsx:161-171` and adding nothing:

```ts
const [roster, entries, holidays] = await Promise.all([
  seam.listMembers(),
  seam.listTeamEntriesOverlapping(range),          // range = the whole year, inclusive
  seam.listHolidays(holidayReadRange(range)),      // padded, CAL-08's one pad
]);
```

`seam.getTeam()` is **not** called, for the reason `YearView.tsx:24-26` already records: it exists to
supply `overloadThreshold`, and calling it is the first step toward a colour this screen has not
designed and Out-of-scope refuses.

The derivations, all four imported and none written locally (AC-12):

```ts
const counts   = absenceCountsFor(entries, range, roster);   // INV-04, per date
const byType   = absenceByTypeFor(entries, range, roster);   // § 4.1, per year
const faces    = absentMembersFor(entries, range, roster);   // per date
const statuses = dayStatusesFor(holidays, range);            // CAL-08, per date
```

Every figure on the screen is a sum over `counts` or a lookup in the three maps beside it:

| Figure | Derivation |
|---|---|
| Summary card 1 | the sum of `counts` over every date of the year |
| Summary card 2, 3 | `byType.pto`, `byType.wfh` |
| Summary card 4 | the number of dates whose `statuses` entry has `nonWorkingReason === "holiday"` |
| Month card header | the sum of `counts` over that month's dates, or the empty word when it is 0 |
| Day cell tint | `statuses` for the holiday case, then the types present in `faces`' entries for that date |
| Card footer faces | the union of `faces` over that month's dates, in roster order |

**No `.filter`, `.reduce` or comparison over `Entry` is written in this file** beyond summing values
already produced by the four functions above. That sentence is the whole of AC-12 and is what R8 will
be checking INV-04 against.

### 4.4 Selectors

`data-testid`, following the `year-` prefix convention with an `overview-` qualifier so no existing
year selector is shadowed — UIE-02 AC-6 requires every id to resolve to exactly one node, and both
screens can be open in one test run.

| Selector | Element | Attributes |
|---|---|---|
| `year-overview` | the page root | `data-year` |
| `year-overview-loading` / `-not-on-a-team` / `-unavailable` | the three non-list states | — |
| `year-summary-card` | each of the four | `data-kind="total\|pto\|wfh\|holidays"`, `data-value` |
| `year-month-card` | each of the twelve | `data-month` (`yyyy-MM`), `data-count`, `data-empty` |
| `year-month-card-link` | the footer link | — |
| `year-month-weekday` | the seven labels | — |
| `year-day-cell` | each date pill | `data-date`, `data-day-status`, `data-types` (`""`, `pto`, `wfh`, `pto wfh`) |
| `year-month-face` | each footer face | `data-member-id` |
| `year-month-face-overflow` | the `+n` chip | `data-overflow` |

`data-types` exists because AC-11 makes the holiday colour outrank the type tint: the fact stays
observable through the attribute on the one cell where the colour can no longer carry it.

### 4.5 The period cluster — `src/lib/period.ts`

`periodNavFor` gains one thing: the year branch keeps a `/members` suffix when the pathname carries
one, so `prevTo`, `nextTo` and `todayTo` stay on the screen the caller is on (AC-16).

```ts
// segments are ["year", anchor] or ["year", anchor, "members"]
const suffix = segments[2] === "members" ? "/members" : "";
// prevTo: `/year/${shiftYear(anchor, -1)}${suffix}`, and the same for nextTo and todayTo
```

`yearTo` deliberately does **not** take the suffix: the `Year` segment is how a reader on the grid
gets back to the overview, which is the only route between the two screens that the shell can offer
without a new control. `weekTo` and `monthTo` are unchanged.

### 4.6 Copy

English, and none of it a translation (AC-17). `Total absence <yyyy>`, `PTO days`, `WFH days`,
`Public holidays`; the unit word `days` beside each figure; `Empty` in a month card's count slot; and
`View →` in the footer link.

## 5. Seam impact

**None.** No function on the data-access seam is added, removed, renamed or changed, and neither
implementation is touched. Every read this screen makes already exists and is already used by
`YearView.tsx` in the same combination:

| Read | Declared | Already used by |
|---|---|---|
| `listMembers()` | `src/lib/data/index.ts:232` | the year grid, the month grid, the week list |
| `listTeamEntriesOverlapping(range)` | `:506-512` | the same three, and the overload warning |
| `listHolidays(holidayReadRange(range))` | `:546` | the same three |

`tests/seam-parity.test.ts` is therefore unaffected and is not edited.

**What does change inside `src/lib/data/` is one added pure function**, `absenceByTypeFor`. It sits
beside `absenceCountsFor` in `src/lib/data/absence.ts` — not in a component and not on the seam —
because that is where INV-04's single pass lives, and a split written anywhere else is the second
definition ADR-032 § *Consequences* item 4 names. Neither seam implementation imports that module, so
there is nothing for the parity test to miss, exactly as `day-status.ts` already records.

**RULE-02 holds by construction.** `YearOverview.tsx` imports `seam` from `@/lib/data` and the
derivations from `@/lib/data/absence` and `@/lib/data/day-status`, which is the identical import set
`YearView.tsx` and `MonthView.tsx` carry. No `@supabase/*` import appears anywhere in this ticket, so
`eslint.config.js:64-77` has nothing to fire on.

## 6. Schema delta

`none`.

Measured rather than assumed, and the measurement is § 5: all four reads exist, none changes, and no
table, column, policy, trigger, constraint or index is implied by anything in ADR-032 or by any
criterion in § 2. ADR-014 is therefore not engaged — there is no migration for its policy/trigger/
constraint clause to catch.

**`requires_adr` stays `true` and needs no new ADR.** The decision this ticket needs is ADR-032,
already `ACCEPTED by the operator` on 2026-09-09. Nothing in this plan supersedes or reverses an
accepted decision: the five reworded criteria are the rewording that ADR § *Consequences* item 1
instructs, at the stage it names. No invariant is amended — the PTO/WFH split is a new quantity
constrained to agree with INV-04, which is § 4.1's construction and AC-6's criterion, and
`.ai/registry/invariants.md` is untouched.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/routes/YearOverview.tsx"
  - "src/App.tsx"
  - "src/lib/data/absence.ts"
  - "src/lib/period.ts"
  - "tests/absence.test.ts"
  - "tests/e2e/cal-10-year-overview.spec.ts"
  - "tests/e2e/cal-06-year-view.spec.ts"
  - "tests/e2e/cal-08-holiday-shading.spec.ts"
  - ".ai/board/tickets/CAL-06/01-plan.md"
  - ".ai/board/tickets/CAL-08/01-plan.md"
```

Exact paths, no globs. `.ai/board/tickets/CAL-10/` is absent because the guard exempts the active
ticket's own folder (`.claude/hooks/guard-allowed-paths.mjs:205-206`).

What each is for:

- **`src/routes/YearOverview.tsx`** — new, § 4.3 and § 4.4.
- **`src/App.tsx`** — § 4.2, three route lines.
- **`src/lib/data/absence.ts`** — § 4.1, one added function and its type. Nothing existing changes.
- **`src/lib/period.ts`** — § 4.5, AC-16. **This is not the shell edit Out-of-scope forbids**:
  `TopBar.tsx` and `Sidebar.tsx` are untouched, no control is added or moved, and the change is to
  which address three existing controls point when the pathname already says `/members`. Without it,
  a member on the grid who steps a year silently lands on a different screen.
- **`tests/absence.test.ts`** — AC-6 and AC-8 at the unit level, where the standard puts pure logic.
  The partition identity is asserted against `absenceCountsFor` over the same fixtures, which is the
  cheapest possible check of ADR-032's revert condition.
- **`tests/e2e/cal-10-year-overview.spec.ts`** — new. AC-1, AC-3, AC-4, AC-9 to AC-14 and AC-17.
- **`tests/e2e/cal-06-year-view.spec.ts`** and **`tests/e2e/cal-08-holiday-shading.spec.ts`** —
  address changes only, `/year/2026` → `/year/2026/members`, matching the criteria they assert. No
  assertion's substance changes; AC-2 and AC-16 are what prove it.
- **`.ai/board/tickets/CAL-06/01-plan.md`** and **`.ai/board/tickets/CAL-08/01-plan.md`** — the five
  reworded criteria in § 1, plus a Changelog line in each naming CAL-10 and ADR-032 as the cause.
  **Both are board plane and agent-writable**; neither is under `.ai/registry/**`, so RULE-01 is not
  engaged and this is not a registry amendment.

`size`: **M** — ten files, and `M` is up to 12 (`.ai/01-operating-model.md:373`). It does not split.

**Not XL.** The seam's surface is unchanged, there is no migration, and `src/lib/domain/types.ts` is
not touched at all — the one new type is declared in `src/lib/data/absence.ts` beside the function
that returns it, so the *"changes a shared type module"* clause of `.ai/01-operating-model.md:375` is
not engaged even on the reading that a new export would engage it.

**`size_estimate` said M and the verdict is M. They agree**, which is worth one line only because the
two figures were reached differently: the estimate came from the shape of the work in § 1 and the
verdict from counting § 7. The ticket's own § 5 predicted the summary band would be where the
estimate was spent, and it was — but the band cost one function in an existing module, while the
address move cost four files nobody would have counted from the picture.

## 8. Rejected alternatives

**1 — Compute the PTO/WFH split inside `YearOverview.tsx` with two `.filter()` calls on `entries`.**
By far the smallest change: no new export, no test at the unit level, and the arithmetic is three
lines. Rejected because it is precisely the failure INV-04 exists to prevent and ADR-032 §
*Consequences* item 4 names in advance. A filter on a screen applies neither the rejected-entry rule,
the tentative rule, the removed-member rule nor the range clamp, so it would produce a number that
disagrees with the total sitting next to it the first time a member is removed mid-year — and it
would disagree quietly, because both numbers look plausible. Deriving it from `walk` makes
`pto + wfh = total` an identity instead of a coincidence.

**2 — Keep the member grid at `/year/:yyyy` and put the overview at `/year/:yyyy/overview`.** This is
ADR-032's option 2, and it costs nothing: no criterion is reworded, no spec's address changes, no
shared link breaks. Rejected because the operator decided otherwise on 2026-09-09 and the ADR records
option 2's refusal in terms — the problem is what happens when a person opens the year, and leaving
the default alone leaves the problem alone. It is named here rather than omitted because it is the
cheapest option and a reviewer should see that its cost was compared rather than assumed, and because
ADR-032's own secondary revert condition is a return to exactly this shape.

**3 — Replace the member grid outright, as ADR-032 option 1.** The picture shows one screen and this
is what "change the year view like this picture" most literally means. Rejected because it deletes a
capability the brief specifies (`product_brief.md:105`), makes seven CAL-06 criteria and two CAL-08
criteria unobservable rather than merely readdressed, and removes the one screen that shows **who
declared nothing** — a member with an empty row is visible on the matrix and invisible on every
aggregate this ticket adds.

**4 — Twelve month cards, each fetching its own month.** Reads more naturally as a component, and
each card would render as soon as its own read landed. Rejected because it makes the summary band and
the cards two different views of one year that can disagree — twelve reads plus one band read is
thirteen chances for a concurrent write to land between them — and because it discards what CAL-09
bought: one range read that is complete or throws. AC-15 would become unstatable, since a partial
year would have no single moment at which to refuse.

**5 — A smooth peach-to-mint gradient for a day carrying both types, as the picture draws it.**
Closest to the operator's image. Rejected because the token set is flat hexes named for meaning and
no gradient token exists, so this needs a new token — a palette decision, which is outside the
visual-arrangement grant § 2b operates under. The hard 50/50 split composes the two existing tokens,
reads unambiguously at pill size, and invents no colour. The gradient remains available as its own
decision if the operator wants it.

## Changelog

- `2026-09-09T09:42:15+0700` — sections 1 and 2 written from `.ai/registry/features.md`,
  `ticket.yaml`, ADR-032, `design/README.md` and the image itself, before the source tree was read
  for sections 3 to 8. Raised by `tech-lead-design`.
- `2026-09-09T09:42:15+0700` — section 2, **AC-16 added after reading `src/lib/period.ts:352-366`**.
  `periodNavFor` matches on the pathname's first two segments, so `/year/2026/members` already yields
  the year cluster — but its `prevTo` and `nextTo` drop the `/members` suffix, which would silently
  move a reader from the grid to the overview when they stepped a year. ADR-032 § *Consequences*
  item 6 promises the grid is behaviourally unchanged, so this is a criterion the promise implies and
  the picture could never have shown. An addition, not a reshaping. Raised and amended by
  `tech-lead-design`.
- `2026-09-09T09:42:15+0700` — section 2, **AC-11's cost recorded rather than AC-11 softened**. Reading
  `src/routes/MonthView.tsx:508-512` showed the month grid keeps both facts on a holiday with entries,
  because it draws avatars under the lavender; the overview's pill cannot, so the type is carried on
  `data-types` instead of being dropped. The criterion was not weakened to fit the pill. Raised and
  amended by `tech-lead-design`.
