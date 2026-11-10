-- SOLO, 2026-09-12 — ADR-035. A third role, `manager`, which decides entries and nothing else.
--
-- Operator's instruction, verbatim: *"Thêm 1 role manager cho user, thêm quyền approve cho user với
-- quyền manager."* The ADR is
-- `.ai/registry/decisions/ADR-035-a-third-role-manager-decides-entries-and-nothing-else.md`, and it
-- is the authority for everything below; this file is its enforcement and adds no decision of its
-- own.
--
-- **`public.is_admin` IS NOT TOUCHED, AND THAT IS THE MECHANISM RATHER THAN AN OMISSION.** Every
-- power a manager must NOT gain — the holiday calendar, the threshold, the roster, the sign-up
-- queue, the team list, and editing anybody's entry — is keyed on that helper, so leaving it meaning
-- `role = 'admin'` exactly denies all of them at once and no policy in the product has to change.
-- The widening is a SECOND helper, used by the decision guard alone. A later reader who finds a
-- manager refused by the holiday screen is looking at the design, not at a bug.
--
-- **THE HARD PART IS THAT APPROVING IS A WRITE TO A ROW THAT CARRIES EVERYTHING ELSE.** Granting a
-- manager the update policy on somebody else's entry grants them that member's dates, type, portion
-- and note along with it — the power the charter calls the one that "changes what the product is".
-- It cannot be separated by a column grant, for the reason the trigger below has recorded since
-- ADM-05: `member`, `manager` and `admin` are all the SAME PostgreSQL role, `authenticated`, so a
-- grant revoked from one is revoked from all. Step 4's masked comparison is where the separation
-- actually lives, and it is the single most reviewable thing in this file.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The rank.
-- ---------------------------------------------------------------------------------------------
-- `before 'admin'` so the ENUM'S DECLARATION ORDER IS THE RANK ORDER. PostgreSQL orders an enum by
-- declaration, not alphabetically, so `role > 'member'::public.member_role` keeps working and now
-- means "decides something" — appending `manager` after `admin` would have made that predicate
-- quietly false for the new rank.
--
-- `if not exists` so re-applying this file is a no-op, which ADR-024 requires of the seed and is
-- cheap to honour here too.
alter type public.member_role add value if not exists 'manager' before 'admin';

commit;

-- **A SECOND TRANSACTION, AND IT IS NOT STYLE.** PostgreSQL refuses to USE an enum value added in
-- the transaction that added it. Everything below compares `role::text` rather than casting a
-- literal, so it would survive either way — but the split is kept so that a later edit which does
-- write `'manager'::public.member_role` fails at review rather than at 2am on the live project.

begin;

-- ---------------------------------------------------------------------------------------------
-- 2. The one helper that widens.
-- ---------------------------------------------------------------------------------------------
-- The same three conjuncts `is_admin` carries — the row exists, is not removed, and is `approved`
-- (ADR-033) — over two roles instead of one. An undecided or rejected sign-up decides nothing, and a
-- removed manager decides nothing, both for the reasons those clauses were written.
--
-- `role::text` AND NOT A CAST LITERAL: see the note above the transaction split.
create or replace function public.may_decide(p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.member m
    where m.id = p_uid
      and m.removed_at is null
      and m.status = 'approved'
      and m.role::text in ('admin', 'manager')
  );
$$;

-- The shape TEA-01 used for `is_admin` and `member_team_id`: revoke from `public`, grant to
-- `authenticated`. `security definer` is what lets a policy on `entry` consult `member` without
-- recursing through `member`'s own policies.
revoke all on function public.may_decide(uuid) from public;
grant execute on function public.may_decide(uuid) to authenticated;

-- ---------------------------------------------------------------------------------------------
-- 3. The row a manager may touch.
-- ---------------------------------------------------------------------------------------------
-- A SEPARATE POLICY AND NOT A WIDENED `entry_update_admin`. Policies are OR-ed, so this adds a way
-- in for a manager and changes nothing about the admin's — which matters because the two are not the
-- same permission and must not become one line that a later edit can widen by accident.
--
-- `and not public.is_admin(...)` is deliberate and is about READING rather than about access: an
-- admin is already admitted by `entry_update_admin`, so without this conjunct both policies would
-- match for them and a reviewer could not tell which one was doing the work.
--
-- THE TEAM PREDICATE IS COPIED FROM `entry_update_admin` AND IS LOAD-BEARING. That policy's own
-- comment records why: without it, a decider on ANY team reaches EVERY entry in the product, and it
-- fails open and silently.
--
-- **THIS POLICY ADMITS THE WHOLE ROW. STEP 4 IS WHAT NARROWS IT TO FOUR COLUMNS.** Read them
-- together or neither makes sense.
drop policy if exists entry_update_manager on public.entry;
create policy entry_update_manager on public.entry
  for update to authenticated
  using (
    public.may_decide((select auth.uid()))
    and not public.is_admin((select auth.uid()))
    and public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
  )
  with check (
    public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
  );

-- ---------------------------------------------------------------------------------------------
-- 4. The guard, replaced a fourth time.
-- ---------------------------------------------------------------------------------------------
-- `updated_at`, then (a), then (b), then (c). ORDER INSIDE THE FUNCTION IS THE WHOLE DESIGN and is
-- unchanged: the guard reads the values the client SENT, before anything below has touched them. A
-- member editing dates on an approved entry passes (a) — at that point `new.status` still equals
-- `old.status` — and is then reset by (c). Reversed, the guard sees a `status` change made by the
-- reset itself and refuses a member's legitimate edit. ADR-016 section 1.
--
-- **A DIFF AGAINST THE PREVIOUS BODY SHOULD SHOW (a) WIDENED, (a2) ADDED, AND NOTHING ELSE.** A
-- `create or replace` is a whole function body, so a reviewer sees a new file rather than a change,
-- and a replacement that quietly altered clause (c) would be a broken invariant with a passing diff.
create or replace function public.entry_enforce_decision() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- CAL-02 AC-12. The datastore's own clock, never the client's: an UPDATE must name a value for
  -- every column it writes, and this line overwrites whatever a caller might send — which is why
  -- `updated_at` is absent from the update grant and cannot be sent at all. A timestamp a client can
  -- set is a record that can be backdated.
  new.updated_at := now();

  -- (a) ADM-05 — ADR-016 section 1, WIDENED BY ADR-035. Only a DECIDER may move the four decision
  -- columns, and a decider is now an admin or a manager.
  --
  -- THIS IS NOT EXPRESSIBLE AS A POLICY, and that is why it is here. An RLS `with check` sees the
  -- NEW row and has no OLD, so "`status` did not change" cannot be written; and CAL-02's
  -- `entry_update_own` admits a member's own row, so a raw PATCH {"status":"approved"} against it
  -- satisfies the policy and the entry is approved by the person who wrote it. A column grant cannot
  -- help either: `member`, `manager` and `admin` are the SAME PostgreSQL role, `authenticated`, so
  -- revoking `status` from it blocks the admin too.
  --
  -- v_uid is null in a migration, the SQL editor or a service-role call; that context is not
  -- blocked, because nothing blocks a service-role key anyway (known weakness 1).
  if (new.status           is distinct from old.status
   or new.rejection_reason is distinct from old.rejection_reason
   or new.approved_by      is distinct from old.approved_by
   or new.approved_at      is distinct from old.approved_at)
     and v_uid is not null then

    if not public.may_decide(v_uid) then
      raise exception 'only an admin or a manager may decide an entry'
        using errcode = '42501';
    end if;

    -- ADR-035 § Decision item 3. A MANAGER MAY NOT DECIDE THEIR OWN ENTRY; an admin may, which the
    -- charter decided on 2026-08-31 for that role and for no other. Written as "not an admin and it
    -- is mine" rather than as a role list, so the day a fourth rank appears this clause still means
    -- what it says.
    if not public.is_admin(v_uid) and old.member_id = v_uid then
      raise exception 'a manager may not decide their own entry'
        using errcode = '42501';
    end if;
  end if;

  -- (a2) ADR-035 § Decision item 4 — **THE CONTAINMENT, AND THE WHOLE REASON A MANAGER IS NOT AN
  -- ADMIN.** `entry_update_manager` admits the row, and the row carries the owner's dates, type,
  -- portion, tentativeness and note. Without this clause, "a manager may approve" would in fact read
  -- "a manager may rewrite anybody's entry", which is the power ADR-035 § Rationale refuses.
  --
  -- **A MASKED WHOLE-ROW COMPARISON RATHER THAN A COLUMN LIST**, so a column added to `entry` later
  -- is covered on the day it is added rather than on the day somebody remembers this file. The five
  -- names removed are the four decision columns plus `updated_at`, which the line at the top of this
  -- function has already moved and which is therefore never the caller's doing.
  --
  -- IT DOES NOT FIRE ON A MANAGER'S OWN ENTRY: that write is `entry_update_own`'s, and a manager
  -- edits their own entry on exactly the terms every member does.
  if v_uid is not null
     and old.member_id <> v_uid
     and not public.is_admin(v_uid)
     and public.may_decide(v_uid)
     and (to_jsonb(new) - '{status,rejection_reason,approved_by,approved_at,updated_at}'::text[])
         is distinct from
         (to_jsonb(old) - '{status,rejection_reason,approved_by,approved_at,updated_at}'::text[]) then
    raise exception 'a manager may only decide an entry, not edit it'
      using errcode = '42501';
  end if;

  -- (b) ADM-05 — ADR-016 section 1. PROVENANCE, NEVER TRUSTED FROM THE WIRE, IN EITHER DIRECTION.
  --
  -- `approved_by` is the only audit trail v1 has, and known weakness 3 means nothing anywhere would
  -- contradict a forged one. Written here, it also makes CAL-05's "displaying who approved is not
  -- approving" true by construction rather than by a story remembering it.
  --
  -- UNCHANGED BY ADR-035, and it is worth saying why: `v_uid` is whoever decided, so a manager's
  -- approval records the manager. The screens that render `approved_by` name a person, not a role,
  -- so none of them needed a change.
  --
  -- Nulling `rejection_reason` on approval is FORCED, not chosen: the biconditional check
  -- `entry_rejection_reason_iff_rejected` refuses any transition off `rejected` that leaves the
  -- reason standing, and would surface as a raw 23514 (INV-03).
  if new.status = 'approved'::public.entry_status
     and old.status is distinct from 'approved'::public.entry_status then
    new.approved_by      := v_uid;
    new.approved_at      := now();
    new.rejection_reason := null;
  elsif new.status is distinct from 'approved'::public.entry_status then
    new.approved_by := null;
    new.approved_at := null;
  end if;

  -- (c) INV-02, and the rejected-entry hole closed with it (ADR-016 section 3). CAL-01's and
  -- CAL-02's, TRANSCRIBED UNCHANGED. RUNS LAST, ON PURPOSE — see the order note above.
  --
  -- A substantive edit revokes the decision: dates, type, portion and tentative are substantive;
  -- `note` alone is NOT, which is data-model.md's own carve-out.
  --
  -- It is ACTOR-BLIND on purpose: an admin's edit under CAL-03 revokes approval exactly as the
  -- owner's does. INV-02's text carries no actor qualifier — and it still does not, which is why
  -- ADR-035 amends no invariant. A manager reaches this clause only through their own entry, since
  -- (a2) refused every other substantive edit they could have sent.
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

commit;
