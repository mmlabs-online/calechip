// check-carry.mjs — what review check R1 runs. ADR-043.
//
// R1 asks one question: is any path in this ticket's working tree outside what the Developer was
// allowed to write? Answering it needs two different rules, because the tree holds two different
// kinds of change.
//
//   - **Committed changes** go to `origin/main...HEAD` and are judged against `allowed_paths`, with
//     the ticket folder and the ship-owned set exempt (ADR-023 for CI, ADR-041 for R1), and the
//     ticket's own promoting idea file by the same `isOwnIdea` this half's `planCarry` uses (ADR-054). That half is
//     `scripts/check-allowed-paths.mjs`, which runs in CI where it cannot be misreported.
//   - **Uncommitted changes** — modified and untracked. Until ADR-048 that was the whole ticket for
//     its whole life; since then it is what the stage since the last `/advance` checkpoint left.
//     They are judged by `planCarry`, which is the same function the runner's preflight uses.
//
// **Before ADR-043 the second half had no reader at REVIEW**, so R1 judged uncommitted paths against
// `allowed_paths` too, and failed CAL-11 on `.ai/board/tickets/CAL-12/ticket.yaml` — a BACKLOG shell
// written by `/triage` from the same PROMOTE, which `/ship` never commits and CI therefore never
// sees. The runner's preflight had already classified that exact path as carried. Two readers of one
// tree, opposite verdicts, for the second time in two days; ADR-041 fixed the first instance by
// writing a prose exempt set, and that set was incomplete the day it was written. This file exists
// so the answer has one implementation rather than three prose copies of it.
//
// Run: node scripts/check-carry.mjs <TICKET-ID>
// Exit 0 when nothing is stray. Exit 1 and list the stray paths otherwise.

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { readTicket, readFrontMatter } from "./lib/ticket-yaml.mjs";
import { ROOT, TICKETS_DIR, carryContext, planCarry, parsePorcelainZ, splitStrayByLanded } from "./lib/entry.mjs";

const id = process.argv[2];
if (!id) {
  console.error("usage: node scripts/check-carry.mjs <TICKET-ID>");
  process.exit(2);
}

const ticketFile = path.join(TICKETS_DIR, id, "ticket.yaml");
if (!fs.existsSync(ticketFile)) {
  console.error(`check-carry: FAIL — no ticket at ${path.relative(ROOT, ticketFile)}`);
  process.exit(2);
}

const ticket = readTicket(ticketFile);

// `-z` because a trimming read eats the status column's leading space; `-uall` because a new ticket
// folder collapsed to `dir/` cannot be checked file by file. Both learned the hard way — the
// 2026-09-22 preflight defects.
const porcelain = execFileSync("git", ["status", "--porcelain=v1", "-z", "--untracked-files=all"],
  { cwd: ROOT, encoding: "utf8" });
const dirty = parsePorcelainZ(porcelain);

const { carried, stray } = planCarry(dirty, carryContext(ticket, dirty, { readFrontMatter, readTicket }));

console.log(`check-carry: ticket ${id}, ${dirty.length} uncommitted path(s)`);
for (const c of carried) console.log(`  carried  ${c.path}  <- ${c.why}`);

// Split the stray list by whether the content already exists on `origin/main`. Both halves fail, and
// `planCarry` is right about both — but they are different problems with different fixes, and a
// reviewer told only "stray" reaches for the wrong one. **The already-landed half is not unmerged
// work**; it is a tree that a steward session left dirty after pushing to `ops/<slug>`, or a ticket
// branch sitting behind `origin/main`. It cost CAL-11 two reviews before this split existed.
function landedOnMain(p) {
  try {
    const row = execFileSync("git", ["ls-tree", "origin/main", "--", p], { cwd: ROOT, encoding: "utf8" });
    const oid = row.trim().split(/\s+/)[2];
    if (!oid) return false;
    return oid === execFileSync("git", ["hash-object", "--", p], { cwd: ROOT, encoding: "utf8" }).trim();
  } catch { return false; }
}

if (stray.length) {
  const { landed, real } = splitStrayByLanded(stray,
    (p) => fs.existsSync(path.join(ROOT, p)) && landedOnMain(p));

  console.error("check-carry: FAIL — uncommitted paths that are not this ticket's (RULE-03):");
  for (const s of real) console.error(`  stray     ${s}`);
  for (const s of landed) console.error(`  landed    ${s}  <- identical to origin/main`);

  if (landed.length) {
    console.error("");
    console.error(`  ${landed.length} path(s) already match origin/main, so no unmerged work is at risk.`);
    console.error("  This is the tree left behind by an ops/<slug> landing, or a branch behind main.");
    console.error("  Restore them and re-run — .ai/standards/git-conventions.md, landing step 3:");
    console.error("    git checkout -- <the tracked ones>");
    console.error("    rm <the untracked ones>");
    console.error("    git merge --ff-only origin/main   # if the branch is also behind");
  }
  if (real.length) {
    console.error("");
    console.error(`  ${real.length} path(s) exist on no ref. That is real work, and deleting it loses it.`);
    console.error("  Land it on ops/<slug> first, then restore. Never restore before the push is verified.");
  }
  process.exit(1);
}

console.log("check-carry: PASS — nothing stray");
