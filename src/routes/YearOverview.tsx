// CAL-10 — the year overview: four summary numbers above twelve month cards.
// 01-plan.md sections 2, 2b, 3, 4.3, 4.4 and 4.6, inside ADR-032.
//
// **IT IS THE DEFAULT YEAR SCREEN AND THE MEMBER GRID IS NOT DELETED.** ADR-032 option 3: `/year`
// and `/year/:yyyy` render THIS, and CAL-06's 365-column per-member matrix moves, behaviourally
// unchanged, to `/year/:yyyy/members`. The question this screen answers is the one no surface in the
// product could answer before it — *what did this year look like* — where the matrix answers *who is
// away, and when*. Neither replaces the other, which is why both are routed (§ 1, Out of scope).
//
// **IT DERIVES NOTHING OF ITS OWN, AND THAT IS AC-12.** Every figure is a sum over `absenceCountsFor`
// or a lookup in one of the three maps beside it, all four from INV-04's ONE `walk` in
// @/lib/data/absence. No `.filter`, no comparison over an `Entry`, no arithmetic on a row appears
// below. The summary band's PTO/WFH pair is the case ADR-032 § Consequences item 4 warns about: it
// comes from `absenceByTypeFor`, which walks that same pass with those same weights, so
// `pto + wfh = total` is an IDENTITY a reader can check on screen rather than an assertion that can
// drift (AC-5, AC-6, § 4.1).
//
// **IT COMPUTES NO OVERLOAD STATE.** `seam.getTeam()` is deliberately not called, for the reason
// YearView.tsx:24-26 already records: it exists to supply `overloadThreshold`, and calling it is the
// first step toward a colour this screen has not designed. § 1 Out-of-scope refuses
// `--color-overload` here, so no soft pink appears.
//
// **NO VIETNAMESE COPY, AND NOTHING BELOW IS A TRANSLATION OF THE PICTURE.** The interface is English
// and the rule is lint-enforced as a build failure (eslint.config.js:80-92). The picture's
// `TỔNG ĐƠN PHÉP` is not translated at all — it names *total leave requests*, mixes units with the
// two cards under it, and `phép` is leave while a WFH day is not; § 2 replaces it with the year's
// absence total, the same quantity and unit as the two beneath (§ 2 Open questions 1). And no label
// here reads `remaining`, `left`, `balance`, `quota` or `allowance`: charter refusal 1 is brushed and
// not crossed, because counting what was declared is not a quota (AC-17).
//
// The layout is the image at .ai/board/tickets/CAL-10/design/year-overview-2026-09-08.jpg, spent in
// 01-plan.md § 2 and § 2b. It is evidence of intent and not a specification — what it decides became
// a criterion there, and the three arrangements it leaves ambiguous are marked as the Tech Lead's
// own in § 2b and are implemented here: the footer link is always at the RIGHT and the faces at the
// LEFT, faces overflow after FOUR, and the card link takes the same focus treatment every other link
// in the product carries.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import { seam } from "@/lib/data";
// CAL-12 § 4.7. The viewed team's reads, through the one switch (`teamReadsFor`), and the address
// helpers that keep `?team=` across a redirect (AC-7).
import { useViewedTeam } from "@/hooks/useViewedTeam";
import { teamReadsFor, withTeamParam } from "@/lib/viewed-team";
// INV-04's module, imported DIRECTLY rather than through the seam — the same import YearView.tsx and
// MonthView.tsx make, for the same reason: neither seam implementation counts or derives anything,
// so there is no second answer for tests/seam-parity.test.ts to miss (§ 5).
import {
  absenceByTypeFor,
  absenceCountsFor,
  absentEntriesFor,
  absentMembersFor,
  eachDateInRange,
} from "@/lib/data/absence";
// CAL-08's derivation, imported the same way and for the same reason. The weekend rule lives inside
// that module and is not exported.
import { dayStatusesFor, holidayReadRange } from "@/lib/data/day-status";
import type { DateRange, DayStatus, Entry, Holiday, Member } from "@/lib/domain/types";
import { MONTH_NAMES, isRealYear, mondayIndex } from "@/lib/period";
import YearView from "./YearView";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's "Loading…" sentence. The
// sentence itself is still announced: `Loader.tsx` keeps it as `sr-only` text, because the element
// below carries `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";
import Avatar from "@/components/Avatar";

// ---------------------------------------------------------------------------
// The year vocabulary. `yyyy` in the URL, `yyyy-MM-dd` everywhere below it.
// ---------------------------------------------------------------------------

const yearRange = (year: string): DateRange => ({ start: `${year}-01-01`, end: `${year}-12-31` });

/**
 * The year it is for the person looking at the screen, read LOCALLY and not in UTC.
 *
 * The same function `YearView.tsx:93` holds, and it is deliberately not folded into @/lib/period for
 * the reason that module records at :21-25: `/year` is redirected by its own screen within a render,
 * so nothing outside a year screen needs to know what year it is. There are now two year screens and
 * therefore two copies; § 8 of period.ts's own plan is the argument for why that is still cheaper
 * than a shared clock the shell would have to consult.
 */
const currentYear = (): string => String(new Date().getFullYear()).padStart(4, "0");

/** The seven labels, Monday first (AC-4). Not Vietnamese `T2`…`CN`, which is § 1 Out-of-scope. */
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** § 2b. The `+n` chip appears after this many faces — the image draws one and states no rule. */
const FACES_SHOWN = 4;

/**
 * What one day cell is tinted by, precomputed once per date rather than once per render of a cell.
 *
 * `pto` and `wfh` are read off `absentEntriesFor`, which is the derivation that carries the entry —
 * `absentMembersFor` returns MEMBERS and has no `type` on it, so § 4.3's table cannot be read
 * literally there. Both come from the same `walk`, so this is the same lookup YearView.tsx:216-232
 * already makes for its cell marks and it is incapable of naming a date the counts do not (AC-12).
 * 03-impl-log.md § Deviations records the correction.
 */
interface DayTint {
  pto: boolean;
  wfh: boolean;
}

/** `data-types` (§ 4.4): `""`, `pto`, `wfh` or `pto wfh`. AC-11 makes the holiday colour outrank the
 *  type tint, so this attribute is where the fact stays observable on the one cell where the colour
 *  can no longer carry it. */
const typesOf = (tint: DayTint | undefined): string =>
  !tint ? "" : tint.pto && tint.wfh ? "pto wfh" : tint.pto ? "pto" : tint.wfh ? "wfh" : "";

// ---------------------------------------------------------------------------
// The screen.
// ---------------------------------------------------------------------------

// The same four phases the three period screens already use, so the states are the states a reader
// already knows. "Still loading", "you are on no team" and "the read failed" are three different
// facts and folding any two tells somebody something untrue (AC-14, AC-15).
type View =
  | { phase: "loading" }
  | { phase: "not-on-a-team" } // the caller has no member row, or has been removed
  | { phase: "unavailable" } // a throw from either read, including the completeness refusal
  | { phase: "ready"; roster: Member[]; entries: Entry[]; holidays: Holiday[] };

export default function YearOverview() {
  const { year } = useParams<{ year: string }>();

  // AC-1 and AC-3. The anchor is the URL and nothing else. An absent or malformed anchor resolves to
  // the current year ON THIS SCREEN — a mistyped address never moves the caller to the member grid,
  // which is the second half of AC-3 and the reason `YearMembers` below exists at all.
  const valid = year !== undefined && isRealYear(year);

  const range = useMemo<DateRange | null>(
    () => (valid && year ? yearRange(year) : null),
    [valid, year],
  );

  const [view, setView] = useState<View>({ phase: "loading" });

  // CAL-12 § 4.7. The viewed team decides which reads run; `resolving` and `unavailable` are this
  // screen's own loading and unavailable phases (AC-12). `loadSeq` drops the answer of a load that a
  // later one has replaced, so a slow read for one team can never be drawn under another's notice.
  const { viewed } = useViewedTeam();
  const { search } = useLocation();
  const loadSeq = useRef(0);

  const load = useCallback(async (): Promise<void> => {
    if (!range) return;
    const seq = ++loadSeq.current;
    const stale = (): boolean => seq !== loadSeq.current;
    setView({ phase: "loading" });
    if (viewed.kind === "resolving") return;
    if (viewed.kind === "unavailable") {
      setView({ phase: "unavailable" });
      return;
    }
    const reads = teamReadsFor(seam, viewed);

    try {
      const me = await seam.getCurrentMember();
      if (stale()) return;

      // A caller with no member row, and a removed one, land here. Both read no entries at all —
      // `member_team_id` filters `removed_at is null` inside its own body — so this state is the
      // honest one for both (AC-14).
      if (!me) {
        setView({ phase: "not-on-a-team" });
        return;
      }

      // The same three reads YearView.tsx:161-171 makes, in the same combination, adding nothing
      // (§ 4.3, § 5). `listMembers()` returns the roster INCLUDING removed members (ADR-013), which
      // every derivation below needs to decide each date. The holiday range is PADDED, through the
      // one exported function, because `dayStatusesFor` is not total on its own range.
      //
      // ONE RANGE READ FOR THE WHOLE YEAR, and it stays one (§ 2, the assumption that ships).
      // `listTeamEntriesOverlapping` has been paged and complete-or-throw since CAL-09, so twelve
      // month cards are twelve SLICES of one result rather than twelve reads — which is what makes
      // the band and the cards incapable of describing two different years (§ 8, alternative 4).
      const [roster, entries, holidays] = await Promise.all([
        reads.roster(),
        reads.entriesOverlapping(range),
        seam.listHolidays(holidayReadRange(range)),
      ]);
      if (stale()) return;

      setView({ phase: "ready", roster, entries, holidays });
    } catch {
      if (stale()) return;
      // AC-15. All three reads throw on a transport failure and on a possibly-truncated answer. This
      // branch is the refusal: no band and no cards at all, rather than four numbers summed from
      // part of a year — which is worse than an error, because nothing about it looks wrong.
      setView({ phase: "unavailable" });
    }
  }, [range, viewed]);

  useEffect(() => {
    void load();
  }, [load]);

  const ready = view.phase === "ready" ? view : null;

  // AC-5, AC-8, AC-9 and AC-12. INV-04's number, per date, for the whole year. Every figure on this
  // screen that is a count is a SUM OVER THIS MAP and is computed by no other means.
  const counts = useMemo(
    () =>
      ready && range
        ? absenceCountsFor(ready.entries, range, ready.roster)
        : new Map<string, number>(),
    [ready, range],
  );

  // AC-6 and § 4.1. The partition, from the SAME pass with the SAME weights — so it sums to the card
  // beside it by construction. This is the one derivation CAL-10 adds.
  const byType = useMemo(
    () =>
      ready && range ? absenceByTypeFor(ready.entries, range, ready.roster) : { pto: 0, wfh: 0 },
    [ready, range],
  );

  // AC-12. The faces, per date, from the same pass as the counts — INV-04 says a view shows a
  // member's avatar exactly when that member's entry is counted.
  const faces = useMemo(
    () =>
      ready && range
        ? absentMembersFor(ready.entries, range, ready.roster)
        : new Map<string, readonly Member[]>(),
    [ready, range],
  );

  // AC-10. Which TYPES are declared on each date, flattened to one lookup per date. `absentEntriesFor`
  // is the derivation carrying the entry, and it comes from the same `walk` as the three above.
  const tints = useMemo(() => {
    const found = new Map<string, DayTint>();
    if (!ready || !range) return found;

    for (const [date, details] of absentEntriesFor(ready.entries, range, ready.roster)) {
      for (const { entry } of details) {
        const tint = found.get(date) ?? { pto: false, wfh: false };
        tint[entry.type] = true;
        found.set(date, tint);
      }
    }

    return found;
  }, [ready, range]);

  // AC-7 and AC-11. One status per date of the year, from the module the month grid and the week
  // list read — which is what makes the surfaces unable to disagree about a date.
  const statuses = useMemo(
    () => (ready && range ? dayStatusesFor(ready.holidays, range) : new Map<string, DayStatus>()),
    [ready, range],
  );

  if (!valid) return <Navigate to={withTeamParam(`/year/${currentYear()}`, search)} replace />;

  if (view.phase === "loading") {
    return (
      <p
        data-testid="year-overview-loading"
        role="status"
        className="mx-auto max-w-md rounded-card bg-card p-8 text-center text-sm opacity-70 shadow-soft"
      >
        <Loader label="Loading the year…" />
      </p>
    );
  }

  if (view.phase === "not-on-a-team") {
    return (
      <section
        data-testid="year-overview-not-on-a-team"
        className="mx-auto flex max-w-md flex-col gap-3 rounded-card bg-card p-8 text-center text-sm shadow-soft"
      >
        <p>This calendar belongs to a team, and you are not on one yet.</p>
        <Link data-testid="year-overview-sign-in" to="/signin" className="underline">
          Sign in
        </Link>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <p
        data-testid="year-overview-unavailable"
        role="alert"
        className="mx-auto max-w-md rounded-card bg-card p-8 text-center text-sm shadow-soft"
      >
        The year could not be read completely, so no figures are drawn. A total summed from part of a
        year would read as a quiet year rather than as a failed read.
      </p>
    );
  }

  const anchorYear = year as string;

  // The twelve months of the year, each holding its own dates — twelve SLICES of the one range this
  // screen already walked, grouped rather than recomputed, so no second calendar arithmetic exists
  // here to disagree with `eachDateInRange` about a leap day (AC-4).
  const months: { month: string; dates: string[] }[] = [];
  for (const date of eachDateInRange(yearRange(anchorYear))) {
    const month = date.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.month === month) last.dates.push(date);
    else months.push({ month, dates: [date] });
  }

  const sumOver = (dates: readonly string[]): number =>
    dates.reduce((total, date) => total + (counts.get(date) ?? 0), 0);

  // AC-5. The year's total, over every date of the year — the same number and the same unit as the
  // per-day totals on the member grid, reached by summing INV-04's own map and by nothing else.
  const yearTotal = sumOver(eachDateInRange(yearRange(anchorYear)));

  // AC-7. The dates whose status is a NON-WORKING holiday. A mandated `working` Saturday carries a
  // row and a name but is not one of these — `dayStatusesFor` already decided that, and reading
  // `nonWorkingReason` rather than the rows is what keeps the decision in one place.
  const holidayCount = [...statuses.values()].filter(
    (status) => status.nonWorkingReason === "holiday",
  ).length;

  // § 2b. The label of a summary card is tinted to match the quantity it names; the total and the
  // holiday count take the ink colours, since neither names a type.
  const CARDS: { kind: string; label: string; value: number; tone: string }[] = [
    { kind: "total", label: `Total absence ${anchorYear}`, value: yearTotal, tone: "text-ink-2" },
    { kind: "pto", label: "PTO days", value: byType.pto, tone: "text-ink" },
    { kind: "wfh", label: "WFH days", value: byType.wfh, tone: "text-ink" },
    { kind: "holidays", label: "Public holidays", value: holidayCount, tone: "text-ink-2" },
  ];

  return (
    <section data-testid="year-overview" data-year={anchorYear} className="flex flex-col gap-6">
      {/* AC-5 to AC-8. The summary band: four cards in one row above the twelve. `data-value` carries
          every figure whatever it is, because a missing attribute and a zero are different answers —
          and because AC-8's `0.5` must be readable as `0.5` rather than inferred from a rendering.

          THE BAND READS AS AN IDENTITY: cards 2 and 3 add up to card 1, exactly, for every dataset
          (AC-6). That is ADR-032's revert condition made visible on the screen instead of merely
          asserted in a document. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CARDS.map((card) => (
          <div
            key={card.kind}
            data-testid="year-summary-card"
            data-kind={card.kind}
            data-value={card.value}
            className="flex flex-col gap-1 rounded-card bg-card p-5 shadow-soft"
          >
            <span className={`text-xs font-medium tracking-wide uppercase ${card.tone}`}>
              {card.label}
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-3xl leading-none font-semibold">{card.value}</span>
              <span className="text-xs opacity-60">days</span>
            </span>
          </div>
        ))}
      </div>

      {/* AC-4. Twelve cards, January to December, in a four-by-three arrangement at the width the
          image draws and collapsing to one and two columns below it. */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {months.map(({ month, dates }) => {
          const monthCount = sumOver(dates);

          // AC-4. The leading blanks that put the 1st under its own weekday. Monday first, from the
          // shared `mondayIndex` — not a local weekday read, which west of UTC yields the day before
          // (@/lib/period:98-112). No TRAILING blanks: the row simply ends, because nothing on this
          // card is aligned to what comes after it.
          // `${month}-01` rather than `dates[0]`, which is the same date and is typed
          // `string | undefined` under `noUncheckedIndexedAccess`. A month always starts on its 1st.
          const lead = mondayIndex(`${month}-01`);

          // AC-12. The people counted in this month, in ROSTER order — the union of the same map the
          // cells are tinted from, so the faces and the number cannot describe different sets.
          const present = new Set<string>();
          for (const date of dates) {
            for (const member of faces.get(date) ?? []) present.add(member.id);
          }
          const shown = view.roster.filter((member) => present.has(member.id));

          return (
            <div
              key={month}
              data-testid="year-month-card"
              data-month={month}
              data-count={monthCount}
              data-empty={monthCount === 0}
              className="flex flex-col gap-3 rounded-card bg-card p-4 shadow-soft"
            >
              {/* § 2b. The month name at the left of the header and its count at the right — or, when
                  the month is empty, the word for empty in that same slot. AC-9 asks for the WORD and
                  not a `0`: a zero in a row of counts reads as a number somebody measured, and this
                  card is trying to say there was nothing to measure. */}
              <div className="flex items-baseline justify-between">
                <span className="text-sm font-semibold">
                  {MONTH_NAMES[Number(month.slice(5, 7)) - 1]}
                </span>
                <span className="text-xs opacity-70">{monthCount === 0 ? "Empty" : monthCount}</span>
              </div>

              <div>
                <div className="grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((day) => (
                    <div
                      key={day}
                      data-testid="year-month-weekday"
                      className="text-center text-[10px] font-medium opacity-50"
                    >
                      {day}
                    </div>
                  ))}
                </div>

                <div className="mt-1 grid grid-cols-7 gap-1">
                  {/* The leading blanks carry no `data-testid`, so AC-4's count of day cells is a
                      count of DATES and never of grid positions. */}
                  {Array.from({ length: lead }, (_, index) => (
                    <div key={`lead-${String(index)}`} aria-hidden="true" />
                  ))}

                  {dates.map((date) => {
                    const status = statuses.get(date);
                    const holiday = status?.holiday ?? null;
                    const tint = tints.get(date);
                    const types = typesOf(tint);
                    // AC-11. A NON-WORKING holiday is lavender and OUTRANKS the type tint. The cost
                    // is stated rather than hidden (§ 2 Open questions 3): that cell no longer shows
                    // which type was declared on it, which `data-types` is why still observable. The
                    // entries declared on it are still counted, here and in the band, so no number
                    // lies.
                    const isHoliday = status?.nonWorkingReason === "holiday";

                    return (
                      <div
                        key={date}
                        data-testid="year-day-cell"
                        data-date={date}
                        data-day-status={status ? (status.nonWorkingReason ?? "working") : ""}
                        data-types={types}
                        title={holiday !== null ? `${date} — ${holiday.name}` : date}
                        className={[
                          "flex h-6 items-center justify-center rounded-[6px] text-[10px] leading-none",
                          // CLAUDE.md § Visual direction: PTO peach, WFH mint, holidays lavender.
                          // An untinted day is the page's own pale ground rather than nothing at
                          // all, or the card would give the eye no grid to follow (§ 2b).
                          isHoliday ? "bg-holiday" : "",
                          !isHoliday && types === "pto" ? "bg-pto" : "",
                          !isHoliday && types === "wfh" ? "bg-wfh" : "",
                          !isHoliday && types === "" ? "bg-bg" : "",
                        ].join(" ")}
                        // § 2 Open questions 2, and § 1 Out-of-scope. A day carrying BOTH types is a
                        // HARD 50/50 split of the two existing tokens and never the image's smooth
                        // peach-to-mint gradient: the token set is flat hexes named for meaning and
                        // no gradient token exists, so a smooth blend would be a colour this screen
                        // invented. Hard stops compose the two tokens and invent nothing.
                        style={
                          !isHoliday && types === "pto wfh"
                            ? {
                                backgroundImage:
                                  "linear-gradient(135deg, var(--color-pto) 0 50%, var(--color-wfh) 50% 100%)",
                              }
                            : undefined
                        }
                      >
                        {/* AC-10. Every cell carries its day-of-month numeral, tinted or not. */}
                        {String(Number(date.slice(8, 10)))}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* § 2b's first arrangement decision, and it is the Tech Lead's own: the image puts the
                  link at the LEFT on its empty months and at the RIGHT on April, which also carries
                  faces. So the faces are always at the left and the LINK IS ALWAYS AT THE RIGHT, and
                  an empty month's footer holds the link alone. */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-0.5">
                  {shown.slice(0, FACES_SHOWN).map((member) => (
                    <span
                      key={member.id}
                      data-testid="year-month-face"
                      data-member-id={member.id}
                      title={member.displayName}
                      className="inline-flex h-5 w-5 items-center justify-center overflow-hidden rounded-full bg-bg text-[11px]"
                    >
                      <Avatar value={member.avatar} />
                    </span>
                  ))}
                  {/* § 2b's second: the image draws a `+4` chip and states no rule for when it
                      appears. Faces overflow after four. */}
                  {shown.length > FACES_SHOWN ? (
                    <span
                      data-testid="year-month-face-overflow"
                      data-overflow={shown.length - FACES_SHOWN}
                      className="ml-0.5 text-[10px] opacity-60"
                    >
                      +{shown.length - FACES_SHOWN}
                    </span>
                  ) : null}
                </div>

                {/* AC-13, and CAL-06 AC-12 — which this ticket does NOT reword: that criterion asks
                    for a link back to the month, and this is the link, targeted at `/month/yyyy-MM`.
                    § 2b's third arrangement decision is that it takes the same focus treatment every
                    other link in the product carries, which the image draws nowhere. */}
                <Link
                  data-testid="year-month-card-link"
                  to={withTeamParam(`/month/${month}`, search)}
                  className="text-xs underline opacity-70"
                >
                  View →
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/**
 * CAL-10 AC-3, second half — the member grid at `/year/:yyyy/members`, with the ONE behaviour the
 * move obliges: a malformed year resolves on the screen it was asked for.
 *
 * **THIS EXISTS BECAUSE `YearView.tsx` IS NOT IN THIS TICKET'S `allowed_paths` (RULE-03).** That
 * screen redirects a malformed anchor to `/year/<currentYear>` (:265), which was the member grid
 * before ADR-032 and is the OVERVIEW after it — so `/year/banana/members` would silently move the
 * caller between the two screens, which is exactly what AC-3's last clause forbids. § 4.2's three
 * route lines cannot express that, and editing `YearView` to express it is a write outside
 * `allowed_paths`. Wrapping it is the one remaining move, and it changes nothing about the grid:
 * `YearView` is rendered exactly as it is today, and reached with an anchor it already accepts.
 *
 * It is HERE and not in `src/App.tsx` so that file keeps the property four of its own route comments
 * state — *this file holds no clock* — and so the redirect stays in a component, which is the same
 * reason `/month`, `/week` and `/year` each resolve their own anchor rather than being resolved by a
 * route. 03-impl-log.md § Deviations records both.
 */
export function YearMembers() {
  const { year } = useParams<{ year: string }>();
  const { search } = useLocation();

  if (year === undefined || !isRealYear(year)) {
    return <Navigate to={withTeamParam(`/year/${currentYear()}/members`, search)} replace />;
  }

  return <YearView />;
}
