---
ticket: MIR-02
stage: IN_PROGRESS
agent: developer
produced_at: 2026-10-20T06:56:56+00:00
inputs_read:
  - .ai/board/tickets/MIR-02/01-plan.md
  - .ai/board/tickets/MIR-02/ticket.yaml
  - .ai/registry/decisions/ADR-064-a-person-cannot-change-their-own-role-status-or-team.md
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - supabase/migrations/20260910093000_solo_profile_self_update.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/fixtures.ts
  - tests/cross-team-role.test.ts
  - tests/cross-team-reads.test.ts
  - tests/profile-writes.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-02 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261020120000_mir02_member_self_writes.sql` | created | the trigger self clause, the revoke, `reject_member`, `set_member_team` and their execute grants | § 4.1 (a)–(e) |
| `supabase/migrations/20260910093000_solo_profile_self_update.sql` | modified | the dated correction below the stale paragraph at lines 13-17; comment lines only | § 4.2 |
| `src/lib/data/supabase.ts` | modified | the reject branch of `decideMember` and `setMemberTeam` move from table updates to the two new RPCs, because the revoke refuses the old writes; comments made true | § 4.3 |
| `src/lib/data/mock.ts` | modified | `moveMember` refuses the caller's own id; the refusal sentences of `decideMember` and `setMemberTeam` aligned to the real seam's (see *Deviations*) | § 4.4 |
| `src/lib/data/index.ts` | modified | doc comments on `decideMember`, `setMemberTeam`, `moveMember` name the new control; no signature change | § 4.5 |
| `tests/member-self-writes.test.ts` | created | the ten `it`s of the § 4.6 table, names as written | § 4.6 |
| `.ai/board/tickets/MIR-02/verification.md` | created | manual steps for the reproduction and AC-1–AC-6, AC-8, AC-10; results left for the operator | § 4.7 |
| `.ai/board/tickets/MIR-02/03-impl-log.md` | created | this log | gate |

`.ai/registry/decisions/ADR-064-…md` is in `allowed_paths` and was not touched; nothing in § 4 asks
for a change to it.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 (a) trigger, self clause first | `20261020120000_mir02_member_self_writes.sql:45-151`, clause at `:61-67` | rest of the body is `20260910093000_solo_profile_self_update.sql:117-204` byte for byte — checked with `diff`, the only hunk is the inserted clause and its comment |
| 4.1 (b) revoke | `…mir02_member_self_writes.sql:163` | |
| 4.1 (c) `reject_member` | `…mir02_member_self_writes.sql:172-188` | body as the plan, verbatim |
| 4.1 (d) `set_member_team` | `…mir02_member_self_writes.sql:201-224` | body as the plan, verbatim |
| 4.1 (e) execute grants | `…mir02_member_self_writes.sql:232-235` | |
| 4.1 header | `…mir02_member_self_writes.sql:1-31` | cites ADR-064 and the plan; quotes and supersedes *"Moving an admin — the caller included — is allowed"*; `begin; … commit;` |
| 4.2 comment correction | `20260910093000_solo_profile_self_update.sql:18-22` | `git diff` of the file contains only added `--` lines |
| 4.3 `decideMember` reject | `src/lib/data/supabase.ts:1691-1698` | `toTeamFailure(error, "That sign-up could not be decided. It may already have been.")`; approve branch unchanged |
| 4.3 `setMemberTeam` | `src/lib/data/supabase.ts:1819-1830` | `toTeamFailure(error, "That member could not be moved.")`; `!isMemberRow(data)` → `unknown` |
| 4.3 comments | `supabase.ts` doc on `decideMember`, the `setMemberTeam` comment, `updateOwnProfile` at `:1858-1862` | |
| 4.4 mock `moveMember` | `src/lib/data/mock.ts:2568` | checked before the team and target checks |
| 4.5 interface docs | `src/lib/data/index.ts:351`, `:477`, `:867` | no type or export change; seam parity passes |
| 4.6 tests | `tests/member-self-writes.test.ts` | 10 tests, all pass |
| 4.7 verification | `.ai/board/tickets/MIR-02/verification.md` | |

## Deviations from the design

**One, in the mock: the refusal sentences of `decideMember` and `setMemberTeam`.** § 4.4 says those
two "keep their behaviour". AC-9 and AC-10, and the § 4.6 test *"rejecting somebody already decided
is refused, with the shipped sentence"*, require the sentences *"That sign-up could not be decided.
It may already have been."* and *"That member could not be moved."* — which the real seam shows, but
the mock did not: it said *"Only an admin can decide a sign-up."* / *"That sign-up is not waiting
for a decision."* and *"Only an admin can move a member."* / *"An admin can only move somebody to
their own team."* / *"That member is not on your team."*. The test cannot pass against the mock as it
stood. I changed **only the message strings** (`mock.ts:545-546`, `:1669`, `:1674`, `:1792-1795`) and
kept every condition — who is refused and when is identical. No shipped test asserted the old
strings (`grep -rn` over `tests/` and `src/`). Not consulted: the ACs are explicit about the
sentence, and the alternative — weakening the tests to the code only — narrows an AC.

`"That team does not exist."` in the approve branch of the mock's `decideMember` was left as it is;
no AC in this plan covers it.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-07` | `team_id` decides which team a member's entries are counted against. After this change no token can write it through the table (revoke, `:163`), and no token can change its *own* `team_id` through any path (trigger clause, `:61-67`), so a person cannot move their own history into another team's counts. The two remaining writers are `move_member` (unchanged, other people only) and `set_member_team`, which writes the value the row already holds — both sides are pinned to `member_team_id(auth.uid())`. |
| `INV-04` | The denominator is the team's members as of the date. Membership of that set changes only through `status` and `team_id`, now writable only by the definer functions with their bounds, and never by the person themselves. `removed_at`, which INV-04's note defines the denominator against, keeps its grant and its trigger clauses unchanged. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 46 files, 884 tests, all pass (the standard's recorded 37/710 is older) |
| `pnpm exec vitest run tests/member-self-writes.test.ts` with the `mock.ts:2568` line removed | 1 | 3 fail, starting with *"an admin cannot move themselves to another team"* — the test bites; line restored |
| `diff` of the trigger body vs `20260910093000_solo_profile_self_update.sql:117-204` | — | one hunk, the inserted clause only |
| `git diff --name-only` + untracked ⊆ `allowed_paths` | yes | seven paths, all listed in `ticket.yaml` |

**Not run, and not runnable by an agent:** the migration against a database, and the part 1
reproduction. Both are the operator's, in `verification.md` (RULE-09; plan:81).

## Testability contract

None — plan § 4 *Selectors*: no selector added or changed.

## Open questions

- **`FIXTURE_SECOND_ADMIN` and `FIXTURE_PENDING_SIGNUP` share the id `88888888-8888-4888-8888-888888888888`**
  (`src/lib/fixtures.ts`). Found while writing the tests, outside this ticket's scope and its paths.
  The new tests do not depend on it — the mock's `find`s are filtered by status and team — but a
  reviewer reading the reject tests may wonder. Worth a BUG ticket.
- `.ai/standards/rbac-and-security.md` gap A2 and the two permission rows ADR-064 names stay for a
  human (plan § 1 *Out of scope*).
