import { expect, test, type Locator, type Page } from "@playwright/test";
import { pickRange } from "./support/entry-form";

// MIR-14-b — each worklist row names its owner and shows the teams the entry affects.
//
// Written from 01-plan.md §§ 2, 2b, 4.5 and 4.6: AC-10 to AC-13. The new selectors are
// `pending-entry-row-teams` and `pending-entry-row-team`; every other one is ADM-04's, CAL-01's or
// TEA-05's, used as tests/e2e/adm-04-worklist.spec.ts uses them.
//
// **THE MOCK SEAM IS ONE TEAM PER MEMBER**, so every row here shows one team. The multi-team half —
// two teams on one row, a second-team decider, a left team — is the datastore's and is proven in
// supabase/tests/180-entry-owners.test.sql (AC-1 to AC-7).
//
// **AC-11 AND AC-13 NEED A READ THAT FAILS OR NAMES NOBODY, AND THE MOCK ANSWERS NEITHER WAY.** Its
// `listPendingEntries` and `listEntryOwners` admit exactly the same owners, and nothing in it fails.
// So the served bundle is rewritten in flight (`withOwnerHook`): one guard is put at the top of
// `listEntryOwners`, reading `globalThis.__mir14b`. In `pass` mode it only records the ids it was
// asked for (AC-12); `empty` makes it name nobody (AC-11); `throw` makes it fail (AC-13). Nothing in
// `src/` carries a test hook — the rewrite lives here and only here.
//
// **AC-11's PRECONDITION IS A REMOVED OWNER, AND THE MOCK NEVER LISTS ONE** (`memberTeamId` is null
// for a removed member, so `entry_select_team`'s copy admits none of their entries). What `empty`
// reproduces is the branch AC-11 is about: an owner the roster names and `listEntryOwners` does not.
//
// EACH TEST GETS FRESH MOCK STATE; THE SESSION IS SWITCHED BY SIGNING OUT, never by a document load —
// the constraint every suite from CAL-01 on records.

const PASSWORD = "password123";
const ADMIN_EMAIL = "quan@example.com";
const MEMBER_EMAIL = "thanh@example.com";
const APPROVED_EMAIL = "linh@example.com";

const WORKLIST = "/entries/pending";

// Transcribed rather than imported: the acceptance suite addresses the application through the
// browser and does not import from src/.
const TEAM_ID = "11111111-1111-4111-8111-111111111111";
const TEAM_NAME = "CaleChip";
const MEMBER_ID = "55555555-5555-4555-8555-555555555555";
const MEMBER_NAME = "Thành viên";
const APPROVED_MEMBER_ID = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const APPROVED_NAME = "Đã duyệt";
const PAGE_SIZE = 50;

const UPCOMING = { start: "2030-03-04", end: "2030-03-06" };

type HookMode = "pass" | "empty" | "throw";

const rows = (page: Page): Locator => page.getByTestId("pending-entry-row");

const rowFor = (page: Page, startDate: string): Locator =>
  page.locator(`[data-testid="pending-entry-row"][data-start-date="${startDate}"]`);

/** The first `n` weekdays from `start`, as `yyyy-MM-dd`. The form disables weekend days. UTC
 *  arithmetic, as entry-form.ts. */
function weekdays(start: string, n: number): string[] {
  const out: string[] = [];
  for (let ms = Date.parse(`${start}T00:00:00Z`); out.length < n; ms += 86_400_000) {
    const day = new Date(ms);
    if (day.getUTCDay() !== 0 && day.getUTCDay() !== 6) out.push(day.toISOString().slice(0, 10));
  }
  return out;
}

/**
 * Serves the app with one guard at the top of `listEntryOwners`. The method keeps its name through
 * minification (it is an object key), and the mock build tree-shakes the supabase seam, so the
 * pattern matches exactly once — asserted, so a build that stops matching fails loudly here rather
 * than letting AC-11 and AC-13 pass for the wrong reason.
 */
async function withOwnerHook(page: Page, mode: HookMode): Promise<void> {
  await page.addInitScript((initial) => {
    (globalThis as unknown as { __mir14b: unknown }).__mir14b = { mode: initial, calls: [] };
  }, mode);

  await page.route(/\/assets\/.*\.js$/, async (route) => {
    const response = await route.fetch();
    const source = await response.text();
    const pattern = /async listEntryOwners\((\w+)\)\{/g;
    const matches = source.match(pattern) ?? [];
    if (matches.length === 0) {
      await route.fulfill({ response, body: source });
      return;
    }
    expect(matches, "listEntryOwners appears once in the mock bundle").toHaveLength(1);
    const body = source.replace(
      pattern,
      (_, arg: string) =>
        `async listEntryOwners(${arg}){{const __h=globalThis.__mir14b;if(__h){__h.calls.push([...${arg}]);` +
        `if(__h.mode==="throw")throw Error("MIR-14-b injected failure");if(__h.mode==="empty")return[]}}`,
    );
    await route.fulfill({ response, body });
  });
}

async function setHook(page: Page, mode: HookMode): Promise<void> {
  await page.evaluate((next) => {
    (globalThis as unknown as { __mir14b: { mode: string } }).__mir14b.mode = next;
  }, mode);
}

async function hookCalls(page: Page): Promise<string[][]> {
  return page.evaluate(
    () => (globalThis as unknown as { __mir14b: { calls: string[][] } }).__mir14b.calls,
  );
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
}

async function signInAt(page: Page, email: string): Promise<void> {
  await page.goto(WORKLIST);
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await signIn(page, email);
}

async function switchTo(page: Page, email: string): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await signIn(page, email);
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** Declares one entry through CAL-01's form, from Home, and returns to Home. */
async function declare(page: Page, range: { start: string; end: string }, owned: number): Promise<void> {
  await page.getByTestId("home-new-entry-link").click();
  await pickRange(page, "new-entry", range.start, range.end);
  await page.getByTestId("new-entry-submit").click();
  await expect(page.getByTestId("own-entry-row")).toHaveCount(owned);
  await page.goBack();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

async function openWorklist(page: Page): Promise<void> {
  await page.getByTestId("shell-admin-link").click();
  await page.getByTestId("admin-hub-pending-link").click();
}

/** The row names `name` and shows exactly one team, this team. */
async function expectNamedWithTeam(row: Locator, name: string): Promise<void> {
  await expect(row.getByTestId("pending-entry-row-member")).toHaveText(name);
  await expect(row.getByTestId("pending-entry-row-teams")).toHaveAttribute("data-team-ids", TEAM_ID);
  await expect(row.getByTestId("pending-entry-row-team")).toHaveCount(1);
  await expect(row.getByTestId("pending-entry-row-team")).toHaveAttribute("data-team-id", TEAM_ID);
  await expect(row.getByTestId("pending-entry-row-team")).toHaveText(TEAM_NAME);
}

test.describe("MIR-14-b — the worklist names each owner and the teams an entry affects", () => {
  test("AC-10: a row names its owner and shows one pill per team the entry affects", async ({ page }) => {
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    await expect(rows(page)).toHaveCount(1);
    const row = rowFor(page, UPCOMING.start);
    await expect(row).toHaveAttribute("data-member-id", MEMBER_ID);
    await expectNamedWithTeam(row, MEMBER_NAME);
  });

  test("AC-11: an owner the read does not name keeps the roster's name and has no teams line", async ({
    page,
  }) => {
    await withOwnerHook(page, "empty");
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    const row = rowFor(page, UPCOMING.start);
    await expect(row.getByTestId("pending-entry-row-member")).toHaveText(MEMBER_NAME);
    await expect(row.getByTestId("pending-entry-row-teams")).toHaveCount(0);
    expect(await hookCalls(page)).toContainEqual([MEMBER_ID]);
  });

  test("AC-13, first load: a failed owner read fails the screen and draws no partial list", async ({
    page,
  }) => {
    await withOwnerHook(page, "throw");
    await signInAt(page, MEMBER_EMAIL);
    await declare(page, UPCOMING, 1);
    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);

    await expect(page.getByTestId("pending-entries-unavailable")).toBeVisible();
    await expect(page.getByTestId("pending-entries")).toHaveCount(0);
    await expect(rows(page)).toHaveCount(0);
  });

  test("AC-12 and AC-13, load more: appended rows are named, only new owners are read, a failure keeps the list", async ({
    page,
  }) => {
    // Fifty-one entries through the form: a page and one. About ten seconds — paging cannot be shown on
    // fewer, and the mock has no other writer.
    test.setTimeout(120_000);
    await withOwnerHook(page, "pass");

    const all = weekdays("2027-01-04", PAGE_SIZE + 1);
    const memberDays = all.slice(0, PAGE_SIZE);
    const firstDay = all[0] as string;
    const lastDay = all[PAGE_SIZE] as string;

    await signInAt(page, MEMBER_EMAIL);
    for (const [i, day] of memberDays.entries()) {
      await declare(page, { start: day, end: day }, i + 1);
    }
    // The 51st row by start date belongs to a second owner, so the next page has an owner the first
    // did not. linh already owns FIXTURE_APPROVED_ENTRY, so this is their second entry.
    await switchTo(page, APPROVED_EMAIL);
    await declare(page, { start: lastDay, end: lastDay }, 2);

    await switchTo(page, ADMIN_EMAIL);
    await openWorklist(page);
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    await expectNamedWithTeam(rowFor(page, firstDay), MEMBER_NAME);
    expect(await hookCalls(page)).toEqual([[MEMBER_ID]]);

    // AC-13, load more. The rows on screen stay, and the control comes back.
    await setHook(page, "throw");
    await page.getByTestId("pending-entries-more").click();
    await expect(page.getByTestId("pending-entries-more")).toBeEnabled();
    await expect(rows(page)).toHaveCount(PAGE_SIZE);
    await expect(page.getByTestId("pending-entries-unavailable")).toHaveCount(0);

    // AC-12. Pressed again with the read restored: the appended row is named, carries its team, and
    // the read was asked only for the owner it had not resolved.
    await setHook(page, "pass");
    await page.getByTestId("pending-entries-more").click();
    await expect(rows(page)).toHaveCount(PAGE_SIZE + 1);
    const appended = rowFor(page, lastDay);
    await expect(appended).toHaveAttribute("data-member-id", APPROVED_MEMBER_ID);
    await expectNamedWithTeam(appended, APPROVED_NAME);
    expect(await hookCalls(page)).toEqual([[MEMBER_ID], [APPROVED_MEMBER_ID], [APPROVED_MEMBER_ID]]);
  });
});
