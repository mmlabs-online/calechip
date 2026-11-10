---
ticket: ADM-01
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-05T00:27:31+07:00
inputs_read:
  - .ai/board/tickets/ADM-01/01-plan.md
  - .ai/board/tickets/ADM-01/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/tech-stack.md
  - .ai/steward/context.md
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/AllowList.tsx
  - src/routes/TeamEntries.tsx
  - src/routes/MonthView.tsx
  - src/routes/Home.tsx
  - src/App.tsx
  - tests/seam-parity.test.ts
  - tests/e2e/seam.setup.ts
  - tests/e2e/cal-01-create-entry.spec.ts
  - tests/e2e/cal-03-admin-edit-entry.spec.ts
  - tests/e2e/cal-04-month-view.spec.ts
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260904100000_cal04_team_select.sql
  - ui-language.json
  - eslint.config.js
  - playwright.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# ADM-01 — implementation log

## Files touched

Nine files, three of them new. The list is `git status --porcelain` minus the two ticket artifacts
`01-plan.md` and `ticket.yaml`, which arrived already modified from PLAN and which this stage did
not open.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260905000000_adm01_team_threshold.sql` | created | The column-level update grant and `team_update_admin`. Without both, `overload_threshold` is unwritable by anybody — TEA-01 revoked all on `public.team`. | §6, and §4.1's "the policy is the control" |
| `src/lib/data/index.ts` | modified | Declares `SetOverloadThresholdInput` and the one new seam function. RULE-04: nothing below may exist before it is declared here. | §4.1 |
| `src/lib/data/supabase.ts` | modified | The real implementation: the update with no `.eq`, `.select(TEAM_COLUMNS)`, and zero-rows-is-a-refusal. | §4.2 |
| `src/lib/data/mock.ts` | modified | The in-memory implementation, without which `tests/seam-parity.test.ts` fails and the whole acceptance suite (pinned to this seam) has nothing to drive. | §5 |
| `src/routes/Threshold.tsx` | created | The screen: four phases, the percent↔share conversion, and the range validation that runs before any write. | §4.3 |
| `src/routes/Home.tsx` | modified | One admin-only link, `home-threshold-link`. Without it the screen is reachable only by typing its address. | §4.3, AC-10 |
| `src/App.tsx` | modified | The `/threshold` route, guarded on `membership.state === "member"` so a member reaches the component and is refused by it. | §4.3 |
| `tests/threshold.test.ts` | created | The refusals the acceptance suite cannot reach — AC-5, AC-9 and AC-14 call the seam with a chosen caller. | §7 |
| `tests/e2e/adm-01-threshold.spec.ts` | created | The criteria a person can see: AC-1 to AC-4, AC-6 to AC-8, AC-10 to AC-13. | §2, §4.3 |

**Not touched, and each was checked rather than assumed:** `tests/seam-parity.test.ts` passes
unedited with the function added (§5 — this is the property that makes it worth having);
`src/lib/domain/types.ts` (no new domain type and no new `FailureCode`); `src/lib/fixtures.ts`
(`FIXTURE_TEAM.overloadThreshold` is already `0.5`); `src/lib/data/absence.ts` and
`src/routes/MonthView.tsx` (AC-13 passes against the screen CAL-04 shipped, with no edit — had it
needed one, AC-13 would have been describing a CAL-04 defect); `supabase/db.sql`;
`playwright.config.ts`; `.ai/registry/**`.

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 `SetOverloadThresholdInput` | `src/lib/data/index.ts:95` | One field, the FRACTION form, transcribed with the doc comment the design wrote. No `teamId`. |
| §4.1 `setOverloadThreshold` on `DataSeam` | `src/lib/data/index.ts:447` | Declared immediately after `getTeam()`, which is where §4.1 puts it, and as a separate function rather than the write half `getTeam`'s own comment forbids. |
| §4.2 the datastore call, exactly | `src/lib/data/supabase.ts:942` | `.update({ overload_threshold })`, no `.eq("id", …)`, `.select(TEAM_COLUMNS)`, `.returns<TeamRow[]>()`. Zero rows → `not_permitted`. |
| §5 the mock refuses exactly as the policy does | `src/lib/data/mock.ts:1053` | Through the existing `currentAdmin()` helper, so AC-14's removal filter is inherited rather than written twice. Writes the caller's own team only, via `memberTeamId`. Returns a copy. |
| §4.3 the screen | `src/routes/Threshold.tsx` | Four phases, all nine selectors, validation before the call, `data-threshold` carrying the fraction. |
| §4.3 the link on the landing screen | `src/routes/Home.tsx:158` | `home-threshold-link`, under `member.role === "admin"`, beside the other two admin links. |
| §4.3 the route | `src/App.tsx:213` | Guarded on `membership.state === "member"`, matching `/entries/team`. |
| §6 the grant | `…20260905000000_adm01_team_threshold.sql:43` | `grant update (overload_threshold) on public.team to authenticated`. |
| §6 the policy | `…20260905000000_adm01_team_threshold.sql:62` | `team_update_admin`, `for update to authenticated`, `using` and `with check` identical, `(select auth.uid())`. No trigger, no `check` constraint. |

**RULE-04 holds.** No field name in the code that did not appear in the contract first:
`overloadThreshold` and `overload_threshold` are both in §4.1 and §4.2, `TEAM_COLUMNS`, `TeamRow`,
`toTeam`, `currentAdmin`, `memberTeamId` and `refused` all pre-exist, and no `FailureCode` was added.

## Deviations from the design

**One, and it is a subtraction from the input element rather than from the design's behaviour.**

**The number input carries no `min`, `max`, `step` or `required`.** §4.3 says "number input,
labelled, pre-filled with the current whole percent" and does not name attributes, so this is a
choice the design left open — but it is written up here because the obvious reading of "bounded
input" is the one that breaks two criteria, and it broke them in this run before it was corrected.

A native constraint does not add a second check beside the JavaScript one. It **suppresses form
submission entirely**, so `onSave` never runs, `threshold-input-error` is never rendered, and the
only thing that says anything is a browser tooltip that names no percentage and that no selector in
§4.3 can reach. Measured, not reasoned: with `min={0} max={100} step={1}` present, the AC-7 and AC-8
acceptance tests failed with `threshold-input-error` **element(s) not found**. §4.3 is explicit that
"validation happens before the call, not after it… it renders `threshold-input-error` and returns",
so the attributes contradicted the section that named them. They also put the range `0`–`100` in a
second language, able to disagree with the constants above it. The range now lives in `onSave` and
nowhere else. `src/routes/Threshold.tsx:225-232` carries the reason at the element.

Nothing else. The permission model, the contract, the seam shape, the migration statements, the four
phases, all nine selectors and `allowed_paths` are as §1 through §7 specified.

## Invariants

`invariants_touched: []`, and §2 states the reasoning rather than leaving the empty list to read as
an oversight. Reproduced here with what the implementation did about it, because "no invariant is
touched" is a claim about code and not only about a plan:

| ID | Still holds because |
|----|---------------------|
| — (none listed) | Setting the threshold changes what is *called* overloaded and touches no entry. `.ai/registry/invariants.md:178` records "The threshold is 50%" under *Considered and rejected as an invariant* — configurable, therefore not an invariant — so the field this ticket makes writable is the one the register already declined to constrain. |
| `INV-04` (deliberately absent) | **No arithmetic was added anywhere.** `absenceCountsFor` in `src/lib/data/absence.ts` remains INV-04's single implementation; neither seam implementation imports it, neither counts anything, and `src/routes/Threshold.tsx` performs no comparison — its only arithmetic is `× 100` and `÷ 100` between the share and the percent, at the one edge §4.1 and §5 place it. AC-13 asserts that CAL-04's comparison changes its answer and reaches it through the browser, touching neither file. |
| `INV-07` | Untouched. Nothing here reads, writes or creates a `member` row. `tests/threshold.test.ts` calls `removeMember` once as fixture setup for AC-14, which is an existing TEA-04 path used as written. |

## Verification run

Commands actually executed, in this session, on this tree. The four invocations are the ones named
in `.ai/standards/testing-standards.md`.

**`node_modules/` was absent and `pnpm install --frozen-lockfile` was run first**, along with
`pnpm exec playwright install chromium`. Neither changed a tracked file — `pnpm-lock.yaml` is
unmodified in `git status` — and both are recorded because a reviewer re-running these commands on a
clean checkout will need them.

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | Includes the § Language rule. `src/routes/Threshold.tsx` and `tests/**` are not on the `copyDebt` ratchet, so every string in them is English; the two seam messages added to `mock.ts` and `supabase.ts` are English too, per §4.1 — the ratchet only shrinks and this ticket adds nothing to it. |
| `pnpm exec vitest run` | 0 | 4 files, **81 tests**, all pass. Measured before and after by moving the new file aside: **3 files / 71** without it, 4 / 81 with it. `tests/seam-parity.test.ts` gains no test and covers the new function automatically, because it iterates the seam's keys. |
| `pnpm exec playwright test` | 0 | **96 pass**, 0 fail, including the `seam-guard` project. Measured the same way: **84** without `tests/e2e/adm-01-threshold.spec.ts`, 96 with its 12. |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS for ADM-01. |
| `git diff --name-only` subset of `allowed_paths` | yes | Nine files, plus `01-plan.md` and `ticket.yaml`, which arrived modified from PLAN and were not opened here. |

## Testability contract

Every selector from design section 4.3, and where it now exists.

| selector | Exists at |
|----------|-----------|
| `threshold-loading` | `src/routes/Threshold.tsx:148` |
| `threshold-refused` | `src/routes/Threshold.tsx:160` |
| `threshold-unavailable` | `src/routes/Threshold.tsx:181` |
| `threshold-current` (carries `data-threshold`, the FRACTION) | `src/routes/Threshold.tsx:218` |
| `threshold-input` | `src/routes/Threshold.tsx:234` |
| `threshold-input-error` (`role="alert"`) | `src/routes/Threshold.tsx:248` |
| `threshold-error` (`role="alert"`) | `src/routes/Threshold.tsx:254` |
| `threshold-saved` (`role="status"`) | `src/routes/Threshold.tsx:260` |
| `threshold-save` | `src/routes/Threshold.tsx:266` |
| `threshold-back` | `src/routes/Threshold.tsx:170`, `:193`, `:276` — one per terminal phase, so every state has a way out. §4.3 lists it once under `ready`; the two extra copies are on `refused` and `unavailable`, which would otherwise be dead ends. |
| `home-threshold-link` | `src/routes/Home.tsx:158` |

**Read, never written:** `month-threshold` (`src/routes/MonthView.tsx:341`, CAL-04's) is the selector
AC-13 asserts against. `seam-banner`, `app-root`, `sign-in-*`, `home-*`, `new-entry-*`,
`own-entry-row` and `week-month` are used unchanged by the acceptance suite.

**No selector was renamed and none was added beyond the table** except the two extra
`threshold-back` copies noted above.

## Open questions

1. **`ready` is admin-only, and §4.3's table can be read two ways.** Its `threshold-refused` row says
   the notice is shown when "the caller is a member, has no member row, or has no session (AC-4,
   AC-6)" — a member therefore never reaches `ready`. Rows 4 and 6 of the same table qualify the
   input and the save control with "ready, **admin**", which only carries information if a member
   *can* be `ready` and see the value without the controls. The explicit sentence was followed and
   the qualifier now holds trivially; nothing in the table is violated either way, because it says
   when an element *is* shown and a member is in no phase that shows one. Recorded because the two
   readings differ in one visible respect: whether a member may read the threshold on this screen.
   The permission table in §3 does grant members `Read the overload threshold` — via CAL-04's
   `team_select_own` — and they exercise it on the month view, which already shows them the number
   (`month-threshold`). So nothing is withheld from a member by this choice; they just read it where
   CAL-04 put it. `src/routes/Threshold.tsx:40-43` carries this.

2. **AC-8's third case — "text that is not a number" — is enforced by the browser, not by
   `onSave`.** A `type="number"` input holds an empty string for unparseable text, so that case
   arrives at the same branch as "they clear the input", which is asserted. It cannot be driven
   separately from Playwright either: `fill()` on a number input rejects a non-numeric value before
   the page sees it. The empty and the fractional cases are both asserted directly, and
   `WHOLE_NUMBER` is a string pattern rather than `Number.isInteger(Number(v))` precisely so that
   `""` and `" "` — which `Number()` maps to `0` — cannot save a threshold nobody typed.

3. **AC-9's datastore half is unexercised, as §1's Changelog already says.** The column grant is what
   refuses a write to `team.name`, and no test in this project reaches PostgreSQL — applying the
   migration is human (RULE-09). What is asserted is the observable half: `tests/threshold.test.ts`
   compares the whole returned row field by field against the row read before the save, so a future
   field on `Team` cannot slip past an assertion that names only today's three.

4. **`tests/threshold.test.ts`'s last test mutates shared mock state and must stay last.** Reaching a
   caller who is both removed and `role: "admin"` — AC-14's "whatever role their row records" —
   needs `removeMember` against `FIXTURE_SECOND_ADMIN`, because no removed-admin fixture exists and
   `src/lib/fixtures.ts` is not in `allowed_paths`. The mock offers no way to undo a removal, so
   that row stays removed for the rest of the file. Nothing follows it, and the mock's module state
   is per test file. The ordering dependence is written at the test.

5. **`supabase/db.sql` § 9.1 and § 9.2 are now stale in a second way**, extending §1's Open question
   4 rather than adding to it: § 9.2 describes ADM-01's gap and says the ticket is blocked, which
   this implementation makes wrong on both halves. ADR-026 assigns no ticket the job of keeping that
   file current and it is deliberately out of `allowed_paths`, so it is named here rather than
   fixed.
