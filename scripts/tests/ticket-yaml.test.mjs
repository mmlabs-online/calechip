// scripts/lib/ticket-yaml.mjs — the runner's reader for `ticket.yaml` and artifact front-matter.
//
// **The last test in this file is the one that matters.** It parses every real `ticket.yaml` on the
// board, because the parser's job is not to implement YAML — it is to read what 36 tickets actually
// wrote. The first draft of it refused block sequences and block scalars, which meant it parsed the
// template and none of the board: `allowed_paths` is a block sequence on all 36, and `schema_delta`
// is a folded block scalar on five, because Definition of Ready item 4 asks for an argument and the
// argument did not fit on one line.
//
// The parser throws rather than guesses. A routing input that silently mis-parses sends a ticket to
// the wrong agent; one that refuses stops the run with a file and a line number.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { parseSimpleYaml, readTicket, readFrontMatter, STATES, branchFor } from "../lib/ticket-yaml.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const TICKETS = path.join(ROOT, ".ai", "board", "tickets");

const tmpFile = (name, body) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "ticket-yaml-"));
  const f = path.join(d, name);
  fs.writeFileSync(f, body);
  return f;
};

// --- Scalars -------------------------------------------------------------------------------------

test("scalars keep their types", () => {
  const y = parseSimpleYaml([
    "id: CAL-10",
    'title: ""',
    "rework_count: 0",
    "requires_adr: false",
    "branch:",
  ].join("\n"));
  assert.equal(y.id, "CAL-10");
  assert.equal(y.title, "");
  assert.equal(y.rework_count, 0);
  assert.equal(y.requires_adr, false);
});

test("a trailing comment is stripped, but a # inside a quoted string is not", () => {
  const y = parseSimpleYaml('state: BACKLOG   # set at triage\ntitle: "a # in prose"');
  assert.equal(y.state, "BACKLOG");
  assert.equal(y.title, "a # in prose");
});

// --- Collections ---------------------------------------------------------------------------------

test("inline lists and maps", () => {
  const y = parseSimpleYaml([
    "feature_ids: [CAL-10, CAL-11]",
    "depends_on: []",
    "tracker: { provider: \"\", external_id: \"\", sync_enabled: false }",
  ].join("\n"));
  assert.deepEqual(y.feature_ids, ["CAL-10", "CAL-11"]);
  assert.deepEqual(y.depends_on, []);
  assert.equal(y.tracker.sync_enabled, false);
});

test("block sequences, including with a comment block between the key and its first item", () => {
  const y = parseSimpleYaml([
    "allowed_paths:",
    "                      # the guard exempts the ticket's own folder",
    "                      # so it is absent deliberately",
    '  - "src/App.tsx"',
    '  - "tests/e2e/cal-10.spec.ts"',
    "schema_delta: none",
  ].join("\n"));
  assert.deepEqual(y.allowed_paths, ["src/App.tsx", "tests/e2e/cal-10.spec.ts"]);
  assert.equal(y.schema_delta, "none");
});

test("one level of nested mapping", () => {
  const y = parseSimpleYaml([
    "gates:",
    "  plan:   { passed: true, at: 2026-09-05T00:03:06+07:00 }",
    "  review: { passed: false, at: null }",
  ].join("\n"));
  assert.equal(y.gates.plan.passed, true);
  assert.equal(y.gates.review.passed, false);
  assert.equal(y.gates.review.at, null);
});

test("a folded block scalar becomes one string", () => {
  const y = parseSimpleYaml([
    "schema_delta: >-",
    "  NOT none — ADR-014, no carve-out. CORRECTED from `none`",
    "  by tech-lead-design at PLAN.",
    "requires_adr: true",
  ].join("\n"));
  assert.equal(y.schema_delta,
    "NOT none — ADR-014, no carve-out. CORRECTED from `none` by tech-lead-design at PLAN.");
  assert.equal(y.requires_adr, true, "the key after a block scalar must still be read");
});

test("a literal block scalar keeps its line breaks", () => {
  const y = parseSimpleYaml(["note: |", "  first", "  second", "state: DONE"].join("\n"));
  assert.equal(y.note, "first\nsecond");
  assert.equal(y.state, "DONE");
});

// --- Refusals ------------------------------------------------------------------------------------

test("a key that is both a list and a map is refused, not merged", () => {
  assert.throws(() => parseSimpleYaml(["x:", "  - a", "  b: 1"].join("\n")), /cannot also be a map/);
  assert.throws(() => parseSimpleYaml(["x:", "  b: 1", "  - a"].join("\n")), /cannot also be a list/);
});

test("errors name the line", () => {
  assert.throws(() => parseSimpleYaml("id: X\nthis is prose\n", "t.yaml"), /t\.yaml:2/);
});

test("readTicket refuses a ticket with no id or no state", () => {
  assert.throws(() => readTicket(tmpFile("ticket.yaml", "state: BACKLOG\n")), /has no `id`/);
  assert.throws(() => readTicket(tmpFile("ticket.yaml", "id: X-01\n")), /has no `state`/);
});

// --- Front-matter --------------------------------------------------------------------------------

test("front-matter is read, and its absence is a different answer from an empty one", () => {
  const withFm = tmpFile("a.md", "---\ngate: PASS\nverdict: PASS\n---\n\n# Body\n");
  assert.equal(readFrontMatter(withFm).gate, "PASS");

  const without = tmpFile("b.md", "# Body only\n");
  assert.equal(readFrontMatter(without), null);

  assert.equal(readFrontMatter(path.join(os.tmpdir(), "definitely-absent.md")), null);
});

test("only the first --- block is read, so a horizontal rule in the body is not front-matter", () => {
  const f = tmpFile("c.md", "---\ngate: FAIL\n---\n\n# Body\n\n---\n\ngate: PASS\n");
  assert.equal(readFrontMatter(f).gate, "FAIL");
});

// --- Constants -----------------------------------------------------------------------------------

test("the state enum matches the operating model, in order", () => {
  const model = fs.readFileSync(path.join(ROOT, ".ai", "01-operating-model.md"), "utf8");
  const line = /^`TRIAGE`.*$/m.exec(model);
  assert.ok(line, "the operating model no longer states the enum on one line starting `TRIAGE`");
  const inModel = [...line[0].matchAll(/`([A-Z_]+)`/g)].map((m) => m[1]);
  assert.deepEqual(STATES, inModel,
    "STATES and `.ai/01-operating-model.md` disagree about the state enum");
});

test("the branch name is computed, never read from ticket.yaml", () => {
  assert.equal(branchFor("CAL-10"), "feat/CAL-10");
});

// --- The board itself ----------------------------------------------------------------------------

test("every ticket.yaml on the board parses, with a state in the enum", () => {
  const dirs = fs.existsSync(TICKETS) ? fs.readdirSync(TICKETS) : [];
  const files = dirs
    .map((d) => path.join(TICKETS, d, "ticket.yaml"))
    .filter((f) => fs.existsSync(f));

  assert.ok(files.length > 0, "no ticket.yaml found — this test would otherwise pass vacuously");

  for (const f of files) {
    const t = readTicket(f);
    assert.ok(STATES.includes(t.state), `${path.basename(path.dirname(f))} has state ${t.state}`);
    assert.ok(Array.isArray(t.allowed_paths ?? []), `${t.id} allowed_paths did not read as a list`);
  }
});

// --- Multi-line quoted scalars (MIR-08, run 20261023-044304) ------------------------------------

test("a double-quoted value may run over several indented lines, folded with spaces", () => {
  const y = parseSimpleYaml([
    "gate: BLOCKED",
    'blocking_reason: "pnpm exec eslint . exits 1 on scripts/run-loop.mjs:46:7, \'X\' is unused. That',
    "  file is not in allowed_paths # not a comment inside quotes",
    '  and git log -1 resolves to a73808d."',
    "next_state: IN_PROGRESS",
  ].join("\n"));
  assert.equal(y.gate, "BLOCKED");
  assert.equal(y.next_state, "IN_PROGRESS");
  assert.equal(y.blocking_reason,
    "pnpm exec eslint . exits 1 on scripts/run-loop.mjs:46:7, 'X' is unused. That file is not in " +
    "allowed_paths # not a comment inside quotes and git log -1 resolves to a73808d.");
});

test("an escaped quote does not close a multi-line value, and an unclosed one throws", () => {
  const y = parseSimpleYaml(['r: "a \\"b\\"', '  c"', "k: v"].join("\n"));
  assert.equal(y.r, 'a \\"b\\" c');
  assert.equal(y.k, "v");
  assert.throws(() => parseSimpleYaml(['r: "never', "  closed"].join("\n")), /never closed/);
});

test("single-line quoted values are unchanged", () => {
  const y = parseSimpleYaml(['a: ""', 'b: "x"', "c: 'y'"].join("\n"));
  assert.deepEqual([y.a, y.b, y.c], ["", "x", "y"]);
});
