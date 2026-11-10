-- CAL-04. The select half of `public.team`, and nothing else.
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- 01-plan.md section 6. `public.team` has row-level security enabled and
-- `revoke all ... from anon, authenticated` (TEA-01's migration), and no policy and no grant of any
-- kind — so `overload_threshold` is unreadable today and AC-7 is unsatisfiable without this file.
-- supabase/db.sql section 9.1 records that gap and names this ticket as its owner.
--
-- ADR-005 puts the check here rather than in the interface, and ADR-014 is why a select-only policy
-- migration is not `schema_delta: none` — that ADR carves out nothing for reads. Both are LINKED,
-- not authored: this creates no table, no column and no constraint, and decides nothing ADR-005 has
-- not already decided. The CAL-03 precedent.
--
-- What this migration deliberately does NOT do:
--
--   * No `update` grant and no update policy. `.ai/registry/features.md:103` gives ADM-01 "the
--     matching update privilege on that table and nothing else", and `rbac-and-security.md:48`
--     grants *Set the overload threshold* to `admin` alone. On this branch NEITHER role can change
--     it — CAL-04 AC-14. ADM-01 is unblocked by this file rather than by a registry change.
--   * No new helper. `public.member_team_id(uuid)` exists from TEA-01, is `security definer`, and is
--     already granted to `authenticated`.
--   * No `removed_at` condition of its own. `member_team_id` filters `removed_at is null` inside its
--     own body, so a removed caller resolves to NULL, `id = null` is never true, and they read no
--     team row at all — the same inheritance every policy built on that function already has.
--
-- `to authenticated`, not `to public`: a policy written `to public` re-opens the table to the anon
-- key, which ships in the browser bundle by design (rbac-and-security.md, "Secrets").
--
-- The grant is `select` on the WHOLE table rather than a column list, and that is safe here for a
-- reason worth stating: `team` carries `id`, `name`, `overload_threshold` and `created_at`, all four
-- of which the policy already scopes to the caller's own row. A column grant would protect nothing
-- that the row filter does not, and would have to be revisited by every ticket that adds a column.

grant select on public.team to authenticated;

create policy team_select_own on public.team
  for select to authenticated
  using (id = public.member_team_id((select auth.uid())));
