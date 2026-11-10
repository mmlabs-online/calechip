-- SOLO, 2026-09-26. A member reports an issue; an admin reads the reports.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like every migration since 20260910093000.
-- `tests/permission-model.test.ts` is still owed — `.ai/standards/rbac-and-security.md`
-- § Known weaknesses 1.
--
-- **THE OPERATOR'S FOUR DECISIONS, 2026-09-26, each asked as an explicit question with its cost
-- stated.** They are the whole specification; this file invents nothing beside them, because
-- `CLAUDE.md` § *No invention* names database fields as the one thing an agent may not originate.
--   1. The control is a **floating bubble on every page**, like a chat widget.
--   2. A report carries **`message`, `kind` and the page it was sent from** — plus the author and
--      the time, which the option's own text named.
--   3. An admin **reads and marks done**. No delete path, which is also ADR-013's shape everywhere
--      else in this product: nothing here destroys a row a person wrote.
--   4. **Every admin reads every report.** Straight along ADR-039 and ADR-044 — a report is about
--      the product and not about a team, so no team predicate appears anywhere below.
--
-- **THERE IS NO `team_id` AND THAT IS DECISION 4, NOT AN OMISSION.** The same shape ADR-015 chose
-- for `holiday`: a row that belongs to no team needs no foreign key to one, and INV-07 constrains
-- entries and the members they belong to rather than a row that is neither. The author's team is
-- reachable through `member_id` for anybody who wants it, and reaching for it is not this feature.

begin;

create type public.issue_kind as enum ('bug', 'idea', 'other');

-- `open` FIRST, so the enum's declaration order is the order a reader expects and `status = 'open'`
-- is the default the column below takes. PostgreSQL orders an enum by declaration, not
-- alphabetically, which is the property 20260912100000_solo_manager_role.sql leaned on for the rank.
create type public.issue_status as enum ('open', 'done');

-- No cascade. `.ai/standards/data-model.md`: "There is no cascade anywhere in this model, and that
-- is a decision rather than an omission." `on delete restrict` is the shape `member.team_id` uses,
-- and it costs nothing here: no member row is ever deleted (ADR-013 soft-removes), so the restrict
-- never fires and exists to say that a report must not outlive knowledge of who sent it.
--
-- **`page` IS WHERE THE PERSON WAS, NOT A ROUTE THIS TABLE VALIDATES.** It is `useLocation()`'s
-- pathname, sent by the client, and a client-supplied value is exactly what it looks like: a hint
-- for the admin reading the report. Nothing derives behaviour from it, so nothing is at risk if it
-- is wrong — which is the only reason it is acceptable to trust the wire here at all.
--
-- **THE TWO LENGTH CHECKS ARE GUARDS AND NOT FIELDS.** `text` is unbounded, and an unbounded column
-- reachable by an INSERT policy every signed-in person satisfies is a place to paste a megabyte.
-- `member.display_name` has the same shape of check for the same reason (`invalid_display_name` in
-- `src/lib/domain/types.ts` names it). The numbers are a ceiling, not a specification: a report is a
-- paragraph, and 2000 characters is several.
create table public.issue_report (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.member(id) on delete restrict,
  kind       public.issue_kind not null,
  message    text not null,
  page       text not null,
  status     public.issue_status not null default 'open',
  created_at timestamptz not null default now(),

  constraint issue_report_message_not_blank check (btrim(message) <> ''),
  constraint issue_report_message_length   check (char_length(message) <= 2000),
  constraint issue_report_page_not_blank   check (btrim(page) <> ''),
  constraint issue_report_page_length      check (char_length(page) <= 200)
);

-- EXPLICIT, NOT INHERITED. TEA-01's revoke names the tables that existed then, and Supabase's
-- default privileges on a new table in `public` are permissive — so relying on them would leave the
-- policy as the only thing between `anon` and this table, and known weakness 1 is precisely that a
-- policy fails open silently. ADM-02 recorded this as the fourth time the trap had been found; this
-- is the fifth.
alter table public.issue_report enable row level security;
revoke all on public.issue_report from anon, authenticated;

-- ---------------------------------------------------------------------------------------------
-- The write a person makes.
-- ---------------------------------------------------------------------------------------------
-- **THE COLUMN LIST IS THE CONTROL FOR EVERYTHING NOT IN IT.** `id`, `status` and `created_at` are
-- withheld from every caller, so a statement naming any of them is refused with
-- `42501 permission denied for column` before any policy runs. That is what stops a report arriving
-- pre-marked `done`, and what stops one arriving backdated — `created_at` is the only time this
-- feature has and a client-settable one is a record that can be forged. TEA-04's
-- `grant update (role, removed_at)` is the same technique with the same reasoning: a column grant
-- cannot distinguish WHO is writing, so it works exactly where the answer is "nobody".
grant insert (member_id, kind, message, page) on public.issue_report to authenticated;

-- `entry_insert_own`'s clause, verbatim in shape: the row is the caller's or it is refused. There is
-- no `status = 'approved'` conjunct and no `removed_at is null` conjunct, and their absence is
-- deliberate rather than overlooked — `entry_insert_own` has neither either, and the interface makes
-- the question moot: the bubble lives in `AppShell`, which `src/App.tsx` renders only for
-- `membership.state === "member"`. A pending sign-up sees `AwaitingApproval` and no bubble.
--
-- **AN INSERT REFUSAL IS AN ERROR AND NOT AN EMPTY BODY**, unlike the filtered UPDATEs this seam
-- documents everywhere: `with check` raises `42501`. That is why `src/lib/data/supabase.ts` may
-- treat `!error` as success here and must not anywhere else.
create policy issue_report_insert_own on public.issue_report
  for insert to authenticated
  with check (member_id = (select auth.uid()));

-- ---------------------------------------------------------------------------------------------
-- The read, and who gets it.
-- ---------------------------------------------------------------------------------------------
-- **THERE IS NO `issue_report_select_own`, AND THE ABSENCE IS THE DESIGN.** A reporter has no screen
-- that reads a report back, so granting them SELECT would be a permission nothing needs — and it
-- would have to be written knowing that the only thing on the other side of it is somebody else's
-- report if the predicate is ever got wrong. It also decides the seam's shape: `createIssueReport`
-- does NOT `.select()` the row it inserted, because under these policies that returning clause
-- would be checked against the select policies and answer nothing for the person who just wrote it.
--
-- Decision 4: `is_admin` and NO team predicate. `public.is_admin` already carries the three
-- conjuncts TEA-01 gave it — the row exists, is not removed, and is `approved` — so a removed admin
-- reads nothing, which is what that helper is for.
create policy issue_report_select_admin on public.issue_report
  for select to authenticated
  using (public.is_admin((select auth.uid())));

grant select on public.issue_report to authenticated;

-- ---------------------------------------------------------------------------------------------
-- Marking one done.
-- ---------------------------------------------------------------------------------------------
-- **ONE COLUMN, AND THE GRANT IS WHY AN ADMIN CANNOT REWRITE WHAT SOMEBODY WROTE.** Decision 3 is
-- read and mark done. A blanket `grant update on public.issue_report` would hand every admin the
-- power to edit the `message` of a report they disagree with, silently, with the author having no
-- way to see it — so `message`, `kind`, `page`, `member_id` and `created_at` are simply never
-- granted and a statement naming one is refused before the policy runs.
grant update (status) on public.issue_report to authenticated;

-- `using` decides which rows the statement may touch and `with check` the row it leaves behind;
-- both are the same predicate here because the only column that can move is `status` and neither
-- value of it changes who may act. The `with check` is kept anyway, as the second lock every other
-- update policy in this schema keeps: the day a second writable column arrives, this policy already
-- refuses a row that would move out of an admin's reach.
create policy issue_report_update_admin on public.issue_report
  for update to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- **NO DELETE POLICY AND NO `grant delete`, PERMANENTLY.** Decision 3 stopped at *mark done*, and
-- every other table in this model refuses destruction for the reason ADR-013 gives: a row a person
-- wrote is the record that they wrote it. `status = 'done'` is how a report leaves the admin's
-- attention, and `delete` is a different decision nobody has made.

commit;
