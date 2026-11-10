---
doc_version: 3
last_updated: 2026-10-13
governed_by: [RULE-01, RULE-09]
---

# ADR-060 — A failing end-to-end test may be quarantined, only with a register row, a ticket and an expiry

## Status

`ACCEPTED by the operator` — 2026-10-13, in words: *"-> đồng ý"* ("agreed"), in answer to the
question below, quoted beside it in the idea file
`.ai/board/ideas/2026-10-13-a-red-main-merges-unnoticed-and-no-release-is-built-or-deployed.md`
§ *Re-triage verdict*. Option A, as proposed.

*Proposed 2026-10-13 by `product`, `PROPOSED`, with the question: may Phase 1 quarantine the failing
e2e tests with `test.fixme` under the conditions below?*

## Context

`testing-standards.md:227` lists among the refused practices: *"A skipped test left in the suite.
Delete it or fix it; a skip is a passing test that checks nothing."*

`verify` has failed on every push to `main` checked, from `#120` to `#127` on 2026-10-13. The
operator's audit traces it to `#81`, and names 20 failing and 2 flaky e2e tests across seven
features.

While `main` is red, nobody can make `verify` a required check, because no pull request could pass
it. Every stage then skips verification. The EVT-10 and EVT-11 ships both did. The suite checks
nothing for everyone, which is worse than 20 tests checking nothing for a while.

## Options

**A — a bounded quarantine (recommended).**
- `test.fixme` is allowed on an e2e test only when all of the following are true:
  - a comment on the line names a tracking ticket;
  - `docs/ops/e2e-quarantine.md` has a row for the test, with the suspected cause, the first
    failing PR and the ticket;
  - the row carries an expiry date no more than 30 days out.
- Past its expiry, a row is fixed, deleted (with a reason), or re-dated by the operator.
- `check-docs.mjs` gains a check that every `test.fixme` under `tests/e2e/` has a register row,
  and that no row is expired. That is steward work, named here so it is not forgotten.

**B — fix all 20 first, quarantine nothing.**
- The standard stays as written.
- The request puts these fixes out of scope. `main` stays red until all seven features are
  repaired, and the delivery work waits on product work.

**C — delete the failing tests.**
- The standard already permits it.
- It loses the record of what each test asserted, for tests whose features shipped and are probably
  still correct.

## Decision

Proposed: **A**. `testing-standards.md:227` gains one sentence: *"Except a quarantine under ADR-060:
a `test.fixme` with a ticket, a register row and an unexpired date."* The stale results table at
`:35-36` is corrected in the same change.

**Flaky tests are not quarantined.** They keep running under `playwright.config.ts:13`'s existing
`retries: process.env.CI ? 1 : 0`, which is a bounded retry. Each one gets a register row marked
*flaky*, so the retry is visible rather than silent. The request says the same: *"Do not hide them."*

## Consequences

- `main` can turn green without product work, and `verify` can become a required check.
- **20 assertions stop running** until their tickets land. The register and the expiry are the only
  things that stop that becoming permanent.
- A new kind of debt with a date on it. The operator re-dates or decides at expiry.

## Revert condition

The register still holds a row more than 60 days old on any date, or the operator rejects this at
merge. Reverting removes the exception sentence. Any `test.fixme` left is then a violation of
`:227`, fixed or deleted as written.

## Affected documents

| File | `doc_version` |
|------|---------------|
| `.ai/standards/testing-standards.md` | +1 when accepted: the exception sentence, and `:35-36` corrected. Human or `/thuki` |
| `scripts/check-docs.mjs` | a quarantine check — steward work |
