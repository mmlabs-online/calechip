---
ticket: BUG-001
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-03T08:43:20+07:00
inputs_read:
  - .ai/board/tickets/BUG-001/01-plan.md
  - .ai/board/tickets/BUG-001/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/01-operating-model.md
  - .claude/hooks/guard-allowed-paths.mjs
  - playwright.config.ts
  - src/App.tsx
  - tests/e2e/smoke.spec.ts
  - tests/e2e/tea-01-signup.spec.ts
consulted: none
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# BUG-001 — implementation log

**Section numbering.** The template says "design section 1", which is the pre-ADR-019 two-artifact
shape. In the merged `01-plan.md` the contract is **section 4** (4.1 `playwright.config.ts`, 4.2
`tests/e2e/seam.setup.ts`). Every "contract item" reference below is to section 4.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `playwright.config.ts` | modified | The suite could not state which seam it drove: `webServer` had no `env` block, so the build inherited the machine's `.env`. Adds the pin, splits `testMatch` per project, and wires the guard as a `chromium` dependency so a wrong seam aborts rather than reports. | §4.1 items 1, 2, 3 |
| `tests/e2e/seam.setup.ts` | created | The pin alone is skipped in the most common local configuration (`reuseExistingServer` returns before `launchProcess` when 4173 already answers), so something has to assert the served page rather than the configuration. | §4.2 |

`git status --porcelain` outside the ticket folder is exactly these two paths. No third file was
touched; `src/lib/data/index.ts`, `tests/e2e/tea-01-signup.spec.ts`, `tests/e2e/smoke.spec.ts`,
`.github/workflows/verify.yml`, `.ai/standards/testing-standards.md` and `package.json` are all
unedited, as §7 requires.

## Contract items

| §4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 item 1 — pin the seam in `webServer.env` | `playwright.config.ts:44-51` | Both `VITE_DATA_SEAM` and `VITE_SUPABASE_URL` pinned, so neither half of the resolver's `\|\|` at `src/lib/data/index.ts:164` is left to the machine. |
| 4.1 item 2 — two projects, `chromium` depends on `seam-guard` | `playwright.config.ts:21-34` | `dependencies: ["seam-guard"]` at `:32`. |
| 4.1 item 3 — remove the top-level `testMatch` | `playwright.config.ts:8-10` | Replaced by a comment saying why it is absent, because the failure of leaving it is silent: the setup file would match no project and the guard would never run. |
| 4.2 — the guard, asserting the served page | `tests/e2e/seam.setup.ts:1-33` | `page.goto("/")` then `getByTestId("seam-banner")` and its `data-seam`. No `process.env`, no `import.meta.env`, no config value is read — verified by inspection of the file, which imports only `@playwright/test`. |

## Deviations from the design

**`none`.**

Both files are the plan's §4 code, with the plan's own comments carried in and extended with the
`file:line` citations it gives in §4.3. `EXPECTED_SEAM`, the assertion message, and the test title —
which is AC-5's whole mechanism — are verbatim from §4.2.

## Invariants

`invariants_touched: []`, so the table below is the argument for the empty list rather than a list of
IDs.

| ID | Still holds because |
|----|---------------------|
| INV-01..INV-07 | All seven range over `entry` and `member` rows. Neither file touched here contains application code: `playwright.config.ts` configures a runner and `seam.setup.ts` reads a rendered page over HTTP. Neither writes a row, computes a count, or is imported by anything that does. `src/lib/data/index.ts` is untouched, so the application's own resolution is byte-identical (AC-9). |
| INV-04, INV-07 (the adjacency) | These are TEA-01's, and the ticket shell records that unpinned runs perturb exactly the data they range over — a run against the live project creates auth users, the admission trigger turns allow-listed ones into `member` rows, and those enter INV-04's denominator. This change **removes** that mechanism. It was verified rather than asserted: the run below was made on a machine carrying a real `.env`, and it drove the mock. |

## Verification run

Commands actually executed on this branch, on a machine **whose `.env` sets a real
`VITE_SUPABASE_URL`** — which is the configured case, the one that produced 4 pass / 6 fail in
ADR-021 and in `.ai/standards/testing-standards.md:36`.

| Command | Exit | Notes |
|---------|------|-------|
| typecheck — `pnpm exec tsc --noEmit` | 0 | |
| lint — `pnpm exec eslint .` | 0 | |
| unit — `pnpm exec vitest run` | 0 | 1 file, 2 tests, all pass. Unchanged by this ticket; `tests/seam-parity.test.ts` is among them and was not edited. |
| end-to-end — `pnpm exec playwright test` | 0 | **11 passed.** 1 guard + 10 existing, in 3 files. |
| `pnpm exec playwright test --list` | 0 | `[seam-guard]` enumerates the guard alone; `[chromium]` enumerates all 10 pre-existing tests. Nothing double-counted, nothing dropped — this is what the removed top-level `testMatch` could have broken silently. |
| `node scripts/check-allowed-paths.mjs` | 0 | Resolves ticket `BUG-001` from the branch and reads both globs. **It reported `0 changed file(s)`** — see *Open questions* item 1; that is the ADR-006 uncommitted-tree case, not a pass on the diff. |
| `git diff --name-only` subset of `allowed_paths` | **yes** | Working tree outside the ticket folder: `playwright.config.ts` (M), `tests/e2e/seam.setup.ts` (??). Both globs, nothing else. |

### The four acceptance criteria a green run does not exercise

A passing suite demonstrates AC-1, AC-2, AC-5, AC-7 and AC-9. The remaining four assert what happens
when something is *wrong*, so each was reproduced deliberately.

| AC | How it was reproduced | Result |
|---|---|---|
| **AC-3** — a wrong seam aborts the run | Built unpinned (`.env` present, so Supabase), served it on 4173 with `vite preview`, then ran `pnpm exec playwright test`. `reuseExistingServer` is true locally, so the runner adopted the wrong server exactly as §8 predicts. | `1 failed … 10 did not run`, exit **1**. No test opened the sign-up form, and no test submitted it. |
| **AC-4** — the guard asserts the page, not the config | Same run as AC-3. The configuration said `mock` throughout; the page did not, and the guard failed. A guard reading `process.env` or the config would have passed that run. | Failed, with the intended message: *"no seam-banner on the served page … Refusing to start the suite."* |
| **AC-6** — exactly one bypass, explicit | With the same wrong server still on 4173: `pnpm exec playwright test --no-deps --project=chromium --grep …` | Exit **0**, 1 passed — the guard did not run and the test did. The bypass exists, requires a person to type it, and is the only one. |
| **AC-8** — a pinned build cannot reach the live project | `vite build` twice on this machine, bundles grepped. | Pinned: `supabase.co` ×0, `createClient` ×0, `seam-banner` ×1. Unpinned: `supabase.co` ×2, `seam-banner` ×0. The Supabase client is not in the pinned bundle at all, and the banner is constant-folded out of the unpinned one — which is why the served page is the only place the answer exists. |

**AC-7 was not re-run in CI and is not claimed as observed.** What is verifiable here is its premise:
`.github/workflows/verify.yml` is unedited and invokes the same `pnpm exec playwright test`, which
loads this config. The assertion that CI now agrees with the local gate is a claim about the next CI
run, and the reviewer can check it on the pull request rather than take it from this file.

## Testability contract

Void as a template section — RULE-05 is retired, plan section 8 is *Rejected alternatives*, and check
R7 no longer exists (ADR-022). The table is kept because on this ticket the assertion **is** a
selector and an attribute value, so a rename in passing would break the guard with nothing to report
it.

| selector | Exists at |
|----------|-----------|
| `data-testid="seam-banner"` | `src/App.tsx:23` — unedited by this ticket. Read by `tests/e2e/seam.setup.ts:27` and, independently, by `tests/e2e/tea-01-signup.spec.ts:53`. |
| `data-seam="mock"` | `src/App.tsx:24` — unedited. Read by `tests/e2e/seam.setup.ts:32` and `tests/e2e/tea-01-signup.spec.ts:55`. |

Both are inside the `seamName === "mock"` branch at `src/App.tsx:21`, which is what makes the
assertion meaningful rather than tautological.

## Open questions

1. **`node scripts/check-allowed-paths.mjs` passes vacuously on this branch today.** It printed
   `ticket BUG-001, 0 changed file(s)` and `PASS`. That is correct behaviour, not a defect: under
   ADR-006 nothing is committed until `/ship`, so there is no diff against the base ref for it to
   read. **The RULE-03 enforcement the plan's §7 argues for therefore arrives at `/ship` and in CI,
   not now.** The hand-check in the *Verification run* table above is what covers the interval, and
   R1 should not read the local `PASS` as having checked the diff.
2. **The ticket arrived in `state: BACKLOG` with `gates.plan: { passed: false }`,** although
   `01-plan.md` carries `gate: PASS` and `next_state: READY`. The DoR evaluation and the
   `PLAN -> READY -> IN_PROGRESS` bookkeeping are the orchestrator's
   (`.ai/01-operating-model.md:285`), and they did not run. `state` is set to `REVIEW` below per this
   command's own instruction; **`gates.plan.passed` is left `false` and is not forged here** — every
   DoR item is in fact satisfied, but recording a gate nobody evaluated would make the ticket look
   adjudicated when it was not. It needs an orchestrator pass, and `/ship` will refuse until it has
   one (`.ai/01-operating-model.md:349`).
3. **`.ai/standards/testing-standards.md:31-41` is now false**, as plan *Open questions* item 2
   predicted. The end-to-end row reads *4 pass, 6 fail*; it is 11 tests in 3 files, all passing, on a
   configured machine. Standards plane, human-only under RULE-01 — **it is owed a human edit**, and
   the paragraph at `:38-41` describing the defect becomes a past-tense record.
4. **Server staleness is untouched and was confirmed reachable.** A preview left running on 4173 from
   a *pinned* build of an older commit passes this guard while testing stale code. The plan names it
   under *Out of scope* as a pre-existing defect this ticket neither creates nor worsens; the AC-3
   reproduction above is the same mechanism with a wrong-seam build instead of a stale one, so it is
   worth recording that the door is real. Not fixed here.
