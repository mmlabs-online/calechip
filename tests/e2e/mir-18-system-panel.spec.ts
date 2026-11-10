import { expect, test, type Page } from "@playwright/test";

// MIR-18 AC-7 to AC-14 — the system panel's door, against the mock build (01-plan.md § 2, § 4.7).
//
// Every locator is a `data-testid` named in 01-plan.md § 4.5. Fixtures (§ 2's panel table): every
// account's password is `calechip-demo`; the one valid code is `246810`.
//   - root@calechip.test   — a system admin with no authenticator set up
//   - ops@calechip.test    — a system admin with an authenticator already set up
//   - member@calechip.test — an identity with no system-admin row

const PANEL = "/system.html";
const PASSWORD = "calechip-demo";
const CODE = "246810";
const ROOT = "root@calechip.test";
const OPS = "ops@calechip.test";
const MEMBER = "member@calechip.test";

async function signIn(page: Page, email: string, password: string): Promise<void> {
  await page.getByTestId("system-signin-email").fill(email);
  await page.getByTestId("system-signin-password").fill(password);
  await page.getByTestId("system-signin-submit").click();
}

async function submitCode(page: Page, code: string): Promise<void> {
  await page.getByTestId("system-code-input").fill(code);
  await page.getByTestId("system-code-submit").click();
}

test.describe("MIR-18 the system panel", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(PANEL);
  });

  test("AC-7: with no panel session the panel opens on its sign-in form", async ({ page }) => {
    const form = page.getByTestId("system-panel-root").getByTestId("system-signin-form");
    await expect(form).toBeVisible();
    await expect(form.getByTestId("system-signin-email")).toBeVisible();
    await expect(form.getByTestId("system-signin-password")).toBeVisible();
    await expect(form.getByTestId("system-signin-submit")).toBeVisible();
  });

  test("AC-8: the document asks not to be indexed", async ({ page }) => {
    const content = await page.locator('meta[name="robots"]').getAttribute("content");
    expect(content).toContain("noindex");
    expect(content).toContain("nofollow");
  });

  test("AC-9: a wrong password is refused on the form", async ({ page }) => {
    await signIn(page, ROOT, "not-the-password");
    await expect(page.getByTestId("system-signin-error")).toBeVisible();
    await expect(page.getByTestId("system-signin-form")).toBeVisible();
    await expect(page.getByTestId("system-code-input")).toHaveCount(0);
  });

  test("AC-10: an identity with no system-admin row is turned away before any code", async ({ page }) => {
    await signIn(page, MEMBER, PASSWORD);
    await expect(page.getByTestId("system-not-authorised")).toBeVisible();
    await expect(page.getByTestId("system-enrol")).toHaveCount(0);
    await expect(page.getByTestId("system-code-input")).toHaveCount(0);

    await page.getByTestId("system-not-authorised-back").click();
    await expect(page.getByTestId("system-signin-form")).toBeVisible();
  });

  test("AC-11: first sign-in sets up the authenticator", async ({ page }) => {
    await signIn(page, ROOT, PASSWORD);
    const enrol = page.getByTestId("system-enrol");
    await expect(enrol).toBeVisible();
    const qr = enrol.getByTestId("system-enrol-qr");
    await expect(qr).toBeVisible();
    expect(await qr.evaluate((el) => el.tagName)).toBe("IMG");
    expect(await qr.getAttribute("src")).toBeTruthy();
    await expect(enrol.getByTestId("system-enrol-secret")).not.toHaveText("");
    await expect(enrol.getByTestId("system-code-input")).toBeVisible();
    await expect(enrol.getByTestId("system-code-submit")).toBeVisible();

    await submitCode(page, "000000");
    await expect(page.getByTestId("system-code-error")).toBeVisible();
    await expect(enrol).toBeVisible();

    await submitCode(page, CODE);
    await expect(page.getByTestId("system-signed-in")).toBeVisible();
    await expect(page.getByTestId("system-signed-in-email")).toHaveText(ROOT);
  });

  test("AC-12: later sign-ins ask only for the code", async ({ page }) => {
    await signIn(page, OPS, PASSWORD);
    const verify = page.getByTestId("system-verify");
    await expect(verify).toBeVisible();
    await expect(verify.getByTestId("system-code-input")).toBeVisible();
    await expect(verify.getByTestId("system-code-submit")).toBeVisible();
    await expect(page.getByTestId("system-enrol-qr")).toHaveCount(0);

    await submitCode(page, CODE);
    await expect(page.getByTestId("system-signed-in")).toBeVisible();
    await expect(page.getByTestId("system-signed-in-email")).toHaveText(OPS);
  });

  test("AC-13: signing out returns to the form, from signed-in and from verify", async ({ page }) => {
    await signIn(page, OPS, PASSWORD);
    await submitCode(page, CODE);
    await expect(page.getByTestId("system-signed-in")).toBeVisible();
    await page.getByTestId("system-signout").click();
    await expect(page.getByTestId("system-signin-form")).toBeVisible();

    await signIn(page, OPS, PASSWORD);
    await expect(page.getByTestId("system-verify")).toBeVisible();
    await page.getByTestId("system-signout").click();
    await expect(page.getByTestId("system-signin-form")).toBeVisible();
  });
});

test("AC-14: the member app does not carry the panel", async ({ page, request }) => {
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
    expect(body, `${url} carries the panel`).not.toContain("system-signin-form");
  }
});
