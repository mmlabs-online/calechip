---
ticket: ADM-03
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-05T10:52:00+07:00
inputs_read:
  - .ai/board/tickets/ADM-03/01-plan.md
  - .ai/board/tickets/ADM-03/03-impl-log.md
  - .ai/board/tickets/ADM-03/99-questions.md
  - .ai/board/tickets/ADM-03/ticket.yaml
  - .ai/board/tickets/ADM-02/04-review.md
  - .ai/01-operating-model.md
  - .ai/registry/invariants.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/review-report.md
  - .ai/steward/context.md
  - scripts/check-allowed-paths.mjs
  - eslint.config.js
  - package.json
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/components/HolidayForm.tsx
  - src/routes/Holidays.tsx
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260905120000_adm02_holiday.sql
  - supabase/migrations/20260905140000_adm03_holiday_writes.sql
  - tests/holiday-writes.test.ts
  - tests/e2e/adm-02-holidays.spec.ts
  - tests/e2e/adm-03-holiday-writes.spec.ts
  - git diff
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# ADM-03 — review report

Isolated dispatch, fresh session, files only. No Developer was spoken to and no message channel was
opened — `chat_before_verdict: none` is literally true. The `99-questions.md` exchange in this ticket
folder happened at IN_PROGRESS, between `developer` and `tech-lead-design`, before this session
existed; it is an input read, not a conversation this reviewer had.

`next_state` is `DONE` and not `QA`, and the invariant check below is numbered **R7**. ADR-022
removed the QA stage; `.ai/01-operating-model.md:127-134` is the checklist this report answers, and
`.ai/templates/review-report.md` still carries the pre-ADR-022 numbering in its two detail headings
and `next_state: QA` in its front-matter block. ADM-02's review recorded the same divergence
(`.ai/board/tickets/ADM-02/04-review.md:36`) and this one follows it rather than re-deciding it.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/ADM-03/ticket.yaml:110-119` |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` — exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` — exit 0, no output |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/lib/data/supabase.ts:10-11` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | table below |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20260905140000_adm03_holiday_writes.sql:35-63` |
| R7 | No invariant violated (RULE-07) | PASS | table below |
| R8 | No dependency added without an ADR | PASS | `package.json:16-42`, absent from `git diff --name-only` |

### R1 — what changed, against the ten globs

Seven tracked files changed and five are untracked-new. Every one of the ten code and test paths is
in `allowed_paths` at `ticket.yaml:110-119`. The three ticket-folder files (`01-plan.md`,
`03-impl-log.md`, `99-questions.md`) are exempt by `scripts/check-allowed-paths.mjs:130` — the CI
counterpart of this check excludes `ticketDir` and everything under it — and `ticket.yaml` is in that
same folder.

`tests/e2e/adm-02-holidays.spec.ts` is edited and **is** in `allowed_paths`, entered by the plan
amendment of 2026-09-05 (`ticket.yaml:88-99`, `01-plan.md` § 7). The permission is narrower than the
file, so the edit was checked against the instruction rather than against the glob:

- The retired block is `tests/e2e/adm-02-holidays.spec.ts:251-271` — a comment in the place of the
  former `AC-13`, naming ADM-03 as what superseded it and naming
  `tests/e2e/adm-03-holiday-writes.spec.ts` AC-14 and `tests/holiday-writes.test.ts` AC-15/AC-16 as
  where the ADM-03-era truth is asserted. It is **not** reworded into a member-facing assertion,
  which § 7 forbids.
- The two header clauses are `tests/e2e/adm-02-holidays.spec.ts:11-19` and `:35-41`.
- `git diff tests/e2e/adm-02-holidays.spec.ts` contains **exactly three hunks** and none of them
  falls inside a surviving `test(…)` block. The eleven remaining tests (`:103`, `:114`, `:130`,
  `:157`, `:167`, `:179`, `:193`, `:212`, `:229`, `:274`, `:291`) are unchanged
  character-for-character, and `pnpm exec playwright test tests/e2e/adm-02-holidays.spec.ts` passes
  all eleven (12 reported, the twelfth being the `seam-guard` setup project). That green run is what
  carries AC-18.

**One path in the tree is outside `allowed_paths` and is not this ticket's:** `.env.example`,
untracked. Its content is the Supabase env template and the seam resolver — it names
`src/lib/data/index.ts:523`, `playwright.config.ts:49-51` and BUG-001, and nothing about a holiday.
Its mtime is `10:15:33`, ahead of every implementation file this ticket wrote (earliest
`supabase/migrations/20260905140000_adm03_holiday_writes.sql` at `10:21:04`), which is consistent
with `03-impl-log.md`'s declaration that it was already in the tree. It is chore work and **must be
left dirty at `/ship`** rather than committed onto this branch — `CLAUDE.md` § *Working agreements*
and ADR-023. Recorded here so the ship session classifies it deliberately; it is not a RULE-03
violation by this ticket and does not affect this verdict.

### R4 — the seam

`@supabase/supabase-js` is imported at `src/lib/data/supabase.ts:10-11` and nowhere else in `src/`.
`src/routes/Holidays.tsx:40` imports `seam` from `@/lib/data` and `src/components/HolidayForm.tsx:20`
imports types only — neither names an implementation. The three new functions are declared on
`DataSeam` (`src/lib/data/index.ts:574`, `:587`, `:599`) and implemented in both seams, so the write
path crosses the boundary exactly where the read path already did. `eslint.config.js:64-77` is the
lint rule that holds this, and R3 is its green run.

`tests/holiday-writes.test.ts:27` imports `@/lib/data/mock` directly. That is the shape
`tests/threshold.test.ts:21` and `tests/seam-parity.test.ts:12-13` already use, and the lint rule
scopes itself to `src/**`; a unit test choosing a caller is not a component reaching the datastore.

## R5 detail

One row per contract item in `01-plan.md` § 4.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `FailureCode \| "holiday_date_taken"` | `src/lib/domain/types.ts:81` | Yes. One union member added; no exhaustive `switch` or `Record<FailureCode, …>` exists in `src/`, so no caller changed. No `holiday_not_permitted` was added, as specified. |
| § 4.2 `AddHolidayInput` | `src/lib/data/index.ts:119-123` | Yes. `date`, `name`, `kind`. No `teamId`, no `id`, no `createdAt`. |
| § 4.2 `UpdateHolidayInput` | `src/lib/data/index.ts:135-139` | Yes. A separate interface, not an alias. |
| § 4.2 `addHoliday(input): Promise<Result<Holiday>>` | `src/lib/data/index.ts:574` | Yes. Declared after `listHolidays`, which is unchanged. |
| § 4.2 `updateHoliday(id, input): Promise<Result<Holiday>>` | `src/lib/data/index.ts:587` | Yes. |
| § 4.2 `deleteHoliday(id): Promise<Result<void>>` | `src/lib/data/index.ts:599` | Yes. |
| § 4.3 `toHolidayFailure` | `src/lib/data/supabase.ts:361-383` | Yes. A third mapper beside `toPostgrestFailure` and `toEntryFailure`. `23505` → `holiday_date_taken` (`:371`), `42501`/`PGRST301` → `not_permitted` (`:378-380`), else `unknown` (`:381`). Matched on `error.code` only — no constraint name and no message text anywhere in the function. |
| § 4.3 real `addHoliday` | `src/lib/data/supabase.ts:1175-1187` | Yes. `.insert({date,name,kind}).select(HOLIDAY_COLUMNS).single<HolidayRow>()`, the shape § 4.3 wrote out. |
| § 4.3 real `updateHoliday` | `src/lib/data/supabase.ts:1204-1221` | Yes. `.returns<HolidayRow[]>()`, and zero rows is `not_permitted` at `:1216-1218` rather than `!error`. |
| § 4.3 real `deleteHoliday` | `src/lib/data/supabase.ts:1229-1244` | Yes. Same array form; `.select()` present, so a filtered DELETE is counted rather than reported as done (`:1239-1241`). |
| § 4.3 mock `addHoliday` | `src/lib/data/mock.ts:1224-1247` | Yes. `currentAdmin()` at `:1225`, duplicate-date check at `:1231`, a copy returned at `:1246`. |
| § 4.3 mock `updateHoliday` | `src/lib/data/mock.ts:1255-1275` | Yes. `h.id !== holidayId && h.date === input.date` at `:1265` — a row does not collide with itself, which is what `unique (date)` does. |
| § 4.3 mock `deleteHoliday` | `src/lib/data/mock.ts:1281-1290` | Yes. `splice` at the found index, so exactly one row leaves (AC-13). |
| § 4.4 `EFFECT_LABEL`, one definition | `src/components/HolidayForm.tsx:37-40`, imported at `src/routes/Holidays.tsx:41` | Yes, in the direction § 4.4 specifies after its 2026-09-05 amendment. The two strings are unchanged from what ADM-02 shipped, and the screen no longer owns a copy. |
| § 4.4 `HolidayFormValues` | `src/components/HolidayForm.tsx:45-49` | Yes. |
| § 4.4 `HolidayFormProps` | `src/components/HolidayForm.tsx:51-69` | Yes. All seven props, `onCancel` optional — so `holiday-add-cancel` is a selector that does not exist rather than one that is hidden (`:207-217`). |
| § 4.4 validation before the write (AC-5) | `src/components/HolidayForm.tsx:106-113` | Yes. A whitespace-only `name` and an empty `date` each return before `onSubmit`, so nothing is issued. |
| § 4.4 no client-side duplicate-date check | `src/components/HolidayForm.tsx:14-18` | Yes — the absence is the contract item, and there is no date-collision predicate anywhere in the component or in the screen's three submit handlers. |
| § 4.5 role read, in its own `try` | `src/routes/Holidays.tsx:141-146` | Yes. A failed `getCurrentMember()` yields `me = null` and the calendar still loads (`:154`). No fourth phase was added. |
| § 4.5 add form, admin only | `src/routes/Holidays.tsx:294-303` | Yes. `testIdPrefix="holiday-add"`, `initial.kind` is `non_working` (AC-3), `afterSubmit="clear"`. |
| § 4.5 row edit and delete controls | `src/routes/Holidays.tsx:357-386` | Yes. `holidays-row-edit:360`, `holidays-row-delete:373`. |
| § 4.5 inline edit, id and not boolean | `src/routes/Holidays.tsx:120-121`, `:391-405` | Yes. `editingId` and `pendingId` are `string \| null`; there is no boolean beside either. |
| § 4.5 delete confirmation naming date and name | `src/routes/Holidays.tsx:411-448`, sentence at `:425-427` | Yes. Both `holiday.date` and `holiday.name` are rendered (AC-11). |
| § 4.5 out-of-year notice | `src/routes/Holidays.tsx:308-316` | Yes. `holidays-added-elsewhere`, naming the year and linking to it, computed from the **stored** row's date via `yearOf` (`:78`, used at `:220` and `:234`) rather than from the typed value. |
| § 4.5 existing selectors keep their names | `src/routes/Holidays.tsx:184,196,272,278,282,322,326,341,344,348,463,470` | Yes. All twelve ADM-02 selectors present and unrenamed, which is why the eleven ADM-02 tests pass unedited. |
| § 5 seam parity | `tests/seam-parity.test.ts`, absent from `git diff --name-only` | Yes. Unedited, and green in the 125-test run. |
| § 6 migration, four objects | `supabase/migrations/20260905140000_adm03_holiday_writes.sql:35-63` | Yes — see R6. |

`yearOf` (`src/routes/Holidays.tsx:78`) is a string slice and not a `Date`, which is the correct
reading of ADR-015's timezone consequence: `new Date('2027-01-01').getFullYear()` is 2026 west of UTC
and would send an admin to the wrong year to look for the row they just added.

**The one behaviour beyond an AC, and it is declared.** `03-impl-log.md` Open question 2 records that
the out-of-year notice also fires on an **edit** that moves a row out of the displayed year
(`src/routes/Holidays.tsx:232-235`). AC-4 names the add only. It is one line, renders no new selector,
adds no criterion, answers the identical surprise, and was declared rather than left for this check to
find — it is not scope growth and does not fail R5.

## R7 detail

`invariants_touched: []` (`ticket.yaml:39`), agreeing with the ADM-03 row in `features.md`. Per the
template, each ID is reasoned through individually rather than dismissed as a group.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — two entries of one member may not cover the same portion of a date | Nothing in this ticket reads, writes or derives an `entry`. The three writes touch `public.holiday` only, and the mock's `entries` array is not referenced by any of them. | `supabase/migrations/20260905140000_adm03_holiday_writes.sql:35-63`; `src/lib/data/mock.ts:1224-1290` |
| INV-02 — an approved entry returns to `pending` on an edit | Same. `holiday` has no approval state: its columns are `id`, `date`, `name`, `kind`, `created_at`, and `updateHoliday` assigns exactly `date`, `name` and `kind`. | `src/lib/data/mock.ts:1270-1272`; `src/lib/data/supabase.ts:1207` |
| INV-03 — a rejected entry carries a rejection reason | Same. No rejection path exists on this table and none is added. | `src/lib/data/index.ts:574-599` |
| INV-04 — one definition of the absence count | The count is `src/lib/data/absence.ts`, which is untouched and absent from `allowed_paths`. No arithmetic over dates exists in any file this ticket wrote — `yearOf` is a `String.slice` and is the only date operation added. | `src/routes/Holidays.tsx:78`; `ticket.yaml:110-119` |
| INV-05 — a tentative entry counts as a non-tentative one does | Same. `holiday` has no `tentative` column, and CAL-07's warning is not consulted, suppressed or modified: `src/lib/draft-entry.ts` and `src/components/OverloadWarning.tsx` appear neither in `git diff --name-only` nor in the untracked list. | `git diff --stat` — seven files, none of them these |
| INV-06 — one portion per entry | Same. `holiday` has no portion. `HolidayFormValues` carries `date`, `name`, `kind` and nothing else. | `src/components/HolidayForm.tsx:45-49` |
| INV-07 — every entry belongs to one member and is counted against that member's team | The one an agent would reach for, and it does not hold here: a holiday row has neither a member nor a team, which is the step ADR-015 § *Rationale* examined and refused when a `team_id` was proposed. The three policies carry no team conjunct **because there is no column**, not because one was omitted. | `supabase/migrations/20260905120000_adm02_holiday.sql:33` (the table's columns); `supabase/migrations/20260905140000_adm03_holiday_writes.sql:25-30` |

`unique (date)` is load-bearing and is correctly **not** treated as a registry invariant: it carries
no ID in `.ai/registry/invariants.md:33-39`, and inventing one would be the invention `CLAUDE.md`
§ *Working agreements* forbids. It is held as behaviour by AC-6 and AC-7 —
`tests/holiday-writes.test.ts:182`, `:202`, `:221`, `:243`.

## R6 detail — the permission gating, against § 3

**The control is in the datastore, and it is the whole check.**

- `holiday_insert_admin` — `supabase/migrations/20260905140000_adm03_holiday_writes.sql:35-37`,
  `for insert to authenticated with check (public.is_admin((select auth.uid())))`.
- `holiday_update_admin` — `:43-46`, **both** `using` and `with check`, as § 6 requires.
- `holiday_delete_admin` — `:48-50`.
- `grant insert, update, delete on public.holiday to authenticated` — `:63`. Not inherited:
  `supabase/migrations/20260905120000_adm02_holiday.sql:46` revokes all and `:48` grants `select`
  alone, so the plan's claim that the policies would otherwise sit over an unwritable table is
  correct as written.
- All three are `to authenticated` and none is `to public`, so the anon key that ships in the bundle
  writes nothing.

**The three claims the migration's comments make about files outside this ticket, each verified on
disk:**

1. `public.is_admin` filters `removed_at is null` inside its own body —
   `supabase/migrations/20260831150024_tea01_membership.sql:54-62`. AC-16 is inherited from the
   function rather than repeated in three predicates.
2. `grant execute on function public.is_admin(uuid) … to authenticated` already exists at
   `supabase/migrations/20260831150024_tea01_membership.sql:71`. The migration correctly adds no
   second grant.
3. `unique (date)` is on the table already —
   `supabase/migrations/20260905120000_adm02_holiday.sql:33` (`date date not null unique`). This
   ticket creates no constraint.

**No team conjunct, and it is warranted rather than missing.** `holiday` has no `team_id`
(`20260905120000_adm02_holiday.sql:33` and the columns around it), so there is nothing to scope. The
consequence is recorded and accepted in ADR-015 § *Rationale* and restated at the migration's
`:25-30`. R6 reads it as the plan asks: a warranted absence, not an oversight.

**The permission table gained no row (AC-17).** `.ai/standards/rbac-and-security.md` is not in
`allowed_paths` and does not appear in `git diff --name-only`. Lines 38-39 still read
`| Read the holiday calendar | ✅ | ✅ |` and
`| Add, edit or delete a holiday or swap day | ❌ | ✅ |`.

**The affordance matches the policy and is only an affordance.** `mayWrite` at
`src/routes/Holidays.tsx:212` is `me !== null && me.removedAt === null && me.role === "admin"` — the
same three conditions `public.is_admin` applies — and it gates the add form (`:294`), the two row
controls (`:357`), the inline edit (`:391`) and the delete confirmation (`:411`). It gates no read:
`view.phase === "ready"` is reached without it (`:154`), so a member, and a signed-in caller with no
member row, still get the whole calendar (AC-14, AC-18).

**The mock reproduces the policy and not the screen**, which is what stops AC-14 through AC-16 passing
against nothing. All three writes call `currentAdmin()` first (`src/lib/data/mock.ts:1225`, `:1256`,
`:1282`), and that helper filters `removedAt === null` and `role === "admin"` at
`src/lib/data/mock.ts:258-261`. It applies **no** team check, matching the three policies —
`FIXTURE_OTHER_TEAM`'s admin is admitted in the mock exactly as the datastore admits them.

**The refusals are asserted below the interface**, where the browser cannot reach:
`tests/holiday-writes.test.ts:264` (a member refused all three), `:292` (a caller with no member row),
`:307` and `:343` (a removed caller, whatever their `role` column says).

### Test runs, this session

| Command | Result |
|---|---|
| `pnpm exec tsc --noEmit` | exit 0 |
| `pnpm exec eslint .` | exit 0 |
| `pnpm exec vitest run` | exit 0 — 6 files, 125 tests passed |
| `pnpm exec playwright test` | exit 0 — 134 passed, 0 failed |
| `pnpm exec playwright test tests/e2e/adm-02-holidays.spec.ts` | 12 passed (the eleven ADM-02 tests, plus the `seam-guard` setup) |
| `pnpm exec playwright test tests/e2e/adm-03-holiday-writes.spec.ts` | 16 passed (the fifteen ADM-03 tests, plus the `seam-guard` setup) |

The counts reproduce `03-impl-log.md` § *Verification run* exactly.

### R8 detail — dependencies

`package.json` is absent from `git diff --name-only` and from the untracked list; so is
`pnpm-lock.yaml`. The eight runtime and seventeen dev dependencies at `package.json:16-42` are the
ones this branch inherited. Nothing was added, so no ADR is owed.

## Findings

None. No check failed and there is no routing row to apply.

## Verdict

**PASS.** `gate: PASS`, `next_state: DONE`.

The one thing the ship session must act on rather than inherit: `.env.example` is untracked, is
outside `allowed_paths`, and belongs to no ticket. `/ship` names it and leaves it dirty
(`CLAUDE.md` § *Working agreements*, ADR-023). It is not a finding against ADM-03.
