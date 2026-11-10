// RULE-05 — QA never reads src/**. The same applies to ba, whose input is the registry.

import test from "node:test";
import assert from "node:assert/strict";
import { makeProject, runHook } from "./_harness.mjs";

const HOOK = "guard-read-scope.mjs";
const readTool = (agent_type, file_path) => ({
  tool_name: "Read",
  agent_type,
  tool_input: { file_path },
});

test("blocks qa reading src", () => {
  const root = makeProject({});
  const r = runHook(HOOK, root, readTool("qa", "src/app/orders/page.tsx"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /RULE-05/);
});

test("blocks ba reading src", () => {
  const root = makeProject({});
  assert.equal(runHook(HOOK, root, readTool("ba", "src/lib/data/index.ts")).code, 2);
});

test("allows qa to read the story", () => {
  const root = makeProject({});
  assert.equal(runHook(HOOK, root, readTool("qa", ".ai/board/tickets/TST-01/01-story.md")).code, 0);
});

test("allows qa to read tests", () => {
  const root = makeProject({});
  assert.equal(runHook(HOOK, root, readTool("qa", "tests/e2e/smoke.spec.ts")).code, 0);
});

test("allows developer to read src", () => {
  const root = makeProject({});
  assert.equal(runHook(HOOK, root, readTool("developer", "src/app/page.tsx")).code, 0);
});

test("allows the main thread to read src", () => {
  const root = makeProject({});
  const r = runHook(HOOK, root, { tool_name: "Read", tool_input: { file_path: "src/app/page.tsx" } });
  assert.equal(r.code, 0);
});

test("blocks a Glob whose pattern reaches into src", () => {
  const root = makeProject({});
  const r = runHook(HOOK, root, {
    tool_name: "Glob",
    agent_type: "qa",
    tool_input: { pattern: "src/**/*.tsx" },
  });
  assert.equal(r.code, 2);
});

test("blocks a Grep scoped to src", () => {
  const root = makeProject({});
  const r = runHook(HOOK, root, {
    tool_name: "Grep",
    agent_type: "qa",
    tool_input: { pattern: "data-testid", path: "src" },
  });
  assert.equal(r.code, 2);
});

test("a Grep pattern that merely looks like a path is not a location", () => {
  const root = makeProject({});
  const r = runHook(HOOK, root, {
    tool_name: "Grep",
    agent_type: "qa",
    tool_input: { pattern: "src/lib/data", path: "tests" },
  });
  assert.equal(r.code, 0, "the search expression is not where the search happens");
});

test("does not confuse a directory that merely starts with src", () => {
  const root = makeProject({});
  assert.equal(runHook(HOOK, root, readTool("qa", "srcs/notes.md")).code, 0);
});

// `_figma` is the Figma Make prototype, kept as a reference and named in
// .ai/standards/tech-stack.md. It is an implementation of the interface, so a test derived from it
// agrees with the prototype rather than with the story — the same failure RULE-05 exists to prevent.
// These three cases are what stops a later edit dropping it from SOURCE_ROOTS silently.

test("blocks qa reading the figma prototype", () => {
  const root = makeProject({});
  const r = runHook(HOOK, root, readTool("qa", "_figma/src/App.tsx"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /RULE-05/);
});

test("blocks ba reading the figma prototype", () => {
  const root = makeProject({});
  assert.equal(runHook(HOOK, root, readTool("ba", "_figma/package.json")).code, 2);
});

test("allows developer and tech-lead-design to read the figma prototype", () => {
  const root = makeProject({});
  assert.equal(runHook(HOOK, root, readTool("developer", "_figma/src/App.tsx")).code, 0);
  assert.equal(runHook(HOOK, root, readTool("tech-lead-design", "_figma/src/App.tsx")).code, 0);
});
