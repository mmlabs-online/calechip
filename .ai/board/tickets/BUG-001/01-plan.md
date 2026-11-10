---
ticket: BUG-001
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-03T08:20:02+07:00
inputs_read:
  - .ai/board/tickets/BUG-001/ticket.yaml
  - .ai/board/ideas/2026-09-01-the-end-to-end-suite-does-not-pin-which-seam-it-drives.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-021-the-qa-waiver-is-reverted.md
  - .ai/registry/decisions/ADR-022-the-qa-stage-is-removed.md
  - .ai/standards/architecture.md
  - .ai/standards/testing-standards.md
  - .ai/standards/tech-stack.md
  - .ai/standards/git-conventions.md
  - .ai/01-operating-model.md
  - .ai/board/model-debt.md
  - playwright.config.ts
  - src/lib/data/index.ts
  - src/App.tsx
  - tests/e2e/tea-01-signup.spec.ts
  - tests/e2e/smoke.spec.ts
  - scripts/check-allowed-paths.mjs
  - .github/workflows/verify.yml
consulted:
  - with: operator
    asked: "ticket.yaml records `bugfix/BUG_TEA-01_01` as an operator decision; /plan step 0 mandates `feat/BUG-001`. New fact, measured here and not available at triage: check-allowed-paths.mjs:90 resolves `feat/BUG-001` to `.ai/board/tickets/BUG-001/ticket.yaml`, which exists, so RULE-03 is enforced in CI on a `feat/` branch and exits 0 vacuously on a `bugfix/` one (check-allowed-paths.mjs:85-87). Which branch?"
    answer: "feat/BUG-001"
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-001 — The end-to-end suite does not pin which seam it drives

## 1. Problem and scope

### The feature this ticket belongs to

`feature_ids: [TEA-01]`. Transcribed from `.ai/registry/features.md` without paraphrase:

> | TEA-01 | Sign up and establish the member record | TEA | IN_PROGRESS | INV-04, INV-07 |

No new feature row was written for this ticket and none is owed — the reasoning is on the ticket
shell (§2) and in the idea file's *departure* section. `id: BUG-001` and `feature_ids: [TEA-01]` are
different fields; Definition of Ready item 1 constrains the second.

### What this ticket does

**The acceptance harness gains the ability to state which datastore it drove, and to refuse to run
against the wrong one.** Nobody gains a product capability. The role that gains something is whoever
reads a test report: today a green or red end-to-end run says nothing about what it exercised,
because the answer is decided by `.env` — an untracked, gitignored file that no reviewer can read and
no two machines share.

That single absence produces two failures, and the second is the one that matters:

1. **The verdict is not reproducible.** `playwright.config.ts:20-24` declares `webServer.command` and
   no `env` block, so the build inherits the machine's environment. `src/lib/data/index.ts:164`
   resolves the seam from `VITE_DATA_SEAM` and `VITE_SUPABASE_URL`. On a machine with no `.env` the
   suite drives the in-memory seam and passes; on a configured machine it drives Supabase and six of
   TEA-01's ten assertions fail — 4 pass, 6 fail, recorded in ADR-021 and in
   `.ai/standards/testing-standards.md:36`.
2. **A configured machine's acceptance run writes to the live project.** `tests/e2e/tea-01-signup.spec.ts`
   submits the sign-up form six times per run against real Supabase Auth with the developer's own
   credentials. The suite creates auth users in production as a side effect of being run.

The cost of not fixing it is stated by ADR-021 §Consequences in its own words, and it has already
been paid once: **TEA-05 reached its gate on 2026-09-01 and stopped there**, `blocking_reason`
naming this ticket. ADR-022 has since removed the QA stage, which moves the wall rather than removing
it — Definition of Done item 3 survives ADR-022 explicitly and is now `/ship`'s alone, so an
end-to-end suite that cannot exit 0 deterministically now blocks `/ship` instead of blocking QA.

### Out of scope

- **A second end-to-end suite against a real, dedicated test database.** Its own decision, with a
  project to provision, a lifecycle, credentials in CI and seed data. MD-021's fix shape says the
  same: never the developer's project.
- **Changing how `src/lib/data/index.ts` resolves the seam for the application.** The fallback at
  `:164` is deliberate and `:166-171` records why. This ticket is about the harness's inability to
  state a choice, not the application's default. `src/lib/data/index.ts` is deliberately absent from
  `allowed_paths`.
- **Rewriting TEA-01's acceptance criteria or its six failing assertions.** They are correct. Nothing
  regressed in shipped behaviour; the harness could not tell the tests what they were testing.
- **Deleting or skipping the in-suite guard at `tests/e2e/tea-01-signup.spec.ts:52`.** It is the
  cheapest way out and the destructive one: it makes the suite green in *both* configurations and
  removes the only existing trace of which datastore an acceptance run touched. That file is absent
  from `allowed_paths` so that this cannot happen by accident.
- **Inspecting, cleaning or rotating anything in the live Supabase project, or in `.env`.** Four
  tests passed against Supabase on at least one occasion and this suite creates auth users; nobody
  has looked at what is there. That is an operations question with a human on the end of it.
- **Retiring the untested surface of TEA-02, TEA-03 and TEA-04.** The other ticket ADR-021 owes
  (§What is owed, item 2), row-level policy work under ADR-005. Downstream of this one and not
  discharged by it. **ADR-022 §Consequences records that no stage now exists that could produce it.**
- **Fixing the two `bugfix/` path resolvers.** `git-conventions.md:49` says the cheapest moment is
  before any `bugfix/` branch exists, and this ticket no longer spends that moment — see §7. It is
  steward work on an `ops/` branch, and it is not this ticket.
- **Server staleness under `reuseExistingServer`.** A reused preview serving a *pinned* build from an
  older commit passes this ticket's guard while testing stale code. That is a different defect, it
  exists today, and it is not created or worsened here. Named so it is a decision and not an omission.
- **Correcting the results table at `.ai/standards/testing-standards.md:31-41`.** It will be stale
  the moment this ships. Standards plane, human-owned under RULE-01 — see *Open questions*.

`size_estimate`: **S**. Two files, one of them new, no application code, no schema, no dependency.

## 2. Acceptance criteria

The system under test here is the acceptance harness itself, so "observable from outside" means
observable by running the command named in `.ai/standards/testing-standards.md:19` and reading its
exit code, its report, or the artifact it built. Every criterion below is checkable that way.

**AC-1 — the suite states its seam instead of inheriting it**
- **Given** a machine whose `.env` sets `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to a real
  Supabase project
- **When** `pnpm exec playwright test` is run with no variable supplied on the command line
- **Then** the build the suite drives resolves to the in-memory seam, and the page served at
  `baseURL` carries `data-testid="seam-banner"` with `data-seam="mock"`

**AC-2 — the verdict does not depend on which machine ran it**
- **Given** a machine with no `.env` file at all, which is what CI is
- **When** the same command is run
- **Then** it drives the same in-memory seam and reaches the same verdict as AC-1, and no test's
  result differs between the two machines because of the environment

**AC-3 — a wrong seam aborts the run instead of contributing one failure among many**
- **Given** the page served at `baseURL` does not carry `data-seam="mock"` — for example a preview
  server left running from an unpinned build and reused under `reuseExistingServer`
- **When** `pnpm exec playwright test` is run
- **Then** the seam guard fails, every test in the `chromium` project is reported as `did not run`,
  and no test opens the sign-up form or submits it

**AC-4 — the guard asserts the served page, never the configuration**
- **Given** a run in which the configuration says `mock` and the page served says otherwise
- **When** the guard decides
- **Then** it fails. The guard reads no environment variable, no `process.env` and no value from the
  Playwright config; a configuration agreeing with itself is not evidence and must not pass

**AC-5 — the run records which seam it drove, in its own output**
- **Given** any completed run, passed or failed
- **When** the report is read
- **Then** the report names the seam the run drove, without anyone re-deriving it from an assertion
  inside another ticket's suite

**AC-6 — the guard has exactly one bypass, and it is explicit**
- **Given** the guard is wired as a project dependency
- **When** the suite is run with `--no-deps`
- **Then** the guard does not run and the tests do run — and that flag, typed by a person, is the
  only way to reach the tests without the guard having passed

**AC-7 — CI and the local gate agree, with no workflow edit**
- **Given** `.github/workflows/verify.yml:50-51` runs `pnpm exec playwright test` with no `env:`
  block
- **When** CI runs it
- **Then** it drives the same seam as a local run, because the pin lives in the config both
  invocations load, and `verify.yml` is unchanged by this ticket

**AC-8 — a pinned run is structurally incapable of reaching the live project**
- **Given** a build produced under the pin
- **When** the emitted bundle is inspected
- **Then** it contains no Supabase client and no occurrence of the project host, so the run cannot
  reach the live project at all rather than merely being configured not to

**AC-9 — the application's own seam resolution is unchanged**
- **Given** this ticket's diff
- **When** the application is built with no `VITE_DATA_SEAM` set and a `VITE_SUPABASE_URL` present
- **Then** it resolves to the Supabase seam exactly as it does today, `src/lib/data/index.ts` is
  untouched, and a real deployment is unaffected

### Invariants touched

**`[]`.**

`invariants.md` warns that *choosing the safest behaviour and then concluding no invariant is engaged
is circular reasoning*, so the mechanism is stated rather than the conclusion. INV-01 through INV-07
all range over `entry` and `member` rows. **This ticket's two files contain no application code**:
`playwright.config.ts` configures a test runner and `tests/e2e/seam.setup.ts` reads a rendered page.
Nothing in `allowed_paths` writes a row, computes a count, or is imported by anything that does.
`src/lib/data/index.ts` — the one file that decides what the application talks to — is deliberately
out of scope and out of `allowed_paths`.

**One adjacency, recorded because it points the other way.** INV-04 and INV-07 are the invariants on
TEA-01's row, and today's unpinned runs perturb exactly the data they range over: a run against the
live project creates auth users, the admission trigger turns allow-listed ones into `member` rows,
and those rows enter INV-04's denominator. This ticket *removes* that mechanism. It engages no
invariant; it stops a test harness from writing to data that two of them govern.

### Open questions

None blocking. Three recorded, all answered or routed:

1. **Idea open question 6 — does anything else in the toolchain read `.env` the same way? ANSWERED
   here, and it was open at triage.** Exactly three `VITE_`-prefixed reads exist in the tree, all
   inside the seam: `src/lib/data/index.ts:164`, `src/lib/data/supabase.ts:21` and `:22`. All three
   are neutralised by the pin — `VITE_DATA_SEAM=mock` short-circuits the first, and `supabase.ts` is
   absent from the pinned bundle entirely (§8, measured). The only other `process.env` reads in the
   repository are `CI` in `playwright.config.ts:10-12,23` and the GitHub Actions refs in
   `scripts/check-allowed-paths.mjs:16,24-25`; no `.env` supplies any of them.
2. **`.ai/standards/testing-standards.md:31-41` will be false the moment this ships.** It records
   *end-to-end — 4 pass, 6 fail* and instructs *"Re-run each command and correct this table the
   moment the tooling changes."* That is an instruction no agent may obey: the file is standards
   plane and human-only under RULE-01. **It needs a human edit after this ticket merges** — the
   correct new row is 10 tests in 2 files plus the guard, all passing, and the paragraph at `:38-41`
   describing the defect becomes a past-tense record. Not blocking, and not in `allowed_paths`.
3. **Idea open question 7 — what is already in the live project?** Still open, still nobody's but a
   human's. Listed under *Out of scope*.

## 3. Permission model

**No role gate applies. This ticket draws no control, exposes no route and reads no row**, so
`.ai/standards/rbac-and-security.md` has nothing to say about it and check R6 has one thing to
verify: that this section's claim is true of the diff.

Two refusals belong here anyway, because both are about who may cause the harness to run against the
real project, and both are the point of the ticket:

- **The harness may not choose its datastore from the machine.** Today whoever has a `.env` decides,
  silently, and nobody else can see the decision. After this ticket the config decides and the config
  is in git. `webServer.env` is applied over `process.env` rather than replacing it, verified below,
  so the pin beats the machine.
- **The one permitted bypass is a person typing `--no-deps`.** No environment variable, no config
  value and no `.env` may reach the tests past a failed guard. This is the refusal AC-6 states, and
  it is why the guard is a project dependency rather than a test.

## 4. Contract

Two artifacts. Both are copy-pasteable and both were validated against the installed packages —
Playwright 1.62.1 and Vite 8.2.2, resolved from `node_modules`, per
`.ai/standards/tech-stack.md:161-166`.

### 4.1 `playwright.config.ts` — three changes, nothing else

```ts
// 1. Pin the seam for the build the suite drives. `webServer.env` is merged OVER `process.env`
//    (playwright/lib/runner/index.js:858-862 — `{...DEFAULT_ENVIRONMENT_VARIABLES, ...process.env,
//    ...this._options.env}`), and Vite applies `process.env` AFTER the parsed `.env`
//    (vite/dist/node/chunks/node.js:5926), so this beats a developer's `.env` rather than losing
//    to it. Both variables the resolver at src/lib/data/index.ts:164 reads are pinned, so neither
//    half of its `||` is left to the machine.
webServer: {
  command: "pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort",
  url: "http://localhost:4173",
  reuseExistingServer: !process.env.CI,
  env: {
    VITE_DATA_SEAM: "mock",
    VITE_SUPABASE_URL: "",
  },
},

// 2. Two projects. `seam-guard` runs first and `chromium` declares it in `dependencies`, which
//    aborts the dependents rather than merely reporting beside them.
projects: [
  {
    name: "seam-guard",
    testMatch: /seam\.setup\.ts$/,
    use: { ...devices["Desktop Chrome"] },
  },
  {
    name: "chromium",
    testMatch: /.*\.spec\.ts$/,
    use: { ...devices["Desktop Chrome"] },
    dependencies: ["seam-guard"],
  },
],

// 3. The top-level `testMatch: "**/*.spec.ts"` is REMOVED. It is now per-project, and left in place
//    it would exclude the setup file from every project and the guard would silently never run.
```

`testDir: "tests/e2e"`, `fullyParallel`, `forbidOnly`, `retries`, `reporter` and `use.baseURL` are
unchanged.

### 4.2 `tests/e2e/seam.setup.ts` — new file, one test

```ts
import { expect, test } from "@playwright/test";

// The guard reads the SERVED PAGE and nothing else. It must not read import.meta.env, process.env,
// or any value from playwright.config.ts: a guard that reads the configuration agrees with the
// configuration and proves nothing (AC-4).
const EXPECTED_SEAM = "mock";

test(`the acceptance suite drives the "${EXPECTED_SEAM}" seam, and the served page says so`, async ({
  page,
}) => {
  await page.goto("/");

  const banner = page.getByTestId("seam-banner");
  await expect(
    banner,
    "no seam-banner on the served page: this build did not resolve to the in-memory seam, so the " +
      "run would exercise a real datastore. Refusing to start the suite.",
  ).toBeVisible();
  await expect(banner).toHaveAttribute("data-seam", EXPECTED_SEAM);
});
```

**The test title is AC-5's mechanism.** Playwright's reporter prints the project name and the test
title on every run, so `[seam-guard] › the acceptance suite drives the "mock" seam…` is the record,
in the report, on every run, passed or failed. No reporter is added and no artifact is written.

**`data-testid` and `data-seam` are the two attributes this depends on**, both already in the markup
at `src/App.tsx:23-24` and already addressed by `tests/e2e/tea-01-signup.spec.ts:53-55`. Nothing new
is introduced into the selector contract. *(Under ADR-022 there is no check R7 and nothing verifies
that a named selector exists in the markup; these two were read from `src/App.tsx` directly and the
line numbers above are that reading.)*

### 4.3 What was measured, not recalled

| Claim | Where it was checked | Result |
|---|---|---|
| `webServer.env` merges over `process.env` rather than replacing it | `playwright/lib/runner/index.js:858-862` | `{...DEFAULT_ENVIRONMENT_VARIABLES, ...process.env, ...this._options.env}` |
| Vite applies `process.env` after the parsed `.env` | `vite/dist/node/chunks/node.js:5926` | `for (const key in process.env) … env[key] = process.env[key]` — last write wins |
| A failing setup project aborts its dependents | isolated config, run under 1.62.1 | `1 failed … 1 did not run` |
| `reuseExistingServer: true` skips the command entirely | `playwright/lib/runner/index.js:845-849` | returns before `launchProcess`, so the pin never applies — which is what the guard exists for |
| A pinned build carries no Supabase client | `vite build` twice, bundles grepped | pinned 269.78 kB, `supabase.co` ×0, `createClient` ×0; unpinned 479.97 kB, `supabase.co` ×2 |
| Pinning both variables changes nothing further | third build | byte-identical output to pinning `VITE_DATA_SEAM` alone (same content hash) |
| `seam-banner` is absent from the unpinned bundle, not merely hidden | both bundles grepped | pinned ×1, unpinned ×0 — the branch is constant-folded away, so the guard's assertion is real |
| The exact `projects` wiring above enumerates correctly | `playwright test --list` against a scratch copy of `tests/e2e` plus the new file | `[seam-guard]` gets the guard alone; `[chromium]` gets all 10 existing tests; 11 tests in 3 files, none double-counted |

## 5. Seam impact

**None.** No function in `src/lib/data/` changes name, arity or behaviour, and no file under
`src/lib/data/` is in `allowed_paths`. `tests/seam-parity.test.ts` passes unedited and is deliberately
absent from `allowed_paths` for that reason.

One thing this section must say because `.ai/standards/architecture.md:25` names it explicitly: the
seam's import rule covers *"not a component, not a hook, not a **test helper**"*. `seam.setup.ts`
imports `@playwright/test` and nothing else. It reads a rendered page over HTTP and never imports the
seam, a domain type, or `@supabase/supabase-js` — so R4 has a one-line answer and AC-4 is satisfied by
construction rather than by discipline.

## 6. Schema delta

**`none`.** No migration, no policy, no trigger, no constraint, no table, no column — so ADR-014 does
not engage and `requires_adr` stays `false`. No `.sql` file is touched at all.

No dependency is added: `@playwright/test@1.62.1` is already in `devDependencies`
(`package.json:30`), and both mechanisms used here — `webServer.env` and project `dependencies` — are
in the installed version. Check R8 has nothing to find.

## 7. allowed_paths

```yaml
allowed_paths:
  - "playwright.config.ts"
  - "tests/e2e/seam.setup.ts"
```

Two globs, two files, one of which does not exist yet.

`size`: **S** — the sizing table gives S up to 6 files. **It AGREES with `size_estimate` in section
1, so ADR-012 is not engaged and nothing splits.** Both were written by the same agent minutes apart
and the agreement is worth exactly as much as that makes it; what makes S defensible is that the
enumeration was done after reading the config, the specs and the resolver, and no third file survived
the reading.

### Files deliberately absent, and why each one

- **`src/lib/data/index.ts`** — the application's seam resolution is out of scope (§1). If the fix
  ever appears to need this file, the fix has become a different ticket.
- **`tests/e2e/tea-01-signup.spec.ts`** — its guard at `:52-56` is TEA-01's, it is correct, and §10 of
  the ticket shell forbids deleting or skipping it. It stays, unedited, and the duplication is
  deliberate: see §8.
- **`tests/e2e/smoke.spec.ts`** — matched by the new per-project `testMatch` without an edit. Its
  comment at `:5-6` cites review check R7, which ADR-022 removed; correcting that comment is not this
  ticket's and the file is not in scope.
- **`.github/workflows/verify.yml`** — needs no edit, and AC-7 is the assertion of that. Both CI and
  the local gate invoke `pnpm exec playwright test`, so a pin inside the config fixes both at once.
  This is the argument for putting the pin in the config rather than in a workflow `env:` block or a
  package script, and it is stated here rather than leaving the workflow looking unexamined.
- **`.ai/standards/testing-standards.md`** — standards plane, human-only under RULE-01. *Open
  questions* item 2 records the edit it is owed.
- **`package.json`** — no script changes. `pnpm e2e` and the workflow's explicit invocation both
  reach the same config.

### The branch, and what it changed

`ticket.yaml` shipped with `branch: "bugfix/BUG_TEA-01_01"`, recorded as an operator decision on
2026-09-01 and taken knowing that both path resolvers hard-code `feat/` so RULE-03 would be
unenforced. **That decision was re-put to the operator at this PLAN with one fact that was not
available when they took it**, and they chose `feat/BUG-001`:

`scripts/check-allowed-paths.mjs:90` computes the ticket as `branch.slice("feat/".length).split("/")[0]`,
which yields `BUG-001`, and `:94` then looks for `.ai/board/tickets/BUG-001/ticket.yaml` — **which
exists**. So on `feat/BUG-001` the two-glob list above is enforced in CI against the real diff. On a
`bugfix/` branch `:85-87` exits 0 with *"nothing to check"* and RULE-03 is a promise. The triage put
`feat/BUG-001` to the operator as unavailable, citing `git-conventions.md:36`; it is available and it
is the enforced option, and for a ticket whose whole subject is a harness that could not state what
it was doing, an unenforced `allowed_paths` was the wrong price.

**What this costs, recorded rather than glossed:** `feat/BUG-001` contradicts `git-conventions.md:36`,
which says `<FEATURE-ID>` is a row in `features.md` and nothing else, and `BUG-001` is not a row.
That is a standards-plane inconsistency this ticket does not resolve and may not — it is human plane
under RULE-01. **It also means this ticket no longer spends the cheap moment `git-conventions.md:49`
names**, because no `bugfix/` branch is created here; fixing the two resolvers stays available and
stays steward work on an `ops/` branch.

`branch` in `ticket.yaml` is updated to `feat/BUG-001`, with the original decision and this one both
recorded there. The reviewer's hand-check of the diff against `allowed_paths`, which §4 of the shell
demanded because nothing else would do it, is now also done by CI — but R1 is still the reviewer's
and still wants its `file:line`.

## 8. Rejected alternatives

### Rejected: pin the seam and stop there

MD-021's fix shape asks for both halves and the idea file left the sizing open, so this was the real
alternative rather than a strawman: one line in `webServer.env`, no new file, and today's runs become
correct and reproducible.

**It was rejected on a measurement.** `reuseExistingServer: !process.env.CI` is true on every
developer machine, and `playwright/lib/runner/index.js:845-849` returns *before* `launchProcess` when
the URL already answers. So a developer with a preview left running on 4173 from an unpinned build
gets the pin skipped entirely, with no message: the config says `mock`, the build never runs, and the
suite drives whatever was built earlier — which is the live project. A pin that is silently skipped
in the most common local configuration is not a fix, and the failure it leaves behind is the exact
one being fixed.

The guard closes it because it asserts what the browser received rather than what the config
intended, and it aborts rather than reports. That is also why `reuseExistingServer` is **left as it
is** rather than set to `false`: the reason the flag exists is to spare a build on every local run,
and once a reused-but-wrong server is caught before any test opens a page, reuse is no longer
dangerous. Setting it to `false` would have bought the same safety at the cost of a build per run and
a hard failure whenever anything else holds port 4173.

### Rejected: put the pin in the CI workflow, or in a package script

`.github/workflows/verify.yml:51` has no `env:` block, so an `env: VITE_DATA_SEAM: mock` there would
fix CI. It would fix only CI. The QA-era failure and the `/ship` failure both happen locally, on a
machine with a `.env`, and CI has been green only by the accident of having no `.env` at all — the
two disagree structurally about the same commit today and neither says why. A pin inside
`playwright.config.ts` is loaded by every invocation of the command, so the workflow needs no edit
and the two stop being able to disagree. A `package.json` script fails the same way: the workflow
does not call it.

### Rejected: delete the in-suite guard at `tests/e2e/tea-01-signup.spec.ts:52-56` now that a better one exists

It is genuinely redundant — the setup guard asserts the same two attributes, earlier, with the power
to stop the run — and the idea file's own objection to the setup project was that it would be *"the
second place the rule is written"*, which this leaves true.

Rejected for two reasons. It is TEA-01's file and outside `allowed_paths`, so removing it is a
RULE-03 violation before it is anything else. And the duplication is not symmetric: one guard
**reports** from inside a suite that has already started, the other **prevents** the suite from
starting. Under ADR-022 there is no longer a QA stage to notice if the preventing one is ever
disabled, so the reporting one is the fallback, and the cost of keeping it is four lines that pass.

### Rejected: assert the environment variable in a global setup instead of the page

Cheaper, faster, no browser. It also proves nothing: `process.env.VITE_DATA_SEAM` in the Playwright
process is a different thing from what the *build* consumed and a third thing from what the *served
page* is running, and the `reuseExistingServer` path above is exactly the case where all three
disagree. This is AC-4, and the measurement that makes it concrete is that `seam-banner` appears zero
times in the unpinned bundle and once in the pinned one — the branch is constant-folded away at build
time, so the page really is the only place the answer exists.

## Changelog

- `2026-09-03T08:20:02+07:00` — sections 1-8 written. **Disclosure required by the template's
  ordering note:** sections 1 and 2 were drafted before section 3 onward, but the source tree and the
  installed packages had already been read, because the ticket shell's §5-§7 asserted three mechanisms
  (`webServer.env` precedence, the setup-project abort, the bundle measurement) that had to be
  confirmed against disk before any criterion could be written that depended on them. The ordering
  habit ADR-019 left in place of the SPEC/DESIGN split is therefore only partly observed here, and
  saying so is the only control available. No AC was reshaped to fit an implementation; AC-3, AC-4 and
  AC-8 became *more* demanding after the measurements, not less.
- `2026-09-03T08:20:02+07:00` — section 7 `branch` amended from `bugfix/BUG_TEA-01_01` to
  `feat/BUG-001`. Raised by `tech-lead-design` on measuring that `check-allowed-paths.mjs:90,94`
  resolves `feat/BUG-001` to an existing ticket file and therefore enforces RULE-03, a fact not
  available at triage. Decided by the operator, 2026-09-03.
