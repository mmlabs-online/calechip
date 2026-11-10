// EVT-02 — attendance. Every acceptance criterion that is a property of the data, through the mock
// seam.
//
// **THE MOCK REPRODUCES `supabase/migrations/20260929140000_evt02_attendance.sql`; IT CANNOT PROVE
// IT.** `tests/permission-model.test.ts` against a real PostgreSQL is still owed project-wide
// (.ai/standards/rbac-and-security.md § Known weaknesses 1). The mock's check and write run with no
// `await` between them, so `Promise.all` against it proves the DECISION under concurrency is right,
// never the LOCK (01-plan.md § 3). The lock is asserted by reading the migration, the way
// `tests/events.test.ts` reads EVT-01's. A concurrency test against a running PostgreSQL is owed.
//
// **PEOPLE.** Fixtures as they are; anyone else is created through the seam as a person would be
// (sign up, then an admin decides), as `tests/events.test.ts` does. No fixture file is edited.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { SaveEventInput } from "@/lib/data";
import { seam as mock, __resetEvents, __setCurrentMember } from "@/lib/data/mock";
import { seam as real } from "@/lib/data/supabase";
import { eventToday, registrationOpen } from "@/lib/event-registration";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

const MIGRATION = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/20260929140000_evt02_attendance.sql", import.meta.url)),
  "utf8",
);

/** The migration with its `--` comments removed — the header names things in order to say they are
 *  not used; the assertions below are about the statements. */
const MIGRATION_SQL = MIGRATION.replace(/--[^\n]*/g, "");

/** The body of one `create or replace function public.<name>` statement, up to its closing `$$;`. */
function functionBody(name: string): string {
  const match = MIGRATION_SQL.match(
    new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`),
  );
  if (!match) throw new Error(`no function ${name} in the migration`);
  return match[0];
}

function policy(name: string): string {
  const match = MIGRATION_SQL.match(new RegExp(`create policy ${name}[\\s\\S]*?;`));
  if (!match) throw new Error(`no policy ${name} in the migration`);
  return match[0];
}

const input = (overrides: Partial<SaveEventInput> = {}): SaveEventInput => ({
  name: "Team lunch",
  description: null,
  location: null,
  startDate: "2099-03-10",
  endDate: "2099-03-10",
  scope: "public",
  inviteeIds: [],
  ...overrides,
});

async function createAs(memberId: string, overrides: Partial<SaveEventInput> = {}): Promise<string> {
  as(memberId);
  const result = await mock.createEvent(input(overrides));
  if (!result.ok) throw new Error(`createEvent refused: ${result.error.code}`);
  return result.value.id;
}

async function joinAs(memberId: string, eventId: string) {
  as(memberId);
  return mock.joinEvent(eventId);
}

async function decideAs(
  memberId: string,
  eventId: string,
  who: string,
  status: "attending" | "rejected" | "removed",
) {
  as(memberId);
  return mock.decideAttendance(eventId, who, status);
}

async function attendanceAs(memberId: string, eventId: string) {
  as(memberId);
  return mock.listEventAttendance(eventId);
}

async function seatsTaken(eventId: string): Promise<number> {
  return (await attendanceAs(FIXTURE_ADMIN.id, eventId)).filter((a) => a.status === "attending").length;
}

const code = (result: { ok: boolean; error?: { code: string } }): string | null =>
  result.ok ? null : (result.error?.code ?? null);

async function signUp(displayName: string): Promise<string> {
  const email = `${displayName.toLowerCase().replace(/\s+/g, ".")}@evt02.example.com`;
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

let MANAGER_A = "";
let MEMBER_A2 = "";
let MEMBER_A3 = "";
let MEMBER_B2 = "";
let PENDING = "";

beforeAll(async () => {
  MANAGER_A = await approved("Attend Manager", FIXTURE_TEAM.id);
  as(FIXTURE_ADMIN.id);
  const promoted = await mock.setMemberRole(MANAGER_A, "manager");
  if (!promoted.ok) throw new Error("could not make a manager");
  MEMBER_A2 = await approved("Attend Second", FIXTURE_TEAM.id);
  MEMBER_A3 = await approved("Attend Third", FIXTURE_TEAM.id);
  MEMBER_B2 = await approved("Attend B Two", FIXTURE_OTHER_TEAM.id);
  PENDING = await signUp("Attend Waiting");
  as(null);
});

afterEach(() => {
  __resetEvents();
  vi.useRealTimers();
  as(null);
});

describe("setting it up", () => {
  it("AC-1: capacity, approval mode and deadline save and read back; empty means the defaults", async () => {
    as(FIXTURE_MEMBER.id);
    const set = await mock.createEvent(
      input({ capacity: 12, requiresApproval: true, registrationDeadline: "2099-03-05" }),
    );
    expect(set.ok).toBe(true);
    if (!set.ok) return;
    expect(set.value).toMatchObject({ capacity: 12, requiresApproval: true, registrationDeadline: "2099-03-05" });
    expect(await mock.getEvent(set.value.id)).toEqual(set.value);

    // An EVT-01 caller that sends none of the three.
    const plain = await mock.createEvent(input());
    expect(plain.ok && plain.value).toMatchObject({
      capacity: null,
      requiresApproval: false,
      registrationDeadline: null,
    });
  });

  it("AC-2: a capacity of zero, below zero or not whole is refused by both seams, and nothing saves", async () => {
    as(FIXTURE_MEMBER.id);
    for (const capacity of [0, -3, 1.5, Number.NaN]) {
      expect(code(await mock.createEvent(input({ capacity })))).toBe("invalid_event_capacity");
      expect(code(await real.createEvent(input({ capacity })))).toBe("invalid_event_capacity");
    }
    expect(await mock.listEvents()).toEqual([]);
    expect(MIGRATION_SQL).toMatch(/event_capacity_positive check \(capacity is null or capacity >= 1\)/);
  });

  it("AC-3: a deadline after the end date is refused; a deadline in the past is accepted", async () => {
    as(FIXTURE_MEMBER.id);
    const late = input({ endDate: "2099-03-10", registrationDeadline: "2099-03-11" });
    expect(code(await mock.createEvent(late))).toBe("invalid_event_deadline");
    expect(code(await real.createEvent(late))).toBe("invalid_event_deadline");

    const id = await createAs(FIXTURE_MEMBER.id, { registrationDeadline: "2099-03-08" });
    // The end date moved before the existing deadline.
    const moved = await mock.updateEvent(
      id,
      input({ startDate: "2099-03-01", endDate: "2099-03-07", registrationDeadline: "2099-03-08" }),
    );
    expect(code(moved)).toBe("invalid_event_deadline");

    const past = await mock.createEvent(input({ registrationDeadline: "2000-01-01" }));
    expect(past.ok).toBe(true);
    expect(MIGRATION_SQL).toMatch(
      /event_deadline_by_end\s+check \(registration_deadline is null or registration_deadline <= end_date\)/,
    );
  });

  it("AC-4: capacity may not go below seats taken; exactly seats taken saves and the event is full", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { capacity: 5 });
    for (const who of [FIXTURE_MEMBER.id, MEMBER_A2, MEMBER_B2]) expect((await joinAs(who, id)).ok).toBe(true);

    as(FIXTURE_MEMBER.id);
    expect(code(await mock.updateEvent(id, input({ capacity: 2 })))).toBe("event_capacity_below_attendees");
    as(FIXTURE_ADMIN.id);
    expect(code(await mock.updateEvent(id, input({ capacity: 2 })))).toBe("event_capacity_below_attendees");
    expect((await mock.getEvent(id))?.capacity).toBe(5);

    as(FIXTURE_MEMBER.id);
    expect((await mock.updateEvent(id, input({ capacity: 3 }))).ok).toBe(true);
    expect(code(await joinAs(MEMBER_A3, id))).toBe("event_full");
  });

  it("AC-4: the capacity guard runs on every capacity update, under the row's own lock", () => {
    const guard = functionBody("event_capacity_guard");
    expect(guard).toMatch(/errcode = 'EV003'/);
    expect(guard).toMatch(/new\.capacity < v_taken/);
    expect(MIGRATION_SQL).toMatch(
      /create trigger event_capacity_guard\s+before update of capacity on public\.event/,
    );
  });

  it("AC-5: switching mode, changing scope or un-naming someone leaves every attendance as it was", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, {
      scope: "named",
      inviteeIds: [MEMBER_A2, MEMBER_B2],
      requiresApproval: true,
    });
    await joinAs(MEMBER_A2, id);
    await joinAs(MEMBER_B2, id);
    expect((await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "attending")).ok).toBe(true);

    // Mode off, and both people taken off the list.
    as(FIXTURE_MEMBER.id);
    expect((await mock.updateEvent(id, input({ scope: "named", inviteeIds: [], requiresApproval: false }))).ok).toBe(true);

    const rows = await attendanceAs(FIXTURE_MEMBER.id, id);
    expect(rows.map((r) => [r.memberId, r.status]).sort()).toEqual(
      [
        [MEMBER_A2, "attending"],
        [MEMBER_B2, "pending"],
      ].sort(),
    );
    // Both still read the event, because they are on it.
    as(MEMBER_A2);
    expect(await mock.getEvent(id)).not.toBeNull();
    as(MEMBER_B2);
    expect((await mock.listEvents()).some((e) => e.id === id)).toBe(true);
    // The pending one is still decided by the creator.
    expect((await decideAs(FIXTURE_MEMBER.id, id, MEMBER_B2, "attending")).ok).toBe(true);
  });

  it("AC-5: event_select_visible gains exactly the participant disjunct", () => {
    const select = policy("event_select_visible");
    expect(select).toMatch(/public\.is_event_participant\(id, \(select auth\.uid\(\)\)\)/);
    expect(select).toMatch(/public\.is_event_invitee\(id, \(select auth\.uid\(\)\)\)/);
    expect(functionBody("is_event_participant")).toMatch(/'pending'::public\.attendance_status, 'attending'/);
  });
});

describe("joining", () => {
  it("AC-6: without approval, joining is immediate and seats taken goes up", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { capacity: 4 });
    const joined = await joinAs(MEMBER_B2, id);
    expect(joined.ok && joined.value).toMatchObject({ eventId: id, memberId: MEMBER_B2, status: "attending" });
    expect(await seatsTaken(id)).toBe(1);
    // A reader on another team sees them.
    expect((await attendanceAs(FIXTURE_OTHER_TEAM_MEMBER.id, id)).map((a) => a.memberId)).toEqual([MEMBER_B2]);
  });

  it("AC-7: with approval, everyone waits — named people too — and a request is accepted when full", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, {
      scope: "named",
      inviteeIds: [MEMBER_A2, MEMBER_B2],
      requiresApproval: true,
      capacity: 1,
    });
    const named = await joinAs(MEMBER_B2, id);
    expect(named.ok && named.value.status).toBe("pending");
    expect(await seatsTaken(id)).toBe(0);
    // A pending requester is not an attendee to anyone else.
    as(MEMBER_A2);
    expect(await mock.listEventAttendance(id)).toEqual([]);

    expect((await decideAs(FIXTURE_MEMBER.id, id, MEMBER_B2, "attending")).ok).toBe(true);
    // Full now; a request still goes in, and holds no seat.
    const request = await joinAs(MEMBER_A2, id);
    expect(request.ok && request.value.status).toBe("pending");
    expect(await seatsTaken(id)).toBe(1);
  });

  it("AC-8: full — no join without approval, and no approval with it", async () => {
    const open = await createAs(FIXTURE_MEMBER.id, { capacity: 1 });
    expect((await joinAs(MEMBER_A2, open)).ok).toBe(true);
    expect(code(await joinAs(MEMBER_A3, open))).toBe("event_full");
    expect(await seatsTaken(open)).toBe(1);

    const gated = await createAs(FIXTURE_MEMBER.id, { capacity: 1, requiresApproval: true });
    await joinAs(MEMBER_A2, gated);
    await joinAs(MEMBER_A3, gated);
    expect((await decideAs(FIXTURE_MEMBER.id, gated, MEMBER_A2, "attending")).ok).toBe(true);
    expect(code(await decideAs(FIXTURE_MEMBER.id, gated, MEMBER_A3, "attending"))).toBe("event_full");
    expect(code(await decideAs(FIXTURE_ADMIN.id, gated, MEMBER_A3, "attending"))).toBe("event_full");
    expect(await seatsTaken(gated)).toBe(1);
  });

  it("AC-9: with one seat free, two approvals, or an approval and a join, arriving together take one seat", async () => {
    const gated = await createAs(FIXTURE_MEMBER.id, { capacity: 1, requiresApproval: true });
    await joinAs(MEMBER_A2, gated);
    await joinAs(MEMBER_A3, gated);
    as(FIXTURE_MEMBER.id);
    const both = await Promise.all([
      mock.decideAttendance(gated, MEMBER_A2, "attending"),
      mock.decideAttendance(gated, MEMBER_A3, "attending"),
    ]);
    expect(both.filter((r) => r.ok)).toHaveLength(1);
    expect(both.map(code).filter((c) => c !== null)).toEqual(["event_full"]);
    expect(await seatsTaken(gated)).toBe(1);

    // An instant join racing an admin's capacity reduction on an open event.
    const open = await createAs(FIXTURE_MEMBER.id, { capacity: 2 });
    await joinAs(MEMBER_A2, open);
    as(MEMBER_A3);
    const join = mock.joinEvent(open);
    as(FIXTURE_ADMIN.id);
    const shrink = mock.updateEvent(open, input({ capacity: 1 }));
    const [joined, shrunk] = await Promise.all([join, shrink]);
    expect([joined.ok, shrunk.ok].filter(Boolean)).toHaveLength(1);
    const event = await mock.getEvent(open);
    expect(await seatsTaken(open)).toBeLessThanOrEqual(event?.capacity ?? 0);
  });

  it("AC-9: the guard locks the event row before it counts, on every seat-raising write", () => {
    const guard = functionBody("event_attendance_guard");
    const lock = guard.search(/select \* into v_event from public\.event where id = new\.event_id for update;/);
    const count = guard.search(/select count\(\*\) into v_taken/);
    expect(lock).toBeGreaterThan(-1);
    expect(count).toBeGreaterThan(lock);
    expect(guard).toMatch(/errcode = 'EV001'/);
    expect(guard).toMatch(/language plpgsql volatile/);
    expect(MIGRATION_SQL).toMatch(
      /create trigger event_attendance_guard\s+before insert or update on public\.event_attendance/,
    );
  });

  it("AC-10: registration closed — no join or request; the last day is still open", async () => {
    const past = await createAs(FIXTURE_MEMBER.id, { startDate: "2000-01-01", endDate: "2000-01-02" });
    expect(code(await joinAs(MEMBER_A2, past))).toBe("event_registration_closed");
    const deadlinePassed = await createAs(FIXTURE_MEMBER.id, {
      registrationDeadline: "2000-01-01",
      requiresApproval: true,
    });
    expect(code(await joinAs(MEMBER_A2, deadlinePassed))).toBe("event_registration_closed");

    const lastDay = await createAs(FIXTURE_MEMBER.id, { registrationDeadline: eventToday() });
    expect((await joinAs(MEMBER_A2, lastDay)).ok).toBe(true);
  });

  it("AC-10: the day ends at midnight in Asia/Ho_Chi_Minh, not UTC", () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const event = { registrationDeadline: "2099-03-10", endDate: "2099-03-12" };
    vi.setSystemTime(new Date("2099-03-10T16:59:59Z")); // 23:59:59 on the 10th in UTC+7
    expect(eventToday()).toBe("2099-03-10");
    expect(registrationOpen(event, eventToday())).toBe(true);
    vi.setSystemTime(new Date("2099-03-10T17:00:00Z")); // 00:00 on the 11th in UTC+7
    expect(eventToday()).toBe("2099-03-11");
    expect(registrationOpen(event, eventToday())).toBe(false);
    expect(registrationOpen({ registrationDeadline: null, endDate: "2099-03-11" }, "2099-03-11")).toBe(true);
    expect(functionBody("event_registration_open")).toMatch(
      /\(now\(\) at time zone 'Asia\/Ho_Chi_Minh'\)::date\s+<= coalesce\(e\.registration_deadline, e\.end_date\)/,
    );
  });

  it("AC-11: only the audience joins — not another team, not an admin outside it, not a pending sign-up", async () => {
    const own = await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    expect(code(await joinAs(FIXTURE_OTHER_TEAM_MEMBER.id, own))).toBe("attendance_not_permitted");
    expect((await joinAs(MEMBER_A2, own)).ok).toBe(true);

    const named = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [MEMBER_B2] });
    expect(code(await joinAs(MEMBER_A2, named))).toBe("attendance_not_permitted");
    expect((await joinAs(MEMBER_B2, named)).ok).toBe(true);

    // An admin reads every event but joins only where they are in the audience.
    const bTeam = await createAs(FIXTURE_OTHER_TEAM_MEMBER.id, { scope: "team" });
    as(FIXTURE_ADMIN.id);
    expect(await mock.getEvent(bTeam)).not.toBeNull();
    expect(code(await joinAs(FIXTURE_ADMIN.id, bTeam))).toBe("attendance_not_permitted");

    const everyone = await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    expect(code(await joinAs(PENDING, everyone))).toBe("attendance_not_permitted");
    // A manager joins exactly as a member does.
    expect((await joinAs(MANAGER_A, everyone)).ok).toBe(true);
    expect(code(await joinAs(MANAGER_A, bTeam))).toBe("attendance_not_permitted");
  });

  it("AC-11: is_event_audience has no admin clause", () => {
    const audience = functionBody("is_event_audience");
    expect(audience).toMatch(/public\.member_team_id\(p_uid\) is not null/);
    expect(audience).not.toMatch(/is_admin/);
  });

  it("AC-12: the creator takes no seat, and may join their own event under its mode and approve themselves", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { requiresApproval: true, capacity: 2 });
    expect(await seatsTaken(id)).toBe(0);
    const request = await joinAs(FIXTURE_MEMBER.id, id);
    expect(request.ok && request.value.status).toBe("pending");
    expect((await decideAs(FIXTURE_MEMBER.id, id, FIXTURE_MEMBER.id, "attending")).ok).toBe(true);
    expect(await seatsTaken(id)).toBe(1);
  });

  it("AC-13: one attendance per person per event, in any state", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    expect((await joinAs(MEMBER_A2, id)).ok).toBe(true);
    expect(code(await joinAs(MEMBER_A2, id))).toBe("already_on_event");
    expect((await attendanceAs(FIXTURE_ADMIN.id, id)).length).toBe(1);
    expect(MIGRATION_SQL).toMatch(/primary key \(event_id, member_id\)/);
  });
});

describe("leaving", () => {
  it("AC-14: an attendee withdraws and a requester cancels, and each may join again while open", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { capacity: 3 });
    await joinAs(MEMBER_A2, id);
    as(MEMBER_A2);
    expect((await mock.leaveEvent(id)).ok).toBe(true);
    expect(await seatsTaken(id)).toBe(0);
    expect((await joinAs(MEMBER_A2, id)).ok).toBe(true);

    const gated = await createAs(FIXTURE_MEMBER.id, { requiresApproval: true });
    await joinAs(MEMBER_A3, gated);
    as(MEMBER_A3);
    expect((await mock.leaveEvent(gated)).ok).toBe(true);
    expect(await attendanceAs(FIXTURE_ADMIN.id, gated)).toEqual([]);
  });

  it("AC-15: no leaving once registration has closed", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { registrationDeadline: eventToday() });
    await joinAs(MEMBER_A2, id);
    // Close it: the creator moves the deadline into the past.
    as(FIXTURE_MEMBER.id);
    expect((await mock.updateEvent(id, input({ registrationDeadline: "2000-01-01" }))).ok).toBe(true);
    as(MEMBER_A2);
    expect(code(await mock.leaveEvent(id))).toBe("event_registration_closed");
    expect(await seatsTaken(id)).toBe(1);
    expect(policy("event_attendance_delete_own")).toMatch(/public\.event_registration_open\(event_id\)/);
  });

  it("leaving with no attendance is not permitted, and says nothing about the event", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    as(MEMBER_A2);
    expect(code(await mock.leaveEvent(id))).toBe("attendance_not_permitted");
    expect(code(await mock.leaveEvent("ec000000-0000-4000-8000-999999999999"))).toBe("attendance_not_permitted");
  });
});

describe("deciding", () => {
  it("AC-16: the creator and any admin approve and reject, on any event, any team", async () => {
    const id = await createAs(FIXTURE_OTHER_TEAM_MEMBER.id, { requiresApproval: true });
    await joinAs(MEMBER_B2, id);
    await joinAs(MEMBER_A2, id);
    const ok = await decideAs(FIXTURE_ADMIN.id, id, MEMBER_B2, "attending");
    expect(ok.ok && ok.value.status).toBe("attending");
    const no = await decideAs(FIXTURE_OTHER_TEAM_MEMBER.id, id, MEMBER_A2, "rejected");
    expect(no.ok && no.value.status).toBe("rejected");
    // The requester sees their own state; nobody else sees it.
    expect((await attendanceAs(MEMBER_A2, id)).find((a) => a.memberId === MEMBER_A2)?.status).toBe("rejected");
    expect((await attendanceAs(MEMBER_B2, id)).map((a) => a.memberId)).toEqual([MEMBER_B2]);
  });

  it("AC-17: the creator or an admin removes an attendee, and the seat frees", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { capacity: 1 });
    await joinAs(MEMBER_A2, id);
    const removed = await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "removed");
    expect(removed.ok && removed.value.status).toBe("removed");
    expect(await seatsTaken(id)).toBe(0);
    expect((await attendanceAs(MEMBER_A2, id))[0]?.status).toBe("removed");
    expect((await joinAs(MEMBER_A3, id)).ok).toBe(true);
    expect((await decideAs(FIXTURE_ADMIN.id, id, MEMBER_A3, "removed")).ok).toBe(true);
  });

  it("AC-16, AC-17: only the three transitions are allowed", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { requiresApproval: true });
    await joinAs(MEMBER_A2, id);
    expect(code(await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "removed"))).toBe("invalid_attendance_change");
    await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "rejected");
    expect(code(await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "attending"))).toBe("invalid_attendance_change");
  });

  it("AC-18: deciding does not close with registration", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { requiresApproval: true, registrationDeadline: eventToday() });
    await joinAs(MEMBER_A2, id);
    await joinAs(MEMBER_A3, id);
    as(FIXTURE_MEMBER.id);
    await mock.updateEvent(id, input({ requiresApproval: true, registrationDeadline: "2000-01-01" }));
    expect((await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "attending")).ok).toBe(true);
    expect((await decideAs(FIXTURE_ADMIN.id, id, MEMBER_A3, "rejected")).ok).toBe(true);
    expect((await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "removed")).ok).toBe(true);
  });

  it("AC-19: rejected and removed are final — no new join, and no deleting the row to start over", async () => {
    const gated = await createAs(FIXTURE_MEMBER.id, { requiresApproval: true });
    await joinAs(MEMBER_A2, gated);
    await decideAs(FIXTURE_MEMBER.id, gated, MEMBER_A2, "rejected");
    as(MEMBER_A2);
    expect(code(await mock.leaveEvent(gated))).toBe("attendance_not_permitted");
    expect(code(await joinAs(MEMBER_A2, gated))).toBe("already_on_event");

    const open = await createAs(FIXTURE_MEMBER.id);
    await joinAs(MEMBER_A3, open);
    await decideAs(FIXTURE_MEMBER.id, open, MEMBER_A3, "removed");
    as(MEMBER_A3);
    expect(code(await mock.leaveEvent(open))).toBe("attendance_not_permitted");
    expect(code(await joinAs(MEMBER_A3, open))).toBe("already_on_event");
    expect(policy("event_attendance_delete_own")).toMatch(/status in \('pending'::public\.attendance_status, 'attending'/);
  });

  it("AC-20: a member or manager who did not create the event decides nothing", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { requiresApproval: true });
    await joinAs(MEMBER_A2, id);
    for (const who of [MEMBER_A3, MANAGER_A, MEMBER_A2]) {
      expect(code(await decideAs(who, id, MEMBER_A2, "attending"))).toBe("attendance_not_permitted");
    }
    expect((await attendanceAs(FIXTURE_ADMIN.id, id))[0]?.status).toBe("pending");
  });

  it("AC-20: no one chooses their own state — member_id and status are withheld from the insert grant", () => {
    expect(MIGRATION_SQL).toMatch(/grant insert \(event_id\) on public\.event_attendance to authenticated;/);
    expect(MIGRATION_SQL).toMatch(/grant update \(status\)\s+on public\.event_attendance to authenticated;/);
    expect(MIGRATION_SQL).toMatch(/revoke all on public\.event_attendance from anon, authenticated;/);
    const guard = functionBody("event_attendance_guard");
    expect(guard).toMatch(/new\.status := case when v_event\.requires_approval/);
    // Every "someone else's event" predicate is may_manage_event, keyed on is_admin — never may_decide.
    expect(policy("event_attendance_update_manage")).toMatch(/public\.may_manage_event\(event_id/);
    expect(MIGRATION_SQL).not.toMatch(/may_decide/);
  });
});

describe("who sees who is coming", () => {
  it("AC-21: every reader of the event reads its attendees; a non-reader receives nothing", async () => {
    const own = await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    await joinAs(MEMBER_A2, own);
    expect((await attendanceAs(MANAGER_A, own)).map((a) => a.memberId)).toEqual([MEMBER_A2]);
    expect(await attendanceAs(FIXTURE_OTHER_TEAM_MEMBER.id, own)).toEqual([]);
    expect(await attendanceAs(PENDING, own)).toEqual([]);
    expect(await attendanceAs(FIXTURE_OTHER_TEAM_MEMBER.id, "ec000000-0000-4000-8000-999999999999")).toEqual([]);
  });

  it("AC-22: pending requests are read by the creator and admins and by the requester alone", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { requiresApproval: true });
    await joinAs(MEMBER_A2, id);
    await joinAs(MEMBER_A3, id);
    expect((await attendanceAs(FIXTURE_MEMBER.id, id)).length).toBe(2);
    expect((await attendanceAs(FIXTURE_ADMIN.id, id)).length).toBe(2);
    expect((await attendanceAs(MEMBER_A2, id)).map((a) => a.memberId)).toEqual([MEMBER_A2]);
    expect(await attendanceAs(MANAGER_A, id)).toEqual([]);
  });

  it("AC-23: an attendance carries exactly five fields, and the roster does not widen", async () => {
    for (const who of [FIXTURE_MEMBER.id, MANAGER_A]) {
      as(who);
      const before = await mock.listMembers();
      const id = await createAs(FIXTURE_OTHER_TEAM_MEMBER.id);
      await joinAs(MEMBER_B2, id);
      await joinAs(who, id);
      const rows = await attendanceAs(who, id);
      for (const row of rows) {
        expect(Object.keys(row).sort()).toEqual(["createdAt", "eventId", "memberId", "status", "updatedAt"]);
      }
      as(who);
      const after = await mock.listMembers();
      expect(after).toEqual(before);
      expect(after.every((m) => m.teamId === FIXTURE_TEAM.id)).toBe(true);
    }
  });

  it("AC-23: the migration touches no policy on public.member", () => {
    expect(MIGRATION_SQL).not.toMatch(/policy\s+\w+\s+on\s+public\.member\b/i);
    expect(MIGRATION_SQL).not.toMatch(/alter\s+policy/i);
    expect(MIGRATION_SQL).not.toMatch(/member_select_team/);
    expect(MIGRATION_SQL).not.toMatch(/on\s+public\.member\s/i);
  });
});

describe("what it does not touch", () => {
  it("AC-24: attending creates no entry and moves no count", async () => {
    as(FIXTURE_MEMBER.id);
    const range = { start: "2099-03-01", end: "2099-03-31" };
    const teamBefore = await mock.listTeamEntries();
    const rangeBefore = await mock.listTeamEntriesOverlapping(range);
    const ownBefore = await mock.listOwnEntries();

    const id = await createAs(FIXTURE_MEMBER.id, { startDate: "2099-03-01", endDate: "2099-03-31", requiresApproval: true });
    await joinAs(FIXTURE_MEMBER.id, id);
    await joinAs(MEMBER_A2, id);
    await decideAs(FIXTURE_MEMBER.id, id, FIXTURE_MEMBER.id, "attending");
    await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "rejected");

    as(FIXTURE_MEMBER.id);
    expect(await mock.listTeamEntries()).toEqual(teamBefore);
    expect(await mock.listTeamEntriesOverlapping(range)).toEqual(rangeBefore);
    expect(await mock.listOwnEntries()).toEqual(ownBefore);
  });

  it("AC-25: deleting an event deletes its attendances of every state", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { requiresApproval: true });
    for (const who of [MEMBER_A2, MEMBER_A3, MANAGER_A]) await joinAs(who, id);
    await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "attending");
    await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A3, "rejected");
    as(FIXTURE_MEMBER.id);
    expect((await mock.deleteEvent(id)).ok).toBe(true);
    expect(await attendanceAs(FIXTURE_ADMIN.id, id)).toEqual([]);
    expect(MIGRATION_SQL).toMatch(/event_id\s+uuid not null references public\.event\(id\) on delete cascade/);
  });

  it("AC-26: a member removed later keeps their seat in the data, and can do nothing", async () => {
    const leaver = await approved("Attend Leaver", FIXTURE_TEAM.id);
    const id = await createAs(FIXTURE_MEMBER.id, { capacity: 2 });
    await joinAs(leaver, id);
    as(FIXTURE_ADMIN.id);
    expect((await mock.removeMember(leaver)).ok).toBe(true);

    expect(await seatsTaken(id)).toBe(1);
    // Not in the directory any more — the screen shows *Former member*.
    as(FIXTURE_MEMBER.id);
    expect((await mock.listMemberDirectory()).some((m) => m.id === leaver)).toBe(false);
    as(leaver);
    expect(await mock.getEvent(id)).toBeNull();
    expect(code(await mock.leaveEvent(id))).toBe("attendance_not_permitted");
    // The creator frees the seat.
    expect((await decideAs(FIXTURE_MEMBER.id, id, leaver, "removed")).ok).toBe(true);
    expect(await seatsTaken(id)).toBe(0);
  });
});
