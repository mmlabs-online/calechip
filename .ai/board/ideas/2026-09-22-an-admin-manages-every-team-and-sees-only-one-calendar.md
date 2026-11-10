---
stage: TRIAGE
agent: product
produced_at: 2026-09-22T14:28:36.737Z
inputs_read:
  - .ai/registry/decisions/ADR-039-every-admin-manages-every-team.md
  - .ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md
  - .ai/registry/features.md
  - .ai/board/backlog.md
  - .ai/templates/ticket.yaml
  - .ai/standards/data-model.md
  - .ai/steward/context.md
  - CLAUDE.md
  - .ai/00-charter.md
  - .ai/registry/invariants.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/idea.md
  - .ai/board/ideas/2026-09-09-the-sidebar-holds-every-address-and-grows-with-the-role.md
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - supabase/seed.sql
  - src/components/Sidebar.tsx
  - src/components/AdminTabs.tsx
  - src/hooks/useRoster.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/routes/Teams.tsx
consulted: []
gate: PASS
blocking_reason: ""
next_state: TRIAGE
verdict: "PROMOTE"
verdict_reason: "ADR-039 and ADR-040 are both ACCEPTED by the operator, which was the only thing the NEEDS-ADR waited on; every product decision was already the operator's (Q1-Q5). Promoted as two CAL rows, the cross-team read (CAL-11) then the read-only calendar context that consumes it (CAL-12)."
ticket_id: "CAL-11"
awaiting_adrs: []
operator_request: "Đối với role Admin, bên side bar nơi show thông tin member team theo Admin/Member/Manager, thì cho phép chọn team để xem, Tức là admin có quyền xem hết thông tin member của tất cả teams"
---

# An admin manages every team and sees only one calendar

**No verdict is written here.** This file is capture, not judgement. The verdict and any registry row
that follows one are written by `/triage`.

**No feature ID appears anywhere below.** An idea has none (RULE-01, ADR-007).

## Problem

*Derived from the request above; the operator stated a solution — a team picker in the sidebar — and
the problem below is this file's derivation, not their words.*

**Since 2026-09-11 an admin is responsible for every team on the system, and the product still shows
them exactly one team's calendar — their own.** `20260911180000_solo_many_teams.sql` records the
operator's decision that *every admin manages every team*: an admin creates, renames and deletes
teams, admits a sign-up onto any team, and moves an approved member between teams. `/teams`
(`src/routes/Teams.tsx:86`) is the screen that exercises it, reading `listTeams()` and
`listAllMembers()` together.

Everything an admin *looks at* stopped at their own team, deliberately and for a stated reason.
`listMembers()` is scoped to the caller's own team and the seam says why in terms
(`src/lib/data/index.ts:687`): it is INV-04's denominator on every calendar screen, so widening it
would have changed every absence count in the product. `listTeamEntries()` and
`listTeamEntriesOverlapping()` are row-level-security-scoped the same way
(`src/lib/data/index.ts:613`, `:778`). `getTeam()` reads `team` with no filter and `maybeSingle()`
(`src/lib/data/supabase.ts:1401`), which is why the threshold is the caller's own team's and nothing
else's.

So the gap is not a permission that was withheld. **It is a read that was never built, because when
the calendar screens were written there was one team.** An admin who is asked *"what does the
Frontend team's next month look like?"* has three answers available and none of them is the product:
count avatars on `/teams`, ask somebody on that team, or be moved onto it.

The sidebar is where the request points because the sidebar is where the roster already is. It
groups the caller's own team by role — `Admins`, `Managers`, `Members`
(`src/components/Sidebar.tsx:148-152`) — from `useRoster()`, which makes one `seam.listMembers()`
call and therefore can only ever show one team.

## Who has it

**An admin, whenever a question is about a team that is not theirs.** There are three teams' worth of
machinery on the system (`list_teams`, `list_all_members`, `create_team`, `rename_team`,
`delete_team`, `admit_member`, `move_member`) and one team's worth of calendar.

How often is not measured and this file does not claim a number. What is certain is the shape: every
one of the seven cross-team functions above was built for an admin who is looking at more than one
team, and the moment they act on one — admitting a sign-up onto it, moving somebody onto it — the
consequence of that act is invisible to them.

Not a member's problem and not a manager's. `public.is_admin` answers false for a manager by design
(`.ai/standards/rbac-and-security.md` § Roles), and all seven functions test it in their own bodies.

## Evidence

**The capability to read other teams' members already exists and is shipped.**
`public.list_all_members()` returns every member row on any team for an admin, and the seam exports
it as `listAllMembers()`. `/teams` and `/members` both call it
(`src/routes/Teams.tsx:86`, `src/routes/MemberList.tsx:150`). So the request's literal words —
*"admin có quyền xem hết thông tin member của tất cả teams"* — describe something that is already
true on two screens. What does not exist is the calendar behind it.

**Seven `security definer` functions, one calendar.** The migration header of
`20260911180000_solo_many_teams.sql` is explicit that widening the table policies was refused
precisely because it would have changed `getTeam()` and `listMembers()` under every existing screen.
That refusal is still correct; it is also the reason nothing cross-team is readable on a calendar.

No visual reference was attached. The layout of the picker and of the read-only state is therefore
`tech-lead-design`'s to originate under the `CLAUDE.md` § *No invention* carve-out, and to mark as
its own in `01-plan.md` § 2b.

### The questions asked, and the operator's answers

Verbatim, in the order they were asked on 2026-09-22.

**Q1. Khi admin chọn một team khác trong sidebar, cái gì đổi theo?** Three branches were put with
their costs: *(a)* only the sidebar roster — cheap, reuses two functions that already exist, but the
screen then contradicts itself because the grid beside the sidebar still draws the admin's own team;
*(b)* the whole context — sidebar, calendar and threshold — which needs a new cross-team entry read,
a parameterised `getTeam()`, a parameterised INV-04 denominator and an ADR; *(c)* do nothing, because
`/teams` already lists every team's members.

> **A: "Đổi cả ngữ cảnh: sidebar + lịch + ngưỡng"** — branch (b).

**Q2. "Thông tin member" trong sidebar gồm những gì?** Three branches: the three fields a roster row
already carries (avatar, name, role); plus `email`, which exists on the member row since
`20260912120000_solo_member_email.sql`; or plus `email` and `lastSignInAt`.

> **A: "Giữ nguyên ba thứ đang có"** — avatar, display name, role. No new field on a roster row.

**Q3. Khi admin đang ở ngữ cảnh của team khác, họ được làm gì ngoài xem?** Three branches: read-only;
read plus approve/reject that team's entries; or full administration of that team including its
threshold, its people and its entries.

> **A: "Chỉ xem, không động được gì"** — read-only. No row of the permission table is widened.

**Q4. Bộ chọn team đổi ngữ cảnh của những màn nào?** Two branches: the three calendar screens plus
the sidebar; or every screen that has a notion of a team, including `/entries/pending`,
`/entries/team`, `/members` and `/setting`.

> **A: "Ba màn lịch + sidebar"** — `/week`, `/month`, `/year` and the sidebar roster. The admin-panel
> screens stay the admin's own team.

**Q5. Xem lịch team khác thì có đọc được phần ghi chú (note) trên từng entry không?** Two branches:
yes, the same as one's own team, which needs no narrower shape in the seam; or no, a reduced shape
carrying who, which dates, and PTO-or-WFH only.

> **A: "Có — giống hệt team mình."** The note is readable across teams.

## Impact if ignored

An admin keeps administering teams they cannot see. Concretely, and each of these is reachable today:

- An admin moves a member onto the Frontend team (`move_member`) and **cannot tell whether that team
  is now short-handed in the week the person is already booked off**. Every past absence of that
  person moves teams with them — the migration says so in terms — and the admin who caused the move
  has no view in which to observe it.
- An admin admits a sign-up onto a team (`admit_member`) and cannot see the calendar they were
  admitted to.
- The question *"what does next month look like?"*, which `.ai/00-charter.md` § *What "working" looks
  like* names as the ten-second answer this product exists to give, has no answer at all for any team
  but one.

The workaround that will be used instead is the one the data already invites: an admin moves
themselves between teams to look, using `move_member`, which rewrites their own history onto each
team as they pass through it.

## Constraints already known

- **INV-04** — the absence count for a date is a single definition, and it depends on the roster as
  of that date. A second calendar context means the denominator must become the *viewed* team's
  member count, not a second computation of the number. The invariant is the **uniqueness** of the
  definition; parameterising the team it is evaluated for does not break it, and writing a second
  counting function would.
- **INV-04's drawing rule** — *"A view shows a member's avatar exactly when that member's entry is
  counted."* This decides a question nobody needs to ask: pending and tentative entries of another
  team are drawn, because INV-05 counts them and a view that draws fewer faces than its own number
  contradicts itself.
- **INV-07** — an entry is counted only against the team its member belongs to now. Unchanged by
  this, and it is what makes a per-team calendar well defined at all.
- **`.ai/standards/rbac-and-security.md`** — the permission table is **not widened by this idea**
  (Q3). The one new row it implies is a read: *read another team's entries and roster*, admin only.
  Recording that row is `/triage`'s and `/plan`'s, not this file's.
- **ADR-005** — the check runs in row-level security and nowhere else. A picker in the sidebar is an
  affordance; the control has to be a `security definer` function testing `is_admin` in its own body,
  the shape all seven cross-team functions already use.
- **`.ai/standards/rbac-and-security.md` § Known weaknesses 1** — row-level security is the only line
  of defence and a too-permissive policy fails open silently. A new cross-team read is exactly that
  risk, and the permission-model test asserting the **denials** is what catches it. That test is
  recorded as owed in `.ai/registry/features.md` because no project is provisioned.
- **`20260911180000_solo_many_teams.sql` § WHY SEVEN FUNCTIONS AND NOT FOUR WIDER POLICIES** — this
  is the argument any design here must not re-derive and reach the other answer. Widening `member`'s
  or `team`'s select policy silently changes `getTeam()` and `listMembers()` under every shipped
  screen.
- **`.ai/00-charter.md`** — multiple teams in one workspace is on the brief's **P2 deferred** list,
  not among the six refusals. Nothing in the charter forbids this.
- **`CLAUDE.md` § Visual direction** — the grid is the most-used screen and information density wins
  there. A team picker must not cost a row in the year view.

## Out of scope

Decided against in this conversation, and named here so the eventual ticket does not grow at PLAN.

1. **Any write against a team that is not the admin's own** (Q3). No approving or rejecting another
   team's entries, no editing or deleting another team's entries, no setting another team's
   threshold, no promoting or removing another team's people. `/teams` keeps the writes it already
   has — create, rename, delete, admit, move — and gains nothing.
2. **Switching the context of the admin-panel screens** (Q4). `/entries/pending`, `/entries/team`,
   `/members` and `/setting` stay the admin's own team. `/setting` is a **write** screen and is the
   clearest case: nothing about it changes.
3. **Any new field on a roster row** (Q2). No email, no last-sign-in. The row stays avatar, display
   name, role.
4. **A narrower entry shape for another team** (Q5). The note is readable across teams, so no second
   entry type enters the seam.
5. **Anything for a `manager` or a `member`.** `public.is_admin` is the mechanism and it answers
   false for both. A non-admin gets an empty list, not an error — the shape every cross-team read in
   this product already uses.
6. **Creating an entry on somebody else's behalf.** Still denied by default
   (`.ai/standards/rbac-and-security.md`, known weakness 7) and untouched here.
7. **A change to `/teams`.** It already does what it does.

## Assumptions this file made rather than asked

Each was judged cheap to reverse, per `CLAUDE.md` § *No invention* and the `/idea` filters. Each is
flagged so a later reader does not mistake it for a decision the operator gave.

- **The default context is the admin's own team**, on every load. Anything else would make an admin's
  own calendar the thing they have to navigate to.
- **The threshold used while viewing another team is that team's own.** `public.list_teams()` already
  returns the whole `team` row including `overload_threshold`, so this is free — and using the
  admin's own threshold would paint the wrong days crowded, which is worse than not showing the
  calendar at all.
- **While viewing another team, the write controls on the calendar are hidden** — the new-entry
  affordance and the edit path on an entry. An entry always belongs to its author and therefore to
  the author's team (INV-07), so an entry created while looking at the Frontend team would vanish
  from the screen that created it. Hiding the control is an affordance, not a control (ADR-005).
- **Removed members are filtered out of the displayed roster**, which is the decision `useRoster.ts`
  already makes for the caller's own team and `MemberList.tsx:358` makes for the member list. The
  counting functions still receive them, because INV-04 needs them.
- **The picker is offered only when there is more than one team**, and only to an admin.
- **Public holidays are unchanged.** The national calendar is not a team's.

## Open questions

Everything a downstream stage would have to invent has been asked and answered. Two things are left
deliberately, and neither blocks triage:

1. **Where the selected team is held — a URL query parameter, or component state.** A query parameter
   makes a link to another team's month shareable and survives a reload; state does not. This is
   `tech-lead-design`'s under filter 3, and the rejected alternative belongs in `01-plan.md` § 8.
2. **Whether this is one ticket or two.** The cross-team read (a migration, a seam method, the
   permission-model denials) and the interface that consumes it (the picker, the read-only calendar,
   the sidebar roster) are separable, and the first has no user-visible surface on its own. A
   judgement for `/triage`, which is also the stage that decides whether the new read row needs its
   own ADR or rides on `20260911180000_solo_many_teams.sql`'s.
3. **Added at `/triage`, 2026-09-22, by `product` — this one stops the run.** Does the operator
   confirm that ADR-039 records their 2026-09-11 decisions correctly (every admin manages every team;
   only an empty team may be deleted; a moved member's history follows them)? The only record of
   those words is a `/solo` agent's summary in the migration header, so no agent may sign
   `ACCEPTED by the operator` on it. A **yes** makes ADR-039 and ADR-040 both `ACCEPTED by the
   operator` and this idea re-triages to PROMOTE. A **no** changes the permission model, because
   ADR-040's cross-team read has no multi-team decision to stand on.

## Triage verdict — NEEDS-ADR

*`product`, 2026-09-22. The front-matter is the live answer; this heading is for a person.*

**Worth building, and not already covered.** `/teams` and `/members` show every team's people, but
no screen shows another team's calendar, threshold or crowded days — the request's literal words are
covered, its problem is not. The operator's five answers leave nothing for PLAN to invent.

**The registry disagrees with the product, and the idea is correct.**

- `.ai/registry/decisions/` holds no ADR for many teams. `20260911180000_solo_many_teams.sql:14-17`
  says its three decisions reverse `data-model.md` and two rows of `rbac-and-security.md`, and that
  *"This file must not be applied before that ADR exists."* It was written, not filed.
- `.ai/standards/data-model.md:20` still reads *"One row in v1"*, `:129` *"No delete path exists for a
  team in v1"*; `.ai/standards/rbac-and-security.md:63` limits approval to the admin's own team and
  `:120` says *"v1 has one team"*. ADR-033 carries the same own-team approval clause.

A feature row written against that registry would be planned against a permission table saying the
thing it reads does not exist. So this is NEEDS-ADR, not REJECT and not PROMOTE.

**Drafted, both `PROPOSED`:**

- `.ai/registry/decisions/ADR-039-every-admin-manages-every-team.md` — records the 2026-09-11
  decisions. Not signed by the operator: their words exist only as an agent's paraphrase. Not signed
  by `product`: it reverses part of ADR-033 (ADR-008 says ask).
- `.ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md` — the cross-team
  read, from Q1–Q5 verbatim. Its content is the operator's; it waits only on ADR-039.

That answers open question 2's second half: the new read gets **its own ADR**, because its revert
condition (revoke the new functions) is independent of ADR-039's. The one-ticket-or-two half stays
open for the re-triage that issues the ID.

**No feature row, no ticket.** Open question 3 is the one thing to answer.

## Re-triage verdict — PROMOTE, as CAL-11 then CAL-12

*`product`, 2026-09-22T14:28:36.737Z, dispatched by `scripts/run-loop.mjs`. **This is the live
verdict**; the NEEDS-ADR above is history. The front-matter carries the same answer.*

**What changed.** Both ADRs that the NEEDS-ADR waited on now read `ACCEPTED by the operator`. The
operator signed them, not this agent. That answers open question 3 **yes**. ADR-039 records the
2026-09-11 many-teams decisions, and ADR-040 gives the cross-team read something to rest on. No other
registry decision is missing. The problem statement, the five answers and the out-of-scope list
above are unchanged.

**Why two rows (open question 2, first half).** The work has two separable halves. One is the read:
a migration, the seam methods in both implementations, and the tests asserting the denials. The
other is the interface: the picker, the team-scoped `/week`, `/month`, `/year` and roster, and the
hidden write affordances. As one ticket it plausibly plans out at `L`, and `L` must split at PLAN.
MD-017 records that a shell created by a split at PLAN has no owning command. The same reasoning
split UIE-09 from UIE-10. So the split is made here, while the idea still exists to cite. The cost:
CAL-11 ships nothing a person can see, and it is only worth anything once CAL-12 lands. This file
records that cost rather than leaving it to be discovered. `CAL`, not `ADM` or `TEA`, because the
capability is *viewing entries and the overload warning*, which is CAL's expansion. The only thing
that makes it admin-only is `is_admin`.

- **CAL-11**: *An admin reads any team's entries and roster through the seam.* `schema_delta` is new
  `security definer` functions (ADR-040 decision 5). No policy is widened. `depends_on: []`.
- **CAL-12**: *An admin chooses which team the three calendar screens and the sidebar roster show,
  read-only.* `schema_delta: none`. `depends_on: [CAL-11]`.

**Owed, and not either ticket's.** ADR-039 and ADR-040 each list affected standards. None of them has
been transcribed. `.ai/standards/rbac-and-security.md:63` and `:119` still limit sign-up approval to
the admin's own team and still say v1 has one team. `.ai/standards/data-model.md:20` and `:129` still
say *"One row in v1"* and *"No delete path"*. `architecture.md` does not yet name the new seam
methods. These documents are human plane under RULE-01 and belong to `/thuki`. PLAN plans against
the two accepted ADRs wherever the standards disagree with them. Both ticket shells and the backlog
note record this.

Written: two rows in `.ai/registry/features.md`, `.ai/board/tickets/CAL-11/ticket.yaml`,
`.ai/board/tickets/CAL-12/ticket.yaml`, and two rows in `.ai/board/backlog.md` § BACKLOG. No
image was attached, so none moved.
