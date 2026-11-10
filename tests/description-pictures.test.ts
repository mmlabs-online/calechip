// EVT-11 — pictures in an event's description: the cap at the seam, the list reads that stop
// carrying the description, and the migration that holds the cap. 01-plan.md § 4.8.
//
// **VITEST RUNS IN `node`, WITH NO DOM**, as `tests/description-html.test.ts` records. The downscale,
// the picker and the render are asserted in a real browser by
// `tests/e2e/evt-11-description-pictures.spec.ts`. This file asserts what is data, a seam answer or
// a file: AC-6 and AC-8 through the mock, the real seam's ordering by reading its source (it is not
// reachable without a database), and AC-9 against the migration's text.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import type { SaveEventInput } from "@/lib/data";
import { seam as mock, __resetEvents, __setCurrentMember } from "@/lib/data/mock";
import { DESCRIPTION_MAX_BYTES, descriptionBytes } from "@/lib/domain/types";
import { FIXTURE_ADMIN, FIXTURE_MEMBER, FIXTURE_OTHER_TEAM } from "@/lib/fixtures";

const read = (relative: string): string =>
  readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), "utf8");

const SUPABASE = read("src/lib/data/supabase.ts");
const MIGRATION = read("supabase/migrations/20261013090000_evt11_description_bounded.sql");
const MIGRATION_SQL = MIGRATION.replace(/--[^\n]*/g, "");

const TOO_LARGE = "The description is larger than 1 MB. Remove a picture to save.";

const input = (overrides: Partial<SaveEventInput> = {}): SaveEventInput => ({
  name: "Venue walk",
  description: null,
  location: null,
  startDate: "2099-03-10",
  endDate: "2099-03-10",
  scope: "public",
  inviteeIds: [],
  ...overrides,
});

/** `<p>` around `n` bytes of ASCII, so the whole is exactly `n + 7` bytes. */
const html = (n: number): string => `<p>${"a".repeat(n)}</p>`;
const AT_CAP = html(DESCRIPTION_MAX_BYTES - 7);
const OVER_CAP = html(DESCRIPTION_MAX_BYTES - 6);
const PICTURE = '<p>Map</p><img src="data:image/webp;base64,UklGRhYAAABXRUJQ" alt="">';

afterEach(() => {
  __resetEvents();
  __setCurrentMember(null);
});

describe("EVT-11 — descriptionBytes counts as octet_length does", () => {
  it("null is 0, ASCII is one byte a character", () => {
    expect(descriptionBytes(null)).toBe(0);
    expect(descriptionBytes("")).toBe(0);
    expect(descriptionBytes("<p>abc</p>")).toBe(10);
  });

  it("counts multi-byte characters as UTF-8 bytes, not UTF-16 units", () => {
    // "ệ" is three bytes, "😀" four (two UTF-16 units).
    expect(descriptionBytes("Tiệc")).toBe(6);
    expect(descriptionBytes("😀")).toBe(4);
    expect(AT_CAP.length).toBe(DESCRIPTION_MAX_BYTES);
    expect(descriptionBytes(AT_CAP)).toBe(DESCRIPTION_MAX_BYTES);
  });
});

describe("EVT-11 AC-6 — the seam refuses a description over the cap", () => {
  it("AC-6: createEvent refuses one byte over, and writes nothing", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const before = (await mock.listEvents()).length;
    const result = await mock.createEvent(input({ description: OVER_CAP }));
    expect(result).toEqual({ ok: false, error: { code: "description_too_large", message: TOO_LARGE } });
    expect((await mock.listEvents()).length).toBe(before);
  });

  it("AC-6: counted in UTF-8 — a description under the cap in characters but over it in bytes is refused", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    // 349526 three-byte characters: under 1 MiB characters, over 1 MiB bytes.
    const vietnamese = `<p>${"ệ".repeat(349526)}</p>`;
    expect(vietnamese.length).toBeLessThan(DESCRIPTION_MAX_BYTES);
    const result = await mock.createEvent(input({ description: vietnamese }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("description_too_large");
  });

  it("AC-6: exactly at the cap is accepted, and blank-to-null runs first", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const atCap = await mock.createEvent(input({ description: AT_CAP }));
    expect(atCap.ok).toBe(true);
    // Surrounding whitespace is trimmed before measuring, as it is before storing.
    const padded = await mock.createEvent(input({ description: `   ${AT_CAP}   ` }));
    expect(padded.ok).toBe(true);
  });

  it("AC-6: updateEvent refuses one byte over, and the stored description is unchanged", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const created = await mock.createEvent(input({ description: PICTURE }));
    if (!created.ok) throw new Error(created.error.code);
    const result = await mock.updateEvent(created.value.id, input({ description: OVER_CAP }));
    expect(result).toEqual({ ok: false, error: { code: "description_too_large", message: TOO_LARGE } });
    expect((await mock.getEvent(created.value.id))?.description).toBe(PICTURE);
  });

  it("AC-6: the real seam checks the cap before the round trip, and after the other four refusals", () => {
    const fn = SUPABASE.slice(SUPABASE.indexOf("function eventInputFailure("));
    const body = fn.slice(0, fn.indexOf("\n}\n"));
    const cap = body.indexOf("descriptionBytes(blankToNull(input.description)) > DESCRIPTION_MAX_BYTES");
    expect(cap).toBeGreaterThan(body.indexOf('"invalid_event_deadline"'));
    expect(body.slice(cap)).toContain('code: "description_too_large", message: DESCRIPTION_TOO_LARGE');
    expect(SUPABASE).toContain(`const DESCRIPTION_TOO_LARGE = "${TOO_LARGE}";`);
  });

  it("AC-6: the real seam maps 23514 for an oversized input to description_too_large, before the deadline branch", () => {
    const fn = SUPABASE.slice(SUPABASE.indexOf("function toEventFailure("));
    const check = fn.slice(fn.indexOf('case "23514":'), fn.indexOf('case "EV003":'));
    const cap = check.indexOf("descriptionBytes(blankToNull(input.description)) > DESCRIPTION_MAX_BYTES");
    const deadline = check.indexOf("input.registrationDeadline != null");
    expect(cap).toBeGreaterThan(-1);
    expect(deadline).toBeGreaterThan(cap);
    expect(check.slice(cap, deadline)).toContain('code: "description_too_large"');
  });
});

describe("EVT-11 AC-8 — lists and grids no longer carry the description", () => {
  it("AC-8: listEvents and listEventsForTeam return description null; getEvent returns it whole", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const created = await mock.createEvent(input({ description: PICTURE }));
    if (!created.ok) throw new Error(created.error.code);
    const id = created.value.id;

    const own = (await mock.listEvents()).find((e) => e.id === id);
    expect(own).toBeDefined();
    expect(own!.description).toBeNull();

    // An admin viewing another team: the public event is still drawn, still without its description.
    __setCurrentMember(FIXTURE_ADMIN.id);
    const other = (await mock.listEventsForTeam(FIXTURE_OTHER_TEAM.id)).find((e) => e.id === id);
    expect(other).toBeDefined();
    expect(other!.description).toBeNull();

    expect((await mock.getEvent(id))?.description).toBe(PICTURE);
    // The list read handed out a copy: the stored row still has its description.
    __setCurrentMember(FIXTURE_MEMBER.id);
    expect((await mock.getEvent(id))?.description).toBe(PICTURE);
  });

  it("AC-8: the real seam's list columns omit description, and both list reads select them", () => {
    const start = SUPABASE.indexOf("const EVENT_LIST_COLUMNS =");
    const columns = SUPABASE.slice(start, SUPABASE.indexOf(";", start));
    expect(columns).not.toContain("description");
    for (const column of ["id", "creator_id", "team_id", "name", "location", "start_date", "end_date", "scope", "capacity", "requires_approval", "registration_deadline", "created_at", "updated_at"]) {
      expect(columns).toContain(column);
    }

    const method = (name: string): string => {
      const from = SUPABASE.indexOf(`  async ${name}(`);
      return SUPABASE.slice(from, SUPABASE.indexOf("\n  },\n", from));
    };
    expect(method("listEvents")).toContain(".select(EVENT_LIST_COLUMNS)");
    expect(method("listEventsForTeam")).toContain(".select(`${EVENT_LIST_COLUMNS}, event_invitee(member_id)`)");
    expect(method("getEvent")).toContain(".select(EVENT_COLUMNS)");
    expect(SUPABASE).toContain("description: row.description ?? null,");
  });
});

describe("EVT-11 AC-9 — the database holds the cap", () => {
  it("AC-9: adds event_description_bounded on public.event as the plan states it", () => {
    const sql = MIGRATION_SQL.replace(/\s+/g, " ");
    expect(sql).toContain(
      "alter table public.event add constraint event_description_bounded " +
        "check (description is null or octet_length(description) <= 1048576);",
    );
    expect(1048576).toBe(DESCRIPTION_MAX_BYTES);
  });

  it("AC-9: idempotently — a second application is a no-op, not an error", () => {
    const sql = MIGRATION_SQL.replace(/\s+/g, " ");
    expect(sql).toContain("do $$ begin");
    expect(sql).toContain("exception when duplicate_object then null; end $$;");
  });

  it("AC-9: touches no trigger, grant, policy or function", () => {
    for (const word of ["trigger", "grant", "policy", "function", "update public.event"]) {
      expect(MIGRATION_SQL.toLowerCase(), word).not.toContain(word);
    }
  });
});
