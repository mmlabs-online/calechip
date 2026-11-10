-- TEA-01. ADR-009: a person joins by signing up against an allow-list.
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- This is the project's FIRST migration, so it creates `team` and `member` as well as
-- `allowed_email` — a member row cannot exist before the table does. Field names and types are
-- copied from .ai/standards/data-model.md without alteration (RULE-04).
--
-- `entry`, `holiday` and the INV-01 exclusion constraint from ADR-011 are deliberately NOT here.
-- They belong to the features that use them.
--
-- TODO(verify): `citext` availability on the hosted project could not be confirmed — Supabase's
-- extensions page names no list and no project is provisioned (02-design.md section 4.3). If it is
-- unavailable the named fallback is `email text primary key` with `check (email = lower(email))`,
-- the trigger comparing `a.email = lower(new.email)`, and `set search_path = ''` on the trigger
-- function. AC-4 states the behaviour and not the mechanism, so either shape satisfies it.
--
-- TODO(verify): `new.raw_user_meta_data` is asserted by the installed @supabase/auth-js types
-- rather than read off the server's schema. Confirm against `\d auth.users` before this is applied.

create extension if not exists citext with schema extensions;

create type public.member_role as enum ('member', 'admin');

create table public.team (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  overload_threshold numeric not null default 0.5,
  created_at         timestamptz not null default now()
);

create table public.member (
  id           uuid primary key references auth.users (id) on delete restrict,
  team_id      uuid not null references public.team (id) on delete restrict,
  display_name text not null,
  avatar       text not null,
  role         public.member_role not null default 'member',
  removed_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table public.allowed_email (
  email       extensions.citext primary key,
  team_id     uuid not null references public.team (id) on delete restrict,
  added_by    uuid not null references public.member (id) on delete restrict,
  added_at    timestamptz not null default now(),
  consumed_at timestamptz
);

-- No cascade anywhere. data-model.md: "There is no cascade anywhere in this model, and that is a
-- decision rather than an omission."

-- The rank helper rbac-and-security.md left as TODO(project). `security definer` so that a policy on
-- one table may consult `member` without recursing through `member`'s own policies.
create function public.is_admin(p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.member m
    where m.id = p_uid
      and m.role = 'admin'::public.member_role
      and m.removed_at is null
  );
$$;

create function public.member_team_id(p_uid uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select m.team_id from public.member m
  where m.id = p_uid and m.removed_at is null;
$$;

revoke all on function public.is_admin(uuid), public.member_team_id(uuid) from public;
grant execute on function public.is_admin(uuid), public.member_team_id(uuid) to authenticated;

-- The whole feature. ADR-009 step 3.
--
-- search_path is `extensions` rather than '' because `allowed_email.email` is citext and the `=`
-- operator for it lives in that schema; with an empty search_path the comparison does not resolve.
-- Every relation below is fully qualified anyway, so nothing is reachable through the path itself.
create function public.admit_allow_listed_member() returns trigger
  language plpgsql security definer set search_path = extensions as $$
declare
  v_now     timestamptz := now();
  v_team_id uuid;
begin
  -- AC-7: admit on confirmation, never on insert-without-confirmation. With Confirm email OFF
  -- Supabase sets email_confirmed_at at insert time, so this one trigger fires exactly once under
  -- either project setting and the two candidate behaviours stay indistinguishable, as AC-7 says.
  --
  -- INV-04 depends on this: the threshold is a share of the team's CURRENT member count, so an
  -- account created and never confirmed would raise the absence-count threshold for everybody
  -- without its owner ever being on the team.
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;   -- already admitted on an earlier confirmation
  end if;

  -- AC-2 and AC-3 in one statement. UPDATE ... RETURNING is atomic: two concurrent confirmations
  -- for the same address cannot both match `consumed_at is null`, so the second admits nobody.
  -- AC-4: citext, so the comparison is case-insensitive without a lower() anywhere.
  update public.allowed_email a
     set consumed_at = v_now
   where a.email = new.email
     and a.consumed_at is null
  returning a.team_id into v_team_id;

  if v_team_id is null then
    return new;   -- AC-5: not allow-listed, or already consumed. Sign-up still succeeds.
  end if;

  insert into public.member (id, team_id, display_name, avatar, role, created_at)
  values (
    new.id,
    v_team_id,                                    -- INV-07: the team comes from here and nowhere else
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
             split_part(new.email, '@', 1)),      -- AC-8, with a last-resort guard; see 02-design.md 4.4
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'avatar'), ''), '🙂'),
    'member'::public.member_role,                 -- AC-9. NEVER from raw_user_meta_data, which is
                                                  -- whatever the caller passed to signUp.
    v_now                                         -- AC-2: the same instant as consumed_at
  )
  on conflict (id) do nothing;

  return new;
exception when others then
  -- A trigger on auth.users that raises makes signUp fail outright, which would break AC-5's
  -- "sign-up succeeds and returns the same result". The whole block rolls back together, so the
  -- allow-list entry is not consumed either. The warning is what makes the failure findable.
  raise warning 'admit_allow_listed_member failed for auth user %: %', new.id, sqlerrm;
  return new;
end;
$$;

create trigger admit_allow_listed_member
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.admit_allow_listed_member();

alter table public.team          enable row level security;
alter table public.member        enable row level security;
alter table public.allowed_email enable row level security;

-- Explicit, not inherited. Supabase's default privileges on a new table in `public` are permissive;
-- relying on them would leave the policy as the only thing between `anon` and a write, and
-- rbac-and-security.md known weakness 1 is precisely that a policy fails open silently.
revoke all on public.team, public.member, public.allowed_email from anon, authenticated;
grant select on public.member        to authenticated;
grant select on public.allowed_email to authenticated;

-- The read path for AC-1 and AC-9: `getOwnMember`, exercised by tests/permission-model.test.ts.
-- It addresses only the caller's own id, so "no row" and "a row I may not see" collapse into one
-- answer. TEA-03 widens this to the team, per the `Read the member list` row in rbac-and-security.md,
-- and the sign-in half depends on this policy rather than adding one.
create policy member_select_own on public.member
  for select to authenticated
  using (id = (select auth.uid()));

-- AC-11 and AC-12. A member receives no rows; an admin receives their own team's entries, consumed
-- and unconsumed alike.
create policy allowed_email_select_admin on public.allowed_email
  for select to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id = public.member_team_id((select auth.uid()))
  );

-- No insert, update or delete policy on any of the three tables. With row-level security enabled and
-- no policy, the write is denied. TEA-02 adds the allow-list writes; TEA-04 adds removal and
-- promotion.
--
-- `member` must NEVER gain an insert policy. The trigger is the only writer: any insert policy a
-- signed-in person can satisfy lets them choose their own team_id and their own role, and the
-- allow-list becomes a suggestion while AC-9 becomes a convention.
