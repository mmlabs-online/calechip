// UIE-02 — the period vocabulary the top bar needs, and the one structural move in this ticket.
// 01-plan.md § 4.5 is the contract this file implements.
//
// **NOTHING HERE IS NEW BEHAVIOUR. Every function below already existed, module-private, in one or
// two of the three period screens**, and the top bar needs all of them. `shiftMonth` came from
// MonthView.tsx, `shiftYear` from YearView.tsx, and `mondayIndex` was DUPLICATED character for
// character in WeekView.tsx and MonthView.tsx. Moving each definition here deletes a copy rather
// than creating a third one — which is why this file's arrival edits the three screens, and why
// those three edits are import swaps that change no rendered output (01-plan.md § 7).
//
// **PURE, AND IT IMPORTS NOTHING FROM `src/lib/data/`.** 01-plan.md § 5 requires that in as many
// words. It is string arithmetic over `yyyy-MM-dd`, `yyyy-MM` and `yyyy`; it fetches nothing, names
// no column and holds no clock. RULE-02 therefore holds here by construction rather than by
// inspection — there is no import for eslint.config.js:60-79 to fire on.
//
// **IT HOLDS EXACTLY ONE CLOCK, AND ONLY FOR `/`.** Amended at PLAN rework 1. The superseded
// sentence read *it holds no clock, and that is the point of `todayTo`* — true while `/` redirected,
// false once AC-5 made `/` show the current week IN PLACE. There is no later address to wait for
// there, so `currentDay()` moved here from `WeekView.tsx` and `periodNavFor("/")` uses it.
//
// `MonthView.tsx`'s `currentMonth()` and `YearView.tsx`'s `currentYear()` are still NOT folded in
// (01-plan.md § 8, rejected alternative 4 and its amendment): `/month` and `/year` are redirected by
// their own screens within a render, so the top bar still never needs to know what month or year it
// is, and each of those functions carries the argument for why a LOCAL read is correct on the screen
// it is about.

// ---------------------------------------------------------------------------
// The names.
// ---------------------------------------------------------------------------

/**
 * Twelve entries, January first. Spelled as `MonthView.tsx` spells them, which is the spelling
 * `monthLabel` needs — `April 2026`.
 *
 * **`YearView.tsx` does NOT hold a copy of this list.** 01-plan.md § 4.5 says `MONTH_NAMES` is
 * duplicated in the two screens; measured in this tree it is not — MonthView spells the months in
 * full and YearView abbreviates them to three letters for its twelve column headings, so the two
 * lists have never held the same strings. Both are still moved here, as two exports, because the
 * alternative is to leave one of them behind and lose the reason they differ. 03-impl-log.md
 * § Deviations records the correction.
 */
export const MONTH_NAMES: readonly string[] = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

/**
 * The same twelve, abbreviated, as `YearView.tsx` spells them for its column headings and as
 * `weekLabel` needs them — `1 Dec – 7 Dec 2025`.
 *
 * NOT `MONTH_NAMES.map(n => n.slice(0, 3))`. That produces the same twelve strings today and is a
 * derivation that would silently follow any future change to the full names, which are display copy
 * for a different surface. Two lists, stated.
 */
export const MONTH_ABBR: readonly string[] = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

// ---------------------------------------------------------------------------
// Day arithmetic, in UTC and without `@/lib/data/absence`.
// ---------------------------------------------------------------------------

const DAY_MS = 86_400_000;

/** The UTC instant of a `yyyy-MM-dd` midnight. The same conversion `@/lib/data/absence` makes, and
 *  it is written again rather than imported because § 5 forbids this module a data import. */
const toInstant = (day: string): number => Date.parse(`${day}T00:00:00Z`);

const toDay = (instant: number): string =>
  new Date(instant).toISOString().slice(0, 10);

/** `day` shifted by whole days, still `yyyy-MM-dd`. UTC, so no daylight-saving boundary can move
 *  the answer by one.
 *
 *  EXPORTED as of the day-picker work: `src/lib/date-selection.ts` walks days to build a month grid
 *  and to gather a selection into runs, and it needs exactly this arithmetic. It is exported rather
 *  than copied for the reason this whole module exists — `mondayIndex` was duplicated character for
 *  character in two screens before UIE-02 folded it here, and a third copy of day arithmetic is the
 *  same defect wearing a different name. */
export const shiftDay = (day: string, by: number): string =>
  toDay(toInstant(day) + by * DAY_MS);

/**
 * The weekday of a `yyyy-MM-dd` date, 0 for Monday and 6 for Sunday. Moved verbatim from
 * `WeekView.tsx` and `MonthView.tsx`, which held identical copies.
 *
 * Read in UTC and never locally. `new Date('2026-04-30')` parses as UTC midnight and a local
 * weekday read west of UTC yields the previous day — CAL-01 01-plan.md § 4.5 records the trap.
 *
 * **It is not `day-status.ts`'s weekend test, and 01-plan.md § 4.5's "not `getUTCDay()`" is about
 * that and not about the implementation.** `src/lib/data/day-status.ts:61-63` says it from the
 * other side: that module asks *is this a weekend* and this one asks *which column is this date
 * in*, and folding the two would make a layout decision load-bearing for the calendar. `getUTCDay`
 * is the primitive underneath both, rotated here so Monday is 0.
 */
export const mondayIndex = (date: string): number =>
  (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;

// ---------------------------------------------------------------------------
// The three shapes, and whether each names something real.
// ---------------------------------------------------------------------------

const DAY_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])$/;
const MONTH_PATTERN = /^\d{4}-(?:0[1-9]|1[0-2])$/;
const YEAR_PATTERN = /^\d{4}$/;

/** Days in a `yyyy` / 1-12 month. The leap rule in full, because a century is the case a
 *  `% 4` written in a hurry gets wrong. */
function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
    return leap ? 29 : 28;
  }
  return month === 4 || month === 6 || month === 9 || month === 11 ? 30 : 31;
}

/**
 * A `yyyy-MM-dd` that names a real date. `2026-02-30` is rejected.
 *
 * The shape test alone is not enough, and this is the trap `WeekView.tsx` already recorded:
 * `Date.parse('2026-02-30T00:00:00Z')` does NOT return NaN, it rolls over to 2 March. That screen
 * caught the roll with a round trip through `addDays`; this module may not import it (§ 5), so the
 * check is the calendar arithmetic directly — which is the same answer with no data import.
 */
export const isRealDay = (day: string): boolean => {
  if (!DAY_PATTERN.test(day)) return false;
  return (
    Number(day.slice(8, 10)) <=
    daysInMonth(Number(day.slice(0, 4)), Number(day.slice(5, 7)))
  );
};

/** A `yyyy-MM`, month 01-12. Every month that passes the shape exists, so there is no second test
 *  here the way there is for a day. */
export const isRealMonth = (month: string): boolean =>
  MONTH_PATTERN.test(month);

/** A `yyyy`. */
export const isRealYear = (year: string): boolean => YEAR_PATTERN.test(year);

// ---------------------------------------------------------------------------
// Stepping, and labelling.
// ---------------------------------------------------------------------------

/** Moved verbatim from `MonthView.tsx`. `by` may be negative and may cross a year. */
export const shiftMonth = (month: string, by: number): string => {
  const total =
    Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1 + by;
  const year = Math.floor(total / 12);
  return `${String(year).padStart(4, "0")}-${String((total % 12) + 1).padStart(2, "0")}`;
};

/** Moved verbatim from `YearView.tsx`. */
export const shiftYear = (year: string, by: number): string =>
  String(Number(year) + by).padStart(4, "0");

/** `April 2026`. Moved verbatim from `MonthView.tsx`. */
export const monthLabel = (month: string): string =>
  `${MONTH_NAMES[Number(month.slice(5, 7)) - 1]} ${month.slice(0, 4)}`;

/**
 * `1 Dec – 7 Dec 2025`, from the MONDAY of the week and not from the anchor day.
 *
 * NEW, and it is the one function here that was not moved from a screen: `WeekView.tsx:282` renders
 * `Week of {start}` — the bare `yyyy-MM-dd` — and 01-plan.md § 4.5 contracts a range instead. That
 * screen's own heading is untouched by this ticket (AC-22), so this is an additional label rather
 * than a changed one.
 *
 * **A week that crosses 31 December carries BOTH years** — `29 Dec 2025 – 4 Jan 2026`. The contract
 * shows the same-year form, which is the common case and which reads badly if the year is repeated;
 * the crossing case is not in the contract and printing one year for a range that spans two would
 * be wrong rather than terse. Roughly one week in fifty-two.
 *
 * The dash is U+2013 EN DASH, which is outside the diacritic rule's range.
 */
export const weekLabel = (monday: string): string => {
  const sunday = shiftDay(monday, 6);
  const openDay = String(Number(monday.slice(8, 10)));
  const openMonth = MONTH_ABBR[Number(monday.slice(5, 7)) - 1];
  const closeDay = String(Number(sunday.slice(8, 10)));
  const closeMonth = MONTH_ABBR[Number(sunday.slice(5, 7)) - 1];
  const openYear = monday.slice(0, 4);
  const closeYear = sunday.slice(0, 4);
  const open =
    openYear === closeYear
      ? `${openDay} ${openMonth}`
      : `${openDay} ${openMonth} ${openYear}`;
  return `${open} – ${closeDay} ${closeMonth} ${closeYear}`;
};

// ---------------------------------------------------------------------------
// What the top bar reads.
// ---------------------------------------------------------------------------

/**
 * The current day, `yyyy-MM-dd`, from the caller's LOCAL clock.
 *
 * MOVED HERE FROM `src/routes/WeekView.tsx:89` AT PLAN REWORK 1 (§ 4.5). It is the ONE place a local
 * date read is correct in this module, and the exception is worth naming because every other date
 * here is deliberately UTC: it answers "what day is it for the person looking at the screen", which
 * is a fact about their clock and not a stored `yyyy-MM-dd`. Reading it in UTC would put somebody
 * west of the meridian on yesterday's week for part of every evening.
 *
 * WeekView imports it rather than keeping a second copy. `MonthView`'s `currentMonth` and
 * `YearView`'s `currentYear` are deliberately NOT moved — nothing outside those files needs them,
 * and each carries the argument for why a local read is correct *there* (§ 8, alternative 4).
 *
 * The paragraph at the top of this file that said THIS MODULE HOLDS NO CLOCK is superseded by AC-5
 * and by this function. It holds exactly one, for `/`, and the reason is in `periodNavFor` below.
 */
export const currentDay = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

export type PeriodKind = "week" | "month" | "year";

export interface PeriodNav {
  kind: PeriodKind;
  /** The human string the anchor renders — `1 Dec – 7 Dec 2025`. Unchanged by UIE-03. */
  label: string;
  /**
   * UIE-03 § 4.2. The RAW anchor the screens' own `h1` carried, which the top bar now publishes as
   * `data-week-start`, `data-month` or `data-year` according to `kind`: `yyyy-MM-dd` (the MONDAY,
   * not the day in the URL), `yyyy-MM`, or `yyyy`.
   *
   * **It is not derivable from `label`,** which is display copy — `weekLabel` renders a range and
   * `monthLabel` renders `April 2026`. Forty-three spec assertions read this value through the
   * attribute, and every one of them read it off a deleted screen header until this ticket.
   *
   * For a week it is the same Monday `prevTo` and `nextTo` already step from, so no second
   * normalisation exists here to disagree with that one.
   */
  anchorValue: string;
  /** `to` for `<kind>-prev`. */
  prevTo: string;
  /** `to` for `<kind>-next`. */
  nextTo: string;
  /** `to` for `shell-period-today` — the anchorless address, so the SCREEN resolves the clock. */
  todayTo: string;
  /** `to` for the three switcher segments. Keeps the date, exactly as the screens' own links do. */
  weekTo: string;
  monthTo: string;
  yearTo: string;
}

/** `/week/2026-10-07` -> `["week", "2026-10-07"]`. Trailing slashes and a repeated separator are
 *  both addresses react-router will route, so they are normalised away rather than falling through
 *  to `null` and hiding the cluster on a technically valid URL. */
const segmentsOf = (pathname: string): string[] =>
  pathname.split("/").filter((s) => s !== "");

/**
 * The period cluster for a pathname, or `null`.
 *
 * `null` when the pathname is not a period route AND when the anchor is absent or malformed. That
 * is what AC-15 and AC-16 render: no cluster at all, rather than one built from `banana`.
 *
 * **`"/"` IS A PERIOD ROUTE AND RESOLVES TO THE CURRENT WEEK** — `kind: "week"`, anchored at
 * `currentDay()`. Amended at PLAN rework 1, and it is the one place this module reads a clock. AC-5
 * makes it necessary: `/` now shows the current week IN PLACE rather than redirecting, so the top
 * bar has an anchor to describe and no address to wait for. AC-15 names `/` as the exception in as
 * many words.
 *
 * **Every OTHER anchorless address still yields `null`.** `/week`, `/month` and `/year` are
 * redirected by their own screens within a render, so the cluster they would need arrives with the
 * address one frame later; guessing at them here would make the shell a second source of truth
 * about what day it is, disagreeing with the screen for exactly that frame. `/` is different
 * precisely because nothing redirects it — there is no later address to wait for.
 *
 * **IT READS THE PATHNAME AND NOT `useParams()`**, and that is the single most likely way to build
 * this top bar and have it silently render nothing. The bar is rendered by the LAYOUT route, which
 * sits above the matched child route, so its own `useParams()` sees no `:day`, `:month` or `:year`.
 */
export function periodNavFor(pathname: string): PeriodNav | null {
  const segments = segmentsOf(pathname);

  // AC-5 and AC-15. `/` is the landing route and it shows the current week in place, so the cluster
  // describes that week. `todayTo` and `weekTo` are `/` ITSELF and not `/week`: the caller is
  // already on the current week, and sending them to `/week` — which redirects again to
  // `/week/<today>` — would move the address for a control whose whole meaning is "you are here".
  // AC-23 wants `/` restful, and a Today button that walks away from it is the opposite of that.
  if (segments.length === 0) {
    const anchor = currentDay();
    const monday = shiftDay(anchor, -mondayIndex(anchor));
    return {
      kind: "week",
      label: weekLabel(monday),
      anchorValue: monday,
      prevTo: `/week/${shiftDay(monday, -7)}`,
      nextTo: `/week/${shiftDay(monday, 7)}`,
      todayTo: "/",
      weekTo: "/",
      monthTo: `/month/${anchor.slice(0, 7)}`,
      yearTo: `/year/${anchor.slice(0, 4)}`,
    };
  }

  const [head, anchor] = segments;
  if (anchor === undefined) return null;

  // The switcher targets KEEP THE DATE, matching what the screens' own cross-view links already do
  // — `WeekView.tsx:294`, `MonthView.tsx:356` and `:368`, `YearView.tsx:347`. From a week the month
  // is the one containing the DAY IN THE URL and not the one containing the Monday: for a week
  // spanning a month boundary those are different months, and the caller arrived with the day.
  if (head === "week") {
    if (!isRealDay(anchor)) return null;
    const monday = shiftDay(anchor, -mondayIndex(anchor));
    return {
      kind: "week",
      label: weekLabel(monday),
      anchorValue: monday,
      prevTo: `/week/${shiftDay(monday, -7)}`,
      nextTo: `/week/${shiftDay(monday, 7)}`,
      todayTo: "/week",
      weekTo: `/week/${anchor}`,
      monthTo: `/month/${anchor.slice(0, 7)}`,
      yearTo: `/year/${anchor.slice(0, 4)}`,
    };
  }

  if (head === "month") {
    if (!isRealMonth(anchor)) return null;
    return {
      kind: "month",
      label: monthLabel(anchor),
      anchorValue: anchor,
      prevTo: `/month/${shiftMonth(anchor, -1)}`,
      nextTo: `/month/${shiftMonth(anchor, 1)}`,
      todayTo: "/month",
      // **SOLO, 2026-09-11 — THE `Week` SEGMENT OPENS TODAY'S WEEK, NOT THIS MONTH'S FIRST ONE.**
      // It read `/week/${anchor}-01`, which is what "each target keeps the date" yields for a month
      // whose date is a month. The operator was shown that contract and chose against it: *"khi mở
      // lịch tuần default luôn là today"*.
      //
      // **THE ANCHORLESS ADDRESS, NOT `/week/${currentDay()}`**, so this module still holds exactly
      // one clock read and it is still the one for `/`. `WeekView.tsx:440` redirects `/week` to
      // today's week within a render, which is the same discipline `todayTo` above keeps — the
      // SCREEN resolves the clock, and the shell never needs to know what day it is.
      weekTo: "/week",
      monthTo: `/month/${anchor}`,
      yearTo: `/year/${anchor.slice(0, 4)}`,
    };
  }

  if (head === "year") {
    if (!isRealYear(anchor)) return null;

    // CAL-10 § 4.5 and AC-16. THE YEAR IS TWO SCREENS SINCE ADR-032: `/year/:yyyy` is the overview
    // and `/year/:yyyy/members` is the per-member grid CAL-06 shipped. `prevTo`, `nextTo` and
    // `todayTo` therefore carry the suffix the caller arrived with, so stepping a year from the grid
    // lands on the grid. Without this a member who presses "next" on the matrix silently changes
    // screen, which is the one navigation failure nothing on the page would explain.
    //
    // **`yearTo` DELIBERATELY DOES NOT TAKE IT.** The `Year` segment of the switcher is how a reader
    // on the grid gets back to the overview, and it is the only route between the two screens the
    // shell can offer without a new control — which Out-of-scope forbids (§ 1, "No shell edit").
    // `weekTo` and `monthTo` leave the year cluster entirely and are unchanged.
    const onMembers = segments[2] === "members";
    const suffix = onMembers ? "/members" : "";

    // **`todayTo` IS THE ONE ANCHORED `todayTo` IN THIS MODULE, and only on the grid.** § 4.5's
    // sketch reads `/year${suffix}`, which is `/year/members` — an address CAL-10 § 4.2 refuses to
    // route ("the grid is always anchored by a year, and the anchorless case is `/year`, which is
    // the overview"), and which would in fact match `/year/:year` with a year of `members` and
    // bounce the caller to the OVERVIEW. That is the opposite of what the same paragraph asks for,
    // so the intent is kept and the expression is not: the current year is resolved HERE for this
    // one target. `currentDay()` is already this module's one clock and answers in the caller's
    // local time, which is the right reading of "what year is it for the person looking".
    //
    // On the OVERVIEW `todayTo` stays the anchorless `/year`, exactly as `/week` and `/month` are,
    // so the screen still resolves the clock everywhere it can. 03-impl-log.md § Deviations.
    const todayTo = onMembers ? `/year/${currentDay().slice(0, 4)}/members` : "/year";

    return {
      kind: "year",
      label: anchor,
      anchorValue: anchor,
      prevTo: `/year/${shiftYear(anchor, -1)}${suffix}`,
      nextTo: `/year/${shiftYear(anchor, 1)}${suffix}`,
      todayTo,
      // **SOLO, 2026-09-11 — TODAY'S WEEK, for the reason the month branch above records.** It read
      // `/week/${anchor}-01-01`: January the 1st, because `YearView.tsx:347`'s own month link goes
      // to January and `weekTo` had no counterpart on that screen to copy. A year has no week that
      // "keeping the date" names, which is why the old value had to invent one — and inventing the
      // 1st of January is exactly the answer the operator called wrong.
      //
      // `monthTo` IS DELIBERATELY UNCHANGED and still goes to January. The request names the week
      // calendar and nothing else, and the month switcher from a year is a different control with a
      // different complaint behind it, or none.
      weekTo: "/week",
      monthTo: `/month/${anchor}-01`,
      yearTo: `/year/${anchor}`,
    };
  }

  return null;
}
