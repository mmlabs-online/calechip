---
ticket: ADM-06
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-05T23:35:00+07:00
inputs_read:
  - .ai/board/tickets/ADM-06/01-plan.md
  - .ai/board/tickets/ADM-06/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/templates/impl-log.md
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/components/EntryDecision.tsx
  - src/routes/PendingEntries.tsx
  - supabase/db.sql
  - supabase/migrations/20260905190000_adm05_entry_decision.sql
  - tests/entry-decision.test.ts
  - tests/seam-parity.test.ts
  - tests/e2e/adm-04-worklist.spec.ts
  - tests/e2e/adm-05-approve-reject.spec.ts
  - tests/e2e/seam.setup.ts
  - playwright.config.ts
  - ui-language.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# ADM-06 — implementation log

## Files touched

Ten, and they are the ten in `allowed_paths` — no more and no fewer.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/domain/types.ts` | modified | `BulkRejectionOutcome` (`:516`) and `no_entries_selected` (`:105`). Nothing existing changes shape. | § 4.1 |
| `src/lib/data/index.ts` | modified | `rejectEntries` declared on `DataSeam` (`:761`), below `rejectEntry`. No existing member changes signature. | § 4.2 |
| `src/lib/data/supabase.ts` | modified | `rejectEntries` (`:1537`) as the seam's first `.rpc()` call; `22023` added to `toDecisionFailure` (`:478`); two refusal sentences. | § 4.2 |
| `src/lib/data/mock.ts` | modified | `rejectEntries` (`:1556`), reproducing the function plus the policy filter and clause (a); the same two sentences. | § 4.2 |
| `supabase/migrations/20260905230000_adm06_reject_entries.sql` | created | `public.reject_entries` (`:73`) and its two privilege statements (`:98-99`), transcribed from `supabase/db.sql`. | § 4.3 |
| `src/components/BulkRejection.tsx` | created | The batch bar: the selection summary, select-all, clear, the always-visible reason field, the submit, the result and the refusal. | § 4.4, § 4.5 |
| `src/routes/PendingEntries.tsx` | modified | Selection state (`:145`), the AC-14 reset (`:216-219`), the bar mounted outside the `<ul>` (`:381`), a checkbox first on each row (`:422`). | § 4.4 |
| `tests/bulk-rejection.test.ts` | created | The seam-level half: AC-1 to AC-11 and AC-18, driving `src/lib/data/mock.ts` directly. | § 2 |
| `tests/e2e/adm-06-bulk-reject.spec.ts` | created | The interface half: AC-1, AC-3, AC-4, AC-8, AC-12 to AC-17. | § 2, § 4.5 |
| `tests/e2e/adm-04-worklist.spec.ts` | modified | ONE line removed — `list.locator("input")` — with the comment amended to name ADM-06. `form` stays at 0 (`:286`). | § 7 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 `BulkRejectionOutcome` | `src/lib/domain/types.ts:516` | Both fields, both comments, verbatim from the contract. |
| § 4.1 `no_entries_selected` | `src/lib/domain/types.ts:105` | Added to the existing union beside ADM-05's two. No exhaustive switch consumes it. |
| § 4.2 `rejectEntries` on the seam | `src/lib/data/index.ts:761` | Signature exactly as written. `approveEntry`, `rejectEntry`, `listPendingEntries`, `updateEntry`, `deleteEntry` unchanged — not one character. |
| § 4.2 supabase implementation | `src/lib/data/supabase.ts:1537` | `.rpc("reject_entries", { p_ids, p_reason })`. The parameter names are the function's, because PostgREST resolves an RPC's arguments by name. |
| § 4.2 `22023` in `toDecisionFailure` | `src/lib/data/supabase.ts:478` | A new case in the existing switch; ADM-05's three keep their codes and sentences. |
| § 4.2 mock implementation | `src/lib/data/mock.ts:1556` | Reason, then selection, then the policy filter, then the guard over the whole admitted set, then the write. |
| § 4.3 the migration | `supabase/migrations/20260905230000_adm06_reject_entries.sql:73,98,99` | Function body character-for-character as `supabase/db.sql:553-566`. `security invoker`; `revoke` before `grant`. |
| § 4.4 `BulkRejectionProps` | `src/components/BulkRejection.tsx:44-65` | Four props as written, plus `outcome` and one changed callback signature — see Deviations. |
| § 4.4 the four screen additions | `src/routes/PendingEntries.tsx:145, 216, 381, 422` | Plus the fifth state field named under Deviations. `load`, the four view phases, `localToday`, both filters, the pager, the count paragraph, the row link and `<EntryDecision>` are untouched. |
| § 4.4 the copy table | `src/components/BulkRejection.tsx:129-217` | Every row as written except the reason label — see Deviations. |
| § 4.5 the selector table | below | All eight exist. |

## Deviations from the design

Three. **None of them changes a behaviour, a permission, an invariant or a field name** — the first
two move state up one level because the screen unmounts the component, and the third moves five words
of copy.

### 1. The reason label is `What would work instead for these entries?`, not `What would work instead?`

§ 4.4's copy table fixes the label as *"the same question ADM-05's panel asks"*, character for
character. **It cannot be that string, and the reason is not aesthetic.** Both controls are on
`/entries/pending` at once, and `tests/e2e/adm-05-approve-reject.spec.ts:306` addresses that label by
its text:

```ts
await expect(page.getByText("What would work instead?")).toBeVisible();
```

Playwright's strict mode fails a locator that resolves to more than one element, so the identical
string makes a **shipped suite red the moment the bar renders** — observed, not predicted: the first
full end-to-end run of this ticket failed on exactly that line. That file is not in `allowed_paths`
and § 7 requires it to pass **unedited**, so the wording is the half of this that may move.

**It is also the better interface**, which is what makes this a small deviation rather than a
workaround: an admin looking at a screen with a per-row reason field and a batch reason field asking
the identical question has no way to tell which one they are typing into. The new label names the
object the batch acts on, in the vocabulary AC-16 requires — **entries**.

**AC-16 is not weakened.** Its claim is that *the batch gains no vocabulary the single rejection does
not have*: the question is the same question, the object is still an entry, and no quota, balance,
entitlement or remaining-days figure appears. `tests/e2e/adm-06-bulk-reject.spec.ts` asserts the label
and then sweeps the whole page body against ADM-04's forbidden list.

### 2. The outcome is held by `PendingEntries`, not by `BulkRejection`

§ 4.4's `BulkRejectionProps` has four props and `onRejected: () => void | Promise<void>`. Implemented
with a fifth prop, `outcome: BulkRejectionOutcome | null`, and `onRejected: (outcome) => …`.

**It is forced by the screen the bar is mounted on.** `PendingEntries.load()` sets
`{ phase: "loading" }`, which returns at `src/routes/PendingEntries.tsx:221` — **before** the bar is
rendered. So the bar **unmounts** during the re-read AC-12 requires, and any state it held is gone.
§ 2b requires the opposite: *"The result of a batch is a sentence in the bar and stays there … A toast
would take the only record of a partial write off the screen after four seconds."* A result that
vanishes on the re-read is a toast with extra steps.

The alternative was to stop `load` flashing the loading phase, which § 4.4 forbids — `load` is on the
untouched list. So the outcome moves to the caller, **exactly as the selection already does and for
the same reason § 4.4 gives for the selection**: anything that must outlive a re-read cannot live in
the thing the re-read unmounts.

Nothing else moves. The **error** stays in the bar, correctly: a refusal calls neither `onRejected`
nor `load`, so nothing unmounts and AC-13's *"the selection and the typed text stay on screen"* holds
without help.

### 3. The submit is disabled only while a batch is in flight

§ 3 lists *"the disabled submit"* among the affordances but does not say what disables it. It is
`busy` and nothing else. **A submit disabled on an empty selection would delete AC-4 from the
product** — the refusal could never be reached through the interface — and the same argument would
delete AC-3 if the button also checked the reason. This is `EntryDecision`'s own recorded reasoning
(`src/components/EntryDecision.tsx:20-24`) applied to both refusals rather than one.

### Not deviations, recorded because a reviewer will look for them

- **The bar renders in every `ready` view, including an empty worklist.** It carries the result
  sentence, and a batch that emptied the page would otherwise take the only record of what it did off
  the screen with the last row (AC-5).
- **The AC-14 effect clears the result along with the selection.** A count about a batch drawn from a
  view that is no longer on screen is true and unreadable. It keys on `query`, so the re-read after a
  batch — which does not change `query` — does not fire it.
- **`ticket.yaml`'s `plan` gate row was `passed: false` with `at: null`** while `01-plan.md`'s
  front-matter carries `gate: PASS` and `next_state: READY`, and `state` was still `BACKLOG`. The PLAN
  run left both. Transcribed from the artifact's front-matter and annotated as a transcription, with
  `state` advanced to `REVIEW` by this command. No gate is claimed here that was not reached.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-03` | The rejection is **one statement per record**: `update public.entry set status = 'rejected', rejection_reason = p_reason where id = any (p_ids)` writes both columns together, which is what `entry_rejection_reason_iff_rejected` requires of every row it touches — the check is a **biconditional** and refuses either column written alone. The constraint is **not amended** by this ticket and remains the control. Above it sit two refusals of an empty reason, and neither is the control: `public.reject_entries` raises `22023` with a sentence before it issues the `update`, and `rejectEntries` in both seam implementations refuses `""` and whitespace before a request is issued at all. `coalesce` in the function is load-bearing — `btrim(null)` is null and `null = ''` is not true, so a null reason without it would reach the constraint as the raw `23514` the raise exists to avoid. One reason is written onto **every** entry in the batch, per record, with no shared row and no null: `tests/bulk-rejection.test.ts` AC-2 asserts it across two members, and AC-3 asserts that a blank batch leaves every row `pending` with `rejectionReason` null. |

**INV-02, INV-05, INV-01 and INV-04 are absent from `invariants_touched` and this implementation does
nothing that would add them.** No trigger is created or replaced; `tentative` is in neither the
function's `set` list nor any grant this ticket touches; a rejected entry still occupies its slots, so
the exclusion constraint sees what it saw; and nothing here computes an absence count. AC-9's clearing
of `approvedBy` and `approvedAt` is **observed** through clause (b), which this ticket does not edit —
`tests/bulk-rejection.test.ts` AC-9 asserts the clearing against a fixture that was approved by
somebody.

## Verification run

Executed, in this order, on `feat/ADM-06`.

| Command | Exit | Notes |
|---------|------|-------|
| typecheck — `pnpm exec tsc --noEmit` | 0 | |
| lint — `pnpm exec eslint .` | 0 | |
| unit — `pnpm exec vitest run` | 0 | **10 files, 195 tests, all pass.** 12 are this ticket's; the other 183 are the shipped suites, `tests/seam-parity.test.ts` and `tests/entry-decision.test.ts` among them, and all pass **unedited**. |
| end-to-end — `pnpm exec playwright test` | 0 | **165 pass**, including the `seam-guard` project. 5 are this ticket's. |
| documentation audit — `node scripts/check-docs.mjs` | 0 | 1 error, **pre-existing and not this ticket's** — D6 on `.ai/registry/features.md` naming `tests/permission-model.test.ts`, which does not exist. It is the file ADR-016's headline consequence asks for, the registry is human-only under RULE-01, and `01-plan.md` § 3 records the same absence. |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS. |
| `git diff --name-only` subset of `allowed_paths` | yes | Ten source paths, plus this ticket's own folder. |

**The four runners required a Node 22 toolchain and the machine's `node` is v18.19.1**, which cannot
parse the import attributes ESLint 10 and Vitest 4 use — both fail at startup with
`SyntaxError: Unexpected token 'with'` **before reading a line of this repository**, and did so on a
clean tree as well as a dirty one. `.ai/standards/tech-stack.md` names Node 22 and `_figma/.mise.toml`
pins the toolchain, so the environment was wrong rather than the standard. Node v22.12.0 was extracted
into the session scratchpad and put on `PATH` for the runs above. **Nothing in the repository was
changed for it** — no manifest, no lockfile, no configuration file, and no `.nvmrc`. A reviewer on a
correctly-provisioned machine runs the six commands as written.

## Testability contract

Every selector in § 4.5, and where it now exists.

| selector | Exists at |
|----------|-----------|
| `bulk-rejection` | `src/components/BulkRejection.tsx:122`, carrying `data-selected` |
| `bulk-rejection-reason` | `src/components/BulkRejection.tsx:185`, carrying `data-required="true"` |
| `bulk-rejection-submit` | `src/components/BulkRejection.tsx:208` |
| `bulk-rejection-select-all` | `src/components/BulkRejection.tsx:141` |
| `bulk-rejection-clear` | `src/components/BulkRejection.tsx:151` |
| `bulk-rejection-result` | `src/components/BulkRejection.tsx:226`, carrying `data-requested` and `data-rejected` |
| `bulk-rejection-error` | `src/components/BulkRejection.tsx:243`, carrying `data-code` |
| `pending-entry-row-select` | `src/routes/PendingEntries.tsx:422`, one per `pending-entry-row` |

## Where each criterion is asserted

| AC | Unit | End-to-end |
|----|------|------------|
| AC-1 | `tests/bulk-rejection.test.ts` | `tests/e2e/adm-06-bulk-reject.spec.ts` |
| AC-2, AC-6, AC-9, AC-10, AC-11, AC-18 | `tests/bulk-rejection.test.ts` | — |
| AC-3, AC-4 | `tests/bulk-rejection.test.ts` | `tests/e2e/adm-06-bulk-reject.spec.ts` |
| AC-5 | `tests/bulk-rejection.test.ts` (the numbers) | the rendering only — see below |
| AC-7 | `tests/bulk-rejection.test.ts` | — |
| AC-8 | `tests/bulk-rejection.test.ts` (the sentence) | the absence of any batch control for a member |
| AC-12, AC-13, AC-14, AC-15, AC-16, AC-17 | — | `tests/e2e/adm-06-bulk-reject.spec.ts` |

**AC-5's numbers cannot be produced from this interface, and that is a property rather than a gap.** A
partial batch needs ids the caller may not reach, and every id this screen can put in a batch is a row
it has just displayed to an admin who may reach it — which is AC-15, asserted. The partial case
therefore arises from the **datastore**: another admin deciding first, or a caller that is not this
application. Its arithmetic is asserted with real numbers in `tests/bulk-rejection.test.ts` (eight ids,
five admitted, and a second case where nothing is admitted and the answer is still a result rather
than a refusal). What the end-to-end suite asserts is the half that belongs to the screen: the result
carries `data-requested` and `data-rejected` as **two attributes** rather than one parsed sentence, and
it **survives the re-read** that removed the rows it is about.

**AC-8 against the mock demonstrates the sentence, not the refusal**, and `01-plan.md` § 3 already says
so. `tests/permission-model.test.ts` does not exist and no Supabase project is provisioned, so the
denial ADR-016's headline consequence asks for — a member's token against a real PostgreSQL — is not
issued anywhere in this repository. The refusal is clause (a) of `public.entry_enforce_decision()`,
which fires inside `public.reject_entries` exactly as it fires on a single PATCH **because the function
is `security invoker`**, and it is verified the day a project exists. This is ADM-05's position
unchanged: the same clause, doing the same work, through a different transport.

## Open questions

1. **`security invoker` is the whole safety argument and nothing in `src/` would report its loss.**
   `01-plan.md` § 3 states it and the migration's header repeats it: a `security definer` rewrite of
   `public.reject_entries` makes both `entry_update_admin` and clause (a) evaluate against the
   **owner** rather than the caller, and this feature becomes an authorization bypass with every test
   in this repository still green. It is the single most reviewable line in the ticket.
2. **The migration is not applied and applying it is human — RULE-09.** Until it is,
   `seam.rejectEntries` against the real datastore is a `404` from PostgREST, which
   `toDecisionFailure` maps to `unknown` with a sentence. The end-to-end suite drives the mock (BUG-001
   pins it) and is unaffected.
3. **Two writers, one column, and nothing enforces that they agree.** `01-plan.md` Open questions item
   1, unchanged by the implementation: `rejectEntry` writes `rejection_reason` through a PATCH and
   `rejectEntries` writes the identical column through the function. Both pass INV-03's constraint,
   which is enough for correctness and not for meaning.
4. **`supabase/db.sql`'s two `[OWED] ADM-06` labels at `:535` and `:696-698` now describe a function
   that exists in a migration.** Deliberately not swept — `01-plan.md` Open questions item 3, and
   ADR-026 decision point 6 means nothing is wrong, only behind. It wants a ticket of its own.
5. **The environment's `node` is v18.19.1 against a stack that names Node 22.** Neither ESLint nor
   Vitest starts on it. Not this ticket's to fix and no file was changed for it, but the next agent to
   run a command in this working directory meets the same wall — see *Verification run*.
