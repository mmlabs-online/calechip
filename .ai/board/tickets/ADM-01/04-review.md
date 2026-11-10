---
ticket: ADM-01
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-05T00:36:57+07:00
inputs_read:
  - .ai/board/tickets/ADM-01/01-plan.md
  - .ai/board/tickets/ADM-01/03-impl-log.md
  - .ai/board/tickets/ADM-01/ticket.yaml
  - .ai/01-operating-model.md
  - .ai/registry/invariants.md
  - .ai/templates/review-report.md
  - .ai/standards/testing-standards.md
  - .ai/steward/context.md
  - scripts/check-allowed-paths.mjs
  - eslint.config.js
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/routes/Threshold.tsx
  - src/routes/Home.tsx
  - src/routes/AllowList.tsx
  - src/App.tsx
  - supabase/migrations/20260905000000_adm01_team_threshold.sql
  - tests/threshold.test.ts
  - tests/e2e/adm-01-threshold.spec.ts
  - git diff
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# ADM-01 — review report

Isolated dispatch, fresh session, files only. No Developer was spoken to and no message channel was
opened — `chat_before_verdict: none` is literally true.

`next_state` is `DONE` and not `QA`: ADR-022 removed the QA stage and the lifecycle at
`.ai/01-operating-model.md:36` reads `IN_PROGRESS -> REVIEW -> DONE`. The template still ships
`next_state: QA` and still heads its invariant section `R8`; the operating model's checklist at
`.ai/01-operating-model.md:125-133` is authoritative and numbers the invariant check `R7`, which is
the numbering used below. **There is no R9** — ADR-022 decision point 6 renumbered R8/R9 to R7/R8,
while `.claude/commands/review.md:3` and `:70` still read "R1 to R9" and "All nine pass". BUG-001's
metrics row already recorded that staleness; it is repeated here only so this artifact stands alone
(RULE-16), and it is not a finding against ADM-01.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | `.ai/board/tickets/ADM-01/ticket.yaml:110-118` — see R1 detail |
| R2 | typecheck exit 0 | PASS | `pnpm exec tsc --noEmit` → exit 0, no output |
| R3 | lint exit 0 | PASS | `pnpm exec eslint .` → exit 0, no output |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/Threshold.tsx:18`; `eslint.config.js:61-75` — see R4 detail |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | see R5 detail |
| R6 | Permission gating matches plan section 3 | PASS | `supabase/migrations/20260905000000_adm01_team_threshold.sql:43`, `:62-67` — see R6 detail |
| R7 | No invariant violated — reason through each ID in `invariants_touched` (RULE-07) | PASS | see R7 detail |
| R8 | No dependency added without an ADR | PASS | `git status --porcelain package.json pnpm-lock.yaml` → empty; `git diff --stat -- package.json pnpm-lock.yaml` → empty |

Tests are not an R-check since ADR-022 and were run anyway, on this tree in this session:
`pnpm exec vitest run` → exit 0, 4 files / **81 tests**; `pnpm exec playwright test` → exit 0,
**96 tests**, including the `seam-guard` project. Both figures reproduce `03-impl-log.md`'s
*Verification run* exactly. `tests/seam-parity.test.ts` passes **unedited** and does not appear in
the changed set, which is the property `01-plan.md` section 5 keeps it out of `allowed_paths` for.

## R1 detail

**Nothing is committed on this branch** — `git log --oneline origin/main..HEAD` is empty and
`git diff --name-only origin/main...HEAD` is empty, which is the state `CLAUDE.md` § Working
agreements requires until `/ship`. So `node scripts/check-allowed-paths.mjs` prints
`0 changed file(s)` and `PASS` against a diff that holds nothing; its verdict is vacuous at this
gate and R1 is judged below on the **working tree** instead. That script is the CI half of the same
control and will see these paths at `/ship`.

Twelve paths in the tree. **Three are this ticket's own artifacts and are exempt** — the ticket
folder, `scripts/check-allowed-paths.mjs:127`. `01-plan.md` and `ticket.yaml` arrived modified from
PLAN; `03-impl-log.md` is IN_PROGRESS's.

| Changed path | Glob it matches (`ticket.yaml:110-118`) | M / new |
|---|---|---|
| `supabase/migrations/20260905000000_adm01_team_threshold.sql` | `supabase/migrations/20260905000000_adm01_team_threshold.sql` | new |
| `src/lib/data/index.ts` | `src/lib/data/index.ts` | M |
| `src/lib/data/supabase.ts` | `src/lib/data/supabase.ts` | M |
| `src/lib/data/mock.ts` | `src/lib/data/mock.ts` | M |
| `src/routes/Threshold.tsx` | `src/routes/Threshold.tsx` | new |
| `src/routes/Home.tsx` | `src/routes/Home.tsx` | M |
| `src/App.tsx` | `src/App.tsx` | M |
| `tests/threshold.test.ts` | `tests/threshold.test.ts` | new |
| `tests/e2e/adm-01-threshold.spec.ts` | `tests/e2e/adm-01-threshold.spec.ts` | new |
| `.ai/board/tickets/ADM-01/01-plan.md` | exempt — ticket folder | M |
| `.ai/board/tickets/ADM-01/ticket.yaml` | exempt — ticket folder | M |
| `.ai/board/tickets/ADM-01/03-impl-log.md` | exempt — ticket folder | new |

Nine globs, nine source paths, one to one and none unused. The paths `01-plan.md` section 7 names as
deliberately absent are absent in fact: `tests/seam-parity.test.ts`, `src/lib/fixtures.ts`,
`src/lib/data/absence.ts`, `src/routes/MonthView.tsx`, `supabase/db.sql`, `playwright.config.ts`
and `.ai/registry/**` are all untouched.

## R4 detail

`src/routes/Threshold.tsx:18` imports `{ seam } from "@/lib/data"` and nothing else that reaches
data; the file's only other mention of an implementation is the comment at `:16-17` telling a later
reader not to import one. A grep for `@supabase`, `lib/data/supabase` and `lib/data/mock` across
`src/` outside `src/lib/data/` returns that comment and nothing else.

The rule that would have caught a crossing is `eslint.config.js:61-75` — `no-restricted-imports` on
`@supabase/*` for `src/**` with `src/lib/data/**` ignored — and R3 above ran it green. The migration
adds no second enforcement layer above the seam:
`supabase/migrations/20260905000000_adm01_team_threshold.sql:43` and `:62-67` are datastore-side,
which is where ADR-005 puts the control.

## R5 detail

One row per contract item in `01-plan.md` section 4.

| Contract item (`01-plan.md`) | Implemented at | Matches signature |
|---|---|---|
| §4.1 `SetOverloadThresholdInput`, one field, the FRACTION form | `src/lib/data/index.ts:95-102` | Yes — `overloadThreshold: number` and nothing else; no `teamId`, no `name` |
| §4.1 `setOverloadThreshold` on `DataSeam`, declared after `getTeam()` | `src/lib/data/index.ts:447`, with `getTeam()` at `:421` | Yes — `(input: SetOverloadThresholdInput): Promise<Result<Team>>` |
| §4.1 a separate function, not a write half of `getTeam()` | `src/lib/data/index.ts:421` unchanged in the diff, `:447` added beside it | Yes — the instruction at `:416-418` is obeyed |
| §4.1 no new domain type, no new `FailureCode` | `src/lib/domain/types.ts` absent from the changed set; `not_permitted` reused at `src/lib/data/supabase.ts:955` and `src/lib/data/mock.ts:1055` | Yes |
| §4.1 new messages in English | `src/lib/data/mock.ts:1055`, `:1058`; `src/lib/data/supabase.ts:955`; `src/routes/Threshold.tsx:33-34` | Yes — and `eslint.config.js`'s § Language rule ran green at R3 with `Threshold.tsx` off the `copyDebt` ratchet |
| §4.2 the datastore call, exactly | `src/lib/data/supabase.ts:943-947` | Yes — `.update({ overload_threshold })`, **no `.eq("id", …)`**, `.select(TEAM_COLUMNS)`, `.returns<TeamRow[]>()` |
| §4.2 zero rows back is a refusal, not a success | `src/lib/data/supabase.ts:951-958` | Yes — `(data ?? [])[0]`; an absent row returns `not_permitted` and never `ok: true` |
| §5 the mock refuses exactly as the policy does | `src/lib/data/mock.ts:1053-1055` | Yes — through the existing `currentAdmin()`, so `removedAt === null` and `role === "admin"` are inherited rather than rewritten |
| §5 the mock writes the caller's OWN team only | `src/lib/data/mock.ts:1057` | Yes — `teams.find((t) => t.id === memberTeamId(me.id))`, with `FIXTURE_OTHER_TEAM` asserted untouched at `tests/threshold.test.ts:129-139` |
| §5 a copy goes back, never the stored object | `src/lib/data/mock.ts:1061` | Yes — `{ ...row }`, asserted at `tests/threshold.test.ts:141-149` |
| §5 the conversion lives in the screen and nowhere in `src/lib/` | `src/routes/Threshold.tsx:21`, `:24` | Yes — `toPercent`/`toShare` are local to the route; no new module under `src/lib/` |
| §4.3 the four phases | `src/routes/Threshold.tsx:44-48`, and `:146`, `:158`, `:179`, `:203` | Yes — `loading`, `refused`, `unavailable`, `ready` |
| §4.3 every selector in the table | `Threshold.tsx:148`, `:160`, `:181`, `:218`, `:234`, `:248`, `:254`, `:260`, `:266`, `:276` | Yes — see the two selector notes below |
| §4.3 `threshold-current` carries `data-threshold` as the FRACTION | `src/routes/Threshold.tsx:218` | Yes — `data-threshold={team.overloadThreshold}`, asserted at `tests/e2e/adm-01-threshold.spec.ts:72-81` |
| §4.3 validation happens before the call | `src/routes/Threshold.tsx:106-116` | Yes — both refusals `return` above the seam call at `:125` |
| §4.3 the link on the landing screen, under `member.role === "admin"` | `src/routes/Home.tsx:156-161` | Yes — `home-threshold-link`, beside `home-allow-list-link` (`:75`) and `home-team-entries-link` (`:93`) |
| §4.3 the route, guarded on `membership.state === "member"` | `src/App.tsx:212-215` | Yes — a member reaches the component and is refused by it; everyone else is sent to `/` |
| §6 the column grant | `supabase/migrations/20260905000000_adm01_team_threshold.sql:43` | Yes — `grant update (overload_threshold) on public.team to authenticated`, character for character |
| §6 the policy | `…_adm01_team_threshold.sql:62-67` | Yes — `for update to authenticated`, `using` and `with check` identical, `(select auth.uid())`, both helpers |
| §6 no trigger, no `check` constraint, no select half | the file holds exactly two statements — `:43` and `:62-67` | Yes |

**Two selector observations, neither a finding.**

1. **`threshold-back` appears three times** — `Threshold.tsx:170`, `:193`, `:276` — where §4.3 lists
   it once, under `ready`. The two extra copies are on `refused` and `unavailable`, which §4.3 gives
   no way out of at all. Additive, declared at `03-impl-log.md` § *Testability contract*, and no
   selector or criterion is displaced by it.
2. **Inside `ready` the DOM order is input(4), `threshold-input-error`(5), `threshold-error`(8),
   `threshold-saved`(7), `threshold-save`(6), `threshold-back`(9)** — `Threshold.tsx:234`, `:248`,
   `:254`, `:260`, `:266`, `:276` — so the two notices sit above the save control where §4.3's Order
   column puts them below it. Checked rather than waved through, because it is undeclared: §4.3
   opens by naming `src/routes/AllowList.tsx` as the shape this screen takes, and that file puts
   `allow-list-add-error` (`AllowList.tsx:177`) above `allow-list-add-submit` (`:183`) — the same
   arrangement. Every element exists with the specified `data-testid`, the specified `role` and the
   specified *shown when*, and no acceptance criterion asserts sequence. It is a divergence from an
   enumeration of the contract, not from the contract.

**The one declared deviation is sound.** `03-impl-log.md` § *Deviations* removes `min`, `max`,
`step` and `required` from the number input (`src/routes/Threshold.tsx:225-243`). §4.3 names no
attributes, so this is a choice the design left open, and the reasoning is verifiable rather than
asserted: a native constraint suppresses submission, so `onSave` (`:97`) never runs and
`threshold-input-error` (`:248`) is never rendered — which is exactly what AC-7 and AC-8 require the
screen to do. `tests/e2e/adm-01-threshold.spec.ts:149-195` drives the refusal cases through that
selector and passes. Removing the attributes also keeps the range at `:107-116` and nowhere else,
rather than in a second copy able to disagree with the first.

**RULE-04 holds.** Every identifier in the diff appears in the contract before it appears in code:
`overloadThreshold` and `overload_threshold` in §4.1 and §4.2, `team_update_admin` in §6, and all
nine selectors in §4.3's table. `TEAM_COLUMNS`, `TeamRow`, `toTeam`, `toPostgrestFailure`,
`currentAdmin`, `memberTeamId` and `refused` all pre-exist. No field, no code and no criterion was
invented.

## R6 detail

`01-plan.md` section 3 has two rows and this ticket implements the second.

| §3 row | Enforced at | Verdict |
|---|---|---|
| `Read the overload threshold` — member ✅ admin ✅, **CAL-04's, not this ticket's** | `supabase/migrations/20260904100000_cal04_team_select.sql`, untouched. This ticket's migration contains no `grant select` and no `create policy team_select_own`; its only two statements are `…_adm01_team_threshold.sql:43` and `:62-67` | PASS — nothing here narrows or widens a member's read |
| `Set the overload threshold` — member ❌ admin ✅ | `…_adm01_team_threshold.sql:62-67`, `is_admin` in both `using` and `with check`, beside the column grant at `:43` | PASS |

The denials §3 states as denials, each checked:

- **A member may not write `overload_threshold`.** `is_admin((select auth.uid()))` at
  `…_adm01_team_threshold.sql:65` and `:67`. Reproduced above the datastore at
  `src/lib/data/mock.ts:1054-1055` and asserted at `tests/threshold.test.ts:73-82` — the seam called
  with a member as the caller, past every control the screen draws, which is what makes AC-5 a check
  on the policy rather than on the interface.
- **Nobody may write `team.name`, `team.id` or `team.created_at`.** The column list at
  `…_adm01_team_threshold.sql:43` is the control, not the policy — an `UPDATE` policy is row-level
  and admits every column of a row it admits. Above it, `SetOverloadThresholdInput`
  (`src/lib/data/index.ts:95-102`) carries no other field and `src/lib/data/supabase.ts:945` sends
  one key, so no other column can travel. `tests/threshold.test.ts:104-116` compares the whole
  returned row field by field rather than naming today's three.
- **Nobody may write another team's row.** `id = public.member_team_id((select auth.uid()))` at
  `…_adm01_team_threshold.sql:64` and `:66`; the mock's equivalent at `src/lib/data/mock.ts:1057`,
  with `FIXTURE_OTHER_TEAM` asserted untouched at `tests/threshold.test.ts:129-139`.
- **A removed member writes nothing, whatever their role.** Inherited from both helpers' own bodies
  rather than restated in the predicate — `…_adm01_team_threshold.sql:20-23` records why — and
  `currentAdmin()` reproduces the same filter. `tests/threshold.test.ts:93-102` covers a removed
  member; `:151-169` covers a removed **admin**, which is AC-14's "whatever role their row records".
- **A caller with no session reads nothing and writes nothing.** The policy is `to authenticated` at
  `…_adm01_team_threshold.sql:63`, never `to public`; `src/App.tsx:214` sends a caller with no
  member row to `/`; `tests/e2e/adm-01-threshold.spec.ts:137-147` asserts nothing is revealed.

**The affordance layer matches §3's own account of itself.** `src/routes/Threshold.tsx:69` and
`src/routes/Home.tsx:156` hide a control the policy would refuse anyway, and §3 says in terms that
this is an affordance and that AC-5 exists to prove removing it changes nothing.

**One reading recorded, not a defect.** `ready` is admin-only (`src/routes/Threshold.tsx:69`), so a
member never sees `threshold-current` on this screen; §4.3's explicit sentence puts a member in
`threshold-refused` and the "ready, admin" qualifier on rows 4 and 6 then holds trivially. §3's
member **read** permission is unaffected either way: it is CAL-04's policy, the member still
exercises it, and `src/routes/MonthView.tsx:341` still shows them the number. Nothing §3 grants a
member is withheld. `03-impl-log.md` Open question 1 raises the same reading and reaches the same
place.

## R7 detail

`invariants_touched: []` in `ticket.yaml`. An empty list is a claim, so every ID in the ledger is
reasoned through individually below rather than dismissed as a group.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 — no two entries of one member cover the same portion of a date | Untouched. Nothing in the diff creates, edits or reads an `entry` row; the overlap check is CAL-01's and none of its files is in the changed set. | `.ai/registry/invariants.md:33`; changed set at R1 detail |
| INV-02 — an approved entry returns to `pending` on a material edit | Untouched. `status` is neither read nor written anywhere in the diff. | `.ai/registry/invariants.md:34` |
| INV-03 — a rejected entry always carries a reason | Untouched. Nothing here rejects anything; approval is ADM-05's and no path in this ticket reaches it. | `.ai/registry/invariants.md:35` |
| INV-04 — one definition of the absence count, and no second copy anywhere | **Held, and this is the ID that had to be checked rather than asserted.** `src/lib/data/absence.ts` is unmodified and outside `allowed_paths`; neither seam implementation imports it; `src/routes/Threshold.tsx` counts nothing and compares nothing — its only arithmetic is `* 100` at `:21` and `/ 100` at `:24`, a representation conversion at the one edge §4.1 places it. A row that changes what a comparison *yields*, while computing no comparison, adds no second definition of the number. | `.ai/registry/invariants.md:36`, `:105`; `src/routes/Threshold.tsx:21`, `:24`; `tests/e2e/adm-01-threshold.spec.ts:209-224`, which asserts the effect through CAL-04's own screen and touches neither file |
| INV-05 — a tentative entry counts exactly as a non-tentative one | Untouched. `tentative` appears nowhere in the diff and no counting happens in it. | `.ai/registry/invariants.md:37` |
| INV-06 — one portion per entry, applied to every date in its range | Untouched. No portion is read or written. | `.ai/registry/invariants.md:38` |
| INV-07 — every entry belongs to one member and is counted against that member's team | Held. Nothing here reads, writes or creates a `member` row. `tests/threshold.test.ts:153` calls `removeMember` once as fixture setup, an existing TEA-04 path used as written, which creates nothing. The team scoping this ticket adds is on `team`, not on `entry`. | `.ai/registry/invariants.md:39`, `:163`; `…_adm01_team_threshold.sql:64`; `src/lib/data/mock.ts:1057` |

**The threshold itself is not an invariant, and the ledger says so.**
`.ai/registry/invariants.md:178` records **"The threshold is 50%"** under *Considered and rejected as
an invariant* — "configurable by an admin, therefore not an invariant" — so the field this ticket
makes writable is the one the register already declined to constrain. Making it writable is the
register's own expectation, not a breach of it.

**Nothing is held by a UI affordance alone.** Every refusal above has a datastore statement behind it
(`…_adm01_team_threshold.sql:43`, `:62-67`), and the screen-level range check at
`src/routes/Threshold.tsx:107-116` guards a product decision (`01-plan.md` Open question 2) that no
invariant covers.

## Findings

None. No check failed, so no row of the failure routing table is engaged and `rework_count` stays at
`0`.

Three things are true and are recorded above rather than raised as findings, because none of them is
ADM-01's to fix: `supabase/db.sql` §§ 9.1 and 9.2 are stale in the two ways `01-plan.md` Open
question 4 and `03-impl-log.md` Open question 5 already name, and ADR-026 gives that file to no
ticket; `.claude/commands/review.md` still says "R1 to R9" after ADR-022 renumbered the checks; and
the migration is unapplied, which is permanent here — RULE-09 makes applying it human, so
`team_update_admin` and the column grant are exercised by no test in this repository. What stands in
for that at this gate is `tests/threshold.test.ts`, which asserts the mock refuses everywhere the
policy refuses — the property that stops the acceptance suite passing against nothing.

## Verdict

**PASS.** `next_state: DONE`.

## Changelog

- `2026-09-05T00:36:57+07:00` — first review pass. Fresh session, no message channel; `git diff`
  read against `01-plan.md` and `03-impl-log.md`. R1 through R8 all PASS, each citing `file:line`.
  No findings. Raised by `tech-lead-review`.
