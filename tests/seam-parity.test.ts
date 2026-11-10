// One of the two mandatory unit tests named in .ai/standards/testing-standards.md.
//
// It imports every implementation of the data-access seam and asserts identical exported key sets
// and equal arity per export. That is what makes swapping the mock for the real one a configuration
// change rather than a rewrite.
//
// Parity is necessary and NOT sufficient: matching names and arity does not prove matching return
// shapes, and a mock returning a field the real implementation cannot produce passes this and breaks
// at runtime. Where a shape is subtle, assert it separately.

import { afterEach, describe, expect, it } from "vitest";
import { seam as mock, __setCurrentMember } from "@/lib/data/mock";
import { seam as real } from "@/lib/data/supabase";
import {
  FIXTURE_APPROVED_ENTRY,
  FIXTURE_APPROVED_MEMBER,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_ENTRY,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

type AnySeam = Record<string, unknown>;

const implementations: Array<[string, AnySeam]> = [
  ["mock", mock as unknown as AnySeam],
  ["supabase", real as unknown as AnySeam],
];

const [reference, ...others] = implementations;
if (!reference) throw new Error("no seam implementations registered");
const [referenceName, referenceImpl] = reference;

describe("data-access seam parity", () => {
  it("every implementation exports the same names", () => {
    const expected = Object.keys(referenceImpl).sort();
    expect(expected.length, "the seam exports nothing, so parity proves nothing").toBeGreaterThan(0);

    for (const [name, impl] of others) {
      expect(Object.keys(impl).sort(), `${name} does not match ${referenceName}`).toEqual(expected);
    }
  });

  it("every shared export has the same arity", () => {
    for (const key of Object.keys(referenceImpl)) {
      const a = referenceImpl[key];
      if (typeof a !== "function") continue;
      for (const [name, impl] of others) {
        const b = impl[key];
        expect(typeof b, `${name}.${key} is not a function while ${referenceName}.${key} is`).toBe(
          "function",
        );
        expect((b as (...args: unknown[]) => unknown).length, `${name}.${key} arity`).toBe(a.length);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// CAL-04. The shapes parity cannot see.
//
// The header above says it: matching names and arity does not prove matching return shapes, and
// "where a shape is subtle, assert it". Two of this ticket's are, and both are subtle in the
// direction that PASSES every other test in the repository while being wrong.
//
// These drive the MOCK, through `__setCurrentMember` — the test-only hook mock.ts already exports
// beside `seam`, which parity does not see because parity compares the keys of `seam`. It moves the
// member and not the session, so it reaches a state the application itself cannot; that is exactly
// what is wanted here, because the subject is the seam's answer and not a journey. The real
// implementation's equivalents are `team_select_own` and `date_range=ov.…`, exercised by no test
// until a project is provisioned — 01-plan.md Open questions.
// ---------------------------------------------------------------------------

describe("CAL-04 getTeam", () => {
  afterEach(() => __setCurrentMember(null));

  it("AC-7: answers the caller's own team, carrying the threshold", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const team = await mock.getTeam();
    expect(team).toEqual(FIXTURE_TEAM);
  });

  it("AC-12: never answers another team's row, even though the mock holds one", async () => {
    // The assertion the one-team fixture cannot make on its own. A mock that returned the only row
    // it held would pass every other test here while hiding a missing team predicate — ADR-018's
    // revert condition, one table over.
    __setCurrentMember(FIXTURE_OTHER_TEAM_MEMBER.id);
    expect(await mock.getTeam()).toEqual(FIXTURE_OTHER_TEAM);

    __setCurrentMember(FIXTURE_MEMBER.id);
    expect((await mock.getTeam())?.id).not.toBe(FIXTURE_OTHER_TEAM.id);
  });

  it("answers null for a caller with no member row", async () => {
    __setCurrentMember(null);
    expect(await mock.getTeam()).toBeNull();
  });
});

describe("CAL-04 listTeamEntriesOverlapping", () => {
  afterEach(() => __setCurrentMember(null));

  const covering = { start: "2026-09-01", end: "2026-09-30" };

  it("returns an entry that OVERLAPS the range rather than only ones contained by it", async () => {
    __setCurrentMember(FIXTURE_APPROVED_MEMBER.id);
    // FIXTURE_APPROVED_ENTRY runs 2026-09-14 to 2026-09-16. A range covering only its last day must
    // still return it, because the grid draws that member's avatar on that day.
    const rows = await mock.listTeamEntriesOverlapping({ start: "2026-09-16", end: "2026-09-20" });
    expect(rows.map((e) => e.id)).toContain(FIXTURE_APPROVED_ENTRY.id);

    const before = await mock.listTeamEntriesOverlapping({ start: "2026-09-01", end: "2026-09-13" });
    expect(before.map((e) => e.id)).not.toContain(FIXTURE_APPROVED_ENTRY.id);
  });

  it("AC-4: does NOT filter status — excluding rejected rows is absenceCountsFor's alone", async () => {
    // There is no rejected row in the fixtures to assert against directly, so this asserts the shape
    // that makes the rule possible: the read returns the whole row including `status`, and the seam
    // carries no status filter to drift from INV-04's one implementation.
    __setCurrentMember(FIXTURE_APPROVED_MEMBER.id);
    const rows = await mock.listTeamEntriesOverlapping(covering);
    const row = rows.find((e) => e.id === FIXTURE_APPROVED_ENTRY.id);
    expect(row?.status).toBe("approved");
  });

  it("AC-12: never returns another team's entry", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const rows = await mock.listTeamEntriesOverlapping(covering);
    expect(rows.map((e) => e.id)).not.toContain(FIXTURE_OTHER_TEAM_ENTRY.id);

    // And the other way round, so the assertion above cannot pass because the row is simply absent:
    // that member DOES see their own team's entry, on the same range.
    __setCurrentMember(FIXTURE_OTHER_TEAM_MEMBER.id);
    const theirs = await mock.listTeamEntriesOverlapping(covering);
    expect(theirs.map((e) => e.id)).toEqual([FIXTURE_OTHER_TEAM_ENTRY.id]);
  });

  it("answers an empty list for a caller with no member row", async () => {
    __setCurrentMember(null);
    expect(await mock.listTeamEntriesOverlapping(covering)).toEqual([]);
  });
});

// SOLO, 2026-09-10. Not an acceptance criterion — `.claude/agents/solo.md` and ADR-033.
//
// **THIS IS THE TERM OF THE SEAM CONTRACT THAT LETS `useSession` READ ONCE INSTEAD OF TWICE.**
// GoTrue calls every new subscriber back immediately with the current session, unconditionally
// (`@supabase/auth-js@2.112.4/dist/module/GoTrueClient.js:3633-3644`, read on disk). The mock did
// not, so the hook compensated by ALSO calling `getSession()` itself — and against the real client
// that made two `auth.getUser()` calls and two `member` selects on every mount, one of which a
// sequence guard silently discarded.
//
// The hook now has one path. If an implementation stops emitting, `resolving` never clears and the
// application sits on its loading screen for ever; the acceptance suite catches that, and this
// catches it one layer down and in one second.
describe("SOLO — onAuthStateChange emits once on subscribe", () => {
  it("calls a new listener with the current session, without waiting for a change", async () => {
    const seen: Array<unknown> = [];
    const unsubscribe = mock.onAuthStateChange((session) => seen.push(session));

    // Nothing yet: the emit is ASYNCHRONOUS, as the real client's is. A synchronous callback would
    // run inside the subscriber's own effect body, before its cleanup was registered.
    expect(seen, "the mock emitted synchronously").toEqual([]);

    await Promise.resolve();
    expect(seen, "the mock did not emit on subscribe").toHaveLength(1);

    unsubscribe();
  });

  it("does not call a listener that unsubscribed in the same tick", async () => {
    // React's StrictMode subscribes and unsubscribes within one tick on its throwaway first mount.
    // An emit that ignored the unsubscribe would set state on a component that is already gone.
    const seen: Array<unknown> = [];
    const unsubscribe = mock.onAuthStateChange((session) => seen.push(session));
    unsubscribe();

    await Promise.resolve();
    expect(seen).toEqual([]);
  });
});
