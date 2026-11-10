// guard-allowed-paths.mjs — PreToolUse guard for RULE-03.
//
// Resolves the active ticket from the branch name (feat/<ID> -> .ai/board/tickets/<ID>/ticket.yaml)
// and blocks any Edit or Write whose target falls outside that ticket's allowed_paths.
//
// Two behaviours that are deliberate, not oversights:
//
//   1. Empty allowed_paths blocks everything outside the ticket folder — emphatically including
//      src/. Emptiness is a control, not an initial value: it means DESIGN has not finished, and
//      nothing should be written against a contract that does not exist yet.
//   2. Non-feat/ branches are allowed through. Bootstrap and chore work has no ticket, and a guard
//      that blocked it would block its own installation.
//   3. The ship-owned set is allowed through on any branch — ADR-023. `/ship` writes exactly those
//      three files outside allowed_paths and now carries them on the ticket branch, so a guard that
//      blocked them would block the only command permitted to write them.
//
// Fails closed everywhere else: a feat/ branch with no ticket.yaml, an unparseable payload, or an
// unresolvable root all block.
//
// No shebang, no shell. Invoked as: node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-allowed-paths.mjs"

import fs from "node:fs";
import path from "node:path";

const BLOCK = 2;

// ADR-023. Kept character-identical to SHIP_OWNED in scripts/check-allowed-paths.mjs — the hooks
// share no library on purpose, so the duplication is the cost of that isolation. Fixed and closed:
// a fourth path is an edit to both arrays plus an ADR, never a judgement made at ship time.
//
// Read by the exemption in the loop at the foot of this file. Matched with includes() on the exact
// repo-relative path: not a prefix, not a glob. ".ai/board/" is not exempt and ".ai/registry/" is
// not exempt, and neither is a ship-owned basename nested anywhere else.
//
// Not yet covered by .claude/hooks/tests/guard-allowed-paths.test.mjs — MD-022.
const SHIP_OWNED = [".ai/board/backlog.md", ".ai/board/metrics.md", ".ai/registry/features.md"];

function die(reason) {
  process.stderr.write(`guard-allowed-paths: BLOCKED — ${reason}\n`);
  process.exit(BLOCK);
}

// stdin is read asynchronously, with a deadline. A synchronous read of fd 0 can block indefinitely
// on some Windows pipe types, and a hook that hangs is worse than a hook that blocks: the tool call
// waits out the hook timeout, which is minutes, and the session stalls with no explanation. An async
// read keeps the event loop free, so the timer can always fire.
function readStdin(timeoutMs = 5000) {
  return new Promise((resolve, reject) => {
    let data = "";
    const timer = setTimeout(() => reject(new Error("timed out reading stdin")), timeoutMs);
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (chunk) => (data += chunk));
    process.stdin.on("end", () => {
      clearTimeout(timer);
      resolve(data);
    });
    process.stdin.on("error", (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

function projectRoot() {
  const fromEnv = process.env.CLAUDE_PROJECT_DIR;
  if (fromEnv && fs.existsSync(fromEnv)) return path.resolve(fromEnv);
  let dir = process.cwd();
  for (;;) {
    if (fs.existsSync(path.join(dir, ".git"))) return dir;
    const up = path.dirname(dir);
    if (up === dir) return null;
    dir = up;
  }
}

// Read the branch from .git/HEAD without spawning git. Handles the worktree/submodule case where
// .git is a file containing "gitdir: <path>".
function currentBranch(root) {
  let gitDir = path.join(root, ".git");
  try {
    const st = fs.statSync(gitDir);
    if (st.isFile()) {
      const m = /^gitdir:\s*(.+)$/m.exec(fs.readFileSync(gitDir, "utf8"));
      if (!m) return null;
      gitDir = path.resolve(root, m[1].trim());
    }
    const head = fs.readFileSync(path.join(gitDir, "HEAD"), "utf8").trim();
    const ref = /^ref:\s*refs\/heads\/(.+)$/.exec(head);
    return ref ? ref[1] : null; // detached HEAD -> null
  } catch {
    return null;
  }
}

function targetPaths(toolInput) {
  const out = [];
  const KEY = /(^|_)(file_?path|path|notebook_?path)$/i;
  const walk = (node, depth) => {
    if (depth > 4 || node === null || typeof node !== "object") return;
    for (const [k, v] of Object.entries(node)) {
      if (typeof v === "string" && KEY.test(k)) out.push(v);
      else if (typeof v === "object") walk(v, depth + 1);
    }
  };
  walk(toolInput, 0);
  return out;
}

function toRepoRelative(root, p) {
  const abs = path.isAbsolute(p) ? p : path.resolve(root, p);
  return path.relative(root, abs).split(path.sep).join("/");
}

// Strip a trailing ` # comment`. YAML semantics: `#` opens a comment only at line start or after
// whitespace, and never inside quotes. A copy of `stripComment` in scripts/lib/ticket-yaml.mjs — this
// hook imports nothing from scripts/ on purpose, so the copies must be kept in step by hand. Added
// 2026-10-20: without it `- "a/b.sql"   # why` became the glob `a/b.sql"   # why`, which matches
// nothing, and MIR-02's own allowed path was blocked.
function stripComment(s) {
  let out = "";
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      out += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; out += c; continue; }
    if (c === "#" && (i === 0 || /\s/.test(s[i - 1]))) break;
    out += c;
  }
  return out.trimEnd();
}

// Minimal YAML: read a top-level sequence, inline "[a, b]" or block "- a" form.
function readYamlList(text, key) {
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const m = new RegExp(`^${key}:\\s*(.*)$`).exec(stripComment(lines[i]));
    if (!m) continue;
    const inline = m[1].trim();
    if (inline.startsWith("[")) {
      const body = inline.slice(1, inline.lastIndexOf("]"));
      return body
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
    const out = [];
    for (let j = i + 1; j < lines.length; j++) {
      const line = stripComment(lines[j]);
      const item = /^\s*-\s*(.+?)\s*$/.exec(line);
      if (!item) {
        if (/^\s*$/.test(line)) continue;
        break;
      }
      out.push(item[1].replace(/^["']|["']$/g, ""));
    }
    return out;
  }
  return null;
}

// glob -> anchored RegExp. Supports **, *, ?. A pattern ending in "/" means the whole subtree.
function globToRegExp(glob) {
  let g = glob.trim();
  if (g.endsWith("/")) g += "**";
  let re = "";
  for (let i = 0; i < g.length; i++) {
    const c = g[i];
    if (c === "*") {
      if (g[i + 1] === "*") {
        if (g[i + 2] === "/") {
          re += "(?:.*/)?";
          i += 2;
        } else {
          re += ".*";
          i += 1;
        }
      } else {
        re += "[^/]*";
      }
    } else if (c === "?") re += "[^/]";
    else re += c.replace(/[.+^${}()|[\]\\]/g, "\\$&");
  }
  return new RegExp(`^${re}$`);
}

let payload;
try {
  payload = JSON.parse(await readStdin());
} catch (err) {
  die(`could not read tool input (${err.message}); failing closed`);
}

const root = projectRoot();
if (!root) die("could not resolve the project root; failing closed");

const branch = currentBranch(root);
if (!branch || !branch.startsWith("feat/")) process.exit(0); // no active ticket: chore work

const ticketId = branch.slice("feat/".length).split("/")[0];
const ticketDir = `.ai/board/tickets/${ticketId}`;
const ticketFile = path.join(root, ticketDir, "ticket.yaml");

if (!fs.existsSync(ticketFile)) {
  die(
    `branch ${branch} names ticket ${ticketId} but ${ticketDir}/ticket.yaml does not exist; ` +
      `failing closed`
  );
}

let allowed;
try {
  allowed = readYamlList(fs.readFileSync(ticketFile, "utf8"), "allowed_paths");
} catch (err) {
  die(`could not read ${ticketDir}/ticket.yaml (${err.message}); failing closed`);
}
if (allowed === null) die(`${ticketDir}/ticket.yaml has no allowed_paths key; failing closed`);

const matchers = allowed.map(globToRegExp);

for (const raw of targetPaths(payload.tool_input ?? {})) {
  const rel = toRepoRelative(root, raw);

  if (rel.startsWith("../")) die(`${raw} resolves outside the repository`);

  // The ticket's own folder is always writable: that is where the stage artifacts go.
  if (rel === ticketDir || rel.startsWith(`${ticketDir}/`)) continue;

  // The ship-owned set — ADR-023. Three names, matched exactly; no prefix, no glob.
  if (SHIP_OWNED.includes(rel)) continue;

  if (allowed.length === 0) {
    die(
      `${rel} is outside ticket ${ticketId} — allowed_paths is empty, which means DESIGN has not ` +
        `enumerated it yet (RULE-03). Nothing outside ${ticketDir}/ may be written.`
    );
  }

  if (!matchers.some((re) => re.test(rel))) {
    die(`${rel} is not in ticket ${ticketId} allowed_paths [${allowed.join(", ")}] (RULE-03)`);
  }
}

process.exit(0);
