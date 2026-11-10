---
ticket: BUG-002
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-08T11:13:43+07:00
inputs_read:
  - .ai/board/tickets/BUG-002/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-015-a-suppressed-signal-is-a-defect.md
  - .ai/standards/git-conventions.md
  - .ai/standards/testing-standards.md
  - .ai/01-operating-model.md
  - src/lib/domain/types.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/data/index.ts
  - src/routes/YearView.tsx
  - src/routes/MonthView.tsx
  - src/routes/WeekView.tsx
  - src/routes/TeamEntries.tsx
  - node_modules/.pnpm/@supabase+postgrest-js@2.112.4/.../dist/index.d.mts
  - tests/e2e/cal-04-month-view.spec.ts
  - tests/e2e/cal-06-year-view.spec.ts
  - tests/pending-entries.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# BUG-002 — two row limits sit above the datastore cap, so four truncation assertions can never fire

## 0. What was verified on disk, and the one contradiction inside the shell

**Every claim in `ticket.yaml` § 1 holds.** `TEAM_ENTRY_LIMIT = 2000` (`types.ts:251`),
`MONTH_ENTRY_LIMIT = 2000` (`:300`), and the five ceiling reads and their `rows.length >= LIMIT`
assertions are exactly where it says — `supabase.ts:1033/:1044` and `:1168/:1181` for the two broken
ones. **Both citations into the installed types are exact**, at
`@supabase/postgrest-js@2.112.4/dist/index.d.mts`:

- **`:3522`** — *"By default, Supabase projects return a maximum of 1,000 rows."*
- **`:3519-3520`** — *"When using `count` with `.range()` or `.limit()`, the returned `count` is the
  total number of rows that match your filters, not the number of rows in the current page."* — the
  sentence fix shape (d) rests on.

**The five ceilings today:** `ROSTER_LIMIT` 500, `OWN_ENTRY_LIMIT` 500, `TEAM_ENTRY_LIMIT` **2000**,
`MONTH_ENTRY_LIMIT` **2000**, `HOLIDAY_LIMIT` 1000. `PENDING_PAGE_SIZE` 50 is a window, not a ceiling.

**One thing the shell does not say, and it decides which read matters.** Three of the four screens —
`YearView.tsx:167`, `MonthView.tsx:214` and `WeekView.tsx:254` — all call
`seam.listTeamEntriesOverlapping`, so all three are governed by **`MONTH_ENTRY_LIMIT`**. Only
`TeamEntries.tsx:76` uses `listTeamEntries` and `TEAM_ENTRY_LIMIT`. So the "year read", which § 3
calls the largest legitimate row count in the product, is the *month* constant over a 365-day range.

**§ 3's recommendation and § 5's evidence contradict each other, and PLAN has to resolve it rather
than adopt both.** § 3 recommends shape **(d)** — detect truncation with `count: "exact"` — *"without
changing either number"*. § 5 proposes the only available evidence: a static test asserting every
ceiling sits below `DATASTORE_MAX_ROWS`, which *"FAILS TODAY at both broken constants, PASSES after
the fix"*. **Those cannot both be true.** Under (d) the constants stay at 2000, so § 5's test still
fails after the fix. § 4.1 resolves it by taking (a), and § 8 records why (d) was not taken.

## 1. Problem and scope

The feature IDs this plan implements, transcribed from `.ai/registry/features.md` without paraphrase:

| ID | Capability | Group | Status |
|---|---|---|---|
| CAL-03 | Approve or reject an entry | CAL | DONE |
| CAL-04 | The month view — who is away, and which days are overloaded | CAL | DONE |
| CAL-05 | The week view — per-person detail, half-days, notes and who approved | CAL | DONE |
| CAL-06 | The year view — one row per member across 365 days | CAL | DONE |

**`id` and `feature_ids` are different fields.** Definition of Ready item 1 constrains `feature_ids`,
and all four are `CAL`, so item 6 is satisfied by its first clause. `BUG-002` is a defect in shipped
behaviour, not a capability, and gets no feature row — ADR-028 records that `BUG-nnn` appears on no
prefix line and is not policed by D1.

**Nobody gains a capability, and the product's visible behaviour barely changes — which is the whole
difficulty of this ticket.** Two constants sit above a cap they were written to stay under. Both
reads ask the datastore for 2000 rows; the datastore returns at most 1000; so `rows.length >= 2000`
can never be true. **The read comes back short, comes back as a success, and is summed.** Four
written statements are falsified by those two integers — CAL-04 AC-11, CAL-05 AC-15, CAL-06 AC-14,
and CAL-03's own § 4.1 contract sentence — and the failure is silent: a member sees a believable
month, week or year with entries missing and no indication that anything went wrong. That is the
shape ADR-015 calls a suppressed signal.

**It has been owed since 2026-09-05**, when ADM-04's PLAN found it and correctly refused to fix it
inside a ticket whose `invariants_touched` was `[]`. This is the ticket that judgement asked for.

**Out of scope.**

1. **Rewriting CAL-03's, CAL-04's, CAL-05's or CAL-06's acceptance criteria.** AC-11, AC-14 and AC-15
   are **correct as written** and the code does not hold them. Any edit that makes a criterion
   describe today's behaviour is the failure this ticket exists to prevent, and it is the cheapest
   way to make this ticket look done.
2. **Fix shape (b) — raising the project's `max-rows`.** Fenced by `ticket.yaml` § 4 and not taken;
   § 8 records the three reasons. It would add a `supabase/config.toml` that does not exist, add a
   deployment step that does not exist, make a correctness property depend on a value no file records
   and no check can verify, and loosen a control that exists to limit payload size against a publicly
   reachable endpoint. **Had this plan concluded (b) was right, the verdict would be `BLOCKED` with
   `requires_adr: true`.** It did not.
3. **Fix shape (c) — explicit paging with `range()`.** Pre-authorised by CAL-04's plan and ADR-015,
   and it is the correct long-term answer for a large team's year view. It is a loop inside both seam
   implementations, and § 7 of `ticket.yaml` is right that if the signatures move the size question
   re-opens as XL. See *Open questions* item 2.
4. **Provisioning a real Supabase project** so truncation is observable behaviourally. Its own
   decision, with a lifecycle, credentials in CI and seed data.
5. **Re-opening the end-to-end seam pin.** `playwright.config.ts:50` is BUG-001's shipped fix, cited
   here as a fact and not as a target.
6. **The write-path unknown at ADR-016:251** — whether the cap applies to a PATCH's returned
   representation or its affected rows. A second, independent unknown sitting on ADM-05 and ADM-06.
7. **CAL-07.** Its AC-21 is *vacuously satisfied* — its `Given` is conditioned on the seam refusing,
   and under this defect the seam never refuses, so the criterion stays green while the screen is
   wrong. That is a finding about how such a criterion should be phrased, and widening the ticket on
   the strength of a criterion that passes is scope drift with a citation.
8. **`ROSTER_LIMIT`, `OWN_ENTRY_LIMIT`, `PENDING_PAGE_SIZE` and ADM-04's paged worklist.** All below
   the cap or paging already; named as the contrast.
9. **`HOLIDAY_LIMIT`.** It is 1000, exactly the cap, and it is **correct today** — § 4.2 explains why
   it needs no change and why the test in § 4.3 is written so that it does not force one.
10. **`src/lib/data/absence.ts`.** INV-04's single implementation sums correctly over whatever rows
    it is handed. The defect is upstream of it and the fix must not reach into it.
11. **Refactoring the four assertion sites into a shared helper.** A tidy-up with its own risk that
    no criterion asks for.
12. **The `bugfix/` path-guard defect**, `.ai/standards/tech-stack.md:84`'s stale line, and the four
    other items this board owes. Each named in `ticket.yaml` § 9 and none discharged here.

`size_estimate: S`. Two constants, one new constant, one new test file, and no seam edit.

## 2. Acceptance criteria

**AC-1 — every ceiling is reachable**
- Given each row ceiling the product defines for a single read — the roster, own entries, team
  entries, entries overlapping a range, and holidays
- When each is compared with the maximum number of rows the datastore will return for one request
- Then no ceiling exceeds it, so a read that hits its ceiling can be observed to have hit it

**AC-2 — the datastore's maximum is a named value in the repository**
- Given the source tree
- When the maximum number of rows a single read may return is looked for
- Then it is defined once, under a name, beside the ceilings that depend on it, and cites where the
  figure comes from

**AC-3 — the relation is asserted by a test that fails today**
- Given the test suite run against the tree as it stands before this change
- When it runs
- Then a test asserting AC-1 fails, naming each ceiling that exceeds the maximum
- And given the same test run after this change, it passes

**AC-4 — a truncated team-entries read is refused**
- Given a datastore holding at least as many entries for the team as `listTeamEntries` will request
- When a caller invokes it
- Then it raises rather than returning the short list, and no count is computed from it

**AC-5 — a truncated overlapping read is refused**
- Given a datastore holding at least as many entries overlapping the requested range as
  `listTeamEntriesOverlapping` will request
- When the month, week or year screen invokes it
- Then it raises rather than returning the short list, and no absence count is computed from it

**AC-6 — the refusal reaches the screen as a failure and not as an empty calendar**
- Given a read that raises under AC-4 or AC-5
- When the screen that made it renders
- Then it shows its unavailable state rather than a calendar drawn from partial rows

**AC-7 — the two implementations still agree**
- Given the Supabase and mock implementations of the seam
- When their ceiling behaviour is compared
- Then both use the same named ceilings, both refuse at the same comparison, and the seam-parity test
  passes unedited

**AC-8 — no acceptance criterion of CAL-03, CAL-04, CAL-05 or CAL-06 is edited**
- Given the four parent tickets' plan documents
- When this ticket's diff is read
- Then none of them appears in it

**AC-9 — nothing outside the two files changes**
- Given this ticket's diff
- When it is read
- Then it modifies exactly one source file and adds exactly one test file, and no seam
  implementation, no route, no other test and no configuration file appears in it

**AC-10 — the whole suite passes**
- Given the unit and end-to-end suites
- When they run after this change
- Then every one passes, with no edit to any existing test

**Invariants touched: `[INV-04]`.** `ticket.yaml` § 8 sets out both readings and requires PLAN to
choose and to state the mechanism rather than the conclusion.

**INV-04** — *the absence count for a date is the sum, over that date's pending and approved entries
whose member was still on the team on that date, of 1 per `full` portion and 0.5 per `am` or `pm`,
with PTO and WFH counted alike. No second definition of this number exists anywhere in the system.*

**Listed, and the mechanism is the input rather than the definition.** The `[]` reading is real: this
ticket creates no second arithmetic, `absenceCountsFor` stays pure and untouched, and the
invariant's *statement* is not engaged. But the defect's entire consequence is that **the single
definition is reliably fed a truncated set and prints a believable wrong number with no error.** A
sum over an arbitrary 1000 of 1400 matching rows is not the sum INV-04 defines, and nothing
distinguishes it from one that is. `.ai/registry/invariants.md:63` warns that observing the safest
behaviour and concluding no invariant is engaged is circular reasoning; concluding `[]` here because
the arithmetic is untouched is exactly that shape. **This ticket is the one that restores INV-04's
inputs to complete-or-refused**, which is why AC-4, AC-5 and AC-6 are written about the read and not
about the sum.

INV-01, INV-02, INV-03, INV-05, INV-06 and INV-07 are properties of stored entries and their members.
This ticket writes nothing, reads nothing new, and changes no comparison the database performs.

**Open questions.**

1. **`>=` is deliberately conservative and will refuse a read of exactly `LIMIT` rows that was not
   truncated.** A team with exactly 1000 overlapping entries gets an error rather than a correct
   calendar. That false positive is the established shape — `ROSTER_LIMIT` and `OWN_ENTRY_LIMIT` have
   carried it since TEA-03, and `HOLIDAY_LIMIT` at exactly the cap survives today *only* because the
   comparison is `>=` and not `>`. This ticket keeps it rather than introducing a second convention.
2. **For a large team's year view, 1000 is reachable and the correct answer is paging, which this
   ticket does not build.** A year read over 365 days for a team logging WFH daily can exceed 1000
   legitimately. After this fix they see a refusal instead of a silently short year — which is what
   CAL-06 AC-14 requires and is strictly better than today — but it is a refusal, not a calendar.
   Fix shape (c) is pre-authorised by CAL-04's plan and ADR-015 and is the ticket that follows this
   one.
3. **The named maximum is a constant this repository asserts, not the value the project actually
   serves.** If someone lowers the project's `max-rows` below 1000, the ceilings are wrong again and
   the test in AC-3 still passes. Nothing in the repository can read the real setting — the anon key
   cannot, and ADR-024 declined a drift detector. **The fix removes the drift that exists and does not
   make a second one impossible**, which is the honest limit of what is available without a
   provisioned project.
4. **Six end-to-end spec headers carry the figure `2000` in prose** — `cal-04:15-19`, `cal-05:24-27`,
   `cal-06:24`, `cal-07:22`, `cal-08:28`, `adm-02:21`. Their load-bearing claim survives this fix
   (the criteria are still asserted nowhere, and no test can make PostgREST cap a read without a
   provisioned project); only the numeral goes stale. § 7 records why correcting six files for one
   numeral each is not taken.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

Written because the gate requires exactly one of the two lines, and this is the true one — **but the
layout it refers to is empty, and saying so is more useful than the line itself.** There is no
`design/` directory on this ticket, no image was attached at either stage, and none should be:
**this ticket renders nothing.** Its entire output is two integers, one new named constant and one
test file. The only user-visible consequence is that a screen which previously drew a wrong calendar
now shows the unavailable state it already has (AC-6), and that state was designed by CAL-04, CAL-05
and CAL-06 and is not touched here.

## 3. Permission model

**Nothing changes, and no read becomes narrower or wider.** The two reads keep their filters, their
policies and their callers; only the number of rows they ask for changes, and only downward toward a
figure the datastore was already enforcing.

| Action | Who | Where the check lives | Changed here |
|---|---|---|---|
| Read the team's entries | member | `entry_select_team`, a row-level select policy (ADR-005) | no |
| Read entries overlapping a range | member | the same policy | no |
| Read the roster, own entries, holidays | member | their own row-level policies | no |

**The one thing worth a reviewer's eye is that this ticket makes a screen fail where it used to
succeed**, and that is the intended direction. A refusal is not a permission change: the caller was
always entitled to those rows and the datastore was always declining to send all of them. What
changes is that the product stops presenting an incomplete answer as a complete one — which
`.ai/standards/rbac-and-security.md` does not govern and ADR-015 does.

## 4. Contract

No seam function changes name, arity, signature or return type. **No seam implementation is edited at
all**, and § 4.4 is why that is possible rather than an oversight.

### 4.1 The shape chosen, and the argument that makes it small

**Shape (a): lower the two constants to the cap, and name the cap.** `ticket.yaml` § 3 recommends (d)
instead, and its argument is the strongest sentence in the shell — (d) *"fixes detection without
changing either number, so it reaches into no shipped threshold, moves no acceptance criterion, and
needs no judgement about what a real team's row count is — which is the one input nobody has."*

**That argument is answered by a fact the shell does not state: lowering 2000 to 1000 costs nothing,
because the datastore never returned more than 1000 anyway.** No read loses a row it was previously
getting. The only change is that a truncation which today is silent becomes an error. So (a) requires
no judgement about a real team's row count either — **1000 is not a guess, it is the largest value the
ceiling can take and still be reachable**, and any lower number would be the guess § 3 objects to.

That dissolves § 3's stated cost for (a) — *"it costs the year view first"* — because the year view is
already capped at 1000 today and is quietly wrong above it. It also resolves § 0's contradiction: with
the constants lowered, § 5's static test is exactly the evidence it was designed to be.

### 4.2 The three numbers

```ts
/**
 * The most rows a single request may return, whatever a query asks for.
 *
 * Not a choice this repository makes: PostgREST caps a response and Supabase projects ship that cap
 * at 1000. The figure is documented in the installed client's own types — @supabase/postgrest-js,
 * the `select()` remarks: "By default, Supabase projects return a maximum of 1,000 rows."
 *
 * Named here because five ceilings below depend on it and, until BUG-002, it appeared nowhere in the
 * tree — which is how two of them drifted above it with nothing to notice.
 */
export const DATASTORE_MAX_ROWS = 1000;
```

| Constant | Was | Becomes | Why |
|---|---|---|---|
| `TEAM_ENTRY_LIMIT` | 2000 | **1000** | above the cap; its assertion can never fire |
| `MONTH_ENTRY_LIMIT` | 2000 | **1000** | the same, and it governs three of the four screens |
| `HOLIDAY_LIMIT` | 1000 | **1000, unchanged** | already at the cap and already reachable, so its assertion already fires |
| `ROSTER_LIMIT`, `OWN_ENTRY_LIMIT` | 500 | unchanged | already below |

**`DATASTORE_MAX_ROWS` is cited by name and not by line number.** The declaration file lives at a
pnpm store path carrying the package version, so a line citation would go stale at the next dependency
bump — the same class of staleness this ticket exists to fix.

**The five `TODO(verify)` markers on the ceilings are discharged by this change** — they each ask what
the datastore's `max-rows` is, and this names it.

### 4.3 The test — `tests/row-limits.test.ts`, new

The only evidence available without a provisioned project, and it costs nothing to run.

```ts
// Every ceiling must be REACHABLE: a read that asks for more rows than the datastore will ever
// return cannot observe itself hitting its own ceiling, so its `rows.length >= LIMIT` assertion is
// unreachable code and the short read is summed as if it were complete. That is BUG-002.
it.each([
  ["ROSTER_LIMIT", ROSTER_LIMIT],
  ["OWN_ENTRY_LIMIT", OWN_ENTRY_LIMIT],
  ["TEAM_ENTRY_LIMIT", TEAM_ENTRY_LIMIT],
  ["MONTH_ENTRY_LIMIT", MONTH_ENTRY_LIMIT],
  ["HOLIDAY_LIMIT", HOLIDAY_LIMIT],
])("%s is reachable — at most DATASTORE_MAX_ROWS", (_name, limit) => {
  expect(limit).toBeLessThanOrEqual(DATASTORE_MAX_ROWS);
});
```

**The relation is `<=` and not `<`, and that is a decision rather than a looser test.** The true
property is *reachability*: a ceiling equal to the cap is hit exactly when the cap is hit, and the
`>=` comparison at every assertion site fires on it. `HOLIDAY_LIMIT` has been correct at exactly 1000
since ADM-02 for that reason. A strictly-below test would force `HOLIDAY_LIMIT` down as well — which
§ 1 item 9 puts out of scope, because it is not broken and changing a working threshold inside a bug
fix is the shape ADM-04 refused.

**It fails today at exactly the two broken constants and passes after the fix**, which is AC-3.

### 4.4 Why no seam implementation is edited

Both implementations import the constants and compare `rows.length >= LIMIT` — `supabase.ts:1033`
and `:1044`, `:1168` and `:1181`; `mock.ts:1123`/`:1128` and `:1227`/`:1232`. **Once `LIMIT <=
DATASTORE_MAX_ROWS`, those comparisons are correct as written**: `.limit(1000)` is honoured, a
truncating read returns exactly 1000, and the assertion fires. Lowering the constant repairs four
assertion sites across two files without touching either.

**This is what keeps the ticket at two files, and it is also why fix shape (d) was rejected** — (d)
would have rewritten all four sites, added a `COUNT(*)` to every calendar read, and produced a branch
in the mock that is unreachable by construction. § 8 carries that argument.

**`src/lib/data/index.ts` is not edited either.** `ticket.yaml` § 6 lists it conditionally, because
its contract comments at `:352` and `:433` promise a throw *"on a possibly-truncated answer"* that
today cannot happen. **After this change the promise becomes true without the sentence changing**, so
the file stays shut.

## 5. Seam impact

**None.** No function in `src/lib/data/` is added, removed, renamed or changed in signature or return
type; neither implementation file is opened; `tests/seam-parity.test.ts` passes unedited (AC-7).

**What changes is behaviour under load, not contract**: two reads that previously returned a short
list now raise, which is what their own contract comments already say they do and what the four
parent criteria require. No caller changes — every call site reads the same identifier and gets a
different integer.

**This is not XL**, and `ticket.yaml` § 7 anticipated the question. `.ai/01-operating-model.md:375`
escalates a ticket that changes a shared type module, and `src/lib/domain/types.ts` is one; the
established reading, written by ADM-06 at `types.ts:503-505` on the CAL-04, ADM-02, CAL-08 and ADM-04
precedent, is that **the test is whether existing callers must change**. Changing a constant's value
changes no signature and no shape, and adding `DATASTORE_MAX_ROWS` adds a name and changes nothing
existing. **The falsifier is recorded too**: fix shape (c) would change how the seam behaves under
load in a way callers must follow, and that shape is not taken.

## 6. Schema delta

`none`. No migration, no policy, no trigger, no constraint, no column, and nothing under `supabase/`
is opened. ADR-014 does not engage.

`requires_adr: false`, and it is scoped rather than assumed: `ticket.yaml` § 4 flips this field to
`true` and the verdict to `BLOCKED` **only** for fix shape (b), raising the project's `max-rows`
setting. § 1 item 2 and § 8 record that (b) was considered and refused, so the guardrail does not
fire. Shapes (a), (c) and (d) all sit inside `requires_adr: false`, and this plan takes (a).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/BUG-002/**"
  - "src/lib/domain/types.ts"
  - "tests/row-limits.test.ts"
```

**Two files outside the ticket folder. `size: S`** — `.ai/01-operating-model.md:372` puts S at up to
six. **`size_estimate` and `size` agree at S**, so ADR-012 never engages.

**`ticket.yaml` § 6 counted its S from five files; this is two, and the difference is § 4.4.** It
lists `src/lib/data/supabase.ts`, `src/lib/data/mock.ts` and `src/lib/data/index.ts` because the
recommended shape (d) would have rewritten four assertion sites and added a `COUNT(*)` to each read.
**Shape (a) repairs those four sites without opening either implementation**, and `index.ts`'s
contract comments become true without being edited.

**The six end-to-end spec headers are deliberately left alone.** § 6 calls this the one scoping
decision that moves S to M, and it is six files either way. They are out because **their
load-bearing claim survives this fix**: the four criteria are still asserted nowhere, and no test can
still make PostgREST cap a read without a provisioned project. What goes stale is the numeral `2000`
in prose — a figure those files derive from a constant they do not import. Correcting six spec files
for one numeral each is churn in files this ticket otherwise never touches, and **AC-10 requires the
suite to pass with no edit to any existing test**, which is a stronger guarantee than six tidied
comments. *Open questions* item 4 records the staleness for whoever next opens each spec.

**`src/lib/data/absence.ts` is out** (§ 1 item 10), and it is worth naming here because a reader who
sees INV-04 in `invariants_touched` will look for it in this list. The defect is upstream of that
file and the fix must not reach into it.

## 8. Rejected alternatives

**1. Shape (d) — detect truncation with `count: "exact"`, changing neither constant.** `ticket.yaml`
§ 3's recommendation, and it is genuinely the more general fix: comparing `count > LIMIT` and
`rows.length < count` detects truncation whatever the cap is, so it survives someone lowering the
project's `max-rows` — the fragility *Open questions* item 3 admits shape (a) keeps. **Rejected on
three grounds.** It **contradicts § 5's evidence**: with the constants left at 2000 the only test this
ticket can produce still fails after the fix, and the shell recommends both without reconciling them
(§ 0). It **puts a `COUNT(*)` on every calendar read** — the hot path, where ADM-04's paged worklist
is not. And it **creates dead code in the mock by construction**: `mock.ts` slices deterministically,
so `rows.length < count` can never be true there, and the branch would have to be written as
unreachable-and-mirrored with a comment saying so, or the two implementations diverge in shape while
`seam-parity.test.ts` — which compares names and arity only — sees nothing. That is the silent
divergence CAL-04's and CAL-08's rows both warned about, introduced by a bug fix.

**2. Shape (a) with the constants lowered further — to 900, or to 500 to match the roster.** A margin
below the cap looks safer, and it would satisfy a strictly-below test. **Rejected because any value
below 1000 is the guess § 3 objects to**, and it is the only part of shape (a) that would deserve the
objection. 1000 is not chosen for a reason about real teams; it is the largest value a ceiling can
take and still be observable, and every row below it is a row the product was already able to fetch.
Lowering further would refuse reads that succeed today and succeed correctly.

**3. Shape (b) — raise the project's `max-rows`.** It keeps every constant and every screen exactly as
shipped, and it is more reachable than it looks: the CLI is installed, `supabase init` generates a
`config.toml` carrying `max_rows`, and `supabase config push` exists. **Refused, and `ticket.yaml`
§ 4 is the fence.** It would add a repository artifact that does not exist, add a deployment step that
does not exist, and make a product correctness property depend on a value no file in the tree records
and no reviewer can see in a diff — so the next project provisioned starts at 1000 and the constants
are wrong a second time with nobody watching. It also points the wrong way: the setting exists to
limit payload size against a publicly reachable endpoint, and raising it to make one screen work
loosens a control that is not there for that screen's benefit. **Its own argument rests on an
unverified mechanism** — whether `supabase config push` carries `api.max_rows` to a hosted project
cannot be confirmed without a linked project. Had this plan concluded (b) was right, the verdict would
have been `BLOCKED` with `requires_adr: true`.

**4. Shape (c) — page explicitly with `range()`.** The only shape that scales *with* the year view
rather than against it, and it is pre-authorised by CAL-04's plan and ADR-015. **Rejected as this
ticket** because it is a loop inside both implementations that must preserve
`supabase.ts:1166-1167`'s deterministic order and survive seam parity, and because it risks XL on its
own terms: `.ai/01-operating-model.md:375` escalates a changed signature of an existing seam function,
and paging that returns everything changes how the seam behaves under load in a way callers must
follow. **It is the right next ticket, not the wrong answer** — *Open questions* item 2 names it, and
this fix makes its absence visible as a refusal instead of invisible as a wrong number.

## Changelog

- `2026-09-08T11:13:43+07:00` — plan created. Raised by `tech-lead-design`.
- `2026-09-08T11:13:43+07:00` — **§ 3's recommended fix shape was not taken, and § 7 came back at two
  files rather than the five § 6 counted.** Sections 1 and 2 were drafted against `ticket.yaml`
  before the tree was read. Reading it produced two findings that changed the shape rather than the
  criteria. **First, § 3's recommendation (d) and § 5's proposed evidence contradict one another** —
  (d) leaves the constants at 2000, so the static test § 5 calls the only available proof would still
  fail after the fix; § 8 records the resolution. **Second, lowering 2000 to 1000 costs nothing**,
  because the datastore never returned more than 1000, which dissolves § 3's stated objection to
  shape (a) and makes the repair reach four assertion sites across two seam files without opening
  either. **No acceptance criterion was reshaped to fit that**: AC-4, AC-5 and AC-6 describe the
  behaviour the four parent criteria already require, and AC-8 exists to forbid the cheapest way to
  make this ticket look done. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
