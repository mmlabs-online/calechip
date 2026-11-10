// The outermost boundary — nothing is written outside the project root.
//
// A control that has never been observed to fire is not a control. The stray D:\Servers write during
// the Phase A run is the case that motivated this guard, so it is the first test.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeProject, runHook, runHookRaw } from "./_harness.mjs";

const HOOK = "guard-project-root.mjs";
const write = (file_path) => ({ tool_name: "Write", tool_input: { file_path, content: "x" } });

test("blocks the stray write that motivated this guard", () => {
  const root = makeProject();
  const stray = process.platform === "win32" ? "D:\\Servers\\placeholder-unused.md" : "/Servers/placeholder-unused.md";
  const r = runHook(HOOK, root, write(stray));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /outside the project root/);
});

test("blocks an absolute path elsewhere on the filesystem", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write(path.join(os.tmpdir(), "somewhere-else.md")));
  assert.equal(r.code, 2);
});

test("blocks traversal above the root", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write("../escaped.md"));
  assert.equal(r.code, 2);
});

test("blocks traversal that climbs and comes back down elsewhere", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write(".ai/board/../../../elsewhere/notes.md"));
  assert.equal(r.code, 2, "normalisation must happen before containment is tested");
});

test("blocks a home-relative target", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write("~/notes.md"));
  assert.equal(r.code, 2);
});

test("blocks an Edit as well as a Write", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, {
    tool_name: "Edit",
    tool_input: { file_path: "../../outside.ts", old_string: "a", new_string: "b" },
  });
  assert.equal(r.code, 2);
});

test("blocks a nested path field, not just a top-level one", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, {
    tool_name: "Write",
    tool_input: { edits: [{ file_path: "../../outside.ts" }] },
  });
  assert.equal(r.code, 2);
});

test("allows a relative path inside the project", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write("src/app/page.tsx"));
  assert.equal(r.code, 0);
});

test("allows an absolute path inside the project", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write(path.join(root, "src", "app", "page.tsx")));
  assert.equal(r.code, 0);
});

test("allows the board plane", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, write(".ai/board/tickets/TST-01/03-impl-log.md"));
  assert.equal(r.code, 0);
});

test("a symlinked root does not produce a false block", () => {
  // os.tmpdir() is itself symlinked on macOS (/var -> /private/var), which is the case that makes a
  // naive realpath comparison reject every legitimate write.
  const root = makeProject();
  const link = path.join(os.tmpdir(), `moo-link-${process.pid}-${path.basename(root)}`);
  try {
    fs.symlinkSync(root, link, "dir");
  } catch {
    return; // no symlink privilege on this machine; the other tests still cover containment
  }
  try {
    const r = runHook(HOOK, link, write("src/app/page.tsx"));
    assert.equal(r.code, 0, r.stderr);
  } finally {
    fs.unlinkSync(link);
  }
});

test("allows a payload with no path field at all", () => {
  const root = makeProject();
  const r = runHook(HOOK, root, { tool_name: "Write", tool_input: { content: "x" } });
  assert.equal(r.code, 0);
});

test("fails closed on unparseable stdin", () => {
  const root = makeProject();
  const r = runHookRaw(HOOK, root, "this is not json");
  assert.equal(r.code, 2);
  assert.match(r.stderr, /failing closed/);
});
