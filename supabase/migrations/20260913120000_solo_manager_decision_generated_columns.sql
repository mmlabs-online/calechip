-- SOLO, 2026-09-13 — fix to ADR-035's clause (a2), `supabase/migrations/20260912100000_solo_manager_role.sql`.
--
-- **THE DEFECT: EVERY MANAGER DECISION WAS REFUSED** with 42501 *"a manager may only decide an entry,
-- not edit it"*, even a PATCH carrying `status` alone. Reported by the operator against the live
-- project right after the migration above was applied.
--
-- **THE CAUSE: `entry` HAS TWO STORED GENERATED COLUMNS** — `date_range` and `portion_slots`
-- (CAL-01, `20260903103000_cal01_entry.sql`). PostgreSQL computes stored generated columns AFTER the
-- BEFORE triggers run, so inside `entry_enforce_decision` those two fields of NEW are not yet the
-- values OLD carries. The masked whole-row comparison in (a2) therefore always saw a difference.
--
-- **THE FIX: MASK THEM TOO.** Nothing is lost: both are pure functions of `start_date`, `end_date`
-- and `portion`, which stay in the comparison, so a manager who changes the dates or the portion is
-- still refused. The rest of the function is transcribed unchanged from the migration above.
--
-- Safe to re-run: `create or replace` only.

begin;

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

  -- (a2) FIXED 2026-09-13: `date_range` and `portion_slots` are also masked — see this file's header.
  --
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
     and (to_jsonb(new) - '{status,rejection_reason,approved_by,approved_at,updated_at,date_range,portion_slots}'::text[])
         is distinct from
         (to_jsonb(old) - '{status,rejection_reason,approved_by,approved_at,updated_at,date_range,portion_slots}'::text[]) then
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
