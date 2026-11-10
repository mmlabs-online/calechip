// TSK-01 — a member's own tasks. Every acceptance criterion that is a property of the data, through
// the mock seam, and the migration's shape by reading it. 01-plan.md § 5. ADR-057.
//
// **THE MOCK REPRODUCES `supabase/migrations/20261015120000_tsk01_task.sql`; IT CANNOT PROVE IT.** A
// permission test against a real PostgreSQL is still owed project-wide
// (.ai/standards/rbac-and-security.md § Known weaknesses 1). The policies, the grants and the absence
// of any other read path are asserted by reading the file, the way `tests/notifications.test.ts`
// reads EVT-04's.
//
// **"TODAY" IS PINNED.** `eventToday()` reads the clock, so every test fixes it with
// `vi.setSystemTime` (Date only) and moves it forward to make a task overdue — the seam refuses to
// create one in the past, which is the point of AC-7.
//
// **PEOPLE.** Fixtures as they are; anyone else is created through the seam as a person would be (sign
// up, then an admin decides), as `tests/events.test.ts` does. No fixture file is edited.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { CreateTaskInput } from "@/lib/data";
import { seam as mock, __resetTasks, __setCurrentMember } from "@/lib/data/mock";
import { seam as real } from "@/lib/data/supabase";
import { absenceCountsFor } from "@/lib/data/absence";
import type { Task } from "@/lib/domain/types";
import { TASK_NOTE_MAX, TASK_TITLE_MAX } from "@/lib/domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

const MIGRATION = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/20261015120000_tsk01_task.sql", import.meta.url)),
  "utf8",
);

/** The migration with its `--` comments removed — the header names things in order to say they are
 *  not used; the assertions below are about the statements. */
const SQL = MIGRATION.replace(/--[^\n]*/g, "");

/** TSK-06 AC-6. ADR-062's migration, comments removed the same way. */
const TSK06_SQL = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/20261018120000_tsk06_task_time_of_day.sql", import.meta.url)),
  "utf8",
).replace(/--[^\n]*/g, "");

// ---------------------------------------------------------------------------
// The clock. 03:00Z is 10:00 in Asia/Ho_Chi_Minh, well inside the day either side.
// ---------------------------------------------------------------------------

const TODAY = "2030-03-12";
const YESTERDAY = "2030-03-11";
const TWO_DAYS_AGO = "2030-03-10";
const TOMORROW = "2030-03-13";

const setToday = (day: string): void => {
  vi.setSystemTime(new Date(`${day}T03:00:00Z`));
};

// ---------------------------------------------------------------------------
// People.
// ---------------------------------------------------------------------------

async function signUp(displayName: string): Promise<string> {
  const email = `${displayName.toLowerCase().replace(/\s+/g, ".")}@tsk01.example.com`;
  const result = await mock.signUp({ email, password: "password123", displayName, avatar: "" });
  if (!result.ok) throw new Error(`signUp refused: ${result.error.code}`);
  as(FIXTURE_ADMIN.id);
  const found = (await mock.listPendingMembers()).find((m) => m.email === email);
  if (!found) throw new Error(`${displayName} is not waiting`);
  return found.id;
}

async function approved(displayName: string, teamId: string): Promise<string> {
  const id = await signUp(displayName);
  as(FIXTURE_ADMIN.id);
  const decided = await mock.decideMember(id, { approve: true, teamId });
  if (!decided.ok) throw new Error(`approve refused: ${decided.error.code}`);
  return id;
}

/** AC-16 (a) to (d), by name. The owner is FIXTURE_MEMBER throughout. */
const OWNER = FIXTURE_MEMBER.id;
const TEAMMATE = FIXTURE_APPROVED_MEMBER.id;
let MANAGER = "";
const ADMIN_SAME_TEAM = FIXTURE_ADMIN.id;
let ADMIN_OTHER_TEAM = "";
let PENDING = "";
let REJECTED = "";

beforeAll(async () => {
  // (b) A manager of the owner's team, promoted the way `tests/manager-role.test.ts` promotes one.
  MANAGER = await approved("Task Manager", FIXTURE_TEAM.id);
  as(FIXTURE_ADMIN.id);
  const promoted = await mock.setMemberRole(MANAGER, "manager");
  if (!promoted.ok) throw new Error("could not make a manager");

  // (d) An admin of another team. Promotion is own-team since ADR-065 (MIR-03), so they are
  // approved onto the admin's own team, promoted there, and then moved.
  ADMIN_OTHER_TEAM = await approved("Other Admin", FIXTURE_TEAM.id);
  as(FIXTURE_ADMIN.id);
  const otherAdmin = await mock.promoteMember(ADMIN_OTHER_TEAM);
  if (!otherAdmin.ok) throw new Error("could not make the other team's admin");
  const moved = await mock.moveMember(ADMIN_OTHER_TEAM, FIXTURE_OTHER_TEAM.id);
  if (!moved.ok) throw new Error("could not move the other team's admin");

  PENDING = await signUp("Task Pending");
  REJECTED = await signUp("Task Rejected");
  as(FIXTURE_ADMIN.id);
  const rejected = await mock.decideMember(REJECTED, { approve: false });
  if (!rejected.ok) throw new Error("could not reject");
  as(null);
});

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  setToday(TODAY);
});

afterEach(() => {
  __resetTasks();
  vi.useRealTimers();
  as(null);
});

const input = (overrides: Partial<CreateTaskInput> = {}): CreateTaskInput => ({
  date: TODAY,
  title: "Write the release notes",
  note: null,
  ...overrides,
});

async function createAs(memberId: string, overrides: Partial<CreateTaskInput> = {}): Promise<Task> {
  as(memberId);
  const result = await mock.createTask(input(overrides));
  if (!result.ok) throw new Error(`createTask refused: ${result.error.code}`);
  return result.value;
}

/** A task dated `day`, created while that day was today, with the clock put back to TODAY after. */
async function createdOn(memberId: string, day: string, title: string): Promise<Task> {
  setToday(day);
  const task = await createAs(memberId, { date: day, title });
  setToday(TODAY);
  return task;
}

async function readBack(taskId: string): Promise<Task | undefined> {
  as(OWNER);
  return (await mock.listTasks("2000-01-01", "2099-12-31")).find((t) => t.id === taskId);
}

// ---------------------------------------------------------------------------
// Writing a task — AC-6 to AC-12.
// ---------------------------------------------------------------------------

describe("TSK-01 AC-6 — create on today or a later day", () => {
  it("adds a not-done task at the end of that day's list, trimmed, and on no other day", async () => {
    await createAs(OWNER, { title: "First" });
    const second = await createAs(OWNER, { title: "  Second  ", note: "  bring the slides  " });
    const later = await createAs(OWNER, { date: TOMORROW, title: "Tomorrow's" });

    expect(second.done).toBe(false);
    expect(second.title).toBe("Second");
    expect(second.note).toBe("bring the slides");
    expect(second.memberId).toBe(OWNER);

    as(OWNER);
    expect((await mock.listTasks(TODAY, TODAY)).map((t) => t.title)).toEqual(["First", "Second"]);
    expect((await mock.listTasks(TOMORROW, TOMORROW)).map((t) => t.id)).toEqual([later.id]);
    expect(await mock.listTasks(YESTERDAY, YESTERDAY)).toEqual([]);
  });

  it("stores a note that is empty once trimmed as no note", async () => {
    const task = await createAs(OWNER, { note: "   \n  " });
    expect(task.note).toBeNull();
  });
});

describe("TSK-01 AC-7 — no create on an earlier day", () => {
  it("refuses task_date_past for yesterday and writes nothing", async () => {
    as(OWNER);
    const result = await mock.createTask(input({ date: YESTERDAY }));
    expect(result).toEqual({
      ok: false,
      error: { code: "task_date_past", message: "A task can be dated today or later." },
    });
    expect(await mock.listTasks("2000-01-01", "2099-12-31")).toEqual([]);
  });

  it("reads today in Asia/Ho_Chi_Minh, not UTC", async () => {
    // 17:30Z on the 11th is 00:30 on the 12th in UTC+7: the 11th is already past.
    vi.setSystemTime(new Date(`${YESTERDAY}T17:30:00Z`));
    as(OWNER);
    const refused = await mock.createTask(input({ date: YESTERDAY }));
    expect(refused.ok ? null : refused.error.code).toBe("task_date_past");
    const accepted = await mock.createTask(input({ date: TODAY }));
    expect(accepted.ok).toBe(true);
  });
});

describe("TSK-01 AC-8 — title and note bounds", () => {
  it("refuses an empty or over-long title, and an over-long note, writing nothing", async () => {
    as(OWNER);
    const empty = await mock.createTask(input({ title: "   " }));
    const long = await mock.createTask(input({ title: "x".repeat(TASK_TITLE_MAX + 1) }));
    const note = await mock.createTask(input({ note: "y".repeat(TASK_NOTE_MAX + 1) }));
    expect(empty.ok ? null : empty.error).toEqual({
      code: "invalid_task_title",
      message: "Give the task a title of at most 200 characters.",
    });
    expect(long.ok ? null : long.error.code).toBe("invalid_task_title");
    expect(note.ok ? null : note.error).toEqual({
      code: "invalid_task_note",
      message: "Keep the note to at most 1000 characters.",
    });
    expect(await mock.listTasks("2000-01-01", "2099-12-31")).toEqual([]);
  });

  it("accepts the bounds exactly, counted after trimming", async () => {
    const task = await createAs(OWNER, {
      title: ` ${"x".repeat(TASK_TITLE_MAX)} `,
      note: ` ${"y".repeat(TASK_NOTE_MAX)} `,
    });
    expect(task.title).toHaveLength(TASK_TITLE_MAX);
    expect(task.note).toHaveLength(TASK_NOTE_MAX);
  });

  it("refuses in the order title, note, date — before any write", async () => {
    as(OWNER);
    const all = await mock.createTask({ date: YESTERDAY, title: "", note: "y".repeat(TASK_NOTE_MAX + 1) });
    expect(all.ok ? null : all.error.code).toBe("invalid_task_title");
    const noteAndDate = await mock.createTask({ date: YESTERDAY, title: "ok", note: "y".repeat(TASK_NOTE_MAX + 1) });
    expect(noteAndDate.ok ? null : noteAndDate.error.code).toBe("invalid_task_note");
  });

  it("holds the same bounds on an edit", async () => {
    const task = await createAs(OWNER);
    const title = await mock.updateTask(task.id, { title: "", note: null, timeOfDay: null });
    const note = await mock.updateTask(task.id, { title: "ok", note: "y".repeat(TASK_NOTE_MAX + 1), timeOfDay: null });
    expect(title.ok ? null : title.error.code).toBe("invalid_task_title");
    expect(note.ok ? null : note.error.code).toBe("invalid_task_note");
    expect(await readBack(task.id)).toEqual(task);
  });

  it("the real seam refuses the same three before any request, in the same words", async () => {
    // No client is built for these: each returns before `client()` is reached.
    const title = await real.createTask(input({ title: " " }));
    const note = await real.createTask(input({ note: "y".repeat(TASK_NOTE_MAX + 1) }));
    const date = await real.createTask(input({ date: YESTERDAY }));
    const move = await real.moveTask("anything", YESTERDAY);
    expect(title.ok ? null : title.error.message).toBe("Give the task a title of at most 200 characters.");
    expect(note.ok ? null : note.error.message).toBe("Keep the note to at most 1000 characters.");
    expect(date.ok ? null : date.error.message).toBe("A task can be dated today or later.");
    expect(move.ok ? null : move.error.code).toBe("task_date_past");
  });
});

describe("TSK-01 AC-9 — tick and untick", () => {
  it("persists done and not done, including on a past day, and keeps the task in place", async () => {
    const past = await createdOn(OWNER, YESTERDAY, "Past");
    const a = await createAs(OWNER, { title: "A" });
    await createAs(OWNER, { title: "B" });

    as(OWNER);
    const ticked = await mock.setTaskDone(a.id, true);
    expect(ticked.ok && ticked.value.done).toBe(true);
    // TSK-06 AC-8, AC-9 amend "keeps the task in place" for the NEXT READ: a done task now reads after
    // the not-done ones. The page still keeps a ticked row where it is until it reads again.
    expect((await mock.listTasks(TODAY, TODAY)).map((t) => [t.title, t.done])).toEqual([
      ["B", false],
      ["A", true],
    ]);
    const unticked = await mock.setTaskDone(a.id, false);
    expect(unticked.ok && unticked.value.done).toBe(false);
    expect((await readBack(a.id))?.done).toBe(false);

    const pastTicked = await mock.setTaskDone(past.id, true);
    expect(pastTicked.ok).toBe(true);
    expect((await readBack(past.id))?.done).toBe(true);
  });
});

describe("TSK-01 AC-10 — edit title and note", () => {
  it("replaces title and note, keeping date and done state, on a past day too", async () => {
    const past = await createdOn(OWNER, TWO_DAYS_AGO, "Old");
    as(OWNER);
    await mock.setTaskDone(past.id, true);
    const edited = await mock.updateTask(past.id, { title: " New ", note: " with a note ", timeOfDay: null });
    expect(edited.ok).toBe(true);
    const back = await readBack(past.id);
    expect(back).toMatchObject({ title: "New", note: "with a note", date: TWO_DAYS_AGO, done: true });

    const cleared = await mock.updateTask(past.id, { title: "New", note: "", timeOfDay: null });
    expect(cleared.ok && cleared.value.note).toBeNull();
  });
});

describe("TSK-01 AC-11 — re-date (move)", () => {
  it("moves a past task to today or later, keeping title, note and done", async () => {
    const past = await createdOn(OWNER, YESTERDAY, "Slipped");
    as(OWNER);
    await mock.updateTask(past.id, { title: "Slipped", note: "n", timeOfDay: null });
    await mock.setTaskDone(past.id, true);

    const moved = await mock.moveTask(past.id, TOMORROW);
    expect(moved.ok).toBe(true);
    expect(await mock.listTasks(YESTERDAY, YESTERDAY)).toEqual([]);
    expect(await mock.listTasks(TOMORROW, TOMORROW)).toEqual([
      expect.objectContaining({ id: past.id, title: "Slipped", note: "n", done: true, date: TOMORROW }),
    ]);

    const today = await mock.moveTask(past.id, TODAY);
    expect(today.ok && today.value.date).toBe(TODAY);
  });

  it("refuses a move to before today with task_date_past, and the task stays", async () => {
    const task = await createAs(OWNER);
    const refused = await mock.moveTask(task.id, YESTERDAY);
    expect(refused).toEqual({
      ok: false,
      error: { code: "task_date_past", message: "A task can be dated today or later." },
    });
    expect((await readBack(task.id))?.date).toBe(TODAY);
  });
});

describe("TSK-01 AC-12 — delete", () => {
  it("removes the task for good, and a second delete is refused", async () => {
    const task = await createAs(OWNER);
    const removed = await mock.deleteTask(task.id);
    expect(removed).toEqual({ ok: true, value: undefined });
    expect(await readBack(task.id)).toBeUndefined();
    const again = await mock.deleteTask(task.id);
    expect(again.ok ? null : again.error.code).toBe("task_not_permitted");
  });
});

// ---------------------------------------------------------------------------
// Overdue — AC-13, AC-14.
// ---------------------------------------------------------------------------

describe("TSK-01 AC-13 and AC-14 — the overdue read", () => {
  it("lists every not-done task before today, oldest date first, then creation order", async () => {
    const y1 = await createdOn(OWNER, YESTERDAY, "Y1");
    const d1 = await createdOn(OWNER, TWO_DAYS_AGO, "D1");
    const y2 = await createdOn(OWNER, YESTERDAY, "Y2");
    const doneOne = await createdOn(OWNER, TWO_DAYS_AGO, "Done");
    await createAs(OWNER, { title: "Today" });
    await createAs(OWNER, { date: TOMORROW, title: "Tomorrow" });
    as(OWNER);
    await mock.setTaskDone(doneOne.id, true);

    const overdue = await mock.listOverdueTasks(TODAY);
    expect(overdue.map((t) => t.id)).toEqual([d1.id, y1.id, y2.id]);
  });

  it("ticking or moving an overdue task to today removes it from the read", async () => {
    const a = await createdOn(OWNER, YESTERDAY, "A");
    const b = await createdOn(OWNER, YESTERDAY, "B");
    as(OWNER);
    await mock.setTaskDone(a.id, true);
    await mock.moveTask(b.id, TODAY);
    expect(await mock.listOverdueTasks(TODAY)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Privacy — AC-16 to AC-19. ADR-057.
// ---------------------------------------------------------------------------

describe("TSK-01 AC-16 — nobody else reads a task", () => {
  it("a teammate, a manager, a same-team admin and an other-team admin each read none of the owner's", async () => {
    await createdOn(OWNER, YESTERDAY, "Overdue");
    const done = await createAs(OWNER, { title: "Done" });
    await createAs(OWNER, { date: TOMORROW, title: "Later" });
    as(OWNER);
    await mock.setTaskDone(done.id, true);

    const callers = { TEAMMATE, MANAGER, ADMIN_SAME_TEAM, ADMIN_OTHER_TEAM };
    for (const [name, who] of Object.entries(callers)) {
      const theirs = await createAs(who, { title: `${name}'s own` });
      as(who);
      const listed = await mock.listTasks("2000-01-01", "2099-12-31");
      expect(listed.map((t) => t.id), name).toEqual([theirs.id]);
      expect(listed.every((t) => t.memberId === who), name).toBe(true);
      expect(await mock.listOverdueTasks(TODAY), name).toEqual([]);
    }

    as(OWNER);
    expect(await mock.listTasks("2000-01-01", "2099-12-31")).toHaveLength(3);
    expect(await mock.listOverdueTasks(TODAY)).toHaveLength(1);
  });
});

describe("TSK-01 AC-17 — nobody else writes a task", () => {
  it("each caller is refused every write with task_not_permitted, and the task is unchanged", async () => {
    const task = await createAs(OWNER, { title: "Mine", note: "private" });
    const missing = "7a000000-0000-4000-8000-999999999999";

    for (const who of [TEAMMATE, MANAGER, ADMIN_SAME_TEAM, ADMIN_OTHER_TEAM]) {
      as(who);
      for (const id of [task.id, missing]) {
        const writes = [
          await mock.updateTask(id, { title: "Hijacked", note: null, timeOfDay: null }),
          await mock.moveTask(id, TOMORROW),
          await mock.setTaskDone(id, true),
          await mock.setTaskDone(id, false),
          await mock.deleteTask(id),
        ];
        for (const result of writes) {
          // The same answer whether or not the task exists, so it confirms nothing.
          expect(result).toEqual({
            ok: false,
            error: {
              code: "task_not_permitted",
              message: "This task could not be changed. It may have been deleted.",
            },
          });
        }
      }
    }

    expect(await readBack(task.id)).toEqual(task);
  });

  it("creating a task takes no owner: whoever creates it owns it", async () => {
    const task = await createAs(TEAMMATE, input());
    expect(task.memberId).toBe(TEAMMATE);
    as(OWNER);
    expect(await mock.listTasks(TODAY, TODAY)).toEqual([]);
  });
});

describe("TSK-01 AC-18 — no session, no standing", () => {
  it("signed out, pending, rejected and removed: every read empty, every write refused", async () => {
    const task = await createAs(OWNER);

    for (const who of [null, PENDING, REJECTED, FIXTURE_REMOVED_MEMBER.id]) {
      as(who);
      expect(await mock.listTasks("2000-01-01", "2099-12-31"), String(who)).toEqual([]);
      expect(await mock.listOverdueTasks(TODAY), String(who)).toEqual([]);
      const writes = [
        await mock.createTask(input()),
        await mock.updateTask(task.id, { title: "x", note: null, timeOfDay: null }),
        await mock.moveTask(task.id, TOMORROW),
        await mock.setTaskDone(task.id, true),
        await mock.deleteTask(task.id),
      ];
      for (const result of writes) {
        expect(result.ok ? null : result.error.code, String(who)).toBe("task_not_permitted");
      }
    }
    expect(await readBack(task.id)).toEqual(task);
  });

  it("a removed member's tasks are kept, and nobody reads them — the member included", async () => {
    const leaver = await approved("Task Leaver", FIXTURE_TEAM.id);
    const task = await createAs(leaver, { title: "Left behind" });

    as(FIXTURE_ADMIN.id);
    const removed = await mock.removeMember(leaver);
    expect(removed.ok).toBe(true);

    for (const who of [leaver, ADMIN_SAME_TEAM, ADMIN_OTHER_TEAM, TEAMMATE]) {
      as(who);
      expect((await mock.listTasks("2000-01-01", "2099-12-31")).some((t) => t.id === task.id)).toBe(false);
    }
    // Kept: the row is still there for the delete to find, and the delete is still refused.
    as(leaver);
    expect((await mock.deleteTask(task.id)).ok).toBe(false);
  });
});

describe("TSK-01 AC-19 — no other path reaches a task", () => {
  it("the migration creates no definer function, no trigger, no publication and no view", () => {
    expect(SQL).not.toMatch(/security\s+definer/i);
    expect(SQL).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
    expect(SQL).not.toMatch(/create\s+trigger/i);
    expect(SQL).not.toMatch(/publication/i);
    expect(SQL).not.toMatch(/create\s+(or\s+replace\s+)?view/i);
    expect(SQL).not.toMatch(/\bnotify\b/i);
  });

  it("has four policies, each to authenticated, each the owner predicate and nothing else", () => {
    const policies = [...SQL.matchAll(/create policy (\w+) on public\.task([\s\S]*?);/g)];
    expect(policies.map((p) => p[1]).sort()).toEqual([
      "task_delete_own",
      "task_insert_own",
      "task_select_own",
      "task_update_own",
    ]);
    for (const [, name = "", body = ""] of policies) {
      expect(body, name).toMatch(/to authenticated/);
      expect(body, name).not.toMatch(/is_admin|may_decide|team_id\s*=|may_manage|\bor\b/i);
      const clauses = [...body.matchAll(/(using|with check)\s*\(([\s\S]*?)\)\s*(?=with check|$)/g)];
      expect(clauses.length, name).toBe(name === "task_update_own" ? 2 : 1);
      for (const clause of clauses) {
        const predicate = (clause[2] ?? "").replace(/\s+/g, " ").trim();
        expect(predicate, name).toBe(
          "member_id = (select auth.uid()) and public.member_team_id((select auth.uid())) is not null",
        );
      }
    }
  });

  it("holds row-level security on, and gives anon nothing", () => {
    expect(SQL).toMatch(/alter table public\.task enable row level security;/);
    expect(SQL).toMatch(/revoke all on public\.task from anon, authenticated;/);
    expect(SQL).not.toMatch(/grant[^;]*\banon\b/i);
    expect(SQL).not.toMatch(/to\s+anon\b/i);
    expect(SQL).not.toMatch(/to\s+public\b/i);
  });

  it("grants insert of date, title, note only — member_id takes auth.uid()", () => {
    expect(SQL).toMatch(/grant insert \(date, title, note\) on public\.task to authenticated;/);
    expect(SQL).toMatch(/grant update \(date, title, note, done\) on public\.task to authenticated;/);
    expect(SQL).toMatch(/member_id\s+uuid\s+not null default auth\.uid\(\)/);
  });
});

// TSK-06 AC-6 NARROWS this criterion (ADR-062): the TSK-01 table still holds no time, and the TSK-06
// migration adds exactly one, `time_of_day time`. Asserted in both files.
describe("TSK-01 AC-20, as narrowed by TSK-06 AC-6 — one time of day and nothing else", () => {
  it("the TSK-01 table has no column holding a time of day, an estimate, a duration or hours", () => {
    const table = SQL.match(/create table if not exists public\.task \(([\s\S]*?)\n\);/);
    if (!table) throw new Error("no task table in the migration");
    const columns = (table[1] ?? "")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "" && !line.startsWith("constraint"))
      .map((line) => line.split(/\s+/).slice(0, 2));
    expect(columns.map(([name]) => name)).toEqual(["id", "member_id", "date", "title", "note", "done", "created_at"]);
    for (const [name, type] of columns) {
      expect(name).not.toMatch(/time|hour|minute|estimate|duration|interval/i);
      expect(type).not.toMatch(/^(time|timetz|interval)$/i);
    }
  });

  it("the TSK-06 migration adds exactly one time-bearing column, time_of_day time, and nothing else", () => {
    const added = [...TSK06_SQL.matchAll(/add column if not exists (\w+) ([\w ]+?)(?: null)?;/g)].map((m) => [
      m[1],
      m[2],
    ]);
    expect(added).toEqual([["time_of_day", "time without time zone"]]);
    expect(TSK06_SQL).not.toMatch(/\b(interval|timetz|duration|estimate|hours?|lead_time|end_time)\b/i);
    expect(TSK06_SQL).toMatch(/check \(time_of_day is null or extract\(second from time_of_day\) = 0\)/);
  });

  it("a Task from the seam has exactly the eight fields of TSK-06 § 4.1", async () => {
    const task = await createAs(OWNER);
    expect(Object.keys(task).sort()).toEqual([
      "createdAt",
      "date",
      "done",
      "id",
      "memberId",
      "note",
      "timeOfDay",
      "title",
    ]);
  });
});

// ---------------------------------------------------------------------------
// Isolation — AC-21.
// ---------------------------------------------------------------------------

describe("TSK-01 AC-21 — tasks change nothing else", () => {
  it("the absence count and the busy days of a day are what they were", async () => {
    const range = { start: TODAY, end: TOMORROW };
    const snapshot = async () => {
      as(OWNER);
      const entries = await mock.listTeamEntriesOverlapping(range);
      const roster = await mock.listMembers();
      return {
        entries,
        busy: await mock.listTeamBusyDaysOverlapping(range),
        counts: [...absenceCountsFor(entries, range, roster)],
      };
    };

    const before = await snapshot();
    const a = await createAs(OWNER, { title: "A" });
    await createAs(OWNER, { date: TOMORROW, title: "B" });
    as(OWNER);
    await mock.setTaskDone(a.id, true);
    await mock.deleteTask(a.id);
    expect(await snapshot()).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// The range read — AC-22.
// ---------------------------------------------------------------------------

// TSK-06 AC-8 amends the order within a day (not-done first, then by time); with every task untimed
// and not done, as here, it is creation order still. The amended order is in tests/task-time.test.ts.
describe("TSK-01 AC-22 — a read by date range", () => {
  it("returns exactly F <= date <= T, ordered by date then creation", async () => {
    const d = await createdOn(OWNER, TWO_DAYS_AGO, "D");
    const y = await createdOn(OWNER, YESTERDAY, "Y");
    const t1 = await createAs(OWNER, { title: "T1" });
    const later = await createAs(OWNER, { date: TOMORROW, title: "Later" });
    const t2 = await createAs(OWNER, { title: "T2" });

    as(OWNER);
    expect((await mock.listTasks(YESTERDAY, TODAY)).map((t) => t.id)).toEqual([y.id, t1.id, t2.id]);
    expect((await mock.listTasks(TWO_DAYS_AGO, TOMORROW)).map((t) => t.id)).toEqual([
      d.id,
      y.id,
      t1.id,
      t2.id,
      later.id,
    ]);
  });

  it("F after T is an empty list, with no round trip on the real seam", async () => {
    await createAs(OWNER);
    as(OWNER);
    expect(await mock.listTasks(TOMORROW, TODAY)).toEqual([]);
    expect(await real.listTasks(TOMORROW, TODAY)).toEqual([]);
  });
});
