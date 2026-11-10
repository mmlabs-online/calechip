-- MIR-09 — known schema inconsistencies cleaned up: an index on `member.team_id`, a check on
-- `team.overload_threshold`. ADR-069.
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- .ai/board/tickets/MIR-09/01-plan.md § 4, § 6. Source audit references A:109, A:139.
--
-- AC-1: `public.member` has a primary key and no other index, and the team predicates in `cal11`, in
-- `member_team_id` and in phase 3's coming `membership` backfill all read `member.team_id`.
--
-- AC-2, AC-3: `team.overload_threshold numeric not null default 0.5` has had no check since
-- `20260831150024_tea01_membership.sql:27`. The range already exists in two written places —
-- ADM-01 AC-7 (0% to 100% inclusive) and `SetOverloadThresholdInput` (a fraction in [0, 1] inclusive)
-- — and until this migration only the screen enforced it.
--
-- **THE CONSTRAINT IS VALIDATED IMMEDIATELY, NOT `not valid`.** If a row outside [0, 1] already
-- exists, applying this migration fails loudly rather than leaving the data inconsistent — ADR-069
-- decision 1 and its "Options considered" section record why.
--
-- NOT VERIFIED AGAINST A RUNNING POSTGRESQL, like every migration since 20260910093000.

begin;

create index if not exists member_team_id_idx on public.member (team_id);

alter table public.team drop constraint if exists team_overload_threshold_range;
alter table public.team
  add constraint team_overload_threshold_range
  check (overload_threshold >= 0 and overload_threshold <= 1);

commit;
