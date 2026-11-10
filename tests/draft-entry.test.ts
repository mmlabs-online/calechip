// CAL-07 — the prospective count, at the level the standard assigns it.
//
// `.ai/standards/testing-standards.md` puts "pure logic" at the unit level and "a full acceptance
// criterion through the interface" at the end-to-end one. `withDraft` is pure and so is everything
// it feeds, so AC-4, AC-5, AC-8, AC-17 and AC-18 are asserted here against the real
// `absenceCountsFor` and `absentEntriesFor`, and what a person SEES is in
// tests/e2e/cal-07-overload-warning.spec.ts.
//
// **EVERY ASSERTION COMPOSES `withDraft` WITH absence.ts RATHER THAN INSPECTING THE ARRAY IT
// RETURNS**, which is 01-plan.md section 7's instruction and the point of the module: the array is a
// means and the count is the criterion. A test that asserted the row shape would pass against a
// draft that `absenceCountsFor` then ignored.
//
// **The entries below are constructed here rather than imported, and that is the same declared
// deviation from § Fixtures that tests/absence.test.ts carries** (03-impl-log.md). They are the
// ARGUMENTS of a pure function, not entities: the shapes these criteria distinguish do not exist in
// supabase/seed.sql and cannot be added to it, because seed.sql is not in this ticket's
// `allowed_paths`. Every MEMBER is imported, because members are entities and the attribution
// criteria turn on a real member id.
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { absenceCountsFor, absentEntriesFor, currentMemberCount, isOverloaded } from "@/lib/data/absence";
import { DRAFT_ENTRY_ID, isUsableRange, withDraft } from "@/lib/draft-entry";
import type { DraftEntryInput } from "@/lib/draft-entry";
import {
  FIXTURE_ADMIN,
  FIXTURE_APPROVED_ENTRY,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_MEMBER,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
  FIXTURE_TEAM,
} from "@/lib/fixtures";
import type { DateRange, Entry, Member } from "@/lib/domain/types";

/** The roster as `listMembers` returns it: REMOVED MEMBERS INCLUDED, because ADR-013 needs
 *  `removedAt` per member to decide each date. FOUR of these five are current, so at
 *  `FIXTURE_TEAM.overloadThreshold` of 0.5 a day is crowded strictly above 2.0. */
const ROSTER: readonly Member[] = [
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_SECOND_ADMIN,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_REMOVED_MEMBER,
];

const ACTIVE = currentMemberCount(ROSTER);

/** September 2026, the month the fixture entries already live in. */
const WEEK: DateRange = { start: "2026-09-14", end: "2026-09-18" };

let serial = 0;
/** One saved entry, spread from the seeded row so the shape stays the seed's. */
const entry = (fields: Partial<Entry>): Entry => ({
  ...FIXTURE_APPROVED_ENTRY,
  id: `ee000000-0000-4000-8000-${String(++serial).padStart(12, "0")}`,
  status: "pending",
  approvedBy: null,
  approvedAt: null,
  ...fields,
});

/** One draft, defaulting to a full PTO day owned by FIXTURE_MEMBER. */
const draft = (fields: Partial<DraftEntryInput>): DraftEntryInput => ({
  memberId: FIXTURE_MEMBER.id,
  type: "pto",
  portion: "full",
  startDate: "2026-09-14",
  endDate: "2026-09-14",
  tentative: false,
  ...fields,
});

/** The whole composition the component performs, in one call: the prospective count of one date. */
const prospective = (
  saved: readonly Entry[],
  input: DraftEntryInput,
  excludeEntryId: string | null,
  date: string,
): number =>
  absenceCountsFor(withDraft(saved, input, excludeEntryId), WEEK, ROSTER).get(date) ?? 0;

/** Who the warning would name on a date, in the order it would draw them. */
const namedOn = (
  saved: readonly Entry[],
  input: DraftEntryInput,
  excludeEntryId: string | null,
  date: string,
): readonly string[] =>
  (absentEntriesFor(withDraft(saved, input, excludeEntryId), WEEK, ROSTER).get(date) ?? []).map(
    (detail) => detail.member.id,
  );

describe("the draft is a row, and the count is absence.ts's", () => {
  it("appends exactly one row and leaves the input untouched", () => {
    const saved = [entry({ memberId: FIXTURE_ADMIN.id, startDate: "2026-09-14", endDate: "2026-09-14" })];
    const before = saved.length;

    const rows = withDraft(saved, draft({}), null);

    expect(rows).toHaveLength(before + 1);
    expect(saved).toHaveLength(before);
    // A component holds `saved` in state and passes it here on every keystroke, so a mutation would
    // accumulate a draft per render.
    expect(rows.slice(0, before)).toEqual(saved);
  });

  it("gives the draft an id nothing can mistake for a real one, and no decision", () => {
    const row = withDraft([], draft({}), null).at(-1);

    expect(row?.id).toBe(DRAFT_ENTRY_ID);
    // 01-plan.md section 4.1 and Open question 3: the draft is `pending` on every path, and it
    // carries no approval, no rejection reason and no fabricated timestamp.
    expect(row?.status).toBe("pending");
    expect(row?.approvedBy).toBeNull();
    expect(row?.approvedAt).toBeNull();
    expect(row?.rejectionReason).toBeNull();
    expect(row?.note).toBeNull();
    expect(row?.createdAt).toBe("");
    expect(row?.updatedAt).toBe("");
  });
});

describe("AC-4 — a half-day draft weighs half a day", () => {
  // The date already carries 2.0 of 4, which is EXACTLY the threshold and not above it.
  const saved = [
    entry({ memberId: FIXTURE_ADMIN.id, startDate: "2026-09-14", endDate: "2026-09-14" }),
    entry({ memberId: FIXTURE_SECOND_ADMIN.id, startDate: "2026-09-14", endDate: "2026-09-14" }),
  ];

  it("takes a day at 2.0 to 2.5 as a morning and to 3 as a full day, and both are crowded", () => {
    expect(prospective(saved, draft({ portion: "am" }), null, "2026-09-14")).toBe(2.5);
    expect(prospective(saved, draft({ portion: "full" }), null, "2026-09-14")).toBe(3);

    for (const count of [2.5, 3]) {
      expect(isOverloaded(count, ACTIVE, FIXTURE_TEAM.overloadThreshold)).toBe(true);
    }
  });

  it("weighs a `pm` exactly as a `am`, because the count answers how much of the team is away", () => {
    expect(prospective(saved, draft({ portion: "pm" }), null, "2026-09-14")).toBe(2.5);
  });

  // AC-3's arithmetic half. The comparison is STRICTLY greater, so a draft that takes a day to
  // exactly the threshold raises nothing — and this is the boundary the fixture team makes reachable.
  it("AC-3: a draft that lands the day on exactly 2.0 of 4 is NOT crowded", () => {
    const one = [entry({ memberId: FIXTURE_ADMIN.id, startDate: "2026-09-14", endDate: "2026-09-14" })];

    expect(prospective(one, draft({}), null, "2026-09-14")).toBe(2);
    expect(isOverloaded(2, ACTIVE, FIXTURE_TEAM.overloadThreshold)).toBe(false);
  });
});

describe("AC-5 — the portion applies to every date in the range", () => {
  // The failure this is written against is the one 01-plan.md section 8 rejects by name: a component
  // computing `current + weight(portion)` adds 0.5 ONCE for a five-day morning draft. INV-06 says it
  // is 0.5 on each of the five, and `absenceCountsFor` is where that is decided.
  it("puts 0.5 on each of three days for a three-day morning draft, not 0.5 across the range", () => {
    const input = draft({ portion: "am", startDate: "2026-09-14", endDate: "2026-09-16" });
    const counts = absenceCountsFor(withDraft([], input, null), WEEK, ROSTER);

    expect(counts.get("2026-09-14")).toBe(0.5);
    expect(counts.get("2026-09-15")).toBe(0.5);
    expect(counts.get("2026-09-16")).toBe(0.5);
    // And nothing outside it.
    expect(counts.get("2026-09-17")).toBe(0);
  });
});

describe("AC-8 — a tentative draft counts toward its own warning", () => {
  const saved = [
    entry({ memberId: FIXTURE_ADMIN.id, startDate: "2026-09-14", endDate: "2026-09-14" }),
    entry({ memberId: FIXTURE_SECOND_ADMIN.id, startDate: "2026-09-14", endDate: "2026-09-14" }),
  ];

  // INV-05. A warning that discounted a tentative draft would defeat the reason tentative exists:
  // it is the flag for the days a person is LEAST sure about, which are exactly the days worth
  // warning them about.
  it("reports the same number ticked as unticked", () => {
    const settled = prospective(saved, draft({ tentative: false }), null, "2026-09-14");
    const unsure = prospective(saved, draft({ tentative: true }), null, "2026-09-14");

    expect(unsure).toBe(settled);
    expect(unsure).toBe(3);
  });

  it("carries the flag through so the warning can draw it, without letting it change the count", () => {
    expect(withDraft([], draft({ tentative: true }), null).at(-1)?.tentative).toBe(true);
  });
});

describe("AC-17 — an edit does not count the entry twice", () => {
  const mine = entry({
    memberId: FIXTURE_MEMBER.id,
    startDate: "2026-09-14",
    endDate: "2026-09-14",
  });
  const saved = [
    mine,
    entry({ memberId: FIXTURE_ADMIN.id, startDate: "2026-09-14", endDate: "2026-09-14" }),
    entry({ memberId: FIXTURE_SECOND_ADMIN.id, startDate: "2026-09-14", endDate: "2026-09-14" }),
  ];

  it("reports the count the day already has when the dates are left alone", () => {
    const unchanged = draft({ startDate: mine.startDate, endDate: mine.endDate });

    expect(prospective(saved, unchanged, mine.id, "2026-09-14")).toBe(3);
  });

  it("counts the owner ONCE, and the exclusion is what does it", () => {
    const unchanged = draft({ startDate: mine.startDate, endDate: mine.endDate });

    // The same call without the exclusion is the defect: the fetched rows contain the row being
    // edited, so the draft lands beside it and its owner is counted twice.
    expect(prospective(saved, unchanged, null, "2026-09-14")).toBe(4);
    expect(namedOn(saved, unchanged, mine.id, "2026-09-14").filter((id) => id === FIXTURE_MEMBER.id)).toHaveLength(1);
  });

  it("frees the day the entry is moved off, and charges the day it is moved onto", () => {
    const moved = draft({ startDate: "2026-09-17", endDate: "2026-09-17" });

    expect(prospective(saved, moved, mine.id, "2026-09-14")).toBe(2);
    expect(prospective(saved, moved, mine.id, "2026-09-17")).toBe(1);
  });
});

describe("AC-18 — the draft is attributed to the entry's owner, not to the caller", () => {
  // An ADMIN editing another member's entry. The admin has no entry of their own on the date, and
  // the person the warning names for the draft must be the entry's owner (INV-07).
  const theirs = entry({
    memberId: FIXTURE_APPROVED_MEMBER.id,
    startDate: "2026-09-18",
    endDate: "2026-09-18",
  });
  const saved = [
    theirs,
    entry({ memberId: FIXTURE_MEMBER.id, startDate: "2026-09-14", endDate: "2026-09-14" }),
    entry({ memberId: FIXTURE_SECOND_ADMIN.id, startDate: "2026-09-14", endDate: "2026-09-14" }),
  ];

  it("names the owner and never the admin doing the editing", () => {
    const moved = draft({
      memberId: FIXTURE_APPROVED_MEMBER.id,
      startDate: "2026-09-14",
      endDate: "2026-09-14",
    });

    const named = namedOn(saved, moved, theirs.id, "2026-09-14");

    expect(named).toContain(FIXTURE_APPROVED_MEMBER.id);
    expect(named).not.toContain(FIXTURE_ADMIN.id);
    expect(prospective(saved, moved, theirs.id, "2026-09-14")).toBe(3);
  });

  it("counts the draft for nobody when its owner is not on the roster", () => {
    // Not defensive padding: it is the honest consequence of INV-04's membership clause, and it is
    // asserted because the failure is SILENT — a draft attributed to nobody simply vanishes from the
    // count, and the warning would be wrong with nothing on screen saying so.
    const orphan = draft({ memberId: "00000000-0000-4000-8000-000000000000" });

    expect(prospective([], orphan, null, "2026-09-14")).toBe(0);
  });
});

describe("AC-20 — an incomplete or inverted range is not a range", () => {
  // The one place the emptiness test lives, so the component and this file agree by construction.
  it("accepts a filled range, including a single day", () => {
    expect(isUsableRange("2026-09-14", "2026-09-18")).toBe(true);
    expect(isUsableRange("2026-09-14", "2026-09-14")).toBe(true);
  });

  it("refuses a half-filled one and an inverted one", () => {
    expect(isUsableRange("", "2026-09-18")).toBe(false);
    expect(isUsableRange("2026-09-14", "")).toBe(false);
    expect(isUsableRange("", "")).toBe(false);
    expect(isUsableRange("2026-09-18", "2026-09-14")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AC-14. Charter refusal 6, asserted against the migrations this product ships.
//
// It is HERE and not in a test of its own because tests/draft-entry.test.ts is the only unit path in
// this ticket's `allowed_paths` (03-impl-log.md records the placement). It reads the real files
// rather than a fixture, which is what § Fixtures that share the implementation's assumptions
// requires of a check whose target is a specific real file — and the positive control below is the
// other half of that rule.
//
// Why it is a criterion and not an assumption: every other invariant in this product is held in the
// database, and a developer following the house pattern would put this one there too, where it would
// be a real refusal. CAL-01 already ships both mechanisms that could — `entry_enforce_decision()`
// and `entry_no_overlapping_portion` — so the assertion is about their CONTENT.
// ---------------------------------------------------------------------------

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const MIGRATIONS = "supabase/migrations/";

/** Anything that can REFUSE a write. Under ADR-005 there are exactly three: a policy's `with check`,
 *  a `CHECK` constraint, and a `BEFORE INSERT/UPDATE` trigger. */
const CAN_REFUSE_A_WRITE = /create\s+(or\s+replace\s+)?policy|create\s+(or\s+replace\s+)?trigger|before\s+(insert|update)|check\s*\(/i;

/** Statements, with `--` comment lines removed first: the migrations DISCUSS the threshold in prose
 *  at length, and a scanner that read those would fire on every explanation of why the threshold is
 *  not in the database. */
const statementsOf = (sql: string): string[] =>
  sql
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .split(";");

/** MIR-09, ADR-069: `team_overload_threshold_range` checks the column's own [0, 1] bounds on
 *  `public.team`; it does not consult the threshold to gate an entry or plan write (refusal 6). */
const IS_OWN_COLUMN_RANGE_CHECK =
  /^\s*alter\s+table\s+public\.team\s+add\s+constraint\s+team_overload_threshold_range\s+check\s*\(\s*overload_threshold\s*>=\s*0\s+and\s+overload_threshold\s*<=\s*1\s*\)\s*$/i;

const mentioningThreshold = (sql: string): string[] =>
  statementsOf(sql).filter(
    (statement) =>
      statement.includes("overload_threshold") && !IS_OWN_COLUMN_RANGE_CHECK.test(statement),
  );

const migrations = readdirSync(repoRoot + MIGRATIONS).filter((name) => name.endsWith(".sql"));

describe("AC-14 — nothing in the datastore consults the threshold", () => {
  it("finds migrations to read", () => {
    // A scanner that read no file would pass everywhere, which is how this check fails silently.
    expect(migrations.length).toBeGreaterThan(0);
    expect(migrations.some((name) => mentioningThreshold(readFileSync(repoRoot + MIGRATIONS + name, "utf8")).length > 0)).toBe(true);
  });

  it.each(migrations)("%s: no policy, CHECK or BEFORE trigger refers to overload_threshold", (name) => {
    for (const statement of mentioningThreshold(readFileSync(repoRoot + MIGRATIONS + name, "utf8"))) {
      expect(CAN_REFUSE_A_WRITE.test(statement), statement.trim()).toBe(false);
    }
  });

  it("fires when a real migration's policy is made to consult the threshold", () => {
    // The positive control § Fixtures that share the implementation's assumptions requires: the
    // triggering content is injected into a copy of a REAL file, so the test cannot pass by reading
    // nothing or by misunderstanding the shape of what it reads.
    const real = readFileSync(repoRoot + MIGRATIONS + "20260903103000_cal01_entry.sql", "utf8");
    const breached = real.replace(
      "using (",
      "using ((select overload_threshold from public.team limit 1) > 0 and ",
    );

    expect(breached).not.toBe(real);
    expect(mentioningThreshold(breached).some((statement) => CAN_REFUSE_A_WRITE.test(statement))).toBe(true);
  });

  it("adds no migration of its own", () => {
    // `schema_delta: none`, and `supabase/**` is absent from `allowed_paths` entirely.
    //
    // The FILE NAMES and nothing else. A migration that MENTIONS CAL-07 in prose is not this ticket
    // shipping one — 20260903103000_cal01_entry.sql already names it, and CAL-04 and ADM-02 beside
    // it, in the list of what that file deliberately leaves out. What stops a migration being
    // written here is `guard-allowed-paths.mjs` and `scripts/check-allowed-paths.mjs`, and this line
    // is the assertion a reader can make from the tree alone.
    expect(migrations.filter((name) => name.toLowerCase().includes("cal07"))).toEqual([]);
  });
});
