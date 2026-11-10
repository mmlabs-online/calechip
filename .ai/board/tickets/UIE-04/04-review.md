---
ticket: UIE-04
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-07T16:17:25+07:00
inputs_read:
  - .ai/board/tickets/UIE-04/01-plan.md
  - .ai/board/tickets/UIE-04/03-impl-log.md
  - .ai/board/tickets/UIE-04/ticket.yaml
  - git diff (2 tracked files) and git status --porcelain (2 untracked)
  - src/routes/WeekView.tsx
  - src/components/AppShell.tsx
  - src/index.css
  - dist/assets/index-*.css (built stylesheet, read for the two utility facts below)
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-022-the-qa-stage-is-removed.md
  - .ai/01-operating-model.md
  - .ai/standards/git-conventions.md
  - .ai/standards/testing-standards.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# UIE-04 — review report

`next_state` is `DONE`, not the `QA` the template still prints. ADR-022 removed the QA stage and the
lifecycle at `.ai/01-operating-model.md:36` runs `REVIEW -> DONE`.

**R1 through R8 pass.** Every check below cites the line it was read from. The two facts about
Tailwind that the whole layout turns on — that `xl` is 1280px and that `rounded-t-card` is a real
utility — were re-read out of the built stylesheet in this session rather than taken from
`03-impl-log.md`'s claim to have done the same, because they are the kind of fact the tech-stack
file marks as past reliable recall and a reviewer that accepts the developer's reading of the
machine has not checked the machine.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/UIE-04/ticket.yaml:58-60` against a working tree of `src/routes/WeekView.tsx`, `.ai/board/tickets/UIE-04/ticket.yaml`, `.ai/board/tickets/UIE-04/01-plan.md`, `.ai/board/tickets/UIE-04/03-impl-log.md` — four paths, all matched by the two globs |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` — exit 0, run in this session |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` — exit 0, run in this session |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/WeekView.tsx:60` is the only data import (`seam` from `@/lib/data`); the three reads at `:202-204` and the one at `:182` are all `seam.*`; no import of `./supabase` or `./mock`, and the diff adds no import at all |
| R5 | Every contract item in plan § 4 is implemented (RULE-04) | PASS | per-item table below |
| R6 | Permission gating matches plan § 3 | PASS | `src/routes/WeekView.tsx:258, 270, 274, 284` |
| R7 | No invariant violated — each ID in `invariants_touched` reasoned through (RULE-07) | PASS | per-ID table below |
| R8 | No dependency added without an ADR | PASS | `git diff --name-only -- package.json pnpm-lock.yaml` returns nothing; `src/routes/WeekView.tsx:56-76` is the whole import block and the diff changes no line in it |

## R5 detail

`01-plan.md` is the merged artifact ADR-019 produced, so the contract is its **§ 4** — § 1 is
*Problem and scope*. One row per item.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 — no count, no footer strip | `src/routes/WeekView.tsx:333-530` holds the whole grid and no numeric element; `grep getTeam` finds only the comment at `:11-12`, never a call; `src/lib/data/absence.ts` is absent from the diff | yes — and the refusal is stated at `:48-55` for the next reader, who arrives from a transcription that draws the strip |
| § 4.2 — seven columns ≥1280px, the shipped stack below | `src/routes/WeekView.tsx:333` — `flex flex-col gap-3 xl:grid xl:grid-cols-7 xl:gap-2`. `xl` is `@media (width>=80rem)` and `.xl\:grid-cols-7` is `repeat(7,minmax(0,1fr))`, both read out of `dist/assets/*.css` after `pnpm exec vite build` in this session | yes — 1280px exactly, and seven **equal** tracks |
| § 4.2 — no column scrolls on its own | `src/routes/WeekView.tsx` contains no `overflow`, no `h-`, no `max-h` outside the comment at `:329`; the single scrolling region is the pane UIE-02 established at `src/components/AppShell.tsx:40` | yes |
| § 4.3 — the grid: 8px gutters | `src/routes/WeekView.tsx:333` — `xl:gap-2` | yes |
| § 4.3 — a day: `bg-card`, `rounded-card`, `shadow-soft`, no border, full track width | `src/routes/WeekView.tsx:357` — `flex min-w-0 flex-col rounded-card bg-card p-4 shadow-soft`, no border utility | yes — the three tokens exist at `src/index.css:103, 124, 127` and none was added |
| § 4.3 — the header strip; holiday name and bridge badge beside it; lavender on a non-working holiday only | `src/routes/WeekView.tsx:359-391` — `week-day-label` `:360`, `week-day-holiday` with `data-kind` `:376-377`, `week-day-bridge` `:385`, and the tint at `:366` still keyed on `status?.nonWorkingReason === "holiday"` | yes — the only change is `rounded-t-2xl` -> `rounded-t-card` at `:362`, and that utility is generated (`dist/assets/*.css`: `rounded-t-card{border-top-left-radius:var(--radius-card);border-top-right-radius:var(--radius-card)}`) |
| § 4.3 — an entry: the shipped chip, unchanged in content | `src/routes/WeekView.tsx:419-491` — all seven children, none behind an expand or a hover; the only class changed is `break-words` at `:473` | yes |
| § 4.3 — a quiet day: the shipped sentence | `src/routes/WeekView.tsx:394` | yes — untouched |
| § 4.3 — an empty week: one card over the columns, a mascot, one English sentence, no control | `src/routes/WeekView.tsx:517-530`, gated by `weekIsEmpty` at `:301`, `hidden … xl:flex` at `:518` | yes — `week-empty-card` at `:520` is the one new selector, and it is additive |
| § 4.4 — `mx-auto max-w-3xl` goes | `src/routes/WeekView.tsx:306` is now `<section className="flex flex-col gap-6">` | yes — and `src/components/AppShell.tsx` is absent from the diff, so the pane's `min-w-0 flex-1` (`:40, :42`) was used rather than changed |
| § 5 — seam impact none | `src/routes/WeekView.tsx:182, 202-204` — the same four calls, in the same place; `tests/seam-parity.test.ts` absent from the diff | yes |
| § 6 — schema delta none | nothing under `supabase/` in `git status --porcelain` | yes |

**AC-14 is the item most easily lost in a rewrite of this size and it holds.** All fourteen grid
selectors are present on elements playing the same role — `week-day` `:344`, `week-day-label` `:360`,
`week-day-holiday` `:376`, `week-day-bridge` `:385`, `week-day-empty` `:394`, `week-row` `:419` with
`data-member-id` `:420` and `data-entry-id` `:421`, `week-row-avatar` `:436`, `week-row-name` `:439`,
`week-row-type` `:443`, `week-row-portion` `:452`, `week-row-tentative` `:462`, `week-row-note`
`:473`, `week-row-approver` `:483` — and `pnpm exec playwright test` returned **165 passed** with
`git status --porcelain` showing no file under `tests/`.

**AC-16.** `pnpm exec eslint .` exits 0, which is the § Language rule the mascot's new sentence at
`src/routes/WeekView.tsx:526` had to pass.

## R7 detail

**One row per ID in `invariants_touched`.** `.ai/board/tickets/UIE-04/ticket.yaml:39` declares
`[INV-04]`.

| Invariant | Held by | Citation |
|---|---|---|
| INV-04 — one definition of the absence count, 1 per `full` and 0.5 per `am`/`pm`, and no second definition anywhere | **Two engagements, both satisfied by code rather than by an affordance.** (1) *No count is created.* There is no numeric element anywhere in the grid, no footer strip, and `seam.getTeam()` — the call the mockup's `0/8 vắng` would have required — is never made: the only occurrence of the string is the comment at `:11-12`, and the four seam calls in the file are `getCurrentMember`, `listMembers`, `listTeamEntriesOverlapping` and `listHolidays`. `src/lib/data/absence.ts` does not appear in `git status --porcelain`, so INV-04's single implementation is byte-identical. (2) *The set that count sums is re-presented without being merged.* The space-saving a 161px column invites is folding a member's `am` and `pm` entries into one chip, which would make this screen say one where the month grid says two. It was not done: the `<li>` is still keyed by `entry.id` and carries its own `data-entry-id`, one element per entry and not per member. | `src/routes/WeekView.tsx:182, 202-204` (the four calls, no `getTeam`); `:414-421` (one `<li>` per entry, `key={entry.id}`, `data-entry-id={entry.id}`, `data-member-id={member.id}`); `src/lib/data/absence.ts` unchanged per `git status --porcelain` |

No other ID is engaged. INV-01, INV-02, INV-03, INV-05, INV-06 and INV-07 are properties of stored
entries; this change writes nothing, adds no read, and alters no arithmetic — the diff touches
markup and class strings only.

## Findings

`none`.

Three things were checked and are **not** findings, recorded so the next reader does not re-check
them:

1. **`max-w-3xl` leaving changes the stacked layout below 1280px too** — the day blocks are now the
   pane's full width rather than centred at 768px. This is not a deviation: AC-2 says *"one
   full-width block per day"* and § 4.4 orders the removal in those words
   (`src/routes/WeekView.tsx:306`). § 4.2's table calls the narrow layout "unchanged", which reads
   loosely against § 4.4, but the acceptance criterion is the gate and the code matches it.
2. **`03-impl-log.md` cites `:179-183` for "three reads and no fourth".** The reads are at
   `src/routes/WeekView.tsx:202-204`, with `getCurrentMember` at `:182`. The claim is true; the line
   range is stale by one edit. Every other citation in that log resolves exactly, including all
   fifteen rows of its testability contract.
3. **`03-impl-log.md` § Deviations records three retokenisations deliberately not done** — the
   holiday tint stays `bg-violet-100` (`:366`), the chips stay `bg-orange-100` / `bg-emerald-100`
   (`:426`), and the four refusal states keep `bg-white rounded-2xl shadow-sm` (`:258, 270, 274,
   284`). Each is correct under § 1 *Out of scope* item 3 and § 3, and each is a colour that now
   disagrees with the sidebar legend meant to explain it. That divergence is real, it is older than
   this ticket, and it belongs to `.ai/standards/ui-design-system.md` § *Colour* — still a bare
   `TODO(project)` — rather than to a layout ticket. Carried as the log's Open question 4.

**Two open questions in `03-impl-log.md` outlive this gate and neither blocks it.** Open question 3
reports that a stacked day block is 96px wide at a 360px viewport because the sidebar keeps its fixed
216px — AC-15 still holds, nothing scrolls sideways, but the screen is not usable there and the
sidebar is UIE-02's. Open question 5 reports that `gates.plan.passed` is still `false` because no
orchestrator run happened between PLAN and IN_PROGRESS; `/ship`'s Definition of Done needs it `true`,
and it is neither the developer's row nor this reviewer's — `04-review.md` writes the verdict and
nothing else.

## Verdict

**`PASS`.** R1 through R8 all pass with citations. `next_state: DONE`.
