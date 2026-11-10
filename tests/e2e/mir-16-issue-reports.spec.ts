import { expect, test, type Locator, type Page } from "@playwright/test";

// MIR-16 AC-7 to AC-11 — issue reports move to the system panel (01-plan.md §§ 2b, 4.5, 4.6;
// ADR-082).
//
// Runs against the mock build, signed in as mir-18-b-org-management.spec.ts:15-23 does: "signed in"
// is ops@calechip.test, password `calechip-demo`, then code `246810`.
//
// **THE MOCK STORE'S ONE SEEDED REPORT (src/lib/fixtures.ts:587, FIXTURE_ISSUE_REPORT) IS REPLACED,
// NOT APPENDED TO, BEFORE ANY TEST'S SIGNED-IN SCREEN LOADS.** `window.__setMockIssueReports`
// (`src/system/main.tsx`, exposed the way `src/main.tsx` exposes the member app's whole seam to
// `window.__calechipMockSeam`) is called through `page.evaluate` right after `page.goto` and before
// signing in — before the `IssueReports` section ever mounts and reads the store, so the seeding
// never races its first read. 01-plan.md § 4.6 says "a page init script"; this reaches the same
// place one step later, through the one hook the contract (§ 4.4) names, rather than inventing a
// second global for `addInitScript` to hand off through — a deviation recorded in 03-impl-log.md.
//
// EACH TEST GETS FRESH MOCK STATE because `page.goto` reloads the module — the constraint every mock
// suite from CAL-01 on records.
//
// AC-11 needs a refusal the mock never produces on its own, so it uses the route-rewrite pattern
// `withOwnerHook` established in mir-14-b-worklist-teams.spec.ts:65-94: the served bundle is
// rewritten in flight, with one guard at the top of `setIssueReportStatus` reading a global the test
// sets before navigating. Nothing in `src/` carries a test hook for this; the rewrite lives here only.

const PANEL = "/system.html";
const OPS = "ops@calechip.test";

interface SeedReport {
  id: string;
  orgId: string;
  orgName: string;
  memberId: string;
  memberName: string | null;
  kind: "bug" | "idea" | "other";
  message: string;
  page: string;
  status: "open" | "done";
  createdAt: string;
  images: string[];
}

const REPORT_OLDER: SeedReport = {
  id: "d1600000-0000-4000-8000-000000000001",
  orgId: "00000000-0000-4000-8000-00000000c000",
  orgName: "Org public",
  memberId: "55555555-5555-4555-8555-555555555555",
  memberName: "Thanh",
  kind: "bug",
  message: "The week view does not show the swapped-in working day.",
  page: "/week",
  status: "open",
  createdAt: "2026-11-01T02:30:00.000Z",
  images: [],
};

const REPORT_NEWER: SeedReport = {
  id: "d1600000-0000-4000-8000-000000000002",
  orgId: "00000000-0000-4000-8000-00000000c001",
  orgName: "Acme Studio",
  memberId: "66666666-6666-4666-8666-666666666666",
  memberName: "Dan",
  kind: "idea",
  message: "An icon on the report button would help people find it.",
  page: "/month",
  status: "open",
  createdAt: "2026-11-02T02:30:00.000Z",
  images: [],
};

const REPORT_WITH_IMAGES: SeedReport = {
  ...REPORT_NEWER,
  id: "d1600000-0000-4000-8000-000000000003",
  images: [
    "66666666-6666-4666-8666-666666666666/1.png",
    "66666666-6666-4666-8666-666666666666/2.png",
  ],
};

const REPORT_REMOVED_AUTHOR: SeedReport = {
  ...REPORT_OLDER,
  id: "d1600000-0000-4000-8000-000000000004",
  memberName: null,
};

/** Seeds the mock's whole issue-report store before any sign-in, so `IssueReports`'s first read sees
 *  exactly these rows. Must be called before `signInVerified`. */
async function seedReports(page: Page, reports: SeedReport[]): Promise<void> {
  await page.goto(PANEL);
  await page.evaluate((rows) => {
    window.__setMockIssueReports!(rows);
  }, reports);
}

async function signInVerified(page: Page): Promise<void> {
  await page.getByTestId("system-signin-email").fill(OPS);
  await page.getByTestId("system-signin-password").fill("calechip-demo");
  await page.getByTestId("system-signin-submit").click();
  await page.getByTestId("system-code-input").fill("246810");
  await page.getByTestId("system-code-submit").click();
  await expect(page.getByTestId("system-issues")).toBeVisible();
}

function rowFor(page: Page, id: string): Locator {
  return page.locator(`[data-testid="system-issue-row"][data-id="${id}"]`);
}

/**
 * Rewrites the served bundle's `setIssueReportStatus` so it refuses unconditionally, the pattern
 * mir-14-b-worklist-teams.spec.ts:65-94 established for `listEntryOwners`. Must be called before
 * `page.goto` (here, before `seedReports`).
 */
async function withStatusRefusalHook(page: Page): Promise<void> {
  await page.route(/\/assets\/.*\.js$/, async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const pattern = /async setIssueReportStatus\((\w+),\s*(\w+)\)\{/g;
    const matches = source.match(pattern) ?? [];
    if (matches.length === 0) {
      await route.fulfill({ response, body: source });
      return;
    }
    expect(matches, "setIssueReportStatus appears once in the mock bundle").toHaveLength(1);
    const body = source.replace(
      pattern,
      (_, idArg: string, statusArg: string) =>
        `async setIssueReportStatus(${idArg},${statusArg}){return{ok:false,error:{` +
        `code:"not_permitted",message:"You do not have permission to do that."}};`,
    );
    await route.fulfill({ response, body });
  });
}

test("AC-7: the panel shows the reports, newest first, with every field", async ({ page }) => {
  await seedReports(page, [REPORT_OLDER, REPORT_NEWER]);
  await signInVerified(page);

  const rows = page.getByTestId("system-issue-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0)).toHaveAttribute("data-id", REPORT_NEWER.id);
  await expect(rows.nth(1)).toHaveAttribute("data-id", REPORT_OLDER.id);

  const row = rowFor(page, REPORT_OLDER.id);
  await expect(row.getByTestId("system-issue-row-date")).toHaveText(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  await expect(row.getByTestId("system-issue-row-org")).toHaveText(REPORT_OLDER.orgName);
  await expect(row.getByTestId("system-issue-row-author")).toHaveText("Thanh");
  await expect(row.getByTestId("system-issue-row-kind")).toHaveText("Bug");
  await expect(row.getByTestId("system-issue-row-page")).toHaveText(REPORT_OLDER.page);
  await expect(row.getByTestId("system-issue-row-status")).toHaveText("Open");
  await expect(row.getByTestId("system-issue-row-message")).toHaveText(REPORT_OLDER.message);
  await expect(row.getByTestId("system-issue-row-toggle")).toHaveText("Mark done");

  await expect(page.getByTestId("system-issues-open-count")).toHaveText("2 open");
  await expect(page.getByTestId("system-issues-open-count")).toHaveAttribute("data-count", "2");

  const other = rowFor(page, REPORT_NEWER.id);
  await expect(other.getByTestId("system-issue-row-kind")).toHaveText("Idea");

  await expect(rowFor(page, REPORT_REMOVED_AUTHOR.id)).toHaveCount(0);
});

test("AC-7b: an author whose member row is gone shows as Removed member", async ({ page }) => {
  await seedReports(page, [REPORT_REMOVED_AUTHOR]);
  await signInVerified(page);
  await expect(rowFor(page, REPORT_REMOVED_AUTHOR.id).getByTestId("system-issue-row-author")).toHaveText(
    "Removed member",
  );
});

test("AC-8: the panel says when there are none", async ({ page }) => {
  await seedReports(page, []);
  await signInVerified(page);
  await expect(page.getByTestId("system-issues-empty")).toHaveText("No issue reports.");
  await expect(page.getByTestId("system-issue-row")).toHaveCount(0);
  await expect(page.getByTestId("system-issues-open-count")).toHaveText("0 open");
});

test("AC-9: the panel marks a report done, and open again", async ({ page }) => {
  await seedReports(page, [REPORT_OLDER]);
  await signInVerified(page);

  const row = rowFor(page, REPORT_OLDER.id);
  await row.getByTestId("system-issue-row-toggle").click();
  await expect(row).toHaveAttribute("data-status", "done");
  await expect(row.getByTestId("system-issue-row-status")).toHaveText("Done");
  await expect(row.getByTestId("system-issue-row-toggle")).toHaveText("Reopen");
  await expect(page.getByTestId("system-issues-open-count")).toHaveText("0 open");

  await row.getByTestId("system-issue-row-toggle").click();
  await expect(row).toHaveAttribute("data-status", "open");
  await expect(row.getByTestId("system-issue-row-status")).toHaveText("Open");
  await expect(row.getByTestId("system-issue-row-toggle")).toHaveText("Mark done");
  await expect(page.getByTestId("system-issues-open-count")).toHaveText("1 open");
});

test("AC-10: the panel shows a report's images, one slot per path, in order", async ({ page }) => {
  await seedReports(page, [REPORT_WITH_IMAGES]);
  await signInVerified(page);

  const row = rowFor(page, REPORT_WITH_IMAGES.id);
  const slots = row.getByTestId("system-issue-row-image");
  await expect(slots).toHaveCount(REPORT_WITH_IMAGES.images.length);
  // The mock never mints a signed URL (01-plan.md § 4.4): every slot is the "could not be minted"
  // placeholder.
  for (let index = 0; index < REPORT_WITH_IMAGES.images.length; index += 1) {
    await expect(slots.nth(index)).toHaveText("Image unavailable");
  }

  await expect(rowFor(page, REPORT_NEWER.id).getByTestId("system-issue-row-image")).toHaveCount(0);
});

test("AC-11: the panel says when a status change was refused", async ({ page }) => {
  await withStatusRefusalHook(page);
  await seedReports(page, [REPORT_OLDER]);
  await signInVerified(page);

  const row = rowFor(page, REPORT_OLDER.id);
  await row.getByTestId("system-issue-row-toggle").click();

  await expect(row.getByTestId("system-issue-row-error")).toHaveText(
    "You do not have permission to do that.",
  );
  await expect(row).toHaveAttribute("data-status", "open");
  await expect(row.getByTestId("system-issue-row-status")).toHaveText("Open");
  await expect(row.getByTestId("system-issue-row-toggle")).toHaveText("Mark done");
});
