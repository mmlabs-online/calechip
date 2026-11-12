// MIR-19-f, ADR-099 — a sign-up lands in the org of the address it was made at (AC-10, mock half).
//
// Drives the mock implementation directly with Confirm email ON, as `signup-confirmation.test.ts`
// does, and re-imports the module per test because the mock is module state.
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FIXTURE_ADMIN, FIXTURE_PASSWORD, FIXTURE_PENDING_SIGNUP } from "@/lib/fixtures";

const ADMIN_EMAIL = "quan@example.com";
const ACME_EMAIL = "acme-joiner@example.com";
const SHARED_EMAIL = "shared-joiner@example.com";
const ROOT_EMAIL = "root-joiner@example.com";

const signUpInput = (email: string, orgCode?: string | null) => ({
  email,
  password: "password123",
  displayName: "Nguoi Moi",
  avatar: "1.png",
  ...(orgCode === undefined ? {} : { orgCode }),
});

async function freshMock() {
  vi.resetModules();
  vi.stubEnv("VITE_REQUIRE_EMAIL_CONFIRMATION", "true");
  return import("@/lib/data/mock");
}

/** Signs the fixture org admin in; he is in Org public unless a test moves him. */
async function signInAdmin(mock: Awaited<ReturnType<typeof freshMock>>) {
  const result = await mock.seam.signIn({ email: ADMIN_EMAIL, password: FIXTURE_PASSWORD });
  expect(result.ok).toBe(true);
}

const emails = (list: { email: string | null }[]) => list.map((m) => m.email);

describe("MIR-19-f sign-up org, mock seam", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
  });

  it("AC-10.1: an Acme sign-up is listed and counted for an Acme org admin, and the seeded Org public one is not", async () => {
    const mock = await freshMock();
    mock.__setDedicatedOrgMembersForTest([FIXTURE_ADMIN.id]);
    expect((await mock.seam.signUp(signUpInput(ACME_EMAIL, "acme"))).ok).toBe(true);
    await signInAdmin(mock);

    const pending = await mock.seam.listPendingMembers();
    expect(emails(pending)).toEqual([ACME_EMAIL]);
    expect(pending.some((m) => m.id === FIXTURE_PENDING_SIGNUP.id)).toBe(false);
    expect(await mock.seam.countPendingMembers()).toBe(1);
  });

  it("AC-10.2: with him in Org public, an Acme sign-up is neither listed nor counted; root and shared ones are", async () => {
    const mock = await freshMock();
    expect((await mock.seam.signUp(signUpInput(ACME_EMAIL, "acme"))).ok).toBe(true);
    expect((await mock.seam.signUp(signUpInput(ROOT_EMAIL))).ok).toBe(true);
    expect((await mock.seam.signUp(signUpInput(SHARED_EMAIL, "shared"))).ok).toBe(true);
    await signInAdmin(mock);

    const pending = await mock.seam.listPendingMembers();
    expect(pending.some((m) => m.id === FIXTURE_PENDING_SIGNUP.id)).toBe(true);
    expect(emails(pending)).toContain(ROOT_EMAIL);
    expect(emails(pending)).toContain(SHARED_EMAIL);
    expect(emails(pending)).not.toContain(ACME_EMAIL);
    expect(await mock.seam.countPendingMembers()).toBe(pending.length);
  });

  it("AC-10.3: an Org public admin cannot decide an Acme sign-up, and the row stays pending", async () => {
    const mock = await freshMock();
    mock.__setDedicatedOrgMembersForTest([FIXTURE_ADMIN.id]);
    expect((await mock.seam.signUp(signUpInput(ACME_EMAIL, "acme"))).ok).toBe(true);
    await signInAdmin(mock);
    const acmeRow = (await mock.seam.listPendingMembers()).find((m) => m.email === ACME_EMAIL);
    expect(acmeRow).toBeDefined();
    const acmeId = acmeRow!.id;

    // Move him to Org public and the sign-up alone into Acme.
    mock.__setDedicatedOrgMembersForTest([acmeId]);
    const teamId = FIXTURE_ADMIN.teamId as string;
    const decided = await mock.seam.decideMember(acmeId, { approve: true, teamId });

    expect(decided.ok).toBe(false);
    if (decided.ok) return;
    expect(decided.error.code).toBe("not_permitted");
    expect(decided.error.message).toBe("That sign-up could not be decided. It may already have been.");

    // Back in Acme he still sees it pending: the refusal changed nothing.
    mock.__setDedicatedOrgMembersForTest([FIXTURE_ADMIN.id, acmeId]);
    expect(emails(await mock.seam.listPendingMembers())).toContain(ACME_EMAIL);
  });

  it("AC-10.4 / AC-4: an unknown code is refused with `unknown` and creates no member", async () => {
    const mock = await freshMock();
    const result = await mock.seam.signUp(signUpInput(ACME_EMAIL, "no-such-org"));

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe("unknown");

    await signInAdmin(mock);
    expect(emails(await mock.seam.listPendingMembers())).not.toContain(ACME_EMAIL);
    // And no credential was recorded for it.
    const again = await mock.seam.signIn({ email: ACME_EMAIL, password: "password123" });
    expect(again.ok).toBe(false);
  });
});
