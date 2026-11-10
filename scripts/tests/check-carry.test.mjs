// scripts/check-carry.mjs and the context builder behind it — ADR-043.
//
// **What is under test is the seam, not `planCarry` again.** `entry.test.mjs` already pins the
// carried/stray rules. What ADR-043 added is that review check R1 now reaches those rules through a
// command instead of through prose, so the assertions here are about the two things that can break
// between the rule and the reviewer: the context builder reading the right files off disk, and the
// CLI turning carried/stray into the right exit code.
//
// The case that motivated the ADR is the last test: a sibling BACKLOG shell from the same PROMOTE —
// the shape of `.ai/board/tickets/CAL-12/`, which R1 failed CAL-11 on while the runner's preflight,
// calling the same function, called it carried.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

import { carryContext, planCarry, inAllowedPaths, splitStrayByLanded } from "../lib/entry.mjs";
import { readTicket, readFrontMatter } from "../lib/ticket-yaml.mjs";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const CLI = path.join(ROOT, "scripts", "check-carry.mjs");

function scratch() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "carry-"));
  fs.mkdirSync(path.join(dir, "tickets"), { recursive: true });
  fs.mkdirSync(path.join(dir, "ideas"), { recursive: true });
  return dir;
}

const ticketYaml = (id, state, extra = "") =>
  `id: ${id}\nstate: ${state}\nallowed_paths:\n  - "src/**"\n${extra}`;

test("inAllowedPaths: ** spans directories, * stays inside one segment", () => {
  assert.ok(inAllowedPaths("src/lib/data/mock.ts", ["src/**"]));
  assert.ok(inAllowedPaths("src/a.ts", ["src/*.ts"]));
  assert.equal(inAllowedPaths("src/lib/a.ts", ["src/*.ts"]), false);
  assert.equal(inAllowedPaths("tests/a.ts", ["src/**"]), false);
  assert.equal(inAllowedPaths("src/a.ts", []), false);
  assert.equal(inAllowedPaths("src/a.ts", undefined), false);
});

test("carryContext reads the sibling's state and the idea front-matter off disk", () => {
  const dir = scratch();
  const ideaRel = ".ai/board/ideas/2026-09-22-two-tickets.md";
  fs.writeFileSync(path.join(dir, "ideas", "2026-09-22-two-tickets.md"),
    `---\nticket_id: A-01\nverdict: PROMOTE\n---\n\nbody\n`);
  fs.mkdirSync(path.join(dir, "tickets", "A-01"));
  fs.mkdirSync(path.join(dir, "tickets", "A-02"));
  fs.writeFileSync(path.join(dir, "tickets", "A-01", "ticket.yaml"),
    ticketYaml("A-01", "REVIEW", `# Provenance: ${ideaRel}\n`));
  fs.writeFileSync(path.join(dir, "tickets", "A-02", "ticket.yaml"),
    ticketYaml("A-02", "BACKLOG", `# Provenance: ${ideaRel}\n`));

  const dirty = [".ai/board/tickets/A-02/ticket.yaml"];
  const ctx = carryContext({ id: "A-01", allowed_paths: ["src/**"] }, dirty, {
    readFrontMatter, readTicket,
    ticketsDir: path.join(dir, "tickets"),
    ideasDir: path.join(dir, "ideas"),
  });

  assert.equal(ctx.id, "A-01");
  assert.deepEqual(ctx.allowedPaths, ["src/**"]);
  // The sibling was read from disk, with its real state — not inferred from the path.
  assert.deepEqual(ctx.siblings.map((s) => [s.id, s.state]), [["A-02", "BACKLOG"]]);
  // Every idea on disk is offered, committed or not: the promoting idea is usually already committed
  // by the time the second ticket of a PROMOTE runs.
  assert.deepEqual(ctx.ideas.map((i) => i.path), [ideaRel]);
  assert.equal(ctx.ideas[0].fm.ticket_id, "A-01");
});

test("carryContext survives an unreadable sibling rather than throwing", () => {
  const dir = scratch();
  fs.mkdirSync(path.join(dir, "tickets", "A-01"));
  fs.mkdirSync(path.join(dir, "tickets", "B-99"));
  fs.writeFileSync(path.join(dir, "tickets", "A-01", "ticket.yaml"), ticketYaml("A-01", "REVIEW"));
  fs.writeFileSync(path.join(dir, "tickets", "B-99", "ticket.yaml"), ":::not yaml:::");

  const ctx = carryContext({ id: "A-01" }, [".ai/board/tickets/B-99/ticket.yaml"], {
    readFrontMatter, readTicket,
    ticketsDir: path.join(dir, "tickets"),
    ideasDir: path.join(dir, "ideas"),
  });
  // A sibling whose state cannot be read is not BACKLOG, so planCarry leaves it stray. Silently
  // carrying it would be the wrong direction to fail in.
  const { stray } = planCarry([".ai/board/tickets/B-99/ticket.yaml"], ctx);
  assert.deepEqual(stray, [".ai/board/tickets/B-99/ticket.yaml"]);
});

test("the CLI exits 2 on an unknown ticket rather than guessing", () => {
  let code = 0;
  try {
    execFileSync(process.execPath, [CLI, "ZZZ-99"], { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
  } catch (e) { code = e.status; }
  assert.equal(code, 2);
});

test("the CLI requires a ticket id", () => {
  let code = 0;
  try {
    execFileSync(process.execPath, [CLI], { cwd: ROOT, encoding: "utf8", stdio: "pipe" });
  } catch (e) { code = e.status; }
  assert.equal(code, 2);
});

test("a sibling BACKLOG shell from the same PROMOTE is carried — the CAL-12 case", () => {
  const dir = scratch();
  const ideaRel = ".ai/board/ideas/2026-09-22-same-promote.md";
  fs.writeFileSync(path.join(dir, "ideas", "2026-09-22-same-promote.md"),
    `---\nticket_id: A-01\n---\n`);
  for (const [id, state] of [["A-01", "REVIEW"], ["A-02", "BACKLOG"]]) {
    fs.mkdirSync(path.join(dir, "tickets", id));
    fs.writeFileSync(path.join(dir, "tickets", id, "ticket.yaml"),
      ticketYaml(id, state, `# Provenance: ${ideaRel}\n`));
  }
  const deps = {
    readFrontMatter, readTicket,
    ticketsDir: path.join(dir, "tickets"), ideasDir: path.join(dir, "ideas"),
  };
  const t = { id: "A-01", allowed_paths: ["src/**"] };

  // Holding nothing but ticket.yaml: carried.
  const one = [".ai/board/tickets/A-02/ticket.yaml"];
  assert.deepEqual(planCarry(one, carryContext(t, one, deps)).stray, []);

  // The same shell once it holds an artifact: it was demoted from PLAN, not freshly promoted, so it
  // is this ticket's problem again.
  const two = [...one, ".ai/board/tickets/A-02/01-plan.md"];
  assert.deepEqual(planCarry(two, carryContext(t, two, deps)).stray.sort(), two.slice().sort());
});

test("splitStrayByLanded separates a stale tree from unmerged work", () => {
  // The CAL-11 shape: nine paths stray, every one already byte-identical on origin/main because an
  // ops/<slug> landing pushed them and did not restore the tree. Nothing is at risk; the fix is to
  // restore, not to land. Telling those two apart is the whole point of the split.
  const onMain = new Set([".ai/registry/rules.md", "scripts/check-carry.mjs"]);
  const { landed, real } = splitStrayByLanded(
    [".ai/registry/rules.md", "scripts/check-carry.mjs", "scripts/brand-new.mjs"],
    (p) => onMain.has(p));

  assert.deepEqual(landed, [".ai/registry/rules.md", "scripts/check-carry.mjs"]);
  assert.deepEqual(real, ["scripts/brand-new.mjs"]);
});

test("splitStrayByLanded keeps every path in exactly one half", () => {
  const stray = ["a", "b", "c", "d"];
  for (const pred of [() => true, () => false, (p) => p < "c"]) {
    const { landed, real } = splitStrayByLanded(stray, pred);
    assert.equal(landed.length + real.length, stray.length);
    assert.deepEqual([...landed, ...real].sort(), stray.slice().sort());
  }
  assert.deepEqual(splitStrayByLanded([], () => true), { landed: [], real: [] });
});
