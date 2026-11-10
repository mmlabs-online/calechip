// MIR-17-c, ADR-090 decision 1 — the worklist's decide affordance follows the per-team decider,
// read through `listEntryOwners`, rather than the caller's global rank alone.
//
// The mock models one team per person (01-plan.md § 1, "The mock seam"), so it cannot show a
// second-team manager. This pins the SOURCE TEXT instead, in the shape
// tests/member-rpc-roster-team.test.ts uses, so the rule the mock cannot exercise is still checked
// mechanically rather than left to a reviewer's read of the diff.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(repoRoot + "src/routes/PendingEntries.tsx", "utf8");

describe("MIR-17-c: PendingEntries draws a row's controls from the per-team decider", () => {
  it("AC-3: a row's controls read view.owners.has(entry.memberId), and mayDecideEntriesOf is gone", () => {
    expect(source).toContain("view.owners.has(entry.memberId)");
    expect(source).not.toContain("mayDecideEntriesOf(");
  });

  it("AC-4: the not-decidable sentence says what is true", () => {
    expect(source).toContain("You cannot decide this entry.");
    expect(source).not.toContain("Your own entry — an admin decides it.");
  });

  it("AC-5: the mayDecide(me.role) refusal is checked after listEntryOwners( is called in reload", () => {
    const ownersCallIndex = source.indexOf("listEntryOwners(");
    const refusalIndex = source.indexOf("mayDecide(me.role)");

    expect(ownersCallIndex).toBeGreaterThan(-1);
    expect(refusalIndex).toBeGreaterThan(-1);
    expect(refusalIndex).toBeGreaterThan(ownersCallIndex);
  });
});
