---
ticket: ADM-05
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-05T22:34:37+07:00
inputs_read:
  - .ai/board/tickets/ADM-05/01-plan.md
  - .ai/board/tickets/ADM-05/ticket.yaml
  - .ai/board/tickets/ADM-04/03-impl-log.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/steward/context.md
  - .ai/01-operating-model.md
  - .ai/templates/questions.md
  - supabase/db.sql
  - supabase/migrations/20260903143000_cal02_own_entry_writes.sql
  - supabase/migrations/20260903160000_cal03_admin_entry_writes.sql
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/components/HolidayForm.tsx
  - src/routes/PendingEntries.tsx
  - src/routes/EditEntry.tsx
  - tests/pending-entries.test.ts
  - tests/ui-language.test.ts
  - tests/e2e/adm-04-worklist.spec.ts
  - tests/e2e/cal-02-edit-delete-entry.spec.ts
  - tests/e2e/cal-03-admin-edit-entry.spec.ts
  - eslint.config.js
  - ui-language.json
consulted:
  - with: tech-lead-design
    asked: "01-plan.md § 7 requires tests/e2e/adm-04-worklist.spec.ts to pass UNEDITED, and it cannot: its AC-9 test asserts that the worklist holds no button, which is the absence this ticket exists to remove. The file is not in allowed_paths, so RULE-03 forbids the four-line fix. Which of three options, and the paste-ready form of the one I recommend, is in 99-questions.md."
    answer: "Option 1, in the paste-ready form, taken exactly as quoted and bounded to it — the two surviving structural lines and the comment naming ADM-05 as what superseded the other two; the four selector-name assertions above and the whole AC-15 vocabulary block below stay untouched. Options 2 and 3 refused for the reasons given. No acceptance criterion changes and `size` stays M."
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# ADM-05 — implementation log

**Every contract item in § 4 is implemented, every acceptance criterion has a passing test, and the
whole end-to-end suite is green: 160 passed, 0 failed.**

**This log covers two cycles in one file, because the first ended BLOCKED and the second was four
lines long.** The first run implemented everything and stopped on one sentence in § 7 that was not
true of the repository — `tests/e2e/adm-04-worklist.spec.ts` cannot pass unedited, because its AC-9
test asserts the absence of the decision controls that the ADM-05 feature row exists to add.
`99-questions.md` carries the question, three options and the paste-ready form of the one
`tech-lead-design` took; § 7 and `allowed_paths` were amended, and the second cycle applied exactly
that edit and nothing else. **`rework_count` stays 0 (RULE-08): the defect was upstream and the
answer says so in those words.** § *Open questions* item 1 records what it cost and what it did not.

## Files touched

**Eleven files, all eleven inside `allowed_paths` as amended, and no twelfth.** Three are new — the
migration, the component and its two test files — and the eleventh is the amendment's:
`tests/e2e/adm-04-worklist.spec.ts`, for the four-line edit § 7 now bounds it to. All eleven of the
eleven reserved paths were used. Two files under `.ai/board/tickets/ADM-05/` are also written and are
not code: `99-questions.md` (the consultation) and `ticket.yaml`, whose `chat_budget` was incremented
by hand — see § *Deviations* item 3.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260905190000_adm05_entry_decision.sql` | created | clauses (a) and (b) added to `public.entry_enforce_decision()` by `create or replace`, and the two columns CAL-02 deferred by name granted in the same file | § 4.3, § 6 |
| `src/lib/domain/types.ts` | modified | `entry_decision_not_permitted` and `rejection_reason_required` added to `FailureCode`; nothing existing changes shape | § 4.1 |
| `src/lib/data/index.ts` | modified | `approveEntry` and `rejectEntry` declared on the seam, with the contract that forbids sending provenance and requires the affected-row count | § 4.2, § 5 |
| `src/lib/data/mock.ts` | modified | the in-memory implementation, and `applyDecision` — clauses (a) and (b) reproduced once for both functions | § 4.2, § 5 |
| `src/lib/data/supabase.ts` | modified | the real implementation, plus `toDecisionFailure` and the four shared sentences | § 4.2, § 4.1 |
| `src/components/EntryDecision.tsx` | created | the panel — approve, reject, the reason field, the failure sentence; it calls the seam and decides nothing | § 4.4, § 4.5 |
| `src/routes/PendingEntries.tsx` | modified | the panel on each row, and `load()` after a decision so the row leaves the queue and the count falls together | § 4.4 |
| `src/routes/EditEntry.tsx` | modified | the panel for an admin, the rejection reason and its timestamp for both roles, and the star's meaning | § 4.4, § 4.5 |
| `tests/entry-decision.test.ts` | created | the transitions, the provenance, the two refusals and INV-02's reset, against the seam | § 2 |
| `tests/e2e/adm-05-approve-reject.spec.ts` | created | what an admin and a member see, for the eight criteria that have an interface | § 2, § 4.5 |
| `tests/e2e/adm-04-worklist.spec.ts` | modified | **the amendment's four lines and no others**: two structural assertions in ADM-04's AC-9 test that asserted the absence this ticket adds, replaced by the two that survive, with a comment naming ADM-05 | § 7 as amended |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 `entry_decision_not_permitted` | `src/lib/domain/types.ts:91` | the comment is § 4.1's, transcribed |
| § 4.1 `rejection_reason_required` | `src/lib/domain/types.ts:96` | same |
| § 4.2 `approveEntry(entryId)` | `src/lib/data/index.ts:696`, `supabase.ts:1437`, `mock.ts:1479` | one column on the wire; zero rows is a refusal |
| § 4.2 `rejectEntry(entryId, reason)` | `src/lib/data/index.ts:714`, `supabase.ts:1466`, `mock.ts:1509` | blank reason refused before the write; both columns in one statement |
| § 4.2 the mock's clause (a) | `src/lib/data/mock.ts:446` | `applyDecision`, one function for both clauses because the SQL is one function |
| § 4.3 the migration, five properties | `supabase/migrations/20260905190000_adm05_entry_decision.sql` | `create or replace`, no second trigger, clause order `updated_at`→(a)→(b)→(c), clause (c) byte-identical to CAL-02's, `security invoker`, no `is_admin` grant, no `entry_update_admin` |
| § 4.4 the panel | `src/components/EntryDecision.tsx` | no read, no query, no role check, no confirmation dialog |
| § 4.4 the worklist | `src/routes/PendingEntries.tsx:395` | `load` and never a splice |
| § 4.4 the edit screen, three changes | `src/routes/EditEntry.tsx:186`, `:205`, `:237` | panel for an admin; star meaning; reason and timestamp for both roles |
| § 4.5 the eleven selectors | see § *Testability contract* | all present; the two existing ones are unchanged |
| § 5 seam parity | `tests/seam-parity.test.ts` | passes unedited, as § 5 says it would |
| § 6 the two owed objects | the migration | verified owed against `supabase/migrations/` rather than against `db.sql`'s labels |
| § 7 as amended, the bounded edit | `tests/e2e/adm-04-worklist.spec.ts:273-279` | `form` and `input` stay at 0; `textarea` and `button` go; the four selector-name assertions above and the whole AC-15 vocabulary block below are byte-identical to what shipped |

## Deviations from the design

**Three, all small, none behavioural.**

1. **`toDecisionFailure` takes no refusal-sentence parameter**, unlike `toEntryFailure` and
   `toHolidayFailure` which § 4.1 holds up as the shape. Neither of its branches could use one:
   clause (a) does not distinguish approving from rejecting, so its sentence names both acts, and
   INV-03's is about the reason on either path. The verb-specific sentence is the ZERO-ROW refusal,
   which each call site writes for itself with `APPROVE_REFUSED` or `REJECT_REFUSED`. A parameter
   would have been one no branch reads — and `@typescript-eslint/no-unused-vars` says so too.
   `src/lib/data/supabase.ts:451` carries the reasoning.
2. **The four new refusal sentences are English**, where CAL-01's three on the same table are
   Vietnamese. `.ai/standards/ui-design-system.md` § Language requires English; `supabase.ts` and
   `mock.ts` are on `ui-language.json`'s `copyDebt`, which is a ratchet for text that PREDATES the
   standard and not a licence to add more. ADM-03 made the same choice for the holiday sentences.
   **Nothing was added to `copyDebt` and nothing was removed from it.**
3. **`ticket.yaml`'s `chat_budget` was incremented by hand** to `used: 1`.
   `.claude/hooks/chat-guard.mjs:302` increments it when `99-questions.md` is written through the
   Edit tool; this session wrote the file with a shell heredoc, so the hook never ran. Leaving the
   field at zero would have been a record saying no question was asked. The comment above the field
   says so in the file.

4. **The edit to `tests/e2e/adm-04-worklist.spec.ts` is four lines and is § 7's, not this agent's.**
   It was made only after the amendment put the file in `allowed_paths` and bounded what may change
   in it; the first cycle stopped rather than make it. What went: `textarea` and `button` at count 0
   inside `[data-testid="pending-entries"]`. What stayed: `form` and `input` at count 0, the four
   `pending-entry-row-*` and `pending-entries-*` selector-name assertions, and the entire AC-15
   vocabulary check — so ADM-04's criterion is still a criterion and the losing triage argument in
   `features.md:103` that it protects is still readable.

**Not deviations, recorded because a reviewer will look for each:**

- **No fixture was added**, as § 7 requires. Both suites create their pending entries through
  `createEntry` and CAL-01's form. The two seeded rows that ARE used are the two nobody can create:
  `FIXTURE_APPROVED_ENTRY` and `FIXTURE_OTHER_TEAM_ENTRY`.
- **`supabase/db.sql` is not edited** and its two `[OWED] ADM-05` labels still read `[OWED]` — § 7
  and § *Open questions* item 3 of the plan.
- **`AC-19`'s sentence renders on every status**, not only on an approved entry. The criterion asks
  that the meaning be stated once in the interface; the person who asks what a star means is usually
  looking at an entry that has not got one, and a sentence that appeared only after approval would
  be missing from the screen where the question is asked. `src/routes/EditEntry.tsx:205`.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-02` | Clause (c) in the new migration is **byte-identical** to `20260903143000_cal02_own_entry_writes.sql`'s, verified by comparing the two blocks rather than by reading them, and it still runs LAST. The `updated_at` line above it is byte-identical too. What changed is that the invariant is now OBSERVABLE: until this ticket nothing could set `status` to `approved`, so clause (c) had never had a live case. AC-12 and AC-14 give it two, and `cal-02` and `cal-03`'s shipped suites — which exercise an ordinary edit by an owner and by an admin — pass unedited, which is where a reversed clause order would have gone red first. |
| `INV-03` | Held by `entry_rejection_reason_iff_rejected`, a biconditional this ticket does not touch. Both directions are now exercised for the first time: `rejectEntry` writes `status` and `rejection_reason` in ONE statement, and clause (b) nulls the reason on approval rather than leaving the caller to. The seam's blank-reason refusal is an AFFORDANCE and is documented as one in three places — it exists so no SQLSTATE reaches a screen, not to enforce the rule. AC-3 and AC-4. |
| `INV-05` | Held BY ABSENCE, and the absence is checkable in three files: the migration's grant names `status` and `rejection_reason` and not `tentative`; clause (b) writes `approved_by`, `approved_at` and `rejection_reason` and not `tentative`; and `applyDecision` in the mock writes the same three. AC-6 asserts a tentative entry is still tentative after approval, which is the case that would fail if any of the three grew a fourth column. |

## Verification run

Commands actually executed, with exit codes.

| Command | Exit | Notes |
|---------|------|-------|
| typecheck — `pnpm exec tsc --noEmit` | 0 | |
| lint — `pnpm exec eslint .` | 0 | § Language included. `EntryDecision.tsx` is new and English throughout, and is NOT added to `copyDebt` |
| unit — `pnpm exec vitest run` | 0 | 9 files, **182 tests, all pass**. 15 are this ticket's |
| unit under `TZ=UTC` | 0 | 182 pass |
| unit under `TZ=America/Los_Angeles` | 0 | 182 pass |
| end-to-end — `pnpm exec playwright test tests/e2e/adm-05-approve-reject.spec.ts` | 0 | **6 pass**, seam guard included |
| end-to-end — `pnpm exec playwright test` (first cycle) | **1** | 159 pass, 1 FAIL — `adm-04-worklist.spec.ts:277`, the failure the consultation was about. Recorded rather than overwritten: it is what the amendment was decided against |
| end-to-end — `pnpm exec playwright test` (after the amendment) | 0 | **160 pass, 0 fail.** `cal-02-edit-delete-entry.spec.ts` and `cal-03-admin-edit-entry.spec.ts` — the two remaining safety nets, and the two where a reversed clause order would show first — **pass unedited** |
| `node scripts/check-docs.mjs` | 0 | 0 errors, 2 pre-existing advisory D8 warnings, neither this ticket's |
| `node scripts/check-allowed-paths.mjs` | 0 | `allowed-paths: PASS` — and **vacuously**, because it diffs `origin/main...HEAD` and ADR-006 leaves the ticket uncommitted until `/ship`. The real check was run against the working tree: eleven changed code files, all eleven in `allowed_paths` as amended, none outside |

**The predicted count was wrong and the measured one is 160.** `99-questions.md` predicts *"165
passed, 0 failed"* after the amendment, and the answer says correctly that the number is the evidence
rather than the answer. 165 was arithmetic done badly — this ticket's tests added to a 159 that
already contained them. **The suite is 160 tests**: the 155 that shipped before this ticket
(ADM-04's log records that figure) and this ticket's 5. The targeted run reports 6 because it
includes `tests/e2e/seam.setup.ts`, which is the seam guard and not a test of this ticket's. Left
standing in `99-questions.md` rather than quietly corrected there, because that file is a record.

**The environment needed Node 22 on the path**, as CAL-08's and ADM-04's logs already recorded: this
machine runs 18.19.1 against a recorded major of 22 (`.ai/standards/tech-stack.md:51`), and
`eslint.config.js:6` uses an `import … with { type: "json" }` attribute Node 18 cannot parse, so lint
exits 2 with a `SyntaxError` before any rule runs. Node 22.11.0 was fetched into the session's
scratchpad and put on `PATH` for the runs above. **Nothing in the repository was edited to make the
commands run**, and no dependency was installed or changed.

## Testability contract

| selector | Exists at |
|----------|-----------|
| `entry-decision` | `src/components/EntryDecision.tsx:76` — carries `data-entry-id` and `data-status` |
| `entry-decision-approve` | `src/components/EntryDecision.tsx:87` — absent when the entry is `approved` |
| `entry-decision-reject` | `src/components/EntryDecision.tsx:100` |
| `entry-decision-reason` | `src/components/EntryDecision.tsx:122` — carries `data-required="true"` |
| `entry-decision-submit` | `src/components/EntryDecision.tsx:140` |
| `entry-decision-cancel` | `src/components/EntryDecision.tsx:152` |
| `entry-decision-error` | `src/components/EntryDecision.tsx:176` — `role="alert"`, carries `data-code` |
| `edit-entry-rejection-reason` | `src/routes/EditEntry.tsx:237` — present only when `status` is `rejected` |
| `edit-entry-decided-at` | `src/routes/EditEntry.tsx:241` — carries `data-updated-at` |
| `edit-entry-star-meaning` | `src/routes/EditEntry.tsx:205` |
| `edit-entry-status` | unchanged, `src/routes/EditEntry.tsx` — still carries `data-status` |
| `pending-entries-count` | unchanged, `src/routes/PendingEntries.tsx` — still carries `data-total` and `data-shown` |

**Where each acceptance criterion is asserted**, because two suites and no QA stage means nobody else
writes this down:

| AC | Asserted in |
|----|-------------|
| AC-1 | both — `tests/entry-decision.test.ts` (the write and the count) and the e2e suite (the queue) |
| AC-2, AC-3, AC-4, AC-5 | both |
| AC-6, AC-7, AC-10, AC-12, AC-13, AC-14, AC-16, AC-17 | `tests/entry-decision.test.ts` only — each is a property of the write and not of a screen |
| AC-8, AC-9 | `tests/entry-decision.test.ts` for the refusal; the e2e suite asserts the affordance half — a member is offered no decision control anywhere |
| AC-11, AC-15, AC-18, AC-19, AC-20 | the e2e suite only — all five are about what an interface offers, says or leaves alone |

## Open questions

**1. RESOLVED, and kept because the resolution is the record.** `01-plan.md` § 7 listed
`tests/e2e/adm-04-worklist.spec.ts` among three safety nets that must pass **unedited**, on the
strength of the role it plays — *reports a broken worklist selector*. It does more: its AC-9 test
asserts the absence of the decision controls **twice**, by the four `pending-entry-row-*` /
`pending-entries-*` selector names (which still pass, because § 4.5 names this ticket's controls
`entry-decision-*`) and **structurally**, `form`, `textarea`, `button` and `input` each at count 0
inside `[data-testid="pending-entries"]`. The structural half asserts the absence the ADM-05 feature
row exists to remove, and no implementation avoids it — measured,
`expect(list.locator("button")).toHaveCount(0)` received 2.

The first cycle **stopped** rather than edit a file outside `allowed_paths` (RULE-03) and wrote
`99-questions.md` with three options and the paste-ready form of the recommended one.
`tech-lead-design` took it, bounded it in § 7 to those four lines, and added the file to
`allowed_paths` as the eleventh path. **No acceptance criterion moved**, which the answer says
explicitly and the plan's Changelog records with the reason — an AC quietly reshaped to fit what is
easy to build is the failure nothing in the loop catches now that SPEC and DESIGN are one stage.
The second cycle applied that edit and nothing else: **160 passed, 0 failed**.

**`rework_count` stays 0.** RULE-08: an upstream defect must not burn the downstream agent's budget,
and the answer names § 7 as the defect in those words. **The developer session was kept open across
the cycle** (RULE-06, `.ai/standards/session-model.md`), which is why the second cycle cost four
lines rather than a re-derivation.

**What it cost, and what a reviewer should check rather than take from this paragraph.** The one
thing worth a second look is whether the bounded edit was actually bounded: the diff of
`tests/e2e/adm-04-worklist.spec.ts` is **three lines out and six in** — the `textarea` and `button`
assertions and the one-line comment they sat under, replaced by a six-line comment naming ADM-05 —
with `form` and `input` still at 0, and the four selector-name assertions above and the whole AC-15
vocabulary block below byte-identical to what shipped.

**2. Not blocking, and it is ADR-016's own headline consequence, restated because it is now
implemented rather than planned.** ADR-016 *Consequences* requires the sharpest case in the product —
a member PATCHing `{"status":"approved"}` against their own entry — to be issued against a real
PostgreSQL with a member's token, *"not through the seam"*. `tests/permission-model.test.ts` does not
exist and no Supabase project is provisioned, so AC-8 and AC-9 are satisfied here **against the
mock**, where `applyDecision` is a second implementation of clause (a). **On the mock those two
criteria demonstrate the sentence, not the refusal.** The refusal is held by the trigger in
`supabase/migrations/20260905190000_adm05_entry_decision.sql` and is verified the day a project
exists. The file header of `tests/entry-decision.test.ts` says the same thing where somebody reading
a green run will meet it.

**3. Not blocking, not this ticket's, and unchanged since PLAN recorded it.** `supabase/db.sql`'s two
`[OWED] ADM-05` markers are now stale — this file's migration ships both objects — and they join the
five already stale ones (three `[OWED] ADM-02`, two `[OWED] ADM-03`). ADR-026 assigns the sweep to no
ticket. The plan's § *Open questions* item 3 carries the fix shape and recommends the second one: a
`check-docs.mjs` check that fails an `[OWED] <TICKET>` marker whose ticket is `DONE`, because it also
catches the case nobody remembered.

**4. Not blocking, and it is a fact about applying the migration rather than about the code.** This
file opens two columns to `authenticated` in the same statement that closes them behind clause (a).
**Applying it is human — RULE-09 — and the two halves must land together**; applying only the grant
would hand every member the exact write ADR-016 exists to refuse.
