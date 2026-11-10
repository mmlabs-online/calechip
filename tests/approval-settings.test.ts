// SOLO, 2026-09-11 — whether a new entry waits for an admin, at the level the standard assigns it.
//
// The operator: *"WFH_NEED_APPROVE và PTO_NEED_APPROVE. nếu WFH_NEED_APPROVE = true: thì khi đăng kí
// WFH phải được admin approve, ngược lại không cần APPROVE mà tự động approved."*
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the names below are sentences and
// deliberately not `AC-n` — an `AC-` prefix is a claim that a plan document states the criterion.
// What authorises the work is `.claude/agents/solo.md`.
//
// **THE MOCK IS THE SUBJECT AND THE TRIGGER IS WHAT IT REPRODUCES**, for the reason
// `tests/threshold.test.ts` records: `entry_apply_approval_setting()` and the column grant live in
// `supabase/migrations/20260911170000_solo_approval_settings.sql` and no test reaches them until a
// project is provisioned. What is asserted here is that the mock decides where the trigger decides and
// refuses where the policy refuses — which is what keeps the acceptance suite from passing against
// nothing. `__setCurrentMember` moves the caller without a session, reaching states a browser cannot.
//
// **EVERY ENTRY HERE IS IN 2027**, where no fixture entry sits, so no test's insert can collide with
// a seeded row on INV-01 and fail for a reason that has nothing to do with approval.
import { afterEach, describe, expect, it } from "vitest";
import { seam as mock, __setCurrentMember } from "@/lib/data/mock";
import { needsApproval } from "@/lib/data/approval";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_TEAM,
} from "@/lib/fixtures";
import type { EntryType } from "@/lib/domain/types";

/** The mock's `team` table is module state and `setApprovalSettings` mutates it, so every test puts
 *  the seeded pair back — read from the fixture rather than remembered as `true`. */
async function restore(): Promise<void> {
  __setCurrentMember(FIXTURE_ADMIN.id);
  await mock.setApprovalSettings({
    wfhNeedApprove: FIXTURE_TEAM.wfhNeedApprove,
    ptoNeedApprove: FIXTURE_TEAM.ptoNeedApprove,
  });
  __setCurrentMember(null);
}

async function settle(wfhNeedApprove: boolean, ptoNeedApprove: boolean): Promise<void> {
  __setCurrentMember(FIXTURE_ADMIN.id);
  const result = await mock.setApprovalSettings({ wfhNeedApprove, ptoNeedApprove });
  expect(result.ok).toBe(true);
}

/** One full-day entry for the fixture member on `date`, created through the seam as that member. */
async function declare(type: EntryType, date: string) {
  __setCurrentMember(FIXTURE_MEMBER.id);
  const result = await mock.createEntry({
    type,
    portion: "full",
    startDate: date,
    endDate: date,
    tentative: false,
    note: null,
  });
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error("unreachable");
  return result.value;
}

describe("needsApproval — the rule", () => {
  it("reads one switch per type, and the two are independent", () => {
    expect(needsApproval({ wfhNeedApprove: false, ptoNeedApprove: true }, "wfh")).toBe(false);
    expect(needsApproval({ wfhNeedApprove: false, ptoNeedApprove: true }, "pto")).toBe(true);
    expect(needsApproval({ wfhNeedApprove: true, ptoNeedApprove: false }, "wfh")).toBe(true);
    expect(needsApproval({ wfhNeedApprove: true, ptoNeedApprove: false }, "pto")).toBe(false);
  });
});

describe("setApprovalSettings — who may move the switches", () => {
  afterEach(restore);

  it("an admin moves both, and the stored row comes back", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const result = await mock.setApprovalSettings({ wfhNeedApprove: false, ptoNeedApprove: true });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.wfhNeedApprove).toBe(false);
    expect(result.value.ptoNeedApprove).toBe(true);

    const team = await mock.getTeam();
    expect(team?.wfhNeedApprove).toBe(false);
  });

  it("a member is refused, and nothing moves", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const result = await mock.setApprovalSettings({ wfhNeedApprove: false, ptoNeedApprove: false });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_permitted");

    const team = await mock.getTeam();
    expect(team?.wfhNeedApprove).toBe(true);
    expect(team?.ptoNeedApprove).toBe(true);
  });

  it("an admin's switch is their own team's and no other", async () => {
    // `team_update_admin` bounds the row to `member_team_id(auth.uid())`. A mock that wrote the first
    // team it found would pass every test a one-team fixture carries — the failure ADR-018's revert
    // condition names, one table over.
    await settle(false, false);

    __setCurrentMember(FIXTURE_OTHER_TEAM_MEMBER.id);
    const other = await mock.getTeam();
    expect(other?.wfhNeedApprove).toBe(true);
    expect(other?.ptoNeedApprove).toBe(true);
  });
});

describe("createEntry — what the switches do to a new entry", () => {
  afterEach(restore);

  it("by default both types wait, which is the product as it was before this work", async () => {
    expect((await declare("wfh", "2027-03-01")).status).toBe("pending");
    expect((await declare("pto", "2027-03-02")).status).toBe("pending");
  });

  it("a type that needs no approval is stored approved, and nobody is named as its approver", async () => {
    await settle(false, true);
    const entry = await declare("wfh", "2027-03-03");

    expect(entry.status).toBe("approved");
    // NULL, and that is the provenance: no member decided it. Naming an admin would put a name on a
    // decision that person never took — what clause (b) of `entry_enforce_decision()` forbids.
    expect(entry.approvedBy).toBeNull();
    expect(entry.approvedAt).not.toBeNull();
    expect(entry.rejectionReason).toBeNull();
  });

  it("the other type still waits — one switch never moves the other's entries", async () => {
    await settle(false, true);
    expect((await declare("pto", "2027-03-04")).status).toBe("pending");
  });

  it("turning approval off does not approve what is already waiting", async () => {
    // The operator chose this over a sweep: switching a type off applies to entries written from then
    // on, and a backlog is still an admin's to decide. The re-read goes through the seam, so this is
    // what a reader sees rather than the object `createEntry` handed back.
    const waiting = await declare("wfh", "2027-03-05");
    expect(waiting.status).toBe("pending");

    await settle(false, false);

    __setCurrentMember(FIXTURE_MEMBER.id);
    const mine = await mock.listOwnEntries();
    expect(mine.find((e) => e.id === waiting.id)?.status).toBe("pending");
  });
});
