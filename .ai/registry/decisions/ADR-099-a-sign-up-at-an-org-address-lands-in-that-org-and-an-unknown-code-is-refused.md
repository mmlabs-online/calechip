---
doc_version: 3
last_updated: 2026-11-12
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-099 — A sign-up at an org address lands in that org, and an unknown code is refused

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-12 — at `/plan MIR-19-f` (ADR-008, ADR-067).

This ADR carries out ADR-097 decision 5.6 (*"A sign-up at `/{org_code}/signup` lands in that org …
This needs a schema change and its own ADR"*) and ADR-071 decision 1 (*"routing a sign-up to a
dedicated org is MIR-19's `/{org_code}`. When MIR-19 lands, its admission path supplies `org_id` and
the fallback stops being reached for members"*). **It narrows two accepted decisions**, which is why
it was taken under ADR-067 rather than ADR-008 alone: ADR-097 decision 1's crossing *out* of an org
no longer applies to `/signup` (decision 3 below), and ADR-071's revert condition is carried out for
sign-ups but not for owner-side inserts (decision 4 below).

## Context

Read on 2026-11-12 at `origin/main` `20ad219` (MIR-19-e shipped).

- **Every sign-up lands in Org public today.** `public.admit_allow_listed_member()`, last defined in
  `20261106130000_mir21c_membership_self_lock.sql:74-108`, inserts `(id, display_name, avatar, role)`
  and names no `org_id`. `public.stamp_org_id()`'s `member` arm
  (`20261107180000_mir21f_drop_member_team_id.sql:201-204`) then fills the shared tenant.
- **The trigger is `after insert or update of email_confirmed_at on auth.users`**
  (`20260831150024_tea01_membership.sql:134-135`). It fires on the sign-up's insert whatever the
  Confirm email setting, and creates the member row at confirmation. Its body is wrapped in
  `exception when others`, so nothing it does today can fail a sign-up.
- **The address reaches the database only as user metadata.** The seam's `signUp` sends
  `options.data`, which becomes `auth.users.raw_user_meta_data`
  (`src/lib/data/supabase.ts:1662-1667`). The trigger already reads `display_name` and `avatar`
  from it. It never reads `role` from it (TEA-01 AC-9).
- **`/{org}/signup` crosses out to `/signup`** (`src/App.tsx:830`, ADR-097 decision 1; asserted by
  `tests/e2e/mir-19-org-routing.spec.ts` AC-9).
- **The sign-up queue is already bounded by `member.org_id`.** `member_select_pending_admin` and
  `admit_member` / `reject_member` admit only a row whose `org_id` is the org admin's own
  (`20261107230000_mir16b_is_org_admin.sql:776-783`, `:56-70`, `:551-560`). A pending row stamped with Org F
  is therefore decided by Org F's org admin and by nobody else, with no policy change.
- **The client cannot tell whether an org exists.** `public.org` is closed to `anon` and
  `authenticated` (ADR-070), and MIR-19's not-found card deliberately does not say whether the typed
  org exists (`.ai/board/tickets/MIR-19/01-plan.md` § 2b).
- **`org_code` is immutable and no org is ever deleted** (`org_code_immutable`,
  `20261027120000_mir11_composite_foreign_keys.sql:83`; ADR-075 decision 2, *"No delete, no
  suspend"*). A code that resolves at sign-up still resolves at confirmation.
- **Recorded decisions that bound this one.** ADR-059 § *Out of scope* item 5: no self-serve org
  signup, so a sign-up never creates an org. Items 3 and 4: over-cap behaviour and member counting
  are deferred, and MIR-18-b decision 6 and MIR-15-c decision 2 already let no cap refuse anything.
  The plan's org-level *"Email domain allow-list"* (`.ai/board/plans/calechip-multi-tenancy-plan.md:45`)
  is a config column nobody has built or decided.
- **About twenty owner-side inserts rely on the `member` stamp arm**: `supabase/seed.sql` (seven
  statements) and the pgTAP fixtures (`supabase/tests/*.test.sql`, `_isolation.psql`) insert member
  rows without `org_id`.

## Decision

1. **The sign-up carries the org code of its address.** At `/{org_code}/signup` the screen sends
   that code as `raw_user_meta_data.org_code`. At `/signup` it sends no `org_code` key at all, so a
   root sign-up's metadata is byte-for-byte what it is today.
2. **The admission trigger supplies `org_id` on every row it creates.** No `org_code` (absent, or
   blank after trimming) is Org public, found by `is_shared_tenant`. Otherwise it is the org whose
   `org_code` equals the value exactly. **Every org that exists accepts sign-ups at its address**,
   Org public included (`/shared/signup` is the same as `/signup`). No cap, plan or licence field is
   read: those behaviours are deferred (ADR-059 items 2 to 4), and a pending row is not a member of
   anything.
3. **A code that names no org refuses the sign-up.** On the `INSERT` into `auth.users`, before the
   `exception when others` block, the trigger raises `sign_up_org_unknown` (`P0002`), so the auth
   user is never created and no email is sent. A reserved word is a code no org can hold
   (`org_code_not_reserved`), so it is refused the same way. The screen at `/{org_code}/signup` is
   shown for any org-shaped first segment, because the client cannot know; the refusal is the
   database's. **`/{org_code}/signup` no longer crosses out to the root**: it serves the sign-up
   screen under that org. `/{org_code}/signin` and `/{org_code}/guest/…` keep crossing out
   (ADR-097 decisions 1 and 6, unchanged).
4. **`stamp_org_id()`'s `member` arm stays, for owner-side inserts only.** After this ADR no
   sign-up reaches it: decision 2 always names `org_id`. Removing it, as ADR-071's revert condition
   says, would make `seed.sql` and about twenty pgTAP fixtures name `org_id` on every member insert,
   for no change in what a sign-up does. Its comment is not edited by this ticket; the next
   migration that re-creates `stamp_org_id()` corrects it.
5. **On confirmation, a code that no longer resolves creates nothing and logs a warning**, the
   shape every other admission failure already takes. It cannot happen while decision 3's
   facts hold (immutable codes, no delete). It is written so that it never falls through to the
   stamp's shared-tenant fallback, which would put the person in the wrong org silently.

## Options considered

- **An unknown code lands in Org public.** No existence signal, and the sign-up always succeeds.
  Rejected: a typo puts a stranger in another tenant's queue, where an Org public admin may admit
  them to a team they never asked for. A misplaced person is a tenancy error. A refused form can be
  corrected.
- **An unknown code creates the auth user and no member row** (ADR-074 decision 2's shape for a
  system admin). No existence signal at sign-up. Rejected: the person confirms, signs in to the
  member-less screen forever, and cannot sign up again because the address is taken.
- **An `anon`-callable function `org_accepts_sign_up(text)`, asked before the form is shown.** A
  clearer screen. Rejected: an unthrottled oracle for which org codes exist, and a second
  `security definer` surface for `anon`. Decision 3's refusal tells the same fact only through a
  sign-up attempt, which GoTrue rate-limits (TODO(verify): the hosted project's sign-up rate limit).
- **Remove the `member` stamp arm now, as ADR-071's revert condition reads.** Rejected under
  decision 4: about twenty fixture and seed edits for no behaviour change.
- **Send the org id rather than the code.** Rejected: the client never holds an org id (`public.org`
  is closed to it), and the code is what the address carries.
- **Read the org from the `Referer` or a redirect URL in the trigger.** Rejected: GoTrue does not
  pass the page address to the database, and metadata is the channel `display_name` and `avatar`
  already use.

## Consequences

- An org admin's sign-up queue (`/signups`) now holds the people who signed up at their org's
  address, and only them. Org public's queue holds sign-ups made at `/signup` and at `/shared/signup`.
- **Anybody can put themselves in any org's queue by calling GoTrue with a chosen `org_code`.** This
  is the same capability as opening that org's address, and a pending row grants nothing
  (`member_team_ids`, `member_org_id` and `is_org_admin` all require `approved`). The org admin
  decides, as for every sign-up since ADR-033.
- **The sign-up form at an unknown code fails with the generic message** (*"Something went wrong.
  Please try again."*). GoTrue does not pass the trigger's message to the client, and the seam does
  not guess which failure it was. The refusal is still a signal that a code is unused, for anyone
  who attempts a sign-up there.
- An address that already has an account gets GoTrue's obfuscated success under Confirm email ON,
  with no insert and so no check. Nothing is created, as today.
- The mock seam's sign-up queue becomes org-bounded, matching `member_select_pending_admin`. It was
  looser than SQL until now.

## Revert condition

An org needs to stop accepting sign-ups at its address (a suspended org, a domain allow-list, a
closed org). Decision 2's *every org accepts* then becomes a column on `public.org`, read by the
trigger, under its own ADR.
