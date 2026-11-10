-- MIR-21-f: `member.team_id`, `member_team_id()` and the mirror's insert branch are dropped.
--
-- Implements ADR-080 decision 4, as amended by ADR-081 decision 2
-- (.ai/board/tickets/MIR-21-f/01-plan.md § 4.1). After this file `public.membership` is the only
-- record of which teams a person is on.
--
-- Each step removes a dependant of the column before the column goes. **NO `cascade` ANYWHERE**:
-- a dependant the plan missed must fail this migration, not vanish silently.
--
-- The column's `update` grant was revoked by 20261020120000_mir02_member_self_writes.sql § 2 and
-- any column privilege goes with the column, so there is no `revoke` here. No data is rewritten.
--
-- **IRREVERSIBLE FOR THE COLUMN'S DATA.** After the drop the old `team_id` values exist only in
-- backups. Nothing has read them since MIR-21-d.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. `member_decide_admin` names the column in `using` and `with check`
--    (20261103120000_mir13_write_path_org_bound.sql § 5.5). Inert since MIR-02 revoked the
--    `status` and `team_id` grants: a decision is made only through `admit_member` and
--    `reject_member`.
-- ---------------------------------------------------------------------------------------------

drop policy if exists member_decide_admin on public.member;

-- ---------------------------------------------------------------------------------------------
-- 2. The self-lock loses its column clause. **THE BODY BELOW IS
--    20261020120000_mir02_member_self_writes.sql § 1, COPIED CHARACTER FOR CHARACTER, COMMENTS
--    INCLUDED**, except the first clause's `team_id` line and the comment that explained it. The
--    message is unchanged, so a self-move and a self-promotion meet one sentence (ADR-080
--    decision 1). The trigger is not touched.
-- ---------------------------------------------------------------------------------------------

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
  -- MIR-21-f: the team half of this lock is membership_refuse_own_rows (MIR-21-c, ADR-080).
  if v_uid is not null and old.id = v_uid
     and (new.role    is distinct from old.role
       or new.status  is distinct from old.status) then
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
-- 3. The mirror keeps only its removal branch, verbatim from
--    20261105210000_mir21b_writers_write_membership.sql § 4 (ADR-078 decision 6). The INSERT
--    branch goes: a member's teams are written to `membership` by the writers, never copied from a
--    column. The trigger no longer fires on INSERT.
-- ---------------------------------------------------------------------------------------------

create or replace function public.member_sync_membership() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  -- The day ADR-013 stops counting a removed member is the day their window closes (INV-04).
  if old.removed_at is null and new.removed_at is not null then
    update public.membership ms
       set left_at = greatest(new.removed_at, ms.joined_at), is_primary = false, updated_at = now()
     where ms.member_id = new.id
       and ms.left_at is null;
  end if;

  return null;
end;
$$;
revoke all on function public.member_sync_membership() from public, anon;

drop trigger if exists member_sync_membership on public.member;
create trigger member_sync_membership
  after update of removed_at on public.member
  for each row execute function public.member_sync_membership();

-- ---------------------------------------------------------------------------------------------
-- 4. `stamp_org_id` loses its `member` team lookup. **THE BODY BELOW IS
--    20261103120000_mir13_write_path_org_bound.sql § 2, COPIED CHARACTER FOR CHARACTER**, except
--    the `when 'member'` arm. No trigger is touched.
-- ---------------------------------------------------------------------------------------------

create or replace function public.stamp_org_id() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_shared uuid := (select o.id from public.org o where o.is_shared_tenant);
begin
  -- Nested, not `and`: `new.primary_team_id` exists only on `entry`, and PL/pgSQL resolves every
  -- field an expression names before it evaluates any of it.
  if tg_table_name = 'entry' then
    if new.primary_team_id is null then
      -- INV-07: the author's active primary team. Null for a member with none, and the column's
      -- `not null` then refuses the entry (AC-8).
      new.primary_team_id := public.member_primary_team_id(new.member_id);
    end if;
  end if;

  if new.org_id is not null then
    return new;
  end if;

  case tg_table_name
    when 'team', 'holiday' then
      -- The caller's org; the shared tenant when there is no caller (an owner-side insert).
      new.org_id := coalesce(public.member_org_id((select auth.uid())), v_shared);
    when 'member' then
      -- MIR-21-f: a member has no team column to look up. A sign-up lands in the shared tenant
      -- (ADR-071 decision 1); an owner-side insert into another org names `org_id`.
      new.org_id := v_shared;
    when 'entry', 'busy_day', 'issue_report' then
      new.org_id := (select m.org_id from public.member m where m.id = new.member_id);
    when 'event' then
      new.org_id := (select m.org_id from public.member m where m.id = new.creator_id);
    when 'notification' then
      new.org_id := (select m.org_id from public.member m where m.id = new.recipient_id);
    when 'event_invitee', 'event_attendance', 'event_guest_link', 'event_guest' then
      new.org_id := (select e.org_id from public.event e where e.id = new.event_id);
  end case;

  return new;
end;
$$;
revoke all on function public.stamp_org_id() from public, anon;

-- ---------------------------------------------------------------------------------------------
-- 5. `member_team_id(uuid)`. No policy and no function body reads it since MIR-21
--    (160-read-path-org-bound.test.sql AC-1).
-- ---------------------------------------------------------------------------------------------

drop function public.member_team_id(uuid);

-- ---------------------------------------------------------------------------------------------
-- 6. The index, then the column. The column's foreign key to `public.team` goes with it.
-- ---------------------------------------------------------------------------------------------

drop index if exists public.member_team_id_idx;
alter table public.member drop column team_id;

commit;
