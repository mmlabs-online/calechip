---
ticket: ADM-04
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-05T18:16:29+07:00
inputs_read: [ .ai/board/tickets/ADM-04/01-plan.md, .ai/board/tickets/ADM-04/03-impl-log.md ]
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
---

# ADM-04 — review report

Isolated dispatch, files only. No channel to the Developer existed and none was used. **Every command
in the tables below was run in this session**; nothing is quoted from `03-impl-log.md`.

**`next_state` is `DONE` and not `QA`.** ADR-022 removed the QA stage and its enum value; the
lifecycle is `… IN_PROGRESS -> REVIEW -> DONE`. `.ai/templates/review-report.md:30` still carries
`next_state: QA` — recorded by `.ai/board/tickets/CAL-08/04-review.md:172-180` and not re-reported
here.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | `git diff --name-only` is a subset of `allowed_paths` (RULE-03) | PASS | nine code paths, each a glob at `.ai/board/tickets/ADM-04/ticket.yaml:55-65`; `node scripts/check-allowed-paths.mjs` exit 0 |
| R2 | typecheck exit 0 | PASS | `node node_modules/typescript/bin/tsc --noEmit` exit 0 |
| R3 | lint exit 0 | PASS | `node node_modules/eslint/bin/eslint.js .` exit 0, under Node 22.11.0 |
| R4 | Nothing outside the data-access seam reaches the datastore directly (RULE-02) | PASS | `src/routes/PendingEntries.tsx:40` imports `@/lib/data` and nothing else; `eslint.config.js:64-70`'s `no-restricted-imports` passes over the whole tree |
| R5 | Every contract item in plan section 4 is implemented (RULE-04) | PASS | table below, and the § 4.4 row is the one that needs reading |
| R6 | Permission gating matches plan section 3 | PASS | `src/routes/PendingEntries.tsx:138`, `src/App.tsx:176`, `src/routes/Home.tsx:203`; no `is_admin` predicate inside either seam implementation, `src/lib/data/supabase.ts:1283-1303` |
| R7 | No invariant violated — reason through each ID (RULE-07) | PASS | table below, seven rows |
| R8 | No dependency added without an ADR | PASS | `git status --porcelain package.json pnpm-lock.yaml` returns empty |

### R1 — the file list

`git status --porcelain` reports twelve paths. **Nine are code and every one is an `allowed_paths`
glob** at `ticket.yaml:55-65`:

- modified — `src/lib/domain/types.ts`, `src/lib/data/index.ts`, `src/lib/data/mock.ts`,
  `src/lib/data/supabase.ts`, `src/routes/Home.tsx`, `src/App.tsx`
- created — `src/routes/PendingEntries.tsx`, `tests/pending-entries.test.ts`,
  `tests/e2e/adm-04-worklist.spec.ts`

The other three are the ticket's own working directory — `ticket.yaml`, `01-plan.md`,
`03-impl-log.md` — which RULE-03 does not govern.

**Two reserved paths are unused, and unused is a subset.** `src/lib/fixtures.ts` and
`supabase/seed.sql` are `allowed_paths` entries at `ticket.yaml:59,63` that the diff does not touch;
`git status --porcelain supabase/` returns empty, which is `schema_delta: none` held mechanically
rather than asserted. Why they are unused is the § 4.4 row of R5.

**The paths 01-plan.md § 7 names as deliberately absent are absent, verified rather than assumed.**
`git status --porcelain` is empty for `src/routes/TeamEntries.tsx`, `src/routes/EditEntry.tsx`,
`src/components/EntryForm.tsx`, `src/lib/data/absence.ts`, `src/lib/data/day-status.ts`,
`tests/seam-parity.test.ts`, `ui-language.json`, `package.json` and `pnpm-lock.yaml`.

`check-allowed-paths.mjs` prints `0 changed file(s)` because it diffs `origin/main...HEAD` and nothing
is committed until `/ship` — the reading CAL-07 and CAL-08 both recorded. The subset claim above is
from `git status --porcelain` against `ticket.yaml:55-65`, not from that script's count.

### R2, R3 — the commands, and the runtime they need

| Command | Exit |
|---|---|
| `node node_modules/typescript/bin/tsc --noEmit` | 0 |
| `node node_modules/eslint/bin/eslint.js .` (Node 22.11.0) | 0 |
| `node node_modules/vitest/vitest.mjs run` | 0 — **8 files, 166 tests, 166 pass** |
| `TZ=UTC …vitest run` | 0 — 166 pass |
| `TZ=Asia/Ho_Chi_Minh …vitest run` | 0 — 166 pass |
| `TZ=America/Los_Angeles …vitest run` | 0 — 166 pass |
| `node node_modules/@playwright/test/cli.js test` | 0 — **155 pass, 0 fail** |
| `node scripts/check-allowed-paths.mjs` | 0 — `allowed-paths: PASS` |
| `node scripts/check-docs.mjs` | 0 — 0 errors, the same 2 advisory D8 warnings CAL-08 saw |

**Lint and the unit suite need Node 22 on the path**, which is `03-impl-log.md`'s finding and CAL-08's
before it: this machine's default is 18.19.1 and `eslint.config.js:6` uses an `import … with { type:
"json" }` attribute that Node 18 cannot parse. `vitest` fails the same way. Nothing in the repository
was edited to make the commands run.

**The six suites 01-plan.md § 7 assigns as the safety net pass unedited**, which is the check that
matters most on this ticket and the one that decides the § 4.4 question below: `cal-01`, `cal-02`,
`cal-03`, `cal-04`, `cal-06` and `cal-07` are all green in the 155, and `git status --porcelain` is
empty for every one of their files.

### R4 — the seam

`src/routes/PendingEntries.tsx:40` is `import { seam } from "@/lib/data"` and there is no second data
import in the file. A grep for `@supabase/supabase-js`, `@/lib/data/supabase` and `./mock` across
`src/routes/`, `src/components/` and `src/App.tsx` returns nothing. The lint rule that encodes RULE-02
(`eslint.config.js:64-70`) passes, and `.ai/registry/boundaries.json`'s D12 reports no crossing.

### R6 — the gating, and the one thing it is not

01-plan.md § 3 declares four rows and **adds no policy and no grant**. Each, and where it is held:

| § 3 row | Held at | Note |
|---|---|---|
| `Read any entry in the team` — ✅ member, ✅ admin | `entry_select_team`, CAL-01's, unchanged | `src/lib/data/supabase.ts:1283-1303` writes **no team predicate and no `is_admin` check** — the policy is the scope. The mock reproduces it with `sameTeam` at `src/lib/data/mock.ts:1335`, the asymmetry `listTeamEntries` already records at `:1024-1028` |
| `Read the member list` — ✅ ✅ | `member_select_team`, TEA-03's, unchanged | `src/routes/PendingEntries.tsx:153` |
| `Approve or reject another member's entry` — ❌ ✅ | **not reachable from this surface** | no seam write function is imported anywhere in `src/routes/PendingEntries.tsx`; the file's only seam calls are `:132`, `:152`, `:153` |
| `Approve or reject their own entry` — ❌ ✅ | same | same |

**The admin fork is one comparison and it is an affordance, not a control.**
`src/routes/PendingEntries.tsx:138` refuses `!me || me.role !== "admin"`; `src/App.tsx:176` guards the
route on `membership.state === "member"` and not on the role, so a member reaches the component and is
refused **by it** rather than bounced; `src/routes/Home.tsx:203` hides the link under
`member.role === "admin"`, the same condition the three links above it use. Nothing in this ticket is
load-bearing for security, which § 3 states and which the absence of any policy in the diff holds.

**`seam.getTeam()` is deliberately not called** and is not called: `grep getTeam src/routes/PendingEntries.tsx`
returns nothing. § 4.3 requires that absence and it is the fourth read that would have started a count
that is not this screen's.

## R5 detail

One row per contract item in 01-plan.md § 4.

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `PendingWindow` | `src/lib/domain/types.ts:419` | yes — `"upcoming" \| "past" \| "all"`, verbatim |
| § 4.1 `PendingEntryQuery` | `src/lib/domain/types.ts:422-447` | yes — `type: EntryType \| null`, `window`, `today`, `page`. Four fields, no fifth, no rename |
| § 4.1 `PendingEntryPage` | `src/lib/domain/types.ts:448-456` | yes — `rows`, `total`, `page`, `pageSize`, and `tests/pending-entries.test.ts:220` asserts the key set is exactly those four |
| § 4.1 `PENDING_PAGE_SIZE` | `src/lib/domain/types.ts:473` | yes — 50 |
| § 4.2 seam declaration | `src/lib/data/index.ts:648` | yes — `listPendingEntries(query: PendingEntryQuery): Promise<PendingEntryPage>`, one function added, nothing existing re-signed |
| § 4.2 predicate `status = 'pending'` | `mock.ts:1336`, `supabase.ts:1292` | yes |
| § 4.2 predicate `type` when not null | `mock.ts:1340`, `supabase.ts:1296` | yes — and `supabase.ts:1296` writes **no predicate at all** for null rather than an `in` over both values |
| § 4.2 predicate window on `end_date` | `mock.ts:1344-1350`, `supabase.ts:1302-1303` | yes — `>= today` / `< today` / no predicate, on `yyyy-MM-dd` strings. `tests/pending-entries.test.ts:288-298` asserts the boundary is inclusive on `today` |
| § 4.2 team predicate **not** written | `supabase.ts:1289-1303` | yes — no `member_team_id` anywhere in the request |
| § 4.2 order `start_date`, `created_at`, `id`, all ascending | `mock.ts:1352-1359`, `supabase.ts:1306-1308` | yes, written twice as § 4.2 says it must be; the mock's copy is asserted at `tests/pending-entries.test.ts:334-374` |
| § 4.2 `from`/`to` arithmetic | `mock.ts:1365-1366`, `supabase.ts:1284-1285,1309` | yes — `page * PENDING_PAGE_SIZE`, `from + PENDING_PAGE_SIZE - 1` |
| § 4.2 exact count, never `rows.length` | `mock.ts:1363`, `supabase.ts:1291,1320-1325` | yes — and the real one **throws** on a null count rather than falling back, which § 4.2 asks for in words |
| § 4.2 short-page throw | `mock.ts:1372-1379`, `supabase.ts:1335-1342` | yes — `rows.length < PENDING_PAGE_SIZE && from + rows.length < total`, character-for-character the same condition in both |
| § 4.3 the screen at `/entries/pending` | `src/routes/PendingEntries.tsx`, route at `src/App.tsx:176` | yes |
| § 4.3 four view phases | `PendingEntries.tsx:179`, `:193`, `:213`, `:249` | yes — loading, refused, unavailable, ready |
| § 4.3 three seam calls and no fourth | `PendingEntries.tsx:132`, `:152`, `:153` | yes — `getTeam` absent |
| § 4.3 `today` from the local clock, once | `PendingEntries.tsx:97-100`, `:118` | yes — `useState(localToday)`, resolved on mount and passed in |
| § 4.3 the Home link, admin-only | `src/routes/Home.tsx:203,206` | yes — fourth link, same condition as the three above it |
| § 4.3 the route, guarded on membership | `src/App.tsx:176` | yes |
| **§ 4.4 three fixture rows in `src/lib/fixtures.ts` and `supabase/seed.sql`** | **not implemented** | **impossible as specified — verified below** |
| § 4.5 fifteen selectors | `PendingEntries.tsx:179,193,213,263,281,301,325,331,335,351,373,391,397,409`; `Home.tsx:206` | yes — every row of the table exists, none is renamed, and **no selector on the screen names an approval** |

### § 4.4 — not implemented, and the deviation is sound

`03-impl-log.md` § *Deviations* item 1 declares it. **Each of its four citations was opened in this
session and each holds:**

| Owner | Assertion that a seeded pending row would break | Verified at |
|---|---|---|
| `thanh@example.com` (`FIXTURE_MEMBER`) | `own-entries-empty` is visible on that account's first screen | `tests/e2e/cal-01-create-entry.spec.ts:72` |
| `linh@example.com` (`FIXTURE_APPROVED_MEMBER`) | exactly two own rows | `tests/e2e/cal-03-admin-edit-entry.spec.ts:183` |
| `quan@example.com` (`FIXTURE_ADMIN`) | exactly one own row | `tests/e2e/cal-07-overload-warning.spec.ts:418` |
| `dung@example.com` (`FIXTURE_SECOND_ADMIN`) | exactly one own row | `tests/e2e/cal-07-overload-warning.spec.ts:302` |

Those four are every active member of `FIXTURE_TEAM`. The remaining two cannot own the rows for
reasons of their own, and both hold: `FIXTURE_REMOVED_MEMBER` has a null `member_team_id`, so
`sameTeam` keeps its entries off this read as well as every other team read, and
`FIXTURE_OTHER_TEAM_MEMBER` is on the other team. `src/lib/fixtures.ts:307-316` already records the
same collision for `FIXTURE_APPROVED_ENTRY`, in the same words, from CAL-03.

So the plan's own instruction — *"if any of them fails, the fixture dates collided under INV-01 and
the fix is the fixture, not the suite"* — cannot be followed: **the collision is not a date, it is an
owner, and no owner works.** `listOwnEntries` has no date filter, so moving the fixture to 2030 or to
2025 changes nothing. Editing any of the four suites is what 01-plan.md § 7 forbids.

**This is the routing table's *R5 impossible as specified* row** (`.ai/01-operating-model.md:146`),
which routes to `tech-lead-design` and does not increment `rework_count`. **It is not routed, and the
reason is that routing it produces no code change.** Every criterion § 4.4 existed to serve — AC-1,
AC-2, AC-6, AC-7, AC-8 — is asserted and green in both suites, against rows created through CAL-01's
form, which is the truthful route: `status` is the column default and a pending entry is exactly what
that form produces. The plan's dates survive where they carried meaning (2030 for the upcoming rows,
`tests/e2e/adm-04-worklist.spec.ts:78-81`), and the past-dated one moved to 2025 for a reason that is
better than the plan's — September 2026 is rendered by three shipped suites.

Nothing was invented to work around it: no field name, no signature, no selector. RULE-04's subject is
intact.

**What is genuinely lost is recorded and is not nothing:** `supabase db reset` now produces a
`/entries/pending` that is correctly empty, so the demo seed no longer shows this feature working.
`03-impl-log.md` § *Open questions* item 2 names the fix — a chore that turns the four exact own-row
counts into filters — and it wants a row. See *Findings outside the gate* item 1.

### The two declared additions

`pending-entry-row-dates` (`PendingEntries.tsx:360`) and `pending-entries-back` (`:202`, `:225`,
`:420`) go beyond § 4.5's table. Both are declared in `03-impl-log.md` § *Testability contract* with
their precedent — the `d → d` pair every entry list in this product renders, and the return link
`team-entries-back` and `holidays-back` already establish. Accepted as declared additions, the shape
CAL-02, CAL-03 and CAL-07 each recorded; neither changes behaviour and nothing but the suites reads
them.

The two duplicated label maps (`PendingEntries.tsx:54-65`) are declared in `03-impl-log.md`
§ *Deviations* item 3 and are OPS-001's to fold. Lifting them here would put a file neither ticket
owns into `allowed_paths` for a change that alters no behaviour.

## R7 detail

`invariants_touched: []`. The template requires per-ID reasoning rather than an assertion, so every
one of the seven is reasoned and cited.

| Invariant | Held by | Citation |
|---|---|---|
| INV-01 | Two entries of one member may not cover the same portion of the same date. **This ticket creates no entry.** The only writes in the diff are `useState` calls; no seam write function is imported by any file it adds or changes. The rows the two suites use are created through CAL-01's form, which enforces INV-01 itself and refuses on conflict — `tests/pending-entries.test.ts:110` asserts every creation was accepted, so no fixture silently collided | `src/routes/PendingEntries.tsx:132,152,153` are the file's only seam calls, all reads; `tests/pending-entries.test.ts:96-97` states the dates are distinct per member |
| INV-02 | An approved entry whose dates, type, portion or tentative flag change returns to `pending`. **No transition is performed.** `status` is never written: it appears in this diff only as a read predicate and as a rendered value | `src/lib/data/supabase.ts:1292` (`.eq("status", "pending")`, a filter); `src/lib/data/mock.ts:1336`; `grep` for `approved_by`, `approved_at`, `rejection_reason` in the diff returns only `ENTRY_COLUMNS`, unchanged at `supabase.ts:145-147` |
| INV-03 | A rejected entry always carries a non-empty rejection reason. Same argument, from the other side: nothing here writes `status = 'rejected'` or `rejection_reason`, and the screen has no reason field — `tests/e2e/adm-04-worklist.spec.ts:275-278` asserts the list holds no `form`, `textarea`, `button` or `input` at all | `tests/e2e/adm-04-worklist.spec.ts:264-278` |
| INV-04 | The absence count. **`src/lib/data/absence.ts` is neither modified nor imported by anything this ticket adds** — `PendingEntries.tsx` imports `@/lib/data` and `react-router-dom` and nothing else. The number this screen shows counts *entries awaiting a decision*, a different quantity over a different set, and the window filter changes what is **listed** and nothing that is **counted** elsewhere. `tests/absence.test.ts` passes unedited in the 166 | `src/routes/PendingEntries.tsx:36-47` (the whole import block); `git status --porcelain src/lib/data/absence.ts` empty |
| INV-05 | A tentative entry counts as a non-tentative one does. `tentative` is read in exactly one place in this ticket — a `data-` attribute on the row — and is consulted in no arithmetic and in no predicate | `src/routes/PendingEntries.tsx:342`, `:366`; no `tentative` in either seam implementation's new code (`mock.ts:1331-1386`, `supabase.ts:1283-1345`) |
| INV-06 | An entry carries exactly one portion applying to every date in its range. `portion` is rendered and never written or derived | `src/routes/PendingEntries.tsx:339`, `:365` |
| INV-07 | Every entry belongs to one member and is counted only against that member's team. **The closest call, and it is held by the policy rather than by this ticket.** The real implementation writes no team predicate at all — `entry_select_team` is the only scope — and the mock reproduces the policy with `sameTeam`, which is `null`-safe for a removed member. Asserted on the row **and on the count**, which is the half a row-level assertion alone would miss, against `FIXTURE_OTHER_TEAM_ENTRY` — a row that is `pending`, so the status predicate does not hide it and the team scope is the only thing keeping it out | `src/lib/data/supabase.ts:1289-1303` (no `member_team_id`); `src/lib/data/mock.ts:1335`; `tests/pending-entries.test.ts:177,182-186`; `tests/e2e/adm-04-worklist.spec.ts:171-173` |

**An invariant held only by a UI affordance is not held**, and none of the seven is. INV-07 is held by
CAL-01's row-level policy; the other six are held by the absence of any write in the diff, which is
checkable by reading the import block of every file it touches.

## Findings

None. No check failed, so no row routes.

| # | Check | Finding | Routes to | Increments `rework_count` |
|---|---|---|---|---|
| — | — | — | — | — |

## Findings outside the gate

Recorded because they are true and change no verdict. **The first is a shipping defect, is one
sentence wide, and is the only one of the four that a user can see.**

1. **The refusal on the new screen tells a member to go to a page that refuses members.**
   `src/routes/PendingEntries.tsx:197-200` reads *"Everything listed here is readable by the whole
   team on the team's entries page."* It is shown to non-admins and to nobody else, and it is false
   for its only audience: `/entries/team` is `TeamEntries.tsx`, whose non-admin branch renders
   *"This page is for admins"* (`src/routes/TeamEntries.tsx:145-156`), and its Home link is
   admin-only (`src/routes/Home.tsx:91-97`). A member following that sentence reaches a second
   refusal.

   **The substance behind the sentence is sound and only the citation is wrong.** A member genuinely
   can read every one of these rows — `entry_select_team` admits them at the datastore, and the month,
   week and year views render all team entries to both roles — so the refusal really does protect
   nothing and § 3's conclusion stands. What does not stand is the screen it names.

   **It originates upstream.** `01-plan.md` § 2 AC-10 and § 3 both name `/entries/team` as the screen
   a member can already read this list on, and the implementation is faithful to them. It is
   therefore not a Developer defect and would not increment `rework_count` if it were routed. It is
   not routed because no R-check covers the truthfulness of copy that no criterion specifies —
   AC-10 requires the refusal state and no list, and both are held — and inventing a ninth check to
   fail on is not this stage's to do. **The fix is one sentence** in `PendingEntries.tsx:197-200`,
   naming the calendar views rather than the team's entries page, and it wants a `BUG` row or a
   correction folded into ADM-05, which edits this same screen.

2. **`03-impl-log.md` overstates one line of its AC table.** Its AC-10 row reads *"✅ (and the second
   half is asserted, not just the first)"*. The assertion it points at,
   `tests/e2e/adm-04-worklist.spec.ts:327`, checks that `home-team-entries-link` is **absent** for a
   member — which establishes that the link is admin-only, not that the refusal protects nothing —
   and the comment above it at `:321-324` restates finding 1's false claim. AC coverage is not a gate
   item after ADR-022 (*"nobody writes tests… no gate requires one"*), so this fails nothing; it is
   recorded because a log that claims an assertion which is not there is the one kind of log error
   that survives into the next ticket's reading.

3. **Two shipped row limits still sit above the datastore's cap.** `TEAM_ENTRY_LIMIT` and
   `MONTH_ENTRY_LIMIT` are 2000 (`src/lib/domain/types.ts`), the installed client documents the
   platform default as 1000
   (`node_modules/.pnpm/@supabase+postgrest-js@2.112.4/node_modules/@supabase/postgrest-js/dist/index.d.mts:3522`),
   so `rows.length >= LIMIT` can never fire and CAL-04 AC-11 is not held. `HOLIDAY_LIMIT` is exactly
   1000 and works only because the comparison is `>=`. **Correctly not fixed here** — both are other
   tickets' acceptance criteria and this ticket's `invariants_touched` is `[]`. It wants a `BUG` row.
   Raised first by 01-plan.md § 2 *Open questions* item 4 and repeated by the log; recorded a third
   time because nothing has issued the row yet.

4. **The demo seed no longer shows this feature working**, the consequence of § 4.4 above. A chore
   that turns four exact own-row assertions into filters would make the three planned fixtures
   possible. Worth a row; not worth editing four shipped suites from inside this ticket.

5. **`.ai/registry/rules.md:63` still points RULE-07's enforcement at the wrong check.** It reads
   *"Review check R8; failure routing table sends R8 to a human"*, but ADR-022 § Decision 6 renumbered
   R8 and R9 to R7 and R8, and `.ai/01-operating-model.md:147` correctly sends **R7** to a human — R8
   is now the dependency check, which routes to the Developer. Registry plane, RULE-01, steward work;
   a reviewer does not edit it. Distinct from the template staleness CAL-08 recorded at its
   *Findings outside the gate* item 1, which was `.ai/templates/review-report.md`.

## Verdict

**`PASS`.** All eight checks hold on evidence produced in this session, every citation is to the
implementation rather than to this report, and the ticket advances to `DONE`.

The two things a reader of this verdict should carry forward: **§ 4.4 was not implementable and the
deviation is correct**, verified against all four shipped assertions that make it so; and **one
sentence of user-facing copy is false and inherited from the plan** — outside the gate, one line to
fix, and it belongs to whoever next opens `PendingEntries.tsx`.
