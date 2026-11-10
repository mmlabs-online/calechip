-- MIR-02, 2026-10-20. A person cannot change their own `role`, `status` or `team_id`, and nobody
-- writes those three columns on `public.member` through a table statement. ADR-064 is the decision;
-- `.ai/board/tickets/MIR-02/01-plan.md` § 4.1 is the contract this file implements.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`. Before applying it, run
-- part 1 of `.ai/board/tickets/MIR-02/verification.md` — the reproduction — against the real
-- database; after, run part 2.
--
-- **THE HOLE.** Three column grants to `authenticated` composed with a self policy:
-- `20260901120000_tea04_member_writes.sql` grants `update (role, removed_at)`,
-- `20260910100000_solo_member_approval.sql` grants `update (status, team_id)`, and
-- `20260910093000_solo_profile_self_update.sql` adds `member_update_own`, which admits an UPDATE on
-- the caller's own row. Together they let any signed-in person — a pending sign-up included — make
-- themselves admin, admit themselves, or move themselves onto another team with one PATCH. No
-- trigger clause refused it: every existing clause is about somebody ELSE's row, demotion, or
-- removal.
--
-- **TWO LOCKS, ON PURPOSE** (01-plan.md § 8 alternative A). Step 2 revokes the three columns, which
-- is declarative and is checked before any policy runs. Step 1 adds a trigger clause, which holds on
-- every path including the definer functions the revoke does not reach. A later `create or replace`
-- of the trigger that loses the clause still leaves the revoke; a later grant that restores a column
-- still meets the clause.
--
-- **THIS SUPERSEDES IN EFFECT ONE SENTENCE OF `20260911180000_solo_many_teams.sql`**, quoted so the
-- reversal cannot be missed: *"Moving an admin — the caller included — is allowed"*. After this file
-- `public.move_member` naming the caller's own id is refused by the step 1 clause, because it changes
-- the caller's `team_id`. ADR-064 decision 3 and *Consequences*; the operator chose it ("a").
--
-- Nothing else: no policy is created, altered or dropped, and no table is altered.
-- `member_decide_admin` becomes inert for writes — it admits rows whose columns nobody may now write
-- — and is left in place, the choice `20260911180000_solo_many_teams.sql` made for the same policy.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The trigger. One clause added FIRST; every clause of the current body reproduced unchanged.
-- ---------------------------------------------------------------------------------------------
--
-- `create or replace` on `public.member_enforce_role_and_removal`, so the trigger created by
-- `20260901120000_tea04_member_writes.sql` keeps pointing at it and no trigger is dropped or
-- recreated. **THE BODY BELOW IS `20260910093000_solo_profile_self_update.sql` STEP 4, COPIED
-- CHARACTER FOR CHARACTER, COMMENTS INCLUDED**, with the MIR-02 clause inserted after the `begin`
-- and nothing else changed. A replace that quietly dropped a clause would remove a control earlier
-- tickets rest on, and the diff would look like an addition.
create or replace function public.member_enforce_role_and_removal() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- MIR-02, ADR-064 decision 3. **NOBODY HOLDING A USER TOKEN CHANGES THEIR OWN ROLE, STATUS OR
  -- TEAM, BY ANY PATH** — a table PATCH, or a definer function such as `move_member` called on the
  -- caller's own id. This trigger is `security invoker`, but `auth.uid()` reads the request's JWT
  -- claims, so inside a definer function it is still the caller and the clause still fires.
  --
  -- FIRST, before every other clause, so the refusal a self-escalation meets is this one and not a
  -- narrower sentence about demotion or removal.
  --
  -- `v_uid is not null` so a migration, the SQL editor or a service-role call is not blocked, the
  -- carve-out clauses (a) and (d) make. Nothing blocks a service-role key anyway (known weakness 1).
  -- `is distinct from`, so `team_id`, which is nullable, compares correctly against a null.
  if v_uid is not null and old.id = v_uid
     and (new.role    is distinct from old.role
       or new.status  is distinct from old.status
       or new.team_id is distinct from old.team_id) then
    raise exception 'a person may not change their own role, status or team'
      using errcode = '42501';
  end if;

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

-- ---------------------------------------------------------------------------------------------
-- 2. The revoke. Nobody writes these three columns through a table statement, on anybody's row.
-- ---------------------------------------------------------------------------------------------
--
-- Revokes what `tea04_member_writes.sql` (`role`) and `solo_member_approval.sql` (`status`,
-- `team_id`) granted. `removed_at`, `display_name` and `avatar` keep their grants, so removal and
-- the profile screen are untouched. Every legitimate write of the three now goes through a
-- `security definer` function, which runs as its owner and is not subject to this revoke:
-- `admit_member` and `reject_member` (status, team), `move_member` and `set_member_team` (team),
-- `set_member_role` (role).
revoke update (role, status, team_id) on public.member from authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. Rejecting a sign-up — the table update `decideMember` used to send.
-- ---------------------------------------------------------------------------------------------
--
-- Bounded exactly as `member_decide_admin` bounded the table write: an admin, any admin, and only a
-- row that is still pending with no team. `admit_member`'s shape and its two SQLSTATEs, so the seam
-- maps both halves of `decideMember` with one mapper and one sentence.
create or replace function public.reject_member(p_member_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can decide a sign-up' using errcode = '42501';
  end if;

  update public.member
     set status = 'rejected'::public.member_status, team_id = null
   where id = p_member_id
     and team_id is null
     and status = 'pending'::public.member_status;
  if not found then
    raise exception 'that sign-up is not waiting for a decision' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. The member edit panel's save — the table update `setMemberTeam` used to send.
-- ---------------------------------------------------------------------------------------------
--
-- **OWN TEAM ONLY, ON BOTH SIDES, WHICH IS WHAT `member_update_admin` ENFORCED.** Its `using` and
-- `with check` both carry `team_id = member_team_id(auth.uid())`, so the panel could only ever write
-- the team the member was already on. `move_member` was NOT reused for this (01-plan.md § 8
-- alternative B): it is any admin, any team, and the panel's save would have become a cross-team
-- write as a by-product of a security fix.
--
-- Returns the row, because `setMemberTeam` returns a `Member` and the seam reads it back from here.
create or replace function public.set_member_team(p_member_id uuid, p_team_id uuid)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_team uuid := public.member_team_id((select auth.uid()));
  v_row  public.member;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can move a member' using errcode = '42501';
  end if;

  update public.member m
     set team_id = p_team_id
   where m.id = p_member_id
     and m.team_id = v_team
     and p_team_id = v_team
  returning m.* into v_row;
  if not found then
    raise exception 'that member could not be moved' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 5. Who may call them.
-- ---------------------------------------------------------------------------------------------
-- THE REVOKE IS NOT COSMETIC. PostgreSQL grants `execute` on a new function to `public` by default,
-- so without it both functions are callable by `anon` — the trap `solo_many_teams.sql` step 4
-- records. `anon` would be refused by the admin test anyway; this makes it refused twice.
revoke all on function public.reject_member(uuid) from public;
grant execute on function public.reject_member(uuid) to authenticated;
revoke all on function public.set_member_team(uuid, uuid) from public;
grant execute on function public.set_member_team(uuid, uuid) to authenticated;

commit;
