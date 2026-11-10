---
ticket: UIE-01
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-07T09:05:00+07:00
inputs_read:
  - .ai/board/tickets/UIE-01/ticket.yaml
  - .ai/board/tickets/UIE-01/design/README.md
  - .ai/board/ideas/2026-09-05-the-first-screen-does-not-look-like-the-product.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/coding-standards.md
  - .ai/standards/integrations.md
  - .ai/01-operating-model.md
  - src/App.tsx
  - src/index.css
  - src/routes/SignIn.tsx
  - src/routes/SignUp.tsx
  - src/lib/domain/types.ts
  - index.html
  - eslint.config.js
  - ui-language.json
  - _figma/src/index.css
  - tests/e2e/tea-01-signup.spec.ts
  - tests/e2e/tea-05-sign-in.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# UIE-01 — Restyle the sign-in and sign-up screens to the product's visual direction

## 0. What was re-measured at PLAN rather than inherited

`ticket.yaml` § 6 states that `depends_on: []` is "a measurement taken on 2026-09-05, not a standing
guarantee", and instructs a re-check here. **Re-checked: it still holds.** Every ticket in
`.ai/board/tickets/` is `DONE` except `UIE-01`, `UIE-02`, `UIE-03` and `UIE-04`, and all four carry
`allowed_paths: []`. No live ticket claims a path, so no collision exists against § 7 below. OPS-002
— named in § 6 as `BACKLOG` with a five-file scope — shipped in PR #62 on 2026-09-07; its paths are
released and none of them appears here.

**The thirteen frozen selectors were verified present in the tree, not trusted from the shell.** All
thirteen resolve under `src/`. **No test asserts a class name or a colour** — `toHaveClass`,
`className` and `bg-slate-50` return nothing across `tests/`. **No test on either auth screen asserts
a text string**; both specs address every element by `data-testid`. That last fact is what frees the
segmented control's labels in § 4.

## 1. Problem and scope

The feature ID this plan implements, transcribed from `.ai/registry/features.md` without paraphrase:

| ID | Capability | Group | Status | Invariants touched |
|---|---|---|---|---|
| UIE-01 | Restyle the sign-in and sign-up screens to the product's visual direction | UIE | PLANNED | [] |

**No role gains a capability, and that is the defining property of this ticket rather than a caveat.**
UIE-01 is the first row in the fourth feature group, declared by ADR-028 on the operator's
instruction for exactly this kind of work: the deliverable is the appearance of a surface that
already exists. A person signing in or signing up does everything afterwards that they did before,
in the same order, through the same seam calls, addressed by the same selectors. What changes is that
the two screens a person sees **before** they are anybody — the only two shipped screens that no part
of `CLAUDE.md` § *Visual direction* has ever reached — stop looking like an unstyled form on a slate
ground and start looking like this product. `src/index.css` is one line today; this ticket introduces
the first palette and the first type scale the real application has had, and the first font it has
ever loaded.

**Out of scope.** The first four each reverse a decision already taken, and each is scoped out
without costing the layout anything — which is the finding that makes this a restyle rather than an
ADR. They are reproduced here as negative requirements because `ticket.yaml` § 4 is right that they
are the kind nobody checks.

- **Do not translate any copy on these two screens into Vietnamese.** It reverses
  `.ai/standards/ui-design-system.md` § *Language* and is lint-enforced at `eslint.config.js:83-92`.
  Neither route is in `copyDebt`, and `ui-language.json` is now empty — OPS-002 emptied it on
  2026-09-07 and the file says at `:10-13` that adding to it is the failure mode. `Sign in`,
  `Sign up`, `EMAIL`, `PASSWORD` and `DISPLAY NAME` fit the same pills at the same widths as the
  Vietnamese in the transcription.
- **Do not introduce a username. Identity stays the email address.** It reverses ADR-009 and ADR-005
  beneath it: the email is the join key at
  `supabase/migrations/20260831150024_tea01_membership.sql:100-105`, and `username` appears zero
  times under `src/`, `supabase/` and `.ai/standards/data-model.md`. It would be a new column, a
  uniqueness constraint, a changed trigger and `requires_adr: true` — and it costs the layout
  nothing, because the field is one pill either way.
- **Do not print credentials on the sign-in screen.** TEA-05 AC-2 is that a wrong address and a wrong
  password are refused identically; `SignIn.tsx:39-48` goes to some length not to distinguish them
  and `tests/e2e/tea-05-sign-in.spec.ts` asserts it. The transcription's footer names eight accounts
  that are not this repository's fixtures. A demo affordance, if genuinely wanted, belongs behind
  `seamName === "mock"` beside the existing banner and is a separate ticket.
- **Do not remove the avatar picker.** It breaks TEA-01 AC-8, the `complete` gate at `SignUp.tsx:31`
  and four assertions in `tests/e2e/tea-01-signup.spec.ts`. Where it goes is originated in AC-9.
- **Dark mode**, stated rather than left silent. The reference shows one theme and this ticket ships
  one theme. Silence here would read as an omission.
- **`src/routes/NotOnATeam.tsx`.** It is reached immediately after a successful sign-in for an
  allow-list miss (`App.tsx:93`) and is visually adjacent, so it is the file most likely to be swept
  in. Leaving it unstyled is a choice, and this is where the choice is recorded.
- **The Vui/Gọn density toggle.** `CLAUDE.md` § *Visual direction* puts density on the calendar grid;
  these screens carry no grid. Restated here so nobody re-derives it at REVIEW.
- **Amending `.ai/standards/ui-design-system.md`.** Filling § *Colour*, § *Type*, § *Direction* or
  § *Components* with this ticket's tokens is human plane under RULE-01. See *Open questions* item 1,
  which is the one thing on this ticket the operator has to decide.
- **Every other screen.** Home, MemberList, AllowList, Threshold, Holidays, the entry forms and the
  three calendar views. The one class on `src/App.tsx:35` changes their background and nothing else;
  it is not a licence to restyle them.
- **The seam banner's own styling.** `App.tsx:41-50` keeps its amber, its text, its permanence and
  its `data-testid`. Its interaction with the centred card is originated in AC-13.
- **The fixtures and the seed data.** They are § *Language*'s stated exception and keep their
  Vietnamese diacritics. Nothing here makes the transcription's eight names real.

`size_estimate: S`. Two screens, one new presentational component, one stylesheet, one class on
`App.tsx`, and a font directory. No schema, no seam function, no permission, no test file.

## 2. Acceptance criteria

**AC-1** — the ground
- **Given** any route of the application
- **When** it renders
- **Then** the viewport background is the product's lavender ground rather than the slate default,
  and the body type resolves to the product's own sans family rather than the framework's default
  stack

**AC-2** — the card
- **Given** a signed-out person at `/signin` or anybody at `/signup`
- **When** the screen renders at rest
- **Then** the content sits in a single white card, horizontally centred, with a rounded corner, one
  soft shadow and no border, on the ground from AC-1

**AC-3** — the lockup
- **Given** the card on either route
- **When** it renders
- **Then** the first thing in it is the product title and a subtitle beneath it, in that order,
  the title in the display face and the subtitle in the muted body colour, both centred, and both
  identical on the two routes

**AC-4** — the segmented control exists and names both destinations
- **Given** the card at `/signin` or at `/signup`
- **When** it renders at rest
- **Then** a two-part control sits directly beneath the subtitle, offering exactly two destinations
  labelled for sign-in and sign-up; the half matching the current route is visibly the selected one
  and the other is not, and the distinction is carried by more than colour alone

**AC-5** — the segmented control navigates, in both directions
- **Given** a signed-out person on `/signin`
- **When** they activate the sign-up half
- **Then** they arrive at `/signup` with the same card, the same title and the other half now
  selected — and from `/signup`, activating the sign-in half returns them to `/signin`

**AC-6** — the fields keep their identity and their order
- **Given** `/signin`
- **When** the card renders
- **Then** it presents exactly two fields, email then password, each with a short uppercase label
  above a filled borderless rounded input, and the two inputs are still addressable as
  `sign-in-email` and `sign-in-password`

**AC-7** — the primary control
- **Given** either route at rest
- **When** the card renders
- **Then** the last control in it is a single full-width filled rounded button, and it is still
  addressable as `sign-in-submit` or `signup-submit` respectively

**AC-8** — the sign-up fields, in the originated order
- **Given** `/signup`
- **When** the card renders
- **Then** it presents display name, then the avatar choice, then email, then password, in that
  order, each field styled as in AC-6, and all four are still addressable as `signup-display-name`,
  `signup-avatar-picker`, `signup-email` and `signup-password`

**AC-9** — the avatar picker survives the restyle as a picker
- **Given** `/signup`
- **When** the avatar choice renders
- **Then** it is a single horizontal row of round swatches that scrolls horizontally when the choices
  exceed the card width; every choice is individually addressable as `signup-avatar-option` carrying
  its `data-avatar`; the group still exposes itself as a radio group and each swatch as a radio with
  its checked state; the first swatch is reachable and clickable without scrolling; and the selected
  swatch is distinguished by more than colour alone

**AC-10** — no selector is renamed or removed
- **Given** the thirteen `data-testid` names present on these two routes before this change —
  `sign-in-email`, `sign-in-password`, `sign-in-submit`, `sign-in-error`, `signup-form`,
  `signup-email`, `signup-password`, `signup-display-name`, `signup-avatar-picker`,
  `signup-avatar-option`, `signup-error`, `signup-submit`, `signup-confirm-notice`
- **When** the same routes are read after it
- **Then** all thirteen are still present with the same names on elements playing the same roles.
  New controls may add new selectors; no existing one is renamed or removed

**AC-11** — the error state has a designed home
- **Given** a submitted form that the seam refuses
- **When** the failure returns
- **Then** the message renders inside the card, between the last field and the primary button, still
  addressable as `sign-in-error` or `signup-error`, still announced as an alert, in a colour that
  meets WCAG AA for normal text against the card

**AC-12** — the submitting and disabled states are distinguishable from the resting one
- **Given** the primary button
- **When** it is disabled because the form is incomplete, and separately while a submission is in
  flight
- **Then** each state is visibly different from the enabled resting state and from the other, the
  difference is not a reduced opacity of the same fill, and the in-flight state still swaps the
  button's label as it does today

**AC-13** — the seam banner is unchanged and does not overlap the card
- **Given** a build resolving to the mock seam, where `App.tsx` renders the permanent banner
- **When** either auth route renders
- **Then** the banner appears above the card with its existing text, colour and `seam-banner`
  selector untouched, and the card renders whole beneath it with no element overlapping another

**AC-14** — the post-sign-up confirmation is a third state of the same card
- **Given** a sign-up that the seam accepts
- **When** the terminal confirmation renders
- **Then** it is the same card on the same ground with the same title and subtitle, carrying the
  confirmation heading and message and still addressable as `signup-confirm-notice`, and the
  segmented control and every field are absent from it

**AC-15** — every interactive element has a visible keyboard focus indicator
- **Given** the inputs, both halves of the segmented control, every avatar swatch and the primary
  button
- **When** each is focused by keyboard
- **Then** a focus indicator is visible against the filled ground it sits on, distinct from the
  hover state, and it is not conveyed by a change of fill colour alone

**AC-16** — the card is usable on a narrow viewport
- **Given** a viewport 360px wide
- **When** either route renders
- **Then** the card fits within it with a gutter on both sides, no content is clipped, and nothing
  scrolls horizontally except the avatar strip of AC-9

**AC-17** — the type renders Vietnamese diacritics
- **Given** the product's own font, loaded by this ticket
- **When** a string carrying Vietnamese diacritics is rendered in it — the fixture display names are
  the product's only such copy
- **Then** the glyphs render in that font with their diacritics intact, rather than falling back to a
  system face for the accented characters

**AC-18** — nothing below the surface moves
- **Given** the two routes after this change
- **When** their behaviour is exercised
- **Then** each still makes exactly the seam call it made before with the same arguments, neither
  imports `@supabase/*` nor `./supabase` nor `./mock`, no route guard in `App.tsx` changes, and the
  whole existing unit and end-to-end suite passes with no edit to any test file

**Invariants touched: `[]`** — reached here, not inherited. `.ai/registry/invariants.md:33-39` holds
seven rows and **every one constrains an `entry` row or the member it belongs to**: overlap (INV-01),
the approval transition (INV-02), rejection reasons (INV-03), the absence count (INV-04), tentative
entries (INV-05), portions (INV-06) and ownership (INV-07). **No invariant governs the appearance of
a screen.** The circularity `invariants.md` warns about — concluding "none" from safe behaviour — is
avoided here by a structural fact rather than by an inspection of intent: every file in § 7 sits
**above the seam**. There is no query, no policy, no migration and no arithmetic in any of them, and
neither route imports the Supabase client, which RULE-02's lint rule would refuse anyway. AC-18 is
the observable form of that claim. ADR-028 records that `[]` will be the answer on almost every UIE
row and states it as a cost of the group rather than as permission to skip the question.

**Open questions.**

1. **Nobody has filled § *Colour* or § *Type* in `.ai/standards/ui-design-system.md`, and this
   ticket cannot.** Both are bare `TODO(project)` stubs, the file is human plane under RULE-01, and
   § 4 below writes real hex values and a real type scale into `src/index.css`. **If those stubs stay
   empty, this ticket becomes the de-facto design system with no document behind it** — the next
   screen has nothing to conform to and will either copy `index.css` or invent again. Stated as a
   consequence and not a blocker: the ticket is buildable either way. **This is the item for the
   operator.**
2. **The font files have to come from somewhere, and this plan does not settle where.** § 4 specifies
   self-hosted `.woff2` under `public/fonts/`, which is the only one of the three paths that needs no
   ADR — a CDN `@import` is a runtime third party and an integration (`integrations.md:42` sends it
   through R9), and `@fontsource/*` is an npm dependency that R9 fails without an ADR. Obtaining the
   files is a network act this loop does not describe. **If the Developer cannot obtain them, the
   correct move is to stop and ask, not to reach for a CDN** — that would silently turn
   `requires_adr: false` into a false statement. The `font-family` stacks in § 4 name a system
   fallback so that every other AC still holds while the files are missing; only AC-17 fails.
3. **`index.html` declares `lang="vi"` while the interface is now English and the user content is
   Vietnamese.** Neither value is right for both halves. It is untouched by this ticket and it is not
   in § 7 — changing a document's declared language affects every screen and every screen reader, and
   it is adjacent to § *Language*, which is human plane. Raised because this is the ticket that makes
   it visible, by being the first to load a font selected for one of the two languages.
4. **`CLAUDE.md` § *Visual direction* assigns lavender to holidays in the calendar grid, and this
   palette is lavender-and-indigo throughout.** On a screen with no grid there is nothing to collide
   with, which is why § 4 proceeds. Whether the ground colour should stay lavender once a calendar
   screen is restyled under UIE-03 is not settled here, and is not settled by silence either.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

**This line is the accurate one even though `design/README.md` exists, and the distinction is worth
being exact about.** Two images were shown in conversation on 2026-09-05 and **neither was ever on
disk**; `.ai/board/tickets/UIE-01/design/README.md` is a transcription written by hand by `product`
at the canonical path because there was no file to move. `.ai/standards/ui-design-system.md:105-125`
describes moving an attached image; nothing was attached in the sense that section means, so there is
no image to cite and the first of § 2b's two lines would be false. Both `ticket.yaml` § 9 and the
transcription itself instruct this line.

**What the transcription is worth, and what it is not.** It is evidence of intent and this plan
spends it as such: the ground, the single centred card, the lockup, the segmented control, the pill
inputs with uppercase labels and the full-width primary button all come from it, and each is an AC
above. It is not a specification — a later reader cannot check one statement in it against the
picture it came from, and § *Visual specification* already says that *"looks like the screenshot" is
not an acceptance criterion*. A transcription of an image nobody can reopen is weaker again.

**Three things the transcription asserts that this ticket refuses**, each in § 1's *Out of scope*
with its citation: the copy is English and not Vietnamese; the identity field is the email address
and not a username; and there is no credential footer. **Everything the transcription does not show
is originated below** and marked as originated: the error state (AC-11), the submitting and disabled
states (AC-12), the post-sign-up confirmation (AC-14), the avatar picker (AC-9), focus and hover
(AC-15), narrow viewports (AC-16), the seam banner (AC-13), and dark mode and the member-less landing
state, both refused in § 1.

## 3. Permission model

**Nothing in this section changes, and on this ticket that is a claim worth making precisely rather
than waving at.** `SignIn.tsx:3-5` already records that authentication is not authorization: these
screens establish who the caller is, and every policy in
`.ai/standards/rbac-and-security.md` decides what that identity may do. This ticket changes how those
two screens look.

| Action | Who may reach it | Where the check lives | Changed here |
|---|---|---|---|
| Reach `/signin` | anybody with no session | `App.tsx:72-81`, membership `signed-out`, else `Navigate` away | no |
| Reach `/signup` | anybody, in every membership state | `App.tsx:65-67` — deliberate under ADR-009 | no |
| Sign in | anybody with credentials | Supabase Auth, then row-level security on every later read | no |
| Sign up | anybody | the admission trigger; the allow-list decides membership, not sign-up | no |

**The segmented control adds no permission and reveals nothing.** It is the one place a reviewer
should press, because it puts a link to `/signup` on the sign-in screen where none existed. `/signup`
is already reachable by address in every membership state (`App.tsx:65-67`, ADR-009), so the control
adds a second route to a destination that was never guarded, and it discloses no fact about any
address — it is a static link, rendered identically for everyone, before anybody is anybody. The
guard on `/signin` is untouched, which is what `tests/e2e/tea-05-sign-in.spec.ts:39-56` asserts and
what AC-18 keeps true.

**The refusal wording is untouched.** TEA-05 AC-2's identical treatment of a wrong address and a
wrong password lives in the seam's message and in `SignIn.tsx:39-48`'s refusal to compose one of its
own. AC-11 moves where that message is rendered and changes neither the message nor the logic.

## 4. Contract

**No entry-point signature changes, and no seam function is added, removed or altered.** Both routes
keep the calls they make today: `signIn({ email, password })` at `SignIn.tsx:37` and
`seam.signUp({ email, password, displayName, avatar })` at `SignUp.tsx:48`. Nothing is added to
`src/lib/data/index.ts`.

### 4.1 The tokens — `src/index.css`

Tailwind v4 (`package.json:40`), so a `@theme` block is the mechanism. **The palette is taken from
the product's own prototype at `_figma/src/index.css:4-33` rather than invented**, which is why these
values match the calendar the rest of the product will grow into. The four marked **new** are
originated here because the prototype has no auth screen.

```css
@import "tailwindcss";

@theme {
  /* Ground and surface — _figma/src/index.css */
  --color-bg:            #F1EFFA;
  --color-card:          #FFFFFF;
  --color-line:          #E4E0F4;

  /* Ink — _figma/src/index.css */
  --color-ink:           #241F45;   /* titles, active labels, input text */
  --color-ink-2:         #5A5480;   /* subtitle, body */
  --color-ink-3:         #8F89B3;   /* field labels, inactive segment, disabled fill */

  /* NEW — the auth surface the prototype does not cover */
  --color-field:         #EDEBF7;   /* filled borderless input */
  --color-track:         #EDEBF9;   /* segmented-control track */
  --color-primary:       #2A2145;   /* primary button fill */
  --color-danger:        #BE123C;   /* error text — 5.9:1 on --color-card, WCAG AA */

  --radius-lg:           26px;
  --radius-pill:         9999px;
  --shadow-soft:         0 4px 20px -2px rgba(36, 31, 69, 0.05),
                         0 0 3px rgba(36, 31, 69, 0.02);

  --font-display: "Baloo 2", "Trebuchet MS", system-ui, sans-serif;
  --font-sans:    "Nunito", system-ui, -apple-system, "Segoe UI", sans-serif;
}
```

**Both families are named in `CLAUDE.md` § *Visual direction*** — "Nunito or Baloo 2, never
Quicksand" — and both ship a `vietnamese` subset. **The prototype's `--font-sans: 'Be Vietnam Pro'`
is deliberately not adopted**: it is neither rounded nor one of the two faces the charter names, and
this is the ticket that sets the product's first type scale. Each stack **names a system fallback**,
so *Open questions* item 2 costs only AC-17 if the files cannot be obtained.

**`@font-face`, self-hosted, `vietnamese` subset explicit.** No npm package (R9,
`coding-standards.md:91`) and no runtime third party (`integrations.md:38-44`), so `requires_adr`
stays `false`:

```css
@font-face {
  font-family: "Baloo 2";
  src: url("/fonts/baloo2-700-vietnamese.woff2") format("woff2");
  font-weight: 700;
  font-display: swap;
  unicode-range: U+0102-0103, U+0110-0111, U+0128-0129, U+0168-0169, U+01A0-01A1,
                 U+01AF-01B0, U+0300-0301, U+0303-0304, U+0308-0309, U+0323, U+0329,
                 U+1EA0-1EF9, U+20AB;
}
/* Nunito 400 and 700, same shape, same subset. */
```

Three files: `baloo2-700-vietnamese.woff2`, `nunito-400-vietnamese.woff2`,
`nunito-700-vietnamese.woff2`. **The `unicode-range` above is the Vietnamese subset only** — the
Latin ranges each family also needs must be declared beside it, or accented text renders in the
product face while unaccented text falls back, which is worse than either alone.

### 4.2 The new component — `src/components/AuthCard.tsx`

Presentational. It imports nothing below the hook layer, so `eslint.config.js:60-79` has nothing to
fire on and RULE-02 holds by construction.

```tsx
export type AuthTab = "signin" | "signup";

interface AuthCardProps {
  /** Which half of the segmented control is selected. */
  tab: AuthTab;
  /** Omit the control entirely — the terminal confirmation state, AC-14. */
  showTabs?: boolean;
  children: React.ReactNode;
}

export default function AuthCard({ tab, showTabs = true, children }: AuthCardProps): JSX.Element;
```

It renders, in order: the centring wrapper, the card, the title `Ai Nghỉ?` with 🐰 on the same
baseline, the subtitle `Plan your team's time away`, the segmented control when `showTabs`, then
`children`. **The two halves are `react-router-dom` `<Link>`s** (`package.json:26`) to `/signin` and
`/signup` — not buttons, not a merged route. New selectors it may add: `auth-card`, `auth-tab-signin`,
`auth-tab-signup`.

**The title and subtitle are English and must stay so** — `Ai Nghỉ?` is the product's *name* and is
not interface copy, the same distinction § *Language* draws for display names. It carries a diacritic
and will be reported by `eslint.config.js:83-92`. **Resolve that by making the name a bare string the
rule does not match, not by adding either route to `copyDebt`** — `ui-language.json` is empty as of
OPS-002 and adding to it is what that file names as the failure mode.

### 4.3 The shapes

| Element | Shape |
|---|---|
| Ground | `--color-bg`, full viewport, flat — no pattern, no gradient |
| Card | `--color-card`, `--radius-lg`, `--shadow-soft`, no border, `max-width: 355px`, 32px padding |
| Title | `--font-display` 700, ~28px, `--color-ink`, centred |
| Subtitle | `--font-sans` 400, ~13px, `--color-ink-2`, centred |
| Segmented control | full-width 44px pill on `--color-track`; selected half a white pill inset with `--shadow-soft` and `--color-ink` 700 text; unselected transparent with `--color-ink-3` |
| Field label | `--font-sans` 700, ~10px, uppercase, letter-spaced, `--color-ink-3`, left-aligned above its input |
| Input | full-width 44px, `--radius-pill`, borderless, `--color-field`, `--color-ink` text |
| Avatar swatch | 44px round, `--color-field`; selected adds a 2px `--color-ink` ring **and** `aria-checked` |
| Primary button | full-width 48px, `--radius-pill`, `--color-primary`, white 700 label |
| Button disabled | fill `--color-ink-3`, white label, `cursor: not-allowed` — **not** opacity on the primary fill |
| Button submitting | `--color-primary` at rest with the existing label swap; `cursor: progress` |
| Error | `--color-danger`, ~13px, between the last field and the button, `role="alert"` |
| Focus | `outline: 2px solid --color-ink; outline-offset: 2px` on `:focus-visible`, every interactive element |

**Vertical rhythm**, from the transcription: title block → 20px → segmented control → 20px → fields
(6px label-to-input, 16px between groups) → 24px → error when present → 24px → button.

### 4.4 The one line in `src/App.tsx`

Line 35 only.

```diff
-      <main data-testid="app-root" className="min-h-screen bg-slate-50 p-8 font-sans">
+      <main data-testid="app-root" className="min-h-screen bg-[--color-bg] p-8 font-sans">
```

`font-sans` now resolves through `--font-sans` to the product's face rather than to Tailwind's
default stack, which is why nine shipped tickets have rendered Vietnamese fixture names in whatever
the OS supplied. **This one class repaints all fourteen routes**, which is accepted deliberately: it
moves the application toward `CLAUDE.md` § *Visual direction* rather than away, and no test asserts a
colour. `data-testid="app-root"` and the banner block at `:41-50` are untouched.

### 4.5 The comment that must be rewritten, not left standing

`SignIn.tsx:110-115` is a nine-line comment explaining that the absence of a link to `/signup` is
deliberate, citing TEA-05's plan. **The segmented control is that link, in both directions, so this
ticket reverses it** — and a developer who finds that comment and obeys it will not build AC-4.
**The comment is rewritten in this same ticket**, recording that UIE-01 supersedes it and why the
reversal is not ADR-level: the control adds no permission and reveals nothing, because `/signup` was
already reachable by address in every membership state. Deleting it silently is the failure mode;
leaving it is the other one.

## 5. Seam impact

**None.** No function in `src/lib/data/` is added, removed, renamed or changed in signature, and
`tests/seam-parity.test.ts` is not touched. Both routes keep the exact calls they make today, with
the same arguments in the same shapes. Neither imports `@supabase/*`, `./supabase` or `./mock`, and
`AuthCard.tsx` imports nothing below the hook layer — so RULE-02 and the `supabase-client-in-seam`
boundary are satisfied by construction rather than by inspection. AC-18 is the observable form.

## 6. Schema delta

`none`. No migration, no policy, no trigger, no constraint, no column, and no SQL of any kind. ADR-014
does not engage because nothing under `supabase/` is opened.

`requires_adr: false`, and it rests on one reading that § 4.1 makes explicit: **the font is
self-hosted `@font-face` over `.woff2` files in `public/fonts/`**. That is not an npm package (R9,
`coding-standards.md:91`) and not a runtime third party (`integrations.md:38-44`). A CDN `@import` or
`@fontsource/*` would each flip this field, and *Open questions* item 2 says to stop and ask rather
than take either.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/UIE-01/**"
  - "src/index.css"
  - "src/components/AuthCard.tsx"
  - "src/routes/SignIn.tsx"
  - "src/routes/SignUp.tsx"
  - "src/App.tsx"
  - "public/fonts/**"
```

**`size: M`, and it disagrees with `size_estimate: S`.** The verdict wins and PLAN proceeds —
ADR-012. The disagreement is worth the line the operating model asks for: the estimate counts
*surfaces* and reads five source files, which is S at up to 6; the count includes the three `.woff2`
files `public/fonts/**` resolves to, which makes eight and lands in M at up to 12. **The font
binaries are the whole of the gap** — an estimate that thinks in screens does not see them, and
`ticket.yaml` § 2 predicted exactly this shape when it recorded triage's reading as "S as scoped, M
if index.html and a font path are added".

**`public/fonts/**` is a glob and every other entry is a file.** It is a glob because the exact
filenames depend on the subsets the Developer can obtain (*Open questions* item 2) and a wrong
enumeration here would block the ticket at the guard for a naming detail. It is narrow: a directory
that does not exist today, holding nothing but font binaries.

**What keeps this ticket S-shaped in the way that matters is § 2's frozen-selector constraint, and it
is written as AC-10 rather than left as an intention.** Twelve spec files reference `sign-in-*` or
`signup-*`; eight of them only because each carries a local `signIn(page, email)` helper filling the
three sign-in ids. Rename one selector and this becomes 5 source files + 12 spec files = 17, which is
L, and `.ai/01-operating-model.md:374` splits an L at PLAN. **No test file is in `allowed_paths` and
none needs to be**, which AC-18 asserts and which is the measurable form of the constraint holding.

**`src/App.tsx` is line 35 only** (§ 4.4). It has appeared in the `allowed_paths` of nine shipped
tickets and it is the file in this list most likely to attract an unrelated edit.

## 8. Rejected alternatives

**Merge the two routes into one screen with a client-side toggle.** This is what the transcription
shows — one card whose segmented control swaps the fields in place — and it is the most faithful
reading of the images. Rejected on three measured grounds. `App.tsx:72-81` guards `/signin` on
`membership.state === "signed-out"` and navigates away otherwise, while `/signup` at `:65-67` is
deliberately reachable in **every** membership state under ADR-009, because a person who signed up
before being allow-listed has an auth user and no member row; merging forces either loosening the
`/signin` guard, which `tests/e2e/tea-05-sign-in.spec.ts:39-56` asserts, or branching that guard on a
query parameter inside a component. `tests/e2e/tea-01-signup.spec.ts:45,125,174` navigate to
`/signup` directly. And sign-up's terminal `submitted` state would have to coexist with a toggle that
lets you click away from it. **Two routes sharing an `AuthCard` gets the same appearance for none of
that**, which is why AC-5 describes navigation and not a state change.

**Load the font from Google Fonts with an `@import`, as the prototype does at
`_figma/src/index.css:1`.** It is one line, needs no binaries, and would close *Open questions*
item 2 immediately. Rejected because it makes the product depend at runtime on a third party for
every first paint, which `integrations.md:42` classes as an integration and sends through R9 — so it
would flip `requires_adr` to `true` and need a human before this ticket could ship. It also sends
every visitor's IP to a third party on the sign-in screen, which is a privacy decision nobody has
taken. Self-hosting costs three files in a directory this ticket already opens.

**Fill § *Colour* and § *Type* in `.ai/standards/ui-design-system.md` as part of this ticket, so the
tokens have a document behind them.** Genuinely tempting: it would close *Open questions* item 1
outright, and this ticket is where the values are chosen, so it is where they are best understood.
Rejected because `.ai/standards/` is human plane under RULE-01 and CODEOWNERS review is the
enforcement — an agent writing the product's first palette into a standard is exactly the edit that
rule exists to catch. The tokens go in `src/index.css`, where a developer may write them, and the
consequence is raised to the operator rather than resolved quietly.

**Restyle `NotOnATeam.tsx` too, since it is one redirect away.** It is reached immediately after a
successful sign-in for an allow-list miss and will look unstyled beside two restyled screens.
Rejected because it is a third screen with its own states and its own selectors, and taking it makes
the ticket six source files plus fonts with no boundary left to stop at — the same slope that would
next take `Home.tsx`. It belongs to UIE-02 or its own row. Named in § 1 so that leaving it unstyled
reads as a decision.

## Changelog

- `2026-09-07T09:05:00+07:00` — plan created. Raised by `tech-lead-design`.
- `2026-09-07T09:05:00+07:00` — § 7 records `size: M` against `size_estimate: S`, resolved by
  ADR-012 in the verdict's favour. Written down rather than reconciled because the gap is
  informative: it is entirely the three font binaries, which a scope estimate counting screens does
  not see. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
