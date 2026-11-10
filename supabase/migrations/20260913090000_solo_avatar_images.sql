-- SOLO, 2026-09-13. The avatar is an image in `public/images/`, and `member.avatar` stores its file
-- name with the extension (`12.png`). No ticket and no plan.
--
-- Operator's instruction: *list ảnh được lấy ra từ "public\images" và lưu vào member info tên của
-- ảnh*, and, on confirmation: convert ALL existing avatars to `1.png`, and change the sign-up
-- default from `'🙂'` to `1.png`.
--
-- **NO SCHEMA CHANGE.** `avatar` stays `text not null` with no check constraint —
-- `20260910093000_solo_profile_self_update.sql` section 3 records why a constraint listing the
-- offered values is the wrong control, and it is more true now: the offered set is whatever files the
-- folder holds at build time, which the database cannot see. The seam refuses a value outside that
-- set (keeping the caller's own), and `src/components/Avatar.tsx` draws the default for any value it
-- has no file for, so a stray value renders as the default and never as a URL.
--
-- **`1.png` IS WRITTEN IN THREE PLACES THAT MUST AGREE:** this file (the backfill and the trigger),
-- `DEFAULT_AVATAR` in `src/lib/avatars.ts`, and the defaults in `supabase/bootstrap.sql` and
-- `supabase/create-account.sql`. `supabase/db.sql` carries the same default.
--
-- Applied by a human (RULE-09, ADR-024), and idempotent: a re-run updates no row and replaces the
-- function with the same body.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. Every existing member moves to the default image.
-- ---------------------------------------------------------------------------------------------
-- **IT PASSES `member_enforce_role_and_removal`.** Clause (a) of that trigger refuses an `avatar`
-- change on a row that is not `auth.uid()`'s, but only when `auth.uid()` is not null — and it is null
-- in a migration, the SQL editor and a service-role call. No other clause reads `avatar`.
--
-- ALL rows, removed members included: a removed member still renders on the dates they were counted
-- (ADR-013), and an emoji left there would draw as the default placeholder anyway. Writing the value
-- keeps the table telling one story.
update public.member
   set avatar = '1.png'
 where avatar is distinct from '1.png';

-- ---------------------------------------------------------------------------------------------
-- 2. The sign-up default.
-- ---------------------------------------------------------------------------------------------
-- Re-created from its LATEST definition, `20260910100000_solo_member_approval.sql` section 3, with
-- exactly one change: the fallback avatar is `'1.png'` instead of `'🙂'`. Every other line — the
-- guards, the null team, the hard-coded role, the exception handler — is copied unchanged, and the
-- trigger that points at this function is not touched. The body, comments included, is
-- that file's character for character apart from that literal.
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
