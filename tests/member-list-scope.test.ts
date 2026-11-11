// MIR-17-f, ADR-094 — MemberList's three controls are scoped to the caller's active teams, the manager
// toggle follows the row's roster team role, and the two new seam reads answer only what the database
// would. 01-plan.md § 2 AC-1 to AC-5.
//
// AC-1 to AC-4 run on the pure predicates in `src/lib/roles.ts`: the mock holds one team per member, so
// a multi-team caller cannot be built through it. AC-5 drives the mock and reads the supabase seam's
// source, the shape `tests/role-guards.test.ts` uses.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Member, TeamRole } from "@/lib/domain/types";
import { seam as mock, __setCurrentMember } from "@/lib/data/mock";
import { FIXTURE_ADMIN, FIXTURE_MEMBER, FIXTURE_REMOVED_MEMBER } from "@/lib/fixtures";
import {
  managerToggleFor,
  mayPromoteMember,
  mayRemoveMember,
  maySetManager,
  type RosterScope,
} from "@/lib/roles";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const read = (file: string): string => readFileSync(repoRoot + file, "utf8");

const A = "team-a";
const B = "team-b";
const C = "team-c";

const quan: Member = { ...FIXTURE_ADMIN, id: "quan", teamId: A };
const binh: Member = { ...FIXTURE_MEMBER, id: "binh", teamId: B, role: "member" };
const chi: Member = { ...FIXTURE_MEMBER, id: "chi", teamId: C, role: "member" };
const vu: Member = { ...FIXTURE_MEMBER, id: "vu", teamId: A, role: "manager" };
const mona: Member = { ...FIXTURE_MEMBER, id: "mona", teamId: A, role: "manager" };
const thanh: Member = { ...FIXTURE_MEMBER, id: "thanh", teamId: A, role: "member" };
const otherAdmin: Member = { ...FIXTURE_ADMIN, id: "admin2", teamId: A };

const roles = (entries: [string, TeamRole][]): ReadonlyMap<string, TeamRole> => new Map(entries);

const quanScope: RosterScope = {
  ownTeamIds: [A, B],
  teamRoles: roles([
    ["binh", "member"],
    ["chi", "member"],
    ["vu", "member"],
    ["admin2", "member"],
  ]),
};

describe("MIR-17-f AC-1: an admin is offered the three controls on any of their active teams", () => {
  it("AC-1: Quan and Binh (team B)", () => {
    expect(mayRemoveMember(quan, binh, quanScope)).toBe(true);
    expect(mayPromoteMember(quan, binh, quanScope)).toBe(true);
    expect(maySetManager(quan, binh, quanScope)).toBe(true);
  });
});

describe("MIR-17-f AC-2: and on no other row", () => {
  it("AC-2: Chi (team C) and Quan himself get none", () => {
    for (const row of [chi, quan]) {
      expect(mayRemoveMember(quan, row, quanScope)).toBe(false);
      expect(mayPromoteMember(quan, row, quanScope)).toBe(false);
      expect(maySetManager(quan, row, quanScope)).toBe(false);
    }
  });

  it("AC-2: an admin's row gets neither Promote nor the manager toggle", () => {
    expect(mayPromoteMember(quan, otherAdmin, quanScope)).toBe(false);
    expect(maySetManager(quan, otherAdmin, quanScope)).toBe(false);
  });

  it("AC-2: a row with no roster team role gets no manager toggle", () => {
    const noRoles: RosterScope = { ownTeamIds: [A, B], teamRoles: new Map() };
    expect(maySetManager(quan, binh, noRoles)).toBe(false);
  });
});

describe("MIR-17-f AC-3: nobody but an admin is offered any of them", () => {
  const everyone = roles([
    ["mona", "manager"],
    ["thanh", "member"],
    ["vu", "member"],
  ]);
  const scope: RosterScope = { ownTeamIds: [A], teamRoles: everyone };

  it("AC-3: a manager and a member get none", () => {
    for (const me of [mona, thanh]) {
      for (const row of [mona, thanh, vu].filter((r) => r.id !== me.id)) {
        expect(mayRemoveMember(me, row, scope)).toBe(false);
        expect(mayPromoteMember(me, row, scope)).toBe(false);
        expect(maySetManager(me, row, scope)).toBe(false);
      }
    }
  });
});

describe("MIR-17-f AC-4: the manager toggle follows the roster team's rank", () => {
  it("AC-4: label and next role come from the roster team role", () => {
    expect(managerToggleFor("member")).toEqual({ label: "Make manager", next: "manager" });
    expect(managerToggleFor("manager")).toEqual({ label: "Remove manager", next: "member" });
  });

  it("AC-4: MemberList takes the toggle from the row's teamRoles entry, never member.role", () => {
    const source = read("src/routes/MemberList.tsx");
    expect(source).toContain("scope.teamRoles.get(member.id)");
    expect(source).toContain("managerToggleFor(");
  });
});

describe("MIR-17-f AC-5: the two reads answer only what the database would", () => {
  it("AC-5: listOwnTeamIds is the admin's team, then [] for nobody and for a removed member", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    expect(await mock.listOwnTeamIds()).toEqual([FIXTURE_ADMIN.teamId]);
    __setCurrentMember(null);
    expect(await mock.listOwnTeamIds()).toEqual([]);
    __setCurrentMember(FIXTURE_REMOVED_MEMBER.id);
    expect(await mock.listOwnTeamIds()).toEqual([]);
  });

  it("AC-5: listRosterTeamRoles is one entry per member with a team, for an admin only", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const roster = await mock.listAllMembers();
    const roles = await mock.listRosterTeamRoles();
    expect(roles.length).toBe(roster.filter((m) => m.teamId !== null).length);
    for (const r of roles) {
      const m = roster.find((x) => x.id === r.memberId);
      expect(r.teamRole).toBe(m?.role === "manager" ? "manager" : "member");
    }

    __setCurrentMember(FIXTURE_MEMBER.id);
    expect(await mock.listRosterTeamRoles()).toEqual([]);
    __setCurrentMember(null);
    expect(await mock.listRosterTeamRoles()).toEqual([]);
  });

  it("AC-5: the supabase seam reads list_all_members + roster_team_role and member_team_ids", () => {
    const source = read("src/lib/data/supabase.ts");
    const roleBody = source.slice(source.indexOf("async listRosterTeamRoles"));
    expect(roleBody.slice(0, roleBody.indexOf("async listOwnTeamIds"))).toContain(
      'rpc("list_all_members")',
    );
    expect(source).toContain('"id, team_role:roster_team_role"');
    const idsBody = source.slice(source.indexOf("async listOwnTeamIds"));
    expect(idsBody.slice(0, 600)).toContain('rpc("member_team_ids"');
  });
});
