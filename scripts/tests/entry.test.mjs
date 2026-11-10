// scripts/lib/entry.mjs — how an unattended run is entered, and what it reports. ADR-037.
//
// **The resolver order is the thing under test, not the individual rules.** Step 5 is the one that
// matters: a string that looks like a ticket id but names no ticket is an ERROR and never falls
// through to "treat it as an idea". Falling through would turn one mistyped character into an idea
// file, a feature row and a ticket — three board and registry writes from a typo, with the operator
// finding out at the pull request.
//
// The other load-bearing assertion is that the verdict is read from front-matter. Before ADR-037
// there was nothing to read: `gate:` is `PASS` on every file in `.ai/board/ideas/` including the one
// that was REJECTed, so a run that trusted `gate` would have promoted a rejected idea.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  resolveInput, readVerdict, verdictStop, openQuestionsStop, sizeStop,
  orphanPaths, renderReport, parseTrackerYaml, trackerConfigured,
  MAX_INTAKE_QUESTIONS, ON_SPLIT, ON_OPEN_QUESTIONS_AFTER_PLAN, IDEAS_DIR,
  matchIdeaFile, awaitedAdrs, adrStatus, adrsSettled, needsAdrDecision, DECISIONS_DIR,
  parsePorcelainZ, planCarry, wipBlockers, IN_FLIGHT_STATES, SHIP_OWNED, inAllowedPaths,
  ideaTicketIds, isOwnIdea,
} from "../lib/entry.mjs";
import { readFrontMatter, parseSimpleYaml } from "../lib/ticket-yaml.mjs";
import { INTAKE_SCHEMA, intakePrompt, triagePrompt, triageFromFilePrompt, retriagePrompt } from "../lib/prompts.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const tmpIdea = (fm, body = "# Idea\n") => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "entry-"));
  const f = path.join(d, "idea.md");
  const block = Object.entries(fm).map(([k, v]) => `${k}: ${v}`).join("\n");
  fs.writeFileSync(f, `---\n${block}\n---\n\n${body}`);
  return f;
};

const deps = (exists = () => false) => ({ ticketFileExists: exists, trackerIsConfigured: () => false });

// --- Resolver order -------------------------------------------------------------------------------

test("an explicit flag wins and skips detection", () => {
  const r = resolveInput("ignored", { forced: { kind: "idea-text", value: "CAL-10" } }, deps(() => true));
  assert.equal(r.kind, "intake");
  assert.equal(r.text, "CAL-10", "the flag must win even when the value looks like a ticket id");
});

test("no input asks the orchestrator what is next", () => {
  assert.equal(resolveInput(null, {}, deps()).kind, "next");
  assert.equal(resolveInput("", {}, deps()).kind, "next");
});

test("a ticket id that exists enters at its ticket", () => {
  const r = resolveInput("CAL-10", {}, deps((x) => x === "CAL-10"));
  assert.equal(r.kind, "ticket");
  assert.equal(r.id, "CAL-10");
});

test("a ticket id that does NOT exist is an error and never falls through to an idea", () => {
  const r = resolveInput("CAL-99", {}, deps(() => false));
  assert.ok(r.error, "a missing ticket id must be an error");
  assert.match(r.error, /looks like a ticket id/);
  assert.equal(r.kind, undefined, "it must not resolve to any entry kind");
  assert.match(r.error, /--idea/, "the error should say how to mean it as an idea");
});

test("free text becomes an idea, and is not mistaken for anything else", () => {
  for (const s of ["add a dark mode toggle", "members cannot see who declared nothing"]) {
    const r = resolveInput(s, {}, deps());
    assert.equal(r.kind, "intake", `${s} should resolve to intake`);
    assert.equal(r.text, s, "the text must be carried through unchanged");
  }
});

test("a tracker URL is refused with both reasons, not attempted", () => {
  const r = resolveInput("https://app.clickup.com/t/86abc1234", {}, deps());
  assert.ok(r.error);
  assert.match(r.error, /allowed_list_ids/, "RULE-18: an empty allow list blocks every call");
  assert.match(r.error, /feature_ids/, "a pulled ticket has no path to Definition of Ready item 1");
  assert.match(r.error, /--idea/, "it should offer the route that does work");
});

test("--ticket and --idea-file report a missing target rather than inventing one", () => {
  assert.match(resolveInput(null, { forced: { kind: "ticket", value: "X-01" } }, deps()).error, /no ticket\.yaml/);
  assert.match(resolveInput(null, { forced: { kind: "idea-file", value: "/nope.md" } }, deps()).error, /not found/);
});

// --- Naming an idea file ----------------------------------------------------------------------------
//
// ADR-038 split the asking out of the loop: `/idea` interrogates in a session and writes the file,
// then the loop runs against that file and asks nothing. Which means the operator has to name the
// file, and `.ai/board/ideas/2026-09-22-an-admin-cannot-see-another-teams-roster.md` is not
// something anybody types. Any unambiguous fragment resolves.

const ideasFixture = (names) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "ideas-"));
  for (const n of names) fs.writeFileSync(path.join(d, n), "---\nstage: TRIAGE\n---\n");
  return d;
};

test("a fragment of the slug names the file", () => {
  const d = ideasFixture(["2026-09-22-an-admin-cannot-see-another-teams-roster.md"]);
  for (const fragment of ["roster", "admin-cannot", "2026-09-22-an-admin-cannot-see-another-teams-roster"]) {
    assert.ok(matchIdeaFile(fragment, d).file, `${fragment} should resolve`);
  }
});

test("the .md is optional and matching is case-insensitive", () => {
  const d = ideasFixture(["2026-09-22-a-thing.md"]);
  assert.ok(matchIdeaFile("a-thing.md", d).file);
  assert.ok(matchIdeaFile("A-THING", d).file);
});

test("an exact filename wins over a substring of a longer one", () => {
  const d = ideasFixture(["2026-09-22-team.md", "2026-09-22-team-selector-for-admins.md"]);
  const hit = matchIdeaFile("2026-09-22-team", d);
  assert.ok(hit.file, "an exact name must not be reported as ambiguous");
  assert.match(hit.file, /2026-09-22-team\.md$/);
});

test("ambiguity is an error that lists the candidates, never a first match", () => {
  // Running the wrong idea file runs the wrong triage, and the operator finds out at the PR.
  const d = ideasFixture(["2026-09-01-team-a.md", "2026-09-02-team-b.md"]);
  const hit = matchIdeaFile("team", d);
  assert.ok(!hit.file);
  assert.match(hit.error, /matches 2 idea files/);
  assert.match(hit.error, /team-a\.md/);
  assert.match(hit.error, /team-b\.md/);
});

test("no match returns nothing, so the resolver can fall through", () => {
  const d = ideasFixture(["2026-09-22-a-thing.md"]);
  assert.deepEqual(matchIdeaFile("nothing-like-it", d), {});
});

test("a sentence never matches an idea file by accident", () => {
  // Restricted to a single token: otherwise free text containing a common word would silently
  // re-run a triage the operator meant to start fresh.
  const d = ideasFixture(["2026-09-22-the-sidebar-grows-with-the-role.md"]);
  const r = resolveInput("the sidebar should let admins pick a team", {},
    { ticketFileExists: () => false, ideasDir: d, trackerIsConfigured: () => false });
  assert.equal(r.kind, "intake", "free text must stay free text");
});

test("a ticket id that names no ticket but matches an idea resolves to the idea", () => {
  const d = ideasFixture(["2026-09-22-uia-01-team-selector.md"]);
  const r = resolveInput("UIA-01", {},
    { ticketFileExists: () => false, ideasDir: d, trackerIsConfigured: () => false });
  assert.equal(r.kind, "idea");
});

test("a ticket id still wins over an idea file that mentions it", () => {
  const d = ideasFixture(["2026-09-22-cal-10-year-view.md"]);
  const r = resolveInput("CAL-10", {},
    { ticketFileExists: (x) => x === "CAL-10", ideasDir: d, trackerIsConfigured: () => false });
  assert.equal(r.kind, "ticket", "an existing ticket is never shadowed by an idea file");
});

// --- Triaging a file that /idea already filled in -----------------------------------------------------

test("the triage-from-file prompt names the file and forbids guessing", () => {
  const p = triageFromFilePrompt(".ai/board/ideas/2026-09-22-a-thing.md", "2026-09-22T00:00:00Z");
  assert.match(p, /^\/triage \.ai\/board\/ideas\/2026-09-22-a-thing\.md/);
  assert.match(p, /no intake step before it/, "the file is the answers; there is nothing to ask");
  assert.match(p, /BLOCKED/, "a missing decision blocks rather than being guessed");
  assert.match(p, /verbatim/, "the operator's words are not rewritten at triage");
  assert.match(p, /2026-09-22T00:00:00Z/, "product has no clock of its own");
});

test("triage-from-file prefers NEEDS-ADR over REJECT when the registry is stale", () => {
  // A real case: the glossary says one team exists in v1, and a migration written eleven days
  // earlier records the operator deciding otherwise. A REJECT on the strength of the stale line
  // would have thrown away work the operator had already approved.
  const p = triageFromFilePrompt("x.md", "t");
  assert.match(p, /prefer NEEDS-ADR over REJECT/);
});

// --- The verdict, read from disk ------------------------------------------------------------------

test("the verdict comes from front-matter, with its reason and ticket id", () => {
  const f = tmpIdea({ gate: "PASS", verdict: "PROMOTE", verdict_reason: "worth building", ticket_id: "CAL-11" });
  const v = readVerdict(f, readFrontMatter);
  assert.equal(v.verdict, "PROMOTE");
  assert.equal(v.reason, "worth building");
  assert.equal(v.ticketId, "CAL-11");
});

test("a file with gate PASS but no verdict is refused, not read as a pass", () => {
  // This is the pre-ADR-037 shape, and it is exactly the trap: `gate: PASS` is on EVERY idea file in
  // .ai/board/ideas/, including the one whose verdict was REJECT.
  const f = tmpIdea({ gate: "PASS", next_state: "TRIAGE" });
  const v = readVerdict(f, readFrontMatter);
  assert.ok(v.error);
  assert.match(v.error, /no `verdict`/);
  assert.equal(v.verdict, undefined);
});

test("REJECT and NEEDS-ADR each stop, and PROMOTE proceeds", () => {
  assert.match(verdictStop({ verdict: "REJECT", reason: "already covered by CAL-06" }), /REJECT/);
  assert.match(verdictStop({ verdict: "REJECT", reason: "already covered by CAL-06" }), /already covered/);

  const adr = verdictStop({ verdict: "NEEDS-ADR", reason: "changes what approved means" });
  assert.match(adr, /NEEDS-ADR/);
  assert.match(adr, /already be drafted/, "triage writes the ADR rather than handing over homework");

  assert.equal(verdictStop({ verdict: "PROMOTE", reason: "" }), null);
});

// --- NEEDS-ADR has an exit ------------------------------------------------------------------------
//
// 2026-09-22: the runner skipped TRIAGE on any file that already carried a verdict, so a NEEDS-ADR
// idea re-stopped with the same words on every run, whatever the operator did to the ADRs. The exit
// is the ADR's own `## Status` line.

const tmpDecisions = (files) => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "adr-"));
  for (const [name, status] of Object.entries(files)) {
    fs.writeFileSync(path.join(d, name), `---\ndoc_version: 1\n---\n\n# ${name}\n\n## Status\n\n${status}\n\n## Context\n\nx\n`);
  }
  return d;
};

test("awaited ADRs come from awaiting_adrs, and from verdict_reason for a file triaged before it", () => {
  assert.deepEqual(awaitedAdrs({ awaiting_adrs: ["ADR-041", "ADR-042"], verdict_reason: "ADR-001" }), ["ADR-041", "ADR-042"]);
  assert.deepEqual(awaitedAdrs({ awaiting_adrs: [], verdict_reason: "drafted ADR-039 and ADR-040; ADR-039 first" }), ["ADR-039", "ADR-040"]);
  assert.deepEqual(awaitedAdrs({ verdict_reason: "no ADR named" }), []);
});

test("an ADR's status is the backticked token under ## Status", () => {
  const d = tmpDecisions({
    "ADR-101-a.md": "`PROPOSED` — 2026-09-22, drafted by `product`.",
    "ADR-102-b.md": "**`ACCEPTED by the operator` — 2026-09-23.**",
    "ADR-103-c.md": "Accepted, no backticks.",
  });
  assert.equal(adrStatus("ADR-101", d).status, "PROPOSED");
  assert.equal(adrStatus("ADR-102", d).status, "ACCEPTED by the operator");
  assert.equal(adrStatus("ADR-103", d).status, null);
  assert.match(adrStatus("ADR-103", d).problem, /no backticked status/);
  assert.match(adrStatus("ADR-104", d).problem, /no file/);
});

test("two files under one ADR number are reported, never guessed between", () => {
  const d = tmpDecisions({ "ADR-105-a.md": "`ACCEPTED by the operator`", "ADR-105-b.md": "`PROPOSED`" });
  const s = adrStatus("ADR-105", d);
  assert.equal(s.status, null);
  assert.match(s.problem, /2 files/);
});

test("settled means every awaited ADR has left PROPOSED — a rejection counts as decided", () => {
  const S = (status) => ({ id: "ADR-1", file: "x", status });
  assert.equal(adrsSettled([S("ACCEPTED by the operator"), S("REJECTED by the operator")]), true);
  assert.equal(adrsSettled([S("ACCEPTED by the operator"), S("PROPOSED")]), false);
  assert.equal(adrsSettled([S(null)]), false, "an unreadable status is not a decision");
  assert.equal(adrsSettled([]), false, "no ADR named means nothing to wait for, not nothing left to wait for");
});

test("a NEEDS-ADR stop names each ADR file, its status, the exact edit and the command", () => {
  const adrs = [
    { id: "ADR-039", file: ".ai/registry/decisions/ADR-039-x.md", status: "PROPOSED", problem: null },
    { id: "ADR-040", file: ".ai/registry/decisions/ADR-040-y.md", status: "PROPOSED", problem: null },
  ];
  const why = verdictStop({ verdict: "NEEDS-ADR", reason: "registry stale" }, adrs);
  assert.match(why, /ADR-039-x\.md.*`PROPOSED`/);
  assert.match(why, /re-triages by itself/);

  const decide = needsAdrDecision(adrs, "node scripts/run-loop.mjs auto some-idea");
  assert.match(decide, /ACCEPTED by the operator/);
  assert.match(decide, /ADR-040-y\.md/);
  assert.match(decide, /node scripts\/run-loop\.mjs auto some-idea/);
  assert.doesNotMatch(decide, /<ticket>/, "the resume line names what exists");
});

test("a NEEDS-ADR that names no ADR says the runner cannot see it decided", () => {
  assert.match(verdictStop({ verdict: "NEEDS-ADR", reason: "needs a decision" }, []), /names no ADR/);
});

test("a BLOCKED triage is reported as blocked, not as a pre-ADR-037 file", () => {
  const f = tmpIdea({ gate: "BLOCKED", blocking_reason: '"who may approve?"', verdict: '""' });
  const v = readVerdict(f, readFrontMatter);
  assert.match(v.error, /TRIAGE blocked/);
  assert.match(v.error, /who may approve/);
});

test("the re-triage prompt quotes the decided statuses and forbids touching them", () => {
  const p = retriagePrompt(".ai/board/ideas/x.md",
    [{ id: "ADR-039", file: ".ai/registry/decisions/ADR-039-x.md", status: "ACCEPTED by the operator" }], "T");
  assert.match(p, /^\/triage \.ai\/board\/ideas\/x\.md/);
  assert.match(p, /ADR-039.*ACCEPTED by the operator/);
  assert.match(p, /Never change an ADR's status yourself/);
  assert.match(p, /Do not return NEEDS-ADR on the same ADRs again/);
});

test("both triage prompts ask for awaiting_adrs, which is the runner's only way to see the exit", () => {
  assert.match(triageFromFilePrompt("x.md", "T"), /awaiting_adrs/);
  assert.match(triagePrompt("req", [], "T"), /awaiting_adrs/);
});

// Real files. A fixture written beside the check agrees with the check about what the world looks
// like; these read the decisions directory and the idea file that the defect was found on.

test("real ADRs: every status line in decisions/ reads as a known status or reports why not", () => {
  const known = /^(PROPOSED|ACCEPTED|REJECTED|WITHDRAWN|SUPERSEDED)\b/;
  const ids = [...new Set(fs.readdirSync(DECISIONS_DIR).map((f) => /^ADR-\d{3}/.exec(f)?.[0]).filter(Boolean))];
  assert.ok(ids.length > 30, "the real decisions directory was read");
  for (const id of ids) {
    const s = adrStatus(id);
    if (s.status) assert.match(s.status, known, `${id} status "${s.status}"`);
    else assert.ok(s.problem, `${id} has neither a status nor a reason why not`);
  }
  assert.equal(adrStatus("ADR-005").status, "ACCEPTED by the operator");
});

test("real idea files: every NEEDS-ADR verdict names ADRs that resolve to exactly one file", () => {
  const files = fs.readdirSync(IDEAS_DIR).filter((f) => f.endsWith(".md"));
  for (const name of files) {
    // Idea files from before ADR-037 carry prose in their front-matter that the board parser
    // refuses. They have no `verdict` field either, so none of them can be a NEEDS-ADR the runner
    // routes on; skipping them loses nothing this test is about.
    let fm;
    try { fm = readFrontMatter(path.join(IDEAS_DIR, name)); } catch { continue; }
    if (String(fm?.verdict ?? "").toUpperCase() !== "NEEDS-ADR") continue;
    const ids = awaitedAdrs(fm);
    assert.ok(ids.length > 0, `${name} is NEEDS-ADR and names no ADR, so the runner can never re-triage it`);
    for (const id of ids) assert.ok(adrStatus(id).file, `${name} waits on ${id}: ${adrStatus(id).problem}`);
  }
});

test("an unrecognised verdict stops rather than being treated as a pass", () => {
  assert.match(verdictStop({ verdict: "MAYBE" }), /unrecognised/);
});

// --- Checks after PLAN ----------------------------------------------------------------------------

test("an OPEN QUESTIONS entry about permissions stops the run", () => {
  const plan = `# Plan\n\n## OPEN QUESTIONS\n\n- Which role may approve an entry for another member?\n`;
  const why = openQuestionsStop(plan);
  assert.ok(why, "a permissions question must stop the run");
  assert.match(why, /permissions/);
});

test("a layout-only OPEN QUESTIONS entry does not stop the run", () => {
  // The carve-out added 2026-09-04 makes the visual arrangement `tech-lead-design`'s to originate,
  // so a layout question blocks nobody.
  const plan = `# Plan\n\n## OPEN QUESTIONS\n\n- Should the density toggle sit above or below the legend?\n`;
  assert.equal(openQuestionsStop(plan), null);
});

test("an entry that cannot be classified is treated as blocking", () => {
  const plan = `# Plan\n\n## OPEN QUESTIONS\n\n- Is the fourth thing still true?\n`;
  assert.ok(openQuestionsStop(plan), "a tie must go to stopping, not to proceeding");
});

test("a plan with no OPEN QUESTIONS section does not stop the run", () => {
  assert.equal(openQuestionsStop("# Plan\n\n## 1. Problem and scope\n\nSomething.\n"), null);
  assert.equal(openQuestionsStop(null), null);
});

test("the OPEN QUESTIONS section ends at the next heading", () => {
  const plan = [
    "# Plan", "", "## OPEN QUESTIONS", "",
    "- Should the density toggle sit above the legend?", "",
    "## 8. Rejected alternatives", "",
    "- A second policy per role was rejected because it duplicates the permission model.",
  ].join("\n");
  assert.equal(openQuestionsStop(plan), null,
    "prose after the section must not be read as an open question");
});

test("L splits and XL escalates", () => {
  assert.match(sizeStop({ size: "L" }), /must split at PLAN/);
  assert.match(sizeStop({ size: "XL" }), /escalates/);
  assert.equal(sizeStop({ size: "M" }), null);
  assert.equal(sizeStop({ size: "S" }), null);
  assert.equal(sizeStop({}), null);
});

// --- The report -----------------------------------------------------------------------------------

test("orphan paths name idea files and ADRs, which /ship never commits", () => {
  const dirty = [
    ".ai/board/ideas/2026-09-20-a-thing.md",
    ".ai/registry/decisions/ADR-040-something.md",
    "src/routes/Year.tsx",
    ".ai/board/tickets/CAL-11/01-plan.md",
  ];
  assert.deepEqual(orphanPaths(dirty), [
    ".ai/board/ideas/2026-09-20-a-thing.md",
    ".ai/registry/decisions/ADR-040-something.md",
  ]);
});

test("the report always names the registry rows awaiting approval", () => {
  const md = renderReport("run-1", {
    finishedAt: "2026-09-20T12:00:00Z", input: "a thing", resolvedAs: "free text",
    ticketId: "CAL-11", finalState: "REVIEW", verdict: "PROMOTE", verdictReason: "worth it",
    qa: [{ question: "Who approves?", answer: "an admin" }],
    registryWrites: [".ai/registry/features.md — the row for CAL-11"],
    orphanPaths: [".ai/board/ideas/x.md"], steps: 6, cost: 1.5,
  });
  assert.match(md, /RULE-01/, "the report must say the rows await approval at the PR");
  assert.match(md, /features\.md — the row for CAL-11/);
  assert.match(md, /Who approves\?/);
  assert.match(md, /an admin/);
  assert.match(md, /MD-031/, "the orphan section must cite the case where this already happened");
  assert.match(md, /\$1\.5000/);
});

test("an unanswered intake question is reported as not decided, never as agreement", () => {
  const md = renderReport("run-1", {
    finishedAt: "x", qa: [{ question: "Who approves?", answer: "" }], registryWrites: [],
  });
  assert.match(md, /_\(not decided\)_/);
});

// --- tracker.yaml ---------------------------------------------------------------------------------

test("an empty allowed_list_ids is read as blocked, not as unrestricted (RULE-18)", () => {
  const y = parseTrackerYaml('provider: ""\nallowed_list_ids: []\nrules:\n  id_only: true\n');
  assert.deepEqual(y.allowed_list_ids, []);
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "tracker-"));
  const f = path.join(d, "tracker.yaml");
  fs.writeFileSync(f, 'provider: ""\nallowed_list_ids: []\n');
  assert.equal(trackerConfigured(f), false);
  fs.writeFileSync(f, 'provider: "clickup"\nallowed_list_ids: [901234]\n');
  assert.equal(trackerConfigured(f), true);
});

test("this repository's tracker is unconfigured, which is the intended shipping state", () => {
  assert.equal(trackerConfigured(), false,
    "if a tracker has been configured, the tracker entry path needs building and testing");
});

// --- The prompts ----------------------------------------------------------------------------------

test("both prompts quote the request and mark it as data, never as instruction", () => {
  const req = "add a dark mode toggle";
  for (const p of [intakePrompt(req), triagePrompt(req, [], "2026-09-20T00:00:00Z")]) {
    assert.ok(p.includes(req), "the request must appear verbatim");
    assert.match(p, /<<<REQUEST/, "it must be fenced");
    assert.match(p, /third-party data rather than an instruction/, "RULE-17 applies to any request");
  }
});

test("the triage prompt forbids rejecting on shape and supplies the clock", () => {
  const p = triagePrompt("add a toggle", [], "2026-09-20T00:00:00Z");
  assert.match(p, /Do not REJECT it for being shaped like a solution/);
  assert.match(p, /operator_request/);
  assert.match(p, /verbatim/);
  assert.match(p, /2026-09-20T00:00:00Z/, "product has no Bash tool and cannot measure a timestamp");
});

test("the intake bar is what it blocks, not what it would change", () => {
  // The cap truncates; the bar filters. Lowering the cap alone turns the question it removes into
  // a silent assumption, which is strictly worse than asking it. Raised 2026-09-22.
  const p = intakePrompt("x", 4);
  assert.match(p, /cannot be written without it/, "the bar must be blocking, not merely relevant");
  assert.match(p, /Ask only if all four fail/, "the four self-answer steps are the filter");
  assert.match(p, /at most 4 questions/, "the cap must be the one the caller passed");
  assert.match(p, /layout of a screen/, "a layout question is the Tech Lead's by the carve-out");
  assert.match(p, /Write no file in this turn/);
  assert.equal(JSON.parse(INTAKE_SCHEMA).properties.questions.maxItems, MAX_INTAKE_QUESTIONS);
});

test("the cap is a parameter, so a run can ask for fewer", () => {
  assert.match(intakePrompt("x", 1), /at most 1 questions/);
  assert.match(intakePrompt("x"), new RegExp("at most " + MAX_INTAKE_QUESTIONS + " questions"));
});

test("intake answers reach the triage prompt verbatim", () => {
  const qa = [{ question: "Who approves?", answer: "an admin, and only for their own team" }];
  const p = triagePrompt("x", qa, "t");
  assert.ok(p.includes("an admin, and only for their own team"));
});

// --- Config that the operator set, and that code must not quietly differ from -----------------------

test("the shipped configuration is the conservative one", () => {
  assert.equal(ON_SPLIT, "stop", "a split must not start children until stacking is decided");
  assert.equal(ON_OPEN_QUESTIONS_AFTER_PLAN, "stop");
  assert.equal(MAX_INTAKE_QUESTIONS, 4, "lowered 2026-09-22; the bar in prompts.mjs is the real lever");
});

test("the ideas directory the resolver guards is the real one", () => {
  assert.equal(IDEAS_DIR, path.join(ROOT, ".ai", "board", "ideas"));
});

// --- Preflight: the tree, WIP, and what a PROMOTE may carry onto its branch -------------------------
//
// Three defects found by run 20260922-142836-510fe05c, which stopped a fresh PROMOTE (CAL-11) on
// its own output. The porcelain fixture below is that repository's real `git status --porcelain=v1
// -z --untracked-files=all`, captured 2026-09-22, not a string written to agree with the parser.

const REAL_PORCELAIN_Z = [
  " M .ai/board/backlog.md",
  " M .ai/registry/features.md",
  " M .ai/steward/context.md",
  " M .ai/templates/idea.md",
  " M .claude/commands/idea.md",
  " M .claude/commands/triage.md",
  " M CLAUDE.md",
  " M scripts/check-docs.mjs",
  " M scripts/lib/entry.mjs",
  " M scripts/lib/prompts.mjs",
  " M scripts/run-loop.mjs",
  " M scripts/tests/check-docs.test.mjs",
  " M scripts/tests/entry.test.mjs",
  " M scripts/tests/run-loop.test.mjs",
  "?? .ai/board/ideas/2026-09-22-an-admin-manages-every-team-and-sees-only-one-calendar.md",
  "?? .ai/board/tickets/CAL-11/ticket.yaml",
  "?? .ai/board/tickets/CAL-12/ticket.yaml",
  "?? .ai/registry/decisions/ADR-038-the-asking-moves-out-of-the-loop.md",
  "?? .ai/registry/decisions/ADR-039-every-admin-manages-every-team.md",
  "?? .ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md",
].join("\0") + "\0";

test("porcelain: the first path keeps its first character when its status column is a space", () => {
  const paths = parsePorcelainZ(REAL_PORCELAIN_Z);
  assert.equal(paths[0], ".ai/board/backlog.md");
  assert.equal(paths.length, 20);
  assert.ok(paths.every((p) => !/^\s|\s$/.test(p) && !p.startsWith('"')));
});

test("porcelain: a rename yields both paths, and spaces and arrows in names survive", () => {
  const out = "R  new name.md\0old -> name.md\0 M src/a b.ts\0";
  assert.deepEqual(parsePorcelainZ(out), ["new name.md", "old -> name.md", "src/a b.ts"]);
  assert.deepEqual(parsePorcelainZ(""), []);
});

test("the runner reads the tree with -z and never through the trimming git() helper", () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts", "run-loop.mjs"), "utf8");
  assert.ok(!/git\(\s*["']status["']/.test(src), "git('status', ...) goes through .trim()");
  assert.ok(src.includes('"--porcelain=v1", "-z", "--untracked-files=all"'));
});

test("WIP counts tickets in flight: a BACKLOG sibling does not block, a REWORK one does", () => {
  const board = [
    { id: "CAL-11", state: "BACKLOG" }, { id: "CAL-12", state: "BACKLOG" },
    { id: "CAL-10", state: "DONE" }, { id: "X-01", state: "TRIAGE" },
  ];
  assert.deepEqual(wipBlockers(board, "CAL-11"), []);
  for (const s of ["PLAN", "READY", "IN_PROGRESS", "REVIEW", "REWORK", "ESCALATED", "UNPARSEABLE"]) {
    assert.equal(wipBlockers([...board, { id: "Y-01", state: s }], "CAL-11").length, 1, s);
  }
  assert.deepEqual(IN_FLIGHT_STATES.filter((s) => ["TRIAGE", "BACKLOG", "DONE"].includes(s)), []);
});

test("the ship-owned set here is the one check-allowed-paths exempts (ADR-023)", () => {
  const src = fs.readFileSync(path.join(ROOT, "scripts", "check-allowed-paths.mjs"), "utf8");
  const m = /const SHIP_OWNED = (\[[^\]]*\])/.exec(src);
  assert.ok(m, "SHIP_OWNED not found in check-allowed-paths.mjs");
  assert.deepEqual(JSON.parse(m[1]), SHIP_OWNED);
});

const IDEA = ".ai/board/ideas/2026-09-22-an-admin-manages-every-team-and-sees-only-one-calendar.md";
const realFiles = [IDEA, ".ai/board/tickets/CAL-11/ticket.yaml", ".ai/board/tickets/CAL-12/ticket.yaml"];
const haveReal = realFiles.every((f) => fs.existsSync(path.join(ROOT, f)));

test("real PROMOTE: CAL-11's triage output is carried, the chore work and ADR-038 are not",
  { skip: haveReal ? false : "the CAL-11 / CAL-12 triage files are no longer on disk" }, () => {
  const read = (f) => fs.readFileSync(path.join(ROOT, f), "utf8");
  const ctx = {
    id: "CAL-11", allowedPaths: [], inAllowedPaths: () => false,
    ticketText: read(".ai/board/tickets/CAL-11/ticket.yaml"),
    ideas: [{ path: IDEA, fm: readFrontMatter(path.join(ROOT, IDEA)) }],
    siblings: [{ id: "CAL-12", state: "BACKLOG", ticketText: read(".ai/board/tickets/CAL-12/ticket.yaml") }],
  };
  const { carried, stray } = planCarry(parsePorcelainZ(REAL_PORCELAIN_Z), ctx);
  assert.deepEqual(carried.map((c) => c.path).sort(), [
    ".ai/board/backlog.md",
    IDEA,
    ".ai/board/tickets/CAL-11/ticket.yaml",
    ".ai/board/tickets/CAL-12/ticket.yaml",
    ".ai/registry/decisions/ADR-039-every-admin-manages-every-team.md",
    ".ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md",
    ".ai/registry/features.md",
  ].sort());
  assert.ok(stray.includes(".ai/registry/decisions/ADR-038-the-asking-moves-out-of-the-loop.md"));
  assert.ok(stray.includes("scripts/run-loop.mjs") && stray.includes("CLAUDE.md"));
  assert.equal(stray.length, 13);

  // The same files, seen from CAL-12 once CAL-11 has shipped: CAL-12 cites the idea by path.
  const later = planCarry([IDEA, ".ai/board/tickets/CAL-12/ticket.yaml",
    ".ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md"],
    { ...ctx, id: "CAL-12", ticketText: ctx.siblings[0].ticketText, siblings: [] });
  assert.deepEqual(later.stray, []);
});

test("a sibling that has started, or cites another idea, or an unrelated idea, is stray", () => {
  const idea = ".ai/board/ideas/2026-01-01-x.md";
  const base = {
    id: "A-01", allowedPaths: ["src/a/**"], inAllowedPaths: (p, g) => g.length > 0 && p.startsWith("src/a/"),
    ticketText: "Provenance: " + idea + " — rests on ADR-050",
    ideas: [{ path: idea, fm: { ticket_id: "A-01" } },
            { path: ".ai/board/ideas/2026-01-02-other.md", fm: { ticket_id: "Z-09" } }],
    siblings: [{ id: "A-02", state: "BACKLOG", ticketText: "Provenance: " + idea },
               { id: "A-03", state: "PLAN", ticketText: "Provenance: " + idea },
               { id: "A-04", state: "BACKLOG", ticketText: "Provenance: elsewhere" }],
  };
  const dirty = [
    "src/a/x.ts", ".ai/board/metrics.md", idea, ".ai/board/ideas/2026-01-02-other.md",
    ".ai/registry/decisions/ADR-050-y.md", ".ai/registry/decisions/ADR-051-z.md",
    ".ai/board/tickets/A-02/ticket.yaml",
    ".ai/board/tickets/A-03/ticket.yaml",
    ".ai/board/tickets/A-04/ticket.yaml",
    ".ai/board/tickets/A-05/ticket.yaml",
    ".ai/standards/git-conventions.md",
  ];
  const { stray } = planCarry(dirty, base);
  assert.deepEqual(stray, [
    ".ai/board/ideas/2026-01-02-other.md", ".ai/registry/decisions/ADR-051-z.md",
    ".ai/board/tickets/A-03/ticket.yaml", ".ai/board/tickets/A-04/ticket.yaml",
    ".ai/board/tickets/A-05/ticket.yaml", ".ai/standards/git-conventions.md",
  ]);
  // A sibling at BACKLOG that already holds a plan was demoted from PLAN, not freshly promoted.
  const demoted = planCarry([...dirty, ".ai/board/tickets/A-02/01-plan.md"], base).stray;
  assert.ok(demoted.includes(".ai/board/tickets/A-02/ticket.yaml"));
});

test("ADR-047: glossary.md is stray until PLAN lists it, then carried as allowed_paths — no exemption", () => {
  // MD-041, observed: `/triage` wrote four EVT rows to glossary.md and `check-carry EVT-01` called it
  // stray and on no ref. ADR-047 moved the write to PLAN, after the path is in `allowed_paths`. The
  // carrier is the `allowed_paths` branch that already existed; SHIP_OWNED must not have grown.
  const GLOSSARY = ".ai/registry/glossary.md";
  assert.ok(fs.existsSync(path.join(ROOT, GLOSSARY)), "the real glossary moved; this test targets it");
  assert.ok(!SHIP_OWNED.includes(GLOSSARY), "ADR-047 chose (b): glossary.md is not ship-owned");

  // The real template carries the field, and the reader the runner uses parses both shapes.
  const tpl = parseSimpleYaml(fs.readFileSync(path.join(ROOT, ".ai", "templates", "ticket.yaml"), "utf8"));
  assert.deepEqual(tpl.glossary_owed, []);
  const owed = parseSimpleYaml("id: EVT-01\nglossary_owed: [Event, Attendee, Invitation, Capacity]\n");
  assert.deepEqual(owed.glossary_owed, ["Event", "Attendee", "Invitation", "Capacity"]);

  const ctx = { id: "EVT-01", ticketText: "", ideas: [], siblings: [], inAllowedPaths };
  const dirty = [GLOSSARY, ".ai/board/tickets/EVT-01/ticket.yaml"];
  // Before PLAN: allowed_paths is empty, so a triage-written row is stray — /plan step 0 stops on it.
  assert.deepEqual(planCarry(dirty, { ...ctx, allowedPaths: [] }).stray, [GLOSSARY]);
  // After PLAN listed it: carried, and carried *because* of allowed_paths, not a named exemption.
  const after = planCarry(dirty, { ...ctx, allowedPaths: ["src/lib/**", GLOSSARY] });
  assert.deepEqual(after.stray, []);
  assert.equal(after.carried.find((c) => c.path === GLOSSARY)?.why, "allowed_paths");
});

/** An ideas directory with nothing in it, so step 4b never matches and step 5 is what answers. */
const emptyIdeas = fs.mkdtempSync(path.join(os.tmpdir(), "no-ideas-"));

test("a near miss at a ticket id is an error, never a new idea", () => {
  // The case that got through: `CAL-11ư`, one stray Vietnamese character. `TICKET_ID` is ASCII-only
  // so step 5's guard did not fire, and the string reached step 7 as free text — which under
  // `auto` means an intake, a PROMOTE, a feature row and a ticket, from a typo. The header of the
  // resolution section forbids exactly this, and the guard was narrower than the mistake.
  const exists = (id) => id === "CAL-11";
  for (const bad of ["CAL-11ư", "cal-11", "CAL-11x", "CAL-99", "ADR-040"]) {
    const r = resolveInput(bad, {}, { ticketFileExists: exists, ideasDir: emptyIdeas });
    assert.ok(r.error, `${bad} should be an error, got ${JSON.stringify(r)}`);
    assert.equal(r.kind, undefined);
  }
});

test("the near-miss guard does not swallow a real ticket, or real free text", () => {
  const exists = (id) => id === "CAL-11";
  const deps = { ticketFileExists: exists, ideasDir: emptyIdeas };

  // A ticket that exists still wins — step 4 is above the guard.
  assert.equal(resolveInput("CAL-11", {}, deps).kind, "ticket");

  // Free text is untouched: a sentence, and a single token that is not letters-dash-digits.
  assert.equal(resolveInput("an admin picks a team", {}, deps).kind, "intake");
  assert.equal(resolveInput("many-teams", {}, deps).kind, "intake");

  // And the explicit flag always overrides, which is the documented escape from a false positive.
  assert.equal(resolveInput(null, { forced: { kind: "idea-text", value: "pto-2026" } }, deps).kind,
    "intake");
});

test("ADR-054: isOwnIdea reads a split ticket_id from the real idea file, and planCarry agrees", () => {
  // The real file: EVT-04 and EVT-05 were both promoted from it, and its front-matter says so in one
  // string. Before ADR-054 that string was compared whole, matched neither ticket, and the idea was
  // stray for both whenever it was dirty. Read through the same reader `carryContext` uses.
  const IDEA = ".ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md";
  const fm = readFrontMatter(path.join(ROOT, IDEA));
  assert.deepEqual(ideaTicketIds(fm), ["EVT-04", "EVT-05"]);
  for (const id of ["EVT-04", "EVT-05"]) assert.ok(isOwnIdea({ path: IDEA, fm }, id, ""), id);
  assert.ok(!isOwnIdea({ path: IDEA, fm }, "EVT-0", ""), "a prefix of an ID is not the ID");
  assert.ok(!isOwnIdea({ path: IDEA, fm }, "EVT-06", ""));
  assert.ok(isOwnIdea({ path: IDEA, fm: {} }, "EVT-06", `# from ${IDEA}`), "cited by ticket.yaml");

  assert.deepEqual(ideaTicketIds({ ticket_id: ["A-01", "A-02"] }), ["A-01", "A-02"]);
  assert.deepEqual(ideaTicketIds({ ticket_id: "" }), []);
  assert.deepEqual(ideaTicketIds({}), []);

  const ctx = { id: "EVT-05", allowedPaths: [], ticketText: "", ideas: [{ path: IDEA, fm }],
                siblings: [], inAllowedPaths };
  const { carried, stray } = planCarry([IDEA], ctx);
  assert.deepEqual(stray, []);
  assert.equal(carried[0]?.why, "the idea that promoted it");
});
