---
ticket: MIR-20
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-12T07:10:00Z
inputs_read:
  - .ai/board/tickets/MIR-20/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md
  - .ai/registry/decisions/ADR-093-a-system-admin-moves-one-team-out-of-org-public-and-every-link-to-a-person-who-stays-is-cut.md
  - .ai/registry/decisions/ADR-065-role-changes-are-own-team-promotion-is-its-own-action-and-every-change-is-recorded.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/plans/multi-tenancy-status.md
  - .ai/00-charter.md
  - .ai/01-operating-model.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/plan.md
  - .ai/board/tickets/MIR-15-c/ticket.yaml
  - .ai/board/tickets/MIR-19/01-plan.md
  - src/lib/data/system.ts
  - src/system/main.tsx
  - src/lib/fixtures.ts
  - src/index.css
  - supabase/migrations/20261104150000_mir18_system_admin.sql
  - supabase/migrations/20261105120000_mir18b_org_management.sql
  - supabase/migrations/20261108200000_mir16h_member_role_drops_manager.sql
  - supabase/migrations/20261107230000_mir16b_is_org_admin.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/190-system-admin.test.sql
  - tests/e2e/mir-15-c-move-team.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-20 — system_admin impersonation (first slice: start, banner, end, and the roster read, in the panel)

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:309`):

| ID | Feature | Group |
|---|---|---|
| MIR-20 | system_admin impersonation is read-only, time-boxed, reasoned and logged, and visible to the org it touched | MIR |

**Plan item:** Phase 6, *Impersonation and audit* (`.ai/board/plans/calechip-multi-tenancy-plan.md:287-305`).
Exit criteria there: *"No path gives `system_admin` org data outside a logged session"* and *"Every
impersonation is visible to the org it touched"*.

**The split, ADR-100 decision 8 (written at this PLAN).** Phase 6 whole is three operations on two
surfaces: start/read/end in the system panel, the org reading its log in the member app, and an org's
calendar read under impersonation. Together they are well over 12 files (§ 7). This ticket is the
first slice; **MIR-20-b** (the touched org reads the log) and **MIR-20-c** (an org's calendar under a
live impersonation) are created at this PLAN as `BACKLOG` tickets sharing this feature row.

**Who gains what.** A system admin, signed in to the system panel at `aal2`, can open a support
session on one org — or, in Org public, on one team of it — by stating a reason and choosing a box of
30, 45 or 60 minutes. While the session is live, the panel carries a banner saying so and can read
that org's (or team's) roster. The session ends when the system admin ends it or when the database
clock passes its end, whichever is first, and every start, read and end is written to a log the
system admin cannot edit. Until now a system admin has no way to look at a customer's people at all;
from now they have exactly one, and it leaves a trace. The trace becomes visible to the customer in
MIR-20-b.

**Out of scope:**

- **The org reading its log** — MIR-20-b. In this ticket nobody in any org can read
  `public.impersonation` or `public.impersonation_action`; the log is written and held, not shown.
- **Reading an org's calendar, entries, events, holidays or settings under impersonation**, and any
  "acting as" in the member app (`useSession.ts`, `supabase.ts` identity resolution) — MIR-20-c.
- **Writing anything as or for the impersonated org.** Not deferred: refused, permanently, by
  ADR-100 decision 2.
- **Extending a live session.** A new session with a new reason is the only way past the box
  (ADR-100 decision 3).
- **Impersonating Org public as a whole.** Only one team of it (ADR-100 decision 5).
- **The reads a system admin already has** — `list_issue_reports` (author names and messages),
  `list_shared_teams` (member counts), the sign-up queue and holidays (ADR-075, ADR-079, ADR-082,
  ADR-093). They are decided system scope and are not routed through impersonation here.
- **Member e-mail addresses in the roster.** The roster carries names, rank, status and teams.
- **A clock job that writes an `end` action at expiry.** An expired session's end is its
  `expires_at` (ADR-100 § Consequences).
- **`.ai/standards/rbac-and-security.md` A15** — the standards plane is human-only; the weakness
  stays listed until MIR-20-c ships the "acting as" half.
- **Applying the migration to the hosted project** — a person's step (RULE-09).

`size_estimate`: **M**.

## 2. Acceptance criteria

Terms used below. **Live session:** a `public.impersonation` row of the caller with `ended_at is null`
and `expires_at > now()`. **System admin:** a caller with a `public.system_admin` row whose JWT carries
`aal = 'aal2'` (`public.is_system_admin()`). **The mock panel:** the panel built with the mock seam,
signed in as `ops@calechip.test` / `calechip-demo` / code `246810`, as `tests/e2e/mir-15-c-move-team.spec.ts`
signs in; it holds Org public (teams `CaleChip` and `Nhóm khác`) and the dedicated org `Acme Studio`.

### The panel (mock build, e2e)

**AC-1 — start a session on a dedicated org**
- Given the mock panel, signed in, with no live session
- When the system admin presses `system-org-impersonate` on the `Acme Studio` row, types
  `Customer ticket 4411` into `system-impersonate-reason`, leaves `system-impersonate-minutes` at its
  default, and presses `system-impersonate-submit`
- Then `system-impersonation-banner` is visible at the top of the signed-in panel, and
  `system-impersonation-org` reads `Acme Studio`, `system-impersonation-reason` reads
  `Customer ticket 4411`, and `system-impersonation-left` reads `30 min left`
- And `system-roster` is visible, showing `system-roster-empty` (the mock's Acme Studio has no members)
- And the form for a dedicated org shows no `system-impersonate-team`, and
  `system-impersonate-minutes` offers exactly `30`, `45` and `60` minutes, `30` selected.

**AC-2 — Org public needs a team, and the roster is that team's**
- Given the mock panel, signed in, with no live session
- When the system admin presses `system-org-impersonate` on the `Org public` row
- Then `system-impersonate-team` is shown, listing `CaleChip` and `Nhóm khác`, with nothing chosen,
  and `system-impersonate-submit` is disabled until a team is chosen
- When they choose `CaleChip`, type a reason, choose `60`, and submit
- Then `system-impersonation-org` reads `Org public — CaleChip`, `system-impersonation-left` reads
  `60 min left`, and `system-roster` lists exactly three `system-roster-row`s, by name in order
  `Đã duyệt`, `Quản trị`, `Thành viên`, each with `system-roster-teams` reading `CaleChip`
- And `Người nhóm khác` (a member of `Nhóm khác`) is not listed.

**AC-3 — a blank reason is refused, and nothing starts**
- Given the open form of AC-1
- When the reason is left empty, or holds only spaces, and `system-impersonate-submit` is pressed
- Then `system-impersonate-error` reads `A reason is required, up to 500 characters.`, the form stays
  open, and no `system-impersonation-banner` is shown.

**AC-4 — one session at a time**
- Given a live session (AC-1)
- Then no `system-org-impersonate` button is shown on any org row
- And the banner stays at the top of the viewport while the panel is scrolled to the issue reports at
  its foot.

**AC-5 — ending a session**
- Given a live session (AC-1)
- When the system admin presses `system-impersonation-end`
- Then `system-impersonation-banner` and `system-roster` are gone, and `system-org-impersonate` is
  shown again on every org row.

**AC-6 — the box closes on its own**
- Given a live 30-minute session (AC-1)
- When 31 minutes pass on the page's clock
- Then within 30 seconds `system-impersonation-banner` and `system-roster` are gone, and
  `system-impersonation-expired` reads `The impersonation session has ended.`

**AC-7 — signing out ends the session**
- Given a live session (AC-1)
- When the system admin presses `system-signout`, then signs in again with the same account and code
- Then no `system-impersonation-banner` is shown.

### The database (pgTAP, `supabase/tests/390-impersonation.test.sql`)

**AC-8 — only a system admin at `aal2` starts, reads, ends or sees a session**
- Given an approved member, an `org_admin` of a dedicated org, and a system admin signed in at `aal1`
- When each calls `start_impersonation`, `current_impersonation`, `impersonated_roster` and
  `end_impersonation`
- Then each call raises `42501`, and no row is written to `public.impersonation` or
  `public.impersonation_action`.

**AC-9 — the start refuses a bad target, box or reason**
- Given a system admin at `aal2` with no live session
- When `start_impersonation` is called with:
  - `p_minutes` of `29`, `61` or null → `22023`
  - an org id that does not exist → `P0002`
  - Org public and a null `p_team_id` → `22023`
  - Org public and a team of a dedicated org → `P0002`
  - a dedicated org and a non-null `p_team_id` → `22023`
  - a reason that is empty, only spaces, or 501 characters after trimming → `23514`; a null reason →
    `23502`
- Then each raises the code given, and no row is written to either table.

**AC-10 — a start writes the session and the log**
- Given a system admin at `aal2`, with no live session
- When they call `start_impersonation(<dedicated org>, null, '  Customer ticket 4411  ', 45)`
- Then it returns the new row's id; that row has `actor_id` = the caller, `actor_email` = the
  caller's `auth.users.email`, `org_id` = the org, `team_id` and `team_name` null, `reason` =
  `Customer ticket 4411`, `expires_at = started_at + 45 minutes`, `ended_at` null
- And exactly one `public.impersonation_action` row exists for it, with `action = 'start'`
- And `current_impersonation()` returns exactly that session, with the org's `org_code` and `name`.
- And for Org public and one of its teams, the row carries that `team_id` and the team's name in
  `team_name`.

**AC-11 — a second start while live is refused**
- Given the live session of AC-10
- When the same system admin calls `start_impersonation` again, for any org
- Then it raises `IM001`, and the first session is unchanged.

**AC-12 — the database clock ends a session**
- Given a session of the caller whose `expires_at` is in the past and `ended_at` is null
- When the caller calls `current_impersonation()` and `impersonated_roster()`
- Then the first returns no row, the second raises `42501`, and no `read_roster` action is written
- When the caller then calls `start_impersonation` for another org
- Then it succeeds, and the expired row's `ended_at` equals its `expires_at`.

**AC-13 — ending a session**
- Given the live session of AC-10
- When the caller calls `end_impersonation()`
- Then that row's `ended_at` is set, one `end` action is written, `current_impersonation()` returns no
  row, and `impersonated_roster()` raises `42501`
- And a further `end_impersonation()` with no live session returns without error and writes nothing.

**AC-14 — the roster is the impersonated org's, or team's, and every read is logged**
- Given two dedicated orgs A and B with members, a removed member in A, a member of A on two teams,
  and in Org public two teams with a member on both
- When a system admin with a live session on A calls `impersonated_roster()`
- Then it returns every member of A whose `removed_at` is null, any status, and no member of B or of
  Org public; the removed member is absent; the two-team member's `team_names` holds both team names,
  sorted; a member with no active membership has `team_names = '{}'`
- And with a live session on one team of Org public, it returns only the members with an active
  membership on that team, and the member on both teams has `team_names` holding that team's name
  only
- And each call writes exactly one `read_roster` action for that session.

**AC-15 — a live session cannot write**
- Given a system admin with a live session on org A
- When they insert an `entry`, update a `member`, delete a `membership`, update a `team` of A, and call
  `create_team`, `admit_member` and `set_member_role` against A
- Then each insert raises `42501` or each update and delete affects zero rows, each RPC raises
  `42501`, and A's rows are unchanged.

**AC-16 — no read of org data outside the roster, live or not**
- Given a system admin at `aal2`, first with no session and then with a live session on A
- When they `select` from `public.entry`, `public.member`, `public.membership` and `public.team`
- Then each returns zero rows in both cases.

**AC-17 — the log is closed to every caller and append-only**
- Given `anon`, an approved member, an `org_admin` and a system admin at `aal2`
- When each tries `select`, `insert`, `update` or `delete` on `public.impersonation` or
  `public.impersonation_action`
- Then each raises `42501`.

**AC-18 — the log outlives its actor, and does not pin a team**
- Given a system admin who has started and ended a session on a team of Org public
- When a person deletes that `public.system_admin` row, and `move_team_to_org` moves that team into a
  dedicated org
- Then both succeed, and the session row and its action rows are unchanged.

**AC-19 — the census**
- Given `010-catalogue.test.sql`
- Then its definer census lists the five functions of § 4.1 and passes.

**Invariants touched.** `[]`. No entry, absence count, approval or portion is read or written by this
ticket: the roster reads `member`, `membership` and `team` only, and every write is to the two new
tables. INV-04 and INV-07 are not touched — the roster's teams are informational, not an absence count.

**Open questions.** None that blocks. Two values are this plan's own, within ranges a source gives:
the offered boxes are 30, 45 and 60 minutes (the plan says *"30–60 min"*), and the reason's upper
bound is 500 characters (the plan says only *"a stated reason"*). Either can change in MIR-20-b
without touching this design's shape.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image is in `.ai/board/tickets/MIR-20/` and no idea file promotes this ticket. The arrangement:

- **Banner** — inside `system-signed-in`, first child, `sticky top-0 z-10`, full width,
  `rounded-2xl border-2 border-primary bg-card px-4 py-3`. One line: **Impersonating**
  `system-impersonation-org` · `read-only` · `system-impersonation-left`, with
  `system-impersonation-end` (*End now*, the panel's small secondary button) at the right. A second
  line, `text-sm text-ink-2`: `system-impersonation-reason`. No meaning token (`pto`, `overload`, …)
  is spent on it: those name calendar facts.
- **Roster** — a `section` directly under the banner, `system-roster`, heading *Roster —
  {org label}*; a table like the orgs table, columns *Name*, *Rank*, *Status*, *Teams*. Empty state
  `system-roster-empty`: *Nobody in this org yet.* Error `system-roster-error` with
  `system-roster-retry`.
- **Start** — an *Impersonate* text button, `system-org-impersonate`, in each org row's action cell
  beside *Edit*. It opens `system-impersonate-form` as a full-width row under that org row, as the
  edit form opens: the team select (Org public only), the reason textarea (3 rows, `maxLength`
  500), the minutes select, then *Start* and *Cancel*.
- **Expired notice** — `system-impersonation-expired`, `role="status"`, `text-sm text-ink-2`, where
  the banner was, until the next start.

## 3. Permission model

The server side is the control everywhere below; the panel's hiding of a button is an affordance.

| Action | Who may | Where the check lives | Who must not |
|---|---|---|---|
| Start a session | system admin (`is_system_admin()`: row + `aal2`) | `start_impersonation`, first statement, `42501` | member, manager, `org_admin`, a system admin at `aal1`, `anon` |
| See the own live session | the same system admin | `current_impersonation`, `42501`; the row is the caller's (`actor_id = auth.uid()`) | anybody else, including another system admin |
| Read the roster | a system admin **with a live session**, for that session's org or team | `impersonated_roster` via `impersonated_org_id()` | a system admin with no live session or an expired one; everybody else |
| End the own session | the same system admin | `end_impersonation`, `42501` | anybody else; nobody ends another's session |
| Read or write either log table | **nobody** through the API | `revoke all … from anon, authenticated`; RLS enabled with no policy | every role, including system admins and `org_admin` (MIR-20-b adds the org's read) |
| Write any org data under a session | **nobody** | no write path accepts a session (ADR-100 decision 2); a system admin has no `member` row, so `entry_insert_own`, `member_update_*`, and every `is_org_admin`-gated RPC refuse | system admins, live session or not |

The panel's `system-org-impersonate` is hidden while a session is live (AC-4); the database's `IM001`
is what refuses (AC-11). The panel's countdown is a display; `impersonated_org_id()` comparing
`expires_at` to `now()` is what ends the session (AC-12).

## 4. Contract

### 4.1 Migration `supabase/migrations/20261112180000_mir20_impersonation.sql`

Idempotent (ADR-024): `if not exists`, `create or replace`, grants restated. One `begin; … commit;`.

```sql
create table if not exists public.impersonation (
  id          uuid        primary key default gen_random_uuid(),
  actor_id    uuid        not null,          -- auth.uid() at start. No FK: ADR-100 decision 7
  actor_email text        not null,          -- snapshot of auth.users.email at start
  org_id      uuid        not null references public.org (id) on delete restrict,
  team_id     uuid        null,              -- Org public's team. No FK: AC-18 (move, delete_team)
  team_name   text        null,              -- snapshot of team.name at start
  reason      text        not null,
  started_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  ended_at    timestamptz null,
  constraint impersonation_reason_length check (char_length(btrim(reason)) between 1 and 500),
  constraint impersonation_box check (expires_at >= started_at + interval '30 minutes'
                                  and expires_at <= started_at + interval '60 minutes'),
  constraint impersonation_ended_after_start check (ended_at is null or ended_at >= started_at),
  constraint impersonation_team_named check ((team_id is null) = (team_name is null))
);
create unique index if not exists impersonation_one_open_per_actor_idx
  on public.impersonation (actor_id) where ended_at is null;

create table if not exists public.impersonation_action (
  id               uuid        primary key default gen_random_uuid(),
  impersonation_id uuid        not null references public.impersonation (id) on delete restrict,
  action           text        not null,
  at               timestamptz not null default now(),
  constraint impersonation_action_known check (action in ('start', 'end', 'read_roster'))
);
create index if not exists impersonation_action_impersonation_id_idx
  on public.impersonation_action (impersonation_id);

alter table public.impersonation        enable row level security;   -- no policy, deliberately
alter table public.impersonation_action enable row level security;   -- no policy, deliberately
revoke all on table public.impersonation        from public, anon, authenticated;
revoke all on table public.impersonation_action from public, anon, authenticated;
```

Five functions, every one `security definer set search_path = ''`, every one
`revoke all … from public, anon; grant execute … to authenticated;`.

```sql
-- The one place "live" is defined (ADR-100 decision 1). Null unless the caller is a system admin
-- with a row where ended_at is null and expires_at > now().
create or replace function public.impersonated_org_id() returns uuid
  language sql stable security definer set search_path = '';

-- 42501 not a system admin; 22023 p_minutes null or outside 30..60, or the team rule of ADR-100
-- decision 5 broken; P0002 org missing, or (Org public) the team is not a team of that org;
-- 23514 / 23502 reason (the table's checks; the function stores btrim(p_reason));
-- IM001 a live session exists (also 23505 from the unique index under a race — the seam maps both).
-- Order: gate, minutes, org, team, close the caller's expired open rows (ended_at = expires_at),
-- refuse a live one, insert the session (expires_at = now() + make_interval(mins => p_minutes)),
-- insert action 'start', return the id.
create or replace function public.start_impersonation(
  p_org_id uuid, p_team_id uuid, p_reason text, p_minutes integer
) returns uuid
  language plpgsql volatile security definer set search_path = '';

-- 42501 not a system admin. Closes the caller's expired open rows (ended_at = expires_at); if a live
-- session exists sets ended_at = now() and writes action 'end'. No live session: returns, writes nothing.
create or replace function public.end_impersonation() returns void
  language plpgsql volatile security definer set search_path = '';

-- 42501 not a system admin. Zero or one row: the caller's live session. Writes nothing.
create or replace function public.current_impersonation()
  returns table (
    id         uuid,
    org_id     uuid,
    org_code   text,
    org_name   text,
    team_id    uuid,
    team_name  text,
    reason     text,
    started_at timestamptz,
    expires_at timestamptz
  )
  language plpgsql stable security definer set search_path = '';

-- 42501 not a system admin, or impersonated_org_id() is null — raised BEFORE any write.
-- Then inserts action 'read_roster' and returns, ordered by display_name, id:
--   dedicated org (session team_id null): every member with org_id = the session's org and
--     removed_at null; team_names = names of that member's memberships with left_at null and
--     org_id = the session's org, sorted, '{}' when none.
--   Org public (team_id set): members with removed_at null and a membership on that team with
--     left_at null and org_id = the session's org; team_names = array[current name of that team].
create or replace function public.impersonated_roster()
  returns table (
    member_id    uuid,
    display_name text,
    member_role  text,   -- member.role::text: 'member' | 'org_admin'
    status       text,   -- member.status::text: 'pending' | 'approved' | 'rejected'
    team_names   text[]
  )
  language plpgsql volatile security definer set search_path = '';
```

### 4.2 Seam `src/lib/data/system.ts` — additions only

Four methods on `SystemSeam`, implemented in both `supabaseSystemSeam` and `mockSystemSeam`. No
existing signature changes. `src/lib/domain/types.ts` is not edited; every type is local to this
module, as the panel's other failure codes are.

```ts
// MIR-20 — impersonation. 01-plan.md § 4.2, ADR-100.
export type ImpersonationMinutes = 30 | 45 | 60;
export const IMPERSONATION_MINUTES: readonly ImpersonationMinutes[] = [30, 45, 60];
export const IMPERSONATION_REASON_MAX = 500;

export interface StartImpersonationInput {
  orgId: string;
  teamId: string | null; // a team of Org public; null for a dedicated org
  reason: string;        // sent as typed; the RPC trims
  minutes: ImpersonationMinutes;
}

/** One row of `public.current_impersonation()`. */
export interface Impersonation {
  id: string;
  orgId: string;
  orgCode: string;
  orgName: string;
  teamId: string | null;
  teamName: string | null;
  reason: string;
  startedAt: string; // ISO 8601
  expiresAt: string; // ISO 8601
}

/** One row of `public.impersonated_roster()`. */
export interface ImpersonatedRosterRow {
  memberId: string;
  displayName: string;
  memberRole: string; // 'member' | 'org_admin', shown as written
  status: string;     // 'pending' | 'approved' | 'rejected', shown as written
  teamNames: string[];
}

export type ImpersonationFailureCode =
  | "not_permitted"                // 42501
  | "impersonation_target_missing" // P0002
  | "invalid_impersonation"        // 22023
  | "reason_required"              // 23514, 23502
  | "already_impersonating"        // IM001, 23505
  | "network";                     // anything else, or a throw

export type ImpersonationResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: ImpersonationFailureCode; message: string } };

export const IMPERSONATION_FAILURE_MESSAGES: Record<ImpersonationFailureCode, string> = {
  not_permitted: "You do not have permission to do that, or the impersonation session has ended.",
  impersonation_target_missing: "That org or team no longer exists. Reload to see the current list.",
  invalid_impersonation: "Choose 30, 45 or 60 minutes, and a team when the org is Org public.",
  reason_required: "A reason is required, up to 500 characters.",
  already_impersonating: "An impersonation session is already open. End it first.",
  network: "Could not reach the server. Try again.",
};

// On SystemSeam:
  /** `rpc("current_impersonation")`, first row or null. Never throws. MIR-20. */
  currentImpersonation(): Promise<ImpersonationResult<Impersonation | null>>;
  /** `rpc("start_impersonation", { p_org_id, p_team_id, p_reason, p_minutes })`. Value is the id. Never throws. */
  startImpersonation(input: StartImpersonationInput): Promise<ImpersonationResult<string>>;
  /** `rpc("end_impersonation")`. Never throws. */
  endImpersonation(): Promise<ImpersonationResult<null>>;
  /** `rpc("impersonated_roster")`, mapped to camelCase. Never throws. */
  impersonatedRoster(): Promise<ImpersonationResult<ImpersonatedRosterRow[]>>;
```

Private helpers, named so: `impersonationRefusal(code)`, `impersonationFailureCode(error)`,
`toImpersonation(row: ImpersonationRpcRow)`, `toRosterRow(row: RosterRpcRow)`.

**`signOut()` changes behaviour, not signature:** both implementations call `endImpersonation()`
first, ignore its result, then sign out as today (AC-7).

**The mock** mirrors the database's checks, in module state reset on reload, like `mockOrgs`:

- `mockImpersonation: Impersonation | null`; live while `Date.parse(expiresAt) > Date.now()` (so
  Playwright's `page.clock` drives AC-6). `startedAt` and `expiresAt` from `Date.now()`.
- Refusals in the database's order: not `mockMaySeeOrgs()` → `not_permitted`; minutes not in
  `IMPERSONATION_MINUTES` → `invalid_impersonation`; org not in `mockOrgs` → `impersonation_target_missing`;
  shared org with null team, or dedicated org with a team → `invalid_impersonation`; shared org and a
  team not in `mockSharedTeams` → `impersonation_target_missing`; trimmed reason empty or longer than
  `IMPERSONATION_REASON_MAX` → `reason_required`; live session → `already_impersonating`.
- `mockRosters`: `FIXTURE_TEAM.id` → three rows built from `FIXTURE_APPROVED_MEMBER`,
  `FIXTURE_ADMIN` and `FIXTURE_MEMBER` (`displayName` and `id` from the fixture; `memberRole`
  `'org_admin'` for `FIXTURE_ADMIN`, `'member'` otherwise; `status` `'approved'`; `teamNames`
  `[FIXTURE_TEAM.name]`); `FIXTURE_OTHER_TEAM.id` → one row from `FIXTURE_OTHER_TEAM_MEMBER`; the
  dedicated `acme` org → `[]`. Rows returned sorted by `displayName` (`localeCompare`, `"vi"`).
- `endImpersonation()` clears `mockImpersonation`; `signOut()` calls it.

### 4.3 Panel `src/system/main.tsx`

New components in the same file, as MIR-15-c added `SharedTeams`: `ImpersonationBanner`,
`ImpersonatedRoster`, `StartImpersonationForm`. `OrgManagement` holds the live session:
`useState<Impersonation | null>`, loaded with `currentImpersonation()` on mount, and re-read when the
countdown reaches zero. The countdown re-renders every 15 seconds:
`Math.max(0, Math.ceil((Date.parse(expiresAt) - Date.now()) / 60000))`, shown as `` `${n} min left` ``.
At zero it calls `currentImpersonation()`; a `null` clears the session and shows the expired notice. A
roster read that returns `not_permitted` does the same.

Org label: `orgName` for a dedicated org, `` `${orgName} — ${teamName}` `` for Org public.

Every `data-testid` this ticket adds:

| `data-testid` | Element |
|---|---|
| `system-org-impersonate` | *Impersonate* button in each org row; absent while a session is live |
| `system-impersonate-form` | the start form row; `data-org-code` = the row's code |
| `system-impersonate-team` | team `select`, Org public only, first option empty, options from `listSharedTeams()` |
| `system-impersonate-reason` | reason `textarea` |
| `system-impersonate-minutes` | minutes `select`, options `30` `45` `60` (labels `30 minutes` …), default `30` |
| `system-impersonate-submit` | *Start*; disabled while busy, and for Org public while no team is chosen |
| `system-impersonate-cancel` | *Cancel* |
| `system-impersonate-error` | `role="alert"`, the failure message |
| `system-impersonation-banner` | the sticky banner; `data-expires-at` = `expiresAt` |
| `system-impersonation-org` | the org label |
| `system-impersonation-left` | `N min left` |
| `system-impersonation-reason` | the reason |
| `system-impersonation-end` | *End now* |
| `system-impersonation-expired` | the expired notice |
| `system-roster` | the roster section |
| `system-roster-loading` | `role="status"` while loading |
| `system-roster-empty` | *Nobody in this org yet.* |
| `system-roster-error` / `system-roster-retry` | failure and retry |
| `system-roster-row` | one row; `data-member-id` |
| `system-roster-name` / `system-roster-rank` / `system-roster-status` / `system-roster-teams` | cells; teams joined with `, ` |

### 4.4 Tests

- `supabase/tests/390-impersonation.test.sql` — AC-8 to AC-18. Defines its own
  `tests.authenticate_at(uuid, text)` as `190-system-admin.test.sql` does; `_isolation.psql` is not
  edited. AC-12's expired row is inserted by the test as the owner with `started_at = now() - 2 hours`,
  `expires_at = now() - 90 minutes`.
- `supabase/tests/010-catalogue.test.sql` — the census gains, under `-- MIR-20, 390-impersonation.test.sql`:
  `'public.impersonated_org_id()'`, `'public.start_impersonation(uuid,uuid,text,integer)'`,
  `'public.end_impersonation()'`, `'public.current_impersonation()'`, `'public.impersonated_roster()'`.
- `tests/e2e/mir-20-impersonation.spec.ts` — AC-1 to AC-7 against the mock build; AC-6 uses
  `page.clock.install()` before `goto` and `page.clock.fastForward("31:00")`.

## 5. Seam impact

The member seam (`src/lib/data/index.ts`, `supabase.ts`, `mock.ts`) is **not touched**; seam parity
is unaffected. The panel's own seam `src/lib/data/system.ts` gains four methods (§ 4.2), in both of its
implementations, and `signOut()` in both gains a call to `endImpersonation()`. No existing method's
signature changes. The `supabase-client-in-seam` lint rule (RULE-02) is satisfied: the RPC calls use
the module's existing `client()`.

## 6. Schema delta

**Not `none`** — ADR-100, accepted at this PLAN under ADR-067. Two tables (`public.impersonation`,
`public.impersonation_action`), one partial unique index, one index, RLS enabled with no policy and
every table privilege revoked, and five `security definer` functions (§ 4.1). No existing table,
column, policy, trigger or function changes. Applying the migration to the hosted project is a
person's step (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-100-impersonation-is-a-logged-time-boxed-session-that-unlocks-definer-reads-only.md"
  - ".ai/board/tickets/MIR-20-b/ticket.yaml"
  - ".ai/board/tickets/MIR-20-c/ticket.yaml"
  - "supabase/migrations/20261112180000_mir20_impersonation.sql"
  - "supabase/tests/390-impersonation.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "src/lib/data/system.ts"
  - "src/system/main.tsx"
  - "tests/e2e/mir-20-impersonation.spec.ts"
```

9 paths, `size: M`, agreeing with `size_estimate: M`. The three board and registry paths are written
at this PLAN; the Developer writes the other six. As Phase 6 was written it was well past 12 files —
the member app's admin screens, routes and three seam files for the org's log, and the identity
resolution and read policies for the calendar — so it splits here (ADR-100 decision 8). The sizing
table reads *"changes the schema"* as `XL`; this follows the MIR precedent (MIR-15-c, MIR-19): a
schema change carried by an ADR written under ADR-067 is sized by its file count.
`glossary_owed` is `[]`, so no glossary row is written. *Impersonation* has no row; the System admin
row already says impersonation *"does not exist until MIR-20"* — that row is now stale, and rewriting
it is a registry change for the steward, not a PLAN output.

## 8. Rejected alternatives

- **A time-boxed custom JWT claim**, as the plan's checklist suggests. Rejected: the token lives
  until refresh, so ending early needs revocation, the box is only as precise as the token lifetime,
  and a claim cannot write the log. A row checked against `now()` on each call is server-side expiry
  and the log at once (ADR-100, Options).
- **Widening the member-app read policies with `or org_id = public.impersonated_org_id()`** so the
  system admin uses the member app's own screens. Genuinely plausible — it gives the calendar for
  free. Rejected here: it touches every read policy at once, and a policy cannot log, so the first
  `select` would be an unlogged read and the exit criterion would fail. MIR-20-c decides the
  calendar read within ADR-100 decisions 1 and 2.
- **Building the org's read surface in the member app first** (a system admin signs in there and
  sees an "acting as" banner). Rejected for the first slice: the member app's identity resolution
  assumes a `member` row (`useSession.ts`), the panel must never import the member app (ADR-074
  decision 6), and the panel is where the system admin already is.
- **Impersonating Org public whole.** Rejected: one free team's support reason would open every
  other free team, and no one in Org public could be shown that log (ADR-100 decision 5).
- **A foreign key from `impersonation.team_id` to `team`**. Rejected: `move_team_to_org` (MIR-15-c)
  re-homes a team and `delete_team` removes one, and either would then be refused or would rewrite
  the log. `team_name` is a snapshot instead (AC-18).

## Delegated decisions

- ADR-100 — impersonation is a session row the database clock ends, it unlocks definer reads only, it
  targets an org or one team of Org public, the log is append-only, and Phase 6 splits into MIR-20,
  MIR-20-b and MIR-20-c. Accepted by `tech-lead-design` under the operator's delegation (ADR-067).

## Changelog

- `2026-11-12T07:10:00Z` — all sections written. ADR-100 written; MIR-20-b and MIR-20-c created
  `BACKLOG`. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
