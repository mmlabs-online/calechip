// guard-read-scope.mjs — PreToolUse guard for RULE-05, which is RETIRED (ADR-022).
//
// It enforced: QA never reads the implementation source; the plan's testability contract is the only
// channel through which selectors reach QA. The same restriction applied to `ba`, whose input was the
// registry and the ticket, not the code.
//
// **Both restricted roles are retired** — `ba` by ADR-019, `qa` by ADR-022 — so this guard is inert:
// no live agent matches RESTRICTED and it fails open for everyone.
//
// **ADR-041 unwires it.** It was wired on `Read|Grep|Glob|NotebookEdit`, which spawns a Node process
// per read tool call, in every stage of every unattended run, to exit 0. The file and its tests stay
// — deleting a guard is the one direction that fails silently, and if either role is ever revived
// the restriction has to be here already rather than remembered.
//
// **The unwiring is owed, not done.** The harness refuses an agent edit to `.claude/settings.json`
// (self-modification), so the operator deletes this block from `hooks.PreToolUse` — MD-036:
//
//   { "matcher": "Read|Grep|Glob|NotebookEdit",
//     "hooks": [{ "type": "command",
//                 "command": "node \"$CLAUDE_PROJECT_DIR/.claude/hooks/guard-read-scope.mjs\"" }] }
//
// Re-wiring is putting that block back. Nothing else changes.
//
// This hook exists because the restriction is not expressible in subagent frontmatter: `tools` and
// `disallowedTools` are tool-level, not path-level, and denying Read outright would leave these
// agents unable to read the story they are working from.
//
// Wired twice on purpose: in .claude/settings.json (session-wide, gated on agent_type) and in the
// `ba` and `qa` frontmatter (so the restriction is visible in the agent definition itself, which is
// where someone reading the agent will look for it). Either firing blocks; both firing is harmless.
//
// Fails open for every other agent, which is the point — the developer must read the source.
//
// No shebang, no shell. Invoked as: node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-read-scope.mjs"

import fs from "node:fs";
import path from "node:path";

const BLOCK = 2;
const RESTRICTED = new Set(["ba", "qa"]);

// The implementation source roots, relative to the repository root. One of the three places in this
// kit that assume a directory layout; the other two are SCAFFOLD_ROOTS and PATH_ROOTS in
// scripts/check-docs.mjs.
//
// `_figma` is the Figma Make prototype, kept as a reference and named in
// .ai/standards/tech-stack.md. It is here for the same reason `src` is: it is an implementation of
// the interface, and a test derived from it agrees with the prototype rather than with the story.
const SOURCE_ROOTS = ["src", "_figma"];

function die(reason) {
  process.stderr.write(`guard-read-scope: BLOCKED — ${reason}\n`);
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

function toRepoRelative(root, p) {
  const abs = path.isAbsolute(p) ? p : path.resolve(root, p);
  return path.relative(root, abs).split(path.sep).join("/");
}

let payload;
try {
  payload = JSON.parse(await readStdin());
} catch {
  process.exit(0); // read-side guard: an unreadable payload is not grounds to block a read
}

const agent = payload.agent_type;
if (!agent || !RESTRICTED.has(agent)) process.exit(0);

const tool = String(payload.tool_name ?? "");
if (!/^(Read|Grep|Glob|NotebookEdit)$/.test(tool)) process.exit(0);

const root = projectRoot();
if (!root) process.exit(0);

const input = payload.tool_input ?? {};
// `pattern` counts only for Glob: for Grep it is the search expression, not a location.
const candidates = [input.file_path, input.path, input.glob, tool === "Glob" ? input.pattern : null]
  .filter((v) => typeof v === "string" && v.length > 0);

for (const raw of candidates) {
  const rel = toRepoRelative(root, raw);
  if (SOURCE_ROOTS.some((root) => rel === root || rel.startsWith(`${root}/`))) {
    die(
      `${agent} may not read ${rel} (RULE-05). The story and design section 6 are the only ` +
        `channel through which the implementation reaches this agent; reading the source produces ` +
        `tests that agree with the code instead of with the specification.`
    );
  }
}

process.exit(0);
