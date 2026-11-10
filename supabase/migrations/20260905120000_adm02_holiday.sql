-- ADM-02. The national holiday calendar: the table, and the READ half of its permissions.
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- Transcribed from ADR-015 section 3, which is ACCEPTED. `supabase/db.sql` carries the same
-- statements marked `[OWED] ADM-02`; ADR-026 decision point 6 says applying that file does NOT
-- discharge this migration, because `supabase/migrations/` is still the mechanism and this file is
-- what a fresh environment and the CLI's own history read.
--
-- THE WRITE HALF IS NOT HERE. `holiday_insert_admin`, `holiday_update_admin`,
-- `holiday_delete_admin` and `grant insert, update, delete` are ADM-03's — the split is by
-- operation, so the whole team can see the calendar before anybody can change it. On this branch
-- NEITHER ROLE can change it (AC-13).

create type public.holiday_kind as enum ('non_working', 'working');

-- SYSTEM-WIDE, NOT PER TEAM. No team_id and no foreign key: Vietnamese public holidays and the
-- announced swap days are national, glossary.md says "Holidays belong to the calendar, not to any
-- member", and INV-07 constrains entries and the members they belong to rather than a row that has
-- neither. `product` recommended `team_id uuid not null` at triage and lost; the four reasons are in
-- ADR-015 Rationale.
--
-- `unique (date)` IS LOAD-BEARING, NOT HYGIENE. It makes "the status of date D" a function rather
-- than a query, and the month shading, the year shading and the bridge-day derivation all depend on
-- that being single-valued. Two rows for one date with different kinds would make the working status
-- of a day ambiguous, and the ambiguity would surface as a derivation that is wrong at a
-- NEIGHBOURING date rather than at the duplicated one (AC-5).
-- Its accepted cost: a date carrying two observances gets one row and one `name`.
--
-- No cascade. data-model.md: "There is no cascade anywhere in this model, and that is a decision
-- rather than an omission."
create table public.holiday (
  id         uuid primary key default gen_random_uuid(),
  date       date not null unique,
  name       text not null,
  kind       public.holiday_kind not null default 'non_working',
  created_at timestamptz not null default now()
);

-- EXPLICIT, NOT INHERITED. TEA-01's revoke names `team`, `member` and `allowed_email` because
-- `holiday` did not exist (20260831150024_tea01_membership.sql:145), and Supabase's default
-- privileges on a new table in `public` are permissive. Relying on them would leave the policy as
-- the only thing between `anon` and a write, and rbac-and-security.md known weakness 1 is precisely
-- that a policy fails open silently. CAL-01's migration records this as the third time the trap has
-- been found; this is the fourth.
alter table public.holiday enable row level security;
revoke all on public.holiday from anon, authenticated;

grant select on public.holiday to authenticated;

-- `using (true)` IS CORRECT HERE AND WOULD BE A LEAK ANYWHERE ELSE IN THIS SCHEMA. A holiday row
-- carries no member, no team and no personal data; it is a public fact about the Vietnamese
-- calendar. glossary.md: "Holidays belong to the calendar, not to any member." Every other table in
-- this model is scoped by member or by team, and a reviewer under check R6 should read this comment
-- as the reason the exception is warranted rather than as an oversight (AC-14).
--
-- `to authenticated`, never `to public`: a policy written `to public` re-opens the table to the anon
-- key, which ships in the browser bundle by design (AC-6).
create policy holiday_select_all on public.holiday
  for select to authenticated using (true);
