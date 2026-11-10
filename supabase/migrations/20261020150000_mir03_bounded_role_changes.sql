-- MIR-03, 2026-10-20. Role changes are bounded to the admin's own team, promotion to admin is its
-- own function, and every role change records its actor.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **SUPERSEDES ADR-044 DECISION 1** — ADR-065, accepted by the operator on 2026-10-20
-- ("Q1. A / Q2. A"). `.ai/board/tickets/MIR-03/01-plan.md` § 4.1 is the contract this file
-- implements, and its `verification.md` is the verification of record until MIR-05.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL.** `tests/role-change-bounds.test.ts` reads this file
-- statically and drives the mock; neither runs it.
--
-- WHAT CHANGES:
--   (a) `public.member_role_change`, the record. RLS on, no policy, every privilege revoked from
--       `public`, `anon` and `authenticated`: nobody reads or writes it through the API.
--   (b) `public.member_record_role_change()`, an AFTER UPDATE OF role trigger on `public.member`
--       that writes one row per changed role, whoever issued the statement. A change from outside
--       any authenticated request (the SQL editor) is recorded with `changed_by` null, which is the
--       honest actor for it.
--   (c) `public.set_member_role`, same signature: own team only, and it refuses `admin`.
--   (d) `public.promote_member_to_admin(uuid)`, new: the one path to `admin`, own team only.
--
-- `member_enforce_role_and_removal` is NOT replaced. It still fires before both updates, and its
-- clauses stand behind the `where`.
--
-- `set search_path = ''` and schema-qualified names throughout. IDEMPOTENT: `if not exists`,
-- `create or replace`, `drop trigger if exists`, and grants that are idempotent by nature.

begin;

-- ---------------------------------------------------------------------------------------------
-- (a) The record.
-- ---------------------------------------------------------------------------------------------
-- `on delete restrict` on both references, matching `entry.approved_by`: a member row with a role
-- history cannot be deleted out from under it.
create table if not exists public.member_role_change (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.member (id) on delete restrict,
  from_role   public.member_role not null,
  to_role     public.member_role not null,
  changed_by  uuid references public.member (id) on delete restrict,
  changed_at  timestamptz not null default now()
);

-- No policy is created, on purpose: with RLS on and no policy, every API read answers no rows and
-- every API write is refused. The revoke makes it refused twice. Reading it in the product is MIR-20.
alter table public.member_role_change enable row level security;
revoke all on table public.member_role_change from public, anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- (b) The recording trigger.
-- ---------------------------------------------------------------------------------------------
-- A TRIGGER AND NOT AN INSERT IN EACH FUNCTION (plan § 8 B): it covers every path that changes
-- `role`, including the SQL editor and any function written later.
--
-- `security definer` because the caller holds no privilege on the table. `auth.uid()` still answers
-- the REAL caller inside it, because it reads a per-request setting and not the current role; outside
-- a request it is null. `changed_at` takes the column default, so it is the database's clock.
create or replace function public.member_record_role_change() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.member_role_change (member_id, from_role, to_role, changed_by)
  values (new.id, old.role, new.role, (select auth.uid()));
  return null;
end;
$$;
revoke all on function public.member_record_role_change() from public;

-- The `when` clause is what keeps an update that writes `role` without changing it from adding a row.
drop trigger if exists member_record_role_change on public.member;
create trigger member_record_role_change
  after update of role on public.member
  for each row
  when (old.role is distinct from new.role)
  execute function public.member_record_role_change();

-- ---------------------------------------------------------------------------------------------
-- (c) The rank write, bounded.
-- ---------------------------------------------------------------------------------------------
-- 20260924100000_solo_cross_team_role.sql's body with two changes, and that file's header is still
-- the authority for the other conditions:
--   * `p_role = 'admin'` is refused before the update. Promotion is (d). ADR-065 decision 2.
--   * `m.team_id = public.member_team_id(auth.uid())` replaces `m.team_id is not null`. ADR-065
--     decision 1. The equality cannot match a null `team_id`, and the caller is an admin, who always
--     has a team, so a pending sign-up is still refused.
create or replace function public.set_member_role(p_member_id uuid, p_role public.member_role)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.member;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can change a rank' using errcode = '42501';
  end if;

  -- ADR-065 decision 2.
  if p_role = 'admin'::public.member_role then
    raise exception 'promotion to admin is promote_member_to_admin, not a rank change'
      using errcode = '42501';
  end if;

  update public.member m
     set role = p_role
   where m.id = p_member_id
     -- ADR-065 decision 1. Also excludes a null team_id: the caller is an admin and has a team.
     and m.team_id = public.member_team_id((select auth.uid()))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'admin'::public.member_role
  returning m.* into v_row;

  -- Not on the caller's team, pending, removed, an admin, or nobody. One answer on purpose.
  if not found then
    raise exception 'that rank could not be changed' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

revoke all on function public.set_member_role(uuid, public.member_role) from public;
grant execute on function public.set_member_role(uuid, public.member_role) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- (d) The promotion.
-- ---------------------------------------------------------------------------------------------
-- ITS OWN FUNCTION AND NOT A FLAG ON (c) (plan § 8 C): a flag the client sets is not a gate. Later
-- work can re-point this at another role (MIR-16) without touching the rank write. The `where` is
-- (c)'s, and `role <> 'admin'` keeps an admin from being "promoted" again or reached on their own row.
create or replace function public.promote_member_to_admin(p_member_id uuid)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.member;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can promote a member' using errcode = '42501';
  end if;

  update public.member m
     set role = 'admin'::public.member_role
   where m.id = p_member_id
     and m.team_id = public.member_team_id((select auth.uid()))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'admin'::public.member_role
  returning m.* into v_row;

  if not found then
    raise exception 'that member could not be promoted' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

-- PostgreSQL grants `execute` to `public` by default; without the revoke `anon` could call it.
revoke all on function public.promote_member_to_admin(uuid) from public;
grant execute on function public.promote_member_to_admin(uuid) to authenticated;

commit;
