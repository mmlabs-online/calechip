---
ticket: BUG-002
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-08T11:24:25+07:00
inputs_read:
  - .ai/board/tickets/BUG-002/01-plan.md
  - .ai/board/tickets/BUG-002/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/templates/impl-log.md
  - src/lib/domain/types.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - tests/seam-parity.test.ts
  - tests/pending-entries.test.ts
  - vite.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# BUG-002 — implementation log

Fix shape **(a)**, as § 4.1 chose it: name the cap, lower the two ceilings that sit above it, and
prove the relation with a static test. **No seam implementation was opened**, and § 4.4 is why that
was possible rather than an oversight — verified below rather than assumed.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/domain/types.ts` | modified | adds `DATASTORE_MAX_ROWS`, lowers `TEAM_ENTRY_LIMIT` and `MONTH_ENTRY_LIMIT` from 2000 to 1000, and discharges the five `TODO(verify)` markers that were all waiting on that one figure | § 4.2 |
| `tests/row-limits.test.ts` | created | asserts every ceiling is reachable — the only evidence available without a provisioned project | § 4.3 |
| `.ai/board/tickets/BUG-002/03-impl-log.md` | created | this file | — |
| `.ai/board/tickets/BUG-002/ticket.yaml` | modified | `state` to `REVIEW` on the gate below. **`gates.plan` was left alone and is not mine to set** — see *Open questions* item 1 | — |

`git status --porcelain` also shows `01-plan.md` untracked and `ticket.yaml` modified from PLAN's own
run. Both are this ticket's and arrive uncommitted by ADR-006; neither is my change beyond the state
line above.

## Contract items

The template's column says "design section 1"; ADR-019 merged the two documents and the contract is
**§ 4** of `01-plan.md`. Mapped to that.

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.2 — `DATASTORE_MAX_ROWS`, named once, beside the ceilings, citing its source | `src/lib/domain/types.ts:184` | Placed **above** `ROSTER_LIMIT`, the first ceiling, because every ceiling below is a statement about it. Cited by package name and the `select()` remark, **not by line number** — § 4.2's instruction, since the pnpm store path carries the package version |
| § 4.2 — `TEAM_ENTRY_LIMIT` 2000 → 1000 | `src/lib/domain/types.ts:293` | |
| § 4.2 — `MONTH_ENTRY_LIMIT` 2000 → 1000 | `src/lib/domain/types.ts:353` | The one that governs `YearView`, `MonthView` and `WeekView` |
| § 4.2 — `HOLIDAY_LIMIT` unchanged at 1000 | `src/lib/domain/types.ts:436` | Value untouched. Its prose was corrected — see *Deviations* |
| § 4.2 — `ROSTER_LIMIT`, `OWN_ENTRY_LIMIT` unchanged | `:206`, `:262` | Values untouched; `TODO(verify)` discharged on each |
| § 4.2 — the five `TODO(verify)` markers discharged | `types.ts`, all five sites | `grep -n "TODO(verify)" src/lib/domain/types.ts` now returns only the word inside `PENDING_PAGE_SIZE`'s prose, which *names* the markers historically |
| § 4.3 — `tests/row-limits.test.ts`, `<=` and not `<` | `tests/row-limits.test.ts:46` | `it.each` over all five ceilings, each named in its own test title so a failure says which |
| § 4.4 — no seam implementation edited | — | Verified, not assumed: all four assertion sites import the constant and compare `>=`, so lowering the constant repaired them unopened. `supabase.ts:1044`/`:1181`, `mock.ts:1128`/`:1232` |

**AC-2 got a second assertion the plan's code block does not show** —
`tests/row-limits.test.ts:56` pins `DATASTORE_MAX_ROWS` to 1000. AC-2 requires the maximum to *be a
named value citing where the figure comes from*, and a name alone is satisfied by any integer. The
assertion is what makes a future edit to that constant fail beside the comment carrying its source.
`PENDING_PAGE_SIZE` is asserted separately at `:63` with `<` rather than `<=`, because it is a window
and not a ceiling and must not quietly inherit the ceiling rule.

## Deviations from the design

Three, all in `src/lib/domain/types.ts`, all declared.

**1. The two lowered ceilings are written as the literal `1000`, not as `= DATASTORE_MAX_ROWS`.**
I wrote them as the constant first and reverted it. Coupling reads better and is wrong here: it would
make a future change to the cap **silently move two product ceilings** while `row-limits.test.ts`
passed vacuously, since the assertion would compare a value with itself. Kept as literals, that same
change makes the test *name* the constants — which is the entire mechanism this ticket adds. The
reasoning is recorded at `types.ts:287-293` rather than only here. This matches § 4.2's table, which
says "becomes **1000**".

**2. Five doc comments said a ceiling "must sit BELOW the cap"; they now say "must not EXCEED" it.**
That sentence became false the moment two ceilings landed *at* 1000, and it directly contradicts
§ 4.3's decision to assert `<=` rather than `<`. Leaving it would have shipped a comment arguing
against the test beside it. No value moved.

**3. `PENDING_PAGE_SIZE`'s comment (`types.ts:550-554`) was corrected.** It said *"two of those five
sit ABOVE the cap and are therefore not held; fixing them is not this ticket's, and it wants a BUG
row of its own."* This **is** that row, and the sentence is now false. Rewritten to record that the
row was BUG-002 and the markers are discharged.

All three are comment-only, inside the one file `allowed_paths` names, and none changes behaviour.
I am declaring them because § 1 item 1 puts *rewriting criteria to match today's behaviour* out of
scope, and a reviewer is right to check that comment edits in a bug fix are not that. These go the
other way — each removes a sentence that the fix falsified.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The arithmetic is untouched: `src/lib/data/absence.ts` is not in the diff, `absenceCountsFor` is not called, and no second definition of the absence count was created — the invariant's *statement* is not engaged, which is the `[]` reading § 2 sets out. It is listed because **the mechanism is the input, not the definition**. Before this change, `listTeamEntriesOverlapping` asked for 2000, received at most 1000, reported success, and the sum ran over an arbitrary subset of the matching rows — a number INV-04 does not define, indistinguishable from one it does. After it, the ceiling is reachable, `rows.length >= 1000` fires, and the read **raises instead of returning short**. The single definition is now fed a complete set or nothing. Its inputs are restored to complete-or-refused; the definition never moved. |

**No invariant violation was found.** RULE-07 was not engaged.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| typecheck — `pnpm exec tsc --noEmit` | 0 | |
| lint — `pnpm exec eslint .` | 0 | |
| unit — `pnpm exec vitest run` | 0 | **11 files, 193 tests, all pass.** 10 files and 186 before; the new file is the difference. **No existing test was edited** (AC-10) — `git status` shows one modified source file and one added test |
| end-to-end — `pnpm exec playwright test` | 0 | **165 passed.** `tests/seam-parity.test.ts` passes unedited (AC-7) |
| `git diff --name-only` subset of `allowed_paths` | yes | `src/lib/domain/types.ts`, `tests/row-limits.test.ts`, and two files under `.ai/board/tickets/BUG-002/`. Nothing else |

**AC-3 was observed in both directions rather than argued.** The test was written *before* the
constants moved and run against the tree as it stood:

1. Test written, no `DATASTORE_MAX_ROWS` yet — all 7 fail, on `undefined`. Not the evidence AC-3
   asks for, because it proves only that a constant is missing.
2. `DATASTORE_MAX_ROWS` added, ceilings still at 2000 — **2 failed, 5 passed**, and the two are
   `TEAM_ENTRY_LIMIT` and `MONTH_ENTRY_LIMIT`, each named in its own failure:
   `AssertionError: expected 2000 to be less than or equal to 1000`. That is AC-3's first half, at
   exactly the two broken constants and no others.
3. Both lowered — 7 pass. AC-3's second half.

Step 2 is why the constant was added in a separate step from the values. Had they moved together,
"fails today" would have been a claim in this file rather than something that happened.

**AC-8 and AC-9 verified against the diff, not asserted.** No file under any parent ticket's folder
appears in `git status`; no seam implementation, no route, no other test and no configuration file
does either. Exactly one source file modified, exactly one test file added.

## Testability contract

**None owed.** § 2b records that this ticket renders nothing — its whole output is one new constant,
two changed integers and one test file. `01-plan.md` defines no selector table, and the only
user-visible consequence (AC-6: a screen shows its unavailable state instead of a wrong calendar) is
reached through states CAL-04, CAL-05 and CAL-06 already shipped and this ticket does not touch.

## Open questions

1. **`gates.plan` was `{ passed: false, at: null }` when this command started; it is now `true`, and
   the operator set it, not me.** `01-plan.md`'s front-matter carries `gate: PASS` and
   `next_state: READY`, so PLAN passed — the mirror in `ticket.yaml` was simply never written.
   Setting another stage's gate is attesting to a stage I did not run, so I raised it rather than
   filling it in, and the operator instructed it be set here (2026-09-08). The `at:` value is
   `01-plan.md`'s own `produced_at`, `2026-09-08T11:13:43+07:00`, and not the time I wrote the line —
   the row records when PLAN passed, not when its mirror caught up. **Definition of Done item 1 is
   now satisfiable and `/ship` will not block on it.**
   **Whether PLAN failing to mirror its gate is a one-off or a gap in the command is not decided**,
   and it is the steward's question rather than this ticket's.
   The same run also left `state: BACKLOG`; I advanced it straight to `REVIEW`, so the ticket never
   carried `READY` or `IN_PROGRESS` on disk.
2. **AC-4, AC-5 and AC-6 are not asserted by any test, and cannot be from this tree.** They describe
   behaviour under a truncating read, and no test can make PostgREST cap a read without a provisioned
   project (§ 1 item 4) — while the mock slices deterministically, so its `rows.length >= LIMIT`
   branch is unreachable by construction. What this ticket delivers for those three is that the
   assertion sites are now **reachable code** rather than dead code, which `row-limits.test.ts`
   proves statically. This is the same declared-gap shape `tests/pending-entries.test.ts` records for
   ADM-04's AC-5, and it is stated here so a reviewer does not go looking for the test.
3. **`src/lib/data/supabase.ts:1417-1419` now carries a stale sentence** — it describes the cap as
   "the unknown ROSTER_LIMIT, OWN_ENTRY_LIMIT, TEAM_ENTRY_LIMIT, MONTH_ENTRY_LIMIT and HOLIDAY_LIMIT
   have each carried a `TODO(verify)` for". The figure is no longer unknown and those markers are
   discharged. **The file is outside `allowed_paths` and I did not touch it (RULE-03).** It is a
   comment, it misleads no code, and it wants one line in whichever ticket next opens that file.
4. **The three end-to-end spec headers carrying `2000` in prose are untouched**, as § 7 decided —
   `cal-04:17`, `cal-05:25`, `cal-06:25`. § 2 *Open questions* item 4 counts six files; grep finds
   the numeral in three of them today. Their load-bearing claim survives either way.
5. **A large team's year view can now legitimately exceed 1000 rows and will see a refusal.** § 2
   *Open questions* item 2 accepts this — it is what CAL-06 AC-14 requires and is strictly better
   than a silently short year, but it is a refusal and not a calendar. Explicit paging with `range()`
   is the ticket that follows this one. Recorded at `types.ts:344-349` so the next reader of the
   constant meets it there.
