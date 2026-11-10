---
ticket: ADM-03
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-05T10:44:00+07:00
inputs_read:
  - .ai/board/tickets/ADM-03/01-plan.md
  - .ai/board/tickets/ADM-03/ticket.yaml
  - .ai/standards/architecture.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260905120000_adm02_holiday.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/fixtures.ts
  - src/components/EntryForm.tsx
  - src/routes/Holidays.tsx
  - src/routes/AllowList.tsx
  - tests/threshold.test.ts
  - tests/seam-parity.test.ts
  - tests/e2e/adm-02-holidays.spec.ts
  - tests/e2e/seam.setup.ts
  - eslint.config.js
consulted:
  - with: tech-lead-design
    asked: "01-plan.md §4.5 and §7 state that tests/e2e/adm-02-holidays.spec.ts must pass unedited
      and keep it out of allowed_paths. That file's AC-13 asserts an admin on /holidays is offered
      zero buttons, zero textboxes and zero forms, which ADM-03 AC-1, AC-3, AC-5, AC-8 and AC-11
      each require. No implementation satisfies both. Who retires the superseded assertion?"
    answer: "Option 1, scoped narrower than proposed. The plan was wrong; the implementation is not.
      tests/e2e/adm-02-holidays.spec.ts enters allowed_paths, and exactly two things in it may
      change: the AC-13 block is RETIRED rather than reworded — not rewritten into an assertion
      about a member, because that is ADM-03 AC-14 and ADM-03's own suite owns it — and the two
      header clauses asserting the same fact. All eleven remaining tests must pass with no character
      changed. No ADM-02 artifact is amended and rework_count does not increment (RULE-08)."
    resulted_in_amendment: true
  - with: tech-lead-design
    asked: "EFFECT_LABEL: §4.4 says the form imports it from the screen, but the screen already
      imports the form, so that direction is a module cycle. I implemented the reverse — defined in
      HolidayForm.tsx, imported by Holidays.tsx — matching CAL-02's EntryForm. Accepted?"
    answer: "Accepted, and §4.4 is amended to match. The direction written was unbuildable as
      specified and yours is the one the repository already uses. Keep it in HolidayForm.tsx; no
      declaration is owed in 03-impl-log.md because the plan now says what the code does."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# ADM-03 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260905140000_adm03_holiday_writes.sql` | created | The three write policies and the write grant, transcribed from ADR-015 § 3. Without the grant the policies would sit over a table ADM-02 revoked everything on. | § 6 |
| `src/lib/domain/types.ts` | modified | One union member on `FailureCode` — `holiday_date_taken`, the sentence `unique (date)` needs and that `already_allow_listed` cannot carry. | § 4.1 |
| `src/lib/data/index.ts` | modified | `AddHolidayInput`, `UpdateHolidayInput` and the three seam declarations, with the reason the three do not share one success test. | § 4.2 |
| `src/lib/data/supabase.ts` | modified | `toHolidayFailure`, its three refusal sentences, and the three implementations in the exact shapes § 4.3 specified. | § 4.3 |
| `src/lib/data/mock.ts` | modified | The same three against the in-memory table, reproducing the policies and `unique (date)` — the acceptance suite drives this file. | § 4.3 |
| `src/components/HolidayForm.tsx` | created | The three fields, their validation and their selectors, used twice on one screen so "a blank name is refused" is decided once. | § 4.4 |
| `src/routes/Holidays.tsx` | modified | The role read, the add form, the two per-row controls, the inline edit, the delete confirmation and the out-of-year notice. The read path is untouched. | § 4.5 |
| `tests/holiday-writes.test.ts` | created | AC-15 and AC-16 are refusals the browser cannot reach, and AC-6 and AC-7 are a constraint no provisioned project exists to raise. | § 7 |
| `tests/e2e/adm-03-holiday-writes.spec.ts` | created | The acceptance suite for the fourteen criteria observable through the interface. | § 4.5 |
| `tests/e2e/adm-02-holidays.spec.ts` | modified | Retires the superseded `AC-13` block and the two header clauses that asserted the calendar is unwritable. Entered `allowed_paths` at the amendment of 2026-09-05; the scope is § 7's and nothing else in the file changed. | § 7 |
| `.ai/board/tickets/ADM-03/99-questions.md` | created | The consultation above. Ticket-folder chat, not code — outside `allowed_paths` by design and permitted by this command. | n/a |
| `.ai/board/tickets/ADM-03/03-impl-log.md` | created | This file. | n/a |

`git diff --name-only` plus the untracked list matches the amended `allowed_paths` exactly — ten
globs, ten files — with the two ticket-folder files above as the only additions. **`.env.example` was
already untracked in the tree when this session started and belongs to no path this ticket owns — it
is not mine and I did not touch it.**

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 `holiday_date_taken` | `src/lib/domain/types.ts:81` | The one code added. No `holiday_not_permitted`: the policy refusal reuses `not_permitted` with a per-call-site sentence, as the plan specified. |
| § 4.2 `AddHolidayInput` | `src/lib/data/index.ts:119` | Three fields. `id` and `created_at` withheld here, since the grant is table-wide. |
| § 4.2 `UpdateHolidayInput` | `src/lib/data/index.ts:135` | A separate interface, not an alias. |
| § 4.2 `addHoliday` | `src/lib/data/index.ts:574` | Declared after `listHolidays`, which is unchanged. |
| § 4.2 `updateHoliday` | `src/lib/data/index.ts:587` | |
| § 4.2 `deleteHoliday` | `src/lib/data/index.ts:599` | |
| § 4.3 `toHolidayFailure` | `src/lib/data/supabase.ts:361` | A third mapper, matched on SQLSTATE only. `23505` → `holiday_date_taken`; `42501`/`PGRST301` → `not_permitted`; else `unknown`. |
| § 4.3 real `addHoliday` | `src/lib/data/supabase.ts:1175` | `.insert(...).select(HOLIDAY_COLUMNS).single()`, the shape § 4.3 wrote out. |
| § 4.3 real `updateHoliday` | `src/lib/data/supabase.ts:1204` | Array form; zero rows is the refusal. |
| § 4.3 real `deleteHoliday` | `src/lib/data/supabase.ts:1229` | Array form; zero rows is the refusal. |
| § 4.3 mock `addHoliday` | `src/lib/data/mock.ts:1224` | Through `currentAdmin()`, so AC-15 and AC-16 are inherited rather than written twice. |
| § 4.3 mock `updateHoliday` | `src/lib/data/mock.ts:1255` | |
| § 4.3 mock `deleteHoliday` | `src/lib/data/mock.ts:1281` | |
| § 4.4 `HolidayFormValues` | `src/components/HolidayForm.tsx:45` | |
| § 4.4 `HolidayFormProps` | `src/components/HolidayForm.tsx:50` | All seven props, `onCancel` optional. |
| § 4.4 `EFFECT_LABEL` shared | `src/components/HolidayForm.tsx:37`, imported at `src/routes/Holidays.tsx:41` | One definition, two consumers. This is the direction § 4.4 now specifies, amended 2026-09-05; the value is unchanged character-for-character from what ADM-02 shipped. |
| § 4.5 role read | `src/routes/Holidays.tsx:141`, `212` | `getCurrentMember()` in its own `try`, so a caller with no member row still reads the whole calendar. |
| § 4.5 add form | `src/routes/Holidays.tsx:296` | |
| § 4.5 row controls | `src/routes/Holidays.tsx:360`, `373` | |
| § 4.5 inline edit | `src/routes/Holidays.tsx:394` | Held as an id, never a boolean. |
| § 4.5 delete confirmation | `src/routes/Holidays.tsx:413` | Names the date **and** the name. |
| § 4.5 out-of-year notice | `src/routes/Holidays.tsx:309` | |
| § 6 migration | `supabase/migrations/20260905140000_adm03_holiday_writes.sql` | Four objects, transcribed. Applying it is human (RULE-09). |
| § 7 ADM-02 AC-13 retired | `tests/e2e/adm-02-holidays.spec.ts:243-264` | A comment in the block's place, naming ADM-03 as what superseded it and where the ADM-03-era truth is asserted. Not reworded into a member-facing test — that is ADM-03 AC-14 and this suite does not own it. |

## Deviations from the design

**`none`.** Both of the deviations the first pass of this ticket declared were put to
`tech-lead-design` in `99-questions.md`, and **the plan was amended in both cases rather than the code
changed**, so neither is a departure from § 1 to § 8 as they now read.

- **`EFFECT_LABEL`'s direction.** § 4.4 originally said `HolidayForm.tsx` imports the map from
  `Holidays.tsx`. That is a module cycle — the screen already imports the form — and it was
  unbuildable as specified. The implemented direction is the one CAL-02 established with
  `EntryForm.tsx`'s `TYPE_LABELS`. § 4.4 now specifies it, so no declaration is owed here; it is
  recorded only because the earlier version of this log declared it.
- **`tests/e2e/adm-02-holidays.spec.ts`.** § 4.5 and § 7 originally required it to pass unedited and
  excluded it from `allowed_paths`, which no implementation could satisfy. It is now in
  `allowed_paths` under § 7's narrow instruction, and this pass edited exactly what that instruction
  admits: the `AC-13` block and the two header clauses asserting the same fact. The eleven remaining
  tests are unchanged and pass — verified below.

Nothing else departs from § 1 to § 8. In particular the three seam shapes, the three SQLSTATE
mappings, the four SQL objects, the id-not-boolean editing state, the absence of a client-side
duplicate-date check, and the absence of any `holiday_not_permitted` code are all as written.

### What was edited in `tests/e2e/adm-02-holidays.spec.ts`, and what was not

**Edited — three regions, all of them the claim that the calendar is unwritable:**

1. The `test("AC-13: …")` block, **retired and replaced by a comment** at lines 243-264. It names
   ADM-03 as what superseded it, says why there is no narrower true statement left for it to make
   about an admin on that screen, and names where the ADM-03-era truth is asserted instead —
   `tests/e2e/adm-03-holiday-writes.spec.ts` AC-14, and `tests/holiday-writes.test.ts` AC-15 and
   AC-16. **It is deliberately not reworded into a member-facing assertion**: that is ADM-03 AC-14
   and ADM-03's own suite owns it.
2. The header clause explaining ADM-02's unasserted AC-5. It said *"Nothing in the product can insert
   a holiday at all on this branch"*, which stops being true at this ticket's `/ship`. It now records
   that ADM-03 closed the gap and that ADM-03 AC-6 is where the duplicate-date refusal is asserted,
   while keeping the true half — the constraint itself is still exercised by no test until a project
   is provisioned.
3. The paragraph naming the real mechanisms, which listed *"the ABSENCE of all three write policies"*
   among them and cited AC-13.

**Not edited — everything else, and this is the property the exclusion was protecting.** All eleven
remaining `test(…)` blocks — AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8, AC-9, AC-10, AC-14, AC-15 —
have not one character changed, and all eleven pass. That green run is the evidence for ADM-03 AC-18:
the write path was added without disturbing the read one. No ADM-02 artifact is amended and no
acceptance criterion of ADM-02's is rewritten; ADM-02 stays `DONE` and its `01-plan.md` stays the
true record of what was built there.

## Invariants

`invariants_touched: []`, and the plan states the reason rather than leaving it absent.

| ID | Still holds because |
|----|---------------------|
| — | **A holiday is not an entry.** INV-01, INV-02 and INV-03 constrain `entry`; INV-04 is a sum over entries and this table has none; INV-05 is `tentative` and INV-06 is an entry's portion, and `holiday` has neither column. INV-07 constrains entries and the members they belong to, and a holiday row has neither — which is the step ADR-015 § *Rationale* examined and refused when it was offered as the case for a `team_id`. Nothing in this ticket reads, writes or derives from `entry`: `src/lib/data/absence.ts`, `src/lib/draft-entry.ts` and `src/components/OverloadWarning.tsx` are untouched and absent from `allowed_paths`, so CAL-07's crowded-day warning behaves on a holiday exactly as it did before this branch. |

`unique (date)` is load-bearing and is deliberately **not** treated as a registry invariant: it
carries no ID in `invariants.md`, and AC-6 and AC-7 hold it as behaviour.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | Includes the § Language rule — every string these files render is English. |
| `pnpm exec vitest run` | 0 | 6 files, 125 tests. `tests/seam-parity.test.ts` passes **unedited** with the three functions added, which is § 5's requirement. |
| `pnpm exec playwright test` | 0 | **134 passed, 0 failed.** All 16 of `tests/e2e/adm-03-holiday-writes.spec.ts` pass. `tests/e2e/adm-02-holidays.spec.ts` runs 11 tests and all 11 pass with no character changed — run separately as well, to have that stated on its own rather than only inside a total. |
| `git diff --name-only` subset of `allowed_paths` | yes | Ten globs, ten files, plus the two ticket-folder files named in the table above. |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `holiday-add-form` | `src/components/HolidayForm.tsx:141` via `testIdPrefix="holiday-add"` at `src/routes/Holidays.tsx:297` |
| `holiday-add-date` | `src/components/HolidayForm.tsx:152` |
| `holiday-add-name` | `src/components/HolidayForm.tsx:163` |
| `holiday-add-kind` | `src/components/HolidayForm.tsx:178` |
| `holiday-add-submit` | `src/components/HolidayForm.tsx:199` |
| `holiday-add-error` | `src/components/HolidayForm.tsx:192` |
| `holiday-edit-form` … `-cancel` | the same seven lines via `testIdPrefix="holiday-edit"` at `src/routes/Holidays.tsx:396`; `holiday-edit-cancel` is `src/components/HolidayForm.tsx:209` and exists only on the edit form, because `onCancel` is passed only there |
| `holidays-row-edit` | `src/routes/Holidays.tsx:360` |
| `holidays-row-delete` | `src/routes/Holidays.tsx:373` |
| `holidays-row-delete-confirm` | `src/routes/Holidays.tsx:413` |
| `holidays-row-delete-confirm-accept` | `src/routes/Holidays.tsx:431` |
| `holidays-row-delete-confirm-cancel` | `src/routes/Holidays.tsx:440` |
| `holidays-added-elsewhere` | `src/routes/Holidays.tsx:309` |

Every selector ADM-02 shipped keeps its name: `holidays-list:322`, `holidays-row:326`,
`holidays-row-date:341`, `holidays-row-name:344`, `holidays-row-effect:348`,
`holidays-beyond-calendar:463`, `holidays-year:278`, `holidays-prev:272`, `holidays-next:282`,
`holidays-back:470`, `holidays-loading:184`, `holidays-unavailable:196`.

## Open questions

1. **Closed — the ADM-02 AC-13 contradiction.** Answered in `99-questions.md` and amended into
   `01-plan.md` § 4.5, § 7 and § 4.4. Recorded here rather than deleted because the reviewer receives
   this file and the diff, and a retired test in a file this ticket was originally forbidden to touch
   is exactly the kind of change that reads as a violation without the record of why it is not.

2. **Not blocking — AC-4's notice also fires on an EDIT that moves a row out of the displayed year.**
   The criterion names the add only. The edit has the same property and the same consequence (the row
   is saved and then invisible), so `onEdit` sets the same notice — `src/routes/Holidays.tsx:236`.
   That is one line beyond what AC-4 asks for, and it is here rather than silent because a reviewer
   under R5 will otherwise read it as scope growth. It renders no new selector and adds no criterion.

3. **Not blocking, and unchanged from the plan — `supabase/db.sql` goes stale at this ticket's
   `/ship`.** Its § 9 block marks these four objects `[OWED] ADM-03`, which stops being true once
   this migration exists. 01-plan.md Open question 3 names it on the CAL-04, ADM-01 and ADM-02
   precedent and assigns it to nobody; nothing here changed that.

4. **Recorded, unchanged — `glossary.md`'s *Holiday* row still conflates the compensatory day off
   with the mandated working Saturday.** A glossary row is a human's edit under RULE-01. AC-3's
   labels are the mitigation and they are implemented: the control says the effect, and the map is
   shared with the list, so the form and the list cannot disagree even while the glossary does.
