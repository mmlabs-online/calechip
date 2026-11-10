---
ticket: UIE-09
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-09T14:00:40+0700
inputs_read:
  - .ai/board/tickets/UIE-09/ticket.yaml
  - .ai/board/tickets/UIE-09/design/README.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/ui-design-system.md
  - .ai/01-operating-model.md
  - .ai/board/tickets/ADM-01/01-plan.md
  - src/App.tsx
  - src/components/AppShell.tsx
  - src/components/TopBar.tsx
  - src/components/Sidebar.tsx
  - src/routes/Threshold.tsx
  - src/lib/domain/types.ts
  - tests/e2e/adm-01-threshold.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# UIE-09 — an admin hub screen at `/admin`, reachable from one control in the top bar

## 1. Problem and scope

### The feature row, transcribed

| ID | Title | Group | Status | Invariants touched |
|----|-------|-------|--------|--------------------|
| UIE-09 | An admin hub screen at `/admin`, reachable from one control in the top bar | UIE | PLANNED | `[]` — *the template default and not an answer; this plan writes the answer* |

Four sentences of that row bind this plan and are transcribed rather than paraphrased:

- *"THIS IS THE FIRST OF TWO ROWS AND IT IS THE ADDITIVE HALF. The sidebar is not touched by this row
  at all."*
- *"Scope as promoted: a new screen at `/admin` listing every administrative destination —
  `/entries/pending`, `/entries/team`, `/allow-list`, `/threshold` and `/members` — plus one
  role-conditional control in the top bar that reaches it."*
- *"NEW `admin-hub-*` SELECTORS, NOT THE `home-*` IDS."*
- *"THE COST THE OPERATOR SHOULD HEAR, AND IT IS NOT A PLAN'S TO ABSORB QUIETLY: the approval queue
  goes from one click to two."*

### What capability this buys, and for whom

An **admin** gains one place that names every administrative destination, and a **member** gains
nothing and loses nothing. The sidebar is the product's only map today: it holds every address the
caller may reach in one flat list, so its length is a function of role rather than of work — seven
destinations for an admin against three for a member, in a fixed pane rendered on all fourteen routes
inside the shell (`src/components/Sidebar.tsx:127`, `:201-250`).

It also closes a hole that predates the request. **`/members` is a route with no link anywhere in
`src/`** — `src/App.tsx:221`, and the only other occurrences are three comments. It carries the two
most destructive controls in the product, remove a member and promote to admin, and today it is
reachable only by typing the address. The hub lists it.

**This row is the additive half of a two-row split and its defining property is what it does not
touch.** `src/components/Sidebar.tsx` is not in `allowed_paths`, the four `home-*-link` ids stay
where they are, and every executable assertion in every shipped spec keeps passing unedited. UIE-10
is the migration and carries the risk. If implementation finds itself editing the sidebar, the split
has been lost and the correct move is to stop and say so rather than to widen `allowed_paths`.

### The cost, stated rather than absorbed

The registry row records that *"the approval queue goes from one click to two"*. **That cost does not
land in this ticket, and saying where it does land is more useful than repeating it here.** While
UIE-09 ships, `home-pending-entries-link` is still in the sidebar, so an admin still reaches the
worklist in one click and the hub is a second, additional route to it. **The second click arrives
with UIE-10**, when the sidebar gives those links up. It is a consequence of the hub shape decided at
triage rather than of anything decided here, and it is the operator's to accept or to reverse — the
reversal is cheap and named in § 8.

### Out of scope

Five refusals, each because it reverses something decided or belongs to somebody else. They are
restated from `ticket.yaml` § 11 in this plan's own words, as that section instructs:

- **All Vietnamese copy** — `Quản trị & Duyệt`, `+ Đăng ký` and the rest. The interface is English by
  the operator's instruction of 2026-09-03 and it is lint-enforced on JSX text under `src/`
  (`eslint.config.js:83-92`), so several of those strings would **fail the build** rather than fail
  review. This is the fifth refusal of the identical request after UIE-01, UIE-05, UIE-06 and UIE-08.
- **The `2026 ▾` dropdown anchor.** It would replace a `<p>` carrying `data-year`, `data-month` and
  `data-week-start` that 43 spec references read (`src/components/TopBar.tsx:104-113`) with a year
  picker nothing specifies, in a product where the period is the address.
- **The removal of the `Today` control.** § *Visual specification* says what a reference does not
  show goes to Out-of-scope; it does not say it gets deleted. `shell-period-today` is UIE-02 AC-13
  and the only anchorless route back to the current period from a distant date.
- **The floating keyboard button.** The transcription itself says *"nothing in the picture says what
  it does"*. `CLAUDE.md` § *Working agreements*: no invention.
- **The sidebar, entirely** — its roster grouping, its legend, its account footer and its nav block.
  UIE-10's, and the paragraph above is why.

And four more this plan adds:

- **`/holidays` is not one of the hub's five.** It is already linked in the sidebar for **both**
  roles (`Sidebar.tsx:209`), not behind the role condition, so it is not one of the administrative
  destinations this hub collects. Whether it belongs here is a question about the sidebar's nav
  block, which is UIE-10's.
- **A menu on the button.** Decided at triage and not reopened; § 8 records why on the merits rather
  than by deference.
- **A tabbed admin area** — `/admin/threshold` and friends. `ticket.yaml` § 7 fences it and says the
  correct verdict on reaching for it is `BLOCKED` with `requires_adr: true`. This plan does not reach
  for it; § 8 says why it is the wrong shape as well as the fenced one.
- **Anything the hub could summarise.** A pending count beside the worklist link is a seam read, a
  loading state and a refusal path on a screen that otherwise has none. `ticket.yaml` § 9 names it as
  the one thing that would move the size, and it is a different ticket.

`size_estimate`: **S**. One new screen that renders a list, one prop, one route line, one control,
and one new spec. Nothing computes, nothing writes, and no existing behaviour changes.

## 2. Acceptance criteria

Observable through the interface or through `pnpm exec playwright test`. The selector attribute is
`data-testid`.

**AC-1 — an admin reaches the hub from the top bar, on any route inside the shell**
- Given a signed-in admin on the week view, and the same admin on `/allow-list`
- When the top bar is read in each case
- Then a control named `shell-admin-link` is present in both, and following it opens `/admin`

**AC-2 — a member is not offered the control**
- Given a signed-in member whose role is not admin
- When any route inside the shell is opened
- Then `shell-admin-link` is absent from the page — absent, not disabled

**AC-3 — the hub lists exactly five destinations, and every one of them resolves**
- Given a signed-in admin
- When they open `/admin`
- Then five links are present, targeting `/entries/pending`, `/entries/team`, `/members`,
  `/allow-list` and `/threshold`, and no sixth link to any other address appears in the list

**AC-4 — each destination opens the screen it names**
- Given a signed-in admin on `/admin`
- When each of the five links is followed in turn
- Then each opens the screen at its address, and each of those screens renders exactly as it does
  today

**AC-5 — the member list is reachable without typing an address**
- Given a signed-in admin who has never typed a URL
- When they follow the top-bar control and then the member-list link
- Then `/members` opens

**AC-6 — a member who types the address is refused by the screen**
- Given a signed-in member whose role is not admin
- When they open `/admin` directly
- Then the screen renders a refusal that says the area is for admins, lists none of the five
  destinations, and offers a link back — and the caller is not redirected away from `/admin`

**AC-7 — a caller with no member row is refused the same way**
- Given a signed-in caller with no member row
- When they open `/admin` directly
- Then they are sent to `/`, which resolves by membership, exactly as `/entries/new`,
  `/entries/team`, `/entries/pending` and `/threshold` already do

**AC-8 — a failed read shows a failure state and no list**
- Given a signed-in caller for whom the member read throws
- When `/admin` resolves
- Then the screen shows a failure state, lists none of the five destinations, and does not show the
  refusal — a transport failure and a denial are different answers and must not read alike

**AC-9 — the hub's selectors are new and collide with nothing**
- Given the whole application
- When every `data-testid` rendered on `/admin` and in the top bar is read
- Then every id introduced by this ticket begins `admin-hub-` or is `shell-admin-link`, no `home-*`
  id is added, moved, renamed or removed, and every id in the product still resolves to exactly one
  node on any single page

**AC-10 — the sidebar is unchanged**
- Given a signed-in admin, and separately a signed-in member
- When the sidebar is read in each case
- Then it renders exactly what it renders today, including all four `home-*-link` admin links for the
  admin and none of them for the member

> ## Amended by UIE-10, 2026-09-09
>
> **Both criteria above are kept as written, and both are scoped to UIE-10's landing.** They were
> true when UIE-09 shipped and they are the record of the double exposure that ticket deliberately
> left behind — the four sidebar links and the five hub rows on screen at once. UIE-10 is the
> migration that ends it, so read as standing properties of the product they are now false. Which
> clause of each moved, and which survives:
>
> **AC-9 — the clause *"no `home-*` id is added, moved, renamed or removed"* was a promise about
> UIE-09's OWN change.** Scoped to UIE-09 it stays true and nothing about it needs revisiting.
> Unscoped it is false after UIE-10 AC-1, which REMOVES `home-pending-entries-link`,
> `home-team-entries-link`, `home-allow-list-link` and `home-threshold-link`. **What the criterion
> was for survives untouched**: no `home-*` id is RENAMED and none is DUPLICATED onto the hub, which
> is the strict-mode hazard UIE-02 AC-6 exists against and the mechanism the two-row split was built
> on. The hub's rows kept the `admin-hub-*-link` names this ticket shipped; UIE-10 § 8, rejected
> alternative 2, records that relocating a `home-*` name onto them would have traded four broken
> assertions for five and saved nothing.
>
> **AC-10 — the clause about the four admin links is false by design; the clause about the three
> general links is the half that was ever meant to be permanent.** After UIE-10 the sidebar renders
> `home-week-link`, `home-year-link` and `home-holidays-link` for both roles and nothing that depends
> on the caller's role, and every roster row carries the member's role word under the new id
> `shell-roster-role`. `tests/e2e/uie-09-admin-hub.spec.ts` carries the amendment as an assertion:
> the test is retitled *the sidebar keeps its three general links, for both roles*, and the four
> loops that asserted `toHaveCount(1)` for an admin now assert `toHaveCount(0)` for both roles. The
> array they loop over is kept, renamed `RETIRED_SIDEBAR_ADMIN_LINKS`, so the suite goes on naming
> the four ids that must never come back.
>
> **AC-1 through AC-8, AC-11 and AC-12 are untouched by UIE-10** and every one of them still passes
> unedited. `shell-admin-link` in particular gained work rather than losing it: UIE-10 AC-4 made it
> the node that carries the member denial in six assertions across four other spec files, because
> the ids they used to name now render for nobody and their `toHaveCount(0)` would have passed
> vacuously.

**AC-11 — the period cluster is unaffected**
- Given a signed-in admin on `/week/2026-04-06`, on `/month/2026-04`, on `/year/2026` and on
  `/allow-list`
- When the top bar is read in each case
- Then the anchor, the previous and next controls, the `Today` control and the three switcher
  segments are present and unchanged on the first three, absent on the fourth exactly as today, and
  `shell-admin-link` is present on all four

**AC-12 — the interface is in English**
- Given the hub and the top-bar control
- When every string they render is read
- Then none contains a Vietnamese diacritic

### Invariants touched

**`[]` — and this is an answer, not the template default.**

Each ID was reasoned through rather than dismissed as a group, because
`.ai/registry/invariants.md:63` warns that observing the safest behaviour and concluding no invariant
is engaged is circular reasoning. The reason that warning does not apply here is that **no behaviour
was chosen**: this ticket adds no write path of any kind. There is no statement, no derivation and no
number anywhere in it to get wrong.

- **INV-01, INV-02, INV-03, INV-06** — all four are about what an entry is and what happens when one
  changes. Nothing here creates, edits, approves, rejects or reads an entry. No entry value is
  constructed.
- **INV-04, INV-05** — the absence count and how a tentative entry contributes to it. No count is
  computed, displayed or passed anywhere in this ticket; `src/lib/data/absence.ts` is not imported by
  either file this ticket adds or changes.
- **INV-07** — the one worth arguing with, because the hub makes `/members` reachable and that screen
  removes members and promotes them. **Reaching a destination more easily is not the same as changing
  what may be done there.** TEA-04's writes are unchanged and are held by the datastore's policies,
  not by the absence of a link; a caller who could not previously reach `/members` could always type
  it. The exposure changes, the invariant does not, and § 3 states the exposure change on its own
  terms rather than hiding it under an invariant it does not touch.

### Open questions

**None blocking.** Two things decided here rather than carried:

1. *The name of the top-bar control's selector.* `ticket.yaml` § 2 offered `shell-admin-link` and
   said PLAN owns the choice. Taken, because it matches `shell-topbar` and `shell-period-today` —
   the two ids already in that file for things the shell owns rather than a screen — and because a
   `home-*` name would put this ticket inside the id set UIE-10 has to migrate.
2. *Whether the hub reads the member itself or receives it.* It reads it, through
   `seam.getCurrentMember()`, exactly as `Threshold.tsx:63-70` does. § 8 records the alternative.

One assumption that ships: **the hub is a list and never a dashboard.** It renders no count, no
status and no summary of anything behind its five links, so it has one read, one refusal and no
arithmetic. The moment it summarises something it acquires a seam read per destination and a partial
failure state, which is `ticket.yaml` § 9's named size risk and is a different ticket.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

**This line is correct even though `design/README.md` exists, and the reason is written into the
standard.** `.ai/standards/ui-design-system.md` § *Visual specification*, `CORRECTION 2026-09-09`:
*"an image specifies a UI only if it is on disk at `.ai/board/tickets/<ID>/design/`"*, and there is no
image file in that folder and there never was — the operator pasted a screenshot into the `/triage`
conversation and no role in this loop can write image bytes (MD-030). What sits there is a hand
transcription whose own first line says *"A later reader cannot check a single sentence of it against
the picture it describes. It is evidence of intent. It is not a reference."* UIE-05, UIE-06 and
UIE-08 each wrote this same line for the same reason, so this is the fourth time and not a new
reading.

**What the transcription is nonetheless evidence of, and how this plan spends it.** It draws the
admin affordance as an **outline pill with no caret**, in the top bar's right cluster between the
segmented control and the primary action — the shape `shell-period-today` already uses
(`TopBar.tsx:134-140`), not a disclosure control; the only `▾` in the picture is on the year anchor.
That is why the shape is a hub at an address rather than a menu, and § 8 argues it on the merits.
Everything else the transcription describes belongs to UIE-10, to a refusal in § 1, or to nothing.

**The layout below is mine and is stated so it can be argued with cheaply.**

- **The top-bar control** is an outline pill reading `Admin`, placed between the switcher and
  `+ Book`, reusing this file's existing `PILL_OUTLINE` class so it is the same object as `Today`
  rather than a new one that looks like it.
- **The hub** is a single column: a heading, one sentence saying what the area is, then **five rows
  in one ordered list**, then a link back. Each row is a card carrying the destination's name and one
  line saying what is done there.
- **The order is by how often an admin needs it**, not alphabetical and not by the order they appear
  in the sidebar: pending approvals, team entries, members, allow list, overload threshold. The
  approval queue is the daily one and it is first, which is the only mitigation available inside this
  ticket for the second click UIE-10 will introduce.
- **They are not grouped into sections.** Five items do not need two headings, and inventing a
  taxonomy of administrative work is a decision with no source.
- **The refusal state and the failure state are separate screens with separate text**, because a
  denial and a transport failure are different answers (AC-6, AC-8).

## 3. Permission model

**No policy changes, and nothing here is a control.** Every element this ticket adds is an affordance
over row-level security already in force (ADR-005), and the five destinations keep their existing
guards, their existing screens and their existing policies untouched.

| Action | `member` | `admin` |
|---|---|---|
| See the admin control in the top bar | ❌ | ✅ |
| Open `/admin` and see the five destinations | ❌ | ✅ |
| Reach any of the five addresses by typing it | unchanged | unchanged |

The role condition is `member.role === "admin"`, the same expression `Sidebar.tsx:127` already uses,
read off the member row `App.tsx` has already resolved.

**The route is guarded on `member`, not on `admin`, and the refusal is in-screen.** That is not a new
decision: `/threshold` (`src/App.tsx:338-343`), `/entries/team` (`:257-261`) and `/entries/pending`
(`:277-283`) each do exactly this and each explain it in place — a member who types the address must
reach the component and be refused **by it**, because the refusal is what says why, and a redirect
leaves somebody who mistyped with nothing to read. A caller with no member row lands on `/`, which
resolves by membership (AC-7).

**The denials, which is the half a permission table cannot be tested without.** A member must not see
the control (AC-2); a member who reaches `/admin` must not see any of the five links (AC-6); and no
element added by this ticket may perform an action — the hub renders links and nothing else, which is
checkable by reading its imports and finding no write function from the seam.

**One exposure change, stated plainly because it is real and is not an invariant.** `/members` goes
from *reachable only by typing* to *two clicks from any screen, for an admin*. Its two destructive
controls, remove a member and promote to admin, are TEA-04's and are unchanged; they are refused by
`member_update_admin` for anybody who is not an admin whether they arrive by link or by keyboard.
Discoverability was never the control, and § 1 records that this hole predates the request.

## 4. Contract

### 4.1 The route — `src/App.tsx`

One line, in the guarded family it belongs to:

```tsx
<Route
  path="/admin"
  element={membership.state === "member" ? <AdminHub /> : <Navigate to="/" replace />}
/>
```

Nothing else in that file changes. No existing route is re-addressed, no path moves, and `/admin` has
no children — the tabbed shape that would give it children is fenced in § 1 and refused in § 8.

### 4.2 The top bar — `src/components/TopBar.tsx`

```tsx
export interface TopBarProps {
  /** Whether the signed-in member is an admin. The bar has no session and no seam call of its own. */
  isAdmin: boolean;
}

export default function TopBar({ isAdmin }: TopBarProps) { … }
```

Rendered in the right cluster, between the switcher and `home-new-entry-link`:

```tsx
{isAdmin ? (
  <Link data-testid="shell-admin-link" to="/admin" className={PILL_OUTLINE}>
    Admin
  </Link>
) : null}
```

**The file's `IT TAKES NO PROPS` comment is amended, and the amendment must say what it does not
change.** That comment's real subject is the *period* derivation — `TopBar.tsx:7-11`, why
`useParams()` would return `{}` on a layout route and the cluster would silently never render — and
**that is untouched**: the anchor, the step controls, `Today` and the three segments still come from
`periodNavFor(useLocation().pathname)` and from nothing else. What the prop carries is a **role**,
which is not derivable from a pathname by any means, and which the bar had no way to obtain. A reader
who finds the bold sentence gone must be able to see in the same paragraph that the invariant it was
protecting still holds. `ticket.yaml` § 6 requires this sentence; this is it.

### 4.3 The shell — `src/components/AppShell.tsx`

```tsx
<TopBar isAdmin={member.role === "admin"} />
```

`AppShellProps` is unchanged: the shell already receives `member` and already documents that
`App.tsx` resolved it and that the shell re-reads nothing. The role is computed here rather than
passed as a `Member` so the top bar cannot grow a second reason to hold a member row.

### 4.4 The screen — `src/routes/AdminHub.tsx`, new

The four-phase shape `Threshold.tsx:45-48` established, so the states are ones a reader already
knows:

```tsx
type View =
  | { phase: "loading" }
  | { phase: "refused" }      // a member, or a caller with no member row that reached the component
  | { phase: "unavailable" }  // the read threw
  | { phase: "ready"; me: Member };
```

One seam call and no other:

```ts
const me = await seam.getCurrentMember();
if (!me || me.role !== "admin") { setView({ phase: "refused" }); return; }
setView({ phase: "ready", me });
```

The five destinations, declared once as data so the list and its order are one thing rather than five
copies of a row:

```ts
const DESTINATIONS: readonly { testId: string; to: string; name: string; blurb: string }[] = [
  { testId: "admin-hub-pending-link",      to: "/entries/pending", name: "Pending approvals", blurb: "…" },
  { testId: "admin-hub-team-entries-link", to: "/entries/team",    name: "Team entries",      blurb: "…" },
  { testId: "admin-hub-members-link",      to: "/members",         name: "Members",           blurb: "…" },
  { testId: "admin-hub-allow-list-link",   to: "/allow-list",      name: "Allow list",        blurb: "…" },
  { testId: "admin-hub-threshold-link",    to: "/threshold",       name: "Overload threshold", blurb: "…" },
];
```

**No write function from the seam is imported.** `seam.getCurrentMember` is the only member of `seam`
this file names, which is what makes AC-6's denial checkable by reading the imports.

### 4.5 Selectors

`.ai/standards/ui-design-system.md` § *Selectors*: a control added without a `data-testid` cannot be
exercised at all.

| Selector | Element |
|---|---|
| `shell-admin-link` | the top-bar control, admin only |
| `admin-hub` | the page root, `ready` only |
| `admin-hub-loading` / `-refused` / `-unavailable` | the three non-list states |
| `admin-hub-link` | every destination row, so the list can be counted (AC-3) |
| `admin-hub-pending-link`, `-team-entries-link`, `-members-link`, `-allow-list-link`, `-threshold-link` | the five, individually |
| `admin-hub-back` | the link back, matching `threshold-back` |

**Every one of these is new, and no `home-*` id is touched** (AC-9). That is the mechanism the split
is built on: UIE-02 AC-6 requires each `home-*` id to resolve to exactly one node and Playwright
strict mode fails a click matching two, so the four `home-*-link` ids stay in the sidebar for the
whole of this row and are UIE-10's to adopt, unrenamed, if that is the migration it chooses.

### 4.6 Copy

English (AC-12). `Admin` on the pill; `Admin` as the hub's heading; one sentence beneath it; a short
name and one line per destination; `Back` on the return link. None of it is a translation of any
string in the transcription — § 1 refuses that in terms.

## 5. Seam impact

**None.** No function on the data-access seam is added, removed, renamed or changed, and neither
implementation is touched. `tests/seam-parity.test.ts` is unaffected and is not edited.

The one seam call this ticket makes is `seam.getCurrentMember()`, declared on the seam since TEA-01
and already called by `Threshold.tsx`, `MonthView.tsx`, `WeekView.tsx`, `YearView.tsx` and
`YearOverview.tsx` in exactly this shape.

**RULE-02 holds by construction.** `AdminHub.tsx` imports `seam` from `@/lib/data` and nothing else
from the data layer; `TopBar.tsx` and `AppShell.tsx` import nothing from it at all. No `@supabase/*`
import appears anywhere in this ticket, so `eslint.config.js:64-77` has nothing to fire on.

**Nothing above the seam gains a second definition of anything**, because nothing in this ticket
derives a value. The hub renders five constant strings and five constant addresses.

## 6. Schema delta

`none`, and not a fenced `none`.

No table, column, policy, grant, trigger, constraint or index is named by anything in this plan. The
five addresses keep their existing guards and their existing row-level security exactly as they are,
and there is no migration of any kind — so ADR-014's warning that a policy-only migration is not
`none` has nothing to bite on.

`requires_adr: false`, **and it stays false because the hub extends rather than reverses.**
`.ai/board/tickets/ADM-01/01-plan.md:194-197` records the own-screen-per-setting shape as *"an
assumption that ships"* whose reversal *"moves one route and one link"*. A hub adds a route **above**
the four and moves none of them — `/threshold` is still `/threshold` and its own back link still
works. Under ADR-008's test — decide inside an existing envelope, ask before changing the envelope —
this is inside. The one shape that would flip this field is the tabbed admin area, which § 1 puts out
of scope and § 8 rejects on the merits.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/routes/AdminHub.tsx"
  - "src/App.tsx"
  - "src/components/TopBar.tsx"
  - "src/components/AppShell.tsx"
  - "tests/e2e/uie-09-admin-hub.spec.ts"
```

Exact paths, no globs. `.ai/board/tickets/UIE-09/` is absent because the guard exempts the active
ticket's own folder (`.claude/hooks/guard-allowed-paths.mjs:205-206`).

What each is for:

- **`src/routes/AdminHub.tsx`** — new, § 4.4 and § 4.5.
- **`src/App.tsx`** — § 4.1, one route line and one import.
- **`src/components/TopBar.tsx`** — § 4.2, the prop, the control, and the amended comment.
- **`src/components/AppShell.tsx`** — § 4.3, one prop passed. `ticket.yaml` § 6 predicted this file
  and the prediction was correct.
- **`tests/e2e/uie-09-admin-hub.spec.ts`** — new. AC-1 to AC-12. `.ai/standards/testing-standards.md`
  puts *"a full acceptance criterion through the interface"* at the end-to-end level, and every
  criterion here is about what a role sees on a screen; there is no pure logic in this ticket for a
  unit test to hold.

**`src/components/Sidebar.tsx` is deliberately absent, and its absence is the ticket.** So is every
existing spec file: no shipped assertion is edited, which is the property the two-row split exists to
buy. It was checked rather than assumed — no spec references `shell-topbar`, none counts the links in
the top bar, and `tests/e2e/adm-01-threshold.spec.ts:206` asserts `home-threshold-link` is absent for
a member, which stays true because the sidebar is untouched and the new control carries a different
id and the same role condition.

`size`: **S** — five files, and `S` is up to 6 (`.ai/01-operating-model.md:372`). It proceeds.

**Not XL.** No seam signature changes, there is no migration, and `src/lib/domain/types.ts` is not
touched. `TopBarProps` is a new interface in the component that consumes it, not a change to a shared
type module, and its one existing caller — `AppShell.tsx` — is inside `allowed_paths` and changes by
one attribute.

**`size_estimate` said S and the verdict is S.** They agree, which is worth a line only because they
were reached differently: the estimate came from what the screen has to *be* in § 1, and the verdict
from counting § 7. `ticket.yaml` § 9 named the one thing that would have separated them — a hub that
summarises something — and § 2's last assumption is where this plan refuses it.

## 8. Rejected alternatives

**1 — A menu on the top-bar button instead of a screen at an address.** The most direct reading of
*"add 1 button to access admin function in top bar"*, and it costs no new route. Rejected on the
merits and not only because triage decided it. It invents open-on-click-or-hover, close-on-Escape,
close-on-outside-click, focus return and `role="menu"` semantics against
`.ai/standards/ui-design-system.md` § *Components*, **which is a bare `TODO(project)`** — so the
first menu in this product would be a component-library decision taken inside a UI ticket. It buys
nothing for UIE-10 either: all 17 of that ticket's visibility assertions still fail and all 13 of its
navigation assertions still need an inserted step, because both are about the sidebar and not about
what the control opens. And an address is bookmarkable, shareable and survives a reload, which is the
property this product leans on everywhere — *"the period IS the address"* (`TopBar.tsx:91-93`). The
transcription supports the address reading: an outline pill with no caret is not a disclosure
control.

**2 — A tabbed admin area at `/admin/threshold`, `/admin/members` and so on.** Genuinely tidier: one
address family, one place to add the next administrative screen, and a single back target. Rejected
because it re-addresses four shipped screens, changes every `page.goto` in their refusal tests,
changes each screen's own back link, and **reverses ADM-01's Open question 1 along with the answer
ADM-02, ADM-03 and ADM-04 all inherited**. It is also the one shape `ticket.yaml` § 7 fences: had
this plan concluded it was right, the correct verdict would have been `BLOCKED` with
`requires_adr: true`, not a quiet re-address. It did not.

**3 — Render the four admin links in the top bar directly, with no hub at all.** Fewer clicks than
any option here — the operator's stated cost disappears entirely, since the worklist stays one click
away forever. Rejected because it puts four controls into a bar that already carries seven on a
period screen, and because it does not answer the request, which asks for **one** button. It also
leaves `/members` needing a fifth control or staying unreachable, which is the hole § 1 exists to
close.

**4 — Pass the whole `Member` to `TopBar` rather than a boolean.** Slightly more future-proof: the
next thing the bar needs from the member arrives without another prop. Rejected because the bar's one
question is *may this person administer*, a boolean answers it, and a `Member` prop invites the bar
to grow a second reason to hold a member row — which is how a component that documents *"it re-reads
nothing"* acquires a read. `AppShell.tsx` computes the expression, in the file that already holds the
row.

**5 — Have `App.tsx` pass the resolved member into `AdminHub` as a prop instead of the screen calling
`getCurrentMember()`.** It is already resolved there, so the screen would need no read, no loading
state and no failure state — three of the four phases would disappear. Rejected because it makes
`/admin` the only screen in the product whose refusal depends on the router rather than on itself:
`Threshold.tsx`, `TeamEntries.tsx` and `PendingEntries.tsx` each read the member and each refuse in
place, and a screen that cannot refuse on its own is a screen whose denial moves the moment somebody
changes a route line. The three extra phases are the price of the refusal living in the component
that renders it.

## Changelog

- `2026-09-09T14:00:40+0700` — sections 1 and 2 written from `.ai/registry/features.md`,
  `ticket.yaml` and `design/README.md`, before the source tree was read for sections 3 to 8. Raised
  by `tech-lead-design`.
- `2026-09-09T14:00:40+0700` — section 1, **the operator's stated cost was relocated rather than
  repeated**. The registry row says *"the approval queue goes from one click to two"*; reading
  `src/components/Sidebar.tsx:218-247` showed `home-pending-entries-link` is untouched by this
  ticket, so the second click arrives with UIE-10 and not here. The cost is not reduced, denied or
  absorbed — it is attributed to the ticket it lands in, which is what makes it actionable. Raised
  and amended by `tech-lead-design`.
- `2026-09-09T14:00:40+0700` — section 2, **AC-11 added after reading
  `src/components/TopBar.tsx:88-140`**. The bar renders its period cluster only when
  `periodNavFor` returns non-null, and this ticket adds a control that renders on *every* route
  inside the shell — including the ones with no period. Without AC-11 nothing states that adding an
  always-present control did not disturb a conditionally-present one, which is exactly the kind of
  regression a props change to this file can cause invisibly. An addition, not a reshaping. Raised
  and amended by `tech-lead-design`.
