---
stage: TRIAGE
agent: product
produced_at: 2026-09-03
inputs_read:
  - CLAUDE.md
  - .claude/commands/triage.md
  - .ai/templates/idea.md
  - .ai/steward/context.md
  - 3ccbd37:.ai/standards/ui-design-system.md   # § Language — NOT on this branch, see the note below
  - .ai/standards/ui-design-system.md            # the 52-line stub, which is what is on disk here
  - .ai/standards/tech-stack.md
  - .ai/registry/invariants.md
  - .ai/registry/features.md
  - src/App.tsx
  - src/routes/Home.tsx
  - src/routes/SignIn.tsx
  - src/routes/SignUp.tsx
  - src/routes/NotOnATeam.tsx
  - src/routes/AllowList.tsx
  - src/routes/MemberList.tsx
  - src/routes/NewEntry.tsx
  - src/routes/EditEntry.tsx
  - src/components/EntryForm.tsx
  - src/lib/fixtures.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/data/index.ts
  - supabase/seed.sql
  - tests/seam-parity.test.ts
  - tests/e2e/cal-01-create-entry.spec.ts
  - tests/e2e/cal-02-edit-delete-entry.spec.ts
  - tests/e2e/tea-01-signup.spec.ts
  - tests/e2e/tea-05-sign-in.spec.ts
  - eslint.config.js
  - scripts/check-docs.mjs
  - .ai/board/tickets/CAL-03/ticket.yaml
  - .ai/board/tickets/CAL-03/01-plan.md
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
---

# The interface and its standard speak different languages

## Read this before checking any citation below — the standard is not on `main`

**Every citation of `§ Language` in this file is anchored to `3ccbd37:.ai/standards/ui-design-system.md`,
because that section exists in exactly one commit and that commit is not merged.** `3ccbd37` is the sole
commit of `ops/ui-language-english`, **open and unmerged as PR #37**. The working tree moved to
`feat/CAL-03` during this triage, and `.ai/standards/ui-design-system.md` on this branch is the
**52-line stub** — it has no `§ Language` and no exception.

**The bare line numbers are actively misleading here, not merely dangling.** On the stub,
`ui-design-system.md:44-48` is `## Selectors`. A reviewer who checks out this branch and follows an
unqualified citation lands on a real section that says something else entirely, which is worse than a
reference that resolves to nothing. Hence the commit prefix on every one of them below.

*Amended after the verdict's technical half, 2026-09-03. Written originally against a tree that was on
`ops/ui-language-english`, where the section was on disk at `:44-74`.*

## Problem

**Since this morning the product has a written answer to "what language does this speak", and no
screen in it agrees.** `3ccbd37:.ai/standards/ui-design-system.md:44-59` — added today — says every
string the interface renders is English, including the user-facing `message` half of every
`{ code, message }` returned across the data-access seam. Every screen that exists renders Vietnamese.

That is not yet something a user can see. **What a user will see is the next screen.** The standard
governs work that has not happened yet at no cost — twelve features are `PLANNED`
(`.ai/registry/features.md:90-95, 103-108`) and will be built in English simply by being read — while
seven are `DONE` or `IN_PROGRESS` (`:88-89, 117-121`) and are Vietnamese on disk. Nothing bridges the
two. So the first thing this produces is not a translation debt in the abstract; it is **one screen
carrying both languages at once**, and the first one is already being written:

- `.ai/board/tickets/CAL-03/01-plan.md:517` states that CAL-03 — an admin editing another member's
  entry — *"CAL-02's extraction is used unchanged. The admin edits the same"* form. That form is
  `src/components/EntryForm.tsx`, whose every label is Vietnamese: `TYPE_LABELS` at `:34-37`
  (`"Nghỉ phép"`, `"Làm ở nhà"`), `PORTION_LABELS` at `:42-46`, and the field legends at `:157`,
  `:173`, `:190`, `:207`, `:230`, `:234`.
- CAL-03's own new copy — the admin heading, the confirmation, its refusal messages — is English by
  the standard the moment it is written.
- CAL-03 is at `state: BACKLOG` with its plan uncommitted in this working tree
  (`.ai/board/tickets/CAL-03/ticket.yaml:8`, and `01-plan.md` untracked). **This is not a hypothetical
  next ticket. It is the one in flight.**

**Second, and separately: a developer told to fix this cannot tell from the code which Vietnamese
string is a defect and which is deliberate.** The same standard carries an explicit exception at
`3ccbd37:.ai/standards/ui-design-system.md:61-74` — display names, team names and note text in
fixtures and seed data stay Vietnamese, with diacritics, because that is the only coverage the product
has for the diacritics requirement in `CLAUDE.md` § *Visual direction*. The exception is stated **by
role**, not by file: *"what the product says is English; what a user typed is whatever they typed."* Nothing in the tree marks which is which,
and in at least one place the two are **the same string**:

| | |
|---|---|
| `src/routes/Home.tsx:26` | `roleLabel` returns `"Thành viên"` — **interface**, must become English |
| `supabase/seed.sql:345, 356` | `display_name` is `"Thành viên"` — **user content**, must stay |
| `tests/e2e/tea-05-sign-in.spec.ts:63` | asserts `home-member-name` is `"Thành viên"` — the seed row |
| `tests/e2e/tea-05-sign-in.spec.ts:65` | asserts `home-member-role` is `"Thành viên"` — the label |

Two lines apart, same literal, opposite verdicts. A find-and-replace of `"Thành viên"` translates the
seed data along with the label, and every test still passes — which is precisely the failure
`3ccbd37:.ai/standards/ui-design-system.md:70-71` predicted in advance: *"Translate `displayName: "Thành viên"` to
`"Member"` and nothing anywhere renders a diacritic, so the next font change breaks the real names of
real people and every test still passes."*

**Stated as a disagreement between the code and its standard rather than as "translate everything"
deliberately.** "Translate everything" is the instruction that produces the flattened exception above.
What is wrong is that there is no line drawn on disk between the two roles the standard distinguishes,
and no mechanism anywhere that would notice the line being crossed.

### What is actually in the tree, classified

Searched the whole tree for Vietnamese diacritics. **170 matching lines across 13 files under `src/`**,
16 lines in `supabase/seed.sql`, 24 lines across 4 end-to-end specs. Classified against
`3ccbd37:.ai/standards/ui-design-system.md:44-74`, not against file path:

**Interface copy — governed, currently Vietnamese (11 files):**

| File | Lines | What |
|---|---|---|
| `src/App.tsx` | 2 | the mock-seam banner `:42`, `"Đang tải…"` `:55` |
| `src/routes/Home.tsx` | 5 | `roleLabel` `:26`, body `:60`, nav `:73, :88`, sign-out `:99` |
| `src/routes/SignIn.tsx` | 4 | heading, password label, submit/submitting, one refusal `:54` |
| `src/routes/SignUp.tsx` | 9 | headings, four field labels, submit, **two `aria-label`s** `:124, :128` |
| `src/routes/NotOnATeam.tsx` | 4 | the whole empty state |
| `src/routes/AllowList.tsx` | 23 | headings, table headers, states, confirmation, two `aria-label`s `:162, :271` |
| `src/routes/MemberList.tsx` | 25 | a **second** `roleLabel` `:23`, table headers, confirmation, `aria-label` `:315` |
| `src/routes/NewEntry.tsx` | 14 | form titles `:89-91`, status words `:167-170`, delete confirmation |
| `src/routes/EditEntry.tsx` | 13 | `STATUS_LABELS` `:26-28`, form titles `:116-118`, approval line `:149` |
| `src/components/EntryForm.tsx` | 13 | `TYPE_LABELS`, `PORTION_LABELS`, field legends, one refusal `:143` |

**Error `message` values — interface, and the standard says so in its own words at
`3ccbd37:.ai/standards/ui-design-system.md:56-59`:**

- `src/lib/data/supabase.ts` — 24 lines, including the three refusal sentences held as named constants
  at `:289-291` (`CREATE_REFUSED`, `UPDATE_REFUSED`, `DELETE_REFUSED`).
- `src/lib/data/mock.ts` — 26 lines, **repeating the same literals**. `supabase.ts:286-288` records
  why: *"held here so the two implementations of the seam can carry the same words — mock.ts repeats
  these literals for the same reason `src/lib/fixtures.ts` and `supabase/seed.sql` repeat theirs."*
  So the two implementations must move together, word for word.

**The exception — user content, stays Vietnamese with diacritics:**

- `src/lib/fixtures.ts` — all 8 lines: six `displayName` (`:28, :61, :93, :108, :134, :304`), one team
  `name` `:85`, one `note` `:332`.
- `supabase/seed.sql` — all 16 lines: `display_name` in the auth metadata and the member row, one team
  name `:164`, one entry note `:493`.
- Note text typed by a test user in the specs: `cal-01-create-entry.spec.ts:122, 132, 156, 161, 171`
  and `cal-02-edit-delete-entry.spec.ts:136, 148, 247, 268, 319, 322, 371, 414`.
- Display names asserted from seed data: `tea-05-sign-in.spec.ts:63, 137, 140`, and
  `tea-01-signup.spec.ts:29` (`DISPLAY_NAME = "Nguyễn Văn An"` — the only *diacritic-dense* name the
  suite exercises).

**The ones that are genuinely interface but sit in a test or a comment**, and are the easiest to miss:

- `tea-05-sign-in.spec.ts:65, 146, 155` — `home-member-role` assertions. These read the label at
  `Home.tsx:26` and must change with it.
- `tea-05-sign-in.spec.ts:9-11` and `tea-01-signup.spec.ts:165` — header comments quoting seed data and
  quoting the button label `"Đang gửi…"`. Comments, so nothing fails; stale the moment the copy moves.

### Nothing enforces the standard, and nothing reports it being broken

`scripts/check-docs.mjs` has **no** check that reads language (0 matches for `Language`, `English` or
`Vietnamese`). `eslint.config.js` has no rule for it — its one match on `language` is
`languageOptions`. So § Language is held by attention alone, in a repository whose own § Language
section exists because *"a convention nobody wrote down is not a convention, it is a coincidence that
held"* (`3ccbd37:.ai/standards/ui-design-system.md:54`). Today the convention is written down — in an
unmerged pull request — and the coincidence is what is still shipping.

## Who has it

- **A member and an admin, from the moment CAL-03 renders** — every use, on the busiest screens. CAL-03
  puts English chrome on a Vietnamese form. Twelve `PLANNED` features do the same to whatever they
  reuse: `EntryForm`, `roleLabel` (twice over, `Home.tsx:26` and `MemberList.tsx:23`), the status words
  duplicated at `NewEntry.tsx:167-170` and `EditEntry.tsx:26-28`, and every `message` returned by the
  seam.
- **The developer of every ticket from CAL-03 onward, at `/implement`.** They will read a standard that
  says English, open a file that is Vietnamese, and have to decide per string whether they are looking
  at a defect or at somebody else's ticket. There is no ruling in the repository for the case where a
  ticket touches a Vietnamese string that is not its own.
- **`tech-lead-design` at every `/plan`, starting now.** CAL-03's plan reuses `EntryForm.tsx`
  unchanged. Whether "unchanged" is still correct under a standard that landed after the plan was
  drafted is a question its author has not been asked.
- **The reviewer at `/review`, on every ticket.** RULE-02-style enforcement does not exist here, so
  conformance to § Language is a human reading a diff — and a diff that adds English to a file full of
  Vietnamese looks, line by line, exactly like a correct one.

## Evidence

Observed in this tree today, not inferred.

1. **The standard exists, is dated, and is not merged.**
   `3ccbd37:.ai/standards/ui-design-system.md:44-48` quotes the operator's instruction of 2026-09-03
   verbatim: *"tôi muốn tất cả content đều là tiếng anh"*. Commit `3ccbd37` is the sole commit of
   `ops/ui-language-english`, open as PR #37. **It is not on `main` and not on `feat/CAL-03`**, which
   is where this tree now sits.
2. **The code does not conform.** The diacritic search above: 170 lines in 13 `src/` files, 16 in
   `supabase/seed.sql`, 24 in 4 specs. Every route file the product has renders Vietnamese headings.
3. **The exception is real and is one edit away from being destroyed.** `Home.tsx:26` and
   `seed.sql:345` hold the identical string with opposite verdicts;
   `tea-05-sign-in.spec.ts:63` and `:65` assert it twice, two lines apart, for opposite reasons.
   `fixtures.ts:28` (`"Quản trị"`) and `Home.tsx:26` (`"Quản trị viên"`) differ by one word.
4. **The seam duplication is documented as deliberate**, so the two implementations cannot be
   translated one at a time: `supabase.ts:286-288`. `tests/seam-parity.test.ts` will not catch a
   divergence — it asserts export names and arity only (`:27-48`), never message text. Two seams that
   answer the same refusal in two languages pass it.
5. **Four suites assert strings that will move**, and Definition of Done item 3 requires all four
   commands to exit 0: `cal-01-create-entry.spec.ts`, `cal-02-edit-delete-entry.spec.ts`,
   `tea-01-signup.spec.ts`, `tea-05-sign-in.spec.ts`. Note that the *majority* of their Vietnamese is
   the protected exception — only `tea-05-sign-in.spec.ts:65, 146, 155` assert interface copy — so the
   suites break far less than the raw count suggests, and break in the one place that matters.
6. **No mechanism watches this.** Zero language checks in `scripts/check-docs.mjs`, zero in
   `eslint.config.js`.
7. **CAL-03 is mid-flight against the old assumption.** `01-plan.md:517` reuses `EntryForm.tsx`
   unchanged; the plan contains no Vietnamese, so its own new strings will be English.

## Impact if ignored

**The product ships bilingual, screen by screen, and each ticket makes it slightly worse at no visible
cost to itself.** No single ticket is wrong: CAL-03 writing English is correct, and CAL-01's form
staying Vietnamese is not CAL-03's to change. That is what makes this accumulate rather than get
caught — the failure has no owner at any gate the loop has.

**The unbuilt half is free and the shipped half is the whole debt.** Twelve `PLANNED` features will be
English because the standard says so; nobody pays anything. The seven `DONE`/`IN_PROGRESS` features are
the entire cost, and that cost only grows in one direction: every additional English screen increases
the number of places the two languages meet. Doing nothing does not hold the line, it widens the seam.

**Somebody eventually runs the obvious search-and-replace, and the exception dies silently.** The
prediction is already written into the standard (`:70-71`): translate `displayName: "Thành viên"` and
nothing anywhere renders a diacritic, the type-face requirement in `CLAUDE.md` § *Visual direction*
loses its only coverage, **and every test still passes**. The next font change then breaks the real
names of real people with nothing red anywhere.

**The seam splits.** `mock.ts` and `supabase.ts` repeat their literals by design. Translate one and
`tests/seam-parity.test.ts` stays green, because it never compares message text — so the mock-driven
end-to-end suite asserts one sentence and production returns another, and the discrepancy surfaces
only against a real database.

**Two `roleLabel`s and two status maps drift apart.** `Home.tsx:26` / `MemberList.tsx:23`, and
`NewEntry.tsx:167-170` / `EditEntry.tsx:26-28`, are duplicated copy. A partial translation puts the
same concept on two screens in two languages, which is worse than either language alone.

**The `aria-label`s are the ones that stay Vietnamese longest.** `SignUp.tsx:124, 128`,
`AllowList.tsx:162, 271`, `MemberList.tsx:315` render nothing visible, so no manual pass and no
screenshot will ever catch them. A screen reader will.

## Constraints already known

Cited, not chosen. Each bounds what an eventual ticket may do.

- **`3ccbd37:.ai/standards/ui-design-system.md:44-59` — § Language.** Every rendered string is English,
  explicitly including the `message` half of `{ code, message }` across the seam; the `code` half is an
  identifier and is already English. This is human plane under RULE-01 and is not this idea's to
  reinterpret. **It is in PR #37 and unmerged**, which makes it a precondition on everything below
  rather than a fact about the repository.
- **`3ccbd37:.ai/standards/ui-design-system.md:61-74` — the one exception, and it is by role, not by
  file.** Display names, team names and note text in `src/lib/fixtures.ts` and `supabase/seed.sql` stay
  Vietnamese with diacritics. *"What the product says is English; what a user typed is whatever they
  typed."*
- **`CLAUDE.md` § Visual direction** — *"Type is a rounded face with correct Vietnamese diacritics."*
  This is what the exception exists to keep testable, and it is the reason the exception cannot be
  traded away for tidiness.
- **`.ai/steward/context.md:93-99` — the language split is by audience.** Conversation Vietnamese,
  artifacts and repository English. This idea does not touch that bullet and must not be read as
  proposing to.
- **`.ai/registry/invariants.md` — checked, and no invariant governs copy.** The ledger's seven rows
  (`:33-39`) are about overlap, approval state, rejection reasons, the absence count, tentative
  entries, portions and ownership. **INV-03 is the nearest and it does not apply**: it requires a
  rejected entry to carry a *non-empty* rejection reason, which is user-authored text, not interface
  copy — an entry whose reason a user typed in Vietnamese still satisfies it. Recorded explicitly so a
  later reader does not re-derive it and conclude otherwise. `invariants_touched: []` is a defensible
  answer here, and it must be written as `[]`, not omitted.
- **RULE-02 and `.ai/standards/architecture.md`** — the seam is `src/lib/data/`. The error `message`
  values governed by § Language live *inside* the seam, so anything that centralises them must stay
  inside it or move above it; nothing outside may reach past it.
- **`src/lib/data/supabase.ts:286-288`** — the mock and the real seam repeat their refusal literals
  deliberately, so they change together or the seam lies.
- **`tests/seam-parity.test.ts:7-9`** — parity is names and arity, *"necessary and NOT sufficient"*,
  and message text is not compared. It will not protect this.
- **Definition of Done item 3** — typecheck, lint, unit and end-to-end must exit 0. Four specs assert
  strings in scope.
- **`.ai/standards/tech-stack.md:75`** — `date-fns` 4 is carried *"with the `vi` locale"*. Today
  `AllowList.tsx:9,20` imports `format` and uses `dd/MM/yyyy`, which is numeric and language-neutral,
  so nothing renders a Vietnamese month name yet. The dependency's stated locale and § Language do not
  currently contradict each other; they will the first time a calendar view formats a month.
- **`.ai/registry/features.md`** — 7 `DONE`/`IN_PROGRESS`, 12 `PLANNED`. The split is the shape of the
  problem, not a detail of it.

## Out of scope

- **Translating `src/lib/fixtures.ts` or `supabase/seed.sql`.** They are the exception. Named first
  because it is the item most likely to be quietly absorbed by whoever implements this.
- **Reinterpreting, narrowing or widening § Language.** It is `.ai/standards/`, human plane, written
  today from a direct instruction. If it turns out to be wrong, that is an amendment and a conversation
  with the operator, not a decision inside a copy ticket.
- **Changing the conversation language, the sign-off labels, or anything in
  `.ai/steward/context.md`.** A different axis of the same word.
- **Changing the type face, or anything else in `CLAUDE.md` § Visual direction.** The diacritics
  requirement is cited here as a constraint, not opened.
- **Rewriting what the four end-to-end specs *assert*.** Their note text and display names are the
  exception and are correct as they stand. Only the three `home-member-role` assertions read interface
  copy.
- **Adding a localisation framework, a message catalogue, or any new runtime dependency.** That is a
  solution, and a tech-stack change besides — see open question 3. Nothing here presumes one is needed
  or forbidden.
- **Building a check or lint rule that enforces § Language.** Named above as absent because it explains
  why this went unnoticed; whether one should exist is its own decision with its own test, and
  `.ai/board/model-debt.md` is where an unbuilt mechanism belongs.
- **The `PLANNED` features' copy.** They are English by the standard alone, at no cost, and need no
  ticket.
- **Date, number and name-order formatting.** Adjacent, frequently confused with this, and § Language
  governs strings rather than locale. See open question 4.

## Open questions

These are the ones a verdict genuinely turns on, and the ones I could not settle from the repository.

1. **Is the shipped surface one unit of work, or does each ticket repair its own files?** Both are
   defensible and they produce different verdicts. One pass over 13 files ends the bilingual window
   immediately and touches files belonging to five shipped features at once — which sits badly with
   `allowed_paths` (RULE-03) and with one feature group per ticket (Definition of Ready item 6).
   Per-ticket repair respects both and leaves the product bilingual for as long as the backlog is long.
   **Not decided here**, and it is the first thing PLAN or a technical assessment must answer.

2. **Under which ID does this exist?** The same wall BUG-001 hit on 2026-09-01. This is a defect
   against shipped behaviour across five features and not a new capability, so a new row in a group
   table would file a translation as a product feature; `.ai/01-operating-model.md` declares
   `BUG-nnn` and `OPS-nnn` for exactly this, and BUG-001 established that `id: BUG-nnn` with
   `feature_ids` pointing at real rows satisfies Definition of Ready item 1. Whether *this* work fits
   that shape — it spans five features, where BUG-001 had one parent — I could not settle.

3. **Is the answer a catalogue, or literals in place?** Copy is currently duplicated at four known
   sites (`roleLabel` twice, the status words twice, the seam refusals twice by design, and
   `EntryForm`'s labels exported so two screens share them). Translating literals in place preserves
   that duplication and doubles the chance of a partial pass; extracting a catalogue is a structural
   change and, if it reaches for a library, a tech-stack change that needs an ADR. **This is the
   question most likely to turn a PROMOTE into a NEEDS-ADR**, and it is not mine to answer.

4. **Does "English" reach past strings into formats?** `AllowList.tsx:20` renders `dd/MM/yyyy`;
   `tech-stack.md:75` records `date-fns` with the `vi` locale; § Language names only strings. Nothing
   contradicts anything today, and the first calendar view (CAL-04, CAL-05, CAL-06 — all `PLANNED`)
   formats month and weekday names and will have to know. Cheap to answer now, expensive to answer
   three tickets in.

5. **What happens to a Vietnamese string a ticket touches but does not own?** No ruling exists. A
   developer editing `EntryForm.tsx` for CAL-03 will meet `TYPE_LABELS` and has nothing to follow.
   This needs an answer whichever way question 1 goes, and it is the difference between a standard
   that holds and one that erodes.

6. **Does the exception need a marker on disk, or is the standard's sentence enough?** The standard
   draws the line by role; the code does not carry the line anywhere, and `Home.tsx:26` versus
   `seed.sql:345` is proof that reading the file path is not sufficient. Whether that is worth a
   convention, a comment, or nothing at all, I could not settle — and it is the thing that decides
   whether this problem recurs the next time somebody translates something.

7. **Is CAL-03 allowed to proceed as planned?** Its plan is written and uncommitted, it reuses a
   Vietnamese form unchanged, and it will emit English. If the answer to question 1 is "one pass first",
   CAL-03 is downstream of it. If it is "per ticket", CAL-03 is the first instance and needs the answer
   to question 5 before `/implement`. Either way somebody has to say so before that ticket moves, and
   nothing in the loop will ask.

## Triage verdict — 2026-09-03

**PROMOTE.** Two chore tickets, **OPS-001** and **OPS-002**. No new feature row, no ADR.

`product` and `tech-lead-design` triaged this on 2026-09-03. The technical half answered open
questions 1 and 3 — the two the verdict turned on — and its citations are re-read against this tree
below rather than accepted.

### Why PROMOTE and not REJECT-as-not-worth-doing

The REJECT argument is that nothing is broken: the product works, no user has complained, and the
Vietnamese copy was **correct until this morning**. That is all true and it is why this is a chore
rather than a defect. It does not survive the accumulation argument in *Impact if ignored*: the cost
of doing nothing is not static. Every English screen added from CAL-03 onward increases the number of
places the two languages meet, and the twelve `PLANNED` features will each add one for free. There is
no version of "leave it" that holds the line.

The second REJECT argument — *already covered by the standard* — fails on the same distinction
BUG-001's verdict drew about model debt: a standard is not a ticket. Nothing in the loop reads
`3ccbd37:.ai/standards/ui-design-system.md` and repairs anything, and no gate is cleared by it. The
standard makes future work correct at no cost and does nothing whatever to the shipped surface.

### Why no ADR — open questions 1 and 3, answered

Both were flagged in this file as the ones most likely to force NEEDS-ADR. Both dissolve, and the
reasoning is checked here rather than restated:

**Question 1 — one pass over thirteen files, or per-ticket repair?** The objection was that a
multi-feature file list violates RULE-03 and Definition of Ready item 6.

- **RULE-03 does not say that.** `.ai/registry/rules.md:33`: *"An agent may not edit any file outside
  the active ticket's `allowed_paths`."* It constrains **the diff against the list**, not the
  composition of the list. A ticket whose `allowed_paths` names files belonging to five features is
  no more a RULE-03 problem than one naming two.

  *Check D8 reports the quotation above as a 100% restatement of RULE-03 without `verbatim_in`. The
  quotation stands, for the reason ADR-008:45 gives for its own: the argument turns on what the rule
  says word for word, and the cheapest way to silence the warning is to reword it until it no longer
  does. `verbatim_in` is a column in `.ai/registry/rules.md` under RULE-01 and would oblige a D7
  character-for-character copy in perpetuity — the wrong instrument for a transient board file. MD-012
  records the same reflex as a known cost.*
- **DoR item 6 carries its own escape hatch.** `.ai/01-operating-model.md:336`: *"Exactly one feature
  group, **or a stated split rationale**"*. The alternative is in the item; using it is compliance,
  not an exception to it.
- **Nothing is left to decide about size**, because the sizing table already prescribes the handling.
  `.ai/01-operating-model.md:374`: `L | more than 12 | must split at PLAN`. Thirteen files is L. The
  answer to "one pass or several" was written down before the question was asked.

So the work is split into two tickets **below** the L threshold, and question 1 is answered by the
model rather than by a decision.

**Question 3 — literals in place, or a catalogue?** This was the one that could have needed an ADR,
because a catalogue that reaches for a library is a `tech-stack.md` change. **It does not need one at
triage**: the question is a design choice about existing files, no dependency is proposed, and
`.ai/templates/ticket.yaml` is copied with `schema_delta: none`, `requires_adr: false`. It stays open
for PLAN, and PLAN stops and asks if it concludes a dependency is wanted. Deciding it here would be
the thing `/triage` forbids — writing a solution into an idea.

Nothing here supersedes or reverses an accepted ADR, so ADR-008's stop-and-ask test does not fire.

### Why no new feature row

**This is a chore against already-shipped surface.** `.ai/01-operating-model.md:317` declares the
scheme: *"Defects are `BUG-nnn`, chores are `OPS-nnn`."* It is not a defect — nothing regressed, and
the code was correct when it was written; the standard moved, not the code. And it is not a
capability: a row in `.ai/registry/features.md` would file "translate the copy" as something the
product contains, which `CLAUDE.md` calls *"the only valid source of feature IDs"*.

**Check D1 is not tripped.** `scripts/check-docs.mjs:184-185` builds `\b(?:CAL|ADM|TEA)-\d{2}\b` from
the declared prefixes; `OPS-001` matches neither half — wrong prefix, and three digits against `\d{2}`.
Same mechanism BUG-001 established on 2026-09-01, verified again here rather than assumed.

**What was written instead, following the BUG-001 precedent exactly**
(`.ai/board/tickets/BUG-001/ticket.yaml` §2): a sentence appended to the `Notes` of **every** feature
row named in either ticket's `feature_ids`, citing this file and the OPS ticket. Seven rows: CAL-01,
CAL-02, TEA-01, TEA-02, TEA-03, TEA-04, TEA-05. RULE-01 v2 permits a feature-row edit with no ADR;
CODEOWNERS review at merge is the approval. **That citation plus the idea filename in each ticket
header is the whole provenance a reviewer gets**, which is why it is on all seven rows rather than on
a representative one.

### The partition, and why the cut is where it is

| | OPS-001 | OPS-002 |
|---|---|---|
| Surface | chrome, account and team screens | entry screens and the seam's messages |
| `feature_ids` | TEA-01, TEA-02, TEA-03, TEA-04, TEA-05 | CAL-01, CAL-02, TEA-01, TEA-02, TEA-03, TEA-04, TEA-05 |
| Groups spanned | one — TEA | two — CAL and TEA |
| DoR item 6 | satisfied literally | satisfied by stated split rationale |

**OPS-002 spans two groups and could not have been cut to avoid it.** The rationale is a mechanism,
not a preference: `src/lib/data/mock.ts` and `src/lib/data/supabase.ts` duplicate their refusal
literals **by design** — `supabase.ts:286-288` says so in its own words — and
`tests/seam-parity.test.ts:27-48` compares export names and arity only, never message text. A
one-sided translation is therefore green against every check this project has and diverges only
against a real database. The seam pair cannot be split by group without creating exactly that hole,
and those two files carry both the entry refusals (CAL) and the auth, allow-list and member refusals
(TEA).

### CAL-03 proceeds, and ships a mixed-language screen

Open question 7 asked whether CAL-03 may proceed. **It may, and it will produce the bilingual screen
this idea is about.** Ruled by `tech-lead-design`, on two facts:

- **Absorbing the repair is mechanically unavailable.** `.ai/board/tickets/CAL-03/ticket.yaml:16-19`
  records *"Twelve is M's ceiling — the figure TEA-05 fixed — so nothing splits, but there is no
  headroom left."* Adding `src/components/EntryForm.tsx` makes thirteen, which is L, which
  `.ai/01-operating-model.md:374` says must split at PLAN.
- **Waiting parks the only ticket in flight behind a human merge**, since PR #37 is not merged.

**The consequence is already visible in the tree and confirms OPS-002's shape.** A concurrent session
is implementing CAL-03 now; its new `src/routes/TeamEntries.tsx:43-60` declares `TYPE_LABELS`,
`PORTION_LABELS` and `STATUS_LABELS` in **English**, against `src/components/EntryForm.tsx:34-46` and
`src/routes/EditEntry.tsx:26-28` in Vietnamese. That is a **third** copy of the same label sets, and
the developer's own comment at `TeamEntries.tsx:40-42` anticipates it: *"The ticket that translates
the other thirteen files folds these into one place."* **OPS-002 is that ticket, and reconciling all
three is named on it.**

### What the verdict does not settle

Open questions 2, 4, 5 and 6 stand and are PLAN's or the operator's:

- **2 — the ID.** Settled as `OPS-nnn` above.
- **4 — does "English" reach into date and number formats?** Still open, still cheap now, still
  expensive three calendar tickets in. Out of scope on both tickets.
- **5 — what happens to a Vietnamese string a ticket touches but does not own?** Still open, and
  CAL-03 is answering it in practice by leaving `EntryForm.tsx` alone. That is a precedent set by
  circumstance rather than by decision, and it is worth the operator's attention.
- **6 — does the exception need a marker on disk?** Still open. It is the question that decides
  whether this recurs, and it is recorded on both tickets as the negative requirement nobody checks.

### The precondition, stated because no ticket field can carry it

**PR #37 must merge.** If it does not, there is no standard and there is no chore — both tickets
become invalid rather than blocked. This is **not** `depends_on`: that field names tickets, and no
ticket can name a pull request. It is recorded in the header of both `ticket.yaml` files instead.

### What was promoted

| | |
|---|---|
| Feature rows | **none written.** Seven existing rows had a sentence appended to `Notes` |
| Tickets | `.ai/board/tickets/OPS-001/ticket.yaml` and `.ai/board/tickets/OPS-002/ticket.yaml`, both `state: BACKLOG` |
| Branches | `feat/OPS-001`, `feat/OPS-002` — see each ticket's §4 |
| `depends_on` | `[CAL-03]` on both. CAL-03 owns five of the thirteen files |
| `schema_delta` | `none`, `requires_adr: false`. No migration, no policy, no table |
| `allowed_paths` | **not written** — PLAN's, and `[]` is a control that blocks writes until then |
| Backlog | two rows **appended** to `## BACKLOG`, nothing renumbered |
