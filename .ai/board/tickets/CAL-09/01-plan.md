---
ticket: CAL-09
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-08T16:20:47+0700
inputs_read:
  - .ai/board/tickets/CAL-09/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/01-operating-model.md
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/data/absence.ts
  - src/lib/domain/types.ts
  - src/routes/YearView.tsx
  - src/routes/MonthView.tsx
  - src/routes/WeekView.tsx
  - src/components/OverloadWarning.tsx
  - tests/row-limits.test.ts
  - tests/pending-entries.test.ts
  - tests/seam-parity.test.ts
  - eslint.config.js
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CAL-09 — the calendar reads serve a year larger than one datastore page

## 1. Problem and scope

### The feature row, transcribed

| ID | Title | Group | Status | Invariants touched |
|----|-------|-------|--------|--------------------|
| CAL-09 | The calendar reads serve a year larger than one datastore page | CAL | PLANNED | *(empty in the registry — this plan fills it)* |

Four sentences of that row's `Notes` bind this plan and are transcribed rather than paraphrased:

- *"This row exists because a correct refusal is not a calendar."*
- *"PAGING DOES NOT FIX FOUR SHIPPED CRITERIA — IT RETIRES THEIR PRECONDITIONS."*
- *"`absenceCountsFor` STAYS ONE IMPLEMENTATION: assemble, then count once. A per-page sum is
  INV-04's forbidden second definition reached by an optimisation that reads as reuse."*
- *"WHAT REPLACES THE CEILING IS OPEN AND IS PLAN's."*

### What capability this buys, and for whom

Every **member** of a team whose entries overlapping a requested range exceed one datastore page
gains the year view. Today they do not have it: `listTeamEntriesOverlapping` asks for at most
`MONTH_ENTRY_LIMIT` rows and throws when it gets that many
(`src/lib/data/supabase.ts:1180-1186`), and `YearView`'s single `catch` turns that throw into
`phase: "unavailable"` — the same screen a network failure produces
(`src/routes/YearView.tsx:172-181`). The refusal is correct and CAL-06 AC-14 requires it. It is
also not a calendar, and on the day a team crosses the row count it stops working for everybody at
once and stays broken until the following January.

The capability is bought inside the data-access seam and nowhere else. The read assembles a
**complete** result from as many datastore requests as it takes, or it throws; those are the same
two outcomes the four consuming surfaces already handle, so no route and no component changes.

### What this does to four shipped acceptance criteria — stated, not discovered

CAL-04 AC-11, CAL-05 AC-15, CAL-06 AC-14 and the CAL-07 registry row's sentence are each
conditioned on the entry read *coming back at the row limit*. After this ticket the entry read
never comes back at a row limit, so those `Given`s never occur on the row-limit path and the four
criteria become **vacuously true there**. None of them is weakened, reworded or removed: each still
governs the transport-failure path, which is untouched, and AC-12 below keeps the refusal branch
wired and observable.

The same sentence closes a clash nothing in this repository records. CAL-06 AC-1 is unconditional —
*"Then the grid renders 365 day columns"* (`.ai/board/tickets/CAL-06/01-plan.md:129-132`) — while
CAL-06 AC-14 requires no grid at the row limit (`:203-207`), and above the cap the two cannot both
be observed. It resolves by the specific criterion governing the case its `Given` enumerates, and
this ticket removes the clash outright by making AC-14's precondition unreachable.

**What must not happen:** anything that renders a partial year without saying it is partial. That
reintroduces the defect BUG-002 closed on 2026-09-08.

### Out of scope

- **`listTeamEntries`.** It reaches the cap sooner and has no date filter at all
  (`src/lib/data/supabase.ts:1027-1034`), but `src/lib/data/index.ts:418-423` forbids it growing a
  range parameter in words. An unbounded admin list wants a paged *screen* like ADM-04's worklist —
  a different surface with its own criteria. It has no feature row and wants its own `/triage`.
- **Raising the Supabase project's `max-rows` setting.** Fenced by `ticket.yaml` § 7 and by
  `.ai/board/tickets/BUG-002/01-plan.md:100-103`. Rejected on the merits in section 8, not merely
  avoided.
- **Re-opening BUG-002's constants.** `TEAM_ENTRY_LIMIT` and `MONTH_ENTRY_LIMIT` keep the value
  1000. Neither is raised.
- **Deleting `MONTH_ENTRY_LIMIT`,** which this ticket leaves exported and unread. Six files outside
  this ticket name it in comments — `src/routes/YearView.tsx:174`,
  `src/routes/WeekView.tsx:296`, and the four `tests/e2e/cal-0*.spec.ts` headers — and putting four
  route and end-to-end files into `allowed_paths` for comment-only edits is worse than one honest
  docblock. Section 4 adds that docblock; the cleanup is a chore, not this ticket.
- **`src/lib/data/absence.ts`.** INV-04's single implementation sums correctly over whatever rows it
  is handed; the problem is entirely upstream of it. The same boundary BUG-002 drew.
- **The four consuming surfaces** — `YearView`, `MonthView`, `WeekView`, `OverloadWarning`. Section 5
  states why no change is needed rather than assuming it.
- **Distinguishing the two reasons the year view says "unavailable."** After this ticket the
  too-full branch it would distinguish no longer exists on the entry read. Its own idea if still
  wanted for the transport case.
- **CAL-06's performance target.** Making a year *arrive* and making it *scroll* are different
  problems that share a number (`.ai/board/tickets/CAL-06/01-plan.md:236-246`).
- **Provisioning a Supabase project** so truncation is observable, and re-opening the end-to-end seam
  pin (`playwright.config.ts:49-51`, shipped as BUG-001). Section 2's declarations name the limit
  instead.
- **Correcting the ADR-015 citation at `.ai/registry/features.md:102`.** Human plane, RULE-01,
  `/thuki`'s.

`size_estimate`: **M**. Two seam implementations, a shared constants module, the seam's contract
comment, and two test files, against a mechanism with no precedent in this tree.

## 2. Acceptance criteria

Throughout: *page size* is `TEAM_ENTRY_PAGE_SIZE` and *the bound* is `TEAM_ENTRY_MAX_PAGES`, both
defined in section 4.

**AC-1 — a matching set larger than one page comes back whole**
- Given the caller's team has more entries overlapping a range than the page size
- When `listTeamEntriesOverlapping(range)` is called
- Then it resolves with every matching entry, and the length of the returned array equals the number
  of entries that match

**AC-2 — the order survives the page boundaries**
- Given a matching set spanning more than one page
- When the call resolves
- Then the returned array is ascending by `startDate` and, within one `startDate`, ascending by `id`,
  and no `id` appears twice

**AC-3 — an empty match is not a failure**
- Given no entry of the caller's team overlaps the range
- When the call is made
- Then it resolves with `[]` and does not throw

**AC-4 — a matching set of exactly one page is not mistaken for a truncation**
- Given the matching set is exactly the page size
- When the call is made
- Then it resolves with exactly that many entries and does not throw

**AC-5 — an assembled set that is not provably complete is refused**
- Given the datastore reports that N entries match, and the assembly finishes holding a number of
  rows other than N
- When the call is made
- Then it throws, naming both numbers, and no entry array is returned

**AC-6 — a repeated row is refused**
- Given the assembled set contains the same entry `id` twice, which offset paging produces when a
  row is inserted ahead of the cursor between two requests
- When the call is made
- Then it throws and no entry array is returned

**AC-7 — completeness is never derived from the rows in hand**
- Given the datastore answers a request without an exact count
- When the call is made
- Then it throws, and the number of matching entries is never taken to be the number of rows
  received

**AC-8 — the assembly is bounded, and the bound refuses rather than truncates**
- Given a matching set larger than the page size multiplied by the bound
- When the call is made
- Then it issues at most `TEAM_ENTRY_MAX_PAGES` requests and then throws under AC-5, and it does not
  return a short array

**AC-9 — the predicate, the scope and the statuses are unchanged**
- Given an entry running 2026-03-28 to 2026-04-02, a rejected entry, and an entry belonging to
  another team
- When the range 2026-04-01 to 2026-04-30 is read
- Then the first two are returned and the third is not — overlap rather than containment, rejected
  rows still admitted for `absenceCountsFor` to exclude, and no row of another team on any page

**AC-10 — INV-04 is computed once, over the whole set**
- Given any successful call
- When a caller derives absence counts from the result
- Then `absenceCountsFor` is called once with the complete array, and no count, sum or partial total
  is computed per page anywhere in the seam

**AC-11 — the year view renders for a team above one page**
- Given a member of a team whose entries overlapping the requested year exceed the page size
- When they open `/year/:yyyy`
- Then the grid renders with a row per member and every one of that team's entries drawn, and no
  refusal is shown

**AC-12 — the refusal branch stays wired**
- Given the seam throws for any reason, including AC-5, AC-6, AC-7 and AC-8
- When the year, month or week view loads, or the draft-entry overload warning reads
- Then that surface shows exactly what it shows today for a throw — `phase: "unavailable"` on the
  three views, and no warning and no reassurance on the form — with no partial grid and no partial
  count

**AC-13 — the two new constants state the property paging bought**
- Given the constants module
- When the row-limit assertions run
- Then the page size is strictly below `DATASTORE_MAX_ROWS`, the bound is at least 2, and the page
  size multiplied by the bound is strictly greater than `DATASTORE_MAX_ROWS`

**AC-14 — the seam's contract is unchanged for its callers**
- Given every existing caller of `listTeamEntriesOverlapping`
- When the project is type-checked and the seam-parity test runs
- Then the function still takes one `DateRange` and resolves to `Entry[]`, both implementations still
  export the same names with the same arity, and no call site changes

### Invariants touched

- **INV-04** — engaged through *completeness*, not through arithmetic. `absenceCountsFor` is pure and
  sums correctly over whatever rows it is handed; the whole question is whether it is handed all of
  them. Held by AC-1, AC-5, AC-6, AC-7 and AC-8 inside the seam — the rows are assembled and proved
  complete *before* any caller counts — and by AC-10, which forbids the per-page sum that would be
  INV-04's second definition.
- **INV-07** — engaged because a multi-request read could scope its requests differently and mix
  teams. Held by the policy: `entry_select_team` filters every request identically in the real
  implementation, and the mock applies its `sameTeam` filter to the whole array before the first
  window is taken. AC-9 observes it.

Not engaged, decided rather than omitted: **INV-01**, **INV-02**, **INV-03** and **INV-06** — this
ticket writes no entry, edits none, and constructs no entry value; it only changes how existing rows
are fetched. **INV-05** — no `status` or `tentative` predicate is added or removed on any page.

### Open questions

**None blocking.** Three things the triage left open are decided here rather than carried:

1. *What the four consuming surfaces do with a multi-request read* (`ticket.yaml` § 9, the idea's
   open question 3). **Nothing.** The seam either resolves with a complete array or throws, which is
   exactly the pair the four surfaces already handle. There is no partial outcome to give a screen a
   vocabulary for. Section 5.
2. *Whether there is a ceiling at all afterwards, and what asserts it* (`ticket.yaml` § 8). **There
   is, and it is honest.** Paging moves the bound from the datastore's cap — 1000, undetectable from
   inside a response — to this product's own `TEAM_ENTRY_PAGE_SIZE × TEAM_ENTRY_MAX_PAGES`, which is
   detected and refused rather than silently truncated. AC-8 and AC-13 assert it.
3. *Whether `schema_delta` survives* (`ticket.yaml` § 6). **It does**, because section 8 rejects the
   keyset predicate that would have wanted an index.

Two assumptions that ship, recorded because they are assumptions:

- **PostgREST's exact count is taken after row-level security.** The equality in AC-5 compares an
  assembled set the policy admitted against a count of the rows the policy admitted; were the count
  taken before the policy, every read by a member of a multi-team datastore would refuse forever.
  PostgreSQL applies RLS predicates before aggregation, so the two agree. If a build ever shows a
  read refusing with an assembled length short by exactly the rows of other teams, this assumption is
  where to look first.
- **The mock cannot exercise AC-5, AC-6 or AC-7.** Its count and its windows come from one array, so
  the three refusals are unreachable there, exactly as ADM-04's short-page assertion is
  (`tests/pending-entries.test.ts:21-27`). The unit test declares this in its own header rather than
  implying coverage it does not have. A green suite proves the assembly is implemented; it does not
  prove it repairs a truncation the mock cannot produce.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

There is no `design/` folder under this ticket and none is created. The layout this plan originates
is the *absence* of one: no new screen, no new state, and not one changed pixel. The year, month and
week views keep the three phases they ship with — `loading`, `unavailable`, `ready` — and a
multi-request read stays inside `loading` until it resolves or throws, because the seam awaits the
whole assembly before returning. That is a visual decision even though it draws nothing: the
alternative, a progressive grid that fills in page by page, would put a partial year on screen, which
CAL-06 AC-14 forbids and which is the failure this whole ticket exists to avoid.

## 3. Permission model

**No change, and none is possible from here.** Authorization for this read lives entirely in the
datastore (ADR-005), in the `entry_select_team` row-level policy. Paging is a window over a set the
policy has already filtered, and the policy is re-applied to every request in the loop.

| Action | `member` | `admin` |
|---|---|---|
| Read any entry in the team, via `listTeamEntriesOverlapping` | ✅ | ✅ |

Transcribed from `.ai/standards/rbac-and-security.md:31`. Both roles, unchanged, and this read is not
where the admin capability lives.

The denials, which are the half a table of permissions cannot be tested without:

- **Neither role may read another team's entries**, on any page. There is no page index, offset or
  count that widens the set: `count: "exact"` counts policy-visible rows only, and a request whose
  offset runs past the caller's own rows returns zero rows rather than somebody else's (AC-9).
- **Neither role may make the read return an incomplete set that looks complete.** This is not a role
  gate but it is a denial and it belongs here: there is no parameter, no caller and no interface
  control that can ask for a partial answer. The refusals in AC-5 to AC-8 are unconditional and live
  below the seam boundary.
- **No interface-level gate is added or relied on.** Nothing in this ticket is an affordance.

## 4. Contract

### 4.1 New constants — `src/lib/domain/types.ts`, additive

```ts
/**
 * CAL-09. The window `listTeamEntriesOverlapping` reads in, and NOT a ceiling.
 *
 * The read pages and assembles; it does not truncate. Like PENDING_PAGE_SIZE and unlike the five
 * limits above it, this must sit strictly BELOW DATASTORE_MAX_ROWS so a page shortened by a lowered
 * cap is distinguishable from a full one.
 *
 * 500 rather than 50: this read serves the YEAR view, whose legitimate row count is the largest in
 * the product, and every sequential request is a round trip on the slowest screen in the app. At 500
 * the month, the week and the draft-entry warning are one request each, and a year is a small
 * handful. The cost is paid in the unit test, which must create 501 entries to cross a boundary —
 * arithmetic in a mock, not four minutes in a browser.
 */
export const TEAM_ENTRY_PAGE_SIZE = 500;

/**
 * CAL-09. The most requests one assembly may issue.
 *
 * A BOUND ON WORK, NOT A CEILING ON CORRECTNESS, and the difference is the whole point: exceeding it
 * cannot return a short array, because the completeness comparison refuses first. What it prevents
 * is an unbounded loop against a datastore that keeps answering.
 *
 * It does leave the product with a maximum, and that is stated rather than hidden: a range matching
 * more than TEAM_ENTRY_PAGE_SIZE * TEAM_ENTRY_MAX_PAGES entries is REFUSED. That figure is four
 * times the cap this ticket removes, and unlike the cap it is this product's own, named here, and
 * detected in the response rather than invisible in it.
 */
export const TEAM_ENTRY_MAX_PAGES = 8;
```

`MONTH_ENTRY_LIMIT` keeps its name and its value of 1000 and gains one paragraph in its existing
docblock recording that CAL-09 retired its only reader, that six files outside this ticket still name
it in comments, and that removing it is a chore rather than this ticket. Nothing else in that file
changes shape, so no existing caller changes and the *"changes a shared type module"* clause of
`.ai/01-operating-model.md:375` is not engaged — the CAL-04, ADM-02, CAL-08, ADM-04 and ADM-06
precedent.

### 4.2 The seam signature — unchanged, character for character

```ts
listTeamEntriesOverlapping(range: DateRange): Promise<Entry[]>;
```

One parameter, same return type, same throwing contract. This is deliberate and it is what keeps the
ticket out of XL: `.ai/01-operating-model.md:375` escalates a changed signature of an existing seam
function, and `src/components/OverloadWarning.tsx:145-149` records a previous ticket declining an
`AbortSignal` parameter for exactly that reason.

The doc comment above it in `src/lib/data/index.ts` changes in one paragraph. Today it reads *"THROWS
on a transport failure and on a possibly-truncated answer"*. It becomes:

```
   * THROWS on a transport failure, and on any answer the seam cannot prove complete. The read PAGES
   * and assembles rather than truncating (CAL-09): it requests windows of TEAM_ENTRY_PAGE_SIZE rows
   * in the read's own order until it holds as many DISTINCT rows as the datastore says match, and it
   * refuses if it cannot. There is no partial success — a caller receives every matching entry or an
   * error, which is what lets absenceCountsFor be handed the set and called once.
```

### 4.3 The assembly — `src/lib/data/supabase.ts`

```ts
async listTeamEntriesOverlapping(range: DateRange): Promise<Entry[]> {
  const assembled: EntryRow[] = [];
  const seen = new Set<string>();
  let matching: number | null = null;

  for (let request = 0; request < TEAM_ENTRY_MAX_PAGES; request += 1) {
    // THE OFFSET IS THE NUMBER OF ROWS IN HAND, not `request * TEAM_ENTRY_PAGE_SIZE`. A page
    // shortened by a lowered cap then costs another request rather than opening a gap the
    // completeness check would only report after the rows were already lost.
    const from = assembled.length;
    const to = from + TEAM_ENTRY_PAGE_SIZE - 1;

    const { data, error, count } = await client()
      .from("entry")
      .select(ENTRY_COLUMNS, { count: "exact" })
      .filter("date_range", "ov", `[${range.start},${range.end}]`)
      .order("start_date", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to)
      .returns<EntryRow[]>();

    if (error) throw new Error(`listTeamEntriesOverlapping failed: ${error.message}`);

    // AC-7. The count is asked for explicitly, so a null one means the datastore did not answer the
    // half completeness is decided on. Falling back to `rows.length` would report a page as the
    // whole year — the silent short calendar BUG-002 closed, arriving by a new route.
    if (count === null || count === undefined) {
      throw new Error(
        "listTeamEntriesOverlapping got no exact count: completeness must never be derived from " +
          "the number of rows received (CAL-09 AC-7)",
      );
    }

    // The FIRST count is the target. Later counts are read and ignored: a count that grew means a
    // concurrent write, which is not by itself a loss, and refusing on it would fail the year view
    // whenever anybody created an entry. What a concurrent write can actually DO to an offset walk
    // is caught below — a skipped row by the length comparison, a repeated row by `seen`.
    if (matching === null) matching = count;

    const rows = data ?? [];

    // AC-6. Offset paging is not atomic: a row inserted ahead of the cursor shifts the window and
    // returns a row already held. Summed twice it inflates a day's absence count, which is INV-04
    // wrong in the loud direction rather than the silent one — still wrong.
    for (const row of rows) {
      if (seen.has(row.id)) {
        throw new Error(
          `listTeamEntriesOverlapping received entry ${row.id} twice across pages: the result is ` +
            `not a set and must not be counted (CAL-09 AC-6)`,
        );
      }
      seen.add(row.id);
      assembled.push(row);
    }

    if (assembled.length >= matching) break;
    if (rows.length === 0) break; // no progress; the comparison below is the refusal
  }

  // AC-1, AC-5, AC-8. THE ONE REFUSAL SITE, and it is strictly stronger than the ceiling it replaces:
  // it detects a shortened window, a skipped row and an exhausted bound alike, without knowing the
  // datastore's cap. Reached with `matching` non-null — the loop bound is at least 2 (AC-13), so the
  // body runs and either assigns it or throws.
  if (matching === null || assembled.length !== matching) {
    throw new Error(
      `listTeamEntriesOverlapping assembled ${assembled.length} rows while ${matching ?? "no"} ` +
        `match: the range may be incomplete and must not be counted (CAL-09 AC-5)`,
    );
  }

  return assembled.map(toEntry);
}
```

### 4.4 The assembly — `src/lib/data/mock.ts`

The same loop over the same order, so the two implementations tell one story and the unit test
exercises the walk. The team filter, the overlap predicate and the sort are unchanged from
`src/lib/data/mock.ts:1215-1227`; `.slice(0, MONTH_ENTRY_LIMIT)` and the `>= MONTH_ENTRY_LIMIT` throw
are removed, and the `matching` count is the filtered array's length.

```ts
async listTeamEntriesOverlapping(range: DateRange): Promise<Entry[]> {
  const mine = memberTeamId(currentMemberId);

  const matched = entries
    .filter((e) => sameTeam(memberTeamId(e.memberId), mine))
    .filter((e) => e.startDate <= range.end && e.endDate >= range.start)
    .slice()
    .sort((a, b) =>
      a.startDate === b.startDate
        ? a.id.localeCompare(b.id)
        : a.startDate.localeCompare(b.startDate),
    );

  const matching = matched.length;
  const assembled: Entry[] = [];
  const seen = new Set<string>();

  for (let request = 0; request < TEAM_ENTRY_MAX_PAGES; request += 1) {
    const from = assembled.length;
    const rows = matched.slice(from, from + TEAM_ENTRY_PAGE_SIZE);

    // The same two refusals as supabase.ts, and NEITHER CAN FIRE HERE: the count and the windows
    // come from one array, so a row cannot be skipped or repeated between them. They are written
    // because the two implementations must tell one story, not because the mock can truncate —
    // the same reason `listMembers` and `listTeamEntries` carry their raises.
    for (const row of rows) {
      if (seen.has(row.id)) {
        throw new Error(
          `listTeamEntriesOverlapping received entry ${row.id} twice across pages: the result is ` +
            `not a set and must not be counted (CAL-09 AC-6)`,
        );
      }
      seen.add(row.id);
      assembled.push(row);
    }

    if (assembled.length >= matching) break;
    if (rows.length === 0) break;
  }

  if (assembled.length !== matching) {
    throw new Error(
      `listTeamEntriesOverlapping assembled ${assembled.length} rows while ${matching} match: ` +
        `the range may be incomplete and must not be counted (CAL-09 AC-5)`,
    );
  }

  return assembled.map((e) => ({ ...e }));
}
```

The bound *can* fire in the mock, and that is the one refusal a test can reach here: a fixture of
more than `TEAM_ENTRY_PAGE_SIZE × TEAM_ENTRY_MAX_PAGES` matching entries exhausts the loop and the
comparison throws. AC-8 is asserted that way or not at all, and 4001 rows is more than a unit test
should build — so AC-8 is asserted for the *bound arithmetic* (AC-13) and its behaviour is declared
unasserted in the test header, the shape `tests/pending-entries.test.ts:21-27` established.

### 4.5 What is NOT in the contract

No new seam function, no changed signature, no new type, no new field on `Entry`, and no parameter
anywhere that names a page. A caller cannot ask for one page and cannot observe that there were
several.

## 5. Seam impact

**One function's body changes. Nothing on the seam's surface does.**

`listTeamEntriesOverlapping` keeps its name, its arity, its parameter type and its return type in
both implementations, so `tests/seam-parity.test.ts` is unaffected and needs no edit — which is also
AC-14. No function is added, so there is no new name to mirror.

The four consumers are **unchanged, and each was read rather than assumed**:

| Consumer | Why it needs no change |
|---|---|
| `src/routes/YearView.tsx:161-181` | One `await` inside `Promise.all`, one `catch` to `phase: "unavailable"`. A complete array arrives where a complete array arrived; a throw arrives where a throw arrived. |
| `src/routes/MonthView.tsx:210-217` | Same shape, four reads instead of three. |
| `src/routes/WeekView.tsx:288-302` | Same shape. |
| `src/components/OverloadWarning.tsx:163-172` | Awaits the promise and discards a stale answer by request number; a slower promise is already handled by AC-19's counter, which this cannot break because it never resolves out of order. |

The property that makes this true is worth naming, because it is the design decision and not a
convenience: **the seam has no partial success.** Every request in the loop is awaited before the
next is issued and nothing is returned until the set is proved complete, so the boundary a route sees
has exactly two outcomes and it already handles both.

**The order is load-bearing and is written twice.** Both implementations order by `start_date` then
`id` ascending (`src/lib/data/supabase.ts:1166-1167`, `src/lib/data/mock.ts:1221-1226`), and the walk
depends on that order being stable across requests. `tests/seam-parity.test.ts` cannot see it — it
compares exported key sets and arity and says so at `:1-9`, *"Parity is necessary and NOT
sufficient"* — and ADM-04 hit exactly this and recorded it at `src/lib/data/supabase.ts:1364-1367`.
AC-2 is where the mock's copy of the order is asserted across a boundary.

**RULE-02 holds without effort.** Every line added is inside `src/lib/data/`, plus two constants in
`src/lib/domain/types.ts` which the seam already imports. No route reaches past the seam and no
`@supabase/*` import moves — `eslint.config.js:64-77` would fail the build if one did.

## 6. Schema delta

`none`.

Offset `range()` over the order the read already carries needs no migration, no policy change, no
trigger and no constraint, so ADR-014 is not engaged.

**The fence `ticket.yaml` § 6 raised is discharged rather than inherited.** It said `none` may not
survive a keyset predicate wanting an index on `(start_date, id)`. Section 8 rejects the keyset shape
on its own merits, so no index is wanted and the question does not arise. Had it been taken, this
field would have been re-evaluated and an ADR linked here — `requires_adr` stays `false` because the
shape that would have needed one was not chosen.

`requires_adr: false`. Paging inside the seam supersedes no accepted decision: the ceilings were
never ADR-recorded (BUG-002 shipped `requires_adr: false` and set them in a source file), CAL-04's
plan authorises paging in words at `.ai/board/tickets/CAL-04/01-plan.md:176-180`, and ADR-027 — which
would have removed the cap by changing the datastore — was withdrawn by the operator before it
entered any commit.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "tests/row-limits.test.ts"
  - "tests/team-entries-paging.test.ts"
```

Exact paths, no globs. `.ai/board/tickets/CAL-09/` is not listed because the guard exempts the active
ticket's own folder by construction (`.claude/hooks/guard-allowed-paths.mjs:205-206`).

What each is for:

- **`src/lib/domain/types.ts`** — the two constants in section 4.1, and one paragraph on
  `MONTH_ENTRY_LIMIT`'s docblock. Additive; no existing shape changes.
- **`src/lib/data/index.ts`** — one paragraph of the seam's doc comment, section 4.2. No declaration
  changes.
- **`src/lib/data/supabase.ts`** — section 4.3, plus the two constant imports.
- **`src/lib/data/mock.ts`** — section 4.4, plus the two constant imports.
- **`tests/row-limits.test.ts`** — AC-13, added beside BUG-002's existing assertions. `CEILINGS` is
  left exactly as it is, `MONTH_ENTRY_LIMIT` included: the row is now vacuous and true, and removing
  it would edit BUG-002's list for no property gained.
- **`tests/team-entries-paging.test.ts`** — new. AC-1 to AC-4, AC-9 and AC-10 against
  `@/lib/data/mock` **directly**, the way `tests/pending-entries.test.ts` and
  `tests/seam-parity.test.ts` do, because the order and the walk are invisible to the parity test.
  Its header declares which criteria are asserted nowhere and why — AC-5, AC-6 and AC-7, unreachable
  in the mock; AC-8's behaviour, which would cost 4001 fixture rows; and AC-11 and AC-12, which are
  end-to-end and pinned to the mock by `playwright.config.ts:49-51`.

`size`: **S** — six files.

**`size_estimate` said M and the verdict is S. They disagree and the verdict wins (ADR-012).** The
estimate was made from the mechanism — a multi-request assembly with a termination condition and a
bound, with no precedent in this tree, which `ticket.yaml` § 5 identifies as the largest unknown here
and which is why the triage recorded no size at all. The count came out lower because the whole
change is contained: no route, no component, no schema, no seam signature, and no consumer. That the
hard part is one function rather than six is what the file count cannot see, and it is the reason to
write this line rather than to quietly take the smaller number.

## 8. Rejected alternatives

**1 — Keyset pagination on `(start_date, id)`.** Genuinely the better shape in general: it is
immune to the concurrent-write skew that forces AC-5 and AC-6 to exist, and its cost does not grow
with the offset. Rejected for three reasons that hold *here*. It needs a compound `or(start_date.gt.…,
and(start_date.eq.…,id.gt.…))` predicate written twice, in PostgREST's filter syntax in one
implementation and in a comparator in the other, and `tests/seam-parity.test.ts` cannot see a
disagreement between them. It probably wants an index on `(start_date, id)`, which puts
`schema_delta` back in play against an ADR-014 reading the ADR itself exists to distrust — a
migration for a read whose largest realistic set is a few thousand rows. And offset's actual weakness
is depth: at `TEAM_ENTRY_MAX_PAGES` of 8 the deepest offset is 3500 rows, where the scan cost is not
measurable. The skew it avoids is caught by AC-5 and AC-6 instead, which are eleven lines and no
migration.

**2 — Raising the Supabase project's `max-rows` setting.** The one change that makes this whole
ticket unnecessary, which is exactly why it is fenced by `ticket.yaml` § 7 and named here rather than
left unmentioned. Rejected on the merits and not only by the fence: it adds a repository artifact and
a deployment step that do not exist, and it makes a product correctness property depend on a value no
file records and no check can verify
(`.ai/board/tickets/BUG-002/01-plan.md:100-103`). It also does not close the problem, it moves it —
whatever the new cap is, a team eventually crosses it and lands back on a silent truncation, because
a `.limit()` at a number nobody can assert is the defect BUG-002 closed. **Had this plan concluded it
was the right answer, the correct verdict would have been `BLOCKED` with `requires_adr: true`, not a
configuration change.** It did not.

**3 — A caller-supplied page index, the shape ADM-04 shipped
(`src/lib/data/supabase.ts:1373-1433`).** The obvious move, since the precedent is in the tree and
gives the ingredients — `count: "exact"`, `.range()`, a null-count refusal, a short-page assertion.
Rejected because ADM-04 built a paged *screen* whose user asks for the next page, and this needs a
complete *result*: `absenceCountsFor` must be handed every row before it is called, so somebody has
to do the assembly, and moving it above the seam puts INV-04's completeness in four routes instead of
one function — INV-04's forbidden second definition arriving as a loop rather than as a sum. It also
changes the signature of an existing seam function, which is XL and escalates
(`.ai/01-operating-model.md:375`).

**4 — Counting per page and summing the counts.** Would avoid holding a year of rows in memory, and
reads as reuse rather than as a shortcut, which is what makes it the cheapest wrong path in this
ticket. Rejected because it is INV-04's second definition in the plainest possible form: the absence
count would be computed somewhere other than `absenceCountsFor`, and an entry spanning a page
boundary would be counted by whichever page held it while the other page's arithmetic knew nothing
about it. INV-04 is the uniqueness of the definition, not the formula.

**5 — A progressive year grid that fills in page by page.** Better perceived latency on the one screen
that pages, and no route would need a new failure state. Rejected because it puts a partial year on
screen: CAL-06 AC-14 forbids a grid missing rows, and a half-drawn calendar that stops is
indistinguishable from a complete one showing a quiet year. That is the defect BUG-002 closed,
rebuilt as a feature. Section 2b records it as the visual decision it is.

## Changelog

- `2026-09-08T16:20:47+0700` — sections 1 and 2 written from `.ai/registry/features.md`, this
  ticket's `ticket.yaml` and `.ai/registry/invariants.md`, before the source tree was read for
  sections 3 to 8. Raised by `tech-lead-design`. No acceptance criterion was amended afterwards.
- `2026-09-08T16:20:47+0700` — section 2, AC-6 added after reading
  `src/lib/data/supabase.ts:1373-1433`. Offset paging's *repeat* direction — a row inserted ahead of
  the cursor arriving twice — is not covered by the length comparison AC-5 states, and the triage
  named only the *skip* direction. This is an addition, not a reshaping: no existing criterion was
  weakened to fit what was easy to build. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
