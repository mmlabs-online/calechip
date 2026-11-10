---
ticket: TEA-02
stage: IN_PROGRESS
agent: developer
produced_at: 2026-08-31T17:26:08Z
branch: feat/TEA-02
inputs_read:
  - .ai/board/tickets/TEA-02/02-design.md
  - .ai/board/tickets/TEA-02/01-story.md
  - .ai/board/tickets/TEA-02/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/coding-standards.md
  - .ai/standards/ui-design-system.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/seed.sql
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/App.tsx
  - src/routes/SignUp.tsx
  - tests/seam-parity.test.ts
  - eslint.config.js
  - vite.config.ts
  - tsconfig.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# TEA-02 — Manage the allow-list — implementation log

Nine files: the migration and the seed, the four seam and type files, the fixtures, the new screen,
and one route line. Design section 6's two test files are deliberately **not** among them — see
*Open questions*, item 1.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/domain/types.ts` | modified | `AllowedEmail` and `AllowedEmailState` did not exist, and the three expected failures of this ticket had no `FailureCode` to be returned as | §1.1 |
| `src/lib/data/index.ts` | modified | the seam declared no way to ask who is calling and no allow-list function at all; four signatures added, none of the existing three touched | §1.2 |
| `src/lib/data/mock.ts` | modified | the four functions, reproducing the **policy's** refusals, plus the `__setCurrentMember` hook a test needs to become a member-role member | §1.2, §1.4, §3 |
| `src/lib/data/supabase.ts` | modified | the same four against PostgREST, including the follow-up read that tells AC-7's refusal apart from AC-4's | §1.2, §3 |
| `src/lib/fixtures.ts` | modified | `FIXTURE_MEMBER` so AC-8's denials have somebody to be denied as, and `FIXTURE_OTHER_TEAM_ID` so "another team" is a real id for AC-4 | §1.5 |
| `src/routes/AllowList.tsx` | created | the screen: the four states, the add form, the row table and the destructive-action confirmation | §1.3, §2, §6 |
| `src/App.tsx` | modified | `/allow-list` had no route, so the screen was unreachable and the catch-all sent it to `/signup` | §1.3 |
| `supabase/migrations/20260901090000_tea02_allow_list_writes.sql` | created | every write in this ticket is denied today — TEA-01 granted `select` only and added no insert or delete policy | §4.1 |
| `supabase/seed.sql` | modified | the seed had no member-role member, so the denial half of AC-8 had no token to run as | §4.2 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §1.1 `AllowedEmail` | `src/lib/domain/types.ts:54` | field names and types exactly as written in the design |
| §1.1 `AllowedEmailState` | `src/lib/domain/types.ts:63` | derived by `stateOf` at `src/routes/AllowList.tsx:23`, never stored |
| §1.1 three `FailureCode` members | `src/lib/domain/types.ts:41-43` | added to the existing union; the six TEA-01 members are untouched |
| §1.2 `AddAllowedEmailInput` | `src/lib/data/index.ts:22` | one field, `email`. No `teamId`, by §1.2's own reasoning |
| §1.2 `getCurrentMember()` | `index.ts:67`, `mock.ts:141`, `supabase.ts:212` | real one folds `AuthSessionMissingError` into the same null as "no member row" |
| §1.2 `listAllowedEmails()` | `index.ts:74`, `mock.ts:147`, `supabase.ts:219` | no team parameter; `order("added_at", { ascending: false })` |
| §1.2 `addAllowedEmail(input)` | `index.ts:80`, `mock.ts:161`, `supabase.ts:235` | `team_id` and `added_by` read from the caller's own row, never from a parameter |
| §1.2 `removeAllowedEmail(email)` | `index.ts:83`, `mock.ts:192`, `supabase.ts:264` | zero rows deleted is a refusal, not success — §3 shape 1 |
| §1.3 the screen, four states | `src/routes/AllowList.tsx:117-310` | loading 118, refused 130, empty 194, list 200 |
| §1.4 `__setCurrentMember` | `src/lib/data/mock.ts:64` | named export beside `seam`; parity compares the keys of `seam` and is unaffected — verified, `vitest run` passes unedited |
| §1.5 `FIXTURE_MEMBER` | `src/lib/fixtures.ts:58` | **id deviates** — see *Deviations* |
| §1.5 `FIXTURE_OTHER_TEAM_ID` | `src/lib/fixtures.ts:69` | literal as designed |
| §2 both policy bounds | migration lines 26-33 (insert), 41-48 (delete) | own team on both; `consumed_at is null` on the delete |
| §2 affordances | `AllowList.tsx:130` (refused), `:244` (no remove control on a `joined` row), `App.tsx:37` (no navigation to it) | each carries a comment saying it enforces nothing |
| §3 shape 1, zero rows ≠ success | `supabase.ts:264-310`, `mock.ts:192-210` | one follow-up read distinguishes `already_consumed` from `not_permitted` |
| §3 shape 2, team from the datastore | `supabase.ts:235-247`, `mock.ts:161-190` | neither implementation reads a caller-supplied team |
| §4.1 the migration | `supabase/migrations/20260901090000_tea02_allow_list_writes.sql` | two policies, two grants, no `alter table`, no third helper |
| §4.2 the seed | `supabase/seed.sql:163-211` | same literals as `FIXTURE_MEMBER`, appended in the existing insert order |

## Deviations from the design

**One, and it is a single uuid literal.**

§1.5 names `33333333-3333-4333-8333-333333333333` as `FIXTURE_MEMBER.id`. Between the design being
written (2026-08-31T17:14Z) and this stage running, an operator-added admin account took that exact
literal in `supabase/seed.sql` — the block commented *"Operator's own admin account, added 2026-09-01
on direct instruction."* Reusing it would have made this ticket's seed block hit
`on conflict (id) do nothing` and insert nothing, leaving the member-role member absent: the precise
gap §4.2 exists to close, arriving silently and passing every check.

`FIXTURE_MEMBER.id` is therefore `55555555-5555-4555-8555-555555555555`. Everything else in §1.5 —
the name, the type, the location, the other five fields, `FIXTURE_OTHER_TEAM_ID` — is unchanged. The
reason is written at `src/lib/fixtures.ts:52-56` and again in the seed at `supabase/seed.sql:177-179`,
so a reader hitting either copy finds it without this file.

Not routed to `tech-lead-design` as a consultation: the design chose the literal arbitrarily and
states no property of it, so there is no decision to reopen — only a collision that did not exist
when it was chosen.

**Second-order, and NOT a deviation, recorded so the reviewer does not have to work it out:**
`src/lib/data/mock.ts:21` replaces the local `AllowedEmailRow` interface with
`type AllowedEmailRow = AllowedEmail`. §1.1 promotes that row shape to a domain type, so the local
declaration became a structurally identical second copy. The alias keeps the name the rest of the
file already used; no line that reads or writes a row changed.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-07` | A member belongs to exactly one team, and this ticket is where that team is fixed. `allowed_email.team_id` is set from `public.member_team_id(auth.uid())` and from nothing else: neither seam implementation accepts a team parameter (`AddAllowedEmailInput` has one field), and `allowed_email_insert_admin`'s `with check` re-derives the value and refuses a mismatch, so a raw token cannot supply one either. The admission trigger `admit_allow_listed_member` then copies that single value onto the `member` row — TEA-01's `returning a.team_id into v_team_id`, unchanged here. One entry carries one team, so one member reaches one team. Nothing in this ticket writes `member.team_id`, and `member` still has no insert policy. |
| `INV-04` | Deliberately not in `invariants_touched`, and the reasoning is the story's: an allow-list entry is not a member row, so the denominator moves when the person signs up and is admitted, not when the address is added. Nothing here creates, removes or soft-deletes a member. Restated so R8 does not re-derive it. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | the typecheck command in `.ai/standards/testing-standards.md` |
| `pnpm exec eslint .` | 0 | the lint command in the same table; no suppression added anywhere, and no `@supabase/*` import outside the seam |
| `pnpm exec vitest run` | 0 | 1 file, 2 tests. `tests/seam-parity.test.ts` passes **unedited** with four functions added — which is the whole of its value, and why it is absent from `allowed_paths` |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `git diff --name-only` subset of `allowed_paths` | yes | nine files, every one matched by a glob in §5 |

**The seam behaviour was also exercised directly** against the mock, outside the suite, in a
throwaway script since deleted — the ten calls that map to AC-1 through AC-8, with the results read
rather than assumed. It is recorded as a fact about what ran, not as coverage: the tests that count
belong to QA.

- AC-1: an admin gets both seeded entries, one `open` and one `joined`; a member gets `[]`.
- AC-2: `Moi@Example.COM ` (padded, mixed case) is stored folded, with the caller's team and id.
- AC-5: the same address in another casing, and a re-add of `An@Example.COM`, both return
  `already_allow_listed`.
- AC-6: the unconsumed entry is removed and is gone from the next list.
- AC-7: removing `binh@example.com` returns `already_consumed` and the row remains.
- AC-8: as `FIXTURE_MEMBER`, the list is empty and both writes return `not_permitted`.
- No session: `getCurrentMember()` is `null`, which is the `allow-list-refused` path.

**Nothing was applied to a database.** RULE-09 — the migration and the seed are written, not run, and
no Supabase project is provisioned (§5, *Prerequisites*). The policy assertions are therefore
unexecuted, which is what `tests/permission-model.test.ts` exists to change and why §6.3 is QA's.

## Testability contract

Every selector in design section 6. `app-root` and `seam-banner` already existed and are unchanged.

| selector | Exists at |
|----------|-----------|
| `app-root` | `src/App.tsx:14` |
| `seam-banner` | `src/App.tsx:22` |
| `allow-list-loading` | `src/routes/AllowList.tsx:118` |
| `allow-list-refused` | `src/routes/AllowList.tsx:130` |
| `allow-list-empty` | `src/routes/AllowList.tsx:194` |
| `allow-list-table` | `src/routes/AllowList.tsx:200` |
| `allow-list-row` | `src/routes/AllowList.tsx:215` |
| `allow-list-row-state` | `src/routes/AllowList.tsx:223` |
| `allow-list-row-added-by` | `src/routes/AllowList.tsx:236` |
| `allow-list-row-remove` | `src/routes/AllowList.tsx:244` |
| `allow-list-add-email` | `src/routes/AllowList.tsx:167` |
| `allow-list-add-submit` | `src/routes/AllowList.tsx:183` |
| `allow-list-add-error` | `src/routes/AllowList.tsx:177` |
| `allow-list-remove-confirm` | `src/routes/AllowList.tsx:268` |
| `allow-list-remove-confirm-accept` | `src/routes/AllowList.tsx:287` |
| `allow-list-remove-confirm-cancel` | `src/routes/AllowList.tsx:296` |
| `allow-list-no-email-notice` | `src/routes/AllowList.tsx:151` |

`allow-list-row`, `allow-list-row-state`, `allow-list-row-added-by` and `allow-list-row-remove`
appear once per entry and are addressed by the row's `data-email`, as §6 says. `data-state` on the
row carries `open` or `joined`.

The screen is at **`/allow-list`** and nothing links to it. QA navigates by address.

## Open questions

1. **The two test files in `allowed_paths` are untouched, on purpose.**
   `tests/permission-model.test.ts` and `tests/e2e/tea-02-allow-list.spec.ts` are unwritten. §6.3
   specifies the first one — every assertion, both directions — and §6 is the *Testability contract*,
   which RULE-05 makes QA's channel and QA's alone. A Developer writing the tests QA is dispatched to
   write from the same section would produce tests derived from this implementation, which is the one
   thing that section exists to prevent. Both files stay in `allowed_paths` because QA works inside
   the same list. **If the reviewer reads §6.3's "this ticket writes it" as naming this stage rather
   than this ticket, that is a rework item and a cheap one** — the file is new and nothing else moves.

2. **`tests/permission-model.test.ts` cannot run anywhere yet.** It needs a real PostgreSQL with a
   token per role, and no Supabase project is provisioned. Whoever writes it inherits the question of
   what the suite does when there is no database — and `.ai/standards/testing-standards.md` forbids a
   skipped test in the suite, so "guard it on an environment variable" is not obviously available.
   Flagged here because it lands on QA with no warning otherwise.

3. **A transport failure renders `allow-list-refused`.** §1.3 gives this screen four states and no
   error state, so a throw from the seam — the one `SignUp.tsx` already had to catch, the Supabase
   client raising on an unusable configuration — has to land on one of them. It lands on `refused`,
   which fails closed. It is not a true sentence about permission. The comment at
   `src/routes/AllowList.tsx:56-62` says so, and an error state is the honest fix whenever a second
   screen needs one.

4. **`allow-list-row-added-by` renders a uuid for anyone but the caller.** `addedBy` is a member id
   and no seam function turns one into a display name — the member list is TEA-03. The screen
   resolves the caller's own id to "Bạn" and shows the raw id otherwise. §6 asks for "who added the
   entry, and when", and this is the most that is true without inventing a seam function.

5. **A remove failure has no selector in §6.** The dialog stays open and the sentence renders inside
   `allow-list-remove-confirm` with `role="alert"`, so QA can reach it through the dialog. No new
   `data-testid` was invented — RULE-05 makes §6 the contract, and widening it is not this stage's
   call. Reachable only if a row changes underneath the screen, since AC-7's rows render no remove
   control at all.

6. **The operator's seeded admin stores its avatar as the six characters `\u2b50`.**
   `supabase/seed.sql:126` passes `'⭐'` as a plain SQL text literal, where that escape is not
   interpreted — unlike line 115, where it sits inside a `jsonb` literal and is. That row is not
   TEA-02's and was not touched. It is named here because this ticket is the first thing that will
   render a `member.avatar` from the seed on a screen, so it would otherwise surface as a UI defect
   at QA. The fix is `'⭐'` in place of `'\u2b50'`, and it belongs to whoever added the block.
