// ADM-03 — the refusals below the interface, and the constraint a person meets. 01-plan.md
// section 7.
//
// AC-15 and AC-16 are refusals the acceptance suite CANNOT reach: it drives the browser and cannot
// call a seam function with a chosen caller. This file does, through `__setCurrentMember` — the
// test-only hook mock.ts exports beside `seam`, which `tests/threshold.test.ts` and
// `tests/seam-parity.test.ts` already use. It moves the member and not the session, so it reaches a
// state the application itself cannot; that is exactly what is wanted here, because the subject is
// the seam's answer and not a journey.
//
// AC-6 and AC-7 are here for a different reason: they are `unique (date)`, which lives in the
// datastore, and no test can meet a constraint in a project nobody has provisioned. What is asserted
// is that the MOCK refuses where the constraint refuses — because the acceptance suite drives the
// mock (BUG-001, tests/e2e/seam.setup.ts), a permissive mock would let every duplicate-date test in
// that suite pass against nothing.
//
// THE MOCK IS THE SUBJECT AND THE POLICIES ARE WHAT IT REPRODUCES. `holiday_insert_admin`,
// `holiday_update_admin`, `holiday_delete_admin` and the write grant are in
// supabase/migrations/20260905140000_adm03_holiday_writes.sql and are exercised by no test until a
// project is provisioned (RULE-09 keeps applying it human).
//
// EVERY TEST CREATES THE ROWS IT ACTS ON, and none of them edits or deletes one of the four seeded
// by `FIXTURE_HOLIDAYS`. That is not fastidiousness: the mock offers no reseed and `restore` below
// can only remove what a test added, so a test that deleted a fixture row would silently change what
// every test after it asserts against. The seeded rows are read — never written.
//
// MIR-15-e, ADR-079. `FIXTURE_ADMIN` (Quan) is placed in the DEDICATED org for every test in this
// file (`__setDedicatedOrgMembersForTest([FIXTURE_ADMIN.id])`, file-level `beforeEach`), because
// since MIR-15-b an admin of Org public is refused all three writes (AC-7 below) and every ADM-03
// test above that line was written when Quan's org did not matter. Quan-D is the same account,
// through the same test switch, 01-plan.md § 4.3. The MIR-15-e describe block at the bottom moves a
// test OUT of the dedicated org where the criterion needs Quan to be Org public's admin instead.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { seam as mock, __setCurrentMember, __setDedicatedOrgMembersForTest } from "@/lib/data/mock";
import type { Holiday } from "@/lib/domain/types";
import {
  FIXTURE_ADMIN,
  FIXTURE_HOLIDAYS,
  FIXTURE_MEMBER,
  FIXTURE_PENDING_SIGNUP,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
} from "@/lib/fixtures";

/** Wide enough to hold every fixture row and everything these tests add, so a read is never the
 *  thing that made an assertion pass. No Date is constructed anywhere in this file — ADR-015
 *  Consequences, and the same reason the product compares `yyyy-MM-dd` strings. */
const EVERYTHING = { start: "2000-01-01", end: "2099-12-31" };

/** The whole table, read back THROUGH the seam rather than out of the mock's internals — so an
 *  assertion about "unchanged" is an assertion about what a reader sees.
 *
 *  MIR-15-e. PINNED TO `FIXTURE_ADMIN` AS THE READER, and that pin is load-bearing now that a read
 *  is scoped to the caller's org: every test in this file (bar the MIR-15-e block's own AC-7, which
 *  overrides the switch for its own duration) leaves Quan mapped to the dedicated org, so this is
 *  "the dedicated org's table" consistently, whatever member a test switched to in between for a
 *  write attempt. Forcing the reader here is what keeps a `before`/`after` comparison meaningful
 *  across a test that calls `__setCurrentMember` on a non-admin partway through. */
const stored = async (): Promise<Holiday[]> => {
  __setCurrentMember(FIXTURE_ADMIN.id);
  return mock.listHolidays(EVERYTHING);
};

/** Dates in 2028, which the fixtures leave completely empty — so an add that should succeed is never
 *  refused by a constraint the test did not mean to meet. */
const FREE_DATE = "2028-04-30";
const OTHER_FREE_DATE = "2028-09-02";
const THIRD_FREE_DATE = "2028-12-25";

/** The four seeded DATES, not ids. MIR-15-e seeds a COPY of each `FIXTURE_HOLIDAYS` row into the
 *  dedicated org under a fresh id from `newHolidayId()` (01-plan.md § 4.3), so the dedicated org's
 *  seeded rows never match `FIXTURE_HOLIDAYS`' own ids — but they always carry the same four dates,
 *  which is what `restore` below needs to tell a fixture row from one a test made. */
const seededDates = new Set(FIXTURE_HOLIDAYS.map((h) => h.date));

/** Adds a row as the admin and returns it, failing the test loudly rather than returning something
 *  unusable — a setup step that failed silently would make the assertion after it meaningless. */
async function given(date: string, name: string, kind: Holiday["kind"]): Promise<Holiday> {
  __setCurrentMember(FIXTURE_ADMIN.id);
  const result = await mock.addHoliday({ date, name, kind });
  expect(result.ok, "the fixture setup for this test failed").toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

/** The mock's `holiday` table is module state and these tests write it, so every one of them starts
 *  and ends at the four seeded rows — in the dedicated org, which is the one `stored()` now reads. */
async function restore(): Promise<void> {
  __setCurrentMember(FIXTURE_ADMIN.id);
  for (const row of await stored()) {
    if (!seededDates.has(row.date)) await mock.deleteHoliday(row.id);
  }
  __setCurrentMember(null);
}

// MIR-15-e, ADR-079 decision 5, 01-plan.md § 4.6. FILE-LEVEL, so they also wrap the `MIR-15-e`
// describe block below: Quan-D for every test in this file by default. `restore` runs WHILE Quan is
// still mapped to the dedicated org in both hooks, so the cleanup it does lands on the same org the
// test's own writes did — ending the switch first in `afterEach` would leave the dedicated org's
// table dirty for the next test's own `restore`.
beforeEach(async () => {
  __setDedicatedOrgMembersForTest([FIXTURE_ADMIN.id]);
  await restore();
});
afterEach(async () => {
  await restore();
  __setDedicatedOrgMembersForTest([]);
});

describe("ADM-03 the holiday writes", () => {
  // -------------------------------------------------------------------------
  // Adding, editing and deleting as the person the policies admit.
  // -------------------------------------------------------------------------

  it("AC-1: an admin adds a holiday and it is stored", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const result = await mock.addHoliday({
      date: FREE_DATE,
      name: "Reunification Day",
      kind: "non_working",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.date).toBe(FREE_DATE);
    expect(result.value.kind).toBe("non_working");
    // Read back rather than trusted: the returned value and the stored row are two different claims,
    // and a mock that returned one without keeping the other would pass the assertion above.
    expect((await stored()).map((h) => h.date)).toContain(FREE_DATE);
  });

  it("AC-2: a mandated working Saturday is stored with the kind that says so", async () => {
    const row = await given(FREE_DATE, "Mandated working Saturday", "working");

    // The value names the EFFECT on the working calendar and not the Vietnamese label (ADR-015
    // section 2). A row stored as `non_working` here would be the exact inverse of what was asked
    // for, and CAL-08 is where it would surface.
    expect(row.kind).toBe("working");
    expect((await stored()).find((h) => h.id === row.id)?.kind).toBe("working");
  });

  it("AC-8 and AC-10: an edit replaces the row's three fields and touches no other row", async () => {
    const row = await given(FREE_DATE, "A day", "non_working");
    const before = await stored();

    const result = await mock.updateHoliday(row.id, {
      date: OTHER_FREE_DATE,
      name: "Corrected name",
      kind: "working",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.date).toBe(OTHER_FREE_DATE);
    expect(result.value.name).toBe("Corrected name");
    expect(result.value.kind).toBe("working");

    // NO SECOND ROW WAS CREATED: an update that inserted would leave the count one higher with the
    // old date still present, which is the failure a happy-path assertion on the returned value
    // alone would miss.
    const after = await stored();
    expect(after).toHaveLength(before.length);
    expect(after.map((h) => h.date)).not.toContain(FREE_DATE);

    // AC-10, field by field on every OTHER row — the four seeded ones included — so a future column
    // added to `Holiday` cannot slip through an assertion that only names the five that exist today.
    for (const other of before) {
      if (other.id === row.id) continue;
      expect(after.find((h) => h.id === other.id)).toEqual(other);
    }
  });

  it("AC-9's stored half: an edit that changes one field leaves the other two as they were", async () => {
    const row = await given(FREE_DATE, "Original name", "working");

    const result = await mock.updateHoliday(row.id, {
      date: row.date,
      name: "Corrected label only",
      kind: row.kind,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    // Saving a row onto its OWN date is an ordinary edit and not a duplicate — a row does not
    // collide with itself, which is what `unique (date)` does in the datastore and what a duplicate
    // check written without `id !== holidayId` would get wrong, making every name-only correction
    // impossible.
    expect(result.value.date).toBe(FREE_DATE);
    expect(result.value.kind).toBe("working");
    expect(result.value.name).toBe("Corrected label only");
  });

  it("AC-13: deleting removes exactly the named row and leaves the others", async () => {
    const going = await given(FREE_DATE, "Going", "non_working");
    await given(OTHER_FREE_DATE, "Staying", "working");
    const before = await stored();

    __setCurrentMember(FIXTURE_ADMIN.id);
    expect((await mock.deleteHoliday(going.id)).ok).toBe(true);

    const after = await stored();
    expect(after).toHaveLength(before.length - 1);
    expect(after.find((h) => h.id === going.id)).toBeUndefined();
    for (const other of before) {
      if (other.id === going.id) continue;
      expect(after.find((h) => h.id === other.id)).toEqual(other);
    }
  });

  // -------------------------------------------------------------------------
  // The constraint a person meets. AC-6 and AC-7.
  // -------------------------------------------------------------------------

  it("AC-6: a second row for a date already in the calendar is refused", async () => {
    await given(FREE_DATE, "The first observance", "non_working");
    const before = await stored();

    __setCurrentMember(FIXTURE_ADMIN.id);
    const result = await mock.addHoliday({
      date: FREE_DATE,
      name: "A second observance on the same day",
      kind: "non_working",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // A DEDICATED CODE and not `already_allow_listed`, which is the other `23505` this seam maps and
    // whose sentence names an email address (01-plan.md section 4.1).
    expect(result.error.code).toBe("holiday_date_taken");
    expect(result.error.message).not.toBe("");
    expect(await stored()).toEqual(before);
  });

  it("AC-6: a date already carrying a SEEDED row is refused the same way", async () => {
    // The four fixture rows are read here and not written: an admin meeting the constraint against
    // a date the seed migration inserted is the ordinary case, and it must answer the same way as a
    // date another admin added this morning.
    const seeded = FIXTURE_HOLIDAYS[0];
    if (!seeded) throw new Error("the fixture module carries no holiday rows");

    __setCurrentMember(FIXTURE_ADMIN.id);
    const result = await mock.addHoliday({
      date: seeded.date,
      name: "On top of a seeded date",
      kind: "non_working",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("holiday_date_taken");
  });

  it("AC-7: moving a row onto an occupied date is refused, and both rows are unchanged", async () => {
    const moving = await given(FREE_DATE, "The one being edited", "non_working");
    const occupant = await given(OTHER_FREE_DATE, "The one already there", "working");
    const before = await stored();

    __setCurrentMember(FIXTURE_ADMIN.id);
    const result = await mock.updateHoliday(moving.id, {
      date: occupant.date,
      name: moving.name,
      kind: moving.kind,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // THE SAME CODE AS THE ADD. It is the same constraint, and a second code would be a second thing
    // for a screen to branch on for no difference in what happened.
    expect(result.error.code).toBe("holiday_date_taken");
    // BOTH rows unchanged — the whole table read back, so this also says the refused update wrote
    // nothing partial.
    expect(await stored()).toEqual(before);
  });

  it("AC-6: the refusal is against the WHOLE table and not one year", async () => {
    // The case 01-plan.md section 8 rejected a form-side duplicate check over: a screen holds one
    // year, and a date in a year nobody is looking at is exactly as taken as one in view.
    await given(THIRD_FREE_DATE, "A year nobody is looking at", "non_working");

    __setCurrentMember(FIXTURE_ADMIN.id);
    const again = await mock.addHoliday({
      date: THIRD_FREE_DATE,
      name: "Again",
      kind: "non_working",
    });

    expect(again.ok).toBe(false);
    if (again.ok) return;
    expect(again.error.code).toBe("holiday_date_taken");
  });

  // -------------------------------------------------------------------------
  // The refusals. AC-15 and AC-16 — past every control the screen holds.
  // -------------------------------------------------------------------------

  it("AC-15: a member is refused all three writes and the calendar is unchanged", async () => {
    const row = await given(FREE_DATE, "An admin's row", "non_working");
    const before = await stored();

    // The criterion past every control the screen holds: this is the seam being called with a member
    // as the caller, which is what makes the hidden add form an affordance rather than the check.
    __setCurrentMember(FIXTURE_MEMBER.id);
    const added = await mock.addHoliday({
      date: OTHER_FREE_DATE,
      name: "Not mine to add",
      kind: "non_working",
    });
    const edited = await mock.updateHoliday(row.id, {
      date: OTHER_FREE_DATE,
      name: "Not mine to edit",
      kind: "working",
    });
    const deleted = await mock.deleteHoliday(row.id);

    for (const result of [added, edited, deleted]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("not_permitted");
      expect(result.error.message).not.toBe("");
    }
    expect(await stored()).toEqual(before);
  });

  it("AC-15: a caller with no member row is refused all three", async () => {
    const row = await given(FREE_DATE, "An admin's row", "non_working");
    const before = await stored();

    __setCurrentMember(null);
    expect(
      (await mock.addHoliday({ date: OTHER_FREE_DATE, name: "X", kind: "non_working" })).ok,
    ).toBe(false);
    expect(
      (await mock.updateHoliday(row.id, { date: OTHER_FREE_DATE, name: "X", kind: "working" })).ok,
    ).toBe(false);
    expect((await mock.deleteHoliday(row.id)).ok).toBe(false);
    expect(await stored()).toEqual(before);
  });

  it("AC-16: a removed member is refused all three", async () => {
    const row = await given(FREE_DATE, "An admin's row", "non_working");
    const before = await stored();

    __setCurrentMember(FIXTURE_REMOVED_MEMBER.id);
    expect(
      (await mock.addHoliday({ date: OTHER_FREE_DATE, name: "X", kind: "non_working" })).ok,
    ).toBe(false);
    expect(
      (await mock.updateHoliday(row.id, { date: OTHER_FREE_DATE, name: "X", kind: "working" })).ok,
    ).toBe(false);
    expect((await mock.deleteHoliday(row.id)).ok).toBe(false);
    expect(await stored()).toEqual(before);
  });

  it("hands back a copy, so a caller cannot write the mock's table through the value", async () => {
    const row = await given(FREE_DATE, "A day", "non_working");

    row.date = "1999-01-01";
    row.name = "Rewritten through the returned object";

    const readBack = (await stored()).find((h) => h.id === row.id);
    expect(readBack?.date).toBe(FREE_DATE);
    expect(readBack?.name).toBe("A day");
  });

  // LAST IN THIS DESCRIBE BLOCK, DELIBERATELY, and the ordering is load-bearing — the shape
  // tests/threshold.test.ts records for the same criterion. `removeMember` is the only way to reach
  // a caller whose row is removed AND whose role is `admin`: no such fixture exists,
  // src/lib/fixtures.ts is not in this ticket's `allowed_paths`, and the mock offers no way to undo
  // a removal, so this test leaves FIXTURE_SECOND_ADMIN removed for whatever runs after it. NOTHING
  // IN THIS FILE DEPENDS ON FIXTURE_SECOND_ADMIN'S ROLE OR REMOVAL STATE — the MIR-15-e describe
  // block below this one runs after it in file order but never names this fixture.
  //
  // It is the criterion `is_admin` answers rather than the three policies: the function filters
  // `removed_at is null` in its own body, so a caller whose `role` column still says `admin` is
  // refused by all three without any of them repeating the predicate.
  it("AC-16: a removed caller is refused WHATEVER role their row records", async () => {
    const row = await given(FREE_DATE, "An admin's row", "non_working");

    __setCurrentMember(FIXTURE_ADMIN.id);
    const removal = await mock.removeMember(FIXTURE_SECOND_ADMIN.id);
    expect(removal.ok, "the fixture setup for this test failed").toBe(true);
    if (!removal.ok) return;
    expect(removal.value.role).toBe("admin");
    expect(removal.value.removedAt).not.toBeNull();

    const before = await stored();
    __setCurrentMember(FIXTURE_SECOND_ADMIN.id);

    const added = await mock.addHoliday({
      date: OTHER_FREE_DATE,
      name: "X",
      kind: "non_working",
    });
    expect(added.ok).toBe(false);
    if (!added.ok) expect(added.error.code).toBe("not_permitted");

    expect(
      (await mock.updateHoliday(row.id, { date: OTHER_FREE_DATE, name: "X", kind: "working" })).ok,
    ).toBe(false);
    expect((await mock.deleteHoliday(row.id)).ok).toBe(false);
    expect(await stored()).toEqual(before);
  });
});

// ---------------------------------------------------------------------------
// MIR-15-e, ADR-079 decision 5. 01-plan.md §§ 2, 4.3. One `it` per AC-7 to AC-12 — the mock-level
// criteria; the numbers coincide with some of ADM-03's own above by accident of two tickets each
// starting their own count, and the two namespaces are never mixed in one assertion.
//
// THE FILE-LEVEL `beforeEach`/`afterEach` ABOVE STILL APPLY: Quan-D by default, and `restore()`
// between every test. AC-7 below overrides the org switch for its own duration, back to the
// default by `afterEach` regardless of how the test ends.
// ---------------------------------------------------------------------------

describe("MIR-15-e — the member seam follows Org public's holiday policies", () => {
  it("AC-7: the mock refuses an Org public admin all three writes, and Org public's rows are unchanged", async () => {
    __setDedicatedOrgMembersForTest([]); // Quan, Org public's admin, for this test only
    const before = await stored(); // Org public's own four rows, through the pinned reader

    const seeded = FIXTURE_HOLIDAYS[0];
    if (!seeded) throw new Error("the fixture module carries no holiday rows");

    __setCurrentMember(FIXTURE_ADMIN.id);
    const added = await mock.addHoliday({
      date: FREE_DATE,
      name: "Not Quan's to add",
      kind: "non_working",
    });
    const edited = await mock.updateHoliday(seeded.id, {
      date: seeded.date,
      name: "Not Quan's to edit",
      kind: seeded.kind,
    });
    const deleted = await mock.deleteHoliday(seeded.id);

    for (const result of [added, edited, deleted]) {
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("not_permitted");
      expect(result.error.message).not.toBe("");
    }
    expect(await stored()).toEqual(before);
  });

  it("AC-8: the mock lets a dedicated org's admin write that org's rows, and only them", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id); // Thanh, Org public — reads "before" Quan-D writes anything
    const orgPublicBefore = await mock.listHolidays(EVERYTHING);

    __setCurrentMember(FIXTURE_ADMIN.id); // Quan-D, the file-level default
    const added = await mock.addHoliday({
      date: FREE_DATE,
      name: "The dedicated org's own day",
      kind: "non_working",
    });
    expect(added.ok).toBe(true);
    if (!added.ok) return;

    const edited = await mock.updateHoliday(added.value.id, {
      date: OTHER_FREE_DATE,
      name: "Edited",
      kind: "working",
    });
    expect(edited.ok).toBe(true);
    if (!edited.ok) return;

    const deleted = await mock.deleteHoliday(edited.value.id);
    expect(deleted.ok).toBe(true);

    __setCurrentMember(FIXTURE_MEMBER.id);
    expect(await mock.listHolidays(EVERYTHING)).toEqual(orgPublicBefore);

    // The other half of AC-8: naming an Org public row's id from the dedicated org gets the same
    // refusal a missing row would, rather than a lookup that finds it.
    const orgPublicRow = FIXTURE_HOLIDAYS[0];
    if (!orgPublicRow) throw new Error("the fixture module carries no holiday rows");

    __setCurrentMember(FIXTURE_ADMIN.id);
    const crossUpdate = await mock.updateHoliday(orgPublicRow.id, {
      date: orgPublicRow.date,
      name: "Reached from the wrong org",
      kind: orgPublicRow.kind,
    });
    expect(crossUpdate.ok).toBe(false);
    if (!crossUpdate.ok) expect(crossUpdate.error.code).toBe("not_permitted");

    const crossDelete = await mock.deleteHoliday(orgPublicRow.id);
    expect(crossDelete.ok).toBe(false);
    if (!crossDelete.ok) expect(crossDelete.error.code).toBe("not_permitted");

    __setCurrentMember(FIXTURE_MEMBER.id);
    expect(await mock.listHolidays(EVERYTHING)).toEqual(orgPublicBefore);
  });

  it("AC-9: the mock's date uniqueness is per org", async () => {
    const seeded = FIXTURE_HOLIDAYS[0];
    if (!seeded) throw new Error("the fixture module carries no holiday rows");

    // Org public has `seeded`, and the dedicated org holds its own copy of the same date (01-plan.md
    // § 4.3) — a second row on it for Quan-D collides with THAT copy, not with Org public's.
    __setCurrentMember(FIXTURE_ADMIN.id); // Quan-D, the file-level default
    const collision = await mock.addHoliday({
      date: seeded.date,
      name: "A second row on the dedicated org's own copy of that date",
      kind: seeded.kind,
    });
    expect(collision.ok).toBe(false);
    if (!collision.ok) expect(collision.error.code).toBe("holiday_date_taken");

    // A date NEITHER org holds succeeds, and Org public still has none on it.
    const added = await mock.addHoliday({
      date: FREE_DATE,
      name: "A date neither org holds",
      kind: "non_working",
    });
    expect(added.ok).toBe(true);

    __setCurrentMember(FIXTURE_MEMBER.id); // Thanh, Org public
    const orgPublicRows = await mock.listHolidays(EVERYTHING);
    expect(orgPublicRows.map((h) => h.date)).not.toContain(FREE_DATE);
  });

  it("AC-10: the mock reads each caller only their own org's rows", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id); // Quan-D, the file-level default
    const added = await mock.addHoliday({
      date: FREE_DATE,
      name: "The dedicated org's own day",
      kind: "non_working",
    });
    expect(added.ok).toBe(true);

    const year2028 = { start: "2028-01-01", end: "2028-12-31" };

    const quanDs = await mock.listHolidays(year2028);
    expect(quanDs.map((h) => h.date)).toContain(FREE_DATE);

    __setCurrentMember(FIXTURE_MEMBER.id); // Thanh, Org public
    const thanhs = await mock.listHolidays(year2028);
    expect(thanhs.map((h) => h.date)).not.toContain(FREE_DATE);
  });

  it("AC-11: the mock reads a caller with no org nothing", async () => {
    const year2026 = { start: "2026-01-01", end: "2026-12-31" };

    __setCurrentMember(null);
    expect(await mock.listHolidays(year2026)).toEqual([]);

    __setCurrentMember(FIXTURE_PENDING_SIGNUP.id);
    expect(await mock.listHolidays(year2026)).toEqual([]);

    __setCurrentMember(FIXTURE_REMOVED_MEMBER.id);
    expect(await mock.listHolidays(year2026)).toEqual([]);
  });

  it("AC-12: the seam answers whether the caller's org is shared", async () => {
    __setDedicatedOrgMembersForTest([]); // Quan, Org public's admin
    __setCurrentMember(FIXTURE_ADMIN.id);
    expect(await mock.isOwnOrgShared()).toBe(true);

    __setDedicatedOrgMembersForTest([FIXTURE_ADMIN.id]); // Quan-D
    expect(await mock.isOwnOrgShared()).toBe(false);

    __setCurrentMember(null);
    expect(await mock.isOwnOrgShared()).toBe(false);
  });
});
