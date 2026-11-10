// Capture one screen of the running application as a PNG, so review check R9 has something to
// compare a reference image against.
//
// **THIS SCRIPT EXISTS BECAUSE MD-030 IS ABOUT AN INSTRUCTION NO ROLE COULD EXECUTE.** `/triage` and
// `/plan` were told for months to `move` an attached image into the ticket folder; no agent in this
// loop can write image bytes, so the step degraded silently into prose and the picture was never
// checkable. R9 asks the reviewer to compare the built screen against that picture. Writing R9
// without a capture mechanism would reproduce the same defect one stage further down — a check
// addressed to a role that has no way to run it. The reviewer holds `Bash` and `Read`, `Read`
// renders a PNG, and this script is the missing half.
//
// Usage:
//   node scripts/capture-screen.mjs --route /year/2026 --out .ai/board/tickets/CAL-10/review.png
//   node scripts/capture-screen.mjs --route /month --out out.png --email hoa@example.com --width 2000
//
// The PNG is a REVIEW ARTIFACT AND NOT A COMMITTED ONE. Write it outside the repository or delete it
// after the verdict — `.gitignore` carries the default path. `04-review.md` records what was seen,
// which is the durable half; a screenshot in git is a second copy that goes stale the next commit.

import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const PORT = 4173;
const ORIGIN = `http://localhost:${PORT}`;

// The fixture member `tests/e2e/*.spec.ts` sign in as. A screenshot taken signed-out is a screenshot
// of the sign-in prompt, which is never the screen under review.
const DEFAULT_EMAIL = "thanh@example.com";
const PASSWORD = "password123";

function parseArgs(argv) {
  const args = new Map();
  for (let i = 0; i < argv.length; i += 2) {
    if (!argv[i]?.startsWith("--")) throw new Error(`expected a --flag at "${argv[i]}"`);
    args.set(argv[i].slice(2), argv[i + 1]);
  }
  const route = args.get("route");
  const out = args.get("out");
  if (!route || !out) {
    throw new Error("--route and --out are both required");
  }
  return {
    route,
    out: resolve(out),
    email: args.get("email") ?? DEFAULT_EMAIL,
    // 1440 is the width `.ai/standards/ui-design-system.md` treats as the desktop case. A reference
    // image drawn at another width is compared at that width by passing --width, because a layout
    // difference caused by the viewport is not a defect and must not be reported as one.
    width: Number(args.get("width") ?? 1440),
    height: Number(args.get("height") ?? 900),
  };
}

async function isUp() {
  try {
    const response = await fetch(ORIGIN, { signal: AbortSignal.timeout(1500) });
    return response.ok;
  } catch {
    return false;
  }
}

/** Builds and serves, and returns the child to kill — or null when a server was already listening,
 *  in which case this script must not stop it. Reusing a live preview is what makes a second capture
 *  cheap enough that the reviewer will actually take one per screen. */
async function serve() {
  if (await isUp()) {
    console.error(`reusing the server already listening on ${ORIGIN}`);
    return null;
  }

  console.error("building…");
  const build = spawn("pnpm", ["exec", "vite", "build"], { stdio: ["ignore", "ignore", "inherit"] });
  const code = await new Promise((done) => build.on("close", done));
  if (code !== 0) throw new Error(`vite build exited ${code}`);

  console.error(`serving on ${ORIGIN}…`);
  const preview = spawn("pnpm", ["exec", "vite", "preview", "--port", String(PORT), "--strictPort"], {
    stdio: ["ignore", "ignore", "inherit"],
  });

  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (await isUp()) return preview;
    await new Promise((done) => setTimeout(done, 300));
  }
  preview.kill();
  throw new Error(`the preview server did not answer on ${ORIGIN} within 30s`);
}

async function main() {
  const { route, out, email, width, height } = parseArgs(process.argv.slice(2));
  const server = await serve();

  // Imported here rather than at the top so that a missing browser binary reports after the argument
  // check, with the install command in the message.
  const { chromium } = await import("@playwright/test");
  const browser = await chromium.launch();

  try {
    const page = await browser.newPage({
      viewport: { width, height },
      // 2 renders text at the density the reference images were captured at. A 1x screenshot
      // compared against a 2x reference reads every antialiased edge as a difference.
      deviceScaleFactor: 2,
    });

    await page.goto(`${ORIGIN}/signin`);
    await page.getByTestId("sign-in-email").fill(email);
    await page.getByTestId("sign-in-password").fill(PASSWORD);
    await page.getByTestId("sign-in-submit").click();
    await page.getByTestId("home-sign-out").waitFor({ state: "visible", timeout: 15_000 });

    await page.goto(`${ORIGIN}${route}`);
    await page.waitForLoadState("networkidle");

    // The seam is mocked in-process and its reads resolve on a timer, so `networkidle` is reached
    // while a screen is still showing its own loading state. Waiting for the loading testids to
    // clear is what keeps a spinner out of the reference comparison.
    await page
      .locator('[data-testid$="-loading"]')
      .first()
      .waitFor({ state: "detached", timeout: 10_000 })
      .catch(() => {});

    await mkdir(dirname(out), { recursive: true });
    await page.screenshot({ path: out, fullPage: true });
    console.error(`wrote ${out}`);
  } finally {
    await browser.close();
    server?.kill();
  }
}

main().catch((error) => {
  console.error(String(error?.message ?? error));
  process.exit(1);
});
