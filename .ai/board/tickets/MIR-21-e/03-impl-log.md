```yaml
---
ticket: MIR-21-e
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-07T05:20:58Z
inputs_read:
  - .ai/board/tickets/MIR-21-e/01-plan.md
  - .ai/board/tickets/MIR-21-e/ticket.yaml
  - .ai/registry/decisions/ADR-080-the-team-lock-moves-to-membership-first-and-the-drop-splits-into-four-slices.md
  - .ai/registry/decisions/ADR-081-the-fixtures-of-100-160-and-240-move-to-the-drop.md
  - .ai/board/tickets/MIR-21-f/ticket.yaml
  - .ai/templates/impl-log.md
  - .ai/standards/testing-standards.md
  - supabase/migrations/20261105210000_mir21b_writers_write_membership.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/120-composite-fks.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/150-write-path-org-bound.test.sql
  - supabase/tests/190-system-admin.test.sql
  - supabase/tests/210-org-public-team-bound.test.sql
  - supabase/tests/220-roster-team-from-membership.test.sql
  - supabase/tests/230-writers-write-membership.test.sql
  - supabase/seed.sql
  - supabase/bootstrap.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---
```

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/tests/_isolation.psql` | modified | added `tests.put_on_team(member, team)`, writing the one `membership` row the mirror's INSERT branch used to write; `tests.seed()`'s member insert no longer names `team_id` and the loop calls the new helper per person on a team | §4.1 |
| `supabase/tests/120-composite-fks.test.sql` | modified | Ada's and Cy's member insert drops `team_id`; the `on conflict … do update` clause drops its `team_id` branch; `put_on_team` writes their membership rows before the event insert | §4.2 (120) |
| `supabase/tests/140-org-stamping-and-membership-mirror.test.sql` | modified | M2 and Admin B's insert names `org_id` instead of `team_id`, followed by `put_on_team`; P2's and X's inserts drop the null `team_id`; the `plan()` count and the now-untestable "member on T2 -> T2's org" assertion are retired; the `:33` comment is reworded | §4.2 (140), §4.3 |
| `supabase/tests/150-write-path-org-bound.test.sql` | modified | M2's insert names `org_id` instead of `team_id`, followed by `put_on_team`; P2's insert drops the null `team_id` | §4.2 (150) |
| `supabase/tests/190-system-admin.test.sql` | modified | the `throws_ok` fixture's member insert drops `team_id` and its `null` value | §4.2 (190) |
| `supabase/tests/210-org-public-team-bound.test.sql` | modified | the member insert is split in two (Dan/Dee naming `org_id`, Alice/Bob/Carol taking the shared tenant by default); five `put_on_team` calls write each one's membership row before Carol's non-primary row; the `:58` comment is reworded | §4.2 (210) |
| `supabase/tests/220-roster-team-from-membership.test.sql` | modified | A's and K's insert drops `team_id` (org_id already named), the pending five drop the null `team_id`; `put_on_team(A, t1)` and `put_on_team(K, t3)` added; AC-1's first assertion and AC-2 are retired, the `plan()` count drops, the AC-1 heading and the file header are reworded | §4.2 (220), §4.3 |
| `supabase/tests/230-writers-write-membership.test.sql` | modified | all three member inserts drop `team_id`; six `put_on_team` calls (A, K, M, R, W, V) write each one's primary row before V's non-primary T2 row; the header is reworded | §4.2 (230) |
| `supabase/seed.sql` | modified | all seven `insert into public.member` statements drop `team_id` and its value; one statement after the last member insert and before the first entry insert writes the seven membership rows the mirror used to write, with the same pairs read at PLAN | §4.4 |
| `supabase/bootstrap.sql` | modified | the member insert drops `team_id` and `v_team_id,`; `org_id = v_org_id` stays; a new statement writes admin zero's one active primary `membership` row, replacing the `:213-217` comment that described the mirror doing it | §4.5 |

## Contract items

| § 1 item | Implemented at | Notes |
|----------|----------------|-------|
| §4.1 (`tests.put_on_team`, `tests.seed()`) | `supabase/tests/_isolation.psql:72-130` | Helper added verbatim from the design; `tests.seed()`'s member insert and loop match §4.1's description exactly |
| §4.2 row 120 | `supabase/tests/120-composite-fks.test.sql:264-272` | Matches the design's note exactly |
| §4.2 row 140 | `supabase/tests/140-org-stamping-and-membership-mirror.test.sql:33-47,95-98` | Matches; the retired assertion ("member on T2 -> T2's org") removed at its original location |
| §4.2 row 150 | `supabase/tests/150-write-path-org-bound.test.sql:37-41` | Matches |
| §4.2 row 190 | `supabase/tests/190-system-admin.test.sql:102-107` | Matches; no `put_on_team`, as specified |
| §4.2 row 210 | `supabase/tests/210-org-public-team-bound.test.sql:51-69` | Matches; all five `put_on_team` calls precede Carol's non-primary row at `:68-69` |
| §4.2 row 220 | `supabase/tests/220-roster-team-from-membership.test.sql:34-41` | Matches |
| §4.2 row 230 | `supabase/tests/230-writers-write-membership.test.sql:76-96` | Matches; all six `put_on_team` calls precede V's non-primary T2 row at `:95-96` |
| §4.3 (retirements) | `140:95` removed, `plan(36)`→`plan(35)`; `220:64-69,78-82` removed, `plan(27)`→`plan(25)` | Confirmed by manually recounting every pgTAP assertion function call in both files against the new `plan(n)` |
| §4.4 (`seed.sql`) | `supabase/seed.sql:91-102,151-162,218-229,256-267,309-320,376-387,472-482,484-503` | Seven member inserts dropped `team_id`; one `membership` insert follows, with the seven pairs confirmed against the lines they replace (no difference found — see below) |
| §4.5 (`bootstrap.sql`) | `supabase/bootstrap.sql:201-216` | Member insert dropped `team_id`/`v_team_id,`; the new `membership` insert and comment replace the old "no membership insert here" comment, verbatim from the design |

**Pair confirmation for §4.4.** The seven `(member_id, team_id)` pairs in the design's snippet were checked against the `team_id` value each replaced member insert carried before this change: `2222…`→`1111…`, `3333…`→`1111…`, `6666…`→`4444…`, `7777…`→`1111…`, `8888…`→`1111…`, `5555…`→`1111…`, `bbbb…`→`1111…`. All seven match; no difference to record.

## Deviations from the design

`none`. One point worth recording rather than a deviation: the design's §4.4 snippet for `seed.sql` carries no `on conflict` clause, and it was implemented exactly as given (no `on conflict` on that one statement), even though every other statement in the file uses `on conflict (id) do nothing`. The statement does not insert `id`, so an `on conflict (id)` clause would not have made it idempotent in any case; the design's own text is followed verbatim.

## Invariants

`invariants_touched: []`. No invariant is in scope for this ticket (01-plan.md § 2: *"Invariants touched. []"*). INV-04 (a removed member stops counting) is carried by `membership.left_at`, and `tests.put_on_team` and the `seed.sql`/`bootstrap.sql` statements reproduce the mirror's INSERT branch's exact computation of `left_at`, `is_primary` and `joined_at` — so a removed fixture row (`removed_t`, `removed_admin_t`, `removed_u`, the `:77777777…` seed row) still gets a closed, non-primary row, identical to what the mirror wrote before this change.

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `node scripts/check-allowed-paths.mjs` | 0 | 5 changed files reported at the time of the check, all within `allowed_paths`; final diff is the 10 files above, still a subset |
| `node scripts/check-carry.mjs MIR-21-e` | 0 | every uncommitted path carried under `allowed_paths`, nothing stray |
| `pnpm exec tsc --noEmit` | 0 | no TypeScript touched by this ticket |
| `pnpm exec eslint .` | 0 | no lintable source touched by this ticket |
| `git diff --name-only` subset of `allowed_paths` | yes | confirmed by `check-allowed-paths.mjs` and `check-carry.mjs` above |

**Not run: `pnpm db:test` (`supabase test db` against the local stack).** This session has no Docker/Supabase-CLI access and no approval surface to grant one — the command was denied automatically before it could spawn. In its place, every `plan(n)` in the two files whose count changed (140, 220) was manually recounted against every pgTAP assertion call in the final file, and every other changed file's assertion count was confirmed unchanged by diffing against the original. The reviewer or a later stage with Docker access should run `pnpm db:test` before this ticket ships; I am flagging this rather than claiming a result I could not produce.

## Testability contract

Not applicable. This ticket has no UI and no new `data-testid` selectors (01-plan.md § 2b: no screen changes).

## Open questions

- `pnpm db:test` could not be run in this session (see Verification run above). The pgTAP suite and a fresh `supabase db reset` + `bootstrap.sql` run (AC-5, AC-6) should be confirmed by whoever has Docker access, before this ticket ships.
