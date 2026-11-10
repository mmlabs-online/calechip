---
doc_version: 4
last_updated: 2026-10-13
governed_by: [RULE-05, RULE-07, RULE-08]
---

# Testing standards

## Tools and commands

The Definition of Done in `.ai/01-operating-model.md` refers to these by role — typecheck, lint,
unit, end-to-end — precisely so that this is the only file that has to know their names.

| Role | Command |
|---|---|
| typecheck | `pnpm exec tsc --noEmit` |
| lint | `pnpm exec eslint .` |
| unit | `pnpm exec vitest run` |
| end-to-end | `pnpm exec playwright test` |
| documentation audit | `node scripts/check-docs.mjs` |
| allowed-paths | `node scripts/check-allowed-paths.mjs` |
| hook and script tests | `node --test .claude/hooks/tests/*.test.mjs scripts/tests/*.test.mjs` |

The last three ship with this kit and need no editing.

**All four now run. Verified 2026-09-01, and that verification is what fired ADR-017's third revert
condition.** This paragraph read *"none of the first four commands runs yet"* until then, which was
true when written and became false without anyone noticing — which is the failure the sentence it
replaces was warning about.

| Role | Result on 2026-10-13 |
|---|---|
| typecheck | exit 0 |
| lint | exit 0 |
| unit | 37 files, 710 tests, all pass |
| end-to-end | 366 passed, 21 skipped (quarantined — `docs/ops/e2e-quarantine.md`), 0 flaky, 0 failed; 387 tests in 47 spec files, run as `CI=1` |

**The six end-to-end failures this table recorded are fixed and the suite is green.** The row above
read *"10 tests in 2 files — 4 pass, 6 fail"* from 2026-09-01 until 2026-09-08, and the paragraph
under it blamed MD-021: the suite did not pin which seam it drove, so `src/lib/data/index.ts`
resolved to Supabase whenever a `.env` carrying `VITE_SUPABASE_URL` was present. **BUG-001 fixed that
on 2026-09-03** — `playwright.config.ts:49-51` now pins `VITE_DATA_SEAM: "mock"` and
`VITE_SUPABASE_URL: ""` in `webServer.env`, which is exactly the fix MD-021 asked for, and MD-021 is
marked RESOLVED in `.ai/board/model-debt.md`.

**The suite went red again at #87 and CICD-01 made it exit 0 by quarantine, not by repair.** The 21 skips above are the ADR-060 quarantine of tests that fail on `main`; each has a row in `docs/ops/e2e-quarantine.md` against a `BUG-nnn` ticket and an expiry, and check D15 refuses an unregistered or expired one. Two further tests (EVT-02 AC-28, EVT-10 AC-2/3/4) are registered as *flaky* and still run under the CI retry; they failed first in earlier runs and passed on retry, so the flaky count above is 0 only for the run measured.

**This is the second time this table went stale in the direction that costs something, and the cost
was paid on 2026-09-08.** CAL-09 is the first ticket to cite these two documents as a reason to skip
the end-to-end command at both `/implement` and `/review`; both stages declared the skip rather than
hiding it, which is the right instinct, and both were reading a table that had been wrong for five
days. A stale *pass* would merely be untrue; a stale *fail* is an excuse a later stage can lean on.

Re-run each command and correct this table the moment the tooling changes. A command table that has
never been executed is a claim, and the Definition of Done treats it as a fact.

**The runners themselves are named in [tech-stack.md](tech-stack.md), with their majors.** This table
holds the invocations and nothing else, because the Definition of Done and checks R2 and R3 refer to
them by role and one file has to know their names. Naming the tool in both places would put the
version in two files, and the copy is always the one that goes stale.

## The selector contract

**RULE-05 is retired and there is no QA stage — ADR-022.** What this section described is kept
because the reasoning survives its enforcement, and because whoever writes a test now has to supply
by hand what the model used to supply by structure.

It read: RULE-05 governs the selector contract and `guard-read-scope.mjs` enforces it. It was never a
restriction on QA's curiosity — it was what made the QA gate mean something. *An agent that reads the
implementation writes tests that pass against the implementation, including against the parts of it
that are wrong. An agent that can only see the story and the selector contract writes tests against
the specified behaviour, and the difference between the two is exactly the defect the gate existed to
catch.*

**That difference does not go away when the gate does.** Nobody is now prevented from writing a test
derived from the code it judges, and nothing reports one that is. The plan's testability contract is
gone with plan section 8, and check R7 with it.

**The selector attribute is `data-testid`.** Said once, here, and it still holds: the tests that
already exist address it, and it is what Playwright addresses by default.

It is also what Playwright addresses by default through `getByTestId`, so the contract and the
end-to-end runner agree without configuration.

## Test naming

Every acceptance criterion has an ID (`AC-1`, `AC-2`). Every AC maps to at least one named test, and
the test name contains the AC ID:

```
test("AC-3: a manager assigning a closed order is refused", ...)
```

The Definition of Done requires this mapping to be complete. A story with five ACs and four mapped
tests is not done, and the unmapped AC is the one that will break.

## What each level covers

| Level | Covers | Does not cover |
|---|---|---|
| Unit | Pure logic, permission rank comparisons, seam parity | Rendering, routing |
| Component | A component against the mock seam | Real data, an authenticated session |
| E2E | A full acceptance criterion through the interface | Anything that needs a schema not yet approved |

## The two mandatory unit tests

**A seam-parity test.** It imports every implementation of the data-access seam and asserts identical
exported key sets and equal arity per export. This is what makes swapping a mock implementation for a
real one safe, and it is the reason the swap can be a configuration change rather than a rewrite.

Parity is necessary and not sufficient. Matching names and arity does not prove matching return
shapes; a mock that returns a field the real implementation cannot produce passes parity and breaks
at runtime. Where a shape is subtle, assert it.

**A permission-model test.** It asserts the role ordering and the permission truth table across every
role. Every role, every action, both directions — including the denials. A permission test that only
asserts the allow cases is a test that passes when the check is deleted.

TODO(project): give both their real paths once the seam and the role model exist, and cite the paths
here so a reviewer can find them.

## Invariants in tests

An invariant is not an acceptance criterion and is not tested by a single happy-path case. Where a
test exercises an invariant, it asserts the *refusal*: that the second write is rejected, that the
conflicting state cannot be reached, that the derived value is recomputed rather than trusted.

Per RULE-07 an actual invariant violation escalates rather than entering rework, so a test that
detects one is reporting a modelling problem, not a bug to be fixed in place.

## Fixtures

Unit and end-to-end tests share fixture data with the seed. Tests must not invent entities inline — a
fixture that exists only in one test file drifts from the seed and produces failures that reproduce
in CI and not locally.

TODO(project): name the shared fixture module.

## Fixtures that share the implementation's assumptions

A fixture is written by the person who wrote the code, from the same understanding of the input. When
that understanding is wrong, the fixture is wrong in the same direction, and the tests pass.

**This has already happened, in the project this kit came from.** A check in `scripts/check-docs.mjs`
scanned a lint config for a forbidden package name. Its first implementation stripped comments with a
regular expression before searching. That is wrong on exactly one file — the one it exists to read:
the pattern list contained a glob ending `/*`, which opened a block comment that then closed at a
`*/` inside a later glob, deleting every entry between them. An entry placed there vanished before
the search ran.

Fourteen tests covered that check. All fourteen passed. The check was inert against the only file it
would ever run on, and the tests could not see it, because every fixture used simple package names
and none contained a glob with `/*` or `*/` in it. The fixtures were built from the same mental model
as the implementation — "patterns are plain package names" — so they confirmed the model rather than
testing the code. It was found by running the check against the real file and watching it report
nothing.

**The rule.** Any check whose target is a specific real file in this repository gets at least one
test built from that file's actual content, not from a simplified fixture. Read the real file in the
test. If the check is meant to fire, inject the triggering content into a copy of the real file and
assert it fires; if it is meant to stay quiet, assert that against the file as it stands.

Simplified fixtures are still worth having — they isolate the case and they name the intent. They are
not sufficient on their own, because the thing they cannot test is whether you understood the input.

**This was the same reasoning as RULE-05**, which is retired. QA did not read the implementation; it
worked from the plan's testability contract, so the test was not derived from the implementation it
judged. A fixture hand-written by the
author of the check is derived from the check, in the same way and with the same failure: it agrees
with the code about what the world looks like. The real file is the independent source, and it is the
only one available for a check that reads a specific file.

Applies to `scripts/check-docs.mjs` and every `.claude/hooks/*.mjs` guard that resolves a real path —
`guard-registry.mjs`, `guard-allowed-paths.mjs`, `guard-tracker-scope.mjs`, `guard-read-scope.mjs`,
`guard-project-root.mjs`, `chat-guard.mjs`.

**In a fresh repository some of those real files do not exist yet.** Check D12 in particular reads
`.ai/registry/boundaries.json`, which ships with no boundaries declared, so the only real-file test
available asserts that it parses and that the check stays silent. **The first project that declares a
boundary owes this rule a real-file test against the config it names.** Writing that down here is
cheaper than rediscovering the fourteen-passing-tests result a second time.

## What a check may be scoped to

**A check whose scope includes agent-produced artifacts will be worked around by agents rather than
reported. Scope checks to what humans own.**

A check is a message to whoever can act on it. When the reader is a human, a finding costs a
conversation and buys a decision. When the reader is an agent mid-stage, the finding is an obstacle
between it and its gate, and the cheapest way through is to make the finding stop appearing. Both
paths end with a green check; only one of them means anything.

This is not about agents behaving badly. Satisfying the check is usually the *correct* local move —
the finding says a field is missing, so the agent adds the field. Nothing in the stage tells it that
the check was aimed at a different class of file and that its artifact was never supposed to be in
scope. A rule that depends on every future agent noticing that distinction under time pressure is a
rule that holds until the first busy one.

**This has already happened.** Check D9 requires `doc_version`, `last_updated`, and `governed_by`,
and its first implementation read every `.md` under `.ai/` — board artifacts included. The first
story ever written failed it. The BA flagged the mismatch in its report, which is the outcome the
check wanted, and *also* pasted the three fields into `01-story.md` to get to a clean audit, which is
the outcome it will get by default. A ticket artifact has no version to bump and no rule set to
track; the fields were meaningless there. The next agent, with less room, would have done only the
second half, and the check would have read as passing on a document it had stopped describing.

**The rule.** Before adding a check, name the person who fixes a finding from it. If the answer is an
agent in the middle of a stage, the check is measuring compliance, not the thing it names — either
narrow its scope to the human-owned plane, or move the enforcement into a gate, where a disagreement
is adjudicated rather than edited away.

For this repository the human-owned documents are `.ai/registry/**`, `.ai/standards/**`,
`.ai/templates/**`, `.ai/00-charter.md`, and `.ai/01-operating-model.md`. `.ai/board/**` is agent
output — tickets, artifacts, `backlog.md`, and `metrics.md` alike — and belongs to the gates in
`.ai/01-operating-model.md`, not to the documentation audit.

**A narrowing needs its own test.** The way this fix fails is by narrowing to nothing, and a check
that fires on no file passes everywhere. Test both directions: the artifact that must not be reported,
and the same content under a human-owned path, which must be.

## What makes a test bad here

- Asserting on a style class or a DOM path instead of the agreed selector attribute. Both break on
  refactor and neither is in the selector contract.
- A snapshot test as the only coverage of a behaviour. A snapshot records what the code did, not what
  it should do, and it is updated by the same agent that broke it.
- A test that mocks the seam inside a component test. The mock seam is already the mock; mocking it
  again tests the mock.
- A skipped test left in the suite. Delete it or fix it; a skip is a passing test that checks
  nothing. Except a quarantine under ADR-060: a `test.fixme` with a ticket, a register row and an unexpired date. The register is `docs/ops/e2e-quarantine.md`, and check D15 in `scripts/check-docs.mjs` is what enforces it.
