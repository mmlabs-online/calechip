-- CAL-01. The `entry` table, INV-01's exclusion constraint, INV-03's check and INV-02's trigger.
-- 01-plan.md section 6. ADR-005 for why every one of these is in the database rather than in the
-- seam; ADR-011 for the two generated columns and the constraint; ADR-016 for the function name and
-- the trigger shape.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- Field names and types are copied from .ai/standards/data-model.md without alteration (RULE-04).
--
-- WHAT THIS FILE DOES NOT CONTAIN, and each absence is a decision:
--   * No `update` policy and no `delete` policy on `public.entry`. With row-level security enabled
--     and no policy, both are denied — which is the correct state until CAL-02 and CAL-03 build the
--     rows that need them. ADR-016 Consequences also puts the column grant excluding `member_id`
--     with those tickets rather than here.
--   * No `BEFORE INSERT` guard. ADR-016's trigger exists because a `with check` cannot see the OLD
--     row; on an insert there is no old row and the column grant below answers the whole question
--     earlier and declaratively. A second `BEFORE` trigger on `entry` would reintroduce the
--     alphabetical-ordering trap ADR-016 Consequences warns about for exactly nothing.
--   * No holiday awareness, no absence count, no `team` read. CAL-04, CAL-07, ADM-02.
--
-- TODO(verify): `btree_gist` availability on the hosted project, and whether the `extensions` schema
-- is on the `search_path` in force when the constraint below is created. ADR-011 section 4 carries
-- this marker and 01-plan.md section 6 does not discharge it — no project is provisioned and
-- Supabase is on the "past reliable recall" list in .ai/standards/tech-stack.md. If the operator
-- class does not resolve, the `alter table` fails at apply time with "data type uuid has no default
-- operator class for access method gist". The fallback is to schema-qualify or to extend the
-- search_path for this statement; it is not to drop `member_id` from the constraint, which would
-- make INV-01 global across the team.

-- Step 1. `member_id WITH =` puts a uuid equality test inside a GiST index and core GiST has no
-- operator class for it (ADR-011 section 4). `with schema extensions` matches TEA-01's `citext`
-- line rather than being chosen fresh.
create extension if not exists btree_gist with schema extensions;

-- Step 2. The three enums. Values are data-model.md's, in its order.
create type public.entry_type    as enum ('pto', 'wfh');
create type public.entry_portion as enum ('full', 'am', 'pm');
create type public.entry_status  as enum ('pending', 'approved', 'rejected');

-- Steps 3 and 4. The table, and the two generated columns exactly as ADR-011 section 1 writes them.
--
-- No cascade on either reference. data-model.md: a member is soft-deleted and never removed, so
-- `on delete restrict` should never fire — and if it does it is protecting INV-07 and the refusal is
-- the correct outcome. Nulling `approved_by` would erase who approved.
create table public.entry (
  id               uuid primary key default gen_random_uuid(),
  member_id        uuid not null references public.member (id) on delete restrict,
  type             public.entry_type not null,
  portion          public.entry_portion not null default 'full',
  start_date       date not null,
  end_date         date not null,          -- INCLUSIVE. Equal to start_date for a single day.
  tentative        boolean not null default false,
  status           public.entry_status not null default 'pending',
  rejection_reason text,
  note             text,
  approved_by      uuid references public.member (id) on delete restrict,
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- The '[]' constructor is REQUIRED by the inclusive end_date. `daterange(start_date, end_date)`
  -- defaults to '[)' and would silently drop the last day of every entry (ADR-011 section 1).
  --
  -- PostgreSQL canonicalises a stored discrete range to '[)', so a one-day entry is stored and read
  -- back as ['2026-01-01','2026-01-02') and the upper bound is the day AFTER the entry ends. The
  -- seam reads `end_date`, the plain column, and never derives the end from this — see the comment
  -- on `toEntry` in src/lib/data/supabase.ts.
  date_range       daterange generated always as (daterange(start_date, end_date, '[]')) stored,

  -- Slot 0 is the morning, slot 1 the afternoon (ADR-011 section 3). This exists so INV-01's
  -- constraint can INTERSECT portions rather than compare them for equality.
  portion_slots    int4range generated always as (
                     case portion
                       when 'full' then int4range(0, 2)
                       when 'am'   then int4range(0, 1)
                       when 'pm'   then int4range(1, 2)
                     end
                   ) stored,

  -- Step 5. AC-9's second lock, and it is a decision this ticket owns: ADR-011 Consequences records
  -- that nothing yet required it and routes it to "whoever designs the entry-creation story". The
  -- seam refuses an inverted range before the request is sent, because an inverted pair otherwise
  -- fails inside `date_range` above with "range lower bound must be less than or equal to range
  -- upper bound" — a database error text where a sentence about dates belongs. This constraint means
  -- a caller bypassing this application still cannot store one.
  constraint entry_end_after_start check (end_date >= start_date),

  -- Step 6. INV-03, and it is a BICONDITIONAL. One-directional would let an approved entry keep a
  -- stale reason, and the invariant would read as claimed and not be held — which
  -- .ai/registry/invariants.md calls worse than never claiming it. ADR-016 section 3 requires both
  -- directions and depends on this shape: clause (b) of the trigger nulls the reason on approval
  -- precisely because this check refuses the transition otherwise.
  constraint entry_rejection_reason_iff_rejected check (
    (status = 'rejected'::public.entry_status)
      = (rejection_reason is not null and btrim(rejection_reason) <> '')
  )
);

-- Step 7. INV-01. ADR-011 section 3, verbatim.
--
-- Two rows conflict when all three hold: same member, intersecting dates, intersecting slots.
--   full vs am    [0,2) && [0,1)  -> true,  refused    ("full conflicts with everything")
--   am   vs pm    [0,1) && [1,2)  -> false, allowed    ("am and pm do not conflict")
--   full vs full  [0,2) && [0,2)  -> true,  refused
--
-- NEVER `portion with =`. With equality, a `full` entry and an `am` entry on one date have unequal
-- portions, the constraint does not fire, BOTH rows are accepted, and the member is recorded as both
-- fully and half absent on one day — which INV-04 then counts as 1.5 people away for one person.
-- Nothing errors. That failure passes every test written from the happy path, and it is the reason
-- ADR-011 exists rather than a line in a migration.
alter table public.entry
  add constraint entry_no_overlapping_portion
  exclude using gist (
    member_id     with =,
    date_range    with &&,
    portion_slots with &&
  );

-- Step 8. INV-02, in its INV-02-ONLY form. This is clause (c) of ADR-016 section 1 and nothing else:
-- clauses (a) and (b) guard and rewrite the four decision columns on an UPDATE, and nothing in this
-- ticket approves, rejects or updates an entry.
--
-- THE NAME IS LOAD-BEARING. ADM-05 REPLACES this function with `create or replace function`. A
-- different name lands its version BESIDE this one, and PostgreSQL fires same-event triggers
-- alphabetically by name — so the guard's correctness would start depending on spelling (ADR-016
-- Consequences). One function is what keeps the order explicit.
--
-- `security invoker`, following ADR-016: the function needs no privilege of its own.
--
-- It cannot be exercised end to end by this ticket — there is no update policy, so no UPDATE from a
-- signed-in caller reaches it. It ships anyway, correct, because a wrong function shipped now is
-- held to be correct by every later ticket that only replaces it.
create function public.entry_enforce_decision() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  -- INV-02, and the rejected-entry hole closed with it (ADR-016 section 3). A substantive edit
  -- revokes the decision: dates, type, portion and tentative are substantive; `note` alone is NOT,
  -- which is data-model.md's own carve-out.
  --
  -- It is ACTOR-BLIND on purpose: an admin's edit under CAL-03 revokes approval exactly as the
  -- owner's does. INV-02's text carries no actor qualifier.
  --
  -- `rejection_reason` is cleared in the same statement, and that is forced rather than chosen: the
  -- biconditional check above refuses any transition off `rejected` that leaves the reason standing.
  -- Clearing `approved_by` and `approved_at` too is ADR-011 Consequences — a `pending` entry still
  -- naming its approver is the false record INV-02 exists to prevent.
  if (new.start_date is distinct from old.start_date
   or new.end_date   is distinct from old.end_date
   or new.type       is distinct from old.type
   or new.portion    is distinct from old.portion
   or new.tentative  is distinct from old.tentative)
     and old.status <> 'pending'::public.entry_status then
    new.status           := 'pending'::public.entry_status;
    new.approved_by      := null;
    new.approved_at      := null;
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;

create trigger entry_enforce_decision
  before update on public.entry
  for each row execute function public.entry_enforce_decision();

-- Step 9. EXPLICIT, NOT INHERITED. TEA-01's `revoke all on public.team, public.member,
-- public.allowed_email from anon, authenticated` names three tables because `entry` did not exist,
-- and Supabase's default privileges on a new table in `public` are permissive. Relying on them would
-- leave the policy as the only thing between `anon` and a write, and rbac-and-security.md known
-- weakness 1 is precisely that a policy fails open silently. ADR-016 Consequences records this as
-- the third time the trap has been found.
alter table public.entry enable row level security;
revoke all on public.entry from anon, authenticated;

-- Step 10. The read grant, and the insert grant WHOSE COLUMN LIST IS AC-11's CONTROL.
--
-- `status`, `rejection_reason`, `approved_by`, `approved_at`, `id`, `created_at`, `updated_at`,
-- `date_range` and `portion_slots` are all absent from the list deliberately. A statement naming any
-- of them is refused with `42501 permission denied for column` BEFORE any policy runs.
--
-- This is the one case where a column grant works on `entry`. rbac-and-security.md known weakness 6
-- records that column privileges cannot distinguish a member from an admin, because both are the
-- same PostgreSQL role, `authenticated` — fatal wherever the answer differs by role. Here the answer
-- is NOBODY, for both roles: an admin approves by UPDATING an entry under ADM-05, never by creating
-- one already approved. So the privilege is simply withheld. Same shape as TEA-04 on
-- `member.team_id` and ADM-01 on `team.overload_threshold`.
--
-- `member_id` IS in the list, and must be: it is not-null and has no default, so the insert cannot
-- name a member without it. What stops a caller naming somebody else is the policy below, not this.
grant select on public.entry to authenticated;
grant insert (member_id, type, portion, start_date, end_date, tentative, note)
  on public.entry to authenticated;

-- Step 11. The team read. `Read any entry in the team` is checked for both roles in
-- rbac-and-security.md, which is what makes a note readable by the whole team — it follows
-- mechanically from this being a row-level select policy under ADR-005 rather than from any screen.
--
-- Both calls are TEA-01's `security definer` helper, so a policy on `entry` may consult `member`
-- without recursing through `member`'s own policies. `to authenticated`, never `to public`: a policy
-- written `to public` re-opens the table to the anon key, which ships in the browser bundle by
-- design (rbac-and-security.md, "Secrets").
create policy entry_select_team on public.entry
  for select to authenticated
  using (
    public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
  );

-- Step 12. AC-10, and it is UNIFORM ACROSS ROLES with no role predicate at all.
-- rbac-and-security.md marks `Create an entry on behalf of another member` as a denial by default
-- for both roles — the admin has no more power here than the member — and one `with check` admitting
-- no value other than the caller's own id is the shortest correct expression of that, and therefore
-- the hardest to write wrongly. INV-07 is the not-null reference on `member_id` plus this.
create policy entry_insert_own on public.entry
  for insert to authenticated
  with check (member_id = (select auth.uid()));
