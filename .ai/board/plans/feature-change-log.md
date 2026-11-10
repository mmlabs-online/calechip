---
doc_version: 1
last_updated: 2026-10-12
governed_by: [RULE-01]
---

# Feature change log — multi-tenancy

**The back-reference from the existing features to the MIR items that change them**, keyed by feature
ID. Titles are transcribed from [features.md](../../registry/features.md) without paraphrase. Status of
the MIR items themselves lives only in [multi-tenancy-status.md](multi-tenancy-status.md).

`CHANGED` — the feature still does what its description says, but behaves differently.
`SUPERSEDED` — the feature's current behaviour becomes wrong, or is replaced.

## Rules

- **At plan time every entry is `[predicted]`.** Each was predicted from
  [the plan](calechip-multi-tenancy-plan.md) and [the audit](../audits/multi-tenancy-audit-2026-10-12.md),
  with the `file:line` that grounds it.
- **When a MIR item ships, its pull request replaces the prediction with a dated entry:**
  `- 2026-11-04 MIR-23 CHANGED — <what actually changed>`
- **A shipped item that touched an unpredicted feature adds a new entry; the original prediction stays**
  as a record of what was missed. A new feature section is added when the feature has none.
- **A `SUPERSEDED` entry must say what replaces the old behaviour.**
- **A feature marked `SUPERSEDED` gets its row in `.ai/registry/features.md` annotated, not deleted.**
  That annotation lands with the shipping pull request, under RULE-01's review; nothing is annotated at
  plan time.
- **A pull request that changes no existing feature's behaviour** says `FEATURE-IMPACT: none` in its
  body instead of editing this file. `.github/scripts/check-mir-tracking.mjs` checks for one or the other.

---

## CAL-01 — Create an entry for themselves, over a range of dates

- [predicted] MIR-12 CHANGED — an entry carries `org_id` and `primary_team_id`; the insert grant is column-scoped (`supabase.ts:1865-1877`, `cal01:192`)

## CAL-03 — Edit or delete another member's entry, as an admin

- [predicted] MIR-17 CHANGED — the team-entries guard is replaced (`TeamEntries.tsx:82`)

## CAL-04 — Month view — a day grid showing who is away and which days are overloaded

- [predicted] MIR-13 CHANGED — entries are readable for every team the caller belongs to (`entry_select_team`, `cal01:203-207`)
- [predicted] MIR-19 CHANGED — `/month` moves under `/{org_code}` (`MonthView.tsx:512`, `src/lib/period.ts`)

## CAL-05 — Week view — per-person detail for one week, with half-days, notes and who approved

- [predicted] MIR-13 CHANGED — entries are readable for every team the caller belongs to (`entry_select_team`, `cal01:203-207`)
- [predicted] MIR-19 CHANGED — `/week` moves under `/{org_code}` (`WeekView.tsx:577`)

## CAL-07 — Overload warning shown while choosing dates, before the entry is saved

- [predicted] MIR-13 CHANGED — `getTeam()` no longer assumes one team (`supabase.ts:2092-2095`; warning source `usePageOverload.ts:118-135`)

## CAL-08 — Holidays and bridge days shown in the calendar views

- [predicted] MIR-12 CHANGED — the holidays shown are the national set plus org days, per org

## CAL-10 — Year overview — twelve month cards with a year summary band

- [predicted] MIR-13 CHANGED — entries are readable for every team the caller belongs to (`entry_select_team`, `cal01:203-207`)
- [predicted] MIR-19 CHANGED — `/year` moves under `/{org_code}`

## CAL-11 — An admin reads any team's entries and roster through the seam

- [predicted] MIR-13 SUPERSEDED — an admin no longer reads *any* team's entries and roster. Replaced by: cross-team reads bounded by the caller's org, with no trust in the client-supplied `p_team_id` alone

## CAL-12 — An admin chooses which team the three calendar screens and the sidebar roster show, read-only

- [predicted] MIR-13 CHANGED — the teams offered are bounded by the caller's org
- [predicted] MIR-17 CHANGED — the admin-only team picker is re-keyed (`viewed-team.ts:61`, `:85`, `useViewedTeam.tsx:56,76`)
- [predicted] MIR-19 CHANGED — the calendar-path regex is no longer anchored at `^\/` (`viewed-team.ts:74`)

## CAL-13 — A member marks a date busy; the team sees how many people did, and who

- [predicted] MIR-12 CHANGED — a busy day carries `org_id`; the insert grant is `insert (date)` only (`busy_day:81`)
- [predicted] MIR-13 CHANGED — busy days are readable across the caller's teams (`busy_day:97-105`)

## ADM-01 — Set the overload threshold

- [predicted] MIR-09 CHANGED — a threshold outside the new check constraint is refused by the database
- [predicted] MIR-13 CHANGED — the threshold is set for one named team, not every admitted row (`supabase.ts:2135-2140`)
- [predicted] MIR-17 CHANGED — the threshold screen guard is replaced (`Threshold.tsx:125`)

## ADM-02 — The national holiday calendar, seeded and readable

- [predicted] MIR-12 CHANGED — the calendar becomes `unique (org_id, date)` instead of one global row per date (`adm02:33`, `adm02seed:30`)

## ADM-03 — Add, edit or delete a holiday or swap day

- [predicted] MIR-12 CHANGED — `addHoliday` must write `org_id` (`supabase.ts:2694-2698`)
- [predicted] MIR-15 SUPERSEDED — a team's admin no longer edits the holiday calendar for Org public. Replaced by: only `system_admin` sets holidays for Org public — and every existing team lands there (MIR-12)
- [predicted] MIR-16 CHANGED — holiday writes re-pointed: national set system-owned, org days layered (plan:41-42, 47)
- [predicted] MIR-17 CHANGED — the holidays screen guard is replaced (`Holidays.tsx:216`)

## ADM-04 — The worklist of entries awaiting a decision

- [predicted] MIR-14 CHANGED — an entry appears in the queue of every relevant team's manager and clears from the others once one decides; the UI shows which teams it affects
- [predicted] MIR-17 CHANGED — `mayDecide` / `mayDecideEntriesOf` take a team (`roles.ts:36-49`, `PendingEntries.tsx:245`, `:621`)

## ADM-05 — Approve or reject an entry, with a reason on rejection

- [predicted] MIR-14 CHANGED — one manager's decision is sufficient for a multi-team member; a rejection records `rejected_by`; a team with no manager falls back to `org_admin`
- [predicted] MIR-16 CHANGED — `may_decide` gains a team parameter (`manager_role:62`)

## ADM-06 — Reject several entries at once, with one reason for the batch

- [predicted] MIR-14 CHANGED — a bulk rejection records `rejected_by` (`reject_entries` records no actor, `adm06:73-86`)

## ADM-07 — A member reports an issue, with optional screenshots, from a floating button; an admin reads the reports and sees how many are not done

- [predicted] MIR-12 CHANGED — a report carries `org_id`; the insert grant is column-scoped (`supabase.ts:3059-3070`, `issue_img:78`)
- [predicted] MIR-16 SUPERSEDED — an admin no longer reads every report. Replaced by: issue reports re-pointed to system scope
- [predicted] MIR-17 CHANGED — the reports screen guard is replaced (`IssueReports.tsx:94`)

## ADM-08 — A team chooses, per entry type, whether a new entry waits for an admin

- [predicted] MIR-12 CHANGED — `entry_apply_approval_setting` stops joining through `m.team_id` (`approval_settings:111-118`)
- [predicted] MIR-13 CHANGED — approval switches are set for one named team (`supabase.ts:2374-2379`)
- [predicted] MIR-14 CHANGED — the approval switches are OR-ed across every team the owner belongs to (`approval_settings:111-118`)

## TEA-01 — Sign up and establish the member record

- [predicted] MIR-12 CHANGED — the admission trigger must write `org_id` (`avatar_images:63-79`)

## TEA-02 — Manage the allow-list

- [predicted] MIR-09 SUPERSEDED — the allow-list table was already dropped at `member_approval:185`; this item removes the last references to it. Replaced by: sign-up followed by an admin decision (TEA-09, ADR-033)

## TEA-03 — Team member list

- [predicted] MIR-13 CHANGED — the member list spans every team the caller belongs to (`member_select_team`, `tea03:34-36`)

## TEA-04 — Remove a member, and promote a member to admin

- [predicted] MIR-02 CHANGED — role and removal writes move behind definer RPCs instead of the column grant
- [predicted] MIR-03 CHANGED — promoting a member to admin no longer goes through `set_member_role` (`promoteMember` → `setRankThroughRpc`, `supabase.ts:1628-1634`)
- [predicted] MIR-16 CHANGED — promotion is to `org_admin`; `admin` is no longer a value

## TEA-05 — Sign in, sign out, and the member-less landing state

- [predicted] MIR-19 CHANGED — signing in resolves the user's org and redirects there (`AuthCard.tsx:60`, `:68`)

## TEA-06 — The member tab shows team and last sign-in, and carries view, edit and delete per row

- [predicted] MIR-17 CHANGED — `canRemove`, `canPromote`, `canSetManager` are scoped (`MemberList.tsx:349-366`)

## TEA-08 — An admin sets a rank on any team

- [predicted] MIR-03 SUPERSEDED — an admin no longer sets a rank on *any* team. Replaced by: a rank is set only for members the admin actually administers, and promotion to admin is a separate, separately gated action
- [predicted] MIR-16 CHANGED — ranks become `org_admin` | `member` on `member.role`, with manager per team

## TEA-09 — A person signs up, waits, and an admin admits them onto a team or rejects them

- [predicted] MIR-02 CHANGED — rejecting a sign-up writes `status` / `team_id` through an RPC instead of a plain update (`supabase.ts:1476-1481`)
- [predicted] MIR-12 CHANGED — a pending sign-up has no team to derive an org from (`member_approval:50`, `avatar_images:66`)
- [predicted] MIR-13 CHANGED — `admit_member` gains an org condition (`many_teams:151-170`)
- [predicted] MIR-16 CHANGED — the sign-up queue is decided by `org_admin` (operator, 2026-10-12) — today's admin, bounded to their org — instead of by any admin across the system
- [predicted] MIR-17 CHANGED — the sign-up screen guard is replaced (`NewSignups.tsx:76`)

## TEA-10 — A member edits their own display name, avatar and password from a profile screen

- [predicted] MIR-02 CHANGED — the profile write keeps name and avatar; the grant it shares no longer carries `role`, `status` or `team_id`

## TEA-11 — An admin creates, renames and deletes an empty team, admits a sign-up onto any team, and moves a member between teams

- [predicted] MIR-02 CHANGED — moving a member writes `team_id` through an RPC instead of a plain update (`supabase.ts:1609-1614`)
- [predicted] MIR-12 CHANGED — `create_team` must write `org_id` (`many_teams:93`)
- [predicted] MIR-13 SUPERSEDED — an admin no longer admits a sign-up onto, or moves a member to, *any* team. Replaced by: team management bounded by the admin's org, with membership rows instead of a single `member.team_id`
- [predicted] MIR-17 CHANGED — the Teams guard is replaced (`Teams.tsx:81`) and managers stop being labelled "Member" (`Teams.tsx:337`)

## TEA-12 — A third role, manager, decides entries and nothing else

- [predicted] MIR-03 CHANGED — making someone a manager is bounded to members the admin administers
- [predicted] MIR-14 SUPERSEDED — a manager may no longer be refused their own entry (`mgr_gen_cols:58-61`). Replaced by: a manager may approve their own entry, recorded as `self_approved = true`
- [predicted] MIR-16 SUPERSEDED — manager is no longer one global value on `member.role`. Replaced by: `membership.role_in_team`, a manager of one team who approves and sets team config (plan:26)

## UIE-02 — The application shell — a persistent sidebar and top bar

- [predicted] MIR-19 CHANGED — shell links and `navigate()` calls become org-relative (`Sidebar.tsx:293`, `TopBar.tsx:278-307`, `BrandLogo.tsx:31`)

## UIE-09 — An admin hub screen at `/admin`, reachable from one control in the top bar

- [predicted] MIR-17 CHANGED — the hub's guard `me.role !== "admin"` is replaced (`AdminHub.tsx:72`)
- [predicted] MIR-19 CHANGED — `/admin` and `isAdminAddress` / `ADMIN_ADDRESSES` move under the org (`AdminTabs.tsx:251-271`)

## EVT-01 — A member announces an event to their own team, to named people, or to every team, and those it is for can read it

- [predicted] MIR-04 CHANGED — the named-people picker offers only members of the caller's own teams
- [predicted] MIR-12 CHANGED — `save_event` and `event_stamp` must write `org_id` on the event and its invitees (`evt02:168-172`, `evt01:105`, `evt02:206-213`)
- [predicted] MIR-13 CHANGED — team-scoped visibility resolves through all of the caller's teams (`evt02:332-346`)
- [predicted] MIR-15 SUPERSEDED — in Org public an event with scope `public` no longer reaches every team, and the directory no longer spans teams. Replaced by: when `is_shared_tenant`, a `public` event and the directory stay within the team. Every existing team is backfilled into Org public by MIR-12, so this applies to all of today's data
- [predicted] MIR-16 CHANGED — the admin override over every event is re-pointed (`evt01:134-142`, `evt02:332-346`)
- [predicted] MIR-17 CHANGED — `mayEditEvent` gains a team comparison (`EventDetail.tsx:51-53`)

## EVT-02 — A member joins an event they can read, within its capacity, approval mode and deadline, and everyone who can read it sees who is coming

- [predicted] MIR-12 CHANGED — joining an event carries `org_id`; the grant is `insert (event_id)` only (`evt02:406`)
- [predicted] MIR-15 CHANGED — in Org public a member can no longer join another team's `public` event (`is_event_audience`, `evt02:112-125`)
- [predicted] MIR-16 CHANGED — an admin's decision on any event's attendance is re-pointed (`may_manage_event`)

## EVT-04 — A person is notified in the app when an event concerns them

- [predicted] MIR-12 CHANGED — `notify()` must write `org_id` (`evt04:133-142`)
- [predicted] MIR-15 CHANGED — `notify_event_created` no longer notifies across teams in Org public (`evt04:154-174`)

## EVT-05 — A person is emailed when an event for their team is created, when they are invited, and when their request is decided

- [predicted] MIR-19 CHANGED — email links carry the org (`send-event-email/template.ts:197`)

## EVT-06 — A creator opens an event to guests, and anyone with its link reads it and who is coming

- [predicted] MIR-16 CHANGED — an admin opening any event to guests is re-pointed (`may_manage_event`, rbac-and-security.md:81)
- [predicted] MIR-19 CHANGED — guest links carry the org (`EventDetail.tsx:57`, `GuestEvent.tsx:48`)

## EVT-07 — A guest registers for an opened event with a name and an email, and manages it from a link shown once

- [predicted] MIR-12 CHANGED — `register_guest` (anon) must write `org_id` (`evt07:373-375`)
