// RULE-03 in CI — scripts/check-allowed-paths.mjs, the live mechanism since ADR-004 unwired the
// hook. These tests exist because ADR-023 widened it: the ship-owned set now passes on a ticket
// branch so that a ship is one pull request. A widening needs tests in both directions, or the next
// reader cannot tell an exemption from a hole.
//
// Unlike the hook tests, these build a real git repository — the script's whole judgement is a diff
// of origin/<base>...HEAD, so a fake .git/HEAD would test nothing.

import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "check-allowed-paths.mjs"
);

const TICKET = (allowed, id = "TST-01", extra = []) =>
  [
    `id: ${id}`,
    'title: ""',
    "feature_ids: []",
    "state: REVIEW",
    "invariants_touched: []",
    `allowed_paths: ${allowed}`,
    "schema_delta: none",
    "rework_count: 0",
    ...extra,
    "",
  ].join("\n");

function git(root, args) {
  return execFileSync("git", args, {
    cwd: root,
    encoding: "utf8",
    env: { ...process.env, GIT_AUTHOR_NAME: "t", GIT_AUTHOR_EMAIL: "t@t", GIT_COMMITTER_NAME: "t", GIT_COMMITTER_EMAIL: "t@t" },
  }).trim();
}

function writeFile(root, rel, contents) {
  const abs = path.join(root, rel);
  fs.mkdirSync(path.dirname(abs), { recursive: true });
  fs.writeFileSync(abs, contents);
}

// A repository whose main already carries the ticket shell, with origin/main pointing at it, then a
// feat/TST-01 branch carrying `files`. Returns the repo root.
//
// opts (ADR-054): { id — the ticket, default TST-01; ticketExtra — lines appended to its ticket.yaml;
//                   base — files committed on main first; remove — paths deleted on the branch }
function makeRepo(allowedPaths, files, opts = {}) {
  const id = opts.id ?? "TST-01";
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "cap-"));
  git(root, ["init", "--quiet", "-b", "main"]);
  writeFile(root, `.ai/board/tickets/${id}/ticket.yaml`, TICKET(allowedPaths, id, opts.ticketExtra ?? []));
  for (const [rel, contents] of Object.entries(opts.base ?? {})) writeFile(root, rel, contents);
  writeFile(root, ".ai/board/backlog.md", "backlog\n");
  writeFile(root, ".ai/board/metrics.md", "metrics\n");
  writeFile(root, ".ai/registry/features.md", "features\n");
  writeFile(root, "src/app/orders/page.tsx", "before\n");
  writeFile(root, "src/app/invoices/page.tsx", "before\n");
  git(root, ["add", "-A"]);
  git(root, ["commit", "--quiet", "-m", "base"]);
  git(root, ["update-ref", "refs/remotes/origin/main", "HEAD"]);
  git(root, ["switch", "--quiet", "-c", `feat/${id}`]);
  for (const [rel, contents] of Object.entries(files)) writeFile(root, rel, contents);
  for (const rel of opts.remove ?? []) fs.rmSync(path.join(root, rel));
  git(root, ["add", "-A"]);
  git(root, ["commit", "--quiet", "-m", "ship"]);
  return root;
}

// The script reads GITHUB_HEAD_REF/GITHUB_REF before it reads the branch, so a test run inside CI
// would otherwise judge the wrong branch. Strip both.
function run(root) {
  const env = { ...process.env };
  delete env.GITHUB_HEAD_REF;
  delete env.GITHUB_REF;
  delete env.GITHUB_BASE_REF;
  const res = execFileSync("node", [SCRIPT], {
    cwd: root,
    encoding: "utf8",
    env,
  });
  return { code: 0, stdout: res };
}

function runExpectingFail(root) {
  try {
    run(root);
    return null;
  } catch (err) {
    return { code: err.status, stderr: err.stderr ?? "", stdout: err.stdout ?? "" };
  }
}

test("a diff inside allowed_paths passes", () => {
  const root = makeRepo('["src/app/orders/**"]', { "src/app/orders/page.tsx": "after\n" });
  assert.match(run(root).stdout, /allowed-paths: PASS/);
});

test("a path outside allowed_paths still fails", () => {
  const root = makeRepo('["src/app/orders/**"]', { "src/app/invoices/page.tsx": "after\n" });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /src\/app\/invoices\/page\.tsx/);
  assert.match(r.stderr, /RULE-03/);
});

test("the ticket's own folder is exempt", () => {
  const root = makeRepo('["src/app/orders/**"]', {
    ".ai/board/tickets/TST-01/04-review.md": "verdict\n",
  });
  assert.match(run(root).stdout, /allowed-paths: PASS/);
});

// ADR-023, the widening.
test("the ship-owned set passes on a ticket branch", () => {
  const root = makeRepo('["src/app/orders/**"]', {
    "src/app/orders/page.tsx": "after\n",
    ".ai/board/backlog.md": "moved to archive\n",
    ".ai/board/metrics.md": "one more row\n",
    ".ai/registry/features.md": "TST-01 DONE\n",
  });
  assert.match(
    run(root).stdout,
    /allowed-paths: PASS/,
    "a ship must be one branch: backlog, metrics and features ride with the ticket"
  );
});

// ADR-023, the other direction — the exemption is three names, not a category.
test("another .ai/board/ path is still a violation", () => {
  const root = makeRepo('["src/app/orders/**"]', { ".ai/board/model-debt.md": "MD-099\n" });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /model-debt\.md/);
});

test("another .ai/registry/ path is still a violation", () => {
  const root = makeRepo('["src/app/orders/**"]', { ".ai/registry/rules.md": "RULE-19\n" });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /rules\.md/);
});

test("a ticket folder that is not this ticket's is still a violation", () => {
  const root = makeRepo('["src/app/orders/**"]', {
    ".ai/board/tickets/TST-02/01-plan.md": "other ticket\n",
  });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /TST-02/);
});

test("the ship-owned set does not rescue an empty allowed_paths for source files", () => {
  const root = makeRepo("[]", {
    ".ai/board/metrics.md": "one more row\n",
    "src/app/orders/page.tsx": "after\n",
  });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /src\/app\/orders\/page\.tsx/);
});

test("a non-feat branch is not checked at all", () => {
  const root = makeRepo("[]", { "src/app/orders/page.tsx": "after\n" });
  git(root, ["switch", "--quiet", "-c", "ops/model-change"]);
  assert.match(run(root).stdout, /is not feat\/\*/);
});

// ADR-054 — the ticket's own promoting idea file, decided by `isOwnIdea` in scripts/lib/entry.mjs,
// the predicate `planCarry` already uses. **The fixture is the real file that produced the finding**
// (testing-standards.md, fixtures rule): the idea EVT-04 and EVT-05 were both promoted from, whose
// `ticket_id` is the two-ticket string "EVT-04, EVT-05". A fixture written to agree with the check
// would have used one ID, and would have missed that the old whole-string comparison matched neither.
const REAL_IDEA = ".ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md";
const REAL_IDEA_TEXT = fs.readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", REAL_IDEA), "utf8");
const APPENDED = REAL_IDEA_TEXT + "\n**Q6, answered by the operator.** recorded here\n";

test("ADR-054: the ticket's own promoting idea file passes — the second ID of a split ticket_id", () => {
  const root = makeRepo('["src/app/orders/**"]', { [REAL_IDEA]: APPENDED },
    { id: "EVT-05", base: { [REAL_IDEA]: REAL_IDEA_TEXT } });
  const out = run(root).stdout;
  assert.match(out, /allowed-paths: PASS/);
  assert.match(out, /exempt .*2026-10-08-a-person-learns.*ADR-054/);
});

test("ADR-054: the same idea file is a violation on a ticket it did not promote", () => {
  const root = makeRepo('["src/app/orders/**"]', { [REAL_IDEA]: APPENDED },
    { id: "EVT-06", base: { [REAL_IDEA]: REAL_IDEA_TEXT } });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /2026-10-08-a-person-learns/);
});

test("ADR-054: an idea file whose path the ticket.yaml cites passes, with ticket_id empty", () => {
  const idea = ".ai/board/ideas/2026-01-01-cited.md";
  const root = makeRepo('["src/app/orders/**"]', { [idea]: '---\nticket_id: ""\n---\n# cited\n' },
    { ticketExtra: [`# promoted from ${idea}`] });
  assert.match(run(root).stdout, /allowed-paths: PASS/);
});

test("ADR-054: another idea file is still a violation — one file, not the directory", () => {
  const root = makeRepo('["src/app/orders/**"]', {
    ".ai/board/ideas/2026-01-02-other.md": '---\nticket_id: "TST-02"\n---\n# other\n',
  });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /2026-01-02-other\.md/);
});

test("ADR-054: deleting the ticket's own idea file is still a violation", () => {
  const root = makeRepo('["src/app/orders/**"]', {},
    { id: "EVT-05", base: { [REAL_IDEA]: REAL_IDEA_TEXT }, remove: [REAL_IDEA] });
  const r = runExpectingFail(root);
  assert.equal(r?.code, 1);
  assert.match(r.stderr, /2026-10-08-a-person-learns/);
});

// --- trailing comments on allowed_paths items, 2026-10-20 ----------------------------------------
//
// Found on MIR-02: `- "supabase/migrations/…_solo_profile_self_update.sql"   # comment lines only, …`
// was read with its comment attached, matched nothing, and the ticket failed RULE-03 in CI on a path
// it lists. The hook's copy had the same defect; guard-allowed-paths.test.mjs carries the mirror.

test("a trailing comment on a block-sequence item is not part of the path", () => {
  const root = makeRepo(
    '\n  - "src/app/orders/page.tsx"   # why, with a § and a colon: here\n  # a whole-line comment\n  - src/app/invoices/** # bare',
    { "src/app/orders/page.tsx": "after\n", "src/app/invoices/page.tsx": "after\n" }
  );
  const out = run(root).stdout;
  assert.match(out, /allowed-paths: PASS/);
  assert.match(out, /allowed_paths: src\/app\/orders\/page\.tsx, src\/app\/invoices\/\*\*\n/);
});

test("a # inside quotes or without whitespace before it is part of the path", () => {
  const root = makeRepo('\n  - "src/a # b.ts"\n  - src/c#d.ts', { "src/a # b.ts": "x\n", "src/c#d.ts": "x\n" });
  assert.match(run(root).stdout, /allowed-paths: PASS/);
});

test("a trailing comment after an inline list is ignored", () => {
  const root = makeRepo('["src/app/orders/**"]   # [not, a, path]', { "src/app/orders/page.tsx": "after\n" });
  assert.match(run(root).stdout, /allowed_paths: src\/app\/orders\/\*\*\n/);
});

// The fixtures rule: read the real files. Expected values come from scripts/lib/ticket-yaml.mjs, a
// separate parser. Each real ticket that already carries a commented item is checked as it stands;
// one real ticket (the first with concrete paths) is checked with a comment injected on every item.
{
  const { parseSimpleYaml } = await import("../lib/ticket-yaml.mjs");
  const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
  const TICKETS = path.join(REPO, ".ai/board/tickets");
  const concrete = (p) => typeof p === "string" && !/[*?]/.test(p) && !p.endsWith("/");
  const real = [];
  for (const id of fs.readdirSync(TICKETS).sort()) {
    const f = path.join(TICKETS, id, "ticket.yaml");
    if (!fs.existsSync(f)) continue;
    const text = fs.readFileSync(f, "utf8");
    const t = parseSimpleYaml(text, f);
    const paths = (Array.isArray(t.allowed_paths) ? t.allowed_paths : []).filter(concrete);
    if (paths.length) real.push({ id, text, paths });
  }
  const shipOf = ({ id, text, paths }) =>
    makeRepo("[]", Object.fromEntries(paths.map((p) => [p, "changed\n"])), {
      id,
      base: { [`.ai/board/tickets/${id}/ticket.yaml`]: text },
    });

  test("a real ticket.yaml, with a comment injected on every item, passes on its own paths", () => {
    assert.ok(real.length > 0, "no ticket.yaml with a concrete allowed path — this test is inert");
    const t = real[0];
    const injected = t.text.replace(/^(\s+- .*)$/gm, "$1   # injected: a comment");
    assert.match(run(shipOf({ ...t, text: injected })).stdout, /allowed-paths: PASS/, t.id);
  });

  test("every real ticket.yaml whose allowed_paths carries a comment passes on its own paths", () => {
    for (const t of real) {
      const lines = t.text.split(/\r?\n/);
      const commented = t.paths.some((p) =>
        lines.some((l) => /^\s+- /.test(l) && l.includes(p) && /\s#/.test(l.slice(l.indexOf(p) + p.length)))
      );
      if (commented) assert.match(run(shipOf(t)).stdout, /allowed-paths: PASS/, t.id);
    }
  });
}
