// ADM-04 — the worklist read, at the level the standard assigns it.
//
// `.ai/standards/testing-standards.md` puts pure logic and seam behaviour at the unit level and "a
// full acceptance criterion through the interface" at the end-to-end one. So the PREDICATE, the
// ORDER, the PAGING and the COUNT are asserted here against `listPendingEntries` directly, and what
// an admin SEES is in tests/e2e/adm-04-worklist.spec.ts.
//
// **IT DRIVES THE MOCK IMPLEMENTATION DIRECTLY**, the way tests/seam-parity.test.ts does, rather than
// through `@/lib/data` — which resolves by environment. Two properties this ticket depends on are
// invisible to the parity test, which compares names and arity: the ROW ORDER, written twice because
// paging needs a server-side one (01-plan.md section 2, Open questions item 5), and `total` NEVER
// being `rows.length`. Both are stated in 01-plan.md section 4.2 as contract, and this file is where
// the mock's copy of each is asserted.
//
// **AC-3, AC-4 AND AC-16 ARE ASSERTED HERE OR NOWHERE, AND THAT IS DECLARED IN 03-impl-log.md.**
// - AC-3 and AC-4 need a matching set larger than one page. `PENDING_PAGE_SIZE` is 50, and creating
//   fifty-one entries through the interface would be a browser test that spends four minutes proving
//   something arithmetic.
// - AC-16 needs the process timezone changed under the read, which no browser test can do.
//
// **AC-5 IS ASSERTED NOWHERE, and that is declared too.** The short-page throw fires when the
// datastore shortens a page that is not the last one. In this implementation the slice and the count
// come from one array, so the two cannot disagree and the assertion cannot fire; and no test can make
// PostgREST cap a read without a provisioned project. What IS asserted below is the other half — that
// a short LAST page does not throw — because an assertion written the obvious way (`rows.length <
// pageSize`) would fire on every last page and make the worklist unusable at exactly the moment it
// emptied.
//
// **The entries below are created through `seam.createEntry` rather than added as fixtures, and that
// is a declared deviation from 01-plan.md section 4.4** (03-impl-log.md). Every active member of
// FIXTURE_TEAM has an own-entry list whose exact row count is asserted by a shipped end-to-end suite,
// so a seeded pending entry breaks one of them whoever owns it — the collision is recorded in the
// implementation log with the file and line of each. Creating them is also the truthful route: a
// pending entry is exactly what CAL-01's form produces, `status` is the column default, and nothing
// here needs a state the product cannot reach.
import { beforeAll, describe, expect, it } from "vitest";
import { seam, __setCurrentMember } from "@/lib/data/mock";
import { addDays } from "@/lib/data/absence";
import {
  FIXTURE_APPROVED_ENTRY,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM_ENTRY,
  FIXTURE_OTHER_TEAM_MEMBER,
} from "@/lib/fixtures";
import { PENDING_PAGE_SIZE } from "@/lib/domain/types";
import type { Entry, PendingEntryQuery, PendingWindow } from "@/lib/domain/types";

/**
 * The caller's date, supplied rather than read (AC-16). It is the day this plan was written, so the
 * 2025 entry below is permanently past and the 2030 ones are permanently upcoming — the property
 * 01-plan.md section 4.4 asks of the fixture dates, kept even though the rows are created here.
 */
const TODAY = "2026-09-05";

/** One more than a page, so `total` and `rows.length` cannot agree on page 0 (AC-3). */
const UPCOMING_PTO = PENDING_PAGE_SIZE + 1;

/** The first of the run. Far outside any window the calendar screens are used for. */
const RUN_START = "2030-03-01";

const UPCOMING_WFH_DATE = "2030-06-01";
const SHARED_DATE = "2030-07-01";
const PAST_START = "2025-03-04";
const PAST_END = "2025-03-06";

const query = (fields: Partial<PendingEntryQuery> = {}): PendingEntryQuery => ({
  type: null,
  window: "upcoming",
  today: TODAY,
  page: 0,
  ...fields,
});

/** Every row of a query, walked page by page — which is also how AC-4 is asserted. */
async function allPages(fields: Partial<PendingEntryQuery> = {}): Promise<Entry[]> {
  const first = await seam.listPendingEntries(query({ ...fields, page: 0 }));
  const rows = [...first.rows];

  for (let page = 1; page * first.pageSize < first.total; page += 1) {
    const next = await seam.listPendingEntries(query({ ...fields, page }));
    // AC-4. The count does not move between pages, because it is the size of the matching set and
    // not of the page.
    expect(next.total).toBe(first.total);
    rows.push(...next.rows);
  }

  return rows;
}

const asAdmin = (): void => __setCurrentMember(FIXTURE_APPROVED_MEMBER.id);

beforeAll(async () => {
  // FIXTURE_MEMBER creates the run and the past-dated row; FIXTURE_APPROVED_MEMBER creates the
  // work-from-home one and one entry sharing a start date with a PTO row, so the tiebreakers in the
  // order have a case to be observed on. INV-01 forbids one member holding two overlapping entries,
  // so every date below is distinct per member.
  __setCurrentMember(FIXTURE_MEMBER.id);

  for (let day = 0; day < UPCOMING_PTO; day += 1) {
    const date = addDays(RUN_START, day);
    const created = await seam.createEntry({
      type: "pto",
      portion: "full",
      startDate: date,
      endDate: date,
      tentative: false,
      note: null,
    });
    expect(created.ok, `creating ${date} was refused`).toBe(true);
  }

  const past = await seam.createEntry({
    type: "pto",
    portion: "full",
    startDate: PAST_START,
    endDate: PAST_END,
    tentative: false,
    note: null,
  });
  expect(past.ok).toBe(true);

  const shared = await seam.createEntry({
    type: "pto",
    portion: "full",
    startDate: SHARED_DATE,
    endDate: SHARED_DATE,
    tentative: false,
    note: null,
  });
  expect(shared.ok).toBe(true);

  __setCurrentMember(FIXTURE_APPROVED_MEMBER.id);

  for (const [startDate, type] of [
    [UPCOMING_WFH_DATE, "wfh"],
    [SHARED_DATE, "pto"],
  ] as const) {
    const created = await seam.createEntry({
      type,
      portion: "full",
      startDate,
      endDate: startDate,
      tentative: false,
      note: null,
    });
    expect(created.ok, `creating ${startDate} was refused`).toBe(true);
  }

  asAdmin();
});

// The whole matching set, for the three windows, once the rows above exist.
// The run, the work-from-home row, and BOTH shared-date rows — one per member, which is what
// gives the order's tiebreakers a case to be observed on.
const UPCOMING_TOTAL = UPCOMING_PTO + 3;
const PAST_TOTAL = 1;

describe("AC-1: the worklist contains exactly the entries awaiting a decision", () => {
  it("returns only pending rows, and never the seeded APPROVED one", async () => {
    const rows = await allPages({ window: "all" });

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) expect(row.status).toBe("pending");

    // FIXTURE_APPROVED_ENTRY belongs to a member of this team and is `approved`, so it is the row
    // that would appear if the status predicate were dropped.
    expect(rows.map((row) => row.id)).not.toContain(FIXTURE_APPROVED_ENTRY.id);
  });
});

describe("AC-13 and INV-07: no other team's entry appears, and the count does not include it", () => {
  it("excludes FIXTURE_OTHER_TEAM_ENTRY, which is pending and on the other team", async () => {
    // The row that makes this assertion possible: it is `pending`, so the status predicate does not
    // hide it, and the ONLY thing keeping it out is the team scope — `entry_select_team` in the real
    // implementation, `sameTeam` in this one.
    expect(FIXTURE_OTHER_TEAM_ENTRY.status).toBe("pending");

    const page = await seam.listPendingEntries(query({ window: "all" }));
    const rows = await allPages({ window: "all" });

    expect(rows.map((row) => row.id)).not.toContain(FIXTURE_OTHER_TEAM_ENTRY.id);
    for (const row of rows) expect(row.memberId).not.toBe(FIXTURE_OTHER_TEAM_MEMBER.id);

    // And the COUNT does not include it either — the half a row-level assertion would miss.
    expect(page.total).toBe(UPCOMING_TOTAL + PAST_TOTAL);
  });
});

describe("AC-2: every row carries the member it belongs to", () => {
  it("every row names an owner, so the screen has a name to resolve", async () => {
    const rows = await allPages({ window: "all" });
    for (const row of rows) expect(row.memberId).toBeTruthy();

    // Both owners appear, so the list is a team's queue rather than one person's.
    const owners = new Set(rows.map((row) => row.memberId));
    expect(owners).toEqual(new Set([FIXTURE_MEMBER.id, FIXTURE_APPROVED_MEMBER.id]));
  });
});

describe("AC-3: the outstanding count is exact, and cannot disagree with the list", () => {
  it("states the size of the whole matching set while returning one page of it", async () => {
    const page = await seam.listPendingEntries(query());

    expect(page.total).toBe(UPCOMING_TOTAL);
    expect(page.rows).toHaveLength(PENDING_PAGE_SIZE);

    // THE ASSERTION THIS TICKET EXISTS FOR. `total` is not `rows.length`, and on this page the two
    // are different numbers — which is what makes the simplification detectable at all.
    expect(page.total).not.toBe(page.rows.length);
    expect(page.pageSize).toBe(PENDING_PAGE_SIZE);
    expect(page.page).toBe(0);
  });

  it("the count comes back with the rows, so no second read can disagree with it", async () => {
    // One call answers both halves. There is no `countPendingEntries` to drift from this — 01-plan.md
    // section 8, rejected alternative 1 — and a test that asked twice would be testing the shape the
    // plan rejected.
    const page = await seam.listPendingEntries(query());
    expect(Object.keys(page).sort()).toEqual(["page", "pageSize", "rows", "total"]);
  });
});

describe("AC-4: the list pages rather than truncates", () => {
  it("every matching entry is reachable, exactly once, across the pages", async () => {
    const first = await seam.listPendingEntries(query());
    const second = await seam.listPendingEntries(query({ page: 1 }));

    expect(first.rows).toHaveLength(PENDING_PAGE_SIZE);
    expect(second.rows).toHaveLength(UPCOMING_TOTAL - PENDING_PAGE_SIZE);
    expect(second.total).toBe(first.total);
    expect(second.page).toBe(1);

    const ids = [...first.rows, ...second.rows].map((row) => row.id);
    expect(new Set(ids).size).toBe(UPCOMING_TOTAL);
    expect(ids).toHaveLength(UPCOMING_TOTAL);
  });

  it("a page past the end is empty rather than an error, and still states the total", async () => {
    const page = await seam.listPendingEntries(query({ page: 9 }));

    // The short-page assertion must NOT fire here: `from` is already past `total`, so nothing was
    // shortened — there was nothing left to return.
    expect(page.rows).toHaveLength(0);
    expect(page.total).toBe(UPCOMING_TOTAL);
  });
});

describe("AC-5: a short LAST page is normal and does not throw", () => {
  it("the final page returns fewer rows than the page size without raising", async () => {
    // The obvious form of the assertion — `rows.length < pageSize` — would fire on every last page
    // and make the worklist unusable at exactly the moment the queue emptied. The condition is short
    // AND more rows remaining, which is the datastore capping the window rather than the set ending.
    const last = await seam.listPendingEntries(query({ page: 1 }));
    expect(last.rows.length).toBeLessThan(PENDING_PAGE_SIZE);
    expect(last.page * last.pageSize + last.rows.length).toBe(last.total);
  });
});

describe("AC-6 and AC-7: the window filter, and the count follows it", () => {
  it("the default window shows what is still to come and hides what is already past", async () => {
    const upcoming = await seam.listPendingEntries(query({ window: "upcoming" }));
    const rows = await allPages({ window: "upcoming" });

    expect(upcoming.total).toBe(UPCOMING_TOTAL);
    for (const row of rows) expect(row.endDate >= TODAY).toBe(true);
    expect(rows.map((row) => row.startDate)).not.toContain(PAST_START);
  });

  it("the explicit past window reaches the entry nobody ever decided, and it is still pending", async () => {
    const past = await seam.listPendingEntries(query({ window: "past" }));

    expect(past.total).toBe(PAST_TOTAL);
    expect(past.rows).toHaveLength(1);
    expect(past.rows[0]?.startDate).toBe(PAST_START);
    expect(past.rows[0]?.endDate).toBe(PAST_END);

    // 01-plan.md section 1, Out of scope: no fourth `entry_status` and no auto-expiry. A past-dated
    // entry is hidden by a FILTER and is not a different state — nobody ever decided it.
    expect(past.rows[0]?.status).toBe("pending");
  });

  it("`all` is the union of the two, and the three counts add up", async () => {
    const all = await seam.listPendingEntries(query({ window: "all" }));
    expect(all.total).toBe(UPCOMING_TOTAL + PAST_TOTAL);
  });

  it("the boundary is inclusive on `today`, so an entry ending today is still to come", async () => {
    // `end_date >= today`. An entry ending TODAY has not been decided and the day is not over, so
    // hiding it would be the worklist losing a decision on the one day it still matters.
    const endingToday = await seam.listPendingEntries(query({ window: "upcoming", today: PAST_END }));
    expect(endingToday.rows.map((row) => row.endDate)).toContain(PAST_END);

    const dayAfter = await seam.listPendingEntries(
      query({ window: "upcoming", today: addDays(PAST_END, 1) }),
    );
    expect(dayAfter.rows.map((row) => row.endDate)).not.toContain(PAST_END);
  });
});

describe("AC-8: work-from-home entries are in the list, and the type filter narrows it", () => {
  it("both types with no type chosen, then each on its own, and the count follows each time", async () => {
    // 01-plan.md section 2, Open questions item 1, and the assumption that ships: a WFH entry goes
    // through approval exactly as a PTO entry does. Taking the recommendation changes nothing; the
    // alternative — a status-less type — is a schema change and a second rule.
    const both = await seam.listPendingEntries(query({ type: null }));
    expect(both.total).toBe(UPCOMING_TOTAL);

    const pto = await seam.listPendingEntries(query({ type: "pto" }));
    expect(pto.total).toBe(UPCOMING_TOTAL - 1);
    for (const row of await allPages({ type: "pto" })) expect(row.type).toBe("pto");

    const wfh = await seam.listPendingEntries(query({ type: "wfh" }));
    expect(wfh.total).toBe(1);
    expect(wfh.rows).toHaveLength(1);
    expect(wfh.rows[0]?.type).toBe("wfh");
    expect(wfh.rows[0]?.startDate).toBe(UPCOMING_WFH_DATE);
  });
});

describe("AC-11: a query matching nothing answers with an empty page and a zero count", () => {
  it("returns no rows and a total of 0 rather than throwing", async () => {
    const none = await seam.listPendingEntries(query({ window: "past", type: "wfh" }));

    expect(none.rows).toHaveLength(0);
    expect(none.total).toBe(0);
    // The screen needs the difference between "nothing is waiting" and "the read failed", and this
    // is the half that makes the first one representable.
    expect(none.page).toBe(0);
  });
});

describe("01-plan.md section 4.2: the order, written twice and invisible to the parity test", () => {
  it("is start_date, then created_at, then id — ascending on all three", async () => {
    const rows = await allPages({ window: "all" });
    const key = (row: Entry): string => `${row.startDate}|${row.createdAt}|${row.id}`;

    for (let at = 1; at < rows.length; at += 1) {
      const previous = rows[at - 1];
      const current = rows[at];
      expect(previous).toBeDefined();
      expect(current).toBeDefined();
      if (!previous || !current) continue;
      expect(
        key(previous) <= key(current),
        `${key(previous)} should sort before ${key(current)}`,
      ).toBe(true);
    }
  });

  it("soonest-concerning first, and not newest-created first", async () => {
    // 01-plan.md section 8, rejected alternative 5. A worklist ordered by creation buries an entry
    // starting next Monday under one for next year, and the whole purpose is deciding before the
    // date arrives.
    const first = await seam.listPendingEntries(query({ window: "all" }));
    expect(first.rows[0]?.startDate).toBe(PAST_START);

    const upcoming = await seam.listPendingEntries(query({ window: "upcoming" }));
    expect(upcoming.rows[0]?.startDate).toBe(RUN_START);
  });

  it("two entries sharing a start date are ordered deterministically, not by arrival", async () => {
    // The case the two tiebreakers exist for: a page boundary that shuffles between requests either
    // repeats a row or drops one, and dropping one here is an entry nobody ever decides.
    const shared = (await allPages({ window: "all" })).filter(
      (row) => row.startDate === SHARED_DATE,
    );
    expect(shared).toHaveLength(2);

    const again = (await allPages({ window: "all" })).filter(
      (row) => row.startDate === SHARED_DATE,
    );
    expect(again.map((row) => row.id)).toEqual(shared.map((row) => row.id));
  });
});

describe("AC-16: the window does not depend on the machine's timezone", () => {
  it("agrees under UTC, Asia/Ho_Chi_Minh and America/Los_Angeles", async () => {
    // `today` is a PARAMETER and every comparison is on `yyyy-MM-dd` strings, so there is no clock
    // inside the read to move. 01-plan.md section 8, rejected alternative 3 rejects the shape that
    // would have one — a datastore-side `current_date`, evaluated in UTC, which sits on yesterday
    // between 00:00 and 07:00 ICT for the only team this product has.
    const under = async (zone: string, window: PendingWindow): Promise<string> => {
      const previous = process.env.TZ;
      process.env.TZ = zone;
      try {
        const page = await seam.listPendingEntries(query({ window, page: 0 }));
        return JSON.stringify({ total: page.total, ids: page.rows.map((row) => row.id) });
      } finally {
        process.env.TZ = previous;
      }
    };

    for (const window of ["upcoming", "past", "all"] as const) {
      const utc = await under("UTC", window);
      expect(await under("Asia/Ho_Chi_Minh", window)).toBe(utc);
      expect(await under("America/Los_Angeles", window)).toBe(utc);
    }
  });
});
