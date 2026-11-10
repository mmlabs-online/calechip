-- ADM-01. The admin write path on `public.team`, and nothing else.
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- 01-plan.md section 6.
--
-- The SELECT half is NOT here: CAL-04 shipped `grant select on public.team` and `team_select_own`
-- in 20260904100000_cal04_team_select.sql, which is what .ai/registry/features.md:103 assigns it.
-- This file is the "matching update privilege on that table and nothing else" the same row gives
-- ADM-01. A second `create policy team_select_own` here would fail on apply.
--
-- ADR-005 puts the check here rather than in the interface; ADR-014 is why this is not
-- `schema_delta: none`. Both LINKED, not authored: this creates no table, no column and no
-- constraint. ADR-020 half two is the SHAPE precedent — a column-level update grant beside an
-- admin-scoped update policy — but it is about `public.member` and is cited, not extended.
--
-- `public.is_admin(uuid)` and `public.member_team_id(uuid)` already exist from
-- 20260831150024_tea01_membership.sql, are both `security definer`, and are ALREADY granted to
-- `authenticated` at that file's line 71. A second grant here is the redundant-grant trap: it reads
-- as a control and is not one.
--
-- Both helpers filter `removed_at is null` inside their own bodies, so a removed caller resolves to
-- `is_admin = false` and `member_team_id = null`, and `id = null` is never true. That is where
-- AC-14 comes from; restating it in the predicate would be a second copy of the same rule.
--
-- NO `check` CONSTRAINT ON THE COLUMN. The permitted range (0 to 100 inclusive, whole percentage
-- points) is a product decision — 01-plan.md Open question 2 — and the invariant register declined
-- to constrain the threshold at all (invariants.md:178). A constraint here would also refuse with a
-- raw `23514` that the seam would then have to translate into a sentence. AC-7 and AC-8 are
-- screen-level criteria and the screen is where they are enforced.

-- THE COLUMN GRANT IS THE CONTROL, not the policy. An RLS UPDATE policy is row-level and admits
-- EVERY COLUMN of a row it admits, so `team_update_admin` alone would let any admin rewrite
-- `team.name` — for which no permission row exists anywhere. TEA-01 revoked all on `public.team`
-- from `anon` and `authenticated` at 20260831150024_tea01_membership.sql:145, so nothing is
-- inherited and both statements below are required. Same shape as TEA-04's
-- `grant update (role, removed_at) on public.member`, and it works here for the reason it cannot
-- work on `entry.status`: nobody may rename the team, so the privilege is uniform across roles.
--
-- This is deliberately a COLUMN list where CAL-04's `grant select` is the whole table. The
-- asymmetry is not an inconsistency: a read of `team` is already scoped to the caller's own row by
-- the policy and every column of that row is theirs to see, whereas a write of `name` is refused to
-- everybody and only a column list can express that.
grant update (overload_threshold) on public.team to authenticated;

-- AC-2, AC-5, AC-9, AC-12, AC-14. `to authenticated`, never `to public`: a policy written
-- `to public` re-opens the table to the anon key, which ships in the browser bundle by design
-- (rbac-and-security.md, "Secrets").
--
-- `(select auth.uid())` and not bare `auth.uid()` — the idiom every policy in this project already
-- uses (tea01:162, tea02:29, tea03:36, tea04:45, cal01:206, cal03:83, cal04:38).
--
-- BOTH `using` AND `with check`, and they are identical. `using` decides which row may be updated;
-- `with check` decides what the row may become. Here the column grant already withholds `id`, so
-- the pair cannot come apart — it is written out because the next admin write policy on this table
-- will be copied from this one and may not have that protection.
--
-- NO TRIGGER, and that is the difference from TEA-04. ADR-020's write path on `member` needed
-- `member_enforce_role_and_removal()` because a `with check` sees the NEW row with no OLD and so
-- cannot say "this column did not change". Nothing here needs that sentence: there is exactly one
-- writable column, and every other column is withheld by the grant rather than guarded by a
-- predicate.
create policy team_update_admin on public.team
  for update to authenticated
  using      (id = public.member_team_id((select auth.uid()))
              and public.is_admin((select auth.uid())))
  with check (id = public.member_team_id((select auth.uid()))
              and public.is_admin((select auth.uid())));
