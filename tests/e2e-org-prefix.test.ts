// MIR-19-b — the e2e org-prefix helper, and the specs that have moved to it.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { E2E_ORG_CODE, appHref, appPathname, stripOrg } from "./e2e/support/org-prefix";

/** The specs that have moved to the helper. MIR-19-c appends to this list; nothing removes from it. */
const MIGRATED_SPECS: readonly string[] = [
  "solo-admin-back-to-calendar.spec.ts",
  "solo-admin-tabs.spec.ts",
  "solo-approval-settings.spec.ts",
  "solo-profile.spec.ts",
  "solo-team-settings.spec.ts",
  "solo-teams.spec.ts",
  "tsk-01-tasks.spec.ts",
  "tsk-04-week-task-badge.spec.ts",
  "uie-09-admin-hub.spec.ts",
];

describe("stripOrg", () => {
  it("strips only the fixture org code", () => {
    expect(E2E_ORG_CODE).toBe("shared");
  });

  it.each<[string, string]>([
    ["/shared", "/"],
    ["/shared/", "/"],
    ["/shared/admin", "/admin"],
    ["/shared/tasks/2030-03-12", "/tasks/2030-03-12"],
    ["/shared?team=t1", "/?team=t1"],
    ["/shared/month/2026-10?team=t1", "/month/2026-10?team=t1"],
    ["/admin", "/admin"],
    ["/", "/"],
    ["/sharedx/admin", "/sharedx/admin"],
    ["/acme/admin", "/acme/admin"],
    ["/admin/shared", "/admin/shared"],
    ["/shared/shared/admin", "/shared/admin"],
    ["https://example.com/shared/x", "https://example.com/shared/x"],
    ["", ""],
  ])("stripOrg(%j) is %j", (input, output) => {
    expect(stripOrg(input)).toBe(output);
  });

  it("does not turn a wrong href into /admin (AC-6)", () => {
    for (const wrong of ["/shared/week", "/acme/admin", "/sharedx/admin"]) {
      expect(stripOrg(wrong)).not.toBe("/admin");
    }
  });
});

describe("appPathname / appHref", () => {
  it("reads the page pathname with the org removed and no query", () => {
    expect(appPathname({ url: () => "http://localhost:4173/shared/month/2026-10?team=t1" })).toBe("/month/2026-10");
    expect(appPathname({ url: () => "http://localhost:4173/month/2026-10" })).toBe("/month/2026-10");
  });

  it("reads a link href with the org removed, or null", async () => {
    expect(await appHref({ getAttribute: async () => "/shared/admin" })).toBe("/admin");
    expect(await appHref({ getAttribute: async () => "/admin" })).toBe("/admin");
    expect(await appHref({ getAttribute: async () => null })).toBeNull();
  });
});

describe("migrated specs", () => {
  describe.each(MIGRATED_SPECS)("%s", (name) => {
    const source = readFileSync(fileURLToPath(new URL(`./e2e/${name}`, import.meta.url)), "utf8");

    it("asserts no raw href", () => {
      expect(source).not.toMatch(/toHaveAttribute\(\s*["']href["']/);
    });

    it("imports the org-prefix helper", () => {
      expect(source).toMatch(/from "\.\/support\/org-prefix"/);
    });
  });
});
