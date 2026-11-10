---
ticket: OPS-001
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-03T16:56:32+07:00
inputs_read:
  - .ai/board/tickets/OPS-001/01-plan.md
  - .ai/board/tickets/OPS-001/03-impl-log.md
  - .ai/board/tickets/OPS-001/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/01-operating-model.md
  - .ai/templates/review-report.md
  - scripts/check-allowed-paths.mjs
  - ui-language.json
  - tests/ui-language.test.ts
  - git diff
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# OPS-001 — review report

Seven shipped screens, one lint-config file and three assertions in one spec. Every changed line is a
string or a comment quoting one. No selector, no control, no route, no signature, no seam call and no
`.sql` file moved.

**`next_state: DONE`, not `QA`.** `.ai/templates/review-report.md` still ships `next_state: QA` in its
front-matter block and its checklist still labels R7 as a dependency check while its own *R8 detail*
section asks for per-invariant reasoning. Both are stale against ADR-022, which removed the QA stage.
`.ai/01-operating-model.md:36` is the authority followed here — `IN_PROGRESS -> REVIEW -> DONE` — and
`:127` is the authority for R7 being the invariant check. Recorded rather than silently reconciled;
the template is the steward's to fix and not this ticket's.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | **PASS** | nine changed files, each matching a glob at `.ai/board/tickets/OPS-001/ticket.yaml:70-78`; the tenth path is the ticket's own folder, exempted at `scripts/check-allowed-paths.mjs:129` |
| R2 | typecheck exit 0 | **PASS** | `pnpm exec tsc --noEmit` → exit `0`, no output |
| R3 | lint exit 0 | **PASS** | `pnpm exec eslint .` → exit `0`, no output, with the seven files now **inside** the § Language rule rather than listed at `ui-language.json:20-26` |
| R4 | Nothing outside the seam reaches the datastore directly (RULE-02) | **PASS** | `src/routes/AllowList.tsx:12`, `src/routes/MemberList.tsx:17`, `src/routes/SignUp.tsx:11` all import `{ seam } from "@/lib/data"` and are unchanged in this diff; no file under `src/lib/data/` appears in `git diff --name-only` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | **PASS** | table below |
| R6 | Permission gating matches plan section 3 | **PASS** | `src/routes/MemberList.tsx:171-173` and `src/routes/AllowList.tsx:127` carry the gates and neither line appears in the diff |
| R7 | No invariant violated (RULE-07) | **PASS** | table below |
| R8 | No dependency added without an ADR | **PASS** | `git diff -- package.json pnpm-lock.yaml` is empty — 0 lines |

### R1 — the subset, verified against the working tree rather than against the script

`scripts/check-allowed-paths.mjs` exits `0` here reporting **`0 changed file(s)`**, because it diffs
`origin/main...HEAD` (`:122`) and this ticket is entirely uncommitted until `/ship`. **That pass is
vacuous and is not the evidence for R1.** The evidence is `git diff --name-only` on the working tree:

```
src/App.tsx  src/routes/Home.tsx  src/routes/SignIn.tsx  src/routes/SignUp.tsx
src/routes/NotOnATeam.tsx  src/routes/AllowList.tsx  src/routes/MemberList.tsx
ui-language.json  tests/e2e/tea-05-sign-in.spec.ts
.ai/board/tickets/OPS-001/ticket.yaml
```

Nine of ten match a glob at `ticket.yaml:70-78` exactly. The tenth is the ticket's own folder, which
`scripts/check-allowed-paths.mjs:129` excludes from the violation set by design. **Nothing was
created** — `git status --porcelain` shows `M` on all nine and `??` only on the ticket's own
artifacts.

`src/lib/fixtures.ts` and `supabase/seed.sql` are **absent from the diff**, which is plan section 7's
strongest control and the thing R1 is really guarding on this ticket: `git diff --stat` on both is
empty, and both still carry Vietnamese — 9 and 17 diacritic lines respectively, measured with
`ui-language.json:19`'s own pattern.

## R5 detail

Plan section 4 pins *which strings move and which do not* rather than an entry point or a signature.
One row per item.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| §4.1 — 72 diacritic lines across seven files become English | `src/App.tsx:43,56`; `src/routes/Home.tsx:29,63,76,109,120`; `src/routes/SignIn.tsx:54,67,83,107`; `src/routes/SignUp.tsx:56,67,69,83,98,112,124,128,164`; `src/routes/NotOnATeam.tsx:40,41-42,55`; `src/routes/AllowList.tsx` 23 lines from `:86` to `:305`; `src/routes/MemberList.tsx` 25 lines from `:22` to `:349` | Yes. Re-measured independently: `grep -cP '[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]'` returns **0 for all seven files** |
| §4.2 — the five accessible names | `src/routes/SignUp.tsx:124` `<legend>Avatar</legend>`, `:128` `aria-label="Avatar"`; `src/routes/AllowList.tsx:162` `aria-label="Add an address"`, `:271` `aria-label="Confirm removing the address"`; `src/routes/MemberList.tsx:313` `aria-label="Confirm removing the member"` | Yes. All five present, all five English. These are the ones a screenshot cannot catch and all five are translated |
| §4.3 — three assertions move, three must not | moved: `tests/e2e/tea-05-sign-in.spec.ts:65,146,155`, all `home-member-role` | Yes, and the negative half holds: `:63`, `:137`, `:140` still read `toHaveText("Thành viên")` on `home-member-name`. `git diff` on that file is **exactly three changed lines** |
| §4.4 — `copyDebt` loses seven, keeps five | `ui-language.json:20-26` | Yes. Exactly `EntryForm.tsx`, `mock.ts`, `supabase.ts`, `EditEntry.tsx`, `NewEntry.tsx` — OPS-002's five, no more and no fewer. `"userContent"` at `:27` and `"diacritic"` at `:19` are byte-identical; nothing was added to either list |
| §4.5 — each string keeps its role and its register | `src/routes/SignIn.tsx:54` — *"Sign-in failed. Please try again."* | Yes, and this is the row worth the most attention. The refusal names **neither** an unknown address nor a wrong password, so the English is as deliberately vague as the Vietnamese it replaced. That is TEA-05 AC-2, a security property carried in a string, and it survived |
| §4.5 (cont.) — the same property on the member-less screen | `src/routes/NotOnATeam.tsx:41-42` | Yes. *"Ask an admin to add this address to the allowed list first"* discloses nothing about whether the address is already on it — ADR-009 and TEA-01 AC-5 |
| §5 — seam impact `none` | — | Yes. No file under `src/lib/data/` in the diff; `tests/seam-parity.test.ts` unedited and passing |
| §6 — schema delta `none` | — | Yes. No `.sql` file of any kind in the diff |
| §7 — the safety net passes **unedited** | `tests/ui-language.test.ts` | Yes. `git status --porcelain` on it and on `eslint.config.js` is empty. Neither was edited to accommodate anything, which on this ticket is the difference between a ratchet and a suppression list |

### The two things that are judgement rather than mechanism, checked by reading

Plan section 8 rejected alternative 1 states outright that **the only control on this ticket's most
dangerous edit is whoever reads the diff.** Both halves were read line by line rather than inferred
from the green build.

- **`src/routes/Home.tsx:63,66` versus `tests/e2e/tea-05-sign-in.spec.ts:63`.** The literal
  `"Thành viên"` appears in this repository as an interface label and as a seeded display name, two
  lines apart in the spec, with opposite verdicts. The label at `src/routes/Home.tsx:29` is now
  `"Member"`; the seeded name at `supabase/seed.sql` is untouched and the assertion reading it at
  `:63` is untouched. **A find-and-replace would have passed every test and lost the product's only
  rendering of a Vietnamese diacritic.** It did not happen.
- **No English string was left where a Vietnamese one belonged.** `src/lib/fixtures.ts` and
  `supabase/seed.sql` show an empty diff, and both still test positive for diacritics.

### One wording change that is more than a translation, and it is correct

`src/routes/MemberList.tsx:157` renders *"The list may be incomplete, so none of it is shown."* where
the Vietnamese said, ambiguously, that a part is not displayed. Checked against the code rather than
against the old string: `view.phase === "unavailable"` at `:149` is an **early return** that renders
no roster at all (`:145-161`, before the `const { me, roster } = view` at `:163`). The English states
the actual behaviour where the Vietnamese was ambiguous about it. Not a finding — recorded because it
is the one line in the diff whose meaning changed rather than only its language, and a reviewer
should see that it was checked rather than skimmed.

## R7 detail

`invariants_touched` is **`[]`**, and the template's rule — *"no invariants affected" without per-ID
reasoning is a failed check* — is honoured by reasoning through all seven ledger IDs rather than by
accepting the empty list. The plan reached `[]` by mechanism (`01-plan.md` § *Invariants touched*);
the mechanism is what is verified here, not the conclusion.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no overlapping entries for one member | Unreachable. No file in the diff constructs, validates or persists an `entry` | `git diff --name-only` contains no path under `src/lib/data/` and no `src/routes/NewEntry.tsx` or `EditEntry.tsx` |
| INV-02 — an edited approved entry returns to `pending` | Unreachable. No approval state is read or written anywhere in the diff | `.ai/registry/invariants.md:34` ranges over an entry's columns; no entry column appears in any changed file |
| INV-03 — a rejected entry carries a non-empty reason | **Held, and it is the nearest.** The only invariant whose subject is *text*. That text is user-authored; this diff changes no default for it, no validation of it and no storage of it | `.ai/registry/invariants.md:35`. No `rejection_reason`, no default and no validator appears in `git diff`; the seam files that could carry one are OPS-002's and untouched |
| INV-04 — one definition of the absence count | Unreachable. **No arithmetic of any kind was added or changed.** Every changed line is a string literal, a JSX text node or a comment | no changed hunk in `git diff` contains an operator over entries; `src/routes/AllowList.tsx:20`'s `dd/MM/yyyy` formatter is untouched and out of scope by plan section 1 |
| INV-05 — a tentative entry counts as a non-tentative one | Unreachable. No `tentative` flag is read or written | no changed file references `tentative` |
| INV-06 — one portion per entry | Unreachable. No portion is read or written | no changed file references `portion`, `am`, `pm` or `full` |
| INV-07 — every entry belongs to one member | Unreachable. `roleLabel` at `src/routes/Home.tsx:29` and `src/routes/MemberList.tsx:22` **displays** a role and is never acted on; membership itself is decided at `src/routes/MemberList.tsx:171-173`, unchanged | `src/routes/MemberList.tsx:171-173` does not appear in `git diff` |

**No invariant here is held by a UI affordance.** The template's warning does not bite, because the
diff removes nothing that was holding one: the two gates that *look* like affordances —
`canRemove`/`canPromote` at `src/routes/MemberList.tsx:171-173` and the `refused` phase at
`src/routes/AllowList.tsx:127` — are both outside the diff, and both were already backed by the
seam's own policies, which this ticket does not open.

## R6 detail — the one way a copy change could have been a permission regression

Plan section 3 names two things to confirm rather than assume, and both were confirmed:

- **The admin-gated screens still refuse.** `src/routes/AllowList.tsx:127` (`view.phase === "refused"`)
  and `src/routes/MemberList.tsx:171-173` are unchanged — neither line is in the diff. The refusal
  *text* was translated (`src/routes/AllowList.tsx:133,135`) and the refusal *selector*
  `allow-list-refused` at `:130` is byte-identical, which is why TEA-02's shipped suite passes
  unedited. **Neither refusal renders an empty string**, which is the specific regression a careless
  copy change delivers.
- **The four `aria-label`s carry no authorization meaning.** They are accessible names, not
  affordances in the ADR-005 sense, and translating them gates nothing differently.

## Verification run

Every command was run in this session against the working tree. Exit codes are this reviewer's, not
the implementation log's.

| Command | Exit | Notes |
|---|---|---|
| `pnpm exec tsc --noEmit` | `0` | R2 |
| `pnpm exec eslint .` | `0` | R3, with the seven files no longer exempt |
| `pnpm exec vitest run` | `0` | 15 tests, 2 files. `tests/ui-language.test.ts` passed **unedited** |
| `pnpm exec playwright test` | `0` | **56 passed.** AC-13's claim, checked rather than trusted: every shipped suite passes and only `tea-05-sign-in.spec.ts` was edited |
| `node scripts/check-allowed-paths.mjs` | `0` | reports `0 changed file(s)` — **vacuous here**, see R1 above |
| `grep -cP '[\x{00C0}-\x{024F}\x{1E00}-\x{1EFF}]'` over the seven files | — | `0` in every one |
| the same, over `src/lib/fixtures.ts` and `supabase/seed.sql` | — | `9` and `17`. **The exception is alive** |
| `git diff -- package.json pnpm-lock.yaml` | — | empty. R8 |

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | none | — | — |

## Not findings, and why each is not one

Recorded so the next reader does not mistake silence for an oversight. None of these is in this
gate's scope and none blocks.

1. **`gates.plan.passed` is still `false` at `ticket.yaml:83`, and the PLAN gate was never
   recorded.** `01-plan.md` carries `gate: PASS` / `next_state: READY` and nothing moved the board.
   That transition is `orchestrator`-owned (`.ai/01-operating-model.md:82`), the developer correctly
   declined to back-fill it (`03-impl-log.md` Open questions 1), and **this reviewer may not touch
   `ticket.yaml` either.** It will block at `/ship`, which requires both gates. It is not a review
   finding — nothing about the implementation is wrong — but the orchestrator must record the PLAN
   gate and evaluate the Definition of Ready before `/ship` can run. DoR item 3 is satisfiable now:
   CAL-03 is `DONE`.
2. **`backlog.md:46` still shows OPS-001 as `BACKLOG`.** A view of `ticket.yaml`, orchestrator-owned,
   outside `allowed_paths`.
3. **`tests/e2e/tea-01-signup.spec.ts:165` quotes a string that no longer exists** — a comment naming
   `"Đang gửi…"`, now `"Sending…"` at `src/routes/SignUp.tsx:164`. It asserts nothing, no test reads
   it, and the file is outside `allowed_paths`. Stale, not wrong, and correcting it would have been
   a RULE-03 violation.
4. **The § Language lint rule is scoped `files: ["src/**"]`**, so nothing mechanical guards
   `tests/`, `scripts/` or `.claude/`. This ticket edited three assertions there and left three
   Vietnamese *correctly* — the judgement no mechanism makes. `01-plan.md` Open questions 2 routes it
   to `.ai/board/model-debt.md`; it is model work, not ticket work.
5. **`roleLabel` is still defined twice**, `src/routes/Home.tsx:29` and `src/routes/MemberList.tsx:22`,
   now returning the same two English strings. Weighed and rejected at PLAN (`01-plan.md` §8
   alternative 1) with a reason this review can confirm from the other side: the diff *was* scannable
   in one pass, and that is what made the `home-member-name` / `home-member-role` distinction
   checkable at all. The cost is real and recorded — the next ticket wanting to fold them must claim
   two files it otherwise has no reason to touch.
6. **`feat/OPS-001` contradicts `.ai/standards/git-conventions.md:36`.** Settled by the operator for
   `feat/BUG-001` on 2026-09-03 and explicitly not reopened. Named only because RULE-03's enforcement
   is doing unusually heavy lifting on this ticket — `scripts/check-allowed-paths.mjs:96-98` exits `0`
   on any non-`feat/` branch, so `feat/OPS-001` is the only name under which the guard on
   `src/lib/fixtures.ts` and `supabase/seed.sql` is live at all.
7. **`.ai/templates/review-report.md` is stale against ADR-022** — `next_state: QA` in its
   front-matter block, R7 labelled as the dependency check while its *R8 detail* section asks for
   per-invariant reasoning. Steward work, not ticket work. This report follows
   `.ai/01-operating-model.md:36` and `:127`.

## Verdict

**`PASS`.** R1 through R8 all pass, each citing a line. No finding, so no routing row applies and
`rework_count` stays `0`.

The ratchet turned: `copyDebt` went 12 → 5 at `ui-language.json:20-26`, the seven files it released
are now guarded by the § Language rule rather than exempt from it, and the exception it must never
release — `src/lib/fixtures.ts` and `supabase/seed.sql` — is still Vietnamese, still diacritic-bearing
and still outside `allowed_paths`.

## Changelog

- `2026-09-03T16:56:32+07:00` — R1 to R8 judged against the working tree in an isolated session, no
  channel to the Developer. `gate: PASS`, `next_state: DONE`. Raised by `tech-lead-review`.
