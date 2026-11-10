---
ticket: CAL-05
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-04T15:04:37+07:00
inputs_read:
  - .ai/board/tickets/CAL-05/01-plan.md
  - .ai/board/tickets/CAL-05/03-impl-log.md
  - .ai/board/tickets/CAL-05/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/registry/invariants.md
  - .ai/templates/review-report.md
  - .ai/standards/architecture.md
  - eslint.config.js
  - scripts/check-allowed-paths.mjs
  - src/lib/data/absence.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - src/routes/Home.tsx
  - src/App.tsx
  - tests/absence.test.ts
  - tests/e2e/cal-05-week-view.spec.ts
  - ui-language.json
  - git diff
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# CAL-05 — review report

Isolated dispatch, fresh session, files only. No Developer was spoken to and no message channel was
opened — `chat_before_verdict: none` is literally true.

`next_state` is `DONE` and not `QA`: ADR-022 removed the QA stage and the lifecycle at
`.ai/01-operating-model.md:36` reads `IN_PROGRESS -> REVIEW -> DONE`. The template still ships
`next_state: QA`; CAL-02, CAL-03 and CAL-04 each recorded that staleness and it is repeated here only
so this artifact stands alone (RULE-16).

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/CAL-05/ticket.yaml:64-72` — see R1 detail |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, no output |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/WeekView.tsx:31-40`, `src/lib/data/absence.ts:22-29` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | see R5 detail |
| R6 | Permission gating matches plan section 3 | PASS | `src/routes/WeekView.tsx:153-169`, `tests/e2e/cal-05-week-view.spec.ts:233-253` |
| R7 | No invariant violated (RULE-07) | PASS | see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only -- package.json pnpm-lock.yaml` → empty |

Tests were run as well, though they are not an R-check since ADR-022: `pnpm exec vitest run` → exit 0,
3 files / 57 tests; `pnpm exec playwright test` → exit 0, 73 tests. `tests/e2e/cal-04-month-view.spec.ts`
passes unedited, which is what 01-plan.md section 7 puts it there for — it is the safety net for the
one-line `src/routes/MonthView.tsx` change.

## R1 detail

Working tree against `allowed_paths` at `.ai/board/tickets/CAL-05/ticket.yaml:64-72`. Eight globs,
eight changed source files, exact one-to-one; two are new.

| Changed file | Allowed by |
|---|---|
| `src/lib/domain/types.ts` | `ticket.yaml:65` |
| `src/lib/data/absence.ts` | `ticket.yaml:66` |
| `src/routes/WeekView.tsx` (new) | `ticket.yaml:67` |
| `src/routes/MonthView.tsx` | `ticket.yaml:68` |
| `src/routes/Home.tsx` | `ticket.yaml:69` |
| `src/App.tsx` | `ticket.yaml:70` |
| `tests/absence.test.ts` | `ticket.yaml:71` |
| `tests/e2e/cal-05-week-view.spec.ts` (new) | `ticket.yaml:72` |

`.ai/board/tickets/CAL-05/{ticket.yaml,01-plan.md,03-impl-log.md}` are also dirty and are the ticket
folder, exempt at `scripts/check-allowed-paths.mjs:131`. Nothing else is touched — in particular
`src/lib/data/index.ts`, `mock.ts`, `supabase.ts`, `tests/seam-parity.test.ts`, `ui-language.json`,
every migration and every registry file are unmodified.

**`node scripts/check-allowed-paths.mjs` exits 0 but proves nothing at this stage, and that is not a
defect in this ticket.** It diffs `origin/main...HEAD` (`scripts/check-allowed-paths.mjs:123`), and a
ticket stays uncommitted until `/ship`, so it reported `0 changed file(s)`. The check above was made
from the working tree instead. The script is a CI control that runs after the ship commit; the
impl-log's row for it is true and vacuous, not wrong.

## R4 detail

`src/routes/WeekView.tsx:35` imports `seam` from `@/lib/data`, the one door. Its whole import list is
`react`, `react-router-dom`, `@/lib/data`, `@/lib/data/absence` and `@/lib/domain/types`
(`src/routes/WeekView.tsx:31-40`) — no `./supabase`, no `./mock`, no `@supabase/*`. The lint rule that
enforces RULE-02 is at `eslint.config.js:64-77` and `pnpm exec eslint .` exits 0.

`src/lib/data/absence.ts:22-29` imports only domain types, so the new derivation crosses no boundary:
the module still names no column and constructs no client.

`src/routes/WeekView.tsx` is **not** in `copyDebt` (`ui-language.json:20-26`), so § *Language* covers
it from its first line, as 01-plan.md section 4.3 requires.

## R5 detail

One row per contract item in 01-plan.md section 4.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 — `interface AbsenceDetail { entry: Entry; member: Member }`, declared beside `AbsenceCounts` | `src/lib/domain/types.ts:292-295` | Yes — both field names and both types exactly as written; nothing added |
| §4.1 — `absentEntriesFor(entries, range, roster): ReadonlyMap<string, readonly AbsenceDetail[]>` | `src/lib/data/absence.ts:263-278` | Yes — parameter order, `readonly` modifiers and return type character-for-character the plan's |
| §4.1 — derived from the same `walk`, not a second filter | `src/lib/data/absence.ts:271-273` calling `walk` at `:120` | Yes — it pushes what `walk` visits and narrows nothing itself |
| §4.1 — every date in `range` present, empty array where nobody is away | `src/lib/data/absence.ts:270` | Yes — pre-seeded from `eachDateInRange` before the walk, so a caller never distinguishes an absent key from an empty one (AC-13) |
| §4.1 — order: `displayName` asc, then `full, am, pm`, then `entry.id` | `src/lib/data/absence.ts:166-171`, applied at `:275` | Yes — `PORTION_ORDER` is the stated order and `entry.id` is the final tiebreaker |
| §4.2 — exactly three seam calls | `src/routes/WeekView.tsx:153`, `:167`, `:168` | Yes — `getCurrentMember`, `listMembers`, `listTeamEntriesOverlapping` and no fourth |
| §4.2 — `getTeam()` deliberately absent, no write call | no occurrence in `src/routes/WeekView.tsx` outside the comment at `:11` | Yes — grep for `getTeam`, `updateEntry`, `insertEntry`, `deleteEntry` returns only that comment |
| §4.2 — `MONTH_ENTRY_LIMIT` reused, no new constant | no constant declared in `src/routes/WeekView.tsx`; the limit throws at `src/lib/data/mock.ts:1056` and `src/lib/data/supabase.ts:957` | Yes — the view renders the throw at `src/routes/WeekView.tsx:172-177`, it does not re-implement it |
| §4.3 — routes `/week` and `/week/:day` | `src/App.tsx:182-183` | Yes |
| §4.3 — `/week` with no anchor resolves to the current week | `src/routes/WeekView.tsx:90-93`, `:201` | Yes — the component redirects, so the clock stays out of `App.tsx`, mirroring `/month` |
| §4.3 — any day of a week resolves to its Monday | `src/routes/WeekView.tsx:136-139` | Yes — `addDays(day, -mondayIndex(day))`, and the URL is not rewritten |
| §4.3 — header: home, previous, anchor, next, month | `src/routes/WeekView.tsx:250`, `:258`, `:261`, `:264`, `:272-278` | Yes |
| §4.3 — seven sections always, in reading order | `src/routes/WeekView.tsx:245`, `:284-290` | Yes — driven by `eachDateInRange`, so seven is the range and not a literal |
| §4.3 — one row per absent person per day, keyed by entry | `src/routes/WeekView.tsx:308-327` | Yes — `key={entry.id}`, so a member's `am` and `pm` are two rows |
| §4.3 — palette per `CLAUDE.md` § Visual direction, no overload colour | `src/routes/WeekView.tsx:335`, `:340-342`, `:396` | Yes — peach/mint chips, tentative dashed at reduced opacity, approved carrying `★`; no pink anywhere |
| §4.3 — the selector table, all nineteen | `week-anchor:261`, `week-home:250`, `week-prev:258`, `week-next:264`, `week-month:273`, `week-day:290`, `week-day-label:295`, `week-day-empty:303`, `week-row:328`, `week-row-name:348`, `week-row-avatar:345`, `week-row-type:352`, `week-row-portion:361`, `week-row-note:382`, `week-row-approver:392`, `week-row-tentative:371`, `week-loading:206`, `week-not-on-a-team:218`, `week-unavailable:232` — all in `src/routes/WeekView.tsx` | Yes — every line the impl-log's testability contract claims is the line the selector is on |
| §7 — `MonthView.tsx` takes one link and nothing else | `src/routes/MonthView.tsx:314-324` | Yes — `month-week` and its comment are the whole diff of that file |
| §7 — `Home.tsx` takes one link and nothing else | `src/routes/Home.tsx:113-129` | Yes — `home-week-link` and its comment are the whole diff of that file |
| §5 — seam impact none | `src/lib/data/index.ts`, `mock.ts`, `supabase.ts`, `tests/seam-parity.test.ts` unmodified | Yes |
| §6 — schema delta none | no `.sql` file in the diff | Yes |

**The five deviations in 03-impl-log.md are all additive and all inside the layout half § 2b makes the
Tech Lead's own; none changes behaviour, a field name, a permission or an invariant.** Checked
individually: the `vi` collation (`src/lib/data/absence.ts:169`) makes the plan's stated ordering
deterministic across hosts rather than altering it, and is a correction of the plan's silence rather
than a departure from it; `week-sign-in` (`:222`) is what "mirroring `month-not-on-a-team`" means,
since that state carries `month-sign-in`; `home-week-link` (`src/routes/Home.tsx:127`) follows that
file's existing `home-` convention; `data-approver-id` (`src/routes/WeekView.tsx:393`) is one extra
attribute on a selector the table already lists; and the `mondayIndex` copy
(`src/routes/WeekView.tsx:68` beside `src/routes/MonthView.tsx:84`) is duplication the plan's own
section 7 forced by giving `MonthView.tsx` one link and nothing else. **None is an R5 failure.**

The two open targets the impl-log flags for a reviewer are both defensible and neither contradicts an
acceptance criterion: `month-week` points at the first of the displayed month
(`src/routes/MonthView.tsx:322`) because a month anchor carries no date to keep, and `week-month`
points at the month of the day in the URL (`src/routes/WeekView.tsx:274`) because AC-14 is titled
*keeps the date* and the Monday's month would drop it across a month boundary. Both are recorded in
03-impl-log.md § Open questions 3 for the operator, which is the right place for them.

## R6 detail

Against 01-plan.md section 3. No policy, no grant and no permission change ships, and the diff
contains no `.sql` file.

| Action | Plan says | Held at |
|---|---|---|
| Read any entry in the team | ✅ both roles, `entry_select_team`, untouched | `src/routes/WeekView.tsx:168` — the read is `listTeamEntriesOverlapping`, already shipped |
| Read the member list | ✅ both roles, `member_select_team`, untouched | `src/routes/WeekView.tsx:167` |
| Read the overload threshold | not read here | `seam.getTeam()` appears nowhere in `src/routes/WeekView.tsx` |
| Approve or reject from this screen | ❌ both roles, no control exists | `src/routes/WeekView.tsx:322-399` — the row is `span`s only, and `tests/e2e/cal-05-week-view.spec.ts:243-253` asserts zero `button`, `input`, `form`, `select`, `textarea` and `a` inside `week-day`, **as an admin** |
| Edit or delete from this screen | ❌ both roles, no control exists | same |

**The screen branches on role nowhere**, which is the strongest form of "an admin sees exactly what a
member sees": `role` is read at no point in `src/routes/WeekView.tsx`. Section 3 names this denial as
the weakest mechanism in the plan because it is held by absence; the e2e test at
`tests/e2e/cal-05-week-view.spec.ts:233` signs in as the admin before asserting it, which is what
turns the absence into a check rather than a claim.

## R7 detail

One row per ID in `invariants_touched`, plus INV-06 which the feature row calls visible only here.

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count, no second definition anywhere | The view derives nothing. `absentEntriesFor` reads the same `walk` that `absenceCountsFor` and `absentMembersFor` read, so the rejected exclusion, the removal clause and the range clamp are written once and read three times. There is no `.filter`, no `.status` test and no date comparison in the view | `src/lib/data/absence.ts:271-273` calling `walk` at `:120-149`; the rejected exclusion at `:133`; the removal clause at `:106-107`; the clamp at `:141-142`. Verified by re-derivation rather than by inspection: `tests/absence.test.ts:495-505` re-computes the month's decimal from the week's rows on **every** date of a week holding four rows, three people and 2.5, and `:507-519` asserts the case is not vacuous — that is exactly the "four names against 3.5" the feature row names |
| INV-05 — a tentative entry counts as a non-tentative one does | `walk` never reads `tentative`, so membership of the list cannot turn on it; the marking is only what the view does with the flag it is handed | `src/lib/data/absence.ts:120-149` (no occurrence of `tentative`); the marking at `src/routes/WeekView.tsx:340-342` and `:370-374`; asserted at `tests/absence.test.ts:396-421` and `tests/e2e/cal-05-week-view.spec.ts:209` |
| INV-07 — one member, one team | No read is added. Both reads are the already-shipped team-scoped ones, and the approver is resolved against the roster **those same reads returned**, so no name from another team can reach the screen even as an approver | `src/routes/WeekView.tsx:166-169` and `:196-199`, `:317-320`. Asserted positively at `tests/e2e/cal-05-week-view.spec.ts:255-270`: the week of 21 September holds exactly one fixture entry, it belongs to the other team, and all seven days render `week-day-empty` |
| INV-06 — one portion per entry, applying to every date in its range (relied on, not chosen) | `portion` is read off the entry on every date the entry covers, so a five-day `pm` renders five afternoons and cannot render a whole day in the middle. The view decides nothing about the column shape | `src/routes/WeekView.tsx:360-366`; asserted at both levels — `tests/absence.test.ts:370-395` and `tests/e2e/cal-05-week-view.spec.ts:192` |
| INV-01, INV-02, INV-03 | Unreachable — this surface issues no write of any kind, so no overlap can be created, no approval revoked and no rejection reason set | no write function imported at `src/routes/WeekView.tsx:31-40`; the absence asserted at `tests/e2e/cal-05-week-view.spec.ts:243-253` |

**None of these is held by a UI affordance.** INV-04, INV-05 and INV-06 are held inside
`src/lib/data/absence.ts`, above the seam and below the view; INV-07 is held by policies this ticket
does not touch. The only thing the view holds is the *marking*, and the marking is not the invariant.

## Findings

None.

## Verdict

**PASS.** R1 through R8 all pass with citations. `next_state: DONE`.

Two things recorded for the operator rather than as findings, because neither is a defect in this
ticket and neither is this gate's to fix:

1. **`node scripts/check-allowed-paths.mjs` cannot see an unshipped ticket** — R1 detail. It diffs
   against `origin/main` and the tree is uncommitted until `/ship`, so its `0 changed file(s)` is
   true and empty. R1 above was performed against the working tree. If this matters it is a steward
   question about the script, not a rework item.
2. **03-impl-log.md § Open questions 1** — `mondayIndex` now exists at
   `src/routes/MonthView.tsx:84` and `src/routes/WeekView.tsx:68`. Three duplicated lines, both
   carrying the comment that says why, and lifting them was scope this ticket's section 7 explicitly
   withheld. Correctly left, correctly recorded.
