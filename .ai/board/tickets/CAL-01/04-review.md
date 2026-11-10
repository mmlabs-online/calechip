---
ticket: CAL-01
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-03T10:39:55+07:00
inputs_read:
  - .ai/board/tickets/CAL-01/01-plan.md
  - .ai/board/tickets/CAL-01/03-impl-log.md
  - .ai/board/tickets/CAL-01/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/01-operating-model.md
  - the uncommitted working tree (git diff plus the three untracked files)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# CAL-01 review — R1 to R8

**Isolated dispatch.** Fresh session, files only, no message channel. No Developer was consulted and
none exists to consult in this session (RULE-13).

**R1 was run against the WORKING TREE, not against `origin/main...HEAD`.** `03-impl-log.md:166-171`
is right that `scripts/check-allowed-paths.mjs:112` diffs committed history and is therefore
vacuously green at REVIEW under ADR-006. The set checked below is
`git diff --name-only` unioned with `git ls-files --others --exclude-standard`, which is the only set
that exists before `/ship`.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | Twelve paths in the tree. Nine match a glob in `.ai/board/tickets/CAL-01/ticket.yaml:50-60`; the other three are `.ai/board/tickets/CAL-01/{01-plan,03-impl-log,ticket}.yaml|md`, which `.claude/hooks/guard-allowed-paths.mjs:192-193` makes always writable as the ticket's own folder. Table below. |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` run in this session — exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` run in this session — exit 0, no output. The RULE-02 rule is `eslint.config.js:31-48` and applies to `src/**` with `src/lib/data/**` ignored. |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/NewEntry.tsx:26` imports `@/lib/data` and nothing else; `grep` for `./supabase`, `./mock` and `@supabase/supabase-js` across `src/**/*.ts{,x}` outside `src/lib/data/` returns nothing. The two new implementations are `src/lib/data/supabase.ts:623,679` and `src/lib/data/mock.ts:622,691`, both inside the seam. |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | Per-item table below; every name is `.ai/standards/data-model.md:51-73`'s or ADR-011's |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20260903103000_cal01_entry.sql:191-216`; row-by-row below |
| R7 | No invariant violated — reasoned per ID in `invariants_touched` (RULE-07) | PASS | Per-ID table below |
| R8 | No dependency added without an ADR | PASS | `git diff --stat -- package.json pnpm-lock.yaml` is empty; the only new imports are `react` and two intra-repo paths (`src/routes/NewEntry.tsx:23-27`) |

### R1 detail — the twelve paths

| Path | Matched by |
|---|---|
| `supabase/migrations/20260903103000_cal01_entry.sql` | `supabase/migrations/20260903*_cal01_entry.sql` (`ticket.yaml:50`) |
| `src/lib/domain/types.ts` | `ticket.yaml:52` |
| `src/lib/data/index.ts` | `ticket.yaml:53` |
| `src/lib/data/supabase.ts` | `ticket.yaml:54` |
| `src/lib/data/mock.ts` | `ticket.yaml:55` |
| `src/routes/NewEntry.tsx` | `ticket.yaml:57` |
| `src/routes/Home.tsx` | `ticket.yaml:58` |
| `src/App.tsx` | `ticket.yaml:59` |
| `tests/e2e/cal-01-create-entry.spec.ts` | `ticket.yaml:60` |
| `.ai/board/tickets/CAL-01/01-plan.md` | ticket folder — `guard-allowed-paths.mjs:193` |
| `.ai/board/tickets/CAL-01/03-impl-log.md` | ticket folder — same |
| `.ai/board/tickets/CAL-01/ticket.yaml` | ticket folder — same |

`supabase/seed.sql` and `src/lib/fixtures.ts` are in `allowed_paths` and untouched. `allowed_paths`
permits, it does not commission; the reasoning at `03-impl-log.md:119-125` is sound and no criterion
in plan section 2 needs a seeded entry.

## R5 detail

One row per contract item in `01-plan.md` section 4.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `EntryType = "pto" \| "wfh"` | `src/lib/domain/types.ts:148` | yes |
| 4.1 `EntryPortion = "full" \| "am" \| "pm"` | `src/lib/domain/types.ts:151` | yes |
| 4.1 `EntryStatus = "pending" \| "approved" \| "rejected"` | `src/lib/domain/types.ts:154` | yes |
| 4.1 `Entry`, fourteen fields, no `date_range` / `portion_slots` | `src/lib/domain/types.ts:167-182` | yes — field for field, and both generated columns are absent as the contract requires |
| 4.1 three new `FailureCode` values | `src/lib/domain/types.ts:64-69` | yes — `overlapping_entry`, `invalid_date_range`, `entry_not_permitted`; TEA-02's `not_permitted` is not reused |
| 4.1 `OWN_ENTRY_LIMIT = 500` carrying its `TODO(verify)` | `src/lib/domain/types.ts:184-194` | yes |
| 4.2 `CreateEntryInput`, six fields, no `memberId`, no decision column | `src/lib/data/index.ts:50-57` | yes |
| 4.2 `createEntry(input): Promise<Result<Entry>>` on `DataSeam` | `src/lib/data/index.ts:250` | yes |
| 4.2 `listOwnEntries(): Promise<Entry[]>` on `DataSeam` | `src/lib/data/index.ts:270` | yes |
| 4.2 `createEntry`, real | `src/lib/data/supabase.ts:623-670` | yes — six columns named in the insert, `member_id` from `readCurrentMember()` at `:645` and never from a parameter, `.select(ENTRY_COLUMNS)` at `:653` and a zero-row answer treated as a refusal at `:658-664` |
| 4.2 `listOwnEntries`, real | `src/lib/data/supabase.ts:679-705` | yes — no date and no member parameter, `OWN_ENTRY_LIMIT` asked for at `:689` and the truncation assertion at `:699-704` |
| 4.3 failure mapping, matched on SQLSTATE | `src/lib/data/supabase.ts:250-276` | yes — `23P01` at `:253`, `23514` at `:262`, `42501` at `:270`; no constraint-name and no message-text match anywhere in the function. One case beyond section 4.3's three rows: `PGRST301` (expired or missing JWT) falls in with `42501` at `:271`, which is an addition to the table rather than a contradiction of it — the request reaches the policy as nobody and is refused, and the sentence rendered is the same one. |
| 4.3 the three sentences, verbatim | `src/lib/data/supabase.ts:255-273` | yes — character for character with the table in plan section 4.3 |
| 4.4 the fifteen selectors | `src/routes/NewEntry.tsx:139,148,164,181,198,213,225,234,240,254,264,275,278,281,285` | yes. `own-entry-row-type` and `own-entry-row-portion` exist as named spans; the machine-readable `data-type` / `data-portion` attributes section 4.4 asks for sit on the `own-entry-row` parent at `:265-267` rather than on those two spans. Both are present and both are observable, and `03-impl-log.md:188` records the placement. |
| 4.4 the route, guarded on membership `member` | `src/App.tsx:116-119` | yes |
| 4.4 the link from Home | `src/routes/Home.tsx:87` | yes — shown to both roles, matching the uniform permission |
| 4.4 no member picker, no status control | `src/routes/NewEntry.tsx:8-16`, and the form carries exactly two `select`s (`:148`, `:164`) | yes |
| 4.5 dates are strings above PostgreSQL | `src/lib/data/supabase.ts:624`, `src/lib/data/mock.ts:275-276`, `src/routes/NewEntry.tsx:276` | yes — every comparison is string comparison; the only `new Date()` in the diff is `mock.ts:662`, a timestamp for `createdAt`/`updatedAt` and not a date field |
| 5 seam parity, `tests/seam-parity.test.ts` unedited | `pnpm exec vitest run` in this session — 1 file, 2 tests, passed | yes |
| 5 the mock reproduces INV-01 with slot semantics | `src/lib/data/mock.ts:267-279`, used at `:646-648` | yes — `full: [0,1]`, `am: [0]`, `pm: [1]`, intersection and not equality |
| 6 steps 1-13 | `supabase/migrations/20260903103000_cal01_entry.sql` | yes; step 8 in its INV-02-only form, checked against ADR-016 clause (c) below |

**One item is deliberately unimplemented and correctly so: AC-12.** `01-plan.md:177-180` forbids an
agent from supplying it. `src/routes/NewEntry.tsx:18-22` carries no `min` on either date input,
neither seam compares a date to today, and `tests/e2e/cal-01-create-entry.spec.ts:10-13` says why it
has no test. That is the plan's instruction followed, not a gap.

### The migration, step by step against plan section 6

| Step | Where | Held |
|---|---|---|
| 1 `btree_gist` | `…cal01_entry.sql:33` | yes, `with schema extensions`, matching TEA-01's `citext` line; the `TODO(verify)` is carried at `:21-28` and is undischarged, which is the honest state |
| 2 three enums | `:36-38` | yes, values and order from `data-model.md:59,60,64` |
| 3 the table | `:45-59` | yes, column for column against `data-model.md:55-73`; `on delete restrict` on both references (`:47`, `:56`), no cascade |
| 4 generated columns | `:68`, `:72-78` | yes, `daterange(start_date, end_date, '[]')` and ADR-011's three-way case |
| 5 `entry_end_after_start` | `:86` | yes |
| 6 INV-03 biconditional | `:93-96` | yes, `(status = 'rejected') = (rejection_reason is not null and btrim(…) <> '')` |
| 7 `entry_no_overlapping_portion` | `:111-117` | yes, `member_id with =`, `date_range with &&`, `portion_slots with &&` — never `portion with =` |
| 8 `entry_enforce_decision()` + trigger | `:133-165` | yes, ADR-016 clause (c) and nothing else, `security invoker set search_path = ''`, both names as ADR-016 fixes them |
| 9 RLS + explicit revoke | `:173-174` | yes, `entry` named explicitly rather than inherited from TEA-01's three-table revoke |
| 10 the two grants | `:191-193` | yes, seven insert columns, and `status`/`rejection_reason`/`approved_by`/`approved_at` absent |
| 11 `entry_select_team` | `:203-207` | yes, `to authenticated`, both calls through TEA-01's `security definer` helper (`…tea01_membership.sql:64,71`) |
| 12 `entry_insert_own` | `:214-216` | yes, `with check (member_id = (select auth.uid()))`, no role predicate |
| 13 no update, no delete policy | absent from the file; declared at `:11-14` | yes — RLS on with no policy denies both |

## R6 detail — permission gating against plan section 3

| Action | Plan section 3 says | Where it is actually decided | Match |
|---|---|---|---|
| Read any entry in the team | both roles, policy `entry_select_team` | `…cal01_entry.sql:203-207` | yes; agrees with `rbac-and-security.md:31` |
| Create an entry for themselves | both roles, `entry_insert_own` | `…cal01_entry.sql:214-216` | yes; `rbac-and-security.md:32` |
| Create for another member | denied for both, same `with check` | `…cal01_entry.sql:216` — the predicate admits no value but the caller's own id, and there is no role branch | yes; `rbac-and-security.md:33` |
| Set `status` on a new entry | denied for both, column privilege | `…cal01_entry.sql:192-193` — `status` absent from the insert grant | yes |
| Set `approved_by` / `approved_at` / `rejection_reason` | denied for both, same withheld grant | `…cal01_entry.sql:192-193` | yes |
| Edit an entry | no `update` policy ships | none in the file; `:11-14` states the absence | yes |
| Delete an entry | no `delete` policy ships | none in the file; `:11-14` | yes |

**The interface adds no control and claims none.** `src/routes/NewEntry.tsx:3-16` names itself an
affordance and carries the "no member picker" sentence at the point where one would be added.
`src/App.tsx:105-119` guards the route on membership state and says in the same comment that
`entry_insert_own` is the control either way.

## R7 detail — one row per ID in `invariants_touched`

`invariants_touched: [INV-01, INV-02, INV-03, INV-06, INV-07]` (`ticket.yaml:22`). The divergence
from the CAL-01 row in `features.md` is deliberate and reasoned at `01-plan.md:186-207`; the
mechanism for each added ID ships in this migration, which is exactly what `invariants.md` says the
list records.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no overlapping entries for one member | The exclusion constraint, over the generated `portion_slots` and not over `portion`. `full` [0,2) intersects `am` [0,1) so the pair is refused; `am` [0,1) and `pm` [1,2) do not intersect so the pair is accepted. Adjacent dates do not collide either, since `daterange(…,'[]')` canonicalises to `[)`. **Not held by a UI affordance**: nothing in `src/` refuses an overlap, the seam issues the insert and reads the refusal. | `supabase/migrations/20260903103000_cal01_entry.sql:111-117`, `:72-78`; the mock's parallel semantics at `src/lib/data/mock.ts:267-279`; refusal surfaced at `src/lib/data/supabase.ts:252-259` |
| INV-02 — an edit revokes approval | `public.entry_enforce_decision()` ships in its INV-02-only form and is **clause (c) of ADR-016 §1 character for character**: the same five columns compared with `is distinct from`, the same `old.status <> 'pending'` (so `rejected` is covered as well as `approved`), the same four assignments, actor-blind, `note` excluded from the trigger list per `data-model.md:160`. Function and trigger carry the names ADR-016 fixes, so ADM-05's `create or replace` lands over this one rather than beside it. Not exercisable end-to-end here — no `update` policy ships — which the plan states rather than hides. | `supabase/migrations/20260903103000_cal01_entry.sql:133-165` against `.ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md:112-124` |
| INV-03 — a rejected entry always carries a non-empty reason | The check is a biconditional in both directions, with `btrim` closing the whitespace-only reason. Nothing in this ticket can create a `rejected` row — `status` is not in the insert grant — so every row created here is `pending` with a null reason and satisfies both sides. ADR-016 clause (b) depends on this exact shape. | `supabase/migrations/20260903103000_cal01_entry.sql:93-96`; grant at `:192-193` |
| INV-06 — one portion per entry, for the whole range | Column shape: a single not-null `public.entry_portion` on the row, so a per-day portion is unrepresentable rather than merely unoffered, and `portion_slots` is generated from that one column. Above it, `CreateEntryInput.portion` is one value (`src/lib/data/index.ts:52`) and the form carries exactly one portion control. | `supabase/migrations/20260903103000_cal01_entry.sql:49`, `:72-78`; `src/routes/NewEntry.tsx:164` |
| INV-07 — every entry belongs to exactly one member | Three layers, and the middle one is the control: `member_id uuid not null references public.member (id) on delete restrict` — no cascade, so a member is never removed out from under their entries; the insert policy's `with check (member_id = (select auth.uid()))`, uniform across roles; and a `CreateEntryInput` carrying no `memberId` at all, which is the affordance. `entry_select_team` scopes the read to the caller's own team through TEA-01's helper, which is the "counted only against the team that member belongs to" half. | `supabase/migrations/20260903103000_cal01_entry.sql:47`, `:214-216`, `:203-207`; `src/lib/data/index.ts:50-57` |

**INV-04 and INV-05 are absent from the list, and I verified the absence rather than accepting it.**
`grep` across the whole change for `overload`, `threshold`, `absence`, `listMembers` and `count(`
returns only prose in comments and Playwright's `toHaveCount` on DOM rows — no arithmetic, no
threshold read, no roster read anywhere in the diff. The mechanism is the absence of the computation,
which is what `.ai/registry/invariants.md` requires rather than an argument that the arithmetic is
careful. INV-04's denominator and INV-05's tentative-counts-alike rule are CAL-04's and CAL-07's.

**No invariant outside the five is touched.** The migration adds one table and two policies and
alters nothing existing; `member`, `team` and `allowed_email` are unread and unwritten by this change.

## Findings

None. No check failed.

## Verification run in this session

| Command | Exit | Result |
|---|---|---|
| `pnpm exec tsc --noEmit` | 0 | — |
| `pnpm exec eslint .` | 0 | — |
| `pnpm exec vitest run` | 0 | 1 file, 2 tests passed; `tests/seam-parity.test.ts` unedited |
| `pnpm exec playwright test` | 0 | 32 passed — this ticket's eleven plus `seam-guard`, `smoke`, `tea-01-signup`, `tea-05-sign-in`, all four unedited |

These reproduce `03-impl-log.md:158-163` independently. They were re-run rather than read.

## What this verdict does not cover, stated because a PASS is otherwise read as more than it is

**The migration has never been applied and no Supabase project is provisioned.** Every one of the
thirty-two tests ran against the in-memory seam, so R7's citations above are citations of *SQL that
has been read and not executed*. The exclusion constraint, both generated columns, the trigger, the
column grant and both policies are unexecuted. In particular:

- The `TODO(verify)` on `btree_gist` and the `extensions` `search_path`
  (`…cal01_entry.sql:21-28`) is live. If the operator class does not resolve, the `alter table` at
  `:111` fails at apply time.
- AC-10 and AC-11 are observed end-to-end only as the absence of a control. Their real mechanisms —
  the policy's `with check` and the withheld column grant — have not run.
  `tests/permission-model.test.ts`, which `.ai/standards/testing-standards.md` names as mandatory,
  still does not exist. Pre-existing debt, recorded at `01-plan.md:232-237` and
  `03-impl-log.md:211-216`, and not chargeable to this ticket.

This is not a finding and does not route anywhere. It is the boundary of what R1 to R8 can see, and
`03-impl-log.md:197-220` states it first — which is the correct behaviour and is noted as such.

## For the operator, not for the gate

1. **AC-12 is still unanswered.** May a member declare a date in the past? `TODO(project)` on
   `.ai/registry/features.md:87`. The form accepts any date today, and that is the absence of a
   decision rather than one taken (`src/routes/NewEntry.tsx:18-22`).
2. **CAL-01 never passed through `READY`.** `03-impl-log.md:229-234` discloses that `/implement` ran
   on a ticket at `state: BACKLOG` and that the `plan` gate in `ticket.yaml:81` is a quotation of
   `01-plan.md`'s front-matter rather than an orchestrator's grade of the Definition of Ready. The
   disclosure is correct and complete; the confirmation is a human's.
3. **`scripts/check-allowed-paths.mjs` is blind at the two stages it exists for.** It diffs
   `origin/main...HEAD` (line 112) while ADR-006 keeps a ticket uncommitted until `/ship`, so it is
   vacuously green at IN_PROGRESS and at REVIEW. R1 above was run against the working tree instead.
   Model debt, outside this ticket's `allowed_paths`, raised at `03-impl-log.md:236-243`.

## Verdict

`PASS`. R1 through R8 all pass, each citing `file:line`. `next_state: DONE`.
