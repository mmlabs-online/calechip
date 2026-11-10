// EVT-06 — the guest link. Every acceptance criterion that is a property of the data, through the
// mock seam, and the migration read for its shape.
//
// **THE MOCK REPRODUCES `supabase/migrations/20261009120000_evt06_guest_link.sql`; IT CANNOT PROVE
// IT.** `tests/permission-model.test.ts` against a real PostgreSQL is still owed project-wide
// (.ai/standards/rbac-and-security.md § Known weaknesses 1). What the anon key can and cannot reach
// (AC-14) is asserted here by reading the migration's grants — the way `tests/events.test.ts` reads
// EVT-01's — and the mock's signed-out answers, never against a running database.
//
// **PEOPLE.** Fixtures as they are; anyone else is created through the seam as a person would be
// (sign up, then an admin decides), as `tests/events.test.ts` does. No fixture file is edited.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SaveEventInput } from "@/lib/data";
import { seam as mock, __resetEvents, __setCurrentMember } from "@/lib/data/mock";
import { seam as real } from "@/lib/data/supabase";
import { GUEST_LINK_TOKEN_PATTERN } from "@/lib/domain/types";
import { guestSeatsLabel } from "@/routes/GuestEvent";
import { guestLinkUrl } from "@/routes/EventDetail";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

const MIGRATION = readFileSync(
  fileURLToPath(new URL("../supabase/migrations/20261009120000_evt06_guest_link.sql", import.meta.url)),
  "utf8",
);

/** The migration with its `--` comments removed — the header names things in order to say they are
 *  not used; the assertions below are about the statements. */
const MIGRATION_SQL = MIGRATION.replace(/--[^\n]*/g, "");

const input = (overrides: Partial<SaveEventInput> = {}): SaveEventInput => ({
  name: "Guest lunch",
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

async function openAs(memberId: string | null, eventId: string) {
  as(memberId);
  return mock.openEventToGuests(eventId);
}

async function closeAs(memberId: string | null, eventId: string) {
  as(memberId);
  return mock.closeEventToGuests(eventId);
}

async function linkAs(memberId: string | null, eventId: string) {
  as(memberId);
  return mock.getEventGuestLink(eventId);
}

async function tokenOf(memberId: string, eventId: string): Promise<string> {
  const opened = await openAs(memberId, eventId);
  if (!opened.ok) throw new Error(`openEventToGuests refused: ${opened.error.code}`);
  return opened.value.token;
}

async function joinAs(memberId: string, eventId: string): Promise<void> {
  as(memberId);
  const joined = await mock.joinEvent(eventId);
  if (!joined.ok) throw new Error(`joinEvent refused: ${joined.error.code}`);
}

const code = (result: { ok: boolean; error?: { code: string } }): string | null =>
  result.ok ? null : (result.error?.code ?? null);

async function signUp(displayName: string): Promise<string> {
  const email = `${displayName.toLowerCase().replace(/\s+/g, ".")}@evt06.example.com`;
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
let MEMBER_B2 = "";

beforeAll(async () => {
  MANAGER_A = await approved("Guest Manager", FIXTURE_TEAM.id);
  as(FIXTURE_ADMIN.id);
  const promoted = await mock.setMemberRole(MANAGER_A, "manager");
  if (!promoted.ok) throw new Error("could not make a manager");
  MEMBER_A2 = await approved("Guest Second", FIXTURE_TEAM.id);
  MEMBER_B2 = await approved("Guest B Two", FIXTURE_OTHER_TEAM.id);
  as(null);
});

afterEach(() => {
  __resetEvents();
  as(null);
});

describe("opening and closing (AC-1 to AC-8)", () => {
  it("AC-1: the creator opens it; the token is 64 lowercase hex; the event and every inbox are unchanged", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    as(FIXTURE_MEMBER.id);
    const before = await mock.getEvent(id);
    const inboxes = async () => {
      const counts: number[] = [];
      for (const who of [FIXTURE_MEMBER.id, MEMBER_A2, FIXTURE_OTHER_TEAM_MEMBER.id, FIXTURE_ADMIN.id]) {
        as(who);
        counts.push((await mock.listNotifications()).length);
      }
      return counts;
    };
    const inboxBefore = await inboxes();

    const opened = await openAs(FIXTURE_MEMBER.id, id);
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(opened.value.eventId).toBe(id);
    expect(opened.value.token).toMatch(/^[0-9a-f]{64}$/);
    expect(GUEST_LINK_TOKEN_PATTERN.test(opened.value.token)).toBe(true);
    expect(await linkAs(FIXTURE_MEMBER.id, id)).toEqual(opened.value);
    expect(guestLinkUrl("https://cale.example", opened.value.token)).toBe(
      `https://cale.example/guest/${opened.value.token}`,
    );

    as(FIXTURE_MEMBER.id);
    expect((await mock.getEvent(id))?.updatedAt).toBe(before?.updatedAt);
    expect(await inboxes()).toEqual(inboxBefore);
  });

  it("AC-2: an admin opens and closes any event, whatever its scope, team or creator", async () => {
    for (const scope of ["team", "public", "named"] as const) {
      const id = await createAs(FIXTURE_OTHER_TEAM_MEMBER.id, { scope, inviteeIds: [] });
      const opened = await openAs(FIXTURE_ADMIN.id, id);
      expect(opened.ok).toBe(true);
      expect(await linkAs(FIXTURE_ADMIN.id, id)).not.toBeNull();
      expect((await closeAs(FIXTURE_ADMIN.id, id)).ok).toBe(true);
      expect(await linkAs(FIXTURE_ADMIN.id, id)).toBeNull();
    }
  });

  it("AC-3: a reader who may not manage it — a manager, an attendee, a named person — sees no link and is refused", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [MEMBER_A2] });
    await joinAs(MEMBER_A2, id);
    const others = [MANAGER_A, MEMBER_A2, FIXTURE_OTHER_TEAM_MEMBER.id];

    // Not open: refused, and a refused open creates no link.
    for (const who of others) {
      expect(code(await openAs(who, id))).toBe("event_not_permitted");
      expect(code(await closeAs(who, id))).toBe("event_not_permitted");
    }
    expect(await linkAs(FIXTURE_MEMBER.id, id)).toBeNull();

    // Open: still null, still refused, and the link survives their attempts.
    const token = await tokenOf(FIXTURE_MEMBER.id, id);
    for (const who of others) {
      expect(await linkAs(who, id)).toBeNull();
      expect(code(await closeAs(who, id))).toBe("event_not_permitted");
      expect(code(await openAs(who, id))).toBe("event_not_permitted");
    }
    expect((await linkAs(FIXTURE_MEMBER.id, id))?.token).toBe(token);
  });

  it("AC-3: the creator, once removed, can no longer open, close or read the link", async () => {
    const leaver = await approved("Guest Leaver", FIXTURE_TEAM.id);
    const open = await createAs(leaver);
    const shut = await createAs(leaver);
    const token = await tokenOf(leaver, open);

    as(FIXTURE_ADMIN.id);
    expect((await mock.removeMember(leaver)).ok).toBe(true);

    expect(await linkAs(leaver, open)).toBeNull();
    expect(code(await closeAs(leaver, open))).toBe("event_not_permitted");
    expect(code(await openAs(leaver, shut))).toBe("event_not_permitted");
    expect(await linkAs(FIXTURE_ADMIN.id, shut)).toBeNull();
    // The link they opened is still the event's — removing a member closes nothing.
    expect((await linkAs(FIXTURE_ADMIN.id, open))?.token).toBe(token);
  });

  it("AC-4: closing stops the link at once", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    const token = await tokenOf(FIXTURE_MEMBER.id, id);
    expect(await mock.getGuestEvent(token)).not.toBeNull();

    expect((await closeAs(FIXTURE_MEMBER.id, id)).ok).toBe(true);
    expect(await linkAs(FIXTURE_MEMBER.id, id)).toBeNull();
    expect(await mock.getGuestEvent(token)).toBeNull();
    // A second close finds nothing to remove — a refusal, not a success.
    expect(code(await closeAs(FIXTURE_MEMBER.id, id))).toBe("event_not_permitted");
  });

  it("AC-5: opening again makes a new token, and the old one stays dead", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    const first = await tokenOf(FIXTURE_MEMBER.id, id);
    expect((await closeAs(FIXTURE_MEMBER.id, id)).ok).toBe(true);
    const second = await tokenOf(FIXTURE_MEMBER.id, id);
    expect(second).not.toBe(first);
    expect(await mock.getGuestEvent(first)).toBeNull();
    expect(await mock.getGuestEvent(second)).not.toBeNull();
  });

  it("AC-6: opening twice — or at the same moment by the creator and an admin — gives one link", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    const first = await tokenOf(FIXTURE_MEMBER.id, id);
    const again = await openAs(FIXTURE_MEMBER.id, id);
    expect(again.ok && again.value.token).toBe(first);

    const other = await createAs(FIXTURE_MEMBER.id);
    as(FIXTURE_MEMBER.id);
    const results = await Promise.all([mock.openEventToGuests(other), mock.openEventToGuests(other)]);
    const tokens = results.map((r) => (r.ok ? r.value.token : null));
    expect(tokens[0]).not.toBeNull();
    expect(tokens[1]).toBe(tokens[0]);
    expect(MIGRATION_SQL).toMatch(/event_id\s+uuid primary key references public\.event\(id\) on delete cascade/);
  });

  it("AC-7: deleting the event kills its link", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    const token = await tokenOf(FIXTURE_MEMBER.id, id);
    as(FIXTURE_MEMBER.id);
    expect((await mock.deleteEvent(id)).ok).toBe(true);
    expect(await mock.getGuestEvent(token)).toBeNull();
  });
});

describe("the guest read (AC-9 to AC-17)", () => {
  it("AC-9: the seats line's three strings", () => {
    expect(guestSeatsLabel(10, 3)).toBe("7 of 10 seats left");
    expect(guestSeatsLabel(10, 10)).toBe("Full");
    expect(guestSeatsLabel(null, 4)).toBe("No seat limit");
  });

  it("AC-9, AC-12: signed out, the read returns exactly the listed fields", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, {
      name: "Picnic",
      description: "Bring a hat",
      location: "Tao Dan park",
      startDate: "2099-04-01",
      endDate: "2099-04-02",
      capacity: 8,
      requiresApproval: true,
      registrationDeadline: "2099-03-30",
    });
    const token = await tokenOf(FIXTURE_MEMBER.id, id);
    as(null);
    const read = await mock.getGuestEvent(token);
    expect(read).toEqual({
      name: "Picnic",
      description: "Bring a hat",
      location: "Tao Dan park",
      startDate: "2099-04-01",
      endDate: "2099-04-02",
      capacity: 8,
      seatsTaken: 0,
      attendeeNames: [],
    });
    expect(Object.keys(read ?? {}).sort()).toEqual(
      ["attendeeNames", "capacity", "description", "endDate", "location", "name", "seatsTaken", "startDate"],
    );
    // The definer read's column list is AC-12's, and the attendee read returns one text column.
    expect(MIGRATION_SQL).toMatch(
      /returns table \(name text, description text, location text, start_date date, end_date date,\s+capacity integer, seats_taken integer\)/,
    );
    expect(MIGRATION_SQL).toMatch(/list_guest_event_attendees\(p_token text\)\s+returns table \(display_name text\)/);
  });

  it("AC-10: attendees by name in join order, any team; pending is not listed or counted; a removed one is a former member", async () => {
    const leaver = await approved("Guest Gone", FIXTURE_TEAM.id);
    const id = await createAs(FIXTURE_MEMBER.id, { capacity: 10 });
    await joinAs(MEMBER_A2, id);
    await new Promise((r) => setTimeout(r, 2));
    await joinAs(MEMBER_B2, id);
    await new Promise((r) => setTimeout(r, 2));
    await joinAs(leaver, id);
    const token = await tokenOf(FIXTURE_MEMBER.id, id);

    as(FIXTURE_ADMIN.id);
    expect((await mock.removeMember(leaver)).ok).toBe(true);

    const gated = await createAs(FIXTURE_MEMBER.id, { requiresApproval: true });
    as(MEMBER_A2);
    expect((await mock.joinEvent(gated)).ok).toBe(true); // pending
    const gatedToken = await tokenOf(FIXTURE_MEMBER.id, gated);

    as(null);
    const read = await mock.getGuestEvent(token);
    expect(read?.attendeeNames).toEqual(["Guest Second", "Guest B Two", null]);
    expect(read?.seatsTaken).toBe(3);

    const pending = await mock.getGuestEvent(gatedToken);
    expect(pending?.attendeeNames).toEqual([]);
    expect(pending?.seatsTaken).toBe(0);
  });

  it("AC-11, AC-16: any scope, named included, reads the same to a guest and to a member who cannot read it", async () => {
    for (const scope of ["team", "public", "named"] as const) {
      const id = await createAs(FIXTURE_MEMBER.id, { scope, inviteeIds: [] });
      const token = await tokenOf(FIXTURE_MEMBER.id, id);
      as(null);
      const guest = await mock.getGuestEvent(token);
      expect(guest?.name).toBe("Guest lunch");
      as(FIXTURE_OTHER_TEAM_MEMBER.id);
      if (scope !== "public") expect(await mock.getEvent(id)).toBeNull();
      expect(await mock.getGuestEvent(token)).toEqual(guest);
    }
  });

  it("AC-13: never-existed, malformed, closed and deleted tokens all read null — and malformed makes no round trip", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    const closed = await tokenOf(FIXTURE_MEMBER.id, id);
    expect((await closeAs(FIXTURE_MEMBER.id, id)).ok).toBe(true);
    const gone = await createAs(FIXTURE_MEMBER.id);
    const deleted = await tokenOf(FIXTURE_MEMBER.id, gone);
    as(FIXTURE_MEMBER.id);
    expect((await mock.deleteEvent(gone)).ok).toBe(true);

    as(null);
    for (const token of ["0".repeat(64), "short", "G".repeat(64), closed.toUpperCase(), "", closed, deleted]) {
      expect(await mock.getGuestEvent(token)).toBeNull();
    }
    // The real seam answers a malformed token before building a client — no VITE_SUPABASE_URL here.
    for (const token of ["short", "", "x".repeat(64)]) {
      expect(await real.getGuestEvent(token)).toBeNull();
    }
  });

  it("AC-14: signed out, the link read is null and open and close are refused", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    expect(code(await openAs(null, id))).toBe("event_not_permitted");
    expect(await linkAs(FIXTURE_MEMBER.id, id)).toBeNull();
    await tokenOf(FIXTURE_MEMBER.id, id);
    expect(await linkAs(null, id)).toBeNull();
    expect(code(await closeAs(null, id))).toBe("event_not_permitted");
    as(null);
    expect(await mock.listEvents()).toEqual([]);
    expect(await mock.getEvent(id)).toBeNull();
    expect(await mock.listMemberDirectory()).toEqual([]);
  });

  it("AC-14: the migration grants anon the two guest reads and nothing else; no policy on member is touched", () => {
    const anonGrants = [...MIGRATION_SQL.matchAll(/grant [^;]*\bto [^;]*\banon\b[^;]*;/g)].map((m) => m[0]);
    expect(anonGrants).toEqual([
      "grant execute on function public.get_guest_event(text) to anon, authenticated;",
      "grant execute on function public.list_guest_event_attendees(text) to anon, authenticated;",
    ]);
    expect(MIGRATION_SQL).toMatch(/revoke all on public\.event_guest_link from anon, authenticated;/);
    expect(MIGRATION_SQL).not.toMatch(/\bon public\.member\b/);
    expect(MIGRATION_SQL).not.toMatch(/alter table public\.event\b/);
    expect(MIGRATION_SQL).not.toMatch(/create policy [a-z_]+ on public\.(event|member|event_attendance)\b/);
    // Every policy on the new table is `to authenticated` and goes through may_manage_event.
    const policies = [...MIGRATION_SQL.matchAll(/create policy [^;]*;/g)].map((m) => m[0]);
    expect(policies).toHaveLength(3);
    for (const p of policies) {
      expect(p).toMatch(/to authenticated/);
      expect(p).toMatch(/public\.may_manage_event\(event_id, \(select auth\.uid\(\)\)\)/);
    }
    // The token and the time are the database's.
    expect(MIGRATION_SQL).toMatch(/grant insert \(event_id\) on public\.event_guest_link to authenticated;/);
    expect(MIGRATION_SQL).not.toMatch(/grant update/);
    // Both reads filter on the token.
    expect(MIGRATION_SQL.match(/where l\.token = p_token/g)).toHaveLength(2);
  });

  it("AC-17: a past event stays readable", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { startDate: "2001-01-01", endDate: "2001-01-02" });
    const token = await tokenOf(FIXTURE_MEMBER.id, id);
    as(null);
    expect((await mock.getGuestEvent(token))?.endDate).toBe("2001-01-02");
  });
});

describe("what it does not touch (AC-18, INV-04)", () => {
  it("AC-18: listEvents, getEvent, listEventAttendance, listMemberDirectory and listMembers answer the same, open or not", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    await joinAs(MEMBER_A2, id);
    const snapshot = async () => {
      const out: unknown[] = [];
      for (const who of [FIXTURE_MEMBER.id, MEMBER_A2, MANAGER_A, FIXTURE_OTHER_TEAM_MEMBER.id, FIXTURE_ADMIN.id]) {
        as(who);
        out.push(
          await mock.listEvents(),
          await mock.getEvent(id),
          await mock.listEventAttendance(id),
          await mock.listMemberDirectory(),
          await mock.listMembers(),
        );
      }
      return out;
    };
    const before = await snapshot();
    await tokenOf(FIXTURE_MEMBER.id, id);
    expect(await snapshot()).toEqual(before);
    expect((await closeAs(FIXTURE_MEMBER.id, id)).ok).toBe(true);
    expect(await snapshot()).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// EVT-13 — a signed-in reader leaves the guest page. 01-plan.md § 3's denials, through the mock
// seam, and `20261015090000_evt13_guest_link_event_id.sql` read for its shape. The mock reproduces
// the function; it cannot prove it.
// ---------------------------------------------------------------------------

const EVT13_MIGRATION_SQL = readFileSync(
  fileURLToPath(
    new URL("../supabase/migrations/20261015090000_evt13_guest_link_event_id.sql", import.meta.url),
  ),
  "utf8",
).replace(/--[^\n]*/g, "");

async function eventIdAs(memberId: string | null, token: string): Promise<string | null> {
  as(memberId);
  return mock.getGuestLinkEventId(token);
}

describe("EVT-13 — the event behind a guest link, to a reader only (AC-1 to AC-9)", () => {
  it("AC-1, AC-2: every kind of reader gets the event id", async () => {
    const pub = await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    const pubToken = await tokenOf(FIXTURE_MEMBER.id, pub);
    for (const who of [FIXTURE_ADMIN.id, FIXTURE_MEMBER.id, MEMBER_A2, FIXTURE_OTHER_TEAM_MEMBER.id]) {
      expect(await eventIdAs(who, pubToken)).toBe(pub);
    }

    const team = await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    const teamToken = await tokenOf(FIXTURE_MEMBER.id, team);
    for (const who of [FIXTURE_ADMIN.id, FIXTURE_MEMBER.id, MEMBER_A2, MANAGER_A]) {
      expect(await eventIdAs(who, teamToken)).toBe(team);
    }

    const named = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [MEMBER_B2] });
    const namedToken = await tokenOf(FIXTURE_MEMBER.id, named);
    for (const who of [FIXTURE_ADMIN.id, FIXTURE_MEMBER.id, MEMBER_B2]) {
      expect(await eventIdAs(who, namedToken)).toBe(named);
    }
  });

  it("AC-3: a member of another team on an own-team event, and a member not named, get null", async () => {
    const team = await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    const teamToken = await tokenOf(FIXTURE_MEMBER.id, team);
    expect(await eventIdAs(FIXTURE_OTHER_TEAM_MEMBER.id, teamToken)).toBeNull();
    expect(await eventIdAs(MEMBER_B2, teamToken)).toBeNull();

    const named = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [MEMBER_B2] });
    const namedToken = await tokenOf(FIXTURE_MEMBER.id, named);
    expect(await eventIdAs(MEMBER_A2, namedToken)).toBeNull();
    expect(await eventIdAs(FIXTURE_OTHER_TEAM_MEMBER.id, namedToken)).toBeNull();
    // The guest read they fall back to is unchanged and carries no id.
    as(MEMBER_A2);
    expect(Object.keys((await mock.getGuestEvent(namedToken)) ?? {})).not.toContain("id");
  });

  it("AC-4: a pending sign-up gets null, even on a public event", async () => {
    const pub = await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    const token = await tokenOf(FIXTURE_MEMBER.id, pub);
    const pending = await signUp("Guest Pending Thirteen");
    expect(await eventIdAs(pending, token)).toBeNull();
  });

  it("AC-5, AC-7: signed out gets null for any token", async () => {
    const pub = await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    const token = await tokenOf(FIXTURE_MEMBER.id, pub);
    expect(await eventIdAs(null, token)).toBeNull();
  });

  it("AC-6: a closed, deleted, unknown or malformed token gets null for its creator — malformed with no round trip", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    const closed = await tokenOf(FIXTURE_MEMBER.id, id);
    expect((await closeAs(FIXTURE_MEMBER.id, id)).ok).toBe(true);
    const gone = await createAs(FIXTURE_MEMBER.id);
    const deleted = await tokenOf(FIXTURE_MEMBER.id, gone);
    as(FIXTURE_MEMBER.id);
    expect((await mock.deleteEvent(gone)).ok).toBe(true);
    for (const token of [closed, deleted, "0".repeat(64), "short", "", closed.toUpperCase()]) {
      expect(await eventIdAs(FIXTURE_MEMBER.id, token)).toBeNull();
      expect(await eventIdAs(FIXTURE_ADMIN.id, token)).toBeNull();
    }
    // The real seam answers a malformed token before building a client — no VITE_SUPABASE_URL here.
    for (const token of ["short", "", "x".repeat(64)]) {
      expect(await real.getGuestLinkEventId(token)).toBeNull();
    }
  });

  it("AC-8: the answer follows access at the moment of asking", async () => {
    const named = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [] });
    const token = await tokenOf(FIXTURE_MEMBER.id, named);
    const later = await approved("Guest Later Thirteen", FIXTURE_TEAM.id);
    expect(await eventIdAs(later, token)).toBeNull();

    const pub = await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    const pubToken = await tokenOf(FIXTURE_MEMBER.id, pub);
    expect(await eventIdAs(later, pubToken)).toBe(pub);
    as(FIXTURE_ADMIN.id);
    expect((await mock.removeMember(later)).ok).toBe(true);
    expect(await eventIdAs(later, pubToken)).toBeNull();
  });

  it("AC-9: asking writes nothing", async () => {
    const id = await createAs(FIXTURE_MEMBER.id);
    const token = await tokenOf(FIXTURE_MEMBER.id, id);
    const snapshot = async () => {
      as(FIXTURE_ADMIN.id);
      return [
        await mock.listEvents(),
        await mock.listEventAttendance(id),
        await mock.listEventGuests(id),
        await mock.getEventGuestLink(id),
        await mock.listMembers(),
      ];
    };
    const before = await snapshot();
    for (const who of [null, FIXTURE_MEMBER.id, MEMBER_A2, FIXTURE_OTHER_TEAM_MEMBER.id, FIXTURE_ADMIN.id]) {
      await eventIdAs(who, token);
    }
    expect(await snapshot()).toEqual(before);
  });

  it("AC-7: the migration grants the function to authenticated only and gates the id on may_read_event", () => {
    const sql = EVT13_MIGRATION_SQL;
    expect(sql).toMatch(
      /create or replace function public\.guest_link_event_id\(p_token text\) returns uuid\s+language sql stable security definer set search_path = ''/,
    );
    expect(sql).toMatch(
      /revoke all on function public\.guest_link_event_id\(text\) from public, anon, authenticated;/,
    );
    expect(sql).toMatch(/grant execute on function public\.guest_link_event_id\(text\) to authenticated;/);
    expect(sql).not.toMatch(/grant[^;]*\bto\b[^;]*\banon\b/);
    // One select, and its only filter beyond the token is the reader check.
    expect(sql.match(/\bselect\s+l\.event_id/g)).toHaveLength(1);
    expect(sql).toMatch(/where l\.token = p_token\s+and public\.may_read_event\(l\.event_id, \(select auth\.uid\(\)\)\);/);
    // Nothing else: no table, policy, trigger or table grant.
    expect(sql).not.toMatch(/create (table|policy|trigger)|alter (table|policy)|drop /);
    expect(sql).not.toMatch(/grant[^;]*\bon\s+(table\s+)?public\.(?!guest_link_event_id)/);
  });
});
