---
ticket: MIR-18
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-04T07:01:10Z
inputs_read:
  - .ai/board/tickets/MIR-18/ticket.yaml
  - .ai/board/tickets/MIR-15/ticket.yaml
  - .ai/board/tickets/MIR-10/01-plan.md
  - .ai/board/tickets/MIR-14-b/01-plan.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/plans/multi-tenancy-status.md
  - .ai/registry/features.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/standards/tech-stack.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - supabase/config.toml
  - supabase/migrations/20260913090000_solo_avatar_images.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/tests/_isolation.psql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/120-composite-fks.test.sql
  - supabase/tests/130-backfill-org-public.test.sql
  - docker/nginx.conf
  - Dockerfile
  - vite.config.ts
  - index.html
  - eslint.config.js
  - playwright.config.ts
  - src/App.tsx
  - src/main.tsx
  - src/hooks/useSession.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/index.css
  - node_modules/@supabase/auth-js 2.112.4 dist/module/lib/types.d.ts (mfa, signOut scope)
  - node_modules/vite 8.2.2 dist/node/index.d.ts (build.rolldownOptions)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-18 — the system panel's door: a separate account table, a second factor the database checks, and a panel of its own

## 1. Problem and scope

**Feature — MIR-18** (`.ai/registry/features.md:307`), transcribed:

> A separate system admin panel, unindexed, with its own account store, 2FA and org management

Plan item P4-3 (`.ai/board/plans/calechip-multi-tenancy-plan.md:246-251`), moved into phase 3 by the
operator on 2026-10-12 (`.ai/board/plans/multi-tenancy-status.md:11-13`):

> - Separate route, not indexed: `X-Robots-Tag: noindex` header, **not** `robots.txt` — listing it there publishes the path
> - Separate account store, 2FA required
> - IP allow-list if feasible
> - Rate limiting and failed-login logging
> - Org CRUD, caps, licence state, move-team-between-orgs

**The row is larger than one ticket, and this is the first of two.** Enumerated, the whole feature is
well over twelve paths — L, which splits at PLAN (`.ai/01-operating-model.md` § Sizing). Split by
operation, then surface (ADR-074 decision 8):

- **MIR-18 (this ticket) — the door.** Who is a system admin, how they prove it with a second
  factor, and a panel that signs them in and out. Nothing behind the door yet.
- **MIR-18-b — what is behind it, and how the door is hidden.** The org list and org management;
  the `X-Robots-Tag` header and the unguessable path; rate limiting, failed-login logging and the IP
  allow-list. Written as `.ai/board/tickets/MIR-18-b/ticket.yaml` by this ticket. Its own PLAN is
  expected to split it again.

**Who gains what.** Today no identity can be a system admin: the role exists only in ADR-059. After
this ticket, a person with database access can make one identity a system admin
(`grant_system_admin`). That admin opens the panel, signs in with a password, sets up an
authenticator app on first sign-in, enters a six-digit code, and is signed in. The database grants
system rights only to a session that has passed that second step. A member who types their own
credentials into the panel is told the account has no access, and is never asked for a code.

**Out of scope:**

- **Org list, org create and edit, caps, licence state, the national-holiday seed on org creation**
  (ADR-070 § 4) — MIR-18-b.
- **The `X-Robots-Tag` response header and the unguessable path** — MIR-18-b, with
  `docker/nginx.conf`. Until then the panel is the static file `/system.html`, carrying a
  `noindex, nofollow` meta tag (AC-8). Nobody can use it until a person runs `grant_system_admin`
  against the hosted project (RULE-09).
- **Rate limiting, failed-login logging, the IP allow-list** — MIR-18-b. Password sign-in keeps
  Supabase Auth's own sign-in rate limit, unchanged (`supabase/config.toml` `[auth.rate_limit]`).
- **Move-team-between-orgs** — MIR-15. Its feature row names it (`features.md:304`), and
  `multi-tenancy-status.md:11-13` records that MIR-15 builds it in this panel.
- **Re-pointing the sign-up queue, holidays, issue reports and event override to the system admin**
  — MIR-16 (plan:235). No existing policy or function changes here.
- **A screen or function that creates, lists or removes system admins.** Creating one is
  `grant_system_admin`, run by a person. Removing one is a `delete` by a person (ADR-074 decision 3).
- **Recovery when a system admin loses their authenticator** — a person removes the factor in the
  Supabase dashboard. No in-panel recovery.
- **A system admin who signs in to the member app** — lands on the member-less screen, as today
  (`src/hooks/useSession.ts:89-93`, audit A:949). MIR-17 adds router guards.
- **Impersonation** — MIR-20.

`size_estimate: M`.

## 2. Acceptance criteria

**pgTAP fixtures** come from `supabase/tests/_isolation.psql` (`tests.seed()`): `admin_t`,
`member_t` and the rest are approved members. The test adds:

- **`sys_a`** — an `auth.users` row inserted with `email_confirmed_at` null, so no member row is
  created, then made a system admin with `grant_system_admin`.
- **`sys_b`** — a second one, made the same way.
- **`pending_p`** — an `auth.users` row inserted with `email_confirmed_at` set, so
  `admit_allow_listed_member()` creates a `pending`, team-less member row for it.

**"At `aal2`"** means the JWT claims are `{"sub": <id>, "role": "authenticated", "aal": "aal2"}`.
**"At `aal1`"** means the same with `"aal": "aal1"`. `tests.authenticate_as` sets neither, and a
session without `aal` is treated as not `aal2`.

**AC-1 — the account table exists, closed except for reading one's own row**
- `public.system_admin` exists with columns `id uuid` (primary key, references `auth.users (id)`)
  and `created_at timestamptz not null`
- Row-level security is enabled on it
- `anon` holds no privilege on it; `authenticated` holds `SELECT` and no other privilege

**AC-2 — a caller reads their own row and nobody else's, at any assurance level**
- When `sys_a` at `aal1` selects from `public.system_admin`, exactly one row comes back, `sys_a`'s
- And when `sys_a` at `aal2` selects, still exactly one row, `sys_a`'s — not `sys_b`'s
- And when `admin_t` at `aal2` selects, no row comes back

**AC-3 — `is_system_admin()` needs the row and the second factor**
- `sys_a` at `aal2` → `public.is_system_admin()` returns `true`
- `sys_a` at `aal1` → `false`
- `sys_a` with no `aal` claim → `false`
- `admin_t` at `aal2` → `false`
- `anon` has no `EXECUTE` on `public.is_system_admin()`

**AC-4 — a system admin cannot hold a member row**
- When a `public.member` row is inserted with `id = sys_a`, it is refused with SQLSTATE `42501`
- And when the email of a `sys_a`-like identity (a system admin whose `email_confirmed_at` was null)
  is confirmed, `admit_allow_listed_member()` creates no member row and the update of `auth.users`
  succeeds

**AC-5 — granting removes only the row the confirmation created**
- When `grant_system_admin(pending_p)` runs as `postgres`, `pending_p`'s member row is gone and a
  `system_admin` row for `pending_p` exists
- When `grant_system_admin(member_t)` runs (an approved member on a team), it is refused with
  SQLSTATE `42501`, `member_t`'s member row is unchanged, and no `system_admin` row exists for it
- When `grant_system_admin(sys_a)` runs a second time, it succeeds and `sys_a` still has exactly one
  row
- When it runs for a uuid with no `auth.users` row, it is refused and no row is written

**AC-6 — only a person makes a system admin**
- `anon` and `authenticated` have no `EXECUTE` on `public.grant_system_admin(uuid)`
- `service_role` has `EXECUTE` on it
- `sys_a` at `aal2` cannot `INSERT`, `UPDATE` or `DELETE` on `public.system_admin`

**Panel fixtures (mock seam, `/system.html`, built with `VITE_DATA_SEAM=mock`).** Every account has
the password `calechip-demo`; the one valid code is `246810`.

| Email | What it is |
|---|---|
| `root@calechip.test` | a system admin with no authenticator set up |
| `ops@calechip.test` | a system admin with an authenticator already set up |
| `member@calechip.test` | an identity with no system-admin row |

**AC-7 — the panel opens on its sign-in form**
- When `/system.html` is opened with no panel session
- Then `system-panel-root` holds `system-signin-form`, with `system-signin-email`,
  `system-signin-password` and `system-signin-submit`

**AC-8 — the panel asks not to be indexed**
- The document served at `/system.html` has a `meta[name="robots"]` whose `content` contains
  `noindex` and `nofollow`

**AC-9 — a wrong password is refused on the form**
- When `root@calechip.test` signs in with any other password
- Then `system-signin-error` is shown, the form stays, and no code field is shown

**AC-10 — an identity with no system-admin row is turned away before any code**
- When `member@calechip.test` signs in with the right password
- Then `system-not-authorised` is shown, and neither `system-enrol` nor `system-code-input` is
  shown
- And `system-not-authorised-back` returns to `system-signin-form`

**AC-11 — first sign-in sets up the authenticator**
- When `root@calechip.test` signs in with the right password
- Then `system-enrol` is shown, holding `system-enrol-qr` (an `img` with a non-empty `src`),
  `system-enrol-secret` (non-empty text), `system-code-input` and `system-code-submit`
- And when a code other than `246810` is submitted, `system-code-error` is shown and `system-enrol`
  stays
- And when `246810` is submitted, `system-signed-in` is shown and `system-signed-in-email` reads
  `root@calechip.test`

**AC-12 — later sign-ins ask only for the code**
- When `ops@calechip.test` signs in with the right password
- Then `system-verify` is shown with `system-code-input` and `system-code-submit`, and
  `system-enrol-qr` is not shown
- And when `246810` is submitted, `system-signed-in` is shown naming `ops@calechip.test`

**AC-13 — signing out returns to the form**
- Given `system-signed-in` is shown
- When `system-signout` is pressed
- Then `system-signin-form` is shown
- And from `system-verify`, `system-signout` does the same

**AC-14 — the member app does not carry the panel**
- When `/` is loaded, no script it loads contains the text `system-signin-form`

**AC-15 — verified against a real Supabase stack, recorded in `verification.md`**
(`verification_required: true`; a passing mock test is not verification)
- With TOTP enabled (`supabase/config.toml`), an identity made a system admin with
  `grant_system_admin` signs in at `/system.html`, scans the QR with a real authenticator app, enters
  its code, and reaches `system-signed-in` — and `is_system_admin()` returned `true` for that session
- A member signed in to the member app in the same browser, who then signs in to the panel with their
  own credentials and is turned away (AC-10), is still signed in to the member app after a reload
- Signing out of the panel leaves a member-app session in the same browser signed in

**Invariants touched:** `[]`. No entry, count, team or membership rule is read or changed. The
disjointness of AC-4 is ADR-074 decision 2, not a registry invariant.

**Open questions:**

1. **The Vietnamese word for *System admin*.** Neither ADR-059 nor the plan records one, so the
   glossary row uses the English term with a `TODO(verify)`. Not blocking: code uses the English
   identifier.
2. **The IP allow-list** — its feasibility (plan: *"if feasible"*) and the list of allowed addresses,
   a fact only the operator holds. Carried by MIR-18-b; not blocking here.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

- **One centred card on `bg-bg`**, `bg-card rounded-card`, `max-w-sm`, `p-8`, the same frame as the
  member sign-in. Above the card, the text **`CaleChip · System`** in `text-ink-3 text-xs
  font-semibold uppercase tracking-wide` — a quiet label so nobody mistakes the panel for the member
  app. No mascot and no logo: this is not a screen a member ever sees, and charm belongs where
  members are (`CLAUDE.md` § Visual direction).
- **Sign-in** — title *Sign in to the system panel* (`text-ink text-xl font-bold`), then Email and
  Password as filled borderless fields (`bg-field rounded-pill`), then one full-width primary button
  *Sign in* (`bg-primary text-white rounded-pill`). The error line sits under the button in
  `text-danger text-sm`.
- **Not authorised** — title *No access*, body *This account has no access to the system panel.*,
  and a text button *Back to sign in*.
- **Set up** — title *Set up two-step sign-in*, body *Scan this code with an authenticator app, then
  enter the 6-digit code it shows.* The QR at 176×176 on white, centred; under it the secret in
  `font-mono text-xs text-ink-2 break-all` with the label *Or enter this key*. Then the code field
  and *Verify*.
- **Verify** — title *Enter your code*, body *Open your authenticator app and enter the 6-digit
  code.*, the code field, *Verify*, and a text button *Sign out* under it.
- **The code field** is one input, `inputMode="numeric"`, `autoComplete="one-time-code"`,
  `maxLength={6}`, centred `text-lg tracking-[0.4em]`.
- **Signed in** — title *System panel*, a line *Signed in as <email>*, and a mint pill *Two-step
  verified* (`bg-wfh text-wfh-ink rounded-pill`) — mint because it is a state that is fine, and the
  palette's only *fine* colour. Below, the empty state *Nothing to manage here yet.* in `text-ink-3`,
  and *Sign out* as a secondary button (`bg-field text-ink rounded-pill`). MIR-18-b replaces the
  empty state with the org list.
- **Loading** — the card shows *Loading…* in `text-ink-3`, `role="status"`, while the gate resolves.

## 3. Permission model

The database is the control. The panel is the affordance (ADR-005).

| Action | Who may | Who may not | Where it is checked |
|---|---|---|---|
| Read one's own `system_admin` row | any signed-in caller, at any assurance level — it answers only *"am I one"* (AC-2) | reading anybody else's row; `anon` (AC-1) | RLS policy `system_admin_select_self` on `public.system_admin` |
| Be treated as a system admin by the database | a caller with a `system_admin` row whose JWT has `aal = 'aal2'` (AC-3) | the same caller at `aal1` or with no `aal`; every member, manager and admin; `anon` | `public.is_system_admin()` — no consumer yet beyond the panel's own check; MIR-18-b's RPCs and MIR-16's re-pointed policies gate on it |
| Make an identity a system admin | `service_role` and `postgres` — a person (AC-5, AC-6) | `anon`, `authenticated`, a system admin from the panel (AC-6) | `EXECUTE` grant on `public.grant_system_admin(uuid)`; no privilege on the table |
| Hold a member row and a system-admin row at once | nobody (AC-4) | — | triggers on `public.system_admin` and `public.member` |

**Rows in `.ai/standards/rbac-and-security.md`.** The `## Roles` section gains a paragraph under the
three-rank table: *`system_admin` is not a rank on this table. It is a separate account in
`public.system_admin` (ADR-074), holds no member row, and the database treats it as one only at
`aal2` through `public.is_system_admin()`. Until MIR-16 it holds no right on any table in this
file.* The `## Authentication` section gains one line: *System admins sign in to the panel with a
password and a TOTP second factor (Supabase Auth MFA); the second factor is checked in the database by
`is_system_admin()`, not in the panel.* No existing row changes.

## 4. Contract

### 4.1 Migration `supabase/migrations/20261104150000_mir18_system_admin.sql`

One `begin; … commit;`, idempotent (ADR-024). The header cites ADR-074 decisions 1–5. Applying it to
a remote project is human-only (RULE-09).

```sql
create table if not exists public.system_admin (
  id         uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.system_admin enable row level security;
revoke all on table public.system_admin from public, anon, authenticated;
grant select on table public.system_admin to authenticated;

drop policy if exists system_admin_select_self on public.system_admin;
create policy system_admin_select_self on public.system_admin
  for select to authenticated
  using (id = (select auth.uid()));

-- ADR-074 decision 4. Invoker: it reads only the caller's own row, which the policy above allows.
create or replace function public.is_system_admin() returns boolean
  language sql stable security invoker set search_path = '' as $$
  select coalesce((select auth.jwt() ->> 'aal'), '') = 'aal2'
     and exists (select 1 from public.system_admin s where s.id = (select auth.uid()));
$$;
revoke all on function public.is_system_admin() from public, anon;
grant execute on function public.is_system_admin() to authenticated;

-- ADR-074 decision 2, both directions.
create or replace function public.system_admin_refuse_member() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.member m where m.id = new.id) then
    raise exception 'a member cannot be a system admin' using errcode = '42501';
  end if;
  return new;
end;
$$;
create or replace function public.member_refuse_system_admin() returns trigger
  language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.system_admin s where s.id = new.id) then
    raise exception 'a system admin cannot hold a member row' using errcode = '42501';
  end if;
  return new;
end;
$$;
-- drop trigger if exists / create trigger, BEFORE INSERT, FOR EACH ROW:
--   system_admin_refuse_member  on public.system_admin
--   member_refuse_system_admin  on public.member
-- revoke all on both trigger functions from public, anon, authenticated.

-- ADR-074 decision 3. Run by a person, as service_role or postgres.
create or replace function public.grant_system_admin(p_user_id uuid) returns void
  language plpgsql security invoker set search_path = '' as $$
begin
  if exists (select 1 from public.system_admin s where s.id = p_user_id) then
    return;
  end if;
  if exists (select 1 from public.member m where m.id = p_user_id) then
    if exists (
      select 1 from public.member m
       where m.id = p_user_id
         and m.status = 'pending'
         and m.team_id is null
         and not exists (select 1 from public.membership ms where ms.member_id = m.id)
    ) then
      delete from public.member m where m.id = p_user_id;
    else
      raise exception 'only a pending member with no team can become a system admin'
        using errcode = '42501';
    end if;
  end if;
  insert into public.system_admin (id) values (p_user_id);
end;
$$;
revoke all on function public.grant_system_admin(uuid) from public, anon, authenticated;
grant execute on function public.grant_system_admin(uuid) to service_role;
```

- **`grant_system_admin` on an unknown uuid** is refused by the foreign key to `auth.users`
  (SQLSTATE `23503`), which satisfies AC-5's last clause.
- **TODO(verify): the `delete from public.member`.** Read every trigger and foreign key on
  `public.member` before relying on it. A pending, team-less member is expected to reference nothing,
  but a `BEFORE DELETE` trigger, or a row in `notification` or `busy_day`, would refuse it. If one
  does, refuse in the same `42501` branch rather than widen the delete — AC-5 still holds for
  `pending_p`, which owns nothing.
- **TODO(verify): `service_role`'s privileges on `public.member` and `public.membership`.** The
  function is invoker. If `service_role` lacks `DELETE` on `public.member`, say so in
  `03-impl-log.md`; do not make the function `security definer` (it would enter the census in
  `010-catalogue.test.sql`, which is not in `allowed_paths`).
- **No function here is `security definer`**, so `supabase/tests/010-catalogue.test.sql` needs no
  edit. `public.org` keeps its grants; `120-composite-fks` and `130-backfill-org-public` are
  unaffected.

### 4.2 pgTAP `supabase/tests/190-system-admin.test.sql`

New. The header pattern of `180-entry-owners.test.sql`: `\ir _isolation.psql`, `tests.seed()`, an
explicit `plan(n)`, `rollback`. AC-1 to AC-6 each have at least one assertion labelled `AC-n`.

- **The `aal` claim** is set by a helper local to this file —
  `perform set_config('request.jwt.claims', json_build_object('sub', p_id, 'role', 'authenticated', 'aal', p_aal)::text, true); perform set_config('role', 'authenticated', true);`
  — `_isolation.psql` is not edited.
- **`sys_a`, `sys_b`, `pending_p`** are inserted into `auth.users` by the test as `postgres`, then
  granted as `postgres`. AC-6's `service_role` half is a `has_function_privilege` check.

### 4.3 Local auth configuration — `supabase/config.toml`

```toml
[auth.mfa.totp]
enroll_enabled = true
verify_enabled = true
```

Nothing else in the file changes. The hosted project's TOTP setting is made in its dashboard by a
person; `verification.md` records that it was.

### 4.4 The panel's seam — `src/lib/data/system.ts`

New, inside the seam directory, so the `supabase-client-in-seam` lint rule allows its client
(RULE-02). **It does not import `src/lib/data/index.ts`, `mock.ts` or `supabase.ts`**, and nothing in
the member app imports it (ADR-074 decision 6, AC-14). It is one module with two implementations,
chosen by the same test `index.ts:1666` uses.

```ts
import type { Result } from "@/lib/domain/types";

/** Where a panel visitor stands. Each state is one screen (§ 2b). */
export type SystemGate =
  | { state: "signed-out" }
  | { state: "not-system-admin" }
  | { state: "enrol"; email: string }      // aal1, no verified TOTP factor
  | { state: "verify"; email: string }     // aal1, a verified TOTP factor exists
  | { state: "signed-in"; email: string }; // aal2 and is_system_admin() returned true

export interface TotpEnrolment {
  factorId: string;
  /** An image URL — Supabase returns an SVG data URI. */
  qrCode: string;
  secret: string;
}

export interface SystemSeam {
  /** The gate for the current panel session. Never throws: a transport failure is `signed-out`. */
  gate(): Promise<SystemGate>;
  /** Password sign-in. A non-system-admin is signed out again (scope local) and gets `not-system-admin`. */
  signIn(email: string, password: string): Promise<Result<SystemGate>>;
  /** THROWS on failure. Removes any unverified TOTP factor first, then enrols a new one. */
  startEnrolment(): Promise<TotpEnrolment>;
  /** Challenge and verify. `factorId` from `startEnrolment`, or omitted to use the verified factor. */
  verifyCode(code: string, factorId?: string): Promise<Result<SystemGate>>;
  /** Signs out of the panel only — `scope: "local"`. */
  signOut(): Promise<void>;
}

export const systemSeamName: "mock" | "supabase";
export const systemSeam: SystemSeam;
```

**Supabase implementation:**

- **Its own client**: `createClient(url, anonKey, { auth: { storageKey: "calechip-system-auth" } })`,
  built lazily as `supabase.ts:954-958` does. Never the member client.
- **`gate()`**: `auth.getSession()` — none → `signed-out`. Then
  `from("system_admin").select("id").maybeSingle()` — no row → `auth.signOut({ scope: "local" })` and
  `not-system-admin`. Then `auth.mfa.getAuthenticatorAssuranceLevel()`: `currentLevel === "aal2"` →
  `rpc("is_system_admin")`, `true` → `signed-in`, otherwise `not-system-admin`; `nextLevel === "aal2"`
  → `verify`; otherwise → `enrol`.
- **`signIn`**: `auth.signInWithPassword`; an error → `{ ok: false }` with the message
  `Email or password is incorrect.`; success → `gate()`.
- **`startEnrolment`**: `auth.mfa.listFactors()`, `auth.mfa.unenroll` each TOTP factor whose status is
  `unverified`, then `auth.mfa.enroll({ factorType: "totp" })` → `{ factorId: data.id, qrCode:
  data.totp.qr_code, secret: data.totp.secret }`.
- **`verifyCode`**: the factor is `factorId` or the first verified TOTP factor from `listFactors`.
  `auth.mfa.challengeAndVerify({ factorId, code })`; an error → `{ ok: false }` with
  `That code did not match. Try again.`; success → `gate()`.
- **`signOut`**: `auth.signOut({ scope: "local" })` — `scope` verified in the installed
  `auth-js` 2.112.4 types (`types.d.ts:1593`).
- The `Failure` code for both refusals is whichever existing `FailureCode` in
  `src/lib/domain/types.ts:122` means a refused credential; if none fits, use the generic one and
  name it in `03-impl-log.md`. `types.ts` is not edited.

**Mock implementation:** in-memory, reset on reload, holding the three accounts of § 2's fixture
table. The valid code is `246810`. Enrolment returns a fixed `secret` and a small inline SVG data
URI. After a successful enrolment the account counts as having a verified factor for the rest of the
page's life. `signOut` clears the session only. The fixture emails and password are constants in
this module (English, no diacritics, so the § Language lint rule is satisfied).

### 4.5 The panel entry — `system.html` and `src/system/main.tsx`

**`system.html`** — at the repository root, beside `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="robots" content="noindex, nofollow" />
    <title>CaleChip system</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/system/main.tsx"></script>
  </body>
</html>
```

**`src/system/main.tsx`** — imports `react`, `react-dom/client`, `@/lib/data/system` and
`../index.css`, and nothing from `src/App.tsx`, `src/components/`, `src/routes/`, `src/hooks/` or
`@/lib/data`. No router: the screen is a function of `SystemGate` plus a local enrolment value. It
renders `data-testid="system-panel-root"` and, inside it, exactly one of the screens of § 2b with
these test ids:

| Screen | Ids |
|---|---|
| loading | `system-loading` |
| sign-in | `system-signin-form`, `system-signin-email`, `system-signin-password`, `system-signin-submit`, `system-signin-error` |
| not authorised | `system-not-authorised`, `system-not-authorised-back` |
| set up | `system-enrol`, `system-enrol-qr`, `system-enrol-secret`, `system-code-input`, `system-code-submit`, `system-code-error` |
| verify | `system-verify`, `system-code-input`, `system-code-submit`, `system-code-error`, `system-signout` |
| signed in | `system-signed-in`, `system-signed-in-email`, `system-signout` |

- On mount: `systemSeam.gate()`. When it returns `enrol`, call `startEnrolment()` and show the set-up
  screen; a throw there shows `system-code-error` with *Could not start set-up. Reload to try again.*
- `system-signin-error` and `system-code-error` render only when there is an error.
- In the mock build the page shows the same permanent `seam-banner` paragraph as `src/App.tsx`, with
  `data-seam="mock"`, written out again here — the panel does not import `App.tsx`.

### 4.6 Build — `vite.config.ts`

One addition to the existing `defineConfig` object, nothing else changed:

```ts
build: {
  rolldownOptions: {
    input: {
      main: fileURLToPath(new URL("./index.html", import.meta.url)),
      system: fileURLToPath(new URL("./system.html", import.meta.url)),
    },
  },
},
```

`rolldownOptions` is read from the installed Vite 8.2.2 types (`dist/node/index.d.ts:2202`), with
`rollupOptions` beside it as the older name. **TODO(verify):** that `pnpm exec vite build` emits
`dist/system.html` and that `dist/index.html` is unchanged in what it loads. `loading.html` is not an
input today and does not become one.

### 4.7 Tests

- **`supabase/tests/190-system-admin.test.sql`** — § 4.2. AC-1 to AC-6.
- **`tests/e2e/mir-18-system-panel.spec.ts`** — new, against the mock build `playwright.config.ts`
  already runs (`vite build && vite preview`, `VITE_DATA_SEAM: "mock"`). AC-7 to AC-14. AC-14 fetches
  `/`, collects every `script[src]` and `link[rel=modulepreload]` it loads, fetches each, and asserts
  none contains `system-signin-form`.
- **AC-15** is a manual check recorded in `.ai/board/tickets/MIR-18/verification.md`, as MIR-10's
  was.

## 5. Seam impact

**No function of the member seam changes, and none is added.** `src/lib/data/index.ts`, `mock.ts`
and `supabase.ts` are untouched, so `tests/seam-parity.test.ts` is unaffected.

**One new seam module, `src/lib/data/system.ts`**, for the panel alone (§ 4.4). It sits inside the
seam directory, so the Supabase client stays inside the one door RULE-02 names. It is a second module
rather than more functions on `DataSeam` for ADR-074 decision 6: the panel must not carry the member
seam, and the member app must not carry the panel. Its two implementations live in one file, which
the seam-parity test does not cover; AC-9 to AC-13 drive the mock, and AC-15 the Supabase half.

## 6. Schema delta

**Not `none`:** a new table `public.system_admin` with RLS, one policy and its grants; three
functions (`is_system_admin()`, `grant_system_admin(uuid)`, and two trigger functions); a new
`BEFORE INSERT` trigger on `public.member`. No existing column, policy or function changes.

ADR: **ADR-074**, written at this PLAN under ADR-067, `ACCEPTED by tech-lead-design under the
operator's delegation (ADR-067)`. It supersedes nothing. `requires_adr: true`. Applying the migration
and enabling TOTP on the hosted project are human-only (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md"
  - ".ai/registry/glossary.md"
  - ".ai/standards/rbac-and-security.md"
  - ".ai/board/tickets/MIR-18-b/ticket.yaml"
  - "supabase/migrations/20261104150000_mir18_system_admin.sql"
  - "supabase/tests/190-system-admin.test.sql"
  - "supabase/config.toml"
  - "vite.config.ts"
  - "system.html"
  - "src/system/main.tsx"
  - "src/lib/data/system.ts"
  - "tests/e2e/mir-18-system-panel.spec.ts"
```

Twelve paths, so `size: M`, which agrees with `size_estimate: M` for this slice. **The feature as a
whole was L** — enumerated with the org surface, the nginx header, the hardening and a second sibling
ticket it reached eighteen — which is why MIR-18-b exists (§ 1).

- **`.ai/board/tickets/MIR-18-b/ticket.yaml`** — written at this PLAN. MIR-18-b carries both halves
  of the remainder (org management, and the exposure hardening); a third sibling would have been the
  thirteenth path. Its PLAN is expected to split it.
- **`.ai/registry/glossary.md`** — one row, **System admin**. `ticket.yaml`'s `glossary_owed` was
  `[]`; ADR-059 § Consequences names the term as owed by the first MIR ticket that uses it, and
  MIR-10's plan (`01-plan.md:94-95`) names MIR-18. Recorded into `glossary_owed` so the gate reads
  it. *Org admin* stays MIR-16's.
- **`supabase/tests/010-catalogue.test.sql` is deliberately absent**: no function here is
  `security definer` (§ 4.1).
- **`docker/nginx.conf` is deliberately absent**: the header and the path are MIR-18-b's. nginx
  already serves `/system.html` as a static file through `try_files $uri`.
- **`.ai/board/tickets/MIR-18/verification.md`** is this ticket's own folder and is carried, not
  listed.

## 8. Rejected alternatives

1. **Put the panel in the member SPA as a lazy route at `/system`.** Rejected: the path would be a
   string in the member bundle, so it could never be unguessable (ADR-059 decision 1), and it would
   share the member client's stored session — signing out of one would sign out of the other
   (ADR-074, *Options considered*).
2. **Check the second factor only in the panel.** Rejected under ADR-005: a password-only session
   holds a token that reaches every RPC directly, so an `aal2` check anywhere but the database is
   decoration.
3. **Ship the org list in this ticket by granting `SELECT` on `public.org` to `authenticated` under a
   system-admin policy.** Rejected: it breaks `120-composite-fks.test.sql:64-66` and
   `130-backfill-org-public.test.sql:74-76`, neither in scope, and a `security definer` RPC instead
   adds `010-catalogue.test.sql` — the thirteenth path. The org list is MIR-18-b's first read.

## Changelog

- 2026-11-04 — first version. Sections 1 and 2 were written before the source tree was read. Reading
  it changed one AC: AC-4 gained its second clause after `admit_allow_listed_member()`
  (`20260913090000_solo_avatar_images.sql:46-80`) showed that every confirmed identity gets a member
  row, which ADR-074 decision 2 now refuses. Reading it also moved the org list out of this ticket
  (§ 8 Alt 3).

## Delegated decisions

- None that supersede or reverse an accepted ADR. ADR-074 is written under ADR-067's envelope and
  supersedes nothing.
