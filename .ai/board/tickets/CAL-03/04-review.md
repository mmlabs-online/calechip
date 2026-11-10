---
ticket: CAL-03
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-03T15:05:22+07:00
inputs_read:
  - .ai/board/tickets/CAL-03/01-plan.md
  - .ai/board/tickets/CAL-03/03-impl-log.md
  - .ai/board/tickets/CAL-03/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/registry/invariants.md
  - .ai/standards/architecture.md
  - .ai/steward/context.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260903143000_cal02_own_entry_writes.sql
  - scripts/check-allowed-paths.mjs
  - git diff
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# CAL-03 — review report

Isolated dispatch, fresh session, files only. No Developer was spoken to and no message channel was
opened — `chat_before_verdict: none` is literally true.

`next_state` is `DONE` and not `QA`: ADR-022 removed the QA stage and the lifecycle at
`.ai/01-operating-model.md:36` reads `IN_PROGRESS -> REVIEW -> DONE`. The template still ships
`next_state: QA` in its front-matter — see *Notes on the template* at the end, where a second stale
label is recorded with it.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/CAL-03/ticket.yaml:59-71` — see R1 detail |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/TeamEntries.tsx:33`, `src/routes/EditEntry.tsx:65,69`, `eslint.config.js:35` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | see R5 detail |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20260903160000_cal03_admin_entry_writes.sql:80-88`, `:101-106`; `src/routes/TeamEntries.tsx:89`; `src/App.tsx:148` |
| R7 | No invariant violated (RULE-07) | PASS | see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --stat package.json pnpm-lock.yaml` → empty; neither file appears in `ticket.yaml:59-71` |

## R1 detail

`git status --porcelain -uall` lists eighteen paths. Twelve are this ticket's twelve globs, one file
each. Three are the CAL-03 ticket folder, which `scripts/check-allowed-paths.mjs:131` exempts by
name. The remaining three are **not this session's** and are dealt with below.

| Changed path | Matched by |
|---|---|
| `supabase/migrations/20260903160000_cal03_admin_entry_writes.sql` | `ticket.yaml:60` |
| `supabase/seed.sql` | `ticket.yaml:61` |
| `src/lib/fixtures.ts` | `ticket.yaml:62` |
| `src/lib/domain/types.ts` | `ticket.yaml:63` |
| `src/lib/data/index.ts` | `ticket.yaml:64` |
| `src/lib/data/supabase.ts` | `ticket.yaml:65` |
| `src/lib/data/mock.ts` | `ticket.yaml:66` |
| `src/routes/TeamEntries.tsx` | `ticket.yaml:67` |
| `src/routes/EditEntry.tsx` | `ticket.yaml:68` |
| `src/routes/Home.tsx` | `ticket.yaml:69` |
| `src/App.tsx` | `ticket.yaml:70` |
| `tests/e2e/cal-03-admin-edit-entry.spec.ts` | `ticket.yaml:71` |
| `.ai/board/tickets/CAL-03/{01-plan.md,03-impl-log.md,ticket.yaml}` | ticket folder, exempt — `scripts/check-allowed-paths.mjs:131` |

**Three dirty board paths belong to other sessions and were written after this ticket's
implementation finished.** `03-impl-log.md` has mtime `15:01:03`;
`.ai/board/tickets/OPS-001/ticket.yaml` is `15:01:45` and `.ai/board/tickets/OPS-002/ticket.yaml` is
`15:03:17`, both stamped `Copied ... by \`product\` at /triage, 2026-09-03` in their own first line.
`.ai/board/ideas/2026-09-03-the-interface-and-its-standard-speak-different-languages.md` carries
`agent: product` in its front-matter. None is a source file, none is CAL-03's, and `03-impl-log.md`
names the idea as not this session's before the two tickets existed. R1 is about what the Developer
wrote, and the Developer wrote none of them — **but `/ship` must leave all three dirty**, per
`CLAUDE.md` § *Working agreements*: chore work is named, not committed. They are outside CAL-03's
ticket folder, so `scripts/check-allowed-paths.mjs` will fail them once the branch carries commits
unless `/ship` excludes them, which is exactly what it is required to do.

**The script's own PASS is vacuous at this stage, as it was at CAL-02.** It diffs
`origin/main...HEAD` (`scripts/check-allowed-paths.mjs:123`) and this ticket is entirely
uncommitted, so it reports `0 changed file(s)`. R1 above was computed from the working tree.

Nothing outside the list was touched: `tests/e2e/cal-01-create-entry.spec.ts`,
`tests/e2e/cal-02-edit-delete-entry.spec.ts`, `tests/seam-parity.test.ts`,
`src/components/EntryForm.tsx`, `src/routes/NewEntry.tsx`, `src/routes/MemberList.tsx`,
`src/routes/AllowList.tsx` and every shipped migration are all absent from the diff — which is what
`01-plan.md` section 7 kept them out of `allowed_paths` for.

## R2, R3 detail

```
pnpm exec tsc --noEmit    → 0
pnpm exec eslint .        → 0
pnpm exec vitest run      → 0   (1 file, 2 tests — seam parity)
pnpm exec playwright test → 0   (56 passed, 0 failed)
```

The Playwright run is not a gate item and is recorded because it is the evidence for two things the
plan asks for by name. **CAL-02's twelve tests and CAL-01's eleven pass unedited** against the
`EditEntry.tsx` change — the safety net `01-plan.md` section 4.3 names for it. And
`tests/seam-parity.test.ts` passes unedited, which is the check `01-plan.md` section 5 relies on for
`listTeamEntries` appearing in both implementations at equal arity.

## R4 detail

`eslint.config.js:35` is the mechanism (RULE-02) and it exits 0. Read independently of the rule:
`grep -rn 'from "./supabase"|from "./mock"|createClient' src --include='*.ts' --include='*.tsx'`
outside `src/lib/data/` returns nothing.

- `src/routes/TeamEntries.tsx:33` — `import { seam } from "@/lib/data"`, and the only calls are
  `seam.getCurrentMember()` at `:84`, `seam.listTeamEntries()` and `seam.listMembers()` at `:97`, and
  `seam.deleteEntry(entryId)` at `:120`.
- `src/routes/EditEntry.tsx:65,69` — `seam.getCurrentMember()` then one of `seam.listTeamEntries()` /
  `seam.listOwnEntries()`. No new import; the file already reached the seam through its one door.
- `src/routes/Home.tsx:90` and `src/App.tsx:148` add a link and a route and reach nothing.

## R5 detail

One row per contract item in `01-plan.md` section 4.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 `listTeamEntries(): Promise<Entry[]>` on `DataSeam` | `src/lib/data/index.ts:374` | Yes. Declared with the section's comment carried verbatim, `:346-373` |
| §4.1 — real: no filter of any kind, `entry_select_team` the only scope | `src/lib/data/supabase.ts:824-847`; the select at `:826-831` carries no `.eq` | Yes. A `member_team_id` filter here would have been the second, weaker copy of the policy the section forbids |
| §4.1 — real: two `order` calls, then the limit and the truncation raise | `src/lib/data/supabase.ts:829-830`, `:830`, `:841-846` | Yes. Character-for-character the shape of `listOwnEntries` at `:699-716` |
| §4.1 — mock: filters by team explicitly | `src/lib/data/mock.ts:958-980`; the filter at `:962` | Yes, and via `sameTeam` at `:325`, not `===` — `null = null` is NULL in SQL, so a removed member's entries are unreachable in the mock as they are under the policy |
| §4.1 — no write function added; `updateEntry`/`deleteEntry` unchanged in the real implementation | `src/lib/data/supabase.ts` — `git diff` touches only `:36` (the import) and `:798-847` (the new function) | Yes. This is the section's own leading claim and the diff is the evidence |
| §4.1 `TEAM_ENTRY_LIMIT` in `src/lib/domain/types.ts`, separate from `OWN_ENTRY_LIMIT`, `TODO(verify):` carried | `src/lib/domain/types.ts:215`, the `TODO(verify):` at `:213` | Yes. 2000, its own constant, imported as a value by both implementations (`supabase.ts:36`, `mock.ts:26`) |
| §4.2 failure mapping — unchanged, no code added | `src/lib/data/supabase.ts:258-283` absent from the diff; `FailureCode` in `index.ts` unchanged | Yes. `entry_not_permitted` now additionally covers "another team's" with no new code, which is what the section requires |
| §4.3 `/entries/team`, guarded on membership `member` | `src/App.tsx:146-150` | Yes |
| §4.3 `TeamEntries.tsx` — refuses a non-admin from `getCurrentMember()` | `src/routes/TeamEntries.tsx:84-92`, refusal rendered at `:145-157` | Yes, and the same four-phase shape `MemberList.tsx` uses |
| §4.3 the nine selectors of the section's table | `TeamEntries.tsx:206` `:210` `:227` `:235` `:247` `:259` `:289` `:269` `:148` `:200` | Yes, all present, each name as written |
| §4.3 owner's display name from `listMembers()` | `src/routes/TeamEntries.tsx:97`, joined at `:180-181` | Yes. No new read and no new policy |
| §4.3 `EditEntry.tsx` chooses its read by role; `edit-entry-not-found` keeps name, position, silence | `src/routes/EditEntry.tsx:65-70`; the missing state at `:70` still says nothing about the id | Yes |
| §4.3 `Home.tsx` — one admin-only link beside the allow-list link | `src/routes/Home.tsx:86-93` | Yes, same `member.role === "admin"` condition |
| §5 seam parity | `tests/seam-parity.test.ts`, unedited, exit 0 | Yes |
| §6 `entry_update_admin` — `using` carries `is_admin` and the team predicate, `with check` the team predicate alone | `supabase/migrations/20260903160000_cal03_admin_entry_writes.sql:80-88` | Yes, clause for clause as section 6 writes it |
| §6 `entry_delete_admin` — same predicate, no `with check` | same file `:101-106` | Yes |
| §6 the five absences | same file: no `insert`, no `grant`, no `create or replace`, no edit to CAL-02's policies — the file is 106 lines and contains exactly two `create policy` statements | Yes. `git status` shows no shipped migration modified |

**The four declared deviations are additive and none reverses a decision.** The second back link
(`EditEntry.tsx:191-195`) leaves `edit-entry-back` its name, destination and position, which is why
CAL-02's suite passes unedited. The `member`-not-`admin` route guard is what `01-plan.md` section
4.3's "guarded like `/entries/new`" literally says, and AC-10 is written about a refusal rather than
a redirect, so the guard is right and a role check there would have broken the criterion. The extra
selectors are declared. The language split is neither an R-check nor a deviation from this plan —
see *One thing for the operator*.

## R7 detail

One row per ID in `invariants_touched` (`ticket.yaml:21`).

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 | `entry_no_overlapping_portion`, CAL-01's exclusion constraint, **untouched** — no constraint statement anywhere in this ticket's migration. The one line that had to move is the mock's clash comparison, which now keys on the **row's owner** and not on the caller | `supabase/migrations/20260903160000_cal03_admin_entry_writes.sql` (no `alter table`, no `constraint`); `src/lib/data/mock.ts:855` — `e.memberId === row.memberId`, was `e.memberId === me.id` |
| INV-02 | `public.entry_enforce_decision()`, **changed not at all** — no `create or replace function` in the migration, and the mock's reproduction is absent from the diff. Actor-blind by decision (ADR-016 §2) and it stays so: no actor carve-out was added in the migration, in either seam implementation, or on either screen | migration file (no `create or replace`); `src/lib/data/mock.ts:865-885` unchanged in `git diff`; `src/routes/TeamEntries.tsx:20-23` states the screen writes no `status` and none of `status`/`approvedBy`/`approvedAt` is written anywhere in it |
| INV-06 | Column shape, untouched. `portion` is still one not-null enum on the row; no column, constraint or enum statement exists in this ticket, and the screen renders `PORTION_LABELS[entry.portion]` from the single field | `src/lib/domain/types.ts` diff adds only `TEAM_ENTRY_LIMIT` at `:215`; `src/routes/TeamEntries.tsx:240` |
| INV-07 | Three mechanisms, all verified present. (a) **No grant of any kind is added** — the migration's 106 lines contain no `grant`, so `member_id` stays outside CAL-02's update column list and a statement naming it is refused with `42501` before any policy runs. (b) The `with check` compares the **new** row's team to the caller's, which is the half `using` structurally cannot see. (c) `UpdateEntryInput` still carries no `memberId`, so the affordance agrees with the control — no member field exists on the edit form to submit | (a) migration file, no `grant` statement; (b) `supabase/migrations/20260903160000_cal03_admin_entry_writes.sql:86-88`; (c) `src/lib/data/index.ts` `UpdateEntryInput` absent from the diff, and `src/routes/EditEntry.tsx` submits no `memberId` |

**The team predicate is present in both policies, and it is the check this review was most concerned
to make.** `01-plan.md` section 3 property 2, the migration's own step-1 comment, and ADR-016
§*Consequences* all say the same thing: `using (public.is_admin((select auth.uid())))` alone reads
correct and passes every test a one-team fixture can carry. It is not what was written —
`supabase/migrations/20260903160000_cal03_admin_entry_writes.sql:84` and `:105` both carry
`public.member_team_id(member_id) = public.member_team_id((select auth.uid()))`, and both helpers
exist as `security definer` functions at `supabase/migrations/20260831150024_tea01_membership.sql:54`
and `:64`, executable by `authenticated` at `:71`. The mock reproduces the same predicate at
`src/lib/data/mock.ts:338-341` rather than reducing it to a role check.

**INV-03, INV-04 and INV-05 are not in `invariants_touched` and are not reached.**
`rejection_reason` is not in the update grant and no grant was added; nothing here computes an
absence count, reads a threshold, or reads a roster for counting — `listMembers()` at
`TeamEntries.tsx:97` is read for display names alone (`:180-181`).

## R8 detail

`git diff --stat package.json pnpm-lock.yaml` is empty and neither path is in `allowed_paths`
(`ticket.yaml:59-71`). `src/routes/TeamEntries.tsx:29-34` imports only `react`, `react-router-dom`,
`@/lib/data` and a domain type — all present before this ticket. No ADR was needed and none was
written; the four the plan rests on (ADR-005, ADR-014, ADR-016, ADR-018) are all previously accepted,
which is what Definition of Ready item 4 asks for.

## Findings

None. No check failed and there is no routing row to apply.

## One thing for the operator, which is not a gate item

**The English/Vietnamese split on the new screen.** `03-impl-log.md` *Deviations* item 1 asks this
review to decide whether R6 accepts it. **R6 is permission gating, and language is not an R-check at
all** — there is no gate item this falls under, so it cannot fail one. On the merits, the developer's
call is the right one and is already routed: the standard requiring English (`§ Language`, commit
`3ccbd37`) is on the unmerged `ops/ui-language-english`, so it is not in force on this branch, and
writing fresh Vietnamese copy an hour after the rule was recorded would have been writing something
already decided to be wrong. The consequence is real and visible — an admin clicking *Edit* moves
from an English list to a Vietnamese form, and `TYPE_LABELS`, `PORTION_LABELS` and `STATUS_LABELS` at
`src/routes/TeamEntries.tsx:43-60` duplicate the Vietnamese maps in `EntryForm.tsx` and
`NewEntry.tsx` because those files are outside `allowed_paths` on purpose. **OPS-001 and OPS-002
already exist as `BACKLOG` tickets covering the other thirteen files**, and folding the three
duplicated maps into one place belongs to whichever of them lands second. Nothing here is CAL-03's to
fix and nothing here blocks it.

## Notes on the template

Two stale labels in `.ai/templates/review-report.md`, both recorded rather than worked around:

1. `next_state: QA` in the front-matter block, already noted by CAL-02's review. ADR-022 removed the
   stage; the lifecycle at `.ai/01-operating-model.md:36` is the authority.
2. **The detail section for the invariant walk is headed `## R8 detail` while the checklist numbers
   that check R7**, and the same section then states the escalation rule under the wrong number. The
   checklist row and `.claude/commands/review.md` agree that **R7** is invariants and **R8** is
   dependencies, so the heading is what is wrong. This report follows the checklist: `## R7 detail`
   is the per-invariant walk, `## R8 detail` is the dependency check. Neither is a defect in CAL-03
   and both are `steward` work.

## Verdict

**PASS.** All eight checks pass, each citing `file:line`. `next_state: DONE`.
