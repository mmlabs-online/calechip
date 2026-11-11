// MIR-19 AC-13 (client half) and AC-14 — the org address, in 01-plan.md § 4.2.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  RESERVED_ORG_CODES,
  isOrgCode,
  orgPath,
  routerBase,
  splitOrgPath,
} from "../src/lib/org-path";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

describe("MIR-19 AC-14: isOrgCode matches the database's org_code_shape and org_code_not_reserved", () => {
  it("is true for shared, acme and a1-b2", () => {
    for (const code of ["shared", "acme", "a1-b2"]) expect(isOrgCode(code), code).toBe(true);
  });

  it("is false for every reserved word", () => {
    for (const word of RESERVED_ORG_CODES) expect(isOrgCode(word), word).toBe(false);
  });

  it("is false for shapes the database refuses", () => {
    for (const bad of ["A1", "-ab", "ab-", "a", "a".repeat(33), "index.html", ""]) {
      expect(isOrgCode(bad), JSON.stringify(bad)).toBe(false);
    }
  });

  it("is true at the 32-character limit", () => {
    expect(isOrgCode("a".repeat(32))).toBe(true);
  });
});

describe("MIR-19 AC-13: tasks cannot be an org code", () => {
  it("isOrgCode('tasks') is false", () => {
    expect(isOrgCode("tasks")).toBe(false);
  });

  it("RESERVED_ORG_CODES equals the migration's array, in order", () => {
    const sql = readFileSync(
      repoRoot + "supabase/migrations/20261111150000_mir19_own_org_code.sql",
      "utf8",
    );
    const start = sql.indexOf("org_code <> all (array[");
    expect(start).toBeGreaterThan(-1);
    const body = sql.slice(start, sql.indexOf("])", start));
    const tokens = [...body.replace(/--.*$/gm, "").matchAll(/'([^']+)'/g)].map((m) => m[1]);
    expect(tokens).toEqual([...RESERVED_ORG_CODES]);
    expect(tokens).toHaveLength(51);
  });
});

describe("splitOrgPath, orgPath and routerBase", () => {
  it("splits an org-prefixed path", () => {
    expect(splitOrgPath("/shared/month/2026-10")).toEqual({ orgCode: "shared", rest: "/month/2026-10" });
    expect(splitOrgPath("/shared")).toEqual({ orgCode: "shared", rest: "/" });
    expect(splitOrgPath("/shared/")).toEqual({ orgCode: "shared", rest: "/" });
  });

  it("leaves a root path unchanged", () => {
    expect(splitOrgPath("/month/2026-10")).toEqual({ orgCode: null, rest: "/month/2026-10" });
    expect(splitOrgPath("/")).toEqual({ orgCode: null, rest: "/" });
    expect(splitOrgPath("/signin")).toEqual({ orgCode: null, rest: "/signin" });
  });

  it("joins as react-router's basename does", () => {
    expect(orgPath("shared", "/")).toBe("/shared");
    expect(orgPath("shared", "/year")).toBe("/shared/year");
  });

  it("derives the router basename", () => {
    expect(routerBase("/shared/week")).toBe("/shared");
    expect(routerBase("/shared")).toBe("/shared");
    expect(routerBase("/week")).toBe("/");
    expect(routerBase("/")).toBe("/");
  });
});
