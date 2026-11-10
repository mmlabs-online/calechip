import { expect, test, type Locator, type Page } from "@playwright/test";

// MIR-18-b AC-9 to AC-14 — org management in the system panel, against the mock build (01-plan.md
// § 2, § 4.6).
//
// Every locator is a `data-testid` named in 01-plan.md § 4.5. Fixtures (§ 2's panel table): the mock
// holds two orgs at load, reset on reload —
//   shared — Org public, shared, Asia/Ho_Chi_Minh, no caps, free, no licence
//   acme   — Acme Studio, Asia/Ho_Chi_Minh, 30 members, 3 teams, free, licence 2027-06-30
// "Signed in" is ops@calechip.test, password `calechip-demo`, then code `246810`. "—" is a null.

const PANEL = "/system.html";
const OPS = "ops@calechip.test";
const NULL = "—";

async function signInVerified(page: Page): Promise<void> {
  await page.goto(PANEL);
  await page.getByTestId("system-signin-email").fill(OPS);
  await page.getByTestId("system-signin-password").fill("calechip-demo");
  await page.getByTestId("system-signin-submit").click();
  await page.getByTestId("system-code-input").fill("246810");
  await page.getByTestId("system-code-submit").click();
  await expect(page.getByTestId("system-orgs")).toBeVisible();
}

function row(page: Page, orgCode: string): Locator {
  return page.locator(`[data-testid="system-org-row"][data-org-code="${orgCode}"]`);
}

async function expectRow(
  page: Page,
  orgCode: string,
  values: { name: string; maxMembers: string; maxTeams: string; plan: string; licence: string },
): Promise<void> {
  const r = row(page, orgCode);
  await expect(r.getByTestId("system-org-code")).toHaveText(orgCode);
  await expect(r.getByTestId("system-org-name")).toHaveText(values.name);
  await expect(r.getByTestId("system-org-max-members")).toHaveText(values.maxMembers);
  await expect(r.getByTestId("system-org-max-teams")).toHaveText(values.maxTeams);
  await expect(r.getByTestId("system-org-plan")).toHaveText(values.plan);
  await expect(r.getByTestId("system-org-licence")).toHaveText(values.licence);
}

const ACME = { name: "Acme Studio", maxMembers: "30", maxTeams: "3", plan: "free", licence: "2027-06-30" };

test.describe("MIR-18-b org management", () => {
  test.beforeEach(async ({ page }) => {
    await signInVerified(page);
  });

  test("AC-9: the signed-in panel shows the org list", async ({ page }) => {
    const rows = page.getByTestId("system-orgs").getByTestId("system-org-row");
    await expect(rows).toHaveCount(2);
    await expect(rows.nth(0)).toHaveAttribute("data-org-code", "shared");
    await expect(rows.nth(1)).toHaveAttribute("data-org-code", "acme");

    await expectRow(page, "shared", { name: "Org public", maxMembers: NULL, maxTeams: NULL, plan: "free", licence: NULL });
    await expect(row(page, "shared").getByTestId("system-org-timezone")).toHaveText("Asia/Ho_Chi_Minh");
    await expectRow(page, "acme", ACME);
    await expect(row(page, "acme").getByTestId("system-org-timezone")).toHaveText("Asia/Ho_Chi_Minh");

    await expect(row(page, "shared").getByTestId("system-org-shared")).toBeVisible();
    await expect(row(page, "shared").getByTestId("system-org-edit")).toHaveCount(0);
    await expect(row(page, "acme").getByTestId("system-org-edit")).toBeVisible();
    await expect(row(page, "acme").getByTestId("system-org-shared")).toHaveCount(0);

    await expect(page.getByTestId("system-signout")).toBeVisible();
    await expect(page.getByTestId("system-signed-in-email")).toHaveText(OPS);
  });

  test("AC-10: creating an org from the panel", async ({ page }) => {
    await page.getByTestId("system-org-new").click();
    const form = page.getByTestId("system-org-create-form");
    await expect(form).toBeVisible();
    await expect(page.getByTestId("system-org-create-timezone")).toHaveValue("Asia/Ho_Chi_Minh");

    await page.getByTestId("system-org-create-code").fill("globex");
    await page.getByTestId("system-org-create-name").fill("Globex");
    await page.getByTestId("system-org-create-submit").click();

    await expect(form).toHaveCount(0);
    const rows = page.getByTestId("system-org-row");
    await expect(rows).toHaveCount(3);
    await expect(rows.nth(1)).toHaveAttribute("data-org-code", "acme");
    await expect(rows.nth(2)).toHaveAttribute("data-org-code", "globex");
    await expectRow(page, "globex", { name: "Globex", maxMembers: NULL, maxTeams: NULL, plan: "free", licence: NULL });
    await expect(row(page, "globex").getByTestId("system-org-edit")).toBeVisible();
  });

  test("AC-11: a refused create stays on the form", async ({ page }) => {
    await page.getByTestId("system-org-new").click();
    const form = page.getByTestId("system-org-create-form");

    await page.getByTestId("system-org-create-code").fill("acme");
    await page.getByTestId("system-org-create-name").fill("Another Acme");
    await page.getByTestId("system-org-create-submit").click();
    await expect(page.getByTestId("system-org-create-error")).toBeVisible();
    await expect(form).toBeVisible();
    await expect(row(page, "acme")).toHaveCount(1);

    await page.getByTestId("system-org-create-code").fill("admin");
    await page.getByTestId("system-org-create-submit").click();
    await expect(page.getByTestId("system-org-create-error")).toBeVisible();
    await expect(form).toBeVisible();
    await expect(row(page, "admin")).toHaveCount(0);

    await page.getByTestId("system-org-create-cancel").click();
    await expect(form).toHaveCount(0);
    await expect(page.getByTestId("system-org-row")).toHaveCount(2);
  });

  test("AC-12: editing an org from the panel", async ({ page }) => {
    await row(page, "acme").getByTestId("system-org-edit").click();
    const form = page.getByTestId("system-org-edit-form");
    await expect(form).toBeVisible();
    const code = page.getByTestId("system-org-edit-code");
    await expect(code).toHaveText("acme");
    expect(await code.evaluate((el) => el.tagName)).not.toBe("INPUT");
    await expect(page.getByTestId("system-org-edit-name")).toHaveValue("Acme Studio");
    await expect(page.getByTestId("system-org-edit-max-members")).toHaveValue("30");
    await expect(page.getByTestId("system-org-edit-max-teams")).toHaveValue("3");
    await expect(page.getByTestId("system-org-edit-plan")).toHaveValue("free");
    await expect(page.getByTestId("system-org-edit-licence")).toHaveValue("2027-06-30");

    await page.getByTestId("system-org-edit-name").fill("Acme Works");
    await page.getByTestId("system-org-edit-max-members").fill("40");
    await page.getByTestId("system-org-edit-max-teams").fill("");
    await page.getByTestId("system-org-edit-plan").fill("pro");
    await page.getByTestId("system-org-edit-licence").fill("2028-01-31");
    await page.getByTestId("system-org-edit-submit").click();

    await expect(form).toHaveCount(0);
    await expectRow(page, "acme", { name: "Acme Works", maxMembers: "40", maxTeams: NULL, plan: "pro", licence: "2028-01-31" });
  });

  test("AC-13: a refused edit stays on the form and changes nothing", async ({ page }) => {
    const form = page.getByTestId("system-org-edit-form");

    // Members cap 0 — sent, and refused by the seam.
    await row(page, "acme").getByTestId("system-org-edit").click();
    await page.getByTestId("system-org-edit-max-members").fill("0");
    await page.getByTestId("system-org-edit-submit").click();
    await expect(page.getByTestId("system-org-edit-error")).toBeVisible();
    await expect(form).toBeVisible();
    await page.getByTestId("system-org-edit-cancel").click();
    await expect(form).toHaveCount(0);
    await expectRow(page, "acme", ACME);

    // A blank plan.
    await row(page, "acme").getByTestId("system-org-edit").click();
    await page.getByTestId("system-org-edit-plan").fill("   ");
    await page.getByTestId("system-org-edit-submit").click();
    await expect(page.getByTestId("system-org-edit-error")).toBeVisible();
    await expect(form).toBeVisible();
    await page.getByTestId("system-org-edit-cancel").click();
    await expectRow(page, "acme", ACME);

    // Members cap 2.5 — refused in the panel, nothing sent.
    await row(page, "acme").getByTestId("system-org-edit").click();
    await page.getByTestId("system-org-edit-max-members").fill("2.5");
    await page.getByTestId("system-org-edit-submit").click();
    await expect(page.getByTestId("system-org-edit-error")).toBeVisible();
    await expect(form).toBeVisible();
    await page.getByTestId("system-org-edit-cancel").click();
    await expectRow(page, "acme", ACME);
  });
});

test("AC-14: the member app does not carry org management", async ({ page, request }) => {
  await page.goto("/");
  const urls = await page.evaluate(() =>
    [
      ...Array.from(document.querySelectorAll<HTMLScriptElement>("script[src]"), (el) => el.src),
      ...Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel="modulepreload"]'),
        (el) => el.href,
      ),
    ].filter(Boolean),
  );
  expect(urls.length).toBeGreaterThan(0);
  for (const url of urls) {
    const body = await (await request.get(url)).text();
    expect(body, `${url} carries org management`).not.toContain("system-org-new");
  }
});
