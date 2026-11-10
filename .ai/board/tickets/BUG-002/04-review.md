---
ticket: BUG-002
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-08T11:42:17+07:00
inputs_read:
  - .ai/board/tickets/BUG-002/01-plan.md
  - .ai/board/tickets/BUG-002/03-impl-log.md
  - .ai/board/tickets/BUG-002/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/registry/rules.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-022-the-qa-stage-is-removed.md
  - .ai/templates/review-report.md
  - src/lib/domain/types.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/data/absence.ts
  - tests/row-limits.test.ts
  - eslint.config.js
  - package.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# BUG-002 — review

Isolated dispatch, fresh session, files only. No message channel to the Developer existed and none was
used; `chat_before_verdict: none` is truthful.

**`next_state` is `DONE`, not the template's `QA`.** ADR-022 removed the QA stage and its line 47
carries the surviving path — `... IN_PROGRESS -> REVIEW -> DONE`. `.ai/templates/review-report.md:30`
still ships `QA` in its front-matter block; that is a stale template line, and the registry decision is
the authority. `/ship` is the command that writes `DONE`, not this artifact.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | **PASS** | `.ai/board/tickets/BUG-002/ticket.yaml:67-70` |
| R2 | typecheck exit 0 | **PASS** | `pnpm exec tsc --noEmit` → exit 0 (`package.json:10`) |
| R3 | lint exit 0 | **PASS** | `pnpm exec eslint .` → exit 0 (`package.json:11`) |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | **PASS** | `src/lib/domain/types.ts:1-6`; `eslint.config.js:64-71` |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | **PASS** | table below, every row cited |
| R6 | Permission gating matches plan section 3 | **PASS** | `supabase/db.sql:804-805`, unmodified; `src/lib/domain/types.ts:184` |
| R7 | No invariant violated — reason through each ID in `invariants_touched` (RULE-07) | **PASS** | `src/lib/data/absence.ts:197`, unmodified |
| R8 | No dependency added without an ADR | **PASS** | `package.json:19-46`, unmodified |

Numbering is `.ai/01-operating-model.md:127-134`. **The template's *R8 detail* heading is mislabelled**
— `.ai/templates/review-report.md:55-57` puts the per-invariant reasoning under R8 and its line 76 says
"R8 does not route to REWORK … RULE-07", but the operating model's checklist and its routing table both
put invariants at **R7** (`:133`, `:147`) and dependencies at R8 (`:134`). This report follows the
operating model. The template defect is the steward's, not this ticket's.

### R1 — the diff against `allowed_paths`

`allowed_paths` is `.ai/board/tickets/BUG-002/**`, `src/lib/domain/types.ts`, `tests/row-limits.test.ts`
(`.ai/board/tickets/BUG-002/ticket.yaml:67-70`).

| Path | Tracked state | Inside which entry |
|---|---|---|
| `src/lib/domain/types.ts` | modified | `ticket.yaml:69` |
| `tests/row-limits.test.ts` | added | `ticket.yaml:70` |
| `.ai/board/tickets/BUG-002/ticket.yaml` | modified | `ticket.yaml:68` |
| `.ai/board/tickets/BUG-002/01-plan.md` | added | `ticket.yaml:68` |
| `.ai/board/tickets/BUG-002/03-impl-log.md` | added | `ticket.yaml:68` |

Five paths, no sixth. Nothing under `src/lib/data/`, nothing under `src/routes/`, nothing under
`tests/e2e/`, nothing under `supabase/`, no configuration file. AC-9 holds — exactly one source file
modified and exactly one test file added — and AC-8 holds, since no parent ticket's folder appears.

### R4 — the seam

`src/lib/domain/types.ts` imports nothing at all; its own header at `:1-3` states the reason — the
types live outside `src/lib/data/` precisely so a component can hold one without tripping RULE-02. The
added `DATASTORE_MAX_ROWS` at `:184` is a number and adds no import. `tests/row-limits.test.ts:23-32`
imports `vitest` and `@/lib/domain/types` and nothing else — it reaches no datastore, real or mock.

The rule's enforcement is `eslint.config.js:64-71`, a `no-restricted-imports` entry confining
`@supabase/supabase-js` to `src/lib/data/`; R3 ran it at exit 0. Independently, `@supabase/supabase-js`
is imported nowhere outside `src/lib/data/` in the tree.

### R6 — permission gating

Plan § 3 declares that nothing changes and that no read becomes narrower or wider. The diff contains no
role check, no policy, no route guard and no auth call. `entry_select_team`, the row-level select policy
§ 3 names as the control for both affected reads, is at `supabase/db.sql:804-805` and `supabase/` is
untouched by this diff. The only exported addition is an integer at `src/lib/domain/types.ts:184`.

§ 3's own caveat — that this ticket makes a screen fail where it used to succeed — is a change in
completeness, not in entitlement: the caller was always permitted those rows and the datastore was
always declining to send all of them. Nothing in `.ai/standards/rbac-and-security.md` is engaged.

## R5 detail

Contract is `01-plan.md` § 4 (ADR-019 merged the two documents; there is no `02-design.md` for this
ticket, and `03-impl-log.md:46-48` maps to § 4 for the same reason).

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.2 — `DATASTORE_MAX_ROWS`, defined once, beside the ceilings, citing its source | `src/lib/domain/types.ts:184`, doc comment `:153-183` | Yes. `export const DATASTORE_MAX_ROWS = 1000`. Placed above `ROSTER_LIMIT` (`:206`), the first ceiling. Cited by package name and the `select()` remark, **with no line number**, which is § 4.2's explicit instruction |
| § 4.2 — `TEAM_ENTRY_LIMIT` 2000 → **1000** | `src/lib/domain/types.ts:293` | Yes. Value only; name, export and type unchanged |
| § 4.2 — `MONTH_ENTRY_LIMIT` 2000 → **1000** | `src/lib/domain/types.ts:353` | Yes. Value only |
| § 4.2 — `HOLIDAY_LIMIT` unchanged at 1000 | `src/lib/domain/types.ts:436` | Yes. Value untouched; the diff at this hunk edits prose only |
| § 4.2 — `ROSTER_LIMIT`, `OWN_ENTRY_LIMIT` unchanged at 500 | `:206`, `:262` | Yes. Values untouched |
| § 4.2 — the five `TODO(verify)` markers discharged | `src/lib/domain/types.ts` | Yes. `grep -n "TODO(verify)"` returns one hit, `:551`, inside `PENDING_PAGE_SIZE`'s prose, which *names* the markers historically rather than carrying one |
| § 4.3 — `tests/row-limits.test.ts`, new, `<=` and not `<` | `tests/row-limits.test.ts:46-51`; the comparison at `:49` | Yes. `toBeLessThanOrEqual(DATASTORE_MAX_ROWS)` over the five ceilings at `:37-43`, each named in its own title so a failure says which |
| § 4.4 — no seam implementation edited, and the four assertion sites repaired unopened | `supabase.ts:1033`/`:1044`, `:1168`/`:1181`; `mock.ts:1123`/`:1128`, `:1227`/`:1232` | Yes, and **verified rather than accepted**: all four sites read `.limit(LIMIT)` then `if (rows.length >= LIMIT)`, so lowering the constant to the cap makes each comparison reachable without an edit. Neither file appears in the diff |
| § 5 — seam impact `none` | `src/lib/data/` absent from `git diff --name-only` | Yes. No function added, removed, renamed, or changed in signature or return type. `tests/seam-parity.test.ts` passes unedited (AC-7) |
| § 6 — schema delta `none` | `supabase/` absent from the diff | Yes. `requires_adr: false` holds: § 1 item 2 and § 8 item 3 record that fix shape (b), the only shape that would flip it, was refused |
| § 7 — `allowed_paths`, two files outside the ticket folder | `ticket.yaml:67-70` | Yes. See R1 |

**Three additions the plan's § 4.3 code block does not show, all declared at `03-impl-log.md:60-65`,
all inside `tests/row-limits.test.ts`, none a contract deviation.**

1. `:56-58` pins `DATASTORE_MAX_ROWS` to 1000. AC-2 requires the maximum to be *a named value citing
   where the figure comes from*; a name alone is satisfied by any integer, so the assertion is what
   makes a future edit fail beside the comment carrying its source. It strengthens AC-2 rather than
   restating AC-1.
2. `:63-65` asserts `PENDING_PAGE_SIZE < DATASTORE_MAX_ROWS`, strictly and separately. § 1 item 8 puts
   `PENDING_PAGE_SIZE` out of scope *as something to fix*; this changes it not at all (`:556`, still
   50) and keeps it out of `CEILINGS` (`:37-43`) so the ceiling rule cannot quietly be borrowed by a
   window. Additive, test-only, inside `allowed_paths`.
3. Test titles carry `AC-1:` / `AC-2:` prefixes the plan's block does not show. Cosmetic.

**AC-3 — "fails today, passes after" — is verifiable from the diff and not only from the impl log's
account.** The `-` lines at `types.ts` show `TEAM_ENTRY_LIMIT = 2000` and `MONTH_ENTRY_LIMIT = 2000`;
`expect(2000).toBeLessThanOrEqual(1000)` fails, and it fails at those two names and no others, since
`ROSTER_LIMIT` and `OWN_ENTRY_LIMIT` were 500 and `HOLIDAY_LIMIT` was already 1000. The claim is
structural, not a report of a run this reviewer cannot see.

**The three comment-only deviations at `03-impl-log.md:69-92` are correct and are not the out-of-scope
edit § 1 item 1 forbids.** Each removes a sentence the fix falsified — "must sit BELOW the cap" became
false when two ceilings landed *at* 1000 and directly contradicted § 4.3's `<=`; `PENDING_PAGE_SIZE`'s
comment at `:549-554` asked for the BUG row that this ticket is. They go the opposite way from
rewriting a criterion to match today's behaviour: they delete claims the change made untrue rather than
editing a claim the code fails.

**AC-10 — the whole suite passes, with no edit to any existing test.** `pnpm exec vitest run` → exit 0,
11 files, 193 tests. `pnpm exec playwright test` → exit 0, 165 passed. `git status --porcelain` shows
one added test file and no modified one.

## R7 detail

**One row per ID in `invariants_touched`.** `ticket.yaml:26` carries `[INV-04]`.

| Invariant | Held by | Citation |
|---|---|---|
| **INV-04** — the absence count for a date is the sum, over that date's pending and approved entries whose member was still on the team on that date, of 1 per `full` and 0.5 per `am`/`pm`, PTO and WFH alike; **no second definition of this number exists anywhere in the system** | Both halves hold, and the change moves the invariant's *inputs* toward it rather than away. **No second definition:** `absenceCountsFor` is defined once, at `src/lib/data/absence.ts:197`, and that file is absent from `git diff --name-only` — untouched, as § 1 item 10 requires. No arithmetic is added anywhere in the diff: `types.ts` gains one integer constant and `row-limits.test.ts` performs two comparisons over constants. Its callers (`src/components/OverloadWarning.tsx:193`, and the seam comments at `mock.ts:1141`/`:1210` and `index.ts:420`/`:440`) all still route through that one function and none is in the diff. **The sum itself:** the portion arithmetic and the removed-member condition are in that untouched function; nothing in this change reaches them. **Why it is listed at all** — `01-plan.md` § 2 states the mechanism as the *input*, not the definition, and that reading survives the diff: before this change `listTeamEntriesOverlapping` asked for 2000, received at most 1000, reported success, and `absenceCountsFor` summed an arbitrary subset — a number INV-04 does not define and nothing distinguished from one it does. After it, `MONTH_ENTRY_LIMIT` is 1000 (`types.ts:353`), the ceiling is reachable, and `rows.length >= MONTH_ENTRY_LIMIT` at `supabase.ts:1181` and `mock.ts:1232` raises instead of returning short. The single definition is now fed a complete set or nothing | `src/lib/data/absence.ts:197`; `src/lib/domain/types.ts:353`; `src/lib/data/supabase.ts:1181`; `src/lib/data/mock.ts:1232` |

INV-01, INV-02, INV-03, INV-05, INV-06 and INV-07 are not in `invariants_touched` and the diff is
consistent with that: it writes nothing to the datastore, adds no read, and changes no comparison the
database performs. `supabase/db.sql` is not in the diff.

**No invariant is violated. RULE-07 does not engage and there is no escalation.**

## R8 detail — dependencies

`package.json` and `pnpm-lock.yaml` are both absent from `git diff --name-only`. No dependency is
added, removed or bumped, so no ADR is owed. The one external fact the change rests on —
`@supabase/postgrest-js`'s documented 1000-row default — is *cited*, at `src/lib/domain/types.ts:160-162`,
from a package already in the tree at `package.json:19`.

## Findings

| # | Check | Finding | Routes to | Increments rework_count |
|---|---|---|---|---|
| — | — | None. R1 through R8 pass. | — | — |

## Verdict

**`PASS`.**

All eight checks pass with a `file:line` citation each. The fix is two integers, one new named constant
and one new test file; it opens neither seam implementation, and § 4.4's claim that lowering the
constant repairs four assertion sites unopened was verified at all four sites rather than accepted from
the log. Every deviation from the plan is declared in `03-impl-log.md`, each is comment-only or
test-only, and each strengthens a criterion rather than relaxing one.

**Two things the operator should know, neither of which is a finding against this implementation and
neither of which belongs to the Developer.**

1. **`03-impl-log.md:139-150` records that `ticket.yaml`'s `gates.plan` row was set at IN_PROGRESS, on
   the operator's explicit instruction, because PLAN passed (`01-plan.md` front-matter `gate: PASS`)
   without writing its own mirror — and that the ticket went `BACKLOG` → `REVIEW` without ever carrying
   `READY` or `IN_PROGRESS` on disk.** Both files are inside `allowed_paths`, so R1 is unaffected, and
   no R-check covers board bookkeeping. Whether PLAN failing to mirror its gate is a one-off or a gap
   in the command is the steward's question, as the log says.
2. **`src/lib/data/supabase.ts:1417-1419` now carries a sentence made stale by this fix** — it
   describes the cap as an unknown the five `TODO(verify)` markers were waiting for. The file is
   outside `allowed_paths` and the Developer correctly did not touch it (RULE-03). It is a comment, it
   misleads no code, and it wants one line from whichever ticket next opens that file.

## Changelog

- `2026-09-08T11:42:17+07:00` — review written. R1-R8 all PASS, no findings, `next_state: DONE`. Raised
  by `tech-lead-review`.
