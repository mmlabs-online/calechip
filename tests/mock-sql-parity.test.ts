// MIR-07 — the mock is no looser than SQL on any permission decision. 01-plan.md § 2 and § 4.4.
//
// **THE CASE TABLE IS NOT IN THIS FILE.** It is read from `supabase/tests/100-mock-parity.test.sql`,
// the pgTAP file that asserts the same cases against real SQL, so both suites are held to the same
// bytes (AC-4). Copying it here would make two tables, and two tables can drift apart while each
// side passes its own.
//
// Every expected value in that table is written by hand. Nothing below computes one: a formula here
// would be a third implementation written from the same understanding as the other two (01-plan.md
// § 8, the third rejected alternative).
//
// Drives the MOCK through `__setCurrentMember`, `__putMemberForTest` and `__permissionDecisions` —
// named exports beside `seam`, so `tests/seam-parity.test.ts` is untouched. Each case puts a row of
// its own; rows the seam-level tests change are restored.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { UpdateOwnProfileInput } from "@/lib/data";
import {
  seam,
  __permissionDecisions,
  __putMemberForTest,
  __setCurrentMember,
} from "@/lib/data/mock";
import { AVATAR_CHOICES } from "@/lib/domain/types";
import type { Member, MemberRole, MemberStatus } from "@/lib/domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_ENTRY,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_ID,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

// ---------------------------------------------------------------------------
// The case table, § 4.2.
// ---------------------------------------------------------------------------

const MARKER = "$parity$";
const SQL_PATH = fileURLToPath(new URL("../supabase/tests/100-mock-parity.test.sql", import.meta.url));
const SQL_TEXT = readFileSync(SQL_PATH, "utf8");

interface PredicateCase {
  id: string;
  role: MemberRole;
  status: MemberStatus;
  removed: boolean;
  on_team: boolean;
  is_admin: boolean;
  has_team: boolean;
  may_decide: boolean;
}

type Subject =
  | "approved_member"
  | "approved_manager"
  | "approved_admin"
  | "pending"
  | "rejected"
  | "removed";
type Column = "display_name" | "avatar" | "role" | "status" | "team_id" | "removed_at";

interface OwnUpdateCase {
  id: string;
  subject: Subject;
  column: Column;
  value: string;
  expected: "allowed" | "refused";
}

const markerCount = SQL_TEXT.split(MARKER).length - 1;
const [, tableText = ""] = SQL_TEXT.split(MARKER);
const table = JSON.parse(tableText) as { predicates: PredicateCase[]; own_update: OwnUpdateCase[] };

const ROLES: MemberRole[] = ["member", "manager", "admin"];
const STATUSES: MemberStatus[] = ["pending", "approved", "rejected"];
const BOOLS = [false, true];
const SUBJECTS: Subject[] = [
  "approved_member",
  "approved_manager",
  "approved_admin",
  "pending",
  "rejected",
  "removed",
];
const COLUMNS: Column[] = ["display_name", "avatar", "role", "status", "team_id", "removed_at"];

// The subject's id, the scheme the pgTAP file uses: P-NN is …7000+NN, U-NN is …7100+NN. Ids are
// only labels here; sharing the scheme makes a failing case findable on both sides by one number.
const subjectId = (caseId: string): string =>
  `00000000-0000-4000-8000-00000000${(caseId.startsWith("P") ? 7000 : 7100) + Number(caseId.slice(2))}`;

const REMOVED_AT = "2026-10-01T00:00:00+00:00";

/** A fresh row in the stated state. Everything not stated is a fixture member's. */
const row = (
  id: string,
  role: MemberRole,
  status: MemberStatus,
  removed: boolean,
  onTeam: boolean,
): Member => ({
  ...FIXTURE_MEMBER,
  id,
  email: `${id}@mir07.test`,
  displayName: id,
  avatar: "1.png",
  role,
  status,
  removedAt: removed ? REMOVED_AT : null,
  teamId: onTeam ? FIXTURE_TEAM.id : null,
});

// The own-update subjects of § 4.2.
const SUBJECT_STATE: Record<Subject, [MemberRole, MemberStatus, boolean, boolean]> = {
  approved_member: ["member", "approved", false, true],
  approved_manager: ["manager", "approved", false, true],
  approved_admin: ["admin", "approved", false, true],
  pending: ["member", "pending", false, false],
  rejected: ["member", "rejected", false, false],
  removed: ["member", "approved", true, true],
};

// The mock's key for each column, and the value the table's symbol stands for on this side.
const MOCK_KEY: Record<Column, string> = {
  display_name: "displayName",
  avatar: "avatar",
  role: "role",
  status: "status",
  team_id: "teamId",
  removed_at: "removedAt",
};
const mockValue = (c: OwnUpdateCase): string => {
  if (c.column === "team_id" && c.value === "U") return FIXTURE_OTHER_TEAM_ID;
  if (c.column === "removed_at" && c.value === "now") return new Date().toISOString();
  return c.value;
};

afterEach(() => __setCurrentMember(null));

describe("MIR-07 AC-4 — one case table, read from the pgTAP file", () => {
  it("AC-4 the marker appears exactly twice, so the table has one opening and one closing", () => {
    expect(markerCount).toBe(2);
  });

  it("AC-4 the avatar the table writes is one the mock offers", () => {
    // 01-plan.md § 4.2 TODO(verify): `2.png` must be in AVATAR_CHOICES under vitest, or an
    // `allowed` avatar case would be refused for a reason that is not a permission.
    expect(AVATAR_CHOICES).toContain("2.png");
  });
});

describe("MIR-07 AC-5 — the three shared predicates, the whole matrix", () => {
  it("AC-5 exactly 36 rows, every role × status × removed × on_team, none twice", () => {
    expect(table.predicates).toHaveLength(36);
    const seen = new Set(
      table.predicates.map((c) => `${c.role}|${c.status}|${c.removed}|${c.on_team}`),
    );
    expect(seen.size).toBe(36);
    for (const role of ROLES)
      for (const status of STATUSES)
        for (const removed of BOOLS)
          for (const onTeam of BOOLS) expect(seen).toContain(`${role}|${status}|${removed}|${onTeam}`);
    expect(new Set(table.predicates.map((c) => c.id)).size).toBe(36);
  });

  for (const c of table.predicates) {
    it(`AC-5 ${c.id}`, () => {
      const id = subjectId(c.id);
      __putMemberForTest(row(id, c.role, c.status, c.removed, c.on_team));
      const answer = __permissionDecisions(id);
      expect({
        is_admin: answer.isAdmin,
        has_team: answer.memberTeamId !== null,
        may_decide: answer.mayDecide,
      }).toEqual({ is_admin: c.is_admin, has_team: c.has_team, may_decide: c.may_decide });
    });
  }
});

describe("MIR-07 AC-6 — own-row writes, the attack included", () => {
  it("AC-6 exactly 36 rows, every subject × column, none twice", () => {
    expect(table.own_update).toHaveLength(36);
    const seen = new Set(table.own_update.map((c) => `${c.subject}|${c.column}`));
    expect(seen.size).toBe(36);
    for (const subject of SUBJECTS)
      for (const column of COLUMNS) expect(seen).toContain(`${subject}|${column}`);
    expect(new Set(table.own_update.map((c) => c.id)).size).toBe(36);
  });

  for (const c of table.own_update) {
    it(`AC-6 ${c.id}`, async () => {
      const id = subjectId(c.id);
      const [role, status, removed, onTeam] = SUBJECT_STATE[c.subject];
      const before = row(id, role, status, removed, onTeam);
      __putMemberForTest(before);
      __setCurrentMember(id);

      // The attack reaches the mock as it reaches PostgREST through a hand-written PATCH: a key the
      // seam's type does not name, cast past it.
      const value = mockValue(c);
      const input = {
        displayName: before.displayName,
        avatar: before.avatar,
        [MOCK_KEY[c.column]]: value,
      } as unknown as UpdateOwnProfileInput;
      const result = await seam.updateOwnProfile(input);

      const stored = (await seam.getCurrentMember()) ?? null;
      if (c.expected === "allowed") {
        expect(result.ok).toBe(true);
        expect((stored as unknown as Record<string, unknown>)[MOCK_KEY[c.column]]).toBe(value);
      } else {
        expect(result.ok).toBe(false);
        expect(stored).toEqual(before);
      }
    });
  }
});

// ---------------------------------------------------------------------------
// AC-1, AC-2, AC-3 — the predicates as a seam caller meets them.
// ---------------------------------------------------------------------------

describe("MIR-07 AC-1 to AC-3 — the seam treats a non-approved row as SQL does", () => {
  it("AC-1 a pending admin is not an admin: no queue, no team created", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const teamsBefore = (await seam.listTeams()).length;

    const id = "00000000-0000-4000-8000-000000007201";
    __putMemberForTest(row(id, "admin", "pending", false, true));
    __setCurrentMember(id);

    expect(await seam.listPendingMembers()).toEqual([]);
    const created = await seam.createTeam({ name: "MIR-07 pending admin's team" });
    expect(created.ok).toBe(false);
    if (!created.ok) expect(created.error.code).toBe("not_permitted");

    __setCurrentMember(FIXTURE_ADMIN.id);
    expect(await seam.listTeams()).toHaveLength(teamsBefore);
  });

  it("AC-2 a teammate whose status is no longer approved is on no team: their entries vanish", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    expect((await seam.listTeamEntries()).map((e) => e.id)).toContain(FIXTURE_APPROVED_ENTRY.id);

    try {
      __putMemberForTest({ ...FIXTURE_APPROVED_MEMBER, status: "rejected" });
      __setCurrentMember(FIXTURE_MEMBER.id);
      expect((await seam.listTeamEntries()).map((e) => e.id)).not.toContain(
        FIXTURE_APPROVED_ENTRY.id,
      );
    } finally {
      __putMemberForTest({ ...FIXTURE_APPROVED_MEMBER });
    }
  });

  it("AC-3 a pending manager may not approve an entry, and the entry stays pending", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const createdEntry = await seam.createEntry({
      type: "pto",
      portion: "full",
      startDate: "2031-03-03",
      endDate: "2031-03-03",
      tentative: false,
      note: null,
    });
    expect(createdEntry.ok).toBe(true);
    if (!createdEntry.ok) return;
    expect(createdEntry.value.status).toBe("pending");

    const id = "00000000-0000-4000-8000-000000007301";
    __putMemberForTest(row(id, "manager", "pending", false, true));
    __setCurrentMember(id);
    const decided = await seam.approveEntry(createdEntry.value.id);
    expect(decided.ok).toBe(false);

    __setCurrentMember(FIXTURE_MEMBER.id);
    const reread = (await seam.listOwnEntries()).find((e) => e.id === createdEntry.value.id);
    expect(reread?.status).toBe("pending");
  });
});
