import { expect, test, type Page } from "@playwright/test";

// SOLO, 2026-09-26 — a member reports an issue from the bubble; an admin reads the reports.
//
// **THIS WORK CARRIED NO TICKET AND NO ACCEPTANCE CRITERIA**, so the numbering below is local to
// this file and was deliberately NOT `AC-n`. What authorised it is `.claude/agents/solo.md` and the
// operator's four answers of 2026-09-26, transcribed in
// `supabase/migrations/20260926100000_solo_issue_report.sql`'s header.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it, `tests/e2e/seam.setup.ts` refuses the run
// otherwise), so the refusals below are the mock's reproduction of `issue_report_insert_own` and,
// historically, `issue_report_select_admin` and `issue_report_update_admin` rather than a second
// story about them.
//
// **MIR-17, ADR-088 — `issue_report_select_admin` AND `issue_report_update_admin` ARE GONE**
// (`20261107210000_mir16_issue_reports_system_scope.sql`). Only a system admin at `aal2` reads or
// triages a report now (ADR-082 decision 1), so the tests that used to read the admin's list and mark
// a report done are gone with the screen they exercised. What is left of that reading journey is
// numbered `MIR-17 AC-n`, because a plan document now states those criteria; the sending journey
// below keeps its own local numbers, because nothing here changed what authorises it.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";

/** `src/routes/IssueReports.tsx`'s one sentence, letter for letter — AC-3 of `01-plan.md`. */
const REPORTS_MOVED_NOTICE =
  "Reports are read by the CaleChip team, not by your organisation’s admins.";

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

test.describe("SOLO — report an issue", () => {
  test("1: the bubble is on every page a signed-in member can reach", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);

    // **THE WHOLE POINT OF MOUNTING IT IN `AppShell` RATHER THAN PER SCREEN**, asserted by walking
    // the addresses rather than by reading the component: a bubble that had been added to one screen
    // at a time would pass on the first of these and fail on the rest.
    for (const address of ["/", "/week", "/month", "/year", "/profile"]) {
      await page.goto(address);
      await expect(page.getByTestId("report-issue-bubble")).toBeVisible();
    }
  });

  test("2: it is NOT on the sign-in screen, which has no author to attribute a report to", async ({
    page,
  }) => {
    await page.goto("/signin");
    await expect(page.getByTestId("sign-in-submit")).toBeVisible();

    // `issue_report.member_id` is `not null` and the policy compares it with `auth.uid()`, so a
    // signed-out report has nowhere to go. `/signin` is outside the shell, which is what makes the
    // absence structural rather than a condition somebody has to maintain.
    await expect(page.getByTestId("report-issue-bubble")).toHaveCount(0);
  });

  test("3: a member sends a report, and a blank one is refused with a sentence", async ({
    page,
  }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.goto("/month");
    await page.getByTestId("report-issue-bubble").click();

    // The page is filled in by the router and not by the person — the one field on the report
    // nobody has to type, and the reason the operator's field set includes it.
    //
    // **A PATTERN AND NOT `"/month"`, AND THE FIRST RUN OF THIS TEST IS WHY.** `/month` resolves to
    // `/month/2026-09`: the screen puts the displayed month in the address, so what the bubble reads
    // from `useLocation()` is the RESOLVED path. That is the more useful value — an admin reading
    // *"the month grid is empty"* learns which month — and a literal here would also have gone stale
    // on the first of next month.
    await expect(page.getByTestId("report-issue-page")).toHaveAttribute(
      "data-page",
      /^\/month\/\d{4}-\d{2}$/,
    );

    // `other` is the default the form opens on: a required category with no escape makes somebody
    // mis-file a report in order to send it.
    await expect(page.getByTestId("report-issue-kind-other")).toHaveAttribute(
      "data-selected",
      "true",
    );

    // THE REFUSAL FIRST, because the send button is deliberately NOT disabled on an empty message:
    // a dead control says nothing about why, and the seam has a sentence.
    await page.getByTestId("report-issue-send").click();
    const error = page.getByTestId("report-issue-error");
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute("data-code", "invalid_issue_message");
    await expect(page.getByTestId("report-issue-sent")).toHaveCount(0);

    // And then the real one. Choosing a kind and typing clears the refusal, which is what stops a
    // stale message reading as a second, fresh failure.
    await page.getByTestId("report-issue-kind-bug").click();
    await page.getByTestId("report-issue-message").fill("The month grid is empty after I pick a day.");
    await expect(error).toHaveCount(0);

    await page.getByTestId("report-issue-send").click();
    const sent = page.getByTestId("report-issue-sent");
    await expect(sent).toBeVisible();
    // AC-5. Nothing here still mentions an admin or the reports page — the sender is told who
    // actually reads it instead.
    await expect(sent).toContainText("Thanks — the CaleChip team will see this.");
  });

  test("MIR-17 AC-1 — Quan's strip has no Reports tab, and no reports badge", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.getByTestId("shell-admin-link").click();

    await expect(page.getByTestId("admin-hub-reports-link")).toHaveCount(0);
    await expect(page.getByTestId("admin-hub-reports-link-badge")).toHaveCount(0);
  });

  test("MIR-17 AC-3 — Quan opens `/reports` and is told where reports go now", async ({ page }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.goto("/reports");

    const notice = page.getByTestId("issue-reports-moved");
    await expect(notice).toHaveText(REPORTS_MOVED_NOTICE);
    // No list, no `Mark done` control and no image — AC-3's own words. Scoped to the notice itself
    // and not the whole page, which also carries the shell's own avatar images.
    await expect(page.getByTestId("reports")).toHaveCount(0);
    await expect(page.getByTestId("report-row-toggle")).toHaveCount(0);
    await expect(notice.locator("img")).toHaveCount(0);
  });

  // -------------------------------------------------------------------------
  // SOLO, 2026-09-26 (second run) — the icon, the tooltip, the attachments and the tab badge.
  // -------------------------------------------------------------------------

  test("7: hovering the button says what it is, and focusing it says the same", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);

    const tooltip = page.getByTestId("report-issue-tooltip");
    // **IT IS IN THE DOM AT ZERO OPACITY RATHER THAN ABSENT**, which is what `toBeVisible` cannot
    // tell apart — Playwright counts an `opacity: 0` element as visible. So the assertion is on the
    // computed opacity, which is the thing a person actually experiences.
    await expect(tooltip).toHaveText("Report an issue");
    await expect(tooltip).toHaveCSS("opacity", "0");

    await page.getByTestId("report-issue-bubble").hover();
    await expect(tooltip).toHaveCSS("opacity", "1");

    // AND BY KEYBOARD, which is the half `title` never did: an unstyleable native tooltip appears on
    // hover and on nothing else, so a keyboard user was told nothing at all.
    await page.mouse.move(0, 0);
    await expect(tooltip).toHaveCSS("opacity", "0");
    await page.getByTestId("report-issue-bubble").focus();
    await expect(tooltip).toHaveCSS("opacity", "1");
  });

  test("8: a member attaches images, removes one, and sends the rest", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.getByTestId("report-issue-bubble").click();

    // Optional, so the form opens with none and the counter says so.
    await expect(page.getByTestId("report-issue-image-count")).toHaveAttribute("data-count", "0");

    // A one-pixel PNG, built here rather than committed: a binary fixture in the repository would be
    // a file nobody can review in a diff, for a test that needs only *a valid PNG of some size*.
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    const input = page.getByTestId("report-issue-images");
    await input.setInputFiles([
      { name: "one.png", mimeType: "image/png", buffer: png },
      { name: "two.png", mimeType: "image/png", buffer: png },
    ]);

    await expect(page.getByTestId("report-issue-image-row")).toHaveCount(2);
    await expect(page.getByTestId("report-issue-image-count")).toHaveAttribute("data-count", "2");

    // **A SECOND VISIT TO THE PICKER APPENDS RATHER THAN REPLACES.** A file input reports only what
    // was chosen this time, so the obvious implementation silently drops what was picked a moment
    // ago — the failure mode this assertion exists to catch.
    await input.setInputFiles([{ name: "three.png", mimeType: "image/png", buffer: png }]);
    await expect(page.getByTestId("report-issue-image-row")).toHaveCount(3);

    await page.getByTestId("report-issue-image-remove").first().click();
    await expect(page.getByTestId("report-issue-image-row")).toHaveCount(2);

    await page.getByTestId("report-issue-message").fill("Two screenshots of the empty grid.");
    await page.getByTestId("report-issue-send").click();
    await expect(page.getByTestId("report-issue-sent")).toBeVisible();
  });

  test("9: a fourth image is refused with a sentence, and nothing is sent", async ({ page }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.getByTestId("report-issue-bubble").click();

    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    await page
      .getByTestId("report-issue-images")
      .setInputFiles(
        ["a", "b", "c", "d"].map((n) => ({ name: `${n}.png`, mimeType: "image/png", buffer: png })),
      );

    await page.getByTestId("report-issue-message").fill("Four pictures.");
    await page.getByTestId("report-issue-send").click();

    const error = page.getByTestId("report-issue-error");
    await expect(error).toBeVisible();
    await expect(error).toHaveAttribute("data-code", "invalid_issue_image");
    // The dialog stays open on its form, with everything the person typed still in it.
    await expect(page.getByTestId("report-issue-sent")).toHaveCount(0);
    await expect(page.getByTestId("report-issue-message")).toHaveValue("Four pictures.");
  });

  // Test 10, "the Reports tab carries the number not yet done...", stood here. MIR-17, ADR-088 — it
  // is replaced by "MIR-17 AC-1" above, since both the tab and its badge it exercised are gone.

  test("12: the New sign-ups tab carries its own queue's number, and loses it when the queue empties", async ({
    page,
  }) => {
    await signIn(page, ADMIN_EMAIL);
    await page.getByTestId("shell-admin-link").click();

    // `FIXTURE_PENDING_SIGNUP` is seeded waiting, so the strip says one before the admin has opened
    // the screen — which is the whole point of putting the number on the tab.
    const badge = page.getByTestId("admin-hub-allow-list-link-badge");
    await expect(badge).toHaveAttribute("data-count", "1");

    await page.getByTestId("admin-hub-allow-list-link").click();
    await page.getByTestId("signup-row-approve").first().click();

    // Decided, so the queue is empty and the badge goes. `0` IS NOT DRAWN — a grey zero on a tab is
    // noise people learn to stop reading, which costs the badge its meaning on the day it matters.
    await expect(page.getByTestId("signups-empty")).toBeVisible();
    await expect(badge).toHaveCount(0);

    // MIR-17, ADR-088 removed the reports badge this line used to check was untouched by a decision
    // that had nothing to do with it — "MIR-17 AC-1" above is now the standing assertion that it is
    // gone rather than merely unaffected.
  });

  test("11: an ordinary member is offered neither the tab nor its badge", async ({ page }) => {
    // **AN ORDINARY MEMBER AND NOT A MANAGER, WHICH IS WEAKER THAN IT LOOKS AND IS SAID SO.** A
    // member gets no strip at all — `AdminLayout` draws it only for `mayDecide(role)` — so this
    // passes one step before the interesting one. The manager case is that the strip IS drawn, with
    // one tab, and `Reports` is not among them; the seeded accounts include no manager, and
    // promoting one through the interface to assert it here would make this spec depend on
    // `/members`. `tests/issue-reports.test.ts` covers the rank at the seam instead — a manager is
    // answered an empty list and a count of zero — and `ADMIN_TABS` carries `forManager: false` on
    // this tab, which `tests/e2e/solo-admin-tabs.spec.ts` reads off the rendered strip.
    await signIn(page, MEMBER_EMAIL);
    await page.goto("/entries/pending");

    await expect(page.getByTestId("admin-hub-reports-link")).toHaveCount(0);
    await expect(page.getByTestId("admin-hub-reports-link-badge")).toHaveCount(0);
  });

  // Test 6, "a member who types the address is refused by the screen", stood here: `/reports` used
  // to draw a `reports-refused` card for a member. **MIR-17, ADR-088 — IT IS NO LONGER A REFUSAL.**
  // The screen reads nothing and refuses nobody now, so Thanh is told the same sentence Quan is.
  test("MIR-17 AC-3 — Thanh opens `/reports` and is told where reports go, not refused", async ({
    page,
  }) => {
    await signIn(page, MEMBER_EMAIL);
    await page.goto("/reports");

    await expect(page.getByTestId("issue-reports-moved")).toHaveText(REPORTS_MOVED_NOTICE);
    await expect(page.getByTestId("reports-refused")).toHaveCount(0);
    await expect(page.getByTestId("reports")).toHaveCount(0);

    // The tab is still absent for them too, as it always was.
    await expect(page.getByTestId("admin-hub-reports-link")).toHaveCount(0);
  });
});
