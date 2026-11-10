// SOLO, 2026-09-10 — what a set of chosen days means, at the level the standard assigns it.
//
// `.ai/standards/testing-standards.md` puts "pure logic" at the unit level and "a full acceptance
// criterion through the interface" at the end-to-end one. `dateRuns` is the translation between the
// picker's set of days and the datastore's ranges, and it is pure, so it is asserted here; what a
// person sees when they click a day is in the entry specs.
//
// **THE RUN GROUPING IS THE ONE RULE WORTH PROTECTING.** CAL-01 AC-2 says a contiguous range is ONE
// entry and not one per day; a `dateRuns` that returned one run per day would still make every
// create path "work", and the criterion would fail only through the interface, one layer up.
import { describe, expect, it } from "vitest";
import { dateRuns, datesInRange, monthGridDays, toggleDate } from "@/lib/date-selection";

describe("datesInRange", () => {
  it("is inclusive at both ends, so one day is one date", () => {
    expect(datesInRange("2026-04-08", "2026-04-08")).toEqual(["2026-04-08"]);
  });

  it("walks a range across a month boundary", () => {
    expect(datesInRange("2026-04-29", "2026-05-02")).toEqual([
      "2026-04-29",
      "2026-04-30",
      "2026-05-01",
      "2026-05-02",
    ]);
  });

  it("answers nothing for an empty or inverted pair rather than looping", () => {
    expect(datesInRange("", "")).toEqual([]);
    expect(datesInRange("2026-04-09", "2026-04-05")).toEqual([]);
  });
});

describe("toggleDate", () => {
  it("adds a day that was absent and keeps the list sorted", () => {
    expect(toggleDate(["2026-04-10"], "2026-04-08")).toEqual(["2026-04-08", "2026-04-10"]);
  });

  it("removes a day that was present", () => {
    expect(toggleDate(["2026-04-08", "2026-04-10"], "2026-04-08")).toEqual(["2026-04-10"]);
  });

  it("never stores the same day twice", () => {
    expect(toggleDate(["2026-04-08", "2026-04-08"], "2026-04-09")).toEqual([
      "2026-04-08",
      "2026-04-09",
    ]);
  });
});

describe("dateRuns", () => {
  it("gathers a contiguous selection into ONE run — CAL-01 AC-2", () => {
    const week = datesInRange("2026-11-02", "2026-11-07");
    expect(dateRuns(week)).toEqual([{ startDate: "2026-11-02", endDate: "2026-11-07" }]);
  });

  it("splits at every gap — the mock's own selection is two entries", () => {
    // The 1st on its own, then the 8th to the 12th: exactly what the operator's design shows.
    const chosen = ["2026-04-01", ...datesInRange("2026-04-08", "2026-04-12")];
    expect(dateRuns(chosen)).toEqual([
      { startDate: "2026-04-01", endDate: "2026-04-01" },
      { startDate: "2026-04-08", endDate: "2026-04-12" },
    ]);
  });

  it("treats days either side of a month boundary as ONE run", () => {
    // The trap a naive `day + 1` on the day-of-month would fall into: 30 April and 1 May are next to
    // each other, and 30 April and 2 May are not.
    expect(dateRuns(["2026-04-30", "2026-05-01"])).toEqual([
      { startDate: "2026-04-30", endDate: "2026-05-01" },
    ]);
    expect(dateRuns(["2026-04-30", "2026-05-02"])).toHaveLength(2);
  });

  it("normalises order and duplicates rather than trusting the caller", () => {
    expect(dateRuns(["2026-04-09", "2026-04-08", "2026-04-09"])).toEqual([
      { startDate: "2026-04-08", endDate: "2026-04-09" },
    ]);
  });

  it("answers no runs for an empty selection, so an empty form writes nothing", () => {
    expect(dateRuns([])).toEqual([]);
  });
});

describe("monthGridDays", () => {
  it("draws whole weeks, Monday first, covering the whole month", () => {
    const grid = monthGridDays("2026-04");

    expect(grid.length % 7).toBe(0);
    // April 2026 opens on a Wednesday, so the grid opens on Monday 30 March and closes on Sunday
    // 3 May. Both neighbours are present, which is what makes a run across a boundary reachable
    // without touching the stepper.
    expect(grid[0]).toBe("2026-03-30");
    expect(grid[grid.length - 1]).toBe("2026-05-03");
    expect(grid).toContain("2026-04-01");
    expect(grid).toContain("2026-04-30");
  });

  it("handles a February that ends on a Sunday without a trailing week of nothing", () => {
    // 2027-02-28 is a Sunday, so the grid closes on the last of the month and adds no eighth column
    // of March.
    const grid = monthGridDays("2027-02");
    expect(grid[grid.length - 1]).toBe("2027-02-28");
  });

  it("counts a leap February's days", () => {
    expect(monthGridDays("2028-02")).toContain("2028-02-29");
  });
});
