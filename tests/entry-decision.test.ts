// ADM-05 — the decision itself, at the level the standard assigns it.
//
// `.ai/standards/testing-standards.md` puts pure logic and seam behaviour at the unit level and "a
// full acceptance criterion through the interface" at the end-to-end one. So the TRANSITIONS, the
// PROVENANCE, the two REFUSALS and the interaction with INV-02's trigger are asserted here against
// `approveEntry` and `rejectEntry` directly, and what an admin and a member SEE is in
// tests/e2e/adm-05-approve-reject.spec.ts.
//
// **IT DRIVES THE MOCK IMPLEMENTATION DIRECTLY**, the way tests/pending-entries.test.ts and
// tests/seam-parity.test.ts do, rather than through `@/lib/data` — which resolves by environment.
//
// **WHAT AC-8 AND AC-9 PROVE HERE, AND WHAT THEY DO NOT. 01-plan.md Open questions item 2.**
// ADR-016's own headline consequence asks for a member PATCHing {"status":"approved"} against a REAL
// PostgreSQL with a member's token, *"not through the seam, since the seam is where the affordance
// lives and not where the control is"*. `tests/permission-model.test.ts` does not exist and no
// Supabase project is provisioned, so there is no real PostgreSQL and no member's token to issue it
// with. Against src/lib/data/mock.ts these two criteria demonstrate THE SENTENCE — that a member's
// forged decision is refused with `entry_decision_not_permitted` and a sentence rather than a
// SQLSTATE — and NOT the refusal. The refusal is held by clause (a) of
// `public.entry_enforce_decision()` and is verified the day a project exists. Stating that is
// cheaper than a green test read as more than it is.
//
// **AC-11, AC-15, AC-18, AC-19 AND AC-20 ARE NOT HERE**, and that is the division of labour rather
// than a gap: all five are about what an interface offers, says or leaves alone, and none of them
// is a property of the seam. They are asserted in the end-to-end suite.
//
// **THE ENTRIES BELOW ARE CREATED THROUGH `seam.createEntry`**, the route ADM-04's unit suite took
// and for its reason: a pending entry is exactly what CAL-01's form produces, `status` is the column
// default, and 01-plan.md section 7 adds no fixture on purpose — every criterion here is stronger
// created by the write it is testing. The two fixtures that ARE used are the two nobody can create:
// FIXTURE_APPROVED_ENTRY, which no product path could reach until this ticket, and
// FIXTURE_OTHER_TEAM_ENTRY, which only the other team's own member could insert.
import { describe, expect, it } from "vitest";
import { seam, __setCurrentMember } from "@/lib/data/mock";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_ENTRY,
  FIXTURE_SECOND_ADMIN,
} from "@/lib/fixtures";
import type { Entry, EntryType } from "@/lib/domain/types";

/**
 * A distinct date range per entry, handed out in order.
 *
 * INV-01 keys on `member_id`, and several tests below create more than one entry for the same
 * member, so a shared date would be refused by the exclusion constraint the mock reproduces — a
 * failure that would look like a decision defect. 2031 is far outside every range the calendar
 * screens are used for and outside every date the other suites fix.
 */
let nextDay = 0;
function freeRange(): { startDate: string; endDate: string } {
  nextDay += 1;
  const day = String(nextDay).padStart(2, "0");
  return { startDate: `2031-01-${day}`, endDate: `2031-01-${day}` };
}

/** One pending entry owned by `ownerId`, created the way a person creates one. */
async function pending(
  ownerId: string,
  fields: { tentative?: boolean; type?: EntryType; note?: string | null } = {},
): Promise<Entry> {
  __setCurrentMember(ownerId);
  const result = await seam.createEntry({
    type: fields.type ?? "pto",
    portion: "full",
    tentative: fields.tentative ?? false,
    note: fields.note ?? null,
    ...freeRange(),
  });
  if (!result.ok) throw new Error(`could not create the entry under test: ${result.error.code}`);
  return result.value;
}

/** The row as the datastore holds it now, read as an admin so team scope never hides it. */
async function reread(entryId: string): Promise<Entry> {
  __setCurrentMember(FIXTURE_ADMIN.id);
  const rows = await seam.listTeamEntries();
  const row = rows.find((e) => e.id === entryId);
  if (!row) throw new Error(`the entry under test is gone: ${entryId}`);
  return row;
}

/** How many entries the worklist counts for the admin, in the widest window. */
async function outstanding(): Promise<number> {
  __setCurrentMember(FIXTURE_ADMIN.id);
  const page = await seam.listPendingEntries({
    type: null,
    window: "all",
    today: "2026-09-05",
    page: 0,
  });
  return page.total;
}

const as = (memberId: string): void => __setCurrentMember(memberId);

describe("ADM-05 — an admin decides", () => {
  it("AC-1: an admin approves a pending entry, and it leaves the worklist", async () => {
    const entry = await pending(FIXTURE_MEMBER.id);
    const before = await outstanding();

    as(FIXTURE_ADMIN.id);
    const result = await seam.approveEntry(entry.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("approved");

    // The row is gone from the queue and the exact count fell with it — the two halves ADM-04's
    // single response makes inseparable.
    expect(await outstanding()).toBe(before - 1);
    expect((await reread(entry.id)).status).toBe("approved");
  });

  it("AC-2: an admin rejects an entry with a reason, and it leaves the worklist", async () => {
    const entry = await pending(FIXTURE_MEMBER.id);
    const before = await outstanding();

    as(FIXTURE_ADMIN.id);
    const result = await seam.rejectEntry(entry.id, "The whole team is out that week.");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("rejected");
    expect(result.value.rejectionReason).toBe("The whole team is out that week.");
    expect(await outstanding()).toBe(before - 1);
  });

  it("AC-3: a rejection with no reason is refused, and nothing is written", async () => {
    const entry = await pending(FIXTURE_MEMBER.id);
    as(FIXTURE_ADMIN.id);

    for (const blank of ["", "   ", "\n\t "]) {
      const result = await seam.rejectEntry(entry.id, blank);

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("rejection_reason_required");
      // No SQLSTATE reaches a caller: the seam refuses before the write, and INV-03's check — which
      // would answer 23514 — is never reached.
      expect(result.error.message).not.toMatch(/\d{5}/);
      expect(result.error.message.length).toBeGreaterThan(0);
    }

    const after = await reread(entry.id);
    expect(after.status).toBe("pending");
    expect(after.rejectionReason).toBeNull();
  });

  it("AC-4: approving a rejected entry clears its reason", async () => {
    const entry = await pending(FIXTURE_MEMBER.id);
    as(FIXTURE_ADMIN.id);
    await seam.rejectEntry(entry.id, "Two people are already away.");

    const result = await seam.approveEntry(entry.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // The two are written in ONE statement, because INV-03's biconditional refuses any transition
    // off `rejected` that leaves the reason standing.
    expect(result.value.status).toBe("approved");
    expect(result.value.rejectionReason).toBeNull();
  });

  it("AC-5: an admin re-words the reason on an already-rejected entry, creating no approval", async () => {
    const entry = await pending(FIXTURE_MEMBER.id);
    as(FIXTURE_ADMIN.id);
    await seam.rejectEntry(entry.id, "No.");

    const result = await seam.rejectEntry(entry.id, "Could you take the Thursday instead?");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("rejected");
    expect(result.value.rejectionReason).toBe("Could you take the Thursday instead?");
    // Nothing about the approval moved in either direction.
    expect(result.value.approvedBy).toBeNull();
    expect(result.value.approvedAt).toBeNull();
  });

  it("AC-6: approving does not clear the tentative tag (INV-05)", async () => {
    const entry = await pending(FIXTURE_MEMBER.id, { tentative: true });
    as(FIXTURE_ADMIN.id);

    const result = await seam.approveEntry(entry.id);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Two independent axes. An approval that cleared the flag would change what the entry
    // contributes on the absence count's own terms.
    expect(result.value.status).toBe("approved");
    expect(result.value.tentative).toBe(true);
  });

  it("AC-7: `approvedBy` and `approvedAt` are the datastore's, never the caller's", async () => {
    // There is NO CHANNEL to send them: the function takes an entry id and nothing else, which is
    // the affordance half. The control is clause (b), which overwrites whatever arrives.
    expect(seam.approveEntry.length).toBe(1);

    const first = await pending(FIXTURE_MEMBER.id);
    const second = await pending(FIXTURE_MEMBER.id);
    const before = new Date().toISOString();

    as(FIXTURE_ADMIN.id);
    const one = await seam.approveEntry(first.id);
    as(FIXTURE_SECOND_ADMIN.id);
    const two = await seam.approveEntry(second.id);

    expect(one.ok && two.ok).toBe(true);
    if (!one.ok || !two.ok) return;

    // The value is the ACTING admin's, and it differs between two writes that are otherwise
    // identical — which is what makes it provenance rather than a constant.
    expect(one.value.approvedBy).toBe(FIXTURE_ADMIN.id);
    expect(two.value.approvedBy).toBe(FIXTURE_SECOND_ADMIN.id);
    expect(one.value.approvedAt).not.toBeNull();
    expect(one.value.approvedAt! >= before).toBe(true);
  });

  it("AC-10: an admin may approve their own entry, and the approver is themselves", async () => {
    const own = await pending(FIXTURE_ADMIN.id);

    as(FIXTURE_ADMIN.id);
    const result = await seam.approveEntry(own.id);

    // Self-approval is PERMITTED — rbac-and-security.md's second row — and its cost is recorded as
    // known weakness 4. A refusal here would be inventing a permission row.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.status).toBe("approved");
    expect(result.value.approvedBy).toBe(FIXTURE_ADMIN.id);
  });
});

describe("ADM-05 — the denials", () => {
  it("AC-8: a member's forged approval on their own entry is refused, in a sentence", async () => {
    const own = await pending(FIXTURE_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    const result = await seam.approveEntry(own.id);

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // NOT `entry_not_permitted`: the row IS theirs and the policy admits it. What refuses is clause
    // (a), and the two codes carry two different sentences on purpose.
    expect(result.error.code).toBe("entry_decision_not_permitted");
    expect(result.error.message).not.toMatch(/42501|PGRST/);

    const after = await reread(own.id);
    expect(after.status).toBe("pending");
    expect(after.approvedBy).toBeNull();
  });

  it("AC-9: a member may not write a rejection reason either", async () => {
    const own = await pending(FIXTURE_MEMBER.id);

    as(FIXTURE_MEMBER.id);
    const result = await seam.rejectEntry(own.id, "I changed my mind.");

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("entry_decision_not_permitted");

    const after = await reread(own.id);
    expect(after.status).toBe("pending");
    expect(after.rejectionReason).toBeNull();
  });

  it("AC-16: a decision the policy does not admit is reported as a refusal, not as success", async () => {
    as(FIXTURE_ADMIN.id);

    // A row the policy does not admit is FILTERED rather than errored, so the affected ROW COUNT is
    // what decides — an `!error` check is green on this. "No such entry", "not yours" and "another
    // team's" are deliberately one answer, or the seam becomes an oracle for which ids exist.
    const approve = await seam.approveEntry("dd000000-0000-4000-8000-00000000dead");
    const reject = await seam.rejectEntry("dd000000-0000-4000-8000-00000000dead", "No.");

    expect(approve.ok).toBe(false);
    expect(reject.ok).toBe(false);
    if (approve.ok || reject.ok) return;
    expect(approve.error.code).toBe("entry_not_permitted");
    expect(reject.error.code).toBe("entry_not_permitted");
  });

  it("AC-17: an admin of another team may not decide this team's entries", async () => {
    as(FIXTURE_ADMIN.id);

    const result = await seam.approveEntry(FIXTURE_OTHER_TEAM_ENTRY.id);

    // The TEAM half of `entry_update_admin`, which is the conjunct with no other test behind it:
    // dropping it leaves `role === "admin"`, which passes every one-team assertion in this file.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("entry_not_permitted");

    // Read as the other team's own member, because nobody on FIXTURE_TEAM may read that row.
    as(FIXTURE_OTHER_TEAM_ENTRY.memberId);
    const theirs = (await seam.listOwnEntries()).find((e) => e.id === FIXTURE_OTHER_TEAM_ENTRY.id);
    expect(theirs?.status).toBe("pending");
    expect(theirs?.rejectionReason).toBeNull();
  });
});

describe("ADM-05 — the decision meets INV-02, which is observable for the first time", () => {
  it("AC-12: a substantive edit to an approved entry returns it to pending", async () => {
    const entry = await pending(FIXTURE_MEMBER.id);
    as(FIXTURE_ADMIN.id);
    const approved = await seam.approveEntry(entry.id);
    expect(approved.ok).toBe(true);

    // The OWNER edits, through the function this ticket does not touch. Until this ticket nothing in
    // the product could create the approved state, so clause (c) has never had a live case.
    as(FIXTURE_MEMBER.id);
    const moved = await seam.updateEntry(entry.id, {
      type: entry.type,
      portion: entry.portion,
      startDate: "2031-06-01",
      endDate: "2031-06-02",
      tentative: entry.tentative,
      note: entry.note,
    });

    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.value.status).toBe("pending");
    expect(moved.value.approvedBy).toBeNull();
    expect(moved.value.approvedAt).toBeNull();
  });

  it("AC-13: a substantive edit to a rejected entry returns it to pending and clears the reason", async () => {
    const entry = await pending(FIXTURE_MEMBER.id);
    as(FIXTURE_ADMIN.id);
    await seam.rejectEntry(entry.id, "Somebody else is already out.");

    // The LIKELY path and not an edge case: ADR-011 leaves the rejected entry holding its slots, so
    // its owner cannot create a replacement on the same dates and editing this row is the only route
    // open to them.
    as(FIXTURE_MEMBER.id);
    const moved = await seam.updateEntry(entry.id, {
      type: entry.type,
      portion: entry.portion,
      startDate: "2031-07-01",
      endDate: "2031-07-02",
      tentative: entry.tentative,
      note: entry.note,
    });

    expect(moved.ok).toBe(true);
    if (!moved.ok) return;
    expect(moved.value.status).toBe("pending");
    expect(moved.value.rejectionReason).toBeNull();
  });

  it("AC-14: editing only the note revokes nothing", async () => {
    const entry = await pending(FIXTURE_MEMBER.id);
    as(FIXTURE_ADMIN.id);
    const approved = await seam.approveEntry(entry.id);
    expect(approved.ok).toBe(true);
    if (!approved.ok) return;

    as(FIXTURE_MEMBER.id);
    const noted = await seam.updateEntry(entry.id, {
      type: entry.type,
      portion: entry.portion,
      startDate: entry.startDate,
      endDate: entry.endDate,
      tentative: entry.tentative,
      note: "Booked the flights.",
    });

    expect(noted.ok).toBe(true);
    if (!noted.ok) return;
    // data-model.md's own carve-out, and the half a test written from the happy path would miss.
    expect(noted.value.status).toBe("approved");
    expect(noted.value.approvedBy).toBe(approved.value.approvedBy);
    expect(noted.value.approvedAt).toBe(approved.value.approvedAt);
  });
});
