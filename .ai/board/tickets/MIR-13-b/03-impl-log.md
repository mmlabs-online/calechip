---
ticket: MIR-13-b
stage: IN_PROGRESS
agent: developer
produced_at: 2026-11-03T07:14:00Z
inputs_read:
  - .ai/board/tickets/MIR-13-b/01-plan.md
  - .ai/board/tickets/MIR-13-b/ticket.yaml
  - .ai/registry/decisions/ADR-072-reads-that-feed-the-absence-count-resolve-to-the-primary-team.md
  - .ai/standards/testing-standards.md
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20260926140000_solo_issue_report_images.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/150-write-path-org-bound.test.sql
  - src/lib/data/supabase.ts (createIssueReport, the image path shape)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# MIR-13-b — implementation log

The current body of every rewritten object was read from `pg_policies` and `pg_get_functiondef` on a
database rebuilt from every migration, not from the migration that first created it. The six
functions and eleven policies that read the single-valued helper before this ticket are exactly the
ones § 4 lists.

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql` | created | The one migration § 4 names: every rewritten policy and read function | § 4.1, § 4.2, § 4.3 |
| `supabase/tests/160-read-path-org-bound.test.sql` | created | AC-11: pgTAP for AC-1, AC-2, AC-4 to AC-9 | § 4.1 to § 4.3, via AC-11 |
| `.ai/board/tickets/MIR-13-b/03-impl-log.md` | created | This log | gate |
| `.ai/board/tickets/MIR-13-b/ticket.yaml` | modified | `state: REVIEW` on PASS | gate |

ADR-072, the third path in `allowed_paths`, was written at PLAN and is not touched here.

## Contract items

All in `supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql`.

| § 4 item | Implemented at | Notes |
|----------|----------------|-------|
| 4.1 `member_select_team` | `:35` | primary team |
| 4.1 `team_select_own` | `:40` | primary team |
| 4.1 `entry_select_team` | `:45` | primary team of author = primary team of caller |
| 4.1 `busy_day_select_team` | `:50` | `m.team_id` column read kept, MIR-21's |
| 4.2 `may_read_event` | `:64` | as § 4.2's SQL, verbatim |
| 4.2 `event_select_visible` | `:83` | |
| 4.2 `event_attendance_select_visible`, `event_guest_select_visible`, `notification_select_own` | `:99`, `:110`, `:120` | guard only |
| 4.2 `task_select_own`, `task_insert_own`, `task_update_own`, `task_delete_own` | `:128`, `:136`, `:144`, `:156` | guard only; `update` keeps both `using` and `with check` |
| 4.2 `notify_event_created()` | `:166` | recipients bounded by `new.org_id` |
| 4.2 `save_event(...)` | `:191` | EVT-02's body, one line changed. Stays SECURITY INVOKER, as it was; "keeps security definer" in § 4's preamble does not apply to it |
| 4.2 `list_member_directory()` | `:264` | org bound; own team over every active team |
| 4.3 `list_teams()` | `:304` | |
| 4.3 `list_all_members()` | `:313` | |
| 4.3 `list_members_for_team` | `:323` | `team_in_org` written out |
| 4.3 `list_team_entries_for_team` | `:336` | |
| 4.3 `list_team_entries_overlapping_for_team` | `:347` | |
| 4.3 `member_select_pending_admin` | `:361` | |
| 4.3 `issue_report_select_admin` | `:371` | |
| 4.3 `issue_image_select_admin` | `:384` | **deviates, see below** |
| 4.4 seam and types | — | no change; no file under `src/` touched |

No new function, so `010-catalogue`'s census is unchanged and passes. No grant statement:
`create or replace` keeps each function's grants.

## Deviations from the design

**One. `issue_image_select_admin` reads the uploader's org from `public.issue_report`, not from
`public.member`.**

§ 4.3 gives `exists (select 1 from public.member m where m.id::text = (storage.foldername(name))[1]
and m.org_id = public.member_org_id(caller))`. A subquery inside a policy runs under the caller's
RLS. On `public.member`, an admin reads their own row, their primary team's roster
(`member_select_team`, § 4.1) and pending sign-ups. They do not read the roster of another team in
their org, or a removed member. So that predicate would hide from Admin A every image uploaded by a
reporter on T3, and every image from a reporter since removed. Before this ticket Admin A read
them, and § 3 says an admin reads issue images "in the admin's own org".

Written instead (`:384-392`):

```sql
and exists (select 1 from public.issue_report r
             where r.member_id::text = (storage.foldername(objects.name))[1]
               and r.org_id = public.member_org_id((select auth.uid())))
```

`issue_report_select_admin` (`:371`) admits every report in the admin's org, of any team and any
reporter, so this subquery sees exactly the reporters in the admin's org. The `r.org_id` conjunct
repeats that bound explicitly, so the policy does not depend on another policy to keep it.

- **Kept:** the uploader's folder is still the key, as § 4.3 has it.
- **Narrower:** an object whose uploader has no issue report at all is no longer visible. That is
  the orphan `solo_issue_report_images.sql` § 4 describes: an upload whose report insert failed. No
  screen reads it.
- **Proved:** with § 4.3's literal predicate restored, `160` test 42 fails. That test reads a T3
  reporter's image as Admin A. With the predicate above, it passes. See *Verification run*.

No function was added, so the census and the "no new function" constraint both hold.

## Delegated decisions

- **The deviation above was taken without consulting `tech-lead-design`.** It is a one-predicate
  fix to keep § 3's permission row true. The alternative to § 4.3's literal text that needed no new
  function was `public.member_org_id(<folder>::uuid)`. It was rejected for two reasons: it hides a
  removed reporter's images, since the helper filters removed members; and it casts a path segment,
  so one malformed object name would make the whole policy raise.
- **The `160` fixture for K is `member_t`, not `manager_t`.** `150` used `manager_t`. § 2 says K is
  "an approved member", and a manager would add `entry_update_manager` paths irrelevant here.
- **AC-4's directory check adds `manager_u`.** N (`member_u`) created the seed's `event_u_public`,
  so K had N in the directory through ADR-066 (c) before this migration. That makes "returns N"
  true both before and after. `manager_u` is reached only by the own-team clause, so it is the
  assertion that fails without the migration.
- **AC-9's attendance row is inserted while `pending_p` is briefly approved on T1.**
  `event_attendance_guard` refuses an attendance for a person on no team, even from the owner. The
  test returns `pending_p` to `pending`, team null, before anything is read, and it asserts the row
  exists, so the empty read is the policy's answer.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | The four reads `absenceCountsFor` receives (`member_select_team`, `entry_select_team`, `busy_day_select_team` and `team_select_own`) are single-valued on `member_primary_team_id(caller)` (`:35-55`). A member on T1 and T3 therefore gets T1's roster, T1's entries and T1's threshold, and never a union. `160` AC-2 asserts this with K on two teams. `absenceCountsFor` and the threshold are untouched. The migration does not mention `overload_threshold`; `tests/draft-entry.test.ts` AC-14 passes |
| `INV-07` | An entry is visible and counted on its author's primary team (`entry_select_team`; `list_team_entries*_for_team` on `member_primary_team_id(e.member_id)`). Under ADR-071's mirror no writer creates a non-primary membership, so no entry has a further team to be counted on. ADR-072 decision 5 leaves the secondary-team view to a future feature |

## Verification run

**Same environment as MIR-13: no Docker, so `pnpm db:test` cannot start the Supabase stack.** The
equivalent ran on a scratch PostgreSQL 17 cluster (Homebrew) with pgTAP. It used MIR-13's harness:
stub `auth`, `storage`, `vault` and `net` schemas; every migration applied in order; each test file
run with `psql -f`.

| Command | Exit | Notes |
|---------|------|-------|
| `pnpm typecheck` | 0 | |
| `pnpm lint` | 0 | |
| `pnpm test` | 0 | 49 files, 994 tests. Includes `tests/draft-entry.test.ts` AC-14 (AC-12) |
| `node scripts/check-allowed-paths.mjs` | 0 | |
| `node scripts/check-carry.mjs MIR-13-b` | 0 | |
| pgTAP baseline, scratch PG17, before the migration | 0 | 16 files pass. `030` carries its 2 pre-existing `todo`s |
| pgTAP after the migration, all 17 files | 0 | Every file passes. `020`, `030`, `060`, `070`, `090` and `100` are unedited (AC-3, AC-10). `160`: 49/49 |
| `160` against the database before the migration | 1 | Expected. Fails AC-1 (1, 2), AC-4 (13, 14, 16, 17), AC-5 (19, 20, 22, 23) and AC-6 (24, the public-event insert refused by `notification_event_org_fk`). The transaction aborts there, so AC-7 to AC-9 do not run |
| `160` with § 4.3's literal image policy | 1 | Expected. Only test 42 fails (the deviation above) |
| Second apply of the migration | 0 | Idempotent (ADR-024); the suite was re-run after it |
| `git diff --name-only` ⊆ `allowed_paths` | yes | Plus this ticket's own `03-impl-log.md` and `ticket.yaml` |

## Testability contract

Not applicable. This ticket has no screen and no selectors (plan § 2b).

## Open questions

1. **`pnpm db:test` has not run on the real Supabase stack**, as with MIR-13. One difference from
   the stubs matters here. `issue_image_select_admin` references `objects.name` inside a subquery.
   In Supabase's `storage.objects` the column is `name` too, so this should behave identically.
   CI's `database` job is the first real run.
