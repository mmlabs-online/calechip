---
ticket: CAL-02
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-03T11:55:53+07:00
inputs_read:
  - .ai/board/tickets/CAL-02/ticket.yaml
  - .ai/board/tickets/CAL-01/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/00-charter.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/standards/architecture.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260901120000_tea04_member_writes.sql
  - src/lib/data/index.ts
  - src/lib/domain/types.ts
  - src/routes/NewEntry.tsx
  - src/App.tsx
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CAL-02 — Edit or delete their own entry

## 1. Problem and scope

### The feature row, transcribed

`.ai/registry/features.md:89`, `CAL-02`, group `CAL`, status `PLANNED`, invariants touched
`INV-01, INV-02, INV-06, INV-07`:

> From 2026-08-31-a-plan-has-nowhere-to-be-written-down.md. The charter's *"at any time"* governs
> this row. INV-02's trigger fires on a change to dates, type, portion or tentative and not on a
> note-only edit, and per ADR-011 it clears `approved_by` and `approved_at` as well as resetting
> `status`; the story observes the trigger rather than implementing it. Delete is a hard delete —
> `entry` carries no soft-delete column and nothing requires one, so the row and its `approved_by`
> disappear together and the approving admin learns nothing, because v1 has no notification channel
> and the change feed is P1. An edit may not change `member_id` (INV-07). `schema_delta` none.

**The row's closing `schema_delta` none is stale and is not followed.** ADR-014 — `ACCEPTED by the
operator` — says a migration touching a policy, trigger or constraint is not `none`, with no
carve-out, and this ticket ships two policies, a column grant and a function replacement. The ticket
shell already carries the correction. Recorded here as a finding for a human rather than edited:
`features.md` is registry plane under RULE-01, and its `Status` column is the only field `/ship`
writes.

### What this gives whom

A **member** gains the other half of a plan: the ability to change it. `.ai/00-charter.md:74` gives
the member *"Create, edit and delete their **own** entries, at any time"*, and CAL-01 delivered only
the first verb. Until this ticket lands, an entry typed with the wrong date is permanent — and
because INV-01 has no status carve-out, the member cannot even work around it by creating a
replacement on the corrected dates while the wrong row still occupies them.

It is also the first ticket in which the INV-02 trigger CAL-01 shipped can actually fire. CAL-01
created `public.entry_enforce_decision()` and could not exercise it, because with no `update` policy
no signed-in caller could reach an UPDATE at all. This ticket opens that path and observes the
trigger rather than reimplementing it.

**`size_estimate`: M.** Eleven files, three of them new, one migration adding two policies, one
column grant and one function replacement. Not `L`: no new table, no new enum, no new constraint,
and the seam gains two functions that mirror ones already written.

### Out of scope

- **Editing or deleting another member's entry, as an admin.** CAL-03, and it is a separate
  permission row and a separate policy in `.ai/standards/rbac-and-security.md`. Nothing in this
  ticket's policies mentions `is_admin`, and an admin acting here acts only on their own rows.
- **Approving, rejecting, or writing `status` at all.** ADM-04 and ADM-05. **The update grant in
  section 6 deliberately excludes `status` and `rejection_reason`**, and section 6 explains why
  granting them now would ship a hole rather than a feature.
- **Changing `member_id`.** INV-07. The column is withheld from the update grant and the policy's
  `with check` is the second lock.
- **Any calendar view, the absence count, the overload warning, holidays.** CAL-04 through CAL-08.
  This ticket adds no read beyond the `listOwnEntries` CAL-01 already built.
- **A soft delete, an undo, or a trash.** The feature row settles it: delete is a hard delete,
  `entry` carries no soft-delete column, and nothing requires one.
- **Telling the approving admin that an approved entry was edited or deleted.** v1 has no
  notification channel and the change feed is on the brief's P1 list. The feature row states this as
  an accepted consequence, not a gap this ticket fills.
- **`updated_by`.** `.ai/standards/data-model.md` OPEN QUESTIONS item 5 — it would close known
  weakness 3, it blocks nothing, and it is a schema change with its own decision. This ticket makes
  `updated_at` truthful (section 6) and adds no second column.
- **Whether a member may edit an entry onto a date in the past.** Unanswered — see *Open questions*
  item 1. It is the same `TODO(project)` that left CAL-01's AC-12 unwritten, and it names editing
  explicitly.

## 2. Acceptance criteria

Every criterion is observable through the interface. The selector attribute is `data-testid`
(`.ai/standards/testing-standards.md`).

**AC-1 — a member edits their own entry**
- **Given** a signed-in member with a `pending` PTO entry covering `2026-10-05` to `2026-10-09`
- **When** they open that entry, change the end date to `2026-10-07`, and save
- **Then** the entry is stored with `endDate` `2026-10-07`, no second entry is created, and their own
  entry list shows one row carrying the new range

**AC-2 — every substantive field is editable**
- **Given** a signed-in member with a `pending` entry
- **When** they change type, portion, start date, end date, tentative and note in one edit and save
- **Then** all six changes are stored together

**AC-3 — a member deletes their own entry**
- **Given** a signed-in member with an entry in their own list
- **When** they delete it and confirm
- **Then** the entry is gone from the list, and reloading the page does not bring it back

**AC-4 — deleting frees the dates it occupied (INV-01)**
- **Given** a member whose `full` entry covers `2026-10-05`, and a second entry on those dates is
  therefore refused
- **When** they delete the first entry and then create an entry covering `2026-10-05`
- **Then** the create succeeds

**AC-5 — a substantive edit to an approved entry returns it to pending (INV-02)**
- **Given** a signed-in member whose entry is `approved` and names an approver
- **When** they change its dates and save
- **Then** the entry reads `pending`, carries no approver and no approval time, and the interface
  shows it as pending rather than approved

**AC-6 — editing only the note does not revoke an approval (INV-02)**
- **Given** a signed-in member whose entry is `approved` and names an approver
- **When** they change only the note and save
- **Then** the entry is still `approved`, still names the same approver and the same approval time,
  and the new note is stored

**AC-7 — an edit that would overlap another of the member's own entries is refused (INV-01)**
- **Given** a member with a `full` entry covering `2026-10-05` and a second `full` entry covering
  `2026-10-20`
- **When** they edit the second entry so its range covers `2026-10-05` and save
- **Then** the save is refused, neither entry changes, and the screen shows a sentence naming the
  clash — never a database error string and never a SQLSTATE

**AC-8 — an edit may not move an entry to another member (INV-07)**
- **Given** a signed-in member editing their own entry
- **When** a `memberId` other than their own is submitted with the edit
- **Then** the write is refused and the entry still belongs to the original member

**AC-9 — a member may not edit or delete somebody else's entry**
- **Given** a signed-in member, and an entry belonging to a different member of the same team
- **When** they issue an edit or a delete against that entry's id
- **Then** both are refused and the entry is unchanged — a member reads the whole team's entries and
  writes only their own

**AC-10 — a member may not set `status` through an edit**
- **Given** a signed-in member editing their own `pending` entry
- **When** `status` is submitted with the edit, set to `approved`
- **Then** the write is refused and the entry is still `pending` with no approver

**AC-11 — an inverted range is refused on an edit too**
- **Given** a signed-in member editing their own entry
- **When** they set an end date earlier than the start date and save
- **Then** the save is refused with a sentence about the dates, and the refusal does not surface a
  range-bound error text from the database

**AC-12 — an edit records when it happened**
- **Given** an entry created at a known moment
- **When** the member edits it
- **Then** the entry's `updatedAt` is later than its `createdAt`

### Invariants touched

`[INV-01, INV-02, INV-06, INV-07]` — the same four the feature row lists, and this plan adds none.

- **INV-01** — held by `entry_no_overlapping_portion`, the exclusion constraint CAL-01 shipped.
  Nothing here re-implements it; the update path simply reaches it for the first time, because a
  constraint over `member_id`, `date_range` and `portion_slots` is evaluated on UPDATE exactly as on
  INSERT. AC-7 asserts the refusal and AC-4 asserts that a delete releases the slots, which is the
  half a test written only from the happy path would miss.
- **INV-02** — held by `public.entry_enforce_decision()`, the trigger CAL-01 shipped. **This ticket
  is the first that can fire it**, and it observes rather than implements: AC-5 asserts the reset,
  AC-6 asserts the note carve-out. The function is replaced in this ticket for a different reason
  (`updated_at`, section 6), so clause (c) must come through the replacement character-identical —
  a replacement that quietly changes the reset is a broken invariant with a passing diff.
- **INV-06** — held by column shape: `portion` remains a single not-null enum, so an edit can change
  which portion applies but cannot make it vary by date. AC-2 exercises the change; the interface
  offers no per-day control, exactly as CAL-01's form does not.
- **INV-07** — held by `member_id` being absent from the update grant, plus the policy's
  `with check (member_id = auth.uid())` as the second lock, plus the not-null reference the table
  already carries. AC-8 observes it.

**INV-03, INV-04 and INV-05 are deliberately absent.** INV-03's biconditional check is untouched and
unreachable: `rejection_reason` is not in the update grant, so no statement this ticket permits can
move it. INV-04 and INV-05 are the absence count, and this ticket computes no count, reads no
threshold and reads no roster — it changes the rows the count will sum, which is what every write
ticket does, and the counting function is CAL-04's and does not exist.

### Open questions

1. **May a member edit an entry onto a date in the past?** The `TODO(project)` on
   `.ai/registry/features.md:87` names creating **and editing**, and it is still open — CAL-01
   shipped with its AC-12 deliberately unwritten for the same reason. Nothing in the brief, the
   charter, the glossary or the invariants answers it, and it changes the interface identically on
   both screens. **Deliberately not written as an AC here**, and the implementation adds no
   past-date rule in either direction. It is the operator's under RULE-01. **One answer settles both
   tickets**; if it arrives before this ticket is implemented, the criterion lands here and CAL-01's
   AC-12 is filled by a follow-up rather than by this plan.

2. **`tests/permission-model.test.ts` still does not exist.** AC-8, AC-9 and AC-10 are the sharpest
   denials this ticket adds and they are observed end-to-end against the mock seam, not against a
   real PostgreSQL with a token per role. `.ai/standards/testing-standards.md` names that file as one
   of two mandatory unit tests, and CAL-01's plan recorded the same gap. **Not blocking** — it is
   pre-existing debt and closing it is its own piece of work. It is worth saying that AC-10 is the
   case ADR-016 §*Consequences* calls the permission model's sharpest, and here it is held by a
   withheld column privilege rather than by the trigger clause that does not exist yet.

3. **An admin editing their own entry revokes their own approval, and cannot restore it in this
   ticket.** The trigger is actor-blind by decision (ADR-016 §2), so an admin who edits their own
   approved entry lands it back at `pending` — and no approve path exists until ADM-05. **Not
   blocking, and not a defect**: self-approval is permitted, so the cost is one click that ADM-05
   will provide. Recorded because it will look like a bug to the first admin who meets it.

---

*Sections 1 and 2 above were written before the source tree was read for this ticket. Sections 3 to 8
were written after. Nothing in 1 or 2 was amended.*

---

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. Every decision is a policy, a column privilege or the
trigger — ADR-005. Nothing in `src/` is a control.

| Action | `member` | `admin` | Where the decision is made |
|---|---|---|---|
| Edit their own entry | ✅ | ✅ | policy `entry_update_own`, `using` and `with check` both `member_id = auth.uid()` |
| Delete their own entry | ✅ | ✅ | policy `entry_delete_own`, `using (member_id = auth.uid())` |
| Edit or delete another member's entry | ❌ | — | `entry_update_own` matches no row. **The admin's ✅ is CAL-03's**, and no policy here grants it |
| Change `member_id` on an edit | ❌ | ❌ | column privilege: `member_id` is not in the update grant |
| Set `status` or `rejection_reason` on an edit | ❌ | ❌ | column privilege: neither is in the update grant |
| Approve or reject | ❌ | — | no path exists. ADM-05 |

**The admin row above is deliberately a dash, not a tick.** `rbac-and-security.md` gives an admin ✅
on *Edit or delete another member's entry*, and this ticket does not deliver it. That is CAL-03's
row, and a reviewer comparing this section against the permission table will find one capability
short — correctly. Building it here would take CAL-03's policy early and would inherit its known
weakness 3 with it.

### Two refusals that are not errors, and one that is

**AC-9's refusal is filtered, not raised.** Under row-level security an UPDATE or DELETE that matches
no row returns HTTP 200 with an empty body — ADR-016 §4 behaviour 2, and the trap TEA-04's
`removeMember` already records. So the seam treats **zero rows returned as the refusal it is**;
treating `!error` as success would report a refusal as done. This is the single most likely defect in
this ticket and section 4 pins it in both functions.

**AC-8 and AC-10 are raised, loudly.** A statement naming an ungranted column is refused with
`42501 permission denied for column` before any policy runs, and reaches the browser as a 403.

**Interface-level gates are affordances and carry a comment saying so.** The own-entry list renders
edit and delete controls on every row it shows, and it shows only the caller's own rows because
`listOwnEntries` narrows the query — that narrowing is an affordance too. What stops a member editing
somebody else's entry is `entry_update_own`, not the absence of a button.

## 4. Contract

### 4.1 Seam additions — `src/lib/data/index.ts`

```ts
/** CAL-02, 01-plan.md section 4.1.
 *
 *  The same six fields as `CreateEntryInput`, and a SEPARATE interface rather than an alias. Two
 *  reasons: the two diverge the moment ADM-05 adds a decision path that updates `status` and creates
 *  nothing, and an alias would make `createEntry` and `updateEntry` look interchangeable to a caller
 *  who never reads the seam.
 *
 *  NO `memberId`, NO `status`, NO `rejectionReason`, NO `approvedBy`, NO `approvedAt`. Each is
 *  withheld from the update grant (section 6), so a field here would be a field the datastore
 *  refuses — and `memberId`'s absence is INV-07's control, not a convenience.
 *
 *  THIS IS A FULL REPLACEMENT OF THE SIX FIELDS, not a patch of the changed ones. A partial shape
 *  would make "the caller did not send `note`" and "the caller cleared `note`" the same request. */
export interface UpdateEntryInput {
  type: EntryType;
  portion: EntryPortion;
  startDate: string;   // yyyy-MM-dd
  endDate: string;     // yyyy-MM-dd, inclusive
  tentative: boolean;
  note: string | null;
}
```

Two functions on `DataSeam`:

```ts
  // -------------------------------------------------------------------------
  // CAL-02 — edit or delete their own entry. 01-plan.md section 4.1.
  // -------------------------------------------------------------------------

  /**
   * CAL-02 AC-1, AC-2, AC-5, AC-6, AC-7, AC-8, AC-10, AC-11, AC-12. Replaces the six substantive
   * fields of ONE entry belonging to the caller.
   *
   * `entryId` is an ADDRESS and not a permission surface — the shape `removeMember(memberId)` uses.
   * It names a row that `entry_update_own` then filters by owner.
   *
   * Expected failures are RETURNED, not thrown. Three codes, all three already in `FailureCode`
   * from CAL-01 — this ticket adds none:
   *   `overlapping_entry`   — INV-01's exclusion constraint, SQLSTATE 23P01, arriving as a 409
   *   `invalid_date_range`  — end before start, refused in the seam BEFORE the round trip (AC-11)
   *   `entry_not_permitted` — the policy filtered the row, or a withheld column privilege refused
   *                           the statement (42501 / 403)
   *
   * RETURNS THE UPDATED ROW, AND ZERO ROWS IS A REFUSAL. Under row-level security a refused UPDATE
   * is FILTERED rather than errored: it matches nothing and PostgREST answers 200 with an empty
   * body (ADR-016 section 4, behaviour 2). An `!error` check would report AC-9's refusal as success.
   *
   * `entry_not_permitted` deliberately covers BOTH "this entry is not yours" and "no such entry".
   * Under the policy the two are indistinguishable and must stay so — a distinct `not_found` would
   * turn this function into an oracle for which entry ids exist in the team.
   */
  updateEntry(entryId: string, input: UpdateEntryInput): Promise<Result<Entry>>;

  /**
   * CAL-02 AC-3, AC-4, AC-9. Hard-deletes ONE entry belonging to the caller. There is no soft
   * delete: `entry` carries no such column and the feature row settles that the row and its
   * `approved_by` disappear together.
   *
   * Returns `Result<void>`. **The real implementation must ask for the deleted representation and
   * count it** — a DELETE the policy filters answers 200 with an empty body exactly as an UPDATE
   * does, so zero rows deleted is `entry_not_permitted` and not success. This is AC-9's delete half
   * and it is the one an implementation is most likely to get wrong, because a delete has no
   * obvious return value to inspect.
   */
  deleteEntry(entryId: string): Promise<Result<void>>;
```

**No change to `src/lib/domain/types.ts`.** `Entry`, the three enums, and the three failure codes
`overlapping_entry`, `invalid_date_range` and `entry_not_permitted` all exist from CAL-01 and all
carry the right meaning here. The file is therefore absent from `allowed_paths` — section 7.

### 4.2 The failure mapping

Identical to CAL-01's, and that is the point: the same three refusals with the same three sentences,
so a member meets one message for one situation whichever screen they are on.

| Refusal | Reaches the browser as | Code |
|---|---|---|
| `entry_no_overlapping_portion` | `409`, SQLSTATE `23P01` | `overlapping_entry` |
| policy filtered the row — zero rows returned | `200`, empty body | `entry_not_permitted` |
| ungranted column named (`member_id`, `status`, `rejection_reason`) | `403`, SQLSTATE `42501` | `entry_not_permitted` |
| `entry_end_after_start` | `400`, SQLSTATE `23514` | `invalid_date_range` |

Matched on SQLSTATE, never on constraint name or message text.

### 4.3 The screens

**`src/components/EntryForm.tsx` — new, and it is an extraction rather than a second form.** The six
fields, their validation and their selectors move out of `NewEntry.tsx` unchanged and are used by
both routes. **CAL-01's eleven acceptance tests are the safety net and are not in `allowed_paths`**:
`new-entry-type`, `new-entry-portion`, `new-entry-start`, `new-entry-end`, `new-entry-tentative`,
`new-entry-note`, `new-entry-submit` and `new-entry-error` keep their names and their positions, so
`tests/e2e/cal-01-create-entry.spec.ts` must pass unedited. If the extraction breaks a selector,
that suite reports it.

The form takes its `data-testid` prefix as a prop, so the edit route renders `edit-entry-*` against
the same markup.

**`src/routes/EditEntry.tsx` — new, route `/entries/:id/edit`.** Guarded like `/entries/new`:
membership state `member`, otherwise `Navigate to="/"`.

| `data-testid` | What it is |
|---|---|
| `edit-entry-form` … `edit-entry-error` | the six fields, submit and error, mirroring `new-entry-*` |
| `edit-entry-status` | the entry's current status, carried as `data-status`, for AC-5 and AC-6 |
| `edit-entry-approved-by` | present only when the entry names an approver, for AC-5 and AC-6 |
| `edit-entry-not-found` | the screen when `listOwnEntries` holds no entry with that id — AC-9's read half, and it says nothing about whether the id exists |

**`src/routes/NewEntry.tsx`** gains two controls per row on the existing own-entry list, and changes
nothing else:

| `data-testid` | What it is |
|---|---|
| `own-entry-row-edit` | a link to `/entries/:id/edit` |
| `own-entry-row-delete` | the delete control |
| `own-entry-delete-confirm` | the confirmation. A hard delete with no undo gets one — `.ai/standards/ui-design-system.md` has a *Destructive actions* section, still a stub, so this is the plan's decision and not a citation |
| `own-entry-row-status` | the row's status, carried as `data-status` |

**The edit screen loads its entry from `listOwnEntries` and adds no seam read.** One function, one
policy path, and the entry a member may edit is by definition one of their own — so a
`getEntryById` would be a second read whose only distinct behaviour is answering about rows the
caller may not edit.

## 5. Seam impact

**Two functions added: `updateEntry` and `deleteEntry`.** No existing seam function changes
signature, return type or behaviour. Both appear in `index.ts`, `supabase.ts` and `mock.ts` with the
same names and arity, or `tests/seam-parity.test.ts` fails — that test follows the seam unedited and
is absent from `allowed_paths`.

**Parity is necessary and not sufficient, and the subtle shape here is the refusal.** Both
implementations must return `entry_not_permitted` for a row that is not the caller's. In
`supabase.ts` that is zero rows returned from a filtered statement; in `mock.ts` there is no policy
and the check is an explicit owner comparison. **A mock that simply edits any id it is given passes
parity, passes every happy-path test, and makes AC-9 untestable against the seam the end-to-end suite
actually drives** — BUG-001 pinned that suite to `mock`, so this is the implementation AC-9 is
observed against.

`mock.ts` also carries a second implementation of INV-01's overlap test (already there from CAL-01,
now reached on update) and of INV-02's reset. Both are acceptable only because the mock is not a
datastore anybody's data lives in, and both carry a comment naming the invariant and pointing at the
constraint and the trigger as the real mechanisms.

## 6. Schema delta

**Not `none`, and the feature row's closing `schema_delta` none is stale** — ADR-014, `ACCEPTED by
the operator`, with no carve-out for a policy. One new migration,
`supabase/migrations/20260903xxxxxx_cal02_own_entry_writes.sql`. Applying it is human — RULE-09.

Approved ADRs it rests on, all already accepted, **and no new ADR is written**: every decision below
sits inside an existing envelope.

- **ADR-005** — why the policies are the control and the seam is not.
- **ADR-014** — why this is not `none`.
- **ADR-016** — the function name, the trigger shape, and §*Consequences*, which assigns the column
  grant excluding `member_id` to this ticket by name.

What the migration contains:

1. **The update grant, and its column list is AC-8 and AC-10's control.**

   ```sql
   grant update (start_date, end_date, type, portion, tentative, note)
     on public.entry to authenticated;
   ```

   **This is narrower than the list ADR-016 §*Consequences* writes**, which also names `status` and
   `rejection_reason`, and the narrowing is deliberate rather than an oversight. **ADR-016's list
   assumes clauses (a) and (b) of `entry_enforce_decision()` exist. They do not.** CAL-01 shipped the
   function in its INV-02-only form — clause (c) alone — because nothing in that ticket approved,
   rejected or updated anything. Granting `status` now would hand every member the exact write
   ADR-016 exists to refuse, with no guard behind it: a member PATCHing `{"status":"approved"}`
   against their own row satisfies `entry_update_own` and nothing else looks.

   **So `status` and `rejection_reason` are granted by ADM-05, in the same migration that adds
   clauses (a) and (b).** That is one statement in a later ticket and it is written here so the
   later ticket does not have to rediscover why the column list was short. This narrows ADR-016's
   text and reverses none of its reasoning — the decision that `status` is admin-only is exactly
   what is being preserved.

   `member_id` is absent permanently. It is INV-07 and it is not ADM-05's to add either.

2. **`public.entry_enforce_decision()` replaced with `create or replace function`, gaining one line.**

   ```sql
   new.updated_at := now();
   ```

   **This ticket is the first that can update a row, so it is the first for which `updated_at` can be
   false.** `.ai/standards/data-model.md` declares the column `not null` and CAL-01 gave it
   `default now()`, which is correct at insert and never moves again on its own. An entry whose
   `updated_at` equals its `created_at` after three edits is a false record of the same kind INV-02
   exists to prevent, and AC-12 is what observes it.

   **It goes inside the existing function, not into a second trigger.** ADR-016 §*Consequences*
   records that PostgreSQL fires same-event triggers alphabetically by name, so a second
   `BEFORE UPDATE` trigger on `entry` would make the guard's correctness depend on spelling. One
   function keeps the order explicit; adding a line to it is the cheap direction.

   **Clause (c) must come through the replacement character-identical.** The replacement is a whole
   function body, so a reviewer diffing the migration sees a new file rather than a change — R8 must
   read clause (c) against `20260903103000_cal01_entry.sql` line by line. The new line is placed
   **before** clause (c), so an edit that trips the INV-02 reset still records its own timestamp.

   **Note for ADM-05:** this function now has two responsibilities, and ADM-05 replaces it a third
   time. Its version must carry clause (c) *and* the `updated_at` line, in addition to the clauses
   (a) and (b) it adds.

3. **The update policy.**

   ```sql
   create policy entry_update_own on public.entry
     for update to authenticated
     using (member_id = (select auth.uid()))
     with check (member_id = (select auth.uid()));
   ```

   `using` sees the OLD row and decides which rows the caller may touch — AC-9. `with check` sees the
   NEW row and refuses a reassignment — AC-8's second lock, **redundant while `member_id` is
   ungranted and kept anyway**, exactly as TEA-04's `member_update_admin` keeps its own. If a later
   ticket ever grants that column, this policy already refuses the move.

   `to authenticated`, never `to public`, or the anon key that ships in the bundle re-opens the
   table.

4. **The delete policy.**

   ```sql
   create policy entry_delete_own on public.entry
     for delete to authenticated
     using (member_id = (select auth.uid()));
   ```

   No `with check` — a delete has no new row. **A hard delete needs no grant beyond this**, because
   `revoke all` was table-wide in CAL-01 and `delete` is a table-level privilege with no column form;
   the migration therefore also carries `grant delete on public.entry to authenticated;` beside the
   policy. Both are required and neither alone is sufficient — the trap TEA-01 recorded and ADR-016
   §*Consequences* calls the third finding of the same shape.

5. **No `insert` policy change, no constraint change, no enum change, no new column.**

`ticket.yaml`'s `schema_delta` is rewritten to link the three ADRs above and `requires_adr` is set to
`true`, correcting the `false` the shell carried beside a non-`none` `schema_delta`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260903*_cal02_own_entry_writes.sql"
  - "supabase/seed.sql"
  - "src/lib/fixtures.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/components/EntryForm.tsx"
  - "src/routes/NewEntry.tsx"
  - "src/routes/EditEntry.tsx"
  - "src/App.tsx"
  - "tests/e2e/cal-02-edit-delete-entry.spec.ts"
```

Eleven globs, eleven files; three are new — the migration, `src/components/EntryForm.tsx` and
`src/routes/EditEntry.tsx`. `src/components/` does not exist yet; `.ai/standards/architecture.md`
names *component* as a layer that may import components, hooks and domain types, so the directory is
sanctioned rather than invented.

**`size`: M, agreeing with `size_estimate` in section 1.** ADR-012 is not engaged and nothing splits.
Eleven is one below the twelve TEA-05 treated as M's ceiling. Both numbers were reached the same way
and by the same agent, so the agreement is weak evidence; what makes it M rather than L is that the
migration adds no object a later ticket must reason about — two policies, one grant, one line in an
existing function.

**`supabase/seed.sql` and `src/lib/fixtures.ts` are in the list for one reason: AC-5 and AC-6 need an
`approved` entry, and nothing in the product can create one.** The insert grant excludes `status`,
this ticket's update grant excludes it too, and ADM-05 does not exist — so the only way an approved
entry can exist for a test to edit is for a human to seed it. The fixture is the shared module both
the seed and the mock read, per `.ai/standards/testing-standards.md`.

**Deliberately absent, each with its reason:**

- `src/lib/domain/types.ts` — nothing is added. `Entry`, the enums and the three failure codes all
  exist from CAL-01 and carry the right meaning (section 4.1).
- `tests/e2e/cal-01-create-entry.spec.ts` — **it is the safety net for the `EntryForm` extraction and
  must pass unedited** (section 4.3). Editing it to accommodate a broken selector would remove the
  only thing checking the refactor.
- `tests/seam-parity.test.ts` — follows the seam without an edit.
- `tests/e2e/smoke.spec.ts`, `tea-01-signup.spec.ts`, `tea-05-sign-in.spec.ts` — untouched.
- `supabase/migrations/20260903103000_cal01_entry.sql` — **a shipped migration is never edited.** The
  function change is a `create or replace` in this ticket's own file.
- `.ai/standards/data-model.md` — its *Where invariants are held* rows are now citable to real
  migrations and constraint names, which its own `TODO(project)` asks for. Standards plane, RULE-01,
  **owed a human edit and not made here.**

## 8. Rejected alternatives

**1. A `PATCH` of only the changed fields, rather than a full replacement of the six.** Genuinely
plausible and it is what a REST instinct reaches for: it sends less, it makes a note-only edit
obviously a note-only edit, and it maps directly onto INV-02's carve-out — the trigger already
distinguishes a note change from a substantive one, so a partial payload would let the client say
which kind of edit it is making. It is rejected because **the client does not get to say.** INV-02's
carve-out is decided by comparing OLD and NEW inside the trigger, actor-blind and payload-blind; a
partial shape would create a second place where "is this substantive" is answered, and the two would
agree until somebody changed one. It also makes *"the caller omitted `note`"* and *"the caller
cleared `note`"* the same request unless the DTO grows a tri-state, which is a type nobody wants in a
form. A full replacement is one shape, and the trigger stays the only judge of what an edit means.

**2. A second `BEFORE UPDATE` trigger for `updated_at`, leaving `entry_enforce_decision()`
untouched.** Plausible and tidier on the face of it: a timestamp touch has nothing to do with
approval, the two concerns are unrelated, and not replacing a shipped function means no risk of
mistranscribing clause (c). Rejected because ADR-016 §*Consequences* names exactly this as the trap —
PostgreSQL fires same-event triggers **alphabetically by name**, so `entry_enforce_decision` and, say,
`entry_touch_updated_at` would have their order settled by spelling, and the next person to add a
third would inherit the problem invisibly. ADR-016 calls the one-function property "what makes the
order explicit", and spending it on a timestamp is the cheapest possible reason to lose it. The
transcription risk is real and is answered by making R8 read clause (c) line by line (section 6).

**3. Building CAL-03's admin path in the same ticket, since it is one more policy.** Superficially
strong: `entry_update_own` and an admin policy are two `create policy` statements in one migration,
the screens are the same screens, and shipping them together would avoid a second pass over
`EntryForm.tsx`. Rejected because the admin path is not one more policy — it is
`rbac-and-security.md` known weakness 3, *"an admin may edit any member's entry, and v1 records no
trace of it"*, which the charter amendment of 2026-08-31 treats as a change to what the product is.
That belongs to a ticket whose Out-of-scope and acceptance criteria are written about it, not to one
where it would arrive as an implementation detail. The registry keeps them as separate rows for this
reason, and the file list would push this ticket past M.

## Changelog

- `2026-09-03T11:55:53+07:00` — sections 1 to 8 written. Sections 1 and 2 written before the source
  tree was read; nothing in either was amended afterwards. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
