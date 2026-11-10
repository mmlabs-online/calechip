-- MIR-21-c: ADR-064 decision 3's self lock reaches `membership`, and the sign-up trigger stops naming
-- the team column.
--
-- Implements ADR-080 decision 1, within ADR-078 decision 6 (.ai/board/tickets/MIR-21-c/01-plan.md
-- § 4.1):
--
--   1. the security-invoker trigger function `membership_refuse_own_rows()` and a before-row trigger
--      on `public.membership` that refuses a write to the caller's own rows
--   2. `admit_allow_listed_member()` re-created without the team column in its insert
--
-- Today the lock holds only because every writer assigns `member.team_id` before it writes
-- `membership`, and `member_enforce_role_and_removal` refuses that change on the caller's own row.
-- MIR-21-d stops the assignment; from then on the refusal a self-move meets is the one below, with
-- the same message and errcode. During this slice both fire on a self-move, and the column clause
-- answers first.
--
-- No table, column, constraint, policy or table grant changes.
--
-- **IDEMPOTENT** (ADR-024): `create or replace` for each function, `drop trigger if exists` before
-- the trigger.
--
-- Applying this file to a remote database is human (RULE-09).

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The lock (01-plan.md § 4.1; ADR-080 decision 1).
-- ---------------------------------------------------------------------------------------------

-- ADR-064 decision 3, on `membership` (ADR-080 decision 1). Nobody holding a user token writes their
-- own membership rows, by any path. `security invoker`: `auth.uid()` reads the request's claims, so
-- inside a definer function it is still the caller. A null uid is the owner, a migration or a script.
create or replace function public.membership_refuse_own_rows() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is not null then
    if tg_op in ('INSERT', 'UPDATE') then
      if new.member_id = v_uid then
        raise exception 'a person may not change their own role, status or team'
          using errcode = '42501';
      end if;
    end if;
    if tg_op in ('UPDATE', 'DELETE') then
      if old.member_id = v_uid then
        raise exception 'a person may not change their own role, status or team'
          using errcode = '42501';
      end if;
    end if;
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;
revoke all on function public.membership_refuse_own_rows() from public, anon, authenticated;

drop trigger if exists membership_refuse_own_rows on public.membership;
create trigger membership_refuse_own_rows
  before insert or update or delete on public.membership
  for each row execute function public.membership_refuse_own_rows();

-- ---------------------------------------------------------------------------------------------
-- 2. The sign-up trigger (01-plan.md § 4.1).
-- ---------------------------------------------------------------------------------------------
-- Re-created from its LATEST definition, `20260913090000_solo_avatar_images.sql` lines 46-81, with
-- one change: the insert no longer names the team column, so the column takes its default, which is
-- null, and the row inserted is the same row as before. The comment that described that column is
-- reworded to match. Every other line — the guards, the hard-coded role, the exception handler — is
-- copied unchanged, and the trigger that points at this function is not touched.
create or replace function public.admit_allow_listed_member() returns trigger
  language plpgsql security definer set search_path = extensions as $$
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;   -- already admitted on an earlier confirmation
  end if;

  -- NO ALLOW-LIST LOOKUP. That is the whole change: the row is created for anybody who confirms an
  -- address, and an admin decides afterwards.
  --
  -- The team is never written here (ADR-080), and `status` takes its `pending` default. `role` is
  -- still hard-coded and still never read from `raw_user_meta_data`, which is whatever the caller passed to `signUp` —
  -- TEA-01 AC-9, and it matters more now than it did, because the caller is no longer somebody an
  -- admin has already vouched for.
  insert into public.member (id, display_name, avatar, role)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
             split_part(new.email, '@', 1)),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'avatar'), ''), '1.png'),
    'member'::public.member_role
  )
  on conflict (id) do nothing;

  return new;
exception when others then
  -- A trigger on auth.users that raises makes signUp fail outright. The whole block rolls back
  -- together and the warning is what makes the failure findable — TEA-01's reasoning, unchanged.
  raise warning 'admit_allow_listed_member failed for auth user %: %', new.id, sqlerrm;
  return new;
end;
$$;

commit;
