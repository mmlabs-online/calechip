// CAL-06 — the year view: one row per member across every day of the year.
// 01-plan.md sections 2, 2b, 3, 4.1, 4.2 and 4.3.
//
// **IT IS THE ONLY SCREEN THAT ENUMERATES MEMBERS WITH NO ENTRIES.** The month grid draws avatars
// where somebody is away and the week lists rows where somebody is away; on both, a person who has
// declared nothing simply does not appear. Here every member of the roster gets a row whether or not
// they ever appear in it, which is the property AC-3 asserts and the reason
// .ai/standards/rbac-and-security.md carries `Read the member list` at all — 01-plan.md section 3
// records that this is the layout that row was derived from.
//
// **IT IS READ-ONLY, AND THE DENIAL IS HELD BY ABSENCE.** No approve, no reject, no edit, no delete,
// no draft panel, for either role. There is no policy to point at (an admin reaching
// `seam.updateEntry` from a console still succeeds, correctly, because CAL-03 granted it), so what
// this file guarantees is that no write reaches THIS surface — checked by reading the imports below
// and finding no write function and no control. 01-plan.md section 3 names that the weakest
// mechanism in the plan.
//
// **IT DERIVES NOTHING OF ITS OWN.** Which cells are filled comes from `absentDatesByMember` and the
// per-day totals come from `absenceCountsFor`, both derivations of INV-04's ONE pass in
// @/lib/data/absence. A `.filter(e => e.status !== ...)` written anywhere in this file would be the
// second definition INV-04 exists to forbid, and the divergence it names — a filled cell on a day
// whose total does not count it — is invisible on either half of this screen alone (AC-9, AC-10).
//
// **AND IT COMPUTES NO OVERLOAD STATE.** `seam.getTeam()` is deliberately not called (01-plan.md
// section 4.2): it exists to supply `overloadThreshold`, and calling it would be the first step
// toward a colour this ticket has not designed. No soft pink appears here.
//
// Colour, and where it comes from. `.ai/standards/ui-design-system.md` § Colour is still
// `TODO(project)`, so the palette is cited to `CLAUDE.md` § Visual direction, the only place in the
// repository that carries it: PTO peach, WFH mint, tentative at reduced opacity. Holidays are
// lavender, and CAL-08 draws them HERE — the sentence this replaces said they were not drawn on this
// screen, and that ticket is the one that spends it. It draws them in a NEW ONE-ROW STRIP under the
// month ruler and NOT in the member cells: tinting those would put a lookup on all 10,950 of them,
// which is the budget this file's own comments make load-bearing (CAL-08 01-plan.md § 2b and section
// 8, rejected alternative 5). A bridge day is a working day, gets no lavender, and is marked with a
// dot instead. 01-plan.md § 2b records that no image was attached at either stage and that the
// arrangement below is the Tech Lead's own; the prototype in _figma/ is not evidence for this row and
// was not read, cited or copied.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, Navigate, useLocation, useParams } from "react-router-dom";
// The seam, through its one door. Nothing above the seam names an implementation, and this file must
// never import `./supabase` or `./mock` (RULE-02).
import { seam } from "@/lib/data";
// CAL-12 § 4.7. The viewed team's reads, through the one switch (`teamReadsFor`), and the address
// helpers that keep `?team=` across a redirect (AC-7).
import { useViewedTeam } from "@/hooks/useViewedTeam";
import { teamReadsFor, withTeamParam } from "@/lib/viewed-team";
// INV-04's module, imported DIRECTLY rather than through the seam — the same import MonthView.tsx
// and WeekView.tsx make, for the same reason: neither seam implementation counts or derives
// anything, so there is no second answer for tests/seam-parity.test.ts to miss.
import {
  absenceCountsFor,
  absentDatesByMember,
  absentEntriesFor,
  eachDateInRange,
} from "@/lib/data/absence";
// CAL-08's derivation, imported the same way and for the same reason. The weekend rule lives inside
// that module and is not exported — a `isSaturday(d)` written here would be the second definition
// .ai/registry/features.md:95 forbids, and this file draws no weekend distinction anyway.
import { dayStatusesFor, holidayReadRange } from "@/lib/data/day-status";
import type { DateRange, DayStatus, Entry, Holiday, Member } from "@/lib/domain/types";
import { TYPE_LABELS } from "@/lib/labels";
// UIE-02 § 4.5. `shiftYear`, the year shape test and the twelve abbreviated month names were
// declared BELOW, in this file; the shell's top bar needs `shiftYear` and `isRealYear`, and its week
// label needs the abbreviations. Moving each definition into one pure module leaves one copy rather
// than two. This import and the deletions under it are the whole of UIE-02's edit to this screen —
// no rendered output changes here, which is what keeps `Out of scope` item 1 true and zero spec
// files in scope. `MONTH_ABBR` holds the SAME twelve strings this file drew before.
//
// UIE-03 § 4.4. `shiftYear` LEAVES THIS IMPORT with the header that used it — stepping a year is the
// top bar's now. `MONTH_ABBR` and `isRealYear` stay: the twelve column headings and the route guard
// are untouched.
import { MONTH_ABBR, isRealYear } from "@/lib/period";
// SOLO, 2026-09-11 — the loading mark that replaced this screen's "Loading…" sentence. The
// sentence itself is still announced: `Loader.tsx` keeps it as `sr-only` text, because the element
// below carries `role="status"` and an emptied one announces nothing.
import Loader from "@/components/Loader";
import Avatar from "@/components/Avatar";

// ---------------------------------------------------------------------------
// The year vocabulary. `yyyy` in the URL, `yyyy-MM-dd` everywhere below it.
// ---------------------------------------------------------------------------

/* `YEAR_PATTERN` and this file's twelve `MONTH_NAMES` STOOD HERE and are now in @/lib/period as
   `isRealYear` and `MONTH_ABBR` (UIE-02 § 4.5). The name changed because MonthView.tsx's list is
   ALSO called `MONTH_NAMES` there and holds the months spelled in FULL — the two were never the
   same strings, so one module cannot carry both under one name. The twelve headings this screen
   draws are unchanged. */

/** AC-1 and AC-2. January 1st to December 31st, inclusive — so a leap year is 366 days and no
 *  calendar table is consulted to know it: `eachDateInRange` walks UTC instants. */
const yearRange = (year: string): DateRange => ({ start: `${year}-01-01`, end: `${year}-12-31` });

/**
 * The year `/year` with no anchor redirects to.
 *
 * This is the ONE place a LOCAL date read is correct, and the exception is worth naming because
 * every other date in this feature is deliberately UTC — MonthView.tsx's `currentMonth` and
 * WeekView.tsx's `today` record the same one. It answers "which year is it for the person looking at
 * the screen", which is a fact about their clock and not a stored `yyyy-MM-dd`.
 */
const currentYear = (): string => String(new Date().getFullYear()).padStart(4, "0");

/* OPS-002 folded the type labels that stood here into src/lib/labels.ts (AC-8). The cell is one day
   wide and carries no text, so they still reach a reader through `title` and through `data-type` —
   the wording is unchanged. */

/**
 * What one filled cell says about itself, precomputed once per filled (member, date) pair.
 *
 * AC-5 needs a cell to state its own type and a `ReadonlySet<string>` cannot carry one, so the type
 * is read from `absentEntriesFor` — already exported, already derived from the same `walk`, and
 * therefore incapable of naming a date that `absentDatesByMember` did not fill (01-plan.md section
 * 4.1). This is decoration on a cell whose FILLED-NESS was decided by the fourth derivation; it is
 * never what decides whether the cell is filled.
 */
interface CellMark {
  type: Entry["type"];
  tentative: boolean;
}

// ---------------------------------------------------------------------------
// The screen.
// ---------------------------------------------------------------------------

// Four states, and they are four for the reason MonthView.tsx and WeekView.tsx both record. "Still
// loading", "you are on no team" and "the read failed" are three different facts, and folding any
// two of them tells somebody something untrue. AC-14 is the third one: a year drawn from a
// possibly-truncated read is a grid with holes in it, which reads as a team that was never away —
// worse than an error, because nothing about it looks wrong.
type View =
  | { phase: "loading" }
  | { phase: "not-on-a-team" } // the caller has no member row, or has been removed
  | { phase: "unavailable" } // a throw from either read, including the truncation assertion
  | { phase: "ready"; roster: Member[]; entries: Entry[]; holidays: Holiday[] };

export default function YearView() {
  const { year } = useParams<{ year: string }>();

  // AC-1 and AC-11. The anchor is the URL and nothing else, so `/year/2026` typed directly produces
  // the same screen as pressing "next" from 2025. An absent or malformed anchor redirects to the
  // current year rather than rendering an empty grid: there is no criterion about a mistyped
  // address, and this year is the useful answer to somebody who mistyped one.
  const valid = year !== undefined && isRealYear(year);

  const range = useMemo<DateRange | null>(() => (valid && year ? yearRange(year) : null), [valid, year]);

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
      // `member_team_id` filters `removed_at is null` inside its own body, so every policy built on
      // it inherits that. This state is the honest one for both.
      if (!me) {
        setView({ phase: "not-on-a-team" });
        return;
      }

      // The two reads 01-plan.md section 4.2 permits, plus the ONE CAL-08 adds, and no fourth.
      // `listMembers()` returns the roster INCLUDING removed members (ADR-013), which is what AC-8
      // needs: a member removed partway through the year keeps a row, filled up to the removal and
      // empty after it.
      //
      // The holiday range is PADDED: `dayStatusesFor` is not total on its own range, because
      // deciding whether 1 January is a bridge day needs 31 December of the year before. The pad is
      // one exported function rather than an expression here, so the three views cannot disagree
      // about it (CAL-08 01-plan.md section 8, rejected alternative 2).
      const [roster, entries, holidays] = await Promise.all([
        reads.roster(),
        reads.entriesOverlapping(range),
        seam.listHolidays(holidayReadRange(range)),
      ]);
      if (stale()) return;

      setView({ phase: "ready", roster, entries, holidays });
    } catch {
      if (stale()) return;
      // AC-14. All three reads throw on a transport failure and on a possibly-truncated answer
      // (since CAL-09 the team-entry bound is `TEAM_ENTRY_PAGE_SIZE` × `TEAM_ENTRY_MAX_PAGES` —
      // @/lib/data/mock:1246-1270 — and NOT the `MONTH_ENTRY_LIMIT` this line used to cite, which
      // CAL-09 removed together with its only reader; mock.ts:37-38 records the removal). This
      // branch is the refusal: no grid at all, rather than one missing the entries the read dropped.
      //
      // CAL-08 AC-12 is the same branch for the holiday read, whose truncation is worse than local:
      // a dropped Thursday row removes FRIDAY's bridge mark (ADR-015 Consequences), and
      // `HOLIDAY_LIMIT` is the one row limit a YEAR-wide range could plausibly approach.
      setView({ phase: "unavailable" });
    }
  }, [range, viewed]);

  useEffect(() => {
    void load();
  }, [load]);

  const ready = view.phase === "ready" ? view : null;

  // AC-3, AC-4, AC-6, AC-7, AC-8, AC-10. INV-04's fourth derivation, from the same pass as the
  // month's counts and avatars and the week's rows. Nothing in this file narrows `entries` itself.
  //
  // Built ONCE, in a memo keyed on the reads and the range — the same shape MonthView and WeekView
  // use. 30 members over 365 days is 10,950 cells, and a derivation per cell is the difference
  // between a screen that scrolls and one that does not (01-plan.md section 4.3).
  const away = useMemo(
    () =>
      ready && range
        ? absentDatesByMember(ready.entries, range, ready.roster)
        : new Map<string, ReadonlySet<string>>(),
    [ready, range],
  );

  // AC-9. The totals strip, from the SAME numbers the month grid shows — this is the "year of counts"
  // the feature row names, and it is what makes the two screens comparable.
  const counts = useMemo(
    () =>
      ready && range ? absenceCountsFor(ready.entries, range, ready.roster) : new Map<string, number>(),
    [ready, range],
  );

  // AC-5 and AC-6's decoration, flattened to one lookup per FILLED cell rather than one per cell.
  //
  // A member can hold at most an `am` and a `pm` on one date (INV-01 forbids two entries on the same
  // slot), so at most two rows collapse into one mark. The TYPE is the first in `absentEntriesFor`'s
  // own order — display name, then portion `full`/`am`/`pm`, then entry id — which is fixed above
  // the seam so the cell cannot read one way on the mock and another on Supabase. TENTATIVE is
  // true when ANY of them is: a cell drawn as settled while half the day is not would be a claim of
  // certainty this product deliberately never makes (INV-05, and CLAUDE.md § Visual direction).
  const marks = useMemo(() => {
    const found = new Map<string, CellMark>();
    if (!ready || !range) return found;

    for (const [date, details] of absentEntriesFor(ready.entries, range, ready.roster)) {
      for (const { entry, member } of details) {
        const key = `${member.id}|${date}`;
        const seen = found.get(key);
        if (seen) seen.tentative = seen.tentative || entry.tentative;
        else found.set(key, { type: entry.type, tentative: entry.tentative });
      }
    }

    return found;
  }, [ready, range]);

  // CAL-08 AC-7 and AC-11. One status per date of the year, from the same module the month grid and
  // the week list read — which is what makes the three screens unable to disagree about a date.
  //
  // Built ONCE in a memo, like every other derivation on this screen: the strip is 365 elements and
  // a derivation per element is the cost this file refuses everywhere else.
  const dayStatuses = useMemo(
    () =>
      ready && range ? dayStatusesFor(ready.holidays, range) : new Map<string, DayStatus>(),
    [ready, range],
  );

  // AC-3's row order. By display name ascending, then by id — the tiebreaker `listMembers` already
  // uses, so two members sharing a name never swap places between renders. The collation is
  // explicitly `vi` and not the host default, for the reason @/lib/data/absence records: these are
  // Vietnamese display names, where the same rows would order one way in CI and another on a laptop.
  const rows = useMemo(
    () =>
      (ready ? ready.roster : [])
        .slice()
        .sort(
          (a, b) =>
            a.displayName.localeCompare(b.displayName, "vi") ||
            (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
        ),
    [ready],
  );

  if (!valid) return <Navigate to={withTeamParam(`/year/${currentYear()}`, search)} replace />;

  if (view.phase === "loading") {
    return (
      <p
        data-testid="year-loading"
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
        data-testid="year-not-on-a-team"
        className="mx-auto flex max-w-md flex-col gap-3 rounded-card bg-card p-8 text-center text-sm shadow-soft"
      >
        <p>This calendar belongs to a team, and you are not on one yet.</p>
        <Link data-testid="year-sign-in" to="/signin" className="underline">
          Sign in
        </Link>
      </section>
    );
  }

  if (view.phase === "unavailable") {
    return (
      <p
        data-testid="year-unavailable"
        role="alert"
        className="mx-auto max-w-md rounded-card bg-card p-8 text-center text-sm shadow-soft"
      >
        The year could not be read completely, so no grid is drawn. A grid with days missing from it
        would look like a year nobody was away.
      </p>
    );
  }

  const anchorYear = year as string;
  const dates = eachDateInRange(yearRange(anchorYear));

  // The month ruler, so a column can be found without counting from January. One label per month,
  // spanning that month's own days — which is also how the 28th, 30th and 31st stay aligned.
  const months: { month: string; days: number }[] = [];
  for (const date of dates) {
    const month = date.slice(0, 7);
    const last = months[months.length - 1];
    if (last && last.month === month) last.days += 1;
    else months.push({ month, days: 1 });
  }

  // One column for the member, then one per day. Declared once and shared by the ruler, every row
  // and the totals strip, so the three cannot drift out of alignment.
  const columns = { gridTemplateColumns: `9rem repeat(${dates.length}, 0.5rem)` };

  return (
    <section className="mx-auto flex max-w-full flex-col gap-6">
      {/* UIE-03 AC-3. **The year screen's own header is gone.** Its link to the landing route is
          dead — UIE-02 deleted the home screen — and `year-prev`, `year-anchor`, `year-next` and
          `year-month` are the top bar's now, under those same names (01-plan.md § 4.3). AC-5 is why
          the deleted id is described rather than named. `year-anchor` still carries
          `data-year`, so the specs reading it need no edit; `year-week` exists for the first time,
          created by the switcher's naming rule and referenced by nothing (§ 2 *Open questions* 2).

          The grid below is untouched (AC-10). */}

      {/* AC-1, AC-2, AC-3. Horizontal scroll is the GRID's and not the page's, and the member column
          is sticky inside it — 365 columns is wider than any screen, and a name that scrolls away
          leaves a row of coloured squares belonging to nobody (01-plan.md section 4.3).

          Every cell below is an ELEMENT in a CSS grid rather than a component with props of its own,
          and every value it reads was precomputed above. That is the whole of what makes 10,950
          cells renderable, and it is why nothing in this block calls a derivation. */}
      <div className="overflow-x-auto rounded-card bg-card p-4 shadow-soft">
        <div data-testid="year-grid" className="flex w-max flex-col gap-px text-xs select-none">
          <div className="grid gap-px" style={columns}>
            <div className="sticky left-0 z-10 bg-card" />
            {months.map(({ month, days }) => (
              <div
                key={month}
                data-testid="year-month-label"
                data-month={month}
                className="overflow-hidden pb-1 font-medium opacity-60"
                style={{ gridColumn: `span ${days}` }}
              >
                {MONTH_ABBR[Number(month.slice(5, 7)) - 1]}
              </div>
            ))}
          </div>

          {/* CAL-08 AC-7 and AC-11. ONE ELEMENT PER DATE, immediately under the month ruler and
              sharing the same column template, so the strip cannot drift out of alignment with the
              rows below it. Lavender for a non-working holiday; a dot for a bridge day, which is a
              working day and gets no lavender (glossary.md). The name reaches a reader through
              `title`, because a one-day-wide element has no room for text — the same answer this
              file already gives for a member cell's type.

              THE MEMBER CELLS THEMSELVES ARE UNTOUCHED. 30 members over 365 days is 10,950 cells and
              this file's own comments make the per-cell budget the property that decides whether the
              screen scrolls; a strip is 365 elements (01-plan.md section 8, rejected alternative 5). */}
          <div data-testid="year-daystatus" className="grid items-center gap-px pb-1" style={columns}>
            <div className="sticky left-0 z-10 bg-card pr-2 font-medium opacity-60">Calendar</div>
            {dates.map((date) => {
              const status = dayStatuses.get(date);
              const holiday = status?.holiday ?? null;

              return (
                <div
                  key={date}
                  data-testid="year-daystatus-cell"
                  data-date={date}
                  data-day-status={status ? (status.nonWorkingReason ?? "working") : ""}
                  data-bridge={status?.bridge ?? false}
                  title={holiday !== null ? `${date} — ${holiday.name}` : date}
                  className={[
                    "flex h-3 items-center justify-center rounded-[2px]",
                    // Lavender for a NON-WORKING holiday and for nothing else: a mandated `working`
                    // Saturday is named through `title` but not tinted (AC-2), and a weekend is drawn
                    // exactly as it is today, which is not at all (01-plan.md section 1, Out of scope).
                    status?.nonWorkingReason === "holiday" ? "bg-holiday" : "bg-bg",
                  ].join(" ")}
                >
                  {/* AC-3's mark, and it is deliberately NOT a colour: lavender means not working
                      and a bridge day is a working day that everybody is about to request. */}
                  {status?.bridge ? (
                    <span aria-hidden="true" className="block h-1 w-1 rounded-full bg-ink-2" />
                  ) : null}
                </div>
              );
            })}
          </div>

          {rows.map((member) => {
            // Precomputed, and looked up once per ROW rather than once per cell. A member with no
            // entries all year is a key here carrying an empty set — that is AC-3, and it is the
            // difference between a member the grid shows as never away and a member it forgot.
            const dayset = away.get(member.id);

            return (
              <div
                key={member.id}
                data-testid="year-row"
                data-member-id={member.id}
                className="grid items-center gap-px"
                style={columns}
              >
                <div className="sticky left-0 z-10 flex items-center gap-1 bg-card pr-2">
                  <span data-testid="year-row-avatar" aria-hidden="true">
                    <Avatar value={member.avatar} className="h-4 w-4" />
                  </span>
                  <span data-testid="year-row-name" className="truncate" title={member.displayName}>
                    {member.displayName}
                  </span>
                </div>

                {dates.map((date) => {
                  // AC-4 and AC-8. FILLED-NESS is the fourth derivation's answer and nothing else —
                  // a removed member's row simply stops being filled after `removedAt`, because
                  // `walk` stopped counting them there.
                  const filled = dayset?.has(date) ?? false;
                  const mark = filled ? marks.get(`${member.id}|${date}`) : undefined;

                  return (
                    <div
                      key={date}
                      data-testid="year-cell"
                      data-date={date}
                      // AC-5. The ATTRIBUTE is what the criterion turns on, not the colour: it keeps
                      // AC-5 true when the palette is finally written into
                      // .ai/standards/ui-design-system.md. Absent on an empty cell, so "away" and
                      // "away for an unknown reason" are never the same cell.
                      {...(mark ? { "data-type": mark.type } : {})}
                      title={mark ? `${date} — ${TYPE_LABELS[mark.type]}` : date}
                      className={[
                        "h-4 rounded-[2px]",
                        // PTO peach, WFH mint (CLAUDE.md § Visual direction), matching the chips on
                        // the month grid and the week list so one person reads the same on all three.
                        // An empty day is a faint rule rather than nothing at all, or 365 columns of
                        // white would give the eye no grid to follow.
                        !mark ? "bg-bg" : mark.type === "wfh" ? "bg-wfh" : "bg-pto",
                        // AC-6. Tentative at reduced opacity, so that "is away" and "is settled" stay
                        // visually separate: a tentative entry fills its cell on exactly the same
                        // terms as any other (INV-05) and is drawn so nobody reads the grid as
                        // certainty. A one-day-wide cell has no room for a dashed border.
                        mark?.tentative ? "opacity-50" : "",
                      ].join(" ")}
                    >
                      {/* AC-6's marking in words. Opacity is not readable to somebody who cannot see
                          it, and this is the densest screen in the product — there is no room for a
                          visible label, so the label is there for a screen reader and for the test. */}
                      {mark?.tentative ? (
                        <span data-testid="year-cell-tentative" className="sr-only">
                          Tentative
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            );
          })}

          {/* AC-9 and AC-10. One number per day, from `absenceCountsFor` over the same range — the
              same function the month grid's cell count comes from, which is what makes the two
              screens comparable and a divergence between them detectable at all.

              The DIGITS are drawn only where somebody is away: 365 zeroes is noise on a strip meant
              to be scanned. `data-count` carries the number on every day regardless, because a
              missing attribute and a zero are different answers. */}
          <div className="grid items-center gap-px pt-1" style={columns}>
            <div className="sticky left-0 z-10 bg-card pr-2 font-medium opacity-60">Away</div>
            {dates.map((date) => {
              const count = counts.get(date) ?? 0;
              return (
                <div
                  key={date}
                  data-testid="year-total"
                  data-date={date}
                  data-count={count}
                  title={`${date} — ${count}`}
                  className="h-4 overflow-hidden text-center leading-4 opacity-70"
                >
                  {count > 0 ? count : ""}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* CAL-08 AC-8. A year the calendar does not reach says so IN WORDS, rather than rendering as
          a year that happens to have no lavender in it — the feature row's own sentence.

          Read off the ROWS the range returned and not off `dayStatuses`: every date is a key there
          whether or not anything is drawn on it, so the map can never answer "this year has no
          calendar". The read is padded by a week either side, which makes this slightly conservative
          — a 1 January row belonging to the next year would defeat the sentence — and that is the
          right direction, because the sentence claims the calendar is empty and must not appear when
          a row was seen. */}
      {view.holidays.length === 0 ? (
        <p
          data-testid="year-holidays-empty"
          className="rounded-card bg-card p-6 text-center text-sm opacity-70 shadow-soft"
        >
          The holiday calendar holds no day for {anchorYear}. Nothing is marked because nothing has
          been entered, not because the year is ordinary.
        </p>
      ) : null}
    </section>
  );
}
