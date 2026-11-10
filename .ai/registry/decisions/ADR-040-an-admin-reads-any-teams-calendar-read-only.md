---
doc_version: 3
last_updated: 2026-09-22
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-040 — An admin reads any team's calendar, read-only

## Status

`ACCEPTED by the operator` — 2026-09-22, in words: *"làm những thứ này thay tôi"*, the same instruction that accepted ADR-039, on which this rests. Drafted by `product` at `/triage` of
`.ai/board/ideas/2026-09-22-an-admin-manages-every-team-and-sees-only-one-calendar.md`.

**Every product decision below is the operator's, in words, recorded verbatim in that idea file**
(§ *The questions asked, and the operator's answers*, Q1–Q5, 2026-09-22). The mechanism is
`product`'s and follows the shape ADR-039 records.

**It is not `ACCEPTED` because it rests on ADR-039, which is itself `PROPOSED`.** A decision to let
an admin *read* every team cannot be accepted ahead of the decision that there are several teams to
read. When ADR-039 becomes `ACCEPTED by the operator`, this one becomes `ACCEPTED by the operator`
on the same line — its content is theirs — with no other edit.

## Context

Since 2026-09-11 an admin administers every team (ADR-039) and still sees exactly one team's
calendar, their own. `listMembers()`, `listTeamEntries()`, `listTeamEntriesOverlapping()` and
`getTeam()` are scoped to the caller's team by row-level security, deliberately, because widening the
policies would change INV-04's denominator and the threshold under every shipped screen
(`src/lib/data/index.ts:613`, `:687`, `:778`; `src/lib/data/supabase.ts:1401`). The permission table
has no row for reading another team's calendar.

## Decision

1. **An admin may select any team as the context of `/week`, `/month`, `/year` and the sidebar
   roster** (Q1 *"Đổi cả ngữ cảnh: sidebar + lịch + ngưỡng"*, Q4 *"Ba màn lịch + sidebar"*). The
   calendar, the roster and the overload threshold all become the selected team's.
2. **Read-only** (Q3 *"Chỉ xem, không động được gì"*). No write on another team's entries, threshold
   or people is added. The admin-panel screens (`/entries/pending`, `/entries/team`, `/members`,
   `/setting`) stay on the admin's own team.
3. **The entry is read in full, note included** (Q5 *"Có — giống hệt team mình"*). No narrower entry
   shape enters the seam.
4. **The roster row is unchanged** — avatar, display name, role (Q2 *"Giữ nguyên ba thứ đang có"*).
5. **Mechanism:** the new reads are `security definer` functions testing `public.is_admin` in their
   own bodies and taking a team id — the entries of that team (plain and date-overlapping), and its
   member rows including removed ones for INV-04. A non-admin gets an empty set, not an error. The
   threshold comes from `list_teams()`, which already returns the whole `team` row. **No table policy
   is widened**, for the reasons ADR-039 records.
6. **INV-04 is evaluated for the viewed team by the same single function**, given that team's roster.
   A second counting function is forbidden by INV-04 itself.

## Rationale

- **Rejected: the sidebar roster alone** (Q1 branch a). Cheap — two existing functions — but the grid
  beside the sidebar would still draw the admin's own team, and the screen would contradict itself.
- **Rejected: widening `member`, `team` and `entry` select policies for admins.** It silently changes
  `getTeam()`, `listMembers()` and the entry reads under every shipped screen — ADR-039 § Rationale.
- **Rejected: a reduced entry shape without the note** (Q5). The operator chose parity; a second
  entry type in the seam would have been a second thing to keep true.

## Consequences

- **A fourth, fifth and sixth definer function** each carry a whole team's entries, notes included, to
  whoever passes the admin test. A definer function that loses its first line leaks every team's
  notes. `.ai/standards/rbac-and-security.md` § Known weaknesses 1 applies at full strength, and the
  permission-model test is still owed — the **denials** are what it must assert.
- **Two code paths feed every calendar screen**: own team through row-level security, another team
  through the definer functions. They must return the same shapes, which the seam-parity test is
  positioned to hold.
- **Notes become readable across teams.** A member who wrote a note for their own team's admins now
  writes it for every admin. Nothing tells them.
- Write affordances are hidden while viewing another team. That is an affordance, not a control; the
  control is that no write path accepts it (ADR-005).

## Revert condition

A cross-team calendar read returning any row to a caller for whom `public.is_admin` is false, or an
absence count on another team's view that differs from the same team's own members' view of the same
date. Either one: revoke `execute` on the new functions, which returns every calendar to own-team
only without touching a shipped read.

## Affected documents

| File | Change | `doc_version` |
|---|---|---|
| `.ai/standards/rbac-and-security.md` | New row: *Read another team's entries, roster and threshold* — ❌ member, ❌ manager, ✅ admin | **5** (with ADR-039: **6**) |
| `.ai/standards/architecture.md` | The seam's new cross-team read methods named | **3** |
| `.ai/registry/invariants.md` | **Deliberately absent.** INV-04 is parameterised by team, not redefined | unchanged |
