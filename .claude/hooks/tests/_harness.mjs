// Shared test harness. Builds a throwaway project on disk, runs a hook against it as a real child
// process with a real JSON payload on stdin, and returns the exit code and stderr.
//
// The hooks are deliberately standalone — they share no library, so that a mistake in one cannot
// disable the others. The tests are the only place duplication is worth avoiding.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HOOKS_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export function makeProject(files = {}, branch = "main") {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "moo-hook-"));
  fs.mkdirSync(path.join(root, ".git"), { recursive: true });
  fs.writeFileSync(path.join(root, ".git", "HEAD"), `ref: refs/heads/${branch}\n`);
  for (const [rel, contents] of Object.entries(files)) {
    const abs = path.join(root, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, contents);
  }
  return root;
}

export function detachedHead(root) {
  fs.writeFileSync(path.join(root, ".git", "HEAD"), "a1b2c3d4e5f60718293a4b5c6d7e8f9012345678\n");
}

export function runHookRaw(hook, root, input) {
  const res = spawnSync(process.execPath, [path.join(HOOKS_DIR, hook)], {
    input,
    cwd: root,
    env: { ...process.env, CLAUDE_PROJECT_DIR: root },
    encoding: "utf8",
  });
  return { code: res.status, stderr: res.stderr ?? "", stdout: res.stdout ?? "" };
}

export function runHook(hook, root, payload) {
  return runHookRaw(hook, root, JSON.stringify(payload));
}

export function read(root, rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

export const TICKET = (overrides = {}) => {
  const o = {
    id: "TST-01",
    state: "IN_PROGRESS",
    allowed_paths: "[]",
    budget: "  developer->tech-lead-design: { used: 0, max: 6 }",
    ...overrides,
  };
  return [
    `id: ${o.id}`,
    'title: ""',
    "feature_ids: []",
    `state: ${o.state}`,
    "invariants_touched: []",
    `allowed_paths: ${o.allowed_paths}`,
    "schema_delta: none",
    "rework_count: 0",
    "chat_budget:",
    o.budget,
    "  qa->ba:                      { used: 0, max: 6 }",
    "",
  ].join("\n");
};

export const TRACKER = (overrides = {}) => {
  const o = {
    space_id: '"901511737838"',
    workspace_id: '"90151930592"',
    allowed_list_ids: '["901525013348"]',
    id_only: "true",
    ...overrides,
  };
  return [
    "provider: clickup",
    `workspace_id: ${o.workspace_id}`,
    `space_id: ${o.space_id}`,
    `allowed_list_ids: ${o.allowed_list_ids}`,
    "rules:",
    `  id_only: ${o.id_only}`,
    "",
  ].join("\n");
};
