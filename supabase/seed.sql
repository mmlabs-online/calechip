-- TEA-01 seed. Applied by a human (RULE-09), never by an agent.
--
-- This is the TEST-AND-DEVELOPMENT seed, not the production bootstrap. The story puts the first team
-- and the first admin out of scope as a capability of the feature and says a human applies a seed;
-- this file is what a human applies. It is in scope for TEA-01 only because AC-3, AC-11 and AC-12
-- have nothing to run against without it, and .ai/standards/testing-standards.md requires tests to
-- share the seed rather than invent entities inline.
--
-- EVERY literal below also appears in src/lib/fixtures.ts, which is what the mock seam and the tests
-- read. Change a value here and change it there in the same commit — the two drifting is the exact
-- failure the shared-fixture rule exists to prevent.
--
-- Insert order is forced by the foreign keys, none of which cascade: team -> auth user -> member
-- (`allowed_email` was the fourth link in this chain until 2026-09-10, when the table was dropped.)

-- ---------------------------------------------------------------------------------------------
-- GUARD — this file must not be applied to a hosted project, and until now nothing stopped it.
--
-- `.ai/standards/data-model.md:193` says this seed "runs under `supabase db reset` and never reaches
-- the hosted project". That sentence states an intent, not a mechanism. There is no
-- `supabase/config.toml` in this repository, so there is no local stack and no `db reset` flow: this
-- seed has only ever been applied by hand, and it was applied by hand to the hosted project. Every
-- account below then existed there carrying a password published in this file.
--
-- IT ASKS FOR AN ACKNOWLEDGEMENT RATHER THAN DETECTING THE SERVER, deliberately. A local Supabase
-- stack is built to be indistinguishable from a hosted one, so every discriminator worth trying —
-- `inet_server_addr()`, the listening port, the role set — is either wrong on docker's bridge
-- network or wrong on a managed host. A detector that guesses would fail open, and failing open is
-- precisely the defect being fixed. This fails closed: unset means refuse.
--
-- It is PLAIN SQL with no psql meta-commands, so it still fires if some future `supabase db reset`
-- applies this file through the CLI's own driver instead of through psql.
--
-- THIS IS NOT THE DRIFT DETECTOR ADR-024 DECLINED. That one would read `auth.users` to compare the
-- project against this file, which the anon key cannot do (tea01_membership.sql:145). This reads no
-- data and compares nothing — it refuses to start until a human says where it is pointed.
do $$
begin
  if coalesce(current_setting('calechip.seed_target', true), '') <> 'local' then
    raise exception
      'seed.sql refused to run: calechip.seed_target is not set to ''local'''
      using hint =
        'Every account in this file has a password published in the repository, so it may only be '
        || 'applied to a database you can throw away. Confirm the target is disposable by setting the '
        || 'flag at connection time: PGOPTIONS="-c calechip.seed_target=local" psql "$LOCAL_DB_URL" '
        || '-v ON_ERROR_STOP=1 --single-transaction -f supabase/seed.sql';
  end if;
end
$$;

insert into public.team (id, name, overload_threshold, created_at)
values (
  '11111111-1111-4111-8111-111111111111',
  'CaleChip',
  0.5,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- The seeded first admin's auth user.
--
-- `email_confirmed_at` is set, so `admit_allow_listed_member` fires on this insert. It finds no
-- allow-list entry for this address — there is none, and there must not be one — and returns without
-- creating anything. The admin's `member` row is inserted below by this seed instead, which is the
-- one place in the system a member row is written by something other than the trigger, and it is a
-- human running a seed rather than a policy anyone can reach.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  -- These four have NO column default. Left NULL, GoTrue scans them into non-nullable Go
  -- strings and every sign-in for the row fails with `500 Database error querying schema`,
  -- while a sign-in for a user that does not exist still returns 400. MD-014.
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '22222222-2222-4222-8222-222222222222',
  'authenticated',
  'authenticated',
  'quan@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-08-31T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Quản trị","avatar":"1.png"}'::jsonb,
  '2026-08-31T00:00:00+00:00',
  '2026-08-31T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, display_name, avatar, role, status, removed_at, created_at)
values (
  '22222222-2222-4222-8222-222222222222',
  'Quản trị',
  '1.png',
  'org_admin',
  'approved',
  null,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- Two allow-list entries, and the pair is the point: one unconsumed and one consumed, so AC-3 has
-- something to assert against rather than having to consume the first entry as a side effect of an
-- earlier test.
-- SOLO, 2026-09-10. The allow-list seed stood here. `public.allowed_email` is dropped by
-- `20260910100000_solo_member_approval.sql`: everybody signs up, gets a pending member row, and an
-- admin decides. There is nothing left to seed for it.

-- `khach@example.com` is deliberately absent. It is FIXTURE_UNLISTED_EMAIL, and AC-5 needs an
-- address that is on no list at all.

-- ---------------------------------------------------------------------------
-- Operator's own admin account, added 2026-09-01 on direct instruction.
--
-- Same shape as the seeded admin above: an auth.users row whose password is
-- hashed with bcrypt, then a member row carrying role 'org_admin'. The trigger
-- `admit_allow_listed_member` only ever admits a MEMBER, so the first admin of a
-- team cannot come through sign-up and has to be seeded — which is why this
-- block exists rather than an allow_email entry.
--
-- The password here is deliberately weak and is a development credential. It
-- must not survive contact with real data.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  -- These four have NO column default. Left NULL, GoTrue scans them into non-nullable Go
  -- strings and every sign-in for the row fails with `500 Database error querying schema`,
  -- while a sign-in for a user that does not exist still returns 400. MD-014.
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '33333333-3333-4333-8333-333333333333',
  'authenticated',
  'authenticated',
  'admin@calachip.com',
  extensions.crypt('123456', extensions.gen_salt('bf')),
  '2026-09-01T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Admin","avatar":"1.png"}'::jsonb,
  '2026-09-01T00:00:00+00:00',
  '2026-09-01T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, display_name, avatar, role, status, removed_at, created_at)
values (
  '33333333-3333-4333-8333-333333333333',
  'Admin',
  '1.png',
  'org_admin',
  'approved',
  null,
  '2026-09-01T00:00:00+00:00'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- TEA-03. 02-design.md section 4.1.
--
-- Three rows the story's criteria have nothing to run against without: a second team, a member on
-- it (AC-2), and a removed member on the first team (AC-4). Every literal below also appears in
-- src/lib/fixtures.ts as FIXTURE_OTHER_TEAM, FIXTURE_OTHER_TEAM_MEMBER and FIXTURE_REMOVED_MEMBER.
--
-- Why they are seeded rather than created by a test. Exactly one team exists in v1, so AC-2 is
-- unobservable through the interface: a one-team fixture passes whether the team scope is in
-- `member_select_team`'s predicate or absent from it. ADR-018's revert condition names this data
-- specifically. AC-4 is the same shape one layer down — an all-active roster cannot show whether
-- the read kept a removed member or dropped one.
--
-- Insert order is forced by the foreign keys and none of them cascade: team -> auth user -> member.
-- Each auth.users insert sets confirmation_token, recovery_token, email_change_token_new and
-- email_change to '' — MD-014, the same reason every seeded account above does.
-- ---------------------------------------------------------------------------

insert into public.team (id, name, overload_threshold, created_at)
values (
  '44444444-4444-4444-8444-444444444444',
  'Nhóm khác',
  0.5,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- AC-2. A member of the OTHER team. No read by anybody on the first team may ever return this row.
--
-- `email_confirmed_at` is set, so `admit_allow_listed_member` fires on this insert. It finds no
-- allow-list entry for this address — there is none, and there must not be one, or the trigger would
-- put this person on the FIRST team and destroy the criterion — and returns having created nothing.
-- The member row below is this seed's write, as it is for the two admins above.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '66666666-6666-4666-8666-666666666666',
  'authenticated',
  'authenticated',
  'chi@other.example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-08-31T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Người nhóm khác","avatar":"1.png"}'::jsonb,
  '2026-08-31T00:00:00+00:00',
  '2026-08-31T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, display_name, avatar, role, status, removed_at, created_at)
values (
  '66666666-6666-4666-8666-666666666666',
  'Người nhóm khác',
  '1.png',
  'member',
  'approved',
  null,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- AC-4. A REMOVED member of the first team. `member_select_team` does not filter `removed_at`, so
-- this row is returned to their teammates carrying it — ADR-013 and the INV-04 note require the
-- counting function to be given the roster with `removed_at` per member. The screen does not draw
-- them; the read does return them, and those are two different layers.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '77777777-7777-4777-8777-777777777777',
  'authenticated',
  'authenticated',
  'cu@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-08-31T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Đã rời nhóm","avatar":"1.png"}'::jsonb,
  '2026-08-31T00:00:00+00:00',
  '2026-08-31T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, display_name, avatar, role, status, removed_at, created_at)
values (
  '77777777-7777-4777-8777-777777777777',
  'Đã rời nhóm',
  '1.png',
  'member',
  'approved',
  '2026-08-31T12:00:00+00:00',
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- TEA-04. 01-plan.md section 6.1.
--
-- One row, and it is a SECOND ADMIN on the first team. AC-13 asserts that an admin viewing the
-- roster sees a remove control and NO promote control on a row whose role is already `admin`, and
-- with FIXTURE_ADMIN the only admin on this team the caller and that row are the same row — so the
-- criterion is unobservable and passes whether the promote control is correctly withheld or the
-- caller's own row is simply being skipped. It also makes AC-9 concrete: with two admins, refusing
-- self-removal costs nobody the ability to leave.
--
-- Every literal below also appears in src/lib/fixtures.ts as FIXTURE_SECOND_ADMIN.
--
-- `email_confirmed_at` is set, so `admit_allow_listed_member` fires on this insert. It finds no
-- allow-list entry for this address — there is none, and there must not be one — and returns having
-- created nothing. The member row below is this seed's write, as it is for every admin above.
-- Insert order is forced by the foreign keys: auth user -> member. The four token columns are set
-- to '' for the reason MD-014 records and every seeded account above repeats.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '88888888-8888-4888-8888-888888888888',
  'authenticated',
  'authenticated',
  'dung@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-08-31T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Quản trị hai","avatar":"1.png"}'::jsonb,
  '2026-08-31T00:00:00+00:00',
  '2026-08-31T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, display_name, avatar, role, status, removed_at, created_at)
values (
  '88888888-8888-4888-8888-888888888888',
  'Quản trị hai',
  '1.png',
  'org_admin',
  'approved',
  null,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- TEA-05. 01-plan.md section 5.1.
--
-- Three accounts, and the first of them is a REPAIR rather than an addition.
--
-- `FIXTURE_MEMBER` (55555555-…) is in src/lib/fixtures.ts and in the mock's seeded roster and has
-- had NO ROW HERE since TEA-02 added it. So the only member-role account in the product was
-- unseeded, and against a real project AC-10's *"and when their role is member, no such link is
-- shown"* had nobody to be. The shared-fixture rule in .ai/standards/testing-standards.md exists for
-- exactly this: a fixture that lives in one file drifts from the seed and produces failures that
-- reproduce in CI and not locally.
--
-- `FIXTURE_MEMBER_LESS` (99999999-…) is AC-4's account: confirmed, and on no team. It is what
-- sign-up produces for an address that was not on the allow-list — the trigger fires on
-- `email_confirmed_at`, finds no entry for the address, and creates nothing. There is deliberately
-- NO allow_email row for it and there must not be one, or the trigger would admit them and destroy
-- the criterion. No `member` insert follows it, for the same reason.
--
-- `FIXTURE_UNCONFIRMED` (aaaaaaaa-…) is AC-3's account, and it is the one row here with
-- `email_confirmed_at` NULL. `admit_allow_listed_member` returns early on a null value, so this
-- account has no member row either; GoTrue refuses its sign-in with `email_not_confirmed` before
-- membership is ever consulted. It is the state TEA-01's AC-7 creates on purpose — confirmation is
-- on — so a person reaches it by following the instructions, and AC-3 is the product answering them
-- honestly instead of telling them their password is wrong.
--
-- Every literal below also appears in src/lib/fixtures.ts, in FIXTURE_CREDENTIALS. Insert order is
-- forced by the foreign keys: auth user -> member. The four token columns are set to '' for the
-- reason MD-014 records and every seeded account above repeats — left NULL, GoTrue scans them into
-- non-nullable Go strings and EVERY sign-in for the row fails with `500 Database error querying
-- schema`. This is the ticket where that defect bites hardest, because sign-in is the whole subject.
-- ---------------------------------------------------------------------------

-- FIXTURE_MEMBER. The member-role half of AC-10, and the drift repaired.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '55555555-5555-4555-8555-555555555555',
  'authenticated',
  'authenticated',
  'thanh@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-08-31T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Thành viên","avatar":"1.png"}'::jsonb,
  '2026-08-31T00:00:00+00:00',
  '2026-08-31T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, display_name, avatar, role, status, removed_at, created_at)
values (
  '55555555-5555-4555-8555-555555555555',
  'Thành viên',
  '1.png',
  'member',
  'approved',
  null,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- FIXTURE_MEMBER_LESS. AC-4. Confirmed, and NO member row follows on purpose.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '99999999-9999-4999-8999-999999999999',
  'authenticated',
  'authenticated',
  'hoa@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-09-01T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Chưa vào nhóm","avatar":"1.png"}'::jsonb,
  '2026-09-01T00:00:00+00:00',
  '2026-09-01T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

-- FIXTURE_UNCONFIRMED. AC-3. `email_confirmed_at` is NULL, so the trigger returns early and this
-- account has no member row either. No member insert follows.
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  'authenticated',
  'authenticated',
  'khanh@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  null,
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Chưa xác nhận","avatar":"1.png"}'::jsonb,
  '2026-09-01T00:00:00+00:00',
  '2026-09-01T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- CAL-02. 01-plan.md section 7.
--
-- One account and one entry, and the entry is the reason for both: AC-5 and AC-6 edit an entry that
-- is ALREADY APPROVED, and nothing in the product can create one. `entry_insert_own`'s grant
-- excludes `status`, CAL-02's own update grant excludes it too, and ADM-05 does not exist — so an
-- approved entry exists only if a human seeds it, which is what this block is.
--
-- The owner is a THIRD member-role account rather than FIXTURE_MEMBER, and that is forced rather
-- than chosen: tests/e2e/cal-01-create-entry.spec.ts asserts `own-entries-empty` for
-- thanh@example.com and exact row counts for quan@example.com, and CAL-02 01-plan.md section 4.3
-- requires that suite to pass UNEDITED. Seeding an entry under either address breaks it.
--
-- Both literals also appear in src/lib/fixtures.ts, as FIXTURE_APPROVED_MEMBER,
-- FIXTURE_APPROVED_MEMBER_CREDENTIAL and FIXTURE_APPROVED_ENTRY. Insert order is forced by the
-- foreign keys: auth user -> member -> entry. The four token columns are set to '' for the reason
-- MD-014 records and every seeded account above repeats.
--
-- `email_confirmed_at` is set, so `admit_allow_listed_member` fires on this insert. It finds no
-- allow-list entry for this address — there is none, and there must not be one — and returns having
-- created nothing. The member row below is this seed's write, as it is for every seeded account.
-- ---------------------------------------------------------------------------

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'authenticated',
  'authenticated',
  'linh@example.com',
  extensions.crypt('password123', extensions.gen_salt('bf')),
  '2026-09-01T00:00:00+00:00',
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{"display_name":"Đã duyệt","avatar":"1.png"}'::jsonb,
  '2026-09-01T00:00:00+00:00',
  '2026-09-01T00:00:00+00:00',
  '', '', '', ''
)
on conflict (id) do nothing;

insert into public.member (id, display_name, avatar, role, status, removed_at, created_at)
values (
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'Đã duyệt',
  '1.png',
  'member',
  'approved',
  null,
  '2026-08-31T00:00:00+00:00'
)
on conflict (id) do nothing;

-- MIR-21-e (ADR-080 decision 3). The rows the mirror's INSERT branch wrote while the member inserts
-- above named their team, with the same values (20261105210000_mir21b_writers_write_membership.sql
-- :348-362). Before the entries below: their stamp reads the author's primary team from here.
-- MIR-16-h: `member.role` no longer carries `manager` for anybody, so this seed holds no manager —
-- every seeded member here gets team_role 'member'.
insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at, left_at)
select m.org_id, v.team_id, m.id,
       'member'::public.team_role,
       m.removed_at is null,
       m.created_at,
       case when m.removed_at is null then null else greatest(m.removed_at, m.created_at) end
  from (values
    ('22222222-2222-4222-8222-222222222222'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
    ('33333333-3333-4333-8333-333333333333'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
    ('66666666-6666-4666-8666-666666666666'::uuid, '44444444-4444-4444-8444-444444444444'::uuid),
    ('77777777-7777-4777-8777-777777777777'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
    ('88888888-8888-4888-8888-888888888888'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
    ('55555555-5555-4555-8555-555555555555'::uuid, '11111111-1111-4111-8111-111111111111'::uuid),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, '11111111-1111-4111-8111-111111111111'::uuid)
  ) as v(member_id, team_id)
  join public.member m on m.id = v.member_id;

-- The approved entry itself. `approved_by` and `approved_at` are BOTH set: INV-02's subject is a
-- decision that must not survive a substantive edit, and an entry seeded `approved` with no approver
-- would let AC-5 pass against a trigger that clears nothing.
--
-- `rejection_reason` stays null because `status` is `approved` — `entry_rejection_reason_iff_rejected`
-- is a biconditional and refuses any other combination.
--
-- `updated_at` EQUALS `created_at`, which is what the datastore stores for a row that has never been
-- updated. AC-12 asserts that an edit moves it, and it is observable only because the two start
-- equal. This insert names both columns explicitly rather than taking the defaults, so the seed is
-- reproducible on any day it is applied.
--
-- This statement is a HUMAN's (RULE-09), and it names columns no policy grants `authenticated` —
-- which is the point: a seed runs as the owner, and the product cannot reach this state.
insert into public.entry (
  id, member_id, type, portion, start_date, end_date, tentative,
  status, rejection_reason, note, approved_by, approved_at, created_at, updated_at
)
values (
  'dd000000-0000-4000-8000-000000000001',
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  'pto',
  'full',
  '2026-09-14',
  '2026-09-16',
  false,
  'approved',
  null,
  'Nghỉ đã được duyệt',
  '22222222-2222-4222-8222-222222222222',
  '2026-09-01T02:00:00+00:00',
  '2026-09-01T01:00:00+00:00',
  '2026-09-01T01:00:00+00:00'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- CAL-03. 01-plan.md section 7. ONE row, and it is AC-8's.
--
-- An entry owned by the OTHER team's member, who has had an `auth.users` row and a `public.member`
-- row since TEA-03 and no entry until now. AC-8 asserts that an admin of FIXTURE_TEAM can neither
-- edit nor delete it, and without this row that criterion has nothing to be refused against — a
-- policy written `using (public.is_admin(auth.uid()))` with no team predicate would pass every test
-- in this repository. ADR-018's revert condition names this same one-team limitation for TEA-03's
-- read; this is it arriving on the write side.
--
-- No new account and no new member: `chi@other.example.com` and
-- `66666666-6666-4666-8666-666666666666` are already seeded above, and reusing them is the point.
--
-- `status` is `pending` with no approver, which is the plain case — a refusal observed against this
-- row is then the TEAM boundary refusing, and not INV-02's trigger doing something else. This
-- statement is still a HUMAN's (RULE-09), but unlike the approved entry above it names nothing the
-- product could not reach: that team's own member could have created it.
--
-- The same literals are FIXTURE_OTHER_TEAM_ENTRY in src/lib/fixtures.ts. Change one, change both.
-- ---------------------------------------------------------------------------

insert into public.entry (
  id, member_id, type, portion, start_date, end_date, tentative,
  status, rejection_reason, note, approved_by, approved_at, created_at, updated_at
)
values (
  'dd000000-0000-4000-8000-000000000002',
  '66666666-6666-4666-8666-666666666666',
  'pto',
  'full',
  '2026-09-21',
  '2026-09-22',
  false,
  'pending',
  null,
  'Nghỉ của nhóm khác',
  null,
  null,
  '2026-09-01T01:00:00+00:00',
  '2026-09-01T01:00:00+00:00'
)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- ADM-02. 01-plan.md section 4.5, which transcribes ADR-015 section 5.
--
-- THE SYNTHETIC SET, AND IT IS DELIBERATELY NOT THE REAL VIETNAMESE CALENDAR. ADR-015 section 5
-- specifies exactly this shape and says why: *"A test asserting '30/4/2026 is a bridge day' asserts
-- a fact about the world that an admin may correctly change, and it would then fail for the right
-- reason in the wrong place."*
--
-- THE REAL ROWS ARE SOMEWHERE ELSE ON PURPOSE. They arrive through
-- supabase/migrations/20260905120100_adm02_holiday_seed.sql, which reaches every environment and
-- which a human fills and applies (RULE-09). This file runs under `supabase db reset`, refuses to
-- run against anything but a local target under the guard at the top of it, and never reaches the
-- hosted project — so the two sets are different sets, and that is the decision rather than an
-- accident.
--
-- `kind` NAMES THE EFFECT ON THE WORKING CALENDAR, NOT THE VIETNAMESE LABEL (ADR-015 section 2):
-- `Lam bu` below is `working` — a Saturday that counts as a working day, the exact inverse of a
-- holiday — and `Nghi bu`, a compensatory day off, is `non_working`. Getting either backwards is
-- the failure mode this comment exists to prevent.
--
-- EVERY WEEKDAY WAS COMPUTED, NOT RECALLED: 11 June 2026 is a Thursday, 13 June 2026 a Saturday,
-- 15 June 2026 a Monday, 15 October 2026 a Thursday. 2027 carries no row at all, which is
-- ADR-015 section 5's *"one year with no rows"* and is AC-10's fixture.
--
-- `id` IS NAMED rather than defaulted, and `created_at` with it, so this file and
-- src/lib/fixtures.ts hold the same literals — the rule this seed states at its own head.
-- `on conflict (id) do nothing`, matching every other statement here.
--
-- The same literals are FIXTURE_HOLIDAYS in src/lib/fixtures.ts. Change one, change both.
-- ---------------------------------------------------------------------------

insert into public.holiday (id, date, name, kind, created_at)
values
  (
    'cc000000-0000-4000-8000-000000000004',
    '2026-10-15',
    'Ngày nghỉ thử nghiệm',
    'non_working',
    '2026-09-05T00:00:00+00:00'
  ),
  (
    'cc000000-0000-4000-8000-000000000003',
    '2026-06-15',
    'Nghỉ bù thử nghiệm',
    'non_working',
    '2026-09-05T00:00:00+00:00'
  ),
  (
    'cc000000-0000-4000-8000-000000000001',
    '2026-06-11',
    'Ngày lễ thử nghiệm',
    'non_working',
    '2026-09-05T00:00:00+00:00'
  ),
  (
    'cc000000-0000-4000-8000-000000000002',
    '2026-06-13',
    'Làm bù thử nghiệm',
    'working',
    '2026-09-05T00:00:00+00:00'
  )
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------------------------
-- SOLO, 2026-09-26 — report an issue. One row, matching FIXTURE_ISSUE_REPORT in src/lib/fixtures.ts
-- literal for literal.
--
-- IT DEPENDS ON `member`, which is inserted above: `issue_report.member_id` references it and does
-- not cascade, so this block must stay after that one.
--
-- `status` and `created_at` ARE WRITTEN HERE AND ARE WITHHELD FROM EVERY CLIENT. The insert grant
-- names only `member_id`, `kind`, `message` and `page`, so no signed-in caller can set either — a
-- seed runs as the owner and is the one writer that may, which is the same position
-- supabase/seed.sql already holds for `entry.status` on the approved fixture entry.
--
-- The message is Vietnamese because it is USER CONTENT: a person writes a report in their own
-- language. `ui-language.json` names this file, with src/lib/fixtures.ts, as the product's only
-- coverage for the diacritic requirement in CLAUDE.md § Visual direction.
-- SOLO, 2026-09-26 (second run) — `images` joins the column list, empty. Attachments are optional
-- and the seeded row is the ordinary case; a seed cannot put an object in a bucket, so a row
-- claiming images would name paths that no signed URL could ever be minted for.
insert into public.issue_report (id, member_id, kind, message, page, status, created_at, images)
values
  (
    'dd000000-0000-4000-8000-000000000001',
    '55555555-5555-4555-8555-555555555555',
    'bug',
    'Lịch tuần không hiển thị ngày nghỉ bù, chỉ thấy ô trắng.',
    '/week',
    'open',
    '2026-09-25T02:30:00+00:00',
    '{}'
  )
on conflict (id) do nothing;
