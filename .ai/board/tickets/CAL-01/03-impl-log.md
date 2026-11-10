---
ticket: CAL-01
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-03T10:29:05+07:00
inputs_read:
  - .ai/board/tickets/CAL-01/01-plan.md
  - .ai/board/tickets/CAL-01/ticket.yaml
  - .ai/registry/rules.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/registry/decisions/ADR-022-the-qa-stage-is-removed.md
  - .ai/standards/data-model.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - .ai/standards/rbac-and-security.md
  - .claude/agents/developer.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260901120000_tea04_member_writes.sql
  - supabase/seed.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/fixtures.ts
  - src/App.tsx
  - src/routes/Home.tsx
  - src/routes/SignIn.tsx
  - src/routes/MemberList.tsx
  - tests/seam-parity.test.ts
  - tests/e2e/tea-05-sign-in.spec.ts
  - playwright.config.ts
  - vite.config.ts
  - scripts/check-allowed-paths.mjs
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# CAL-01 implementation log

## Files touched

Ten files. `supabase/seed.sql` is in `allowed_paths` and was **not** touched — see *Deviations*.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260903103000_cal01_entry.sql` | created | The whole of section 6: `btree_gist`, the three enums, `public.entry` with both generated columns, `entry_end_after_start`, INV-03's biconditional check, INV-01's exclusion constraint, `public.entry_enforce_decision()` in its INV-02-only form, the explicit revoke, the two grants and the two policies. | §6 steps 1-13 |
| `src/lib/domain/types.ts` | modified | `EntryType`, `EntryPortion`, `EntryStatus`, `Entry`, three `FailureCode` values and `OWN_ENTRY_LIMIT`. All additive; no existing type changed and no existing caller changed. | §4.1 |
| `src/lib/data/index.ts` | modified | Declares `CreateEntryInput` and the two seam functions on `DataSeam`. No existing signature touched. | §4.2 |
| `src/lib/data/supabase.ts` | modified | `EntryRow`, `ENTRY_COLUMNS`, `toEntry`, `toEntryFailure`, and the real `createEntry` and `listOwnEntries`. | §4.2, §4.3 |
| `src/lib/data/mock.ts` | modified | The in-memory `entries` table, ADR-011's slot semantics as an overlap test, and the mock `createEntry` and `listOwnEntries`. | §5 |
| `src/routes/NewEntry.tsx` | created | AC-1 to AC-11. The form, the nine form selectors, and the caller's own entry list that makes every criterion observable from outside the system. | §4.4 |
| `src/App.tsx` | modified | One route, `/entries/new`, guarded on membership state `member`. `app-root` and `seam-banner` keep their names and positions. | §4.4 |
| `src/routes/Home.tsx` | modified | One link to the new route, shown to both roles because the permission is the same for both. | §4.4 |
| `tests/e2e/cal-01-create-entry.spec.ts` | created | The acceptance suite: eleven tests, one per criterion except AC-12. Written by the Developer because ADR-022 removed QA and `.claude/agents/developer.md:33-35` now assigns unit and acceptance tests here. | §2, §4.4 |
| `.ai/board/tickets/CAL-01/ticket.yaml` | modified | `state: BACKLOG` to `REVIEW`, and the pre-ADR-022 four-gate block migrated to `plan` and `review` — see *Deviations* item 3. | — |

## Contract items

| §4 item | Implemented at | Matches the contract |
|---|---|---|
| §4.1 `EntryType` | [src/lib/domain/types.ts:148](../../../../src/lib/domain/types.ts#L148) | yes |
| §4.1 `EntryPortion` | [src/lib/domain/types.ts:151](../../../../src/lib/domain/types.ts#L151) | yes |
| §4.1 `EntryStatus` | [src/lib/domain/types.ts:154](../../../../src/lib/domain/types.ts#L154) | yes |
| §4.1 `Entry`, fourteen fields, no `date_range` / `portion_slots` | [src/lib/domain/types.ts:167](../../../../src/lib/domain/types.ts#L167) | yes |
| §4.1 `overlapping_entry`, `invalid_date_range`, `entry_not_permitted` | [src/lib/domain/types.ts:64-69](../../../../src/lib/domain/types.ts#L64-L69) | yes |
| §4.1 `OWN_ENTRY_LIMIT = 500`, with the `TODO(verify)` carried | [src/lib/domain/types.ts:194](../../../../src/lib/domain/types.ts#L194) | yes |
| §4.2 `CreateEntryInput`, six fields, no `memberId` and no decision column | [src/lib/data/index.ts:50](../../../../src/lib/data/index.ts#L50) | yes |
| §4.2 `createEntry` on `DataSeam` | [src/lib/data/index.ts:250](../../../../src/lib/data/index.ts#L250) | yes |
| §4.2 `listOwnEntries` on `DataSeam` | [src/lib/data/index.ts:270](../../../../src/lib/data/index.ts#L270) | yes |
| §4.2 `createEntry`, Supabase | [src/lib/data/supabase.ts:623](../../../../src/lib/data/supabase.ts#L623) | yes |
| §4.2 `listOwnEntries`, Supabase | [src/lib/data/supabase.ts:679](../../../../src/lib/data/supabase.ts#L679) | yes |
| §4.3 the three-row failure mapping, matched on SQLSTATE | [src/lib/data/supabase.ts:250](../../../../src/lib/data/supabase.ts#L250) | yes |
| §4.4 the screen and its fifteen selectors | [src/routes/NewEntry.tsx](../../../../src/routes/NewEntry.tsx) | yes, plus one — see *Deviations* item 1 |
| §4.4 the route, guarded on `member` | [src/App.tsx:116-119](../../../../src/App.tsx#L116-L119) | yes |
| §4.4 the link from `Home.tsx` | [src/routes/Home.tsx:87](../../../../src/routes/Home.tsx#L87) | yes |
| §4.5 dates are strings; no `Date` on any date path | `NewEntry.tsx`, both seams | yes — the only `new Date()` in the diff is `createdAt` / `updatedAt` in the mock, which is a timestamp and not a date field |
| §5 the mock reproduces INV-01 with slot semantics | [src/lib/data/mock.ts:267-279](../../../../src/lib/data/mock.ts#L267-L279) | yes |
| §5 `tests/seam-parity.test.ts` passes **unedited** | — | yes, verified below |
| §6 steps 1-13 | `supabase/migrations/20260903103000_cal01_entry.sql` | yes; step 8 in its INV-02-only form |

## Deviations from the design

**Three, all declared. None changes a contract item.**

**1. One selector exists that §4.4's table does not name: `home-new-entry-link`.** §4.4 requires the
link in words — *"`Home.tsx` gains one link to it"* — and names no `data-testid` for it, because the
table was written for the form and the list. The acceptance suite has to reach `/entries/new` from
somewhere, and reaching it by `page.goto` would be a full page load that discards the in-memory
seam's entries mid-test. Under ADR-022 the §4.4 table is no longer the sole channel a selector
reaches a test through — RULE-05 is retired and check R7 is removed — so this is a declared addition
rather than a rule breach. Every other selector is §4.4's, verbatim.

**2. `tentative` is cleared after a successful save, and the acceptance suite is what forced the
decision.** §4.4 says nothing about what the form retains. The first implementation kept type,
portion **and** `tentative`, on the reasoning that a run of days is usually declared several at a
time with the same shape. AC-6's test then failed: an entry saved with no tentative flag came back
marked tentative, because the control still held the previous entry's value. Type and portion
describe the *shape* of a declaration and carry no claim; `tentative` is a claim about one specific
plan, and a record reading *"chưa chắc chắn"* about a trip somebody has already booked is a wrong
record nobody typed. So the dates, the note and `tentative` are cleared and type and portion are
kept. [src/routes/NewEntry.tsx:104-118](../../../../src/routes/NewEntry.tsx#L104-L118).

**3. `ticket.yaml` was `state: BACKLOG` when this command ran, and its `gates` block predated
ADR-022.** `01-plan.md`'s front-matter carries `gate: PASS` and `next_state: READY`, but no
orchestrator run recorded the Definition of Ready, so the ticket never reached `READY` and the gates
block still had the four keys `spec`, `design`, `review`, `qa`. This stage sets `state: REVIEW`, as
`/implement` instructs on a PASS, and migrates the block to ADR-022's two keys, `plan` and `review`.
**The `plan` gate is recorded by QUOTING `01-plan.md`'s front-matter, not by re-judging it**, and the
comment in `ticket.yaml` says so — grading the Definition of Ready is the orchestrator's and this
agent did not do it. Every DoR item is in fact satisfiable on inspection (item 4's `requires_adr` is
discharged by ADR-005, ADR-011 and ADR-016, all `ACCEPTED` and none written here), which is why this
was recorded rather than escalated. Raised for the operator in *Open questions* item 2.

**Not a deviation, stated so it is not read as one: `supabase/seed.sql` is in `allowed_paths` and is
unchanged.** `allowed_paths` permits a file; it does not commission one. No criterion in §2 needs a
seeded entry — AC-7 and AC-8 each create their first entry through the form, the way a person does —
and seeding one would put a fixture row in the seed with no `FIXTURE_` constant behind it in
`src/lib/fixtures.ts`, which is the drift the shared-fixture rule exists to prevent. `entry` starts
empty in both implementations, which is the honest parity. `src/lib/fixtures.ts` is unchanged for the
same reason.

## AC-12 is not implemented, and that is the plan's instruction

**No past-date rule exists in either direction, and no test asserts one.** §2's AC-12 is
`TODO(project)` and says the criterion is the operator's and no agent may supply it; Open question 1
says the implementation adds no rule until it is answered. So:

- the date inputs carry no `min` attribute,
- neither seam checks a date against today,
- the acceptance suite has no AC-12 test, and says in a header comment why it has none.

A member may therefore declare a past date today. **That is not a decision this ticket made** — it is
the absence of one, and it is reversible in one place each in `NewEntry.tsx` and the two seams once
the operator answers. Recorded again in *Open questions* item 1 because it is the one thing in this
ticket a reader could mistake for an implemented answer.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-01` | The exclusion constraint `entry_no_overlapping_portion` over `member_id WITH =`, `date_range WITH &&`, `portion_slots WITH &&` — ADR-011 §3 verbatim, never `portion WITH =`. The mock reproduces the same slot semantics rather than an equality test, so `full` conflicts with `am` in both implementations. AC-7 asserts the refusal and AC-8 asserts it is not over-broad; the pair is the test, because a `WITH =` constraint passes AC-7's `full`-versus-`full` case alone. |
| `INV-02` | `public.entry_enforce_decision()` ships in its INV-02-only form — clause (c) of ADR-016 §1 and nothing else — with the trigger name ADR-016 fixes, so ADM-05's `create or replace` lands **over** it and not beside it. It clears `approved_by`, `approved_at` and `rejection_reason` as well as resetting `status`, it is actor-blind, and `old.status <> 'pending'` covers `rejected` as well as `approved`. Not exercisable end-to-end here: no update policy ships, so no UPDATE from a signed-in caller reaches it. Shipped correct anyway, because a wrong function now is held to be correct by every later ticket that only replaces it. |
| `INV-03` | The check is a **biconditional**: `(status = 'rejected') = (rejection_reason is not null and btrim(rejection_reason) <> '')`. One-directional would let an approved entry keep a stale reason and the invariant would read as claimed and not be held. ADR-016 §3 depends on this exact shape — clause (b) nulls the reason on approval *because* this check refuses the transition otherwise. Nothing in this ticket can create a `rejected` entry: `status` is not in the insert grant, so every row created here is `pending` with a null reason, which satisfies both directions. |
| `INV-06` | Column shape: one not-null `entry_portion` on the row, so a per-day portion is **unrepresentable** rather than merely unoffered. The form carries exactly one portion control and AC-5's test asserts there is exactly one. `portion_slots` is generated from that single column, so the constraint cannot see a portion the row does not have. |
| `INV-07` | `member_id uuid not null references public.member (id) on delete restrict` — no cascade, so a member is never deleted out from under their entries. Above that, the insert policy's `with check (member_id = (select auth.uid()))`, uniform across roles, and above that a `CreateEntryInput` with no `memberId` field at all, so no client this repository builds can name another member. Three layers, and only the middle one is a control. |
| `INV-04`, `INV-05` | **Deliberately absent from `invariants_touched` and re-confirmed here.** There is no arithmetic in this ticket: nothing counts absences, reads `team.overload_threshold`, or reads the roster. The mechanism is the absence of the computation, not the care of it — which is the distinction `.ai/registry/invariants.md` warns is circular reasoning when it goes the other way. `grep` for `overloadThreshold` and `listMembers` across the diff returns nothing. |

## Verification run

Run on this branch with the working tree as it stands. **No environment variable was supplied on the
command line**: `playwright.config.ts` pins the seam since BUG-001.

| Command | Exit | Notes |
|---------|------|-------|
| typecheck — `pnpm exec tsc --noEmit` | 0 | |
| lint — `pnpm exec eslint .` | 0 | Includes the RULE-02 rule. `NewEntry.tsx` imports `@/lib/data`, never `./supabase` or `./mock`; no inline disable anywhere in the diff. |
| unit — `pnpm exec vitest run` | 0 | 1 file, 2 tests. `tests/seam-parity.test.ts` passes **unedited** with two functions added, which is §5's stated requirement — the four mock helpers are module-local and are not seam keys. |
| end-to-end — `pnpm exec playwright test` | 0 | **32 passed**: `seam-guard`, `smoke`, `tea-01-signup`, `tea-05-sign-in` and this ticket's eleven. The three shipped suites are unedited and unaffected. |
| working tree a subset of `allowed_paths` | yes | Ten files plus the ticket's own directory. Verified by hand — see the note below. |

**`scripts/check-allowed-paths.mjs` reports `0 changed file(s)` on this ticket and PASSes vacuously,
and a reviewer must not read that as R1 having run.** Line 112 computes the set from
`git diff --name-only origin/main...HEAD` — committed history only. Since ADR-006 a ticket stays
uncommitted until `/ship`, so on every ticket this check is empty at IN_PROGRESS and at REVIEW and
only becomes meaningful after `/ship` commits. The working tree was therefore checked against the
eleven globs by hand, file by file, and every path is inside. Raised as *Open questions* item 3.

## Testability contract

| selector | Exists at |
|----------|-----------|
| `app-root` | [src/App.tsx:28](../../../../src/App.tsx#L28) — unchanged name and position |
| `seam-banner` | [src/App.tsx:36](../../../../src/App.tsx#L36) — unchanged |
| `new-entry-form` | [src/routes/NewEntry.tsx:139](../../../../src/routes/NewEntry.tsx#L139) |
| `new-entry-type` | [src/routes/NewEntry.tsx:148](../../../../src/routes/NewEntry.tsx#L148) |
| `new-entry-portion` | [src/routes/NewEntry.tsx:164](../../../../src/routes/NewEntry.tsx#L164) |
| `new-entry-start` | [src/routes/NewEntry.tsx:181](../../../../src/routes/NewEntry.tsx#L181) |
| `new-entry-end` | [src/routes/NewEntry.tsx:198](../../../../src/routes/NewEntry.tsx#L198) |
| `new-entry-tentative` | [src/routes/NewEntry.tsx:213](../../../../src/routes/NewEntry.tsx#L213) |
| `new-entry-note` | [src/routes/NewEntry.tsx:225](../../../../src/routes/NewEntry.tsx#L225) |
| `new-entry-submit` | [src/routes/NewEntry.tsx:240](../../../../src/routes/NewEntry.tsx#L240) |
| `new-entry-error` | [src/routes/NewEntry.tsx:234](../../../../src/routes/NewEntry.tsx#L234) |
| `own-entry-row` | [src/routes/NewEntry.tsx:264](../../../../src/routes/NewEntry.tsx#L264) — carries `data-type`, `data-portion` and `data-status` |
| `own-entry-row-dates` | [src/routes/NewEntry.tsx:275](../../../../src/routes/NewEntry.tsx#L275) — both bounds, always, as `d → d` |
| `own-entry-row-type` | [src/routes/NewEntry.tsx:278](../../../../src/routes/NewEntry.tsx#L278) |
| `own-entry-row-portion` | [src/routes/NewEntry.tsx:281](../../../../src/routes/NewEntry.tsx#L281) |
| `own-entry-row-tentative` | [src/routes/NewEntry.tsx:285](../../../../src/routes/NewEntry.tsx#L285) — rendered only when tentative |
| `own-entries-empty` | [src/routes/NewEntry.tsx:254](../../../../src/routes/NewEntry.tsx#L254) |
| `member-list-row` | unchanged, `src/routes/MemberList.tsx` — §4.4 lists it and this ticket's suite does not use it |
| `home-new-entry-link` | [src/routes/Home.tsx:87](../../../../src/routes/Home.tsx#L87) — **not in §4.4's table**; see *Deviations* item 1 |

## What the end-to-end suite does NOT prove

**Every test above ran against the in-memory seam, and the migration ran nowhere.** No Supabase
project is provisioned, so:

- **The migration has never been applied.** The exclusion constraint, the two generated columns,
  both policies, the column grant and the trigger are unexecuted SQL. What the suite proves is that
  the mock reproduces the same *semantics*; it proves nothing about whether the SQL parses, whether
  `btree_gist` resolves, or whether the `[]` constructor behaves as ADR-011 says on the hosted
  PostgreSQL major.
- **`TODO(verify)` on `btree_gist` is live and undischarged.** ADR-011 §4 and §6 step 1 of the plan
  both carry it. If the `extensions` schema is not on the `search_path` in force, the `alter table`
  fails at apply time with *"data type uuid has no default operator class for access method gist"*.
  It is in the migration's header where whoever applies it will read it.
- **AC-10 and AC-11 are the sharpest denials in the product so far, and both are observed here only
  as the absence of a control.** The real controls are the policy's `with check` and the withheld
  column grant, and neither has been executed. `tests/permission-model.test.ts`, which
  `.ai/standards/testing-standards.md` names as mandatory and which would drive a real PostgreSQL
  with a token per role, still does not exist — plan Open questions item 3, pre-existing debt, not
  discharged here.

MD-014 is the standing proof that this gap is not theoretical: four `auth.users` columns left NULL
broke every sign-in and were found on the first contact with a real project, not in any test.

## Open questions

**1. AC-12 — may a member create an entry for a date in the past?** Unchanged and still the
operator's, `TODO(project)` on `.ai/registry/features.md:87`. Restated here rather than only cited
because this ticket now ships a form on which the question is concrete: today it accepts any date.
One acceptance criterion, one `min` attribute and one seam check once answered. It blocks nothing
else in this plan and it did not block this stage.

**2. The board never recorded CAL-01 reaching `READY`.** `ticket.yaml` read `state: BACKLOG` with the
pre-ADR-022 gates block while `01-plan.md` carried `gate: PASS, next_state: READY`, so `/implement`
ran on a ticket that no orchestrator run had graded against the Definition of Ready. This stage set
`REVIEW` and migrated the gates block, quoting the plan's front-matter rather than judging it
(*Deviations* item 3). **A human should confirm the DoR was actually met** — the plan gate's
`passed: true` in `ticket.yaml` is now a quotation, and quoting is not grading.

**3. `scripts/check-allowed-paths.mjs` cannot see a ticket's work, and this is a gap in R1's
enforcement rather than in this ticket.** It diffs `origin/main...HEAD` (line 112), and ADR-006 keeps
a ticket uncommitted until `/ship` — so the check is empty and green at exactly the two stages that
exist to catch a path violation, and only becomes real after the commit that ends the ticket. The
same reading applies to `guard-allowed-paths.mjs`, which intercepts writes and is unaffected; it is
the *audit* that is blind, not the guard. Worth a model-debt entry. Not fixed here: `scripts/` is
outside `allowed_paths` and fixing it inside a feature branch is the mistake BUG-001 exists to
record.

**4. `.ai/standards/data-model.md`'s `TODO(project)` is now answerable and is still owed a human
edit.** Its *Where invariants are held* rows ask for a migration file and a constraint name per
invariant; `20260903103000_cal01_entry.sql` supplies them for INV-01, INV-02, INV-03, INV-06 and
INV-07. Standards plane, human-only under RULE-01 — plan §7 says the same and this ticket does not
make the edit.

**5. `roleLabel` is still duplicated** at `src/routes/Home.tsx:26` and `src/routes/MemberList.tsx:22`,
carried over from TEA-05's log. `MemberList.tsx` is not in this ticket's `allowed_paths` either, so
it is recorded a second time rather than fixed. The next ticket that may touch both files should lift
it into one place.
