// SOLO, 2026-09-12 — ADR-035. The `manager` rank, at the seam.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so nothing here is numbered `AC-n`:
// that prefix is a claim that a plan document states the criterion. `.claude/agents/solo.md` and
// ADR-035 are the authority, and each test below names the clause of that ADR it asserts.
//
// **THE MOCK IS THE SUBJECT AND THE MIGRATION IS WHAT IT REPRODUCES.** `public.may_decide`, the
// `entry_update_manager` policy and clauses (a) and (a2) of `public.entry_enforce_decision()` live in
// `supabase/migrations/20260912100000_solo_manager_role.sql` and are exercised by NO test until a
// project is provisioned — RULE-09 keeps applying it human, and `tests/permission-model.test.ts`
// still does not exist. What can be asserted here is that the mock refuses where the datastore
// refuses, and that matters because the acceptance suite drives the mock (BUG-001,
// `tests/e2e/seam.setup.ts`): a permissive mock would let every manager test in that suite pass
// against a datastore nobody has checked.
//
// **NO NEW FIXTURE MEMBER, DELIBERATELY.** Adding a seventh person to the team would move INV-04's
// denominator, the sidebar's `TEAM (n)` count and every roster assertion in the browser suite. Each
// test here promotes an EXISTING fixture member to `manager` through the seam and puts the rank back
// afterwards, which also exercises `setMemberRole` on the way in.
//
// EVERY TEST RESTORES WHAT IT WROTE. `members` is module state that lives for the whole file and the
// mock offers no reseed, so a test that left somebody a manager would silently change what every
// test after it asserts against.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { seam, __setCurrentMember } from "@/lib/data/mock";
import type { Entry, EntryType } from "@/lib/domain/types";
import { FIXTURE_ADMIN, FIXTURE_APPROVED_MEMBER, FIXTURE_MEMBER } from "@/lib/fixtures";

const as = (memberId: string): void => __setCurrentMember(memberId);

/** A day nothing else in the suite uses, so INV-01's overlap check never decides a test for us. */
let nextDay = 10;
function freeRange(): { startDate: string; endDate: string } {
  const day = String(nextDay++).padStart(2, "0");
  return { startDate: `2032-03-${day}`, endDate: `2032-03-${day}` };
}

/** One pending entry owned by `ownerId`, created the way a person creates one. */
async function pending(ownerId: string, type: EntryType = "pto"): Promise<Entry> {
  as(ownerId);
  const result = await seam.createEntry({
    type,
    portion: "full",
    tentative: false,
    note: null,
    ...freeRange(),
  });
  if (!result.ok) throw new Error(`could not create the entry under test: ${result.error.code}`);
  return result.value;
}

/** Makes `memberId` a manager, as the admin. Returns the undo. */
async function asManager(memberId: string): Promise<() => Promise<void>> {
  as(FIXTURE_ADMIN.id);
  const promoted = await seam.setMemberRole(memberId, "manager");
  if (!promoted.ok) throw new Error(`could not make a manager: ${promoted.error.code}`);
  expect(promoted.value.role).toBe("manager");

  return async () => {
    as(FIXTURE_ADMIN.id);
    const back = await seam.setMemberRole(memberId, "member");
    if (!back.ok) throw new Error(`could not restore the rank: ${back.error.code}`);
  };
}

let undo: (() => Promise<void>) | null = null;

afterEach(async () => {
  if (undo) await undo();
  undo = null;
});

describe("ADR-035 — who may set the rank", () => {
  it("an admin makes a member a manager, and puts them back", async () => {
    undo = await asManager(FIXTURE_MEMBER.id);

    as(FIXTURE_ADMIN.id);
    const roster = await seam.listMembers();
    expect(roster.find((m) => m.id === FIXTURE_MEMBER.id)?.role).toBe("manager");
  });

  it("a member cannot set anybody's rank, including their own", async () => {
    as(FIXTURE_MEMBER.id);

    const other = await seam.setMemberRole(FIXTURE_APPROVED_MEMBER.id, "manager");
    expect(other.ok).toBe(false);

    const own = await seam.setMemberRole(FIXTURE_MEMBER.id, "manager");
    expect(own.ok).toBe(false);
  });

  it("a manager cannot set anybody's rank either — the rank grants one power and this is not it", async () => {
    undo = await asManager(FIXTURE_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    const result = await seam.setMemberRole(FIXTURE_APPROVED_MEMBER.id, "manager");
    expect(result.ok).toBe(false);
  });

  it("an admin's rank cannot be changed — *Demote an admin to member* is not decided", async () => {
    as(FIXTURE_ADMIN.id);
    const result = await seam.setMemberRole(FIXTURE_ADMIN.id, "member");
    expect(result.ok).toBe(false);

    const roster = await seam.listMembers();
    expect(roster.find((m) => m.id === FIXTURE_ADMIN.id)?.role).toBe("admin");
  });
});

describe("ADR-035 § Decision — the one power the rank adds", () => {
  it("a manager approves another member's entry", async () => {
    const entry = await pending(FIXTURE_APPROVED_MEMBER.id);
    undo = await asManager(FIXTURE_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    const decided = await seam.approveEntry(entry.id);

    expect(decided.ok).toBe(true);
    if (decided.ok) {
      expect(decided.value.status).toBe("approved");
      // Clause (b), provenance: the decider is recorded, and the decider was the manager.
      expect(decided.value.approvedBy).toBe(FIXTURE_MEMBER.id);
    }
  });

  it("a manager rejects another member's entry, with the reason INV-03 requires", async () => {
    const entry = await pending(FIXTURE_APPROVED_MEMBER.id);
    undo = await asManager(FIXTURE_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    const decided = await seam.rejectEntry(entry.id, "The week is already crowded.");

    expect(decided.ok).toBe(true);
    if (decided.ok) {
      expect(decided.value.status).toBe("rejected");
      expect(decided.value.rejectionReason).toBe("The week is already crowded.");
    }
  });

  it("an ordinary member still cannot decide, which is what makes the rank mean anything", async () => {
    const entry = await pending(FIXTURE_APPROVED_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    const decided = await seam.approveEntry(entry.id);
    expect(decided.ok).toBe(false);
    // `entry_not_permitted` and NOT `entry_decision_not_permitted`: an ordinary member is refused a
    // row before any decision is considered, because neither `entry_update_own` nor
    // `entry_update_manager` admits somebody else's entry to them. "Not yours", "no such entry" and
    // "another team's" are deliberately ONE answer — the mock's own comment says why, and the code a
    // manager gets instead is asserted above.
    if (!decided.ok) expect(decided.error.code).toBe("entry_not_permitted");
  });
});

// MIR-14 — ADR-073 decision 3 SUPERSEDES ADR-035 § Decision item 3. A manager MAY decide their own
// entry; the database records it as `self_approved`, which `Entry` does not carry yet (MIR-14-b), so
// what the mock can show is the affordance and `approvedBy`. Numbered: MIR-14's plan states these.
describe("ADR-073 decision 3 — a manager may decide their own entry", () => {
  it("MIR-14 AC-21: a manager approves their own pending entry, recorded as theirs", async () => {
    const own = await pending(FIXTURE_MEMBER.id);
    undo = await asManager(FIXTURE_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    const decided = await seam.approveEntry(own.id);

    expect(decided.ok).toBe(true);
    if (decided.ok) expect(decided.value.approvedBy).toBe(FIXTURE_MEMBER.id);
  });

  it("an admin still may approve their own, which is the row that was decided in 2026-08-31", async () => {
    const own = await pending(FIXTURE_ADMIN.id);

    as(FIXTURE_ADMIN.id);
    const decided = await seam.approveEntry(own.id);
    expect(decided.ok).toBe(true);
  });

  it("MIR-14 AC-21: a batch containing the manager's own entry succeeds for every row", async () => {
    const mine = await pending(FIXTURE_MEMBER.id);
    const theirs = await pending(FIXTURE_APPROVED_MEMBER.id);
    undo = await asManager(FIXTURE_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    const result = await seam.rejectEntries([mine.id, theirs.id], "Not this week.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toEqual({ requested: 2, rejected: 2 });

    as(FIXTURE_ADMIN.id);
    const rows = await seam.listTeamEntries();
    expect(rows.find((e) => e.id === mine.id)?.status).toBe("rejected");
    expect(rows.find((e) => e.id === theirs.id)?.status).toBe("rejected");
  });
});

// MIR-14 — ADR-073 decision 4, clause (a1). A rejection is changed only by its rejecter or an admin.
describe("ADR-073 decision 4 — a manager may not overturn another person's rejection", () => {
  const SENTENCE =
    "Only an admin, or a manager of one of this person's teams, can decide this entry — and only whoever rejected it, or an admin, can change a rejection. Nothing about this entry has changed.";

  it("MIR-14 AC-22: approving an entry the admin rejected is refused with the sentence", async () => {
    const entry = await pending(FIXTURE_APPROVED_MEMBER.id);
    as(FIXTURE_ADMIN.id);
    const rejected = await seam.rejectEntry(entry.id, "Trùng lịch");
    expect(rejected.ok).toBe(true);
    undo = await asManager(FIXTURE_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    const decided = await seam.approveEntry(entry.id);

    expect(decided).toEqual({
      ok: false,
      error: { code: "entry_decision_not_permitted", message: SENTENCE },
    });
    as(FIXTURE_ADMIN.id);
    const rows = await seam.listTeamEntries();
    expect(rows.find((e) => e.id === entry.id)?.status).toBe("rejected");
  });

  it("MIR-14 AC-22: rewriting the reason on that rejection is refused too", async () => {
    const entry = await pending(FIXTURE_APPROVED_MEMBER.id);
    as(FIXTURE_ADMIN.id);
    await seam.rejectEntry(entry.id, "Trùng lịch");
    undo = await asManager(FIXTURE_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    const reworded = await seam.rejectEntry(entry.id, "Lý do khác");
    expect(reworded.ok).toBe(false);
    if (!reworded.ok) expect(reworded.error.code).toBe("entry_decision_not_permitted");

    const batch = await seam.rejectEntries([entry.id], "Lý do khác");
    expect(batch.ok).toBe(false);
    if (!batch.ok) expect(batch.error.code).toBe("entry_decision_not_permitted");
  });

  it("MIR-14: the rejecter may change their own decision, and an admin may change anybody's", async () => {
    const entry = await pending(FIXTURE_APPROVED_MEMBER.id);
    undo = await asManager(FIXTURE_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    expect((await seam.rejectEntry(entry.id, "Trùng lịch")).ok).toBe(true);
    expect((await seam.rejectEntry(entry.id, "Lý do mới")).ok).toBe(true);
    expect((await seam.approveEntry(entry.id)).ok).toBe(true);

    const again = await pending(FIXTURE_APPROVED_MEMBER.id);
    as(FIXTURE_MEMBER.id);
    expect((await seam.rejectEntry(again.id, "Trùng lịch")).ok).toBe(true);
    as(FIXTURE_ADMIN.id);
    const overturned = await seam.approveEntry(again.id);
    expect(overturned.ok).toBe(true);
    if (overturned.ok) expect(overturned.value.approvedBy).toBe(FIXTURE_ADMIN.id);
  });

  it("MIR-14 AC-22: the supabase seam carries the identical sentence", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../src/lib/data/supabase.ts", import.meta.url)),
      "utf8",
    );
    expect(source).toContain(JSON.stringify(SENTENCE));
  });
});

describe("ADR-035 § Rationale — the containment", () => {
  it("a manager cannot edit another member's entry, which is the power deciding sits next to", async () => {
    const entry = await pending(FIXTURE_APPROVED_MEMBER.id);
    undo = await asManager(FIXTURE_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    const edited = await seam.updateEntry(entry.id, {
      type: "wfh",
      portion: "full",
      tentative: false,
      note: "rewritten by somebody who was only meant to approve",
      startDate: entry.startDate,
      endDate: entry.endDate,
    });

    expect(edited.ok).toBe(false);
  });

  it("a manager cannot delete another member's entry either — deleting is not deciding", async () => {
    const entry = await pending(FIXTURE_APPROVED_MEMBER.id);
    undo = await asManager(FIXTURE_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    const removed = await seam.deleteEntry(entry.id);
    expect(removed.ok).toBe(false);
  });

  it("`is_admin` still answers false for a manager — no holiday, no threshold, no roster write", async () => {
    undo = await asManager(FIXTURE_MEMBER.id);
    as(FIXTURE_MEMBER.id);

    const holiday = await seam.addHoliday({
      date: "2032-04-30",
      name: "A day a manager should not be able to add",
      kind: "non_working",
    });
    expect(holiday.ok).toBe(false);

    const threshold = await seam.setOverloadThreshold({ overloadThreshold: 0.9 });
    expect(threshold.ok).toBe(false);

    const removal = await seam.removeMember(FIXTURE_APPROVED_MEMBER.id);
    expect(removal.ok).toBe(false);
  });
});
