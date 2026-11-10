// EVT-03 — the event layer on the week and month grids. 01-plan.md § 4.2–§ 4.4, § 7 "Tests owed".
//
// Three parts: the pure module (`src/lib/event-layer.ts`), the two seam reads against the mock
// (AC-9, AC-10, AC-12 and the own-attendance filter), and `teamReadsFor(...).events` for own and
// other — the CAL-12 AC-12 rule extended: an `other` read never calls `seam.listEvents()`.
//
// **THE MOCK REPRODUCES THE POLICIES; IT CANNOT PROVE THEM.** As `tests/events.test.ts` records, a
// permission-model test against a real PostgreSQL is owed project-wide. No policy changes here.
import { afterEach, describe, expect, it } from "vitest";
import type { DataSeam, SaveEventInput } from "@/lib/data";
import { seam as mock, __resetEvents, __setCurrentMember } from "@/lib/data/mock";
import type { CalEvent, EventAttendance } from "@/lib/domain/types";
import {
  eventsByDate,
  eventsOverlapping,
  eventsRelevantToTeam,
  MONTH_EVENT_LIMIT,
  takingPartIds,
} from "@/lib/event-layer";
import { teamReadsFor } from "@/lib/viewed-team";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

afterEach(() => {
  __resetEvents();
  as(null);
});

// ---------------------------------------------------------------------------
// Pure module
// ---------------------------------------------------------------------------

const ev = (overrides: Partial<CalEvent> & Pick<CalEvent, "id">): CalEvent => ({
  creatorId: "creator",
  teamId: "team-a",
  name: overrides.id,
  description: null,
  location: null,
  startDate: "2026-10-14",
  endDate: "2026-10-14",
  scope: "public",
  capacity: null,
  requiresApproval: false,
  registrationDeadline: null,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
  ...overrides,
});

const row = (eventId: string, memberId: string, status: EventAttendance["status"]): EventAttendance => ({
  eventId,
  memberId,
  status,
  createdAt: "2026-10-01T00:00:00Z",
  updatedAt: "2026-10-01T00:00:00Z",
});

describe("eventsOverlapping", () => {
  it("keeps an event whose inclusive span touches the range at either end, in input order", () => {
    const range = { start: "2026-10-01", end: "2026-10-31" };
    const events = [
      ev({ id: "before", startDate: "2026-09-20", endDate: "2026-09-30" }),
      ev({ id: "tail", startDate: "2026-09-29", endDate: "2026-10-01" }),
      ev({ id: "inside", startDate: "2026-10-14", endDate: "2026-10-16" }),
      ev({ id: "head", startDate: "2026-10-31", endDate: "2026-11-02" }),
      ev({ id: "after", startDate: "2026-11-01", endDate: "2026-11-01" }),
    ];
    expect(eventsOverlapping(events, range).map((e) => e.id)).toEqual(["tail", "inside", "head"]);
  });
});

describe("eventsByDate", () => {
  it("AC-1: one entry per covered day, and every date of the range is a key", () => {
    const range = { start: "2026-10-12", end: "2026-10-18" };
    const map = eventsByDate([ev({ id: "e", startDate: "2026-10-14", endDate: "2026-10-16" })], range);
    expect([...map.keys()]).toEqual([
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
      "2026-10-15",
      "2026-10-16",
      "2026-10-17",
      "2026-10-18",
    ]);
    for (const [date, list] of map) {
      const covered = date >= "2026-10-14" && date <= "2026-10-16";
      expect(list.map((e) => e.id)).toEqual(covered ? ["e"] : []);
    }
  });

  it("AC-2: a span is clipped to the range, not hidden", () => {
    const e = ev({ id: "e", startDate: "2026-09-29", endDate: "2026-10-02" });
    const oct = eventsByDate([e], { start: "2026-10-01", end: "2026-10-31" });
    expect([...oct].filter(([, l]) => l.length > 0).map(([d]) => d)).toEqual(["2026-10-01", "2026-10-02"]);
    const sep = eventsByDate([e], { start: "2026-09-01", end: "2026-09-30" });
    expect([...sep].filter(([, l]) => l.length > 0).map(([d]) => d)).toEqual(["2026-09-29", "2026-09-30"]);
  });

  it("AC-17 order: startDate, then name, then id", () => {
    const range = { start: "2026-10-14", end: "2026-10-14" };
    const events = [
      ev({ id: "z", name: "Beta", startDate: "2026-10-14" }),
      ev({ id: "b", name: "Alpha", startDate: "2026-10-14" }),
      ev({ id: "a", name: "Alpha", startDate: "2026-10-14" }),
      ev({ id: "early", name: "Zulu", startDate: "2026-10-10", endDate: "2026-10-14" }),
    ];
    expect(eventsByDate(events, range).get("2026-10-14")!.map((e) => e.id)).toEqual([
      "early",
      "a",
      "b",
      "z",
    ]);
  });

  it("the month cap is two", () => {
    expect(MONTH_EVENT_LIMIT).toBe(2);
  });
});

describe("takingPartIds", () => {
  const events = [
    ev({ id: "created", creatorId: "me" }),
    ev({ id: "attending" }),
    ev({ id: "pending" }),
    ev({ id: "rejected" }),
    ev({ id: "removed" }),
    ev({ id: "nothing" }),
    ev({ id: "someone-else" }),
  ];
  const attendance = [
    row("attending", "me", "attending"),
    row("pending", "me", "pending"),
    row("rejected", "me", "rejected"),
    row("removed", "me", "removed"),
    row("someone-else", "other", "attending"),
  ];

  it("AC-6, AC-7, AC-8: creator or own `attending` row, and nothing else", () => {
    expect([...takingPartIds(events, "me", attendance)].sort()).toEqual(["attending", "created"]);
  });

  it("AC-11: another member's attending row never marks the reader", () => {
    expect(takingPartIds(events, "me", attendance).has("someone-else")).toBe(false);
  });
});

describe("eventsRelevantToTeam", () => {
  it("AC-9: public, the viewed team's own-team events, and named events inviting someone on it", () => {
    const events = [
      ev({ id: "a", scope: "public", teamId: "C" }),
      ev({ id: "b", scope: "team", teamId: "B" }),
      ev({ id: "c", scope: "team", teamId: "A" }),
      ev({ id: "d", scope: "named", teamId: "A" }),
      ev({ id: "e", scope: "named", teamId: "B" }),
    ];
    const invitees = new Map([
      ["d", ["b1", "a1"]],
      ["e", ["a1", "c1"]],
    ]);
    const teamB = new Set(["b1", "b2"]);
    expect(eventsRelevantToTeam(events, "B", invitees, teamB).map((x) => x.id)).toEqual(["a", "b", "d"]);
  });

  it("a named event with no readable invitee list is not relevant", () => {
    const events = [ev({ id: "n", scope: "named" })];
    expect(eventsRelevantToTeam(events, "B", new Map(), new Set(["b1"]))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// The two seam reads, against the mock
// ---------------------------------------------------------------------------

const input = (overrides: Partial<SaveEventInput> = {}): SaveEventInput => ({
  name: "Gathering",
  description: null,
  location: null,
  startDate: "2099-03-10",
  endDate: "2099-03-10",
  scope: "public",
  inviteeIds: [],
  ...overrides,
});

async function createAs(memberId: string, overrides: Partial<SaveEventInput>): Promise<string> {
  as(memberId);
  const result = await mock.createEvent(input(overrides));
  if (!result.ok) throw new Error(`createEvent refused: ${result.error.code}`);
  return result.value.id;
}

/** Team A is FIXTURE_TEAM, team B is FIXTURE_OTHER_TEAM. The fixtures carry two teams, so the
 *  plan's "team C" public event is created on team A — scope `public` is relevant whatever its team. */
async function seedAc9(): Promise<Record<"a" | "b" | "c" | "d" | "e", string>> {
  return {
    a: await createAs(FIXTURE_MEMBER.id, { name: "a public", scope: "public" }),
    b: await createAs(FIXTURE_OTHER_TEAM_MEMBER.id, { name: "b team B", scope: "team" }),
    c: await createAs(FIXTURE_MEMBER.id, { name: "c team A", scope: "team" }),
    d: await createAs(FIXTURE_MEMBER.id, {
      name: "d named B",
      scope: "named",
      inviteeIds: [FIXTURE_OTHER_TEAM_MEMBER.id],
    }),
    e: await createAs(FIXTURE_MEMBER.id, {
      name: "e named A",
      scope: "named",
      inviteeIds: [FIXTURE_ADMIN.id],
    }),
  };
}

describe("listEventsForTeam (mock)", () => {
  it("AC-9: an admin viewing team B reads a, b and d — not c, not e", async () => {
    const ids = await seedAc9();
    as(FIXTURE_ADMIN.id);
    const got = (await mock.listEventsForTeam(FIXTURE_OTHER_TEAM.id)).map((e) => e.id);
    expect(got.sort()).toEqual([ids.a, ids.b, ids.d].sort());
  });

  it("keeps listEvents' order", async () => {
    await seedAc9();
    as(FIXTURE_ADMIN.id);
    const all = (await mock.listEvents()).map((e) => e.id);
    const narrowed = (await mock.listEventsForTeam(FIXTURE_OTHER_TEAM.id)).map((e) => e.id);
    expect(narrowed).toEqual(all.filter((id) => narrowed.includes(id)));
  });

  it("AC-10: a named invitee who has moved off team B no longer makes the event team B's", async () => {
    const ids = await seedAc9();
    as(FIXTURE_ADMIN.id);
    const moved = await mock.moveMember(FIXTURE_OTHER_TEAM_MEMBER.id, FIXTURE_TEAM.id);
    expect(moved.ok).toBe(true);
    try {
      const got = (await mock.listEventsForTeam(FIXTURE_OTHER_TEAM.id)).map((e) => e.id);
      expect(got).not.toContain(ids.d);
    } finally {
      as(FIXTURE_ADMIN.id);
      await mock.moveMember(FIXTURE_OTHER_TEAM_MEMBER.id, FIXTURE_OTHER_TEAM.id);
    }
  });

  it("AC-12: a non-admin's narrowed read is never wider than their own listEvents", async () => {
    await seedAc9();
    for (const who of [FIXTURE_MEMBER.id, FIXTURE_OTHER_TEAM_MEMBER.id]) {
      as(who);
      const own = new Set((await mock.listEvents()).map((e) => e.id));
      const narrowed = await mock.listEventsForTeam(FIXTURE_OTHER_TEAM.id);
      for (const e of narrowed) expect(own.has(e.id)).toBe(true);
      // No roster for a non-admin, so no named event is ever relevant through an invitee.
      expect(narrowed.some((e) => e.scope === "named")).toBe(false);
    }
  });

  it("a caller with no member row reads nothing", async () => {
    await seedAc9();
    as(null);
    expect(await mock.listEventsForTeam(FIXTURE_OTHER_TEAM.id)).toEqual([]);
  });
});

describe("listOwnEventAttendance (mock)", () => {
  it("AC-11: an admin reads their OWN rows only, though the policy hands them every row", async () => {
    const eventId = await createAs(FIXTURE_MEMBER.id, { name: "open", scope: "public" });
    as(FIXTURE_OTHER_TEAM_MEMBER.id);
    expect((await mock.joinEvent(eventId)).ok).toBe(true);
    as(FIXTURE_ADMIN.id);
    expect((await mock.joinEvent(eventId)).ok).toBe(true);

    as(FIXTURE_ADMIN.id);
    expect((await mock.listEventAttendance(eventId)).length).toBe(2);
    const own = await mock.listOwnEventAttendance();
    expect(own.map((a) => [a.eventId, a.memberId, a.status])).toEqual([
      [eventId, FIXTURE_ADMIN.id, "attending"],
    ]);
  });

  it("is empty for a caller with no member row", async () => {
    as(null);
    expect(await mock.listOwnEventAttendance()).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// teamReadsFor(...).events — the own/other switch, written once (CAL-12 § 8 alternative 2)
// ---------------------------------------------------------------------------

describe("teamReadsFor().events", () => {
  const sentinel = [ev({ id: "s" })];
  const stub = (overrides: Partial<DataSeam>): DataSeam =>
    ({
      listEvents: () => Promise.reject(new Error("own read called")),
      listEventsForTeam: () => Promise.reject(new Error("other read called")),
      ...overrides,
    }) as unknown as DataSeam;

  it("own -> seam.listEvents()", async () => {
    const reads = teamReadsFor(stub({ listEvents: () => Promise.resolve(sentinel) }), { kind: "own" });
    await expect(reads.events()).resolves.toBe(sentinel);
  });

  it("other -> seam.listEventsForTeam(team.id), and never the own read", async () => {
    let asked = "";
    const reads = teamReadsFor(
      stub({
        listEventsForTeam: (teamId: string) => {
          asked = teamId;
          return Promise.resolve(sentinel);
        },
      }),
      { kind: "other", team: FIXTURE_OTHER_TEAM },
    );
    await expect(reads.events()).resolves.toBe(sentinel);
    expect(asked).toBe(FIXTURE_OTHER_TEAM.id);
  });

  it("an other-team failure does not fall back to the own read", async () => {
    const reads = teamReadsFor(stub({}), { kind: "other", team: FIXTURE_OTHER_TEAM });
    await expect(reads.events()).rejects.toThrow("other read called");
  });
});
