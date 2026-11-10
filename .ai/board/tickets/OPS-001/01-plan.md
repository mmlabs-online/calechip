---
ticket: OPS-001
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-03T16:29:46+07:00
inputs_read:
  - .ai/board/tickets/OPS-001/ticket.yaml
  - .ai/board/ideas/2026-09-03-the-interface-and-its-standard-speak-different-languages.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/standards/ui-design-system.md
  - .ai/standards/architecture.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/board/tickets/BUG-001/ticket.yaml
  - ui-language.json
  - eslint.config.js
  - tests/ui-language.test.ts
  - src/App.tsx
  - src/routes/Home.tsx
  - src/routes/SignIn.tsx
  - src/routes/SignUp.tsx
  - src/routes/NotOnATeam.tsx
  - src/routes/AllowList.tsx
  - src/routes/MemberList.tsx
  - src/lib/fixtures.ts
  - tests/e2e/tea-05-sign-in.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# OPS-001 — UI copy to English, chrome, account and team screens

## 1. Problem and scope

### There is no feature row, and that is correct

**`OPS-001` is a chore, not a feature.** `.ai/registry/features.md` is what `CLAUDE.md` calls *"the
only valid source of feature IDs"*, and `.ai/01-operating-model.md:317` declares the scheme —
*"Defects are BUG-nnn, chores are OPS-nnn."* So there is nothing to transcribe here, and the ticket
shell's §6 records why no row was added: nothing regressed, and no capability is gained.

The five rows this ticket serves, each already in the registry, are `TEA-01`, `TEA-02`, `TEA-03`,
`TEA-04` and `TEA-05`. Each carries a sentence appended to its `Notes` by `/triage` citing the idea
file and this ticket. **The standard this ticket exists to satisfy is the source instead**, and it is
transcribed rather than paraphrased:

> **Every string the interface renders is in English.** Labels, headings, buttons, placeholders,
> empty states, and the user-facing `message` on every error returned across the data-access seam.
> The operator's instruction on 2026-09-03: *"tôi muốn tất cả content đều là tiếng anh"*.

— `.ai/standards/ui-design-system.md:46-48`, § *Language*.

### The shell's §0 precondition is discharged, and its citation instruction is now wrong

The shell says PR #37 is open and unmerged, that § *Language* lives only in commit `3ccbd37`, and
that the standard must therefore be cited as `3ccbd37:.ai/standards/ui-design-system.md` and
**never bare**, because a bare line citation would resolve to `## Selectors` on the 52-line stub.

**All three statements were true when it was written and none is true now.** Verified rather than
assumed: `gh pr view 37` reports `state: MERGED`, `mergedAt: 2026-09-03T08:15:20Z`.
`.ai/standards/ui-design-system.md` on `origin/main` is 109 lines with `## Language` at line 44. So
the precondition is met, the ticket is valid rather than invalid, and **every citation in this plan
is bare and resolves on `main`** — following the shell's instruction now would produce citations
pinned to a commit nobody needs.

### What this gives whom

Nobody gains a capability. What the **team** gains is a product that says one thing about what
language it speaks, and a repository whose standard and whose interface agree. The idea file's title
is the whole problem: *the interface and its standard speak different languages*.

What the **next twelve unbuilt features** gain is the more valuable half, and it is already banked:
`ui-language.json` lists twelve files as `copyDebt` and the lint rule is in force everywhere else
from the day § *Language* landed. This ticket removes seven of those twelve. **It is the ratchet
turning, not the rule arriving.**

**`size_estimate`: M.** Nine files — seven shipped screens, one config, one spec — and 72 lines
carrying a diacritic, measured rather than recalled. Not `S`: the surface is seven files and the
`AllowList` and `MemberList` screens carry 23 and 25 lines each. Not `L`: nothing is designed,
nothing is added, and every changed line is a string.

### Out of scope

- **`src/lib/fixtures.ts` and `supabase/seed.sql`. DO NOT TOUCH EITHER FILE.** They are §
  *Language*'s stated exception and `ui-language.json`'s permanent `userContent` list. Section 2
  states this as a criterion because it is a **negative** requirement and those are the ones nobody
  checks.
- **The other five `copyDebt` files** — `src/components/EntryForm.tsx`, `src/lib/data/mock.ts`,
  `src/lib/data/supabase.ts`, `src/routes/EditEntry.tsx`, `src/routes/NewEntry.tsx`. They are
  OPS-002's, and seven plus five is exactly the twelve `copyDebt` holds.
- **Reinterpreting § *Language*.** `.ai/standards/` is human plane under RULE-01. This ticket
  implements the section; it does not amend it, narrow it, or add to its exception.
- **Adding anything to `copyDebt`.** The list only ever shrinks. `ui-language.json`'s own header
  calls growing it *"how a ratchet becomes a suppression list"*.
- **Date, number and name-order formatting.** `src/routes/AllowList.tsx` renders `dd/MM/yyyy`, which
  is numeric and language-neutral. § *Language* governs strings. Whether "English" reaches into
  formats is open question 4 in the idea file and belongs to the first calendar view.
- **Building or changing any enforcement mechanism.** The lint rule, `ui-language.json` and
  `tests/ui-language.test.ts` all already exist and all already work. This ticket edits exactly one
  field of one of them — seven names out of `copyDebt` — and changes no rule, no selector and no test.
- **Folding the two `roleLabel` definitions into one module.** A real duplication, and deliberately
  left standing — section 8, rejected alternative 1.
- **Any behaviour change at all.** No control moves, no `data-testid` changes, no route changes, no
  seam call changes. Every shipped acceptance suite except one file's three lines passes unedited.

## 2. Acceptance criteria

Observable through the interface, through `pnpm lint`, or through `pnpm test`. The selector attribute
is `data-testid` and no selector changes in this ticket.

**AC-1 — the chrome speaks English**
- **Given** a build resolving to the in-memory seam, and a session still resolving
- **When** the application renders
- **Then** the seam banner and the loading state are in English, and neither contains a Vietnamese
  diacritic

**AC-2 — the landing screen speaks English**
- **Given** a signed-in member on the landing screen
- **When** the screen renders
- **Then** the role label, the body text, both navigation links and the sign-out control are in
  English

**AC-3 — the sign-in screen speaks English**
- **Given** a signed-out caller on the sign-in screen
- **When** they submit credentials that are refused
- **Then** the heading, the field labels, the submit control in both its states, and the refusal
  message are in English

**AC-4 — the sign-up screen speaks English**
- **Given** a caller on the sign-up screen
- **When** the screen renders
- **Then** its headings, its four field labels, its submit control, the avatar picker's legend and
  the avatar picker's accessible name are all in English

**AC-5 — the member-less landing state speaks English**
- **Given** a signed-in caller with no member row
- **When** the screen renders
- **Then** every string on it is in English

**AC-6 — the allow-list screen speaks English**
- **Given** a signed-in admin on the allow-list screen with at least one open and one consumed entry
- **When** the screen renders, and a removal is requested
- **Then** the headings, the table headers, both entry states, the removal confirmation and both
  accessible names are in English

**AC-7 — the member list speaks English**
- **Given** a signed-in admin on the member list
- **When** the screen renders, and a removal is requested
- **Then** the role labels, the table headers, the removal confirmation and the confirmation's
  accessible name are in English

**AC-8 — the five accessible names are translated**
- **Given** the shipped interface
- **When** every accessible name that is not visible text is read
- **Then** none contains a Vietnamese diacritic — specifically the four `aria-label` attributes on
  the allow-list's add and confirm controls, the member list's confirm control and the sign-up
  avatar picker, and the sign-up avatar picker's `<legend>`

**AC-9 — seed data stays Vietnamese, with diacritics**
- **Given** the seeded member whose display name is `Thành viên`
- **When** they sign in and the landing screen renders
- **Then** their **name** is still `Thành viên` while their **role label** beside it is English —
  the same literal, two lines apart, with opposite verdicts

**AC-10 — the exception is still alive**
- **Given** the repository after this ticket
- **When** `pnpm test` runs
- **Then** `tests/ui-language.test.ts` passes unedited, asserting that `src/lib/fixtures.ts` and
  `supabase/seed.sql` still contain Vietnamese diacritics

**AC-11 — the ratchet turns and does not slip**
- **Given** `ui-language.json`, whose `copyDebt` lists twelve files
- **When** this ticket is complete
- **Then** `copyDebt` lists exactly the five files OPS-002 owns, `userContent` is unchanged, and no
  file has been added to either list

**AC-12 — the rule now guards the seven files it could not**
- **Given** the seven files this ticket translates, no longer exempt
- **When** `pnpm lint` runs
- **Then** it exits 0, and a Vietnamese diacritic reintroduced into any of the seven is reported as
  an error

**AC-13 — nothing else changed**
- **Given** every acceptance suite shipped before this ticket
- **When** `pnpm test` and the end-to-end suite run
- **Then** all pass, with `tests/e2e/tea-05-sign-in.spec.ts` the only spec edited and only in its
  three `home-member-role` assertions

### Invariants touched

**`[]`, reached rather than defaulted.** The shell's `invariants_touched: []` is the template's
default and its own note says so; this is the considered answer, and
`.ai/registry/invariants.md` warns that concluding "none" from safe behaviour is circular reasoning.
So the mechanism is stated rather than the conclusion:

**No file in `allowed_paths` reads or writes a row.** All seven source files sit above the seam —
none is under `src/lib/data/`, none imports the Supabase client (RULE-02's lint rule would refuse
it), and none contains a query, a policy, a migration or an arithmetic. `ui-language.json` is lint
and test configuration. The one spec edited changes three assertions about a rendered label. **The
seam files that do carry copy — `src/lib/data/mock.ts` and `src/lib/data/supabase.ts` — are
deliberately OPS-002's**, so this ticket does not touch the layer where a row could be reached at all.

All seven ledger rows range over `entry` and `member` rows: INV-01 over one member's overlapping
entries, INV-02 over an approved entry's columns, INV-03 over a rejected entry's reason, INV-04 and
INV-05 over the absence count, INV-06 over an entry's portion, INV-07 over an entry's member. None is
reachable from a string literal in a screen.

**INV-03 is the nearest and the one worth writing out**, because it is the only invariant whose
subject is *text*: a rejected entry must carry a non-empty `rejection_reason`. That text is
**user-authored** — a member's admin types it — and this ticket changes no default for it, no
validation of it, and no storage of it. An entry whose reason was typed in Vietnamese satisfies
INV-03 exactly as before, and § *Language*'s own line settles the category: *what the product says is
English; what a user typed is whatever they typed.*

### Open questions

1. **`roleLabel` is written twice and stays written twice.** `src/routes/Home.tsx` and
   `src/routes/MemberList.tsx` each define their own mapping from `MemberRole` to a display string,
   and both are in this ticket — so this is the ticket that *could* stop them drifting. It does not,
   deliberately, and section 8 rejected alternative 1 carries the reasoning. **Not blocking.** The
   duplication is unchanged by this ticket rather than introduced by it, and the right home for a
   shared label module is a question about the component layer that a copy chore should not answer.

2. **Nothing enforces § *Language* outside `src/`.** The lint rule is scoped `files: ["src/**"]`, so
   a Vietnamese string added to a `tests/e2e/**` assertion, to a script, or to a hook is not reported.
   This ticket edits three such assertions and leaves three others Vietnamese **correctly** (AC-9),
   which is exactly the judgement no mechanism makes. **Not blocking, and not this ticket's to fix** —
   widening the rule's scope is a change to an enforcement mechanism and belongs in
   `.ai/board/model-debt.md`, which the idea file already notes.

3. **The `depends_on: [CAL-03]` note in the shell is stale.** §3 says the ticket *"FAILS Definition
   of Ready item 3 today, on purpose"* because CAL-03 was `BACKLOG`. **CAL-03 is now `DONE`**, so item
   3 passes and the file collision §3 describes — CAL-03 claiming `src/App.tsx` and
   `src/routes/Home.tsx` — is resolved rather than pending. Recorded so a reviewer reading the shell
   does not conclude the ticket is still blocked.

---

*Sections 1 and 2 above were written before the source tree was read for line-level detail. Sections
3 to 8 were written after. Nothing in 1 or 2 was amended — the measurement confirmed the shell's
figures exactly.*

---

## 3. Permission model

**No role gate applies to anything in this ticket, and no permission changes.**

| Action | `member` | `admin` | Where the decision is made |
|---|---|---|---|
| every action on all seven screens | unchanged | unchanged | the policies already shipped by TEA-01 to TEA-05, untouched |

This section is complete and its answer is *none*, which § *Gate* in `.ai/templates/plan.md`
distinguishes from an omission: no policy, no grant, no `with check`, no `is_admin` call and no
migration appears anywhere in `allowed_paths`. Nothing in this ticket can be reached by a role that
could not reach it before, because **no control is added, removed, renamed or re-guarded** — only the
characters inside strings change.

**Two things a reviewer should confirm rather than assume**, both stated here because check R6 reads
this section and would otherwise find nothing to read:

- **`src/routes/MemberList.tsx` and `src/routes/AllowList.tsx` are admin-gated screens**, and their
  refusal states are among the strings being translated. A refusal that stops rendering, or renders
  an empty string, would be a permission regression delivered by a copy change. AC-6 and AC-7 name
  the refusal text; the shipped suites for TEA-02, TEA-03 and TEA-04 assert the refusal *selectors*,
  and those are not in `allowed_paths`.
- **The four `aria-label` attributes carry no authorization meaning** and are not affordances in the
  ADR-005 sense. They are accessible names. They appear in section 4 because they are invisible, not
  because they gate anything.

## 4. Contract

**No entry point, no signature, no schema and no return type changes.** RULE-04 has nothing to fix
here: the Developer invents no name, because every string being written replaces one that already
exists in the same position.

What section 4 must pin instead is **which strings move and which do not**, because that is the
decision an implementer can get wrong. Every figure below was measured on `origin/main` with the
diacritic class `[À-ɏḀ-ỿ]` — `ui-language.json`'s own pattern — not recalled.

### 4.1 The seven files, and the lines carrying a diacritic

| File | Lines | What they are |
|---|---:|---|
| `src/App.tsx` | 2 | the mock-seam banner, and the session loading state |
| `src/routes/Home.tsx` | 5 | `roleLabel`, body text, two navigation links, sign-out |
| `src/routes/SignIn.tsx` | 4 | heading, password label, submit in both states, one refusal |
| `src/routes/SignUp.tsx` | 9 | headings, four field labels, submit, the avatar `<legend>`, one `aria-label` |
| `src/routes/NotOnATeam.tsx` | 4 | the whole empty state |
| `src/routes/AllowList.tsx` | 23 | headings, table headers, both entry states, confirmation, two `aria-label`s |
| `src/routes/MemberList.tsx` | 25 | a second `roleLabel`, table headers, confirmation, one `aria-label` |
| **total** | **72** | |

**The counts match the triage's figures exactly**, re-measured after CAL-02 and CAL-03 shipped into
two of these files. Nothing drifted.

### 4.2 The five accessible names — the ones a careless pass survives

```
src/routes/AllowList.tsx:162    aria-label="Thêm địa chỉ"
src/routes/AllowList.tsx:271    aria-label="Xác nhận gỡ địa chỉ"
src/routes/MemberList.tsx:315   aria-label="Xác nhận gỡ thành viên"
src/routes/SignUp.tsx:128       aria-label="Ảnh đại diện"
src/routes/SignUp.tsx:124       <legend>Ảnh đại diện</legend>
```

**Four are `aria-label` attributes and render nothing visible**, so no manual walkthrough and no
screenshot will catch a missed one. The fifth is a `<legend>`, which *is* visible — the ticket shell
calls all five `aria-labels`, and that is the one place its detail is loose. It is corrected here
rather than repeated, because the distinction changes how each is checked: the legend is caught by
looking at the screen, the four are caught only by reading the source or by the lint rule.

**The lint rule catches all five once the file leaves `copyDebt`** (AC-12), which is the real control.
AC-8 exists so the requirement is stated rather than left to the mechanism.

### 4.3 The three assertions that move, and the three that must not

`tests/e2e/tea-05-sign-in.spec.ts` carries six assertions containing a diacritic. **Three change,
three stay, and they are interleaved:**

```
:63   home-member-name  "Thành viên"      SEED DATA      — KEEP
:65   home-member-role  "Thành viên"      LABEL          — TRANSLATE
:137  home-member-name  "Thành viên"      SEED DATA      — KEEP
:140  home-member-name  "Thành viên"      SEED DATA      — KEEP
:146  home-member-role  "Quản trị viên"   LABEL          — TRANSLATE
:155  home-member-role  "Thành viên"      LABEL          — TRANSLATE
```

**Lines 63 and 65 are the same literal, two lines apart, with opposite verdicts.** § *Language*
predicted this failure in advance and `tests/ui-language.test.ts` was written for it: a
find-and-replace of `"Thành viên"` across the repository translates the seed data along with the
label, **every end-to-end test still passes**, and the product silently loses its only rendering of a
Vietnamese diacritic. The selector is the discriminator and the only one — `home-member-name` is user
content, `home-member-role` is interface copy.

Lines 9 to 11 of that file are **comments** naming the seeded display names. They describe seed data
and stay Vietnamese. They are not assertions and are not among the three.

### 4.4 `ui-language.json` — the only structural change in the ticket

`copyDebt` loses exactly these seven entries and keeps exactly these five:

```json
"copyDebt": [
  "src/components/EntryForm.tsx",
  "src/lib/data/mock.ts",
  "src/lib/data/supabase.ts",
  "src/routes/EditEntry.tsx",
  "src/routes/NewEntry.tsx"
]
```

`userContent`, `diacritic` and `$comment` are untouched. **No entry is added, and no entry moves from
`userContent` into `copyDebt`** — `tests/ui-language.test.ts` asserts the second of those directly.

**The removal is not optional and cannot be deferred to a later ticket.**
`tests/ui-language.test.ts` asserts that every `copyDebt` entry *still has copy to translate*, so the
moment a file is translated its entry fails until it is removed. The list cannot claim a debt that is
already paid, and the two halves of this ticket — translating and de-listing — are one commit or
neither.

### 4.5 What the English strings say

**Not specified here, deliberately, and this is the one place this plan hands a decision to the
implementer.** § *Language* requires English and fixes no wording; `.ai/standards/ui-design-system.md`
§ *Direction*, § *Colour* and § *Type* are still `TODO(project)` stubs, so there is no voice or tone
to conform to. Inventing a phrasebook here would be inventing a standard, which is
`.ai/standards/`'s to hold and RULE-01's to protect.

**The constraint that does bind:** each string keeps its *role* and its *register*. A label stays a
label, a confirmation stays a question, a refusal stays a sentence a member can act on, and no string
becomes longer than the control that holds it. Where a Vietnamese string was deliberately vague —
`src/routes/SignIn.tsx`'s single refusal covers both an unknown address and a wrong password, so that
nobody can test whether a colleague has an account — **the English must stay equally vague.** That is
TEA-05 AC-2 and it is a security property carried in a string.

## 5. Seam impact

**None.** No function is added, removed or changed; no signature moves; `tests/seam-parity.test.ts`
is untouched and unaffected.

Worth stating rather than leaving blank, because § *Language* explicitly puts the seam in scope for
the standard: *"Error messages are interface, wherever they live … `src/lib/data/supabase.ts` and
`mock.ts` both return `{ code, message }`, and the `message` half is rendered to a user."* Both files
carry copy — 24 and 26 diacritic lines respectively — and **both are OPS-002's.** They are absent
from this ticket's `allowed_paths` and remain in `copyDebt` after it.

That split is why this ticket's `invariants_touched` is `[]` with a mechanism behind it rather than
an assertion: the half of the surface that lives inside the seam is not in this ticket at all.

## 6. Schema delta

**`none`.** No migration, no table, no column, no enum, no policy, no trigger, no constraint, no
grant. ADR-014 does not engage, because ADR-014 is about migrations that *look* like `none` and are
not — and this ticket ships no `.sql` file of any kind.

`supabase/seed.sql` is not merely unmigrated, it is **out of scope and must not be edited at all**
(section 1, section 2 AC-9, AC-10). It is `userContent`, permanently.

`ticket.yaml` already carries `schema_delta: none` and `requires_adr: false` from triage. **Both are
correct and neither is changed** — the first two OPS-shaped tickets this board has planned, CAL-02
and CAL-03, both had to have `requires_adr` corrected; this one does not, and saying so is cheaper
than a reviewer checking.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/App.tsx"
  - "src/routes/Home.tsx"
  - "src/routes/SignIn.tsx"
  - "src/routes/SignUp.tsx"
  - "src/routes/NotOnATeam.tsx"
  - "src/routes/AllowList.tsx"
  - "src/routes/MemberList.tsx"
  - "ui-language.json"
  - "tests/e2e/tea-05-sign-in.spec.ts"
```

Nine globs, nine files. **Nothing is new** — the first ticket on this board to create no file at all.

**`size`: M, agreeing with `size_estimate` in section 1.** ADR-012 is not engaged and nothing splits.
Nine is comfortably inside M's ceiling of twelve, and the split that put it there was made at triage
for exactly this reason: `.ai/01-operating-model.md:374` sizes more than twelve files as `L`, `L` must
split at PLAN, and the full thirteen-file surface would have arrived here only to be cut. **The cut
holds** — seven here, five in OPS-002, twelve `copyDebt` entries, no file in both and none in
neither.

**Deliberately absent, each with its reason:**

- **`src/lib/fixtures.ts` and `supabase/seed.sql`** — § *Language*'s permanent exception, and the
  product's only coverage for the diacritics requirement in `CLAUDE.md` § *Visual direction*. **Their
  absence from this list is a control, not an omission**, and it is the strongest one available: a
  file outside `allowed_paths` is refused by `guard-allowed-paths.mjs` at write time and by
  `scripts/check-allowed-paths.mjs` in CI, so RULE-03 enforces § *Language*'s exception here even
  though no rule was written to do so.
- **`tests/ui-language.test.ts`** — the safety net, and it must pass **unedited**. It is what fails
  if the exception is translated away or if a paid debt stays listed. Editing it to accommodate a
  failure would remove the only thing checking this ticket's most dangerous edit.
- **`eslint.config.js`** — it reads `copyDebt` from `ui-language.json` and needs no change. Editing
  the rule instead of the list is how a ratchet becomes a suppression list.
- **`src/components/EntryForm.tsx`, `src/lib/data/mock.ts`, `src/lib/data/supabase.ts`,
  `src/routes/EditEntry.tsx`, `src/routes/NewEntry.tsx`** — OPS-002's five.
- **`tests/e2e/tea-01-signup.spec.ts`, `tea-05`'s siblings, `smoke.spec.ts`, `cal-01`, `cal-02`,
  `cal-03`** — every other shipped suite passes unedited (AC-13). They assert selectors, and no
  selector changes.
- **`.ai/standards/ui-design-system.md`** — the standard is implemented, never amended. Human plane,
  RULE-01.
- **`.ai/registry/features.md`** — `/triage` already appended the provenance sentence to the five TEA
  rows, and the `Status` column is `/ship`'s alone.

**On the branch name.** `feat/OPS-001` contradicts `.ai/standards/git-conventions.md:36`, which says
`<FEATURE-ID>` is a row in `features.md` — and `OPS-001` is not a row. The shell's §4 records that the
operator settled this exact trade-off for `feat/BUG-001` on 2026-09-03, choosing the enforced guard
over the documented name, and instructs that it not be reopened. **It is not reopened here.** It is
named only because RULE-03's enforcement on this ticket is doing unusually heavy lifting — see the
first bullet above — and a reader should know the guard is live rather than assume it.

## 8. Rejected alternatives

**1. Folding the two `roleLabel` definitions into one shared module while both files are open.**
Genuinely plausible and it is the option with the strongest argument on the merits: `Home.tsx` and
`MemberList.tsx` each map `MemberRole` to a display string, the two are now the same two strings in
two places, and this is the only ticket whose `allowed_paths` contains both — so any later ticket
wanting to fix it must claim two files it otherwise has no reason to touch. The triage explicitly
left the call here.

It is rejected because of what section 4.3 costs. **The only control on this ticket's most dangerous
edit is whoever reads the diff.** `tests/ui-language.test.ts` catches the exception being translated
away, and nothing catches a *label* being left Vietnamese or a *seed* string being translated inside
a file the rule now covers — the lint rule reports what is present and the test reports what is
missing, and neither reads intent. A diff in which every changed line is a string is a diff a
reviewer can scan in one pass. A diff that also deletes a function from two files, creates a third,
and rewires two imports is one where the reviewer's attention is split at exactly the moment
precision matters most. The duplication is unchanged by this ticket rather than caused by it, it
costs nothing while both labels say the same thing, and it is recorded as *Open questions* item 1 so
the next reader finds it rather than rediscovers it.

**2. One ticket for all twelve `copyDebt` files, rather than the OPS-001 / OPS-002 split.** Plausible
and it is what the standard's own sentence suggests — *"OPS-001 and OPS-002 empty the list"* reads
like bookkeeping around a single sweep, and a half-emptied `copyDebt` is a state nobody wants to sit
in for long. It is rejected because `.ai/01-operating-model.md:374` sizes more than twelve files as
`L` and `L` **must split at PLAN**: a thirteen-file ticket would reach this stage only to be cut, and
the cut would then be made by whoever was holding the plan rather than by the triage that reasoned
about where the seam boundary falls. The split is also better than arbitrary — OPS-002 owns both seam
files, so it is the ticket where § *Language*'s *"error messages are interface, wherever they live"*
clause is actually exercised, and OPS-001 owns none. Splitting on that line puts the standard's one
non-obvious clause entirely in one ticket instead of half in each.

**3. Translating the strings and leaving `copyDebt` untouched, letting OPS-002 empty the list once.**
Superficially attractive: `ui-language.json` would change in one commit instead of two, and the seven
files would be correct either way. It is rejected because it is **not possible** — and the reason is
the design of the ratchet rather than a preference. `tests/ui-language.test.ts` asserts that every
`copyDebt` entry still has copy to translate, so the seven entries fail the moment their files are
clean. The list is self-cleaning by construction, which is what makes it a better record than a
ticket marked DONE: the sweep is complete exactly when the list is empty, rather than when somebody
says it is. Recorded because "translate now, tidy the config later" is the natural instinct and it
fails the build immediately.

## Changelog

- `2026-09-03T16:29:46+07:00` — sections 1 to 8 written. Sections 1 and 2 written before the source
  tree was read for line-level detail; the measurement confirmed the shell's figures exactly and
  nothing in either section was amended. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
