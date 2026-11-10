// SOLO, 2026-09-10 — sign-up under both email-confirmation settings.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA.** What authorises it is
// `.claude/agents/solo.md` and the operator's instruction: *"thay đổi config, không cần verify email
// khi đăng kí"*.
//
// **IT IS HERE RATHER THAN IN `tests/e2e/` FOR A MECHANICAL REASON, NOT A PREFERENCE.** Playwright's
// `webServer` is ONE server for the whole run, and `playwright.config.ts` pins
// `VITE_REQUIRE_EMAIL_CONFIRMATION=true` so that TEA-01's seven `signup-confirm-notice` assertions
// keep running against the setting they were written for. A browser test of the OTHER setting would
// need a second config and a second build. `.ai/standards/testing-standards.md` puts seam behaviour
// at the unit level anyway, and what changed IS seam behaviour.
//
// **IT DRIVES THE MOCK IMPLEMENTATION DIRECTLY**, the way `tests/pending-entries.test.ts` and
// `tests/seam-parity.test.ts` do, rather than through `@/lib/data` — which resolves by environment
// and would make this file's subject depend on the machine.
//
// **EVERY TEST RE-IMPORTS THE MODULE, AND THAT IS LOAD-BEARING.** The mock is module state:
// `signedUp`, `members` and the current session all live for the life of the module. Without
// `resetModules` an account created by one test would still be sign-in-able in the next, and the
// second test would pass for the wrong reason.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_PASSWORD } from "@/lib/fixtures";
import type { DataSeam } from "@/lib/data";

/** A fresh mock, with the flag set for this test only. */
async function freshSeam(requireConfirmation: boolean): Promise<DataSeam> {
  vi.resetModules();
  vi.stubEnv(
    "VITE_REQUIRE_EMAIL_CONFIRMATION",
    requireConfirmation ? "true" : "",
  );
  const module = await import("@/lib/data/mock");
  return module.seam;
}

/** An address nothing has seeded, so no fixture can answer for it. */
/** SOLO, 2026-09-10. Any address at all: the allow-list is gone, so no address is special and a
 *  sign-up is treated the same whoever sends it. This used to be `FIXTURE_ALLOWED_EMAIL`. */
const JOINER_EMAIL = "nguoimoi@example.com";

const NEW_EMAIL = "moi@example.com";
const NEW_PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

const signUpInput = (email: string) => ({
  email,
  password: NEW_PASSWORD,
  displayName: "Nguoi Moi",
  avatar: "1.png",
});

describe("sign-up, with email confirmation REQUIRED", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns no session and reports that a confirmation is needed — TEA-01 AC-7, unchanged", async () => {
    const seam = await freshSeam(true);

    const result = await seam.signUp(signUpInput(NEW_EMAIL));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.needsEmailConfirmation).toBe(true);
    expect(result.value.session).toBeNull();
  });

  it("leaves the account unable to sign in, which is what the setting MEANS", async () => {
    const seam = await freshSeam(true);
    await seam.signUp(signUpInput(NEW_EMAIL));

    // Not `email_not_confirmed`: the mock's `signIn` answers from the seeded list, and an account
    // that never confirmed was never added to it. The refusal is `invalid_credentials`, which is the
    // shipped behaviour and is asserted here so the change below is visible AS a change.
    const signedIn = await seam.signIn({
      email: NEW_EMAIL,
      password: NEW_PASSWORD,
    });
    expect(signedIn.ok).toBe(false);
  });
});

describe("sign-up, with email confirmation NOT required", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns a live session and asks for no confirmation", async () => {
    const seam = await freshSeam(false);

    const result = await seam.signUp(signUpInput(NEW_EMAIL));

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.needsEmailConfirmation).toBe(false);
    expect(result.value.session).not.toBeNull();
    expect(result.value.session?.user.email).toBe(NEW_EMAIL);
    expect(result.value.session?.user.emailConfirmed).toBe(true);
  });

  it("**makes the new account able to sign in**, which it never was before", async () => {
    const seam = await freshSeam(false);
    await seam.signUp(signUpInput(NEW_EMAIL));
    await seam.signOut();

    // THE POINT OF THE WHOLE CHANGE. `signIn` searched `FIXTURE_CREDENTIALS` and nothing else — a
    // frozen array — so an account created through the form could never sign in again under EITHER
    // setting. That was invisible while sign-up ended on a terminal notice, because nobody got as
    // far as trying.
    const signedIn = await seam.signIn({
      email: NEW_EMAIL,
      password: NEW_PASSWORD,
    });
    expect(signedIn.ok).toBe(true);
  });

  it("refuses the wrong password for an account it just created", async () => {
    const seam = await freshSeam(false);
    await seam.signUp(signUpInput(NEW_EMAIL));
    await seam.signOut();

    // Without this the previous test is satisfied by a `signIn` that admits any address it has seen,
    // which is the obvious way to get that one green and the wrong one.
    const signedIn = await seam.signIn({
      email: NEW_EMAIL,
      password: "not-the-password",
    });
    expect(signedIn.ok).toBe(false);
  });

  it("gives EVERY joiner a member row, pending and on no team", async () => {
    // **REWRITTEN 2026-09-10, AND THE ASSERTION IT REPLACES WAS THE OPPOSITE.** As shipped this read
    // *"gives an allow-listed joiner a member row, and an unlisted one a session with none"*, and
    // asserted `getCurrentMember()` was null for an address nobody had listed. There is no list any
    // more: everybody gets a row, and what an admin decides afterwards is what differs.
    //
    // TEA-01 AC-5 is now true BY CONSTRUCTION rather than by care — it required the success branch to
    // be identical whether or not the address was listed, and there is no second branch left.
    for (const email of [JOINER_EMAIL, NEW_EMAIL]) {
      const fresh = await freshSeam(false);
      const result = await fresh.signUp(signUpInput(email));
      expect(result.ok).toBe(true);

      const me = await fresh.getCurrentMember();
      expect(me, `${email} must have a member row`).not.toBeNull();

      // **NO TEAM AND NOT APPROVED, which is the whole of the new model.** `member_team_id` returns
      // null for anybody in this state, and every row-level policy in the product is keyed on that
      // function — so the row grants nothing until an admin approves it.
      expect(me?.teamId).toBeNull();
      expect(me?.status).toBe("pending");
      expect(me?.role).toBe("member");
    }
  });

  it("puts every new sign-up in front of an admin, and an approval gives them the admin's team", async () => {
    const fresh = await freshSeam(false);
    await fresh.signUp(signUpInput(NEW_EMAIL));
    const joiner = await fresh.getCurrentMember();
    expect(joiner).not.toBeNull();
    await fresh.signOut();

    // A member sees nothing here — `member_select_pending_admin` requires `is_admin`, and the mock
    // reproduces the policy rather than a second story about it.
    await fresh.signIn({ email: MEMBER_EMAIL, password: FIXTURE_PASSWORD });
    expect(await fresh.listPendingMembers()).toHaveLength(0);
    await fresh.signOut();


    await fresh.signIn({ email: ADMIN_EMAIL, password: FIXTURE_PASSWORD });
    const waiting = await fresh.listPendingMembers();
    expect(waiting.map((m) => m.id)).toContain(joiner?.id);

    // COUNTED RELATIVE TO WHAT WAS ALREADY THERE. `FIXTURE_PENDING_SIGNUP` is seeded waiting, so a
    // test that demanded an empty queue afterwards would be asserting that the fixture vanished.
    const before = waiting.length;

    const admin = await fresh.getCurrentMember();
    const decided = await fresh.decideMember(joiner?.id ?? "", {
      approve: true,
      teamId: admin?.teamId ?? "",
    });
    expect(decided.ok).toBe(true);

    // Off the queue, on the team. The queue shrinks by exactly one because the next read does not
    // return them — and the seeded fixture is still waiting, which is what makes this a subtraction
    // rather than an emptying.
    const after = await fresh.listPendingMembers();
    expect(after).toHaveLength(before - 1);
    expect(after.map((m) => m.id)).not.toContain(joiner?.id);
  });

  it("refuses an approval that names a team that does not exist", async () => {
    const fresh = await freshSeam(false);
    await fresh.signUp(signUpInput(NEW_EMAIL));
    const joiner = await fresh.getCurrentMember();
    await fresh.signOut();

    await fresh.signIn({ email: ADMIN_EMAIL, password: FIXTURE_PASSWORD });

    // **`member_decide_admin`'s `with check` IS THE CONTROL AND THIS IS THE MOCK REPRODUCING IT.**
    // The policy compares the incoming `team_id` to `member_team_id(auth.uid())`, so a caller naming
    // another team is refused rather than obeyed. A mock that trusted the argument would make a
    // component test pass against a missing `with check`.
    //
    // MIR-07, 2026-10-23. The paragraph above is no longer what either side does. Approval is
    // `public.admit_member`, which checks only that the team EXISTS
    // (`20260911180000_solo_many_teams.sql:157`), and the mock does the same. The id below names no
    // team, so this asserts that refusal and no other; an approval onto another existing team is
    // admitted by both, and bounding it is MIR-13's. Renamed from "refuses an approval that names a
    // team the admin is not on", which claimed a refusal neither side implements.
    const refusedResult = await fresh.decideMember(joiner?.id ?? "", {
      approve: true,
      teamId: "00000000-0000-4000-8000-999999999999",
    });
    expect(refusedResult.ok).toBe(false);

    // And the person is still waiting, rather than half-decided.
    expect((await fresh.listPendingMembers()).map((m) => m.id)).toContain(
      joiner?.id,
    );
  });

  it("does not let a sign-up shadow a seeded address", async () => {
    const seam = await freshSeam(false);

    // `signedUp` is searched LAST. A sign-up reusing a fixture address must not rewrite what that
    // address's password means for every other spec file in the suite.
    await seam.signUp({ ...signUpInput("quan@example.com"), password: "zzzz99" });
    await seam.signOut();

    const asFixture = await seam.signIn({
      email: "quan@example.com",
      password: FIXTURE_PASSWORD,
    });
    expect(asFixture.ok).toBe(true);
  });
});
