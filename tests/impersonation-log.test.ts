// MIR-20-b AC-5 — the mock answers as `public.list_impersonation_log()` does (01-plan.md § 2, § 4.3).
// The database side is supabase/tests/400-impersonation-log.test.sql.
import { afterEach, describe, expect, it } from "vitest";
import { seam, __putMemberForTest, __setCurrentMember, __setDedicatedOrgMembersForTest } from "@/lib/data/mock";
import type { Member } from "@/lib/domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_ID,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

const L1 = "ab000000-0000-4000-8000-000000000001";
const L2 = "ab000000-0000-4000-8000-000000000002";
const L3 = "ab000000-0000-4000-8000-000000000003";

const manager = (id: string, teamId: string, removedAt: string | null = null): Member => ({
  ...FIXTURE_MEMBER,
  id,
  teamId,
  role: "manager",
  removedAt,
});

const idsAs = async (id: string | null): Promise<string[]> => {
  __setCurrentMember(id);
  return (await seam.listImpersonationLog()).map((e) => e.id);
};

afterEach(() => {
  __setCurrentMember(null);
  __setDedicatedOrgMembersForTest([]);
});

describe("MIR-20-b AC-5 — the mock log", () => {
  it("the org admin of Org public reads all three, newest first", async () => {
    expect(await idsAs(FIXTURE_ADMIN.id)).toEqual([L1, L2, L3]);
  });

  it("a manager reads the sessions on their own team only", async () => {
    __putMemberForTest(manager("ab100000-0000-4000-8000-000000000001", FIXTURE_TEAM.id));
    __putMemberForTest(manager("ab100000-0000-4000-8000-000000000002", FIXTURE_OTHER_TEAM_ID));
    expect(await idsAs("ab100000-0000-4000-8000-000000000001")).toEqual([L1, L3]);
    expect(await idsAs("ab100000-0000-4000-8000-000000000002")).toEqual([L2]);
  });

  it("a removed manager reads none", async () => {
    __putMemberForTest(
      manager("ab100000-0000-4000-8000-000000000003", FIXTURE_TEAM.id, "2026-11-01T00:00:00+00:00"),
    );
    expect(await idsAs("ab100000-0000-4000-8000-000000000003")).toEqual([]);
  });

  it("a plain member reads none", async () => {
    expect(await idsAs(FIXTURE_MEMBER.id)).toEqual([]);
  });

  it("an org admin of a dedicated org reads none of Org public's sessions", async () => {
    __setDedicatedOrgMembersForTest([FIXTURE_ADMIN.id]);
    expect(await idsAs(FIXTURE_ADMIN.id)).toEqual([]);
  });

  it("no current member reads none", async () => {
    expect(await idsAs(null)).toEqual([]);
  });

  it("a live session has a null endedAt and one that ran out reads its expiresAt", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const byId = new Map((await seam.listImpersonationLog()).map((e) => [e.id, e]));
    expect(byId.get(L1)?.endedAt).toBeNull();
    expect(byId.get(L3)?.endedAt).toBe(byId.get(L3)?.expiresAt);
  });
});
