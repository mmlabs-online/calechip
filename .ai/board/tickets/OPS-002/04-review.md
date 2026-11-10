---
ticket: OPS-002
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-07T08:59:52+07:00
inputs_read:
  - .ai/board/tickets/OPS-002/01-plan.md
  - .ai/board/tickets/OPS-002/03-impl-log.md
  - .ai/board/tickets/OPS-002/99-questions.md
  - .ai/board/tickets/OPS-002/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/boundaries.json
  - .ai/registry/rules.md
  - .ai/standards/ui-design-system.md
  - .ai/01-operating-model.md
  - git diff
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# OPS-002 — review report

**Every verdict below was reached by running the check in this working tree, not by reading
`03-impl-log.md`'s account of it.** The log's four command results were reproduced independently and
agree; where a check the log cites is vacuous, that is said rather than counted as evidence.

**`next_state: DONE`, not `QA`.** `.ai/templates/review-report.md` still ships `next_state: QA` in
its front-matter block; ADR-022 removed the QA stage and `.ai/01-operating-model.md:36` reads
`IN_PROGRESS -> REVIEW -> DONE`. The operating model governs.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | Twelve tracked modifications and one new file, each matched by hand against `.ai/board/tickets/OPS-002/ticket.yaml:44-63`. `src/lib/labels.ts:1` is new and listed at `ticket.yaml:46`; `tests/ui-language.test.ts:1` is listed at `ticket.yaml:63`; the three untracked ticket artifacts fall under `.ai/board/tickets/OPS-002/**` at `ticket.yaml:45`. Nothing outside § 7. |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, no output. Run in this tree at 08:57 +07. |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0. The § Language rule now covers the five formerly exempt files, because `ui-language.json:21` is `"copyDebt": []` and `eslint.config.js:84` spreads `COPY_DEBT` into `ignores`. |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `@supabase/*` is imported at exactly two lines, both inside the seam: `src/lib/data/supabase.ts:10` and `:11`. No other file in `src/` names it. The one new module imports domain types only — `src/lib/labels.ts:19` — and sits in `src/lib/`, outside `src/lib/data/`, so the `supabase-client-in-seam` boundary (`.ai/registry/boundaries.json`, `exempt_dirs: ["src/lib/data"]`) is untouched. `node scripts/check-docs.mjs` → exit 0, D12 clean. |
| R5 | Every contract item in plan § 4 is implemented (RULE-04) | PASS | Per-item table below. |
| R6 | Permission gating matches plan § 3 | PASS | `01-plan.md` § 3 says no role gate moves. Confirmed structurally: a filtered diff of `src/` with every string literal removed leaves only map deletions, import lines and one member-expression substitution — **no conditional, guard, policy or query changed**. Every mock role guard is intact and untouched: `src/lib/data/mock.ts:563`, `:577`, `:608`, `:693`, `:731`. No SQL is written at all (`git status --porcelain supabase/` empty). |
| R7 | No invariant violated (RULE-07) | PASS | Per-ID table below. |
| R8 | No dependency added without an ADR | PASS | `git status --porcelain package.json pnpm-lock.yaml` → empty. Neither manifest nor lockfile is in the diff, and `src/lib/labels.ts:19` imports one first-party module. `01-plan.md` § 8 rejects the catalogue-with-a-package alternative for this reason; `ticket.yaml:64` `requires_adr: false` still holds. |

**On the template's numbering.** `.ai/templates/review-report.md` heads its per-invariant section
`R8 detail` while its own checklist row R7 is the invariant check and R8 is the dependency check.
`.ai/01-operating-model.md:145` settles it — R7 is the row that escalates under RULE-07, R8 routes to
`developer`. This report uses the operating model's numbering and names the section R7.

## R1 detail — why the guard's PASS was not taken as evidence

`node scripts/check-allowed-paths.mjs` exits 0, and its own output says
`allowed-paths: ticket OPS-002, 0 changed file(s)`. **That zero is the whole of it.**
`scripts/check-allowed-paths.mjs:115-118` computes the changed set from `origin/main`, and this ticket
is entirely uncommitted by design — `CLAUDE.md` § *Working agreements* keeps the tree dirty until
`/ship`. So the guard passed over an empty set and proves nothing at REVIEW; it becomes meaningful
only once `/ship` commits. R1 above was therefore verified by matching `git status --porcelain`
against `allowed_paths` line by line, not by the exit code.

## R5 detail

`01-plan.md` § 4 is the contract. Every row was checked against the file, not against
`03-impl-log.md`.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| `src/lib/labels.ts` — `TYPE_LABELS` | `src/lib/labels.ts:30-33` | Yes. `Record<EntryType, string>`, values `Leave` / `Working from home` verbatim from § 4. |
| `src/lib/labels.ts` — `PORTION_LABELS` | `src/lib/labels.ts:38-42` | Yes. `full: "Full day"` — AC-13 resolved against `WeekView.tsx`'s former `All day`. |
| `src/lib/labels.ts` — `STATUS_LABELS` | `src/lib/labels.ts:44-48` | Yes. |
| Above the seam, domain types only | `src/lib/labels.ts:19` | Yes. Sole import. |
| The seven auth refusals | `src/lib/data/supabase.ts:261-292` (`toFailure`) | Yes. `network` `:263`; `email_already_registered`, `weak_password`, `rate_limited`, `invalid_credentials`, `email_not_confirmed`, `unknown` follow in the same switch, each string byte-identical to § 4's table. |
| The allow-list PostgREST refusals | `src/lib/data/supabase.ts:297-310` (`toPostgrestFailure`) | Yes. `already_allow_listed` `:300`; `not_permitted` generic; `unknown`. |
| The entry refusals | `src/lib/data/supabase.ts:325-353` (`toEntryFailure`) | Yes. `overlapping_entry` `:330`, `invalid_date_range`, `entry_not_permitted` via the parameter. |
| `CREATE_REFUSED`, `UPDATE_REFUSED`, `DELETE_REFUSED` | `src/lib/data/supabase.ts:404-406` | Yes. All three names unchanged, as § 4 requires; the three `entry_not_permitted` sentences applied. |
| The call-site `not_permitted` sentences | `src/lib/data/supabase.ts:586`, `:632-635`, `:640`, `:729`, `:758` | Yes. Admin sign-in, `already_consumed`, address removal, member removal, promotion. |
| The mock's copy of all of the above | `src/lib/data/mock.ts:517`, `:578`, `:586`, `:609`, `:614`, `:619-622`, `:694`, `:699`, `:704`, `:711`, `:732`, `:735`, `:738`, `:745`, `:803`, `:812`, `:857`, `:868`, `:882-885`, `:959`, `:968`, `:991`, `:1017-1020`, `:1084` | Yes — AC-5 verified mechanically below. |
| Screen copy, `NewEntry.tsx` | `src/routes/NewEntry.tsx:82`, `:92-94`, `:108`, `:121`, `:156`, `:169`, `:178`, `:190`, `:199`, `:212` | Yes. All ten strings match § 4 exactly, and `:169` is `STATUS_LABELS[entry.status]`. |
| Screen copy, `EditEntry.tsx` | `src/routes/EditEntry.tsx:104`, `:120`, `:134`, `:137`, `:150-152`, `:218`, `:254`, `:277` | Yes. |
| Screen copy, `EntryForm.tsx` | `src/components/EntryForm.tsx:150`, `:164`, `:180`, `:197`, `:214`, `:237`, `:241` | Yes. |
| The ratchet suite | `tests/ui-language.test.ts:45-63` | Yes. One `it` at `:46` iterating `copyDebt` in its own body; both assertions keep their subjects and expected values and gain the failure messages § 4's snippet specifies. `describe` at `:29` untouched, as § 4 requires. |
| `copyDebt` emptied | `ui-language.json:21` | Yes. `"copyDebt": []`; `userContent` at `:22` still names both files. |

### AC-6 — no `code` moves, verified mechanically rather than read

The multiset of `code` literals was extracted from `git show HEAD:<file>` and from the working tree
and compared. `src/lib/data/supabase.ts` — **identical**. `src/lib/data/mock.ts` — **identical**
(a first pass reported one `already_consumed` missing; that was an artefact of the literal moving onto
its own line at `src/lib/data/mock.ts:621`, and a whitespace-insensitive re-run confirms the sets
match). No caller anywhere in `src/` or `tests/` branches on `message` text — a grep for `.message ===`
and `error.message.includes` returns nothing — so nothing downstream of the seam depends on a
sentence that changed.

### AC-5 — word-for-word parity across the seam, verified by set comparison

Every string literal of fifteen characters or more was extracted from both implementations and the
two sets differenced. **Every sentence present in both files is byte-identical.** The asymmetric ones
are refusals only one implementation expresses, and each is a separate row in § 4's own table:
`supabase.ts` alone carries the GoTrue and PostgREST mappings (`network`, `rate_limited`,
`You do not have permission to do this.`, `You need to sign in with an admin account.`) because the
mock has no network layer and no PostgREST; `mock.ts` alone carries the explicit
`Only an admin can …` sentences (`src/lib/data/mock.ts:578`, `:609`, `:694`, `:732`) because in
Supabase those refusals are row-level security returning 42501. This is the pre-existing division of
labour, not a one-sided translation.

### AC-9 — the exception survived, and the find-and-replace trap was live

`git status --porcelain src/lib/fixtures.ts supabase/seed.sql` is empty; both still carry diacritics
(13 and 21 matching lines). The trap `01-plan.md` § 2 *Open questions* item 1 predicted is real and
was not sprung: `"Đã duyệt"` survives as a **person's name** at `tests/e2e/adm-04-worklist.spec.ts:73`,
`tests/e2e/cal-03-admin-edit-entry.spec.ts:43` and `tests/e2e/cal-05-week-view.spec.ts:155`, while the
same literal as a **status label** became `Approved` at `src/lib/labels.ts:46`. Same string, opposite
verdicts, both correct.

### AC-8 — exactly one declaration

`grep` over the whole of `src/` for a declaration of any of the three sets returns exactly three
lines, all in one file: `src/lib/labels.ts:30`, `:38`, `:44`. The five former copies are gone
(`EntryForm.tsx`, `TeamEntries.tsx`, `PendingEntries.tsx`, `WeekView.tsx`, `YearView.tsx`) and all
seven consumers import: `src/components/EntryForm.tsx:31`, `src/routes/NewEntry.tsx:27`,
`src/routes/EditEntry.tsx:50`, `src/routes/TeamEntries.tsx:35`, `src/routes/PendingEntries.tsx:65`,
`src/routes/WeekView.tsx:48`, `src/routes/YearView.tsx:58`. `EFFECT_LABEL` at
`src/components/HolidayForm.tsx:37` is a different set (holiday kinds) and is out of scope.

### AC-14 — checked closely, and it holds in substance

**AC-14 says the suites pass "with no edit to any assertion", and `tests/ui-language.test.ts` was
edited.** This was examined rather than waved through, because the 2026-09-07 amendment rewrote
AC-12, § 4 and § 7 and did not restate AC-14. It holds: no *expectation* changed — every subject and
every `.toBe(true)` at `tests/ui-language.test.ts:53` and `:61` is the one that was there — and the
only edit is the second argument to `expect`, a failure message, which § 4's snippet makes normative
and which AC-14's own stated reason ("no test asserts a string this ticket translates or relocates")
does not reach. `pnpm exec vitest run` → exit 0, **186 tests, 10 of 10 files**, up from 185 because
the two `it.each([])` calls were registering zero tests, not because an assertion was added. No other
test file is in the diff.

### The three declared deviations, each checked

1. **`entry_overlap` → `overlapping_entry`.** Correct. `entry_overlap` is not a code that exists; the
   code is `overlapping_entry` at `src/lib/data/supabase.ts:330` and `src/lib/data/mock.ts:882`,
   `:1017`, and § 4 declares its `code` column non-normative. AC-6 governs and no identifier moved.
2. **The `vắng` comment moved to `src/lib/labels.ts:25-26`.** Correct, and it had to move: § 1 keeps
   the word because it is a quoted term inside the explanation of why the label avoids it, and the
   explanation belongs to `TYPE_LABELS`. `.ai/standards/ui-design-system.md:45-47` governs "every
   string the interface **renders**", and `eslint.config.js:88-89` matches `Literal`,
   `TemplateElement` and `JSXText` only — a comment is none of them. R3 is exit 0 with the file no
   longer exempt, which is the proof.
3. **`STATUS_LABELS[entry.status]` replacing the three-branch conditional** at
   `src/routes/NewEntry.tsx:169`. Correct, and § 4 asks for exactly this ("the three status words
   from `STATUS_LABELS`"). The three values are unchanged and `data-status` at `src/routes/NewEntry.tsx:166` is untouched.

### Testability contract

No selector moved. Every `data-testid` in the diff is the one that was there — checked at
`src/routes/NewEntry.tsx:166`, `src/routes/EditEntry.tsx:131`, `:213`, `:249`,
`src/components/EntryForm.tsx:166`, `src/routes/WeekView.tsx:415`, `:425` — and only the text between
the tags changed. `01-plan.md` § 2b claims no screen gains, loses or moves an element; the diff bears
that out.

## R7 detail

`invariants_touched: []` at `ticket.yaml:33`, and `.ai/registry/invariants.md` warns that reaching
"none" from safe behaviour is circular. Each of the seven was therefore reasoned through against the
diff rather than against the claim.

**The one fact that decides all seven:** not one line of this diff changes whether a `Failure` is
returned, only the `message` inside one already being returned. The R6 filtered diff is the evidence —
no conditional, guard, policy or query changed anywhere in `src/`.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no overlapping portions for one member | The overlap check is untouched; only the sentence it returns changed. The `code` is still `overlapping_entry`. | `src/lib/data/mock.ts:882` and `src/lib/data/supabase.ts:330` — code unchanged, condition unchanged, message only. Enforced in the datastore by a constraint no line of this diff writes. |
| INV-02 — an approved entry returns to `pending` on edit | Enforced by `entry_enforce_decision()`, a trigger. No SQL is in this diff and no field it reads is written here. | `.ai/registry/invariants.md:34`; `git status --porcelain supabase/` is empty. `src/lib/data/mock.ts:968` and `:991` change a refusal sentence inside `updateEntry` and nothing that decides the transition. |
| INV-03 — a rejected entry carries a non-empty rejection reason | The nearest of the seven, because a reason is text. It is **user-authored**, typed by an admin into a field no path in this diff writes or reads, and no sentence translated here is ever stored — each is constructed at the moment of failure and rendered. A reason typed in Vietnamese satisfies INV-03 exactly as before, and `.ai/standards/ui-design-system.md:66-72` puts user content outside § Language on purpose. | `.ai/registry/invariants.md:35`. No `rejectionReason` or `rejection_reason` write appears in the diff; `src/lib/data/mock.ts` decision paths at `:1173` onward are untouched. |
| INV-04 — one definition of the absence count | An arithmetic definition over entries. No changed line is referenced by it; `src/lib/data/absence.ts` and `src/lib/data/day-status.ts` are not in the diff. | `.ai/registry/invariants.md:36`; `src/routes/WeekView.tsx:45-46` imports both unchanged. |
| INV-05 — a tentative entry counts as a non-tentative one | Only the marker's *word* changed, `Chưa chắc chắn` → `Not certain`. The flag, the attribute and every count are untouched. | `src/routes/NewEntry.tsx:156` and `src/components/EntryForm.tsx:237` — label text only; the `entry.tentative` conditional at `src/routes/NewEntry.tsx:154` unchanged. |
| INV-06 — one portion per entry, for every date in its range | Reinforced rather than disturbed: the three portion labels are now one `Record<EntryPortion, string>` instead of three divergent maps, and the invariant is cited at the declaration. No per-date control exists or was added. | `src/lib/labels.ts:35-42`. |
| INV-07 — every entry belongs to one member, counted against one team | Properties of stored rows. Nothing here writes a row. The team comparisons in the mock are untouched. | `.ai/registry/invariants.md:39`; `src/lib/data/mock.ts:698` (`m.teamId === me.teamId`) and `:734` unchanged — only the refusal sentences beside them at `:699` and `:735` changed. |

**No invariant here is held by a UI affordance.** All seven are enforced in the datastore or in the
mock's reproduction of it, and this ticket changed neither.

## Findings

None. No check failed.

| # | Check | Finding | Routes to | Increments `rework_count` |
|---|---|---|---|---|
| — | — | — | — | — |

## Two things a human should see, neither of them a gate finding

**They are recorded here rather than raised as findings because neither is a defect in this
implementation, and `/review` has no verdict between PASS and FAIL for them.**

1. **`gates.plan.passed` is `false` at `ticket.yaml:69` while `01-plan.md` carries `gate: PASS`.**
   Independently confirmed by reading both files. It records a Definition of Ready grading that
   `/next-ticket` never performed — the loop went `/plan` straight to `/implement` — not a gate that
   failed. It is outside this stage's ownership (`.ai/01-operating-model.md:84`: the REVIEW row writes
   `04-review.md` and nothing else) and `/ship` requires both gates, so it will stop until a human
   closes it. Raised already at `03-impl-log.md` *Open questions* item 3.
2. **`src/components/HolidayForm.tsx:35` now carries a stale comment** citing `TYPE_LABELS` and
   `PORTION_LABELS` "on EntryForm", where they no longer are. Verified in the file. It is outside
   `allowed_paths`, it is a comment rather than a reference the compiler follows, and the Developer
   correctly left it rather than editing outside § 7 (RULE-03). It is one line for whoever next opens
   that file.

## Verdict

**`PASS`.** R1 through R8 all pass, each cited above against the implementation.

The gate rests on four commands run in this tree, not on `03-impl-log.md`'s report of them:
`pnpm exec tsc --noEmit` exit 0, `pnpm exec eslint .` exit 0, `pnpm exec vitest run` exit 0 with 186
tests in 10 files, and `node scripts/check-docs.mjs` exit 0. R1 was verified by hand because
`scripts/check-allowed-paths.mjs` reports `0 changed file(s)` on an uncommitted tree and its PASS is
vacuous at this stage.

`next_state: DONE`. The `orchestrator` moves the board; this report does not.
