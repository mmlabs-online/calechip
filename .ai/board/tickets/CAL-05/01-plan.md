---
ticket: CAL-05
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-04T14:29:10+07:00
inputs_read:
  - .ai/board/tickets/CAL-05/ticket.yaml
  - .ai/board/tickets/CAL-04/01-plan.md
  - .ai/board/ideas/2026-08-31-the-team-cannot-see-its-own-shape.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/00-charter.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/registry/decisions/ADR-013-a-removed-member-counts-until-removal.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/standards/architecture.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - src/lib/data/absence.ts
  - src/lib/data/index.ts
  - src/lib/domain/types.ts
  - src/routes/MonthView.tsx
  - src/App.tsx
  - ui-language.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CAL-05 — Week view: per-person detail for one week

## 1. Problem and scope

### The feature row, transcribed

`.ai/registry/features.md:92`, `CAL-05`, group `CAL`, status `PLANNED`, invariants touched
`INV-04, INV-05, INV-07`:

> From 2026-08-31-the-team-cannot-see-its-own-shape.md. Brief 7.1's coordination view: one week, each
> absent person named, half-days distinguished, the note shown, and `approved_by` shown. **Displaying
> who approved is not approving** — no admin action reaches this surface. INV-04 is listed although
> this view may render no number: it presents the same set the count sums, so a week list disagreeing
> with a month cell — four names against 3.5 — is exactly the divergence the invariant forbids. It
> consumes CAL-04's function and never counts names. **Rendering requirement, and the only surface
> where it is visible: a five-day `pm` entry is five afternoons** (INV-06), not a half-day at one end
> — INV-06 is not in the column at left because a read-only view cannot produce a per-day portion, so
> nothing about it is chosen here. The note is readable by the whole team, which follows from `Read
> any entry in the team` being a row-level select policy under ADR-005. URL anchor `/week/:yyyy-MM-dd`.

### What this gives whom

Every **member** gains the view the brief calls the coordination one. The month grid CAL-04 shipped
answers *how crowded is that day*; it draws avatars and a decimal, and it deliberately cannot answer
*who, for how much of the day, and did anyone agree to it*. This view answers that for one week —
each absent person named, their half-day distinguished from a whole one, their note shown, and the
admin who approved them shown by name.

**An admin gains nothing here.** *Displaying who approved is not approving*: this surface carries no
approve, no reject, no edit and no delete, for either role. The permission table already grants an
admin those elsewhere; putting any of them on a read-only view would be this ticket inventing a
permission surface, and section 3 states it as a denial rather than as an omission.

**`size_estimate`: M.** Eight files, two of them new, no migration, no seam function and no new read.
Not `S`: the view has fourteen criteria, a new derivation inside INV-04's module, and its own unit
tests. Not `L`: everything it reads and every number it would need already exists, and the whole
ticket sits above the seam.

### § 2b — the visual reference

**None was attached, at either stage, and the layout in section 4 is my own.**

Checked rather than assumed: `.ai/board/tickets/CAL-05/design/` does not exist, the ticket folder
holds only `ticket.yaml`, `find .ai/board -type f` matches no image of any extension, and the idea
file this row cites — `2026-08-31-the-team-cannot-see-its-own-shape.md` — carries no image reference
and no `Evidence` attachment.

**The layout is the Tech Lead's own and was never specified.** That line is the obligation
`.ai/standards/ui-design-system.md` § *Visual specification* attaches to the grant, and it is here so
that every later reader — the reviewer, and the operator at merge — can argue with the arrangement
cheaply instead of mistaking it for a requirement. What is **not** invented: the feature ID, the
behaviour, the permissions, the invariants and every field name, all of which come from the registry
row above, `.ai/standards/data-model.md` and the modules CAL-04 shipped.

### Out of scope

- **Approving, rejecting, editing or deleting anything.** ADM-04, ADM-05, CAL-02 and CAL-03. The row
  is explicit: *no admin action reaches this surface*. This view issues no write of any kind and
  calls no seam function that performs one.
- **Rendering an absence count, an overload state, or the threshold.** The row says *this view may
  render no number* and *never counts names*. The month cell is where the decimal lives; a second
  number here is the second arithmetic INV-04 forbids even when it happens to agree.
- **The month and year views.** CAL-04 is shipped and is consumed unchanged; CAL-06 is the year grid
  and this ticket builds nothing toward it.
- **The overload warning while choosing dates.** CAL-07.
- **Holidays, bridge days and weekend shading.** ADM-02 and CAL-08. The week renders seven equal
  days and must not acquire a notion of a non-working one by accident — CAL-08 draws day status on
  this surface later, and its row already says so.
- **Creating an entry from this screen.** CAL-04's month cell carries the draft panel that hands a
  range to CAL-01's form; the week view does not, because a per-person list has no cell to drag and
  adding a second create path is a second thing to keep in step with `entry_insert_own`.
- **Any change to `absenceCountsFor`, `absentMembersFor`, `isOverloaded` or `currentMemberCount`.**
  All four ship unchanged. This ticket adds a third derivation beside them and edits none of them.
- **Any seam function, any policy, any migration.** Section 5 and section 6.
- **`src/components/EntryForm.tsx`, `src/lib/data/mock.ts`, `src/lib/data/supabase.ts`,
  `src/routes/EditEntry.tsx`, `src/routes/NewEntry.tsx`** — OPS-002's five remaining `copyDebt` files.
  None is touched, so the two tickets cannot collide.

## 2. Acceptance criteria

Observable through the interface. The selector attribute is `data-testid`.

**AC-1 — the week is seven days, Monday to Sunday, anchored by the URL**
- **Given** a signed-in member
- **When** they open `/week/2026-10-07`, a Wednesday
- **Then** exactly seven day sections render in order from Monday 2026-10-05 to Sunday 2026-10-11,
  each labelled with its own date

**AC-2 — each absent person is named on each day they are away**
- **Given** a team member with a PTO entry covering Tuesday to Thursday of the displayed week
- **When** the week renders
- **Then** that member appears by display name and avatar under Tuesday, Wednesday and Thursday, and
  under no other day

**AC-3 — half-days are distinguished from whole days**
- **Given** one member with a `full` entry and another with an `am` entry, both on the same day
- **When** that day renders
- **Then** each row states its own portion, and the two are visibly different values rather than both
  reading as absent

**AC-4 — a five-day `pm` entry is five afternoons (INV-06)**
- **Given** a member with one `pm` entry running Monday to Friday of the displayed week
- **When** the week renders
- **Then** that member appears on all five days, and **every one of the five rows reads as an
  afternoon** — not a whole day in the middle and not a half-day at one end only

**AC-5 — an entry that starts before or ends after the week is shown only on its days inside it**
- **Given** a member with an entry running from the Saturday before the displayed week to its Tuesday
- **When** the week renders
- **Then** that member appears under Monday and Tuesday and under no other day of the week

**AC-6 — the note is shown when there is one**
- **Given** two entries on the same day, one carrying a note and one carrying none
- **When** that day renders
- **Then** the note text appears on the first row and the second row renders without a note rather
  than with an empty one

**AC-7 — an approved entry names who approved it**
- **Given** an `approved` entry whose `approvedBy` is an admin of the team
- **When** the week renders
- **Then** that admin's display name is shown on the row, and a `pending` entry on the same day shows
  no approver

**AC-8 — displaying who approved is not approving**
- **Given** a signed-in admin on the week view
- **When** the screen renders
- **Then** it offers no control that approves, rejects, edits or deletes any entry — the admin sees
  exactly what a member sees

**AC-9 — a tentative entry is listed and is marked as tentative (INV-05)**
- **Given** a `tentative` entry on a day of the displayed week
- **When** that day renders
- **Then** the member is listed exactly as a non-tentative absence is, and the row is additionally
  marked tentative

**AC-10 — a rejected entry is not listed**
- **Given** an entry with `status` `rejected` covering a day of the displayed week
- **When** that day renders
- **Then** its member does not appear for that entry — the view lists exactly what the count sums

**AC-11 — a removed member's entries stop on the day they were removed**
- **Given** a member removed partway through the displayed week, holding an entry that spans the
  removal
- **When** the week renders
- **Then** they appear on the days before their removal date and on no day from it onward

**AC-12 — the week and the month agree about who is away (INV-04)**
- **Given** any date visible in both views
- **When** the week view's list for that date and the month view's avatars for that date are compared
- **Then** they name the same set of members

**AC-13 — a day with nobody away says so, and all seven days always render**
- **Given** a week in which nobody is away on Sunday
- **When** the week renders
- **Then** the Sunday section is present and carries an explicit empty state rather than being
  omitted or collapsed

**AC-14 — moving between weeks, and switching to the month, keeps the date**
- **Given** a member on `/week/2026-10-07`
- **When** they move to the previous week, then the next, then follow the link to the month view
- **Then** the previous week is the seven days ending 2026-10-04, the next is the seven beginning
  2026-10-12, and the month view opens on the month containing the week they left

**AC-15 — a possibly-truncated read is refused rather than under-reported**
- **Given** a read of the week's entries that comes back at the row limit
- **When** the screen resolves
- **Then** it shows a failure state and lists nobody, rather than a short list that reads as a quiet
  week

### Invariants touched

`[INV-04, INV-05, INV-07]` — exactly the three the feature row lists. This plan adds none and removes
none.

- **INV-04** — the row explains why it is listed on a view that may render no number: *it presents
  the same set the count sums*. Held by consuming CAL-04's module rather than filtering entries
  here. Section 4.1 adds a third derivation **from the same single pass** that already produces the
  counts and the avatars, so a week list and a month cell cannot disagree without both being wrong
  together. AC-10, AC-11 and AC-12 are the observations; **AC-12 is the one that matters**, because
  the failure the row names — four names against 3.5 — is invisible on either screen alone.
- **INV-05** — held by that same pass, which never reads `tentative`. AC-9 asserts a tentative entry
  is listed on the same terms as any other; the marking is visual and changes nothing about
  membership of the list.
- **INV-07** — held by `entry_select_team` and `member_select_team`, both already shipped. Every row
  this view draws comes from a team-scoped read, and the approver's name is resolved against the same
  team roster, so no name from another team can reach the screen. Nothing is added: the mechanism is
  that this ticket introduces no read of its own.

**INV-06 is relied on and not chosen here, which is why it is absent from the list.** The row states
this directly, and the same reasoning appears on CAL-07's row: a read-only view cannot produce a
per-day portion, so nothing about the invariant is decided by this ticket. **AC-4 is nevertheless
this ticket's, and the row calls this the only surface where INV-06 is visible** — the invariant is
held by the column shape CAL-01 shipped, and what is checked here is that the rendering does not
contradict it.

**INV-01, INV-02 and INV-03 are absent and unreachable.** Nothing on this surface writes, so no
overlap can be created, no approval can be revoked and no rejection reason can be set or cleared.
AC-8 is what keeps that true.

### Open questions

1. **Whether a `rejected` entry is *drawn* is unstated anywhere, and AC-10 answers it for this
   surface only by following the count.** `.ai/registry/features.md:91` carries this as a
   `TODO(project)` on CAL-04 and says CAL-05 and CAL-06 inherit the answer. INV-04 settles only that
   a rejected entry is excluded from the *count*, which is a different decision from whether it is
   *shown*. **AC-10 is written the way CAL-04 shipped** — the view lists exactly what the count sums
   — because a week list showing a rejected entry the month cell does not draw is the divergence
   INV-04's own note forbids. **Not blocking.** If the operator later decides a rejected entry should
   be visible somewhere, it is one criterion on all three views and a display decision, not a change
   to the count.

2. **`.ai/standards/ui-design-system.md` § *Direction*, § *Colour* and § *Type* are still
   `TODO(project)` stubs.** `CLAUDE.md` § *Visual direction* is the only stated palette — PTO peach,
   WFH mint, tentative as a dashed border at reduced opacity, approved carrying a small star — and
   section 4.3 follows it. **Not blocking**, and it is the reason § 2b's marking matters: the
   arrangement is mine, and there is no design system to check it against.

3. **The Vui / Gọn density toggle named in `CLAUDE.md` § *Visual direction* is not built and is not
   built here.** It is described as belonging to `.ai/standards/ui-design-system.md`, which does not
   yet specify it. **Not blocking** — no shipped view has it, and adding one on this screen alone
   would set a precedent three other views would have to follow without a standard to follow it
   from.

---

*Sections 1 and 2 above were written before the source tree was read for this ticket. Sections 3 to 8
were written after. Nothing in 1 or 2 was amended.*

---

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. **No permission changes, no policy ships, and no grant
ships.** Every read this view issues is one the caller could already make.

| Action | `member` | `admin` | Where the decision is made |
|---|---|---|---|
| Read any entry in the team | ✅ | ✅ | `entry_select_team`, CAL-01, untouched |
| Read the member list | ✅ | ✅ | `member_select_team`, TEA-03, untouched |
| Read the overload threshold | ✅ | ✅ | `team_select_own`, CAL-04 — **and this view does not read it**, section 4.2 |
| Approve or reject from this screen | ❌ | ❌ | **no control exists.** AC-8 |
| Edit or delete from this screen | ❌ | ❌ | **no control exists.** AC-8 |

**AC-8's denial is held by absence, and that is worth stating plainly because it is the weakest
mechanism in this plan.** There is no policy to point at: an admin who reaches
`seam.updateEntry` from a console still succeeds, because CAL-03 granted them that and correctly so.
What this ticket guarantees is narrower and is exactly what the row asks for — *no admin action
reaches this surface* — and it is held by the view calling no write function and rendering no write
control. **A reviewer checks it by reading the imports of `WeekView.tsx`**, which is why section 4.2
enumerates the three seam calls the file is permitted to make.

**The note is readable by the whole team, and that follows from a policy rather than from this
screen.** `Read any entry in the team` is ✅ for both roles, so `entry_select_team` returns the note
to every member — the row records this, and it is a consequence to be aware of rather than a decision
this ticket takes. A member's note is visible to their colleagues by design.

**The approver's name is resolved from the roster, not from a new read.** `listMembers()` already
returns the team including removed members, so an admin who has since been removed still resolves to
a name rather than to a bare uuid.

## 4. Contract

No entry point, no schema, no field name and no seam signature changes. What section 4 pins is the
one new derivation, the three reads the screen is permitted, and the arrangement § 2b makes mine.

### 4.1 One addition to INV-04's module — `src/lib/data/absence.ts`

The week needs, per date, **each absent person together with the entry that puts them there** —
portion, type, note and approver. `absentMembersFor` returns members and drops the entry;
`absenceCountsFor` returns a number. Neither can answer it.

**The wrong fix is to filter `entries` inside `WeekView.tsx`.** That is a second implementation of
INV-04's membership-and-status walk, it would agree with the count until one of them changed, and it
is precisely the divergence the feature row names. **The right fix is a third derivation from the
same pass**, which is the shape `absentMembersFor` already established:

```ts
/** CAL-05. One absent person on one date, and the entry that puts them there. */
export interface AbsenceDetail {
  entry: Entry;
  member: Member;
}
```

— declared in `src/lib/domain/types.ts` beside `AbsenceCounts`, because it is a domain shape that
components hold and `architecture.md` § *Layers* lets any layer import domain types.

```ts
/**
 * CAL-05. Every absent person on every date in `range`, with their entry, derived from the SAME
 * `walk` that produces `absenceCountsFor` and `absentMembersFor`.
 *
 * This is the third derivation and not a second definition. INV-04's rules — rejected excluded,
 * tentative never consulted, a member counting only while `removedAt` is null or strictly after the
 * date, an entry clamped to the requested range — are applied exactly once, inside `walk`, and all
 * three exported functions read that one pass. A week list that disagreed with a month cell would
 * require `walk` itself to be wrong, which is the only failure mode INV-04 leaves open.
 *
 * ONE MEMBER MAY APPEAR TWICE ON ONE DATE, and that is correct here where it is not in
 * `absentMembersFor`: an `am` entry and a `pm` entry are two facts about the day and this view's
 * whole job is per-person detail. The count for that date is still 1.0 and the month grid still
 * draws one avatar — the same fact told three ways, which is what INV-04 requires.
 *
 * Every date in `range` is present, carrying an empty array where nobody is away — the contract the
 * other two keep, so a caller iterating one map can index the others without a fallback (AC-13).
 */
export function absentEntriesFor(
  entries: readonly Entry[],
  range: DateRange,
  roster: readonly Member[],
): ReadonlyMap<string, readonly AbsenceDetail[]>;
```

**Ordering within a date is fixed here rather than left to the datastore**, because two
implementations returning rows in different orders is the divergence `tests/seam-parity.test.ts`
cannot see: by member `displayName` ascending, then by `portion` in the order `full`, `am`, `pm`,
then by `entry.id` ascending as the tiebreaker. The last is what makes the render deterministic when
a member holds an `am` and a `pm` on one day.

### 4.2 The three seam calls this screen may make, and the one it may not

```ts
seam.getCurrentMember()                     // the membership state — signed out, member-less, member
seam.listMembers()                          // the roster, INCLUDING removed members (ADR-013)
seam.listTeamEntriesOverlapping({ start, end })  // the week, Monday to Sunday inclusive
```

**No fourth call, and no write call at any point.** `getTeam()` is deliberately absent: it exists to
supply `overloadThreshold`, this view renders no overload state, and calling it would be the first
step toward the number the feature row says this screen does not have.

**`MONTH_ENTRY_LIMIT` is reused and no new constant is added.** The limit belongs to
`listTeamEntriesOverlapping`, which is one range-shaped read serving both screens; a week is seven
days against a month's six weeks, so the existing ceiling is safe by a wide margin. A
`WEEK_ENTRY_LIMIT` would be a second number that has to move whenever the first does. **AC-15 is the
throw that read already performs** — this ticket adds no truncation logic, it renders the failure.

### 4.3 The layout — mine, per § 2b

Route `/week/:day`, plus `/week` redirecting to the current week, matching how CAL-04 shipped
`/month` and `/month/:month`. `:day` is any `yyyy-MM-dd`; the view resolves it to the Monday of its
week, so every day of a week produces the same screen and a link from any date works.

**Header**, one row: a link home, previous week, the anchor label, next week, and a link to the month
containing this week.

**Body**, seven sections stacked in reading order, Monday first. Each carries the weekday name, the
date, and either its list of people or its empty state. **All seven always render** (AC-13) — a week
that hid its quiet days would make "nobody is away on Sunday" and "Sunday is missing" the same
screen.

**One row per absent person per day**, in the order fixed in 4.1: avatar, display name, type, portion,
note when present, approver when approved. Following `CLAUDE.md` § *Visual direction*: PTO peach, WFH
mint, a tentative row dashed at reduced opacity, an approved row carrying a small star. No overload
colour appears on this screen at all, because no overload state is computed.

| `data-testid` | What it is |
|---|---|
| `week-anchor` | the week label, carrying `data-week-start` as `yyyy-MM-dd` |
| `week-home`, `week-prev`, `week-next`, `week-month` | the four header links |
| `week-day` | one per day, seven always, carrying `data-date` |
| `week-day-label` | the weekday name and date |
| `week-day-empty` | the empty state inside a day where nobody is away |
| `week-row` | one absent person on one day, carrying `data-member-id` and `data-entry-id` |
| `week-row-name`, `week-row-avatar` | who |
| `week-row-type` | carried as `data-type`, `pto` or `wfh` |
| `week-row-portion` | carried as `data-portion`, `full`, `am` or `pm` — **AC-3 and AC-4** |
| `week-row-note` | present only when the entry carries a note — **AC-6** |
| `week-row-approver` | present only when the entry is approved — **AC-7** |
| `week-row-tentative` | present only when tentative — **AC-9** |
| `week-loading`, `week-not-on-a-team`, `week-unavailable` | the three non-list states, mirroring `month-loading`, `month-not-on-a-team` and `month-unavailable` |

**`data-portion` is the attribute AC-4 turns on.** A five-day `pm` entry produces five `week-row`
elements each carrying `data-portion="pm"`, and asserting the attribute rather than the rendered word
keeps the criterion true when § *Language* fixes the wording.

**Every string on this screen is English.** `src/routes/WeekView.tsx` is a new file, so the § *Language*
lint rule covers it from its first line — it is not in `copyDebt` and must never be added to it.

## 5. Seam impact

**None.** No function is added, removed or changed. `tests/seam-parity.test.ts` is untouched and
unaffected, and is not in `allowed_paths`.

This is worth stating rather than leaving blank, because it is the strongest evidence that CAL-04
drew its boundary correctly. That ticket made a decision this one inherits: **`absenceCountsFor` is
not a seam method, and neither implementation calls it.** The seam returns rows and counts nothing.
So a second view over the same rows needs no new read, no new implementation in `mock.ts`, no new
implementation in `supabase.ts`, and nothing for the parity test to miss — the entire cost of this
feature is one exported function above the seam and one screen.

`src/lib/data/absence.ts` sits inside `src/lib/data/` and imports nothing from `./index` and nothing
from either implementation, so adding to it crosses no boundary and RULE-02's lint rule is untouched.

## 6. Schema delta

**`none`.** No migration, no table, no column, no enum, no policy, no trigger, no constraint and no
grant. ADR-014 does not engage: this ticket ships no `.sql` file of any kind.

Every policy this view depends on already exists and is untouched — `entry_select_team` from CAL-01,
`member_select_team` from TEA-03. `team_select_own` from CAL-04 exists and is deliberately **not**
used (section 4.2).

`ticket.yaml` already carries `schema_delta: none` and `requires_adr: false`, and **both are correct
as they stand.** Neither is changed. CAL-02 and CAL-03 each needed `requires_adr` corrected from
`false`; this one does not, and saying so costs less than a reviewer checking.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/domain/types.ts"
  - "src/lib/data/absence.ts"
  - "src/routes/WeekView.tsx"
  - "src/routes/MonthView.tsx"
  - "src/routes/Home.tsx"
  - "src/App.tsx"
  - "tests/absence.test.ts"
  - "tests/e2e/cal-05-week-view.spec.ts"
```

Eight globs, eight files; two are new — `src/routes/WeekView.tsx` and the spec.

**`size`: M, agreeing with `size_estimate` in section 1.** ADR-012 is not engaged and nothing splits.
Eight is comfortably inside M's ceiling of twelve, and the reason it is this small is CAL-04's
boundary rather than this ticket's restraint: no migration, no seam function, no new read, and one
new exported function.

**`src/routes/MonthView.tsx` and `src/routes/Home.tsx` each take one link and nothing else.** The
month gains a `month-week` link in its header — AC-14's *switching views keeps the date*, which
CAL-04's row calls *"a mechanism, not a preference"* and which could not be built until a second view
existed. **The link goes in the header and not on a cell**: a month cell already carries a click that
opens CAL-04's draft panel, and a second click target there would put this ticket's routing on top of
another ticket's shipped acceptance criteria.

**No collision with OPS-002.** Its five remaining `copyDebt` files are `src/components/EntryForm.tsx`,
`src/lib/data/mock.ts`, `src/lib/data/supabase.ts`, `src/routes/EditEntry.tsx` and
`src/routes/NewEntry.tsx`. None appears above. `src/routes/Home.tsx` was OPS-001's and OPS-001 is
`DONE`, so it is out of `copyDebt`, already English, and free to edit — the file-collision hazard
OPS-001's own §3 raised is spent.

**Deliberately absent, each with its reason:**

- **`ui-language.json`** — nothing is translated and nothing is de-listed. `WeekView.tsx` is new, so
  the § *Language* rule covers it immediately and it must never be added to `copyDebt`; the list only
  ever shrinks.
- **`src/lib/data/index.ts`, `supabase.ts`, `mock.ts`** — no seam change (section 5).
- **`tests/e2e/cal-04-month-view.spec.ts`** — **the safety net for the one-line `MonthView.tsx`
  change, and it must pass unedited.** If the header link breaks a month selector, that suite is what
  reports it.
- **`tests/seam-parity.test.ts`, `tests/ui-language.test.ts`** — both must pass unedited; neither has
  anything to change.
- **Every other shipped e2e suite** — no selector this ticket touches is asserted by them.
- **Every migration** — never edited, and none is added.
- **`.ai/standards/ui-design-system.md`** — § *Visual specification* is followed, never amended.
  RULE-01, human plane. Its three stub sections are *Open questions* item 2.
- **`.ai/registry/features.md`** — the CAL-04 `TODO(project)` about drawing rejected entries is
  answered for this surface in *Open questions* item 1 and the row is **not** edited; registry plane,
  and the `Status` column is `/ship`'s.

## 8. Rejected alternatives

**1. Filtering the week's entries inside `WeekView.tsx` instead of adding `absentEntriesFor`.**
Genuinely the first thing to try, and it looks free: the component already holds `entries`, `roster`
and the range, and *"which entries touch this date, excluding rejected, for members still on the
team"* is four lines. It is rejected because those four lines **are** INV-04's membership and status
rules, written a second time. `.ai/registry/invariants.md` says the invariant is the **uniqueness of
the definition** rather than the formula, and the feature row names the exact symptom — a week list
showing four names beside a month cell reading 3.5. The two would agree on the day they were written
and diverge the first time either changed, and nothing in the toolchain compares them: the lint rule
sees no boundary crossed, the parity test compares only the seam's names and arity, and both screens
look right in isolation. A third export from the same `walk` costs one function and makes the
divergence structurally impossible rather than merely unlikely.

**2. Adding `listWeekEntries(range)` to the seam rather than reusing
`listTeamEntriesOverlapping`.** Plausible on symmetry — CAL-01 added `listOwnEntries`, CAL-03 added
`listTeamEntries`, CAL-04 added `listTeamEntriesOverlapping`, so a fourth read reads like the house
style, and a week-shaped read could carry a tighter row limit than a month's. It is rejected because
the house style is the opposite of what it looks like: each of those three reads was added because it
answers a question the others structurally cannot, and each carries a comment refusing to grow into
the next. A week **is** a range, `listTeamEntriesOverlapping` already takes one, and a second
range-shaped read over the same table would be two reads where one of them is the one nobody updated
— the exact sentence already written on `listTeamEntries`. The tighter limit is not worth a second
constant that has to move whenever the first does.

**3. Rendering the absence count on each day, since the module is already imported.** The most
tempting of the three, and it has a real argument: `absenceCountsFor` is right there, the week is
the coordination view, and a reader comparing "who is away" with "how much of the team that is"
would be helped. It is rejected because the feature row forecloses it — *this view may render no
number* and *it consumes CAL-04's function and never counts names* — and because the reason is
subtler than duplication. The number on the month cell is a **decimal over a whole team**; the same
number beside a list of three names invites the reader to check it against the names, and a
half-day makes 3 names read as 2.5 for reasons the week view does not explain. INV-04 forbids a
second definition; this would not be one, and it would still make two surfaces that appear to
disagree while both being right. If a number is ever wanted here, it is a criterion on the row rather
than an inference from the module being in scope.

## Changelog

- `2026-09-04T14:29:10+07:00` — sections 1 to 8 written, § 2b recording that no image was attached at
  either stage and that the layout is the Tech Lead's own. Sections 1 and 2 written before the source
  tree was read; nothing in either was amended afterwards. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
