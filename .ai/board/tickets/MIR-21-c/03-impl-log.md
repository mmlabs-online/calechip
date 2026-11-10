---
ticket: MIR-21-c
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-06T10:21:35+07:00
inputs_read:
  - .ai/board/tickets/MIR-21-c/01-plan.md
  - .ai/board/tickets/MIR-21-c/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/templates/impl-log.md
  - supabase/migrations/20260913090000_solo_avatar_images.sql
  - supabase/migrations/20261020120000_mir02_member_self_writes.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261105150000_mir21_reads_off_member_team_id.sql
  - supabase/migrations/20261105210000_mir21b_writers_write_membership.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/230-writers-write-membership.test.sql
  - src/lib/data/supabase.ts
  - tests/roster-excludes-signups.test.ts
  - node_modules/.pnpm/@supabase+postgrest-js@2.112.4/node_modules/@supabase/postgrest-js/dist/index.mjs
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-21-c — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261106130000_mir21c_membership_self_lock.sql` | created | The self lock on `membership`, and the sign-up trigger without the team column | § 4.1 |
| `src/lib/data/supabase.ts` | modified | Three RPC calls read `team_id` through `roster_team_id`, so the column can go stale in MIR-21-d | § 4.2 |
| `tests/member-rpc-roster-team.test.ts` | created | Source-text test pinning the three calls and `MEMBER_COLUMNS` (AC-7) | § 4.3 |
| `supabase/tests/250-membership-self-lock.test.sql` | created | pgTAP for AC-1 to AC-6 and AC-8, 38 assertions | § 4.4 |
| `.ai/board/tickets/MIR-21-c/03-impl-log.md` | created | This log | gate |
| `.ai/board/tickets/MIR-21-c/ticket.yaml` | modified | `state: REVIEW` | gate |

The eight board and registry paths in `allowed_paths` were written at PLAN and are not touched here
(01-plan.md § 7).

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 lock function | `supabase/migrations/20261106130000_mir21c_membership_self_lock.sql:33` | Body as § 4.1, character for character; revoke from `public, anon, authenticated` |
| 4.1 trigger | `…_mir21c_membership_self_lock.sql:61-64` | `drop trigger if exists` then `before insert or update or delete … for each row` |
| 4.1 sign-up trigger | `…_mir21c_membership_self_lock.sql:74-107` | Copied from `20260913090000_solo_avatar_images.sql:46-81`; insert names `(id, display_name, avatar, role)` at :91, the `null` value is gone, the comment line reworded to cite ADR-080 so no `team_id` token is left in `prosrc` (AC-8) |
| 4.2 `setRankThroughRpc` | `src/lib/data/supabase.ts:1218-1221` | `.rpc(…).select(MEMBER_COLUMNS).single<MemberRow>()`, ADR-080 comment above |
| 4.2 `setMemberTeam` | `src/lib/data/supabase.ts:1846-1849` | Same |
| 4.2 `promoteMember` | `src/lib/data/supabase.ts:1864-1867` | Same |
| 4.3 unit test | `tests/member-rpc-roster-team.test.ts` | One `it` per RPC name, one for `MEMBER_COLUMNS` |
| 4.4 pgTAP | `supabase/tests/250-membership-self-lock.test.sql` | AC-1 :57, AC-2 :87, AC-3 :120, AC-4 :167, AC-5 :185, AC-6 :213, AC-8 :232 |

**§ 4.2 TODO(verify), resolved as far as the repository allows.** The installed
`@supabase/postgrest-js` is 2.112.4. `select(columns)` (dist/index.mjs:676) and `single()` (:1161,
sets `Accept: application/vnd.pgrst.object+json`) are on the transform builder that `rpc()` returns,
and `tsc --noEmit` accepts the chain. The computed field over a non-`setof` function's result is
proven in SQL by `250` AC-6 (`select public.roster_team_id(r) from public.set_member_role(…) r`
returns T1 for a row with no column value). It was not exercised over PostgREST HTTP: that needs a
signed-in JWT against the local API, which no test in this repository drives.

## Delegated decisions

- **AC-5's trigger-definition check is token by token, not one ordered string.** Postgres prints the
  events as `INSERT OR DELETE OR UPDATE`, not the order the migration writes. AC-5 asks that the
  definition *contains* each of `BEFORE`, `INSERT`, `UPDATE`, `DELETE` and `FOR EACH ROW`, so one
  `matches` with five lookaheads does exactly that and keeps the plan count at 38.
- **"Claims name P" is a local helper `tests.m21c_claims(uuid)`**, the `set_config` call § 4.4 names,
  so the role stays the table owner.

## Deviations from the design

none

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The trigger only refuses; it never changes `joined_at` or `left_at`. AC-3 shows the move closes M's T1 row and opens T2, and the removal closes W's rows at `greatest(removed_at, joined_at)`, exactly as `230` AC-8 did before. Self-removal is refused earlier by `member_enforce_role_and_removal` (`mir02` clause "an admin may not remove themselves"), before the mirror's removal close runs, so the new lock never meets it. |
| `INV-07` | The set of active rows changes only by writes the trigger lets through: everything except a write to the caller's own rows (AC-1). AC-2 (another person's rows, and owner writes) and AC-3 (rank, move, removal) pass, and every existing pgTAP file other than the baseline `170` #42 passes unedited. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 51 files, 1017 tests |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-carry.mjs MIR-21-c` | 0 | PASS, nothing stray |
| `pnpm db:test`, first run | 1 | `250` #26 failed on my own event-order assumption (see delegated decisions); `170` #42 |
| `pnpm db:test`, after the AC-5 fix | 1 | 25 files, 1109 tests. `250` 38/38. The only failure is `170` #42 (`AC-20: admin_u does not select E`), the baseline recorded in `MIR-21-b/03-impl-log.md:108` and `MIR-21/03-impl-log.md:111` — excepted by AC-9 |
| `grep -nE "member\.team_id\|insert into public\.member \([^)]*team_id" supabase/tests/250-membership-self-lock.test.sql` | 1 | No match: no line names `member.team_id`, no member insert names `team_id` (§ 4.4) |
| `git diff --name-only` subset of `allowed_paths` | yes | plus this ticket's own folder |

AC-9: no existing test was edited; `220` AC-1 and `230` AC-7 pass.

## Testability contract

No selectors: no screen changes in this ticket (01-plan.md § 2b).

## Open questions

- The seam's three calls are proven by source text (AC-7) and by SQL (AC-6), not over PostgREST
  HTTP. A reviewer who wants the HTTP half has to sign in against the local API by hand.
