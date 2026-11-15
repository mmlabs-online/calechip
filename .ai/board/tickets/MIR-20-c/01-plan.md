---
ticket: MIR-20-c
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-15T03:38:35Z
inputs_read:
  - .ai/board/tickets/MIR-20-c/ticket.yaml
  - .ai/board/tickets/MIR-20/01-plan.md
  - .ai/board/tickets/MIR-20-b/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-100-impersonation-is-a-logged-time-boxed-session-that-unlocks-definer-reads-only.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/01-operating-model.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/plan.md
  - supabase/migrations/20261112180000_mir20_impersonation.sql
  - supabase/tests/390-impersonation.test.sql
  - supabase/tests/400-impersonation-log.test.sql
  - supabase/tests/010-catalogue.test.sql
  - src/lib/data/system.ts
  - src/system/main.tsx
  - src/lib/fixtures.ts
  - src/lib/domain/types.ts
  - src/index.css
  - tests/e2e/mir-20-impersonation.spec.ts
  - tests/system-reserved-org-codes.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-20-c — a system admin reads an org's calendar only under a live, logged impersonation

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:309`):

| ID | Feature | Group |
|---|---|---|
| MIR-20 | system_admin impersonation is read-only, time-boxed, reasoned and logged, and visible to the org it touched | MIR |

**Plan item:** Phase 6, *Impersonation and audit* (`.ai/board/plans/calechip-multi-tenancy-plan.md:287-305`):
checklist *"Identity resolution currently hard-wired to `getUser()` then the member row … needs an
'acting as' concept"*; exit criterion *"No path gives `system_admin` org data outside a logged session"*.

**The slice, ADR-100 decision 8, third bullet:** *"MIR-20-c — an org's calendar read under a live
impersonation (plan Phase 6's 'acting as' items). Its PLAN designs the surface, within decisions 1 and
2."* MIR-20 shipped the session (`public.impersonation`), its log and the roster read in the system
panel; MIR-20-b showed the log to the touched org. This ticket adds the second read a live session
unlocks: the calendar entries of the impersonated org (or, in Org public, of the one team).

**The "acting as" concept, as this plan settles it.** Acting as an org *is* the live session row: a
definer read asks `public.impersonated_org_id()` which org the caller is acting as, and returns that
org's rows only. The member app's identity resolution (`useSession.ts`, `supabase.ts` `getUser()` then
the member row) is not changed: a system admin never signs in to the member app as anybody (ADR-100,
Options — *impersonate a member*, rejected), and the panel never imports the member app (ADR-074
decision 6). § 8 argues the member-app route that was rejected.

**Who gains what.** A system admin with a live session sees, in the system panel under the roster, the
month's PTO and WFH entries of the org (or team) they are supporting — who, which type, which portion,
which dates, pending or approved, tentative or not — and can step a month back or forward. Each month
shown is one database read that writes one `read_calendar` row to the log, so the org's `org_admin`
(and, in Org public, the team's manager) sees it counted in the *Reads* column MIR-20-b shipped. Outside
a live session the read is refused before it writes or returns anything. The calendar is read-only: the
section has no control that changes anything, and no write path accepts a session (ADR-100 decision 2).

**Out of scope:**

- **The member app under impersonation** — an "acting as" banner in the member app, the year grid, the
  member app's `useSession.ts`, `viewed-team.ts` `isReadOnly`, and every member-app read policy. § 8.
- **Holidays, events, notes, rejection reasons, approvers and the org's settings.** The read returns the
  entry columns named in § 4.1 only. National and org holidays are already read through decided
  system-scope RPCs (ADR-079), not through impersonation.
- **Rejected entries.** They are not on a team's calendar and count toward nothing (INV-04); the read
  returns `pending` and `approved` only.
- **Any absence count, busy-day or overload marker.** INV-04 allows exactly one definition of the
  count (`absenceCountsFor`); this read computes none, and the panel shows a list, not a grid.
- **A range wider than 31 days**, a date picker, or a year view. The panel steps by calendar month.
- **Entries of removed members**, and, in Org public, of members no longer on the team. The calendar
  shows the same people the roster shows (MIR-20 AC-14).
- **Writing anything as or for the org.** Refused permanently by ADR-100 decision 2.
- **`.ai/standards/rbac-and-security.md` A15** — human plane. With this ticket the "acting as" half
  ships in the panel's form; retiring or rewording A15 is the operator's edit.
- **The glossary's stale *System admin* row** — a registry rewrite for the steward (`glossary_owed: []`).
- **Applying the migration to the hosted project** — a person's step (RULE-09).

`size_estimate`: **M**.

## 2. Acceptance criteria

Terms. **Live session:** as MIR-20 — a `public.impersonation` row of the caller with `ended_at is null`
and `expires_at > now()`, the caller a system admin at `aal2`. **The calendar function:**
`public.impersonated_calendar(p_start date, p_end date)` (§ 4.1). **Overlaps the range:**
`start_date <= p_end and end_date >= p_start`. **The mock panel:** the panel built with the mock seam,
signed in as MIR-20's e2e signs in (`ops@calechip.test` / `calechip-demo` / code `246810`), with
Playwright's clock installed at `2026-09-10T03:00:00Z` before the first `goto`.

### The panel (mock build, e2e `tests/e2e/mir-20-c-impersonated-calendar.spec.ts`)

**AC-1 — a session on a team of Org public shows that team's month**
- Given the mock panel, signed in, with no live session
- When the system admin starts a session on `Org public`, team `CaleChip`, with any reason
- Then `system-calendar` is visible and follows `system-roster` in document order
- And `system-calendar-month` reads `September 2026`
- And exactly one `system-calendar-row` is shown, with `data-entry-id` =
  `dd000000-0000-4000-8000-000000000001`, and cells `system-calendar-name` `Đã duyệt`,
  `system-calendar-type` `PTO`, `system-calendar-portion` `Full day`, `system-calendar-dates`
  `2026-09-14 – 2026-09-16`, `system-calendar-status` `approved`, `system-calendar-tentative` empty.

**AC-2 — the other team's month is the other team's**
- Given the mock panel, signed in, with no live session
- When the system admin starts a session on `Org public`, team `Nhóm khác`
- Then exactly one `system-calendar-row` is shown, with cells `Người nhóm khác`, `PTO`, `Full day`,
  `2026-09-21 – 2026-09-22`, `pending`, empty
- And no row names `Đã duyệt`.

**AC-3 — stepping through months**
- Given AC-1's screen
- When `system-calendar-prev` is pressed
- Then `system-calendar-month` reads `August 2026`, no `system-calendar-row` is shown, and
  `system-calendar-empty` reads `Nothing on the calendar this month.`
- When `system-calendar-next` is pressed twice
- Then `system-calendar-month` reads `October 2026` and `system-calendar-empty` is shown
- When `system-calendar-prev` is pressed once more
- Then `system-calendar-month` reads `September 2026` and AC-1's one row is shown again.

**AC-4 — a dedicated org with no entries**
- Given the mock panel, signed in, with no live session
- When the system admin starts a session on `Acme Studio`
- Then `system-calendar` is visible and `system-calendar-empty` reads `Nothing on the calendar this month.`

**AC-5 — the calendar offers no write**
- Given AC-1's screen
- Then `system-calendar` contains no `input`, `select`, `textarea` or `a` element, and exactly two
  `button`s: `system-calendar-prev` and `system-calendar-next`.

**AC-6 — no calendar without a live session**
- Given the mock panel, signed in, with no live session
- Then no `system-calendar` is shown
- When a session on `Acme Studio` is started and then `system-impersonation-end` is pressed
- Then no `system-calendar` is shown
- When a new 30-minute session on `Acme Studio` is started and the page clock is fast-forwarded 31 minutes
- Then within 30 seconds no `system-calendar` is shown, and `system-impersonation-expired` is.

### The database (pgTAP, `supabase/tests/410-impersonated-calendar.test.sql`)

The cast is the file's own, added as the owner on top of `tests.seed()`, before any `authenticate_*`
call. Dedicated org **A**: team A1 with approved members **Ann** and **Abe**; **Rem**, removed, on A1.
Dedicated org **B**: team B1 with **Bea**. In Org public: team **P1** with **Pam** and **Pat**, team
**P2** with **Pam** and **Pru**, and **Lea**, whose P1 membership has `left_at` set. A system admin
**Sys**, and **Sys2**. Entries, all inside or around 2026-09-01..2026-09-30 unless stated: Ann `pto
full` 09-14..09-16 approved; Ann `wfh am` 08-28..09-02 pending tentative (crosses the range's start);
Abe `wfh full` 09-10 rejected; Abe `pto pm` 10-05 approved (outside); Rem `pto full` 09-20 approved;
Bea `pto full` 09-14 approved; Pam `wfh full` 09-15 approved; Pat `pto am` 09-16 pending; Pru `pto
full` 09-17 approved; Lea `pto full` 09-18 approved.

**AC-7 — only a system admin at `aal2` may call it**
- Given Ann (approved member), an `org_admin` of A, Sys at `aal1`, and `anon`
- When each calls the calendar function for 2026-09-01..2026-09-30
- Then each raises `42501`, and the count of `public.impersonation_action` rows is unchanged.

**AC-8 — no live session, no read, no log row**
- Given Sys at `aal2`, first with no session, then with an own session whose `expires_at` is in the
  past and `ended_at` is null (inserted as the owner)
- When Sys calls the calendar function for 2026-09-01..2026-09-30
- Then each call raises `42501`, and no `read_calendar` action exists.

**AC-9 — a bad range is refused before anything is written**
- Given Sys with a live session on A
- When the calendar function is called with `p_start` null, `p_end` null, `p_end` before `p_start`,
  or `p_end - p_start` of `31` days (2026-09-01..2026-10-02)
- Then each raises `22023`, and no `read_calendar` action exists for the session
- And 2026-10-01..2026-10-31 (`p_end - p_start` = 30) is accepted.

**AC-10 — a dedicated org's month**
- Given Sys with a live session on A
- When Sys calls the calendar function for 2026-09-01..2026-09-30
- Then it returns exactly Ann's two entries, ordered `start_date`, then `display_name`, then `entry_id`
  (the `wfh am` entry first)
- And Abe's rejected entry, Abe's October entry, Rem's entry, Bea's entry and every Org public entry
  are absent
- And each returned row's `entry_id`, `member_id`, `display_name`, `type`, `portion`, `start_date`,
  `end_date`, `tentative` and `status` equal the stored values (`type`, `portion`, `status` as text)
- And exactly one `read_calendar` action is written for the session.

**AC-11 — a team of Org public's month**
- Given Sys2 with a live session on Org public, team P1
- When Sys2 calls the calendar function for 2026-09-01..2026-09-30
- Then it returns exactly Pam's and Pat's entries, Pam's once though she is also on P2
- And Pru's entry (P2 only) and Lea's entry (left P1) are absent
- And exactly one `read_calendar` action is written for that session.

**AC-12 — the read changes no org data**
- Given AC-10's session
- When the calendar function is called
- Then an md5 of `public.entry` read as the owner is unchanged, and Sys's own `select` on
  `public.entry` still returns zero rows.

**AC-13 — the org sees the calendar reads in its log**
- Given Sys ends AC-10's session with `end_impersonation()`, starts a new one on A, and then calls
  `impersonated_roster()` once and the calendar function twice
- When A's `org_admin` calls `public.list_impersonation_log()`
- Then the new session's row has `reads` = `3`.

**AC-14 — the action value is known, and only it was added**
- Given the owner
- When an `impersonation_action` row is inserted with `action = 'read_calendar'`, and another with
  `action = 'read_entries'`
- Then the first succeeds and the second raises `23514`.

**AC-15 — the census and the earlier suites**
- Given `supabase/tests/010-catalogue.test.sql`
- Then its definer census lists `public.impersonated_calendar(date,date)` and passes
- And `390-impersonation.test.sql` and `400-impersonation-log.test.sql` pass unedited.

**Invariants touched.** `[INV-04]`. The read lists entries the absence count is computed from, so it is
exactly where a second definition of the count could appear; it computes none — no sum, no portion
weight, no per-day total, in SQL, the mock or the panel — and `absenceCountsFor` stays the only
definition. INV-07 is not touched: entries are listed per member, and a multi-team member's entry is
returned once (AC-11), which is a list, not a count against teams.

**Open questions.** None that blocks. Four choices are this plan's own, each inside ADR-100 decision 8
(*"Its PLAN designs the surface"*) and argued in § 8: the surface is the panel, not the member app; a
read is one calendar month; rejected entries, notes and reasons are not returned; the people shown are
the roster's people.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image is in `.ai/board/tickets/MIR-20-c/` and no idea file promotes this ticket. The arrangement:

- **Placement** — a `section`, `system-calendar`, rendered directly after `system-roster` inside
  `system-signed-in`, only while a session is live. Same card treatment as the roster section.
- **Heading row** — `h2` *Calendar — {org label}* (the banner's label), then at the right
  `system-calendar-prev` (`‹`, `aria-label="Previous month"`), `system-calendar-month`
  (`tabular-nums font-semibold`, e.g. *September 2026*), `system-calendar-next` (`›`,
  `aria-label="Next month"`), both buttons the panel's `smallSecondaryButtonClass`. Buttons are disabled
  while a read is in flight.
- **Table** — styled as the roster table (`headerCellClass` header cells). Columns in order: *Name*,
  *Type*, *Portion*, *Dates*, *Status*, *Tentative*. The *Type* cell is a chip, `rounded-pill px-2
  text-xs font-semibold`, `bg-pto text-pto-ink` for PTO and `bg-wfh text-wfh-ink` for WFH — the
  meaning tokens, because these are calendar facts. A tentative row carries `opacity-70` and a dashed
  border on the chip (`border border-dashed`), per the visual direction. No overload colour: no count
  is computed.
- **Empty** — `system-calendar-empty`, `text-ink-3`: *Nothing on the calendar this month.*
- **Loading / error** — `system-calendar-loading` (`role="status"`, *Loading calendar…*);
  `system-calendar-error` (`role="alert"`, the failure message) with `system-calendar-retry`
  (*Try again*). Retry re-reads the same month, which is one more logged read.

## 3. Permission model

The server side is the control; the panel's rendering of the section only while a session is live is
an affordance.

| Action | Who may | Where the check lives | Who must not |
|---|---|---|---|
| Read an org's calendar | a system admin (`is_system_admin()`: row + `aal2`) **with a live session**, for that session's org, or that session's team in Org public | `impersonated_calendar`, first statements: `is_system_admin()` then `impersonated_org_id()` not null, both `42501`, before any write | member, manager, `org_admin`, a system admin at `aal1`, a system admin with no or an expired session, `anon` |
| Read another org's, or another team's, entries under a session | **nobody** | the function's row predicate: `e.org_id = v_org`, and for a team session an active membership on that team | system admins, live session or not |
| Read rejected entries, notes, rejection reasons, approvers | **nobody** through this function | the column list and `e.status <> 'rejected'` | everyone |
| Read `public.entry` directly | unchanged — a system admin has no `member` row, so every entry select policy returns nothing | existing RLS (MIR-20 AC-16) | system admins |
| Write anything under a session | **nobody** — ADR-100 decision 2; the section has no write control and the seam method is a read | no write path accepts a session | every role |
| Insert or read the log | unchanged from MIR-20 / MIR-20-b; only the definer writes `read_calendar` | no grant on `impersonation_action` | every role |

## 4. Contract

### 4.1 Migration `supabase/migrations/20261115090000_mir20c_impersonated_calendar.sql`

Idempotent (ADR-024): `drop constraint if exists` then `add constraint`, `create or replace`, grants
restated. One `begin; … commit;`.

```sql
-- ADR-100 decision 6: one action value per read function. Every existing row is in the new set.
alter table public.impersonation_action drop constraint if exists impersonation_action_known;
alter table public.impersonation_action add constraint impersonation_action_known
  check (action in ('start', 'end', 'read_roster', 'read_calendar'));

-- 42501 not a system admin, or impersonated_org_id() is null.
-- 22023 p_start or p_end null, p_end < p_start, or p_end - p_start > 30.
-- All three checks run BEFORE any write. Then inserts action 'read_calendar' for the caller's live
-- session and returns at most 1000 rows, ordered start_date, display_name, entry_id.
create or replace function public.impersonated_calendar(p_start date, p_end date)
  returns table (
    entry_id     uuid,
    member_id    uuid,
    display_name text,
    type         text,     -- e.type::text: 'pto' | 'wfh'
    portion      text,     -- e.portion::text: 'full' | 'am' | 'pm'
    start_date   date,
    end_date     date,
    tentative    boolean,
    status       text      -- e.status::text: 'pending' | 'approved'
  )
  language plpgsql volatile security definer set search_path = '';
revoke all on function public.impersonated_calendar(date, date) from public, anon;
grant execute on function public.impersonated_calendar(date, date) to authenticated;
```

The row predicate, exactly (every reference qualified — `returns table` names are PL/pgSQL variables;
`v_org` from `impersonated_org_id()`, `v_team_id` the live session's `team_id`, read as
`impersonated_roster()` reads it):

```sql
select e.id, e.member_id, m.display_name, e.type::text, e.portion::text,
       e.start_date, e.end_date, e.tentative, e.status::text
  from public.entry e
  join public.member m on m.id = e.member_id
 where e.org_id = v_org
   and m.removed_at is null
   and e.status <> 'rejected'::public.entry_status
   and e.start_date <= p_end
   and e.end_date >= p_start
   and (v_team_id is null
        or exists (select 1 from public.membership ms
                    where ms.member_id = m.id and ms.team_id = v_team_id
                      and ms.org_id = v_org and ms.left_at is null))
 order by e.start_date, m.display_name, e.id
 limit 1000
```

No table, column, index, policy, trigger or grant other than the one constraint above and the new
function changes. No existing function is replaced.

### 4.2 Seam `src/lib/data/system.ts` — additions only

```ts
// MIR-20-c — the calendar read under a live session. 01-plan.md § 4.2, ADR-100 decision 8.
/** The widest range `impersonated_calendar` accepts, inclusive: `p_end - p_start <= 30`. */
export const IMPERSONATED_CALENDAR_MAX_DAYS = 31;

/** One row of `public.impersonated_calendar()`. */
export interface ImpersonatedCalendarRow {
  entryId: string;
  memberId: string;
  displayName: string;
  type: string;      // 'pto' | 'wfh', as written
  portion: string;   // 'full' | 'am' | 'pm', as written
  startDate: string; // yyyy-MM-dd
  endDate: string;   // yyyy-MM-dd, inclusive
  tentative: boolean;
  status: string;    // 'pending' | 'approved', as written
}

// On SystemSeam:
  /** `rpc("impersonated_calendar", { p_start, p_end })`, mapped to camelCase, in the function's order. Never throws. MIR-20-c. */
  impersonatedCalendar(range: DateRange): Promise<ImpersonationResult<ImpersonatedCalendarRow[]>>;
```

`DateRange` is the existing import from `@/lib/domain/types` (`{ start, end }`, `yyyy-MM-dd`); that
module is not edited. Errors go through the existing `impersonationFailureCode` / `impersonationRefusal`:
`42501` → `not_permitted`, `22023` → `invalid_impersonation` (the panel never sends a bad range; the
message is MIR-20's), anything else or a throw → `network`. Private: a row type `CalendarRpcRow`
(`entry_id`, `member_id`, `display_name`, `type`, `portion`, `start_date`, `end_date`, `tentative`,
`status`) and a mapper `toCalendarRow(row: CalendarRpcRow)`.

**The mock**, beside `mockRosters`, module state:

```ts
// Keyed as mockRosters is: by team id; a dedicated org's key is its own id. Acme Studio has none.
const mockCalendars = new Map<string, ImpersonatedCalendarRow[]>([
  [FIXTURE_TEAM.id, [/* from FIXTURE_APPROVED_ENTRY, displayName FIXTURE_APPROVED_MEMBER.displayName */]],
  [FIXTURE_OTHER_TEAM.id, [/* from FIXTURE_OTHER_TEAM_ENTRY, displayName FIXTURE_OTHER_TEAM_MEMBER.displayName */]],
]);
```

Each row built by a private `mockCalendarRow(entry: Entry, displayName: string)` copying `id`,
`memberId`, `type`, `portion`, `startDate`, `endDate`, `tentative`, `status`. `impersonatedCalendar`
mirrors the database's order of refusal: not `mockMaySeeOrgs()` → `not_permitted`; no
`mockLiveImpersonation()` → `not_permitted`; a missing date, `end < start`, or more than
`IMPERSONATED_CALENDAR_MAX_DAYS` days inclusive → `invalid_impersonation`. Then the rows of
`mockCalendars.get(live.teamId ?? live.orgId) ?? []` whose `status !== "rejected"` and that overlap the
range (`startDate <= range.end && endDate >= range.start`, string comparison), copied, sorted by
`startDate`, then `displayName` (`localeCompare`, `"vi"`), then `entryId`. `Entry` is imported as a type
from `@/lib/domain/types`.

### 4.3 Panel `src/system/main.tsx`

One new component in the same file, `ImpersonatedCalendar({ session, onEnded }: { session:
Impersonation; onEnded: () => void }): JSX.Element`, rendered after `ImpersonatedRoster` with
`key={session.id}` and the same `onEnded`. State: `month` (`yyyy-MM`, initial
`new Date().toISOString().slice(0, 7)`), rows, error, busy; a read counter so only the latest read
lands, as `ImpersonatedRoster` does. The range for month `y-m` is `${y}-${m}-01` to the last day
(`new Date(Date.UTC(y, m, 0)).getUTCDate()`). One read on mount and one per month change — never on a
timer, because every read is logged. A `not_permitted` result calls `onEnded()`. Month label:
`new Date(Date.UTC(y, m - 1, 1)).toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" })`.

Cell text: *Type* `type.toUpperCase()`; *Portion* `full` → `Full day`, `am` → `Morning`, `pm` →
`Afternoon`; *Dates* `startDate` when equal to `endDate`, else `` `${startDate} – ${endDate}` `` (an en
dash between spaces); *Status* as written; *Tentative* `Tentative` when true, else empty.

Every `data-testid` this ticket adds:

| `data-testid` | Element |
|---|---|
| `system-calendar` | the section |
| `system-calendar-prev` / `system-calendar-next` | month step buttons |
| `system-calendar-month` | the month label |
| `system-calendar-loading` | `role="status"` while reading |
| `system-calendar-empty` | *Nothing on the calendar this month.* |
| `system-calendar-error` / `system-calendar-retry` | failure and *Try again* |
| `system-calendar-row` | one `tr`; `data-entry-id` = `entryId` |
| `system-calendar-name` / `-type` / `-portion` / `-dates` / `-status` / `-tentative` | the six cells, each prefixed `system-calendar-` |

### 4.4 Tests

- `supabase/tests/410-impersonated-calendar.test.sql` — AC-7 to AC-14. Defines its own label helper and
  `tests.authenticate_at(uuid, text)` as `390-impersonation.test.sql` does; `_isolation.psql` is not
  edited. Entries are inserted as the owner with the `org_id` and `primary_team_id` their member's org
  and team require.
- `supabase/tests/010-catalogue.test.sql` — the census gains, under
  `-- MIR-20-c, 410-impersonated-calendar.test.sql`: `'public.impersonated_calendar(date,date)'`.
- `tests/e2e/mir-20-c-impersonated-calendar.spec.ts` — AC-1 to AC-6 against the mock build;
  `page.clock.install({ time: new Date("2026-09-10T03:00:00Z") })` before `goto`; AC-6's expiry uses
  `page.clock.fastForward("31:00")` as MIR-20's AC-6 does.

## 5. Seam impact

The member seam (`src/lib/data/index.ts`, `supabase.ts`, `mock.ts`) is **not touched**; seam parity is
unaffected. The panel's seam `src/lib/data/system.ts` gains one method, `impersonatedCalendar`, in both
`supabaseSystemSeam` and `mockSystemSeam`, one exported interface and one constant. No existing method's
signature changes; `src/lib/domain/types.ts` is not edited. RULE-02's `supabase-client-in-seam` rule is
satisfied: the RPC uses the module's existing `client()`.

## 6. Schema delta

**Not `none`** (ADR-014): one check constraint on `public.impersonation_action` is replaced to admit
`read_calendar`, and one `security definer` function, `public.impersonated_calendar(date, date)`, is
added with its grant. Both are what ADR-100 already decides — decision 2 (*"unlocks only security
definer read functions that check `public.impersonated_org_id()` … and write one action row per
call"*) and decision 6 (*"one action value per read function"*) — and decision 8 assigns the calendar
read to this ticket. ADR-100 is `ACCEPTED`; no new ADR, `requires_adr: false`. No table, column, index,
policy, trigger or existing grant changes. Applying the migration to the hosted project is a person's
step (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20261115090000_mir20c_impersonated_calendar.sql"
  - "supabase/tests/410-impersonated-calendar.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "src/lib/data/system.ts"
  - "src/system/main.tsx"
  - "tests/e2e/mir-20-c-impersonated-calendar.spec.ts"
```

6 paths, `size: S`. **It disagrees with `size_estimate: M`** from § 1: the estimate priced in a
member-app surface the design then rejected (§ 8), and a schema change, which under the MIR precedent
(MIR-15-c, MIR-19, MIR-20, MIR-20-b) is sized by its file count when an accepted ADR carries it. The
verdict `S` stands (ADR-012). No Vitest file: `system.ts` picks its seam from the environment at import,
and the e2e drives the mock end to end. `glossary_owed` is `[]`; no glossary row is written.

## 8. Rejected alternatives

- **Acting as the org in the member app** — a system admin opens the member app, a session-aware
  `useSession` resolves them as "acting as" the org, the year grid renders read-only with a banner, and
  the member-app read policies gain `or org_id = public.impersonated_org_id()`. Genuinely plausible: it
  is what the plan's checklist describes and it reuses the real grid. Rejected: a policy cannot write a
  log row, so every grid read would be unlogged and the exit criterion fails on the first `select`
  (ADR-100, Options); `useSession` assumes a `member` row, which a system admin never has (ADR-074
  decision 2); the member app would have to admit an `aal2` system admin session it does not otherwise
  know; and it touches every entry, member, team, holiday and event read policy plus `useSession.ts`,
  `supabase.ts`, `viewed-team.ts` and the grid — far past 12 files.
- **A grid in the panel, with the overload colour.** Rejected: an overload marker needs the absence
  count, and INV-04 allows one definition, which lives in the member app's `absence.ts` the panel may not
  import (ADR-074 decision 6). A second count in SQL or in the panel is exactly what INV-04 forbids.
- **One read for a whole year**, so one log row covers the support task. Rejected: the log's *Reads*
  count should reflect how much was looked at, and a year is twelve months of a team's absences for a
  task that usually concerns a week. A month bounds each read and keeps the result small.
- **Returning notes and rejection reasons.** Rejected: they are free text written for the team, and a
  support session needs the shape of the calendar, not its prose; the roster likewise omits e-mail
  (MIR-20 § 1). Adding a column later does not change this function's existing columns.
- **Including entries of members who have left the team, within their membership window** (the INV-04
  temporal predicate). Rejected for now: it makes the calendar show people the roster does not, and
  reproducing the temporal window in SQL edges toward a second copy of the count's membership rule.

## Changelog

- `2026-11-15T03:38:35Z` — all sections written. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
