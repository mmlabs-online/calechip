// Minimal readers for the two shapes the loop routes on: `ticket.yaml` and artifact front-matter.
//
// **This is the third copy of a ticket.yaml reader in this repository**, and that is a deliberate
// choice rather than an oversight. `scripts/check-allowed-paths.mjs` has no exports at all and
// `process.exit()`s on both its paths, so importing it from a long-running process would run the
// check and kill the caller. `.claude/hooks/guard-allowed-paths.mjs` carries its own copy and says
// in its own comment that the two "share no library on purpose", because a hook that imports from
// `scripts/` fails differently when `scripts/` is mid-edit. The runner is a third consumer with the
// same argument applying to it. The cost is real: a change to `ticket.yaml`'s shape has to be made
// in three places, and nothing checks that they agree.
//
// **This parser is not a YAML implementation and must never grow into one.** It understands exactly
// the constructs the board actually uses — flat scalars, inline `[lists]` and `{maps}`, one level of
// nesting, block sequences, and folded block scalars — and it throws on anything else rather than
// guessing. A routing input that silently mis-parses is worse than one that refuses: the first
// sends a ticket to the wrong agent, the second stops the run with a filename.

import fs from "node:fs";

/**
 * Strip a trailing ` # comment`, which 27 of 36 ticket.yaml files carry. YAML semantics: `#` opens a
 * comment only at line start or after whitespace, and never inside quotes. Exported for
 * `scripts/check-allowed-paths.mjs`; the hook keeps its own copy (it imports nothing from `scripts/`).
 */
export const stripComment = (s) => {
  let out = "";
  let quote = null;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quote) {
      out += c;
      if (c === quote) quote = null;
      continue;
    }
    if (c === '"' || c === "'") { quote = c; out += c; continue; }
    if (c === "#" && (i === 0 || /\s/.test(s[i - 1]))) break;
    out += c;
  }
  return out.trimEnd();
};

/**
 * True when a value that starts with a quote also ends with that quote, unescaped. `"a\"` is not
 * closed; `'it''s'` is. Used to find where a multi-line quoted scalar ends.
 */
const closesQuote = (v, q = v[0]) => {
  const t = v.trimEnd();
  if (t.length < 2 || !t.endsWith(q)) return false;
  if (q === '"') {
    let bs = 0;
    for (let i = t.length - 2; i >= 0 && t[i] === "\\"; i--) bs++;
    return bs % 2 === 0;
  }
  return true;
};

/** `""` -> "", `null` -> null, `true`/`false` -> boolean, `12` -> number, else the raw string. */
const scalar = (raw) => {
  const v = raw.trim();
  if (v === "" || v === "null" || v === "~") return null;
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+$/.test(v)) return Number(v);
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
};

/** `[]`, `[A, B]`, `[ "a", "b" ]`. Nested structures are refused. */
const inlineList = (raw) => {
  const body = raw.trim().slice(1, -1).trim();
  if (body === "") return [];
  if (/[[\]{}]/.test(body)) throw new Error(`nested inline list is not supported: ${raw}`);
  return body.split(",").map((s) => scalar(s)).filter((s) => s !== null);
};

/** `{ passed: false, at: null }`. One level only. */
const inlineMap = (raw) => {
  const body = raw.trim().slice(1, -1).trim();
  const out = {};
  if (body === "") return out;
  if (/[[\]{}]/.test(body)) throw new Error(`nested inline map is not supported: ${raw}`);
  for (const pair of body.split(",")) {
    const i = pair.indexOf(":");
    if (i === -1) throw new Error(`inline map entry has no colon: ${pair}`);
    out[pair.slice(0, i).trim()] = scalar(pair.slice(i + 1));
  }
  return out;
};

const value = (raw) => {
  const v = raw.trim();
  if (v.startsWith("[")) {
    if (!v.endsWith("]")) throw new Error(`list is not closed on one line: ${raw}`);
    return inlineList(v);
  }
  if (v.startsWith("{")) {
    if (!v.endsWith("}")) throw new Error(`map is not closed on one line: ${raw}`);
    return inlineMap(v);
  }
  return scalar(v);
};

/**
 * Parse the subset of YAML the board actually writes: flat scalars, inline `[lists]` and `{maps}`,
 * one level of nested mappings, block sequences, and folded/literal block scalars. Anything else
 * throws with a file and a line number.
 */
export function parseSimpleYaml(text, label = "<yaml>") {
  const out = {};
  let parentKey = null;   // the key an indented line belongs to
  let pending = false;    // parentKey was opened with an empty value; its shape is not known yet
  const lines = text.split(/\r?\n/);

  for (let n = 0; n < lines.length; n++) {
    const line = stripComment(lines[n]);
    if (line.trim() === "") continue;

    const indent = line.length - line.trimStart().length;
    const body = line.trim();

    // A block sequence item. All 36 ticket.yaml files on the board write `allowed_paths`,
    // `feature_ids` and `invariants_touched` this way, often with a comment block between the key
    // and its first item, so the key's shape cannot be decided until an item is seen.
    if (body.startsWith("- ")) {
      if (parentKey === null) throw new Error(`${label}:${n + 1} list item has no key above it`);
      if (pending) { out[parentKey] = []; pending = false; }
      if (!Array.isArray(out[parentKey])) {
        throw new Error(`${label}:${n + 1} ${parentKey} already holds a map; it cannot also be a list`);
      }
      const item = scalar(body.slice(2));
      if (item !== null) out[parentKey].push(item);
      continue;
    }

    const colon = body.indexOf(":");
    if (colon === -1) throw new Error(`${label}:${n + 1} line has no key: ${body}`);

    const key = body.slice(0, colon).trim();
    let rest = body.slice(colon + 1);

    // A quoted scalar that runs over several lines, which YAML folds into one line with a space at
    // each break. Agents write `blocking_reason: "…` this way when the reason is long; until
    // 2026-10-23 that threw "indented line has no parent key" and took the runner down with it
    // (MIR-08, run 20261023-044304). Continuation lines are read raw: stripComment works one line
    // at a time and cannot know it is inside a quote.
    const opened = rest.trim();
    if ((opened.startsWith('"') || opened.startsWith("'")) && !closesQuote(opened)) {
      const parts = [opened];
      let m = n + 1;
      for (; m < lines.length; m++) {
        const cont = lines[m].trim();
        parts.push(cont);
        if (closesQuote(opened[0] + cont, opened[0])) break;
      }
      if (m >= lines.length) throw new Error(`${label}:${n + 1} quoted value for ${key} is never closed`);
      rest = " " + parts.filter((x) => x !== "").join(" ");
      n = m;
    }

    // Folded (`>`) or literal (`|`) block scalar, with an optional chomping indicator.
    // `schema_delta` is written this way on five tickets, because Definition of Ready item 4 asks
    // for an argument — "none, or an ADR" — and the argument did not fit on one line.
    const block = /^([>|])([-+]?)\s*$/.exec(rest.trim());
    if (block) {
      const fold = block[1] === ">";
      const collected = [];
      let m = n + 1;
      for (; m < lines.length; m++) {
        const raw = lines[m];
        if (raw.trim() === "") { collected.push(""); continue; }
        const ri = raw.length - raw.trimStart().length;
        if (ri <= indent) break;
        collected.push(raw.trim());
      }
      while (collected.length && collected.at(-1) === "") collected.pop();
      const text = fold
        ? collected.reduce((acc, l) => (l === "" ? acc + "\n" : acc === "" || acc.endsWith("\n") ? acc + l : acc + " " + l), "")
        : collected.join("\n");
      n = m - 1;
      if (indent === 0) { parentKey = null; pending = false; out[key] = text; }
      else {
        if (parentKey === null) throw new Error(`${label}:${n + 1} indented block scalar has no parent key`);
        if (pending) { out[parentKey] = {}; pending = false; }
        out[parentKey][key] = text;
      }
      continue;
    }

    if (indent === 0) {
      if (rest.trim() === "") { parentKey = key; pending = true; out[key] = {}; continue; }
      parentKey = null;
      pending = false;
      out[key] = value(rest);
      continue;
    }

    if (parentKey === null) throw new Error(`${label}:${n + 1} indented line has no parent key`);
    if (indent > 6) throw new Error(`${label}:${n + 1} nesting deeper than one level is not supported`);
    if (pending) { out[parentKey] = {}; pending = false; }
    if (Array.isArray(out[parentKey])) {
      throw new Error(`${label}:${n + 1} ${parentKey} already holds a list; it cannot also be a map`);
    }
    out[parentKey][key] = value(rest);
  }

  // A key opened with nothing under it is an empty list far more often than an empty map on this
  // board — `feature_ids:` and `depends_on:` are both written that way — but guessing either would
  // be a silent answer. Leave the empty object: every consumer here uses `?? []` or `?.`.
  return out;
}

/** Read `.ai/board/tickets/<ID>/ticket.yaml`. Throws if the file is unreadable or unparseable. */
export function readTicket(file) {
  const t = parseSimpleYaml(fs.readFileSync(file, "utf8"), file);
  if (!t.id) throw new Error(`${file} has no \`id\``);
  if (!t.state) throw new Error(`${file} has no \`state\``);
  return t;
}

/**
 * Read the YAML front-matter of a Markdown artifact — the block between the first two `---` lines.
 * Returns null when the file has no front-matter, which is a different answer from an empty one.
 */
export function readFrontMatter(file) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, "utf8");
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  return parseSimpleYaml(m[1], file);
}

/** The nine values in `.ai/01-operating-model.md`. Anything else is a corrupt ticket. */
export const STATES = [
  "TRIAGE", "BACKLOG", "PLAN", "READY",
  "IN_PROGRESS", "REVIEW", "REWORK", "ESCALATED", "DONE",
];

/** `feat/<ID>` — computed, never read from `ticket.yaml`, whose `branch:` is empty until `/ship`. */
export const branchFor = (id) => `feat/${id}`;
