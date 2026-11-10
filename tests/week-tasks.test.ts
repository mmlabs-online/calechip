// TSK-04 — the pure half of the week view's task badge. 01-plan.md § 4.1, § 5.
//
// What a person SEES is in tests/e2e/tsk-04-week-task-badge.spec.ts. This file holds the tally rules:
// one date per key, days without tasks absent, tasks outside the range ignored, and the two strings.
//
// **Tasks are constructed here rather than imported**, the declared deviation from § Fixtures that
// tests/pto-tasks.test.ts carries: they are the arguments of a pure function. The member id is
// imported, as there.
import { describe, expect, it } from "vitest";
import {
  stripCellLabel,
  stripMark,
  tallyLabel,
  tallyText,
  taskTalliesFor,
  weekDaysOf,
  weekTotals,
} from "@/lib/week-tasks";
import type { DateRange, Task } from "@/lib/domain/types";
import { FIXTURE_MEMBER } from "@/lib/fixtures";

const ME = FIXTURE_MEMBER.id;

function task(id: string, date: string, done = false): Task {
  return {
    id,
    memberId: ME,
    date,
    title: `Task ${id}`,
    note: null,
    timeOfDay: null,
    done,
    createdAt: "2030-03-01T00:00:00.000Z",
  };
}

const WEEK: DateRange = { start: "2030-03-11", end: "2030-03-17" };

describe("taskTalliesFor", () => {
  it("AC-1: counts done out of total for a day", () => {
    const tasks = Array.from({ length: 10 }, (_, i) => task(`t${i}`, "2030-03-12", i < 5));
    expect(taskTalliesFor(tasks, WEEK).get("2030-03-12")).toEqual({ done: 5, total: 10 });
  });

  it("AC-2, AC-12: a day without tasks is absent, and no tasks is an empty map", () => {
    const tallies = taskTalliesFor([task("a", "2030-03-12")], WEEK);
    expect(tallies.has("2030-03-13")).toBe(false);
    expect(tallies.size).toBe(1);
    expect(taskTalliesFor([], WEEK).size).toBe(0);
  });

  it("AC-3: all done and none done are both tallied", () => {
    const tallies = taskTalliesFor(
      [
        task("a", "2030-03-12", true),
        task("b", "2030-03-12", true),
        task("c", "2030-03-12", true),
        task("d", "2030-03-13"),
        task("e", "2030-03-13"),
      ],
      WEEK,
    );
    expect(tallies.get("2030-03-12")).toEqual({ done: 3, total: 3 });
    expect(tallies.get("2030-03-13")).toEqual({ done: 0, total: 2 });
  });

  it("AC-4: each day counts only its own date, and dates outside the range are ignored", () => {
    const tallies = taskTalliesFor(
      [
        task("mon", "2030-03-11"),
        task("wed", "2030-03-13", true),
        task("wed2", "2030-03-13"),
        task("next-mon", "2030-03-18"),
        task("prev-sun", "2030-03-10"),
      ],
      WEEK,
    );
    expect(tallies.get("2030-03-11")).toEqual({ done: 0, total: 1 });
    expect(tallies.get("2030-03-13")).toEqual({ done: 1, total: 2 });
    expect([...tallies.keys()].sort()).toEqual(["2030-03-11", "2030-03-13"]);
  });

  it("includes both ends of the range", () => {
    const tallies = taskTalliesFor([task("a", WEEK.start), task("b", WEEK.end, true)], WEEK);
    expect(tallies.get(WEEK.start)).toEqual({ done: 0, total: 1 });
    expect(tallies.get(WEEK.end)).toEqual({ done: 1, total: 1 });
  });

  it("does not mutate its input", () => {
    const tasks = [task("b", "2030-03-13"), task("a", "2030-03-12", true)];
    const before = structuredClone(tasks);
    taskTalliesFor(tasks, WEEK);
    expect(tasks).toEqual(before);
  });
});

describe("tallyText and tallyLabel", () => {
  it("AC-1: the visible text and the accessible name", () => {
    expect(tallyText({ done: 5, total: 10 })).toBe("5/10");
    expect(tallyLabel({ done: 5, total: 10 })).toBe("5 of 10 tasks done");
  });

  it("uses the singular when the total is one", () => {
    expect(tallyText({ done: 0, total: 1 })).toBe("0/1");
    expect(tallyLabel({ done: 0, total: 1 })).toBe("0 of 1 task done");
    expect(tallyLabel({ done: 1, total: 1 })).toBe("1 of 1 task done");
  });
});

// ---------------------------------------------------------------------------
// TSK-06 — the task page's strip and summary. Its 01-plan.md § 4.6.
// ---------------------------------------------------------------------------

describe("TSK-06 AC-11 — weekDaysOf", () => {
  it("is Monday to Sunday holding the day, wherever in the week the day falls", () => {
    const week = ["2026-04-27", "2026-04-28", "2026-04-29", "2026-04-30", "2026-05-01", "2026-05-02", "2026-05-03"];
    for (const day of week) expect(weekDaysOf(day)).toEqual(week);
  });

  it("crosses a year", () => {
    expect(weekDaysOf("2026-01-01")).toEqual([
      "2025-12-29",
      "2025-12-30",
      "2025-12-31",
      "2026-01-01",
      "2026-01-02",
      "2026-01-03",
      "2026-01-04",
    ]);
  });
});

describe("TSK-06 AC-12 — stripMark and stripCellLabel", () => {
  it("✓ when all are done, done/total when some are not, – when there are none", () => {
    expect(stripMark({ done: 2, total: 2 })).toBe("✓");
    expect(stripMark({ done: 1, total: 3 })).toBe("1/3");
    expect(stripMark({ done: 0, total: 1 })).toBe("0/1");
    expect(stripMark(undefined)).toBe("\u2013");
  });

  it("says the same in words", () => {
    expect(stripCellLabel("2026-04-27", { done: 2, total: 2 })).toBe("Monday 27 April, 2 of 2 tasks done");
    expect(stripCellLabel("2026-04-29", { done: 1, total: 3 })).toBe("Wednesday 29 April, 1 of 3 tasks done");
    expect(stripCellLabel("2026-05-03", undefined)).toBe("Sunday 3 May, no tasks");
  });
});

describe("TSK-06 AC-21 — weekTotals", () => {
  it("sums the days, and is 0/0 for an empty week", () => {
    const tallies = taskTalliesFor(
      [task("a", "2030-03-11", true), task("b", "2030-03-11", true), task("c", "2030-03-13"), task("d", "2030-03-17")],
      WEEK,
    );
    expect(weekTotals(tallies)).toEqual({ done: 2, total: 4 });
    expect(weekTotals(new Map())).toEqual({ done: 0, total: 0 });
  });
});
