// TSK-02 — the overdue prompt's module, against the mock seam. 01-plan.md § 5.
//
// The screen is asserted in `tests/e2e/tsk-02-overdue-prompt.spec.ts`. The failure paths of AC-6 and
// AC-8 are asserted here, because the mock has no fault switch (TSK-05 § 5's reasoning): AC-6 is
// `src/lib/task-tick.ts` unchanged, already covered by `tests/task-tick.test.ts`; AC-8 is below.
//
// **"TODAY" IS PINNED** with `vi.setSystemTime`, as `tests/tasks.test.ts` pins it: the seam refuses to
// create a task in the past, so a task is made overdue by creating it and then moving the clock.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { seam as mock, __resetTasks, __setCurrentMember } from "@/lib/data/mock";
import type { Result, Task } from "@/lib/domain/types";
import { FIXTURE_ADMIN, FIXTURE_APPROVED_MEMBER, FIXTURE_MEMBER } from "@/lib/fixtures";
import {
  MOVE_FAILED,
  claimOverduePrompt,
  forgetOverduePrompt,
  moveAllToToday,
  type MoveWrite,
} from "@/lib/overdue-prompt";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

const TODAY = "2030-03-12";
const YESTERDAY = "2030-03-11";
const TWO_DAYS_AGO = "2030-03-10";

/** 03:00Z is 10:00 in Asia/Ho_Chi_Minh. */
const setToday = (day: string): void => {
  vi.setSystemTime(new Date(`${day}T03:00:00Z`));
};

/** A task dated `day`, created while that day was today, with the clock put back to TODAY after. */
async function createdOn(memberId: string, day: string, title: string, note: string | null = null): Promise<Task> {
  setToday(day);
  as(memberId);
  const result = await mock.createTask({ date: day, title, note });
  setToday(TODAY);
  if (!result.ok) throw new Error(`createTask refused: ${result.error.code}`);
  return result.value;
}

const fake = (id: string): Task => ({
  id,
  memberId: FIXTURE_MEMBER.id,
  date: YESTERDAY,
  title: id,
  note: null,
  timeOfDay: null,
  done: false,
  createdAt: "2030-03-11T03:00:00Z",
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  setToday(TODAY);
  forgetOverduePrompt();
});

afterEach(() => {
  __resetTasks();
  vi.useRealTimers();
  as(null);
  forgetOverduePrompt();
});

describe("TSK-02 AC-3 — once per opening", () => {
  it("claims once per member, and again after forgetOverduePrompt", () => {
    expect(claimOverduePrompt("a")).toBe(true);
    expect(claimOverduePrompt("a")).toBe(false);
    expect(claimOverduePrompt("b")).toBe(true);
    expect(claimOverduePrompt("a")).toBe(false);
    forgetOverduePrompt();
    expect(claimOverduePrompt("a")).toBe(true);
  });
});

describe("TSK-02 AC-7 — move all to today", () => {
  it("re-dates every task to today, keeping title, note and done, and leaves nothing overdue", async () => {
    const a = await createdOn(FIXTURE_MEMBER.id, TWO_DAYS_AGO, "A", "first note");
    const b = await createdOn(FIXTURE_MEMBER.id, YESTERDAY, "B");
    const c = await createdOn(FIXTURE_MEMBER.id, YESTERDAY, "C", "third note");
    as(FIXTURE_MEMBER.id);
    const overdue = await mock.listOverdueTasks(TODAY);
    expect(overdue.map((t) => t.id)).toEqual([a.id, b.id, c.id]);

    const result = await moveAllToToday(overdue, TODAY, (id, d) => mock.moveTask(id, d));
    expect(result.failed).toEqual([]);
    expect(result.moved.map((t) => t.id)).toEqual([a.id, b.id, c.id]);

    const todays = await mock.listTasks(TODAY, TODAY);
    for (const before of [a, b, c]) {
      const after = todays.find((t) => t.id === before.id);
      expect(after).toBeDefined();
      expect(after!.date).toBe(TODAY);
      expect(after!.title).toBe(before.title);
      expect(after!.note).toBe(before.note);
      expect(after!.done).toBe(false);
    }
    expect(await mock.listOverdueTasks(TODAY)).toEqual([]);
  });
});

describe("TSK-02 AC-8 — move all with a failure", () => {
  it("never stops at a failure, reports each in order, and moves one at a time", async () => {
    const tasks = [fake("t1"), fake("t2"), fake("t3")];
    const refused = { code: "task_not_permitted", message: "You cannot change this task." } as const;
    const calls: string[] = [];
    let inFlight = 0;
    let overlapped = false;

    const move: MoveWrite = async (id, date) => {
      calls.push(id);
      inFlight += 1;
      if (inFlight > 1) overlapped = true;
      await Promise.resolve();
      inFlight -= 1;
      if (id === "t1") return { ok: true, value: { ...tasks[0]!, date } } satisfies Result<Task>;
      if (id === "t2") return { ok: false, error: refused } satisfies Result<Task>;
      throw new Error("network down");
    };

    const result = await moveAllToToday(tasks, TODAY, move);
    expect(calls).toEqual(["t1", "t2", "t3"]);
    expect(overlapped).toBe(false);
    expect(result.moved.map((t) => t.id)).toEqual(["t1"]);
    expect(result.moved[0]!.date).toBe(TODAY);
    expect(result.failed).toEqual([
      { taskId: "t2", failure: refused },
      { taskId: "t3", failure: { code: "unknown", message: MOVE_FAILED } },
    ]);
  });

  it("treats a rejected promise as unknown, too", async () => {
    const result = await moveAllToToday([fake("t1")], TODAY, () => Promise.reject(new Error("boom")));
    expect(result.failed).toEqual([{ taskId: "t1", failure: { code: "unknown", message: MOVE_FAILED } }]);
  });
});

describe("TSK-02 AC-11 — the viewer's own tasks only", () => {
  it("an admin reads none of a teammate's overdue tasks, and cannot move one", async () => {
    const theirs = await createdOn(FIXTURE_APPROVED_MEMBER.id, YESTERDAY, "Teammate's");

    as(FIXTURE_ADMIN.id);
    expect(await mock.listOverdueTasks(TODAY)).toEqual([]);

    const result = await moveAllToToday([theirs], TODAY, (id, d) => mock.moveTask(id, d));
    expect(result.moved).toEqual([]);
    expect(result.failed.map((f) => f.failure.code)).toEqual(["task_not_permitted"]);

    as(FIXTURE_APPROVED_MEMBER.id);
    const still = await mock.listOverdueTasks(TODAY);
    expect(still.map((t) => [t.id, t.date])).toEqual([[theirs.id, YESTERDAY]]);
  });
});
