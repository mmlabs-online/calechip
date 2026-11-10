---
stage: TRIAGE
agent: product
produced_at: 2026-08-31
inputs_read:
  - product_brief.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/features.md
  - .ai/registry/rules.md
  - .ai/registry/decisions/ADR-008-agents-may-accept-adrs.md
  - .ai/registry/decisions/ADR-010-triage-creates-the-ticket-shell.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/board/backlog.md
  - .ai/board/ideas/2026-08-31-the-team-cannot-see-its-own-shape.md
  - .ai/board/ideas/2026-08-31-a-crowded-day-is-discovered-too-late.md
consulted: [tech-lead-design]
gate: PASS
blocking_reason: ""
next_state: BACKLOG
---

# Everyone works out the bridge day alone, from a news article, at the same time

## Problem

A person planning time off around a Vietnamese public holiday cannot see, in one place, which days are
holidays this year, which working days sit wedged between a holiday and a weekend, or which working
Saturday the government has swapped in to compensate. They reconstruct it from a news announcement or
from somebody's screenshot in a group chat, once a year, individually.

Two consequences follow, and only the second is obvious:

- The calendar the team plans against **disagrees with the calendar the country runs on** — a day
  shown as an ordinary working day is a national holiday, or a Saturday shown as a weekend is a
  mandated working day.
- Everyone spots the same bridge day, independently, at roughly the same moment, and each of them
  believes they are the only one who has noticed.

The brief writes this as requirement 7.5, a built-in holiday set plus automatic bridge-day detection.
The problem underneath is that **the working-day calendar is currently private knowledge, and it is
the input to every other decision the product supports.**

## Who has it

- **Every member**, around each of the five holiday clusters in a Vietnamese year — Tết Dương lịch,
  Tết Âm lịch, Giỗ Tổ Hùng Vương, 30/4–1/5, and Quốc khánh 2/9. Five well-defined moments where
  demand concentrates.
- **The admin**, once a year, when the government announces that year's swap and compensation
  schedule — a change nobody can derive and which arrives on no fixed date.

## Evidence

- The brief's problem section names the holiday pile-up as the *predictable* failure, distinct from
  ordinary crowding: *"ai cũng có xu hướng xin nghỉ/WFH 'ngày cầu'... nhưng không ai biết người khác
  cũng đang nhắm."*
- Brief 7.5 asks for the holiday set, admin-maintained swap days, and automatic bridge-day
  highlighting, in that order.
- **`.ai/registry/glossary.md` already defines a bridge day** — a working day sandwiched between a
  holiday and a weekend, computed from the holiday calendar — and warns that it is not a holiday but
  an ordinary working day that is merely very likely to be requested.
- **`.ai/standards/data-model.md` records that bridge days have no columns**: they are computed on
  read, deliberately, so that there is no second stored thing to keep true. A holiday table is
  therefore the only input the computation has, which makes its correctness load-bearing.
- The brief's late success measure — the share of entries created 30 or more days before a holiday —
  measures this specific behaviour.

## Impact if ignored

The single most contested set of dates in the year is the one the product knows least about. Members
declare against a grid that does not know 30/4 is a holiday; the crowded-day warning counts absences
on a day nobody was going to work anyway; and the bridge day — the one day where seeing other
people's intentions changes behaviour most — looks exactly like every other Tuesday.

The team also keeps paying the annual cost of somebody manually reconciling the government
announcement with everybody's assumptions, in chat, where it will not be found next year.

## Constraints already known

- **Bridge days are derived, not stored.** `.ai/standards/data-model.md`. Whatever is built here
  supplies holidays and weekends; the bridge day is a consequence.
- **A bridge day is a working day.** The glossary is explicit. It must not reduce the denominator of
  anything, and it must not be styled as a holiday — `CLAUDE.md`'s visual direction gives holidays
  lavender, and a bridge day is not one.
- **INV-04 is untouched by this.** The absence count is a sum over entries; a holiday does not change
  the formula. If a holiday should suppress the crowded-day warning, that is a separate decision and
  it is not written down anywhere.
- **Maintaining the holiday calendar is an admin-only power**, per the charter's Roles table.
- **`holiday` to `team` is an open question in `.ai/standards/data-model.md`** — whether a holiday
  belongs to a team or to the whole system is unresolved there, and it is the same question this idea
  has to answer.

## Out of scope

- **Any non-Vietnamese holiday set, region or locale.** v1 is one team in Vietnam.
- **Reminding anyone that a bridge day is coming.** P1 in the brief, and a notification mechanism
  this product does not yet have.
- **The crowded-day warning itself.** A separate idea; this one supplies a day's status, not the
  count of people on it.
- **Working-hours, shift or partial-day office policy.** Charter refusal 3.
- **Deciding company-specific days off** that are not government holidays. Not in the brief; if it is
  wanted, it is a distinct request.

## Open questions

1. ~~**Where does each year's base holiday set come from after the first year?**~~ **Answered by
   the operator, 2026-08-31: several years are seeded into the data up front, and an admin edits
   them.** No lunar-calendar computation — Tết and Giỗ Tổ are seeded at their known Gregorian dates,
   and the ngày nghỉ bù the Government announces each year arrive through the admin's own editing,
   which a computation could never have supplied. Two things this answer does not settle: **how many
   years are seeded** (question 5 asks the same thing from the other side and should be answered with
   it), and **what happens when the seed runs out** — an empty year must be visible as empty rather
   than as a year with no holidays.
2. ~~**Is a holiday scoped to a team or to the system?**~~ **Answered 2026-08-31 by
   [ADR-015](../../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md):
   system-wide. There is no `team_id`.** Both clauses above are wrong and are struck rather than
   quietly dropped: INV-07 constrains entries and the members they belong to, and does not reach a row
   that has neither — `glossary.md` says *"Holidays belong to the calendar, not to any member"* — and
   the migration asymmetry runs the other way, since absent → nullable overlay is purely additive
   while not-null → shared needs a fan-out or a dedup across N teams. `product` argued for the column
   at triage and lost; see the verdict below.
3. ~~**How is a mandated working Saturday (làm bù) represented?**~~ **Answered 2026-08-31 by
   [ADR-015](../../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md):
   one concept with a sign.** `holiday.kind` is a two-value enum, `non_working` / `working`, naming
   the effect on the working calendar rather than the Vietnamese label — three labels (`nghỉ lễ`,
   `nghỉ bù`, `làm bù`) collapse to two effects. A `làm bù` Saturday is `kind = 'working'`.
4. **Does a holiday suppress or alter the crowded-day warning for that date?** Nobody is at work, so
   the count is arguably meaningless; nothing in the registry says either way.
5. **How far ahead must the calendar reach?** Members are expected to declare four months out and the
   year view spans 365 days, so a calendar that only holds the current year will be short exactly when
   somebody plans Tết.

## Triage verdict: PROMOTE

**Decided 2026-08-31 by `product` and `tech-lead-design`**, running the two halves independently and
then reconciling. Three feature rows were written to
[.ai/registry/features.md](../../registry/features.md) under ADR-007 — **ADM-02**, **ADM-03** and
**CAL-08** — each citing this file in `Notes`, and a ticket shell and a backlog row exist for each
under ADR-010.

### The run went NEEDS-ADR → ADR-015 → PROMOTE in one pass, which is what ADR-008 and ADR-010 exist for

Both halves reached `NEEDS-ADR` on the same blocker, and it is the one two earlier triages refused to
inherit. [.ai/standards/data-model.md](../../standards/data-model.md) OPEN QUESTIONS item 1 declared
itself blocking on *"the first story touching holidays, and the `holiday` foreign key"*, and CAL-04's
`Notes` say in words that holiday shading is out of its scope because *"this row must not inherit
it"*. This is that story, and there is no version of it with `schema_delta: none`.

The decision sits inside ADR-005's envelope and supersedes nothing, so under ADR-008 it is drafted and
self-accepted rather than handed to the operator:
[**ADR-015**](../../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md),
`ACCEPTED by tech-lead-design`, closing `data-model.md` items 1 **and** 2 together — they are the same
migration, and answering one alone produces a table altered twice.

**The verdict recorded here is `PROMOTE`, not `NEEDS-ADR`, and the distinction is worth stating once.**
The `NEEDS-ADR` precedent on this board — [nobody-can-join](2026-08-31-nobody-can-join-the-board.md),
which stopped and was re-triaged — predates ADR-008. Under ADR-008 a self-acceptable ADR no longer
stops the loop, and under ADR-010 a promoted row must reach the board the same run. Recording
`NEEDS-ADR` here would have issued no rows, since ADR-007 authorises a row on `PROMOTE` only, and
stopped a loop that these two ADRs were written to keep running. **One path was available that would
have changed the envelope and was refused** — holding the weekend rule and the bridge derivation in
SQL as a view — and ADR-015 records it as rejected rather than leaving the absence to be assumed.

### `product`'s scoping recommendation lost, and both directions are recorded

`product` recommended **`team_id uuid not null references team(id)`**. The decision is **no `team_id`
— the calendar is national.**

The argument that was made for the column, kept because it is the strongest thing said against the
decision and because ADR-015 accepts it as a real cost: with no column the write policy narrows to
`is_admin((select auth.uid()))` with nothing scoping it, so at the brief's P2 multi-team point **any
admin of any team can rewrite everybody's Tết**. Under ADR-005 there is no second layer to catch it —
the policy is the whole control, and this one admits an admin with no relationship to the team whose
calendar changes, which is a regression against every other table in this schema.

It lost on four counts, and the fourth is the one that actually settled it.

- **`data-model.md`'s own text argues the other way**, in the file that poses the question: *"Vietnamese
  public holidays are national, and so are the announced swap days — which argues for one calendar with
  no `team_id`."*
- **The registry says a holiday has no owner.** `glossary.md`: *"Holidays belong to the calendar, not to
  any member."* This idea's open question 2 asserted that *"INV-07 makes team a real property of the
  data"*, and `product` repeated it. **That step does not hold** — INV-07 constrains entries and the
  members they belong to, and a holiday is neither.
- **The seed argument is mechanical rather than aesthetic.** With `team_id not null` the seed must
  hard-code the v1 team's uuid — merging the production bootstrap with the test-and-development seed
  TEA-01's design deliberately separated — or fan out over `select id from team`, which then never
  fires for a team created afterwards. **A national holiday set that must be re-inserted whenever a
  team is created is a data-integrity mechanism nobody designed**, and it would be discovered by a new
  team seeing an empty calendar.
- **The migration asymmetry runs the opposite way from the assumption.** This idea and `product` both
  asserted *"the cheap answer now is the expensive migration later"*. It is the reverse. **Absent →
  nullable overlay is purely additive**: add a nullable column, no backfill, widen the select policy,
  and every existing row stays correct as a national row. **Not-null → shared needs a fan-out or a
  dedup across N teams**, and a dedup has to decide which team's copy of a national fact is the true
  one. The cheap answer now is also the cheap migration later.

The P2 blast radius is accepted with its correction named: ADR-015's first revert condition is the
first holiday that is genuinely not national, and the fix is the additive overlay.

### Three rows, and the split is by operation before surface

`product` proposed two rows and put the read path and the write path in one ticket.
`tech-lead-design`'s three-row split was taken, on the operating model's own rule — **split by
operation first (read path, then write path), then by surface** — which puts the two-row version last.
Each of the three stays exercisable end to end at its own QA gate.

| ID | What it is | Group |
|---|---|---|
| ADM-02 | The calendar exists and can be read: the enum, the table, `unique (date)`, RLS, the grant, the select policy, the seed migration, `listHolidays(range)` in both seam implementations, and a read-only admin screen listing the calendar by year | ADM |
| ADM-03 | Add, edit and delete: three write policies, the grants, the seam writes, the form carrying `kind`, the delete confirmation | ADM |
| CAL-08 | Holiday and bridge-day shading in the month, week and year grids | CAL |

The permission table gives the same split independently, and it is the test that separated CAL-02 from
CAL-03 and CAL-07 from ADM-01: *Read the holiday calendar* (✅ / ✅) and *Add, edit or delete a holiday
or swap day* (❌ / ✅) are two rows in
[rbac-and-security.md](../../standards/rbac-and-security.md). Definition of Ready item 6 puts the two
admin rows in `ADM` — the group's expansion names the holiday calendar — and the shading in `CAL`.

**Two things this idea presents as features are not, and saying so is part of the verdict.**

- **The seeded holiday set gets no row.** It is data a human applies with the migration (RULE-09), on
  the TEA-01 precedent that *"a human applies a seed"* and it is not a capability of the feature. It
  ships as an idempotent data migration with `on conflict (date) do nothing` — `do nothing` and not
  `do update`, because it must preserve the correction an admin made from the actual government
  announcement, which is the one fact in this table no seed could ever have supplied.
- **Bridge-day detection is a rendering consequence, not a feature of its own.** `data-model.md`
  stores no bridge day by decision, `glossary.md` already fixes the definition, and the derivation has
  no permission row, no schema, no policy and no user action. A ticket whose whole content is one
  function and a colour is not a ticket; it lands inside CAL-08.

### The four other open questions, dispositioned

**1 and 5 — the seed horizon and the empty year. Neither blocks the verdict; half blocks READY.**
The operator answered on 2026-08-31 that several years are seeded and an admin edits them. *Several*
is not a testable acceptance criterion, and it is a `TODO(project):` on ADM-02. **The testable form is
a minimum coverage ahead of today rather than a count of years** — the year view spans 365 days and
members declare four months out, so a calendar with under twelve months of holidays ahead is short
exactly when somebody plans Tết. The empty-year half needs no schema and no marker: a year with zero
holidays says so, on ADM-02's screen as the past-the-horizon notice and on CAL-08 as the grid's own
empty state. The tempting alternative — storing a coverage horizon — is a second stored thing to keep
true, and `data-model.md` resists exactly that.

**3 — the mandated working Saturday. Blocked the verdict; answered by ADR-015.** One concept with a
sign: `kind` is `non_working` / `working`, naming the effect and not the label. It could not have been
left to a later story, and the reason is a correctness one rather than a schema one — see the
three-input computation below.

**4 — does a holiday suppress or alter the crowded-day warning? Not answered here, and it does not
belong on these rows.** These rows supply a day's *status*; they do not touch the count. A holiday is
not an entry and enters no term of INV-04's sum. The question lands on **CAL-07** (the warning) and
**CAL-04** (the marked cell), and it is **now ownable**, because ADR-015 removed the blocker that made
CAL-07 cross-reference it deliberately unmarked — *"a `TODO(project):` here would be this row adopting
a question it does not own"*. **Recommendation to the steward: one added `TODO(project):` sentence in
CAL-07's `Notes`, with a cross-reference on CAL-04, citing this file.** Not written here: amending
those rows is outside what this triage promotes.

Two things travel with it. **Weekend suppression cannot be decided separately either** — `làm bù`
makes weekend-ness data-dependent, so *"exclude weekends"* stopped being derivable from the date
alone the moment `kind` existed. And the product reading, offered as one sentence for the operator and
not as a decision: **suppress**. A day nobody was going to work on cannot be overloaded, and a warning
there is noise at the moment the product most needs to be believed.

### The boundary with what is already promoted

**CAL-04, CAL-05 and CAL-06 draw entries** — avatars, portions, notes, the approval star, the
overloaded state. They query no holiday and their `Notes` already say so. **CAL-08 draws day status**
on those same three surfaces and owns every pixel of it. **ADM-02 and ADM-03 draw no grid at all**;
their surface is a list of dated rows and a form.

The mechanism boundary, because the interaction boundary alone is what nearly failed between CAL-04
and CAL-07: **CAL-08 builds one pure `dayStatusesFor` module inside `src/lib/data/`, beside the
`absenceCountsFor` function CAL-04 builds**, imported by both seam implementations and reimplemented
in neither. Only one of CAL-04's two purity reasons carries — nothing previews an unsaved holiday —
and the second is sufficient alone: no invariant covers bridge days, so a divergence between
`mock.ts` and `supabase.ts` is silent while the seam-parity test passes on names and arity. **The
weekend rule lives inside that function**, because a component asking `isSaturday(d)` on its own is
the second definition.

Three constraints on that function, all from `tech-lead-design` and all invisible from the product
side:

1. **It is a three-input computation** — non-working overrides, working overrides, and the weekend
   rule. Thursday a holiday, Friday working, Saturday a mandated `làm bù` working day: **Friday is not
   a bridge day.** A two-input computation sees a holiday on one side and a weekend on the other and
   reports one — a false positive at the exact moment the highlight is the whole value.
2. **It is not total on its own range.** Deciding whether the first day of a range is a bridge day
   needs the day before it, so the seam widens the fetch several days on each side and the pure
   function reports only the dates inside the requested range.
3. **The return type must not be a flat `working | weekend | holiday | bridge`.** A bridge day *is* a
   working day, so *"is this a working day"* has to be readable without knowing that `bridge` implies
   it.

And the reciprocal, which is the boundary a well-meaning developer will cross: **a bridge day is a
working day and gets no lavender.** It reduces no denominator, is excluded from nothing, and takes no
treatment borrowed from a holiday. CAL-08 inherits whatever palette CAL-04 fixes and invents no second
vocabulary.

**The timezone trap, which will pass every test run in Vietnam.** Every date here is `date`, not
`timestamptz`. `new Date('2026-04-30')` parses as UTC midnight, so a weekday read west of UTC yields
the previous day and the bridge day moves. Comparison is on `yyyy-MM-dd` strings or a timezone-free
date type, never a `Date` weekday read.

### Two file facts, verified against the implemented TEA-01 migration

TEA-01 is implemented, so these are readable rather than recalled, and each is the difference between
a control and a decoration.

- `revoke all on public.team, public.member, public.allowed_email from anon, authenticated` at
  `supabase/migrations/20260831150024_tea01_membership.sql:145`. **`holiday`'s table grant is
  genuinely not inherited** and must be written beside the select policy — the trap ADM-01 already
  found on `team`.
- `grant execute on function public.is_admin(uuid) … to authenticated` at line 71 of the same file.
  **The write policies need no function grant**; adding one is the redundant-grant trap, and it would
  read as a control that is not one.

### The truncation hazard is worse here than for entries

Recorded on ADM-02 because that is the row that builds the read. One truncation produces **two
opposite errors from one cause** — a dropped `non_working` row renders a holiday as an ordinary
working day, and a dropped `working` row renders a mandated Saturday as an inert weekend. It is
**non-local**: dropping Thursday's row removes or invents **Friday's** bridge highlight, and nobody
looking at Friday suspects the Thursday row, which is what makes it survive review. With `order=date`
PostgREST truncates from the end, so it is the far end of a year view that loses its calendar — the
part nobody scrolls to until somebody plans Tết. It is also far less likely than the entry case, tens
of rows per year against a cap in the hundreds, and the mitigation is nearly free: an explicit `limit`
above 366 plus margin, and assert the returned count is below it.

### Invariants, and the one refinement that must not be lost

**`Invariants touched` is `[]` on all three rows**, recorded rather than left blank. A holiday is not
an entry, INV-04 is a sum over entries, and INV-07 constrains entries and the members they belong to
rather than a row that has neither — which is also the step ADR-015 refused in the case for a
`team_id`. INV-01, INV-02, INV-03, INV-05 and INV-06 are all statements about `entry`; these rows
write none.

**The refinement, from `tech-lead-design`, and it is why `[]` is not the end of the sentence:**
INV-04's content is the **uniqueness** of the definition — *"No second definition of this number
exists anywhere in the system"*. The moment a holiday suppresses or alters the crowded-day warning,
the number displayed on a holiday date differs from `absenceCountsFor`'s output for that date, and
**that is a second definition arriving through the display rather than through the arithmetic**.
**These rows must not implement suppression.** If it is ever wanted, the correct shape is to change
what is drawn *beside* the number, never the number.

### `schema_delta`, which ADR-014 decides and which both halves got partly wrong

- **ADM-02 — not `none`.** A new table, a new enum and a select policy; **ADR-015** linked. It would
  not be `none` under any reading.
- **ADM-03 — not `none`.** It carries only policies and grants, and ADR-014 (`ACCEPTED by the
  operator`) settles that a policy-only migration is not `none` — under ADR-005 the policy is the
  whole authorization model. **ADR-015** linked there too.
- **CAL-08 — `none`**, and it is the only one of the three that genuinely is: no migration, no policy,
  no grant. It reads a table ADM-02 creates and writes nothing.

### The dependencies

- `ADM-02` → `depends_on: [TEA-01, ADM-01]`
- `ADM-03` → `depends_on: [ADM-02]`
- `CAL-08` → `depends_on: [ADM-02, CAL-04, CAL-05, CAL-06]`

**ADM-02 names ADM-01 and that is a real edge, not a courtesy.** `product` proposed `[TEA-01]` alone;
`tech-lead-design`'s version was taken, because ADM-01's own `Notes` say the later admin rows inherit
its screen-versus-settings-area answer, and this ticket ships the product's second admin screen.
TEA-01 supplies the admin session, the `member` row with `role = admin`, and the `is_admin(uuid)`
helper the write policies consult. Not TEA-04 — v1's first admin comes from a seed.

**ADM-03 names ADM-02 alone**, and it is a hard edge rather than an ordering preference: it writes to
a table and an enum that ticket creates. TEA-01 is inherited through it and is not named twice.

**CAL-08 names all three views**, which is `product`'s version over `tech-lead-design`'s
`[ADM-02, CAL-04]` with the year view confirmed at design. The reason it was taken: CAL-08 shades all
three grids, so all three must exist, and a dependency graph that hides two of the three surfaces lets
the row ship on one — the same failure the views triage guarded against when it refused to let a month
cell and a year row disagree.

**The backlog ordering is the human's.** The rows were appended at positions 12, 13 and 14.

### Out of scope, added at triage

Ordered by how likely each is to be absorbed without anyone noticing. The first is the one that would
change an invariant's meaning through the display.

- **Any change to what a holiday does to the absence count or the overload warning.** These rows
  supply day status only. Now unblocked and unowned; it belongs on CAL-07 and CAL-04, per open
  question 4 above.
- **Refusing, blocking or warning on an entry that falls on a holiday.** Charter refusals 6 and 2. A
  member may declare PTO on 30/4 and nothing objects; INV-01 has nothing to say about holidays.
- **Deriving holidays from a lunar calendar, an external feed or any API.** The operator's answer of
  2026-08-31 is a seed plus admin editing. A computed Tết is a second source of truth, and the swap
  days are underivable by construction.
- **Company-specific or team-specific days off that are not government holidays.** Already excluded
  above, and now load-bearing: it is exactly the per-team need a `team_id` would have been justified
  by, so absorbing it silently would decide ADR-015 after the fact — and it is that ADR's own first
  revert condition.
- **A per-member or per-team override of a holiday** — *"I am working on 2/9"*. That is an entry, or
  it is nothing.
- **Storing, caching or materialising bridge days** — a column, a flag, a summary table, or the
  database view ADR-015 rejected. `data-model.md`, *What is deliberately not stored*.
- **A partial-day or half-day holiday.** Charter refusal 3; `portion` is a property of entries, not of
  the calendar. ADR-015's design-time check names the province case as the live one instead.
- **Reminding anyone that a bridge day is approaching.** Already excluded above; restated because
  CAL-08 now knows the date and it is one handler away.
- **Any non-Vietnamese holiday set, locale, region or second calendar.** Already excluded above;
  restated because a national table reads as an invitation to it.
- **Reconstructing past years as a historical record.** Editing is not date-restricted, but
  backfilling prior years is not a goal — and adding a past holiday silently changes what past days
  looked like with no trace, the same shape as the threshold's silent reclassification on ADM-01.

### Steward items, recorded and not fixed

Four. None blocks this verdict.

1. **`glossary.md`'s *Holiday* row conflates `nghỉ bù` with `làm bù`.** It reads *"plus the swap and
   compensatory days the government announces each year"* — right for the compensatory day off, which
   is non-working, and **the exact inverse** for the mandated working Saturday. A reader would expect
   `kind = 'non_working'` for both. ADR-013 amended that file's *Absence count* row and not this one.
   Human-only under RULE-01; ADR-015 recorded it and did not write it.
2. **`glossary.md`'s *Bridge day* — *"sandwiched"* is undefined for a run longer than one day**, and
   it is the definition of the feature. A Wednesday holiday leaves Monday *and* Tuesday between the
   weekend and the holiday: two bridge days, or none? `TODO(project):` on CAL-08, blocking READY
   there, and the answer is the operator's.
3. **`.ai/board/tickets/ADM-01/ticket.yaml:58` still says the policy-only-migration question is
   *"written down nowhere"*.** ADR-014 answered it.
4. **`CAL-02`, `CAL-03`, `CAL-04` and `ADM-01` carry `schema_delta: none` while owning policy work**,
   which ADR-014 now contradicts — and ADR-014's own *Consequences* says *"CAL-04 through CAL-07 add
   no policy and stay `none`"*, which CAL-04's and ADM-01's `Notes` contradict in the other direction.
   Two tickets already in `## BACKLOG` depend on which text wins.

Carried forward and still open: `ui-design-system.md` needs Direction, Colour, Type and Components
filled before CAL-04 reaches DESIGN, and its *Destructive actions* marker gains a second consumer in
ADM-03's delete confirmation.
