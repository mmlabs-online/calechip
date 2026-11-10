---
doc_version: 3
last_updated: 2026-09-23
governed_by: [RULE-01, RULE-03, RULE-09]
---

# ADR-043 — R1 asks the runner what is carried

## Status

`ACCEPTED by steward`, 2026-09-23. Amends ADR-041, which is also `ACCEPTED by steward`; it supersedes
no decision of the operator's.

ADR-041 closed one instance of a defect and this closes the class. Its sentence *"Everything else in
the diff must still be a subset of `allowed_paths`, with no further exemption"* is narrowed here, and
the narrowing is the point: a hand-maintained exempt set written in prose was **incomplete on the day
it was written**, which is the argument for not maintaining one at all.

## Context

`/ship` was stopped at precondition on CAL-11 with one finding left: `.ai/board/tickets/CAL-12/` is
untracked, and ADR-041's exempt set covers only the folder of the ticket under review, so R1 would
fail CAL-11 a second time on it.

**CAL-12 is a BACKLOG shell holding exactly one file, `ticket.yaml`, written by `/triage` from the
same PROMOTE that produced CAL-11.** Three facts about it, each read from disk:

- **The runner already classifies it as carried.** `planCarry` in `scripts/lib/entry.mjs` has a
  clause for precisely this — *a sibling ticket folder promoted by the same idea, at BACKLOG, holding
  nothing but `ticket.yaml`*. Run against the live tree it returns `sibling CAL-12 from the same
  PROMOTE` and reports **zero stray paths**. The runner's preflight was satisfied; only R1's prose
  was not.
- **It can never reach the branch R1 guards.** `/ship`'s ship set is `allowed_paths` plus the ticket
  folder plus the three ship-owned paths. CAL-12 is none of those, so `/ship` will not commit it, it
  will not appear in the pull request, and `scripts/check-allowed-paths.mjs` — which computes
  `origin/main...HEAD`, **committed changes only** — can never see it. R1 was failing a ticket over a
  file that cannot violate RULE-03 on that branch.
- **The proposed remedy does not remedy it.** The route offered was to land the shell on `ops/<slug>`
  first. Measured rather than assumed, in a throwaway repository reproducing the exact shape — file
  untracked in the working tree, same content committed on `main`:

  ```
  error: The following untracked working tree files would be overwritten by merge:
          tix/Y/ticket.yaml
  Please move or remove them before you merge.
  Aborting
  ```

  Landing it on `ops/` does not remove it from `feat/CAL-11`'s untracked set, and the merge that
  would is refused by git even with byte-identical content. The sequence that does work is *land,
  merge the PR, delete the local copy, then merge `origin/main`* — five steps and two human actions,
  one of them a `git switch` or a merge against a tree holding an entire uncommitted ticket, which is
  the loss ADR-006 names in its revert condition.

Underneath all three: **R1's subject was never one thing.** A ticket's tree holds committed changes,
which belong on the branch and are judged against `allowed_paths`, and uncommitted changes, which are
what a ticket looks like for its whole life because agents commit only at `/ship`. One rule was being
applied to both.

## Decision

**R1 runs `node scripts/check-carry.mjs <TICKET-ID>` for the uncommitted half, and keeps
`allowed_paths` for the committed half.**

`check-carry.mjs` is a CLI over `planCarry` — the function the runner's preflight already calls. It
adds no rule. An uncommitted path is a violation when and only when `planCarry` calls it stray;
`carried` is not a violation and is listed in the review for the record.

The committed half is unchanged: `git diff origin/main...HEAD` must be a subset of `allowed_paths`,
with ADR-041's exemptions, and `scripts/check-allowed-paths.mjs` remains the CI reader of it.

To make that one implementation rather than two, **`carryContext` and `inAllowedPaths` move from
`scripts/run-loop.mjs` into `scripts/lib/entry.mjs`** and both callers import them. The runner keeps
a four-line delegator so its call site reads the same.

## Rationale

The alternative was **to add a sibling clause to ADR-041's prose exempt set** — three more lines in
the operating model, the review template and the rule ledger. Rejected because it repeats the mistake
this ADR is cleaning up. ADR-041's set was written on 2026-09-22 against a tree that already
contained the case it missed; a fourth copy of the rule would be wrong the same way, and nothing in
`scripts/check-docs.mjs` compares a prose exempt set against the code that implements one.

The alternative to *that* was **to delete the rule and let R1 ignore uncommitted files entirely**.
Rejected because it removes a real guard: a Developer who writes a new source file outside
`allowed_paths` and never commits it gets a green review, a pull request missing the file, and a CI
failure nobody can explain from the artifacts. `planCarry` calls that stray, and it should.

## Consequences

**What becomes easier.** R1 is mechanical — a command with an exit code, like R2 and R3, rather than
a judgement about which paths count. CAL-11 reviews against its real state. The rule has one
implementation, already tested, already exercised on every unattended run.

**What becomes harder, and is the price.** R1 now depends on a script, so a bug in `planCarry` is a
bug in the review gate rather than only in the preflight — one function with two consumers is a
single point of failure as much as it is a single source of truth. It is covered by the suite, which
is the mitigation and not a guarantee.

**`planCarry`'s carried set is wider than `allowed_paths` by design**, and R1 now inherits all of it:
the promoting idea file, the ADRs a verdict cites, and a sibling BACKLOG shell all pass R1 without
appearing in any ticket's `allowed_paths`. Each is justified in that function's header. None of them
is committed by `/ship`, which is what keeps the widening off the branch — but it does mean R1 no
longer reports them at all, where before it reported them as violations.

**MD-031 is untouched and still owed.** The idea files, the ADRs and sibling shells are orphans that
`/ship` never commits, and the durable answer is still a human landing them. This ADR stops them
failing a review; it does not land them.

## Revert condition

A stray path reaching `main` that R1 passed — observable as a `check-allowed-paths` failure in CI on
a pull request whose `04-review.md` recorded R1 as PASS. That means `planCarry`'s carried set is
wider than the ship set in some case not anticipated here, and R1 returns to judging uncommitted
paths against `allowed_paths` with an explicit sibling clause.

Watch also for the opposite: two consecutive reviews recording R1 FAIL on a path the operator then
has to explain is legitimate. That means the carried set is too narrow, and the fix belongs in
`planCarry` where both readers get it at once.

**Amended 2026-09-23, same day, by `tech-lead-review` on CAL-11's second review — the paragraph above
guessed wrong and would have sent the next reader to the wrong file.** That review recorded R1 FAIL
on nine paths, and the cause was not a narrow carried set. It was **this ADR's own landing**: PR #93
pushed the nine files to `ops/adr-043-r1-carry` and left byte-identical copies dirty on
`feat/CAL-11`. `planCarry` calling unmerged-looking model work stray is that function working
correctly, and widening it would have been a real defect introduced to hide a procedural gap.

The gap is in the landing procedure, not in the rule, and it recurs by construction: under ADR-006
every role shares one working directory, so **every steward landing made while a ticket is in flight
leaves that ticket's tree dirty.** ADR-042 (PR #92) escaped only because an unrelated `git switch`
happened to clean up. The fix is in `.ai/standards/git-conventions.md` § *Landing `ops/` work while a
ticket is in flight* — restore the tree after verifying the push — and in `scripts/check-carry.mjs`,
which now reports a stray path whose blob is already on `origin/main` as `landed` with the restore
commands, instead of as indistinguishable from unmerged work.

**So the revert signal for a too-narrow carried set is narrower than written above:** two consecutive
R1 FAILs on paths that are **not** on `origin/main`. A FAIL on paths that are is a stale tree, and no
amount of editing `planCarry` will fix it.

## Affected documents

| File | To doc_version |
|---|---|
| `.ai/01-operating-model.md` | 9 |
| `.ai/registry/rules.md` | 4 |
| `.ai/templates/review-report.md` | 5 |
| `.ai/standards/testing-standards.md` | unchanged — `check-carry.mjs` is a gate check, not one of the four commands |
