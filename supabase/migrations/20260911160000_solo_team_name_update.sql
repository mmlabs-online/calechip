-- SOLO, 2026-09-11. An admin may rename their own team.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL.** No project is provisioned for this repository;
-- `.ai/registry/features.md` records `tests/permission-model.test.ts` as owed for that reason.
--
-- **ONE STATEMENT, AND THE POLICY IS DELIBERATELY UNTOUCHED.** `team_update_admin`
-- (`20260905000000_adm01_team_threshold.sql:62`) is already exactly right for a second writable
-- column: both its `using` and its `with check` read
-- `id = public.member_team_id((select auth.uid())) and public.is_admin((select auth.uid()))`, so an
-- admin may only ever update the row of the team they themselves belong to, and may not move that
-- row to another team. ADM-01 wrote the pair out identically for this exact reason and said so:
-- *"it is written out because the next admin write policy on this table will be copied from this one
-- and may not have that protection."* This is that next write, and it needed no policy at all.
--
-- **`id`, `overload_threshold` AND `created_at` ARE STILL WITHHELD** — a grant is per column and this
-- one names `name` alone, so nothing else on the row becomes writable by adding it. ADM-01's own
-- `grant update (overload_threshold)` is separate and unchanged; the two accumulate.
--
-- **IT INVALIDATES ONE SENTENCE IN A HUMAN-PLANE STANDARD, AND THAT SENTENCE IS NOT MINE TO EDIT.**
-- `.ai/standards/rbac-and-security.md:196-197` uses this table as the worked example of a hole that
-- a column grant CAN close, on the grounds that *"nobody may rename a team, so the privilege could
-- simply be withheld"*. After this migration somebody may. The replacement wording is printed in the
-- reply for the operator to paste (RULE-01, and `.ai/standards/` is human plane per CLAUDE.md
-- § Two planes). **The argument that passage is making survives intact** — it is about why column
-- grants cannot separate a member from an admin on `public.entry`, where both are the same
-- PostgreSQL role, and that is still true. What changes is only its illustration.
--
-- **NO NEW TEAM CAN BE CREATED BY THIS FILE AND NONE CAN BE DELETED.** There is still no insert
-- policy and no delete policy on `public.team`, so `.ai/standards/data-model.md`'s *"One row in v1"*
-- and its *"Refuse. No delete path exists for a team in v1"* both continue to hold. That matters
-- beyond tidiness: the operator was shown that a SECOND team would make two documented, accepted
-- costs live — `member_select_pending_admin` is not team-scoped, so every admin would see every
-- pending sign-up (`rbac-and-security.md:93-96`), and the holiday calendar is national, so any admin
-- would rewrite everybody's Tết (`data-model.md:211`). They chose the single-team shape. This
-- migration keeps that choice enforced by the datastore rather than by intention.
--
-- **IDEMPOTENT.** Applied by hand through the Supabase SQL editor (ADR-024); `grant` is idempotent
-- by nature, so a re-run is a no-op rather than an error.

begin;

grant update (name) on public.team to authenticated;

commit;
