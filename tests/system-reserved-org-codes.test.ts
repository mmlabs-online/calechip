// MIR-19-e AC-9 — the system panel's mock reserved list is the database's list (01-plan.md § 4.5).
// `src/lib/data/system.ts` is read as text, not imported: the module chooses its seam from the
// environment. `tests/org-path.test.ts` holds RESERVED_ORG_CODES equal to the constraint.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { RESERVED_ORG_CODES } from "@/lib/org-path";

const SOURCE = readFileSync(
  fileURLToPath(new URL("../src/lib/data/system.ts", import.meta.url)),
  "utf8",
);

function mockTokens(): string[] {
  const start = SOURCE.indexOf("const MOCK_RESERVED_ORG_CODES: readonly string[] = [");
  expect(start, "MOCK_RESERVED_ORG_CODES is declared").toBeGreaterThanOrEqual(0);
  const end = SOURCE.indexOf("];", start);
  const array = SOURCE.slice(start, end);
  return [...array.matchAll(/"([^"]*)"/g)].map((m) => m[1] as string);
}

describe("MIR-19-e AC-9: MOCK_RESERVED_ORG_CODES equals RESERVED_ORG_CODES", () => {
  it("holds the same tokens in the same order", () => {
    expect(mockTokens()).toEqual([...RESERVED_ORG_CODES]);
  });

  it("is 51 tokens, the last `tasks`", () => {
    const tokens = mockTokens();
    expect(tokens).toHaveLength(51);
    expect(tokens[tokens.length - 1]).toBe("tasks");
  });
});
