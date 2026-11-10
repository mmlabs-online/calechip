import { deflateSync, crc32 } from "node:zlib";
import { expect, test, type Locator, type Page } from "@playwright/test";

// EVT-11 — pictures in an event's description, downscaled and capped. 01-plan.md § 2 AC-1..AC-5,
// AC-7 and AC-10, § 2b's selectors. AC-6, AC-8 and AC-9 are properties of the seam or of a file,
// asserted in `tests/description-pictures.test.ts`.
//
// THE SUITE DRIVES THE MOCK SEAM (BUG-001 pins it). **A `page.goto` RESETS THE MOCK'S TABLES**, so
// every page after the first is reached client-side — `evt-10-description.spec.ts` records why.
//
// **THE PICTURES ARE MADE HERE, AS PNG BUFFERS, NEVER AS FILES IN THE REPOSITORY** (§ 4.8): a
// solid-colour PNG of any size is a few hundred bytes of deflate, and a too-large one is a small PNG
// padded past the input limit, which the picker refuses on size before it decodes anything.
//
// Fixtures (`src/lib/fixtures.ts`): thanh@ is FIXTURE_MEMBER.

const PASSWORD = "password123";
const MEMBER = { email: "thanh@example.com" };

const REFUSED = "Choose a PNG, JPEG or WebP picture of at most 10 MB.";
const TOO_LARGE =
  "This picture would make the description larger than 1 MB. Remove a picture or choose a smaller one.";
const MAX_BYTES = 1048576;

declare global {
  interface Window {
    __xss?: unknown;
  }
}

function chunk(type: string, data: Buffer): Buffer {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/** A solid-colour RGB PNG, `width` × `height`. */
function png(width: number, height: number, rgb: [number, number, number] = [255, 180, 150]): Buffer {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header.writeUInt8(8, 8); // bit depth
  header.writeUInt8(2, 9); // colour type: RGB
  const row = Buffer.alloc(1 + width * 3);
  for (let x = 0; x < width; x++) row.set(rgb, 1 + x * 3);
  const raw = Buffer.alloc(row.length * height);
  for (let y = 0; y < height; y++) row.copy(raw, y * row.length);
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const pngFile = (name: string, buffer: Buffer) => ({ name, mimeType: "image/png", buffer });

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

async function openToGuests(page: Page): Promise<string> {
  await page.getByTestId("event-guest-open-button").click();
  const link = page.getByTestId("event-guest-link");
  await expect(link).toHaveValue(/\/guest\/[0-9a-f]{64}$/);
  return link.inputValue();
}

async function reopenEvent(page: Page, id: string): Promise<void> {
  await navigate(page, "/events");
  await expect(page).toHaveURL(/\/events$/);
  await navigate(page, `/events/${id}`);
  await expect(page.getByTestId("event-detail")).toBeVisible();
}

async function pick(page: Page, file: { name: string; mimeType: string; buffer: Buffer }): Promise<void> {
  await expect(page.getByTestId("event-description-picture")).toBeVisible();
  await page.getByTestId("event-description-picture-input").setInputFiles(file);
}

/** Waits for the picture to decode, then reads its natural size. */
async function naturalSize(img: Locator): Promise<[number, number]> {
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
  return img.evaluate((el: HTMLImageElement) => [el.naturalWidth, el.naturalHeight] as [number, number]);
}

async function attributeNames(img: Locator): Promise<string[]> {
  return img.evaluate((el) => Array.from(el.attributes).map((a) => a.name).sort());
}

test.describe("EVT-11 — pictures in an event's description", () => {
  test("AC-1: a picture chosen from the toolbar shows in the editor and on the event's page", async ({ page }) => {
    await signIn(page, MEMBER.email);
    const editor = await openCreateForm(page, "Poster event");
    await editor.click();
    await page.keyboard.type("Here is the poster");

    const button = page.getByTestId("event-description-picture");
    await expect(page.getByTestId("event-description-toolbar").getByTestId("event-description-picture")).toBeVisible();
    await expect(button).toHaveAttribute("aria-label", "Insert picture");
    const input = page.getByTestId("event-description-picture-input");
    await expect(input).toHaveAttribute("type", "file");
    await expect(input).toHaveAttribute("accept", "image/png,image/jpeg,image/webp");

    await pick(page, pngFile("poster.png", png(320, 200)));
    await expect(editor.locator("img")).toHaveCount(1);
    await expect(editor.locator("img")).toHaveAttribute("src", /^data:image\//);
    await expect(page.getByTestId("event-description-picture-error")).toHaveCount(0);

    await save(page);
    const pictures = page.getByTestId("event-description").locator("img");
    await expect(pictures).toHaveCount(1);
    await expect(pictures).toHaveAttribute("src", /^data:image\//);
    await expect(page.getByTestId("event-description")).toContainText("Here is the poster");
  });

  test("AC-2: a large picture is downscaled to a 1200px longest edge, and a small one is never enlarged", async ({ page }) => {
    await signIn(page, MEMBER.email);

    // A description holding only a picture is a description, not an empty one.
    await openCreateForm(page, "Large picture");
    await pick(page, pngFile("large.png", png(3000, 2000)));
    await expect(page.getByTestId("event-description-input").locator("img")).toHaveCount(1);
    const large = await save(page);
    expect(await stored(page, large)).toMatch(/^<img src="data:image\//);
    expect(await naturalSize(page.getByTestId("event-description").locator("img"))).toEqual([1200, 800]);

    await openCreateForm(page, "Small picture");
    await pick(page, pngFile("small.png", png(400, 300)));
    await expect(page.getByTestId("event-description-input").locator("img")).toHaveCount(1);
    await save(page);
    expect(await naturalSize(page.getByTestId("event-description").locator("img"))).toEqual([400, 300]);
  });

  test("AC-3: a guest sees the same picture", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await openCreateForm(page, "Guest picture");
    await pick(page, pngFile("map.png", png(600, 400)));
    await expect(page.getByTestId("event-description-input").locator("img")).toHaveCount(1);
    await save(page);
    const src = await page.getByTestId("event-description").locator("img").getAttribute("src");
    expect(src).toMatch(/^data:image\//);

    const address = await openToGuests(page);
    await signOut(page);
    await navigate(page, address);
    const guestPicture = page.getByTestId("guest-event-description").locator("img");
    await expect(guestPicture).toHaveCount(1);
    await expect(guestPicture).toHaveAttribute("src", src!);
  });

  test("AC-4: a file that is not an accepted picture, or is over 10 MB, is refused and changes nothing", async ({ page }) => {
    await signIn(page, MEMBER.email);
    const editor = await openCreateForm(page, "Refused files");
    await editor.click();
    await page.keyboard.type("Unchanged text");
    const before = await editor.innerHTML();

    await pick(page, { name: "notes.txt", mimeType: "text/plain", buffer: Buffer.from("not a picture") });
    await expect(page.getByTestId("event-description-picture-error")).toHaveText(REFUSED);
    expect(await editor.innerHTML()).toBe(before);

    const huge = Buffer.concat([png(10, 10), Buffer.alloc(10 * 1024 * 1024)]);
    await pick(page, pngFile("huge.png", huge));
    await expect(page.getByTestId("event-description-picture-error")).toHaveText(REFUSED);
    expect(await editor.innerHTML()).toBe(before);
    await expect(editor.locator("img")).toHaveCount(0);

    // The refusal clears on the next successful insertion.
    await pick(page, pngFile("ok.png", png(40, 40)));
    await expect(editor.locator("img")).toHaveCount(1);
    await expect(page.getByTestId("event-description-picture-error")).toHaveCount(0);
  });

  test("AC-5: a picture that would take the description past 1 MB is refused at insertion", async ({ page }) => {
    await signIn(page, MEMBER.email);
    await openCreateForm(page, "Nearly full");
    const id = await save(page);
    // 40 bytes under the cap: no downscaled picture's `<img src="data:…" alt="">` is that small.
    const nearlyFull = `<p>${"a".repeat(MAX_BYTES - 7 - 40)}</p>`;
    await writeStraight(page, id, nearlyFull);
    await reopenEvent(page, id);

    await page.getByTestId("event-edit-button").click();
    const editor = page.getByTestId("event-description-input");
    await expect(editor.locator("p")).toHaveCount(1);
    await editor.click();
    await pick(page, pngFile("tiny.png", png(8, 8)));
    await expect(page.getByTestId("event-description-picture-error")).toHaveText(TOO_LARGE);
    await expect(editor.locator("img")).toHaveCount(0);

    await save(page);
    expect(await stored(page, id)).toBe(nearlyFull);
  });

  test("AC-7: only an embedded PNG, JPEG or WebP picture survives the render, on both surfaces", async ({ page }) => {
    const toExample: string[] = [];
    page.on("request", (request) => {
      if (new URL(request.url()).hostname.endsWith("example.com")) toExample.push(request.url());
    });

    await signIn(page, MEMBER.email);
    await openCreateForm(page, "Hostile pictures");
    const id = await save(page);
    const address = await openToGuests(page);

    const valid = `data:image/png;base64,${png(2, 2).toString("base64")}`;
    const hostile =
      '<p>Pictures</p>' +
      '<img src="https://example.com/remote.png">' +
      '<img src="data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIG9ubG9hZD0id2luZG93Ll9feHNzPTEiLz4=">' +
      '<img src="data:image/png,raw">' +
      '<img src="data:text/html;base64,PHNjcmlwdD53aW5kb3cuX194c3M9Mjwvc2NyaXB0Pg==">' +
      '<img src="x" onerror="window.__xss=3" style="width: 9999px" width="9999" height="9999">' +
      `<img src="${valid}" alt="" onerror="window.__xss=4" style="width: 9999px" width="9999" height="9999">`;
    await writeStraight(page, id, hostile);

    await reopenEvent(page, id);
    for (const testId of ["event-description"]) {
      const pictures = page.getByTestId(testId).locator("img");
      await expect(pictures).toHaveCount(1);
      await expect(pictures).toHaveAttribute("src", valid);
      expect(await attributeNames(pictures)).toEqual(["alt", "src"]);
    }

    await signOut(page);
    await navigate(page, address);
    const guestPictures = page.getByTestId("guest-event-description").locator("img");
    await expect(guestPictures).toHaveCount(1);
    await expect(guestPictures).toHaveAttribute("src", valid);
    expect(await attributeNames(guestPictures)).toEqual(["alt", "src"]);

    await page.waitForLoadState("networkidle");
    expect(await page.evaluate(() => window.__xss)).toBeUndefined();
    expect(toExample).toEqual([]);
  });

  test("AC-10: saving the edit form unchanged keeps the picture", async ({ page }) => {
    await signIn(page, MEMBER.email);
    const editor = await openCreateForm(page, "Kept picture");
    await editor.click();
    await page.keyboard.type("Above the picture");
    await pick(page, pngFile("kept.png", png(500, 250)));
    await expect(editor.locator("img")).toHaveCount(1);
    const id = await save(page);
    const src = await page.getByTestId("event-description").locator("img").getAttribute("src");
    const before = await stored(page, id);

    await page.getByTestId("event-edit-button").click();
    await expect(page.getByTestId("event-description-input").locator("img")).toHaveAttribute("src", src!);
    await save(page);

    await expect(page.getByTestId("event-description").locator("img")).toHaveAttribute("src", src!);
    expect(await stored(page, id)).toBe(before);
  });
});
