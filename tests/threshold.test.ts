// ADM-01 — the refusals below the interface. 01-plan.md section 7.
//
// AC-5, AC-9 and AC-14 are refusals the acceptance suite CANNOT reach: it drives the browser and
// cannot call a seam function with a chosen caller. This file does, through `__setCurrentMember` —
// the test-only hook mock.ts exports beside `seam`, and which tests/seam-parity.test.ts already
// uses for CAL-04's shapes. It moves the member and not the session, so it reaches a state the
// application itself cannot; that is exactly what is wanted here, because the subject is the seam's
// answer and not a journey.
//
// IT IS NOT `tests/permission-model.test.ts`. That name is cited by a comment in TEA-01's migration
// (20260831150024_tea01_membership.sql:150) and the file has never existed — 01-plan.md Open
// question 5. Creating it here would mean adopting a scope nobody wrote.
//
// THE MOCK IS THE SUBJECT AND THE POLICY IS WHAT IT REPRODUCES. `team_update_admin` and
// `grant update (overload_threshold) on public.team` are in
// supabase/migrations/20260905000000_adm01_team_threshold.sql and are exercised by no test until a
// project is provisioned (RULE-09 keeps applying it human). What is asserted here is that the mock
// refuses where the policy refuses, which is what keeps the acceptance suite from passing against
// nothing.
import { afterEach, describe, expect, it } from "vitest";
import { seam as mock, __setCurrentMember } from "@/lib/data/mock";
import {
  FIXTURE_ADMIN,
  FIXTURE_MEMBER,
  FIXTURE_OTHER_TEAM,
  FIXTURE_OTHER_TEAM_MEMBER,
  FIXTURE_REMOVED_MEMBER,
  FIXTURE_SECOND_ADMIN,
  FIXTURE_TEAM,
} from "@/lib/fixtures";

/** The mock's `team` table is module state and `setOverloadThreshold` mutates it, so every test
 *  puts the seeded share back. `FIXTURE_TEAM` itself is never touched — mock.ts copies each row on
 *  the way in — so this reads the seeded value rather than a remembered literal. */
async function restore(): Promise<void> {
  __setCurrentMember(FIXTURE_ADMIN.id);
  await mock.setOverloadThreshold({ overloadThreshold: FIXTURE_TEAM.overloadThreshold });
  __setCurrentMember(null);
}

/** The stored share of the caller's own team, read back through the seam rather than out of the
 *  mock's internals — so an assertion about "unchanged" is an assertion about what a reader sees. */
async function storedShare(memberId: string): Promise<number | undefined> {
  __setCurrentMember(memberId);
  const team = await mock.getTeam();
  return team?.overloadThreshold;
}

describe("ADM-01 setOverloadThreshold", () => {
  afterEach(restore);

  it("AC-2: an admin sets the threshold and the updated row comes back", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const result = await mock.setOverloadThreshold({ overloadThreshold: 0.6 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.overloadThreshold).toBe(0.6);
    expect(await storedShare(FIXTURE_ADMIN.id)).toBe(0.6);
  });

  it("AC-12: saving the same value again is not an error", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    await mock.setOverloadThreshold({ overloadThreshold: 0.6 });
    const again = await mock.setOverloadThreshold({ overloadThreshold: 0.6 });

    expect(again.ok).toBe(true);
    expect(await storedShare(FIXTURE_ADMIN.id)).toBe(0.6);
  });

  it("AC-5: a member is refused and the threshold is unchanged", async () => {
    // The criterion past every control the screen holds: this is the seam function being called
    // with a member as the caller, which is what makes `threshold-refused` an affordance rather
    // than the check.
    __setCurrentMember(FIXTURE_MEMBER.id);
    const result = await mock.setOverloadThreshold({ overloadThreshold: 0.9 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_permitted");
    expect(await storedShare(FIXTURE_MEMBER.id)).toBe(FIXTURE_TEAM.overloadThreshold);
  });

  it("AC-6: a caller with no member row is refused", async () => {
    __setCurrentMember(null);
    const result = await mock.setOverloadThreshold({ overloadThreshold: 0.9 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_permitted");
    expect(await storedShare(FIXTURE_ADMIN.id)).toBe(FIXTURE_TEAM.overloadThreshold);
  });

  it("AC-14: a removed member is refused", async () => {
    __setCurrentMember(FIXTURE_REMOVED_MEMBER.id);
    const result = await mock.setOverloadThreshold({ overloadThreshold: 0.9 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_permitted");
    expect(await storedShare(FIXTURE_ADMIN.id)).toBe(FIXTURE_TEAM.overloadThreshold);
  });

  it("AC-9: the write reaches no other column of the team row", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const before = await mock.getTeam();
    const result = await mock.setOverloadThreshold({ overloadThreshold: 0.6 });

    expect(result.ok).toBe(true);
    if (!result.ok || !before) return;
    // The whole row, field by field, so a future field added to `Team` cannot slip through an
    // assertion that only names the three that exist today.
    expect(result.value).toEqual({ ...before, overloadThreshold: 0.6 });
    expect(result.value.name).toBe(before.name);
  });

  it("AC-12 and Open question 2: 0 and 1 are both admitted at the seam", async () => {
    // The bounds are the SCREEN's (AC-7, AC-8) and there is no `check` constraint behind the
    // column — 01-plan.md section 6. Both ends are meaningful against the glossary's strictly-
    // greater comparison, so neither is a degenerate state the seam refuses.
    __setCurrentMember(FIXTURE_ADMIN.id);
    expect((await mock.setOverloadThreshold({ overloadThreshold: 0 })).ok).toBe(true);
    expect(await storedShare(FIXTURE_ADMIN.id)).toBe(0);

    __setCurrentMember(FIXTURE_ADMIN.id);
    expect((await mock.setOverloadThreshold({ overloadThreshold: 1 })).ok).toBe(true);
    expect(await storedShare(FIXTURE_ADMIN.id)).toBe(1);
  });

  it("writes the caller's OWN team only, never the other row the mock holds", async () => {
    // The assertion a one-team fixture cannot make. A mock that wrote the only row it held would
    // pass every other test here while hiding a missing team predicate — ADR-018's revert
    // condition, one table over, and the same reason CAL-04 asserted it for the read.
    __setCurrentMember(FIXTURE_ADMIN.id);
    await mock.setOverloadThreshold({ overloadThreshold: 0.6 });

    expect(await storedShare(FIXTURE_OTHER_TEAM_MEMBER.id)).toBe(
      FIXTURE_OTHER_TEAM.overloadThreshold,
    );
  });

  it("hands back a copy, so a caller cannot write the mock's table through the value", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const result = await mock.setOverloadThreshold({ overloadThreshold: 0.6 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    result.value.overloadThreshold = 0.99;
    expect(await storedShare(FIXTURE_ADMIN.id)).toBe(0.6);
  });

  // LAST IN THE FILE, DELIBERATELY, and the ordering is load-bearing. `removeMember` is the only
  // way to reach a caller whose row is removed AND whose role is `admin` — no such fixture exists
  // and src/lib/fixtures.ts is not in this ticket's `allowed_paths` — and the mock offers no way to
  // undo a removal, so this test leaves FIXTURE_SECOND_ADMIN removed for whatever runs after it.
  // Nothing does, in this file, and the mock's module state is per test file.
  it("AC-14: a removed caller is refused WHATEVER role their row records", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    const removal = await mock.removeMember(FIXTURE_SECOND_ADMIN.id);
    expect(removal.ok, "the fixture setup for this test failed").toBe(true);
    if (!removal.ok) return;
    expect(removal.value.role).toBe("admin");
    expect(removal.value.removedAt).not.toBeNull();

    __setCurrentMember(FIXTURE_SECOND_ADMIN.id);
    const result = await mock.setOverloadThreshold({ overloadThreshold: 0.9 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_permitted");
    expect(await storedShare(FIXTURE_ADMIN.id)).toBe(FIXTURE_TEAM.overloadThreshold);
  });
});

// MIR-09, ADR-069. The mock's new pre-send guard — AC-4. The datastore's own refusal (AC-5) is not
// reachable from the mock, which holds no SQL; that half is `supabase/tests/110-schema-cleanup.test.sql`.
describe("MIR-09 range", () => {
  afterEach(restore);

  it("AC-4: an admin sending an out-of-range or non-finite value is refused, and nothing is written", async () => {
    __setCurrentMember(FIXTURE_ADMIN.id);
    for (const overloadThreshold of [1.5, -0.1, NaN, Infinity]) {
      const result = await mock.setOverloadThreshold({ overloadThreshold });

      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.error.code).toBe("invalid_threshold");
    }
    expect(await storedShare(FIXTURE_ADMIN.id)).toBe(FIXTURE_TEAM.overloadThreshold);
  });

  it("AC-4: the value check runs before the permission check — a non-admin gets invalid_threshold too", async () => {
    __setCurrentMember(FIXTURE_MEMBER.id);
    const result = await mock.setOverloadThreshold({ overloadThreshold: 1.5 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_threshold");
    expect(await storedShare(FIXTURE_MEMBER.id)).toBe(FIXTURE_TEAM.overloadThreshold);
  });
});
