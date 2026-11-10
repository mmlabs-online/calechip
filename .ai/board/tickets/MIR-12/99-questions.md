---
from: developer
to: tech-lead-design
asked_at: 2026-10-31T12:14:50Z
---

**Q.** `allowed_paths` holds only the migration and `supabase/bootstrap.sql`, but once the migration
sets `org_id NOT NULL` the local database can no longer be built or tested without touching three
more kinds of file. Can `allowed_paths` be widened, and to what?

What breaks, each checked against the files on `feat/MIR-12`:

1. **`supabase/seed.sql`** — `supabase db reset` runs it after every migration. It inserts `team`
   (`:51`, `:182`), `member` (`:91`, `:151`, `:218`, `:256`, `:309`, `:376`, `:478`), `entry`
   (`:505`, `:548`), `holiday` (`:601`) and `issue_report` (`:651`) without `org_id`, and `entry`
   without `primary_team_id`. Every one of those now fails with 23502, so `pnpm db:test` (CI's
   `database` job, `scripts/db-test.mjs`) fails at `reset` before any test runs.
2. **`supabase/tests/120-composite-fks.test.sql:218-219`** inserts fixture org `org-alpha` with
   `is_shared_tenant = true`. After MIR-12 Org public already holds the one shared-tenant slot, so
   that insert fails 23505 on `org_one_shared_tenant_idx`.
3. **`supabase/tests/090-event-boundaries.test.sql` and `100-mock-parity.test.sql`** insert into
   org-scoped tables directly; any insert there without `org_id` now fails.
4. **`supabase/create-account.sql:152`** (audit A:917-939) inserts a member without `org_id`. It is
   a hand-run script, not on the test path.

The plan's § 1 says these are MIR-13's because "there is no running application code to update yet",
but the seed and the pgTAP suite are not application code; they run on every `db:test`.

**Recommendation.** Add `supabase/seed.sql`, `supabase/create-account.sql`,
`supabase/tests/090-event-boundaries.test.sql`, `supabase/tests/100-mock-parity.test.sql` and
`supabase/tests/120-composite-fks.test.sql` to `allowed_paths`, and add a
`supabase/tests/130-backfill-org-public.test.sql` for AC-1..AC-9. Each fixture resolves Org public
with `(select id from public.org where is_shared_tenant)` and writes `org_id` (and
`primary_team_id` on `entry`) explicitly; 120's `org-alpha` becomes `is_shared_tenant = false`.

**Rejected: a column `DEFAULT` of the Org public id on every `org_id`.** It would keep the seed and
the unrewritten writers working with no fixture change, but it is fail-open in exactly the place
multi-tenancy cannot afford it: a writer that forgets `org_id` after MIR-13 lands silently in Org
public instead of failing. It also does nothing for `entry.primary_team_id`.

Two further deviations from the plan, already taken in the migration because ADR-070 decides them
and the plan contradicted it — please confirm or overrule:

- **AC-1 says `org_code = 'public'`.** MIR-11's `org_code_not_reserved` check rejects `'public'`,
  and ADR-070 § 2 sets `org_code = 'shared'`, `name = 'Org public'`. The migration uses `'shared'`.
- **AC-4 says every member with a `team_id` has an active primary row.** ADR-070 § 3 sets
  `left_at = member.removed_at`, and MIR-11's `membership_inactive_not_primary` forbids an inactive
  primary row, so a removed member gets `is_primary = false, left_at = removed_at`. AC-4 holds for
  every member with `removed_at is null`.

**A.** Widened by two test files, and narrowed: **MIR-12 no longer sets `NOT NULL` and no longer
swaps the holiday unique constraint. Both move to MIR-13**, in the same migration as the writer
rewrite. Reason: under `NOT NULL`, writers fail in places that test fixtures cannot reach.
`supabase/tests/090-event-boundaries.test.sql:82` and `:103` use `lives_ok` on an authenticated
`insert … (event_id)` through the column-scoped grant (`evt02:406`), which is the real `joinEvent`
and guest-link path. They fail with 23502 whatever the fixtures say. The admission trigger
(`avatar_images:63-79`) would also drop sign-ups silently. Of the three options offered:
(a) compat defaults or triggers would be a schema design that ADR-070 does not contain (and a
constant default fails open); (b) skipping those assertions would hide a production breakage;
(c) leaving CI red until MIR-13 breaks the rule that each migration ships independently
(`.ai/board/plans/calechip-multi-tenancy-plan.md:323`, risk 1). Deferring removes the conflict. The
columns are nullable today (MIR-11), so nothing that works now breaks. A row written between
MIR-12 and MIR-13 gets caught because the backfill is idempotent (AC-11), and MIR-13 re-runs it
immediately before `SET NOT NULL`. The holiday swap moves with it because `unique (org_id, date)`
over a nullable `org_id` lets `addHoliday` (still writing null) insert duplicate dates. Keeping
`holiday_date_key` keeps today's guarantee.

What I checked:
- Seed line numbers: confirmed. With nullable columns `seed.sql` no longer fails, so it stays out
  of scope.
- `create-account.sql:152` is an `update`, not an insert. Its member row comes from the admission
  trigger, which is MIR-13's, so it stays out of scope.
- The developer missed `supabase/tests/_isolation.psql`, the shared fixture behind most tests. It
  inserts into every org-scoped table without `org_id`. With nullable columns it needs no change.
- `120-composite-fks.test.sql:218-219` really does collide on `org_one_shared_tenant_idx`, so it
  must change: `org-alpha` becomes `is_shared_tenant = false`. `:243-247` still proves the one-slot
  rule, against Org public.

Both ADR-070 corrections are confirmed:
- `org_code = 'shared'`, `name = 'Org public'` (ADR-070 § 2; `'public'` is refused by
  `org_code_not_reserved`).
- A removed member gets `is_primary = false, left_at = greatest(removed_at, created_at)`.
  `membership_inactive_not_primary` outranks ADR-070 § 3's literal `is_primary = true`.

Also:
- The membership column is `team_role`, as MIR-11 shipped it, not ADR-070's `role_in_team`.
- The migration's entry-orphan `raise exception` becomes a `raise notice` with the count, because
  without `NOT NULL` nothing requires refusing.
- Add `supabase/tests/130-backfill-org-public.test.sql`.

AC-2..AC-7 and AC-11 cannot be exercised by `db reset`, because the seed runs after migrations. To
verify them:
1. `pnpm db:test`, so the seed leaves rows with null `org_id`.
2. Re-apply the migration with `psql -f` against the local stack.
3. Run the AC queries, and record the output in the implementation artifact.

**Amended:** `01-plan.md`:
- § 1: out-of-scope adds NOT NULL and the holiday swap, both moved to MIR-13.
- § 2: AC-1 now `'shared'`; AC-4 splits removed and non-removed members; AC-6 is limited to entries
  whose author has a team; AC-8 and AC-9 are rewritten to the nullable, `holiday_date_key` state;
  new AC-13 covers the test file and AC-14 covers `db:test` green.
- § 4 and § 6: outputs and steps updated.
- § 7: `allowed_paths` gains `supabase/tests/120-composite-fks.test.sql` and
  `supabase/tests/130-backfill-org-public.test.sql`; size stays S.
- § 8: Alt 2 is reversed.
- Changelog row added. `ticket.yaml` `allowed_paths` and `schema_delta` are updated to match.
