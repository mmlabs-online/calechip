---
stage: TRIAGE
agent: product
produced_at: 2026-09-01
inputs_read:
  - .ai/steward/context.md
  - .ai/templates/idea.md
  - .ai/01-operating-model.md
  - .ai/registry/features.md
  - .ai/registry/decisions/ADR-021-the-qa-waiver-is-reverted.md
  - .ai/standards/architecture.md
  - .ai/standards/testing-standards.md
  - .ai/board/model-debt.md
  - .ai/board/ideas/2026-09-01-a-person-who-signs-up-has-nowhere-to-come-back-to.md
  - src/lib/data/index.ts
  - playwright.config.ts
  - tests/e2e/tea-01-signup.spec.ts
  - .env
  - .gitignore
  - .github/workflows/verify.yml
  - .github/workflows/allowed-paths.yml
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# The end-to-end suite does not pin which seam it drives

## Problem

**Nobody can say which datastore the acceptance suite exercised, and nobody can make it say.** The
end-to-end run named in `.ai/standards/testing-standards.md:19` — `pnpm exec playwright test` — builds
the application and then discovers its datastore from whatever environment happens to be on the
machine. The suite states no preference, the config states no preference, and the report the suite
produces does not record which one it got.

That single absence produces two distinct failures, and the second is the worse one.

**1. The verdict is not reproducible.** `src/lib/data/index.ts:164` resolves the seam with

```
const usesMock = import.meta.env.VITE_DATA_SEAM === "mock" || !import.meta.env.VITE_SUPABASE_URL;
```

`playwright.config.ts:20-24` declares `webServer.command` as
`pnpm exec vite build && pnpm exec vite preview --port 4173 --strictPort` and sets **no `env` block at
all**, so the build inherits the machine's `.env`. `.env` is untracked and gitignored
(`.gitignore:21-22`, `.gitignore:31`), which means the input that decides the answer is the one input
no reviewer can read. On a machine with no `.env` the suite resolves to the in-memory seam and passes.
On a machine with one it resolves to Supabase and fails. Same commit, same command, two verdicts.

**2. When it resolves to Supabase, an acceptance run drives the live hosted project with a
developer's own credentials.** The `.env` in this working tree carries a real
`VITE_SUPABASE_URL` pointing at a hosted Supabase project, an anon key, a **service-role key** and a
database URL (`.env:8-11`). `tests/e2e/tea-01-signup.spec.ts` is a sign-up suite: run against that
project it creates real auth users and mutates real rows. Nothing in the run announces that it did, and
nothing in its output distinguishes it afterwards from the run that touched nothing.

**Stated as an absent declaration rather than as "set `VITE_DATA_SEAM=mock` in the config"
deliberately.** A variable in one file would make today's failures go away; what is missing is that the
suite has no way to say which implementation it is a test of, and no way to refuse to run against the
wrong one. Which of those two things gets built is a design decision and is not made here.

### The guard exists, fires correctly, and is the thing reporting the defect

This is not an unnoticed hole. `tests/e2e/tea-01-signup.spec.ts:49-56` is a test written for exactly
this eventuality, with its reasoning above it: *"If a future build ever resolves to the real seam, this
fails loudly and the report that cites this suite stops being true quietly."* It asserts `seam-banner`
is visible and carries `data-seam="mock"`.

It is failing now. So the failure is the harness working as designed — the suite is correctly refusing
to claim it proved something it did not prove. **The defect is that there is no way to give it the
answer it is asking for.**

The file's own header (`tests/e2e/tea-01-signup.spec.ts:14-18`) also carries a claim that has become
false: *"Section 6.2 resolves a build with no `VITE_SUPABASE_URL` to the mock, which is what the
end-to-end command named in `.ai/standards/testing-standards.md` produces."* That command produces no
such thing on a configured machine, and the sentence was true when written.

### `VITE_DATA_SEAM` is set nowhere in this repository

Searched the whole tree outside `.ai/`: the string `VITE_DATA_SEAM` appears in exactly one file,
`src/lib/data/index.ts:164`, which is the line that reads it. No config, no npm script, no CI workflow
and no test file ever writes it. **Every mock-driven end-to-end run this project has ever had was mock
by accident of an absent variable, not by choice.** The escape hatch the seam offers has never been
used, which is why nothing broke until a `.env` appeared.

## Who has it

- **QA, at every `/qa` run, starting with the next one.** ADR-021 re-armed the gate on 2026-09-01, and
  Definition of Done item 3 (`.ai/01-operating-model.md:355`) requires typecheck, lint, unit **and
  end-to-end** to exit 0. On a machine carrying `.env`, end-to-end does not exit 0 today, so QA reaches
  a FAIL it did not cause and cannot fix inside the ticket it is judging.
- **The developer, at every `/implement`.** They are the role most likely to have a `.env` — they need
  it to run the application at all — so they are the role for whom the suite is broken by default, and
  for whom running it locally writes to the live project.
- **Anyone who clones the repository, on their first run.** The suite passes for them, and it passes
  *because* their machine is unconfigured. A green first run teaches them the suite is fine.
- **The reviewer of any pull request, silently.** `.github/workflows/verify.yml:51` runs
  `pnpm exec playwright test` with no `env:` block, on a runner with no `.env`. So CI resolves to the
  mock, goes green, and its green means only that the runner is unconfigured. **CI and the QA gate now
  disagree structurally about the same commit**, and neither says why.

## Evidence

Observed and recorded, twice, by two different mechanisms, before this idea was written.

**1. The measured result on `main`.**
`.ai/registry/decisions/ADR-021-the-qa-waiver-is-reverted.md:29-34` records all four commands run in
this repository on 2026-09-01:

| Role | Command | Result |
|---|---|---|
| typecheck | `pnpm exec tsc --noEmit` | exit 0 |
| lint | `pnpm exec eslint .` | exit 0 |
| unit | `pnpm exec vitest run` | 1 file, 2 tests, all pass |
| end-to-end | `pnpm exec playwright test` | 10 tests in 2 files — **4 pass, 6 fail** |

Three of the four are clean. The failures are confined to the one command whose input is unpinned.
`.ai/standards/testing-standards.md:33-38` carries the same table and the same conclusion.

**2. It is already model debt, at severity high.** `.ai/board/model-debt.md:29`, MD-021, found
2026-09-01, titled *"The end-to-end suite does not pin which seam it drives, so its result depends on an
untracked local file and it can run against the live Supabase project."* Its second half states the
same ordering this idea does: *"when the suite does resolve to Supabase it exercises the real project
with the developer's own credentials, so an acceptance run mutates production data and its verdict
depends on whose machine it ran on."*

**3. ADR-021 owes this ticket by name, ahead of CAL-01.** Its *What is owed* section
(`ADR-021-the-qa-waiver-is-reverted.md:112-114`) names as the first of two debts: *"A bug ticket for
the seam pinning, ahead of CAL-01. The end-to-end suite must pin its seam explicitly rather than
inheriting whatever `.env` the machine has, and it must never drive the live project."* The same ADR at
line 59-60 says plainly why no steward fixed it in place: *"Repairing a test harness is ticket work."*

**4. The six failures are one defect, and the defect is not in shipped behaviour.**
`ADR-021...:44-52` traces them: TEA-01's suite was written when neither variable was set, so the build
resolved to the in-memory seam and `App.tsx` rendered the `seam-banner` those assertions read; with
`VITE_SUPABASE_URL` present the banner is *correctly* absent. Nothing regressed. The tests are right
and the harness cannot tell them what they are testing.

**5. The credentials, read directly.** `.env:8` is a live hosted project URL; `.env:9` an anon key;
`.env:10` `SUPABASE_SERVICE_ROLE_KEY`; `.env:11` a `postgresql://` connection string with a password.
The file's own comment at `.env:4-6` explains that the service-role key *"bypasses row-level security
entirely, and under ADR-005 that is not one control among several — it is the whole authorization
model."* That key is not read by the browser build, and it is in the same file that today decides which
project the acceptance suite talks to.

**6. Nothing in the run records which seam it used.** `playwright.config.ts:12` sets `reporter` to
`line` or `list`; there is no global setup, no fixture and no reporter annotation that writes the
resolved seam. The only trace is whether one test out of ten passed.

## Impact if ignored

**No ticket passes the QA gate. Not one, starting now.** Definition of Done item 3
(`.ai/01-operating-model.md:355`) requires end-to-end to exit 0, and ADR-021 §Consequences
(`ADR-021...:98-99`) says so in its own words: *"Until it lands, no ticket can pass the QA gate."* The
loop has a gate it cannot clear on any configured machine.

**CAL-01 is the first ticket to hit it**, and ADR-021 anticipated that
(`ADR-021...:95-97`): it creates `entry`, INV-01's exclusion constraint, INV-02's trigger and INV-03's
check — *"a larger untested surface than the three waived tickets combined."* It stops at QA on a
harness defect rather than on anything about itself, which is the worst place for a stop to be, because
the ticket's own artifacts contain nothing that explains it.

**Every acceptance run on a developer machine writes to the live project until this changes.** A
sign-up suite creates auth users; `fullyParallel: true` (`playwright.config.ts:9`) means several at
once; `retries` is 0 locally and 1 in CI (`playwright.config.ts:11`), so a flaky run writes twice.
Nobody has to make a mistake for this to happen — running the documented command is enough.

**The cheapest way out of the failure is the destructive one, and somebody will find it.** Six failing
assertions plus one guard test standing between a ticket and DONE is exactly the pressure under which
the guard at `tests/e2e/tea-01-signup.spec.ts:52` gets deleted or skipped. Deleting it makes the suite
green in both configurations and removes the only thing that would ever again report which datastore an
acceptance run touched. Its own comment says what is lost: *"the report that cites this suite stops
being true quietly."*

**The three tickets already shipped untested stay that way behind an unclearable gate.** ADR-021
(`:100-101`) records TEA-02, TEA-03 and TEA-04 as DONE and untested, with a second ticket owed to retire
that surface. That ticket also needs a working end-to-end command, so this defect blocks the repayment
of the other one.

**And the fact that will not stay true:** `verify` stays green on every pull request while the QA gate
fails on every machine. Green CI on a commit whose acceptance suite is broken is not a neutral absence
of information — it is a false statement that a reviewer is entitled to rely on.

## Constraints already known

Cited, not restated. None of these is chosen here; each bounds what the eventual ticket may do.

- **RULE-02** — the seam is `src/lib/data/`, declared at `.ai/standards/architecture.md:17` and
  enforced by `no-restricted-imports` in `eslint.config.js` (`architecture.md:31-37`). Nothing outside
  the seam may import the Supabase client, so any mechanism that selects an implementation stays inside
  the seam or outside the application entirely — in the runner's configuration. A test file may not
  reach past the seam to pick a client.
- **ADR-005 — authorization is row-level security and there is no server.** This is what makes the
  second half of the problem a security matter rather than test hygiene. RLS is not one control among
  several; it is the entire authorization model. A `.env` that decides the acceptance suite's target
  also holds a service-role key that bypasses that model, and `.ai/standards/rbac-and-security.md`
  records as a known weakness that the anon key is public by design and the endpoint is reachable
  without this application.
- **[ADR-021](../../registry/decisions/ADR-021-the-qa-waiver-is-reverted.md)** — the QA gate is armed,
  `/ship` requires all three gates `passed: true`, Definition of Done items 3 and 4 are restored, and
  this work is owed **ahead of CAL-01**. Its revert condition is three consecutive tickets stopping at
  QA on tooling — which is what will start happening if this is not done, so the fix protects a
  decision made one day ago.
- **MD-021**, `.ai/board/model-debt.md:29` — records the defect and a fix shape. **It is a fix shape in
  a debt register, not a design**, and DESIGN is free to contradict it. It is cited here so the eventual
  ticket starts from what was already reasoned rather than re-deriving it.
- **`.ai/standards/testing-standards.md`** — the four commands are named there and only there
  (`:16-19`), which is what `.ai/01-operating-model.md:365-367` relies on. Changing what
  `pnpm exec playwright test` means changes the command every gate in the model refers to by role.
- **Definition of Done item 4** (`.ai/01-operating-model.md:356`) — every AC maps to a named test. A
  suite whose datastore is unstated makes that mapping unverifiable rather than false: the AC maps to a
  test, and nobody can say what the test ran against.
- **The seam-parity test** — `tests/seam-parity.test.ts` exists to keep the two implementations
  interchangeable. Any change that makes the suite depend on one implementation's behaviour rather than
  on the interface is in tension with it.
- **`.gitignore:21-23`** already ignores `.env` and `.env.*` while permitting `.env.example`. Whatever
  the answer is, it cannot be a tracked file containing credentials.

## Out of scope

- **Standing up a second end-to-end suite against a real, dedicated test database.** That is a separate
  decision with its own cost — a project to provision, a lifecycle, credentials in CI, seed data — and
  MD-021's fix shape says the same in its own words: *"A second suite against a real database is a
  separate decision and needs its own project, never the developer's."* This idea is about the suite
  that exists being able to say what it drives.
- **Retiring the untested surface of TEA-02, TEA-03 and TEA-04.** That is the *other* ticket ADR-021
  owes (`ADR-021...:115-117`) — the allow-list writes, the team-scoped read policy, the admin write path
  and its trigger, all row-level policy work under ADR-005. It is downstream of this one and is not
  discharged by it.
- **Fixing or rotating anything in `.env`.** The service-role key's presence beside the suite's target
  is named above as a reason this matters. Deciding what to do about the key, about `.env.example`, or
  about the commit history that `.gitignore:17-20` records, is not this.
- **The permission-model test against a real PostgreSQL.** Named as owed in
  `.ai/standards/testing-standards.md` and `.ai/standards/rbac-and-security.md` since ADR-005. Adjacent,
  frequently confused with this, and a different problem: that test is *supposed* to hit a real database.
- **Rewriting TEA-01's acceptance criteria or its six failing assertions.** They are correct. Nothing
  here should change what a test asserts; the harness has to stop lying to them about their environment.
- **Changing how `src/lib/data/index.ts` resolves the seam for the application.** The fallback at line
  164 is deliberate and `index.ts:166-171` records why: a deployment that forgets one variable would
  otherwise accept sign-ups into memory and look entirely normal. This idea is about the test harness's
  inability to state a choice, not about the application's default.
- **Whether CI should run against anything other than the mock.** Real, adjacent, and a decision about
  infrastructure rather than about this suite.

## Open questions

**Three of these seven are closed by the verdict below and four still stand.** Closed: 1 (the ID),
partly 4 (a mechanism is verified, the choice is still PLAN's) and 5 (the mock configuration is green).
Read each one below together with its entry under *The seven open questions, by name* in the verdict.

1. **Under which ID does this work exist?** This is the one that must be answered before a ticket can
   be created, and it is a genuine contradiction between two documents, not an oversight:
   - `.ai/01-operating-model.md:321` declares *"Defects are `BUG-nnn`, chores are `OPS-nnn`"*. This is
     defect and harness work with no user-facing capability, so `BUG-nnn` is what the ID scheme names.
   - **Definition of Ready item 1** (`.ai/01-operating-model.md:335`) requires `feature_ids` non-empty
     with every ID present in `.ai/registry/features.md`, and check D1 fails the audit on an ID that
     resolves to no row.
   - `.ai/registry/features.md:65` declares `<!-- id-prefixes: CAL ADM TEA -->`, and the file states at
     line 52 that **extending that set requires an ADR**.

   So a `BUG-nnn` is unrepresentable in `features.md` and would be the dangling citation D1 exists to
   report; a `CAL`/`ADM`/`TEA` row would file harness work as a product capability; and adding a prefix
   is an ADR. The same wall was hit and worked around on 2026-09-01 — the TEA-05 triage left the
   provisioning chore out of `depends_on` for exactly this reason
   (`.ai/board/ideas/2026-09-01-a-person-who-signs-up-has-nowhere-to-come-back-to.md:492-495`). **Not
   decided here.** A separate dispatch is assessing it, and this idea would be wrong to pre-empt the
   answer by choosing a shape that happens to fit.

2. **Does the suite declare its seam, or refuse to run against the wrong one, or both?** Pinning a
   variable makes today's runs correct. It does not stop the next config change from silently swapping
   the datastore again, which is the failure that actually occurred. MD-021's fix shape asks for both;
   whether the second half is this ticket or a follow-on is a sizing question for DESIGN.

3. **Should the run record which seam it drove, in its own output?** Today the only trace is one test
   out of ten. A report that names the datastore would have made the 4-pass/6-fail result
   self-explaining. This is the difference between a fix that works and a fix that stays true, and it is
   the most likely place for the ticket to grow.

4. **Is the guard test enough, or does the check belong before the browser starts?**
   `tests/e2e/tea-01-signup.spec.ts:52` catches a wrong seam after a build, a server and a page load —
   and only for anyone who reads past the first failure. A check in setup would fail the run rather than
   one test. It would also be the second place the rule is written, which is the thing this repository
   consistently refuses.

5. **Does the four-pass/six-fail split hold on a clean machine, or does something else fail too?** The
   measurement in ADR-021 was taken on a machine with `.env` present. Nobody has recorded a run of both
   configurations side by side, so *"the mock configuration is 10/10 green"* is an assumption. It is
   cheap to check and it decides whether this is one defect or two.

6. **Does anything else in the toolchain read `.env` the same way?** The seam resolution is the one
   found. `vite build` loads `.env` for any `VITE_`-prefixed variable, so the question is whether a
   second behaviour is switched by the same untracked file. Not searched exhaustively here.

7. **What happens to the acceptance runs that already touched the live project?** Six failing tests
   means four passed against Supabase on at least one occasion, and this suite creates auth users. Nobody
   has looked at what is in that project. It may be nothing; it is not currently known.

## Triage verdict — 2026-09-01

**PROMOTE.**

`product` and `tech-lead-design` triaged this in parallel on 2026-09-01. The technical half supplied
the answer to open question 1, which is the question that decided between this verdict and
NEEDS-ADR; its citations are re-read against the tree here rather than accepted.

### Why PROMOTE and not REJECT-as-already-covered

The obvious REJECT argument is that this is already recorded. It is: **MD-021**,
`.ai/board/model-debt.md:29`, severity high, with a fix shape. **A model-debt row is not a ticket.**
Nothing in the loop reads `model-debt.md`, no command consumes a row from it, and no gate is cleared
by one — that register exists for what was *recorded rather than fixed*, which is the opposite of what
is wanted here.

`ADR-021` *What is owed* item 1 owes exactly this ticket by name, ahead of CAL-01, and says plainly
that **neither owed ticket is the steward's to create**, because `/triage` creates tickets (ADR-010).
This run is that mechanism. Rejecting on the ground that a debt row exists would leave the debt owed
by nobody.

### Why PROMOTE and not NEEDS-ADR — question 1 is answered, and the answer needs no ADR

Open question 1 asked under which ID this work exists, and presented it as a genuine contradiction:
`BUG-nnn` is unrepresentable in `.ai/registry/features.md`, a `CAL`/`ADM`/`TEA` row would file harness
work as a product capability, and adding a prefix requires an ADR. **The contradiction dissolves on
one distinction the question missed: `id` and `feature_ids` are two different fields.**

- **Definition of Ready item 1** (`.ai/01-operating-model.md:335`) constrains **`feature_ids`** —
  *"`feature_ids` non-empty, and every ID present in `.ai/registry/features.md`"*. It says nothing
  about the ticket's `id`.
- The template has them as separate fields: `.ai/templates/ticket.yaml:4` is `id`,
  `.ai/templates/ticket.yaml:6` is `feature_ids`.
- So **`id: BUG-001` with `feature_ids: [TEA-01]` satisfies item 1 literally**, and item 6 with it —
  `[TEA-01]` is exactly one feature group.
- **Check D1 is not tripped.** `scripts/check-docs.mjs:184-185` builds
  `\b(?:CAL|ADM|TEA)-\d{2}\b` from the declared prefixes. `BUG-001` matches neither half: wrong prefix,
  and three digits against `\d{2}`.
- `.ai/01-operating-model.md:321` already declares the scheme — *"Defects are `BUG-nnn`, chores are
  `OPS-nnn`"*. Nothing new is being invented; the ID scheme was there and nothing had used it.

**The TEA-01 parentage is factual rather than a convenience that happens to satisfy a check.**
`.ai/standards/git-conventions.md:38-39` requires a bug ID to carry its parent feature *because* *"a
bug branch that cannot be traced to a feature is a bug nobody can decide the priority of"*. And
`ADR-021:39-40` calls the six failing tests **TEA-01's own acceptance tests**. This defect is in
TEA-01's harness, it was found by TEA-01's suite, and it is fixed in the files that suite runs from.

**No document changes and no ADR is required**, so ADR-008's stop-and-ask test does not fire and
nothing here supersedes an accepted decision. The two alternatives were tested and rejected:

- **Exempting `BUG-`/`OPS-` from Definition of Ready item 1.** That is an amendment to
  `.ai/01-operating-model.md`, and it manufactures a class of ticket with no feature provenance —
  which is the exact property `git-conventions.md` says the bug ID scheme exists to prevent. It solves
  a problem that turned out not to exist.
- **A fourth group prefix.** `features.md:52` requires an ADR to extend the set, and the set was
  chosen by the operator personally on 2026-08-31 from options of three, four and six
  (`features.md:73`). Reversing that is changing the envelope, not working inside it, so it could not
  be agent-accepted under ADR-008 in any case.

### The departure from `/triage`'s default: NO new row in `features.md`

**Stated here rather than left for a reviewer to discover, because it is a deliberate deviation from
the command file.** `/triage` on PROMOTE says to allocate the next free number in a group, write a row
with `Status: PLANNED`, and cite the idea file in `Notes` (ADR-007). **That was not done: no number
was allocated in any group, and no new row exists in any of the three group tables.**

*The three candidate IDs this sentence would naturally have named are deliberately not written out.
Check D1 matches a group-prefixed token anywhere in any document and cannot read the surrounding
denial, so naming them to say they do not exist is the exact thing that fails the audit — verified,
it did, on the first run of `node scripts/check-docs.mjs` after this verdict was appended.*

The reason is that this is a defect against shipped TEA-01 behaviour, not a new capability. `CLAUDE.md`
calls `.ai/registry/features.md` *"the only valid source of feature IDs"*, and the file's own Columns
section says `Status` records **what the product contains**. A test harness that cannot state which
datastore it drove is not something the product contains; a row for it would put a line in the feature
registry that no user story could ever be written against, and every later reader would have to work
out why.

**What was written instead: a sentence appended to the existing TEA-01 row's `Notes`**, citing this
idea file and `BUG-001`. That preserves the one property ADR-007 §Decision relies on — *"a row with no
citation was not promoted from anything, and that is exactly what a reviewer should stop on"* — by
giving the reviewer the provenance in the place they will look. RULE-01 v2 permits a feature-row edit
without an ADR; CODEOWNERS review of the pull request is the approval, exactly as it is for a new row.

### The seven open questions, by name

**1 — Under which ID? → `id: BUG-001`, `feature_ids: [TEA-01]`, `group: TEA`. Answered above.**

**2 — Declare the seam, or refuse to run against the wrong one, or both? → Still open. PLAN's.**

Both halves are now known to be buildable, which is more than the question had. Pinning works:
`webServer.env` reaches the build, and Vite's `loadEnv` applies `process.env` **after** the parsed
`.env` file and overwrites it — so a pin in the config beats a developer's `.env` rather than losing
to it. Refusing works too, by the mechanism under question 4. Which of the two this ticket contains,
and whether the second half is a follow-on, is a sizing decision at PLAN and is not taken here.

**3 — Should the run record which seam it drove? → Still open. PLAN's.** Nothing found during triage
changes the question.

**4 — Guard test, or a check before the browser starts? → A mechanism is verified. The choice is
still PLAN's.**

The question's objection stands and is sharpened rather than removed: `tests/e2e/tea-01-signup.spec.ts:52-56`
reports the breach and **cannot prevent it**, because `playwright.config.ts:9` sets
`fullyParallel: true` — the sign-up tests hit the live project concurrently with the guard failing, so
by the time the report is read the writes have happened. A Playwright **setup project** that
`chromium` declares in `dependencies` does abort dependents; it was verified on an isolated config,
which reported `1 failed … 1 did not run`. Its escape hatch is `--no-deps`.

The question's other half — *"it would be the second place the rule is written"* — is a real cost and
is left to PLAN with the mechanism attached.

**5 — Does the four-pass/six-fail split hold on a clean machine? → Half answered, and the answer is
recorded carefully.**

`VITE_DATA_SEAM=mock pnpm exec playwright test` was run during this triage and **10 passed**. So the
assumption the question flagged — *"the mock configuration is 10/10 green"* — is now measured rather
than assumed, and this is one defect rather than two.

**The 4/6 split recorded in `ADR-021` was not reproduced in this run, and is not reported here as
newly observed.** The run that produced it is ADR-021's; nothing in this triage re-measured the
unconfigured-machine case, and a second measurement is not being invented to make the two agree.

**6 — Does anything else in the toolchain read `.env` the same way? → Still open.** Not searched
exhaustively here either.

**7 — What is already in the live project? → Still open, and it is not this ticket's.** Nobody has
looked. It is out of scope below for the same reason as rotating the credentials: inspecting or
cleaning a hosted project is an operations question with a human on the end of it, not a change to a
test harness.

### What was promoted

| | |
|---|---|
| Feature row | **none written** — see the departure section above |
| Registry write | one sentence appended to the existing `TEA-01` row's `Notes`, citing this file and `BUG-001` |
| Ticket | `.ai/board/tickets/BUG-001/ticket.yaml`, `state: BACKLOG`, `feature_ids: [TEA-01]`, `group: TEA` |
| Branch | **not chosen.** `branch: ""`, with the reason recorded on the shell — see below |
| `depends_on` | `[]` — nothing blocks it |
| `schema_delta` | `none`, `requires_adr: false`. It touches no migration, no policy and no table |
| Backlog | **appended** to `## BACKLOG`, with the ordering fact a human needs stated beneath the table |

**`depends_on` is `[]` although TEA-01 is `IN_PROGRESS`.** Definition of Ready item 3 asks whether
every ticket in `depends_on` is `DONE`, and an empty list satisfies it. TEA-01 is deliberately not
listed: this ticket fixes TEA-01's *test harness*, not its behaviour, and it must be able to land
while TEA-01's row is still open — that is the whole point of putting it ahead of CAL-01.

**The branch name is a real unresolved question and triage refused to answer it.**
`.ai/standards/git-conventions.md:32` gives the bugfix pattern as `bugfix/BUG_<FEATURE-ID>_<NN>`,
which yields `bugfix/BUG_TEA-01_01` and does not contain the string `BUG-001` at all — two bug ID
schemes in two documents. Worse, `git-conventions.md:44-49` records that **`bugfix/` runs with the
path guard disabled**, because both resolvers hard-code `feat/`; that file calls it a defect rather
than a decision and says the moment to fix it is before any `bugfix/` branch exists. This ticket would
be the first. `.ai/standards/` is human plane under RULE-01, so neither this triage nor this ticket may
settle it. **It goes to the operator, and `branch` stays empty until it is settled.**

### Ordering

`ADR-021` §Consequences requires this ticket **ahead of CAL-01**, which is row 2 of `## BACKLOG`
today, and states the reason in its own words: *"Until it lands, no ticket can pass the QA gate,
because Definition of Done item 3 requires the suites to exit 0."* Definition of Done item 3 is
restored by that same ADR (`.ai/01-operating-model.md:355, 360-363`).

**The row was appended rather than inserted, and nothing was renumbered.** `backlog.md`'s own header
says it is an ordered list that a human reorders; `product` asserts nothing about position, which is
the same stance the TEA-05 row was appended under. The fact a human needs in order to place it is
stated beneath the table there, not implied by a position taken here.
