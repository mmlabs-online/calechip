---
ticket: MIR-20-b
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-12T08:21:17Z
inputs_read:
  - .ai/board/tickets/MIR-20-b/ticket.yaml
  - .ai/board/tickets/MIR-20/01-plan.md
  - .ai/board/tickets/MIR-20/ticket.yaml
  - .ai/board/tickets/MIR-20-c/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-100-impersonation-is-a-logged-time-boxed-session-that-unlocks-definer-reads-only.md
  - .ai/registry/decisions/ADR-076-in-org-public-a-public-event-is-a-team-event-and-the-directory-reaches-no-other-team-through-it.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/01-operating-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/plan.md
  - supabase/migrations/20261112180000_mir20_impersonation.sql
  - supabase/migrations/20261109120000_mir17d_manages_a_team.sql
  - supabase/migrations/20261107230000_mir16b_is_org_admin.sql
  - supabase/migrations/20261111120000_mir15c_move_team_to_org.sql
  - supabase/tests/390-impersonation.test.sql
  - supabase/tests/010-catalogue.test.sql
  - src/App.tsx
  - src/components/AdminTabs.tsx
  - src/components/AdminLayout.tsx
  - src/routes/AdminHub.tsx
  - src/routes/MemberList.tsx
  - src/lib/roles.ts
  - src/lib/fixtures.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - tests/route-role-guards.test.ts
  - tests/mock-sql-parity.test.ts
  - tests/row-limits.test.ts
  - tests/e2e/uie-09-admin-hub.spec.ts
  - tests/e2e/solo-admin-tabs.spec.ts
  - tests/e2e/solo-member-admin.spec.ts
  - tests/e2e/adm-03-holiday-writes.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-20-b — every impersonation is visible to the org it touched

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:309`):

| ID | Feature | Group |
|---|---|---|
| MIR-20 | system_admin impersonation is read-only, time-boxed, reasoned and logged, and visible to the org it touched | MIR |

**Plan item:** Phase 6, *Impersonation and audit* (`.ai/board/plans/calechip-multi-tenancy-plan.md:287-305`):
checklist *"`org_admin` can read the impersonation log for their own org"*; exit criterion *"Every
impersonation is visible to the org it touched"*.

**The slice, ADR-100 decision 8, second bullet:** *"every impersonation is visible to the org it
touched: the member app shows the log to the touched org's `org_admin`, and, for a session on a team of
Org public, to that team's manager. Its PLAN designs the read."* MIR-20 shipped the log
(`public.impersonation`, `public.impersonation_action`) closed to every caller; this ticket adds the one
read ADR-100 § Consequences reserves for it.

**Who gains what.** An `org_admin` opening the Members screen now sees, under the roster, every support
session a system admin opened on their org: who opened it, on which team (in Org public) or the whole
org, the reason given, when it started, when it ended or that it is still live, and how many reads it
made. A manager of a team of Org public sees the same for the sessions on their team. Until now a
customer had no way to know a system admin had looked at them; the log existed and nobody outside the
database could read it. The read is the database's: one `security definer` function returns exactly the
rows the caller may see, and the two log tables stay closed.

**Out of scope:**

- **Listing each action of a session** (each `read_roster` with its time). A session shows its read
  *count*; the per-action list can be added later without changing this function's existing columns.
- **Reading an org's calendar under impersonation**, and every "acting as" item — MIR-20-c.
- **A dedicated admin tab or route for the log.** The log is a section of `/members` (§ 8 records why).
- **Notifying anybody** (bell or e-mail) when a session starts. Visibility here is the log, read on demand.
- **Any write to the log from the member app.** The log stays append-only and definer-written (ADR-100
  decision 6); no member-app caller gains a table privilege.
- **A system admin reading this log.** The panel already shows its own live session (MIR-20); the
  function returns nothing to a system admin.
- **A manager in a dedicated org.** A session on a dedicated org is org-wide (ADR-100 decision 5) and
  carries no team, so ADR-100 decision 8 names only that org's `org_admin` as its reader.
- **The glossary's *System admin* row**, which says impersonation *"does not exist until MIR-20"* — a
  registry rewrite for the steward, not a PLAN output (`glossary_owed` is `[]`).
- **`.ai/standards/rbac-and-security.md`** — human plane; its rows for the log are the operator's to add.
- **Applying the migration to the hosted project** — a person's step (RULE-09).

`size_estimate`: **M**.

## 2. Acceptance criteria

Terms. **The log function:** `public.list_impersonation_log()` (§ 4.1). **Effective end:** `ended_at`
when set; else `expires_at` when `expires_at <= now()`; else null, meaning *live*. **Reads:** the
number of `public.impersonation_action` rows of the session whose `action` is neither `start` nor `end`.
**The mock log:** the three sessions the mock seeds (§ 4.3): **L1** live, Org public team `CaleChip`;
**L2** ended, team `Nhóm khác`; **L3** ran out without an end, team `CaleChip`.

### The Members screen (mock build, e2e `tests/e2e/mir-20-b-impersonation-log.spec.ts`)

**AC-1 — Org public's org_admin sees every session on Org public, newest first**
- Given the mock build, signed in as `quan@example.com` (org_admin of Org public)
- When they open `/members`
- Then `impersonation-log` is visible and follows `member-list-table` in document order
- And `impersonation-log-table` holds exactly three `impersonation-log-row`s, in this order, each with
  these cells:

  | row | `-scope` | `-actor` | `-reason` | `-started` | `-ended` | `-reads` |
  |---|---|---|---|---|---|---|
  | 1 (L1) | `CaleChip` | `ops@calechip.test` | `Customer ticket 4411` | matches `^\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$` | matches `^Live until \d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC$` | `1` |
  | 2 (L2) | `Nhóm khác` | `ops@calechip.test` | `Sign-up stuck for a new member` | `2026-11-10 09:00 UTC` | `2026-11-10 09:20 UTC` | `2` |
  | 3 (L3) | `CaleChip` | `support@calechip.test` | `Calendar shows a wrong holiday` | `2026-11-08 14:00 UTC` | `2026-11-08 14:30 UTC` | `0` |

- And `impersonation-log-truncated` is absent.

**AC-2 — a member sees no log**
- Given the mock build, signed in as `thanh@example.com` (member)
- When they open `/members`
- Then `member-list-table` is visible and `impersonation-log` is absent.

**AC-3 — a dedicated org's org_admin sees none of Org public's sessions**
- Given the mock build with `quan@example.com` placed in the dedicated org `acme` before the first load
  (`calechip.mock.dedicatedOrgMembers`, as `adm-03-holiday-writes.spec.ts` does)
- When they sign in and open `/members`
- Then `impersonation-log-empty` reads `No support session is on record for you.` and no
  `impersonation-log-row` is shown.

**AC-4 — the log offers no control**
- Given AC-1's screen
- Then `impersonation-log` contains no `button`, `input`, `select` or `a` element.

### The mock seam (Vitest, `tests/impersonation-log.test.ts`)

**AC-5 — the mock answers as the log function does**
- Given the mock seam, with its seeded log, and the current member set by `__setCurrentMember`
  (rows added with `__putMemberForTest`)
- When `seam.listImpersonationLog()` is called as each of:
  - `FIXTURE_ADMIN` → L1, L2, L3, in that order
  - an approved, not-removed member with `role: "manager"` and `teamId: FIXTURE_TEAM.id` → L1, L3
  - an approved, not-removed member with `role: "manager"` and `teamId: FIXTURE_OTHER_TEAM_ID` → L2
  - a member with `role: "manager"`, `teamId: FIXTURE_TEAM.id` and `removedAt` set → `[]`
  - `FIXTURE_MEMBER` → `[]`
  - `FIXTURE_ADMIN` after `__setDedicatedOrgMembersForTest([FIXTURE_ADMIN.id])` → `[]`
  - no current member (`__setCurrentMember(null)`) → `[]`
- Then each returns exactly the sessions given, and L3's `endedAt` equals its `expiresAt` while L1's is
  `null`.

### The database (pgTAP, `supabase/tests/400-impersonation-log.test.sql`)

The cast is the file's own, on top of `tests.seed()`: dedicated orgs **A** (team A1) and **B**, and a
dedicated org **C** with an org_admin and no session; in Org public, teams **P1** and **P2**. Sessions
are inserted as the owner, with their actions: **sA1** (A, whole org, ended, three `read_roster`),
**sA2** (A, live), **sB** (B, ended), **sP1** (Org public, P1, expired never ended), **sP2** (Org public,
P2, ended).

**AC-6 — a dedicated org's org_admin reads every session on their org, and nothing else**
- Given A's org_admin
- When they call the log function
- Then it returns exactly sA2 and sA1, and none of sB, sP1, sP2.

**AC-7 — Org public's org_admin reads every session on Org public, whatever the team**
- Given an org_admin of Org public
- When they call the log function
- Then it returns exactly sP1 and sP2.

**AC-8 — a team's manager reads the sessions on that team only**
- Given P1's manager (an approved, not-removed member with an active `membership` on P1,
  `team_role = 'manager'`), and P2's manager
- When each calls the log function
- Then P1's manager receives exactly sP1 and P2's manager exactly sP2
- And A1's manager (active `team_role = 'manager'` on A1, `member.role = 'member'`) receives no row.

**AC-9 — nobody else reads anything**
- Given an approved member of P1 who is not its manager, a pending member of A, a removed former
  org_admin of A, a member whose P1 manager membership has `left_at` set, a removed member whose P1
  manager membership is still open, and a system admin at `aal2` with a live session on A
- When each calls the log function
- Then each receives zero rows, without error
- And `anon` calling it raises `42501`.

**AC-10 — what a row says**
- Given A's org_admin, and team P1 renamed after sP1 was written
- When the log function is called (as A's org_admin, and as Org public's org_admin)
- Then sA1's `actor_email`, `team_id`, `team_name`, `reason`, `started_at` and `expires_at` equal the
  stored row's (team null for a whole-org session), its `ended_at` equals the stored `ended_at`, and its
  `reads` is `3` (its `start` and `end` actions are not counted)
- And sA2's `ended_at` is null and its `reads` is `0`
- And sP1's `ended_at` equals its `expires_at`, and its `team_name` is the name stored at the start, not
  P1's new name.

**AC-11 — newest first, at most 200**
- Given B's org_admin, and 201 ended sessions on B with distinct `started_at` (sB among them)
- When the log function is called
- Then it returns 200 rows ordered by `started_at` descending, and the earliest session is absent.

**AC-12 — reading writes nothing, and the tables stay closed**
- Given A's org_admin
- When they call the log function
- Then the count of rows in `public.impersonation` and `public.impersonation_action` is unchanged
- And their `select` on either table still raises `42501`.

**AC-13 — the log follows its team out of Org public**
- Given P1's manager is on P1 only, and a system admin at `aal2` moves P1 into org C with
  `move_team_to_org`
- When P1's manager, Org public's org_admin and C's org_admin call the log function
- Then P1's manager and Org public's org_admin each still receive sP1, and C's org_admin receives no row.

**AC-14 — the census**
- Given `supabase/tests/010-catalogue.test.sql`
- Then its definer census lists `public.list_impersonation_log()` and passes, and
  `390-impersonation.test.sql` passes unedited.

**Invariants touched.** `[]`. No entry, absence count, approval or portion is read or written: the
function reads `impersonation`, `impersonation_action`, and — for the caller only — `member` and
`membership`. INV-04 and INV-07 are not touched.

**Open questions.** None that blocks. Three choices are this plan's own, each inside ADR-100 decision 8
(*"Its PLAN designs the read"*), and each is argued in § 8: the reader sees the system admin's e-mail;
a session on a team of Org public stays visible to that team's manager after the team leaves Org public;
a session shows a read count, not each read.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image is in `.ai/board/tickets/MIR-20-b/` and no idea file promotes this ticket. The arrangement:

- **Placement** — a `section`, `impersonation-log`, the last child of the Members screen's ready view,
  directly after the roster table (or its empty paragraph) and before the modals. Rendered only when
  `mayDecide(me.role)` (an affordance; the function decides the rows).
- **Heading** — `h2`, `text-base font-semibold`: *Support access*. Under it, `text-sm text-ink-2`:
  *Read-only support sessions a CaleChip system admin opened on your org or team, with the reason they
  gave. A session can read, never change, and closes on its own within an hour.*
- **Table** — `impersonation-log-table`, styled as `member-list-table` (`w-full overflow-hidden
  rounded-card bg-card text-sm shadow-soft`, the same small uppercase header row). Columns in order:
  *Started*, *By*, *Scope*, *Reason*, *Ended*, *Reads*. Not sortable. A live row's *Ended* cell is
  `font-semibold text-ink`; every other cell `text-ink-2`. No meaning token (`pto`, `overload`, …) is
  spent: those name calendar facts.
- **Empty** — `impersonation-log-empty`, `rounded-2xl bg-white p-8 text-center text-sm opacity-70
  shadow-sm`, as `member-list-empty`: *No support session is on record for you.*
- **Loading / error** — `impersonation-log-loading` (`role="status"`, `Loader`, *Reading the support
  log…*); `impersonation-log-error` (`role="alert"`, *The support log could not be read just now.*)
  with `impersonation-log-retry` (*Try again*), the only control the section ever shows.
- **Bound** — `impersonation-log-truncated`, `text-xs text-ink-3`, under the table when 200 rows came
  back: *Showing the latest 200 sessions.*

## 3. Permission model

The server side is the control; the screen's `mayDecide` gate is an affordance only.

| Action | Who may | Where the check lives | Who must not |
|---|---|---|---|
| Read sessions on an org | that org's `org_admin` (`public.is_org_admin(auth.uid(), i.org_id)`: approved, not removed, `role = 'org_admin'`) | `list_impersonation_log`, row predicate | any other org's `org_admin`; a removed or pending former `org_admin` |
| Read sessions on a team of Org public | that team's manager: an active `membership` on `i.team_id` with `team_role = 'manager'`, the member approved and not removed | `list_impersonation_log`, row predicate | a plain member of the team; a manager of another team; a manager whose membership has left, or who is removed |
| Read sessions on a dedicated org as its manager | **nobody** — such a session has `team_id` null (ADR-100 decision 5), so the manager disjunct never matches | the predicate | every manager of a dedicated org |
| Read the log as a system admin | **nobody** — no `member` row, so neither disjunct matches | the predicate | system admins, live session or not |
| Call the log function | `authenticated`; others get no row | `revoke all … from public, anon; grant execute … to authenticated` | `anon` (`42501`) |
| Select, insert, update, delete either log table | **nobody**, unchanged from MIR-20 | no grant, RLS with no policy (MIR-20 § 4.1) | every role |
| Write anything through the log screen | **nobody** — the section has no control and the seam method is a read | n/a | every role |

**Two predicate decisions, both inside ADR-100 decision 8.** The manager disjunct matches on
`team_id` alone, not on the team's current org: a team moved out of Org public (`move_team_to_org`)
carries its manager with it (ADR-093), and that manager keeps sight of what was done to their team
while it was in Org public; the receiving org's `org_admin` does not see it, because the session's
`org_id` is Org public's (AC-13). A deleted team has no manager, so its sessions are then visible to
Org public's `org_admin` only.

## 4. Contract

### 4.1 Migration `supabase/migrations/20261112210000_mir20b_impersonation_log_read.sql`

Idempotent (ADR-024): `create or replace`, grants restated. One `begin; … commit;`. No table, column,
index, policy, trigger or grant on an existing object changes.

```sql
-- Writes nothing. Rows of public.impersonation the caller may read (§ 3), newest first, at most 200.
create or replace function public.list_impersonation_log()
  returns table (
    id          uuid,
    actor_email text,
    team_id     uuid,          -- null for a whole-org session
    team_name   text,          -- the name stored at the start; null for a whole-org session
    reason      text,
    started_at  timestamptz,
    expires_at  timestamptz,
    ended_at    timestamptz,   -- effective end: i.ended_at, else i.expires_at when <= now(), else null (live)
    reads       integer        -- count of the session's impersonation_action rows with action not in ('start','end')
  )
  language sql stable security definer set search_path = '';
revoke all on function public.list_impersonation_log() from public, anon;
grant execute on function public.list_impersonation_log() to authenticated;
```

The row predicate, exactly (every reference qualified; `i` is `public.impersonation`):

```sql
where public.is_org_admin((select auth.uid()), i.org_id)
   or (i.team_id is not null
       and exists (select 1
                     from public.membership ms
                     join public.member m on m.id = ms.member_id
                    where ms.member_id = (select auth.uid())
                      and ms.team_id = i.team_id
                      and ms.left_at is null
                      and ms.team_role = 'manager'::public.team_role
                      and m.status = 'approved'::public.member_status
                      and m.removed_at is null))
order by i.started_at desc, i.id
limit 200
```

### 4.2 Seam `src/lib/data/index.ts`, `supabase.ts`, `mock.ts` — additions only

In `index.ts`, beside the other seam interfaces (not in `src/lib/domain/types.ts`, which this ticket
does not edit):

```ts
// MIR-20-b — the support log. 01-plan.md § 4.2, ADR-100 decision 8.
/** The most sessions `list_impersonation_log()` returns; the SQL's `limit 200`. */
export const IMPERSONATION_LOG_LIMIT = 200;

/** One row of `public.list_impersonation_log()`. */
export interface ImpersonationLogEntry {
  id: string;
  actorEmail: string;
  teamId: string | null;   // null: the whole org
  teamName: string | null; // the name stored at the start
  reason: string;
  startedAt: string;       // ISO 8601
  expiresAt: string;       // ISO 8601
  endedAt: string | null;  // null only while live; a session that ran out reads its expiresAt
  reads: number;
}
```

On `DataSeam`:

```ts
  /**
   * MIR-20-b. `rpc("list_impersonation_log")`, mapped to camelCase, in the function's order. `[]` for a
   * caller who may read none — never an error. THROWS on a transport failure or a body that is not a list.
   */
  listImpersonationLog(): Promise<ImpersonationLogEntry[]>;
```

**`supabase.ts`:** a row type `ImpersonationLogRow` (`id`, `actor_email`, `team_id`, `team_name`,
`reason`, `started_at`, `expires_at`, `ended_at`, `reads`) and a mapper `toImpersonationLogEntry(row)`.
Errors throw `` `listImpersonationLog failed: ${error.message}` `` and
`"listImpersonationLog received a body that is not a list"`, as `listEntryOwners` does. No `.limit()`:
the function's own bound is 200, under `DATASTORE_MAX_ROWS`.

### 4.3 The mock

Module state in `mock.ts`, internal (not exported), reset on a document load like `members`:

```ts
interface MockImpersonation {
  id: string;
  org: MockOrg;            // the existing internal type
  actorEmail: string;
  teamId: string | null;
  teamName: string | null;
  reason: string;
  startedAt: string;
  expiresAt: string;
  endedAt: string | null;  // the stored column, not the effective end
  reads: number;
}
let mockImpersonationLog: MockImpersonation[];
```

Seeded with three rows, all `org: "org_public"`, ids `ab000000-0000-4000-8000-00000000000{1,2,3}`:

| | `teamId` / `teamName` | `actorEmail` | `reason` | `startedAt` | `expiresAt` | `endedAt` | `reads` |
|---|---|---|---|---|---|---|---|
| L1 | `FIXTURE_TEAM` | `ops@calechip.test` | `Customer ticket 4411` | load time − 10 min | load time + 20 min | `null` | `1` |
| L2 | `FIXTURE_OTHER_TEAM` | `ops@calechip.test` | `Sign-up stuck for a new member` | `2026-11-10T09:00:00.000Z` | `2026-11-10T09:45:00.000Z` | `2026-11-10T09:20:00.000Z` | `2` |
| L3 | `FIXTURE_TEAM` | `support@calechip.test` | `Calendar shows a wrong holiday` | `2026-11-08T14:00:00.000Z` | `2026-11-08T14:30:00.000Z` | `null` | `0` |

`listImpersonationLog()` reproduces § 4.1: the current member must be `approved` and not removed
(`mockOrgOf(me.id) !== null`); `role === "admin"` admits rows with `org === mockOrgOf(me.id)`;
`role === "manager"` admits rows with `teamId === me.teamId`; anything else, or no current member, is
`[]`. The effective `endedAt` is computed at read time against `Date.now()`. Sorted by `startedAt`
descending, sliced to `IMPERSONATION_LOG_LIMIT`. No new `__…ForTest` export: AC-5 drives the existing
`__setCurrentMember`, `__putMemberForTest` and `__setDedicatedOrgMembersForTest`.

### 4.4 Screen

**`src/components/ImpersonationLog.tsx`** — `export default function ImpersonationLog(): ReactElement`,
no props. On mount it calls `seam.listImpersonationLog()`; states `loading`, `error`, `ready` with
`ImpersonationLogEntry[]`. Retry re-runs the read. Times are shown as
`new Date(iso).toISOString().slice(0, 16).replace("T", " ") + " UTC"`. *Scope* is `teamName ?? "Whole
org"`. *Ended* is `endedAt === null ? `Live until ${when(expiresAt)}` : when(endedAt)`. *Reads* is
`String(reads)`.

**`src/routes/MemberList.tsx`** — imports `mayDecide` from `@/lib/roles` and the component; in the ready
view, after the table/empty block and before the modals:
`{mayDecide(me.role) ? <ImpersonationLog /> : null}`. Nothing else in the file changes.

Every `data-testid` this ticket adds:

| `data-testid` | Element |
|---|---|
| `impersonation-log` | the section |
| `impersonation-log-loading` | `role="status"` while reading |
| `impersonation-log-error` / `impersonation-log-retry` | failure, and its *Try again* button |
| `impersonation-log-empty` | *No support session is on record for you.* |
| `impersonation-log-table` | the table |
| `impersonation-log-row` | one `tr`; `data-impersonation-id` = `id` |
| `impersonation-log-started` / `-actor` / `-scope` / `-reason` / `-ended` / `-reads` | the six cells, each prefixed `impersonation-log-` |
| `impersonation-log-truncated` | *Showing the latest 200 sessions.* |

### 4.5 Tests

- `supabase/tests/400-impersonation-log.test.sql` — AC-6 to AC-13. Defines its own fixture-label
  helper and `tests.authenticate_at(uuid, text)` as `390-impersonation.test.sql` does; `_isolation.psql`
  is not edited. Sessions and actions are inserted as the owner, before any `authenticate_*` call.
- `supabase/tests/010-catalogue.test.sql` — the census gains, under
  `-- MIR-20-b, 400-impersonation-log.test.sql`: `'public.list_impersonation_log()'`.
- `tests/impersonation-log.test.ts` — AC-5, against `@/lib/data/mock`; restores the current member, the
  dedicated-org set and any row it put, in `afterEach`.
- `tests/e2e/mir-20-b-impersonation-log.spec.ts` — AC-1 to AC-4 against the mock build; signs in as
  `solo-member-admin.spec.ts` does and opens `/members` by address.

## 5. Seam impact

One new method, `listImpersonationLog()`, on `DataSeam`, in both `supabase.ts` and `mock.ts` with the
same name and arity — `tests/seam-parity.test.ts` compares the keys and passes unedited. One new
exported interface and one constant in `src/lib/data/index.ts`. No existing method's signature changes,
and `src/lib/domain/types.ts` is not edited. The `supabase-client-in-seam` lint rule (RULE-02) is
satisfied: the RPC uses the module's existing `client()`. The panel's seam `src/lib/data/system.ts` is
not touched.

## 6. Schema delta

**Not `none`** — one `security definer` function, `public.list_impersonation_log()`, with its grant
(ADR-014). It is the read ADR-100 § Consequences reserves for this ticket (*"MIR-20-b adds the only
grant or definer read on them"*) and decision 8 assigns to it; ADR-100 is `ACCEPTED`. No table, column,
index, policy, trigger, constraint or existing grant changes, and both log tables stay closed, so MIR-20's
AC-17 holds unedited. No new ADR: the three design choices in § 2 *Open questions* are this PLAN's,
inside decision 8. Applying the migration to the hosted project is a person's step (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20261112210000_mir20b_impersonation_log_read.sql"
  - "supabase/tests/400-impersonation-log.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/components/ImpersonationLog.tsx"
  - "src/routes/MemberList.tsx"
  - "tests/impersonation-log.test.ts"
  - "tests/e2e/mir-20-b-impersonation-log.spec.ts"
```

10 paths, `size: M`, agreeing with `size_estimate: M`. A dedicated admin tab would have been 13 (§ 8),
which is what kept the log on `/members`. As in MIR-20, the sizing table's *"changes the schema"* → `XL`
is read under the MIR precedent: an additive function carried by an accepted ADR is sized by its file
count. `glossary_owed` is `[]`; no glossary row is written.

## 8. Rejected alternatives

- **A select policy and a `grant select` on the two log tables**, read by the seam with PostgREST.
  Genuinely plausible — it is the ordinary shape of a member-app read. Rejected: it exposes `actor_id`
  and every future column unless column grants are added beside it, the action table needs a second
  policy that re-derives the first, and it reverses MIR-20 AC-17 (*the log is closed to every caller*),
  whose shipped test would have to change. A definer function returns exactly the nine columns and leaves
  the tables closed.
- **A dedicated *Support access* tab and route in the admin strip.** The natural home for an audit log.
  Rejected for this slice on cost, not merit: the tab changes `AdminTabs.tsx` and `App.tsx`, and three
  shipped tests assert the exact tab set (`uie-09-admin-hub.spec.ts`, `solo-admin-tabs.spec.ts`,
  `tests/route-role-guards.test.ts`) — 13 files, past the split line. The Members screen is reachable by
  both readers today, and impersonation's only read so far is the roster.
- **Hiding the actor** (*"a CaleChip system admin"*). Rejected: the plan's audit table names the actor
  first, and a log that does not say who looked is not the visibility the exit criterion asks for. The
  e-mail is the snapshot ADR-100 decision 7 already keeps for exactly this.
- **Listing each action as its own row.** Rejected for now: a 60-minute session that re-reads the roster
  produces many rows that all say the same thing; the count says how much was read, and a per-action
  list can come later as a second function without changing this one.
- **Bounding the manager disjunct to teams still in the session's org.** Rejected: after a move the
  team's own manager would lose sight of what was done to the team, while nobody in the team's new org
  could see it either; the history belongs to the team that was touched (AC-13).

## Changelog

- `2026-11-12T08:21:17Z` — all sections written. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
