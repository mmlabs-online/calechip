// MIR-21-c, ADR-080 decision 1 — the three seam methods that return a `public.member` row from an
// RPC read the roster team, not the column.
//
// `set_member_role`, `set_member_team` and `promote_member_to_admin` return a whole `public.member`
// row, and that row's `team_id` is the column. MIR-21-d stops the writers assigning the column, so
// from then on it goes stale. Each call therefore asks PostgREST for `MEMBER_COLUMNS`, whose
// `team_id` is the computed field `roster_team_id` (ADR-077 decision 2).
//
// The real seam cannot run without a provisioned project, so this pins its source text, the shape
// tests/roster-excludes-signups.test.ts uses. The database half is supabase/tests/250 AC-6.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const repoRoot = fileURLToPath(new URL("..", import.meta.url));
const source = readFileSync(repoRoot + "src/lib/data/supabase.ts", "utf8");

/** The text from `.rpc("<name>"` to the end of its statement, the next `;`. Empty when absent. */
function rpcStatement(name: string): string {
  const start = source.indexOf(`.rpc("${name}"`);
  if (start < 0) return "";
  const end = source.indexOf(";", start);
  return source.slice(start, end < 0 ? undefined : end);
}

describe("MIR-21-c: the row-returning member RPCs read the roster team", () => {
  for (const name of ["set_member_role", "set_member_team", "promote_member_to_admin"]) {
    it(`AC-7: rpc("${name}") is followed by .select(MEMBER_COLUMNS) before the statement ends`, () => {
      const statement = rpcStatement(name);
      expect(statement.length).toBeGreaterThan(0);
      expect(statement).toContain(".select(MEMBER_COLUMNS)");
    });
  }

  it("AC-7: MEMBER_COLUMNS reads team_id from the computed field roster_team_id", () => {
    const match = source.match(/const MEMBER_COLUMNS\s*=\s*"([^"]*)"/);
    expect(match).not.toBeNull();
    expect(match![1]).toContain("team_id:roster_team_id");
  });
});
