-- SOLO, 2026-09-11. A member marks a date busy; the team sees how many people did, and who.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL.** No project is provisioned for this repository —
-- `.ai/registry/features.md` records `tests/permission-model.test.ts` as owed for that reason, and
-- ADR-027 phase 1 is where it gets written. Every policy below is reasoned from the ones already in
-- `supabase/migrations/`, which ARE the product's working examples; none of it has been executed.
--
-- **WHAT THIS TABLE IS NOT.** It is not a third `entry_type`, and `src/lib/domain/types.ts` carries
-- the argument at length. In one sentence: a busy person is AT WORK, so folding them into
-- `public.entry` would put them into INV-04's absence count and make the product report the team as
-- short-staffed on a day when nobody is away. INV-04 forbids a second definition of the ABSENCE
-- count; a different number about a day is not that. `invariants_touched` is `[]`, argued rather
-- than unfilled.
--
-- **NO APPROVAL, NO STATUS, NO TENTATIVE FLAG, NO NOTE.** The operator: *"vẫn đi làm bình thường.
-- Nên không cần approve"*. The row's whole content is that it exists, so there is nothing for an
-- admin to decide and no column for INV-02's trigger to watch. That is why this file installs no
-- trigger at all — `public.entry` needs one because approval can go stale; nothing here can.
--
-- **IDEMPOTENT, AND THAT IS NOT TIDINESS.** This file is applied BY HAND through the Supabase SQL
-- editor (ADR-024), so a run that fails half way leaves the schema part-changed and the operator
-- re-runs it. Every statement below survives being run twice.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The table.
-- ---------------------------------------------------------------------------------------------
-- ONE MEMBER, ONE DATE. No `end_date`, no `portion`, no `date_range` and therefore no `btree_gist`:
-- ADR-011 needed a generated range column because an ENTRY spans days and PostgREST filters columns
-- rather than expressions. A busy day is a scalar, served by the btree index the unique constraint
-- below already builds — the same reasoning ADR-015 § 6 gives for `public.holiday.date`.
--
-- `on delete restrict`, matching `public.entry`: a member is soft-deleted and never removed
-- (`.ai/standards/data-model.md`), so this should never fire, and if it does it is protecting the
-- team scope and the refusal is the correct outcome.
--
-- **`member_id` DEFAULTS TO `auth.uid()`, AND THIS TABLE IS STRICTER THAN `public.entry` BECAUSE OF
-- IT.** CAL-01's grant list INCLUDES `entry.member_id` and says why in as many words: *"it is
-- not-null and has no default, so the insert cannot omit it"* — so `createEntry` sends the id and
-- `entry_insert_own`s `with check` refuses a mismatch. With a default here the column can be left
-- out of the INSERT grant entirely, so a caller cannot NAME somebody else's id at all rather than
-- naming it and being refused. The `with check` below still compares, so the default is convenience
-- and never the control.
--
-- **`auth.uid()` BARE, NOT `(select auth.uid())`.** The `(select …)` wrapper is a POLICY
-- optimisation — it makes the call an InitPlan evaluated once per statement instead of once per row
-- — and the three policies below all use it. A COLUMN DEFAULT may not contain a subquery at all:
-- PostgreSQL rejects the table outright with *"cannot use subquery in column default expression"*.
-- Written with the wrapper first, out of symmetry with the policies, and caught by reading this file
-- back before it was handed over rather than by the apply failing.
create table if not exists public.busy_day (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null default auth.uid() references public.member (id) on delete restrict,
  date       date not null,
  created_at timestamptz not null default now(),

  -- **THE WHOLE OF "A PERSON COUNTS ONCE PER DATE".** `busyCountsFor` holds the same rule in
  -- TypeScript because the mock has no constraint; this is the real mechanism, and a UI affordance
  -- alone would never have been sufficient for it (the standard `.ai/registry/invariants.md` states
  -- for invariants, applied here by analogy rather than by obligation — this is not an invariant).
  constraint busy_day_one_per_member_per_date unique (member_id, date)
);

-- The read is `where date between … and …` with the policy supplying the team narrowing, so the
-- index that serves it leads with `date`. The unique constraint's index leads with `member_id` and
-- cannot answer a range scan across the team.
create index if not exists busy_day_date_idx on public.busy_day (date);

alter table public.busy_day enable row level security;

-- TEA-01 revoked `all` on its tables and granted per statement; the same shape here. `select` is
-- whole-row because there is no column on this table anybody is not allowed to read. The INSERT
-- grant is COLUMN-SCOPED and deliberately excludes `member_id`: an insert policy is row-level and
-- would otherwise permit a caller to name somebody else's — the lesson ADM-01's row records, and the
-- second half of the defence whose first half is the `with check` below.
revoke all on public.busy_day from authenticated;
grant select (id, member_id, date, created_at) on public.busy_day to authenticated;
grant insert (date) on public.busy_day to authenticated;
grant delete on public.busy_day to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 2. Who may read them.
-- ---------------------------------------------------------------------------------------------
-- **THE TEAM, AND THE WHOLE TEAM.** The operator's purpose is that somebody arranging an event can
-- see which days are heavy, so a mark that only its author could read would answer nobody. The
-- operator chose "count plus names" when asked, and this policy is what makes the names possible:
-- the rows come back with `member_id` and the screen resolves them against the roster it already
-- holds.
--
-- Keyed on `public.member_team_id(auth.uid())`, exactly as `entry_select_team` is, so INV-07's
-- mechanism is the one already in the product and a caller who is pending, rejected or removed reads
-- nothing — that function returns null for all three, and `null = null` is NULL rather than true.
drop policy if exists busy_day_select_team on public.busy_day;
create policy busy_day_select_team on public.busy_day
  for select to authenticated
  using (
    exists (
      select 1 from public.member m
      where m.id = public.busy_day.member_id
        and m.team_id = public.member_team_id((select auth.uid()))
    )
  );

-- ---------------------------------------------------------------------------------------------
-- 3. Who may write them. Only yourself, in both directions.
-- ---------------------------------------------------------------------------------------------
-- **NO ADMIN POLICY, AND THAT IS A DECISION.** An admin may edit and decide ENTRIES because an entry
-- is a claim on the team's capacity that somebody has to approve. A busy day is a person's statement
-- about their own workload; an admin clearing somebody else's would be overruling them about their
-- own week, which nobody asked for and which the product has no screen for.
--
-- The second conjunct is the approval gate every policy in this product inherits:
-- `member_team_id` is null for anybody not `approved`, so a pending sign-up cannot mark days on a
-- team they have not been let into.
drop policy if exists busy_day_insert_own on public.busy_day;
create policy busy_day_insert_own on public.busy_day
  for insert to authenticated
  with check (
    member_id = (select auth.uid())
    and public.member_team_id((select auth.uid())) is not null
  );

-- **A REFUSED DELETE IS FILTERED, NOT ERRORED**, and the seam is written knowing it: the statement
-- matches no row and PostgREST answers 200 with an empty body. For a toggle that is the right shape
-- — "refused" and "there was nothing there" are the same outcome to somebody who wanted the day
-- unmarked — and `src/lib/data/supabase.ts` records why it does not try to tell them apart.
drop policy if exists busy_day_delete_own on public.busy_day;
create policy busy_day_delete_own on public.busy_day
  for delete to authenticated
  using (
    member_id = (select auth.uid())
    and public.member_team_id((select auth.uid())) is not null
  );

-- **NO UPDATE POLICY AND NO UPDATE GRANT.** With row-level security enabled and no policy, an update
-- is denied — which is the correct and permanent state here rather than a gap awaiting a later
-- ticket: the row has no editable column. Marking and unmarking are an insert and a delete.

commit;
