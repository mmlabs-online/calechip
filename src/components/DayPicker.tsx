// SOLO, 2026-09-10 — the calendar the entry form chooses days on, in place of two date inputs.
//
// The operator's design replaces `From` and `To` with a month grid: click a day and it fills, click
// it again and it empties, and the days chosen need not be next to each other. The mock shows the
// 1st filled on its own beside a run of the 8th to the 12th, which is the whole reason this control
// hands its caller a SET of days rather than a pair — `dateRuns` in @/lib/date-selection is what
// turns that set back into the ranges the datastore stores.
//
// **IT HOLDS NO SELECTION AND NO RULE.** The chosen days are the caller's state, the toggle is
// `toggleDate`, and the only thing this component owns is WHICH MONTH is on screen. A picker that
// held the selection would be a second place the form's values live.
//
// **IT REFUSES NOTHING BUT WEEKENDS.** The days of the neighbouring months that complete the first
// and last week are clickable, and so are days in the past — that one is `TODO(project)` on
// .ai/registry/features.md:87 and CAL-01 AC-12, and the two date inputs this control replaces carried
// no `min` for exactly that reason.
//
// **SOLO 2026-09-14: SATURDAY AND SUNDAY ARE DISABLED, AND TODAY IS MARKED**, at the operator's
// instruction. Both operator decisions, recorded so nobody "fixes" them:
//  - A weekend cell is disabled EVEN WHEN IT IS ALREADY CHOSEN (an older entry that covers one, opened
//    for editing). Such a day can no longer be removed here; the entry is deleted and declared again.
//  - Weekdays either side of a weekend are NOT joined: Friday plus the next Monday is two runs, so two
//    entries, exactly as `dateRuns` already splits any gap.
// This is a limit on what the picker offers, not a warning that blocks (charter refusal 6 is about
// overload warnings, and those are untouched).
//
// Colour is `CLAUDE.md` § Visual direction through the tokens UIE-01 and UIE-06 declared: a chosen
// PTO day is `--color-pto` (peach), a chosen WFH day `--color-wfh` (mint), and the grid sits on
// `--color-bg`. Nothing here invents a hex.
import { useState, type JSX } from "react";
import { currentDay, monthLabel, shiftMonth } from "@/lib/period";
import { monthGridDays } from "@/lib/date-selection";

// Monday first, and the labels are English — .ai/standards/ui-design-system.md § Language. The mock
// reads `T2 … CN`; `src/routes/MonthView.tsx` already refused that translation for its own weekday
// row (UIE-06 AC-2) and the two grids must not disagree about a heading.
const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface DayPickerProps {
  /** The form's selector family — `new-entry`, `edit-entry` or `month-entry`. Every selector below
   *  is this prefix plus a suffix, exactly as `EntryForm`'s own are. */
  testIdPrefix: string;
  /** The field label, drawn on the same row as the month stepper. */
  label: string;
  /** The chosen days, `yyyy-MM-dd`. Held by the caller. */
  selected: readonly string[];
  /** One day was clicked. The caller decides what that means, with `toggleDate`. */
  onToggle(date: string): void;
  /** Which month to open on, `yyyy-MM`. Read once — after that the stepper owns it. */
  initialMonth: string;
  /** Which of the two entry colours a chosen day is filled with. */
  accent: "pto" | "wfh";
}

const NAV_BUTTON =
  "flex h-8 w-8 items-center justify-center rounded-pill text-ink-2 transition-colors " +
  "hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink";

/** The two stepper arrows. Inline SVG rather than `lucide-react`, which is the decision
 *  `src/components/Sidebar.tsx:151` already recorded for this product: the package is a dependency
 *  and no file under `src/` imports it. */
function Chevron({ direction }: { direction: "left" | "right" }): JSX.Element {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={direction === "left" ? "M10 3L5 8l5 5" : "M6 3l5 5-5 5"} />
    </svg>
  );
}

export default function DayPicker({
  testIdPrefix,
  label,
  selected,
  onToggle,
  initialMonth,
  accent,
}: DayPickerProps): JSX.Element {
  const [month, setMonth] = useState(initialMonth);
  const days = monthGridDays(month);
  // Read once per render from the caller's clock, the same `currentDay` the week view marks today with.
  const today = currentDay();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-ink-2">{label}</span>

        <div className="flex items-center gap-1">
          <button
            data-testid={`${testIdPrefix}-month-prev`}
            type="button"
            // The stepper moves the VIEW and never the selection: stepping away from a chosen day
            // does not unchoose it, which is what makes a run across a month boundary reachable.
            onClick={() => setMonth(shiftMonth(month, -1))}
            aria-label="Previous month"
            className={NAV_BUTTON}
          >
            <Chevron direction="left" />
          </button>

          <span
            data-testid={`${testIdPrefix}-month`}
            data-month={month}
            className="min-w-[7.5rem] text-center text-sm font-bold text-ink"
          >
            {monthLabel(month)}
          </span>

          <button
            data-testid={`${testIdPrefix}-month-next`}
            type="button"
            onClick={() => setMonth(shiftMonth(month, 1))}
            aria-label="Next month"
            className={NAV_BUTTON}
          >
            <Chevron direction="right" />
          </button>
        </div>
      </div>

      <div
        data-testid={`${testIdPrefix}-picker`}
        data-selected-count={selected.length}
        className="rounded-card bg-bg p-3"
      >
        <div className="grid grid-cols-7 gap-1 pb-1">
          {WEEKDAYS.map((weekday) => (
            <span
              key={weekday}
              data-testid={`${testIdPrefix}-weekday`}
              className="py-1 text-center text-xs font-bold text-ink-3"
            >
              {weekday}
            </span>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {days.map((date, index) => {
            const chosen = selected.includes(date);
            const inMonth = date.slice(0, 7) === month;
            // The grid is Monday-first in whole weeks (`WEEKDAYS` above), so columns 5 and 6 are
            // Saturday and Sunday — no `new Date(...)`, which would read a date-only string as UTC.
            const weekend = index % 7 >= 5;
            const isToday = date === today;

            return (
              <button
                key={date}
                data-testid={`${testIdPrefix}-day`}
                data-date={date}
                // Read by the specs, and the honest place to read a toggle's state from: the fill is
                // a class, and asserting on a class would assert on the palette.
                data-selected={chosen}
                data-in-month={inMonth}
                data-weekend={weekend}
                data-today={isToday}
                aria-current={isToday ? "date" : undefined}
                disabled={weekend}
                type="button"
                // `aria-pressed` and not `aria-selected`: this is a toggle button, and a screen
                // reader gets the state the fill carries visually.
                aria-pressed={chosen}
                aria-label={date}
                onClick={() => onToggle(date)}
                className={[
                  "flex aspect-square items-center justify-center rounded-pill text-sm transition-colors",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink",
                  "disabled:cursor-not-allowed disabled:opacity-40",
                  chosen
                    ? `${accent === "wfh" ? "bg-wfh" : "bg-pto"} font-bold text-ink`
                    : weekend
                      ? ""
                      : "hover:bg-line",
                  // Today: a ring, so it reads as a mark on top of whatever fill the day has.
                  isToday ? "font-bold ring-2 ring-inset ring-primary" : "",
                  // Out-of-month days are greyed and still clickable — the mock greys them, and a
                  // disabled cell would make a run that crosses a month boundary need two steps of
                  // the stepper to choose.
                  chosen ? "" : inMonth ? "text-ink" : "text-ink-3",
                ].join(" ")}
              >
                {Number(date.slice(8, 10))}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
