---
ticket: MIR-18-b
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-05T01:36:00Z
inputs_read:
  - .ai/board/tickets/MIR-18-b/ticket.yaml
  - .ai/board/tickets/MIR-18/ticket.yaml
  - .ai/board/tickets/MIR-18/01-plan.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - supabase/migrations/20260905120000_adm02_holiday.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261104150000_mir18_system_admin.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/190-system-admin.test.sql
  - supabase/seed.sql
  - src/lib/data/system.ts
  - src/system/main.tsx
  - src/lib/domain/types.ts
  - tests/e2e/mir-18-system-panel.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-18-b — what is behind the panel's door: the org list, creating an org with its holidays, and editing its name, caps and licence

## 1. Problem and scope

**Feature — MIR-18** (`.ai/registry/features.md:307`), transcribed:

> A separate system admin panel, unindexed, with its own account store, 2FA and org management

Plan item P4-3 (`.ai/board/plans/calechip-multi-tenancy-plan.md:246-251`):

> - Separate route, not indexed: `X-Robots-Tag: noindex` header, **not** `robots.txt` — listing it there publishes the path
> - Separate account store, 2FA required
> - IP allow-list if feasible
> - Rate limiting and failed-login logging
> - Org CRUD, caps, licence state, move-team-between-orgs

MIR-18 shipped the door (the account store and the second factor). ADR-074 decision 8 gave this
ticket the rest, and said its PLAN was expected to split it again. **It splits here, by operation**
(`.ai/01-operating-model.md` § Sizing):

- **MIR-18-b (this ticket) — org management.** The panel's first content: list orgs, create one
  (seeded with the national holidays), edit its name, caps and licence state.
- **MIR-18-c — the panel's exposure hardening.** `X-Robots-Tag` in `docker/nginx.conf`, the
  unguessable path, rate limiting and failed-login logging for the second factor, and the IP
  allow-list question. Written as `.ai/board/tickets/MIR-18-c/ticket.yaml` by this ticket.

**Who gains what.** Today a system admin who passes the second factor reaches a screen that says
*Nothing to manage here yet*, and the only way to make a new org is a hand-written `insert`. After
this ticket, that admin sees every org in the deployment, creates a dedicated org — which arrives
with the national holiday calendar already in it, so its first member does not see a calendar with
no holidays — and records each org's caps, plan and licence expiry. Those values are stored and
shown only: what a cap or an expiry *does* is deferred by the operator (ADR-059 § Out of scope).

**Out of scope:**

- **Deleting or suspending an org.** Per-tenant deletion is ADR-059 § Out of scope item 6; ADR-070
  defines no suspended state. CRUD here is create, read and update (ADR-075 decision 2).
- **Enforcing, defaulting or counting against a cap, and any behaviour of `plan` or the licence
  expiry** — ADR-059 § Out of scope items 1–4 and 7. Member and team counts are not shown, since a
  count beside a cap reads as the cap's measure, and item 4 leaves that measure undecided.
- **Editing Org public** — listed, not edited (ADR-075 decision 7).
- **Changing an org's `org_code`** (immutable, ADR-070 § 2) **or its `timezone` after creation**
  (ADR-075 decision 4).
- **Move-team-between-orgs** — MIR-15 (`features.md:304`), built as a screen in this panel.
- **Creating an org admin or a first member for a new org** — MIR-16 (the role split) and MIR-19
  (`/{org_code}`, where a sign-up first gets an org of its own, ADR-071 decision 1).
- **Editing a dedicated org's holidays after the seed** — MIR-16 (its `org_admin`, ADR-070 § 4).
  Org public's holidays are MIR-15's.
- **`X-Robots-Tag`, the unguessable path, rate limiting, failed-login logging, the IP allow-list**
  — MIR-18-c.
- **Reconciling `plan`'s nullability with ADR-070 § 2** — recorded in ADR-075 decision 6, left.

`size_estimate: M`.

## 2. Acceptance criteria

**pgTAP fixtures** — `tests.seed()` from `supabase/tests/_isolation.psql` (`admin_t` and the rest
are approved members of Org public). The test adds, as `postgres`:

- **`sys_a`** — an `auth.users` row, made a system admin with `grant_system_admin`, as in
  `190-system-admin.test.sql`.
- **Two holiday rows in Org public**: `2031-01-01` *Tet Duong lich* `non_working`, and `2031-02-08`
  *Lam bu* `working`. Dates are chosen so no seed row collides.
- **`org_x`** — a dedicated org (`is_shared_tenant = false`), `org_code = 'mir18b-x'`.

**"At `aal2`" / "at `aal1`"** mean what they mean in MIR-18's plan § 2: claims `{"sub", "role":
"authenticated", "aal": "aal2" | "aal1"}`. **"Refused with X"** means the call raises SQLSTATE X and
the state of `public.org` and `public.holiday` is as it was before the call.

**AC-1 — the licence column exists, and `public.org` stays closed**
- `public.org.licence_expires_at` exists, `timestamp with time zone`, nullable
- `anon` and `authenticated` hold no table privilege on `public.org`

**AC-2 — only a system admin at `aal2` lists orgs**
- `sys_a` at `aal2` → `public.list_orgs()` returns one row per `public.org` row, Org public among them
  with `is_shared_tenant = true` and `org_x` with `false`
- Rows come back with the shared tenant first, then by `org_code` ascending
- `sys_a` at `aal1` → refused with `42501`
- `admin_t` at `aal2` → refused with `42501`

**AC-3 — creating an org**
- `sys_a` at `aal2` → `public.create_org('mir18b-new', 'New Org', 'Asia/Ho_Chi_Minh')` returns a uuid
- And `public.org` holds that row with `org_code = 'mir18b-new'`, `name = 'New Org'`,
  `timezone = 'Asia/Ho_Chi_Minh'`, `is_shared_tenant = false`, `plan = 'free'`, `max_members`,
  `max_teams` and `licence_expires_at` null
- A name given with surrounding spaces is stored trimmed

**AC-4 — a new org arrives with the national holidays**
- After AC-3, the set of `(date, name, kind)` in `public.holiday` for the new org equals the set for
  Org public — including both fixture rows, with `kind` preserved
- And Org public's holiday row count is unchanged

**AC-5 — creating is refused for a bad value or a non-admin, and writes nothing**
- `org_code` already in use (`'mir18b-x'`) → refused with `23505`
- A reserved `org_code` (`'admin'`) → refused with `23514`
- A malformed `org_code` (`'Bad_Code'`) → refused with `23514`
- A blank name (`'   '`) → refused with `23514`
- An unknown timezone (`'Mars/Olympus'`) → refused with `22023`
- `sys_a` at `aal1`, and `admin_t` at `aal2`, with otherwise valid values → refused with `42501`
- After each, the `public.org` row count and the `public.holiday` row count are as before

**AC-6 — editing a dedicated org**
- `sys_a` at `aal2` → `public.update_org(org_x, 'Renamed', 40, 4, 'pro', '2028-01-31')` succeeds
- And `list_orgs()` then returns, for `org_x`: `name = 'Renamed'`, `max_members = 40`,
  `max_teams = 4`, `plan = 'pro'`, `licence_expires_on = '2028-01-31'`, and `org_code` and
  `timezone` unchanged
- And `update_org(org_x, 'Renamed', null, null, 'pro', null)` then leaves both caps and
  `licence_expires_on` null

**AC-7 — editing is refused for Org public, a bad value or a non-admin**
- `update_org` on Org public's id → refused with `42501`
- `max_members = 0` or `max_teams = 0` → refused with `23514`
- A blank plan → refused with `23514`; a null plan → refused with `23502`
- A blank name → refused with `23514`
- A uuid with no `public.org` row → refused with `P0002`
- `sys_a` at `aal1`, and `admin_t` at `aal2` → refused with `42501`

**AC-8 — the RPCs' privileges**
- `authenticated` has `EXECUTE` on `list_orgs()`, `create_org(text,text,text)` and
  `update_org(uuid,text,integer,integer,text,date)`; `anon` has none of them
- The three appear in the `security definer` census of `supabase/tests/010-catalogue.test.sql`, and
  that test passes

**Panel fixtures (mock seam, `/system.html`, built with `VITE_DATA_SEAM=mock`).** MIR-18's accounts
and code stand (`ops@calechip.test`, password `calechip-demo`, code `246810`). The mock holds two
orgs at load:

| `org_code` | Name | Shared | Timezone | Members cap | Teams cap | Plan | Licence expires |
|---|---|---|---|---|---|---|---|
| `shared` | Org public | yes | Asia/Ho_Chi_Minh | — | — | free | — |
| `acme` | Acme Studio | no | Asia/Ho_Chi_Minh | 30 | 3 | free | 2027-06-30 |

**"Signed in"** below means `ops@calechip.test` has signed in and submitted `246810`. **"—"** is the
text shown for a null value.

**AC-9 — the signed-in panel shows the org list**
- Given signed in
- Then `system-orgs` is shown, holding one `system-org-row` per org, `shared` first, then `acme`
- And each row's `system-org-code`, `system-org-name`, `system-org-timezone`,
  `system-org-max-members`, `system-org-max-teams`, `system-org-plan` and `system-org-licence` read
  the table's values
- And the `shared` row holds `system-org-shared` and no `system-org-edit`; the `acme` row holds
  `system-org-edit` and no `system-org-shared`
- And `system-signout` and `system-signed-in-email` (`ops@calechip.test`) are still shown

**AC-10 — creating an org from the panel**
- Given signed in, when `system-org-new` is pressed
- Then `system-org-create-form` is shown, and `system-org-create-timezone` already reads
  `Asia/Ho_Chi_Minh`
- When code `globex` and name `Globex` are entered and `system-org-create-submit` is pressed
- Then `system-org-create-form` is gone, and a `system-org-row` for `globex` is shown after `acme`,
  reading name `Globex`, both caps `—`, plan `free`, licence `—`, with `system-org-edit`

**AC-11 — a refused create stays on the form**
- When the create form is submitted with code `acme`, `system-org-create-error` is shown, the form
  stays, and there is still exactly one `acme` row
- When it is submitted with code `admin`, `system-org-create-error` is shown and no `admin` row
  appears
- When `system-org-create-cancel` is pressed, the form is gone and no row was added

**AC-12 — editing an org from the panel**
- Given signed in, when `acme`'s `system-org-edit` is pressed
- Then `system-org-edit-form` is shown; `system-org-edit-code` reads `acme` and is not an input; the
  name, members cap, teams cap, plan and licence fields hold `Acme Studio`, `30`, `3`, `free`,
  `2027-06-30`
- When the name becomes `Acme Works`, members cap `40`, teams cap is cleared, plan `pro`, licence
  `2028-01-31`, and `system-org-edit-submit` is pressed
- Then the form is gone and the `acme` row reads `Acme Works`, `40`, `—`, `pro`, `2028-01-31`

**AC-13 — a refused edit stays on the form and changes nothing**
- When the edit form is submitted with members cap `0`, `system-org-edit-error` is shown, the form
  stays, and after `system-org-edit-cancel` the `acme` row still reads its earlier values
- The same holds for a blank plan
- When the members cap holds `2.5`, `system-org-edit-error` is shown and nothing is saved

**AC-14 — the member app still does not carry the panel**
- When `/` is loaded, no script it loads contains the text `system-org-new`

**AC-15 — verified against a real Supabase stack, recorded in `verification.md`**
(`verification_required: true`; a passing mock test is not verification)
- A system admin signed in at `aal2` sees Org public in the list, creates an org, and a `select
  count(*)` of that org's `public.holiday` rows equals Org public's
- Editing that org's caps, plan and licence from the panel is reflected in the list after a reload
- A member's session calling `rpc('list_orgs')` directly is refused with `42501`

**Invariants touched:** `[]`. No entry, count, team or membership rule is read or changed. Holiday
rows are copied into an org that has no members, so INV-04's count is unaffected; caps are not
enforced, so refusal 6 is not reached.

**Open questions:** none blocking.

1. **The Vietnamese word for *System admin*** — carried from MIR-18's plan; not this ticket's.
2. **The IP allow-list's address list** — a fact only the operator holds; MIR-18-c's.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

- **The signed-in card widens.** Every other screen keeps MIR-18's `max-w-sm` card. Signed in, the
  card is `max-w-4xl`, still `bg-card rounded-card p-8` under the *CaleChip · System* label, because
  the org list is a table and density wins over charm here (`CLAUDE.md` § Visual direction).
- **Header row.** Left: title *System panel*, then *Signed in as <email>* and the mint *Two-step
  verified* pill, as MIR-18 had them. Right: *Sign out* as a small secondary button
  (`bg-field text-ink rounded-pill px-4 py-2 text-sm`). MIR-18's *Nothing to manage here yet.* is
  gone.
- **Orgs section.** A heading row: *Orgs* (`text-ink text-lg font-bold`) with the count beside it in
  `text-ink-3`, and on the right a primary *New org* button (`bg-primary text-white rounded-pill
  px-4 py-2 text-sm`).
- **The table.** Dense: `text-sm`, rows `py-2`, a hairline `border-line` between rows, header cells
  `text-ink-3 text-xs font-semibold uppercase tracking-wide`. Columns in this order: *Code*
  (`font-mono`), *Name*, *Timezone*, *Members cap*, *Teams cap*, *Plan*, *Licence expires*, and an
  unlabelled last column. Numbers right-aligned. A null shows *—* in `text-ink-3`. The licence is
  `yyyy-MM-dd`. Org public's last cell is a *Shared* pill in lavender (`bg-holiday
  text-ink-2 rounded-pill` — the palette has no `holiday-ink` token) — lavender because it is the tenant that owns the national
  calendar; every other row's last cell is a text button *Edit*. On a narrow screen the table
  scrolls horizontally inside the card rather than wrapping.
- **The create form** opens between the heading row and the table, in a `bg-field/50 rounded-xl p-4`
  box titled *New org*: *Org code* (with the hint *Lowercase letters, digits and hyphens. Cannot be
  changed later.* in `text-ink-3 text-xs`), *Name*, *Timezone* (prefilled), then *Create* (primary)
  and *Cancel* (text button) on one row, and the error line under them in `text-danger text-sm`.
- **The edit form** opens in the same place, titled *Edit org*, with the org code shown as
  `font-mono` text, not a field; then *Name*, *Members cap* and *Teams cap* side by side
  (`type="number"`, `min=1`, empty meaning no cap, with the hint *Leave empty for no cap. Not
  enforced.*), *Plan*, *Licence expires* (`type="date"`, empty meaning none), then *Save* and
  *Cancel*, and the error line. Only one form is open at a time: opening one closes the other.
- **Loading and failure.** While the list loads, *Loading orgs…* in `text-ink-3`, `role="status"`.
  If it fails, the message in `text-danger text-sm` and a text button *Try again*.

## 3. Permission model

The database is the control. The panel is the affordance (ADR-005, ADR-074 decision 4).

| Action | Who may | Who may not | Where it is checked |
|---|---|---|---|
| List orgs | a system admin at `aal2` (AC-2) | the same identity at `aal1`; every member, manager and admin; `anon` (AC-2, AC-8) | `public.list_orgs()` raises `42501` unless `is_system_admin()`; no `EXECUTE` for `anon` |
| Create an org, and seed its holidays | a system admin at `aal2` (AC-3, AC-4) | as above (AC-5) | `public.create_org(...)`, same gate; the holiday copy runs inside it, so no caller holds a holiday write it did not already have |
| Edit a dedicated org's name, caps, plan, licence | a system admin at `aal2` (AC-6) | as above; **nobody** edits Org public this way (AC-7) | `public.update_org(...)`, same gate, then a refusal on `is_shared_tenant` |
| Change an org's `org_code` | nobody (ADR-070 § 2) | — | no parameter carries it; `org_enforce_immutable_org_code` stands behind that |
| Change an org's `timezone` after creation | nobody here (ADR-075 decision 4) | — | no parameter carries it |
| Delete or suspend an org | nobody here (ADR-075 decision 2) | — | no function exists; `public.org` holds no table privilege for `authenticated` (AC-1) |
| Read or write `public.org` directly | nobody but `postgres`/`service_role` | `anon`, `authenticated` (AC-1) | table privileges revoked (MIR-11), unchanged |

**Edit to `.ai/standards/rbac-and-security.md`.** The `system_admin` paragraph under `## Roles`
keeps its text and gains one sentence after it: *Since MIR-18-b, a system admin lists, creates and
edits orgs through `list_orgs`, `create_org` and `update_org`, each refusing unless
`is_system_admin()` is true; `create_org` copies Org public's holidays into the new org
([ADR-075](../registry/decisions/ADR-075-a-system-admin-manages-orgs-through-three-aal2-gated-rpcs.md)).
That is its only right on any table in this file until MIR-16.* No existing row changes.

## 4. Contract

### 4.1 Migration `supabase/migrations/20261105120000_mir18b_org_management.sql`

One `begin; … commit;`, idempotent (ADR-024). The header cites ADR-075 decisions 1–7. Applying it to
a remote project is human-only (RULE-09).

```sql
-- ADR-075 decision 5; ADR-070 § 2's column, which MIR-11 left out.
alter table public.org add column if not exists licence_expires_at timestamptz null;

-- ADR-075 decision 1. Every column reference is qualified: `returns table` names are PL/pgSQL
-- variables in scope.
create or replace function public.list_orgs()
  returns table (
    id                 uuid,
    org_code           text,
    name               text,
    is_shared_tenant   boolean,
    timezone           text,
    max_members        integer,
    max_teams          integer,
    plan               text,
    licence_expires_on date,
    created_at         timestamptz
  )
  language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  return query
    select o.id, o.org_code, o.name, o.is_shared_tenant, o.timezone,
           o.max_members, o.max_teams, o.plan,
           (o.licence_expires_at at time zone o.timezone)::date,
           o.created_at
      from public.org o
     order by o.is_shared_tenant desc, o.org_code asc;
end;
$$;

-- ADR-075 decision 3.
create or replace function public.create_org(p_org_code text, p_name text, p_timezone text)
  returns uuid
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names z where z.name = p_timezone) then
    raise exception 'unknown timezone' using errcode = '22023';
  end if;

  insert into public.org (org_code, name, timezone)
  values (p_org_code, btrim(p_name), p_timezone)
  returning public.org.id into v_id;

  insert into public.holiday (org_id, date, name, kind)
  select v_id, h.date, h.name, h.kind
    from public.holiday h
    join public.org o on o.id = h.org_id
   where o.is_shared_tenant;

  return v_id;
end;
$$;

-- ADR-075 decisions 4, 5, 7.
create or replace function public.update_org(
  p_org_id             uuid,
  p_name               text,
  p_max_members        integer,
  p_max_teams          integer,
  p_plan               text,
  p_licence_expires_on date
) returns void
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_org public.org%rowtype;
begin
  if not public.is_system_admin() then
    raise exception 'not a system admin' using errcode = '42501';
  end if;
  select * into v_org from public.org o where o.id = p_org_id for update;
  if not found then
    raise exception 'org not found' using errcode = 'P0002';
  end if;
  if v_org.is_shared_tenant then
    raise exception 'Org public is not edited from the panel' using errcode = '42501';
  end if;

  update public.org o
     set name               = btrim(p_name),
         max_members        = p_max_members,
         max_teams          = p_max_teams,
         plan               = btrim(p_plan),
         licence_expires_at = case when p_licence_expires_on is null then null
                                   else p_licence_expires_on::timestamp at time zone v_org.timezone end
   where o.id = p_org_id;
end;
$$;

revoke all on function public.list_orgs() from public, anon;
revoke all on function public.create_org(text, text, text) from public, anon;
revoke all on function public.update_org(uuid, text, integer, integer, text, date) from public, anon;
grant execute on function public.list_orgs() to authenticated;
grant execute on function public.create_org(text, text, text) to authenticated;
grant execute on function public.update_org(uuid, text, integer, integer, text, date) to authenticated;
```

- **Constraint refusals come from the table, not the function**: `org_org_code_key` (`23505`),
  `org_code_shape`, `org_code_not_reserved`, `org_name_not_blank`, `org_plan_not_blank`,
  `org_max_*_positive` (`23514`), and `plan`'s `not null` (`23502`, since `btrim(null)` is null).
  No check is duplicated in the function.
- **`btrim(p_name)` on a null name** is null, refused by `name not null` (`23502`). AC-5 and AC-7
  test the blank case only.
- **The holiday insert sets `org_id`**, so `holiday_stamp_org_id` leaves it alone
  (`20261103120000_mir13_write_path_org_bound.sql:193-195`). The new org has no rows, so
  `holiday_org_id_date_key` cannot collide.
- **TODO(verify): `is_system_admin()` inside a definer function.** It is `security invoker` and
  reads `auth.uid()` and `auth.jwt()` from the request settings, which a definer call does not
  change; inside it, `public.system_admin` is read as the function owner. AC-2's `aal1` and
  `admin_t` cases are what prove the gate still refuses — if either passes, the gate is broken, not
  the test.
- **`created_by` is left null.** It references `public.member`, and a system admin has none
  (ADR-074 decision 2).

### 4.2 pgTAP `supabase/tests/200-org-management.test.sql`

New. The header pattern of `190-system-admin.test.sql`: `\ir _isolation.psql`, `tests.seed()`,
explicit `plan(n)`, `rollback`. **It defines its own `tests.sys(text)` and
`tests.authenticate_at(uuid, text)`, copied from `190-system-admin.test.sql:22-37`** — each test file
runs in its own transaction, and `_isolation.psql` is not edited. `sys_a` is a different uuid from
190's (`…00b1`), so the files share nothing. Fixtures are inserted as `postgres` before any
`authenticate_at`. AC-1 to AC-8 each have at least one assertion labelled `AC-n`. Refusals use
`throws_ok(sql, sqlstate, ...)`; "writes nothing" is a count compared before and after.

### 4.3 Census — `supabase/tests/010-catalogue.test.sql`

The `set_eq` array gains, after the MIR-14-b block:

```sql
    -- MIR-18-b RPCs, 200-org-management.test.sql
    'public.list_orgs()',
    'public.create_org(text,text,text)',
    'public.update_org(uuid,text,integer,integer,text,date)',
```

Nothing else in the file changes. The anon `todo` check is unaffected: the three are revoked from
`anon`.

### 4.4 The panel's seam — `src/lib/data/system.ts`

Additions only. `SystemGate`, `TotpEnrolment` and the five existing methods are unchanged.

```ts
/** One row of `public.list_orgs()`. ADR-075. */
export interface OrgSummary {
  id: string;
  orgCode: string;
  name: string;
  isSharedTenant: boolean;
  timezone: string;
  maxMembers: number | null;
  maxTeams: number | null;
  plan: string;
  /** `yyyy-MM-dd` in the org's timezone, or null. */
  licenceExpiresOn: string | null;
  createdAt: string;
}

export interface CreateOrgInput {
  orgCode: string;
  name: string;
  timezone: string;
}

export interface UpdateOrgInput {
  orgId: string;
  name: string;
  maxMembers: number | null;
  maxTeams: number | null;
  plan: string;
  licenceExpiresOn: string | null;
}

/** The panel's own refusal codes. Local to the panel: `src/lib/domain/types.ts` is not edited. */
export type OrgFailureCode =
  | "not_permitted"     // 42501, P0002
  | "org_code_taken"    // 23505
  | "org_code_invalid"  // 23514 on org_code_shape or org_code_not_reserved
  | "invalid_org_field" // any other 23514, or 23502; also the panel's own cap parse
  | "unknown_timezone"  // 22023
  | "network";          // anything else, or a throw

export type OrgResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: OrgFailureCode; message: string } };

export interface SystemSeam {
  // … the five existing methods, unchanged …
  /** `rpc("list_orgs")`, mapped to camelCase. Never throws. */
  listOrgs(): Promise<OrgResult<OrgSummary[]>>;
  /** `rpc("create_org", { p_org_code, p_name, p_timezone })`. Value is the new id. Never throws. */
  createOrg(input: CreateOrgInput): Promise<OrgResult<string>>;
  /** `rpc("update_org", { p_org_id, p_name, p_max_members, p_max_teams, p_plan, p_licence_expires_on })`. Never throws. */
  updateOrg(input: UpdateOrgInput): Promise<OrgResult<null>>;
}
```

**Messages**, one constant per code, in English without diacritics:

| Code | Message |
|---|---|
| `not_permitted` | `You do not have permission to do that.` |
| `org_code_taken` | `That org code is already in use.` |
| `org_code_invalid` | `Org codes are 2 to 32 lowercase letters, digits or hyphens, and some words are reserved.` |
| `invalid_org_field` | `A name and a plan are required, and caps are whole numbers of 1 or more.` |
| `unknown_timezone` | `That timezone is not recognised.` |
| `network` | `Could not reach the server. Try again.` |

**Supabase implementation.** The panel's own `client()`. The SQLSTATE is the PostgREST error's
`code`; `org_code_invalid` is chosen when the error's `message` contains `org_code_shape` or
`org_code_not_reserved`. The inputs are sent as given — no trimming or lower-casing in the seam, so
the database's refusal is the one shown.

**Mock implementation.** The two orgs of § 2's panel table, in memory, reset on reload, with fixed
ids. Every org method returns `not_permitted` unless the mock session is at `aal2` for a system
admin. It mirrors the database's checks so the panel can be driven offline: `org_code` against
`^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$` and the reserved list copied from
`20261027120000_mir11_composite_foreign_keys.sql:46-58` as a constant; duplicate code; name trimmed,
non-blank and at most 80 characters; plan trimmed and non-blank; caps null or an integer ≥ 1; a
timezone the browser's `Intl.DateTimeFormat` accepts; `update_org` on the shared org refused. A new
org gets `plan: "free"`, null caps and licence, and is listed in the database's order. **The mock
does not model holidays** — AC-4 is the database's, and AC-15 checks it on a real stack.

### 4.5 The panel entry — `src/system/main.tsx`

The `signed-in` branch is replaced by an `OrgManagement` component in the same file, laid out as
§ 2b. On arriving at `signed-in` it calls `systemSeam.listOrgs()`; after a successful create or
edit it calls it again rather than patching local state. The card's width is `max-w-4xl` in the
`signed-in` state and `max-w-sm` otherwise. Nothing else in the file changes, and it still imports
nothing from the member app.

| Element | Id |
|---|---|
| list container | `system-orgs` |
| loading / failure / retry | `system-orgs-loading`, `system-orgs-error`, `system-orgs-retry` |
| one row, with `data-org-code="<org_code>"` | `system-org-row` |
| cells | `system-org-code`, `system-org-name`, `system-org-timezone`, `system-org-max-members`, `system-org-max-teams`, `system-org-plan`, `system-org-licence` |
| last cell | `system-org-shared` (Org public) or `system-org-edit` (every other) |
| new | `system-org-new` |
| create form | `system-org-create-form`, `system-org-create-code`, `system-org-create-name`, `system-org-create-timezone`, `system-org-create-submit`, `system-org-create-cancel`, `system-org-create-error` |
| edit form | `system-org-edit-form`, `system-org-edit-code` (text), `system-org-edit-name`, `system-org-edit-max-members`, `system-org-edit-max-teams`, `system-org-edit-plan`, `system-org-edit-licence`, `system-org-edit-submit`, `system-org-edit-cancel`, `system-org-edit-error` |

- `system-signed-in`, `system-signed-in-email` and `system-signout` keep their ids, so MIR-18's
  spec still passes unedited.
- A null cell renders `—`. A cap field that is empty sends `null`; one that is not an integer ≥ 1
  after `Number(...)` is refused in the panel with `invalid_org_field`'s message and sends nothing
  (AC-13's `2.5`); `0` is sent, so the database's refusal is exercised. An empty licence field sends
  `null`.
- The timezone field defaults to `Asia/Ho_Chi_Minh`, the column default (ADR-070 § 2).
- `*-error` elements render only when there is an error.

### 4.6 Tests

- **`supabase/tests/200-org-management.test.sql`** — § 4.2. AC-1 to AC-8.
- **`supabase/tests/010-catalogue.test.sql`** — § 4.3. AC-8's census half.
- **`tests/e2e/mir-18-b-org-management.spec.ts`** — new, against the mock build
  `playwright.config.ts` already runs. AC-9 to AC-14, with a `signInVerified(page)` helper local to
  the file. AC-14 follows MIR-18's AC-14 test (`tests/e2e/mir-18-system-panel.spec.ts`).
- **AC-15** — manual, recorded in `.ai/board/tickets/MIR-18-b/verification.md`.

## 5. Seam impact

**No function of the member seam changes, and none is added.** `src/lib/data/index.ts`, `mock.ts`
and `supabase.ts` are untouched; `tests/seam-parity.test.ts` is unaffected.

**The panel seam `src/lib/data/system.ts` gains three methods** (§ 4.4), each in both its
implementations with the same name and arity. No existing method or type changes, so no existing
caller changes. `src/lib/domain/types.ts` is not edited: the panel's refusal codes are local to the
panel (ADR-074 decision 6 keeps the panel's types out of the member app's).

## 6. Schema delta

**Not `none`:** a new nullable column `public.org.licence_expires_at`; three new `security definer`
functions (`list_orgs()`, `create_org(text,text,text)`, `update_org(uuid,text,integer,integer,text,date)`)
with their grants. No existing column, constraint, policy, trigger or function changes.

ADR: **ADR-075**, written at this PLAN, `ACCEPTED by tech-lead-design under the operator's delegation
(ADR-067)`. It supersedes nothing. `requires_adr: true`. Applying the migration to the hosted
project is human-only (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-075-a-system-admin-manages-orgs-through-three-aal2-gated-rpcs.md"
  - ".ai/standards/rbac-and-security.md"
  - ".ai/board/tickets/MIR-18-c/ticket.yaml"
  - "supabase/migrations/20261105120000_mir18b_org_management.sql"
  - "supabase/tests/200-org-management.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "src/lib/data/system.ts"
  - "src/system/main.tsx"
  - "tests/e2e/mir-18-b-org-management.spec.ts"
```

Nine paths, so `size: M`, which agrees with `size_estimate: M`. The ticket as triaged (org
management and the exposure hardening) was L — the hardening adds at least `docker/nginx.conf`,
`Dockerfile`, a start-up script for the path, `vite.config.ts`, a failed-login log table with its
test, and an e2e spec — which is why MIR-18-c exists.

- **`glossary_owed` is `[]`**, so `.ai/registry/glossary.md` is not listed. *Org* and *Org public*
  already have rows (ADR-070 § Consequences).
- **`supabase/tests/120-composite-fks.test.sql` and `130-backfill-org-public.test.sql` are
  deliberately absent**: `public.org` keeps every table privilege revoked (AC-1).
- **`tests/e2e/mir-18-system-panel.spec.ts` is deliberately absent**: it asserts the signed-in ids,
  which are kept, and not the removed empty-state text.
- **`.ai/standards/data-model.md` is deliberately absent**: it already documents
  `licence_expires_at`; the `plan` divergence is recorded in ADR-075 decision 6.
- **`.ai/board/tickets/MIR-18-b/verification.md`** is this ticket's own folder and is carried.

## 8. Rejected alternatives

1. **Read and write `public.org` through PostgREST under policies gated on `is_system_admin()`.**
   Genuinely simpler in the seam — no RPCs, `from("org").select()`. Rejected: granting table
   privileges breaks `120-composite-fks.test.sql:64-66` and `130-backfill-org-public.test.sql:74-76`
   (two more paths and a reversed assertion), and the holiday seed becomes a second client call that
   can fail after the org exists, leaving an org with no calendar.
2. **Keep MIR-18-b whole — org management and hardening in one ticket.** Rejected: fifteen-plus
   paths is L, which must split at PLAN, and the two halves share no file but the panel.
3. **Split org management again, list first and writes second.** The Sizing rule's first cut is by
   operation. Rejected: at nine paths the whole of it is M, and a list-only ticket would ship a panel
   whose only new org must still come from a hand-written `insert`.

## Changelog

- 2026-11-05 — first version. Sections 1 and 2 were written before the source tree was read. Reading
  it changed two things. AC-1 gained the column clause after `20261027120000_mir11_composite_foreign_keys.sql:30-62`
  showed MIR-11 never created `licence_expires_at`; and AC-3's `plan = 'free'` replaced
  *`plan` null*, because the column is `not null default 'free'` on disk (ADR-075 decision 6). No AC
  was narrowed to fit the build.

## Delegated decisions

- None that supersede or reverse an accepted ADR. ADR-075 is written under ADR-067's envelope and
  supersedes nothing.
