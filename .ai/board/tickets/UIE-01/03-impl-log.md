---
ticket: UIE-01
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-07T10:02:00+07:00   # Rework cycle 1. The 09:45:30 run is the section below it.
inputs_read:
  - .ai/board/tickets/UIE-01/01-plan.md
  - .ai/board/tickets/UIE-01/04-review.md
  - .ai/board/tickets/UIE-01/ticket.yaml
  - .ai/board/tickets/UIE-01/design/README.md
  - .ai/standards/testing-standards.md
  - .ai/standards/tech-stack.md
  - .ai/standards/ui-design-system.md
  - .ai/01-operating-model.md
  - _figma/src/index.css
  - eslint.config.js
  - ui-language.json
  - tests/e2e/tea-01-signup.spec.ts
  - tests/e2e/tea-05-sign-in.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# UIE-01 — implementation log

## Rework cycle 1 — `04-review.md` finding 1, R5

**What was wrong.** § 4.3's vertical rhythm is six values and four were built. The two that were not
are the 24px above and the 24px below the error row: the error paragraph and the button are ordinary
children of the form, so their only separation was `FIELD_STACK`'s `gap-4` — 16px at both points. The
reviewer is right that this was undeclared, and right that the contract row below restated the rhythm
with those two values removed, which is the part that made it invisible. That row is corrected in
place; the old wording is quoted in the correction so the removal stays legible.

**What was changed.** Two class strings in `src/components/AuthCard.tsx`, and nothing in either route.

| change | at | effect |
|--------|----|--------|
| `FORM_ERROR` gains `mt-2` | `src/components/AuthCard.tsx:139` | 16px gap + 8px margin = **24px** above the error row |
| `primaryButtonClass()`'s `base` gains `mt-2` | `src/components/AuthCard.tsx:164` | the same 24px above the button |

**Why 16 + 8 and not a literal 24.** The form is a flex column and its `gap-4` falls between *every*
child, the error row and the button included. There is no arrangement of margins that makes a single
utility read `24px` while that gap is in force — `mt-6` would render 40px. The only literal spelling
available is to take the gap off the form and wrap the four field groups in a second element carrying
it, which is a DOM change in both routes for a pixel-identical result. The arithmetic is written out
at `src/components/AuthCard.tsx:119-121,128-134,151-152` so the next reader does not have to derive
it, and `FIELD_STACK`'s comment now names the two constants that depend on its value.

**Why the classes live on the shared constants rather than in the two routes.** The same reason the
constants exist at all — deviation 4 below. Both routes already consume `FORM_ERROR` and
`primaryButtonClass()`, so this cycle edits neither file and the two screens cannot drift on a
spacing value.

**One reading of § 4.3 was required, and it is declared rather than assumed.** The rhythm reads
"→ 24px → error when present → 24px → button". With no error rendered, `mt-2` on the button still
applies, so the two values collapse to the one 24px gap they bracket: fields → 24px → button. The
alternative — 16px with no error and 24px with one — moves the button down by 8px at the moment a
refusal appears, states a conditional § 4.3 does not, and would mean passing error presence into
`primaryButtonClass()`, which is layout state the button has no other reason to know. Measured both
ways below.

**Measured in a real browser against the production build, because a spacing claim that is not
measured is a claim about a class name.** `vite build`, `vite preview`, Chromium at 1000×900, gaps
computed from bounding boxes as `next.y - (prev.y + prev.height)`:

| gap | § 4.3 says | measured |
|-----|-----------|----------|
| subtitle → segmented control | 20px | 20 |
| control → first field | 20px | 20 |
| label → input | 6px | 6 |
| field group → field group | 16px | 16 |
| last field → error row (`/signin`, error rendered) | 24px | **24** |
| error row → button (`/signin`, error rendered) | 24px | **24** |
| last field → button, no error (`/signin`) | 24px | **24** |
| last field → button, no error (`/signup`) | 24px | **24** |

`document.documentElement.scrollWidth === clientWidth` still holds on `/signup`, so the added margin
did not reintroduce the AC-16 overflow that the `min-w-0` note at the end of *Deviations* records.

**Nothing else in the review was actioned, because nothing else in it was a finding.** R1-R4 and
R6-R9 pass, and the reviewer's note on the R-check numbering across the repository is marked *not
part of this gate* and is human plane.

## Files touched

`01-plan.md` § 4 is the contract, and its numbered subsections are what the last column cites.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/index.css` | modified | Was one line. Now carries the six `@font-face` blocks and the `@theme` token block — the product's first palette, first type scale and first loaded font | § 4.1 |
| `public/fonts/baloo2-700-latin.woff2` | created | The display face, Latin range. Self-hosted so no runtime third party exists to send through R9 | § 4.1 |
| `public/fonts/baloo2-700-vietnamese.woff2` | created | The display face, Vietnamese range. AC-17 | § 4.1 |
| `public/fonts/nunito-400-latin.woff2` | created | Body face, regular, Latin range | § 4.1 |
| `public/fonts/nunito-400-vietnamese.woff2` | created | Body face, regular, Vietnamese range. AC-17 | § 4.1 |
| `public/fonts/nunito-700-latin.woff2` | created | Body face, bold — labels, tab labels, button labels | § 4.1 |
| `public/fonts/nunito-700-vietnamese.woff2` | created | Body face, bold, Vietnamese range | § 4.1 |
| `src/components/AuthCard.tsx` | created | The ground wrapper, the card, the lockup and the segmented control, plus the field/button vocabulary both routes share so they cannot drift | § 4.2, § 4.3 |
| `src/routes/SignIn.tsx` | modified | Restyled into the card. Also § 4.5: the nine-line comment forbidding a link to `/signup` was rewritten, not deleted | § 4.3, § 4.5 |
| `src/routes/SignUp.tsx` | modified | Restyled into the card, fields reordered per AC-8, avatar picker rebuilt as a scrolling strip, confirmation made the third state of the same card | § 4.3 |
| `src/App.tsx` | modified | Line 36 only — `bg-slate-50` → `bg-bg`, so the ground colour and the font stack resolve | § 4.4 |
| `.ai/board/tickets/UIE-01/03-impl-log.md` | created | This file | n/a |
| `.ai/board/tickets/UIE-01/ticket.yaml` | modified | `state: BACKLOG` → `REVIEW` on the PASS below. Rework cycle 1 also set `rework_count: 1` — see *Open questions* 5 | n/a |

`git status` also shows `.ai/board/tickets/UIE-01/01-plan.md` as untracked. **That is PLAN's artifact
and this session did not write it** — since ADR-006 a ticket stays uncommitted until `/ship`, so it
arrives in the working tree rather than in history.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 tokens | `src/index.css:100-132` | Every value from the plan, one name changed — see *Deviations* |
| 4.1 `@font-face` | `src/index.css:26-85` | Six blocks: two faces × (Latin, Vietnamese), Nunito twice for its two weights |
| 4.2 `AuthCard` | `src/components/AuthCard.tsx:15,51` | `AuthTab`, and `AuthCard({ tab, showTabs = true, children }): JSX.Element` exactly as specified |
| 4.2 the two `<Link>`s | `src/components/AuthCard.tsx:73,81` | `react-router-dom`, to `/signin` and `/signup` — not buttons, not a merged route |
| 4.2 new selectors | `src/components/AuthCard.tsx:61,73,81` | `auth-card`, `auth-tab-signin`, `auth-tab-signup`, the three the plan permits |
| 4.3 ground | `src/App.tsx:36` | `--color-bg`, flat, full viewport |
| 4.3 card | `src/components/AuthCard.tsx:61` | `--color-card`, `rounded-card`, `shadow-soft`, no border, 355px cap, 32px padding |
| 4.3 title / subtitle | `src/components/AuthCard.tsx:63-67` | Display face 700 at 28px; body face at 13px in `--color-ink-2` |
| 4.3 segmented control | `src/components/AuthCard.tsx:44-48,70-89` | 44px pill on `--color-track`; the selected half a white pill with `shadow-soft` and 700 ink |
| 4.3 field label | `src/components/AuthCard.tsx:106` | 10px, 700, uppercase, letter-spaced, `--color-ink-3`, 6px above its input |
| 4.3 input | `src/components/AuthCard.tsx:109-114` | 44px, `rounded-pill`, borderless, `--color-field` |
| 4.3 avatar swatch | `src/routes/SignUp.tsx:139-145` | 44px round on `--color-field`; selected adds a 2px `--color-ink` ring **and** `aria-checked` |
| 4.3 primary button, three states | `src/components/AuthCard.tsx:162-170` | Resting `--color-primary`; disabled `--color-ink-3` + `not-allowed`; submitting `--color-primary` + `progress` + the label swap. No opacity anywhere |
| 4.3 error | `src/components/AuthCard.tsx:139`, used at `SignIn.tsx:109`, `SignUp.tsx:185` | `--color-danger` at 13px, between the last field and the button, `role="alert"` kept, and now at the 24px the rhythm asks for — rework cycle 1 |
| 4.3 focus | `AuthCard.tsx:47,114,165`, `SignUp.tsx:149` | `outline: 2px solid var(--color-ink)` at `outline-offset: 2px` on `:focus-visible`, on all five kinds of control |
| 4.3 vertical rhythm | `AuthCard.tsx:67,71,91,123,139,164` | **All six values, measured.** title → 20px → control → 20px → fields (6px label-to-input, 16px between groups) → 24px → error when present → 24px → button. *Corrected in rework cycle 1.* This row previously ended "…16px between groups) → button", dropping the two 24px values rather than declaring them — which is why the gap did not show up as a deviation |
| 4.4 the one line | `src/App.tsx:36` | `data-testid="app-root"` and the banner block are untouched |
| 4.5 the comment | `src/routes/SignIn.tsx:127-142` | Rewritten to record the reversal and why it is not ADR-level. Deleting it silently was the failure mode named in the plan |
| 5 seam impact | — | `git diff --name-only` touches nothing under `src/lib/`. Both calls unchanged: `signIn({ email, password })` at `SignIn.tsx:48`, `seam.signUp({ email, password, displayName, avatar })` at `SignUp.tsx:57` |
| 6 schema delta | — | Nothing under `supabase/` opened |

## Deviations from the design

Four, all declared, none of them a change to a value or to a behaviour the plan specifies.

**1. `--radius-lg: 26px` was renamed `--radius-card: 26px`.** `src/index.css:117-124` carries the
argument. **This is not a preference — the plan's name is a token collision.** `--radius-lg` is one
of Tailwind v4's own theme keys, so redefining it repaints every `rounded-lg` in the application:
ten of them, in `BulkRejection.tsx`, `EntryDecision.tsx`, `PendingEntries.tsx` (×2), `Holidays.tsx`
(×4), `NewEntry.tsx` and `TeamEntries.tsx`. All six of those files sit in § 1's *Out of scope*
— "the one class on `src/App.tsx` changes their background and nothing else; it is not a licence to
restyle them" — so **the plan's own scope statement is what rules the plan's own token name out.**
Verified in the built stylesheet: `--radius-lg` is still Tailwind's `.5rem` and `.rounded-lg` still
resolves through it.

**2. Six font files, not the three § 4.1 lists — and the plan's own body text asks for this.**
§ 4.1 names three Vietnamese-subset files, then says two paragraphs later that "the Latin ranges each
family also needs must be declared beside it, or accented text renders in the product face while
unaccented text falls back". Three files cannot satisfy both sentences. Six is the smaller reading:
Latin + Vietnamese for Baloo 2 700, Nunito 400 and Nunito 700. **`latin-ext` was deliberately not
taken** — nine files would be 5 source + 9 binaries = 14, and `.ai/01-operating-model.md:374` sizes
more than 12 as L, which must split. Six lands at 11 and holds `size: M`. Nothing this product renders
needs `latin-ext`: `latin` carries U+0000-00FF and `vietnamese` carries the rest.
**`public/fonts/**` is a glob precisely so this could be decided here** (§ 7).

**3. `bg-bg`, not `bg-[--color-bg]`, on `src/App.tsx:36`.** A generated utility rather than an
arbitrary value, for one measurable reason: Tailwind v4 emits a theme variable only when it can see
the token used, and it sees a utility. Confirmed in the built CSS — `.bg-bg{background-color:var(--color-bg)}`
is emitted and `--color-bg` is present in `:root`. Same value, same element, same one line.

**4. `AuthCard.tsx` exports five presentational constants beside the component** — `FIELD_LABEL`,
`FIELD_INPUT`, `FIELD_STACK`, `FORM_ERROR` and `primaryButtonClass()`. § 4.2 specifies only the
component's props, and § 4.3 specifies **one** input shape, **one** label shape and **one** button for
**two** screens. Two routes each holding their own copy of those strings is two things to keep equal,
and the first restyle that touches one and not the other is the bug. Additive: no specified export
changed.

**And one defect found by looking at the built page rather than by reasoning about it, fixed here.**
`<fieldset>` carries `min-inline-size: min-content` in the UA stylesheet, so the avatar strip refused
to shrink: it pushed the card wider than the viewport and **the whole page scrolled sideways**, which
is precisely what AC-16 forbids. `min-w-0` at `src/routes/SignUp.tsx:129` is the fix, and the comment
above it says why so nobody removes it as noise. Measured after: `documentElement.scrollWidth ===
clientWidth` at both 1000px and 360px, while the strip itself scrolls internally (616px of content in
a 291px box).

## Invariants

`invariants_touched: []`, and the plan reaches that structurally rather than from safe behaviour.

| ID | Still holds because |
|----|---------------------|
| — | `.ai/registry/invariants.md:33-39` holds seven rows and every one constrains an `entry` row or the member it belongs to. **No invariant governs the appearance of a screen.** The non-circular form of the claim is that every file above sits above the seam: `git diff --name-only` touches nothing under `src/lib/`, no SQL, no policy, no migration, no arithmetic. `AuthCard.tsx` imports only `react` and `react-router-dom`; neither route's imports changed. RULE-02's lint rule would refuse a Supabase import from any of them, and `pnpm exec eslint .` exits 0. |

## Verification run

**Re-run in full after rework cycle 1.** The numbers below are that run, not the 09:45 one; both are
identical, which is the point of recording them again rather than asserting nothing changed.

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | the typecheck named in `.ai/standards/testing-standards.md:16` |
| `pnpm exec eslint .` | 0 | `:17`. Carries RULE-02 **and** § Language — see *Open questions* 1 |
| `pnpm exec vitest run` | 0 | `:18` — 186 tests, 10 files |
| `pnpm exec playwright test` | 0 | `:19` — **165 tests, and not one test file was edited.** That is AC-18 |
| `pnpm exec vite build` | 0 | Not a gate command. Run because the tokens and the rhythm are only observable in the output — see below and see *Rework cycle 1* |
| `git diff --name-only` subset of `allowed_paths` | yes | Seven source paths, all listed in `ticket.yaml`; `public/fonts/**` resolves to the six binaries. **Rework cycle 1 touched one of them** — `src/components/AuthCard.tsx` — plus this file and `ticket.yaml` |

**The gate is typecheck and lint. The rest was run because a restyle's gate is weak evidence.**
Nothing in `tsc` or `eslint` can see a token that Tailwind dropped, a `@font-face` that resolves to
404, or a card that overflows its viewport — and the third of those was real. What was measured in a
real browser against the production build:

- **All six `@font-face` blocks reach the output and all six files ship.** `dist/fonts/` holds the
  six `.woff2`, and `document.fonts` reports `Baloo 2 700` loaded twice (both subsets — the title
  spans both) with `Nunito 400` and `Nunito 700` beside it. **AC-17**: the fixture name `Thành viên`
  on the landing screen computes to the Nunito stack with the Vietnamese-range face loaded.
- **Every token generates its utility**: `bg-bg`, `bg-card`, `bg-field`, `bg-track`, `bg-primary`,
  `text-ink`, `text-ink-2`, `text-ink-3`, `text-danger`, `rounded-card`, `rounded-pill`,
  `shadow-soft`, `font-display`, `outline-ink`, `ring-ink`, `ring-offset-card` — all present in the
  built stylesheet, none dropped.
- **AC-5**: `/signin` → sign-up half → `/signup` → sign-in half → `/signin`. Both directions.
- **AC-15**: tabbing through the card gives `outline: solid 2px rgb(36, 31, 69)` at `offset: 2px` on
  both halves of the control, both inputs, every swatch and the button. The button is skipped in the
  tab order only while it is `disabled`, which is correct.
- **AC-12**: the three fills are distinct and measured — resting `rgb(42, 33, 69)`, disabled
  `rgb(143, 137, 179)`, and the in-flight state keeps the resting fill with the label swap.
- **AC-16**: at 360px the card fits with a gutter on both sides and the document does not scroll
  horizontally.

## Testability contract

**§ 6 is `Schema delta` in this plan, not the selector table the template names.** ADR-019 merged
SPEC and DESIGN and ADR-022 removed the QA stage the old § 6 fed, so the frozen-selector list lives
in **AC-10** instead. All thirteen, re-read from the tree after the change:

| selector | Exists at |
|----------|-----------|
| `sign-in-email` | `src/routes/SignIn.tsx:83` |
| `sign-in-password` | `src/routes/SignIn.tsx:96` |
| `sign-in-error` | `src/routes/SignIn.tsx:109` |
| `sign-in-submit` | `src/routes/SignIn.tsx:115` |
| `signup-confirm-notice` | `src/routes/SignUp.tsx:77` |
| `signup-form` | `src/routes/SignUp.tsx:94` |
| `signup-display-name` | `src/routes/SignUp.tsx:101` |
| `signup-avatar-picker` | `src/routes/SignUp.tsx:131` |
| `signup-avatar-option` | `src/routes/SignUp.tsx:140` |
| `signup-email` | `src/routes/SignUp.tsx:162` |
| `signup-password` | `src/routes/SignUp.tsx:174` |
| `signup-error` | `src/routes/SignUp.tsx:185` |
| `signup-submit` | `src/routes/SignUp.tsx:191` |

Three added, which AC-10 permits: `auth-card`, `auth-tab-signin`, `auth-tab-signup`
(`src/components/AuthCard.tsx:61,73,81`). `app-root` and `seam-banner` are untouched at
`src/App.tsx:36,44`.

## Open questions

**1. The product now shows two different names, and only the operator can say which is right.**
§ 4.2 specifies the card's title as `Ai Nghỉ?`, taken from the transcription, and that is what is
built. But `index.html:6` says `<title>CaleChip</title>`, and `CLAUDE.md` opens with *CaleChip*. So
the browser tab says one name and the first screen says another. **Nothing in the plan reconciles
them and this session did not choose** — `index.html` is not in `allowed_paths`, and picking a
product name is not a developer's call. It is one string in one file whichever way it goes.

**2. The name required an ugly construction to pass the lint rule, and it is worth a look.**
`AuthCard.tsx:39` builds the title as `` `Ai Ngh${String.fromCodePoint(0x1ec9)}?` ``. § 4.2 says to
resolve the diacritic "by making the name a bare string the rule does not match, not by adding either
route to `copyDebt`", and **an escape sequence does not do it**: `eslint.config.js:83-92` selects on
`Literal[value=...]`, and a Literal's *value* is the decoded string, so `"Ai Nghỉ?"` matches
exactly as the bare characters do. Composing the character from its code point is what leaves no node
in the file inside the rule's range. It is deliberately unattractive so nobody copies it for ordinary
copy — but if the § Language rule is meant to have a proper-noun carve-out, this is the line that
shows why, and that carve-out is human plane.

**3. `01-plan.md`'s own Open question 1 is unanswered and this ticket has now made it real.**
§ *Colour* and § *Type* in `.ai/standards/ui-design-system.md` are still bare `TODO(project)` stubs,
and `src/index.css:100-132` now holds fourteen real values with no document behind them. As the plan
put it, this ticket is now the de-facto design system. A developer may write tokens into the
stylesheet and may not record them in the standard (RULE-01), so this cannot be closed from here.

**4. `state:` was `BACKLOG`, not `READY`, when this command ran.** `01-plan.md`'s front-matter says
`gate: PASS` and `next_state: READY`, but `ticket.yaml` still carried `state: BACKLOG` and
`gates.plan: { passed: false, at: null }` — PLAN filled `allowed_paths`, `size` and
`size_estimate` and stopped there. The PLAN→READY transition and the `plan` gate flag belong to
`orchestrator` (`.ai/01-operating-model.md:82`, and the dispatch loop at `:285`), which was not run
between the two commands. **This session set `state: REVIEW` as `/implement` instructs and did not
touch `gates.plan`** — flipping another stage's gate from here would record a DoR evaluation that
never happened. `/ship` requires both gates `passed: true` (`:349`), so **`gates.plan` still has to
be set by whoever evaluates DoR**, or the ticket will stop at `/ship` instead of here.

**5. `rework_count` was written from here, and `state` was not, and the split needs a human eye.**
`04-review.md` returned `gate: FAIL` with `next_state: REWORK`, and its finding says in words that
the failure routes to `developer` and increments `rework_count`. But `ticket.yaml` still read
`state: REVIEW` and `rework_count: 0` when this cycle started: the REVIEW→REWORK transition belongs
to `orchestrator` (`.ai/01-operating-model.md:290`), which was not run between `/review` and
`/implement` — the same gap item 4 records one stage earlier. **This session set `rework_count: 1`
and left `state: REVIEW`**, which is where a PASS here puts it anyway. The reasoning for treating the
two differently: the count is a fact about a cycle this session was part of and the reviewer already
decided in writing, whereas flipping a gate or inventing a state history would record a judgement
nobody made. It matters because RULE-06 escalates at `rework_count >= 2` — a count nobody increments
is a budget that never runs out. **If `orchestrator` is meant to be the only writer of that field,
this is the line to correct**, and the correct fix is to run the dispatch loop between stages rather
than to reset the number.
