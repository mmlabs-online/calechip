-- SOLO, 2026-09-11. Many teams: every admin may create, rename and delete (an empty) team, admit a
-- sign-up onto any team, and move an approved member between teams.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL.** No project is provisioned for this repository;
-- `.ai/registry/features.md` records `tests/permission-model.test.ts` as owed for that reason. This
-- file carries more authority than any migration before it, so that gap matters more here.
--
-- **THE OPERATOR'S THREE DECISIONS, 2026-09-11, asked as explicit questions with the costs stated:**
--   1. Every admin manages every team — two roles, as the charter says, and no third.
--   2. Only an EMPTY team may be deleted.
--   3. An approved member may be moved between teams, and their history follows them.
-- They reverse `.ai/standards/data-model.md`'s *"One row in v1"* and *"Refuse. No delete path exists
-- for a team in v1"*, and two rows of `rbac-and-security.md`. Those files are human plane; the
-- replacement wording and an ADR draft are printed in the reply for the operator to paste
-- (RULE-01). **This file must not be applied before that ADR exists.**
--
-- **WHY SEVEN FUNCTIONS AND NOT FOUR WIDER POLICIES.** The obvious shape is `create policy
-- team_select_admin_all ... using (is_admin(...))` and the same on `member`, then plain table
-- writes. It is refused for two concrete reasons found in this codebase, not on taste:
--   * An UPDATE or DELETE with a `WHERE`, and any `RETURNING`, is also checked against the SELECT
--     policies — so every cross-team write needs the admin to SELECT the other team's rows.
--   * Letting an admin SELECT every row SILENTLY CHANGES TWO EXISTING READS. `getTeam()` selects
--     `team` with no filter and `maybeSingle()` — for an admin it would start returning several rows
--     and throw on every screen that reads the threshold. `listMembers()` selects `member` with no
--     filter because `member_select_team` was the team boundary — for an admin it would start
--     returning EVERY team's people, and that list is INV-04's denominator on every calendar view.
-- A `security definer` function checks `is_admin` in its own body and changes no read anybody else
-- makes. The table policies below this line are exactly what they were.
--
-- **EACH FUNCTION IS THE CONTROL FOR ITS OPERATION, which is ADR-005 held in the datastore by a
-- different mechanism.** `security definer` runs as the function's owner and so bypasses row-level
-- security; that is the point, and it is why every body begins with the admin test. A function that
-- forgot that line would be an open door, which is the one review question to ask of each.
--
-- `set search_path = ''` and schema-qualified names throughout, the shape TEA-01's own definer
-- functions use: a definer function that resolved an unqualified name through a caller-controlled
-- search path could be steered into somebody else's table.
--
-- **IDEMPOTENT.** Applied by hand through the SQL editor (ADR-024): `create or replace` throughout,
-- and the grants are idempotent by nature.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The two cross-team READS.
-- ---------------------------------------------------------------------------------------------
-- Non-admins get an EMPTY set rather than an error, the shape every other admin read uses: a
-- policy that matches nothing is not a refusal, and a screen asking is told "no teams" rather than
-- "forbidden".

create or replace function public.list_teams() returns setof public.team
  language sql stable security definer set search_path = '' as $$
  select t.*
    from public.team t
   where public.is_admin((select auth.uid()))
   order by t.created_at, t.id;
$$;

-- REMOVED MEMBERS INCLUDED, because the screen needs them to say why a team cannot be deleted
-- (`member.team_id ... on delete restrict` counts them). Pending sign-ups have no team and are
-- `member_select_pending_admin`'s — they are not here.
create or replace function public.list_all_members() returns setof public.member
  language sql stable security definer set search_path = '' as $$
  select m.*
    from public.member m
   where public.is_admin((select auth.uid()))
     and m.team_id is not null
   order by m.created_at, m.id;
$$;

-- ---------------------------------------------------------------------------------------------
-- 2. Create, rename and delete a team.
-- ---------------------------------------------------------------------------------------------
-- SQLSTATEs, which the seam maps and never parses the message of:
--   42501  not an admin, or the row named does not exist
--   22023  an empty name
--   23503  the team still has people on it

create or replace function public.create_team(p_name text) returns public.team
  language plpgsql security definer set search_path = '' as $$
declare v_row public.team;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can create a team' using errcode = '42501';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'a team needs a name' using errcode = '22023';
  end if;

  -- `overload_threshold` and `created_at` take their column defaults: 0.5 and now().
  insert into public.team (name) values (btrim(p_name)) returning * into v_row;
  return v_row;
end;
$$;

-- ANY team, by id — decision 1. The previous migration's `grant update (name)` and
-- `team_update_admin` still let an admin rename their OWN team through a table update; nothing in
-- `src/` uses that path any more, and it is left rather than revoked because it grants nothing this
-- function does not.
create or replace function public.rename_team(p_team_id uuid, p_name text) returns public.team
  language plpgsql security definer set search_path = '' as $$
declare v_row public.team;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can rename a team' using errcode = '42501';
  end if;
  if btrim(coalesce(p_name, '')) = '' then
    raise exception 'a team needs a name' using errcode = '22023';
  end if;

  update public.team set name = btrim(p_name) where id = p_team_id returning * into v_row;
  if not found then
    raise exception 'no such team' using errcode = '42501';
  end if;
  return v_row;
end;
$$;

-- ONLY AN EMPTY TEAM — decision 2. "Empty" is the foreign key's definition: ANY member row naming the
-- team, removed ones included. ADR-013 keeps a removed member's row for history, so a team that has
-- ever had somebody removed can never be deleted — stated here and on the screen rather than found
-- out. The explicit test gives a legible refusal; `on delete restrict` is the second lock and would
-- raise the same SQLSTATE if this test were ever wrong.
create or replace function public.delete_team(p_team_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can delete a team' using errcode = '42501';
  end if;
  if exists (select 1 from public.member m where m.team_id = p_team_id) then
    raise exception 'a team with people on it cannot be deleted' using errcode = '23503';
  end if;

  delete from public.team where id = p_team_id;
  if not found then
    raise exception 'no such team' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Putting people on teams.
-- ---------------------------------------------------------------------------------------------

-- Admit a waiting sign-up onto ANY team — decision 1. `member_decide_admin` is left in place and is
-- still what a REJECTION goes through; its `with check` confines an approval to the admin's own team
-- and is therefore no longer on the approve path. Not dropped: a policy nothing uses grants nothing,
-- and removing it would be a second change to review for no gain.
create or replace function public.admit_member(p_member_id uuid, p_team_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can decide a sign-up' using errcode = '42501';
  end if;
  if not exists (select 1 from public.team t where t.id = p_team_id) then
    raise exception 'no such team' using errcode = '42501';
  end if;

  update public.member
     set status = 'approved'::public.member_status, team_id = p_team_id
   where id = p_member_id
     and team_id is null
     and status = 'pending'::public.member_status;
  if not found then
    raise exception 'that sign-up is not waiting for a decision' using errcode = '42501';
  end if;
end;
$$;

-- Move an approved, not-removed member to another team — decision 3.
--
-- **HISTORY FOLLOWS THE PERSON, AND THE OPERATOR CHOSE THAT KNOWING IT.** `entry` has no `team_id`;
-- INV-07 counts an entry against the team its member belongs to NOW. After this runs, every past
-- absence of this person leaves the old team's calendar and appears in the new team's past, and the
-- old team's past absence counts change. INV-07 still holds as written.
--
-- IT WRITES `team_id` AND NOTHING ELSE. Role, removal and status are untouched, so
-- `member_enforce_role_and_removal` (TEA-04) passes on every clause, and an admin moving somebody
-- gains no power to promote or remove them on a team the admin is not on.
--
-- A removed member is refused rather than moved: their row stays on the team they left, for
-- ADR-013's history. Moving an admin — the caller included — is allowed; moving a team's last admin
-- away leaves that team with nobody able to approve its entries until an admin promotes somebody.
create or replace function public.move_member(p_member_id uuid, p_team_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can move somebody between teams' using errcode = '42501';
  end if;
  if not exists (select 1 from public.team t where t.id = p_team_id) then
    raise exception 'no such team' using errcode = '42501';
  end if;

  update public.member
     set team_id = p_team_id
   where id = p_member_id
     and team_id is not null
     and status = 'approved'::public.member_status
     and removed_at is null;
  if not found then
    raise exception 'that person cannot be moved' using errcode = '42501';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------------------------
-- 4. Who may call them.
-- ---------------------------------------------------------------------------------------------
-- THE REVOKE IS NOT COSMETIC. PostgreSQL grants `execute` on a new function to `public` by default,
-- so without it every function above is callable by `anon` — ADM-06 recorded the same trap on
-- `reject_entries`. `anon` would be refused by the admin test anyway; this makes it refused twice.

revoke all on function public.list_teams() from public;
revoke all on function public.list_all_members() from public;
revoke all on function public.create_team(text) from public;
revoke all on function public.rename_team(uuid, text) from public;
revoke all on function public.delete_team(uuid) from public;
revoke all on function public.admit_member(uuid, uuid) from public;
revoke all on function public.move_member(uuid, uuid) from public;

grant execute on function public.list_teams() to authenticated;
grant execute on function public.list_all_members() to authenticated;
grant execute on function public.create_team(text) to authenticated;
grant execute on function public.rename_team(uuid, text) to authenticated;
grant execute on function public.delete_team(uuid) to authenticated;
grant execute on function public.admit_member(uuid, uuid) to authenticated;
grant execute on function public.move_member(uuid, uuid) to authenticated;

commit;
