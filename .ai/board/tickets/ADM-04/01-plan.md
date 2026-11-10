---
ticket: ADM-04
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-05T17:25:45+07:00
inputs_read:
  - .ai/board/tickets/ADM-04/ticket.yaml
  - .ai/board/tickets/ADM-01/01-plan.md
  - .ai/board/tickets/CAL-03/01-plan.md
  - .ai/board/ideas/2026-08-31-no-way-to-tell-a-settled-plan-from-a-typed-one.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-013-a-removed-member-counts-until-removal.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/registry/decisions/ADR-018-who-may-read-the-member-list.md
  - .ai/00-charter.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - src/App.tsx
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/Home.tsx
  - src/routes/TeamEntries.tsx
  - tests/seam-parity.test.ts
  - ui-language.json
  - node_modules/.pnpm/@supabase+postgrest-js@2.112.4/node_modules/@supabase/postgrest-js/dist/index.d.mts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# ADM-04 — The worklist of entries awaiting a decision

## 1. Problem and scope

**The feature row, transcribed from `.ai/registry/features.md:103` without paraphrase.** The
sentences this plan is built on, in the order they appear:

> The worklist of entries awaiting a decision
>
> Brief 7.4, and the half of that idea's Problem statement that is not the action: *"no worklist of
> what is waiting for them"* — nothing accumulates, nothing is visibly outstanding, and today the
> review happens by scrolling the calendar looking for things that look new. **The read path, split
> from ADM-05 by operation** […] **`product` argued at triage that the worklist is not separable** […]
> That argument lost, and it is recorded here because it fixes what this row must **not** do: **this
> row carries no approve control and no reject control.** It lists, filters, counts and links;
> ADM-05 puts the decision on it. A read-only queue is exercisable end to end at its own QA gate and
> delivers half the idea on its own. **`schema_delta` none, and this is one of the few genuinely
> `none` rows under ADR-014:** it reads through the select policy CAL-01 ships for *Read any entry in
> the team*, and adds no policy, no column and no grant. **`TEA-03` is a hard dependency rather than a
> courtesy** […] a worklist of unnamed entries is not the feature. **The truncation hazard here has
> CAL-07's direction, not CAL-04's, and the direction is the whole finding:** a capped read makes a
> queue **short**, so pending items are silently invisible and are therefore never decided — a feature
> whose entire value is *the queue is visible* has a silent failure mode pointing at *the queue is
> empty*, and there is no error anywhere. The outstanding badge must derive from an exact count and
> never from `data.length`, the list must page rather than truncate, and the badge and the list must
> not be able to disagree. It compounds with the past-dated marker below, since those accumulate and
> are exactly what a cap eats first. […] **`Invariants touched` is `[]`** […] TODO(project): whether a
> work-from-home entry goes through approval at all. […] Recommendation: one path for both types, with
> a type filter on this list — a status-less type would be a schema change and a second rule. **This
> is the marker that most directly blocks acceptance criteria here, because it decides what the list
> contains.** TODO(project): what happens to a pending entry whose date has already passed. […]
> Recommendation: **no fourth `entry_status` value** […] and instead a default filter of `end_date >=
> today` with past-dated pending entries reachable behind an explicit filter. INV-04 is unaffected
> either way: a pending entry counts whether or not this list shows it. The surface's shape — its own
> screen or an item in an admin settings area — is ADM-01's `TODO(project):`, inherited here and not
> re-asked.

**Who gains what.** An **admin** gains the thing the idea's Problem statement names and the product
has never had: a place where outstanding decisions accumulate visibly, instead of being discovered by
scrolling the calendar for rows that look new. A **member** gains nothing directly and that is
correct — this is a work surface, and every entry on it is already readable to them through
`entry_select_team`.

**What this ticket does not do, stated once at the top because the registry row makes it the
ticket's defining constraint: it carries no approve control and no reject control.** `product` argued
at triage that a read-only worklist is not separable from the action and lost; the losing argument is
kept in the registry precisely so this line cannot be quietly re-argued at implementation time. The
queue becomes decidable at ADM-05, on this same screen.

**`size_estimate`: M.** One new screen, one new seam function implemented twice, two new domain
shapes, three new fixtures, one route, one home link — and no migration, no policy and no grant.

### Out of scope

- **Approving and rejecting.** ADM-05, on this surface. No control, no copy that implies one, and no
  seam function.
- **Any write at all.** The row links to `/entries/:id/edit`, which is CAL-02's and CAL-03's shipped
  screen. That link is navigation to an existing capability, not a control this ticket adds.
- **A fourth `entry_status` value, and any auto-expiry.** The idea's triage names it out of scope in
  words: *"a status that changes itself is exactly the false record INV-02 exists to prevent."*
  Past-dated pending entries stay `pending`, which is truthful — nobody ever decided.
- **Telling the member anything.** v1 has no notification channel and the idea forbids growing one.
- **Any quota, balance, entitlement or remaining-days figure**, and any path that reaches HR. Charter
  refusals 1 and 2, and the idea's seven testable conditions. AC-15.
- **Approval controls on the calendar views.** CAL-05 refuses them from its side; this refuses them
  from the other, so nobody adds a button in between.
- **Changing what `listTeamEntries` does.** CAL-03's flat read stays flat and this ticket does not
  grow a parameter on it. Section 5 says why a second read is the right answer rather than a fifth
  argument on an existing one.
- **Fixing the two limit constants this plan found to be above the datastore's cap.** *Open questions*
  item 4 — it is a defect in shipped CAL-03 and CAL-04 behaviour, it wants a `BUG` row, and quietly
  editing two numbers inside a ticket whose own `invariants_touched` is `[]` would bury it.
- **A second count for the entries the default filter hides.** *Open questions* item 3.

## 2. Acceptance criteria

Observable through the interface or through `pnpm test`. The selector attribute is `data-testid`.

**AC-1 — the worklist contains exactly the entries awaiting a decision**
- **Given** a team holding pending, approved and rejected entries
- **When** an admin opens `/entries/pending`
- **Then** every row shown is an entry whose `status` is `pending`, and no approved or rejected entry
  appears

**AC-2 — every row names the member it belongs to**
- **Given** a pending entry belonging to somebody other than the caller
- **When** the worklist renders
- **Then** the row shows that member's display name and avatar, not a bare id — a worklist of unnamed
  entries is not the feature

**AC-3 — the outstanding count is exact, and cannot disagree with the list**
- **Given** a worklist whose matching set is larger than one page
- **When** the screen renders
- **Then** the outstanding count states the size of the whole matching set rather than the number of
  rows on screen, and both come from the same read

**AC-4 — the list pages rather than truncates**
- **Given** more pending entries than fit on one page
- **When** the admin moves to the next page
- **Then** the following entries are shown, the outstanding count is unchanged, and no entry is
  unreachable

**AC-5 — a page the datastore shortened is refused rather than consumed**
- **Given** a read that returns fewer rows than the page size while the exact count says more remain
- **When** the worklist loads
- **Then** it renders its failure state and no list, because a queue that is silently short is a
  decision nobody will ever make

**AC-6 — the default window hides past-dated pending entries**
- **Given** a pending entry whose `end_date` is before today, and one whose `end_date` is today or
  later
- **When** the worklist opens with no filter chosen
- **Then** the second appears and the first does not, and the outstanding count counts only what is
  shown

**AC-7 — past-dated pending entries are reachable behind an explicit filter**
- **Given** the same two entries
- **When** the admin switches the window filter to past-dated
- **Then** the past-dated entry appears, and the count changes to match the new set

**AC-8 — work-from-home entries are in the list, and the type filter narrows it**
- **Given** one pending PTO entry and one pending WFH entry
- **When** the worklist opens with no type chosen, and then with each type chosen in turn
- **Then** both appear first, then only the PTO entry, then only the WFH entry — and the count
  follows each time

**AC-9 — there is no approve control and no reject control**
- **Given** an admin on the worklist
- **When** the screen is inspected
- **Then** no control approves, rejects, or writes `status`, `rejection_reason`, `approved_by` or
  `approved_at`, and no copy implies that one exists

**AC-10 — a member reaching the screen is refused, and the refusal is an affordance**
- **Given** a signed-in member who is not an admin
- **When** they type `/entries/pending`
- **Then** they see the refusal state and no list — and the refusal is not what protects anything:
  `entry_select_team` admits the team's rows to both roles, so deleting the refusal would show them a
  list they can already read at `/entries/team` and would grant them nothing

**AC-11 — an empty worklist says so**
- **Given** a team with nothing awaiting a decision in the chosen window
- **When** the worklist renders
- **Then** it states that nothing is waiting, rather than rendering as a screen that failed to load

**AC-12 — the three non-list states**
- **Given** a caller with no member row, a non-admin, and a read that throws
- **When** `/entries/pending` is opened in each case
- **Then** the first and second see the refusal state, the third sees the failure state, and neither
  is the loading state that never ends

**AC-13 — no other team's entry appears (INV-07)**
- **Given** a pending entry belonging to a member of another team
- **When** an admin of this team opens the worklist
- **Then** it does not appear, and the outstanding count does not include it

**AC-14 — each row links to that entry**
- **Given** a row on the worklist
- **When** the admin follows its link
- **Then** they reach `/entries/:id/edit`, the screen CAL-02 and CAL-03 already ship — the worklist
  lists, filters, counts and links, and adds no editing of its own

**AC-15 — the copy is a coordination signal, not an employment decision**
- **Given** the rendered worklist
- **When** its copy is read
- **Then** the object is an entry and never a request, an application or *đơn*; no quota, balance,
  entitlement or remaining-days figure appears anywhere; nothing on the screen is disabled because an
  entry is pending; and no control, link or field reaches HR

**AC-16 — *today* is the caller's date, not the datastore's**
- **Given** the unit suite
- **When** the window filter is exercised with an explicit date and the suite is run under
  `TZ=UTC`, `TZ=Asia/Ho_Chi_Minh` and `TZ=America/Los_Angeles`
- **Then** the same entries are included in each run, because the boundary is a `yyyy-MM-dd` string
  the caller supplies and never a clock the read reads

**Invariants touched.** `[]`, written explicitly.

The feature row states it and RULE-04 makes the row the source: this ticket computes no absence count
and writes nothing, so it cannot produce a second definition of anything — *"the same argument that
kept INV-04 off CAL-08."*

Reasoned per candidate rather than asserted, because `.ai/registry/invariants.md` requires indirect
chains to be followed:

- **INV-02, INV-03** are about transitions of `status` and `rejection_reason`. This ticket performs no
  transition. It *displays* the pending state, which is the state those invariants leave alone.
- **INV-04, INV-05** are the absence count. A pending entry counts whether or not this list shows it —
  the registry row says so in those words — and nothing here filters, sums or renders a count of
  absences. The number this screen shows is a count of **entries awaiting a decision**, which is a
  different quantity over a different set and appears in no invariant.
- **INV-07** — every entry belongs to one member and is counted only against that member's team — is
  the closest call and is still not touched: AC-13 asserts it holds, and it is held by
  `entry_select_team`, which CAL-01 shipped and this ticket does not change. Asserting an invariant
  still holds is not touching it.

### Open questions

**None blocking.** Items 1 and 2 are the two `TODO(project):` markers the registry row carries, both
with a recommendation already recorded there by `product` at triage; both are taken, marked, and named
with the criteria to revisit. This is the ADM-01 pattern — that ticket took its own row's
recommendation for the surface shape and for the threshold's bounds, shipped, and named AC-7 and AC-8
as the two to revisit.

**1. Assumption that ships — a WFH entry goes through approval exactly as a PTO entry does, and the
list carries a type filter.** `features.md:103` records the question and recommends *"one path for
both, with a type filter on the worklist"*, and the idea's disposition 3 says the schema has already
answered the data half: every entry has `status` defaulting to `pending` with no `type` condition, and
INV-04 counts both types alike. **Taking the recommendation changes nothing; the alternative is the
change** — a status-less type is a schema change, a second rule, and an ADR nobody has asked for. The
type filter is what makes the WFH volume manageable if the operator's real objection turns out to be
noise rather than principle. **AC-8 is the criterion to revisit** if they answer otherwise, and the
change would then be a `where` clause, not a shape.

**2. Assumption that ships — the default window is `end_date >= today`, and past-dated pending entries
are reachable behind an explicit filter.** `features.md:103` recommends exactly this and rules out the
alternative by name: **no fourth `entry_status` value**. Past-dated entries stay `pending`, which is
truthful — nobody ever decided. **AC-6 and AC-7 are the two to revisit.**

The registry row calls this *"the worklist's defining filter"* and it compounds with the truncation
hazard, since past-dated entries accumulate and are exactly what a cap eats first. Section 4.2 answers
both at once: the window is a parameter of the read, and the read pages against an exact count rather
than capping.

**3. Not blocking — the count on screen is the count of the query on screen, and there is no second
number.** With the default window, an admin sees *"N awaiting a decision"* where N counts only the
upcoming ones; the past-dated ones are neither shown nor counted. A second figure — *"and M
past-dated"* — would need a second read, and two reads can disagree, which is the one property the
registry row forbids this screen from having. The window filter is rendered as a three-way control
that is always visible (§ 2b), so the existence of the other sets is advertised by the control rather
than by a number. If the operator wants the hidden total surfaced, the honest shape is a second query
whose result is labelled as a separate read, and it is a scope change.

**4. Not blocking, not this ticket's to fix, and the finding of this run — two shipped row limits sit
ABOVE the datastore's cap, so their truncation assertions can never fire.**
`.ai/standards/tech-stack.md` lists Supabase as past reliable recall and four tickets carry
`TODO(verify): Supabase's default max-rows`. **It was verified on disk for this plan.** The installed
client's own documentation says it:

> `node_modules/.pnpm/@supabase+postgrest-js@2.112.4/node_modules/@supabase/postgrest-js/dist/index.d.mts:3522`
> — *"By default, Supabase projects return a maximum of 1,000 rows. This setting can be changed in
> your project's API settings."*

Against 1000, of the five limits in `src/lib/domain/types.ts`:

| Constant | Value | Verdict |
|---|---|---|
| `ROSTER_LIMIT` | 500 | Below the cap. The assertion fires first, as designed |
| `OWN_ENTRY_LIMIT` | 500 | Below. Fine |
| `HOLIDAY_LIMIT` | 1000 | **Exactly equal.** The `>=` comparison still fires, so it works — by one row, and by accident |
| `TEAM_ENTRY_LIMIT` | 2000 | **Above.** The server caps at 1000 and answers a believable short list; `rows.length >= 2000` never fires |
| `MONTH_ENTRY_LIMIT` | 2000 | **Above.** Same, and CAL-04 AC-11 is the criterion that is not held: a capped read SUMS what it was given and the month grid shows a wrong count with no error anywhere |

Each of those constants states in its own comment that it *"must sit BELOW the datastore's `max-rows`
cap so that this assertion fires before the server's silent one does"*, and two of them do not. **This
is a defect in shipped CAL-03 and CAL-04 behaviour, not in this ticket**, and it is recorded rather
than fixed: `src/lib/domain/types.ts` is in this ticket's `allowed_paths` for its own two new shapes,
and changing two numbers there would silently alter two other tickets' acceptance criteria inside a
ticket whose `invariants_touched` is `[]`. **It wants a `BUG` row of its own**, and `/triage` issues
those. The cap is per-project configurable, so the fix is a decision about which number moves.

This ticket's own page size is 50 and is safely below the cap; section 4.2's short-page assertion also
detects a lowered cap without knowing its value, which is the property the four `TODO(verify)` markers
were waiting for.

**5. Not blocking — the row order is fixed in the datastore rather than above the seam, and
`tests/seam-parity.test.ts` cannot see a divergence.** Paging requires a stable server-side order, so
unlike `absence.ts` — which sorts above the seam precisely so the two implementations cannot disagree
— the order here is written twice, once per implementation. Section 4.2 states it exactly, and the
mock's copy is asserted in `tests/pending-entries.test.ts`. Named because it is the one place this
ticket accepts a duplication the codebase elsewhere refuses.

**6. Not blocking — `.ai/standards/ui-design-system.md` § Colour and § Components are still
`TODO(project)` stubs.** Every criterion above turns on an attribute or on copy, never on a colour, so
none of them changes when the standard is written.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

Checked before writing: `.ai/board/tickets/ADM-04/design/` does not exist, and
`.ai/board/ideas/2026-08-31-no-way-to-tell-a-settled-plan-from-a-typed-one.md` attaches no image. So
the arrangement is originated here and marked as this agent's own, which is what lets a reviewer argue
with it cheaply.

It is cheap to argue with for a second reason: **it borrows its shape wholesale from
`src/routes/TeamEntries.tsx`**, which is the nearest thing the product has to this screen — the same
four view phases, the same row anatomy, the same refusal copy pattern. Three things are new, and each
is a decision rather than a copy:

- **The outstanding count sits in the header, beside the title, and states the whole matching set.**
  It is a sentence and not a badge on a navigation item, because there is no navigation chrome in this
  product to hang one on and inventing one would be inventing a control.
- **Two filters, always visible, never collapsed behind a control.** The window filter is three-way —
  upcoming, past-dated, all — and the type filter is three-way — both, leave, working from home.
  Always visible because the default window *hides* rows: a filter that hides things while itself
  being hidden is how an admin concludes the queue is empty (*Open questions* item 3).
- **Rows are ordered by the date they concern, soonest first**, not by when they were created. A
  worklist ordered by creation buries an entry starting next Monday under one for next year, and the
  whole purpose is deciding before the date arrives.

The order this screen renders in is stated in section 4.2 as part of the contract rather than left to
the layout, because paging makes it load-bearing.

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. **This ticket consumes rows and invents none, and it
adds no policy and no grant of any kind.**

| Action | `member` | `admin` | Where it is enforced |
|---|---|---|---|
| `Read any entry in the team` (line 30) | ✅ | ✅ | `entry_select_team` — **shipped by CAL-01**, not by this ticket. It admits the team's rows to both roles, which is why the read is not the capability |
| `Read the member list` (line 39) | ✅ | ✅ | `member_select_team` — **shipped by TEA-03** under ADR-018. This is the hard dependency: without it an embedded member comes back empty and AC-2 is unsatisfiable |
| `Approve or reject another member's entry` (line 35) | ❌ | ✅ | `entry_update_admin` and `public.entry_enforce_decision()` — **ADM-05's**, and **not reachable from this surface at all** (AC-9) |
| `Approve or reject their own entry` (line 36) | ❌ | ✅ | Same, and same: ADM-05's |

**The denials, stated as denials.**

- **Nobody writes anything from this screen.** No seam write function is imported and no control
  renders. AC-9 asserts it from outside; a reviewer checks it by reading the imports in section 4.3
  and finding one read.
- **A member does not reach the worklist** — and this is an **affordance, not a control**, which has
  to be said plainly because a screen that says *"this page is for admins"* reads exactly like one.
  `entry_select_team` admits the whole team's rows to both roles, so a member who deletes the refusal
  in a debugger sees a list of rows they can already read at `/entries/team`, and gains nothing.
  AC-10 asserts the affordance. **There is no control here to assert**, because there is no
  capability behind the screen that a member lacks — which is exactly why this section can be short
  and why nothing in this ticket is load-bearing for security.
- **No entry of another team is reachable**, by anybody, through `entry_select_team`'s team predicate.
  AC-13, held by CAL-01's policy and asserted rather than implemented here.

**The one substantive permission observation, recorded not fixed.** The worklist is the first screen
in the product whose *purpose* is admin-only while its *data* is readable by both roles. That is not a
gap: `Read any entry in the team` is ✅✅ by operator decision, and the alternative — a policy
restricting the pending set to admins — would contradict a decided row. It is named so a reviewer does
not read the missing policy as an oversight.

## 4. Contract

### 4.1 Domain types — `src/lib/domain/types.ts`

Added at the end, in the ADM-04 section, beside the five existing row limits. Nothing existing changes
shape, so no existing caller changes and the *"changes a shared type module"* clause of
`.ai/01-operating-model.md:375` is not engaged — the CAL-04, ADM-02 and CAL-08 precedent.

```ts
// ---------------------------------------------------------------------------
// ADM-04. 01-plan.md section 4.1.
// ---------------------------------------------------------------------------

/**
 * Which side of `today` the worklist is asking for. 01-plan.md section 2, Open questions item 2:
 * `upcoming` is the default the screen opens on and `past` is the explicit filter that reaches the
 * entries nobody ever decided. They stay `pending` in every window — there is no fourth
 * `entry_status` and none is proposed.
 */
export type PendingWindow = "upcoming" | "past" | "all";

/** ADM-04. What the worklist is asking for. */
export interface PendingEntryQuery {
  /** `null` means both types. The type filter Open questions item 1's recommendation asks for. */
  type: EntryType | null;
  window: PendingWindow;
  /**
   * `yyyy-MM-dd`, SUPPLIED BY THE CALLER from its own clock and never read from the datastore's.
   *
   * "What day is it for the person looking at the screen" is a fact about their clock — the one
   * place a local date read is correct, which src/routes/MonthView.tsx already records for
   * `currentMonth()`. A server-side `current_date` would be evaluated in the datastore's timezone
   * and would flip the boundary seven hours early for a Vietnamese team. It is a parameter rather
   * than a module read so the filter is testable without a clock (AC-16).
   */
  today: string;
  /** 0-based. */
  page: number;
}

/**
 * ADM-04. One page of the worklist, AND the exact size of the set it was drawn from.
 *
 * ONE SHAPE FROM ONE READ, and that is the decision this type exists to hold. The feature row
 * requires that the outstanding count derive from an exact count and never from `data.length`, and
 * that the badge and the list not be able to disagree. Two seam calls — one counting, one listing —
 * can disagree, because a write can land between them. One response carrying both cannot.
 */
export interface PendingEntryPage {
  /** This page's rows, in the order section 4.2 fixes. Never more than `pageSize`. */
  rows: Entry[];
  /** The EXACT number of entries matching the query, from the datastore. Never `rows.length`. */
  total: number;
  /** Echoed back, so a caller rendering a stale page cannot mislabel it. */
  page: number;
  pageSize: number;
}

/**
 * The worklist's page size, and the number the short-page assertion in both seam implementations is
 * written against.
 *
 * UNLIKE the five limits above it, this is NOT a refuse-above-this ceiling — it is a window, and the
 * read pages rather than truncating. It must still sit below the datastore's `max-rows`, and for the
 * first time in this file that number is known rather than deferred: the installed client documents
 * the platform default as 1000
 * (@supabase/postgrest-js@2.112.4/dist/index.d.mts:3522). 50 is far below it, and section 4.2's
 * short-page assertion detects a LOWERED cap without needing to know its value — which is what the
 * `TODO(verify)` markers on ROSTER_LIMIT, OWN_ENTRY_LIMIT, TEAM_ENTRY_LIMIT, MONTH_ENTRY_LIMIT and
 * HOLIDAY_LIMIT were waiting for. 01-plan.md section 2, Open questions item 4 records that two of
 * those five are above the cap and are therefore not held; fixing them is not this ticket's.
 */
export const PENDING_PAGE_SIZE = 50;
```

### 4.2 The seam — `src/lib/data/index.ts`, `mock.ts`, `supabase.ts`

**One function added. Nothing existing changes signature or behaviour.**

```ts
/**
 * ADM-04. One page of the entries awaiting a decision, with the exact size of the matching set.
 *
 * NOT `listTeamEntries` with arguments. That read is deliberately flat and its own comment says it
 * must not grow a parameter — "the moment it does there are two team-entry reads and one of them
 * will be the one nobody updated". This is a different question over a different set with a
 * different failure mode, and it answers with a different shape.
 *
 * NO ROLE PARAMETER AND NO `is_admin` CHECK INSIDE IT. `entry_select_team` admits the team's rows to
 * both roles, so this read is not where the admin capability lives — there is no admin capability
 * behind this screen at all (01-plan.md section 3).
 *
 * THROWS on a transport failure, and on a page the datastore shortened — see the assertion below.
 * It does NOT throw on a full page: a full page is normal and is what `total` and `page` exist to
 * navigate.
 */
listPendingEntries(query: PendingEntryQuery): Promise<PendingEntryPage>;
```

**The predicate, stated exactly so both implementations write the same one:**

- `status = 'pending'`.
- `type = query.type` when it is not null; no type predicate when it is.
- `window: "upcoming"` → `end_date >= query.today`. `window: "past"` → `end_date < query.today`.
  `window: "all"` → no date predicate. **The comparison is on `yyyy-MM-dd` strings**, which sort
  lexicographically and carry no timezone, exactly as `src/lib/data/absence.ts` compares dates.
- The team predicate is **not written here**. `entry_select_team` supplies it, and a copy in the query
  would be a second expression of INV-07 above the seam (AC-13).

**The order, fixed here because paging makes it load-bearing:** `start_date` ascending, then
`created_at` ascending, then `id` ascending. Soonest-concerning first, because the decision is wanted
before the date arrives; two deterministic tiebreakers because a page boundary that shuffles between
requests either repeats a row or drops one, and dropping one on this screen is an entry nobody ever
decides. **Both implementations write this order and `tests/seam-parity.test.ts` cannot see a
divergence** — *Open questions* item 5, and `tests/pending-entries.test.ts` asserts the mock's copy.

**The paging read, and the assertion that replaces the ceiling every other read on this seam uses.**
Verified against the installed client rather than recalled: `.select(columns, { count: "exact" })`
returns a top-level `count` beside `data`
(`@supabase/postgrest-js@2.112.4/dist/index.d.mts:4303-4306` for the option, `:646` for the response
field), `.range(from, to)` takes the window (`:1351`), and the package documents that **with `count`
and `range` together the count is the total matching set rather than the page** (`:3519`). So one
request answers both halves of AC-3, which is what makes the badge and the list unable to disagree.

```
from = query.page * PENDING_PAGE_SIZE
to   = from + PENDING_PAGE_SIZE - 1
```

**AC-5's assertion, in both implementations, in these words:** if `rows.length < PENDING_PAGE_SIZE`
**and** `from + rows.length < total`, the datastore returned a short page that is not the last page —
it capped the read — and the function **throws**. This is the truncation guard in the direction the
feature row names: a queue that comes back short reads as *the queue is empty*, and there is no error
anywhere. It is strictly better than the ceiling assertions elsewhere in this seam because **it
detects a cap without knowing its value**, which is the unknown four tickets have been carrying.

**`total` is never derived from `rows.length`, in either implementation, at any point.** That
sentence is the feature row's, and it is repeated here because it is the one line a reasonable
developer will simplify away in the mock, where the two happen to agree.

### 4.3 The screen — `src/routes/PendingEntries.tsx` (new), at `/entries/pending`

**Its own screen, not an item in an admin settings area** — ADM-01's `TODO(project):` was answered at
its own PLAN with *its own screen at `/threshold`*, and the registry row for this ticket says the
answer is inherited and not re-asked. `/entries/pending` sits in the family `/entries/team` and
`/entries/new` already established.

**Four view phases, the shape `TeamEntries.tsx` and `MemberList.tsx` use:** `loading`, `refused` (a
caller with no member row, and a non-admin — AC-10, AC-12), `unavailable` (any throw, including AC-5's
short-page assertion), and `ready`.

**The seam calls, enumerated so AC-9 is checkable by reading them:**

| Call | Why |
|---|---|
| `seam.getCurrentMember()` | the affordance's role check, and the member-less state |
| `seam.listPendingEntries(query)` | the page and the count |
| `seam.listMembers()` | AC-2's names and avatars, the roster including removed members (ADR-013) |

**And no fourth.** In particular `seam.getTeam()` is not called — it exists to supply
`overloadThreshold`, this screen computes no absence count, and calling it would be the first step
toward a number that is not this screen's, exactly as CAL-05 and CAL-06 each recorded.

`today` is computed in this component from the local clock, once, and passed into the query — the
`currentMonth()` exception in `MonthView.tsx`, cited rather than re-argued.

**One link is added to `src/routes/Home.tsx`**, admin-only, beside the three that are already there
and under the same condition — the fourth admin affordance, the shape ADM-01 section 4.3 asks for.
**One route is added to `src/App.tsx`**, guarded on membership the way `/threshold` is, with the role
decided inside the component.

### 4.4 Fixtures — `src/lib/fixtures.ts` and `supabase/seed.sql`

**Three rows, and the dates are the decision.** Both files carry the same literals; the module's own
head states the rule that changing one changes the other in the same commit.

| Fixture | Member | Type | Dates | Why it exists |
|---|---|---|---|---|
| `FIXTURE_PENDING_PTO_ENTRY` | `FIXTURE_MEMBER` | `pto` | 2030-03-04 → 2030-03-06 | AC-1, AC-2, AC-8's PTO half |
| `FIXTURE_PENDING_WFH_ENTRY` | `FIXTURE_APPROVED_MEMBER` | `wfh` | 2030-03-11 → 2030-03-11 | AC-8's WFH half — the row whose existence Open questions item 1 turns on |
| `FIXTURE_PENDING_PAST_ENTRY` | `FIXTURE_MEMBER` | `pto` | 2026-09-01 → 2026-09-02 | AC-6 and AC-7 |

**The upcoming pair is dated 2030 deliberately, and the reason belongs in the fixture comment.** A
pending entry dated inside the current planning window would cross the default filter's boundary as
the real clock advances, and the end-to-end spec would then fail months later, in the wrong place, for
a reason nobody would connect to a fixture. 2030 is far outside any window this product's screens are
used for, which is the property that makes it stable. It is odd on a calendar and this is a worklist,
not a calendar.

**The past-dated row is dated before this plan was written and is therefore permanently past**, which
is the same property from the other side.

**The end-to-end spec must not assert that a specific upcoming fixture is absent from the past
window in terms of "today"** — it asserts the permanently-past row is filtered and returns. The
clock-dependent half of AC-6 and AC-16 is unit-tested against an explicit `today`, where it is
deterministic.

**No fixture is removed and none changes.** `FIXTURE_OTHER_TEAM_ENTRY` is already `pending` and is
already on the other team, so **AC-13 needs no new row** — the fixtures have carried its case since
CAL-03.

Both files are `userContent` in `ui-language.json`: the three `note` values are Vietnamese, like every
other fixture note, and `tests/ui-language.test.ts` requires it.

### 4.5 Selectors

`data-testid`, per `.ai/standards/testing-standards.md`. All new; nothing existing is renamed.

| Selector | What it is |
|---|---|
| `pending-entries-loading`, `pending-entries-refused`, `pending-entries-unavailable` | the three non-list phases (AC-10, AC-12) |
| `pending-entries` | the list |
| `pending-entries-empty` | AC-11 |
| `pending-entries-count` | AC-3. Carries `data-total` — the exact figure — and `data-shown`, the rows on screen. Two attributes because a test asserting they *may* differ needs both |
| `pending-entries-window` | AC-6, AC-7. Carries `data-window` |
| `pending-entries-type` | AC-8. Carries `data-type`, empty for both |
| `pending-entries-page`, `pending-entries-prev`, `pending-entries-next` | AC-4. `data-page`, `data-page-size` |
| `pending-entry-row` | one per entry. `data-entry-id`, `data-member-id`, `data-type`, `data-portion`, `data-start-date`, `data-end-date`, `data-tentative` |
| `pending-entry-row-member` | AC-2, the display name |
| `pending-entry-row-link` | AC-14, to `/entries/:id/edit` |
| `home-pending-entries-link` | the admin-only link on Home |

**No selector on this screen names an approval.** That is not an omission: AC-9 is asserted by the
absence of any control, and a placeholder selector reserved for ADM-05 would be a control that exists
in the test before it exists in the product.

## 5. Seam impact

**One function added — `listPendingEntries(query)` — implemented in both `supabase.ts` and `mock.ts`
with the same name and arity, or `tests/seam-parity.test.ts` fails.** That test reads the exported key
set dynamically, so it needs no edit and is not in `allowed_paths`.

**No existing seam function changes signature or behaviour.** `listTeamEntries()` is explicitly not
touched: its own comment forbids growing a parameter, and section 4.2 records why a second read is
the right answer rather than a fifth argument on an existing one.

**Parity is necessary and not sufficient here, more than usual, and the plan says where.** Two
properties this ticket depends on are invisible to a test comparing names and arity: the row order
(*Open questions* item 5) and `total` never being `rows.length`. Both are stated in section 4.2 as
contract rather than as implementation notes, and the mock's copy of each is asserted in
`tests/pending-entries.test.ts`.

## 6. Schema delta

`none`.

No migration, no table, no column, no constraint, no policy, no grant, no trigger. ADR-014 has nothing
to bite on because nothing is applied. `features.md:103` calls this *"one of the few genuinely `none`
rows under ADR-014"*: it reads through `entry_select_team`, which CAL-01 shipped, and
`member_select_team`, which TEA-03 shipped, and it writes nothing anywhere.

`requires_adr: false`, and no ADR is written. Nothing here decides anything ADR-005 and ADR-016 have
not already decided — and ADM-05, not this ticket, is the row that consumes ADR-016.

**`supabase/seed.sql` is edited and is not a migration.** It carries the three fixture rows of section
4.4, and applying it is human under RULE-09 and ADR-024.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/data/index.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/domain/types.ts"
  - "src/lib/fixtures.ts"
  - "src/routes/PendingEntries.tsx"
  - "src/routes/Home.tsx"
  - "src/App.tsx"
  - "supabase/seed.sql"
  - "tests/pending-entries.test.ts"
  - "tests/e2e/adm-04-worklist.spec.ts"
```

Eleven globs, eleven files; three are new — the screen, its unit test and the end-to-end spec.

**`size`: M, agreeing with `size_estimate` in section 1** — but only just, and saying so is the point
of this paragraph. Eleven of M's ceiling of twelve. ADR-012 is not engaged and nothing splits, and the
honest reading is that the estimate in section 1 was made before the seam function was designed and
happened to land in the right band: three surfaces of the seam plus a fixture pair is four files this
ticket cannot avoid, and they are what fill the band. **A twelfth file would be the signal to split by
surface** — the read and the screen — and there is no twelfth.

**The one collision worth naming: `src/lib/data/mock.ts` and `src/lib/data/supabase.ts` are two of
OPS-002's five remaining `copyDebt` files.** OPS-002 is `BACKLOG`, so nothing is in flight and there
is no conflict today. This ticket **does not add to `copyDebt`** — the list only ever shrinks — and
every sentence it writes into those two files is already English, so OPS-002's job there does not
grow. CAL-06 and CAL-08 each avoided both files; this ticket cannot, because a new seam function has
to be implemented twice.

**Deliberately absent, each with its reason:**

- **`src/routes/TeamEntries.tsx`** — CAL-03's screen keeps its flat list and its edit and delete
  controls, unchanged. This ticket adds a second screen rather than a mode on that one, which section
  8 records as a rejected alternative.
- **`src/routes/EditEntry.tsx`** — AC-14 links to it and changes nothing in it. Also OPS-002's.
- **`src/components/EntryForm.tsx`, `src/routes/NewEntry.tsx`** — untouched, and OPS-002's.
- **`tests/seam-parity.test.ts`** — passes unedited; it reads the key set dynamically (section 5).
- **`tests/e2e/cal-03-admin-edit-entry.spec.ts`** — **the safety net for the Home link and the new
  route, and it must pass unedited.** If the fourth admin link or the new route breaks a selector on
  the neighbouring admin screen, that suite is what reports it. The role CAL-06 and CAL-08 each gave
  to their predecessors' specs.
- **`tests/e2e/cal-01-create-entry.spec.ts`, `cal-02-edit-delete-entry.spec.ts`,
  `cal-04-month-view.spec.ts`** — the three fixture rows are new and belong to members those suites
  already use, so all three must pass unedited. **If any of them fails, the fixture dates collided
  under INV-01** and the fix is the fixture, not the suite.
- **`tests/ui-language.test.ts`, `ui-language.json`** — nothing translated, nothing de-listed.
  `PendingEntries.tsx` is new, so § Language covers it from its first line and it must never be added
  to `copyDebt`.
- **`src/lib/data/absence.ts`** — this screen counts no absences. Not imported.
- **`src/lib/data/day-status.ts`** — CAL-08's. A worklist is not a calendar and draws no day status.
- **Every migration, and `supabase/db.sql`** — `schema_delta: none` (section 6).
- **`.ai/standards/rbac-and-security.md`** — four rows consumed, none amended. Human plane, RULE-01.
- **`.ai/registry/features.md`** — registry plane; the `Status` column is `/ship`'s. The two
  `TODO(project):` markers stay where they are: this plan states assumptions against them and does not
  close them.

## 8. Rejected alternatives

**1. Two seam calls — `countPendingEntries(query)` and `listPendingEntries(query)`.** The obvious
shape, and the one a developer reaches for because the badge and the list feel like two questions. It
is rejected by the feature row directly — *"the badge and the list must not be able to disagree"* —
and the mechanism matters more than the rule: a write landing between the two calls makes the count
and the page describe different sets, and the screen then displays a discrepancy it cannot detect. One
response carrying both **cannot** disagree, and the client already supports it
(`.select(cols, { count: "exact" })` with `.range()`, verified on disk at section 4.2). The cost is a
compound return type instead of two simple ones, which is the right trade for a screen whose entire
value is that the number is true.

**2. Adding a status filter to `/entries/team` instead of a second screen.** Genuinely plausible and
it was `product`'s argument at triage in a different form: `TeamEntries.tsx` already lists the team's
entries with the status on every row, so *"the worklist"* could be that list with a filter and a
count. Rejected on two grounds. First, `listTeamEntries()` is deliberately flat and its own comment
forbids a parameter — filtering above the seam would mean fetching every entry the team has ever
created in order to display the twelve that are pending, which is the truncation hazard the feature
row spends a paragraph on, made worse. Second, that screen carries edit and delete controls, and
ADM-05 puts approve and reject on **this** one; merging them would put four write controls on one row
and make *"the worklist carries no approve control"* a claim about a screen that carries three other
kinds.

**3. Filtering `end_date >= current_date` in the datastore instead of passing `today`.** Shorter,
needs no parameter, and cannot be got wrong by a caller. Rejected because it is wrong by seven hours
for the only team this product has: PostgreSQL evaluates `current_date` in the datastore's timezone,
which is UTC, so between 00:00 and 07:00 ICT the boundary sits on yesterday. The product's entire date
vocabulary is timezone-free `yyyy-MM-dd` strings for exactly this reason — `Entry.startDate`,
`Holiday.date` and `absence.ts` all say so — and a server-side clock would be the one place that rule
is broken. It also makes AC-6 untestable without a real datastore and a controlled clock.

**4. Keeping a ceiling assertion — `PENDING_LIMIT`, refuse above it — instead of paging.** The shape
every other read on this seam uses, and consistency is a real argument. Rejected because the feature
row rules it out in words: *"the list must page rather than truncate"*. A ceiling turns a long queue
into an error, and a queue long enough to trip it is precisely the queue an admin most needs to work
through — the failure would arrive on the worst day and would tell them to fix nothing they can fix.
Paging against an exact count also produces the stronger guard: section 4.2's short-page assertion
detects a lowered `max-rows` **without knowing its value**, which is the unknown the ceiling
constants have been carrying a `TODO(verify)` for since CAL-04.

**5. Ordering by `created_at` — a first-in-first-out queue.** The conventional worklist order, and it
has fairness on its side: the entry that has waited longest is decided first. Rejected because it
optimises for the wrong scarcity. Nothing in this product expires or escalates, and the cost of a late
decision is not the waiting — it is that the date arrives undecided, which is what the star exists to
prevent. Ordering by `start_date` puts the entries running out of time at the top; `created_at` is
kept as the first tiebreaker, so within one date the fair order is still the one that applies.

## Changelog

- `2026-09-05T17:25:45+07:00` — sections 1–8 written. First version. Raised by `tech-lead-design`.
