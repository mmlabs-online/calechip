---
stage: TRIAGE
agent: product
produced_at: 2026-09-08
inputs_read:
  - .ai/steward/context.md
  - CLAUDE.md
  - .ai/templates/idea.md
  - .ai/board/ideas/2026-09-01-the-end-to-end-suite-does-not-pin-which-seam-it-drives.md
  - .ai/board/backlog.md
  - .ai/board/tickets/ADM-04/01-plan.md
  - .ai/board/tickets/CAL-04/01-plan.md
  - .ai/board/tickets/BUG-001/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/decisions/ADR-027-the-datastore-becomes-sqlite-behind-a-written-server.md
  - .ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md
  - .ai/standards/git-conventions.md
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/routes/MonthView.tsx
  - src/routes/WeekView.tsx
  - src/routes/YearView.tsx
  - src/routes/TeamEntries.tsx
  - src/routes/EditEntry.tsx
  - src/components/OverloadWarning.tsx
  - playwright.config.ts
  - node_modules/.pnpm/@supabase+postgrest-js@2.112.4/node_modules/@supabase/postgrest-js/dist/index.d.mts
consulted: [tech-lead-design]
gate: PASS
blocking_reason: ""
next_state: BACKLOG
---

# Two row limits sit above the cap they were written to stay under

## Problem

**Nobody looking at the month grid can tell a correct absence count from a wrong one, and nothing in
the product will ever tell them.** The count is the product — `.ai/board/tickets/CAL-04/01-plan.md:143`
says so in those words — and the one mechanism built to refuse an incomplete count cannot fire.

Every list read on the seam asks the datastore for an explicit number of rows and refuses to answer if
it gets that many back. The refusal exists because a truncated read and a genuinely short read are the
same bytes: PostgREST caps rows server-side and returns 200 with a believable short list and no error
(`src/lib/data/supabase.ts:1042-1043`). Five such ceilings are declared in `src/lib/domain/types.ts`,
and **each one states in its own comment that it must sit below the datastore's cap so that the
assertion fires before the server's silent one does.** Two of them do not.

| Constant | Value | Declared at | Against a cap of 1000 |
|---|---|---|---|
| `ROSTER_LIMIT` | 500 | `types.ts:173` | Below. The assertion fires first, as designed |
| `OWN_ENTRY_LIMIT` | 500 | `types.ts:230` | Below. Holds |
| `HOLIDAY_LIMIT` | 1000 | `types.ts:377` | **Exactly equal.** Holds only because the comparison is `>=` |
| `TEAM_ENTRY_LIMIT` | 2000 | `types.ts:251` | **Above. The assertion is unreachable** |
| `MONTH_ENTRY_LIMIT` | 2000 | `types.ts:300` | **Above. The assertion is unreachable** |
| `PENDING_PAGE_SIZE` | 50 | `types.ts:497` | Below, and it is a window rather than a ceiling — it pages |

The cap is **1000**, and it is the platform default rather than a guess:

> `node_modules/.pnpm/@supabase+postgrest-js@2.112.4/node_modules/@supabase/postgrest-js/dist/index.d.mts:3522`
> — *"By default, Supabase projects return a maximum of 1,000 rows. This setting can be changed in
> your project's API settings."*

### The assertion is dead code, in four places

The refusal is written the same way at every site: `rows.length >= LIMIT`, in both seam
implementations —`src/lib/data/supabase.ts:1044` and `:1181`, `src/lib/data/mock.ts:1128` and `:1232`.

The server truncates at 1000, so `rows.length` for those two reads **can never exceed 1000**, and the
throw needs 2000. Both branches are unreachable. The read comes back short, comes back as a success,
and is handed to `absenceCountsFor` — which sums exactly what it was given, because it is a pure
function over rows (`.ai/registry/features.md:100`) and has no way to know the list was cut. The
number on the screen is lower than the truth, a day that was overloaded renders normal, and nothing
anywhere reports it.

The comments beside the two dead assertions describe this failure precisely, which is what makes it a
defect rather than an oversight. `src/lib/data/supabase.ts:1175-1180`:

> *"AC-11, and it is the sharpest instance of an assertion this file already makes three times.
> PostgREST caps rows server-side and answers a believable short list with no error anywhere; every
> other read that happens to loses a row from a list, where the gap is at least visible. This one gets
> SUMMED, so a truncated read produces a lower count, a day that was overloaded renders normal, and
> nothing anywhere says so."*

The code says what will happen. The constant beside it guarantees it happens.

### CAL-04 AC-11 is the acceptance criterion that is not held

`.ai/board/tickets/CAL-04/01-plan.md:138-143`, in full:

> **AC-11 — an incomplete read is refused rather than rendered**
> - **Given** the datastore returns fewer entry rows than exist for the requested range because a
>   server-side row cap truncated the result
> - **When** the grid would be rendered
> - **Then** the screen shows a failure state and **no count is displayed**. A capped read sums what it
>   was given and produces a believable wrong answer with no error anywhere; a wrong count on this
>   screen is worse than no screen, because the whole product is the count.

The criterion is correct. The code does not hold it. That distinction is the whole shape of this
problem and it is the reason nothing in `01-plan.md` should be edited to make it go away.

### The seam's published contract asserts a throw that cannot happen

This is not only an implementation gap. The interface itself states the guarantee, twice, for methods
that no longer provide it:

- `src/lib/data/index.ts:506-509` — *"THROWS on a transport failure and on a possibly-truncated
  answer… AC-11 is that throw: a capped read SUMS what it was given and produces a believable wrong
  answer with no error anywhere, and on this screen the count is the product."*
- `src/lib/data/index.ts:430-433` — the same sentence for `listTeamEntries`, *"which is the failure
  `TEAM_ENTRY_LIMIT` exists to turn into an error."*

A caller reading the seam contract is entitled to rely on both sentences. Neither is true today.

### It is four surfaces and a form, not one screen

`MONTH_ENTRY_LIMIT` does not bound the month grid alone. Every caller of
`listTeamEntriesOverlapping` inherits it:

| Caller | Read range | Ticket |
|---|---|---|
| `src/routes/MonthView.tsx:214` | one month | CAL-04 |
| `src/routes/WeekView.tsx:254` | one week | CAL-05 |
| `src/routes/YearView.tsx:167` | **one year** | CAL-06 |
| `src/components/OverloadWarning.tsx:166` | the draft's date range | CAL-07 |

The reuse is deliberate and recorded — `src/routes/YearView.tsx:174` and `src/routes/WeekView.tsx:261`
both name `MONTH_ENTRY_LIMIT` as *"reused rather than joined by a second constant"*. So **the year
view reads a whole year against a number that was sized for a month**, and it is the read with the
largest legitimate row count in the product: `.ai/registry/features.md:102` carries the brief's own
target of *"thirty members and 365 columns"*.

`TEAM_ENTRY_LIMIT` bounds two more: `src/routes/TeamEntries.tsx:76` and `src/routes/EditEntry.tsx:84`,
the read an admin uses to reach another member's row. Truncation there hides an entry from the one
person able to correct it — `src/lib/data/supabase.ts:1040-1042` says exactly that.

**CAL-07's failure has a direction, and the direction is the worst one.** Its registry row already
worked it out (`.ai/registry/features.md:103`): *"PostgREST's server-side row cap can only make the
count too low, so it can only suppress a warning and never raise a false one — a feature whose entire
value is the warning appears has a silent failure mode pointing at no warning. The read must assert
completeness or page, per CAL-04."* The read does not assert completeness. The whole point of the
feature is a warning that appears, and the failure mode is that it quietly does not.

### `HOLIDAY_LIMIT` holds by one row, and by accident

1000 against a cap of 1000 is not below the cap; it is level with it. The assertion survives only
because the comparison is `>=` rather than `>`, so a capped 1000-row answer trips it on the last row.
That is a true statement about today that nobody chose, and it stops being true if the comparison is
tidied, if the project's `max-rows` is ever lowered, or if the constant is nudged for any unrelated
reason. `.ai/board/tickets/ADM-04/01-plan.md:291` recorded it in the same words: *"it works — by one
row, and by accident."*

### Why this is stated as a problem and not as a patch

Two characters would move the numbers. That is not the decision. The cap is **per-project
configurable** by the client's own documentation, four consumers with different legitimate row counts
share one of the two constants, and the read with the largest range is the one a lower ceiling breaks
first. Which number moves — the constant, the project setting, or the shape of the read itself — is
the whole content of this work, and it is left open below.

## Who has it

- **Every member and admin on the month, week and year screens, on any range whose team holds more
  than 1000 overlapping entry rows.** They are not told they have it; that is the defect. The number
  renders, it is plausible, and it is low.
- **The year view is where the ceiling is reached first**, and by a wide margin — it is the only read
  whose range is 365 days. Order-of-magnitude arithmetic against the brief's own target of thirty
  members, **stated as arithmetic and not as a measurement**: a member who records a recurring
  work-from-home day one date at a time produces one row per occurrence (a contiguous range declared
  in one action is one entry, `.ai/registry/features.md:97`), so two WFH days a week is roughly a
  hundred rows a year for one person. Thirty such members is roughly three thousand, against a cap of
  one thousand. The month view's own range makes it roughly a twelfth of that and it is correspondingly
  safer.
- **A member creating or editing an entry, at CAL-07's overload warning** — the one surface where the
  failure is a warning that does not appear rather than a number that is wrong.
- **An admin reaching another member's entry** through `src/routes/TeamEntries.tsx:76` or
  `src/routes/EditEntry.tsx:84`, where the loss is an entry that appears not to exist.
- **Every developer who checks whether a read is protected.** They find an explicit `.limit()`, a
  length assertion and a four-line comment explaining the hazard, and conclude the read is guarded.
  Everything they read is real; only the arithmetic between two numbers is wrong.

**How often is not known, and this idea does not claim it is.** No row-count measurement of a live
team exists anywhere in this repository. What is known and dated is that the detector has been
disabled since CAL-03 and CAL-04 shipped, and that the count it protects is the product.

## Evidence

Every item below was read on disk during this triage. Nothing here is recalled.

**1. The constants.** `src/lib/domain/types.ts:251` — `export const TEAM_ENTRY_LIMIT = 2000;`
`:300` — `export const MONTH_ENTRY_LIMIT = 2000;` The other four are at `:173`, `:230`, `:377` and
`:497`, with the values in the table above.

**2. The cap, read off the installed client rather than recalled.**
`node_modules/.pnpm/@supabase+postgrest-js@2.112.4/node_modules/@supabase/postgrest-js/dist/index.d.mts:3522`
— *"By default, Supabase projects return a maximum of 1,000 rows. This setting can be changed in your
project's API settings."* `.ai/standards/tech-stack.md` lists Supabase as past reliable recall, which
is why the number is quoted from the package on disk.

**3. Both constants contradict their own comments.** `types.ts:245-247` for `TEAM_ENTRY_LIMIT`:
*"It must sit BELOW the datastore's own `max-rows` cap or the assertion never fires and the server's
silent truncation happens first."* `types.ts:285-289` for `MONTH_ENTRY_LIMIT`: *"it must sit BELOW the
datastore's own `max-rows` cap so a truncated read is detectable here rather than invisible… a capped
read SUMS what it was given and produces a believable wrong count with no error anywhere, and on this
screen the count is the product."* Both also still carry a `TODO(verify):` for a cap that has since
been verified (`types.ts:248-250`, `:296-298`).

**4. The assertion, at all four sites.** `rows.length >= TEAM_ENTRY_LIMIT` at
`src/lib/data/supabase.ts:1044` and `src/lib/data/mock.ts:1128`; `rows.length >= MONTH_ENTRY_LIMIT` at
`src/lib/data/supabase.ts:1181` and `src/lib/data/mock.ts:1232`. The Supabase site's error string ends
`(CAL-04 AC-11)` (`supabase.ts:1184`) — the code names the criterion it cannot satisfy.

**5. The criterion.** `.ai/board/tickets/CAL-04/01-plan.md:138-143`, quoted in full above.

**6. It was found by ADM-04's PLAN and deliberately not fixed there.**
`.ai/board/tickets/ADM-04/01-plan.md:275-302` carries the verification, the same five-row table, and
the refusal, in its own words: *"This is a defect in shipped CAL-03 and CAL-04 behaviour, not in this
ticket… `src/lib/domain/types.ts` is in this ticket's `allowed_paths` for its own two new shapes, and
changing two numbers there would silently alter two other tickets' acceptance criteria inside a ticket
whose `invariants_touched` is `[]`. **It wants a `BUG` row of its own**, and `/triage` issues those.
The cap is per-project configurable, so the fix is a decision about which number moves."* That
judgement was correct and this idea does not revisit it.

**7. It is recorded in the shipped code as an unpaid debt.** `src/lib/domain/types.ts:488-496`, the
comment on `PENDING_PAGE_SIZE`, is the one constant written after the cap was known: *"for the first
time in this file that number is known rather than deferred… 01-plan.md section 2, Open questions item
4 records that two of those five sit ABOVE the cap and are therefore not held; fixing them is not this
ticket's, and it wants a BUG row of its own."*

**8. The board has owed the row since 2026-09-05 and names it twice.**
`.ai/board/backlog.md:352-362` carries the finding from ADM-04's ship, and
`.ai/board/backlog.md:278-282` repeats it as item 1 of three things *"already written down and waiting
for that door"* now that the ordered table is empty for the first time
(`.ai/board/backlog.md:265-267`). Both entries state that nothing on this board issues the row
automatically.

**9. No test in this repository can go red on it, and none could be made to without new machinery.**
`playwright.config.ts:50` pins `VITE_DATA_SEAM: "mock"` for the whole acceptance suite, and the mock's
own assertions say they are decorative: `src/lib/data/mock.ts:1125-1127` and `:1230-1231` — *"this
array is bounded by the fixtures so it never fires, and it is here so the two implementations tell one
story rather than because the mock can truncate."* The only implementation that can truncate is the
one no runner drives. This is a fact PLAN needs before it writes a test plan, not a reason to widen
the ticket.

**10. Supabase is in force and the cap is live.** ADR-027, which proposed replacing the datastore, is
`WITHDRAWN by the operator` — 2026-09-04, within the hour, before the file entered any commit
(`.ai/registry/decisions/ADR-027-the-datastore-becomes-sqlite-behind-a-written-server.md:11`). There
is no pending change that would remove this cap on its own.

**Visual reference: none.** No image is attached, and none would settle anything here: the failure
renders as a number that looks entirely correct. There is nothing to see, which is the problem.

## Impact if ignored

**The month grid keeps producing believable wrong counts on any team large enough to reach the cap,
and the product's central claim — a crowded day is visible while it is being created — inverts.** A
truncated read can only lower a count, so the direction of the error is always toward *this day looks
fine*. The failure never announces itself and never over-warns; it under-warns, quietly, on exactly
the busy months the feature exists for.

**CAL-04 AC-11, CAL-05 AC-15 and CAL-06 AC-14 stay unsatisfied while every ticket that owns them reads
`DONE`.** All three shipped with one implement cycle and no rework
(`.ai/registry/features.md:100-102`), and all three route truncation to the refusal branch that cannot
be entered — `src/routes/YearView.tsx:172-180` and `src/routes/WeekView.tsx:259-267` catch the throw
and render `phase: "unavailable"`. Those failure states are written, tested against transport errors,
and unreachable for the case they were named after.

**CAL-07's warning stops appearing before anyone notices it stopped.** Its registry row already
identifies this as the feature's silent failure mode and already requires the read to assert
completeness or page.

**Four `throw` statements and five explanatory comments continue to read as protection.** This is the
part that compounds: the next reader — human or agent — who asks *is this read guarded?* finds an
explicit limit, a length check and a paragraph explaining server-side truncation, and correctly
concludes the hazard was handled. The documentation of the defence is complete; only the defence is
absent. Every future ticket that adds a read will copy this shape.

**`HOLIDAY_LIMIT` is one edit away from joining them**, and the edit that breaks it does not look like
a change to a limit. Tightening `>=` to `>` anywhere in the seam, or lowering the project's `max-rows`
setting, silently disables ADM-02's and CAL-08's truncation refusal too — and
`src/routes/YearView.tsx:177-179` records that a dropped holiday row is worse than local, because it
removes the *following* day's bridge mark.

**The debt outlives the memory of it.** It has been carried in four places for three days —
`types.ts`, `ADM-04/01-plan.md`, and twice in `backlog.md` — because no mechanism promotes a recorded
finding into work. `.ai/board/backlog.md:269-273` states the consequence plainly: the ordered table is
empty, nothing in the loop produces work on its own, and the loop does not restart until a row is
written.

## Constraints already known

Cited, not chosen. Each of these bounds what the eventual ticket may do.

- **This is a defect, and `ADR-028`'s boundary test puts it in the `BUG-nnn` series at step 1.**
  `.ai/registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md:65-68` — *"Does something written
  down say what this surface should be, and does the surface not match it? Then it is a defect —
  `BUG-nnn`. A stated acceptance criterion, an invariant, or a standard the surface was built against.
  The signal is that a reader can point at the contradiction without exercising taste."* CAL-04 AC-11
  is that written criterion and the contradiction is two integers. It is not `UIE` — nothing visual is
  being improved — and not a capability group, because the product gains nothing it could not do
  before.
- **`BUG` is a ticket ID scheme and not a feature prefix.** `ADR-028:36-39` records that `BUG-nnn` and
  `OPS-nnn` appear on no prefix line in `.ai/registry/features.md`, have no rows, and are **not
  policed by check D1**; `ADR-028:103` — *"`BUG-001` likewise stays. Nothing already issued moves."*
- **`.ai/registry/features.md` is the only valid source of feature IDs (`CLAUDE.md`), and this idea
  carries none.** An idea has no ID. Whatever ID this work eventually takes, and whichever shipped
  feature row it is traced to, is decided at triage and not here.
- **The precedent for a bug ticket's branch is settled and was an operator decision.**
  `.ai/standards/git-conventions.md:32` gives the pattern `bugfix/BUG_<FEATURE-ID>_<NN>`, and
  `:44-49` records that **`bugfix/` runs with the path guard disabled, and that this is a defect
  rather than a decision** — both resolvers hard-code `feat/`. `.ai/board/tickets/BUG-001/ticket.yaml:19-24`
  records the operator's answer of 2026-09-03: `branch: "feat/BUG-001"`, chosen so that
  `allowed_paths` is enforced in CI. That matters here more than it did there — this ticket touches
  shipped application code in three files rather than a test harness.
- **The cap is per-project configurable**, by the installed client's own documentation
  (`index.d.mts:3522`). So *lowering the constants* and *raising the setting* are both available and
  they are not equivalent: one lives in the repository and one does not.
- **`src/lib/domain/types.ts` is a shared type module, and `.ai/01-operating-model.md:375` has a
  clause about changing one.** `types.ts:432-435` records how the last four tickets stayed clear of it
  — they *added* shapes and changed none, so no existing caller changed. This work changes existing
  values that six call sites already read, which is the opposite case.
- **RULE-02 — the seam is `src/lib/data/`.** Any paging, `range()` loop or completeness check lives
  inside the seam or in the constants module it already imports. No component may reach past it, and
  `src/lib/domain/types.ts:163-166` records why the constants sit in `domain/` rather than in the seam:
  both implementations need them at runtime and `index.ts` imports both, which would be a load-time
  cycle.
- **INV-04 has exactly one implementation and nothing here may create a second.**
  `absenceCountsFor` in `src/lib/data/absence.ts` is pure and takes rows
  (`.ai/registry/features.md:100`), with three consumers and one implementation
  (`.ai/registry/features.md:102`). It therefore **cannot** detect truncation itself — completeness has
  to be established before it is called, which is why the check is in the seam.
- **ADR-005 — the browser talks to PostgREST directly and there is no server.** There is no
  server-side place to page, cache or pre-aggregate on a caller's behalf; whatever is done is done in
  the browser or in the datastore's own configuration.
- **ADR-011 fixed what the month read filters on** — the generated `date_range` column with `ov.`
  (`src/lib/data/supabase.ts:1165`) — and the read carries a deterministic order,
  `start_date` then `id` (`supabase.ts:1166-1167`). Any paging strategy depends on that order being
  stable and must keep both seam implementations in step, which `tests/seam-parity.test.ts` exists to
  police.
- **ADM-04 already demonstrated a mechanism that detects a lowered cap without knowing its value** —
  the short-page assertion described at `src/lib/domain/types.ts:482-496`. It is cited so PLAN starts
  from what was already reasoned; **it is a shape recorded in a comment, not a design**, and PLAN is
  free to reject it.
- **ADR-027 is `WITHDRAWN`**, so no alternative datastore is pending and the cap is not going away on
  its own.

## Out of scope

Written now, because this is the ticket most likely to grow at PLAN — everything it touches has a
neighbouring problem that looks like the same problem.

- **Rewriting CAL-04's, CAL-05's or CAL-06's acceptance criteria.** AC-11, AC-15 and AC-14 are
  correct as written. The code does not hold them. Any change that makes the criteria describe the
  current behaviour is the failure this idea exists to prevent.
- **`ROSTER_LIMIT` and `OWN_ENTRY_LIMIT`.** Both are 500, both are below the cap, both assertions
  fire as designed. They are named in this idea only as the contrast that shows the other two are
  wrong.
- **`PENDING_PAGE_SIZE` and ADM-04's paged worklist.** It is a window rather than a ceiling, it is 50,
  it already pages, and its short-page assertion already detects a lowered cap. Nothing about it is
  broken.
- **The absence arithmetic in `src/lib/data/absence.ts`.** INV-04's single implementation is not
  implicated: it sums correctly, over whatever rows it is handed. The defect is upstream of it and the
  fix must not reach into it.
- **Provisioning a real Supabase project so that truncation is observable in an automated test.**
  Standing up a project, seeding more than a thousand rows and wiring credentials into CI is its own
  decision with its own cost, and the 2026-09-01 seam-pinning idea already refused the same expansion
  in its own words — *"a second suite against a real database is a separate decision and needs its own
  project, never the developer's."* How this ticket demonstrates its fix without one is an open
  question below, not a licence to build one.
- **Re-opening the end-to-end seam pinning.** `playwright.config.ts:50` pinning the suite to the mock
  is cited above as the reason no test can currently observe truncation. That pin is deliberate,
  shipped as `BUG-001`, and is not to be loosened here.
- **Refactoring the four assertion sites into a shared helper**, or making the truncation check a
  general policy across every seam read. There are six ceilings and four assertion sites written in
  one style on purpose; consolidating them is a tidy-up with its own risk and it is not what any
  criterion asks for.
- **The three other stale items this board owes**, all recorded at `.ai/board/backlog.md:283-296` and
  none of them this: the bare `TODO(project)` stubs at `.ai/standards/ui-design-system.md` § *Colour*
  and § *Type* plus the `1280px` breakpoint originated at UIE-04 (human plane, `/thuki`'s); the
  product showing two names, *CaleChip* in `index.html:6` and `CLAUDE.md` against *Ai Nghỉ?* on every
  screen; and the `PLAN -> READY` transition that `.ai/01-operating-model.md:285` declares as a loop
  step and **no command runs**.
- **The `bugfix/` path-guard defect itself** (`.ai/standards/git-conventions.md:44-49`). It is cited
  as a constraint and BUG-001's `feat/`-prefixed branch is the settled way around it. Fixing the two
  resolvers is human-plane model work with its own tests.
- **Anything about `HOLIDAY_LIMIT`'s consumers.** ADM-02's and CAL-08's reads hold today. Whether the
  constant's value is touched at all is an open question below; the holiday feature's behaviour is not
  in question either way.

## Open questions

**The fix shape is genuinely undecided, and this idea deliberately does not choose it.** Four
candidates are known and each has a different cost. They are not mutually exclusive.

1. **Which number moves?**
   - **(a) Lower `TEAM_ENTRY_LIMIT` and `MONTH_ENTRY_LIMIT` below 1000.** Smallest possible change,
     entirely in the repository, reviewable in one diff. **It costs the year view first**, and that is
     the trade-off that decides this question: the year read is the largest legitimate row count in the
     product (thirty members across 365 days, `.ai/registry/features.md:102`), it shares the month's
     constant by deliberate reuse (`src/routes/YearView.tsx:174`), and a ceiling low enough to be
     honest may be low enough that a real team's year hits it — converting a silent wrong count into a
     screen that refuses to render. That is the correct failure and it is still a failure.
   - **(b) Raise the project's `max-rows` API setting.** Keeps every constant and every screen as
     shipped. It lives in a hosted console rather than in this repository, which raises question 3.
   - **(c) Page explicitly with `range()`.** Removes the ceiling as a concept for these reads and is
     the only candidate that scales with the year view instead of against it. It is also by far the
     largest: a loop inside the seam, in both implementations, that must preserve
     `supabase.ts:1166-1167`'s order and survive `tests/seam-parity.test.ts`.
   - **(d) Adopt ADM-04's short-page detection** (`src/lib/domain/types.ts:482-496`), which detects a
     lowered cap **without needing to know its value**. It makes the check robust to the setting rather
     than coupled to it, which is the property every one of the five `TODO(verify)` markers was
     originally waiting for.
2. **Two constants, or three?** `HOLIDAY_LIMIT` at exactly 1000 is not broken and is not safe. Whether
   it moves in this ticket, or is left standing with a comment saying why, is a real choice — leaving
   it is defensible and silently leaving it is not.
3. **If the answer is the project setting, who performs it and where is it recorded?** No agent here
   holds that console, nothing in the working tree would show it changed, and a reviewer cannot check
   it from a diff. It also does not travel: the next project provisioned starts at 1000 again, and the
   constants would then be wrong for a second time with nobody watching.
4. **How does this ticket prove it is fixed?** Every runner drives the mock
   (`playwright.config.ts:50`), and the mock's arrays are bounded by fixtures so its assertion is
   decorative by its own admission (`src/lib/data/mock.ts:1230-1231`). Definition of Done item 4 needs
   every criterion mapped to a named test, and today no test in the tree can exercise a truncating
   datastore. Whether that means a mock that can be told to truncate, a unit test on the seam's
   response handling, or something else, is PLAN's — but it must be answered, or the fix ships with
   the same absence of evidence as the defect.
5. **Does `listTeamEntriesOverlapping` keep one constant for four callers?** The reuse was chosen
   deliberately and the four ranges differ by two orders of magnitude. Splitting it re-opens the
   argument `types.ts:291-294` settled — that one constant serving two reads *"would be raised for
   whichever pressed first and would silently move the other"* — which is an argument for splitting as
   much as against it.
6. **What is the real row count of a live team?** Unmeasured, anywhere. It decides how urgent this is;
   it does not decide whether it is wrong.
7. **Do the five comments get corrected here?** Two of them still carry a `TODO(verify):` for a cap
   that was verified on 2026-09-05 (`types.ts:248-250`, `:296-298`), and `PENDING_PAGE_SIZE`'s
   paragraph (`:488-496`) states as present fact that two limits sit above the cap. Whichever way the
   fix goes, that paragraph stops being true and something has to say so.

---

## Verdict

**PROMOTE**, as ticket **`BUG-002`**, against `feature_ids: [CAL-03, CAL-04, CAL-05, CAL-06]`.

**The reason, in one sentence: four written acceptance statements say what these reads must do, the
code does not do it, and a reader can point at the contradiction without exercising taste — which is
[ADR-028](../../registry/decisions/ADR-028-uie-is-a-fourth-feature-group.md)'s boundary test, step 1,
by name.** That step reads *"Does something written down say what this surface should be, and does the
surface not match it? Then it is a defect — `BUG-nnn`"* (`ADR-028:65-68`). CAL-04 AC-11 is that written
statement, and the contradiction is two integers. It is **not `UIE`** — nothing visual is being
improved, and the failure renders as a number that looks entirely correct — and it is **not a new
capability group**, because the product gains nothing it could not do before.

`tech-lead-design` was consulted (RULE-11) and returned the technical half. Its verdict was PROMOTE
and this triage concurs. Its load-bearing claims were verified on disk in this session rather than
accepted; where this verdict departs from its recommendation, it says so and why.

### The four `/triage` tests

| Test | Answer | Why |
|---|---|---|
| Supersedes or reverses an accepted ADR? | **No** | [ADR-015](../../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md):380 already names the mitigation — *"request with an explicit limit above the widest possible range (366 plus margin) and assert the row count is below it, or use `Prefer: count=exact` and compare"*, verified on disk. Explicit `range()` paging is pre-authorised by `.ai/board/tickets/CAL-04/01-plan.md:177-179`. ADR-027 is `WITHDRAWN` and no datastore change is pending. |
| Changes the registry beyond a `Notes` sentence? | **No** | No new feature row, no invariant, no glossary term, no prefix. Five `Notes` sentences, which RULE-01 permits without an ADR. |
| Touches the schema? | **No** | `schema_delta: none`. ADR-014 is not engaged: no migration, no policy, no trigger, no constraint. The defect is entirely in two integers and the reads that quote them. |
| Requires an ADR? | **No** — `requires_adr: false`, **with one guardrail** | Every fix shape available inside the repository decides inside an envelope that is already open. **One shape does not, and it is fenced off in the ticket shell § 4:** raising the project's `max-rows` setting. If PLAN concludes that is the right answer, the correct verdict from PLAN is `BLOCKED` with `requires_adr: true`, not a quiet configuration change. |

### What is unheld, stated per criterion

The problem section above establishes that two constants sit above the cap. This is what that costs,
criterion by criterion — and it is four written statements, not one.

- **CAL-04 AC-11 — unheld.** `.ai/board/tickets/CAL-04/01-plan.md:138-144`. `src/lib/data/supabase.ts:1168`
  asks for 2000 rows, the server caps at 1000, so `:1181`'s `rows.length >= 2000` can never be true.
- **CAL-06 AC-14 — unheld, and it is the one that matters most.**
  `.ai/board/tickets/CAL-06/01-plan.md:203-207`. The year is the only read whose *legitimate* row count
  plausibly passes 1000: the brief's target is thirty members over 365 columns
  (`.ai/board/tickets/CAL-06/01-plan.md:236`), so the read crosses the cap at roughly 34 entries per
  member per year. **And CAL-06's own plan argued the constant was safe to reuse *because* of the
  failure state it can no longer reach** — `.ai/board/tickets/CAL-06/01-plan.md:378-381`: *"a team that
  outgrows 2000 entries in a year gets AC-14's failure state and not a grid with holes in it."*
  Against a cap of 1000 that reasoning is exactly backwards. `src/lib/data/supabase.ts:1166` orders
  `start_date` **ascending**, so the rows dropped are the **latest** — the far end of the year nobody
  scrolls to until somebody plans Tết, which is the failure `ADR-015:376-377` predicted for holidays
  and which has landed here instead.
- **CAL-05 AC-15 — mechanically unheld, practically near-inert, and both halves are recorded.**
  `.ai/board/tickets/CAL-05/01-plan.md:200-204`. It is falsified by the same constant through the same
  read; it is also the read least likely to reach the cap, because a seven-day range needs a great many
  entries spanning it from outside to accumulate 1000 rows. **"Practically inert" is a statement about
  urgency, not about parentage** — which is why CAL-05 is in `feature_ids` and not merely mentioned.
- **CAL-03 — no acceptance criterion mentions truncation, so none is unheld. What is contradicted is
  its own § 4.1 contract sentence**, `.ai/board/tickets/CAL-03/01-plan.md:307-309`. **This is the
  sharpest case on the board, and it was verified on disk in this session:** `listTeamEntries`
  (`src/lib/data/supabase.ts:1027-1034`) carries **no date filter at all** — it reads the team's entire
  history, forever, so it reaches 1000 before any range-bounded read does. It orders `start_date`
  **descending** (`:1031`), so what falls off is the **oldest**. And `src/routes/EditEntry.tsx:84-86`
  resolves the target entry out of that list and sets `phase: "missing"` when it is absent — so **a
  capped list makes an entry that exists render as deleted, to the one person able to correct it.**
  Second consumer: `src/routes/TeamEntries.tsx:76`.

### CAL-07 AC-21 is vacuously satisfied, and that is the finding

`.ai/board/tickets/CAL-07/01-plan.md:226-230`. Its *Given* is conditioned on the seam refusing, and
under this defect the seam never refuses — so **the criterion stays green while the screen is wrong.**
It is reported here as *an acceptance criterion written so that this defect cannot report itself*.

**It is not scope.** CAL-07 is deliberately absent from `feature_ids`: nothing about it is falsified,
and adding it would widen the ticket on the strength of a criterion that passes. What it is instead is
information about how the next such criterion should be phrased — a completeness assertion conditioned
on the refusal it is supposed to guarantee tests the branch and not the guarantee.

### Two facts about the neighbours, recorded so PLAN does not have to find them

- **`HOLIDAY_LIMIT = 1000` is *equal to* the cap, not below it**, and survives only because the
  comparison at `src/lib/data/supabase.ts:1235` is `>=` and not `>`. One character, or one lowered
  project setting, from a third defect. Whether it moves is open question 2 above and stays PLAN's.
- **`MONTH_ENTRY_LIMIT` serves four reads, not three** — `src/routes/MonthView.tsx:214`,
  `src/routes/WeekView.tsx:254`, `src/routes/YearView.tsx:167`, `src/components/OverloadWarning.tsx:166`.
  `.ai/board/tickets/CAL-06/01-plan.md:377` calls it *"one read serving three callers"*, which was true
  when it was written and is false now.

### The fix shape stays open, and the recommendation is recorded as a recommendation

Open question 1 above is **not answered by this verdict.** `tech-lead-design` recommends **(d) plus
the naming half of (a)** — a `count: "exact"` request compared against the ceiling, together with a
`DATASTORE_MAX_ROWS = 1000` named in the repository and cited to `index.d.mts:3522`. Its argument is
that this fixes **detection without changing either number**, so it reaches into no shipped threshold
and moves no acceptance criterion. Its costs are recorded with it: a `COUNT(*)` on every calendar read,
and one comparison that is dead code in the mock by construction. **That is a recommendation, and PLAN
may reject it.** All four shapes, their costs and the one that is fenced off are carried into
`.ai/board/tickets/BUG-002/ticket.yaml` § 3 and § 4.

One supporting fact was verified on disk because the recommendation turns on it: **`count` returned
alongside `.limit()` is the total number of matching rows, not the size of the page**
(`index.d.mts:3519`). That is what makes a count-based detector work on a ceiling read at all.

### What this creates

**One ticket, `BUG-002`, at `state: BACKLOG`**, with `feature_ids: [CAL-03, CAL-04, CAL-05, CAL-06]`,
`group: CAL`, `branch: "feat/BUG-002"`, `depends_on: []`, `schema_delta: none`, `requires_adr: false`.
`invariants_touched` and `size_estimate` are left empty — they are Definition of Ready items 2 and 5
and they belong to PLAN.

**No new feature row.** `BUG-nnn` is a ticket ID scheme and not a feature prefix: `ADR-028:36-39`
records that it appears on no prefix line, has no rows and is not policed by check D1, and
`ADR-028:103` says *"`BUG-001` likewise stays."* BUG-001's own shell (`ticket.yaml` § 2) is the
precedent and it was followed here. What is written instead is **a provenance sentence appended to the
`Notes` of CAL-03, CAL-04, CAL-05 and CAL-06**, each citing this file and `BUG-002` — the same
substitution BUG-001 made, in the place a reviewer looks.

**Three rows also discharge a marker in the same sentence.** The `TODO(verify):` on Supabase's default
`max-rows` still stood on CAL-04, CAL-06 and ADM-02; the answer is **1000**, verified at
`index.d.mts:3522`, and the discharge follows the sentence ADM-04's row already carries. **ADM-06 was
checked and deliberately not discharged** — its `TODO(verify):` is about whether PostgREST's
`db-max-rows` caps a `PATCH`'s returned representation or its affected rows, which is a second and
independent unknown that this work neither touches nor answers.

### One thing found in passing that is not this ticket's

**`.ai/standards/tech-stack.md:84` is stale.** It records the Supabase CLI as *not installed yet*;
`package.json:39` carries `supabase@^2.116.0`. There is still **no `supabase/config.toml`** in the tree
— `supabase/` holds only `bootstrap.sql`, `db.sql`, `migrations/` and `seed.sql` — which is why fix
shape (b) would *add* a repository artifact rather than edit one. The standards plane is human-only
under RULE-01, so this is reported and not corrected; it is `/thuki`'s.
