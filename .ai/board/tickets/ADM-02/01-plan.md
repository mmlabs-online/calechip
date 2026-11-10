---
ticket: ADM-02
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-05T08:25:57+07:00
inputs_read:
  - .ai/board/tickets/ADM-02/ticket.yaml
  - .ai/board/ideas/2026-08-31-everyone-computes-the-bridge-day-alone.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md
  - .ai/registry/decisions/ADR-024-the-seed-is-human-applied-and-converge-only.md
  - .ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md
  - .ai/01-operating-model.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - supabase/db.sql
  - supabase/seed.sql
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260904100000_cal04_team_select.sql
  - supabase/migrations/20260905000000_adm01_team_threshold.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/data/absence.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/Home.tsx
  - src/routes/YearView.tsx
  - src/App.tsx
  - ui-language.json
  - eslint.config.js
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# ADM-02 — The national holiday calendar, seeded and readable

## 1. Problem and scope

**Feature ID: ADM-02.** Transcribed from `.ai/registry/features.md` without paraphrase:

> | ADM-02 | The national holiday calendar, seeded and readable | ADM | PLANNED | [] |

Today the product has no idea which days Vietnam does not work. Every member computes the bridge day
alone, off a government announcement they each read separately, and a `làm bù` mandated Saturday —
a weekend day the government turns into a working day — is invisible to the product entirely. This
row makes the calendar **exist and be readable**: the table, its one select policy, one seam read,
and a screen that lists a year of it. Editing it is ADM-03, and the split is by operation rather
than by surface so that everybody can see the seeded calendar before anybody can change it.

It is the read path of the only table in this schema with **no `team_id`**. That is ADR-015's first
decision and it is what makes the annual announcement enterable once rather than once per team.

**Out of scope.**

- **Every write.** No insert, update or delete policy and no `grant insert, update, delete` — those
  are ADM-03's, and `supabase/db.sql` already marks them `[OWED] ADM-03`. This ticket's migration
  carries the select half and stops.
- **Bridge-day detection.** ADR-015 § 4 describes the three-input pure module, and the ADM-02
  registry row does not list it. It is CAL-08's, together with the shading in the calendar views.
  Nothing in this ticket computes whether a day is a bridge day.
- **The "sandwiched" ambiguity.** ADR-015 § *Consequences* records that a Wednesday holiday leaves
  Monday *and* Tuesday between the weekend and the holiday, and that nothing in the glossary, the
  brief or the charter says whether that is two bridge days or none. It is with the operator and it
  belongs to the row that draws the highlight. Cross-referenced deliberately and **not marked**: a
  `TODO(project):` here would be this row adopting a question it does not own.
- **Holiday suppression of the crowded-day warning.** A holiday does not silence CAL-07's warning
  and this ticket does not touch it. ADR-015 § *Consequences*, and CAL-08.
- **Excluding holidays from the absence count.** INV-04 is a sum over entries; a holiday is not an
  entry. `src/lib/data/absence.ts` is not in `allowed_paths`.
- **The real Vietnamese holiday dates.** The seed **file** is in scope and its rows are not — see
  section 6 and Open question 1. This is the one part of this row delivered as a form rather than as
  content, and `supabase/db.sql:965-990` already records why: those dates are facts about government
  announcements rather than facts in this repository, and this is the one table where a wrong date
  moves bridge-day detection silently and non-locally.
- **`supabase/db.sql`.** Not touched. It already carries this table transcribed from ADR-015 under
  ADR-026 decision point 2, and ADR-026 decision point 6 says applying that file does **not**
  discharge the migration this ticket owes. Open question 4 records the staleness that ships with
  that arrangement.

`size_estimate`: **M**. A table, one policy, one seam read, one screen, and two seeded row sets that
must agree with each other — but no arithmetic, no second read path, and no write.

## 2. Acceptance criteria

Throughout: a holiday row's `kind` is `non_working` or `working`, and the values name **the effect on
the working calendar, not the Vietnamese label** — a `làm bù` mandated Saturday is `working`, the
exact inverse of a holiday (ADR-015 § 2).

### The calendar exists and is readable

**AC-1 — a signed-in member reads the calendar**
- Given a signed-in member whose role is `member`
- When the holiday screen is opened
- Then the calendar's rows for the displayed year are shown. Reading the holiday calendar is ✅ for
  both roles.

**AC-2 — a signed-in admin reads the same calendar**
- Given a signed-in admin
- When the holiday screen is opened on the same year
- Then it shows exactly the same rows, in the same order, as it showed the member.

**AC-3 — a row shows its date, its label and its effect**
- Given a year holding a `non_working` row and a `working` row
- When the year is displayed
- Then each row shows its date and its name, and the two are distinguishable from each other by
  something other than their names — the `working` row is presented as a working day and the
  `non_working` row as a non-working one.

**AC-4 — the rows are in date order**
- Given a year holding several rows entered in any order
- When the year is displayed
- Then they appear ascending by date.

**AC-5 — one row per date**
- Given the calendar
- When a second row is attempted for a date that already has one
- Then the datastore refuses it. `unique (date)` is what makes *the status of date D* a function
  rather than a query.

**AC-6 — a caller with no session sees no calendar**
- Given nobody signed in
- When the holiday screen's address is opened
- Then no calendar is shown and nothing reveals whether any row exists.

**AC-7 — a signed-in caller who is on no team still reads the calendar**
- Given a signed-in caller with no `member` row
- When the holiday screen is opened
- Then the calendar is shown. A holiday belongs to the calendar and not to any member, so there is
  no team to be on.

### The year, and the horizon

**AC-8 — the year is the address**
- Given the holiday screen
- When `/holidays/2026` is opened directly
- Then it shows 2026, and it is the same screen reached by pressing *next* from 2025.

**AC-9 — no year in the address resolves to the current one**
- Given the holiday screen's address with no year, or with a year that is not four digits
- When it is opened
- Then the screen shows the year of the caller's own clock.

**AC-10 — a year the calendar does not reach says so, and is not shown as a year without holidays**
- Given a year for which the calendar holds no row
- When that year is displayed
- Then the screen says the calendar does not go that far, and does **not** present the year as one
  on which nobody has a holiday. A Vietnamese year with no public holidays does not exist, so an
  empty year is the calendar running out and must read that way.

### The read's failure modes

**AC-11 — a failed read shows a failure, not an empty calendar**
- Given a read that fails
- When the screen is opened
- Then it says the calendar could not be loaded, and does not render an empty year.

**AC-12 — a possibly-truncated read is refused rather than displayed**
- Given a read that returns rows at the seam's declared row limit
- When it happens
- Then the seam throws rather than returning the rows, and the screen shows the same failure as
  AC-11. A short calendar renders a holiday as an ordinary working day *and* a mandated Saturday as
  an inert weekend — two opposite errors from one cause — and the error is non-local: a dropped
  Thursday row moves **Friday's** bridge highlight.

### What this row must not do

**AC-13 — the calendar is not writable by anybody**
- Given any signed-in caller, member or admin
- When an insert, update or delete against the holiday table is issued with their own token
- Then it is refused. The write path is ADM-03 and no policy or grant for it ships here.

**AC-14 — the calendar is national**
- Given two teams
- When a caller on each reads the same year
- Then both read the same rows. There is no `team_id`, so there is nothing to scope.

**AC-15 — the link is offered to both roles**
- Given the landing screen
- When it is rendered for an admin and then for a member
- Then the link to the holiday screen appears in both cases. *Read the holiday calendar* is ✅ / ✅.

**Invariants touched: `[]`.**

Written explicitly rather than left absent, and the reason is recorded rather than left to read as an
oversight — the same form the ADM-02 registry row uses. **A holiday is not an entry.** INV-04 is a
sum over entries and this table has none; INV-01, INV-02 and INV-03 all constrain `entry`; INV-05 is
about the tentative flag, which this table has no column for; INV-06 is about an entry's portion.
**INV-07 is the one worth naming, because it is the one an agent would reach for and it does not
hold**: it constrains entries and the members they belong to, and a holiday row has neither. That
step — *"INV-07 makes team a real property of the data"* — is the load-bearing claim in the case for
a `team_id`, and ADR-015 § *Rationale* is where it was examined and refused.

**Open questions.**

1. **The seed's rows are the operator's, and this is the one thing this ticket delivers as a form
   rather than as content.** The migration file, its statement shape and its `on conflict (date) do
   nothing` clause are specified in section 6 and are this ticket's. **The dates are not written by
   any agent**, and the reason is already recorded in this repository rather than being reached here:
   `supabase/db.sql:985-989` says the dates are facts about Vietnamese government announcements, not
   facts in this repository, that *"writing them from recall is what `.ai/standards/tech-stack.md`
   forbids"*, and that this is *"the one table where a wrong date SILENTLY MOVES BRIDGE-DAY DETECTION
   FOR THE WHOLE TEAM"* — non-locally, so a wrong Thursday row removes or invents **Friday's**
   highlight and nobody looking at Friday suspects Thursday. **The file ships unapplied.** RULE-09
   already makes applying a migration human; the human who applies it is the human who fills it, and
   until they do, the calendar is empty and AC-10's notice is what the product says about that. This
   is not blocking: every mechanism in this ticket is buildable, testable and exercisable against the
   synthetic fixture set ADR-015 § 5 prescribes, which is deliberately *not* the real calendar.
2. **Answered, not open — how many years, expressed as coverage rather than a count.** The registry
   row records the operator's answer as *"several"* and says in terms that *several is not a testable
   acceptance criterion* and that *"the testable form is a minimum coverage ahead of today rather
   than a count of years … a calendar with under twelve months of holidays ahead is short exactly
   when somebody plans Tết"*. Section 6 carries that as a stated property of the rows the operator
   supplies. It is not an AC because it can only be observed against a database a human has seeded,
   which no gate in this loop reaches — AC-10 is the observable half, and it is the half the registry
   row itself asks for.
3. **Assumption that ships — the screen is reachable by both roles and linked for both.** The
   registry row calls it *"a read-only admin screen"*, and
   `.ai/standards/rbac-and-security.md:38` says *Read the holiday calendar* is ✅ for member and ✅
   for admin, with `holiday_select_all` written `using (true)`. The permission table is the source
   for who may do what, so the phrase in Notes is read as *where the surface lives* — its own screen,
   inheriting ADM-01's answer — and not as *who may open it*. The link therefore follows the CAL-05
   and CAL-06 precedent on the landing screen: shown to both roles, because the permission behind it
   carries no role predicate. AC-15. If the operator meant admin-only, the change is one condition on
   one link and one route guard.
4. **Not blocking, and outside this ticket — `supabase/db.sql` will be stale the moment this ships.**
   It carries this table, its grant and its policy marked `[OWED] ADM-02 — no migration exists for
   this yet`, which stops being true at this ticket's `/ship`. ADR-026 decision point 6 is explicit
   that applying `db.sql` does not discharge the migration, and it assigns nobody the job of keeping
   the file's `[OWED]` markers current. CAL-04 and ADM-01 each left the same kind of gap in § 9.
   Named here rather than fixed: `db.sql` is deliberately out of `allowed_paths`, on the precedent
   both of those set.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

Checked before writing: `.ai/board/tickets/ADM-02/design/` does not exist, no image is attached
anywhere under `.ai/board/`, and the idea this row was promoted from
(`.ai/board/ideas/2026-08-31-everyone-computes-the-bridge-day-alone.md`) carries none.

The arrangement in section 4.4 is originated here. Two of its choices are borrowed rather than
invented and are cheaper to argue with for it: the year-in-the-address navigation is CAL-06's,
shipped in `src/routes/YearView.tsx`, and the card shape is the one every non-grid screen in this
product already uses. The one thing that is genuinely a decision — that an empty year renders a
sentence about the *calendar* rather than a sentence about the *year* — is AC-10, and it is an
acceptance criterion rather than a layout note because it is the difference between a screen that is
useless and a screen that is misleading.

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. **No row is added, changed or removed.** Two rows
already exist for this table and this ticket implements exactly one of them.

| Permission | member | admin | Where it is enforced |
|---|---|---|---|
| `Read the holiday calendar` (line 38) | ✅ | ✅ | `holiday_select_all`, plus `grant select on public.holiday` — **this ticket** |
| `Add, edit or delete a holiday or swap day` (line 39) | ❌ | ✅ | `holiday_insert_admin`, `holiday_update_admin`, `holiday_delete_admin` and the write grant — **ADM-03, not here** |

**The denials, stated as denials.**

- **Nobody may write this table after this ticket, admin included.** No write policy and no write
  grant ships here, and under ADR-005 a table with row-level security enabled and no policy for an
  operation refuses that operation to everybody. AC-13. That is the read-path-then-write-path split
  working as intended rather than a gap: the calendar is visible to the whole team before anybody can
  change it.
- **`anon` reads nothing.** The grant and the policy are both `to authenticated`, never `to public` —
  a policy written `to public` re-opens the table to the anon key, which ships in the browser bundle
  by design (`rbac-and-security.md`, *Secrets*). This is the note TEA-03's migration carries at
  `supabase/migrations/20260901093000_tea03_member_select_team.sql:27`. AC-6.
- **Nothing is scoped by team, and that is the exception this table is allowed.** `using (true)` is
  correct here and would be a leak on every other table in this schema. A holiday row carries no
  member, no team and no personal data; `glossary.md` says *"Holidays belong to the calendar, not to
  any member"*. The migration carries that sentence as a comment, because review check R6 should read
  the exception as warranted rather than as an oversight. AC-14.
- **`public.is_admin(uuid)` is not consulted anywhere in this ticket.** It is ADM-03's, and a grant
  of it here would be the redundant-grant trap TEA-01 already made unnecessary at
  `supabase/migrations/20260831150024_tea01_membership.sql:71`.

**Where the check runs.** On the server side of the boundary, always. Under ADR-005 the browser
speaks to PostgREST directly, so the policy and the grant *are* the control. The route guard in
section 4.4 — sending a signed-out caller to the landing address — is an affordance, and AC-6 is
satisfied by the grant rather than by it.

## 4. Contract

### 4.1 The domain types — `src/lib/domain/types.ts`

Three additions. Nothing existing changes shape, which is why this is not the *"changes a shared type
module"* clause of `.ai/01-operating-model.md:375`: that clause is about a shape that ripples
outward, and the paragraph under the table says the test is whether existing callers must change.
None do. The precedent is direct — CAL-04 added `Team`, `AbsenceCounts` and `AbsenceDetail` to this
file and was sized M.

```ts
/**
 * ADM-02. ADR-015 section 2. THE VALUES NAME THE EFFECT ON THE WORKING CALENDAR, NOT THE
 * VIETNAMESE LABEL — `name` already carries the label.
 *
 * `working` is a `làm bù` mandated Saturday: a weekend day the government turns into a working day,
 * the exact inverse of a holiday. A `holiday` row with `kind = 'working'` is a holiday that is not a
 * holiday, and ADR-015 records that naming smell rather than renaming the table: `holiday` is the
 * word glossary.md defines and the word rbac-and-security.md's permission row uses.
 */
export type HolidayKind = "non_working" | "working";

/** A row of `public.holiday`, in application casing. ADR-015 section 3. NO `teamId`: the calendar
 *  is national and there is no foreign key. */
export interface Holiday {
  id: string;
  date: string; // yyyy-MM-dd. Never a Date — see below.
  name: string;
  kind: HolidayKind;
  createdAt: string; // ISO 8601
}

/**
 * The explicit row limit `listHolidays` asks for, and the count at which it refuses to answer. Same
 * shape and same reasoning as ROSTER_LIMIT, OWN_ENTRY_LIMIT, TEAM_ENTRY_LIMIT and
 * MONTH_ENTRY_LIMIT: it must sit BELOW the datastore's own `max-rows` cap so this assertion fires
 * before the server's silent one does.
 *
 * ADR-015 asks for "an explicit limit above the widest possible range (366 plus margin)". A
 * Vietnamese year carries on the order of fifteen rows, so 1000 is roughly sixty years of calendar
 * and comfortably above any range this screen can request.
 *
 * TODO(verify): the datastore's default `max-rows`. The same unknown is carried by the four limits
 * above and by CAL-04, ADM-02 and ADM-04 in .ai/registry/features.md. If it is lower than this, the
 * fix is this one number.
 */
export const HOLIDAY_LIMIT = 1000;
```

**`date` is a string and never a `Date`, and on this table it is the difference between a correct
and an incorrect feature.** ADR-015 § *Consequences* names the trap and predicts it will pass every
test run in Vietnam: `new Date('2026-06-11')` parses as UTC midnight, and a weekday read west of UTC
yields the previous day — so a Thursday holiday becomes a Wednesday and the bridge day moves. ICT is
UTC+7 and CI is UTC, so it is correct in both and wrong for a developer in the Americas. Every
comparison in this feature is on `yyyy-MM-dd` strings, which sort lexicographically, exactly as
`src/lib/data/absence.ts` already does.

### 4.2 The seam — `src/lib/data/index.ts`

One function added.

```ts
/**
 * ADM-02 AC-1, AC-2, AC-4, AC-12. Every holiday row whose date falls inside `range`, ascending.
 *
 * NO TEAM PARAMETER AND NO TEAM SCOPE. The calendar is national (ADR-015 section 1), so unlike
 * every other list read on this seam there is nothing here to narrow — `holiday_select_all` is
 * `using (true)` and a caller on any team reads the same rows (AC-14).
 *
 * A PLAIN TWO-SIDED FILTER ON A SCALAR COLUMN, and this is where ADR-011's pattern deliberately does
 * NOT transfer. `entry` needed the generated `date_range` column and `ov.` because an entry SPANS a
 * range and PostgREST filters columns rather than expressions. `holiday.date` is a scalar served by
 * the btree index `unique (date)` already builds, so there is no daterange, no generated column and
 * no `btree_gist` here. Copying that shape would be cost with no property bought — ADR-015
 * section 6.
 *
 * INCLUSIVE AT BOTH ENDS, matching `DateRange` everywhere else on this seam.
 *
 * THROWS on a transport failure and on a possibly-truncated answer, the shape `listMembers`,
 * `listOwnEntries`, `listTeamEntries` and `listTeamEntriesOverlapping` all use. The throw is AC-12,
 * and the reason it matters more here than anywhere else is in that criterion: one truncation
 * produces two opposite errors, and both surface on a date other than the one whose row was dropped.
 */
listHolidays(range: DateRange): Promise<Holiday[]>;
```

### 4.3 The two implementations

```ts
// src/lib/data/supabase.ts
const { data, error } = await client()
  .from("holiday")
  .select(HOLIDAY_COLUMNS)          // "id, date, name, kind, created_at"
  .gte("date", range.start)
  .lte("date", range.end)
  .order("date", { ascending: true })
  .limit(HOLIDAY_LIMIT)
  .returns<HolidayRow[]>();
```

The truncation assertion is the one `listMembers` already carries at
`src/lib/data/supabase.ts:505`, with this table's own sentence: a short calendar is not a short list,
it is a wrong working calendar.

The mock holds `const holidays: Holiday[]` seeded from the fixtures in section 4.5, filters on the
same two string comparisons, and sorts by `date`. **Ordering is fixed above the datastore in both
implementations**, for the reason `src/lib/data/absence.ts` already records: two implementations
returning rows in different orders is the divergence `tests/seam-parity.test.ts` cannot see, because
it compares names and arity and not row order. AC-4.

### 4.4 The screen — `src/routes/Holidays.tsx` (new)

`/holidays` and `/holidays/:year`, in the shape CAL-06 shipped for `/year/:year`: **the year is the
address**, so `/holidays/2026` typed directly is the same screen as pressing *next* from 2025
(AC-8), and a missing or malformed year resolves to the caller's current year inside the component
rather than in a second route — *which year is it* is a fact about the caller's clock and `App.tsx`
holds none (AC-9).

The range requested is the whole displayed year: `{ start: "<year>-01-01", end: "<year>-12-31" }`.

Four phases: `loading`, `unavailable`, `ready`, and — inside `ready` — the empty-year case that is
AC-10.

| Order | Element | `data-testid` | Shown when |
|---|---|---|---|
| — | loading notice | `holidays-loading` | the read is in flight |
| — | failure notice, `role="alert"` | `holidays-unavailable` | the read threw, including the truncation refusal (AC-11, AC-12) |
| 1 | the year, and previous/next links | `holidays-year`, `holidays-prev`, `holidays-next` | ready |
| 2 | one row per holiday, ascending | `holidays-row` with `data-date` and `data-kind` | ready, rows exist |
| 3 | the past-the-horizon notice | `holidays-beyond-calendar` | ready, no rows (AC-10) |
| 4 | link back to the landing screen | `holidays-back` | ready |

- **A row shows its date, its name and its effect (AC-3).** The effect is a word, not only a colour:
  a `working` row says it is a working day and a `non_working` row says it is not. `data-kind`
  carries the enum value so a test asserts the effect rather than parsing copy. Lavender is the
  holiday colour in `CLAUDE.md` § *Visual direction* and is used for the `non_working` rows; the
  `working` rows deliberately do not take it, because they are the inverse of a holiday and giving
  them the holiday colour is the exact confusion ADR-015 § 2 names.
- **The empty year is a sentence about the calendar, not about the year (AC-10).** *"The calendar
  does not go as far as 2031 yet"*, never *"No holidays in 2031"*. A Vietnamese year with no public
  holidays does not exist, so the second sentence would be a false statement the product makes with
  confidence — and it is exactly what an under-seeded calendar looks like from the outside.
- **The route is guarded on a session and not on a role.** `<Route path="/holidays" …>` and
  `/holidays/:year` render for `membership.state === "member"` **and** `member-less`, and send
  `signed-out` to `/`, which resolves to the sign-in screen. Both signed-in states are admitted
  because `holiday_select_all` admits them and a holiday belongs to no team (AC-7); the guard exists
  only so that a signed-out caller does not reach a screen whose empty read would then render AC-10's
  notice and imply the calendar is short (AC-6). It is an affordance either way — the grant is the
  control.
- **One `<Link>` in `src/routes/Home.tsx`**, `data-testid="home-holidays-link"`, shown to **both**
  roles under no role condition — the shape CAL-05's and CAL-06's links already use on that screen,
  and for the same stated reason: the permission behind it carries no role predicate. AC-15.

### 4.5 The synthetic fixture set — `src/lib/fixtures.ts` and `supabase/seed.sql`

ADR-015 § 5 specifies this set and specifies that it is **not** the real calendar: *"A test asserting
'30/4/2026 is a bridge day' asserts a fact about the world that an admin may correctly change, and it
would then fail for the right reason in the wrong place."* Five rows, and every weekday below was
computed rather than recalled.

| Date | Weekday | `kind` | Why it is in the set |
|---|---|---|---|
| `2026-06-11` | Thursday | `non_working` | the holiday of ADR-015 § 4's worked example |
| `2026-06-13` | Saturday | `working` | the `làm bù` mandated Saturday of that example — with it, Friday 12 June is **not** a bridge day, which is the false positive a two-input computation produces |
| `2026-06-15` | Monday | `non_working` | the compensatory day off (`nghỉ bù`) ADR-015 § 5 asks for |
| `2026-10-15` | Thursday | `non_working` | a holiday with an ordinary Friday and an ordinary weekend after it, so Friday 16 October **is** a bridge day |
| — | — | — | **2027 carries no row at all**, which is ADR-015 § 5's *"one year with no rows"* and is AC-10's fixture |

**The names are synthetic and say so** — *"Ngày lễ thử nghiệm"*, *"Làm bù thử nghiệm"*, *"Nghỉ bù
thử nghiệm"*, *"Ngày nghỉ thử nghiệm"*. They are Vietnamese and carry diacritics deliberately:
`src/lib/fixtures.ts` and `supabase/seed.sql` are the two files on the `userContent` list in
`ui-language.json`, which `tests/ui-language.test.ts` asserts **must** contain diacritics. Holiday
names are user content, so this is the exception working rather than an exception being made.

**The same five literals go in both files**, which is the rule `src/lib/fixtures.ts` states at its
own head: *"supabase/seed.sql inserts the SAME rows with the SAME literals … Change a value here and
change it there in the same commit."*

**Neither file is the production calendar and neither claims to be.** `supabase/seed.sql` refuses to
run against anything but a local target (its own guard, ADR-024), and the real rows arrive through
the data migration in section 6.

## 5. Seam impact

One function added: `listHolidays(range)`. It appears in `src/lib/data/index.ts`,
`src/lib/data/supabase.ts` and `src/lib/data/mock.ts` with the same name and the same arity, or
`tests/seam-parity.test.ts` fails. That test is deliberately **not** in `allowed_paths`: it must pass
unedited with the function added.

**No existing seam function changes signature or behaviour**, so
`.ai/01-operating-model.md:375`'s XL clause is not engaged.

**No pure module.** ADR-015 § 4's three-input bridge-day computation is real and is described in that
ADR in detail, and it is **not built here** — the ADM-02 registry row does not list it and CAL-08
draws the highlight it feeds. Building it now would ship an untested computation whose only consumer
does not exist, and whose central definition — what *"sandwiched"* means for a run longer than one
day — is an open question with the operator.

**`src/lib/data/absence.ts` is untouched.** A holiday is not an entry and INV-04 is a sum over
entries. A crowded day that is also a holiday is still a crowded day as far as this ticket is
concerned; changing that is CAL-08's question and ADR-015 § *Consequences* says so.

## 6. Schema delta

**NOT `none`** — a new enum, a new table, a `unique` constraint, row-level security, a grant and a
policy. ADR-014 would require the link for the policy alone. **ADR-015 is linked** and is `ACCEPTED
by tech-lead-design`; it closes `data-model.md` `OPEN QUESTIONS` items 1 and 2, which had declared
themselves blocking on *"the first story touching holidays, and the `holiday` foreign key"*. This is
that story, and the answer is that there is no foreign key.

`requires_adr`: **true**, already set at triage. **No new ADR is authored** — everything below is
transcribed from ADR-015 § 3, and `supabase/db.sql` already carries the same statements under
ADR-026 decision point 2, which admits an object only when an accepted ADR writes it out in full.

### 6.1 The schema migration — `supabase/migrations/20260905120000_adm02_holiday.sql`

```sql
-- ADM-02. The national holiday calendar: the table, and the READ half of its permissions.
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- Transcribed from ADR-015 section 3, which is ACCEPTED. `supabase/db.sql` carries the same
-- statements marked `[OWED] ADM-02`; ADR-026 decision point 6 says applying that file does NOT
-- discharge this migration, because `supabase/migrations/` is still the mechanism and this file is
-- what a fresh environment and the CLI's own history read.
--
-- THE WRITE HALF IS NOT HERE. `holiday_insert_admin`, `holiday_update_admin`,
-- `holiday_delete_admin` and `grant insert, update, delete` are ADM-03's — the split is by
-- operation, so the whole team can see the calendar before anybody can change it. On this branch
-- NEITHER ROLE can change it (AC-13).

create type public.holiday_kind as enum ('non_working', 'working');

-- SYSTEM-WIDE, NOT PER TEAM. No team_id and no foreign key: Vietnamese public holidays and the
-- announced swap days are national, glossary.md says "Holidays belong to the calendar, not to any
-- member", and INV-07 constrains entries and the members they belong to rather than a row that has
-- neither. `product` recommended `team_id uuid not null` at triage and lost; the four reasons are in
-- ADR-015 Rationale.
--
-- `unique (date)` IS LOAD-BEARING, NOT HYGIENE. It makes "the status of date D" a function rather
-- than a query, and the month shading, the year shading and the bridge-day derivation all depend on
-- that being single-valued. Two rows for one date with different kinds would make the working status
-- of a day ambiguous, and the ambiguity would surface as a derivation that is wrong at a
-- NEIGHBOURING date rather than at the duplicated one (AC-5).
-- Its accepted cost: a date carrying two observances gets one row and one `name`.
--
-- No cascade. data-model.md: "There is no cascade anywhere in this model, and that is a decision
-- rather than an omission."
create table public.holiday (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  name       text not null,
  kind       public.holiday_kind not null default 'non_working',
  created_at timestamptz not null default now()
);

-- EXPLICIT, NOT INHERITED. TEA-01's revoke names `team`, `member` and `allowed_email` because
-- `holiday` did not exist (20260831150024_tea01_membership.sql:145), and Supabase's default
-- privileges on a new table in `public` are permissive. Relying on them would leave the policy as
-- the only thing between `anon` and a write, and rbac-and-security.md known weakness 1 is precisely
-- that a policy fails open silently. CAL-01's migration records this as the third time the trap has
-- been found; this is the fourth.
alter table public.holiday enable row level security;
revoke all on public.holiday from anon, authenticated;

grant select on public.holiday to authenticated;

-- `using (true)` IS CORRECT HERE AND WOULD BE A LEAK ANYWHERE ELSE IN THIS SCHEMA. A holiday row
-- carries no member, no team and no personal data; it is a public fact about the Vietnamese
-- calendar. glossary.md: "Holidays belong to the calendar, not to any member." Every other table in
-- this model is scoped by member or by team, and a reviewer under check R6 should read this comment
-- as the reason the exception is warranted rather than as an oversight (AC-14).
--
-- `to authenticated`, never `to public`: a policy written `to public` re-opens the table to the anon
-- key, which ships in the browser bundle by design (AC-6).
create policy holiday_select_all on public.holiday
  for select to authenticated using (true);
```

### 6.2 The seed data migration — `supabase/migrations/20260905120100_adm02_holiday_seed.sql`

**This file ships with its shape complete and its rows empty, and it is not applied until a human
fills it.** That is the whole of Open question 1, and it is a deliberate delivery rather than an
omission: the statement, the conflict clause and the reason are the parts a repository can hold, and
the dates are the part it cannot.

```sql
-- ADM-02. The national holiday calendar's DATA. ADR-015 section 5.
--
-- ================================================================================================
-- TODO(verify): THIS FILE IS EMPTY OF ROWS AND MUST NOT BE APPLIED UNTIL IT IS FILLED.
--
-- WHAT GOES IN: the Vietnamese public holidays and the announced swap days, from the government's
-- own announcement, covering AT LEAST TWELVE MONTHS AHEAD OF THE DAY THIS IS APPLIED. The registry
-- row records the operator's answer as "several years" and says several is not a testable
-- criterion; twelve months of coverage ahead of today is, and it is the horizon at which somebody
-- planning Tet stops being served — the year view spans 365 days and members declare four months
-- out.
--
-- WHY NO AGENT WROTE THEM: they are facts about government announcements rather than facts in this
-- repository, and this is the one table where a wrong date silently moves bridge-day detection for
-- the whole team — non-locally, since a wrong Thursday row removes or invents FRIDAY's highlight
-- and nobody looking at Friday suspects the Thursday row. supabase/db.sql section 9.3 records this
-- in the same words.
--
-- `kind` IS THE EFFECT, NOT THE LABEL. A `nghi bu` compensatory day off is `non_working`. A
-- `lam bu` mandated Saturday is `working` — a weekend day that counts as a working day, the exact
-- inverse of a holiday. Getting this backwards on one row is the failure mode this comment exists
-- to prevent.
-- ================================================================================================

insert into public.holiday (date, name, kind) values
  -- ('2026-01-01', 'Tet Duong lich', 'non_working'),
  -- ... one row per announced date ...
on conflict (date) do nothing;
```

**`on conflict (date) do nothing`, never `do update`, and this is the load-bearing clause.** It makes
the migration idempotent so re-application is safe, and — the reason that decides it — **it preserves
a correction an admin made from the actual announcement.** `do update` would silently revert exactly
the one piece of knowledge in this table that no seed could ever have supplied. ADR-015 § 5.

**It is a migration and not `supabase/seed.sql`.** That file runs under `supabase db reset`, does not
reach the hosted project, and refuses to run against anything but a local target under its own guard.
This data must reach every environment. `supabase/seed.sql` gets the synthetic set from section 4.5
instead, which is a different set on purpose.

**Applying both files is human — RULE-09.**

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260905120000_adm02_holiday.sql"
  - "supabase/migrations/20260905120100_adm02_holiday_seed.sql"
  - "supabase/seed.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/fixtures.ts"
  - "src/routes/Holidays.tsx"
  - "src/routes/Home.tsx"
  - "src/App.tsx"
  - "tests/e2e/adm-02-holidays.spec.ts"
```

Twelve globs, twelve files, three of them new. `size`: **M**.

**`size_estimate` and `size` agree at M**, so ADR-012 is not engaged and nothing splits. Twelve is
the top of the M band and one path above it is L, so the count is worth a second sentence rather than
one: the thing that would have pushed it over is ADR-015 § 4's bridge-day module and its unit test,
and that is CAL-08's by the registry row rather than by a sizing judgement made here. The split from
ADM-03 is by operation and was made at triage, which is what keeps the write path's four objects out
of this count.

**Deliberately absent, each for a reason:**

- `tests/seam-parity.test.ts` — must pass unedited with the one function added (section 5).
- `src/lib/data/absence.ts` — CAL-04's, and a holiday is not an entry (section 5).
- `src/routes/MonthView.tsx`, `WeekView.tsx`, `YearView.tsx` — the calendar views draw no holiday
  until CAL-08. This ticket makes the data readable and stops.
- `supabase/db.sql` — Open question 4, on the CAL-04 and ADM-01 precedent.
- `.ai/registry/**` — nothing here writes the registry. Two amendments this work implies are named
  and left to a human under RULE-01: the `glossary.md` *Holiday* row conflates `nghỉ bù` with
  `làm bù` (ADR-015 § *Consequences* records it, unwritten), and the ADM-02 feature row's
  `TODO(project):` on how many years the seed covers is answered as coverage in section 6.
- `playwright.config.ts` — the seam is pinned by BUG-001 and this ticket has no reason to touch it.

**There is no unit test file, and that is a decision rather than an omission.** This ticket adds no
pure function: `listHolidays` is a read, the screen's year arithmetic is CAL-06's shape, and the one
computation ADR-015 describes — the bridge-day derivation — is CAL-08's. What *is* worth testing
below the browser is the seam's truncation refusal (AC-12), and it is reachable from the end-to-end
suite the same way every other read's failure is: the mock reproduces the throw. A unit test whose
only subject is a mock's `filter` and `sort` would assert the fixture rather than the behaviour.

## 8. Rejected alternatives

**Rejected: write the real Vietnamese holiday dates into the seed migration.** It is what the row's
title promises — *seeded* — and it would make the feature useful on the day it ships rather than on
the day the operator fills a file. It was rejected on a judgement this repository had already
recorded before this plan ran: `supabase/db.sql:985-989` says those dates are facts about government
announcements rather than facts in this repository, that writing them from recall is what
`tech-stack.md` forbids, and that this is the one table where a wrong date silently and non-locally
moves bridge-day detection. Two further facts settle it rather than merely support it: the bulk of
the Vietnamese set is **lunar** — Tết and Giỗ Tổ Hùng Vương — so producing solar dates for a future
year is a conversion performed from memory, and the swap days are **announced annually by the
government**, so for any year ahead they do not yet exist to be known. A confident guess here is not
a shortcut to the same place; it is a different, worse artifact that looks identical.

**Rejected: ship no seed migration at all and let ADM-03's admin screen be the only way rows
arrive.** It is honest about what the repository knows and it removes an empty file from the tree.
Rejected because the registry row lists *"the several-years seed as a data migration"* as part of
this row in terms, and because it would make the production calendar depend on a human typing tens of
rows into a form that does not exist yet — ADM-03 has not been planned. The file ships so that
filling it is a paste rather than a design decision, and so that the `on conflict (date) do nothing`
clause, which is the part that protects an admin's correction, is settled here where its reasoning
is.

**Rejected: `team_id uuid not null references team(id)`.** `product` recommended it at triage and it
is the strongest thing said against this design: with no column, the write policy ADM-03 ships
narrows to `is_admin((select auth.uid()))` with nothing scoping it, so at the brief's P2 multi-team
point **any admin of any team can rewrite everybody's Tết**, and under ADR-005 there is no second
layer to catch it. It loses on ADR-015 § *Rationale*'s four counts, and it is repeated here rather
than cited because it is the decision a reader of this plan is most likely to want to reopen: the
registry says a holiday has no owner, INV-07 does not reach a row with no member and no team, the
seed would have to hard-code the v1 team's uuid, and the nullable middle needs
`unique nulls not distinct` — PostgreSQL 15 and later, against a major that is still `TODO(verify)`
with no project provisioned.

**Rejected: reuse ADR-011's `date_range=ov.` read shape.** The product already has a range-shaped
read on `entry` and copying it would make the two look alike. Rejected because `holiday.date` is a
scalar served by the btree index `unique (date)` already builds: `entry` needed a generated column
and `btree_gist` because an entry *spans* a range and PostgREST filters columns rather than
expressions, and a holiday does not span anything. ADR-015 § 6 calls copying it cargo cult, and the
cost is real — a generated column and an extension on a table that needs neither.

**Rejected: make the empty year say "no holidays this year".** It is the shorter sentence and it is
what an empty list usually means. Rejected because it is false in a way the product states with
confidence: a Vietnamese year with no public holidays does not exist, so the only thing an empty year
can mean is that the calendar has run out — and the failure this feature has to survive is being
under-seeded, which is silent in every other place it could show up. AC-10 exists to make it loud in
the one place a person looks.

## Changelog

- `2026-09-05T08:25:57+07:00` — sections 1 through 8 and § 2b written. Gate PASS. Raised by
  `tech-lead-design`.
- `2026-09-05T08:25:57+07:00` — **the seed's rows are delivered as a form rather than as content, and
  the decision is recorded here because it is the one a reviewer should test hardest.** The registry
  row lists the seed as part of this ticket; `supabase/db.sql:985-989` records that no agent may
  write those dates. Both are honoured: the migration file, its statement shape and its
  `on conflict (date) do nothing` clause ship, and the file is not applied until a human fills it —
  which RULE-09 already required of whoever applies it. Section 8 carries the alternative, and it is
  rejected on the repository's own prior judgement rather than on one reached in this plan.
- `2026-09-05T08:25:57+07:00` — **Open question 2 answered as coverage rather than as a count.** The
  registry row's `TODO(project):` asks how many years the seed covers, records the operator's answer
  as *"several"*, and states in the same sentence that the testable form is a minimum coverage ahead
  of today. Section 6 carries twelve months as a property of the rows the operator supplies, and
  AC-10 carries the observable half. No AC asserts the seed's contents, because no gate in this loop
  reaches a database a human has seeded. Raised by `tech-lead-design`.
- `2026-09-05T08:25:57+07:00` — **Open question 3 resolves a tension between two registry documents
  rather than choosing between them.** The ADM-02 feature row says *"a read-only admin screen"*;
  `rbac-and-security.md:38` gives *Read the holiday calendar* to both roles and `holiday_select_all`
  is `using (true)`. The permission table is the source for who may do what, so the Notes phrase is
  read as where the surface lives. AC-15 states the consequence — the link is offered to both roles —
  so that the reading is visible and arguable rather than buried in a component. Raised by
  `tech-lead-design`.
- `2026-09-05T08:25:57+07:00` — **the four synthetic fixture dates were computed, not recalled.**
  ADR-015 § 4's worked example turns on 11 June 2026 being a Thursday and 13 June 2026 a Saturday;
  both were checked before section 4.5 was written, as was 15 October 2026 being a Thursday. A
  fixture whose weekday is wrong makes the bridge-day case it exists to represent silently not that
  case. Raised by `tech-lead-design`.
