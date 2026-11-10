// MIR-17-b, ADR-089 decision 1 — the admin screens' guards go through `mayAdminister`, and `Teams`
// labels a role through `ROLE_LABELS` rather than with its own ternary. 01-plan.md § 4.1.
//
// A source-text test, the shape of `tests/member-rpc-roster-team.test.ts`: the real seam and the real
// screens cannot be exercised here without a rendered component and a provisioned project, so this
// pins the source text instead — the literal the guard used to compare against, and the import that
// now answers the question in one place (ADR-035).
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));

/** `//` line comments and `/* … *\/` blocks removed, so a mention of the literal in prose (a header
 *  comment explaining the change, for instance) cannot be mistaken for the guard itself. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
}

const FILES = [
  "src/routes/AdminHub.tsx",
  "src/routes/NewSignups.tsx",
  "src/routes/Threshold.tsx",
  "src/routes/Teams.tsx",
  "src/routes/TeamEntries.tsx",
  "src/routes/Holidays.tsx",
  "src/components/AdminLayout.tsx",
  // MIR-17-e, AC-4: the entry, event and navigation affordances.
  "src/routes/EditEntry.tsx",
  "src/routes/EventEditor.tsx",
  "src/routes/EventDetail.tsx",
  "src/components/EventAttendancePanel.tsx",
  "src/components/Sidebar.tsx",
] as const;

// 01-plan.md § 4.1: no match for this, after comments are stripped.
const LITERAL_ROLE_TEST = /\brole\s*(!==|===)\s*"(admin|manager)"/;

describe("MIR-17-b AC-4, MIR-17-e AC-4: the twelve files ask the role helpers", () => {
  for (const file of FILES) {
    const source = readFileSync(repoRoot + file, "utf8");
    const code = stripComments(source);

    it(`AC-4: ${file} has no literal role comparison in its code`, () => {
      expect(code).not.toMatch(LITERAL_ROLE_TEST);
    });

    it(`AC-4: ${file} imports from "@/lib/roles"`, () => {
      expect(source).toMatch(/from\s+"@\/lib\/roles"/);
    });
  }
});

describe("MIR-17-b AC-3: Teams labels each person by their role", () => {
  const source = readFileSync(repoRoot + "src/routes/Teams.tsx", "utf8");

  it("AC-3: Teams.tsx reads the row's label from ROLE_LABELS", () => {
    expect(source).toContain("ROLE_LABELS[person.role]");
  });
});

describe("MIR-17-e: roles.ts no longer carries the MIR-17 placeholder reason", () => {
  const source = readFileSync(repoRoot + "src/lib/roles.ts", "utf8");

  it("roles.ts does not contain \"kept for MIR-17\"", () => {
    expect(source).not.toContain("kept for MIR-17");
  });
});
