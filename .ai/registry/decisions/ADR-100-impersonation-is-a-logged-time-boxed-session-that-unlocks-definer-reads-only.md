---
doc_version: 3
last_updated: 2026-11-12
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-100 — Impersonation is a logged, time-boxed session row that the database clock ends, and it unlocks definer read functions only

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-12 — at `/plan` for MIR-20 (ADR-008, ADR-067).

This ADR supersedes and reverses no accepted ADR. It supplies the mechanism that
[ADR-059](ADR-059-calechip-becomes-multi-tenant-system-org-team.md) decision 3 names for
`system_admin` — *"May impersonate — read-only, time-boxed and logged"* — and stays inside
[ADR-005](ADR-005-authorization-in-rls.md) (row-level security and database functions authorize; no
server-side API) and [ADR-074](ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md)
(a system admin is a `public.system_admin` row behind `aal2`, holds no `public.member` row, and the
panel is its own build entry).

## Context

- **Feature MIR-20** (`.ai/registry/features.md:309`): *system_admin impersonation is read-only,
  time-boxed, reasoned and logged, and visible to the org it touched.*
- **Plan Phase 6** (`.ai/board/plans/calechip-multi-tenancy-plan.md:287-305`): an audit table (actor,
  target org, action, timestamp, reason); read-only, 30–60 minutes, a stated reason; a persistent
  banner; `org_admin` reads the log for their own org; an "acting as" concept; *"a time-boxed claim
  is needed"*; expiry enforced server-side; pgTAP proves an impersonated session cannot write. Exit:
  *no path gives `system_admin` org data outside a logged session; every impersonation is visible to
  the org it touched.*
- **There is no audit table and no notion of acting as anybody** (`.ai/standards/rbac-and-security.md`
  A15; audit A:1011-1021). Every policy keys on `auth.uid()` through the caller's `member` row.
- **A system admin has no `member` row** (ADR-074 decision 2), so every member-app read policy and
  every member-app write path already returns nothing to, or refuses, a system admin. Today a system
  admin reads org data only through the system-scope RPCs decided by ADR-075, ADR-079, ADR-082 and
  ADR-093.
- **The JWT carries no custom claim.** A claim would be minted by a custom access-token hook at token
  issue and would live as long as the token, which the client refreshes.
- **Org public's visibility is team-bound** (ADR-076, MIR-15): inside the shared tenant, the unit a
  customer owns is a team, not the org.
- **Phase 6 whole does not fit one ticket.** The start/end/read surface in the panel, the org's view
  of its log in the member app, and an org's calendar read under impersonation are three operations
  on two surfaces (`.ai/01-operating-model.md` § Sizing).

## Decision

1. **An impersonation is a row, not a token claim.** `public.impersonation` holds one row per session:
   the actor, the target org (and team, decision 5), the reason, `started_at`, `expires_at` and
   `ended_at`. A session is **live** exactly when `ended_at is null and expires_at > now()`, and that
   is evaluated by the database on every call through `public.impersonated_org_id()`. The database's
   clock ends a session; nothing in the client can extend one.
2. **Read-only by construction.** An impersonation grants no table privilege and widens no policy.
   It unlocks only `security definer` **read** functions that check `public.impersonated_org_id()`,
   return rows of that org (and team) only, and write one action row per call. No write function
   accepts an impersonation as authority. Because a system admin holds no `member` row, every
   existing write path refuses them with or without a live session; the pgTAP suite asserts that.
3. **Time box: 30 to 60 minutes, chosen at the start, never extended.** Held by a table check on
   `expires_at - started_at`. One live session per system admin at a time; starting a second while
   one is live is refused. To continue past the box, the system admin starts a new session with a
   new reason, which is a new log entry.
4. **A stated reason is required**: 1 to 500 characters after trimming, held by a table check.
5. **The target is an org; in Org public it is one team of it.** Starting on Org public requires a
   team of Org public, and every read is bounded to that team, as every other Org public visibility
   surface is (ADR-076). Starting on a dedicated org takes no team, and reads span that org.
6. **The log is append-only.** `public.impersonation_action` records `start`, `end`, and each read
   (one action value per read function). No grant lets any role insert, update or delete it; only the
   definer functions write it, and none updates or deletes a row. On `public.impersonation`, the only
   column any function changes after insert is `ended_at`. Neither table is readable by
   `authenticated` until MIR-20-b adds the org's read.
7. **The actor survives their own removal.** `actor_id` carries no foreign key, and `actor_email` is a
   snapshot taken at start, so removing a system admin (a person's `delete`, ADR-074 decision 3) is
   neither blocked by nor erases the log.
8. **Delivery is split** (`.ai/01-operating-model.md` § Sizing).
   - **MIR-20** — decisions 1–7, and the panel: start a session with a reason and a box, a persistent
     banner while it is live, end it, and the first read: the roster of the impersonated org (or
     team). pgTAP proves no write and no read outside a live session.
   - **MIR-20-b** — every impersonation is visible to the org it touched: the member app shows the
     log to the touched org's `org_admin`, and, for a session on a team of Org public, to that
     team's manager. Its PLAN designs the read.
   - **MIR-20-c** — an org's calendar read under a live impersonation (plan Phase 6's "acting as"
     items). Its PLAN designs the surface, within decisions 1 and 2.

## Options considered

- **A custom JWT claim minted by an access-token hook** (the plan's *"a time-boxed claim"*).
  Rejected. The claim lives as long as the token, so ending a session early needs the token
  revoked; the client refreshes the token, so the box would depend on when the hook last ran; and
  every policy reading the claim would also need to know whether a log row exists. The row is the
  log, and checking it on each call is the server-side expiry the plan asks for.
- **Widen the member-app read policies with `or org_id = impersonated_org_id()`.** Rejected for this
  ticket. It touches every read policy at once, and a policy cannot write a log row, so a read
  through it would be unlogged — the exit criterion fails on the first `select`. MIR-20-c may still
  choose a policy route for the calendar if it can log; this ADR does not forbid it, but decision 2
  binds it: read-only, and only while live.
- **Impersonate a member** (sign in *as* them). Rejected. It would make the session able to do what
  that member can do, including write, and the log's subject would be a person, not the org the plan
  names.
- **A session with no end except expiry.** Rejected. A support task that ends early should close the
  door at once; `end_impersonation()` does.
- **Allow Org public whole.** Rejected. One reason to look at one free team would expose every other
  free team in the shared tenant, and no one in Org public could be shown the log of that (decision
  8's MIR-20-b reader is the touched team's manager).

## Consequences

- `public.impersonation` and `public.impersonation_action` are new tables with every privilege
  revoked from `anon` and `authenticated`. MIR-20-b adds the only grant or definer read on them.
- Five new `security definer` functions join the census in `supabase/tests/010-catalogue.test.sql`.
- An expired session has no `end` action row; its end is `expires_at`. The next start by the same
  system admin closes it by setting `ended_at = expires_at`.
- The panel reads its banner from the database, so a reload, or a second tab, shows the same session.
- No existing system-scope RPC changes. The reads ADR-075, ADR-079, ADR-082 and ADR-093 already give
  a system admin are decided system scope, not impersonation, and stay as they are.
- Applying the migration to the hosted project is a person's step (RULE-09).

## Revert condition

The operator decides impersonation may write, may run unboxed, or may be done without a reason —
any of which supersedes decisions 2 to 4 — or that a system admin should sign in as a member.
