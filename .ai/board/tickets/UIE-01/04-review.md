---
ticket: UIE-01
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-07T10:55:14+07:00   # Review pass 2. Pass 1 (09:52, FAIL) is recorded in § Review pass 1.
inputs_read:
  - .ai/board/tickets/UIE-01/01-plan.md
  - .ai/board/tickets/UIE-01/03-impl-log.md
  - .ai/board/tickets/UIE-01/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/registry/decisions/ADR-022-the-qa-stage-is-removed.md
  - .ai/01-operating-model.md
  - .ai/standards/testing-standards.md
  - .claude/commands/implement.md
  - .claude/commands/ship.md
  - playwright.config.ts
  - git diff (working tree, branch feat/UIE-01)
  - src/index.css
  - src/components/AuthCard.tsx
  - src/routes/SignIn.tsx
  - src/routes/SignUp.tsx
  - src/App.tsx
  - dist/assets/index-C8kPtCwE.css
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# UIE-01 — review report

**`next_state: DONE`, not the template's `QA`.** `.ai/templates/review-report.md` still carries
`next_state: QA` in its front-matter block; ADR-022 removed that stage, and the lifecycle it left is
`… -> IN_PROGRESS -> REVIEW -> DONE` (`.ai/01-operating-model.md:36`,
`.ai/registry/decisions/ADR-022-the-qa-stage-is-removed.md:47`). `/ship` is what writes `state: DONE` and
opens the pull request (`.claude/commands/ship.md:38`). The stale template line is one of the
unfinished renumberings recorded under *Not part of this gate* item 4.

## Review pass 2 — what was re-checked and how

Fresh session, files only, no channel to the Developer. **Every check below was performed again from
the tree rather than carried forward** (RULE-13, `.ai/standards/session-model.md`): the four suites
were re-run, the built stylesheet was re-inspected, all sixteen selectors were re-resolved, and the
seven invariants were re-reasoned. The finding from pass 1 was verified fixed **by measuring the
rendered page, not by reading the class string** — the pass-1 defect was precisely a case where the
class string looked right and the geometry was not.

`vite build` + `vite preview`, Chromium at 1000×900, gaps computed from bounding boxes as
`next.y - (prev.y + prev.height)`, driven from an out-of-tree script so no file under `tests/` was
created or touched:

| gap | `01-plan.md:461-462` says | measured |
|---|---|---|
| subtitle → segmented control | 20px | 20 |
| control → first field | 20px | 20 |
| label → input | 6px | 6 |
| field group → field group | 16px | 16 |
| last field → error row (`/signin`, refusal rendered) | 24px | **24** |
| error row → button (`/signin`, refusal rendered) | 24px | **24** |
| last field → button, no error (`/signin`) | 24px | **24** |
| last field → button, no error (`/signup`) | 24px | **24** |

All six of § 4.3's rhythm values now hold. `document.documentElement.scrollWidth ===
clientWidth` on `/signup` at both 1000px and 360px, so the two added margins did not reintroduce the
AC-16 overflow.

**The 16 + 8 mechanism is correct, not a coincidence that happened to measure right.** In a flex
column a `gap` and an item's `margin-top` both apply and do not collapse, so
`FIELD_STACK`'s `gap-4` plus `mt-2` is 16 + 8 = 24. Confirmed in the built stylesheet:
`.gap-4{gap:calc(var(--spacing) * 4)}` and `.mt-2{margin-top:calc(var(--spacing) * 2)}` against
`--spacing: .25rem`. The Developer's reasoning at `src/components/AuthCard.tsx:128-134` is right that
no literal spelling was available without taking the gap off the form and adding a wrapper element to
both routes.

**The reading of "24px → error when present → 24px" is declared and is the better of the two.**
`src/components/AuthCard.tsx:154-160` states it: the button's `mt-2` applies whether or not an error
is rendered, so with no error the two values collapse to the single 24px gap they bracket. The
alternative would move the button 8px at the moment a refusal appears — a conditional § 4.3 does not
state — and would require passing error presence into `primaryButtonClass`, which is layout state the
button has no other reason to hold. Both readings were measured; the one built is the one that keeps
the button still.

**The fix is two class strings and it touched neither route.** `src/routes/SignIn.tsx` and
`src/routes/SignUp.tsx` are byte-identical to the files reviewed at pass 1 (142 and 201 lines,
unchanged), and both already consumed `FORM_ERROR` and `primaryButtonClass()`. That is the shared
vocabulary of *Deviations* 4 paying for itself: a spacing correction that would otherwise have been
two edits kept equal by hand was one edit in the file that owns the card.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | Fifteen paths in `git status --porcelain -uall`; every one resolves under a line of `.ai/board/tickets/UIE-01/ticket.yaml:61-68`. The six binaries under `public/fonts/` resolve to `:68`; the four ticket artifacts to `:62`. Nothing under `tests/`, `supabase/`, `src/lib/`, `package.json` or `pnpm-lock.yaml` appears. Re-run this pass, not carried forward |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` (`.ai/standards/testing-standards.md:16`) — exit 0, no output, on the tree as it stands now |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` (`:17`) — exit 0. This is also RULE-02's enforcement (`.ai/registry/rules.md:58`) and the § Language diacritic rule (`eslint.config.js:83-92`), both silent on all three source files |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | Every import in the three files, re-read: `src/components/AuthCard.tsx:12-13` takes `react` and `react-router-dom` only; `src/routes/SignUp.tsx:11` reaches the seam through its one door, `import { seam } from "@/lib/data"`; `src/routes/SignIn.tsx:14` imports a *type* from that same door and receives `signIn` as a prop (`:25`). No `@supabase/*`, no `./supabase`, no `./mock`, and nothing under `src/lib/` is in the diff |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | **PASS** | The pass-1 finding is fixed at `src/components/AuthCard.tsx:139` and `:164` and measured above. Every other § 4 item re-verified in the per-item table below |
| R6 | Permission gating matches plan section 3 | PASS | `01-plan.md:323-326`'s four rows are all `Changed here: no`, and the diff confirms it: `src/App.tsx`'s entire diff is one `className` on line 36, so `/signup` at `src/App.tsx:68` stays reachable in every membership state (ADR-009) and the `/signin` guard at `:74-79` still navigates away for anything but `signed-out`. The one new affordance is a static `<Link>` pair (`src/components/AuthCard.tsx:72-87`) to a route that was never guarded — it grants nothing and discloses nothing. `tests/e2e/tea-05-sign-in.spec.ts:39-56` passes unedited |
| R7 | No invariant violated (RULE-07) | PASS | Per-ID table below, re-reasoned this pass. `invariants_touched: []` at `.ai/board/tickets/UIE-01/ticket.yaml:35` |
| R8 | No dependency added without an ADR | PASS | `git diff -- package.json pnpm-lock.yaml` is empty (0 lines); neither file appears in `git status`. The faces are self-hosted `@font-face` over committed `.woff2` (`src/index.css:26-84`), which is neither an npm dependency (`.ai/standards/coding-standards.md:91`) nor a runtime third party (`.ai/standards/integrations.md:38-42`) — so `requires_adr: false` at `ticket.yaml:70` is still true. `dist/fonts/` holds all six files after `vite build`, so nothing falls back to a network fetch. The Google Fonts `@import` the prototype uses was rejected at `01-plan.md:558-565` and appears nowhere in `src/index.css` |

## R5 detail

One row per contract item in `01-plan.md` § 4. Every row re-resolved against the tree this pass.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| 4.1 `@theme` — ground and surface (`--color-bg`, `--color-card`, `--color-line`) | `src/index.css:102-104` | yes — the three hex values are `_figma/src/index.css`'s, unchanged |
| 4.1 `@theme` — ink (`--color-ink`, `-2`, `-3`) | `src/index.css:107-109` | yes |
| 4.1 `@theme` — the four originated (`--color-field`, `--color-track`, `--color-primary`, `--color-danger`) | `src/index.css:112-115` | yes |
| 4.1 `--radius-lg: 26px` | `src/index.css:124` as `--radius-card: 26px` | **renamed, and the rename is correct — now confirmed in the build output rather than argued.** `dist/assets/index-C8kPtCwE.css` carries `--radius-lg:.5rem` (Tailwind's own) alongside `--radius-card`, and emits `.rounded-lg{border-radius:var(--radius-lg)}` and `.rounded-card{border-radius:var(--radius-card)}` as two separate rules. Taking the plan's name would have repainted the ten `rounded-lg` elements across `src/components/BulkRejection.tsx`, `src/components/EntryDecision.tsx`, `src/routes/PendingEntries.tsx`, `src/routes/Holidays.tsx`, `src/routes/NewEntry.tsx` and `src/routes/TeamEntries.tsx`, all six of which `01-plan.md:107-109` places out of scope. The value is unchanged. Declared at `03-impl-log.md` *Deviations* 1 |
| 4.1 `--radius-pill`, `--shadow-soft` | `src/index.css:125,127-128` | yes — both values character-identical to the plan |
| 4.1 `--font-display`, `--font-sans` | `src/index.css:130-131` | yes, including the system fallback each stack carries |
| 4.1 `@font-face`, self-hosted, Vietnamese subset explicit | `src/index.css:26-84` | yes — six blocks rather than three, which is what `01-plan.md:407-411` requires in prose two paragraphs after naming three files ("the Latin ranges each family also needs must be declared beside it"). Three files cannot satisfy both sentences. `public/fonts/**` is a glob at `ticket.yaml:68` precisely so the filenames could be settled at IN_PROGRESS (`01-plan.md:529-532`), and `dist/fonts/` confirms all six ship |
| 4.2 `AuthTab` and the `AuthCard` signature | `src/components/AuthCard.tsx:15,51` | yes — `AuthCard({ tab, showTabs = true, children }): JSX.Element`, prop for prop |
| 4.2 render order: wrapper, card, title with 🐰, subtitle, control when `showTabs`, children | `src/components/AuthCard.tsx:60,61,64-66,67,70-89,91` | yes, in that order |
| 4.2 the two halves are `react-router-dom` `<Link>`s to `/signin` and `/signup` | `src/components/AuthCard.tsx:13,72-79,80-87` | yes — links, not buttons; two routes, not a merged one |
| 4.2 the name resolved as a bare string, not via `copyDebt` | `src/components/AuthCard.tsx:41` | yes. `ui-language.json` is untouched and still empty; `pnpm exec eslint .` exits 0. The reasoning at `:32-36` is right about why an escape sequence would not have sufficed — the rule selects on `Literal[value=…]` and a Literal's value is the decoded string |
| 4.2 new selectors limited to `auth-card`, `auth-tab-signin`, `auth-tab-signup` | `src/components/AuthCard.tsx:61,73,81` | yes — exactly the three § 4.2 permits, no fourth |
| 4.3 ground: `--color-bg`, full viewport, flat | `src/App.tsx:36` | yes |
| 4.3 card: `--color-card`, the card radius, `--shadow-soft`, no border, 355px cap, 32px padding | `src/components/AuthCard.tsx:60-61` | yes — `max-w-[355px]`, `p-8`, `shadow-soft`, `bg-card`, no border utility |
| 4.3 title: display face 700, ~28px, `--color-ink`, centred | `src/components/AuthCard.tsx:64` | yes |
| 4.3 subtitle: body face 400, ~13px, `--color-ink-2`, centred | `src/components/AuthCard.tsx:67` | yes |
| 4.3 segmented control: 44px pill on `--color-track`; selected a white pill with `--shadow-soft` and ink 700; unselected transparent on `--color-ink-3` | `src/components/AuthCard.tsx:45-49,71` | yes — `p-1` on the track plus `py-2` on a `text-sm` half computes to 44px, and `TAB_ON`/`TAB_OFF` carry the two treatments |
| 4.3 field label: 700, ~10px, uppercase, letter-spaced, `--color-ink-3`, 6px above its input | `src/components/AuthCard.tsx:106` | yes — `mb-1.5` is the 6px, measured 6 |
| 4.3 input: 44px, pill, borderless, `--color-field`, ink text | `src/components/AuthCard.tsx:109-110` | yes |
| 4.3 avatar swatch: 44px round on `--color-field`; selected adds a 2px `--color-ink` ring **and** `aria-checked` | `src/routes/SignUp.tsx:143,148,150` | yes — both channels, not one |
| 4.3 primary button, three appearances, none an opacity of another | `src/components/AuthCard.tsx:162-169` | yes — `bg-primary` resting, `bg-ink-3 cursor-not-allowed` disabled, `bg-primary cursor-progress` submitting. `submitting` is tested first, which is necessary because the element is also `disabled` in flight |
| 4.3 error: `--color-danger`, ~13px, between the last field and the button, `role="alert"` | `src/components/AuthCard.tsx:139`, rendered at `src/routes/SignIn.tsx:108-112` and `src/routes/SignUp.tsx:184-188` | yes on all four |
| 4.3 focus: `outline: 2px solid --color-ink` at `outline-offset: 2px` on `:focus-visible`, every interactive element | `src/components/AuthCard.tsx:47,114,165`, `src/routes/SignUp.tsx:149` | yes, on all five kinds of control — both tab halves, both inputs, every swatch, the button |
| 4.3 vertical rhythm | `src/components/AuthCard.tsx:67,71,91,123,139,164` | **yes, all six values, measured in a browser** — the table at the head of this report. This is the pass-1 finding, now closed |
| 4.4 the one line in `src/App.tsx` | `src/App.tsx:36` | yes, and the diff on that file is literally one line. `bg-bg` rather than `bg-[--color-bg]` is a correct substitution, not drift — a generated utility is how Tailwind v4 learns a theme token is used, and the built stylesheet carries `--color-bg` in `:root` and emits the utility. Declared at `03-impl-log.md` *Deviations* 3. `data-testid="app-root"` and the banner block at `src/App.tsx:44` are untouched. (§ 4.4 says "line 35"; the element is at 36 — the plan's own count is off by one and nothing turns on it) |
| 4.5 the `/signup` comment rewritten, not deleted | `src/routes/SignIn.tsx:127-142` | yes — it records the reversal, cites UIE-01, and keeps the part worth keeping, which is why the reversal is not ADR-level |
| 5 seam impact: none | `src/routes/SignIn.tsx:48`, `src/routes/SignUp.tsx:57` | yes — `signIn({ email, password })` and `seam.signUp({ email, password, displayName, avatar })`, same arguments in the same shapes. Nothing under `src/lib/` is in `git status` and `tests/seam-parity.test.ts` is untouched |
| 6 schema delta: none | — | yes — nothing under `supabase/` appears in `git status` |

**AC-10, re-resolved independently of the log.** All thirteen frozen `data-testid` names are present
on elements playing the same roles: `sign-in-email` `SignIn.tsx:83`, `sign-in-password` `:96`,
`sign-in-error` `:109`, `sign-in-submit` `:115`, `signup-form` `SignUp.tsx:94`,
`signup-display-name` `:101`, `signup-avatar-picker` `:131`, `signup-avatar-option` `:140`,
`signup-email` `:162`, `signup-password` `:174`, `signup-error` `:185`, `signup-submit` `:191`,
`signup-confirm-notice` `:77`. Three added, which AC-10 permits. `app-root` `App.tsx:36` and
`seam-banner` `App.tsx:44` unchanged.

**AC-18, re-run rather than re-read.** `pnpm exec vitest run` — 186 tests in 10 files, all pass.
`pnpm exec playwright test` — 165 tests, all pass, including the `seam-guard` project. No file under
`tests/` appears in `git status --porcelain -uall`, so the suite that passed is the one that shipped.

## R7 detail

`invariants_touched` is `[]`. That is not accepted as a summary, so every ID in
`.ai/registry/invariants.md:33-39` is reasoned through individually. The argument does not rest on
the change looking safe; the last row carries the structural form.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no two entries of one member over the same portion of a date | Untouched. Overlap is decided below the seam; no file in this diff reads, writes or compares an `entry` row | `.ai/registry/invariants.md:33`; `git status --porcelain -uall` lists nothing under `src/lib/` or `supabase/` |
| INV-02 — an edited approved entry returns to `pending` | Untouched. No approval transition exists on either auth route; neither file names `pending`, `approved` or `status` | `.ai/registry/invariants.md:34`; `src/routes/SignIn.tsx`, `src/routes/SignUp.tsx` — both read in full |
| INV-03 — a rejected entry carries a non-empty reason | Untouched. The only refusal either screen renders is an authentication `Failure` returned by the seam and rendered verbatim; neither screen composes one | `.ai/registry/invariants.md:35`; `src/routes/SignIn.tsx:59`, `src/routes/SignUp.tsx:61` |
| INV-04 — the single definition of the absence count | Untouched. There is no arithmetic of any kind in this diff — no sum, no 0.5, no date | `.ai/registry/invariants.md:36`; `src/index.css`, `src/components/AuthCard.tsx`, both routes, `src/App.tsx:36` |
| INV-05 — a tentative entry counts as a non-tentative one does | Untouched. `tentative` appears nowhere in the diff | `.ai/registry/invariants.md:37` |
| INV-06 — one portion per entry, applied to every date in its range | Untouched. `portion` appears nowhere in the diff | `.ai/registry/invariants.md:38` |
| INV-07 — every entry belongs to exactly one member, counted against that member's team | Untouched, **and this row carries the structural claim.** Every file in this diff sits above the seam: `src/components/AuthCard.tsx:12-13` imports `react` and `react-router-dom` only, both routes reach the datastore only through `@/lib/data`, `src/App.tsx`'s diff is one `className`, and `src/index.css` is a stylesheet. No query, no policy, no migration, no SQL. `pnpm exec eslint .` exits 0, so RULE-02's `no-restricted-imports` found nothing to refuse | `.ai/registry/invariants.md:39`; `src/components/AuthCard.tsx:12-13`, `src/routes/SignUp.tsx:11`, `src/routes/SignIn.tsx:14`, `src/App.tsx:36` |

An invariant held only by a UI affordance is not held — and none of the seven is held by anything on
these two screens. Membership and team assignment are decided by the allow-list and the admission
trigger, not by the sign-up form, which `src/routes/SignUp.tsx:36-39` already records.

**The rework cycle introduced no invariant surface.** Its whole diff is two Tailwind spacing
utilities inside two exported class strings in a presentational component.

## Findings

None. R1 through R8 all pass.

## Review pass 1 — the finding that was raised and is now closed

Recorded rather than overwritten, so the cycle stays legible against the code that answered it.

| # | Check | Finding | Routed to | Incremented `rework_count` | Status |
|---|---|---|---|---|---|
| 1 | R5 | `01-plan.md:461-462` states the rhythm as "… fields **→ 24px → error when present → 24px** → button". The first four values were implemented exactly; the last two were not — the error paragraph and the button were ordinary children of the form, whose only separation was `FIELD_STACK`'s `gap-4`, 16px at both points. The deviation was undeclared, and the impl log's § 4.3 contract row restated the rhythm with those two values removed | `developer` (`.ai/01-operating-model.md:144`) | Yes | **Closed.** `mt-2` on `src/components/AuthCard.tsx:139` and `:164`; measured 24/24/24/24 |

The Developer's answer is better than a minimal fix in two respects worth recording: it put the
correction on the shared constants so the two screens cannot drift on a spacing value, and it wrote
the 16 + 8 arithmetic into `src/components/AuthCard.tsx:119-121,128-134,151-152` so the next reader
does not re-derive it and so `FIELD_STACK`'s comment names what depends on its value. The elision in
the impl log is acknowledged in place at `03-impl-log.md` § *Rework cycle 1*.

## Not part of this gate

Four things are true, are not R1–R8 failures, and are recorded so the next session does not
rediscover them. None affects the verdict.

1. **`gates.plan` is still `{ passed: false, at: null }`** at `.ai/board/tickets/UIE-01/ticket.yaml:89`,
   and `state` was `BACKLOG` when `/implement` first ran. `03-impl-log.md` *Open questions* 4 is
   right that the PLAN→READY transition belongs to `orchestrator` and right not to have flipped it.
   Named again because `/ship` requires both gates true with timestamps
   (`.claude/commands/ship.md:12`, `.ai/01-operating-model.md:349`) and will stop on it.
2. **`rework_count: 1` was written by `developer`, and `ticket.yaml` is not in that stage's Writes
   column.** `.ai/01-operating-model.md:83` gives IN_PROGRESS "code, `03-impl-log.md`"; `ticket.yaml`
   belongs to PLAN, READY and DONE, and `.claude/commands/implement.md` never instructs a write to
   it. The value is substantively correct — pass 1 did route the finding to `developer` and did state
   the increment — and the reasoning at `ticket.yaml:72-81` is careful about why the count was
   written and `state` was not. **The risk is double-counting:** the dispatch loop increments on
   reading a FAIL (`.ai/01-operating-model.md:290`), so an `orchestrator` run over pass 1's verdict
   would take this to 2, which is RULE-06's escalation threshold. Whoever runs `orchestrator` next
   should confirm the count is 1 and not increment it again. Not an R-check — R1 passes because
   `.ai/board/tickets/UIE-01/**` is in `allowed_paths` — and it is the model's boundary to enforce,
   not this gate's.
3. **The product shows two names** — `Ai Nghỉ?` at `src/components/AuthCard.tsx:41` and `CaleChip` at
   `index.html:6` — and **§ *Colour* and § *Type* in `.ai/standards/ui-design-system.md` are still
   `TODO(project)` stubs** while `src/index.css:100-131` now holds fourteen real values. Neither
   could be closed from inside this ticket: `index.html` is not in `allowed_paths`, and the standards
   file is human plane under RULE-01. `01-plan.md` *Open questions* 1 and `03-impl-log.md` *Open
   questions* 1 raised both for the operator and both are still open.
4. **ADR-022's R-check renumbering is only half applied across the repository.**
   `.ai/registry/decisions/ADR-022-the-qa-stage-is-removed.md:62` is explicit: *"Review check R7 is
   removed and R8, R9 renumber to R7, R8."* That landed in the checklist and in the failure routing
   table (`.ai/01-operating-model.md:144-147`), which is the numbering this report uses. It did not
   land in four places: `.ai/registry/rules.md:63` still maps RULE-07 to "Review check R8";
   `.ai/standards/coding-standards.md:91` and `.ai/standards/integrations.md:42` still call the
   dependency check **R9**; and `.ai/templates/review-report.md` lists R7 as the invariant check in
   its checklist while heading its per-invariant section "R8 detail" — the same template ADR-022:139
   records as needing exactly this correction. The `/review` skill description still says "R1 to R9",
   and the template's front-matter still says `next_state: QA`. Both checks were run and both pass,
   so nothing here turns on it — but a reviewer following `rules.md` would escalate an R8 failure to
   a human and route an R7 one to the Developer, which is the two routings exactly swapped. It is a
   model defect, human plane, and belongs to `/thuki`.

## Verdict

`PASS`. R1 through R8 all pass, each cited above against the implementation. The single pass-1
finding is fixed and was verified by measuring the rendered page rather than by reading the change.
The whole existing suite — 186 unit tests and 165 end-to-end tests — passes with no test file
edited, all thirteen frozen selectors survive with the three the plan permits added beside them, and
every deviation from `01-plan.md` § 4 is declared and better than the text it departs from.

`next_state: DONE`. The board move and the `review` gate are `orchestrator`'s; this stage writes
this file and nothing else.

## Changelog

- `2026-09-07T09:52:22+07:00` — review pass 1, `gate: FAIL`, one R5 finding routed to `developer`.
  Raised by `tech-lead-review`.
- `2026-09-07T10:55:14+07:00` — review pass 2 in a fresh session, every check re-run from the tree.
  `gate: PASS`. The pass-1 finding is closed and retained above rather than overwritten. Raised by
  `tech-lead-review`. Amended by `tech-lead-review`.
