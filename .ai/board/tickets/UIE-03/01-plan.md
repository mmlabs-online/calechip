---
ticket: UIE-03
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-07T15:01:57+07:00
inputs_read:
  - .ai/board/tickets/UIE-03/ticket.yaml
  - .ai/board/tickets/UIE-03/design/README.md
  - .ai/board/tickets/UIE-02/design/README.md
  - .ai/board/tickets/UIE-02/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/architecture.md
  - .ai/standards/testing-standards.md
  - .ai/01-operating-model.md
  - src/App.tsx
  - src/components/TopBar.tsx
  - src/components/Sidebar.tsx
  - src/components/AppShell.tsx
  - src/lib/period.ts
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - src/routes/YearView.tsx
  - src/routes/Holidays.tsx
  - tests/e2e/ (every spec referencing an id in § 0's table, counted rather than sampled)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# UIE-03 — the calendar screens give up their own chrome to the shell

## 0. What was re-measured, and the one premise that failed

`ticket.yaml` § 1 warns that its citations were re-measured on 2026-09-05 after CAL-08 and that they
"DID NOT MOVE BY A UNIFORM OFFSET". **They moved again**, because UIE-02 shipped on 2026-09-07 and
edited all three view files. Re-measured in this tree, and the offsets are once more not uniform:

| File | Shell said | Now | Offset |
|---|---|---|---|
| `WeekView.tsx` `<header>` | 277–315 | **278–316** | +1 |
| `MonthView.tsx` `<header>` | 331–378 | **311–358** | −20 |
| `YearView.tsx` `<header>` | 329–353 | **319–343** | −10 |
| `Holidays.tsx` | :272, :470 | **:272, :470** | unchanged |

**The premise that failed is § 2's, and it changes what this ticket is.** That section says the
anchors "MOVE INTO THE TOP-BAR TITLE CARRYING THEIR DATA ATTRIBUTES" and that the cross-view links
"ARE NOT REMOVED, THEY ARE REPARENTED" — both written as things UIE-02 would have done. **UIE-02 did
neither, deliberately.** Its top bar carries `shell-period-prev`, `shell-period-anchor`,
`shell-period-next` and `shell-view-week` / `-month` / `-year`, and `shell-period-anchor` carries
`data-period-kind` and nothing else. UIE-02's § 4.8 gives the reason and it is a good one: while both
copies existed, reusing an id would have resolved a locator to two nodes and Playwright's strict mode
fails rather than picking one.

**UIE-02 also handed this decision here, in terms:** *"UIE-03, which deletes the screens' headers, is
the ticket that may then decide whether the old names move onto the shell — it will have exactly one
copy of each to move."* So § 7's "the shell itself is out of scope" and UIE-02's plan disagree, and
**UIE-02's plan is the later document and the owner of those components**. § 4 takes the grant.

**What was actually at stake, counted rather than estimated.** Deleting four headers destroys these
ids unless the shell adopts them:

| Group | Ids | Spec references | Spec files |
|---|---|---|---|
| Anchors | `week-anchor`, `month-anchor`, `year-anchor`, `holidays-year` | **43** | 6 |
| Period controls | `week-prev/next`, `month-prev/next`, `year-prev/next`, `holidays-prev/next` | **26** | 6 |
| Cross-view | `week-month`, `week-year`, `month-week`, `month-year`, `year-month` | **14** | 4 |
| **Class B — meant to die** | `week-home`, `month-home`, `year-home`, `holidays-back` | **10** | 6 |

`ticket.yaml` describes a ticket that touches the last row only. The first three rows are 83 further
references, and every one of them would have broken.

**Three measurements make the resolution cheap, and all three were taken here:**

1. **No spec asserts any `shell-*` id.** UIE-02 touched zero spec files, so renaming its selectors
   costs nothing.
2. **No spec asserts an anchor's *text*.** All 43 anchor references read `data-week-start`,
   `data-month` or `data-year` via `toHaveAttribute`. The top bar can therefore keep its own human
   label and still satisfy every one of them.
3. **`periodNavFor` returns `null` for `/holidays`.** Only `week`, `month` and `year` are period
   routes, so the top bar renders no period cluster there at all — which decides § 1's scope for that
   screen.

## 1. Problem and scope

The feature ID this plan implements, transcribed from `.ai/registry/features.md:151` without
paraphrase:

| ID | Capability | Group | Status | Invariants touched |
|---|---|---|---|---|
| UIE-03 | The calendar screens give up their own chrome to the shell | UIE | PLANNED | [] |

**No role gains a capability, and after this ticket the product can do one thing less in four
places — which is the point.** UIE-02 shipped the shell and left the application knowingly doubled:
a member on `/week` sees the top bar's anchor, prev, next and view switcher, and immediately beneath
them the week screen's own. **This is the ticket where the doubling ends.** A member gains one
navigation instead of two, in the same position on every period screen, and the four screens become
what they are for — a grid, a month, a year and a holiday list.

**Out of scope.** Every item is a decision.

1. **The four screens' `<header>` contents are removed; nothing below them is touched.** The week
   grid's stacked layout is UIE-04's and `WeekView.tsx:318` down is untouched — including CAL-08's
   `week-day-holiday`, `week-day-bridge`, `data-day-status` and `data-bridge`, which are grid
   selectors this ticket may not reach.
2. **`month-threshold` survives.** It sits *inside* `MonthView.tsx`'s header at `:355`, it is
   **content and not chrome** — the top bar does not carry it and nothing in the shell replaces it —
   and four assertions across three spec files read its `data-threshold` and `data-current-members`.
   AC-10 is the positive statement; this is the warning that "delete the whole header" takes three
   spec files with it.
3. **`Holidays.tsx` keeps `holidays-prev`, `holidays-year` and `holidays-next`.** This departs from
   `ticket.yaml` § 2, which lists "period controls and the back-link removed", and the reason is § 0
   measurement 3: **`periodNavFor` returns `null` for `/holidays`, so the shell offers that screen
   nothing.** There is no duplication on that screen to remove, and removing the controls would leave
   an admin no way to change year — a functional regression, not a restyle. Teaching `period.ts` a
   fourth period kind is a *behaviour addition* to the shell, which is a different ticket from one
   that removes redundancy. **Only `holidays-back` goes**, and it goes because it is Class B.
4. **Every refusal and error heading, and every content `h1` the top bar does not title.**
   `AllowList.tsx:133,146`, `MemberList.tsx:140,156,184`, `TeamEntries.tsx:151,166,186`,
   `Threshold.tsx:163,185,206`. UIE-02's `BareLayout` exists so a member-less or signed-out caller
   still reaches these; deleting them here would finish the job it was built to prevent.
5. **`TeamEntries.tsx` and `Threshold.tsx` entirely**, and `EditEntry.tsx:121,200`. The first two
   have back-links to the landing route, which still resolves; `edit-entry-back` and
   `edit-entry-team-back` are not back-to-home links and no shell control replaces them. This is the
   premise most likely to be got wrong by a reader grepping for `-back`.
6. **`app-root`, `seam-banner` and `tests/e2e/smoke.spec.ts`.** The banner stays wherever UIE-02 put
   it; this ticket does not move it again. `smoke.spec.ts` is deliberately absent from every
   `allowed_paths` this project has written.
7. **The sidebar, `AppShell.tsx`, the roster hook and the legend card.** `TopBar.tsx` and `period.ts`
   are in scope for the id adoption in § 4 and for nothing else. The `Ngày lễ` legend row already
   exists — UIE-02 shipped it — and this is the ticket with `Holidays.tsx` open, so it is the
   likeliest to absorb a legend change by accident.
8. **The `Duyệt phép` button, the palette icon and the `?` button.** Shell controls, none
   corresponding to a decision taken anywhere. Ship absent, not disabled.
9. **The week grid as seven columns, the per-column absence count and the overload legend row.**
   UIE-04, and the last two are behaviour that reverses a decision in CAL-05's registry row.
10. **Translating any copy into Vietnamese.** Lint-enforced at `eslint.config.js:83-92`; `copyDebt`
    is empty as of OPS-002 and adding to it is that file's named failure mode.
11. **Dark mode**, stated rather than left silent.

`size_estimate: M`. Four screens stripped, two shell files adopting the names, six spec files losing
a navigation step each.

## 2. Acceptance criteria

**AC-1 — the week screen has no header of its own**
- Given a signed-in member on `/week/:day`
- When the screen renders
- Then no element on it is addressable as `week-home`, and the screen's own anchor, previous, next
  and cross-view controls are not rendered by the week screen; the first thing below the shell's top
  bar is the week's day list

**AC-2 — the month screen has no header of its own, except the threshold line**
- Given a signed-in member on `/month/:month`
- When the screen renders
- Then no element on it is addressable as `month-home`, the screen renders no anchor, previous, next
  or cross-view control of its own, and `month-threshold` is still present carrying both
  `data-threshold` and `data-current-members`

**AC-3 — the year screen has no header of its own**
- Given a signed-in member on `/year/:year`
- When the screen renders
- Then no element on it is addressable as `year-home`, and it renders no anchor, previous, next or
  cross-view control of its own

**AC-4 — the holidays screen loses its back-link and keeps its year controls**
- Given an admin on `/holidays/:year`
- When the screen renders
- Then no element is addressable as `holidays-back`, and `holidays-prev`, `holidays-year` (carrying
  `data-year`) and `holidays-next` are all still present and still navigate between years

**AC-5 — the four dead ids exist nowhere**
- Given the whole of `src/` and `tests/`
- When `week-home`, `month-home`, `year-home` and `holidays-back` are searched for
- Then none of the four appears in either tree

**AC-6 — the period anchor is addressable by the name of the period it names**
- Given a signed-in member on a week, month or year route
- When the top bar's anchor renders
- Then it is addressable as `week-anchor`, `month-anchor` or `year-anchor` according to the route,
  and carries `data-week-start`, `data-month` or `data-year` respectively, with the same value the
  screen's own anchor carried before this change

**AC-7 — the period step controls are addressable by the period they step**
- Given a signed-in member on a week, month or year route
- When the top bar's previous and next controls render
- Then they are addressable as `week-prev`/`week-next`, `month-prev`/`month-next` or
  `year-prev`/`year-next` according to the route, and each moves the address by one period of that
  kind

**AC-8 — each view-switcher segment is addressable by where it goes from where it is**
- Given a signed-in member on a week, month or year route
- When the view switcher renders
- Then each segment is addressable as `<current>-<target>` — so `week-month` and `week-year` from a
  week, `month-week` and `month-year` from a month, `year-month` and `year-week` from a year — and
  each keeps the date, reaching the target view's address for the period being looked at

**AC-9 — every relocated id resolves to exactly one element**
- Given any route inside the shell
- When any id named in AC-6, AC-7 or AC-8 is located
- Then it matches exactly one element, so a strict locator resolves rather than failing

**AC-10 — no grid, list or content element is touched**
- Given the four screens after this change
- When their content below the header is compared with what shipped before it
- Then the week day list, the month grid and its cells, the year rows and the holiday list are
  unchanged, including CAL-08's `week-day-holiday`, `week-day-bridge`, `data-day-status` and
  `data-bridge`

**AC-11 — no refusal, error or content heading is removed**
- Given a member-less or signed-out caller reaching any screen that refuses them, and a member
  reaching a screen the top bar does not title
- When each renders
- Then the refusal heading and the screen's own `h1` are both still present

**AC-12 — the spec edits are deletions of navigation steps and nothing else**
- Given the six spec files this ticket edits
- When their diff is read
- Then every change is the removal of a click on one of the four dead ids, together with anything
  that became unreachable only because of it; no assertion about an origin screen is rewritten, and
  no deleted step is replaced by a click on a shell control

**AC-13 — the whole suite passes with no other test edit**
- Given the unit and end-to-end suites
- When they run after this change
- Then every one passes, and no spec file outside the six is modified — the 83 references to
  relocated ids continuing to pass is the evidence that this ticket moved chrome rather than changed
  behaviour

**AC-14 — `Today` and the shell's own furniture are unchanged**
- Given any route inside the shell
- When the top bar renders
- Then `shell-topbar`, `shell-period-today` and `home-new-entry-link` are present with their existing
  names and behaviour, the sidebar is unchanged, and `app-root` and `seam-banner` keep their names
  and positions

**AC-15 — no string becomes Vietnamese**
- Given `src/` after this change
- When the lint command runs
- Then it exits 0, with no file added to `copyDebt`

**Invariants touched: `[]`** — reached here. All seven rows in `.ai/registry/invariants.md:33-39`
constrain `entry` rows or the member they belong to; none governs the appearance of a screen. The
structural argument, which is what avoids the circularity `invariants.md` warns about: **this ticket
deletes markup and renames test ids.** No query changes, no policy, no migration, no arithmetic;
`src/lib/data/absence.ts` is not in scope and is not touched; the four screens read exactly what they
read today, through the same seam calls. `period.ts` is pure and imports no seam. AC-10 and AC-13 are
the observable forms. ADR-028 records that `[]` is the answer on almost every UIE row and states it as
a cost of the group rather than permission to skip the question.

**Open questions.**

1. **`week-week`, `month-month` and `year-year` are created by AC-8's rule and referenced by
   nothing.** The mapping `<current>-<target>` produces a name for the segment pointing at the view
   you are already on, which the screens' own headers never needed because they never linked to
   themselves. Keeping the rule mechanical is worth three unreferenced ids; the alternative is a
   special case for the active segment, which is harder to describe than the thing it saves.
2. **`year-week` exists for the first time.** `UIE-02` § 4.8 declined to create it and said so; under
   AC-8's rule it appears naturally, has zero references, and breaks nothing.
3. **`shell-period-prev`, `shell-period-next` and `shell-period-anchor` cease to exist**, three
   tickets after UIE-02 named them. Nothing asserts them (§ 0 measurement 1), so the cost is
   documentary rather than behavioural — but UIE-02's `01-plan.md` § 4.8 will read as describing
   selectors that are gone. That is what a superseded plan looks like and it is not amended here.
4. **The holidays screen is now the only period-shaped screen with its own controls.** § 1 item 3
   explains why. It is a visible inconsistency in a ticket whose purpose is consistency, and a later
   ticket teaching `period.ts` a `holidays` kind would close it in one place.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

**Same situation as UIE-01 and UIE-02, and the line is the accurate one.** No image exists at
`.ai/board/tickets/UIE-03/design/`; that folder holds a `README.md`, which is a hand-written
transcription pointing at UIE-02's canonical copy of one image shown in conversation on 2026-09-05
that was never on disk. `.ai/standards/ui-design-system.md:105-125` describes moving an attached
image; nothing was attached in the sense that section means.

**What the transcription contributes here is an absence, which is why it is short**: the top bar is
described once and it is the only header on the screen. That is the whole of what this ticket takes
from it. **Everything else below is originated** — in particular the id mapping in § 4, which no
image could specify and which is the substance of this plan.

## 3. Permission model

**Nothing changes, and this ticket cannot change it.** It deletes markup and renames test ids; it
adds no control, removes no guard and calls no seam function that was not already called.

| Action | Who | Where the check lives | Changed here |
|---|---|---|---|
| Read the team's entries on any calendar view | member | row-level select policy (ADR-005) | no |
| Reach `/holidays` and edit the calendar | admin | row-level security on the holiday table | no |
| Reach a period route at all | anybody; each screen renders its own refusal | the screens' own state, not a route guard | no |

**The one thing worth a reviewer's eye is a denial that must survive.** Six routes are deliberately
unguarded and each renders its own refusal rather than redirecting — UIE-02 built `BareLayout` so a
member-less or signed-out caller still *reaches* them. AC-11 asserts those headings survive; § 1
item 4 lists them by line. Removing one would convert a documented refusal into a blank screen, which
is a permission-model change made by deletion.

## 4. Contract

No seam function changes, no signature moves, no component gains a prop. The contract of this ticket
is **the id mapping**, and it is exact because a wrong name is a red suite.

### 4.1 The grant, and why it is not scope drift

`ticket.yaml` § 7 puts "the shell itself" out of scope. **UIE-02's `01-plan.md` § 4.8 says the
opposite for exactly these ids** — *"UIE-03 … is the ticket that may then decide whether the old
names move onto the shell — it will have exactly one copy of each to move."* UIE-02 is the later
document and the owner of `TopBar.tsx` and `period.ts`. **This plan takes that grant, and it is
narrow: `TopBar.tsx` and `period.ts` may change test ids and the data attributes carried beside
them, and nothing else.** No layout, no styling, no navigation target, no new control.

### 4.2 `src/lib/period.ts` — `PeriodNav` gains what the ids need

```ts
export interface PeriodNav {
  kind: PeriodKind;
  label: string;                 // unchanged — the human string the top bar renders
  /** The raw anchor the screens' own h1 carried: `yyyy-MM-dd` (the MONDAY), `yyyy-MM`, or `yyyy`. */
  anchorValue: string;
  prevTo: string;                // unchanged, including the Monday normalisation
  nextTo: string;
  todayTo: string;
  weekTo: string;
  monthTo: string;
  yearTo: string;
}
```

**`anchorValue` is the only addition, and for `week` it is the Monday** — the same value
`WeekView`'s `data-week-start` carries and the same one `prevTo`/`nextTo` already step from. The
Monday normalisation settled on UIE-02 is untouched.

### 4.3 `src/components/TopBar.tsx` — the mapping

| Element | Was (UIE-02) | Becomes | Carries |
|---|---|---|---|
| anchor | `shell-period-anchor` | `` `${nav.kind}-anchor` `` → `week-anchor`, `month-anchor`, `year-anchor` | `data-week-start` on a week, `data-month` on a month, `data-year` on a year — set to `nav.anchorValue`; `data-period-kind` is kept |
| previous | `shell-period-prev` | `` `${nav.kind}-prev` `` | — |
| next | `shell-period-next` | `` `${nav.kind}-next` `` | — |
| switcher segment | `shell-view-<kind>` | `` `${nav.kind}-${segment.kind}` `` | `aria-current` unchanged |
| today | `shell-period-today` | **unchanged** | — |
| create | `home-new-entry-label` … `home-new-entry-link` | **unchanged** | — |
| the bar | `shell-topbar` | **unchanged** | — |

The nine segment names the rule produces, written out so nobody derives them wrongly:

| On | segments |
|---|---|
| `/week/:day` and `/` | `week-week`, `week-month`, `week-year` |
| `/month/:month` | `month-week`, `month-month`, `month-year` |
| `/year/:year` | `year-week`, `year-month`, `year-year` |

**Six of those nine are the names the screens' own cross-view links carried**, which is why 14
references keep passing untouched. Three are new and unreferenced (*Open questions* 1 and 2).

**The label is not the anchor.** The top bar keeps rendering `nav.label` — `1 Dec – 7 Dec 2025` — and
the screens' `h1`s rendered `Week of 2026-10-05`. That difference is safe and it was measured, not
assumed: **no spec asserts an anchor's text; all 43 references read a `data-*` attribute** (§ 0
measurement 2).

### 4.4 The deletions, by file

| File | Delete | Keep |
|---|---|---|
| `WeekView.tsx` | the `<header>` at **278–316** entirely | everything from **318** down, unchanged |
| `MonthView.tsx` | **311–353** — `month-home`, `month-prev`, `month-anchor`, `month-next`, `month-week`, `month-year` | **`month-threshold` at :355**, re-homed above the grid; the `<header>` element may go with it, the `<p>` may not |
| `YearView.tsx` | the `<header>` at **319–343** entirely | everything below |
| `Holidays.tsx` | `holidays-back` at **:470** only | the `<header>` at 267–288 entire — `holidays-prev`, `holidays-year`, `holidays-next` |

Any now-unused import (`addDays`, `shiftMonth`, `shiftYear`, `Link`, `MONTH_NAMES`) is removed with
its last use; lint is the check.

### 4.5 The six spec files

Each edit is **the removal of a click on a dead id**, plus anything reachable only through it. No
assertion about an origin screen is rewritten, and **no deleted step is replaced by a click on a
shell control** — there is no equivalent, which is what makes these four ids Class B.

| File | Delete |
|---|---|
| `cal-04-month-view.spec.ts` | the `month-home` step |
| `cal-05-week-view.spec.ts` | the `week-home` step |
| `cal-06-year-view.spec.ts` | the `year-home` steps — **two of them** |
| `adm-02-holidays.spec.ts` | the `holidays-back` steps — **two of them** |
| `adm-03-holiday-writes.spec.ts` | the `holidays-back` step |
| `cal-08-holiday-shading.spec.ts` | `holidays-back` **and `month-home` twice** — three references |

**`cal-08-holiday-shading.spec.ts` is in scope for those three references and nothing else.** It also
reads `week-anchor`, `week-next`, `month-anchor`, `month-next`, `year-anchor`, `year-prev`,
`week-day-holiday` and `week-day-bridge` — the first six relocate under § 4.3 and keep passing, the
last two are grid selectors this ticket may not reach. It is the file where the licence is narrowest.

**`adm-01-threshold.spec.ts` is deliberately not in scope.** It uses `week-month` at `:219-220` to
navigate and then reads `month-threshold`. Both survive — the first by § 4.3, the second by AC-2 —
so the file needs no edit. It is named here because a reader counting spec files that reference a
touched id will find seven and needs to know why only six are listed.

## 5. Seam impact

**None.** No function in `src/lib/data/` is added, removed, renamed or changed. `period.ts` is pure,
imports no seam and is not part of it; the `anchorValue` field in § 4.2 is a new field on a
view-model interface that lives above the seam and is consumed only by `TopBar.tsx`.
`tests/seam-parity.test.ts` is untouched. The four screens make exactly the reads they make today.

## 6. Schema delta

`none`. No migration, no policy, no trigger, no constraint, no column, and nothing under `supabase/`
is opened. ADR-014 does not engage. `requires_adr: false` — this ticket deletes markup and renames
test ids, and reaches no registry, schema or dependency. The one decision that could have needed a
human — whether the shell may be edited at all — is resolved by UIE-02's own plan granting it
(§ 4.1), not by an agent reversing an accepted decision.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/UIE-03/**"
  - "src/routes/WeekView.tsx"
  - "src/routes/MonthView.tsx"
  - "src/routes/YearView.tsx"
  - "src/routes/Holidays.tsx"
  - "src/components/TopBar.tsx"
  - "src/lib/period.ts"
  - "tests/e2e/cal-04-month-view.spec.ts"
  - "tests/e2e/cal-05-week-view.spec.ts"
  - "tests/e2e/cal-06-year-view.spec.ts"
  - "tests/e2e/adm-02-holidays.spec.ts"
  - "tests/e2e/adm-03-holiday-writes.spec.ts"
  - "tests/e2e/cal-08-holiday-shading.spec.ts"
```

**Twelve files outside the ticket folder. `size: M`, the ceiling exactly** —
`.ai/01-operating-model.md:373` puts M at up to 12 and L at more than 12. **`size_estimate` and
`size` agree**, so ADR-012 never engages; they agree because the estimate was formed after § 0's
measurement rather than before it.

**`ticket.yaml` § 2 says ten files. It is twelve, and the two extra are the whole finding of § 0.**
`TopBar.tsx` and `period.ts` are here because UIE-02 did not relocate the ids the shell assumed it
would, so this ticket must do it or destroy 83 spec references. The alternative shapes are in § 8 and
both are worse; one of them is L.

**There is no headroom.** Adding `Holidays.tsx`'s period controls to the shell — § 1 item 3, rejected
— would bring a `holidays` arm in `period.ts` and more spec churn, and this ticket is already at 12.
That is a second, independent reason it is a different ticket.

## 8. Rejected alternatives

**1. Rewrite the specs onto the shell's names instead of moving the names onto the shell.** Delete
the four headers, keep `shell-period-*` and `shell-view-*`, and update the seven spec files that
address the old ids. Genuinely plausible — the `shell-*` names are better names, and it leaves
`TopBar.tsx` alone, which is what `ticket.yaml` § 7 asks for. **Rejected on three counts.** It
rewrites roughly 83 assertions, which `ticket.yaml` § 3 warns is a licence to adjust tests that have
nothing to do with this ticket, and `.ai/standards/testing-standards.md` is not a document a chore may
quietly reinterpret. It does not actually avoid editing the shell: 43 of those references read
`data-week-start`, `data-month` or `data-year`, which `shell-period-anchor` does not carry, so
`TopBar.tsx` and `period.ts` are in scope either way — and once they are in scope, adopting the names
is strictly less work than rewriting the tests. And it destroys the ticket's own evidence: **83
assertions continuing to pass untouched is the strongest available proof that this ticket relocated
chrome and changed no behaviour**, which is precisely what a reviewer of a UIE row has to judge.

**2. Take `Holidays.tsx`'s period controls too, as `ticket.yaml` § 2 says.** Teach `period.ts` a
fourth kind so `/holidays/:year` gets a top-bar cluster, then delete the screen's own. Attractive
because it is the only screen left with its own chrome after this ticket, and § 1 item 3's
inconsistency is real. **Rejected because it is an addition disguised as a removal.** The top bar
renders nothing on `/holidays` today, so there is no duplication there — this ticket's entire warrant
is removing redundancy, and there is none to remove. It also adds a period kind, a `holidays` arm,
`holidays-prev`/`next` targets that are not calendar addresses, and further spec churn, on a ticket
already at M's ceiling. Recorded as *Open questions* item 4 so the inconsistency is legible as a
choice.

**3. Split: one ticket for the deletions, a second for the id adoption.** The cut that `ticket.yaml`
implies, and it would keep each half small. **Rejected because the halves cannot ship independently
in either order.** Deleting the headers first leaves 83 references pointing at nothing — a red suite
for a whole ticket, which no Definition of Done permits. Adopting the ids first duplicates every one
of them while the screens still render theirs, which is exactly the Playwright strict-mode failure
UIE-02 § 4.8 refused and the reason those ids were never reused in the first place. The two halves
are one atomic change; the doubling UIE-02 accepted for one ticket is what forced it.

**4. Keep `week-home`, `month-home`, `year-home` and `holidays-back` pointing at the landing route.**
The smallest possible ticket: delete nothing, and the doubling stands. **Rejected because the landing
route no longer resolves to a home screen** — UIE-02 deleted `Home.tsx` and made `/` redirect a member
to the week view. A control named `-home` that lands on the week view is a control that lies about
where it goes, and the sidebar already carries every destination it offered.

## Changelog

- `2026-09-07T15:01:57+07:00` — plan created. Raised by `tech-lead-design`.
- `2026-09-07T15:01:57+07:00` — **sections 1, 2 and 7 widened after reading the source tree, and the
  Changelog is where that is caught.** Sections 1 and 2 were drafted against `ticket.yaml`'s scope:
  four source files, six spec files, and a shell that had already relocated the screens' ids.
  **Reading `TopBar.tsx` showed it had not** — UIE-02 shipped `shell-period-*` and `shell-view-*`
  names and an anchor carrying only `data-period-kind`, deliberately and for a good reason. AC-6,
  AC-7, AC-8 and AC-9 were added in response, § 4 gained the id mapping, and § 7 grew from ten files
  to twelve. **No AC was narrowed to fit what was easy to build**; the change was to widen the ticket
  so that 83 spec references keep passing, and the alternative that would have been easier to build
  (rewriting the tests) is § 8's first rejected alternative. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
