-- MIR-18-c, ADR-095 decision 4: the Supabase Auth MFA verification attempt hook logs every wrong
-- second-factor code and, after five wrong codes in fifteen minutes, refuses the identity's factor,
-- even for the right code. It runs inside Supabase Auth's own verification, so a caller who skips the
-- panel does not skip it.
--
-- Idempotent (ADR-024). Apply this migration BEFORE enabling the hook on the hosted project: a hook
-- pointing at a function that does not exist fails every second-factor verification (RULE-09).
begin;

create table if not exists public.mfa_failed_verification (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  factor_id    uuid not null,
  reason       text not null
               constraint mfa_failed_verification_reason_check
               check (reason in ('invalid_code', 'locked_out')),
  attempted_at timestamptz not null default now()
);

create index if not exists mfa_failed_verification_user_attempted_idx
  on public.mfa_failed_verification (user_id, attempted_at desc);

alter table public.mfa_failed_verification enable row level security;
revoke all on table public.mfa_failed_verification from public, anon, authenticated;
grant select, insert on table public.mfa_failed_verification to supabase_auth_admin;

drop policy if exists mfa_failed_verification_auth_admin_select on public.mfa_failed_verification;
create policy mfa_failed_verification_auth_admin_select on public.mfa_failed_verification
  for select to supabase_auth_admin using (true);

drop policy if exists mfa_failed_verification_auth_admin_insert on public.mfa_failed_verification;
create policy mfa_failed_verification_auth_admin_insert on public.mfa_failed_verification
  for insert to supabase_auth_admin with check (true);

grant usage on schema public to supabase_auth_admin;

create or replace function public.hook_mfa_verification_attempt(event jsonb) returns jsonb
  language plpgsql volatile security invoker set search_path = '' as $$
declare
  v_user     uuid    := (event ->> 'user_id')::uuid;
  v_factor   uuid    := (event ->> 'factor_id')::uuid;
  v_valid    boolean := (event ->> 'valid')::boolean;
  v_failures bigint;
begin
  if v_user is null or v_factor is null or v_valid is null then
    raise exception 'malformed MFA verification event' using errcode = '22023';
  end if;

  if not v_valid then
    insert into public.mfa_failed_verification (user_id, factor_id, reason)
    values (v_user, v_factor, 'invalid_code');
  end if;

  -- ADR-095 decision 4: five wrong codes in fifteen minutes. Literals, not configuration.
  select count(*) into v_failures
    from public.mfa_failed_verification f
   where f.user_id = v_user
     and f.reason = 'invalid_code'
     and f.attempted_at > now() - interval '15 minutes';

  if v_failures >= 5 then
    if v_valid then
      insert into public.mfa_failed_verification (user_id, factor_id, reason)
      values (v_user, v_factor, 'locked_out');
    end if;
    return jsonb_build_object(
      'decision', 'reject',
      'message', 'Too many incorrect codes. Try again in 15 minutes.');
  end if;

  return jsonb_build_object('decision', 'continue');
end;
$$;

revoke all on function public.hook_mfa_verification_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.hook_mfa_verification_attempt(jsonb) to supabase_auth_admin;

commit;
