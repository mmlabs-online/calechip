---
ticket: UIE-02
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-07T14:00:28+07:00
cycle: 3   # REVIEW rework 1. Cycle 2's front-matter is superseded, not deleted.
inputs_read:
  - .ai/board/tickets/UIE-02/01-plan.md (as amended at PLAN rework 1)
  - .ai/board/tickets/UIE-02/ticket.yaml
  - .ai/board/tickets/UIE-02/design/README.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/01-operating-model.md
  - src/App.tsx
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - src/routes/YearView.tsx
  - src/routes/MemberList.tsx
  - src/routes/TeamEntries.tsx
  - src/components/AuthCard.tsx
  - src/hooks/useSession.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/day-status.ts
  - src/lib/domain/types.ts
  - src/index.css
  - eslint.config.js
  - ui-language.json
  - playwright.config.ts
  - tests/e2e/cal-03-admin-edit-entry.spec.ts (in allowed_paths since PLAN rework 1)
  # ADDED AT CYCLE 3
  - .ai/board/tickets/UIE-02/04-review.md (the FAIL this cycle answers)
  - .ai/board/tickets/UIE-01/01-plan.md (AC-16, the criterion finding 1 turns on)
  - .ai/templates/questions.md
consulted:
  - with: tech-lead-design
    asked: "AC-12 gives three literal week addresses for prev/next stepping and periodNavFor
      produces three others — it steps from the Monday, the AC steps from the anchor day. Which is
      the contract? 99-questions.md carries the full question and two closing answers."
    answer: "pending — asked 2026-09-07T06:58:25Z, unanswered at the time of writing"
    resulted_in_amendment: false
chat_before_verdict: none   # RULE-12 holds: 99-questions.md was written AFTER 04-review.md was on
                            # disk, and it addresses `tech-lead-design`, which is not this ticket's
                            # judge. Nothing was asked of `tech-lead-review` at any point.
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# UIE-02 — implementation log

**Cycle 2. The BLOCKED verdict this file carried on 2026-09-07 at 11:53 is spent**: `tech-lead-design`
amended AC-5 so `/` renders the current week in place rather than redirecting, added AC-23 and AC-24,
added § 4.10, and put one spec file into `allowed_paths`. This cycle implements that amendment. The
previous cycle's account of what was built is preserved below where it still describes the tree; what
changed is marked *cycle 2* throughout.

`rework_count` is **not** incremented — this routed to `tech-lead-design` under the *R5 impossible as
specified* row of the failure-routing table, and RULE-08 keeps an upstream defect off the Developer's
budget.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/period.ts` | created | The pure period vocabulary the top bar needs. `shiftMonth`, `shiftYear`, `mondayIndex`, `monthLabel` and the three shape tests moved here out of the three screens; `weekLabel` and `periodNavFor` are new. **Cycle 2: gained `currentDay()`, and `periodNavFor("/")` now resolves the current week.** Imports nothing from `src/lib/data/` | § 4.5 |
| `src/hooks/useRoster.ts` | created | The sidebar's one seam read, `seam.listMembers()`, with the loading and failure phases AC-10 requires and the `removedAt` filter kept above the seam | § 4.4 |
| `src/components/Sidebar.tsx` | created | The sidebar: brand, roster, seven nav items, legend, account footer. Eleven relocated `home-*` ids | § 4.2 |
| `src/components/TopBar.tsx` | created | The top bar: period cluster, three-segment switcher, and the twelfth relocated id `home-new-entry-link` | § 4.3 |
| `src/components/AppShell.tsx` | created | The layout route's element — sidebar, top bar and `<Outlet />`, and the two-pane frame | § 4.1 |
| `src/App.tsx` | modified | The layout route with its conditional element; `BareLayout`; `app-root` gives up `p-8` for a flex column. **Cycle 2: `/` became this layout's index route rendering `<WeekView landing />`, and the catch-all moved inside the layout** | § 4.6, § 4.7 |
| `src/index.css` | modified | `--color-pto`, `--color-wfh` and `--color-holiday`, added beside UIE-01's tokens, for the three legend swatches | § 4.9 |
| `src/routes/Home.tsx` | **deleted** | The feature row says it does not survive. Its twelve `home-*` ids are now in the shell | § 4.6 |
| `src/routes/WeekView.tsx` | modified | Import swap: `mondayIndex` and `isRealDay` moved to `@/lib/period`. **Cycle 2: gained the optional `landing` prop, and `today()` moved out to `currentDay()`** | § 4.5, § 4.10 |
| `src/routes/MonthView.tsx` | modified | Import swap only. `MONTH_NAMES`, `mondayIndex`, `shiftMonth`, `monthLabel` and the month shape test moved out; no rendered output changed | § 4.5 |
| `src/routes/YearView.tsx` | modified | Import swap only. `shiftYear`, the year shape test and the twelve abbreviated month names moved out; no rendered output changed | § 4.5 |
| `tests/e2e/cal-03-admin-edit-entry.spec.ts` | modified | **Cycle 2, one line.** AC-24: the page-wide `getByText(OWNER_NAME)` at `:501` is scoped to the refusal, which the sidebar roster otherwise matches | AC-24 |

Twelve paths, all inside `allowed_paths` as amended. Nothing else under `tests/` was touched.

**`src/App.tsx`'s diff is still mostly re-indentation** — sixteen `<Route>` elements are children of
the layout route now. `git diff -w` is the honest reading of that file.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `AppShell` | `src/components/AppShell.tsx:27` | `AppShellProps` exactly as contracted |
| 4.2 `Sidebar` | `src/components/Sidebar.tsx:86` | `SidebarProps` exactly as contracted |
| 4.3 `TopBar` | `src/components/TopBar.tsx:49` | Takes no props; reads `useLocation().pathname` |
| 4.4 `useRoster` / `RosterState` | `src/hooks/useRoster.ts:42`, `:24` | Three phases, one seam call, `removedAt` filtered above the seam |
| 4.5 `MONTH_NAMES` | `src/lib/period.ts:42` | Full spelling; see Deviations 1 |
| 4.5 `mondayIndex` | `src/lib/period.ts:111` | Moved verbatim from the two screens that held identical copies |
| 4.5 `isRealDay` | `src/lib/period.ts:140` | Same rejected dates; see Deviations 2 |
| 4.5 `isRealMonth`, `isRealYear` | `src/lib/period.ts:150`, `:154` | |
| 4.5 `shiftMonth`, `shiftYear` | `src/lib/period.ts:161`, `:169` | Moved verbatim |
| 4.5 `monthLabel` | `src/lib/period.ts:173` | Moved verbatim |
| 4.5 `weekLabel` | `src/lib/period.ts:191` | New; see Deviations 3 |
| 4.5 **`currentDay`** | `src/lib/period.ts:226` | **Cycle 2.** Moved from `WeekView.tsx:89`; the module's one clock |
| 4.5 `PeriodKind`, `PeriodNav` | `src/lib/period.ts:231`, `:233` | |
| 4.5 `periodNavFor` | `src/lib/period.ts:277` | **Cycle 2: `/` handled first, at `:285`**, `kind: "week"` anchored at `currentDay()`. Every other anchorless address still yields `null` |
| 4.6 the layout route | `src/App.tsx:140` | Conditional element, `AppShell` or `BareLayout` |
| 4.6 `BareLayout` | `src/App.tsx:35` | Carries the `p-8` that `app-root` gave up |
| 4.6 **the index route** | `src/App.tsx:172` | **Cycle 2.** `<Route index>` with the three-way element; a member gets `<WeekView landing />` |
| 4.7 the banner | `src/App.tsx:69`, `:77` | `app-root` and `seam-banner` keep their names and positions |
| 4.8 the selector allocation | see § Testability contract | All 27 ids exist exactly once |
| 4.9 the layout | `Sidebar.tsx:135`, `TopBar.tsx:87`, `AppShell.tsx:33` | 216px sidebar, 70px bar, focus treatment inherited from UIE-01 |
| 4.10 **`WeekViewProps.landing`** | `src/routes/WeekView.tsx:109`, `:125` | **Cycle 2.** Three lines inside the component: `:137`, `:138`, `:231` |

**RULE-04 holds.** No field name appears in the code that did not appear in the contract first, with
one addition — `MONTH_ABBR` (`src/lib/period.ts:65`) — declared as Deviation 1 below.

## Deviations from the design

Five. **The blocking one from cycle 1 is gone** — it was not a deviation but a defect in the design,
and PLAN fixed it. Deviation 4 also dissolved: § 4.6 as amended puts the catch-all inside the layout
route, which is where it now is.

**1. `src/lib/period.ts` exports `MONTH_ABBR` as well as `MONTH_NAMES`.** § 4.5 states that
`MONTH_NAMES` is duplicated at `MonthView.tsx:67` and `YearView.tsx:66`. **Measured in this tree, it
is not.** MonthView spells the months in full (`"January"`) for its `April 2026` heading; YearView
abbreviates them to three letters (`"Jan"`) for its twelve column headings. The two lists have never
held the same strings, so one export cannot carry both, and `monthLabel`'s contracted output
(`April 2026`) fixes which spelling `MONTH_NAMES` must have. Both lists moved, as two exports.
**No rendered string changed on either screen.** *Unchanged from cycle 1; PLAN did not amend § 4.5's
premise here, so it is restated rather than dropped.*

**2. `isRealDay` no longer round-trips through `addDays`.** `WeekView.tsx` caught the `2026-02-30`
roll-over with `addDays(day, 0) === day`. § 5 forbids `src/lib/period.ts` any import from
`src/lib/data/`, so it does the calendar arithmetic directly (`period.ts:124`, the leap rule in
full). Same rejected dates, one fewer coupling.

**3. `weekLabel` prints both years when a week crosses 31 December** — `29 Dec 2025 – 4 Jan 2026`.
The contract shows only the same-year form. Printing one year for a range spanning two would be wrong
rather than terse. Roughly one week in fifty-two.

**4. `home-sign-out` navigates to `/signin` on success** — `Sidebar.tsx:117`. **Carried forward from
cycle 1, and PLAN's amendment did not remove the need for it.**

`Home.tsx` never had a redirect because it *was* the `/` route: ending the session re-rendered `/` and
the router sent the caller to the sign-in screen with nothing written anywhere. TEA-05 AC-6 is that
behaviour and `tests/e2e/tea-05-sign-in.spec.ts:113` asserts it. The control is now on fourteen
routes, **six deliberately unguarded** (AC-3), so signing out on `/week` ended the session and left
the caller reading `week-not-on-a-team` with no route back. **This is still true after AC-5's
amendment** — `/` resting on the week fixes history, not sign-out from the other thirteen addresses.
Twenty-nine acceptance tests measured it in cycle 1 and pass with the one line.

**5. AC-24 is satisfied by scoping to `team-entries-refused` rather than to a new content-pane
selector.** AC-24 says *"no entry owner's display name appears in the content pane"*, and the shell's
content pane carries no `data-testid` — adding one would put a selector in the code that § 4.8's table
does not list, which is the RULE-04 line. It is not needed: in the refused state `TeamEntries`
returns `team-entries-refused` as **its entire render** (`src/routes/TeamEntries.tsx:124-136`), so
that element *is* the content pane on this screen. `tests/e2e/cal-03-admin-edit-entry.spec.ts:501`.

## Invariants

`invariants_touched: []`, reached structurally in `01-plan.md` § 2. The argument survived both cycles
and can be checked against the code:

| ID | Still holds because |
|----|---------------------|
| all seven | Every one of the seven rows at `.ai/registry/invariants.md:33-39` constrains an `entry` row or the member it belongs to. **No file in this ticket writes anything.** The shell makes exactly one seam call anywhere, `seam.listMembers()` at `src/hooks/useRoster.ts:52`, a read `src/routes/MemberList.tsx:54` already makes under a policy admitting both roles. `src/lib/period.ts` imports nothing from `src/lib/data/`. No query, no policy, no migration, no arithmetic over entries in any of the twelve paths. |

**INV-04's denominator is the one place this ticket could have gone wrong quietly, and it did not.**
`useRoster` filters `removedAt !== null` for DISPLAY, above the seam, at `useRoster.ts:56` — the same
decision `MemberList.tsx:179` makes and with the same comment saying not to push it below. The seam
still returns removed members carrying `removedAt` (ADR-013), so every counting function still gets
the roster it needs. The sidebar's count is a display count and nothing divides by it.

**Cycle 2 adds no read and no write.** `currentDay()` is a clock, not a datastore call, and
`<WeekView landing />` performs exactly the reads `WeekView` already performed at `/week/:day`.

## Verification run

Commands actually executed, with exit codes.

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | the command named in `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | same. AC-18: no diacritic violation, and no shell file added to `copyDebt` |
| `pnpm exec vitest run` | 0 | 10 files, 186 tests |
| `pnpm exec playwright test --workers=1` | **0** | **165 passed, 0 failed** |
| the same, on `HEAD` with this ticket stashed (cycle 1) | 0 | **165 passed** — the baseline, so the suite is now exactly level with it |
| the same, cycle 1's tree | 1 | 142 passed, 23 failed. Recorded so the amendment's effect is legible |
| `git diff --name-only` subset of `allowed_paths` | yes | twelve paths, all listed |

**165 = 165. The suite is level with the pre-ticket baseline**, and PLAN's own measurement
(*25 failures → 1, the survivor being AC-24's assertion*) is reproduced: AC-24's one-line scoping is
what closes the last of them.

### The nine criteria no shipped spec covers

AC-5, AC-15, AC-16, AC-21 and AC-23 are new or amended, and the `shell-*` ids are new, so **no spec
file in the repository asserts any of them** — a green suite is necessarily silent about the whole of
what this ticket adds. They were driven in a real browser against `vite build && vite preview`, from
a throwaway Playwright project **in the session scratchpad**, with its own config and its own
`testDir`. Nothing was written under `tests/` — a temporary spec there would be outside
`allowed_paths` and a RULE-03 breach, temporary or not. **All nine passed.**

| Checked | Result |
|---|---|
| AC-5 — a member sees the current week **at `/`**, address unchanged, and `/` does not move on its own after 600ms | pass |
| AC-12/AC-15 — `/` carries the whole period cluster, `shell-view-week` has `aria-current="page"`, the other two do not | pass |
| AC-23 — from `/` to `/year`, Back returns to `/`, `home-sign-out` is there, and `/` still does not move | pass |
| AC-15 — on `/entries/new` all seven period ids resolve to zero while `shell-topbar` and `home-new-entry-link` remain | pass |
| AC-6/AC-7/AC-8 — all twelve `home-*` ids resolve to exactly one for an admin; `home-member-role` reads `Admin` | pass |
| AC-9/AC-11 — `shell-legend-row` is exactly three; `shell-roster-count` agrees with the `shell-roster-row` count | pass |
| AC-21 — `scrollWidth === clientWidth` at 1280px **and** at 1024px | pass |
| AC-16 — `/week/banana` draws no anchor built from `banana`; the screen's redirect lands and the cluster describes where it landed | pass |
| AC-2/AC-3 — signed out at `/week`: no `shell-sidebar`, no `shell-topbar`, `week-not-on-a-team` visible, no redirect away | pass |

**These are throwaway checks and not shipped tests.** They are recorded here because the claim
*"every contract item is implemented"* is otherwise unverifiable by anything the reviewer can run,
and because AC-23 in particular is a property — *`/` is somewhere the application comes to rest* —
that cycle 1 proved is not safe to assert from reading the router.

## Testability contract

Every selector in § 4.8, and where it now exists. All 27 render exactly once in the states their
criteria name; the first nine rows and the last were driven in the browser, above.

| selector | Exists at |
|----------|-----------|
| `shell-sidebar` | `src/components/Sidebar.tsx:135` |
| `shell-topbar` | `src/components/TopBar.tsx:87` |
| `shell-brand` | `src/components/Sidebar.tsx:138` |
| `shell-roster-count` | `src/components/Sidebar.tsx:167` |
| `shell-roster-row` | `src/components/Sidebar.tsx:177` |
| `shell-roster-loading` | `src/components/Sidebar.tsx:150` |
| `shell-roster-unavailable` | `src/components/Sidebar.tsx:158` |
| `shell-legend-row` | `src/components/Sidebar.tsx:260` |
| `shell-period-prev` | `src/components/TopBar.tsx:100` |
| `shell-period-anchor` | `src/components/TopBar.tsx:108` |
| `shell-period-next` | `src/components/TopBar.tsx:115` |
| `shell-period-today` | `src/components/TopBar.tsx:126` |
| `shell-view-week` | `src/components/TopBar.tsx:64` |
| `shell-view-month` | `src/components/TopBar.tsx:70` |
| `shell-view-year` | `src/components/TopBar.tsx:76` |
| `home-member-avatar` | `src/components/Sidebar.tsx:277` |
| `home-member-name` | `src/components/Sidebar.tsx:280` |
| `home-member-role` | `src/components/Sidebar.tsx:286` |
| `home-sign-out` | `src/components/Sidebar.tsx:293` |
| `home-week-link` | `src/components/Sidebar.tsx:202` |
| `home-year-link` | `src/components/Sidebar.tsx:205` |
| `home-holidays-link` | `src/components/Sidebar.tsx:209` |
| `home-pending-entries-link` | `src/components/Sidebar.tsx:221` |
| `home-team-entries-link` | `src/components/Sidebar.tsx:228` |
| `home-allow-list-link` | `src/components/Sidebar.tsx:235` |
| `home-threshold-link` | `src/components/Sidebar.tsx:242` |
| `home-new-entry-link` | `src/components/TopBar.tsx:169` |

`app-root` (`src/App.tsx:69`) and `seam-banner` (`src/App.tsx:77`) keep their names and their
positions, AC-17. No screen id was renamed.

## Open questions

1. **`periodNavFor("/")` returns `todayTo: "/"` and `weekTo: "/"`, not `/week`.** § 4.5 fixes `kind`
   and the anchor for `/` and leaves the six `to` fields to the implementation. Both controls mean
   *the current week*, which is what `/` already shows, so pointing them at `/week` — which redirects
   again to `/week/<today>` — would move the address for a control whose meaning is "you are here"
   and would walk the caller off the one address AC-23 wants restful. `src/lib/period.ts:285-297`.
   One line each if PLAN wants the other reading.

2. **The sidebar's tagline is originated copy**, `Leave and working from home`
   (`Sidebar.tsx:52`). § 4.9 requires a tagline and the transcription's is Vietnamese, which
   § Language forbids. It describes what the board holds and asserts no capability, but nobody
   specified it.

3. **`+ Book` is originated copy** for the relocated `home-new-entry-link` (`TopBar.tsx:173`). The
   **id and the destination are unchanged**, which is what the fifteen spec files address; only the
   label is new.

4. **The product still shows two names.** `index.html:6` says `CaleChip`; the sidebar now says
   `Ai Nghỉ?` on every screen, following UIE-01 as `ticket.yaml` § 9.1 instructs. Still the
   operator's, and still one string in one file whichever way it goes.

5. **The application is knowingly doubled** — two headers on every period screen, per § 1 Out of
   scope item 1 and AC-22. **`/` shows them too**, and that is new in cycle 2 and worth saying plainly:
   the landing address now carries the shell's top bar *and* `WeekView`'s own header. A reviewer
   meeting two prev/next pairs at `/` is meeting a declared decision. UIE-03 removes the screens' own
   headers.

6. **`MemberList.tsx` still carries its own copy of `roleLabel`.** `Sidebar.tsx:34` is now the second
   copy, where `Home.tsx` was before — the duplication `Home.tsx:23-28` recorded and deliberately did
   not fold. Unchanged by this ticket, named so the next reader finds it.

7. **`landing` is memoised on mount** (`WeekView.tsx:137`), so a session left open across midnight
   keeps the week it opened with until a navigation. That is the same stability `/week/:day` has from
   the URL and § 4.10 asks for it in as many words; it is recorded because "the landing page is a day
   behind at 00:01" is the kind of thing found in use rather than in review.

---

# Cycle 3 — REVIEW rework 1

Everything above this line is cycle 2 and is left standing. `04-review.md` returned **FAIL** on R5
with one gating finding, and this section is the whole of the answer to it.

## What was wrong

§ 4.7 requires the `p-8` that `app-root` gave up to land *"where the auth screens' gutter has to be"*,
and cycle 2 put it on `BareLayout` — which `/signin` and `/signup` never render inside, because § 4.6
keeps them outside the layout route and cycle 2 read that as *outside every container*. So the two
auth screens lost their gutter entirely: `AuthCard`'s root is `mx-auto w-full max-w-[355px]` and
carries no padding of its own (`src/components/AuthCard.tsx:60`), and its comment at `:54` names
`App.tsx`'s `p-8` as the gutter. UIE-01 AC-16 requires a gutter on both sides at 360px.

The reviewer measured 2.5px a side at 360px and zero at 320px. **Reproduced before the fix and
measured again after it**, same method — `pnpm exec vite build && pnpm exec vite preview`, Chromium at
360 and 320, `auth-card`'s bounding box against the viewport:

| viewport | route | left | right | card | horizontal scroll |
|---|---|---|---|---|---|
| 360px | `/signin` | **32px** | **32px** | 296px | no |
| 360px | `/signup` | **32px** | **32px** | 296px | no |
| 320px | `/signin` | **32px** | **32px** | 256px | no |
| 320px | `/signup` | **32px** | **32px** | 256px | no |

32px is what `app-root`'s `p-8` gave before this ticket, so the gutter is not merely restored to
non-zero — it is restored to the exact value UIE-01 shipped against.

## The fix

A second `<Route element={<BareLayout />}>` parent over just the two auth routes
(`src/App.tsx:122-140`). This is the shape `04-review.md` itself names as the one that satisfies both
sections, and it is why the finding is *R5 implementable* rather than *R5 impossible as specified*:
§ 4.7 states the requirement correctly and only cycle 2's mechanism was wrong about where those two
routes render.

**§ 4.6 is not weakened by it.** "Outside the layout route" means outside the *shell* layout route —
the one whose element is chosen on membership — and the two auth routes are still not its children.
They evaluate no membership condition, they get no sidebar and no top bar, and `ticket.yaml` § 3's
requirement that the auth screens carry no chrome is untouched. The only thing they gain is the
padding.

**No amendment to `01-plan.md` was needed and none was made.** The requirement was already stated;
the code now meets it.

## Files touched at cycle 3

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/App.tsx` | modified | Wraps `/signup` and `/signin` in a `BareLayout` parent route so the `p-8` § 4.7 relocates actually reaches them; comments on `BareLayout` and on the new parent record the measurement and why § 4.6 still holds | §4 item 4.7, and 4.6 unchanged |
| `.ai/board/tickets/UIE-02/99-questions.md` | created | `04-review.md` finding 2 routes the AC-12 stepping question to `tech-lead-design`, and a file write is the only channel there is | none — it is chat, not code |
| `.ai/board/tickets/UIE-02/ticket.yaml` | modified | `rework_count` 0 → 1 per RULE-08; `chat_budget` `used` 0 → 1 for the question above; `state` comment records this cycle | none — bookkeeping |
| `.ai/board/tickets/UIE-02/03-impl-log.md` | modified | This section | none — it is the log |

**No other file changed.** `src/lib/period.ts` is deliberately untouched: finding 2 is the reviewer's
own *recorded, not gating*, and § 4.5 fixes the arithmetic nowhere, so changing it would be the
Developer deciding a contract — which is exactly what `01-plan.md` is for. The question is open in
`99-questions.md`.

## Gate

- `pnpm exec tsc --noEmit` → **exit 0**
- `pnpm exec eslint .` → **exit 0**
- `pnpm exec playwright test --workers=1` → **165 passed, exit 0** — level with the cycle 2 baseline,
  which is the number `04-review.md` recorded. The suite is not the gate, but a rework that moved the
  route table owes the evidence that it moved nothing else.

Every contract item in § 4 was already implemented at cycle 2 and R5's table cites each one; 4.7 is
the single row that read **No** and it now reads yes, measured.

## Open questions carried forward

The seven from cycle 2 stand unchanged. One is added:

8. **AC-12's week stepping addresses disagree with `periodNavFor`.** `04-review.md` finding 2, asked
   of `tech-lead-design` in `99-questions.md`, non-gating, no code changed pending the answer. If the
   answer is **B** it is three lines in `src/lib/period.ts` and inside `allowed_paths`.
