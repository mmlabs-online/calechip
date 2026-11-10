// BUG-002 — every row ceiling must be REACHABLE.
//
// A read that asks the datastore for more rows than it will ever return cannot observe itself
// hitting its own ceiling: the server truncates first, the response is a SUCCESS, and the
// `rows.length >= LIMIT` assertion at every call site is unreachable code. The short list is then
// summed as if it were complete — INV-04's single definition fed a truncated set, printing a
// believable wrong number with no error anywhere. That is the defect this file exists to catch.
//
// **This is the only evidence available without a provisioned Supabase project** (01-plan.md § 4.3).
// No test can make PostgREST cap a read from here, so the property is asserted statically, against
// the named cap rather than against the server. 01-plan.md § 2 Open questions item 3 records the
// honest limit of that: it removes the drift that exists and cannot make a second one impossible.
//
// **The relation is `<=` and not `<`, and that is a decision rather than a looser test.** The true
// property is reachability, not margin: a ceiling EQUAL to the cap is hit exactly when the cap is
// hit, and the `>=` comparison at every assertion site fires on it. `HOLIDAY_LIMIT` has been correct
// at exactly 1000 since ADM-02 for that reason, and a strictly-below test would force it down —
// which 01-plan.md § 1 item 9 puts out of scope, because it is not broken and changing a working
// threshold inside a bug fix is the shape ADM-04 refused.
//
// **It fails on the tree as it stands before this change**, at `TEAM_ENTRY_LIMIT` and
// `MONTH_ENTRY_LIMIT` and at those two only, naming each — which is the first half of AC-3.
import { describe, expect, it } from "vitest";
import {
  DATASTORE_MAX_ROWS,
  HOLIDAY_LIMIT,
  MONTH_ENTRY_LIMIT,
  OWN_ENTRY_LIMIT,
  PENDING_PAGE_SIZE,
  ROSTER_LIMIT,
  TEAM_ENTRY_LIMIT,
  TEAM_ENTRY_MAX_PAGES,
  TEAM_ENTRY_PAGE_SIZE,
} from "@/lib/domain/types";

// Every ceiling the product defines for a SINGLE read, in the order they are declared in
// `src/lib/domain/types.ts`. The name is carried beside the value so a failure names the ceiling
// that exceeds the cap rather than reporting an anonymous integer — AC-3.
const CEILINGS: ReadonlyArray<readonly [string, number]> = [
  ["ROSTER_LIMIT", ROSTER_LIMIT],
  ["OWN_ENTRY_LIMIT", OWN_ENTRY_LIMIT],
  ["TEAM_ENTRY_LIMIT", TEAM_ENTRY_LIMIT],
  ["MONTH_ENTRY_LIMIT", MONTH_ENTRY_LIMIT],
  ["HOLIDAY_LIMIT", HOLIDAY_LIMIT],
];

describe("BUG-002 — row ceilings against the datastore cap", () => {
  it.each(CEILINGS)(
    "AC-1: %s is reachable — at most DATASTORE_MAX_ROWS",
    (_name, limit) => {
      expect(limit).toBeLessThanOrEqual(DATASTORE_MAX_ROWS);
    },
  );

  // AC-2. The cap is a named value in the tree, defined once and beside the ceilings that depend on
  // it. Asserting the figure pins what the ceilings were checked against: if someone changes the
  // constant without reading the client's own types, this fails beside the reason.
  it("AC-2: the datastore's maximum is named once, and is the documented 1000", () => {
    expect(DATASTORE_MAX_ROWS).toBe(1000);
  });

  // PENDING_PAGE_SIZE is deliberately NOT in CEILINGS: it is a window and the read pages rather than
  // truncating (`types.ts`, ADM-04). It must still sit below the cap, and it is asserted separately
  // so that a future change to paging cannot quietly borrow the ceiling rule.
  it("AC-1: PENDING_PAGE_SIZE is a window below the cap, not a ceiling", () => {
    expect(PENDING_PAGE_SIZE).toBeLessThan(DATASTORE_MAX_ROWS);
  });
});

// CAL-09 — the two constants that replaced MONTH_ENTRY_LIMIT's ceiling on the calendar read.
//
// They are asserted in this file and not in tests/team-entries-paging.test.ts because the property is
// arithmetic about the constants themselves, which is exactly what this file exists for, and because
// the third assertion below is the ONLY place AC-8's bound is observable at all: making the assembly
// actually exhaust TEAM_ENTRY_MAX_PAGES would cost a fixture of 4001 rows.
//
// MONTH_ENTRY_LIMIT stays in CEILINGS above, unchanged. Its row is now vacuously true — nothing reads
// the constant since CAL-09 — and removing it would edit BUG-002's list for no property gained.
describe("CAL-09 — the paged calendar read's window and bound", () => {
  // AC-13, first clause. A WINDOW, like PENDING_PAGE_SIZE and unlike the five ceilings: strictly
  // below the cap, so a page shortened by a lowered `max-rows` is distinguishable from a full one.
  // Equal to the cap would make every full page look shortened and every shortened page look full.
  it("AC-13: TEAM_ENTRY_PAGE_SIZE is a window strictly below the cap", () => {
    expect(TEAM_ENTRY_PAGE_SIZE).toBeLessThan(DATASTORE_MAX_ROWS);
  });

  // AC-13, second clause. At least 2, and the assembly's one refusal site depends on it: the loop
  // body must run at least once for `matching` to be assigned, and a bound of 1 would make the walk
  // a single request wearing a loop's clothes.
  it("AC-13: TEAM_ENTRY_MAX_PAGES admits more than one request", () => {
    expect(TEAM_ENTRY_MAX_PAGES).toBeGreaterThanOrEqual(2);
  });

  // AC-13, third clause, AND IT IS THE ONE THAT MAKES THE TICKET TRUE. The product's own maximum has
  // to sit ABOVE the datastore cap this ticket removes, or paging would have moved the ceiling
  // downward and bought nothing. It is a bound on work and not a ceiling on correctness — beyond it
  // the read REFUSES rather than truncating — but it is still a maximum, and this is where the
  // repository records that somebody chose it.
  it("AC-13: the window times the bound exceeds the cap paging replaced", () => {
    expect(TEAM_ENTRY_PAGE_SIZE * TEAM_ENTRY_MAX_PAGES).toBeGreaterThan(DATASTORE_MAX_ROWS);
  });
});
