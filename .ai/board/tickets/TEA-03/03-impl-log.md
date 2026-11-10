---
ticket: TEA-03
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-01T01:16:23Z
branch: feat/TEA-03
inputs_read:
  - .ai/board/tickets/TEA-03/02-design.md
  - .ai/board/tickets/TEA-03/01-story.md
  - .ai/board/tickets/TEA-03/ticket.yaml
  - .ai/registry/decisions/ADR-018-who-may-read-the-member-list.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - .ai/standards/git-conventions.md
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/fixtures.ts
  - src/routes/AllowList.tsx
  - src/App.tsx
  - supabase/seed.sql
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260901090000_tea02_allow_list_writes.sql
  - tests/seam-parity.test.ts
  - tests/e2e/tea-01-signup.spec.ts
  - eslint.config.js
  - vite.config.ts
  - playwright.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# TEA-03 — implementation log

## Files touched

Nine files. Two more sit in `allowed_paths` and are deliberately **not** here — see *Open questions*.

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20260901093000_tea03_member_select_team.sql` | created | The whole permission change: one `create policy`, and nothing else. Without it AC-1 to AC-3 are unreachable — `member_select_own` returns the caller their own row and no other. | §4 |
| `supabase/seed.sql` | modified | AC-2 and AC-4 are unobservable against the existing one-team, all-active seed: a one-team fixture passes whether or not the team scope is in the predicate. Adds `team` `Nhóm khác`, a member on it, and a removed member on the first team, each with the `auth.users` row its `member.id` references. | §4.1, §1.5 |
| `src/lib/domain/types.ts` | modified | `ROSTER_LIMIT`, the value AC-8's refusal is measured against. Both implementations need it at runtime and neither may import it from `index.ts` without creating a load-time cycle. | §1.1 |
| `src/lib/data/index.ts` | modified | Declares `listMembers()` on `DataSeam`. This is the contract the parity test compares the two implementations against. | §1.2 |
| `src/lib/data/supabase.ts` | modified | The real read: `MEMBER_COLUMNS`, no team filter, no `removed_at` filter, two `order` keys, `.limit(ROSTER_LIMIT)` and the raise above it. | §1.2, §1.4, §3 |
| `src/lib/data/mock.ts` | modified | The same function reproducing the two POLICIES composing, not the screen — three distinct answers, of which the removed-caller one is the state ADR-018 created on purpose. Also seeds the two new fixture members so AC-2 and AC-4 are observable through the mock. | §1.2, §1.4, §3 |
| `src/lib/fixtures.ts` | modified | `FIXTURE_OTHER_TEAM`, `FIXTURE_OTHER_TEAM_MEMBER`, `FIXTURE_REMOVED_MEMBER` — the same literals the seed inserts, in the module the mock and the tests read. | §1.5 |
| `src/routes/MemberList.tsx` | created | The screen: four states, the `removedAt` filter that is AC-4's second half, and every selector in §6. | §1.3 |
| `src/App.tsx` | modified | Routes `/members`. Without it the screen is unreachable and no criterion is exercisable. | §1.3 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §1.1 `ROSTER_LIMIT` | `src/lib/domain/types.ts:111` | Value 500, as designed. Placed beside `AVATAR_CHOICES` in `types.ts` and not in `index.ts`, for the cycle reason §1.1 gives; the comment carries that reason and the cited `TODO(verify):` on the datastore's own cap. |
| §1.1 domain types | — | Nothing added and nothing changed. `Member` already carries `id`, `teamId`, `displayName`, `avatar`, `role`, `removedAt`, `createdAt`; `MemberRole` already has both values; no `FailureCode` added, because this read throws rather than returning a `Result`. |
| §1.2 `listMembers()` — declaration | `src/lib/data/index.ts:114` | No parameter, `Promise<Member[]>`. No existing signature changed, so no existing caller changed. |
| §1.2 `listMembers()` — real | `src/lib/data/supabase.ts:317-345` | No `eq` on `team_id`: the policy is the boundary and a filter here would be a second, weaker copy of it. No `removed_at` filter. |
| §1.2 `listMembers()` — mock | `src/lib/data/mock.ts:257-277` | The three answers of §3's table: `[]` for no member row, `[me]` for a removed caller, the whole team including removed members for an active one. Role is not consulted anywhere in it, which is AC-3 held by construction. |
| §1.3 the screen, four states | `src/routes/MemberList.tsx:20-24`, `:31-53` | `loading` resolves on every path. `me === null` → `notOnATeam` before `listMembers` is ever called; any throw from either call → `unavailable`. |
| §1.3 the `removedAt` filter | `src/routes/MemberList.tsx:107` | In the component and nowhere below it. Commented as a display decision and explicitly **not** as an affordance, per §2. |
| §1.3 role as a label | `src/routes/MemberList.tsx:17-18`, `:156-163` | `Quản trị viên` / `Thành viên`. No control on this screen writes anything. |
| §1.3.1 the error state | `src/routes/MemberList.tsx:86-100` | Present here and absent from `AllowList.tsx`, deliberately: folding a throw into `notOnATeam` would tell a caller who is on a team that they are not, and would render a possibly-truncated roster as a small team. |
| §1.4 ordering | `src/lib/data/supabase.ts:322-323`, `src/lib/data/mock.ts:55-56` | `created_at asc, id asc` in PostgREST; the same two keys in the mock's comparator. The id tiebreaker is load-bearing — three fixtures now share the `2026-08-31T00:00:00+00:00` literal. |
| §1.5 fixtures | `src/lib/fixtures.ts:83-113` | Ids and shapes as designed. `displayName` and `avatar` were not specified for the two new members and are filled from the existing fixtures' pattern; both values are copied identically into the seed. |
| §4 the migration | `supabase/migrations/20260901093000_tea03_member_select_team.sql:34-36` | Exactly the statement ADR-018 fixes. No `drop policy`, no `grant`, no `alter table`, no `removed_at` condition, no write policy. Applying it is human — RULE-09; no agent ran `supabase db push`. |
| §4.1 the seed | `supabase/seed.sql:144-244` | Appended, never interleaved. Insert order `team` → `auth.users` → `member`. Every `auth.users` insert sets the four MD-014 columns to `''`. |

## Deviations from the design

One, and it is a file name.

**The migration is named `20260901093000_tea03_member_select_team.sql`, not the clock's timestamp.**
`supabase migration new` names a file from UTC now, which at the time of this run was
`20260901011319` — *before* `20260901090000_tea02_allow_list_writes.sql`. Migrations apply in
filename order, so the clock-derived name would have placed this policy ahead of TEA-02's, and
`supabase db push` against the project that already has TEA-02 applied refuses a migration that
sorts before the last one on the remote. The timestamp was therefore chosen to sort immediately
after TEA-02's. Nothing about the file's content changed, and §5's *one new file, and the glob is
only because the generator picks the timestamp* still describes what is here.

Everything else is as specified. `tests/seam-parity.test.ts` was not edited and passes unedited with
the new function present, which is the whole of its value. `src/routes/AllowList.tsx` was not
touched, so its `allow-list-row-added-by` cell still renders a raw member id — §7 rejects resolving
it here as scope.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-07` — one member, one team | The team boundary is one predicate, `team_id = public.member_team_id((select auth.uid()))`, and nothing above it filters by team: `listMembers` sends no `eq` on `team_id` and takes no `teamId` parameter, so there is no value any client this repository builds could pass that would reach another team's rows. The mock reproduces the same single condition at `src/lib/data/mock.ts:263`. The seeded second team is what makes the criterion observable at all — a one-team fixture passes whether the predicate scopes or not, which is why ADR-018's revert condition names this seed data. |
| `INV-04` — one definition of the absence count | This ticket computes no count, and that is deliberate: putting arithmetic over the roster here would create the second definition INV-04 forbids. What it owes INV-04 is the roster's *shape*, and both threats to it were built against rather than around. The read returns removed members carrying `removedAt` — no `removed_at` condition in the policy, none in either implementation — so the counting function can still be *given* membership-as-of-a-date, which ADR-013 requires because it cannot derive it from the entries. And a possibly-truncated roster raises instead of returning, in both implementations, because the roster is INV-04's denominator and a short one raises the ratio on every date. The only `removedAt` filter in the change is at `src/routes/MemberList.tsx:107`, above the seam, where it decides what is drawn and not what is read. |

## Verification run

Commands actually executed, with exit codes.

| Command | Exit | Notes |
|---------|------|-------|
| typecheck — `pnpm exec tsc --noEmit` | 0 | |
| lint — `pnpm exec eslint .` | 0 | Includes the RULE-02 `no-restricted-imports` rule; `MemberList.tsx` reaches the datastore only through `@/lib/data`. |
| unit — `pnpm exec vitest run` | 0 | 1 file, 2 tests. `tests/seam-parity.test.ts` passes with `listMembers` present in both implementations and the file unedited. |
| end-to-end — `pnpm exec playwright test` | **1** | 4 passed, 6 failed. **Every failure is pre-existing and none is in this ticket's files** — see below. |
| `git diff --name-only` subset of `allowed_paths` | yes | Nine files, all listed in `ticket.yaml`. `node scripts/check-allowed-paths.mjs` → PASS. |

### The six end-to-end failures, and why they are not this ticket's

They are the whole of `tests/e2e/tea-01-signup.spec.ts` that depends on the mock seam, and the first
of them is that suite's own guard: *"6.2: this run drives the in-memory seam, and the page says so"*
fails because `seam-banner` is absent. `.env` now carries `VITE_SUPABASE_URL` — the Supabase project
that did not exist when TEA-02 was designed — so `src/lib/data/index.ts` resolves the build to the
**real** seam, and TEA-01's sign-up tests then run against a datastore whose `Confirm email` setting
and network they were never written for.

**Measured, not assumed.** The same command was run against the tree with this ticket's changes
stashed (`git stash push --include-untracked -- src supabase`): 4 passed, 6 failed, the same six
test names. The two runs are identical. The failure predates this ticket and is a consequence of the
project being provisioned, which 02-design.md §5 *Prerequisites* records as new since TEA-02.

It is out of `allowed_paths` in either direction — the fix is either `tests/e2e/tea-01-signup.spec.ts`
or the environment the end-to-end command runs in, and neither is this ticket's file. Recorded here
so the reviewer does not spend a cycle rediscovering it, and raised in *Open questions* below.

### What was verified about this ticket's screen, since no test covers it

No end-to-end spec for TEA-03 exists — RULE-05 gives it to QA, and ADR-017 means nobody is
dispatched. Rather than ship an unrun screen, `/members` was built with `VITE_DATA_SEAM=mock` and
driven headless once. Observed: `seam-banner` present, `member-list-table` present, exactly two
`member-list-row` elements, no page errors, and no `member-list-loading`, `member-list-not-on-a-team`,
`member-list-unavailable` or `member-list-empty` on the page. The two rows were
`22222222-…` (`data-role="admin"`) then `55555555-…` (`data-role="member"`) — `createdAt`, then id
ascending, which is §1.4.

`66666666-…`, the other team's member, was **absent** — AC-2 through the mock's single team
condition. `77777777-…`, the removed member, was **absent from the screen** — AC-4's second half.
**AC-4's first half is not proven by that observation**: a read that dropped the removed row and a
read that returned it for the component to filter produce the same DOM. It is held at
`src/lib/data/mock.ts:262-264` and `src/lib/data/supabase.ts:317-325`, where no `removedAt` condition
appears, and asserting it is the *"the read returns removed members"* row of §6.3.

That run used no file under `tests/` and left nothing behind.

## Testability contract

Every selector in 02-design.md §6, with the file and line where it now exists. QA never reads this
source (RULE-05), so a selector renamed in passing breaks the QA gate with no way to discover why.

| selector | Exists at |
|----------|-----------|
| `app-root` | `src/App.tsx:15` — already existed, unchanged |
| `seam-banner` | `src/App.tsx:23` — already existed, unchanged |
| `member-list-loading` | `src/routes/MemberList.tsx:61` |
| `member-list-not-on-a-team` | `src/routes/MemberList.tsx:73` |
| `member-list-unavailable` | `src/routes/MemberList.tsx:88` |
| `member-list-table` | `src/routes/MemberList.tsx:126` |
| `member-list-row` | `src/routes/MemberList.tsx:142` — carries `data-member-id` (`:143`) and `data-role` (`:144`) |
| `member-list-row-avatar` | `src/routes/MemberList.tsx:147` |
| `member-list-row-name` | `src/routes/MemberList.tsx:150` |
| `member-list-row-role` | `src/routes/MemberList.tsx:158` |
| `member-list-empty` | `src/routes/MemberList.tsx:120` |

The route is `/members`, registered at `src/App.tsx:43`.

## Open questions

Three, none blocking, all cheaper here than as a rework cycle.

**1. `tests/permission-model.test.ts` and `tests/e2e/tea-03-member-list.spec.ts` are in
`allowed_paths` and were deliberately not written.** 02-design.md §6.4 is explicit: RULE-05 exists
because a test written by the author of the implementation agrees with the implementation, including
where it is wrong, and the fix for a waived gate is not to quietly re-home the work it was skipping.
`allowed_paths` is what lets `/qa` write into this ticket's scope; it is not an instruction to this
agent. Under ADR-017 the loop runs `REVIEW -> DONE` and nobody is dispatched, so these two files
come to exist only if the operator invokes `/qa` by hand. §6 is complete and independent, so that
can happen at any point, before or after this ticket ships. Eight of the ten assertions §6.3 lists —
including AC-5, AC-6 and AC-8, which have no interface at all — exist nowhere else.

**2. `FIXTURE_MEMBER` is in `src/lib/fixtures.ts` and is not in `supabase/seed.sql`, and this ticket
did not add it.** Both files open by saying every literal in one appears in the other; that pair is
currently broken in one direction, from TEA-02. It matters because §6.3 needs *a token per role*
against a real database, and the member-role account it would sign in as has no `auth.users` row and
no `member` row to sign in to — so the AC-3 assertion (*an admin reads exactly the same row ids and
columns as a member*) has nobody to be the member. It was not fixed here because 02-design.md §4.1
enumerates exactly three seed rows and none of them is this one, and adding a fourth account to a
seed a human applies is a decision rather than a typo. It costs one `auth.users` insert plus one
`member` insert, both in this ticket's `allowed_paths`, and it blocks nothing until `/qa` runs.

**3. The end-to-end command exits 1 on `main` as well as here**, for the reason measured above: `.env`
now resolves the build to the real seam and TEA-01's sign-up suite was written against the mock. The
Definition of Done's end-to-end item is suspended under ADR-017, so nothing gates on it today — but
the next ticket to look at that command will find it red and will not know it was red before it
arrived, which is why it is written down rather than left in a terminal.
