---
ticket: UIE-05
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-08T08:39:59+07:00
inputs_read:
  - .ai/board/tickets/UIE-05/01-plan.md
  - .ai/board/tickets/UIE-05/03-impl-log.md
  - .ai/board/tickets/UIE-05/ticket.yaml
  - git diff (src/routes/WeekView.tsx, .ai/board/tickets/UIE-05/ticket.yaml)
  - src/routes/WeekView.tsx
  - .ai/registry/invariants.md
  - .ai/01-operating-model.md
  - .ai/templates/review-report.md
  - eslint.config.js
  - tests/e2e/cal-05-week-view.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# UIE-05 — review report

**Isolated dispatch, RULE-13.** Fresh session, files only, no message channel. The Developer was not
spoken to. Every check below was re-run or re-read against the tree rather than taken from
`03-impl-log.md`; where the log's claim and the tree agree, the citation is to the tree.

**`next_state: DONE`, not `QA`.** ADR-022 removed the QA stage; the lifecycle at
`.ai/01-operating-model.md:36` is `REVIEW -> DONE`. `.ai/templates/review-report.md:26` still ships
`next_state: QA` in its front-matter block — that is a stale line in the template, not a state this
board has.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | Changed: `src/routes/WeekView.tsx` and `.ai/board/tickets/UIE-05/ticket.yaml`; untracked: `01-plan.md`, `03-impl-log.md`. `allowed_paths` at `.ai/board/tickets/UIE-05/ticket.yaml:60-62` is `.ai/board/tickets/UIE-05/**` and `src/routes/WeekView.tsx`. Every path matches one of the two globs. |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, no output. Re-run by this session. |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, no output. Re-run by this session. Carries AC-18: the § *Language* rule at `eslint.config.js:81-92` is in force over `src/**` and no file entered `copyDebt`. |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/WeekView.tsx:111` imports `seam` from `@/lib/data` and nothing else reaches data; the only datastore calls are `:233`, `:253-255`, none of them in the diff. `git diff -U0` shows no import line changed. The lint rule that enforces RULE-02 is `eslint.config.js:64-77` and R3 passed. |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | Per-item table below. |
| R6 | Permission gating matches plan section 3 | PASS | Plan § 3 says nothing changes and names the four refusal states as what a layout rewrite breaks by deletion. All four survive: `week-loading` `src/routes/WeekView.tsx:309`, `week-not-on-a-team` `:321`, `week-sign-in` `:325`, `week-unavailable` `:335`. `git diff -U0` puts the first code hunk at old line 306 — after all four — so none was touched. No control was added: the chip's approver is a `<span>`, `:678`, not a button. |
| R7 | No invariant violated (RULE-07) | PASS | Per-ID table below. |
| R8 | No dependency added without an ADR | PASS | `git diff -- package.json pnpm-lock.yaml` is empty. `src/routes/WeekView.tsx:107-127` is byte-identical to `HEAD`; the header strip's `dd/MM` is a string slice at `:486`, not a date library. |

## R5 detail

**The plan is the merged story and design (ADR-019), so the contract is its § 4** — the template's
"design section 1" is pre-merge wording. One row per numbered sub-section.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 — what is already true and is not rebuilt | `src/routes/WeekView.tsx:424` — `xl:grid xl:grid-cols-7 xl:gap-2` survives; `:454` keeps `bg-card` and `shadow-soft`; `:557` keeps the mint/peach fills | Yes. No height is set on the day column, so AC-3's equal heights still come from the default `align-items: stretch` on one grid row. |
| § 4.2 — AC-1, the column fills the pane by `min-height` and never `height` | `src/routes/WeekView.tsx:424` `xl:min-h-full`, carried by `:361` `xl:h-full` on the section and `:423` `xl:h-full` on the positioning wrapper | Yes, and it is the property the plan specified rather than the declaration it guessed. `min-h-full` is a minimum, so a busy column still grows past the pane; `overflow` is set nowhere in the file, so no second scroller exists and UIE-04's AC-4 and AC-5 are not reversed. `xl:` only, so the stacked layout below 1280px is untouched. The deviation from the plan's named `calc(…)` is the plan's own *Open question* 1, which reserved the declaration for this stage. |
| § 4.3 — AC-4 to AC-6, the header strip | `src/routes/WeekView.tsx:464` — `flex flex-col items-center … border-b border-line … text-center`; weekday at `:479`; date at `:486` as `` `${date.slice(8, 10)}/${date.slice(5, 7)}` `` | Yes. Centred stack, hairline in the existing `--color-line` token, `dd/MM` inside the same `week-day-label` element. The full English weekday is kept, which is what § 4.3 said it chose and what keeps `tests/e2e/cal-05-week-view.spec.ts:145-146` (`toContainText("Monday")`, a substring test) passing without a spec edit. `week-day-holiday` `:498` and `week-day-bridge` `:507` remain inside the `h2`, which closes at `:513`. |
| § 4.4 — `rounded-2xl`, not a change to `--radius-card` | `src/routes/WeekView.tsx:454` `rounded-2xl` on the day column, `:464` `rounded-t-2xl` on its header | Yes. `src/index.css` is not in `git diff --name-only`, so `--radius-card` is unmoved; `week-empty-card` at `:717-718` still carries `rounded-card`, which is what § 4.4 required of the mascot. AC-16 follows from the diff: `src/components/AuthCard.tsx` and `src/components/Sidebar.tsx` are not in it. |
| § 4.5 — AC-7 to AC-9, the chip restacked with all five facts kept | `src/routes/WeekView.tsx:554` `flex flex-col gap-1`; row 1 `:577-614` (bubble `:584`, name `:597`, star `:608-610`); row 2 `:622-641` (type `:623`, portion `:635`); row 3 `:649-689` (tentative `:654`, note `:666`, approver `:677-686`) | Yes, and the three-row table in § 4.5 is built exactly as written. The seven children are all present, each with its original selector. The star **moved** rather than being added — `week-row-approver` at `:677-686` still renders `Approved by {approver.displayName}` with `data-approver-id`, which is what `cal-05-week-view.spec.ts:216`'s `toContainText(ADMIN_NAME)` reads. Row 3 is demotion, not disclosure: its guard at `:649`, opening the row at `:650`, is `entry.tentative \|\| hasNote \|\| approver`, a presence test, with no hover, click or expansion state anywhere in the file — AC-9. |
| § 4.6 — what the image is silent about and this ticket keeps | Holiday name with `data-kind` `:498-500`; bridge badge `border border-current` with no fill `:507-509`; lavender tint on the heading only and only for `nonWorkingReason === "holiday"` `:468`; tentative dashed border `:562-564`; `week-day-empty` with its sentence `:516-518`; `week-empty-card` `:717` | Yes. None of the six was edited. `git diff -U0` shows no hunk touching `:496-521` except the comment added above the holiday branch. |
| § 5 — seam impact `none` | n/a | Yes. `src/lib/data/**` is not in `git diff --name-only`; the import block `:107-127` is unchanged; `seam.getTeam()` is still not called anywhere in the file, which is AC-14 read from the outside. |
| § 6 — schema delta `none` | n/a | Yes. Nothing under `supabase/` is in `git diff --name-only`. |

**AC-17, which § 4.5 rests on, was checked mechanically rather than by reading.** The set of
`data-testid` values and the set of `data-*` attribute names in `src/routes/WeekView.tsx` are each
identical to `HEAD`'s (`diff` of the two sorted sets is empty), so no selector was renamed, added or
removed. The full suite passes with no test file in the diff: `pnpm exec vitest run` → exit 0, 10
files, 186 tests; `pnpm exec playwright test` → exit 0, 165 tests. Both re-run by this session.

## R7 detail

**One row per ID in `invariants_touched`** (`.ai/board/tickets/UIE-05/ticket.yaml:52`).

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — *the absence count for a date is … and no second definition of this number exists anywhere in the system* (`.ai/registry/invariants.md:36`) | **Held, and not by a UI affordance.** The invariant is at risk here in exactly one way, which the plan named: merging a member's `am` and `pm` entries into one chip would make the week list disagree with the month cell. It was not done. `src/routes/WeekView.tsx:521` maps over `absentEntriesFor`'s output **per entry**, `:545` keys the `li` on `entry.id`, and `:547-548` give each row its own `data-entry-id` beside a shared `data-member-id` — so a member holding both portions on one date is two `week-row` elements, which is AC-10. Separately, no count of any kind was added: a grep of the file for a rendered total, proportion or threshold returns only a comment at `:713`, `absence.ts` is imported at `:115` for `absentEntriesFor`, `addDays` and `eachDateInRange` only, and `seam.getTeam()` is not called. So no second definition of the number exists in this file — the arithmetic is untouched because there is none. | `src/routes/WeekView.tsx:115`, `:521`, `:545`, `:547-548` |
| INV-06 — *an entry carries exactly one portion, and that portion applies to every date in its range* (`.ai/registry/invariants.md:38`) | **Held, and this is the invariant the image would have broken.** The portion pill is the product's only visible surface for INV-06, and the image deletes it. It was moved to row 2 and not dropped: `week-row-portion` at `:635` still carries `data-portion={entry.portion}` and renders `PORTION_LABELS[entry.portion]` at `:639`. The value is read off the entry inside the per-date `people.map` at `:521`, so it is emitted once per rendered date — which is what makes a five-day `pm` entry render five afternoons and unable to show a whole day in the middle. Verified rather than argued: `tests/e2e/cal-05-week-view.spec.ts:193` (*AC-4 and INV-06: a five-day pm entry is five afternoons*) and `:172` (*a half day and a whole day on one day read as different values*) both pass with no edit to either file. | `src/routes/WeekView.tsx:521`, `:635`, `:639`; `tests/e2e/cal-05-week-view.spec.ts:172`, `:193` |

INV-01, INV-02, INV-03, INV-05 and INV-07 are properties of stored entries and their members. This
change writes nothing, reads nothing new, makes no seam call it did not make before, and changes no
arithmetic — `git diff -U0 -- src/routes/WeekView.tsx` puts every hunk inside the render, none inside
the effect at `src/routes/WeekView.tsx:233-255`.

## Findings

None. No check failed, so no routing row applies.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | — | — | — |

## One thing that is true and belongs to the orchestrator, not to this gate

**`gates.plan` is `passed: false` and the READY DoR gate never ran.** `ticket.yaml:24-27` records it
in terms: the state went `BACKLOG` straight to `REVIEW`, because `/implement` was invoked directly
after `/plan` and the orchestrator's grade of the Definition of Ready was never taken. The file
leaves the gate false deliberately rather than filling it in, which is the right call — a gate is a
claim about a check that ran.

**This is not an R1–R8 failure and is not routed here.** The REVIEW gate is R1 through R8
(`.ai/01-operating-model.md:84`) and none of them is a precondition check on an upstream gate. It is
recorded because `.claude/commands/ship.md:12` requires **both** gates `passed: true` with
timestamps, so `/ship` will refuse this ticket until the orchestrator grades the DoR and stamps
`plan`. The six DoR items are all satisfiable on `ticket.yaml` as it stands — that is the
orchestrator's judgement to make and to record, not this reviewer's.

## Verdict

**`PASS`.** All eight checks pass, each citing a line in the implementation. The ticket advances to
`DONE` (ADR-022 removed the QA stage that used to sit here), subject to the orchestrator stamping
`gates.plan` first.

The change is the plan's, built as written. Its one deviation — a percentage `min-height` in place of
the `calc(…)` the plan named — is the plan's own *Open question* 1, which reserved the declaration
for a stage with a rendered viewport, and the property the plan specified is what shipped. The two
things this ticket most easily could have got wrong, and did not, are the ones the plan predicted:
the chip keeps all five facts at rest rather than reaching the image's 44px, and no count was added
or approximated while ADR-029 is still `PROPOSED`.
