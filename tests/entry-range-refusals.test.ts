// SOLO, 2026-09-10 — CAL-01 AC-9 and CAL-02 AC-11, at the only level that can still reach them.
//
// **THIS FILE EXISTS BECAUSE A CONTROL WAS REMOVED, NOT BECAUSE A RULE CHANGED.** The entry form
// used to carry two `<input type="date">` controls, so a person could type an end date before the
// start date and the acceptance suite could drive exactly that. The operator's design replaced them
// with a day picker, and a SET of chosen days has no order to invert — so the two browser tests that
// drove those criteria could no longer express the input they were about.
//
// The refusal itself is untouched and is still in both seam implementations:
// `src/lib/data/mock.ts:1060` and `src/lib/data/supabase.ts:507`, each refusing before any round
// trip. What moved is where it is asserted from. Deleting those assertions instead would have left
// two shipped criteria covered by nothing, which is the failure this file is written against.
//
// The MOCK is the subject, for the reason `tests/threshold.test.ts` records: it is what the
// acceptance suite runs against, so a mock that stopped refusing would make the suite pass against
// nothing. `__setCurrentMember` is that file's hook, used the same way.
import { afterEach, describe, expect, it } from "vitest";
import { seam as mock, __setCurrentMember } from "@/lib/data/mock";
import { FIXTURE_MEMBER } from "@/lib/fixtures";

afterEach(() => {
  __setCurrentMember(null);
});

/** Neither a SQLSTATE nor the range-bound text the generated column raises — the same two things
 *  the browser tests refused to see, kept word for word so the intent survives the move. */
function readableRefusal(message: string): void {
  expect(message.trim().length).toBeGreaterThan(0);
  expect(message).not.toMatch(/range lower bound|23514|23P01|42501|PGRST|daterange/i);
}

describe("CAL-01 AC-9 — an inverted range is refused on create", () => {
  it("is refused, in a sentence, and nothing is stored", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);

    const result = await mock.createEntry({
      type: "pto",
      portion: "full",
      startDate: "2026-10-09",
      endDate: "2026-10-05",
      tentative: false,
      note: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    readableRefusal(result.error.message);

    // Nothing was written: the caller's list does not carry the refused row.
    const own = await mock.listOwnEntries();
    expect(own.some((entry) => entry.startDate === "2026-10-09")).toBe(false);
  });
});

describe("CAL-02 AC-11 — an inverted range is refused on an edit too", () => {
  it("is refused, and the entry keeps the dates it had", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);

    const created = await mock.createEntry({
      type: "pto",
      portion: "full",
      startDate: "2026-12-07",
      endDate: "2026-12-11",
      tentative: false,
      note: null,
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const result = await mock.updateEntry(created.value.id, {
      type: "pto",
      portion: "full",
      startDate: "2026-12-09",
      endDate: "2026-12-05",
      tentative: false,
      note: null,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    readableRefusal(result.error.message);

    const own = await mock.listOwnEntries();
    const kept = own.find((entry) => entry.id === created.value.id);
    expect(kept?.startDate).toBe("2026-12-07");
    expect(kept?.endDate).toBe("2026-12-11");
  });
});
