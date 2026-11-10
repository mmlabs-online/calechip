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
  - .ai/registry/features.md
  - src/App.tsx
  - src/index.css
  - src/routes/Home.tsx
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - src/routes/YearView.tsx
  - src/routes/Holidays.tsx
  - src/routes/EditEntry.tsx
  - src/routes/TeamEntries.tsx
  - src/routes/Threshold.tsx
  - src/routes/MemberList.tsx
  - src/routes/AllowList.tsx
  - src/routes/SignIn.tsx
  - ui-language.json
  - .ai/board/ideas/2026-09-05-the-first-screen-does-not-look-like-the-product.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# The product has no shell, and every screen starts over

## Problem

**CaleChip has no application chrome. There is no sidebar, no top bar, no navigation of any kind that
survives a route change — every screen paints a full page from nothing and then has to invent its own
way back.** `src/App.tsx:35` wraps the whole router in one bare
`<main data-testid="app-root" className="min-h-screen bg-slate-50 p-8 font-sans">`. Inside it are
fourteen route components and eighteen `<Route>` elements, and nothing is rendered outside `<Routes>`
except a mock-seam banner (`:41-50`) and a session-loading notice (`:55-62`). There is no persistent
element anywhere in the tree that a person can use to get from one screen to another.

**What stands in for navigation is the landing screen, and it is a list of underlined text links.**
`src/routes/Home.tsx` offers `home-allow-list-link` (`:75`), `home-team-entries-link` (`:93`),
`home-new-entry-link` (`:108`), `home-week-link` (`:127`), `home-year-link` (`:142`),
`home-holidays-link` (`:166`) and `home-threshold-link` (`:182`). That is the whole of it. **Two
shipped screens are linked from nowhere at all** — `/members` (TEA-03) and `/month` (CAL-04) appear in
no `to=` anywhere under `src/`, so the month grid, which `.ai/registry/features.md` describes as
*brief 7.1's default view*, is reachable only by typing its address. `src/App.tsx:109-111` records
`/members` as *"reachable by address only"* as a deliberate choice.

**Because nothing is persistent, every screen re-implements the same two things: a way home and a way
to the next period.** The way home is `week-home` (`WeekView.tsx:278`), `month-home`
(`MonthView.tsx:332`), `year-home` (`YearView.tsx:330`), `holidays-back` (`Holidays.tsx:470`),
`team-entries-back` (`TeamEntries.tsx:307`), `threshold-back` three times over
(`Threshold.tsx:170`, `:193`, `:276`), and `edit-entry-back` twice pointing at `/entries/new` rather
than at `/` (`EditEntry.tsx:121`, `:206`). The way to the next period is `week-prev` / `week-next`
(`WeekView.tsx:286`, `:292`), `month-prev` / `month-next` (`MonthView.tsx:338`, `:344`),
`year-prev` / `year-next` (`YearView.tsx:336`, `:342`) and `holidays-prev` / `holidays-next`
(`Holidays.tsx:272`, `:282`) — four separate implementations of *previous, next* on four screens.

> **Line numbers into `WeekView.tsx`, `MonthView.tsx` and `YearView.tsx` were re-measured throughout
> this file by `product` on 2026-09-05**, after `CAL-08` merged (PR #56) and rewrote all three. They
> were stale by 28–35 lines and **did not move by a uniform offset**. `Holidays.tsx`, `App.tsx`,
> `TeamEntries.tsx`, `Threshold.tsx`, `EditEntry.tsx` and `Home.tsx` were untouched by that ticket
> and every citation into them is unchanged. **No claim in this section changed** — the eleven
> back-links and eight period controls are still there, still per-screen, and still the problem.

**Two screens have no way out at all.** `src/routes/MemberList.tsx` and `src/routes/AllowList.tsx`
contain no `Link` and no `to=` — zero matches in either file. A person who reaches the member list or
the allow-list has the browser's back button and nothing else on the page.

**And there is no way to move between the three calendar views without going through the landing
screen.** The one exception is `week-year` (`WeekView.tsx:312`), a single link in a single direction.
The month view cannot reach the week view, the year view cannot reach either, and nothing reaches the
month view from anywhere. All three already anchor on the URL — `/week/:day`, `/month/:month`,
`/year/:year` (`src/App.tsx:169-200`) — so the addresses a view switcher would need already exist and
are already the mechanism by which *switching views keeps the date* was specified for CAL-04.

**The operator has said what they want instead, in an attachment, and the attachment is not in the
repository.** Their request, verbatim: *"chnage the layout UI of the app like this"*. One image was
shown in conversation; it is not on disk and cannot be opened. What stands in for it is the
transcription under *Evidence*, which is the only description of it that exists anywhere. That image
shows a two-pane shell — a persistent sidebar and a persistent top bar — with the week view living
inside it. **It also shows three things this product cannot do yet and asserts several things the
repository has already decided otherwise**, and those are recorded under *Constraints already known*
and left there rather than resolved.

## Who has it

- **Every member, on every screen except the landing screen, every time they use the product.**
  There are thirteen such screens. Each one is a dead end that offers a link home and, on four of
  them, a link to the same screen one period away.
- **Every member who wants to look at a different view of the same week.** Going from the week grid
  to the month grid is: press *home*, then press *Month* — except there is no *Month* link on the
  landing screen, so it is press *home*, then type `/month` into the address bar.
- **Every admin reaching the two admin screens with no exit.** `/allow-list` and `/members` are the
  two screens with no link on them, and both are admin surfaces (`src/App.tsx:100-111`).
- **Anybody who is shown the product.** The first screen after sign-in is a column of underlined text
  links on `bg-slate-50`. `CLAUDE.md` § *Visual direction* describes a pastel, rounded product with a
  dense grid at its centre; the screen that introduces it is a list.
- **Every future ticket that adds a screen.** ADM-04, ADM-05 and ADM-06 are all `PLANNED` in
  `.ai/registry/features.md`. Each will land somewhere, and with no shell each one either adds a
  fifteenth text link to `Home.tsx` or is reachable only by address, which is how `/members` and
  `/month` already ended up unreachable. ~~CAL-08~~ **was named here as a fourth and is struck:** it
  merged in PR #56 on 2026-09-05 and is `DONE`. **It did not add a screen at all** — it drew
  holidays into three screens that already existed, so it is the one of the four that would never
  have needed an entry point. The three that remain are exactly the three that would.

## Evidence

Read in this tree today, not inferred.

**No image file is in the repository.** One screenshot was attached in conversation and it is not on
disk; nothing was written to `.ai/board/ideas/` or to any ticket's `design/` folder for this idea.
**The transcription below stands in for it and is the only description of it that exists.** This is
the same situation as `2026-09-05-the-first-screen-does-not-look-like-the-product.md`, which produced
`UIE-01`, and it is handled the same way: the transcription is reproduced here verbatim and in full,
because until it is written down the entire specification lives in a conversation, and a conversation
is not an artifact (RULE-14, RULE-16).

That matters for what happens next. `.ai/standards/ui-design-system.md:110-113` says a triage-time
image lives in the idea's `Evidence` section and moves to `.ai/board/tickets/<ID>/design/` on
PROMOTE. **There is no file here to move.** A later reader cannot check any statement below against
the picture it came from.

### The screenshot, transcribed — one screen, the week view inside an application shell

**Overall.** A full-bleed two-pane desktop layout on a very pale lavender ground. No page margin —
the panes reach every edge. Roughly 1:6 split.

**Left sidebar**, ~215px wide, white or near-white, full height, no visible border — separated from
the grid by colour alone.

- At the top, the brand lockup: `Ai Nghỉ?` in a heavy rounded face, deep indigo, ~20px, and beneath
  it in ~11px muted grey-purple, `Lịch vắng mặt team`.
- Then a section label `TEAM (8)` — uppercase, ~10px, letter-spaced, muted.
- Then eight roster rows, one per member: a ~26px circular pale-lavender avatar chip holding an
  animal emoji, then the display name at ~13px in a muted indigo. The rows read `Min (Bạn)`, `Huy`,
  `Trâm`, `Đạt`, `Ngọc`, `Khoa`, `Linh`, `Bảo`. The first is the signed-in person and is marked
  `(Bạn)` — *you*. No role badges, no counts, no controls on the rows.
- A large empty gap, so the next block is pinned to the bottom.
- A legend card: a rounded pale-lavender panel holding four rows, each a small filled dot then a
  label at ~11px — `Nghỉ phép (PTO)` peach, `Làm ở nhà (WFH)` mint, `Ngày lễ` lavender,
  `Quá tải (>50%)` pink.
- At the very bottom, a footer row: the same circular avatar chip, then `Min` at ~12px with `ADMIN`
  beneath it in ~9px uppercase letter-spaced muted text, then pushed to the right two small outline
  icon buttons — a painter's palette and a sign-out arrow.

**Top bar**, spanning the grid pane only, not the sidebar, ~70px tall, on the lavender ground with no
card behind it.

- Left cluster: a `‹` chevron button, then `01/12 – 07/12, 2025` at ~17px semibold deep indigo with a
  small `▾` after it, then a `›` chevron button, then a pill-shaped outline button `Hôm nay`.
- Right cluster: a segmented control — one pale-lavender rounded track holding three equal segments
  `Tuần` / `Tháng` / `Năm`, with `Tuần` active as a white inset pill with a soft shadow. Then a
  separate pill-shaped outline button `Duyệt phép`. Then a solid deep-indigo pill button
  `+ Đăng ký`.

**The grid pane.** Seven equal columns filling the remaining width, each a tall white rounded card
(~16px radius) with a very soft shadow, separated by ~8px gutters, running from just under the top
bar to just above the bottom of the viewport.

- Each column has a header strip: a bold `T2`…`T7`, `CN` immediately followed by a lighter
  `01/12`…`07/12`, centred.
- Each column has a footer strip in a small monospace-looking grey: `0/8 vắng`.
- The bodies are empty in this screenshot. **One card floats over the fourth column (`T5 04/12`),
  vertically centred in the pane and not inside a column:** a small white rounded card with a soft
  shadow, holding a mouse emoji at left, then two lines — `Chưa ai đăng ký tuần này.` in ~13px deep
  indigo, and beneath it `+ Đăng ký ngay` in ~12px peach, as a link.
- A small circular `?` button floats at the bottom-right corner of the viewport.

### What the image does not show

Any screen other than the week view; the month and year views behind their segments; a week that
actually has entries in it, so nothing about how an entry chip looks, how a column behaves when full,
or what an overloaded day looks like; hover, focus and active states; the sidebar at any narrower
width, or whether it collapses; what the `▾` after the date range opens; what the palette icon does;
what the `?` button opens; any error or loading state; and dark mode.

### What the transcription settles, and what makes it worth acting on

- **Three of the four things in the top bar are navigation the product already needs and does not
  have.** The `‹` / `›` chevrons and `Hôm nay` are the per-screen period controls that four screens
  each re-implement today. The `Tuần` / `Tháng` / `Năm` segments are movement between `/week/:day`,
  `/month/:month` and `/year/:year`, three addresses that already exist (`src/App.tsx:169-200`) and
  that today are connected by exactly one link in one direction (`WeekView.tsx:312`).
- **The sidebar is where the two unreachable screens would become reachable.** The roster block is
  the content of `/members` (TEA-03), which nothing links to; the legend names holidays, which is
  CAL-08 — **`DONE` since PR #56 on 2026-09-05, so that legend row names a colour that is now
  drawn**; the top bar names an approval worklist, which is ADM-04 and is still `PLANNED`.
- **It is the same brand lockup the auth mockup carried**, and the same one the Figma prototype
  carries: `Ai Nghỉ?` over the subtitle `Lịch vắng mặt team`, in a heavy rounded face. That is not a
  new invention arriving with this request, and it is already recorded in
  `2026-09-05-the-first-screen-does-not-look-like-the-product.md`.
- **The colours in the legend are the four `CLAUDE.md` § *Visual direction* already names** — peach
  PTO, mint WFH, lavender holidays, soft pink overload — so the legend card is that paragraph drawn
  on screen rather than a new palette.
- **This is the third mockup in a row whose copy is Vietnamese**, against a standard that says the
  interface is English. Recorded under *Constraints already known* rather than here.

## Impact if ignored

**Two shipped screens stay unreachable and a third stays reachable by one link in one direction.**
`/members` shipped as TEA-03 and `/month` shipped as CAL-04, both `DONE`, and neither has an entry
point anywhere in the product. A feature that reached `DONE` and cannot be opened is indistinguishable
from one that was never built.

**Every new screen makes it worse in a fixed way.** ADM-04, ADM-05 and ADM-06 are `PLANNED`
(~~and CAL-08~~ — struck 2026-09-05, it merged in PR #56 and added no screen). With no shell, each
one's plan has to decide independently where its entry point goes, and the only place available is
another underlined link in `Home.tsx` — which is already fourteen lines of them and is the screen the
operator is asking to replace.

**The per-screen chrome keeps multiplying, and it is already eleven back-links and eight period
controls.** Each is a separate `data-testid`, a separate assertion in the end-to-end suites, and a
separate thing to restyle. Every one of them is work that a shell would do once.

**The two screens with no exit stay that way.** `MemberList.tsx` and `AllowList.tsx` have no link in
them at all, so the only way off either is the browser's back button — which, for somebody who
arrived by typing the address, goes nowhere.

**The attachment decays first.** It exists only in a conversation. When this idea is judged, or
planned, or implemented, the person doing it will have the transcription above and nothing to check it
against — and `.ai/standards/ui-design-system.md:125-138` already says an image binds nothing by
itself and that *"looks like the screenshot" is not an acceptance criterion*. A transcription of an
image nobody can reopen is weaker than that again.

**The four contradictions below get resolved silently, in whichever direction is convenient at the
moment somebody meets them** — most likely inside an implementation, where nobody is looking for a
decision.

## Constraints already known

Cited, not chosen. Each bounds what an eventual ticket may do.

- **`CLAUDE.md` § *Visual direction* carries the tension this idea cannot resolve and must not hide:**
  *"The calendar grid is the most-used screen and information density wins there every time. Charm
  belongs in the empty states, the mascots and the approval moment; it never costs a row in the year
  view."* The screenshot shows an empty week — seven very tall cards and a mascot card floating over
  them — which is the charm half. **It does not show a week with entries in it**, which is where
  density is decided, and it shows no month or year view at all.
- **`UIE-01` is `PLANNED` and lands in the same files.**
  `.ai/registry/features.md:149` — *Restyle the sign-in and sign-up screens to the product's visual
  direction*. It introduces the product's first `@theme` tokens and its first webfont in
  `src/index.css`, which today is one line, `@import "tailwindcss"`, and it changes the ground colour
  at `src/App.tsx:35`. This idea depends on that work having a token vocabulary to build on and
  collides with it in both files.
- **`.ai/standards/ui-design-system.md` § *Direction*, § *Colour*, § *Type* and § *Components* are
  still `TODO(project)` stubs** (`:9`, `:14`, `:18`, `:23`, `:27`). There is no palette, no type
  scale and no component vocabulary in the standards plane for a shell to be specified against. That
  file is human plane under RULE-01 and is not this idea's to fill.
- **`.ai/standards/ui-design-system.md:101-138` — § *Visual specification*.** An image is attached at
  exactly one stage, `/triage` or `/plan`, never both; a triage-time image moves to
  `.ai/board/tickets/<ID>/design/` on PROMOTE; no stage downstream reopens it; there is no visual
  check anywhere in the loop. **Here there is no file to move at all.**
- **The selector contract.** Every back-link, period control and view link named under *Problem* is a
  `data-testid` addressed by the end-to-end suites. Definition of Done item 3 requires all four verify
  commands to exit 0, so anything that moves those controls into a shell either keeps the names on
  the equivalent controls or moves the suites with them.
- **TEA-05's plan put a navigation menu out of scope.** `src/routes/SignIn.tsx:110-115` records it in
  the tree: *"01-plan.md section 1 puts a navigation menu out of scope and says 'nothing else
  navigates'"*. **That is the decision this idea reopens**, and `UIE-01` already reopens a corner of
  it for the segmented control between `/signin` and `/signup`.
- **`src/App.tsx:35` names `data-testid="app-root"` as fixed.** The comment at `:3-6` says it keeps
  its name *and its position on the element wrapping `<Routes>`* so that `tests/e2e/smoke.spec.ts`
  keeps passing without being edited — and that file is deliberately absent from every
  `allowed_paths`. A shell that wraps `<Routes>` meets that constraint directly.

### The four things the mockup asserts that the tree contradicts

**Stated, not resolved.** Each already exists as a decision in this repository, and none of them is a
layout question. They are named here so the verdict has to meet them.

1. **The copy is Vietnamese; § *Language* says the interface is English.**
   `.ai/standards/ui-design-system.md:46-48` quotes the operator's instruction of 2026-09-03 — *"tôi
   muốn tất cả content đều là tiếng anh"* — enforced by a `no-restricted-syntax` rule in
   `eslint.config.js` and by `tests/ui-language.test.ts`, both reading `ui-language.json`. That file's
   `copyDebt` holds five entries (`:20-26`) and its own comment says the list *"only ever SHRINKS"*
   and that *"adding a file here is the failure mode"* (`:10-13`). Every string in the transcription
   is Vietnamese: `Ai Nghỉ?`, `Lịch vắng mặt team`, `TEAM (8)`, `Nghỉ phép (PTO)`, `Làm ở nhà (WFH)`,
   `Ngày lễ`, `Quá tải (>50%)`, `Hôm nay`, `Tuần`, `Tháng`, `Năm`, `Duyệt phép`, `+ Đăng ký`,
   `0/8 vắng`, `Chưa ai đăng ký tuần này.`, `+ Đăng ký ngay`, `(Bạn)`. **This is the third mockup in a
   row to do so.**

2. **`Duyệt phép` names a screen that does not exist.** The approval worklist is `ADM-04`, and
   `ADM-05` and `ADM-06` are the decisions taken on it — all three `PLANNED` in
   `.ai/registry/features.md:115-117`. No route is registered in `src/App.tsx` and no component
   exists. A shell that carries that button carries a link to nothing.

3. ~~**`Ngày lễ` in the legend names something the calendar views do not draw.** Holidays and bridge
   days inside the calendar views is `CAL-08`, `PLANNED` (`.ai/registry/features.md:104`). `/holidays`
   exists as its own screen — `ADM-02` and `ADM-03`, both `DONE` — but nothing renders a holiday into
   the week, month or year grid, so a legend row for it describes a colour that never appears.~~

   **NO LONGER A CONTRADICTION. Struck on 2026-09-05, later the same day, and kept so the deferral it
   caused stays legible.** `CAL-08` merged in PR #56 and is `DONE`. Holidays and bridge days **are**
   drawn in all three calendar views, and the file this section's reasoning rested on now says the
   opposite of what was quoted from it — `src/routes/WeekView.tsx:28-29` reads *"Holidays are
   lavender, and CAL-08 draws them HERE — the sentence this replaces said they were not drawn on this
   screen"*. **So the mockup's `Ngày lễ` legend row asserts nothing the tree denies, and it moved out
   of the deferred fourth piece and into `UIE-02`'s scope.** See *The fourth piece* below and
   `.ai/board/tickets/UIE-02/ticket.yaml` § 9.3. **Three contradictions remain, not four**, and the
   verdict below is unchanged in every other respect. **One thing `CAL-08` did NOT settle:** the
   label is still Vietnamese and contradiction 1 still governs it.

4. **The palette icon corresponds to nothing decided anywhere.** The nearest thing is the `Vui`/`Gọn`
   density toggle named in `CLAUDE.md` § *Visual direction*, which points at
   `.ai/standards/ui-design-system.md` for the details — and that file's § *Direction* and
   § *Components* are both bare `TODO(project)` stubs (`:14`, `:27`). So the toggle is named in one
   file and specified in none, and whether the icon is that toggle is a guess.

**A fifth, which is duplication rather than contradiction.** The sidebar roster is the content of
`/members`, which `TEA-03` shipped as its own screen (`src/routes/MemberList.tsx`), and the footer
sign-out is `home-sign-out` (`src/routes/Home.tsx:189`). Both would exist in two places at once unless
something decides otherwise.

## Out of scope

- **Deciding any of the four contradictions above.** They are named, not settled. Two of them name
  features that are `PLANNED` and unbuilt, one reverses a standing operator instruction, and one has
  no decision behind it in either direction.
- **Building `ADM-04`, `ADM-05` or `ADM-06`.** They have rows of their own and the mockup's
  references to them do not make them this idea's. (~~`CAL-08`~~ was named here too and is struck: it
  shipped on 2026-09-05 in PR #56, so there is nothing left of it for this idea to build.)
- **Amending `.ai/standards/ui-design-system.md`** — filling § *Direction*, § *Colour*, § *Type* or
  § *Components*, or writing the mockup's measurements into them. Human plane, RULE-01.
- **Amending `ui-language.json`.** Adding a file to `copyDebt` is what that file calls the failure
  mode (`:10-13`).
- **Everything the image does not show, restated so it cannot be absorbed:** the month and year views,
  a week with entries in it, the appearance of an entry chip, a full or overloaded column, hover,
  focus and active states, the sidebar at any narrower width, the `▾` behind the date range, the
  palette icon's behaviour, the `?` button's behaviour, error and loading states, and dark mode.
  **All of these exist on screen today or are specified by a shipped ticket, and the image is silent
  about them. Silence is not removal.**
- **Redesigning the interior of any screen.** This idea is about what surrounds the routes. What the
  week grid draws inside a column is CAL-05's and is already shipped.
- **Adding a font, a component library or an icon package.** The mockup implies a rounded face and
  outline icons; `src/index.css` loads neither. That is recorded above as a fact, not proposed here,
  and `UIE-01` already holds the font question. Anything reaching for a dependency is an ADR.

## Open questions

The ones a verdict turns on and that I could not settle from the repository.

1. **Is the shell one layout component wrapping the routes, or a change to every screen?** One
   component rendered outside `<Routes>` touches `src/App.tsx` and adds files; changing every screen
   touches thirteen route files and every end-to-end suite that addresses them. The comment at
   `src/App.tsx:3-6` constrains one of those answers and not the other.

2. **Does the sidebar roster replace `/members`, or duplicate it?** `TEA-03` shipped `MemberList.tsx`
   as a screen with acceptance criteria; the mockup shows the roster permanently on screen with no
   role badges and no controls. If it replaces the screen, a shipped feature's surface disappears; if
   it duplicates it, the same list is rendered twice by two components with two sets of selectors.

3. **Does the landing screen survive at all once a shell exists, and if it does, what is on it?**
   `Home.tsx` is fourteen links and a sign-out; a shell absorbs most of them. `/` is also where
   `src/App.tsx:87-98` routes every membership state and where eleven back-links point, so it cannot
   simply be deleted. What renders there afterwards is undecided.

4. **What happens to the eleven per-screen back-links and the eight period controls?** They carry
   `data-testid`s that shipped suites assert on. Removed, kept, or reparented into the top bar are
   three different answers with three different costs to the tests, and `edit-entry-back` is a
   further case because it points at `/entries/new` rather than at `/`.

5. **Which of the four contradictions does the operator actually intend?** They may have attached a
   picture for its layout and not for its copy, and may have drawn `Duyệt phép` and `Ngày lễ` as
   where those features will go rather than as things to build now. That is the most likely reading
   and it is still a guess.

6. **Does this wait for `UIE-01`, or land beside it?** `UIE-01` is `PLANNED`, introduces the first
   `@theme` tokens and the first webfont in `src/index.css`, and changes `src/App.tsx:35` — the exact
   line a shell replaces. Two tickets editing the same two lines is the collision; which order they
   run in is not mine to decide.

7. **Where does the image live, given that no image is on disk?** § *Visual specification* is built on
   a file at `.ai/board/tickets/<ID>/design/`. There is none. Either the operator attaches the file so
   it can be committed, or this proceeds on the transcription above and says so — and the second
   reading makes the transcription the specification, written by an agent, which is a different thing
   from an image the operator supplied. `UIE-01` already took the second path.

8. **What does the shell do below desktop width?** The transcription describes one viewport with a
   fixed ~215px sidebar and seven equal columns, and says nothing about narrower. Nothing shipped so
   far states a responsive baseline either — `.ai/standards/ui-design-system.md:165` is a
   `TODO(project)` for exactly that.

## Triage verdict — 2026-09-05

**PROMOTE, into three feature rows and three tickets — `UIE-02`, `UIE-03` and `UIE-04` — plus a
fourth piece that is deliberately not created.** All three rows are in the `UIE` group, `Status:
PLANNED`, `Invariants touched: []`, each citing this file by name. No ADR is owed by this triage: the
group was created by [ADR-028](../../registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md) and
the boundary test in it puts all three at step 3 — the deliverable is how an existing surface looks,
more than one output would be acceptable, and somebody has to look at the result and judge it.

`product` and `tech-lead-design` triaged this on 2026-09-05. **The technical half of the assessment
is not reproduced here.** Every `file:line` it carries was verified in this tree and it is written
into the three ticket shells, which is where the stage that consumes it will look:
`.ai/board/tickets/UIE-02/ticket.yaml`, `.ai/board/tickets/UIE-03/ticket.yaml` and
`.ai/board/tickets/UIE-04/ticket.yaml`. What follows is only the part a reader of this idea needs.

### Why three rows and not one

**The whole mockup is nineteen files. `.ai/01-operating-model.md:374` sizes more than twelve as L,
and `:374` also says L must split at PLAN.** Splitting it here means no ticket is ever L and PLAN
never has to do it. The cut is by surface, which is the first cut `:381` names, and each of the three
leaves an application that renders and can be exercised end to end — not a half-built shell behind a
flag.

**Under ADR-028 a `UIE` row is a surface statement, not a capability.** `UIE-01` already is one — *the
sign-in and sign-up screens look like the product*. Three surfaces is therefore three rows, and
filing three tickets against one row would have made that row mean three different finished states at
three different times.

**This triage sizes nothing.** `size_estimate` is left exactly as the template ships it in all three
shells. Choosing the scope boundary is triage's under ADR-010; choosing the size is Definition of
Ready item 5 and belongs to `tech-lead-design` at PLAN.

### The three rows

| ID | Title | Depends on | What it is |
|---|---|---|---|
| `UIE-02` | The application shell — a persistent sidebar and top bar | `UIE-01` | Build the shell. All eleven `home-*` selectors move into it and `Home.tsx` is deleted. The four period screens keep their own headers, so **the app looks doubled for one ticket**. Zero spec files touched. |
| `UIE-03` | The calendar screens give up their own chrome to the shell | `UIE-02` | Remove the twenty-two duplicated elements from the week, month, year and holidays screens. **The only one of the three that touches tests**, and only to delete navigation steps. Ends with the app matching the mockup's shell. **Amended 2026-09-05: six spec files, not five** — `tests/e2e/cal-08-holiday-shading.spec.ts` shipped with `CAL-08` and addresses two of the four dying ids. |
| `UIE-04` | The week view as seven day columns | `UIE-03` | The grid itself. Carries the density defect below, which is a design decision that may not survive contact with a full week. |

**Order is strictly sequential: `UIE-01` → `UIE-02` → `UIE-03` → `UIE-04`.** Not a preference. One
working directory holds one branch (ADR-006), so exactly one of these is ever in flight, and each one
edits the files the one before it created — the shell has to exist before the screens can give their
chrome up to it, and the chrome has to be gone before the grid inside it is rewritten. Each shell says
so in its own `depends_on`, and each of those three dependencies **fails Definition of Ready item 3
today, on purpose**, because item 3 requires every named ticket to be DONE and none of them is.

### The fourth piece — named, and deliberately NOT promoted

**AMENDED 2026-09-05, later the same day, after `CAL-08` merged (PR #56) and this branch was rebased
onto it. The piece is now three things, not four.** The `Ngày lễ` legend row left it — see the struck
bullet below. Nothing else in this section changed, and no row was created for anything: the
amendment moves work into a ticket that already exists.

**`Duyệt phép`, the palette icon and the `?` button are not in any of the three tickets and have no
row of their own.** They are the parts of the mockup that point at something that does not exist, and
a promoted feature with nothing to build is worse than no row — it reads, to everyone downstream, as
work that was specified and skipped.

What each is waiting on:

- **`Duyệt phép`** waits on **ADM-04**, and behind it **ADM-05** and **ADM-06**, all three `PLANNED`
  and all three carrying an empty `allowed_paths`. There is no route, no screen and no policy. A
  disabled control would assert *this capability exists and is unavailable to you*, which is false —
  it exists for nobody. **Ship it absent, not disabled.** The ticket that ships ADM-04 adds the
  button beside the screen it opens, which is how every nav item on this shell arrived in the first
  place: seven links in `Home.tsx`, seven tickets, one each.
- ~~**The `Ngày lễ` legend row** waits on **CAL-08**, `PLANNED`. `WeekView.tsx:27` records that
  holidays are lavender and are deliberately not drawn, because CAL-05's row forbids inheriting them.
  A legend row for a colour that never appears beside it is a legend that lies. CAL-08 adds the
  swatch in the ticket that adds the colour.~~

  **THE DEFERRAL IS WITHDRAWN. The `Ngày lễ` legend row is in `UIE-02`'s scope and waits on nothing.**
  Struck rather than deleted, so a reader can see the deferral was made, on what evidence, and what
  overtook it — the same treatment ADR-027's withdrawal banner and the `OPS-003` → `UIE-01`
  correction in `.ai/board/backlog.md` were given.

  **What overtook it, measured after the rebase.** `CAL-08` merged in PR #56 and is `DONE`. It
  rewrote `src/routes/WeekView.tsx`, `MonthView.tsx` and `YearView.tsx` and added
  `src/lib/data/day-status.ts`. **The argument was never that the colour is unimportant — it was
  *a legend row for a colour that never appears beside it is a legend that lies*. The colour now
  appears.** The proof is the same file the deferral cited, whose comment now says the opposite of
  what was quoted from it (`WeekView.tsx:28-29`): *"Holidays are lavender, and CAL-08 draws them HERE
  — the sentence this replaces said they were not drawn on this screen"*. So the legend stops lying
  by **gaining** the row, and omitting it now would be the misleading omission instead: a lavender day
  heading on the grid with nothing in the legend naming it. `UIE-02` builds the sidebar, so the row is
  `UIE-02`'s, and its `ticket.yaml` § 9.3 carries the withdrawal in full.

  **One dot, not two.** Lavender means *not working* and tints the day heading only; a bridge day gets
  no lavender at all — it is a working day carrying an outlined badge (`WeekView.tsx:31`,
  `WeekView.tsx:362`). A second swatch for bridge days would name a fill that does not exist.

  **Separately, and still not the same thing:** the holidays *screen* exists (ADM-02 and ADM-03, both
  DONE), so the sidebar nav item pointing at it stays. **Nav item yes — and now legend row yes too,
  for a different reason from the nav item's.**

  **This does not reach `Quá tải (>50%)`, which was never part of this piece and is scoped out of all
  three tickets for its own reason.** It needs `overloadThreshold`, from the `getTeam()` call
  `WeekView.tsx:11` still refuses — re-read in the rebased file rather than assumed. `CAL-08` brought
  a colour for holidays and brought no threshold, no team read and no overload state with it.
- **The palette icon** waits on **an operator decision that nobody has taken in either direction.**
  Two readings and no evidence between them: the `Vui`/`Gọn` density toggle, or a theme switcher.
  Against density — `CLAUDE.md` § *Visual direction* puts Vui/Gọn on the calendar grid, and a control
  in a global sidebar footer beside sign-out is not a grid control. Against theme —
  `.ai/standards/ui-design-system.md:14` and `:18` are bare stubs, so there is no second theme to
  switch to, and `UIE-01` § 4.5 already scopes dark mode out. The § *Visual specification* carve-out
  grants the **visual arrangement** and explicitly not behaviour, and what a control *does* is
  behaviour. So this is `CLAUDE.md` § *No invention*: an open question, shipped absent.
- **The `?` button** waits on the same kind of nothing: **no help content exists anywhere in this
  repository.**

**A row will be written for these when there is something for it to point at**, and the ticket that
brings the capability is the ticket that brings its control. Nothing here is refused; ~~all four~~
**the remaining three** are deferred, and this paragraph is the record of the deferral. **The fourth
stopped being deferred on 2026-09-05** — see the struck bullet above — and it needed no new row,
because the ticket that brings the control already existed.

### What this verdict does not settle, and did not try to

The eight open questions above are answered by the technical half only where a ticket had to be
bounded — 1 (a layout route, not a wrapper), 3 (`Home.tsx` does not survive), 4 (the eleven `home-*`
ids relocate, four Class-B ids die) and 6 (this waits on `UIE-01`, which ships first and is not
merged into it). **Question 2 is answered by omission and the answer is *duplicate, for now*:** the
sidebar roster and the member-list screen both stand, because removing a shipped screen is not a
restyle. **Questions 5, 7 and 8 are not settled by anything here** — the operator's intent behind the
four contradictions, the absence of any image on disk, and the responsive baseline. The first is why
the fourth piece is deferred rather than built; the second is why each ticket carries a transcription
in `design/` rather than a picture; the third is the recommendation in `UIE-04`'s shell that PLAN
must choose from rather than inherit.
