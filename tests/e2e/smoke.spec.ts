import { expect, test } from "@playwright/test";

// A scaffold smoke test, and it earns its place for one reason: it exercises the selector contract
// end to end before any story depends on it. `data-testid` is named once in
// .ai/standards/testing-standards.md, and review check R7 verifies that every selector in design
// section 6 exists in the markup. This proves the channel works.
test("the application shell renders and is addressable by its test id", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByTestId("app-root")).toBeVisible();
});
