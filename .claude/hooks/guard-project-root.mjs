// guard-project-root.mjs — PreToolUse guard for the outermost boundary.
//
// Blocks any Edit or Write whose target resolves outside the project root.
//
// Why this exists: during the Phase A run an agent created a file at D:\Servers\placeholder-unused.md
// from a mistaken path. It was disclosed and deleted, but no guard would have caught it.
// guard-registry only reasons about `.ai/registry/**` and guard-allowed-paths only about paths under
// the repo; both compute a repo-relative path and then test a prefix, so a target on another drive
// or above the root simply fails every prefix test and is allowed through. The two guards that look
// like they cover the filesystem cover only the inside of it.
//
// This runs first on Edit|Write, before either of them. Containment is the cheapest check and the
// one whose failure is least recoverable — a write outside the repo is invisible to `git status`,
// so nothing downstream will ever report it.
//
// Catches, in one rule: absolute paths elsewhere on the filesystem, a different Windows drive
// (path.relative returns an absolute path across drives), `../` traversal above the root, and
// home-relative targets after expansion.
//
// Fails closed: unreadable stdin, unparseable JSON, or an unresolvable project root all block.
//
// No shebang, no shell. Invoked as: node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-project-root.mjs"

import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const BLOCK = 2;

function die(reason) {
  process.stderr.write(`guard-project-root: BLOCKED — ${reason}\n`);
  process.exit(BLOCK);
}

// stdin is read asynchronously, with a deadline. A synchronous read of fd 0 can block indefinitely
// on some Windows pipe types, and a hook that hangs is worse than a hook that blocks: the tool call
// waits out the hook timeout, which is minutes, and the session stalls with no explanation.
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

// Every string value under a key that looks like a filesystem target. Same walker as the other
// guards, deliberately duplicated: the hooks share no library, so a mistake in one cannot disable
// the others.
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

function expandHome(p) {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/") || p.startsWith("~\\")) return path.join(os.homedir(), p.slice(2));
  return p;
}

// The real path of the nearest ancestor that exists, with the not-yet-created remainder re-appended.
// Without this, a symlinked root and a symlinked target compare unequal and every write is blocked:
// on macOS os.tmpdir() is /var/folders/..., whose real path is /private/var/folders/....
function realish(p) {
  let head = p;
  const tail = [];
  for (;;) {
    if (fs.existsSync(head)) {
      try {
        return path.join(fs.realpathSync(head), ...tail);
      } catch {
        return p;
      }
    }
    const up = path.dirname(head);
    if (up === head) return p;
    tail.unshift(path.basename(head));
    head = up;
  }
}

function isInside(root, abs) {
  const rel = path.relative(root, abs);
  // "" is the root itself. A rel that climbs (`..`) or is absolute (a different Windows drive) is out.
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

let payload;
try {
  payload = JSON.parse(await readStdin());
} catch (err) {
  die(`could not read tool input (${err.message}); failing closed`);
}

const root = projectRoot();
if (!root) die("could not resolve the project root; failing closed");

const roots = [root, realish(root)];

for (const raw of targetPaths(payload.tool_input ?? {})) {
  const expanded = expandHome(raw);
  const abs = path.resolve(root, expanded);
  const candidates = [abs, realish(abs)];

  const contained = candidates.some((c) => roots.some((r) => isInside(r, c)));
  if (!contained) {
    die(
      `${raw} resolves to ${abs}, which is outside the project root ${root}. ` +
        `Every file this system writes lives in the repository — a write outside it is invisible to ` +
        `git status, so no gate, no review, and no CI check will ever see it. ` +
        `If the path was a mistake, correct it. If you genuinely need a file elsewhere, stop with ` +
        `gate: BLOCKED and say so in blocking_reason; a human decides.`
    );
  }
}

process.exit(0);
