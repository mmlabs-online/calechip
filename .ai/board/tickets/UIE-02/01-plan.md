---
ticket: UIE-02
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-07T12:07:00+07:00   # Amended at PLAN rework 1. The 11:15:03 issue is what
                                         # 03-impl-log.md was built against; see the Changelog.
inputs_read:
  - .ai/board/tickets/UIE-02/ticket.yaml
  - .ai/board/tickets/UIE-02/design/README.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/01-operating-model.md
  - src/App.tsx
  - src/routes/Home.tsx
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - src/routes/YearView.tsx
  - src/routes/MemberList.tsx
  - src/hooks/useSession.ts
  - src/lib/data/index.ts
  - src/lib/data/absence.ts
  - src/lib/domain/types.ts
  - src/index.css
  - .ai/board/tickets/UIE-02/03-impl-log.md
  - tests/e2e/ (read for selector AND route usage; ONE spec file is now in scope — section 7)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# UIE-02 — the application shell

## 1. Problem and scope

**Feature row, transcribed from `.ai/registry/features.md:150` without paraphrase.** The row is long;
the sentences below are its own, in its own order, and nothing is added to them.

> UIE-02 | The application shell — a persistent sidebar and top bar | UIE | PLANNED | [] | From
> 2026-09-05-the-product-has-no-shell-and-every-screen-starts-over.md. **Depends on UIE-01**, which
> ships first and is not merged into this — both want `src/index.css` and the one class on
> `src/App.tsx:35`, and UIE-01 introduces the `@theme` tokens and the webfont that this row then
> consumes. […] **What it is.** The product has no chrome at all today: `src/App.tsx:35` is a bare
> `main` wrapping the whole router, two shipped screens are reachable only by typing an address,
> eleven back-links and eight period controls are re-implemented per screen, and two admin screens
> contain no link of any kind. This row builds the shell those thirteen screens have been
> substituting for — a persistent sidebar carrying the roster, the seven nav links and the account
> footer, and a top bar carrying the period controls and the three-way view switcher.
> `src/routes/Home.tsx` does not survive it; the landing route redirects a member to the week view,
> and the member-less and signed-out resolutions keep their present shape. **The shape is a
> react-router layout route with an `Outlet` and a conditional element, not a wrapper around the
> route table** […] **The trap, and it is the reason this row is its own ticket:** six routes in
> `src/App.tsx` are deliberately unguarded and each renders its own refusal instead of redirecting.
> A shell that renders only for a member and redirects otherwise converts six documented refusals
> into redirects and deletes the reason each one records. **What it deliberately does not do:** it
> does not remove the four period screens' own headers, so the application is knowingly doubled at
> the end of this ticket and looks worse before it looks better — that removal is UIE-03. It touches
> **zero spec files** […] **The failure mode is duplication, not relocation** […] `schema_delta`
> none; every file in scope sits above the data seam. **Amended by `product` on 2026-09-05 […] the
> sidebar's legend card carries a holiday row** […] TODO(project): the permanent seam banner at
> `src/App.tsx:41` has nowhere to sit in a full-bleed two-pane layout with no page margin, it is
> non-dismissible by design, and two spec files reference it. PLAN must place it rather than
> discover it.

**Who gains what.** A **member** — both roles are members; `admin` is a member who also decides —
gains a persistent frame. Every screen they can reach now carries the same roster, the same
navigation and the same account footer, so the seven destinations that were previously reachable only
from the landing screen (and two only by typing an address) are reachable from wherever they are.
This matters because the product's navigation model is today *go back to the landing screen first*:
eleven back-links exist to serve it, each screen re-implements its own period controls, and two
shipped screens have no inbound link at all. Nothing about **what** anybody may do changes here. The
shell adds no capability, reads nothing a policy does not already serve, and writes nothing.

### Out of scope

Non-empty by the gate, and every item is a decision rather than an omission.

1. **Removing any chrome from the four period screens. The application is knowingly doubled at the
   end of this ticket and that is the expected end state, not a defect.** After this ticket a member
   on `/week` sees the shell's top bar *and* `WeekView`'s own header — two anchors, two prev/next
   pairs, two ways to switch view. Written here at PLAN, before anybody builds it, precisely because
   a reviewer meeting two headers with nothing saying so reads it as a defect. Removing them is
   UIE-03 and the whole of it; doing any of it here puts spec files into this ticket and destroys the
   cut (`ticket.yaml` § 1).
2. **The week grid itself.** Seven day columns is UIE-04. This ticket puts a frame around the stacked
   layout that ships today and changes nothing inside it.
3. **A `Duyệt phép` (approve-leave) button in the top bar.** The transcription puts one there.
   `ticket.yaml` § 9.2 deferred it on the premise that ADM-04, ADM-05 and ADM-06 were all `BACKLOG`
   with no route and no screen. **That premise is now false** — see § 2 *Premise corrections*, item
   1 — but the conclusion survives for a different reason: the approval worklist shipped **with its
   own link**, `home-pending-entries-link` (`src/routes/Home.tsx:206`), and that link relocates into
   the sidebar with the other eleven. A second control to the same address in the top bar would
   either carry the same id — which is the twelve-spec-file strict-mode failure § 2 AC-6 exists to
   prevent — or carry a new one and give the product two differently-named routes to one screen.
   One nav item, in the sidebar, beside the other three admin items.
4. **The palette icon and the `?` button.** `ticket.yaml` § 9.5 and § 9.6, unchanged. Two readings
   and no evidence between them for the first; no help content anywhere in the repository for the
   second. What a control *does* is behaviour, and the § *Visual specification* grant does not reach
   behaviour. Ship absent — an open question, below.
5. **The `Overloaded (>50%)` legend row.** `ticket.yaml` § 9.4, re-checked in this tree rather than
   assumed: `src/routes/WeekView.tsx:11` still opens *"IT COUNTS NOTHING"* and `seam.getTeam()` is
   still not called there. The row needs `overloadThreshold` and a team read this shell does not
   make. It is a UIE-04 matter and a registry matter.
6. **Dark mode.** The transcription shows one theme, `.ai/standards/ui-design-system.md` § *Colour*
   is a bare `TODO(project)` stub, and there is no second theme to switch to. Stated rather than left
   silent, because silence here reads as an oversight.
7. **`src/routes/MemberList.tsx`.** The sidebar roster **duplicates** that screen rather than
   replacing it. Removing a shipped screen is not a restyle.
8. **`src/routes/TeamEntries.tsx`, `src/routes/Threshold.tsx` and `src/routes/EditEntry.tsx`.** The
   first two have back-links pointing at the landing route, which still exists and still resolves by
   membership, so they keep working with zero edits. `EditEntry`'s two links
   (`src/routes/EditEntry.tsx:121`, `:200`) are **not** back-to-home links — `edit-entry-back` points
   at the new-entry route and `edit-entry-team-back` at the team-entries route (`ticket.yaml` § 0.3).
   No shell control replaces either. Named so that leaving all three untouched is legible as a choice.
9. **Amending `.ai/standards/ui-design-system.md` or `ui-language.json`.** The first is human plane
   under RULE-01. The second is the copy-debt list, which only ever shrinks; no shell file goes on it.
10. **Every string in the transcription.** The interface is English — § *Language*, the operator's
    instruction of 2026-09-03, lint-enforced at `eslint.config.js:83-92`. See AC-18.

`size_estimate: M`. Three new components, one new hook, one new pure module, the route table, the
stylesheet, one deletion, and an import swap in each of the three period screens.

## 2. Acceptance criteria

### Premise corrections — measured in this tree on 2026-09-07, not re-derived

`ticket.yaml` was written on 2026-09-05 and amended once the same day for the CAL-08 rebase. **Four
of its statements are stale against the tree this ticket is planned in.** They are corrected here
rather than silently worked around, in the pattern § 0bis of that file already uses.

1. **ADM-04, ADM-05 and ADM-06 are `DONE`, not `BACKLOG`** (`.ai/registry/features.md:115-117`).
   `/entries/pending` is a registered route (`src/App.tsx:175-178`), `src/routes/PendingEntries.tsx`
   exists, and `src/routes/Home.tsx:203-213` carries a fourth admin-only link,
   `home-pending-entries-link`. § 9.2's factual premise is gone; its conclusion is kept for the
   reason in *Out of scope* item 3.
2. **There are twelve `home-*` ids, not eleven.** The twelfth is `home-pending-entries-link`. The
   full list is in AC-6.
3. **Fifteen spec files address a `home-*` id, not twelve.** The three § 5 does not name are
   `adm-04-worklist`, `adm-05-approve-reject` and `adm-06-bulk-reject`. § 5 also names
   `cal-03-team-entries.spec.ts`, which does not exist; the file is
   `tests/e2e/cal-03-admin-edit-entry.spec.ts`. **This changes no scope** — the count is the size of
   the crater if AC-6 is broken, not a list of files to edit. This ticket still touches zero spec
   files.
4. **There are five membership guards on routes, not four**, and every line number in § 3 of
   `ticket.yaml` is stale. Re-measured, and this is the list that binds:

   | Route | Where | Guard |
   |---|---|---|
   | `/allow-list` | `src/App.tsx:109` | **none** — renders `allow-list-refused` |
   | `/members` | `src/App.tsx:112` | **none** — renders `member-list-not-on-a-team` |
   | `/month`, `/month/:month` | `src/App.tsx:192-193` | **none** — renders `month-not-on-a-team` |
   | `/week`, `/week/:day` | `src/App.tsx:208-209` | **none** — renders `week-not-on-a-team` |
   | `/year`, `/year/:year` | `src/App.tsx:222-223` | **none** — renders `year-not-on-a-team` |
   | `/holidays`, `/holidays/:year` | `src/App.tsx:260-271` | signed-out → `/`; both signed-in states render |
   | `/entries/new` | `src/App.tsx:124-127` | `member` else `/` |
   | `/entries/:id/edit` | `src/App.tsx:138-141` | `member` else `/` |
   | `/entries/team` | `src/App.tsx:153-156` | `member` else `/` |
   | `/entries/pending` | `src/App.tsx:175-178` | `member` else `/` |
   | `/threshold` | `src/App.tsx:236-239` | `member` else `/` |

---

**AC-1 — the shell renders for a member, on every route that has one today**
- Given a signed-in caller whose membership resolves to `member`
- When they open any of `/week`, `/week/:day`, `/month`, `/month/:month`, `/year`, `/year/:year`,
  `/holidays`, `/holidays/:year`, `/entries/new`, `/entries/:id/edit`, `/entries/team`,
  `/entries/pending`, `/threshold`, `/allow-list` or `/members`
- Then `shell-sidebar` and `shell-topbar` are both visible, and the screen's own content renders
  inside the shell

**AC-2 — the shell does not render outside a member session**
- Given a caller in the `signed-out` or `member-less` state, or any caller on `/signin` or `/signup`
- When the route resolves
- Then neither `shell-sidebar` nor `shell-topbar` is present, and the screen renders in the centred
  container that exists today

**AC-3 — the six unguarded routes still refuse rather than redirect**
- Given a signed-in caller whose membership resolves to `member-less`
- When they open `/allow-list`, `/members`, `/month`, `/week`, `/year` or `/holidays` by address
- Then the address does not change, no redirect occurs, and the screen's own refusal renders —
  `allow-list-refused`, `member-list-not-on-a-team`, `month-not-on-a-team`, `week-not-on-a-team`,
  `year-not-on-a-team`, and for `/holidays` the calendar itself

**AC-4 — the five membership guards are unchanged**
- Given a caller in the `signed-out` or `member-less` state
- When they open `/entries/new`, `/entries/:id/edit`, `/entries/team`, `/entries/pending` or
  `/threshold`
- Then they are sent to `/`, exactly as today, and `/` then resolves by membership

**AC-5 — the landing route keeps its three-way shape, and for a member `/` IS the current week**
- Given a caller opens `/`, or any address the application does not route
- When the membership resolves
- Then a `member` sees the current week inside the shell **at `/`, with no redirect and no address
  change**; a `member-less` caller reaches `not-on-a-team-*`; a signed-out caller reaches the sign-in
  screen

*Amended at PLAN rework 1. The criterion read "a `member` is redirected to `/week`" and that is what
`03-impl-log.md` implemented, correctly. It cost twenty-five shipped acceptance tests — see AC-23 and
the Changelog.*

**AC-6 — every `home-*` id appears exactly once in the rendered tree**
- Given a signed-in `admin` on any route inside the shell
- When the page has rendered
- Then each of `home-member-avatar`, `home-member-name`, `home-member-role`, `home-sign-out`,
  `home-week-link`, `home-year-link`, `home-holidays-link` and `home-new-entry-link` resolves to
  exactly one node — never zero, never two

> ***AMENDED 2026-09-09 BY UIE-10, WHICH SHORTENED THE LIST FROM TWELVE IDS TO EIGHT.***
> `home-allow-list-link`, `home-team-entries-link`, `home-threshold-link` and
> `home-pending-entries-link` were removed from the product by UIE-10 AC-1 — the sidebar gave up its
> four admin links and the same four addresses are reached through `shell-admin-link` in the top bar
> and then the `admin-hub-*-link` rows UIE-09 shipped. **They are removed rather than relocated**, so
> there is no node anywhere for the count to be taken of: UIE-09 had already shipped
> `admin-hub-*-link` on those exact rows and asserts each resolves to one node, and a row cannot
> carry two `data-testid` values.
>
> **The eight that remain keep this criterion exactly as it was written, and that is the half worth
> protecting** — Playwright strict mode fails a `.click()` matching two nodes, which is what made
> UIE-02's relocation trick safe in the first place. UIE-10's own AC-8 re-states the count for the
> shell's ids and adds `shell-roster-role` to what is checked. **The four names are not reused.**
> UIE-10 01-plan.md § 4.5 and `tests/e2e/uie-10-sidebar.spec.ts` carry the reasoning and the
> assertion.

**AC-7 — `home-member-role` keeps the exact strings `Admin` and `Member`**
- Given a signed-in member
- When the sidebar's account footer renders
- Then `home-member-role` has the text `Admin` for an admin and `Member` for a member, letter for
  letter; any uppercase presentation is a CSS transform and never a different string

**AC-8 — the four admin-only nav items are hidden from a member and shown to an admin**
- Given a signed-in caller whose `member.role` is `member`
- When the sidebar renders
- Then `home-allow-list-link`, `home-team-entries-link`, `home-threshold-link` and
  `home-pending-entries-link` each resolve to zero nodes; and given the same caller with role
  `admin`, each resolves to exactly one

> ***SUPERSEDED 2026-09-09 BY UIE-10 AC-1. The criterion above is kept in the past tense rather than
> rewritten, because it is a true statement about what UIE-02 shipped and it is the record of why
> those four ids existed at all.*** After UIE-10 the four are hidden from BOTH roles — they render
> for nobody — so the second clause is false by design and the first is true for a reason it was
> never asserting.
>
> **AND THAT IS PRECISELY WHY THE ASSERTIONS THAT CARRIED THIS CRITERION COULD NOT SIMPLY BE LEFT
> ALONE.** Six `toHaveCount(0)` assertions across four spec files stated the member half of it. An
> assertion that a named node is absent is satisfied by the name never having existed, so all six
> would have gone on passing while stating nothing at all. UIE-10 AC-4 rewrote each of them onto
> `shell-admin-link`, which renders for an admin and not for a member and can therefore still fail;
> UIE-10 AC-5 is the standing check that no such assertion is left anywhere in the suite.
>
> **WHAT THE ROLE DISTINCTION THIS CRITERION EXPRESSED NOW LOOKS LIKE:** one control,
> `shell-admin-link`, rendered for an admin and absent for a member (UIE-09 AC-1 and AC-2), and four
> screens that each still refuse a member who types their address — `pending-entries-refused`,
> `team-entries-refused`, `allow-list-refused`, `threshold-refused`. Neither this criterion nor its
> replacement was ever what protected anything: both are affordances over row-level security that
> was not touched (ADR-005).

**AC-9 — the sidebar roster lists the caller's active team-mates and marks the caller**
- Given a signed-in member whose team roster is readable
- When the sidebar renders
- Then `shell-roster-row` appears once per member of the roster whose `removedAt` is null and not
  once more; `shell-roster-count` states that same number; each row shows the member's `avatar` and
  `displayName`; and the row whose member id equals the signed-in member's is additionally marked
  `(You)`

**AC-10 — the roster has a loading state and a failure state, and neither is an empty list**
- Given the roster read has not resolved, or has thrown
- When the sidebar renders
- Then `shell-roster-loading` is present in the first case and `shell-roster-unavailable` in the
  second, and in neither case is `shell-roster-count` rendered — a roster that failed must not read
  as a team of nobody

**AC-11 — the legend card carries three rows and no fourth**
- Given the sidebar renders, in any membership role
- When the legend card is read
- Then `shell-legend-row` resolves to exactly three nodes, labelled `Leave (PTO)`, `Working from
  home (WFH)` and `Holiday`, each with its own colour swatch; and no row names an overloaded day and
  no row names a bridge day

**AC-12 — the top bar's period controls appear on the period routes and move the address**
- Given a signed-in member on `/week/2026-10-07`
- When they press `shell-period-next`, then `shell-period-prev` twice
- Then the address becomes `/week/2026-10-12`, then `/week/2026-10-05`, then `/week/2026-09-28` —
  each the **Monday** of the week being stepped to — and `shell-period-anchor` states the week each
  address resolves to; the equivalent holds for `/month/:month` stepping by one month and
  `/year/:year` stepping by one year

  **Amended 2026-09-07 — the first form of this AC gave three addresses the product does not and
  should not produce.** It stepped ±7 days from the anchor day in the URL, which for a Wednesday
  anchor yields Wednesday addresses. A week's address normalises to its Monday, and stepping is from
  that Monday: this is not a new decision, it is what CAL-05 shipped and what
  `tests/e2e/cal-05-week-view.spec.ts:271-289` already asserts — from the same `/week/2026-10-07`
  anchor, walking `week-prev` and `week-next` and ending on `await expect(page).toHaveURL(/\/week\/2026-10-12$/)`.
  See § 4.5 and the Changelog. **Note what the corrected sequence does**: the first `prev` returns
  the member to the week they started on, at that week's canonical address rather than at the
  Wednesday they arrived by.

**AC-13 — `Today` returns to the current period of the view being looked at**
- Given a signed-in member on `/month/2019-03`
- When they press `shell-period-today`
- Then the address becomes `/month`, which the month screen itself resolves to the current month

**AC-14 — the view switcher has three segments, marks the current one, and keeps the date**
- Given a signed-in member on `/month/2027-04`
- When the top bar renders
- Then `shell-view-week`, `shell-view-month` and `shell-view-year` are each present exactly once,
  `shell-view-month` carries `aria-current="page"` and the other two do not; and pressing
  `shell-view-year` reaches `/year/2027` rather than the current year

**AC-15 — the period controls are absent where there is no period**
- Given a signed-in member on `/allow-list`, `/entries/new` or `/threshold` — **and not on `/`, which
  after AC-5 is a period route showing the current week**
- When the top bar renders
- Then `shell-period-prev`, `shell-period-anchor`, `shell-period-next`, `shell-period-today`,
  `shell-view-week`, `shell-view-month` and `shell-view-year` each resolve to zero nodes, while
  `shell-topbar` and `home-new-entry-link` are still present

**AC-16 — a malformed anchor does not produce a period cluster built from it**
- Given a signed-in member opens `/week/banana` or `/month/2026-13`
- When the top bar renders
- Then no `shell-period-anchor` is drawn from the malformed value; the screen's own redirect to the
  current period takes effect and the cluster then describes the address the caller lands on

**AC-17 — `app-root` and `seam-banner` keep their names and their positions**
- Given a build resolving to the mock seam
- When any route renders
- Then `app-root` is still the element wrapping the router's output and `seam-banner` is still its
  first child, rendered above both panes on every route including those inside the shell, and it is
  still not dismissible

**AC-18 — every string the shell renders is English**
- Given the shell renders in any state
- When `pnpm exec eslint .` runs
- Then it exits 0 with no diacritic-rule violation from any file in § 7, and no shell file has been
  added to `copyDebt` in `ui-language.json`

**AC-19 — the primary create action lives in the top bar and is the relocated link**
- Given a signed-in member, of either role, on any route inside the shell
- When the top bar renders
- Then `home-new-entry-link` is present exactly once, in the top bar, and navigates to
  `/entries/new`

**AC-20 — the four deferred controls are absent, not disabled**
- Given a signed-in admin anywhere inside the shell
- When the page renders
- Then there is no approve-leave button in the top bar, no palette control, no `?` control and no
  overload legend row — absent, in no state, rather than present and disabled

**AC-21 — the page does not scroll sideways**
- Given a signed-in member on `/week` at a 1280px and at a 1024px viewport
- When the shell renders
- Then `document.documentElement.scrollWidth` equals its `clientWidth`; any horizontal scrolling
  belongs to a grid inside the content pane, never to the page

**AC-22 — the period screens keep their own headers through this ticket**
- Given a signed-in member on `/week/2026-10-07`
- When the page renders
- Then `week-home`, `week-prev`, `week-anchor`, `week-next`, `week-month` and `week-year` are all
  still present and still work, alongside the shell's own controls. This is the doubling named in
  *Out of scope* item 1 and it is an expected end state of this ticket

**AC-23 — `/` is an address a member can rest on, and history can walk back to it**
- Given a signed-in member who has navigated from `/` to another screen without a document load
- When the browser's Back button is pressed
- Then the address returns to `/`, `/` does not move on its own, and `home-sign-out` is present there
- And the browser Back button is never a trap: no address in this ticket forwards the caller onward
  when they arrive at it by `popstate`

*This is the criterion the plan did not have and the whole of what PLAN rework 1 exists for. Five
shipped spec files walk history back to `/` in helpers, because a `page.goto` would reset the mock
seam's module state and lose entries an earlier step created. The property they depend on is not a
selector — it is that `/` is somewhere the application comes to rest — and § 7's "no spec file is
needed" reasoned only about the twelve `home-*` ids and was silent about the route.*

**AC-24 — the sidebar roster does not make a refusal screen name somebody**
- Given a caller whose `member.role` is `member` opens `/entries/team` and is refused
- When the refusal renders
- Then `team-entries-refused` is visible, `team-entry-row` resolves to zero nodes, and **no entry
  owner's display name appears in the content pane**
- And the sidebar roster continues to name every active member, on this screen as on every other,
  because `Read the member list` is ✅ for both roles and `/members` already shows exactly that

*The roster puts every team-mate's display name on every screen. One shipped assertion —
`tests/e2e/cal-03-admin-edit-entry.spec.ts:493` — reads `page.getByText(OWNER_NAME)` page-wide, and
its own comment states the intent as "a refusal that said what it was withholding would be the read
it is refusing". The intent is about the refusal, not about the roster, so the assertion is scoped to
the content pane. This is the one spec-file edit in § 7 and it has nothing to do with `/`.*

**Invariants touched: `[]`.**

Reached rather than inherited, and by a structural argument rather than from safe behaviour — which
is the circularity `.ai/registry/invariants.md` warns about. All seven rows at
`.ai/registry/invariants.md:33-39` constrain an `entry` row or the member it belongs to: overlap,
approval state, rejection reasons, the absence count, tentative entries, portions, ownership. **No
invariant governs the presence of a sidebar.** The non-circular form: every file in § 7 sits above
the seam — no query, no policy, no migration, no arithmetic over entries. The one file that reads
anything is `src/hooks/useRoster.ts`, and it makes exactly one call, `seam.listMembers()`, which is a
**read** the member-list screen already makes (`src/routes/MemberList.tsx:54`) under a policy that
admits both roles. Nothing is written on any path in this ticket. ADR-028 records that `[]` will be
the answer on almost every UIE row, as a cost of the group rather than as permission to skip the
question.

**Open questions.** Each ships an assumption rather than blocking; none would change an AC above.

1. **The product shows two names and only the operator can settle it.** `index.html:6` says
   `CaleChip` and `CLAUDE.md` opens with it; UIE-01 built the auth card's title as `Ai Nghỉ?` from
   the transcription. The sidebar brand lockup now repeats the same string on every screen, so the
   inconsistency goes from one screen to all of them. `ticket.yaml` § 9.1 says *whatever UIE-01
   settles is what this ticket follows*, and UIE-01 settled it by building `Ai Nghỉ?` — so that is
   what is built here, by the same construction — `src/components/AuthCard.tsx:41`, which composes the one accented
   character from its code point so no node in the file sits inside the lint rule's range.
   It is one string in one file whichever way the operator goes.
2. **The palette icon and the `?` button ship absent.** Both are in the transcription and neither has
   a decided meaning. Recorded as an open question rather than invented, per `CLAUDE.md` § *No
   invention*.
3. **Whether the legend should also explain the outlined bridge-day badge.** `ticket.yaml` § 9.3
   raises it and does not answer it. **This plan answers no** — a legend swatch is a fill, a bridge
   day has no fill, and a fourth row explaining an outline is a second thing for the legend to be
   wrong about. AC-11 fixes the count at three. If the operator wants it, it is one row.
4. **Two per-screen clocks remain.** *Narrowed at PLAN rework 1 — it read "three".*
   `WeekView`'s `today()` moves to `src/lib/period.ts` as `currentDay()`, because `/` now needs an
   anchor the shell can describe (§ 4.5, and § 8 rejected alternative 4 as amended).
   `MonthView.tsx`'s `currentMonth` and `YearView.tsx:96`'s `currentYear` stay: nothing outside
   those files needs them, and `/month` and `/year` are still redirected within a render.

5. **The feature row's word *redirects* is now out of date, and correcting it is a human's.**
   `.ai/registry/features.md:150` reads *"the landing route **redirects** a member to the week
   view"*. After AC-5 the landing route **shows** a member the week view, at `/`, without
   redirecting. **Everything else that clause settles is preserved exactly**: `src/routes/Home.tsx`
   does not survive, a member landing at `/` sees the week, and the member-less and signed-out
   resolutions keep their present shape. The registry is human plane under RULE-01 and this plan
   does not edit it. The correction is one word, and the operator sees it at merge; the reason it is
   raised here rather than made here is that it is the only place this plan knowingly diverges from
   a registry row, and a divergence nobody wrote down is the one that becomes a surprise.

6. **Deleting `src/routes/Home.tsx` breaks the documentation audit, and the fix is human plane.**
   *Found at PLAN rework 1, by running `node scripts/check-docs.mjs` against the tree
   `03-impl-log.md` left.* It goes from **0 errors to 2**: check D6 requires every relative path
   written under `.ai/` to exist on disk, and `.ai/registry/features.md` names
   `src/routes/Home.tsx` three times — at `:128`, `:130` and `:150`. The deletion is correct and
   required by the feature row itself; the citations are what go stale. **No `allowed_paths` this
   plan could write would fix it** — `.ai/registry/**` is human-owned under RULE-01 and is never in
   a ticket's paths. It is not in the Definition of Done's four commands, so it does not block
   `/ship`, but `/docs-audit` fails from the moment this ticket's deletion lands. D6 has a
   *pending* channel for a path that is owed rather than broken; these three are the opposite —
   paths that were real and are not any more — so the correction is to the three sentences, not an
   exemption. Recorded here because it is a consequence of this ticket that nobody downstream of it
   can fix.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

**`.ai/board/tickets/UIE-02/design/README.md` is not an image and does not change that line.** It is
a transcription, written by hand by `product` at `/triage`, of a picture shown in conversation on
2026-09-05 that was never committed — `git ls-files` holds no image of any kind. That file says so
itself in its first paragraph and states the consequence in its fourth: the absence of an image puts
the layout in `tech-lead-design`'s hands at PLAN, *including the obligation that comes with the
grant*. This is that line, written for that reason.

**What the transcription is used for, and what it is not.** It is evidence of intent and it is spent
as such: the element order, the two-pane split, the pinning of the legend and the footer to the
bottom, the top bar's two clusters, and the four things it deliberately does not show (§ 3 of that
file) are all carried into the ACs above and into *Out of scope*. It is **not** a specification — a
later reader cannot check one statement in it against the picture it came from, and
`.ai/standards/ui-design-system.md:137-138` already says *"looks like the screenshot" is not an
acceptance criterion*. A transcription of an image nobody can reopen is weaker than that again.

**The four things this plan takes from it and the five it refuses** are set out in that file's § 4
and § 5. The refusals are in *Out of scope* items 3–6 and 10 above, and every one of them is
**behaviour** or **copy**, which the grant explicitly does not reach.

## 3. Permission model

**Nothing in this ticket is a control. Every element below is an affordance, and the control behind
each one is a row-level-security policy that already exists and is not touched.**
`.ai/standards/rbac-and-security.md` § *The permission table* is the source for each row.

| Element | `member` | `admin` | The control behind it |
|---|---|---|---|
| The shell itself, sidebar and top bar | ✅ | ✅ | none — it renders for anyone whose membership resolves to `member` |
| `shell-roster-*` — the roster read | ✅ | ✅ | `Read the member list` ✅/✅; `member_select_team`, which scopes rows to the caller's own team inside the policy body |
| `home-week-link`, `home-year-link`, `home-holidays-link` | ✅ | ✅ | `Read any entry in the team` ✅/✅ and `Read the holiday calendar` ✅/✅. Read-only views; nothing is hidden because nothing is refused |
| `home-new-entry-link` | ✅ | ✅ | `Create an entry for themselves` ✅/✅; `entry_insert_own` carries no role predicate. An admin has no more power here than a member |
| `home-allow-list-link` | ❌ hidden | ✅ | `Read the allow-list` ❌/✅; `allowed_email_select_admin`. A member who types `/allow-list` still reaches the screen and is still refused by it |
| `home-team-entries-link` | ❌ hidden | ✅ | `Edit or delete another member's entry` ❌/✅; `entry_update_admin`, `entry_delete_admin` |
| `home-threshold-link` | ❌ hidden | ✅ | `Set the overload threshold` ❌/✅; `team_update_admin` |
| `home-pending-entries-link` | ❌ hidden | ✅ | `Approve or reject another member's entry` ❌/✅. **The weakest of the four**: `entry_select_team` admits those rows to both roles, so the hiding saves a journey and refuses nothing at all — what is admin-only is the work, at ADM-05 |
| `home-sign-out` | ✅ | ✅ | Supabase Auth; ends the session |

**The denials, stated as denials.** A `member` must not see the four admin nav items (AC-8). No role
gains any new read or write from this ticket: the shell adds exactly one call, `seam.listMembers()`,
which is already made by `src/routes/MemberList.tsx:54` and by all three period screens, under a
policy that admits both roles. **A member-less or signed-out caller must not be redirected away from
the six unguarded routes** (AC-3) — that is a permission-shaped requirement even though no policy
enforces it, because the refusal each screen renders is what tells the caller why.

**Where the check lives.** On the server side of the boundary, always. Every hidden link above is an
interface affordance over a policy that refuses the same caller whether or not the link was drawn,
and every one of those refusals is already asserted by a shipped spec. The sidebar's role condition
is `member.role === "admin"`, read from the `member` row the session already resolved — the same
condition `src/routes/Home.tsx` uses today, moved rather than rewritten, which is what keeps the
three `toHaveCount(0)` assertions passing.

## 4. Contract

Exact and copy-pasteable. Every name below appears in the code exactly as written here.

### 4.1 `src/components/AppShell.tsx`

```tsx
import type { JSX } from "react";
import type { Member, Result } from "@/lib/domain/types";

export interface AppShellProps {
  /** The signed-in member. `App.tsx` has already resolved it; the shell never re-reads it. */
  member: Member;
  signOut(): Promise<Result<void>>;
}

export default function AppShell({ member, signOut }: AppShellProps): JSX.Element;
```

Renders `<Sidebar member={member} signOut={signOut} />`, `<TopBar />` and `<Outlet />`. It is the
layout route's `element`.

### 4.2 `src/components/Sidebar.tsx`

```tsx
import type { JSX } from "react";
import type { Member, Result } from "@/lib/domain/types";

export interface SidebarProps {
  member: Member;
  signOut(): Promise<Result<void>>;
}

export default function Sidebar({ member, signOut }: SidebarProps): JSX.Element;
```

### 4.3 `src/components/TopBar.tsx`

```tsx
import type { JSX } from "react";

/** TAKES NO PROPS. The anchor, the previous and next targets and the active segment are all derived
 *  from `useParams()` and `useLocation()`. No context, no upward prop path, no `useOutletContext`. */
export default function TopBar(): JSX.Element;
```

### 4.4 `src/hooks/useRoster.ts`

```ts
import type { Member } from "@/lib/domain/types";

export type RosterState =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "ready"; members: Member[] };

/**
 * The sidebar's roster. Exactly one seam call, `seam.listMembers()`, on mount.
 *
 * `members` holds ONLY rows whose `removedAt` is null. The seam deliberately returns removed
 * members carrying `removedAt` (ADR-013) because the counting functions need them; which rows a
 * screen draws is a display decision above the seam, and this is that decision — the same one
 * `src/routes/MemberList.tsx:179` already makes.
 *
 * `listMembers()` THROWS on a transport failure and on a possibly-truncated answer, and returns
 * `[]` to a caller with no member row. `unavailable` is the throw; `[]` is a normal answer.
 */
export function useRoster(): RosterState;
```

### 4.5 `src/lib/period.ts` — new, pure, no seam import

The one structural move in this ticket. `shiftMonth` and `shiftYear` are today module-private in the
screens that use them (`src/routes/MonthView.tsx:104`, `src/routes/YearView.tsx:85`) and the top bar
needs both. `mondayIndex` is today **duplicated** — `src/routes/WeekView.tsx:76` and
`src/routes/MonthView.tsx:93`, character for character — and so is `MONTH_NAMES`
(`src/routes/MonthView.tsx:67`, `src/routes/YearView.tsx:66`). Moving each definition here deletes a
duplicate rather than creating a third copy.

```ts
/** Names as MonthView.tsx and YearView.tsx already spell them. Twelve entries, January first. */
export const MONTH_NAMES: readonly string[];

/** 0 for Monday … 6 for Sunday. UTC, and not `getUTCDay()` — see day-status.ts:61. */
export const mondayIndex: (date: string) => number;

/** `yyyy-MM-dd`, and a real date: `2026-02-30` is rejected. */
export const isRealDay: (day: string) => boolean;
/** `yyyy-MM`, month 01-12. */
export const isRealMonth: (month: string) => boolean;
/** `yyyy`. */
export const isRealYear: (year: string) => boolean;

export const shiftMonth: (month: string, by: number) => string;
export const shiftYear: (year: string, by: number) => string;

/** `April 2026`. */
export const monthLabel: (month: string) => string;
/** `1 Dec – 7 Dec 2025`, from the MONDAY of the week, not from the anchor day. */
export const weekLabel: (monday: string) => string;

export type PeriodKind = "week" | "month" | "year";

export interface PeriodNav {
  kind: PeriodKind;
  /** What `shell-period-anchor` says. */
  label: string;
  /** `to` for `shell-period-prev`. On a week, from the MONDAY — see the note below. */
  prevTo: string;
  /** `to` for `shell-period-next`. On a week, from the MONDAY — see the note below. */
  nextTo: string;
  /** `to` for `shell-period-today` — the anchorless address, so the SCREEN resolves the clock. */
  todayTo: string;
  /** `to` for the three switcher segments. Keeps the date, exactly as the screens' own links do. */
  weekTo: string;
  monthTo: string;
  yearTo: string;
}
```

**A week's `prevTo` and `nextTo` step ±7 days from the MONDAY of the anchor's week, never from the
anchor day itself** — on `/week/:day` and on the `/` arm alike, where the anchor is `currentDay()`.
Added 2026-09-07, after the Developer found that AC-12 and the implementation disagreed about the
address; **the implementation was right and AC-12 was amended.**

**This is not a preference and it was not decided here.** It is what CAL-05 shipped:
`WeekView.tsx:287` and `:293` are `addDays(start, ∓7)` where `start` is the Monday, and
`tests/e2e/cal-05-week-view.spec.ts:271-289` asserts the resulting addresses from the very anchor
AC-12 uses — ending on `toHaveURL(/\/week\/2026-10-12$/)`, a Monday. Stepping from the anchor day
would put **two different week-stepping rules on one screen**: the top bar moving by Wednesdays while
the in-page `week-prev` / `week-next` links beside it move by Mondays. This section exists to delete
duplicated definitions rather than create a third; a second stepping rule would be the same defect in
behaviour that `mondayIndex` was in code.

**The cost, stated because it is real.** The address is not a round trip: next-then-prev from
`/week/2026-10-07` lands on `/week/2026-10-05`, not back where it began. A shared link changes shape
when somebody steps away and returns. That is canonicalisation rather than loss — the week rendered
is identical, `shell-period-anchor` reads identically, and `/week/2026-10-05` is the address CAL-05
already treats as that week's name.

```ts
/**
 * The current day, `yyyy-MM-dd`, from the caller's LOCAL clock.
 *
 * MOVED HERE FROM `src/routes/WeekView.tsx:89` AT PLAN REWORK 1, and it is the one place a local
 * date read is correct — every other date in this feature is deliberately UTC. WeekView imports it
 * rather than keeping a second copy. `MonthView`'s `currentMonth` and `YearView`'s `currentYear`
 * are deliberately NOT moved: nothing outside those files needs them. See § 8, rejected
 * alternative 4, and its amendment.
 */
export const currentDay: () => string;

/**
 * Returns `null` when the pathname is not a period route OR the anchor is absent or malformed.
 * `null` is what AC-15 and AC-16 render: no cluster at all.
 *
 * `"/"` IS A PERIOD ROUTE AND RESOLVES TO THE CURRENT WEEK — `kind: "week"`, anchored at
 * `currentDay()`. That is the one place this module reads a clock, and it is what AC-5 makes
 * necessary: after PLAN rework 1 `/` shows the current week in place rather than redirecting, so
 * the top bar has an anchor to describe and no address to wait for.
 *
 * Every other anchorless address still yields `null`: `/week`, `/month` and `/year` are redirected
 * by their own screens within a render, and guessing at them would make the shell a second source
 * of truth about what day it is.
 */
export function periodNavFor(pathname: string): PeriodNav | null;
```

**`periodNavFor` reads the pathname and not `useParams()`**, deliberately: the top bar is rendered by
the layout route, which is *above* the matched child route, so its `useParams()` sees no `:day`,
`:month` or `:year`. This is the single most likely way to build the top bar and have it silently
render nothing.

**The switcher targets keep the date, matching what the screens' own cross-view links already do:**
from a week, `monthTo` is `/month/<anchorDay.slice(0,7)>` — the month containing the **day in the
URL**, not the month containing the Monday (`src/routes/WeekView.tsx:294`); `yearTo` is
`/year/<anchorDay.slice(0,4)>`. From a month, `weekTo` is `/week/<month>-01`
(`src/routes/MonthView.tsx:356`) and `yearTo` is `/year/<month.slice(0,4)>` (`:368`). From a year,
`monthTo` is `/year`'s January — `/month/<year>-01` (`src/routes/YearView.tsx:347`) — and `weekTo` is
`/week/<year>-01-01`, which is new and has no counterpart on the screen.

### 4.6 `src/App.tsx` — the route table

```tsx
{/* NOT a wrapper around <Routes>. A wrapper paints the sidebar on /signin and /signup too, and the
    only escape is a useLocation() conditional inside the shell — a route table re-expressed as an
    if-statement, in a file that already uses the router for exactly this. */}
<Route
  element={
    membership.state === "member" ? (
      <AppShell member={membership.member} signOut={signOut} />
    ) : (
      <BareLayout />
    )
  }
>
  {/* `/` is the INDEX ROUTE of this layout — see below. Then every route that is not
      /signin or /signup. */}
</Route>
```

`BareLayout` is declared in `src/App.tsx` beside `App` and is the centred, padded container that
exists today:

```tsx
function BareLayout(): JSX.Element {
  return (
    <div className="p-8">
      <Outlet />
    </div>
  );
}
```

**`/signup` and `/signin` stay outside the layout route**, per `ticket.yaml` § 3.

**`/` is the layout route's INDEX ROUTE. Amended at PLAN rework 1 — it was outside, and it redirected.**

```tsx
<Route
  index
  element={
    membership.state === "member" ? (
      <WeekView landing />
    ) : membership.state === "member-less" ? (
      <NotOnATeam user={membership.user} signOut={signOut} />
    ) : (
      <Navigate to="/signin" replace />
    )
  }
/>
```

**The three-way shape is unchanged and each arm still lands where it did.** A member sees the week —
`Week` is the active segment in the transcription — and now sees it *at* `/` rather than at
`/week/<today>`. A member-less caller reaches `NotOnATeam`, which renders inside `BareLayout`
because the layout's element is chosen on membership (§ 4.6 above), so it is still outside the shell
exactly as `ticket.yaml` § 3 requires. A signed-out caller still reaches the sign-in screen. The
catch-all keeps funnelling unknown addresses through `/`, so the eleven back-links that point at the
landing route keep working.

**Why an index route and not a redirect, in one sentence:** a redirect makes `/` an address the
application never rests on, and five shipped spec files walk browser history back to it — AC-23.

**Why not simply drop `replace` from the redirect.** That keeps `/` in history and turns Back into a
trap: arriving at `/` by `popstate` fires the redirect again and forwards the caller to the week for
ever. `03-impl-log.md` reached the same conclusion and it is correct.

**The `/` route no longer costs a wasted shell render**, which was the original reason for keeping it
outside the layout: there is nothing to navigate away from any more.

### 4.7 `src/App.tsx` — where the banner sits

**This is the `TODO(project)` in the feature row, answered rather than discovered.**

`app-root` keeps its name and its position on the element wrapping the router's output, and
`seam-banner` keeps its name and its position as that element's first child —
`tests/e2e/smoke.spec.ts:9` depends on the first and two spec files on the second, and no spec file
is in scope here.

What changes is one class list. `app-root` gives up `p-8` and becomes a full-height flex column:

```diff
-      <main data-testid="app-root" className="min-h-screen bg-bg p-8 font-sans">
+      <main data-testid="app-root" className="flex min-h-screen flex-col bg-bg font-sans">
```

The banner is then a full-width strip across the top of the viewport, above both panes, and the shell
takes the remaining height. **The `p-8` it gave up moves to `BareLayout`, which is where the auth
screens' gutter has to be** — `src/components/AuthCard.tsx:54` names `App.tsx`'s `p-8` as the gutter
that satisfies UIE-01's AC-16, and a shell that quietly removed it would break a criterion shipped
one ticket ago. The `resolving` spinner (`src/App.tsx:56-63`), which sits outside `<Routes>` and
stays there, carries its own padding for the same reason.

**Why the banner is not inside the content pane.** It is a warning that the whole application is
running on a fake datastore. Putting it inside the pane makes it a property of the screen rather than
of the build, and it would then scroll away.

### 4.8 The selector allocation — the decision `ticket.yaml` § 7 requires PLAN to make

**The screens keep every id they have today. The shell's controls carry new `shell-*` ids.**

| Control | Id | Where |
|---|---|---|
| the sidebar | `shell-sidebar` | new |
| the top bar | `shell-topbar` | new |
| brand lockup | `shell-brand` | new |
| roster section count | `shell-roster-count` | new |
| roster row | `shell-roster-row` | new, one per active member |
| roster loading / failure | `shell-roster-loading`, `shell-roster-unavailable` | new |
| legend row | `shell-legend-row` | new, exactly three |
| previous period | `shell-period-prev` | new |
| the anchor | `shell-period-anchor` | new |
| next period | `shell-period-next` | new |
| today | `shell-period-today` | new |
| the three segments | `shell-view-week`, `shell-view-month`, `shell-view-year` | new |
| account avatar, name, role, sign out | `home-member-avatar`, `home-member-name`, `home-member-role`, `home-sign-out` | **relocated, unrenamed** |
| the seven nav items | `home-week-link`, `home-year-link`, `home-holidays-link`, `home-allow-list-link`, `home-team-entries-link`, `home-threshold-link`, `home-pending-entries-link` | **relocated, unrenamed** |
| the create action | `home-new-entry-link` | **relocated, unrenamed**, into the **top bar** |

**Why the shell does not reuse `week-month`, `month-week`, `year-month`, `week-prev`, `month-anchor`
or any of their siblings.** Those elements still exist on the screens through this ticket — that is
*Out of scope* item 1. Rendering the same id in the top bar as well resolves the locator to two
nodes, and Playwright refuses a locator that matches more than one; it does not pick the first. That
is the failure `ticket.yaml` § 5 calls the one way this ticket goes red, and § 7 names the view
switcher as the single most likely place to introduce it. New ids are the only shape that survives
the doubling. **UIE-03, which deletes the screens' headers, is the ticket that may then decide
whether the old names move onto the shell** — it will have exactly one copy of each to move.

**`year-week` is deliberately not created.** `ticket.yaml` § 7 proposes it as a new id on the year
screen; the shell's `shell-view-week` serves the same navigation and adding a second control to the
year screen would be an edit to a period screen, which this cut forbids.

**`home-new-entry-link` goes to the top bar and not the sidebar**, which is the one place this plan
departs from `ticket.yaml` § 5's wording (*all eleven move into the sidebar*). The transcription puts
the create action in the top bar's right cluster and it is the screen's primary action; the binding
constraint from § 5 is *unrenamed and exactly once*, and that holds either way. AC-19 states it, and
AC-15 requires the top bar — and therefore this link — to render on every route inside the shell, so
that the fifteen spec files which click it immediately after signing in keep working.

### 4.9 The layout

Originated here (§ 2b), from the transcription's arrangement, against UIE-01's token block.

**The frame.** Two panes, full bleed, no page margin. The sidebar is a fixed `216px`, `--color-card`,
full height, no border — separated from the content pane by colour alone. The content pane fills the
rest on `--color-bg` and is the only scrolling region.

**The sidebar, top to bottom.** Brand lockup: the product name in `--font-display` 700 at ~20px in
`--color-ink`, and beneath it a ~11px tagline in `--color-ink-3`. Then the section label
`TEAM (n)` — ~10px, uppercase, letter-spaced, `--color-ink-3`. Then the roster rows: a 26px round
`--color-field` chip holding the member's avatar, then the display name at ~13px in `--color-ink-2`,
with `(You)` appended for the signed-in member. Then the nav block, one row per destination, the four
admin items last. Then a flex spacer, so the two blocks below are pinned to the bottom. Then the
legend card: a rounded `--color-field` panel with three rows, each a small filled dot and an ~11px
label. Then the account footer: the same avatar chip, the display name at ~12px with the role beneath
it at ~9px uppercase letter-spaced, and the sign-out control pushed to the right.

**The top bar** spans the content pane only, not the sidebar, ~70px tall, on `--color-bg` with no
card behind it. Left cluster: `‹`, the anchor, `›`, then a pill-outline `Today`. Right cluster: the
three-segment switcher on a `--color-track` pill with the active segment a white inset pill carrying
`--shadow-soft`, then the solid `--color-primary` pill `+ Book`.

**Focus and colour, inherited not invented.** Every interactive element carries UIE-01's focus
treatment — `outline: 2px solid var(--color-ink)` at `outline-offset: 2px` on `:focus-visible`. The
active switcher segment is distinguished by fill, weight **and** `aria-current="page"`, never by
colour alone. The three legend swatches are peach, mint and lavender per `CLAUDE.md` § *Visual
direction*; the tokens they need do not exist yet and are added to the `@theme` block in
`src/index.css` beside UIE-01's, as `--color-pto`, `--color-wfh` and `--color-holiday`.

### 4.10 `src/routes/WeekView.tsx` — one optional prop. Added at PLAN rework 1

```tsx
interface WeekViewProps {
  /**
   * At `/` only. Resolve the current week IN PLACE instead of redirecting to `/week/<today>`.
   * Defaults to false, so `/week` and `/week/:day` behave exactly as CAL-05 shipped them.
   */
  landing?: boolean;
}

export default function WeekView({ landing = false }: WeekViewProps): JSX.Element;
```

The change inside the component is three lines and it does not touch a read, a render branch or a
selector:

```tsx
const landingDay = useMemo(() => currentDay(), []);
const anchorDay = day !== undefined && isRealDay(day) ? day : landing ? landingDay : null;
if (anchorDay === null) return <Navigate to={`/week/${currentDay()}`} replace />;
```

`weekStart` derives from `anchorDay` rather than from `day`, and the `const anchorDay = day as string`
assertion at `src/routes/WeekView.tsx:254` is deleted because the value is now resolved above.

**`landing` is memoised on mount, not read per render**, so the anchor cannot change under a
re-render — the same stability `/week/:day` gets from the URL.

**CAL-05's shipped criteria are untouched.** `landing` is false on both `/week` routes, so `/week`
with no anchor still redirects to the current week (CAL-05 AC-1, AC-14) and `/week/:day` still keeps
the date the caller arrived with. Nothing in `tests/e2e/cal-05-week-view.spec.ts` changes, and it
passes unedited.

## 5. Seam impact

**None.** No function in `src/lib/data/index.ts` changes name, arity or return type, and none is
added, so the seam-parity test has nothing new to check. The shell makes exactly one seam call,
`seam.listMembers()`, from `src/hooks/useRoster.ts` — an existing function already called by
`src/routes/MemberList.tsx:54` and by all three period screens.

No file in § 7 imports `src/lib/data/mock` or `src/lib/data/supabase`; the only door is
`@/lib/data`, which is what RULE-02's lint rule checks. `src/lib/period.ts` imports nothing from
`src/lib/data/` at all — it is pure string arithmetic over `yyyy-MM-dd`.

## 6. Schema delta

`none`. Nothing under `supabase/` is opened, no migration is written, and no policy, trigger or
constraint is touched — so ADR-014's carve-out-free rule is not engaged. `requires_adr` stays
`false`; nothing here reaches the registry, a schema or a new dependency.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/UIE-02/**"
  - "src/App.tsx"
  - "src/components/AppShell.tsx"
  - "src/components/Sidebar.tsx"
  - "src/components/TopBar.tsx"
  - "src/hooks/useRoster.ts"
  - "src/lib/period.ts"
  - "src/index.css"
  - "src/routes/Home.tsx"
  - "src/routes/WeekView.tsx"
  - "src/routes/MonthView.tsx"
  - "src/routes/YearView.tsx"
  - "tests/e2e/cal-03-admin-edit-entry.spec.ts"
```

Twelve source paths. `size: M` — `.ai/01-operating-model.md:373` puts 7–12 at M, so this is M and
nothing splits. **It is M by one file, which is worth saying out loud rather than leaving to be
noticed at the boundary.**

**`size_estimate` and `size` agree, both `M`.** § 1's estimate counted surfaces and arrived at M;
§ 7's count arrives at twelve and also M. ADR-012 is not engaged.

**One spec file is now in scope, and the cut is no longer zero-spec-files.** That is a real loss —
`ticket.yaml` § 1 calls zero spec files *the whole point of this cut* — and it is spent on one line
for a reason that has nothing to do with the twelve `home-*` ids or with `/`. AC-24 states it:
`tests/e2e/cal-03-admin-edit-entry.spec.ts:493` asserts page-wide that an entry owner's display name
is absent from a refusal screen, and the sidebar roster now names every active member on every
screen. The assertion is scoped to the content pane; its stated intent — *"a refusal that said what
it was withholding would be the read it is refusing"* — is preserved exactly, because the roster is
a read `Read the member list` grants a member outright and `/members` already performs.

**Measured, not predicted.** With AC-5 as amended and this one assertion scoped, the end-to-end suite
is **164 passed, 1 failed → 165 passed**: the twenty-five failures `03-impl-log.md` reports collapse
to this single assertion, and the other fourteen spec files pass unedited. The measurement was taken
by building AC-5 and § 4.10 in the working tree, running `pnpm exec playwright test`, and **reverting
the source** — PLAN does not ship code, and the tree `03-impl-log.md` left is the tree the Developer
resumes from.

**`03-impl-log.md`'s option 1 said sixteen paths were "still M". They are not — sixteen is L**
(`.ai/01-operating-model.md:373`), **and L must split at PLAN.** No legitimate split existed: the only
line available was the shell on one side and the five test helpers on the other, which is the
backend-from-frontend split `.ai/01-operating-model.md:380` forbids by name — *a half ticket reaches
DONE having demonstrated nothing*. That arithmetic is why option 1 was not taken, more than the loss
of the zero-spec-file property was.

**Three paths are here that `ticket.yaml` § 1 does not list, and each is forced rather than chosen.**
`src/routes/MonthView.tsx` and `src/routes/YearView.tsx` are where `shiftMonth` and `shiftYear` are
defined, and § 7 of that file requires both to move to a shared module — a move edits the file it
moves from. `src/routes/WeekView.tsx` joins them because `mondayIndex` is duplicated there and in
`MonthView`, and the top bar needs it; moving one definition and leaving two copies would be worse
than the duplication that exists today. **All three edits are import swaps and deletions of
now-shared definitions. No rendered output on any of the three screens changes** — which is what
keeps *Out of scope* item 1 true and zero spec files in scope.

**`src/lib/period.ts` is a new path and `src/routes/Home.tsx` is a deletion.** Neither is a glob.
`.ai/board/tickets/UIE-02/**` is the ticket folder, which both `check-allowed-paths.mjs` and
`guard-allowed-paths.mjs` exempt unconditionally.

**The twelve `home-*` ids still need no spec file, and that half of the original claim held under
measurement** — `03-impl-log.md` reports no failure caused by a missing or duplicated selector. What
the claim did not cover was the **route** (AC-23) and the **roster's text** (AC-24). Both are
recorded above; the first costs no spec file at all and the second costs one line in one.

## 8. Rejected alternatives

**1. A wrapper component around `<Routes>`, with a `useLocation()` conditional inside it.**
Genuinely plausible: it is the smallest diff, it needs no route-table surgery, and it is what most
React applications do. Rejected because the shell must not paint on `/signin` and `/signup`, and the
only way a wrapper can avoid that is to ask the location which route it is on — which is the route
table re-expressed as an if-statement, inside a file that already uses the router for exactly this
distinction six times over. The condition would then have to be extended by hand every time a route
is added, and the failure is silent: a new auth-adjacent route simply appears with a sidebar. The
layout route puts the same decision where the router can enforce it.

**2. The shell's view switcher reusing `week-month`, `month-week`, `year-month` and a new
`year-week`.** This is what `ticket.yaml` § 7 proposes, and it is attractive: no new selector names,
and UIE-03 would then have nothing to move. Rejected because the screens keep their own headers
through this ticket, so each of those ids would resolve to two nodes and Playwright's strict mode
fails the locator rather than picking one — fifteen spec files, and the exact failure § 5 of that file
calls the one way this ticket goes red. The alternative was to remove the screens' headers here
instead, which puts spec files into this ticket and destroys the cut.

**3. Keeping `src/routes/Home.tsx` as a landing screen, with the shell around it.** Plausible: it is
the smallest change to the route table, it keeps all twelve `home-*` ids in the file that owns them,
and it makes AC-6 trivially true. Rejected because it leaves the product with two navigations — a
sidebar and a screen of the same links — and the doubling would be permanent rather than the one
ticket's-worth this plan already accepts for the period headers. The feature row is explicit that
`Home.tsx` does not survive.

**4. Folding the three per-screen clocks into `src/lib/period.ts` so the top bar could resolve an
absent anchor itself. ~~Rejected.~~ PARTLY ADOPTED AT PLAN REWORK 1, AND THE ORIGINAL ARGUMENT IS
KEPT BELOW BECAUSE ITS PREMISE IS WHAT FAILED.**

> ~~Rejected because the top bar does not need a clock at all: an anchorless address is one the
> screen redirects immediately, so rendering no period cluster for that single render (AC-16) is
> both correct and cheaper than making the shell a fourth source of "what day is it".~~

**The premise was "an anchorless address is one the screen redirects immediately", and AC-5 as
amended makes it false for exactly one address.** `/` no longer redirects; it is where a member
rests. A top bar that drew no period cluster there would leave the product's landing screen with no
prev, no next, no anchor and no view switcher — and UIE-03, which deletes the screens' own headers,
would inherit a landing screen with no period controls at all. So `currentDay()` moves into
`period.ts` (§ 4.5) and `periodNavFor("/")` returns the current week.

**One clock moves, not three.** `MonthView`'s `currentMonth` and `YearView`'s `currentYear` stay
where they are: nothing outside those files needs them, and each carries a comment explaining why a
**local** date read is correct there and UTC everywhere else — an argument that belongs beside the
screen it is about. `/month` and `/year` still yield `null` from `periodNavFor`, because they are
still redirected within a render. Open question 4 is narrowed accordingly rather than closed.

**5. Putting `home-new-entry-link` in the sidebar and an unaddressed `+ Book` button in the top
bar.** This is the literal reading of `ticket.yaml` § 5. Rejected because an unaddressed control
cannot be asserted by any test — `.ai/standards/ui-design-system.md` § *Selectors*, a control added
without one cannot be addressed — and two controls to one address is the duplication problem wearing
different names.

**6. Widening `allowed_paths` to the five spec files whose helpers walk history back to `/`, and
adding an AC for the helper change.** This is `03-impl-log.md`'s option 1 and it was seriously
considered — the helpers' intent is *"walk back to a screen carrying `home-sign-out`"*, which is true
on every shell route, so the edit would be honest maintenance rather than a test bent to fit. Two
things rejected it. **The arithmetic**: eleven paths plus five is sixteen, and sixteen is L, not M —
`.ai/01-operating-model.md:373` — and L must split at PLAN. The only split available is the shell on
one side and the test helpers on the other, which `:380` forbids by name. **And the cost**: it spends
the zero-spec-file property that `ticket.yaml` § 1 calls the whole point of the cut, on five files,
to work around a redirect that had no requirement behind it. AC-5 said "redirected" because that is
what the feature row's prose said, not because anything needed a redirect.

**7. Keeping `/` as a redirect and restoring it to history by dropping `replace`.** `03-impl-log.md`
rejected this and it is right: arriving at `/` by `popstate` re-fires the redirect and forwards the
caller onward, so the browser Back button never leaves the week view. It is recorded here because it
is the obvious first idea and the reason it fails is not obvious until you try it. AC-23's second
clause exists to make that a criterion rather than a memory.

## Changelog

- `2026-09-07T11:15:03+07:00` — sections 1, 2, 2b written from `ticket.yaml`, the feature row and
  `design/README.md` before the source tree was read for 3–8, per the template's ordering habit.
- `2026-09-07T11:15:03+07:00` — section 2 *Premise corrections* added after reading the source tree.
  Four statements in `ticket.yaml` were stale: ADM-04/05/06 are `DONE`, there are twelve `home-*` ids
  rather than eleven, fifteen spec files address them rather than twelve, and there are five route
  guards rather than four with every line number moved. **No AC was reshaped to fit what was easy to
  build; AC-6 and AC-8 were *widened* by the correction** — `home-pending-entries-link` joined both.
  Raised by `tech-lead-design`. Amended by `tech-lead-design`.
- `2026-09-07T11:15:03+07:00` — section 7 gained `src/routes/WeekView.tsx`, `MonthView.tsx` and
  `YearView.tsx` after reading where `shiftMonth`, `shiftYear` and `mondayIndex` are defined.
  `ticket.yaml` § 1 lists seven paths; the move § 7 of that file mandates cannot be made without
  editing the files it moves out of. Raised by `tech-lead-design`. Amended by `tech-lead-design`.

---

**PLAN rework 1 — `2026-09-07T12:07:00+07:00`.** Routed here by `03-impl-log.md`'s `gate: BLOCKED`,
the *R5 impossible as specified* row of the failure-routing table. `rework_count` is NOT incremented
(RULE-08): the defect is this plan's, not the Developer's, and the implementation it produced is
correct against the plan it was given.

- **section 2, AC-5 amended.** It required `/` to redirect a member to `/week`. It now requires `/`
  to *be* the current week, inside the shell, with no redirect. **The redirect had no requirement
  behind it** — it was written because the feature row's prose says "redirects", and the cost was
  twenty-five shipped acceptance tests across five spec files whose helpers walk browser history
  back to `/`. Raised by `developer`. Amended by `tech-lead-design`.
- **section 2, AC-23 added.** `/` is an address the application rests on, and Back is never a trap.
  This is the property the plan asserted nowhere and § 7 was silent about. Raised by `developer`.
  Amended by `tech-lead-design`.
- **section 2, AC-24 added, and section 7 gained one spec file.** Found by measurement here, not
  reported by `03-impl-log.md`: the sidebar roster names every active member on every screen, and
  `tests/e2e/cal-03-admin-edit-entry.spec.ts:493` asserts page-wide that an owner's name is absent
  from a refusal screen. Independent of `/` — it survives every option on the table. Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.
- **section 2, AC-15 amended** to name `/` as a period route.
- **sections 4.5, 4.6 and new 4.10.** `periodNavFor("/")` resolves the current week; `/` becomes the
  layout route's index route rendering `<WeekView landing />`; `WeekView` gains one optional prop
  and `currentDay()` moves into `src/lib/period.ts`.
- **section 8, rejected alternative 4 amended**, with the superseded wording kept: its premise was
  that an anchorless address is always redirected within a render, which AC-5 makes false for `/`.
  **Alternatives 6 and 7 added** — the two options `03-impl-log.md` put to this stage, each recorded
  with why it was not taken.
- **Measurement, and it is the reason this amendment is not an argument.** AC-5 and § 4.10 were built
  in the working tree, `pnpm exec playwright test` was run, and **the source was reverted**: 25
  failures → 1, the survivor being AC-24's assertion. The tree `03-impl-log.md` left is byte-for-byte
  the tree the Developer resumes from; typecheck and lint re-run clean against it.
- `2026-09-07T14:20:00+07:00` — **AC-12 corrected and § 4.5 gained the stepping rule it never
  stated.** Raised by `developer` in `99-questions.md` after REWORK cycle 1. AC-12 gave three week
  addresses stepped ±7 days from the anchor day in the URL; `periodNavFor` steps from the **Monday**
  of the anchor's week, so the two disagreed about the address while agreeing about the week.
  **The implementation was right and the AC was wrong** — Monday normalisation is not a choice made
  in `period.ts`, it is what CAL-05 shipped at `WeekView.tsx:287,293` and what
  `tests/e2e/cal-05-week-view.spec.ts:271-289` already asserts from the very anchor AC-12 uses,
  ending on `toHaveURL(/\/week\/2026-10-12$/)`. Stepping from the anchor day would have put two
  different week-stepping rules on one screen — the top bar by Wednesdays, the in-page `week-prev` /
  `week-next` links beside it by Mondays — which is the duplication § 4.5 exists to remove, in
  behaviour rather than in code. **No code changed**; the amendment is to this artifact only, and
  § 4.5 now fixes the arithmetic it previously left unstated for both the `/week/:day` and the `/`
  arm. Amended by `tech-lead-design`.
