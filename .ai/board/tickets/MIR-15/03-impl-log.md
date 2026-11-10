---
ticket: MIR-15
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-05T06:45:13Z
inputs_read:
  - .ai/board/tickets/MIR-15/01-plan.md
  - .ai/board/tickets/MIR-15/ticket.yaml
  - .ai/standards/testing-standards.md
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql
  - supabase/migrations/20261009150000_evt07_guest_registration.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/160-read-path-org-bound.test.sql
  - supabase/tests/090-event-boundaries.test.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-15 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql` | created | `org_is_shared(uuid)`, the fenced `public` disjunct in the three readers, and `notify_event_created`'s recipients | § 4.1 items 1–3 |
| `supabase/tests/210-org-public-team-bound.test.sql` | created | 41 assertions: AC-1 to AC-15, plus the predicate's three answers and its grants | § 4.2 |
| `supabase/tests/010-catalogue.test.sql` | modified | the census fails on an unclassified definer function; `org_is_shared(uuid)` is added under its suite | § 4.3 |
| `supabase/tests/160-read-path-org-bound.test.sql` | modified | its AC-6 expected Org A's public event to notify every team; now the event's team. Comments at `:138`, `:161` say why K still reaches T3 | § 4.6 |
| `src/routes/EventEditor.tsx` | modified | the `public` choice's label and hint no longer promise every team (AC-16) | § 4.5 |
| `src/routes/Events.tsx` | modified | the badge label and its comment, to match the editor | § 4.5 |
| `tests/e2e/evt-01-events.spec.ts` | modified | the two `toHaveText("Every team")` assertions now read `Public` | § 4.6 |
| `.ai/board/tickets/MIR-15/03-impl-log.md` | created | this log | gate |
| `.ai/board/tickets/MIR-15/ticket.yaml` | modified | `state: REVIEW` on PASS | gate |

The ADR and the three sub-ticket files in `allowed_paths` were written at PLAN and are not changed
here.

## Contract items

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 (1) `org_is_shared` | `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql:33-41` | body as the plan; revoked from `public, anon`, granted to `authenticated` |
| 4.1 (2) `may_read_event` | same file `:48-65` | only the `public` disjunct changed |
| 4.1 (2) `event_select_visible` | same file `:68-83` | `drop policy if exists` first; `e.` dropped, `p_uid` is `(select auth.uid())` |
| 4.1 (2) `is_event_audience` | same file `:88-104` | only the `public` disjunct changed |
| 4.1 (3) `notify_event_created` | same file `:112-131` | recipient predicate as the plan; early return for `named` kept |
| 4.1 — `list_member_directory` not redefined | — | reaches the fence through `may_read_event` |
| 4.2 pgTAP | `supabase/tests/210-org-public-team-bound.test.sql` | `plan(41)` |
| 4.3 census | `supabase/tests/010-catalogue.test.sql:64-65` | |
| 4.4 mock | — | not this ticket (MIR-15-d) |
| 4.5 screens | `src/routes/EventEditor.tsx:75`, `src/routes/Events.tsx:25`, `:28` | strings exactly as the plan |
| 4.6 tests changed | `supabase/tests/160-read-path-org-bound.test.sql:138-139`, `:161-162`, `:172-185`; `tests/e2e/evt-01-events.spec.ts:117`, `:174` | |

## Deviations from the design

none.

Two notes on how ACs that describe "before the migration" are observed, since a pgTAP file runs
after every migration:

- **AC-14.** `event_attendance_guard` now refuses a cross-team attendance on insert, even from the
  table owner. The test gives Bob an active Team A membership, inserts his attendance as the owner,
  then ends that membership (`left_at = now()`). That is the state a pre-migration attendance leaves.
- **AC-15.** Two assertions: every `public` event the seed and the file wrote is still `public` at the
  end, and none of the four functions this migration adds or replaces contains an `update
  public.event`. The migration has no `update` statement at all.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | `list_member_directory()` is not redefined and no select policy on `public.member` changes, so `listMembers()`, INV-04's denominator, returns the same rows. The directory loses rows only through `may_read_event`, and it does not feed the count. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm exec tsc --noEmit` | 0 | |
| `pnpm exec eslint .` | 0 | |
| `pnpm exec vitest run` | 0 | 50 files, 1010 tests |
| `pnpm exec playwright test tests/e2e/evt-01-events.spec.ts` | 0 | 12 passed, seam guard included |
| `pnpm db:test` | — | **Not run**: `docker` is not installed, as in MIR-18 and MIR-18-b. CI's `database` job is the real run |
| pgTAP on a throwaway local PostgreSQL 17 + pgTAP | — | **A stand-in, not Supabase**: same method as MIR-18-b's log. Cluster in the session scratchpad, stub `anon`/`authenticated`/`service_role`, stub `auth.users`, `auth.uid()`/`auth.jwt()` reading `request.jwt.claims`, stub `storage`, `net`, `vault`, Supabase-like default privileges on `public`. Every migration applied in order. **`210` 41/41, `160` 49/49, `010` passes** (apart from its existing F-1 `todo`), and every other file passes except `000-harness` (no `supabase_migrations` schema in the stub) and `170` AC-20. Both fail **identically on a second database built without this migration**. `030` goes from 12 to 14 `ok`: its two F-3 `todo` tests now pass, as plan § 1 predicted; removing them is MIR-15-d's or F-3's. Cluster stopped afterwards |
| `node scripts/check-allowed-paths.mjs` | 0 | PASS |
| `node scripts/check-carry.mjs MIR-15` | 0 | PASS: 9 uncommitted paths, all carried |

## Testability contract

The plan has no selector table: no test id is added, removed or renamed. `event-scope` and
`event-row-scope` keep their ids and now carry `Public`.

## Delegated decisions

none.

## Open questions

- **Applying the migration to the hosted project is human** (RULE-09).
- **The mock still lets a `public` event reach every team** until MIR-15-d ships (plan § 5, ADR-076
  decision 6). The member app shows a Team B public event to a Team A member under the mock seam
  only.
