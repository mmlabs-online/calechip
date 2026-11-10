---
ticket: ADM-05
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-05T22:44:36+07:00
inputs_read:
  - .ai/board/tickets/ADM-05/01-plan.md
  - .ai/board/tickets/ADM-05/03-impl-log.md
  - .ai/board/tickets/ADM-05/99-questions.md
  - .ai/board/tickets/ADM-05/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/registry/invariants.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/git-conventions.md
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260903143000_cal02_own_entry_writes.sql
  - supabase/migrations/20260903160000_cal03_admin_entry_writes.sql
  - the working tree (`git diff`, and the six untracked files)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# ADM-05 — review report

**R1 through R8 pass.** `next_state: DONE` and not `QA`: ADR-022 removed the stage, and the enum in
`.ai/01-operating-model.md:69` carries no `QA` value.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | eleven code files, eleven `allowed_paths` — `ticket.yaml:63-88`; the four board files are the ticket folder, exempted by `scripts/check-allowed-paths.mjs:102` |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, under Node 22.11.0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/components/EntryDecision.tsx:32`, `src/routes/PendingEntries.tsx:48`, `src/routes/EditEntry.tsx:46` — all three `import { seam } from "@/lib/data"`; no file outside `src/lib/data/` names `./supabase`, `./mock` or `@supabase/` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | the table below, every row read at the line cited |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20260905190000_adm05_entry_decision.sql:84-92`; `src/lib/data/mock.ts:457-460`; `src/routes/PendingEntries.tsx:146`; `src/routes/EditEntry.tsx:184` |
| R7 | No invariant violated (RULE-07) | PASS | the per-ID table below |
| R8 | No dependency added without an ADR | PASS | `package.json` and `pnpm-lock.yaml` are both unmodified — `git status --porcelain package.json pnpm-lock.yaml` is empty. No new import in any of the eleven files names a package that was not already a dependency |

### R1, read against the working tree rather than against the script

`node scripts/check-allowed-paths.mjs` exits 0 reporting **`0 changed file(s)`**, and that pass is
**vacuous**: it diffs `origin/main...HEAD` and ADR-006 leaves the whole ticket uncommitted until
`/ship`. The real check is the working tree, and it was done by hand:

- eleven changed or added code files, every one of them a literal in `ticket.yaml:63-88`;
- `tests/e2e/adm-04-worklist.spec.ts` among them **legitimately** — it is the eleventh path, added by
  the 2026-09-05 amendment (`01-plan.md:653` and `:770-787`, `99-questions.md`) before the edit was made, not
  after. The first cycle stopped rather than write it, which is RULE-03 working;
- four files under `.ai/board/tickets/ADM-05/`, which is the ticket folder and is exempt;
- nothing else. No twelfth path, no `supabase/db.sql`, no fixture, no registry file.

**The bounded edit was actually bounded**, which `03-impl-log.md:235-240` asks a reviewer to check
rather than take on trust. The diff of `tests/e2e/adm-04-worklist.spec.ts` is three lines out and six
in: the `textarea` and `button` count-0 assertions and the one-line comment above them, replaced by a
six-line comment naming ADM-05. `form` and `input` stay at 0
(`tests/e2e/adm-04-worklist.spec.ts:280-281`), the four `pending-entry-row-*` / `pending-entries-*`
selector-name assertions above (`:264-271`) and the whole AC-15 vocabulary block below (`:283`
onward) are byte-identical to what shipped.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `entry_decision_not_permitted` | `src/lib/domain/types.ts:91` | yes — added to the `FailureCode` union, nothing existing changed |
| § 4.1 `rejection_reason_required` | `src/lib/domain/types.ts:96` | yes |
| § 4.2 `approveEntry(entryId: string): Promise<Result<Entry>>` | `src/lib/data/index.ts:696`, `supabase.ts:1437`, `mock.ts:1479` | yes — same name and arity in both implementations, so `tests/seam-parity.test.ts` passes unedited |
| § 4.2 `rejectEntry(entryId: string, reason: string): Promise<Result<Entry>>` | `src/lib/data/index.ts:714`, `supabase.ts:1466`, `mock.ts:1509` | yes |
| § 4.2 *"sends `status` and nothing else"* | `src/lib/data/supabase.ts:1438-1443` | yes — `.update({ status: "approved" })`. No `approved_by`, no `approved_at`, no `rejection_reason`, no `tentative` |
| § 4.2 *"must count the affected rows"* | `src/lib/data/supabase.ts:1447-1450`, `:1480-1483` | yes — `.select(ENTRY_COLUMNS).returns<EntryRow[]>()` then `if (!row)` → `entry_not_permitted`. A filtered row answers 200 with an empty body and is caught here, which is AC-16 and AC-17 |
| § 4.2 blank reason refused before the write | `src/lib/data/supabase.ts:1467-1469`, `mock.ts:1510-1512` | yes — `reason.trim() === ""` → `rejection_reason_required`, in both |
| § 4.2 the mock's clause (a) | `src/lib/data/mock.ts:446-487` | yes — `applyDecision`, one function for both clauses, declared as a second implementation of a control at `:429-444` |
| § 4.3 property 1 — `create or replace`, no second trigger | `supabase/migrations/20260905190000_adm05_entry_decision.sql:56`, and `:151-153` records why the trigger is not recreated | yes — `grep -n entry_enforce_decision supabase/migrations/` shows one `create trigger`, CAL-01's |
| § 4.3 property 2 — clause order `updated_at` → (a) → (b) → (c) | `…adm05_entry_decision.sql:66`, `:84`, `:112`, `:135` | yes, and in that order |
| § 4.3 property 3 — clause (c) and the `updated_at` line transcribed unchanged, "additions only" | diff of the two function bodies against `20260903143000_cal02_own_entry_writes.sql:76-111` | yes for the executable body — `:66` and `:135-145` are byte-identical to CAL-02's, and the only removed lines in the whole diff are three comment lines reworded into the `(c)` label the same section requires |
| § 4.3 property 4 — `security invoker`, no new grant on `is_admin` | `…adm05_entry_decision.sql:57`; no `grant … is_admin` anywhere in the file | yes |
| § 4.3 property 5 — `entry_update_admin` not created here | absent from the file; CAL-03 has it at `20260903160000_cal03_admin_entry_writes.sql:80` | yes |
| § 4.3 / § 6 the grant | `…adm05_entry_decision.sql:170` | yes — `grant update (status, rejection_reason) on public.entry to authenticated`, exactly two columns, in the same file as clause (a) |
| § 4.4 the panel — no read, no query, no role check | `src/components/EntryDecision.tsx:31-33` imports `useState`, `seam` and two types and nothing else; the only calls are `seam.approveEntry` (`:90`) and `seam.rejectEntry` (`:143`) | yes |
| § 4.4 the worklist — panel on each row, `load()` and never a splice | `src/routes/PendingEntries.tsx:395` — `onDecided={load}`; `pending-entry-row-link` still at `:381` | yes |
| § 4.4 the edit screen, change 1 — panel for an admin only | `src/routes/EditEntry.tsx:184-190` | yes — inside `{admin ? … : null}`, the branch this file already makes at `:84` |
| § 4.4 the edit screen, change 2 — reason and time for **both** roles | `src/routes/EditEntry.tsx:235-247` | yes — outside the `admin` branch, gated on `entry.status === "rejected"` only |
| § 4.4 the edit screen, change 3 — one sentence on the star | `src/routes/EditEntry.tsx:205-208` | yes, beside `edit-entry-status` at `:193` |
| § 4.4 no calendar view touched | `MonthView.tsx`, `WeekView.tsx`, `YearView.tsx`, `OverloadWarning.tsx`, `TeamEntries.tsx` are all absent from the changed set | yes |
| § 4.5 the twelve selectors | `EntryDecision.tsx:76, :87, :100, :122, :140, :152, :176`; `EditEntry.tsx:237, :241, :205`; `edit-entry-status` and `pending-entries-count` unchanged | yes — all present, `entry-decision-approve` absent when `status === "approved"` (`EntryDecision.tsx:85`), `entry-decision-error` carries `role="alert"` and `data-code` (`:177-178`) |
| § 5 seam parity | `tests/seam-parity.test.ts` unedited and green in the 182-test run | yes |

**Measured, not taken from the log.** `pnpm exec tsc --noEmit` exit 0; `pnpm exec eslint .` exit 0;
`pnpm exec vitest run` → **9 files, 182 tests, 182 pass**; `pnpm exec playwright test` → **160 passed,
0 failed**, `cal-02-edit-delete-entry.spec.ts` and `cal-03-admin-edit-entry.spec.ts` — the two safety
nets § 7 keeps, and the two where a reversed clause order would show first — passing unedited.
`node scripts/check-docs.mjs` → 0 errors, the same 2 advisory D8 warnings that predate this ticket.
Lint and the two suites need Node 22 on the path (`eslint.config.js:6` uses an import attribute Node
18 cannot parse); 22.11.0 was fetched into this session's scratchpad, as CAL-08's, ADM-04's and this
ticket's logs all record. Nothing in the repository was edited to make a command run.

## R6 detail

Section 3 consumes four rows of `.ai/standards/rbac-and-security.md` (`:30`, `:33`, `:35`, `:36`) and
amends none — the file is not in the changed set, so RULE-01 is not engaged.

- **`Approve or reject another member's entry` (`:35`), member ❌ / admin ✅.** Two objects together:
  `entry_update_admin` (CAL-03, shipped, `20260903160000_cal03_admin_entry_writes.sql:80`) admits the
  row, and **clause (a)** refuses the decision columns to anyone `public.is_admin(v_uid)` is false for
  — `…adm05_entry_decision.sql:84-92`. Both are required and neither is sufficient, which is what
  section 3 says.
- **`Approve or reject their own entry` (`:36`), member ❌ / admin ✅.** Clause (a) alone, and it is
  the whole ticket. `entry_update_own` admits a member's own row and cannot be narrowed; clause (a)
  fires on `new.status is distinct from old.status` regardless of ownership (`:84`). AC-8's forged
  approval is refused there and by nothing in `src/`. The admin half is AC-10 and needs no branch —
  `src/lib/data/mock.ts:1489-1491` reaches the row through `ownsEntry` and then passes the guard.
- **`Edit or delete their own entry` (`:33`), unchanged.** `updateEntry` and `deleteEntry` are
  untouched in both implementations, and the grant at `…adm05_entry_decision.sql:170` is additive —
  CAL-02's six columns are not restated and not revoked. Clause (a) does not fire on an ordinary edit
  because it runs **before** clause (c), so `new.status` still equals `old.status` at that point
  (`:84` above `:135`). `cal-02-edit-delete-entry.spec.ts` and `cal-03-admin-edit-entry.spec.ts` pass
  unedited, which is the assertion from outside.
- **`Read any entry in the team` (`:30`), unchanged.** No new read; AC-15 renders columns the shipped
  `entry_select_team` already returns.

**The affordances, and they are affordances.** `/entries/pending` is admin-only at
`src/routes/PendingEntries.tsx:146`; the panel on the edit screen is inside the admin branch at
`src/routes/EditEntry.tsx:184`. Neither refuses anybody holding a token, and both files say so in
their own headers. The mock reproduces clause (a) at `src/lib/data/mock.ts:457-460` and declares
itself a second implementation at `:429-444`.

**Where authorization on `entry` now lives is two places, and section 3 warned a reviewer of it.**
The policies, and clause (a) of the trigger. Read alone, the policies say a member may approve their
own entry; that reading is wrong and the trigger is why.

## R7 detail

One row per ID in `invariants_touched: [INV-02, INV-03, INV-05]` — `ticket.yaml:40`, exactly the three
the ADM-05 row in `features.md` lists.

| Invariant | Held by | Citation |
|---|---|---|
| **INV-02** — *an approved entry whose dates, type, portion or tentative flag change returns to `pending`; editing only the note does not* (`invariants.md:34`) | **Clause (c) of `public.entry_enforce_decision()`, byte-identical to CAL-02's and still running last.** Verified by extracting both function bodies and diffing them, not by reading: the predicate and its four assignments are unchanged, and the only removals in the whole diff are three comment lines. The order matters and holds: (a) at `:84` reads what the client sent, (c) at `:135` does the reset, so a member editing dates on an approved entry passes the guard and is then reset — reversed, the guard would see a `status` change made by the reset and refuse a legitimate edit. `note` is absent from the predicate, which is the exemption. Actor-blind: no `is_admin` in the condition. **What changed is that the invariant is now reachable** — until this ticket nothing could set `status` to `approved` — and AC-12 (`tests/entry-decision.test.ts:306`) and AC-14 (`:355`) are its two live cases | `supabase/migrations/20260905190000_adm05_entry_decision.sql:135-145` vs `20260903143000_cal02_own_entry_writes.sql:97-107` |
| **INV-03** — *a rejected entry always carries a non-empty rejection reason* (`invariants.md:35`) | **The check constraint `entry_rejection_reason_iff_rejected`, a biconditional, untouched by this ticket.** `(status = 'rejected') = (rejection_reason is not null and btrim(rejection_reason) <> '')` — so it holds both directions, and every path this ticket opens was traced against it: `rejectEntry` writes `status` and `rejection_reason` in **one statement** (`supabase.ts:1472-1476`), so neither side is ever set alone; clause (b) nulls the reason on approval (`…adm05:116`), which the biconditional **forces** rather than permits, and that is AC-4; clause (c) nulls it with the reset (`:144`), which is AC-13. No path sets `status = 'rejected'` without a reason — `approveEntry` never writes `rejected`, and `updateEntry` cannot write `status` at all. The seam's blank-reason refusal is an **affordance** and is documented as one in three places; the constraint is the mechanism, and `toDecisionFailure`'s `23514` case (`supabase.ts:456-457`) is what a caller that is not this application meets | `supabase/migrations/20260903103000_cal01_entry.sql:93-96` |
| **INV-05** — *a tentative entry counts toward the absence count exactly as a non-tentative one does* (`invariants.md:37`) | **Held by absence, and the absence is checkable in four places rather than asserted.** The grant names `status` and `rejection_reason` and not `tentative` (`…adm05:170`); clause (b) writes `approved_by`, `approved_at` and `rejection_reason` and not `tentative` (`:114-119`); `applyDecision` in the mock writes the same three (`mock.ts:466-481`); and the seam sends one column on the wire (`supabase.ts:1440`). `grep tentative` over the migration returns only clause (c)'s substantive-change predicate and two comments — no assignment. AC-6 (`tests/entry-decision.test.ts:182`) is the case that would fail if any of the four grew a column | `supabase/migrations/20260905190000_adm05_entry_decision.sql:109-119` |

**INV-04 and INV-01 are correctly absent.** INV-04 — rejecting changes what the count *reads* and
computes no count, the argument that kept it off CAL-01 and CAL-08. INV-01 — ADR-011 leaves a rejected
entry occupying its slots, and nothing here touches the exclusion constraint; that is also what makes
AC-13's edit path the likely one rather than an edge case.

## Findings

None. No check failed, so no routing row applies.

## Verdict

**PASS.** `next_state: DONE`.

Two things a reader of this report should have, neither of which is a finding and neither of which
changes the gate:

1. **The migration is unapplied and applying it is human — RULE-09** — and this one more than most.
   It opens two columns to `authenticated` in the same file that closes them behind clause (a);
   applying the grant without the function would hand every member the exact write ADR-016 exists to
   refuse. `03-impl-log.md` Open questions item 4 says the same, and it is true of the merge as well
   as of the file.
2. **AC-8 and AC-9 are satisfied against the mock, where `applyDecision` is a second implementation
   of clause (a).** ADR-016's own headline consequence asks for a member PATCHing
   `{"status":"approved"}` against a real PostgreSQL with a member's token; no project is provisioned
   and `tests/permission-model.test.ts` does not exist. On the mock those two criteria demonstrate
   **the sentence, not the refusal**. This is not new to this ticket and is not withheld anywhere —
   `01-plan.md` § 4.2, `03-impl-log.md` Open questions item 2 and the header of
   `tests/entry-decision.test.ts` each say it where a reader of a green run meets it. It is recorded
   here because it is the one place this ticket's evidence is weaker than it looks, and a reviewer who
   did not say so would be the reason nobody noticed.

3. **One comment went stale inside this ticket's own run, and it is three lines of prose.**
   `src/routes/PendingEntries.tsx:377-380` says *"ADM-05 01-plan.md section 7 requires that suite to
   pass UNEDITED"*. It was written in the first cycle, when § 7 did say so; the amendment later that
   evening moved `tests/e2e/adm-04-worklist.spec.ts` into `allowed_paths` and the suite **was** edited,
   within the bound § 7 now sets. The sentence the comment is attached to is still true — the row link
   keeps its name, destination and position, and the four selector-name assertions still hold it — so
   nothing about the code or the tests is wrong. It is recorded because it is the kind of line a later
   reader follows into a plan that says the opposite, and it is not a finding: no R-check covers the
   accuracy of a comment, and failing the gate on three words of prose would be the wrong instrument.

**The most reviewable thing in this ticket is not a defect and is a human's to weigh at merge.**
Clause (a) is authorization in the database but **not in a policy**, and ADR-005 says row-level
security *"is the only mechanism that enforces"* it. ADR-016 argues the exception inside the envelope
and is `ACCEPTED by tech-lead-design` under ADR-008, and `01-plan.md` § 6 carries the tension forward
rather than hiding it. Nothing in this implementation exceeds what that ADR decided — the file adds
two objects and no third, and every statement in it is transcribed from ADR-016 § 1 or from
`supabase/db.sql` § 4. If the operator reads *"and nowhere else"* literally and disagrees, ADR-008's
revert condition fires and that is a decision at the pull request, not a gate here.
