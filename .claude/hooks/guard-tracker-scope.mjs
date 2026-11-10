// guard-tracker-scope.mjs — PreToolUse guard for RULE-18.
//
// Validates every ClickUp MCP call against .ai/registry/tracker.yaml before it runs.
//
// Blocks when:
//   - tracker.yaml is missing, or allowed_list_ids is empty  (empty means BLOCKED, not unrestricted)
//   - a space_id or workspace_id differs from the bound one
//   - a list_id is not in allowed_list_ids
//   - a write carries no list and no task target
//   - a lookup uses a name-shaped field instead of an ID, reason: id_only
//   - a write carries only a task_id that cannot be resolved to an allowed list
//
// On that last case: a task id from another space is still a syntactically valid id, so it cannot be
// assumed local. Resolution goes through .ai/board/tracker-task-index.json, which /pull-tickets
// maintains. Reads carrying only a task_id are allowed — reading one task by id is how it gets
// resolved in the first place, and the exposure is one record.
//
// No shebang, no shell. Invoked as: node "$CLAUDE_PROJECT_DIR/.claude/hooks/guard-tracker-scope.mjs"

import fs from "node:fs";
import path from "node:path";

const BLOCK = 2;

function die(reason) {
  process.stderr.write(`guard-tracker-scope: BLOCKED — ${reason}\n`);
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

function yamlScalar(text, key) {
  const m = new RegExp(`^${key}:\\s*(.*)$`, "m").exec(text);
  if (!m) return null;
  return m[1].trim().replace(/\s+#.*$/, "").replace(/^["']|["']$/g, "");
}

function yamlList(text, key) {
  const m = new RegExp(`^${key}:\\s*\\[(.*)\\]`, "m").exec(text);
  if (m) {
    return m[1]
      .split(",")
      .map((s) => s.trim().replace(/^["']|["']$/g, ""))
      .filter(Boolean);
  }
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    if (!new RegExp(`^${key}:\\s*$`).test(lines[i])) continue;
    const out = [];
    for (let j = i + 1; j < lines.length; j++) {
      const item = /^\s*-\s*(.+?)\s*$/.exec(lines[j]);
      if (!item) break;
      out.push(item[1].replace(/^["']|["']$/g, ""));
    }
    return out;
  }
  return [];
}

// Flatten tool_input to [key, value] pairs, keys lower-cased and underscore-normalised.
function fields(node, depth = 0, out = []) {
  if (depth > 5 || node === null || typeof node !== "object") return out;
  for (const [k, v] of Object.entries(node)) {
    const key = k.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toLowerCase();
    if (v !== null && typeof v === "object") fields(v, depth + 1, out);
    else if (v !== undefined && v !== null) out.push([key, String(v)]);
  }
  return out;
}

let payload;
try {
  payload = JSON.parse(await readStdin());
} catch (err) {
  die(`could not read tool input (${err.message}); failing closed`);
}

const toolName = String(payload.tool_name ?? "");
if (!/^mcp__.*clickup/i.test(toolName)) process.exit(0);

const root = projectRoot();
if (!root) die("could not resolve the project root; failing closed");

const trackerPath = path.join(root, ".ai/registry/tracker.yaml");
if (!fs.existsSync(trackerPath)) {
  die(".ai/registry/tracker.yaml is missing — no binding exists, so every call is out of scope");
}

const tracker = fs.readFileSync(trackerPath, "utf8");
const boundSpace = yamlScalar(tracker, "space_id") ?? "";
const boundWorkspace = yamlScalar(tracker, "workspace_id") ?? "";
const allowedLists = yamlList(tracker, "allowed_list_ids");
const idOnly = (yamlScalar(tracker, "\\s*id_only") ?? "true") !== "false";

if (allowedLists.length === 0) {
  die("allowed_list_ids is empty. Empty means BLOCKED, not unrestricted (RULE-18)");
}

const pairs = fields(payload.tool_input ?? {});

// 1. Name-shaped lookups. Resolution by name is how a call reaches the wrong list while looking
//    correct, so it is refused outright rather than resolved.
if (idOnly) {
  const NAME_KEY = /(list|space|folder|task|team|workspace|view|doc|project)_name$/;
  for (const [k, v] of pairs) {
    if (NAME_KEY.test(k) && v !== "") {
      die(`${toolName} passes ${k}="${v}"; targets resolve by ID only (RULE-18, reason: id_only)`);
    }
  }
}

// 2. Space and workspace must match the binding exactly.
for (const [k, v] of pairs) {
  if (k === "space_id" && v && v !== boundSpace) {
    die(`space_id ${v} is not the bound space ${boundSpace}`);
  }
  if ((k === "workspace_id" || k === "team_id") && v && boundWorkspace && v !== boundWorkspace) {
    die(`${k} ${v} is not the bound workspace ${boundWorkspace}`);
  }
}

// 3. Every list id must be in the allow list.
const listIds = pairs
  .filter(([k]) => k === "list_id" || k === "list_ids" || k === "listid")
  .flatMap(([, v]) => v.split(",").map((s) => s.trim()))
  .filter(Boolean);

for (const id of listIds) {
  if (!allowedLists.includes(id)) {
    die(`list_id ${id} is not in allowed_list_ids [${allowedLists.join(", ")}] (RULE-18)`);
  }
}

// 4. Writes need a target that resolves into scope.
const suffix = toolName.replace(/^mcp__.*?clickup[^_]*__/i, "").replace(/^clickup_/, "");
const READ = /^(get|list|filter|search|download|resolve|find)/i;
const isWrite = !READ.test(suffix);

const taskIds = pairs.filter(([k]) => k === "task_id" || k === "task_ids").map(([, v]) => v);

if (isWrite) {
  if (listIds.length === 0 && taskIds.length === 0) {
    die(`${toolName} is a write with no list_id and no task_id; refusing an unscoped write`);
  }
  if (listIds.length === 0) {
    const indexPath = path.join(root, ".ai/board/tracker-task-index.json");
    if (!fs.existsSync(indexPath)) {
      die(
        `${toolName} is a write targeting task_id ${taskIds.join(", ")} with no list_id, and ` +
          `.ai/board/tracker-task-index.json does not exist. Resolve the task's list first ` +
          `(a task id from another space is still a valid id).`
      );
    }
    let index;
    try {
      index = JSON.parse(fs.readFileSync(indexPath, "utf8"));
    } catch (err) {
      die(`.ai/board/tracker-task-index.json is unreadable (${err.message}); failing closed`);
    }
    for (const t of taskIds) {
      const list = index[t];
      if (!list) die(`task ${t} is not in tracker-task-index.json; its list is unknown`);
      if (!allowedLists.includes(String(list))) {
        die(`task ${t} belongs to list ${list}, which is not in allowed_list_ids (RULE-18)`);
      }
    }
  }
}

process.exit(0);
