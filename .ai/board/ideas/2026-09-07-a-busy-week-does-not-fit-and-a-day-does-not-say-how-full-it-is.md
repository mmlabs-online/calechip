---
stage: TRIAGE
agent: product
produced_at: 2026-09-07
inputs_read:
  - CLAUDE.md
  - .ai/steward/context.md (standing instructions in full; session log read in part)
  - .ai/templates/idea.md
  - .ai/standards/ui-design-system.md (§ Language, § Visual specification)
  - .ai/registry/features.md (CAL-01..CAL-05, the UIE group header, UIE-01..UIE-04)
  - .ai/registry/invariants.md (the seven rows, and the INV-04 and INV-06 notes)
  - .ai/board/tickets/UIE-04/design/README.md
  - .ai/board/ideas/2026-09-05-the-first-screen-does-not-look-like-the-product.md
  - src/routes/WeekView.tsx (in full)
  - src/components/Sidebar.tsx (by search)
  - src/components/TopBar.tsx (by search)
  - src/components/AppShell.tsx (by search)
  - src/lib/fixtures.ts (by search)
  - ui-language.json
  - scripts/check-docs.mjs (D5 and D6 scoping only)
  - the transcription named under Evidence
  - tech-lead-design's technical read of the same request, 2026-09-07 (read in full before the verdict)
  - .ai/board/tickets/UIE-04/ticket.yaml
  - .ai/registry/decisions/ADR-000-template.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# A busy week does not fit on the screen, and a day does not say how full it is

**This file is step 0 of `/triage` and carries no verdict.** The problem is written down before it is
judged; the verdict, and anything that follows from it, is written in a second dispatch after
`tech-lead-design`'s technical read. There is no feature ID here, and none was allocated.

## Problem

The operator's request, verbatim, 2026-09-07: *"thay đổi UI lịch tuần như design trong hình này"* —
change the week calendar UI to match the design in this image. **What they handed over is a picture of
an answer.** What follows is the question it appears to be answering, stated against the screen as
shipped, because that is the part nobody has written down.

The week view is `/` — the address the shell lands every member on — and it was rewritten into seven
day columns by **UIE-04**, which reached `DONE` earlier today in PR #66. Four things about it are
true in the tree right now.

**1. A week with people in it does not fit, and the empty days pay for it.** The seven columns are one
CSS grid row (`src/routes/WeekView.tsx:333`), so they are already equal in height — but that height is
**the busiest day's**, not the screen's, and nothing in the file sets a height or an `overflow`. The
content pane is the only scrolling region (`src/components/AppShell.tsx:40`). `WeekView.tsx:39-46`
records the arithmetic and the decision: at ~161px a column, one chip is 90–110px, one member may hold
an `am` **and** a `pm` entry on the same date, so sixteen chips on one day is about 1520px of content
in about 910px of body. **The consequence a person meets is that one crowded Wednesday pushes the rest
of the week below the fold, and the four-fifths of every quiet column that is white space goes down
there with it** — on a screen whose whole purpose is seeing the shape of the week at once.

**2. This screen will not tell anybody how full a day is.** `WeekView.tsx:11-17` and `:48-55` state it
three times over: no absence count, no overload state, no threshold, `seam.getTeam()` deliberately not
called, and no footer strip, because *a column ends where its content ends*. A person looking at
Friday counts chips — and counting chips is not the same number: a day holding one full-day entry and
two half-day entries is **three chips and an absence count of two** (INV-04, INV-06). So the one
question the month grid answers for a date is the one question the week screen refuses for it, and the
manual substitute is arithmetic the reader has to do in their head and can get wrong.

**3. Each row spends its height on one person's detail, on a screen that is about seven days.** A chip
renders avatar, display name, type label and portion pill on a wrapping row (`:436-457`), then
`Tentative` (`:461-465`), then the note on its own line (`:472-476`), then `★ Approved by <name>` on
another (`:481-489`). Every one of those is a CAL-05 acceptance criterion and none of it is
decoration — but it is why a chip costs 90–110px, and item 1 above is denominated in that number.

**4. The column header is the longest string in a 161px column.** `:369-370` renders the full English
weekday name and the raw `yyyy-MM-dd` date, in a `flex flex-wrap` heading (`:362`) that may also carry
a holiday name (`:374-382`) and a `Bridge` badge (`:383-390`). TODO(verify): whether it wraps to two or
three lines at that width cannot be measured from source and needs a rendered viewport — UIE-04's own
row records the same uncertainty, and says it makes the overflow worse rather than better.

**Not everything in the picture answers one of these, and the difference is stated rather than
dressed up.** The image's Vietnamese copy, its `T2 30/03` header format, its removal of the per-day
`Everybody is in.` line (`:393-396`), and its particular chip shape are **preferences about
arrangement**, and one of them reverses a decided standard. No person is unable to do anything because
the weekday reads `Monday` instead of `T2`. They are recorded here so a later reader can tell which
half of the picture is a response to a problem and which half is taste — and the second half is not
worth less for being taste, it is worth *differently*, because taste does not license reversing a
registry row.

## Who has it

- **Every member, on `/`, at the start of every session.** UIE-02 made the landing route render the
  current week in place (`WeekView.tsx:131-145`), so this is the first screen anybody sees after
  sign-in and the one they return to. Items 1 and 2 above are met here, daily.
- **Anybody trying to answer "can I take Thursday off?" from this screen** — the coordination use the
  CAL-05 row was written for. They get names, and they get no measure of the day.
- **The operator, today.** They looked at the result of UIE-04 within hours of it shipping and drew a
  different screen. That is the strongest evidence in this file and it is also the least specific: it
  says the shipped screen is not what they want, not which of the four items above is why.

## Evidence

**Visual reference:** `/tmp/claude-0/-home-user-calechip/81a228c8-a342-5ee1-a6d6-0dd56dfd3585/scratchpad/transcription.md`

**What it is meant to settle:** the arrangement of the seven day columns — the header strip's format,
what a chip carries at column width, what a column does with height its content does not use, and what
sits at the bottom of a column.

**Its status, exactly, because three different things are easy to confuse here:**

- **The image is the operator's, it was shown in conversation, and it is not on disk.** `git ls-files`
  holds no image for this request and nothing was written to any ticket's `design/` folder.
- **The file at the path above is a hand transcription, not the image.** It was written for this
  triage by another agent, at a scratchpad path outside the repository, because there was no file to
  move. A later reader cannot check a single sentence of it against the picture it describes.
- **Where it ends up depends on the verdict**, per `.ai/standards/ui-design-system.md:110-113`. On
  PROMOTE it becomes the ticket's `.ai/board/tickets/<ID>/design/README.md` — the one canonical home,
  and the only path both `scripts/check-allowed-paths.mjs` and
  `.claude/hooks/guard-allowed-paths.mjs` exempt unconditionally. On REJECT or NEEDS-ADR it stays
  with this idea and **specifies nothing**, because there is no ticket to specify.

**The transcription is evidence of intent and it is not a specification.**
`.ai/standards/ui-design-system.md:137-138` — *"looks like the screenshot" is not an acceptance
criterion*, because it cannot be observed from outside the system by a reader who cannot ask a
question. `:127-129` is sharper still: no stage downstream ever reopens the reference, there is no
visual check at REVIEW, in CI, or anywhere else since ADR-022 removed the QA stage. This is the same
situation UIE-01, UIE-02 and UIE-04 were each triaged in, and
`.ai/board/tickets/UIE-04/design/README.md` is the precedent for how it was labelled.

**This is the third transcription in a row for the same screen family, and the second for this
screen.** UIE-04 shipped against a transcription of an *empty* week. This one shows a week with two
chips in it. Both are, for the purpose of every claim about density, the same picture.

**The rest of the evidence is in the tree and was read today, not recalled:** `WeekView.tsx:11-55`,
which is UIE-04's and CAL-05's reasoning written into the file it governs; `Sidebar.tsx:68-70`, three
legend rows and no fourth; `TopBar.tsx:95-180`, the period controls, `Today` and the view switcher
already shipped; `ui-language.json:21`, `copyDebt` empty; and `src/lib/fixtures.ts:39, :72, :149,
:319`, four active members on the main team.

## Impact if ignored

- **The operator asked in words and nothing in the loop would carry it.** There is no feature row for
  this, no ticket and no backlog entry. A request that reaches no artifact gets asked again, and it
  gets asked again after the next screen is built on the arrangement it disagrees with.
- **The screen stays the one the operator looked at and rejected**, on the address every member lands
  on. Items 1 to 4 above continue exactly as described; the busy weeks that make item 1 visible have
  not happened yet in this product, so nothing else will surface it.
- **The picture decays first.** It exists in one conversation. Everything downstream will work from a
  transcription of it written by an agent — and the three places that transcription contradicts the
  registry (§ *Constraints already known*) will then get resolved by whoever meets them first, in
  whichever direction is convenient at that moment. **Two of the four differences in this picture
  cannot be resolved by a designer at all**: the count is a registry row, and the chip's contents are
  four acceptance criteria with spec assertions behind them.
- **UIE-04's refusal gets reversed by accident rather than on purpose.** That ticket refused the
  footer count twice — the share of the roster, and triage's own cheaper substitute of the day's chip
  count — and wrote the argument into the file. A ticket that reproduces the picture without meeting
  that argument reverses it silently and leaves INV-04 with a second definition.

## Constraints already known

Cited, not chosen. The first three are the reason this may not be a straight PROMOTE.

- **CAL-05's registry row, and INV-04.** The row says *"Displaying who approved is not approving — no
  admin action reaches this surface"*, and it lists INV-04 in `Invariants touched` precisely because
  *"a week list disagreeing with a month cell — four names against 3.5 — is exactly the divergence the
  invariant forbids"*. INV-04 reads: *"No second definition of this number exists anywhere in the
  system."* **The image draws a per-column footer count, `n/8 vắng`, on all seven days.** UIE-04's row
  refused exactly that, and its plan refused the cheaper chip-count substitute with it, because a day
  holding one full-day and two half-day entries has three chips and an absence count of two — so the
  footer would contradict the month grid for the same date, reached without ever opening `absence.ts`.
  A count on this screen is **behaviour**, needs the team read `WeekView.tsx:11-17` deliberately does
  not make, and reproducing it requires an amendment to CAL-05's row under RULE-01 rather than an
  acceptance criterion.
- **The `8` in `n/8 vắng` does not exist.** `src/lib/fixtures.ts` holds **four** members on the main
  team who have not been removed (`:39`, `:72`, `:149`, `:319`; `:108` is another team, `:123` carries
  `removedAt`). Nothing may be asserted from that number, and no test can be written against it.
- **UIE-04's recorded decision on column height, with its argument.** `WeekView.tsx:39-46`: *"THE
  COLUMNS DO NOT FILL THE VIEWPORT AND NO COLUMN SCROLLS ON ITS OWN"* — seven independent scrollers
  would put the days out of horizontal register, and a day whose entries all sat below its own fold
  would read as a quiet day, *"the opposite of what this screen is for"*. The pane scrolls once
  instead, and a column is as tall as the busiest day. **The image reverses this**: seven columns
  pinned to the viewport, nothing scrolling. **It shows a week with two chips in it**, which is the
  one case in which that property costs nothing to claim — the same objection UIE-04's own reference
  carried, one picture ago.
- **CAL-05's shipped acceptance criteria, and INV-06's only visible surface.** The image's chip drops
  the portion pill, the note, the word `Tentative` and `Approved by <name>`. Those are AC-3 and AC-4
  (`data-portion` read off the entry on every date it covers), AC-6, AC-9 and AC-7, all rendered at
  `WeekView.tsx:452-489` and asserted in `tests/e2e/cal-05-week-view.spec.ts`. `WeekView.tsx:19-22`:
  *"INV-06 IS VISIBLE HERE AND NOWHERE ELSE"* — a five-day `pm` entry is five afternoons, and the
  portion is how a reader sees it. Removing any of them is an amendment to CAL-05's criteria, not a
  restyle. UIE-04 refused this once already, as its Option 2.
- **`.ai/standards/ui-design-system.md` § *Language*.** The interface is English — the operator's own
  instruction of 2026-09-03 — enforced by a `no-restricted-syntax` rule in `eslint.config.js` and by
  `tests/ui-language.test.ts`. **`copyDebt` is empty** (`ui-language.json:21`), OPS-001 and OPS-002
  paid the last of it, and `:10-13` names adding a file to that list as *the failure mode*. **Every
  string in the image is Vietnamese** — the header abbreviations, `vắng`, the legend, the buttons.
- **`.ai/standards/ui-design-system.md` § *Visual specification*, `:140-155`.** The grant to
  `tech-lead-design` covers the **visual arrangement** and the ACs that describe it, **and nothing
  else**. Feature IDs, domain acceptance criteria — behaviour, permissions, invariants — database
  fields and invariants themselves are still never invented. Three of the four differences in this
  picture sit outside the grant.
- **CAL-08's behaviour inside the header strip.** `week-day-holiday`, `week-day-bridge`,
  `data-day-status` and `data-bridge` are rendered per day (`WeekView.tsx:344-390`) and asserted by
  `tests/e2e/cal-08-holiday-shading.spec.ts`. The image's header is a weekday and a date and nothing
  else, and it shows no holiday week at all.
- **`.ai/registry/invariants.md:33-39`, checked rather than assumed.** All seven rows constrain
  `entry` rows. None governs the appearance of a screen; the two that reach this work reach it through
  the count (INV-04) and the portion (INV-06), which is why both appear above under behaviour rather
  than under layout.

## Out of scope

- **Deciding any of the four differences.** They are stated, not settled, and three of them are
  registry matters that an idea may not resolve.
- **The sidebar and the top bar.** The operator said *lịch tuần*, and UIE-02 and UIE-03 shipped that
  chrome two days ago. The picture also draws it, and the following parts of the picture are
  explicitly **not** covered here: the `Quá tải (>50%)` legend row — a **fourth** row against the
  three at `Sidebar.tsx:68-70`, needing the team read and `overloadThreshold` that CAL-05's row and
  `WeekView.tsx:11-17` refuse, which is the same registry matter as the footer count and was already
  deferred once by UIE-02; the `▾` after the period title; the palette and sign-out icon buttons; the
  `Quản trị & Duyệt` pill; and the floating `?` button.
- **The month view and the year view.** Whatever is decided about a chip or a header here does not
  travel to them by implication, and CAL-04's month cell is where the absence count already lives.
- **Vietnamese copy.** Out on the same terms UIE-01 scoped it out: it reverses § *Language*, it is
  lint-enforced, and `copyDebt` only ever shrinks.
- **Making the fixtures match the picture's roster of eight.** `src/lib/fixtures.ts` is § *Language*'s
  permanent `userContent` exception and is not this idea's to grow.
- **Filling `§ Colour` and `§ Type` in `.ai/standards/ui-design-system.md`.** Still `TODO(project)`
  stubs, still human plane under RULE-01, and UIE-01's row already records that the product's de-facto
  palette now lives in `src/index.css` with no standard behind it.

### What the image does not show — carried from § 5 of the transcription, because silence is not removal

Every one of these exists on screen today, and a screen rebuilt from the transcription alone would
drop shipped behaviour that spec files assert:

a week with more than two chips on a day; a full or overflowing column; an overloaded day; a holiday
or a bridge day in a column header; the tentative treatment; a note; hover, focus or active states;
any width narrower than desktop; dark mode; and what the footer count does when a day holds a half-day
entry.

Two of those are worth naming twice. **The narrow width is UIE-04's shipped stacked layout below
1280px** — the product's first breakpoint, originated by that ticket — and the image says nothing
about it. **The holiday header and the bridge badge are CAL-08's**, and the transcription's header
strip has no room drawn for either.

## Open questions

Real ones. A verdict turns on the first three.

1. **Does the operator want an absence count on this screen — and if so, of what?** The picture says
   `n/8 vắng`. Answering yes reverses CAL-05's registry row and needs an amendment under RULE-01, it
   needs the team read this screen deliberately does not make, and it must not become INV-04's second
   definition. The picture's own denominator does not exist in this repository. And the picture is
   silent on the case that decides the whole question: what the number reads on a day holding a
   half-day entry. **A count that disagrees with the month grid for the same date is worse than no
   count.**
2. **What happens to a viewport-height column when the day has more content than fits?** The picture
   asserts that nothing scrolls, from a week holding two chips. Every answer costs something already
   decided: per-column scrolling reverses UIE-04's stated argument, a compressed chip reverses four of
   CAL-05's acceptance criteria, and leaving the pane to scroll makes the picture's own claim untrue
   on any week that is actually busy. **Nobody can answer this from the image, because the image does
   not contain the case.**
3. **Is the operator asking for arrangement, or for arrangement plus the three reversals it carries?**
   The most likely reading is that they attached a picture for how it looks and not for its copy, its
   chip contents or its footer — and that is still a guess. It is one question with three parts and it
   decides whether this is a restyle, an amendment to two registry rows, or something between.
4. **Was the picture drawn against the screen as it stands, or against the one before it?** UIE-04
   shipped hours ago, in PR #66. If the image predates it, part of what it asks for — seven equal
   columns, the grid itself — is already delivered, and the request narrows sharply. If it postdates
   it, the operator has seen the seven columns and is asking for something else about them.
5. **Is the short header form (`T2 30/03`) meant to carry CAL-08's holiday name and bridge badge, and
   how?** The image shows neither, and the badge is the thing a 161px column has least room for.
   Dropping it reverses CAL-08's decision that a bridge day is a working day.
6. **Does the per-day `Everybody is in.` line go?** The image's empty body shows nothing at all. That
   line is an explicit state today (`WeekView.tsx:393-396`) and CAL-05 AC-13's *seven sections,
   always* is why a quiet day is drawn at all — *"a week that hid its quiet days would make 'nobody is
   away on Sunday' and 'Sunday is missing' the same screen."*
7. **Will the image be attached to the repository, or does this proceed on a transcription?** There is
   no file to move. Under the second reading the specification is prose written by an agent about a
   picture nobody can reopen — which is a different thing from an image the operator supplied, and
   `.ai/standards/ui-design-system.md:140-150` then places the layout under the Tech Lead's grant,
   **with the obligation that `01-plan.md` § 2b says so in a line.**

---

# Triage verdict — PROMOTE

**Written by `product` at `/triage` on 2026-09-07, in a second dispatch, after `tech-lead-design`'s
technical read of the same request.** The sections above are the problem as it was written before any
verdict existed; nothing in them was edited to fit what follows.

## 0. This file was split, and the verdict below rules on one half of it

**The gate is exactly one verdict per idea file.** The technical read recommended three outcomes at
once — promote the layout, take the footer count to an ADR, reject the rest — and three outcomes on
one file is not a verdict, it is a summary. Rounding it to a single PROMOTE would have smuggled a
registry reversal through a restyle; rounding it to a single NEEDS-ADR would have held a clean layout
change hostage to a decision only the operator can take. Both are worse than doing the honest thing.

**So the file was split, because its own title names two problems and they turned out to be two.**

| Half | Where it now lives | Verdict |
|---|---|---|
| *A busy week does not fit on the screen* — § *Problem* items 1, 3 and 4 | **this file** | **PROMOTE**, below |
| *A day does not say how full it is* — § *Problem* item 2 | `.ai/board/ideas/2026-09-07-a-day-does-not-say-how-full-it-is.md` | **NEEDS-ADR**, with [ADR-029](../../registry/decisions/ADR-029-the-week-view-renders-a-per-day-absence-count.md) drafted there |

**They are separable in fact and not only on paper.** UIE-05 ships and the screen looks like the
picture minus one strip along the bottom of each column; the second idea adds that strip. Neither
needs the other to be coherent, and only the second needs a human.

**Nothing above this line was deleted or rewritten**, per `CLAUDE.md` § *Working agreements*. § *Problem*
item 2 still stands where it was written — the second idea file quotes it rather than moving it, and
says so. **The filename still names both problems and was not changed**, because renaming is deleting,
and this paragraph is cheaper than a lost reference.

## 1. The verdict, and the reason

**PROMOTE.** The operator looked at the screen UIE-04 shipped hours earlier and drew a different one.
The half of that picture that is arrangement — how a column uses the height it is given, how its
header strip reads, and how an entry chip is stacked inside 161px — is inside the grant
`.ai/standards/ui-design-system.md:140-155` gives `tech-lead-design`, reverses no invariant, needs no
registry amendment, and answers a real defect that is already written down in the file it governs:
`WeekView.tsx:39-46`'s own arithmetic says a busy Wednesday pushes the rest of the week below the
fold while four-fifths of every quiet column is white space.

**It is promoted as `UIE-05`** — `.ai/registry/features.md`, `## UIE`, `Status: PLANNED`, citing this
filename in `Notes`. The ticket shell is `.ai/board/tickets/UIE-05/ticket.yaml` and the transcription
is at `.ai/board/tickets/UIE-05/design/README.md`.

## 2. What is promoted

Five things, all of them arrangement:

1. **Columns fill the viewport on a quiet week.** Equal height is *already shipped* — the technical
   read's finding, and it is the one that most changes the size of this ticket: the seven columns are
   one CSS grid row with the default `align-items: stretch` and no height set, so half of the image's
   headline property is on screen today. What is missing is only *filling* the pane, and the answer is
   **`min-height`, not `height`**.
2. **The header strip**: centred, a hairline beneath it, and the date in the image's shorter numeric
   form.
3. **The chip's silhouette**: the image's two-line stack with a circular avatar bubble, and the star
   moved up beside the name — **keeping all five of the facts the chip carries today** (§ 4).
4. **The empty column body is de-emphasised, and the sentence stays** (§ 4).
5. **The card radius**, which is a token value rather than a layout.

**No size is recorded here and none is implied.** The technical read proposes S; `size_estimate` is
Definition of Ready item 5 and belongs to `tech-lead-design` at PLAN, so the field is left empty and
the recommendation is not repeated in the shell. Same for `invariants_touched`, item 2.

## 3. What is rejected, said to the operator plainly rather than deferred in silence

**These are refusals, not deferrals. Nothing downstream will pick them up.**

- **Vietnamese interface copy — `T2`/`CN`, `vắng`, and every other string in the picture.** It
  reverses `.ai/standards/ui-design-system.md:46-48`, which is **the operator's own instruction of
  2026-09-03** (*"tôi muốn tất cả content đều là tiếng anh"*); it is lint-enforced at
  `eslint.config.js:84-92`; `copyDebt` is empty in `ui-language.json:21` and that list only ever
  shrinks, with adding a file back named in the file as *the* failure mode; and UIE-01 already refused
  the identical request for the identical reason. If the operator wants a Vietnamese interface, that
  is its own request with an ADR superseding § *Language*, product-wide, and not a property of the
  week grid. **`Mon 30/03` is available and is layout** — but abbreviating the weekday costs a
  two-line edit to `tests/e2e/cal-05-week-view.spec.ts:145-146`, which asserts `Monday` and `Sunday`;
  PLAN may authorise that and must name it, and keeping the full weekday name costs nothing.
- **The chip's four deletions — the portion pill, the note, the word `Tentative`, and
  `Approved by <name>`.** Each is a shipped CAL-05 acceptance criterion with assertions behind it, and
  each is load-bearing rather than decorative: the portion pill is the product's **only** rendering of
  INV-06; `Tentative` is what the dashed border says for a reader who cannot see a border; and
  `Approved by <name>` **is** CAL-05's registry row — `approved_by` is the only audit trail v1 has and
  an admin may approve their own entry, so a bare star answers *somebody* where the product's whole
  answer is *who*. UIE-04 refused exactly this as *"an acceptance-criterion amendment wearing a
  layout's clothes"*, and refused it even behind an expand, where the information still existed.
- **`Leave` / `Working from home` collapsed to `PTO` / `WFH`.** The one that looks like typography and
  is not. OPS-002 AC-7 requires every screen naming an entry's type to state that a WFH member is
  working; `src/lib/labels.ts:21-29` records the choice deliberately. A bare code states nothing.
- **The sidebar's `Quá tải (>50%)` legend row, the `Quản trị & Duyệt` pill, the `▾` after the period
  title, the palette and sign-out icon buttons, and the floating `?`.** Out on the operator's own word
  — they said *lịch tuần* — and the legend row is additionally still blocked on what blocked it at
  UIE-02: it needs `overloadThreshold` from a `seam.getTeam()` call the shell does not make, and a
  legend row for a colour no calendar view draws is a legend that lies.
- **Making the fixtures match the picture's roster of eight.** `src/lib/fixtures.ts` holds **four**
  unremoved members of the main team (`:39`, `:72`, `:149`, `:319`). The `8` is fictional and nothing
  may be asserted from it.

## 4. Where I disagree with the technical read

It is a recommendation and it does not bind this verdict. Three departures, each with its reason:

- **§ 2d's "cheaper answer" for the empty column body — replace the sentence with a dash or a muted
  glyph — is refused.** The technical read is right that the footer count and the empty state are
  coupled and must not be decided independently, and then proposes a change to the empty state while
  the count is undecided. A dash conveys nothing; it makes *an ordinary Tuesday* and *we did not look*
  the same column, which is the exact loss CAL-05 AC-13 and UIE-04 AC-10 were written against.
  **`week-day-empty` keeps its element, its selector and its sentence in UIE-05, and may only be
  de-emphasised — smaller, lighter, muted.** If ADR-029 is accepted, `0/4` removes the ambiguity and
  deleting the sentence becomes defensible; that is decided there, with the count, and not here.
- **`size: S` is not recorded.** See § 2.
- **The technical read's ticket A says "no test edited" and its § 2e says abbreviating the weekday is
  a two-line spec edit a plan may authorise.** Those cannot both be true. The shell states the
  conditional rather than the conclusion: `tests/e2e/cal-05-week-view.spec.ts` enters `allowed_paths`
  **only if** PLAN abbreviates, and PLAN says which it did.

Everything else in the technical read is adopted, including the two claims the dispatching session
verified against source — `absenceCountsFor(entries, range, roster)` (`src/lib/data/absence.ts:197`)
and `currentMemberCount(roster)` (`:348`) take no team and no threshold, and `WeekView` already holds
`roster` and `entries` at `src/routes/WeekView.tsx:207`. Those two decide the other idea, not this one.

## 5. Findings carried into the ticket, because PLAN would otherwise lose them

Each is in `.ai/board/tickets/UIE-05/ticket.yaml` in full; they are listed here so the verdict and the
shell cannot drift apart.

1. **Roughly half the image's headline property is already shipped** (§ 2 item 1). A plan that does not
   know this rewrites working code to arrive where it already is.
2. **The plan must state that it reverses UIE-04 § 4.2's prose, and why** — `min-height` is not
   `height`, so AC-4 (every entry reachable by scrolling the page, no column scrollbar, nothing
   clipped) and AC-5 (the seven stay in horizontal register) are both satisfied while the columns fill
   a quiet week. UIE-04's three rejected alternatives are untouched: seven independent scrollers are
   still refused, and chip compression is still refused.
3. **The middle path for the chip** — restack into the image's two-line shape and demote the portion,
   the tentative marker, the approver and the note to a secondary line at reduced weight. It keeps all
   five facts and reproduces the image's silhouette. **It will be two or three lines tall, not 44px:
   44px and five facts are not simultaneously satisfiable**, and the plan says which it chose.
4. **`TODO(verify)`: whether a percentage `min-height` resolves through this exact `flex-1` /
   `min-h-0` chain**, or needs an explicit `calc(...)`. It needs a rendered viewport, which triage has
   no way to produce, and it does not change the conclusion.
5. **Silence is not removal.** Five things the image omits that the screen draws today and that must
   survive: the holiday name `week-day-holiday` with its `data-kind`, the bridge badge
   `week-day-bridge`, the lavender heading tint, the tentative dashed border, and the empty-week
   mascot card. `tests/e2e/cal-08-holiday-shading.spec.ts:287-298` pins the first three.

## 6. One finding about the image that belongs to nobody's ticket, recorded so it is not read as a specification

**The picture's sidebar shows eight members carrying five different team subtitles** — Core
Engineering, Frontend Team, Backend Team, QA / Testing, Design / Product. That contradicts **INV-07**
(one member belongs to exactly one team) *and* the charter's one-team scope. **It is not a restyle; it
is a different product.** The sidebar is out of this request's scope entirely, so nothing here acts on
it — but whoever next opens this transcription must not read those five subtitles as a requirement.
It is repeated in `.ai/board/tickets/UIE-05/design/README.md`, which is where a later reader will
actually be standing.

## 7. Provenance and what this verdict did not do

- **No image is on disk.** The operator's image was shown in conversation. What exists is a hand
  transcription written for this triage, now at the canonical path
  `.ai/board/tickets/UIE-05/design/README.md` — the same handling UIE-02 and UIE-04 took, and labelled
  there as evidence of intent rather than as a specification.
- **An image is attached at exactly one stage** (`.ai/standards/ui-design-system.md:103-123`). It was
  attached here. **`/plan` must not be handed a second one.**
- **No acceptance criterion was written**, no size or invariant recorded, and no ADR accepted in this
  file. The ADR belongs to the other half and is `PROPOSED` there.
- **Nothing is committed.** The row, the shell and the backlog entry travel with the ticket and reach
  the operator under CODEOWNERS at `/ship` — ADR-023.
