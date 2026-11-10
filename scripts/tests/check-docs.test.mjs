// Tests for check-docs.mjs.
//
// **D1, group prefixes.** D1 polices feature IDs against a machine-readable list declared in
// features.md. It ships empty, so the interesting cases are both directions: nothing declared means
// nothing checked, and a declared prefix means a dangling ID is reported even when its group table
// is bare — which is exactly the citation an agent writes when it has invented a feature.
//
// **D2, unissued IDs.** A document explaining why a number is missing has to be able to write that
// number. Before this, check-docs.mjs forced the author of `.ai/registry/invariants.md` to split the
// ID across two code spans to get past its own audit — a check editing the prose it is supposed to
// be measuring.
//
// **D11, ADRs cited by ID.** D6 only sees references written as paths. An ADR is cited as "ADR-002",
// so a decision could be cited by three documents while the file recording it did not exist — and
// the citation reads as evidence that somebody decided.
//
// **D12, declared boundaries.** An ADR that names a revert condition is only enforced if something
// looks. The boundary config makes that mechanical instead of remembered.
//
// These build a throwaway project and run the real script against it as a child process, the same
// way the hook tests do. They assert on findings for one check at a time: a minimal fixture trips
// several unrelated checks, so asserting on the exit code alone would pass for the wrong reason.

import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const SCRIPT = path.join(REPO, "scripts", "check-docs.mjs");

const FRONT = ["---", "doc_version: 1", "last_updated: 2026-08-25", "governed_by: [RULE-01]", "---", ""].join("\n");

const LEDGER = [
  "## Ledger",
  "",
  "| ID | Invariant |",
  "|----|-----------|",
  "| INV-01 | An order has at most one active shipment. |",
  "| INV-10 | No two line items reference the same SKU within an order. |",
  "",
].join("\n");

const UNISSUED = [
  "## Unissued IDs",
  "",
  "| ID | Status |",
  "|----|--------|",
  "| INV-09 | Never issued. Never will be. |",
  "",
].join("\n");

/**
 * @param invariantsBody sections of .ai/registry/invariants.md, after the front-matter
 * @param docBody        a document under .ai/standards/ that cites invariant IDs
 * @param extra          any further files, keyed by repo-relative path, written verbatim
 */
function project(invariantsBody, docBody, extra = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "aifw-docs-"));
  const write = (rel, body) => {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, body);
  };

  write(".ai/registry/invariants.md", FRONT + "# Domain invariants\n\n" + invariantsBody);
  write(".ai/registry/rules.md", FRONT + "| RULE-01 | Registry is read-only. | 1 | CLAUDE.md |\n");
  write(".ai/registry/features.md", FRONT + "| ID | Title |\n|----|-------|\n");
  write(".ai/standards/probe.md", FRONT + docBody + "\n");
  for (const [rel, body] of Object.entries(extra)) write(rel, body);
  return root;
}

function run(root) {
  const res = spawnSync(process.execPath, [SCRIPT], { cwd: root, encoding: "utf8" });
  const stdout = res.stdout ?? "";

  // Findings grouped by check, so an unrelated check failing in a minimal fixture cannot make a
  // test pass or fail for a reason it is not about. Asserting on the exit code alone would.
  // Keyed by "KIND Dn", not by "Dn". PENDING and WARN blocks use the same row shape as FAIL, and
  // folding them together made findings("D6") return deferred paths as if they were errors —
  // which is precisely the distinction the phase-aware branch exists to draw.
  const bySection = new Map();
  let current = null;
  for (const line of stdout.split("\n")) {
    const header = /^(FAIL|WARN|PENDING)\s+(D\d+)\b/.exec(line);
    if (header) {
      current = `${header[1]} ${header[2]}`;
      bySection.set(current, []);
      continue;
    }
    if (current && line.trim().startsWith("- ")) bySection.get(current).push(line.trim());
    else if (line.trim() === "") current = null;
  }

  const failures = (check) => bySection.get(`FAIL ${check}`) ?? [];

  return {
    code: res.status,
    stdout,
    findings: failures,
    warnings: (check) => bySection.get(`WARN ${check}`) ?? [],
    pending: (check) => bySection.get(`PENDING ${check}`) ?? [],
    notes: stdout.split("\n").filter((l) => l.startsWith("note: ")),
    d2: failures("D2").filter((l) => /INV-\d{2}/.test(l)),
  };
}

/** A decisions directory holding the named ADRs, plus whatever a test adds. */
const decisions = (...ids) =>
  Object.fromEntries(
    ids.map((id) => [`.ai/registry/decisions/${id}-something.md`, FRONT + `# ${id}\n`])
  );

/** A features.md declaring the given group prefixes, plus optional rows. */
const featuresWith = (prefixes, rows = []) =>
  FRONT +
  "# Feature registry\n\n" +
  `<!-- id-prefixes: ${prefixes.join(" ")} -->\n\n` +
  "| ID | Title |\n|----|-------|\n" +
  rows.map((r) => `| ${r} | something |\n`).join("");

/** A boundaries.json declaring the given boundaries. */
const boundaries = (...entries) =>
  JSON.stringify({ boundaries: entries }, null, 2);

// --- D1: group prefixes are declared, not inferred ---------------------------------------------

test("with no id-prefixes declared, D1 checks nothing and says so", () => {
  const r = run(project(LEDGER + UNISSUED, "This mentions ORD-01, which does not exist."));
  assert.deepEqual(r.findings("D1"), []);
  assert.ok(
    r.notes.some((n) => /D1 checked nothing/.test(n)),
    `the report must say D1 was unconfigured, got:\n${r.stdout}`
  );
});

test("a declared prefix makes a dangling ID a D1 finding", () => {
  const r = run(
    project(LEDGER + UNISSUED, "This mentions ORD-01.", {
      ".ai/registry/features.md": featuresWith(["ORD"]),
    })
  );
  assert.equal(r.code, 1);
  assert.equal(r.findings("D1").length, 1);
  assert.match(r.findings("D1")[0], /references feature ORD-01, absent from features\.md/);
});

test("a declared prefix with a matching row resolves", () => {
  const r = run(
    project(LEDGER + UNISSUED, "This mentions ORD-01.", {
      ".ai/registry/features.md": featuresWith(["ORD"], ["ORD-01"]),
    })
  );
  assert.deepEqual(r.findings("D1"), []);
});

test("a prefix declared with no rows still polices its IDs", () => {
  // The whole reason prefixes are declared rather than inferred from the rows. A group that has been
  // reserved and never populated is exactly where an invented ID lands, and inferring the prefix set
  // from the rows would make that group invisible.
  const r = run(
    project(LEDGER + UNISSUED, "This mentions PAY-03.", {
      ".ai/registry/features.md": featuresWith(["ORD", "PAY"], ["ORD-01"]),
    })
  );
  assert.equal(r.findings("D1").length, 1);
  assert.match(r.findings("D1")[0], /PAY-03/);
});

test("an undeclared prefix is invisible to D1, which is why the line matters", () => {
  // Documents the limit rather than pretending it away: D1 can only police prefixes it was told
  // about. A group missing from the id-prefixes line is a group with no audit.
  const r = run(
    project(LEDGER + UNISSUED, "This mentions PAY-03.", {
      ".ai/registry/features.md": featuresWith(["ORD"]),
    })
  );
  assert.deepEqual(r.findings("D1"), []);
});

test("the reserved example prefix is dropped, with a note", () => {
  // Every worked example in this kit cites EXA-01, and D1 exempts only .ai/templates/ and
  // features.md. A project that declared EXA as a real group would be policing the operating model,
  // the standards and the commands — a dozen documents it never wrote, none of which it should edit.
  const r = run(
    project(LEDGER + UNISSUED, "This mentions EXA-01.", {
      ".ai/registry/features.md": featuresWith(["EXA"]),
    })
  );
  assert.deepEqual(r.findings("D1"), []);
  assert.ok(
    r.notes.some((n) => /reserved/.test(n) && /EXA/.test(n)),
    `the report must say EXA was ignored and why, got:\n${r.stdout}`
  );
});

test("reserving EXA does not disable the prefixes declared beside it", () => {
  const r = run(
    project(LEDGER + UNISSUED, "This mentions EXA-01 and ORD-01.", {
      ".ai/registry/features.md": featuresWith(["EXA", "ORD"]),
    })
  );
  assert.equal(r.findings("D1").length, 1);
  assert.match(r.findings("D1")[0], /ORD-01/);
});

test("templates are exempt from D1 — they carry example IDs by definition", () => {
  const r = run(
    project(LEDGER + UNISSUED, "x", {
      ".ai/registry/features.md": featuresWith(["ORD"]),
      ".ai/templates/ticket.yaml": "id: ORD-01\n",
      ".ai/templates/probe.md": FRONT + "Copy this for ORD-01.\n",
    })
  );
  assert.deepEqual(r.findings("D1"), []);
});

test("this repository's real features.md declares well-formed prefixes", () => {
  // Built from the real file per "Fixtures that share the implementation's assumptions" in
  // testing-standards.md. This asserts the shape rather than the three specific letters, so adding a
  // group through an ADR does not break it — but declaring one badly does.
  const real = fs.readFileSync(path.join(REPO, ".ai/registry/features.md"), "utf8");
  const declared = /<!--\s*id-prefixes:\s*([^>]*?)-->/.exec(real);
  assert.ok(declared, "the id-prefixes line has been removed from features.md — D1 cannot be configured");

  const prefixes = declared[1].trim().split(/\s+/).filter(Boolean);
  assert.ok(prefixes.length > 0, "no prefixes declared, so D1 polices nothing");

  for (const p of prefixes) {
    assert.match(p, /^[A-Z]{3,4}$/, `prefix ${p} is not three or four uppercase letters (four since ADR-059)`);
    assert.notEqual(p, "EXA", "EXA is reserved for this kit's worked examples and cannot be a group");
  }
  assert.equal(new Set(prefixes).size, prefixes.length, "a prefix is declared twice");
});

test("every declared prefix has a group section, and every group section is declared", () => {
  // The failure this catches is a prefix nobody made a table for: D1 would police IDs in a group
  // that has nowhere to put a row, so the only way to satisfy it would be to stop citing the ID.
  const real = fs.readFileSync(path.join(REPO, ".ai/registry/features.md"), "utf8");
  const declared = /<!--\s*id-prefixes:\s*([^>]*?)-->/.exec(real)[1].trim().split(/\s+/).filter(Boolean);

  const sections = [...real.matchAll(/^##\s+([A-Z]{3,4})\s+—/gm)].map((m) => m[1]);

  assert.deepEqual(
    [...sections].sort(),
    [...declared].sort(),
    "the declared prefixes and the group sections disagree"
  );
});

// --- D2: the unissued path ---------------------------------------------------------------------

test("citing an unissued ID does not fail D2", () => {
  const r = run(project(LEDGER + UNISSUED, "The ledger skips INV-09 deliberately."));
  assert.deepEqual(r.d2, [], "INV-09 is listed under Unissued IDs and must resolve");
});

test("an unissued ID is not treated as issued", () => {
  // The Unissued table uses the same row shape as the ledger. A file-wide regex would read INV-09
  // as a real invariant, which is the precise opposite of what that section declares.
  const r = run(project(LEDGER + UNISSUED, "x"));
  assert.match(r.stdout, /docs-audit/);
  assert.ok(
    !r.stdout.includes("INV-09 is in both"),
    "a clean file must not report the both-tables contradiction"
  );
});

test("an issued ID still resolves alongside an unissued one", () => {
  const r = run(project(LEDGER + UNISSUED, "See INV-01 and INV-10, and note the gap at INV-09."));
  assert.deepEqual(r.d2, []);
});

test("prose mentions inside the Unissued section do not become unissued IDs", () => {
  // "The next invariant issued will be INV-11" is a forward-looking sentence, not a row. Citing
  // INV-11 from another document must still fail.
  const unissuedWithProse = UNISSUED + "\nThe next invariant issued will be INV-11.\n\n";
  const r = run(project(LEDGER + unissuedWithProse, "Depends on INV-11."));
  assert.equal(r.d2.length, 1);
  assert.match(r.d2[0], /references INV-11, absent from invariants\.md/);
});

test("citing an ID that is neither issued nor unissued fails D2", () => {
  const r = run(project(LEDGER + UNISSUED, "Held by INV-42."));
  assert.equal(r.code, 1);
  assert.equal(r.d2.length, 1);
  assert.match(r.d2[0], /probe\.md: references INV-42, absent from invariants\.md/);
});

test("the unissued table does not whitelist every ID", () => {
  const r = run(project(LEDGER + UNISSUED, "INV-09 is fine but INV-08 was never added to this ledger."));
  assert.equal(r.d2.length, 1, `expected only INV-08 to fail, got: ${r.d2.join(" | ")}`);
  assert.match(r.d2[0], /INV-08/);
});

test("with no Unissued section at all, D2 behaves as it did before", () => {
  const r = run(project(LEDGER, "The gap at INV-09."));
  assert.equal(r.code, 1);
  assert.equal(r.d2.length, 1);
  assert.match(r.d2[0], /references INV-09, absent from invariants\.md/);
});

test("invariants.md may cite anything, including a future ID", () => {
  // The registry file is exempt from D2 against itself; the file has to be able to discuss IDs it
  // does not list.
  const body = LEDGER + UNISSUED + "\nThe next invariant issued will be INV-11.\n";
  const r = run(project(body, "x"));
  assert.deepEqual(r.d2, []);
});

test("an ID in both tables is reported rather than silently dropped", () => {
  const contradiction = [
    "## Ledger",
    "",
    "| ID | Invariant |",
    "|----|-----------|",
    "| INV-01 | An order has at most one active shipment. |",
    "| INV-09 | Something. |",
    "",
  ].join("\n");
  const r = run(project(contradiction + UNISSUED, "x"));
  assert.equal(r.code, 1);
  assert.match(r.stdout, /INV-09 is in both the ledger and the Unissued IDs table/);
});

test("an empty ledger is reported as unconfigured rather than passing silently", () => {
  const r = run(project("## Ledger\n\n| ID | Invariant |\n|----|-----------|\n", "x"));
  assert.ok(
    r.notes.some((n) => /D2 has an empty ledger/.test(n)),
    `the report must say the ledger is empty, got:\n${r.stdout}`
  );
});

test("this repository's real invariants.md has a contiguous ledger", () => {
  const real = fs.readFileSync(path.join(REPO, ".ai/registry/invariants.md"), "utf8");
  const ids = real
    .split(/\r?\n/)
    .map((l) => /^\|\s*(INV-\d{2})\s*\|/.exec(l)?.[1])
    .filter(Boolean);

  assert.ok(ids.length >= 5, `the ledger has ${ids.length} rows; it was seeded with at least five`);

  // IDs are never renumbered and never reused. A gap means a row was deleted rather than retired
  // through the Unissued IDs table, which is the one way this file loses a reference silently.
  const expected = ids.map((_, i) => `INV-${String(i + 1).padStart(2, "0")}`);
  assert.deepEqual(
    ids,
    expected,
    "ledger IDs are not contiguous from INV-01. A deliberately skipped number belongs in the " +
      "Unissued IDs table, not missing from the ledger."
  );
});

// --- D11: ADRs cited by ID resolve to a file ---------------------------------------------------

test("citing an ADR that exists passes D11", () => {
  const r = run(project(LEDGER + UNISSUED, "The provider decision is ADR-002.", decisions("ADR-002")));
  assert.deepEqual(r.findings("D11"), []);
});

test("citing an ADR with no file fails D11", () => {
  const r = run(project(LEDGER + UNISSUED, "The provider decision is ADR-002.", decisions("ADR-001")));
  assert.equal(r.code, 1);
  assert.equal(r.findings("D11").length, 1);
  assert.match(r.findings("D11")[0], /probe\.md: references ADR-002, which has no file in \.ai\/registry\/decisions\//);
});

test("D11 covers ticket.yaml, where a schema_delta links its approved ADR", () => {
  const r = run(
    project(LEDGER + UNISSUED, "x", {
      ...decisions("ADR-001"),
      ".ai/board/tickets/ORD-01/ticket.yaml": "id: ORD-01\nschema_delta: see ADR-007\n",
    })
  );
  assert.equal(r.findings("D11").length, 1);
  assert.match(r.findings("D11")[0], /ticket\.yaml: references ADR-007/);
});

test("D11 matches an ADR by its file prefix, not the whole filename", () => {
  const r = run(
    project(LEDGER + UNISSUED, "See ADR-002.", {
      ".ai/registry/decisions/ADR-002-a-long-kebab-title.md": FRONT + "# ADR-002\n",
    })
  );
  assert.deepEqual(r.findings("D11"), []);
});

test("templates are exempt from D11 — they carry example IDs by definition", () => {
  const r = run(
    project(LEDGER + UNISSUED, "x", {
      ...decisions("ADR-001"),
      ".ai/templates/tech-design.md": FRONT + "Link the ADR, e.g. ADR-042.\n",
    })
  );
  assert.deepEqual(r.findings("D11"), []);
});

test("the ADR-nnn placeholder is not a reference", () => {
  const r = run(project(LEDGER + UNISSUED, "Copy this to ADR-nnn-title.md.", decisions("ADR-001")));
  assert.deepEqual(r.findings("D11"), []);
});

test("an ADR citing its own ID resolves", () => {
  const r = run(project(LEDGER + UNISSUED, "x", decisions("ADR-001")));
  assert.deepEqual(r.findings("D11"), []);
});

test("with no decisions directory at all, every citation fails", () => {
  const r = run(project(LEDGER + UNISSUED, "See ADR-001."));
  assert.equal(r.findings("D11").length, 1);
  assert.match(r.findings("D11")[0], /ADR-001/);
});

test("every ADR this repository ships is cited-and-resolvable in its own tree", () => {
  // Real-file test. The three carried ADRs cite each other and cite themselves; a rename that broke
  // the ID-to-filename mapping would be invisible to every fixture above.
  const dir = path.join(REPO, ".ai/registry/decisions");
  const ids = fs.readdirSync(dir).map((f) => /^(ADR-\d{3})/.exec(f)?.[1]).filter(Boolean);
  assert.ok(ids.length >= 3, `expected the carried ADRs, found: ${ids.join(", ")}`);
  const extra = Object.fromEntries(
    fs.readdirSync(dir).map((f) => [`.ai/registry/decisions/${f}`, fs.readFileSync(path.join(dir, f), "utf8")])
  );
  const r = run(project(LEDGER + UNISSUED, "x", extra));
  assert.deepEqual(r.findings("D11"), [], `the shipped ADRs must resolve against each other:\n${r.stdout}`);
});

// --- D12: the declared boundaries hold ----------------------------------------------------------
//
// The origin project hard-coded one vendor, one permitted package and one exempt directory here.
// The shape survived generalisation; the constants moved into .ai/registry/boundaries.json, which
// is registry plane and therefore governed by RULE-01 — changing a boundary is changing a decision.

const BOUND = {
  id: "seam-single-door",
  adr: "ADR-002",
  package_prefix: "@vendor/",
  allowed_packages: ["@vendor/server"],
  lint_config: "lint.config.mjs",
  source_roots: ["src"],
  exempt_dirs: ["src/lib/auth/"],
  forbidden_exemption_substring: "lib/data",
  reason: "a client constructed outside the seam is a second path to the datastore",
};

const LINT = (patterns, files = '["src/lib/data/orm/**/*.ts"]') => `
const RESTRICTED = ["error", { patterns: [{ group: ${patterns}, message: "seam" }] }];
export default [
  { rules: { "no-restricted-imports": RESTRICTED } },
  { files: ${files}, rules: { "no-restricted-imports": "off" } },
];
`;

const PKG = (deps = {}) => JSON.stringify({ name: "p", version: "1.0.0", ...deps }, null, 2);

test("with no boundaries declared, D12 checks nothing and says so", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(),
    "package.json": PKG({ dependencies: { "@vendor/browser": "1.0.0" } }),
  }));
  assert.deepEqual(r.findings("D12"), []);
  assert.ok(r.notes.some((n) => /D12 checked nothing/.test(n)), r.stdout);
});

test("a missing boundaries.json is reported as unconfigured, not passed over", () => {
  const r = run(project(LEDGER + UNISSUED, "x", decisions("ADR-002")));
  assert.deepEqual(r.findings("D12"), []);
  assert.ok(r.notes.some((n) => /boundaries\.json is missing/.test(n)), r.stdout);
});

test("a boundaries.json that is not valid JSON is a finding", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ".ai/registry/boundaries.json": "{ this is not json",
  }));
  assert.equal(r.code, 1);
  assert.equal(r.findings("D12").length, 1);
  assert.match(r.findings("D12")[0], /not valid JSON/);
});

test("a forbidden package in the manifest fails D12 and cites its ADR", () => {
  // The dangerous ordering: dependency added, lint list untouched, import unrestricted.
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "package.json": PKG({ dependencies: { next: "16.3.0", "@vendor/browser": "2.0.0" } }),
  }));
  assert.equal(r.code, 1);
  assert.equal(r.findings("D12").length, 1);
  assert.match(r.findings("D12")[0], /dependencies includes @vendor\/browser/);
  assert.match(r.findings("D12")[0], /ADR-002/);
  assert.match(r.findings("D12")[0], /second path to the datastore/);
});

for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
  test(`D12 checks ${field}`, () => {
    const r = run(project(LEDGER + UNISSUED, "x", {
      ...decisions("ADR-002"),
      ".ai/registry/boundaries.json": boundaries(BOUND),
      "package.json": PKG({ [field]: { "@vendor/browser": "1.0.0" } }),
    }));
    assert.equal(r.findings("D12").length, 1, `${field} was not checked`);
    assert.match(r.findings("D12")[0], new RegExp(`${field} includes @vendor/browser`));
  });
}

test("the permitted package alone does not fail D12", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "package.json": PKG({ dependencies: { "@vendor/server": "1.0.0" } }),
    "lint.config.mjs": LINT('["@vendor/"]'),
  }));
  assert.deepEqual(r.findings("D12"), []);
});

test("a package outside the watched prefix is not a boundary breach", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "package.json": PKG({ devDependencies: { vendor: "1.0.0" } }),
  }));
  assert.deepEqual(r.findings("D12"), []);
});

// --- D12 via the lint config: the finding is an ABSENCE -----------------------------------------

test("a permitted package in the tree with no lint restriction fails D12", () => {
  // The inversion. Every other branch reports something present; this one reports something missing,
  // because a package with nothing restricting it is the dangerous state.
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "package.json": PKG({ dependencies: { "@vendor/server": "1.0.0" } }),
    "lint.config.mjs": LINT('["@orm/client"]'),
  }));
  assert.equal(r.code, 1);
  assert.equal(r.findings("D12").length, 1);
  assert.match(r.findings("D12")[0], /no restriction names @vendor\//);
});

test("with the package absent, an unrestricted lint config is not a finding", () => {
  // Nothing to restrict. Reporting here would train people to add restrictions for packages they do
  // not use, which is noise that makes the real finding harder to see.
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "package.json": PKG({ dependencies: { "@orm/client": "1.0.0" } }),
    "lint.config.mjs": LINT('["@orm/client"]'),
  }));
  assert.deepEqual(r.findings("D12"), []);
});

test("an exemption naming the forbidden substring for this vendor fails D12", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "lint.config.mjs": LINT('["@vendor/"]', '["src/lib/data/vendor/**/*.ts"]'),
  }));
  assert.equal(r.findings("D12").length, 1);
  assert.match(r.findings("D12")[0], /exempts a path containing "lib\/data"/);
});

test("the documented blind spot: a vendor-free seam exemption is NOT caught here", () => {
  // Deliberate, and asserted so it stays deliberate. "src/lib/data/**" names no vendor and is
  // indistinguishable by a string scanner from a legitimate exemption beside it. The source-root
  // branch covers the consequence instead: the guard can be loosened silently, the door cannot be
  // opened silently.
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "lint.config.mjs": LINT('["@vendor/"]', '["src/lib/data/**"]'),
  }));
  assert.deepEqual(
    r.findings("D12"),
    [],
    "if this now reports, the check has gained structural parsing and this test should be inverted"
  );
});

test("a comment mentioning the vendor does not fail D12", () => {
  // A check that fired on its own rationale would teach people to delete the rationale.
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "package.json": PKG({ dependencies: { "@vendor/server": "1.0.0" } }),
    "lint.config.mjs":
      "// No @vendor/browser exists here; ADR-002 keeps it out.\n/* @vendor is out of scope */\n" +
      LINT('["@vendor/"]'),
  }));
  assert.deepEqual(r.findings("D12"), []);
});

test("D12 survives glob patterns that contain slash-star and star-slash", () => {
  // The regression that shipped in the origin project: stripping block comments with a regular
  // expression made "@orm/client/*" open a comment which closed inside "**/generated/orm", deleting
  // every entry between them — including the one being looked for. Fixtures with simple patterns did
  // not reproduce it; a realistic pattern list did.
  const realistic = `
const RESTRICTED = ["error", { patterns: [{ group: [
  "@orm/client",
  "@orm/client/*",
  "**/generated/orm",
  "**/generated/orm/**",
  "@vendor/",
  "@/lib/data/orm/**",
  "**/lib/data/orm/**",
], message: "seam" }] }];
export default [{ rules: { "no-restricted-imports": RESTRICTED } }];
`;
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "package.json": PKG({ dependencies: { "@vendor/server": "1.0.0" } }),
    "lint.config.mjs": realistic,
  }));
  assert.deepEqual(
    r.findings("D12"),
    [],
    `the restriction is present in that list and must be seen: ${r.stdout}`
  );
});

test("no lint config at all is not a D12 failure", () => {
  // Before the scaffold there is no lint config. Absence of the file is not a second door.
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "package.json": PKG({ dependencies: { "@vendor/server": "1.0.0" } }),
  }));
  assert.deepEqual(r.findings("D12"), []);
});

// --- D12 via the source tree: the breach itself -------------------------------------------------

test("an import of the prefix outside the exempt directory fails D12", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "src/components/order-list.tsx": 'import { c } from "@vendor/browser";\n',
  }));
  assert.equal(r.code, 1);
  assert.equal(r.findings("D12").length, 1);
  assert.match(r.findings("D12")[0], /order-list\.tsx: names @vendor\/browser outside src\/lib\/auth\//);
});

test("the same import inside the exempt directory passes", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "src/lib/auth/session.ts": 'import { c } from "@vendor/server";\n',
  }));
  assert.deepEqual(r.findings("D12"), []);
});

test("both routes report independently", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/registry/boundaries.json": boundaries(BOUND),
    "package.json": PKG({ dependencies: { "@vendor/browser": "2.0.0" } }),
    "src/components/order-list.tsx": 'import { c } from "@vendor/browser";\n',
  }));
  assert.equal(r.findings("D12").length, 2);
  assert.ok(r.findings("D12").some((l) => l.includes("package.json")));
  assert.ok(r.findings("D12").some((l) => l.includes("order-list.tsx")));
});

test("a boundary with no package_prefix is reported rather than silently skipped", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ".ai/registry/boundaries.json": boundaries({ id: "half-written" }),
  }));
  assert.equal(r.findings("D12").length, 1);
  assert.match(r.findings("D12")[0], /boundary half-written has no package_prefix/);
});

// Real-file tests for the declared boundaries, per "Fixtures that share the implementation's
// assumptions" in testing-standards.md. A hand-written fixture tests whether D12 works on the shape
// its author imagined; only the real file tests whether it works on the one it will actually read.
//
// Both directions, because the way this check fails is by going quiet: silence proves nothing unless
// the same config is also shown to fire.

test("this repository's real boundaries.json parses and declares what it claims", () => {
  const real = fs.readFileSync(path.join(REPO, ".ai/registry/boundaries.json"), "utf8");
  const parsed = JSON.parse(real);
  assert.ok(Array.isArray(parsed.boundaries), "boundaries must be an array");

  for (const b of parsed.boundaries) {
    assert.ok(b.id, "every boundary needs an id, or a finding cannot name it");
    assert.ok(b.package_prefix, `boundary ${b.id} has no package_prefix, so it can check nothing`);
    assert.match(
      b.adr ?? "",
      /^ADR-\d{3}$/,
      `boundary ${b.id} must cite the ADR that decided it, so a finding can be traced to reasoning`
    );
    assert.ok(
      fs.existsSync(path.join(REPO, ".ai/registry/decisions")),
      "the decisions directory must exist for the cited ADR to be findable"
    );
    const adrs = fs.readdirSync(path.join(REPO, ".ai/registry/decisions"));
    assert.ok(
      adrs.some((f) => f.startsWith(b.adr)),
      `boundary ${b.id} cites ${b.adr}, which has no file in .ai/registry/decisions/`
    );
  }
});

test("the real boundaries stay silent against the manifest as it stands", () => {
  const real = fs.readFileSync(path.join(REPO, ".ai/registry/boundaries.json"), "utf8");
  const manifest = fs.readFileSync(path.join(REPO, "package.json"), "utf8");
  const r = run(
    project(LEDGER + UNISSUED, "x", {
      ".ai/registry/boundaries.json": real,
      "package.json": manifest,
    })
  );
  assert.deepEqual(r.findings("D12"), [], "nothing in package.json crosses a declared boundary yet");
});

test("a forbidden package added to the manifest trips the real boundary", () => {
  // The firing direction, injected into a copy of the real config rather than a fixture. If D12
  // silently stopped reading this file, the test above would keep passing and this one would not.
  const real = JSON.parse(fs.readFileSync(path.join(REPO, ".ai/registry/boundaries.json"), "utf8"));
  const b = real.boundaries[0];
  assert.ok(b, "this test describes the declared boundary and is meaningless without one");

  const forbidden = `${b.package_prefix}definitely-not-allowed`;
  const manifest = JSON.parse(fs.readFileSync(path.join(REPO, "package.json"), "utf8"));
  manifest.dependencies = { ...(manifest.dependencies ?? {}), [forbidden]: "^1.0.0" };

  const r = run(
    project(LEDGER + UNISSUED, "x", {
      ".ai/registry/boundaries.json": JSON.stringify(real, null, 2),
      "package.json": JSON.stringify(manifest, null, 2),
    })
  );
  assert.equal(r.findings("D12").length, 1, `expected one D12 finding, got:\n${r.stdout}`);
  assert.match(r.findings("D12")[0], new RegExp(forbidden.replace(/[/\\]/g, "\\$&")));
  assert.match(r.findings("D12")[0], new RegExp(b.id));
});

// --- D9: scoped to documents a human owns ------------------------------------------------------
//
// D9 requires doc_version, last_updated and governed_by. It used to read every .md under .ai/, which
// included agent-produced board artifacts. The first story written under that scope failed it and
// the fields were pasted into the artifact to clear the failure — the check was satisfied rather
// than reported, which is what a check on agent output gets.
//
// The artifact below is built from the REAL story template rather than hand-written, per "Fixtures
// that share the implementation's assumptions" in testing-standards.md. A hand-written stub would
// carry whatever front-matter the author of the scope rule imagined a story carries; the template is
// the file the artifact is actually copied from.

/** The artifact front-matter block a story really carries, read out of the real template. */
function storyArtifact() {
  const tpl = fs.readFileSync(path.join(REPO, ".ai/templates/story.md"), "utf8");
  const block = /```yaml\n([\s\S]*?)```/.exec(tpl);
  assert.ok(block, "the story template no longer contains a fenced yaml front-matter block");
  return block[1] + "\n# Feature\n\nSomething.\n";
}

test("the real story template carries artifact front-matter and no document front-matter", () => {
  // Guards the premise rather than the check. If a future template does carry doc_version, this
  // fails and someone reads why — instead of the scope rule quietly protecting a pasted field.
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(storyArtifact());
  assert.ok(fm, "the artifact block has no front-matter at all");
  for (const field of ["ticket", "stage", "agent", "gate", "chat_before_verdict"]) {
    assert.match(fm[1], new RegExp(`^${field}:`, "m"), `artifact front-matter is missing ${field}`);
  }
  for (const field of ["doc_version", "last_updated", "governed_by"]) {
    assert.ok(
      !new RegExp(`^${field}:`, "m").test(fm[1]),
      `${field} is in the artifact front-matter — the workaround has returned`
    );
  }
});

test("a board artifact is not a D9 finding", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ".ai/board/tickets/ORD-01/01-story.md": storyArtifact(),
  }));
  assert.deepEqual(
    r.findings("D9"),
    [],
    "a board artifact carries artifact front-matter, not document front-matter"
  );
});

test("D9 is scoped by path, not switched off: the same artifact under .ai/standards/ is reported", () => {
  // The failure mode of a narrowing is narrowing to nothing. Same bytes, human-owned plane, and all
  // three findings must appear.
  const r = run(project(LEDGER + UNISSUED, "x", { ".ai/standards/probe2.md": storyArtifact() }));
  const d9 = r.findings("D9").filter((l) => l.includes("probe2.md"));
  assert.equal(d9.length, 3, `expected all three fields reported, got: ${d9.join(" | ")}`);
  assert.ok(d9.some((l) => /no doc_version/.test(l)));
  assert.ok(d9.some((l) => /no last_updated/.test(l)));
  assert.ok(d9.some((l) => /no governed_by/.test(l)));
});

test("a registry document with no front-matter still fails D9", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ".ai/registry/probe3.md": "# No front-matter here\n",
  }));
  assert.equal(r.code, 1);
  assert.equal(r.findings("D9").length, 1);
  assert.match(r.findings("D9")[0], /probe3\.md: has no front-matter/);
});

test("the operating model and the charter stay in scope", () => {
  // Neither is under .ai/registry/, and both are human-owned. The operating model cites more rules in
  // governed_by than any other document, so it is where a rule-version bump goes stale first.
  const r = run(project(LEDGER + UNISSUED, "x", {
    ".ai/00-charter.md": "# Charter\n",
    ".ai/01-operating-model.md": "# Operating model\n",
  }));
  const named = r.findings("D9").filter((l) => /00-charter|01-operating-model/.test(l));
  assert.equal(named.length, 2, `both must be checked, got: ${named.join(" | ")}`);
});

test("templates stay in scope", () => {
  const r = run(project(LEDGER + UNISSUED, "x", { ".ai/templates/story.md": "# Story template\n" }));
  assert.equal(r.findings("D9").filter((l) => l.includes("templates/story.md")).length, 1);
});

test("a rule-version bump the document has not caught up with still fails D9", () => {
  // The half of D9 that does not care about presence: governed_by naming a rule at a version above
  // the document's own. This is step 4 of "Changing a rule" in rules.md.
  const r = run(project(LEDGER + UNISSUED, "x", {
    ".ai/registry/rules.md": FRONT + "| RULE-01 | Registry is read-only. | 2 | CLAUDE.md |\n",
  }));
  const stale = r.findings("D9").filter((l) => /RULE-01 at v2 but doc_version is 1/.test(l));
  assert.ok(stale.length > 0, `expected a version-drift finding, got:\n${r.stdout}`);
});

test("board files other than tickets are out of scope too", () => {
  // backlog.md and metrics.md are written by the orchestrator. A check an agent can silence by
  // editing its own output measures compliance, not the document.
  const r = run(project(LEDGER + UNISSUED, "x", {
    ".ai/board/backlog.md": "# Backlog\n",
    ".ai/board/metrics.md": "# Metrics\n",
  }));
  assert.deepEqual(r.findings("D9").filter((l) => l.includes(".ai/board/")), []);
});

test("every human-owned document this repository ships passes D9 in its own tree", () => {
  // The real-file test for D9. Fixtures prove the rule; this proves the shipped documents obey it.
  const res = spawnSync(process.execPath, [SCRIPT], { cwd: REPO, encoding: "utf8" });
  assert.ok(!/^FAIL D9/m.test(res.stdout ?? ""), `the shipped tree fails D9:\n${res.stdout}`);
});

// --- D13: every Definition of Ready item is satisfiable ----------------------------------------

// NOTE: this fixture enum deliberately puts READY BEFORE SPEC — the ordering the origin project
// had before D13 existed. It is what makes "produced at SPEC" late relative to the gate, which is
// the defect these fixtures exercise. The real .ai/templates/ticket.yaml has the corrected order,
// and the real-document tests further down use it.
const ENUM = "# state enum: IDEA TRIAGE BACKLOG READY SPEC DESIGN IN_PROGRESS REVIEW QA REWORK ESCALATED DONE";

/** An operating model with the given DoR bullet lines. */
const OPMODEL = (items) =>
  FRONT + "# Operating model\n\n## Definition of Ready\n\n" + items.join("\n") + "\n\n## WIP\n\nWIP = 1.\n";

const dorProject = (items, opts = {}) =>
  project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/templates/ticket.yaml": (opts.enumLine ?? ENUM) + "\nid: X\n",
    ".ai/01-operating-model.md": OPMODEL(items),
  });

test("a DoR item produced before READY passes D13", () => {
  const r = run(dorProject(["- `feature_ids` non-empty. Added by a human at BACKLOG."]));
  assert.deepEqual(r.findings("D13"), []);
});

test("a DoR item produced after READY fails D13", () => {
  // The defect this check exists for: DoR gates READY, so a field only SPEC can set is unreachable.
  const r = run(dorProject(["- `size_estimate` is S or M. Set by the BA at SPEC from the story."]));
  assert.equal(r.code, 1);
  assert.equal(r.findings("D13").length, 1);
  assert.match(r.findings("D13")[0], /produced at SPEC, which is after READY/);
  assert.match(r.findings("D13")[0], /can never be satisfied/);
});

test("DESIGN is also after READY", () => {
  const r = run(dorProject(["- `allowed_paths` enumerated at DESIGN."]));
  assert.equal(r.findings("D13").length, 1);
  assert.match(r.findings("D13")[0], /produced at DESIGN/);
});

test("an item attributing no stage fails D13", () => {
  const r = run(dorProject(["- `schema_delta` is `none`, or an approved ADR is linked"]));
  assert.equal(r.findings("D13").length, 1);
  assert.match(r.findings("D13")[0], /names no producing stage/);
});

test("a bare stage mention is not an attribution", () => {
  // "dependencies DONE" is a condition on OTHER tickets. Reading its DONE as this item's producer
  // would report a defect that is not there.
  const r = run(dorProject(["- dependencies `DONE`"]));
  assert.equal(r.findings("D13").length, 1);
  assert.match(r.findings("D13")[0], /names no producing stage/, "must not claim it is produced at DONE");
});

test("`by a human` counts as a producer and is never late", () => {
  const r = run(dorProject(["- every ID present in `features.md`, put there by a human"]));
  assert.deepEqual(r.findings("D13"), []);
});

test("READY itself is at or before READY", () => {
  const r = run(dorProject(["- the orchestrator confirms it at READY."]));
  assert.deepEqual(r.findings("D13"), []);
});

test("an item continued on following lines is read whole", () => {
  const r = run(dorProject([
    "- `size_estimate` is S or M.",
    "  Set by the BA at SPEC from the story scope and its",
    "  Out-of-scope section.",
  ]));
  assert.equal(r.findings("D13").length, 1);
  assert.match(r.findings("D13")[0], /produced at SPEC/);
});

test("an item naming one reachable stage among several passes", () => {
  const r = run(dorProject(["- set by a human at BACKLOG, and re-checked at DESIGN."]));
  assert.deepEqual(r.findings("D13"), []);
});

test("a missing Definition of Ready section is reported", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/templates/ticket.yaml": ENUM + "\nid: X\n",
    ".ai/01-operating-model.md": FRONT + "# Operating model\n\n## WIP\n\nWIP = 1.\n",
  }));
  assert.equal(r.findings("D13").length, 1);
  assert.match(r.findings("D13")[0], /no `## Definition of Ready` section/);
});

test("an empty Definition of Ready is reported", () => {
  const r = run(dorProject([]));
  assert.equal(r.findings("D13").length, 1);
  assert.match(r.findings("D13")[0], /lists no items/);
});

test("a state enum with no READY is reported against the template", () => {
  const r = run(dorProject(["- set by a human at BACKLOG."], { enumLine: "# state enum: IDEA BACKLOG DONE" }));
  assert.equal(r.findings("D13").length, 1);
  assert.match(r.findings("D13")[0], /state enum has no READY/);
});

test("a table DoR reads the Produced at column, not the item text", () => {
  // The item text contains the word DONE. Only the Produced at cell is the attribution.
  const table = [
    "| # | Item | Produced at | By |",
    "|---|------|-------------|-----|",
    "| 1 | Every ticket in `depends_on` is `DONE` | BACKLOG | a human |",
  ];
  const r = run(dorProject(table));
  assert.deepEqual(r.findings("D13"), [], "DONE in the item text must not be read as the producer");
});

test("a table row whose Produced at is after READY fails", () => {
  const table = [
    "| # | Item | Produced at | By |",
    "|---|------|-------------|-----|",
    "| 1 | `allowed_paths` enumerated | DESIGN | `tech-lead-design` |",
  ];
  const r = run(dorProject(table));
  assert.equal(r.findings("D13").length, 1);
  assert.match(r.findings("D13")[0], /produced at DESIGN, which is after READY/);
});

test("a table row with an empty Produced at cell fails", () => {
  const table = [
    "| # | Item | Produced at | By |",
    "|---|------|-------------|-----|",
    "| 1 | `schema_delta` is `none` |  |  |",
  ];
  const r = run(dorProject(table));
  assert.equal(r.findings("D13").length, 1);
  assert.match(r.findings("D13")[0], /names no producing stage/);
});

// --- built from the real 01-operating-model.md --------------------------------------------------
//
// A DoR written by the author of this check would use the phrasing the check expects; the real
// document does not.

const realOpModel = () => fs.readFileSync(path.join(REPO, ".ai/01-operating-model.md"), "utf8");
const realTicketTpl = () => fs.readFileSync(path.join(REPO, ".ai/templates/ticket.yaml"), "utf8");

const realDorProject = (opModel) =>
  project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/01-operating-model.md": opModel,
    ".ai/templates/ticket.yaml": realTicketTpl(),
  });

test("the real Definition of Ready is satisfiable", () => {
  // Every item must attribute a stage, and every attributed stage must sit at or before READY. This
  // is the third placement of this gate; the first two failed it.
  const r = run(realDorProject(realOpModel()));
  assert.deepEqual(r.findings("D13"), [], "the real DoR should be clean under the current ordering");
});

test("D13 catches a regression injected into the real 01-operating-model.md", () => {
  // A check that is green can be green because it is broken. This moves one real DoR item producer
  // past the gate, in the real document, and requires the check to notice.
  const model = realOpModel();
  const regressed = model.replace(/^(\|\s*5\s*\|[^|]*\|\s*)PLAN(\s*\|)/m, "$1IN_PROGRESS$2");
  assert.notEqual(regressed, model, "DoR row 5 not found — update this test to match the document");

  const r = run(realDorProject(regressed));
  assert.equal(r.findings("D13").length, 1, `expected one finding, got:\n${r.stdout}`);
  assert.match(r.findings("D13")[0], /produced at IN_PROGRESS, which is after READY/);
});

test("D13 catches the enum falling out of lifecycle order", () => {
  // Position comes from the state enum. Reordering the lifecycle without reordering the enum would
  // leave the check measuring against the old order and agreeing with a document that has changed.
  const staleEnum = realTicketTpl().replace(
    "# state enum: TRIAGE BACKLOG PLAN READY",
    "# state enum: TRIAGE BACKLOG READY PLAN"
  );
  assert.notEqual(staleEnum, realTicketTpl(), "enum line not found — update this test");

  const r = run(project(LEDGER + UNISSUED, "x", {
    ...decisions("ADR-002"),
    ".ai/01-operating-model.md": realOpModel(),
    ".ai/templates/ticket.yaml": staleEnum,
  }));
  assert.ok(
    r.findings("D13").some((l) => /size_estimate/.test(l) && /after READY/.test(l)),
    `a stale enum must surface as unsatisfiable DoR items, got:\n${r.stdout}`
  );
});

test("D10 holds the real enum and the real stage ownership table to the same membership", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ".ai/01-operating-model.md": realOpModel(),
    ".ai/templates/ticket.yaml": realTicketTpl(),
  }));
  assert.deepEqual(r.findings("D10"), [], `the shipped enum and gate table disagree:\n${r.stdout}`);
});

// --- D5 and D6: scoped the same way D9 is -------------------------------------------------------
//
// Both used to read agent-produced board artifacts. A tech lead wrote a route path into a design and
// D5 reported it as a slash command with no definition. That agent raised the finding instead of
// renaming the route, which is the correct behaviour and precisely the one not to depend on: the
// cheap way out is to make the finding stop appearing.
//
// D6 has the same exposure for a different reason. A design section 5 enumerates `allowed_paths` for
// files the NEXT stage creates, so "does not exist on disk" is the expected state at the moment the
// design is written.

test("a route-shaped token in a board artifact is not a D5 finding", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    ".ai/board/tickets/ORD-01/02-design.md": "The list lives at /orders and the detail at /orders/[id].\n",
  }));
  assert.deepEqual(r.findings("D5"), [], "a route in agent output is not a slash command");
});

test("D5 is scoped by path, not switched off: the same bytes under .ai/standards/ are reported", () => {
  // The failure mode of a narrowing is narrowing to nothing, and a check that fires on no file
  // passes everywhere. Same content, human-owned path.
  const r = run(project(LEDGER + UNISSUED, "x", {
    ".ai/standards/probe-d5.md": FRONT + "The route is /orders and it lists orders.\n",
  }));
  const d5 = r.findings("D5").filter((l) => l.includes("probe-d5.md"));
  assert.equal(d5.length, 1, `expected one D5 finding, got:\n${r.stdout}`);
  // The wording changed when D5 learned to tell a route from a command — it now names both places
  // it looked. The assertion is unchanged in substance: it still fires on a token that is neither.
  assert.match(d5[0], /references \/orders, which is neither a command/);
});

test("D5 still reads .claude/**, which is human-authored configuration", () => {
  // Narrowing to the registry, standards and templates alone would have dropped the agent and
  // command definitions, which is most of what D5 is for.
  const r = run(project(LEDGER + UNISSUED, "x", {
    ".claude/agents/probe.md": "Run /not-a-command and stop.\n",
  }));
  const d5 = r.findings("D5").filter((l) => l.includes(".claude/agents/probe.md"));
  assert.equal(d5.length, 1, `expected D5 to cover .claude/**, got:\n${r.stdout}`);
});

test("every command this repository names in a human-owned document has a file", () => {
  // The real-file test for D5. A command renamed in .claude/commands/ without its callers being
  // updated is exactly the drift this catches, and no fixture would see it.
  const res = spawnSync(process.execPath, [SCRIPT], { cwd: REPO, encoding: "utf8" });
  assert.ok(!/^FAIL D5/m.test(res.stdout ?? ""), `the shipped tree fails D5:\n${res.stdout}`);
});

test("a not-yet-created path in a board artifact is not a D6 finding", () => {
  // The scaffold root has to exist, or the phase-aware branch would defer the path to PENDING and
  // this test would pass without exercising the scope rule at all.
  const r = run(project(LEDGER + UNISSUED, "x", {
    "src/.keep": "",
    ".ai/board/tickets/ORD-01/02-design.md":
      "allowed_paths:\n- `src/app/orders/page.tsx`\n- `src/lib/data/mock/orders.ts`\n",
  }));
  assert.deepEqual(r.findings("D6"), [], "a design names files the next stage creates");
});

test("D6 is scoped by path, not switched off: the same bytes under .ai/standards/ are reported", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    "src/.keep": "",
    ".ai/standards/probe-d6.md": FRONT + "See `src/lib/data/nonexistent.ts`.\n",
  }));
  const d6 = r.findings("D6").filter((l) => l.includes("probe-d6.md"));
  assert.equal(d6.length, 1, `expected one D6 finding, got:\n${r.stdout}`);
  assert.match(d6[0], /src\/lib\/data\/nonexistent\.ts, which does not exist on disk/);
});

// --- D6 and the line-range citation, MD-019 ----------------------------------------------------
//
// Both directions, per .ai/standards/testing-standards.md, because a strip that is too greedy is a
// worse defect than one that is too narrow: it stops reporting real typos in filenames. The pair
// below is the boundary — an existing file cited as a range must PASS, a missing file cited as a
// range must still FAIL, and the second assertion is the one that fails if anybody ever widens this
// to `/:.*$/`.

test("D6 accepts a line-range citation on a file that exists — MD-019", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    "src/routes/Real.tsx": "export {};\n",
    ".ai/standards/probe-d6-range.md": FRONT + "See `src/routes/Real.tsx:33-36`.\n",
  }));
  assert.deepEqual(
    r.findings("D6").filter((l) => l.includes("probe-d6-range.md")),
    [],
    `a range citation to a file that exists must resolve to the file:\n${r.stdout}`
  );
});

test("D6 still reports a missing file cited as a range — the strip is widened, not opened", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    "src/.keep": "",
    ".ai/standards/probe-d6-range-missing.md": FRONT + "See `src/routes/Nope.tsx:1-9`.\n",
  }));
  const d6 = r.findings("D6").filter((l) => l.includes("probe-d6-range-missing.md"));
  assert.equal(d6.length, 1, `expected one D6 finding, got:\n${r.stdout}`);
  assert.match(d6[0], /src\/routes\/Nope\.tsx, which does not exist on disk/);
});

test("D6 defers a path under a scaffold root that does not exist yet", () => {
  // Per root, not global. The origin project keyed this on package.json existing, which is wrong for
  // any repository that carries a package.json as tooling before it carries an implementation.
  const r = run(project(LEDGER + UNISSUED, "x", {
    "package.json": "{}",
    ".ai/standards/probe-d6b.md": FRONT + "See `src/lib/data/nonexistent.ts`.\n",
  }));
  assert.deepEqual(
    r.findings("D6"),
    [],
    "with no src/ on disk the path is deferred, even though package.json exists"
  );
  assert.equal(r.pending("D6").length, 1, r.stdout);
  assert.match(r.pending("D6")[0], /under src\/, which does not exist yet/);
});

test("D6 is strict per root: one root present, another absent", () => {
  const r = run(project(LEDGER + UNISSUED, "x", {
    "src/.keep": "",
    ".ai/standards/probe-d6c.md":
      FRONT + "See `src/gone.ts` and `tests/also-gone.ts`.\n",
  }));
  const d6 = r.findings("D6").filter((l) => l.includes("probe-d6c.md"));
  assert.equal(d6.length, 1, `only the existing root should be strict, got: ${d6.join(" | ")}`);
  assert.match(d6[0], /src\/gone\.ts/);
  assert.match(r.stdout, /tests\/also-gone\.ts — under tests\//);
});

test("D6 defers a path named as absent by design, inside a scaffold root that exists", () => {
  // The scaffold-root branch cannot reach this: tests/ is on disk, so the tree is strict and the one
  // file inside it that is owed rather than broken would be reported as a missing reference.
  const r = run(project(LEDGER + UNISSUED, "x", {
    "tests/.keep": "",
    ".ai/standards/probe-owed.md":
      FRONT + "See `tests/permission-model.test.ts` and `tests/really-gone.ts`.\n",
  }));
  const d6 = r.findings("D6").filter((l) => l.includes("probe-owed.md"));
  assert.equal(d6.length, 1, `only the unregistered path should fail, got:\n${r.stdout}`);
  assert.match(d6[0], /tests\/really-gone\.ts/);
  assert.equal(r.pending("D6").length, 1, r.stdout);
  assert.match(r.pending("D6")[0], /tests\/permission-model\.test\.ts — absent by design: OWED/);
});

test("a declared-absent path that has arrived is an error against the register, not silence", () => {
  // The half that makes the register a control rather than a mute button. A waiver still covering a
  // file that exists reads as current and is the reason to be strict about the second direction.
  const r = run(project(LEDGER + UNISSUED, "x", {
    "tests/permission-model.test.ts": "// arrived\n",
  }));
  const d6 = r.findings("D6");
  assert.equal(d6.length, 1, `expected exactly one D6 finding, got:\n${r.stdout}`);
  assert.match(d6[0], /scripts\/check-docs\.mjs/);
  assert.match(d6[0], /exists on disk — delete its ABSENT_BY_DESIGN row/);
  assert.deepEqual(r.pending("D6"), [], "an arrived path must not also be pending");
});

test("every path the register declares absent is still absent in the shipped tree", () => {
  // The real-file test. The register is asserted against the repository it governs, so a row that
  // has gone stale fails here rather than being discovered by a reader who trusts it.
  const res = spawnSync(process.execPath, [SCRIPT], { cwd: REPO, encoding: "utf8" });
  assert.ok(!/^FAIL D6/m.test(res.stdout ?? ""), `the shipped tree fails D6:\n${res.stdout}`);
});

test("a RETIRED path is deferred on the same footing as an OWED one", () => {
  // The second reason a path is absent by design, and the one that recurs: a shipped ticket deleted
  // the file and a registry row says so in the past tense. `src/` exists, so the scaffold branch is
  // strict and the citation would otherwise be reported as a broken link to history.
  const r = run(project(LEDGER + UNISSUED, "x", {
    "src/.keep": "",
    ".ai/standards/probe-retired.md":
      FRONT + "UIE-02 deleted `src/routes/Home.tsx`. It did not delete `src/routes/Ghost.tsx`.\n",
  }));
  const d6 = r.findings("D6").filter((l) => l.includes("probe-retired.md"));
  assert.equal(d6.length, 1, `only the unregistered path should fail, got:\n${r.stdout}`);
  assert.match(d6[0], /src\/routes\/Ghost\.tsx/);
  assert.equal(r.pending("D6").length, 1, r.stdout);
  assert.match(r.pending("D6")[0], /src\/routes\/Home\.tsx — absent by design: RETIRED/);
});

test("a RETIRED path that comes back is reported too, not only an OWED one", () => {
  // Same control, other reason code. A file returning under its old name makes the register's
  // account of it false, and a reader who trusts the row would be told the file is gone.
  const r = run(project(LEDGER + UNISSUED, "x", {
    "src/routes/Home.tsx": "// came back\n",
  }));
  const d6 = r.findings("D6");
  assert.equal(d6.length, 1, `expected exactly one D6 finding, got:\n${r.stdout}`);
  assert.match(d6[0], /src\/routes\/Home\.tsx exists on disk — delete its ABSENT_BY_DESIGN row/);
});

test("D5, D6 and D9 agree on what is out of scope", () => {
  // One definition, three consumers. If they drift, a board artifact is exempt from one check and
  // not the others, which is worse than either policy applied consistently.
  const artifact = FRONT + "Run /orders. See `src/lib/data/nonexistent.ts`.\n";
  const r = run(project(LEDGER + UNISSUED, "x", {
    "src/.keep": "",
    ".ai/board/metrics.md": artifact,
    ".ai/board/backlog.md": artifact,
    ".ai/board/tickets/ORD-01/04-review.md": artifact,
  }));
  for (const check of ["D5", "D6", "D9"]) {
    assert.deepEqual(
      r.findings(check).filter((l) => l.includes(".ai/board/")),
      [],
      `${check} still reads .ai/board/**`
    );
  }
});

// --- the shipped tree as a whole ----------------------------------------------------------------

test("this repository passes its own audit with zero errors", () => {
  // The acceptance condition for the template: the audit is green on an empty board. If a project
  // adds content that breaks it, this test is the first thing that says so.
  const res = spawnSync(process.execPath, [SCRIPT], { cwd: REPO, encoding: "utf8" });
  assert.equal(res.status, 0, `check-docs.mjs exited ${res.status}:\n${res.stdout}\n${res.stderr}`);
  assert.match(res.stdout, /errors: 0/);
});

// --- D14: a live ticket's gate and chat_budget keys match the template -------------------------
//
// The check that reads real ticket.yaml files. Its whole subtlety is the DONE exemption, so that is
// what most of these fixtures are about: a shipped ticket's retired gate keys are the record of what
// happened, and a check that "fixed" them would be falsifying history.

const TPL = [
  "# state enum: BACKLOG READY IN_PROGRESS REVIEW DONE",
  "id: X",
  "chat_budget:",
  "  developer->tech-lead-design: { used: 0, max: 6 }",
  "gates:",
  "  plan:   { passed: false, at: null }",
  "  review: { passed: false, at: null }",
  "",
].join("\n");

const shell = (state, gates, budget = ["  developer->tech-lead-design: { used: 0, max: 6 }"]) =>
  [`id: T-01`, `state: ${state}`, "chat_budget:", ...budget, "gates:", ...gates, ""].join("\n");

const CURRENT = ["  plan:   { passed: false, at: null }", "  review: { passed: false, at: null }"];
const RETIRED = [
  "  spec:   { passed: false, at: null }",
  "  design: { passed: false, at: null }",
  "  review: { passed: false, at: null }",
  "  qa:     { passed: false, at: null }",
];

const ticketProject = (tickets, tpl = TPL) =>
  project(LEDGER + UNISSUED, "x", {
    ".ai/templates/ticket.yaml": tpl,
    ...Object.fromEntries(
      Object.entries(tickets).map(([id, body]) => [`.ai/board/tickets/${id}/ticket.yaml`, body])
    ),
  });

test("a shell whose keys match the template passes D14", () => {
  const r = run(ticketProject({ "T-01": shell("BACKLOG", CURRENT) }));
  assert.deepEqual(r.findings("D14"), []);
});

test("a live shell carrying retired gate keys fails D14, on both counts", () => {
  // The real pre-ADR-019 shape: spec/design/review/qa. It is wrong twice over — three retired keys
  // present and `plan` absent — and the check reports both, because a message that named only the
  // extras would leave a reader deleting three lines and still failing.
  const r = run(ticketProject({ "T-01": shell("BACKLOG", RETIRED) }));
  assert.equal(r.code, 1);
  const f = r.findings("D14").join("\n");
  assert.equal(r.findings("D14").length, 2);
  assert.match(f, /gates carries `spec`, `design`, `qa`.*which the template retired/);
  assert.match(f, /gates is missing `plan`/);
});

// The exemption, and the reason the check is scoped rather than global. TEA-01..03 in the real
// repository carry `passed: true` on spec, design and qa.
test("a DONE ticket keeps its retired gate keys and passes D14", () => {
  const r = run(ticketProject({ "T-01": shell("DONE", RETIRED) }));
  assert.deepEqual(r.findings("D14"), [], "a shipped ticket's gates are history, not a shell to migrate");
});

test("a live shell missing a gate the template declares fails D14", () => {
  const r = run(ticketProject({ "T-01": shell("BACKLOG", ["  plan:   { passed: false, at: null }"]) }));
  assert.equal(r.findings("D14").length, 1);
  assert.match(r.findings("D14")[0], /missing `review`/);
});

// The half-migration that a by-eye inventory missed on 2026-09-04: gates migrated, chat_budget not.
test("D14 checks chat_budget as well as gates", () => {
  const r = run(
    ticketProject({
      "T-01": shell("BACKLOG", CURRENT, [
        "  developer->tech-lead-design: { used: 0, max: 6 }",
        "  qa->ba:                      { used: 0, max: 6 }",
      ]),
    })
  );
  assert.equal(r.findings("D14").length, 1);
  assert.match(r.findings("D14")[0], /chat_budget carries `qa->ba`/);
});

test("D14 reads the expected keys from the template, never a hard-coded list", () => {
  // Retire `review` in the template only. The shell that still carries it must now fail — which is
  // what proves the check follows the template rather than a literal list inside check-docs.mjs.
  const tpl = TPL.replace("  review: { passed: false, at: null }\n", "");
  const r = run(ticketProject({ "T-01": shell("BACKLOG", CURRENT) }, tpl));
  assert.equal(r.findings("D14").length, 1);
  assert.match(r.findings("D14")[0], /carries `review`/);
});

test("D14 ignores comments and blank lines inside a block", () => {
  const r = run(
    ticketProject({
      "T-01": [
        "id: T-01",
        "state: BACKLOG",
        "chat_budget:",
        "  # a comment",
        "  developer->tech-lead-design: { used: 0, max: 6 }",
        "gates:",
        "  # migrated 2026-09-04",
        "  #",
        "  plan:   { passed: false, at: null }",
        "  review: { passed: false, at: null }",
        "",
      ].join("\n"),
    })
  );
  assert.deepEqual(r.findings("D14"), []);
});

test("this repository passes D14", () => {
  const res = spawnSync(process.execPath, [SCRIPT], { cwd: REPO, encoding: "utf8" });
  assert.doesNotMatch(res.stdout, /FAIL D14/);
});

// --- D15: e2e quarantine register (ADR-060) ---
//
// Dates are computed from the clock in UTC, never hard-coded, so these tests cannot expire. Each
// test asserts on findings("D15") only: a minimal fixture trips unrelated checks.

const utcDay = (offset = 0) => {
  const d = new Date();
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offset)).toISOString().slice(0, 10);
};

/** A register file with the given rows; each row is [test, kind, cause, pr, ticket, expiry]. */
const registerWith = (...rows) =>
  [
    "# Register",
    "",
    "| Test | Kind | Suspected cause | First failing PR | Ticket | Expiry |",
    "|---|---|---|---|---|---|",
    ...rows.map((r) => `| ${r.join(" | ")} |`),
    "",
  ].join("\n");

/** A spec file body holding the given declarations, each { title, fixme, ticket }. */
const specWith = (...decls) =>
  [
    'import { test } from "@playwright/test";',
    ...decls.flatMap((d) => [
      ...(d.ticket ? [`// QUARANTINED ${d.ticket} under ADR-060 — row in docs/ops/e2e-quarantine.md`] : []),
      `test${d.fixme ? ".fixme" : ""}(${JSON.stringify(d.title)}, async () => {});`,
    ]),
    "",
  ].join("\n");

/** A minimal ticket shell so finding 10 does not fire. */
const ticketShell = (id) => ({ [`.ai/board/tickets/${id}/ticket.yaml`]: `id: ${id}\n` });

const SPEC = "tests/e2e/probe.spec.ts";
const TITLE = "AC-1: the probe";
const rowOf = ({ title = TITLE, kind = "fixme", ticket = "BUG-001", expiry = utcDay(10), file = SPEC } = {}) => [
  `\`${file}\` › ${title}`,
  kind,
  "a cause",
  "#1",
  ticket,
  expiry,
];
const d15 = (files, rowsArg) =>
  run(
    project("", "", {
      ...(rowsArg ? { "docs/ops/e2e-quarantine.md": registerWith(...rowsArg) } : {}),
      ...ticketShell("BUG-001"),
      ...files,
    })
  ).findings("D15");

test("with no fixme and no register, D15 says nothing", () => {
  assert.deepEqual(d15({ [SPEC]: specWith({ title: TITLE }) }), []);
});

test("an unregistered fixme fails D15", () => {
  const f = d15({ [SPEC]: specWith({ title: TITLE, fixme: true, ticket: "BUG-001" }) }, [rowOf({ title: "another" })]);
  assert.ok(f.some((l) => l.includes(SPEC) && l.includes(TITLE) && l.includes("is quarantined with no row in docs/ops/e2e-quarantine.md")), f.join("\n"));
});

test("a fixme with no register file at all fails D15", () => {
  const f = d15({ [SPEC]: specWith({ title: TITLE, fixme: true, ticket: "BUG-001" }) });
  assert.equal(f.length, 1);
  assert.match(f[0], /is quarantined with no row/);
});

test("a registered, ticketed, unexpired fixme passes D15", () => {
  assert.deepEqual(d15({ [SPEC]: specWith({ title: TITLE, fixme: true, ticket: "BUG-001" }) }, [rowOf()]), []);
});

test("an expired row fails D15", () => {
  const y = utcDay(-1);
  const f = d15({ [SPEC]: specWith({ title: TITLE, fixme: true, ticket: "BUG-001" }) }, [rowOf({ expiry: y })]);
  assert.equal(f.length, 1);
  assert.ok(f[0].includes(TITLE) && f[0].includes(`expired on ${y}`), f[0]);
});

test("a row expiring today passes D15", () => {
  assert.deepEqual(d15({ [SPEC]: specWith({ title: TITLE, fixme: true, ticket: "BUG-001" }) }, [rowOf({ expiry: utcDay(0) })]), []);
});

test("a row more than 30 days out fails D15", () => {
  const f = d15({ [SPEC]: specWith({ title: TITLE, fixme: true, ticket: "BUG-001" }) }, [rowOf({ expiry: utcDay(31) })]);
  assert.equal(f.length, 1);
  assert.match(f[0], /more than 30 days out/);
});

test("a row exactly 30 days out passes D15", () => {
  assert.deepEqual(d15({ [SPEC]: specWith({ title: TITLE, fixme: true, ticket: "BUG-001" }) }, [rowOf({ expiry: utcDay(30) })]), []);
});

test("a fixme row whose test runs again fails D15", () => {
  const f = d15({ [SPEC]: specWith({ title: TITLE }) }, [rowOf()]);
  assert.equal(f.length, 1);
  assert.match(f[0], /is registered as fixme but runs/);
});

test("a row naming a test that does not exist fails D15", () => {
  const missingTitle = d15({ [SPEC]: specWith({ title: "something else" }) }, [rowOf()]);
  assert.ok(missingTitle.some((l) => l.includes("names a test that does not exist")));
  const missingFile = d15({}, [rowOf()]);
  assert.ok(missingFile.some((l) => l.includes("names a test that does not exist")));
});

test("a flaky row whose test is quarantined fails D15", () => {
  const f = d15({ [SPEC]: specWith({ title: TITLE, fixme: true, ticket: "BUG-001" }) }, [rowOf({ kind: "flaky" })]);
  assert.ok(f.some((l) => l.includes("is registered as flaky but is quarantined")), f.join("\n"));
});

test("a flaky row whose test runs passes D15", () => {
  assert.deepEqual(d15({ [SPEC]: specWith({ title: TITLE }) }, [rowOf({ kind: "flaky" })]), []);
});

test("a fixme whose comment names no ticket fails D15", () => {
  const f = d15({ [SPEC]: specWith({ title: TITLE, fixme: true }) }, [rowOf()]);
  assert.equal(f.length, 1);
  assert.match(f[0], /names no ticket, or not BUG-001/);
});

test("a fixme whose comment names a different ticket fails D15", () => {
  const f = d15({ [SPEC]: specWith({ title: TITLE, fixme: true, ticket: "BUG-002" }) }, [rowOf()]);
  assert.equal(f.length, 1);
  assert.match(f[0], /names no ticket, or not BUG-001/);
});

test("a row whose ticket has no ticket.yaml fails D15", () => {
  const f = d15({ [SPEC]: specWith({ title: TITLE, fixme: true, ticket: "BUG-077" }) }, [rowOf({ ticket: "BUG-077" })]);
  assert.equal(f.length, 1);
  assert.match(f[0], /ticket BUG-077 has no ticket\.yaml/);
});

test("a fixme with no string-literal title fails D15", () => {
  const body = 'import { test } from "@playwright/test";\ntest("x", async () => {\n  test.fixme();\n});\ntest.fixme(cond, "y", async () => {});\n';
  const f = d15({ [SPEC]: body });
  assert.equal(f.length, 2);
  assert.ok(f.every((l) => l.includes("has no string-literal title")), f.join("\n"));
  assert.ok(f[0].includes("line 3"));
});

test("a describe-level fixme fails D15", () => {
  const body = 'import { test } from "@playwright/test";\ntest.describe.fixme("group", () => {});\n';
  const f = d15({ [SPEC]: body });
  assert.equal(f.length, 1);
  assert.match(f[0], /describe-level fixme cannot be registered/);
});

test("a commented-out test.fixme is not a quarantine", () => {
  const body = 'import { test } from "@playwright/test";\n// test.fixme("AC-1: the probe", async () => {});\n/*\n * test.fixme("AC-2: another", async () => {});\n */\n';
  assert.deepEqual(d15({ [SPEC]: body }), []);
});

test("a kind other than fixme or flaky fails D15", () => {
  const f = d15({ [SPEC]: specWith({ title: TITLE }) }, [rowOf({ kind: "skip" })]);
  assert.ok(f.some((l) => l.includes("kind must be fixme or flaky")), f.join("\n"));
});

test("this repository's real register and suite pass D15", () => {
  const res = spawnSync(process.execPath, [SCRIPT], { cwd: REPO, encoding: "utf8" });
  assert.doesNotMatch(res.stdout, /FAIL D15/);
});

// --- D16: the Antigravity adapter points at the commands and copies nothing --------------------
//
// The synthetic cases build commands and shims by hand. The last four copy this repository's real
// `.claude/commands/`, `.agents/` and `CLAUDE.md` into the fixture, per the fixtures rule in
// testing-standards.md: a check whose only fixtures were written by its author agrees with its
// author about what a retirement banner looks like, and the real ones are three different shapes.

const cmd = (desc, body = "Body.\n") => `---\ndescription: ${desc}\n---\n\n${body}`;
const shim = (name, desc, extra = "") =>
  `---\nname: ${name}\ndescription: ${desc}\n---\n\nRead \`.claude/commands/${name}.md\` and follow it.\n${extra}`;
const d16 = (files) => run(project("", "", files));

test("with no .agents/skills/, D16 checks nothing and says so", () => {
  const r = d16({ ".claude/commands/go.md": cmd("Go") });
  assert.deepEqual(r.findings("D16"), []);
  assert.ok(r.notes.some((n) => n.includes("D16")), r.notes.join("\n"));
});

test("a matching shim passes D16", () => {
  const r = d16({ ".claude/commands/go.md": cmd("Go — now"), ".agents/skills/go/SKILL.md": shim("go", "Go — now") });
  assert.deepEqual(r.findings("D16"), []);
});

test("a live command with no shim fails D16", () => {
  const f = d16({
    ".claude/commands/go.md": cmd("Go"),
    ".claude/commands/stop.md": cmd("Stop"),
    ".agents/skills/go/SKILL.md": shim("go", "Go"),
  }).findings("D16");
  assert.equal(f.length, 1, f.join("\n"));
  assert.match(f[0], /stop\.md: has no Antigravity shim/);
});

test("a drifted description fails D16 and quotes both", () => {
  const f = d16({ ".claude/commands/go.md": cmd("Go, now"), ".agents/skills/go/SKILL.md": shim("go", "Go") }).findings("D16");
  assert.equal(f.length, 1, f.join("\n"));
  assert.match(f[0], /description has drifted/);
});

test("both retirement shapes exempt a command, and shimming one fails D16", () => {
  const files = {
    ".claude/commands/old.md": cmd("RETIRED by ADR-001 — removed. Do not run."),
    ".claude/commands/older.md": cmd("Was a stage", "> **`/older` is retired — ADR-002.** Run /go.\n"),
  };
  assert.deepEqual(d16({ ...files, ".agents/skills/x/SKILL.md": "" }).findings("D16").filter((l) => /no Antigravity shim/.test(l)), []);
  const f = d16({ ...files, ".agents/skills/old/SKILL.md": shim("old", "RETIRED by ADR-001 — removed. Do not run.") }).findings("D16");
  assert.ok(f.some((l) => /shims \/old, which is retired/.test(l)), f.join("\n"));
});

test("an un-retired command still needs a shim", () => {
  const body = "> **Un-retired 2026-09-22 — ADR-038.** The old `/idea` is retired; this one is not.\n";
  const f = d16({ ".claude/commands/idea.md": cmd("Ask", body), ".agents/skills/go/SKILL.md": "" }).findings("D16");
  assert.ok(f.some((l) => /idea\.md: has no Antigravity shim/.test(l)), f.join("\n"));
});

test("a shim with no command, no SKILL.md, a wrong name or no pointer fails D16", () => {
  const f = d16({
    ".claude/commands/go.md": cmd("Go"),
    ".claude/commands/run.md": cmd("Run"),
    ".agents/skills/go/SKILL.md": "---\nname: went\ndescription: Go\n---\n\nRead the command.\n",
    ".agents/skills/run/notes.txt": "x",
    ".agents/skills/gone/SKILL.md": shim("gone", "Gone"),
  }).findings("D16");
  assert.ok(f.some((l) => /gone\/SKILL\.md: shims \/gone, which has no file/.test(l)), f.join("\n"));
  assert.ok(f.some((l) => /run\/: has no SKILL\.md/.test(l)), f.join("\n"));
  assert.ok(f.some((l) => /declares name `went`/.test(l)), f.join("\n"));
  assert.ok(f.some((l) => /does not name \.claude\/commands\/go\.md/.test(l)), f.join("\n"));
});

test("a shim large enough to hold a command body fails D16", () => {
  const f = d16({ ".claude/commands/go.md": cmd("Go"), ".agents/skills/go/SKILL.md": shim("go", "Go", "x".repeat(5000)) }).findings("D16");
  assert.ok(f.some((l) => /a shim points at the command, it does not copy it/.test(l)), f.join("\n"));
});

test("the rule file is measured with its includes expanded", () => {
  const base = { ".claude/commands/go.md": cmd("Go"), ".agents/skills/go/SKILL.md": shim("go", "Go") };
  const rule = "---\ntrigger: always_on\n---\n\n@[CLAUDE.md](../../CLAUDE.md)\n";
  assert.deepEqual(d16({ ...base, "CLAUDE.md": "y".repeat(23000), ".agents/rules/claude-md.md": rule }).findings("D16"), []);
  const over = d16({ ...base, "CLAUDE.md": "y".repeat(24100), ".agents/rules/claude-md.md": rule }).findings("D16");
  assert.ok(over.some((l) => /Antigravity truncates a rule past 24000/.test(l)), over.join("\n"));
  const missing = d16({ ...base, ".agents/rules/claude-md.md": rule }).findings("D16");
  assert.ok(missing.some((l) => /includes \.\.\/\.\.\/CLAUDE\.md, which does not exist/.test(l)), missing.join("\n"));
});

/** This repository's real commands, adapter and CLAUDE.md, keyed by repo-relative path. */
function realAdapterFiles() {
  const out = {};
  const take = (relDir) => {
    const abs = path.join(REPO, relDir);
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      const r = `${relDir}/${e.name}`;
      if (e.isDirectory()) take(r);
      else out[r] = fs.readFileSync(path.join(REPO, r), "utf8");
    }
  };
  take(".claude/commands");
  take(".agents");
  out["CLAUDE.md"] = fs.readFileSync(path.join(REPO, "CLAUDE.md"), "utf8");
  return out;
}

test("this repository's real commands and shims pass D16", () => {
  assert.deepEqual(d16(realAdapterFiles()).findings("D16"), []);
});

test("against the real commands, exactly /spec, /design and /qa read as retired", () => {
  const files = realAdapterFiles();
  for (const k of Object.keys(files)) if (k.startsWith(".agents/skills/")) delete files[k];
  files[".agents/skills/.keep/SKILL.md"] = "";
  const missing = d16(files).findings("D16")
    .map((l) => /commands\/([a-z-]+)\.md: has no Antigravity shim/.exec(l)?.[1]).filter(Boolean).sort();
  const live = fs.readdirSync(path.join(REPO, ".claude/commands")).map((f) => f.slice(0, -3))
    .filter((n) => !["spec", "design", "qa"].includes(n)).sort();
  assert.deepEqual(missing, live);
});

test("deleting one real shim is a D16 finding naming it", () => {
  const files = realAdapterFiles();
  delete files[".agents/skills/review/SKILL.md"];
  const f = d16(files).findings("D16");
  assert.equal(f.length, 1, f.join("\n"));
  assert.match(f[0], /commands\/review\.md: has no Antigravity shim/);
});

test("the real rule file, with the real CLAUDE.md inlined, is under Antigravity's limit", () => {
  const files = realAdapterFiles();
  assert.match(files[".agents/rules/claude-md.md"], /@\[CLAUDE\.md\]\(\.\.\/\.\.\/CLAUDE\.md\)/);
  files["CLAUDE.md"] += "z".repeat(24000);
  const f = d16(files).findings("D16");
  assert.ok(f.some((l) => /Antigravity truncates a rule/.test(l)), f.join("\n"));
});
