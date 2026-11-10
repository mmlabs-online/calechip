// Settings integrity — the second clobber detector.
//
// Some environments have been observed appending session permission grants to
// `.claude/settings.json` rather than to `.claude/settings.local.json`, silently overwriting the
// governance config. When that happens the deny list and every hook vanish, and nothing about the
// session looks different: the guards simply stop guarding, which is the exact failure mode this
// whole layer exists to prevent.
//
// Two detectors now. The first is `git diff .claude/settings.json`, available because Phase A is
// committed. It is only useful if a human looks. This is the second, and it runs in CI on every push
// and pull request via `node --test .claude/hooks/tests/`, where nobody has to remember to look.
//
// Every assertion below names the exact missing key, because "settings.json changed" is not
// actionable and "the deny rule mcp__clickup__clickup_search is missing" is.

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
const SETTINGS = path.join(ROOT, ".claude", "settings.json");

// The expected shape, stated once. Update this list only alongside a deliberate change to
// settings.json — never to make a failing test pass.

const REQUIRED_ALLOW = [
  "Bash(git status)",
  "Bash(git diff:*)",
  "Bash(git log:*)",
  "Bash(git add:*)",
  "Bash(git commit:*)",
  "Bash(git switch:*)",
  "Bash(git checkout -b feat/*)",
  "Bash(git fetch:*)",
  "Bash(git show-ref:*)",
  "Bash(gh pr create:*)",
  "Bash(gh pr view:*)",
  "mcp__clickup__clickup_get_task",
  "mcp__clickup__clickup_update_task",
  "mcp__clickup__clickup_get_custom_fields",
  "mcp__clickup__clickup_create_comment",
  "mcp__clickup__clickup_filter_tasks",
];

// Read-only commands, allowlisted deliberately rather than prompted for one at a time.
//
// The reasoning is about attention, not convenience. A prompt for `ls` teaches that prompts are
// noise to be cleared, and that habit is spent on the one prompt that actually matters. Every rule
// below names a command that cannot change the repository, so approving it carries no information
// and asking for it costs vigilance.
//
// The test exists because this block is the kind of thing a clobber drops silently: nothing looks
// different afterwards except that the prompts come back, and by then the habit is already relearned.
const REQUIRED_READONLY_ALLOW = [
  "Bash(ls:*)",
  "Bash(cat:*)",
  "Bash(head:*)",
  "Bash(tail:*)",
  "Bash(wc:*)",
  "Bash(find:*)",
  "Bash(grep:*)",
  "Bash(rg:*)",
  "Bash(tree:*)",
  "Bash(pwd)",
  "Bash(echo:*)",
  "Bash(date:*)",
  "Bash(node --version)",
  "Bash(pnpm --version)",
  "Bash(node --test:*)",
  "Bash(node scripts/check-docs.mjs)",
  "Bash(node scripts/check-allowed-paths.mjs)",
  // The project's own four commands, added 2026-08-31 in the same commit as .claude/settings.json.
  // They are the invocations named in .ai/standards/testing-standards.md; an allow rule the test
  // does not know about is one a clobber can drop silently.
  "Bash(pnpm exec tsc:*)",
  "Bash(pnpm exec eslint:*)",
  "Bash(pnpm exec vitest:*)",
  "Bash(pnpm exec playwright:*)",
  "Bash(pnpm exec vite:*)",
  "Bash(pnpm install:*)",
];

const REQUIRED_DENY = [
  "Bash(git push --force:*)",
  "Bash(git push origin main:*)",
  "Bash(git reset --hard:*)",
  "Bash(gh pr merge:*)",
  "mcp__clickup__clickup_delete_task",
  "mcp__clickup__clickup_merge_tasks",
  "mcp__clickup__clickup_move_task",
  "mcp__clickup__clickup_send_chat_message",
  "mcp__clickup__clickup_search",
  "mcp__clickup__clickup_get_workspace_hierarchy",
];

// matcher -> the hook scripts that must be wired to it, in order.
//
// chat-guard.mjs appears twice on purpose. It guards two transports: the tool transport
// (Agent | Task | SendMessage) and the file transport (a write to 99-questions.md), and the file
// transport only fires if the hook is wired to Edit|Write as well. Wiring it to one and not the
// other leaves half of RULE-12 as prose — which is exactly how it was wrong before, when the hook
// had no matcher at all.
//
// Order within Edit|Write matters: the path guards run first, so a question file written outside the
// project or into the registry is refused on those grounds before RULE-12 is even considered.
//
// Per ADR-004, guard-project-root.mjs, guard-registry.mjs and guard-allowed-paths.mjs are unwired
// from Edit|Write. This list matches that decision — it is not trimmed to make a red test green,
// which is the failure this whole file exists to catch. The three hook files are still on disk and
// their own tests still pass; restoring them means putting three objects back in settings.json and
// three names back in this list.
const REQUIRED_HOOKS = {
  "Edit|Write": ["chat-guard.mjs"],
  "mcp__clickup__.*": ["guard-tracker-scope.mjs"],
  "Agent|Task|SendMessage": ["chat-guard.mjs"],
  "Read|Grep|Glob|NotebookEdit": ["guard-read-scope.mjs"],
};

const ALL_HOOK_SCRIPTS = [...new Set(Object.values(REQUIRED_HOOKS).flat())];

function loadSettings() {
  const raw = fs.readFileSync(SETTINGS, "utf8");
  return { raw, json: JSON.parse(raw) };
}

test("settings.json exists and is strict-valid JSON with no comments", () => {
  assert.ok(fs.existsSync(SETTINGS), `${SETTINGS} is missing`);
  const raw = fs.readFileSync(SETTINGS, "utf8");
  assert.doesNotThrow(
    () => JSON.parse(raw),
    "settings.json does not parse. A single // comment makes the file unparseable, and an " +
      "unparseable settings file drops the entire deny list and every hook."
  );
});

test("disableClaudeAiConnectors is still true", () => {
  const { json } = loadSettings();
  assert.equal(
    json.disableClaudeAiConnectors,
    true,
    "disableClaudeAiConnectors is not true. It is load-bearing, not cosmetic: without it a coding " +
      "agent inherits mail, calendar, drive, and design connectors from the account it runs under."
  );
});

test("bypassPermissions appears nowhere", () => {
  const { raw } = loadSettings();
  assert.ok(
    !/bypassPermissions/.test(raw),
    "bypassPermissions appears in settings.json. It disables the permission layer wholesale."
  );
});

test("every required allow rule is present", () => {
  const { json } = loadSettings();
  const allow = new Set(json.permissions?.allow ?? []);
  for (const rule of REQUIRED_ALLOW) {
    assert.ok(allow.has(rule), `allow rule missing: ${rule}`);
  }
});

test("every read-only allow rule is present", () => {
  const { json } = loadSettings();
  const allow = new Set(json.permissions?.allow ?? []);
  const missing = REQUIRED_READONLY_ALLOW.filter((rule) => !allow.has(rule));
  assert.deepEqual(
    missing,
    [],
    `read-only allow rules missing: ${missing.join(", ")}. These were added deliberately so that ` +
      `commands which cannot change anything stop generating prompts. Losing them does not fail ` +
      `anything visibly — it just restores the noise that trains reflexive approval. Do not delete ` +
      `one to "clean up" the allow list.`
  );
});

// A guard on the guard. `Bash(cat:*)` is read-only; `Bash(cat:* > f)` is a file write wearing the
// same name. The permission matcher does not parse shell grammar, so a metacharacter inside an
// allow pattern smuggles a write primitive past a list everyone reads as read-only. This asserts
// the rules stay as narrow as they were written — it deliberately checks only the rules above, not
// the whole allow list, which is full of session grants that do legitimately copy and remove files.
test("no read-only allow rule contains a shell metacharacter", () => {
  const FORBIDDEN = /[>|;&`$(){}]|\btee\b|\bsed\b|\brm\b|\bmv\b|\bchmod\b/;
  for (const rule of REQUIRED_READONLY_ALLOW) {
    const body = rule.replace(/^Bash\(/, "").replace(/\)$/, "");
    assert.ok(
      !FORBIDDEN.test(body),
      `read-only allow rule ${rule} contains a shell metacharacter or a write command. A pattern ` +
        `like this grants far more than its name suggests — a redirect turns any reader into a ` +
        `writer. Narrow the rule instead of widening the list.`
    );
  }
});

test("every required deny rule is present", () => {
  const { json } = loadSettings();
  const deny = new Set(json.permissions?.deny ?? []);
  for (const rule of REQUIRED_DENY) {
    assert.ok(
      deny.has(rule),
      `deny rule missing: ${rule} — the deny list has been clobbered or edited. See PERMISSIONS.md ` +
        `for why each entry is there; do not delete one to unblock a session.`
    );
  }
});

test("no rule is both allowed and denied", () => {
  const { json } = loadSettings();
  const allow = new Set(json.permissions?.allow ?? []);
  for (const rule of json.permissions?.deny ?? []) {
    assert.ok(!allow.has(rule), `${rule} appears in both allow and deny`);
  }
});

test("all hook entries are wired, on the right matchers, in order", () => {
  const { json } = loadSettings();
  const pre = json.hooks?.PreToolUse ?? [];
  assert.ok(pre.length > 0, "hooks.PreToolUse is empty — every guard has been dropped");

  for (const [matcher, scripts] of Object.entries(REQUIRED_HOOKS)) {
    const entry = pre.find((e) => e.matcher === matcher);
    assert.ok(entry, `no PreToolUse entry for matcher ${matcher}`);
    const wired = (entry.hooks ?? []).map((h) => h.command ?? "");
    assert.equal(
      wired.length,
      scripts.length,
      `matcher ${matcher} has ${wired.length} hooks, expected ${scripts.length}: ${scripts.join(", ")}`
    );
    scripts.forEach((script, i) => {
      assert.match(
        wired[i],
        new RegExp(script.replace(".", "\\.")),
        `matcher ${matcher} position ${i} should invoke ${script}, got: ${wired[i]}`
      );
    });
  }
});

test("every hook command is node, absolute via CLAUDE_PROJECT_DIR, and not a shell script", () => {
  const { json } = loadSettings();
  for (const entry of json.hooks?.PreToolUse ?? []) {
    for (const h of entry.hooks ?? []) {
      const cmd = h.command ?? "";
      assert.match(cmd, /^node /, `hook command does not start with node: ${cmd}`);
      assert.match(
        cmd,
        /\$CLAUDE_PROJECT_DIR/,
        `hook command has no $CLAUDE_PROJECT_DIR, so it resolves against a varying cwd: ${cmd}`
      );
      assert.ok(
        !/\.sh\b/.test(cmd),
        `hook command references a shell script: ${cmd}. On Windows a .sh hook dies with ` +
          `bad interpreter and fails silently — the guard just stops guarding.`
      );
    }
  }
});

test("every wired hook script exists on disk", () => {
  for (const script of ALL_HOOK_SCRIPTS) {
    const abs = path.join(ROOT, ".claude", "hooks", script);
    assert.ok(fs.existsSync(abs), `settings.json wires ${script}, which does not exist at ${abs}`);
  }
});

test("no hook script on disk is left unwired", () => {
  // Compared against what settings.json actually wires right now, not against REQUIRED_HOOKS.
  // Checking the expected list against itself is vacuous: it stays green while a hook is dropped
  // from the file, which is precisely the clobber this suite exists to catch.
  const { json } = loadSettings();
  const wired = (json.hooks?.PreToolUse ?? [])
    .flatMap((e) => e.hooks ?? [])
    .map((h) => h.command ?? "");

  const dir = path.join(ROOT, ".claude", "hooks");
  const onDisk = fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.endsWith(".mjs"))
    .map((d) => d.name);

  // Deliberately unwired, per ADR-004. Kept on disk rather than deleted so that restoring them is
  // one edit. Naming them here is the point: an unwired guard has to be listed by a human who
  // decided to unwire it, so a hook that quietly falls out of settings.json still fails this test.
  // Removing a name from this set restores the assertion.
  const DELIBERATELY_UNWIRED = new Set([
    "guard-project-root.mjs",
    "guard-registry.mjs",
    "guard-allowed-paths.mjs",
  ]);

  for (const script of onDisk) {
    if (DELIBERATELY_UNWIRED.has(script)) {
      assert.ok(
        !wired.some((cmd) => cmd.includes(script)),
        `${script} is listed as deliberately unwired per ADR-004, but settings.json wires it. ` +
          `If it has been restored, take it out of DELIBERATELY_UNWIRED and put it back in ` +
          `REQUIRED_HOOKS — the two lists must not disagree about what is guarding.`
      );
      continue;
    }
    assert.ok(
      wired.some((cmd) => cmd.includes(script)),
      `${script} exists on disk but is not wired in settings.json — a guard that is never invoked ` +
        `is not a control. Either settings.json has been clobbered, or the hook should be wired ` +
        `or deleted. If it was unwired on purpose, say so in DELIBERATELY_UNWIRED above and write ` +
        `the ADR; do not delete this assertion.`
    );
  }
});
