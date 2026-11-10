// check-mir-tracking.mjs — keeps the MIR status index and the feature change log alive.
//
// Three conditions, each named in the failure message:
//   1. A changed path matching `_mir[0-9]+_` or `mir-[0-9]+-` requires the status index to change too.
//   2. If 1 holds, the PR body carries a line `FEATURE-IMPACT: none`, or the feature change log
//      changes by more than whitespace.
//   3. If the PR body sets DONE for a phase 0 or phase 3 item, its `Verified` line is non-empty.
//      The phase is read from the status index, never from an ID range.
//
// The filename patterns are the repository's own: migrations `<timestamp>_mir07_<slug>.sql`, as
// `_cal11_`; end-to-end specs `mir-07-<slug>.spec.ts`, as `cal-12-`. See the status index.
//
// CI:     node .github/scripts/check-mir-tracking.mjs
//         (base from GITHUB_BASE_REF, body from the pull_request event at GITHUB_EVENT_PATH)
// Local:  node .github/scripts/check-mir-tracking.mjs --base main --body-file pr-body.md
//
// eslint.config.js gives Node globals to scripts/ and .claude/hooks/ only; declared here rather
// than by editing that file.
/* global process, console */

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const STATUS_INDEX = ".ai/board/plans/multi-tenancy-status.md";
const CHANGE_LOG = ".ai/board/plans/feature-change-log.md";
const MIR_PATH = /_mir[0-9]+_|mir-[0-9]+-/;
const VERIFY_PHASES = new Set(["0", "3"]);

function arg(name) {
  const i = process.argv.indexOf(name);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function git(args) {
  return execFileSync("git", args, { encoding: "utf8" }).trim();
}

function baseRef() {
  const base = arg("--base") || process.env.GITHUB_BASE_REF || "main";
  try {
    git(["rev-parse", "--verify", "--quiet", `origin/${base}`]);
    return `origin/${base}`;
  } catch {
    return base;
  }
}

function prBody() {
  const file = arg("--body-file");
  if (file) return fs.readFileSync(file, "utf8");
  const event = process.env.GITHUB_EVENT_PATH;
  if (event && fs.existsSync(event)) {
    return JSON.parse(fs.readFileSync(event, "utf8")).pull_request?.body ?? "";
  }
  return "";
}

// The template's own HTML comment names `FEATURE-IMPACT: none` on a line of its own; it must not count.
const withoutComments = (s) => s.replace(/<!--[\s\S]*?-->/g, "");

function bodyField(body, label) {
  const m = new RegExp(`^\\s*-\\s*${label}[^:\\n]*:[ \\t]*(.*)$`, "m").exec(body);
  return m ? m[1].trim() : null;
}

function substantiveChange(base, file) {
  const diff = git(["diff", "-w", "--ignore-blank-lines", "--unified=0", `${base}...HEAD`, "--", file]);
  return diff.split(/\r?\n/).some((l) => /^[+-]/.test(l) && !/^(\+\+\+|---) /.test(l));
}

function phasesFromIndex() {
  const phases = new Map();
  if (!fs.existsSync(STATUS_INDEX)) return phases;
  for (const line of fs.readFileSync(STATUS_INDEX, "utf8").split(/\r?\n/)) {
    const m = /^\|\s*(MIR-\d+)\s*\|\s*(\d+)\s*\|/.exec(line);
    if (m) phases.set(m[1], m[2]);
  }
  return phases;
}

const base = baseRef();
const changed = git(["diff", "--name-only", `${base}...HEAD`]).split(/\r?\n/).filter(Boolean);
const body = withoutComments(prBody());
const failures = [];

// --- condition 1 ---------------------------------------------------------------------------------
const mirPaths = changed.filter((f) => MIR_PATH.test(path.posix.basename(f)));
const touchesMir = mirPaths.length > 0;
if (touchesMir && !changed.includes(STATUS_INDEX)) {
  failures.push(
    `condition 1 not met: ${mirPaths.join(", ")} changed, but ${STATUS_INDEX} did not. ` +
      `Update the item's Status in the index in this pull request.`,
  );
}

// --- condition 2 ---------------------------------------------------------------------------------
if (touchesMir) {
  const declaredNone = body
    .split(/\r?\n/)
    .some((l) => l.trim().replace(/^`(.*)`$/, "$1") === "FEATURE-IMPACT: none");
  const logChanged = changed.includes(CHANGE_LOG) && substantiveChange(base, CHANGE_LOG);
  if (!declaredNone && !logChanged) {
    failures.push(
      `condition 2 not met: a MIR path changed, but the PR body has no line reading exactly ` +
        `"FEATURE-IMPACT: none" and ${CHANGE_LOG} has no non-whitespace change.`,
    );
  }
}

// --- condition 3 ---------------------------------------------------------------------------------
const ids = [...new Set((bodyField(body, "MIR item\\(s\\)") ?? "").match(/MIR-\d+/g) ?? [])];
if (ids.length) {
  const status = bodyField(body, "Status after this PR") ?? "";
  const done = /\bDONE\b/.test(status);
  const ambiguous = done && /\bIN_PROGRESS\b/.test(status);
  const phases = phasesFromIndex();
  const unknown = ids.filter((id) => !phases.has(id));
  if (unknown.length) {
    failures.push(`condition 3 not met: ${unknown.join(", ")} not found in ${STATUS_INDEX}, so its phase cannot be read.`);
  }
  const needVerify = ids.filter((id) => VERIFY_PHASES.has(phases.get(id)));
  if (needVerify.length && done) {
    const verified = bodyField(body, "Verified") ?? "";
    const empty = verified === "" || /^<.*>$/.test(verified);
    if (ambiguous) {
      failures.push(
        `condition 3 not met: "Status after this PR" names both IN_PROGRESS and DONE for ` +
          `${needVerify.join(", ")} (phase 0/3). Keep one.`,
      );
    } else if (empty) {
      failures.push(
        `condition 3 not met: the PR body sets DONE for ${needVerify.join(", ")} (phase 0/3), ` +
          `and its "Verified" line is empty. State how it was proven and against what — not a mock test.`,
      );
    }
  }
}

if (failures.length) {
  for (const f of failures) console.error(`check-mir-tracking: ${f}`);
  process.exit(1);
}
console.log(
  `check-mir-tracking: ok — ${changed.length} changed file(s), ` +
    `${mirPaths.length} MIR path(s), ${ids.length} MIR item(s) in the PR body.`,
);
