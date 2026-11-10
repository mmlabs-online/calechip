---
ticket: CAL-07
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-05T01:18:47+07:00
inputs_read:
  - .ai/board/tickets/CAL-07/01-plan.md
  - .ai/board/tickets/CAL-07/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/steward/context.md
  - src/lib/data/absence.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/components/EntryForm.tsx
  - src/routes/EditEntry.tsx
  - src/routes/NewEntry.tsx
  - src/routes/MonthView.tsx
  - src/routes/TeamEntries.tsx
  - src/routes/Home.tsx
  - tests/absence.test.ts
  - tests/ui-language.test.ts
  - tests/e2e/seam.setup.ts
  - tests/e2e/cal-01-create-entry.spec.ts
  - tests/e2e/cal-03-admin-edit-entry.spec.ts
  - tests/e2e/cal-04-month-view.spec.ts
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260905000000_adm01_team_threshold.sql
  - eslint.config.js
  - ui-language.json
  - vitest.config.ts
  - playwright.config.ts
  - tsconfig.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CAL-07 — implementation log

## Files touched

Six files, all inside `allowed_paths`; four created. Nothing outside it was written, and
`src/routes/NewEntry.tsx` and `src/routes/MonthView.tsx` are untouched exactly as section 7 requires
— both render the warning through `EntryForm` with no edit, because the optional props' defaults are
the correct values on those two surfaces.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/draft-entry.ts` | created | the unsaved draft as an `Entry` row, plus the range test, so the prospective count is `absenceCountsFor`'s arithmetic and not a second one | § 4.1 |
| `src/components/OverloadWarning.tsx` | created | the block itself: three reads on mount, one debounced range read, the composition, and the per-date render | § 4.2, § 4.3 |
| `src/components/EntryForm.tsx` | modified | two optional props and one element between the note field and the error paragraph — the one place all three surfaces meet | § 4.4 |
| `src/routes/EditEntry.tsx` | modified | `ownerId={entry.memberId}` and `excludeEntryId={entry.id}`, the two values AC-17 and AC-18 turn on | § 4.5 |
| `tests/draft-entry.test.ts` | created | the pure half: AC-4, AC-5, AC-8, AC-17, AC-18, AC-20, and AC-14 against the real migrations | § 7 |
| `tests/e2e/cal-07-overload-warning.spec.ts` | created | the interface half: what a person sees, and the save control beside it | § 7 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 `DraftEntryInput` | `src/lib/draft-entry.ts:27` | six fields, exactly as specified; declared here and not in `domain/types.ts`, which is XL |
| § 4.1 `DRAFT_ENTRY_ID` | `src/lib/draft-entry.ts:43` | `"draft"`, and deliberately not a uuid |
| § 4.1 `withDraft` | `src/lib/draft-entry.ts:71` | excludes then appends; every non-draft field fixed to the values § 4.1 names |
| § 4.1 `isUsableRange` | `src/lib/draft-entry.ts:108` | both dates present and not inverted, compared as strings |
| § 4.2 `OverloadWarningProps` | `src/components/OverloadWarning.tsx:57` | eight props, the names and nullability of the contract |
| § 4.2 the four reads | `src/components/OverloadWarning.tsx:116-140` | `getTeam`, `listMembers` and — only when `ownerId` is null — `getCurrentMember`, once on mount; `listTeamEntriesOverlapping` on every usable range |
| § 4.2 the debounce | `src/components/OverloadWarning.tsx:55` | 300 ms, named once as `DEBOUNCE_MS` |
| § 4.2 the stale-answer guard | `src/components/OverloadWarning.tsx:150-180` | a monotonic request number; the effect's cleanup bumps it, so a range change invalidates the read in flight |
| § 4.2 the composition | `src/components/OverloadWarning.tsx:183-205` | `withDraft` then `absenceCountsFor`, `absentEntriesFor`, `currentMemberCount`, `isOverloaded` — in that order, all four CAL-04's |
| § 4.2 renders `null` unless crowded | `src/components/OverloadWarning.tsx:211` | one early return covering in-flight, failed, unusable and uncrowded |
| § 4.3 the region | `src/components/OverloadWarning.tsx:214-225` | `role="status"`, `aria-live="polite"`, `bg-rose-100` |
| § 4.3 the day block | `src/components/OverloadWarning.tsx:227-241` | `data-date`, `data-count`, `data-current-members`, one per crowded date, ascending |
| § 4.3 the person marker | `src/components/OverloadWarning.tsx:246-270` | month-grid vocabulary: peach/mint, dashed at reduced opacity when tentative, star when approved |
| § 4.4 `ownerId?` / `excludeEntryId?` | `src/components/EntryForm.tsx:92`, `:96`, `:112` | optional, defaulting to null in the destructuring |
| § 4.4 the element's position | `src/components/EntryForm.tsx:269` | between the note field and the error paragraph; the submit button below is byte-for-byte unchanged |
| § 4.5 the edit route | `src/routes/EditEntry.tsx:154-155` | the entry's `memberId` and `id`; nothing else on that screen changed |
| § 5 seam impact: none | — | no file under `src/lib/data/` was touched; `tests/seam-parity.test.ts` and `tests/absence.test.ts` pass unedited |
| § 6 schema delta: none | — | no file under `supabase/` was touched; AC-14 asserts it from the migrations themselves |

## Deviations from the design

**One addition, and no deviation.**

- **`data-type` on `<prefix>-overload-person`**, beyond the four attributes § 4.3's table names.
  § 4.3 requires the marker to be drawn PTO peach and WFH mint, and
  `.ai/standards/testing-standards.md` § *What makes a test bad here* forbids asserting on a style
  class — so without this attribute that requirement is unobservable through the interface and would
  ship with no coverage. It is the same shape as the `data-created-at` / `data-updated-at` additions
  CAL-02 and CAL-03 declared here before it. Nothing reads it but the acceptance suite.

Everything else is as § 4.1 to § 4.5 specify, including the two absences that carry the most weight:
no line was added to `src/lib/data/absence.ts`, and no seam signature was touched.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The prospective count is `absenceCountsFor(withDraft(...), range, roster)` and nothing else. There is no `+ 1` and no `weight(portion)` anywhere in this ticket's code — `src/lib/draft-entry.ts` builds a ROW and computes nothing, so INV-04 keeps exactly one implementation and it is CAL-04's. `tests/draft-entry.test.ts` asserts through that function rather than against the array, so a draft the counter ignored would fail rather than pass. The strict `>` stays in `isOverloaded`: AC-3 is asserted at 2.0 of 4, the boundary the fixture team makes reachable. |
| `INV-05` | `walk` in `absence.ts` never reads `tentative`, and this ticket adds no branch on it either: `withDraft` carries the flag through so the marker can be drawn dashed, and the count is identical ticked and unticked. Asserted twice — `tests/draft-entry.test.ts` § AC-8 on the number, and the acceptance suite on the screen. |
| `INV-07` | The draft is attributed to a named member on every path: the caller on create (resolved once, on mount, by `getCurrentMember`), the entry's OWNER on edit (`EditEntry.tsx:154`). A draft whose member is not on the roster counts for nobody — `countsOn` refuses it — and that silent outcome is asserted rather than left to be discovered, because a warning missing a person says nothing about why. The write path is untouched: `member_id` is still absent from `UpdateEntryInput` and supplied by `entry_insert_own`'s `with check`. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| typecheck (`pnpm exec tsc --noEmit`) | 0 | |
| lint (`pnpm exec eslint .`) | 0 | includes RULE-02's import ban and § Language — the two new files are NOT on `ui-language.json`'s `copyDebt`, so every string they render is English |
| unit (`pnpm exec vitest run`) | 0 | 5 files, **108 tests, all pass** — 81 before this ticket, 27 added by `tests/draft-entry.test.ts`. `tests/absence.test.ts` and `tests/seam-parity.test.ts` are unedited |
| end-to-end (`pnpm exec playwright test`) | 0 | **108 tests, all pass** (13 of them this ticket's, plus the seam guard), across every suite in the repository. CAL-01's, CAL-02's, CAL-03's, CAL-04's, CAL-05's, CAL-06's, ADM-01's, TEA-01's and TEA-05's suites pass UNEDITED with the warning now rendering inside every `EntryForm` |
| `node scripts/check-allowed-paths.mjs` | 0 | reports 0 changed files, because it diffs `origin/main...HEAD` and a ticket is not committed until /ship (ADR-006). The list was checked by hand against `git status --porcelain` instead: the six paths above, plus `ticket.yaml` and `01-plan.md` in the ticket's own folder |
| `node scripts/check-docs.mjs` | 0 | 0 errors, 2 pre-existing D8 warnings, unchanged by this ticket |
| `git diff --name-only` subset of `allowed_paths` | yes | verified by hand, as above |

## Testability contract

01-plan.md carries no numbered selector table for this ticket; § 4.3's table is the equivalent and
this is where those selectors now exist. `<prefix>` is `new-entry`, `edit-entry` or `month-entry` —
the same three families `EntryForm` already renders, so the warning inherits all three and the
drag-to-declare panel in `MonthView` gets it with no edit.

| selector | Exists at |
|----------|-----------|
| `<prefix>-overload` | `src/components/OverloadWarning.tsx:215` |
| `<prefix>-overload-day` | `src/components/OverloadWarning.tsx:229` |
| `<prefix>-overload-person` | `src/components/OverloadWarning.tsx:248` |

Attributes: `data-date`, `data-count`, `data-current-members` on the day; `data-member-id`,
`data-status`, `data-tentative`, `data-draft` and the declared addition `data-type` on the person.

## Open questions

1. **The board skipped `READY` and `IN_PROGRESS`, and the `plan` gate row still reads
   `passed: false`.** 01-plan.md's front-matter carries `gate: PASS` and `next_state: READY`, but
   `ticket.yaml` was still `state: BACKLOG` when this stage began — /implement was invoked directly
   rather than through /next-ticket, so the orchestrator never graded the Definition of Ready and
   never advanced the board. This stage set `state: REVIEW` as /implement requires and left the gate
   row alone: a gate row is a claim that a grading happened, and writing one for a grading nobody
   performed would be worse than the gap. It is the orchestrator's to reconcile, and `ticket.yaml`
   carries the same note beside the field.
2. **AC-15 and AC-21 have no test, and both absences are deliberate.** AC-15 is a claim about
   `.ai/standards/rbac-and-security.md`, which is not in `allowed_paths` and which RULE-03 forbids
   this ticket to touch — the diff is the evidence and a test could only restate it. AC-21 needs a
   read that fails or that the seam refuses as truncated: the mock's entry table is bounded by the
   fixtures and cannot reach `MONTH_ENTRY_LIMIT`, and no test can make PostgREST cap a read without a
   provisioned project. It is the same untested shape CAL-04 AC-11 already carries. The component's
   behaviour in both cases is one early return and is stated at
   `src/components/OverloadWarning.tsx:211`.
3. **AC-14 lives in `tests/draft-entry.test.ts`, which is a placement decision rather than a natural
   home.** It reads `supabase/migrations/**` and has nothing to do with drafts, but that file is the
   only unit path in `allowed_paths`. It reads the real migrations and carries a positive control
   that injects the breach into a copy of a real file, which is what
   `.ai/standards/testing-standards.md` § *Fixtures that share the implementation's assumptions*
   requires of a check whose target is a specific real file. If a later ticket gives the migrations a
   test file of their own, this block belongs there.
4. **AC-12's timing half is not forced.** The acceptance test fills both dates and clicks save with
   no wait, but whether the read has resolved by the time the click lands is not something a browser
   test can control. What makes AC-12 true is structural and stated in the design: the component
   holds no submit state and renders nothing while the count is unresolved, so there is nothing that
   could defer a submit. The test asserts the observable consequence — the entry is stored — and the
   spec file says so where it is asserted.
5. **Open question 3 of 01-plan.md ships as written.** A note-only edit of a `rejected` entry counts
   that entry in the warning, because the draft is `pending` on every path. Reproducing
   `entry_enforce_decision()`'s substantive-edit test in TypeScript would be a second implementation
   of INV-02, which is the failure one invariant over. No code here narrows or widens that case.
