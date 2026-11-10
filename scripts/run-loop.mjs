// run-loop.mjs — the unattended loop runner. ADR-036.
//
// **This replaces the human hands, and nothing else.** Today `/next-ticket` prints "Run /plan EXA-01
// in the tech-lead-design session" and a person reads it and runs it. This script reads the board,
// decides the same thing in deterministic code, and spawns the same command as its own top-level
// `claude` process.
//
// **Every stage is a separate process, and that is the whole point.** RULE-13 requires REVIEW to run
// with files only and no inherited context. A subagent dispatched from inside one session cannot
// deliver that — it inherits the parent's context, and the isolation becomes a matter of the agent's
// good behaviour rather than a property of how the process was started. A separate OS process with
// its own session id is a real boundary. The orchestrator still does not dispatch: it is one of the
// agents this script spawns, not the thing doing the spawning.
//
// **What this script never does:** commit, push, edit `ticket.yaml`, or write a stage artifact.
// `/advance` writes `ticket.yaml` and checkpoints (ADR-048); `/ship` commits and pushes.
// **It does merge, and only in `mergeTicket`** (ADR-067): after `/ship`, once `mergeGate` passes,
// with its own `gh` call. No agent merges, and `gh pr merge` stays denied to every agent session.
// The runner reads state and starts processes. If you find yourself adding an `fs.writeFileSync` to a path under `.ai/board/tickets/`,
// the design has been lost.
//
// Node built-ins only — no dependency may be added without an ADR (review check R8).

import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { readTicket, readFrontMatter, STATES, branchFor } from "./lib/ticket-yaml.mjs";
import {
  resolveInput, readVerdict, verdictStop, openQuestionsStop, sizeStop,
  orphanPaths, renderReport, IDEAS_DIR, MAX_INTAKE_QUESTIONS,
  awaitedAdrs, adrStatus, adrsSettled, needsAdrDecision,
  parsePorcelainZ, planCarry, wipBlockers, carryContext as buildCarryContext, inAllowedPaths,
} from "./lib/entry.mjs";
import { INTAKE_SCHEMA, intakePrompt, triagePrompt, triageFromFilePrompt, retriagePrompt } from "./lib/prompts.mjs";

// --- Config ------------------------------------------------------------------------------------

const ROOT = path.resolve(import.meta.dirname, "..");
const STATE_DIR = path.join(ROOT, ".runner");
const TICKETS_DIR = path.join(ROOT, ".ai", "board", "tickets");
const FEATURES = path.join(ROOT, ".ai", "registry", "features.md");

const MAX_STEPS_PER_TICKET = 12;

// A measured number, not a guess: one `/next-ticket` — a read-only board report that wrote nothing
// and spawned no subagent — cost $0.2434 on 2026-09-21. A ticket is up to twelve steps, and
// `/implement` and `/review` are not read-only. MAX_STEPS bounds how many times the runner asks;
// this bounds how much any one ask can spend, which is the axis MAX_STEPS does not cover.
//
// Generous on purpose. A cap that fires on ordinary work is a cap that gets raised without being
// read, and then it is not a cap.
const MAX_BUDGET_USD_PER_STEP = 10;
const MANUAL_STATES = ["ESCALATED"];
const TERMINAL_STATES = ["DONE"];
/**
 * Find a `claude` binary that can be spawned WITHOUT a shell.
 *
 * On Windows `claude` on PATH is `claude.cmd`, a shim. Spawning a .cmd needs a shell, and a shell
 * re-parses the command line — which is not a theoretical problem here. Two things it actually did
 * on this machine:
 *
 *   - `--setting-sources user,project,local` arrived at the CLI as `user project local`, because
 *     the shell split on the commas. The CLI's own error was "Invalid setting source".
 *   - a binary whose path contains a space ("D:\\Programs file\\node.exe") failed with
 *     "'D:\\Programs' is not recognized", because the shell re-split the path.
 *
 * Both are silent-ish: the first looks like a CLI bug, the second like a broken install. So the
 * runner spawns the real .exe directly and never lets a shell see its argv.
 */
function resolveClaudeBin() {
  if (process.env.CLAUDE_BIN) return process.env.CLAUDE_BIN;
  if (process.platform !== "win32") return "claude";

  const where = spawnSync("where", ["claude"], { encoding: "utf8" });
  for (const line of (where.stdout || "").split(/\r?\n/)) {
    const hit = line.trim();
    if (!hit) continue;
    if (hit.toLowerCase().endsWith(".exe")) return hit;
    // The .cmd shim sits beside the package that contains the real executable.
    const exe = path.join(path.dirname(hit), "node_modules", "@anthropic-ai", "claude-code", "bin", "claude.exe");
    if (fs.existsSync(exe)) return exe;
  }
  return "claude";
}

const CLAUDE_BIN = resolveClaudeBin();

// --- Small helpers -----------------------------------------------------------------------------

const log = (...a) => console.log(...a);
const iso = () => new Date().toISOString();

function git(...args) {
  const r = spawnSync("git", args, { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`git ${args.join(" ")} failed: ${(r.stderr || "").trim()}`);
  return (r.stdout || "").trim();
}

/**
 * The working tree as repo-relative paths. **Never through `git()`**: its `.trim()` is right for a
 * branch name and wrong for porcelain, whose first entry begins with a status column that may be a
 * space — trimmed, `slice(3)` took the first character of the path. See `parsePorcelainZ`.
 */
function dirtyPaths() {
  const r = spawnSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
                      { cwd: ROOT, encoding: "utf8" });
  if (r.status !== 0) throw new Error("git status failed: " + (r.stderr || "").trim());
  return parsePorcelainZ(r.stdout);
}

/** ADR-043: the context builder moved to `lib/entry.mjs`, where `check-carry.mjs` shares it. */
function carryContext(t, dirty) {
  return buildCarryContext(t, dirty, { readFrontMatter, readTicket });
}

const ticketDir = (id) => path.join(TICKETS_DIR, id);
const ticketFile = (id) => path.join(ticketDir(id), "ticket.yaml");
const artifact = (id, name) => path.join(ticketDir(id), name);   // real-run paths; the decision
                                                                 // functions take a dir so tests
                                                                 // never write to the board plane

const TICKET_ID = /^[A-Z]{2,4}-\d{1,3}[a-z]?$/;

function allTickets() {
  if (!fs.existsSync(TICKETS_DIR)) return [];
  return fs.readdirSync(TICKETS_DIR)
    .filter((d) => fs.existsSync(ticketFile(d)))
    .map((d) => {
      try { return readTicket(ticketFile(d)); }
      catch (e) { return { id: d, state: "UNPARSEABLE", _error: e.message }; }
    });
}

// --- CLI ---------------------------------------------------------------------------------------

function parseArgv(argv) {
  const opts = { command: null, input: null, until: null, gate: null, dryRun: false,
                 maxSteps: MAX_STEPS_PER_TICKET, resumeRun: null, noAsk: false, forced: null,
                 runId: null, budget: MAX_BUDGET_USD_PER_STEP,
                 maxQuestions: MAX_INTAKE_QUESTIONS, chain: false, noMerge: false };
  const rest = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") opts.dryRun = true;
    else if (a === "--no-ask") opts.noAsk = true;
    else if (a === "--chain") opts.chain = true;
    else if (a === "--no-merge") opts.noMerge = true;
    else if (a === "--until") opts.until = argv[++i];
    else if (a === "--gate") opts.gate = argv[++i];
    else if (a === "--max-steps") opts.maxSteps = Number(argv[++i]);
    else if (a === "--resume-run") opts.resumeRun = argv[++i];
    else if (a === "--run-id") opts.runId = argv[++i];
    else if (a === "--budget") opts.budget = Number(argv[++i]);
    else if (a === "--max-questions") opts.maxQuestions = Number(argv[++i]);
    else if (a === "--idea") opts.forced = { kind: "idea-text", value: argv[++i] };
    else if (a === "--idea-file") opts.forced = { kind: "idea-file", value: argv[++i] };
    else if (a === "--ticket") opts.forced = { kind: "ticket", value: argv[++i] };
    else if (a === "--tracker") opts.forced = { kind: "tracker", value: argv[++i] };
    else if (a.startsWith("--")) die(`unknown flag ${a}`);
    else rest.push(a);
  }
  opts.command = rest[0] ?? null;
  opts.input = rest[1] ?? null;
  if (opts.until && !STATES.includes(opts.until)) die(`--until ${opts.until} is not a state`);
  if (opts.gate && opts.gate !== "plan") die(`--gate ${opts.gate} is not supported; only \`plan\``);
  if (!Number.isInteger(opts.maxSteps) || opts.maxSteps < 1) die("--max-steps must be a positive integer");
  if (!(opts.budget > 0)) die("--budget must be a positive number of dollars");
  if (opts.chain && opts.noMerge) die("--chain needs the merge: each ticket is cut from origin/main (ADR-067)");
  if (!Number.isInteger(opts.maxQuestions) || opts.maxQuestions < 0) {
    die("--max-questions must be zero or a positive integer (0 means ask nothing)");
  }
  return opts;
}

function die(msg, code = 1) {
  console.error(`run-loop: ${msg}`);
  process.exit(code);
}

// --- Run state ---------------------------------------------------------------------------------

function newRunId() {
  const t = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "").replace("T", "-");
  return `${t}-${randomUUID().slice(0, 8)}`;
}

const runDir = (runId) => path.join(STATE_DIR, runId);

/** Persistent session ids live at the runner root: they outlive a single run by design. */
function sessions() {
  const f = path.join(STATE_DIR, "sessions.json");
  if (!fs.existsSync(f)) return {};
  try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return {}; }
}
function saveSessions(s) {
  fs.mkdirSync(STATE_DIR, { recursive: true });
  fs.writeFileSync(path.join(STATE_DIR, "sessions.json"), JSON.stringify(s, null, 2));
}

// --- Session policy ----------------------------------------------------------------------------
//
// This table is the reason the whole change exists. `.ai/01-operating-model.md` states it as a
// property of how sessions are started; until now nothing started them, so it was a description of
// what a careful human would do.

const SESSION_POLICY = {
  orchestrator:       "persistent",
  "tech-lead-design": "persistent",
  developer:          "per-ticket",
  "tech-lead-review": "always-fresh",
  product:            "fresh",
  devops:             "fresh",
};

/**
 * Returns { sessionId, mode } where mode is "new" or "resume".
 * `tech-lead-review` is asserted to be "new" under every entry path — a reviewer that remembers
 * checking R4 last time will not really check it again, and the code changed between passes.
 */
function sessionFor(agent, ticketId, store) {
  const policy = SESSION_POLICY[agent];
  if (!policy) throw new Error(`no session policy for agent ${agent}`);

  if (policy === "always-fresh" || policy === "fresh") {
    const sessionId = randomUUID();
    if (agent === "tech-lead-review") {
      // The assertion has to compare against what the LAST review used, not against itself.
      // RULE-13 is why this agent runs as its own process; a resume here would quietly turn the
      // second pass into the first one agreeing with itself.
      const key = `last-review:${ticketId}`;
      if (store[key] === sessionId) throw new Error("tech-lead-review session id was reused — RULE-13");
      store[key] = sessionId;
    }
    return { sessionId, mode: "new" };
  }

  const key = policy === "per-ticket" ? `${agent}:${ticketId}` : agent;
  const existing = store[key];
  if (existing) return { sessionId: existing, mode: "resume" };
  const sessionId = randomUUID();
  store[key] = sessionId;
  return { sessionId, mode: "new" };
}

/** Developer sessions are discarded when the ticket leaves the loop. */
function discardTicketSessions(ticketId, store) {
  for (const k of Object.keys(store)) if (k.endsWith(`:${ticketId}`)) delete store[k];
}

// --- Routing -----------------------------------------------------------------------------------
//
// Deterministic. Derived from the stage-ownership and failure-routing tables in
// `.ai/01-operating-model.md`. **Never a model call.**

/** The next step for a ticket, or null when the run should stop. */
function nextStep(t, dir = ticketDir(t.id)) {
  const review = readFrontMatter(path.join(dir, "04-review.md"));
  const reviewPassed = t.gates?.review?.passed === true;

  switch (t.state) {
    case "BACKLOG":
      return { command: "/plan", agent: "tech-lead-design", then: "/advance" };
    case "PLAN":
      return { command: "/advance", agent: "orchestrator" };
    case "READY":
      return { command: "/implement", agent: "developer", then: "/advance" };
    case "IN_PROGRESS": {
      // A finished /implement leaves 03-impl-log.md at PASS, and /advance records it. Anything else
      // (BLOCKED, FAIL, or no log yet) means the stage did not finish, and the work is the
      // Developer's again. Until 2026-10-23 this always routed to /advance, so a BLOCKED
      // implementation was re-recorded and never re-run (MIR-08, run 20261023-041145).
      let impl;
      try { impl = readFrontMatter(path.join(dir, "03-impl-log.md")); }
      catch { impl = null; }   // unreadable front-matter is not a PASS; /implement rewrites the log
      if (impl?.gate === "PASS") return { command: "/advance", agent: "orchestrator" };
      return { command: "/implement", agent: "developer", then: "/advance" };
    }
    case "REVIEW":
      if (reviewPassed) return { command: "/ship", agent: "orchestrator" };
      return { command: "/review", agent: "tech-lead-review", then: "/advance" };
    case "REWORK": {
      if (!review) return { stop: "REWORK with no 04-review.md to route from" };
      const to = review.route_to;
      if (to === "developer") return { command: "/implement", agent: "developer", then: "/advance" };
      if (to === "tech-lead-design") return { command: "/plan", agent: "tech-lead-design", then: "/advance" };
      return { stop: `REWORK with route_to: ${to ?? "<absent>"} — not a runnable route` };
    }
    default:
      return { stop: `state ${t.state} is not one the runner acts on` };
  }
}

/**
 * The state a stage would leave the ticket in, for `--dry-run` only. It mirrors the transitions
 * `/advance` and `/ship` actually write, and exists so a dry run can print the whole sequence with
 * no board to read. Returns null at the end of the sequence.
 *
 * Deliberately the happy path: a dry run shows what the loop WOULD do, not what a failing review
 * would make it do. The failure routes are exercised by the tests, against real artifacts.
 */
function advanceSimulated(t) {
  switch (t.state) {
    case "BACKLOG": return { ...t, state: "READY" };
    case "READY":   return { ...t, state: "REVIEW" };
    case "REWORK":  return { ...t, state: "REVIEW" };
    case "REVIEW":
      if (t.gates?.review?.passed === true) return null;   // /ship has just run
      return { ...t, gates: { ...(t.gates ?? {}), review: { passed: true, at: null } } };
    default: return null;
  }
}

/** Stop conditions read off the last review artifact. RULE-07 is the one that must never be missed. */
function reviewStop(t, dir = ticketDir(t.id)) {
  const r = readFrontMatter(path.join(dir, "04-review.md"));
  if (!r) return null;
  if (r.verdict && r.gate && r.verdict !== r.gate) {
    return `04-review.md is void: verdict (${r.verdict}) and gate (${r.gate}) disagree`;
  }
  if (r.invariant_violation === true) {
    return `invariant violation reported — RULE-07 escalates on first occurrence, never REWORK: ${r.blocking_reason ?? ""}`;
  }
  // A ticket at REVIEW whose review gate has not passed is about to be reviewed again, and /review
  // overwrites this file. A BLOCKED or human-routed verdict left in it is the last attempt's, which a
  // person has already dealt with by moving the ticket back to REVIEW (MIR-05, MIR-08). Stopping on
  // it again stopped MIR-08 before its re-review could run (run 20261023-072532). An invariant
  // violation above still stops in every state. If the re-review records nothing, the
  // "state did not change" check stops the run.
  if (t?.state === "REVIEW" && t?.gates?.review?.passed !== true) return null;
  if (r.route_to === "human") return `review routed to a human: ${r.blocking_reason ?? ""}`;
  if (r.gate === "BLOCKED") return `review is BLOCKED: ${r.blocking_reason ?? ""}`;
  return null;
}

/** A question addressed to a person halts the run. See ADR-036 on why this value is undeclared. */
function questionStop(t, dir = ticketDir(t.id)) {
  const q = readFrontMatter(path.join(dir, "99-questions.md"));
  if (!q) return null;
  if (q.to === "operator" || q.to === "human") return `99-questions.md is addressed to \`${q.to}\``;
  return null;
}

/**
 * `/ship` commits at its step 5 and pushes immediately after. `git push` is **deliberately absent**
 * from the allow list — `.claude/PERMISSIONS.md`: *"every push prompts once. That prompt is the last
 * point at which a human sees a branch name before history exists."*
 *
 * Unattended there is nobody to answer that prompt, and `--permission-prompts none` denies it. The
 * failure mode that matters is not that `/ship` fails: it is that `/ship` **commits, then fails**,
 * leaving history written and no pull request open. So the runner refuses the step rather than
 * discovering the denial halfway through it.
 *
 * This is not the runner second-guessing a permission. It is the runner declining to start a
 * transaction it can see has no second half.
 */
function shipPermissionStop() {
  let allow;
  try {
    const s = JSON.parse(fs.readFileSync(path.join(ROOT, ".claude", "settings.json"), "utf8"));
    allow = s?.permissions?.allow ?? [];
  } catch {
    return "could not read .claude/settings.json to check whether `git push` is permitted";
  }
  const canPush = allow.some((rule) => /^Bash\(git push\b/.test(rule));
  if (canPush) return null;
  return [
    "/ship pushes, and `git push` is deliberately absent from permissions.allow",
    "(.claude/PERMISSIONS.md: the push prompt is the last point a human sees a branch name).",
    "Unattended that prompt is auto-denied, and /ship would commit before failing — history written,",
    "no pull request open. The ticket is reviewed and its gates are recorded; finish it by hand:",
    "",
    "    git push origin <the ticket branch>",
    "    gh pr create --fill",
    "",
    "Or decide to allow `Bash(git push origin feat/*)` — that reverses a documented control and",
    "wants an ADR, not an edit.",
  ].join("\n");
}

function budgetStop(t) {
  for (const [pair, b] of Object.entries(t.chat_budget ?? {})) {
    if (typeof b === "object" && b && b.used >= b.max) return `chat budget exhausted on ${pair} (RULE-15)`;
  }
  return null;
}

// --- Preflight ---------------------------------------------------------------------------------

function preflight(t, step) {
  const problems = [];

  // Branch. `/plan` is the only command permitted to bring a feat/ branch into existence
  // (.claude/commands/plan.md, step 0), so a protected branch is correct *only* when PLAN is next.
  const branch = git("branch", "--show-current");
  const want = branchFor(t.id);
  const planIsNext = step?.command === "/plan";
  // ADR-067 decision 6: when PLAN is next, any branch is accepted. /plan step 0 has a row for every
  // case: already on the branch, switch to it, or cut it from origin/main. The stray check below is
  // what step 0 actually stops on. Until 2026-10-23 this refused a clean tree on the last ticket's
  // merged branch, which step 0 accepts, so every chained run stopped here.
  if (planIsNext) {
    if (branch !== want && !branch) {
      problems.push(`HEAD is detached; /plan step 0 needs a branch to read`);
    }
  } else if (branch !== want) {
    problems.push(`on branch \`${branch}\` but ${t.id} needs \`${want}\`; the runner never switches to an existing branch (ADR-006)`);
  }

  // Tree. Dirty is allowed for this ticket's own work and its own triage output — the rule is
  // planCarry in scripts/lib/entry.mjs, and /plan step 0 states the same rule. Anything else stops.
  // It holds at every stage, not only /plan: triage output rides the ticket branch until /ship.
  const dirty = dirtyPaths();
  const { stray } = planCarry(dirty, carryContext(t, dirty));
  if (stray.length) {
    problems.push(`working tree is dirty outside this ticket and its triage output: ${stray.join(", ")} — /plan step 0 stops on these`);
  }

  // WIP = 1 — tickets in flight, not tickets that exist (IN_FLIGHT_STATES, scripts/lib/entry.mjs).
  const inFlight = wipBlockers(allTickets(), t.id);
  if (inFlight.length) {
    problems.push(`WIP: ${inFlight.map((o) => `${o.id}=${o.state}`).join(", ")} is in flight (ADR-006: one at a time)`);
  }

  // The runner must never drop the project's hooks, commands or agents.
  if (process.env.CLAUDE_CODE_SIMPLE === "1") {
    problems.push("CLAUDE_CODE_SIMPLE=1 is set — that is --bare, which skips hooks and CLAUDE.md");
  }

  // A shell-dependent binary is refused rather than worked around: the shell is what corrupts argv.
  if (process.platform === "win32" && !CLAUDE_BIN.toLowerCase().endsWith(".exe")) {
    problems.push(
      "could not find claude.exe — `" + CLAUDE_BIN + "` would need a shell, and a shell re-parses " +
      "argv (it turns --setting-sources user,project,local into three words). Set CLAUDE_BIN to the " +
      "full path of claude.exe."
    );
  }

  return problems;
}

function validateEntry(t) {
  const problems = [];
  if (MANUAL_STATES.includes(t.state)) problems.push(`${t.id} is ${t.state} — a human decides; the runner never acts on it`);
  if (TERMINAL_STATES.includes(t.state)) problems.push(`${t.id} is ${t.state}`);
  if (!STATES.includes(t.state)) problems.push(`${t.id} has state \`${t.state}\`, which is not in the enum`);

  const ids = t.feature_ids ?? [];
  if (!ids.length) problems.push(`${t.id} has no feature_ids (Definition of Ready item 1)`);
  else if (fs.existsSync(FEATURES)) {
    const features = fs.readFileSync(FEATURES, "utf8");
    for (const id of ids) {
      if (!features.includes(String(id))) problems.push(`feature ${id} is absent from features.md`);
    }
  }

  for (const dep of t.depends_on ?? []) {
    const f = ticketFile(String(dep));
    if (!fs.existsSync(f)) { problems.push(`depends_on ${dep} has no ticket.yaml`); continue; }
    const d = readTicket(f);
    if (d.state !== "DONE") problems.push(`depends_on ${dep} is ${d.state}, not DONE`);
  }
  return problems;
}

// --- Invocation --------------------------------------------------------------------------------

/**
 * Build the argv for one stage. `--setting-sources` is passed explicitly rather than relied on:
 * the default for `-p` is not documented in `claude --help`, and a run that silently lost the
 * project's hooks and commands would look like a model failure rather than a configuration one.
 */
/**
 * **`acceptEdits`, not `dontAsk`.** The operator's brief said `dontAsk`, and `dontAsk` cannot work:
 * `.claude/settings.json` carries **no `Write` or `Edit` rule at all** — the allow list is Bash
 * verbs and MCP tools — so with `--permission-prompts none` every file write by every stage is
 * denied. TRIAGE was simply the first stage to try one.
 *
 * Interactively the project works because each agent declares its own mode: `developer` and `solo`
 * are `acceptEdits`, and `product`, `tech-lead-design`, `orchestrator` and `tech-lead-review` are
 * `default` — which prompts, and a human clicks yes. Unattended there is nobody to click.
 *
 * **This is not a control being weakened.** ADR-004 already removed the three file-write guards, so
 * write-time approval is not what holds RULE-01 or RULE-03 here: RULE-01 is CODEOWNERS review at
 * merge, RULE-03 is review check R1 plus `check-allowed-paths.mjs` in CI.
 * `.claude/PERMISSIONS.md` defends exactly one write — `git push` — and that one is still denied,
 * which is why the runner refuses to start `/ship`.
 *
 * `--permission-prompts none` stays. Edits are accepted; **everything else that would prompt is
 * still denied**, so Bash verbs remain bounded by the allow list.
 *
 * The tighter alternative, if the operator wants it, is to keep `dontAsk` and add path-scoped
 * `Write(...)`/`Edit(...)` rules. The paths the loop legitimately writes are `.ai/board/**`,
 * `.ai/registry/**`, `src/**`, `tests/**` and `supabase/**` — close enough to the whole repository
 * that the extra surface buys little over this one flag.
 */
function buildArgv(commandText, agent, session, budget = MAX_BUDGET_USD_PER_STEP) {
  const argv = [
    "-p", commandText,
    "--agent", agent,
    "--setting-sources", "user,project,local",
    "--permission-mode", "acceptEdits",
    "--permission-prompts", "none",
    "--output-format", "json",
    "--max-budget-usd", String(budget),
  ];
  argv.push(session.mode === "resume" ? "--resume" : "--session-id", session.sessionId);
  return argv;
}

/**
 * Every dollar every step reported, summed where the steps are spawned. Before 2026-09-22 only the
 * loop steps added to the report, so a run that stopped at TRIAGE after a $1.43 step reported
 * `Cost: $0.0000` — a measured-looking zero. Summing here means no entry path can forget.
 */
let spentThisRun = 0;

function invoke(argv, runId, stepNo) {
  // shell: false, always. See resolveClaudeBin — a shell re-parses argv and has already corrupted
  // both a comma-separated flag value and a path containing a space.
  const r = spawnSync(CLAUDE_BIN, argv, {
    cwd: ROOT,
    encoding: "utf8",
    shell: false,
    maxBuffer: 64 * 1024 * 1024,
  });
  const out = { at: iso(), argv, status: r.status, stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  let parsed = null;
  try { parsed = JSON.parse(out.stdout); } catch { /* left null; the raw stdout is logged */ }
  out.result = parsed;
  spentThisRun += Number(parsed?.total_cost_usd) || 0;
  fs.mkdirSync(runDir(runId), { recursive: true });
  fs.writeFileSync(path.join(runDir(runId), `step-${String(stepNo).padStart(2, "0")}.json`),
                   JSON.stringify(out, null, 2));
  return out;
}

/** Everything that means "this step did not cleanly succeed". */
function stepFailure(out) {
  if (out.status !== 0) return `exit ${out.status}: ${out.stderr.trim().slice(0, 500)}`;
  const r = out.result;
  if (!r) return "output was not JSON — check --output-format and whether the CLI printed a prompt";
  // REPLY-TEXT: shown to the operator in a stop message. Never parsed, never routed on.
  if (r.is_error) return `is_error: ${r.result ?? r.error ?? "<no detail>"}`;
  // ADR-067 decision 6: a permission denial is a warning, not a failure. The step is judged by its
  // artifact's front-matter and by the board, like every other step. Until 2026-10-23 one denied
  // `supabase db dump --help` failed a /plan whose 01-plan.md was already written with a valid gate.
  return null;
}

/** The commands a step was denied, one line each, for REPORT.md. */
function stepDenials(out) {
  return (out.result?.permission_denials ?? []).map((d) => {
    const cmd = d?.tool_input?.command ?? d?.tool_input?.file_path ?? JSON.stringify(d?.tool_input ?? {});
    return `${d?.tool_name ?? "?"}: ${String(cmd).replace(/\s+/g, " ").slice(0, 200)}`;
  });
}

function writeStopped(runId, { ticket, stage, reason, decide, resume }) {
  fs.mkdirSync(runDir(runId), { recursive: true });
  const body = `# Run stopped

- **Run:** \`${runId}\`
- **Ticket:** ${ticket ?? "n/a"}
- **Stage:** ${stage ?? "n/a"}
- **At:** ${iso()}

## Why it stopped

${reason}

## What you must decide

${decide}

## To resume

\`\`\`
${resume}
\`\`\`
`;
  fs.writeFileSync(path.join(runDir(runId), "STOPPED.md"), body);
  log(`\nstopped — ${path.relative(ROOT, path.join(runDir(runId), "STOPPED.md"))}`);
}

// --- The plan gate -----------------------------------------------------------------------------

async function planGate(id) {
  const plan = artifact(id, "01-plan.md");
  if (!fs.existsSync(plan)) return "01-plan.md was not produced";
  const text = fs.readFileSync(plan, "utf8");
  const wanted = ["1.", "2.", "3.", "7."];
  log(`\n--- ${id} 01-plan.md — sections ${wanted.join(" ")} ---\n`);
  // Print each numbered section heading and its body, which is what the operator is approving.
  for (const s of text.split(/^## /m)) {
    const head = s.split("\n", 1)[0];
    if (/^\s*[1237]\b/.test(head)) log(`## ${s.trimEnd()}\n`);
  }
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const answer = await new Promise((res) => rl.question("approve this plan and continue? [y/N] ", res));
  rl.close();
  return /^y(es)?$/i.test(answer.trim()) ? null : "plan gate: not approved";
}

// --- Intake and TRIAGE -----------------------------------------------------------------------------
//
// Intake is the ONLY interactive moment of a run, and it happens before anything is written. The
// alternative is letting TRIAGE assume, and `.ai/templates/plan.md` puts the cost of that in one
// line: "A question here blocks; an assumption here ships."
//
// These two stages are the only ones the runner hands any text to. Every other stage receives
// nothing but its slash command and a ticket id, and reads ARTIFACTS_FOR[state] from disk. The
// exception exists because the operator's request is not on disk until TRIAGE writes it there.

/**
 * Read the intake result three ways, in decreasing order of how much structure survives:
 * raw JSON, a fenced JSON block, then the text itself. Returns { questions } or { prose }.
 */
function readQuestions(raw) {
  if (raw && typeof raw === 'object') {
    return { questions: raw.questions ?? null, prose: null };
  }
  if (typeof raw !== 'string' || !raw.trim()) return { questions: null, prose: null };

  const tryParse = (s) => {
    try {
      const o = JSON.parse(s);
      return Array.isArray(o?.questions) ? o.questions : null;
    } catch { return null; }
  };

  const direct = tryParse(raw.trim());
  if (direct) return { questions: direct, prose: null };

  // A fenced block, which is what a model does when it is told JSON and trained to format.
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(raw);
  if (fenced) {
    const inner = tryParse(fenced[1].trim());
    if (inner) return { questions: inner, prose: null };
  }

  // A bare object somewhere in the prose.
  const braced = /\{[\s\S]*"questions"[\s\S]*\}/.exec(raw);
  if (braced) {
    const inner = tryParse(braced[0]);
    if (inner) return { questions: inner, prose: null };
  }

  // The sign-off block is conversation, not content, and it is noise in a stored answer.
  const prose = raw.replace(/\n---\s*\n\*\*Tôi là[\s\S]*$/m, '').trim();
  return { questions: null, prose };
}

async function runIntake(text, runId, store, opts) {
  if (opts.noAsk || opts.maxQuestions === 0) {
    // Worth being explicit about what was traded away: the questions do not disappear, they
    // become assumptions in `01-plan.md` written by the agent that also designs against them.
    log('intake skipped — any question it would have asked becomes an assumption at PLAN');
    return { qa: [] };
  }

  const session = sessionFor('product', 'intake', store);
  const argv = [
    '-p', intakePrompt(text, opts.maxQuestions),
    '--agent', 'product',
    '--setting-sources', 'user,project,local',
    // Intake is told to write no file, so it keeps the strict mode. If it tries to write, the
    // denial is the correct answer and the prompt is wrong.
    '--permission-mode', 'dontAsk',
    '--permission-prompts', 'none',
    '--output-format', 'json',
    '--max-budget-usd', String(opts.budget),
    '--json-schema', INTAKE_SCHEMA,
    '--session-id', session.sessionId,
  ];
  log('\n[intake] asking `product` what it needs to know');
  const out = invoke(argv, runId, 0);
  const failure = stepFailure(out);
  if (failure) return { error: 'intake failed — ' + failure };

  // A step that succeeded is never thrown away for its shape. The first real intake cost $1.19 and
  // returned four well-cited questions that the runner discarded because they were prose — which is
  // the wrong trade every time: the money is spent either way, and the content was good.
  // REPLY-TEXT: the ONLY place the runner consumes reply text, and it degrades to prose rather than
  // discarding the step. Everything else reads front-matter from disk — see ADR-036.
  const raw = out.result.result;
  const { questions, prose } = readQuestions(raw);
  if (!questions && !prose) {
    return { error: 'intake returned nothing readable; see step-00.json in this run folder' };
  }

  if (!questions) {
    // Prose fallback. The operator answers in one block; both halves reach TRIAGE verbatim, so
    // nothing is lost except the numbering.
    log('\n[intake] `product` answered in prose rather than JSON. Using it as written.\n');
    log(prose);
    log('\n--- answer all of it in one go. Finish with an empty line. ---\n');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const lines = [];
    for await (const line of rl) { if (line.trim() === '') break; lines.push(line); }
    rl.close();
    return { qa: [{ question: prose, answer: lines.join('\n').trim() }] };
  }

  if (!questions.length) {
    log('[intake] no questions — the request is unambiguous on all five axes');
    return { qa: [] };
  }

  log('\n--- ' + questions.length + ' question(s) before anything is written ---');
  log('Answers go to TRIAGE verbatim. Several lines are fine — a blank line ends each answer.');
  log('An empty answer is recorded as "not decided", which is never read as agreement.\n');

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const qa = [];
  for (const [i, q] of questions.entries()) {
    log((i + 1) + '. ' + q.question);
    log('   (' + q.why_it_changes_the_work + ')');
    // Multi-line: a blank line ends the answer. The single-line version was a real limit — these
    // questions are about permissions and scope, and the answers do not fit on one line.
    const said = [];
    for (;;) {
      const line = await new Promise((res) => rl.question(said.length ? '   ' : '   > ', res));
      if (line.trim() === '') break;
      said.push(line);
    }
    qa.push({ question: q.question, answer: said.join('\n').trim() });
    log('');
  }
  rl.close();
  return { qa };
}

/**
 * Run /triage in a FRESH `product` session and return the idea file it wrote.
 *
 * Which file did it write? Compared before and after, rather than parsed out of the reply. A
 * filename read from prose is a filename the model could restate differently on a re-read, and this
 * one decides which verdict the run obeys.
 */
function runTriage(text, qa, runId, store, stepNo, budget = MAX_BUDGET_USD_PER_STEP) {
  const before = new Set(fs.existsSync(IDEAS_DIR) ? fs.readdirSync(IDEAS_DIR) : []);
  const session = sessionFor('product', 'triage-' + runId, store);
  const argv = [
    '-p', triagePrompt(text, qa, iso()),
    '--agent', 'product',
    '--setting-sources', 'user,project,local',
    '--permission-mode', 'acceptEdits',   // writes the idea file, the feature row and the ticket shell
    '--permission-prompts', 'none',
    '--output-format', 'json',
    '--max-budget-usd', String(budget),
    '--session-id', session.sessionId,
  ];
  log('\n[triage] /triage in a fresh `product` session');
  const out = invoke(argv, runId, stepNo);
  const failure = stepFailure(out);
  if (failure) return { error: 'triage failed — ' + failure };

  const after = fs.existsSync(IDEAS_DIR) ? fs.readdirSync(IDEAS_DIR) : [];
  const created = after.filter((n) => n.endsWith('.md') && !before.has(n));
  if (created.length === 1) return { file: path.join(IDEAS_DIR, created[0]) };
  if (created.length === 0) return { error: 'triage wrote no new file in .ai/board/ideas/' };
  return { error: 'triage wrote ' + created.length + ' new idea files and the runner cannot tell which is this one: ' + created.join(', ') };
}

/**
 * Triage an idea file that `/idea` already filled in. Unlike `runTriage`, nothing is relayed: the
 * file is on disk and the stage reads it, which is how every other stage in the loop works. The
 * runner names it and stands back.
 */
function runTriageFromFile(ideaFile, runId, store, stepNo, budget = MAX_BUDGET_USD_PER_STEP, decidedAdrs = null) {
  const rel = path.relative(ROOT, ideaFile).split(path.sep).join("/");
  const session = sessionFor('product', 'triage-' + runId, store);
  const argv = [
    '-p', decidedAdrs ? retriagePrompt(rel, decidedAdrs, iso()) : triageFromFilePrompt(rel, iso()),
    '--agent', 'product',
    '--setting-sources', 'user,project,local',
    '--permission-mode', 'acceptEdits',
    '--permission-prompts', 'none',
    '--output-format', 'json',
    '--max-budget-usd', String(budget),
    '--session-id', session.sessionId,
  ];
  const out = invoke(argv, runId, stepNo);
  const failure = stepFailure(out);
  if (failure) return { error: 'triage failed — ' + failure };
  return { file: ideaFile };
}

/** Written on every run, finished or stopped. */
function saveReport(runId, report) {
  report.finishedAt = iso();
  report.cost = spentThisRun;
  try { report.orphanPaths = orphanPaths(dirtyPaths()); } catch { report.orphanPaths = []; }
  fs.mkdirSync(runDir(runId), { recursive: true });
  fs.writeFileSync(path.join(runDir(runId), 'REPORT.md'), renderReport(runId, report));
  log('report — ' + path.relative(ROOT, path.join(runDir(runId), 'REPORT.md')));
}

// --- Main --------------------------------------------------------------------------------------

async function main() {
  const opts = parseArgv(process.argv.slice(2));
  if (opts.command !== 'auto') {
    die([
      'usage: node scripts/run-loop.mjs auto [<input>] [options]',
      '',
      '  <input>  a ticket id, a path under .ai/board/ideas/, or free text for a new idea.',
      '           Nothing at all asks the orchestrator what is next.',
      '',
      '  --idea <text>   --idea-file <path>   --ticket <ID>   --tracker <id>',
      '  --until <STATE> --gate plan          --no-ask',
      '  --dry-run       --max-steps <n>      --resume-run <id>   --budget <usd per step>',
      '  --chain         after the merge, run the next same-group ticket whose depends_on are DONE',
      '  --no-merge      stop at the open pull request (the ending before ADR-067)',
      '  --max-questions <n>   0 asks nothing and assumes instead',
    ].join('\n'));
  }

  // --run-id lets a launcher know the log and report paths BEFORE the process starts, which is what
  // /auto needs: a run id discovered afterwards is a race, and the one time it loses is the run that
  // failed early and left nothing to point at.
  const runId = opts.resumeRun ?? opts.runId ?? newRunId();
  const store = sessions();
  const report = { input: opts.input, qa: [], steps: 0, cost: 0, tickets: [], warnings: [], chain: opts.chain,
                   registryWrites: [], layoutDecisions: [] };

  let reportWritten = false;
  const writeReportOnce = () => {
    if (reportWritten || opts.dryRun) return;
    reportWritten = true;
    try { saveReport(runId, report); } catch (e) { console.error('run-loop: could not write REPORT.md — ' + e.message); }
  };
  process.on('exit', writeReportOnce);

  // --- Resolve what was typed, in deterministic code (ADR-037) ---
  const entryPoint = resolveInput(opts.input, opts, {
    ticketFileExists: (x) => fs.existsSync(ticketFile(x)),
  });
  if (entryPoint.error) die(entryPoint.error);
  report.resolvedAs = entryPoint.how ?? entryPoint.kind;
  log('run ' + runId + ' — resolved as ' + report.resolvedAs + (opts.dryRun ? '  [dry-run]' : ''));

  let id = null;

  if (entryPoint.kind === 'next') {
    die('no input: pass a ticket id, an idea file, or free text.\n' +
        '/next-ticket entry is not installed — both live sections of backlog.md are empty, so there\n' +
        'is nothing for it to pick and no way to tell a correct pick from a wrong one.');
  }

  if (entryPoint.kind === 'intake' || entryPoint.kind === 'idea') {
    // The resume line names what exists. It used to print the literal `<ticket>` on every TRIAGE
    // stop, including the ones where no ticket can exist yet and the thing to re-run is the idea.
    let ideaFile = entryPoint.file ?? null;
    const resumeCommand = () => 'node scripts/run-loop.mjs auto ' + (report.ticketId
      ?? (ideaFile ? path.basename(ideaFile, '.md') : '--idea "' + String(entryPoint.text ?? '').replace(/"/g, "'") + '"'));

    const stopHere = (why, code, decide) => {
      report.stopped = why;
      report.resume = resumeCommand();
      writeStopped(runId, { ticket: report.ticketId, stage: 'TRIAGE', reason: why,
        decide: decide ?? 'TRIAGE reserved this for you. Nothing further runs until you decide.',
        resume: report.resume });
      log('\n' + why);
      saveSessions(store);
      process.exit(code);
    };

    if (opts.dryRun) {
      // The two entries do different things, and a dry run that showed the same sequence for both
      // would be describing a run that does not happen.
      const fromFile = entryPoint.file ?? null;
      const triaged = fromFile ? readFrontMatter(fromFile)?.verdict : null;
      log('');
      if (triaged && String(triaged).toUpperCase() === 'NEEDS-ADR') {
        const waiting = awaitedAdrs(readFrontMatter(fromFile)).map((id) => adrStatus(id));
        log('[dry-run] ' + path.basename(fromFile) + ' is NEEDS-ADR, waiting on:');
        for (const a of waiting) log('[dry-run]   ' + a.id + ' — ' + (a.status ?? a.problem));
        log(adrsSettled(waiting)
          ? '[dry-run] all decided -> /triage again (re-triage), then the verdict below'
          : '[dry-run] not all decided -> stop again, naming the ADR files to decide');
      } else if (triaged) {
        log('[dry-run] ' + path.basename(fromFile) + ' is already triaged: verdict ' + triaged);
        log('[dry-run] no intake, no /triage — entering the loop at the recorded ticket');
      } else if (fromFile) {
        log('[dry-run] /triage    -> product            reads ' + path.basename(fromFile) + ' from disk');
        log('[dry-run] NO INTAKE — /idea already asked; the file is the answers (ADR-038)');
        log('[dry-run] a decision genuinely missing -> BLOCKED and the run stops, never a guess');
      } else {
        log('[dry-run] intake     -> product            --json-schema, at most ' + opts.maxQuestions + ' questions');
        log('[dry-run] /triage    -> product            fresh session, request quoted verbatim');
      }
      log('[dry-run] verdict read from the idea file front-matter, never from the reply');
      log('[dry-run]   REJECT | NEEDS-ADR -> stop. No ticket branch, no product source touched');
      log('[dry-run]   PROMOTE -> ticket_id read from disk, then:');
      log('[dry-run] /plan      -> tech-lead-design   then /advance -> orchestrator');
      log('[dry-run] /implement -> developer          then /advance -> orchestrator');
      log('[dry-run] /review    -> tech-lead-review   then /advance -> orchestrator   (always fresh)');
      log('[dry-run] /ship      -> orchestrator        refused while git push is not permitted');
      log('');
      log('[dry-run] end of sequence');
      return;
    }

    if (ideaFile === null) {
      // Free text: ask, then triage what was said.
      const got = await runIntake(entryPoint.text, runId, store, opts);
      if (got.error) stopHere(got.error, 3);
      report.qa = got.qa;
      saveSessions(store);

      const triaged = runTriage(entryPoint.text, got.qa, runId, store, 1, opts.budget);
      if (triaged.error) stopHere(triaged.error, 3);
      ideaFile = triaged.file;
      report.steps += 2;
    } else if (!readFrontMatter(ideaFile)?.verdict) {
      // **An idea file that has not been triaged yet, and the reason this path exists.**
      //
      // `/idea` interrogates the operator in a session until the file holds every decision, so by
      // the time it reaches the runner there is nothing left to ask. Intake is therefore SKIPPED —
      // not suppressed, not answered with defaults: there is no question, because the file is the
      // answers. If TRIAGE finds a genuine gap it writes OPEN QUESTIONS and BLOCKS, and the run
      // stops with the gap named rather than guessing past it.
      log('\n[triage] ' + path.basename(ideaFile) + ' has no verdict yet — triaging it');
      log('[triage] no intake: the file is meant to hold every decision already');
      const triaged = runTriageFromFile(ideaFile, runId, store, 1, opts.budget);
      if (triaged.error) stopHere(triaged.error, 3);
      report.steps += 1;
    } else if (String(readFrontMatter(ideaFile)?.verdict).toUpperCase() === 'NEEDS-ADR') {
      // **The exit from NEEDS-ADR.** The verdict is on disk and would otherwise be re-read for ever;
      // what changes when the operator decides is the ADR's `## Status` line, so that is what is
      // read. Once none of the awaited ADRs is PROPOSED, the stale verdict is re-triaged — once per
      // run, so a TRIAGE that returns NEEDS-ADR again stops rather than looping.
      const waiting = awaitedAdrs(readFrontMatter(ideaFile)).map((id) => adrStatus(id));
      if (adrsSettled(waiting)) {
        log('\n[triage] ' + path.basename(ideaFile) + ' was NEEDS-ADR, and every ADR it waits on is decided:');
        for (const a of waiting) log('[triage]   ' + a.id + ' — ' + a.status);
        log('[triage] re-triaging it; the new verdict replaces the old one');
        const triaged = runTriageFromFile(ideaFile, runId, store, 1, opts.budget, waiting);
        if (triaged.error) stopHere(triaged.error, 3);
        report.steps += 1;
      }
    }

    const v = readVerdict(ideaFile, readFrontMatter);
    if (v.error) stopHere(v.error, 2);
    report.verdict = v.verdict;
    report.verdictReason = v.reason;
    log('\n[triage] verdict ' + v.verdict + (v.reason ? ' — ' + v.reason : ''));

    const adrs = v.verdict === 'NEEDS-ADR'
      ? awaitedAdrs(readFrontMatter(ideaFile)).map((id) => adrStatus(id)) : [];
    const vstop = verdictStop(v, adrs);
    if (vstop) {
      stopHere(vstop, 2, v.verdict === 'NEEDS-ADR' ? needsAdrDecision(adrs, resumeCommand()) : undefined);
    }

    if (!v.ticketId) stopHere('verdict is PROMOTE but ticket_id is empty in the idea front-matter', 2);
    if (!fs.existsSync(ticketFile(v.ticketId))) {
      stopHere('PROMOTE names ticket ' + v.ticketId + ' but its ticket.yaml does not exist', 2);
    }
    id = v.ticketId;
    report.registryWrites.push('.ai/registry/features.md — the row for ' + id +
                               ', cited from ' + path.basename(ideaFile));
    log('[triage] PROMOTE -> ' + id + ', entering the loop at BACKLOG');
  }

  if (entryPoint.kind === 'ticket') id = entryPoint.id;
  report.ticketId = id;

  if (!fs.existsSync(ticketFile(id))) die(id + ': no ticket.yaml at ' + path.relative(ROOT, ticketFile(id)));

  // ADR-067: one pass of this loop per ticket. Without --chain it runs once, which is the runner as
  // it was before 2026-10-23 plus the merge.
  for (;;) {
  let t = readTicket(ticketFile(id));
  const entry = validateEntry(t);
  if (entry.length) die('entry validation failed for ' + id + ':\n  - ' + entry.join('\n  - '));

  log('run ' + runId + ' — ' + id + ' at ' + t.state + (opts.dryRun ? '  [dry-run]' : ''));

  let steps = 0;
  let lastState = null;
  let reachedDone = false;

  let sim = null;
  while (steps < opts.maxSteps) {
    t = opts.dryRun ? (sim ?? t) : readTicket(ticketFile(id));

    // --- Stop conditions checked before anything is spawned ---
    if (MANUAL_STATES.includes(t.state) || TERMINAL_STATES.includes(t.state)) {
      const why = TERMINAL_STATES.includes(t.state)
        ? `${id} reached ${t.state}`
        : `${id} is ${t.state} — a human decides and the ticket does not self-resume`;
      report.finalState = t.state;
      if (!TERMINAL_STATES.includes(t.state)) report.stopped = why;
      log(why);
      if (!TERMINAL_STATES.includes(t.state)) {
        writeStopped(runId, { ticket: id, stage: t.state, reason: why,
          decide: "Read `04-review.md` and decide whether to amend the plan, fix the code, or close the ticket.",
          resume: `node scripts/run-loop.mjs auto ${id}` });
      }
      discardTicketSessions(id, store); saveSessions(store);
      if (t.state === "DONE") { reachedDone = true; break; }
      return;
    }
    if (opts.until && t.state === opts.until) { log(`reached --until ${opts.until}`); saveSessions(store); return; }

    for (const check of opts.dryRun ? [] : [reviewStop, questionStop, budgetStop]) {
      const why = check(t);
      if (why) {
        writeStopped(runId, { ticket: id, stage: t.state, reason: why,
          decide: "This is one of the points the rules reserve for a person. Nothing will move until you decide.",
          resume: `node scripts/run-loop.mjs auto ${id}` });
        saveSessions(store);
        process.exit(2);
      }
    }

    // Progress is the state AND the two gates AND the rework counter. A passing review leaves the
    // ticket at REVIEW and moves only gates.review, which is correct (`/ship` sets DONE); comparing
    // the state alone called that "recorded nothing" and stopped MIR-08 one step before /ship
    // (run 20261023-072747).
    if (progressKey(t) === lastState && steps > 0) {
      writeStopped(runId, { ticket: id, stage: t.state,
        reason: `state did not change after a step (still ${t.state}) — the stage ran but recorded nothing`,
        decide: "Read the last `step-NN.json` in this run folder. A stage that returns cleanly without moving the board usually means `/advance` found no artifact front-matter to transcribe.",
        resume: `node scripts/run-loop.mjs auto ${id}` });
      saveSessions(store);
      process.exit(2);
    }
    lastState = progressKey(t);

    // --- B3: after PLAN, before the ticket is built against. ADR-037. ---
    //
    // Both of these are cheap to check and expensive to miss. A plan whose OPEN QUESTIONS touch a
    // permission is a plan with a hole in the one place the loop cannot recover from later: the
    // Developer will fill it with an assumption, the reviewer will check the code against the plan
    // that contains the hole, and both will pass.
    if (!opts.dryRun && t.state === 'READY') {
      const planPath = artifact(id, '01-plan.md');
      const planText = fs.existsSync(planPath) ? fs.readFileSync(planPath, 'utf8') : null;
      for (const why of [openQuestionsStop(planText), sizeStop(t)]) {
        if (!why) continue;
        report.stopped = why;
        report.finalState = t.state;
        report.resume = 'node scripts/run-loop.mjs auto ' + id;
        writeStopped(runId, { ticket: id, stage: 'PLAN -> READY', reason: why,
          decide: 'Amend 01-plan.md and re-run, or answer the question in the plan and re-run /plan.',
          resume: report.resume });
        log('\n' + why);
        saveSessions(store);
        process.exit(2);
      }
    }

    // --- Route ---
    const step = nextStep(t);
    if (step.command === "/ship" && !opts.dryRun) {
      const why = shipPermissionStop();
      if (why) {
        writeStopped(runId, { ticket: id, stage: "REVIEW -> DONE", reason: why,
          decide: "Push and open the pull request yourself, or decide to allow git push for feat/ branches.",
          resume: `node scripts/run-loop.mjs auto ${id}` });
        log(`\n${why}`);
        saveSessions(store);
        process.exit(2);
      }
    }
    if (step.stop) {
      writeStopped(runId, { ticket: id, stage: t.state, reason: step.stop,
        decide: "The router found no runnable next step for this state.",
        resume: `node scripts/run-loop.mjs auto ${id}` });
      saveSessions(store);
      process.exit(2);
    }

    const pre = preflight(t, step);
    if (pre.length) {
      if (opts.dryRun) {
        // A dry run reports what would have stopped it and keeps printing. Aborting here would make
        // the one command whose job is to show the plan the one command that shows nothing.
        for (const p of pre) log(`    [dry-run] preflight would stop: ${p}`);
      } else {
        const reason = `preflight failed:\n  - ${pre.join("\n  - ")}`;
        log(reason);
        writeStopped(runId, { ticket: id, stage: t.state, reason,
          decide: "Preflight refuses rather than repairs. The runner never switches branch, stashes or resets (ADR-006).",
          resume: `node scripts/run-loop.mjs auto ${id}` });
        process.exit(1);
      }
    }

    // --- Run the stage, then the recording step ---
    const chain = [{ command: step.command, agent: step.agent }];
    if (step.then) chain.push({ command: step.then, agent: "orchestrator" });

    for (const link of chain) {
      steps++;
      const session = sessionFor(link.agent, id, store);
      if (!opts.dryRun) saveSessions(store);
      const text = `${link.command} ${id}`;
      const argv = buildArgv(text, link.agent, session, opts.budget);

      log(`\n[${steps}] ${text}`);
      log(`    agent=${link.agent}  session=${session.sessionId}  policy=${SESSION_POLICY[link.agent]}  mode=${session.mode}`);
      if (opts.dryRun) {
        log("    " + CLAUDE_BIN);
        log("    " + argv.map((a) => (/\s/.test(a) ? JSON.stringify(a) : a)).join(" "));
        continue;
      }

      const out = invoke(argv, runId, steps);
      const failure = stepFailure(out);
      if (failure) {
        writeStopped(runId, { ticket: id, stage: text, reason: `step failed — ${failure}`,
          decide: "Read the step JSON in this run folder. A permission denial means the allow-list needs the command, not that the stage was wrong.",
          resume: `node scripts/run-loop.mjs auto ${id} --resume-run ${runId}` });
        saveSessions(store);
        process.exit(3);
      }
      for (const w of stepDenials(out)) report.warnings.push(`${text} — denied ${w}`);
      const r = out.result ?? {};
      report.steps = steps;
      report.cost = spentThisRun;
      report.finalState = t.state;
      report.reworkCount = t.rework_count ?? 0;
      if (link.command === '/ship') {
        // REPLY-TEXT: cosmetic, for REPORT.md only. The run does not branch on whether this matches.
        const m = /https:\/\/github\.com\/\S+\/pull\/\d+/.exec(String(r.result ?? ''));
        if (m) report.prUrl = m[0];
      }
      log(`    ok  cost=$${(r.total_cost_usd ?? 0).toFixed(4)}  run total=$${report.cost.toFixed(4)}  ${r.duration_ms ?? "?"}ms  session=${r.session_id ?? "?"}`);
    }

    if (opts.dryRun) {
      sim = advanceSimulated(t);
      if (sim === null) {
        log("\n[dry-run] end of sequence" + (opts.noMerge ? "" : " — the runner would now run mergeGate and merge (ADR-067)"));
        return;
      }
      lastState = null;
      continue;
    }

    if (opts.gate === "plan" && t.state === "BACKLOG" && !opts.dryRun) {
      const why = await planGate(id);
      if (why) { writeStopped(runId, { ticket: id, stage: "PLAN", reason: why,
        decide: "You declined the plan. Amend `01-plan.md` or re-run `/plan`.",
        resume: `node scripts/run-loop.mjs auto ${id}` }); saveSessions(store); process.exit(2); }
    }
  }

  if (!reachedDone) {
  writeStopped(runId, { ticket: id, stage: "?",
    reason: `max steps reached (${opts.maxSteps})`,
    decide: "A ticket that needs more than this many steps is not converging. Read the run folder before raising the limit.",
    resume: `node scripts/run-loop.mjs auto ${id} --max-steps ${opts.maxSteps * 2}` });
  saveSessions(store);
  process.exit(2);
  }

  // --- ADR-067: merge, then the next ticket ---
  if (opts.noMerge) {
    report.tickets.push(`${id} — DONE, pull request left open (--no-merge)`);
    return;
  }
  const merged = await mergeTicket(id, runId, report);
  report.tickets.push(`${id} — merged ${merged.url} (${merged.gate})`);
  if (!opts.chain) return;

  const next = pickNext(allTickets(), t.group);
  if (!next) { log(`\n--chain: no ${t.group ?? "same-group"} ticket left whose depends_on are all DONE`); return; }
  log(`\n--chain: ${id} merged; next is ${next.id} (${next.state})`);
  id = next.id;
  report.ticketId = id;
  }
}

/** What a step must change for the runner to call it progress. Pure; see the loop above. */
function progressKey(t) {
  return [t.state, t.gates?.plan?.passed === true, t.gates?.review?.passed === true, t.rework_count ?? 0].join("|");
}

// --- Chain and merge (ADR-067) -----------------------------------------------------------------

const CHAIN_STATES = ["BACKLOG", "PLAN", "READY", "IN_PROGRESS", "REVIEW", "REWORK"];
const idNumber = (id) => Number(/-(\d+)/.exec(String(id))?.[1] ?? Infinity);

/**
 * The next ticket under --chain: same feature group, in a state the runner acts on, every
 * depends_on DONE, lowest number first. Pure — tests pass it a ticket list.
 */
function pickNext(tickets, group) {
  if (!group) return null;
  const state = new Map(tickets.map((x) => [String(x.id), x.state]));
  return tickets
    .filter((x) => x.group === group && CHAIN_STATES.includes(x.state))
    .filter((x) => (x.depends_on ?? []).every((d) => state.get(String(d)) === "DONE"))
    .sort((a, b) => idNumber(a.id) - idNumber(b.id) || String(a.id).localeCompare(String(b.id)))[0] ?? null;
}

const OK_CONCLUSIONS = ["SUCCESS", "SKIPPED", "NEUTRAL"];

/**
 * Reads `gh pr view --json statusCheckRollup`. Returns "none" (no check reported), "pending",
 * "pass" or "fail". A CheckRun carries status and conclusion; a StatusContext carries state. Pure.
 */
function checksVerdict(rollup) {
  const items = Array.isArray(rollup) ? rollup : [];
  if (!items.length) return "none";
  let pending = false;
  for (const c of items) {
    if (c.__typename === "StatusContext" || ("state" in c && !("status" in c))) {
      const st = String(c.state ?? "").toUpperCase();
      if (st === "PENDING" || st === "EXPECTED") pending = true;
      else if (st !== "SUCCESS") return "fail";
      continue;
    }
    if (String(c.status ?? "").toUpperCase() !== "COMPLETED") { pending = true; continue; }
    if (!OK_CONCLUSIONS.includes(String(c.conclusion ?? "").toUpperCase())) return "fail";
  }
  return pending ? "pending" : "pass";
}

function gh(...args) {
  const r = spawnSync("gh", args, { cwd: ROOT, encoding: "utf8", shell: false });
  if (r.status !== 0) throw new Error(`gh ${args.join(" ")} failed: ${(r.stderr || r.stdout || "").trim()}`);
  return (r.stdout || "").trim();
}

const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

/**
 * The project's own verify commands, the `typecheck`, `lint` and `test` scripts in `package.json`.
 * They run through each tool's own entry file under the current node, not through `pnpm`: on Windows
 * `pnpm` is a .cmd shim, which needs a shell, and the runner never spawns one (see the test).
 */
const LOCAL_GATE = [
  ["node_modules/typescript/bin/tsc", "--noEmit"],
  ["node_modules/eslint/bin/eslint.js", "."],
  ["node_modules/vitest/vitest.mjs", "run"],
];
const CHECKS_APPEAR_MS = 90_000;
const CHECKS_FINISH_MS = 60 * 60_000;
const POLL_MS = 15_000;

/**
 * ADR-067 decision 2. Every reported check is green, or, when none reports (verify.yml runs on
 * release/** only since 2026-10-17), the local gate exits 0 on the ticket branch.
 * Returns a one-line description of what passed, or throws with what failed.
 */
async function mergeGate(prNumber, runId) {
  const rollup = () => JSON.parse(gh("pr", "view", String(prNumber), "--json", "statusCheckRollup")).statusCheckRollup;
  let verdict = checksVerdict(rollup());
  const appearBy = Date.now() + CHECKS_APPEAR_MS;
  while (verdict === "none" && Date.now() < appearBy) { await sleep(POLL_MS); verdict = checksVerdict(rollup()); }
  const finishBy = Date.now() + CHECKS_FINISH_MS;
  while (verdict === "pending" && Date.now() < finishBy) { await sleep(POLL_MS); verdict = checksVerdict(rollup()); }

  if (verdict === "pass") return "every reported check green";
  if (verdict === "fail") throw new Error(`a check on #${prNumber} failed`);
  if (verdict === "pending") throw new Error(`checks on #${prNumber} still pending after ${CHECKS_FINISH_MS / 60_000} min`);

  log(`    no check reports on #${prNumber}; running the local gate`);
  const lines = [];
  for (const cmd of LOCAL_GATE) {
    const r = spawnSync(process.execPath, cmd, { cwd: ROOT, encoding: "utf8", shell: false,
                                                 maxBuffer: 64 * 1024 * 1024 });
    lines.push(`$ ${cmd.join(" ")}  -> exit ${r.status}`, (r.stdout ?? "").slice(-4000), (r.stderr ?? "").slice(-4000));
    fs.mkdirSync(runDir(runId), { recursive: true });
    fs.writeFileSync(path.join(runDir(runId), `merge-gate-${prNumber}.log`), lines.join("\n"));
    if (r.status !== 0) throw new Error(`local gate: \`${cmd.join(" ")}\` exited ${r.status}`);
  }
  return "no check reported; local typecheck, lint and unit exit 0";
}

/** After /ship: find the pull request, pass the gate, merge it with a merge commit. Stops the run on failure. */
async function mergeTicket(id, runId, report) {
  const branch = branchFor(id);
  try {
    const pr = JSON.parse(gh("pr", "view", branch, "--json", "number,url,state"));
    report.prUrl = pr.url;
    if (pr.state === "MERGED") return { url: pr.url, gate: "already merged" };
    if (pr.state !== "OPEN") throw new Error(`pull request ${pr.url} is ${pr.state}`);
    log(`\n[merge] ${pr.url} — merge gate`);
    const gate = await mergeGate(pr.number, runId);
    gh("pr", "merge", String(pr.number), "--merge");
    for (let i = 0; i < 20; i++) {
      const st = JSON.parse(gh("pr", "view", String(pr.number), "--json", "state")).state;
      if (st === "MERGED") break;
      await sleep(3000);
    }
    git("fetch", "origin", "--quiet");
    log(`    merged — ${gate}`);
    return { url: pr.url, gate };
  } catch (e) {
    const why = `merge stopped — ${e.message}`;
    report.stopped = why;
    report.resume = `node scripts/run-loop.mjs auto ${id}${report.chain ? " --chain" : ""}`;
    writeStopped(runId, { ticket: id, stage: "DONE -> merged", reason: why,
      decide: "The ticket is shipped and its pull request is open. Fix what failed on the branch, or merge it yourself. "
            + "Read merge-gate-*.log in this run folder for the local gate's output.",
      resume: report.resume });
    process.exit(2);
  }
}

// --- Entry point -------------------------------------------------------------------------------
//
// Guarded so the tests can import the decision functions without running a loop. Everything exported
// below is pure: it reads arguments and returns a verdict. The two impure things in this file —
// `invoke` and `git` — are deliberately not exported, because a test that can call them is a test
// that can spawn `claude` by accident.

const invokedDirectly = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (invokedDirectly) main().catch((e) => die(e.stack ?? String(e), 4));

export { nextStep, advanceSimulated, sessionFor, reviewStop, questionStop, budgetStop,
         readQuestions,
         shipPermissionStop, pickNext, checksVerdict, progressKey,
         inAllowedPaths, validateEntry, buildArgv, parseArgv, SESSION_POLICY, TICKET_ID };
