-- SOLO, 2026-09-10. A person signs up, gets a `member` row immediately, and waits for an admin to
-- approve them and put them on a team. The allow-list is gone.
--
-- **THIS SUPERSEDES ADR-009 AND NO ADR RECORDS THAT YET.** ADR-009 (`ACCEPTED by the operator`,
-- 2026-08-31) decided *"a person joins by signing themselves up; an admin controls who may"*, with
-- the allow-list as the gate and a trigger that admits ONLY a listed address. The operator's
-- instruction of 2026-09-10 keeps the first half and replaces the gate: everyone gets in the door
-- and an admin decides afterwards. `solo` cannot write `.ai/registry/**` (RULE-01) — the superseding
-- ADR is printed in the reply for the operator to paste, and this file must not be applied before it
-- exists.
--
-- **THE ONE LINE THAT CARRIES THE WHOLE SECURITY MODEL IS `member_team_id`.** Every row-level policy
-- in this product is keyed on it, so gating it on approval gates all of them at once and no policy
-- below TEA-01 has to change. Without that clause a stranger who signed up would read and write the
-- whole team's calendar between signing up and being rejected — which is what the allow-list
-- prevented and what this migration must not give away.
--
-- **`team_id` BECOMES NULLABLE, AND THE OPERATOR CHOSE THAT WHEN ASKED.** The admin picks the team
-- at approval, so there is nothing to put in the column at sign-up. INV-07 is untouched: it says an
-- ENTRY is counted only against the team its member belongs to, and a member with no team has no
-- entries — `entry_insert_own` is keyed on `member_team_id`, which returns null for them.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The state a signed-up person is in.
-- ---------------------------------------------------------------------------------------------
-- Three values and not a boolean: `pending` and `rejected` are different answers, and folding them
-- would make a rejected person indistinguishable from one still waiting on the screen that lists
-- them. The same shape `public.entry_status` already uses.
-- **IDEMPOTENT, AND THAT IS NOT TIDINESS.** This file is applied BY HAND through the Supabase SQL
-- editor (ADR-024), so a run that fails half way leaves the schema part-changed and the operator
-- re-runs it. Every statement below therefore has to survive being run twice. `create type` has no
-- `if not exists`, so it is wrapped.
do $$
begin
  create type public.member_status as enum ('pending', 'approved', 'rejected');
exception when duplicate_object then null;
end $$;

-- DEFAULT `approved` FOR THE BACKFILL, THEN `pending` FOR EVERY ROW AFTER IT. Every member that
-- exists when this runs is one an admin already let in under the allow-list, so they are approved by
-- construction; a default of `pending` here would lock the entire team out of its own product in one
-- statement.
alter table public.member
  add column if not exists status public.member_status not null default 'approved'::public.member_status;
alter table public.member alter column status set default 'pending'::public.member_status;

-- Nullable from here: a pending member has no team until an admin gives them one.
alter table public.member alter column team_id drop not null;

-- ---------------------------------------------------------------------------------------------
-- 2. The gate. One function, and every policy in the product inherits it.
-- ---------------------------------------------------------------------------------------------
-- `create or replace` rather than drop-and-create: the function is referenced by a dozen policies
-- and dropping it would drop them with it.
create or replace function public.member_team_id(p_uid uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select m.team_id from public.member m
  where m.id = p_uid
    and m.removed_at is null
    and m.status = 'approved'::public.member_status;
$$;

-- `is_admin` gets the same clause, for the reason that is easy to miss: a member could be created
-- with `role = 'admin'`... which they cannot, because the trigger below hard-codes `'member'`. The
-- clause is added anyway so that an admin who is later REJECTED stops being an admin, rather than
-- keeping every admin power while having no team.
create or replace function public.is_admin(p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.member m
    where m.id = p_uid
      and m.removed_at is null
      and m.status = 'approved'::public.member_status
      and m.role = 'admin'::public.member_role
  );
$$;

-- ---------------------------------------------------------------------------------------------
-- 3. Everyone gets a row. Nobody gets a team.
-- ---------------------------------------------------------------------------------------------
-- Replaces `admit_allow_listed_member`. The trigger keeps its name and its timing so nothing else
-- has to move: `after insert or update of email_confirmed_at on auth.users`, which fires exactly
-- once whether the project confirms email addresses or not (with `Confirm email` OFF Supabase sets
-- `email_confirmed_at` at insert time). `src/lib/config.ts` records the same fact from the other
-- side.
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
  -- `team_id` is left NULL and `status` takes its `pending` default. `role` is still hard-coded and
  -- still never read from `raw_user_meta_data`, which is whatever the caller passed to `signUp` —
  -- TEA-01 AC-9, and it matters more now than it did, because the caller is no longer somebody an
  -- admin has already vouched for.
  insert into public.member (id, team_id, display_name, avatar, role)
  values (
    new.id,
    null,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
             split_part(new.email, '@', 1)),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'avatar'), ''), '🙂'),
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

-- ---------------------------------------------------------------------------------------------
-- 4. The admin's view of, and power over, people who are waiting.
-- ---------------------------------------------------------------------------------------------
-- **`member_select_team` CANNOT SEE THEM AND THAT IS NOT A BUG TO FIX THERE.** It is scoped to
-- `team_id = member_team_id(auth.uid())`, and a pending member's `team_id` is null, so no team-
-- scoped policy will ever match one. This is the policy that does, and it is deliberately NOT
-- team-scoped: there is nothing to scope it by until the decision is made.
--
-- THE CONSEQUENCE, STATED RATHER THAN DISCOVERED LATER: with more than one team, EVERY admin sees
-- EVERY pending sign-up and any of them may claim a person for their own team. v1 has one team
-- (`.ai/standards/data-model.md`), so it costs nothing today; it is the first thing to revisit if a
-- second team is ever created.
drop policy if exists member_select_pending_admin on public.member;
create policy member_select_pending_admin on public.member
  for select to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id is null
    and status <> 'approved'::public.member_status
  );

-- The decision. `using` admits only rows that are still waiting, so this cannot be used to re-decide
-- somebody already on a team — that is `member_update_admin`'s territory and its team scope.
--
-- `with check` is what stops the update being a way to put somebody on ANOTHER team: whatever team
-- is written must be the deciding admin's own. A rejection writes no team at all, which is the
-- `team_id is null` half of the disjunction.
drop policy if exists member_decide_admin on public.member;
create policy member_decide_admin on public.member
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id is null
    and status = 'pending'::public.member_status
  )
  with check (
    public.is_admin((select auth.uid()))
    and (
      (status = 'approved'::public.member_status
         and team_id = public.member_team_id((select auth.uid())))
      or (status = 'rejected'::public.member_status and team_id is null)
    )
  );

-- COLUMN-SCOPED, the lesson ADM-01's row records: an `UPDATE` policy is row-level and permits every
-- column of the row it admits, so without this an admin deciding a sign-up could also rewrite that
-- person's display name, avatar or role. TEA-01 revoked all on `public.member`, so this grant is
-- required and is not inherited.
grant update (status, team_id) on public.member to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 5. The allow-list is gone.
-- ---------------------------------------------------------------------------------------------
-- The operator chose the deepest of the three options offered: the table and the seam, not just the
-- screen. `cascade` takes the three policies with it — `allowed_email_select_admin`,
-- `allowed_email_insert_admin` and `allowed_email_delete_admin_unconsumed` — and the grants.
--
-- **THIS IS NOT REVERSIBLE BY GIT.** Applying it destroys every row in the table on the live
-- project. The rows are addresses an admin typed and nothing else references them; every one that
-- was ever consumed has already become a `member` row, which is untouched.
drop table if exists public.allowed_email cascade;

commit;
