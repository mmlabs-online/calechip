---
ticket: CAL-04
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-04T09:40:00+07:00
inputs_read:
  - .ai/board/tickets/CAL-04/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/registry/decisions/ADR-013-removed-members-count-until-removal.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/standards/architecture.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/ui-design-system.md
  - supabase/db.sql
  - src/
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CAL-04 — Month view: a day grid showing who is away and which days are overloaded

## 1. Problem and scope

**Feature ID: CAL-04.** Title transcribed from `.ai/registry/features.md:91` without paraphrase:
*Month view — a day grid showing who is away and which days are overloaded.*

The registry row is long and is the source for everything in section 2. The decisions it already
fixes, and which this plan transcribes rather than re-decides: brief 7.1's default view is a day grid
carrying the avatar of each absent member in the cell and an overloaded day made visually distinct;
**this row builds the single absence-count function** that `architecture.md` and `data-model.md` both
name as INV-04's mechanism, and with it the `team.overload_threshold` read and the current-member-count
read; the function is **range-shaped, not date-shaped**, returning a per-date series rather than a
scalar; it is **pure and takes rows** — `absenceCountsFor(entries, range, roster)`; the overload
comparison is `count / currentMembers > threshold`, **strictly greater**; and the time anchor lives in
the URL so that brief 7.1's *switching views keeps the date* is a mechanism rather than a preference.

**Every member of the team gains the ability to see, in one screen, who is away on each day of a month
and which of those days are crowded.** That matters because it is the product's whole premise: the
charter says a crowded day should be seen *while it is being created* rather than the night before,
and until this row ships there is no screen on which a crowded day is visible at all. Eight features
have shipped and every one of them is a list or a form; this is the first that renders the domain.

**Out of scope.**

- **Holiday and bridge-day shading.** Goes to **CAL-08**. The registry row is explicit that this row
  must not inherit it.
- **The live warning while choosing dates.** Goes to **CAL-07**, which *consumes* the function,
  the threshold read and the roster read built here rather than rebuilding them.
- **Week and year views.** **CAL-05** and **CAL-06**. This row builds the range-shaped function they
  both call, and that is the whole of its obligation to them.
- **Setting the threshold.** Goes to **ADM-01**, which owns the update privilege on `public.team` and
  nothing else. This row owns the select half — see section 6.
- **Approving or rejecting from a cell.** **ADM-04** and **ADM-05**.
- **Creating or editing an entry.** Drag-select is in scope and hands a date range to CAL-01's
  existing form; **no save path, no write policy, and no change to `EntryForm`** beyond receiving
  pre-filled dates.
- **Any change to how an entry is stored.** This row reads.

`size_estimate: M`. Section 7's count agrees; the one line ADR-012 asks for is there.

## 2. Acceptance criteria

**AC-1 — the grid renders the month in the URL**
- **Given** a signed-in member on a team
- **When** they open `/month/2026-04`
- **Then** the screen shows a day grid for April 2026, every date of that month present exactly once,
  and the leading and trailing cells needed to complete the first and last weeks are rendered as
  out-of-month and carry no avatars and no overload state.

**AC-2 — an absent member's avatar appears in their day's cell**
- **Given** a member of the team has an entry covering 2026-04-14
- **When** a member of the same team opens `/month/2026-04`
- **Then** that member's `avatar` appears in the cell for 14 April, and appears in the cell for every
  other date the entry's range covers.

**AC-3 — the absence count is 1 per full day and 0.5 per half day, PTO and WFH alike**
- **Given** on 2026-04-14 one member has an entry with `portion: full` and another has `portion: am`
- **When** the grid is rendered
- **Then** the cell for 14 April carries an absence count of `1.5`, and the count is unchanged by
  whether either entry's `type` is `pto` or `wfh`.

**AC-4 — a rejected entry is excluded from the count and from the grid**
- **Given** a member has an entry covering 2026-04-14 with `status: rejected`
- **When** the grid is rendered
- **Then** that entry contributes `0` to the cell's count **and** that member's avatar is not drawn in
  the cell — INV-04's *"a view shows a member's avatar exactly when that member's entry is counted"*.

**AC-5 — a tentative entry counts and is drawn, and is visually distinguishable**
- **Given** a member has an entry covering 2026-04-14 with `tentative: true` and `status: pending`
- **When** the grid is rendered
- **Then** it contributes to the count on the same terms as any other entry (INV-05), its avatar is
  drawn, and the avatar is rendered with the dashed border at reduced opacity that
  `CLAUDE.md` § *Visual direction* gives tentative entries — so that *counts* and *is settled* stay
  visually separate. **Cited to `CLAUDE.md` and not to `.ai/standards/ui-design-system.md`, which
  does not contain it** — see the note at the end of § 2b.

**AC-6 — a removed member counts until the day they were removed**
- **Given** a member with `removed_at` set to 2026-04-15T00:00:00Z holds an entry covering
  2026-04-10 to 2026-04-20
- **When** the grid is rendered
- **Then** their avatar and their contribution appear on 10–14 April and do **not** appear on 15–20
  April — ADR-013, and INV-04's *"`removed_at` null, or `removed_at` strictly after that date"*.

**AC-7 — a day is overloaded when the count strictly exceeds the threshold times the current roster**
- **Given** a team of 6 members with `removed_at is null` and `overload_threshold` of `0.5`
- **When** a date's absence count is `3.0`
- **Then** that date is **not** overloaded; **and when** the count is `3.5` that date **is** overloaded
  and is rendered in the soft pink that `CLAUDE.md` § *Visual direction* reserves for an overloaded
  day and describes as *deliberately not an alarming red*. The comparison is
  `count / currentMembers > threshold`, strictly greater — six at `0.5` with `3.0` is not overloaded.

**AC-8 — the roster denominator is the current member count, not the historical one**
- **Given** a past date whose count was computed against a 6-member team, and a 7th member then joins
- **When** the grid for that past month is rendered again
- **Then** the same date is evaluated against `7`, and may therefore change between overloaded and
  normal. INV-04 records this consequence as accepted.

**AC-9 — an empty month renders as empty, not as an error**
- **Given** a month in which no member of the team has any entry
- **When** the member opens it
- **Then** the grid renders every date with a zero count, no avatars and no overload state; no error
  is shown and no loading state remains on screen. **The empty state's appearance is not asserted
  here** because no standard specifies one — see the note at the end of § 2b.

**AC-10 — moving between months preserves the anchor in the URL**
- **Given** a member viewing `/month/2026-04`
- **When** they move to the next month
- **Then** the URL becomes `/month/2026-05` and the grid re-renders for May; and entering
  `/month/2026-05` directly produces the same screen — the anchor is the URL, not component state.

**AC-11 — an incomplete read is refused rather than rendered**
- **Given** the datastore returns fewer entry rows than exist for the requested range because a
  server-side row cap truncated the result
- **When** the grid would be rendered
- **Then** the screen shows a failure state and **no count is displayed**. A capped read sums what it
  was given and produces a believable wrong answer with no error anywhere; a wrong count on this
  screen is worse than no screen, because the whole product is the count.

**AC-12 — a member sees only their own team**
- **Given** entries exist belonging to members of another team
- **When** the grid is rendered
- **Then** none of them appear, and no avatar from another team is drawn. This is held by
  `entry_select_team` and `member_select_team` under ADR-005, not by a filter in the interface.

**AC-13 — drag-select opens the existing entry form with the dates pre-filled**
- **Given** a member drags across 2026-04-06 to 2026-04-08 in the grid
- **When** they release
- **Then** CAL-01's entry form opens with `start_date` 2026-04-06 and `end_date` 2026-04-08 already
  set, and nothing has been written. The grid has no save path.

**AC-14 — the threshold is readable by a member, and settable by nobody here**
- **Given** a signed-in member who is not an admin
- **When** the grid is rendered
- **Then** the overload state is computed and shown, which requires `overload_threshold` to have been
  read successfully — `rbac-and-security.md:47` grants *Read the overload threshold* to both roles —
  **and** no control anywhere on this screen changes it, for either role.

**Invariants touched.**

- **INV-04** — this row builds the one definition of the absence count. Every clause of the invariant
  is an AC above: the formula (AC-3), the exclusion of rejected (AC-4), the removed-member rule
  (AC-6), the avatar-follows-the-count rule (AC-4), and the current-roster denominator (AC-8).
- **INV-05** — AC-5. Tentative counts, and this is the first screen where it is observable.
- **INV-07** — AC-12. The grid is scoped to one team, and that scoping is a policy rather than a
  filter.

**Open questions.**

1. **TODO(verify): the datastore's default server-side row cap.** AC-11 depends on knowing it. No
   project is provisioned and `tech-stack.md` lists Supabase as past reliable recall. **This does not
   block:** AC-11 is written so that the implementation must assert completeness or page explicitly
   *whatever* the cap is, which is correct under any value. What the number changes is only whether
   paging is reached in practice on a real month.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

Checked before writing: `.ai/board/tickets/CAL-04/design/` does not exist, and the idea file this
feature cites — `.ai/board/ideas/2026-08-31-the-team-cannot-see-its-own-shape.md` — carries no image.

**So the arrangement below is invented here and is cheap to argue with.** A seven-column grid, weeks
as rows, Monday first. Each cell carries the date numeral top-left, the absence count top-right, and
the avatars filling the body; overload is the cell's background, not a badge, because the crowded day
must be findable by scanning rather than by reading. `CLAUDE.md` § *Visual direction* says the grid
is the most-used screen and that information density wins there every time, so this layout spends its
space on cells rather than on chrome.

What the prose above deliberately does not decide, and which the implementation may settle: the
overflow treatment when a cell holds more avatars than fit. It is not an AC because no source
specifies it, and inventing an AC is what section 1 forbids.

**A defect found while writing this section, and it is why three ACs above cite `CLAUDE.md` instead.**
`.ai/standards/ui-design-system.md` is the file this command names as governing § 2b, and its
§ *Direction*, § *Colour*, § *Type*, § *Components* and § *Accessibility* are all still
`TODO(project)` — unwritten. **So the standard specifies no colour, no type scale, no empty state and
no component shapes.** The only place in the repository that carries the pastel palette, the peach /
mint / lavender assignment, the soft pink for an overloaded day and the dashed-reduced-opacity
treatment for a tentative entry is `CLAUDE.md` § *Visual direction*, which is a process document.

Two consequences, both stated rather than worked around:

1. **AC-5, AC-7 and AC-9 cite `CLAUDE.md`.** That is the honest citation, and a plan citing a
   `TODO(project)` heading as though it specified something would be the invention this loop forbids.
2. **`CLAUDE.md:73` is wrong today.** It says the *Vui/Gọn density toggle* details live in
   `.ai/standards/ui-design-system.md`; that file contains neither the toggle nor the word. **This
   plan therefore designs no density toggle** — it is named in a process document, specified nowhere,
   and originating one here would be inventing a control rather than a layout. It belongs to whoever
   writes § *Components*. Recorded so it is not mistaken for an omission.

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. **This ticket adds no new capability to either role.**
It makes two already-granted reads reachable for the first time.

| Action | `member` | `admin` | Where the check lives |
|---|---|---|---|
| Read any entry in the team | ✅ | ✅ | `entry_select_team` (`rbac-and-security.md:31`), shipped by CAL-01 |
| Read the member list of own team | ✅ | ✅ | `member_select_team`, shipped by TEA-03 |
| **Read the overload threshold** | ✅ | ✅ | **`team_select_own` — new, section 6.** `rbac-and-security.md:47` grants it to both roles and no policy has ever made it reachable |
| Set the overload threshold | ❌ | ❌ *here* | **ADM-01.** `rbac-and-security.md:48` grants it to `admin`; this ticket grants no update privilege to anyone, so on this branch neither role can change it |

**The denials, stated as denials.**

- **Neither role may write anything from this screen.** No insert, update or delete grant is added.
  Drag-select (AC-13) hands dates to CAL-01's form and that form's own policies decide the write.
- **Neither role may read another team's entries or members** (AC-12). Held by `entry_select_team`
  and `member_select_team`, both of which resolve the caller's team through
  `public.member_team_id((select auth.uid()))`. There is no team parameter anywhere in section 4, so
  the interface cannot ask for another team's data even incorrectly.
- **An admin gains nothing on this screen that a member does not have.** Every row above is ✅✅ or
  ❌❌. This is the first screen in the product where the two roles are identical, and it is worth
  stating because a reviewer scanning for a missing `is_admin` check should find that absence
  deliberate: `Read any entry in the team` is checked for both roles, and CAL-03 already established
  that what an admin may *do* with a row lives in the update policy, not in the read.

**Where the check lives: the datastore, always.** Under ADR-005 the browser holds the user's own
token and talks to PostgREST directly, so nothing in section 4 is a control. Any filtering the view
performs is an affordance and must be commented as one — `architecture.md:93`.

## 4. Contract

RULE-04: every field name that will appear in the code appears here first. Domain types are camelCase
and dates are `yyyy-MM-dd` strings, never `Date` — the convention `Entry` already sets
(`src/lib/domain/types.ts:171-172`).

```ts
// ---------------------------------------------------------------------------
// src/lib/domain/types.ts — additions
// ---------------------------------------------------------------------------

/** The caller's own team. One row in v1; `data-model.md` § team. */
export interface Team {
  id: string;
  name: string;
  /** The Threshold. A SHARE, not a count. Compared with `>`, never `>=` — INV-04, AC-7. */
  overloadThreshold: number;
  createdAt: string; // ISO 8601
}

/** Both ends INCLUSIVE, matching `Entry.endDate` and ADR-011's `'[]'` constructor. */
export interface DateRange {
  start: string; // yyyy-MM-dd
  end: string; // yyyy-MM-dd
}

/**
 * Same shape and same reasoning as TEAM_ENTRY_LIMIT: it must sit BELOW the datastore's own
 * server-side row cap so a truncated read is detectable here rather than invisible. A month of one
 * team cannot approach it; the number exists so AC-11 has something to assert against.
 */
export const MONTH_ENTRY_LIMIT = 2000;

/** The absence count for each date in a range. Keys are `yyyy-MM-dd`; every date in the range is
 *  present, including those with a count of 0. */
export type AbsenceCounts = ReadonlyMap<string, number>;

// ---------------------------------------------------------------------------
// src/lib/data/index.ts — two additions to `DataSeam`
// ---------------------------------------------------------------------------

/**
 * CAL-04 AC-7, AC-14. The caller's own team row, or null when the caller has no member row.
 *
 * NO PARAMETER. The team is resolved by `team_select_own` from `auth.uid()`; a `teamId` argument
 * would be a value the caller SUPPLIES, which is the shape `addAllowedEmail` deliberately refused.
 *
 * `null` rather than a throw for the member-less caller, matching `getCurrentMember` — it is the
 * NotOnATeam state, which is a normal answer and already has a screen.
 */
getTeam(): Promise<Team | null>;

/**
 * CAL-04 AC-1..AC-6, AC-12. Every entry of the caller's team whose date range OVERLAPS `range`.
 *
 * THIS IS THE RANGE-SHAPED READ `listTeamEntries` refuses to become. The boundary is recorded at
 * `src/lib/data/index.ts:357-363`: `listTeamEntries` stays flat and answers "which entries exist for
 * this team", and the moment it grows a range parameter there are two team-entry reads and one of
 * them is the one nobody updated. This is the second read, declared separately on purpose.
 *
 * Overlap, not containment: an entry running 2026-03-28 to 2026-04-02 MUST be returned for April,
 * because AC-2 draws its avatar on 1 and 2 April. The real implementation filters on the generated
 * `date_range` column ADR-011 created for exactly this (`date_range=ov.[start,end]`); the mock
 * compares `startDate <= range.end && endDate >= range.start`, which is the same predicate.
 *
 * RETURNS REJECTED ROWS TOO. Filtering `status` here would put a second copy of INV-04's rule
 * outside `absenceCountsFor`, which is what INV-04 exists to prevent. The one implementation of the
 * rule excludes them (AC-4).
 *
 * THROWS on a transport failure and on a possibly-truncated answer, the shape `listTeamEntries`,
 * `listOwnEntries` and `listMembers` all use. AC-11 is that throw: a capped read sums what it was
 * given and produces a believable wrong answer, and on this screen the count IS the product.
 */
listTeamEntriesOverlapping(range: DateRange): Promise<Entry[]>;

// ---------------------------------------------------------------------------
// src/lib/data/absence.ts — NEW. INV-04's single implementation.
// ---------------------------------------------------------------------------

/**
 * THE one definition of the absence count (INV-04). Pure, takes rows, fetches nothing.
 *
 * @param entries  every entry overlapping `range`, rejected ones included — this function excludes
 *                 them, and it is the only thing that may.
 * @param range    inclusive at both ends.
 * @param roster   the team's members, INCLUDING removed ones: ADR-013 needs `removedAt` per member
 *                 to decide each date, so a pre-filtered roster cannot answer AC-6.
 *
 * Rules, each one an AC: 1 for `full` and 0.5 for `am` or `pm` (AC-3); `type` is never consulted, so
 * PTO and WFH weigh the same (AC-3); `status: "rejected"` contributes nothing (AC-4); `tentative` is
 * never consulted, so a tentative entry counts (AC-5); an entry counts on a date only when its
 * member has `removedAt` null or `removedAt` strictly after that date (AC-6).
 */
export function absenceCountsFor(
  entries: readonly Entry[],
  range: DateRange,
  roster: readonly Member[],
): AbsenceCounts;

/**
 * The set of members whose avatar is drawn on each date. Derived from the SAME pass as the counts,
 * not from a second filter — INV-04 says a view shows a member's avatar exactly when that member's
 * entry is counted, and two passes are two chances to disagree (AC-2, AC-4, AC-6).
 */
export function absentMembersFor(
  entries: readonly Entry[],
  range: DateRange,
  roster: readonly Member[],
): ReadonlyMap<string, readonly Member[]>;

/**
 * AC-7, AC-8. `count / currentMembers > threshold`, STRICTLY greater.
 * `currentMembers` is the roster with `removedAt === null` counted at read time — the CURRENT count,
 * not the membership as it stood on `date`. INV-04 records that consequence as accepted.
 * Returns false when `currentMembers` is 0 rather than dividing.
 */
export function isOverloaded(
  count: number,
  currentMembers: number,
  threshold: number,
): boolean;
```

**The route** is `/month/:yyyy-MM`, added to `src/App.tsx` beside the existing routes. `/month` with
no anchor redirects to the current month. AC-10's *the anchor is the URL, not component state* is
this and nothing else.

## 5. Seam impact

**Two functions added to `DataSeam`, implemented in both `supabase.ts` and `mock.ts` with the same
name and arity** or `tests/seam-parity.test.ts` fails: `getTeam()` and
`listTeamEntriesOverlapping(range)`. No existing seam function changes signature or behaviour.
`listTeamEntries()` is explicitly **not** touched — section 4 records why.

**`absenceCountsFor` is not a seam method, and that is the decision this section exists to make.**
The registry row requires it to be *"a pure function in one shared module inside `src/lib/data/`,
imported by both seam implementations and reimplemented in neither"*, and also that it *"is pure and
takes rows, with every fetch outside it"*. Those two pull in opposite directions, and the resolution
that satisfies both is to put it in `src/lib/data/absence.ts` and have **neither** seam implementation
compute a count at all. The registry's fear is two arithmetics that the seam-parity test cannot see —
same names, same arity, different maths. With zero copies in the seam there is nothing for the parity
test to miss: the month view imports `absence.ts` directly and the seam only ever returns rows.

The cost, stated: `src/lib/data/` now holds a module that is not part of the seam interface. That is
where the registry row puts it, and moving it to `src/lib/domain/` would be a defensible alternative —
section 8.

## 6. Schema delta

**Not `none`.** One policy and one grant on `public.team`, in a new migration
`supabase/migrations/20260904100000_cal04_team_select.sql`:

```sql
grant select on public.team to authenticated;

create policy team_select_own on public.team
  for select to authenticated
  using (id = public.member_team_id((select auth.uid())));
```

**ADRs linked, not authored** — the CAL-03 precedent, *discharged at PLAN by linking rather than
authoring*. `requires_adr: true` and the linked decisions are
[ADR-005](../../../registry/decisions/ADR-005-authorization-in-rls.md), which puts this in the
database rather than in the interface, and
[ADR-014](../../../registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md), which
is why a `select`-only policy migration is not `schema_delta: none` — that ADR carves out nothing for
reads. **No new ADR is written and none is needed:** this creates no table, no column and no
constraint, and it decides nothing that ADR-005 has not already decided.

**Three facts about the current state, each verified against `supabase/db.sql` on this branch.**

1. `public.team` has row-level security enabled and `revoke all … from anon, authenticated`
   (`supabase/db.sql:613`), and **no policy and no grant of any kind**. The table is closed, not open.
   So `overload_threshold` is unreadable today and AC-7 is unsatisfiable without this migration.
2. **This ticket owns the select half and only the select half.** `.ai/registry/features.md:91` says
   so on this row, and `:103` says ADM-01 owns *"the matching update privilege on that table and
   nothing else"*. `supabase/db.sql` § 9.1 already names CAL-04 as the owner. Nothing here grants
   `update`, and ADM-01 is unblocked by this migration rather than by a registry change.
3. **`public.member_team_id(uuid)` already exists and is already granted to `authenticated`**
   (TEA-01's migration), so the policy needs no new helper.

**Applying it is human — RULE-09.** `supabase/db.sql` is regenerated after this merges; its § 9.1
block is deleted in the same edit, because it will have stopped being true.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260904100000_cal04_team_select.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/data/absence.ts"
  - "src/lib/fixtures.ts"
  - "src/routes/MonthView.tsx"
  - "src/App.tsx"
  - "tests/seam-parity.test.ts"
  - "tests/absence.test.ts"
  - "tests/e2e/cal-04-month-view.spec.ts"
```

Twelve paths. `size: M`.

**`size_estimate` and `size` agree, and the line ADR-012 asks for is that they agreed at the
boundary rather than comfortably.** Twelve is the split threshold this command names, so this ticket
sits exactly on it. It is not split, and the reason is that eleven of the twelve are one change —
INV-04's single implementation and the two reads that feed it — with `src/App.tsx` a one-line route
registration. Splitting would put `absence.ts` in one ticket and its only caller in another, and the
first would ship with no observable acceptance criterion at all.

`supabase/db.sql` is **not** in this list. It is regenerated after merge, it is not this ticket's to
edit, and `scripts/check-allowed-paths.mjs` would correctly fail the branch if it were touched.

## 8. Rejected alternatives

**1. Compute the counts in the datastore, as a PostgreSQL view or an RPC.**

Genuinely plausible, and it was the shape ADR-015 refused for a different reason. It would put the
arithmetic next to the rows, make the month read a single round trip, and make truncation impossible
because the aggregate is computed server-side — AC-11 would disappear.

Rejected on INV-04 itself. The invariant is the **uniqueness** of the definition, not the formula, and
the number is needed in a place the database cannot reach: CAL-07 must compute the count a day *will*
have if the draft in the form is saved, and an unsaved entry has no row. A datastore-side aggregate
therefore cannot be the only implementation — CAL-07 would need a second one in TypeScript, which is
precisely the two-arithmetics failure INV-04 exists to prevent. The registry row anticipates this and
fixes the shape as `absenceCountsFor(entries, range, roster)` for that reason. **A view is still the
right answer for a product where the count is only ever read from saved rows; this is not that
product**, and CAL-07 is the row that proves it.

**2. Put `absenceCountsFor` in `src/lib/domain/` rather than `src/lib/data/`.**

Arguably cleaner: it is a domain computation, it imports no client, and `src/lib/data/` is described
by `architecture.md:17` as the seam — *"nothing outside it may import the Supabase client"* — which
this module has no business being inside.

Rejected because `.ai/registry/features.md:91` names the location explicitly, and RULE-04 makes the
registry row the source. **This is a disagreement worth recording rather than silently resolving**: if
a reviewer thinks `src/lib/domain/absence.ts` is right, the change costs one `git mv` and one import
line, and the argument belongs on the registry row rather than in this plan.

**3. Fetch the whole team's entries once and slice per month in the interface.**

Rejected on AC-11 and on ADR-013 together. It converts a bounded read into an unbounded one — the
truncation this plan turns into an error becomes certain rather than unlikely — and it caches a roster
whose `removedAt` decides every past count, so a removal during the session would leave the grid
showing a stale count with no indication. The range-shaped read re-reads both on every month change,
which is the behaviour AC-8 already commits to.

## Changelog

- `2026-09-04T09:40:00+07:00` — sections 1, 2 and 2b written before the source tree was read for 3–9,
  per the template's ordering note. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
- `2026-09-04T09:52:00+07:00` — section 2 AC-5, AC-7 and AC-9, and § 2b, **re-cited from
  `.ai/standards/ui-design-system.md` to `CLAUDE.md` § Visual direction**, and the density toggle
  dropped from the design. The first draft cited the standard for the tentative treatment, the
  overload colour and the empty state; that file's § Direction, § Colour, § Type, § Components and
  § Accessibility are all still `TODO(project)` and specify none of them. `CLAUDE.md:73` compounds it
  by pointing at that file for a *Vui/Gọn density toggle* it does not contain. Caught by reading the
  standard rather than recalling it. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
