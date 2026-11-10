---
doc_version: 3
last_updated: 2026-11-05
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-075 — A system admin manages orgs through three `aal2`-gated RPCs; org management is create, read and update, and Org public is not edited from the panel

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-05 — at `/plan` for MIR-18-b (ADR-008, ADR-067).

This ADR supersedes and reverses no accepted ADR. It supplies the org-management design that
[ADR-074](ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md)
decision 8 left to MIR-18-b, inside [ADR-005](ADR-005-authorization-in-rls.md) (the database
authorizes; no server-side API) and ADR-074 decision 4 (every system-scope read or write is gated on
`public.is_system_admin()`).

## Context

- **Feature MIR-18** (`.ai/registry/features.md:307`) and plan item P4-3
  (`.ai/board/plans/calechip-multi-tenancy-plan.md:251`): *"Org CRUD, caps, licence state,
  move-team-between-orgs"*. Move-team-between-orgs is MIR-15's (ADR-074 decision 8).
- **`public.org` is closed to `anon` and `authenticated`**
  (`supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:97-98`), asserted by
  `supabase/tests/120-composite-fks.test.sql:64-66` and
  `supabase/tests/130-backfill-org-public.test.sql:74-76`.
- **The table on disk differs from ADR-070 § 2 in two columns.** MIR-11 created `plan text not null
  default 'free'` (ADR-070: `plan text null`) and no `licence_expires_at` column (ADR-070:
  `licence_expires_at timestamptz null`), at `20261027120000_mir11_composite_foreign_keys.sql:30-62`.
  `.ai/standards/data-model.md:318-321` still documents ADR-070's shape.
- **ADR-070 § 4, `holiday` bullet:** *"in a dedicated org (`is_shared_tenant = false`), holiday rows
  are seeded from the national set on org creation (MIR-18)"*; the national set is Org public's
  holiday rows (*"In Org public … holiday rows are the system-owned national set"*).
- **ADR-059 § Out of scope**, items 1–4 and 7: what a plan, a licence expiry or a cap *does* is
  deferred. Item 6: per-tenant deletion is deferred. ADR-070 defines no suspended state.

## Decision

1. **Three RPCs, each `security definer`, each refusing with SQLSTATE `42501` unless
   `public.is_system_admin()` is true:** `public.list_orgs()`, `public.create_org(text, text, text)`
   and `public.update_org(uuid, text, integer, integer, text, date)`. Executable by `authenticated`
   only. `public.org` keeps every table privilege revoked: no policy is written on it, so the two
   tests that assert it closed stay true.
2. **Org management is create, read and update. There is no delete and no suspend.** Deletion is
   ADR-059 § Out of scope item 6, and a suspended state would be a column and a behaviour nobody has
   decided. A mistaken org is corrected by a person in the database.
3. **`create_org` takes `org_code`, `name` and `timezone`, and copies Org public's holiday rows into
   the new org in the same transaction** — every row, with its `date`, `name` and `kind`. `plan`
   takes the column default; caps and licence start null. A timezone not in
   `pg_catalog.pg_timezone_names` is refused (SQLSTATE `22023`), because the column's only check is
   *not blank* and an unknown zone would fail later, far from the cause.
4. **`update_org` sets `name`, `max_members`, `max_teams`, `plan` and the licence expiry — never
   `org_code` or `timezone`.** `org_code` is immutable (ADR-070 § 2). Timezone is not in P4-3's edit
   list, and changing it would re-date every stored day boundary of an org that has data.
5. **The licence expiry crosses the RPC boundary as a `date`**, stored in the new nullable column
   `licence_expires_at timestamptz` as the start of that day in the org's timezone, and read back as
   that date. The column is ADR-070 § 2's, added now because MIR-11 left it out. **Stored and shown;
   nothing reads it.**
6. **Caps and plan are stored and shown; nothing enforces them** (ADR-059 § Out of scope). `plan`
   stays `not null default 'free'` as MIR-11 built it: making it nullable to match ADR-070 is a
   change to an existing column that this feature does not need, so the divergence is recorded here
   and left.
7. **Org public is listed, and is not edited from the panel.** `update_org` refuses the
   `is_shared_tenant` row with `42501`. Its values were fixed by ADR-070 § 2 and MIR-12, and setting
   a cap or licence on the tenant every sign-up lands in is a commercial decision ADR-059 deferred.

## Options considered

- **A `select`/`insert`/`update` policy on `public.org` gated on `is_system_admin()`, read through
  PostgREST.** Rejected: it breaks `120-composite-fks.test.sql:64-66` and
  `130-backfill-org-public.test.sql:74-76`, and the holiday seed would then be a second client call
  that can fail after the org exists.
- **Seed holidays with a trigger on `public.org` insert.** Rejected: the seed would also fire for a
  shared-tenant insert by a migration (MIR-13's `20261103120000_mir13_write_path_org_bound.sql:276`)
  and for a person inserting by hand, neither of which this decision is about.
- **Let `update_org` edit Org public like any other org.** Rejected under decision 7.

## Consequences

- `supabase/tests/010-catalogue.test.sql`'s definer census gains the three RPCs.
- `.ai/standards/rbac-and-security.md`'s *"Until MIR-16 it holds no right on any table in this
  file"* stops being true for `public.org` and `public.holiday` (through `create_org` only).
- `.ai/standards/data-model.md` is unchanged here; its `plan` row stays ADR-070's wording until a
  standards edit reconciles it with decision 6.

## Revert condition

The operator decides an org can be deleted or suspended, or that Org public's caps or licence are
set from the panel. That decision supersedes decision 2 or decision 7, and adds an RPC or relaxes
`update_org` with it.
