---
ticket: CAL-02
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-03T14:00:23+07:00
inputs_read:
  - .ai/board/tickets/CAL-02/01-plan.md
  - .ai/board/tickets/CAL-02/03-impl-log.md
  - .ai/board/tickets/CAL-02/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/registry/invariants.md
  - .ai/standards/architecture.md
  - supabase/migrations/20260903103000_cal01_entry.sql
  - git diff
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# CAL-02 — review report

Isolated dispatch, fresh session, files only. No Developer was spoken to and no message channel was
opened — `chat_before_verdict: none` is literally true.

`next_state` is `DONE` and not `QA`: ADR-022 removed the QA stage, and the lifecycle in
`.ai/01-operating-model.md:36` reads `IN_PROGRESS -> REVIEW -> DONE`. The template's front-matter
still ships `next_state: QA`, which is stale — see *Note on the template* at the end.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/CAL-02/ticket.yaml:50-61` — see R1 detail |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/EditEntry.tsx:22`, `src/routes/NewEntry.tsx:23`, `src/components/EntryForm.tsx:25-26` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | see R5 detail |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20260903143000_cal02_own_entry_writes.sql:41`, `:48`, `:134-137`, `:148-150`; `src/App.tsx:131-134` |
| R7 | No invariant violated (RULE-07) | PASS | see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --stat package.json pnpm-lock.yaml` → empty; neither file is in `ticket.yaml:50-61` |

## R1 detail

`git status --porcelain -uall` lists fourteen paths. Three are the ticket folder, which
`scripts/check-allowed-paths.mjs:131` exempts by name; the other eleven are exactly the eleven globs
of `ticket.yaml:50-61`, one file each.

| Changed path | Matched by |
|---|---|
| `supabase/migrations/20260903143000_cal02_own_entry_writes.sql` | `ticket.yaml:51` |
| `supabase/seed.sql` | `ticket.yaml:52` |
| `src/lib/fixtures.ts` | `ticket.yaml:53` |
| `src/lib/data/index.ts` | `ticket.yaml:54` |
| `src/lib/data/supabase.ts` | `ticket.yaml:55` |
| `src/lib/data/mock.ts` | `ticket.yaml:56` |
| `src/components/EntryForm.tsx` | `ticket.yaml:57` |
| `src/routes/NewEntry.tsx` | `ticket.yaml:58` |
| `src/routes/EditEntry.tsx` | `ticket.yaml:59` |
| `src/App.tsx` | `ticket.yaml:60` |
| `tests/e2e/cal-02-edit-delete-entry.spec.ts` | `ticket.yaml:61` |
| `.ai/board/tickets/CAL-02/{01-plan,03-impl-log,ticket}.{md,yaml}` | ticket folder, exempt — `scripts/check-allowed-paths.mjs:131` |

Nothing outside the list was touched. `tests/e2e/cal-01-create-entry.spec.ts` and
`tests/seam-parity.test.ts` are both absent from the diff, which is what `01-plan.md:556-559` put
them outside `allowed_paths` for.

**`node scripts/check-allowed-paths.mjs` exits 0 but its PASS is vacuous here**, and that is worth
recording rather than quoting. It diffs `origin/main...HEAD`
(`scripts/check-allowed-paths.mjs:123`), and this ticket is entirely uncommitted, so it reports
`0 changed file(s)`. It becomes a real control at `/ship`, once the branch carries commits. R1 above
was therefore computed from the working tree, not from that script's exit code.

## R2, R3 detail

```
pnpm exec tsc --noEmit   → 0
pnpm exec eslint .       → 0
pnpm exec vitest run     → 0   (1 file, 2 tests — seam parity)
pnpm exec playwright test → 0  (44 passed, 0 failed)
```

The Playwright run is not a gate item and is recorded because it is the evidence for one: CAL-01's
eleven acceptance tests pass **unedited** against the extracted `EntryForm`, which is the safety net
`01-plan.md:363-368` names for the extraction. `pnpm exec playwright test --list` counts twelve
CAL-02 tests, AC-1 to AC-12, one per criterion.

## R4 detail

`eslint.config.js:31-48` is the mechanism (RULE-02), and it exits 0. Read independently of the rule:
`grep -rn supabase src --include='*.ts' --include='*.tsx'` outside `src/lib/data/` returns only
comments, no imports. The two new files reach the datastore through the seam and nothing else:

- `src/routes/EditEntry.tsx:22` — `import { seam } from "@/lib/data"`, and the only calls are
  `seam.listOwnEntries()` at `:50` and `seam.updateEntry(...)` at `:72`.
- `src/components/EntryForm.tsx:25-26` — imports `react` and a domain type. **It reaches nothing**;
  every write goes out through the `onSubmit` prop (`:82`), which is why the same component serves
  both routes.
- `src/routes/NewEntry.tsx:23`, with `seam.deleteEntry` at `:74`.

## R5 detail

One row per contract item in `01-plan.md` section 4.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 `UpdateEntryInput` — six fields, separate interface, no `memberId`/`status`/`rejectionReason` | `src/lib/data/index.ts:74-81` | Yes. Six fields, field-for-field as `01-plan.md:286-293`. A declared `interface`, not an alias of `CreateEntryInput` |
| §4.1 `updateEntry(entryId, input): Promise<Result<Entry>>` | `src/lib/data/index.ts:326` | Yes |
| §4.1 — real implementation counts rows, never `!error` | `src/lib/data/supabase.ts:746-772`; the row count at `:766-769` | Yes. `.select(ENTRY_COLUMNS)` at `:761`, then `if (!row) return entry_not_permitted` |
| §4.1 — mock returns `entry_not_permitted` for a row that is not the caller's | `src/lib/data/mock.ts:770-776` — `entries.find(e => e.id === entryId && e.memberId === me.id)` | Yes. This is the owner comparison `01-plan.md:407-410` names as the subtle shape of the ticket |
| §4.1 — `entry_not_permitted` covers both "not yours" and "no such entry" | `src/lib/data/mock.ts:770-776`, `src/routes/EditEntry.tsx:94-108` | Yes. One code, one sentence, and `EditEntry.tsx:102` asserts nothing about the id |
| §4.1 `deleteEntry(entryId): Promise<Result<void>>` | `src/lib/data/index.ts:339` | Yes |
| §4.1 — real delete asks for the deleted representation and counts it | `src/lib/data/supabase.ts:782-796`; `.select(ENTRY_COLUMNS)` at `:787`, count at `:792` | Yes. This is the item §4.1 flags as the one most likely to be got wrong, and it is not |
| §4.1 — no change to `src/lib/domain/types.ts` | absent from `git status --porcelain -uall` | Yes |
| §4.2 the failure mapping, matched on SQLSTATE only | `src/lib/data/supabase.ts:258-283` — `23P01`→`overlapping_entry`, `23514`→`invalid_date_range`, `42501`/`PGRST301`→`entry_not_permitted` | Yes. No constraint-name or message-text match anywhere in the function |
| §4.2 — inverted range refused before the round trip (AC-11) | `src/lib/data/supabase.ts:747-748`, `src/lib/data/mock.ts:749-757` | Yes, in both implementations |
| §4.3 `EntryForm` — extraction, prefix-driven selectors | `src/components/EntryForm.tsx:150`, `:159`, `:175`, `:192`, `:209`, `:224`, `:236`, `:245`, `:251` | Yes. Every selector is `${testIdPrefix}-*`; CAL-01's eleven tests pass unedited |
| §4.3 `EditEntry` at `/entries/:id/edit`, loaded from `listOwnEntries`, no second seam read | `src/routes/EditEntry.tsx:50-52`; route at `src/App.tsx:131-134` | Yes. `listOwnEntries` is the only read; there is no `getEntryById` |
| §4.3 `edit-entry-status` carrying `data-status` | `src/routes/EditEntry.tsx:134` | Yes |
| §4.3 `edit-entry-approved-by`, present only when an approver is named | `src/routes/EditEntry.tsx:142-151` | Yes, conditional on `entry.approvedBy` |
| §4.3 `edit-entry-not-found` | `src/routes/EditEntry.tsx:97` | Yes |
| §4.3 `own-entry-row-edit` → `/entries/:id/edit` | `src/routes/NewEntry.tsx:175-177` | Yes |
| §4.3 `own-entry-row-delete` | `src/routes/NewEntry.tsx:205` | Yes |
| §4.3 `own-entry-delete-confirm` | `src/routes/NewEntry.tsx:185` | Yes |
| §4.3 `own-entry-row-status` carrying `data-status` | `src/routes/NewEntry.tsx:162-163` | Yes |
| §5 seam impact — two functions added, no existing signature changed | `tests/seam-parity.test.ts` passes unedited (`pnpm exec vitest run` → 0, 2 tests) | Yes |
| §6 item 1 — update grant of exactly six columns | migration `:41-42` | Yes. `member_id`, `status`, `rejection_reason` all absent |
| §6 item 2 — `updated_at` inside `entry_enforce_decision()`, before clause (c) | migration `:84`, clause (c) at `:97-107` | Yes |
| §6 item 3 — `entry_update_own`, `using` and `with check` both `member_id = (select auth.uid())` | migration `:134-137` | Yes |
| §6 item 4 — `entry_delete_own` plus the table-level `grant delete` | migration `:148-150` and `:48` | Yes. Both present; §6 item 4 says neither alone is sufficient |

**The four deviations declared in `03-impl-log.md` were checked and none of them breaks a contract
item.**

1. `toEntryFailure` taking the refusal sentence as a parameter (`src/lib/data/supabase.ts:258`, the
   three constants at `:289-291`). §4.2's contract is *the same three refusals with the same three
   codes*, and the three codes at `:261`, `:270`, `:278-280` are unchanged. Only the sentence for
   `entry_not_permitted` varies by verb, and CAL-01's own wording is preserved verbatim as
   `CREATE_REFUSED` at `:289`. Callers branch on `code`, not on `message`.
2. A third seeded member owning the approved entry (`src/lib/fixtures.ts:301-309`,
   `supabase/seed.sql:410-499`). §7 asks for an approved entry and names no owner. The reason given —
   that seeding it under `FIXTURE_MEMBER` or `FIXTURE_ADMIN` would break
   `tests/e2e/cal-01-create-entry.spec.ts`, which must pass unedited — is correct, and the ids in
   `fixtures.ts:302`, `:323` are character-identical to `seed.sql:439`, `:484`.
3. Five extra selectors. Each is additive; none renames or moves one from the §4.3 table.
4. `datesIntersect` widened to `{ startDate, endDate }` (`src/lib/data/mock.ts:292-293`) so
   `updateEntry` reuses CAL-01's comparison. `createEntry` still passes a `CreateEntryInput`, which
   satisfies the narrower structural type; `tsc` exits 0.

## R7 detail

One row per ID in `invariants_touched`. Each mechanism is in the datastore, and the citation is the
line that holds it — not the screen that displays it.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 | `entry_no_overlapping_portion`, CAL-01's exclusion constraint over `(member_id, date_range, portion_slots)`. **Untouched by this ticket** and now reached on UPDATE for the first time: `date_range` and `portion_slots` are `generated always as ... stored`, so an UPDATE of `start_date`/`end_date`/`portion` recomputes them and the constraint is evaluated exactly as on INSERT. Neither column is in the update grant, which is correct — a generated column cannot be written. A hard delete removes the row and with it everything there was to intersect. | `supabase/migrations/20260903103000_cal01_entry.sql:68`, `:72`, `:112-113`; migration `20260903143000_cal02_own_entry_writes.sql:41` (neither generated column granted), `:148-150` (delete). Mock's second implementation excludes the edited row — `src/lib/data/mock.ts:781-787`, the `e.id !== row.id` clause, without which every edit that kept its dates would be refused |
| INV-02 | `public.entry_enforce_decision()`, CAL-01's trigger. **Not reimplemented, and clause (c) came through the `create or replace` character-identical** — verified mechanically, not by eye: the block from `-- INV-02, and the rejected-entry hole` to `end if;` extracted from both migrations and `diff`ed, 22 lines each, no differences. The function header is identical too (`language plpgsql security invoker set search_path = ''`), and the trigger itself is not dropped or recreated, so `entry_enforce_decision` on `public.entry` keeps pointing at the same name. The one added line sits **before** clause (c), so an edit that trips the reset still records its own timestamp. | migration `:76-77` (header) vs `20260903103000_cal01_entry.sql:133-134`; clause (c) at migration `:86-107` vs `20260903103000_cal01_entry.sql:136-157`; the new line at migration `:84`; trigger untouched, `20260903103000_cal01_entry.sql:163-165` and migration `:113-115`. Mock's reproduction is actor-blind and gated on `old.status <> 'pending'` in the same shape — `src/lib/data/mock.ts:808-822` |
| INV-06 | Column shape. `portion` is still one not-null enum on the row, and there is still exactly **one** portion control on the form — the extraction moved it, it did not multiply it. Nothing offers a per-date value. The migration adds no column and changes no enum. | `supabase/migrations/20260903103000_cal01_entry.sql:72` (the single `portion` column driving `portion_slots`); one control at `src/components/EntryForm.tsx:174-185`, rendered once per route; migration `:18` records that no enum or column changes |
| INV-07 | Three layers, and the weakest of them is deliberately the type. (a) `member_id` is **absent from the update grant**, so a statement naming it is refused with `42501` before any policy runs; (b) `entry_update_own`'s `with check (member_id = (select auth.uid()))` sees the NEW row and refuses a reassignment even if that column were ever granted; (c) `UpdateEntryInput` carries no `memberId`, so no caller of the seam has a value to pass, and `supabase.ts`'s update names six columns and only those six. | migration `:41-42` (grant), `:137` (`with check`), `:17` (the standing "no grant of `member_id`, ever"); `src/lib/data/index.ts:74-81` (DTO); `src/lib/data/supabase.ts:753-758` (the six columns sent) |

**INV-03, INV-04 and INV-05 are correctly absent, and the absence was reasoned rather than assumed.**
INV-03's biconditional `entry_rejection_reason_iff_rejected`
(`supabase/migrations/20260903103000_cal01_entry.sql:93`) is unreachable from this ticket:
`rejection_reason` is in no grant it writes (migration `:16`, `:41`), so no permitted statement moves
it — and where the trigger clears it, it does so in the same statement that leaves `rejected`, which
is what the check requires. INV-04 and INV-05 are the absence count; nothing here counts, reads a
threshold, or reads a roster.

**Not held by a UI affordance.** Every mechanism cited above is a grant, a constraint, a policy or a
trigger. `src/components/EntryForm.tsx:15-19` and `src/routes/EditEntry.tsx:3-7` both say in their own
words that they are affordances over those controls, which is the correct relationship and not a
substitute for one.

## R8 detail

`git diff --stat package.json pnpm-lock.yaml` is empty and neither file appears in
`git status --porcelain -uall`. No dependency was added, so no ADR is owed. Both files are also
outside `allowed_paths` (`ticket.yaml:50-61`), so adding one would have failed R1 first.

## Findings

None. All eight checks pass.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | — | — | — |

## Two observations that are not findings

Recorded because they are true, they are cheap to verify, and neither is a defect in this
implementation.

1. **`scripts/check-allowed-paths.mjs` cannot see this ticket's work.** It diffs
   `origin/main...HEAD` (`:121`) and CAL-02 is entirely uncommitted, so it reports `0 changed file(s)`
   and exits 0 on an empty set. That is the script working as designed — it is a CI control that runs
   on a pushed branch — but a reviewer who quoted its exit code as R1 would have checked nothing. R1
   above was computed from the working tree.
2. **`03-impl-log.md`'s verification table says "CAL-02's 13" acceptance tests; there are twelve**
   (`pnpm exec playwright test --list`, AC-1 to AC-12). The total it reports, 44 passed, is correct,
   so the arithmetic in one cell is off and nothing downstream of it is.

## Note on the template

`.ai/templates/review-report.md` is stale in two ways this report had to work around, and both are
governance matters for the steward rather than anything CAL-02 can fix.

- Its front-matter carries `next_state: QA`. ADR-022 removed that stage; the lifecycle at
  `.ai/01-operating-model.md:36` is `IN_PROGRESS -> REVIEW -> DONE`.
- Its detail sections are misnumbered against the canonical checklist at
  `.ai/01-operating-model.md:127-134`: the template's *R8 detail* is the per-invariant table, which is
  R7, and its Findings note says "R8 does not route to REWORK … per RULE-07 it escalates", which is
  R7's routing (`.ai/01-operating-model.md:147`). This report uses the canonical numbering — R7
  invariants, R8 dependencies.

## Verdict

**PASS.** R1 through R8 all pass, each citing `file:line`. `next_state: DONE`.
