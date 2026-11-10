// RULE-12 and RULE-15 over the FILE transport — writes to 99-questions.md.
//
// The tool transport is covered in chat-guard.test.mjs. This file covers the transport the session
// model actually uses, where each role runs as its own top-level session and therefore has no
// agent_type to identify it. Identity comes from the file's front-matter instead.

import test from "node:test";
import assert from "node:assert/strict";
import { makeProject, runHook, TICKET } from "./_harness.mjs";

const HOOK = "chat-guard.mjs";
const DIR = ".ai/board/tickets/TST-01";
const TICKET_FILE = `${DIR}/ticket.yaml`;
const QUESTIONS = `${DIR}/99-questions.md`;

const entry = (to, from) =>
  ["---", from ? `from: ${from}` : null, `to: ${to}`, "asked_at: 2026-08-11T10:00:00Z", "---", "", "Why?", ""]
    .filter((l) => l !== null)
    .join("\n");

const write = (content, file = QUESTIONS) => ({
  tool_name: "Write",
  tool_input: { file_path: file, content },
});

const edit = (newString, file = QUESTIONS) => ({
  tool_name: "Edit",
  tool_input: { file_path: file, old_string: "x", new_string: newString },
});

const project = (files = {}, branch = "feat/TST-01") =>
  makeProject({ [TICKET_FILE]: TICKET(), ...files }, branch);

// --- RULE-12 ---------------------------------------------------------------------------------

test("blocks a question addressed to tech-lead-review before the verdict exists", () => {
  const root = project();
  const r = runHook(HOOK, root, write(entry("tech-lead-review", "developer")));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /RULE-12/);
  assert.match(r.stderr, /04-review\.md/);
});

test("blocks even when the asker is unknown — no from:, no agent_type", () => {
  // This is the case the session model creates: the developer runs as its own top-level session, so
  // there is no agent_type. The guard must still refuse, on the addressee alone.
  const root = project();
  const r = runHook(HOOK, root, write(entry("tech-lead-review")));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /no agent may address tech-lead-review/);
});

test("allows the same question once 04-review.md exists", () => {
  const root = project({ [`${DIR}/04-review.md`]: "verdict" });
  assert.equal(runHook(HOOK, root, write(entry("tech-lead-review", "developer"))).code, 0);
});

test("blocks a question addressed to qa before the test report exists", () => {
  const root = project();
  const r = runHook(HOOK, root, write(entry("qa", "developer")));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /06-test-report\.md/);
});

test("allows a question to qa once 06-test-report.md exists", () => {
  const root = project({ [`${DIR}/06-test-report.md`]: "report" });
  assert.equal(runHook(HOOK, root, write(entry("qa", "developer"))).code, 0);
});

test("allows a backwards edge — qa to tech-lead-design", () => {
  const root = project();
  assert.equal(runHook(HOOK, root, write(entry("tech-lead-design", "qa"))).code, 0);
});

test("allows developer to tech-lead-design", () => {
  const root = project();
  assert.equal(runHook(HOOK, root, write(entry("tech-lead-design", "developer"))).code, 0);
});

test("notes when the pair is not an allowed edge at all", () => {
  const root = project();
  const r = runHook(HOOK, root, write(entry("tech-lead-review", "ba")));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /not an allowed edge/);
});

test("catches a forbidden addressee among several in one write", () => {
  const root = project();
  const content = `${entry("tech-lead-design", "developer")}\n${entry("qa", "developer")}`;
  assert.equal(runHook(HOOK, root, write(content)).code, 2);
});

test("an Edit that adds a forbidden addressee is blocked", () => {
  const root = project({ [QUESTIONS]: entry("tech-lead-design", "developer") });
  const r = runHook(HOOK, root, edit(entry("tech-lead-review", "developer")));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /RULE-12/);
});

// --- RULE-15 ---------------------------------------------------------------------------------

test("blocks when the entry count exceeds the budget", () => {
  const root = project();
  const content = Array.from({ length: 7 }, () => entry("tech-lead-design", "developer")).join("\n");
  const r = runHook(HOOK, root, write(content));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /RULE-15/);
  assert.match(r.stderr, /7\/6/);
});

test("allows exactly the budget", () => {
  const root = project();
  const content = Array.from({ length: 6 }, () => entry("tech-lead-design", "developer")).join("\n");
  assert.equal(runHook(HOOK, root, write(content)).code, 0);
});

test("an Edit counts entries already in the file, not only the added ones", () => {
  // Six on disk plus one appended is seven. Counting only the addition would let the budget be
  // spent one question at a time, forever.
  const root = project({
    [QUESTIONS]: Array.from({ length: 6 }, () => entry("tech-lead-design", "developer")).join("\n"),
  });
  const r = runHook(HOOK, root, edit(entry("tech-lead-design", "developer")));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /RULE-15/);
});

test("resolves the budget line by addressee when the asker is unknown", () => {
  const root = project();
  const content = Array.from({ length: 7 }, () => entry("ba")).join("\n");
  const r = runHook(HOOK, root, write(content));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /qa->ba/);
});

test("a pair with no budget line is governed by the topology alone", () => {
  const root = project();
  const content = Array.from({ length: 20 }, () => entry("product", "ba")).join("\n");
  assert.equal(runHook(HOOK, root, write(content)).code, 0);
});

// --- scope -----------------------------------------------------------------------------------

test("ignores a write to any other file", () => {
  const root = project();
  const r = runHook(HOOK, root, write(entry("tech-lead-review", "developer"), `${DIR}/03-impl-log.md`));
  assert.equal(r.code, 0);
});

test("ignores a 99-questions.md outside the board", () => {
  const root = project();
  assert.equal(runHook(HOOK, root, write(entry("qa", "developer"), "docs/99-questions.md")).code, 0);
});

test("fails open when the ticket does not exist", () => {
  const root = makeProject({}, "feat/TST-01");
  const r = runHook(HOOK, root, write(entry("tech-lead-review", "developer")));
  assert.equal(r.code, 0);
});

test("guards the file regardless of branch — the path names the ticket", () => {
  // Unlike the tool transport, this path does not need the branch to identify the ticket: the file
  // path contains it. A question written from main is still a question.
  const root = makeProject({ [TICKET_FILE]: TICKET() }, "main");
  assert.equal(runHook(HOOK, root, write(entry("tech-lead-review", "developer"))).code, 2);
});

test("an absolute path resolves the same way", () => {
  const root = project();
  const r = runHook(HOOK, root, {
    tool_name: "Write",
    tool_input: { file_path: `${root}/${QUESTIONS}`, content: entry("tech-lead-review", "developer") },
  });
  assert.equal(r.code, 2);
});
