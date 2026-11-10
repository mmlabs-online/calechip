// SOLO, 2026-09-11 — naming the dates an entry collides on, at the unit level: `overlap.ts` is a
// pure function over rows. What the form shows is `tests/e2e/solo-overlap-dates.spec.ts`.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the names below are sentences and
// deliberately not `AC-n`. What authorises the work is `.claude/agents/solo.md`.
//
// **THE PROPERTY THAT MATTERS MOST IS THE HALF-DAY ONE.** INV-01 lets a morning and an afternoon sit
// on one date, so a refusal that named such a date would send a person to "fix" an entry that is not
// in the way. Every portion pairing is asserted below.
import { describe, expect, it } from "vitest";
import { clashingDates, formatDateRuns, overlapMessage } from "@/lib/data/overlap";
import type { EntryPortion } from "@/lib/domain/types";

const ME = "member-me";
const SOMEONE = "member-else";

const row = (id: string, memberId: string, startDate: string, endDate: string, portion: EntryPortion = "full") => ({
  id,
  memberId,
  startDate,
  endDate,
  portion,
});

describe("clashingDates", () => {
  it("names exactly the intersection of the two ranges", () => {
    const existing = [row("a", ME, "2026-10-10", "2026-10-14")];
    expect(clashingDates(existing, ME, { startDate: "2026-10-13", endDate: "2026-10-20", portion: "full" })).toEqual([
      "2026-10-13",
      "2026-10-14",
    ]);
  });

  it("collects several existing entries, sorted and without repeats", () => {
    const existing = [row("a", ME, "2026-10-20", "2026-10-20"), row("b", ME, "2026-10-12", "2026-10-13")];
    expect(clashingDates(existing, ME, { startDate: "2026-10-01", endDate: "2026-10-31", portion: "full" })).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-20",
    ]);
  });

  it("morning beside afternoon is no collision; any pairing involving full, or equal halves, is", () => {
    const on = (existing: EntryPortion, candidate: EntryPortion) =>
      clashingDates([row("a", ME, "2026-10-12", "2026-10-12", existing)], ME, {
        startDate: "2026-10-12",
        endDate: "2026-10-12",
        portion: candidate,
      });

    expect(on("am", "pm")).toEqual([]);
    expect(on("pm", "am")).toEqual([]);
    expect(on("am", "am")).toEqual(["2026-10-12"]);
    expect(on("pm", "pm")).toEqual(["2026-10-12"]);
    expect(on("full", "am")).toEqual(["2026-10-12"]);
    expect(on("pm", "full")).toEqual(["2026-10-12"]);
  });

  it("ignores somebody else's entries — INV-01 is per member", () => {
    const existing = [row("a", SOMEONE, "2026-10-12", "2026-10-12")];
    expect(clashingDates(existing, ME, { startDate: "2026-10-12", endDate: "2026-10-12", portion: "full" })).toEqual([]);
  });

  it("an entry being edited never collides with itself", () => {
    const existing = [row("a", ME, "2026-10-12", "2026-10-14")];
    const candidate = { startDate: "2026-10-13", endDate: "2026-10-15", portion: "full" as const };
    expect(clashingDates(existing, ME, candidate, "a")).toEqual([]);
    expect(clashingDates(existing, ME, candidate, null)).toEqual(["2026-10-13", "2026-10-14"]);
  });

  it("crosses a month end without losing or shifting a day", () => {
    // The UTC walk is the point: a local-time step west of UTC would name 30 October for the 31st.
    const existing = [row("a", ME, "2026-10-30", "2026-11-02")];
    expect(clashingDates(existing, ME, { startDate: "2026-10-31", endDate: "2026-11-01", portion: "full" })).toEqual([
      "2026-10-31",
      "2026-11-01",
    ]);
  });
});

describe("formatDateRuns and overlapMessage", () => {
  it("collapses consecutive dates into runs and keeps lone dates alone", () => {
    expect(formatDateRuns(["2026-10-12", "2026-10-13", "2026-10-14", "2026-10-20"])).toBe(
      "2026-10-12 → 2026-10-14, 2026-10-20",
    );
    expect(formatDateRuns(["2026-10-20"])).toBe("2026-10-20");
    expect(formatDateRuns(["2026-10-31", "2026-11-01"])).toBe("2026-10-31 → 2026-11-01");
  });

  it("names the dates when it has them, and invents none when it does not", () => {
    expect(overlapMessage(["2026-10-12"])).toBe(
      "These dates overlap an existing entry: 2026-10-12. Edit that entry, or choose a different range.",
    );
    expect(overlapMessage([])).toBe(
      "These dates overlap an existing entry. Edit that entry, or choose a different range.",
    );
  });
});
