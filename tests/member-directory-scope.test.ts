// MIR-04 — the member directory is the caller's own team, plus the people an event or a notification
// already connects them to (ADR-066). 01-plan.md § 2 AC-1 to AC-13, § 4.6. Through the mock seam.
//
// **THE MOCK REPRODUCES `supabase/migrations/20261020180000_mir04_scoped_member_directory.sql`; IT
// CANNOT PROVE IT.** The last test reads the migration itself, which guards the file and is not
// verification — that is `.ai/board/tickets/MIR-04/verification.md`, run by a human, until MIR-05.
//
// **PEOPLE.** C is `FIXTURE_MEMBER` (team T, not an admin) unless a test says otherwise. X is
// `FIXTURE_OTHER_TEAM_MEMBER` (team U). Everyone else the fixtures do not carry is created through
// the seam as a person would be — sign up, then an admin decides. Each test builds its own events and
// `afterEach` empties them, with their invitees, attendance and notifications, so order does not
// matter.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SaveEventInput } from "@/lib/data";
import { seam as mock, __resetEvents, __setCurrentMember } from "@/lib/data/mock";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

const MIGRATION = readFileSync(
  fileURLToPath(
    new URL("../supabase/migrations/20261020180000_mir04_scoped_member_directory.sql", import.meta.url),
  ),
  "utf8",
);
/** The statements, without the `--` comments — the header names policies in order to say none changes. */
const MIGRATION_SQL = MIGRATION.replace(/--[^\n]*/g, "");

const C = FIXTURE_MEMBER.id;
const X = FIXTURE_OTHER_TEAM_MEMBER.id;

const input = (overrides: Partial<SaveEventInput> = {}): SaveEventInput => ({
  name: "Team lunch",
  description: null,
  location: null,
  startDate: "2099-03-10",
  endDate: "2099-03-10",
  scope: "team",
  inviteeIds: [],
  ...overrides,
});

async function createAs(memberId: string, overrides: Partial<SaveEventInput> = {}): Promise<string> {
  as(memberId);
  const result = await mock.createEvent(input(overrides));
  if (!result.ok) throw new Error(`createEvent refused: ${result.error.code}`);
  return result.value.id;
}

async function directoryOf(memberId: string | null): Promise<string[]> {
  as(memberId);
  return (await mock.listMemberDirectory()).map((d) => d.id);
}

async function signUp(displayName: string): Promise<string> {
  const email = `${displayName.toLowerCase().replace(/\s+/g, ".")}@mir04.example.com`;
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

let TEAMMATE = ""; // T, a member
let Y = ""; // U, the attendee
let Z = ""; // U, the invitee
let PENDING = "";
let REJECTED = "";

beforeAll(async () => {
  TEAMMATE = await approved("Teammate T", FIXTURE_TEAM.id);
  Y = await approved("Attendee U", FIXTURE_OTHER_TEAM.id);
  Z = await approved("Invitee U", FIXTURE_OTHER_TEAM.id);
  PENDING = await signUp("Still Waiting");
  REJECTED = await signUp("Turned Away");
  as(FIXTURE_ADMIN.id);
  const rejected = await mock.decideMember(REJECTED, { approve: false });
  if (!rejected.ok) throw new Error("could not reject");
  as(null);
});

afterEach(() => {
  __resetEvents();
  as(null);
});

describe("MIR-04 — the member directory's scope", () => {
  it("a member's directory lists every current member of their own team, themselves included", async () => {
    as(C);
    const directory = await mock.listMemberDirectory();
    const ids = directory.map((d) => d.id);
    for (const who of [FIXTURE_ADMIN.id, C, FIXTURE_SECOND_ADMIN.id, FIXTURE_APPROVED_MEMBER.id, TEAMMATE]) {
      expect(ids).toContain(who);
    }
    for (const row of directory) {
      expect(Object.keys(row).sort()).toEqual(["avatar", "displayName", "id", "teamId", "teamName"]);
    }
  });

  it("a member of another team with no shared event or notification is not listed", async () => {
    as(C);
    const directory = await mock.listMemberDirectory();
    for (const who of [X, Y, Z]) expect(directory.map((d) => d.id)).not.toContain(who);
    expect(directory.some((d) => d.teamName === FIXTURE_OTHER_TEAM.name)).toBe(false);
  });

  it("the creator of a public event from another team is listed; of a Limited people event that does not name the caller, is not", async () => {
    await createAs(X, { scope: "named", inviteeIds: [Z] });
    expect(await directoryOf(C)).not.toContain(X);

    await createAs(X, { scope: "public" });
    as(C);
    const row = (await mock.listMemberDirectory()).find((d) => d.id === X);
    expect(row?.teamName).toBe(FIXTURE_OTHER_TEAM.name);
  });

  it("an attending member of another team is listed to a reader; a pending one only to the event's creator", async () => {
    const open = await createAs(FIXTURE_APPROVED_MEMBER.id, { scope: "public" });
    as(Y);
    expect((await mock.joinEvent(open)).ok).toBe(true);
    expect(await directoryOf(C)).toContain(Y);
    expect(await directoryOf(FIXTURE_APPROVED_MEMBER.id)).toContain(Y);

    __resetEvents();
    const gated = await createAs(FIXTURE_APPROVED_MEMBER.id, { scope: "public", requiresApproval: true });
    as(Y);
    const joined = await mock.joinEvent(gated);
    expect(joined.ok ? joined.value.status : null).toBe("pending");
    expect(await directoryOf(C)).not.toContain(Y);
    expect(await directoryOf(FIXTURE_APPROVED_MEMBER.id)).toContain(Y);
  });

  it("an invitee from another team is listed to the event's creator and not, by that clause, to a fellow invitee", async () => {
    // The fellow invitee is C's teammate, not a member of U: on U, own team (b) would list Z to them
    // and the assertion would test nothing.
    const id = await createAs(C, { scope: "named", inviteeIds: [Z, TEAMMATE] });
    expect(await directoryOf(C)).toContain(Z);
    expect(await directoryOf(TEAMMATE)).not.toContain(Z);

    // By email, too (EVT-12, ADR-061): the member branch names them on the event.
    const email = FIXTURE_OTHER_TEAM_MEMBER.email;
    if (email === null) throw new Error("the other-team fixture carries no email");
    as(C);
    const invited = await mock.inviteToEvent(id, [email]);
    expect(invited.ok).toBe(true);
    expect(await directoryOf(C)).toContain(X);
    expect(await directoryOf(TEAMMATE)).not.toContain(X);
  });

  it("the actor of a notification addressed to the caller is listed, after the event is deleted too", async () => {
    const id = await createAs(X, { scope: "public" });
    as(C);
    expect((await mock.listNotifications()).some((n) => n.actorId === X)).toBe(true);
    as(X);
    expect((await mock.deleteEvent(id)).ok).toBe(true);
    as(C);
    expect(await mock.getEvent(id)).toBeNull();
    expect(await directoryOf(C)).toContain(X);
  });

  it("a removed, pending or rejected member is listed by no clause", async () => {
    // A teammate who created a public event C reads and caused a notification to C, then left.
    const leaver = await approved("Leaver T", FIXTURE_TEAM.id);
    await createAs(leaver, { scope: "public" });
    expect(await directoryOf(C)).toContain(leaver);
    as(FIXTURE_ADMIN.id);
    expect((await mock.removeMember(leaver)).ok).toBe(true);

    for (const caller of [C, FIXTURE_ADMIN.id]) {
      const ids = await directoryOf(caller);
      for (const who of [leaver, FIXTURE_REMOVED_MEMBER.id, PENDING, REJECTED]) {
        expect(ids).not.toContain(who);
      }
    }
  });

  it("a caller with no team receives an empty directory", async () => {
    for (const who of [PENDING, REJECTED, FIXTURE_REMOVED_MEMBER.id, null]) {
      expect(await directoryOf(who)).toEqual([]);
    }
  });

  it("an admin's directory lists every current member of every team", async () => {
    const ids = await directoryOf(FIXTURE_ADMIN.id);
    for (const who of [FIXTURE_ADMIN.id, C, FIXTURE_SECOND_ADMIN.id, FIXTURE_APPROVED_MEMBER.id, TEAMMATE, X, Y, Z]) {
      expect(ids).toContain(who);
    }
  });

  it("naming a current member of another team still saves, and they read the event", async () => {
    as(C);
    const result = await mock.createEvent(input({ scope: "named", inviteeIds: [X] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    as(X);
    expect(await mock.getEvent(result.value.id)).not.toBeNull();
  });

  it("listMembers answers the same for every caller as before the change", async () => {
    const roster = async (who: string): Promise<string[]> => {
      as(who);
      return (await mock.listMembers()).map((m) => m.id).sort();
    };
    // The fixture roster for T (removed member included, as `listMembers` always returned it) and U,
    // plus the people this file approved onto each.
    const teamT = [FIXTURE_ADMIN.id, C, FIXTURE_SECOND_ADMIN.id, FIXTURE_REMOVED_MEMBER.id, FIXTURE_APPROVED_MEMBER.id, TEAMMATE];
    const teamU = [X, Y, Z];
    const before = { c: await roster(C), x: await roster(X), admin: await roster(FIXTURE_ADMIN.id) };
    for (const who of teamT) expect(before.c).toContain(who);
    for (const who of teamU) expect(before.c).not.toContain(who);
    expect(before.x).toEqual(expect.arrayContaining(teamU));
    for (const who of teamT) expect(before.x).not.toContain(who);
    expect(before.admin).toEqual(before.c);

    // A connection that widens the directory widens no roster.
    await createAs(X, { scope: "public" });
    await createAs(C, { scope: "named", inviteeIds: [Z] });
    expect(await directoryOf(C)).toEqual(expect.arrayContaining([X, Z]));
    expect(await roster(C)).toEqual(before.c);
    expect(await roster(X)).toEqual(before.x);
    expect(await roster(FIXTURE_ADMIN.id)).toEqual(before.admin);
  });

  it("the migration replaces list_member_directory with the five clauses and touches no policy", () => {
    const sql = MIGRATION_SQL;
    const count = (pattern: RegExp): number => sql.match(pattern)?.length ?? 0;
    expect(sql).toMatch(/create or replace function public\.list_member_directory\(\)/);
    expect(sql).toMatch(/returns table \(id uuid, display_name text, avatar text, team_id uuid, team_name text\)/);
    expect(sql).toMatch(/select m\.id, m\.display_name, m\.avatar, m\.team_id, t\.name\s/);
    expect(sql).toMatch(/public\.is_admin\(\(select auth\.uid\(\)\)\)/);
    expect(sql).toMatch(/m\.team_id = public\.member_team_id\(\(select auth\.uid\(\)\)\)/);
    expect(count(/public\.may_read_event\(/g)).toBe(2);
    expect(count(/public\.may_manage_event\(/g)).toBe(2);
    expect(sql).toMatch(/public\.notification n/);
    expect(sql).toMatch(/n\.recipient_id = \(select auth\.uid\(\)\)/);
    expect(sql).toMatch(/revoke all on function public\.list_member_directory\(\) from public, anon;/);
    expect(sql).toMatch(/grant execute on function public\.list_member_directory\(\) to authenticated;/);
    expect(sql).not.toMatch(/\b(create|drop|alter)\s+policy\b/i);
  });
});
