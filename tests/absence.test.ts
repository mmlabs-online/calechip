// CAL-04 — INV-04, at the level the standard assigns it.
//
// `.ai/standards/testing-standards.md` puts "pure logic" at the unit level and rendering at the
// end-to-end one, and `absenceCountsFor` is the purest thing in this product: it fetches nothing,
// holds no state, and every acceptance criterion about WHAT a day costs is a call to it with rows.
// The criteria about what a day LOOKS like are in tests/e2e/cal-04-month-view.spec.ts.
//
// **The entries below are constructed here rather than imported, and that is a declared deviation
// from § Fixtures** (03-impl-log.md). The standard forbids inventing entities inline because a
// fixture that lives in one test file drifts from `supabase/seed.sql`. These are not entities: they
// are the ARGUMENTS of a pure function, and the six shapes INV-04 distinguishes — rejected,
// tentative, half-day, owned by a removed member, spanning the range boundary — do not exist in the
// seed and cannot be added to it, because `supabase/seed.sql` is not in this ticket's
// `allowed_paths` and a fixture with no seed row behind it is exactly the drift the rule forbids.
// Every MEMBER below is imported from the shared module, because members are entities and the
// removal rule turns on a real `removedAt`.
//
// The one seeded entry that does exist, FIXTURE_APPROVED_ENTRY, is imported and used as the base
// every variation spreads from — so the shape stays the seed's even where the values differ.
import { describe, expect, it } from "vitest";
import {
  absenceByTypeFor,
  absenceCountsFor,
  absentDatesByMember,
  absentEntriesFor,
  absentMembersFor,
  addDays,
  currentMemberCount,
  eachDateInRange,
  isOverloaded,
  overlapsRange,
} from "@/lib/data/absence";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_ENTRY,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_MEMBER,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
  FIXTURE_TEAM,
} from "@/lib/fixtures";
import type { AbsenceDetail, DateRange, Entry, Member } from "@/lib/domain/types";

/** April 2026, the month 01-plan.md section 2 writes every criterion against. */
const APRIL: DateRange = { start: "2026-04-01", end: "2026-04-30" };

/** The team as the seam returns it: REMOVED MEMBERS INCLUDED. ADR-013 needs `removedAt` per member
 *  to decide each date, so a pre-filtered roster cannot answer AC-6. */
const ROSTER: readonly Member[] = [
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_SECOND_ADMIN,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_REMOVED_MEMBER,
];

let serial = 0;
/** One entry, spread from the seeded row so the shape is the seed's. */
const entry = (fields: Partial<Entry>): Entry => ({
  ...FIXTURE_APPROVED_ENTRY,
  id: `ff000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`,
  status: "pending",
  approvedBy: null,
  approvedAt: null,
  ...fields,
});

const on = (counts: ReadonlyMap<string, number>, date: string): number | undefined => counts.get(date);
const avatarsOn = (
  members: ReadonlyMap<string, readonly Member[]>,
  date: string,
): readonly string[] => (members.get(date) ?? []).map((m) => m.id);

describe("the date vocabulary", () => {
  // Not decoration. `new Date('2026-04-30')` parses as UTC midnight and a local day-of-month read
  // west of UTC yields the previous day, which is the trap CAL-01 01-plan.md section 4.5 recorded
  // and the reason every helper in @/lib/data/absence converts through UTC. A machine set to
  // America/Los_Angeles fails this line if any of them ever reads locally.
  it("crosses a month boundary and a leap day without drifting", () => {
    expect(addDays("2026-04-30", 1)).toBe("2026-05-01");
    expect(addDays("2026-05-01", -1)).toBe("2026-04-30");
    expect(addDays("2024-02-28", 1)).toBe("2024-02-29");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("walks a range inclusively at both ends, and answers nothing for an inverted one", () => {
    expect(eachDateInRange({ start: "2026-04-06", end: "2026-04-08" })).toEqual([
      "2026-04-06",
      "2026-04-07",
      "2026-04-08",
    ]);
    expect(eachDateInRange({ start: "2026-04-08", end: "2026-04-06" })).toEqual([]);
    expect(eachDateInRange(APRIL)).toHaveLength(30);
  });

  it("overlaps rather than contains", () => {
    // The case AC-2 turns on: an entry that starts in March and ends in April belongs to April.
    const across = entry({ startDate: "2026-03-28", endDate: "2026-04-02" });
    expect(overlapsRange(across, APRIL)).toBe(true);
    expect(overlapsRange(entry({ startDate: "2026-03-01", endDate: "2026-03-31" }), APRIL)).toBe(false);
    expect(overlapsRange(entry({ startDate: "2026-05-01", endDate: "2026-05-02" }), APRIL)).toBe(false);
  });
});

describe("AC-2: an absent member's avatar appears on every date their entry covers", () => {
  it("draws the avatar on each date of the range and on no other", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, startDate: "2026-04-13", endDate: "2026-04-15" }),
    ];
    const members = absentMembersFor(rows, APRIL, ROSTER);

    expect(avatarsOn(members, "2026-04-12")).toEqual([]);
    expect(avatarsOn(members, "2026-04-13")).toEqual([FIXTURE_MEMBER.id]);
    expect(avatarsOn(members, "2026-04-14")).toEqual([FIXTURE_MEMBER.id]);
    expect(avatarsOn(members, "2026-04-15")).toEqual([FIXTURE_MEMBER.id]);
    expect(avatarsOn(members, "2026-04-16")).toEqual([]);
  });

  it("clamps an entry that starts before the range to the dates inside it", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, startDate: "2026-03-28", endDate: "2026-04-02" }),
    ];
    const counts = absenceCountsFor(rows, APRIL, ROSTER);

    // No key outside the requested range, ever — the contract on `AbsenceCounts`.
    expect(counts.size).toBe(30);
    expect(counts.has("2026-03-28")).toBe(false);
    expect(on(counts, "2026-04-01")).toBe(1);
    expect(on(counts, "2026-04-02")).toBe(1);
    expect(on(counts, "2026-04-03")).toBe(0);
  });
});

describe("AC-3: 1 per full day, 0.5 per half day, PTO and WFH alike", () => {
  it("sums a full day and a morning to 1.5", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, portion: "full", startDate: "2026-04-14", endDate: "2026-04-14" }),
      entry({ memberId: FIXTURE_ADMIN.id, portion: "am", startDate: "2026-04-14", endDate: "2026-04-14" }),
    ];
    expect(on(absenceCountsFor(rows, APRIL, ROSTER), "2026-04-14")).toBe(1.5);
  });

  it("weighs WFH exactly as it weighs PTO", () => {
    const pto = [entry({ memberId: FIXTURE_MEMBER.id, type: "pto", startDate: "2026-04-14", endDate: "2026-04-14" })];
    const wfh = [entry({ memberId: FIXTURE_MEMBER.id, type: "wfh", startDate: "2026-04-14", endDate: "2026-04-14" })];

    expect(on(absenceCountsFor(wfh, APRIL, ROSTER), "2026-04-14")).toBe(
      on(absenceCountsFor(pto, APRIL, ROSTER), "2026-04-14"),
    );
  });

  it("counts one member's morning and afternoon as one whole day and draws them once", () => {
    // INV-01 permits this pair — `am` and `pm` do not share a slot — and it is the only way one
    // member reaches 1.0 through two rows. A count of 1.5 here would mean the weights were summed
    // per ROW where the avatar rule is per PERSON, and the two would then disagree.
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, portion: "am", startDate: "2026-04-14", endDate: "2026-04-14" }),
      entry({ memberId: FIXTURE_MEMBER.id, portion: "pm", startDate: "2026-04-14", endDate: "2026-04-14" }),
    ];
    expect(on(absenceCountsFor(rows, APRIL, ROSTER), "2026-04-14")).toBe(1);
    expect(avatarsOn(absentMembersFor(rows, APRIL, ROSTER), "2026-04-14")).toEqual([FIXTURE_MEMBER.id]);
  });
});

describe("AC-4: a rejected entry is excluded from the count and from the grid", () => {
  it("contributes nothing and draws no avatar", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, status: "rejected", rejectionReason: "no", startDate: "2026-04-14", endDate: "2026-04-14" }),
    ];
    expect(on(absenceCountsFor(rows, APRIL, ROSTER), "2026-04-14")).toBe(0);
    // INV-04's own clause: a view shows a member's avatar exactly when that member's entry is
    // counted. Asserting both halves is what makes the two derivations one decision.
    expect(avatarsOn(absentMembersFor(rows, APRIL, ROSTER), "2026-04-14")).toEqual([]);
  });
});

describe("AC-5 and INV-05: a tentative entry counts and is drawn", () => {
  it("weighs the same as a settled one", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, tentative: true, status: "pending", startDate: "2026-04-14", endDate: "2026-04-14" }),
    ];
    expect(on(absenceCountsFor(rows, APRIL, ROSTER), "2026-04-14")).toBe(1);
    expect(avatarsOn(absentMembersFor(rows, APRIL, ROSTER), "2026-04-14")).toEqual([FIXTURE_MEMBER.id]);
  });

  it("is independent of status: an approved entry and a tentative one weigh the same", () => {
    // glossary.md keeps `tentative` and `status` apart as two axes, and INV-04 reads exactly one of
    // them. A function that consulted `tentative` would fail this pair without failing the one above.
    const approved = [entry({ memberId: FIXTURE_MEMBER.id, status: "approved", startDate: "2026-04-14", endDate: "2026-04-14" })];
    const tentative = [entry({ memberId: FIXTURE_MEMBER.id, tentative: true, startDate: "2026-04-14", endDate: "2026-04-14" })];

    expect(on(absenceCountsFor(tentative, APRIL, ROSTER), "2026-04-14")).toBe(
      on(absenceCountsFor(approved, APRIL, ROSTER), "2026-04-14"),
    );
  });
});

describe("AC-6 and ADR-013: a removed member counts until the day they were removed", () => {
  // FIXTURE_REMOVED_MEMBER carries `removedAt` 2026-08-31T12:00:00+00:00, which is outside April.
  // The criterion is written about a removal INSIDE the range, so this test moves the removal — it
  // is the same entity with the one field the rule turns on set to the date under test.
  const removedMidMonth: Member = { ...FIXTURE_REMOVED_MEMBER, removedAt: "2026-04-15T00:00:00+00:00" };
  const roster = [...ROSTER.filter((m) => m.id !== FIXTURE_REMOVED_MEMBER.id), removedMidMonth];

  const rows = [
    entry({ memberId: removedMidMonth.id, startDate: "2026-04-10", endDate: "2026-04-20" }),
  ];

  it("counts on the days before the removal", () => {
    const counts = absenceCountsFor(rows, APRIL, roster);
    expect(on(counts, "2026-04-10")).toBe(1);
    expect(on(counts, "2026-04-14")).toBe(1);
  });

  it("counts nothing from the day of the removal onwards", () => {
    // Strictly after, not on or after: somebody removed at midnight on the 15th is gone ON the 15th.
    const counts = absenceCountsFor(rows, APRIL, roster);
    expect(on(counts, "2026-04-15")).toBe(0);
    expect(on(counts, "2026-04-20")).toBe(0);
  });

  it("draws the avatar on exactly the days it counts", () => {
    const members = absentMembersFor(rows, APRIL, roster);
    expect(avatarsOn(members, "2026-04-14")).toEqual([removedMidMonth.id]);
    expect(avatarsOn(members, "2026-04-15")).toEqual([]);
  });

  it("counts nothing for an entry whose member is not on the roster at all", () => {
    // The two reads are scoped to the same team, so this means they disagree — and counting a person
    // the grid cannot draw would break INV-04's avatar clause silently.
    const orphan = [entry({ memberId: "00000000-0000-4000-8000-000000000000", startDate: "2026-04-14", endDate: "2026-04-14" })];
    expect(on(absenceCountsFor(orphan, APRIL, ROSTER), "2026-04-14")).toBe(0);
  });
});

describe("AC-7: overloaded is strictly greater, never equal", () => {
  it("is not overloaded exactly at the threshold", () => {
    // The worked example from the criterion: six members, a threshold of 0.5, three people away.
    expect(isOverloaded(3.0, 6, 0.5)).toBe(false);
  });

  it("is overloaded just above it", () => {
    expect(isOverloaded(3.5, 6, 0.5)).toBe(true);
  });

  it("refuses to divide by an empty roster", () => {
    // `0/0` is NaN, which compares false against everything — so returning false is the same ANSWER
    // either way, and the explicit guard is what makes it a decision rather than an accident.
    expect(isOverloaded(0, 0, 0.5)).toBe(false);
    expect(isOverloaded(3, 0, 0.5)).toBe(false);
  });
});

describe("AC-8: the denominator is the CURRENT member count", () => {
  it("counts only members with removedAt null", () => {
    expect(currentMemberCount(ROSTER)).toBe(4);
    expect(ROSTER).toHaveLength(5);
  });

  it("re-evaluates a past date against today's team", () => {
    // The consequence INV-04 records as accepted: the same count on the same past date flips as the
    // team grows. This is the assertion that would fail if somebody "fixed" it by freezing the
    // denominator, which would put a second definition of the roster in the product.
    const count = 3.5;
    expect(isOverloaded(count, 6, FIXTURE_TEAM.overloadThreshold)).toBe(true);
    expect(isOverloaded(count, 7, FIXTURE_TEAM.overloadThreshold)).toBe(false);
  });
});

describe("AC-9: an empty month is empty, not absent", () => {
  it("carries every date of the range at zero", () => {
    const counts = absenceCountsFor([], APRIL, ROSTER);
    const members = absentMembersFor([], APRIL, ROSTER);

    expect(counts.size).toBe(30);
    expect(members.size).toBe(30);
    // No caller ever has to distinguish an absent key from a zero, which is what stops the
    // arithmetic being re-decided at the call site.
    for (const date of eachDateInRange(APRIL)) {
      expect(counts.get(date)).toBe(0);
      expect(members.get(date)).toEqual([]);
    }
  });
});

// ===========================================================================
// CAL-05 — `absentEntriesFor`, the THIRD derivation from the same `walk`.
//
// **The AC ids below are CAL-05's and the ones above are CAL-04's, so every describe from here down
// is prefixed with the ticket.** `.ai/standards/testing-standards.md` § Test naming requires the AC
// id in the test name; it does not anticipate one file serving two tickets, which this one now does
// because the function under test lives in the module CAL-04 shipped and splitting the file would
// put two halves of INV-04's coverage in two places.
//
// The division of labour with tests/e2e/cal-05-week-view.spec.ts is the standard's: pure logic here,
// "a full acceptance criterion through the interface" there. AC-10 and AC-11 are asserted HERE ONLY
// and that is declared in 03-impl-log.md — nothing in the product can create a rejected entry
// (`entry_update_admin` excludes `status`, and ADM-05 does not exist) and nothing can remove a member
// partway through a displayed week, so neither has an interface to be observed through.
//
// Entries are constructed with the same `entry()` helper and the same declared deviation from
// § Fixtures recorded at the top of this file. Nothing new is invented: every member is imported.
// ===========================================================================

/** The week 01-plan.md section 2 writes AC-1 and AC-14 against: Monday to Sunday, inclusive. */
const WEEK: DateRange = { start: "2026-10-05", end: "2026-10-11" };

const rowsOn = (
  details: ReadonlyMap<string, readonly AbsenceDetail[]>,
  date: string,
): readonly AbsenceDetail[] => details.get(date) ?? [];

const namesOn = (
  details: ReadonlyMap<string, readonly AbsenceDetail[]>,
  date: string,
): readonly string[] => rowsOn(details, date).map((row) => row.member.id);

describe("CAL-05 AC-2 and AC-5: each absent person on each day their entry covers, and no other", () => {
  it("lists the member on every date of the range and on none outside it", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, startDate: "2026-10-06", endDate: "2026-10-08" }),
    ];
    const details = absentEntriesFor(rows, WEEK, ROSTER);

    expect(namesOn(details, "2026-10-05")).toEqual([]);
    expect(namesOn(details, "2026-10-06")).toEqual([FIXTURE_MEMBER.id]);
    expect(namesOn(details, "2026-10-07")).toEqual([FIXTURE_MEMBER.id]);
    expect(namesOn(details, "2026-10-08")).toEqual([FIXTURE_MEMBER.id]);
    expect(namesOn(details, "2026-10-09")).toEqual([]);
  });

  it("clamps an entry that starts before the week to the days inside it", () => {
    // AC-5's exact shape: Saturday before the week to its Tuesday, so the answer is Monday and
    // Tuesday and nothing else. No key outside the requested range ever appears.
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, startDate: "2026-10-03", endDate: "2026-10-06" }),
    ];
    const details = absentEntriesFor(rows, WEEK, ROSTER);

    expect(details.size).toBe(7);
    expect(details.has("2026-10-03")).toBe(false);
    expect(namesOn(details, "2026-10-05")).toEqual([FIXTURE_MEMBER.id]);
    expect(namesOn(details, "2026-10-06")).toEqual([FIXTURE_MEMBER.id]);
    expect(namesOn(details, "2026-10-07")).toEqual([]);
  });

  it("carries the entry that puts the person there, not just the person", () => {
    // The whole reason this derivation exists: `absentMembersFor` answers WHO and drops the row, so
    // the note, the portion and the approver have nowhere to come from. AC-6 and AC-7 are rendered
    // from these three fields and the criteria are unobservable without them.
    const row = entry({
      memberId: FIXTURE_APPROVED_MEMBER.id,
      status: "approved",
      approvedBy: FIXTURE_ADMIN.id,
      approvedAt: "2026-10-01T02:00:00+00:00",
      portion: "am",
      startDate: "2026-10-07",
      endDate: "2026-10-07",
    });
    const listed = rowsOn(absentEntriesFor([row], WEEK, ROSTER), "2026-10-07");
    expect(listed).toHaveLength(1);
    const detail = listed[0]!;

    expect(detail.member.id).toBe(FIXTURE_APPROVED_MEMBER.id);
    expect(detail.entry.id).toBe(row.id);
    expect(detail.entry.note).toBe(row.note);
    expect(detail.entry.portion).toBe("am");
    expect(detail.entry.approvedBy).toBe(FIXTURE_ADMIN.id);
  });
});

describe("CAL-05 AC-4 and INV-06: a five-day pm entry is five afternoons", () => {
  it("puts the same portion on every one of the five days", () => {
    // The failure the registry row names as visible on this surface and no other: a half-day at ONE
    // END and whole days in the middle. `portion` is one value for the whole entry, so every row the
    // week draws reads it off the same field — a rendering that produced anything else would be
    // contradicting the column shape CAL-01 shipped.
    const rows = [
      entry({
        memberId: FIXTURE_MEMBER.id,
        portion: "pm",
        startDate: "2026-10-05",
        endDate: "2026-10-09",
      }),
    ];
    const details = absentEntriesFor(rows, WEEK, ROSTER);

    for (const date of ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"]) {
      expect(rowsOn(details, date)).toHaveLength(1);
      expect(rowsOn(details, date)[0]!.entry.portion).toBe("pm");
    }
    // And the weekend, which the entry does not reach, stays empty.
    expect(namesOn(details, "2026-10-10")).toEqual([]);
    expect(namesOn(details, "2026-10-11")).toEqual([]);
  });
});

describe("CAL-05 AC-9 and INV-05: a tentative entry is listed on the same terms as any other", () => {
  it("is listed exactly as a settled entry is, carrying its own tentative flag", () => {
    // `tentative` is never consulted by `walk`, so membership of the list cannot turn on it. The
    // marking is what the view does with the flag it is handed, and that is a rendering decision.
    const tentative = entry({
      memberId: FIXTURE_MEMBER.id,
      tentative: true,
      startDate: "2026-10-07",
      endDate: "2026-10-07",
    });
    const settled = entry({
      memberId: FIXTURE_ADMIN.id,
      tentative: false,
      startDate: "2026-10-07",
      endDate: "2026-10-07",
    });
    const details = absentEntriesFor([tentative, settled], WEEK, ROSTER);

    expect(namesOn(details, "2026-10-07")).toHaveLength(2);
    expect(rowsOn(details, "2026-10-07").map((row) => row.entry.tentative).sort()).toEqual([
      false,
      true,
    ]);
  });
});

describe("CAL-05 AC-10: a rejected entry is not listed", () => {
  it("lists nobody for it, exactly as the count sums nobody for it", () => {
    // Asserted at this level only — nothing in the product can set `status` to `rejected`, so the
    // criterion has no interface to be observed through (03-impl-log.md).
    const rows = [
      entry({
        memberId: FIXTURE_MEMBER.id,
        status: "rejected",
        rejectionReason: "no",
        startDate: "2026-10-07",
        endDate: "2026-10-07",
      }),
    ];
    expect(namesOn(absentEntriesFor(rows, WEEK, ROSTER), "2026-10-07")).toEqual([]);
    // Both halves, because the criterion is about the two AGREEING: a week list showing a rejected
    // entry beside a month cell that excludes it is the divergence INV-04 forbids.
    expect(on(absenceCountsFor(rows, WEEK, ROSTER), "2026-10-07")).toBe(0);
  });
});

describe("CAL-05 AC-11 and ADR-013: a removed member's entries stop on the day they were removed", () => {
  // FIXTURE_REMOVED_MEMBER carries `removedAt` 2026-08-31, outside this week. The criterion is
  // written about a removal INSIDE the displayed week, so this moves the one field the rule turns on
  // — the same shape CAL-04's AC-6 block above already uses on the same fixture.
  const removedMidWeek: Member = {
    ...FIXTURE_REMOVED_MEMBER,
    removedAt: "2026-10-07T00:00:00+00:00",
  };
  const roster = [...ROSTER.filter((m) => m.id !== FIXTURE_REMOVED_MEMBER.id), removedMidWeek];
  const rows = [
    entry({ memberId: removedMidWeek.id, startDate: "2026-10-05", endDate: "2026-10-09" }),
  ];

  it("lists them on the days before the removal", () => {
    const details = absentEntriesFor(rows, WEEK, roster);
    expect(namesOn(details, "2026-10-05")).toEqual([removedMidWeek.id]);
    expect(namesOn(details, "2026-10-06")).toEqual([removedMidWeek.id]);
  });

  it("lists them on no day from the removal onwards", () => {
    // Strictly after, not on or after: somebody removed at midnight on the 7th is gone ON the 7th.
    const details = absentEntriesFor(rows, WEEK, roster);
    expect(namesOn(details, "2026-10-07")).toEqual([]);
    expect(namesOn(details, "2026-10-09")).toEqual([]);
  });
});

describe("CAL-05 AC-12 and INV-04: the week and the month agree about who is away", () => {
  // The criterion that matters, because the failure the feature row names — four names against 3.5 —
  // is invisible on either screen alone. Every shape INV-04 distinguishes is in this one set.
  const rows = [
    entry({ memberId: FIXTURE_MEMBER.id, portion: "am", startDate: "2026-10-07", endDate: "2026-10-07" }),
    entry({ memberId: FIXTURE_MEMBER.id, portion: "pm", startDate: "2026-10-07", endDate: "2026-10-07" }),
    entry({ memberId: FIXTURE_ADMIN.id, portion: "full", startDate: "2026-10-05", endDate: "2026-10-09" }),
    entry({ memberId: FIXTURE_SECOND_ADMIN.id, portion: "am", tentative: true, startDate: "2026-10-07", endDate: "2026-10-08" }),
    entry({ memberId: FIXTURE_APPROVED_MEMBER.id, status: "rejected", rejectionReason: "no", startDate: "2026-10-07", endDate: "2026-10-07" }),
    entry({ memberId: FIXTURE_REMOVED_MEMBER.id, startDate: "2026-10-05", endDate: "2026-10-11" }),
    entry({ memberId: "00000000-0000-4000-8000-000000000000", startDate: "2026-10-06", endDate: "2026-10-06" }),
  ];

  const details = absentEntriesFor(rows, WEEK, ROSTER);
  const members = absentMembersFor(rows, WEEK, ROSTER);
  const counts = absenceCountsFor(rows, WEEK, ROSTER);

  it("names the same set of members the month grid draws, on every date", () => {
    for (const date of eachDateInRange(WEEK)) {
      // DISTINCT, because one member holding an `am` and a `pm` is two rows here and one avatar
      // there — the same fact told two ways, which is what INV-04 requires rather than forbids.
      const distinct = [...new Set(namesOn(details, date))].sort();
      expect(distinct).toEqual([...avatarsOn(members, date)].sort());
    }
  });

  it("re-derives the month's count from the week's rows, on every date", () => {
    // The weights are written out HERE rather than imported, deliberately: importing `WEIGHT` would
    // make this test agree with the implementation by construction, and what it is checking is that
    // the two derivations describe the same day. This is the assertion that fires on "four names
    // against 3.5".
    const weight = { full: 1, am: 0.5, pm: 0.5 } as const;
    for (const date of eachDateInRange(WEEK)) {
      const summed = rowsOn(details, date).reduce((total, row) => total + weight[row.entry.portion], 0);
      expect(summed).toBe(on(counts, date));
    }
  });

  it("is not vacuous: the week under test actually holds people", () => {
    // Two agreeing empty maps agree perfectly, so the pair above would pass against a function that
    // returned nothing. This is the line that stops that.
    //
    // FOUR ROWS, THREE PEOPLE, 2.5 — which is the feature row's own example standing up: a reader
    // counting names on the week gets a number the month cell does not show, and both screens are
    // right. It is the reason this view renders no count of its own.
    expect(rowsOn(details, "2026-10-07")).toHaveLength(4);
    expect(new Set(namesOn(details, "2026-10-07")).size).toBe(3);
    expect(avatarsOn(members, "2026-10-07")).toHaveLength(3);
    expect(on(counts, "2026-10-07")).toBe(2.5);
  });
});

describe("CAL-05 AC-13: every date of the week is present, carrying an empty list", () => {
  it("keeps the same contract the other two derivations keep", () => {
    const details = absentEntriesFor([], WEEK, ROSTER);

    expect(details.size).toBe(7);
    // A caller iterating one map indexes the others without a fallback, which is what stops "nobody
    // is away on Sunday" and "Sunday is missing" being the same answer.
    for (const date of eachDateInRange(WEEK)) expect(details.get(date)).toEqual([]);
  });
});

describe("CAL-05 section 4.1: the order within a date is fixed here, not left to the datastore", () => {
  it("orders by display name, then portion, then entry id", () => {
    // Vietnamese collation: `Đ` sorts after `D`, not after `T`, so the two `Đã…` names come first.
    // The comparison names the locale explicitly — the host default would order these rows one way
    // in CI and another on a laptop, which is the divergence tests/seam-parity.test.ts cannot see.
    const rows = [
      entry({ id: "aa000000-0000-4000-8000-000000000002", memberId: FIXTURE_MEMBER.id, portion: "pm", startDate: "2026-10-07", endDate: "2026-10-07" }),
      entry({ id: "aa000000-0000-4000-8000-000000000001", memberId: FIXTURE_MEMBER.id, portion: "am", startDate: "2026-10-07", endDate: "2026-10-07" }),
      entry({ id: "aa000000-0000-4000-8000-000000000003", memberId: FIXTURE_ADMIN.id, portion: "full", startDate: "2026-10-07", endDate: "2026-10-07" }),
      entry({ id: "aa000000-0000-4000-8000-000000000004", memberId: FIXTURE_APPROVED_MEMBER.id, portion: "full", startDate: "2026-10-07", endDate: "2026-10-07" }),
    ];

    expect(rowsOn(absentEntriesFor(rows, WEEK, ROSTER), "2026-10-07").map((row) => row.member.displayName)).toEqual([
      FIXTURE_APPROVED_MEMBER.displayName,
      FIXTURE_ADMIN.displayName,
      FIXTURE_MEMBER.displayName,
      FIXTURE_MEMBER.displayName,
    ]);
  });

  it("breaks the remaining tie on entry id, so one member's am and pm are deterministic", () => {
    // The only case where the first two comparisons both tie, and the reason the third exists: the
    // input order below is reversed relative to the answer.
    const pm = entry({ id: "ab000000-0000-4000-8000-000000000002", memberId: FIXTURE_MEMBER.id, portion: "pm", startDate: "2026-10-07", endDate: "2026-10-07" });
    const am = entry({ id: "ab000000-0000-4000-8000-000000000001", memberId: FIXTURE_MEMBER.id, portion: "am", startDate: "2026-10-07", endDate: "2026-10-07" });
    const first = entry({ id: "ab000000-0000-4000-8000-000000000003", memberId: FIXTURE_MEMBER.id, portion: "am", startDate: "2026-10-07", endDate: "2026-10-07" });

    const ordered = rowsOn(absentEntriesFor([pm, first, am], WEEK, ROSTER), "2026-10-07");
    expect(ordered.map((row) => row.entry.id)).toEqual([am.id, first.id, pm.id]);
  });
});

// ===========================================================================
// CAL-06 — the fourth derivation, `absentDatesByMember`. The year view asks the question the other
// way round: not "who is away on this date" but "which dates is this member away on".
//
// The division of labour with tests/e2e/cal-06-year-view.spec.ts is the standard's.
// `.ai/standards/testing-standards.md` puts pure logic here and "a full acceptance criterion through
// the interface" there — so AC-4's, AC-6's, AC-7's, AC-8's, AC-9's and AC-10's DERIVATION is
// asserted below against the function directly, and what a person SEES is asserted there. AC-7 and
// AC-8 are asserted HERE OR NOWHERE, for the reason CAL-05 recorded about its own AC-10 and AC-11:
// nothing in the product can set `status` to `rejected` (no grant, no control, ADM-05 does not
// exist), and nothing can remove a member partway through a displayed year (TEA-04 writes
// `removed_at` as `now()`).
//
// Every member below is imported. The one place this file constructs a member rather than importing
// one is the 30 x 365 assertion, and 03-impl-log.md § Deviations declares it.
// ===========================================================================

/** The year 01-plan.md section 2 writes AC-1 and AC-4 against. */
const YEAR: DateRange = { start: "2026-01-01", end: "2026-12-31" };

const datesFor = (
  away: ReadonlyMap<string, ReadonlySet<string>>,
  memberId: string,
): readonly string[] => [...(away.get(memberId) ?? [])].sort();

describe("CAL-06 AC-1 and AC-2: a year is 365 days, and a leap year is 366", () => {
  it("walks every day of an ordinary year and of a leap year", () => {
    // The year view's column count is `eachDateInRange` over January 1st to December 31st, so this
    // is the derivation half of AC-1 and AC-2. No calendar table is consulted: the walk is over UTC
    // instants, which is what makes February 29th arrive without a rule about it.
    expect(eachDateInRange(YEAR)).toHaveLength(365);
    expect(eachDateInRange({ start: "2028-01-01", end: "2028-12-31" })).toHaveLength(366);
    expect(eachDateInRange({ start: "2028-01-01", end: "2028-12-31" })).toContain("2028-02-29");
  });
});

describe("CAL-06 AC-3: every member of the roster is a key, including one who declared nothing", () => {
  it("carries an empty set for a member with no entries at all", () => {
    // THE CRITERION THIS WHOLE DERIVATION EXISTS FOR. A map built from the entries alone would omit
    // this member, and the omission would look like somebody who is never away rather than somebody
    // the grid forgot — which is the year view's one distinguishing property (01-plan.md section 1).
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, startDate: "2026-03-02", endDate: "2026-03-06" }),
    ];
    const away = absentDatesByMember(rows, YEAR, ROSTER);

    expect(away.size).toBe(ROSTER.length);
    for (const member of ROSTER) expect(away.has(member.id)).toBe(true);
    expect(datesFor(away, FIXTURE_ADMIN.id)).toEqual([]);
  });

  it("keeps every key when there are no entries whatsoever", () => {
    const away = absentDatesByMember([], YEAR, ROSTER);
    expect([...away.keys()].sort()).toEqual(ROSTER.map((m) => m.id).sort());
    for (const member of ROSTER) expect(datesFor(away, member.id)).toEqual([]);
  });
});

describe("CAL-06 AC-4: a member is away on exactly the dates their entry covers", () => {
  it("fills the five days of a five-day entry and no others", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, startDate: "2026-03-02", endDate: "2026-03-06" }),
    ];
    expect(datesFor(absentDatesByMember(rows, YEAR, ROSTER), FIXTURE_MEMBER.id)).toEqual([
      "2026-03-02",
      "2026-03-03",
      "2026-03-04",
      "2026-03-05",
      "2026-03-06",
    ]);
  });

  it("clamps an entry that starts before the year and ends inside it", () => {
    // The clamp is `walk`'s and not this derivation's, which is the point: a key outside the
    // requested range can never appear, so the grid cannot draw a column it has no header for.
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, startDate: "2025-12-30", endDate: "2026-01-02" }),
    ];
    expect(datesFor(absentDatesByMember(rows, YEAR, ROSTER), FIXTURE_MEMBER.id)).toEqual([
      "2026-01-01",
      "2026-01-02",
    ]);
  });

  it("yields one date once when a member holds a morning and an afternoon on it", () => {
    // A SET, not a list. The day's total is still 1.0 and the month grid still draws one avatar —
    // the same fact told three ways, which is what INV-04 requires rather than forbids.
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, portion: "am", startDate: "2026-05-04", endDate: "2026-05-04" }),
      entry({ memberId: FIXTURE_MEMBER.id, portion: "pm", startDate: "2026-05-04", endDate: "2026-05-04" }),
    ];
    const away = absentDatesByMember(rows, YEAR, ROSTER);

    expect(datesFor(away, FIXTURE_MEMBER.id)).toEqual(["2026-05-04"]);
    expect(on(absenceCountsFor(rows, YEAR, ROSTER), "2026-05-04")).toBe(1);
  });
});

describe("CAL-06 AC-6 and INV-05: a tentative entry fills its cells on the same terms", () => {
  it("fills exactly as a settled entry does", () => {
    const settled = [
      entry({ memberId: FIXTURE_MEMBER.id, startDate: "2026-06-01", endDate: "2026-06-03" }),
    ];
    const provisional = [
      entry({ memberId: FIXTURE_MEMBER.id, tentative: true, startDate: "2026-06-01", endDate: "2026-06-03" }),
    ];

    // `walk` reads `status` and never `tentative` — glossary.md keeps the two apart as two axes —
    // so the two answers below are identical and the tentative MARKING is the view's, not this
    // function's.
    expect(datesFor(absentDatesByMember(provisional, YEAR, ROSTER), FIXTURE_MEMBER.id)).toEqual(
      datesFor(absentDatesByMember(settled, YEAR, ROSTER), FIXTURE_MEMBER.id),
    );
  });
});

describe("CAL-06 AC-7: a rejected entry fills nothing", () => {
  it("fills no date, exactly as the count sums nothing for it", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, status: "rejected", rejectionReason: "no", startDate: "2026-07-06", endDate: "2026-07-10" }),
    ];
    const away = absentDatesByMember(rows, YEAR, ROSTER);

    // The member still HAS a row — AC-3 — and it is empty, which is the whole difference between
    // "the grid draws exactly what the count sums" and "the member disappeared".
    expect(away.has(FIXTURE_MEMBER.id)).toBe(true);
    expect(datesFor(away, FIXTURE_MEMBER.id)).toEqual([]);
    expect(on(absenceCountsFor(rows, YEAR, ROSTER), "2026-07-06")).toBe(0);
  });
});

describe("CAL-06 AC-8 and ADR-013: a removed member keeps a row, empty after the removal", () => {
  // FIXTURE_REMOVED_MEMBER carries `removedAt` 2026-08-31T12:00:00+00:00. The criterion is written
  // about a removal INSIDE the displayed year with an entry SPANNING it, so this is the same entity
  // with the one field the rule turns on set to the date under test.
  const removedMidYear: Member = { ...FIXTURE_REMOVED_MEMBER, removedAt: "2026-04-15T00:00:00+00:00" };
  const roster = [...ROSTER.filter((m) => m.id !== FIXTURE_REMOVED_MEMBER.id), removedMidYear];
  const rows = [
    entry({ memberId: removedMidYear.id, startDate: "2026-04-13", endDate: "2026-04-17" }),
  ];

  it("keeps the row and fills only the days before the removal", () => {
    // Strictly after, not on or after: somebody removed at midnight on the 15th is gone ON the 15th.
    const away = absentDatesByMember(rows, YEAR, roster);
    expect(away.has(removedMidYear.id)).toBe(true);
    expect(datesFor(away, removedMidYear.id)).toEqual(["2026-04-13", "2026-04-14"]);
  });

  it("fills nothing for an entry whose member is not on the roster at all", () => {
    // The two reads are scoped to the same team, so this means they disagree — and a filled cell in
    // a row the grid cannot draw is a cell contributing to a total nobody can account for.
    const orphan = [
      entry({ memberId: "00000000-0000-4000-8000-000000000000", startDate: "2026-04-14", endDate: "2026-04-14" }),
    ];
    const away = absentDatesByMember(orphan, YEAR, ROSTER);
    expect([...away.values()].every((set) => set.size === 0)).toBe(true);
  });
});

describe("CAL-06 AC-9 and AC-10: the grid and the totals cannot disagree about who is away", () => {
  // The criterion that matters, because a divergence between the filled cells and the totals strip
  // is invisible on either half of the screen alone. Every shape INV-04 distinguishes is in this one
  // set, inside one week of the year so the assertions below are readable.
  const rows = [
    entry({ memberId: FIXTURE_MEMBER.id, portion: "am", startDate: "2026-10-07", endDate: "2026-10-07" }),
    entry({ memberId: FIXTURE_MEMBER.id, portion: "pm", startDate: "2026-10-07", endDate: "2026-10-07" }),
    entry({ memberId: FIXTURE_ADMIN.id, portion: "full", startDate: "2026-10-05", endDate: "2026-10-09" }),
    entry({ memberId: FIXTURE_SECOND_ADMIN.id, portion: "am", tentative: true, startDate: "2026-10-07", endDate: "2026-10-08" }),
    entry({ memberId: FIXTURE_APPROVED_MEMBER.id, status: "rejected", rejectionReason: "no", startDate: "2026-10-07", endDate: "2026-10-07" }),
    entry({ memberId: FIXTURE_REMOVED_MEMBER.id, startDate: "2026-10-05", endDate: "2026-10-11" }),
  ];

  const away = absentDatesByMember(rows, YEAR, ROSTER);
  const members = absentMembersFor(rows, YEAR, ROSTER);
  const counts = absenceCountsFor(rows, YEAR, ROSTER);

  it("fills a cell for exactly the members the month grid draws, on every day of the year", () => {
    // AC-10 in full, over all 365 columns rather than over a sample: the column of filled cells and
    // the avatars on the month grid are the same set of people, or one of the two screens is lying.
    for (const date of eachDateInRange(YEAR)) {
      const filled = ROSTER.filter((m) => away.get(m.id)?.has(date)).map((m) => m.id);
      expect(filled.sort()).toEqual([...avatarsOn(members, date)].sort());
    }
  });

  it("puts a total above every column that has a filled cell, and a zero above every column that has none", () => {
    // AC-9's own failure mode, and the reason `data-count` exists on the strip: a filled cell over a
    // zero, or a total over an empty column, is the divergence INV-04 forbids.
    for (const date of eachDateInRange(YEAR)) {
      const filled = ROSTER.filter((m) => away.get(m.id)?.has(date)).length;
      const total = on(counts, date) ?? 0;

      expect(total > 0).toBe(filled > 0);
      // Every filled cell is worth 0.5 or 1, so the total is bounded by the number of filled cells
      // at both ends. This is what makes "four names against 3.5" a passing state rather than the
      // contradiction it would be on a screen that showed one number per person.
      expect(total).toBeGreaterThanOrEqual(filled * 0.5);
      expect(total).toBeLessThanOrEqual(filled);
    }
  });

  it("is not vacuous: the year under test actually holds people", () => {
    // Two agreeing empty maps agree perfectly, so the pair above would pass against a function that
    // filled nothing. This is the line that stops that. THREE PEOPLE ON THE 7TH AND 2.5 — the
    // feature row's own example standing up.
    expect(ROSTER.filter((m) => away.get(m.id)?.has("2026-10-07"))).toHaveLength(3);
    expect(on(counts, "2026-10-07")).toBe(2.5);
    expect(datesFor(away, FIXTURE_APPROVED_MEMBER.id)).toEqual([]);
  });
});

describe("CAL-06 section 4.3: the derivation stands up at the shape the brief names", () => {
  it("answers for thirty members across 365 days", () => {
    // 01-plan.md Open questions item 1. The brief's target — *thirty members and 365 columns, still
    // scrolling smoothly* — is asserted in two halves, and only the STRUCTURAL half is assertable
    // here: `vite.config.ts` sets `test.environment: "node"`, so there is no DOM and no
    // component-render level in this repository, and the seeded roster is five members so no
    // end-to-end run can reach thirty either. NO THRESHOLD IS INVENTED and nothing below is timed.
    //
    // The thirty members are CONSTRUCTED rather than imported, which is the one place in this file
    // that happens and is declared in 03-impl-log.md § Deviations: a thirty-member fixture is its
    // own decision (a seed row per person), and this is a scale property of a pure function rather
    // than an assertion about any entity.
    const roster: Member[] = Array.from({ length: 30 }, (_, index) => ({
      ...FIXTURE_MEMBER,
      id: `ac000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
      displayName: `Member ${String(index).padStart(2, "0")}`,
    }));

    // One entry each, a fortnight long, walking across the year — so every member has a row with
    // something in it and no two rows are the same.
    const rows = roster.map((member, index) =>
      entry({
        memberId: member.id,
        startDate: addDays("2026-01-01", index * 12),
        endDate: addDays("2026-01-01", index * 12 + 13),
      }),
    );

    const away = absentDatesByMember(rows, YEAR, roster);

    expect(away.size).toBe(30);
    for (const member of roster) expect(away.get(member.id)?.size).toBe(14);

    // And the totals over the same 365 columns still agree with the filled cells, at this size too.
    const counts = absenceCountsFor(rows, YEAR, roster);
    for (const date of eachDateInRange(YEAR)) {
      const filled = roster.filter((m) => away.get(m.id)?.has(date)).length;
      expect(on(counts, date)).toBe(filled);
    }
  });
});

// ===========================================================================
// CAL-10 — the summary band's PTO/WFH split. 01-plan.md sections 4.1 and 7.
//
// **THIS IS THE CHEAPEST POSSIBLE CHECK OF ADR-032's REVERT CONDITION**, which is why the standard
// puts it here rather than only on the screen: the partition is asserted AGAINST `absenceCountsFor`
// over the same fixtures, so a divergence between the two shows up as a failing identity rather than
// as two plausible numbers sitting next to each other in a browser.
//
// The entries below are constructed exactly as every block above constructs them, from the seeded
// row, for the reason this file's own header gives — they are the ARGUMENTS of a pure function and
// not entities, and the shapes INV-04 distinguishes do not exist in `supabase/seed.sql`.
// ===========================================================================

/** INV-04's total over a range, summed off the map the screen sums — never recomputed here. */
const totalOver = (counts: ReadonlyMap<string, number>, range: DateRange): number =>
  eachDateInRange(range).reduce((sum, date) => sum + (counts.get(date) ?? 0), 0);

describe("CAL-10 AC-6: the PTO and WFH parts partition INV-04's total exactly", () => {
  it("splits a plain month by type, and the two halves sum to the total", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, type: "pto", startDate: "2026-04-06", endDate: "2026-04-08" }),
      entry({ memberId: FIXTURE_ADMIN.id, type: "wfh", startDate: "2026-04-06", endDate: "2026-04-07" }),
    ];

    const split = absenceByTypeFor(rows, APRIL, ROSTER);

    expect(split).toEqual({ pto: 3, wfh: 2 });
    expect(split.pto + split.wfh).toBe(totalOver(absenceCountsFor(rows, APRIL, ROSTER), APRIL));
  });

  it("inherits every rule of the one pass, so the identity survives the five shapes INV-04 distinguishes", () => {
    // ONE dataset holding all five, because the failure this guards against is a filter on a screen
    // that applies NONE of them — 01-plan.md section 8, rejected alternative 1. Each row below is a
    // rule `walk` applies and a `.filter(e => e.type === 'pto')` would not.
    const rows = [
      // Rejected: contributes nothing, to either half (AC-4 of CAL-04).
      entry({ memberId: FIXTURE_MEMBER.id, type: "pto", status: "rejected", startDate: "2026-04-02", endDate: "2026-04-03" }),
      // Tentative: counts on exactly the same terms as any other (INV-05).
      entry({ memberId: FIXTURE_MEMBER.id, type: "wfh", tentative: true, startDate: "2026-04-06", endDate: "2026-04-07" }),
      // A half day: 0.5, and it lands in the half its own type names (AC-3 of CAL-04).
      entry({ memberId: FIXTURE_ADMIN.id, type: "pto", portion: "am", startDate: "2026-04-09", endDate: "2026-04-09" }),
      // A removed member: counts up to the removal and not after it (ADR-013). FIXTURE_REMOVED_MEMBER
      // was removed 2026-08-31, so the whole of April is still theirs.
      entry({ memberId: FIXTURE_REMOVED_MEMBER.id, type: "pto", startDate: "2026-04-10", endDate: "2026-04-10" }),
      // Spanning the range boundary: clamped to April, so March 30th and 31st are not in either half.
      entry({ memberId: FIXTURE_SECOND_ADMIN.id, type: "wfh", startDate: "2026-03-30", endDate: "2026-04-02" }),
      // An entry whose member is not in the roster: counts for nobody, in either half.
      entry({ memberId: "99999999-9999-4999-8999-999999999999", type: "pto", startDate: "2026-04-15", endDate: "2026-04-17" }),
    ];

    const split = absenceByTypeFor(rows, APRIL, ROSTER);
    const counts = absenceCountsFor(rows, APRIL, ROSTER);

    // The identity, which is the whole criterion. It is asserted against the OTHER function rather
    // than against a literal, because a literal would be a second arithmetic in the test.
    expect(split.pto + split.wfh).toBe(totalOver(counts, APRIL));

    // And the halves are what they should be, so the identity above is not two wrong numbers
    // cancelling: 0.5 of PTO (the am) + 1 (the removed member's day), and 2 of WFH (the tentative
    // pair) + 2 (the clamped span's 1 and 2 April).
    expect(split).toEqual({ pto: 1.5, wfh: 4 });
  });

  it("holds over a whole year, which is the range the summary band actually asks for", () => {
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, type: "pto", startDate: "2026-01-01", endDate: "2026-01-31" }),
      entry({ memberId: FIXTURE_ADMIN.id, type: "wfh", startDate: "2026-06-01", endDate: "2026-06-30" }),
      entry({ memberId: FIXTURE_APPROVED_MEMBER.id, type: "wfh", portion: "pm", startDate: "2026-12-28", endDate: "2026-12-31" }),
      entry({ memberId: FIXTURE_SECOND_ADMIN.id, type: "pto", portion: "am", startDate: "2026-12-30", endDate: "2027-01-05" }),
    ];

    const split = absenceByTypeFor(rows, YEAR, ROSTER);

    // 31 PTO days + 1 (two clamped am days in the year) and 30 WFH + 2 (four pm days).
    expect(split).toEqual({ pto: 32, wfh: 32 });
    expect(split.pto + split.wfh).toBe(totalOver(absenceCountsFor(rows, YEAR, ROSTER), YEAR));
  });

  it("is {pto: 0, wfh: 0} on an empty year rather than an absent half", () => {
    // Both halves are ALWAYS present — the contract on `AbsenceByType`. A caller reading
    // `split.wfh` on a year of pure PTO must get 0 and never `undefined`, or the summary card would
    // render nothing where it should render a zero.
    const split = absenceByTypeFor([], YEAR, ROSTER);
    expect(split).toEqual({ pto: 0, wfh: 0 });

    const onlyPto = absenceByTypeFor(
      [entry({ memberId: FIXTURE_MEMBER.id, type: "pto", startDate: "2026-04-06", endDate: "2026-04-06" })],
      YEAR,
      ROSTER,
    );
    expect(onlyPto.wfh).toBe(0);
  });
});

describe("CAL-10 AC-8: a fractional total stays a fraction and is never rounded", () => {
  it("reports 0.5 for one am half day, in the total and in its own half", () => {
    // The criterion names the screen, and this is its derivation half: `0.5` must be 0.5 here, or no
    // rendering could show it. `0` and `1` are both wrong and both plausible.
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, type: "pto", portion: "am", startDate: "2026-04-07", endDate: "2026-04-07" }),
    ];

    const split = absenceByTypeFor(rows, YEAR, ROSTER);
    expect(split).toEqual({ pto: 0.5, wfh: 0 });
    expect(totalOver(absenceCountsFor(rows, YEAR, ROSTER), YEAR)).toBe(0.5);
  });

  it("adds two halves of one date to exactly 1, in the split as in the total", () => {
    // INV-01 forbids two entries of the same member on the same slot, so an `am` and a `pm` on one
    // date is 1.0 and never 1.5 — and the split must reach the same answer by the same route. The
    // two halves are different TYPES here, which is the case only this function can get wrong.
    const rows = [
      entry({ memberId: FIXTURE_MEMBER.id, type: "pto", portion: "am", startDate: "2026-04-07", endDate: "2026-04-07" }),
      entry({ memberId: FIXTURE_MEMBER.id, type: "wfh", portion: "pm", startDate: "2026-04-07", endDate: "2026-04-07" }),
    ];

    const split = absenceByTypeFor(rows, APRIL, ROSTER);
    expect(split).toEqual({ pto: 0.5, wfh: 0.5 });
    expect(split.pto + split.wfh).toBe(1);
    expect(on(absenceCountsFor(rows, APRIL, ROSTER), "2026-04-07")).toBe(1);
  });
});
