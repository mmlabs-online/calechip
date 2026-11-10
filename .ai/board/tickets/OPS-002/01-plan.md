---
ticket: OPS-002
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-07T08:21:08+07:00
inputs_read:
  - .ai/board/tickets/OPS-002/ticket.yaml
  - .ai/board/ideas/2026-09-03-the-interface-and-its-standard-speak-different-languages.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/boundaries.json
  - .ai/standards/ui-design-system.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - ui-language.json
  - eslint.config.js
  - tests/ui-language.test.ts
  - src/routes/NewEntry.tsx
  - src/routes/EditEntry.tsx
  - src/routes/TeamEntries.tsx
  - src/routes/PendingEntries.tsx
  - src/routes/WeekView.tsx
  - src/routes/YearView.tsx
  - src/components/EntryForm.tsx
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# OPS-002 — UI copy to English: entry screens and the seam's error messages

## 0. The precondition, discharged

`ticket.yaml` § 0 makes this ticket **invalid rather than blocked** if PR #37 never merges, and
instructs that the standard be cited as `3ccbd37:.ai/standards/ui-design-system.md` and never bare,
because on any other branch the file was a 52-line stub on which a line citation resolved to the
wrong section.

**PR #37 merged on 2026-09-03T08:15:20Z.** `.ai/standards/ui-design-system.md` on this branch is 165
lines and `## Language` is at line 44. **This plan therefore cites the standard bare**, from the
working tree, and the § 0 instruction is retired rather than disobeyed — its whole purpose was to
avoid a citation that resolved to `## Selectors`, and that hazard is gone.

`depends_on: [CAL-03]` is likewise satisfied: CAL-03 is `DONE`. Definition of Ready item 3, which
§ 3 of the shell says fails "on purpose" at the time of writing, now passes.

## 1. Problem and scope

The feature IDs this plan implements, transcribed from `.ai/registry/features.md` without paraphrase:

| ID | Capability | Group | State |
|---|---|---|---|
| CAL-01 | Create an entry for themselves, over a range of dates | CAL | DONE |
| CAL-02 | Edit or delete their own entry | CAL | DONE |
| TEA-01 | Sign up and establish the member record | TEA | DONE |
| TEA-02 | Manage the allow-list | TEA | DONE |
| TEA-03 | Team member list | TEA | DONE |
| TEA-04 | Remove a member, and promote a member to admin | TEA | DONE |
| TEA-05 | Sign in, sign out, and the member-less landing state | TEA | DONE |

No role gains a capability. Every row above is `DONE` and this ticket adds nothing to any of them.
What changes is that a **member** using the entry screens, and a member or admin meeting any refusal
returned across the data-access seam, reads it in English — the language
`.ai/standards/ui-design-system.md` § *Language* requires of every string the interface renders. The
product currently answers a failed sign-in in Vietnamese and lists a team's entries in English, on
adjacent screens, because seven tickets shipped against a stub that never named a language. This is
the second and final pass of the sweep; `copyDebt` in `ui-language.json` holds exactly the five files
below, so **this ticket empties the ratchet** and the list reaching zero is the standard's own stated
proof that the sweep is complete.

**Out of scope.**

- **`src/lib/fixtures.ts` and `supabase/seed.sql`.** The standard's deliberate exception
  (`ui-design-system.md:61-74`): display names, team names and note text are stand-in *user content*
  and stay Vietnamese with diacritics. They are `userContent` in `ui-language.json` and the product's
  only coverage for the diacritics requirement in `CLAUDE.md` § *Visual direction*. AC-9 asserts the
  absence of a change. See § 2 *Open questions* item 1 for the trap this shares a literal with.
- **Reinterpreting § *Language*.** `.ai/standards/` is human plane under RULE-01.
- **Any new runtime dependency, and any localisation library.** Settled in § 8 — the answer to the
  idea's open question 3 is a module of constants, which needs no package, so
  `.ai/standards/tech-stack.md` is untouched, `requires_adr` stays `false` and no ADR is owed.
- **A lint rule or check that enforces § *Language* beyond what already exists.** Explicitly out per
  the shell; `eslint.config.js` and `tests/ui-language.test.ts` already carry both halves and this
  ticket only removes entries from the list they read.
- **A message-text parity test across the two seam implementations.** `ticket.yaml` § 5 is right that
  nothing would catch a one-sided translation — `tests/seam-parity.test.ts:27-48` compares export
  names and arity only. This ticket mitigates that by holding both implementations in one
  `allowed_paths` rather than by building the missing control, which is an unbuilt mechanism and
  belongs in `.ai/board/model-debt.md`. Recorded in *Open questions* item 3.
- **Date, number and name-order formatting.** The idea's open question 4. § *Language* governs
  strings; `dd/MM/yyyy` and the `date-fns` `vi` locale are untouched.
- **Everything in `TeamEntries.tsx`, `PendingEntries.tsx`, `WeekView.tsx` and `YearView.tsx` except
  their label maps.** Those four files are already English and are opened only to delete a duplicate
  declaration and add an import. No markup, no behaviour, no selector.
- **The Vietnamese word `vắng` in the comment at `EntryForm.tsx:31`.** It is a quoted term inside an
  explanation of why the label avoids it; translating it destroys the comment's meaning. Comments are
  not matched by the lint rule, which targets `Literal`, `TemplateElement` and `JSXText`.

`size_estimate: M`. Eleven files, no schema, no new capability.

## 2. Acceptance criteria

**AC-1** — the create-entry screen speaks English
- **Given** a signed-in member on `/entries/new`
- **When** the screen renders at rest, with the form empty and with at least one existing entry listed
- **Then** every string it displays — the form title, the submit and submitting labels, the section
  heading, the empty state, the tentative marker, the three status words and the edit, delete,
  confirm and cancel controls — is English, and no rendered string contains a Vietnamese diacritic

**AC-2** — the edit-entry screen speaks English
- **Given** a signed-in member on `/entries/:id/edit` for an entry they own
- **When** the screen renders in each of its loading, not-found and ready states
- **Then** every string it displays — the three status words, the form title, the submit and
  submitting labels, the approval line, the last-edited line and both back links — is English, and no
  rendered string contains a Vietnamese diacritic

**AC-3** — the shared entry form speaks English
- **Given** the entry form rendered by either the create or the edit screen
- **When** a member reads the type control, the portion control, the two date fields, the tentative
  control and the note field
- **Then** every legend, label, option and placeholder is English, and no rendered string contains a
  Vietnamese diacritic

**AC-4** — a refusal from the real seam is English
- **Given** the Supabase implementation of the data-access seam
- **When** any function in it returns a `Failure`
- **Then** the `message` half is an English sentence containing no Vietnamese diacritic

**AC-5** — a refusal from the mock seam is English, and says the same thing
- **Given** the mock implementation of the data-access seam
- **When** any function in it returns a `Failure`
- **Then** the `message` half is an English sentence containing no Vietnamese diacritic, and for every
  refusal both implementations express, the two sentences are word-for-word identical

**AC-6** — the identifiers do not move
- **Given** the set of `code` values returned by either seam implementation before this change
- **When** the same set is read after it
- **Then** the two sets are equal — no `code` is added, removed, renamed or reassigned to a different
  refusal, because callers branch on them

**AC-7** — the WFH distinction survives the translation
- **Given** the type control on the entry form and every screen that names an entry's type
- **When** a reader who does not know the domain reads the label for `wfh`
- **Then** it states that the member is working, and does not read as a kind of absence or use a word
  meaning "away"

**AC-8** — each label set is declared exactly once
- **Given** the whole of `src/`
- **When** the declarations of the entry type, portion and status label sets are counted
- **Then** there is exactly one declaration of each, in one module, and every screen that renders
  those labels imports it rather than restating it

**AC-9** — the exception is untouched
- **Given** `src/lib/fixtures.ts` and `supabase/seed.sql`
- **When** this ticket's diff is read
- **Then** neither file appears in it, and both still contain Vietnamese diacritics

**AC-10** — the ratchet reaches zero
- **Given** `ui-language.json`
- **When** it is read after this change
- **Then** `copyDebt` is empty, and `userContent` still lists `src/lib/fixtures.ts` and
  `supabase/seed.sql`

**AC-11** — the rule is in force over the translated files
- **Given** `eslint.config.js`, whose § *Language* block exempts every path in `copyDebt`
- **When** `pnpm lint` runs with `copyDebt` empty
- **Then** it exits 0, and the five previously exempt files are now covered by the rule rather than
  ignored by it

**AC-12** — the language test passes, and the ratchet is asserted at every length including zero
- **Given** `tests/ui-language.test.ts` and a `copyDebt` of any length, zero included
- **When** the unit suite runs
- **Then** it passes; the ratchet is checked by at least one test case that **executes at every
  length of `copyDebt` including zero** — asserting, for each entry if there are any, that the file
  exists and still contains a Vietnamese diacritic — and the "the exception is alive" cases still
  assert diacritics in the two user-content files

  **Amended 2026-09-07 — the first form of this AC was impossible against the named runner.** It
  required the "still has copy to translate" cases to be *vacuous* at `copyDebt: []`. Vitest 4.1.11
  does not treat an empty `it.each` as vacuous: it fails the enclosing suite with
  `Error: No test found in suite`. `tests/ui-language.test.ts:47-60` is one `describe` whose only
  contents are two `it.each` calls over `copyDebt`, so AC-10 emptying the list empties that suite and
  the file fails while its other three cases pass. AC-10 and AC-12 as first written could not both
  hold. See the Changelog and `99-questions.md`.

**AC-13** — the portion wording is settled to one form
- **Given** that `full` renders as "Full day" on two screens and as "All day" on a third before this
  change
- **When** the label set is read after it
- **Then** exactly one wording exists for `full` and it is rendered identically on every screen

**AC-14** — no test expectation changes
- **Given** the unit and end-to-end suites as they stand before this change
- **When** they run after it
- **Then** every one passes with no edit to any assertion, because no test asserts a string this
  ticket translates or relocates

**Invariants touched: `[]`** — and this is a reached answer, not the template's default.
`.ai/registry/invariants.md` warns that concluding "none" from safe behaviour is circular, and this
ticket edits both seam implementations, which is where several rows are enforced. The reasoning, row
by row, is that **every one of the seven ranges over `entry` or `member` rows and none over a
rendered string**: INV-01, INV-05, INV-06 and INV-07 are properties of stored entries; INV-02 is a
transition triggered by a field change; INV-04 is an arithmetic definition. The nearest is **INV-03**
— a rejected entry carries a non-empty rejection reason — because a reason is text. It is
unaffected: the reason is *user-authored*, typed by an admin into a field this ticket does not touch,
and a reason typed in Vietnamese satisfies INV-03 exactly as before. No refusal sentence translated
here is ever stored; every one is constructed at the moment of failure and rendered.

**Open questions.** Each of these is an assumption that ships, not a blocker.

1. **The find-and-replace trap is live inside this ticket's own files and no tool reports it.**
   `EditEntry.tsx:51` is `approved: "Đã duyệt"`, a status label that must become English.
   `src/lib/fixtures.ts:304` is `displayName: "Đã duyệt"`, a person's name that must not. A third
   occurrence is a note in `supabase/seed.sql`. `tests/e2e/cal-05-week-view.spec.ts:155` asserts the
   *name* through `week-row-name` and `tests/e2e/adm-04-worklist.spec.ts:73` binds it to a constant —
   so a global replace translates the seed data, and every test still passes. The only control is
   whoever reads the diff. AC-9 is the assertion; this is the warning that it is not self-enforcing.
2. **AC-5's "word-for-word identical" is asserted by reading, not by a test.** See § 1 *Out of scope*
   and item 3 below.
3. **After this ticket the two seam implementations still duplicate their refusal sentences by
   design, and still nothing compares them.** The duplication is deliberate — `supabase.ts:403-405`
   holds three refusal constants and says in its own words that `mock.ts` repeats them so both halves
   of the seam carry the same words. The exposure is unchanged by this ticket and is not created by
   it. It belongs in `.ai/board/model-debt.md` as an unbuilt mechanism.
4. **Whether "Full day" or "All day" is the better wording is a copy judgement made here.** AC-13
   requires one; § 4 picks "Full day" on the arithmetic that two of the three shipped screens already
   say it and it is the closer reading of `Cả ngày`. Nothing asserts either, so the choice is cheap
   to reverse.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

No image exists at `.ai/board/tickets/OPS-002/design/` and none is cited in the idea file. **The
layout obligation is close to vacuous on this ticket and that is worth saying plainly**: no screen
gains, loses or moves an element, no state is added, and no empty state changes shape. The only
visual decisions are the words themselves — settled as ACs above and as exact strings in § 4 — and
the single wording conflict AC-13 resolves. A reviewer who disagrees with any English string should
read it as invented here, because it was.

## 3. Permission model

**Nothing in this section changes.** No role gate is added, removed or moved, and no control changes
who may reach it. Stated against `.ai/standards/rbac-and-security.md` because R6 reads this section
and "unchanged" is a decision, not an omission:

| Action | Role | Where the check lives | Changed here |
|---|---|---|---|
| Create an entry for oneself | member | row-level security on `entry` (ADR-005) | no |
| Edit or delete one's own entry | member | row-level security on `entry` | no |
| Read any entry in the team | member | row-level select policy | no |
| Add to or remove from the allow-list | admin | row-level security on the allow-list table | no |
| Remove or promote a member | admin | row-level security plus ADR-016's trigger | no |

**The denials are unchanged for the same reason**: a non-admin still cannot reach any admin action,
and the refusal they meet is the same refusal, with the same `code`, in a different language. This
ticket rewrites the `message` half of a `Failure` and nothing that decides whether a `Failure` is
returned.

**One thing worth a reviewer's eye.** The refusal sentences become English on both sides of the seam,
and a refusal sentence is the only part of the permission model a user ever reads. The wording in § 4
is deliberately outcome-shaped and never mechanism-shaped — it says what was refused, not which
policy refused it — which is the existing convention in these files and not a change of it.

## 4. Contract

No entry-point signature changes. Every seam function keeps its name, arity and return type; what
changes is the value of the `message` field inside a `Failure` it already returned.

**The one new module.** `src/lib/labels.ts` — above the seam, importing only domain types, imported
by components and routes. It is not in `src/lib/data/`, so RULE-02 and the `supabase-client-in-seam`
boundary are untouched.

```ts
// src/lib/labels.ts
import type { EntryPortion, EntryStatus, EntryType } from "@/lib/domain/types";

/** A WFH member IS working — glossary.md calls this the single most costly confusion in the
 *  domain, which is why the label says so rather than reading as a kind of absence. */
export const TYPE_LABELS: Record<EntryType, string> = {
  pto: "Leave",
  wfh: "Working from home",
};

/** INV-06: one portion for the whole entry, so one label for the whole range. */
export const PORTION_LABELS: Record<EntryPortion, string> = {
  full: "Full day",
  am: "Morning",
  pm: "Afternoon",
};

export const STATUS_LABELS: Record<EntryStatus, string> = {
  pending: "Awaiting approval",
  approved: "Approved",
  rejected: "Rejected",
};
```

**Every value above is already shipped English copy**, taken verbatim from `TeamEntries.tsx:43-60`,
with one exception: `full` is `"Full day"`, which resolves AC-13 against `WeekView.tsx:104`'s
`"All day"`. `WeekView.tsx` and `YearView.tsx` declare a two-key `TYPE_LABEL` and `WeekView.tsx` a
`PORTION_LABEL`, both singular; they are deleted and replaced by an import of the maps above, which
are supersets.

**The seam's refusal sentences**, exact and copy-pasteable. `code` values are reproduced only to bind
each sentence to the refusal it belongs to; **no `code` changes** (AC-6).

| `code` | English `message` |
|---|---|
| `network` | `Could not reach the server. Please try again.` |
| `email_already_registered` | `That address already has an account.` |
| `weak_password` | `That password is too weak. Please choose a longer one.` |
| `rate_limited` | `Too many attempts. Please wait a moment and try again.` |
| `invalid_credentials` | `That email or password is not correct.` |
| `email_not_confirmed` | `Open the confirmation link in your email before signing in.` |
| `unknown` | `Something went wrong. Please try again.` |
| `already_allow_listed` | `That address is already on the list.` |
| `not_permitted` (generic) | `You do not have permission to do this.` |
| `not_permitted` (admin sign-in) | `You need to sign in with an admin account.` |
| `not_permitted` (add to list) | `Only an admin can add an address.` |
| `not_permitted` (remove from list) | `Only an admin can remove an address.` |
| `not_permitted` (address not found) | `That address is not on the list.` |
| `not_permitted` (remove address) | `That address could not be removed.` |
| `already_consumed` | `Someone has already used that address to join the team, so it cannot be removed.` |
| `not_permitted` (remove member) | `Only an admin can remove a member.` |
| `not_permitted` (member not found) | `That member could not be removed.` |
| `not_permitted` (remove self) | `You cannot remove yourself from the team.` |
| `not_permitted` (already left) | `That person has already left the team.` |
| `not_permitted` (promote) | `Only an admin can promote a member.` |
| `not_permitted` (promote target) | `That person could not be promoted.` |
| `not_permitted` (already admin) | `That person is already an admin.` |
| `not_permitted` (promote a leaver) | `Someone who has left the team cannot be promoted.` |
| `entry_not_permitted` (create) | `This entry could not be created.` |
| `entry_not_permitted` (update) | `This entry could not be edited.` |
| `entry_not_permitted` (delete) | `This entry could not be deleted.` |
| `entry_overlap` | `You already have an entry covering these dates and this portion. Edit the existing entry, or choose a different range.` |
| `invalid_date_range` | `The end date must be the same as, or after, the start date.` |

The three constants at `supabase.ts:403-405` keep their names — `CREATE_REFUSED`, `UPDATE_REFUSED`,
`DELETE_REFUSED` — and take the three `entry_not_permitted` sentences above. `mock.ts` repeats the
same three literals, as it does today and for the reason `supabase.ts` records.

**Screen copy.** The remaining literals, by file:

- `NewEntry.tsx` — title `Book leave or working from home`; submit `Save entry`; submitting
  `Saving…`; heading `Your entries`; empty state `You have no entries yet.`; tentative marker
  `Not certain`; the three status words from `STATUS_LABELS`; controls `Edit`, `Delete`,
  `Delete permanently`, `Cancel`; the delete failure `This entry could not be deleted. Please try
  again.`
- `EditEntry.tsx` — title `Edit entry`; submit `Save changes`; submitting `Saving…`; loading
  `Loading…`; not-found `We could not find that entry in your list.`; back links `Back to your
  entries` and `Back to the list`; approval line `Approved by {name}`; last-edited `Last edited:
  {timestamp}`; the local refusal `This entry could not be edited.`
- `EntryForm.tsx` — legends `Type`, `Portion`; fields `From`, `To`; tentative `Not certain`; note
  `Note (optional)`; the local failure `This entry could not be saved. Please try again.`

**The ratchet suite in `tests/ui-language.test.ts`** (added to the contract on 2026-09-07 — AC-12).
The two `it.each` calls over `copyDebt` at `:47-60` become **one `it` that iterates inside its own
body**, so the suite holds exactly one test at every list length including zero:

```ts
describe("§ Language — the ratchet only shrinks", () => {
  it("every copyDebt entry exists and still has copy to translate", () => {
    // One case rather than `it.each`, because `it.each([])` registers no test and Vitest 4 fails
    // the enclosing suite with "No test found in suite" — which is precisely the state this list
    // is meant to reach. The ratchet is most worth asserting when it is empty, and the shape it
    // had until now asserted nothing exactly then.
    for (const path of copyDebt) {
      expect(existsSync(repoRoot + path), `${path} is listed but does not exist`).toBe(true);
      expect(diacritic.test(read(path)), `${path} is listed but has no copy left`).toBe(true);
    }
  });
});
```

**Both assertions keep their present meanings** — a stale entry silences the lint rule for a path
nothing occupies, and a paid debt may not stay listed — and both keep their failure messages, which
is the only thing an `it.each` was buying. The first `describe` in the file is untouched: its three
cases are the exception's protection, they pass today, and AC-9 and AC-11 rest on them.

## 5. Seam impact

**No function is added, removed or changed in signature.** `tests/seam-parity.test.ts` compares export
names and arity and passes unedited.

Both implementations are edited, and they must be edited together. `supabase.ts` and `mock.ts` carry
the same refusal sentences by design, `seam-parity.test.ts` never compares message text, and the
end-to-end suite drives the mock — so a one-sided translation is green against typecheck, lint, unit
and end-to-end, and diverges only against a real Supabase project where nobody is looking. **That is
the reason this ticket spans two feature groups and may not be cut by group**; `ticket.yaml` § 5
establishes it and § 7 below keeps both files in one `allowed_paths`.

The `code` half of every `{ code, message }` is an identifier, is already English, and does not move
(AC-6).

## 6. Schema delta

`none`. No migration, no policy, no trigger, no constraint, no column. ADR-014 does not engage
because no SQL is written at all — `supabase/seed.sql` is out of scope and untouched.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/OPS-002/**"
  - "src/lib/labels.ts"
  - "src/components/EntryForm.tsx"
  - "src/routes/NewEntry.tsx"
  - "src/routes/EditEntry.tsx"
  - "src/routes/TeamEntries.tsx"
  - "src/routes/PendingEntries.tsx"
  - "src/routes/WeekView.tsx"
  - "src/routes/YearView.tsx"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "ui-language.json"
  - "tests/ui-language.test.ts"
```

**Twelve files outside the ticket folder. `size: M`** — the table at
`.ai/01-operating-model.md:370-374` puts M at up to 12 and L at more than 12. **This is the ceiling
exactly, with no headroom left.** The first version of this section listed eleven and said it had one
file of headroom; `tests/ui-language.test.ts` spent it, for the reason AC-12 records. Anything further
this ticket turns out to need makes it L, and L must split at PLAN — so the next amendment is a split
rather than a twelfth-and-a-half file.

**`tests/ui-language.test.ts` was added on 2026-09-07, after `/implement` reported it BLOCKED.** The
Developer could not satisfy AC-10 and AC-12 together and could not reach the one file that would
resolve it, which is `R5 impossible as specified` and routes here without incrementing
`rework_count` (`.ai/01-operating-model.md:145`). The exclusion was my error and not a scope
discovery: § 1 puts "a lint rule or check that enforces § *Language*" out of scope, and I carried
that too far — declining to *build* a new check is not the same as declining to *keep the existing
one running*, and AC-10 cannot be satisfied without editing the test that reads the list AC-10
empties. The two ACs were written to depend on each other and only one of them had a file.

**`size_estimate` and `size` agree at M**, so ADR-012's precedence never engages. They agree for a
reason that is nearly a coincidence and is worth one line: the estimate was formed from the shell's
five-file scope plus the label reconciliation, and the verdict counts eleven — the five files
arrived as expected and the reconciliation cost six rather than the two the shell's § 6 implies,
because two more copies of the label sets shipped after triage was written. The two figures land in
the same bucket while disagreeing about which files fill it.

**Four files here are not in the shell's scope statement and are not in `copyDebt`**, because they
are already English: `PendingEntries.tsx`, `WeekView.tsx`, `YearView.tsx`, and `TeamEntries.tsx`
beyond its label maps. They are in scope only to delete a duplicate declaration and add an import —
AC-8 is unsatisfiable without them. `ticket.yaml` § 6 states that three copies of the label sets must
not survive this ticket; the tree now holds **five** declarations of the type labels
(`EntryForm.tsx:35`, `TeamEntries.tsx:43`, `PendingEntries.tsx:72`, `WeekView.tsx:112`,
`YearView.tsx:101`), two of the status labels and three of the portion labels. `PendingEntries.tsx:71`
even names OPS-001 as the ticket that would fold them, and OPS-001 shipped without doing so. Folding
only the three the shell knew about would leave two identical English copies behind and guarantee a
sixth.

**`ui-language.json` is not optional.** `tests/ui-language.test.ts` fails on "still has copy to
translate" the moment a listed file loses its diacritics, so the translation and the `copyDebt`
deletion must land in the same change.

## 8. Rejected alternatives

**Translate the literals in place and leave the copies where they are.** This is the smallest possible
ticket: five files, no new module, no import churn, and `PendingEntries.tsx`, `WeekView.tsx` and
`YearView.tsx` never opened. It was rejected because it satisfies the standard and defeats the ticket.
`ticket.yaml` § 6 requires that the duplicate label sets not survive, and the tree has already
demonstrated the cost of leaving them: three screens shipped `full` as "Full day" and one as "All
day", a divergence nobody introduced deliberately and no test caught. Translating in place would add
a fifth and sixth copy of the same words in a second language and hand the next screen a choice of
five places to copy from. The duplication is the defect; the language is only how it became visible.

**Extract a keyed catalogue — `t("entry.form.title")` — with or without a library.** This is the
idea's open question 3 and the shape most people reach for. Rejected on two counts. If it reaches for
a package it is a `.ai/standards/tech-stack.md` change needing an ADR and a human, which the shell
says must stop and ask rather than be decided quietly — and the product has exactly one language, so
the machinery would carry no second locale and earn nothing. If it is hand-rolled it is worse than
what § 4 proposes: a flat key space over roughly sixty strings, indirection at every call site, and
no type safety, in exchange for solving a problem — swapping locales at runtime — that nobody has.
`Record<EntryType, string>` already gives exhaustiveness on the three sets where duplication actually
hurt, which is the whole of the observed defect.

**Split into two tickets: translate now, reconcile later.** Rejected because the reconciliation ticket
would have to reopen all five translated files plus four more, and because "later" already happened
once — `TeamEntries.tsx:42` handed the fold to "the ticket that translates the other thirteen files"
and `PendingEntries.tsx:71` handed it to OPS-001, which shipped without it. A third handover would be
the strongest evidence yet that the fold does not happen unless a ticket is sized to include it. At
eleven files this one is, with a file to spare.

## Changelog

- `2026-09-07T08:21:08+07:00` — plan created. Raised by `tech-lead-design`.
- `2026-09-07T08:21:08+07:00` — sections 1, 2 and 7 amended after reading the source tree, and the
  amendment is recorded here because it widened scope rather than narrowing it. Sections 1 and 2 were
  drafted against the shell's five-file scope and its § 6 statement that three copies of the label
  sets exist. The tree holds five declarations of the type labels, not three: `PendingEntries.tsx`
  and `YearView.tsx` shipped after the shell was written on 2026-09-03, and `WeekView.tsx` carries a
  differently-named variant that had already diverged on the wording of `full`. AC-8 and AC-13 were
  added in response, and § 7 grew from seven files to eleven. Raised by `tech-lead-design`. Amended
  by `tech-lead-design`.
- `2026-09-07T08:45:00+07:00` — AC-12 rewritten, § 4 gained the ratchet suite's required shape, and
  § 7 gained `tests/ui-language.test.ts` (eleven files to twelve, the M ceiling exactly). **AC-10 and
  AC-12 as first written could not both be satisfied**: AC-10 empties `copyDebt`, and AC-12 assumed
  the two `it.each` cases over that list would go vacuous, but Vitest 4.1.11 fails a suite that
  registers no tests. Reproduced on this branch — `tests/ui-language.test.ts` fails with `No test
  found in suite § Language — the ratchet only shrinks` while its other three cases pass. The file
  was not in `allowed_paths`, so the Developer could not resolve it: `R5 impossible as specified`,
  routed to `tech-lead-design` with no `rework_count` increment (`.ai/01-operating-model.md:145`).
  The rewritten AC-12 also closes a defect the suite had independently of this ticket — at
  `copyDebt.length === 0` it asserted nothing about the ratchet, which is when the ratchet is most
  worth asserting. Raised by `developer` in `99-questions.md`. Amended by `tech-lead-design`.
