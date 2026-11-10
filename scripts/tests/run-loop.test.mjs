// scripts/run-loop.mjs — the unattended loop runner (ADR-036).
//
// **What these tests are for.** The runner's whole claim is that routing is deterministic code and
// never a model call, so the routing is the thing that has to be tested. Spawning `claude` is not:
// `invoke` and `git` are deliberately not exported, because a test that can call them is a test
// that can start a paid session by accident.
//
// Two of these assertions exist because of a specific defect rather than for coverage:
//   - `invariant_violation` stops the run *before* the router is consulted. RULE-07 escalates on
//     first occurrence and never enters REWORK. Until ADR-036 the review verdict named a check
//     number, the number disagreed across four files, and the number that meant "invariant" in the
//     template was the number the routing table sent to `developer` with the counter incrementing.
//   - `tech-lead-review` gets a new session id every time, under every entry path. RULE-13 is the
//     only independent check the loop has, and a resumed reviewer is the first pass agreeing with
//     itself.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  nextStep, advanceSimulated, sessionFor, reviewStop, questionStop, budgetStop,
  inAllowedPaths, validateEntry, buildArgv, parseArgv, SESSION_POLICY, TICKET_ID,
  readQuestions, pickNext, checksVerdict, progressKey,
} from "../run-loop.mjs";
import { intakePrompt } from "../lib/prompts.mjs";

const SCRIPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "run-loop.mjs");

const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "run-loop-"));

const ticket = (over = {}) => ({
  id: "TST-01", state: "BACKLOG", feature_ids: ["TST-01"], depends_on: [],
  allowed_paths: [], rework_count: 0, gates: { plan: {}, review: {} }, ...over,
});

const writeReview = (dir, fm) => {
  const body = Object.entries(fm).map(([k, v]) =>
    `${k}: ${Array.isArray(v) ? `[${v.join(", ")}]` : v}`).join("\n");
  fs.writeFileSync(path.join(dir, "04-review.md"), `---\n${body}\n---\n\n# Review\n`);
};

// --- Routing ------------------------------------------------------------------------------------

test("each entry state starts at the right stage, with the right agent", () => {
  const dir = tmp();
  assert.deepEqual(
    nextStep(ticket({ state: "BACKLOG" }), dir),
    { command: "/plan", agent: "tech-lead-design", then: "/advance" });
  assert.deepEqual(
    nextStep(ticket({ state: "READY" }), dir),
    { command: "/implement", agent: "developer", then: "/advance" });
  assert.deepEqual(
    nextStep(ticket({ state: "REVIEW" }), dir),
    { command: "/review", agent: "tech-lead-review", then: "/advance" });
});

test("a REVIEW whose review gate already passed goes to /ship, not round again", () => {
  const t = ticket({ state: "REVIEW", gates: { review: { passed: true } } });
  assert.deepEqual(nextStep(t, tmp()), { command: "/ship", agent: "orchestrator" });
});

test("REWORK routes on route_to, never on a check number", () => {
  const a = tmp();
  writeReview(a, { gate: "FAIL", verdict: "FAIL", route_to: "developer", invariant_violation: false });
  assert.equal(nextStep(ticket({ state: "REWORK" }), a).agent, "developer");

  const b = tmp();
  writeReview(b, { gate: "FAIL", verdict: "FAIL", route_to: "tech-lead-design", invariant_violation: false });
  assert.equal(nextStep(ticket({ state: "REWORK" }), b).agent, "tech-lead-design");
});

test("IN_PROGRESS re-runs /implement unless 03-impl-log.md is at PASS (MIR-08, 2026-10-23)", () => {
  const implLog = (dir, gate) =>
    fs.writeFileSync(path.join(dir, "03-impl-log.md"), `---\nstage: IN_PROGRESS\ngate: ${gate}\n---\n\n# Log\n`);
  const pass = tmp(); implLog(pass, "PASS");
  assert.deepEqual(nextStep(ticket({ state: "IN_PROGRESS" }), pass), { command: "/advance", agent: "orchestrator" });
  const blocked = tmp(); implLog(blocked, "BLOCKED");
  assert.deepEqual(nextStep(ticket({ state: "IN_PROGRESS" }), blocked),
    { command: "/implement", agent: "developer", then: "/advance" },
    "a BLOCKED implementation used to be re-recorded by /advance and never re-run");
  assert.equal(nextStep(ticket({ state: "IN_PROGRESS" }), tmp()).command, "/implement", "no log yet");
});

test("REWORK with no review artifact stops rather than guessing a route", () => {
  const step = nextStep(ticket({ state: "REWORK" }), tmp());
  assert.match(step.stop, /no 04-review\.md/);
});

test("the dry-run walk reaches /ship from every entry state", () => {
  const dir = tmp();
  for (const start of ["BACKLOG", "READY", "REVIEW"]) {
    let t = ticket({ state: start });
    const seen = [];
    for (let i = 0; i < 8 && t; i++) {
      const step = nextStep(t, dir);
      assert.ok(!step.stop, `unexpected stop from ${start}: ${step.stop}`);
      seen.push(step.command);
      t = advanceSimulated(t);
    }
    assert.equal(seen.at(-1), "/ship", `sequence from ${start} did not end at /ship: ${seen.join(" ")}`);
  }
});

// --- RULE-07: an invariant violation must never reach the developer ------------------------------

test("invariant_violation stops the run before the router is consulted", () => {
  const dir = tmp();
  writeReview(dir, {
    gate: "FAIL", verdict: "FAIL", invariant_violation: true,
    route_to: "human", increments_rework: false, blocking_reason: "INV-03 not held",
  });
  const t = ticket({ state: "REWORK" });

  const stop = reviewStop(t, dir);
  assert.ok(stop, "reviewStop must halt on an invariant violation");
  assert.match(stop, /RULE-07/);
  assert.match(stop, /INV-03/);
});

test("route_to: human and a BLOCKED verdict both stop", () => {
  const a = tmp();
  writeReview(a, { gate: "FAIL", verdict: "FAIL", invariant_violation: false, route_to: "human" });
  assert.match(reviewStop(ticket(), a), /routed to a human/);

  const b = tmp();
  writeReview(b, { gate: "BLOCKED", verdict: "BLOCKED", invariant_violation: false, route_to: "none" });
  assert.match(reviewStop(ticket(), b), /BLOCKED/);
});

test("a stale BLOCKED review does not stop a ticket a person moved back to REVIEW (MIR-08)", () => {
  const dir = tmp();
  writeReview(dir, { gate: "BLOCKED", verdict: "BLOCKED", invariant_violation: false, route_to: "human" });
  const back = ticket({ state: "REVIEW", gates: { plan: { passed: true }, review: { passed: false } } });
  assert.equal(reviewStop(back, dir), null, "/review is about to overwrite this file");
  assert.equal(nextStep(back, dir).command, "/review");

  const inv = tmp();
  writeReview(inv, { gate: "FAIL", verdict: "FAIL", invariant_violation: true, route_to: "human", blocking_reason: "INV-01" });
  assert.match(reviewStop(back, inv), /RULE-07/, "an invariant violation stops in every state");
});

test("a verdict that disagrees with its own gate voids the artifact", () => {
  const dir = tmp();
  writeReview(dir, { gate: "PASS", verdict: "FAIL", invariant_violation: false, route_to: "none" });
  assert.match(reviewStop(ticket(), dir), /void/);
});

test("a clean PASS does not stop the run", () => {
  const dir = tmp();
  writeReview(dir, { gate: "PASS", verdict: "PASS", invariant_violation: false, route_to: "none" });
  assert.equal(reviewStop(ticket(), dir), null);
});

// --- The other stop conditions -------------------------------------------------------------------

test("a question addressed to a person halts the run", () => {
  const dir = tmp();
  fs.writeFileSync(path.join(dir, "99-questions.md"), "---\nto: operator\nasked_at: x\n---\n");
  assert.match(questionStop(ticket(), dir), /operator/);

  const other = tmp();
  fs.writeFileSync(path.join(other, "99-questions.md"), "---\nto: tech-lead-design\nasked_at: x\n---\n");
  assert.equal(questionStop(ticket(), other), null);
});

test("an exhausted chat budget halts the run (RULE-15)", () => {
  const t = ticket({ chat_budget: { "developer->tech-lead-design": { used: 6, max: 6 } } });
  assert.match(budgetStop(t), /chat budget exhausted/);
  const ok = ticket({ chat_budget: { "developer->tech-lead-design": { used: 2, max: 6 } } });
  assert.equal(budgetStop(ok), null);
});

// --- RULE-13: the reviewer never resumes ---------------------------------------------------------

test("a second review of the same ticket uses a different session id", () => {
  const store = {};
  const first = sessionFor("tech-lead-review", "TST-01", store);
  const second = sessionFor("tech-lead-review", "TST-01", store);
  assert.notEqual(first.sessionId, second.sessionId);
  assert.equal(first.mode, "new");
  assert.equal(second.mode, "new", "a reviewer must never resume — RULE-13");
});

test("the developer resumes across REWORK and is discarded per ticket", () => {
  const store = {};
  const first = sessionFor("developer", "TST-01", store);
  const second = sessionFor("developer", "TST-01", store);
  assert.equal(first.sessionId, second.sessionId);
  assert.equal(second.mode, "resume");

  const otherTicket = sessionFor("developer", "TST-02", store);
  assert.notEqual(otherTicket.sessionId, first.sessionId);
});

test("orchestrator and tech-lead-design persist across tickets", () => {
  const store = {};
  for (const agent of ["orchestrator", "tech-lead-design"]) {
    const a = sessionFor(agent, "TST-01", store);
    const b = sessionFor(agent, "TST-02", store);
    assert.equal(a.sessionId, b.sessionId, `${agent} must be one persistent session`);
    assert.equal(b.mode, "resume");
  }
});

test("every agent the router can name has a session policy", () => {
  for (const agent of ["tech-lead-design", "developer", "tech-lead-review", "orchestrator"]) {
    assert.ok(SESSION_POLICY[agent], `${agent} has no session policy`);
  }
  assert.equal(SESSION_POLICY["tech-lead-review"], "always-fresh");
});

// --- Invocation shape ----------------------------------------------------------------------------

test("the argv never drops the project's hooks, commands or agents", () => {
  const argv = buildArgv("/review TST-01", "tech-lead-review", { sessionId: "u", mode: "new" });
  assert.ok(!argv.includes("--bare"), "--bare skips hooks and CLAUDE.md and must never be passed");
  assert.deepEqual(argv.slice(argv.indexOf("--setting-sources"), argv.indexOf("--setting-sources") + 2),
                   ["--setting-sources", "user,project,local"]);
  assert.ok(argv.includes("--agent") && argv.includes("tech-lead-review"));
  assert.ok(argv.includes("--session-id"), "a new session is created with --session-id");
  assert.ok(!argv.includes("--resume"));
});

test("a stage that writes runs under acceptEdits, or every stage is denied", () => {
  // .claude/settings.json has no Write or Edit rule at all — the allow list is Bash verbs and MCP
  // tools. Under `dontAsk` with `--permission-prompts none`, that denies every file write by every
  // stage. It did: the first live TRIAGE was refused writing its own idea file.
  const argv = buildArgv("/plan TST-01", "tech-lead-design", { sessionId: "u", mode: "new" });
  const mode = argv[argv.indexOf("--permission-mode") + 1];
  assert.equal(mode, "acceptEdits", "every loop stage writes an artifact; dontAsk denies all of them");

  // And the other half of the pair must stay, or Bash stops being bounded by the allow list.
  assert.equal(argv[argv.indexOf("--permission-prompts") + 1], "none");

  const settings = JSON.parse(fs.readFileSync(path.join(path.dirname(SCRIPT), "..", ".claude", "settings.json"), "utf8"));
  assert.ok(settings.permissions.deny.some((r) => /gh pr merge/.test(r)),
    "accepting edits must not have loosened the one write PERMISSIONS.md defends");
});

test("a resumed session uses --resume and never --session-id", () => {
  const argv = buildArgv("/implement TST-01", "developer", { sessionId: "u", mode: "resume" });
  assert.ok(argv.includes("--resume"));
  assert.ok(!argv.includes("--session-id"));
});

// --- Reading the intake result ------------------------------------------------------------------------
//
// These exist because of one real run, not a hypothetical. The first live intake cost $1.19 and
// returned four well-cited questions — in Vietnamese, ending with the four-line sign-off block from
// CLAUDE.md. The runner threw all of it away because it was not JSON.
//
// That is the wrong trade every time. The money is spent when the process exits; the only question
// left is whether the content survives. `product` was not disobeying: "the sign-off IS the reply" is
// in CLAUDE.md and repeated in its own agent file, and `--json-schema` is a flag. The flag lost.

const QUESTIONS = { questions: [{ question: "Who approves?", why_it_changes_the_work: "the policy" }] };

test("raw JSON is read", () => {
  const r = readQuestions(JSON.stringify(QUESTIONS));
  assert.equal(r.questions.length, 1);
  assert.equal(r.questions[0].question, "Who approves?");
});

test("an object rather than a string is read", () => {
  assert.equal(readQuestions(QUESTIONS).questions.length, 1);
});

test("a fenced JSON block is read", () => {
  const raw = "Here you go:\n\n```json\n" + JSON.stringify(QUESTIONS) + "\n```\n";
  assert.equal(readQuestions(raw).questions.length, 1);
});

test("a bare object buried in prose is read", () => {
  const raw = "Some preamble.\n" + JSON.stringify(QUESTIONS) + "\nSome trailing prose.";
  assert.equal(readQuestions(raw).questions.length, 1);
});

test("prose is kept as prose rather than discarded", () => {
  const raw = "**1. Các team khác lấy từ đâu ra?**\n- *Vì sao làm khác đi:* nếu cần màn hình quản lý team...";
  const r = readQuestions(raw);
  assert.equal(r.questions, null);
  assert.ok(r.prose.includes("Các team khác"), "the content must survive a shape it did not expect");
});

test("the sign-off block is stripped from prose, because it is conversation not content", () => {
  const raw = [
    "**1. Ai được duyệt?**",
    "",
    "---",
    "**Tôi là `product`.** Vừa đọc yêu cầu — không có ticket, gate n/a.",
    "**Xong lúc:** unavailable — no Bash tool",
  ].join("\n");
  const r = readQuestions(raw);
  assert.ok(r.prose.includes("Ai được duyệt"));
  assert.ok(!r.prose.includes("Tôi là"), "the sign-off is noise in a stored answer");
});

test("an empty result yields neither questions nor prose", () => {
  for (const empty of ["", "   ", null, undefined]) {
    const r = readQuestions(empty);
    assert.equal(r.questions, null);
    assert.ok(!r.prose, `${JSON.stringify(empty)} should yield no prose`);
  }
});


// --- The class of defect, not the instance --------------------------------------------------------
//
// The intake failure was one symptom of two general hazards. These two tests are aimed at the
// hazards, because fixing the symptom fixes nothing for the next prompt anyone writes.

test("every machine-read prompt invokes the CLAUDE.md carve-out", () => {
  // A prompt paired with --json-schema is asking a program-shaped question. Without the preamble the
  // agent follows CLAUDE.md § Replying instead, which is what it is told to do everywhere else.
  const src = fs.readFileSync(path.join(path.dirname(SCRIPT), "lib", "prompts.mjs"), "utf8");

  assert.match(src, /export const MACHINE_CALLER/, "the shared preamble must exist");
  assert.ok(intakePrompt("x").includes("Your caller is a program"),
    "intakePrompt is paired with INTAKE_SCHEMA and must carry the preamble");

  // And the carve-out it invokes has to be in CLAUDE.md, or the preamble cites nothing.
  const claudeMd = fs.readFileSync(path.join(path.dirname(SCRIPT), "..", "CLAUDE.md"), "utf8");
  assert.match(claudeMd, /When the caller is a program/,
    "CLAUDE.md must carry the carve-out; otherwise every prompt fights the standing instruction");
});

test("every read of model reply text is tagged, and none of them routes", () => {
  // The runner routes on ticket.yaml and artifact front-matter, never on what an agent said. This
  // test does not prove that; it makes adding a fourth reader a deliberate act, the way
  // DELIBERATELY_UNWIRED does for hooks. Tag it and say why it is safe, or this fails.
  const lines = fs.readFileSync(SCRIPT, "utf8").split("\n");
  const reads = [];
  lines.forEach((line, i) => {
    if (/\bout\.result\.result\b|\br\.result\b/.test(line)) reads.push(i);
  });

  assert.ok(reads.length > 0, "if nothing reads reply text this test has stopped measuring anything");
  for (const i of reads) {
    const above = lines.slice(Math.max(0, i - 3), i).join(" ");
    assert.match(above, /REPLY-TEXT:/,
      `run-loop.mjs:${i + 1} reads model reply text without a REPLY-TEXT: tag saying why that is ` +
      "safe. Routing must come from ticket.yaml or artifact front-matter (ADR-036).");
  }
});

// --- Spawning ---------------------------------------------------------------------------------------

test("no argument the runner passes survives a shell intact, so no shell is used", () => {
  // This test exists because of a real failure, not a hypothetical one. On Windows `claude` on PATH
  // is a .cmd shim, so the first version spawned with shell: true. The shell then split
  // `--setting-sources user,project,local` into three words, and the CLI reported "Invalid setting
  // source: user project local" — which reads as a CLI bug rather than a quoting one.
  const argv = buildArgv("/review TST-01", "tech-lead-review", { sessionId: "u", mode: "new" });
  const risky = argv.filter((a) => /[,s"&|<>^()]/.test(a));
  assert.ok(risky.length > 0, "if nothing is shell-sensitive this test has stopped measuring anything");

  const src = fs.readFileSync(SCRIPT, "utf8");
  assert.match(src, /shell: false/, "the runner must spawn without a shell");
  assert.ok(!/shell: process.platform/.test(src), "shell must not be conditional on the platform");
});

test("the argv is a list, never a joined command line", () => {
  const argv = buildArgv("/plan TST-01", "tech-lead-design", { sessionId: "u", mode: "new" });
  assert.ok(Array.isArray(argv));
  assert.ok(argv.includes("user,project,local"),
    "the comma-separated value must be ONE argv element; a shell would split it");
});

// --- Entry validation ----------------------------------------------------------------------------

test("entry validation refuses the states a human owns", () => {
  assert.match(validateEntry(ticket({ state: "ESCALATED" })).join(" "), /a human decides/);
  assert.match(validateEntry(ticket({ state: "DONE" })).join(" "), /DONE/);
});

test("entry validation names the missing DoR item rather than filling it", () => {
  assert.match(validateEntry(ticket({ feature_ids: [] })).join(" "), /Definition of Ready item 1/);
});

// --- Globs and ids -------------------------------------------------------------------------------

test("allowed_paths globs match the way check-allowed-paths does", () => {
  assert.ok(inAllowedPaths("src/routes/Year.tsx", ["src/routes/**"]));
  assert.ok(inAllowedPaths("src/lib/data/absence.ts", ["src/lib/data/*.ts"]));
  assert.ok(!inAllowedPaths("src/lib/data/sub/x.ts", ["src/lib/data/*.ts"]));
  assert.ok(!inAllowedPaths("MODEL-OVERVIEW.md", ["src/**"]));
});

test("the ticket id pattern accepts real ids and rejects prose", () => {
  for (const id of ["CAL-10", "UIE-02", "OPS-002", "TEA-01", "CAL-10a"]) {
    assert.ok(TICKET_ID.test(id), `${id} should be a ticket id`);
  }
  for (const s of ["add a dark mode", "the year view is slow", "https://app.clickup.com/t/abc"]) {
    assert.ok(!TICKET_ID.test(s), `${s} must not be read as a ticket id`);
  }
});

// --- CLI ------------------------------------------------------------------------------------------

const runCli = (args) => {
  try {
    return { status: 0, out: execFileSync(process.execPath, [SCRIPT, ...args], { encoding: "utf8" }) };
  } catch (e) {
    return { status: e.status, out: `${e.stdout ?? ""}${e.stderr ?? ""}` };
  }
};

test("a non-existent ticket id errors and invokes nothing", () => {
  const r = runCli(["auto", "ZZZ-99", "--dry-run"]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /no ticket\.yaml/);
});

test("free text enters through intake and triage, and prints the whole sequence", () => {
  // Stage A refused this outright; ADR-037 installed the resolver. The assertion that free text is
  // never mistaken for a ticket now lives in entry.test.mjs, against the resolver itself.
  const r = runCli(["auto", "add a dark mode toggle", "--dry-run"]);
  assert.equal(r.status, 0, r.out);
  assert.match(r.out, /resolved as free text/);
  assert.match(r.out, /intake/);
  assert.match(r.out, /\/triage/);
  assert.match(r.out, /REJECT \| NEEDS-ADR -> stop/);
  assert.match(r.out, /\/ship/);
});

test("--until only accepts a real state", () => {
  const r = runCli(["auto", "CAL-10", "--until", "NOPE", "--dry-run"]);
  assert.notEqual(r.status, 0);
  assert.match(r.out, /is not a state/);
});

test("parseArgv defaults and flags", () => {
  const o = parseArgv(["auto", "CAL-10", "--dry-run", "--max-steps", "3"]);
  assert.equal(o.command, "auto");
  assert.equal(o.input, "CAL-10");
  assert.equal(o.dryRun, true);
  assert.equal(o.maxSteps, 3);
});

// --- No new dependencies (review check R8) ---------------------------------------------------------

test("the runner imports node built-ins and repository files only", () => {
  for (const f of [SCRIPT, path.join(path.dirname(SCRIPT), "lib", "ticket-yaml.mjs")]) {
    const src = fs.readFileSync(f, "utf8");
    for (const m of src.matchAll(/^import .*? from "([^"]+)";/gm)) {
      const spec = m[1];
      assert.ok(spec.startsWith("node:") || spec.startsWith("./") || spec.startsWith("../"),
        `${path.basename(f)} imports \`${spec}\` — a dependency needs an ADR (R8)`);
    }
  }
});

// --- ADR-067: chain, merge gate, denials --------------------------------------------------------

test("--chain takes the lowest-numbered same-group ticket whose depends_on are all DONE", () => {
  const tickets = [
    { id: "MIR-07", group: "MIR", state: "DONE", depends_on: [] },
    { id: "MIR-10", group: "MIR", state: "BACKLOG", depends_on: ["MIR-08", "MIR-09"] },
    { id: "MIR-09", group: "MIR", state: "BACKLOG", depends_on: ["MIR-07"] },
    { id: "MIR-08", group: "MIR", state: "DONE", depends_on: [] },
    { id: "CICD-08", group: "CICD", state: "BACKLOG", depends_on: [] },
    { id: "MIR-11", group: "MIR", state: "ESCALATED", depends_on: [] },
  ];
  assert.equal(pickNext(tickets, "MIR").id, "MIR-09");
  assert.equal(pickNext(tickets.filter((t) => t.id !== "MIR-09"), "MIR"), null,
    "MIR-10 waits on MIR-09, and an ESCALATED ticket is never picked");
  assert.equal(pickNext(tickets, undefined), null, "no group, no chain");
});

test("--chain orders by number, not by string: MIR-10 comes after MIR-9", () => {
  const tickets = [
    { id: "MIR-10", group: "MIR", state: "BACKLOG", depends_on: [] },
    { id: "MIR-9", group: "MIR", state: "BACKLOG", depends_on: [] },
  ];
  assert.equal(pickNext(tickets, "MIR").id, "MIR-9");
});

test("the merge gate reads check runs and status contexts, and an empty rollup is 'none'", () => {
  assert.equal(checksVerdict([]), "none");
  assert.equal(checksVerdict(undefined), "none");
  assert.equal(checksVerdict([{ status: "COMPLETED", conclusion: "SUCCESS" },
                              { status: "COMPLETED", conclusion: "SKIPPED" }]), "pass");
  assert.equal(checksVerdict([{ status: "IN_PROGRESS", conclusion: "" }]), "pending");
  assert.equal(checksVerdict([{ status: "COMPLETED", conclusion: "FAILURE" },
                              { status: "IN_PROGRESS" }]), "fail", "a failure is final even while others run");
  assert.equal(checksVerdict([{ __typename: "StatusContext", state: "SUCCESS" }]), "pass");
  assert.equal(checksVerdict([{ __typename: "StatusContext", state: "PENDING" }]), "pending");
  assert.equal(checksVerdict([{ __typename: "StatusContext", state: "ERROR" }]), "fail");
});

test("--chain and --no-merge parse, and refuse each other", () => {
  const o = parseArgv(["auto", "MIR-08", "--chain"]);
  assert.equal(o.chain, true);
  assert.equal(o.noMerge, false);
  assert.equal(parseArgv(["auto", "MIR-08", "--no-merge"]).noMerge, true);
  assert.throws(
    () => execFileSync(process.execPath, [SCRIPT, "auto", "MIR-08", "--chain", "--no-merge"],
                       { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }),
    (e) => e.status === 1 && /--chain needs the merge/.test(String(e.stderr)),
  );
});

test("a permission denial is a warning, not a failed step (ADR-067 decision 6)", () => {
  const src = fs.readFileSync(SCRIPT, "utf8");
  const body = /function stepFailure\(out\) \{([\s\S]*?)\n\}/.exec(src)?.[1] ?? "";
  assert.ok(body.length > 0, "stepFailure not found");
  assert.ok(!/permission_denials/.test(body), "stepFailure must not fail a step on a denial");
  assert.match(src, /report\.warnings\.push/, "denials are recorded in REPORT.md");
});

test("no agent merges: the deny rule stays, and only mergeTicket calls gh pr merge", () => {
  const settings = JSON.parse(fs.readFileSync(path.resolve(path.dirname(SCRIPT), "..", ".claude", "settings.json"), "utf8"));
  assert.ok(settings.permissions.deny.includes("Bash(gh pr merge:*)"));
  assert.ok(!settings.permissions.allow.some((r) => /gh pr merge/.test(r)));
  const src = fs.readFileSync(SCRIPT, "utf8");
  assert.equal((src.match(/gh\("pr", "merge"/g) ?? []).length, 1, "exactly one merge call site");
});

test("a passing review is progress although the state stays REVIEW (MIR-08, run 20261023-072747)", () => {
  const before = ticket({ state: "REVIEW", gates: { plan: { passed: true }, review: { passed: false } } });
  const after = ticket({ state: "REVIEW", gates: { plan: { passed: true }, review: { passed: true } } });
  assert.notEqual(progressKey(before), progressKey(after));
  assert.equal(progressKey(before), progressKey({ ...before }), "nothing recorded is still no progress");
  assert.notEqual(progressKey(before), progressKey({ ...before, rework_count: 1 }));
});

