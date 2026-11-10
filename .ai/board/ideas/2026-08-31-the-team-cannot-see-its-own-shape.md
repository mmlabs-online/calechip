---
stage: TRIAGE
agent: product
produced_at: 2026-08-31
inputs_read:
  - product_brief.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-007-triage-issues-feature-ids.md
  - .ai/registry/decisions/ADR-008-agents-may-accept-adrs.md
  - .ai/registry/decisions/ADR-010-triage-creates-the-ticket-shell.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/standards/architecture.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/ui-design-system.md
  - .ai/board/backlog.md
  - .ai/board/ideas/2026-08-31-a-plan-has-nowhere-to-be-written-down.md
  - .ai/board/ideas/2026-08-31-a-crowded-day-is-discovered-too-late.md
  - .ai/board/ideas/2026-08-31-everyone-computes-the-bridge-day-alone.md
  - .ai/01-operating-model.md
  - .claude/commands/triage.md
consulted:
  - tech-lead-design
gate: PASS
blocking_reason: ""
next_state: BACKLOG
---

# The team cannot see its own shape at the time-scale the question is being asked at

## Problem

Three different questions get asked about absence, at three different distances, and none of them can
be answered today without reading a chat history:

- **"Who is out this week, and for how much of each day?"** — asked while handing work over.
- **"What does next month look like?"** — asked before agreeing to a date with anyone.
- **"Where are the clusters this year, and who is away a lot?"** — asked once a quarter, by the
  person planning around them.

They are the same data at three resolutions, and a single view answers at most one of them well. A
week view cannot show a cluster in October. A year grid cannot show that Minh is out only in the
afternoon.

The brief writes this as requirement 7.1, a table of three views. The problem it answers is that
**the information exists in the team but has no shape**, so the question is answered by asking people.

## Who has it

- **The lead**, weekly at minimum and before every commitment involving a date. The brief's own target
  is that they answer *"what does next month look like?"* in under ten seconds; today it is a
  conversation.
- **Every member**, each time they consider a date for themselves — which is the moment when seeing
  the cluster is worth something, because the plan is not yet booked.

## Evidence

- Brief goal 3, stated as a time: under ten seconds for the month-ahead question.
- Brief 7.1 gives three named views with distinct users, which is unusually specific for a draft and
  indicates the three questions were observed rather than imagined.
- Brief 7.1's own acceptance note that the year view must stay smooth at thirty people tells us the
  long-range view is expected to be used, not decorative.
- **The charter makes visibility the mechanism, not a permission**: *"a plan nobody can see
  coordinates nothing"*, and every member reads every other member's entries in full. A product
  built on that principle currently has no surface that delivers it.
- INV-05 exists specifically so that a tentative plan is visible and counted. Without a view, it is
  neither.

## Impact if ignored

Entries get recorded and never read, which is worse than not recording them: the team believes the
information is shared while the coordination still happens in chat. The brief's failure signal —
entry rate falling below 50% after the first month — arrives quickly, because nobody keeps feeding a
board they never look at.

The bridge-day pile-up specifically continues, because it is a *pattern across people* and no single
person's entry reveals it.

## Constraints already known

- **`.ai/00-charter.md`** — everyone sees everyone, in full. There is no per-view privacy setting to
  design and no filtered variant for members.
- **INV-04** — any count of people absent on a date that appears in any view is the one definition,
  including half-days at 0.5 and PTO and WFH counted alike. A view that computes its own number is
  the failure this invariant exists to prevent, and the brief expects the number in at least three
  places.
- **INV-05** — tentative entries appear and count. They are distinguished visually only.
- **`.ai/standards/ui-design-system.md`** and `CLAUDE.md`'s visual direction: the calendar grid is the
  most-used screen and **information density wins there every time**. ~~The pastel treatment, the
  dashed border for tentative, the star for approved, and the Vui/Gọn density toggle are already
  specified there — this idea does not re-decide them.~~ **Corrected at triage, 2026-08-31 — the
  claim was false when written and it was `product`'s error.** `.ai/standards/ui-design-system.md` is
  still the shipped stub: `doc_version: 2`, `last_updated: 2026-08-25`, and every section a
  `TODO(project):`. The palette exists only as prose in `CLAUDE.md` — peach, mint, lavender, a soft
  pink that is deliberately not an alarming red, a dashed border at reduced opacity for tentative and
  a small star for approved — **with no hex values**, and the Vui/Gọn density toggle is named there
  and defined nowhere. This idea still does not re-decide any of it, but it cannot cite a design
  system that has not been written: the first view built will fix the palette the other two inherit.
  Recorded as a steward chore in the verdict below.
- **INV-07** — a view is drawn for one team's members. v1 has one team; the query is still scoped.

## Out of scope

- **Read-only calendar subscription (iCal) and export to CSV or Excel.** Both P1, both a different
  problem: taking the data somewhere else rather than seeing it here.
- **The weekly digest posted to Slack, Teams or Zalo.** P1.
- **The overload warning raised while choosing a date.** A separate idea. Marking a day that is
  already overloaded is part of this one; interrupting someone mid-choice is not.
- **Year-end recap.** P2.
- **Any filtering by role, project or constraint.** P2.

## Open questions

1. **Does switching views hold the date the user was looking at?** The brief lists this as an
   acceptance criterion for 7.1. It is recorded here as an open question only because it implies
   shared time-anchor state across three surfaces, which is a design consequence rather than a
   preference — naming it now stops it appearing during DESIGN.
2. **Does a removed member still occupy a row in the year view for the part of the year they were
   present?** Their entries stay (operator decision, 2026-08-31), so the data is there; whether the
   roster shows them is undecided, and the year view is one row per person.
3. **Which view opens by default, and is it the same for both roles?** The brief calls the month view
   the default; it does not say whether a lead opening the product wants the same thing.
4. **How far back and forward can a person navigate?** The product is about the future, but the
   success measures compare quarters, which implies looking backwards.

## Triage verdict: PROMOTE

**Decided 2026-08-31 by `product` and `tech-lead-design`**, running the two halves of triage
independently and then reconciling. Three feature rows were written to
[.ai/registry/features.md](../../registry/features.md) under ADR-007 — **CAL-04**, **CAL-05** and
**CAL-06** — each citing this file in `Notes`, and a ticket shell and a backlog row exist for each
under ADR-010.

**Both halves reached PROMOTE independently**, with the same three rows in the same order and
near-identical titles. Four differences were settled by the coordinator and are recorded below where
they land, rather than collected into a disagreement section: this triage did not have the argument
the previous one did.

### No ADR was needed, and the reason is that the one ADR-shaped question was already answered

The question this idea raises is *where the absence count is computed*, because the number now
appears on three surfaces at once. It is answered, twice, in words that name this idea's own
surfaces. [.ai/standards/architecture.md](../../standards/architecture.md):

> **The absence count is computed in exactly one place** (INV-04). That place is inside the seam, so
> that the live warning, the month cell, the year grid and any future notification all read the same
> function rather than four arithmetics that agree until one of them is edited.

[.ai/standards/data-model.md](../../standards/data-model.md)'s *Where invariants are held* says the
same in one line: *a single function inside the seam*. INV-04 fixes the **uniqueness** of the
definition; those two files fix its **address**. Nothing about it is undecided — it is unbuilt, and
those are different states. The read path is likewise decided:
[ADR-011](../../registry/decisions/ADR-011-inv-01-exclusion-constraint.md) created `date_range`
**specifically** so that *entries overlapping this month* is one PostgREST filter on a named column,
which is this idea's central read.

**The ADR-008 test was available and did not fire.** Under ADR-008 either half could have drafted and
self-accepted a decision sitting inside ADR-005's envelope, as `tech-lead-design` did for ADR-011
that morning. Named so the absence is legible rather than assumed: **the one alternative that would
have fired it is holiday scoping.** Rendering holidays in a view means querying `holiday`, and
`data-model.md` OPEN QUESTIONS item 1 — per team or national — declares itself blocking on *"the
first story touching holidays, and the `holiday` foreign key"*. Answering it inside this triage was
possible and was refused: the three views do not need holidays to answer their three questions, so
holiday and bridge-day shading are out of scope here (below) and the decision stays with the feature
that owns it. **A row must not inherit a blocking open question it does not own.**

### The rows, and the basis for the split

| ID | The question it answers (brief 7.1) | The unit it renders |
|---|---|---|
| CAL-04 | *What does next month look like?* — the default view | A day cell: absent members' avatars, and an overloaded state |
| CAL-05 | *Who is out this week, and for how much of each day?* | A person: half-day, note, and who approved |
| CAL-06 | *Where are the clusters this year?* | A member band across 365 columns |

Build order is CAL-04, CAL-05, CAL-06. Size is Definition of Ready item 5 and the BA's at SPEC; the
only thing recorded here is that one row holding all three would not survive it.

**The permission test could not discriminate, and saying so is part of the answer.** The earlier
splits in this repository were settled by
[.ai/standards/rbac-and-security.md](../../standards/rbac-and-security.md) — CAL-02 and CAL-03 are
two rows because *Edit or delete their own entry* and *Edit or delete another member's entry* are two
rows in that table. Here **one row covers all three views**: *Read any entry in the team*, ✅ for both
roles. The test that settled the earlier splits returns nothing, so a different basis has to be
stated rather than borrowed.

**The stated basis: the question answered and the unit rendered, plus the dependency carried.** That
is what changes the query, the component and the acceptance criteria. Week and month are *not* one
screen at two ranges — the month cell shows a count and a state, the week row shows people and
portions — and this idea's own Problem section says why: *"a week view cannot show a cluster in
October. A year grid cannot show that Minh is out only in the afternoon."* CAL-06 additionally
carries the half of the old test that does still apply: it is the only view that enumerates members
with **no** entries, which is why `Read the member list` exists in the permission table at all — a
row recorded there as **derived from this layout and awaiting confirmation**, which is a recorded gap
and is exactly what the test says to keep separate.

### The four open questions, dispositioned — and a fifth

1. **Does switching views hold the date the user was looking at? Not open — the brief states it**, as
   an acceptance criterion of 7.1: *"Chuyển view giữ nguyên mốc thời gian đang xem."* Story-level, and
   `tech-lead-design` found the mechanism in the prototype rather than leaving DESIGN to re-derive it:
   the anchor is **in the URL** — `/week/:yyyy-MM-dd`, `/month/:yyyy-MM`, `/year/:yyyy` — and a switch
   converts it. The ordering trap, because it is not obvious: the criterion is only **testable** once
   two views exist, but the anchor must be **built** by the first one, so it is an acceptance criterion
   on CAL-04 that CAL-05 and CAL-06 verify.

2. **Does a removed member still occupy a row in the year view? Genuinely open, and it blocks CAL-06
   reaching READY.** The one `TODO(project):` on that row. It is not ADR-shaped — no schema, no
   registry text, no dependency; it is the filter on a roster query. `product`'s recommendation for a
   one-word answer: **show them**, visually distinguished. The year view is the one layout where
   hiding the member hides the entries, and the operator decided on 2026-08-31 that a removed member's
   entries stay visible. They are never in the denominator either way — `removed_at is null` is what
   *current member count* means.

3. **Which view opens by default, and is it the same for both roles? Not open.** The brief answers the
   first half — *Tháng: xem mặc định*. The second half is answerable from the registry rather than
   from the operator: the permission table gives both roles one identical read row, and
   `.ai/00-charter.md` says *"reading is not a privilege here"*. A role-dependent default would be the
   first place the two roles diverge on reading, which is the thing that charter sentence refuses.
   **Same for both.** Story-level acceptance criterion.

4. **How far back and forward can a person navigate? Open, blocks nothing, story-level.**
   Recommendation: **unbounded**, because every candidate bound would be invented — nothing in the
   product stores a horizon. The real limit is data, not navigation: beyond the holiday seed the grid
   simply has no holidays, and
   [2026-08-31-everyone-computes-the-bridge-day-alone.md](2026-08-31-everyone-computes-the-bridge-day-alone.md)
   already records the requirement that *an empty year must be visible as empty rather than as a year
   with no holidays*. Cross-referenced, not marked.

5. **New, and found by both halves: is a `rejected` entry drawn in any view at all?** INV-04 settles
   that it is **excluded from the count**. Nothing anywhere settles whether it is **rendered**. Those
   are two different decisions and the second has never been taken — a grid showing a rejected entry
   beside a count that excludes it looks like a bug in the count. Marked `TODO(project):` on CAL-04;
   CAL-05 and CAL-06 inherit the answer.

### Invariants, with the mechanism per ID

`Invariants touched` is **INV-04, INV-05, INV-07** on all three rows.

| ID | Held by | Where |
|---|---|---|
| INV-04 | One pure function in a shared module inside `src/lib/data/`, per architecture.md and data-model.md | CAL-04 builds it; CAL-05 and CAL-06 call it |
| INV-05 | Follows from INV-04 having one implementation — `tentative` is not consulted by it, and is a border style and nothing more | All three, and all three must not let *dashed and faded* become *does not really count* |
| INV-07 | The read is scoped to the member's own team; v1 has one team and the query is still scoped | All three |

**INV-06 was proposed by `product` and dropped, on `tech-lead-design`'s argument, which is the
correct one.** A read-only view cannot produce a per-day portion, so nothing about INV-06 is
*chosen* here and listing it would be over-declaring. The observation survives as prose in CAL-05's
`Notes`, where it is a rendering requirement: **a five-day `pm` entry is five afternoons**, and the
week view is the only surface on which that is visible per day.

**INV-04 and the circular-reasoning warning.** `.ai/registry/invariants.md` says the list records what
a change **could** affect, and that choosing the safest behaviour and then concluding no invariant is
engaged is circular. `tech-lead-design` applied it to CAL-05, which may render no number at all: the
week view presents **the same set the count sums**, so a week list disagreeing with a month cell —
four names against 3.5 — is precisely the divergence INV-04 exists to prevent. The safe behaviour
(consume the function, never count names) is the evidence the invariant is in play, not the reason to
omit it.

**INV-01, INV-02 and INV-03 are not engaged, stated rather than left blank.** These three rows write
nothing: no insert, no update, no delete, no policy that permits one. The exclusion constraint, the
trigger and the check are CAL-01's.

### Three technical findings that must reach the stories

From `tech-lead-design`'s half. Each is the difference between a story that works and one that is
plausibly wrong, and none of them is visible from the product side.

1. **A truncated result set makes INV-04's number silently low.** Under ADR-005 the browser reads
   PostgREST directly, and PostgREST enforces a **server-side row cap**. If the calendar read is
   capped, the count function sums what it was given and returns a number that is wrong with no error
   anywhere. **This is the only failure mode in the feature that produces a believable wrong answer
   rather than a visible break** — a month that looks fine and is not. The seam function must either
   assert completeness or page explicitly. `TODO(verify):` Supabase's default `max-rows`; no project is
   provisioned and `tech-stack.md` lists Supabase as past reliable recall. **CAL-04.**

2. **The seam-parity trap.** The seam has two implementations that a parity test compares. If
   `supabase.ts` and `mock.ts` each carry their own absence-count arithmetic, **the parity test
   passes** — same exported names, same arity — while INV-04 is violated, because two implementations
   of the definition now exist. `.ai/standards/architecture.md` already warns that parity is necessary
   and not sufficient; this is that warning arriving at a specific invariant. The count must be a pure
   function in a shared module inside `src/lib/data/`, imported by both and reimplemented in neither.
   **CAL-04.**

3. **The prototype is not evidence, and copying it reproduces INV-04's failure twice.**
   `_figma/src/App.tsx` computes the absence count **inline in two separate places**, with a
   hard-coded denominator and threshold, and never consults `status` — so a rejected entry counts,
   contradicting INV-04 directly. It also renders **48 random dots per person** rather than the 365
   columns brief 7.1 requires, so the *thirty people, still smooth* target has never been demonstrated
   at the specified shape. Said out loud in CAL-06's `Notes` because the Developer is told to read that
   file. **CAL-06.**

### The boundary with the overload-warning idea holds on interaction and fails on mechanism

This idea's *Out of scope* already draws the line: *marking a day that is already overloaded is part
of this one; interrupting someone mid-choice is not.* As an **interaction** boundary that is clean and
correct — a cell state on a screen the user already has open is not the same event as an interruption
inside CAL-01's creation form, and charter refusal 6 governs only the second.

**As a mechanism boundary it does not hold**, and left unstated it produces exactly what INV-04
forbids. Both ideas need the same three things: the absence-count function, `team.overload_threshold`,
and the current member count. Whichever ships first builds all three. CAL-04 is in the backlog now and
[2026-08-31-a-crowded-day-is-discovered-too-late.md](2026-08-31-a-crowded-day-is-discovered-too-late.md)
is not yet triaged, so **CAL-04 builds them and the warning consumes them** — recorded in CAL-04's
`Notes` so the two ideas cannot arrive at two arithmetics that agree until one of them is edited. The
function is **range-shaped, not date-shaped**, from the first line, so the year view never needs a
second path.

### INV-04's numerator lands here first, and the registry does not say it yet

The operator decided on 2026-08-31 that a removed member's entries **do not count toward the
numerator**. `.ai/registry/invariants.md` records the denominator only, and extending it is a RULE-01
registry amendment — human-only, and an agent does not author that ADR. It was raised inside the
crowded-day idea and is unwritten.

It **lands on these rows first**, because these are the first surfaces that display the number.
Concretely, and this is the sentence worth carrying: **until `invariants.md` records it, a month cell
can show four avatars over a count of three.** `TODO(project):` on CAL-04.

### The dependencies, and the one that is about a policy rather than a screen

- `CAL-04` → `depends_on: [CAL-01, TEA-03]`
- `CAL-05` → `depends_on: [CAL-04]`
- `CAL-06` → `depends_on: [CAL-04, TEA-03]`

`product` proposed `[CAL-01]` for CAL-04 and `tech-lead-design`'s version was taken. **Their reason is
the policy rather than the screen:** every view renders `display_name` and `avatar`, and reading any
`member` row at all needs a select policy on `member` under ADR-005 — which is TEA-03's. Their caveat
travels with it, in the row and in the ticket: **if that policy ships in TEA-01's migration instead,
the dependency reduces to `[CAL-01]`.**

CAL-06 names TEA-03 directly rather than inheriting it through CAL-04, because it is the row where the
dependency is not merely a policy but the whole layout: one row per member, including members with no
entries.

**A gap neither half could close: no feature row yet owns writing the `team` select policy.** CAL-04's
overloaded-day marking has to read `overload_threshold` off `team`, and `Read the overload threshold`
is ✅ for both roles in the permission table with no feature behind it. Recorded as a `TODO(project):`
on CAL-04 rather than invented into TEA-01's scope.

### Out of scope, added at triage

Seven, in order of how likely each is to be absorbed without anyone noticing. The first four are the
ones that let a view quietly become a different feature.

- **Any warning, interruption or confirmation at the moment of choosing a date.** Charter refusal 6,
  and the crowded-day idea. A grid that marks overloaded days is one hover handler away from being
  the warning.
- **Setting the overload threshold.** These views **read** `team.overload_threshold`; the admin
  surface belongs with the crowded-day idea, which bundled the two deliberately because *"a warning
  with no settable threshold is a hard-coded opinion"*.
- **Approving, rejecting, or any admin action reachable from a cell.** The week view shows *ai duyệt*
  and every view shows the approved star. **Showing who approved is not approving**, and CAL-03's
  admin-edit power must not surface as an inline edit on a cell.
- **Creating, editing or deleting an entry from a view.** Drag-select hands a date range to CAL-01's
  existing form and stops there. No view grows a save path of its own — CAL-01, CAL-02 and CAL-03 own
  the write policies.
- **Maintaining the holiday calendar, or computing bridge days.** Not merely deferred:
  `data-model.md` OPEN QUESTIONS item 1 blocks the first story touching `holiday`, and `CLAUDE.md`
  gives holidays lavender, so a view is otherwise entitled to draw them and inherit a blocking
  question it does not own.
- **Storing, caching or materialising the absence count** — a column, a summary table, or a
  materialized view. `data-model.md`'s *What is deliberately not stored* covers it, and naming it here
  stops the year view's performance problem being answered with a table.
- **Any per-view visibility setting** — hiding your own entries, or hiding other people's. Distinct
  from the P2 *filtering* already excluded above, and charter-level rather than a preference: *a plan
  nobody can see coordinates nothing.*

### Steward chores, recorded and not fixed

Three, the first carried forward from the previous triage.

1. **`ui-design-system.md` § Destructive actions** carries a `TODO(project)` for the list of
   destructive actions and what each confirmation must name. Deleting an entry, on CAL-02 and CAL-03,
   is the first one this product gains.
2. **`ui-design-system.md` needs Direction, Colour, Type and Components filled before CAL-04 reaches
   DESIGN.** Three view features are the largest thing this product will build against that file and
   it is still the shipped stub. Whichever view is built first will fix a palette from `CLAUDE.md`'s
   prose, without hex values, and the other two will inherit it.
3. **`CLAUDE.md` makes a claim about that file that is not currently true** — *"Details, and the
   Vui/Gọn density toggle, are in `.ai/standards/ui-design-system.md`"*. They are not; the toggle is
   named in `CLAUDE.md` and defined nowhere. This idea's *Constraints* section repeated the same claim
   and has been corrected above by strikethrough. Both copies came from the same wrong belief, which
   is the argument for fixing the file rather than the sentences.

None of the three blocks this verdict.
