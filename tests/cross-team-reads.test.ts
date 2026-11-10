// CAL-11 — an admin reads any team's entries and roster through the seam. 01-plan.md section 4.5.
//
// Drives the MOCK, through `__setCurrentMember` — the shape tests/seam-parity.test.ts:60-73
// documents. No fixture is added: the e2e suite reads the same fixtures this file does.
//
// AC-10, AC-11 are satisfied by the existing suite and tests/seam-parity.test.ts, UNEDITED, and are
// not repeated here. AC-12's Supabase refusals are exercised by no test until a project is
// provisioned (01-plan.md section 4.5) — the same status `listTeamEntriesOverlapping`'s had before
// CAL-09's paging test.
// MIR-07, 2026-10-23: the SQL half now runs. `public.list_members_for_team`,
// `list_team_entries_for_team` and `list_team_entries_overlapping_for_team` refusing every caller but
// an admin are exercised by `supabase/tests/020-entry-reads.test.sql`, `030-member-reads.test.sql`
// and `070-definer-callers.test.sql` (MIR-06). AC-12's completeness throws are in `supabase.ts`,
// not SQL, and are still exercised by no test.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { absenceCountsFor } from "@/lib/data/absence";
import { seam, __setCurrentMember } from "@/lib/data/mock";
import type { DateRange } from "@/lib/domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_ENTRY,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

const as = (memberId: string | null): void => __setCurrentMember(memberId);

afterEach(() => __setCurrentMember(null));

/** Covers FIXTURE_OTHER_TEAM_ENTRY (2026-09-21 to 2026-09-22). Reused by AC-3, AC-4 and AC-5. */
const COVERING: DateRange = { start: "2026-09-01", end: "2026-09-30" };

/** Excludes FIXTURE_OTHER_TEAM_ENTRY entirely. AC-4's negative half. */
const BEFORE: DateRange = { start: "2026-09-01", end: "2026-09-13" };

describe("AC-1 — roster of any team, removed members included", () => {
  it("AC-1: returns every member row of T, removed ones included, no pending sign-up, no other team", async () => {
    as(FIXTURE_ADMIN.id);
    const rows = await seam.listMembersForTeam(FIXTURE_TEAM.id);
    const ids = rows.map((m) => m.id);

    expect(ids).toContain(FIXTURE_REMOVED_MEMBER.id);
    const removed = rows.find((m) => m.id === FIXTURE_REMOVED_MEMBER.id);
    expect(removed?.removedAt).toBe(FIXTURE_REMOVED_MEMBER.removedAt);

    // NOT asserted by id: FIXTURE_PENDING_SIGNUP shares its literal id with FIXTURE_SECOND_ADMIN
    // (fixtures.ts:158,206), a pre-existing collision outside this ticket's allowed_paths — an id
    // check would coincidentally pass or fail on the WRONG row. `status` and `teamId` are what AC-1
    // actually states: no pending sign-up (they carry `teamId: null` and never match `m.teamId`),
    // and no row of another team.
    expect(rows.every((m) => m.status !== "pending")).toBe(true);
    expect(ids).not.toContain(FIXTURE_OTHER_TEAM_MEMBER.id);
    expect(rows.every((m) => m.teamId === FIXTURE_TEAM.id)).toBe(true);
  });
});

describe("AC-2 — the roster equals the own-team view", () => {
  it("AC-2: an admin not on T reads the same array a member of T reads from listMembers()", async () => {
    as(FIXTURE_ADMIN.id);
    const adminView = await seam.listMembersForTeam(FIXTURE_OTHER_TEAM.id);

    as(FIXTURE_OTHER_TEAM_MEMBER.id);
    const ownView = await seam.listMembers();

    expect(adminView).toEqual(ownView);
  });
});

describe("AC-3 — entries of any team, flat, note included", () => {
  it("AC-3: equals the own-team listTeamEntries() view, note included", async () => {
    as(FIXTURE_ADMIN.id);
    const adminView = await seam.listTeamEntriesForTeam(FIXTURE_OTHER_TEAM.id);

    as(FIXTURE_OTHER_TEAM_MEMBER.id);
    const ownView = await seam.listTeamEntries();

    expect(adminView).toEqual(ownView);
    const row = adminView.find((e) => e.id === FIXTURE_OTHER_TEAM_ENTRY.id);
    expect(row?.note).toBe(FIXTURE_OTHER_TEAM_ENTRY.note);
  });
});

describe("AC-4 — entries of any team, overlapping a range", () => {
  it("AC-4: equals the own-team overlapping view, and omits an entry wholly outside the range", async () => {
    as(FIXTURE_ADMIN.id);
    const adminView = await seam.listTeamEntriesOverlappingForTeam(FIXTURE_OTHER_TEAM.id, COVERING);

    as(FIXTURE_OTHER_TEAM_MEMBER.id);
    const ownView = await seam.listTeamEntriesOverlapping(COVERING);

    expect(adminView).toEqual(ownView);
    expect(adminView.map((e) => e.id)).toContain(FIXTURE_OTHER_TEAM_ENTRY.id);

    as(FIXTURE_ADMIN.id);
    const outside = await seam.listTeamEntriesOverlappingForTeam(FIXTURE_OTHER_TEAM.id, BEFORE);
    expect(outside.map((e) => e.id)).not.toContain(FIXTURE_OTHER_TEAM_ENTRY.id);
  });
});

describe("AC-5 — the absence count for T is the same number either way", () => {
  it("AC-5: absenceCountsFor agrees whichever pair of reads it is given", async () => {
    as(FIXTURE_ADMIN.id);
    const crossEntries = await seam.listTeamEntriesOverlappingForTeam(FIXTURE_OTHER_TEAM.id, COVERING);
    const crossRoster = await seam.listMembersForTeam(FIXTURE_OTHER_TEAM.id);
    const crossCounts = absenceCountsFor(crossEntries, COVERING, crossRoster);

    as(FIXTURE_OTHER_TEAM_MEMBER.id);
    const ownEntries = await seam.listTeamEntriesOverlapping(COVERING);
    const ownRoster = await seam.listMembers();
    const ownCounts = absenceCountsFor(ownEntries, COVERING, ownRoster);

    expect(crossCounts).toEqual(ownCounts);
    expect([...crossCounts.values()].some((n) => n > 0)).toBe(true);
  });
});

describe("AC-6 — a member is refused with an empty set, not an error", () => {
  it("AC-6: resolves to [] for the caller's own team and for another team", async () => {
    as(FIXTURE_MEMBER.id);
    for (const teamId of [FIXTURE_TEAM.id, FIXTURE_OTHER_TEAM.id]) {
      expect(await seam.listMembersForTeam(teamId)).toEqual([]);
      expect(await seam.listTeamEntriesForTeam(teamId)).toEqual([]);
      expect(await seam.listTeamEntriesOverlappingForTeam(teamId, COVERING)).toEqual([]);
    }
  });
});

describe("AC-7 — a manager is refused with an empty set, not an error", () => {
  it("AC-7: resolves to [] for the caller's own team and for another team", async () => {
    as(FIXTURE_ADMIN.id);
    const promoted = await seam.setMemberRole(FIXTURE_MEMBER.id, "manager");
    if (!promoted.ok) throw new Error(`could not make a manager: ${promoted.error.code}`);
    expect(promoted.value.role).toBe("manager");

    let restoreFailure: string | null = null;
    try {
      as(FIXTURE_MEMBER.id);
      for (const teamId of [FIXTURE_TEAM.id, FIXTURE_OTHER_TEAM.id]) {
        expect(await seam.listMembersForTeam(teamId)).toEqual([]);
        expect(await seam.listTeamEntriesForTeam(teamId)).toEqual([]);
        expect(await seam.listTeamEntriesOverlappingForTeam(teamId, COVERING)).toEqual([]);
      }
    } finally {
      as(FIXTURE_ADMIN.id);
      const back = await seam.setMemberRole(FIXTURE_MEMBER.id, "member");
      if (!back.ok) restoreFailure = back.error.code;
    }
    if (restoreFailure) throw new Error(`could not restore the rank: ${restoreFailure}`);
  });
});

describe("AC-8 — nobody else is answered either", () => {
  it("AC-8: no caller at all", async () => {
    as(null);
    expect(await seam.listMembersForTeam(FIXTURE_TEAM.id)).toEqual([]);
    expect(await seam.listTeamEntriesForTeam(FIXTURE_TEAM.id)).toEqual([]);
    expect(await seam.listTeamEntriesOverlappingForTeam(FIXTURE_TEAM.id, COVERING)).toEqual([]);
  });

  it("AC-8: a removed member", async () => {
    as(FIXTURE_REMOVED_MEMBER.id);
    expect(await seam.listMembersForTeam(FIXTURE_TEAM.id)).toEqual([]);
    expect(await seam.listTeamEntriesForTeam(FIXTURE_TEAM.id)).toEqual([]);
    expect(await seam.listTeamEntriesOverlappingForTeam(FIXTURE_TEAM.id, COVERING)).toEqual([]);
  });

  it("AC-8: an admin passing a team id that names no team", async () => {
    as(FIXTURE_ADMIN.id);
    const noSuchTeam = "00000000-0000-4000-8000-000000000000";
    expect(await seam.listMembersForTeam(noSuchTeam)).toEqual([]);
    expect(await seam.listTeamEntriesForTeam(noSuchTeam)).toEqual([]);
    expect(await seam.listTeamEntriesOverlappingForTeam(noSuchTeam, COVERING)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// AC-9. Static, over the migration text with `--` comment lines stripped — the shape
// tests/draft-entry.test.ts:303-316 uses for the same reason: the migrations DISCUSS these
// functions in prose at length, and a scanner that read that prose would fire on the explanation
// rather than the statement.
// ---------------------------------------------------------------------------

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const MIGRATION_PATH = "supabase/migrations/20260922150000_cal11_cross_team_reads.sql";

const statementsOf = (sql: string): string[] =>
  sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";");

const sql = readFileSync(repoRoot + MIGRATION_PATH, "utf8");
const statements = statementsOf(sql).map((s) => s.replace(/\s+/g, " ").trim());
const lower = statements.map((s) => s.toLowerCase());

const FUNCTIONS = [
  {
    name: "list_members_for_team",
    signature: "list_members_for_team(uuid)",
    creates: "create or replace function public.list_members_for_team(p_team_id uuid)",
  },
  {
    name: "list_team_entries_for_team",
    signature: "list_team_entries_for_team(uuid)",
    creates: "create or replace function public.list_team_entries_for_team(p_team_id uuid)",
  },
  {
    name: "list_team_entries_overlapping_for_team",
    signature: "list_team_entries_overlapping_for_team(uuid, date, date)",
    creates:
      "create or replace function public.list_team_entries_overlapping_for_team( p_team_id uuid, " +
      "p_start date, p_end date)",
  },
];

describe("AC-9 — the datastore half is shaped as the control", () => {
  it("AC-9: creates exactly the three functions named in section 4.1, each stable security definer", () => {
    const creations = lower.filter((s) => s.startsWith("create or replace function"));
    expect(creations).toHaveLength(3);

    for (const fn of FUNCTIONS) {
      const matches = lower.filter((s) => s.startsWith(fn.creates));
      expect(matches, fn.name).toHaveLength(1);
      expect(matches[0]).toContain("language sql stable security definer set search_path = ''");
    }
  });

  it("AC-9: each function's where clause begins with public.is_admin((select auth.uid()))", () => {
    for (const fn of FUNCTIONS) {
      const statement = lower.find((s) => s.startsWith(fn.creates));
      expect(statement, fn.name).toBeDefined();
      expect(statement).toContain("where public.is_admin((select auth.uid()))");
    }
  });

  it("AC-9: carries revoke all ... from public and grant execute ... to authenticated for each signature", () => {
    for (const fn of FUNCTIONS) {
      expect(
        lower.some((s) => s === `revoke all on function public.${fn.signature} from public`),
        `${fn.name} revoke`,
      ).toBe(true);
      expect(
        lower.some((s) => s === `grant execute on function public.${fn.signature} to authenticated`),
        `${fn.name} grant`,
      ).toBe(true);
    }
  });

  it("AC-9: contains no policy statement and no table grant", () => {
    expect(lower.some((s) => /create\s+(or\s+replace\s+)?policy/.test(s))).toBe(false);
    expect(lower.some((s) => /alter\s+policy/.test(s))).toBe(false);
    expect(lower.some((s) => /drop\s+policy/.test(s))).toBe(false);
    expect(lower.some((s) => /^grant\s+(select|insert|update|delete)\b/.test(s))).toBe(false);
  });
});
