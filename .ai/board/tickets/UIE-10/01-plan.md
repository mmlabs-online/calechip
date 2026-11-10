---
ticket: UIE-10
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-09T15:04:18+0700
inputs_read:
  - .ai/board/tickets/UIE-10/ticket.yaml
  - .ai/board/tickets/UIE-10/design/README.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/rbac-and-security.md
  - .ai/01-operating-model.md
  - .ai/board/model-debt.md
  - .ai/board/tickets/UIE-02/01-plan.md
  - .ai/board/tickets/UIE-09/01-plan.md
  - .ai/board/tickets/ADM-01/01-plan.md
  - .ai/board/tickets/ADM-04/01-plan.md
  - .ai/board/tickets/CAL-03/01-plan.md
  - .ai/board/tickets/TEA-05/01-plan.md
  - src/components/Sidebar.tsx
  - src/components/TopBar.tsx
  - src/routes/AdminHub.tsx
  - src/lib/period.ts
  - tests/e2e/ (every spec naming a `home-*-link` id)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# UIE-10 — the sidebar gives up its admin links and restyles its roster

## 1. Problem and scope

### The feature row, transcribed

| ID | Title | Group | Status | Invariants touched |
|----|-------|-------|--------|--------------------|
| UIE-10 | The sidebar gives up its admin links and restyles its roster; the specs route through the hub | UIE | PLANNED | *(empty in the registry — this plan writes `[]` as an answer)* |

Three sentences of the ticket bind this plan and are transcribed rather than paraphrased:

- *"THIS IS THE MIGRATION HALF. EVERY UNIT OF RISK IN THE OPERATOR'S REQUEST IS HERE, IN ONE
  REVIEWABLE PLACE, AND THAT IS THE WHOLE POINT OF THE SPLIT."*
- *"THE SIX NEGATIVE ASSERTIONS PASS VACUOUSLY ONCE THE IDS THEY NAME STOP EXISTING … A reviewer who
  sees six green assertions after this ships is seeing nothing."*
- *"THE SUITE WAS NOT RUN … 17 IS THE ESTIMATE OF THE COST AND NOT A MEASUREMENT OF IT, and this
  ticket's plan is where it stops being an estimate."*

### What capability this buys, and for whom

The operator's request, verbatim: *"change layout of left side bar, Remove all the link to admin page
in sidebar. Add one 1 button to access admin function in top bar"*. UIE-09 shipped the button and the
hub. This row is the other half: the sidebar gives up its four admin links, so its length stops being
a function of role, and each roster row gains the role word the first clause of the request asks for.

An **admin** loses four links from a pane rendered on all fourteen routes and reaches the same four
addresses through the hub. A **member** sees no change to what they can reach and no change to what
they are refused.

### The measurement the ticket asked for, taken

`ticket.yaml` § 11 records that the suite was not run and that the classification was an estimate.
It was measured here, by reading every reference on disk. **Three of the ticket's numbers move, and
all three move because UIE-09 shipped between that triage and this plan.**

**Nine spec files execute against the four admin ids, not eight.** The ninth is
`tests/e2e/uie-09-admin-hub.spec.ts`, which did not exist when § 2.4 listed eight. It holds four
loops over a `SIDEBAR_ADMIN_LINKS` array — three asserting `toHaveCount(1)` for an admin and one
asserting `toHaveCount(0)` for a member — so it fails on all four ids at once.

**Thirteen visibility assertions are affected, not seventeen.** Four of the seventeen § 2.2 lists —
`adm-02:84`, `adm-02:293`, `adm-02:301` and `adm-03:59` — are on `home-holidays-link`, and § 4 of
that same ticket keeps the three general links in the sidebar. They are untouched, and **ADM-02
AC-15 is therefore not on the list of criteria this ticket disturbs**, although § 2.2 named it.

**The affected set, by file and line:**

| Kind | Count | Sites |
|---|---|---|
| Navigation `.click()` | 9 | `adm-01:54`, `adm-01:104`, `adm-04:139`, `adm-05:112`, `adm-05:119`, `adm-06:123`, `cal-03:114`, `cal-07:126`, `cal-08:363` |
| Positive visibility | 7 | `adm-01:53`, `adm-01:103`, `adm-01:199`, `adm-04:411` and its `toHaveText` at `:415` (locator at `:410`), `cal-03:476`, `tea-05:147` |
| Negative visibility | 6 | `adm-01:206`, `adm-04:319`, `adm-04:335`, `cal-03:302`, `cal-03:487`, `tea-05:156` |
| Loops over all four | 4 | `uie-09-admin-hub.spec.ts`, three positive and one negative |

**The six negative assertions are exactly the six the ticket warned about**, and the measurement
confirms the hazard rather than softening it: after the ids stop existing for anybody, all six pass
against a name that never renders.

### What the migration can no longer do, because UIE-09 shipped

`ticket.yaml` § 2.1 offered that *"THE FOUR `home-*-link` IDS MAY RELOCATE ONTO THE HUB UNRENAMED"*.
**That option is gone.** UIE-09 shipped five `admin-hub-*-link` ids on the hub and asserts each
resolves to exactly one node; a hub row cannot carry two `data-testid` values, so relocating a
`home-*` name onto a row means renaming that row away from the name UIE-09 shipped. The four
`home-*-link` ids are therefore **removed**, and the hub's `admin-hub-*-link` ids are the survivors.
It costs nothing extra: every one of the nine navigation sites needs an inserted hub step either way,
so the only thing relocation would have saved was the id text on nine lines.

### Out of scope

- **The roster's five sub-groups**, with their count pills and collapse chevrons — deferred, not
  dropped, and this is the item the operator may want back. No column anywhere groups members within
  a team (`supabase/migrations/20260831150024_tea01_membership.sql:31`), so it is a migration and
  therefore XL and a human's under RULE-09. And before the column there is a decision: INV-07 scopes
  counting to the team, and a count pill on every group header is one question away from a threshold
  per group, which would give INV-04 a second arithmetic. *Is a sub-group ever a counting unit?* is
  the ADR, and it is not this ticket's. The same picture has now shown those five subtitles four
  times and nothing has acted on them.
- **The three general links.** `home-week-link`, `home-year-link` and `home-holidays-link` stay.
  Where the operator's words and the picture differ the words govern: the request names the **admin**
  links. Two verified facts make the picture's link-free sidebar unbuildable as written — the top bar
  renders no switcher at all on the eight non-period routes (`src/lib/period.ts` returns `null`, and
  `TopBar.tsx` gates the whole cluster on it), and `/holidays` is linked from exactly one place in
  the product while being guarded on a session rather than a role, so an admin control could not
  adopt it without breaking ADM-02 AC-15 and taking the national calendar away from every member.
- **The fourth legend row `Quá tải (>50%)`.** It reverses UIE-02 AC-11 and AC-20 and states a
  falsehood: `src/index.css:146-149` records that a row would have to name a threshold ADM-01 lets an
  admin change, so `>50%` becomes a lie the moment somebody uses the feature. Rendering it truthfully
  needs a `seam.getTeam()` call the shell deliberately makes nowhere.
- **The palette icon.** Declined one ticket ago on stated grounds — what a control *does* is
  behaviour, and the § *Visual specification* grant does not reach behaviour. There is also nothing
  to switch to: § *Colour* is a bare `TODO(project)`.
- **All Vietnamese copy**, for the fifth time, per § *Language* — lint-enforced, so several of the
  picture's strings fail the build rather than failing review.
- **The four admin screens themselves.** `/entries/pending`, `/entries/team`, `/allow-list` and
  `/threshold` keep their content, their behaviour and their own in-screen refusals. This row moves
  links, not screens.
- **Folding the third `roleLabel` copy.** `src/components/Sidebar.tsx:30-33` already records that
  `MemberList.tsx` holds the second and that folding them is nobody's ticket. This ticket adds a
  third use of the same mapping **inside the file that already owns one**, so it creates no new copy
  — but it does not fold the existing two either, and § 8 records that as a decision rather than an
  omission.

`size_estimate`: **M**. One component file, nine shipped spec files, one new spec, and two shipped
plan files whose criteria this contradicts.

## 2. Acceptance criteria

Observable through `pnpm exec playwright test`. The selector attribute is `data-testid`.

**AC-1 — the four admin links are gone from the sidebar, for both roles**
- Given a signed-in admin, and separately a signed-in member
- When the sidebar is read on any route inside the shell
- Then `home-pending-entries-link`, `home-team-entries-link`, `home-allow-list-link` and
  `home-threshold-link` each resolve to zero nodes in both cases

**AC-2 — the three general links stay, for both roles**
- Given a signed-in admin, and separately a signed-in member
- When the sidebar is read on any route inside the shell
- Then `home-week-link`, `home-year-link` and `home-holidays-link` each resolve to exactly one node
  in both cases

**AC-3 — every address the sidebar gave up is still reachable in two steps**
- Given a signed-in admin on any route inside the shell
- When they follow the top-bar admin control and then each hub link in turn
- Then `/entries/pending`, `/entries/team`, `/allow-list` and `/threshold` each open

**AC-4 — the member denial is asserted against a node that exists**
- Given a signed-in member whose role is not admin
- When any route inside the shell is read
- Then `shell-admin-link` resolves to zero nodes, and that assertion — not an assertion naming a
  removed `home-*` id — is what states the denial in every spec that previously stated it

**AC-5 — no assertion in the suite passes because its subject stopped existing**
- Given the whole end-to-end suite after this change
- When every assertion that names a `home-*-link` id is read
- Then none of them asserts the absence of an id that renders for nobody

**AC-6 — a member who types an address is still refused by the screen**
- Given a signed-in member whose role is not admin
- When they open `/entries/pending`, `/entries/team`, `/allow-list` and `/threshold` by address
- Then each screen renders its own refusal — `pending-entries-refused`, `team-entries-refused`,
  `allow-list-refused`, `threshold-refused` — exactly as it does today

**AC-7 — each roster row shows the member's role**
- Given a signed-in caller and a team containing at least one admin and one member
- When the sidebar's roster is read
- Then each row carries the role word for that member, reading `Admin` or `Member`, beneath or beside
  the display name

**AC-8 — the roster's role word is a new selector and collides with nothing**
- Given a signed-in caller on any route inside the shell
- When every `data-testid` on the page is read
- Then the roster's role element carries an id that is not `home-member-role`, `home-member-role`
  still resolves to exactly one node in the account footer, and every id in the product still
  resolves to the number of nodes its own criterion states

**AC-9 — the signed-in member is still marked, and the roster is otherwise unchanged**
- Given a signed-in caller
- When their own row is read
- Then it still appends `(You)` to the display name, `shell-roster-row` still resolves to one node
  per member, and `shell-roster-count` still states the number of members

**AC-10 — the sidebar renders no control**
- Given a signed-in member and a signed-in admin
- When every element of the sidebar is read
- Then nothing in it approves, rejects, removes, promotes or writes anything, and the role word on a
  roster row is text rather than a control

**AC-11 — the interface is in English**
- Given the sidebar
- When every string it renders is read
- Then none contains a Vietnamese diacritic, except the product name `Ai Nghỉ?`, which is a name and
  not interface copy

### Invariants touched

**`[]` — and this is an answer, not the template default.**

Nothing in this ticket changes a table, a policy, an arithmetic or a definition, and the whole
deliverable sits above the data seam. `src/lib/data/absence.ts` is imported by neither file this
ticket changes. No entry is created, edited, approved, rejected or counted, so INV-01 to INV-06 have
no surface here.

**INV-07 is named because the deferred work would engage it and this ticket does not.** A count pill
on a sub-group header is one question away from a threshold per sub-group, which would give INV-04 a
second arithmetic scoped to something INV-07 does not recognise. The sub-groups are out of scope in
§ 1, so nothing here reaches that question. This is written down so a later reader finds the reason
rather than the silence.

The role word on a roster row is **displayed and never acted on** — the same property
`src/components/Sidebar.tsx:30-33` already records for `roleLabel`, and AC-10 is where it is
observed. Displaying a role neither grants nor withholds anything.

### Open questions

**None blocking the design.** One question blocks the *size*, and it is § 7's, not this section's.

Two things the ticket left open are decided here:

1. *Which node asserts the member case instead* (`ticket.yaml` § 3, the idea's open question 3).
   **`shell-admin-link`**, which UIE-09 shipped and which already renders only for an admin. Each of
   the six vacuous negatives is rewritten in place onto that id, in the spec that carried it, rather
   than being replaced by one new assertion on the hub. That answers § 9's size question in the
   direction that costs more lines and no more files: the denial stays stated on the route each spec
   is standing on, which is what made the original six worth having.
2. *Whether the four ids relocate onto the hub.* **No** — § 1 records that UIE-09's shipped
   `admin-hub-*-link` ids closed that option, and that closing it costs nothing.

One assumption that ships: **the role word needs no new read.** `useRoster` already returns every
member with `role` on it, which is what the account footer's `home-member-role` renders today. The
roster rows have had the data all along and chose not to draw it.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

**Correct even though `design/README.md` exists**, for the reason
`.ai/standards/ui-design-system.md` § *Visual specification* gives in its `CORRECTION 2026-09-09`
block: *"an image specifies a UI only if it is on disk at `.ai/board/tickets/<ID>/design/`"*, and
there is no image file in that folder and there never was (MD-030). What sits there is a hand
transcription whose own first line says it cannot be checked against the picture it describes.
UIE-05, UIE-06, UIE-08 and UIE-09 each wrote this same line for the same reason.

**What the transcription is evidence of, and how this plan spends it.** Its sidebar contains no
navigation links at all, and its member rows carry *"the display name (~13px, semibold, ink) and
beneath it the role word (~9px, grey)"*. § 1 takes the second and refuses the first on the operator's
own words, with two verified reasons.

**The layout below is mine.**

- **The role word sits beneath the display name**, in the smaller grey treatment the account footer
  already uses for the same word, so the roster and the footer say the same thing the same way. The
  row keeps its avatar chip on the left and becomes two stacked lines rather than one.
- **`(You)` stays on the name line**, appended, unchanged from UIE-02 AC-9 — it marks who the caller
  is, and moving it beside the role word would read as a second role.
- **The nav block keeps its three links in their current order** and simply loses its
  role-conditional half. No heading is added to explain the absence.

**And it reverses a stated UIE-02 decision, which is the whole reason this paragraph exists.**
`src/components/Sidebar.tsx:182-184` says in terms: *"No role badge, no count and no control on a
row."* AC-7 reverses the first clause of that sentence and leaves the other two standing — no count
and no control on a row. A reversal nobody marked is what § *Visual specification* exists to prevent,
so the reversal is marked here, in an acceptance criterion, and in the comment that sentence lives in.

## 3. Permission model

**Nothing here is a control, and no permission changes.** Every element involved is an affordance
over row-level security already in force (ADR-005, `src/components/Sidebar.tsx:10-15`).

| Action | `member` | `admin` |
|---|---|---|
| See a link to an admin address in the sidebar | ❌ (unchanged) | ❌ (**changed** — it moves to the hub) |
| See a link to an admin address on the hub | ❌ | ✅ (unchanged, UIE-09) |
| Reach any of the four addresses by typing it | unchanged | unchanged |
| See every teammate's role | ✅ (**new**) | ✅ (**new**) |

**A member who types any of the four addresses still reaches the screen and is still refused by it**
(AC-6). Hiding or moving a link saves a pointless journey and refuses nobody. If any part of this
ticket starts to read as restricting something, it has left its scope.

**One exposure change, stated because it is real and is not an invariant.** Every member can now see
every teammate's role, where before the role was visible only for the signed-in caller in the account
footer. It is not new information in the datastore — `member.role` is returned to both roles by
`member_select_team`, which TEA-03 shipped, and `/members` renders it for an admin — but it is newly
on screen for a member. `.ai/standards/rbac-and-security.md` carries no row that this contradicts,
and the roster is already a list of who is on the team.

## 4. Contract

### 4.1 The sidebar's nav block — `src/components/Sidebar.tsx`

The `isAdmin` conditional and the four `<Link>` elements inside it are removed. `isAdmin` itself
becomes unused in this file and is removed with them; nothing else reads it.

```tsx
<nav className="flex flex-col gap-0.5">
  <Link data-testid="home-week-link" to="/week" className={NAV_LINK}>This week</Link>
  <Link data-testid="home-year-link" to="/year" className={NAV_LINK}>The year</Link>
  <Link data-testid="home-holidays-link" to="/holidays" className={NAV_LINK}>Public holidays</Link>
</nav>
```

### 4.2 The roster row — `src/components/Sidebar.tsx`

```tsx
<li data-testid="shell-roster-row" data-member-id={m.id} className="flex items-center gap-2">
  <AvatarChip avatar={m.avatar} />
  <div className="flex min-w-0 flex-col">
    <span className="truncate text-[13px] text-ink-2">
      {m.id === member.id ? `${m.displayName} (You)` : m.displayName}
    </span>
    <span
      data-testid="shell-roster-role"
      data-role={m.role}
      className="text-[9px] uppercase tracking-wider text-ink-3"
    >
      {roleLabel(m.role)}
    </span>
  </div>
</li>
```

**`shell-roster-role` and never `home-member-role`.** That name already belongs to the account
footer's role line and `tests/e2e/tea-05-sign-in.spec.ts:65`, `:146` and `:155` read it by text; a
second node under it resolves to two under strict mode and fails UIE-02 AC-6's exactly-one count.
`shell-roster-role` follows `shell-roster-row` and `shell-roster-count`, which is the prefix this
file already uses for things the shell owns rather than a screen.

**`data-role` carries the raw value beside the rendered word**, so an assertion can read the fact
without depending on the copy — the shape `year-day-cell` and `month-cell` already use.

**`roleLabel` is reused, not copied.** It is declared at `Sidebar.tsx:34` and used by the account
footer; this adds a second call site in the same file. `MemberList.tsx`'s copy is untouched and
stays the second copy in the product, as § 1 records.

### 4.3 The nine navigation sites

Each `.click()` on a removed id becomes two steps: reach the hub, then click its link.

```ts
// before — adm-05-approve-reject.spec.ts:112
await page.getByTestId("home-pending-entries-link").click();

// after
await page.getByTestId("shell-admin-link").click();
await page.getByTestId("admin-hub-pending-link").click();
```

The four hub ids are `admin-hub-pending-link`, `admin-hub-team-entries-link`,
`admin-hub-allow-list-link` and `admin-hub-threshold-link`, all shipped by UIE-09 and asserted by its
own spec.

### 4.4 The thirteen visibility sites

- **The seven positive** become assertions on the hub's link, reached the same way. `adm-04:415`'s
  `toHaveText("Waiting for a decision")` moves to `admin-hub-pending-link` and keeps the text it
  asserts, since the hub row for that destination carries the same words.
- **The six negative** become `await expect(page.getByTestId("shell-admin-link")).toHaveCount(0)` on
  the same route, in the same test, for the same member (AC-4). That is the node that now carries the
  denial, and unlike the id it replaces it renders for somebody, so the assertion can fail.

### 4.5 The two shipped plans whose criteria this contradicts

Both are board plane and agent-writable; neither is under `.ai/registry/**`, so RULE-01 is not
engaged.

| Criterion | File | Why it must change |
|---|---|---|
| UIE-02 AC-6 | `.ai/board/tickets/UIE-02/01-plan.md:207-213` | It lists twelve `home-*` ids and requires each to resolve to exactly one node. Four of them resolve to zero after this. |
| UIE-02 AC-8 | `:221-227` | *"the four admin-only nav items are hidden from a member and shown to an admin"* — after this they are hidden from both. |
| UIE-09 AC-9 | `.ai/board/tickets/UIE-09/01-plan.md` | Its clause *"no `home-*` id is added, moved, renamed or removed"* was a promise about UIE-09's own change and reads as a standing property. Scoped to UIE-09, it stays true; unscoped it is false after this. |
| UIE-09 AC-10 | same | *"the sidebar is unchanged … including all four `home-*-link` admin links for the admin"* — false by design after this. |

**Four shipped criteria that a reader would expect on this list are NOT on it, and that was checked
rather than assumed.** ADM-01 AC-10 (*"the link is shown to an admin and to nobody else"*), ADM-04
AC-9 (*"no control approves … and no copy implies that one exists"*), CAL-03 AC-10 (*"reachable by an
admin and by nobody else"*, whose `Given` is *by address*) and TEA-05 AC-10 (*"the allow-list link is
shown to an admin and to nobody else"*) all stay **true as written**: an admin still sees a link to
each address and a member still sees none, and the surface the link sits on is not what any of them
states. Their *assertions* move; their substance does not. That is the same treatment UIE-02 itself
gave them when it moved eleven ids out of `Home.tsx` and left the word *landing screen* standing in
ADM-01 AC-10 and TEA-05 AC-10 — a precedent for prose drift on a surface move, which is what this is.

## 5. Seam impact

**None.** No function on the data-access seam is added, removed, renamed or changed, and neither
implementation is touched. `tests/seam-parity.test.ts` is unaffected.

No new read of any kind is made. `useRoster` already returns every member with `role`, which is what
`Sidebar.tsx` renders for the account footer today; AC-7 draws a field the component already holds.

**RULE-02 holds by construction.** The only source file this ticket changes imports `useRoster` and
`react-router-dom` and nothing from `src/lib/data/`. No `@supabase/*` import appears anywhere in it.

## 6. Schema delta

`none`, and not a fenced `none`.

No table, column, policy, grant, trigger, constraint or index is named by anything in this plan. The
one part of the picture that would have needed a migration is the roster's five sub-groups — there is
no column anywhere that groups members within a team — and § 1 puts it out of scope, where it is XL
and a human's under RULE-09.

`requires_adr: false`. This row decides inside envelopes that are already open: UIE-09's hub shape was
accepted at triage, and the operator's own words are the decision to remove the sidebar's admin
links. The two places an ADR would be owed are both out of scope — the sub-groups, and the tabbed
admin area UIE-09 § 7 fenced.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/components/Sidebar.tsx"
  - "tests/e2e/adm-01-threshold.spec.ts"
  - "tests/e2e/adm-04-worklist.spec.ts"
  - "tests/e2e/adm-05-approve-reject.spec.ts"
  - "tests/e2e/adm-06-bulk-reject.spec.ts"
  - "tests/e2e/cal-03-admin-edit-entry.spec.ts"
  - "tests/e2e/cal-07-overload-warning.spec.ts"
  - "tests/e2e/cal-08-holiday-shading.spec.ts"
  - "tests/e2e/tea-05-sign-in.spec.ts"
  - "tests/e2e/uie-09-admin-hub.spec.ts"
  - "tests/e2e/uie-10-sidebar.spec.ts"
  - ".ai/board/tickets/UIE-02/01-plan.md"
  - ".ai/board/tickets/UIE-09/01-plan.md"
```

Thirteen files. `.ai/board/tickets/UIE-10/` is absent because the guard exempts the active ticket's
own folder.

`size`: **L** — more than 12 (`.ai/01-operating-model.md:373`).

**`size_estimate` said M and the verdict is L. They disagree and the verdict wins (ADR-012) — but
`L` does not merely proceed.** The estimate missed by exactly the two files UIE-09 added between the
triage that shaped this ticket and this plan: its own spec file, and its own plan whose AC-10 states
the opposite of AC-1 above. `ticket.yaml` § 9's signal of ten files was taken before either existed.

### `L` proceeds unsplit, by the operator's decision of 2026-09-09

**`.ai/01-operating-model.md:373` says an `L` must split at PLAN. This one does not, and the reason
is recorded here rather than in a reply.** The operator was asked, with the options costed, and
chose to accept `L` and record the exception. That decision is theirs to make and this paragraph is
the durable form of it: the plan carries it, `ticket.yaml` carries it, and both ride the pull request
where CODEOWNERS review sees them.

**Why splitting was the wrong remedy here, measured rather than asserted.** Three cuts were costed
and none of them is better than the whole:

- **Carving out the roster restyle removes no file at all.** `Sidebar.tsx` is needed by both halves
  and `tests/e2e/uie-10-sidebar.spec.ts` is needed by the migration regardless, for AC-1 and AC-2;
  the carved half would need a second spec of its own. The count stays 13. *This was offered as the
  recommended option and it was wrong — see the Changelog.*
- **Cutting by which links move** — `/threshold` and `/allow-list` first, then `/entries/pending` and
  `/entries/team` — does produce two `M` tickets, at 8 files and 10. It was rejected because it
  leaves the sidebar half-migrated for the length of a whole ticket, and because both halves amend
  the same two shipped plan files, the second rewriting what the first just wrote.
- **Dropping the two plan-file amendments** reaches 11 files and `M` legitimately, and is the worst
  of the three: four shipped criteria stay on disk stating the opposite of what ships, with the
  correction one indirection away in another ticket's plan.

**What the sizing table is for, and why this ticket is not what it is aimed at.** The table stops a
ticket too large to review. This one is nine near-identical edits to nine spec files, one component
change, and two prose amendments — breadth rather than depth, and `ticket.yaml` § 1 argues that
keeping the migration in *one reviewable place* is the whole point of the UIE-09/UIE-10 split that
already happened. Splitting it again inverts that.

**And the split could not have been executed in this stage anyway.** A carved-out half needs a
feature ID and a row in `.ai/registry/features.md`; feature rows are `product`'s at `/triage` under
ADR-007, the registry is human plane under RULE-01, and `CLAUDE.md` § *Working agreements* forbids
inventing a feature ID. **This is MD-017** — open, high severity, *"no command owns a ticket shell
created by a split at DESIGN"* — reached for the second time in this repository, exactly as that row
predicted. The exception taken here does not fix MD-017 and must not be read as fixing it: the next
`L` reproduces this, and the row's own recommended fix shape is still unimplemented.

**One line is owed in `.ai/board/model-debt.md`, beside MD-017, and it is not this ticket's to
write.** That file is `/thuki`'s, on an `ops/` branch, and adding it here would put a fourteenth file
in `allowed_paths` and a steward's plane inside a UI ticket. The text it wants is in the reply that
accompanied this plan.

## 8. Rejected alternatives

**1 — Leave the four links in the sidebar and let the hub duplicate them.** Zero spec churn: all
thirteen visibility assertions and all nine clicks keep passing unedited, and the hub is purely
additive forever. Rejected because it is the state UIE-09 already shipped and explicitly called a
double exposure it was deliberately leaving for this row, and because it answers the operator's
request with the half of it that costs nothing — *"Remove all the link to admin page in sidebar"* is
the sentence this option declines to execute.

**2 — Relocate the four `home-*-link` ids onto the hub, unrenamed, as UIE-02 did with eleven ids.**
`ticket.yaml` § 2.1 offered this and it was the right instinct when written. Rejected because UIE-09
shipped `admin-hub-*-link` on those exact rows and asserts each resolves to one node, so adopting a
`home-*` name means renaming away from a name a shipped spec asserts — trading four broken assertions
for five. And it saves nothing: every navigation site needs the inserted hub step either way.

**3 — Replace the six vacuous negatives with one new assertion on the hub instead of six in place.**
Fewer lines, one place to read, and `ticket.yaml` § 9 named this as the choice that would move the
size. Rejected because the six exist on six different routes and what they state is *this member, on
this screen, is offered nothing* — collapsing them to one assertion on one route drops five of the
six routes from the claim. The denial belongs where the spec is standing, which is why the original
six were written that way.

**4 — Fold `MemberList.tsx`'s `roleLabel` copy into a shared module while the file is open.** The
duplication is flagged in `Sidebar.tsx:30-33` and this ticket touches one of the two sites, so it is
the cheapest moment it will ever have. Rejected because it adds a file to a ticket already over its
size limit, it changes a screen this row has no other business in, and the fold wants to decide where
display strings live — a question with no answer in `.ai/standards/` today. Named in § 1 Out-of-scope
so the next reader finds a decision rather than an oversight.

**5 — Empty the nav block entirely, as the transcription draws it.** The most faithful reading of the
picture. Rejected on two verified facts rather than on preference: the top bar renders no switcher on
the eight non-period routes, so on three of them the sidebar's week and year links are the only route
to a calendar; and `/holidays` is linked from exactly one place in the product and is guarded on a
session rather than a role, so no admin control can adopt it without breaking ADM-02 AC-15 and taking
the national calendar away from every member. It remains available as its own idea, and it owes a
second answer for `/holidays` before it can be one.

## Changelog

- `2026-09-09T15:04:18+0700` — sections 1 and 2 written from `.ai/registry/features.md`,
  `ticket.yaml` and `design/README.md`, before the source tree was read for sections 3 to 8. Raised
  by `tech-lead-design`.
- `2026-09-09T15:04:18+0700` — section 1, **the ticket's own measurement corrected in three places
  after reading every reference on disk**, which `ticket.yaml` § 11 asked this plan to do: nine spec
  files rather than eight, thirteen affected visibility assertions rather than seventeen, and the
  relocation option closed. All three moved because UIE-09 shipped between that triage and this plan.
  Raised and amended by `tech-lead-design`.
- `2026-09-09T15:04:18+0700` — section 2, **AC-5 added**. The six vacuous negatives were named in
  `ticket.yaml` § 3 as a hazard; nothing in the criteria as first drafted would have caught a
  seventh one introduced by this ticket's own edits. AC-5 states the property rather than the six
  instances. An addition, not a reshaping. Raised and amended by `tech-lead-design`.
- `2026-09-09T15:04:18+0700` — front-matter, **`gate` set to `BLOCKED` after section 7 was
  enumerated**. Sections 1 to 6 and 8 are complete and stand whichever option the operator takes;
  only `allowed_paths` and `size` depend on the answer. Raised by `tech-lead-design`.
- `2026-09-09T15:04:18+0700` — section 7, **an option offered to the operator was wrong and they
  acted on it before it was caught.** Carving the roster restyle into its own row was presented as
  the recommended remedy and costed at 11 files; it removes no file, because `Sidebar.tsx` is needed
  by both halves and this ticket needs its own spec for AC-1 and AC-2 whether the roster stays or
  goes. The error was found while writing the revised `allowed_paths`, corrected to the operator in
  the same session, and the decision retaken on costed options. Recorded because a plan that hides a
  wrong recommendation teaches nothing about the next one. Raised and amended by `tech-lead-design`.
- `2026-09-09T15:04:18+0700` — front-matter, **`gate` moved from `BLOCKED` to `PASS` on the
  operator's decision of 2026-09-09 to accept `L` unsplit.** Nothing in sections 1 to 6 or 8 changed:
  the block was only ever about `size` and `allowed_paths`. Raised by `tech-lead-design`.
