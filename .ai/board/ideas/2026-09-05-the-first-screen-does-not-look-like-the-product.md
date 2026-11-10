---
stage: TRIAGE
agent: product
produced_at: 2026-09-05
inputs_read:
  - CLAUDE.md
  - .claude/commands/triage.md
  - .ai/templates/idea.md
  - .ai/steward/context.md
  - .ai/standards/ui-design-system.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/standards/rbac-and-security.md
  - src/App.tsx
  - src/index.css
  - src/routes/SignIn.tsx
  - src/routes/SignUp.tsx
  - src/routes/NotOnATeam.tsx
  - src/lib/data/index.ts
  - src/lib/fixtures.ts
  - supabase/seed.sql
  - ui-language.json
  - tests/e2e/tea-01-signup.spec.ts
  - tests/e2e/tea-05-sign-in.spec.ts
  - _figma/src/App.tsx
  - _figma/src/index.css
consulted: [tech-lead-design]
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# The first screen does not look like the product

## Problem

**A person who opens CaleChip meets two screens that no part of the product's stated appearance
reaches, and they are the only two screens in that position.** `CLAUDE.md` § *Visual direction* says
pastel and rounded, peach for PTO, mint for WFH, lavender for holidays, a rounded face with correct
Vietnamese diacritics. `src/routes/SignIn.tsx:62-117` and `src/routes/SignUp.tsx:77-166` render a
`max-w-md` white card on `bg-slate-50` (`src/App.tsx:35`), square `rounded-xl` inputs bordered
`border-slate-200`, an `h1` reading `Sign in` / `Sign up`, and a rectangular `bg-slate-900` button.
There is no product name on either screen, no mascot, no colour from the palette, and no rounded
face — `src/index.css` is one line, `@import "tailwindcss"`, so `font-sans` at `src/App.tsx:35`
resolves to Tailwind's default stack and nothing in `src/` loads Nunito or Baloo 2. Every other
shipped surface follows the direction; these two do not, and they are the first thing anybody sees
and the only thing a person who is not yet a member can see.

**Second, and separately: the two screens do not know about each other.** They are two routes,
`/signup` and `/signin` (`src/App.tsx:67`, `:72-81`), and `src/routes/SignIn.tsx:110-115` records in
a comment that the absence of a link to `/signup` is deliberate — TEA-05's plan put navigation out of
scope, so `/signup` is reachable by typing the address. A person invited to the board by a colleague,
who lands on `/` and is routed to the sign-in screen, has no offered way to reach the screen that
would create their account.

**The operator has stated what they want the two screens to look like, in an attachment, and the
attachment is not in the repository.** Their request, verbatim: *"I need to chnage the login/signup
page into UI like that attachment."* Two images were shown in conversation and neither is on disk;
what stands in for them is the transcription under *Evidence*, which is the only description of them
that exists anywhere. **What that transcription settles is an appearance. What it also asserts —
Vietnamese copy, a username instead of an email, and working credentials printed on the screen —
contradicts three things already decided in this repository**, and those three are recorded under
*Constraints already known* and left there rather than resolved.

## Who has it

- **Every person who reaches the product for the first time, on their first screen, once.** There is
  no way in that does not pass through `/signin` or `/signup`: `src/App.tsx:250-254` routes every
  unmatched address to `/`, which resolves by membership to the sign-in screen for a caller with no
  session (`:87-98`).
- **Every member, at every sign-in.** No session is remembered forever; this is the screen the whole
  team sees whenever their session ends, on a shared machine and on a new device.
- **The person who has just been added to the allow-list and told to sign up.** Under ADR-009 there
  is no invitation email, so somebody tells them by hand. If they land on the sign-in screen they
  have nothing to press: `src/routes/SignIn.tsx:110-115` is the comment saying why.
- **The operator, at every demonstration.** The screen that carries the product's name to anybody who
  has not used it is the one screen that does not carry the product's name at all.

## Evidence

Read in this tree today, not inferred. **Two images were attached in conversation and neither file is
in the repository — `git ls-files` holds no image of any kind, and nothing was written to
`.ai/board/ideas/` or to any ticket's `design/` folder for this idea.** The transcription below is
standing in for them, and it is the only description of those images that exists. That matters for
what happens next: `.ai/standards/ui-design-system.md:110-113` says a triage-time image lives in the
idea's `Evidence` section and moves to `.ai/board/tickets/<ID>/design/` on PROMOTE. **There is no
file here to move.** A later reader cannot check any statement below against the picture it came
from, and whoever eventually implements this will be working from prose about an image rather than
from the image.

**The transcription below is the full one, verbatim, and it replaces the restructured version this
file carried on its first pass.** `tech-lead-design` asked for it in that form and the reason is
good: the transcription is currently the entire specification, and until this edit it existed only in
a conversation, which is not an artifact. It is also copied, unchanged, to
**`.ai/board/tickets/UIE-01/design/README.md`** — the canonical path § *Visual specification* reserves
for a triage-time image, written by hand because there was no image to move. That file, not this
section, is what PLAN and `/implement` read.

### Image 1 — the sign-in state, transcribed

Flat pale-lavender viewport (~`#F0EEFA`), no pattern or gradient. One centred white card, ~355px wide,
~24px corner radius, ~32px padding, one large very soft shadow, no border, centred on both axes in an
otherwise empty viewport. Title `Ai Nghỉ?` — heavy rounded face, ~28px, deep indigo ~`#2E2350`, with a
rabbit emoji 🐰 on the same baseline immediately after. Centred subtitle directly beneath, ~13px, muted
grey-purple: `Lên lịch vắng mặt cùng team`. Then a **segmented control**: one full-width ~44px
fully-rounded pill on a pale lavender track (~`#EDEBF9`), two equal halves — the active half a **white
pill inset inside the track** with its own soft shadow and a bold deep-indigo label, the inactive half
transparent with a medium purple-grey label; here left `Đăng nhập` is active, right `Đăng ký` is not.
Then two field groups, each an uppercase ~10px letter-spaced muted purple-grey label left-aligned above
a full-width ~44px fully-rounded **borderless** input filled pale lavender-grey (~`#EDEBF7`):
`TÀI KHOẢN` / placeholder `VD: min, tram, huy...`, then `MẬT KHẨU` / placeholder `Nhập mật khẩu...`.
Then a full-width ~48px fully-rounded solid deep-indigo (~`#2A2145`) button with a white bold centred
label `Đăng nhập`. Then a footer of two centred ~11px lines: `Tài khoản Admin: min, tram` and
`Tài khoản Member: huy, dat, ngoc, khoa, linh, bao`, the prefixes light purple-grey and the names bold
indigo. Vertical rhythm: title block → ~20px → segmented control → ~20px → fields (~6px label-to-input,
~16px between groups) → ~24px → button → ~24px → footer.

### Image 2 — the sign-up state, transcribed

The same card, background, title and subtitle, only taller. The segmented control's **right** half is
now the active white pill: `Đăng ký` active, `Đăng nhập` not. Three field groups in this order, styled
exactly as above: `TÊN HIỂN THỊ` / `VD: Hải, Tuấn...`; `TÀI KHOẢN` /
`Nhập username viết liền không dấu...`; `MẬT KHẨU` / `Tạo mật khẩu...`. Primary button `Tạo tài khoản`,
same deep-indigo pill. **No footer credential block in this state. No avatar picker. No email field. No
link out of the card.**

### What the transcription settles, and what makes it worth acting on

- **It is the same brand lockup the Figma prototype already carries, extended to a screen the
  prototype never had.** `_figma/src/App.tsx:179-182` renders `Ai Nghỉ?` in `font-display` with the
  subtitle `Lịch vắng mặt team`; `_figma/src/index.css:23` binds `--font-display` to `'Baloo 2'`,
  which is one of the two faces `CLAUDE.md` § *Visual direction* names. The prototype has no auth
  screen at all — it is client-only with no sign-in — so the mockup is that lockup applied where the
  prototype stopped. The title and the rabbit are not new inventions arriving with this request.
- **The current screens are the ones that stand out, not the mockup.** `src/routes/SignIn.tsx` and
  `src/routes/SignUp.tsx` are the only two shipped routes with no product identity on them.
- **The two screens are already English and already conform to § Language.** `ui-language.json:20-26`
  lists five files as `copyDebt`; neither auth route is among them, and both were translated by
  OPS-001, which is `DONE` (`.ai/board/tickets/OPS-001/ticket.yaml:8`). **So the Vietnamese copy in
  the mockup is a reversal of finished work, not a continuation of unfinished work.**
- **The mockup's account names are not this repository's fixtures.** `min`, `tram`, `huy`, `dat`,
  `ngoc`, `khoa` and `bao` appear nowhere in `src/lib/fixtures.ts`. The single near-match is `linh`,
  and it is the local part of an address rather than a username: `src/lib/fixtures.ts:362` and
  `supabase/seed.sql:477` both hold `linh@example.com`. Whatever the footer in image 1 is listing, it
  is not the accounts this project seeds.

### What the images do not show

Recorded here because it is the larger half of what a later reader needs, and repeated under *Out of
scope* so it cannot be picked up by accident: the error state, the submitting state, the post-sign-up
*"Check your email"* confirmation (`src/routes/SignUp.tsx:61-73`), avatar selection, focus, hover and
disabled states, any width other than desktop, dark mode, and the member-less landing state
(`src/routes/NotOnATeam.tsx`).

Every one of those exists on screen today. `src/routes/SignIn.tsx:95-99` renders the seam's failure
message verbatim; `:107` swaps the button label to `Signing in…`; `src/routes/SignUp.tsx:123-150` is
a required avatar picker with a `radiogroup`; `:61-73` is the terminal confirmation that ends
sign-up. **The images are silent about all of them, which is not the same as removing them.**

## Impact if ignored

**The product's first impression stays the one surface nobody applied the design to, and that is the
surface with the widest audience per screen.** Every other charm the direction describes — the
mascots, the pastel palette, the empty states — lives behind a sign-in that looks like an unstyled
form.

**The operator asked in words and nothing in the loop carries the request.** There is no feature row
for the appearance of the auth screens, no ticket, and no backlog entry. A request that reaches no
artifact is a request that gets asked again.

**The attachment decays first.** It exists only in a conversation. When this idea is judged, or
planned, or implemented, the person doing it will have this transcription and nothing to check it
against — and `.ai/standards/ui-design-system.md:127-138` already says an image binds nothing by
itself and that *"looks like the screenshot" is not an acceptance criterion*. A transcription of an
image nobody can reopen is weaker than that again.

**The three contradictions get resolved silently, in whichever direction is convenient at the
moment somebody meets them.** Vietnamese copy would walk back OPS-001 and would have to be added to
`ui-language.json`'s `copyDebt` — which that file's own comment at `:10-13` and `:17` calls the
failure mode, because the list *"only ever SHRINKS"*. A username field has nowhere to go: the seam
takes `email` (`src/lib/data/index.ts:26-31`, `:38-42`) and Supabase Auth authenticates on it. Working
credentials printed under the button reach production the moment the screen does. **None of those is
a layout decision, and all three are cheapest to notice now.**

**The sign-in screen keeps having no way to the sign-up screen.** Every person added to the
allow-list is told the address by a colleague, or does not get in.

## Constraints already known

Cited, not chosen. Each bounds what an eventual ticket may do, and the last three are the ones the
mockup contradicts.

- **`CLAUDE.md` § *Visual direction*** — pastel and rounded, peach PTO, mint WFH, **lavender for
  holidays**, overload a soft pink, and *"Type is a rounded face with correct Vietnamese diacritics —
  Nunito or Baloo 2, never Quicksand."* The mockup's palette is lavender-and-indigo throughout, and
  lavender already means *holiday* in the grid. Whether that collides on a screen with no grid on it
  is not settled here.
- **`.ai/standards/ui-design-system.md:12-28` — § *Direction*, § *Colour*, § *Type* and § *Components*
  are still `TODO(project)` stubs.** So there is no palette, no type scale and no component vocabulary
  in the standards plane for the mockup's hex values to be checked against or written into. That file
  is human plane under RULE-01 and is not this idea's to fill.
- **`.ai/standards/ui-design-system.md:101-155` — § *Visual specification*.** An image is attached at
  exactly one stage, `/triage` or `/plan`, never both; a triage-time image moves to
  `.ai/board/tickets/<ID>/design/` on PROMOTE. No stage downstream reopens it, there is no visual
  check anywhere in the loop, and *"looks like the screenshot" is not an acceptance criterion*
  (`:137-138`). **Here there is no file to move at all.**
- **The selector contract.** `tests/e2e/tea-05-sign-in.spec.ts` addresses `sign-in-email`,
  `sign-in-password`, `sign-in-submit` and `sign-in-error`; `tests/e2e/tea-01-signup.spec.ts`
  addresses `signup-form`, `signup-email`, `signup-password`, `signup-display-name`,
  `signup-avatar-picker`, `signup-avatar-option`, `signup-submit`, `signup-error` and
  `signup-confirm-notice`. Definition of Done item 3 requires all four commands to exit 0, so a
  rebuild of these two screens either keeps those names on the equivalent controls or moves the
  suites with it.
- **ADR-005 and `.ai/standards/rbac-and-security.md:143`** — there is no server; row-level security is
  *"not the last line of defence. It is the only one"*, and the anon key is public by design
  (`:124`). Nothing on these screens is a control; they establish who the caller is and nothing more,
  as `src/routes/SignIn.tsx:1-8` already records.
- **ADR-009** — a person joins by signing up against the allow-list and **there is no invitation
  email**. Sign-up ends on the terminal *"Check your email"* notice at `src/routes/SignUp.tsx:61-73`,
  and `src/routes/NotOnATeam.tsx:6-11` records that no screen may reveal whether an address is
  allow-listed, because that turns sign-up into an address-enumeration oracle.
- **`.ai/registry/invariants.md:33-39` — checked, and no invariant governs the appearance of a
  screen.** All seven rows constrain `entry` rows: overlap, approval state, rejection reasons, the
  absence count, tentative entries, portions, ownership. Recorded explicitly so a later reader does
  not re-derive it and conclude otherwise; `invariants_touched: []` is the defensible answer here and
  must be written as `[]` rather than omitted.

### The three things the mockup asserts that the tree contradicts

**Stated, not resolved.** Each is a decision that already exists in the repository, and none of them
is a layout question. They are named here so the verdict has to meet them.

1. **The copy is Vietnamese; § Language says the interface is English.**
   `.ai/standards/ui-design-system.md:46-48` quotes the operator's instruction of 2026-09-03 — *"tôi
   muốn tất cả content đều là tiếng anh"* — and it is enforced by a `no-restricted-syntax` rule in
   `eslint.config.js` plus `tests/ui-language.test.ts`, both reading `ui-language.json`. Both auth
   routes are already English and are **not** on `copyDebt` (`ui-language.json:20-26`); OPS-001
   translated them and is `DONE`. Every string in both transcriptions is Vietnamese, including two
   with diacritics in a placeholder (`VD: Hải, Tuấn...`).

2. **Identity is a username, and sign-up collects neither an email nor an avatar.** The seam takes
   `{ email, password }` for sign-in (`src/lib/data/index.ts:38-42`) and
   `{ email, password, displayName, avatar }` for sign-up (`:26-31`); `avatar` is required by the
   screen (`src/routes/SignUp.tsx:31`) because the column is `not null` with no default. **There is
   no username anywhere in this product** — not in the seam, not in the schema, not in the fixtures.
   Identity is ADR-005 and ADR-009 territory, and the avatar is TEA-01's AC-8.

3. **Working credentials for eight accounts are printed on the sign-in screen.** That is a security
   posture, not a layout: it is the screen telling an unauthenticated visitor which accounts exist
   and which of them are admins, in a product whose only authorization mechanism is row-level
   security against a publicly reachable endpoint (`.ai/standards/rbac-and-security.md:124, :143`).
   It also collides with the address-enumeration reasoning ADR-009 and `src/routes/NotOnATeam.tsx:6-11`
   already carry.

## Out of scope

- **Deciding any of the three contradictions above.** They are named, not settled. Two of the three
  reverse an operator instruction or an accepted ADR, and neither an idea nor a design may do that
  quietly.
- **Amending `.ai/standards/ui-design-system.md`** — filling § Colour, § Type, § Direction or
  § Components, or adding the mockup's hex values to them. Human plane, RULE-01.
- **Amending `ui-language.json`.** Adding a file to `copyDebt` is what that file calls the failure
  mode (`:10-13`).
- **Everything the images do not show, restated so it cannot be absorbed:** the error state, the
  submitting state, the post-sign-up *"Check your email"* confirmation, avatar selection, focus,
  hover and disabled states, any width other than desktop, dark mode, and the member-less landing
  state (`src/routes/NotOnATeam.tsx`). All of these exist today and the images are silent about them;
  silence is not removal.
- **Every other screen.** `Home`, `MemberList`, `AllowList`, `Threshold`, `Holidays`, the entry forms
  and the three calendar views are outside this. The request names the login and sign-up pages.
- **The seed data and the fixtures.** `src/lib/fixtures.ts` and `supabase/seed.sql` are § Language's
  stated exception and keep their Vietnamese diacritics; nothing here proposes making the mockup's
  eight names real.
- **Adding a font dependency, a component library, or anything else to `.ai/standards/tech-stack.md`.**
  The absence of a rounded face in `src/` is recorded above as a fact, not as a proposal — how it is
  answered is not this file's to say, and if it reaches for a dependency it is an ADR.
- **The navigation gap on its own.** It is described under *Problem* because it is the same two
  screens, but a link between `/signin` and `/signup` is a behaviour with an acceptance criterion,
  and `src/routes/SignIn.tsx:110-115` says its absence was TEA-05's deliberate choice. Reversing that
  is a decision somebody has to make, not a side effect of a restyle.

## Open questions

The ones a verdict turns on and that I could not settle from the repository.

1. **Do the two routes merge into one screen behind the segmented control, or stay two routes that
   share a shell?** Both transcriptions show one card whose state changes, which reads as one screen.
   The tree has two components at two addresses (`src/App.tsx:67`, `:72-81`), guarded differently:
   `/signin` redirects a caller who already has a session to `/`, `/signup` is reachable in every
   membership state because it is the only route a person who has not signed up can use
   (`:65-67`). Merging them has to preserve both behaviours, and it changes which component the
   twelve `signup-*` and four `sign-in-*` selectors live in.

2. **What does the segmented control do to the URL?** If pressing `Đăng ký` does not change the
   address, `/signup` stops being linkable and every instruction that says *"go to /signup"* stops
   working — including the one a colleague gives somebody who has just been allow-listed. If it does
   change the address, the control is navigation and the two routes survive under one shell. Nothing
   in either image shows an address bar.

3. **Which of the three contradictions does the operator actually intend?** They may have attached a
   picture for its layout and not for its copy, its identity model or its footer. That is the most
   likely reading and it is still a guess. It is one question with three parts and it decides whether
   this is a restyle, a reversal of OPS-001 and ADR-009, or something in between.

4. **Is this a new feature row, or a chore against TEA-01 and TEA-05?** The auth screens were shipped
   by those two features, and `.ai/01-operating-model.md` declares `OPS-nnn` for chores against
   shipped surface — the shape the 2026-09-03 language idea used for exactly this reason. Whether
   changing how a shipped screen looks is a capability the product gains or a chore against what it
   already has is not mine to decide before the verdict.

5. **What replaces the credential footer, if anything?** It occupies the bottom fifth of image 1 and
   nothing else is offered for that space. A link to `/signup` would fit there and would close the
   navigation gap — but that is a behaviour nobody has asked for, and it is out of scope above.

6. **Does the rounded face arrive with this work or before it?** `CLAUDE.md` § *Visual direction*
   requires Nunito or Baloo 2; `src/index.css` loads neither, and no shipped screen has ever rendered
   in one. The mockup's title is unmistakably a heavy rounded face. Whoever answers this is answering
   it for every screen in the product, not for these two.

7. **Where does the image live, given that no image is on disk?** § *Visual specification* is built
   on a file at `.ai/board/tickets/<ID>/design/`. There is none. Either the operator attaches the two
   files so they can be committed, or this ticket proceeds on the transcription above and says so —
   and the second reading makes the transcription the specification, written by an agent, which is a
   different thing from an image the operator supplied.

## Triage verdict — 2026-09-05

**PROMOTE.** One ticket, **UIE-01**, in the `UIE` feature group, **with a row of its own in
`.ai/registry/features.md`**. No ADR is owed by this triage: the group it uses was created by
[ADR-028](../../registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md), which `steward`
recorded and the operator accepted on 2026-09-05.

**AMENDED 2026-09-05, AND THE FIRST FORM OF THIS VERDICT IS NAMED HERE RATHER THAN OVERWRITTEN.** It
read, in full: *"PROMOTE. One chore ticket, OPS-003, in the `OPS` series. No new feature row, no
ADR."* **The verdict and the scope did not change** — PROMOTE, one ticket, the same five paths and
the same four things scoped out. What was overruled is the ID scheme and the argument for it, which
stands marked in the two subsections below rather than rewritten. The operator's instruction,
verbatim: *"nhưng ticket liên quan UI enhancement tôi đề nghị mở 1 feature group riêng sử dụng UIE
(UI enhancement)"*. ADR-028 records it, declares `UIE` as a fourth feature group, and carries the
four-step test that now decides the prefix. Consequently the ticket was renumbered `OPS-003` →
`UIE-01`, its `group` became `UIE`, and its `feature_ids` became `[UIE-01]` — TEA-01 and TEA-05 came
out of that field because this ticket restyles the surfaces those features shipped rather than
delivering the features themselves, and because `.ai/01-operating-model.md:317` makes the ticket ID
the feature ID in the 1:1 case, which this now is. **The link to both survives as prose in both
directions**: their `Notes` paragraphs point at UIE-01, and UIE-01's `Notes` names them.

`product` and `tech-lead-design` triaged this on 2026-09-05. The technical half answered the four
open questions the verdict turned on — 1 and 2 (merge or not), 4 (feature row or chore) and 6 (the
font) — and it measured three things this file had guessed at. Its citations are carried into
`.ai/board/tickets/UIE-01/ticket.yaml` rather than re-derived here. **Open question 4's answer is
the one that moved**, and its live form is in the marked subsection below.

### Why PROMOTE and not REJECT-as-not-worth-doing

**These two screens are the only surfaces that no part of `CLAUDE.md` § *Visual direction* reaches,
and they are the first and sometimes the only thing a person sees.** The REJECT argument is that
nothing is broken — and that is true, which is exactly why this is a chore and not a defect. It does
not survive the reach argument in *Impact if ignored*: every other charm the direction describes lives
behind a sign-in that looks like an unstyled form, and there is no way into the product that does not
pass through one of these two routes.

The *already covered* argument fails harder here than it did for the language chore, because there is
nothing to be covered by. `.ai/standards/ui-design-system.md:17-24` — § Colour and § Type — are both
bare `TODO(project)` stubs. No standard describes what these screens should look like, so nothing in
the loop would ever repair them.

### Why a chore in the `OPS` series and not a feature row — OVERRULED 2026-09-05

**THE CONCLUSION OF THIS SUBSECTION IS NOT THE LIVE ONE.** It is kept because it was the reasoning
that produced `OPS-003`, and because a reader meeting the renumbering elsewhere needs to be able to
find what was argued and what replaced it. The operator overruled it the same day, in the words
quoted in the amendment above, and ADR-028 records the overruling. **Read the four paragraphs below
as the superseded argument, and the block that closes this subsection as the answer that stands.**

**Nothing regressed and the current screens are correct.** They are plain, which is a different thing
from wrong. A row in `.ai/registry/features.md` reading *"the sign-in screen looks like the product"*
would file an **appearance** as something the product **contains**, and `CLAUDE.md` calls that file
*"the only valid source of feature IDs"*. `.ai/01-operating-model.md:317` declares the scheme:
*"Defects are BUG-nnn, chores are OPS-nnn."*

This is the same deliberate departure from ADR-007's PROMOTE default that **BUG-001** and **OPS-002**
already took, and it follows their shape rather than inventing one —
`.ai/board/tickets/OPS-002/ticket.yaml` § 7 is the argument this copies. **Check D1 is not tripped:**
`scripts/check-docs.mjs` builds `\b(?:CAL|ADM|TEA)-\d{2}\b` from the declared prefixes, and `OPS-003`
matches neither half — wrong prefix, three digits against `\d{2}`.

*End of the superseded argument.*

**THE ANSWER THAT STANDS: a feature row in a fourth group, `UIE-01`.** ADR-028 declared `UIE` — *UI
enhancement* — on the operator's instruction, so work whose deliverable is how an existing surface
looks now has a place in the registry rather than being invisible in the `OPS` series. Its four-step
test decides the prefix and is not restated here; under it this ticket is `UIE` at step 3, because
more than one output would be acceptable and somebody has to look at the result and judge it. The row
is `UIE-01` in the `## UIE` section of `.ai/registry/features.md`, `Status: PLANNED`,
`Invariants touched: []`, citing this file by name — the provenance ADR-007 asks of every row, which
the chore treatment could only supply as a hand-written sentence inside somebody else's `Notes` cell.
Those two sentences on `TEA-01` and `TEA-05` are kept, marked as overruled, and now point here.

**The D1 arithmetic in the paragraph above is stale in one term and it is the term that constrained
this edit.** The prefix marker in `.ai/registry/features.md` declares four prefixes as of 2026-09-05,
so `scripts/check-docs.mjs:154` builds `\b(?:CAL|ADM|TEA|UIE)-\d{2}\b` and `UIE-01` **does** match
it. Declaring the prefix on its own is green — `scripts/tests/check-docs.test.mjs:161` asserts that —
so what fails the audit is a document citing `UIE-01` before the row exists. **The row and every
citation of it therefore had to land in one change**, which is the order this amendment was written
in: the row first, then this file, the backlog and the ticket.

**This answers open question 4, in the second of its two answers.**

### The provenance a reviewer gets instead — OVERRULED 2026-09-05

**THE CONCLUSION OF THIS SUBSECTION IS NOT THE LIVE ONE EITHER**, for the same reason and by the same
decision: there *is* a row, so provenance is no longer something a reviewer gets *instead* of one.
Kept and marked rather than rewritten. What replaced it is below the two paragraphs.

**One sentence appended to the `Notes` of `TEA-01` and `TEA-05` only** — the two rows that own these
screens — each naming this idea file and `OPS-003`, saying it is a restyle chore against shipped
surface rather than a capability, and saying that no new feature row was written. **Two rows, not
seven**: OPS-002 spanned seven features because two seam files carry every refusal in the product;
this ticket touches two screens that two features shipped.

RULE-01 permits a feature-row edit with no ADR. **CODEOWNERS review at merge is the approval**, and
that sentence plus the idea filename in the ticket header is the whole trail.

*End of the superseded argument.*

**WHAT A REVIEWER ACTUALLY GETS NOW.** The `UIE-01` row in `.ai/registry/features.md` cites this file
by name in its `Notes`, which is where ADR-007 puts the provenance of every promoted row, and the row
carries the `Status` that reaches `DONE` at ship. The two sentences on `TEA-01` and `TEA-05` are
still there and were **not** silently switched to the new ID: each is marked as overruled, quotes the
instruction that overruled it, and points at `UIE-01`. So the trail runs in both directions — from
either shipped feature to the restyle, and from the restyle back to the two features whose surfaces
it touches — and neither direction rests on the ticket folder existing. **Two rows, not seven**, is
unchanged and is still the difference from OPS-002.

### Why not NEEDS-ADR

**Nothing in the promoted scope supersedes an accepted decision.** `schema_delta: none` — there is no
migration at all. No seam function moves: `SignIn.tsx:37` keeps `signIn({ email, password })` and
`SignUp.tsx:48` keeps `seam.signUp({ email, password, displayName, avatar })`, so nothing is added to
`src/lib/data/index.ts`. RULE-02 was checked rather than assumed — neither route imports `@supabase/*`,
and a new presentational `AuthCard` imports nothing below the hook layer.

**The two things that would force an ADR are the two things being scoped out**, and neither is an
agent's to reverse. That is the answer to open question 3, and it is the reason this verdict is a
restyle: the layout survives the scope-out intact in all three cases.

### The three things the reference asserts that are out of scope, each because it reverses a decision

Written here and again in `ticket.yaml` § 4, where they are negative requirements.

1. **Vietnamese copy — out.** It reverses `.ai/standards/ui-design-system.md` § *Language*, the
   operator's own instruction of 2026-09-03, and it is lint-enforced at `eslint.config.js:83-92`.
   Neither route is in `copyDebt` (`ui-language.json:20-26`); OPS-001 translated them both and is
   `DONE`, and that list *only ever shrinks* — adding to it is named as the failure mode at `:10-13`.
   **It costs the layout nothing:** `Sign in` / `Sign up`, `EMAIL`, `PASSWORD` and `DISPLAY NAME` fit
   the same pills at the same widths.

2. **Username identity — out.** It reverses ADR-009 and, underneath it, ADR-005. The email **is** the
   join key: `supabase/migrations/20260831150024_tea01_membership.sql:100-105` consumes the allow-list
   row by matching `a.email = new.email`, and `member.id` is `auth.users.id`. `username` appears
   **zero** times under `src/`, `supabase/` and `.ai/standards/data-model.md`. Adding one means a
   column, a uniqueness constraint, a new allow-list key, a changed trigger, and a way to turn a
   username into something `supabase.auth.signInWithPassword` accepts — non-empty `schema_delta`,
   `requires_adr: true`, XL. **It costs the layout nothing:** the field is one pill either way, and
   only the label and the placeholder change.

3. **Printed credentials — out.** These reverse no accepted ADR but contradict shipped behaviour and
   name accounts that do not exist. TEA-05 AC-2 is *"a wrong address and a wrong password are refused
   identically"*; `SignIn.tsx:39-44` goes to some length not to distinguish the two and
   `tests/e2e/tea-05-sign-in.spec.ts:68-80` asserts it. Printing the valid account list defeats that
   on purpose. **It costs the layout nothing** — two lines deleted. If a demo affordance is genuinely
   wanted it belongs behind `seamName === "mock"` beside the existing banner at `App.tsx:41-50`, and
   that is a separate ticket.

**A fourth, which is not a contradiction but a removal:** the reference shows no avatar picker.
Dropping it breaks TEA-01's AC-8 and four assertions, so **a restyle keeps it**; where it goes is
PLAN's to originate.

### Two routes, not one merged screen — open questions 1 and 2, answered

**Two routes sharing an `AuthCard`, with the segmented control rendered as two `<Link>`s.** That
changes nothing in the router, nothing in `App.tsx`'s membership routing and nothing in any shipped
spec, and it keeps `/signup` linkable — which was the whole of open question 2. Merging them would
force either loosening the `/signin` guard that `tests/e2e/tea-05-sign-in.spec.ts:39-56` asserts, or
branching that guard on a query parameter inside a component. The reasoning is in `ticket.yaml` § 1.

**It has one cost and the ticket carries it rather than leaving it to be found.**
`src/routes/SignIn.tsx:110-115` is a nine-line comment saying the absence of a link to `/signup` is
deliberate. A segmented control **is** that link. Not ADR-level — `/signup` is already reachable by
address in every membership state — but a developer who finds that comment and obeys it will not build
the control, so PLAN must say so and the comment is rewritten in the same ticket. `ticket.yaml` § 8.

### What the verdict does not settle

- **The font.** Three paths, one of which needs no ADR (self-hosted `@font-face`) and two of which do.
  `requires_adr: false` is recorded on the first reading only, and PLAN must stop and ask rather than
  flip the field. `ticket.yaml` § 7. **This is open question 6, narrowed rather than answered.**
- **§ Colour and § Type.** They are human-plane stubs and this idea may not fill them. If nobody does,
  this ticket becomes the de-facto design system with no document behind it — stated as a consequence,
  not a blocker.
- **The lavender collision.** `CLAUDE.md` § *Visual direction* assigns lavender to holidays in the
  grid, and the reference is lavender-and-indigo throughout. Whether that collides on a screen with no
  grid on it is not settled here, and it is not settled by silence either.
- **Open question 5 — what replaces the credential footer.** Nothing is proposed. The footer is out;
  the space is PLAN's.

### Open question 7 — answered, and the answer is the reason `design/README.md` exists

**No image was ever on disk, so nothing moved.** `.ai/standards/ui-design-system.md:105-125` describes
a triage-time image moving to `.ai/board/tickets/<ID>/design/` on PROMOTE; there was no file, so
`product` wrote the transcription by hand at that canonical path instead. It states in its own first
line that it is a transcription of images shown in conversation and not an attached image.

That places the ticket under the *"With no image, the Tech Lead designs it"* grant at
`.ai/standards/ui-design-system.md:140-150`, **including the obligation that comes with it**:
`01-plan.md` § 2b must carry the line that the layout is the Tech Lead's own and was never specified.

### What was promoted

| Path | What it is |
|---|---|
**This table describes what is on disk now, so it was rewritten by the 2026-09-05 amendment rather
than marked.** What it said before is recoverable in one line and is recorded here so the rewrite is
not silent: the first two rows read `.ai/board/tickets/OPS-003/…`, the ticket shell row read
`group: TEA`, `feature_ids: [TEA-01, TEA-05]` and `branch: feat/OPS-003`, and the `features.md` row
read *"One sentence appended to the `Notes` of `TEA-01` and `TEA-05`. No new row."*

| Path | What it is |
|---|---|
| `.ai/board/tickets/UIE-01/ticket.yaml` | The ticket shell. `group: UIE`, `feature_ids: [UIE-01]`, `branch: feat/UIE-01`, `depends_on: []`, `schema_delta: none`, `requires_adr: false`. `size_estimate`, `invariants_touched` and `allowed_paths` are PLAN's and are left as the template ships them. |
| `.ai/board/tickets/UIE-01/design/README.md` | The visual reference, written by hand because there was no image to move. Cited from *Evidence* above. |
| `.ai/board/backlog.md` | One row in `## BACKLOG`. `product` asserts nothing about its position. |
| `.ai/registry/features.md` | The `UIE-01` row, and the overruled-chore paragraphs on `TEA-01` and `TEA-05` marked and pointed at it. |

**PROMOTE is still a recommendation about scope, not a state change of the product's feature set.**
Nothing here creates a capability. The one thing that did change on 2026-09-05 is that a promoted row
is now written at `/triage` under ADR-007 rather than by a human afterwards — so the `UIE-01` row
above is an agent's write, and the decision it rests on, ADR-028, is the operator's and is quoted in
it word for word.
