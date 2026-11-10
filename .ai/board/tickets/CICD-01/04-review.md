---
ticket: CICD-01
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-10-13T13:58:41+00:00
inputs_read: [ .ai/board/tickets/CICD-01/01-plan.md, .ai/board/tickets/CICD-01/03-impl-log.md, .ai/board/tickets/CICD-01/ticket.yaml, "git diff 460cf5e..HEAD", .ai/registry/invariants.md, .ai/01-operating-model.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
verdict: PASS
failed_checks: []
invariant_violation: false
route_to: none
increments_rework: false
---

# CICD-01 — Review

Session overrides applied: branch is `claude/epic-hawking-g9l2n8` (`ticket.yaml:9`), diff under
review is `git diff 460cf5e..HEAD` (commits `b85752d`, `97cb675`), and R1 is computed by hand because
`scripts/check-allowed-paths.mjs` prints `branch "claude/epic-hawking-g9l2n8" is not feat/*, nothing
to check` and exits 0 without checking anything. Every command below was re-run in this session.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed and uncommitted paths within `allowed_paths` | PASS | **Committed, by hand:** 23 paths in `git diff --name-only 460cf5e..HEAD`. 19 match `allowed_paths` (`.ai/board/tickets/CICD-01/ticket.yaml:24-43`) one-for-one: glossary, testing-standards, the three workflows, `scripts/check-docs.mjs`, `scripts/tests/check-docs.test.mjs`, `docs/ops/e2e-quarantine.md`, the eight spec files, the three `BUG-00{3,4,5}/ticket.yaml`. 3 are under `.ai/board/tickets/CICD-01/` (`01-plan.md`, `03-impl-log.md`, `ticket.yaml`). 1 is ship-owned (`.ai/board/backlog.md`). No path violates. `git diff --stat 460cf5e..HEAD -- src playwright.config.ts package.json pnpm-lock.yaml` is empty. **Uncommitted:** `node scripts/check-carry.mjs CICD-01` → `0 uncommitted path(s)`, `PASS — nothing stray`, exit 0 |
| R2 | typecheck exit 0 — whole-program | PASS | `pnpm exec tsc --noEmit` → exit 0, no output |
| R3 | lint exit 0 on the changed lintable files | PASS | `pnpm exec eslint .` (repo-wide, a superset of the diff) → exit 0, no output. No out-of-diff error to route |
| R4 | Nothing outside the data-access seam reaches the datastore | PASS | No `src/**` file in the diff (empty `git diff --stat 460cf5e..HEAD -- src`). The only logic added is a docs audit, `scripts/check-docs.mjs:1026-1217`, which reads files via `readIf`/`walk`/`fs.existsSync` (`:1166-1191`) and touches no datastore |
| R5 | Every contract item in plan § 4 is implemented | PASS | See R5 detail |
| R6 | Permission gating matches plan § 3 | PASS | Plan § 3 changes no product role, route, control or policy. No `src/**` change; workflows add no `permissions:` key, secret or write scope — the only workflow edits are the `uses:` majors at `.github/workflows/verify.yml:19,21,23`, `allowed-paths.yml:17`, `mir-tracking.yml:16` and the comments at `verify.yml:3-4`, `allowed-paths.yml:3` |
| R7 | No invariant violated | PASS | `invariants_touched: []` (`.ai/board/tickets/CICD-01/ticket.yaml:22`); each of INV-01..07 reasoned in R7 detail |
| R8 | No dependency added without an ADR | PASS | `package.json` and `pnpm-lock.yaml` unchanged across `460cf5e..HEAD`. The three workflow action bumps change majors of actions already in use (`verify.yml:19,21,23`), specified by plan § 4.6 and ADR-059/ADR-060 (`ticket.yaml:46`); nothing new is added |

**Supporting runs, this session:** `CI=1 pnpm exec playwright test` → exit 0, `366 passed`,
`21 skipped`, 0 failed, 0 flaky (4.4 m). `pnpm exec vitest run` → 37 files, 710 tests passed, exit 0.
`node scripts/check-docs.mjs` → `errors: 0 warnings: 2 pending: 7`, no `FAIL D15`, exit 0.
`node --test scripts/tests/check-docs.test.mjs` → 126 pass, 0 fail. `node --test
scripts/tests/ticket-yaml.test.mjs` → 15 pass. `node --test .claude/hooks/tests/*.test.mjs` plus
the other `scripts/tests/*.test.mjs` → 250 pass, 0 fail (126 + 250 = 376, matching the impl log).
The single combined `node --test` invocation was killed with exit 137 twice, both times while
Playwright or a 6-minute check-docs file was running alongside it. That was a resource kill in this
sandbox, not a test failure: split into two runs, every file passes.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 annotation: comment line above, `test(` → `test.fixme(` only | `tests/e2e/adm-01-threshold.spec.ts:240-241` and the 20 other sites listed under § 4.2; `grep -rn "test.fixme(" tests/` → 21, and 21 of them have `QUARANTINED BUG-00n` on the line above. The diff shows exactly one added comment and one changed declaration per test, no other line | Yes — text matches § 4.1 verbatim, no date |
| § 4.2 the 21 tests, ticket per test | Comments at `adm-01-threshold.spec.ts:240`; `adm-02-holidays.spec.ts:125,137,154,182,219,239,257,303,321`; `adm-03-holiday-writes.spec.ts:373,393`; `adm-04-worklist.spec.ts:322`; `cal-06-year-view.spec.ts:325`; `uie-09-admin-hub.spec.ts:288,349,402`; `uie-10-sidebar.spec.ts:178,367,470` (BUG-003); `evt-09-create-invitation.spec.ts:183` (BUG-004) | Yes — titles unchanged; all 21 are reported skipped by Playwright |
| § 4.3 register, preamble, header, 23 rows, expiry 2026-11-12 | `docs/ops/e2e-quarantine.md:1-22` preamble (all six required points in order), `:24` header exact, `:26-48` 23 rows (21 `fixme`, rows 47-48 `flaky` for EVT-02 AC-28 and EVT-10 AC-2/3/4) | Yes — Test cell `` `path` › title `` format; D15 parses it with zero findings |
| § 4.4 D15 constants | `scripts/check-docs.mjs:1039-1043` | Yes — exact names and values |
| § 4.4 functions `isoDayUTC`, `parseQuarantineRegister`, `findFixmeSites`, `findTestDecls` + typedefs | `scripts/check-docs.mjs:1045-1049` (typedefs), `:1052`, `:1078`, `:1132`, `:1148` | Yes. Two harmless variances: the comment rule also skips lines starting `/*` (`:1129`), and `findTestDecls` matches `/\btest(\.fixme)?\s*\(/` and then requires a literal title through `readTitleAt` (`:1153-1155`) — same result as the plan's single regex for every declaration in this suite |
| § 4.4 findings 1-15 | 1 `:1201`; 2 `:1205`; 3 `:1210`; 4 `:1214`; 5 `:1183`; 6 `:1184`; 7 `:1185`; 8 `:1186`; 9 `:1188`; 10 `:1191`; 11 `:1194`; 12 `:1195`; 13 `:1196`; 14 `:1181`; 15 `:1177` | Yes — each message contains the plan's quoted fragment; all are `err`, none warn or pend |
| § 4.4 section placement and header | `scripts/check-docs.mjs:1026` (after D14 at `:954`, before `// --- Report` at `:1219`) | Yes |
| § 4.5 D15 tests, helpers `registerWith`, `specWith`, `ticketShell` | `scripts/tests/check-docs.test.mjs:1382` block header; helpers `:1393`, `:1404`, `:1415`; the 20 named tests follow, ending with `:1541` (real tree). Dates come from `utcDay` (UTC clock), with no date hard-coded | Yes — all 20 names present; 126/126 pass |
| § 4.6 workflows | `verify.yml:3-4` comment, `:19` checkout@v7, `:21` pnpm/action-setup@v6, `:23` setup-node@v7; `allowed-paths.yml:3` comment, `:17` checkout@v7; `mir-tracking.yml:16` checkout@v7 | Yes — replacement text verbatim; no `@v4` remains; no other line changed |
| § 4.7 testing-standards | `.ai/standards/testing-standards.md:2` `doc_version: 4`; `:31` `Result on 2026-10-13`; `:34-36` re-measured rows (the unit row matches this session's 37/710, and the e2e row matches this session's 366 passed / 21 skipped); `:46` added sentence citing #87 and CICD-01; `:230` the ADR-060 exception sentence verbatim plus the register/D15 sentence | Yes |
| § 4.8 three BUG shells | `.ai/board/tickets/BUG-003/ticket.yaml:1` header line, `:4-8` id/title/feature_ids/group/state as specified; comment block after `gates:` (`:26`) carrying rows, cause, bisect/sufficiency evidence, the deliberate-UI-change note and the expiry line. `BUG-004/ticket.yaml:4-8`, `BUG-005/ticket.yaml:4-8` likewise | Yes — `ticket-yaml.test.mjs` 15/15 pass |
| AC-18 glossary row (written at PLAN) | `.ai/registry/glossary.md:58`, one `**Quarantine**` row citing ADR-060 and the idea file | Yes |

AC-3 (the PR's own `verify` is green) and the annotation half of AC-13 can only be observed once a
pull request runs CI, which is after this stage. They are not contract items in § 4. Everything
they depend on locally passes above.

## R7 detail

`invariants_touched: []` (`ticket.yaml:22`) with the reason recorded at PLAN (`01-plan.md:294-297`).
The diff changes no `src/**` file, seam, schema or policy (empty `git diff 460cf5e..HEAD -- src`), so
the code that holds each invariant is unchanged. The real question is whether quarantining 21 tests
stops the suite from verifying any invariant. Each was checked against what the 21 quarantined
tests assert.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 (no overlapping portions per member per date) | Unchanged entry write path; no quarantined test asserts overlap. The 21 assert navigation links, holiday-calendar reads/rows, the admin-hub/sidebar selectors, a threshold re-render and an invitation handoff | `.ai/registry/invariants.md:33`; quarantined titles at `docs/ops/e2e-quarantine.md:26-46` |
| INV-02 (approved entry returns to pending on substantive edit) | Unchanged; no quarantined test edits an approved entry. `adm-04-worklist.spec.ts:322` asserts a member's refusal at the worklist, not the re-pend | `invariants.md:34`; `adm-04-worklist.spec.ts:322-323` |
| INV-03 (rejection carries a reason) | Unchanged; no quarantined test rejects an entry | `invariants.md:35`; `docs/ops/e2e-quarantine.md:38` (the only ADM-04 row) |
| INV-04 (one definition of the absence count) | Unchanged; no `src/**` touched. `adm-01-threshold.spec.ts:241` (AC-13, threshold reclassifies on screen) is quarantined, but it fails at navigation (`home-week-link`, plan § 2.0) and asserts the threshold display, not the count's definition. The other ADM-01 tests still run (366 passed) | `invariants.md:36`; `adm-01-threshold.spec.ts:240-241` |
| INV-05 (tentative counts like non-tentative) | Unchanged; no quarantined test concerns tentative entries | `invariants.md:37`; `docs/ops/e2e-quarantine.md:26-48` |
| INV-06 (one portion per entry, all dates) | Unchanged; no quarantined test creates an entry | `invariants.md:38`; `docs/ops/e2e-quarantine.md:26-48` |
| INV-07 (entry belongs to one member, counted on every team) | Unchanged; `adm-02-holidays.spec.ts:303` (AC-14, "calendar is national … another team") concerns holidays, not entries | `invariants.md:39`; `adm-02-holidays.spec.ts:303-304` |

## Findings

None.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|

## Verdict

**PASS.** All eight checks pass with citations. `next_state: DONE`.
