// CAL-08 — the derivation, at the level the standard assigns it.
//
// `.ai/standards/testing-standards.md` puts "pure logic" at the unit level and "a full acceptance
// criterion through the interface" at the end-to-end one, and `dayStatusesFor` is the second purest
// thing in this product after `absenceCountsFor`: it fetches nothing, holds no state, and every
// criterion about WHAT a date is — working, weekend, holiday, bridge — is a call to it with rows.
// The criteria about what a date LOOKS like are in tests/e2e/cal-08-holiday-shading.spec.ts.
//
// **AC-5, AC-9 AND AC-15 ARE ASSERTED HERE OR NOWHERE, AND THAT IS DECLARED IN 03-impl-log.md.**
// - AC-5 (bridge-ness at the first and last day of the range) is a statement about a range whose
//   answer depends on dates OUTSIDE it. Through the interface it is invisible by construction: the
//   month grid pads its own read, so a screen that got it wrong would look right.
// - AC-9 (day status changes no count and no overload marking) has a rendered half in the e2e suite,
//   and its real content is that `dayStatusesFor` cannot reach INV-04's arithmetic at all. That is
//   asserted here, against the two functions side by side.
// - AC-15 (the answer does not depend on the machine's timezone) needs the process timezone changed
//   under the derivation, which no browser test can do. It is the trap ADR-015 Consequences predicts
//   will pass every test run in Vietnam, so a test that only ever runs in ICT would not be one.
//
// **The synthetic rows below are constructed here rather than imported, and that is a declared
// deviation from § Fixtures** (03-impl-log.md), on exactly the ground tests/absence.test.ts recorded
// for its entries. The standard forbids inventing ENTITIES inline because a fixture living in one
// test file drifts from `supabase/seed.sql`. These are not entities: they are the ARGUMENTS of a
// pure function, and the shapes assumptions A1 and A2 turn on — a Wednesday holiday, two holidays
// with one working day between them, a working Saturday between two non-working days — do not exist
// in the seed and cannot be added to it, because `src/lib/fixtures.ts` is not in this ticket's
// `allowed_paths` (01-plan.md section 7).
//
// The four rows that DO exist are imported and are what every criterion is written against; each
// synthetic row spreads from one of them, so the shape stays the seed's even where the date differs.
import { describe, expect, it } from "vitest";
import {
  BRIDGE_LOOKAROUND_DAYS,
  dayStatusesFor,
  holidayReadRange,
} from "@/lib/data/day-status";
import { absenceCountsFor, addDays, eachDateInRange } from "@/lib/data/absence";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_ENTRY,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_HOLIDAYS,
  FIXTURE_HOLIDAY_BRIDGED,
  FIXTURE_HOLIDAY_COMPENSATORY,
  FIXTURE_HOLIDAY_THURSDAY,
  FIXTURE_HOLIDAY_WORKING_SATURDAY,
  FIXTURE_MEMBER,
} from "@/lib/fixtures";
import type { DateRange, Holiday, Member } from "@/lib/domain/types";

/** June 2026, which holds three of the four seeded rows and ADR-015 section 4's worked example. */
const JUNE: DateRange = { start: "2026-06-01", end: "2026-06-30" };

/** October 2026, which holds the fourth — the Thursday with an ordinary Friday after it. */
const OCTOBER: DateRange = { start: "2026-10-01", end: "2026-10-31" };

/**
 * What a view passes: every row in the PADDED range. Written once here because a test that passed
 * the bare range would be testing a call site nobody makes, and would pass while AC-5 failed.
 */
const rowsFor = (range: DateRange, rows: readonly Holiday[] = FIXTURE_HOLIDAYS): Holiday[] => {
  const padded = holidayReadRange(range);
  return rows.filter((row) => row.date >= padded.start && row.date <= padded.end);
};

/** The statuses a view would draw for `range`, from the rows a view would have fetched for it. */
const statusesFor = (range: DateRange, rows: readonly Holiday[] = FIXTURE_HOLIDAYS) =>
  dayStatusesFor(rowsFor(range, rows), range);

let serial = 0;
/** One row, spread from a seeded one so the shape is the seed's. Only the date and the kind move. */
const holiday = (date: string, kind: Holiday["kind"] = "non_working"): Holiday => ({
  ...(kind === "working" ? FIXTURE_HOLIDAY_WORKING_SATURDAY : FIXTURE_HOLIDAY_THURSDAY),
  id: `dd000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`,
  date,
});

// ---------------------------------------------------------------------------
// The fixtures' own weekdays, asserted rather than trusted.
//
// src/lib/fixtures.ts says every weekday in it was COMPUTED and not recalled, and ADR-015 section 5
// says a fixture whose weekday is wrong makes the case it exists to represent silently not that
// case. This is the cheapest place to find that out, and CAL-08 is the ticket ADM-02's comment names
// as the one that would otherwise discover it far from here.
// ---------------------------------------------------------------------------

const utcWeekday = (date: string): number => new Date(`${date}T00:00:00Z`).getUTCDay();

describe("the four seeded rows fall on the weekdays ADR-015 section 4 needs", () => {
  it("11 June 2026 is a Thursday, 13 June a Saturday, 15 June a Monday, 15 October a Thursday", () => {
    expect(utcWeekday(FIXTURE_HOLIDAY_THURSDAY.date)).toBe(4);
    expect(utcWeekday(FIXTURE_HOLIDAY_WORKING_SATURDAY.date)).toBe(6);
    expect(utcWeekday(FIXTURE_HOLIDAY_COMPENSATORY.date)).toBe(1);
    expect(utcWeekday(FIXTURE_HOLIDAY_BRIDGED.date)).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// The contract on `DayStatus` and `DayStatuses` (01-plan.md section 4.1).
// ---------------------------------------------------------------------------

describe("section 4.1: every date in the range is a key, and no date outside it is", () => {
  it("keys the whole of October and nothing either side, despite a padded input", () => {
    const statuses = statusesFor(OCTOBER);

    expect(statuses.size).toBe(31);
    for (const date of eachDateInRange(OCTOBER)) expect(statuses.has(date)).toBe(true);

    // The read reached a week either side. None of it appears in the answer — the same contract
    // `AbsenceCounts` keeps, so a caller iterating one map can index the other with no fallback.
    expect(statuses.has("2026-09-30")).toBe(false);
    expect(statuses.has("2026-11-01")).toBe(false);
  });
});

describe("section 4.1: `nonWorkingReason` is null EXACTLY when `working` is true", () => {
  it("holds on every date of two months", () => {
    for (const range of [JUNE, OCTOBER]) {
      for (const status of statusesFor(range).values()) {
        expect(status.nonWorkingReason === null).toBe(status.working);
      }
    }
  });
});

describe("section 4.1: `bridge` implies `working` — a bridge day IS a working day", () => {
  it("holds on every date of two months, which is what the type refuses to fold together", () => {
    for (const range of [JUNE, OCTOBER]) {
      for (const status of statusesFor(range).values()) {
        if (status.bridge) expect(status.working).toBe(true);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// The acceptance criteria.
// ---------------------------------------------------------------------------

describe("AC-1: a non-working holiday is not a working day, and carries its name", () => {
  it("15 October 2026 is a holiday, named, and the rest of its week is not", () => {
    const statuses = statusesFor(OCTOBER);
    const day = statuses.get("2026-10-15");

    expect(day?.working).toBe(false);
    expect(day?.nonWorkingReason).toBe("holiday");
    expect(day?.holiday?.name).toBe(FIXTURE_HOLIDAY_BRIDGED.name);
    expect(day?.holiday?.kind).toBe("non_working");

    // Monday to Friday of that week, and only the 15th carries a row.
    for (const date of ["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-16"]) {
      expect(statuses.get(date)?.holiday).toBeNull();
      expect(statuses.get(date)?.working).toBe(true);
    }
  });
});

describe("AC-2: a mandated working Saturday is a working day, and is named", () => {
  it("13 June 2026 is working, is named, and is not a holiday — `kind` names the effect", () => {
    const day = statusesFor(JUNE).get("2026-06-13");

    // THE ROW WINS OVER THE WEEKEND RULE. That is the whole of ADR-015 section 2, and it is the
    // reason `kind` is worth having: a Saturday the government turns into a working day.
    expect(day?.working).toBe(true);
    expect(day?.nonWorkingReason).toBeNull();
    expect(day?.holiday?.name).toBe(FIXTURE_HOLIDAY_WORKING_SATURDAY.name);
    expect(day?.holiday?.kind).toBe("working");
  });

  it("the Saturday before it, with no row, is an ordinary weekend", () => {
    const day = statusesFor(JUNE).get("2026-06-06");

    expect(day?.working).toBe(false);
    expect(day?.nonWorkingReason).toBe("weekend");
    expect(day?.holiday).toBeNull();
  });
});

describe("AC-3: a bridge day is a working day with no holiday row of its own", () => {
  it("16 October 2026 is a bridge day, is working, and carries no lavender to inherit", () => {
    const day = statusesFor(OCTOBER).get("2026-10-16");

    expect(day?.bridge).toBe(true);
    expect(day?.working).toBe(true);
    expect(day?.nonWorkingReason).toBeNull();
    // The boundary the feature row calls "the one a well-meaning developer will cross": there is no
    // row here, so there is nothing to name and nothing to tint.
    expect(day?.holiday).toBeNull();
  });

  it("the holiday that creates it is not itself a bridge day", () => {
    expect(statusesFor(OCTOBER).get("2026-10-15")?.bridge).toBe(false);
  });
});

describe("AC-4: the false positive a two-input computation produces (ADR-015 section 4)", () => {
  it("Friday 12 June 2026 is NOT a bridge day, because the Saturday after it is a working day", () => {
    const statuses = statusesFor(JUNE);

    expect(statuses.get("2026-06-11")?.working).toBe(false); // Thursday, the holiday
    expect(statuses.get("2026-06-13")?.working).toBe(true); // Saturday, mandated working
    expect(statuses.get("2026-06-12")?.bridge).toBe(false);
  });

  it("and it IS a bridge day once the mandated Saturday is taken away", () => {
    // The same June with the `working` row removed — the two-input computation, run deliberately.
    // Without this the criterion above passes on any function that never returns true.
    const withoutTheSwapDay = FIXTURE_HOLIDAYS.filter(
      (row) => row.id !== FIXTURE_HOLIDAY_WORKING_SATURDAY.id,
    );

    expect(statusesFor(JUNE, withoutTheSwapDay).get("2026-06-12")?.bridge).toBe(true);
  });
});

describe("AC-5: bridge-ness is answered at the first and last day of the range", () => {
  it("a one-day range asking about 16 October 2026 answers from both days outside it", () => {
    const oneDay: DateRange = { start: "2026-10-16", end: "2026-10-16" };
    const statuses = statusesFor(oneDay);

    expect(statuses.size).toBe(1);
    // Only answerable from the 15th (a holiday) and the 17th (a Saturday), neither of which is in
    // the range and neither of which appears in the answer.
    expect(statuses.get("2026-10-16")?.bridge).toBe(true);
  });

  it("the same day answered from the BARE range is wrong, which is why the pad is exported", () => {
    // 01-plan.md section 2, Open questions 4: the function cannot tell "no row on the 15th" from
    // "you did not fetch the 15th". This asserts the failure the padded read exists to prevent, so
    // that a call site which quietly stopped padding is a failing test rather than a wrong edge.
    const bare = FIXTURE_HOLIDAYS.filter((row) => row.date === "2026-10-16");

    expect(dayStatusesFor(bare, { start: "2026-10-16", end: "2026-10-16" }).get("2026-10-16")?.bridge).toBe(
      false,
    );
  });

  it("`holidayReadRange` reaches a week either side, and no call site writes that number", () => {
    const padded = holidayReadRange(OCTOBER);

    expect(padded.start).toBe(addDays(OCTOBER.start, -BRIDGE_LOOKAROUND_DAYS));
    expect(padded.end).toBe(addDays(OCTOBER.end, BRIDGE_LOOKAROUND_DAYS));
    // Assumption A1 needs 1. The pad is 7 so that answering Open questions 1 with a longer run
    // changes the predicate and nothing else (01-plan.md section 4.2).
    expect(BRIDGE_LOOKAROUND_DAYS).toBeGreaterThanOrEqual(1);
  });
});

describe("AC-7 and AC-11: one derivation, so the three views cannot disagree about a date", () => {
  it("a whole year and each of its months report the same status for every date", () => {
    const year: DateRange = { start: "2026-01-01", end: "2026-12-31" };
    const fromTheYear = statusesFor(year);

    expect(fromTheYear.size).toBe(365);

    for (let index = 1; index <= 12; index += 1) {
      const month = `2026-${String(index).padStart(2, "0")}`;
      const last = addDays(index === 12 ? "2027-01-01" : `2026-${String(index + 1).padStart(2, "0")}-01`, -1);
      const fromTheMonth = statusesFor({ start: `${month}-01`, end: last });

      for (const [date, status] of fromTheMonth) {
        // The same three facts AC-11 names: the working state, the name or its absence, and the
        // bridge state. A month that padded differently from the year would fail here at its edges.
        expect(status.working).toBe(fromTheYear.get(date)?.working);
        expect(status.holiday?.name ?? null).toBe(fromTheYear.get(date)?.holiday?.name ?? null);
        expect(status.bridge).toBe(fromTheYear.get(date)?.bridge);
      }
    }
  });

  it("the three rows the year view marks are the three the month views mark", () => {
    const year = statusesFor({ start: "2026-01-01", end: "2026-12-31" });
    const named = [...year.values()].filter((status) => status.holiday !== null).map((s) => s.date);

    expect(named).toEqual(["2026-06-11", "2026-06-13", "2026-06-15", "2026-10-15"]);
    expect([...year.values()].filter((status) => status.bridge).map((s) => s.date)).toEqual([
      "2026-10-16",
    ]);
  });
});

describe("AC-8: a year the calendar does not reach returns no row at all", () => {
  it("2027 holds no row, so the year view has something to say in words", () => {
    // The map itself CANNOT answer this — every date is a key whether or not anything is drawn on
    // it, which is why YearView.tsx reads the rows and not the statuses (01-plan.md section 4.3).
    const year: DateRange = { start: "2027-01-01", end: "2027-12-31" };

    expect(rowsFor(year)).toHaveLength(0);
    expect(statusesFor(year).size).toBe(365);
    expect([...statusesFor(year).values()].every((status) => status.holiday === null)).toBe(true);
  });
});

describe("AC-9: day status changes no count and no overload marking (no suppression)", () => {
  it("the count on a holiday is the count the same entries produce on a working day", () => {
    // INV-04's arithmetic, run over a range that contains a holiday. `dayStatusesFor` is not in this
    // call and cannot be: the two functions share no argument and no module state, which is the
    // mechanical form of "this row must not implement suppression".
    const roster: readonly Member[] = [FIXTURE_ADMIN, FIXTURE_MEMBER, FIXTURE_APPROVED_MEMBER];
    const onTheHoliday = { ...FIXTURE_APPROVED_ENTRY, startDate: "2026-10-15", endDate: "2026-10-15" };
    const onAWorkingDay = { ...FIXTURE_APPROVED_ENTRY, startDate: "2026-10-14", endDate: "2026-10-14" };

    const counts = absenceCountsFor([onTheHoliday, onAWorkingDay], OCTOBER, roster);

    expect(statusesFor(OCTOBER).get("2026-10-15")?.working).toBe(false);
    expect(counts.get("2026-10-15")).toBe(1);
    expect(counts.get("2026-10-15")).toBe(counts.get("2026-10-14"));
  });
});

describe("AC-15: the answer does not depend on the machine's timezone", () => {
  it("agrees under UTC, Asia/Ho_Chi_Minh and America/Los_Angeles", () => {
    // The trap ADR-015 Consequences names, and it passes every test run in Vietnam: ICT is UTC+7 and
    // CI is UTC, so a `getDay()` implementation is correct in both and wrong for a developer in the
    // Americas — 11 June reads as a Wednesday there and the bridge day moves.
    const under = (zone: string): string => {
      const previous = process.env.TZ;
      process.env.TZ = zone;
      try {
        return JSON.stringify([...statusesFor(JUNE)], (_key, value) => value);
      } finally {
        process.env.TZ = previous;
      }
    };

    const utc = under("UTC");

    expect(under("Asia/Ho_Chi_Minh")).toBe(utc);
    expect(under("America/Los_Angeles")).toBe(utc);

    // And the assertion that makes the three agreeing MEAN something: a naive local read WOULD
    // differ, so this test is capable of failing.
    const previous = process.env.TZ;
    process.env.TZ = "America/Los_Angeles";
    try {
      expect(new Date("2026-06-11T00:00:00Z").getDay()).not.toBe(
        new Date("2026-06-11T00:00:00Z").getUTCDay(),
      );
    } finally {
      process.env.TZ = previous;
    }
  });
});

// ---------------------------------------------------------------------------
// The two assumptions that ship, and are the operator's to confirm (01-plan.md section 2, Open
// questions 1 and 2). These tests are the "one predicate and the unit tests for it" that section
// names as the cost of a different answer — they are written so the cost is visible and localised.
// ---------------------------------------------------------------------------

describe("assumption A1: a bridge run is EXACTLY one working day", () => {
  it("a Wednesday holiday produces NO bridge day, because Monday and Tuesday are a run of two", () => {
    // TODO(project): the operator's, under RULE-01. `glossary.md` says "sandwiched" and does not say
    // what that means for a run longer than one day. A1 ships the reading `features.md:95` already
    // recommends — a highlight covering half a week stops meaning anything.
    const wednesday = holiday("2026-07-15"); // computed, not recalled: asserted below.
    expect(utcWeekday(wednesday.date)).toBe(3);

    const july: DateRange = { start: "2026-07-01", end: "2026-07-31" };
    const statuses = statusesFor(july, [wednesday]);

    expect(statuses.get("2026-07-13")?.bridge).toBe(false); // Monday
    expect(statuses.get("2026-07-14")?.bridge).toBe(false); // Tuesday
  });

  it("and a Tuesday holiday produces one, which is the case nothing is ambiguous about", () => {
    const tuesday = holiday("2026-07-14");
    expect(utcWeekday(tuesday.date)).toBe(2);

    const statuses = statusesFor({ start: "2026-07-01", end: "2026-07-31" }, [tuesday]);

    expect(statuses.get("2026-07-13")?.bridge).toBe(true); // Monday, between the weekend and it
  });
});

describe("assumption A2: the two bounding days are any two NON-WORKING days", () => {
  it("a working day between two holidays is a bridge day", () => {
    // The case most certain to be requested off, and the one the glossary's literal "a holiday and a
    // weekend" would exclude. TODO(project): the same registry sentence as A1, the same person.
    const monday = holiday("2026-07-13");
    const wednesday = holiday("2026-07-15");

    const statuses = statusesFor({ start: "2026-07-01", end: "2026-07-31" }, [monday, wednesday]);

    expect(statuses.get("2026-07-14")?.bridge).toBe(true);
  });

  it("a mandated working Saturday between two non-working days is a bridge day, uniformly", () => {
    // Stated in 01-plan.md section 2 as a consequence of A2 and deliberately NOT carved out: a
    // carve-out would be an invented rule, where A2 is a stated reading of an existing one.
    const friday = holiday("2026-07-17");
    const saturday = holiday("2026-07-18", "working");
    expect(utcWeekday(saturday.date)).toBe(6);

    const statuses = statusesFor({ start: "2026-07-01", end: "2026-07-31" }, [friday, saturday]);

    expect(statuses.get("2026-07-18")?.working).toBe(true);
    expect(statuses.get("2026-07-19")?.working).toBe(false); // Sunday, no row
    expect(statuses.get("2026-07-18")?.bridge).toBe(true);
  });
});
