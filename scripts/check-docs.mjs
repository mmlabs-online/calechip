// check-docs.mjs — the documentation audit behind /docs-audit.
//
// Reports. Never fixes. A tool that repairs the thing it measures stops being a measurement, and
// the repair it makes is the one nobody reviewed.
//
// D8 is advisory and never fails the run; everything else is an error.
//
// THREE CHECKS ARE CONFIGURATION-DRIVEN AND SHIP UNCONFIGURED. D1 reads its group prefixes from
// .ai/registry/features.md, D2 reads its ledger from .ai/registry/invariants.md, and D12 reads its
// boundaries from .ai/registry/boundaries.json. In a fresh repository all three are empty. Each says
// so in the report rather than passing silently, because a check that reports nothing and a check
// that is broken look identical from the outside.
//
// TODO(project): SCAFFOLD_ROOTS and PATH_ROOTS below are the only two places this script assumes a
// directory layout. Change them if the implementation source or the tests live elsewhere.
//
// Run: node scripts/check-docs.mjs

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();

// Directories the implementation creates. A reference to a path under a root that does not exist yet
// is PENDING rather than broken, and becomes strict the moment that root appears on disk.
//
// This is per root, not global. The origin project keyed the whole decision on package.json
// existing, which is wrong for any repository that carries a package.json as tooling before it
// carries an implementation — which every repository stood up from this template does.
const SCAFFOLD_ROOTS = ["src/", "tests/", "node_modules/"];
const scaffoldRootExists = (root) => fs.existsSync(path.join(ROOT, root.replace(/[/]$/, "")));
const ANY_SCAFFOLD = SCAFFOLD_ROOTS.some(scaffoldRootExists);

// Paths a human-owned document names, that do not exist on disk, and whose ABSENCE is the recorded
// fact rather than a broken reference. D6 reports these as PENDING, and errors the moment one of
// them exists — a register that outlives its reason is worse than none, because it then reads as
// current.
//
// TWO REASONS A PATH BELONGS HERE, and the register carries which in the reason text:
//   OWED     the file has never been written and something in the human plane says it is due
//   RETIRED  the file existed, a shipped ticket deleted it, and a registry row says so in the past
//            tense. The row is history and correct; D6 reading it as a broken link is the check
//            mistaking a statement of absence for a claim of presence
//
// The scaffold-root branch below cannot cover either: it defers a whole tree until it appears, and
// `src/` and `tests/` have both existed for weeks. What is absent is one file inside a real tree.
//
// A row here is a waiver on the audit, so it is deliberately expensive. It needs the reason and the
// document carrying it, and `.github/CODEOWNERS` puts `scripts/` behind owner review so that no
// agent can add one to get past its own gate.
//
// TODO(verify): a RETIRED row is owed by every future ticket that deletes a file and says so in
// `features.md`, so this map grows on a schedule rather than by exception. Two entries is not a
// maintenance problem; a dozen would be, and would mean the mechanism is wrong rather than the
// register full. Revisit at that point — do not just keep appending.
const ABSENT_BY_DESIGN = new Map([
  [
    "tests/permission-model.test.ts",
    "OWED — mandatory under .ai/standards/testing-standards.md, owed since TEA-01, and named as " +
      "still owed by ADR-016, ADR-017 and ADR-027. It must execute against a real PostgreSQL with " +
      "a token per role; no project is provisioned, and every design so far has refused to write " +
      "it against the mock. ADR-027 phase 1 is where it gets written",
  ],
  [
    ".ai/board/ideas/2026-09-08-the-year-view-is-the-only-screen-that-shows-who-declared-nothing.md",
    "LOST — the idea file UIE-08 was promoted from, cited by its features.md row and by the ADR " +
      "that ticket wrote, and present on no ref. This is MD-031: /triage writes .ai/board/ideas/** " +
      "and any ADR it drafts, and /ship's ship set is allowed_paths plus the ticket folder plus " +
      "three named paths (ADR-023) — neither directory is in any of them, so both were left dirty " +
      "and never landed. The citation is correct about what was read at triage; the file is gone. " +
      "Reconstructing it would be inventing a record of a conversation nobody has. The runner now " +
      "names these paths in every REPORT.md so the next one is not lost the same way (ADR-037)",
  ],
  [
    "src/routes/AllowList.tsx",
    "RETIRED — deleted under ADR-033, which dropped `public.allowed_email` and replaced the " +
      "allow-list screen with the sign-ups queue at src/routes/NewSignups.tsx. The TEA-02 row in " +
      ".ai/registry/features.md names this file as what that ticket built, which is true in the " +
      "past tense and is the record of a feature that shipped and was later reversed",
  ],
  [
    "src/routes/Home.tsx",
    "RETIRED — deleted by UIE-02 (8a1c2bb), which relocated its twelve `home-*` selector ids " +
      "unrenamed into the sidebar and top bar. Four citations in .ai/registry/features.md name it, " +
      "and all four are correct in the past tense — the UIE-02 row says in terms that the file IS " +
      "DELETED BY THIS TICKET. Editing them to satisfy D6 would delete true history from the " +
      "registry to make a check green",
  ],
]);

const errors = [];
const warnings = [];
const pending = [];
const unconfigured = [];

const err = (check, file, msg) => errors.push({ check, file, msg });
const warn = (check, file, msg) => warnings.push({ check, file, msg });

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const readIf = (p) => (fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null);

const aiFiles = walk(path.join(ROOT, ".ai")).filter((p) => p.endsWith(".md"));
const claudeFiles = walk(path.join(ROOT, ".claude")).filter((p) => p.endsWith(".md"));
const claudeMd = path.join(ROOT, "CLAUDE.md");
const allDocs = [...aiFiles, ...claudeFiles, ...(fs.existsSync(claudeMd) ? [claudeMd] : [])];

const rulesText = readIf(path.join(ROOT, ".ai/registry/rules.md"));
const invText = readIf(path.join(ROOT, ".ai/registry/invariants.md"));
const featText = readIf(path.join(ROOT, ".ai/registry/features.md"));

if (!rulesText) err("D3", ".ai/registry/rules.md", "missing");
if (!invText) err("D2", ".ai/registry/invariants.md", "missing");
if (!featText) err("D1", ".ai/registry/features.md", "missing");

// --- Rule ledger ----------------------------------------------------------------------------

// | RULE-01 | text | 1 | CLAUDE.md |
const rules = new Map();
if (rulesText) {
  for (const line of rulesText.split(/\r?\n/)) {
    const m = /^\|\s*(RULE-\d{2})\s*\|\s*(.+?)\s*\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*$/.exec(line);
    if (m) rules.set(m[1], { text: m[2], version: Number(m[3]), verbatimIn: m[4] });
  }
}

// --- Invariant ledger, and the IDs that were deliberately never issued -----------------------

/** A registry file split into its `## ` sections, keyed by heading text. */
function sections(text) {
  const out = new Map();
  let key = "";
  let buf = [];
  for (const line of (text ?? "").split(/\r?\n/)) {
    const m = /^##\s+(.*?)\s*$/.exec(line);
    if (m) {
      out.set(key, buf.join("\n"));
      key = m[1];
      buf = [];
    } else {
      buf.push(line);
    }
  }
  out.set(key, buf.join("\n"));
  return out;
}

/** IDs in the leading cell of a table row: `| INV-04 | ... |`. Prose mentions are not rows. */
const tableIds = (text) =>
  (text ?? "")
    .split(/\r?\n/)
    .map((l) => /^\|\s*(INV-\d{2})\s*\|/.exec(l)?.[1])
    .filter(Boolean);

const invSections = sections(invText);

// An ID listed under `## Unissued IDs` was considered and deliberately never issued. It is valid to
// CITE — a document explaining why a number is missing has to be able to name it, and forcing the
// author to write it in pieces to dodge this check makes the check the author of the prose.
//
// It is not valid to USE. An unissued ID must never appear in a ledger row, a design, or
// `invariants_touched`; it names an absence, and there is nothing behind it to hold.
const unissued = new Set(tableIds(invSections.get("Unissued IDs")));

// Issued invariants are every table ID in the file except those. Scoping by subtraction rather than
// by reading the Ledger section alone keeps this working on a file with no `## Ledger` heading,
// which is how it behaved before unissued IDs existed.
const invariants = new Set(tableIds(invText).filter((id) => !unissued.has(id)));

// Both at once is a contradiction, and a silent one: subtraction above would quietly drop the ID
// from the issued set, so an invariant that genuinely exists would stop being citable anywhere.
for (const id of tableIds(invSections.get("Ledger"))) {
  if (unissued.has(id)) {
    err("D2", ".ai/registry/invariants.md", `${id} is in both the ledger and the Unissued IDs table`);
  }
}

// Feature rows, and the IDs that were proposed and deliberately never issued.
//
// The same shape as `## Unissued IDs` in `invariants.md`, and for the same reason: a document
// explaining why a number is missing has to be able to NAME it, and naming it must not make it
// usable. `TEA-07` is the live case — a run proposed it, the row was registered as `TEA-06`
// instead, and `.ai/steward/context.md` records the renumbering. That sentence cannot be written
// without the token, and D1 could not tell a historical reference from a citation.
const featureRows = (text) =>
  (text ?? "")
    .split(/\r?\n/)
    .map((l) => /^\|\s*([A-Z]{3,4}-\d{2})\s*\|/.exec(l)?.[1])
    .filter(Boolean);

const featSections = sections(featText);
const featureRowsAll = featureRows(featText);
const featureRowsUnissued = featureRows(featSections.get("Unissued IDs"));
const featuresUnissued = new Set(featureRowsUnissued);

const occurrences = (arr, id) => arr.filter((x) => x === id).length;
for (const id of featuresUnissued) {
  if (occurrences(featureRowsAll, id) > occurrences(featureRowsUnissued, id)) {
    err("D1", ".ai/registry/features.md", `${id} is in both a group table and the Unissued IDs table`);
  }
}

const features = new Set(featureRowsAll.filter((id) => !featuresUnissued.has(id)));

// The group prefixes D1 polices, declared in features.md rather than inferred from its rows.
//
// Inferring them from the rows would make a reserved-but-empty group invisible, and a citation of an
// ID in a group that has no rows yet is exactly the citation worth catching: it is what an agent
// writes when it has invented a feature. The origin project caught that twice, both times against a
// group whose table was bare.
//
//   <!-- id-prefixes: ORD PAY -->
//
// Empty is the shipping state and is legitimate. D1 then checks nothing and says so in the report.
// EXA is reserved. Every worked example in this kit — in the operating model, the standards, the
// commands and the templates — cites EXA-01, and D1 only exempts .ai/templates/ and features.md.
// Without a reserved prefix, a project whose real groups happened to include the example prefix
// would fail D1 on a dozen documents it never wrote, and the fix would look like editing the
// operating model. Declaring it in features.md is dropped here with a note rather than honoured.
const RESERVED_EXAMPLE_PREFIX = "EXA";

const GROUPS = (/<!--\s*id-prefixes:\s*([^>]*?)-->/.exec(featText ?? "")?.[1] ?? "")
  .split(/[\s,]+/)
  .map((g) => g.trim().toUpperCase())
  .filter((g) => /^[A-Z]{3,4}$/.test(g)) // three letters, or four since ADR-059 (CICD)
  .filter((g) => g !== RESERVED_EXAMPLE_PREFIX);

// --- D1 / D2 / D3 ---------------------------------------------------------------------------

// A check that reports nothing and a check that is broken look identical from the outside, so both
// of the configuration-driven checks say when they are unconfigured rather than passing silently.
if (new RegExp(`<!--\\s*id-prefixes:[^>]*\\b${RESERVED_EXAMPLE_PREFIX}\\b`).test(featText ?? "")) {
  unconfigured.push(
    `D1 ignored the prefix ${RESERVED_EXAMPLE_PREFIX} — it is reserved for the worked examples in`
    + ` this kit and cannot be a real feature group. Choose another three or four letters.`
  );
}
if (GROUPS.length === 0) {
  unconfigured.push(
    `D1 checked nothing — .ai/registry/features.md declares no id-prefixes. Add them to the`
    + ` machine-readable line in its Group prefixes section before the first /spec.`
  );
}
if (invariants.size === 0) {
  unconfigured.push(
    `D2 has an empty ledger — .ai/registry/invariants.md lists no invariants, so every INV-nn`
    + ` reference anywhere would be reported. Seed the ledger before the first /spec.`
  );
}


const FEATURE_RE =
  GROUPS.length > 0 ? new RegExp(`\\b(?:${GROUPS.join("|")})-\\d{2}\\b`, "g") : null;

for (const file of allDocs) {
  const r = rel(file);
  const text = fs.readFileSync(file, "utf8");

  // Templates carry example IDs by definition; the registry file lists them by definition.
  const skipD1 = r.startsWith(".ai/templates/") || r === ".ai/registry/features.md";

  if (!skipD1 && FEATURE_RE) {
    for (const id of new Set(text.match(FEATURE_RE) ?? [])) {
      if (features.has(id) || featuresUnissued.has(id)) continue;
      err("D1", r, `references feature ${id}, absent from features.md`);
    }
  }
  for (const id of new Set(text.match(/\bINV-\d{2}\b/g) ?? [])) {
    if (invariants.has(id) || unissued.has(id)) continue;
    if (r === ".ai/registry/invariants.md") continue;
    err("D2", r, `references ${id}, absent from invariants.md`);
  }
  for (const id of new Set(text.match(/\bRULE-\d{2}\b/g) ?? [])) {
    if (!rules.has(id) && r !== ".ai/registry/rules.md") {
      err("D3", r, `references ${id}, absent from rules.md`);
    }
  }
}

// --- D4: agents named in prose have a definition ---------------------------------------------

const agentDir = path.join(ROOT, ".claude/agents");
const agentFiles = new Set(
  fs.existsSync(agentDir)
    ? fs.readdirSync(agentDir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""))
    : []
);
const ROLE_SHAPE = /^(orchestrator|product|ba|tech-lead-[a-z]+|developer|qa|devops|architect|designer|reviewer|tester)$/;

for (const file of allDocs) {
  const r = rel(file);
  if (r.startsWith(".claude/agents/")) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const m of new Set(text.match(/`([a-z][a-z-]*)`/g) ?? [])) {
    const name = m.slice(1, -1);
    if (ROLE_SHAPE.test(name) && !agentFiles.has(name)) {
      err("D4", r, `names agent \`${name}\`, which has no file in .claude/agents/`);
    }
  }
}

// --- Scope: which documents a check may read --------------------------------------------------
//
// **A check whose scope includes agent-produced artifacts gets worked around, not reported.** The
// reasoning is in "What a check may be scoped to" in `.ai/standards/testing-standards.md`; the short
// version is that a finding aimed at a human buys a decision, and the same finding aimed at an agent
// mid-stage is an obstacle between it and its gate, so the cheapest way through is to make it stop
// appearing. Both roads end at a green audit and only one of them means anything.
//
// `.ai/board/**` is agent output — tickets, stage artifacts, `backlog.md` and `metrics.md` alike.
// `.claude/**` is not: agents and commands are human-authored configuration, and no stage writes
// there.
//
// D5, D6 and D9 are all scoped by this. Each was narrowed after a real false positive:
//   D9  the first story written hit the front-matter requirement and had `doc_version` pasted into
//       it, which is the failure mode exactly — satisfied rather than reported
//   D5  a tech lead wrote a route path into `02-design.md` and D5 read it as a slash command with
//       no definition. The agent reported it instead of renaming the route, which is the right
//       behaviour and not the one to design around
//   D6  same corpus, same exposure: a design enumerating `allowed_paths` names files that do not
//       exist yet, because creating them is the next stage's job
const GOVERNED_ROOTS = [".ai/registry/", ".ai/standards/", ".ai/templates/"];
const GOVERNED_FILES = [".ai/00-charter.md", ".ai/01-operating-model.md"];

/** A human-owned `.ai/` document: permanent, versioned, and not written by any stage. */
const isGovernedDoc = (r) =>
  GOVERNED_ROOTS.some((root) => r.startsWith(root)) || GOVERNED_FILES.includes(r);

/** Anything a check may read: human-owned `.ai/`, all of `.claude/`, and CLAUDE.md. */
const isHumanOwned = (r) =>
  isGovernedDoc(r) || r.startsWith(".claude/") || r === "CLAUDE.md";

// --- D5: commands referenced have a definition -----------------------------------------------

// A slash-prefixed token is a command OR a route, and until now D5 could not tell them apart — six
// of its findings were the application's own URLs. The router is the authority on what is a route,
// so read it rather than keeping a hand-maintained list beside it that drifts.
const ROUTER_FILES = ["src/App.tsx"];
const appRoutes = new Set();
for (const f of ROUTER_FILES) {
  const p = path.join(ROOT, f);
  if (!fs.existsSync(p)) continue;
  for (const m of fs.readFileSync(p, "utf8").matchAll(/path="\/([a-z][a-z0-9-]*)/g)) appRoutes.add(m[1]);
}

// Routes the application no longer serves, which documents still name in the past tense. A row here
// is history, not configuration: the screen existed, the citation is correct, and deleting the
// citation to satisfy a check would delete a true record of something that shipped and was reversed.
const RETIRED_ROUTES = new Map([
  ["allow-list", "deleted by ADR-033, which dropped `public.allowed_email` and replaced the " +
                 "allow-list screen with the sign-ups queue at /signups. Cited in the past tense."],
]);

const cmdDir = path.join(ROOT, ".claude/commands");
const commands = new Set(
  fs.existsSync(cmdDir)
    ? fs.readdirSync(cmdDir).filter((f) => f.endsWith(".md")).map((f) => f.replace(/\.md$/, ""))
    : []
);

for (const file of allDocs) {
  const r = rel(file);
  if (r.startsWith(".claude/commands/")) continue;
  // Board artifacts are out of scope. A route path in a design is a route, not a command, and a check
  // that cannot tell them apart is a check an agent has to argue with to finish its stage.
  if (!isHumanOwned(r)) continue;
  const text = fs.readFileSync(file, "utf8");
  // A slash-command token: preceded by a non-word character, then /name, ending cleanly.
  for (const m of new Set(text.match(/(?<![\w./-])\/([a-z][a-z0-9-]*)(?![\w./-])/g) ?? [])) {
    const name = m.slice(1);
    if (commands.has(name) || appRoutes.has(name) || RETIRED_ROUTES.has(name)) continue;
    err("D5", r, `references /${name}, which is neither a command in .claude/commands/ nor a route in ${ROUTER_FILES.join(", ")}`);
  }
}

// --- D6: relative paths mentioned under .ai/ exist --------------------------------------------

const PATH_ROOTS = [".ai/", ".claude/", ".github/", "scripts/", ...SCAFFOLD_ROOTS];

function pathCandidates(text) {
  const out = new Set();
  for (const m of text.match(/`([^`\n]+)`/g) ?? []) out.add(m.slice(1, -1));
  for (const m of text.match(/\]\(([^)\s]+)\)/g) ?? []) out.add(m.slice(2, -1));
  return [...out]
    // `:123` is a line citation, not part of the filename. The model asks for `file:line` in every
    // review item and design, so a path carrying one has to resolve to the path. Trailing
    // punctuation is stripped after it, because a citation can end a sentence.
    //
    // **The range `:12-20` is stripped too, and that was MD-019.** Until 2026-09-07 this pattern
    // matched `file.ts:12` and `file.ts:12:34` but not `file.ts:12-20`, so the range survived into
    // the candidate, no such path existed, and D6 reported the FILE as missing when the file was
    // there and only the citation was a range. The error naming the wrong cause is what made it
    // expensive: an agent reading "does not exist on disk" removes the fact rather than the range,
    // which is exactly what happened on this branch before MD-019 was found. A range is the natural
    // citation to a block and this repository already uses it.
    //
    // It is widened to a RANGE and no further. `.replace(/:.*$/)` would swallow anything after a
    // colon and stop reporting real typos in filenames, which is the whole reason the strip is
    // narrow — MD-019's fix shape says so in those words.
    .map((s) => s.trim().replace(/:\d+(?:-\d+)?(?::\d+)?$/, "").replace(/[.,;:]+$/, ""))
    .filter(
      (s) =>
        s.includes("/") &&
        !/\s/.test(s) &&
        !/^https?:/.test(s) &&
        !/[<>|]/.test(s) &&
        PATH_ROOTS.some((r) => s.startsWith(r))
    );
}

for (const file of aiFiles) {
  const r = rel(file);
  // Human-owned `.ai/` documents only. A design's section 5 enumerates `allowed_paths` for files the
  // NEXT stage creates, so "does not exist on disk" is the expected state at the moment it is
  // written — the finding would be raised against an agent for correctly describing future work.
  if (!isGovernedDoc(r)) continue;
  for (const cand of pathCandidates(fs.readFileSync(file, "utf8"))) {
    // A glob is a statement about a set, not a claim that one file exists.
    const concrete = cand.replace(/\/?\*\*.*$/, "").replace(/\*.*$/, "");
    if (!concrete || concrete.endsWith("/") === false && concrete !== cand && concrete.includes("*")) continue;
    const target = concrete.replace(/\/$/, "");
    if (!target) continue;
    if (fs.existsSync(path.join(ROOT, target))) continue;
    // Owed, not broken. Checked before the scaffold-root branch because the two answer different
    // questions and only this one survives the tree being created.
    const byDesign = ABSENT_BY_DESIGN.get(target);
    if (byDesign) {
      pending.push({ check: "D6", file: r, msg: `${cand} — absent by design: ${byDesign}` });
      continue;
    }
    // Per scaffold root, not global: a repository with a source tree but no test tree gets strict
    // checking on the one that exists and deferred checking on the one that does not.
    const deferredRoot = SCAFFOLD_ROOTS.find(
      (sr) => `${target}/`.startsWith(sr) && !scaffoldRootExists(sr)
    );
    if (deferredRoot) {
      pending.push({
        check: "D6",
        file: r,
        msg: `${cand} — under ${deferredRoot}, which does not exist yet`,
      });
      continue;
    }
    err("D6", r, `mentions ${cand}, which does not exist on disk`);
  }
}

// The register audits itself. An owed path that has arrived is a row to delete, and nothing else in
// the repository would report that the waiver is now covering a file that exists.
for (const name of RETIRED_ROUTES.keys()) {
  if (appRoutes.has(name)) {
    err("D5", "scripts/check-docs.mjs",
      `/${name} is in RETIRED_ROUTES but the router serves it again — delete the row`);
  }
}

for (const declaredPath of ABSENT_BY_DESIGN.keys()) {
  if (!fs.existsSync(path.join(ROOT, declaredPath))) continue;
  err(
    "D6",
    "scripts/check-docs.mjs",
    `${declaredPath} exists on disk — delete its ABSENT_BY_DESIGN row, it has outlived its reason`
  );
}

// --- D7: verbatim copies match character-for-character -----------------------------------------

for (const [id, rule] of rules) {
  if (!rule.verbatimIn || rule.verbatimIn === "—" || rule.verbatimIn === "-") continue;
  const target = path.join(ROOT, rule.verbatimIn);
  const text = readIf(target);
  if (text === null) {
    err("D7", rule.verbatimIn, `is named as verbatim_in for ${id} but does not exist`);
    continue;
  }
  const line = text.split(/\r?\n/).find((l) => l.includes(`**${id}**`));
  if (!line) {
    err("D7", rule.verbatimIn, `does not contain a verbatim copy of ${id}`);
    continue;
  }
  const copy = line.slice(line.indexOf("—") + 1).trim();
  if (copy !== rule.text) {
    err("D7", rule.verbatimIn, `${id} copy has drifted from rules.md\n      ledger: ${rule.text}\n      copy:   ${copy}`);
  }
}

// --- D8: near-verbatim rule text elsewhere (advisory) ------------------------------------------

const normalise = (s) => s.toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
const shingles = (s, n = 5) => {
  const w = normalise(s).split(" ");
  const out = new Set();
  for (let i = 0; i + n <= w.length; i++) out.add(w.slice(i, i + n).join(" "));
  return out;
};

for (const [id, rule] of rules) {
  const ruleShingles = shingles(rule.text);
  if (ruleShingles.size === 0) continue;
  for (const file of allDocs) {
    const r = rel(file);
    if (r === ".ai/registry/rules.md") continue;
    if (rule.verbatimIn && r === rule.verbatimIn) continue;
    const text = fs.readFileSync(file, "utf8");
    const hits = [...ruleShingles].filter((sh) => normalise(text).includes(sh)).length;
    const ratio = hits / ruleShingles.size;
    if (ratio >= 0.6) {
      warn("D8", r, `restates ${id} at ${Math.round(ratio * 100)}% overlap without verbatim_in — human judgement`);
    }
  }
}

// --- D9: governed_by versions, and front-matter presence ---------------------------------------
//
// Scoped to documents a human owns and versions. Not every markdown file under `.ai/`.
//
// Document front-matter — `doc_version`, `last_updated`, `governed_by` — describes a governance
// document: something permanent, versioned, and bumped by a human when a rule it cites changes. A
// board artifact is none of those. `01-story.md` carries artifact front-matter (`ticket`, `stage`,
// `agent`, `gate`, `chat_before_verdict`), is produced by one agent at one stage, and is deleted
// with the ticket. It has no version to bump and no rule set to track, so requiring the three fields
// asked it to be a kind of document it is not.
//
// The first version of D9 read every `.md` under `.ai/`, board included. The result was predictable
// in hindsight: the first agent to produce a story hit the failure and pasted the three fields into
// its artifact to clear it. That is the failure mode a check on agent output always has — it is
// satisfied, not reported, and the satisfying is cheaper than the reporting. See "What a check may
// be scoped to" in `.ai/standards/testing-standards.md`.
//
// `.ai/board/**` is therefore out of scope entirely, and that includes `backlog.md` and `metrics.md`:
// both are agent-written, and a check an agent can silence by editing its own output measures the
// agent's compliance rather than the documents.
//
// `isGovernedDoc` is defined once, above D5, and shared by D5, D6 and D9.

for (const file of aiFiles) {
  const r = rel(file);
  if (!isGovernedDoc(r)) continue;
  const text = fs.readFileSync(file, "utf8");
  const fm = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!fm) {
    err("D9", r, "has no front-matter (doc_version, last_updated, governed_by are required)");
    continue;
  }
  const block = fm[1];
  const docVersion = Number(/^doc_version:\s*(\d+)/m.exec(block)?.[1] ?? NaN);
  if (Number.isNaN(docVersion)) err("D9", r, "front-matter has no doc_version");
  if (!/^last_updated:\s*\S/m.test(block)) err("D9", r, "front-matter has no last_updated");
  const governed = /^governed_by:\s*\[(.*)\]/m.exec(block);
  if (!governed) {
    err("D9", r, "front-matter has no governed_by list");
    continue;
  }
  for (const id of governed[1].split(",").map((s) => s.trim()).filter(Boolean)) {
    const rule = rules.get(id);
    if (!rule) {
      err("D9", r, `governed_by cites ${id}, which is not in rules.md`);
    } else if (rule.version > docVersion) {
      err("D9", r, `governed_by cites ${id} at v${rule.version} but doc_version is ${docVersion}`);
    }
  }
}

// --- D10: state enum agrees with the gate table ------------------------------------------------

const ticketTpl = readIf(path.join(ROOT, ".ai/templates/ticket.yaml"));
const opModel = readIf(path.join(ROOT, ".ai/01-operating-model.md"));

if (!ticketTpl) err("D10", ".ai/templates/ticket.yaml", "missing");
if (!opModel) err("D10", ".ai/01-operating-model.md", "missing");

if (ticketTpl && opModel) {
  const enumLine = /^#\s*state enum:\s*(.+)$/m.exec(ticketTpl);
  if (!enumLine) {
    err("D10", ".ai/templates/ticket.yaml", "has no `# state enum:` line to check against");
  } else {
    const declared = new Set(enumLine[1].trim().split(/\s+/));
    const section = /## Stage ownership\r?\n([\s\S]*?)\r?\n## /.exec(opModel);
    const inTable = new Set(
      (section?.[1] ?? "")
        .split(/\r?\n/)
        .map((l) => /^\|\s*([A-Z_]+)\s*\|/.exec(l)?.[1])
        .filter(Boolean)
    );
    for (const s of declared) {
      if (!inTable.has(s)) err("D10", ".ai/01-operating-model.md", `state ${s} is in the enum but has no row in the stage ownership table`);
    }
    for (const s of inTable) {
      if (!declared.has(s)) err("D10", ".ai/templates/ticket.yaml", `stage ownership table has ${s}, which is not in the state enum`);
    }
  }
}

// --- D11: every ADR referenced by ID resolves to a file ----------------------------------------
//
// D6 checks relative paths that are written as paths. An ADR is almost always cited by ID —
// "see ADR-002" — which D6 cannot see, so a decision could be cited by three documents while the
// file recording it did not exist. That is worse than an ordinary dangling link: the citation reads
// as evidence that somebody decided, and RULE-09 makes the ADR the only thing that carries that.
//
// Agents cannot write ADRs (RULE-01, RULE-09), so the failure mode is real and specific: an agent
// stops with BLOCKED and names the decision it needs, a human is meant to write the ADR, and the
// prose citing it lands first.

const adrDir = path.join(ROOT, ".ai/registry/decisions");
const adrFiles = fs.existsSync(adrDir) ? fs.readdirSync(adrDir) : [];
const adrs = new Set(
  adrFiles.map((f) => /^(ADR-\d{3})/.exec(f)?.[1]).filter(Boolean)
);

// `.yaml` under `.ai/` is included because a ticket links an approved ADR when `schema_delta` is not
// `none` — a dangling ADR link there is exactly as misleading as one in prose, and it sits on the
// Definition of Ready.
const adrScanned = [
  ...allDocs,
  ...walk(path.join(ROOT, ".ai")).filter((p) => p.endsWith(".yaml")),
];

for (const file of adrScanned) {
  const r = rel(file);
  // Templates carry example IDs by definition — `ADR-nnn` is the placeholder, but a template that
  // shows a filled-in example would otherwise fail on it.
  if (r.startsWith(".ai/templates/")) continue;
  const text = fs.readFileSync(file, "utf8");
  for (const id of new Set(text.match(/\bADR-\d{3}\b/g) ?? [])) {
    if (!adrs.has(id)) {
      err("D11", r, `references ${id}, which has no file in .ai/registry/decisions/`);
    }
  }
}

// --- D12: the boundaries declared in .ai/registry/boundaries.json still hold --------------------
//
// A boundary is a decision an ADR made about what may depend on what, written as data so this audit
// enforces it instead of trusting somebody to remember. It ships with an empty list; a project adds
// one entry per ADR whose revert condition is observable as "this package must not enter the tree,
// or must only be reachable from here".
//
// GENERALISED FROM THE ORIGIN PROJECT. There, D12 hard-coded one vendor prefix, one permitted
// package and one exempt directory, all read out of two named ADRs. The shape was right and the
// constants were not portable, so the constants moved into the registry — which is also where they
// belong under RULE-01, because changing a boundary is changing a decision.
//
// Each entry can check three places, and the three are deliberately different in kind:
//
//   the manifest     a package under `package_prefix` that is not in `allowed_packages`. The SDK
//                    entering the dependency tree is the fact, and it is what the revert condition
//                    was written about.
//   the lint config  the restriction must be PRESENT, not absent, once such a package is in the
//                    tree. This is the inversion — the finding is an absence, because a package with
//                    nothing restricting it is the dangerous ordering.
//   the source roots no import of `package_prefix` outside `exempt_dirs`. This is the breach itself.
//
// The lint list is a symptom; the dependency is the fact; an import outside the exemption is the
// breach.
//
// THE LINT BRANCH IS QUIETER THAN IT LOOKS, and this is deliberate rather than unnoticed. It catches
// an exemption written with a vendor-flavoured path, because that literal contains both halves it
// matches on. It does NOT catch `forbidden_exemption_substring` being added to an exemption block
// that names no vendor — telling that apart from a legitimate exemption beside it would mean parsing
// the config's structure rather than scanning its strings, which would couple this audit to a
// working dependency tree it otherwise does not need. The source-root branch covers the consequence:
// a widened exemption is only dangerous once something uses it. The guard can be loosened silently;
// the door cannot be opened silently.
//
// Only string literals count. A comment explaining why a package is absent is not a second door, and
// a check that fired on its own rationale would teach people to delete the rationale.
//
// This is a scanner rather than a regular expression, and it has to be. Stripping block comments
// with a regular expression is wrong on exactly the file it exists to read: a pattern list
// containing a glob that ends in a slash-star opens a comment which then closes at a star-slash
// inside a later glob, silently deleting every entry between them — which is exactly where a
// forbidden entry would sit. Glob patterns and block comments share punctuation, so the two have to
// be told apart properly.

/** Every string literal in a JS source, with comments skipped. */
function stringLiterals(src) {
  const out = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    const next = src[i + 1];

    if (c === "/" && next === "/") {
      while (i < src.length && src[i] !== "\n") i++;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) i++;
      i += 2;
      continue;
    }
    if (c === '"' || c === "'" || c === "`") {
      const quote = c;
      let buf = "";
      i++;
      while (i < src.length && src[i] !== quote) {
        if (src[i] === "\\") {
          buf += src[i + 1] ?? "";
          i += 2;
          continue;
        }
        buf += src[i];
        i++;
      }
      i++;
      out.push(buf);
      continue;
    }
    i++;
  }
  return out;
}

const BOUNDARIES_PATH = ".ai/registry/boundaries.json";
const boundariesText = readIf(path.join(ROOT, BOUNDARIES_PATH));
let boundaries = [];

if (boundariesText === null) {
  unconfigured.push(
    `D12 checked nothing — ${BOUNDARIES_PATH} is missing. Restore it from the template; an absent ` +
      `boundary file and an empty one are not the same claim.`
  );
} else {
  let parsed = null;
  try {
    parsed = JSON.parse(boundariesText);
  } catch {
    err("D12", BOUNDARIES_PATH, "is not valid JSON, so no boundary could be checked");
  }
  if (parsed) {
    boundaries = Array.isArray(parsed.boundaries) ? parsed.boundaries : [];
    if (!Array.isArray(parsed.boundaries)) {
      err("D12", BOUNDARIES_PATH, "has no `boundaries` array");
    } else if (boundaries.length === 0) {
      unconfigured.push(
        `D12 checked nothing — ${BOUNDARIES_PATH} declares no boundaries. That is the shipping ` +
          `state. Add one the moment an ADR names a dependency that must not enter the tree.`
      );
    }
  }
}

for (const b of boundaries) {
  const id = b.id ?? "unnamed";
  const adr = b.adr ? ` (${b.adr})` : "";
  const why = b.reason ? ` — ${b.reason}` : "";
  const prefix = String(b.package_prefix ?? "");
  if (!prefix) {
    err("D12", BOUNDARIES_PATH, `boundary ${id} has no package_prefix, so it can check nothing`);
    continue;
  }
  const allowed = new Set(b.allowed_packages ?? []);
  const exempt = (b.exempt_dirs ?? []).map((d) => (d.endsWith("/") ? d : `${d}/`));

  // 1. the manifest — the dependency itself, which is the fact rather than the symptom.
  let inTree = false;
  const manifestRel = b.manifest ?? "package.json";
  const manifestText = readIf(path.join(ROOT, manifestRel));
  if (manifestText) {
    let pkg = null;
    try {
      pkg = JSON.parse(manifestText);
    } catch {
      err("D12", manifestRel, `is not valid JSON, so boundary ${id} could not be checked`);
    }
    if (pkg) {
      for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
        for (const name of Object.keys(pkg[field] ?? {})) {
          if (!name.startsWith(prefix)) continue;
          if (allowed.has(name)) {
            inTree = true;
            continue;
          }
          err("D12", manifestRel, `${field} includes ${name}, which boundary ${id}${adr} forbids${why}`);
        }
      }
    }
  }

  // 2. the lint config — the restriction must be PRESENT. The finding here is an absence.
  const lintRel = b.lint_config;
  const lintText = lintRel ? readIf(path.join(ROOT, lintRel)) : null;
  if (lintText) {
    const literals = stringLiterals(lintText);
    const restricts = literals.some((v) => v.startsWith(prefix));
    if (inTree && !restricts) {
      err(
        "D12",
        lintRel,
        `a package under ${prefix} is a dependency but no restriction names ${prefix} — the import ` +
          `is unrestricted, which is what boundary ${id}${adr} exists to prevent${why}`
      );
    }
    const forbidden = b.forbidden_exemption_substring;
    if (forbidden) {
      const vendor = prefix.replace(/[^A-Za-z0-9]/g, "");
      const exemptsForbidden = literals.some(
        (v) => v.includes(forbidden) && (vendor === "" || new RegExp(vendor, "i").test(v))
      );
      if (exemptsForbidden) {
        err(
          "D12",
          lintRel,
          `exempts a path containing "${forbidden}" for ${prefix} — boundary ${id}${adr} names that ` +
            `as the drift it exists to prevent${why}`
        );
      }
    }
  }

  // 3. the source roots — the breach itself.
  for (const root of b.source_roots ?? []) {
    for (const file of walk(path.join(ROOT, root))) {
      if (!/\.(ts|tsx|js|jsx|mjs|cjs)$/.test(file)) continue;
      const r = rel(file);
      if (exempt.some((d) => r.startsWith(d))) continue;
      const imported = stringLiterals(fs.readFileSync(file, "utf8")).filter((v) =>
        v.startsWith(prefix)
      );
      for (const name of new Set(imported)) {
        err(
          "D12",
          r,
          `names ${name} outside ${exempt.length ? exempt.join(", ") : "any exempt directory"} — ` +
            `boundary ${id}${adr} forbids it${why}`
        );
      }
    }
  }
}

// --- D13: every Definition of Ready item is satisfiable ----------------------------------------
//
// A gate that requires a field no reachable stage produces is unsatisfiable, and nothing else here
// detects that. It is a structural defect, not a typo: the document reads correctly, every sentence
// is true, and the loop deadlocks the first time a ticket tries to pass the gate.
//
// It took three attempts to place this gate, which is the reason the check exists rather than a
// footnote to it. First `size` was produced at DESIGN and required at READY. Then the field was split
// and the estimate moved to SPEC — still after the gate. D13 caught that one on its first run. The
// third attempt moved the gate instead of the field, to the SPEC -> READY transition, so that the
// two items the BA produces are read after the BA has produced them.
//
// The rule: each DoR item names the stage that produces it, and that stage sits at or before READY.
// Attribution is what makes the check possible at all — an item that attributes nothing cannot be
// shown to be satisfiable, and the attribution is what a reader needs anyway to know whose job it is.
//
// **Position comes from the state enum in `.ai/templates/ticket.yaml`, which must be in lifecycle
// order.** That coupling is deliberate but sharp-edged: reordering the lifecycle without reordering
// the enum leaves this check measuring against the old order and silently agreeing with a document
// that has changed underneath it. D10 holds the enum and the stage table to the same membership; it
// does not check order, because order is only meaningful here.
//
// Two accepted forms, because the document has used both:
//   - a table with `Produced at` and `By` columns, which is preferred: the attribution is a field
//     rather than a sentence, so it cannot be written ambiguously
//   - `- ` bullets carrying an inline attribution such as "set by the BA at SPEC"
//
// `human` counts as a producer and is treated as BACKLOG: the human step between TRIAGE and BACKLOG
// is where registry rows and approved ADRs come from, and those are legitimately not agent output.

const dorSection = sections(opModel ?? "").get("Definition of Ready");

if (opModel && dorSection === undefined) {
  err("D13", ".ai/01-operating-model.md", "has no `## Definition of Ready` section");
} else if (dorSection !== undefined) {
  // Lifecycle order comes from the state enum, which D10 already holds to the stage ownership table.
  const enumLine = /^#\s*state enum:\s*(.+)$/m.exec(ticketTpl ?? "")?.[1] ?? "";
  const lifecycle = enumLine.trim().split(/\s+/).filter(Boolean);
  const readyAt = lifecycle.indexOf("READY");

  if (readyAt === -1) {
    err("D13", ".ai/templates/ticket.yaml", "state enum has no READY, so DoR cannot be positioned");
  } else {
    // Table form first. A row is `| n | item | Produced at | By |`; only the `Produced at` cell is
    // read for position, so a stage named in the item text cannot be mistaken for its producer.
    const items = [];
    for (const line of dorSection.split(/\r?\n/)) {
      const cells = /^\s*\|(.+)\|\s*$/.exec(line);
      if (cells) {
        const parts = cells[1].split("|").map((c) => c.trim());
        if (parts.length < 4) continue;
        if (/^-+$/.test(parts[0])) continue; // separator
        if (/^#$/.test(parts[0]) || /^item$/i.test(parts[1])) continue; // header
        items.push({ label: parts[1], attribution: `${parts[2]} ${parts[3]}`, form: "table" });
        continue;
      }
      if (/^-\s+/.test(line)) items.push({ label: line, attribution: line, form: "bullet" });
      else if (items.length && /^\s+\S/.test(line) && items[items.length - 1].form === "bullet") {
        items[items.length - 1].label += " " + line.trim();
        items[items.length - 1].attribution += " " + line.trim();
      }
    }

    if (items.length === 0) {
      err("D13", ".ai/01-operating-model.md", "Definition of Ready lists no items");
    }

    for (const item of items) {
      const label = item.label.replace(/\s+/g, " ").slice(0, 60);
      const source = item.attribution;

      // In a table the `Produced at` cell IS the attribution, so a bare stage name is enough. In a
      // bullet it is prose, and only `at SPEC` / `by DESIGN` count — "dependencies `DONE`" is a
      // condition on OTHER tickets, and reading its `DONE` as this item's producer would report a
      // defect that is not there.
      const named = lifecycle.filter((s) =>
        item.form === "table"
          ? new RegExp(`\\b${s}\\b`).test(source)
          : new RegExp(`\\b(?:at|by|during|from)\\s+\`?${s}\`?\\b`).test(source)
      );
      const byHuman =
        item.form === "table"
          ? /\bhumans?\b/i.test(source)
          : /\b(?:by|at)\s+(?:a\s+)?humans?\b/i.test(source);

      if (named.length === 0 && !byHuman) {
        err(
          "D13",
          ".ai/01-operating-model.md",
          `DoR item "${label}…" names no producing stage, so it cannot be shown to be satisfiable`
        );
        continue;
      }

      // `human` sits at the BACKLOG step, which is before READY, so it can never be the late one.
      const positions = named.map((s) => ({ stage: s, at: lifecycle.indexOf(s) }));
      const late = positions.filter((p) => p.at > readyAt);

      if (late.length > 0 && late.length === positions.length && !byHuman) {
        err(
          "D13",
          ".ai/01-operating-model.md",
          `DoR item "${label}…" is produced at ${late.map((p) => p.stage).join(", ")}, which is ` +
            `after READY in the lifecycle. DoR gates READY, so this item can never be satisfied — ` +
            `the ticket cannot reach the stage that would set it.`
        );
      }
    }
  }
}

// --- D14: a live ticket's gate and chat_budget keys match the template -------------------------
//
// The first check in this file that reads a real `ticket.yaml` rather than the template. Every other
// ticket check — D10, D13 — reads `.ai/templates/ticket.yaml` alone, which is exactly why this rot
// went unseen: the template was corrected when ADR-019 merged `spec` and `design` into `plan`, when
// ADR-019 retired `ba`, and when ADR-022 removed the QA stage and the `qa->` edges — and no shell
// created before those dates was ever migrated.
//
// The cost was not the wrong keys. It was that six tickets each discovered it separately and patched
// their own copy at PLAN or at /ship, by whichever role happened to notice, so the board held two
// shapes at once and neither was authoritative.
//
// **DONE tickets are skipped, and that is the whole subtlety.** TEA-01 through TEA-03 genuinely ran
// under the four-gate model and carry `passed: true` on `spec`, `design` and `qa`; three tickets
// carry `qa: { waived: true, by: ADR-017 }`. Those are the record of what happened. Rewriting them
// to match today's template would not be a migration, it would be falsifying history — so the check
// governs the shells that still have a future and leaves the ones that have a past.
//
// The expected key set is READ FROM THE TEMPLATE, never hard-coded here. The next time a stage is
// added or retired, the template is edited once and this check follows; a literal list would become
// the ninth copy of the thing that just went stale.

function yamlBlockKeys(text, block) {
  const lines = text.split(/\r?\n/);
  const start = lines.findIndex((l) => l.trimEnd() === `${block}:`);
  if (start === -1) return null;
  const keys = [];
  for (let i = start + 1; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*(#|$)/.test(line)) continue;
    if (!/^\s+\S/.test(line)) break;
    const m = /^\s+([^:\s#]+):/.exec(line);
    if (m) keys.push(m[1]);
  }
  return keys;
}

if (ticketTpl) {
  const ticketsDir = path.join(ROOT, ".ai/board/tickets");
  const shells = fs.existsSync(ticketsDir)
    ? fs.readdirSync(ticketsDir).sort().map((d) => path.join(ticketsDir, d, "ticket.yaml")).filter((f) => fs.existsSync(f))
    : [];

  for (const block of ["gates", "chat_budget"]) {
    const want = yamlBlockKeys(ticketTpl, block);
    if (!want) {
      err("D14", ".ai/templates/ticket.yaml", `has no \`${block}:\` block to check tickets against`);
      continue;
    }
    for (const file of shells) {
      const text = readIf(file);
      if (text === null) continue;
      const r = rel(file);
      if (/^state:\s*DONE\b/m.test(text)) continue; // history, not a shell — see above

      const got = yamlBlockKeys(text, block);
      if (got === null) {
        err("D14", r, `has no \`${block}:\` block`);
        continue;
      }
      const extra = got.filter((k) => !want.includes(k));
      const missing = want.filter((k) => !got.includes(k));
      if (extra.length) {
        err("D14", r, `${block} carries ${extra.map((k) => `\`${k}\``).join(", ")}, which the template retired — migrate the shell, do not re-add the key to the template`);
      }
      if (missing.length) {
        err("D14", r, `${block} is missing ${missing.map((k) => `\`${k}\``).join(", ")}, which the template declares`);
      }
    }
  }
}

// --- D15: every e2e quarantine is registered, ticketed and unexpired (ADR-060) ----------------
//
// ADR-060 lets a failing end-to-end test be quarantined with `test.fixme`, and only while three things
// hold: a comment names a tracking ticket, `docs/ops/e2e-quarantine.md` has a row for the test, and
// that row carries an expiry no more than 30 days out. `testing-standards.md` ("A skipped test left
// in the suite") states the exception; nothing but this check makes it true. Without it the register
// is a document a quarantine can quietly outlive, which is the permanent debt ADR-060 § Consequences
// names. Designed in .ai/board/tickets/CICD-01/01-plan.md § 4.4.
//
// A test is matched to its row by spec file plus exact title, never by line number or AC label: lines
// move with every edit above them and AC labels repeat across files (plan § 8 alternative 4).
// `test.skip` is not policed here; ADR-060 permits `test.fixme` only.

const QUARANTINE_REGISTER = "docs/ops/e2e-quarantine.md";
const QUARANTINE_E2E_DIR = "tests/e2e";
const QUARANTINE_MAX_DAYS = 30;
const QUARANTINE_KINDS = new Set(["fixme", "flaky"]);
const QUARANTINE_HEADER = ["Test", "Kind", "Suspected cause", "First failing PR", "Ticket", "Expiry"];

/** @typedef {{ file: string, title: string, kind: string, cause: string, firstPr: string,
 *              ticket: string, expiry: string, line: number }} QuarantineRow */
/** @typedef {{ file: string, line: number, title: string | null, tickets: string[],
 *              describe: boolean }} FixmeSite */
/** @typedef {{ file: string, title: string, fixme: boolean }} TestDecl */

/** Today's UTC date and today + n days, as YYYY-MM-DD strings. */
function isoDayUTC(offsetDays = 0) {
  const d = new Date();
  const t = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate() + offsetDays);
  return new Date(t).toISOString().slice(0, 10);
}

/** Splits a markdown table row on unescaped `|`, trimmed, without the outer pipes. */
function splitTableRow(line) {
  let body = line.trim().replace(/^\|/, "");
  if (body.endsWith("|") && !body.endsWith("\\|")) body = body.slice(0, -1);
  const cells = [];
  let cur = "";
  for (let i = 0; i < body.length; i++) {
    if (body[i] === "\\" && body[i + 1] === "|") {
      cur += "|";
      i++;
    } else if (body[i] === "|") {
      cells.push(cur.trim());
      cur = "";
    } else cur += body[i];
  }
  cells.push(cur.trim());
  return cells;
}

/** Rows of the first table whose header cells equal QUARANTINE_HEADER. Missing file → []. */
function parseQuarantineRegister(text) {
  /** @type {QuarantineRow[]} */
  const rows = [];
  /** @type {string[]} */
  const problems = [];
  if (!text) return { rows, problems };
  const lines = text.split(/\r?\n/);
  let i = lines.findIndex((l) => {
    if (!l.trim().startsWith("|")) return false;
    const c = splitTableRow(l);
    return c.length === QUARANTINE_HEADER.length && c.every((x, k) => x === QUARANTINE_HEADER[k]);
  });
  if (i === -1) return { rows, problems };
  i++;
  if (i < lines.length && /^\s*\|[\s:|-]+\|\s*$/.test(lines[i])) i++;
  let n = 0;
  for (; i < lines.length && lines[i].trim().startsWith("|"); i++) {
    n++;
    const cells = splitTableRow(lines[i]);
    if (cells.length !== QUARANTINE_HEADER.length) {
      problems.push(`row ${n}: has ${cells.length} cells, the header has ${QUARANTINE_HEADER.length}`);
      continue;
    }
    const m = /^`([^`]+)`\s+›\s+(.+)$/.exec(cells[0]);
    if (!m) {
      problems.push(`row ${n}: Test cell is not \`<path>\` › <title>`);
      continue;
    }
    rows.push({ file: m[1], title: m[2], kind: cells[1], cause: cells[2], firstPr: cells[3], ticket: cells[4], expiry: cells[5], line: n });
  }
  return { rows, problems };
}

/** The first argument when it is a string literal starting at `from`, else null. */
function readTitleAt(line, from) {
  const m = /^\s*(["'`])/.exec(line.slice(from));
  if (!m) return null;
  const q = m[1];
  let out = "";
  for (let i = from + m[0].length; i < line.length; i++) {
    const c = line[i];
    if (c === "\\") {
      out += line[i + 1] ?? "";
      i++;
    } else if (c === q) return out;
    else if (q === "`" && c === "$" && line[i + 1] === "{") return null;
    else out += c;
  }
  return null; // unterminated on this line
}

const isCommentLine = (l) => /^\s*(\/\/|\*|\/\*)/.test(l);

/** Every `test.fixme(` / `test.describe.fixme(` site in one file's text. */
function findFixmeSites(file, text) {
  /** @type {FixmeSite[]} */
  const sites = [];
  const lines = text.split(/\r?\n/);
  lines.forEach((l, idx) => {
    if (isCommentLine(l)) return;
    const m = /\btest(\.describe)?\.fixme\s*\(/.exec(l);
    if (!m) return;
    const ids = /\b[A-Z]{2,5}-\d{2,3}\b/g;
    const tickets = [...(lines[idx - 1] ?? "").matchAll(ids), ...l.matchAll(ids)].map((x) => x[0]);
    sites.push({ file, line: idx + 1, title: readTitleAt(l, m.index + m[0].length), tickets, describe: Boolean(m[1]) });
  });
  return sites;
}

/** Every `test(` / `test.fixme(` declaration with a string-literal title in one file's text. */
function findTestDecls(file, text) {
  /** @type {TestDecl[]} */
  const decls = [];
  for (const l of text.split(/\r?\n/)) {
    if (isCommentLine(l)) continue;
    const m = /\btest(\.fixme)?\s*\(/.exec(l);
    if (!m) continue;
    const title = readTitleAt(l, m.index + m[0].length);
    if (title !== null) decls.push({ file, title, fixme: Boolean(m[1]) });
  }
  return decls;
}

{
  const { rows, problems } = parseQuarantineRegister(readIf(path.join(ROOT, QUARANTINE_REGISTER)));
  const specs = walk(path.join(ROOT, QUARANTINE_E2E_DIR)).filter((f) => f.endsWith(".ts"));
  const sites = [];
  const decls = [];
  for (const f of specs) {
    const text = readIf(f) ?? "";
    sites.push(...findFixmeSites(rel(f), text));
    decls.push(...findTestDecls(rel(f), text));
  }
  const key = (f, t) => `${f}\u0000${t}`;
  const rowByKey = new Map();
  const declByKey = new Map(decls.map((d) => [key(d.file, d.title), d]));
  const today = isoDayUTC(0);
  const horizon = isoDayUTC(QUARANTINE_MAX_DAYS);

  for (const p of problems) err("D15", QUARANTINE_REGISTER, p);

  for (const r of rows) {
    const label = `\`${r.file}\` › ${r.title}`;
    if (rowByKey.has(key(r.file, r.title))) err("D15", QUARANTINE_REGISTER, `${label} is registered twice`);
    else rowByKey.set(key(r.file, r.title), r);
    if (!QUARANTINE_KINDS.has(r.kind)) err("D15", QUARANTINE_REGISTER, `${label}: kind must be fixme or flaky, not \`${r.kind}\``);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(r.expiry)) err("D15", QUARANTINE_REGISTER, `${label}: expiry is not YYYY-MM-DD (\`${r.expiry}\`)`);
    else if (r.expiry < today) err("D15", QUARANTINE_REGISTER, `${label} expired on ${r.expiry} — fix it, delete the row with a reason, or have the operator re-date it`);
    else if (r.expiry > horizon) err("D15", QUARANTINE_REGISTER, `${label}: expiry ${r.expiry} is more than 30 days out (the latest allowed today is ${horizon})`);
    for (const [col, v] of [["Suspected cause", r.cause], ["First failing PR", r.firstPr], ["Ticket", r.ticket]]) {
      if (!v) err("D15", QUARANTINE_REGISTER, `${label} has an empty ${col} cell`);
    }
    if (r.ticket && !fs.existsSync(path.join(ROOT, ".ai/board/tickets", r.ticket, "ticket.yaml"))) {
      err("D15", QUARANTINE_REGISTER, `${label}: ticket ${r.ticket} has no ticket.yaml under .ai/board/tickets/`);
    }
    const d = declByKey.get(key(r.file, r.title));
    if (!d) err("D15", QUARANTINE_REGISTER, `${label} names a test that does not exist`);
    else if (r.kind === "fixme" && !d.fixme) err("D15", QUARANTINE_REGISTER, `${label} is registered as fixme but runs — delete the row`);
    else if (r.kind === "flaky" && d.fixme) err("D15", QUARANTINE_REGISTER, `${label} is registered as flaky but is quarantined — a flaky test keeps running`);
  }

  for (const s of sites) {
    if (s.describe) {
      err("D15", s.file, `line ${s.line}: describe-level fixme cannot be registered — quarantine tests one at a time`);
      continue;
    }
    if (s.title === null) {
      err("D15", s.file, `test.fixme at line ${s.line} has no string-literal title, so no register row can match it`);
      continue;
    }
    const row = rowByKey.get(key(s.file, s.title));
    if (!row) {
      err("D15", s.file, `"${s.title}" (line ${s.line}) is quarantined with no row in ${QUARANTINE_REGISTER}`);
      continue;
    }
    if (!s.tickets.includes(row.ticket)) {
      err("D15", s.file, `"${s.title}" (line ${s.line}) names no ticket, or not ${row.ticket}, on its line or the line above`);
    }
  }
}

// --- D16: the Antigravity adapter points at the commands and copies nothing ------------------
//
// Antigravity reads none of `.claude/`. `.agents/skills/<name>/SKILL.md` is how `/<name>` reaches it,
// and each one is a pointer to `.claude/commands/<name>.md`, never a copy — a copied command body is
// the second copy CLAUDE.md § Stack warns always goes stale. So this holds the two sets together:
// every live command has a shim, no shim outlives its command or shims a retired one, the shim's
// `description:` line is the command's own, the shim names the file it points at, and it stays
// small enough that it cannot be holding the command body. Workflows (`.agents/workflows/`) are not
// checked: Antigravity stopped indexing them on 2026-10-19 (docs/migration/workflows-to-skills).
//
// It also holds `.agents/rules/claude-md.md` under Antigravity's 24,000-byte rule limit, measured
// after its `@[label](path)` includes are expanded. Over the limit, Antigravity truncates the file
// silently, and that file inlines CLAUDE.md — so the first sign would be an agent missing the end of
// the project instructions.
//
// Who fixes a finding: the steward, when a command is added, retired or re-described, or when
// CLAUDE.md grows. No stage writes either side.
//
// No `.agents/skills/` at all means no adapter: a note, nothing checked.

const AG_SKILLS = ".agents/skills";
const AG_RULE = ".agents/rules/claude-md.md";
const AG_RULE_LIMIT = 24000;
const AG_SHIM_MAX = 4000;

/** A command is retired by a `description: RETIRED…` line or a `> **`/name` is retired` banner. */
function isRetiredCommand(name, text) {
  return (
    /^description:\s*RETIRED\b/m.test(text) ||
    new RegExp("^> \\*\\*`/" + name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "` is retired\\b", "m").test(text)
  );
}

/** The raw text after `key:` in a file's leading front-matter, or null. */
function frontValue(text, key) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text ?? "");
  if (!m) return null;
  const l = new RegExp(`^${key}:[ \\t]*(.*?)[ \\t]*$`, "m").exec(m[1]);
  return l ? l[1] : null;
}

{
  const skillsDir = path.join(ROOT, AG_SKILLS);
  if (!fs.existsSync(skillsDir)) {
    unconfigured.push(`D16: no ${AG_SKILLS}/, so there is no Antigravity adapter and nothing to check`);
  } else {
    const cmdDir = path.join(ROOT, ".claude/commands");
    const commands = new Map(); // name -> { text, retired }
    if (fs.existsSync(cmdDir)) {
      for (const f of fs.readdirSync(cmdDir).filter((x) => x.endsWith(".md"))) {
        const name = f.slice(0, -3);
        const text = fs.readFileSync(path.join(cmdDir, f), "utf8");
        commands.set(name, { text, retired: isRetiredCommand(name, text) });
      }
    }
    const shims = fs.readdirSync(skillsDir, { withFileTypes: true }).filter((e) => e.isDirectory()).map((e) => e.name);

    for (const [name, c] of commands) {
      if (!c.retired && !shims.includes(name)) {
        err("D16", `.claude/commands/${name}.md`, `has no Antigravity shim at ${AG_SKILLS}/${name}/SKILL.md`);
      }
    }

    for (const name of shims) {
      const shimRel = `${AG_SKILLS}/${name}/SKILL.md`;
      const text = readIf(path.join(ROOT, shimRel));
      const c = commands.get(name);
      if (text === null) {
        err("D16", `${AG_SKILLS}/${name}/`, "has no SKILL.md, so Antigravity loads nothing from it");
        continue;
      }
      if (!c) {
        err("D16", shimRel, `shims /${name}, which has no file in .claude/commands/`);
        continue;
      }
      if (c.retired) {
        err("D16", shimRel, `shims /${name}, which is retired — a shim advertises it on every turn; delete it`);
        continue;
      }
      const declared = frontValue(text, "name");
      if (declared !== null && declared !== name) {
        err("D16", shimRel, `declares name \`${declared}\`, but its folder makes it /${name}`);
      }
      const want = frontValue(c.text, "description");
      const got = frontValue(text, "description");
      if (got === null) err("D16", shimRel, "has no description, which Antigravity requires");
      else if (want !== null && got !== want) {
        err("D16", shimRel, `description has drifted from .claude/commands/${name}.md\n      command: ${want}\n      shim:    ${got}`);
      }
      if (!text.includes(`.claude/commands/${name}.md`)) {
        err("D16", shimRel, `does not name .claude/commands/${name}.md, the file it is meant to point at`);
      }
      const bytes = Buffer.byteLength(text, "utf8");
      if (bytes > AG_SHIM_MAX) {
        err("D16", shimRel, `is ${bytes} bytes (limit ${AG_SHIM_MAX}) — a shim points at the command, it does not copy it`);
      }
    }

    const ruleText = readIf(path.join(ROOT, AG_RULE));
    if (ruleText !== null) {
      let size = Buffer.byteLength(ruleText, "utf8");
      for (const m of ruleText.matchAll(/@\[[^\]]*\]\(([^)]+)\)/g)) {
        const target = path.resolve(path.dirname(path.join(ROOT, AG_RULE)), m[1]);
        const inc = readIf(target);
        if (inc === null) {
          err("D16", AG_RULE, `includes ${m[1]}, which does not exist`);
          continue;
        }
        size += Buffer.byteLength(inc.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, ""), "utf8") - Buffer.byteLength(m[0], "utf8");
      }
      if (size > AG_RULE_LIMIT) {
        err("D16", AG_RULE, `is ${size} bytes with its includes expanded; Antigravity truncates a rule past ${AG_RULE_LIMIT}`);
      }
    }
  }
}

// --- Report ------------------------------------------------------------------------------------

const byCheck = (list) => {
  const m = new Map();
  for (const e of list) {
    if (!m.has(e.check)) m.set(e.check, []);
    m.get(e.check).push(e);
  }
  return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
};

console.log("docs-audit");
console.log(
  ANY_SCAFFOLD
    ? `mode: strict for ${SCAFFOLD_ROOTS.filter(scaffoldRootExists).join(", ")}`
    : `mode: pre-scaffold (D6 defers every path under ${SCAFFOLD_ROOTS.join(", ")})`
);
for (const line of unconfigured) console.log(`note: ${line}`);
console.log("");

for (const [check, list] of byCheck(errors)) {
  console.log(`FAIL ${check} (${list.length})`);
  for (const e of list) console.log(`  - ${e.file}: ${e.msg}`);
}
for (const [check, list] of byCheck(warnings)) {
  console.log(`WARN ${check} (${list.length}) — advisory, does not fail the run`);
  for (const e of list) console.log(`  - ${e.file}: ${e.msg}`);
}
if (pending.length) {
  console.log(`PENDING D6 (${pending.length}) — deferred; each row says why`);
  for (const e of pending) console.log(`  - ${e.file}: ${e.msg}`);
}

console.log("");
console.log(`errors: ${errors.length}  warnings: ${warnings.length}  pending: ${pending.length}`);
process.exit(errors.length > 0 ? 1 : 0);
