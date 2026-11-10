---
ticket: UIE-07
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-08T12:14:18+07:00
inputs_read:
  - .ai/board/tickets/UIE-07/01-plan.md
  - .ai/board/tickets/UIE-07/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/steward/context.md
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - src/routes/YearView.tsx
  - src/routes/NewEntry.tsx
  - src/components/EntryForm.tsx
  - src/lib/data/absence.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/lib/labels.ts
  - src/index.css
  - tests/e2e/cal-05-week-view.spec.ts
  - tests/e2e/cal-04-month-view.spec.ts
  - tests/e2e/cal-07-overload-warning.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# UIE-07 — implementation log

## Files touched

Two files outside the ticket folder, which is what `allowed_paths` names and what `size: S` was
counted from. Nothing else in the working tree was opened.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/WeekView.tsx` | modified | The count had to be derived and rendered on the screen that lacked it, and the four comment blocks that stated the opposite had to stop saying so | § 4.1, § 4.2, § 4.3, § 4.4 |
| `tests/e2e/uie-07-week-absence-count.spec.ts` | created | AC-3 and AC-4 are the two assertions that separate INV-04's number from the two wrong derivations, and neither is reachable from a unit test because both are claims about what the SCREEN renders | § 7, "The new spec file, and the two assertions that carry the ticket" |

## Contract items

The plan merges story and design (ADR-019), so the contract is its **§ 4** rather than the template's
"section 1", and the selector table is inside § 4.3 rather than a § 6 of its own. Mapped item by item.

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 — `absenceCountsFor` called, not redefined | `src/routes/WeekView.tsx:150` | Import widened by two names; no new import statement, as § 4.2 requires |
| § 4.1 — `currentMemberCount` called, not redefined | `src/routes/WeekView.tsx:150` | Same import |
| § 4.1 — `AbsenceCounts` type | `src/routes/WeekView.tsx:155` | Added to the existing `import type`, no new statement |
| § 4.2 — the `counts` derivation | `src/routes/WeekView.tsx:326-334` | Placed beside `absent`, same three arguments, same pass shape, same `[view, range]` deps |
| § 4.2 — the `activeMembers` denominator | `src/routes/WeekView.tsx:337` | Over the **unfiltered** roster `seam.listMembers()` returns (ADR-013), which is the shape both functions require |
| § 4.3 — `count` read inside `dates.map` | `src/routes/WeekView.tsx:487` | Beside `people` and `status`, `?? 0` for the loading and failure phases only |
| § 4.3 — `data-count` on `week-day` | `src/routes/WeekView.tsx:497` | Borrowed verbatim from the month cell; no empty-string case, since every day of a week is in range |
| § 4.3 — the strip, last child of the section | `src/routes/WeekView.tsx:806-813` | `<p data-testid="week-day-count" data-current-members>` with an `sr-only` span and `{count}/{activeMembers}` |
| § 4.3 — the className, verbatim | `src/routes/WeekView.tsx:810` | `-mx-4 -mb-4 mt-auto rounded-b-2xl border-t border-line px-4 py-2 text-center text-sm text-ink-3`. `src/index.css` was not opened and no token was added |
| § 4.4 block 1 — CAL-05's "IT COUNTS NOTHING" | `src/routes/WeekView.tsx:11-34` | Rewritten to carry **the correction ADR-029 requires** and not merely a description of the footer: a count never needed a team read (`getTeam()` supplies `overloadThreshold`, which a bare `n/N` does not use), and INV-04 was never the obstacle. The `.filter(...)` warning is kept and restated as the guard rail on AC-5 |
| § 4.4 block 2 — UIE-04's "STILL COUNTS NOTHING" | `src/routes/WeekView.tsx:67-78` | **Its refusal of the chip count survives verbatim in substance**, because that is the argument AC-5 rests on; only the conclusion it drew (*a column ends where its content ends*) is retired |
| § 4.4 block 3 — UIE-05's "Nothing is pinned there today" | `src/routes/WeekView.tsx:95-99` | The false sentence is replaced; **the rest of the paragraph is kept** — anything pinned to a column's bottom still goes below the fold on a busy week, which is *Out of scope* item 12 |
| § 4.4 block 4 — "a decision now taken FOUR times" | `src/routes/WeekView.tsx:119-135` | Records that ADR-029 is ACCEPTED, that the image's `n/8 vắng` is refused on both the denominator and the word, and **which way the coupling was resolved** — `"Everybody is in."` stays |

## Deviations from the design

`none`.

Three things are worth naming as **not** deviations, because a reviewer diffing intent against code
would otherwise have to decide each one:

1. **The `count` read carries a two-line comment the plan's snippet does not show.** § 4.3 gives the
   line, not a prohibition on commenting it; the plan's own § 4.3 prose is the source of the comment.
2. **`data-count` carries a three-line comment for the same reason.**
3. **The spec file's helpers are its own rather than imported from `cal-05-week-view.spec.ts`.** That
   file exports nothing and this ticket may not edit it, so `signIn`, `backToWeek`, `openWeekAs` and
   the locator helpers are transcribed. `declare` is **deliberately not** a transcription — see *Open
   questions* item 1.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The number on the screen is `absenceCountsFor(view.entries, range, view.roster)` and nothing else — the same function, over the same three arguments, that the month grid calls. **No second definition was written**: `src/routes/WeekView.tsx` contains no `.filter` over `entries`, no `.reduce`, and no arithmetic on `absent`, which is the cheapest wrong path and was in scope three lines from the strip. The denominator is `currentMemberCount(roster)` from the same module — not a literal, and not a `removedAt === null` filter hand-rolled here. The rendered proof is the AC-4 test: one member's `am` and `pm` on one date renders **two rows over `1`**, where the chip count would read 2 and a local sum over `absent` would read 1.5. |
| `INV-06` | A half day weighs 0.5 and the strip **renders it as 0.5**. Nothing rounds: there is no `Math.round`, no `toFixed` and no integer format anywhere on the path — `{count}` is interpolated as React receives it. This is the failure mode the plan named as the one this ticket creates and no other surface has, because a strip reading `1` sits directly beneath a `week-row-portion` pill reading `Morning`. The AC-3 test asserts both together on the same column, so the contradiction cannot pass. |
| `INV-05` (considered, correctly not listed) | The plan's reasoning was verified on disk rather than taken on trust: `absenceCountsFor` walks through `walk(...)` and never consults `entry.tentative`, so a tentative entry is counted exactly as a non-tentative one and the only way to exclude it is the local sum AC-5 forbids. Nothing was added here that could reach it. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | The typecheck named in `.ai/standards/testing-standards.md:16` |
| `pnpm exec eslint .` | 0 | `:17`. The Vietnamese-copy lint rule at `eslint.config.js:84-92` is the one this ticket could plausibly have tripped, and did not — the strip's only word is English and lives in the `sr-only` span |
| `pnpm exec vitest run` | 0 | `:18`. **193 passed, 11 files.** `tests/absence.test.ts` and `tests/seam-parity.test.ts` unedited |
| `pnpm exec playwright test` | 0 | `:19`. **171 passed**, the whole suite, including the 7 new ones. **Every shipped spec passes UNEDITED, which is AC-13** — `cal-05-week-view.spec.ts` in particular, whose `:247-253` forbid five element kinds inside a `week-day` and whose `:266` counts seven `week-day-empty` |
| `git diff --name-only` subset of `allowed_paths` | yes | `src/routes/WeekView.tsx` and the new `tests/e2e/uie-07-week-absence-count.spec.ts`, plus this file. Nothing else |

The e2e run is beyond the gate, which asks only for typecheck and lint. It was run because AC-13 is a
claim about **other tickets' spec files**, and a claim of that shape is either measured or it is a
guess with a citation.

## Testability contract

The QA stage is retired (ADR-022), so this table is for the reviewer rather than for a QA agent. One
selector is added and **nothing shipped is renamed**, which R5 can check against the § 4.3 table.

| selector | Exists at |
|----------|-----------|
| `week-day-count` (new) | `src/routes/WeekView.tsx:807` |
| `data-count` on `week-day` (new attribute, existing element) | `src/routes/WeekView.tsx:497` |
| `data-current-members` on `week-day-count` (new here, borrowed from `month-threshold`) | `src/routes/WeekView.tsx:808` |
| `week-day`, `week-day-label`, `week-day-empty`, `week-day-holiday`, `week-day-bridge`, `week-row`, every `week-row-*` | unchanged, and asserted unchanged by the full e2e run |

`week-day-count` was verified free before it was written: zero occurrences across `src/` and `tests/`.

## Open questions

1. **The new spec file declares its own `declare()` rather than transcribing CAL-05's, and the reason
   is AC-4.** CAL-05's helper ends with `expect(getByTestId("own-entry-row")).toHaveCount(1)`, and
   AC-4 needs one member holding **two** entries on one date. The count is passed in as a parameter
   rather than relaxed to a `>= 1`, so the second declaration still proves it landed. Nothing in
   `cal-05-week-view.spec.ts` was edited to achieve this.
2. **AC-9 (`n/0`) is asserted nowhere, and that is declared rather than quietly skipped.** It needs a
   roster on which every member carries a `removedAt`, and nothing in the product can empty a team:
   TEA-04's control removes one member at a time and the caller cannot remove themselves out of the
   read. The criterion is held by the **code shape** — nothing in the strip divides, so there is no
   `NaN` branch to reach — which is the same untested shape CAL-05 AC-10, AC-11 and AC-15 already
   carry, and the spec file's header says so at the top rather than in this file alone.
3. **One assertion in the new spec reads the DOM directly, and a reviewer should know why.** AC-10
   splits the visible reading from the accessible one on a single element, and Playwright's
   `toHaveText` reads `textContent`, which includes the `sr-only` span — so asserting the visible half
   through it would assert the opposite of the criterion. A `visibleText` helper clones the node and
   removes `.sr-only` descendants. `toHaveAccessibleName` was tried first and is **not** used:
   `role=paragraph` takes no name from its content and reports empty, which says nothing about what is
   announced. The accessible half is asserted as the element's full text, `"Absence count: 1/4"`,
   which is what a screen reader reads for a paragraph.
4. **The state on `ticket.yaml` was `BACKLOG` when this command started, not `READY`.** `01-plan.md`'s
   front-matter carries `gate: PASS` and `next_state: READY`, so PLAN completed; the transition itself
   is the board debt the plan names in *Out of scope* item 13 — `.ai/01-operating-model.md:285`
   declares `PLAN -> READY` and no command runs it. This log does not fix that, and the state is set to
   `REVIEW` below per this command's own instruction. **Flagged because it is a gap in the model, not
   in this ticket**, and it will recur on every ticket until the steward closes it.
