---
ticket: ADM-03
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-05T10:11:08+07:00
inputs_read:
  - .ai/board/tickets/ADM-03/ticket.yaml
  - .ai/board/tickets/ADM-02/01-plan.md
  - .ai/board/ideas/2026-08-31-everyone-computes-the-bridge-day-alone.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md
  - .ai/registry/decisions/ADR-020-the-admin-write-path-on-member.md
  - .ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md
  - .ai/01-operating-model.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - supabase/db.sql
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260901090000_tea02_allow_list_writes.sql
  - supabase/migrations/20260905120000_adm02_holiday.sql
  - supabase/migrations/20260905120100_adm02_holiday_seed.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/components/EntryForm.tsx
  - src/routes/Holidays.tsx
  - src/routes/AllowList.tsx
  - src/routes/Home.tsx
  - src/App.tsx
  - tests/e2e/adm-02-holidays.spec.ts
  - tests/threshold.test.ts
  - ui-language.json
  - eslint.config.js
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# ADM-03 — Add, edit or delete a holiday or swap day

## 1. Problem and scope

**Feature ID: ADM-03.** Transcribed from `.ai/registry/features.md` without paraphrase:

> | ADM-03 | Add, edit or delete a holiday or swap day | ADM | PLANNED | [] |

ADM-02 made the calendar exist and be readable, and left it unwritable by everybody — no insert,
update or delete policy ships on that branch, so the calendar can only ever hold what a human put in
the seed migration. This row makes it **editable by an admin**, which is what the government's annual
announcement requires: swap days are announced each year and a correction to a seeded date is the one
piece of knowledge in this table that no migration could have supplied. `on conflict (date) do
nothing` in ADM-02's seed exists precisely to protect the edits this ticket makes possible.

The title is the permission row transcribed without paraphrase — *Add, edit or delete a holiday or
swap day*, member ❌, admin ✅. **One power, three policies**, because PostgreSQL has no single
`for write`.

**Out of scope.**

- **Bridge-day detection and any shading in the calendar views.** ADR-015 § 4's three-input pure
  module is CAL-08's, and its central definition — what *sandwiched* means for a run longer than one
  day — is an open question with the operator. Nothing in this ticket computes it, and no view file
  is in `allowed_paths`.
- **Holiday suppression of the crowded-day warning.** The ADM-03 registry row says this in terms:
  *"This row must not implement holiday-suppression of the crowded-day warning."* A Saturday on which
  four people declared PTO stays crowded as far as CAL-07 is concerned. `src/lib/draft-entry.ts`,
  `src/components/OverloadWarning.tsx` and `src/lib/data/absence.ts` are all absent from
  `allowed_paths`.
- **Any change to who may read the calendar.** `holiday_select_all` and `grant select` shipped with
  ADM-02 and are not touched. Reading stays ✅ / ✅.
- **A second surface.** The controls go on `/holidays`, the screen ADM-02 shipped. The surface
  question was ADM-01's `TODO(project):` and the ADM-03 registry row says it is *inherited*, so there
  is no new route and no admin settings area invented here.
- **Seeding, importing or bulk entry.** One row at a time through a form. The several-years seed is
  ADM-02's data migration and stays a human's file.
- **Any audit trail.** `holiday` carries `created_at` only — no `created_by`, no `updated_at` — so v1
  keeps no trace of which admin entered or changed a national date. The ADM-02 registry row records
  this as a known weakness of the same shape as ADM-01's and as known weakness 3 in
  `rbac-and-security.md`, and it is not closed here: adding the columns is a schema change nobody has
  asked for.
- **Restoring a deleted row.** The delete is hard and there is no trash. Re-applying ADM-02's seed
  migration re-inserts a seeded row that was deleted, because `on conflict (date) do nothing` only
  skips rows that are present — that is a property of the seed rather than an undo offered here.
- **`supabase/db.sql`.** Not touched. It already carries these four objects marked `[OWED] ADM-03`,
  and Open question 3 records what that leaves stale.

`size_estimate`: **M**. One migration of four objects, three seam writes, one extracted form and one
screen that gains three controls — but no new table, no new read, and no arithmetic anywhere.

## 2. Acceptance criteria

Throughout: `kind` is `non_working` or `working`, and the values name **the effect on the working
calendar, not the Vietnamese label**. A `nghỉ bù` compensatory day off is `non_working`; a `làm bù`
mandated Saturday is `working` — a weekend day that counts as a working day, the exact inverse of a
holiday (ADR-015 § 2).

### Adding

**AC-1 — an admin adds a holiday**
- Given a signed-in admin on the holiday screen showing a year
- When they enter a date in that year, a name and the kind `non_working`, and save
- Then the row is stored, the screen shows it in the list, and re-opening the year shows it still
  there.

**AC-2 — an admin adds a mandated working Saturday**
- Given a signed-in admin on the holiday screen
- When they add a row with the kind `working`
- Then the row is stored with that kind, and the screen presents it as a working day rather than as a
  non-working one.

**AC-3 — the kind is a required choice with a stated default**
- Given the add form at rest
- When it is opened
- Then a kind is already selected, it is `non_working`, and the control offers both values with
  labels that say the effect on the working calendar rather than repeating the row's name.

**AC-4 — a row added outside the displayed year is not silently lost**
- Given an admin on the holiday screen showing 2026
- When they add a row dated in 2027 and save
- Then the save succeeds and the screen says the row was added to 2027 and offers a way to go there —
  it does not simply return to a 2026 list the new row is not in.

**AC-5 — an empty name or a missing date is refused before any write**
- Given the add form
- When the name is blank or whitespace only, or the date is empty, and save is pressed
- Then the screen says what is required, no write is issued, and nothing is stored.

### The constraint a person meets

**AC-6 — a second row for a date already in the calendar is refused with something the admin can act
on**
- Given a date that already carries a holiday row
- When an admin tries to add another row for that same date
- Then the save is refused, the screen names that date and says a row for it already exists, and it
  does not show a database error. `unique (date)` makes *the status of date D* a function rather
  than a query, which the bridge-day derivation depends on.

**AC-7 — moving a row onto an occupied date is refused the same way**
- Given two rows on two different dates
- When an admin edits one of them onto the other's date and saves
- Then the save is refused with the same message as AC-6, and both rows are unchanged.

### Editing

**AC-8 — an admin corrects a row's date, name and kind**
- Given an existing row
- When an admin edits it and saves
- Then the stored row carries the new values, the list shows them, and no second row was created.

**AC-9 — the edit form opens carrying the row's current values**
- Given an existing row
- When an admin opens it for editing
- Then the date, the name and the kind on screen are that row's, not blank and not defaults.

**AC-10 — editing one row leaves every other row alone**
- Given a year holding several rows
- When one of them is edited
- Then the others are unchanged in every field.

### Deleting

**AC-11 — deleting takes two presses, and the confirmation names the date and the label**
- Given an existing row
- When an admin presses delete
- Then nothing is removed yet and a confirmation appears naming **both** that row's date and its
  name; and when the confirmation is accepted, the row is gone from the list and from the datastore.

**AC-12 — a delete can be abandoned**
- Given a confirmation showing
- When it is dismissed
- Then the row is still present and unchanged.

**AC-13 — only the confirmed row is deleted**
- Given a year holding several rows
- When one is deleted
- Then exactly that row is gone and the others remain.

### Permission

**AC-14 — a member is offered no control**
- Given a signed-in member whose role is `member`
- When the holiday screen is opened
- Then the calendar is shown in full and no add form, no edit control and no delete control is
  rendered.

**AC-15 — a member's write is refused below the interface**
- Given a member whose role is `member`
- When a holiday insert, update or delete is issued with that member as the caller, bypassing every
  interface control
- Then nothing is stored, nothing is changed, nothing is removed, and the caller is told the write
  was not permitted.

**AC-16 — a removed member is refused whatever their role says**
- Given a caller whose member row carries a `removedAt` and whose role is `admin`
- When any of the three writes is issued with that caller
- Then it is refused.

**AC-17 — the permission table gains no row**
- Given `.ai/standards/rbac-and-security.md`
- When it is compared before and after this ticket
- Then it is unchanged. *Add, edit or delete a holiday or swap day* already exists and is one row
  for one power.

**AC-18 — reading is unchanged for everybody**
- Given a member, an admin, and a signed-in caller with no member row
- When each opens the holiday screen
- Then all three see the same rows in the same order, exactly as they did before this ticket.

**Invariants touched: `[]`.**

Written explicitly rather than left absent, and the reason is recorded rather than left to read as an
oversight — the ADM-03 registry row says `[]` *"for the same reasons recorded on ADM-02"*, and those
reasons are unchanged by adding writes. **A holiday is not an entry.** INV-04 is a sum over entries
and this table has none; INV-01, INV-02 and INV-03 all constrain `entry`; INV-05 is the tentative
flag and INV-06 an entry's portion, and this table has neither column. **INV-07 is again the one
worth naming and again does not hold**: it constrains entries and the members they belong to, and a
holiday row has neither — which is the same step ADR-015 § *Rationale* examined and refused when it
was offered as the case for a `team_id`.

`unique (date)` is load-bearing and is **not** an invariant in the registry's sense: it is a
uniqueness constraint on one table, it carries no ID in `invariants.md`, and inventing one for it is
exactly what `CLAUDE.md` § *Working agreements* forbids. AC-6 and AC-7 hold it as behaviour.

**Open questions.** None blocking.

1. **Assumption that ships — the write grant is table-wide, not column-scoped, and that is
   transcription rather than a decision made here.** ADR-015 § 3 writes
   `grant insert, update, delete on public.holiday to authenticated` out in full with no column list,
   `supabase/db.sql` transcribes it that way under ADR-026, and this migration matches both. It is
   worth one paragraph because it looks like an inconsistency beside TEA-04's
   `grant update (role, removed_at) on public.member` and ADM-01's
   `grant update (overload_threshold) on public.team`, both of which are column-scoped. **It is not
   the same case.** A column grant exists to withhold a column from *everybody* — `member.team_id`,
   `team.name` — and on `holiday` there is no such column: an admin may legitimately write `date`,
   `name` and `kind`, which is every substantive column the table has. What the blanket grant also
   admits is `id` and `created_at`, so an admin's client could name either. Neither carries a
   permission row anywhere and neither is read by any feature, so the exposure is a falsified
   creation timestamp rather than an escalation. Narrowing it would mean writing a statement that
   disagrees with an accepted ADR and with the file the operator runs, which is the operator's call
   and not this plan's.
2. **Assumption that ships — the controls live on `/holidays` and editing is inline.** The registry
   row says the surface's shape is ADM-01's answer *inherited*, which is *its own screen*, and
   ADM-02 shipped that screen. Editing expands the row in place rather than routing to
   `/holidays/:year/:id/edit`, on the precedent of `src/routes/AllowList.tsx` and the own-entry list,
   both of which put a destructive confirmation inline beside the row it acts on. Reversing it later
   is one route and one component move.
3. **Not blocking, and outside this ticket — `supabase/db.sql` goes stale again.** It carries these
   four objects marked `[OWED] ADM-03 — no migration exists for these three yet`, which stops being
   true at this ticket's `/ship`, and its § 9 block will then describe a schema that is two tickets
   behind. ADR-026 decision point 6 is explicit that applying `db.sql` does not discharge a
   migration, and it assigns nobody the job of keeping the `[OWED]` markers current. CAL-04, ADM-01
   and ADM-02 each left the same gap. Named here rather than fixed, on that precedent.
4. **Recorded, not written — `glossary.md`'s *Holiday* row still conflates `nghỉ bù` with `làm bù`.**
   ADR-015 § *Consequences* found it and could not fix it: the row reads *"a public non-working day
   in Vietnam, plus the swap and compensatory days the government announces each year"*, which is
   right for the compensatory day off and the exact inverse for the mandated working Saturday. This
   is the ticket where an admin picks between those two values in a form, so it is the ticket where
   the wrong definition would do damage. A glossary row is a human's edit under RULE-01. AC-3
   contains the mitigation this plan can make: the control's labels say the **effect**, so the person
   choosing does not have to resolve the glossary's ambiguity to get it right.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

Checked before writing: `.ai/board/tickets/ADM-03/design/` does not exist, no image is attached
anywhere under `.ai/board/`, and the idea this row was promoted from
(`.ai/board/ideas/2026-08-31-everyone-computes-the-bridge-day-alone.md`) carries none.

The arrangement in section 4.4 is originated here and is deliberately borrowed twice over: the
add-and-list shape is `src/routes/AllowList.tsx`'s, and the two-press delete with an inline
confirmation is the one both that screen and the own-entry list already ship. The one thing that is
genuinely a decision — that the confirmation names the row's **date and its name**, rather than
asking *"Are you sure?"* — is AC-11, and it is an acceptance criterion because
`.ai/standards/ui-design-system.md` § *Destructive actions* says in terms that *"Are you sure?" names
nothing and is not a confirmation*, while its list of destructive actions is still `TODO(project):`.

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. **No row is added, changed or removed** — AC-17. This
ticket implements the second of the two rows that already exist for this table.

| Permission | member | admin | Where it is enforced |
|---|---|---|---|
| `Read the holiday calendar` (line 38) | ✅ | ✅ | `holiday_select_all` and `grant select` — **ADM-02, untouched** |
| `Add, edit or delete a holiday or swap day` (line 39) | ❌ | ✅ | `holiday_insert_admin`, `holiday_update_admin`, `holiday_delete_admin`, plus `grant insert, update, delete` — **this ticket** |

**The denials, stated as denials.**

- **A member may not add, edit or delete any holiday row.** All three policies require
  `public.is_admin((select auth.uid()))`, and on this table that is the *whole* predicate — there is
  no team to also match, because the calendar is national. AC-15.
- **A removed member writes nothing, whatever their `role` column says.** `public.is_admin` filters
  `removed_at is null` inside its own body
  (`supabase/migrations/20260831150024_tea01_membership.sql:54-62`), so a removed caller resolves to
  `false`. AC-16, inherited from the helper rather than restated in three policies.
- **`anon` writes nothing.** All three policies are `to authenticated`, never `to public` — a policy
  written `to public` re-opens the table to the anon key, which ships in the browser bundle by
  design.
- **Nobody may write two rows for one date**, admin included. That is `unique (date)`, which ADM-02's
  migration already created; this ticket adds no constraint and translates the refusal into a
  sentence. AC-6, AC-7.
- **`public.is_admin(uuid)` needs no grant here**, and adding one would be the redundant-grant trap —
  it reads as a control and is not one. TEA-01's migration already does
  `grant execute on function public.is_admin(uuid) … to authenticated` at line 71 of the file above,
  verified on disk. It is `security definer`, so a policy on `holiday` may consult `member` without
  recursing through `member`'s own policies.

**The asymmetry with every other write policy in this schema, stated so a reviewer reads it as
intended.** `entry_update_admin`, `member_update_admin` and `team_update_admin` all carry a second
conjunct scoping the row to the caller's own team. These three carry none, and cannot: `holiday` has
no `team_id`. ADR-015 § *Rationale* records the consequence in terms — at the brief's P2 multi-team
point, **any admin of any team can rewrite everybody's Tết** — and accepts it as a blast-radius cost
rather than a scoping one, because there is one team. This ticket is where that decision becomes
executable code, which is why it is repeated here rather than only cited.

**Where the check runs.** On the server side of the boundary, always. Under ADR-005 the browser
speaks to PostgREST directly, so the three policies and the grant *are* the control. Hiding the
controls from a member (AC-14) is an affordance, and AC-15 exists to prove that removing the
affordance changes nothing.

## 4. Contract

### 4.1 The failure code — `src/lib/domain/types.ts`

One union member added to `FailureCode`. Nothing existing changes shape, and no exhaustive `switch`
or `Record<FailureCode, …>` exists anywhere in `src/` — checked — so no caller must change. This is
the same addition CAL-01 made when it added three codes at size M, and it is not the *"changes a
shared type module"* clause of `.ai/01-operating-model.md:375`, whose stated test is whether existing
callers must change.

```ts
// ADM-03, 01-plan.md section 4.3. AC-6, AC-7: `unique (date)` refused the write (SQLSTATE 23505).
//
// NOT `already_allow_listed`, which is the other 23505 this seam maps and whose message names an
// email address. One code carrying two sentences is how a wrong message reaches a screen — the
// reason CAL-01 gave for `entry_not_permitted`, applied to the constraint rather than to the policy.
| "holiday_date_taken"
```

**No `holiday_not_permitted`.** The policy refusal maps to the existing `not_permitted` with a
message written at its own call site, which is what `removeMember`, `promoteMember` and ADM-01's
`setOverloadThreshold` all do. The distinction from CAL-01's case is that those messages are
per-call-site strings rather than one shared constant.

### 4.2 The seam — `src/lib/data/index.ts`

Three functions and two input types added. `listHolidays` is unchanged.

```ts
/** ADM-03 AC-1, AC-2, AC-5. The three columns an admin may set. `id` and `created_at` are the
 *  datastore's — see 01-plan.md Open question 1 on why the grant does not withhold them. */
export interface AddHolidayInput {
  date: string; // yyyy-MM-dd
  name: string; // already trimmed; the screen refuses blank before calling (AC-5)
  kind: HolidayKind;
}

/** ADM-03 AC-7, AC-8. The same three fields: an edit may move the date, correct the label and flip
 *  the effect. It is a separate type from `AddHolidayInput` although the shape matches today, for
 *  the reason `CreateEntryInput` and `UpdateEntryInput` are separate — the two writes answer to
 *  different policies and will not stay identical. */
export interface UpdateHolidayInput {
  date: string;
  name: string;
  kind: HolidayKind;
}
```

```ts
// Added to `interface DataSeam`, after `listHolidays`.

/**
 * ADM-03 AC-1, AC-2, AC-6, AC-15, AC-16. Adds one row. Admin only; `holiday_insert_admin` is the
 * control and this function is the affordance.
 *
 * NO TEAM PARAMETER AND NO TEAM SCOPE, for the reason `listHolidays` already records: the calendar
 * is national and there is nothing to narrow.
 *
 * Returns the stored row. `.select()` is not a convenience: under row-level security a refused
 * INSERT is refused with `42501` rather than filtered, but a refused UPDATE or DELETE is FILTERED —
 * so the three functions here do not share one success test, and the two below say what theirs is.
 */
addHoliday(input: AddHolidayInput): Promise<Result<Holiday>>;

/**
 * ADM-03 AC-7, AC-8, AC-10, AC-15, AC-16. Replaces the three writable columns of one row.
 *
 * ZERO ROWS RETURNED IS A REFUSAL, not a success. Under row-level security a refused UPDATE matches
 * nothing and PostgREST answers 200 with an empty body — the shape `removeMember`, `promoteMember`
 * and `setOverloadThreshold` all document. Treating `!error` as success would report a member's
 * refused edit as done (AC-15).
 */
updateHoliday(holidayId: string, input: UpdateHolidayInput): Promise<Result<Holiday>>;

/**
 * ADM-03 AC-11, AC-13, AC-15, AC-16. Removes one row. Hard delete: nothing references `holiday`,
 * there is no cascade anywhere in this model, and there is no trash.
 *
 * RETURNS THE DELETED ROW'S EXISTENCE AS ITS SUCCESS TEST, for the reason `deleteEntry` records: a
 * refused DELETE is filtered, matches nothing, and answers 200 with an empty body. Zero rows is
 * `not_permitted` and not a completed delete.
 */
deleteHoliday(holidayId: string): Promise<Result<void>>;
```

### 4.3 The two implementations

```ts
// src/lib/data/supabase.ts — the shapes, exactly.

// AC-1. `.select(HOLIDAY_COLUMNS).single()` — a refused insert errors with 42501 rather than
// returning zero rows, so `single()` is safe here and is not on the two below.
await client().from("holiday").insert({ date, name, kind }).select(HOLIDAY_COLUMNS).single();

// AC-8. Array form, because zero rows is the refusal.
await client().from("holiday").update({ date, name, kind }).eq("id", holidayId)
  .select(HOLIDAY_COLUMNS).returns<HolidayRow[]>();

// AC-11. Array form, same reason.
await client().from("holiday").delete().eq("id", holidayId)
  .select(HOLIDAY_COLUMNS).returns<HolidayRow[]>();
```

**A third error mapper, `toHolidayFailure`, and it is a third one rather than three more cases in an
existing one.** `src/lib/data/supabase.ts` already carries `toPostgrestFailure` and `toEntryFailure`
side by side, and the comment above the second one states the rule this follows: two tables answer
the same SQLSTATE with different sentences, and one function returning both would be the wrong
message on one of the two screens. Here `23505` means *this date already has a row* where on
`allowed_email` it means *this address is already listed*.

| SQLSTATE | Code | What the sentence must carry |
|---|---|---|
| `23505` | `holiday_date_taken` | the date, named (AC-6, AC-7) |
| `42501`, `PGRST301` | `not_permitted` | that the calendar is an admin's to change |
| anything else | `unknown` | — |

**Matched on the SQLSTATE, never on the constraint name or the message text**, which is the rule
`toEntryFailure` already records: a name match breaks silently the day a constraint is renamed, and
PostgREST's wording is not a contract.

**The mock reproduces the policy, not the screen.** `src/lib/data/mock.ts` holds
`const holidays: Holiday[]` seeded from `FIXTURE_HOLIDAYS`; all three writes go through the existing
`currentAdmin()` helper, which already filters `removedAt === null` and `role === "admin"` — so
AC-15 and AC-16 are inherited rather than written twice — and all three check the date for a
duplicate before writing, returning `holiday_date_taken`. The acceptance suite drives the mock
(BUG-001), so a mock that were permissive where the policies are not would make AC-14, AC-15 and
AC-16 pass against nothing.

### 4.4 The form — `src/components/HolidayForm.tsx` (new)

Three fields — date, name, kind — used **twice on one screen**: once as the add form and once inline
in whichever row is being edited. It is a component and not two copies for the reason CAL-02 gave
when it extracted `EntryForm` out of `NewEntry`: two forms would be two places where *"a blank name
is refused"* and *"the default kind is `non_working`"* are decided, and the two would agree until
somebody changed one.

```ts
export interface HolidayFormValues {
  date: string;
  name: string;
  kind: HolidayKind;
}

export interface HolidayFormProps {
  /** `holiday-add` or `holiday-edit`. Every selector below is this prefix plus a suffix, the shape
   *  EntryForm already uses for its three call sites. */
  testIdPrefix: string;
  submitLabel: string;
  submittingLabel: string;
  initial: HolidayFormValues;
  /** `clear` on the add form, `keep` on the edit form — EntryForm's own vocabulary. */
  afterSubmit: "clear" | "keep";
  /** Null on success; the failure to render otherwise. The sentence is produced in the seam and
   *  rendered verbatim, so a SQLSTATE can never reach the screen. */
  onSubmit(values: HolidayFormValues): Promise<Failure | null>;
  /** The edit form's way out. Absent on the add form. */
  onCancel?: () => void;
}
```

**The kind control's labels say the effect, not the label** (AC-3): *Not a working day* and *A
working day*, which are exactly the two strings `src/routes/Holidays.tsx` already renders per row as
`EFFECT_LABEL`. **One definition, imported rather than copied**, so the form and the list cannot
disagree about what `working` means — which is the confusion ADR-015 § 2 names and Open question 4
says the glossary still carries.

**The map moves INTO this file and the screen imports it — corrected 2026-09-05.** This section first
said the opposite, that `HolidayForm.tsx` imports `EFFECT_LABEL` from `Holidays.tsx`. That direction
is unbuildable: the screen imports the form, so the form importing the screen is a circular import.
The direction here is also the one the repository already uses —
`src/components/EntryForm.tsx` exports `TYPE_LABELS` and `PORTION_LABELS`, and
`src/routes/NewEntry.tsx` imports them, for the reason CAL-02 recorded when it extracted the
component: the labels belong with the control that offers the choice, and the list renders the same
two strings rather than owning them. The property this section was buying is unchanged — there is
still exactly one definition — and only the arrow reverses.

**Validation happens before the call (AC-5).** A blank or whitespace-only name and an empty date each
render the form's own message and issue nothing. `name` is trimmed on the way out, the way
`EntryForm` already trims `note`.

### 4.5 The screen — `src/routes/Holidays.tsx`

The read path, the year navigation, the empty-year notice and the failure phase are **unchanged**.
What is added:

- **`seam.getCurrentMember()` on mount, for the role and nothing else.** ADM-02's file comment says
  this screen *"deliberately"* does not call it; the reason it gives is that *"you are not on a team"*
  is not a true thing to say about a national calendar — which is about the **not-on-a-team phase**,
  and that phase is still not added here. A caller with no member row keeps reading the calendar and
  is simply offered no controls, which is what AC-14 and AC-18 require together.
- **The add form** above the list, rendered only for an admin. `testIdPrefix="holiday-add"`.
- **Two controls per row**, rendered only for an admin: `holidays-row-edit` and
  `holidays-row-delete`.
- **The inline edit**, which replaces that row's contents with `HolidayForm` under
  `testIdPrefix="holiday-edit"`. One row at a time — the editing row is held as an **id and not a
  boolean**, the reason `NewEntry.tsx` records for its own confirmation state: a boolean plus a
  separate id is two pieces of state that can disagree.
- **The delete confirmation**, inline in the row, `holidays-row-delete-confirm` with `-accept` and
  `-cancel`. **It names the date and the name** (AC-11).
- **The out-of-year notice** (AC-4): after a successful add whose date falls outside the displayed
  year, `holidays-added-elsewhere` says which year the row went to and links there. Without it the
  row is saved and then invisible, which reads as a save that failed.

| Element | `data-testid` | Shown when |
|---|---|---|
| add form | `holiday-add-form`, `-date`, `-name`, `-kind`, `-submit`, `-error` | admin |
| row edit control | `holidays-row-edit` | admin, row not being edited |
| row delete control | `holidays-row-delete` | admin, row not being confirmed |
| inline edit form | `holiday-edit-form`, `-date`, `-name`, `-kind`, `-submit`, `-cancel`, `-error` | admin, this row is being edited |
| delete confirmation | `holidays-row-delete-confirm`, `-accept`, `-cancel` | admin, this row is being confirmed |
| out-of-year notice | `holidays-added-elsewhere` | after AC-4's add |

Existing selectors keep their names and positions — `holidays-list`, `holidays-row`,
`holidays-row-date`, `holidays-row-name`, `holidays-row-effect`, `holidays-beyond-calendar`,
`holidays-year`, `holidays-prev`, `holidays-next`, `holidays-back`, `holidays-loading`,
`holidays-unavailable`.

**That is not enough to make `tests/e2e/adm-02-holidays.spec.ts` pass unedited, and the first version
of this plan claimed it was. Corrected 2026-09-05 — see the Changelog and § 7.** Selector stability
is necessary and not sufficient: that suite also carries **negative** assertions. Its AC-13,
*"the calendar is not writable by anybody, admin included"*, signs in as `FIXTURE_ADMIN` and asserts
zero buttons, zero textboxes and zero forms on this screen, and its header explains ADM-02's
unasserted AC-5 by saying *"Nothing in the product can insert a holiday at all on this branch"*.
ADM-03 AC-1, AC-3, AC-5, AC-8 and AC-11 each require one of those three controls, for that caller, on
that screen. **No implementation satisfies both**, and the file is therefore in `allowed_paths` under
the narrow instruction in § 7.

**ADM-02's AC-13 was true and is now superseded rather than broken.** ADM-02's own plan says in terms
that *"ADM-03 ships the write half"*, its migration comment says the same, and the whole point of
splitting the read path from the write path is that the first ships a calendar nobody can change.
Retiring that assertion here is the split completing, not a regression.

## 5. Seam impact

Three functions added: `addHoliday`, `updateHoliday`, `deleteHoliday`. Each appears in
`src/lib/data/index.ts`, `src/lib/data/supabase.ts` and `src/lib/data/mock.ts` with the same name and
the same arity, or `tests/seam-parity.test.ts` fails. That test is deliberately **not** in
`allowed_paths`: it must pass unedited with the three added.

**No existing seam function changes signature or behaviour.** `listHolidays` is untouched, so
`.ai/01-operating-model.md:375`'s XL clause is not engaged.

**No pure module and no arithmetic.** ADR-015 § 4's bridge-day derivation is CAL-08's, and
`src/lib/data/absence.ts` is untouched — a holiday is not an entry, and suppressing CAL-07's warning
on a holiday is a thing the ADM-03 registry row forbids this row in terms.

## 6. Schema delta

**NOT `none`**, although it adds no column and no table. ADR-014, `ACCEPTED by the operator`, settles
that a migration creating a row-level security policy is not `none` — under ADR-005 the policy *is*
the entire authorization model. **ADR-015 is linked**, and **no new ADR is authored**: every statement
below is transcribed from its § 3, and `supabase/db.sql` already carries the same four objects marked
`[OWED] ADM-03` under ADR-026 decision point 2, which admits an object only when an accepted ADR
writes it out in full.

One new migration, `supabase/migrations/20260905140000_adm03_holiday_writes.sql`. It creates no
table, no enum, no column, no constraint and no function.

```sql
-- ADM-03. The WRITE half of `public.holiday`. Applying this file is human (RULE-09).
--
-- Transcribed from ADR-015 section 3, which is ACCEPTED. supabase/db.sql carries the same four
-- statements marked `[OWED] ADM-03`; ADR-026 decision point 6 says applying that file does NOT
-- discharge this migration, because supabase/migrations/ is still the mechanism and this file is
-- what a fresh environment and the CLI's own history read.
--
-- The read half shipped with ADM-02 (20260905120000_adm02_holiday.sql) and is not touched:
-- `grant select` and `holiday_select_all` stay exactly as they are, so reading remains checked for
-- both roles (AC-18).
--
-- ONE POWER, THREE POLICIES, because PostgreSQL has no single `for write`. The permission row is
-- "Add, edit or delete a holiday or swap day" — member no, admin yes — in rbac-and-security.md:39.
--
-- `public.is_admin(uuid)` NEEDS NO GRANT HERE. TEA-01's migration already does
-- `grant execute on function public.is_admin(uuid) ... to authenticated` at
-- 20260831150024_tea01_membership.sql:71, verified on disk. A second grant is the redundant-grant
-- trap: it reads as a control and is not one. It is `security definer`, so a policy on this table
-- may consult `member` without recursing through `member`'s own policies, and it filters
-- `removed_at is null` in its own body — which is where AC-16 comes from, rather than from a
-- predicate repeated three times below.
--
-- NO TEAM CONJUNCT, unlike every other write policy in this schema. `holiday` has no `team_id`: the
-- calendar is national (ADR-015 section 1). ADR-015 Rationale records the consequence in terms — at
-- the brief's P2 multi-team point, any admin of any team can rewrite everybody's Tet — and accepts
-- it as a blast-radius cost rather than a scoping one, because there is one team. A reviewer under
-- check R6 should read this comment as the reason the missing conjunct is warranted rather than as
-- an oversight.
--
-- `to authenticated`, never `to public`: a policy written `to public` re-opens the table to the anon
-- key, which ships in the browser bundle by design (rbac-and-security.md, "Secrets").

create policy holiday_insert_admin on public.holiday
  for insert to authenticated
  with check (public.is_admin((select auth.uid())));

-- BOTH `using` AND `with check`. `using` decides which row may be updated; `with check` decides what
-- it may become. Omitting the second would let an admin's UPDATE produce a row the policy would not
-- have admitted — here the two predicates are identical because neither depends on the row, and the
-- pair is written out because the next write policy on this table will be copied from this one.
create policy holiday_update_admin on public.holiday
  for update to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

create policy holiday_delete_admin on public.holiday
  for delete to authenticated
  using (public.is_admin((select auth.uid())));

-- TABLE-WIDE AND NOT COLUMN-SCOPED, unlike TEA-04's `grant update (role, removed_at) on
-- public.member` and ADM-01's `grant update (overload_threshold) on public.team`. That is ADR-015
-- section 3's statement transcribed, and it is not the same case: a column grant exists to withhold
-- a column from EVERYBODY, and this table has none — an admin may legitimately write `date`, `name`
-- and `kind`, which is every substantive column there is. What it also admits is `id` and
-- `created_at`; neither carries a permission row anywhere and neither is read by any feature.
-- 01-plan.md Open question 1.
--
-- NOT INHERITED. ADM-02's migration does `revoke all on public.holiday from anon, authenticated`
-- and then grants `select` alone, so without this line all three policies above would sit over a
-- table nobody may write and every save would be refused with 42501.
grant insert, update, delete on public.holiday to authenticated;
```

**`unique (date)` is not created here.** ADM-02's migration already carries it on the table, and this
ticket only makes a person meet it. AC-6 and AC-7 are the translation of `23505` into a sentence, in
`toHolidayFailure` — not a second constraint.

**Applying the migration is human — RULE-09.**

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260905140000_adm03_holiday_writes.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/components/HolidayForm.tsx"
  - "src/routes/Holidays.tsx"
  - "tests/holiday-writes.test.ts"
  - "tests/e2e/adm-03-holiday-writes.spec.ts"
  - "tests/e2e/adm-02-holidays.spec.ts"
```

Ten globs, ten files, three of them new. `size`: **M**.

**`size_estimate` and `size` agree at M**, so ADR-012 is not engaged and nothing splits. Both were
reached from the same fact, that this ticket adds four database objects and three seam writes to a
table and a screen that already exist. The thing that could have pushed it over is the bridge-day
module, and that is CAL-08's by the registry row rather than by a sizing judgement made here.

### `tests/e2e/adm-02-holidays.spec.ts`, and exactly how much of it may be edited

**Added 2026-09-05, correcting this plan.** It was excluded on the claim that it would pass unedited;
§ 4.5 now records why that claim was wrong. The permission is deliberately narrow, because the
property the exclusion was protecting is real and is worth keeping: **ADM-02's read path must be
provably unchanged, not merely believed to be** (AC-18).

**What may be edited — only what asserts that the calendar is unwritable:**

1. The `test("AC-13: the calendar is not writable by anybody, admin included", …)` block. It is
   **retired, not reworded.** Its subject was the absence of the three write policies, and that
   absence is what this ticket ends; there is no narrower true statement left for it to make about an
   admin on this screen. In its place goes a comment naming ADM-03 as what superseded it and naming
   where the ADM-03-era truth is asserted instead — `tests/e2e/adm-03-holiday-writes.spec.ts` for
   AC-14 (a member is offered no control) and `tests/holiday-writes.test.ts` for AC-15 and AC-16 (the
   refusals below the interface). **Do not rewrite it into an assertion about a member**; that is
   ADM-03 AC-14 and ADM-03's own suite owns it, and a second copy in this file is the duplication
   this ticket has spent four sections avoiding elsewhere.
2. The header sentences that state the same fact — the *"Nothing in the product can insert a holiday
   at all on this branch: no insert policy and no insert grant ship here, which is AC-13"* clause
   explaining ADM-02's unasserted AC-5, and the *"ABSENCE of all three write policies"* clause in the
   paragraph naming the real mechanisms. Both become false at this ticket's `/ship`. ADM-02's AC-5
   also stops being unassertable, and ADM-03 AC-6 is where it is now asserted; say so where the
   header currently explains the gap.

**What may not be edited:** everything else. All eleven remaining `test(…)` blocks — AC-1, AC-2,
AC-3, AC-4, AC-6, AC-7, AC-8, AC-9, AC-10, AC-14, AC-15 — stay exactly as they are and must pass
without a character changed. They are what carry ADM-03 AC-18, and a green run of those eleven is the
evidence that this ticket added a write path without disturbing the read one.

**No AC of ADM-02's is amended by this**, and no artifact of ADM-02's is touched. ADM-02 is `DONE`
and its `01-plan.md` remains the true record of what was built there; AC-13 was correct on that
branch and this plan says where it stopped being correct. ADR-022 removed the Definition of Done item
requiring every AC to map to a named test, so ADM-02 is not left failing a gate by the retirement.

**`tests/holiday-writes.test.ts` is the unit test and it is new.** AC-15 and AC-16 are refusals below
the interface, and the acceptance suite cannot reach them: it drives the browser and cannot call a
seam function with a chosen caller. This file imports `seam as mock` and `__setCurrentMember` from
`src/lib/data/mock` — the shape `tests/threshold.test.ts` and `tests/seam-parity.test.ts` already use
— and asserts the three refusals a member gets, the three a removed admin gets, and the duplicate-date
refusal on both `addHoliday` and `updateHoliday` (AC-6, AC-7).

**Deliberately absent, each for a reason:**

- `tests/seam-parity.test.ts` — must pass unedited with the three functions added (section 5).
- `src/lib/fixtures.ts` and `supabase/seed.sql` — `FIXTURE_HOLIDAYS` already carries the four
  synthetic rows ADM-02 shipped, and the tests here add rows through the product rather than through
  the fixture.
- `src/lib/data/absence.ts`, `src/lib/draft-entry.ts`, `src/components/OverloadWarning.tsx` — holiday
  suppression of the crowded-day warning is forbidden to this row in terms by the registry.
- `src/routes/MonthView.tsx`, `WeekView.tsx`, `YearView.tsx` — no view draws a holiday until CAL-08.
- `src/routes/Home.tsx` and `src/App.tsx` — the link and the route shipped with ADM-02 and need no
  change: the controls appear inside a screen that is already reachable and already guarded.
- `supabase/db.sql` — Open question 3, on the CAL-04, ADM-01 and ADM-02 precedent.
- `.ai/registry/**` — nothing here writes the registry. The one amendment this work implies, to
  `glossary.md`'s *Holiday* row, is named in Open question 4 and is a human's under RULE-01.

## 8. Rejected alternatives

**Rejected: narrow the write grant to `grant insert (date, name, kind), update (date, name, kind),
delete on public.holiday`.** It matches what TEA-04 and ADM-01 both did on their tables, it withholds
`id` and `created_at`, and it is two words longer. Rejected because it writes a statement that
disagrees with an accepted ADR and with `supabase/db.sql`, the file the operator actually runs —
ADR-015 § 3 spells the blanket grant out in full and ADR-026 transcribed it. The substantive argument
is also weaker here than it was there: a column grant exists to withhold a column from *everybody*,
and on `member` and `team` there was such a column — `team_id`, `name` — where on `holiday` there is
not. What is genuinely lost is that an admin's client could set `created_at`, which falsifies a
timestamp no feature reads. Narrowing an accepted decision to buy that is the operator's call, and
Open question 1 is where it is put to them.

**Rejected: a separate route, `/holidays/:year/:id/edit`, in the shape CAL-02 used for entries.** It
would keep `Holidays.tsx` close to the size ADM-02 shipped it at, and an edit would be linkable.
Rejected because the calendar is a list of short rows rather than a six-field form: routing away to
change one date loses the neighbouring dates, which are the context that makes a swap day make sense
— a `làm bù` Saturday is only comprehensible beside the holiday it compensates. `AllowList.tsx`
already makes the same call for the same reason. It is Open question 2 rather than a silent choice,
because reversing it is cheap.

**Rejected: refuse a duplicate date in the form, before the write.** The screen already holds the
displayed year's rows, so a date already in the list could be caught without a round trip and AC-6
would never reach the datastore. Rejected because it would be a second implementation of
`unique (date)` living in the interface, and it is wrong in the case that matters: the form holds
**one year**, and an admin adding a date in a year they are not looking at would be told it is free
when it is not. The constraint is in the database, the seam translates its SQLSTATE into a sentence,
and the screen renders the sentence. A client-side check here would be right most of the time, which
is the worst property a uniqueness check can have.

**Rejected: a soft delete — `deleted_at` on `holiday` — so a removed holiday can be restored.**
Deleting a national date is destructive and irreversible, and this is the second destructive action
in the product. Rejected on three counts: it is a schema change to a table ADR-015 fixed at five
columns, none of which is nullable-for-deletion; every read in the product would then need a
`deleted_at is null` predicate, including `holiday_select_all` whose `using (true)` is the exception
this schema grants exactly once; and the recovery it buys already exists in a simpler form, since
re-applying ADM-02's seed migration re-inserts any seeded row that was deleted. AC-11's two-press
confirmation naming the date and the label is the control that fits the action.

**Rejected: one error mapper for the whole seam.** `toPostgrestFailure` already exists and already
handles `23505`; adding a fourth case to it is one line against a whole new function. Rejected for
the reason `toEntryFailure` is already a separate function and says so in its own comment: `23505` on
`allowed_email` means *this address is already listed* and on `holiday` means *this date already has
a row*, and one function returning both would put the wrong sentence on one of the two screens. The
duplication is three lines of `switch`; the alternative is a wrong message in front of an admin.

## Changelog

- `2026-09-05T10:11:08+07:00` — sections 1 through 8 and § 2b written. Gate PASS. Raised by
  `tech-lead-design`.
- `2026-09-05T10:11:08+07:00` — **the blanket write grant is transcribed rather than corrected, and
  the reasoning is recorded because it reads as an inconsistency.** TEA-04 and ADM-01 both shipped
  column-scoped update grants and both wrote down why; ADR-015 § 3 writes this one table-wide. It is
  transcribed unchanged because it is an accepted decision and `supabase/db.sql` carries the same
  statement, and because the argument that justified the column list on the other two tables does not
  hold here — there is no column on `holiday` that is withheld from everybody. Open question 1
  carries it to the operator rather than resolving it silently in either direction. Raised by
  `tech-lead-design`.
- `2026-09-05T10:11:08+07:00` — **AC-4 added after reading the shipped screen.** `src/routes/Holidays.tsx`
  renders exactly one year, resolved from the URL. An admin adding a date outside that year would
  have seen a save succeed and the row not appear, which is indistinguishable from a save that
  failed. No source said so; the criterion exists because the screen was read before section 4 was
  written, which is the order this command asks for. Raised by `tech-lead-design`.
- `2026-09-05T10:11:08+07:00` — **AC-3's labels are the mitigation for a registry defect this ticket
  may not fix.** ADR-015 § *Consequences* records that `glossary.md`'s *Holiday* row conflates
  `nghỉ bù` with `làm bù` — right for the compensatory day off, the exact inverse for the mandated
  working Saturday — and that a glossary row is a human's edit under RULE-01. This is the ticket
  where a person picks between those two values, so the kind control's labels state the **effect**
  and the map is imported from the screen rather than copied, which means the form and the list
  cannot disagree even while the glossary does. Open question 4. Raised by `tech-lead-design`.
- `2026-09-05T10:45:00+07:00` — **§ 4.5 and § 7 corrected: `tests/e2e/adm-02-holidays.spec.ts` enters
  `allowed_paths`, scoped to one retired criterion. `size` moves 9 → 10, still M.** Raised by
  `developer` at `/implement` in `99-questions.md`; amended by `tech-lead-design`.

  **The plan was wrong and the implementation was right.** § 4.5 and § 7 both asserted that suite
  would pass unedited, and both reasoned about **selector names only** — every selector does keep its
  name and its position, and that is simply not the whole of what a test file asserts. That suite's
  AC-13 signs in as `FIXTURE_ADMIN` and asserts zero buttons, zero textboxes and zero forms on
  `/holidays`; ADM-03 AC-1, AC-3, AC-5, AC-8 and AC-11 each require one of those three, for that
  caller, on that screen. The contradiction is total and was measured rather than predicted — the
  full acceptance suite ran `134 passed, 1 failed` with that test as the only failure.

  **The developer's routing was correct and their recommendation is taken.** RULE-03 forbade the edit,
  the routing table sends *impossible as specified* to `tech-lead-design`, and RULE-08 means this
  increments nothing. The alternative they offered — ship red and let the operator rule at `/ship` —
  is refused for the reason they gave: a red suite whose redness means *"a criterion was deliberately
  superseded"* stores that fact in a reviewer's memory instead of in a diff.

  **The retirement is narrower than the permission looks.** ADM-02's AC-13 is retired rather than
  reworded, eleven tests stay untouched and must pass unedited, and no ADM-02 artifact is amended:
  AC-13 was true of the branch that shipped it, and ADM-02's own plan said in terms that *"ADM-03
  ships the write half"*. § 7 carries the exact scope.

- `2026-09-05T10:45:00+07:00` — **§ 4.4 corrected: `EFFECT_LABEL` is exported from
  `HolidayForm.tsx` and imported by `Holidays.tsx`, not the reverse.** Declared as a deviation by
  `developer` at `/implement`; amended by `tech-lead-design`. The direction this plan first wrote is
  a circular import — the screen imports the form — so it was unbuildable as specified. The direction
  taken is also the repository's existing one: `EntryForm.tsx` exports `TYPE_LABELS` and
  `PORTION_LABELS` and `NewEntry.tsx` imports them, the shape CAL-02 established when it extracted
  that component. The property § 4.4 was buying — one definition, so the form and the list cannot
  disagree about what `working` means — is unchanged.

- `2026-09-05T10:11:08+07:00` — **one new `FailureCode` and not two.** `holiday_date_taken` is added
  because no existing code names a duplicate date and `already_allow_listed`'s message names an email
  address. `holiday_not_permitted` is deliberately **not** added: the policy refusal reuses
  `not_permitted` with a message written at its own call site, which is what `removeMember`,
  `promoteMember` and ADM-01's `setOverloadThreshold` all do. CAL-01's contrary precedent turned on a
  shared constant message, which is not the shape here. Raised by `tech-lead-design`.
