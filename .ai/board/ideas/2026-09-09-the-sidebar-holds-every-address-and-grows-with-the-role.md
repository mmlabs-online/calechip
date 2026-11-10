---
stage: TRIAGE
agent: product
produced_at: 2026-09-09
inputs_read:
  - .ai/steward/context.md
  - CLAUDE.md
  - .ai/00-charter.md
  - .ai/templates/idea.md
  - .ai/standards/ui-design-system.md
  - .ai/registry/features.md
  - src/components/Sidebar.tsx
  - src/components/TopBar.tsx
  - src/lib/period.ts
  - src/App.tsx
  - tests/e2e/adm-01-threshold.spec.ts
  - tests/e2e/adm-02-holidays.spec.ts
  - tests/e2e/adm-04-worklist.spec.ts
  - tests/e2e/adm-05-approve-reject.spec.ts
  - tests/e2e/cal-03-admin-edit-entry.spec.ts
  - tests/e2e/tea-05-sign-in.spec.ts
  - scripts/check-docs.mjs
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# The sidebar holds every address and grows with the role

**No verdict is written here.** This file is step 0 of `/triage` — the problem, written before it is
judged, in a session that has not yet done the technical assessment. The verdict, and any registry
row that follows one, are written in the second half and not in this file.

**No feature ID appears anywhere below.** An idea has none.

## Problem

**The sidebar is the only map this product has, and it is a flat list of every address the caller is
permitted to reach — so its length is a function of the caller's role rather than of the work in
front of them.** A member sees three destinations; an admin sees seven, the four extra ones appended
to the same list in the same weight and the same type size as the calendar
(`src/components/Sidebar.tsx:201-250`, the role condition at `:127` and `:218`). The pane is a fixed
216px column present on every screen (`:134-137`).

Three things follow from that one shape, and each is a separate cost:

**1. The two roles do not see one product with one extra power; they see two differently-shaped
products.** The charter is explicit that the difference between member and admin is *narrow on
purpose* (`.ai/00-charter.md:70`). In the navigation it is the widest thing on the screen: more than
double the destinations, in the pane every screen renders. Nothing in the sidebar distinguishes *the
calendar I open every morning* from *the threshold I set once* — `When a day counts as crowded` and
`This week` are the same control drawn the same way.

**2. Administrative addresses hold permanent space in front of the screen the product exists for.**
`CLAUDE.md` § *Visual direction* states the rule this bumps into: *the calendar grid is the most-used
screen and information density wins there every time.* Four of an admin's seven links are addresses
visited when something needs deciding or configuring — pending decisions, the team's entries, allowed
addresses, the crowding threshold — and they are on screen while the admin is reading a calendar,
where they compete for the pane's height with the roster and the legend.

**3. The calendar's own navigation is in two places at once, and neither is complete.** The top bar
already owns period movement: previous, anchor, next, `Today`, and a Week/Month/Year switcher
(`src/components/TopBar.tsx:89-167`). On a period route the sidebar's `This week` and `The year` sit
beside a switcher that offers the same two destinations plus a third the sidebar never offered —
`/month` has no sidebar link at all. But the switcher is rendered only where `periodNavFor` returns
non-null (`src/lib/period.ts:290-335`, the `return null` at `:315`), so on `/allow-list`,
`/threshold`, `/entries/*` and `/holidays` the top bar renders nothing but `+ Book`
(`src/components/TopBar.tsx:85-88`) and those same sidebar links are the *only* way back to a
calendar. **So the duplication and the sole route are the same two links, on different screens** —
which is why "the top bar already does this" is a true observation and not, by itself, an answer.

**The operator's request, verbatim, 2026-09-09:**

> change layout of left side bar, Remove all the link to admin page in sidebar. Add one 1 button to
> access admin function in top bar

**That request is one candidate answer to the problem above, and it is written here as a request
rather than as the problem.** Removing the four admin links, restructuring the pane and adding a
single admin control to the top bar is a shape that addresses all three costs at once. It is not the
only shape: the links could be grouped and de-emphasised rather than removed; the two redundant
general links could go while the admin ones stay; the admin addresses could collapse into one screen
rather than one button; or the pane could be reorganised with no address moving anywhere. **Which of
those is right is not decided in this file**, and the reachability question that the operator's shape
raises — four addresses behind one control — is an open question below rather than an answered one.

## Who has it

- **Every admin, on every screen, every session.** The seven-item list is rendered on all fourteen
  routes inside the shell (`src/components/Sidebar.tsx:98-100`). There is no screen on which an admin
  sees a member's sidebar, and no state in which the four administrative links are collapsed, folded
  or moved out of the way.
- **Every member, on every screen, every session** — for cost 3 only. A member's three links are
  `This week`, `The year` and `Public holidays`, two of which restate the switcher wherever the
  switcher is drawn.
- **The operator, who is an admin and is the person who raised it.** This idea exists because they
  looked at the shipped sidebar and described a different one; that is the only report there is.
- **Nobody has filed a support request, because the product has no users outside this repository.**
  Stated so the rows above are not read as a volume.

## Evidence

Every claim below was read on disk during this triage. The two measurements are counted, not
recalled.

**1. The nav block, and the role condition.** `src/components/Sidebar.tsx:201-250` renders one
`<nav>` holding seven `Link`s. Three are unconditional — `home-week-link` to `/week`,
`home-year-link` to `/year`, `home-holidays-link` to `/holidays` (`:202-214`). Four are inside a
single `isAdmin ?` branch (`:218-249`): `home-pending-entries-link` to `/entries/pending`,
`home-team-entries-link` to `/entries/team`, `home-allow-list-link` to `/allow-list`,
`home-threshold-link` to `/threshold`. `isAdmin` is `member.role === "admin"` (`:127`).

**2. The seven ids are referenced 41 times across 12 spec files under `tests/e2e/`.** Measured this
run. The distribution matters more than the total, because the two kinds of reference have different
costs:

- **Nine are `.click()` steps that reach an admin screen through the sidebar** — `adm-01:54`,
  `adm-01:104`, `adm-04:139`, `adm-05:112`, `adm-05:119`, `adm-06:123`, `cal-03:114`, `cal-07:126`,
  `cal-08:363`. For those specs the sidebar link is the route into the feature under test, not the
  thing under test.
- **Six are `toHaveCount(0)` assertions that a member does *not* see an admin affordance** —
  `tests/e2e/adm-01-threshold.spec.ts:206`, `tests/e2e/tea-05-sign-in.spec.ts:156`,
  `tests/e2e/cal-03-admin-edit-entry.spec.ts:302` and `:487`,
  `tests/e2e/adm-04-worklist.spec.ts:319` and `:335`. **An assertion that a named node is absent
  passes vacuously once the name no longer exists anywhere.** These six are the only shipped
  statements that a member is not offered the admin surface, and they are written against these ids.

**3. One shipped acceptance criterion is about a sidebar link by name, and it is not an admin one.**
`tests/e2e/adm-02-holidays.spec.ts:291-302` — *"AC-15: the link is offered to both roles"* — asserts
`home-holidays-link` visible for an admin and visible for a member, with the reason in the file at
`:298-299`: *"Unlike `home-allow-list-link`, `home-team-entries-link` and `home-threshold-link`, this
one carries no role condition — the permission behind it carries no role predicate either."* The
transcription's sidebar contains no holidays link.

**4. A control has already moved between these two components once, and the move is recorded.**
UIE-02 relocated twelve `home-*` ids out of the deleted `src/routes/Home.tsx`; eleven went to the
sidebar and the twelfth, `home-new-entry-link`, went to the top bar
(`src/components/Sidebar.tsx:1-19`, `src/components/TopBar.tsx:169-178`). The binding constraint it
worked under is written in the file: *unrenamed and exactly once*.

**5. There is a written argument against a second control pointing at an admin address, and an
eventual solution has to answer it.** `src/components/TopBar.tsx:174-178`, UIE-02 AC-20: *"No `Duyệt
phép` button beside it: the approval worklist shipped with its own link, `home-pending-entries-link`,
and that link is in the sidebar. A second control to one address would either duplicate an id — the
strict-mode failure AC-6 exists to prevent — or give the product two names for one screen."* That
reasoning was written when the sidebar link was staying. It is the closest thing on disk to a
decision about the control the operator is now asking for.

**6. The sidebar is already not a complete index of the product's addresses.** `/members` is a route
(`src/App.tsx:221`) and `grep` finds no `Link` to it anywhere in `src/` — the only occurrences are
the route line and three comments. `/month` is a route (`:301-302`) reachable from the switcher and
from no sidebar link. So *"remove a link"* and *"remove an address"* are already different acts in
this codebase, and two addresses already live in the second state.

**7. Hiding a link refuses nobody, and the four admin screens each refuse on their own.**
`src/components/Sidebar.tsx:10-15`: *"NOTHING HERE IS A CONTROL. Every element is an affordance over
a row-level-security policy that already exists and is not touched"* — a member who types any of the
four addresses reaches the screen and is refused by it (`allow-list-refused`, `team-entries-refused`,
`threshold-refused`, `pending-entries-refused`). So everything in this idea is about **discovery**,
never about permission, and no invariant or policy is engaged by any answer to it.

**8. The eight shipped UI tickets are all `DONE`.** `.ai/registry/features.md:150-157` carries
UIE-01 through UIE-08; every one is `DONE` as measured this run. UIE-02 built this shell, UIE-03
deleted the screens' own chrome into it. There is no in-flight UI work whose shape this would
disturb, and no half-built pane.

**Visual reference: a hand transcription, at**
`/private/tmp/claude-503/-Users-mpa-Downloads-aifw-template/5cb10495-b7ea-4fa5-a30f-1899e7d63b4b/scratchpad/design-transcription.md`
**— and it is evidence of intent, not a reference, because there is no image beside it and never
was.** The operator pasted a screenshot into this `/triage` conversation; a pasted image arrives as
conversation content, the harness writes no temporary copy, and no role in this loop can write image
bytes, so what exists is prose written by hand by the only session that saw the picture. **A later
reader cannot check a single sentence of it against the thing it describes.** This is `MD-030` and
the `CORRECTION 2026-09-09` block in `.ai/standards/ui-design-system.md` § *Visual specification*,
which says to read the image row as: *an image specifies a UI only if it is on disk at
`.ai/board/tickets/<ID>/design/`, and today the only party who can put it there is the operator.*
Because it is a scratchpad path outside the repository, it is also not durable — it does not survive
this session, which is a second reason it cannot be the specification for anything.

What the transcription states about the two panes, recorded because it is what makes the request
concrete: the sidebar contains **no navigation links of any kind** — not the four admin ones, and not
`This week`, `The year` or `Public holidays` either; the top bar's right cluster is the
Week/Month/Year switcher, then an outline pill reading `Quản trị & Duyệt`, then the primary
`+ Đăng ký`, and it carries **no `Today` control**. It also shows a great deal the request does not
mention, listed under *Out of scope* below.

**9. Every string in the picture is Vietnamese, and the interface is English.** The operator's own
instruction of 2026-09-03 made it so, it is lint-enforced, and the `copyDebt` list only ever shrinks
(`.ai/standards/ui-design-system.md` § *Language*). The transcription reaches the same reading UIE-01
recorded: the picture's copy is a rendering of the operator's own language, not a request to
translate the interface.

## Impact if ignored

**The gap between what a member sees and what an admin sees keeps widening, one feature at a time.**
Every admin capability shipped so far has arrived as a seventh, sixth, fifth line in the same list —
that is the only place the shell offers to put one. The next admin feature makes it eight, and
nothing in the current shape argues against it.

**The pane that is supposed to answer *who is on the team* is increasingly a list of addresses.** The
roster scrolls inside a fixed-height column (`src/components/Sidebar.tsx:136`) that also holds a
brand, a tagline, seven links, a legend and an account footer. The charter's target team is five to
thirty people (`.ai/00-charter.md:30`); at thirty, the roster is the thing that gets squeezed, and it
is squeezed hardest for the admin who has four extra links.

**The calendar keeps two navigation systems that disagree about which periods exist.** The sidebar
offers week and year; the switcher offers week, month and year; and which of the two is on screen
depends on the route. A person who learns the product from the sidebar never learns `/month` exists
except by clicking the switcher.

**The administrative surface has no name.** There are four addresses, no page that lists them and no
word in the interface for the set — so there is nothing to point a new admin at, and nothing for a
future admin feature to belong to.

**And every day this stands, more specs are written against the shape.** Forty-one references across
twelve spec files today, nine of which use a sidebar link as the way into a feature that is not about
the sidebar. That number has only ever grown.

## Constraints already known

Cited, not chosen. Each bounds what any answer may do.

- **`CLAUDE.md` § *Visual direction*.** *Charm belongs in the empty states, the mascots and the
  approval moment; it never costs a row in the year view.* Anything that takes height from the
  calendar pane argues against this line.
- **The charter's two roles, and the narrowness of the difference** (`.ai/00-charter.md:70-75`).
  Member and admin, with the admin's extra powers enumerated there. No third role exists to design a
  third navigation for.
- **ADR-005 and `src/components/Sidebar.tsx:10-15` — navigation is affordance, never control.**
  Authorization is row-level security; every one of the four admin screens refuses on its own. No
  answer here may be described as restricting anything, and none of them changes who can reach what.
- **UIE-02's rule for relocated selectors: *unrenamed and exactly once*** (`src/components/Sidebar.tsx:1-8`,
  `src/components/TopBar.tsx:169-178`). It is what kept fifteen spec files passing when twelve ids
  moved between components, and it is the shipped precedent for any id that moves again.
- **UIE-02 AC-20, quoted in evidence item 5.** A second control to one address duplicates an id or
  gives the product two names for one screen. Whatever a single admin control turns out to be, it has
  to be reconciled with that sentence rather than around it.
- **ADM-02 AC-15** (`tests/e2e/adm-02-holidays.spec.ts:291-302`). `home-holidays-link` is offered to
  both roles, because the permission behind it carries no role predicate. It is a shipped criterion
  and the transcription's sidebar does not contain it.
- **The six `toHaveCount(0)` member-side assertions**, listed in evidence item 2. They are the only
  shipped statements that a member is not offered the admin surface, and they are keyed to ids.
- **`.ai/standards/ui-design-system.md` § *Selectors*.** A control added without a `data-testid`
  cannot be exercised at all.
- **`.ai/standards/ui-design-system.md` § *Visual specification*, as corrected 2026-09-09.** An image
  binds nothing by itself; no stage downstream reopens it; and there is no image here — only a
  transcription on a scratchpad path, which cannot be moved into a ticket by any role in this loop.
- **§ *Language*.** The interface is English. The transcription's Vietnamese strings are not a
  translation request.
- **RULE-02 and the seam** (`.ai/standards/architecture.md`). Nothing in this idea is a data-access
  change, and any answer that starts needing one has left the problem stated here.
- **RULE-01, and `.ai/registry/features.md` as the only source of feature IDs** (`CLAUDE.md`). **This
  idea carries no ID and issues none.**

## Out of scope

Written now, because the transcription contains far more than the request does and everything
adjacent to a shell looks like the same work.

- **Everything in the picture that the request does not mention.** The transcription describes five
  collapsible roster groups with count pills (`CORE ENGINEERING`, `FRONTEND TEAM`, `BACKEND TEAM`,
  `QA / TESTING`, `DESIGN / PRODUCT`), a per-member role line under each name, a fourth legend row
  for overload, a palette icon in the account footer, a year anchor drawn as a dropdown, the removal
  of the `Today` control, and an unlabelled floating keyboard button. **None of those is in the
  operator's instruction, and this idea states none of them as a problem.** Each would need its own
  statement of what is wrong today, and two of them are more than cosmetic: sub-teams inside one
  team's roster touch the charter's *"One team of five to thirty people"* (`.ai/00-charter.md:30`)
  and the deferred multi-team item, and an overload legend row was deliberately omitted from the
  shipped legend because no view computes an overload state yet
  (`src/components/Sidebar.tsx:59-66`).
- **Translating the interface.** § *Language*, and evidence item 9.
- **Who may do what.** No permission, policy, invariant or refusal changes. Evidence item 7.
- **The four admin screens themselves.** `/entries/pending`, `/entries/team`, `/allow-list` and
  `/threshold` keep their content, their behaviour and their own refusals whatever happens to the
  links that point at them.
- **Merging the four admin screens into one.** It is one available shape and it is a different, much
  larger problem — four screens' worth of acceptance criteria — and no part of the request asks for
  it. Named in the open questions instead.
- **`/members` and `/month` having no link.** True (evidence item 6), pre-existing, and not what the
  operator raised. Cited here only because it proves links and addresses are already separable.
- **The `Today` control.** The picture omits it; the request does not mention it; AC-13 shipped it
  (`src/components/TopBar.tsx:132-140`). Removing a shipped control is not something the absence of a
  drawing decides.
- **The 216px width, the colours and the type.** UIE-08 finished repainting the last calendar surface
  onto the product's semantic tokens. Nothing here is a token change.

## Open questions

Answers are owed before this can be triaged, and one of them is owed before any ticket could be
sized. None is answered here.

1. **Behind one control, how does an admin reach the other three addresses?** This is the question
   the operator's shape raises and the one the idea must name without answering. Four addresses,
   one button: the button leads to a menu, or to a hub screen listing the four, or to one of the four
   with the rest reachable from it, or three of the four stop being separately addressable. These are
   materially different products with different acceptance criteria, and only the last one loses a
   bookmarkable address.
2. **Does anything argue that the four are one thing?** They are *decide* (pending entries), *see and
   correct* (the team's entries), *admit* (allowed addresses) and *configure* (the threshold). The
   picture's pill reads `Quản trị & Duyệt` — administration *and* approval — which is itself two
   words for a reason. If they are not one thing, one control naming them is a name the product does
   not have yet.
3. **What happens to the six `toHaveCount(0)` assertions?** They assert a member does not see an
   admin affordance, keyed to ids that a single control would retire. Vacuous green is the failure
   mode, and *"which node asserts it instead"* has to be answered by whoever writes the criteria —
   not discovered at review.
4. **Do the three general links go too?** The request says *"remove all the link to admin page"*; the
   picture removes every link. Those are different instructions and the difference is load-bearing:
   on non-period routes the sidebar links are the only way back to a calendar (`src/lib/period.ts:315`,
   `src/components/TopBar.tsx:85-88`), and ADM-02 AC-15 requires the holidays link to be offered to
   both roles.
5. **Is the top bar the right home for an admin control at all?** It is the pane that already changes
   shape by route — the whole left cluster and the switcher vanish where there is no period. Adding a
   control that must be present everywhere to a bar whose contents are conditional is a decision, not
   a detail.
6. **Is the sidebar's real problem the links, or that it has no structure?** Brand, roster, nav,
   spacer, legend, account is six unlabelled regions in one column. *"Change the layout"* is the first
   half of the request and it is the half with no picture-independent statement of what is wrong —
   this idea states the navigation cost and does not claim to have stated a layout cost.
7. **Does any of this need an image on disk, and can one exist?** § *Visual specification* says an
   image binds nothing by itself and that the Tech Lead originates the layout when none is attached.
   Here something in between is true: a transcription exists, it is on a scratchpad path that does not
   survive this session, and it cannot be moved into a ticket by any role. Whether an eventual plan
   treats the layout as *specified*, as *the Tech Lead's own* — which carries the obligation to mark
   it as such in § 2b — or asks the operator to put a file on disk, is open and it is not decidable
   from this file.
8. **How much of the 41-reference surface is a specification and how much is convenience?** Nine
   clicks use a sidebar link as the route into a feature that is not about the sidebar. Whether those
   specs should navigate by address instead is a testing decision that changes the size of any answer
   considerably.
9. **Do the roster's five sub-groups happen, and is a sub-group ever a counting unit? DEFERRED, not
   dropped — added when the verdict below was written.** The picture divides the eight members into
   `CORE ENGINEERING`, `FRONTEND TEAM`, `BACKEND TEAM`, `QA / TESTING` and `DESIGN / PRODUCT`, each
   with a count pill and a collapse chevron. **There is no column anywhere that groups members within
   a team**: `public.member` carries `id`, `team_id`, `display_name`, `avatar`, `role`, `removed_at`,
   `created_at` (`supabase/migrations/20260831150024_tea01_membership.sql:31`,
   `.ai/standards/data-model.md:33-41`), and no later migration adds one. So it is a migration, which
   makes it `XL` by the sizing table and a human's under RULE-09. **The question that has to be
   decided before the column exists is not the column**: INV-07 scopes counting to the team
   (`.ai/registry/invariants.md:39`), and a count pill on every group header is one question away from
   a threshold per group — which would give INV-04 a second arithmetic. *Is a sub-group ever a
   counting unit?* is the ADR, and it is nobody's sidebar ticket. Recorded here so a later reader
   finds it deferred with its reason rather than absent.

---

# Verdict — PROMOTE, as two rows: `UIE-09` then `UIE-10`

**Decided 2026-09-09 by `product`, on the technical half `tech-lead-design` returned in the same run
(RULE-11; recorded in `consulted:` above).** The problem above was written first, without a verdict,
before that assessment was read. **Nothing in it is rewritten here** — where this half corrects it,
the correction is stated by name below.

**The reason, in one sentence:** the four administrative addresses gain a place of their own that is
an address rather than a control, so the sidebar can stop being the product's whole map without any
address becoming unreachable — and nothing in it changes a table, a policy, a grant or an envelope
some ADR already closed.

## 1. Why `UIE`, and why two rows rather than one

**ADR-028's four-step test, applied in its own order** (`ADR-028:61-83`). The first step that answers
*yes* decides the prefix.

**Step 1 — does something written down say what this surface should be, and does the surface not
match it? No.** Nothing in the registry, the standards or any plan says the sidebar should not carry
administrative links. UIE-02 AC-8 says the opposite — the four links are shown to an admin — and the
surface matches it exactly. There is no contradiction to point at, so this is not `BUG-nnn`. **The
operator is changing what the product should be, which is a different act from a surface failing to
be what it was told to be**, and it is the act the whole loop exists to serve.

**Step 2 — could the product do something afterwards that it could not do before? No, and this is
the step most easily got wrong here.** Every one of the five addresses the hub lists already exists,
is already routed, and is already reachable by typing it. `/members` is the tempting case — it has no
link anywhere in the product (evidence item 6) — but a member list an admin reaches by typing is a
capability the product *has*; what it lacks is a way to find it. **Discovery is not capability**, and
reading it the other way would make every navigation change a `CAL`, `ADM` or `TEA` row and empty the
`UIE` group of its purpose. Recorded because step 2 is broad enough to swallow anything if it is
waved through.

**Step 3 — is the deliverable the appearance or interaction of a surface that already exists, such
that more than one output would be acceptable and somebody has to look at the result and judge it?
Yes.** Two competent people would produce visibly different hub screens and visibly different
sidebars, and both could be right. That is ADR-028's distinguishing question in its usable form
(`:81-83`). `UIE` — and step 4 is not reached.

**Two rows, split at TRIAGE and not at PLAN.** As one ticket it is 14 files and therefore `L`, which
the sizing table says must split (`.ai/01-operating-model.md:373`). It is split here rather than at
PLAN because **MD-017 records that no command owns a ticket shell created by a split at DESIGN, so a
ticket that splits loses half of itself silently**; `product` may issue both rows under ADR-007 and
both shells under ADR-010, so the defect never gets its chance.

**The split is forced by strict mode rather than chosen for tidiness.** UIE-02 AC-6 requires every
`home-*` id to resolve to exactly one node, and Playwright fails a click matching two — so the four
ids cannot exist in the sidebar and on the hub at the same time. The hub must exist before the
sidebar gives them up. **`UIE-10` `depends_on: [UIE-09]`**, and that is a mechanism, not a preference.

**What the split buys, and it is the reason to prefer it over any other cut:** `UIE-09` is entirely
additive — the sidebar is untouched, so all 30 executable assertions stay green — and **every unit of
risk in this work is in `UIE-10`, in one reviewable place, where a reviewer can read it as one
sentence: *this is the migration*.**

## 2. The cost, stated here because it is the thing a reviewer must not discover late

**This work amends acceptance criteria that five `DONE` tickets shipped, and no available shape
avoids it.** `tech-lead-design` measured the surface independently of my own count and classified the
41 references line by line: **11 are comments and 30 are executable, across 11 executing spec files;
13 of the 30 are navigation and 17 are visibility.** The two fail differently and only one is cheap.

- **The 13 navigation assertions are repairable by inserting one step** — reach the hub, then click
  the link that is now on it. The four `home-*-link` ids can relocate **unrenamed**, exactly as
  UIE-02 relocated eleven ids letter for letter, so no id in that group changes.
- **The 17 visibility assertions cannot be repaired, because each of them *is* a shipped acceptance
  criterion written as a test.** Positive `toBeVisible()` at `adm-01:53,103,199`, `adm-02:84,293,301`,
  `adm-03:59`, `adm-04:411`, `cal-03:476`, `tea-05:147`; negative `toHaveCount(0)` at `adm-01:206`,
  `adm-04:319,335`, `cal-03:302,487`, `tea-05:156`; plus `adm-04:415`, a text assertion. Named, they
  are **ADM-01 AC-10**, **ADM-02 AC-15**, **ADM-04 AC-9**, **CAL-03 AC-10**, TEA-05's visibility pair,
  and in the plan plane **UIE-02 AC-6 and AC-8**.
- **My own two findings from the first half hold and are the same phenomenon seen from two ends.**
  ADM-02 AC-15 asserts `home-holidays-link` by name for both roles — which is what makes decision 1
  below non-optional rather than conservative. And the six `toHaveCount(0)` assertions **pass
  vacuously the moment the ids they name stop existing**: they are the only shipped statements that a
  member is not offered the admin surface, and an assertion that a named node is absent is satisfied
  by the name never having existed. A reviewer who sees six green assertions after this ships is
  seeing nothing.
- **UIE-02's relocation trick does not save this one.** It worked because the relocated ids stayed
  visible from every route. Any shape that puts them behind a control — a menu or a second address —
  makes them absent from the route the spec is standing on. **No shape preserves the 17 except
  leaving the links where they are**, which is what the request forbids.

**That is not a reason to refuse the request — the operator is entitled to change the product — but
it must be decided knowingly.** It is written into both `Notes` rows for that reason: `Notes` is
where a marker means a human has to look, and a chat message evaporates.

## 3. The three scope decisions, recorded as taken

### Decision 1 — where the operator's words and the picture differ, the words govern. The three general links stay.

The request names the **admin** links. The transcription shows a sidebar with **no navigation links
at all** (§ *What the sidebar does NOT contain*). Those are two different tickets, and the difference
is not cosmetic.

**Two facts make the picture's version unbuildable as written**, both verified on disk:

- **The top bar is not a substitute off the period routes.** `periodNavFor` returns `null` when the
  second path segment is absent or unrecognised (`src/lib/period.ts:315`), and `TopBar.tsx:89` and
  `:150` gate the entire left cluster **and** the entire Week/Month/Year switcher on `nav !== null`.
  So on `/allow-list`, `/members`, `/holidays`, `/threshold`, `/entries/new`, `/entries/:id/edit`,
  `/entries/team` and `/entries/pending` there is no switcher, no anchor and no `Today` at all. On the
  three of those with no back-link of their own — `/allow-list`, `/members`, `/holidays` — the
  sidebar's week and year links are the only route to a calendar. **They are redundant on the six
  period routes and load-bearing everywhere else**, which is why *"the top bar already does this"* is
  a true observation that is not an answer.
- **`/holidays` would be stranded.** It is linked from exactly one place in the entire product
  (`src/components/Sidebar.tsx:209`); the screen itself only links to other years. And the one admin
  button could not adopt it, because `/holidays` is **not** an admin address — it is guarded on a
  session and not a role, on the ground that `holiday_select_all` is `using (true)`, and **ADM-02
  AC-15 asserts the link is offered to both roles** (`tests/e2e/adm-02-holidays.spec.ts:291-302`).
  Moving it behind an admin control would break a shipped criterion and take the national holiday
  calendar away from every member.

**So `home-week-link`, `home-year-link` and `home-holidays-link` stay.** This answers the idea's open
question 4. Emptying the nav block entirely remains available as its own idea, and it owes a second
answer for `/holidays` before it can be one.

### Decision 2 — the shape is a hub screen at `/admin`, not a menu on the button.

This answers the idea's open question 1, which was the reachability question the first half named and
refused to answer.

- **It matches the picture at the level the picture can be trusted.** The transcription describes an
  **outline pill with no caret**, the same shape as `shell-period-today` (`TopBar.tsx:134-140`); the
  only `▾` in the picture is on the `2026` anchor. A menu is a disclosure control and would carry one.
- **It is an address**, so it is bookmarkable, shareable and survives a reload — the property this
  product already leans on everywhere (*"the period IS the address"*, `TopBar.tsx:91-93`).
- **It absorbs `/members`**, closing a hole that predates the request: today the screen carrying the
  two most destructive controls in the product, remove a member and promote to admin, is reachable
  only by typing.
- **The member case needs nothing invented.** `/admin` guards on `member` and refuses in-screen, which
  is exactly what `/threshold`, `/entries/team` and `/entries/pending` each already do and each
  already explain. Six precedents, one shape.
- **It reverses no decision.** `.ai/board/tickets/ADM-01/01-plan.md:194-197` records the
  own-screen-per-setting choice as *"an assumption that ships"* whose reversal *"moves one route and
  one link"*. A hub adds a route **above** the four and moves none of them: `/threshold` stays
  `/threshold`. Under ADR-008's test — decide inside an existing envelope, ask before changing it —
  this is inside.

**A menu was rejected for a reason that is about this repository rather than about taste.** It would
invent open-on-click-or-hover, close-on-Escape, close-on-outside-click, focus and `role="menu"`
semantics against `.ai/standards/ui-design-system.md` § *Components*, which is a bare
`TODO(project)` — so the first menu in this product would be a component-library decision taken
inside a UI ticket. And it saves nothing: all 17 visibility assertions still fail and all 13
navigation assertions still need an inserted step. **Strictly more behaviour for strictly the same
migration.**

**A tabbed admin area (`/admin/threshold` and friends) was also rejected, and that one would have
been NEEDS-ADR** — it re-addresses four shipped screens and reverses ADM-01's Open question 1 along
with the answer ADM-02, ADM-03 and ADM-04 all inherited.

**The cost is stated plainly and belongs to the operator, not to a plan:** *the approval queue goes
from one click to two.* An admin who opens the worklist daily pays that every day.

### Decision 3 — the five roster sub-groups are out of scope, and this is the one the operator may want back.

Recorded as open question 9 above rather than dropped. **The short reason is that it is not a sidebar
ticket at all**: no column groups members within a team, so it is a migration, so it is `XL` and it is
a human's under RULE-09 — and before the column there is a decision, *is a sub-group ever a counting
unit for INV-04?*, which the picture pushes toward *yes* by putting a count pill on every group
header without anybody deciding it.

**The fourth legend row `Quá tải (>50%)`, the `2026 ▾` dropdown anchor, the palette icon, the
floating keyboard button and the missing `Today` control are out for the same class of reason**, and
each is worth one line:

- **The overload legend row reverses UIE-02 AC-11 and AC-20, and states a falsehood.** The token
  exists, so it is not a schema question; but `src/index.css:146-149` records the reason that is still
  true — *"a row would have to state a threshold that ADM-01 lets an admin change, so `>50%` becomes a
  lie the moment somebody uses the feature."* Rendering it truthfully needs `seam.getTeam()`, a read
  the shell deliberately makes nowhere. Its own row if the operator wants it, and its first AC writes
  itself.
- **The dropdown anchor** replaces a `<p>` carrying `data-year` / `data-month` / `data-week-start`
  that 43 spec references read (`TopBar.tsx:104-106`), with a year picker nothing specifies, in a
  product where the period is the address.
- **The palette icon was declined once already, one ticket ago, on stated grounds** — UIE-02 AC-20 and
  `Sidebar.tsx:273-275`: *what a control DOES is behaviour, and the grant does not reach behaviour.*
  There is also nothing to switch to; § *Colour* is a bare `TODO(project)` and the product has one
  theme.
- **The keyboard button is never invented.** The transcription says in its own words that *nothing in
  the picture says what it does.*
- **The absent `Today` control is silence, not a request.** § *Visual specification* says what an
  image does not show goes to *Out-of-scope*; it does not say it gets deleted. `shell-period-today` is
  UIE-02 AC-13 and it is the only anchorless route back to the current period from a distant date.

**And the first clause of the request — *change layout of left side bar* — is served rather than
quietly dropped.** `UIE-10` carries the roster restyle that is buildable today: the role word on each
roster row, which sits inside the § *Visual specification* grant as arrangement. It comes with one
obligation that must reach an AC — **it reverses `Sidebar.tsx:182-184`** (*"No role badge, no count
and no control on a row"*) **and it needs a NEW selector**, because `home-member-role` already names
the account footer's role line and three assertions in `tests/e2e/tea-05-sign-in.spec.ts:65,146,155`
read it by text. A renamed or reused id makes UIE-02 AC-6's exactly-one-node count fail under strict
mode.

## 4. The four `/triage` tests

| Test | Answer |
|---|---|
| Supersedes or reverses an accepted ADR? | **No.** |
| Registry change beyond a `Notes` sentence? | **Yes — two feature rows, `UIE-09` and `UIE-10`.** |
| Schema change? | **`none` on both, and not a fenced `none` this time.** |
| Requires an ADR? | **No.** |

**Supersedes nothing.** The hub extends ADM-01's own-screen-per-setting shape rather than reversing
it, and moves no existing route. ADR-005 is untouched: every control involved is an affordance over a
policy already in force, and the four screens keep their guards and their row-level security exactly
as they are. **Nothing in this work is a control.**

**`schema_delta: none` on both, without a fence.** No table, column, policy, grant, trigger or
constraint is named by either row. ADR-014's warning — that a policy-only migration is not `none` —
has nothing to bite on here, because there is no migration of any kind. The one part of the picture
that *would* have needed one is decision 3, and it is out.

**The seam is untouched**, so neither row is `XL` on that clause.

**No ADR is owed by the request as written.** Where one *would* be owed is named above and is not
this: the sub-groups (schema plus an INV-04 question, a human's under RULE-09) and the tabbed admin
area (reverses ADM-01's inherited answer).

## 5. Corrections to the first half of this file, stated rather than edited in

**There are six admin-touching addresses, not four.** The problem section counts the four admin links
in the sidebar, which is correct as a count of links and incomplete as a count of surfaces. `/members`
is a fifth admin surface — TEA-03's read and TEA-04's promote and remove — **with no link anywhere**,
and `/holidays` is a sixth that is deliberately not admin-only. The hub absorbs the fifth. The sixth
stays in the sidebar under decision 1.

**The reference count is refined rather than corrected.** The first half measured 41 references across
12 spec files and classified 9 clicks and 6 negative assertions on the four admin ids. The technical
half read all 41: **11 comments, 30 executable across 11 executing files, 13 navigation and 17
visibility** — a superset that includes the three general ids. Both counts are of the same grep; the
second is the one a plan should work from.

**Open questions 1 and 4 are answered by decisions 2 and 1.** Question 3 — what asserts the member
case once the ids move — is **not** answered here and is carried into `UIE-10` as the thing its plan
must write an AC for. Questions 2, 5, 6, 7 and 8 stay open and belong to PLAN.

## 6. What this verdict wrote

1. **`.ai/registry/features.md`** — two rows, `UIE-09` and `UIE-10`, both `PLANNED`, both
   `Invariants touched: []`, both citing this idea file in `Notes`, which is the only provenance a
   reviewer gets (ADR-007).
2. **`.ai/board/tickets/UIE-09/ticket.yaml`** and **`.ai/board/tickets/UIE-10/ticket.yaml`**, from
   `.ai/templates/ticket.yaml`, `state: BACKLOG`. Definition of Ready items **1, 3, 4 and 6** filled.
   **Items 2 and 5 — `invariants_touched` and `size_estimate` — are left exactly as the template ships
   them.** They are PLAN's, and the gate sits after PLAN so that they can be.
3. **`.ai/board/tickets/UIE-09/design/README.md`** and **`.ai/board/tickets/UIE-10/design/README.md`**
   — the transcription, copied verbatim into both, each with one line at the top naming which half of
   the picture that ticket answers. **This is what makes it durable evidence instead of a scratchpad
   path**, and it is the closest thing to a repair MD-030 allows from inside this loop: the prose now
   lives where `check-allowed-paths.mjs` and `guard-allowed-paths.mjs` both exempt it unconditionally,
   and it survives this session. **It is still a transcription and still not a reference** — the first
   line of each copy says so, as all seven existing ones do.
4. **`.ai/board/backlog.md`** — one row per ticket appended to `## BACKLOG`.

**No acceptance criteria are written here.** They are PLAN's, from the registry rows.

## 7. What could not be verified

- **The suite was not run.** `tech-lead-design` records `TODO(verify):` on exactly this: the 13/17
  classification was read line by line from the spec sources and has not been confirmed by making a
  change and watching the assertions fail. **The 17 is therefore the honest estimate of the cost and
  not a measurement of it**, and `UIE-10`'s plan is where it stops being an estimate.
- **The interaction with `CAL-10` was not assessed by the technical half** — it says so, naming
  ADR-032 and the then-untracked idea file as outside its read. **Checked here**: `CAL-10` is
  `BACKLOG` at row 1 of the backlog with `allowed_paths: []`, so no path is claimed and neither row
  `depends_on` it. **But `CAL-10` and `UIE-09` both edit `src/App.tsx`**, and `CAL-10` moves the
  default year address that five shipped criteria are written against. That is a sequencing fact for
  whoever plans second, not a dependency — one working tree holds one branch (ADR-006), so only one is
  ever in flight.
- **Nothing here was checked against the picture**, and nothing downstream can be. That is MD-030 and
  it is the standing condition of every visual ticket on this board.
