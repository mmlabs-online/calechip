---
ticket: CAL-07
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-05T00:56:58+07:00
inputs_read:
  - .ai/board/tickets/CAL-07/ticket.yaml
  - .ai/board/ideas/2026-08-31-a-crowded-day-is-discovered-too-late.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/00-charter.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/registry/decisions/ADR-013-removed-members-count-until-removal.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/01-operating-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260904100000_cal04_team_select.sql
  - src/lib/data/absence.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/components/EntryForm.tsx
  - src/routes/NewEntry.tsx
  - src/routes/EditEntry.tsx
  - src/routes/MonthView.tsx
  - tests/e2e/cal-03-admin-edit-entry.spec.ts
  - tests/e2e/seam.setup.ts
  - tests/absence.test.ts
  - ui-language.json
  - eslint.config.js
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CAL-07 — Overload warning shown while choosing dates, before the entry is saved

## 1. Problem and scope

**Feature ID: CAL-07.** Transcribed from `.ai/registry/features.md` without paraphrase:

> | CAL-07 | Overload warning shown while choosing dates, before the entry is saved | CAL | PLANNED | INV-04, INV-05, INV-07 |

A member choosing dates learns, before saving, that the day they are choosing would be crowded — and
who is already away on it. The product can already colour a crowded day in the month grid (CAL-04),
but that is the wrong moment: by the time somebody looks at the grid the choice has usually been
made. The charter's first goal is that a crowded day is seen *while it is being created*, and this is
the only row in the product that acts at that instant. It is also the row that makes charter refusal
6 testable rather than aspirational: the warning is loud, it is detailed, and it never once stands
between a person and a save.

**This row builds no arithmetic and no read.** CAL-04 shipped all three mechanisms it consumes —
`absenceCountsFor` and `isOverloaded` in `src/lib/data/absence.ts`, `getTeam()` for the threshold, and
`currentMemberCount` for the denominator. What CAL-07 adds is the one thing none of them can do: the
**prospective** term, the count a day will have *if the entry now in the form is saved*.

**Out of scope.**

- **Preventing, blocking, queueing, delaying or requiring justification for a save.** Charter refusal
  6. AC-9 to AC-14 are that refusal written as criteria; there is no other place in this plan where
  the feature could go wrong in a way that matters more.
- **Any RLS policy, CHECK constraint or `BEFORE INSERT/UPDATE` trigger that consults the threshold.**
  `schema_delta: none` and no file under `supabase/` is in `allowed_paths`. CAL-01 already ships a
  trigger (`entry_enforce_decision`) and an exclusion constraint (`entry_no_overlapping_portion`), so
  this is an assertion about their *content*, not about their absence — AC-14.
- **Any change to the data-access seam.** Not merely unnecessary: `.ai/01-operating-model.md:375`
  makes a change to the signature of an existing seam function **XL, which escalates**. Section 4.4
  records the one place that rule bit, and section 8 carries the alternative it rejected.
- **Marking an already-overloaded day in any grid.** CAL-04's, shipped.
- **Re-warning after the fact.** If a day becomes crowded because somebody *else* saves later,
  nothing tells the person who saved first. That is the notification mechanism the charter excludes,
  stated in this direction because *"the warning should stay accurate"* reads like a bug fix rather
  than like scope.
- **Excluding weekends and holidays from the warning.** A Saturday on which four people declared PTO
  is arithmetically crowded and operationally meaningless, but deciding that means reading `holiday`,
  which is ADM-02's table and does not exist. Cross-referenced deliberately and **not marked**: a
  `TODO(project):` here would be this row adopting a question it does not own.
- **Suggesting an alternative date.** A warning that proposes a less crowded day is a booking tool,
  charter refusal 5.
- **Showing the threshold's value, its history, or who set it, inside the warning.** Members may read
  the threshold, so this is one line away; a warning that becomes a settings display is ADM-01's
  surface leaking into this one. The warning states the count and the team size, which are the two
  numbers a person can act on, and not the configured share.
- **A second surface.** The warning has no screen and no route of its own. It lives inside the entry
  form and nowhere else.

`size_estimate`: **S**. Taken from the registry row's own instruction — *"This row builds no
arithmetic and no read … It should be sized at SPEC in that knowledge"* — and from the Out-of-scope
list above, which removes every part of this idea that would have made it larger.

## 2. Acceptance criteria

Throughout: a **crowded** day is one where `count / currentMembers > threshold`, strictly greater
(INV-04). The fixture team has four members who have not been removed and a threshold of `0.5`, so a
day is crowded at a count above `2.0`.

### The warning itself

**AC-1 — a draft that would crowd a day raises the warning before anything is saved**
- Given a member on the entry form, and a date on which the team's absence count is already `2.0`
  out of four current members
- When they choose that date as both the start and the end of a full-day entry, and do not save
- Then the form shows a warning naming that date, and the datastore holds no new entry.

**AC-2 — the warning reports the count the day WILL have, not the count it has**
- Given the same date, whose count before the draft is `2.0`
- When the draft above is on screen
- Then the warning reports the count as `3` of `4` people — the prospective figure that includes the
  unsaved draft — and not `2`.

**AC-3 — a draft that leaves the day at or below the threshold raises no warning**
- Given a date whose count before the draft is `1.0` out of four current members
- When a full-day draft covering it is on screen, taking the prospective count to exactly `2.0` of
  `4`, which is exactly the threshold and not above it
- Then no warning is shown for that date.

**AC-4 — a half-day draft weighs half a day**
- Given a date whose count before the draft is `2.0` out of four
- When the draft covering it is changed from a full day to a morning (`am`)
- Then the prospective count is reported as `2.5` and the day is still crowded; and when the draft is
  changed back to a full day the count returns to `3`.

**AC-5 — the portion applies to every date in a multi-day range**
- Given a three-day draft marked as a morning (`am`)
- When the warning is computed
- Then each of the three dates carries `0.5` from this draft — not `0.5` spread across the range.

**AC-6 — only the crowded days of a range are named**
- Given a draft spanning five days of which two would be crowded
- When the warning is shown
- Then it names exactly those two dates, in ascending order, and does not name the other three.

**AC-7 — the warning names the people who are away, including the person drafting**
- Given a draft that crowds a date on which two other members already have entries
- When the warning is shown for that date
- Then it names all three people — the two existing and the person whose draft it is — and each
  named person shows the same avatar the month grid draws for them.

**AC-8 — a tentative draft counts toward its own warning**
- Given a draft that would crowd a date
- When *tentative* is ticked on that draft
- Then the warning is unchanged: the date is still named and the prospective count is the same
  number. INV-05.

### Charter refusal 6, as criteria

**AC-9 — the save control is enabled while a warning is showing, and its label does not change**
- Given a draft with both dates set, raising a warning
- When the warning is on screen
- Then the save control is enabled, and its label is the same string it carries when no warning is
  showing. There is no *Save anyway*.

**AC-10 — saving over a warning is one action and it succeeds**
- Given a draft raising a warning
- When the save control is pressed once
- Then the entry is stored, no confirmation dialog, second press, interstitial, reason field or
  extra step is required at any point, and the form behaves exactly as it does for an uncrowded day.

**AC-11 — the warning is not the form's error channel**
- Given a draft raising a warning and a second draft that the datastore refuses
- When each is on screen
- Then the warning and the refusal are two different regions of the form: the warning does not appear
  in the error region, sets no field invalid, and adds no required field.

**AC-12 — an unresolved count never delays a save**
- Given a draft whose warning has not finished computing
- When the save control is pressed
- Then the save proceeds immediately and is not deferred until the count arrives.

**AC-13 — the write is identical with and without a warning**
- Given two drafts identical in every field except their dates, one crowding a day and one not
- When each is saved
- Then the stored entries differ only in their dates: the crowded one carries no extra field, no
  different status, and nothing recording that a warning was shown.

**AC-14 — nothing in the datastore consults the threshold**
- Given the migrations this product ships
- When they are read
- Then no row-level-security policy, no `CHECK` constraint and no `BEFORE INSERT` or `BEFORE UPDATE`
  trigger refers to `overload_threshold`, and this ticket adds no migration.

**AC-15 — the permission table gains no row**
- Given `.ai/standards/rbac-and-security.md`
- When it is compared before and after this ticket
- Then it is unchanged: saving onto a crowded day is the same permission as saving anything.

### The edit path, and the two ways it can be wrong

**AC-16 — the warning fires on an edit that moves an entry onto a crowded day**
- Given an existing entry on an uncrowded date, and a date that the entry would crowd
- When the entry is opened for editing and its dates are changed to that date, and nothing is saved
- Then the warning is shown for that date.

**AC-17 — an edit does not count the entry twice**
- Given an entry already saved on a date, opened for editing
- When its dates are left exactly as they are
- Then the prospective count for that date is the count the day already has, and not one higher: the
  row being edited is replaced by the draft, never added to it.

**AC-18 — an admin editing another member's entry sees that member counted, not themselves**
- Given an admin, with no entry of their own on the date, editing another member's entry onto a date
- When the warning is shown
- Then the person it names for that draft is the entry's owner and not the admin.

### The failures that are silent

**AC-19 — a response for a range the person has already left never reaches the screen**
- Given a person changing the dates repeatedly, so that several counts are in flight
- When the answers arrive in an order other than the one they were asked in
- Then the warning on screen always describes the dates currently in the form, and never a range that
  has been replaced.

**AC-20 — an incomplete or inverted range shows no warning and asks the datastore nothing**
- Given a form with only one date filled, or with an end date before its start date
- When the form is on screen
- Then no warning is shown and no count is requested.

**AC-21 — a failed or truncated read shows no warning and never a wrong one**
- Given a read that fails or that the seam refuses as possibly truncated
- When the form is on screen
- Then no warning is shown, nothing on the form suggests the day is safe, and the save control is
  unaffected.

**Invariants touched: `INV-04, INV-05, INV-07`.**

- **INV-04** — the absence count. This row consumes the single definition in
  `src/lib/data/absence.ts` and adds no second one. The specific risk it carries is a `+1` computed in
  the component: the prospective count must come from handing an entry-shaped draft to
  `absenceCountsFor`, because a number added in the interface is a second implementation of INV-04
  and INV-06 is why it would be wrong — a five-day `am` draft adds `0.5` to each of five days, not
  `0.5` once. AC-2, AC-4 and AC-5 are that risk written as criteria.
- **INV-05** — a tentative entry counts exactly as a non-tentative one does. The failure mode
  specific to this row is a warning that discounts a tentative draft, which would defeat the reason
  tentative exists. AC-8.
- **INV-07** — every entry is counted only against its member's team. The draft is attributed to the
  member whose entry it is, which is the caller on the create path and the entry's owner on the edit
  path; a draft attributed to nobody would silently vanish from the count. AC-18.

**INV-06 is relied on and not chosen here**, which is why it is not listed: passing the draft as an
entry-shaped value leaves the portion arithmetic inside CAL-04's function, and this row makes no
decision about it. The registry row states the same thing and reaches the same list.

**Open questions.** None blocking.

1. **Closed, and recorded because the registry row still carries it as open.** The ADM-01
   `TODO(project):` about a removed member's entries in INV-04's numerator was answered:
   `.ai/registry/invariants.md` now reads *"whose member was still on the team on that date"*, and
   ADR-013 is the decision behind it. `src/lib/data/absence.ts` implements it in `countsOn`. The
   marker on this row and on CAL-04 is stale and its removal is a human's edit to `features.md` under
   RULE-01; nothing in this plan depends on it any longer.
2. **Answered by reuse, which is what the registry row asked for.** The row's second
   `TODO(project):` asks whether the named people distinguish a pending entry from an approved one,
   and requires that any answer *"reuse the star and dashed-border vocabulary CAL-04 fixes rather
   than inventing a warning-specific one"*. CAL-04 fixed it and shipped it —
   `src/routes/MonthView.tsx:410-427` draws `★` on an approved entry and a dashed border at reduced
   opacity on a tentative one, carrying `data-status` and `data-tentative`. The warning reuses
   exactly that and adds nothing of its own. The row also notes `ui-design-system.md` was a stub;
   its *Colour*, *Type* and *Components* sections are **still `TODO(project):` stubs today**, which is
   why the vocabulary is taken from the shipped component rather than from the standard.
3. **Assumption that ships — the draft is treated as `pending` on every path.** On the create path
   this is exact. On the edit path it is exact for a `pending` or `approved` entry, and inexact in
   one case: editing a `rejected` entry *without* touching its dates, type, portion or tentative
   flag, where `entry_enforce_decision()` leaves the row rejected and the warning would count it. The
   alternative is to reproduce that trigger's substantive-edit test in the component, which is a
   second implementation of INV-02 in TypeScript — the failure INV-04's single-definition rule exists
   to prevent, one invariant over. The case is narrow: a note-only edit changes no date, so the
   warning it raises is about a day the person is not choosing.
4. **Not blocking, and not this row's to answer.** A range long enough to crowd many days produces a
   long list, and nothing caps it. No criterion above limits the length, because a cap would hide
   exactly the days the charter says must be reported *in detail*.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

Checked before writing: `.ai/board/tickets/CAL-07/design/` does not exist, no image is attached
anywhere under `.ai/board/`, and the idea this row was promoted from
(`.ai/board/ideas/2026-08-31-a-crowded-day-is-discovered-too-late.md`) carries none.

The arrangement in section 4.3 is therefore originated here, and it is deliberately not novel: the
colour and the per-person markers are lifted from the month grid CAL-04 shipped, so a person who has
seen a crowded cell recognises a crowded day in the form. What is genuinely a choice here — the
warning sits between the last field and the save control, one block per crowded date, and nothing is
rendered at all while the count is unresolved — is the Tech Lead's, and section 4.3 says why for
each.

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. **No row is added, changed or removed** — AC-15. Three
existing permissions are read, all of them already served by policies that shipped:

| Permission | member | admin | Where it is enforced |
|---|---|---|---|
| `Read any entry in the team` | ✅ | ✅ | `entry_select_team` — CAL-01 |
| `Read the member list` | ✅ | ✅ | `member_select_team` — TEA-03 |
| `Read the overload threshold` | ✅ | ✅ | `team_select_own` and its grant — CAL-04 |

**The denials, stated as denials.**

- **Nothing on this row may refuse a write, and no mechanism capable of refusing one is touched.**
  Under ADR-005 exactly three things can refuse a write: a policy's `with check`, a `CHECK`
  constraint — which cannot subquery other rows, so it narrows to two — and a
  `BEFORE INSERT/UPDATE` trigger. CAL-01 ships both of the two that remain. The assertion is
  therefore about their content and not their absence, which is what AC-14 tests and what makes
  `data-model.md`'s sentence *"a comparison performed on read, not a flag"* checkable.
- A member reads no entry, member or team outside their own team. All three policies above are
  team-scoped through `public.member_team_id`, and this row adds no read of its own that could
  widen them.
- The warning reveals nothing a person cannot already see. It names members and their entries, which
  `entry_select_team` and `member_select_team` already admit to both roles and which the month, week
  and year views already display.

**Where the check runs.** Nowhere, and that is the point of the row. Every control in this feature is
an affordance in the strictest sense: the warning changes what a person knows and nothing about what
the datastore will accept. The write path is byte-for-byte the one CAL-01 and CAL-02 shipped — AC-13.

## 4. Contract

### 4.1 The pure part — `src/lib/draft-entry.ts` (new)

```ts
// src/lib/draft-entry.ts — new. Pure, fetches nothing, imports only types.

import type { Entry, EntryPortion, EntryType } from "@/lib/domain/types";

/** The fields of the form that can change what a day costs, plus the two that decide how the
 *  draft is DRAWN. It is deliberately not `EntryFormValues`: `note` cannot change a count. */
export interface DraftEntryInput {
  memberId: string;
  type: EntryType;
  portion: EntryPortion;
  startDate: string; // yyyy-MM-dd
  endDate: string; // yyyy-MM-dd, inclusive
  tentative: boolean;
}

/** The id the unsaved draft carries. A constant, and it is exported so a test and a component can
 *  both recognise the draft row without matching on a string literal in two places. It is not a
 *  uuid: nothing may ever write it, and a value that cannot be mistaken for a real id is the
 *  cheapest way to say so. */
export const DRAFT_ENTRY_ID = "draft";

/**
 * The rows to hand to `absenceCountsFor`, `absentEntriesFor` and `isOverloaded`: the team's saved
 * entries with the row being edited REMOVED and the draft appended.
 *
 * `excludeEntryId` is the whole of AC-17. On the edit path the fetched rows contain the entry the
 * form is editing, and appending the draft beside it counts that member twice. On the create path
 * it is null and nothing is removed.
 *
 * The draft is `status: "pending"` on every path — 01-plan.md Open question 3 records the one case
 * where that is inexact and why reproducing `entry_enforce_decision()` here would be worse.
 *
 * `tentative` is carried through and NOT consulted here: `walk` in absence.ts never reads it
 * (INV-05, AC-8), and it is present so the warning can draw the draft with the same dashed border
 * the month grid uses.
 */
export function withDraft(
  entries: readonly Entry[],
  draft: DraftEntryInput,
  excludeEntryId: string | null,
): Entry[];

/** True when the range is usable: both dates present and `end` not before `start`. AC-20. The one
 *  place the emptiness test lives, so the component and the test agree by construction. */
export function isUsableRange(startDate: string, endDate: string): boolean;
```

`withDraft` returns an `Entry` and therefore fills every field of it. The values that are not the
draft's own are fixed and stated here so that no reader has to guess: `id` is `DRAFT_ENTRY_ID`,
`status` is `"pending"`, and `rejectionReason`, `note`, `approvedBy` and `approvedAt` are `null`.
`createdAt` and `updatedAt` are the empty string — nothing in `absence.ts` reads either, and a
fabricated timestamp would be a value a component could render.

**No change to `src/lib/domain/types.ts`.** `DraftEntryInput` is declared in the new module, because
a shared type module is one of the three things `.ai/01-operating-model.md:375` makes **XL**.

### 4.2 The component — `src/components/OverloadWarning.tsx` (new)

```tsx
// src/components/OverloadWarning.tsx — new.

export interface OverloadWarningProps {
  /** The draft's owner. NULL means "the caller", which the component resolves with
   *  `seam.getCurrentMember()`. The edit route passes the entry's `memberId` instead, so an admin
   *  editing somebody else's entry counts that member and not themselves (AC-18). */
  ownerId: string | null;
  /** The saved row this draft replaces, or null when the draft is new. AC-17. */
  excludeEntryId: string | null;
  type: EntryType;
  portion: EntryPortion;
  startDate: string;
  endDate: string;
  tentative: boolean;
  /** The form's selector family — `new-entry`, `edit-entry` or `month-entry`. Every selector this
   *  component renders is this prefix plus a suffix, exactly as EntryForm's own are. */
  testIdPrefix: string;
}

export default function OverloadWarning(props: OverloadWarningProps): JSX.Element | null;
```

**What it reads, and when.** Three seam calls, all of them CAL-04's and none of them new:

| Call | When | Why not more often |
|---|---|---|
| `seam.getCurrentMember()` | once, on mount, and only when `ownerId` is null | the caller does not change while a form is open |
| `seam.getTeam()` | once, on mount | AC-2's denominator and the threshold; neither is range-dependent |
| `seam.listMembers()` | once, on mount | the roster, INCLUDING removed members — `absenceCountsFor` needs `removedAt` per member to decide each date (ADR-013) |
| `seam.listTeamEntriesOverlapping(range)` | on every usable range, debounced | the only range-dependent read |

**The debounce and the stale-answer guard (AC-19).** The entries read is issued 300 ms after the
range stops changing, and every answer is stamped with a monotonically increasing request number
recorded when it was issued. An answer whose number is not the latest is discarded without touching
state. That is what makes AC-19 observable: the warning on screen always describes the dates in the
form.

**Recomputing is not refetching.** The rows are held; the count is derived from them synchronously on
every draft change. So changing `portion` or `tentative` updates the warning with no request at all
(AC-4, AC-8) and only a change of `startDate` or `endDate` reaches the datastore.

**The composition, in order, and every step is CAL-04's:**

```ts
const rows = withDraft(fetched, draft, excludeEntryId);       // this ticket's only new step
const counts = absenceCountsFor(rows, range, roster);          // CAL-04
const details = absentEntriesFor(rows, range, roster);         // CAL-04
const active = currentMemberCount(roster);                     // CAL-04
const crowded = eachDateInRange(range)
  .filter((d) => isOverloaded(counts.get(d) ?? 0, active, team.overloadThreshold)); // CAL-04
```

**It renders `null` unless `crowded` is non-empty.** Nothing is drawn while the reads are in flight,
on a failed read, on a truncation refusal, or on an unusable range — AC-20, AC-21, and the structural
half of AC-12: a component that renders nothing cannot delay a submit.

### 4.3 The layout, and where it sits in the form

The warning is a block **between the last field and the save control**, inside the `<form>`. It is
above the button because a person reads down to the button, and below the fields because it is a
consequence of them. It is *not* above the fields, where it would push the form down and move the
control under the pointer as the dates change.

One block per crowded date, ascending. Each block carries:

| Element | `data-testid` | Attributes | Content |
|---|---|---|---|
| the region | `<prefix>-overload` | — | `role="status"`, `aria-live="polite"` |
| one crowded date | `<prefix>-overload-day` | `data-date`, `data-count`, `data-current-members` | the date, and *N of M people away* |
| one person on that date | `<prefix>-overload-person` | `data-member-id`, `data-status`, `data-tentative`, `data-draft` | the member's avatar and display name |

- **`role="status"`, never `role="alert"`.** AC-11: `alert` is the form's error channel and
  `<prefix>-error` already holds it. A warning announced as an error is the soft block the charter
  refuses, delivered by an ARIA attribute.
- **Colour is `bg-rose-100`**, the exact class `src/routes/MonthView.tsx:381` gives a crowded cell —
  the soft pink `CLAUDE.md` § *Visual direction* calls *deliberately not an alarming red*. The
  form's error stays `text-rose-600`, so the two remain visibly different things.
- **Each person is drawn with the month grid's vocabulary**, taken from
  `src/routes/MonthView.tsx:410-427`: PTO peach and WFH mint, a dashed border at reduced opacity when
  the entry is tentative, and `★` when it is approved. Open question 2 records that this is reuse
  and not a warning-specific treatment.
- **The draft itself is one of the people named**, carrying `data-draft="true"`. AC-7 — the count
  includes them, so the list must too, or the numbers and the names disagree.
- **No count, no spinner and no placeholder while the reads are in flight.** A spinner beside a save
  button reads as *wait*, which is the thing AC-12 forbids.

### 4.4 The change to `src/components/EntryForm.tsx`

Two optional props, and one element added to the JSX:

```ts
export interface EntryFormProps {
  // ... unchanged ...
  /** CAL-07. The draft's owner, or null for the caller. Optional: `NewEntry.tsx` and
   *  `MonthView.tsx` pass nothing and get the caller, which is correct on both. */
  ownerId?: string | null;
  /** CAL-07. The saved row this form is editing, so it is not counted beside the draft (AC-17).
   *  Optional for the same reason. */
  excludeEntryId?: string | null;
}
```

`<OverloadWarning …>` is rendered between the note field and the error paragraph, fed from the
state EntryForm already holds. **Nothing else in that file changes**: the submit button keeps its
`disabled={!complete || submitting}`, its label and its position, which is AC-9 and AC-10 held by
construction rather than by a test.

**This is the one place in the form all three surfaces meet.** `EntryForm` is rendered by
`NewEntry.tsx` (`new-entry`), `EditEntry.tsx` (`edit-entry`) and `MonthView.tsx`'s drag-to-declare
panel (`month-entry`). Putting the warning here is why two of those three files are not in
`allowed_paths` at all.

**The seam is not touched, and that is a rule rather than a preference.** The idea file asks for the
in-flight request to be *aborted*; a true transport-level abort needs an `AbortSignal` parameter on
`listTeamEntriesOverlapping`, which is a change to the signature of an existing seam function and
therefore **XL — escalate** (`.ai/01-operating-model.md:375`). The observable requirement is that a
stale answer never paints, and the request-number guard in section 4.2 delivers exactly that. Section
8 carries this as a rejected alternative rather than leaving it as an omission.

### 4.5 The change to `src/routes/EditEntry.tsx`

Two props on the existing `<EntryForm>`: `ownerId={entry.memberId}` and `excludeEntryId={entry.id}`.
Nothing else. The screen already holds both values in `state.entry`.

## 5. Seam impact

**None.** No function is added, removed or changed, and `tests/seam-parity.test.ts` is untouched and
must pass unedited.

`src/lib/draft-entry.ts` is a new pure module and **not** part of the seam. It is in `src/lib/`
rather than in `src/lib/data/` deliberately: `absence.ts` sits inside the seam directory only because
`.ai/registry/features.md:91` puts it there by name, and nothing puts this there. It imports types
and nothing else, so RULE-02's boundary — which `eslint.config.js` enforces as a ban on
`@supabase/*` outside `src/lib/data/` — is not in play.

**Every count in this feature comes from `src/lib/data/absence.ts` and that file is not in
`allowed_paths`.** If the warning needed a line added to it, this ticket would be building a second
arithmetic, which is what INV-04 and the CAL-04 registry row exist to prevent. It does not: `walk`
already ignores `tentative` (INV-05), already excludes `rejected`, already applies ADR-013's
membership clause per date, and already clamps an entry to the requested range. An unsaved draft is
just another row to it, which is the property `absence.ts` was built pure to have.

## 6. Schema delta

**`none`.** No migration, no policy, no trigger, no constraint, no column, no grant. `supabase/` is
absent from `allowed_paths` entirely.

`requires_adr`: **false**. ADR-014 is not engaged, because there is no migration for it to be engaged
by.

**AC-14 is the criterion that keeps this true**, and it is worth saying why it is a criterion rather
than an assumption. Every other invariant in this product is held in the database; a developer
following the house pattern would put this one there too, where it would be a real refusal and a
breach of charter refusal 6. The mechanisms are already present — `entry_enforce_decision()` and
`entry_no_overlapping_portion`, both from CAL-01 — so the assertion is about their content. Reading
the shipped migrations for the string `overload_threshold` is the whole test.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/draft-entry.ts"
  - "src/components/OverloadWarning.tsx"
  - "src/components/EntryForm.tsx"
  - "src/routes/EditEntry.tsx"
  - "tests/draft-entry.test.ts"
  - "tests/e2e/cal-07-overload-warning.spec.ts"
```

Six globs, six files, four of them new. `size`: **S**.

**`size_estimate` and `size` agree at S**, so ADR-012 is not engaged and nothing splits. Both were
reached the same way and the registry row is why: it states in terms that this row adds no read, no
policy, no column and no arithmetic, and instructs that it be sized in that knowledge. The list would
have been ten paths under the design section 8 rejects — the one that changes the seam's signature —
and that design is XL rather than M, so the count was never the thing deciding it.

**`src/routes/NewEntry.tsx` and `src/routes/MonthView.tsx` are deliberately absent**, and this is the
most load-bearing absence in the list. Both render `EntryForm`, both want the warning, and both get
it without an edit because `ownerId` and `excludeEntryId` are optional and their correct values on
those two surfaces are the defaults. A design that passed the owner down explicitly would put this
ticket's props into two more of CAL-01's and CAL-04's shipped files for no behaviour.

**Also deliberately absent, each for a reason:**

- `src/lib/data/absence.ts` — CAL-04's, and INV-04's single home. Section 5.
- `src/lib/data/index.ts`, `supabase.ts`, `mock.ts` — no seam change; a signature change is XL
  (section 4.4).
- `src/lib/domain/types.ts` — a shared type module, also XL. `DraftEntryInput` lives in the new
  module.
- `tests/seam-parity.test.ts` and `tests/absence.test.ts` — both must pass unedited. The second is
  the more interesting: if a change here made an `absence.ts` test fail, INV-04 would have moved.
- `supabase/**` — `schema_delta: none`, and AC-14 asserts it.
- `.ai/registry/**` — nothing here writes the registry. The two stale `TODO(project):` markers this
  plan identifies on the CAL-07 row are a human's to remove under RULE-01; Open questions 1 and 2
  state what is now true so the edit is a deletion rather than a judgement.

**`tests/draft-entry.test.ts`** covers what is pure and what a browser cannot reach cheaply: the
exclusion of the edited row (AC-17), the draft's weight across a multi-day range (AC-5), the
half-day weight (AC-4), the tentative draft still counting (AC-8), and the attribution of the draft
to an owner who is not the caller (AC-18). It composes `withDraft` with `absenceCountsFor` from
`absence.ts` rather than asserting the array shape, because the array is a means and the count is the
criterion. **`tests/e2e/cal-07-overload-warning.spec.ts`** covers the rest, and the fixture team
makes the strict-comparison boundary reachable: four current members at a threshold of `0.5`, so a
prospective `2.0` raises nothing (AC-3) and `2.5` and `3.0` do (AC-1, AC-4).

## 8. Rejected alternatives

**Rejected: add an `AbortSignal` to `listTeamEntriesOverlapping` so the in-flight read is genuinely
cancelled.** This is what the idea file asks for in terms — *"the in-flight request aborted on each
change"* — and it is one optional parameter, one `.abortSignal(signal)` on the PostgREST builder and
one ignored argument in the mock. It was rejected on a rule rather than on taste:
`.ai/01-operating-model.md:375` makes a change to the signature of an existing seam function **XL**,
which escalates to the operator, and the following paragraph says the test is *whether existing
callers must change*, which for an added parameter they need not — but the table's own wording is
`changes the signature`, and reading the exception generously to avoid an escalation is how a
sizing rule stops meaning anything. The requirement underneath the ask is that a stale answer never
paints, which the request-number guard delivers; what is genuinely lost is a cancelled HTTP request,
which costs bandwidth on a read the person has already left. That is a real cost and it is the
reason this is recorded here rather than dropped: a later ticket that needs cancellation anywhere
else should carry the seam change and the escalation together.

**Rejected: compute the prospective count in the component as `current + weight(portion)`.** It needs
no new module, no draft row and no exclusion logic, and on the create path it is right. It was
rejected because it is a second implementation of INV-04 living in the interface, and INV-06 is why
it is wrong rather than merely duplicated: a five-day `am` draft adds `0.5` to each of five days and
this expression adds it once. It is also silently wrong on the edit path, where the entry being
edited is already in `current` and adding to it double-counts the same person — AC-17. The registry
row names this failure specifically, and it is the reason `absenceCountsFor` was built pure and
taking rows in the first place.

**Rejected: put the warning in each of the three routes rather than in `EntryForm`.** Each route
already fetches; `MonthView` in particular holds the entries, the roster and the team, so its copy
would need no reads at all and would be guaranteed consistent with the grid beside it. Rejected
because it is the warning written three times, and the three would agree until one changed —
precisely the argument CAL-02 used when it extracted `EntryForm` out of `NewEntry` rather than
copying it. The redundant fetch inside `MonthView`'s panel is the price, and it is a read the person
already has permission for.

**Rejected: show the warning only once both dates are set and the person stops typing for a second.**
It would halve the requests. Rejected because *stops typing* is not a state a date input reliably
produces — the native picker fills both fields in one interaction — and a warning that needs a pause
would be absent exactly on the fastest path to a save, which is the moment the feature exists for.
The 300 ms debounce in section 4.2 is the smaller version of the same idea and keeps AC-1 true.

## Changelog

- `2026-09-05T00:56:58+07:00` — sections 1 through 8 and § 2b written. Gate PASS. Raised by
  `tech-lead-design`.
- `2026-09-05T00:56:58+07:00` — **Open question 1 closed against the registry rather than carried.**
  The CAL-07 feature row still carries a `TODO(project):` saying INV-04's numerator amendment is
  unrecorded and that *"until it is recorded this warning can interrupt someone over a day that is
  not overloaded"*. `.ai/registry/invariants.md` now carries the amended clause and
  `src/lib/data/absence.ts` implements it, so the marker is stale. No AC was written against the
  gap. Raised by `tech-lead-design`.
- `2026-09-05T00:56:58+07:00` — **Open question 2 answered by reuse.** The row's second
  `TODO(project):` waited on `ui-design-system.md`, which is still a stub in the three sections that
  would have decided it. It is answered instead by the constraint the row attached to it: reuse
  CAL-04's vocabulary. CAL-04 shipped `★` and the dashed border, so the answer exists in the tree
  even though it does not exist in the standard. Raised by `tech-lead-design`.
- `2026-09-05T00:56:58+07:00` — **the design was changed by the sizing table, and the record is here
  rather than only in section 8.** The first shape of this plan added an `AbortSignal` to
  `listTeamEntriesOverlapping`, which put three seam files in `allowed_paths` and made the ticket
  ten paths. `.ai/01-operating-model.md:375` makes a signature change to an existing seam function
  XL regardless of file count, so that shape escalates rather than ships. AC-19 was written to state
  the observable requirement — a stale answer never paints — rather than the mechanism, which is
  what let the smaller design satisfy it. Raised by `tech-lead-design`.
