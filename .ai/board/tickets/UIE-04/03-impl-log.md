---
ticket: UIE-04
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-07T16:11:05+07:00
inputs_read:
  - .ai/board/tickets/UIE-04/01-plan.md
  - .ai/board/tickets/UIE-04/ticket.yaml
  - .ai/board/tickets/UIE-04/design/README.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - src/routes/WeekView.tsx
  - src/components/AppShell.tsx
  - src/components/Sidebar.tsx
  - src/index.css
  - eslint.config.js
  - ui-language.json
  - playwright.config.ts
  - tests/e2e/cal-05-week-view.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# UIE-04 — implementation log

## Files touched

The plan's `allowed_paths` holds one file outside the ticket folder and one file outside the ticket
folder is what changed. `src/index.css` stayed shut, no test file was edited, and the shell was not
opened.

**Section numbering.** ADR-019 merged SPEC and DESIGN into one artifact, so the contract this log
maps to is `01-plan.md` **§ 4**, not the § 1 the template names — § 1 in the merged plan is *Problem
and scope*. Where the template says "design section 1", read § 4; where it says "design section 6"
for the selector table, read § 4.3.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/routes/WeekView.tsx` | modified | the seven day sections become a seven-track grid above 1280px and keep the shipped stack below it; the day card takes the UIE-01/UIE-02 tokens; the mascot card is added for an empty week | § 4.2, § 4.3, § 4.4 |
| `.ai/board/tickets/UIE-04/03-impl-log.md` | created | this file | — |

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| § 4.1 — no count, no footer strip | `src/routes/WeekView.tsx:48-55` and by omission everywhere below it | Nothing was added that counts. `seam.getTeam()` is still uncalled (`:179-183` makes three reads and no fourth) and `absence.ts` was not opened. The refusal is now stated in the file header as well as held by the code, because the next reader arrives from a transcription that draws the strip. |
| § 4.2 — columns ≥1280px, the shipped stack below | `src/routes/WeekView.tsx:333` | One container, two layouts: `flex flex-col gap-3 xl:grid xl:grid-cols-7 xl:gap-2`. Tailwind's `xl` is `@media (width>=80rem)` — 1280px exactly; read out of the built stylesheet rather than recalled. |
| § 4.2 — no column scrolls on its own; the pane scrolls once | `src/routes/WeekView.tsx:333, 357` | Nothing sets a height and nothing sets `overflow` on a day, so every column resolves to `overflow-y: visible` and grid's default `stretch` gives all seven the height of the busiest. Measured below. |
| § 4.3 — the grid: seven equal tracks, 8px gutters | `src/routes/WeekView.tsx:333` | `grid-cols-7` is `repeat(7, minmax(0, 1fr))`; `gap-2` is 8px. Measured at 1440px: seven columns of 161px with 8px gutters. |
| § 4.3 — a day: `bg-card`, `rounded-card`, `shadow-soft`, no border, full track width | `src/routes/WeekView.tsx:357` | The three Tailwind defaults CAL-05 had to use before those tokens existed (`bg-white`, `rounded-2xl`, `shadow-sm`) are replaced by the tokens UIE-01 and UIE-02 shipped. `flex flex-col` puts the header strip above the entries; `min-w-0` is the other half of AC-15. |
| § 4.3 — the header strip, holiday name, bridge badge, lavender on the heading only | `src/routes/WeekView.tsx:360-390` | Carried through the rewrite unchanged except for the top corner radius, which now follows the card's (`rounded-t-2xl` → `rounded-t-card`). See § Deviations for the one thing deliberately *not* changed here. |
| § 4.3 — an entry: the shipped chip, unchanged in content | `src/routes/WeekView.tsx:419-491` | All seven children unchanged and none behind an expand or a hover. The one class touched is `break-words` on `week-row-note` (`:473`), so a long unbroken note wraps inside a 161px column instead of widening the pane. |
| § 4.3 — a quiet day: the shipped sentence | `src/routes/WeekView.tsx:394` | Untouched. All seven still render. |
| § 4.3 — an empty week: one card over the columns, a mascot and one English sentence, no control | `src/routes/WeekView.tsx:301, 517-530` | `weekIsEmpty` is derived from the same `absent` map the columns render from, so the card cannot disagree with the seven `week-day-empty` states beneath it. |
| § 4.4 — `mx-auto max-w-3xl` goes; the pane's full width is used | `src/routes/WeekView.tsx:306` | The shell already grants it with `min-w-0 flex-1` (`AppShell.tsx:40-44`). Nothing was added to the shell. |
| § 5 — seam impact none | `src/routes/WeekView.tsx:179-183` | The same three reads, in the same place. `tests/seam-parity.test.ts` untouched and passing. |
| § 6 — schema delta none | — | Nothing under `supabase/` opened. |

## Acceptance criteria

Sixteen criteria, and eleven of them are geometric or about a rendered viewport, which no test in
this repository asserts. They were **measured in a real browser** rather than reasoned about — see
§ Verification run for the method and § Open questions for the two numbers that came back different
from the plan's.

| AC | Held by | Evidence |
|----|---------|----------|
| AC-1 seven equal columns, Mon→Sun, visible gutter | `:333` | measured at 1440×900: seven boxes at x = 240, 409, 578, 747, 917, 1086, 1255; width 161px each; gutters 8,8,8,9,8,8; one row |
| AC-2 the shipped stack below 1280px | `:333` | measured at 1279px and at 360px: seven blocks, one x, increasing y, equal widths |
| AC-3 seven `week-day` at both widths | `:340-347` | measured at all three widths; `cal-05:128` and `cal-08:298` assert the count |
| AC-4 as tall as its content, no column scrollbar | `:333, :357` | measured: every column `overflow-y: visible`, `scrollHeight === clientHeight` |
| AC-5 the seven stay in horizontal register | `:333` | measured: all seven heights identical (290px), all seven tops identical |
| AC-6 the header names its day, above the entries | `:360-368` | `cal-05:145-146`; `flex flex-col` puts it first in the column |
| AC-7 the whole chip, nothing behind an expand | `:436-491` | measured inside a 161px column: all seven children present, chip 129px wide and 194px tall |
| AC-8 one row per entry, never per member | `:414-421` | unchanged from CAL-05 — the key and `data-entry-id` are the entry's |
| AC-9 CAL-08's shading survives unchanged | `:344-390` | measured on the bridged holiday week 2026-10-12: `data-day-status` holiday/working/weekend, `data-bridge` true on 10-16 with the badge and no holiday name, lavender on the heading of 10-15 only |
| AC-10 seven empty states on a quiet week | `:394` | measured: 7; `cal-05:266` asserts it |
| AC-11 the mascot card, seven-column layout only | `:517-530` | measured: visible at 1440px on an empty week, absent on a week with entries, not visible at 1279px or 360px |
| AC-12 the card carries no control | `:519-529` | measured: zero `a` and zero `button` inside it; `cal-05:253` already forbids an `a` inside a `week-day` |
| AC-13 the screen still counts nothing | by omission | no `n/total` anywhere on the rendered page; `seam.getTeam()` uncalled |
| AC-14 no selector renamed, no test edited | — | 165 end-to-end and 186 unit tests pass with `git status` showing no file under `tests/` |
| AC-15 nothing scrolls sideways | `:333, :357, :473` | measured at 1440, 1279 and 360: `scrollWidth === clientWidth` at each |
| AC-16 no string becomes Vietnamese | `:522-527` | lint exits 0 and `copyDebt` is still `[]` |

## Deviations from the design

`none`.

Three things the plan could be read as inviting were deliberately **not** done, and each is recorded
here rather than left for the reviewer to wonder about:

1. **The holiday tint stays `bg-violet-100`; it was not moved to `--color-holiday`.** § 4.3 lists
   `--color-holiday` among the tokens that already exist, which reads like an invitation. The two
   are different colours — `violet-100` is `#ede9fe`, `--color-holiday` is `#c9bff0` — so swapping
   them repaints CAL-08's shading on this screen, and § 1 *Out of scope* item 3 says not to
   re-decide any of it. The sidebar legend's lavender swatch and this heading therefore still differ
   from each other; that divergence is CAL-08's and UIE-02's to settle, and it is in § Open
   questions rather than fixed here.
2. **The entry chips stay `bg-orange-100` and `bg-emerald-100`.** Same shape of argument, and § 4.3
   says the chip is unchanged. `--color-pto` and `--color-wfh` are the legend's; the chips predate
   them. Also § Open questions.
3. **The four refusal states keep `bg-white rounded-2xl shadow-sm`.** § 3 says they render *instead
   of* the grid and are outside it, and no criterion reaches them. Retokenising them would be a
   fourth screen state changed by a layout ticket.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | **Nothing that counts was added, so no second definition exists to diverge.** The one number this ticket was invited to render — the mockup's footer strip, or triage's cheaper chip count — is absent: there is no footer strip, and a search of the rendered page for `n/total` finds nothing. `seam.getTeam()` is still uncalled and `src/lib/data/absence.ts` was not opened, so INV-04's one implementation is untouched. The second engagement is the presentational one: this ticket rewrites the container of the exact set that count sums, and the space-saving a developer reaches for at 161px is merging a member's `am` and `pm` entries into one chip — which would make this screen say one where the month grid says two. It was not done. The `<li>` is still keyed by `entry.id` with its own `data-entry-id` (`:415-419`), and the measurement above confirms a full chip fits a 161px column without it. |

## Verification run

Every command below was executed in this session, in this tree.

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | typecheck, `.ai/standards/testing-standards.md:16` |
| `pnpm exec eslint .` | 0 | lint, `:17` — including § Language, which is the rule the mascot's new sentence had to pass |
| `pnpm exec vitest run` | 0 | unit, `:18` — 186 tests, 10 files |
| `pnpm exec playwright test` | 0 | end-to-end, `:19` — 165 tests, **no test file edited** (AC-14) |
| `pnpm exec vite build` | 0 | not a gate command; run to read the generated stylesheet, below |
| `git diff --name-only` subset of `allowed_paths` | yes | `src/routes/WeekView.tsx` and this file |

**Two things were verified by reading the machine rather than by recall**, because both are facts
about a dependency this repository's tech-stack file marks as past reliable recall:

- **`rounded-t-card` exists.** Tailwind v4 generates directional variants from the `--radius-*`
  namespace, but `--radius-card` is a name UIE-01 invented, so the utility was confirmed in the
  built CSS: `.rounded-t-card{border-top-left-radius:var(--radius-card);border-top-right-radius:var(--radius-card)}`.
- **`xl` is 1280px.** The built stylesheet wraps every `xl:` utility in `@media (width>=80rem)`,
  which is AC-1's and AC-2's breakpoint exactly rather than approximately.

**The layout was measured in a browser.** Eleven of the sixteen criteria are geometric and the suite
asserts none of them — `cal-05` and `cal-08` address this screen through ids, attributes and DOM
order only, which is precisely why § 0 could take all three spec files out of scope. So the numbers
in § Acceptance criteria come from driving the built application at 1440×900, 1279×800 and 360×800
against the mock seam and reading `getBoundingClientRect`, `getComputedStyle`,
`scrollHeight/clientHeight` and `document.documentElement.scrollWidth`. **The script is not in the
repository**: it lives in this session's scratchpad, `tests/` is outside `allowed_paths`, and a
measurement harness that ships without being wired into a runner is a file nobody runs again. It is
described here in enough detail to be repeated.

## Testability contract

Every selector in § 4.3, and the one that is new.

| selector | Exists at |
|----------|-----------|
| `week-day` | `src/routes/WeekView.tsx:344` — with `data-date` `:345`, `data-day-status` `:348`, `data-bridge` `:349` |
| `week-day-label` | `src/routes/WeekView.tsx:360` |
| `week-day-holiday` | `src/routes/WeekView.tsx:376` — with `data-kind` `:377` |
| `week-day-bridge` | `src/routes/WeekView.tsx:385` |
| `week-day-empty` | `src/routes/WeekView.tsx:394` |
| `week-row` | `src/routes/WeekView.tsx:419` — with `data-member-id` `:420`, `data-entry-id` `:421` |
| `week-row-avatar` | `src/routes/WeekView.tsx:436` |
| `week-row-name` | `src/routes/WeekView.tsx:439` |
| `week-row-type` | `src/routes/WeekView.tsx:443` |
| `week-row-portion` | `src/routes/WeekView.tsx:452` |
| `week-row-tentative` | `src/routes/WeekView.tsx:462` |
| `week-row-note` | `src/routes/WeekView.tsx:473` |
| `week-row-approver` | `src/routes/WeekView.tsx:483` |
| `week-empty-card` | `src/routes/WeekView.tsx:520` — **new, and the only new one.** Additive: the seven `week-day-empty` elements are all still rendered beside it |
| `week-loading` / `week-not-on-a-team` / `week-sign-in` / `week-unavailable` | `:258`, `:270`, `:274`, `:284` — the four refusal states, untouched |

## Open questions

1. **A full chip is 194px tall at 161px, not the 90–110px `ticket.yaml` § 3 estimated.** Measured on
   the fullest chip — avatar, name, type, portion, note and approver. It does not reverse anything:
   § 3 says the overflow arithmetic can only get worse and that no conclusion turns on it, and
   § 4.2's answer to overflow is that the pane scrolls. But the worst realistic case it names is now
   **sixteen chips at ~3100px**, not ~1520px, so anyone re-opening the density question should
   re-open it against this number.
2. **`01-plan.md` Open question 3 is answered.** The wrapped column header at 161px is **64px on an
   ordinary day, 66px with a bridge badge and 112px on a non-working holiday** whose name wraps.
   Measured on the bridged holiday week of 2026-10-12. It is the header, not the body, so it costs
   every column the height of the tallest header — and it never causes a horizontal scroll.
3. **The shell does not answer for a phone, and this ticket could not fix it.** At a 360px viewport
   the sidebar is still its fixed 216px (`Sidebar.tsx:136`) and the content pane's `px-6` takes 48
   more, so a stacked day block is **96px wide**. AC-15 holds — nothing scrolls sideways, the pane
   shrinks rather than the page — but the screen is not usable there. The sidebar is UIE-02's and
   § 1 *Out of scope* item 4 forbids opening it, so this is reported rather than repaired. **The
   1280px breakpoint this ticket originates is the product's first, and the narrow end of the range
   below it has no owner.**
4. **Three colours now disagree with the sidebar legend they are supposed to explain.** The legend's
   swatches are `--color-pto`, `--color-wfh` and `--color-holiday`; the chips are `bg-orange-100`
   and `bg-emerald-100` and the holiday heading is `bg-violet-100`. Reconciling them repaints
   CAL-08's shading and CAL-05's chips, which § 1 *Out of scope* item 3 rules out here — see
   § Deviations. It is a real inconsistency in the shipped product and it belongs to whoever owns
   `.ai/standards/ui-design-system.md` § *Colour*, still a bare `TODO(project)`.
5. **The board never advanced this ticket past `BACKLOG`.** `01-plan.md` carries `gate: PASS` and
   `next_state: READY`, but `ticket.yaml` still read `state: BACKLOG` with `gates.plan.passed:
   false` when this stage started — `/plan` correctly sets neither (`.claude/commands/plan.md:114`
   leaves both to the orchestrator) and no orchestrator run happened in between. This command set
   `state: REVIEW` as it is told to. **It did not write `gates.plan`, which is not the developer's
   to record** — and `/ship`'s Definition of Done needs both gates `passed: true`, so that row has
   to be filled by whoever owns it before this ticket can ship.
