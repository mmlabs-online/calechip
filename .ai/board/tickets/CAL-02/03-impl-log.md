---
ticket: CAL-02
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-03T13:44:00+07:00
inputs_read:
  - .ai/board/tickets/CAL-02/01-plan.md
  - .ai/board/tickets/CAL-02/ticket.yaml
  - .ai/standards/architecture.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - .ai/steward/context.md
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/seed.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/NewEntry.tsx
  - src/routes/Home.tsx
  - src/App.tsx
  - tests/e2e/cal-01-create-entry.spec.ts
  - tests/e2e/seam.setup.ts
  - tests/seam-parity.test.ts
  - playwright.config.ts
  - eslint.config.js
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CAL-02 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260903143000_cal02_own_entry_writes.sql` | created | The two policies, the two grants and the one line added to `entry_enforce_decision()`. Every control in this ticket is here and nowhere else (ADR-005). | §6 items 1-4 |
| `supabase/seed.sql` | modified | One account and one `approved` entry. AC-5 and AC-6 edit an approved entry and **nothing in the product can create one** — `status` is withheld from both grants and ADM-05 does not exist. | §7 |
| `src/lib/fixtures.ts` | modified | The same three literals the seed inserts, as `FIXTURE_APPROVED_MEMBER`, `FIXTURE_APPROVED_ENTRY` and `FIXTURE_APPROVED_MEMBER_CREDENTIAL`. A fixture with no seed row behind it is the drift this module exists to prevent. | §7 |
| `src/lib/data/index.ts` | modified | `UpdateEntryInput` and the two seam functions, with the reasoning that keeps `memberId`, `status` and `rejectionReason` off the DTO. | §4.1 |
| `src/lib/data/supabase.ts` | modified | The real `updateEntry` and `deleteEntry`, both counting returned rows rather than trusting `!error`; `toEntryFailure` now takes the one sentence that names a verb. | §4.1, §4.2 |
| `src/lib/data/mock.ts` | modified | The mock's `updateEntry` and `deleteEntry`, the owner comparison that makes AC-9 observable, and the seeded approved entry. | §4.1, §5 |
| `src/components/EntryForm.tsx` | created | The six fields extracted from `NewEntry.tsx` so both routes render one form. Selectors are built from a prefix, so `new-entry-*` keeps every name and position. | §4.3 |
| `src/routes/NewEntry.tsx` | modified | Renders the extracted form, and gains the edit link, the delete control and its confirmation on each own-entry row. | §4.3 |
| `src/routes/EditEntry.tsx` | created | The edit screen at `/entries/:id/edit`: loads from `listOwnEntries`, shows status and approver, refuses an entry that is not the caller's. | §4.3 |
| `src/App.tsx` | modified | The `/entries/:id/edit` route, guarded exactly as `/entries/new` is. | §4.3 |
| `tests/e2e/cal-02-edit-delete-entry.spec.ts` | created | One named test per acceptance criterion, AC-1 to AC-12. | §2 |

Nothing else was touched. `tests/e2e/cal-01-create-entry.spec.ts` passes **unedited** against the
extracted form, which is what section 4.3 put it outside `allowed_paths` for.

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 `UpdateEntryInput` | `src/lib/data/index.ts:74` | Six fields, verbatim from the plan. A separate interface, not an alias of `CreateEntryInput`. |
| §4.1 `updateEntry` | `index.ts:326`, `supabase.ts:746`, `mock.ts:747` | Zero rows returned is `entry_not_permitted` in the real implementation; the mock reproduces it as an owner comparison. |
| §4.1 `deleteEntry` | `index.ts:339`, `supabase.ts:782`, `mock.ts:845` | The real one asks for the deleted representation with `.select()` and counts it — a filtered DELETE answers 200 with an empty body exactly as an UPDATE does. |
| §4.2 the failure mapping | `supabase.ts:258` | Same three codes on the same three SQLSTATEs. See *Deviations* for the sentence. |
| §4.3 `EntryForm` | `src/components/EntryForm.tsx` | Prefix-driven selectors; `new-entry-*` unchanged in name and position. |
| §4.3 `EditEntry` | `src/routes/EditEntry.tsx` | `edit-entry-status` at :134, `edit-entry-approved-by` at :144, `edit-entry-not-found` at :97. |
| §4.3 own-entry list controls | `NewEntry.tsx:175, :205, :185, :162` | edit link, delete, confirmation, status. |
| §5 seam impact | `tests/seam-parity.test.ts` passes | Two functions added; no existing signature, return type or behaviour changed. |
| §6 item 1, the update grant | migration `:41` | Six columns. `member_id`, `status` and `rejection_reason` withheld. |
| §6 item 2, `updated_at` | migration `:84` | Inside `entry_enforce_decision()`, **before** clause (c). |
| §6 item 3, `entry_update_own` | migration `:134` | `using` and `with check` both `member_id = (select auth.uid())`. |
| §6 item 4, `entry_delete_own` | migration `:148` | Plus `grant delete` at `:48` — both required, neither sufficient. |

**Clause (c) came through the `create or replace` character-identical.** Verified mechanically, not
by eye: the block from `-- INV-02, and the rejected-entry hole` to `end if;` was extracted from both
migrations and `diff`ed, with no differences. R8 can repeat that in one command.

## Deviations from the design

Four, all declared here.

1. **`toEntryFailure` takes the `entry_not_permitted` sentence as a parameter** (`supabase.ts:258`).
   Section 4.2 says the mapping is identical to CAL-01's, "the same three refusals with the same
   three sentences". The three **codes** are identical and callers branch on those. What could not
   stay identical is one sentence: CAL-01's is *"Không thể tạo đăng ký này."* — it names creating,
   and rendering it after a member presses save on an **edit** is the wrong message on the screen.
   That is the exact failure `supabase.ts` already records one function up, where `toEntryFailure`
   exists separately from `toPostgrestFailure` because one function answering two screens with one
   sentence gets one of them wrong. Three sentences now sit as constants beside the mapper:
   create, update, delete.

2. **A seeded member owns the approved entry** (`fixtures.ts:301`, `seed.sql`). Section 7 puts
   `supabase/seed.sql` and `src/lib/fixtures.ts` in `allowed_paths` for the approved entry and names
   no owner for it. `FIXTURE_MEMBER` cannot own it: `tests/e2e/cal-01-create-entry.spec.ts` asserts
   `own-entries-empty` for `thanh@example.com` and exact row counts for `quan@example.com`, and that
   suite must pass unedited. `FIXTURE_SECOND_ADMIN` would have avoided a new row but would have
   observed AC-5 and AC-6 as an **admin** editing their own approved entry, which the plan's Open
   questions item 3 deliberately keeps as a separate case. So a third member-role account was seeded.

3. **Five selectors beyond the section 4.3 table**, each with one job:
   `own-entry-delete-cancel` (a confirmation with no way out is a trap), `own-entry-delete-error` (a
   refused delete has to say so somewhere), `edit-entry-loading` (without it the not-found screen
   flashes on every valid load — the same reason `app-session-loading` exists), `edit-entry-back` (the
   edit screen would otherwise be a dead end, and the acceptance suite must return to the list
   client-side to re-read the seam), and `edit-entry-timestamps`. The own-entry row and that last
   span also carry `data-created-at` and `data-updated-at`, which is how AC-12 is observable without
   spending a row of the year view on two timestamps.

4. **`datesIntersect` in `mock.ts:292` widened** from `CreateEntryInput` to the two date fields it
   reads, so `updateEntry` uses the same comparison rather than a second one that could drift.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-01` | The exclusion constraint is untouched and is now REACHED on UPDATE for the first time — a constraint over `(member_id, date_range, portion_slots)` is evaluated on update exactly as on insert, and a hard delete releases the slots because nothing remains to intersect. AC-7 asserts the refusal, AC-4 asserts the release. The mock's second implementation excludes the row being edited (`mock.ts`, the `e.id !== row.id` clause): an entry cannot clash with itself, and without that every edit that kept its dates would be refused. |
| `INV-02` | Not reimplemented. `entry_enforce_decision()` was replaced only to add `new.updated_at := now()`, placed **before** clause (c), and clause (c) is character-identical to the CAL-01 migration — verified by `diff`, not by reading. AC-5 asserts the reset of `status`, `approved_by` and `approved_at`; AC-6 asserts the note carve-out. The mock reproduces the same comparison against the row as it stands, actor-blind, and clears `rejection_reason` with the rest because INV-03's biconditional refuses any transition off `rejected` that leaves the reason standing. |
| `INV-06` | `portion` is still one not-null enum on the row and there is still exactly ONE portion control on the form — the extraction moved it, it did not multiply it. An edit can change which portion applies to the whole range; nothing offers a per-date value. AC-2 exercises the change. |
| `INV-07` | `member_id` is absent from the update grant, so a statement naming it is refused with `42501` before any policy runs; `entry_update_own`'s `with check` is the second lock; `UpdateEntryInput` carries no `memberId`, so no caller of the seam has a value to pass. Three layers, and the type is the weakest of them on purpose. AC-8 observes it. |

`INV-03`, `INV-04` and `INV-05` stay out, as the plan states rather than omits: `rejection_reason` is
in no grant this ticket writes, so no permitted statement moves it; and nothing here counts, reads a
threshold, or reads a roster.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 1 file, 2 tests — seam parity, with the two new functions in it |
| `pnpm exec playwright test` | 0 | **44 passed**, 0 failed: the seam guard, CAL-01's 11 unedited, CAL-02's 13, and the TEA suites |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `git diff --name-only` subset of `allowed_paths` | yes | Eleven files plus this log and `ticket.yaml` |

**The migration was NOT applied.** Applying it is human — RULE-09 — and no project is provisioned, so
every refusal asserted end to end is asserted against the mock seam that BUG-001 pins the suite to.
The policies, the grants and the trigger line have been read, not executed.

## Testability contract

| selector | Exists at |
|----------|-----------|
| `new-entry-form` … `new-entry-submit` | `src/components/EntryForm.tsx:150-251`, under the `new-entry` prefix |
| `edit-entry-form` … `edit-entry-submit` | the same lines, under the `edit-entry` prefix |
| `edit-entry-status` | `src/routes/EditEntry.tsx:134` |
| `edit-entry-approved-by` | `src/routes/EditEntry.tsx:144` |
| `edit-entry-not-found` | `src/routes/EditEntry.tsx:97` |
| `edit-entry-loading` | `src/routes/EditEntry.tsx:82` |
| `edit-entry-back` | `src/routes/EditEntry.tsx:102`, `:163` |
| `edit-entry-timestamps` | `src/routes/EditEntry.tsx:155` |
| `own-entry-row-edit` | `src/routes/NewEntry.tsx:175` |
| `own-entry-row-delete` | `src/routes/NewEntry.tsx:205` |
| `own-entry-delete-confirm` | `src/routes/NewEntry.tsx:185` |
| `own-entry-delete-cancel` | `src/routes/NewEntry.tsx:194` |
| `own-entry-delete-error` | `src/routes/NewEntry.tsx:108` |
| `own-entry-row-status` | `src/routes/NewEntry.tsx:162` |
| `data-created-at` / `data-updated-at` on `own-entry-row` | `src/routes/NewEntry.tsx:133-134` |

## Open questions

1. **Past dates are still unanswered and still unimplemented in either direction**, on both screens.
   `TODO(project)` on `.ai/registry/features.md:87`, plan Open questions item 1. The date inputs
   carry no `min` and neither seam function carries a past-date check.

2. **`tests/permission-model.test.ts` still does not exist.** AC-8, AC-9 and AC-10 are observed
   end-to-end against the mock, not against a real PostgreSQL with a token per role. Pre-existing
   debt, recorded by CAL-01's plan and this one; not closed here.

3. **The mock's approved entry re-seeds on every page load**, because it lives in module memory. So a
   test cannot assert "the edit survived a reload" against this seam — AC-3's *"reloading the page
   does not bring it back"* is asserted instead by leaving the screen and returning client-side,
   which re-reads the seam. Written into the test as a comment so the next reader does not add the
   reload assertion and believe it proves something.

4. **`updated_at` in the mock is the browser's clock.** In the real datastore the value is
   `now()` inside the trigger, never a client's. The mock has no other clock, and the difference is
   invisible to AC-12 — but it is the kind of gap that matters the day somebody asserts an exact
   value rather than an ordering.
