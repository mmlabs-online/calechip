---
ticket: CAL-04
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-04T13:34:16+07:00
inputs_read:
  - .ai/board/tickets/CAL-04/01-plan.md
  - .ai/board/tickets/CAL-04/03-impl-log.md
  - .ai/board/tickets/CAL-04/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/registry/rules.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/review-report.md
  - eslint.config.js
  - scripts/check-allowed-paths.mjs
  - supabase/db.sql
  - supabase/seed.sql
  - src/components/EntryForm.tsx
  - src/routes/NewEntry.tsx
  - git diff
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# CAL-04 — review report

Isolated dispatch, fresh session, files only. No Developer was spoken to and no message channel was
opened — `chat_before_verdict: none` is literally true.

`next_state` is `DONE` and not `QA`: ADR-022 removed the QA stage and the lifecycle at
`.ai/01-operating-model.md:36` reads `IN_PROGRESS -> REVIEW -> DONE`. The template still ships
`next_state: QA`; CAL-02's and CAL-03's reviews already recorded that staleness and it is repeated
here only so this artifact stands alone (RULE-16).

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/CAL-04/ticket.yaml:16-28` — see R1 detail |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, no output |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/MonthView.tsx:38`, `src/lib/data/absence.ts:22` — see R4 detail |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | table below, ten rows |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20260904100000_cal04_team_select.sql:34,36-38`; `src/routes/MonthView.tsx:317-319` — see R6 detail |
| R7 | No invariant violated (RULE-07) | PASS | per-ID table below |
| R8 | No dependency added without an ADR | PASS | `git diff --stat -- package.json pnpm-lock.yaml` is empty; neither file appears in `git status --porcelain` |

## R1 detail

`scripts/check-allowed-paths.mjs` exits 0 but proves nothing here: it diffs `origin/main...HEAD`
(`scripts/check-allowed-paths.mjs:123`) and prints `0 changed file(s)`, because under ADR-006 and
ADR-023 a ticket stays uncommitted until `/ship`. R1 was therefore computed by hand over
`git status --porcelain` using the script's own matcher and its ticket-folder exemption
(`scripts/check-allowed-paths.mjs:129`): 15 changed paths, 12 matching `ticket.yaml:16-28` exactly,
3 being `.ai/board/tickets/CAL-04/{ticket.yaml,01-plan.md,03-impl-log.md}` — the ticket's own folder.
**Zero violations.** 03-impl-log.md Open questions item 3 reports the same blindness in the script and
correctly leaves it to the steward.

| Changed path | In `allowed_paths` at |
|---|---|
| `supabase/migrations/20260904100000_cal04_team_select.sql` | `ticket.yaml:17` |
| `src/lib/domain/types.ts` | `ticket.yaml:18` |
| `src/lib/data/index.ts` | `ticket.yaml:19` |
| `src/lib/data/supabase.ts` | `ticket.yaml:20` |
| `src/lib/data/mock.ts` | `ticket.yaml:21` |
| `src/lib/data/absence.ts` | `ticket.yaml:22` |
| `src/lib/fixtures.ts` | `ticket.yaml:23` |
| `src/routes/MonthView.tsx` | `ticket.yaml:24` |
| `src/App.tsx` | `ticket.yaml:25` |
| `tests/seam-parity.test.ts` | `ticket.yaml:26` |
| `tests/absence.test.ts` | `ticket.yaml:27` |
| `tests/e2e/cal-04-month-view.spec.ts` | `ticket.yaml:28` |

`src/components/EntryForm.tsx` and `src/routes/NewEntry.tsx` are **not** in the tree's changed set —
checked directly, `git status --porcelain` on both is empty. That matters for R5 row 11 below.

## R4 detail

`grep -rn "@supabase" src --include="*.ts" --include="*.tsx"` outside `src/lib/data/` returns one
hit, `src/lib/domain/types.ts:61`, and it is a comment naming a `.d.ts` path — not an import. The
lint rule that enforces RULE-02 is `eslint.config.js:62-77`, scoped to `src/**` and exempting
`src/lib/data/**`, and R3 above is its run.

The one shape worth reasoning about rather than grepping: `src/routes/MonthView.tsx:42-49` imports
`@/lib/data/absence` **directly**, not through `@/lib/data`. That is a route reaching inside the seam
directory, which looks like a crossing and is not one. `src/lib/data/absence.ts:22` is a `import type`
of four domain types and nothing else — the module constructs no client, names no column, and issues
no read. It is the arrangement 01-plan.md section 5 chose deliberately and section 8 rejected the
alternative to. The datastore is still reached only through `seam` at `src/routes/MonthView.tsx:38`.

`node scripts/check-docs.mjs` exits 0 with 0 errors, so the `supabase-client-in-seam` boundary in
`.ai/registry/boundaries.json` read by D12 also reports no crossing.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| `Team { id, name, overloadThreshold, createdAt }` | `src/lib/domain/types.ts:225-231` | yes — four fields, `overloadThreshold: number` |
| `DateRange { start, end }` | `src/lib/domain/types.ts:240-243` | yes — two `yyyy-MM-dd` strings, inclusive |
| `MONTH_ENTRY_LIMIT = 2000` | `src/lib/domain/types.ts:264` | yes |
| `AbsenceCounts` | `src/lib/domain/types.ts:271` | yes — `ReadonlyMap<string, number>` |
| `getTeam(): Promise<Team \| null>` | declared `src/lib/data/index.ts:400`; `src/lib/data/mock.ts:1018`; `src/lib/data/supabase.ts:902` | yes — no parameter in all three. The real one carries no `.eq()`, leaving `team_select_own` as the only scope (`supabase.ts:903-906`); the mock reproduces the predicate at `mock.ts:1019-1022` |
| `listTeamEntriesOverlapping(range): Promise<Entry[]>` | declared `src/lib/data/index.ts:425`; `mock.ts:1039`; `supabase.ts:937` | yes. Overlap and not containment: `supabase.ts:941` is `.filter("date_range", "ov", "[start,end]")` with the inclusive literal; `mock.ts:1043` is `startDate <= range.end && endDate >= range.start`. Neither filters `status` — grep for `status` in both bodies returns nothing |
| `absenceCountsFor(entries, range, roster)` | `src/lib/data/absence.ts:167-177` | yes — exact three-parameter signature, returns `AbsenceCounts` |
| `absentMembersFor(entries, range, roster)` | `src/lib/data/absence.ts:190-205` | yes — and it is the SAME `walk` pass as the counts (`absence.ts:114-141`), which is what section 4 required rather than a second filter |
| `isOverloaded(count, currentMembers, threshold)` | `src/lib/data/absence.ts:223-226` | yes — `>` at `:225`, `false` at zero members at `:224` |
| The route `/month/:yyyy-MM`, `/month` redirecting | `src/App.tsx:165-166`; the redirect at `src/routes/MonthView.tsx:250` | yes, with a declared location change — see below |

**Two declared deviations, both examined, both PASS.**

**1. The redirect lives in the component, not in a second route** (03-impl-log.md Deviations item 3).
Plan section 4 specifies the behaviour — "`/month` with no anchor redirects to the current month" —
and not its location. `src/routes/MonthView.tsx:250` performs it, `MonthView.tsx:112-115` holds the
local-clock read, and `src/App.tsx` still holds no clock. The behaviour asserted by AC-10 is
unaffected either way. Not a defect.

**2. The drag-select form renders on the month view rather than at `/entries/new`**
(03-impl-log.md Deviations item 1). This is the one item in this ticket where a defensible reviewer
could route back, and the developer said so. It passes, for three reasons that are checkable rather
than sympathetic:

- **AC-13's `Then` clause is satisfied literally.** CAL-01's form opens
  (`src/routes/MonthView.tsx:429-445` renders `EntryForm`, imported at `:34`, not copied), with
  `startDate` and `endDate` carrying the dragged range (`:438-439`), and nothing is written on
  release — `src/routes/MonthView.tsx:214-217` only sets state.
- **"The grid has no save path" is met on the only reading that is buildable.** No write mechanism is
  added: `MonthView.tsx:243` calls `seam.createEntry`, which is CAL-01's, and `entry_insert_own` is
  the control. This ticket's migration grants no `insert`, `update` or `delete` to anybody
  (`supabase/migrations/20260904100000_cal04_team_select.sql:34` is `grant select` and is the only
  grant in the file).
- **The navigation alternative is unbuildable inside RULE-03, and that was verified rather than
  accepted.** `src/routes/NewEntry.tsx` contains no `useSearchParams` and no read of any query
  parameter — grep returns nothing — and it passes `initial` with its own literal at `:92`. Neither
  it nor `src/components/EntryForm.tsx` is in `allowed_paths` (`ticket.yaml:16-28`), and both are
  unmodified in the tree. So `/entries/new?start=…&end=…` would land on a form that ignores both
  values, and AC-13 would be unsatisfiable without a RULE-03 violation.

Plan section 3's denial reads "Neither role may write anything from this screen. No insert, update or
delete grant is added. Drag-select (AC-13) hands dates to CAL-01's form and **that form's own policies
decide the write**." The second and third sentences are the first one's scope: the denial is about
this ticket's permission surface, and a write through CAL-01's form is what the plan itself describes.
Recorded here so a later reader does not have to re-derive it.

**Four exported names in `src/lib/data/absence.ts` are not in plan section 4** — `addDays:43`,
`eachDateInRange:52`, `overlapsRange:64`, `currentMemberCount:229`. RULE-04 says the Developer "may
not invent field names"; none of these is a field name, a column or an acceptance criterion, all four
are declared in 03-impl-log.md rather than left to be found, and each has a reason that reduces
duplication rather than adding surface. R5 is about section 4's items being implemented, and all ten
are. Not a finding.

## R6 detail

Plan section 3 is a four-row table. Every row is matched, and the two denials are checkable.

| Plan section 3 row | `member` | `admin` | Held at |
|---|---|---|---|
| Read any entry in the team | ✅ | ✅ | `entry_select_team` (CAL-01's migration, unmodified); the read is `src/lib/data/supabase.ts:937-946` and carries no team filter of its own |
| Read the member list of own team | ✅ | ✅ | `member_select_team` (TEA-03's migration, unmodified); `src/routes/MonthView.tsx:179` calls `seam.listMembers()` |
| Read the overload threshold | ✅ | ✅ | `supabase/migrations/20260904100000_cal04_team_select.sql:34,36-38` — `grant select … to authenticated` plus `team_select_own`, matching `.ai/standards/rbac-and-security.md:47` which grants the read to both roles |
| Set the overload threshold | ❌ | ❌ *here* | the migration contains no `update` grant and no update policy — `grep -i update` on the file returns nothing. `src/routes/MonthView.tsx:317-319` displays the threshold in a `<p>`; there is no `input`, `select` or `button` bound to it anywhere in the file |

**Both denials verified positively rather than by absence of a complaint.**

- *No write grant added.* The migration is two statements, `:34` and `:36-38`, and both are `select`.
  `public.team` was closed before this — `supabase/db.sql:613` is
  `revoke all on public.team, public.member, public.allowed_email from anon, authenticated` — so the
  file opens exactly the read `rbac-and-security.md:47` already granted and nothing more. ADM-01's
  update half is untouched, which is what `.ai/registry/features.md:103` reserves to it.
- *No cross-team read is possible.* Neither new seam function takes a `teamId`
  (`src/lib/data/index.ts:400,425`), so a caller cannot ask for another team's data even incorrectly.
  Asserted in both directions at `tests/seam-parity.test.ts:84-92` and `:127-136` — the other team's
  row is present in the mock (`src/lib/data/mock.ts:110`) and never returned to a caller on
  `FIXTURE_TEAM`, and its own member does receive it, so the assertion cannot pass by the row simply
  being absent.
- *The route is unguarded* (`src/App.tsx:165-166`), unlike `/entries/new` and `/entries/team`. That is
  an affordance question and not a permission one under ADR-005: a caller with no member row reaches
  `month-not-on-a-team` (`src/routes/MonthView.tsx:172-174, 262-271`) and never reaches the grid, so
  the drag-select path is not reachable without a member row either. `entry_select_team`,
  `member_select_team`, `team_select_own` and `entry_insert_own` are the controls.

## R7 detail

**One row per ID in `invariants_touched` (`ticket.yaml:14`).**

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 | **Built here, and the uniqueness clause holds.** The formula is `src/lib/data/absence.ts:79-83` (`full` 1, `am`/`pm` 0.5) summed at `:174`; `type` is read nowhere in the file, so PTO and WFH weigh alike. Rejected entries are excluded at `:126` and that is the **only** count-bearing status test in `src/`. The removal clause — `removedAt` null or strictly after the date — is `:99-100`, using the first ten characters of the ISO timestamp so the comparison is chronological. The avatar clause is held structurally: `absentMembersFor:190` and `absenceCountsFor:167` both drive `walk:114`, and `src/routes/MonthView.tsx:332` takes its people from `absentMembersFor` rather than from a filter, so a face cannot appear over a count that excludes it. The denominator is the current roster, `currentMemberCount:229` filtering `removedAt === null`, read at `MonthView.tsx:283` and passed to `isOverloaded` at `:334`. Neither `src/lib/data/mock.ts` nor `src/lib/data/supabase.ts` imports `./absence` or computes anything — checked by grep — so there is no second arithmetic for `tests/seam-parity.test.ts` to miss. Every clause is asserted: `tests/absence.test.ts:131-160` (weights, type-blindness, am+pm as one day), `:162-172` (rejected), `:195-231` (removal), `:233-249` (strict `>` at exactly 3.0 of 6 at 0.5), `:251-265` (current denominator) | `src/lib/data/absence.ts:79-83,99-100,114-141,167-177,190-205,223-229` |
| INV-05 | `walk` reads `status` at `absence.ts:126` and reads `tentative` **nowhere** — grep for `tentative` in `src/lib/data/absence.ts` returns no hit. A tentative entry therefore weighs what any other entry weighs, structurally rather than by a passing test. `tests/absence.test.ts:174-193` asserts it twice, the second time by comparing a tentative entry against an approved one, which fails if `tentative` is ever consulted while the first assertion still passes. The dashed reduced-opacity treatment is a CSS class at `src/routes/MonthView.tsx:399` and touches no number | `src/lib/data/absence.ts:114-141`; `src/routes/MonthView.tsx:399` |
| INV-07 | No function added by this ticket takes a `teamId` (`src/lib/data/index.ts:400,425`), so the team a count is taken against is a property of the data and not a parameter. The real `getTeam` carries no `.eq()` and relies on `team_select_own` (`supabase/migrations/20260904100000_cal04_team_select.sql:36-38`, resolving through `public.member_team_id`); the real month read carries no team filter at all (`src/lib/data/supabase.ts:937-946`), leaving `entry_select_team` as the only scope. The mock reproduces both (`src/lib/data/mock.ts:1019-1022,1041-1043`), and `sameTeam` rather than `===` preserves the SQL `null = null` behaviour for a removed member. Asserted in both directions at `tests/seam-parity.test.ts:84-92` and `:127-136` | `src/lib/data/index.ts:400,425`; `src/lib/data/supabase.ts:903-906,937-946`; `src/lib/data/mock.ts:1019-1022,1041-1043` |

**One thing checked and dismissed rather than passed over.** `src/routes/MonthView.tsx:463-470`
contains a second `status !== "rejected"` predicate. It does **not** violate INV-04's uniqueness
clause: it computes no count and decides no avatar's presence — `absentMembersFor` has already
answered both, and `entryFor` only ever runs for a member that function returned
(`src/routes/MonthView.tsx:378-379`). It selects which of a member's entries supplies the chip's
colour and star, and skipping rejected rows there is what stops the chip contradicting the count.
It is documented as exactly that at `src/routes/MonthView.tsx:455-461`. Two claims elsewhere overstate
this — the file header at `:11-12` and 03-impl-log.md's INV-04 row both say the only status test is
`absence.ts:126` — but a comment being broader than the code is not an invariant breach and is not one
of R1 to R8.

## R8 detail

`git diff --stat -- package.json pnpm-lock.yaml` produces no output and neither file appears in
`git status --porcelain`. `src/lib/data/absence.ts` imports one thing, `../domain/types`, and it is a
type-only import (`:22`). `src/routes/MonthView.tsx:32-50` imports `react`, `react-router-dom` and
four intra-repo paths, all already present. `tests/absence.test.ts:20` and the additions to
`tests/seam-parity.test.ts:11-21` import `vitest` and intra-repo fixtures. No dependency was added, so
no ADR is owed.

## Findings

None. No check failed.

## Verdict

**PASS.** All eight checks pass, each citing `file:line`. `next_state: DONE`.

Runs made in this session, for the record: `pnpm exec tsc --noEmit` exit 0; `pnpm exec eslint .`
exit 0; `pnpm exec vitest run` → 3 files, 43 tests, all passing; `pnpm exec playwright test` → 64
tests, all passing; `node scripts/check-docs.mjs` → 0 errors, 2 pre-existing D8 warnings in files
outside this ticket; `node scripts/check-allowed-paths.mjs` exit 0 but structurally blind, see R1
detail.

## Notes on the template and the model

Neither changes this verdict; both are recorded because they are cheap to lose and belong to the
steward rather than to this ticket.

1. **R7 and R8 are numbered inconsistently across four files.** `.ai/templates/review-report.md`'s
   checklist puts invariants at R7 and dependencies at R8, and `.claude/commands/review.md` agrees —
   but the same template's *R8 detail* and *Findings* sections describe R8 as the per-invariant check
   that escalates, and `.ai/registry/rules.md:64` maps RULE-07 to "Review check R8". Reviews before
   2026-09-01 used the older numbering and reviews after it use the current one, so the artifacts on
   the board disagree with each other by date. This report follows the template's checklist table and
   the command file: **R7 is invariants, R8 is dependencies.**
2. **`next_state: QA`** still ships in the template front-matter, three reviews after ADR-022 removed
   the stage.
3. **`scripts/check-allowed-paths.mjs` cannot enforce RULE-03 during IN_PROGRESS or REVIEW.** It
   diffs `origin/main...HEAD` (`:123`) and a ticket is uncommitted until `/ship` (ADR-006, ADR-023),
   so it reports PASS on `0 changed file(s)` while twelve files sit modified in the tree. R1 above is
   the only thing that actually checked. 03-impl-log.md Open questions item 3 raises the same point.
