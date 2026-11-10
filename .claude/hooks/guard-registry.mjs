// guard-registry.mjs — PreToolUse guard for RULE-01.
//
// Blocks any Edit or Write whose target resolves under .ai/registry/**.
//
// Fails closed: unreadable stdin, unparseable JSON, or an unresolvable project root all block.
// A guard that cannot tell whether a write is safe must not conclude that it is.
//
// No shebang, no shell. Invoked as: node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-registry.mjs"

import fs from "node:fs";
import path from "node:path";

const BLOCK = 2;

function die(reason) {
  process.stderr.write(`guard-registry: BLOCKED — ${reason}\n`);
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

// Every string value under a key that looks like a filesystem target.
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

let payload;
try {
  payload = JSON.parse(await readStdin());
} catch (err) {
  die(`could not read tool input (${err.message}); failing closed`);
}

const root = projectRoot();
if (!root) die("could not resolve the project root; failing closed");

const paths = targetPaths(payload.tool_input ?? {});
for (const raw of paths) {
  const rel = toRepoRelative(root, raw);
  if (rel === ".ai/registry" || rel.startsWith(".ai/registry/")) {
    die(
      `${rel} is in the registry plane, which is read-only to every agent (RULE-01). ` +
        `Stop with gate: BLOCKED and state the change you need in blocking_reason. ` +
        `A human writes the ADR (RULE-09); you do not.`
    );
  }
}

process.exit(0);
