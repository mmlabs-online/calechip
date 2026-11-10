-- SOLO, 2026-09-10 — create ONE account with any email address at all. Applied by a human
-- (RULE-09), never by an agent, and never from application code.
--
-- ============================================================================================
-- WHY THIS FILE EXISTS
-- ============================================================================================
--
-- Hosted Supabase refuses `signUp` for an address it judges undeliverable and answers
-- `email_address_invalid` — `test1@calechip.com` was refused because `calechip.com` does not exist
-- in DNS at all (NXDOMAIN: no A record, no MX). **There is no project setting that turns that check
-- off**, so no amount of configuration makes the shipped sign-up form accept a made-up domain.
--
-- What this file does instead is what `supabase/seed.sql` already does: insert the row into
-- `auth.users` DIRECTLY. GoTrue never sees the request, so nothing validates the address — the seed
-- creates `quan@example.com` and `thanh@example.com` this way, and `example.com` is an address the
-- hosted sign-up would reject for the same reason.
--
-- **THE ACCOUNT IS OTHERWISE COMPLETELY ORDINARY.** `email_confirmed_at` is set, so
-- `admit_allow_listed_member` fires exactly as it does for a real sign-up
-- (`20260910100000_solo_member_approval.sql`) and creates the `public.member` row with a null
-- `team_id` and `status = 'pending'` — the person is then approved by an admin through the
-- application, like anybody else. Set `calechip.new_approved` to `yes` to skip that and put them
-- straight onto the one team.
--
-- ============================================================================================
-- WHAT IT IS NOT
-- ============================================================================================
--
-- **NOT A MIGRATION, and it must never become one.** `supabase/migrations/` is applied to every
-- environment by the CLI; a function or a statement that mints accounts has no business running
-- anywhere automatically. This is a one-off script a human pastes, reads, and runs.
--
-- **NOT `supabase/seed.sql`.** That file is fixtures with known ids and known passwords and is for
-- development datastores only (ADR-024, ADR-030). This one takes what you give it and hard-codes
-- nothing.
--
-- **NOT `supabase/bootstrap.sql`.** That resolves a person who ALREADY signed up through the
-- interface and gives them the first team and the first admin row. This one creates the auth user,
-- which bootstrap deliberately refuses to do.
--
-- **IT WRITES A PASSWORD YOU TYPED INTO A SQL EDITOR.** That password is in your clipboard, in the
-- editor's history and possibly in a query log. Use it for test accounts. For a real person, let
-- them sign up through the application with an address that exists.
--
-- ============================================================================================
-- HOW TO APPLY IT — Supabase dashboard, SQL editor, as ONE submission
-- ============================================================================================
--
--   set calechip.new_email    = 'test1@calechip.com';
--   set calechip.new_password = 'password123';
--   set calechip.new_name     = 'Test One';   -- optional; the part before @ is used when empty
--   set calechip.new_avatar   = '';           -- optional; 1.png when empty
--   set calechip.new_approved = 'no';         -- 'yes' puts them on the one team immediately
--   -- ...then paste everything below this header into the same submission and run it together.
--
-- The `set` statements and the block below MUST be one submission: a `set` lasts for the session,
-- and the dashboard opens a new one per run. This is `bootstrap.sql`'s own convention.
--
-- Run it again with a different address for the next account. Running it twice with the SAME
-- address raises rather than creating a second row — `auth.users` is unique on email, and a silent
-- `on conflict do nothing` would look like success.
--
-- **THE FOUR EMPTY STRINGS AT THE END OF THE INSERT ARE LOAD-BEARING.** `confirmation_token`,
-- `recovery_token`, `email_change_token_new` and `email_change` have no column default; left NULL,
-- GoTrue scans them into non-nullable Go strings and EVERY sign-in for that row fails with
-- `500 Database error querying schema`, while a sign-in for a user that does not exist still
-- returns 400 — so the account looks created and is permanently unusable. `.ai/board/model-debt.md`
-- MD-014, and `supabase/seed.sql:71-76` carries the same warning.
--
-- **NO `auth.identities` ROW IS WRITTEN, deliberately.** `seed.sql` writes none either and password
-- sign-in works for its accounts, including the operator's own admin account added on 2026-09-01.
-- That table's columns have changed across GoTrue versions, so a speculative insert here is a
-- statement that may not apply to the version your project is running.

do $$
declare
  v_email    text    := lower(btrim(coalesce(current_setting('calechip.new_email', true), '')));
  v_password text    := coalesce(current_setting('calechip.new_password', true), '');
  v_name     text    := btrim(coalesce(current_setting('calechip.new_name', true), ''));
  v_avatar   text    := btrim(coalesce(current_setting('calechip.new_avatar', true), ''));
  v_approved boolean := lower(coalesce(current_setting('calechip.new_approved', true), 'no'))
                        in ('yes', 'true', 't', 'y', '1');
  v_id       uuid    := gen_random_uuid();
  v_teams    integer;
  v_team     uuid;
begin
  -- The three refusals are about this SCRIPT being usable, and not about the address being real.
  -- Judging the address is the whole thing this file exists to avoid.
  if v_email = '' or position('@' in v_email) = 0 then
    raise exception
      'set calechip.new_email to something containing @ before running this. Got: %', v_email;
  end if;

  if length(v_password) < 6 then
    raise exception
      'set calechip.new_password to at least 6 characters. GoTrue refuses shorter ones at sign-in.';
  end if;

  if exists (select 1 from auth.users u where lower(u.email) = v_email) then
    raise exception
      'an auth user already exists for %. Delete it first, or use another address.', v_email;
  end if;

  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  values (
    '00000000-0000-0000-0000-000000000000',
    v_id,
    'authenticated',
    'authenticated',
    v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')),
    -- Confirmed at insert, which is what makes the membership trigger fire. An unconfirmed row
    -- would need a confirmation email to a domain that does not exist, which is the problem this
    -- file is here to walk around.
    now(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object(
      'display_name', coalesce(nullif(v_name, ''), split_part(v_email, '@', 1)),
      'avatar', coalesce(nullif(v_avatar, ''), '1.png')
    ),
    now(),
    now(),
    '', '', '', ''
  );

  -- The trigger has run by now and the member row exists, pending, with no team. Read it back
  -- rather than assuming: the trigger swallows its own failures with a `raise warning` so that a
  -- broken trigger cannot make sign-up fail, which means a missing row here is silent.
  if not exists (select 1 from public.member m where m.id = v_id) then
    raise exception
      'the auth user was created but admit_allow_listed_member() wrote no member row for %. '
      'Check the database logs for its warning before using this account.', v_email;
  end if;

  if v_approved then
    select count(*) into v_teams from public.team;

    if v_teams <> 1 then
      raise exception
        'calechip.new_approved is yes, but there are % teams. Approve this person through the '
        'application instead, where an admin chooses the team.', v_teams;
    end if;

    select t.id into v_team from public.team t;

    -- The one column `decideMember`'s RPC still writes. `role` stays `member`: making somebody an
    -- admin is a separate decision and there is no argument here for it.
    update public.member set status = 'approved'::public.member_status where id = v_id;

    -- ADR-078: the mirror no longer writes `membership` on a team change, so the primary row is
    -- written here, by the same owner-only helper `admit_member` calls.
    perform public.membership_make_primary(v_id, v_team);

    raise notice 'created % and put them on the one team, approved. Sign in with the password you set.', v_email;
  else
    raise notice 'created %. They are PENDING with no team — approve them in the application.', v_email;
  end if;
end;
$$;
