# CaleChip — Multi-Tenancy Migration Plan

- **Owner:** Ming
- **Based on:** `multi-tenancy-audit-2026-10-12.md`
- **Status:** Draft for approval
- **Target architecture:** System → Org → Team, with multi-team membership

---

## Target model (agreed)

| Level | Definition |
|---|---|
| **System** | The whole CaleChip deployment. One `system_admin` panel at an unguessable path. |
| **Org** | Tenant boundary. Fully isolated data, own config, own holidays. Reachable at `/{org_code}`. Has member and team caps set at creation. A user belongs to exactly one org. |
| **Team** | Inside an org. Own entry register, own manager, own approval switches and overload threshold. A user may join several teams within their org. |

**Org public** — a shared tenant holding teams that have not bought a licence, administered by `system_admin`. Marked `is_shared_tenant = true`; all org-wide visibility features are disabled for it.

**Roles**

| Role | Scope |
|---|---|
| `system_admin` | Whole system. Separate panel. May impersonate read-only, time-boxed and logged. |
| `org_admin` | One org. This is what today's `admin` becomes. |
| `manager` | One team. Approves PTO/WFH, sets team config. Also a normal member who registers entries. |
| `member` | One org, many teams. Sees calendars of teams they belong to. |
| `guest` | No account. Sees and registers for public events via token. |

**Approval rules (agreed)**
- If a person belongs to several teams and **any one** of them requires approval, the entry requires approval.
- **One** manager's decision is enough. First decision wins; other queues clear.
- One rejection rejects the entry. No mixed state.
- A manager **may** approve their own entry, recorded as `self_approved = true`.
- If a team has no manager, approval authority falls to `org_admin`.

**Config ownership**

| System | Org | Team |
|---|---|---|
| Org list, caps, create/suspend | National holiday set + company days | PTO / WFH approval switches |
| National holiday seed | Standard working week | Overload threshold |
| `system_admin` accounts | Timezone, language | Blackout periods |
| Impersonation | Create/delete teams, assign managers | Busy-day window |
| | Email domain allow-list | Note visibility |

Teams may **add** their own non-working days; they may not remove days set by the org.

---

## Why the phase order is what it is

Three findings from the audit changed the original plan:

1. **Four security holes are open in production today.** They are not tenancy risks; they are live. Everything else waits.
2. **No test executes SQL.** All isolation assertions run against a mock that is looser than the real policies. Rewriting 30 policies without real tests is working blind.
3. **`member.team_id` is single-valued and `member_team_id()` is in nearly every policy.** Multi-team membership is not an added table — it is a rewrite of the policy layer. Doing `org_id` first and multi-team second means rewriting every policy twice.

---

## Phase 0 — Close the open holes

**Goal:** stop active exposure. No tenancy work. Ship within 48 hours.

**Blocking:** everything.

### P0-1 · Rotate the leaked service role key
- [ ] Confirm whether the key committed at `5a29434` is still valid
- [ ] Rotate the service role key and the anon key in Supabase
- [ ] Update every deployment environment and CI secret
- [ ] Verify the old key is rejected
- [ ] Record the rotation date in the repo

> Until this is done, every RLS analysis in the audit is moot — that key bypasses all of it.

### P0-2 · Close self-escalation on `member`
- [ ] Reproduce first: `PATCH /rest/v1/member?id=eq.<self>` with `{"role":"admin"}` from an ordinary member account. Record the result.
- [ ] Extend trigger `member_enforce_role_and_removal` to refuse a member changing their own `role`, `status` or `team_id`
- [ ] Revoke `update (role, status, team_id)` from `authenticated` where the column is not needed; route those writes through definer RPCs instead
- [ ] Reconcile the stale comment at `profile_self_update.sql:13-17`
- [ ] Add a pgTAP test proving the PATCH fails (depends on P1-1; until then, a manual check recorded in the PR)

### P0-3 · Bound `set_member_role`
- [ ] Add a team/org condition — an admin may only change roles for members they actually administer
- [ ] Refuse promotion to `admin` through this path entirely; make it a deliberate, separately-gated action
- [ ] Record the actor of every role change

### P0-4 · Close the global member directory
- [ ] `list_member_directory` (`evt01:154-163`) currently returns every member of every team to **any** member. Scope it to the caller's own teams.
- [ ] Audit the event-invitee check (`evt01:215-220`) — it only requires the invitee to have a team

### Exit criteria
- [ ] Keys rotated and verified
- [ ] A member account cannot alter its own role, status or team
- [ ] Role changes are bounded and logged
- [ ] No endpoint returns members outside the caller's scope
- [ ] Each fix has a recorded verification against the real database, not the mock

---

## Phase 1 — Make the database testable

**Goal:** be able to prove isolation before relying on it.

**Blocking:** Phase 3 onward. Without this, the rewrite is unverifiable.

### P1-1 · Stand up pgTAP
- [ ] Add `supabase/tests/` and wire pgTAP into local Supabase
- [ ] Add a CI job that starts a real Postgres, applies all migrations, and runs the SQL tests
- [ ] CI fails on any SQL test failure

### P1-2 · Write the isolation suite
Each test runs as a real authenticated role against real policies:
- [ ] A member cannot read another team's entries
- [ ] A member cannot read another team's members
- [ ] A member cannot alter their own role, status or team
- [ ] An admin cannot decide another team's entries
- [ ] A manager cannot decide outside their team
- [ ] A removed member reads nothing
- [ ] A pending member reads nothing
- [ ] Every `security definer` function rejects a caller who should not reach it
- [ ] Every `anon`-callable guest RPC leaks nothing beyond its token's event

### P1-3 · Fix the lying mock
- [ ] `mock.ts:366-369` `currentAdmin` does not check `status === 'approved'`; the real `is_admin` does. Align it.
- [ ] Make `updateOwnProfile` in the mock accept the same column set the real grant allows, so the mock can express the attack
- [ ] Add a parity test that fails when mock and SQL disagree on a permission decision

### Exit criteria
- [ ] CI runs SQL tests against a real database on every PR
- [ ] Every isolation claim currently asserted against the mock also has an SQL test
- [ ] The mock is no looser than SQL on any permission check

---

## Phase 2 — Restore a single source of truth for schema

**Goal:** stop anyone — human or agent — designing against a wrong schema.

**Blocking:** Phase 3. The audit found 12 discrepancies in `db.sql`, which calls itself the whole schema.

### P2-1 · Retire `db.sql`
- [ ] Generate the real schema from the applied migrations
- [ ] Replace `supabase/db.sql` with the generated dump, or delete it and document migrations as the only source
- [ ] If kept, add a CI check that regenerates it and fails on drift

### P2-2 · Clean up known inconsistencies
- [ ] `issue.sql` has no `begin`/`commit`, unlike its neighbours
- [ ] Remove references to the dropped `allowed_email` table
- [ ] Add the missing index on `member.team_id`
- [ ] Add a check constraint on `team.overload_threshold` (currently unconstrained)

### Exit criteria
- [ ] One authoritative schema artifact, verified by CI
- [ ] No stale table, policy or function definition remains in the repo

---

## Phase 3 — Org and multi-team membership

**Goal:** the structural change. Largest and riskiest phase.

**Depends on:** Phases 0, 1, 2.

> Design `org_id` and multi-team membership **together**, ship as several small migrations. Doing them separately means rewriting every policy twice.

### P3-1 · Schema design (approve before any migration)
- [ ] New table `org`: id, `org_code` (unique, immutable), name, `is_shared_tenant`, `max_members`, `max_teams`, `plan`, `licence_expires_at`, timezone
- [ ] New table `membership`: id, `org_id`, `team_id`, `member_id`, `role_in_team`, `is_primary`, joined/left timestamps
- [ ] `member` keeps `org_id` (one org per user) and loses `team_id`
- [ ] `entry` gains `org_id` and `primary_team_id`; keeps `member_id`
- [ ] Reserved word list for `org_code`: `system`, `api`, `admin`, `login`, `signin`, `signup`, `app`, `static`, `public`, `assets`, `healthz`, `fonts`, `images`, `_next`, `index.html`
- [ ] `holiday`: `unique (date)` becomes `unique (org_id, date)`; national set owned by system, org days layered on top; teams may add, not remove

### P3-2 · Composite foreign keys (the real isolation layer)
- [ ] `team`: `unique (id, org_id)`
- [ ] `membership`: `unique (id, org_id)`, FK `(team_id, org_id)` → `team (id, org_id)`
- [ ] `entry`: FK `(member_id, org_id)` → `member (id, org_id)`
- [ ] Same pattern for `event`, `event_invitee`, `event_attendance`, `busy_day`, `notification`, `issue_report`
- [ ] Prove with a pgTAP test that a cross-org insert is refused at the DB level even when application code gets it wrong

### P3-3 · Migration execution
- [ ] Add `org_id` nullable everywhere
- [ ] Create the `Org public` row; backfill every existing team and member into it
- [ ] Backfill `membership` from today's `member.team_id`, with `is_primary = true`
- [ ] Set `org_id` NOT NULL
- [ ] Drop `member.team_id` only after all readers move to `membership`

### P3-4 · Rewrite the policy layer
- [ ] Replace `member_team_id(uid)` — single-valued — with a set-returning `member_team_ids(uid)`
- [ ] Rewrite every policy listed in audit §5 against `membership` and `org_id`
- [ ] `getTeam()` uses `.maybeSingle()` and will error with more than one team (`supabase.ts:2092-2095`) — fix
- [ ] `setOverloadThreshold` and `setApprovalSettings` send no id and update every admitted row (`supabase.ts:2135-2140`, `:2374-2379`) — scope to one team
- [ ] Every `security definer` function in audit §5 gains an org condition; none may trust a client-supplied `p_team_id` alone

### P3-5 · Approval logic for multi-team members
- [ ] Extend `entry_apply_approval_setting` to OR the approval switches across all the owner's teams
- [ ] Record which teams an entry affects, so each relevant manager sees it in their queue
- [ ] First decision wins; clear the other queues
- [ ] Any rejection rejects the entry
- [ ] Record `approved_by` **and** `rejected_by` — today rejection stores no actor (`mgr_gen_cols:107-109`)
- [ ] Record `self_approved` when a manager decides their own entry
- [ ] Fall back to `org_admin` when a team has no manager
- [ ] UI shows which teams an entry affects

### P3-6 · Org public special cases
- [ ] Disable `list_member_directory` across teams when `is_shared_tenant`
- [ ] Disable `event scope = 'public'` reaching outside the team when `is_shared_tenant`
- [ ] Trigger `notify_event_created` (`evt04:154-174`) must not notify across teams when `is_shared_tenant`
- [ ] Only `system_admin` sets holidays for Org public
- [ ] Build "move a team to another org" in the system panel — needed the day a customer buys a licence

### Exit criteria
- [ ] Every table carries `org_id NOT NULL`
- [ ] A cross-org write is refused by the database, not only by application code
- [ ] A member can belong to several teams and see exactly those teams
- [ ] The full pgTAP isolation suite passes
- [ ] No `security definer` function trusts a client-supplied team or org id

---

## Phase 4 — Role split

**Goal:** `admin` becomes three distinct roles.

**Depends on:** Phase 3.

The audit counted the current `admin` checks: 4 mean *team*, 3 groups mean *org*, 4 groups mean *system*. That distribution is the migration map.

### P4-1 · Database
- [ ] `system_admin` as a separate account type, not a value on `member.role`
- [ ] `member.role` becomes `org_admin` | `member`; team-level `manager` moves to `membership.role_in_team`
- [ ] Replace `is_admin(uid)` with `is_org_admin(uid, org_id)` and `is_system_admin(uid)` across ~25 call sites
- [ ] `may_decide(uid)` gains a team parameter (`manager_role:62` hardcodes the role list)
- [ ] Re-point the four system-scope groups: sign-up queue, holidays, issue reports, event override
- [ ] Resolve the demotion trigger's ambiguity between the two admin kinds (`profile_self_update:165`)

### P4-2 · Client
- [ ] `mayAdminister`, `mayDecide`, `mayDecideEntriesOf` all take a team or org parameter (`src/lib/roles.ts`)
- [ ] Replace every `me.role !== "admin"` guard — `AdminHub`, `NewSignups`, `Threshold`, `Teams`, `IssueReports`, `TeamEntries`, `Holidays`
- [ ] `canRemove`, `canPromote`, `canSetManager` scoped correctly (`MemberList.tsx:349-366`)
- [ ] `mayEditEvent` currently has no team comparison (`EventDetail.tsx:51-53`)
- [ ] `Teams.tsx:337` labels managers as "Member" — fix
- [ ] Router has no role guards at all; add them

### P4-3 · System admin panel
- [ ] Separate route, not indexed: `X-Robots-Tag: noindex` header, **not** `robots.txt` — listing it there publishes the path
- [ ] Separate account store, 2FA required
- [ ] IP allow-list if feasible
- [ ] Rate limiting and failed-login logging
- [ ] Org CRUD, caps, licence state, move-team-between-orgs

### Exit criteria
- [ ] An `org_admin` cannot see or touch another org
- [ ] A `manager` can only approve within their own team
- [ ] `system_admin` has no implicit data access without impersonation
- [ ] pgTAP covers every role boundary

---

## Phase 5 — Org-scoped routing

**Goal:** every authenticated page under `/{org_code}`. Can run in parallel with Phase 4.

### Checklist
- [ ] `BrowserRouter` has no `basename` and every route is absolute (`src/App.tsx:88`)
- [ ] Catch-all `*` redirects to `/` — must preserve org
- [ ] Calendar path regex anchored at `^\/` (`viewed-team.ts:74`)
- [ ] `isAdminAddress` / `ADMIN_ADDRESSES` (`AdminTabs.tsx:251-271`)
- [ ] `periodNavFor(pathname)` (`src/lib/period.ts`)
- [ ] Absolute `navigate()` calls — `Sidebar.tsx:293`, `TopBar.tsx:278-307`, `BrandLogo.tsx:31`, `AuthCard.tsx:60`, `:68`
- [ ] Redirects in `MonthView.tsx:512`, `WeekView.tsx:577`
- [ ] Guest links carry no org (`EventDetail.tsx:57`, `GuestEvent.tsx:48`)
- [ ] Email template links carry no org (`send-event-email/template.ts:197`)
- [ ] nginx: `try_files $uri $uri/` collides with `fonts/`, `images/` (`docker/nginx.conf`)
- [ ] e2e specs hardcode absolute paths
- [ ] Signing in resolves the user's org and redirects there
- [ ] Wrong-org URL returns 404, never a cross-org read

### Exit criteria
- [ ] Every authenticated page lives under `/{org_code}`
- [ ] No reserved word can be registered as an `org_code`
- [ ] `org_code` is immutable after creation

---

## Phase 6 — Impersonation and audit

**Goal:** `system_admin` can support a customer without silent access.

**Depends on:** Phases 3 and 4. There is no audit table anywhere today.

### Checklist
- [ ] Audit table: actor, target org, action, timestamp, reason
- [ ] Impersonation is read-only, time-boxed (30–60 min), requires a stated reason
- [ ] A persistent banner shows the session is impersonated
- [ ] `org_admin` can read the impersonation log for their own org
- [ ] Identity resolution currently hard-wired to `getUser()` then the member row (`supabase.ts:1034-1038`) — needs an "acting as" concept
- [ ] JWT carries no custom claims today (`supabase.ts:1042-1052`) — a time-boxed claim is needed
- [ ] Session expiry is enforced server-side, not by the client
- [ ] pgTAP proves an impersonated session cannot write

### Exit criteria
- [ ] No path gives `system_admin` org data outside a logged session
- [ ] Every impersonation is visible to the org it touched

---

## Deferred — decide later

| Item | Note |
|---|---|
| Licence expiry behaviour | Proposed: org goes read-only, 30-day warning, no deletion |
| Over-cap after downgrade | Proposed: block new, keep existing, never auto-remove |
| Member counting | Count distinct users, not memberships |
| Per-team entry approval | Rejected for now in favour of one-manager-decides |
| Org-to-org team transfer UI | Needed by Phase 3 for Org public; polish later |

---

## Open risks

1. **Phase 3 is large.** If it stalls half-done, the app is in a worse state than today. Each migration must be independently shippable and reversible.
2. **Org public will keep generating special cases.** Three are already known (directory, public events, notifications). Expect more.
3. **The production database has never been tested against its own policies.** Phase 1 may uncover further holes; budget for that rather than treating it as scope creep.
4. **No audit trail exists.** If any of the Phase 0 holes was exploited, there is no way to tell.