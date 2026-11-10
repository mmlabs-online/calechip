---
ticket: ADM-04
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-05T17:54:33+07:00
inputs_read:
  - .ai/board/tickets/ADM-04/01-plan.md
  - .ai/board/tickets/ADM-04/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - .ai/steward/context.md
  - src/App.tsx
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/Home.tsx
  - src/routes/TeamEntries.tsx
  - src/components/EntryForm.tsx
  - supabase/seed.sql
  - tests/seam-parity.test.ts
  - tests/absence.test.ts
  - tests/ui-language.test.ts
  - tests/e2e/cal-01-create-entry.spec.ts
  - tests/e2e/cal-02-edit-delete-entry.spec.ts
  - tests/e2e/cal-03-admin-edit-entry.spec.ts
  - tests/e2e/cal-04-month-view.spec.ts
  - tests/e2e/cal-06-year-view.spec.ts
  - tests/e2e/cal-07-overload-warning.spec.ts
  - eslint.config.js
  - ui-language.json
  - playwright.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# ADM-04 — implementation log

## Files touched

**Nine files, all nine inside `allowed_paths`, and no tenth.** Two of the eleven paths the plan
reserved are **unused** — `src/lib/fixtures.ts` and `supabase/seed.sql` — for the reason § *Deviations*
item 1 sets out at length. `node scripts/check-allowed-paths.mjs` agrees.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/domain/types.ts` | modified | `PendingWindow`, `PendingEntryQuery`, `PendingEntryPage` and `PENDING_PAGE_SIZE` added at the end; nothing existing changes shape | § 4.1 |
| `src/lib/data/index.ts` | modified | `listPendingEntries` declared on the seam, with the contract that forbids a second counting call and requires the short-page throw | § 4.2, § 5 |
| `src/lib/data/mock.ts` | modified | the in-memory implementation: predicate, order, page, exact count, short-page assertion | § 4.2 |
| `src/lib/data/supabase.ts` | modified | the real implementation: the same, through `{ count: "exact" }` with `.range()` | § 4.2 |
| `src/routes/PendingEntries.tsx` | created | the screen — four phases, two filters, the exact count, the row link, and no write of any kind | § 4.3, § 4.5 |
| `src/routes/Home.tsx` | modified | the fourth admin-only link, beside the other three and under the same condition | § 4.3 |
| `src/App.tsx` | modified | the `/entries/pending` route, guarded on membership the way `/threshold` is | § 4.3 |
| `tests/pending-entries.test.ts` | created | the predicate, the order, the paging, the exact count, and the three criteria assertable nowhere else | § 2 (AC-3, AC-4, AC-16) |
| `tests/e2e/adm-04-worklist.spec.ts` | created | what an admin sees, for the ten criteria that have an interface | § 2, § 4.5 |

**Not touched, and it is worth naming because the plan reserved them:** `src/lib/fixtures.ts` and
`supabase/seed.sql`. See § *Deviations* item 1.

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| § 4.1 `PendingWindow` | `src/lib/domain/types.ts:419` | verbatim from the plan |
| § 4.1 `PendingEntryQuery` | `src/lib/domain/types.ts:422` | four fields, verbatim. `today` is a PARAMETER, which is what makes AC-16 testable without a clock |
| § 4.1 `PendingEntryPage` | `src/lib/domain/types.ts:448` | `rows`, `total`, `page`, `pageSize`. One shape from one read — the whole of AC-3 |
| § 4.1 `PENDING_PAGE_SIZE` | `src/lib/domain/types.ts:473` | 50, and its comment records that this is a WINDOW and not a ceiling |
| § 4.2 seam declaration | `src/lib/data/index.ts:648` | one function added; nothing existing changes signature or behaviour |
| § 4.2 predicate — mock | `src/lib/data/mock.ts:1334-1351` | `status`, then `type` when not null, then the window on `end_date`; the team predicate is `sameTeam` because the mock has no policy |
| § 4.2 predicate — supabase | `src/lib/data/supabase.ts:1289-1303` | the same three, and NO team predicate: `entry_select_team` is the scope (AC-13) |
| § 4.2 order — both | `mock.ts:1352-1359`, `supabase.ts:1306-1308` | `start_date`, `created_at`, `id`, all ascending. Written twice, which § 2 Open questions item 5 names |
| § 4.2 exact count — mock | `src/lib/data/mock.ts:1363` | `matching.length` — the size of the matching SET, never of the page |
| § 4.2 exact count — supabase | `src/lib/data/supabase.ts:1305-1326` | `{ count: "exact" }` beside `.range()`, and a null count THROWS rather than falling back to `rows.length` |
| § 4.2 short-page throw | `mock.ts:1372-1379`, `supabase.ts:1335-1342` | short AND more rows remaining. AC-5 |
| § 4.3 four phases | `src/routes/PendingEntries.tsx:179`, `:193`, `:213`, `:233` | loading, refused, unavailable, ready |
| § 4.3 three seam calls and no fourth | `PendingEntries.tsx:132`, `:151-154` | `getCurrentMember`, `listPendingEntries`, `listMembers`. `getTeam()` is deliberately not called |
| § 4.3 `today` from the local clock | `src/routes/PendingEntries.tsx:97-100`, `:118` | resolved ONCE on mount, then passed into the query |
| § 4.3 the Home link | `src/routes/Home.tsx:206` | admin-only, beside the other three, carrying no count |
| § 4.3 the route | `src/App.tsx:176` | guarded on `member` and not on `admin`, so the refusal says why |
| § 5 seam impact | — | one function added, nothing existing changed. `tests/seam-parity.test.ts` passes unedited |
| § 6 schema delta `none` | — | no migration, no policy, no grant. `supabase/` is untouched entirely |

## Deviations from the design

**Three, all declared, and the first is substantive.**

### 1. No fixture is added, and the three rows of § 4.4 are created through the product instead

**§ 4.4 is not implementable as written, and the collision is not the one it predicted.** It assigns
`FIXTURE_PENDING_PTO_ENTRY` and `FIXTURE_PENDING_PAST_ENTRY` to `FIXTURE_MEMBER` and
`FIXTURE_PENDING_WFH_ENTRY` to `FIXTURE_APPROVED_MEMBER`, and § 7 requires
`cal-01-create-entry.spec.ts`, `cal-02-edit-delete-entry.spec.ts` and `cal-04-month-view.spec.ts` to
pass **unedited**, adding: *"If any of them fails, the fixture dates collided under INV-01 and the fix
is the fixture, not the suite."*

The collision is not INV-01 and it is not fixable by moving a date. **A seeded pending entry appears
in its owner's OWN-ENTRY list, which has no date filter at all** (`listOwnEntries` narrows on
`member_id` and nothing else), and every active member of `FIXTURE_TEAM` has that list's exact row
count asserted by a shipped suite:

| owner | asserted at | assertion |
|---|---|---|
| `thanh@example.com` (`FIXTURE_MEMBER`) | `tests/e2e/cal-01-create-entry.spec.ts:72` | `own-entries-empty` is visible on that account's first screen |
| `linh@example.com` (`FIXTURE_APPROVED_MEMBER`) | `tests/e2e/cal-03-admin-edit-entry.spec.ts:183` | exactly two own rows |
| `quan@example.com` (`FIXTURE_ADMIN`) | `tests/e2e/cal-07-overload-warning.spec.ts:418` | exactly one own row |
| `dung@example.com` (`FIXTURE_SECOND_ADMIN`) | `tests/e2e/cal-07-overload-warning.spec.ts:302` | exactly one own row |

The two remaining members cannot own the rows for reasons of their own: `FIXTURE_REMOVED_MEMBER` is
removed, so `member_team_id` is null for it and `sameTeam` keeps its entries off every team read —
including this one; and `FIXTURE_OTHER_TEAM_MEMBER` is on the other team, which is the whole point of
`FIXTURE_OTHER_TEAM_ENTRY`. **Adding a sixth member is worse than any of the above**: it changes the
roster from five to six and breaks `cal-06-year-view.spec.ts`'s `year-row` count, CAL-04's
`data-current-members` denominator, and every overload figure CAL-07 asserts.

**So the entries are created through CAL-01's form.** `tests/e2e/adm-04-worklist.spec.ts` signs in as
the owner, declares, signs out and signs back in as the admin — the shape `cal-04-month-view.spec.ts`
and `cal-07-overload-warning.spec.ts` already use for multi-person setup. It is also the truthful
route: `status` is the column default, a pending entry is exactly what that form produces, and unlike
`FIXTURE_APPROVED_ENTRY` — which had to be seeded because nothing in the product can create an
approved row — nothing here needs a state the product cannot reach.

**The plan's dates are kept where they still mean something.** The unit suite and the end-to-end suite
both use 2030 for the upcoming rows, for exactly the reason § 4.4 gives — a date inside the current
planning window would cross the default filter's boundary as the real clock advances, and the suite
would then fail months later in the wrong place. The past-dated row moved from **2026-09-01 → 2026-09-02**
to **2025-03-04 → 2025-03-06**, because September 2026 is rendered by `cal-04-month-view.spec.ts`
(`/month/2026-09`), by `cal-05-week-view.spec.ts` and by `cal-06-year-view.spec.ts` (`/year/2026`),
and no year before 2026 is rendered by any suite except structurally. It keeps the property § 4.4
asked for — permanently past — with a wider margin.

**What is lost, stated rather than glossed:** a developer running `supabase db reset` against a local
project sees no pending entry on the worklist until they create one. That is a weaker demo seed than
the plan intended. **A `BUG` or chore row that reworks the own-entry suites' exact counts into
filters would make the fixtures possible**, and it is worth doing — but editing four shipped suites is
precisely what § 7 forbids this ticket from doing.

### 2. AC-12's member-less half is answered by the route guard, not by the component

AC-12 expects a caller with no member row to *"see the refusal state"*. § 4.3 also says the route is
*"guarded on membership the way `/threshold` is"*, and those two sentences disagree: the guard sends a
member-less caller to `/`, which resolves to the NotOnATeam screen, so they never reach
`PendingEntries.tsx`. **The guard was implemented as § 4.3 specifies**, because `/threshold` behaves
identically and ADM-01 shipped that way. The component's `refused` branch still handles `!me` — it is
reachable when the session survives a removal between the guard and the read — and the criterion's
substance holds either way: no list, and not a loading state that never ends. The end-to-end suite
asserts that form and names the deviation at the test.

### 3. Two label maps are duplicated from `TeamEntries.tsx`

`TYPE_LABELS` and `PORTION_LABELS` are copied rather than imported, which is the same duplication
`TeamEntries.tsx` itself declared against `EntryForm.tsx`: the shared home for them is a module
neither ticket owns, and OPS-001 is the ticket that folds the product's copy into one place. Lifting
them here would put a third file in `allowed_paths` for a change that alters no behaviour.

**Everything else is § 4.1 through § 4.5 as written**, including the selector table exactly, the three
seam calls and no fourth, and `getTeam()` deliberately not called.

## Invariants

`invariants_touched: []`, so this table is the argument that the empty list is right rather than a row
saying nothing was affected. Reasoned per candidate, as 01-plan.md section 2 requires.

| ID | Still holds because |
|----|---------------------|
| INV-02, INV-03 | They govern transitions of `status` and `rejection_reason`. **Nothing in this diff writes either column, or `approved_by`, or `approved_at`.** No seam write function is imported by `PendingEntries.tsx`, and the two seam implementations gained a read and nothing else. The screen DISPLAYS the pending state and performs no transition — which is the state both invariants leave alone. AC-9 asserts it from outside, by the absence of any control. |
| INV-04, INV-05 | The absence count. `src/lib/data/absence.ts` is neither modified nor imported by anything this ticket adds, and no number on this screen is an absence count: `total` counts **entries awaiting a decision**, which is a different quantity over a different set and appears in no invariant. A pending entry counts toward INV-04 whether or not this list shows it — the registry row says so in those words, and the window filter changes what is LISTED and never what is COUNTED anywhere else. |
| INV-07 | Every entry belongs to one member and is counted only against that member's team. The closest call, and still not touched: this ticket writes **no** team predicate in the real implementation — `entry_select_team`, which CAL-01 shipped, is the only scope, and a copy in the query would have been a second expression of the invariant above the seam. The mock reproduces the policy with `sameTeam`, as it already does for `listTeamEntries`. AC-13 asserts it holds, in both suites, against `FIXTURE_OTHER_TEAM_ENTRY` — which is `pending`, so the status predicate does not hide it and the team scope is the only thing keeping it off the list. Asserting an invariant still holds is not touching it. |

## Verification run

Commands actually executed, with exit codes.

| Command | Exit | Notes |
|---------|------|-------|
| typecheck — `pnpm exec tsc --noEmit` | 0 | |
| lint — `pnpm exec eslint .` | 0 | includes RULE-02's boundary rule and § Language. `PendingEntries.tsx` is new, is English throughout, and is NOT added to `ui-language.json`'s `copyDebt` — that list only ever shrinks, and this ticket adds nothing to it despite editing two of its five files |
| unit — `pnpm exec vitest run` | 0 | 8 files, 166 tests, all pass. 18 of them are this ticket's |
| unit under `TZ=UTC` | 0 | 166 pass |
| unit under `TZ=Asia/Ho_Chi_Minh` | 0 | 166 pass |
| unit under `TZ=America/Los_Angeles` | 0 | 166 pass. AC-16, and the run a datastore-side `current_date` would fail |
| end-to-end — `pnpm exec playwright test` | 0 | **155 pass, 0 fail**, seam guard included. 10 are this ticket's; **`cal-01`, `cal-02`, `cal-03`, `cal-04`, `cal-06` and `cal-07` all pass UNEDITED**, which is the role § 7 assigns them and the check that § *Deviations* item 1 was resolved the right way round |
| `node scripts/check-allowed-paths.mjs` | 0 | `allowed-paths: PASS` |
| `node scripts/check-docs.mjs` | 0 | 0 errors, 2 pre-existing advisory D8 warnings unrelated to this ticket |
| `git diff --name-only` subset of `allowed_paths` | yes | nine files, all nine listed above |

**The environment needed Node 22 on the path**, as CAL-08's log already recorded: this machine runs
18.19.1 against a recorded major of 22 (`.ai/standards/tech-stack.md:51`), and `eslint.config.js:6`
uses an `import … with { type: "json" }` attribute that Node 18 cannot parse — so lint exits 2 with a
`SyntaxError` before any rule runs. Nothing in the repository was edited to make the commands run.

## Testability contract

Every selector in 01-plan.md § 4.5, and where it now exists. All new; nothing existing is renamed,
which the six untouched suites confirm by passing.

| selector | Exists at |
|----------|-----------|
| `pending-entries-loading` | `src/routes/PendingEntries.tsx:179` |
| `pending-entries-refused` | `src/routes/PendingEntries.tsx:193` |
| `pending-entries-unavailable` | `src/routes/PendingEntries.tsx:213` |
| `pending-entries-count` — `data-total`, `data-shown` | `src/routes/PendingEntries.tsx:263-265` |
| `pending-entries-window` — `data-window` | `src/routes/PendingEntries.tsx:281-282` |
| `pending-entries-type` — `data-type`, empty for both | `src/routes/PendingEntries.tsx:301-302` |
| `pending-entries-empty` | `src/routes/PendingEntries.tsx:325` |
| `pending-entries` | `src/routes/PendingEntries.tsx:331` |
| `pending-entry-row` — `data-entry-id`, `data-member-id`, `data-type`, `data-portion`, `data-start-date`, `data-end-date`, `data-tentative` | `src/routes/PendingEntries.tsx:335-342` |
| `pending-entry-row-member` | `src/routes/PendingEntries.tsx:351` |
| `pending-entry-row-link` | `src/routes/PendingEntries.tsx:373` |
| `pending-entries-page` — `data-page`, `data-page-size` | `src/routes/PendingEntries.tsx:391-393` |
| `pending-entries-prev` | `src/routes/PendingEntries.tsx:397` |
| `pending-entries-next` | `src/routes/PendingEntries.tsx:409` |
| `home-pending-entries-link` | `src/routes/Home.tsx:206` |

**Two additions beyond the table, both declared here rather than left to be found in a diff:**
`pending-entry-row-dates` (the `d → d` pair every other entry list in the product renders, and the
form CAL-01 fixed) and `pending-entries-back` (the return link `team-entries-back` and
`holidays-back` already establish). **No selector on this screen names an approval** — a placeholder
reserved for ADM-05 would be a control that exists in the test before it exists in the product.

## Where each acceptance criterion is asserted

| AC | Unit | End-to-end |
|----|------|------------|
| AC-1 only entries awaiting a decision | ✅ | ✅ |
| AC-2 every row names its member | ✅ (the owner is on the row) | ✅ (the name is resolved and drawn, for two owners) |
| AC-3 the count is exact and cannot disagree | ✅ (`total` ≠ `rows.length` on a 54-row set) | ✅ (`data-total` beside `data-shown`) |
| AC-4 the list pages rather than truncates | ✅ (every row reachable exactly once) | partial — the control, its state, and its inertness on one page |
| AC-5 a shortened page is refused | — see below | — see below |
| AC-6 the default window hides past-dated entries | ✅ | ✅ |
| AC-7 past-dated entries behind an explicit filter | ✅ | ✅ |
| AC-8 WFH is in the list and the type filter narrows it | ✅ | ✅ |
| AC-9 no approve control and no reject control | — | ✅ |
| AC-10 a member is refused, and the refusal protects nothing | — | ✅ (and the second half is asserted, not just the first) |
| AC-11 an empty worklist says so | ✅ (empty page, zero total) | ✅ (the sentence) |
| AC-12 the three non-list states | — | ✅ for two of the three; see below |
| AC-13 no other team's entry, and not in the count | ✅ | ✅ |
| AC-14 each row links to that entry | — | ✅ |
| AC-15 coordination, not an employment decision | — | ✅ (the copy, asserted as copy) |
| AC-16 *today* is the caller's date | ✅ (three timezones) | — |

**AC-5 has no assertion anywhere, and that is declared rather than left to be noticed.** The throw
fires when the datastore shortens a page that is not the last one. In the mock the slice and the count
come from one array, so the two cannot disagree and the assertion cannot fire; and no test can make
PostgREST cap a read without a provisioned project. It is the same untested shape `ROSTER_LIMIT`,
`OWN_ENTRY_LIMIT`, `TEAM_ENTRY_LIMIT`, `MONTH_ENTRY_LIMIT`, `HOLIDAY_LIMIT`, CAL-04 AC-11 and ADM-02
AC-12 already carry. **What IS asserted is the half that would break the product if it were wrong:**
that a short *last* page does **not** throw. The obvious form of the condition — `rows.length <
pageSize` — would fire on every last page and make the worklist unusable at exactly the moment the
queue emptied, and `tests/pending-entries.test.ts` fails if somebody writes it that way.

**AC-12's third case (a read that throws) is covered by the `catch` every read on this screen falls
into**, which each earlier suite already exercises on its own surface; what is untested is the throw
arriving. Its first case is § *Deviations* item 2.

## Open questions

**1. Two shipped row limits sit ABOVE the datastore's cap, and their truncation assertions can never
fire.** This is 01-plan.md section 2, Open questions item 4, restated here because it is the finding
of this ticket's PLAN and nothing in this stage closed it. The installed client documents the platform
default as 1000 rows
(`@supabase/postgrest-js@2.112.4/dist/index.d.mts:3522`), and `TEAM_ENTRY_LIMIT` and
`MONTH_ENTRY_LIMIT` are both 2000 — so `rows.length >= LIMIT` never fires, PostgREST answers a
believable short list, and CAL-04 AC-11 is not held. `HOLIDAY_LIMIT` is exactly 1000 and works only
because the comparison is `>=`. **Not fixed here**, and deliberately: `src/lib/domain/types.ts` is in
this ticket's `allowed_paths` for its own new shapes, and changing two numbers there would silently
alter two other tickets' acceptance criteria inside a ticket whose `invariants_touched` is `[]`. **It
wants a `BUG` row**, and `/triage` issues those. This ticket's own page size is 50 and its short-page
assertion detects a lowered cap **without knowing its value**, which is what the five `TODO(verify)`
markers were waiting for.

**2. The demo seed no longer shows a worklist with anything in it.** The consequence of § *Deviations*
item 1: `supabase db reset` produces a `/entries/pending` that is correctly empty. The fix is not a
fixture — it is a chore that turns the four exact own-row counts listed there into filters, after
which the three rows § 4.4 specifies can be seeded exactly as written. Worth a chore row; not worth
editing four shipped suites from inside this ticket.

**3. The order is written twice and nothing reports a divergence.** 01-plan.md section 2, Open
questions item 5 names it and this stage did not improve on it: `tests/seam-parity.test.ts` compares
names and arity, `tests/pending-entries.test.ts` asserts the **mock's** copy, and the real
implementation's three `order` calls are covered by nothing that runs in CI. It is the one duplication
this codebase otherwise refuses, and paging is what forces it — a page boundary needs a server-side
order, so it cannot be applied above the seam the way `absence.ts` does. The available mitigation is a
test against a provisioned project, which does not exist.

**4. `today` is resolved once, on mount, and a screen left open across midnight keeps answering the
question it was opened with.** Deliberate — a filter that silently re-evaluates while somebody is
reading it would move rows out from under them — but it is a decision and not an accident, and a
reviewer should see it named rather than infer it from a `useState` initializer.

**5. `src/lib/data/mock.ts` and `src/lib/data/supabase.ts` are two of OPS-002's five remaining
`copyDebt` files, and this ticket left both larger.** Nothing it wrote into either is Vietnamese —
every sentence added is English, and `ui-language.json` is unchanged — so OPS-002's job there does not
grow in the way that matters. Named because 01-plan.md section 7 flagged the collision and it is worth
confirming which way it landed.
