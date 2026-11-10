// CAL-09 — the calendar read's assembly, at the level the standard assigns it.
//
// `.ai/standards/testing-standards.md` puts pure logic and seam behaviour at the unit level and "a
// full acceptance criterion through the interface" at the end-to-end one. So the WALK, the ORDER, the
// PREDICATE and the SCOPE are asserted here against `listTeamEntriesOverlapping` directly, and what a
// member SEES is AC-11, which is end-to-end.
//
// **IT DRIVES THE MOCK IMPLEMENTATION DIRECTLY**, the way tests/pending-entries.test.ts and
// tests/seam-parity.test.ts do, rather than through `@/lib/data` — which resolves by environment. The
// two properties this ticket rests on are invisible to the parity test, which compares names and
// arity: the ROW ORDER, written twice because a page boundary needs a stable order
// (01-plan.md section 5), and COMPLETENESS never being derived from the rows in hand.
//
// **WHAT IS ASSERTED NOWHERE IS DECLARED HERE RATHER THAN LEFT TO BE DISCOVERED** — 01-plan.md
// section 7, and 03-impl-log.md repeats it:
//
// - **AC-5, AC-6 and AC-7 are unreachable in this implementation.** The count and the windows come
//   from one array, so a row cannot be skipped or repeated between them and there is no `count` that
//   can come back null. The refusals exist in `mock.ts` so the two implementations tell one story;
//   they are exercised by neither this file nor any other, and no test can make PostgREST cap a read
//   without a provisioned project. This is the same limit tests/pending-entries.test.ts records for
//   ADM-04's short-page assertion at its own head.
// - **AC-8's BEHAVIOUR is asserted nowhere.** Exhausting the bound needs more than
//   TEAM_ENTRY_PAGE_SIZE * TEAM_ENTRY_MAX_PAGES matching entries — 4001 rows, which is more than a
//   unit test should build. Its ARITHMETIC is asserted, in tests/row-limits.test.ts (AC-13), and that
//   is the whole of the evidence for it.
// - **AC-11 and AC-12 are end-to-end**, and pinned to the mock by playwright.config.ts:49-51.
//
// **A GREEN RUN HERE PROVES THE ASSEMBLY IS IMPLEMENTED. It does not prove it repairs a truncation
// the mock cannot produce.** That sentence is the honest reading of the three declarations above and
// is why it is written rather than implied.
//
// The entries below are created through `seam.createEntry` rather than added as fixtures, for the
// reason tests/pending-entries.test.ts records: every active member of FIXTURE_TEAM has an own-entry
// list whose exact row count is asserted by a shipped end-to-end suite, and a seeded row breaks one
// of them whoever owns it. Creating them is also the truthful route — a pending entry is exactly what
// CAL-01's form produces.
import { beforeAll, describe, expect, it } from "vitest";
import { seam, __setCurrentMember } from "@/lib/data/mock";
import { absenceCountsFor, addDays } from "@/lib/data/absence";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_MEMBER,
} from "@/lib/fixtures";
import { TEAM_ENTRY_PAGE_SIZE } from "@/lib/domain/types";
import type { DateRange, Entry } from "@/lib/domain/types";

/**
 * The first day of the run. Far outside every date any other suite uses, and far outside the
 * fixtures' own 2026 entries, so the ranges below match this file's rows and nothing else.
 */
const RUN_START = "2030-03-01";

/** One more than a page, so the walk must issue a second request to come back whole (AC-1). */
const RUN_LENGTH = TEAM_ENTRY_PAGE_SIZE + 1;

/** The last day of the run, and the one date two members share (AC-2's tiebreaker). */
const SHARED_DAY = addDays(RUN_START, RUN_LENGTH - 1);

/** Every day of the run: `RUN_LENGTH` rows from one member, plus the shared one. */
const FULL_RANGE: DateRange = { start: RUN_START, end: SHARED_DAY };

/**
 * Exactly one page. The run is single-day entries, so the first `TEAM_ENTRY_PAGE_SIZE` days match
 * exactly `TEAM_ENTRY_PAGE_SIZE` entries — the shared day is deliberately the LAST day and falls
 * outside this window (AC-4).
 */
const EXACT_PAGE_RANGE: DateRange = {
  start: RUN_START,
  end: addDays(RUN_START, TEAM_ENTRY_PAGE_SIZE - 1),
};

/** Every entry in `FULL_RANGE`: the run, plus FIXTURE_APPROVED_MEMBER's row on the shared day. */
const FULL_RANGE_MATCHES = RUN_LENGTH + 1;

/** A year nothing in this repository puts an entry in (AC-3). */
const EMPTY_RANGE: DateRange = { start: "2029-01-01", end: "2029-01-31" };

// AC-9's three rows. April 2026 rather than 2030 because the SPANNING one is transcribed from the
// criterion verbatim, and the criterion names those dates.
const APRIL: DateRange = { start: "2026-04-01", end: "2026-04-30" };
const SPANNING_START = "2026-03-28";
const SPANNING_END = "2026-04-02";
const REJECTED_DAY = "2026-04-10";
const OTHER_TEAM_DAY = "2026-04-15";

let spanningId = "";
let rejectedId = "";
let otherTeamId = "";

const createDay = async (startDate: string, endDate = startDate): Promise<string> => {
  const created = await seam.createEntry({
    type: "pto",
    portion: "full",
    startDate,
    endDate,
    tentative: false,
    note: null,
  });
  expect(created.ok, `creating ${startDate} was refused`).toBe(true);
  return created.ok ? created.value.id : "";
};

const asMember = (): void => __setCurrentMember(FIXTURE_MEMBER.id);

beforeAll(async () => {
  // The run is one member's, because INV-01 forbids one member holding two entries that overlap on
  // the same slot and every day below is distinct. `RUN_LENGTH` consecutive single days is the
  // cheapest fixture that crosses a page boundary.
  asMember();
  for (let day = 0; day < RUN_LENGTH; day += 1) {
    await createDay(addDays(RUN_START, day));
  }

  // AC-9's spanning row and the row that is rejected below. Both April 2026, neither overlapping the
  // other, and neither overlapping the 2030 run.
  spanningId = await createDay(SPANNING_START, SPANNING_END);
  rejectedId = await createDay(REJECTED_DAY);

  // AC-2's tiebreaker. A SECOND member on the run's last date, which is the only way to observe the
  // `id` tiebreaker at all: INV-01 makes two entries of the same member on one date impossible.
  __setCurrentMember(FIXTURE_APPROVED_MEMBER.id);
  await createDay(SHARED_DAY);

  // AC-9's third row, and the one that must NOT come back. Created by a member of the other team, so
  // it is excluded by the seam's team filter and not by anything this file does.
  __setCurrentMember(FIXTURE_OTHER_TEAM_MEMBER.id);
  otherTeamId = await createDay(OTHER_TEAM_DAY);

  // AC-9's rejected row is rejected by an admin, the way the product rejects one. `absenceCountsFor`
  // is the only thing that may exclude it, and the read must still return it.
  __setCurrentMember(FIXTURE_ADMIN.id);
  const rejected = await seam.rejectEntry(rejectedId, "Không đủ người trực ngày đó.");
  expect(rejected.ok, "rejecting the April entry was refused").toBe(true);

  asMember();
});

const idsOf = (rows: readonly Entry[]): string[] => rows.map((e) => e.id);

describe("CAL-09 — listTeamEntriesOverlapping assembles across pages", () => {
  it("AC-1: a matching set larger than one page comes back whole", async () => {
    const rows = await seam.listTeamEntriesOverlapping(FULL_RANGE);

    // The LENGTH, and not merely "more than a page". A walk that stopped after the first request
    // would return exactly TEAM_ENTRY_PAGE_SIZE rows and look plausible, which is the failure the
    // whole ticket exists to make impossible.
    expect(rows).toHaveLength(FULL_RANGE_MATCHES);
    expect(rows.length).toBeGreaterThan(TEAM_ENTRY_PAGE_SIZE);
  });

  it("AC-2: the order survives the page boundaries and no row repeats", async () => {
    const rows = await seam.listTeamEntriesOverlapping(FULL_RANGE);

    // Ascending by `startDate`, then by `id` within one `startDate`. Asserted over the WHOLE array
    // rather than at the boundary index, because a walk that re-sorted per page would pass a check
    // aimed at one seam and fail here.
    const sorted = rows
      .slice()
      .sort((a, b) =>
        a.startDate === b.startDate
          ? a.id.localeCompare(b.id)
          : a.startDate.localeCompare(b.startDate),
      );
    expect(idsOf(rows)).toEqual(idsOf(sorted));

    // The `id` tiebreaker has a case to be observed on: two members share the run's last date.
    const onSharedDay = rows.filter((e) => e.startDate === SHARED_DAY);
    expect(onSharedDay).toHaveLength(2);
    expect(idsOf(onSharedDay)).toEqual(idsOf(onSharedDay).slice().sort());

    // No `id` twice. This is the property AC-6 refuses at the seam; here it is asserted as an
    // outcome, because a set assembled from overlapping windows is the ordinary way to get it wrong.
    expect(new Set(idsOf(rows)).size).toBe(rows.length);
  });

  it("AC-3: an empty match resolves with [] and does not throw", async () => {
    await expect(seam.listTeamEntriesOverlapping(EMPTY_RANGE)).resolves.toEqual([]);
  });

  it("AC-4: a matching set of exactly one page is not mistaken for a truncation", async () => {
    // The boundary case the ceiling this ticket removed got wrong by construction: a full page is
    // indistinguishable from a truncated one to a `rows.length >= LIMIT` assertion, so the old code
    // threw here. The assembly compares against the datastore's count instead, and a set that is
    // exactly one page is complete.
    const rows = await seam.listTeamEntriesOverlapping(EXACT_PAGE_RANGE);
    expect(rows).toHaveLength(TEAM_ENTRY_PAGE_SIZE);
  });

  it("AC-9: the predicate, the scope and the statuses are unchanged", async () => {
    const rows = await seam.listTeamEntriesOverlapping(APRIL);
    const ids = idsOf(rows);

    // OVERLAP, not containment: an entry running 2026-03-28 to 2026-04-02 belongs to April.
    expect(ids).toContain(spanningId);

    // A REJECTED row still comes back. Filtering `status` here would be a second copy of INV-04's
    // rule outside `absenceCountsFor`, which is the one thing INV-04 forbids.
    const rejected = rows.find((e) => e.id === rejectedId);
    expect(rejected?.status).toBe("rejected");

    // INV-07. No row of another team, on any page — and the read pages, so "no team leaked in" is a
    // claim about every request and not only the first.
    expect(ids).not.toContain(otherTeamId);
    expect(rows.every((e) => e.memberId !== FIXTURE_OTHER_TEAM_MEMBER.id)).toBe(true);
  });

  it("AC-10: INV-04 is computed once, over the whole assembled set", async () => {
    const roster = await seam.listMembers();
    const rows = await seam.listTeamEntriesOverlapping(FULL_RANGE);

    // ONE call, handed the complete array. There is nowhere else a total could come from: the seam
    // returns `Entry[]` and no count, so a per-page sum would have to be invented above it.
    const counts = absenceCountsFor(rows, FULL_RANGE, roster);

    // Every row is one full day for one member, so the sum over the range is the number of rows. A
    // count derived from the first page alone would come to TEAM_ENTRY_PAGE_SIZE and would look
    // entirely reasonable on screen — which is why the total, and not a spot check, is asserted.
    const total = [...counts.values()].reduce((sum, n) => sum + n, 0);
    expect(total).toBe(FULL_RANGE_MATCHES);

    // The shared day sits beyond the first page and carries both members. A truncated read renders it
    // empty, and nothing anywhere says so.
    expect(counts.get(SHARED_DAY)).toBe(2);
  });
});
