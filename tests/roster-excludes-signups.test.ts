// SOLO (TEA-09), 2026-09-29 — a sign-up nobody has decided is on no team's roster.
//
// The operator's report: an admin's sidebar listed two waiting sign-ups under MEMBERS. The cause was
// the REAL seam's `listMembers()`, which had no filter and so returned whatever the row-level policies
// admitted — and `member_select_pending_admin` admits every teamless, non-approved row to an admin.
// The mock filtered by team all along, which is why no test saw it.
//
// Two halves, because the two implementations are tested differently:
//   * the MOCK, driven as an admin — the behaviour every screen is written against;
//   * the REAL seam, by its source text — it cannot run without a provisioned project, so this pins
//     the filter the way tests/cross-team-reads.test.ts pins its migration.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { currentMemberCount } from "@/lib/data/absence";
import { seam, __setCurrentMember } from "@/lib/data/mock";
import { FIXTURE_ADMIN, FIXTURE_MEMBER, FIXTURE_PENDING_SIGNUP } from "@/lib/fixtures";

afterEach(() => __setCurrentMember(null));

describe("the roster excludes sign-ups nobody has decided", () => {
  it("an admin's listMembers() does not contain the pending sign-up", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const roster = await seam.listMembers();

    // BY TEAM AND STATUS, NOT BY ID. `FIXTURE_PENDING_SIGNUP` and `FIXTURE_SECOND_ADMIN` share the id
    // `88888888-…` in `src/lib/fixtures.ts` — a collision older than this test, and not this run's
    // to fix — so an id assertion here would find the second admin and fail for the wrong reason.
    expect(roster.some((m) => m.teamId === null)).toBe(false);
    expect(roster.some((m) => m.status !== "approved")).toBe(false);
    expect(roster.map((m) => m.displayName)).not.toContain(FIXTURE_PENDING_SIGNUP.displayName);
  });

  it("an admin and a member of the same team read the same roster, so INV-04's denominator agrees", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const adminView = await seam.listMembers();
    __setCurrentMember(FIXTURE_MEMBER.id);
    const memberView = await seam.listMembers();

    expect(adminView).toEqual(memberView);
    expect(currentMemberCount(adminView)).toBe(currentMemberCount(memberView));
  });

  it("the sign-up is still in the admin's queue — the filter hides it from the roster only", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const pending = await seam.listPendingMembers();

    expect(pending.map((m) => m.displayName)).toContain(FIXTURE_PENDING_SIGNUP.displayName);
  });
});

describe("the real seam carries the same filter", () => {
  const repoRoot = fileURLToPath(new URL("..", import.meta.url));
  const source = readFileSync(repoRoot + "src/lib/data/supabase.ts", "utf8");

  /** The body of `listMembers()`, up to the next seam method. */
  const body = (() => {
    const start = source.indexOf("async listMembers(): Promise<Member[]>");
    const end = source.indexOf("async ", start + 1);
    return source.slice(start, end);
  })();

  it("listMembers() exists where this test looks for it", () => {
    expect(body.length).toBeGreaterThan(0);
  });

  // MIR-21, ADR-077: the filter names the computed field `roster_team_id`, not the column.
  it("listMembers() filters roster_team_id not null, so member_select_pending_admin's rows never reach it", () => {
    expect(body).toMatch(/\.not\(\s*"roster_team_id"\s*,\s*"is"\s*,\s*null\s*\)/);
  });
});
