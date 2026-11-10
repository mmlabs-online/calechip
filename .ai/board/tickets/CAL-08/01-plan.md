---
ticket: CAL-08
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-05T16:13:56+07:00
inputs_read:
  - .ai/board/tickets/CAL-08/ticket.yaml
  - .ai/board/tickets/CAL-04/01-plan.md
  - .ai/board/tickets/CAL-06/01-plan.md
  - .ai/board/ideas/2026-08-31-everyone-computes-the-bridge-day-alone.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/boundaries.json
  - .ai/registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-012-design-resizes-without-routing-back.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - src/lib/data/absence.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/MonthView.tsx
  - src/routes/WeekView.tsx
  - src/routes/YearView.tsx
  - ui-language.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CAL-08 — Holidays and bridge days shown in the calendar views

## 1. Problem and scope

**The feature row, transcribed from `.ai/registry/features.md:95` without paraphrase.** The row is
long and is the specification; the sentences this plan is built on are quoted verbatim below, in the
order they appear.

> Holidays and bridge days shown in the calendar views
>
> Brief 7.5's highlighting half: holidays drawn in the month, week and year grids — lavender, per
> `CLAUDE.md` — and bridge days marked. **Bridge-day detection is not a feature of its own, and this
> row is smaller than the idea presents:** data-model.md stores no bridge day by decision,
> glossary.md already fixes the definition, and the derivation is a pure function with no permission
> row, no schema, no policy and no user action. **One module, `dayStatusesFor`, inside
> `src/lib/data/` beside the `absenceCountsFor` function CAL-04 builds**, imported by both seam
> implementations and reimplemented in neither; range-shaped and returning a per-date series, for the
> same reason `absenceCountsFor` returns `Map<date, count>`. […] **The weekend rule lives inside that
> function**, because `làm bù` makes weekend-ness data-dependent: a component asking `isSaturday(d)`
> on its own is the second definition. **The derivation takes three inputs** — non-working overrides,
> working overrides, and the weekend rule. Thursday a holiday, Friday working, Saturday a mandated
> `làm bù` working day: **Friday is not a bridge day**, and a two-input computation reports one — a
> false positive at the exact moment the highlight is the whole value. **The function is not total on
> its own range:** deciding whether the first day of a range is a bridge day needs the day before it,
> so the seam widens the fetch several days on each side and the pure function reports only the dates
> inside the requested range. **The return type must not be a flat `working | weekend | holiday |
> bridge`** — a bridge day *is* a working day, so *"is this a working day"* has to be readable
> without knowing that `bridge` implies it. **The timezone trap, which passes every test run in
> Vietnam:** every date here is `date`, not `timestamptz`, and `new Date('2026-04-30')` parses as UTC
> midnight, so a weekday read west of UTC yields the previous day and the bridge day moves.
> Comparison is on `yyyy-MM-dd` strings or a timezone-free date type, and never on a `Date` weekday
> read. **A bridge day is a working day and gets no lavender** (glossary.md): it reduces no
> denominator, is excluded from nothing, and takes no treatment borrowed from a holiday — the
> boundary a well-meaning developer will cross. It inherits the palette CAL-04 fixes and invents no
> second vocabulary. **CAL-04, CAL-05 and CAL-06 draw entries; this row draws day status on all three
> of their surfaces**, and none of them queries `holiday`. `schema_delta` none. **`Invariants
> touched` is `[]`** […] This row must not implement suppression; if it is ever wanted, the correct
> shape is to change what is drawn *beside* the number, never the number. **An empty year must be
> visible as empty:** a year with zero holidays says so, rather than rendering as a year that happens
> to have no lavender in it.

**Who gains what.** Both roles — the row grants no capability either of them lacks. What a **member**
gains is the ability to read the team's calendar and the national calendar in one pass: today a
member planning around Tết opens the month grid, sees an unremarkable run of white cells, and goes to
a government announcement in another tab to find out which of them are already days off. What an
**admin** gains is the only visible consequence of ADM-03: they can add a swap day today, and nothing
anywhere in the product changes when they do. This row is what makes the holiday calendar a calendar
rather than a table with a form on it.

**And one thing nobody gains, which is the point of the bridge mark.** A bridge day is *not* a day
off. It is an ordinary working day that everybody is about to request, and the value of drawing it is
that the crowd is visible while the crowd is forming — which is the charter's whole subject. It is
marked, and it is never marked the way a holiday is.

**`size_estimate`: M.** Three view surfaces, one new pure module, two new domain shapes, no
migration, no seam change, no new route and no new control.

### Out of scope

- **Any write.** No control to add, edit or delete a holiday appears on any of the three views. That
  is ADM-03, shipped, at `/holidays`.
- **Suppression of any kind.** A holiday does not reduce the absence count, does not change the
  overload denominator, does not exclude a date from the crowded-day comparison, and does not
  suppress CAL-07's warning inside the entry form. ADR-015 *Consequences* forbids it and names the
  failure precisely: a number altered on a holiday date is a second definition of INV-04 arriving
  through the display. If it is ever wanted, it changes what is drawn *beside* the number and goes to
  the operator first.
- **Refusing an entry on a non-working day.** A member may declare PTO across a public holiday and
  the product accepts it, exactly as it does today. `.ai/00-charter.md` refuses to block, and a
  warning here would be one.
- **Any change to how weekends are drawn.** The three views draw no weekend distinction today and
  draw none after this ticket. `dayStatusesFor` knows which days are weekends because `làm bù` makes
  that data-dependent, and knowing it is not the same as painting it. A weekend column treatment is a
  layout decision with no registry row behind it, and originating one here would spend § 2b's grant
  on something nothing asked for.
- **The month grid's out-of-month cells.** They carry no count and no overload state today (CAL-04
  AC-1) and they carry no day status after this. AC-14.
- **A "next holiday" or "days off remaining" summary anywhere.** No row asks for it, and the charter
  refuses the quota reading it would invite.
- **A density toggle.** `CLAUDE.md` names Vui/Gọn; `.ai/standards/ui-design-system.md` § Components
  specifies it nowhere. Originating a *control* is outside § 2b's grant, which covers arrangement.
  CAL-04 recorded the same refusal on the same reasoning.
- **Amending `glossary.md`.** Section 2's *Open questions* item 1 is a definition, the definition
  lives in the registry, and RULE-01 leaves it to a human. This plan states an assumption, marks it,
  and ships — because ADR-015 *Consequences* says in words that it **must not become a blocked
  gate**.

## 2. Acceptance criteria

Observable through the interface or through `pnpm test`. The selector attribute is `data-testid`.

Every date named below is a fixture date that already exists in `src/lib/fixtures.ts` and
`supabase/seed.sql` (ADM-02 shipped them, from ADR-015 § 5, and their weekdays were computed rather
than recalled). **This ticket adds no fixture.** The four rows are:

| Date | Weekday | `kind` | Name |
|---|---|---|---|
| 2026-06-11 | Thursday | `non_working` | Ngày lễ thử nghiệm |
| 2026-06-13 | Saturday | `working` | Làm bù thử nghiệm |
| 2026-06-15 | Monday | `non_working` | Nghỉ bù thử nghiệm |
| 2026-10-15 | Thursday | `non_working` | Ngày nghỉ thử nghiệm |

**AC-1 — a non-working holiday is drawn as a holiday in the month grid**
- **Given** a signed-in member
- **When** they open `/month/2026-10`
- **Then** the cell for 2026-10-15 is marked as a non-working holiday and shows the holiday's name,
  and every other in-month cell in that week is not

**AC-2 — a mandated working Saturday is drawn as a working day, and is named**
- **Given** a signed-in member
- **When** they open `/month/2026-06`
- **Then** the cell for 2026-06-13 is marked as a working day and shows the row's name, and it is not
  marked as a holiday — `kind` names the effect on the working calendar, not the Vietnamese label
  (ADR-015 § 2)

**AC-3 — a bridge day is marked, and is not drawn as a holiday**
- **Given** a signed-in member
- **When** they open `/month/2026-10`
- **Then** the cell for 2026-10-16 is marked as a bridge day, is marked as a working day, and carries
  none of the holiday treatment the 2026-10-15 cell carries

**AC-4 — the false positive a two-input computation produces (ADR-015 § 4)**
- **Given** the holiday on Thursday 2026-06-11 and the mandated working Saturday on 2026-06-13
- **When** `/month/2026-06` renders
- **Then** the cell for Friday 2026-06-12 is **not** marked as a bridge day, because the day after it
  is a working day

**AC-5 — bridge-ness is answered at the first and last day of the displayed range**
- **Given** a range whose first day is 2026-10-16 and whose last day is 2026-10-16
- **When** `dayStatusesFor` is asked for that range
- **Then** it reports 2026-10-16 as a bridge day, which is only answerable from the day before it and
  the day after it — both outside the range

**AC-6 — the week view carries the same day status as the month**
- **Given** a signed-in member
- **When** they open `/week/2026-10-12`
- **Then** the section for 2026-10-15 is marked a non-working holiday and names it, the section for
  2026-10-16 is marked a bridge day, and both agree with the month grid's cells for those dates

**AC-7 — the year view carries day status for every day of the year**
- **Given** a signed-in member
- **When** they open `/year/2026/members`
- **Then** the grid carries one day-status element per date, the elements for 2026-06-11, 2026-06-15
  and 2026-10-15 are marked non-working holidays, the element for 2026-06-13 is marked a working day,
  and the element for 2026-10-16 is marked a bridge day

**AC-8 — a year with no holidays says so**
- **Given** a signed-in member and a year for which the calendar holds no row at all
- **When** they open `/year/2027`
- **Then** the screen states in words that the calendar holds no day for that year, rather than
  rendering as a year that happens to have no lavender in it

**AC-9 — day status changes no count and no overload marking (no suppression)**
- **Given** a date that is a non-working holiday and on which members have declared entries
- **When** the month grid, the week list and the year totals are read for that date
- **Then** the absence count is the same number it is for an identical set of entries on a working
  day, and the overloaded marking is decided by the same comparison — the holiday changes neither

**AC-10 — a holiday that is also overloaded keeps its overloaded marking**
- **Given** a non-working holiday whose absence count puts it over the threshold
- **When** the month grid renders
- **Then** the cell is still marked overloaded, and the holiday is still named on it — neither signal
  is hidden by the other

**AC-11 — the three views agree about a date**
- **Given** any date visible in the month grid, the week list and the year grid
- **When** its day status is read on each
- **Then** all three report the same working state, the same holiday name or the absence of one, and
  the same bridge state

**AC-12 — a failed or possibly-truncated holiday read shows no shading and says so**
- **Given** a holiday read that throws, including the row-limit assertion `listHolidays` already
  carries (ADM-02 AC-12)
- **When** any of the three views is opened
- **Then** it renders its failure state and no grid — a calendar drawn without its holidays is a
  believable wrong answer, and the truncation is non-local: a dropped Thursday row removes *Friday's*
  bridge mark (ADR-015 *Consequences*)

**AC-13 — both roles see the same thing, and neither gets a control**
- **Given** a member and an admin
- **When** each opens the month, the week and the year
- **Then** the day status drawn is identical for both, and neither screen offers any control that
  adds, edits or deletes a holiday

**AC-14 — the month grid's out-of-month cells carry no day status**
- **Given** a month whose leading or trailing week contains a holiday from the neighbouring month
- **When** `/month/<that month>` renders
- **Then** the out-of-month cells carry no holiday marking and no bridge marking, exactly as they
  carry no count today

**AC-15 — the answer does not depend on the machine's timezone**
- **Given** the unit suite
- **When** it is run under a timezone west of UTC (`TZ=America/Los_Angeles pnpm exec vitest run`)
- **Then** every day-status assertion produces the same result as under `TZ=Asia/Ho_Chi_Minh` and
  under `TZ=UTC`

**Invariants touched.** `[]`, written explicitly.

The feature row states it and RULE-04 makes the row the source: *"this row computes no count and
cannot produce a different one, so listing INV-04 would over-declare on the same argument that
dropped INV-06 from CAL-05."* Nothing here reaches INV-04's sum — a holiday row is not an entry and
enters no term of it — and section 4 adds no arithmetic over entries at all.

**The tension is recorded rather than smoothed over.** `.ai/registry/invariants.md` § *How to use this
file* warns that *"choosing the safest behaviour and then concluding no invariant is engaged is
circular reasoning"*, and this plan does choose a safe behaviour: AC-9 and AC-10 exist precisely
because suppression was available and refused. On that reading INV-04 was in play. The registry row is
the source and it says `[]`; the argument on the other side is written here so a reviewer can weigh it
rather than re-derive it, and check R8 has a stated reason to reason from.

### Open questions

**1. TODO(project) — *"sandwiched"* is undefined for a run longer than one day, and this is the
definition of the feature.** `glossary.md`: *"a working day sandwiched between a holiday and a
weekend."* A Tuesday holiday makes Monday a bridge day unambiguously. A **Wednesday** holiday leaves
Monday *and* Tuesday between the weekend and the holiday — two bridge days, or none? Nothing in the
glossary, the brief or the charter says. The definition lives in `glossary.md`, so **the answer is the
operator's under RULE-01**, and it is recorded as owed to them by ADR-015 *Consequences* and by
`features.md:95`.

**This does not block, by explicit instruction.** ADR-015 *Consequences*: *"It does not block this
migration and must not become a blocked gate, but no story can state an acceptance criterion for the
highlight without it. […] the implementing story carries a `TODO(project)` until it is answered."*
This is that story and this is that marker.

**Assumption A1, which ships:** a run of **exactly one** working day. Section 4.2 implements it as
*both immediate neighbours are non-working*, which is the same statement locally. It is the
recommendation `features.md:95` already carries — *"exactly one working day, matching sandwiched — a
highlight covering half a week stops meaning anything"* — and it is the reading under which a
Wednesday holiday produces **no** bridge day.

**What changes if the operator answers otherwise:** one predicate in `day-status.ts` and the unit
tests for it. Nothing at a call site, and no type changes — which is why section 4.2 pads the read by
a week rather than by the one day A1 needs.

**2. TODO(project) — must the two bounding days be *a holiday and a weekend*, or any two non-working
days?** The glossary names one of each. Under that literal reading, a working Tuesday between a
Monday holiday and a Wednesday holiday is **not** a bridge day, which is the case most certain to be
requested off. This is the same registry sentence as item 1 and goes to the same person.

**Assumption A2, which ships:** **any two non-working days**. The glossary enumerates the two kinds of
non-working day that exist rather than requiring one of each, and section 4.2 implements the general
form. Two consequences fall out of A2 and are stated so they are not discovered later:

- A working day between two holidays is a bridge day.
- A mandated `working` Saturday whose neighbours are both non-working is a bridge day. Uniform, and
  deliberately not carved out — a carve-out would be an invented rule, where A2 is a stated reading of
  an existing one.

**3. `.ai/standards/ui-design-system.md` § Colour is still `TODO(project)`.** The palette is cited to
`CLAUDE.md` § *Visual direction*, the only place in the repository that carries it — *holidays are
lavender* — exactly as CAL-04, CAL-05 and CAL-06 each cited it. Every acceptance criterion above turns
on an **attribute**, never on a colour, so none of them changes when the standard is finally written.

**4. Not a question, recorded because it is the residual risk of section 4.2.** `dayStatusesFor`
cannot tell *"there is no holiday row on 2026-10-14"* from *"you did not fetch 2026-10-14"*. The
mitigation is that the padding is one exported function used at all three call sites, and AC-5 fails
if the function itself stops looking outside the range. A call site that fetched the bare range would
be wrong only at the two edges of a screen, which is section 8's rejected alternative 2 and the reason
the pad is not a local expression at three sites.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

`.ai/board/tickets/CAL-08/design/` does not exist, and
`.ai/board/ideas/2026-08-31-everyone-computes-the-bridge-day-alone.md` attaches no image. So the
arrangement below is originated here under `.ai/standards/ui-design-system.md` § *Visual
specification* and marked as this agent's own — which is what lets a reviewer argue with it cheaply
instead of mistaking it for a requirement. `_figma/` was not read, cited or copied; the same refusal
CAL-06 recorded.

**The one constraint that is *not* mine and is not negotiable:** a bridge day is a working day and
**gets no lavender**. `glossary.md` says so and the feature row calls it *"the boundary a well-meaning
developer will cross"*. Lavender means *not working*. A bridge day is marked with a separate,
deliberately quieter mark.

**Month grid** — the cell keeps everything CAL-04 put in it and gains two things:

- A non-working holiday fills the cell lavender, in place of the white it has today, and the holiday's
  name is drawn in the cell under the date.
- A bridge day keeps its white background and gains a small outlined `Bridge` badge beside the date.
- **Precedence, stated once:** the overloaded soft pink still wins the background (AC-10). The holiday
  name is drawn whenever a row exists, so an overloaded holiday is pink *and* named — the crowded-day
  signal is what this product is for, and a colour that hid it would be a suppression by the back
  door.
- A `working` row draws no fill and its name is drawn like any other, so an admin can see the swap day
  they entered (AC-2).

**Week list** — the day heading gains the holiday's name and, where it applies, the `Bridge` badge; a
non-working holiday tints the section header lavender. The rows below are untouched.

**Year grid** — a **new one-row strip immediately under the month labels**, one element per date,
sharing the existing column template. Lavender where the day is a non-working holiday, a dot where it
is a bridge day, `title` carrying the holiday name.

That placement is the one real layout decision in this ticket and it is made for a stated reason:
tinting the member cells themselves would put a lookup on all 10,950 of them, and CAL-06's plan makes
the per-cell budget the property that decides whether the screen scrolls. A strip is 365 elements, is
scannable as a calendar band, and leaves CAL-06's grid exactly as it shipped.

## 3. Permission model

`.ai/standards/rbac-and-security.md` rows 38 and 39.

| Action | `member` | `admin` | Where the check lives |
|---|---|---|---|
| Read the holiday calendar | ✅ | ✅ | `holiday_select_all`, the row-level security policy ADM-02 shipped. Server side, under ADR-005 |
| Add, edit or delete a holiday or swap day | ❌ | ✅ | `holiday_insert_admin`, `holiday_update_admin`, `holiday_delete_admin`, shipped by ADM-03. **Not reachable from any surface this ticket touches** |

**The two roles are identical here, and that is deliberate — the CAL-04 position, unchanged.** A
reviewer scanning these three files for a missing `is_admin` test should find its absence intended:
every row above is ✅✅ or ❌❌, and nothing in this ticket branches on `member.role`.

**This ticket adds no policy, no grant and no migration.** It consumes `holiday_select_all` exactly as
`/holidays` already does. The calendar is national and carries no `team_id` (ADR-015 § 1), so unlike
every other read on these three screens there is no team scoping to get right and none is attempted —
a view that scoped it would be a second story about a table the policy admits everybody to.

**The write denial is held by absence, and that is the weakest mechanism in this plan.** An admin
reaching `seam.addHoliday` from a console still succeeds, correctly, because ADM-03 granted it. What
these three files guarantee is that **no write reaches these surfaces** — checked by reading the seam
calls section 4.3 enumerates and finding `listHolidays` and nothing else. AC-13 asserts it from
outside.

**Nothing new becomes readable.** `listHolidays` is already called by `/holidays`, which both roles
already reach.

## 4. Contract

### 4.1 Domain types — `src/lib/domain/types.ts`

Added beside `Holiday`, which ADM-02 put there. Nothing existing changes shape, so no existing caller
changes and this is not the *"changes a shared type module"* clause of `.ai/01-operating-model.md:375`
— the CAL-04 and ADM-02 precedent, both sized M for exactly this.

```ts
/**
 * CAL-08. Why a day is not a working day, when it is not one.
 *
 * `holiday` wins over `weekend` when a `non_working` row falls on a Saturday or a Sunday: the row is
 * the more specific fact and it carries a name to draw.
 */
export type NonWorkingReason = "weekend" | "holiday";

/**
 * CAL-08. The status of one date.
 *
 * NOT a flat `"working" | "weekend" | "holiday" | "bridge"` union. A bridge day IS a working day, and
 * a caller asking "is this a working day" must be able to read the answer without knowing that
 * `bridge` implies it — .ai/registry/features.md:95 states that as a requirement on this type.
 */
export interface DayStatus {
  date: string; // yyyy-MM-dd. Never a Date — the trap is named beside `Holiday.date`.
  /** The one question every caller asks. True for a bridge day and for a mandated `working` Saturday. */
  working: boolean;
  /** Null EXACTLY when `working` is true. */
  nonWorkingReason: NonWorkingReason | null;
  /** The row on this date, of EITHER kind, or null when there is none. It carries the name to draw. */
  holiday: Holiday | null;
  /** Implies `working === true`. A bridge day is a working day and gets no lavender (glossary.md). */
  bridge: boolean;
}

/**
 * Every date in the requested range, present as a key including the ordinary ones — the contract
 * `AbsenceCounts` already keeps, so a caller iterating one map can index the other with no fallback.
 */
export type DayStatuses = ReadonlyMap<string, DayStatus>;
```

### 4.2 The derivation — `src/lib/data/day-status.ts` (new)

```ts
import type { DateRange, DayStatus, DayStatuses, Holiday } from "../domain/types";
import { addDays, eachDateInRange } from "./absence";

/**
 * How far outside the requested range `holidays` must reach. See `holidayReadRange`.
 *
 * A1 (01-plan.md section 2, Open questions) needs exactly 1. It is 7 because that question is still
 * the operator's: a pad of 1 encodes the answer at every call site, and 7 covers any run a week or
 * shorter, so changing the predicate later changes the predicate and nothing else. The cost is at
 * most fourteen extra rows against a calendar of roughly fifteen a year.
 */
export const BRIDGE_LOOKAROUND_DAYS = 7;

/**
 * The range to pass to `seam.listHolidays` when the dates you intend to draw are `range`.
 *
 * `dayStatusesFor` IS NOT TOTAL ON ITS OWN RANGE (.ai/registry/features.md:95): deciding whether the
 * first day of a range is a bridge day needs the day before it. Exported so the three views share one
 * pad rather than each writing an expression — a call site that fetched the bare range would be wrong
 * only at the two edges of a screen, which is the failure nobody reports.
 */
export const holidayReadRange = (range: DateRange): DateRange => ({
  start: addDays(range.start, -BRIDGE_LOOKAROUND_DAYS),
  end: addDays(range.end, BRIDGE_LOOKAROUND_DAYS),
});

/**
 * The status of every date in `range`, inclusive at both ends.
 *
 * @param holidays every `holiday` row in `holidayReadRange(range)`, BOTH KINDS. The function cannot
 *                 tell a date with no row from a date you did not fetch, so passing the bare range
 *                 silently mis-answers the two edges.
 * @param range    the dates to report. Keys outside it never appear in the answer.
 *
 * Pure. Fetches nothing, constructs no client, names no column.
 */
export function dayStatusesFor(holidays: readonly Holiday[], range: DateRange): DayStatuses;
```

**The weekend rule is module-private and is never exported.** The registry row: *"a component asking
`isSaturday(d)` on its own is the second definition."* Exporting it would be publishing exactly that
second definition, so the rule is a constant inside this file and the only way to read it from outside
is `DayStatus.nonWorkingReason === "weekend"`.

**Three inputs, one array.** ADR-015 § 4 requires the derivation to consume non-working overrides,
working overrides and the weekend rule, because a two-input computation reports Friday 2026-06-12 as a
bridge day and it is not one (AC-4). All three are present: `Holiday.kind` discriminates the first two
inside one array, and the weekend rule is the module constant. They are not **two parameters** because
splitting them would put a `.filter(h => h.kind === …)` at every call site, which is the second
definition in a different costume — section 8, rejected alternative 3.

**The derivation, stated so the Developer implements a decision rather than takes one:**

1. `working` is false when a `non_working` row falls on the date; true when a `working` row does;
   otherwise the weekend rule decides. **The row always wins over the rule** — that is what makes a
   mandated Saturday representable and is the whole of ADR-015 § 2. `unique (date)` makes it
   single-valued (ADR-015 § 3), so there is no precedence between two rows to invent.
2. `nonWorkingReason` is `"holiday"` when a `non_working` row exists, `"weekend"` when the rule alone
   decided it, and `null` when `working` is true.
3. `holiday` is the row on that date whatever its `kind`, so a `working` Saturday can be named (AC-2).
4. `bridge` is true when `working` is true **and** the day before and the day after are both not
   working. That is A1 and A2 together, and every input it needs for the edges of `range` comes from
   the padded read.

**Every comparison is on `yyyy-MM-dd` strings, and no local date accessor appears in this file.** The
timezone trap is named twice in the registry and once in ADR-015 *Consequences*, and it passes every
test run in Vietnam: `new Date('2026-04-30')` parses as UTC midnight, so a weekday read west of UTC
yields the previous day and the bridge day moves. `addDays` and `eachDateInRange` are imported from
`./absence`, which already does its arithmetic through UTC for this reason; the weekend rule reads
`getUTCDay` and never `getDay`. AC-15 is the assertion.

**Where it lives, and why it is not in the seam.** `src/lib/data/day-status.ts`, beside `absence.ts`,
because `features.md:95` puts it there by name. **Neither seam implementation imports it** — the
CAL-04 resolution, applied unchanged: the registry's fear is two answers that
`tests/seam-parity.test.ts` cannot see, since that test compares names and arity, and with zero copies
inside the seam there is nothing for it to miss. The three views import this module directly, exactly
as they already import `absence.ts`. `src/lib/data/` is the one directory `boundaries.json` exempts
for the Supabase client, and this file imports no client at all, so the boundary is untouched.

### 4.3 What each view reads, and what it draws

**One read is added to each view and no other seam call changes.** In every case it joins the existing
`Promise.all`, so a holiday failure lands in the `catch` that already exists and AC-12 is held by the
`unavailable` branch each view already renders.

| View | Added seam call | Range passed to `dayStatusesFor` |
|---|---|---|
| `MonthView.tsx` | `seam.listHolidays(holidayReadRange(range))` | `range`, the month — **not** the whole-weeks grid, so the leading and trailing cells stay stateless (AC-14) |
| `WeekView.tsx` | `seam.listHolidays(holidayReadRange(range))` | `range`, the seven days |
| `YearView.tsx` | `seam.listHolidays(holidayReadRange(range))` | `range`, the year |

`dayStatusesFor` is called once per view inside a `useMemo` keyed on the reads and the range — the
shape all three already use for `absenceCountsFor`.

**`YearView.tsx` reads `holidays.length === 0` for AC-8**, from the rows the range returned rather
than from the statuses: every date is a key in `DayStatuses` whether or not anything is drawn on it,
so the map can never answer *"this year has no calendar"*. The padded read makes this slightly
conservative — a January row for the next year would defeat the sentence — and that is the right
direction: the sentence claims the calendar is empty and must not appear when a row was seen.

### 4.4 Selectors

`data-testid`, per `.ai/standards/testing-standards.md`. Existing selectors are unchanged; the
attributes below are added to elements that already exist, except the three marked **new**.

| Selector | Where | Attributes added |
|---|---|---|
| `month-cell` | existing | `data-day-status` = `working` \| `weekend` \| `holiday`, empty on an out-of-month cell (AC-14); `data-bridge` = `true` \| `false` |
| `month-cell-holiday` | **new**, inside the cell, present only when a row exists | `data-kind` = `non_working` \| `working`; text is `holiday.name` |
| `month-cell-bridge` | **new**, inside the cell, present only on a bridge day | — |
| `week-day` | existing | `data-day-status`, `data-bridge` |
| `week-day-holiday` | **new**, in the day heading, present only when a row exists | `data-kind`; text is `holiday.name` |
| `week-day-bridge` | **new**, in the day heading, present only on a bridge day | — |
| `year-daystatus` | **new**, the strip | — |
| `year-daystatus-cell` | **new**, one per date | `data-date`, `data-day-status`, `data-bridge`; `title` carries the name when there is one |
| `year-holidays-empty` | **new**, present only when the year returned no row | — |

**The criteria turn on the attributes and never on the colour**, so AC-1 through AC-14 stay true when
`.ai/standards/ui-design-system.md` § Colour is finally written. `data-day-status` carries three values
and not four: `bridge` is a separate attribute because a bridge day is a working day, and folding it
in would rebuild the flat union the feature row forbids.

## 5. Seam impact

**None.** No function is added, removed, or changed in name, arity or behaviour.

`listHolidays(range: DateRange): Promise<Holiday[]>` is ADM-02's, is already implemented in both
`supabase.ts` and `mock.ts`, already sorts ascending and already carries the `HOLIDAY_LIMIT`
truncation assertion this ticket's AC-12 depends on. It is called with a wider range than `/holidays`
calls it with, and a wider range is not a contract change.

`tests/seam-parity.test.ts` passes unedited, and **neither implementation gains an import of
`day-status.ts`** — section 4.2 says why, and it is the reason the parity test has nothing to miss
here. `src/lib/data/mock.ts` and `src/lib/data/supabase.ts` are therefore **not** in `allowed_paths`,
which also keeps this ticket clear of OPS-002's remaining `copyDebt` files.

## 6. Schema delta

`none`.

No migration, no table, no column, no constraint, no policy, no grant, no trigger. ADR-014 has nothing
to bite on because nothing is applied: this ticket reads `public.holiday`, which ADM-02 created and
seeded and whose `holiday_select_all` policy ADM-02 shipped, and it writes nothing anywhere.

`features.md:95` calls this out as the only one of ADR-015's three rows that is genuinely `none` under
ADR-014, and ADR-015 *Consequences* says the same in the other direction. `requires_adr: false`, and
no ADR is written: nothing here decides anything ADR-015 has not already decided.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/data/day-status.ts"
  - "src/lib/domain/types.ts"
  - "src/routes/MonthView.tsx"
  - "src/routes/WeekView.tsx"
  - "src/routes/YearView.tsx"
  - "tests/day-status.test.ts"
  - "tests/e2e/cal-08-holiday-shading.spec.ts"
```

Seven globs, seven files; three are new — the module, its unit test, and the end-to-end spec.

**`size`: M, agreeing with `size_estimate` in section 1.** ADR-012 is not engaged and nothing splits.
Seven is comfortably inside M's ceiling of twelve, and the estimate and the count were made from the
same fact — three surfaces and one module — which is worth saying plainly rather than presenting as
corroboration.

**Deliberately absent, each with its reason:**

- **`src/lib/data/absence.ts`** — `addDays` and `eachDateInRange` are already exported from it, for
  the reason it states at its own head: the month grid walks the same vocabulary and two walkers would
  be two places where *inclusive* is decided. `day-status.ts` imports them and changes nothing.
  Section 8, rejected alternative 4, records the extraction that was considered instead.
- **`src/lib/data/index.ts`, `mock.ts`, `supabase.ts`** — no seam change (section 5). The last two are
  also OPS-002's remaining `copyDebt`, and this is the second calendar ticket in a row that avoids
  them without trying to.
- **`src/lib/fixtures.ts`, `supabase/seed.sql`** — **no fixture is added, and none is needed.** ADM-02
  shipped the four rows ADR-015 § 5 specified, including the `working` Saturday that makes AC-4 a real
  case and the empty 2027 that makes AC-8 one. `FIXTURE_HOLIDAY_BRIDGED`'s own comment says *"Friday 16
  October IS a bridge day. CAL-08 draws that highlight"*. Both files are `userContent` in
  `ui-language.json` and neither is touched.
- **`ui-language.json`** — nothing translated and nothing de-listed. `day-status.ts` is new, so
  § Language covers it from the first line and it must never be added to `copyDebt`; the list only ever
  shrinks. All copy added to the three views is English.
- **`src/App.tsx`, `src/routes/Home.tsx`** — no route and no navigation. This ticket adds a screen to
  none of them.
- **`src/components/OverloadWarning.tsx`, `src/routes/Holidays.tsx`** — CAL-07's warning does not
  consult the calendar (section 1, *Out of scope*: no suppression), and `/holidays` is ADM-02's and
  ADM-03's list, not a calendar view.
- **`tests/e2e/cal-04-month-view.spec.ts`, `cal-05-week-view.spec.ts`, `cal-06-year-view.spec.ts`** —
  **the safety nets for the three views this ticket edits, and all three must pass unedited.** If a
  holiday tint or a new element breaks a selector on any of those screens, those suites are what
  report it. The same role CAL-06 gave to CAL-04's and CAL-05's specs.
- **`tests/absence.test.ts`, `tests/seam-parity.test.ts`, `tests/ui-language.test.ts`** — pass
  unedited; none has anything to change.
- **Every migration, and `supabase/db.sql`** — `schema_delta: none` (section 6).
- **`.ai/registry/glossary.md`** — registry plane, human-only under RULE-01, and the two definitions
  this ticket needs are *Open questions* items 1 and 2. Reported, never amended.
- **`.ai/standards/ui-design-system.md`** — human plane. § Colour stays a stub and is cited, not
  filled (*Open questions* item 3).
- **`.ai/registry/features.md`** — registry plane; the `Status` column is `/ship`'s.

## 8. Rejected alternatives

**1. Deriving day status in SQL — a view over `holiday`, or a generated column.** The strongest
alternative on paper and the one that would remove the padded read entirely: the database already
holds the rows and a window function over dates answers *"are both neighbours non-working"* in one
statement. **Rejected, and ADR-015 rejected it first**, in words, before either ticket existed: it puts
a second definition of *"which days are non-working"* where the in-memory mock declared in
`architecture.md` cannot share it, so `mock.ts` and `supabase.ts` diverge while
`tests/seam-parity.test.ts` — which compares names and arity — still passes. No invariant covers bridge
days, so nothing else would report the divergence either. It also reverses ADR-005's reasoning rather
than working inside it.

**2. Letting each view pad its own read.** Genuinely plausible, and one line shorter than exporting
`holidayReadRange`: each view already computes its `range` in a `useMemo` and could widen it there.
Rejected because the failure it invites is invisible. A view that forgot the pad, or padded by one day
after the operator answers *Open questions* item 1 with a longer run, is wrong **only at the first and
last day it draws** — nobody scrolls to the edge of a year to check a bridge mark, and the month grid
would be wrong on the 1st and the 31st while looking entirely correct in between. One exported
function means the pad is decided once and changes once.

**3. Two parameters — `nonWorking: readonly Holiday[]` and `working: readonly Holiday[]`.** The
literal reading of ADR-015 § 4's *"takes non-working overrides, working overrides, and the weekend
rule"*, and it has a real argument behind it: three parameters make it impossible to call the function
with only half the calendar, which is the exact mistake that produces AC-4's false positive. Rejected
because `listHolidays` returns one array and every call site would have to split it, which puts a
`.kind` test outside the module — the same shape as the `isSaturday(d)` the registry row forbids, and
one more place to get the discrimination backwards. `Holiday.kind` is already the discriminator and
`unique (date)` already makes the status single-valued; the substance of the ADR's requirement is that
all three facts reach the derivation, and they do.

**4. Extracting the date vocabulary — `addDays`, `eachDateInRange` — into `src/lib/data/dates.ts`
first.** Defensible, and arguably where those two helpers belong: `day-status.ts` importing from
`absence.ts` couples the holiday calendar to the module that computes the absence count, and the two
have nothing to do with each other. Rejected on footprint, not on principle: it would add
`src/lib/data/absence.ts` and all of its importers to `allowed_paths` — the three views plus
`tests/absence.test.ts` — for a move that changes no behaviour, and it would put a rename inside the
one module INV-04 depends on, in a ticket whose own `invariants_touched` is `[]`. It is a chore, it is
worth doing, and it belongs to a session that is doing chores.

**5. Tinting the year view's member cells instead of adding a strip.** The obvious reading of *"drawn
in the month, week and year grids"*, and it would make a holiday column visible straight through the
grid rather than only at its top. Rejected on the budget CAL-06's plan set for that screen: 30 members
over 365 days is 10,950 cells and CAL-06 states that a derivation per cell is the difference between a
screen that scrolls and one that does not. A map lookup per cell is cheap, but it is 10,950 of them
plus 10,950 extra class computations, on the one screen in the product with a stated performance
constraint and no way to measure it (CAL-06 *Open questions* item 1). A strip is 365 elements and
leaves CAL-06's grid exactly as it shipped.

## Changelog

- `2026-09-05T16:13:56+07:00` — sections 1–8 written. First version. Raised by `tech-lead-design`.
- `2026-09-09T11:38:02:z` — **AC-7 reworded by CAL-10, and by nothing else.** ADR-032, `ACCEPTED by the operator`
  2026-09-09, moved the per-member year grid from `/year/:yyyy` to `/year/:yyyy/members` so the new
  twelve-month overview could take the default year address. AC-7 named `/year/2026` literally and
  now names `/year/2026/members`; **its substance is unchanged** — the same one day-status element
  per date, the same five dates, the same holiday, working and bridge markings, on the same grid.
  **AC-11 IS DELIBERATELY UNTOUCHED**: it says *"the year grid"* in a three-surface comparison and
  stays true as written, because the grid it names is the screen that moved rather than a screen that
  changed. Written by `developer` at CAL-10's IN_PROGRESS, which is the stage ADR-032 assigns the
  edit.
