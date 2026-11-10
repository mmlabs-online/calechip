import { expect, test } from "@playwright/test";

// BUG-001. The guard that refuses the run, as distinct from the one that reports it.
//
// It reads the SERVED PAGE and nothing else — not `import.meta.env`, not `process.env`, not any
// value from playwright.config.ts. A guard that reads the configuration agrees with the
// configuration and proves nothing (plan AC-4), and there is one common case where all three
// disagree: `reuseExistingServer: !process.env.CI` is true on every developer machine, and
// playwright/lib/runner/index.js:845-849 returns before `launchProcess` when the URL already
// answers. A preview left running on 4173 from an unpinned build therefore skips the pin entirely,
// with no message, and the suite drives the live project while the config says `mock`.
//
// The assertion is real rather than cosmetic: `seam-banner` is constant-folded out of an unpinned
// bundle (measured — 1 occurrence pinned, 0 unpinned), so the served page is the only place the
// answer exists.
const EXPECTED_SEAM = "mock";

// The title is how the run records which seam it drove (plan AC-5). Playwright's reporter prints the
// project name and the test title on every run, passed or failed, so no extra reporter or artifact
// is needed for the report to name the datastore.
test(`the acceptance suite drives the "${EXPECTED_SEAM}" seam, and the served page says so`, async ({
  page,
}) => {
  await page.goto("/");

  const banner = page.getByTestId("seam-banner");
  await expect(
    banner,
    "no seam-banner on the served page: this build did not resolve to the in-memory seam, so the " +
      "run would exercise a real datastore. Refusing to start the suite.",
  ).toBeVisible();
  await expect(banner).toHaveAttribute("data-seam", EXPECTED_SEAM);
});
