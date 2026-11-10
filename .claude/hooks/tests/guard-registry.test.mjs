// RULE-01 — .ai/registry/** is read-only to every agent.

import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { makeProject, runHook, runHookRaw } from "./_harness.mjs";

const HOOK = "guard-registry.mjs";
const write = (file_path) => ({ tool_name: "Write", tool_input: { file_path, content: "x" } });

test("blocks a write to the registry", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write(".ai/registry/invariants.md"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /RULE-01/);
});

test("blocks an Edit to the registry", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, {
    tool_name: "Edit",
    tool_input: { file_path: ".ai/registry/rules.md", old_string: "a", new_string: "b" },
  });
  assert.equal(r.code, 2);
});

test("blocks an absolute path into the registry", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write(path.join(root, ".ai", "registry", "features.md")));
  assert.equal(r.code, 2);
});

test("blocks a traversal that lands in the registry", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write(".ai/board/../registry/tracker.yaml"));
  assert.equal(r.code, 2, "normalisation must happen before the prefix test");
});

test("blocks decisions/ too — an ADR is human-only under RULE-09", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write(".ai/registry/decisions/ADR-002-something.md"));
  assert.equal(r.code, 2);
});

test("allows the board plane", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write(".ai/board/tickets/TST-01/01-story.md"));
  assert.equal(r.code, 0);
});

test("allows src", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write("src/app/page.tsx"));
  assert.equal(r.code, 0);
});

test("does not confuse a similarly named directory", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write(".ai/registry-notes/scratch.md"));
  assert.equal(r.code, 0);
});

test("fails closed on unparseable stdin", () => {
  const root = makeProject();
  const r = runHookRaw(HOOK, root, "this is not json");
  assert.equal(r.code, 2);
  assert.match(r.stderr, /failing closed/);
});
