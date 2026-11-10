---
ticket: CAL-07
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-05T01:27:37+07:00
inputs_read: [ .ai/board/tickets/CAL-07/01-plan.md, .ai/board/tickets/CAL-07/03-impl-log.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: QA
---

# CAL-07 — review report

Isolated dispatch, files only. No channel to the Developer existed and none was used.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | six code paths changed, each named in `.ai/board/tickets/CAL-07/ticket.yaml:73-78`; `node scripts/check-allowed-paths.mjs` exit 0 |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` exit 0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` exit 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/components/OverloadWarning.tsx:27` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | table below |
| R6 | Permission gating matches plan section 3 | PASS | `src/components/OverloadWarning.tsx:121-127` |
| R7 | No invariant violated (RULE-07) | PASS | table below |
| R8 | No dependency added without an ADR | PASS | `git status --porcelain package.json pnpm-lock.yaml` returns empty |

### R1 — the file list

`git status --porcelain` reports nine paths. Six are code and every one is an `allowed_paths` glob:
`src/lib/draft-entry.ts`, `src/components/OverloadWarning.tsx`, `src/components/EntryForm.tsx`,
`src/routes/EditEntry.tsx`, `tests/draft-entry.test.ts`, `tests/e2e/cal-07-overload-warning.spec.ts`
— `ticket.yaml:73-78`. The other three are the ticket's own working directory (`ticket.yaml`,
`01-plan.md`, `03-impl-log.md`), which RULE-03 does not govern and `check-allowed-paths.mjs` does
not diff.

`src/routes/NewEntry.tsx`, `src/routes/MonthView.tsx`, `src/lib/data/absence.ts`,
`src/lib/data/index.ts`, `src/lib/domain/types.ts`, `tests/absence.test.ts`,
`tests/seam-parity.test.ts` and `supabase/**` are all unchanged, which is what plan section 7
requires of each of them by name.

`check-allowed-paths.mjs` reports `0 changed file(s)` because it diffs `origin/main...HEAD` and
nothing is committed before `/ship` (ADR-006). The list above was therefore read from
`git status --porcelain` directly rather than taken from that exit code.

### R2, R3 — the runners

| Command | Exit |
|---|---|
| `pnpm exec tsc --noEmit` | 0 |
| `pnpm exec eslint .` | 0 |
| `pnpm exec vitest run` | 0 — 5 files, 108 tests, all pass |
| `pnpm exec playwright test` | 0 — 108 tests, all pass, 13 of them this ticket's |

R2 and R3 are the gate; the two suites are recorded because they were run in this session and
because `tests/absence.test.ts` and `tests/seam-parity.test.ts` pass **unedited**, which is what
plan section 5 stakes INV-04's single definition on.

### R4 — the seam

`src/components/OverloadWarning.tsx:27` imports `seam` from `@/lib/data`, and nothing else in this
ticket reaches a datastore: the reads at `:121-127` and `:166` are `seam.getTeam`,
`seam.listMembers`, `seam.getCurrentMember` and `seam.listTeamEntriesOverlapping`. No `@supabase/*`
import and no `./supabase` or `./mock` appears in any file this ticket touched;
`eslint.config.js:60-79` is the enforcement and it exits 0.

`src/components/OverloadWarning.tsx:31-37` imports `absenceCountsFor`, `absentEntriesFor`,
`currentMemberCount`, `eachDateInRange` and `isOverloaded` from `@/lib/data/absence` **directly**.
That is not a bypass: `absence.ts` fetches nothing, names no column and constructs no client
(`src/lib/data/absence.ts:20-21`), `.ai/standards/architecture.md:78` puts the count inside the seam
by design, and `src/routes/MonthView.tsx:38,49` already makes the identical pair of imports.

`src/lib/draft-entry.ts:14` imports types and nothing else.

### R6 — permission model

Plan section 3 adds no row and states that no check runs anywhere in this feature. That is what the
code does:

- Four reads, all permitted to both roles by policies that already shipped —
  `src/components/OverloadWarning.tsx:121-127` (`getTeam` through `team_select_own`, `listMembers`
  through `member_select_team`, `getCurrentMember`) and `:166` (`listTeamEntriesOverlapping` through
  `entry_select_team`).
- No branch on `role` exists in any file this ticket touched, and nothing renders conditionally on
  one.
- The write path is untouched: `src/components/EntryForm.tsx:289` still reads
  `disabled={!complete || submitting}`, and the submit handler is outside the diff, so saving onto a
  crowded day is the same permission as saving anything (AC-15).
- `.ai/standards/rbac-and-security.md` is absent from the diff, which is AC-15 asserted by the file
  list itself and is why it carries no test.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `DraftEntryInput`, six fields | `src/lib/draft-entry.ts:27-34` | yes — `memberId`, `type`, `portion`, `startDate`, `endDate`, `tentative`, none optional |
| § 4.1 `DRAFT_ENTRY_ID` | `src/lib/draft-entry.ts:43` | yes — `"draft"`, exported, not a uuid |
| § 4.1 `withDraft(entries, draft, excludeEntryId)` | `src/lib/draft-entry.ts:71-98` | yes — `readonly Entry[]` in, `Entry[]` out; excludes then appends at `:76-80`; the input array is not mutated |
| § 4.1 the fixed fields | `src/lib/draft-entry.ts:82-95` | yes — `id` is `DRAFT_ENTRY_ID`, `status` is `pending`, `rejectionReason` / `note` / `approvedBy` / `approvedAt` null, `createdAt` / `updatedAt` the empty string, exactly as § 4.1 names them |
| § 4.1 `isUsableRange(startDate, endDate)` | `src/lib/draft-entry.ts:108-110` | yes — both present and `start <= end`, compared as strings, no `Date` constructed |
| § 4.1 no change to `src/lib/domain/types.ts` | absent from the diff | yes |
| § 4.2 `OverloadWarningProps`, eight props | `src/components/OverloadWarning.tsx:57-72` | yes — the eight names and both nullable types |
| § 4.2 `getTeam` and `listMembers` once on mount | `src/components/OverloadWarning.tsx:116-140` | yes — one effect, deps `[ownerId]` |
| § 4.2 `getCurrentMember` only when `ownerId` is null | `src/components/OverloadWarning.tsx:126` | yes — the ternary resolves to `Promise.resolve(null)` otherwise |
| § 4.2 `listTeamEntriesOverlapping` on every usable range, debounced | `src/components/OverloadWarning.tsx:163-174` | yes — 300 ms, named once as `DEBOUNCE_MS` at `:55` |
| § 4.2 the stale-answer guard | `src/components/OverloadWarning.tsx:150,153,167,171,177` | yes — a monotonic request number; the cleanup bumps it, and an answer whose id is stale touches no state |
| § 4.2 the composition, in that order | `src/components/OverloadWarning.tsx:187-204` | yes — `withDraft`, then `absenceCountsFor`, `absentEntriesFor`, `currentMemberCount`, `eachDateInRange(...).filter(isOverloaded)` |
| § 4.2 renders `null` unless crowded | `src/components/OverloadWarning.tsx:211` | yes — one early return; `:184` makes in-flight, failed and unusable all yield an empty list |
| § 4.3 the region, `role="status"`, `bg-rose-100` | `src/components/OverloadWarning.tsx:214-225` | yes — `role="status"` and `aria-live="polite"`, never `alert` |
| § 4.3 one block per crowded date, ascending | `src/components/OverloadWarning.tsx:226-232` | yes — `data-date`, `data-count`, `data-current-members`; ascending because `eachDateInRange` is (`src/lib/data/absence.ts:59-64`) |
| § 4.3 the per-person marker | `src/components/OverloadWarning.tsx:245-270` | yes — peach and mint at `:260`, dashed at reduced opacity when tentative at `:264`, the star when approved at `:269`, `data-draft` at `:253` |
| § 4.4 `ownerId?` and `excludeEntryId?`, optional, defaulting to null | `src/components/EntryForm.tsx:92,96,112,113` | yes |
| § 4.4 the element between the note field and the error paragraph | `src/components/EntryForm.tsx:269-277` | yes — the note field ends at `:259` and the error paragraph begins at `:281` |
| § 4.4 nothing else in EntryForm changes | `src/components/EntryForm.tsx:287-289` | yes — the submit control's `data-testid`, label and `disabled` are outside every diff hunk |
| § 4.5 the edit route | `src/routes/EditEntry.tsx:154-155` | yes — `ownerId={entry.memberId}` and `excludeEntryId={entry.id}`, and nothing else on that screen |
| § 5 seam impact: none | no file under `src/lib/data/` in the diff | yes — `tests/seam-parity.test.ts` passes unedited |
| § 6 schema delta: none | no file under `supabase/` in the diff | yes — and `tests/draft-entry.test.ts:325,353` asserts it from the migrations rather than from the diff |

**The one declared addition.** `data-type` on `<prefix>-overload-person`
(`src/components/OverloadWarning.tsx:251`) goes beyond the four attributes § 4.3's table names.
`03-impl-log.md` § *Deviations from the design* declares it with its reason: § 4.3 requires the
marker to be drawn PTO peach and WFH mint, and `.ai/standards/testing-standards.md` forbids
asserting on a style class, so that requirement would otherwise be unobservable through the
interface. Nothing but the acceptance suite reads it. Accepted as a declared addition rather than a
deviation — it is the same shape CAL-02 and CAL-03 declared before it, and it changes no behaviour.

## R7 detail

One row per ID in `invariants_touched`.

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 | The prospective count is `absenceCountsFor(withDraft(...), range, roster)` and nothing else. `src/lib/draft-entry.ts` builds a **row** and computes nothing: there is no `+ 1`, no weight table and no portion arithmetic anywhere in this ticket's code, so INV-04 keeps exactly one implementation and it is CAL-04's. `absence.ts` is outside `allowed_paths` and outside the diff, and `tests/absence.test.ts` passes unedited. The strict `>` is consulted, not reimplemented. | `src/lib/draft-entry.ts:79-97` builds the row; `src/components/OverloadWarning.tsx:193-198` is the only place a number is produced and all four calls there are imported from `@/lib/data/absence`; `src/lib/data/absence.ts:342-345` still holds the comparison |
| INV-05 | `walk` never reads `tentative` (`src/lib/data/absence.ts:121-148`) and this ticket adds no branch on it either: `withDraft` carries the flag onto the row and consults it nowhere. The only place this ticket reads `tentative` is the render, where it picks a border. The count is identical ticked and unticked — asserted on the number and on the screen. | `src/lib/draft-entry.ts:88` (carried, not consulted); `src/components/OverloadWarning.tsx:252,264` (drawn only); `tests/draft-entry.test.ts:180`; `tests/e2e/cal-07-overload-warning.spec.ts:266` |
| INV-07 | The draft is attributed to a named member on every path and to nobody by default. On create the owner is the caller, resolved once on mount; on an admin edit it is the **entry's** owner, so the admin is never the one counted. A draft whose owner cannot be resolved leaves `base` null and nothing is drawn at all, rather than a count attributed to nobody; a draft whose owner is off the roster counts for nobody because `countsOn` refuses it, and that silent outcome is asserted rather than left to be discovered. No write path is touched. | `src/components/OverloadWarning.tsx:129,131`; `src/routes/EditEntry.tsx:154`; `src/lib/data/absence.ts:106-107`; `tests/draft-entry.test.ts:242,256` |

**INV-06 is relied on and not touched**, which is why its absence from the list is correct: passing
the draft as an entry-shaped value leaves the portion arithmetic inside `walk`
(`src/lib/data/absence.ts:143-146`), so a five-day `am` draft charges 0.5 to each of five days —
asserted at `tests/draft-entry.test.ts:159`.

**INV-01 and INV-02 are not touched.** No write path changed, and `src/lib/draft-entry.ts:89` fixes
the draft to `pending` rather than reproducing `entry_enforce_decision()`, which 01-plan.md Open
question 3 records as a deliberate and narrower inexactness than a second implementation of INV-02
in TypeScript would be. **INV-03** is untouched: `rejectionReason` is null on a row that is never
written (`src/lib/draft-entry.ts:90`).

No invariant here is held by a UI affordance. The three above are held by the composition and by
`absence.ts`; the warning itself refuses nothing, which is charter refusal 6 and is the point of the
feature.

## R8 detail

`package.json` and `pnpm-lock.yaml` are both absent from `git status --porcelain`. No dependency was
added, removed or moved, so no ADR is owed.

The one change that *would* have escalated — an `AbortSignal` parameter on
`listTeamEntriesOverlapping`, which the idea file asks for and which
`.ai/01-operating-model.md:375` makes XL — is not present. `src/lib/data/index.ts` is outside the
diff, and `src/components/OverloadWarning.tsx:150-180` guards with a request number instead, which
delivers the observable requirement that a stale answer never paints.

## Findings

None.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | — | — | — |

## Observations — not findings, and not part of this gate

Recorded because they are true and the next stage reads this file, not because either bears on the
verdict.

1. **The board skipped `READY` and `IN_PROGRESS`, and `ticket.yaml`'s `plan` gate row still reads
   `passed: false`** while `01-plan.md`'s front-matter reads `gate: PASS`. `03-impl-log.md` Open
   question 1 and `ticket.yaml:8-18` both carry it. It is the orchestrator's to reconcile and it is
   not this stage's to write — REVIEW writes `04-review.md` and nothing else. `/ship` reads those
   gate rows.
2. **AC-15 and AC-21 carry no test, both deliberately**, per `03-impl-log.md` Open question 2.
   AC-15 is asserted by the file list, since `.ai/standards/rbac-and-security.md` is outside
   `allowed_paths` and outside the diff; AC-21's failing or truncated read cannot be provoked
   without a provisioned project, and the behaviour is the single early return at
   `src/components/OverloadWarning.tsx:211`. Neither absence is a missing check under R1 to R8.

## Verdict

**PASS.** All eight checks pass, each citing `file:line`. `next_state: QA`.
