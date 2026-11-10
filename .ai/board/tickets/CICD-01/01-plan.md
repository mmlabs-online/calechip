---
ticket: CICD-01
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-13T09:50:00+00:00
inputs_read:
  - .ai/board/tickets/CICD-01/ticket.yaml
  - .ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md
  - .ai/registry/decisions/ADR-059-delivery-work-is-a-seventh-feature-group.md
  - .ai/registry/decisions/ADR-060-a-failing-e2e-test-may-be-quarantined-with-a-register-and-a-ticket.md
  - .ai/registry/decisions/ADR-010-triage-creates-the-ticket-shell.md
  - .ai/templates/plan.md
  - .ai/templates/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/steward/context.md
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/board/model-debt.md
  - .ai/board/tickets/BUG-001/ticket.yaml
  - .ai/board/tickets/BUG-002/ticket.yaml
  - .ai/board/tickets/UIE-10/01-plan.md
  - .github/workflows/verify.yml
  - .github/workflows/allowed-paths.yml
  - .github/workflows/mir-tracking.yml
  - .github/CODEOWNERS
  - playwright.config.ts
  - scripts/check-docs.mjs
  - scripts/tests/check-docs.test.mjs
  - scripts/check-allowed-paths.mjs
  - src/components/Sidebar.tsx
  - tests/e2e/adm-01-threshold.spec.ts
  - tests/e2e/adm-02-holidays.spec.ts
  - tests/e2e/adm-03-holiday-writes.spec.ts
  - tests/e2e/adm-04-worklist.spec.ts
  - tests/e2e/cal-06-year-view.spec.ts
  - tests/e2e/evt-09-create-invitation.spec.ts
  - tests/e2e/uie-09-admin-hub.spec.ts
  - tests/e2e/uie-10-sidebar.spec.ts
  - "orchestrator facts file, 2026-10-13: CI run 281 (id 38369706746) failure set, local CI=1 run, action majors"
  - "local bisect, 2026-10-13: git worktrees at 366b071 (#86), 6aff433 (#87) and 460cf5e (HEAD, nav restored)"
  - "gh run list / gh api check-runs annotations, verify on main, runs for #125..#129"
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CICD-01 — Plan

## 0. Deviations from the command, stated first

- **Branch.** `/plan` Step 0 says to create or switch to `feat/CICD-01`. A **session-level
  instruction** overrode it: this cloud session must stay on `claude/epic-hawking-g9l2n8`, so no
  branch was created or switched, and `ticket.yaml` `branch:` carries that name. The consequence is
  real and is named so nobody discovers it at review: `scripts/check-allowed-paths.mjs:102-104` exits
  0 on any branch that is not `feat/*`, so **the CI path guard does not check this ticket**. Review
  check R1 is the only remaining control on `allowed_paths`.
- **Ticket shells written outside `/triage`.** ADR-010 gives the ticket shell to `/triage`. This plan
  puts three `BUG-nnn` shells in `allowed_paths` for the Developer to write, because ADR-060 requires
  every `test.fixme` to name a tracking ticket *at the moment it lands*, and an ID with no shell is a
  citation that resolves to nothing — `BUG-nnn` is not policed by check D1 (ADR-028 § Context). § 8
  alternative 3 is the version that waits for `/triage`. This is MD-017's territory and does not fix
  it.
- **Size.** L, not split. Accepted unsplit by the operator on 2026-10-13, with Definition of Ready
  item 5 waived for this ticket — Changelog row `2026-10-13T10:30:00+00:00`, and § 7.

## 1. Problem and scope

**Feature ID, transcribed from `.ai/registry/features.md:253`:**

> | CICD-01 | The pull-request gate is green on `main` again, with each failing end-to-end test quarantined against a ticket in a register | CICD | PLANNED | | From `.ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md`, re-triaged PROMOTE on 2026-10-13 after ADR-059 and ADR-060. Phase 1 of the request. Quarantine under [ADR-060](decisions/ADR-060-a-failing-e2e-test-may-be-quarantined-with-a-register-and-a-ticket.md), `ACCEPTED by the operator` (*"đồng ý"*): `test.fixme` only with a ticket, a register row and an expiry of 30 days at most; flaky tests keep the existing CI retry and get a *flaky* row. The `testing-standards.md:227` exception sentence and the stale table at `:35-36` are owed by ADR-060 — standards plane. Exit criterion: `verify` green on `main`. Fixing the quarantined tests is out of scope. |

**Who gains what.** The operator, who alone merges (RULE-09), gains a `verify` check that means
something again: today it fails on every push to `main` (runs for #120..#129 all `failure`), so it
cannot be made a required check and every agent stage that runs the suite cannot tell a failure it
caused from one already there — the EVT-10 and EVT-11 ships skipped verification for exactly that
reason. After this ticket the suite exits 0, each of the 21 assertions that stopped running is named
in one register against a ticket and an expiry, the two flaky tests are visible rather than silently
retried, and the documentation audit itself refuses an unregistered or expired quarantine — so the
debt cannot quietly become permanent (ADR-060 § Consequences).

**In scope** (the request's § 5 Phase 1, as amended by ADR-060):

1. `test.fixme` plus a ticket comment on each test in § 4.2 — and no other edit to any test.
2. `docs/ops/e2e-quarantine.md`, the register, one row per quarantined and per flaky test.
3. Three tracking tickets, `BUG-003`, `BUG-004`, `BUG-005`, as `BACKLOG` shells (§ 4.8).
4. Check D15 in `scripts/check-docs.mjs`, the ADR-060 quarantine check, and its tests.
5. `.ai/standards/testing-standards.md`: the ADR-060 exception sentence at `:227`, and the results
   table at `:35-36` re-measured and corrected.
6. `actions/checkout@v7`, `actions/setup-node@v7` and `pnpm/action-setup@v6` in all three workflows,
   and the stale "exactly two status checks" comments in `verify.yml:3-4` and `allowed-paths.yml:3`.
7. The `Quarantine` glossary row (ADR-047; written at PLAN, already on disk).

**Out of scope — and where each goes:**

- **Fixing any quarantined test, or the product code behind it.** The request's § 7 and the feature
  row both say so. Each group's fix is its `BUG-nnn` ticket. **No `src/**` change**, including the
  one-line fix that § 2.0 shows would turn all twenty group-A tests green — that is BUG-003's call,
  because the code it would revert was a deliberate UI change.
- **`playwright.config.ts`.** `retries: process.env.CI ? 1 : 0` (`:13`) is the bounded retry ADR-060
  keeps; it is not touched.
- **Making `verify` a required check, branch protection, splitting CI, caches, `concurrency`,
  `permissions:`** — CICD-02. Repository settings are the operator's (RULE-09).
- **`.ai/standards/git-conventions.md:276`** (*"Points at exactly two status checks"*) and
  **`SETUP.md:181`** (*"exactly two status check names"*). Both are stale for the same reason as the
  workflow comments, but both describe branch protection, which is CICD-02's subject, and the first
  is a second standards file this ticket has no other business in. Named so CICD-02 inherits them.
- **`test.skip` and other skip forms.** D15 polices `test.fixme` only, which is what ADR-060 permits.
  A `test.skip` remains a plain `:227` violation, caught (or not) exactly as today.
- **The red at #81..#86 that was not e2e.** Run 168 (#81) failed at the documentation audit; that
  audit passes today (`node scripts/check-docs.mjs`, 2026-10-13: `errors: 0`). Nothing is owed.
- **`.ai/board/backlog.md` rows for the three BUG shells** — a ship-owned view (ADR-023); `/ship` or
  the orchestrator repairs it from `ticket.yaml`, which is authoritative.
- **Retrieving CI logs.** The job-log store returned 403 to this session (§ 2.0, EVT-09); nothing in
  this ticket depends on reading them.

`size_estimate`: **L** — the scope above names eight spec files, three workflows, three shells, a
register, a check and its test, a standards file and a glossary row before any design. Honest, and
it fails Definition of Ready item 5 by construction; the operator waived item 5 for this ticket
(Changelog row `2026-10-13T10:30:00+00:00`).

## 2. Acceptance criteria

### 2.0 What was verified, which the criteria below rest on

**The failure set.** CI run 281 (id 38369706746, `460cf5e`, #129): 21 failed, 1 flaky, 365 passed.
Local `CI=1 pnpm exec playwright test` on the same commit: 20 failed, 1 flaky, 366 passed — CI's set
minus EVT-09 AC-6.

**Group A — twenty tests, one cause, confirmed rather than suspected.**
- **Cause.** `src/components/Sidebar.tsx:507-519` is the sidebar `<nav>` that renders
  `home-week-link`, `home-year-link` and (for a member) `home-holidays-link`, and it is **commented
  out** as a JSX comment (`{/* <nav … </nav> */}`). Introduced by commit `2259136` "chaneg UI",
  2026-09-12 (`git log -S`), which reached `main` in **PR #87** (`6aff433`, `ops/release-v1.0.0`).
- **How each failure follows from it.** The UIE-09, UIE-10 and ADM-02 AC-15 tests assert those ids
  resolve to one node and get zero. ADM-01 AC-13, ADM-04 AC-10/12, CAL-06 AC-12 and UIE-10 AC-11
  time out clicking `home-week-link` / `home-year-link`. ADM-02 AC-1..AC-14 and ADM-03 AC-14/AC-18
  time out at `shell-admin-link`: `reachHolidays` (`tests/e2e/adm-02-holidays.spec.ts:89-108`) takes
  the sidebar link when it exists and otherwise walks the admin hub, so a member — who now has
  neither — waits on a control only an admin is offered.
- **Bisected, first failing PR = #87.** Worktrees at the merge commits, `CI=1`, the seven spec files
  of the group run whole: at **#86** (`366b071`) **83 passed, 0 failed**; at **#87** (`6aff433`)
  **exactly the same 20 failed**, 64 passed. #81..#85 precede #86 and every group-A spec that existed
  then passed at #86, so they are cleared by the same run.
- **Sufficiency.** At HEAD (`460cf5e`), with only those two comment delimiters removed in a scratch
  worktree, the 41 tests in the group's failing spec selection **all pass** (41 passed, 24.0 s). One
  cause explains all twenty; there is no second group hiding behind it.
- **Why CI never said so.** Every `main` run from #81 to #89 failed at the documentation audit in
  about a minute and skipped e2e; the first `main` run that reached e2e was run 193 (#90).

**Group B — EVT-09 AC-6, CI-only.** `tests/e2e/evt-09-create-invitation.spec.ts:183`. Failed on both
attempts in run 281; passed in the local full-suite run, and passed 10 of 10 locally in isolation
(`--repeat-each=10 --workers=2 --retries=0`). The CI error text is not available: `gh run view
--log-failed` and the jobs-logs API both returned **403 from the log blob store** for runs on #125
(where EVT-09 merged) through #129, and the check-run annotations carry only the Node 20 deprecation
and the exit code. So the cause is **not established**; the test hands router state in by a manual
`pushState` + `popstate` (`:193-205`), the most timing-sensitive step in it, and that is the
*suspected* cause and is written as suspected. **Decision: quarantine it as `fixme`**, not `flaky` —
a test that fails both attempts keeps `verify` red under `retries: 1`, so a flaky row would not meet
the exit criterion, and ADR-060 reserves *flaky* for a test that passes on retry.

**Group C — flaky, not quarantined (ADR-060 § Decision).** EVT-02 AC-28
(`evt-02-attendance.spec.ts:80`, failed then passed in CI run 281) and EVT-10 AC-2/3/4
(`evt-10-description.spec.ts:237`, failed then passed in the local run, on
`getByTestId('event-description').locator('ul > li')`). Both passed 10 of 10 locally in isolation,
so both flake only under full-suite load. They keep running under `retries: 1` and get a *flaky*
row. **Not bisected:** a test that passes on retry has no first failing commit to find.

**Tracking tickets — the convention.** `.ai/01-operating-model.md:391`: *"Defects are `BUG-nnn`"*.
ADR-028's boundary test, step 1 — *something written down says what the surface should be and the
surface does not match it* — puts all three groups there (UIE-10 AC-2, EVT-09 AC-6, EVT-02 AC-28 and
EVT-10 AC-2..4 are each a shipped criterion). `BUG-001` and `BUG-002` are the only IDs issued and
nothing on disk cites `BUG-003` or later (`grep`, 2026-10-13), so the next three are
`BUG-003` (group A), `BUG-004` (group B), `BUG-005` (group C). One ticket per root cause, not per
test, as the request asks.

### 2.1 Criteria

**AC-1 — exactly the failure set is quarantined, and nothing else in a test changes**
- Given this ticket's head
- When every `.ts` file under `tests/e2e/` is searched for `test.fixme(`
- Then exactly the 21 tests in § 4.2 are found, each with the comment of § 4.1 on the line
  immediately above it naming the ticket § 4.2 gives it; and `git diff origin/main -- tests/` shows,
  per quarantined test, exactly one added comment line and `test(` changed to `test.fixme(` on the
  declaration line, and no other changed line

**AC-2 — the suite exits 0**
- Given this ticket's head, in a checkout with browsers installed
- When `CI=1 pnpm exec playwright test` runs
- Then it exits 0 with 0 failed and exactly 21 skipped; a test reported `flaky` is permitted and is
  one of the two in § 4.3's *flaky* rows

**AC-3 — the pull request's own `verify` is green**
- Given the pull request this ticket ships
- When the `verify` workflow runs on it
- Then every step concludes `success`, including `documentation audit`, `hook and script tests` and
  `end-to-end`

**AC-4 — the register holds one row per quarantined or flaky test, and no other**
- Given `docs/ops/e2e-quarantine.md`
- When its table is read
- Then it has the header of § 4.3 exactly, 23 rows matching § 4.3 (21 `fixme`, 2 `flaky`), every
  `Expiry` is a `YYYY-MM-DD` date on or before `2026-11-12`, and every `Ticket` names a folder under
  `.ai/board/tickets/` holding a `ticket.yaml`

**AC-5 — flaky tests are visible, not hidden**
- Given EVT-02 AC-28 and EVT-10 "AC-2, AC-3, AC-4"
- When their spec files and `playwright.config.ts` are read
- Then both are still declared with `test(` and not `test.fixme(`, both have a `flaky` row, and
  `playwright.config.ts` is byte-identical to `origin/main`

**AC-6 — D15 refuses an unregistered quarantine**
- Given a project whose `tests/e2e/` holds a `test.fixme("<title>", …)` with a ticket comment and
  whose register has no row for that file and title (or no register at all)
- When `node scripts/check-docs.mjs` runs
- Then it exits 1 and the `FAIL D15` block names the spec file and the title

**AC-7 — D15 refuses an expired row**
- Given a register row, of either kind, whose `Expiry` is earlier than today's UTC date
- When the audit runs
- Then `FAIL D15` names the row's test and its expiry; a row whose expiry **is** today passes

**AC-8 — D15 refuses an expiry more than 30 days out**
- Given a register row whose `Expiry` is later than today's UTC date plus 30 days
- When the audit runs
- Then `FAIL D15` names the row; a row exactly 30 days out passes

**AC-9 — D15 refuses a row that has outlived its reason**
- Given a `fixme` row whose test is declared with plain `test(` (fixed but not de-registered), or a
  `fixme`/`flaky` row whose file or title does not exist, or a `flaky` row whose test is `test.fixme(`
- When the audit runs
- Then `FAIL D15` names the row and which of the three it is

**AC-10 — D15 refuses a quarantine whose ticket is missing or does not match**
- Given a `test.fixme(` with no ticket ID on its own line or the line immediately above, or with an ID
  different from its row's `Ticket`, or a row whose `Ticket` has no `.ai/board/tickets/<ID>/ticket.yaml`
- When the audit runs
- Then `FAIL D15` names the test and the missing or mismatched ticket

**AC-11 — D15 refuses a quarantine it cannot match**
- Given a `test.fixme(` whose first argument is not a string literal (the in-body `test.fixme()` or
  `test.fixme(condition, …)` form), or a `test.describe.fixme(`
- When the audit runs
- Then `FAIL D15` names the file and line as a quarantine with no matchable title

**AC-12 — D15 is silent when there is nothing to police, and on this repository**
- Given a project with no `test.fixme(` under `tests/e2e/` and no register file
- When the audit runs
- Then there is no `FAIL D15` block; and the same holds for this repository at this ticket's head

**AC-13 — the deprecated actions are gone from every workflow**
- Given `.github/workflows/verify.yml`, `allowed-paths.yml` and `mir-tracking.yml`
- When every `uses:` line is read
- Then `actions/checkout` is `@v7`, `actions/setup-node` is `@v7`, `pnpm/action-setup` is `@v6`, no
  `@v4` remains, and the `verify` run on this ticket's pull request carries no "Node.js 20 is
  deprecated" annotation naming any of the three

**AC-14 — no workflow claims a fixed number of status checks**
- Given the three workflow files
- When their comments are read
- Then none contains "exactly two status checks" or "second of exactly two", and the replacement
  text of § 4.6 is present

**AC-15 — the standard permits the quarantine, and reports today's results**
- Given `.ai/standards/testing-standards.md`
- When it is read
- Then the `:227` bullet carries the ADR-060 exception sentence of § 4.7 verbatim; the results table
  at `:35-36` carries the date it was measured and the figures the Developer measured on this
  ticket's head, with the end-to-end row naming the skipped count and the register; and
  `doc_version` is 4

**AC-16 — the tracking tickets exist**
- Given `.ai/board/tickets/BUG-003/`, `BUG-004/` and `BUG-005/`
- When each `ticket.yaml` is read
- Then each exists with the fields of § 4.8, `state: BACKLOG`, and `node --test
  scripts/tests/ticket-yaml.test.mjs` passes

**AC-17 — the refusals of scope**
- Given `git diff origin/main --stat` at this ticket's head
- When it is read
- Then it touches nothing under `src/`, does not touch `playwright.config.ts`, and every path is in
  `ticket.yaml` `allowed_paths` or `.ai/board/tickets/CICD-01/`

**AC-18 — the owed glossary term is recorded**
- Given `.ai/registry/glossary.md`
- When the `## Terms` table is read
- Then it has exactly one `**Quarantine**` row, citing ADR-060 and the idea file

**Invariants touched: `[]`.** INV-01..INV-07 all constrain entries and the absence count
(`.ai/registry/invariants.md:33-39`). This ticket changes no `src/**` file, no seam, no schema; it
stops 21 assertions from running, and none of the 21 asserts an invariant by ID — group A asserts
navigation, group B an invitation handoff. Written back to `ticket.yaml`.

**Open questions.**

1. **Size — RESOLVED 2026-10-13.** The operator chose *"Accept L unsplit (Recommended)"*: L ships
   unsplit and Definition of Ready item 5 is waived for this ticket. Recorded in the Changelog row
   `2026-10-13T10:30:00+00:00`. The design did not change.
2. **The Vietnamese word in the `Quarantine` glossary row — not blocking.** Neither the idea file nor
   ADR-060 records what the team calls it; the row carries *cách ly* with a `TODO(verify):` marker.
   The meaning is fully sourced. The operator corrects the word at merge if it is wrong.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

*There is no screen in this ticket. The only layout it originates is the register's table, whose
columns are given by the request and ADR-060.*

## 3. Permission model

**No product role gains or loses anything.** No route, control, seam function or policy changes, so
`.ai/standards/rbac-and-security.md` has nothing to apply; check R6 reads `none`.

The controls this ticket does touch are repository controls, and each stays where it is:

| Action | Who may | Where enforced |
|---|---|---|
| Merge the pull request | the operator only | RULE-09; GitHub |
| Change `.github/**`, `scripts/**`, `.ai/standards/**`, `.ai/registry/**` | an agent writes, a human approves | `.github/CODEOWNERS` review at merge |
| Re-date or delete an expired register row | the operator (ADR-060 § Options A) | D15 fails the audit until someone does |
| Enable required checks | the operator, by hand | repository settings — not this ticket (CICD-02) |

**Denied:** no workflow is given a `permissions:` key, a secret or a write scope in this ticket; the
three files change only the action majors and two comments.

## 4. Contract

### 4.1 The quarantine annotation

Exactly this, on the line immediately above the declaration, at the declaration's indentation, with
the ticket from § 4.2. The declaration's only change is `test(` → `test.fixme(`.

```ts
  // QUARANTINED BUG-003 under ADR-060 — row in docs/ops/e2e-quarantine.md; do not fix here.
  test.fixme("AC-13: the new threshold reclassifies the days already on screen", async ({ page }) => {
```

The comment carries **no date**. The register is the one place the expiry lives, so re-dating a row
is one edit, not twenty-one.

### 4.2 The 21 quarantined tests

Lines are at `460cf5e`; the title is the match key and must be copied exactly.

| # | File | Line | Title | Ticket |
|---|---|---|---|---|
| 1 | `tests/e2e/adm-01-threshold.spec.ts` | 240 | AC-13: the new threshold reclassifies the days already on screen | BUG-003 |
| 2 | `tests/e2e/adm-02-holidays.spec.ts` | 125 | AC-1: a signed-in member reads the calendar for the displayed year | BUG-003 |
| 3 | `tests/e2e/adm-02-holidays.spec.ts` | 136 | AC-2: an admin sees exactly the same rows, in the same order, as the member | BUG-003 |
| 4 | `tests/e2e/adm-02-holidays.spec.ts` | 152 | AC-3: a row shows its date, its name and its effect, and the two kinds differ | BUG-003 |
| 5 | `tests/e2e/adm-02-holidays.spec.ts` | 179 | AC-4: the rows are in ascending date order | BUG-003 |
| 6 | `tests/e2e/adm-02-holidays.spec.ts` | 215 | AC-8: the year is the address, and typing it is the same as pressing next | BUG-003 |
| 7 | `tests/e2e/adm-02-holidays.spec.ts` | 234 | AC-9: no year in the address, or a malformed one, resolves to the caller's own year | BUG-003 |
| 8 | `tests/e2e/adm-02-holidays.spec.ts` | 251 | AC-10: a year the calendar does not reach says so, and is not shown as a year without holidays | BUG-003 |
| 9 | `tests/e2e/adm-02-holidays.spec.ts` | 296 | AC-14: the calendar is national — a caller on another team reads the same rows | BUG-003 |
| 10 | `tests/e2e/adm-02-holidays.spec.ts` | 313 | AC-15: a route to the calendar is offered to both roles | BUG-003 |
| 11 | `tests/e2e/adm-03-holiday-writes.spec.ts` | 373 | AC-14: a member is offered no control and still sees the whole calendar | BUG-003 |
| 12 | `tests/e2e/adm-03-holiday-writes.spec.ts` | 392 | AC-18: an admin and a member read the same rows, in the same order | BUG-003 |
| 13 | `tests/e2e/adm-04-worklist.spec.ts` | 322 | AC-10 and AC-12: a member is refused, and the refusal is not what protects anything | BUG-003 |
| 14 | `tests/e2e/cal-06-year-view.spec.ts` | 325 | AC-12: the year is reachable from the month and from the week, and returns to the month | BUG-003 |
| 15 | `tests/e2e/uie-09-admin-hub.spec.ts` | 288 | AC-6: a member who types the address is refused by the screen | BUG-003 |
| 16 | `tests/e2e/uie-09-admin-hub.spec.ts` | 348 | AC-9: the hub's selectors are new, and collide with nothing | BUG-003 |
| 17 | `tests/e2e/uie-09-admin-hub.spec.ts` | 400 | AC-10: the sidebar keeps its general links, and the third is a member's alone | BUG-003 |
| 18 | `tests/e2e/uie-10-sidebar.spec.ts` | 178 | AC-2: the general links stay, and the holidays link is a member's alone | BUG-003 |
| 19 | `tests/e2e/uie-10-sidebar.spec.ts` | 366 | AC-8: the roster's role word is a new selector and collides with nothing | BUG-003 |
| 20 | `tests/e2e/uie-10-sidebar.spec.ts` | 468 | AC-11: the interface is in English | BUG-003 |
| 21 | `tests/e2e/evt-09-create-invitation.spec.ts` | 183 | AC-6: a failed handoff opens the panel with the sentence and the addresses ready to resend | BUG-004 |

### 4.3 The register — `docs/ops/e2e-quarantine.md`, new

A short preamble, then the table. The preamble says, in this order: what the file is (the register
ADR-060 requires); the three conditions under which `test.fixme` is permitted; that check D15 in
`scripts/check-docs.mjs` enforces it and fails the audit on an unregistered fixme, an expired row, a
row more than 30 days out, or a row whose test no longer matches; that past expiry a row is fixed,
deleted with a reason, or re-dated by the operator; that *flaky* rows are not quarantined and run
under `playwright.config.ts`'s `retries`; and ADR-060's revert condition (a row more than 60 days
old). The table is the only `|`-table in the file, so D15 reads the first table whose header matches.

**Header, exactly:**

```md
| Test | Kind | Suspected cause | First failing PR | Ticket | Expiry |
|---|---|---|---|---|---|
```

**Test cell format, exactly:** `` `<repo-relative spec path>` › <title> `` — a backtick-quoted path,
a space, the `›` character (U+203A), a space, the title verbatim. D15 parses on this.

**The 23 rows.** `Expiry` is `2026-11-12` for every row. Cause and PR texts:

- **Rows 1–20 (§ 4.2 #1–#20)** — Kind `fixme`, Ticket `BUG-003`.
  - Suspected cause: ``Confirmed: the sidebar `<nav>` carrying `home-week-link`, `home-year-link` and `home-holidays-link` is commented out at `src/components/Sidebar.tsx:507-519` (commit 2259136). Restoring it passes the test.``
  - First failing PR: `#87 (6aff433) — bisected locally: passes at #86, fails at #87. e2e did not run on main from #81 to #89.`
- **Row 21 (§ 4.2 #21)** — Kind `fixme`, Ticket `BUG-004`.
  - Suspected cause: ``CI only: failed both attempts in run 281, passes locally (full suite, and 10/10 isolated). Suspected: the `pushState` + `popstate` handoff at `:193-205` under CI timing. CI log unreadable from the planning session (403).``
  - First failing PR: `Not established — first observed in run 281 (#129); the test arrived with #125 and the logs for #125..#128 could not be read.`
- **Row 22** — Test `` `tests/e2e/evt-02-attendance.spec.ts` › AC-28: the three fields sit after the dates and before the scope, empty and off by default ``, Kind `flaky`, Ticket `BUG-005`.
  - Suspected cause: `Flaky under full-suite load in CI: failed then passed on retry in run 281; 10/10 isolated locally.`
  - First failing PR: `Not bisected — flaky; first observed in run 281 (#129).`
- **Row 23** — Test `` `tests/e2e/evt-10-description.spec.ts` › AC-2, AC-3, AC-4: every format is shown on both surfaces, and re-saving changes nothing ``, Kind `flaky`, Ticket `BUG-005`.
  - Suspected cause: ``Flaky under full-suite load locally: `event-description` `ul > li` text mismatch, then passed on retry (2026-10-13); 10/10 isolated.``
  - First failing PR: `Not bisected — flaky; first observed in a local CI=1 run on 460cf5e.`

### 4.4 Check D15 — `scripts/check-docs.mjs`

A new section after D14 and before `// --- Report`, headed
`// --- D15: every e2e quarantine is registered, ticketed and unexpired (ADR-060) ----`, with a
header comment citing ADR-060, `testing-standards.md:227` and this plan. Every finding is
`err("D15", <file>, <msg>)`; D15 never warns and never writes `pending`.

**Constants (exact names):**

```js
const QUARANTINE_REGISTER = "docs/ops/e2e-quarantine.md";
const QUARANTINE_E2E_DIR = "tests/e2e";
const QUARANTINE_MAX_DAYS = 30;
const QUARANTINE_KINDS = new Set(["fixme", "flaky"]);
const QUARANTINE_HEADER = ["Test", "Kind", "Suspected cause", "First failing PR", "Ticket", "Expiry"];
```

**Functions (exact names and shapes; plain JS, JSDoc types):**

```js
/** @typedef {{ file: string, title: string, kind: string, cause: string, firstPr: string,
 *              ticket: string, expiry: string, line: number }} QuarantineRow */
/** @typedef {{ file: string, line: number, title: string | null, tickets: string[],
 *              describe: boolean }} FixmeSite */
/** @typedef {{ file: string, title: string, fixme: boolean }} TestDecl */

/** Rows of the first table whose header cells equal QUARANTINE_HEADER. Missing file → []. */
function parseQuarantineRegister(text) /* → { rows: QuarantineRow[], problems: string[] } */

/** Every `test.fixme(` / `test.describe.fixme(` site in one file's text. */
function findFixmeSites(file, text) /* → FixmeSite[] */

/** Every `test(` / `test.fixme(` declaration with a string-literal title in one file's text. */
function findTestDecls(file, text) /* → TestDecl[] */

/** Today's UTC date and today + n days, as YYYY-MM-DD strings. */
function isoDayUTC(offsetDays = 0) /* → string */
```

**Parsing rules:**

- A site is a line matching `/\btest(\.describe)?\.fixme\s*\(/` whose trimmed text does not start
  with `//` or `*` (a comment mentioning it is not a site). `describe` is true for the `.describe.`
  form.
- `title` is the first argument when it is a string literal on the same line — `"…"`, `'…'` or a
  backtick literal with no `${` — read with backslash escapes honoured; otherwise `null`.
- `tickets` are the matches of `/\b[A-Z]{2,5}-\d{2,3}\b/g` on the site's own line and the line
  immediately above it.
- A declaration (`TestDecl`) is a line matching `/\btest(\.fixme)?\s*\(\s*(["'`])/` under the same
  comment rule, title read the same way. `test.describe(`, `test.step(`, `test.beforeEach(` and
  similar do not match because the character after `test` is `.` followed by another word.
- Register row cells are split on unescaped `|`, trimmed. The `Test` cell must match
  ``/^`([^`]+)`\s+›\s+(.+)$/``; a row that does not is a problem (`"row N: Test cell is not \`<path>\` › <title>"`).
- Files scanned: every `.ts` file under `QUARANTINE_E2E_DIR`, recursively (`walk`).

**Findings (the message must contain the quoted fragment; file is the path given):**

| # | Condition | file | message contains |
|---|---|---|---|
| 1 | a site with `describe: true` | the spec | `describe-level fixme cannot be registered` |
| 2 | a site with `title: null` | the spec | `test.fixme at line N has no string-literal title` |
| 3 | a site with no row whose `file` and `title` match | the spec | `is quarantined with no row in docs/ops/e2e-quarantine.md` |
| 4 | a matched site whose `tickets` does not include the row's `ticket` | the spec | `names no ticket, or not <TICKET>` |
| 5 | a row whose `kind` is not in `QUARANTINE_KINDS` | the register | `kind must be fixme or flaky` |
| 6 | a row whose `expiry` is not `/^\d{4}-\d{2}-\d{2}$/` | the register | `expiry is not YYYY-MM-DD` |
| 7 | a row whose `expiry` < `isoDayUTC(0)` | the register | `expired on <date>` |
| 8 | a row whose `expiry` > `isoDayUTC(QUARANTINE_MAX_DAYS)` | the register | `more than 30 days out` |
| 9 | a row with an empty `cause`, `firstPr` or `ticket` | the register | `has an empty <column> cell` |
| 10 | a row whose `.ai/board/tickets/<ticket>/ticket.yaml` does not exist | the register | `ticket <TICKET> has no ticket.yaml` |
| 11 | a row whose file + title match no `TestDecl` | the register | `names a test that does not exist` |
| 12 | a `fixme` row whose `TestDecl` has `fixme: false` | the register | `is registered as fixme but runs` |
| 13 | a `flaky` row whose `TestDecl` has `fixme: true` | the register | `is registered as flaky but is quarantined` |
| 14 | two rows with the same file + title | the register | `is registered twice` |
| 15 | any `problems` from parsing | the register | the problem text |

**When there is nothing to police:** no site under `tests/e2e/` and no register file → no D15
finding and no `note:`. A register file with no matching table and at least one site → finding 3 per
site. A register with rows but no sites is checked by 5–14 as normal.

### 4.5 D15's tests — `scripts/tests/check-docs.test.mjs`

A new block headed `// --- D15: e2e quarantine register (ADR-060) ---`, using the existing
`project()` / `run()` helpers and asserting on `findings("D15")` only. Dates are computed in the
test from `new Date()` in UTC, never hard-coded, so the tests do not expire. Fixture helpers (exact
names):

```js
/** A register file with the given rows; each row is [test, kind, cause, pr, ticket, expiry]. */
const registerWith = (...rows) => /* string */;
/** A spec file body holding the given declarations, each { title, fixme, ticket }. */
const specWith = (...decls) => /* string */;
/** A minimal ticket shell so finding 10 does not fire. */
const ticketShell = (id) => ({ [`.ai/board/tickets/${id}/ticket.yaml`]: `id: ${id}\n` });
```

Tests, by name — each maps to the AC in brackets:

1. `"with no fixme and no register, D15 says nothing"` [AC-12]
2. `"an unregistered fixme fails D15"` [AC-6]
3. `"a fixme with no register file at all fails D15"` [AC-6]
4. `"a registered, ticketed, unexpired fixme passes D15"` [AC-6, the negative half]
5. `"an expired row fails D15"` — expiry yesterday [AC-7]
6. `"a row expiring today passes D15"` [AC-7]
7. `"a row more than 30 days out fails D15"` — today + 31 [AC-8]
8. `"a row exactly 30 days out passes D15"` [AC-8]
9. `"a fixme row whose test runs again fails D15"` [AC-9]
10. `"a row naming a test that does not exist fails D15"` [AC-9]
11. `"a flaky row whose test is quarantined fails D15"` [AC-9]
12. `"a flaky row whose test runs passes D15"` [AC-5, AC-9]
13. `"a fixme whose comment names no ticket fails D15"` [AC-10]
14. `"a fixme whose comment names a different ticket fails D15"` [AC-10]
15. `"a row whose ticket has no ticket.yaml fails D15"` [AC-10]
16. `"a fixme with no string-literal title fails D15"` [AC-11]
17. `"a describe-level fixme fails D15"` [AC-11]
18. `"a commented-out test.fixme is not a quarantine"` [§ 4.4 parsing rule]
19. `"a kind other than fixme or flaky fails D15"` [§ 4.4 finding 5]
20. `"this repository's real register and suite pass D15"` — runs `SCRIPT` with `cwd: REPO`, as the
    existing real-tree tests at `:850` do [AC-12]

### 4.6 The three workflows

`verify.yml` — lines 3-4 replaced, three `uses:` lines bumped, nothing else changed:

```yaml
# One of three workflows: verify, allowed-paths and mir-tracking. Which job names branch protection
# requires is not decided here — CICD-02 writes that list into docs/ops/branch-protection.md.
```
```yaml
      - uses: actions/checkout@v7

      - uses: pnpm/action-setup@v6

      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm
```

`allowed-paths.yml` — line 3 replaced, one `uses:` bumped:

```yaml
# One of three workflows: verify, allowed-paths and mir-tracking. It runs one script and nothing else.
```
```yaml
      - uses: actions/checkout@v7
```

`mir-tracking.yml` — one `uses:` bumped: `actions/checkout@v4` → `actions/checkout@v7`.

The majors were read from each action's releases page and `action.yml` on 2026-10-13 (orchestrator
facts file): checkout v7.0.1 (`runs: node24`), setup-node v7.1.0 (`node24`, `cache` input kept),
pnpm/action-setup v6.1.0 (`node24`, reads `packageManager: "pnpm@10.34.3"` from `package.json`). No
input changes are needed: none of the three workflows passes `registry-url`, which is where
setup-node v7's `NODE_AUTH_TOKEN` change applies.

### 4.7 `.ai/standards/testing-standards.md`

- **Front-matter:** `doc_version: 3` → `4`; `last_updated` → the implementation date.
  `governed_by` unchanged. ADR-060 § *Affected documents* names the +1.
- **`:227`**, the bullet *"A skipped test left in the suite. Delete it or fix it; a skip is a passing
  test that checks nothing."* gains, appended to the same bullet, exactly:
  *Except a quarantine under ADR-060: a `test.fixme` with a ticket, a register row and an unexpired date.*
  followed by one sentence naming `docs/ops/e2e-quarantine.md` as the register and check D15 as what
  enforces it.
- **`:33-36`**, the table: header becomes `| Role | Result on <implementation date> |`; each row
  carries the figure the Developer **measures** on this ticket's head with the four commands
  (`pnpm exec tsc --noEmit`, `pnpm exec eslint .`, `pnpm exec vitest run`, `CI=1 pnpm exec playwright
  test`) — no figure is copied from this plan. The end-to-end row reads in the form
  *"`<n>` passed, 21 skipped (quarantined — `docs/ops/e2e-quarantine.md`), `<f>` flaky, 0 failed"*.
  The paragraph at `:38` (*"The six end-to-end failures this table recorded are fixed and the suite
  is green"*) gains one sentence saying the suite went red at #87 and that the 21 skips are the
  ADR-060 quarantine, citing CICD-01. The paragraph is not otherwise rewritten (additive only).

### 4.8 The three tracking-ticket shells

Each copied from `.ai/templates/ticket.yaml`, with the template's comments kept, the first line
replaced by `# Created by \`developer\` at CICD-01 /implement, <date>, from
.ai/board/tickets/CICD-01/01-plan.md § 4.8 — not by /triage (ADR-010); see that plan's § 0.`, and
these fields set (everything not listed stays at the template's value):

```yaml
# BUG-003
id: BUG-003
title: "The sidebar's week, year and holidays links are commented out, so twenty shipped end-to-end criteria fail"
feature_ids: [UIE-10]
group: UIE
state: BACKLOG
```
```yaml
# BUG-004
id: BUG-004
title: "EVT-09 AC-6, the failed-invitation handoff, fails in CI on both attempts and passes locally"
feature_ids: [EVT-09]
group: EVT
state: BACKLOG
```
```yaml
# BUG-005
id: BUG-005
title: "EVT-02 AC-28 and EVT-10 AC-2/3/4 fail on first attempt under full-suite load and pass on retry"
feature_ids: [EVT-02, EVT-10]
group: EVT
state: BACKLOG
```

Each shell also carries, as a comment block after `gates:`, the register rows it owns (by test
title), the suspected cause from § 4.3, and the line *"Quarantine expires 2026-11-12
(docs/ops/e2e-quarantine.md). Fixing the test, or deleting it with a reason, closes this ticket."*
BUG-003's block additionally records § 2.0's bisect and sufficiency evidence and that the code it
would revert was a deliberate UI change (`2259136` "chaneg UI"), **so restoring the links versus
rewording the shipped criteria is that ticket's decision**. `feature_ids: [UIE-10]` because the
contradicted criterion is UIE-10 AC-2 on UIE-10's surface; the other six features whose tests are
quarantined (ADM-01..04, CAL-06, UIE-09) are listed in the comment block, not in `feature_ids`, so
DoR item 6 sees one group.

## 5. Seam impact

**None.** No file under `src/` changes, so no seam function, implementation or seam-parity test is
touched.

## 6. Schema delta

**`none`.** No migration, policy, trigger or constraint. `requires_adr: true` in `ticket.yaml` refers
to ADR-059 and ADR-060, both `ACCEPTED by the operator` on 2026-10-13.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/glossary.md"
  - ".ai/standards/testing-standards.md"
  - ".github/workflows/verify.yml"
  - ".github/workflows/allowed-paths.yml"
  - ".github/workflows/mir-tracking.yml"
  - "scripts/check-docs.mjs"
  - "scripts/tests/check-docs.test.mjs"
  - "docs/ops/e2e-quarantine.md"
  - "tests/e2e/adm-01-threshold.spec.ts"
  - "tests/e2e/adm-02-holidays.spec.ts"
  - "tests/e2e/adm-03-holiday-writes.spec.ts"
  - "tests/e2e/adm-04-worklist.spec.ts"
  - "tests/e2e/cal-06-year-view.spec.ts"
  - "tests/e2e/uie-09-admin-hub.spec.ts"
  - "tests/e2e/uie-10-sidebar.spec.ts"
  - "tests/e2e/evt-09-create-invitation.spec.ts"
  - ".ai/board/tickets/BUG-003/ticket.yaml"
  - ".ai/board/tickets/BUG-004/ticket.yaml"
  - ".ai/board/tickets/BUG-005/ticket.yaml"
```

**Glossary:** `Quarantine` — the one owed term — written at PLAN into `.ai/registry/glossary.md`
(ADR-047), after that path was added above. No other glossary row was touched.

**Branch:** `claude/epic-hawking-g9l2n8`, by session override (§ 0). The CI path guard is inactive on
it; R1 at review is the control.

**`size`: L — 19 paths. `size_estimate`: L. They agree.** No ADR-012 gap to record; the estimate was
L because section 1's scope already names the files.

**L must split at PLAN (`.ai/01-operating-model.md` § Sizing). It is not split, and gate is BLOCKED
for the operator's decision.** *Resolved 2026-10-13: option A, see Changelog row `2026-10-13T10:30:00+00:00`.* The UIE-10 precedent (`.ai/board/tickets/UIE-10/01-plan.md:454-490`)
is the same shape: breadth, not depth, and a split that cannot be executed from this stage.

- **What the 19 are.** Eight spec files each get one comment line and one `test(` → `test.fixme(`
  per quarantined test, 21 pairs in all; three `ticket.yaml` shells copied from the template; three
  workflows with one to three `uses:` majors and at most two comment lines; one register; one check
  and its test; one standards sentence and a re-measured table; one glossary row already written.
  The only file with logic in it is `scripts/check-docs.mjs`.
- **The only coherent cut, costed (option B).** **CICD-01** keeps the rule and its enforcement —
  glossary, `testing-standards.md`, D15 and its test, the three workflows: **7 files, M**. A sibling
  **CICD-01-b** applies the quarantine — the register, the eight spec files, the three shells: **12
  files, M**, depending on CICD-01. It even satisfies ADR-060's ordering (the exception sentence lands
  before the first `test.fixme`). Its costs: `main` stays red for the whole of CICD-01, which ships a
  check that passes vacuously; the register's format is designed in one ticket and first used in
  another; and **the sibling cannot be created from here** — `/plan` writes only this ticket's folder
  and its `allowed_paths`, and a shell is `/triage`'s (ADR-010). That is MD-017, open, high, reached
  for the third time. `product` would have to issue `CICD-01-b`.
- **Cuts that do not work.** Moving the action bumps to CICD-02 (which edits all three workflows
  anyway) saves 3 and leaves 16 — still L. Splitting the fixmes by feature group leaves `main` red
  after the first half, which delivers nothing the exit criterion can observe. Waiting for `/triage`
  to issue the BUG shells saves 3 and leaves 16 — still L, and leaves 21 comments citing IDs with no
  ticket (§ 8 alternative 3).
- **Recommended: A, accept L unsplit.** It is the request's own unit (*"one ticket per phase is
  fine"*), every file but one is a mechanical edit, and it is the only shape in which the ticket that
  ships the check also ships what the check polices. **If A is chosen, Definition of Ready item 5
  must be waived too**, because `size_estimate` is L; the operator's word covers both, and the
  Changelog will record it.

## 8. Rejected alternatives

1. **Fix group A instead of quarantining it — uncomment `src/components/Sidebar.tsx:507-519`.** Remove
   the two JSX comment delimiters and all twenty tests pass (§ 2.0, verified). Genuinely the
   cheapest route to green, and the most tempting. Rejected because the request and the feature row
   both put `src/**` and fixing the tests out of scope, and because the commented-out nav is the
   operator's own UI change (`2259136` "chaneg UI", made on the release branch) — whether the links
   come back or the shipped criteria are reworded is a product decision, so it goes to BUG-003 with
   the evidence attached rather than being made silently by a CI ticket. **Named here so the operator
   knows the fix is one line.**
2. **Mark EVT-09 AC-6 as *flaky* instead of quarantining it.** Keeps the assertion running. Rejected:
   it failed **both** attempts in run 281, so under `retries: 1` it keeps `verify` red and the exit
   criterion is not met; and ADR-060 defines flaky as passing on retry. If BUG-004 shows it passes on
   retry in CI, it moves to a *flaky* row.
3. **Leave the BUG shells to `/triage` and cite reserved IDs in the comments.** Keeps ADR-010 intact.
   Rejected: for the whole life of this ticket 21 comments and the register would cite three IDs that
   resolve to nothing, `BUG-nnn` is not policed by D1 so nothing would say so, and D15 finding 10
   could not exist. It also saves no size (16 files, still L).
4. **Match a fixme to its row by line number, or by AC label alone.** Simpler parsing. Rejected: line
   numbers move with every edit above them, so the register would go stale on unrelated changes;
   AC labels repeat across files and are not unique within one (`AC-14` appears in ADM-02 and
   ADM-03, and UIE-09 / UIE-10 titles share prefixes). File plus exact title is the key Playwright
   itself reports.
5. **Put the expiry in each fixme comment as well as the register.** Visible at the site. Rejected:
   two copies of one date, 21 of them; re-dating — the operator's ADR-060 remedy — would become 22
   edits and D15 would have to police their agreement.
6. **One ticket per failing test, or per feature.** Seven or twenty-one tickets. Rejected: the
   request asks for grouping by root cause, and § 2.0 shows group A is one cause — twenty tickets
   would each be closed by the same one-line change.

## Changelog

- `2026-10-13T09:50:00+00:00` — all sections written; gate BLOCKED on size L (§ 7). Branch kept on
  `claude/epic-hawking-g9l2n8` by session override (§ 0). `Quarantine` glossary row written.
  Raised by `tech-lead-design`. Amended by `tech-lead-design`.
- `2026-10-13T10:30:00+00:00` — Open question 1 resolved by the operator, in session: chose
  *"Accept L unsplit (Recommended)"* — size L accepted without a split (§ 7 option A), and Definition
  of Ready item 5 waived for this ticket. On a second question, whether to restore the commented-out
  nav at `src/components/Sidebar.tsx:507-519` instead of quarantining, chose *"Quarantine, as
  planned"* — BUG-003 owns that decision (§ 8 alternative 1). No design change; gate items other than
  size re-checked and hold. Gate BLOCKED → PASS, `next_state` PLAN → READY. Raised by the operator.
  Amended by `tech-lead-design`.
