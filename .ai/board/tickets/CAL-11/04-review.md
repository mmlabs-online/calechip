---
ticket: CAL-11
stage: REVIEW
agent: tech-lead-review
produced_at: 2026-09-23T11:28:10+0700
inputs_read:
  - .ai/board/tickets/CAL-11/01-plan.md
  - .ai/board/tickets/CAL-11/03-impl-log.md
  - .ai/board/tickets/CAL-11/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/registry/decisions/ADR-042-inv-04-accepts-the-removed-member-shape-until-both-sides-are-fixed.md
  - .ai/01-operating-model.md
  - .ai/standards/architecture.md
  - .ai/templates/review-report.md
  - git diff --name-only origin/main...HEAD
  - node scripts/check-carry.mjs CAL-11
  - supabase/migrations/20260922150000_cal11_cross_team_reads.sql
  - supabase/migrations/20260831150024_tea01_membership.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/data/absence.ts
  - src/lib/fixtures.ts
  - tests/cross-team-reads.test.ts
  - tests/seam-parity.test.ts
  - eslint.config.js
  - node_modules/.pnpm/@supabase+postgrest-js@2.112.4/node_modules/@supabase/postgrest-js/dist/index.cjs
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: DONE
verdict: PASS
failed_checks: []
invariant_violation: false
route_to: none
increments_rework: false
---

# CAL-11 — Review

**Second pass, in a session that read nothing of the first.** The previous verdict
(2026-09-23T11:05, `gate: FAIL`) failed R1's uncommitted half: `check-carry` reported nine stray
paths, all ADR-043 steward work, dirty only because `feat/CAL-11` was two commits behind
`origin/main`. The branch is now level with `origin/main` (`git rev-list --left-right --count
origin/main...HEAD` returns `0 0`) and that finding is gone. Every other check below was re-derived
from the tree as it stands, not carried.

## Checklist

| # | Check | Verdict | Citation |
|---|---|---|---|
| R1 | Committed / uncommitted paths within `allowed_paths` | **PASS** | *Committed:* `git diff --name-only origin/main...HEAD` is **empty** — the branch carries no commit of its own, so the subset test is trivially satisfied. *Uncommitted:* `node scripts/check-carry.mjs CAL-11` exits 0, `PASS — nothing stray`, 11 paths all **carried**: `.ai/board/backlog.md` (ship-owned, ADR-023); `src/lib/data/index.ts`, `src/lib/data/mock.ts`, `src/lib/data/supabase.ts`, `supabase/migrations/20260922150000_cal11_cross_team_reads.sql`, `tests/cross-team-reads.test.ts` (`allowed_paths`, `ticket.yaml:24-29`); the four `.ai/board/tickets/CAL-11/*` files; `.ai/board/tickets/CAL-12/ticket.yaml` (sibling from the same PROMOTE) |
| R2 | typecheck exit 0 — whole program | **PASS** | `pnpm exec tsc --noEmit` exits 0, no output |
| R3 | lint exit 0 on the changed lintable files | **PASS** | `pnpm exec eslint` over the five paths exits 0 (one warning: the `.sql` file has no matching config, which is not an error). **Repo-wide `pnpm exec eslint .` is also exit 0** — the two pre-existing failures `03-impl-log.md` § *Note on lint* flagged (`scripts/run-loop.mjs`, `src/components/Sidebar.tsx`) were fixed in `main` by the ops commits merged since. **No chore to route** |
| R4 | Nothing outside the seam reaches the datastore (RULE-02) | **PASS** | Every line of the diff is inside `src/lib/data/` (`index.ts:696-732`, `supabase.ts:1511-1626`, `mock.ts:1526-1629`), plus one migration and one test. `tests/cross-team-reads.test.ts:13-14` imports `@/lib/data/absence` and `@/lib/data/mock` — the seam, never a client. The `supabase-client-in-seam` rule (`eslint.config.js:60-79`, ignoring the seam) reports nothing repo-wide, which is R3's exit 0 |
| R5 | Every contract item in plan § 4 implemented (RULE-04) | **PASS** | Per-item table below |
| R6 | Permission gating matches plan § 3 | **PASS** | Detail below |
| R7 | No invariant violated (RULE-07) | **PASS** | Per-ID table below. INV-04 carries an **accepted deviation** under ADR-042, not an open violation |
| R8 | No dependency added without an ADR | **PASS** | `git status --porcelain package.json pnpm-lock.yaml` is empty. Neither manifest nor lockfile is touched; the diff adds no import of a package not already imported by the file it sits in |

Test suite, run though it is not a gate item: `pnpm exec vitest run` exits 0 — **22 files, 330
tests, all pass**, `tests/cross-team-reads.test.ts` contributing 14.

## R5 detail

| Contract item | Implemented at | Matches signature |
|---|---|---|
| § 4.1 `list_members_for_team(p_team_id uuid)` | `supabase/migrations/20260922150000_cal11_cross_team_reads.sql:33-40` | Yes — `setof public.member`, `language sql stable security definer set search_path = ''`, `where public.is_admin((select auth.uid())) and m.team_id = p_team_id`, no `order by`. Character-for-character the plan's block |
| § 4.1 `list_team_entries_for_team(p_team_id uuid)` | `…cal11_cross_team_reads.sql:45-52` | Yes — predicate `public.member_team_id(e.member_id) = p_team_id`, `is_admin` first |
| § 4.1 `list_team_entries_overlapping_for_team(p_team_id uuid, p_start date, p_end date)` | `…cal11_cross_team_reads.sql:56-65` | Yes — adds `e.date_range && daterange(p_start, p_end, '[]')`; the inclusive bound ADR-011 § 1 requires is present |
| § 4.1 six privilege statements | `…cal11_cross_team_reads.sql:67-73` | Yes — `revoke all … from public` and `grant execute … to authenticated` for each of the three signatures, argument types included |
| § 4.2 `listMembersForTeam(teamId)` declaration | `src/lib/data/index.ts:715` | Yes — arity 1, parameter `teamId`, `Promise<Member[]>`, docblock as specified |
| § 4.2 `listTeamEntriesForTeam(teamId)` declaration | `src/lib/data/index.ts:723` | Yes — arity 1, `Promise<Entry[]>` |
| § 4.2 `listTeamEntriesOverlappingForTeam(teamId, range)` declaration | `src/lib/data/index.ts:732` | Yes — arity 2, parameters `teamId`, `range: DateRange`. Placed after `listAllMembers` as § 4.2 directs |
| § 4.3 Supabase `listMembersForTeam` | `src/lib/data/supabase.ts:1520-1541` | Yes — `.rpc("list_members_for_team", { p_team_id: teamId })`, existing `MEMBER_COLUMNS`, `created_at` asc then `id` asc, `ROSTER_LIMIT`, the three refusals, `toMember` |
| § 4.3 Supabase `listTeamEntriesForTeam` | `src/lib/data/supabase.ts:1543-1567` | Yes — `ENTRY_COLUMNS`, `start_date` desc then `id` asc, `TEAM_ENTRY_LIMIT`, `toEntry` |
| § 4.3 Supabase `listTeamEntriesOverlappingForTeam` | `src/lib/data/supabase.ts:1569-1626` | Yes — the own-team loop (`supabase.ts:1735-1811`) with its request replaced by `.rpc(…, { p_team_id, p_start, p_end }, { count: "exact" })`; same `TEAM_ENTRY_PAGE_SIZE` and `TEAM_ENTRY_MAX_PAGES`, same four refusals, messages naming the new function. **No `.filter("date_range", …)`**, as § 4.3 requires. The paging loop was kept as a second copy, which § 4.3 permits |
| § 4.4 Mock `listMembersForTeam` | `src/lib/data/mock.ts:1535-1556` | Yes — `currentAdmin()` first, `m.teamId === teamId` (the SQL compares the row's own `team_id`, not through `member_team_id`), `byCreatedAtThenId` (`mock.ts:140-141`, createdAt asc then id asc), `ROSTER_LIMIT` raise, copies returned |
| § 4.4 Mock `listTeamEntriesForTeam` | `src/lib/data/mock.ts:1558-1583` | Yes — `currentAdmin()` first, `sameTeam(memberTeamId(e.memberId), teamId)` and not `===` (`mock.ts:477-482` gives the reason), startDate desc then id asc |
| § 4.4 Mock `listTeamEntriesOverlappingForTeam` | `src/lib/data/mock.ts:1585-1629` | Yes — `currentAdmin()` first, team filter applied to the whole array before the first window, then the `listTeamEntriesOverlapping` assembly (`mock.ts:1742-1792`) unchanged |
| § 4.5 AC-1 to AC-9 tests | `tests/cross-team-reads.test.ts:36-55, 57-67, 69-81, 83-98, 100-115, 117-126, 128-150, 152-174, 217-255` | Yes — one describe per AC, driving the mock through `__setCurrentMember`, no fixture added |
| § 4.5 AC-10 and AC-11 held by the existing suite, unedited | `tests/seam-parity.test.ts:35-59` | Yes — parity iterates the seam's own keys, so the three new exports are covered without an edit. No existing test file appears in `git status --porcelain` |

**AC-12's one shape worth checking, and it holds.** `.rpc(fn, args, { count: "exact" })` sets
`Prefer: count=exact` (`postgrest-js/dist/index.cjs:3859`); the chained `.select(columns)` on the
returned filter builder **appends** `Prefer: return=representation` rather than replacing it
(`index.cjs:678-688`, via `headers.append`). The exact count therefore survives the chain, so the
completeness comparison at `supabase.ts:1615-1621` is fed a real number rather than a null. Against a
running PostgreSQL this is still unverified, exactly as `01-plan.md` § Out-of-scope 9 states.

## R6 detail

Plan § 3 puts the whole control in the datastore function bodies and says *the seam checks nothing*.
That is what is implemented.

| Plan § 3 row | Held by | Citation |
|---|---|---|
| Another team's entries and roster: member denied, manager denied, admin allowed | `public.is_admin((select auth.uid()))` as the **first** predicate of each of the three functions | `…cal11_cross_team_reads.sql:38`, `:50`, `:62` |
| Own team through the **new** reads: member denied, manager denied | The same predicate — the functions branch on role, never on whose team it is. Asserted for the caller's own team id, not only another's | `tests/cross-team-reads.test.ts:120-124` (member), `:138-142` (manager) |
| A removed caller denied | `is_admin`'s own `removed_at is null` | `supabase/migrations/20260831150024_tea01_membership.sql:54-62`; mock twin `currentAdmin()` at `src/lib/data/mock.ts:323-326`; asserted at `tests/cross-team-reads.test.ts:160-165` |
| `anon` refused before the body runs | `revoke all … from public` then `grant execute … to authenticated` | `…cal11_cross_team_reads.sql:67-73`, asserted statement-by-statement at `tests/cross-team-reads.test.ts:237-248` |
| Empty, never an error, for every denial | Both implementations return an empty array; neither rejects | `src/lib/data/mock.ts:1536`, `:1559`, `:1586`; asserted at `tests/cross-team-reads.test.ts:117-174` |
| Own team through the **existing** reads: unchanged | The diff is purely additive — no hunk touches `listMembers`, `listTeamEntries` or `listTeamEntriesOverlapping` in either implementation, and none gains a parameter | `git diff src/lib/data/mock.ts` and `src/lib/data/supabase.ts`; arity held by `tests/seam-parity.test.ts:45-59` |
| Any write on another team denied — not added | No write method is added; the diff's only seam additions are the three reads | `src/lib/data/index.ts:696-732` |

**The mock reproduces the policy rather than the screen**, which is what makes AC-6 to AC-8 mean
anything: were the mock to skip the role test, those three describes would pass against a SQL
function that had forgotten its first line.

## R7 detail

One row per ID in `invariants_touched` (`ticket.yaml:20`).

| Invariant | Held by | Citation |
|---|---|---|
| **INV-04** — one definition of the absence count | **Uniqueness: held.** No arithmetic enters either implementation; the cross-team path is given to the single `absenceCountsFor` and to no other. **The removed-member condition: knowingly NOT held — an accepted deviation under ADR-042, not a claim of satisfaction.** See below | Uniqueness: `src/lib/data/absence.ts:197` is the only definition, called both ways at `tests/cross-team-reads.test.ts:105` and `:110`, the two maps asserted equal and non-trivial at `:112-113`. Roster carries removed members with `removedAt` (`src/lib/data/mock.ts:1539`, asserted at `tests/cross-team-reads.test.ts:42-44`); the overlapping read applies no status filter (`…cal11_cross_team_reads.sql:60-64`) |
| **INV-05** — a tentative entry counts exactly as a non-tentative one | **Held.** Both entry functions carry the whole row with no tentative predicate, in SQL and in the mock alike. AC-3 and AC-4 compare every field against the own-team read, so a dropped field or a filtered tentative row fails them | `…cal11_cross_team_reads.sql:48-51` and `:60-64` (no status or tentative clause); `src/lib/data/mock.ts:1564` and `:1592` (team and date predicates only); `tests/cross-team-reads.test.ts:77` and `:91` (deep equality over whole rows) |
| **INV-07** — an entry counts only against its member's current team | **Held.** Both entry predicates are `member_team_id(e.member_id) = p_team_id` — the member's team **now**, resolved through the member row, never a team stored on the entry (there is none to store). The mock uses `sameTeam(...)` rather than `===` so that a null team admits nothing, as a null comparison admits nothing in SQL | `…cal11_cross_team_reads.sql:51` and `:63`; `src/lib/data/mock.ts:1564` and `:1592`; `sameTeam` at `src/lib/data/mock.ts:482`; no entry-side team column added — `schema_delta` is functions only (`ticket.yaml:31`) |

### Why INV-04's deviation does not fail this gate

**It is reported, as ADR-042 § Consequences says it must be, and it is not routed.**

The facts are not in dispute and this review does not soften them. `public.member_team_id` answers
null for a removed member (`supabase/migrations/20260831150024_tea01_membership.sql:64-68`), so the
predicate at `…cal11_cross_team_reads.sql:51` and `:63` drops a removed member's entries on **every**
date — including dates before their removal, where INV-04 as fixed by ADR-013 says they still count
(`.ai/registry/invariants.md:118-119`). CAL-11 mirrors a defect that predates it
(`src/lib/data/mock.ts:1402-1405` records the own-team shape as deliberate) because ADR-040's revert
condition is that the two views must not disagree on a number.

That is **the same finding the first REVIEW pass raised under R7**, and it did what RULE-07
(`.ai/registry/rules.md:37`) requires: escalated to a human on first occurrence, never to REWORK.
The human answered. ADR-042 is that answer, `ACCEPTED by the operator` on 2026-09-23, and its
decision 1 is that **CAL-11 ships the parity shape** with no acceptance criterion relaxed or edited.

So the escalation this check exists to produce has already been produced and discharged. Failing R7
a second time would route `next_state: ESCALATED` to a human who has answered this exact question in
the registry, and would make the ticket unshippable in contradiction of the decision that governs it
— which is what RULE-07's *first occurrence* wording forecloses. Per ADR-042 § Consequences this
report cites the ADR as the **accepted deviation**; it does not cite it as INV-04 being held, and
§ *Invariants touched* of `01-plan.md` does not either.

**What remains owed, unchanged by this verdict** — ADR-042 decisions 3, 4 and 5: one ticket that
fixes `entry_select_team` and all three new functions **together**, attributing an entry by the
member's team on the entry's own dates; it carries a schema delta under ADR-014 and needs a feature
row in `.ai/registry/features.md` first, which is human plane under RULE-01.

## Findings

No failing check. Two observations that are not findings against this diff and route nowhere in this
gate:

1. **`src/lib/fixtures.ts:158` and `:206` — `FIXTURE_PENDING_SIGNUP` and `FIXTURE_SECOND_ADMIN` share
   the literal id `88888888-8888-4888-8888-888888888888`.** Verified in the file. `member.id` is the
   primary key in the real schema, so the state is impossible against a running PostgreSQL: it is a
   fixture-authoring defect that predates this ticket. `03-impl-log.md` § *Deviations* 1 reports it
   and works around it correctly — AC-1's negative half is asserted on `status` and `teamId`
   (`tests/cross-team-reads.test.ts:51-53`), which is what AC-1 actually states, rather than on an id
   that would pass or fail on the wrong row. `src/lib/fixtures.ts` is outside `allowed_paths` and
   RULE-03 forbids the edit; a ticket whose `allowed_paths` includes it owes the fix.
2. **`supabase/db.sql` does not carry these three functions**, and does not carry
   `20260911180000_solo_many_teams.sql`'s either. Named out of scope by the plan (§ Out-of-scope 7)
   and correctly left alone; the chore is pre-existing and larger than this ticket.

Neither is a defect in what the Developer wrote, so neither increments `rework_count` and neither
changes the verdict.

## Verdict

**PASS.** All eight checks pass, each citing the implementation. The ticket advances to DONE.

The one thing a reader of this verdict should carry away: **INV-04 is not held for a removed
member's entries, on either side of the seam.** It passes R7 because a human decided it may ship that
way (ADR-042), not because it is satisfied. The debt is recorded in the registry and is owed a ticket
that fixes both sides at once.
