---
doc_version: 9
last_updated: 2026-10-27
governed_by: [RULE-01, RULE-04, RULE-09]
---

# Data model

This is where field names become real, which makes it the document RULE-04 depends on: the Developer
may not invent a field name, so every name has to exist here or in design section 1 first.

**Every name below is either in `.ai/registry/glossary.md` or was decided by the operator on
2026-08-31.** Names that would have required inventing are in `OPEN QUESTIONS` at the end rather than
in a table, because a plausible column name in this file is indistinguishable from a decided one.

## Entities

### `team`

One row per team. There are many since `supabase/migrations/20260911180000_solo_many_teams.sql`
(ADR-039). The table exists because INV-07 counts entries against a team. ADR-059 places every team
inside an org. The target schema designed by MIR-10 ([ADR-070](../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md))
is specified in `## Multi-tenancy target schema (MIR-10, ADR-070)` below and takes effect in
`supabase/migrations/` as MIR-11, MIR-12, MIR-14, MIR-16 and MIR-21 land. *Until 2026-10-13 this read "One row in v1. The table exists anyway because INV-07 counts
entries against a team, and the brief's P2 list asks the model to leave room for more."*

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `name` | text, not null | |
| `overload_threshold` | numeric, not null, default `0.5` | The *Threshold* in the glossary. A share, not a count. Configurable by an admin; not an invariant, precisely because it is configurable. |
| `created_at` | timestamptz, not null | |

### `member`

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk, references `auth.users(id)` | **The member's id is the Supabase Auth user id.** Every policy is then `... = auth.uid()` with no lookup, which matters more than it looks: under ADR-005 a policy written loosely fails open, and the shortest correct policy is the one hardest to write wrongly. |
| `team_id` | uuid, **null**, references `team(id)` | **Dropped 2026-11-07 by MIR-21-f** (ADR-080 decision 4). A member's teams are their `public.membership` rows; the roster team is `public.member_roster_team_id(id)`. *Until then:* INV-07. **Nullable since [ADR-033](../registry/decisions/ADR-033-a-person-joins-by-signing-up-and-an-admin-decides-afterwards.md)** — the admin picks the team at approval, so there is nothing to write here at sign-up. INV-07 is unaffected: a member with no team has no entries. |
| `display_name` | text, not null | |
| `avatar` | text, not null | The mascot or avatar at the head of each row (brief §8). The prototype stores an emoji. |
| `role` | `member_role`, not null, default `member` | Enum: `member`, `manager`, `admin` — `manager` added 2026-09-12 by [ADR-035](../registry/decisions/ADR-035-a-third-role-manager-decides-entries-and-nothing-else.md). Rank order and the full permission table are in [rbac-and-security.md](rbac-and-security.md). **The enum's ORDER is the rank order**, which is why `manager` was added between the two rather than after them: PostgreSQL orders an enum by declaration, so `role > 'member'` is a usable predicate and stays true of a rank inserted in the middle. |
| `status` | `member_status`, not null, default `pending` | Enum: `pending`, `approved`, `rejected`. [ADR-033](../registry/decisions/ADR-033-a-person-joins-by-signing-up-and-an-admin-decides-afterwards.md). **`public.member_team_ids` and `public.member_primary_team_id` return a team only for an `approved`, unremoved member, and every team-scoped policy resolves through one of them** (*until 2026-11-07 this named `public.member_team_id`, dropped by MIR-21-f*) — so this one column admits or refuses a person everywhere at once. Three values and not a boolean: a rejected person and one still waiting are different answers, and the screen that lists them has to tell them apart. |
| `removed_at` | timestamptz, null | Soft delete. Null means active. **Orthogonal to `status`** — `status` is the decision on somebody arriving, `removed_at` the decision on somebody leaving. |
| `event_email_enabled` | boolean, not null, default `true` | EVT-05, [ADR-051](../registry/decisions/ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md), [ADR-053](../registry/decisions/ADR-053-event-email-goes-over-gmail-smtp-from-an-edge-function-the-database-calls.md). **The one switch for event email**; in-app notifications ignore it. On by default for every existing row and every admission. **No `update` grant names it, to anybody** — written only by `public.set_event_email(p_enabled)`, a definer function that writes `auth.uid()`'s own row while `removed_at is null`; a column grant would let an admin change a colleague's through `member_update_admin`. Read by the definer trigger `email_notification` on `public.notification`. Readable by whoever can read the row; it grants nothing. |
| `created_at` | timestamptz, not null | |

**A member cannot exist before their auth user does**, because the primary key *is* that user's id.
The row is therefore created by a trigger on `auth.users`, not by an insert this application issues
— [ADR-033](../registry/decisions/ADR-033-a-person-joins-by-signing-up-and-an-admin-decides-afterwards.md), which
creates it for **anybody** who confirms an address, writes no `membership` row, and leaves `status` at its
`pending` default. There is no invitation and no elevated credential anywhere in the flow.

**`removed_at` is what "current member count" means.** INV-04's denominator is the members of a team
with `removed_at is null`. Their entries stay, which is the operator's decision of 2026-08-31, and
the consequence is already recorded in the INV-04 note: removing somebody changes the absence count
for past dates.

### `entry`

The unit everything else counts, approves and displays.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `member_id` | uuid, not null, references `member(id)` | INV-07. Exactly one member. |
| `type` | `entry_type`, not null | Enum: `pto`, `wfh`. A WFH member is working — the glossary calls this the most costly confusion in the domain. |
| `portion` | `entry_portion`, not null, default `full` | Enum: `full`, `am`, `pm`. **One portion for the whole range** (INV-06): a five-day `pm` entry is five afternoons. |
| `start_date` | date, not null | |
| `end_date` | date, not null | Equal to `start_date` for a single day. |
| `tentative` | boolean, not null, default `false` | Displayed to everyone, counted in every calculation (INV-05); it differs visually only. Independent of `status` — the glossary keeps them apart deliberately. |
| `status` | `entry_status`, not null, default `pending` | Enum: `pending`, `approved`, `rejected`. |
| `rejection_reason` | text, null | INV-03: not null and non-empty exactly when `status = 'rejected'`. |
| `note` | text, null | Free text, optional (brief §6). **Editing it alone does not revoke an approval** — INV-02. |
| `approved_by` | uuid, null, references `member(id)` | Operator decision, 2026-08-31. The only audit trail v1 has, and it matters more than usual because an admin may edit another member's entry with no other trace — known weakness 3 in [rbac-and-security.md](rbac-and-security.md). |
| `approved_at` | timestamptz, null | |
| `created_at` | timestamptz, not null | |
| `updated_at` | timestamptz, not null | |
| `date_range` | `daterange`, generated always … stored | [ADR-011](../registry/decisions/ADR-011-inv-01-exclusion-constraint.md). `daterange(start_date, end_date, '[]')` — the `'[]'` is required because `end_date` is inclusive. **Never written**, so the seam's insert and update types must exclude it. Stored canonicalised to `[)`. |
| `portion_slots` | `int4range`, generated always … stored | [ADR-011](../registry/decisions/ADR-011-inv-01-exclusion-constraint.md). The half-day slot range: `full` → `[0,2)`, `am` → `[0,1)`, `pm` → `[1,2)`. Exists so INV-01's constraint can intersect portions rather than compare them for equality. Never written. |

**There is no `allowed_email` table**, and there was one until 2026-09-10. ADR-009 gated sign-up on
an admin typing the address first; [ADR-033](../registry/decisions/ADR-033-a-person-joins-by-signing-up-and-an-admin-decides-afterwards.md)
reversed the order, dropped the table with `cascade`, and put the gate in `member.status` instead.
The removal is recorded here rather than silently applied, because a reader who remembers the table
should be able to see where it went.

### `holiday`

**System-wide, not per team**, and a row records the working status it forces on its date —
[ADR-015](../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | |
| `date` | date, not null, **unique** | One row per date. This makes *the status of date D* a function rather than a query, which the bridge-day derivation depends on. **Cost:** a date carrying two observances gets one row and one `name`. |
| `name` | text, not null | The human label — *"Nghỉ bù 30/4"*, *"Làm bù 2/9"*. The label, not the effect; `kind` carries the effect. |
| `kind` | `holiday_kind`, not null, default `non_working` | Enum: `non_working`, `working`. **The values name the effect on the working calendar, not the Vietnamese label**, because three labels (`nghỉ lễ`, `nghỉ bù`, `làm bù`) collapse to two effects. A `làm bù` mandated Saturday is `working` — a weekend day that counts as a working day, the exact inverse of a holiday. |
| `created_at` | timestamptz, not null | |

**There is no `team_id`.** Vietnamese public holidays and the announced swap days are national;
`.ai/registry/glossary.md` says *"Holidays belong to the calendar, not to any member"*, and INV-07
constrains entries and the members they belong to rather than a row that has neither. The select
policy is therefore `using (true)` to `authenticated` — correct here and a leak anywhere else in this
model, because a holiday row carries no member, no team and no personal data. Writes are
`public.is_admin((select auth.uid()))`, per the *Add, edit or delete a holiday or swap day* row in
[rbac-and-security.md](rbac-and-security.md).

Maintained by admins, including the swap and compensatory days the government announces each year
(brief §7.5). **A row with `kind = 'working'` is a holiday that is not a holiday** — the naming is a
known smell, recorded in ADR-015; `calendar_day` was available and lost because `holiday` is the
glossary's word and the permission table's word.

**Bridge-day detection is therefore a three-input computation** — non-working overrides, working
overrides, and the weekend rule. Thursday a holiday, Friday working, Saturday a mandated `làm bù`
working day: Friday is **not** a bridge day, and a two-input computation reports one.

### `notification`

**EVT-04, decided by
[ADR-050](../registry/decisions/ADR-050-in-app-notifications-for-events-are-written-by-the-database.md).**
One row per recipient per occurrence of something that happened to an event they can read. Written by
the database and by nothing else — seven `security definer` triggers on `event`, `event_invitee` and
`event_attendance`, through one definer function `public.notify` that no session may execute.
Migration: `supabase/migrations/20261008120000_evt04_notification.sql`.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid, pk | `gen_random_uuid()` |
| `recipient_id` | uuid, not null, fk `member(id)` | Restrict, as every reference to `member` is — a member row is never deleted (ADR-013). |
| `kind` | `notification_kind`, not null | Enum: `event_created`, `event_invited`, `event_updated`, `event_cancelled`, `attendance_requested`, `attendance_withdrawn`, `attendance_approved`, `attendance_rejected`, `attendance_removed`. |
| `event_id` | uuid, null, fk `event(id)` **on delete set null** | **The first `set null` in the schema, and chosen** (EVT-04 01-plan.md § 6): a notification must not cascade away with its event (ADR-050 § *Consequences*). `event_cancelled` is written null from the start. |
| `event_name` | text, not null | The event's name when the row was written — the snapshot that keeps a nulled row readable. |
| `actor_id` | uuid, not null, fk `member(id)` | Who caused it — `auth.uid()` at the write. Restrict. A write with no signed-in person writes no row. |
| `created_at` | timestamptz, not null, default `now()` | |
| `read_at` | timestamptz, null | Null while unread. The only column a session may update, through `mark_notifications_read` so it is the database's clock. |

Index `notification_recipient_created` on `(recipient_id, created_at desc)` serves the only two reads.
**Nothing prunes** (ADR-050 decision 6 forbids a scheduler); the panel reads the 50 newest.

## What is deliberately not stored

Two of the most-used numbers in the product are computed on read and have no column.

- **The absence count** (INV-04). Derived from the day's `pending` and `approved` entries — 1 per
  `full`, 0.5 per `am` or `pm`, PTO and WFH alike, rejected excluded. It is a decimal, and there is
  exactly one implementation of it, inside the seam.
- **Bridge days.** Computed from the holiday calendar and the weekend. A bridge day is an ordinary
  working day; storing it would create a second thing to keep true.

An overloaded day is likewise a comparison performed on read, not a flag.

## Relationships

| From | To | Cardinality | On delete |
|---|---|---|---|
| `member` | `team` | many-to-one | **Refuse.** No delete path exists for a team in v1. |
| `entry` | `member` | many-to-one | **Refuse.** A member is soft-deleted, never removed, so this constraint should never fire — and if it ever does, it is protecting INV-07 and the refusal is the correct outcome. |
| `entry.approved_by` | `member` | many-to-one, nullable | **Refuse**, for the same reason. Nulling it would erase who approved. |
| `holiday` | `team` | **none** | No foreign key. The calendar is system-wide — [ADR-015](../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md). |

**There is no cascade anywhere in this model, and that is a decision rather than an omission.** A
cascade nobody chose is one the database performs silently, and the invariant it breaks is discovered
by its absence.

## Where invariants are held

Under ADR-005 there is no server, so application code is in the same position as a UI affordance: the
same write is reachable by any token holder. Every structural invariant is therefore held by the
database.

| Invariant | Held by |
|---|---|
| INV-01 — no overlapping entries for one member | An exclusion constraint over `member_id`, `date_range` and `portion_slots`, so that `am` and `pm` on one day do not collide while `full` collides with both — [ADR-011](../registry/decisions/ADR-011-inv-01-exclusion-constraint.md), which also records that a rejected entry still occupies its portion and that nothing yet requires `end_date >= start_date`. **This is the one a read-then-write check cannot hold**: two tabs, two devices or a retry defeat it, and only the database sees both writes. |
| INV-02 — an edit revokes approval | `public.entry_enforce_decision()`, a `before update` trigger firing when `start_date`, `end_date`, `type`, `portion` or `tentative` change, and **not** when only `note` changes. **It clears `approved_by` and `approved_at` as well as resetting `status`** — a `pending` entry still naming its approver is the false record INV-02 exists to prevent ([ADR-011](../registry/decisions/ADR-011-inv-01-exclusion-constraint.md), consequences). It is **actor-blind**: an admin's edit under CAL-03 revokes approval exactly as the owner's does. **A substantive edit to a `rejected` entry also returns it to `pending` and clears `rejection_reason`** — INV-02 is silent on that case, and ADR-011 makes it the likely one, since a rejected entry still occupies its portion so editing it is the member's only route ([ADR-016](../registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md) §3). |
| Only an admin may decide an entry | **The same function**, and not a policy — [ADR-016](../registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md). An RLS `with check` sees the NEW row and has no OLD, so *"`status` did not change"* is not expressible, and a member PATCHing `{"status":"approved"}` against their own row satisfies CAL-02's own-entry policy. A column `grant` cannot help either: `member` and `admin` are the same PostgreSQL role, `authenticated`. The guard runs **first**, on the values the client sent, before the INV-02 reset above touches them. **`approved_by` and `approved_at` are written by the database from `auth.uid()` and `now()` and are never trusted from the wire** — the only audit trail v1 has was otherwise forgeable by any admin. |
| INV-03 — a rejection carries a reason | A check constraint tying `rejection_reason` to `status = 'rejected'`, in both directions. |
| INV-04 — one definition of the absence count | A single function inside the seam. Application-level by nature: it is a computation rather than a state constraint, and nothing can store a wrong value because nothing stores it at all. |
| INV-05 — tentative counts | Follows from INV-04 having one implementation; `tentative` is not consulted by it. |
| INV-06 — one portion per entry | Column shape: a single not-null enum, so a per-day portion is unrepresentable. |
| INV-07 — one member, every team they belong to (title until 2026-10-13: *one member, one team*) | Not-null foreign keys, and the refusals above — sufficient while a member has one team; MIR-10 redesigns it for several (ADR-059). |

TODO(project): cite the migration file and the constraint name for each row once migrations exist. A
row here naming a mechanism that has not been written is a claim, and `.ai/registry/invariants.md`
warns specifically that an invariant claimed and not held is worse than one never claimed.

## Migrations

Applying a migration is human (RULE-09). Drafting one is design work; running one is not. A ticket
whose `schema_delta` is anything but `none` needs an approved ADR linked before it can pass Definition
of Ready.

Supabase CLI migrations, per [tech-stack.md](tech-stack.md).

TODO(verify): where migrations live and the one command that applies them. The Supabase CLI is on the
*past reliable recall* list in `tech-stack.md`, so read its own documentation rather than writing the
path and the command from memory.

TODO(project): add the migrations directory to `.github/CODEOWNERS` once it exists. That file's own
`TODO(project)` already says so, and under ADR-005 the migrations are the security surface.

## Seed data

**Two different things, and conflating them is how a correction gets reverted.**

- **Production data** — the several years of national holidays the operator decided are seeded up
  front — ships as a **data migration**, `insert ... on conflict (date) do nothing`. Not
  `supabase/seed.sql`, which runs under `supabase db reset` and never reaches the hosted project.
  `do nothing` rather than `do update` is the load-bearing part: it lets an admin's correction of a
  government announcement survive re-application, where `do update` would silently overwrite the one
  piece of knowledge in that table no seed could have supplied.
  [ADR-015](../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md).

- **The test-and-development seed** is `supabase/seed.sql`, and `src/lib/fixtures.ts` is the shared
  fixture module holding the same literals so the two cannot drift — established in
  `.ai/board/tickets/TEA-01/02-design.md`. A test fixture that exists only in one test file drifts
  from the seed and produces failures that reproduce in CI and not locally.
  `.ai/standards/testing-standards.md` carries the matching marker for the shared fixture module.

  **It holds a small synthetic set, never the real calendar**: one `non_working` holiday, one
  compensatory day off, one `working` Saturday, one day that is a bridge day under them, and one year
  with no rows. A test asserting *"30/4/2026 is a bridge day"* asserts a fact about the world that an
  admin may correctly change.

## OPEN QUESTIONS

Per the *no invention* rule in `CLAUDE.md`. Each of these needs a name or a decision that could not be
taken from the glossary, the invariants or the brief. **None is blocking a design that does not touch
it**, and each says what it does block.

1. ~~**Is the holiday calendar per team, or national?**~~ **Answered 2026-08-31 by
   [ADR-015](../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md):**
   national. **No `team_id` and no foreign key.** The file's own framing above was right — the
   holidays and the announced swap days are national — and `.ai/registry/glossary.md` says
   *"Holidays belong to the calendar, not to any member"*. INV-07 does **not** force a column: it
   constrains entries and the members they belong to, and a holiday is neither.

   A not-null `team_id` was recommended and rejected, on the argument that without one the write
   policy narrows to `is_admin(auth.uid())` and at P2 any admin of any team rewrites everybody's Tết.
   That cost is real and accepted. It lost on the seed — a national set with `team_id not null` must
   either hard-code the v1 team's uuid or fan out over `select id from team`, and a set that must be
   re-inserted whenever a team is created is a mechanism nobody has designed — and on the migration
   asymmetry, which runs the opposite way from the assumption that *"the cheap answer now is the
   expensive migration later"*: **absent → nullable overlay is purely additive**, while **not-null →
   shared needs a fan-out or a dedup across N teams**. The nullable option was refused separately
   because `unique (team_id, date)` does not compare NULLs equal, so two national rows for one date
   would be permitted unless `nulls not distinct` — PostgreSQL 15+, and the major behind the hosted
   project is still unverified.

2. ~~**Is the kind of holiday recorded, and what are the values called?**~~ **Answered 2026-08-31 by
   [ADR-015](../registry/decisions/ADR-015-the-holiday-calendar-is-national-and-carries-a-kind.md):**
   yes, as a column. `kind holiday_kind not null default 'non_working'`, an enum of exactly two
   values — **`non_working` and `working`**. Under RULE-04 those names are now real. They name the
   effect on the working calendar rather than the Vietnamese label, because `name` already carries
   the label and three labels collapse to two effects; a three-value enum would invite a third code
   path that can never differ from one of the other two. Item 2 said *"Blocks: nothing yet"* — that
   stopped being true with the first story touching bridge days, because a `làm bù` working Saturday
   is unrepresentable without it and its absence makes the derivation report bridge days that do not
   exist.

3. ~~**The generated range column for INV-01.**~~ **Answered 2026-08-31 by
   [ADR-011](../registry/decisions/ADR-011-inv-01-exclusion-constraint.md):** two stored generated
   columns, `date_range` (`daterange`, built with the `'[]'` constructor because `end_date` is
   inclusive) and `portion_slots` (`int4range`, `full` → `[0,2)`, `am` → `[0,1)`, `pm` → `[1,2)`),
   with `EXCLUDE USING gist (member_id WITH =, date_range WITH &&, portion_slots WITH &&)` and the
   `btree_gist` extension. The question as written above overstated the need — an exclusion
   constraint would accept a bare expression; what requires named columns is PostgREST, which filters
   on columns and not expressions (ADR-005). Note that PostgreSQL canonicalises a stored discrete
   range to `[)`, so a one-day entry reads back as `['2026-01-01','2026-01-02')`.

4. ~~**How a `member` row comes into existence.**~~ **Answered 2026-08-31 by
   [ADR-009](../registry/decisions/ADR-009-how-a-person-becomes-a-member.md), and re-answered
   2026-09-10 by [ADR-033](../registry/decisions/ADR-033-a-person-joins-by-signing-up-and-an-admin-decides-afterwards.md),
   which supersedes it.** The person signs themselves up on the ordinary client and a trigger on
   `auth.users` creates the `member` row for **anybody** who confirms an address, with no team and
   `status = 'pending'`; an admin then approves or rejects them, and an approval writes the admin's
   own team. There is no invitation email under either answer — the admin tells the person by
   whatever channel the team already uses, and a story must say so rather than implying one arrives.
   ADR-009's answer — the allow-list, checked by the trigger before the row was created — is kept in
   ADR-009 itself rather than restated here; TEA-01 and TEA-02 were built against it and stay
   readable that way.

5. **Does `updated_at` distinguish an edit by the owner from an edit by an admin?** An admin may edit
   another member's entry and v1 has no change feed, so `approved_by` is the only trace of anything.
   An `updated_by` column would be the cheapest way to close known weakness 3 without waiting for the
   P1 feed. *Blocks:* nothing; it is a decision about how much trace v1 keeps.

## Multi-tenancy target schema (MIR-10, ADR-070)

Designed and approved in
[ADR-070](../registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md) under
[ADR-059](../registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md) before any
Phase 3 migration is written. Applied incrementally by MIR-11, MIR-12, MIR-14, MIR-16 and MIR-21.

### New enum: `team_role`

```sql
create type public.team_role as enum ('member', 'manager');
```

- Used on `public.membership.role_in_team` (default `'member'`).
- `public.member.role` (`public.member_role`) keeps its three values (`'member'`, `'manager'`,
  `'admin'`) during Phase 3 (MIR-11..MIR-15) while `public.membership` is backfilled (MIR-12) and
  policies are rewritten (MIR-13). In Phase 4 (MIR-16), `manager` moves to
  `membership.role_in_team`, `admin` is renamed to `org_admin` on `public.member_role`
  (`'member'`, `'org_admin'`), and `system_admin` lives in its own account store (MIR-18).

### `org`

One row per tenant organisation (`public.org`).

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid`, pk, default `gen_random_uuid()` | Tenant primary key referenced by `org_id` on every data table. |
| `org_code` | `text`, not null, unique (`org_org_code_key`) | Immutable URL slug (`/{org_code}`). Enforced by `org_code_shape`, `org_code_not_reserved`, and `BEFORE UPDATE` trigger `org_enforce_immutable_org_code` (raises SQLSTATE `42501` when `new.org_code is distinct from old.org_code`). |
| `name` | `text`, not null | Checked by `org_name_not_blank` (`btrim(name) <> ''`). |
| `is_shared_tenant` | `boolean`, not null, default `false` | `true` only for **Org public**, enforced as a singleton by partial unique index `org_one_shared_tenant_idx on public.org (is_shared_tenant) where is_shared_tenant = true`. |
| `max_members` | `integer`, null | Nullable commercial placeholder ([ADR-059](../registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md) § *Out of scope*). Checked by `org_max_members_positive` (`max_members is null or max_members >= 1`). |
| `max_teams` | `integer`, null | Nullable commercial placeholder (ADR-059 § *Out of scope*). Checked by `org_max_teams_positive` (`max_teams is null or max_teams >= 1`). |
| `plan` | `text`, null | Nullable commercial placeholder (ADR-059 § *Out of scope*). Checked by `org_plan_not_blank` (`plan is null or btrim(plan) <> ''`). |
| `licence_expires_at` | `timestamptz`, null | Nullable commercial placeholder (ADR-059 § *Out of scope*). |
| `timezone` | `text`, not null, default `'Asia/Ho_Chi_Minh'` | Checked by `org_timezone_not_blank` (`btrim(timezone) <> ''`). |
| `created_at` | `timestamptz`, not null, default `now()` | |

- **Shape constraint (`org_code_shape`):** `org_code ~ '^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$'`.
- **Reserved word constraint (`org_code_not_reserved`):** `org_code <> all (array[...])` containing
  all 29 reserved tokens — the 15 P3-1 tokens (`system`, `api`, `admin`, `login`, `signin`,
  `signup`, `app`, `static`, `public`, `assets`, `healthz`, `fonts`, `images`, `_next`,
  `index.html`) plus the 14 existing first-level SPA route segments (`signups`, `members`,
  `entries`, `month`, `week`, `year`, `setting`, `threshold`, `teams`, `reports`, `holidays`,
  `events`, `profile`, `guest`).
- **Seeded `Org public` row (MIR-12):** `is_shared_tenant = true`, `name = 'Org public'`,
  `org_code = 'shared'` (`'public'` is reserved because `public/` is the static asset directory),
  `timezone = 'Asia/Ho_Chi_Minh'`, and `max_members`, `max_teams`, `plan`, `licence_expires_at` all
  `null`.

### `membership`

N:M join between `public.member` and `public.team` within the same `public.org` (`public.membership`).

| Field | Type | Notes |
|---|---|---|
| `id` | `uuid`, pk, default `gen_random_uuid()` | |
| `org_id` | `uuid`, not null, fk `org(id)` on delete restrict | Shared by both composite FKs below so `member` and `team` must belong to the same org. |
| `team_id` | `uuid`, not null | Composite FK `membership_team_org_fk`: `(team_id, org_id) references public.team (id, org_id) on delete restrict`. |
| `member_id` | `uuid`, not null | Composite FK `membership_member_org_fk`: `(member_id, org_id) references public.member (id, org_id) on delete restrict`. |
| `role_in_team` | `public.team_role`, not null, default `'member'` | Per-team role (`'member'` or `'manager'`). |
| `is_primary` | `boolean`, not null, default `false` | At most one active primary team per member (`membership_one_active_primary_idx`). Checked by `membership_inactive_not_primary` (`left_at is null or is_primary = false`). |
| `joined_at` | `timestamptz`, not null, default `now()` | Start of membership window for INV-04. |
| `left_at` | `timestamptz`, null | End of membership window; `null` while active. Checked by `membership_left_after_joined` (`left_at is null or left_at >= joined_at`). Leaving a team sets `left_at := now()` and `is_primary := false` rather than deleting the row. |

- **Partial unique indexes:**
  - `membership_active_team_member_idx on public.membership (team_id, member_id) where left_at is null`
  - `membership_one_active_primary_idx on public.membership (member_id) where left_at is null and is_primary = true`
- **Supporting indexes:**
  - `membership_member_active_idx on public.membership (member_id, team_id) where left_at is null`
  - `membership_org_id_idx on public.membership (org_id)`
  - `membership_team_history_idx on public.membership (team_id, member_id, joined_at, left_at)`
- **MIR-12 backfill rule:** for every `public.member` row with `team_id is not null`, insert one
  `public.membership` row with `org_id = member.org_id`, `team_id = member.team_id`,
  `member_id = member.id`,
  `role_in_team = case when member.role = 'manager' then 'manager'::public.team_role else 'member'::public.team_role end`,
  `is_primary = true`, `joined_at = member.created_at`, and `left_at = member.removed_at`.

### Composite foreign keys and `org_id` across existing tables (MIR-11, MIR-12, MIR-14, MIR-21)

Every existing data table gains `org_id uuid not null references public.org (id) on delete restrict`
(added nullable, backfilled to `Org public`, then set `not null` in MIR-11 and MIR-12). Parent tables
`team`, `member` and `event` gain `unique (id, org_id)` so child composite FKs reject cross-org
references at the database level with SQLSTATE `23503`.

| Table | New / changed columns and unique keys | Composite foreign keys (`ON DELETE`) |
|---|---|---|
| `team` | `org_id uuid not null references public.org (id) on delete restrict`; `constraint team_id_org_id_key unique (id, org_id)` | — |
| `member` | `org_id uuid not null references public.org (id) on delete restrict`; `constraint member_id_org_id_key unique (id, org_id)`; `id` PK still references `auth.users (id)` (one org per user); `team_id` and `member_team_id_idx` dropped by MIR-21-f (2026-11-07); *until then: kept until MIR-21 drops both* | — |
| `entry` | `org_id uuid not null references public.org (id) on delete restrict`; `primary_team_id uuid not null`; `rejected_by uuid null`, `rejected_at timestamptz null`, `self_approved boolean not null default false` (MIR-14); keeps `member_id` and `entry_no_overlapping_portion` | `entry_member_org_fk`: `(member_id, org_id) -> member (id, org_id) on delete restrict`; `entry_primary_team_org_fk`: `(primary_team_id, org_id) -> team (id, org_id) on delete restrict`; `entry_approved_by_org_fk`: `(approved_by, org_id) -> member (id, org_id) on delete restrict`; `entry_rejected_by_org_fk` (MIR-14): `(rejected_by, org_id) -> member (id, org_id) on delete restrict` |
| `holiday` | `org_id uuid not null references public.org (id) on delete restrict`; drops `holiday_date_key` (`unique (date)`), adds `constraint holiday_org_id_date_key unique (org_id, date)`. Org public rows are the national set owned by `system_admin` (MIR-15); dedicated-org rows are seeded from the national set on org creation (MIR-18) and maintained by `org_admin` (MIR-16) | — |
| `busy_day` | `org_id uuid not null references public.org (id) on delete restrict` | `busy_day_member_org_fk`: `(member_id, org_id) -> member (id, org_id) on delete restrict` |
| `issue_report` | `org_id uuid not null references public.org (id) on delete restrict` | `issue_report_member_org_fk`: `(member_id, org_id) -> member (id, org_id) on delete restrict` |
| `event` | `org_id uuid not null references public.org (id) on delete restrict`; `constraint event_id_org_id_key unique (id, org_id)` | `event_creator_org_fk`: `(creator_id, org_id) -> member (id, org_id) on delete restrict`; `event_team_org_fk`: `(team_id, org_id) -> team (id, org_id) on delete restrict` |
| `event_invitee` | `org_id uuid not null references public.org (id) on delete restrict` | `event_invitee_event_org_fk`: `(event_id, org_id) -> event (id, org_id) on delete cascade`; `event_invitee_member_org_fk`: `(member_id, org_id) -> member (id, org_id) on delete restrict` |
| `event_attendance` | `org_id uuid not null references public.org (id) on delete restrict` | `event_attendance_event_org_fk`: `(event_id, org_id) -> event (id, org_id) on delete cascade`; `event_attendance_member_org_fk`: `(member_id, org_id) -> member (id, org_id) on delete restrict` |
| `event_guest_link` | `org_id uuid not null references public.org (id) on delete restrict` | `event_guest_link_event_org_fk`: `(event_id, org_id) -> event (id, org_id) on delete cascade` |
| `event_guest` | `org_id uuid not null references public.org (id) on delete restrict` | `event_guest_event_org_fk`: `(event_id, org_id) -> event (id, org_id) on delete set null (event_id)` (column-specific `SET NULL (event_id)` preserves `org_id not null`) |
| `notification` | `org_id uuid not null references public.org (id) on delete restrict` | `notification_recipient_org_fk`: `(recipient_id, org_id) -> member (id, org_id) on delete restrict`; `notification_actor_org_fk`: `(actor_id, org_id) -> member (id, org_id) on delete restrict`; `notification_event_org_fk`: `(event_id, org_id) -> event (id, org_id) on delete set null (event_id)` |

### Temporal multi-team absence count (INV-04, INV-07)

- **Single definition preserved (INV-04):** `absenceCountsFor` in `src/lib/data/absence.ts` remains
  the sole function in the system that computes the absence count. No SQL view, RPC or second
  TypeScript helper computes it.
- **Per-team temporal membership predicate (INV-04, INV-07):** an entry of `member_id = M` is
  counted in team `T` on calendar date `d` (`yyyy-MM-dd`) if and only if:
  1. `entry.status <> 'rejected'` (`'pending'` or `'approved'`),
  2. `d` is in `[entry.start_date, entry.end_date]`,
  3. `M` has `member.status = 'approved'` and `(member.removed_at is null or member.removed_at::date > d)`, and
  4. `M` has a `public.membership` row for `team_id = T` with
     `joined_at::date <= d and (left_at is null or left_at::date > d)` (evaluated in
     `src/lib/data/absence.ts` using ISO-8601 `slice(0, 10)` string comparison).
- Because `public.entry` is keyed on `member_id` (INV-07) and team membership is N:M through
  `public.membership`, a multi-team member's entry is counted in every team whose membership window
  `[joined_at::date, left_at::date)` covers `d`.
