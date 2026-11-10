// MIR-14-b — `listEntryOwners`, at the level the standard assigns it. 01-plan.md § 4.6.
//
// AC-8 and AC-9, against the seam directly, the way tests/pending-entries.test.ts drives
// `listPendingEntries`. What a decider SEES is in tests/e2e/mir-14-b-worklist-teams.spec.ts; who the
// datastore names to whom (AC-1 to AC-7) is supabase/tests/180-entry-owners.test.sql.
//
// **THE SUPABASE HALF RUNS WITHOUT A CLIENT.** No `VITE_SUPABASE_URL` is set under vitest, so
// `client()` would throw on first use. A call that resolves (`[]`) or throws the bound's own sentence
// therefore proves it returned before any request was built.
import { afterEach, describe, expect, it } from "vitest";
import { seam as mock, __setCurrentMember } from "@/lib/data/mock";
import { seam as real } from "@/lib/data/supabase";
import { FIXTURE_ADMIN, FIXTURE_APPROVED_MEMBER, FIXTURE_MEMBER, FIXTURE_TEAM } from "@/lib/fixtures";
import { PENDING_PAGE_SIZE } from "@/lib/domain/types";

const UNKNOWN_ID = "00000000-0000-4000-8000-00000000dead";

/** `n` distinct, well-formed ids. */
const ids = (n: number): string[] =>
  Array.from({ length: n }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);

afterEach(() => {
  __setCurrentMember(null);
});

describe("MIR-14-b AC-8 — one owner per id, with every team", () => {
  it("names a teammate to the team's admin, and drops an id that names nobody", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);

    const owners = await mock.listEntryOwners([FIXTURE_APPROVED_MEMBER.id, UNKNOWN_ID]);

    expect(owners).toEqual([
      {
        memberId: FIXTURE_APPROVED_MEMBER.id,
        displayName: FIXTURE_APPROVED_MEMBER.displayName,
        avatar: FIXTURE_APPROVED_MEMBER.avatar,
        teams: [{ id: FIXTURE_TEAM.id, name: FIXTURE_TEAM.name }],
      },
    ]);
  });

  it("returns one owner for a repeated id", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);

    const owners = await mock.listEntryOwners([FIXTURE_APPROVED_MEMBER.id, FIXTURE_APPROVED_MEMBER.id]);

    expect(owners.map((o) => o.memberId)).toEqual([FIXTURE_APPROVED_MEMBER.id]);
  });

  it("resolves [] to [] in both seams, without a request", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);

    await expect(mock.listEntryOwners([])).resolves.toEqual([]);
    await expect(real.listEntryOwners([])).resolves.toEqual([]);
  });

  it("names nobody to an ordinary member", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);

    await expect(mock.listEntryOwners([FIXTURE_APPROVED_MEMBER.id, UNKNOWN_ID])).resolves.toEqual([]);
  });
});

describe("MIR-14-b AC-9 — an oversized call is refused before any request", () => {
  const sentence = `listEntryOwners was asked for ${PENDING_PAGE_SIZE + 1} owners, more than one page (${PENDING_PAGE_SIZE})`;

  it("throws in the mock seam", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);

    await expect(mock.listEntryOwners(ids(PENDING_PAGE_SIZE + 1))).rejects.toThrow(sentence);
  });

  it("throws in the supabase seam", async () => {
    await expect(real.listEntryOwners(ids(PENDING_PAGE_SIZE + 1))).rejects.toThrow(sentence);
  });

  it("counts distinct ids, so a page of one repeated id is not oversized", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);

    const repeated = Array.from({ length: PENDING_PAGE_SIZE + 1 }, () => FIXTURE_APPROVED_MEMBER.id);

    await expect(mock.listEntryOwners(repeated)).resolves.toHaveLength(1);
  });
});
