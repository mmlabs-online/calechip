// RULE-18 — ClickUp targets resolve against tracker.yaml by ID only, and an empty allow list
// blocks every call.

import test from "node:test";
import assert from "node:assert/strict";
import { makeProject, runHook, TRACKER } from "./_harness.mjs";

const HOOK = "guard-tracker-scope.mjs";
const TRACKER_FILE = ".ai/registry/tracker.yaml";
const INDEX_FILE = ".ai/board/tracker-task-index.json";
const OK_LIST = "901525013348";

const call = (tool, tool_input) => ({ tool_name: `mcp__clickup__${tool}`, tool_input });

test("ignores non-ClickUp tools", () => {
  const root = makeProject({});
  assert.equal(runHook(HOOK, root, { tool_name: "Write", tool_input: {} }).code, 0);
});

test("blocks when tracker.yaml is missing", () => {
  const root = makeProject({});
  const r = runHook(HOOK, root, call("clickup_get_task", { task_id: "abc" }));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /tracker\.yaml is missing/);
});

test("empty allowed_list_ids blocks every call", () => {
  const root = makeProject({ [TRACKER_FILE]: TRACKER({ allowed_list_ids: "[]" }) });
  const r = runHook(HOOK, root, call("clickup_filter_tasks", { list_id: OK_LIST }));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /BLOCKED, not unrestricted/);
});

test("allows an in-scope read", () => {
  const root = makeProject({ [TRACKER_FILE]: TRACKER() });
  assert.equal(runHook(HOOK, root, call("clickup_filter_tasks", { list_id: OK_LIST })).code, 0);
});

test("blocks a list_id outside the allow list", () => {
  const root = makeProject({ [TRACKER_FILE]: TRACKER() });
  const r = runHook(HOOK, root, call("clickup_filter_tasks", { list_id: "111111111" }));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /not in allowed_list_ids/);
});

test("blocks a name-shaped lookup with reason id_only", () => {
  const root = makeProject({ [TRACKER_FILE]: TRACKER() });
  const r = runHook(HOOK, root, call("clickup_filter_tasks", { list_name: "AIW Backlog" }));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /id_only/);
});

test("blocks a camelCase name-shaped lookup too", () => {
  const root = makeProject({ [TRACKER_FILE]: TRACKER() });
  const r = runHook(HOOK, root, call("clickup_get_task", { taskName: "Order list" }));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /id_only/);
});

test("blocks a mismatched space_id", () => {
  const root = makeProject({ [TRACKER_FILE]: TRACKER() });
  const r = runHook(HOOK, root, call("clickup_filter_tasks", { space_id: "999", list_id: OK_LIST }));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /not the bound space/);
});

test("blocks a write with no target at all", () => {
  const root = makeProject({ [TRACKER_FILE]: TRACKER() });
  const r = runHook(HOOK, root, call("clickup_create_task", { name: "x" }));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /unscoped write/);
});

test("allows a write into an allowed list", () => {
  const root = makeProject({ [TRACKER_FILE]: TRACKER() });
  assert.equal(runHook(HOOK, root, call("clickup_create_task", { list_id: OK_LIST })).code, 0);
});

test("allows a read carrying only a task_id", () => {
  const root = makeProject({ [TRACKER_FILE]: TRACKER() });
  assert.equal(runHook(HOOK, root, call("clickup_get_task", { task_id: "abc123" })).code, 0);
});

test("blocks a write carrying only a task_id when the index does not exist", () => {
  const root = makeProject({ [TRACKER_FILE]: TRACKER() });
  const r = runHook(HOOK, root, call("clickup_update_task", { task_id: "abc123" }));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /Resolve the task's list first/);
});

test("allows a write on a task the index resolves into scope", () => {
  const root = makeProject({
    [TRACKER_FILE]: TRACKER(),
    [INDEX_FILE]: JSON.stringify({ abc123: OK_LIST }),
  });
  assert.equal(runHook(HOOK, root, call("clickup_update_task", { task_id: "abc123" })).code, 0);
});

test("blocks a write on a task the index resolves out of scope", () => {
  const root = makeProject({
    [TRACKER_FILE]: TRACKER(),
    [INDEX_FILE]: JSON.stringify({ abc123: "777777777" }),
  });
  const r = runHook(HOOK, root, call("clickup_update_task", { task_id: "abc123" }));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /which is not in allowed_list_ids/);
});

test("finds a list_id nested inside the payload", () => {
  const root = makeProject({ [TRACKER_FILE]: TRACKER() });
  const r = runHook(HOOK, root, call("clickup_create_task", { target: { list_id: "222222222" } }));
  assert.equal(r.code, 2, "a nested target must not slip past the scope check");
});
