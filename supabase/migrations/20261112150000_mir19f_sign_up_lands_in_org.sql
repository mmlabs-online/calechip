-- MIR-19-f, ADR-099 decisions 2, 3 and 5: a sign-up lands in the org of the address it was made at.
--
-- `public.admit_allow_listed_member()` is re-created so that the pending `member` row it writes names
-- `org_id`, resolved from `raw_user_meta_data.org_code` (Org public when no code is named), and so that
-- a code that names no org refuses the sign-up itself on the `auth.users` insert (`P0002`,
-- `sign_up_org_unknown`).
--
-- IDEMPOTENT (ADR-024): `create or replace`. No table, column, constraint, policy, trigger or grant
-- change; the trigger `admit_allow_listed_member` on `auth.users` is not touched. Applying this to a
-- remote database is human (RULE-09).
begin;

create or replace function public.admit_allow_listed_member() returns trigger
  language plpgsql security definer set search_path = extensions as $$
declare
  v_code text := nullif(btrim(new.raw_user_meta_data ->> 'org_code'), '');
  v_org  uuid;
begin
  -- ADR-099 decision 2: the org of the address; Org public when none is named.
  if v_code is null then
    select o.id into v_org from public.org o where o.is_shared_tenant;
  else
    select o.id into v_org from public.org o where o.org_code = v_code;
  end if;

  -- ADR-099 decision 3: an unknown or reserved code refuses the sign-up itself. Outside the
  -- `exception when others` block below on purpose: this is the one failure that must reach GoTrue.
  if v_org is null and tg_op = 'INSERT' then
    raise exception 'sign_up_org_unknown' using errcode = 'P0002';
  end if;

  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;   -- already admitted on an earlier confirmation
  end if;

  -- ADR-099 decision 5: never fall through to stamp_org_id()'s shared-tenant fallback.
  if v_org is null then
    raise warning 'admit_allow_listed_member: no org for code % (auth user %)', v_code, new.id;
    return new;
  end if;

  -- NO ALLOW-LIST LOOKUP: the row is created for anybody who confirms an address, and an admin decides
  -- afterwards.
  --
  -- The team is never written here (ADR-080), and `status` takes its `pending` default. `role` is
  -- still hard-coded and still never read from `raw_user_meta_data`, which is whatever the caller passed
  -- to `signUp` — TEA-01 AC-9, and it matters because the caller is not somebody an admin has vouched for.
  begin
    insert into public.member (id, org_id, display_name, avatar, role)
    values (
      new.id,
      v_org,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
               split_part(new.email, '@', 1)),
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'avatar'), ''), '1.png'),
      'member'::public.member_role
    )
    on conflict (id) do nothing;
  exception when others then
    -- A trigger on auth.users that raises makes signUp fail outright. The insert's own failure rolls
    -- back with this sub-block and the warning is what makes it findable — TEA-01's reasoning, unchanged.
    raise warning 'admit_allow_listed_member failed for auth user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;

commit;
