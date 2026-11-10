---
ticket: UIE-08
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-08T21:25:35+07:00
inputs_read:
  - .ai/board/tickets/UIE-08/01-plan.md
  - .ai/board/tickets/UIE-08/03-impl-log.md
  - .ai/board/tickets/UIE-08/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/registry/decisions/ADR-023-one-pull-request-per-ship.md
  - .ai/01-operating-model.md
  - .ai/standards/git-conventions.md
  - .ai/standards/testing-standards.md
  - src/routes/YearView.tsx
  - src/index.css
  - src/lib/data/mock.ts
  - eslint.config.js
  - ui-language.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# UIE-08 — review report

Isolated dispatch, fresh session, files only. No channel to the Developer existed and none was used.

**`next_state: DONE`, not `QA`.** ADR-022 removed the QA stage; `.ai/01-operating-model.md:70` holds
the state enum and it carries no `QA`, and `:84` puts REVIEW's successor at DONE. The template's
front-matter example still says `QA` and is stale against its own operating model — noted, not
followed.

**Line numbers below are post-change**, as `03-impl-log.md` states: the comment edit added two lines
at `:174`, so every substitution below it sits two lines lower than `01-plan.md` § 4 predicted.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/UIE-08/ticket.yaml:48-50` lists the two globs; full accounting below |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, the command named at `.ai/standards/testing-standards.md:16` |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, `.ai/standards/testing-standards.md:17`. This is also RULE-02's enforcement (`eslint.config.js:64-71`) and AC-14's: nothing reported for `src/routes/YearView.tsx`, and `ui-language.json:21` `copyDebt` is still `[]` |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/YearView.tsx:43` imports `seam` from `@/lib/data`; the datastore calls are `:146` and `:166-168`, all on `seam`, none of them in the diff. No `./supabase` or `./mock` import exists in the file |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | Thirteen rows below, each at its line |
| R6 | Permission gating matches plan section 3 | PASS | `src/routes/YearView.tsx:166-168` — the same three reads, unchanged by the diff; detail below |
| R7 | No invariant violated (RULE-07) | PASS | Per-ID below |
| R8 | No dependency added without an ADR | PASS | `git diff -- package.json pnpm-lock.yaml` is empty and `git status --porcelain` reports neither; the diff contains no `import` line at all |

## R1 detail

`allowed_paths` is `.ai/board/tickets/UIE-08/**` and `src/routes/YearView.tsx`
(`.ai/board/tickets/UIE-08/ticket.yaml:48-50`). The tree holds nine paths. Each is accounted for
rather than waved past, because two are outside those globs by design and four more by history.

| Path | State | In a glob | Why it is not an R1 failure |
|---|---|---|---|
| `src/routes/YearView.tsx` | M | yes | the one file the plan names |
| `.ai/board/tickets/UIE-08/{01-plan,03-impl-log,ticket.yaml,design/README}` | ?? | yes | the ticket folder |
| `.ai/board/backlog.md` | M | **no** | ship-owned set, `.ai/standards/git-conventions.md:143-146`, exempted **by name** at `scripts/check-allowed-paths.mjs:27` per `ADR-023:56-57`. Written at BACKLOG by `orchestrator` — `.ai/01-operating-model.md:80` |
| `.ai/registry/features.md` | M | **no** | ship-owned set, same three citations. The diff is **one added row**, the UIE-08 feature row at `Status: PLANNED`, written by `product` at /triage per its own text — not a mid-implementation registry edit, which is the loosening `ADR-023:85` names as the known cost of that exemption |
| `.ai/board/ideas/2026-09-08-the-year-grid-is-…-defaults.md` | ?? | **no** | TRIAGE output, `.ai/01-operating-model.md:79`. Untracked, so not a `git diff --name-only` path at all. See *Findings* |
| `.ai/board/ideas/2026-09-08-the-year-view-is-…-nothing.md` | ?? | **no** | the other half of the same split triage; the new `features.md` row names it. Same note |
| `.ai/registry/decisions/ADR-032-…-month-cards.md` | ?? | **no** | TRIAGE's NEEDS-ADR draft, `PROPOSED — awaiting the operator`. Same note |
| `.env.example` | ?? | **no** | **predates this ticket and is not attributable to it**: mtime `2026-09-05 10:15`, three days before this ticket's first idea file (`2026-09-08 19:53`), and `git log --all -- .env.example` is empty, so it was never tracked on any branch. Pre-existing chore work, left dirty by `.ai/standards/git-conventions.md:141` |

`node scripts/check-allowed-paths.mjs` → exit 0, `allowed-paths: PASS`. **That run is weak evidence
and is not what R1 rests on**: it reports `0 changed file(s)`, because nothing is committed on
`feat/UIE-08` — `git log main..feat/UIE-08` is empty, every stage leaving the tree dirty until /ship
(`CLAUDE.md` § *Working agreements*). The table above is the check.

## R5 detail

`01-plan.md` § 4's table, row by row. Every right-hand name is generated by Tailwind 4's `@theme`
from a token that already existed — **verified against the built stylesheet rather than against the
source or the token names**, because a `@theme` name that generates no utility produces a silently
unstyled cell that typechecks, lints and passes every existing test. `pnpm exec vite build` → exit 0,
and `dist/assets/index-infXlNcf.css` carries all eight:
`.bg-holiday{background-color:var(--color-holiday)}`, and likewise `.bg-pto`, `.bg-wfh`, `.bg-bg`,
`.bg-card`, `.bg-ink-2`, `.rounded-card{border-radius:var(--radius-card)}` and `.shadow-soft`.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 1 — `year-loading` | `src/routes/YearView.tsx:272` | yes — `rounded-card bg-card … shadow-soft` |
| 2 — `year-not-on-a-team` | `src/routes/YearView.tsx:283` | yes |
| 3 — `year-unavailable` | `src/routes/YearView.tsx:298` | yes |
| 4 — the grid surface | `src/routes/YearView.tsx:341` | yes — `overflow-x-auto rounded-card bg-card p-4 shadow-soft`; `overflow-x-auto` and `p-4` untouched, so AC-8's scroll stays the grid's and not the page's |
| 5 — ruler corner, sticky | `src/routes/YearView.tsx:344` | yes — `bg-card` |
| 6 — `Calendar` label, sticky | `src/routes/YearView.tsx:369` | yes |
| 7 — day-status fill | `src/routes/YearView.tsx:387` | yes — `status?.nonWorkingReason === "holiday" ? "bg-holiday" : "bg-bg",` character-for-character the literal § 4 wrote out, so the ternary was not re-derived |
| 8 — bridge dot | `src/routes/YearView.tsx:393` | yes — `bg-ink-2`. The colour pick is the plan's (§ 2 Open question 2), not the Developer's |
| 9 — member-name cell, sticky | `src/routes/YearView.tsx:414` | yes |
| 10 — member cell fill | `src/routes/YearView.tsx:447` | yes — `!mark ? "bg-bg" : mark.type === "wfh" ? "bg-wfh" : "bg-pto",` likewise the literal |
| 11 — `Away` label, sticky | `src/routes/YearView.tsx:478` | yes |
| 12 — `year-holidays-empty` | `src/routes/YearView.tsx:510` | yes |
| the thirteenth, prose | `src/routes/YearView.tsx:174-176` | yes — and its **claim was checked, not only its shape**: `src/lib/data/mock.ts:1246` opens the `TEAM_ENTRY_MAX_PAGES` / `TEAM_ENTRY_PAGE_SIZE` loop and `:1269-1272` is the throw the comment describes, `src/lib/data/mock.ts:37-38` records `MONTH_ENTRY_LIMIT`'s removal and that `listTeamEntriesOverlapping` was its only reader, and `HOLIDAY_LIMIT` at `src/routes/YearView.tsx:181` is untouched because it is still correct |

**Nothing beyond the thirteen.** `git diff -U3 -- src/routes/YearView.tsx` contains no expression, no
identifier, no `data-*` attribute, no `title` and no import — only string literals inside class
attributes and two ternaries that already existed, plus the one comment. § 4's *nothing enters the
cell loop* therefore holds by construction rather than by inspection, and AC-11's selector list is
intact because the diff could not have touched it.

**Naming an implementation in a comment is not RULE-02.** `:175` cites `@/lib/data/mock:1246-1270`
in prose. That is a documentation pointer, not an import, and the practice already exists above the
seam at `src/routes/Threshold.tsx:17`, which names both implementations for the same reason. R4's
mechanism is the lint rule at `eslint.config.js:64-71`, which is import-based, and it passed.

## R6 detail

`01-plan.md` § 3 asks for four things and each is observable in the diff's absence rather than in a
new check, which is what that section says it would be.

- **No read added, removed or re-scoped.** `src/routes/YearView.tsx:166-168` still calls exactly
  `seam.listMembers()`, `seam.listTeamEntriesOverlapping(range)` and
  `seam.listHolidays(holidayReadRange(range))`, plus `seam.getCurrentMember()` at `:146`. None of
  those four lines appears in the diff.
- **No new capability and no new control.** The diff adds no handler, no button and no form element;
  the denials § 3 describes are held by absence and the absence is unchanged.
- **No overload read.** `seam.getTeam()` is still not called — `grep -n "getTeam" src/routes/YearView.tsx`
  returns only the comment at `:24` recording that it deliberately is not.
- **No role gate to weaken**, because there is none here: the check lives in the row-level security
  policies (ADR-005) and nothing in this file is an authorization mechanism before or after.

## R7 detail

One row per ID in `invariants_touched` (`.ai/board/tickets/UIE-08/ticket.yaml:37`).

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count | The count still has exactly one source. Filled-ness comes from `absentDatesByMember` and the totals from `absenceCountsFor`, both derivations of the one pass this file is forbidden to add to. **The diff introduces no `.filter`, no `.length`, no sum and no expression of any kind** — it is string literals and one comment — so no second definition can have entered. Observed rather than argued: `tests/e2e/cal-06-year-view.spec.ts:261`, *"AC-9 and AC-10: the totals are the month grid's numbers, and they match the filled cells"*, passes unedited against this tree, which is AC-12's before/after identity on `data-type` and `data-count` | `.ai/registry/invariants.md:36`; `src/routes/YearView.tsx:201`, `:210`, `:18-22`; `tests/e2e/cal-06-year-view.spec.ts:261` |
| INV-05 — a tentative entry counts exactly as a settled one does | Untouched, and **the one clause that could have broken it was checked rather than assumed**. The distinction is `opacity-50` at `:452` plus the `year-cell-tentative` `sr-only` span at `:459`, neither in the diff. The risk the plan named is a fill carrying alpha of its own, which composed with `opacity-50` would stop "away" and "settled" being separable: the three fills introduced are `#ffcbaa`, `#a9e2cd` and `#c9bff0` — flat six-digit hexes with no alpha channel — so the composition is unchanged. `cal-06-year-view.spec.ts` AC-6/INV-05 passes | `.ai/registry/invariants.md:37`; `src/routes/YearView.tsx:452`, `:459`; `src/index.css:168-170` |
| INV-06 — an entry carries exactly one portion | A `0.5` still reads as a whole day on this screen because a one-day-wide cell cannot show a half. **That was true on `HEAD` and paint does not move it** — the fix would be geometry, and the geometry is byte-identical: `h-3` at `:383`, `h-4` at `:442`, `rounded-[2px]` on both, `gap-px` at `:342`, `:343`, `:368`, `:411` and `:477`, and `style={columns}` throughout. None of those lines is in the diff, which is what AC-15 asks | `.ai/registry/invariants.md:38`; `src/routes/YearView.tsx:383`, `:442`, `:342`, `:411` |

**AC-13 is held by absence and the absence is checked**:
`grep -c "bg-overload\|bg-rose-\|bg-gradient\|getTeam" src/routes/YearView.tsx` returns 1, and the
single match is the `getTeam` comment at `:24`. No element on this screen resolves to
`rgb(255, 228, 230)` and every cell keeps `background-image: none`.

## R8 detail

No dependency was added, so no ADR is owed. `git diff -- package.json pnpm-lock.yaml` is empty and
`git status --porcelain -- package.json pnpm-lock.yaml` reports nothing; the seam import at
`src/routes/YearView.tsx:43` and every import beside it are unchanged, and the diff contains no
`import` line.

## Findings

| # | Check | Finding | Routes to | Increments `rework_count` |
|---|---|---|---|---|
| — | — | none | — | — |

**One thing outside the gate that nobody would otherwise notice, and it belongs to `/ship` rather
than to the Developer.** The new `.ai/registry/features.md` row cites
`2026-09-08-the-year-grid-is-the-last-calendar-surface-still-drawn-in-defaults.md`, and that idea
file is untracked and **outside every set `/ship` commits**: `.ai/standards/git-conventions.md:140-146`
puts `.ai/board/ideas/**` and `.ai/registry/decisions/**` in *Everything else*, left dirty, while the
`features.md` row itself rides the ticket branch as ship-owned. As the tree stands, this ticket's pull
request lands a registry row citing a file that is not in the repository, and ADR-032 — which
`01-plan.md` § 1 and § 8 both rest their scope on — stays off `main` with it. That is a consequence of
TRIAGE and IN_PROGRESS sharing one working tree (ADR-006), not a defect in this implementation, and it
is the `/ship` session's to resolve.

**Two artifact-level observations, recorded rather than routed.** `03-impl-log.md` Open question 1 is
correct that PLAN left `ticket.yaml` at `state: BACKLOG` with `gates.plan.passed: false` while
`01-plan.md` front-matter carried `gate: PASS` / `next_state: READY`; the Developer transcribed rather
than asserted it, which is the right handling, and whether the omission is a defect in `/plan` is the
steward's question. Separately, `.ai/templates/review-report.md` is stale twice over against
`.ai/01-operating-model.md:127-134` and `:143-148`: its front-matter example carries `next_state: QA`
after ADR-022 removed that stage, and its *Findings* prose attributes the RULE-07 escalation to R8
where the operating model and `.claude/commands/review.md` both put it on R7. This report follows the
operating model.

## Verdict

**`PASS`.** Eight of eight, each cited. The diff is the thirteen edits `01-plan.md` § 4 enumerates and
no others; the four commands at `.ai/standards/testing-standards.md:16-19` all exit 0, with the two
suites that address this screen passing 23 assertions and `git diff --stat -- tests/` empty; and the
eight utilities the whole substitution depends on are confirmed present in the built stylesheet rather
than inferred from the token names.

`gate: PASS`, `next_state: DONE`. The `orchestrator` moves the board — this report writes no ticket row.
