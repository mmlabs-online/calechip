// SOLO, 2026-09-10 — the two profile writes, below the interface.
//
// **THIS WORK CARRIES NO TICKET AND NO ACCEPTANCE CRITERIA**, so nothing here is numbered `AC-n`:
// that prefix is a claim that a plan document states the criterion. `.claude/agents/solo.md` and
// ADR-033 are the authority.
//
// **THE MOCK IS THE SUBJECT AND THE MIGRATION IS WHAT IT REPRODUCES.** `member_update_own` and the
// two new trigger clauses live in
// `supabase/migrations/20260910093000_solo_profile_self_update.sql` and are exercised by NO test
// until a project is provisioned — RULE-09 keeps applying it human. What can be asserted here is
// that the mock refuses where the datastore refuses, and that matters because the acceptance suite
// drives the mock (BUG-001, `tests/e2e/seam.setup.ts`): a permissive mock would let every profile
// test in that suite pass against a datastore nobody has checked.
//
// **THE PASSWORD BRANCHES ARE HERE AND NOT IN THE BROWSER SUITE**, because the observable proof that
// a password changed is that the OLD one stops working — which costs a sign-out, two sign-ins and a
// restore. Below the interface it is four calls.
//
// **THE OFFERED-AVATAR RULE IS THE SEAM'S ALONE.** That migration deliberately carries no check
// constraint on `avatar` — the first draft had one and it aborted on real seed data, which is how
// the whole file came to be unapplied. Step 3 of the migration records why at length. So these tests
// are not a mock agreeing with a constraint; they are the only statement of the rule that exists.
//
// EVERY TEST RESTORES WHAT IT WROTE. `members` and `passwordOverrides` are module state that lives
// for the whole file, and the mock offers no reseed, so a test that renamed a fixture member and
// left them renamed would silently change what every test after it asserts against.
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { seam as mock } from "@/lib/data/mock";
import { AVATAR_CHOICES } from "@/lib/domain/types";
import { FIXTURE_MEMBER, FIXTURE_PASSWORD } from "@/lib/fixtures";

/** SOLO, 2026-09-10. Any address at all. This was `FIXTURE_ALLOWED_EMAIL` until the allow-list was
 *  removed whole; no address is special now, because every sign-up is treated alike and an admin
 *  decides afterwards. */
const JOINER_EMAIL = "nguoimoi@example.com";

/** SOLO, 2026-09-13. An offered avatar that is not the fixture member's own, so a write is a change.
 *  Read from the folder listing rather than named, because the offered set IS the folder. */
const OTHER_OFFERED = AVATAR_CHOICES.find((name) => name !== FIXTURE_MEMBER.avatar);
if (!OTHER_OFFERED) {
  throw new Error("public/images/ must hold at least one image besides the fixture member's own");
}
const OTHER_AVATAR: string = OTHER_OFFERED;

/** A well-formed file name that is not in the folder: what a caller with a token could write. */
const NEVER_OFFERED = "never-offered.webp";

const MEMBER_EMAIL = "thanh@example.com";

/** Signs in as the member-role fixture, which is the caller every test below acts as. Through
 *  `signIn` and not `__setCurrentMember`: `changePassword` reads the SESSION, and the test hook
 *  moves the member row without one — a state the application cannot reach. */
async function signInAsMember(): Promise<void> {
  const result = await mock.signIn({
    email: MEMBER_EMAIL,
    password: FIXTURE_PASSWORD,
  });
  expect(result.ok, "the fixture member could not sign in").toBe(true);
}

describe("SOLO — updateOwnProfile", () => {
  beforeEach(async () => {
    await signInAsMember();
  });

  afterEach(async () => {
    // Restore the row, then end the session. Both matter: the next test asserts against the
    // fixture's own name and avatar, and a session left open would make the signed-out test lie.
    await mock.updateOwnProfile({
      displayName: FIXTURE_MEMBER.displayName,
      avatar: FIXTURE_MEMBER.avatar,
    });
    await mock.signOut();
  });

  it("writes the caller's own display name and avatar", async () => {
    const result = await mock.updateOwnProfile({
      displayName: "Renamed",
      avatar: OTHER_AVATAR,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayName).toBe("Renamed");
    expect(result.value.avatar).toBe(OTHER_AVATAR);

    // Read back through a different function, so the assertion is about what was STORED and not
    // about what this call happened to return.
    const me = await mock.getCurrentMember();
    expect(me?.displayName).toBe("Renamed");
    expect(me?.avatar).toBe(OTHER_AVATAR);
  });

  it("changes nothing else on the row", async () => {
    const before = await mock.getCurrentMember();
    await mock.updateOwnProfile({ displayName: "Renamed", avatar: OTHER_AVATAR });
    const after = await mock.getCurrentMember();

    // The two columns TEA-04 withholds from everybody, and the one INV-07 rests on. The mock has no
    // grants, so this is the only place the property is checkable at all.
    expect(after?.id).toBe(before?.id);
    expect(after?.teamId).toBe(before?.teamId);
    expect(after?.role).toBe(before?.role);
    expect(after?.createdAt).toBe(before?.createdAt);
    expect(after?.removedAt).toBe(before?.removedAt);
  });

  it("trims the display name, as the trigger's btrim does", async () => {
    const result = await mock.updateOwnProfile({
      displayName: "  Spaced  ",
      avatar: FIXTURE_MEMBER.avatar,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayName).toBe("Spaced");
  });

  it("refuses a blank display name, and one that is only spaces", async () => {
    for (const blank of ["", "   "]) {
      const result = await mock.updateOwnProfile({
        displayName: blank,
        avatar: FIXTURE_MEMBER.avatar,
      });

      expect(result.ok, `"${blank}" was accepted`).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe("invalid_display_name");
    }

    // The refusal wrote nothing. A mock that refused and saved would be worse than one that did
    // neither, because the screen would show an error over a changed row.
    const me = await mock.getCurrentMember();
    expect(me?.displayName).toBe(FIXTURE_MEMBER.displayName);
  });

  it("refuses an avatar that is not offered", async () => {
    const result = await mock.updateOwnProfile({
      displayName: FIXTURE_MEMBER.displayName,
      avatar: NEVER_OFFERED,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_avatar");
  });

  it("accepts every avatar the picker offers", async () => {
    // The picker renders `AVATAR_CHOICES` and the seam checks against it, so a value that renders
    // and cannot be saved is the failure this asserts against — one list, read by both, and this is
    // what says so.
    for (const choice of AVATAR_CHOICES) {
      const result = await mock.updateOwnProfile({
        displayName: FIXTURE_MEMBER.displayName,
        avatar: choice,
      });
      expect(result.ok, `${choice} was refused`).toBe(true);
    }
  });
});

describe("SOLO — updateOwnProfile keeps an avatar that is not offered", () => {
  // **THE CASE IS A SAVED FILE NAME THAT IS NO LONGER IN THE FOLDER.** SOLO, 2026-09-13: the offered
  // set is `public/images/` at build time, so removing a file leaves every member who chose it
  // holding a value `AVATAR_CHOICES` does not contain. Without the *keep what you have* clause,
  // every member holding one is refused on EVERY save, including one that changes only their name,
  // with a message telling them to pick an avatar they never touched.
  //
  // **THE STATE IS REACHED THROUGH `signUp`, WHICH IS THE ONLY DOOR THE MOCK OFFERS.** It stores
  // whatever avatar it is handed — as the real trigger does, since `raw_user_meta_data` is whatever
  // the caller passed — so an allow-listed address signed up with an odd avatar produces the row
  // shape the seed produced.
  //
  // **ONE SIGN-UP FOR THE WHOLE BLOCK, in `beforeAll`.** `JOINER_EMAIL` is consumed by the
  // first one, so a second would create A SESSION AND NO MEMBER ROW — a silently member-less caller
  // whose refusals would look exactly like this rule failing. Each test signs in instead; the mock
  // adds a signed-up account to the list `signIn` searches.
  const UNOFFERED = "removed-from-folder.png";

  beforeAll(async () => {
    const signedUp = await mock.signUp({
      email: JOINER_EMAIL,
      password: FIXTURE_PASSWORD,
      displayName: "Odd Face",
      avatar: UNOFFERED,
    });
    expect(signedUp.ok, "the allow-listed address could not sign up").toBe(true);
    await mock.signOut();
  });

  beforeEach(async () => {
    const result = await mock.signIn({
      email: JOINER_EMAIL,
      password: FIXTURE_PASSWORD,
    });
    expect(result.ok, "the signed-up account could not sign in").toBe(true);
    // The premise of every test below, asserted rather than assumed. With email confirmation off —
    // this runner's configuration, and the opposite of the one `playwright.config.ts` pins for the
    // browser suite — sign-up created the member row directly.
    const me = await mock.getCurrentMember();
    expect(me?.avatar, "the mock did not store the avatar it was handed").toBe(UNOFFERED);
    expect(AVATAR_CHOICES).not.toContain(UNOFFERED);
  });

  afterEach(async () => {
    await mock.signOut();
  });

  it("saves a new display name while the odd avatar is sent back unchanged", async () => {
    const result = await mock.updateOwnProfile({
      displayName: "Odd Face Renamed",
      avatar: UNOFFERED,
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.displayName).toBe("Odd Face Renamed");
    expect(result.value.avatar).toBe(UNOFFERED);

    // Restored, so the tests after this one start from the row `beforeEach` asserts.
    await mock.updateOwnProfile({ displayName: "Odd Face", avatar: UNOFFERED });
  });

  it("still refuses a DIFFERENT unoffered avatar", async () => {
    // The clause is *keep what you have*, not *anything goes*. A member holding an odd value must
    // not thereby be able to set an arbitrary new one.
    const result = await mock.updateOwnProfile({
      displayName: "Odd Face",
      avatar: NEVER_OFFERED,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("invalid_avatar");
  });

  it("lets them move to an offered avatar, after which the odd one is no longer theirs", async () => {
    const moved = await mock.updateOwnProfile({
      displayName: "Odd Face",
      avatar: OTHER_AVATAR,
    });
    expect(moved.ok).toBe(true);

    const back = await mock.updateOwnProfile({
      displayName: "Odd Face",
      avatar: UNOFFERED,
    });
    expect(back.ok, "the odd avatar was still accepted after moving away").toBe(false);
    if (back.ok) return;
    expect(back.error.code).toBe("invalid_avatar");
  });
});

describe("SOLO — updateOwnProfile with no session", () => {
  it("refuses, and names no member", async () => {
    await mock.signOut();
    const result = await mock.updateOwnProfile({
      displayName: "Nobody",
      avatar: FIXTURE_MEMBER.avatar,
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_permitted");
  });
});

describe("SOLO — changePassword", () => {
  beforeEach(async () => {
    await signInAsMember();
  });

  afterEach(async () => {
    await mock.signOut();
  });

  it("refuses a wrong current password, and the old one still works", async () => {
    const result = await mock.changePassword({
      currentPassword: "not-the-password",
      newPassword: "a-good-new-password",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // `wrong_password` and never `invalid_credentials`: the caller is already signed in, so there is
    // no address to enumerate and the message may name the box that is wrong.
    expect(result.error.code).toBe("wrong_password");

    await mock.signOut();
    const stillWorks = await mock.signIn({
      email: MEMBER_EMAIL,
      password: FIXTURE_PASSWORD,
    });
    expect(stillWorks.ok, "a refused change altered the password").toBe(true);
  });

  it("refuses a new password below the minimum", async () => {
    const result = await mock.changePassword({
      currentPassword: FIXTURE_PASSWORD,
      newPassword: "12345",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    // The same code sign-up raises for the same condition, because GoTrue raises exactly one.
    expect(result.error.code).toBe("weak_password");
  });

  it("changes the password: the new one works and the old one stops", async () => {
    const NEXT = "a-brand-new-password";

    const changed = await mock.changePassword({
      currentPassword: FIXTURE_PASSWORD,
      newPassword: NEXT,
    });
    expect(changed.ok).toBe(true);

    await mock.signOut();

    // **THE HALF THAT MATTERS.** A mock that stored the new password beside the old one would pass
    // the first of these two and fail nothing anywhere else.
    const withOld = await mock.signIn({
      email: MEMBER_EMAIL,
      password: FIXTURE_PASSWORD,
    });
    expect(withOld.ok, "the old password still signs in").toBe(false);

    const withNew = await mock.signIn({ email: MEMBER_EMAIL, password: NEXT });
    expect(withNew.ok, "the new password does not sign in").toBe(true);

    // Restore, so the rest of the file — and any test that runs after it in this module — signs in
    // with the password every other spec expects.
    const restored = await mock.changePassword({
      currentPassword: NEXT,
      newPassword: FIXTURE_PASSWORD,
    });
    expect(restored.ok).toBe(true);
  });
});

describe("SOLO — changePassword with no session", () => {
  it("refuses", async () => {
    await mock.signOut();
    const result = await mock.changePassword({
      currentPassword: FIXTURE_PASSWORD,
      newPassword: "something-else-entirely",
    });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("not_permitted");
  });
});
