-- SOLO, 2026-09-10. A member edits their own display name and avatar. No ticket and no plan;
-- `.claude/agents/solo.md` and ADR-033 are the authority, and the operator's instruction in words is
-- what this records: allow a person to change their avatar icon, their password and their display
-- name from a profile screen.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **THIS FILE REVERSES A SENTENCE IN `20260901120000_tea04_member_writes.sql`, DELIBERATELY, AND THE
-- SENTENCE IS QUOTED HERE SO THE REVERSAL CANNOT BE MISSED.** That file's grant comment reads:
-- *"Nobody — not a member, not an admin — may write `id`, `team_id`, `display_name`, `avatar` or
-- `created_at`, so the privilege is simply withheld"*. Two of those five are granted below.
--
-- **THE THREE THAT MATTER ARE UNTOUCHED AND STAY UNTOUCHED.** `id`, `team_id` and `created_at` are
-- still ungranted to everybody. `team_id` is the one carrying INV-07 — a writable `team_id` moves a
-- member between teams and every entry they own is recounted against the new one — and nothing here
-- comes near it. TEA-04's other permanent prohibitions also stand: no `insert` policy and no
-- `delete` policy on `public.member`, now or by any later edit.
--
-- *Corrected 2026-10-20 by MIR-02 (ADR-064).* The sentence above stopped being true at
-- `20260910100000_solo_member_approval.sql:173`, which granted `update (status, team_id)` to
-- `authenticated` the same day. `20261020120000_mir02_member_self_writes.sql` revokes it again,
-- with `role`, and adds the trigger clause that refuses a person changing their own `team_id`.
--
-- **THE RISK THIS FILE CREATES, NAMED BEFORE IT IS FENCED.** `member_update_admin` already lets an
-- admin UPDATE any row in their own team — it exists for promotion and removal. A bare column grant
-- would therefore hand every admin the ability to rename any member and change their face, silently,
-- with no control anywhere refusing it and no row in `.ai/standards/rbac-and-security.md` permitting
-- it. **A policy cannot close this**: a policy sees only the new row, so no `with check` can say
-- *this column did not change* — `.ai/standards/rbac-and-security.md` known weakness 6 states the
-- limitation and names the remedy, a `BEFORE UPDATE` trigger comparing OLD and NEW. That is step 3.
--
-- **WHAT `.ai/standards/rbac-and-security.md` DOES NOT SAY.** Its permission table has no row for
-- *edit your own display name or avatar* and none for *change your own password*. That file is
-- human-owned, so this migration does not edit it; the two rows to add are printed for the operator
-- in the reply that shipped this work. Until they are pasted, the standard and the datastore
-- disagree, and the datastore is the one that is enforcing.

-- ---------------------------------------------------------------------------
-- 1. The grant. Two columns, named one at a time, and never `grant update on public.member`.
-- ---------------------------------------------------------------------------
--
-- This is additive to TEA-04's `grant update (role, removed_at)`: a second column grant does not
-- replace the first, so `authenticated` ends up holding update on exactly four named columns.
grant update (display_name, avatar) on public.member to authenticated;

-- ---------------------------------------------------------------------------
-- 2. The policy. A member may update their OWN row, which they previously could not do at all.
-- ---------------------------------------------------------------------------
--
-- `member_select_own` from TEA-01 already lets them READ it; this is the write half and it is a new
-- policy rather than a widening of `member_update_admin`, so that policy's reasoning stays about
-- promotion and removal and this one's stays about self-service. Postgres ORs permissive policies,
-- which is what makes an admin editing their own profile match this one.
--
-- `removed_at is null`: somebody who has left the team does not edit their face on a roster they are
-- no longer on. TEA-04's trigger already makes removal one-way, so this cannot be undone by writing
-- the column back — and `removed_at` is not writable by a member anyway.
--
-- `to authenticated`, never `to public`: a policy written `to public` re-opens the table to the anon
-- key, which ships in the browser bundle by design.
--
-- The `with check` repeats the `using` clause rather than trusting it. `using` decides which rows are
-- visible to the update; `with check` decides what the row may become. Without it a caller could not
-- change WHOSE row this is — `id` is ungranted — but the second lock costs nothing and holds if a
-- later ticket ever grants that column.
create policy member_update_own on public.member
  for update to authenticated
  using (id = (select auth.uid()) and removed_at is null)
  with check (id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- 3. THERE IS NO CHECK CONSTRAINT ON `avatar`, AND THE FIRST DRAFT OF THIS FILE HAD ONE.
-- ---------------------------------------------------------------------------
--
-- It read `check (avatar in (…the thirty-two values the picker offers…))`. **IT WOULD HAVE ABORTED
-- THIS ENTIRE MIGRATION ON EXISTING DATA, WHICH IS HOW IT WAS FOUND** — a PATCH from the profile
-- screen answered `42501 permission denied for table member`, meaning the grant in step 1 had never
-- been created, because `alter table … add constraint` validates every existing row and one row
-- failed. The constraint is removed rather than widened, for three reasons that are all the same
-- reason: **the datastore itself produces avatars this list cannot contain.**
--
--  1. `supabase/seed.sql:170` inserts the operator's own admin account with its avatar written as a
--     backslash-u escape rather than as the character itself. **THE ESCAPE IS NOT SPELLED OUT IN
--     THIS COMMENT ON PURPOSE:** an editor normalised the first draft of this paragraph, turning the
--     escape into the star it denotes and leaving the sentence claiming that a one-character string
--     is six characters long. Open the seed line to see it.
--
--     Inside the `jsonb` literal on the `auth.users` row above it the escape RESOLVES, and the auth
--     user's metadata holds one star character. In the plain single-quoted SQL string on the
--     `public.member` row below it, with `standard_conforming_strings` on — the default — it does
--     NOT: that row holds the six characters of the escape sequence itself. Either way the value is
--     not one of the thirty-two. **That is a seed defect and it is reported rather than repaired
--     here: only a human can change a row in a provisioned project, and rewriting the seed file
--     would not touch one.**
--  2. `20260831150024_tea01_membership.sql:117` — the admission trigger — falls back to `'🙂'` when
--     sign-up carries no avatar. A constraint excluding it would turn that fallback into a failed
--     sign-up, months from now, in a code path nobody was editing.
--  3. The list would have been duplicated between here and `src/lib/domain/types.ts`, so a
--     thirty-third avatar would mean editing two files and the day somebody edited one, the picker
--     would offer a value the datastore refuses.
--
-- **WHAT ENFORCES THE OFFERED SET INSTEAD.** `updateOwnProfile` in both seam implementations refuses
-- an avatar that is neither one of `AVATAR_CHOICES` nor the caller's own current value — the second
-- clause is what lets somebody holding the seed's escape sequence, or the trigger's fallback face,
-- save their display name at all. `avatar`
-- therefore has exactly the protection `display_name` has, which is none at the column and a rule at
-- the seam, and the two columns being alike is easier to keep true than one exception.
--
-- **THE COST, STATED:** a caller with a token and an HTTP client can set their avatar to any text.
-- They can already do that to their display name. Neither is a permission and neither crosses a team
-- boundary — INV-07 is `team_id`, which nobody may write.

-- ---------------------------------------------------------------------------
-- 4. The trigger. Two new clauses; every clause TEA-04 wrote is reproduced unchanged.
-- ---------------------------------------------------------------------------
--
-- `create or replace` on `public.member_enforce_role_and_removal`, so the trigger created by
-- `20260901120000_tea04_member_writes.sql` keeps pointing at it and no trigger is dropped or
-- recreated. **THE FOUR TEA-04 CLAUSES BELOW ARE COPIED CHARACTER FOR CHARACTER, COMMENTS INCLUDED.**
-- A replace that quietly dropped one would remove a control that five acceptance criteria rest on,
-- and the diff would look like an addition.
create or replace function public.member_enforce_role_and_removal() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- SOLO, 2026-09-10, clause (a). **THE FENCE AROUND THE NEW COLUMN GRANT.** `display_name` and
  -- `avatar` may be changed only by the person the row is about. Without this, step 1's grant plus
  -- the pre-existing `member_update_admin` would let any admin rename any member of their team —
  -- a permission nobody granted and no row in `.ai/standards/rbac-and-security.md` describes.
  --
  -- It is HERE and not in a policy because a policy sees only the new row and therefore cannot say
  -- *these two columns did not change* (known weakness 6). `is distinct from` and not `<>`, so a
  -- null on either side compares correctly — neither column is nullable today, and a comparison that
  -- depends on that staying true is a comparison that fails silently the day it stops.
  --
  -- `v_uid is not null` so a migration, the SQL editor or a service-role call is not blocked, the
  -- same carve-out clause (d) below makes. Nothing blocks a service-role key anyway.
  if v_uid is not null and old.id is distinct from v_uid
     and (new.display_name is distinct from old.display_name
          or new.avatar is distinct from old.avatar) then
    raise exception 'only the member themselves may change their display name or avatar'
      using errcode = '42501';
  end if;

  -- SOLO, 2026-09-10, clause (b). A display name is trimmed and may not be blank. The column is
  -- `text not null` with no check constraint, so '' and '   ' both satisfy the table today and would
  -- render as an empty row in the roster and an empty name on every entry chip.
  --
  -- **TRIMMED HERE, WHICH MEANS THE DATASTORE DECIDES WHAT WAS SAVED.** `updateOwnProfile` in both
  -- seam implementations trims before sending, so this normally changes nothing; it holds for a
  -- caller that is not this application, and it is the reason the seam trims rather than the reason
  -- it does not have to.
  --
  -- NO UPPER BOUND. There is no length limit on this column anywhere — not in TEA-01's table, not in
  -- `.ai/standards/data-model.md`, not at sign-up — and inventing one here would be a rule the other
  -- writer of this column does not apply.
  if new.display_name is distinct from old.display_name then
    new.display_name := btrim(new.display_name);
    if new.display_name = '' then
      raise exception 'a display name may not be blank' using errcode = '23514';
    end if;
  end if;

  -- TEA-04 AC-5. Demotion is denied for everybody, in every context. `Demote an admin to member` is
  -- ❌ for both roles in rbac-and-security.md, marked not decided — denied until it is. The refusal
  -- is asserted here rather than left to the absence of a control, because `role` is granted `update`
  -- for the promotion path and the column is therefore writable in exactly the direction that must
  -- be refused (ADR-005: a control that does not exist refuses nobody holding a token).
  if old.role = 'admin'::public.member_role and new.role is distinct from old.role then
    raise exception 'an admin may not be demoted' using errcode = '42501';
  end if;

  -- TEA-04 AC-10. `public.is_admin` filters `removed_at is null`, so a promoted removed member would
  -- hold a role that answers false everywhere — a row that says `admin` and behaves as nobody.
  if new.role is distinct from old.role and old.removed_at is not null then
    raise exception 'a removed member may not be promoted' using errcode = '42501';
  end if;

  -- Removal is one-way (TEA-04 01-plan.md section 1, Out of scope). Restoring a member is not a
  -- decided permission, and re-dating one is ADR-013's revert condition arriving as an ordinary
  -- UPDATE.
  if old.removed_at is not null and new.removed_at is distinct from old.removed_at then
    raise exception 'a removal may not be undone or re-dated' using errcode = '42501';
  end if;

  -- TEA-04 AC-9. A denial by DEFAULT rather than by decision, and narrower than the `Remove a member`
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

  -- TEA-04 AC-3. Provenance, never trusted from the wire — ADR-016 clause (b), same reasoning. This
  -- is the column INV-04's denominator is defined against and ADR-013's per-date condition reads, so
  -- a caller-supplied or backdated value is not a data-entry mistake: it is a silent rewrite of every
  -- past absence count. The write SUCCEEDS and the supplied value is discarded.
  if old.removed_at is null and new.removed_at is not null then
    new.removed_at := now();
  end if;

  return new;
end;
$$;
