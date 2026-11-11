---
doc_version: 3
last_updated: 2026-11-11
governed_by: [RULE-01, RULE-02, RULE-04, RULE-09]
---

# ADR-097 — An org address is served beside the root one first, and the flip is MIR-19-b

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-11 — at `/plan MIR-19` (ADR-008, ADR-067).

This ADR splits MIR-19, chooses how the router learns an org, and adds one function and one reserved
word to the schema. It reverses no accepted decision. It carries out plan Phase 5
(`.ai/board/plans/calechip-multi-tenancy-plan.md:261-283`) and ADR-059's *"Reachable at
`/{org_code}`"*.

## Context

Counted on 2026-11-11 at `origin/main` (MIR-15-c shipped; P4 complete).

- **`src/App.tsx:104` renders `<BrowserRouter>` with no `basename`**, and every route is absolute.
  40 files under `src/` (the system panel excluded) hold an absolute app path, and about 25 of the
  64 e2e specs assert one — `toHaveURL`, `toHaveAttribute("href", …)`, or a history walk that stops
  at `pathname === "/"`. Phase 5 done whole is far more than 12 files.
- **The member app cannot read its own org code.** `public.org` is revoked from `authenticated`
  (`20261027120000_mir11_composite_foreign_keys.sql`, after the table), and no read returns
  `org_code` to a member. The router cannot decide *own org* versus *wrong org* without one.
- **Every path reader already reads the router's pathname, not the window's.** `isCalendarPath`
  (`src/lib/viewed-team.ts:74`), `periodNavFor` (`src/lib/period.ts:296`), `isAdminAddress`
  (`src/components/AdminTabs.tsx:262`), the top bar and the sidebar all take `useLocation().pathname`.
  React Router strips a `basename` from that value (`stripBasename`, react-router 7.18.3
  `chunk-BV7QT456.mjs:858`) and prepends it to every `navigate()`, `<Link>` and `<Navigate>`
  (`:874`). Only two places read `window.location`: the guest link and the manage link, which take
  `origin` only (`src/routes/EventDetail.tsx:477`, `src/routes/GuestEvent.tsx:403`).
- **`tasks` is a first segment the app uses** (`/tasks`, `/tasks/:day`, TSK-01) **and is not on
  `org_code_not_reserved`**, which was written before TSK-01. An org named `tasks` would be shadowed
  by the route. Phase 5's exit criterion is *"No reserved word can be registered as an `org_code`"*.
- **ADR-071 decision 1** expects *"MIR-19's `/{org_code}`"* to be where a sign-up first gets an org
  of its own. That needs a sign-up write path that takes an org, which is a schema change of its own.

## Decision

1. **The router's `basename` is the org segment of the URL, and nothing else changes in the screens.**
   App keeps one `BrowserRouter`, keyed by and given `basename = "/{org_code}"` when the URL's first
   segment is an org code, and `"/"` otherwise. A segment is an org code when it matches
   `org_code_shape` and is not on the reserved list. Every existing absolute link, `navigate()` and
   path reader then works under the org with no edit. The base moves only at a *crossing*:
   - **into** an org — a root-router navigation that lands on `/{org_code}/…`;
   - **out of** one — `/signin`, `/signup`, `/guest/…` reached under an org, which are replaced by
     the same path at the root;
   - and on `popstate`, which re-reads the URL.
2. **The member app reads its org code through `public.own_org_code()`.** It is `security definer`,
   returns the `org_code` of `member_org_id(auth.uid())`, and is executable by `authenticated` only.
   It answers `null` for a caller who is not approved or is removed, as `member_org_id` does, and it
   can only ever return the caller's own org. On the seam it is `getOwnOrgCode()`; `useSession`
   carries the answer beside the membership.
3. **`tasks` joins `org_code_not_reserved`.** The migration refuses to apply if any org already holds
   that code. The client's list (a new `org-path` module under `src/lib/`, MIR-19 01-plan.md § 4.2) carries it from the start.
4. **MIR-19 serves an org address beside the root one; it moves nobody.** A member at
   `/{own_org}/…` is served the same screen as at `/…`. A member at any other org's address sees a
   not-found screen, and no screen mounts, so no read is made. A signed-out caller at an org address
   is sent to `/signin?next=` with the whole address. The root addresses keep working exactly as
   today, so the 64 existing specs are untouched.
5. **MIR-19-b is the rest of Phase 5.** It plans its own count, and splits again if it is `L`. In
   this order:
   1. **First, the e2e specs learn the org prefix**, through one helper under `tests/e2e/support/`,
      while the root addresses still serve. Each spec passes before and after the flip.
   2. **Then the flip:** `/`, signing in, signing up and every org-less app address send a member to
      `/{org_code}` and the same path. The `undecided` and `member-less` screens stay at the root.
   3. **Email links carry the org** (`supabase/functions/send-event-email/template.ts:269`).
   4. **nginx drops `$uri/`** from the SPA fallback (`docker/nginx.conf`, `location /`).
   5. **The system panel's mock reserved list gains `tasks`** (`src/lib/data/system.ts:758`).
   6. **A sign-up at `/{org_code}/signup` lands in that org** (ADR-071 decision 1). This needs a
      schema change and its own ADR.
6. **Guest links stay token-only.** `/guest/:token` is not moved under an org. The token is the whole
   address (EVT-06), and a guest has no org to be routed into. An org-prefixed guest address is
   accepted and crossed out to the root (decision 1), so a link that gains an org later still works.

## Options considered

- **All of Phase 5 in one ticket.** Rejected: it is far more than 12 files (*Context*).
- **A `/:orgCode` parent route, with every absolute link rewritten through an `orgPath()` helper.**
  Rejected for now. It edits about 40 screen files, and every later screen must remember the helper.
  A link written without it silently leaves the org. The basename makes the org the default and a
  crossing the exception, and there are four crossings.
- **`unstable_HistoryRouter` with a shared history object**, so the base is derived on every location
  change with no remount. Rejected: an `unstable_` export. The stable `BrowserRouter` plus a key does
  the same at the four crossings and on `popstate`.
- **Put `orgCode` on the `Member` domain type, as a computed field.** Rejected. `Member` is a shared
  type module with literal sites in the fixtures and both seams. The value would be `null` for every
  row except the caller's own, which is a field that lies about most rows it is on.
- **Grant `select (org_code)` on `public.org` to `authenticated`, with a policy for the caller's
  org.** Rejected. It reopens a table ADR-070 closed to members, to answer one value.
- **Flip in MIR-19 and quarantine the specs that break.** Rejected. ADR-060's quarantine is for tests
  that fail on `main` against a `BUG-` ticket, not for a planned break.
- **Move guest links under the org.** Rejected (decision 6).

## Consequences

- Until MIR-19-b ships, every page has two addresses: the root one and the same path under `/{own_org}`. Nothing links into
  the org form yet, except signing in from an org address.
- Every existing member is in Org public, whose code is `shared`. Their org address is `/shared/…`.
- The client's `org-path` module holds a third copy of the reserved list, beside the constraint and the system
  panel's mock (`src/lib/data/system.ts:758`). The member app may not import the panel's module
  (MIR-18 AC-14). The panel's copy is stale on `tasks` until MIR-19-b.
- The system panel is served at an exact `/<CALECHIP_SYSTEM_PATH>` of 32 to 128 characters
  (ADR-095 decision 1). A 32-character org code equal to that path would lose its root page to the
  panel. The odds of that are those of guessing the path.

## Revert condition

A screen needs to know its org from the URL, not just from the session. Then the `/:orgCode` parent
route replaces the basename, and the links are rewritten.
