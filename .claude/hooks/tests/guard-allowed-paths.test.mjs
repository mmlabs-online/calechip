// RULE-03 — an agent may not edit any file outside the active ticket's allowed_paths.

import test from "node:test";
import assert from "node:assert/strict";
import { makeProject, runHook, runHookRaw, detachedHead, TICKET } from "./_harness.mjs";

const HOOK = "guard-allowed-paths.mjs";
const write = (file_path) => ({ tool_name: "Write", tool_input: { file_path, content: "x" } });
const TICKET_FILE = ".ai/board/tickets/TST-01/ticket.yaml";

test("allows everything on a non-feat branch", () => {
  const root = makeProject({}, "main");
  assert.equal(runHook(HOOK, root, write("src/anything.ts")).code, 0);
});

test("allows everything on a chore branch", () => {
  const root = makeProject({}, "ops/bootstrap");
  assert.equal(runHook(HOOK, root, write("src/anything.ts")).code, 0);
});

test("allows a detached HEAD", () => {
  const root = makeProject({}, "main");
  detachedHead(root);
  assert.equal(runHook(HOOK, root, write("src/anything.ts")).code, 0);
});

test("empty allowed_paths blocks src", () => {
  const root = makeProject({ [TICKET_FILE]: TICKET() }, "feat/TST-01");
  const r = runHook(HOOK, root, write("src/anything.ts"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /allowed_paths is empty/);
  assert.match(r.stderr, /RULE-03/);
});

test("empty allowed_paths blocks everything outside the ticket folder, not only src", () => {
  const root = makeProject({ [TICKET_FILE]: TICKET() }, "feat/TST-01");
  assert.equal(runHook(HOOK, root, write("tests/e2e/smoke.spec.ts")).code, 2);
});

test("the ticket folder stays writable while allowed_paths is empty", () => {
  const root = makeProject({ [TICKET_FILE]: TICKET() }, "feat/TST-01");
  const r = runHook(HOOK, root, write(".ai/board/tickets/TST-01/03-impl-log.md"));
  assert.equal(r.code, 0, "stage artifacts must be writable before DESIGN enumerates paths");
});

test("allows a path inside allowed_paths", () => {
  const root = makeProject(
    { [TICKET_FILE]: TICKET({ allowed_paths: '["src/app/orders/**", "src/lib/data/mock/orders.ts"]' }) },
    "feat/TST-01"
  );
  assert.equal(runHook(HOOK, root, write("src/app/orders/page.tsx")).code, 0);
  assert.equal(runHook(HOOK, root, write("src/lib/data/mock/orders.ts")).code, 0);
});

test("blocks a sibling path that the glob does not cover", () => {
  const root = makeProject(
    { [TICKET_FILE]: TICKET({ allowed_paths: '["src/app/orders/**"]' }) },
    "feat/TST-01"
  );
  const r = runHook(HOOK, root, write("src/app/invoices/page.tsx"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /not in ticket TST-01 allowed_paths/);
});

test("single star does not cross a directory boundary", () => {
  const root = makeProject(
    { [TICKET_FILE]: TICKET({ allowed_paths: '["src/app/*.tsx"]' }) },
    "feat/TST-01"
  );
  assert.equal(runHook(HOOK, root, write("src/app/page.tsx")).code, 0);
  assert.equal(runHook(HOOK, root, write("src/app/orders/page.tsx")).code, 2);
});

test("block-sequence allowed_paths parses", () => {
  const yaml = TICKET().replace("allowed_paths: []", "allowed_paths:\n  - src/app/orders/**");
  const root = makeProject({ [TICKET_FILE]: yaml }, "feat/TST-01");
  assert.equal(runHook(HOOK, root, write("src/app/orders/page.tsx")).code, 0);
  assert.equal(runHook(HOOK, root, write("src/app/invoices/page.tsx")).code, 2);
});

test("blocks a write that escapes the repository", () => {
  const root = makeProject(
    { [TICKET_FILE]: TICKET({ allowed_paths: '["src/**"]' }) },
    "feat/TST-01"
  );
  const r = runHook(HOOK, root, write("../outside.ts"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /outside the repository/);
});

test("fails closed when the branch names a ticket that does not exist", () => {
  const root = makeProject({}, "feat/TST-99");
  const r = runHook(HOOK, root, write("src/anything.ts"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /failing closed/);
});

test("fails closed on unparseable stdin", () => {
  const root = makeProject({ [TICKET_FILE]: TICKET() }, "feat/TST-01");
  assert.equal(runHookRaw(HOOK, root, "{oops").code, 2);
});

// --- the ship-owned set, ADR-023 -----------------------------------------------------------------
//
// These mirror the CI tests in scripts/tests/check-allowed-paths.test.mjs. The two mechanisms carry
// separate copies of the same three names — they share no library on purpose — so they need separate
// proof that the copies still agree, and separate proof that neither has widened into a prefix.

test("the ship-owned set is writable on a ticket branch", () => {
  const root = makeProject(
    { [TICKET_FILE]: TICKET({ allowed_paths: '["src/app/orders/**"]' }) },
    "feat/TST-01"
  );
  for (const p of [".ai/board/backlog.md", ".ai/board/metrics.md", ".ai/registry/features.md"]) {
    assert.equal(runHook(HOOK, root, write(p)).code, 0, `${p} is ship-owned (ADR-023)`);
  }
});

test("the ship-owned set is writable even while allowed_paths is empty", () => {
  const root = makeProject({ [TICKET_FILE]: TICKET() }, "feat/TST-01");
  assert.equal(runHook(HOOK, root, write(".ai/board/metrics.md")).code, 0);
});

test("the exemption is three names, not the .ai/board/ prefix", () => {
  const root = makeProject({ [TICKET_FILE]: TICKET({ allowed_paths: '["src/**"]' }) }, "feat/TST-01");
  const r = runHook(HOOK, root, write(".ai/board/model-debt.md"));
  assert.equal(r.code, 2);
  assert.match(r.stderr, /RULE-03/);
});

test("the exemption is three names, not the .ai/registry/ prefix", () => {
  const root = makeProject({ [TICKET_FILE]: TICKET({ allowed_paths: '["src/**"]' }) }, "feat/TST-01");
  assert.equal(runHook(HOOK, root, write(".ai/registry/rules.md")).code, 2);
});

test("a ship-owned basename nested somewhere else is still blocked", () => {
  const root = makeProject({ [TICKET_FILE]: TICKET({ allowed_paths: '["src/**"]' }) }, "feat/TST-01");
  assert.equal(runHook(HOOK, root, write("docs/.ai/board/metrics.md")).code, 2);
});

// --- trailing comments on allowed_paths items, 2026-10-20 ----------------------------------------
//
// `- "a/b.sql"   # why` used to yield the glob `a/b.sql"   # why`, which matches nothing. Found on
// MIR-02, whose own allowed path was refused. YAML semantics: `#` opens a comment only at line start
// or after whitespace, never inside quotes.

test("a trailing comment on a block-sequence item is not part of the path", () => {
  const yaml = TICKET().replace(
    "allowed_paths: []",
    'allowed_paths:\n  - "src/app/orders/page.tsx"   # why, with a § and a colon: here\n  - src/lib/** # bare\n  # a whole-line comment between items\n  - tests/a.ts'
  );
  const root = makeProject({ [TICKET_FILE]: yaml }, "feat/TST-01");
  assert.equal(runHook(HOOK, root, write("src/app/orders/page.tsx")).code, 0);
  assert.equal(runHook(HOOK, root, write("src/lib/data/x.ts")).code, 0);
  assert.equal(runHook(HOOK, root, write("tests/a.ts")).code, 0, "a comment line must not end the list");
});

test("a # inside quotes or without whitespace before it is part of the path", () => {
  const yaml = TICKET().replace(
    "allowed_paths: []",
    'allowed_paths:\n  - "src/a # b.ts"\n  - src/c#d.ts'
  );
  const root = makeProject({ [TICKET_FILE]: yaml }, "feat/TST-01");
  assert.equal(runHook(HOOK, root, write("src/a # b.ts")).code, 0);
  assert.equal(runHook(HOOK, root, write("src/c#d.ts")).code, 0);
  assert.equal(runHook(HOOK, root, write("src/a")).code, 2);
});

test("a trailing comment after an inline list is ignored", () => {
  const root = makeProject(
    { [TICKET_FILE]: TICKET({ allowed_paths: '["src/app/orders/**"]   # [not, a, path]' }) },
    "feat/TST-01"
  );
  assert.equal(runHook(HOOK, root, write("src/app/orders/page.tsx")).code, 0);
  assert.equal(runHook(HOOK, root, write("not")).code, 2);
});

// The fixtures rule (testing-standards.md § Fixtures that share the implementation's assumptions):
// read the real files. Every ticket.yaml on the board is copied, a comment is injected after every
// list item, and its first and last concrete allowed path must still be writable. Expected values
// come from scripts/lib/ticket-yaml.mjs — a separate parser — not from the hook's own reader.
{
  const { parseSimpleYaml } = await import("../../../scripts/lib/ticket-yaml.mjs");
  const fsm = await import("node:fs");
  const pathm = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const REPO = pathm.resolve(pathm.dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const TICKETS = pathm.join(REPO, ".ai/board/tickets");
  const concrete = (p) => typeof p === "string" && !/[*?]/.test(p) && !p.endsWith("/");

  const real = [];
  for (const id of fsm.readdirSync(TICKETS).sort()) {
    const f = pathm.join(TICKETS, id, "ticket.yaml");
    if (!fsm.existsSync(f)) continue;
    const text = fsm.readFileSync(f, "utf8");
    const t = parseSimpleYaml(text, f);
    const paths = (Array.isArray(t.allowed_paths) ? t.allowed_paths : []).filter(concrete);
    if (paths.length) real.push({ id, text, paths });
  }

  test("the board has real tickets to read", () => {
    assert.ok(real.length > 0, "no ticket.yaml with a concrete allowed path — this block is inert");
  });

  test("every real ticket.yaml, with a comment injected on every item, still allows its own paths", () => {
    for (const { id, text, paths } of real) {
      const injected = text.replace(/^(\s+- .*)$/gm, "$1   # injected: a comment");
      const root = makeProject({ [`.ai/board/tickets/${id}/ticket.yaml`]: injected }, `feat/${id}`);
      for (const p of new Set([paths[0], paths.at(-1)])) {
        assert.equal(runHook(HOOK, root, write(p)).code, 0, `${id}: ${p}`);
      }
    }
  });

  test("every real allowed_paths item that already carries a comment is allowed as it stands", () => {
    for (const { id, text, paths } of real) {
      const commented = paths.filter((p) =>
        text.split(/\r?\n/).some((l) => l.includes(p) && /^\s+- /.test(l) && /\s#/.test(l.slice(l.indexOf(p) + p.length)))
      );
      if (!commented.length) continue;
      const root = makeProject({ [`.ai/board/tickets/${id}/ticket.yaml`]: text }, `feat/${id}`);
      for (const p of commented) assert.equal(runHook(HOOK, root, write(p)).code, 0, `${id}: ${p}`);
    }
  });
}
