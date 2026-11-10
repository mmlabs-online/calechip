// EVT-07 — guest registration. Every acceptance criterion that is a property of the data, through the
// mock seam, and the migration read for its shape.
//
// **THE MOCK REPRODUCES `supabase/migrations/20261009150000_evt07_guest_registration.sql`; IT CANNOT
// PROVE IT.** `tests/permission-model.test.ts` and the concurrency test against a real PostgreSQL are
// still owed project-wide (.ai/standards/rbac-and-security.md § Known weaknesses 1). The lock that
// holds the cap (AC-10) is asserted by reading the migration; `Promise.all` against the mock proves
// only the DECISION.
//
// **PEOPLE.** Fixtures as they are; anyone else is created through the seam as a person would be
// (sign up, then an admin decides), as `tests/guest-link.test.ts` does. No fixture file is edited.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SaveEventInput } from "@/lib/data";
import { seam as mock, __resetEvents, __setCurrentMember } from "@/lib/data/mock";
import { seam as real } from "@/lib/data/supabase";
import { GUEST_EMAIL_MAX, GUEST_NAME_MAX } from "@/lib/domain/types";
import { guestManageUrl, guestRegistrationProblem } from "@/routes/GuestEvent";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

const MIGRATION = readFileSync(
  fileURLToPath(
    new URL("../supabase/migrations/20261009150000_evt07_guest_registration.sql", import.meta.url),
  ),
  "utf8",
);

/** The migration with its `--` comments removed — the assertions are about the statements. */
const MIGRATION_SQL = MIGRATION.replace(/--[^\n]*/g, "");

const input = (overrides: Partial<SaveEventInput> = {}): SaveEventInput => ({
  name: "Guest dinner",
  description: null,
  location: null,
  startDate: "2099-05-10",
  endDate: "2099-05-10",
  scope: "public",
  inviteeIds: [],
  ...overrides,
});

const code = (result: { ok: boolean; error?: { code: string } }): string | null =>
  result.ok ? null : (result.error?.code ?? null);

async function createAs(memberId: string, overrides: Partial<SaveEventInput> = {}): Promise<string> {
  as(memberId);
  const result = await mock.createEvent(input(overrides));
  if (!result.ok) throw new Error(`createEvent refused: ${result.error.code}`);
  return result.value.id;
}

async function tokenOf(memberId: string, eventId: string): Promise<string> {
  as(memberId);
  const opened = await mock.openEventToGuests(eventId);
  if (!opened.ok) throw new Error(`openEventToGuests refused: ${opened.error.code}`);
  return opened.value.token;
}

/** An event the creator made and opened. Returns its id and its guest link token. */
async function openedEvent(overrides: Partial<SaveEventInput> = {}): Promise<{ id: string; token: string }> {
  const id = await createAs(FIXTURE_MEMBER.id, overrides);
  return { id, token: await tokenOf(FIXTURE_MEMBER.id, id) };
}

async function register(token: string, name: string, email: string): Promise<string> {
  as(null);
  const result = await mock.registerGuest(token, name, email);
  if (!result.ok) throw new Error(`registerGuest refused: ${result.error.code}`);
  return result.value.manageToken;
}

async function joinAs(memberId: string, eventId: string): Promise<void> {
  as(memberId);
  const joined = await mock.joinEvent(eventId);
  if (!joined.ok) throw new Error(`joinEvent refused: ${joined.error.code}`);
}

async function guestsAs(memberId: string | null, eventId: string) {
  as(memberId);
  return mock.listEventGuests(eventId);
}

async function guestIdOf(eventId: string, name: string): Promise<string> {
  const found = (await guestsAs(FIXTURE_MEMBER.id, eventId)).find((g) => g.name === name);
  if (!found) throw new Error(`${name} is not a guest the creator can see`);
  return found.id;
}

async function signUp(displayName: string): Promise<string> {
  const email = `${displayName.toLowerCase().replace(/\s+/g, ".")}@evt07.example.com`;
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

const pause = (): Promise<void> => new Promise((r) => setTimeout(r, 2));

let MANAGER_A = "";
let MEMBER_A2 = "";
let MEMBER_B2 = "";

beforeAll(async () => {
  MANAGER_A = await approved("Reg Manager", FIXTURE_TEAM.id);
  as(FIXTURE_ADMIN.id);
  const promoted = await mock.setMemberRole(MANAGER_A, "manager");
  if (!promoted.ok) throw new Error("could not make a manager");
  MEMBER_A2 = await approved("Reg Second", FIXTURE_TEAM.id);
  MEMBER_B2 = await approved("Reg B Two", FIXTURE_OTHER_TEAM.id);
  as(null);
});

afterEach(() => {
  __resetEvents();
  as(null);
});

describe("registering (AC-1 to AC-10)", () => {
  it("AC-1: signed out, a guest on an event needing no approval is going, listed and counted", async () => {
    const { id, token } = await openedEvent({ capacity: 5 });
    as(null);
    const result = await mock.registerGuest(token, "Mai Anh", "mai@example.com");
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("attending");
    expect(result.value.manageToken).toMatch(/^[0-9a-f]{64}$/);
    expect(guestManageUrl("https://cale.example", result.value.manageToken)).toBe(
      `https://cale.example/guest/registration/${result.value.manageToken}`,
    );

    const read = await mock.getGuestEvent(token);
    expect(read?.attendeeNames).toEqual(["Mai Anh"]);
    expect(read?.seatsTaken).toBe(1);

    const members = await guestsAs(MEMBER_A2, id);
    expect(members.map((g) => [g.name, g.status])).toEqual([["Mai Anh", "attending"]]);
  });

  it("AC-2: approval required — pending, unlisted, uncounted, and accepted even when full", async () => {
    const { id, token } = await openedEvent({ capacity: 1, requiresApproval: true });
    as(FIXTURE_MEMBER.id);
    expect(await mock.getGuestRegistrationTerms(token)).toEqual({
      requiresApproval: true,
      registrationOpen: true,
    });
    await joinAs(MEMBER_A2, id);
    as(FIXTURE_MEMBER.id);
    expect((await mock.decideAttendance(id, MEMBER_A2, "attending")).ok).toBe(true); // now full

    as(null);
    const result = await mock.registerGuest(token, "Waiting Guest", "wait@example.com");
    expect(result.ok && result.value.status).toBe("pending");
    const read = await mock.getGuestEvent(token);
    expect(read?.attendeeNames).not.toContain("Waiting Guest");
    expect(read?.seatsTaken).toBe(1);
  });

  it("AC-3: the manage token is returned once, stored only as its hash, and no read returns it", async () => {
    const { id, token } = await openedEvent();
    const manageToken = await register(token, "Once", "once@example.com");
    for (const who of [FIXTURE_MEMBER.id, FIXTURE_ADMIN.id, MEMBER_A2, null]) {
      as(who);
      const everything = JSON.stringify([
        await mock.listEventGuests(id),
        await mock.getGuestEvent(token),
        await mock.getGuestRegistrationTerms(token),
        await mock.getGuestRegistration(manageToken),
        await mock.listEventAttendance(id),
        await mock.getEvent(id),
      ]);
      expect(everything).not.toContain(manageToken);
    }
    expect(MIGRATION_SQL).toMatch(/manage_token_hash text not null unique/);
    expect(MIGRATION_SQL).toMatch(/encode\(sha256\(convert_to\(v_token, 'UTF8'\)\), 'hex'\)/);
    expect(MIGRATION_SQL).not.toMatch(/manage_token\s+text\s+(not null|null)/);
    expect(MIGRATION_SQL).toMatch(
      /grant select \(id, event_id, name, status, created_at, updated_at\) on public\.event_guest to authenticated;/,
    );
  });

  it("AC-4: a blank or long name, a long or malformed email are refused; values are stored trimmed, case kept", async () => {
    const { id, token } = await openedEvent();
    as(null);
    const long = "a".repeat(GUEST_NAME_MAX + 1);
    const longEmail = `${"b".repeat(GUEST_EMAIL_MAX)}@x.vn`;
    expect(code(await mock.registerGuest(token, "   ", "a@b.co"))).toBe("invalid_guest_name");
    expect(code(await mock.registerGuest(token, long, "a@b.co"))).toBe("invalid_guest_name");
    for (const bad of ["", "no-at.example.com", "a@b", "a b@c.co", "a@b c.co", longEmail]) {
      expect(code(await mock.registerGuest(token, "Ok", bad))).toBe("invalid_guest_email");
    }
    expect(guestRegistrationProblem("  ", "a@b.co")).toBe("invalid_guest_name");
    expect(guestRegistrationProblem(long, "a@b.co")).toBe("invalid_guest_name");
    expect(guestRegistrationProblem("Ok", "a@b")).toBe("invalid_guest_email");
    expect(guestRegistrationProblem(" Ok ", " a@b.co ")).toBeNull();
    expect(await guestsAs(FIXTURE_MEMBER.id, id)).toEqual([]);

    expect(code(await mock.registerGuest(token, "  Lan  ", "  Lan@Example.COM "))).toBeNull();
    const [row] = await guestsAs(FIXTURE_MEMBER.id, id);
    expect(row?.name).toBe("Lan");
    expect(row?.email).toBe("Lan@Example.COM");
    // The database's checks are the control.
    expect(MIGRATION_SQL).toMatch(/char_length\(name\) <= 100/);
    expect(MIGRATION_SQL).toMatch(/char_length\(email\) <= 254/);
    expect(MIGRATION_SQL).toMatch(/errcode = 'EV006'/);
    expect(MIGRATION_SQL).toMatch(/errcode = 'EV007'/);
  });

  it("AC-5, AC-9: one registration per email per event, in any case, any state — another event is fine", async () => {
    const { id, token } = await openedEvent({ requiresApproval: true });
    const other = await openedEvent();
    await register(token, "First", "dup@example.com");
    as(null);
    expect(code(await mock.registerGuest(token, "Again", " DUP@example.com "))).toBe(
      "guest_already_registered",
    );
    expect(code(await mock.registerGuest(other.token, "Elsewhere", "dup@example.com"))).toBeNull();

    // Rejected, removed and cancelled are final for that email.
    const rejected = await guestIdOf(id, "First");
    as(FIXTURE_MEMBER.id);
    expect((await mock.decideGuest(rejected, "rejected")).ok).toBe(true);
    as(null);
    expect(code(await mock.registerGuest(token, "Third", "dup@example.com"))).toBe(
      "guest_already_registered",
    );

    const removedTok = await register(other.token, "Removable", "rm@example.com");
    const removedId = await guestIdOf(other.id, "Removable");
    as(FIXTURE_MEMBER.id);
    expect((await mock.decideGuest(removedId, "removed")).ok).toBe(true);
    as(null);
    expect(code(await mock.registerGuest(other.token, "Back", "rm@example.com"))).toBe(
      "guest_already_registered",
    );
    expect((await mock.getGuestRegistration(removedTok))?.status).toBe("removed");

    const cancelTok = await register(other.token, "Leaver", "bye@example.com");
    expect((await mock.cancelGuestRegistration(cancelTok)).ok).toBe(true);
    expect(code(await mock.registerGuest(other.token, "Leaver", "bye@example.com"))).toBe(
      "guest_already_registered",
    );
    expect(MIGRATION_SQL).toMatch(
      /create unique index if not exists event_guest_event_email on public\.event_guest \(event_id, lower\(email\)\);/,
    );
  });

  it("AC-6: full refuses a guest, and members' seats count", async () => {
    const { id, token } = await openedEvent({ capacity: 1 });
    await joinAs(MEMBER_A2, id);
    as(null);
    expect(code(await mock.registerGuest(token, "Late", "late@example.com"))).toBe("event_full");
    expect(await guestsAs(FIXTURE_MEMBER.id, id)).toEqual([]);
  });

  it("AC-7: closed registration refuses; the terms read says so", async () => {
    const { token } = await openedEvent({ startDate: "2001-01-01", endDate: "2001-01-02" });
    as(null);
    expect((await mock.getGuestRegistrationTerms(token))?.registrationOpen).toBe(false);
    expect(code(await mock.registerGuest(token, "Late", "late@example.com"))).toBe(
      "event_registration_closed",
    );
  });

  it("AC-8: never-existed, malformed, closed and deleted links are one answer; closing keeps registrations", async () => {
    const closed = await openedEvent();
    const keptTok = await register(closed.token, "Kept", "kept@example.com");
    as(FIXTURE_MEMBER.id);
    expect((await mock.closeEventToGuests(closed.id)).ok).toBe(true);

    const gone = await openedEvent();
    as(FIXTURE_MEMBER.id);
    expect((await mock.deleteEvent(gone.id)).ok).toBe(true);

    as(null);
    for (const token of ["0".repeat(64), "short", "", closed.token.toUpperCase(), closed.token, gone.token]) {
      const result = await mock.registerGuest(token, "Nobody", "nobody@example.com");
      expect(code(result)).toBe("guest_link_not_found");
      if (!result.ok) expect(result.error.message).toBe("This link does not work.");
      expect(await mock.getGuestRegistrationTerms(token)).toBeNull();
    }
    // The real seam answers a malformed token before building a client.
    expect(code(await real.registerGuest("short", "A", "a@b.co"))).toBe("guest_link_not_found");
    expect(await real.getGuestRegistrationTerms("short")).toBeNull();

    // The registration made before closing is untouched: counted, listed, manageable.
    expect((await guestsAs(MEMBER_A2, closed.id)).map((g) => g.name)).toEqual(["Kept"]);
    as(null);
    expect((await mock.getGuestRegistration(keptTok))?.status).toBe("attending");
    expect((await mock.cancelGuestRegistration(keptTok)).ok).toBe(true);
  });

  it("AC-10: one seat, any two writers at once — exactly one takes it", async () => {
    type Writer = (ctx: { id: string; token: string; pendingGuest: string }) => Promise<{ ok: boolean }>;
    const writers: Record<string, Writer> = {
      guest: async ({ token }) => mock.registerGuest(token, "Racer", `racer${Math.random()}@x.vn`),
      member: async ({ id }) => {
        as(MEMBER_A2);
        return mock.joinEvent(id);
      },
      approveGuest: async ({ pendingGuest }) => {
        as(FIXTURE_MEMBER.id);
        return mock.decideGuest(pendingGuest, "attending");
      },
    };
    const names = Object.keys(writers);
    for (const a of names) {
      for (const b of names) {
        if (a === b && a !== "guest") continue;
        // An event needing no approval; a pending guest is planted by flipping approval on and off.
        const id = await createAs(FIXTURE_MEMBER.id, { capacity: 1, requiresApproval: true });
        const token = await tokenOf(FIXTURE_MEMBER.id, id);
        await register(token, "Pending", `pending${Math.random()}@x.vn`);
        const pendingGuest = await guestIdOf(id, "Pending");
        as(FIXTURE_MEMBER.id);
        expect((await mock.updateEvent(id, input({ capacity: 1, requiresApproval: false }))).ok).toBe(true);

        const results = await Promise.all([writers[a]!({ id, token, pendingGuest }), writers[b]!({ id, token, pendingGuest })]);
        expect(results.filter((r) => r.ok)).toHaveLength(1);
        as(null);
        expect((await mock.getGuestEvent(token))?.seatsTaken).toBe(1);
        __resetEvents();
      }
    }
  });

  it("AC-10: capacity cannot drop below seats taken counting guests; every guard counts both tables under the lock", async () => {
    const { id, token } = await openedEvent({ capacity: 3 });
    await joinAs(MEMBER_A2, id);
    await register(token, "G1", "g1@example.com");
    as(FIXTURE_MEMBER.id);
    expect(code(await mock.updateEvent(id, input({ capacity: 1 })))).toBe("event_capacity_below_attendees");
    expect((await mock.updateEvent(id, input({ capacity: 2 }))).ok).toBe(true);
    as(null);
    expect(code(await mock.registerGuest(token, "G2", "g2@example.com"))).toBe("event_full");

    // The lock is the first statement of the guest guard, and both EVT-02 guards count guests.
    const guard = MIGRATION_SQL.slice(
      MIGRATION_SQL.indexOf("create or replace function public.event_guest_guard()"),
      MIGRATION_SQL.indexOf("drop trigger if exists event_guest_guard"),
    );
    expect(guard).toMatch(/select \* into v_event from public\.event where id = new\.event_id for update;/);
    expect(guard).toMatch(/from public\.event_attendance a/);
    const attendanceGuard = MIGRATION_SQL.slice(
      MIGRATION_SQL.indexOf("create or replace function public.event_attendance_guard()"),
      MIGRATION_SQL.indexOf("create or replace function public.event_capacity_guard()"),
    );
    expect(attendanceGuard).toMatch(/for update;/);
    expect(attendanceGuard).toMatch(/from public\.event_guest g/);
    const capacityGuard = MIGRATION_SQL.slice(
      MIGRATION_SQL.indexOf("create or replace function public.event_capacity_guard()"),
      MIGRATION_SQL.indexOf("create or replace function public.get_guest_event("),
    );
    expect(capacityGuard).toMatch(/from public\.event_guest g/);
  });
});

describe("the manage page (AC-11 to AC-13)", () => {
  it("AC-11: the registration reads event, dates, location, name and state — nothing else", async () => {
    const { token } = await openedEvent({ location: "Hoi An", startDate: "2099-06-01", endDate: "2099-06-02" });
    const manageToken = await register(token, "Reader", "reader@example.com");
    for (const who of [null, FIXTURE_OTHER_TEAM_MEMBER.id]) {
      as(who);
      const view = await mock.getGuestRegistration(manageToken);
      expect(view).toEqual({
        eventName: "Guest dinner",
        startDate: "2099-06-01",
        endDate: "2099-06-02",
        location: "Hoi An",
        guestName: "Reader",
        status: "attending",
        registrationOpen: true,
        eventDeleted: false,
      });
    }
    expect(MIGRATION_SQL).toMatch(
      /returns table \(event_name text, start_date date, end_date date, location text,\s+guest_name text, status public\.guest_status,\s+registration_open boolean, event_deleted boolean\)/,
    );
  });

  it("AC-12: cancel while open frees the seat; then no second cancel; closed refuses", async () => {
    const { id, token } = await openedEvent({ capacity: 2 });
    const manageToken = await register(token, "Canceller", "c@example.com");
    as(null);
    expect((await mock.getGuestEvent(token))?.seatsTaken).toBe(1);
    expect((await mock.cancelGuestRegistration(manageToken)).ok).toBe(true);
    expect((await mock.getGuestRegistration(manageToken))?.status).toBe("cancelled");
    expect((await mock.getGuestEvent(token))?.seatsTaken).toBe(0);
    expect((await mock.getGuestEvent(token))?.attendeeNames).toEqual([]);
    expect((await guestsAs(MEMBER_A2, id)).length).toBe(0);
    as(null);
    expect(code(await mock.cancelGuestRegistration(manageToken))).toBe("invalid_attendance_change");

    // Closed: a registration made while open cannot be cancelled once the deadline passes.
    const past = await createAs(FIXTURE_MEMBER.id, { startDate: "2099-07-01", endDate: "2099-07-01" });
    const pastToken = await tokenOf(FIXTURE_MEMBER.id, past);
    const pastManage = await register(pastToken, "Stuck", "stuck@example.com");
    as(FIXTURE_MEMBER.id);
    expect(
      (await mock.updateEvent(past, input({ startDate: "2001-01-01", endDate: "2001-01-01" }))).ok,
    ).toBe(true);
    as(null);
    expect((await mock.getGuestRegistration(pastManage))?.registrationOpen).toBe(false);
    expect(code(await mock.cancelGuestRegistration(pastManage))).toBe("event_registration_closed");
  });

  it("AC-13: an unknown or malformed manage token is one answer", async () => {
    as(null);
    for (const t of ["0".repeat(64), "short", "", "G".repeat(64)]) {
      expect(await mock.getGuestRegistration(t)).toBeNull();
      const result = await mock.cancelGuestRegistration(t);
      expect(code(result)).toBe("guest_registration_not_found");
      if (!result.ok) expect(result.error.message).toBe("This link does not work.");
    }
    expect(await real.getGuestRegistration("short")).toBeNull();
    expect(code(await real.cancelGuestRegistration("short"))).toBe("guest_registration_not_found");
  });
});

describe("what members see (AC-14 to AC-18)", () => {
  it("AC-14: attending guests by name to every reader, in join order with members; others hidden", async () => {
    const { id, token } = await openedEvent({ capacity: 10, requiresApproval: false });
    await joinAs(MEMBER_A2, id);
    await pause();
    await register(token, "Guest One", "one@example.com");
    await pause();
    await joinAs(MEMBER_B2, id);
    await pause();
    const cancelled = await register(token, "Guest Gone", "gone@example.com");
    as(null);
    expect((await mock.cancelGuestRegistration(cancelled)).ok).toBe(true);

    as(null);
    const read = await mock.getGuestEvent(token);
    expect(read?.attendeeNames).toEqual(["Reg Second", "Guest One", "Reg B Two"]);
    expect(read?.seatsTaken).toBe(3);

    for (const who of [MEMBER_A2, MEMBER_B2, MANAGER_A]) {
      const guests = await guestsAs(who, id);
      expect(guests.map((g) => [g.name, g.status, g.email])).toEqual([["Guest One", "attending", null]]);
    }
  });

  it("AC-15: only the creator and admins read emails; everyone else, and signed out, get null or nothing", async () => {
    const { id, token } = await openedEvent({ requiresApproval: true });
    await register(token, "Private", "private@example.com");
    for (const who of [FIXTURE_MEMBER.id, FIXTURE_ADMIN.id]) {
      const guests = await guestsAs(who, id);
      expect(guests.map((g) => [g.name, g.email, g.status])).toEqual([
        ["Private", "private@example.com", "pending"],
      ]);
    }
    // A pending guest is not visible to a non-manager, a manager as such, or signed out.
    for (const who of [MEMBER_A2, MANAGER_A, MEMBER_B2, null]) {
      expect(await guestsAs(who, id)).toEqual([]);
    }
    const guestId = await guestIdOf(id, "Private");
    as(FIXTURE_MEMBER.id);
    expect((await mock.decideGuest(guestId, "attending")).ok).toBe(true);
    for (const who of [MEMBER_A2, MANAGER_A, MEMBER_B2]) {
      const guests = await guestsAs(who, id);
      expect(guests).toHaveLength(1);
      expect(guests[0]?.email).toBeNull();
    }
    expect(await guestsAs(null, id)).toEqual([]);
    // The email function answers the creator and admins only and is not anon's.
    expect(MIGRATION_SQL).toMatch(/public\.may_manage_event\(p_event_id, \(select auth\.uid\(\)\)\)/);
    expect(MIGRATION_SQL).toMatch(/grant execute on function public\.list_event_guest_emails\(uuid\) to authenticated;/);
    expect(MIGRATION_SQL).not.toMatch(/may_decide/);
  });

  it("AC-16: the creator and admins approve and reject; full refuses approval; deciding outlives registration", async () => {
    const { id, token } = await openedEvent({ capacity: 1, requiresApproval: true });
    const aTok = await register(token, "Ask A", "a@example.com");
    const bTok = await register(token, "Ask B", "b@example.com");
    const a = await guestIdOf(id, "Ask A");
    const b = await guestIdOf(id, "Ask B");

    as(FIXTURE_ADMIN.id);
    const approvedA = await mock.decideGuest(a, "attending");
    expect(approvedA.ok && approvedA.value.status).toBe("attending");
    if (approvedA.ok) expect(approvedA.value.email).toBeNull();
    as(FIXTURE_MEMBER.id);
    expect(code(await mock.decideGuest(b, "attending"))).toBe("event_full");
    expect((await mock.decideGuest(b, "rejected")).ok).toBe(true);
    as(null);
    expect((await mock.getGuestRegistration(aTok))?.status).toBe("attending");
    expect((await mock.getGuestRegistration(bTok))?.status).toBe("rejected");

    // Deciding does not close with registration.
    const later = await openedEvent({ requiresApproval: true, startDate: "2099-08-01", endDate: "2099-08-01" });
    await register(later.token, "Late Ask", "late@example.com");
    const lateId = await guestIdOf(later.id, "Late Ask");
    as(FIXTURE_MEMBER.id);
    expect((await mock.updateEvent(later.id, input({ requiresApproval: true, startDate: "2001-01-01", endDate: "2001-01-01" }))).ok).toBe(true);
    expect((await mock.decideGuest(lateId, "attending")).ok).toBe(true);
  });

  it("AC-17: removing an attending guest frees the seat and the manage page says so", async () => {
    const { id, token } = await openedEvent({ capacity: 2 });
    const manageToken = await register(token, "Removed", "removed@example.com");
    const guestId = await guestIdOf(id, "Removed");
    as(FIXTURE_MEMBER.id);
    expect((await mock.decideGuest(guestId, "removed")).ok).toBe(true);
    as(null);
    expect((await mock.getGuestEvent(token))?.seatsTaken).toBe(0);
    expect((await mock.getGuestRegistration(manageToken))?.status).toBe("removed");
  });

  it("AC-18: nobody else decides; cancelled is the manage link's alone; only the five transitions exist", async () => {
    const { id, token } = await openedEvent({ requiresApproval: true });
    await register(token, "Target", "target@example.com");
    const guestId = await guestIdOf(id, "Target");
    for (const who of [MEMBER_A2, MANAGER_A, MEMBER_B2, null]) {
      as(who);
      for (const s of ["attending", "rejected", "removed"] as const) {
        expect(code(await mock.decideGuest(guestId, s))).toBe("attendance_not_permitted");
      }
    }
    for (const who of [FIXTURE_MEMBER.id, FIXTURE_ADMIN.id]) {
      as(who);
      const cancel = await mock.decideGuest(guestId, "cancelled" as "rejected");
      expect(cancel.ok).toBe(false);
      expect(code(await mock.decideGuest(guestId, "removed"))).toBe("invalid_attendance_change");
    }
    as(FIXTURE_MEMBER.id);
    expect((await guestsAs(FIXTURE_MEMBER.id, id))[0]?.status).toBe("pending");
    // The grants and the policy say the same.
    expect(MIGRATION_SQL).toMatch(/grant update \(status\) on public\.event_guest to authenticated;/);
    expect(MIGRATION_SQL).not.toMatch(/grant (insert|delete)[^;]*on public\.event_guest\b/);
    expect(MIGRATION_SQL).toMatch(/status <> 'cancelled'::public\.guest_status/);
    expect(MIGRATION_SQL).not.toMatch(/create policy [a-z_]+ on public\.event_guest\s+for (insert|delete)/);
  });
});

describe("what it does not touch (AC-19 to AC-22)", () => {
  it("AC-19: guests change no member read and no member row", async () => {
    const { id, token } = await openedEvent();
    const snapshot = async () => {
      const out: unknown[] = [];
      for (const who of [FIXTURE_MEMBER.id, MEMBER_A2, FIXTURE_ADMIN.id]) {
        as(who);
        out.push(await mock.listMembers(), await mock.listMemberDirectory(), await mock.listEventAttendance(id));
      }
      return out;
    };
    const before = await snapshot();
    await register(token, "Not a member", "nm@example.com");
    expect(await snapshot()).toEqual(before);
    expect(MIGRATION_SQL).not.toMatch(/\bon public\.member\b/);
    expect(MIGRATION_SQL).not.toMatch(/references public\.member/);
    expect(MIGRATION_SQL).not.toMatch(/public\.entry\b/);
  });

  it("AC-20: deleting the event keeps its guests; the manage page shows the name and no cancel", async () => {
    const { id, token } = await openedEvent({ name: "Doomed party" });
    const manageToken = await register(token, "Survivor", "s@example.com");
    as(FIXTURE_MEMBER.id);
    expect((await mock.deleteEvent(id)).ok).toBe(true);
    as(null);
    expect(await mock.getGuestRegistration(manageToken)).toEqual({
      eventName: "Doomed party",
      startDate: null,
      endDate: null,
      location: null,
      guestName: "Survivor",
      status: "attending",
      registrationOpen: false,
      eventDeleted: true,
    });
    expect(code(await mock.cancelGuestRegistration(manageToken))).toBe("event_registration_closed");
    expect(MIGRATION_SQL).toMatch(/event_id\s+uuid null references public\.event\(id\) on delete set null/);
  });

  it("AC-21: the anon key reaches exactly the six guest functions", () => {
    const anonGrants = [...MIGRATION_SQL.matchAll(/grant [^;]*\bto [^;]*\banon\b[^;]*;/g)].map((m) => m[0]);
    expect(anonGrants).toEqual([
      "grant execute on function public.get_guest_event_terms(text) to anon, authenticated;",
      "grant execute on function public.register_guest(text, text, text) to anon, authenticated;",
      "grant execute on function public.get_guest_registration(text) to anon, authenticated;",
      "grant execute on function public.cancel_guest_registration(text) to anon, authenticated;",
    ]);
    expect(MIGRATION_SQL).toMatch(/revoke all on public\.event_guest from anon, authenticated;/);
    // The two replaced EVT-06 reads keep their grants: `create or replace`, never re-granted here.
    expect(MIGRATION_SQL).not.toMatch(/grant [^;]*get_guest_event\(text\)/);
    expect(MIGRATION_SQL).not.toMatch(/grant [^;]*list_guest_event_attendees\(text\)/);
    // No function returns an email, a manage token's hash or a guest id to the anon key.
    for (const fn of ["get_guest_event_terms", "get_guest_registration", "list_guest_event_attendees"]) {
      const at = MIGRATION_SQL.indexOf(`function public.${fn}(`);
      const returns = MIGRATION_SQL.slice(
        MIGRATION_SQL.indexOf("returns", at),
        MIGRATION_SQL.indexOf("language", at),
      );
      expect(returns).not.toMatch(/email|manage_token|guest_id|\bid\b/);
    }
  });

  it("AC-22: the terms are their own read; GuestEvent keeps EVT-06's keys", async () => {
    const { token } = await openedEvent();
    await register(token, "Key", "key@example.com");
    as(null);
    expect(Object.keys((await mock.getGuestEvent(token)) ?? {}).sort()).toEqual(
      ["attendeeNames", "capacity", "description", "endDate", "location", "name", "seatsTaken", "startDate"],
    );
    expect(await mock.getGuestRegistrationTerms(token)).toEqual({
      requiresApproval: false,
      registrationOpen: true,
    });
  });
});
