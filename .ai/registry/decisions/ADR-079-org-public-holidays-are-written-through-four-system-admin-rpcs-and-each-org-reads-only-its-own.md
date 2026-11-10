---
doc_version: 3
last_updated: 2026-11-06
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-079 — Org public's holidays are written through four `aal2`-gated RPCs, no member writes them, and each org reads only its own holiday rows

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-06 — at `/plan` for MIR-15-b (ADR-008, ADR-067).

**This ADR reverses one accepted decision**, which is why it is written under ADR-067 rather than
ADR-008 alone: [ADR-015](ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md)'s select
policy `holiday_select_all … using (true)` (`supabase/migrations/20260905120000_adm02_holiday.sql:58-59`)
is replaced by a policy bounded by the caller's org. ADR-015 wrote `using (true)` for a table with
one calendar; since MIR-18-b's `create_org` copies Org public's rows into every new org
(ADR-075 decision 3), the table holds one calendar per org and `using (true)` returns all of them.
It also narrows ADM-03's three write policies, which ADR-070 § 4 already decided in words
(*"In Org public … holiday rows … may be written only by `system_admin` (MIR-15)"*). It extends
[ADR-076](ADR-076-in-org-public-a-public-event-is-a-team-event-and-the-directory-reaches-no-other-team-through-it.md)
decision 6's split by one ticket, MIR-15-e.

## Context

- **ADR-059 decision 1:** an org has *"its own holidays"*. **ADR-070 § 4, `holiday` bullet:** in
  Org public the rows are the system-owned national set, written only by `system_admin` (MIR-15);
  in a dedicated org they are seeded on creation (MIR-18) and maintained by `org_admin` (MIR-16).
- **Today any `is_admin` member writes their own org's rows**
  (`supabase/migrations/20261103120000_mir13_write_path_org_bound.sql:830-856`), and every member is
  in Org public (MIR-12), so every admin of every free team edits the national set.
- **`holiday_select_all` is `using (true)`** (`20260905120000_adm02_holiday.sql:58-59`), so a member
  reads every org's copy of a date. `unique (org_id, date)` (`20261103120000…:351-356`) makes *the
  status of date D* single-valued per org only.
- **A system admin has no member row** (ADR-074 decision 2), so `member_org_id(auth.uid())` is null
  for them and no member-keyed policy admits them. `holiday_stamp_org_id` stamps a missing `org_id`
  from the caller's member row (`20261103120000…:229-231`), which a system admin does not have.
- **ADR-074 decision 4:** every system-scope read or write is gated on `public.is_system_admin()`.
  **ADR-075 decision 1** set the pattern for the panel: `security definer` RPCs refusing with
  `42501`, executable by `authenticated` only.
- **`public.org_is_shared(uuid)`** exists (MIR-15, ADR-076 decision 5) as the one shared-flag
  predicate.

## Decision

1. **Four RPCs are the system admin's door to Org public's holidays**, each `security definer`, each
   refusing with SQLSTATE `42501` unless `public.is_system_admin()` is true, each executable by
   `authenticated` only: `public.list_national_holidays(date, date)`,
   `public.add_national_holiday(date, text, public.holiday_kind)`,
   `public.update_national_holiday(uuid, date, text, public.holiday_kind)` and
   `public.delete_national_holiday(uuid)`. **Each resolves Org public itself** (the one
   `is_shared_tenant` row, unique by `org_one_shared_tenant_idx`), so the panel never passes an org id and cannot
   aim the door at a dedicated org. An id that is not an Org public row is refused with `P0002`.
   A blank name is refused with `22023`, because the table has no constraint that would.
2. **No member writes Org public's holidays.** `holiday_insert_admin`, `holiday_update_admin` and
   `holiday_delete_admin` each gain `and not public.org_is_shared(org_id)`. In a dedicated org they
   are unchanged: an `is_admin` member there keeps the write until MIR-16 re-points it at
   `org_admin` (ADR-070 § 4).
3. **Each org reads only its own holiday rows.** `holiday_select_all` is dropped and replaced by
   `holiday_select_own_org`, `for select to authenticated using (org_id = public.member_org_id((select auth.uid())))`.
   `member_org_id` is null for a pending, removed or member-less caller, who therefore reads no rows —
   the same bound every other MIR-13-b read uses. The system admin reads through decision 1's list.
4. **A change to Org public's set is not copied into any dedicated org.** `create_org` copies once,
   at creation (ADR-075 decision 3); nothing here adds a second copy. Whether a later national change
   should propagate is not decided by any source and is left to `/idea`.
5. **Delivery is split by surface** (`.ai/01-operating-model.md` § Sizing). **MIR-15-b** ships
   decisions 1–4 in the database, the panel seam's four functions and the panel's holiday screen.
   **MIR-15-e** ships the member app: the Holidays screen stops offering add, edit and delete to an
   admin of Org public, the member mock seam follows decisions 2 and 3, and the vitest and e2e files
   that assert an Org public admin writes holidays change with it. Between the two, the member app
   still shows those controls in Org public and the database refuses every use of them, and the mock
   is looser than SQL on these predicates — the price ADR-076 decision 6 already paid once.

## Options considered

- **Policies for the system admin on `public.holiday` instead of RPCs** — a disjunct
  `or (public.is_system_admin() and public.org_is_shared(org_id))` on all four. Fewer functions.
  Rejected: the panel would have to send Org public's id on every insert (the stamp trigger finds no
  member row), the same table policies would carry two kinds of caller, and it departs from the
  panel's one existing pattern (ADR-075 decision 1) without a reason.
- **Hide the member app's controls in this ticket, by hiding them for every admin.** One condition,
  no new seam read. Rejected: it removes the write a dedicated org's admin still holds under
  decision 2, and no source takes it away before MIR-16.
- **Keep `using (true)` and filter by org in `listHolidays`.** Rejected: under ADR-005 the policy is
  the control, and a filter in the client is an affordance a direct PostgREST call skips.
- **Let the system admin edit every org's holidays.** Rejected: ADR-070 § 4 gives a dedicated org's
  calendar to that org's `org_admin`.

## Consequences

- `supabase/tests/010-catalogue.test.sql`'s definer census gains the four RPCs.
- `supabase/tests/150-write-path-org-bound.test.sql` AC-13's *"inserting a holiday with no org_id is
  accepted"* (admin of Org public) becomes a refusal.
- ADM-02's *"a caller with no member row reads the calendar exactly as a member does"*
  (`src/App.tsx:539-544`) stops being true: such a caller reads no rows. The screen consequence is
  MIR-15-e's.
- The comments that say `holiday_select_all` is `using (true)` (`src/lib/data/supabase.ts:2883`,
  `src/lib/data/mock.ts:550`, `:2882`, `src/routes/Holidays.tsx:6`, `src/App.tsx:541`) are stale
  until MIR-15-e rewrites them.
- `.ai/standards/rbac-and-security.md:66` (*Add, edit or delete a holiday*, admin ✅) is stale for
  Org public until a standards edit; its known-weakness row A11 (`:347`) is closed for Org public.

## Revert condition

The operator decides that a team's admin in Org public maintains holidays, or that the holiday
calendar is one deployment-wide set rather than one per org. Either supersedes decision 2 or 3.
