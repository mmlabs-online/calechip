---
doc_version: 3
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-015 — The holiday calendar is national, and a row carries the kind of day it forces

## Status

`ACCEPTED by tech-lead-design` — 2026-08-31.

**This decision sits inside ADR-005 and inside the operator-decided schema, and supersedes nothing.**
ADR-005 already places every permission in a row-level security policy and every structural invariant
in the database; what it does not say is what the holiday calendar is scoped to, and that is one of
the two things decided here. `.ai/standards/data-model.md` already carries a `holiday` table and
already declares both questions open, in its own `OPEN QUESTIONS` section, with item 1 blocking *"the
first story touching holidays, and the `holiday` foreign key"*. This is that story. Under ADR-008 an
agent may accept an ADR that decides inside an existing envelope, and must ask rather than decide
when it would supersede or reverse an accepted one.

**One path was available here that would have changed the envelope, and it was refused:** holding the
weekend rule and the bridge-day derivation in SQL, as a database view over `holiday`. That reverses
ADR-005's reasoning rather than working inside it — it puts a second definition of *"which days are
non-working"* where the in-memory mock declared in `.ai/standards/architecture.md` cannot share it,
and where the two implementations diverge silently while the seam-parity test still passes. It is
recorded under *Rationale* and not taken.

**Two documents this ADR deliberately does not edit**, both registry and both human-only under
RULE-01: `.ai/registry/glossary.md` and `.ai/registry/invariants.md`. Two findings against the
glossary are recorded under *Consequences* for a human, unwritten.

**Why `.ai/standards/data-model.md` is different, and may be amended here.** RULE-01 attaches to
`.ai/registry/**`. `data-model.md` is standards plane: `.github/CODEOWNERS` lists `/.ai/standards/`
for merge review, which is exactly where ADR-008 says an agent-accepted decision is reviewed, and no
standards document withholds authorship the way `invariants.md` does in its own text — *"it does not
edit this file, it does not author the ADR itself"*. The precedent is direct:
[ADR-011](ADR-011-inv-01-exclusion-constraint.md) struck through and answered `OPEN QUESTIONS` item 3
of this same file, and [ADR-009](ADR-009-how-a-person-becomes-a-member.md) did the same to item 4.
This ADR does it to items 1 and 2.

## Context

`.ai/board/ideas/2026-08-31-everyone-computes-the-bridge-day-alone.md` asks for the Vietnamese
holiday set, the admin-maintained swap days the government announces each year, and automatic
bridge-day detection. Two earlier triages refused to inherit the blocker it carries: CAL-04's `Notes`
say in words *"Holiday and bridge-day shading are deliberately not here — data-model.md OPEN
QUESTIONS item 1 blocks the first story touching `holiday`, and this row must not inherit it."*

`.ai/standards/data-model.md` at `doc_version: 3` defines `holiday` as `id, date, name, created_at`,
and declares two questions open against it:

1. *"Is the holiday calendar per team, or national? … **Blocks:** the first story touching holidays,
   and the `holiday` foreign key."*
2. *"Is the kind of holiday recorded, and what are the values called? … the value names would be
   invented. **Blocks:** nothing yet; the calendar works without it."*

Item 2's *"blocks: nothing"* stops being true with this idea, and the two questions are the same
migration. Answering one alone produces a table altered twice.

Four facts constrain the answer.

- **INV-07 does not reach a holiday.** It reads *"Every entry belongs to exactly one member, and is
  counted only against the team that member belongs to."* A holiday is not an entry and has no
  member. `.ai/registry/glossary.md` states the same thing directly: *"Holidays belong to the
  calendar, not to any member."*
- **The seed is fixed and predates every team.** The operator answered the idea's open question 1 on
  2026-08-31: several years are seeded into the data up front and an admin edits them. No lunar
  computation; the swap days arrive through the admin's own editing.
- **Company-specific days off are out of scope.** The idea says so: *"Deciding company-specific days
  off that are not government holidays. Not in the brief; if it is wanted, it is a distinct
  request."* Every row this table will hold in v1 is therefore a national fact.
- **Three Vietnamese labels collapse to two calendar effects.** `nghỉ lễ` is a public non-working
  day; `nghỉ bù` is a compensatory day off — a working day declared non-working; `làm bù` is a
  mandated working Saturday — a weekend day declared working. The first two have identical effect on
  the working calendar. The third is the exact inverse.

## Decision

### 1. `holiday` has no `team_id`. The calendar is system-wide.

`data-model.md`'s *Relationships* row `holiday → team` becomes **none**, and `OPEN QUESTIONS` item 1
is answered: there is no foreign key.

Three shapes were available. Each is stated with the policy it produces under ADR-005 and what it
costs at the brief's P2 multi-team point.

| Shape | `select` policy | Write policy | Cost at P2 |
|---|---|---|---|
| **Absent — chosen** | `using (true)` to `authenticated` | `using (public.is_admin((select auth.uid())))` | One admin's edit changes every team's calendar. A blast-radius cost, not a scoping one. |
| **`team_id` not null** | `team_id = public.member_team_id((select auth.uid()))` — TEA-01's existing helper | `public.is_admin(uid) and team_id = public.member_team_id(uid)` — the `allowed_email_select_admin` shape verbatim | Every national holiday duplicated per team; the annual government announcement entered N times by N admins and free to disagree between them. |
| **`team_id` nullable** | `team_id is null or team_id = public.member_team_id(uid)` | Needs **two** permission rows — edit-a-national-row against edit-my-team's-row | `rbac-and-security.md` has one row for this power, not two. And the uniqueness trap below. |

**The nullable option's specific trap, which is why it is not a free middle.** `unique (date)` would
have to become `unique (team_id, date)`, and NULLs do not compare equal in a unique index — so **two
national rows for the same date are permitted**, silently, which is precisely the ambiguity `unique
(date)` exists to prevent. Closing it needs `unique nulls not distinct`, which is PostgreSQL 15 and
later; the PostgreSQL major behind the hosted Supabase project is still `TODO(verify)` in
[ADR-011](ADR-011-inv-01-exclusion-constraint.md) and no project is provisioned. A correctness
property that depends on an unverified version is not a property.

### 2. `kind` is a two-value enum: `non_working` and `working`

```sql
create type public.holiday_kind as enum ('non_working', 'working');
```

**The values name the effect on the working calendar, not the Vietnamese label.** `name text not
null` already carries the label — *"Nghỉ bù 30/4"*, *"Làm bù 2/9"* — so an enum that also carried it
would be a second copy of a fact the row already states, in a column that constrains behaviour. Three
labels and two effects means a three-value enum would invite a third code path that can never differ
from one of the other two, and a branch that can never differ is a branch nobody tests.

`data-model.md` `OPEN QUESTIONS` item 2 is answered: the kind **is** recorded, as a column, and the
values are the two above. Under RULE-04 they are now real — they are the names that appear in the
migration, in the seam's row type, and in any design section 1 that touches `holiday`.

**The naming smell, recorded rather than hidden: a `holiday` row with `kind = 'working'` is a holiday
that is not a holiday.** Renaming the table to `calendar_day` was genuinely available — the table is
unbuilt, so nothing is reversed by it — and it loses because `holiday` is the word
`.ai/registry/glossary.md` defines and the word `.ai/standards/rbac-and-security.md` uses in its
permission row. A third name for one thing is a third thing to keep in step, and both files that
would have had to change are ones this ADR may not touch.

### 3. The migration

```sql
-- ADR-015. The holiday calendar is national; a row forces a date's working status.
-- Applying this file is human (RULE-09).

create type public.holiday_kind as enum ('non_working', 'working');

create table public.holiday (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  name       text not null,
  kind       public.holiday_kind not null default 'non_working',
  created_at timestamptz not null default now()
);

-- No team_id, and no cascade. data-model.md: "There is no cascade anywhere in this model, and that
-- is a decision rather than an omission."

alter table public.holiday enable row level security;

-- TEA-01's migration revokes all on its three tables from anon and authenticated
-- (supabase/migrations/20260831150024_tea01_membership.sql:145), so a grant here is required and is
-- not inherited. A policy alone reads nothing — the trap ADM-01 already found on `team`.
revoke all on public.holiday from anon, authenticated;
grant select on public.holiday to authenticated;

-- `using (true)` is correct here and would be a leak anywhere else in this schema. A holiday row
-- carries no member, no team and no personal data; it is a public fact about the Vietnamese
-- calendar. glossary.md: "Holidays belong to the calendar, not to any member." Every other table in
-- this model is scoped by member or by team, and a reviewer under check R6 should read this comment
-- as the reason the exception is warranted rather than as an oversight.
create policy holiday_select_all on public.holiday
  for select to authenticated using (true);

-- rbac-and-security.md: "Add, edit or delete a holiday or swap day" — member ❌, admin ✅.
-- One power, three policies, because PostgreSQL has no single `for write`.
--
-- `public.is_admin(uuid)` needs no grant here: TEA-01's migration already does
-- `grant execute on function public.is_admin(uuid) ... to authenticated` (line 71 of
-- supabase/migrations/20260831150024_tea01_membership.sql, verified on disk). It is `security
-- definer`, so a policy on this table may consult `member` without recursing through `member`'s own
-- policies. The *table* grant below is the one that is not inherited.
create policy holiday_insert_admin on public.holiday
  for insert to authenticated
  with check (public.is_admin((select auth.uid())));

create policy holiday_update_admin on public.holiday
  for update to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

create policy holiday_delete_admin on public.holiday
  for delete to authenticated
  using (public.is_admin((select auth.uid())));

grant insert, update, delete on public.holiday to authenticated;
```

**`unique (date)` is load-bearing, not hygiene.** It makes *"the status of date D"* a function rather
than a query, and every consumer of this table — the month shading, the year shading and the
bridge-day derivation — depends on that being single-valued. Two rows for one date with different
kinds would make the working status of a day ambiguous, and the ambiguity would surface as a
derivation that is wrong at a neighbouring date rather than at the duplicated one.

**Its cost, stated: a date carrying two names gets one row and one `name`.** Where two observances
fall on the same day, the calendar records one of them. This was accepted because the product's use
of the row is the working status, and the name is a label beside it.

### 4. Bridge-day detection becomes a three-input computation

This is the consequence of part 2 that decides whether the feature is correct, and it is the reason
`kind` could not have been left to a later story.

Thursday is a holiday. Friday is a working day. **Saturday is a mandated `làm bù` working day.**
Friday is **not** a bridge day — it is not sandwiched against a weekend. A two-input computation that
knows only holidays and the Saturday-and-Sunday rule sees a holiday on one side and a weekend on the
other and **reports a bridge day that does not exist** — a false positive, at exactly the moment the
feature's entire value is the highlight.

So the computation takes non-working overrides, working overrides, and the weekend rule. It lives in
a pure module inside `src/lib/data/`, beside the `absenceCountsFor` function CAL-04 builds, imported
by both seam implementations and reimplemented in neither. It is range-shaped and returns a per-date
series, for the same reason `absenceCountsFor` returns `Map<date, count>`: the month grid, the year
grid and a single-day lookup must all read one series.

**One of CAL-04's two reasons for purity carries here and the other does not**, and the distinction
is recorded so nobody re-derives it wrongly. CAL-04's `Notes` give two: a fetching function cannot be
called with an unsaved draft, and a fetching function cannot live outside `supabase.ts` and `mock.ts`
without being reimplemented in each. **The first does not apply** — nothing previews an unsaved
holiday. **The second applies and is sufficient alone.** No invariant covers bridge days, so the
failure is a silent divergence between the mock and the real seam rather than an INV-04 violation,
but the mechanism is identical: same names, same arity, seam-parity passes, the two answers differ.

### 5. The seed is a migration, not `supabase/seed.sql`

The several-years national holiday set is production data that must exist in every environment. It
ships as a data migration:

```sql
insert into public.holiday (date, name, kind) values
  ('2026-04-30', 'Ngày Giải phóng miền Nam', 'non_working'),
  ...
on conflict (date) do nothing;
```

Three reasons, and the third decides it:

1. `supabase/seed.sql` runs under `supabase db reset` and does not reach the hosted project. This
   data must.
2. `on conflict (date) do nothing` makes the migration idempotent, so re-application is safe.
3. **An admin's correction must survive re-application.** `do nothing` preserves an edit the admin
   made from the actual government announcement; `do update` would silently revert it — overwriting
   the one piece of knowledge in this table that no seed could ever have supplied.

**`supabase/seed.sql` and `src/lib/fixtures.ts` get a small synthetic set instead**, not the real
calendar: one `non_working` holiday, one compensatory day off, one `working` Saturday, one day that
is a bridge day under them, and one year with no rows at all. A test asserting *"30/4/2026 is a
bridge day"* asserts a fact about the world that an admin may correctly change, and it would then
fail for the right reason in the wrong place.

This closes the `TODO(project)` on seed data in `data-model.md` — which was also stale, since TEA-01's
design had already established `supabase/seed.sql` plus `src/lib/fixtures.ts` without the marker
being updated.

### 6. The read path — ADR-011's range pattern does not transfer

```
holiday?date=gte.2026-03-28&date=lte.2026-05-05&order=date
```

A plain two-sided filter on a scalar column, served by the btree index `unique (date)` already
builds. [ADR-011](ADR-011-inv-01-exclusion-constraint.md)'s `date_range=ov.` exists because `entry`
spans a range and PostgREST filters columns rather than expressions. `holiday.date` is a scalar, so
there is no `daterange`, no generated column and no `btree_gist` here. **Copying that shape would be
cargo cult** — cost with no property bought.

The fetch is widened by several days on each side of the range being rendered, because deciding
whether the first day of a range is a bridge day requires the day before it. The pure function
reports only the dates inside the requested range.

## Rationale

`product` recommended `team_id uuid not null references team(id)`, and that argument is recorded here
rather than summarised away, because it is the strongest thing said against this decision.

**The rejected alternative, and its reason.** With no column, the write policy narrows to
`is_admin((select auth.uid()))` with nothing scoping it — so at the brief's P2 multi-team point, **any
admin of any team can rewrite everybody's Tết**. Under ADR-005 there is no second layer to catch it:
the policy is the whole control, and this one admits an admin who has no relationship to the team
whose calendar changes. That is a real regression against every other table in this schema, all of
which are scoped by team.

It loses on three counts and is settled by a fourth.

- **`data-model.md`'s own text argues against it.** `OPEN QUESTIONS` item 1 says, in the file that
  poses the question: *"Vietnamese public holidays are national, and so are the announced swap days —
  which argues for one calendar with no `team_id`."*
- **The registry says a holiday has no owner.** `glossary.md`: *"Holidays belong to the calendar, not
  to any member."* INV-07 constrains entries and the members they belong to; it does not reach a row
  that has neither. The idea file's open question 2 asserts that *"INV-07 makes team a real property
  of the data"* and that assertion is the load-bearing step in the case for the column. It does not
  hold.
- **The seed argument is mechanical rather than aesthetic.** With `team_id not null`, the seed
  migration must either hard-code the v1 team's uuid — merging the production bootstrap with the
  test-and-development seed that TEA-01's design deliberately separated, *"This is the
  test-and-development seed, not the production bootstrap"* — or fan out over `select id from team`,
  which then does not fire for any team created afterwards. **A national holiday set that must be
  re-inserted whenever a team is created is a data-integrity mechanism nobody has designed**, and it
  would be discovered by a new team seeing an empty calendar.
- **What settles it: the migration asymmetry runs the opposite way from the assumption.** Both the
  idea file and `product` assert *"the cheap answer now is the expensive migration later"*. It is the
  reverse. **Absent → nullable overlay is purely additive**: add a nullable column, no backfill, widen
  the policy to `team_id is null or team_id = member_team_id(uid)`, and every existing row remains
  correct as a national row. **Not-null → shared requires a fan-out or a dedup across N teams**, and
  a dedup has to decide which team's version of a national holiday is the true one. The cheap answer
  now is also the cheap migration later, and the expensive one is the column.

The P2 blast radius is real and is accepted with the correction named: when a second team exists, the
overlay column above is the shape that fixes it, and it is additive.

**The second rejected alternative — the weekend rule and the bridge derivation as a database view.**
Attractive because a view is a single definition enforced where the data is, which is the shape
ADR-005 chose everywhere else. It is refused for three reasons, and the first is the one that would
have changed the envelope: a view cannot be shared by the in-memory mock that
`.ai/standards/architecture.md` requires, so the rule would exist twice, in two languages, diverging
silently while the seam-parity test passes on names and arity. Second, a view is a schema object
needing `security_invoker` and its own policy, so it carries its own ADR under
[ADR-014](ADR-014-policy-migrations-are-not-schema-delta-none.md). Third, it puts the
Saturday-and-Sunday rule in SQL where it cannot agree with the client's own weekend rule by
construction. ADR-005 placed *enforcement* in the database; it did not place *derivation* there, and
`data-model.md` already says the absence count is a function in the seam for exactly this reason.

**A third rejected alternative — two tables**, one for non-working days and one for mandated working
days. It doubles the read, the grants and the policies in order to distinguish two values of one
column, and `rbac-and-security.md` grants *"Add, edit or delete a holiday **or swap day**"* as a
single power — so two tables would split a power the registry states as one, and the permission table
would have to grow a row it does not have.

## Consequences

What becomes true:

- `data-model.md` `OPEN QUESTIONS` items 1 and 2 are answered, and the first story touching holidays
  is unblocked. Two names exist, so RULE-04 is satisfied for any story touching `holiday`.
- The government's annual announcement is entered once and is true for every team, including teams
  that do not exist yet.
- The seed is a plain insert with no team in it, and stays correct forever.
- A mandated working Saturday is representable, so bridge-day detection can be correct.

**What becomes harder, and four findings this ADR does not fix:**

- **At P2, any admin edits every team's calendar.** Stated above, accepted, with the additive
  overlay named as the correction. Until then it is indistinguishable from correct, because there is
  one team.

- **`glossary.md`'s *Holiday* row conflates `nghỉ bù` with `làm bù`, and this ADR may not fix it.**
  The row reads *"a public non-working day in Vietnam, plus the swap and compensatory days the
  government announces each year, which an admin enters."* Lumping the two together is right for the
  compensatory day off, which is non-working, and **the exact inverse** for the mandated working
  Saturday, which is a working day. The definition as written would lead a reader to expect
  `kind = 'non_working'` for both. This is a registry edit; RULE-01 leaves glossary rows to a human
  even though ADR-007 exempts them from needing an ADR of their own. **Recorded, not written.**

- **"Sandwiched" is undefined for a run longer than one day, and it is the definition of the
  feature.** `glossary.md`: *"a working day sandwiched between a holiday and a weekend."* A Tuesday
  holiday makes Monday a bridge day, unambiguously. A **Wednesday** holiday leaves Monday *and*
  Tuesday between the weekend and the holiday — two bridge days, or none? Nothing in the glossary,
  the brief or the charter says. It does not block this migration and must not become a blocked
  gate, but no story can state an acceptance criterion for the highlight without it. The definition
  lives in `glossary.md`, so this **goes to the operator as a decision**, and the implementing story
  carries a `TODO(project)` until it is answered.

- **The timezone trap, which will pass every test run in Vietnam.** Every date here is `date`, not
  `timestamptz`. `new Date('2026-04-30')` parses as UTC midnight; read for its weekday west of UTC it
  yields the previous day, so a Thursday holiday becomes a Wednesday and the bridge day moves. ICT is
  UTC+7 so it is correct locally and in a UTC CI, and wrong for a developer in the Americas. **The
  comparison must be on `yyyy-MM-dd` strings or a timezone-free date type, and never on a `Date`
  weekday read.**

- **The truncation hazard is worse here than for entries, and less likely.** Under ADR-005 the
  browser reads PostgREST directly and PostgREST caps rows server-side, so a truncated read produces
  a believable wrong answer with no error anywhere. Three differences from the entry case:

  - **One truncation produces two opposite errors from one cause.** A dropped `non_working` row
    renders a holiday as an ordinary working day; a dropped `working` row renders a mandated Saturday
    as an inert weekend. The entry read has one direction; this one has both.
  - **It is non-local.** Dropping Thursday's holiday removes **Friday's** bridge highlight, or
    invents one. Nobody looking at Friday thinks *"the Thursday row is missing"*, which is exactly
    what makes it survive review. A truncated entry read is wrong on the date whose rows were
    dropped.
  - **With `order=date`, PostgREST truncates from the end**, so it is the far end of a year view that
    loses its calendar — the part nobody scrolls to until somebody plans Tết.

  It is also far **less likely**: tens of rows per year against a cap in the hundreds or thousands.
  The mitigation is nearly free — request with an explicit limit above the widest possible range
  (366 plus margin) and assert the row count is below it, or use `Prefer: count=exact` and compare.
  TODO(verify): Supabase's default `max-rows`; no project is provisioned and `tech-stack.md` lists
  Supabase as past reliable recall.

- **INV-04 is untouched by this migration and becomes engaged the moment holiday-suppression is
  decided.** A holiday row is not an entry and enters no term of INV-04's sum, so the numerator is
  unchanged. But INV-04's content is the **uniqueness** of the definition — *"No second definition of
  this number exists anywhere in the system"* — and if a holiday were later made to suppress or alter
  the crowded-day warning, the number displayed on a holiday date would differ from
  `absenceCountsFor`'s output for that date. That is a second definition arriving through the display
  rather than through the arithmetic. **The stories under this ADR do not answer that question and
  must not implement suppression.** If it is later wanted, the correct shape is to change what is
  drawn beside the number, never the number. CAL-07 was promoted with this deliberately unmarked; it
  is now recorded rather than left to be re-derived.

- **Every ticket under this ADR has `schema_delta` other than `none`**, and
  [ADR-014](ADR-014-policy-migrations-are-not-schema-delta-none.md) is why the second one does too.
  The first carries a new table and a new enum, so it would not be `none` under any reading. The
  write half carries only policies and grants, and under ADR-014 — *"A migration that creates, alters
  or drops a row-level security policy is not `schema_delta: none`"* — it links this ADR as well. Only
  the shading story is genuinely `none`: it adds no migration, reads a table another row created, and
  writes nothing.

- **CODEOWNERS still does not cover the migrations directory.** Its own `TODO(project)` says it
  should, and this is the second security-surface migration in the project. Not blocking; recorded
  because under ADR-005 the migrations *are* the security surface and nothing else will report that
  the line is missing.

## Revert condition

**Two observable signals, either one.**

1. **The first holiday that is genuinely not national** — a company day off, a team's own closure, or
   a second team whose calendar must legitimately differ from the first's. One occurrence means the
   table is scoped wrongly, and the correction is the additive nullable overlay named under
   *Rationale*: add `team_id uuid null references team(id)`, widen the select policy to
   `team_id is null or team_id = public.member_team_id((select auth.uid()))`, and split the write
   permission into two rows in `rbac-and-security.md`. No backfill and no existing row changes
   meaning, which is the property this decision was chosen for.

2. **An admin of one team changes another team's calendar, in a project with more than one team.**
   Record it as an `ESCALATED` row in `.ai/board/metrics.md`; it is a permission incident, not a bug.
   The same overlay is the fix, and the reason it is a separate signal from the first is that this
   one can happen while every row in the table is still correctly national.

Separately, and as a design-time check rather than a production signal: **if a two-value `kind` turns
out not to express something the government announces** — a half-day, or a day whose status differs
by province — then part 2's collapse of three labels into two effects is wrong, and the third value
or the second table returns for a decision on its own terms. `.ai/00-charter.md` refusal 3 rules out
the half-day case, so the province case is the live one.

## Affected documents

| File | Change | `doc_version` |
|---|---|---|
| `.ai/standards/data-model.md` | `OPEN QUESTIONS` items 1 and 2 struck through and answered in place; the `holiday` table gains `kind` and its real shape; the `holiday → team` relationship row becomes *none*; the *Seed data* `TODO(project)` answered | 3 → 4 |
| `.ai/registry/glossary.md` | **No change, and one finding recorded against it.** The *Holiday* row conflates `nghỉ bù` with `làm bù`, and *Bridge day*'s "sandwiched" is undefined for a run longer than one day. Both are human-only under RULE-01 and both go to the operator | unchanged |
| `.ai/registry/invariants.md` | **No change.** INV-07 does not reach a row with no member; INV-04's numerator is untouched. The suppression question is recorded under *Consequences* and is not decided here | unchanged |
| `.ai/standards/rbac-and-security.md` | **No change.** *"Add, edit or delete a holiday or swap day"* and *"Read the holiday calendar"* already exist and are what the four policies are written against | unchanged |
| `.ai/standards/architecture.md` | **No change.** The bridge-day function is a pure module inside the seam that `architecture.md` already declares; nothing about the layer diagram moves | unchanged |
