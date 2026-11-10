-- ADM-03. The WRITE half of `public.holiday`. Applying this file is human (RULE-09).
--
-- Transcribed from ADR-015 section 3, which is ACCEPTED. supabase/db.sql carries the same four
-- statements marked `[OWED] ADM-03`; ADR-026 decision point 6 says applying that file does NOT
-- discharge this migration, because supabase/migrations/ is still the mechanism and this file is
-- what a fresh environment and the CLI's own history read.
--
-- The read half shipped with ADM-02 (20260905120000_adm02_holiday.sql) and is not touched:
-- `grant select` and `holiday_select_all` stay exactly as they are, so reading remains unchanged for
-- both roles and for a signed-in caller with no member row (AC-18).
--
-- ONE POWER, THREE POLICIES, because PostgreSQL has no single `for write`. The permission row is
-- "Add, edit or delete a holiday or swap day" — member no, admin yes — in rbac-and-security.md:39.
-- No row is added to that table by this ticket (AC-17); this is the second of the two that already
-- exist for `holiday` becoming executable.
--
-- `public.is_admin(uuid)` NEEDS NO GRANT HERE. TEA-01's migration already does
-- `grant execute on function public.is_admin(uuid) ... to authenticated` at
-- 20260831150024_tea01_membership.sql:71, verified on disk. A second grant is the redundant-grant
-- trap: it reads as a control and is not one. It is `security definer`, so a policy on this table
-- may consult `member` without recursing through `member`'s own policies, and it filters
-- `removed_at is null` in its own body — which is where AC-16 comes from, rather than from a
-- predicate repeated three times below.
--
-- NO TEAM CONJUNCT, unlike every other write policy in this schema. `holiday` has no `team_id`: the
-- calendar is national (ADR-015 section 1). ADR-015 Rationale records the consequence in terms — at
-- the brief's P2 multi-team point, any admin of any team can rewrite everybody's Tet — and accepts
-- it as a blast-radius cost rather than a scoping one, because there is one team. A reviewer under
-- check R6 should read this comment as the reason the missing conjunct is warranted rather than as
-- an oversight.
--
-- `to authenticated`, never `to public`: a policy written `to public` re-opens the table to the anon
-- key, which ships in the browser bundle by design (rbac-and-security.md, "Secrets").

create policy holiday_insert_admin on public.holiday
  for insert to authenticated
  with check (public.is_admin((select auth.uid())));

-- BOTH `using` AND `with check`. `using` decides which row may be updated; `with check` decides what
-- it may become. Omitting the second would let an admin's UPDATE produce a row the policy would not
-- have admitted — here the two predicates are identical because neither depends on the row, and the
-- pair is written out because the next write policy on this table will be copied from this one.
create policy holiday_update_admin on public.holiday
  for update to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

create policy holiday_delete_admin on public.holiday
  for delete to authenticated
  using (public.is_admin((select auth.uid())));

-- TABLE-WIDE AND NOT COLUMN-SCOPED, unlike TEA-04's `grant update (role, removed_at) on
-- public.member` and ADM-01's `grant update (overload_threshold) on public.team`. That is ADR-015
-- section 3's statement transcribed, and it is not the same case: a column grant exists to withhold
-- a column from EVERYBODY, and this table has none — an admin may legitimately write `date`, `name`
-- and `kind`, which is every substantive column there is. What it also admits is `id` and
-- `created_at`; neither carries a permission row anywhere and neither is read by any feature.
-- 01-plan.md Open question 1 carries the narrowing to the operator rather than deciding it here.
--
-- NOT INHERITED. ADM-02's migration does `revoke all on public.holiday from anon, authenticated`
-- and then grants `select` alone, so without this line all three policies above would sit over a
-- table nobody may write and every save would be refused with 42501.
grant insert, update, delete on public.holiday to authenticated;

-- `unique (date)` IS NOT CREATED HERE. ADM-02's migration already carries it on the table and this
-- ticket only makes a person meet it: AC-6 and AC-7 are `23505` translated into a sentence by
-- `toHolidayFailure` in src/lib/data/supabase.ts, not a second constraint.
