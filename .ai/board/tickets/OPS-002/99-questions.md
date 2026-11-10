---
from: developer
to: tech-lead-design
asked_at: 2026-09-07T08:38:00+07:00
---

**Q.** AC-10 and AC-12 cannot both be true against the runner named in
`.ai/standards/testing-standards.md`, and `tests/ui-language.test.ts` is not in `allowed_paths`, so
the Developer cannot resolve it inside this ticket.

01-plan.md AC-12 says the language test "passes, with its 'still has copy to translate' cases vacuous
because `copyDebt` is empty." Vitest 4 does not treat an empty `it.each` as vacuous — it fails the
enclosing suite. `tests/ui-language.test.ts:47-60` is one `describe` containing two `it.each` calls,
both over `copyDebt` and nothing else, so emptying the list (AC-10) empties that suite and the run
reports:

```
FAIL  tests/ui-language.test.ts > § Language — the ratchet only shrinks
Error: No test found in suite § Language — the ratchet only shrinks
```

Verified as a property of the runner rather than of this change, on an isolated two-suite file
outside the repository: an empty `it.each` beside a populated `describe` fails identically. The rest
of the suite is green — 185 tests pass, 9 of 10 files pass, and the three "the exception is alive"
cases in this same file pass, so AC-9 and AC-11 hold.

There is no fix inside `allowed_paths`. `ui-language.json` is the only listed file the test reads,
and every value in it that could keep the suite non-empty is a `copyDebt` entry that AC-10 requires
gone — and that the sibling "still has copy to translate" case would fail on anyway, since the five
files no longer contain diacritics.

**The amendment this appears to need**, for the Tech Lead to decide rather than the Developer:

1. Add `tests/ui-language.test.ts` to `allowed_paths` in `01-plan.md` § 7 and `ticket.yaml`. That
   makes twelve files outside the ticket folder, which is the M ceiling exactly
   (`.ai/01-operating-model.md:370-374`), so `size: M` still holds and ADR-012 still never engages.
2. Restate AC-12. The empty ratchet has to be asserted rather than left as an absence of tests —
   the shape that survives the runner is a single case over the whole list, e.g. an
   `it("copyDebt is empty or every entry still has copy to translate")` that iterates inside one
   test body, so the suite has one test at every list length including zero. That also closes a
   defect the current shape has independently of this ticket: at `copyDebt.length === 0` the file
   asserts nothing about the ratchet, which is exactly when the ratchet is most worth asserting.

**A.** **Confirmed, and both amendments are made as proposed.** The diagnosis is right, the routing is
right, and the error was mine rather than a discovery.

**Reproduced before amending**, on this branch rather than on the isolated file:
`pnpm exec vitest run tests/ui-language.test.ts` reports `FAIL ... > § Language — the ratchet only
shrinks / Error: No test found in suite`, with `Tests 3 passed (3)` — the first `describe`'s three
cases — beside it. So AC-9 and AC-11 stand on evidence, as you say, and only the second suite is
affected.

**Where the plan was wrong, stated plainly because the Changelog is the only thing that catches it.**
§ 1 puts "a lint rule or check that enforces § *Language*" out of scope, and I carried that too far
when enumerating § 7: declining to *build* a new check is not the same as declining to *keep the
existing one running*. AC-10 empties the list that `tests/ui-language.test.ts` reads, so AC-10 could
never have been satisfied without editing that file. I wrote two ACs that depend on each other and
gave only one of them a file.

1. **`tests/ui-language.test.ts` added to `allowed_paths`**, in `01-plan.md` § 7 and in `ticket.yaml`.
   Twelve files outside the ticket folder. `size: M` still holds — M is up to 12 — but it is now the
   **ceiling exactly and there is no headroom left**, where § 7 previously claimed one file of it.
   Anything further this ticket turns out to need makes it L, and L must split at PLAN rather than
   grow a thirteenth entry.

2. **AC-12 restated**, and § 4 now carries the required shape rather than leaving it to you: one `it`
   iterating inside its own body, so the suite holds exactly one test at every list length including
   zero. Both assertions keep their present meanings and their failure messages. Your second point is
   adopted in full and is written into AC-12 as part of the criterion rather than as a note beside
   it — at `copyDebt.length === 0` the old shape asserted nothing about the ratchet, which is when
   the ratchet is most worth asserting. That defect predates this ticket; this is the amendment that
   closes it.

**The first `describe` is not to be touched.** Its three cases protect the standard's exception, they
pass today, and AC-9 and AC-11 rest on them.

**On `gates.plan.passed`: you were right not to fill it, and right that it is not yours.** It is not
mine either. PLAN writes `gate: PASS` into its own front-matter and nothing else; the `orchestrator`
grades the full Definition of Ready at `/next-ticket` and writes the board. `/next-ticket` has not
run on this ticket — the loop went `/plan` straight to `/implement` — so `gates.plan.passed: false`
records a grading that was skipped, not a gate that failed. It is raised to the operator in my reply
and it is a human's call when to close it; `/ship` requires both gates and will stop until it is.

**Amended:** `01-plan.md` AC-12, § 4 (the ratchet suite's shape), § 7 (twelve files) and the
Changelog; `ticket.yaml` `size` comment and `allowed_paths`. `rework_count` deliberately NOT
incremented — RULE-08 and `.ai/01-operating-model.md:145`.
