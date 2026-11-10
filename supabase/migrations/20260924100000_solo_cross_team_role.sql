-- SOLO, 2026-09-24. An admin sets any member's rank, on any team.
--
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- **NOT VERIFIED AGAINST A RUNNING POSTGRESQL**, like every cross-team file before it
-- (20260911180000_solo_many_teams.sql, 20260922150000_cal11_cross_team_reads.sql).
-- `tests/permission-model.test.ts` is still owed — `.ai/standards/rbac-and-security.md`
-- § Known weaknesses 1.
--
-- **THE GAP THIS CLOSES, NAMED EXACTLY.** Since 20260911180000 an admin has read EVERY team's roster
-- through `list_all_members()`, and since CAL-11 any one team's through `list_members_for_team()`.
-- The role write never moved: it is a plain `update public.member set role = …`, and the only policy
-- that admits it is TEA-04's `member_update_admin`, whose `using` carries
-- `team_id = public.member_team_id(auth.uid())`. So the Members screen drew a `Make manager` button
-- on somebody the datastore would not let the caller touch, the PATCH came back `[]`, and the seam
-- reported the refusal it correctly saw. A screen that offers a control the datastore refuses is
-- ADR-005's failure mode read backwards — the affordance was wider than the control.
--
-- **THIS IS A NEW PERMISSION, NOT A BUG FIX, AND THAT IS WHY IT NEEDS AN ADR.** ADR-039 § Decision 1
-- enumerates exactly three cross-team powers — create and rename a team, admit a sign-up onto any
-- team, move an approved member between teams — and SETTING A RANK IS NOT AMONG THEM.
-- `move_member`'s own header says so in terms: *"an admin moving somebody gains no power to promote
-- or remove them on a team the admin is not on."* The operator decided otherwise on 2026-09-24, in
-- words, in the session that produced this file. ADR-044 records it.
--
-- **REMOVAL IS DELIBERATELY NOT HERE.** `removeMember` is the other write on the same policy and it
-- stays own-team. Nothing decided it, the operator was asked about ranks, and widening a destructive
-- power because it sits beside the one that was asked for is exactly the drift ADR-039's enumerated
-- list exists to prevent. `src/routes/MemberList.tsx` hides that control on another team's row —
-- an affordance (ADR-005), and the policy is still the control.
--
-- **WHY A FUNCTION AND NOT `or public.is_admin(...)` ON THE POLICY.** ADR-039 § Rationale, unchanged
-- and still the whole reason:
--   * an UPDATE with a `WHERE`, and any `RETURNING`, is ALSO checked against the SELECT policies,
--     so a cross-team write needs the caller to SELECT the other team's rows;
--   * letting an admin SELECT every `member` row silently rewrites `listMembers()`, which selects
--     unfiltered because `member_select_team` WAS the team boundary — and that list is INV-04's
--     denominator on every calendar screen.
-- A definer function checks `is_admin` in its own body and changes no read anybody else makes. The
-- table policies below this line are exactly what they were; `member_update_admin` is untouched and
-- still the only path for a plain table write.
--
-- `set search_path = ''` and schema-qualified names throughout, the shape TEA-01's definer functions
-- use: a definer function resolving an unqualified name through a caller-controlled search path
-- could be steered into somebody else's table.
--
-- **IDEMPOTENT.** Applied by hand through the SQL editor (ADR-024): `create or replace`, and the
-- grants are idempotent by nature.

begin;

-- ---------------------------------------------------------------------------------------------
-- The rank write, for any team.
-- ---------------------------------------------------------------------------------------------
-- **`security definer` BYPASSES ROW-LEVEL SECURITY AND THE COLUMN GRANT BOTH**, which is the point
-- and is why the first line of the body is the one review question to ask of this file. It is also
-- why the `where` clause below has to carry every condition `member_update_admin` and the column
-- grant were carrying for the own-team path — nothing else is left to carry them.
--
-- **THE TRIGGER STILL FIRES, AND IT IS THE SECOND LOCK.** TEA-04's
-- `member_enforce_role_and_removal` is a BEFORE UPDATE trigger on the table, so it runs for this
-- statement exactly as for any other, and it reads `auth.uid()` — which resolves to the REAL
-- caller inside a definer function, because it reads a per-request GUC and not the current role.
-- Its *an admin may not be demoted* and *a removed member may not be promoted* clauses therefore
-- hold here without being restated. They ARE restated in the `where` anyway, for one reason: a
-- trigger raise aborts the statement with a message, while a `where` that matches nothing is the
-- ordinary refusal this product returns everywhere else. Belt first, braces behind it.
--
-- **THE FOUR CONDITIONS, EACH WITH ITS REASON:**
--   `team_id is not null`  a pending sign-up has no team; admitting one is `admit_member`'s job and
--                          it sets the rank that person starts with.
--   `status = 'approved'`  `public.is_admin` and `public.may_decide` both filter on it, so a rank
--                          set on an undecided sign-up would answer false everywhere it is read.
--   `removed_at is null`   TEA-04's trigger clause, verbatim in intent: a promoted removed member
--                          holds a role that answers false everywhere — a row that says `manager`
--                          and behaves as nobody.
--   `role <> 'admin'`      *Demote an admin to member* is NOT DECIDED in
--                          `.ai/standards/rbac-and-security.md` and is denied until it is. ADR-044
--                          does not decide it either; it was not asked.
--
-- **`p_role` IS THE ENUM AND NOT `text`.** A value outside the three ranks is refused as `22P02` by
-- PostgREST's own cast, before this body runs and before `is_admin` is consulted, so no string a
-- client invents can reach the `update`.
--
-- **AN ADMIN CANNOT REACH THEIR OWN ROW THROUGH THIS**, and no `p_member_id <> auth.uid()` clause
-- says so: their row is `admin`, which the fourth condition already excludes. A clause that repeated
-- it would imply there is some other row of their own to protect.
--
-- **IT SUBSUMES THE OLD `promoteMember` PATH.** Promotion to admin is `p_role => 'admin'`; it is the
-- same statement against the same trigger, which is what `src/lib/data/index.ts` has said about the
-- pair since ADR-035. One function, so there is one place where the conditions above are written.
create or replace function public.set_member_role(p_member_id uuid, p_role public.member_role)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.member;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can change a rank' using errcode = '42501';
  end if;

  update public.member m
     set role = p_role
   where m.id = p_member_id
     and m.team_id is not null
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'admin'::public.member_role
  returning m.* into v_row;

  -- The row does not exist, is a pending sign-up, has left, or is an admin. ONE ANSWER ON PURPOSE,
  -- the shape `delete_team` and `move_member` already use: a caller who is refused learns that they
  -- were refused and nothing about the row.
  if not found then
    raise exception 'that rank could not be changed' using errcode = '42501';
  end if;

  return v_row;
end;
$$;

-- THE REVOKE IS NOT COSMETIC. PostgreSQL grants `execute` on a new function to `public` by default,
-- so without this line the function is callable by `anon` — the key that ships in the browser bundle
-- by design. `anon` is refused by the admin test anyway; this makes it refused twice. ADM-06
-- recorded the same trap on `reject_entries`, and 20260911180000 on all seven of its functions.
revoke all on function public.set_member_role(uuid, public.member_role) from public;
grant execute on function public.set_member_role(uuid, public.member_role) to authenticated;

commit;
