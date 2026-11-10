// CAL-12 — which team the calendar screens and the sidebar roster draw. 01-plan.md § 4.8.
//
// Pure logic and the one read switch, against the MOCK through `__setCurrentMember`, the shape
// tests/cross-team-reads.test.ts uses. AC-12 and AC-13 live here only: the mock cannot be made to
// fail from the browser, and the denial is below the interface.
import { afterEach, describe, expect, it } from "vitest";
import { absenceCountsFor } from "@/lib/data/absence";
import { seam, __setCurrentMember } from "@/lib/data/mock";
import type { DataSeam } from "@/lib/data";
import type { DateRange, MemberRole, Team } from "@/lib/domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_TEAM,
} from "@/lib/fixtures";
import {
  isCalendarPath,
  isReadOnly,
  pickableTeams,
  resolveViewedTeam,
  teamReadsFor,
  withTeamParam,
  type ViewedTeam,
} from "@/lib/viewed-team";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

afterEach(() => __setCurrentMember(null));

const A = FIXTURE_TEAM;
const B = FIXTURE_OTHER_TEAM;
const TEAMS: readonly Team[] = [B, A];
const SEPTEMBER: DateRange = { start: "2026-09-01", end: "2026-09-30" };

const resolve = (role: MemberRole, requested: string | null, teams: readonly Team[] | null | "failed" = TEAMS) =>
  resolveViewedTeam({ role, ownTeamId: A.id, requested, teams });

describe("resolveViewedTeam — rules 1 to 7", () => {
  it("AC-3: rule 1 — a member's or a manager's parameter is ignored, not stripped", () => {
    for (const role of ["member", "manager"] as const) {
      expect(resolve(role, B.id)).toEqual({ viewed: { kind: "own" }, dropParam: false });
    }
  });

  it("AC-1: rule 2 — no parameter, or an empty one, is the own team", () => {
    expect(resolve("admin", null)).toEqual({ viewed: { kind: "own" }, dropParam: false });
    expect(resolve("admin", "")).toEqual({ viewed: { kind: "own" }, dropParam: false });
  });

  it("AC-11: rule 3 — the own team's id is treated as no parameter, and dropped", () => {
    expect(resolve("admin", A.id)).toEqual({ viewed: { kind: "own" }, dropParam: true });
  });

  it("AC-12: rule 4 — teams not yet loaded is resolving", () => {
    expect(resolve("admin", B.id, null)).toEqual({ viewed: { kind: "resolving" }, dropParam: false });
  });

  it("AC-12: rule 5 — a failed team list is unavailable, never the own team", () => {
    expect(resolve("admin", B.id, "failed")).toEqual({ viewed: { kind: "unavailable" }, dropParam: false });
  });

  it("AC-4: rule 6 — a listed team is the other team, its row from the list", () => {
    expect(resolve("admin", B.id)).toEqual({ viewed: { kind: "other", team: B }, dropParam: false });
  });

  it("AC-11: rule 7 — an id that names no listed team falls back to the own team and is dropped", () => {
    for (const id of ["not-a-uuid", "00000000-0000-4000-8000-000000000000"]) {
      expect(resolve("admin", id)).toEqual({ viewed: { kind: "own" }, dropParam: true });
    }
  });
});

describe("pickableTeams", () => {
  it("AC-2: an admin with one team gets no picker", () => {
    expect(pickableTeams("admin", [A])).toEqual([]);
  });

  it("AC-3: a member or a manager with two teams gets no picker", () => {
    expect(pickableTeams("member", TEAMS)).toEqual([]);
    expect(pickableTeams("manager", TEAMS)).toEqual([]);
  });

  it("AC-2: an admin with two teams gets every team, sorted by name", () => {
    expect(pickableTeams("admin", TEAMS).map((t) => t.id)).toEqual([A.id, B.id]);
  });
});

describe("isCalendarPath and withTeamParam", () => {
  it("AC-7: the eight calendar shapes are calendar paths, trailing slash tolerated", () => {
    for (const path of [
      "/",
      "/week",
      "/week/2026-09-21",
      "/month",
      "/month/2026-09",
      "/year",
      "/year/2026",
      "/year/2026/members",
      "/month/2026-09/",
    ]) {
      expect(isCalendarPath(path), path).toBe(true);
    }
  });

  it("AC-10: the admin-panel screens and the rest of the shell are not", () => {
    for (const path of ["/entries/pending", "/entries/team", "/members", "/setting", "/events", "/teams", "/profile"]) {
      expect(isCalendarPath(path), path).toBe(false);
    }
  });

  it("AC-7: withTeamParam carries `team` across, and only `team`", () => {
    expect(withTeamParam("/month/2026-10", "")).toBe("/month/2026-10");
    expect(withTeamParam("/month/2026-10", "?other=1")).toBe("/month/2026-10");
    expect(withTeamParam("/month/2026-10", `?team=${B.id}`)).toBe(`/month/2026-10?team=${B.id}`);
    expect(withTeamParam("/month?x=1", `?team=${B.id}`)).toBe(`/month?x=1&team=${B.id}`);
    expect(withTeamParam("/week", "?team=a%20b")).toBe("/week?team=a%20b");
  });
});

describe("isReadOnly", () => {
  it("AC-9: every kind but own is read-only", () => {
    const cases: [ViewedTeam, boolean][] = [
      [{ kind: "own" }, false],
      [{ kind: "resolving" }, true],
      [{ kind: "unavailable" }, true],
      [{ kind: "other", team: B }, true],
    ];
    for (const [viewed, expected] of cases) expect(isReadOnly(viewed)).toBe(expected);
  });
});

describe("teamReadsFor", () => {
  it("AC-6: an admin's counts for B equal B's member's own counts, and the threshold is B's row", async () => {
    as(FIXTURE_ADMIN.id);
    const row = (await seam.listTeams()).find((t) => t.id === B.id);
    expect(row).toBeDefined();
    const other = teamReadsFor(seam, { kind: "other", team: row! });
    const adminCounts = absenceCountsFor(
      await other.entriesOverlapping(SEPTEMBER),
      SEPTEMBER,
      await other.roster(),
    );
    expect(await other.team()).toEqual(row);
    expect((await other.team())?.overloadThreshold).toBe(B.overloadThreshold);

    as(FIXTURE_OTHER_TEAM_MEMBER.id);
    const own = teamReadsFor(seam, { kind: "own" });
    const memberCounts = absenceCountsFor(await own.entriesOverlapping(SEPTEMBER), SEPTEMBER, await own.roster());

    expect(adminCounts).toEqual(memberCounts);
    expect(adminCounts.get("2026-09-21")).toBeGreaterThan(0);
  });

  it("AC-12: an other-team read that fails rejects, and never calls an own-team read", async () => {
    const ownCalled: string[] = [];
    const refuse = (name: string) => () => {
      ownCalled.push(name);
      throw new Error(`own-team read ${name} called`);
    };
    const stub = {
      getTeam: refuse("getTeam"),
      listMembers: refuse("listMembers"),
      listTeamEntriesOverlapping: refuse("listTeamEntriesOverlapping"),
      listTeamBusyDaysOverlapping: refuse("listTeamBusyDaysOverlapping"),
      listMembersForTeam: () => Promise.reject(new Error("transport")),
      listTeamEntriesOverlappingForTeam: () => Promise.reject(new Error("transport")),
    } as unknown as DataSeam;

    const reads = teamReadsFor(stub, { kind: "other", team: B });
    await expect(reads.roster()).rejects.toThrow("transport");
    await expect(reads.entriesOverlapping(SEPTEMBER)).rejects.toThrow("transport");
    expect(await reads.team()).toEqual(B);
    expect(await reads.busyDaysOverlapping(SEPTEMBER)).toEqual([]);
    expect(ownCalled).toEqual([]);
  });

  it("AC-13: a member made to call the cross-team reads for B receives empty sets", async () => {
    as(FIXTURE_MEMBER.id);
    const reads = teamReadsFor(seam, { kind: "other", team: B });
    expect(await reads.roster()).toEqual([]);
    expect(await reads.entriesOverlapping(SEPTEMBER)).toEqual([]);
  });
});
