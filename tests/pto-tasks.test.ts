// TSK-03 — the pure half of the PTO task warning and the task page's PTO flag. 01-plan.md § 4.1, § 5.
//
// What a person SEES is in tests/e2e/tsk-03-pto-task-warning.spec.ts. This file holds the rules the
// two surfaces share: "open" is not done, "chosen" is the days themselves and not their bounds, and
// "PTO" is a pto entry that is pending or approved.
//
// **Tasks and entries are constructed here rather than imported**, the declared deviation from
// § Fixtures that tests/absence.test.ts and tests/draft-entry.test.ts carry: they are the arguments of
// a pure function, and the shapes these criteria distinguish (a task in a gap, a rejected PTO) are not
// in supabase/seed.sql. Every member id is imported, because the attribution turns on a real one.
import { describe, expect, it } from "vitest";
import { openTasksOnDays, ptoCovering, ptoFlagSuffix } from "@/lib/pto-tasks";
import type { Entry, Task } from "@/lib/domain/types";
import { FIXTURE_APPROVED_MEMBER, FIXTURE_MEMBER } from "@/lib/fixtures";

const ME = FIXTURE_MEMBER.id;
const TEAMMATE = FIXTURE_APPROVED_MEMBER.id;

function task(id: string, date: string, over: Partial<Task> = {}): Task {
  return {
    id,
    memberId: ME,
    date,
    title: `Task ${id}`,
    note: null,
    timeOfDay: null,
    done: false,
    createdAt: "2030-03-01T00:00:00.000Z",
    ...over,
  };
}

function entry(id: string, startDate: string, endDate: string, over: Partial<Entry> = {}): Entry {
  return {
    id,
    memberId: ME,
    type: "pto",
    portion: "full",
    startDate,
    endDate,
    tentative: false,
    status: "pending",
    rejectionReason: null,
    note: null,
    approvedBy: null,
    approvedAt: null,
    createdAt: "2030-03-01T00:00:00.000Z",
    updatedAt: "2030-03-01T00:00:00.000Z",
    ...over,
  };
}

describe("openTasksOnDays — AC-1, AC-2", () => {
  it("keeps open tasks on chosen days and drops done ones", () => {
    const tasks = [task("a", "2030-03-13"), task("b", "2030-03-13", { done: true })];
    expect(openTasksOnDays(tasks, ["2030-03-13"]).map((t) => t.id)).toEqual(["a"]);
  });

  it("drops a task on an unchosen day, including a day inside the gap of a gapped selection", () => {
    const tasks = [task("first", "2030-03-11"), task("gap", "2030-03-12"), task("last", "2030-03-13"), task("out", "2030-03-20")];
    expect(openTasksOnDays(tasks, ["2030-03-11", "2030-03-13"]).map((t) => t.id)).toEqual(["first", "last"]);
  });

  it("orders by date, then createdAt, then id", () => {
    const tasks = [
      task("z", "2030-03-14", { createdAt: "2030-03-01T00:00:00.000Z" }),
      task("c", "2030-03-13", { createdAt: "2030-03-02T00:00:00.000Z" }),
      task("b", "2030-03-13", { createdAt: "2030-03-01T00:00:00.000Z" }),
      task("a", "2030-03-13", { createdAt: "2030-03-01T00:00:00.000Z" }),
    ];
    expect(openTasksOnDays(tasks, ["2030-03-13", "2030-03-14"]).map((t) => t.id)).toEqual(["a", "b", "c", "z"]);
  });

  it("does not mutate its input", () => {
    const tasks = [task("b", "2030-03-14"), task("a", "2030-03-13")];
    const before = tasks.map((t) => t.id);
    openTasksOnDays(tasks, ["2030-03-13", "2030-03-14"]);
    expect(tasks.map((t) => t.id)).toEqual(before);
  });

  it("is empty when no open task falls on a chosen day", () => {
    expect(openTasksOnDays([task("a", "2030-03-13", { done: true })], ["2030-03-13"])).toEqual([]);
    expect(openTasksOnDays([], [])).toEqual([]);
  });
});

describe("ptoCovering — AC-10, AC-11", () => {
  it("matches a pending and an approved PTO covering the day", () => {
    expect(ptoCovering([entry("p", "2030-03-13", "2030-03-13")], ME, "2030-03-13")?.id).toBe("p");
    expect(
      ptoCovering([entry("a", "2030-03-13", "2030-03-13", { status: "approved" })], ME, "2030-03-13")?.id,
    ).toBe("a");
  });

  it("does not match a rejected PTO, a WFH, another member's PTO, or a range not covering the day", () => {
    const entries = [
      entry("rejected", "2030-03-13", "2030-03-13", { status: "rejected" }),
      entry("wfh", "2030-03-13", "2030-03-13", { type: "wfh" }),
      entry("theirs", "2030-03-13", "2030-03-13", { memberId: TEAMMATE }),
      entry("before", "2030-03-10", "2030-03-12"),
      entry("after", "2030-03-14", "2030-03-16"),
    ];
    expect(ptoCovering(entries, ME, "2030-03-13")).toBeNull();
    expect(ptoCovering([], ME, "2030-03-13")).toBeNull();
  });

  it("covers the first and the last day of a range, inclusive", () => {
    const entries = [entry("r", "2030-03-11", "2030-03-13")];
    expect(ptoCovering(entries, ME, "2030-03-11")?.id).toBe("r");
    expect(ptoCovering(entries, ME, "2030-03-12")?.id).toBe("r");
    expect(ptoCovering(entries, ME, "2030-03-13")?.id).toBe("r");
  });

  it("picks the earliest start when two match, then the smallest id", () => {
    const late = entry("a-late", "2030-03-13", "2030-03-13", { portion: "pm" });
    const early = entry("z-early", "2030-03-12", "2030-03-13", { portion: "am" });
    expect(ptoCovering([late, early], ME, "2030-03-13")?.id).toBe("z-early");

    const two = [entry("y", "2030-03-13", "2030-03-13"), entry("x", "2030-03-13", "2030-03-13")];
    expect(ptoCovering(two, ME, "2030-03-13")?.id).toBe("x");
  });
});

describe("ptoFlagSuffix — AC-10", () => {
  it("names the portion", () => {
    expect(ptoFlagSuffix("full", false, 0)).toBe("");
    expect(ptoFlagSuffix("am", false, 0)).toBe(" · morning");
    expect(ptoFlagSuffix("pm", false, 0)).toBe(" · afternoon");
  });

  it("adds tentative after the portion", () => {
    expect(ptoFlagSuffix("am", true, 0)).toBe(" · morning · tentative");
    expect(ptoFlagSuffix("full", true, 0)).toBe(" · tentative");
  });

  it("adds the open count last, singular for one and absent for none", () => {
    expect(ptoFlagSuffix("full", false, 1)).toBe(" · 1 open task");
    expect(ptoFlagSuffix("pm", true, 3)).toBe(" · afternoon · tentative · 3 open tasks");
  });
});
