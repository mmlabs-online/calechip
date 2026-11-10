// TSK-06 — a task may carry an optional time of day, and a day's list is ordered by it. 01-plan.md
// § 2 AC-1 to AC-8, § 4.3 to § 4.5. ADR-062.
//
// Every criterion here is a property of the data, through the mock seam, which reproduces the real
// seam's `order by` clause for clause (§ 5). The real seam is reached only for refusals it makes
// BEFORE a request, which need no network. What a person SEES is in
// tests/e2e/tsk-06-task-week.spec.ts.
//
// **"TODAY" IS PINNED** as tests/tasks.test.ts pins it: 03:00Z is 10:00 in Asia/Ho_Chi_Minh.
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateTaskInput } from "@/lib/data";
import { seam as mock, __resetTasks, __setCurrentMember } from "@/lib/data/mock";
import { seam as real } from "@/lib/data/supabase";
import type { Task } from "@/lib/domain/types";
import { FIXTURE_ADMIN, FIXTURE_APPROVED_MEMBER, FIXTURE_MEMBER } from "@/lib/fixtures";

const OWNER = FIXTURE_MEMBER.id;
const TEAMMATE = FIXTURE_APPROVED_MEMBER.id;
const ADMIN_SAME_TEAM = FIXTURE_ADMIN.id;

const TODAY = "2030-03-12";
const TOMORROW = "2030-03-13";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date(`${TODAY}T03:00:00Z`));
});

afterEach(() => {
  __resetTasks();
  vi.useRealTimers();
  as(null);
});

async function create(overrides: Partial<CreateTaskInput> = {}): Promise<Task> {
  as(OWNER);
  const result = await mock.createTask({ date: TODAY, title: "A task", note: null, ...overrides });
  if (!result.ok) throw new Error(`createTask refused: ${result.error.code}`);
  return result.value;
}

async function readBack(taskId: string): Promise<Task | undefined> {
  as(OWNER);
  return (await mock.listTasks("2000-01-01", "2099-12-31")).find((t) => t.id === taskId);
}

describe("TSK-06 AC-1 — add with or without a time", () => {
  it("stores the time given, and no time when absent, null or empty", async () => {
    const timed = await create({ timeOfDay: "14:00" });
    expect(timed.timeOfDay).toBe("14:00");
    expect((await readBack(timed.id))?.timeOfDay).toBe("14:00");

    expect((await create()).timeOfDay).toBeNull();
    expect((await create({ timeOfDay: null })).timeOfDay).toBeNull();
    expect((await create({ timeOfDay: "" })).timeOfDay).toBeNull();
  });
});

describe("TSK-06 AC-2 — edit sets, changes and clears the time", () => {
  it("sets a time on an untimed task, changes it, then clears it, keeping date and done", async () => {
    const task = await create();
    as(OWNER);
    await mock.setTaskDone(task.id, true);

    const set = await mock.updateTask(task.id, { title: "A task", note: null, timeOfDay: "09:30" });
    expect(set.ok && set.value.timeOfDay).toBe("09:30");
    const changed = await mock.updateTask(task.id, { title: "A task", note: null, timeOfDay: "16:45" });
    expect(changed.ok && changed.value.timeOfDay).toBe("16:45");
    const cleared = await mock.updateTask(task.id, { title: "A task", note: null, timeOfDay: "" });
    expect(cleared.ok && cleared.value.timeOfDay).toBeNull();

    const back = await readBack(task.id);
    expect(back).toMatchObject({ date: TODAY, done: true, timeOfDay: null });
  });

  it("null clears the time too", async () => {
    const task = await create({ timeOfDay: "08:00" });
    as(OWNER);
    const cleared = await mock.updateTask(task.id, { title: "A task", note: null, timeOfDay: null });
    expect(cleared.ok && cleared.value.timeOfDay).toBeNull();
  });
});

describe("TSK-06 AC-3 — a move keeps the time", () => {
  it("carries the same time to the new date", async () => {
    const task = await create({ timeOfDay: "11:15" });
    as(OWNER);
    const moved = await mock.moveTask(task.id, TOMORROW);
    expect(moved.ok && moved.value).toMatchObject({ date: TOMORROW, timeOfDay: "11:15" });
  });
});

describe("TSK-06 AC-4 — only a whole-minute time of day is accepted", () => {
  const BAD = ["24:00", "7:05", "14:00:30", "noon", "12:60", " 09:00", "09:00 "];

  it.each(BAD)("refuses %j on create and on edit, in both seams, and writes nothing", async (bad) => {
    as(OWNER);
    const created = await mock.createTask({ date: TODAY, title: "x", note: null, timeOfDay: bad });
    expect(created).toEqual({
      ok: false,
      error: { code: "invalid_task_time", message: "Pick a time as HH:MM, or leave it empty." },
    });
    expect(await mock.listTasks(TODAY, TODAY)).toEqual([]);

    const task = await create({ timeOfDay: "10:00" });
    as(OWNER);
    const edited = await mock.updateTask(task.id, { title: "Changed", note: null, timeOfDay: bad });
    expect(edited.ok ? null : edited.error.code).toBe("invalid_task_time");
    expect(await readBack(task.id)).toMatchObject({ title: "A task", timeOfDay: "10:00" });

    // The real seam refuses before any request, so no network is touched.
    const realCreate = await real.createTask({ date: TODAY, title: "x", note: null, timeOfDay: bad });
    expect(realCreate.ok ? null : realCreate.error.code).toBe("invalid_task_time");
    const realEdit = await real.updateTask(task.id, { title: "x", note: null, timeOfDay: bad });
    expect(realEdit.ok ? null : realEdit.error.code).toBe("invalid_task_time");
  });

  it("accepts the bounds 00:00 and 23:59", async () => {
    expect((await create({ timeOfDay: "00:00" })).timeOfDay).toBe("00:00");
    expect((await create({ timeOfDay: "23:59" })).timeOfDay).toBe("23:59");
  });

  it("refuses in the order title, note, time, then date", async () => {
    as(OWNER);
    const title = await mock.createTask({ date: "2000-01-01", title: "", note: null, timeOfDay: "bad" });
    expect(title.ok ? null : title.error.code).toBe("invalid_task_title");
    const time = await mock.createTask({ date: "2000-01-01", title: "ok", note: null, timeOfDay: "bad" });
    expect(time.ok ? null : time.error.code).toBe("invalid_task_time");
  });
});

describe("TSK-06 AC-5 — the time drives nothing else", () => {
  it("a task today timed earlier than now is not overdue", async () => {
    // 10:00 in Asia/Ho_Chi_Minh; the task is at 08:00 the same day.
    await create({ timeOfDay: "08:00" });
    as(OWNER);
    expect(await mock.listOverdueTasks(TODAY)).toEqual([]);
  });
});

describe("TSK-06 AC-7 — the time is the owner's like every other field", () => {
  it.each([
    ["a teammate", TEAMMATE],
    ["an admin of the same team", ADMIN_SAME_TEAM],
  ])("%s neither reads nor changes it", async (_who, other) => {
    const task = await create({ timeOfDay: "14:00" });
    as(other);
    expect(await mock.listTasks(TODAY, TODAY)).toEqual([]);
    const edited = await mock.updateTask(task.id, { title: "A task", note: null, timeOfDay: "15:00" });
    expect(edited.ok ? null : edited.error.code).toBe("task_not_permitted");
    expect((await readBack(task.id))?.timeOfDay).toBe("14:00");
  });
});

describe("TSK-06 AC-8 — the order of one day's list", () => {
  it("not-done before done; timed by time, then untimed by creation", async () => {
    const u1 = await create({ title: "U1" });
    const a = await create({ title: "A", timeOfDay: "16:30" });
    const d1 = await create({ title: "D1" });
    const b = await create({ title: "B", timeOfDay: "09:30" });
    const c = await create({ title: "C", timeOfDay: "14:00" });
    const u2 = await create({ title: "U2" });
    as(OWNER);
    await mock.setTaskDone(d1.id, true);
    await mock.setTaskDone(b.id, true);

    const titles = (await mock.listTasks(TODAY, TODAY)).map((t) => t.title);
    expect(titles).toEqual(["C", "A", "U1", "U2", "B", "D1"]);
    expect([c, a, u1, u2].every((t) => t.done === false)).toBe(true);
  });

  it("orders the range by date first", async () => {
    await create({ title: "Tomorrow early", date: TOMORROW, timeOfDay: "06:00" });
    await create({ title: "Today late", timeOfDay: "22:00" });
    as(OWNER);
    expect((await mock.listTasks(TODAY, TOMORROW)).map((t) => t.title)).toEqual(["Today late", "Tomorrow early"]);
  });

  it("two tasks at the same time keep creation order", async () => {
    await create({ title: "First", timeOfDay: "10:00" });
    await create({ title: "Second", timeOfDay: "10:00" });
    as(OWNER);
    expect((await mock.listTasks(TODAY, TODAY)).map((t) => t.title)).toEqual(["First", "Second"]);
  });
});

describe("TSK-06 AC-10 — the overdue list keeps its order", () => {
  it("oldest date first, then creation, whatever the time", async () => {
    await create({ title: "Late", timeOfDay: "23:00" });
    await create({ title: "Early", timeOfDay: "01:00" });
    await create({ title: "Untimed" });
    vi.setSystemTime(new Date(`${TOMORROW}T03:00:00Z`));
    as(OWNER);
    expect((await mock.listOverdueTasks(TOMORROW)).map((t) => t.title)).toEqual(["Late", "Early", "Untimed"]);
  });
});
