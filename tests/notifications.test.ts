// EVT-04 — notifications. Every acceptance criterion that is a property of the data, through the mock
// seam, and the migration's shape by reading it.
//
// **THE MOCK REPRODUCES `supabase/migrations/20261008120000_evt04_notification.sql`; IT CANNOT PROVE
// IT.** `tests/permission-model.test.ts` against a real PostgreSQL is still owed project-wide
// (.ai/standards/rbac-and-security.md § Known weaknesses 1). The triggers, the policies and the grants
// are asserted by reading the file, the way `tests/events.test.ts` reads EVT-01's.
//
// **PEOPLE.** Fixtures as they are; anyone else is created through the seam as a person would be
// (sign up, then an admin decides), as `tests/event-attendance.test.ts` does. No fixture file is
// edited.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SaveEventInput } from "@/lib/data";
import { seam as mock, __resetEvents, __setCurrentMember } from "@/lib/data/mock";
import { NOTIFICATION_LIMIT, type NotificationKind } from "@/lib/domain/types";
import { notificationSentence } from "@/components/NotificationBell";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

const MIGRATION = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/20261008120000_evt04_notification.sql", import.meta.url)),
  "utf8",
);
const EVT02 = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/20260929140000_evt02_attendance.sql", import.meta.url)),
  "utf8",
);

/** A migration with its `--` comments removed — the header names things in order to say they are not
 *  used; the assertions below are about the statements. */
const strip = (sql: string): string => sql.replace(/--[^\n]*/g, "");
const SQL = strip(MIGRATION);

function functionBody(name: string): string {
  const match = SQL.match(new RegExp(`create or replace function public\\.${name}\\([\\s\\S]*?\\$\\$;`));
  if (!match) throw new Error(`no function ${name} in the migration`);
  return match[0];
}

function statement(head: string, sql = SQL): string {
  const match = sql.match(new RegExp(`${head}[\\s\\S]*?;`));
  if (!match) throw new Error(`no statement ${head}`);
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

async function updateAs(memberId: string, eventId: string, overrides: Partial<SaveEventInput> = {}) {
  as(memberId);
  const result = await mock.updateEvent(eventId, input(overrides));
  if (!result.ok) throw new Error(`updateEvent refused: ${result.error.code}`);
}

async function joinAs(memberId: string, eventId: string): Promise<void> {
  as(memberId);
  const result = await mock.joinEvent(eventId);
  if (!result.ok) throw new Error(`joinEvent refused: ${result.error.code}`);
}

async function decideAs(
  memberId: string,
  eventId: string,
  who: string,
  status: "attending" | "rejected" | "removed",
): Promise<void> {
  as(memberId);
  const result = await mock.decideAttendance(eventId, who, status);
  if (!result.ok) throw new Error(`decideAttendance refused: ${result.error.code}`);
}

async function inbox(memberId: string) {
  as(memberId);
  return mock.listNotifications();
}

async function kinds(memberId: string, eventId?: string): Promise<NotificationKind[]> {
  return (await inbox(memberId))
    .filter((n) => eventId === undefined || n.eventId === eventId)
    .map((n) => n.kind);
}

async function signUp(displayName: string): Promise<string> {
  const email = `${displayName.toLowerCase().replace(/\s+/g, ".")}@evt04.example.com`;
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

let MEMBER_A2 = "";
let MANAGER_A = "";
let MEMBER_B2 = "";
let ADMIN_B = "";
let PENDING = "";
let REJECTED = "";

beforeAll(async () => {
  MEMBER_A2 = await approved("Notify Second", FIXTURE_TEAM.id);
  MANAGER_A = await approved("Notify Manager", FIXTURE_TEAM.id);
  as(FIXTURE_ADMIN.id);
  if (!(await mock.setMemberRole(MANAGER_A, "manager")).ok) throw new Error("could not make a manager");
  MEMBER_B2 = await approved("Notify B Two", FIXTURE_OTHER_TEAM.id);
  // MIR-03 — ADR-065: promotion is own-team, so the other team's admin is approved onto the
  // admin's own team, promoted there, and then moved. Same end state as before.
  ADMIN_B = await approved("Notify B Admin", FIXTURE_TEAM.id);
  as(FIXTURE_ADMIN.id);
  if (!(await mock.promoteMember(ADMIN_B)).ok) throw new Error("could not make an admin");
  if (!(await mock.moveMember(ADMIN_B, FIXTURE_OTHER_TEAM.id)).ok) throw new Error("could not move the admin");
  PENDING = await signUp("Notify Waiting");
  REJECTED = await signUp("Notify Turned Away");
  as(FIXTURE_ADMIN.id);
  if (!(await mock.decideMember(REJECTED, { approve: false })).ok) throw new Error("could not reject");
  as(null);
});

afterEach(() => {
  __resetEvents();
  as(null);
});

// ---------------------------------------------------------------------------------------------
describe("who is notified, and of what", () => {
  it("AC-1: an own-team event notifies the creator's teammates and nobody else", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "team" });

    for (const who of [MEMBER_A2, MANAGER_A, FIXTURE_ADMIN.id]) {
      expect(await kinds(who, id)).toEqual(["event_created"]);
    }
    // Another team — including its admin, who can read the event but is not who it is for.
    for (const who of [FIXTURE_OTHER_TEAM_MEMBER.id, MEMBER_B2, ADMIN_B]) {
      expect(await kinds(who, id)).toEqual([]);
    }
    as(ADMIN_B);
    expect(await mock.getEvent(id)).not.toBeNull();
    // The creator is the actor.
    expect(await kinds(FIXTURE_MEMBER.id)).toEqual([]);
  });

  it("AC-1: an every-team event notifies every other approved member; a named event sends no event_created", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    for (const who of [MEMBER_A2, FIXTURE_ADMIN.id, FIXTURE_OTHER_TEAM_MEMBER.id, MEMBER_B2, ADMIN_B]) {
      expect(await kinds(who, id)).toEqual(["event_created"]);
    }
    expect(await kinds(FIXTURE_MEMBER.id)).toEqual([]);

    const named = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [MEMBER_B2] });
    expect(await kinds(MEMBER_A2, named)).toEqual([]);
    expect(await kinds(MEMBER_B2, named)).toEqual(["event_invited"]);
  });

  it("AC-2: naming notifies once; a second save sends nothing new; taken off and named again sends a second", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [MEMBER_B2, MEMBER_A2] });
    expect(await kinds(MEMBER_B2, id)).toEqual(["event_invited"]);
    expect(await kinds(MEMBER_A2, id)).toEqual(["event_invited"]);

    await updateAs(FIXTURE_MEMBER.id, id, { scope: "named", inviteeIds: [MEMBER_B2, MEMBER_A2] });
    expect(await kinds(MEMBER_B2, id)).toEqual(["event_invited"]);

    await updateAs(FIXTURE_MEMBER.id, id, { scope: "named", inviteeIds: [MEMBER_A2] });
    await updateAs(FIXTURE_MEMBER.id, id, { scope: "named", inviteeIds: [MEMBER_A2, MEMBER_B2] });
    expect(await kinds(MEMBER_B2, id)).toEqual(["event_invited", "event_invited"]);

    // The actor naming themselves is not notified.
    await updateAs(FIXTURE_MEMBER.id, id, { scope: "named", inviteeIds: [MEMBER_A2, MEMBER_B2, FIXTURE_MEMBER.id] });
    expect(await kinds(FIXTURE_MEMBER.id)).toEqual([]);
  });

  it("AC-3: an edit to named notifies exactly the newly named; widening the scope sends no event_created", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [MEMBER_A2] });
    await updateAs(FIXTURE_MEMBER.id, id, { scope: "named", inviteeIds: [MEMBER_A2, MEMBER_B2] });
    expect(await kinds(MEMBER_A2, id)).toEqual(["event_invited"]);
    expect(await kinds(MEMBER_B2, id)).toEqual(["event_invited"]);

    await updateAs(FIXTURE_MEMBER.id, id, { scope: "public" });
    for (const who of [MEMBER_A2, MEMBER_B2, FIXTURE_OTHER_TEAM_MEMBER.id, FIXTURE_ADMIN.id]) {
      expect((await kinds(who, id)).filter((k) => k === "event_created")).toEqual([]);
    }

    const team = await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    await updateAs(FIXTURE_MEMBER.id, team, { scope: "named", inviteeIds: [FIXTURE_OTHER_TEAM_MEMBER.id] });
    expect(await kinds(FIXTURE_OTHER_TEAM_MEMBER.id, team)).toEqual(["event_invited"]);
  });

  it("AC-4: approved, declined and removed reach the person; a creator approving their own request receives nothing", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { requiresApproval: true });
    await joinAs(MEMBER_A2, id);
    await joinAs(MEMBER_B2, id);
    await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "attending");
    await decideAs(FIXTURE_ADMIN.id, id, MEMBER_B2, "rejected");
    expect(await kinds(MEMBER_A2, id)).toEqual(["attendance_approved", "event_created"]);
    expect(await kinds(MEMBER_B2, id)).toEqual(["attendance_rejected", "event_created"]);

    await decideAs(FIXTURE_ADMIN.id, id, MEMBER_A2, "removed");
    expect((await kinds(MEMBER_A2, id))[0]).toBe("attendance_removed");

    // EVT-02 AC-12: the creator joins and approves themselves.
    await joinAs(FIXTURE_MEMBER.id, id);
    await decideAs(FIXTURE_MEMBER.id, id, FIXTURE_MEMBER.id, "attending");
    expect(await kinds(FIXTURE_MEMBER.id, id)).not.toContain("attendance_approved");
  });

  it("AC-5: a change to any of the nine fields notifies everyone taking part, other than the actor", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { requiresApproval: true, scope: "named", inviteeIds: [MEMBER_A2, MEMBER_B2, MANAGER_A] });
    await joinAs(MEMBER_A2, id);
    await joinAs(MEMBER_B2, id);
    await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "attending"); // attending; MEMBER_B2 stays pending
    const base = { requiresApproval: true, scope: "named" as const, inviteeIds: [MEMBER_A2, MEMBER_B2, MANAGER_A] };

    const changes: Partial<SaveEventInput>[] = [
      { name: "Renamed" },
      { description: "Bring a hat" },
      { location: "Rooftop" },
      { startDate: "2099-03-09" },
      { endDate: "2099-03-11" },
      { capacity: 20 },
      { requiresApproval: false },
      { registrationDeadline: "2099-03-08" },
    ];
    let expected = 0;
    for (const change of changes) {
      await updateAs(FIXTURE_MEMBER.id, id, { ...base, ...change });
      expected++;
      // Back to the base, which is itself a change.
      await updateAs(FIXTURE_MEMBER.id, id, base);
      expected++;
    }
    // Scope, the ninth: named to public, for the attending and the pending alike.
    await updateAs(FIXTURE_MEMBER.id, id, { ...base, scope: "public" });
    expected++;

    for (const who of [MEMBER_A2, MEMBER_B2]) {
      expect((await kinds(who, id)).filter((k) => k === "event_updated")).toHaveLength(expected);
    }
    // Named but not taking part, and the actor: nothing.
    expect((await kinds(MANAGER_A, id)).filter((k) => k === "event_updated")).toEqual([]);
    expect(await kinds(FIXTURE_MEMBER.id, id)).not.toContain("event_updated");
  });

  it("AC-5: a save that changes only the named list, or nothing, sends no event_updated; an admin's edit reaches the creator only if they take part", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [MEMBER_A2] });
    await joinAs(MEMBER_A2, id);
    await updateAs(FIXTURE_MEMBER.id, id, { scope: "named", inviteeIds: [MEMBER_A2] });
    await updateAs(FIXTURE_MEMBER.id, id, { scope: "named", inviteeIds: [MEMBER_A2, MEMBER_B2] });
    expect(await kinds(MEMBER_A2, id)).not.toContain("event_updated");

    await updateAs(FIXTURE_ADMIN.id, id, { name: "Admin rename", scope: "named", inviteeIds: [MEMBER_A2, MEMBER_B2] });
    expect(await kinds(MEMBER_A2, id)).toContain("event_updated");
    expect(await kinds(FIXTURE_MEMBER.id, id)).not.toContain("event_updated");
  });

  it("AC-6: a cancellation reaches everyone taking part, survives the event, names it, and leads nowhere", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { name: "Picnic", requiresApproval: true });
    await joinAs(MEMBER_A2, id);
    await joinAs(MEMBER_B2, id);
    await decideAs(FIXTURE_MEMBER.id, id, MEMBER_A2, "attending");
    await joinAs(FIXTURE_OTHER_TEAM_MEMBER.id, id);
    await decideAs(FIXTURE_MEMBER.id, id, FIXTURE_OTHER_TEAM_MEMBER.id, "rejected");

    as(FIXTURE_ADMIN.id);
    expect((await mock.deleteEvent(id)).ok).toBe(true);

    for (const who of [MEMBER_A2, MEMBER_B2]) {
      const cancelled = (await inbox(who)).filter((n) => n.kind === "event_cancelled");
      expect(cancelled).toHaveLength(1);
      expect(cancelled[0]).toMatchObject({ eventId: null, eventName: "Picnic", actorId: FIXTURE_ADMIN.id });
    }
    // Rejected no longer takes part; the creator did not take part.
    expect((await inbox(FIXTURE_OTHER_TEAM_MEMBER.id)).some((n) => n.kind === "event_cancelled")).toBe(false);
    expect((await inbox(FIXTURE_MEMBER.id)).some((n) => n.kind === "event_cancelled")).toBe(false);
    // The cascade sent no withdrawal.
    expect((await inbox(FIXTURE_MEMBER.id)).some((n) => n.kind === "attendance_withdrawn")).toBe(false);
  });

  it("AC-7: the creator learns of a request and a withdrawal; not of an instant join, nor of their own", async () => {
    const needs = await createAs(FIXTURE_MEMBER.id, { requiresApproval: true });
    await joinAs(MEMBER_A2, needs);
    expect(await kinds(FIXTURE_MEMBER.id, needs)).toEqual(["attendance_requested"]);
    as(MEMBER_A2);
    expect((await mock.leaveEvent(needs)).ok).toBe(true); // cancels the pending request
    expect(await kinds(FIXTURE_MEMBER.id, needs)).toEqual(["attendance_withdrawn", "attendance_requested"]);

    const open = await createAs(FIXTURE_MEMBER.id);
    await joinAs(MEMBER_B2, open);
    expect(await kinds(FIXTURE_MEMBER.id, open)).toEqual([]);
    as(MEMBER_B2);
    expect((await mock.leaveEvent(open)).ok).toBe(true);
    expect(await kinds(FIXTURE_MEMBER.id, open)).toEqual(["attendance_withdrawn"]);

    // The creator joining and leaving their own event.
    await joinAs(FIXTURE_MEMBER.id, needs);
    as(FIXTURE_MEMBER.id);
    expect((await mock.leaveEvent(needs)).ok).toBe(true);
    expect(await kinds(FIXTURE_MEMBER.id, needs)).toEqual(["attendance_withdrawn", "attendance_requested"]);
  });

  it("AC-8: never to someone who cannot read the event — a rejected or removed person off the named list hears nothing", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "named", requiresApproval: true, inviteeIds: [MEMBER_B2, FIXTURE_OTHER_TEAM_MEMBER.id] });
    await joinAs(MEMBER_B2, id);
    await joinAs(FIXTURE_OTHER_TEAM_MEMBER.id, id);
    await decideAs(FIXTURE_MEMBER.id, id, FIXTURE_OTHER_TEAM_MEMBER.id, "attending");
    // Both taken off the list; they still read it while they take part (EVT-02 AC-5).
    await updateAs(FIXTURE_MEMBER.id, id, { scope: "named", requiresApproval: true, inviteeIds: [] });

    await decideAs(FIXTURE_MEMBER.id, id, MEMBER_B2, "rejected");
    await decideAs(FIXTURE_MEMBER.id, id, FIXTURE_OTHER_TEAM_MEMBER.id, "removed");
    expect(await kinds(MEMBER_B2, id)).toEqual(["event_invited"]);
    // The approval, while they were still named, did reach them; the removal does not.
    expect(await kinds(FIXTURE_OTHER_TEAM_MEMBER.id, id)).toEqual(["attendance_approved", "event_invited"]);

    // Never to a pending or rejected sign-up — they are not in any recipient set at all.
    await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    for (const who of [PENDING, REJECTED]) expect(await inbox(who)).toEqual([]);
  });

  it("AC-9: never to the actor, and nothing from a write with no signed-in person", async () => {
    // A write with no session is refused by the seam before anything — and `notify` writes nothing
    // when `auth.uid()` is null, which the migration asserts.
    as(null);
    expect((await mock.createEvent(input())).ok).toBe(false);
    expect(functionBody("notify")).toMatch(/if v_actor is null then\s+return;/);
    expect(functionBody("notify")).toMatch(/r\.member_id <> v_actor/);
    expect(functionBody("notify")).toMatch(/v_actor uuid := \(select auth\.uid\(\)\)/);
  });

  it("AC-10: one row per recipient per write — an admin who also attends gets one event_updated", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    await joinAs(FIXTURE_ADMIN.id, id);
    await updateAs(FIXTURE_MEMBER.id, id, { name: "Moved" });
    expect((await kinds(FIXTURE_ADMIN.id, id)).filter((k) => k === "event_updated")).toHaveLength(1);
    expect(functionBody("notify")).toMatch(/select distinct unnest/);
  });
});

// ---------------------------------------------------------------------------------------------
describe("reading them", () => {
  it("AC-11: each reads exactly their own; no admin reads, counts or marks another's", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    const mine = (await inbox(MEMBER_A2)).filter((n) => n.eventId === id);
    expect(mine).toHaveLength(1);
    expect(mine.every((n) => n.recipientId === MEMBER_A2)).toBe(true);

    // The admin sees their own row and not MEMBER_A2's.
    const adminRows = await inbox(FIXTURE_ADMIN.id);
    expect(adminRows.every((n) => n.recipientId === FIXTURE_ADMIN.id)).toBe(true);
    expect(adminRows.some((n) => n.id === mine[0]?.id)).toBe(false);

    // The admin marks MEMBER_A2's row: ok, and nothing changes.
    as(FIXTURE_ADMIN.id);
    expect((await mock.markNotificationRead(mine[0]!.id)).ok).toBe(true);
    as(MEMBER_A2);
    expect(await mock.countUnreadNotifications()).toBe(1);
    expect((await mock.listNotifications())[0]?.readAt).toBeNull();

    expect(statement("create policy notification_select_own")).not.toMatch(/is_admin/);
    expect(statement("create policy notification_update_own")).not.toMatch(/is_admin/);
    expect(statement("create policy notification_select_own")).toMatch(
      /recipient_id = \(select auth\.uid\(\)\)\s+and public\.member_team_id\(\(select auth\.uid\(\)\)\) is not null/,
    );
  });

  it("AC-11: a removed member reads none, including ones written before the removal", async () => {
    const leaver = await approved("Notify Leaver", FIXTURE_TEAM.id);
    await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    as(leaver);
    expect(await mock.countUnreadNotifications()).toBe(1);
    as(FIXTURE_ADMIN.id);
    expect((await mock.removeMember(leaver)).ok).toBe(true);
    as(leaver);
    expect(await mock.listNotifications()).toEqual([]);
    expect(await mock.countUnreadNotifications()).toBe(0);
    expect(await mock.markAllNotificationsRead()).toEqual({ ok: true, value: 0 });
  });

  it("AC-12: nobody inserts, deletes, or changes a column other than read_at — no grant exists", async () => {
    expect(SQL).toMatch(/revoke all on public\.notification from anon, authenticated;/);
    expect(SQL).toMatch(/grant select on public\.notification to authenticated;/);
    expect(SQL).toMatch(/grant update \(read_at\) on public\.notification to authenticated;/);
    expect(SQL).not.toMatch(/grant[^;]*insert[^;]*on public\.notification/);
    expect(SQL).not.toMatch(/grant[^;]*delete[^;]*on public\.notification/);
    expect(SQL).not.toMatch(/create policy \w+ on public\.notification\s+for (insert|delete)/);
    // `notify` is executable by no session.
    expect(SQL).not.toMatch(/grant execute on function public\.notify\(/);
    expect(SQL).toMatch(
      /revoke all on function public\.notify\(uuid\[\], public\.notification_kind, uuid, text\) from public, anon, authenticated;/,
    );
    // The seam has no function that writes one.
    expect(Object.keys(mock).filter((k) => /notification/i.test(k)).sort()).toEqual([
      "countUnreadNotifications",
      "listNotifications",
      "markAllNotificationsRead",
      "markNotificationRead",
    ]);
  });

  it("AC-13: the count counts exactly the unread", async () => {
    await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    as(MEMBER_A2);
    expect(await mock.countUnreadNotifications()).toBe(2);
    const [first] = await mock.listNotifications();
    await mock.markNotificationRead(first!.id);
    expect(await mock.countUnreadNotifications()).toBe(1);
    // Marking an already-read one is ok and changes nothing.
    expect((await mock.markNotificationRead(first!.id)).ok).toBe(true);
    expect(await mock.countUnreadNotifications()).toBe(1);
  });

  it("AC-14: newest first, and marking one read sets readAt on that one only", async () => {
    const first = await createAs(FIXTURE_MEMBER.id, { name: "First", scope: "team" });
    const second = await createAs(FIXTURE_MEMBER.id, { name: "Second", scope: "team" });
    const rows = await inbox(MEMBER_A2);
    expect(rows.map((n) => n.eventId)).toEqual([second, first]);
    as(MEMBER_A2);
    await mock.markNotificationRead(rows[1]!.id);
    const after = await mock.listNotifications();
    expect(after[0]?.readAt).toBeNull();
    expect(after[1]?.readAt).not.toBeNull();
  });

  it("AC-15: mark all read marks every unread row — beyond the window too — and returns how many", async () => {
    for (let i = 0; i < NOTIFICATION_LIMIT + 3; i++) await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    as(MEMBER_A2);
    expect(await mock.markAllNotificationsRead()).toEqual({ ok: true, value: NOTIFICATION_LIMIT + 3 });
    expect(await mock.countUnreadNotifications()).toBe(0);
    expect(await mock.markAllNotificationsRead()).toEqual({ ok: true, value: 0 });
    expect(functionBody("mark_notifications_read")).toMatch(/security invoker/);
    expect(functionBody("mark_notifications_read")).toMatch(/set read_at = now\(\)/);
  });

  it("AC-16: the 50 newest are listed, the count counts all; none is an empty list", async () => {
    expect(NOTIFICATION_LIMIT).toBe(50);
    expect(await inbox(MEMBER_A2)).toEqual([]);
    for (let i = 0; i < NOTIFICATION_LIMIT + 2; i++) {
      await createAs(FIXTURE_MEMBER.id, { name: `E${i}`, scope: "team" });
    }
    const rows = await inbox(MEMBER_A2);
    expect(rows).toHaveLength(NOTIFICATION_LIMIT);
    expect(rows[0]?.eventName).toBe(`E${NOTIFICATION_LIMIT + 1}`);
    as(MEMBER_A2);
    expect(await mock.countUnreadNotifications()).toBe(NOTIFICATION_LIMIT + 2);
  });

  it("AC-18: a notification for an event the recipient can no longer read still exists, and the event reads as not found", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [MEMBER_B2] });
    await updateAs(FIXTURE_MEMBER.id, id, { scope: "named", inviteeIds: [] });
    const rows = await inbox(MEMBER_B2);
    expect(rows.map((n) => [n.kind, n.eventId])).toEqual([["event_invited", id]]);
    as(MEMBER_B2);
    expect(await mock.getEvent(id)).toBeNull();
  });
});

// ---------------------------------------------------------------------------------------------
describe("the sentences", () => {
  it("AC-14: one English sentence per kind, as § 4.4 fixes", () => {
    const table: Record<NotificationKind, string> = {
      event_created: "Lan announced Picnic.",
      event_invited: "Lan invited you to Picnic.",
      event_updated: "Lan changed Picnic.",
      event_cancelled: "Lan cancelled Picnic.",
      attendance_requested: "Lan asked to join Picnic.",
      attendance_withdrawn: "Lan withdrew from Picnic.",
      attendance_approved: "Your request to join Picnic was approved.",
      attendance_rejected: "Your request to join Picnic was declined.",
      attendance_removed: "You were removed from Picnic.",
    };
    for (const [kind, sentence] of Object.entries(table)) {
      expect(notificationSentence(kind as NotificationKind, "Lan", "Picnic")).toBe(sentence);
    }
    expect(notificationSentence("event_created", "Former member", "Picnic")).toBe("Former member announced Picnic.");
  });
});

// ---------------------------------------------------------------------------------------------
describe("the migration", () => {
  it("defines the enum's nine values, the table's eight columns and the set-null reference", () => {
    expect(SQL).toMatch(
      /'event_created', 'event_invited', 'event_updated', 'event_cancelled',\s+'attendance_requested', 'attendance_withdrawn',\s+'attendance_approved', 'attendance_rejected', 'attendance_removed'/,
    );
    expect(SQL).toMatch(/event_id\s+uuid null references public\.event\(id\) on delete set null/);
    expect(SQL).toMatch(/recipient_id uuid not null references public\.member\(id\),/);
    expect(SQL).toMatch(/actor_id\s+uuid not null references public\.member\(id\),/);
    expect(SQL).toMatch(/on public\.notification \(recipient_id, created_at desc\)/);
  });

  it("has seven triggers with the plan's timing, and the cancellation runs before delete", () => {
    expect(statement("create trigger notify_event_created")).toMatch(/after insert on public\.event\b/);
    expect(statement("create trigger notify_event_updated")).toMatch(/after update on public\.event\b/);
    expect(statement("create trigger notify_event_cancelled")).toMatch(/before delete on public\.event\b/);
    expect(statement("create trigger notify_event_invited")).toMatch(/after insert on public\.event_invitee/);
    expect(statement("create trigger notify_attendance_inserted")).toMatch(/when \(new\.status = 'pending'/);
    expect(statement("create trigger notify_attendance_changed")).toMatch(/after update of status on public\.event_attendance/);
    expect(statement("create trigger notify_attendance_deleted")).toMatch(/after delete on public\.event_attendance/);
    expect(functionBody("notify_attendance_deleted")).toMatch(/old\.member_id is distinct from \(select auth\.uid\(\)\)/);
    const updated = statement("create trigger notify_event_updated");
    for (const column of [
      "name", "description", "location", "start_date", "end_date", "scope", "capacity",
      "requires_approval", "registration_deadline",
    ]) {
      expect(updated).toMatch(new RegExp(`old\\.${column}\\s+is distinct from new\\.${column}`));
    }
    expect(functionBody("notify")).toMatch(
      /case when p_kind = 'event_cancelled'::public\.notification_kind then null else p_event_id end/,
    );
  });

  it("may_read_event is event_select_visible's predicate, clause for clause, keyed on p_uid", () => {
    const policyBody = statement("create policy event_select_visible", strip(EVT02))
      .replace(/\(select auth\.uid\(\)\)/g, "UID")
      .replace(/\b(creator_id|scope|team_id|id)\b/g, "e.$1");
    const helper = functionBody("may_read_event").replace(/p_uid/g, "UID");
    const clauses = [
      "public.member_team_id(UID) is not null",
      "public.is_admin(UID)",
      "e.creator_id = UID",
      "e.scope = 'public'::public.event_scope",
      "e.team_id = public.member_team_id(UID)",
      "public.is_event_invitee(e.id, UID)",
      "public.is_event_participant(e.id, UID)",
    ];
    for (const clause of clauses) {
      expect(policyBody.replace(/\s+/g, " ")).toContain(clause);
      expect(helper.replace(/\s+/g, " ")).toContain(clause);
    }
  });

  it("AC-19 / INV-04: no policy on public.member, and listMembers returns the same before and after a fan-out", async () => {
    expect(SQL).not.toMatch(/policy[^;]*on public\.member\b/);
    as(FIXTURE_ADMIN.id);
    const before = await mock.listMembers();
    await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    as(FIXTURE_ADMIN.id);
    expect(await mock.listMembers()).toEqual(before);
  });
});
