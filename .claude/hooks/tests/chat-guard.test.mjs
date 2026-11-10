// RULE-12 — no chat with your judge before the verdict exists.
// RULE-15 — six messages per pair per ticket.

import test from "node:test";
import assert from "node:assert/strict";
import { makeProject, runHook, read, TICKET } from "./_harness.mjs";

const HOOK = "chat-guard.mjs";
const TICKET_FILE = ".ai/board/tickets/TST-01/ticket.yaml";

const msg = (from, to, tool = "SendMessage") => ({
  tool_name: tool,
  agent_type: from,
  tool_input: { agent: to, message: "..." },
});

const project = (files = {}, branch = "feat/TST-01") =>
  makeProject({ [TICKET_FILE]: TICKET(), ...files }, branch);

test("ignores tools that are not messaging", () => {
  const root = project();
  const r = runHook(HOOK, root, {
    tool_name: "Write",
    agent_type: "developer",
    tool_input: { agent: "tech-lead-review" },
  });
  assert.equal(r.code, 0);
});

test("fails open with no active ticket", () => {
  const root = makeProject({}, "main");
  assert.equal(runHook(HOOK, root, msg("developer", "tech-lead-review")).code, 0);
});

test("main-thread dispatch is not chat", () => {
  const root = project();
  const r = runHook(HOOK, root, {
    tool_name: "Agent",
    tool_input: { subagent_type: "tech-lead-review" },
  });
  assert.equal(r.code, 0, "no agent_type means the orchestrator is dispatching, not an agent talking");
});

test("blocks developer to tech-lead-review before the verdict", () => {
  const root = project();
  const r = runHook(HOOK, root, msg("developer", "tech-lead-review"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /RULE-12/);
  assert.match(r.stderr, /04-review\.md/);
});

test("blocks the reverse direction too — the pair is unordered", () => {
  const root = project();
  assert.equal(runHook(HOOK, root, msg("tech-lead-review", "developer")).code, 2);
});

test("blocks developer to qa before the test report", () => {
  const root = project();
  const r = runHook(HOOK, root, msg("developer", "qa"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /06-test-report\.md/);
});

test("blocks qa to tech-lead-review before the verdict", () => {
  const root = project();
  assert.equal(runHook(HOOK, root, msg("qa", "tech-lead-review")).code, 2);
});

test("allows developer to tech-lead-review once the verdict is on disk", () => {
  const root = project({ ".ai/board/tickets/TST-01/04-review.md": "gate: FAIL\n" });
  assert.equal(runHook(HOOK, root, msg("developer", "tech-lead-review")).code, 0);
});

test("allows a backwards edge and spends one message of the budget", () => {
  const root = project();
  const r = runHook(HOOK, root, msg("developer", "tech-lead-design"));
  assert.equal(r.code, 0);
  assert.match(read(root, TICKET_FILE), /developer->tech-lead-design:\s*\{ used: 1, max: 6 \}/);
});

test("increments cumulatively", () => {
  const root = project();
  for (let i = 0; i < 3; i++) runHook(HOOK, root, msg("developer", "tech-lead-design"));
  assert.match(read(root, TICKET_FILE), /developer->tech-lead-design:\s*\{ used: 3, max: 6 \}/);
});

test("blocks when the budget is exhausted", () => {
  const root = project({
    [TICKET_FILE]: TICKET({ budget: "  developer->tech-lead-design: { used: 6, max: 6 }" }),
  });
  const r = runHook(HOOK, root, msg("developer", "tech-lead-design"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /RULE-15/);
  assert.match(r.stderr, /BLOCKED artifact/);
});

test("does not spend budget on a blocked message", () => {
  const root = project();
  runHook(HOOK, root, msg("developer", "tech-lead-review"));
  assert.match(read(root, TICKET_FILE), /developer->tech-lead-design:\s*\{ used: 0, max: 6 \}/);
});

test("an unbudgeted but permitted pair passes without a budget entry", () => {
  const root = project();
  assert.equal(runHook(HOOK, root, msg("ba", "product")).code, 0);
});

test("a message to a non-pipeline agent is not chat", () => {
  const root = project();
  const r = runHook(HOOK, root, {
    tool_name: "Agent",
    agent_type: "developer",
    tool_input: { subagent_type: "Explore" },
  });
  assert.equal(r.code, 0);
});
