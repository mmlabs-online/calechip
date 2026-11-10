-- SOLO, 2026-09-10. The member list shows when each person last signed in.
--
-- **THE DATA EXISTS AND IS UNREACHABLE, WHICH IS WHY THIS FILE IS A COLUMN AND NOT A READ.** GoTrue
-- maintains `auth.users.last_sign_in_at`, but `auth` is not exposed through PostgREST and the
-- browser client holds only the anon key, so nothing in `src/` can select it. The two ways to make
-- it readable are a security-definer view over `auth.users` or a copy on `public.member`; the
-- operator was asked and chose the copy.
--
-- **THE COPY IS THE CHEAPER OF THE TWO IN THE WAY THAT MATTERS: IT ADDS NO NEW READ SURFACE.**
-- `member_select_team` already decides who may read a member row, so the value inherits that policy
-- exactly and no grant, view or function is added to the security surface. A view over `auth.users`
-- would have had to re-derive the team scope by hand, and a hand-written copy of a policy is the
-- thing ADR-005 exists to avoid.
--
-- **IT IS DISPLAY DATA AND NOTHING READS IT TO DECIDE ANYTHING.** No policy, no trigger and no count
-- consults this column. A stale or null value makes a cell say "never", which is a worse sentence
-- than the truth and not a wrong permission.
--
-- Applied by a human (RULE-09, ADR-024), and idempotent so a half-finished run can be re-run.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The column.
-- ---------------------------------------------------------------------------------------------
-- NULLABLE WITH NO DEFAULT, and null means "has never signed in" rather than "unknown". Those are
-- the same thing here: an account that has signed in has a GoTrue timestamp, and the backfill below
-- copies every one that exists at apply time.
alter table public.member
  add column if not exists last_sign_in_at timestamptz;

-- The backfill. Without it every existing member reads as never having signed in until their next
-- sign-in, which is a screen full of a false sentence on the day this ships.
update public.member m
   set last_sign_in_at = u.last_sign_in_at
  from auth.users u
 where u.id = m.id
   and m.last_sign_in_at is distinct from u.last_sign_in_at;

-- ---------------------------------------------------------------------------------------------
-- 2. Keeping it true.
-- ---------------------------------------------------------------------------------------------
-- **`after update of last_sign_in_at`, WHICH IS THE SAME SHAPE `admit_allow_listed_member` USES ON
-- THE SAME TABLE.** Narrowing the trigger to one column means an ordinary sign-in fires one small
-- update and every other write to `auth.users` fires nothing.
--
-- `security definer` because the row it writes is in `public` and the caller is whoever just signed
-- in — under their own rights the update would be filtered by `member_update_admin`, which they do
-- not satisfy. It writes ONE column of ONE row, keyed on the auth user's own id, so there is no
-- input to it that a caller controls.
create or replace function public.sync_member_last_sign_in() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  update public.member
     set last_sign_in_at = new.last_sign_in_at
   where id = new.id;
  return new;
exception when others then
  -- A trigger on auth.users that raises makes the SIGN-IN fail. A display column is never worth
  -- that, so the failure is swallowed and made findable — TEA-01's reasoning on the same table.
  raise warning 'sync_member_last_sign_in failed for auth user %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists sync_member_last_sign_in on auth.users;
create trigger sync_member_last_sign_in
  after update of last_sign_in_at on auth.users
  for each row execute function public.sync_member_last_sign_in();

commit;
