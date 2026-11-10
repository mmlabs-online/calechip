// EVT-01 — events. Every acceptance criterion that is a property of the data, through the mock seam.
//
// **THE MOCK REPRODUCES `supabase/migrations/20260929120000_evt01_event.sql`; IT CANNOT PROVE IT.**
// `tests/permission-model.test.ts` against a real PostgreSQL is still owed project-wide
// (.ai/standards/rbac-and-security.md § Known weaknesses 1), so the denials below (AC-4, the direct
// half of AC-3, AC-11, AC-17) are asserted against the mock, which must refuse them identically —
// 01-plan.md § 3, *Where this plan cannot be verified today*. Two tests read the migration itself,
// because a claim about a real file is only tested by reading that file
// (.ai/standards/testing-standards.md § Fixtures that share the implementation's assumptions).
//
// **PEOPLE.** The fixtures named in 01-plan.md § 7 are used as they are. The people the fixtures do
// not carry — a manager, a second member of team B, a pending sign-up that is not
// `FIXTURE_SECOND_ADMIN`'s id twin, a rejected one, and a member who is removed mid-test — are
// created through the seam as a person would be (sign up, then an admin decides), never written as
// literals. No fixture file is edited.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { SaveEventInput } from "@/lib/data";
import { seam as mock, __resetEvents, __setCurrentMember } from "@/lib/data/mock";
import { seam as real } from "@/lib/data/supabase";
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
  fileURLToPath(new URL("../supabase/migrations/20260929120000_evt01_event.sql", import.meta.url)),
  "utf8",
);

/** The migration with its `--` comments removed. The header NAMES `member_select_team` and
 *  `may_decide` in order to say they are not used; the assertions below are about the statements. */
const MIGRATION_SQL = MIGRATION.replace(/--[^\n]*/g, "");

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

/** Creates an event as `memberId` and returns its id, failing the test if the seam refused. */
async function createAs(memberId: string, overrides: Partial<SaveEventInput> = {}): Promise<string> {
  as(memberId);
  const result = await mock.createEvent(input(overrides));
  if (!result.ok) throw new Error(`createEvent refused: ${result.error.code}`);
  return result.value.id;
}

async function canRead(memberId: string, eventId: string): Promise<boolean> {
  as(memberId);
  const listed = (await mock.listEvents()).some((e) => e.id === eventId);
  const fetched = (await mock.getEvent(eventId)) !== null;
  // The list and the detail must never disagree — AC-22's "can read" is both.
  expect(listed).toBe(fetched);
  return fetched;
}

/** Signs a person up and returns their member id, found the way an admin finds them. */
async function signUp(displayName: string): Promise<string> {
  const email = `${displayName.toLowerCase().replace(/\s+/g, ".")}@evt01.example.com`;
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
let MEMBER_B2 = "";
let PENDING = "";
let REJECTED = "";

beforeAll(async () => {
  MANAGER_A = await approved("Manager A", FIXTURE_TEAM.id);
  as(FIXTURE_ADMIN.id);
  const promoted = await mock.setMemberRole(MANAGER_A, "manager");
  if (!promoted.ok) throw new Error("could not make a manager");

  MEMBER_B2 = await approved("Second B", FIXTURE_OTHER_TEAM.id);
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

describe("creating", () => {
  it("AC-1: a member, a manager and an admin each create an event, as its creator", async () => {
    for (const who of [FIXTURE_MEMBER.id, MANAGER_A, FIXTURE_ADMIN.id]) {
      as(who);
      const result = await mock.createEvent(
        input({ name: "Offsite", location: "Da Lat", description: "Two days", startDate: "2099-05-01", endDate: "2099-05-02", scope: "public" }),
      );
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value).toMatchObject({
        creatorId: who,
        teamId: FIXTURE_TEAM.id,
        name: "Offsite",
        location: "Da Lat",
        description: "Two days",
        startDate: "2099-05-01",
        endDate: "2099-05-02",
        scope: "public",
      });
      expect(await mock.getEvent(result.value.id)).toEqual(result.value);
    }
  });

  it("AC-2: an empty or whitespace name is refused and nothing is saved", async () => {
    as(FIXTURE_MEMBER.id);
    for (const name of ["", "   "]) {
      const result = await mock.createEvent(input({ name }));
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.error.code).toBe("empty_event_name");
    }
    expect(await mock.listEvents()).toEqual([]);
  });

  it("AC-2: a blank description and location are stored as null, never as an empty label", async () => {
    as(FIXTURE_MEMBER.id);
    const result = await mock.createEvent(input({ description: "  ", location: "" }));
    expect(result.ok && result.value.description === null && result.value.location === null).toBe(true);
  });

  it("AC-3: an end before the start is refused and nothing is saved", async () => {
    as(FIXTURE_MEMBER.id);
    const result = await mock.createEvent(input({ startDate: "2099-03-10", endDate: "2099-03-09" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("invalid_event_dates");
    expect(await mock.listEvents()).toEqual([]);
  });

  it("AC-2, AC-3: the real seam refuses both before any request, with the same codes", async () => {
    // `client()` is never built on these paths — there is no VITE_SUPABASE_URL in this run, so a
    // request would throw rather than return. Agreement on the code is what makes the duplicated
    // sentences in the two implementations checkable.
    const noName = await real.createEvent(input({ name: " " }));
    const reversed = await real.updateEvent("any", input({ startDate: "2099-03-10", endDate: "2099-03-01" }));
    expect(noName.ok ? null : noName.error.code).toBe("empty_event_name");
    expect(reversed.ok ? null : reversed.error.code).toBe("invalid_event_dates");
  });

  it("AC-3: the database refuses an end before the start, and there is no time of day", () => {
    expect(MIGRATION).toMatch(/constraint event_dates_ordered check \(end_date >= start_date\)/);
    expect(MIGRATION).toMatch(/start_date\s+date not null/);
    expect(MIGRATION).toMatch(/end_date\s+date not null/);
    expect(MIGRATION).not.toMatch(/timestamptz[^\n]*-- .*(start|end)/);
  });

  it("AC-4: the creator and the team are the caller's, whatever the request carries", async () => {
    as(FIXTURE_MEMBER.id);
    // Smuggled past the type: a caller that is not this application.
    const smuggled = {
      ...input(),
      creatorId: FIXTURE_OTHER_TEAM_MEMBER.id,
      teamId: FIXTURE_OTHER_TEAM.id,
    } as SaveEventInput;
    const result = await mock.createEvent(smuggled);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.creatorId).toBe(FIXTURE_MEMBER.id);
      expect(result.value.teamId).toBe(FIXTURE_TEAM.id);
    }
  });

  it("AC-4: creator_id and team_id are in neither column grant, so naming either is refused", () => {
    const insertGrant = MIGRATION.match(/grant insert \(([^)]*)\) on public\.event to/);
    const updateGrant = MIGRATION.match(/grant update \(([^)]*)\) on public\.event to/);
    expect(insertGrant?.[1]).toBe("name, description, location, start_date, end_date, scope");
    expect(updateGrant?.[1]).toBe("name, description, location, start_date, end_date, scope");
    // And the table-wide default grant is revoked first, without which a column grant means nothing.
    expect(MIGRATION).toMatch(/revoke all on public\.event from anon, authenticated;/);
  });
});

describe("who can read it", () => {
  it("AC-5: an own-team event is read by its team at every rank, and by no one on another team", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "team" });
    for (const who of [FIXTURE_MEMBER.id, FIXTURE_APPROVED_MEMBER.id, MANAGER_A, FIXTURE_ADMIN.id]) {
      expect(await canRead(who, id)).toBe(true);
    }
    for (const who of [FIXTURE_OTHER_TEAM_MEMBER.id, MEMBER_B2]) {
      expect(await canRead(who, id)).toBe(false);
    }
  });

  it("AC-5: a team B member's own-team event is not read by a manager of team A", async () => {
    const id = await createAs(FIXTURE_OTHER_TEAM_MEMBER.id, { scope: "team" });
    expect(await canRead(MEMBER_B2, id)).toBe(true);
    expect(await canRead(MANAGER_A, id)).toBe(false);
    expect(await canRead(FIXTURE_MEMBER.id, id)).toBe(false);
  });

  it("AC-6: an every-team event is read by every approved member of every team", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    for (const who of [FIXTURE_APPROVED_MEMBER.id, MANAGER_A, FIXTURE_OTHER_TEAM_MEMBER.id, MEMBER_B2, FIXTURE_SECOND_ADMIN.id]) {
      expect(await canRead(who, id)).toBe(true);
    }
  });

  it("AC-6, AC-9: a pending or a rejected sign-up reads no event at all", async () => {
    const pub = await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    await createAs(FIXTURE_OTHER_TEAM_MEMBER.id, { scope: "team" });
    for (const who of [PENDING, REJECTED]) {
      as(who);
      expect(await mock.listEvents()).toEqual([]);
      expect(await mock.getEvent(pub)).toBeNull();
    }
  });

  it("AC-7: a named-people event is read by its creator, the people named and admins, and nobody else", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, {
      scope: "named",
      inviteeIds: [FIXTURE_OTHER_TEAM_MEMBER.id],
    });
    expect(await canRead(FIXTURE_MEMBER.id, id)).toBe(true);
    expect(await canRead(FIXTURE_OTHER_TEAM_MEMBER.id, id)).toBe(true);
    expect(await canRead(FIXTURE_ADMIN.id, id)).toBe(true);
    expect(await canRead(FIXTURE_SECOND_ADMIN.id, id)).toBe(true);
    // Being on the creator's team grants nothing (Q25), at either rank.
    expect(await canRead(FIXTURE_APPROVED_MEMBER.id, id)).toBe(false);
    expect(await canRead(MANAGER_A, id)).toBe(false);
    // Nor does being on the named person's team.
    expect(await canRead(MEMBER_B2, id)).toBe(false);
  });

  it("AC-8: an admin lists every event of every scope on every team", async () => {
    const ids = [
      await createAs(FIXTURE_MEMBER.id, { scope: "team" }),
      await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [FIXTURE_APPROVED_MEMBER.id] }),
      await createAs(FIXTURE_OTHER_TEAM_MEMBER.id, { scope: "team" }),
      await createAs(FIXTURE_OTHER_TEAM_MEMBER.id, { scope: "named", inviteeIds: [MEMBER_B2] }),
      await createAs(MEMBER_B2, { scope: "public" }),
    ];
    for (const admin of [FIXTURE_ADMIN.id, FIXTURE_SECOND_ADMIN.id]) {
      as(admin);
      expect((await mock.listEvents()).map((e) => e.id).sort()).toEqual([...ids].sort());
    }
  });

  it("listEvents orders by start date ascending, then id", async () => {
    const late = await createAs(FIXTURE_MEMBER.id, { startDate: "2099-09-01", endDate: "2099-09-01" });
    const early = await createAs(FIXTURE_MEMBER.id, { startDate: "2099-01-01", endDate: "2099-12-31" });
    as(FIXTURE_MEMBER.id);
    expect((await mock.listEvents()).map((e) => e.id)).toEqual([early, late]);
  });

  it("AC-9: a pending, rejected or removed person cannot create an event", async () => {
    for (const who of [PENDING, REJECTED, FIXTURE_REMOVED_MEMBER.id]) {
      as(who);
      const result = await mock.createEvent(input({ scope: "public" }));
      expect(result.ok ? null : result.error.code).toBe("event_not_permitted");
    }
    as(FIXTURE_ADMIN.id);
    expect(await mock.listEvents()).toEqual([]);
  });

  it("AC-9: a member removed after the fact reads nothing — not what they created, not what named them", async () => {
    const leaver = await approved("Soon Gone", FIXTURE_TEAM.id);
    const own = await createAs(leaver, { scope: "public" });
    const naming = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [leaver] });
    expect(await canRead(leaver, own)).toBe(true);
    expect(await canRead(leaver, naming)).toBe(true);

    as(FIXTURE_ADMIN.id);
    expect((await mock.removeMember(leaver)).ok).toBe(true);

    expect(await canRead(leaver, own)).toBe(false);
    expect(await canRead(leaver, naming)).toBe(false);
    as(leaver);
    expect(await mock.listEvents()).toEqual([]);
    const edit = await mock.updateEvent(own, input({ name: "Mine still?" }));
    expect(edit.ok ? null : edit.error.code).toBe("event_not_permitted");
    // Their event is still there for everybody else — removing a member does not delete history.
    expect(await canRead(FIXTURE_OTHER_TEAM_MEMBER.id, own)).toBe(true);
  });
});

describe("choosing who is named", () => {
  // 2026-10-21, MIR-04 / ADR-066: superseded "the directory is every approved, current member of every team".
  it("AC-10 (ADR-066): a member's directory is their own team — five fields and no more", async () => {
    as(FIXTURE_MEMBER.id);
    const directory = await mock.listMemberDirectory();
    const ids = directory.map((d) => d.id);

    for (const who of [FIXTURE_ADMIN.id, FIXTURE_MEMBER.id, FIXTURE_APPROVED_MEMBER.id, MANAGER_A]) {
      expect(ids).toContain(who);
    }
    // No event or notification connects them to the caller yet.
    for (const who of [FIXTURE_OTHER_TEAM_MEMBER.id, MEMBER_B2]) {
      expect(ids).not.toContain(who);
    }
    for (const who of [PENDING, REJECTED, FIXTURE_REMOVED_MEMBER.id]) {
      expect(ids).not.toContain(who);
    }
    for (const row of directory) {
      expect(Object.keys(row).sort()).toEqual(["avatar", "displayName", "id", "teamId", "teamName"]);
      expect(row.teamId).toBe(FIXTURE_TEAM.id);
    }
    expect(directory.some((d) => d.teamName === FIXTURE_OTHER_TEAM.name)).toBe(false);
  });

  it("AC-10: ordered by team name, then display name", async () => {
    as(FIXTURE_MEMBER.id);
    const directory = await mock.listMemberDirectory();
    const keys = directory.map((d) => [d.teamName, d.displayName] as const);
    const sorted = [...keys].sort((a, b) => a[0].localeCompare(b[0]) || a[1].localeCompare(b[1]));
    expect(keys).toEqual(sorted);
  });

  it("AC-10: a pending sign-up calling the directory receives an empty list", async () => {
    for (const who of [PENDING, REJECTED, FIXTURE_REMOVED_MEMBER.id]) {
      as(who);
      expect(await mock.listMemberDirectory()).toEqual([]);
    }
  });

  it("AC-10: the database read returns the five columns and no role, status or removal", () => {
    const body = MIGRATION.match(/create or replace function public\.list_member_directory\(\)([\s\S]*?)\$\$;/)?.[1] ?? "";
    expect(body).toMatch(/returns table \(id uuid, display_name text, avatar text, team_id uuid, team_name text\)/);
    expect(body).toMatch(/select m\.id, m\.display_name, m\.avatar, m\.team_id, t\.name\s/);
  });

  it("AC-11: naming a pending, rejected, removed or unknown id is refused, and nothing is saved", async () => {
    for (const bad of [PENDING, REJECTED, FIXTURE_REMOVED_MEMBER.id, "00000000-0000-4000-8000-00000000dead"]) {
      as(FIXTURE_MEMBER.id);
      const result = await mock.createEvent(input({ scope: "named", inviteeIds: [FIXTURE_OTHER_TEAM_MEMBER.id, bad] }));
      expect(result.ok ? null : result.error.code).toBe("invalid_event_invitee");
      expect(await mock.listEvents()).toEqual([]);
    }
  });

  it("AC-11: an edit naming someone invalid is refused, and the event and its list are unchanged", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { name: "Before", scope: "named", inviteeIds: [MEMBER_B2] });
    as(FIXTURE_MEMBER.id);
    const before = await mock.getEvent(id);
    const result = await mock.updateEvent(id, input({ name: "After", scope: "named", inviteeIds: [PENDING] }));
    expect(result.ok ? null : result.error.code).toBe("invalid_event_invitee");
    expect(await mock.getEvent(id)).toEqual(before);
    expect(await mock.listEventInvitees(id)).toEqual([MEMBER_B2]);
  });

  it("AC-12: the roster does not widen — listMembers is the caller's team before and after", async () => {
    for (const who of [FIXTURE_MEMBER.id, MANAGER_A]) {
      as(who);
      const before = await mock.listMembers();
      await createAs(who, { scope: "named", inviteeIds: [FIXTURE_OTHER_TEAM_MEMBER.id] });
      await createAs(FIXTURE_OTHER_TEAM_MEMBER.id, { scope: "public" });
      as(who);
      const after = await mock.listMembers();
      expect(after).toEqual(before);
      expect(after.every((m) => m.teamId === FIXTURE_TEAM.id)).toBe(true);
    }
  });

  it("AC-12: the migration touches no policy on public.member", () => {
    expect(MIGRATION_SQL).not.toMatch(/policy\s+\w+\s+on\s+public\.member\b/i);
    expect(MIGRATION_SQL).not.toMatch(/alter\s+policy/i);
    expect(MIGRATION_SQL).not.toMatch(/member_select_team/);
    expect(MIGRATION_SQL).not.toMatch(/on\s+public\.member\s/i);
  });

  it("AC-13: the creator and admins read the named list; a named person does not", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, {
      scope: "named",
      inviteeIds: [FIXTURE_OTHER_TEAM_MEMBER.id, FIXTURE_APPROVED_MEMBER.id],
    });
    const expected = [FIXTURE_OTHER_TEAM_MEMBER.id, FIXTURE_APPROVED_MEMBER.id].sort();
    for (const who of [FIXTURE_MEMBER.id, FIXTURE_ADMIN.id]) {
      as(who);
      expect(await mock.listEventInvitees(id)).toEqual(expected);
    }
    as(FIXTURE_OTHER_TEAM_MEMBER.id);
    expect(await mock.getEvent(id)).not.toBeNull();
    expect(await mock.listEventInvitees(id)).toEqual([]);
  });
});

describe("changing and removing it", () => {
  it("AC-14: the creator edits every field, and who can read it follows at once", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [FIXTURE_OTHER_TEAM_MEMBER.id] });
    expect(await canRead(FIXTURE_OTHER_TEAM_MEMBER.id, id)).toBe(true);
    expect(await canRead(MEMBER_B2, id)).toBe(false);

    // Swap who is named: the one removed loses it, the one added gains it.
    as(FIXTURE_MEMBER.id);
    const swapped = await mock.updateEvent(id, input({
      name: "Renamed",
      description: "Now with a plan",
      location: "Room 2",
      startDate: "2099-06-01",
      endDate: "2099-06-03",
      scope: "named",
      inviteeIds: [MEMBER_B2],
    }));
    expect(swapped.ok).toBe(true);
    if (swapped.ok) {
      expect(swapped.value).toMatchObject({
        name: "Renamed",
        description: "Now with a plan",
        location: "Room 2",
        startDate: "2099-06-01",
        endDate: "2099-06-03",
        scope: "named",
      });
    }
    expect(await canRead(FIXTURE_OTHER_TEAM_MEMBER.id, id)).toBe(false);
    expect(await canRead(MEMBER_B2, id)).toBe(true);

    // Narrow to own team: team B loses it, and the named list is emptied.
    as(FIXTURE_MEMBER.id);
    expect((await mock.updateEvent(id, input({ scope: "team", inviteeIds: [MEMBER_B2] }))).ok).toBe(true);
    expect(await canRead(MEMBER_B2, id)).toBe(false);
    expect(await canRead(FIXTURE_APPROVED_MEMBER.id, id)).toBe(true);
    as(FIXTURE_MEMBER.id);
    expect(await mock.listEventInvitees(id)).toEqual([]);

    // Widen to every team: team B gains it.
    expect((await mock.updateEvent(id, input({ scope: "public" }))).ok).toBe(true);
    expect(await canRead(MEMBER_B2, id)).toBe(true);
  });

  it("AC-15: the creator deletes an event, and it and its named list are gone for every reader", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [FIXTURE_OTHER_TEAM_MEMBER.id] });
    as(FIXTURE_MEMBER.id);
    expect((await mock.deleteEvent(id)).ok).toBe(true);
    for (const who of [FIXTURE_MEMBER.id, FIXTURE_OTHER_TEAM_MEMBER.id, FIXTURE_ADMIN.id]) {
      expect(await canRead(who, id)).toBe(false);
    }
    as(FIXTURE_ADMIN.id);
    expect(await mock.listEventInvitees(id)).toEqual([]);
    // A second delete touches zero rows, which is a refusal and not success.
    as(FIXTURE_MEMBER.id);
    const again = await mock.deleteEvent(id);
    expect(again.ok ? null : again.error.code).toBe("event_not_permitted");
  });

  it("AC-16: an admin edits someone else's event on another team, and the creator and team stay", async () => {
    const id = await createAs(FIXTURE_OTHER_TEAM_MEMBER.id, { scope: "team", name: "Team B lunch" });
    as(FIXTURE_ADMIN.id);
    const edited = await mock.updateEvent(id, input({ scope: "team", name: "Team B dinner" }));
    expect(edited.ok).toBe(true);
    if (edited.ok) {
      expect(edited.value.name).toBe("Team B dinner");
      expect(edited.value.creatorId).toBe(FIXTURE_OTHER_TEAM_MEMBER.id);
      expect(edited.value.teamId).toBe(FIXTURE_OTHER_TEAM.id);
    }
    // Still scoped to team B: team B reads it, the admin's own team does not.
    expect(await canRead(MEMBER_B2, id)).toBe(true);
    expect(await canRead(FIXTURE_MEMBER.id, id)).toBe(false);
  });

  it("AC-16: an admin deletes someone else's event", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "public" });
    as(FIXTURE_SECOND_ADMIN.id);
    expect((await mock.deleteEvent(id)).ok).toBe(true);
    expect(await canRead(FIXTURE_MEMBER.id, id)).toBe(false);
  });

  it("AC-17: a member or manager who did not create an event cannot change or delete it", async () => {
    const id = await createAs(FIXTURE_MEMBER.id, { scope: "named", inviteeIds: [FIXTURE_APPROVED_MEMBER.id, MANAGER_A] });
    as(FIXTURE_MEMBER.id);
    const before = await mock.getEvent(id);
    const listBefore = await mock.listEventInvitees(id);

    for (const who of [FIXTURE_APPROVED_MEMBER.id, MANAGER_A]) {
      expect(await canRead(who, id)).toBe(true);
      as(who);
      const edit = await mock.updateEvent(id, input({ name: "Hijacked", scope: "public" }));
      expect(edit.ok ? null : edit.error.code).toBe("event_not_permitted");
      const del = await mock.deleteEvent(id);
      expect(del.ok ? null : del.error.code).toBe("event_not_permitted");
    }

    as(FIXTURE_MEMBER.id);
    expect(await mock.getEvent(id)).toEqual(before);
    expect(await mock.listEventInvitees(id)).toEqual(listBefore);
  });

  it("AC-17: the refusal for an unreadable event is the same as for a missing one", async () => {
    const id = await createAs(FIXTURE_OTHER_TEAM_MEMBER.id, { scope: "team" });
    as(FIXTURE_MEMBER.id);
    const hidden = await mock.updateEvent(id, input());
    const missing = await mock.updateEvent("ec000000-0000-4000-8000-999999999999", input());
    expect(hidden).toEqual(missing);
  });

  it("AC-17: every write to the named list is keyed on is_admin, never on may_decide", () => {
    const manage = MIGRATION.match(/create or replace function public\.may_manage_event[\s\S]*?\$\$;/)?.[0] ?? "";
    expect(manage).toMatch(/public\.is_admin\(p_uid\)/);
    expect(MIGRATION_SQL).not.toMatch(/may_decide/);
  });
});

describe("what it does not touch", () => {
  it("AC-18: an event creates no entry and moves no count", async () => {
    as(FIXTURE_MEMBER.id);
    const range = { start: "2099-03-01", end: "2099-03-31" };
    const teamBefore = await mock.listTeamEntries();
    const rangeBefore = await mock.listTeamEntriesOverlapping(range);
    const ownBefore = await mock.listOwnEntries();

    await createAs(FIXTURE_MEMBER.id, { scope: "public", startDate: "2099-03-01", endDate: "2099-03-31" });

    as(FIXTURE_MEMBER.id);
    expect(await mock.listTeamEntries()).toEqual(teamBefore);
    expect(await mock.listTeamEntriesOverlapping(range)).toEqual(rangeBefore);
    expect(await mock.listOwnEntries()).toEqual(ownBefore);
  });
});
