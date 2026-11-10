-- TEA-04. The admin write path on `public.member`. ADR-020 for the decision and for the narrowing
-- of ADR-018 Decision point 3 that admits it; ADR-014 for why this file makes the ticket's
-- schema_delta not `none`. 01-plan.md section 6.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- It adds a GRANT, a POLICY, a FUNCTION and a TRIGGER, and alters no table. No column is added, no
-- policy is dropped, and `public.is_admin(uuid)` and `public.member_team_id(uuid)` already exist
-- from 20260831150024_tea01_membership.sql — both `security definer`, so a policy on `member` may
-- consult `member` without recursing through `member`'s own policies.
--
-- WHAT THIS FILE MUST NOT CONTAIN, now or by any later edit (ADR-020 half one, ADR-018 point 3 as
-- narrowed): no `insert` policy and no `delete` policy on `public.member`, permanently. The
-- admission trigger is the only creator of a member row — any insert policy a signed-in person can
-- satisfy lets them choose their own `team_id` and their own `role` — and a delete is refused by
-- `on delete restrict` anyway and would destroy the `removed_at` ADR-013 requires. No blanket
-- `grant update on public.member`, which is the whole of the first statement below.

-- AC-7, and it is held HERE rather than by a predicate. Nobody — not a member, not an admin — may
-- write `id`, `team_id`, `display_name`, `avatar` or `created_at`, so the privilege is simply
-- withheld and a statement naming any of them is refused with `42501 permission denied for column`
-- before any policy runs.
--
-- This is the shape `.ai/standards/rbac-and-security.md` known weakness 6 records as working on
-- `team` and NOT working on `entry`: a column grant cannot distinguish who is writing, so it works
-- exactly where the answer is "nobody". `team_id` is the one that matters and it is INV-07 — a
-- writable `team_id` moves a member between teams and every entry they own is counted against the
-- new one.
grant update (role, removed_at) on public.member to authenticated;

-- AC-6, AC-11, AC-12. Nothing about the caller's role or team is expressible in a grant, so it is
-- here. A member's UPDATE matches no row at all, which is a refusal and not an error — under
-- row-level security a refused update is FILTERED, so the seam treats zero rows returned as the
-- refusal it is (01-plan.md section 4.2).
--
-- `to authenticated`, never `to public`: a policy written `to public` re-opens the table to the anon
-- key, which ships in the browser bundle by design (rbac-and-security.md, "Secrets"). AC-12 is that
-- and TEA-01's `revoke all ... from anon` together.
--
-- The `with check` is REDUNDANT while `team_id` is ungranted, and is kept as the second lock: if a
-- later ticket ever grants that column, this policy already refuses a move across teams.
create policy member_update_admin on public.member
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id = public.member_team_id((select auth.uid()))
  )
  with check (
    team_id = public.member_team_id((select auth.uid()))
  );

-- What `WITH CHECK` cannot be. A policy sees only the new row, so no policy can say "this column did
-- not change" — `.ai/standards/rbac-and-security.md` known weakness 6 states the limitation and
-- names this exact remedy, a `BEFORE UPDATE` trigger comparing OLD and NEW. ADR-016 established the
-- shape, the naming and the SQLSTATE convention on `entry`; this follows it.
--
-- `security invoker`, following ADR-016: the function needs no privilege of its own. It reads
-- `auth.uid()` and nothing else, so nothing is elevated and nothing has to be reasoned about.
create function public.member_enforce_role_and_removal() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- AC-5. Demotion is denied for everybody, in every context. `Demote an admin to member` is ❌ for
  -- both roles in rbac-and-security.md, marked not decided — denied until it is. The refusal is
  -- asserted here rather than left to the absence of a control, because `role` is granted `update`
  -- for the promotion path and the column is therefore writable in exactly the direction that must
  -- be refused (ADR-005: a control that does not exist refuses nobody holding a token).
  if old.role = 'admin'::public.member_role and new.role is distinct from old.role then
    raise exception 'an admin may not be demoted' using errcode = '42501';
  end if;

  -- AC-10. `public.is_admin` filters `removed_at is null`, so a promoted removed member would hold a
  -- role that answers false everywhere — a row that says `admin` and behaves as nobody.
  if new.role is distinct from old.role and old.removed_at is not null then
    raise exception 'a removed member may not be promoted' using errcode = '42501';
  end if;

  -- Removal is one-way (01-plan.md section 1, Out of scope). Restoring a member is not a decided
  -- permission, and re-dating one is ADR-013's revert condition arriving as an ordinary UPDATE.
  if old.removed_at is not null and new.removed_at is distinct from old.removed_at then
    raise exception 'a removal may not be undone or re-dated' using errcode = '42501';
  end if;

  -- AC-9. A denial by DEFAULT rather than by decision, and narrower than the `Remove a member`
  -- permission row: the loss it prevents is a one-way door where the sole admin removes themselves,
  -- `is_admin` then answers false for everybody, no promotion is possible, and the roster is
  -- recoverable only by a human editing the database.
  --
  -- `v_uid is not null` so a migration, the SQL editor or a service-role call is not blocked —
  -- nothing blocks a service-role key anyway (known weakness 1). ADR-016 clause (a) does the same.
  if old.removed_at is null and new.removed_at is not null
     and v_uid is not null and old.id = v_uid then
    raise exception 'an admin may not remove themselves' using errcode = '42501';
  end if;

  -- AC-3. Provenance, never trusted from the wire — ADR-016 clause (b), same reasoning. This is the
  -- column INV-04's denominator is defined against and ADR-013's per-date condition reads, so a
  -- caller-supplied or backdated value is not a data-entry mistake: it is a silent rewrite of every
  -- past absence count. The write SUCCEEDS and the supplied value is discarded.
  if old.removed_at is null and new.removed_at is not null then
    new.removed_at := now();
  end if;

  return new;
end;
$$;

create trigger member_enforce_role_and_removal
  before update on public.member
  for each row execute function public.member_enforce_role_and_removal();
