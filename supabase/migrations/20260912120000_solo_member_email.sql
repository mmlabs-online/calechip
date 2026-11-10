-- SOLO, 2026-09-12. The member list shows each person's email address.
--
-- Operator's instruction: the `/members` screen shows *avatar, tên, role, team, email, last
-- sign-in, action* for every member in the system. Six of the seven were already there. This file
-- is the seventh.
--
-- **THE SAME PROBLEM `20260910140000_solo_member_last_sign_in.sql` SOLVED, SOLVED THE SAME WAY.**
-- GoTrue owns `auth.users.email`; `auth` is not exposed through PostgREST and the browser holds only
-- the anon key, so nothing under `src/` can select it. That file recorded the two available shapes —
-- a security-definer view over `auth.users`, or a copy on `public.member` — and the operator chose
-- the copy. This follows it rather than introducing a second pattern for the same problem on the
-- same table.
--
-- ⚠️ **READ THIS BEFORE APPLYING: IT MAKES EVERY TEAMMATE'S ADDRESS READABLE BY EVERY TEAMMATE, NOT
-- ONLY BY AN ADMIN.** `member_select_team` is what decides who may read a member row and it admits
-- the whole team to BOTH roles, so a column on that table inherits exactly that audience. The
-- request was about an admin screen; the consequence is wider than the request, and it is stated
-- here rather than discovered later.
--
-- **IT CANNOT BE NARROWED WITH A COLUMN GRANT**, which is why the alternative is a function and not
-- a smaller version of this file: `member`, `manager` and `admin` are all the SAME PostgreSQL role,
-- `authenticated` — `20260912100000_solo_manager_role.sql` records the same constraint for the same
-- reason — so `revoke select (email) ... from authenticated` would take it from the admin too.
--
-- **THE NARROWER SHAPE, IF THE OPERATOR WANTS IT**, is a `security definer` function returning
-- `(id, email)` guarded by `public.is_admin(auth.uid())`, plus a seam read and a join on the screen.
-- It is more machinery and a second pattern on this table; it is the correct answer if a teammate's
-- address is not something teammates may see. That is a decision about people, not about SQL, so it
-- is the operator's and not this file's.
--
-- **IT IS DISPLAY DATA. NOTHING READS IT TO DECIDE ANYTHING** — no policy, no trigger and no count
-- consults this column, exactly as none consults `last_sign_in_at`. Sign-in still resolves the
-- caller through `auth.users`; this copy is never an identity.
--
-- Applied by a human (RULE-09, ADR-024), and idempotent so a half-finished run can be re-run.

begin;

-- ---------------------------------------------------------------------------------------------
-- 1. The column.
-- ---------------------------------------------------------------------------------------------
-- **NULLABLE, AND `text` RATHER THAN `citext`.** Nullable because a row can exist for an instant
-- before the sync below has run, and because nothing may fail on account of a display field. `text`
-- because this column is never compared, joined or looked up — `auth.users.email` is the identity
-- and the only thing that is ever matched on. A `citext` here would advertise a lookup that must not
-- happen, and would add an extension dependency to a column that is read and rendered and nothing
-- else.
--
-- NO UNIQUE CONSTRAINT, for the same reason: uniqueness is GoTrue's, enforced where the address is
-- authoritative. A second unique index here could only ever disagree with that one.
alter table public.member
  add column if not exists email text;

-- The backfill. Without it every existing member reads as having no address until their next write,
-- which is a screen full of blanks on the day this ships.
update public.member m
   set email = u.email
  from auth.users u
 where u.id = m.id
   and m.email is distinct from u.email;

-- ---------------------------------------------------------------------------------------------
-- 2. Keeping it true.
-- ---------------------------------------------------------------------------------------------
-- **`after insert or update on auth.users`, UNQUALIFIED, AND THE ABSENCE OF `of email` IS THE POINT.**
-- `sync_member_last_sign_in` narrows itself to one column because the row it updates already exists
-- by then. This one cannot: on sign-up the `auth.users` INSERT carries the address, but with
-- `Confirm email` ON there is NO member row yet — `admit_allow_listed_member` creates it later, on
-- the UPDATE of `email_confirmed_at`, which is an update that does not touch `email`. Narrowed to
-- `of email`, this trigger would miss that moment entirely and every confirmed sign-up would carry a
-- null address forever.
--
-- **IT RELIES ON TRIGGER NAME ORDER AND SAYS SO.** PostgreSQL fires same-event triggers in
-- alphabetical order, so `admit_allow_listed_member` runs before `sync_member_email` and the row
-- this one updates exists by the time it looks. If that admission trigger is ever renamed to sort
-- after `s`, a new member's address arrives one write late. Checked rather than assumed: `a` < `s`.
--
-- `security definer` because the row it writes is in `public` and the caller is whoever just signed
-- up — under their own rights the update would be filtered by `member_update_admin`, which they do
-- not satisfy. It writes ONE column of ONE row, keyed on the auth user's own id, so there is no
-- input to it that a caller controls.
create or replace function public.sync_member_email() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  update public.member
     set email = new.email
   where id = new.id
     and email is distinct from new.email;
  return new;
exception when others then
  -- A trigger on auth.users that raises makes the SIGN-UP or the SIGN-IN fail. A display column is
  -- never worth that, so the failure is swallowed and made findable — TEA-01's reasoning on this
  -- table, and `sync_member_last_sign_in`'s.
  raise warning 'sync_member_email failed for auth user %: %', new.id, sqlerrm;
  return new;
end;
$$;

drop trigger if exists sync_member_email on auth.users;
create trigger sync_member_email
  after insert or update on auth.users
  for each row execute function public.sync_member_email();

commit;
