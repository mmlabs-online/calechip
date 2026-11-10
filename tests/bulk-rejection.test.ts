// ADM-06 — the batch, at the level the standard assigns it.
//
// `.ai/standards/testing-standards.md` puts pure logic and seam behaviour at the unit level and "a
// full acceptance criterion through the interface" at the end-to-end one. So the ARITHMETIC (both
// numbers, and where each comes from), the FILTERED-ROW case, the two REFUSALS, ATOMICITY and the
// interaction with clause (b) are asserted here against `rejectEntries` directly, and what an admin
// SEES is in tests/e2e/adm-06-bulk-reject.spec.ts.
//
// **IT DRIVES THE MOCK IMPLEMENTATION DIRECTLY**, the way tests/entry-decision.test.ts,
// tests/pending-entries.test.ts and tests/seam-parity.test.ts do, rather than through `@/lib/data` —
// which resolves by environment.
//
// **WHAT AC-8 PROVES HERE AND WHAT IT DOES NOT. 01-plan.md section 3, last paragraph.** ADR-016's
// headline consequence asks for the denial to be issued against a REAL PostgreSQL with a member's
// token, "not through the seam, since the seam is where the affordance lives and not where the
// control is". `tests/permission-model.test.ts` does not exist and no Supabase project is
// provisioned. Against src/lib/data/mock.ts this criterion demonstrates THE SENTENCE — that a
// member's batch is refused with `entry_decision_not_permitted` rather than a SQLSTATE — and NOT the
// refusal. The refusal is clause (a) of `public.entry_enforce_decision()`, which runs inside
// `public.reject_entries` exactly as it runs on a single PATCH because the function is
// `security invoker`, and is verified the day a project exists. ADM-05 recorded the same and this is
// not weaker: it is the same clause doing the same work through a different transport.
//
// **AC-12 THROUGH AC-17 ARE NOT HERE**, and that is the division of labour rather than a gap: all
// six are about what an interface offers, keeps, empties or says, and none of them is a property of
// the seam.
//
// **THE ENTRIES BELOW ARE CREATED THROUGH `seam.createEntry`**, the route ADM-04's and ADM-05's unit
// suites took and for their reason: a pending entry is exactly what CAL-01's form produces, `status`
// is the column default, and 01-plan.md section 7 adds no fixture on purpose. The two fixtures used
// are the two nobody can create: FIXTURE_APPROVED_ENTRY, which AC-9 needs approved and with an
// approver, and FIXTURE_OTHER_TEAM_ENTRY, which only the other team's own member could insert.
import { describe, expect, it } from "vitest";
import { seam, __setCurrentMember } from "@/lib/data/mock";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_ENTRY,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_ENTRY,
  FIXTURE_SECOND_ADMIN,
} from "@/lib/fixtures";
import type { Entry } from "@/lib/domain/types";

/**
 * A distinct date range per entry, handed out in order.
 *
 * INV-01 keys on `member_id` and most tests below create SEVERAL entries for one member — which is
 * what a batch is — so a shared date would be refused by the exclusion constraint the mock
 * reproduces, and the failure would look like a batch defect. 2032 is far outside every range the
 * calendar screens are used for and outside every date the other suites fix.
 */
let nextDay = 0;
function freeRange(): { startDate: string; endDate: string } {
  nextDay += 1;
  const day = String((nextDay % 28) + 1).padStart(2, "0");
  const month = String(Math.floor(nextDay / 28) + 1).padStart(2, "0");
  return { startDate: `2032-${month}-${day}`, endDate: `2032-${month}-${day}` };
}

/** One pending entry owned by `ownerId`, created the way a person creates one. */
async function pending(ownerId: string): Promise<Entry> {
  __setCurrentMember(ownerId);
  const result = await seam.createEntry({
    type: "pto",
    portion: "full",
    tentative: false,
    note: null,
    ...freeRange(),
  });
  if (!result.ok) throw new Error(`could not create the entry under test: ${result.error.code}`);
  return result.value;
}

/** `n` pending entries owned by `ownerId`. */
async function pendingMany(ownerId: string, n: number): Promise<Entry[]> {
  const made: Entry[] = [];
  for (let i = 0; i < n; i += 1) made.push(await pending(ownerId));
  return made;
}

/** The row as the datastore holds it now, read as an admin so team scope never hides it. */
async function reread(entryId: string): Promise<Entry> {
  __setCurrentMember(FIXTURE_ADMIN.id);
  const rows = await seam.listTeamEntries();
  const row = rows.find((e) => e.id === entryId);
  if (!row) throw new Error(`the entry under test is gone: ${entryId}`);
  return row;
}

const as = (memberId: string): void => __setCurrentMember(memberId);

/** Two ids that name no entry at all. `= any(p_ids)` MATCHES ROWS — it does not resolve ids — so an
 *  id nothing answers to is filtered by exactly the expression that filters a row the policy hides,
 *  which is why the two are one case rather than two. */
const NOWHERE = [
  "dd000000-0000-4000-8000-00000000dea1",
  "dd000000-0000-4000-8000-00000000dea2",
];

const REASON = "The whole team is out that week — could either of you move to the following Monday?";

describe("ADM-06 — the batch rejects", () => {
  it("AC-1: three selected, three rejected, each carrying the reason", async () => {
    const made = await pendingMany(FIXTURE_MEMBER.id, 3);

    as(FIXTURE_ADMIN.id);
    const result = await seam.rejectEntries(
      made.map((e) => e.id),
      REASON,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ requested: 3, rejected: 3 });

    for (const entry of made) {
      const after = await reread(entry.id);
      expect(after.status).toBe("rejected");
      expect(after.rejectionReason).toBe(REASON);
    }
  });

  it("AC-2: one reason, written onto every entry, across more than one member", async () => {
    const mine = await pending(FIXTURE_MEMBER.id);
    const theirs = await pending(FIXTURE_SECOND_ADMIN.id);

    as(FIXTURE_ADMIN.id);
    const result = await seam.rejectEntries([mine.id, theirs.id], REASON);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ requested: 2, rejected: 2 });

    // PER RECORD, with no shared row and no null — INV-03 is satisfied once per entry, which is what
    // its biconditional check requires and what the operator's answer of 2026-08-31 decided.
    for (const entry of [mine, theirs]) {
      expect((await reread(entry.id)).rejectionReason).toBe(REASON);
    }
  });

  it("AC-6: the same entry selected twice counts once", async () => {
    const [first, second] = await pendingMany(FIXTURE_MEMBER.id, 2);
    if (!first || !second) throw new Error("the entries under test were not created");

    as(FIXTURE_ADMIN.id);
    const result = await seam.rejectEntries([first.id, second.id, first.id, first.id], REASON);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // DISTINCT ids, and the duplicate does not make an otherwise complete batch report as partial —
    // which is what leaving the de-duplication to `= any(p_ids)` would do, silently.
    expect(result.value).toEqual({ requested: 2, rejected: 2 });
  });

  it("AC-9: an approved entry in a batch loses its approver with its approval", async () => {
    // The one fixture nobody can create through the product: approved, with an approver and a
    // timestamp, so clause (b)'s clearing has something to clear.
    const before = await reread(FIXTURE_APPROVED_ENTRY.id);
    expect(before.status).toBe("approved");
    expect(before.approvedBy).not.toBeNull();

    const alongside = await pending(FIXTURE_MEMBER.id);

    as(FIXTURE_ADMIN.id);
    const result = await seam.rejectEntries([FIXTURE_APPROVED_ENTRY.id, alongside.id], REASON);

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ requested: 2, rejected: 2 });

    const after = await reread(FIXTURE_APPROVED_ENTRY.id);
    expect(after.status).toBe("rejected");
    expect(after.rejectionReason).toBe(REASON);
    // ADM-05's shipped rule, applied per record through the same trigger. This ticket adds no rule
    // of its own about provenance and ships no trigger change at all — which is why
    // `invariants_touched` is INV-03 alone and does not over-declare INV-02.
    expect(after.approvedBy).toBeNull();
    expect(after.approvedAt).toBeNull();
  });

  it("AC-10: an admin may include their own entry in a batch", async () => {
    const own = await pending(FIXTURE_ADMIN.id);
    const other = await pending(FIXTURE_MEMBER.id);

    as(FIXTURE_ADMIN.id);
    const result = await seam.rejectEntries([own.id, other.id], REASON);

    // No special case and no extra refusal: rbac-and-security.md's row *Approve or reject their own
    // entry* is ✅ for `admin`, and a carve-out here would be inventing a permission row.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ requested: 2, rejected: 2 });
    expect((await reread(own.id)).status).toBe("rejected");
  });
});

describe("ADM-06 — what actually happened, and never *done*", () => {
  it("AC-5 and AC-18: a partly-admitted batch reports both numbers", async () => {
    const made = await pendingMany(FIXTURE_MEMBER.id, 5);
    const ids = [...made.map((e) => e.id), FIXTURE_OTHER_TEAM_ENTRY.id, ...NOWHERE];
    expect(ids).toHaveLength(8);

    as(FIXTURE_ADMIN.id);
    const result = await seam.rejectEntries(ids, REASON);

    // SUCCESS, not an error — the whole hazard this ticket exists for. A caller holding only
    // `!error` is green here, and a caller holding only a count cannot tell this from a batch of
    // five that rejected five.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.requested).toBe(8);
    expect(result.value.rejected).toBe(5);

    // AC-18. The count is CORROBORATED BY THE ROWS rather than by the input: five entries carry the
    // reason, so `rejected` is what the datastore changed and cannot have been derived from the
    // eight ids sent.
    for (const entry of made) {
      expect((await reread(entry.id)).rejectionReason).toBe(REASON);
    }
  });

  it("AC-11: an entry the caller may not reach is filtered, not errored, and is unchanged", async () => {
    const mine = await pending(FIXTURE_MEMBER.id);

    as(FIXTURE_ADMIN.id);
    const result = await seam.rejectEntries([mine.id, FIXTURE_OTHER_TEAM_ENTRY.id], REASON);

    // A partial RESULT and not an error. The two are different facts and the interface must not fold
    // them together: `entry_update_admin`'s team predicate does not match the row, so the `update`
    // never sees it — there is nothing to raise.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ requested: 2, rejected: 1 });

    // Read as the other team's own member, because nobody on FIXTURE_TEAM may read that row. It is
    // the conjunct with no other test behind it — dropping the team predicate leaves
    // `role === "admin"`, which passes every one-team assertion in this file.
    as(FIXTURE_OTHER_TEAM_ENTRY.memberId);
    const theirs = (await seam.listOwnEntries()).find((e) => e.id === FIXTURE_OTHER_TEAM_ENTRY.id);
    expect(theirs?.status).toBe("pending");
    expect(theirs?.rejectionReason).toBeNull();
  });

  it("AC-18: a batch nothing admits is a result of zero, not a refusal", async () => {
    as(FIXTURE_ADMIN.id);
    const result = await seam.rejectEntries(NOWHERE, REASON);

    // ZERO OF TWO, and this is where the batch parts company with `rejectEntry`, whose zero-row case
    // IS a refusal. Here it is a partial result taken to its limit: the datastore filtering every
    // row and the datastore refusing are different facts, and the caller says which by comparing the
    // two numbers.
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ requested: 2, rejected: 0 });
  });
});

describe("ADM-06 — the refusals", () => {
  it("AC-3: a batch with no reason is refused before the write is issued", async () => {
    const made = await pendingMany(FIXTURE_MEMBER.id, 2);
    as(FIXTURE_ADMIN.id);

    for (const blank of ["", "   ", "\n\t "]) {
      const result = await seam.rejectEntries(
        made.map((e) => e.id),
        blank,
      );

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("rejection_reason_required");
      // No SQLSTATE reaches a caller. The seam refuses before the request, so neither INV-03's 23514
      // nor `public.reject_entries`'s own 22023 is ever met — both exist as the control and the
      // legible refusal behind this affordance.
      expect(result.error.message).not.toMatch(/\d{5}/);
      expect(result.error.message.length).toBeGreaterThan(0);
    }

    for (const entry of made) {
      const after = await reread(entry.id);
      expect(after.status).toBe("pending");
      expect(after.rejectionReason).toBeNull();
    }
  });

  it("AC-4: a batch with nothing selected is refused, and is not a silent no-op", async () => {
    as(FIXTURE_ADMIN.id);
    const result = await seam.rejectEntries([], REASON);

    // NOT `{ requested: 0, rejected: 0 }` with ok:true, which is what `= any('{}')` would produce —
    // success on a write that never happened, the exact fail-quiet shape this ticket exists to make
    // visible. And NOT `rejection_reason_required`: the two refusals name different missing things.
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("no_entries_selected");
    expect(result.error.message.length).toBeGreaterThan(0);
  });

  it("AC-8: a member cannot bulk-reject, not even their own entries, and is told so", async () => {
    const own = await pendingMany(FIXTURE_MEMBER.id, 3);

    as(FIXTURE_MEMBER.id);
    const result = await seam.rejectEntries(
      own.map((e) => e.id),
      REASON,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // NOT `entry_not_permitted`: the rows ARE theirs and `entry_update_own` admits every one of
    // them. Clause (a) is the ONLY thing between a member and a bulk rejection of their own entries,
    // and the two codes carry two different sentences on purpose.
    expect(result.error.code).toBe("entry_decision_not_permitted");
    expect(result.error.message).not.toMatch(/42501|PGRST/);

    for (const entry of own) {
      const after = await reread(entry.id);
      expect(after.status).toBe("pending");
      expect(after.rejectionReason).toBeNull();
    }
  });

  it("AC-7: failure is atomic — none, not some, and not the rows before the failing one", async () => {
    const own = await pendingMany(FIXTURE_MEMBER.id, 4);

    // The mock's only raise path is clause (a), which is the honest shape of this criterion against
    // it: ONE STATEMENT IN ONE TRANSACTION means the guard is evaluated over the whole admitted set
    // BEFORE a single row is written. A loop that wrote as it went would leave the first rows
    // rejected and refuse on the last — the partial write with no transaction and no report that
    // 01-plan.md section 8 rejects `rejectEntry`-in-a-loop for.
    as(FIXTURE_MEMBER.id);
    const result = await seam.rejectEntries(
      own.map((e) => e.id),
      REASON,
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    // A FAILURE RATHER THAN A COUNT, and every row exactly as it was — including the first, which is
    // the assertion that distinguishes atomicity from ordering.
    for (const entry of own) {
      expect((await reread(entry.id)).status).toBe("pending");
    }
  });
});
