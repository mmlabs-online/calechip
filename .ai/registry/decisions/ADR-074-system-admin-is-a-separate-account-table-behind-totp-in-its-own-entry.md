---
doc_version: 3
last_updated: 2026-11-04
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-074 — `system_admin` is a separate account table, every system-scope read requires `aal2`, and the panel is its own build entry

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-04 — at `/plan` for MIR-18 (ADR-008, ADR-067).

This ADR supersedes and reverses no accepted ADR. It supplies the account-store, second-factor and
panel-shape design that [ADR-059](ADR-059-calechip-becomes-multi-tenant-system-org-team.md)
decision 1 (*"One `system_admin` panel at an unguessable path"*) and
[ADR-070](ADR-070-the-org-and-multi-team-membership-schema.md) decision 1 (*"`system_admin` lives in
its own account store (MIR-18)"*) left to MIR-18. It stays inside
[ADR-005](ADR-005-authorization-in-rls.md): Supabase Auth authenticates, row-level security and
database functions authorize, and no server-side API is written.

## Context

- **Feature MIR-18** (`.ai/registry/features.md:307`): *A separate system admin panel, unindexed,
  with its own account store, 2FA and org management.* Plan item P4-3
  (`.ai/board/plans/calechip-multi-tenancy-plan.md:246-251`): a separate route not indexed by
  `X-Robots-Tag` (never `robots.txt`), a separate account store with 2FA required, an IP allow-list
  if feasible, rate limiting and failed-login logging, and org CRUD, caps, licence state and
  move-team-between-orgs.
- **P4-1** (plan:231): *"`system_admin` as a separate account type, not a value on `member.role`"*.
- **Every confirmed `auth.users` row gets a `public.member` row** — `admit_allow_listed_member()`
  (`supabase/migrations/20260913090000_solo_avatar_images.sql:46-80`) inserts one, `pending` and
  team-less, on email confirmation. An identity created for a system admin therefore lands in the
  sign-up queue of Org public unless something stops it.
- **The browser holds the session.** `src/lib/data/supabase.ts:956` builds the one client with
  default options, so its session lives under supabase-js's default storage key. A second client on
  the same origin with the same key would share — and on sign-out, destroy — the member app's session.
- **`public.org` is closed to `authenticated`** (`20261027120000_mir11_composite_foreign_keys.sql:97-98`),
  asserted by `supabase/tests/120-composite-fks.test.sql:64-66` and
  `supabase/tests/130-backfill-org-public.test.sql:74-76`.

## Decision

1. **The account store is `public.system_admin`**, one row per system admin, keyed on
   `auth.users (id)`, with no `org_id`. Identity stays in Supabase Auth (ADR-005); the store is the
   list of which identities are system admins.
2. **An identity is a system admin or holds a `public.member` row, never both.** Enforced in the
   database in both directions: inserting a `system_admin` row for an identity with a member row is
   refused, and inserting a member row for a system admin is refused. The second makes
   `admit_allow_listed_member()` log a warning and create nothing, as it already does on any failure.
3. **A system admin is made by a person, never by the product.** `public.grant_system_admin(uuid)`
   is executable by `service_role` only. It removes a `pending`, team-less member row with no
   `membership` (the row the confirmation trigger creates) and refuses any other. There is no sign-up
   path, no invitation and no screen that creates one. Removing one is a `delete` by a person.
4. **Two factors, checked by the database.** Every system-scope read or write is gated on
   `public.is_system_admin()`, which is true only when the caller has a `system_admin` row **and**
   the session's JWT carries `aal = 'aal2'`. The second factor is Supabase Auth TOTP. An identity
   that signs in at `aal1` with no verified factor is enrolled on first sign-in. A check in the panel
   is an affordance; this function is the control.
5. **A caller may read their own `system_admin` row at any assurance level**, and no other. That is
   what lets the panel say *"this account has no access"* before asking a non-admin for a code, and
   it reveals nothing about anybody else.
6. **The panel is its own build entry** — `system.html` and an entry module of its own under
   `src/` (paths in `.ai/board/tickets/MIR-18/01-plan.md` § 7) — and never imports the member app or
   the member seam. Its seam is one module of its own inside the seam directory `src/lib/data/`, with
   its own Supabase client under its own `storageKey`, so a panel
   session and a member session in one browser never share tokens, and leaving the panel signs out
   with `scope: 'local'` so it never ends a member's other sessions.
7. **Unindexed by response header.** The panel is served with `X-Robots-Tag: noindex, nofollow`, and
   its path is never written to `robots.txt` (P4-3). The panel's HTML also carries
   `<meta name="robots" content="noindex, nofollow">`.
8. **Delivery is split** (`.ai/01-operating-model.md` § Sizing). **MIR-18** ships decisions 1–6 and
   the meta tag of 7: the store, the second factor, and a panel that signs a system admin in and
   out. **MIR-18-b** ships the rest of the feature row: org list and management (create, edit caps
   and licence state, the national-holiday seed of ADR-070 § 4), the response header and the
   unguessable path, rate limiting, failed-login logging and the IP allow-list question. Its PLAN is
   expected to split it again. **Move-team-between-orgs is MIR-15's** — its feature row
   (`.ai/registry/features.md:304`) names it, and `.ai/board/plans/multi-tenancy-status.md:11-13`
   records that MIR-15 builds it in this panel.

## Options considered

- **A value on `member.role`.** Rejected by P4-1 in words, and a system admin would carry an
  `org_id` (ADR-070 § 4: `member.org_id not null`), so they would belong to one tenant.
- **A separate Supabase project, or a password table of our own, for system admins.** Rejected.
  Either one needs code outside Supabase Auth to authenticate and to bridge sessions, which is the
  server-side API ADR-005 rules out, and a password table of our own re-implements hashing, lockout
  and second factors that Supabase Auth already provides.
- **A flag in `auth.users.raw_app_meta_data`.** Rejected. It is settable only through the Admin API,
  it is not a row a foreign key or a trigger can see, and decision 2's disjointness could not be
  enforced against it.
- **Check the second factor in the panel only.** Rejected under ADR-005: the browser holds the
  token, so a password-only (`aal1`) session could call any system RPC directly.
- **A lazy route inside the member SPA, at a `system` path.** Rejected. The path would be a string in the
  member bundle every visitor downloads, so it could never be unguessable, and the panel would share
  the member client's session.

## Consequences

- `public.is_system_admin()` takes no `uid`. MIR-16's *"`is_system_admin(uid)`"* (plan:233) cannot
  check another identity's assurance level; MIR-16 uses this function as written.
- MIR-16 re-points the four system-scope groups — sign-up queue, holidays, issue reports, event
  override (plan:235) — onto `is_system_admin()`. MIR-18 touches none of them.
- Until MIR-18-b ships, the panel is served as a static file at `/system.html` with only the meta
  tag; nobody can use it until a person runs `grant_system_admin` against the hosted project
  (RULE-09).
- Enabling TOTP on the hosted project is a dashboard setting, made by a person.
- A system admin who signs in to the member app has no member row and lands on the member-less
  screen (`src/hooks/useSession.ts:89-93`, audit A:949). Unchanged here; MIR-17 adds router guards.

## Revert condition

The operator decides system admins are ordinary accounts with a role, or that the second factor is
optional. That decision supersedes decisions 1–4, and MIR-16's role split is redesigned with it.
