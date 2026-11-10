---
ticket: OPS-002
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-07T08:50:00+07:00
inputs_read:
  - .ai/board/tickets/OPS-002/01-plan.md
  - .ai/board/tickets/OPS-002/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/steward/context.md
  - ui-language.json
  - eslint.config.js
  - tests/ui-language.test.ts
  - src/lib/domain/types.ts
  - .ai/board/tickets/OPS-002/99-questions.md
consulted:
  - with: tech-lead-design
    asked: "AC-10 (copyDebt empty) and AC-12 (the language test passes) cannot both hold: Vitest 4
      fails a describe whose only members are `it.each([])`, and tests/ui-language.test.ts is not in
      allowed_paths. 99-questions.md carries the question and the amendment it appears to need."
    answer: "Confirmed; the error was the plan's. AC-10 could never have been satisfied without
      editing that file, so § 1's `out of scope` for a lint rule was carried too far into § 7.
      Both amendments made as proposed: `tests/ui-language.test.ts` added to `allowed_paths` (twelve
      files, the M ceiling exactly, no headroom left), and AC-12 restated with § 4 now carrying the
      required suite shape. The first `describe` is not to be touched. `rework_count` deliberately
      not incremented — RULE-08, `.ai/01-operating-model.md:145`."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# OPS-002 — implementation log

## Files touched

Thirteen files, and the thirteenth is `ticket.yaml`. `01-plan.md` § 7 lists twelve paths outside the
ticket folder after the 2026-09-07 amendment, and all twelve are here.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/labels.ts` | created | The one declaration of the three label sets. Above the seam, importing only domain types, so RULE-02 and the `supabase-client-in-seam` boundary are untouched. | § 4, *The one new module* |
| `src/components/EntryForm.tsx` | modified | Held two of the five type-label declarations and exported them; now imports them. Its seven Vietnamese field strings and its one local refusal are translated. | § 4 *Screen copy* — `EntryForm.tsx`; AC-3, AC-8 |
| `src/routes/NewEntry.tsx` | modified | Twelve Vietnamese strings translated, and the three-branch status conditional at the row replaced by `STATUS_LABELS` — it was a sixth copy of the same three words. | § 4 *Screen copy* — `NewEntry.tsx`; AC-1, AC-8 |
| `src/routes/EditEntry.tsx` | modified | Nine Vietnamese strings translated; its private `STATUS_LABELS` deleted in favour of the shared one. | § 4 *Screen copy* — `EditEntry.tsx`; AC-2, AC-8 |
| `src/routes/TeamEntries.tsx` | modified | Already English. Its three label maps — the ones every value in `src/lib/labels.ts` was taken from — deleted and imported. | AC-8 |
| `src/routes/PendingEntries.tsx` | modified | Already English. Two duplicate label maps deleted and imported. | AC-8 |
| `src/routes/WeekView.tsx` | modified | Already English. `TYPE_LABEL` and `PORTION_LABEL` deleted and imported; `full` moves from `All day` to `Full day`. | AC-8, AC-13 |
| `src/routes/YearView.tsx` | modified | Already English. `TYPE_LABEL` deleted and imported. | AC-8 |
| `src/lib/data/supabase.ts` | modified | Every `message` half of every `Failure` it returns, including the three refusal constants at `:404-406`. No `code` touched. | § 4 *The seam's refusal sentences*; AC-4, AC-6 |
| `src/lib/data/mock.ts` | modified | The same sentences, word for word, on the other side of the seam. No `code` touched. | § 4 *The seam's refusal sentences*; AC-5, AC-6 |
| `tests/ui-language.test.ts` | modified | The two `it.each` calls over `copyDebt` became one `it` iterating in its own body, so the suite holds exactly one test at every list length including zero. Added to `allowed_paths` by the 2026-09-07 amendment; the first `describe` is untouched. | § 4 *The ratchet suite*; AC-12 |
| `ui-language.json` | modified | `copyDebt` emptied — the five files it named no longer contain a diacritic, so the entries could not stay (the test fails on a paid debt still listed). Its `$comment` updated to say the list is now empty and that adding to it is the only remaining way it can change. | AC-10, AC-11 |
| `.ai/board/tickets/OPS-002/ticket.yaml` | modified | `state: BACKLOG → IN_PROGRESS → REVIEW`; `chat_budget.developer->tech-lead-design.used: 0 → 1` for `99-questions.md`. `allowed_paths` and the `size` comment were amended by `tech-lead-design`, not here. | — |

## Contract items

`01-plan.md` § 4 is the contract. Its two halves are the new module and the refusal sentences.

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| `src/lib/labels.ts`, `TYPE_LABELS` | `src/lib/labels.ts:30` | Values verbatim from the plan. |
| `src/lib/labels.ts`, `PORTION_LABELS` | `src/lib/labels.ts:38` | `full: "Full day"` — AC-13. |
| `src/lib/labels.ts`, `STATUS_LABELS` | `src/lib/labels.ts:44` | |
| The seven auth refusals | `src/lib/data/supabase.ts:261-292` (`toFailure`) | `network`, `email_already_registered`, `weak_password`, `rate_limited`, `invalid_credentials`, `email_not_confirmed`, `unknown`. |
| The allow-list PostgREST refusals | `src/lib/data/supabase.ts:297-310` (`toPostgrestFailure`) | `already_allow_listed`, `not_permitted` (generic), `unknown`. |
| The entry refusals | `src/lib/data/supabase.ts:325-353` (`toEntryFailure`) | Overlap, invalid range, `entry_not_permitted` via the parameter. |
| `CREATE_REFUSED`, `UPDATE_REFUSED`, `DELETE_REFUSED` | `src/lib/data/supabase.ts:404-406` | Names unchanged, as § 4 requires. |
| The call-site `not_permitted` sentences | `src/lib/data/supabase.ts:501, 585, 631-632, 638, 727, 756` | Admin sign-in, address removal, `already_consumed`, member removal, promotion. |
| The mock's copy of all of the above | `src/lib/data/mock.ts:517, 578-620, 691-742, 800-809, 854-1081` | Word-for-word identical to `supabase.ts` wherever both express the same refusal (AC-5). |
| Screen copy, `NewEntry.tsx` | `src/routes/NewEntry.tsx:82, 92-94, 108, 121, 156, 169, 182, 194, 203` | |
| Screen copy, `EditEntry.tsx` | `src/routes/EditEntry.tsx:104, 120, 134, 137, 153-155, 219, 255, 278` | |
| Screen copy, `EntryForm.tsx` | `src/components/EntryForm.tsx:150, 158, 174, 191, 208, 231, 235` | |
| The ratchet suite | `tests/ui-language.test.ts:45-63` | Added to § 4 on 2026-09-07. Written to the shape the plan specifies; both assertions keep their meanings and their failure messages, with the path moved from the test name into the assertion message. |

## Deviations from the design

Three, all declared, none of them a behaviour change.

1. **`entry_overlap` in § 4's table is not a code that exists; the code is `overlapping_entry`.** The
   plan's table reproduces `code` values "only to bind each sentence to the refusal it belongs to",
   and AC-6 requires that no `code` move. The sentence was applied to `overlapping_entry`
   (`src/lib/domain/types.ts:61`, `supabase.ts:328`, `mock.ts:881`) and no identifier was renamed. The
   plan's row is a transcription slip in a column it declared non-normative, so this follows AC-6
   over the table.

2. **The `vắng` comment moved rather than staying at `EntryForm.tsx:31`.** § 1 *Out of scope* keeps
   that word untranslated because it is a quoted term inside an explanation of why the label avoids
   it. The explanation belonged to `TYPE_LABELS`, and `TYPE_LABELS` moved to `src/lib/labels.ts`, so
   the sentence moved with it — verbatim, `vắng` included, at `src/lib/labels.ts:22-29`, with a line
   saying why it was not translated. Leaving it behind would have orphaned it from the map it
   explains. It is a comment, so the lint rule does not match it (`Literal`, `TemplateElement`,
   `JSXText` only) — `PendingEntries.tsx:291` already demonstrates that, carrying `đơn` in a comment
   under a rule that has been in force over that file since it shipped.

3. **`NewEntry.tsx`'s status words became `STATUS_LABELS[entry.status]` rather than three translated
   literals.** § 4 *Screen copy* says "the three status words from `STATUS_LABELS`", which is what
   this is; noting it because the diff deletes a conditional expression rather than editing strings,
   and because leaving it as literals would have been a sixth declaration under AC-8.

## Invariants

`invariants_touched: []`, reached at PLAN rather than defaulted. The plan's § 2 gives the row-by-row
reasoning and the implementation did nothing to disturb it: **not one line of this diff changes
whether a `Failure` is returned, only the `message` inside one that was already being returned.** No
condition, no `code`, no policy, no query, no schema.

| ID | Still holds because |
|----|---------------------|
| `INV-03` | The nearest of the seven, because a rejection reason is text. It is user-authored, typed by an admin into a field no path in this diff writes or reads; a reason typed in Vietnamese satisfies it exactly as before. No sentence translated here is ever stored — each is constructed at the moment of failure and rendered. |
| `INV-01`, `INV-05`, `INV-06`, `INV-07` | Properties of stored `entry` and `member` rows. Nothing here writes a row. |
| `INV-02` | A transition triggered by a field change, enforced by `entry_enforce_decision()`. No field this diff touches is one of its inputs. |
| `INV-04` | An arithmetic definition over entries. Unreferenced by any changed line. |

## Verification run

Commands actually executed, with exit codes.

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | AC-11: the five files are now covered by the § Language rule rather than exempt from it, and it passes over them. |
| `pnpm exec vitest run` | 0 | 186 tests, 10 of 10 files. AC-12 and AC-14: 186 rather than 185 because the two `it.each` cases the amendment replaced were registering zero tests at `copyDebt: []`, not because an assertion was added or changed. |
| `node scripts/check-allowed-paths.mjs` | 0 | |
| `git diff --name-only` subset of `allowed_paths` | yes | Twelve paths plus `ticket.yaml`; no file outside § 7. |

End-to-end was not run. It is not in this stage's gate, and `.ai/standards/testing-standards.md`
records the suite's own harness defect (MD-021, ADR-021) — a run here would report that and not this
ticket.

## The blocker, and how it closed

**It was raised, answered and amended between two runs of this command in one Developer session, and
`rework_count` stayed 0.** Recorded here because the diff on its own shows a test file edited and
gives no reason.

AC-10 empties `copyDebt`. `tests/ui-language.test.ts:47-60` was one `describe` whose only contents
were two `it.each` calls over `copyDebt`, and Vitest 4.1.11 does not treat an empty `it.each` as
vacuous — it fails the enclosing suite with `Error: No test found in suite`. So AC-10 and AC-12 as
first written could not both hold, and the file that reconciles them was outside `allowed_paths`.
The first run of this command stopped at `gate: BLOCKED` and put the question to `tech-lead-design`
rather than widening its own `allowed_paths`.

`tech-lead-design` confirmed the diagnosis and named the cause as the plan's own: § 1 puts building a
new § *Language* check out of scope, and § 7 carried that too far — declining to build a check is not
declining to keep the existing one running. It amended `01-plan.md` AC-12 and § 4, added
`tests/ui-language.test.ts` to § 7 and to `ticket.yaml`, and declined to increment `rework_count`
(RULE-08, and `.ai/01-operating-model.md:145` routes *R5 impossible as specified* to
`tech-lead-design` with no increment). The full exchange is `99-questions.md`.

**What was built is § 4's snippet, not an interpretation of it.** One `it` iterating over `copyDebt`
inside its own body, so the suite holds exactly one test at every list length including zero. Both
assertions keep their meanings and their failure messages; the path moved from the test name into the
assertion message, which is the only thing `it.each` was buying. **The first `describe` is untouched**
— its three cases are the exception's protection and AC-9 and AC-11 rest on them.

This closes a defect that predates the ticket: at `copyDebt.length === 0` the old shape asserted
nothing about the ratchet, which is exactly when the ratchet is most worth asserting. The list is now
empty, so that is no longer hypothetical.

**One remaining budget note for the reviewer.** § 7 is now twelve files outside the ticket folder,
which is the M ceiling exactly (`.ai/01-operating-model.md:370-374`) with no headroom left, where it
previously claimed one file of it. Anything further this ticket turns out to need makes it L, and L
must split at PLAN rather than grow a thirteenth entry.

## Testability contract

No selector was added, removed, renamed or moved. Every `data-testid` in the eleven files is the one
that was there before; only the text between the tags changed. `01-plan.md` § 2b says the same in the
other direction — no screen gains, loses or moves an element.

## Open questions

1. **The find-and-replace trap named in `01-plan.md` § 2 *Open questions* item 1 was live and was
   avoided.** `EditEntry.tsx:51` held `approved: "Đã duyệt"` and `src/lib/fixtures.ts:304` holds
   `displayName: "Đã duyệt"` — the same literal, one interface copy and one a person's name. Every
   replacement in this ticket was applied to an exact, anchored string inside a named file, never
   globally. `src/lib/fixtures.ts` and `supabase/seed.sql` do not appear in the diff (AC-9), and
   `git status` is the check.
2. **`src/components/HolidayForm.tsx:35` now carries a stale comment.** It cites "`TYPE_LABELS` and
   `PORTION_LABELS` on EntryForm", which is no longer where they are. The file is outside
   `allowed_paths` and it is a comment, not a reference the compiler follows, so it was left alone
   rather than fixed quietly. It is one line and belongs to whoever next opens that file.
3. **`gates.plan.passed` is still `false` while `01-plan.md` carries `gate: PASS`, and it is nobody
   in this loop's to close.** Raised on the first run and answered by `tech-lead-design`: PLAN writes
   `gate: PASS` into its own front-matter and nothing else; the `orchestrator` grades the full
   Definition of Ready at `/next-ticket` and writes the board. `/next-ticket` never ran on this
   ticket — the loop went `/plan` straight to `/implement` — so `false` records a **grading that was
   skipped, not a gate that failed**. `/ship` requires both gates and will stop until a human closes
   it. Neither `tech-lead-design` nor this session wrote it.
