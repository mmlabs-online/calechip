// scripts/db-test.mjs — MIR-05 AC-5, without Docker. The refusal and the step list are the two
// things that keep `pnpm db:test` local; the steps themselves need a running stack and are observed
// by the command, not here.

import test from "node:test";
import assert from "node:assert/strict";

import { REFUSED_FLAGS, refusedFlag, steps } from "../db-test.mjs";

test("refusedFlag finds each refused flag in `--flag value` form", () => {
  for (const flag of REFUSED_FLAGS) {
    assert.equal(refusedFlag([flag, "x"]), flag);
  }
});

test("refusedFlag finds each refused flag in `--flag=value` form", () => {
  for (const flag of REFUSED_FLAGS) {
    assert.equal(refusedFlag([flag + "=x"]), flag);
  }
});

test("refusedFlag returns null for no arguments", () => {
  assert.equal(refusedFlag([]), null);
});

test("refusedFlag ignores a flag that only shares a prefix", () => {
  assert.equal(refusedFlag(["--linkedish", "--db-urls"]), null);
});

test("steps() is exactly start, reset --local, test db --local", () => {
  assert.deepEqual(steps(), [
    {
      name: "start",
      args: ["start", "-x", "studio,imgproxy,logflare,vector,edge-runtime,realtime,storage-api,mailpit"],
    },
    { name: "reset", args: ["db", "reset", "--local"] },
    { name: "test", args: ["test", "db", "--local", "supabase/tests"] },
  ]);
});

test("reset and test both carry --local", () => {
  const byName = Object.fromEntries(steps().map((s) => [s.name, s.args]));
  assert.ok(byName.reset.includes("--local"));
  assert.ok(byName.test.includes("--local"));
});
