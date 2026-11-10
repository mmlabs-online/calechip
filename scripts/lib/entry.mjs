// Stage B of the unattended runner — how a run is entered, and what it reports afterwards.
// ADR-037. Split out of `run-loop.mjs` because entry resolution is the part with the most rules per
// line and the fewest side effects, and it is worth being able to test without a loop around it.
//
// Everything here is pure or takes its dependencies as arguments. Nothing in this file spawns a
// process; `run-loop.mjs` owns that.

import fs from "node:fs";
import path from "node:path";

export const ROOT = path.resolve(import.meta.dirname, "..", "..");
export const IDEAS_DIR = path.join(ROOT, ".ai", "board", "ideas");
export const TRACKER = path.join(ROOT, ".ai", "registry", "tracker.yaml");

// Lowered from 7 on 2026-09-22, at the operator's request. The number is the weaker of the two
// levers and it is here for completeness: a cap TRUNCATES, so the question it removes is as valid
// as the ones it keeps and simply becomes a silent assumption instead. The lever that actually
// works is the bar in `prompts.mjs` — ask only what BLOCKS the plan — because that removes
// questions by answering them rather than by hiding them.
export const MAX_INTAKE_QUESTIONS = 4;
export const AUTO_PROCEED_VERDICTS = ["PROMOTE"];      // REJECT and NEEDS-ADR always stop
export const ON_OPEN_QUESTIONS_AFTER_PLAN = "stop";    // layout-only entries never stop a run
export const ON_SPLIT = "stop";

// --- Tracker -------------------------------------------------------------------------------------

/** `tracker.yaml` nests two levels, so the ticket reader is not reused for it. */
export function parseTrackerYaml(text) {
  const out = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.split("#")[0].trimEnd();
    if (!line.trim() || /^\s/.test(line)) continue;
    const i = line.indexOf(":");
    if (i === -1) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (v === "") continue;
    out[k] = v.startsWith("[")
      ? v.slice(1, -1).split(",").map((s) => s.trim()).filter(Boolean)
      : v.replace(/^["']|["']$/g, "");
  }
  return out;
}

/** "Is a tracker configured at all" — not "may this call go through", which is the hook's job. */
export function trackerConfigured(file = TRACKER) {
  if (!fs.existsSync(file)) return false;
  try {
    const y = parseTrackerYaml(fs.readFileSync(file, "utf8"));
    return Boolean(y.provider) && Array.isArray(y.allowed_list_ids) && y.allowed_list_ids.length > 0;
  } catch {
    return false;
  }
}

/**
 * Tracker entry is refused, and the refusal is a finding rather than a gap in the runner.
 *
 * Two independent blockers, both on disk. `.ai/registry/tracker.yaml` ships with
 * `allowed_list_ids: []`, and RULE-18 reads that as BLOCK EVERY CALL rather than as no restriction —
 * the file says so in its own header. And a pulled ticket has no path to `feature_ids`:
 * `/pull-tickets` writes only `tracker.raw_description`, RULE-17 makes that third-party data rather
 * than a specification, and ADR-007 issues IDs at TRIAGE. Without Definition of Ready item 1 the
 * ticket cannot reach READY, and issuing an ID here is the invention the charter forbids.
 */
export function trackerEntry(id, configured = trackerConfigured()) {
  const lines = [`tracker entry for \`${id}\` is not installed, for reasons that are on disk:`];
  if (!configured) {
    lines.push("  - .ai/registry/tracker.yaml has no provider and an empty allowed_list_ids, which");
    lines.push("    RULE-18 reads as BLOCK EVERY CALL rather than as no restriction.");
  }
  lines.push("  - a pulled ticket has no path to feature_ids: /pull-tickets writes only");
  lines.push("    tracker.raw_description, and ADR-007 issues IDs at TRIAGE, not at intake. Without");
  lines.push("    Definition of Ready item 1 the ticket cannot reach READY.");
  lines.push("");
  lines.push("Put the tracker description through triage as an idea instead:");
  lines.push('    node scripts/run-loop.mjs auto --idea "<the description>"');
  return { error: lines.join("\n") };
}

// --- Resolution ----------------------------------------------------------------------------------
//
// Deterministic, in a fixed order. The order matters more than any single rule in it: a string that
// looks like a ticket id but names no ticket is an ERROR, never a fall-through to "treat it as an
// idea". Falling through would turn one mistyped character into an idea file, a feature row and a
// ticket — three board and registry writes from a typo, discovered at the pull request.

const TRACKER_URL = /(?:^|\/)(?:t|task)\/([A-Za-z0-9_-]{6,})\/?$|^#([A-Za-z0-9]{6,})$/;
const TICKET_ID = /^[A-Z]{2,4}-\d{1,3}[a-z]?$/;

// A near miss at a ticket id: letters, dash, digits, then anything, in one token. Loose on
// purpose — see step 5. `CAL-11ư`, `cal-11`, `CAL-11x` and `ADR-040` all match, and all of
// them are better answered with an error than with a new idea file.
const TICKET_ID_NEAR = /^[A-Za-z]{2,4}-\d{1,3}\S*$/;

/**
 * @param {string|null} input   what the operator typed after `auto`
 * @param {object} opts         parsed CLI options; `opts.forced` is set by an explicit flag
 * @param {object} deps         { ticketFileExists, ideasDir?, trackerIsConfigured? }
 */
export function resolveInput(input, opts, deps) {
  const { ticketFileExists, ideasDir = IDEAS_DIR, trackerIsConfigured = trackerConfigured } = deps;

  // 1. An explicit flag wins and skips detection entirely.
  if (opts.forced) {
    const { kind, value } = opts.forced;
    if (kind === "ticket") {
      return ticketFileExists(value)
        ? { kind: "ticket", id: value, how: "--ticket" }
        : { error: `--ticket ${value}: no ticket.yaml on disk` };
    }
    if (kind === "idea-file") {
      return fs.existsSync(value)
        ? { kind: "idea", file: path.resolve(value), how: "--idea-file" }
        : { error: `--idea-file ${value}: not found` };
    }
    if (kind === "idea-text") return { kind: "intake", text: value, how: "--idea" };
    if (kind === "tracker") return trackerEntry(value, trackerIsConfigured());
  }

  // 2. Nothing at all: ask the orchestrator what is next.
  if (input === null || input === "") return { kind: "next", how: "no input" };

  // 3. A path that exists under .ai/board/ideas/.
  const asPath = path.resolve(ROOT, input);
  if (asPath.startsWith(ideasDir) && fs.existsSync(asPath)) {
    return { kind: "idea", file: asPath, how: "a path under .ai/board/ideas/" };
  }

  // 4. A ticket id that resolves to a ticket wins over everything below it.
  if (TICKET_ID.test(input) && ticketFileExists(input)) {
    return { kind: "ticket", id: input, how: "a ticket id" };
  }

  // 4b. A bare name that names an idea file. `/idea` writes
  // `.ai/board/ideas/<yyyy-mm-dd>-<slug>.md`, and nobody wants to type that, so any unambiguous
  // fragment of it resolves — the id it was filed under, a word from the slug, the whole filename.
  //
  // Restricted to a single token with no whitespace, so that a sentence cannot match a file by
  // accident and silently re-run a triage the operator meant to start fresh.
  if (!/\s/.test(input)) {
    const hit = matchIdeaFile(input, ideasDir);
    if (hit.file) return { kind: "idea", file: hit.file, how: `the idea file ${path.basename(hit.file)}` };
    if (hit.error) return { error: hit.error };
  }

  // 5. A ticket id that named neither a ticket nor an idea is an error. Never a fall-through:
  // falling through would turn one mistyped character into a new idea, a feature row and a ticket.
  //
  // **`TICKET_ID` is ASCII-only, and for two days that made this guard miss the case it exists
  // for.** `CAL-11ư` — one stray Vietnamese character, the easiest typo to make on this keyboard —
  // does not match `[a-z]` in `TICKET_ID`, so it walked past this line and reached step 7 as free
  // text: a new idea, whose PROMOTE writes a feature row and a ticket. Exactly the outcome the
  // paragraph above forbids, produced by the guard being narrower than the mistake.
  //
  // `TICKET_ID_NEAR` is therefore deliberately loose: anything shaped like *letters, dash, digits*
  // in a single token is treated as an attempt at a ticket id. It is checked after step 4b, so a
  // real ticket and a real idea file both still win. **A false positive here costs one explicit
  // `--idea` flag; a false negative costs three board and registry writes from a typo.**
  if (TICKET_ID.test(input) || TICKET_ID_NEAR.test(input)) {
    const near = !TICKET_ID.test(input);
    return {
      error: `${input} looks like a ticket id${near ? " with a typo in it" : ""}, but no ticket.yaml `
        + `and no idea file matches it.\n`
        + (near ? `Check the id first — a near miss is not treated as new work.\n` : "")
        + `If you really meant a new idea, say so explicitly: --idea "${input}"`,
    };
  }

  // 6. A tracker id or URL.
  const m = TRACKER_URL.exec(input.trim());
  if (m) return trackerEntry(m[1] ?? m[2], trackerIsConfigured());

  // 7. Anything else is a free-text idea.
  return { kind: "intake", text: input, how: "free text" };
}

/**
 * Find one idea file from a fragment of its name. Returns { file } or { error } or {}.
 * Ambiguity is an error rather than a first-match, because the wrong idea file runs the wrong
 * triage and the operator finds out at the pull request.
 */
export function matchIdeaFile(name, ideasDir = IDEAS_DIR) {
  if (!fs.existsSync(ideasDir)) return {};
  const needle = name.toLowerCase().replace(/\.md$/, "");
  const all = fs.readdirSync(ideasDir).filter((f) => f.endsWith(".md"));

  const exact = all.filter((f) => f.toLowerCase().replace(/\.md$/, "") === needle);
  const hits = exact.length ? exact : all.filter((f) => f.toLowerCase().includes(needle));

  if (hits.length === 1) return { file: path.join(ideasDir, hits[0]) };
  if (hits.length > 1) {
    return { error: [
      `"${name}" matches ${hits.length} idea files. Name one of them:`,
      ...hits.map((f) => "    " + f),
    ].join("\n") };
  }
  return {};
}

// --- The verdict, read from disk -----------------------------------------------------------------

/**
 * Never parse the verdict out of reply text. Before ADR-037 there was nothing else to parse:
 * `gate:` is `PASS` on every idea file in `.ai/board/ideas/` including the one that was REJECTed,
 * `next_state` is `TRIAGE` on some promoted ideas and `BACKLOG` on others, and the verdict itself
 * lives in a free-form heading with at least eight shapes on disk. Two files carry two verdicts and
 * only one of them says which is live, in bold prose.
 */
export function readVerdict(file, readFrontMatter) {
  const fm = readFrontMatter(file);
  const rel = path.relative(ROOT, file);
  if (!fm) return { error: `${rel} has no front-matter` };
  // TRIAGE is told to BLOCK rather than guess (prompts.mjs). A blocked file carries no verdict, and
  // reporting it as "the pre-ADR-037 shape" would send the operator after the wrong problem.
  // Only when there is no verdict: a re-triage that PROMOTEs may leave a stale gate behind it.
  if (!fm.verdict && String(fm.gate ?? "").toUpperCase() === "BLOCKED") {
    return {
      error: [
        `TRIAGE blocked on ${rel}: ${fm.blocking_reason || "(no blocking_reason given)"}`,
        "",
        "Answer it in the idea file — under its Open questions, in your own words — or run `/idea`",
        "again on it. Then run this idea file again: a file with no verdict is triaged afresh.",
      ].join("\n"),
    };
  }
  if (!fm.verdict) {
    return {
      error: [
        `${rel} has no \`verdict\` in its front-matter.`,
        "TRIAGE ran but wrote the verdict only as a heading, which is the pre-ADR-037 shape and",
        "cannot be routed on — `gate:` is PASS on every idea file, including rejected ones.",
        "Read the file and decide by hand, or re-run /triage.",
      ].join("\n"),
    };
  }
  return {
    verdict: String(fm.verdict).toUpperCase(),
    reason: fm.verdict_reason ?? "",
    ticketId: fm.ticket_id || null,
  };
}

// --- NEEDS-ADR, and the way out of it ------------------------------------------------------------
//
// **A stop has to name an exit the runner can see.** Before 2026-09-22 NEEDS-ADR told the operator
// to "accept the ADR, then run this idea file again" — and the runner skipped TRIAGE on any file
// that already carried a verdict, so the second run read the same stale NEEDS-ADR and stopped with
// the same words, for ever. Accepting the ADR changed nothing the runner looked at. The exit is now
// the ADR's own `## Status` line: once every ADR the verdict waits on has left `PROPOSED`, the run
// re-triages, and the new verdict is the live one.

export const TICKETS_DIR = path.join(ROOT, ".ai", "board", "tickets");

export const DECISIONS_DIR = path.join(ROOT, ".ai", "registry", "decisions");

/** A status a person or an agent has decided. `PROPOSED` is the only undecided one. */
const DECIDED_STATUS = /^(ACCEPTED|REJECTED|WITHDRAWN|SUPERSEDED)\b/i;

/**
 * The ADRs a NEEDS-ADR verdict waits on. `awaiting_adrs` in the front-matter is the field; an idea
 * file triaged before that field existed names them only in `verdict_reason`, which is on-disk
 * front-matter written by TRIAGE (not reply text), so the IDs are read from there as a fallback.
 */
export function awaitedAdrs(fm) {
  const raw = fm?.awaiting_adrs;
  const listed = Array.isArray(raw) ? raw.join(" ") : typeof raw === "string" ? raw : "";
  const source = /ADR-\d{3}/.test(listed) ? listed : String(fm?.verdict_reason ?? "");
  return [...new Set(source.match(/ADR-\d{3}/g) ?? [])];
}

/**
 * Read one ADR's status: the first backticked token on the first non-empty line under `## Status`,
 * which is the shape every ADR in `.ai/registry/decisions/` uses. Returns
 * `{ id, file, status, problem }`; `problem` is set when the runner cannot tell.
 */
export function adrStatus(id, decisionsDir = DECISIONS_DIR) {
  const names = fs.existsSync(decisionsDir)
    ? fs.readdirSync(decisionsDir).filter((f) => f === `${id}.md` || f.startsWith(`${id}-`))
    : [];
  if (names.length === 0) return { id, file: null, status: null, problem: "no file in .ai/registry/decisions/" };
  if (names.length > 1) {
    return { id, file: null, status: null, problem: `${names.length} files carry this number: ${names.join(", ")}` };
  }
  const abs = path.join(decisionsDir, names[0]);
  const file = path.relative(ROOT, abs).split(path.sep).join("/");
  const text = fs.readFileSync(abs, "utf8");
  const section = /^##[ \t]*Status[ \t]*\r?\n([\s\S]*?)(?=^##[ \t]|(?![\s\S]))/m.exec(text);
  const first = section ? section[1].split(/\r?\n/).find((l) => l.trim()) ?? "" : "";
  const tick = /`([^`]+)`/.exec(first);
  if (!tick) return { id, file, status: null, problem: "no backticked status under `## Status`" };
  return { id, file, status: tick[1].trim(), problem: null };
}

/** True when there is at least one awaited ADR and none of them is still undecided. */
export function adrsSettled(statuses) {
  return statuses.length > 0 && statuses.every((s) => s.status && DECIDED_STATUS.test(s.status));
}

/**
 * PROMOTE proceeds; REJECT and NEEDS-ADR always stop, with the reason TRIAGE gave.
 * `adrs` is the output of `adrStatus` for each awaited ADR, read AFTER any re-triage.
 */
export function verdictStop(v, adrs = []) {
  if (AUTO_PROCEED_VERDICTS.includes(v.verdict)) return null;
  if (v.verdict === "REJECT") {
    return `TRIAGE returned REJECT: ${v.reason || "(no reason given, which is itself a gate failure)"}`;
  }
  if (v.verdict === "NEEDS-ADR") {
    const lines = [
      `TRIAGE returned NEEDS-ADR: ${v.reason || "(no reason given)"}`,
      "",
      "The ADR should already be drafted — /triage writes it rather than handing you homework.",
    ];
    if (adrs.length === 0) {
      lines.push(
        "The verdict names no ADR — neither `awaiting_adrs` nor `verdict_reason` carries an ADR-nnn —",
        "so the runner cannot tell when it has been decided. Run `/triage <this idea file>` in a new",
        "`product` session instead.",
      );
      return lines.join("\n");
    }
    if (adrsSettled(adrs)) {
      lines.push(
        "Every ADR it waits on is already decided, and TRIAGE still returned NEEDS-ADR after reading",
        "them. That is not a status to flip; read verdict_reason and the idea file's Open questions.",
      );
    } else {
      lines.push("Waiting on these ADRs. The runner re-triages by itself once none of them is PROPOSED:");
    }
    for (const a of adrs) {
      lines.push(`  - ${a.id}  ${a.file ?? "(not found)"}  — status: ${a.status ? "`" + a.status + "`" : a.problem}`);
    }
    return lines.join("\n");
  }
  return `TRIAGE returned an unrecognised verdict \`${v.verdict}\``;
}

/** The "what you must decide" text for a NEEDS-ADR stop. Exact edit, exact file, exact command. */
export function needsAdrDecision(adrs, resumeCommand) {
  const pending = adrs.filter((a) => !(a.status && DECIDED_STATUS.test(a.status)));
  if (adrs.length === 0 || pending.length === 0) {
    return `Read the idea file's verdict and Open questions; then \`${resumeCommand}\`.`;
  }
  return [
    "Read each ADR below. In its `## Status` section, replace the backticked `PROPOSED` with your",
    "decision — `ACCEPTED by the operator`, or `REJECTED by the operator` — and keep the date line.",
    "Amend the body first if it records your decision wrongly. Only you may write that signature:",
    "an agent that wrote it for you would be forging it (`.ai/steward/context.md`, Autonomy).",
    "",
    ...pending.map((a) => `  - ${a.file ?? a.id + " (" + a.problem + ")"}`),
    "",
    `Then run \`${resumeCommand}\`. The runner reads those status lines, sees them decided, and`,
    "re-triages the idea; the new verdict replaces this one. Nothing else needs editing.",
  ].join("\n");
}

// --- Checks after PLAN, before READY -------------------------------------------------------------

// The layout carve-out (CLAUDE.md, 2026-09-04) makes the visual arrangement of a screen
// `tech-lead-design`'s to originate, so a layout question blocks nobody. Everything else does.
// A tie goes to blocking: an entry this cannot classify is treated as needing a person.
const LAYOUT_ONLY = /\b(layout|arrangement|spacing|colou?r|placement|position|visual|density|icon|typography|label text)\b/i;
const BLOCKING_TOPIC = /\b(permission|role|admin|member|invariant|INV-\d+|behaviou?r|approve|reject|schema|RLS|policy|scope|quota|threshold)\b/i;

// Under the `m` flag `$` means end of LINE, so the section has to end at the next heading or at end
// of input written as a negative lookahead. Writing `|$` there matches immediately and yields an
// empty section, which reads as "no open questions" — a failure that passes.
const OPEN_QUESTIONS_SECTION = /^#{1,3}[ \t]*OPEN QUESTIONS[ \t]*$([\s\S]*?)(?=^#{1,3}[ \t]|(?![\s\S]))/mi;

/** Returns a stop reason, or null. `planText` is the content of `01-plan.md`. */
export function openQuestionsStop(planText) {
  if (!planText) return null;
  const m = OPEN_QUESTIONS_SECTION.exec(planText);
  if (!m) return null;

  const entries = m[1].split(/\n(?=[ \t]*(?:[-*]|\d+\.)[ \t])/).map((s) => s.trim()).filter(Boolean);
  const blocking = entries.filter((e) => BLOCKING_TOPIC.test(e) || !LAYOUT_ONLY.test(e));
  if (!blocking.length || ON_OPEN_QUESTIONS_AFTER_PLAN !== "stop") return null;

  const n = blocking.length;
  return [
    `01-plan.md carries ${n} OPEN QUESTIONS entr${n > 1 ? "ies" : "y"} touching behaviour, permissions or an invariant:`,
    "",
    ...blocking.map((e) => "  " + e.replace(/\s+/g, " ").slice(0, 300)),
    "",
    "A question here blocks; an assumption here ships (.ai/templates/plan.md).",
  ].join("\n");
}

/** `L` splits at PLAN and `XL` escalates — `.ai/01-operating-model.md` § Sizing. */
export function sizeStop(ticket) {
  const size = String(ticket.size ?? "").toUpperCase();
  if (size === "XL") {
    return "size is XL — the operating model escalates it rather than splitting it. A human decides.";
  }
  if (size === "L" && ON_SPLIT === "stop") {
    return [
      "size is L, which must split at PLAN.",
      "The children are the Tech Lead's to enumerate in 01-plan.md; the runner does not start them.",
      "MAX_TICKETS_PER_RUN is 1 and stays 1 until the stacking question in ADR-036 is decided.",
    ].join("\n");
  }
  return null;
}

// --- The run report ------------------------------------------------------------------------------

/**
 * `/triage` writes `.ai/board/ideas/**` and any ADR it drafts, and `/ship`'s ship set contains
 * neither — it is `allowed_paths` plus the ticket folder plus three named ship-owned paths
 * (ADR-023). Those files are therefore structurally orphaned: committed by nothing, landed by
 * nobody.
 *
 * Not hypothetical. MD-031 records UIE-08 shipping while citing an ADR and an idea file that exist
 * on no ref. The runner cannot fix it, because it never commits. It names them instead, every run.
 */
export function orphanPaths(dirtyPaths) {
  return dirtyPaths.filter(
    (p) => p.startsWith(".ai/board/ideas/") || p.startsWith(".ai/registry/decisions/")
  );
}

// --- The working tree, read exactly --------------------------------------------------------------

/**
 * Parse `git status --porcelain=v1 -z --untracked-files=all` into repo-relative paths.
 *
 * **Why `-z` and not the line form.** The line form was read with `.trim()` on the whole stdout
 * and then `line.slice(3)`. The first entry of a porcelain listing is ` M <path>` — its status
 * column is a space — so the trim ate it and `slice(3)` ate the path's first character instead:
 * run 20260922-142836-510fe05c reported `ai/board/backlog.md`. The line form also quotes paths with
 * unusual characters and joins a rename as `old -> new`. `-z` does neither: entries are
 * NUL-terminated, paths are raw, and a rename is `XY new\0old\0`. Both sides of a rename are
 * returned, because both are changes to the tree.
 *
 * `--untracked-files=all` because the default collapses a new directory to `dir/`, and a check on
 * which files a new ticket folder holds cannot be made against a directory name.
 */
export function parsePorcelainZ(out) {
  const tok = String(out ?? "").split("\0");
  const paths = [];
  for (let i = 0; i < tok.length; i++) {
    const e = tok[i];
    if (e.length < 4) continue;                 // the trailing empty token, or garbage
    const xy = e.slice(0, 2);
    paths.push(e.slice(3));
    if (/[RC]/.test(xy)) {                      // the original path follows as its own token
      const from = tok[++i];
      if (from) paths.push(from);
    }
  }
  return paths;
}

// --- WIP -------------------------------------------------------------------------------------------

/**
 * The states in which a ticket is *in flight* — it holds the one working tree (ADR-006).
 *
 * `.ai/01-operating-model.md`'s dispatch loop counts `state in PLAN..REVIEW`; REWORK sits after
 * REVIEW in the enum and is plainly mid-loop, and ESCALATED is halted with its work still in the tree
 * and on its branch until a human decides. TRIAGE and BACKLOG have not started — nothing of theirs is
 * on a branch — and DONE has finished. **A PROMOTE that splits one idea into two tickets leaves the
 * second at BACKLOG; counting it blocked the first ticket on its own sibling** (run
 * 20260922-142836-510fe05c: "WIP: CAL-12=BACKLOG is not terminal").
 */
export const IN_FLIGHT_STATES = ["PLAN", "READY", "IN_PROGRESS", "REVIEW", "REWORK", "ESCALATED"];
const NOT_IN_FLIGHT = ["TRIAGE", "BACKLOG", "DONE"];

/** Written as the complement so that a state it cannot read (`UNPARSEABLE`, a typo) still blocks. */
export function wipBlockers(tickets, selfId) {
  return tickets.filter((o) => o.id !== selfId && !NOT_IN_FLIGHT.includes(o.state));
}

// --- What may ride onto a new ticket branch ---------------------------------------------------------

/** ADR-023. Must equal `SHIP_OWNED` in `scripts/check-allowed-paths.mjs` — a test asserts it. */
export const SHIP_OWNED = [".ai/board/backlog.md", ".ai/board/metrics.md", ".ai/registry/features.md"];

const cites = (text, needle) => Boolean(needle) && String(text ?? "").includes(needle);
const citesAdr = (text, id) => new RegExp(`\\b${id}\\b`).test(String(text ?? ""));

/**
 * The ticket IDs an idea file's front-matter `ticket_id` names.
 *
 * `.ai/templates/idea.md` describes one ID, and a PROMOTE that splits into two rows writes both in
 * one string — `ticket_id: "EVT-04, EVT-05"` and `"EVT-06, EVT-07"` are on disk. Compared whole,
 * that string matched neither ticket, so the second ticket of a split never recognised the idea that
 * promoted it. A list value is accepted too.
 */
export function ideaTicketIds(fm) {
  return [].concat(fm?.ticket_id ?? [])
    .flatMap((v) => String(v).split(","))
    .map((s) => s.trim().replace(/^["']|["']$/g, "").trim())
    .filter(Boolean);
}

/**
 * **The one definition of "the idea that promoted this ticket"**: its front-matter `ticket_id`
 * names the ticket, or the ticket's `ticket.yaml` cites the idea's path. `idea` is `{ path, fm }`.
 *
 * Two readers, one predicate. `planCarry` uses it to carry the idea file while it is uncommitted;
 * `scripts/check-allowed-paths.mjs` uses it to exempt the idea file once it is committed on the
 * ticket branch (ADR-054). A second, hand-written copy would be a second answer to "is this the
 * ticket's own idea" — the defect ADR-043 exists to close.
 */
export function isOwnIdea(idea, id, ticketText) {
  return ideaTicketIds(idea?.fm).includes(id) || cites(ticketText, idea?.path);
}

/**
 * Sort the dirty tree, before `/plan` cuts `feat/<id>`, into what may ride onto the new branch and
 * what stops it. **The rule is: this ticket's own triage output, and nothing else.** `/plan` step 0
 * states the same rule in prose; this is the runner's copy, and the two must agree.
 *
 * A PROMOTE cannot leave a clean tree — agents commit only at `/ship` (ADR-023), so the output of
 * `/triage` is dirty when `/plan` runs, by construction. Stopping on it made every fresh PROMOTE
 * self-blocking. What is carried, each derived from a file on disk rather than from a category:
 *
 *   - `.ai/board/tickets/<id>/**` and `allowed_paths` — this ticket's own ship set
 *   - the three ship-owned paths — they ride on the ticket branch by ADR-023 and `/ship` commits them
 *   - an idea file whose front-matter `ticket_id` names this ticket, or whose path this ticket's
 *     `ticket.yaml` cites — the file that promoted it (`isOwnIdea`, which the committed half of R1
 *     shares since ADR-054)
 *   - an ADR whose ID this ticket's `ticket.yaml`, or that idea's `verdict_reason` / `awaiting_adrs`,
 *     cites — the decisions the verdict waited on
 *   - a sibling ticket folder promoted by the same idea (its `ticket.yaml` cites the idea's path),
 *     at BACKLOG, holding nothing but `ticket.yaml` — a second row of the same PROMOTE, not started
 *
 * **Everything else is stray**: model, tooling, standards, other ideas, uncited ADRs, a sibling that
 * has any artifact beyond `ticket.yaml`. Carrying is not committing: `/ship`'s ship set is unchanged,
 * so the idea file, the ADRs and the sibling folder are still left dirty at `/ship` — orphans that
 * `orphanPaths` names in every report.
 *
 * ctx: { id, allowedPaths, ticketText, ideas: [{ path, fm }], siblings: [{ id, state, ticketText }],
 *        inAllowedPaths(p, globs) }
 */
/** Glob-lite: `**` matches any depth, `*` matches within one segment. */
export function inAllowedPaths(p, globs) {
  return (globs ?? []).some((g) => {
    const rx = new RegExp("^" + String(g)
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*\*/g, "￿")
      .replace(/\*/g, "[^/]*")
      .replace(/￿/g, ".*") + "$");
    return rx.test(p);
  });
}

/**
 * Everything `planCarry` needs, read from disk. Only dirty idea files and dirty sibling tickets.
 *
 * **Lives here rather than in `run-loop.mjs` since ADR-043**, because it now has two callers: the
 * runner's preflight and `scripts/check-carry.mjs`, which is what review check R1 runs. A second
 * copy of this context builder would be a second answer to "is this path carried", which is the
 * exact defect ADR-043 exists to close.
 *
 * deps: { readFrontMatter, readTicket, ticketsDir?, ideasDir? }
 */
export function carryContext(t, dirty, deps) {
  const { readFrontMatter, readTicket, ticketsDir = TICKETS_DIR, ideasDir = IDEAS_DIR } = deps;
  const ticketFile = (id) => path.join(ticketsDir, id, "ticket.yaml");

  // Every idea file, committed or not: the promoting idea is usually committed by the time its
  // second ticket runs, and it is still what makes a sibling's ticket.yaml carryable.
  const onDisk = fs.existsSync(ideasDir)
    ? fs.readdirSync(ideasDir).filter((f) => f.endsWith(".md")).map((f) => `.ai/board/ideas/${f}`)
    : [];
  const ideaPaths = [...new Set([...onDisk, ...dirty.filter((p) => /^\.ai\/board\/ideas\/[^/]+\.md$/.test(p))])];
  // Resolve against `ideasDir`, not `ROOT`. Every idea path is `.ai/board/ideas/<file>`, so the
  // basename is the whole of the difference, and the two agree in a real run. They did not agree
  // under an injected directory, which listed one file and read another — found by the first test
  // that injected one (ADR-043).
  const ideas = ideaPaths.map((p) => {
    try { return { path: p, fm: readFrontMatter(path.join(ideasDir, path.basename(p))) ?? {} }; }
    catch { return { path: p, fm: {} }; }
  });
  const siblingIds = [...new Set(dirty.map((p) => /^\.ai\/board\/tickets\/([^/]+)\//.exec(p)?.[1])
    .filter((x) => x && x !== t.id))];
  const siblings = siblingIds.filter((x) => fs.existsSync(ticketFile(x))).map((x) => {
    try { return { id: x, state: readTicket(ticketFile(x)).state, ticketText: fs.readFileSync(ticketFile(x), "utf8") }; }
    catch { return { id: x, state: null, ticketText: "" }; }
  });
  const ticketText = fs.existsSync(ticketFile(t.id)) ? fs.readFileSync(ticketFile(t.id), "utf8") : "";
  return { id: t.id, allowedPaths: t.allowed_paths ?? [], ticketText, ideas, siblings, inAllowedPaths };
}

/**
 * Split a stray list into work that exists on no ref and work whose content is already on `main`.
 *
 * **Both halves are stray and `planCarry` is right about both.** They are different problems: the
 * first is unmerged work and deleting it loses it; the second is a tree a steward session left dirty
 * after pushing to `ops/<slug>`, or a ticket branch behind `origin/main`, and the fix is to restore
 * rather than to land. A reviewer told only "stray" reaches for the wrong one — which is what
 * happened to CAL-11 twice, the second time to ADR-043's own landing.
 *
 * `isLanded` is a predicate so this stays pure; the CLI supplies the `git ls-tree` / `git
 * hash-object` comparison.
 */
export function splitStrayByLanded(stray, isLanded) {
  const landed = [];
  const real = [];
  for (const p of stray) (isLanded(p) ? landed : real).push(p);
  return { landed, real };
}

export function planCarry(dirty, ctx) {
  const own = `.ai/board/tickets/${ctx.id}/`;
  const provenance = (ctx.ideas ?? []).filter((i) => isOwnIdea(i, ctx.id, ctx.ticketText));
  const adrText = [ctx.ticketText, ...provenance.map((i) =>
    `${i.fm?.verdict_reason ?? ""} ${[].concat(i.fm?.awaiting_adrs ?? []).join(" ")}`)].join("\n");

  const siblingOf = (p) => {
    const m = /^\.ai\/board\/tickets\/([^/]+)\/(.+)$/.exec(p);
    return m ? { id: m[1], rest: m[2] } : null;
  };
  const siblingOk = (sid) => {
    const s = (ctx.siblings ?? []).find((x) => x.id === sid);
    if (!s || s.state !== "BACKLOG") return false;
    if (!provenance.some((i) => cites(s.ticketText, i.path))) return false;
    return dirty.filter((p) => p.startsWith(`.ai/board/tickets/${sid}/`))
      .every((p) => p === `.ai/board/tickets/${sid}/ticket.yaml`);
  };

  const carried = [];
  const stray = [];
  for (const p of dirty) {
    let why = null;
    if (p.startsWith(own)) why = "this ticket";
    else if (ctx.inAllowedPaths?.(p, ctx.allowedPaths ?? [])) why = "allowed_paths";
    else if (SHIP_OWNED.includes(p)) why = "ship-owned (ADR-023)";
    else if (provenance.some((i) => i.path === p)) why = "the idea that promoted it";
    else if (/^\.ai\/registry\/decisions\/ADR-\d{3}/.test(p) &&
             citesAdr(adrText, p.match(/ADR-\d{3}/)[0])) why = "an ADR its verdict cites";
    else {
      const s = siblingOf(p);
      if (s && s.id !== ctx.id && siblingOk(s.id)) why = `sibling ${s.id} from the same PROMOTE`;
    }
    (why ? carried : stray).push(why ? { path: p, why } : p);
  }
  return { carried, stray };
}

const bullets = (a) => (a && a.length ? a.map((x) => `- ${x}`).join("\n") : "_none_");

/** Written on every run, finished or stopped. */
export function renderReport(runId, r) {
  const qa = r.qa && r.qa.length
    ? r.qa.map((p) => `**Q.** ${p.question}\n\n**A.** ${p.answer || "_(not decided)_"}`).join("\n\n")
    : "_no intake questions were asked_";

  const fence = "```";
  const ending = r.stopped
    ? `## Stopped\n\n${r.stopped}\n\nTo resume:\n\n${fence}\n${r.resume ?? ""}\n${fence}`
    : "## Completed\n\nNothing is waiting on the runner.";

  const input = r.input === null || r.input === undefined
    ? "_(none — /next-ticket)_"
    : "`" + r.input + "`";

  return `# Run ${runId}

- **Finished:** ${r.finishedAt}
- **Input:** ${input}
- **Resolved as:** ${r.resolvedAs ?? "n/a"}
- **Ticket:** ${r.ticketId ?? "_none created_"}
- **Final state:** ${r.finalState ?? "n/a"}
- **Verdict:** ${r.verdict ?? "n/a"}${r.verdictReason ? " — " + r.verdictReason : ""}
- **Pull request:** ${r.prUrl ?? "_none opened_"}
- **Steps:** ${r.steps ?? 0} · **Rework cycles:** ${r.reworkCount ?? 0} · **Cost:** $${(r.cost ?? 0).toFixed(4)}

## Intake

${qa}

## Registry rows written in this run

These are in the working tree and **await your approval at the pull request** — RULE-01 puts
enforcement at CODEOWNERS review rather than at the write.

${bullets(r.registryWrites)}

## Layout originated under the carve-out

Visual arrangement \`tech-lead-design\` decided itself, with no image attached. Behaviour,
permissions and invariants are never covered by that carve-out.

${bullets(r.layoutDecisions)}

## Left dirty, and landed by nobody

\`/ship\` commits \`allowed_paths\`, the ticket folder and three named paths. Idea files and ADRs are
in none of those sets, so they stay in the working tree after the pull request is opened — see
MD-031, where a shipped ticket cited an ADR and an idea file that exist on no ref.

${bullets(r.orphanPaths)}

## Tickets in this run

One line per ticket the run drove. Under \`--chain\` the run takes the next ticket after each merge
(ADR-067).

${bullets(r.tickets)}

## Warnings

Commands a stage was denied, which did not stop the step (ADR-067 decision 6). A denial that
mattered shows up in the artifact as a \`TODO(verify)\`, or as a gate that did not pass.

${bullets(r.warnings)}

${ending}
`;
}
