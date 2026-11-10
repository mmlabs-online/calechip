// SOLO, 2026-09-11 — the busy count, at the level the standard assigns it.
//
// `.ai/standards/testing-standards.md` puts pure logic at the unit level and rendering at the
// end-to-end one, and `src/lib/data/busy.ts` fetches nothing and holds no state. What a day LOOKS
// like is `tests/e2e/solo-busy-day.spec.ts`.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so the names below are sentences and
// deliberately not `AC-n` — an `AC-` prefix is a claim that a plan document states the criterion.
// What authorises the work is `.claude/agents/solo.md`.
//
// **THE BUSY ROWS ARE CONSTRUCTED HERE AND THE MEMBERS ARE IMPORTED**, the same split
// `tests/absence.test.ts` declares and for the same reason: a `BusyDay` is the ARGUMENT of a pure
// function and there is no seeded row for one — the mock's table starts empty on purpose, because a
// busy day is reachable through the product with one press and a seeded row would be a row every
// count has to remember to subtract. A MEMBER is an entity and the removal rule turns on a real
// `removedAt`, so those come from the shared fixture module.
//
// **THE PROPERTY UNDER TEST THAT MATTERS MOST IS NOT ARITHMETIC.** It is that this number is NOT
// INV-04's: a busy person is at work, and the day that proves the two are separate is the one where
// somebody is busy and nobody is away. The last test is that day.
import { describe, expect, it } from "vitest";
import { busyCountsFor, busyDatesOf, busyMembersFor, withOwnBusyMark } from "@/lib/data/busy";
import { absenceCountsFor } from "@/lib/data/absence";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
} from "@/lib/fixtures";
import type { BusyDay, DateRange, Member } from "@/lib/domain/types";

const WEEK: DateRange = { start: "2026-09-14", end: "2026-09-20" };

/** The team as the seam returns it — INCLUDING the removed member, which is the shape
 *  `listMembers` produces (ADR-013) and the shape the counting functions require. */
const ROSTER: Member[] = [
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_SECOND_ADMIN,
  FIXTURE_REMOVED_MEMBER,
];

let nextId = 0;
const busy = (memberId: string, date: string): BusyDay => ({
  id: `bb000000-0000-4000-8000-${String(++nextId).padStart(12, "0")}`,
  memberId,
  date,
  createdAt: "2026-09-11T00:00:00+00:00",
});

describe("busyCountsFor", () => {
  it("gives every date in the range a key, including the ones nobody marked", () => {
    const counts = busyCountsFor([], WEEK, ROSTER);

    // The contract `absenceCountsFor` keeps, and the reason it keeps it: a caller that had to
    // distinguish "absent key" from "zero" would be re-deciding the arithmetic at the call site.
    expect([...counts.keys()]).toEqual([
      "2026-09-14",
      "2026-09-15",
      "2026-09-16",
      "2026-09-17",
      "2026-09-18",
      "2026-09-19",
      "2026-09-20",
    ]);
    expect([...counts.values()].every((n) => n === 0)).toBe(true);
  });

  it("counts people, in whole numbers, and never halves", () => {
    const rows = [
      busy(FIXTURE_MEMBER.id, "2026-09-16"),
      busy(FIXTURE_ADMIN.id, "2026-09-16"),
      busy(FIXTURE_SECOND_ADMIN.id, "2026-09-17"),
    ];
    const counts = busyCountsFor(rows, WEEK, ROSTER);

    expect(counts.get("2026-09-16")).toBe(2);
    expect(counts.get("2026-09-17")).toBe(1);
    expect(counts.get("2026-09-18")).toBe(0);

    // A busy day carries no portion, so there is no 0.5 anywhere in this map. `absenceCountsFor`
    // deals in halves and the two numbers are never drawn as one figure.
    expect([...counts.values()].every(Number.isInteger)).toBe(true);
  });

  it("counts one person once on one date, even given a duplicate row", () => {
    // `unique (member_id, date)` makes this unrepresentable in PostgreSQL. The mock has no
    // constraint, so the rule is held in the function too — a count that disagreed with the database
    // under one seam and not the other is the failure the single-definition rule exists to prevent.
    const rows = [busy(FIXTURE_MEMBER.id, "2026-09-16"), busy(FIXTURE_MEMBER.id, "2026-09-16")];

    expect(busyCountsFor(rows, WEEK, ROSTER).get("2026-09-16")).toBe(1);
    expect(busyMembersFor(rows, WEEK, ROSTER).get("2026-09-16")).toHaveLength(1);
  });

  it("ignores a date outside the range, and a row whose member is not on the roster", () => {
    const rows = [
      busy(FIXTURE_MEMBER.id, "2026-09-13"), // the day before the range
      busy(FIXTURE_MEMBER.id, "2026-09-21"), // the day after it
      busy("99999999-9999-4999-8999-999999999999", "2026-09-16"), // another team's row
    ];
    const counts = busyCountsFor(rows, WEEK, ROSTER);

    expect([...counts.values()].every((n) => n === 0)).toBe(true);
    expect(counts.has("2026-09-13")).toBe(false);
    expect(counts.has("2026-09-21")).toBe(false);
  });

  it("counts a removed member before they left and not after", () => {
    // FIXTURE_REMOVED_MEMBER left on 2026-08-31. The rule is this module's own — copied from
    // ADR-013 because the reason is the same, and stated in `busy.ts` rather than cited from INV-04,
    // which does not govern this number.
    const before: DateRange = { start: "2026-08-30", end: "2026-08-30" };
    const after: DateRange = { start: "2026-09-01", end: "2026-09-01" };

    expect(
      busyCountsFor([busy(FIXTURE_REMOVED_MEMBER.id, "2026-08-30")], before, ROSTER).get(
        "2026-08-30",
      ),
    ).toBe(1);
    expect(
      busyCountsFor([busy(FIXTURE_REMOVED_MEMBER.id, "2026-09-01")], after, ROSTER).get(
        "2026-09-01",
      ),
    ).toBe(0);
  });
});

describe("busyMembersFor", () => {
  it("names the same people the count counts, sorted and stable", () => {
    const rows = [
      busy(FIXTURE_SECOND_ADMIN.id, "2026-09-16"),
      busy(FIXTURE_ADMIN.id, "2026-09-16"),
      busy(FIXTURE_MEMBER.id, "2026-09-16"),
    ];

    const people = busyMembersFor(rows, WEEK, ROSTER).get("2026-09-16") ?? [];
    const counts = busyCountsFor(rows, WEEK, ROSTER);

    // The count and the list are derived from ONE pass, so this equality can only break if that pass
    // is wrong — which is the whole reason there is not a second filter in the views.
    expect(people).toHaveLength(counts.get("2026-09-16") ?? 0);

    // Sorted by display name, so a render does not reorder itself between reads.
    expect(people.map((p) => p.displayName)).toEqual(
      [...people].map((p) => p.displayName).sort((a, b) => a.localeCompare(b)),
    );
  });

  it("gives every date an array, empty where nobody is busy", () => {
    const people = busyMembersFor([], WEEK, ROSTER);
    expect([...people.keys()]).toHaveLength(7);
    expect([...people.values()].every((list) => list.length === 0)).toBe(true);
  });
});

describe("busyDatesOf", () => {
  it("answers only for the member asked about, and only inside the range", () => {
    const rows = [
      busy(FIXTURE_MEMBER.id, "2026-09-16"),
      busy(FIXTURE_MEMBER.id, "2026-09-18"),
      busy(FIXTURE_ADMIN.id, "2026-09-16"),
      busy(FIXTURE_MEMBER.id, "2026-09-25"),
    ];

    const mine = busyDatesOf(rows, WEEK, FIXTURE_MEMBER.id);
    expect([...mine].sort()).toEqual(["2026-09-16", "2026-09-18"]);
  });

  it("does not apply the removed-member rule, because it answers a different question", () => {
    // It decides what a PRESS does — create or delete — and the row exists either way. `busy.ts`
    // records the asymmetry: making the control's state depend on the counting rule would let the
    // button disagree with the datastore about what a press is about to do.
    const after: DateRange = { start: "2026-09-01", end: "2026-09-01" };
    const rows = [busy(FIXTURE_REMOVED_MEMBER.id, "2026-09-01")];

    expect(busyCountsFor(rows, after, ROSTER).get("2026-09-01")).toBe(0);
    expect(busyDatesOf(rows, after, FIXTURE_REMOVED_MEMBER.id).has("2026-09-01")).toBe(true);
  });
});

describe("the busy count is not the absence count", () => {
  it("a day where everybody is busy and nobody is away is 3 busy and 0 away", () => {
    // **THE TEST THIS MODULE EXISTS FOR.** The operator's sentence is that a busy person *"vẫn đi
    // làm bình thường"*, so a day full of busy people must not read as a day the team is short
    // staffed — which is what the crowded-day warning is computed from. No entry exists here at all,
    // so `absenceCountsFor` sees nothing and the two numbers disagree by design.
    const rows = [
      busy(FIXTURE_MEMBER.id, "2026-09-16"),
      busy(FIXTURE_ADMIN.id, "2026-09-16"),
      busy(FIXTURE_SECOND_ADMIN.id, "2026-09-16"),
    ];

    expect(busyCountsFor(rows, WEEK, ROSTER).get("2026-09-16")).toBe(3);
    expect(absenceCountsFor([], WEEK, ROSTER).get("2026-09-16")).toBe(0);
  });
});

// SOLO, 2026-09-11 (second pass) — the OPTIMISTIC prediction, at the unit level for the same reason
// the counts are here: it is a pure function over rows. What the screen does with it — the spinner,
// the revert on a refusal, the calendar not reloading — is `tests/e2e/solo-busy-day.spec.ts`.
//
// **THE PROPERTY THAT MATTERS IS THAT THE PREDICTION AGREES WITH THE COUNT.** The views patch rows
// and then re-derive through `busyCountsFor`, so every test below asserts the COUNT after the patch
// rather than the array — an array that was right and a count that was wrong is the failure a
// caller would actually see.
describe("withOwnBusyMark — the optimistic prediction", () => {
  it("marking a date I do not hold raises my team's count by exactly one", () => {
    const rows = [busy(FIXTURE_ADMIN.id, "2026-09-16")];
    const after = withOwnBusyMark(rows, FIXTURE_MEMBER.id, "2026-09-16", true);

    expect(busyCountsFor(after, WEEK, ROSTER).get("2026-09-16")).toBe(2);
    expect(busyDatesOf(after, WEEK, FIXTURE_MEMBER.id).has("2026-09-16")).toBe(true);
  });

  it("unmarking a date I hold lowers it by exactly one, and touches nobody else's row", () => {
    const rows = [busy(FIXTURE_ADMIN.id, "2026-09-16"), busy(FIXTURE_MEMBER.id, "2026-09-16")];
    const after = withOwnBusyMark(rows, FIXTURE_MEMBER.id, "2026-09-16", false);

    expect(busyCountsFor(after, WEEK, ROSTER).get("2026-09-16")).toBe(1);
    expect(busyDatesOf(after, WEEK, FIXTURE_ADMIN.id).has("2026-09-16")).toBe(true);
  });

  it("is idempotent both ways, because `unique (member_id, date)` makes it so in the datastore", () => {
    // A press that cannot change anything must not appear to. Marking a date I already hold is the
    // `ignoreDuplicates` upsert; unmarking one I do not hold is a delete that matches no row.
    const held = [busy(FIXTURE_MEMBER.id, "2026-09-16")];
    expect(busyCountsFor(withOwnBusyMark(held, FIXTURE_MEMBER.id, "2026-09-16", true), WEEK, ROSTER).get("2026-09-16")).toBe(1);
    expect(busyCountsFor(withOwnBusyMark([], FIXTURE_MEMBER.id, "2026-09-16", false), WEEK, ROSTER).get("2026-09-16")).toBe(0);
  });

  it("leaves every other date alone, so one press never moves a second day's figure", () => {
    const rows = [busy(FIXTURE_MEMBER.id, "2026-09-16"), busy(FIXTURE_MEMBER.id, "2026-09-18")];
    const after = withOwnBusyMark(rows, FIXTURE_MEMBER.id, "2026-09-16", false);

    expect(busyCountsFor(after, WEEK, ROSTER).get("2026-09-18")).toBe(1);
  });

  it("returns a NEW array and leaves the caller's rows untouched — what the revert puts back", () => {
    // The views hold the pre-press array and restore it when the write is refused. A function that
    // mutated in place would leave them nothing to restore, and the screen would keep a mark the
    // datastore never took.
    const rows = [busy(FIXTURE_ADMIN.id, "2026-09-16")];
    const after = withOwnBusyMark(rows, FIXTURE_MEMBER.id, "2026-09-16", true);

    expect(after).not.toBe(rows);
    expect(rows).toHaveLength(1);
    expect(busyCountsFor(rows, WEEK, ROSTER).get("2026-09-16")).toBe(1);
  });

  it("predicts a removed member's own row, because that rule is not this function's", () => {
    // `busyDatesOf` decides what a press DOES and deliberately skips the removed-member rule; the
    // prediction has to match it, or the button and the count would disagree about the press.
    // The COUNT still refuses the row — that rule lives in `walk`, where it always did.
    const after = withOwnBusyMark([], FIXTURE_REMOVED_MEMBER.id, "2026-09-16", true);

    expect(busyDatesOf(after, WEEK, FIXTURE_REMOVED_MEMBER.id).has("2026-09-16")).toBe(true);
    expect(busyCountsFor(after, WEEK, ROSTER).get("2026-09-16")).toBe(0);
  });
});
