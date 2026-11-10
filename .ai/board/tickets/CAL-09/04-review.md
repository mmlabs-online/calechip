---
ticket: CAL-09
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-08T16:52:52+0700
inputs_read:
  - .ai/board/tickets/CAL-09/01-plan.md
  - .ai/board/tickets/CAL-09/03-impl-log.md
  - .ai/board/tickets/CAL-09/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/registry/invariants.md
  - .ai/standards/git-conventions.md
  - .ai/standards/testing-standards.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/review-report.md
  - git diff (src/lib/domain/types.ts, src/lib/data/index.ts, src/lib/data/supabase.ts, src/lib/data/mock.ts, tests/row-limits.test.ts, .ai/board/tickets/CAL-09/ticket.yaml)
  - tests/team-entries-paging.test.ts
  - src/lib/data/absence.ts
  - src/routes/YearView.tsx
  - supabase/db.sql
  - eslint.config.js
  - package.json
  - .claude/hooks/guard-allowed-paths.mjs
  - scripts/check-allowed-paths.mjs
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# CAL-09 — review report

**Isolated dispatch, RULE-13.** Fresh session, files only, no message channel. No Developer was
spoken to before this verdict and none will be.

**`next_state: DONE` and not the template's `QA`.** ADR-022 removed the QA stage; `QA` is not in the
state enum at `.ai/01-operating-model.md:70`, and `DONE` is what every 04-review.md written since
carries — `.ai/board/tickets/UIE-07/04-review.md:25`.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/CAL-09/ticket.yaml:45-50`; table below |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` (`.ai/standards/testing-standards.md:16`) exit 0 |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` (`.ai/standards/testing-standards.md:17`) exit 0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/lib/data/supabase.ts:10-11`, the only `@supabase/*` value import in `src/`; `eslint.config.js:60-78` |
| R5 | Every contract item in plan § 4 is implemented (RULE-04) | PASS | table below |
| R6 | Permission gating matches plan § 3 | PASS | `supabase/db.sql:804-808`; `src/lib/data/supabase.ts:1186-1193`; `src/lib/data/mock.ts:1232-1234` |
| R7 | No invariant violated — reasoned per ID (RULE-07) | PASS | table below |
| R8 | No dependency added without an ADR | PASS | `package.json:18-45` unmodified |

### R1 — the working tree against the six exact paths

`allowed_paths` is six exact paths, no globs (`ticket.yaml:45-50`). `git status --porcelain` reports
nine entries and every one resolves:

| Path | Resolved by |
|---|---|
| `src/lib/domain/types.ts` (M) | `ticket.yaml:45` |
| `src/lib/data/index.ts` (M) | `ticket.yaml:46` |
| `src/lib/data/supabase.ts` (M) | `ticket.yaml:47` |
| `src/lib/data/mock.ts` (M) | `ticket.yaml:48` |
| `tests/row-limits.test.ts` (M) | `ticket.yaml:49` |
| `tests/team-entries-paging.test.ts` (??) | `ticket.yaml:50` |
| `.ai/board/tickets/CAL-09/ticket.yaml` (M) | ticket folder, exempt — `.claude/hooks/guard-allowed-paths.mjs:207`, `scripts/check-allowed-paths.mjs:131` |
| `.ai/board/tickets/CAL-09/01-plan.md` (??) | same exemption |
| `.ai/board/tickets/CAL-09/03-impl-log.md` (??) | same exemption |

Nothing else is dirty. `node scripts/check-allowed-paths.mjs` is not the evidence here and was not
leaned on: it diffs `origin/main...HEAD` (`scripts/check-allowed-paths.mjs:123-127`) and the ticket
is uncommitted until `/ship` (ADR-006), so it has nothing to read at REVIEW. The working tree is what
was checked. `03-impl-log.md` says the same and does not overclaim it.

### R2, R3 — run in this session, not read from the log

Both commands were executed here rather than transcribed from `03-impl-log.md`'s verification table.

| Command | Exit |
|---|---|
| `pnpm exec tsc --noEmit` | 0 |
| `pnpm exec eslint .` | 0 |
| `pnpm exec vitest run` | 0 — 12 files, 202 tests, 0 failures |

The unit run is not an R-check and is recorded because R5 leans on two of its files. End-to-end was
not run and is not claimed: it is pinned to the mock by `playwright.config.ts:49-51` and carries
MD-021's six known harness failures (`.ai/standards/testing-standards.md:37-41`). AC-11 and AC-12 are
its criteria, and `03-impl-log.md` disclaims them rather than asserting them.

### R4 — the seam boundary

The two `@supabase/supabase-js` imports in the whole of `src/` are at
`src/lib/data/supabase.ts:10-11`, inside the seam. This ticket moved neither and added no third: the
only imports the diff touches are the constant lists at `src/lib/data/supabase.ts:49-57` and
`src/lib/data/mock.ts:40-47`, both from `../domain/types`. Every line added is inside `src/lib/data/`
or is a constant declaration in `src/lib/domain/types.ts`, which the seam already imported. No route
and no component is in the diff, so no caller reaches past the seam.
`eslint.config.js:60-78` bans `@supabase/*` outside `src/lib/data` and exits 0.

## R5 detail

One row per contract item in `01-plan.md` § 4 — the plan is the merged story and design (ADR-019), so
its contract is § 4 and not the template's "design section 1".

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `TEAM_ENTRY_PAGE_SIZE = 500`, with the plan's docblock | `src/lib/domain/types.ts:380` | Yes — value and docblock verbatim (`01-plan.md:296-309`) |
| § 4.1 `TEAM_ENTRY_MAX_PAGES = 8`, with the plan's docblock | `src/lib/domain/types.ts:394` | Yes — verbatim (`01-plan.md:311-323`) |
| § 4.1 `MONTH_ENTRY_LIMIT` keeps name and value, gains one paragraph | `src/lib/domain/types.ts:353-365` | Yes — still `= 1000` at `:365`; the paragraph names the six files that still cite it and calls the removal a chore |
| § 4.2 seam signature unchanged character for character | `src/lib/data/index.ts:512` | Yes — `listTeamEntriesOverlapping(range: DateRange): Promise<Entry[]>`, and the declaration is outside the diff hunk |
| § 4.2 the doc comment's replacement paragraph | `src/lib/data/index.ts:506-510` | Yes — verbatim against `01-plan.md:344-352` |
| § 4.3 the real assembly | `src/lib/data/supabase.ts:1174-1245` | Yes — transcribed from `01-plan.md:358-429`; offset is `assembled.length` at `:1183`, not `request * PAGE_SIZE` |
| § 4.3 AC-7, the null-count refusal | `src/lib/data/supabase.ts:1200-1205` | Yes — `count === null \|\| count === undefined` throws; completeness is never taken from `rows.length` |
| § 4.3 AC-6, the repeated-row refusal | `src/lib/data/supabase.ts:1215-1227` | Yes — `seen` set, throws on a second sighting of an `id` |
| § 4.3 AC-1/AC-5/AC-8, the one refusal site | `src/lib/data/supabase.ts:1237-1242` | Yes — `assembled.length !== matching` throws; the bound is the loop at `:1179` and exhausting it reaches this comparison, never a short return |
| § 4.4 the mock assembly | `src/lib/data/mock.ts:1229-1279` | Yes — same walk, same order, `matching` is the filtered array’s length at `:1242` |
| § 4.5 nothing added to the seam's surface | `src/lib/data/index.ts` diff is comment-only; `tests/seam-parity.test.ts` unedited and passing | Yes — no new function, type, field, or page parameter |
| § 7 AC-13 assertions | `tests/row-limits.test.ts:79-102` | Yes — three `it`s at `:83`, `:90`, `:99`, one per clause |
| § 7 the new test file | `tests/team-entries-paging.test.ts:143-228` | Yes — six tests, AC-1 `:144`, AC-2 `:154`, AC-3 `:179`, AC-4 `:183`, AC-9 `:192`, AC-10 `:210` |

**AC-14 is satisfied and it is what keeps the ticket out of XL.** The declaration at
`src/lib/data/index.ts:512` is unchanged, `tests/seam-parity.test.ts` was not edited and passes, and
no call site is in the diff — so the *"changes the signature of an existing seam function"* clause at
`.ai/01-operating-model.md:375` is not engaged.

**The boundary arithmetic was checked rather than taken from the plan.** An empty match takes
`assembled.length >= matching` as `0 >= 0` and returns `[]` (`supabase.ts:1229-1230`, AC-3). An exact
page takes `500 >= 500` and returns without throwing (AC-4) — which the old
`rows.length >= MONTH_ENTRY_LIMIT` assertion could not do, and which
`tests/team-entries-paging.test.ts:183-190` asserts against a range built to hold exactly one page.
Beyond `PAGE_SIZE × MAX_PAGES` the loop ends holding 4000 rows against a larger `matching` and the
comparison at `:1237` throws (AC-8), so the bound cannot return a short array.

**What is asserted nowhere is declared, not implied.** AC-5, AC-6 and AC-7 are unreachable in the
mock, AC-8's behaviour would cost a 4001-row fixture, and AC-11 and AC-12 are end-to-end. All five
are named in the test file's own header at `tests/team-entries-paging.test.ts:14-31` and in
`01-plan.md:492-495,584-588`. A green unit run proves the assembly is implemented; it does not prove it
repairs a truncation the mock cannot produce, and the file says so at `:29-31` rather than leaving a
reader to find it.

## R6 — permission gating

`01-plan.md` § 3 says no change is possible from here: authorization for this read lives in the
datastore (ADR-005), and paging is a window over a set the policy already filtered.

| Action from § 3 | `member` | `admin` | Held by |
|---|---|---|---|
| Read any entry in the team, via `listTeamEntriesOverlapping` | ✅ | ✅ | `supabase/db.sql:804-808` — `for select to authenticated`, no role predicate, unchanged and outside the diff |

Transcribed from `.ai/standards/rbac-and-security.md:31`, which is unmodified.

The denials, which are the half the table cannot be checked without:

- **Neither role may read another team's entries, on any page.** The query at
  `src/lib/data/supabase.ts:1186-1193` carries no team predicate before or after this ticket —
  `entry_select_team` is a row-level policy and applies per statement, so each of the eight possible
  requests is filtered identically. The mock's equivalent is at `src/lib/data/mock.ts:1232-1234`.
- **Neither role may ask for a partial answer.** The signature takes one `DateRange`
  (`src/lib/data/index.ts:512`); there is no page, offset or limit parameter a caller could reach,
  and the refusals at `supabase.ts:1200`, `:1215` and `:1237` are unconditional.
- **No interface-level gate is added or relied on.** No route or component is in the diff.

## R7 detail

**One row per ID in `invariants_touched` — `[INV-04, INV-07]` at `ticket.yaml:29`.**

| Invariant | Held by | Citation |
|---|---|---|
| **INV-04** — one definition of the absence count | The seam returns `Entry[]` and no total, so there is nowhere for a second definition to appear. `absenceCountsFor` remains the only one in the tree, and `src/lib/data/absence.ts` is not in the diff. Inside both assemblies the only arithmetic is the offset (`from`, `to`) and the completeness comparison, neither of which is an absence count. Critically, the rows are proved complete *before* any caller sums them: a short set throws rather than returning, so `absenceCountsFor` is handed the whole set or nothing | `src/lib/data/absence.ts:197` — the single definition, unmodified; `src/lib/data/supabase.ts:1237-1242` and `src/lib/data/mock.ts:1272-1277` — the refusal that precedes any count; `tests/team-entries-paging.test.ts:210-226` — one call over the complete array, total `502` and the cross-page shared day at `2`, which a first-page read would report as `500` and `undefined` |
| **INV-07** — one member, one team | Every request in the real walk is the same statement with a different window, so `entry_select_team` re-applies to each and `count: "exact"` counts policy-visible rows only; no offset can widen the set. The mock applies `sameTeam` to the whole array *before* the first window is taken, which is the same property from the other side — a window taken first would page over another team's rows and then drop them, which presents as a short page rather than as a scope error | `supabase/db.sql:804-808`; `src/lib/data/supabase.ts:1186-1193` — no team predicate added or removed; `src/lib/data/mock.ts:1232-1234` — filter before `:1246`'s loop; `tests/team-entries-paging.test.ts:204-207` — the other team's April row is absent and no returned row carries `FIXTURE_OTHER_TEAM_MEMBER.id` |

The five IDs outside the list were checked individually rather than dismissed as a group, because
`.ai/registry/invariants.md:63` warns that concluding an invariant is unengaged from the safety of the
chosen behaviour is circular:

- **INV-01** (overlap) — no write path is in the diff; the only entries created are in
  `tests/team-entries-paging.test.ts:112-115`, through `seam.createEntry`, which enforces it, and the
  fixture is consecutive single days for that reason (`:109-111`).
- **INV-02** (approval does not survive an edit) — no edit path in the diff.
- **INV-03** (rejected entries carry a reason) — the one rejection is
  `tests/team-entries-paging.test.ts:135` and it supplies a non-empty reason.
- **INV-05** (tentative still counts) — no `tentative` predicate is added or removed anywhere in the
  diff.
- **INV-06** (one portion per entry) — no entry value is constructed in the seam; both assemblies
  copy rows through `toEntry` / spread unchanged (`src/lib/data/supabase.ts:1244`,
  `src/lib/data/mock.ts:1279`).

**No invariant is held by a UI affordance here.** Both mechanisms are below the seam boundary: a
row-level policy in the datastore and a refusal inside the seam function.

## R8 — dependencies

`package.json` and `pnpm-lock.yaml` are both absent from `git status --porcelain`; the dependency and
devDependency blocks at `package.json:18-45` are unmodified. No import of any external package was
added — the diff's only new imports are `TEAM_ENTRY_PAGE_SIZE` and `TEAM_ENTRY_MAX_PAGES` from
`../domain/types` (`src/lib/data/supabase.ts:55-56`, `src/lib/data/mock.ts:45-46`), and
`MONTH_ENTRY_LIMIT` was dropped from both lists because its last reader here is gone. No ADR is owed.

## Findings

None. R1 to R8 all pass.

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | — | — | — |

## Findings outside the gate

Three, none of which is an R-check and none of which changes the verdict. Recorded here because a
reviewer noticing something true and saying it only in chat leaves no record.

1. **`gates.plan` is `{ passed: false, at: null }` at `ticket.yaml:70`, and this review cannot fix
   it.** The ticket reached IN_PROGRESS reading `state: BACKLOG` — the READY grading never ran, so
   Definition of Ready was never evaluated even though items 2 and 5 are both filled
   (`ticket.yaml:16,29`). `03-impl-log.md:121-126` names it and correctly declines to back-date it,
   and REVIEW writes only `04-review.md`, so it cannot either. **`/ship` requires both gates
   (`ticket.yaml:72`), so this has to be settled by the `orchestrator` before ship, not after.**
   It is not an R-check failure: R1 to R8 judge the implementation, and the implementation is sound.

2. **`.ai/templates/review-report.md` mis-numbers the invariant check as R8.** Its checklist agrees
   with `.ai/01-operating-model.md:123-134` — R7 invariants, R8 dependencies — but the section
   headed *R8 detail* asks for one row per `invariants_touched` ID, and the paragraph below it says
   *"R8 does not route to REWORK"* and cites RULE-07 (`.ai/templates/review-report.md:55-58,76-78`). Both
   describe R7. `.ai/registry/invariants.md:71-73` carries the same slip in its *In a review*
   paragraph. This report follows the operating model's numbering, which is authoritative and which
   `.claude/commands/review.md` also uses. It is a documentation defect for `/thuki`, and the risk is
   real rather than cosmetic: a reviewer following the template literally would escalate a missing-ADR
   dependency to a human and route an invariant violation into REWORK, which is RULE-07 inverted.

3. **Six files outside `allowed_paths` still name `MONTH_ENTRY_LIMIT` in comments that are now
   false** — `src/routes/YearView.tsx:173-175` describes the year view's `catch` as the
   possibly-truncated-answer branch, and `src/routes/WeekView.tsx` and the four
   `tests/e2e/cal-0*.spec.ts` headers carry the same. This is declared, not overlooked:
   `01-plan.md:96-101` scopes it out and `src/lib/domain/types.ts:352-364` records it on the constant
   itself, which is the right place for a later reader to find it. It is a chore and wants its own
   `ops/` branch.

## Verdict

**PASS.** R1 through R8 each pass with a `file:line` citation. `next_state: DONE`.

The substance, in one paragraph, because it is what the gate turned on: the ceiling this ticket
removes was a `rows.length >= MONTH_ENTRY_LIMIT` assertion that could not distinguish a full page
from a truncated one, and what replaces it compares an assembled set against the datastore's own
exact count — which detects a shortened window, a skipped row and an exhausted bound alike without
knowing the cap's value. The refusal is strictly stronger than the one it replaces, it is reached
before any caller sums a row, and no partial result can escape the seam. That last property is why
none of the four consuming surfaces needed a line: the boundary still has exactly two outcomes.
