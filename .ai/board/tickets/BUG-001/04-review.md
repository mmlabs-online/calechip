---
ticket: BUG-001
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-03T08:48:29+07:00
inputs_read:
  - .ai/board/tickets/BUG-001/01-plan.md
  - .ai/board/tickets/BUG-001/03-impl-log.md
  - .ai/board/tickets/BUG-001/ticket.yaml
  - playwright.config.ts
  - tests/e2e/seam.setup.ts
  - src/App.tsx
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/standards/architecture.md
  - .ai/01-operating-model.md
  - scripts/check-allowed-paths.mjs
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# BUG-001 — review report

Isolated dispatch, fresh session, files only. No message channel to the Developer was opened and none
exists; `chat_before_verdict: none` is literally true.

`next_state` is `DONE`, not `QA`. The template still carries `QA` because it predates ADR-022;
ADR-022:47 gives the state line as `... IN_PROGRESS -> REVIEW -> DONE` and ADR-022:112 calls REVIEW
the only remaining gate.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/BUG-001/ticket.yaml:52-54` vs the two changed paths — `playwright.config.ts:8` (M) and `tests/e2e/seam.setup.ts:1` (new) |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, run in this session |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, run in this session |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `tests/e2e/seam.setup.ts:1` and `playwright.config.ts:1` — both import `@playwright/test` and nothing else; no file under `src/lib/data/` is in the diff |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | table below |
| R6 | Permission gating matches plan section 3 | PASS | `01-plan.md` §3 claims no role gate applies; the diff adds no route, control or row read — `playwright.config.ts:19-53` is runner configuration and `tests/e2e/seam.setup.ts:24-32` performs one anonymous `GET /` and two DOM assertions |
| R7 | No invariant violated (RULE-07) | PASS | table below |
| R8 | No dependency added without an ADR | PASS | `package.json` and `pnpm-lock.yaml` are absent from `git status --porcelain`; `tests/e2e/seam.setup.ts:1` imports only `@playwright/test@1.62.1`, already at `package.json:30` |

## R1 detail — the hand check, and why it was still made

`scripts/check-allowed-paths.mjs` was run in this session and reported `ticket BUG-001, 0 changed
file(s) … PASS`. **That PASS is vacuous and was not counted.** Under ADR-006 nothing is committed
before `/ship`, so `:107` diffs `origin/main...HEAD` and finds nothing; `03-impl-log.md` *Open
questions* item 1 says the same and is correct to. R1 above is the hand check against the working
tree:

| Changed path | Status | Matched by |
|---|---|---|
| `playwright.config.ts` | modified | `ticket.yaml:53` `"playwright.config.ts"` |
| `tests/e2e/seam.setup.ts` | new | `ticket.yaml:54` `"tests/e2e/seam.setup.ts"` |

Everything else in `git status --porcelain` is under `.ai/board/tickets/BUG-001/`, which
`check-allowed-paths.mjs:119-120` exempts by construction. No third file exists in the tree. The six
files `01-plan.md` §7 lists as deliberately absent — `src/lib/data/index.ts`,
`tests/e2e/tea-01-signup.spec.ts`, `tests/e2e/smoke.spec.ts`, `.github/workflows/verify.yml`,
`.ai/standards/testing-standards.md`, `package.json` — are each unmodified, checked individually.

## R5 detail

One row per contract item in `01-plan.md` section 4.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 item 1 — pin the seam in `webServer.env` | `playwright.config.ts:49-52` | Yes. `VITE_DATA_SEAM: "mock"` and `VITE_SUPABASE_URL: ""`, both halves of the resolver's `\|\|` at `src/lib/data/index.ts:164`. `command`, `url` and `reuseExistingServer` at `:39-41` are unchanged from the pre-ticket file, as §4.1 requires |
| §4.1 item 2 — two projects, `chromium` declaring `seam-guard` in `dependencies` | `playwright.config.ts:24-34` | Yes. `seam-guard` with `testMatch: /seam\.setup\.ts$/` at `:25-26`; `chromium` with `testMatch: /.*\.spec\.ts$/` and `dependencies: ["seam-guard"]` at `:30-33` |
| §4.1 item 3 — the top-level `testMatch` is removed | `playwright.config.ts:8-10` | Yes. Replaced by a comment stating the silent failure it prevents. Verified by enumeration, not by reading: `playwright test --list` gives `[seam-guard]` the guard alone and `[chromium]` all ten pre-existing tests — 11 tests in 3 files, none dropped, none double-counted |
| §4.2 — the guard file, asserting the served page | `tests/e2e/seam.setup.ts:16-33` | Yes. `EXPECTED_SEAM` at `:16`, the AC-5 test title at `:21`, `page.goto("/")` at `:24`, `getByTestId("seam-banner")` at `:26`, the refusal message at `:29-30`, `toHaveAttribute("data-seam", …)` at `:32`. The file's only import is `@playwright/test` at `:1` — no `process.env`, no `import.meta.env`, no config value, which is §4.2's stated requirement and AC-4 |

The two selectors the guard depends on exist unedited in the markup: `data-testid="seam-banner"` at
`src/App.tsx:23` and `data-seam="mock"` at `src/App.tsx:24`, both inside the `seamName === "mock"`
branch at `src/App.tsx:21` — so the assertion is falsifiable rather than tautological.

**Deviations claimed `none` by `03-impl-log.md`, and confirmed none.** The two files carry the plan's
code with its comments extended by `file:line` citations. No behaviour differs from §4.

### Two things checked because a green run does not prove them

- **AC-5 under the CI reporter.** `01-plan.md` §4.2 rests AC-5 on "Playwright's reporter prints the
  project name and the test title on every run", and CI uses `line` rather than `list`
  (`playwright.config.ts:14`). Read rather than assumed: `LineReporter.onTestBegin` calls
  `_updateLine`, which writes prefix and title to stdout unconditionally
  (`playwright/lib/runner/index.js:4547-4548,4584-4596`). The cursor-up escape is a no-op in a CI log,
  so `[seam-guard] › … drives the "mock" seam …` appears in both configurations. §4.2's premise holds.
- **AC-6's claim that `--no-deps` is the only bypass.** `--grep` was the obvious counter-example — a
  filter that excluded the guard's title would reach the tests without it. It does not:
  `playwright test --list --grep "AC-1"` still enumerates
  `[seam-guard] › seam.setup.ts:21:1`, because Playwright exempts dependency projects from grep
  filtering. `--project=chromium` likewise pulls the guard in.

## R7 detail

`invariants_touched: []` at `ticket.yaml:34`. Per the template, the empty list is reasoned per ID
rather than asserted, and `.ai/registry/invariants.md` warns that concluding "none" from safe
behaviour is circular — so the mechanism is stated.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no self-overlapping entries | Unreachable. Neither changed file creates, edits or reads an `entry`. | `tests/e2e/seam.setup.ts:24-32` is one `GET /` and two DOM assertions; `playwright.config.ts:39` runs `vite build && vite preview` |
| INV-02 — an edited approved entry returns to `pending` | Unreachable, same mechanism. | `.ai/registry/invariants.md:34`; no approval path is in the diff |
| INV-03 — a rejected entry carries a reason | Unreachable, same mechanism. | `.ai/registry/invariants.md:35` |
| INV-04 — the absence-count definition | Unreachable, **and strengthened.** The count is computed in `src/lib/data/`, which is untouched. The adjacency runs the other way: an unpinned run created auth users in the live project, the admission trigger turned allow-listed ones into `member` rows, and those entered INV-04's denominator. The pin removes that mechanism. | `.ai/registry/invariants.md:36`; `playwright.config.ts:49-52`; verified below rather than argued |
| INV-05 — a tentative entry counts as a non-tentative one | Unreachable, same mechanism. | `.ai/registry/invariants.md:37` |
| INV-06 — one portion per entry, applied to every date | Unreachable, same mechanism. | `.ai/registry/invariants.md:38` |
| INV-07 — every entry belongs to exactly one member | Unreachable, and strengthened by the same removal as INV-04. | `.ai/registry/invariants.md:39` |

**INV-04 and INV-07 were verified rather than reasoned about.** This session ran
`pnpm exec playwright test` on a machine carrying a real `.env` with `VITE_SUPABASE_URL` set
(the configured case — the one that produced 4 pass / 6 fail in ADR-021), with port 4173 free so the
`reuseExistingServer` path could not mask the result. **11 passed in 4.1s, including
`[seam-guard]` and `tea-01-signup.spec.ts:52`'s independent `data-seam` assertion.** A run that drove
Supabase could not have passed either. No row was written in either datastore.

No invariant is held here by a UI affordance; all seven are held by the absence of any code path.

## Findings

None. No routing row applies.

| # | Check | Finding | Routes to | Increments `rework_count` |
|---|---|---|---|---|
| — | — | — | — | — |

## Recorded, outside the gate

Neither of these is an R-check failure and neither changes the verdict. Both are stated because they
are true and because `/ship` meets the first one.

1. **`gates.plan.passed` is `false` and the ticket skipped READY and IN_PROGRESS.** `ticket.yaml:56`
   carries `plan: { passed: false, at: null }` while `01-plan.md` front-matter carries `gate: PASS` /
   `next_state: READY`. The orchestrator's DoR evaluation never ran
   (`.ai/01-operating-model.md:285`). The Developer named this at `03-impl-log.md` *Open questions*
   item 2 and declined to forge it, which was the right call. **No R-check covers gate bookkeeping and
   this review does not touch `ticket.yaml`** — but `/ship` requires `passed: true`
   (`.ai/01-operating-model.md:349`), so it needs an orchestrator pass before shipping. Reviewing the
   DoR items on their merits: every one is satisfied.
2. **`.ai/standards/testing-standards.md:31-41` is now false.** It records *end-to-end — 4 pass,
   6 fail*; the measured figure on a configured machine is 11 passing in 3 files. Standards plane,
   human-only under RULE-01, predicted at `01-plan.md` *Open questions* item 2 and re-reported at
   `03-impl-log.md` item 3. It is owed a human edit and no agent may make it.

## Verdict

**`PASS`.** R1 through R8 pass, each citing `file:line`. The ticket advances to `DONE`.

Not a comment held back from the checklist: what this ticket claims — a harness that states which
datastore it drove and refuses to run against the wrong one — was reproduced in this session on the
machine configuration that produced the original defect, and the guard's own abort behaviour is the
one part taken from `03-impl-log.md`'s reproduction rather than re-run here, since reproducing it
requires deliberately serving an unpinned build against the live project.
