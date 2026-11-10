import { expect, test, type Locator, type Page } from "@playwright/test";

// EVT-10 — a formatted description, and the sanitised render on both surfaces. 01-plan.md § 2
// AC-1..AC-9, § 4.4's selectors.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). AC-10, AC-11 and AC-12 are properties of a file
// or of the source tree, asserted in `tests/description-html.test.ts`; this file asserts what a
// person SEES, in a real browser, because that is where DOMPurify runs.
//
// **STRAIGHT TO THE DATASTORE** (AC-8, AC-9) is `window.__calechipMockSeam.updateEvent`, which
// `src/main.tsx` exposes in a mock build only (§ 4.5) — the call ADR-005 lets anyone holding a
// session make to the real API, without the form and its sanitise. It runs as whoever is signed in.
//
// **A `page.goto` RESETS THE MOCK'S TABLES**, as `evt-01-events.spec.ts` records. So every page after
// the first is reached client-side — the app's own links, or `navigate` below — never by `goto`.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER.

const PASSWORD = "password123";
const MEMBER = { email: "thanh@example.com" };

/** EVT-11. A 1×1 PNG: an embedded picture the sanitiser keeps. */
const VALID_PICTURE =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

/** 01-plan.md § 2, verbatim — and, since EVT-11, one valid picture at the end. */
const HOSTILE =
  '<h2 style="text-align: center">Title</h2><p>ok <strong>bold</strong></p><script>window.__xss=1</script><img src=x onerror="window.__xss=2"><img src="https://example.com/a.png"><a href="javascript:window.__xss=3">js</a><p onclick="window.__xss=4" style="text-align: center; background: url(https://example.com/b.png)">c</p><span style="color: #be123c; position: fixed">red</span><iframe src="https://example.com/"></iframe><h1>big</h1><style>body{display:none}</style><a href="https://example.com/x" id="clobber" class="x" data-x="1">ok link</a>' +
  // EVT-11 § 4.8. The one picture the allow-list now admits, carrying what it must not keep.
  `<img src="${VALID_PICTURE}" alt="" onerror="window.__xss=5" style="width: 9999px" width="9999">`;

declare global {
  interface Window {
    __xss?: unknown;
  }
}

async function signIn(page: Page, email: string): Promise<void> {
  await page.goto("/");
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
  await page.getByTestId("sign-in-email").fill(email);
  await page.getByTestId("sign-in-password").fill(PASSWORD);
  await page.getByTestId("sign-in-submit").click();
  await expect(page.getByTestId("home-sign-out")).toBeVisible();
}

/** A client-side navigation: the router follows it and the mock's tables survive. */
async function navigate(page: Page, address: string): Promise<void> {
  await page.evaluate((url) => {
    window.history.pushState({}, "", url);
    window.dispatchEvent(new PopStateEvent("popstate"));
  }, new URL(address, page.url()).pathname);
}

/** EVT-13 AC-1. The creator would be sent from the guest link to the event page, so the guest
 *  surface is asserted as a signed-out caller sees it. */
async function signOut(page: Page): Promise<void> {
  await page.getByTestId("home-sign-out").click();
  await expect(page.getByTestId("sign-in-submit")).toBeVisible();
}

async function openCreateForm(page: Page, name: string): Promise<Locator> {
  await page.getByTestId("nav-events-link").click();
  await expect(page).toHaveURL(/\/events$/);
  await page.getByTestId("events-new-button").click();
  await expect(page.getByTestId("event-form")).toBeVisible();
  await page.getByTestId("event-name-input").fill(name);
  await page.getByTestId("event-start-input").fill("2099-03-10");
  await page.getByTestId("event-end-input").fill("2099-03-12");
  await page.getByTestId("event-scope-public").check();
  return page.getByTestId("event-description-input");
}

/** Saves the form and returns the new event's id, read from the page's address. */
async function save(page: Page): Promise<string> {
  await page.getByTestId("event-save").click();
  await expect(page.getByTestId("event-detail")).toBeVisible();
  const match = /\/events\/([^/?#]+)$/.exec(new URL(page.url()).pathname);
  expect(match).not.toBeNull();
  return match![1]!;
}

async function stored(page: Page, id: string): Promise<string | null> {
  return page.evaluate(async (eventId) => {
    const event = await window.__calechipMockSeam!.getEvent(eventId);
    return event ? event.description : "missing";
  }, id);
}

/** ADR-005's direct call: every field as it is, the description replaced. */
async function writeStraight(page: Page, id: string, description: string): Promise<void> {
  const ok = await page.evaluate(
    async ([eventId, html]) => {
      const seam = window.__calechipMockSeam!;
      const event = await seam.getEvent(eventId);
      if (!event) return false;
      const inviteeIds = await seam.listEventInvitees(eventId);
      const result = await seam.updateEvent(eventId, {
        name: event.name,
        description: html,
        location: event.location,
        startDate: event.startDate,
        endDate: event.endDate,
        scope: event.scope,
        inviteeIds,
        capacity: event.capacity,
        requiresApproval: event.requiresApproval,
        registrationDeadline: event.registrationDeadline,
      });
      return result.ok;
    },
    [id, description] as const,
  );
  expect(ok).toBe(true);
}

/** Opens the event on screen to guests and returns the address the panel shows. */
async function openToGuests(page: Page): Promise<string> {
  await page.getByTestId("event-guest-open-button").click();
  const link = page.getByTestId("event-guest-link");
  await expect(link).toHaveValue(/\/guest\/[0-9a-f]{64}$/);
  return link.inputValue();
}

/** Re-reads the event's page: away to the list and back, client-side. */
async function reopenEvent(page: Page, id: string): Promise<void> {
  await navigate(page, "/events");
  await expect(page).toHaveURL(/\/events$/);
  await navigate(page, `/events/${id}`);
  await expect(page.getByTestId("event-detail")).toBeVisible();
}

/** Puts the caret on the line holding `text`, and selects that line when `select` is set. */
async function onLine(page: Page, editor: Locator, text: string, select = true): Promise<void> {
  await editor.getByText(text, { exact: true }).click();
  await page.keyboard.press("End");
  if (select) await page.keyboard.press("Shift+Home");
}

async function typeLines(page: Page, editor: Locator, lines: string[]): Promise<void> {
  await editor.click();
  for (const [i, line] of lines.entries()) {
    if (i > 0) await page.keyboard.press("Enter");
    await page.keyboard.type(line);
  }
}

async function computed(locator: Locator, property: string): Promise<string> {
  return locator.evaluate((el, p) => getComputedStyle(el).getPropertyValue(p), property);
}

/** AC-8's checks on one surface. */
async function assertHostileNeutralised(page: Page, testId: string): Promise<void> {
  const d = page.getByTestId(testId);
  await expect(d).toBeVisible();
  await expect(d.locator("script, iframe, style, h1")).toHaveCount(0);
  // EVT-11. No `img` but the valid `data:` picture, carrying nothing but `src` and `alt`.
  const pictures = d.locator("img");
  await expect(pictures).toHaveCount(1);
  await expect(pictures).toHaveAttribute("src", VALID_PICTURE);
  expect(await pictures.evaluate((img) => Array.from(img.attributes).map((a) => a.name).sort())).toEqual(["alt", "src"]);
  const badAttributes = await d.evaluate((root) =>
    [root, ...Array.from(root.querySelectorAll("*"))].flatMap((el) =>
      el === root
        ? []
        : Array.from(el.attributes)
            .map((a) => a.name)
            .filter((n) => n.startsWith("on") || n === "id" || n === "class" || n.startsWith("data-")),
    ),
  );
  expect(badAttributes).toEqual([]);

  const title = d.locator("h2", { hasText: "Title" });
  await expect(title).toHaveAttribute("style", "text-align: center");
  const c = d.locator("p", { hasText: /^c$/ });
  await expect(c).toHaveAttribute("style", "text-align: center");
  const red = d.locator("span", { hasText: "red" });
  await expect(red).toHaveAttribute("style", "color: #be123c");
  await expect(d.locator("strong")).toHaveText("bold");
  await expect(d).toContainText("ok bold");
  await expect(d).toContainText("big");
  await expect(d.locator("h2, h3", { hasText: "big" })).toHaveCount(0);

  // AC-7. `js` is text with no href anywhere on it; `ok link` is a link carrying target and rel.
  await expect(d).toContainText("js");
  await expect(d.locator("a", { hasText: "js" })).toHaveCount(0);
  await expect(d.locator("[href^='javascript' i]")).toHaveCount(0);
  const okLink = d.locator("a", { hasText: "ok link" });
  await expect(okLink).toHaveAttribute("href", "https://example.com/x");
  await expect(okLink).toHaveAttribute("target", "_blank");
  await expect(okLink).toHaveAttribute("rel", /noopener/);
  await expect(okLink).toHaveAttribute("rel", /noreferrer/);

  // The page outside the description is drawn as normal: the injected `style` did not hide it.
  await expect(page.locator("body")).toBeVisible();
  expect(await computed(page.locator("body"), "display")).not.toBe("none");
  expect(await page.evaluate(() => window.__xss)).toBeUndefined();
}

test.describe("EVT-10 — a formatted description", () => {
  test("AC-1: both forms carry the editor and a toolbar of every format, each reporting its state", async ({ page }) => {
    await signIn(page, MEMBER.email);
    const editor = await openCreateForm(page, "Toolbar check");

    await expect(page.getByText("Description (optional)")).toBeVisible();
    await expect(editor).toHaveAttribute("contenteditable", "true");
    const toolbar = page.getByTestId("event-description-toolbar");
    await expect(toolbar).toBeVisible();
    for (const id of [
      "bold", "italic", "underline", "strike", "h2", "h3", "bullet-list", "ordered-list",
      "blockquote", "link", "color", "align-left", "align-center", "align-right",
    ]) {
      await expect(toolbar.getByTestId(`event-description-${id}`)).toBeVisible();
    }

    // aria-pressed follows the caret.
    const bold = page.getByTestId("event-description-bold");
    await editor.click();
    await expect(bold).toHaveAttribute("aria-pressed", "false");
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.type("strong ");
    await page.keyboard.press("ControlOrMeta+b");
    await page.keyboard.press("ControlOrMeta+i");
    await page.keyboard.type("slanted ");
    await page.keyboard.press("ControlOrMeta+i");
    await page.keyboard.press("ControlOrMeta+u");
    await page.keyboard.type("under");
    await page.keyboard.press("ControlOrMeta+u");
    await expect(editor.locator("strong")).toHaveText("strong ");
    await expect(editor.locator("em")).toHaveText("slanted ");
    await expect(editor.locator("u")).toHaveText("under");
    await editor.getByText("strong").click();
    await expect(bold).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("event-description-italic")).toHaveAttribute("aria-pressed", "false");

    // The edit form carries the same editor.
    const id = await save(page);
    await page.getByTestId("event-edit-button").click();
    await expect(page).toHaveURL(new RegExp(`/events/${id}/edit$`));
    await expect(page.getByTestId("event-description-toolbar")).toBeVisible();
    await expect(page.getByTestId("event-description-input").locator("strong")).toHaveText("strong ");
  });

  test("AC-2, AC-3, AC-4: every format is shown on both surfaces, and re-saving changes nothing", async ({ page }) => {
    await signIn(page, MEMBER.email);
    const editor = await openCreateForm(page, "Formatted event");
    await typeLines(page, editor, [
      "Heading two", "Heading three", "Bold words", "Italic words", "Underlined words",
      "Struck words", "Red words", "Venue link", "Bullet item", "Numbered item", "Quoted words",
    ]);

    await onLine(page, editor, "Heading two", false);
    await page.getByTestId("event-description-h2").click();
    await page.getByTestId("event-description-align-center").click();
    await expect(page.getByTestId("event-description-align-center")).toHaveAttribute("aria-pressed", "true");
    await onLine(page, editor, "Heading three", false);
    await page.getByTestId("event-description-h3").click();
    for (const [line, id] of [
      ["Bold words", "bold"],
      ["Italic words", "italic"],
      ["Underlined words", "underline"],
      ["Struck words", "strike"],
    ] as const) {
      await onLine(page, editor, line);
      await page.getByTestId(`event-description-${id}`).click();
    }
    await onLine(page, editor, "Red words");
    await page.getByTestId("event-description-color").click();
    await page.getByTestId("event-description-color-danger").click();
    await onLine(page, editor, "Venue link");
    await page.getByTestId("event-description-link").click();
    await page.getByTestId("event-description-link-input").fill("example.com/venue");
    await page.getByTestId("event-description-link-apply").click();
    await onLine(page, editor, "Bullet item", false);
    await page.getByTestId("event-description-bullet-list").click();
    await onLine(page, editor, "Numbered item", false);
    await page.getByTestId("event-description-ordered-list").click();
    await onLine(page, editor, "Quoted words", false);
    await page.getByTestId("event-description-blockquote").click();

    const id = await save(page);

    // AC-2.
    const d = page.getByTestId("event-description");
    const h2 = d.locator("h2");
    await expect(h2).toHaveText("Heading two");
    expect(await computed(h2, "text-align")).toBe("center");
    await expect(d.locator("h3")).toHaveText("Heading three");
    await expect(d.locator("strong")).toHaveText("Bold words");
    await expect(d.locator("em")).toHaveText("Italic words");
    await expect(d.locator("u")).toHaveText("Underlined words");
    await expect(d.locator("s")).toHaveText("Struck words");
    const red = d.locator("span", { hasText: "Red words" });
    expect(await computed(red, "color")).toBe("rgb(190, 18, 60)");
    const link = d.locator("a", { hasText: "Venue link" });
    await expect(link).toHaveAttribute("href", "https://example.com/venue");
    await expect(link).toHaveAttribute("target", "_blank");
    await expect(link).toHaveAttribute("rel", /noopener/);
    await expect(link).toHaveAttribute("rel", /noreferrer/);
    await expect(d.locator("ul > li")).toHaveText("Bullet item");
    await expect(d.locator("ol > li")).toHaveText("Numbered item");
    await expect(d.locator("blockquote")).toHaveText("Quoted words");
    const onEventPage = await d.innerHTML();

    // AC-4. The edit form shows every format; saving it untouched stores the same characters.
    const before = await stored(page, id);
    await page.getByTestId("event-edit-button").click();
    const reopened = page.getByTestId("event-description-input");
    await expect(reopened.locator("h2")).toHaveText("Heading two");
    expect(await computed(reopened.locator("h2"), "text-align")).toBe("center");
    await expect(reopened.locator("h3")).toHaveText("Heading three");
    for (const tag of ["strong", "em", "u", "s", "ul", "ol", "blockquote"]) {
      await expect(reopened.locator(tag)).toHaveCount(1);
    }
    expect(await computed(reopened.locator("span", { hasText: "Red words" }), "color")).toBe("rgb(190, 18, 60)");
    await expect(reopened.locator("a")).toHaveAttribute("href", "https://example.com/venue");
    await save(page);
    expect(await stored(page, id)).toBe(before);

    // AC-3. The guest page draws the same elements, in the same order, with the same text.
    const address = await openToGuests(page);
    await signOut(page);
    await navigate(page, address);
    const g = page.getByTestId("guest-event-description");
    await expect(g).toBeVisible();
    expect(await g.innerHTML()).toBe(onEventPage);
  });

  test("AC-5: plain typing reads back exactly as typed", async ({ page }) => {
    await signIn(page, MEMBER.email);
    const editor = await openCreateForm(page, "Plain event");
    await editor.fill("Bring your appetite");
    await save(page);
    await expect(page.getByTestId("event-description")).toHaveText("Bring your appetite");
  });

  test("AC-6: an editor holding no text saves no description", async ({ page }) => {
    await signIn(page, MEMBER.email);

    // Never touched.
    await openCreateForm(page, "Untouched description");
    const untouched = await save(page);
    await expect(page.getByTestId("event-description")).toHaveCount(0);
    expect(await stored(page, untouched)).toBeNull();

    // Only empty blocks: a heading, a list item and paragraphs with no text.
    const editor = await openCreateForm(page, "Empty blocks");
    await editor.click();
    await page.getByTestId("event-description-h2").click();
    await page.keyboard.press("Enter");
    await page.getByTestId("event-description-bullet-list").click();
    await page.keyboard.press("Enter");
    await page.keyboard.press("Enter");
    const emptyBlocks = await save(page);
    await expect(page.getByTestId("event-description")).toHaveCount(0);
    expect(await stored(page, emptyBlocks)).toBeNull();

    // Cleared.
    const cleared = await openCreateForm(page, "Cleared description");
    await cleared.fill("Soon gone");
    await cleared.press("ControlOrMeta+a");
    await cleared.press("Backspace");
    const clearedId = await save(page);
    await expect(page.getByTestId("event-description")).toHaveCount(0);
    expect(await stored(page, clearedId)).toBeNull();

    // And the guest page draws no description either.
    const address = await openToGuests(page);
    await signOut(page);
    await navigate(page, address);
    await expect(page.getByTestId("guest-event")).toBeVisible();
    await expect(page.getByTestId("guest-event-description")).toHaveCount(0);
  });

  test("AC-7: a link is http, https or mailto, opens in a new tab, and can be removed", async ({ page }) => {
    await signIn(page, MEMBER.email);
    const editor = await openCreateForm(page, "Linked event");
    await typeLines(page, editor, ["Bare site", "Script link", "Ftp link", "Mail us", "Shout HTTP", "Undone link"]);

    const attempts: [string, string, string | null][] = [
      ["Bare site", "example.com", "https://example.com"],
      ["Script link", "javascript:alert(1)", null],
      ["Ftp link", "ftp://example.com/file", null],
      ["Mail us", "mailto:team@example.com", "mailto:team@example.com"],
      ["Shout HTTP", "HTTP://example.com/upper", "HTTP://example.com/upper"],
      ["Undone link", "https://example.com/undone", "https://example.com/undone"],
    ];
    for (const [line, typed] of attempts) {
      await onLine(page, editor, line);
      await page.getByTestId("event-description-link").click();
      await page.getByTestId("event-description-link-input").fill(typed);
      await page.getByTestId("event-description-link-apply").click();
    }
    // A `data:` address is refused too, applied with Enter rather than the button.
    await onLine(page, editor, "Script link");
    await page.getByTestId("event-description-link").click();
    await page.getByTestId("event-description-link-input").fill("data:text/html,hi");
    await page.getByTestId("event-description-link-input").press("Enter");
    await expect(page.getByTestId("event-form")).toBeVisible();

    // Remove link turns the selected link back into text.
    await onLine(page, editor, "Undone link", false);
    await page.getByTestId("event-description-link").click();
    await page.getByTestId("event-description-link-remove").click();
    await expect(editor.locator("a", { hasText: "Undone link" })).toHaveCount(0);

    await save(page);
    const d = page.getByTestId("event-description");
    for (const [line, , href] of attempts) {
      const a = d.locator("a", { hasText: line });
      if (href === null || line === "Undone link") {
        await expect(a, line).toHaveCount(0);
        await expect(d).toContainText(line);
      } else {
        await expect(a, line).toHaveAttribute("href", href);
      }
    }
    const links = d.locator("a");
    await expect(links).toHaveCount(3);
    for (const a of await links.all()) {
      await expect(a).toHaveAttribute("target", "_blank");
      await expect(a).toHaveAttribute("rel", /noopener/);
      await expect(a).toHaveAttribute("rel", /noreferrer/);
    }
  });

  test("AC-8: a hostile description written straight to the datastore reaches neither surface", async ({ page }) => {
    const toExample: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).hostname.endsWith("example.com")) toExample.push(request.url());
    });

    await signIn(page, MEMBER.email);
    await openCreateForm(page, "Hostile event");
    const id = await save(page);
    const address = await openToGuests(page);
    await writeStraight(page, id, HOSTILE);
    expect(await stored(page, id)).toBe(HOSTILE);

    await reopenEvent(page, id);
    await expect(page.getByTestId("event-name")).toHaveText("Hostile event");
    await assertHostileNeutralised(page, "event-description");

    await signOut(page);
    await navigate(page, address);
    await expect(page.getByTestId("guest-event-name")).toHaveText("Hostile event");
    await assertHostileNeutralised(page, "guest-event-description");

    // Settled: give any deferred handler its chance before the final read.
    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(toExample).toEqual([]);
  });

  test("AC-9: saving the edit form untouched strips what the allow-list does not hold", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await openCreateForm(page, "Resaved hostile");
    const id = await save(page);
    await writeStraight(page, id, HOSTILE);
    await reopenEvent(page, id);

    await page.getByTestId("event-edit-button").click();
    await expect(page.getByTestId("event-description-input")).toBeVisible();
    await save(page);

    const after = await stored(page, id);
    expect(after).not.toBeNull();
    for (const banned of [
      "<script", "<iframe", "<style", "<h1", "onerror", "onclick", "javascript:",
      "example.com/a.png", "example.com/b.png", "id=", "class=", "data-x", "9999",
    ]) {
      expect(after, banned).not.toContain(banned);
    }
    // EVT-11. No `img` but the valid `data:` picture.
    expect(after!.match(/<img/g)).toHaveLength(1);
    expect(after).toContain(`<img src="${VALID_PICTURE}" alt="">`);
  });
});
