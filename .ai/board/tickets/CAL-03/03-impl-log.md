---
ticket: CAL-03
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-03T14:59:43+07:00
inputs_read:
  - .ai/board/tickets/CAL-03/01-plan.md
  - .ai/board/tickets/CAL-03/ticket.yaml
  - .ai/standards/architecture.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/standards/ui-design-system.md
  - 3ccbd37:.ai/standards/ui-design-system.md
  - .ai/steward/context.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260903143000_cal02_own_entry_writes.sql
  - supabase/seed.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/EditEntry.tsx
  - src/routes/NewEntry.tsx
  - src/routes/Home.tsx
  - src/routes/MemberList.tsx
  - src/routes/AllowList.tsx
  - src/components/EntryForm.tsx
  - src/App.tsx
  - tests/e2e/cal-01-create-entry.spec.ts
  - tests/e2e/cal-02-edit-delete-entry.spec.ts
  - tests/e2e/seam.setup.ts
  - tests/seam-parity.test.ts
  - playwright.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CAL-03 — implementation log

## Files touched

Twelve files, twelve `allowed_paths` globs, no file outside them. Three are created.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260903160000_cal03_admin_entry_writes.sql` | created | The two policies that ARE this feature. Everything else in this table is the way to reach them. | §6 |
| `supabase/seed.sql` | modified | One entry owned by the other team's member. AC-8 has nothing to be refused against without it. | §7 |
| `src/lib/fixtures.ts` | modified | `FIXTURE_OTHER_TEAM_ENTRY`, the same literals as the seed row above — the drift this module exists to prevent. | §7 |
| `src/lib/domain/types.ts` | modified | `TEAM_ENTRY_LIMIT`, the row cap `listTeamEntries` asks for. Here and not in `src/lib/data/` because both implementations need it at runtime and `index.ts` imports them both. | §4.1 |
| `src/lib/data/index.ts` | modified | `listTeamEntries()` on `DataSeam`. The one contract item; no write is added. | §4.1 |
| `src/lib/data/supabase.ts` | modified | The real `listTeamEntries` — an unfiltered select scoped by `entry_select_team`, with the truncation assertion. | §4.1, §5 |
| `src/lib/data/mock.ts` | modified | The mock's `listTeamEntries` WITH an explicit team filter, and `updateEntry`/`deleteEntry` widened to the admin. Section 5 names this as the ticket's subtle shape. | §4.1, §5 |
| `src/routes/TeamEntries.tsx` | created | The screen. An admin needs a way to *reach* another member's row and no such read existed. | §4.3 |
| `src/routes/EditEntry.tsx` | modified | Chooses its read by the caller's role, so one edit screen serves both and there is no admin copy of the form. | §4.3 |
| `src/routes/Home.tsx` | modified | The admin-only link to `/entries/team`, beside the allow-list link and under the same condition. | §4.3 |
| `src/App.tsx` | modified | The `/entries/team` route, guarded on membership `member` and NOT on `admin` — see *Deviations*, item 3. | §4.3 |
| `tests/e2e/cal-03-admin-edit-entry.spec.ts` | created | The twelve criteria. | §2 |

**Not touched, and each absence is section 7's:** `src/components/EntryForm.tsx`, `src/routes/NewEntry.tsx`, `src/routes/MemberList.tsx`, `src/routes/AllowList.tsx`, every shipped migration, `tests/seam-parity.test.ts`, and CAL-01's and CAL-02's suites. All five test files pass **unedited** — see *Verification run*.

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 `listTeamEntries(): Promise<Entry[]>` | `src/lib/data/index.ts:374` | Declared verbatim, comment included. |
| §4.1 — real | `src/lib/data/supabase.ts:824` | No filter of any kind; `entry_select_team` is the only scope. Two `order` calls; `limit(TEAM_ENTRY_LIMIT)` with the raise at line 843. |
| §4.1 — mock | `src/lib/data/mock.ts:958` | Filters by team explicitly, because the mock has no policy. |
| §4.1 `TEAM_ENTRY_LIMIT` | `src/lib/domain/types.ts:215` | 2000, with the `TODO(verify):` on the datastore's `max-rows` carried forward as written. |
| §4.1 — no write added | `src/lib/data/supabase.ts` (unchanged bodies) | `updateEntry` and `deleteEntry` are not touched in the real implementation, not one character. That is the section's own claim, and the diff is the evidence. |
| §4.2 failure mapping | unchanged | No failure code added. `toEntryFailure` and `FailureCode` are untouched; `entry_not_permitted` now covers "another team's" as well, as the section requires. |
| §4.3 `/entries/team` | `src/App.tsx:148`, `src/routes/TeamEntries.tsx` | |
| §4.3 EditEntry chooses its read | `src/routes/EditEntry.tsx:69` | |
| §4.3 Home link | `src/routes/Home.tsx:90` | |
| §5 seam parity | `tests/seam-parity.test.ts` (unedited) | Passes: same names, same arity. |
| §5 mock team scoping | `src/lib/data/mock.ts:315-347, 958` | `memberTeamId`, `sameTeam`, `adminMayReach`, `ownsEntry`. |
| §6 `entry_update_admin` | migration line 80 | `using` carries `is_admin` and the team predicate; `with check` carries the team predicate alone. |
| §6 `entry_delete_admin` | migration line 101 | No `with check`. |
| §6 the five absences | migration, header comment | No insert policy, no grant, no edit to CAL-02's policies, no change to `entry_enforce_decision()`, no shipped migration edited. |
| §7 fixtures | `src/lib/fixtures.ts:380`, `supabase/seed.sql` | |

## Deviations from the design

Four, all additive, none changing a decision in sections 1 to 8.

1. **`src/routes/TeamEntries.tsx` renders its strings in ENGLISH while every neighbouring screen is Vietnamese.** `.ai/standards/ui-design-system.md` § *Language* — commit `3ccbd37`, quoting the operator's instruction of 2026-09-03 — says every rendered string is English, including the `message` half of every seam failure. **That commit is on `ops/ui-language-english`, which is not merged, so the file on THIS branch is the 52-line stub with no § Language at all.** Writing fresh Vietnamese copy one hour after the rule was recorded would be writing something already decided to be wrong, so the new screen is English and no existing file was translated — the chore commit itself defers the thirteen files that carry Vietnamese copy, and none of them is this ticket's to fix. **The consequence is a genuinely mixed product**: `TYPE_LABELS`, `PORTION_LABELS` and `STATUS_LABELS` in `TeamEntries.tsx:44-63` duplicate the Vietnamese maps in `EntryForm.tsx` and `NewEntry.tsx` rather than importing them, because those files are outside `allowed_paths`. `edit-entry-*` copy is untouched for the same reason, so an admin who clicks *Edit* moves from an English list to a Vietnamese form. A `product` idea raised during this run — `.ai/board/ideas/2026-09-03-the-interface-and-its-standard-speak-different-languages.md` — is about exactly this and is not mine to act on. **The reviewer should decide whether R6 accepts the split or wants the screen in Vietnamese pending that merge.**
2. **`src/routes/EditEntry.tsx` gains a SECOND back link, `edit-entry-team-back`, shown only to an admin.** Section 4.3 says "one change" to this file. `edit-entry-back` keeps its name, its destination and its position — `tests/e2e/cal-02-edit-delete-entry.spec.ts` clicks it and expects the own-entry form, and that suite must pass unedited. Without the addition an admin who arrives from the team list is returned to their OWN entries, which is the screen forgetting where they came from. Four lines, one condition.
3. **The `/entries/team` route is guarded on membership `member`, not on `admin`.** Section 4.3 says "Guarded like `/entries/new`", which is what this is; the note is that the guard deliberately does NOT check the role. A member who types the address must reach the component and be refused BY it (`team-entries-refused`, AC-10) rather than be bounced to `/` — a redirect leaves somebody who mistyped nothing to read, and AC-10 is written about a refusal rather than a redirect.
4. **Selectors beyond the section 4.3 table**, each declared here: `team-entries-loading`, `team-entries-unavailable`, `team-entry-delete-cancel`, `team-entry-delete-error`, `team-entries-back`, `edit-entry-team-back`, `home-team-entries-link`, and the `data-member-id` / `data-created-at` / `data-updated-at` attributes on `team-entry-row`. The three attributes are AC-7's and AC-11's only observation surface; the loading and unavailable states are the four-phase shape `MemberList.tsx` established, and folding either into `refused` would tell an admin they are not one.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-01` | Held by `entry_no_overlapping_portion`, unchanged. **The one line that had to move is `src/lib/data/mock.ts:855`**, where the clash comparison now keys on `row.memberId` and not on `me.id`. Those were the same value through CAL-02 because the only editable row was the caller's own; they stop being the same the moment an admin edits somebody else's. The constraint keys on the ROW's `member_id`, so an admin's edit collides with THAT member's entries and never with the admin's own. AC-9 asserts both halves — the refusal against the owner's calendar, and the SUCCESS of a save onto a date the admin themselves is absent, which is the half a comparison written against the caller fails. |
| `INV-02` | Held by `public.entry_enforce_decision()`, which this ticket **changes not at all** — no `create or replace` anywhere in the migration. It is actor-blind by decision (ADR-016 §2) and stays so: AC-3 observes an admin's substantive edit producing the owner's own reset, and AC-4 observes the note-only carve-out surviving. The mock's reproduction at `mock.ts:865-885` is CAL-02's and was not edited. No actor carve-out was added, here or anywhere. |
| `INV-06` | Column shape, untouched. `portion` is still a single not-null enum on the row; an admin can change which portion applies and cannot make it vary by date, because there is one column and the form offers one select. No column, constraint or enum is touched. |
| `INV-07` | Held by three things together, all in place. (a) `member_id` is absent from CAL-02's update grant and **no grant is added by this ticket**, so a statement naming the column is refused with `42501` before any policy runs. (b) `entry_update_admin`'s `with check` compares the NEW row's team to the caller's — redundant while (a) holds, kept as the second lock. (c) The not-null reference on `member_id`. `UpdateEntryInput` still carries no `memberId`, so the affordance agrees with the control: AC-7 finds no member field on the edit form and the row's `data-member-id` is unchanged after the save. |

**INV-03, INV-04 and INV-05 were not engaged**, as section 2 states: `rejection_reason` is not in the update grant and this ticket does not widen it; nothing here computes an absence count, reads a threshold, or reads a roster for counting.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | the command named in `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | same. RULE-02's seam rule included — `TeamEntries.tsx` imports `@/lib/data` and never an implementation |
| `pnpm exec vitest run` | 0 | 2 tests. `tests/seam-parity.test.ts` unedited: `listTeamEntries` present in both implementations at equal arity |
| `pnpm exec playwright test` | 0 | **56 passed**, including the seam guard. 13 are this ticket's |
| `pnpm exec playwright test tests/e2e/cal-01-create-entry.spec.ts tests/e2e/cal-02-edit-delete-entry.spec.ts` | 0 | ran as part of the 56, **unedited**. CAL-02's suite is the safety net section 4.3 names for the `EditEntry.tsx` change |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS. Reports `0 changed file(s)` because it diffs `origin/main...HEAD` and nothing is committed until `/ship` — every touched path was checked against the twelve globs by hand as well |
| `git diff --name-only` subset of `allowed_paths` | yes | The only dirty paths outside them are `ticket.yaml` and `01-plan.md`, which are PLAN's, and the `product` idea named in *Deviations* item 1, which is not this session's |

## Testability contract

| selector | Exists at |
|----------|-----------|
| `team-entries` | `src/routes/TeamEntries.tsx:206` |
| `team-entry-row` | `src/routes/TeamEntries.tsx:210` |
| `team-entry-row-member` | `src/routes/TeamEntries.tsx:227` |
| `team-entry-row-dates` | `src/routes/TeamEntries.tsx:235` |
| `team-entry-row-status` | `src/routes/TeamEntries.tsx:247` |
| `team-entry-row-edit` | `src/routes/TeamEntries.tsx:259` |
| `team-entry-row-delete` | `src/routes/TeamEntries.tsx:289` |
| `team-entry-delete-confirm` | `src/routes/TeamEntries.tsx:269` |
| `team-entries-refused` | `src/routes/TeamEntries.tsx:148` |
| `team-entries-empty` | `src/routes/TeamEntries.tsx:200` |
| `team-entries-loading` (added) | `src/routes/TeamEntries.tsx:134` |
| `team-entries-unavailable` (added) | `src/routes/TeamEntries.tsx:162` |
| `team-entry-delete-cancel` (added) | `src/routes/TeamEntries.tsx:278` |
| `team-entry-delete-error` (added) | `src/routes/TeamEntries.tsx:193` |
| `team-entries-back` (added) | `src/routes/TeamEntries.tsx:307` |
| `home-team-entries-link` (added) | `src/routes/Home.tsx:90` |
| `edit-entry-team-back` (added) | `src/routes/EditEntry.tsx:192` |

`data-entry-id`, `data-member-id`, `data-type`, `data-portion`, `data-created-at` and `data-updated-at` are on `team-entry-row` at `src/routes/TeamEntries.tsx:210-221`.

## Open questions

1. **The language split is the one thing a human should look at before this merges.** *Deviations* item 1 has the whole of it. The rule exists and is quoted from the operator; it is on an unmerged branch; the new screen follows it and its neighbours do not.
2. **`tests/permission-model.test.ts` still does not exist**, and CAL-03 is the ticket where its absence costs the most. AC-5 is written as "a member issues an edit and is refused", and through a browser a member cannot issue it at all — the form never renders — so what the suite observes is *neither can be attempted*. The spec says so at the assertion rather than in a footnote. Section 3's own words apply: the team predicate in both policies is the half with no test behind it, which is why the migration puts it in writing.
3. **AC-8 is asserted against seeded data, not a second team's session**, because exactly one team exists in v1. A one-team fixture passes whether the team predicate is in `entry_update_admin` or absent from it. `FIXTURE_OTHER_TEAM_ENTRY` narrows the gap — the cross-team row is now *visible to the test as absent* rather than not existing — and does not close it. ADR-018's revert condition names the same limitation for TEA-03's read.
4. **Known weakness 3 in `.ai/standards/rbac-and-security.md` is now true rather than hypothetical.** This ticket ships the capability and does not close it: `updated_at` moves and says *when*, never *who*, and AC-11 asserts that absence deliberately. `data-model.md` OPEN QUESTIONS item 5 offers `updated_by`; it is a schema change and RULE-09 makes it the operator's. The standard's text is owed a human amendment (standards plane, RULE-01) and is correctly absent from `allowed_paths`.
5. **The past-date question is still open** — `.ai/registry/features.md:87`, unchanged through CAL-01, CAL-02 and this ticket. It names editing, so it reaches an admin's edit too. No rule was implemented in either direction.
