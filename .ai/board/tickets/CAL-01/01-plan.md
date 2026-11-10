---
ticket: CAL-01
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-03T10:09:24+07:00
inputs_read:
  - .ai/board/tickets/CAL-01/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/registry/decisions/ADR-013-a-removed-member-counts-until-removal.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/standards/architecture.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260901120000_tea04_member_writes.sql
  - src/lib/data/index.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/App.tsx
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CAL-01 — Create an entry for themselves, over a range of dates

## 1. Problem and scope

### The feature row, transcribed

`.ai/registry/features.md:87`, `CAL-01`, group `CAL`, status `PLANNED`, invariants touched
`INV-01, INV-06, INV-07`:

> From 2026-08-31-a-plan-has-nowhere-to-be-written-down.md. The ticket that creates `entry`, its
> three enums, the two generated range columns `date_range` and `portion_slots`, INV-01's exclusion
> constraint with the `btree_gist` extension, INV-03's check and INV-02's trigger — all specified in
> data-model.md at doc_version 3. `schema_delta` links **ADR-005 and ADR-011**: ADR-005 is what puts
> these in the database rather than in application code, and ADR-011 decides what the constraint
> operates on. INV-03's check ships with the table although rejection itself is a separate idea,
> which is why INV-03 is not listed at left. A contiguous range declared in one action is one entry,
> not one per day — invariants.md records that as considered and rejected as an invariant and says it
> belongs in a story. Self-only: an admin may not create on another member's behalf, denied by
> default, rbac-and-security.md known weakness 6. The note is readable by the whole team, which
> follows mechanically from `Read any entry in the team` being a row-level select policy under
> ADR-005. TODO(project): whether a member may create or edit an entry for a date in the past is
> undecided — nothing in the brief, the charter or the registry says, both answers are defensible,
> and it changes the interface. One acceptance criterion once answered.

### What this gives whom

A **member** gains the ability to put a plan on the board: one declaration that they will be on PTO or
working from home, over one date or a run of consecutive dates, at one portion of the day, optionally
marked tentative and optionally carrying a note. An **admin** gains exactly the same thing and nothing
more — creating on somebody else's behalf stays denied.

This is the first ticket that writes a row anybody else reads. Everything the product exists to do —
the month grid, the overload warning, approval — counts, draws or decides the rows this ticket
creates, and none of them can be built until `entry` exists. It is also the first ticket to put a
domain invariant into the database rather than into a screen: INV-01 has to hold against two tabs and
a retry, and only PostgreSQL sees both writes.

**`size_estimate`: M.** Eleven files, three of them new, one migration creating a table with three enums,
two generated columns, two constraints, a trigger function and two policies. Not `L`: the seam
addition is two functions, the interface is one form on one new route, and no existing caller changes
shape.

### Out of scope

- **Editing and deleting an entry.** CAL-02 (own) and CAL-03 (another member's, as an admin). No
  `update` policy and no `delete` policy on `public.entry` ships here — with row-level security
  enabled and no policy, both are denied, which is the correct state until those rows are built.
- **Approving or rejecting.** ADM-04 and ADM-05. `public.entry_enforce_decision()` ships here in its
  **INV-02-only form**, and the approval ticket replaces it with `create or replace function` — see
  section 6 and ADR-016 §*Consequences*.
- **Any calendar view.** The month grid is CAL-04, the week view CAL-05, the year view CAL-06. This
  ticket ships one read, `listOwnEntries`, bounded to the caller's own rows; the team-wide,
  range-shaped read and INV-04's absence-count function are CAL-04's and are not started here.
- **The overload warning.** CAL-07. Nothing in this ticket computes an absence count, reads
  `team.overload_threshold`, or counts the roster. Charter refusal 6 means a warning never blocks a
  save, so its absence changes no behaviour here.
- **The `team` select policy and its grant.** CAL-04 owns both, per its own feature row. This ticket
  reads `public.team` nowhere.
- **Holidays and bridge days.** ADM-02 creates the table, CAL-08 draws them. The form offers no
  holiday awareness and must not acquire one by accident.
- **Drag-select on a grid to choose dates.** Brief 7.2, and it lands in CAL-04, which hands a range
  to this ticket's existing form. The form here is typed dates only.
- **A per-day portion.** INV-06 forbids it structurally. A trip leaving Wednesday afternoon and
  returning Monday morning is up to three entries, and the form does not pretend otherwise.
- **`tests/permission-model.test.ts`.** `.ai/standards/testing-standards.md` names it as one of the
  two mandatory unit tests and it does not exist in the tree; that is pre-existing debt and creating
  it here would be a second ticket's worth of work. The denials this ticket adds are observed
  end-to-end instead, and the gap is recorded in *Open questions*.

## 2. Acceptance criteria

Every criterion is observable through the interface or through the seam. Field names are fixed in
section 4 and the selector attribute is `data-testid` (`.ai/standards/testing-standards.md`).

**AC-1 — a single-day entry**
- **Given** a signed-in member on `/entries/new`
- **When** they choose type PTO, portion `full`, the same date as both start and end, and save
- **Then** the entry is stored with `status = "pending"` and `tentative = false`, and it appears in
  the member's own entry list with that date shown once

**AC-2 — a contiguous range is one entry, not one per day**
- **Given** a signed-in member on `/entries/new`
- **When** they choose a start date and an end date five days later and save
- **Then** **exactly one** entry is stored, spanning both dates inclusively — the member's own entry
  list shows one row, not five

**AC-3 — the end date is inclusive**
- **Given** an entry saved with start `2026-10-05` and end `2026-10-09`
- **When** the member's own entry list is read back
- **Then** the entry reports `endDate` as `2026-10-09`, and the fifth day is inside the entry rather
  than after it

**AC-4 — WFH is a type, not a second feature**
- **Given** a signed-in member on `/entries/new`
- **When** they choose type WFH and save
- **Then** the entry is stored with `type = "wfh"` and is otherwise identical in shape to a PTO
  entry — same statuses, same portions, same note, same tentative flag

**AC-5 — one portion applies to the whole range (INV-06)**
- **Given** a signed-in member on `/entries/new`
- **When** they choose portion `pm` over a five-day range and save
- **Then** one entry is stored with `portion = "pm"`, and the interface offers no way to set a
  different portion for any individual date in the range

**AC-6 — tentative and note are optional and independent of status**
- **Given** a signed-in member on `/entries/new`
- **When** they tick tentative, type a note, and save
- **Then** the entry is stored with `tentative = true`, the note text, and `status = "pending"` —
  tentative does not change the status, and an entry saved without a note stores `note = null`

**AC-7 — an overlapping entry is refused, in a sentence (INV-01)**
- **Given** a member who already has a `full` entry covering `2026-10-05`
- **When** they save a second entry, of either type, whose range covers `2026-10-05` at portion
  `full` or `am` or `pm`
- **Then** the save is refused, nothing is stored, and the screen shows a sentence naming the clash —
  never a database error string and never a SQLSTATE

**AC-8 — a morning and an afternoon on one date are both accepted (INV-01)**
- **Given** a member who already has an `am` entry covering `2026-10-06` and no other entry on that
  date
- **When** they save a `pm` entry covering `2026-10-06`
- **Then** the save succeeds and both entries exist — `am` and `pm` do not conflict

**AC-9 — an inverted range is refused before the datastore sees it**
- **Given** a signed-in member on `/entries/new`
- **When** they choose an end date earlier than the start date and save
- **Then** the save is refused with a sentence about the dates, and the refusal does not surface a
  range-bound error text from the database

**AC-10 — nobody may create an entry for another member**
- **Given** a signed-in member, and a signed-in admin
- **When** either issues a create carrying a `memberId` that is not their own
- **Then** the write is refused for both roles — the admin has no more power here than the member

**AC-11 — a caller cannot create an already-approved entry**
- **Given** a signed-in member, and a signed-in admin
- **When** either issues a create carrying `status`, `approvedBy`, `approvedAt` or `rejectionReason`
- **Then** the write is refused, and no entry exists carrying a status the creator chose — a new
  entry is `pending` and its approval columns are null, for both roles

**AC-12 — dates in the past**

**TODO(project). Deliberately unwritten — this criterion is the operator's and no agent may supply
it.** See *Open questions* item 1. Until it is answered the implementation adds **no** past-date
rule in either direction and the developer stops rather than choosing one; a rule invented here
would be indistinguishable from a decided one to everybody downstream.

### Invariants touched

`[INV-01, INV-02, INV-03, INV-06, INV-07]`.

**This diverges from the feature row, which lists `INV-01, INV-06, INV-07`, and the divergence is
deliberate on both added IDs.** `.ai/registry/invariants.md` says the list records what a change
*could* affect rather than what survives the mitigation, and this ticket ships the mechanism that
holds each of the two.

- **INV-01** — held by the exclusion constraint `entry_no_overlapping_portion` over `member_id`,
  `date_range` and `portion_slots` (ADR-011). AC-7 asserts the refusal and AC-8 asserts that the
  refusal is not over-broad; the pair is the test, because a constraint written with `portion WITH =`
  passes AC-7's `full`-versus-`full` case and silently permits `full` beside `am`.
- **INV-02** — this ticket creates `public.entry_enforce_decision()` and its trigger. It cannot yet
  be exercised end-to-end, because nothing here approves an entry and nothing here updates one; it is
  listed because a wrong function shipped now is held to be correct by every later ticket that only
  replaces it. The name is fixed by ADR-016 and using a different one puts the approval ticket's
  `create or replace` **beside** this function instead of over it.
- **INV-03** — held by a check constraint tying `rejection_reason` to `status = 'rejected'` **in both
  directions**. Listed although rejection is ADM-05's: the biconditional ships here, and if it is
  written one-directional the invariant reads as claimed and is not held.
- **INV-06** — held by column shape: one not-null `entry_portion` enum on the row, so a per-day
  portion is unrepresentable. AC-5 observes it.
- **INV-07** — held by `member_id uuid not null references public.member (id) on delete restrict`,
  plus the insert policy's `with check (member_id = auth.uid())` and the withheld column privilege on
  `member_id`. AC-10 observes it.

**INV-04 and INV-05 are deliberately absent.** This ticket creates the rows the count sums but
computes no count, reads no threshold and reads no roster — the counting function is CAL-04's and
does not exist yet. Recorded explicitly rather than by omission, because `.ai/registry/invariants.md`
warns that concluding "not engaged" from safe behaviour is circular: the mechanism here is that there
is no arithmetic in this ticket at all, not that the arithmetic is careful.

### Open questions

1. **May a member create an entry for a date in the past?** `TODO(project)` on
   `.ai/registry/features.md:87`. Nothing in the brief, the charter, the glossary or the invariants
   answers it; both answers are defensible — the board is a forward-planning tool, and a person who
   forgot to declare last Tuesday still owes the team the record. It changes the interface: either
   the date fields refuse a past date with a message, or they do not. **It is one acceptance
   criterion (AC-12) and it blocks nothing else in this plan.** The operator's, under RULE-01,
   because it is a product decision and recording one they did not make is forgery rather than
   initiative.

2. **A rejected entry still occupies its portion, so a member cannot re-request the same dates.**
   ADR-011 §*Consequences* records this and routes it to the operator, not to a designer. It is not
   reachable in this ticket — nothing here rejects anything — but AC-7's message is the surface where
   it will eventually be felt, so section 4's failure mapping is written to carry a specific sentence
   rather than a generic one. **Not blocking CAL-01.** It blocks nothing until ADM-05 ships.

3. **`tests/permission-model.test.ts` does not exist**, while
   `.ai/standards/testing-standards.md` names it as one of two mandatory unit tests and TEA-01's
   migration comment cites it by path. AC-10 and AC-11 are the sharpest denials in the product so far
   and they are observed end-to-end here rather than against a real PostgreSQL with a token per role.
   **Not blocking CAL-01** — it is pre-existing debt, it predates this ticket, and closing it is its
   own piece of work. Recorded so it is not mistaken for something this plan discharged.

4. **`.ai/standards/ui-design-system.md` is still the shipped stub** — no colour values, no type
   scale, no component rules. `CLAUDE.md` carries the direction (PTO peach, WFH mint, tentative as a
   dashed border at reduced opacity) and that is what section 4's markup follows. **Not blocking** —
   the form is functional and its selectors are fixed here, so a later design pass restyles without
   touching behaviour.

---

*Sections 1 and 2 above were written before the source tree was read, per the ordering the `/plan`
command requires. Sections 3 to 8 below were written after. Nothing in 1 or 2 was amended; had it
been, the Changelog would say so and why.*

---

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. **Every check that decides anything is a row-level
security policy, a column privilege or a trigger — ADR-005.** Nothing in `src/` is a control; the
interface-level checks below are affordances and each carries a comment saying so.

| Action | `member` | `admin` | Where the decision is made |
|---|---|---|---|
| Read any entry in the team | ✅ | ✅ | policy `entry_select_team` |
| Create an entry for themselves | ✅ | ✅ | policy `entry_insert_own`, `with check (member_id = auth.uid())` |
| Create an entry on behalf of another member | ❌ | ❌ | the same `with check` — it admits no other value |
| Set `status` on a new entry | ❌ | ❌ | column privilege: `status` is **not** in the insert grant |
| Set `approved_by` / `approved_at` / `rejection_reason` on a new entry | ❌ | ❌ | the same withheld privilege |
| Edit an entry | — | — | **no `update` policy ships.** CAL-02 and CAL-03 |
| Delete an entry | — | — | **no `delete` policy ships.** CAL-02 and CAL-03 |

### The three denials, and why each is held where it is

**AC-10 — creating for somebody else — is held by the policy's `with check`, and it is uniform across
roles.** `rbac-and-security.md` marks *Create an entry on behalf of another member* as a denial by
default rather than by decision, for both roles. One policy expresses that with no role predicate at
all, which is the shortest correct shape and therefore the hardest to write wrongly.

**AC-11 — creating an already-approved entry — is held by a column grant, and this is the one case
where a column grant works on `entry`.** `rbac-and-security.md` known weakness 6 records that column
privileges fail on this table because `member` and `admin` are the same PostgreSQL role,
`authenticated`, so a grant cannot distinguish them. That is fatal wherever the answer differs by
role. Here the answer is **nobody**, for both roles: an admin approves by *updating* an entry under
ADM-05, never by creating one already approved. So the privilege is simply withheld, and a statement
naming `status` is refused with `42501 permission denied for column` before any policy runs. This is
the same shape TEA-04 used on `member.team_id` and ADM-01 uses on `team.overload_threshold`.

**There is no `BEFORE INSERT` guard, and that is deliberate.** ADR-016's trigger exists because a
`with check` cannot see the OLD row and so cannot say "`status` did not change". On an insert there
*is* no old row and nothing to compare — the column grant answers the whole question, and adding a
second `BEFORE INSERT` trigger to `entry` would reintroduce the alphabetical-ordering trap ADR-016
§*Consequences* warns about for exactly nothing.

### The affordances above the seam

The form hides nothing a member may not do, because there is nothing on it a member may not do. What
it does carry: it never renders a status control, a tentative-versus-approved conflation, or a member
picker. **The absence of a member picker is the affordance for AC-10** — and it is not the control,
which is the policy. `src/routes/NewEntry.tsx` carries that sentence as a comment at the point it
would otherwise be tempting to add one.

## 4. Contract

### 4.1 Domain types — `src/lib/domain/types.ts`

Every name below is `.ai/standards/data-model.md`'s or ADR-011's, in the application casing
`types.ts` already uses. Nothing here is invented (RULE-04).

```ts
/** `entry_type` in the datastore. A WFH member IS working — glossary.md calls this the single most
 *  costly confusion in the domain. */
export type EntryType = "pto" | "wfh";

/** `entry_portion`. One value per entry, applying to every date in the range (INV-06). */
export type EntryPortion = "full" | "am" | "pm";

/** `entry_status`. Independent of `tentative` — glossary.md keeps the two axes apart deliberately. */
export type EntryStatus = "pending" | "approved" | "rejected";

/** A row of `public.entry`, in application casing.
 *
 *  `date_range` and `portion_slots` are DELIBERATELY ABSENT. ADR-011 creates them as stored
 *  generated columns and says they are never written; they exist for the exclusion constraint and
 *  for PostgREST's `date_range=ov.…` filter, both of which live inside the seam. Surfacing them here
 *  would put a PostgreSQL range literal above the seam, which architecture.md's "Layers" forbids,
 *  and would put a second representation of the same three fields in reach of a component — where
 *  ADR-011's canonicalisation footgun (a one-day entry reads back as `[d, d+1)`) would be read as
 *  "the entry ends the following day". The seam may name them; nothing above it may. */
export interface Entry {
  id: string;
  memberId: string;
  type: EntryType;
  portion: EntryPortion;
  startDate: string;        // yyyy-MM-dd. Never a Date — see 4.5.
  endDate: string;          // yyyy-MM-dd, INCLUSIVE. Equal to startDate for a single day.
  tentative: boolean;
  status: EntryStatus;
  rejectionReason: string | null;
  note: string | null;
  approvedBy: string | null;
  approvedAt: string | null;  // ISO 8601
  createdAt: string;          // ISO 8601
  updatedAt: string;          // ISO 8601
}
```

Three additions to the existing `FailureCode` union:

```ts
  // CAL-01, 01-plan.md section 4.2.
  | "overlapping_entry"   // AC-7: INV-01's constraint refused the write (SQLSTATE 23P01)
  | "invalid_date_range"  // AC-9: end_date is before start_date
  | "entry_not_permitted" // AC-10, AC-11: the policy or a column privilege refused the write
```

`entry_not_permitted` rather than reusing TEA-02's `not_permitted`: that code's message is written
about the allow-list, and one code carrying two sentences is how a wrong message reaches a screen.

```ts
/** The explicit row limit `listOwnEntries` asks for, and the count at which it refuses to answer.
 *  Same shape and same reasoning as ROSTER_LIMIT (TEA-03): it must sit BELOW the datastore's own
 *  `max-rows` cap so that this assertion fires before the server's silent one does. A truncated read
 *  here is a member being told an entry they created does not exist.
 *
 *  TODO(verify): the datastore's default `max-rows`. The same unknown is already carried by CAL-04,
 *  ADM-02 and ADM-04 in features.md. If it turns out lower than this, the fix is this one number. */
export const OWN_ENTRY_LIMIT = 500;
```

### 4.2 Seam additions — `src/lib/data/index.ts`

```ts
/** CAL-01, 01-plan.md section 4.2.
 *
 *  NO `status`, `approvedBy`, `approvedAt` or `rejectionReason`. Not an oversight and not a
 *  convenience: those columns are withheld from the insert grant (section 3), so a field here would
 *  be a field the datastore refuses — a DTO that accepts a value the database rejects invites the
 *  write that AC-11 exists to refuse.
 *
 *  NO `memberId` EITHER. The policy's `with check` supplies it from `auth.uid()`; a parameter would
 *  imply a caller could pass somebody else's and be answered. Same reasoning that kept `teamId` off
 *  `addAllowedEmail`. */
export interface CreateEntryInput {
  type: EntryType;
  portion: EntryPortion;
  startDate: string;   // yyyy-MM-dd
  endDate: string;     // yyyy-MM-dd, inclusive; equal to startDate for a single day
  tentative: boolean;
  note: string | null;
}
```

Two functions on `DataSeam`:

```ts
  // -------------------------------------------------------------------------
  // CAL-01 — create an entry. 01-plan.md section 4.2.
  // -------------------------------------------------------------------------

  /**
   * AC-1 … AC-11. Creates one entry for the CALLER, over one date or a run of consecutive dates.
   *
   * Expected failures are RETURNED, not thrown (coding-standards.md). Three codes reach a sentence
   * on screen and each maps to a specific database refusal (section 4.3):
   *   `overlapping_entry`   — INV-01's exclusion constraint, SQLSTATE 23P01, arriving as a 409
   *   `invalid_date_range`  — end before start, refused in the seam BEFORE the round trip (AC-9)
   *   `entry_not_permitted` — the insert policy or a withheld column privilege, 42501 / 403
   *
   * Returns the created row. The `.select()` is not a convenience: under row-level security a
   * refused INSERT that the policy filters returns no representation, and treating `!error` as
   * success would report a refusal as done — the same trap TEA-04's `removeMember` records.
   */
  createEntry(input: CreateEntryInput): Promise<Result<Entry>>;

  /**
   * AC-1, AC-2, AC-3, AC-5, AC-6, AC-8. The CALLER'S OWN entries, newest start date first.
   *
   * Deliberately narrow, and this is the boundary with CAL-04. It takes NO date range and NO member
   * parameter, so it cannot become the team-wide, range-shaped read that CAL-04 owns — that read
   * filters `date_range=ov.…` and feeds INV-04's counting function, and building it here would put a
   * second entry read in the seam before the one that matters exists.
   *
   * It exists because every criterion in section 2 has to be observable from outside the system and
   * a confirmation message proves only that the form ran. `entry_select_team` admits the whole
   * team's rows; this function narrows to the caller's in the query, which is an affordance and not
   * a control — the policy is what stops anybody reading another team's.
   *
   * THROWS on a transport failure and on a possibly-truncated answer, the shape `listMembers` uses:
   * there is no caller-visible failure to carry, `[]` for a broken connection would report "you have
   * no entries", and a short list for a capped read is the failure OWN_ENTRY_LIMIT exists to prevent.
   */
  listOwnEntries(): Promise<Entry[]>;
```

### 4.3 The failure mapping, exactly

`src/lib/data/supabase.ts` maps the datastore's refusals onto the three codes. **Every message is
already in the conversation language and is safe to render** (`Failure.message`, `types.ts`).

| Refusal | Reaches the browser as | Code | Message |
|---|---|---|---|
| `entry_no_overlapping_portion` | `409`, SQLSTATE `23P01` | `overlapping_entry` | *"Bạn đã có một đăng ký trùng với khoảng ngày và buổi này. Hãy sửa đăng ký cũ hoặc chọn khoảng khác."* |
| insert policy filtered / column privilege | `403`, SQLSTATE `42501` | `entry_not_permitted` | *"Không thể tạo đăng ký này."* |
| `entry_end_after_start` check | `400`, SQLSTATE `23514` | `invalid_date_range` | *"Ngày kết thúc phải bằng hoặc sau ngày bắt đầu."* |

**AC-9 is refused in the seam before the request is sent**, and the check constraint above is the
second lock rather than the first. ADR-011 §*Consequences* records that an inverted pair fails
*inside the generated column* with *"range lower bound must be less than or equal to range upper
bound"* — a database error text where a sentence about dates belongs. Refusing early gives the
message; the constraint means a caller bypassing this application still cannot store one.

**The `23P01` mapping is matched on the SQLSTATE, never on the constraint name or the message text.**
A name match breaks silently if the constraint is ever renamed, and PostgREST's message wording is
not a contract.

### 4.4 The screen — `src/routes/NewEntry.tsx`, route `/entries/new`

Selectors, fixed here so the tests address them and a later design pass may restyle freely:

| `data-testid` | What it is |
|---|---|
| `new-entry-form` | the form element |
| `new-entry-type` | PTO / WFH — a two-option control, AC-4 |
| `new-entry-portion` | `full` / `am` / `pm`, AC-5 |
| `new-entry-start` | start date input, `type="date"` |
| `new-entry-end` | end date input, `type="date"` |
| `new-entry-tentative` | the tentative checkbox, AC-6 |
| `new-entry-note` | the note textarea, AC-6 |
| `new-entry-submit` | the save button |
| `new-entry-error` | the one place any of section 4.3's sentences is rendered, AC-7 and AC-9 |
| `own-entry-row` | one row per entry in the caller's own list |
| `own-entry-row-dates` | the range, rendered `yyyy-MM-dd → yyyy-MM-dd`, AC-2 and AC-3 |
| `own-entry-row-type` | `pto` / `wfh`, carried as a `data-type` attribute, AC-4 |
| `own-entry-row-portion` | carried as a `data-portion` attribute, AC-5 |
| `own-entry-row-tentative` | present only when tentative, AC-6 |
| `own-entries-empty` | the empty state |

**`own-entry-row-dates` renders both bounds even for a single-day entry**, as `d → d`. A single date
shown once would make AC-3's inclusivity unobservable on exactly the case where an off-by-one is
easiest to introduce.

`App.tsx` gains one route, guarded the way `/` already is: reachable only in membership state
`member`, since an entry needs a member row to belong to (INV-07). `Home.tsx` gains one link to it.

### 4.5 Dates are strings, everywhere above PostgreSQL

`startDate` and `endDate` are `yyyy-MM-dd` strings and are never converted to `Date` for comparison
or display. **`new Date('2026-04-30')` parses as UTC midnight, so a weekday or day-of-month read west
of UTC yields the previous day.** CAL-08's feature row records this as the trap that passes every test
run in Vietnam; it is written here because this is the ticket that introduces the first date field,
and the habit is cheaper to establish than to retrofit. String comparison is correct for
`yyyy-MM-dd` and is what AC-9's seam-side check uses.

## 5. Seam impact

**Two functions added, both new: `createEntry` and `listOwnEntries`.** No existing seam function
changes signature, return type or behaviour.

Both appear in `src/lib/data/index.ts` (the interface), `src/lib/data/supabase.ts` and
`src/lib/data/mock.ts` with the same names and the same arity, or `tests/seam-parity.test.ts` fails.
That test enumerates `Object.keys(referenceImpl)` and needs no edit, which is why it is absent from
`allowed_paths`.

**Parity is necessary and not sufficient here, and the subtle shape is `endDate`.** ADR-011 records
that PostgreSQL canonicalises a stored discrete range to `[)`, so the constraint sees
`['2026-10-05','2026-10-10')` for an entry ending on the 9th. `supabase.ts` reads `end_date` — the
plain column — and never derives the end from `date_range`'s upper bound, which is the day *after*.
`mock.ts` stores `endDate` directly and has no range to be confused by, so the two implementations
can only disagree if `supabase.ts` reads the wrong column. **AC-3 is the assertion that catches it**,
and it must run against both seams.

`mock.ts` holds INV-01 with an in-memory overlap test using the same slot semantics — `full` → slots
{0,1}, `am` → {0}, `pm` → {1}, conflict when the date ranges intersect *and* the slot sets intersect.
**That is a second implementation of an invariant, and it is acceptable only because the mock is not
a datastore anybody's data lives in**; it exists so AC-7 and AC-8 are observable end-to-end without a
provisioned project. It carries a comment naming INV-01 and pointing at the constraint as the real
mechanism.

## 6. Schema delta

**Not `none`.** One new migration, `supabase/migrations/20260903xxxxxx_cal01_entry.sql`. Applying it
is human — RULE-09. Under ADR-014 a migration touching a policy, trigger or constraint is not `none`
with no carve-out, and this one touches all three.

Approved ADRs it rests on, all three already `ACCEPTED` and none written by this ticket:

- **ADR-005** — authorization is in row-level security and nowhere else. Why the constraint, the
  check and the trigger are in the database rather than in the seam.
- **ADR-011** — the two generated columns `date_range` and `portion_slots`, the exclusion constraint
  `entry_no_overlapping_portion`, and `btree_gist`.
- **ADR-016** — the function name `public.entry_enforce_decision()` and the trigger name
  `entry_enforce_decision`.

**No new ADR is required and none is written.** Every decision this migration needs was made inside
an existing envelope; nothing here supersedes or reverses an accepted decision, so ADR-008's limit is
not reached.

What the migration contains, in order:

1. `create extension if not exists btree_gist with schema extensions;` — required by
   `member_id WITH =` inside a GiST index. `with schema extensions` matches TEA-01's `citext` line
   rather than being chosen fresh.
   **`TODO(verify):` availability on the hosted project, and whether the `extensions` schema is on
   the `search_path` in force when the constraint is created** — ADR-011 §4 carries this marker and
   it is not discharged by this plan. If the operator class does not resolve, the `ALTER TABLE` fails
   at apply time with *"data type uuid has no default operator class for access method gist"*.
2. `create type public.entry_type as enum ('pto', 'wfh');`
   `create type public.entry_portion as enum ('full', 'am', 'pm');`
   `create type public.entry_status as enum ('pending', 'approved', 'rejected');`
3. `create table public.entry (…)` — every column and type copied from `.ai/standards/data-model.md`
   without alteration, `member_id … references public.member (id) on delete restrict` and
   `approved_by … references public.member (id) on delete restrict`. **No cascade**, per that file.
4. The two generated columns, exactly as ADR-011 §1 writes them — `daterange(start_date, end_date,
   '[]')` with the `'[]'` constructor, and the three-way `case` on `portion`.
5. `constraint entry_end_after_start check (end_date >= start_date)` — **decided here, and it is a
   decision this ticket owns.** ADR-011 §*Consequences* records that nothing requires it and routes
   it to *"whoever designs the entry-creation story"*. It closes AC-9's second lock.
6. INV-03's check, **biconditional**:
   `check ((status = 'rejected'::public.entry_status) = (rejection_reason is not null and btrim(rejection_reason) <> ''))`.
   ADR-016 §3 requires both directions; one-directional would let an approved entry keep a stale
   reason.
7. `constraint entry_no_overlapping_portion exclude using gist (member_id with =, date_range with &&,
   portion_slots with &&)` — ADR-011 §3 verbatim. **Never `portion with =`**, which accepts `full`
   beside `am` and is the failure that whole ADR exists to record.
8. `public.entry_enforce_decision()` **in its INV-02-only form** — clause (c) of ADR-016 §1 and
   nothing else, plus the trigger `entry_enforce_decision before update on public.entry for each
   row`. `language plpgsql security invoker set search_path = ''`, matching ADR-016.
   **The name is load-bearing.** ADM-05 replaces this function with `create or replace function`;
   a different name lands its version beside this one and PostgreSQL then fires both, ordered
   alphabetically.
9. `alter table public.entry enable row level security;` then
   `revoke all on public.entry from anon, authenticated;` — **explicit, not inherited.** TEA-01's
   revoke names three tables because `entry` did not exist; ADR-016 §*Consequences* records this as
   the third time the trap has been found.
10. `grant select on public.entry to authenticated;` and
    `grant insert (member_id, type, portion, start_date, end_date, tentative, note) on public.entry
    to authenticated;` — the column list **is** AC-11's control, and `status`,
    `rejection_reason`, `approved_by`, `approved_at`, `id`, `created_at`, `updated_at`,
    `date_range` and `portion_slots` are all absent from it deliberately.
11. `create policy entry_select_team on public.entry for select to authenticated using
    (public.member_team_id(member_id) = public.member_team_id((select auth.uid())));` — both calls
    are the `security definer` helper TEA-01 already created and granted, so a policy on `entry` may
    consult `member` without recursing through `member`'s own policies. `to authenticated`, never
    `to public`, or the anon key that ships in the bundle re-opens the table.
12. `create policy entry_insert_own on public.entry for insert to authenticated with check
    (member_id = (select auth.uid()));` — AC-10, uniform across roles.
13. **No `update` policy and no `delete` policy.** With row-level security enabled and no policy,
    both are denied. CAL-02 and CAL-03 add them, and ADR-016 §*Consequences* records that a column
    grant excluding `member_id` belongs to those rows rather than here.

`ticket.yaml` already carries `schema_delta` and `requires_adr: true` from triage; both are correct
and are left as written.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260903*_cal01_entry.sql"
  - "supabase/seed.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/fixtures.ts"
  - "src/routes/NewEntry.tsx"
  - "src/routes/Home.tsx"
  - "src/App.tsx"
  - "tests/e2e/cal-01-create-entry.spec.ts"
```

Eleven globs, eleven files, three of them new (the migration, `NewEntry.tsx`, the spec).

**`size`: M. It agrees with `size_estimate` in section 1, so ADR-012 is not engaged and nothing
splits.** Eleven sits one below the twelve that TEA-05 treated as M's ceiling. The estimate and the
count were written by the same agent forty minutes apart and it is worth saying they agreed: the
count was reached from the file list rather than from the estimate, and the migration — the one thing
that could have pushed this to `L` — is a single file however many objects it creates.

**Deliberately absent, each with its reason:**

- `tests/seam-parity.test.ts` — enumerates `Object.keys(referenceImpl)` and follows the seam without
  an edit (section 5).
- `tests/e2e/smoke.spec.ts` — addresses `app-root`, which keeps its name and position.
- `tests/e2e/tea-01-signup.spec.ts`, `tests/e2e/tea-05-sign-in.spec.ts` — shipped acceptance tests of
  other features; nothing here changes what they assert.
- `playwright.config.ts` — BUG-001 pinned the seam and CI needs no edit.
- `src/routes/MemberList.tsx`, `src/routes/AllowList.tsx`, `src/routes/SignIn.tsx`,
  `src/routes/NotOnATeam.tsx`, `src/hooks/useSession.ts` — untouched. The new route is guarded by the
  membership state `App.tsx` already resolves.
- `.ai/standards/data-model.md` — its `TODO(project)` asking each *Where invariants are held* row to
  cite a migration file and a constraint name becomes answerable once this migration exists, and it
  is standards plane under RULE-01. **It is owed a human edit; this ticket does not make it.**
- `.ai/registry/features.md` — the CAL-01 row's `Status` is `/ship`'s to move, not PLAN's.

## 8. Rejected alternatives

**1. Expanding a range into one row per date, constrained by a plain `unique (member_id, date,
portion)`.** Genuinely plausible: it holds INV-01 with a unique index, needs no `btree_gist`, no
generated columns and no GiST, and makes the month read a trivial equality filter. It is rejected
because it contradicts INV-06 — the entry is the unit that carries one portion for its whole range —
and because `.ai/registry/invariants.md` records *"a contiguous range declared in one action is one
entry, not one per day"* as considered and rejected as an invariant precisely so that it would land
as an acceptance criterion, which is AC-2. Structurally it turns one five-day request into five rows
that approval, rejection, `approved_by` and the audit trail would each have to keep in step, and the
first time they diverge the entry means two things. ADR-011 §*Rationale* rejects it on the same
ground; it is repeated here because this is the ticket where the temptation is concrete.

**2. Holding INV-01 in the seam as a read-then-write check, with no exclusion constraint.** Plausible
because it needs no extension, no generated columns, and no `TODO(verify)` about a hosted project's
`search_path` — the one unresolved risk in section 6 disappears. Rejected because it reverses ADR-005,
and because `.ai/registry/invariants.md` names the exact failure under INV-01: *"two tabs, two
devices, or a retry"*. The seam runs in the browser, so under ADR-005 it is in the same position as a
UI affordance — the same insert is reachable from anywhere holding the token, and the check is not
merely racy, it is optional. ADR-011 §*Status* refused this path already; refusing it again here
costs one paragraph and stops it being re-derived at implementation time when the extension marker
turns out to be inconvenient.

**3. A `BEFORE INSERT` trigger to hold AC-11, mirroring ADR-016's `BEFORE UPDATE` guard.** The most
plausible of the three, because it looks like consistency: the same four decision columns are guarded
on update by a trigger, so guarding them on insert by a trigger reads as the matching half. Rejected
because a column grant answers the whole question here and a trigger does not answer it better —
there is no OLD row on an insert, so the trigger would compare `new.status` against a literal, which
is what a privilege already does declaratively and earlier. Against that it costs a **second
`BEFORE` trigger on `entry`**, and ADR-016 §*Consequences* records that PostgreSQL fires same-event
triggers alphabetically by name, so the guard's correctness would start depending on spelling — a
trap that "nobody will notice until a member's ordinary edit is refused". The one-function property
is worth keeping and this is the first chance to lose it.

## Changelog

- `2026-09-03T10:09:24+07:00` — sections 1 to 8 written. Sections 1 and 2 written before the source
  tree was read; nothing in either was amended afterwards. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
