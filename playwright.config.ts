import { defineConfig, devices } from "@playwright/test";

// End-to-end lives beside the unit tests but is separated by suffix, so one runner never picks up
// the other's files: vitest owns `tests/**/*.test.ts`, playwright owns `tests/e2e/**/*.spec.ts`.
// Both stay under `tests/`, which is one of the SCAFFOLD_ROOTS check-docs.mjs knows about.
export default defineConfig({
  testDir: "tests/e2e",
  // No top-level `testMatch`. It is per-project below, because the seam guard is a `.setup.ts` and a
  // top-level `**/*.spec.ts` would exclude it from every project — the guard would then silently
  // never run, which is the failure mode this ticket exists to remove. BUG-001 plan section 4.1.
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "line" : "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    // The seam guard runs first and alone. `chromium` names it in `dependencies`, so a failure here
    // reports every dependent test as `did not run` rather than letting them start — the in-suite
    // guard at tests/e2e/tea-01-signup.spec.ts:52 reports the same breach but cannot stop it, because
    // `fullyParallel` has the sign-up tests hitting the datastore concurrently with it failing.
    {
      name: "seam-guard",
      testMatch: /seam\.setup\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "chromium",
      testMatch: /.*\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
      dependencies: ["seam-guard"],
    },
  ],
  // `vite preview` binds to localhost only — a `127.0.0.1` URL times out waiting for a server that
  // is running. Verified by attempt rather than assumed.
  webServer: {
    command: "pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    // The suite states which seam it drives instead of inheriting it from whatever `.env` the
    // machine happens to carry. `webServer.env` is merged OVER `process.env`
    // (playwright/lib/runner/index.js:858-862), and Vite applies `process.env` AFTER the parsed
    // `.env` (vite/dist/node/chunks/node.js:5926) — so this beats a developer's `.env` rather than
    // losing to it. Both halves of the resolver's `||` at src/lib/data/index.ts:164 are pinned, so
    // neither is left to the machine. CI needs no `env:` block for the same reason: both invocations
    // load this file (.github/workflows/verify.yml:51 is unchanged by this ticket).
    env: {
      VITE_DATA_SEAM: "mock",
      VITE_SUPABASE_URL: "",
      // SOLO, 2026-09-10 — PINNED ON, for exactly the reason the two lines above are pinned.
      // `src/lib/config.ts` defaults this OFF, which is the operator's new configuration; TEA-01
      // AC-7 and the seven `signup-confirm-notice` assertions in `tests/e2e/tea-01-signup.spec.ts`
      // are written against `Confirm email` ON, and a suite that inherited the default would report
      // a shipped criterion as broken when what changed was the setting it runs under.
      //
      // **THE OTHER DIRECTION IS COVERED BY `tests/signup-confirmation.test.ts` AND NOT HERE**, and
      // that is a limit rather than a choice: `webServer` is one server for the whole run, so a
      // browser test of the flag OFF would need a second config and a second build. The seam
      // behaviour it would assert is not browser-shaped anyway — the standard puts seam behaviour at
      // the unit level (`.ai/standards/testing-standards.md`).
      VITE_REQUIRE_EMAIL_CONFIRMATION: "true",
      // **RE-PINNED BY `solo` ON 2026-09-10 AFTER `71bd1c0 "update UI"` FLIPPED IT TO "false".**
      // That flip broke six of TEA-01's ten tests: seven `signup-confirm-notice` assertions are
      // written against `Confirm email` ON, and with the flag off the notice never renders. The
      // product's own default is OFF (`src/lib/config.ts`) and is unaffected by this line — what a
      // real project does is decided by its dashboard setting, which this file cannot reach. The
      // suite states the setting it tests under; it does not choose the product's.
    },
  },
});
