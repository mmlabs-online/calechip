---
ticket: EVT-03
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-08T08:11:00+0000
inputs_read:
  - .ai/board/tickets/EVT-03/ticket.yaml
  - .ai/board/ideas/2026-10-08-an-event-is-invisible-from-the-calendar-it-happens-on.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-049-events-are-drawn-on-the-week-and-month-grids.md
  - .ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md
  - .ai/registry/decisions/ADR-040-an-admin-reads-any-teams-calendar-read-only.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/standards/ui-design-system.md
  - .ai/board/tickets/EVT-02/01-plan.md
  - .claude/commands/plan.md
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20260922150000_cal11_cross_team_reads.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/viewed-team.ts
  - src/routes/WeekView.tsx
  - src/routes/MonthView.tsx
  - src/index.css
  - tests/viewed-team.test.ts
  - tests/seam-parity.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-03 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md` § EVT without paraphrase:**

| ID | Title |
|----|-------|
| EVT-03 | Events are drawn on the week and month grids, and a click opens the event |

The row's Notes column is the scope, each clause the operator's answer in
`.ai/board/ideas/2026-10-08-an-event-is-invisible-from-the-calendar-it-happens-on.md` § *Evidence*,
decided by ADR-049 (`ACCEPTED by the operator`): `/week` and `/month` only, not either year view
(Q2); a reader sees the events `listEvents()` already returns them, with the ones they take part in
marked differently (Q3-C); an admin on another team's view through `CAL-12`'s picker sees public
events, that team's own-team events and named-people events inviting someone on it (Q4-A); an event
shows across its whole span, past and future (Q5, Q7); a click navigates to `/events/:id` and nothing
else (Q6); coral. **An event is a layer of its own and never an entry** — nothing on this surface
feeds `absenceCountsFor`, `isOverloaded` or the overload warning.

**Who gains what.** Every approved member, reading the week or the month they already plan from,
sees on each day the gatherings they can read, and can tell at a glance which of them they are part
of — without leaving the calendar for `/events`. An admin reading another team's calendar sees the
gatherings that concern *that* team rather than every event in the product. It matters because a
PTO date is chosen from these two screens, and today the team outing is invisible on them.

**Out of scope.**

1. **The year overview and the year members grid** (Q2; ADR-049 decision 1). `YearView.tsx` and
   `YearOverview.tsx` are not opened.
2. **Any action on the calendar**: join, withdraw, decide, edit, delete (Q6). A chip is a link.
3. **Any change to the absence count, the overload warning, `isOverloaded`, entries, busy days or
   day statuses** (ADR-049 decision 6). `absence.ts`, `day-status.ts`, `busy.ts` are not opened.
4. **Changing who may read an event** (ADR-045 decision 3). No policy, grant or function changes.
5. **`/events` and `/events/:id`** — unchanged. `Events.tsx`, `EventDetail.tsx` are not opened.
6. **Notifications (EVT-04, EVT-05) and guest access (EVT-06, EVT-07).**
7. **A legend swatch for events in the sidebar.** `Sidebar.tsx` draws the PTO/WFH/holiday legend; an
   event swatch is a reasonable follow-up and not asked for. Raised in § 7 as a candidate, not built.
8. **A pending request treated as taking part.** The idea's assumption 1 is adopted: only an
   `attending` row or being the creator marks an event as the reader's. A third treatment for
   `pending` is not built.
9. **A continuous bar spanning several cells.** A multi-day event is drawn as one chip in each day it
   covers (§ 8, rejected alternative 2).

**`size_estimate: M`** — two screens, one shared chip, one pure module, two seam functions, no schema.

## 2. Acceptance criteria

"Reader" is the signed-in, approved member looking at the screen. "Viewed range" is the seven days of
the week view, or the in-month days of the month view. "Takes part" means: the reader is the event's
creator, or the reader has an `attending` attendance row on it.

### What is drawn

**AC-1 — an event the reader can read is drawn on every day of its span inside the viewed range**
- Given an event the reader can read (it is returned by `listEvents()` for them) with `startDate`
  2026-10-14 and `endDate` 2026-10-16
- When the reader opens the week containing those dates, and the month 2026-10
- Then exactly one event chip for it appears in each of the 14th, 15th and 16th, on both screens, and
  in no other day

**AC-2 — the span is clipped to the view, not hidden**
- Given an event from 2026-09-29 to 2026-10-02
- When the reader opens the month 2026-10
- Then a chip appears on 1 and 2 October and on no out-of-month cell
- And when the reader opens the month 2026-09, a chip appears on 29 and 30 September

**AC-3 — past and future alike**
- Given an event whose `endDate` is before today, and one whose registration deadline has passed
- When the reader pages back or forward to its dates
- Then each is drawn exactly as AC-1 says (Q5, Q7)

**AC-4 — an event the reader cannot read is not drawn**
- Given a `named` event that does not name the reader, a `team` event of another team, and the reader
  is neither creator nor admin
- When the reader opens a week and a month covering those events' dates on their own team's view
- Then neither event is drawn (ADR-049 revert condition 2)

**AC-5 — the reader's own team view shows exactly `listEvents()`**
- Given any reader on their own team's view (no `team` parameter, or a non-admin)
- When the week or month is drawn
- Then the set of event ids on screen equals the ids of `listEvents()` whose span overlaps the viewed
  range — no more and no fewer (ADR-049 decision 2). For an admin this is every event in the product,
  because an admin reads every event (ADR-045 decision 5).

### Taking part

**AC-6 — an event the reader takes part in is marked differently**
- Given two events on the same day, the reader `attending` one and having no row on the other
- When the day is drawn
- Then the first chip carries `data-taking-part="true"` and the filled coral treatment, and the second
  carries `data-taking-part="false"` and the outlined coral treatment

**AC-7 — the creator takes part in their own event**
- Given an event the reader created, with no attendance row (the creator takes no seat — EVT-02)
- When it is drawn
- Then its chip carries `data-taking-part="true"`

**AC-8 — pending, rejected and removed are not taking part**
- Given the reader's attendance row on an event is `pending`, `rejected` or `removed`
- When it is drawn
- Then its chip carries `data-taking-part="false"`

### The admin on another team's view (CAL-12)

**AC-9 — relevant to the viewed team, and nothing else**
- Given an admin viewing team B through the picker, and five events overlapping the viewed range:
  (a) `public`, created on team C; (b) `team`, created on team B; (c) `team`, created on team A;
  (d) `named`, naming a current member of team B; (e) `named`, naming only members of teams A and C
- When the week or month is drawn
- Then (a), (b) and (d) are drawn and (c) and (e) are not (Q4-A; ADR-049 decision 3)

**AC-10 — "on the viewed team" means currently on it**
- Given a `named` event whose only team-B invitee has since been removed from team B, or moved to
  another team
- When the admin views team B
- Then the event is not drawn on team B's view by virtue of that invitee

**AC-11 — taking part on another team's view is the admin's own**
- Given the admin views team B and is `attending` event (a)
- When it is drawn
- Then its chip carries `data-taking-part="true"` — the marking is the reader's participation, not
  team B's (idea assumption 3)

**AC-12 — a non-admin cannot reach the narrowed read for another team**
- Given a non-admin whose address carries `?team=<another team id>`
- When the week or month is drawn
- Then the screen is their own team's (CAL-12 AC-3) and the events drawn are AC-5's

### A click

**AC-13 — a click opens the event and does nothing else**
- Given any chip on either screen
- When the reader clicks it
- Then the browser is at `/events/<that event's id>`, no entry form or drag selection opened on the
  month cell beneath it, and no write was issued

**AC-14 — keyboard reachable**
- Given any chip
- When the reader tabs to it and presses Enter
- Then AC-13 holds. The chip's accessible name is the event's name.

### What it does not touch

**AC-15 — no count, warning or status moves**
- Given a week and a month with entries, holidays and busy marks, drawn once with no events and once
  with three events on the same days (one of them taking part)
- When both renders are compared
- Then every `data-count`, `data-day-status`, `data-bridge`, `data-busy-count`, the overload fill and
  the overload warning are identical (ADR-049 decision 6; INV-04, INV-05, INV-07)

**AC-16 — never drawn as an entry**
- Given an event on a day
- When the day is drawn
- Then no `week-row`, `month-avatar` or `week-day-count` element exists for it; the chip carries
  neither the PTO nor the WFH token, and `week-day-empty` ("Everybody is in.") still shows on a day
  whose only content is an event

### Density and failure

**AC-17 — month cells keep their rows**
- Given a month day with four events the reader can read
- When the month is drawn
- Then the first two (by `startDate`, then `name`, then `id`) are drawn as chips and a single
  `month-cell-events-more` element reads `+2 more`, whose `title` lists the two hidden names; the
  avatars, the count, the holiday name and the busy badge of that cell are all still drawn

**AC-18 — the week column shows every event**
- Given a week day with four events
- When the week is drawn
- Then all four chips appear in that day, in AC-17's order, between the day label and the entry rows

**AC-19 — an event read failure does not hide the absence grid**
- Given the event read (or the reader's attendance read) throws
- When the week or month is drawn
- Then the grid, counts, rows and avatars render as they would with no events, no chip is drawn, and
  a `week-events-unavailable` / `month-events-unavailable` notice reads
  `Events could not be loaded.` — and it is not shown when the reads succeed

**AC-20 — no event, no furniture**
- Given a viewed range with no event
- When it is drawn
- Then no element of § 4.8 exists on the screen, and every pre-existing selector renders as it did
  before this ticket

### Invariants touched

- **INV-04** — the absence count. The event layer lives beside `absenceCountsFor` in both screens and
  could plausibly be fed into it; AC-15 and AC-16 assert it is not, and § 4.2 keeps the event module
  free of any import from `absence.ts`.
- **INV-05** — tentative counts as non-tentative. Touched only in that no event is ever a tentative
  entry or drawn with the dashed tentative treatment; nothing about entries changes.
- **INV-07** — counted only against the member's own team. The admin's narrowed read (AC-9) uses team
  B's roster to decide relevance; it must never reach team B's count. AC-15 asserts that.

### Open questions

None blocking. Two things this plan decided rather than asked, each cheap to reverse:

1. **The coral value.** `--color-busy` (SOLO 2026-09-13) is already described in `src/index.css` as
   *"coral red"*, `#ffb3a7`. The event token is a deeper, more saturated coral, `#ff7f50`, and the
   two are additionally separated by shape (a full-width bar versus the busy pill). If the operator
   meant busy and events to share a hue, that is a one-token change.
2. **`+N more` is not a link** in the month cell (AC-17). A hidden event is reachable from the week
   view, which draws every event.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

**The arrangement, which the ACs above bind:**

- **Week (`week-day`).** A vertical stack of chips directly under `week-day-label` and above the entry
  list / `week-day-empty`. One chip per event, full column width, one line, truncated with an
  ellipsis; `title` carries the full name.
- **Month (`month-cell`).** Chips sit directly under the date row (date, today badge, count) and above
  the holiday name, so the cell order is: date row → events → holiday name → busy badge → avatars. At
  most two chips; then `+N more`. Chip text 10px, one line, truncated.
- **Chip.** `rounded-md`, `px-1.5`, one line, the event's name only — no time, no location, no
  avatar. Filled `bg-event text-event-ink` when taking part, with a small `●` before the name for
  readers who cannot rely on fill; outlined `border border-event bg-card text-event-ink` otherwise.
- **Notice (AC-19).** One line of small text above the grid, beside the existing heading row.

## 3. Permission model

| Action | Member | Manager | Admin | Where the check lives |
|---|---|---|---|---|
| See an event chip on own team's week/month | ✅ events `event_select_visible` returns | ✅ same | ✅ every event | `event_select_visible` (EVT-01, replaced by EVT-02). Unchanged |
| See own attendance status per event | ✅ own rows | ✅ own rows | ✅ own rows (filtered by `member_id`, since the policy returns an admin every row) | `event_attendance_select_visible`. Unchanged |
| See team B's relevant events on team B's view | ❌ (no team B view: CAL-12 AC-3) | ❌ | ✅ | The selection: `resolveViewedTeam` gives a non-admin `own`. The events: still `event_select_visible`; the narrowing is a filter over rows the admin already reads |
| Identify team B's current members, to test named invitees | ❌ (`list_members_for_team` returns empty) | ❌ | ✅ | `list_members_for_team` definer, `is_admin` in its body (CAL-11). Unchanged |
| Read a named event's invitee list | ❌ unless creator | ❌ unless creator | ✅ | `event_invitee_select_manage` (EVT-01). Unchanged |
| Follow a chip to `/events/:id` | ✅ | ✅ | ✅ | `getEvent` → policy; the detail page already handles "cannot read" (EVT-01 AC-22) |
| Any write from a chip | ❌ | ❌ | ❌ | None exists; held by absence — the chip is a `Link` and issues no seam call |

**No new exposure.** Every row a chip is drawn from is a row the caller already receives from an
existing policy. The admin narrowing (AC-9) and the month cap (AC-17) are affordances that *remove*
rows from view; neither is a control and neither needs to be. ADR-049 revert condition 2 holds by
construction: `listEventsForTeam` is a filter over the same `select` that `listEvents` issues.

## 4. Contract

### 4.1 Domain types — none

No type is added to `src/lib/domain/types.ts`. `CalEvent` and `EventAttendance` are used as shipped.

### 4.2 The event layer — `src/lib/event-layer.ts` (new, pure)

No React, no seam instance, and **no import from `@/lib/data/absence`, `day-status` or `busy`**.

```ts
import type { CalEvent, DateRange, EventAttendance } from "@/lib/domain/types";

/** Events whose inclusive [startDate, endDate] overlaps `range` (inclusive). Input order kept. */
export function eventsOverlapping(events: readonly CalEvent[], range: DateRange): CalEvent[];

/** For every date of `range` (each `yyyy-MM-dd` key present, possibly with []), the events covering
 *  it, ordered by startDate asc, then name (localeCompare), then id. */
export function eventsByDate(events: readonly CalEvent[], range: DateRange): Map<string, CalEvent[]>;

/** The ids of events `memberId` takes part in: creatorId === memberId, or an `attending` row of
 *  theirs in `ownAttendance`. Rows of any other member are ignored. */
export function takingPartIds(
  events: readonly CalEvent[],
  memberId: string,
  ownAttendance: readonly EventAttendance[],
): Set<string>;

/** Q4-A. Of `events`, those relevant to team `teamId`:
 *  scope "public"; or scope "team" with teamId === `teamId`; or scope "named" with at least one id
 *  of `inviteesByEvent.get(e.id)` in `teamMemberIds`. Input order kept. */
export function eventsRelevantToTeam(
  events: readonly CalEvent[],
  teamId: string,
  inviteesByEvent: ReadonlyMap<string, readonly string[]>,
  teamMemberIds: ReadonlySet<string>,
): CalEvent[];

/** The month cell's cap (AC-17). */
export const MONTH_EVENT_LIMIT = 2;
```

### 4.3 Seam — `src/lib/data/index.ts`, two new functions

```ts
  // EVT-03 — events on the week and month grids. 01-plan.md § 4.3. ADR-049.

  /** EVT-03 AC-6..AC-8, AC-11. The CALLER's own attendance rows across every event, any status.
   *  Filtered by `member_id = caller` explicitly, because the policy returns an admin every row.
   *  Empty for a caller with no member row. Ordered `eventId` asc. Bounded by DATASTORE_MAX_ROWS and
   *  throws at the bound, as `listEventAttendance` does. */
  listOwnEventAttendance(): Promise<EventAttendance[]>;

  /** EVT-03 AC-9, AC-10. Of the events `listEvents()` returns the caller, those relevant to team
   *  `teamId` (`eventsRelevantToTeam`, § 4.2), with "on the team" read from `listMembersForTeam(teamId)`
   *  restricted to `removedAt === null && status === "approved"`. A non-admin's `listMembersForTeam`
   *  is empty, so for them it is never wider than `listEvents()`. Same order as `listEvents()`.
   *  THROWS on any failure of its reads, and at the DATASTORE_MAX_ROWS bound. */
  listEventsForTeam(teamId: string): Promise<CalEvent[]>;
```

**Supabase implementation.** `listOwnEventAttendance`: `auth.getUser()` (as `readCurrentMember`
does), then `from("event_attendance").select(ATTENDANCE_COLUMNS).eq("member_id", uid)`.
`listEventsForTeam`: one `from("event").select(EVENT_COLUMNS + ", event_invitee(member_id)")` with
`listEvents`' order and bound, in parallel with `listMembersForTeam(teamId)` (module-level call, not
through `this` — the destructuring reason `readCurrentMember`'s comment gives); build
`inviteesByEvent` from the embed and pass to `eventsRelevantToTeam`. The embed returns invitees only
where `event_invitee_select_manage` allows — the admin, or the creator — which is exactly the set
the filter can use. **No migration** (§ 6).

**Mock implementation.** `listOwnEventAttendance`: `eventAttendance` rows with
`memberId === currentMemberId`, empty when `memberTeamId(currentMemberId) === null`.
`listEventsForTeam`: `this`-free call of the mock's `listEvents` logic, `eventInvitees` grouped by
event **only for events `mayManageEvent(e, currentMemberId)`**, the team's members from the same
logic as the mock's `listMembersForTeam`, then `eventsRelevantToTeam`.

### 4.4 Viewed-team switch — `src/lib/viewed-team.ts`

`TeamReads` gains one member, and `teamReadsFor` stays the only place the own/other branch is written:

```ts
export interface TeamReads {
  team(): Promise<Team | null>;
  roster(): Promise<Member[]>;
  entriesOverlapping(range: DateRange): Promise<Entry[]>;
  busyDaysOverlapping(range: DateRange): Promise<BusyDay[]>;
  /** EVT-03. own -> seam.listEvents(); other -> seam.listEventsForTeam(team.id). */
  events(): Promise<CalEvent[]>;
}
```

An `other` `TeamReads.events` never calls `seam.listEvents()` (the CAL-12 AC-12 rule, extended).

### 4.5 The chip — `src/components/EventChip.tsx` (new)

```ts
export interface EventChipProps {
  event: CalEvent;
  takingPart: boolean;
  /** "week" | "month" — chooses the testid prefix and the text size. */
  surface: "week" | "month";
}
export default function EventChip(props: EventChipProps): JSX.Element;
```

Renders a react-router `<Link to={`/events/${event.id}`}>` with `onMouseDown={(e) =>
e.stopPropagation()}` (the month cell starts a drag on mouse down — the reason `month-cell-busy`
carries the same line), `title={event.name}`, `aria-label={event.name}`.

### 4.6 Screens

`WeekView.tsx` and `MonthView.tsx`: inside the existing `load`, **after** the existing
`Promise.all` resolves and is stored, a second `Promise.all([reads.events(),
seam.listOwnEventAttendance()])` runs under the same `stale()` guard; its failure sets an
`eventsFailed` flag and never the `unavailable` phase (AC-19). The ready state gains
`events: CalEvent[]` and `ownAttendance: EventAttendance[]`. `eventsByDate(eventsOverlapping(...),
range)` and `takingPartIds(events, me.id, ownAttendance)` are `useMemo`s **separate from** the
`counts` memo; neither is passed to `absenceCountsFor`, `absentMembersFor`, `dayStatusesFor`,
`isOverloaded` or `OverloadWarning`.

### 4.7 Token — `src/index.css` and `.ai/standards/ui-design-system.md`

```css
  /* EVT-03, ADR-049 decision 7. An event — a gathering, not an absence and not a busy day.
     Coral at the operator's word (*"sử dụng màu coral"*). Deeper and more saturated than
     `--color-busy` (#ffb3a7) and separated from it by shape too: a full-width bar, never a pill. */
  --color-event: #ff7f50; /* coral */
  --color-event-ink: #6b230a;
```

`.ai/standards/ui-design-system.md` § Colour gains one line under the TODO (the TODO stays):
`- Event (EVT-03, ADR-049): --color-event #ff7f50 coral, ink #6b230a. Never used for an entry, a busy day or an overload.`

### 4.8 Selectors

| `data-testid` | Element | Attributes |
|---|---|---|
| `week-event` | chip in a week day | `data-event-id`, `data-date`, `data-taking-part` (`"true"`/`"false"`), `href` |
| `month-event` | chip in a month cell | same |
| `month-cell-events-more` | `+N more` in a month cell | `data-date`, `data-hidden-count`, `title` |
| `week-events-unavailable` | AC-19 notice, week | — |
| `month-events-unavailable` | AC-19 notice, month | — |

## 5. Seam impact

Two functions added, none changed: `listOwnEventAttendance()` (arity 0) and
`listEventsForTeam(teamId)` (arity 1), in `index.ts`, `supabase.ts` and `mock.ts` with the same name
and arity — `tests/seam-parity.test.ts` holds it unedited. `listEvents`, `listEventAttendance`,
`listEventInvitees`, `listMembersForTeam` are called, not altered.

## 6. Schema delta

`none`. No table, column, policy, grant, trigger, constraint or function changes. ADR-049
§ Consequences left open a `security definer` function for Q4-A; it is not needed, because the admin
already reads every event (table-wide `select` grant includes `team_id`), every invitee list
(`event_invitee_select_manage`), and team B's roster (`list_members_for_team`). § 8 alternative 1.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/event-layer.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/viewed-team.ts"
  - "src/components/EventChip.tsx"
  - "src/routes/WeekView.tsx"
  - "src/routes/MonthView.tsx"
  - "src/index.css"
  - ".ai/standards/ui-design-system.md"
  - "tests/event-layer.test.ts"
  - "tests/e2e/evt-03-calendar-events.spec.ts"
```

**Twelve paths: `size: M`, agreeing with `size_estimate: M`.** A thirteenth makes this `L`, which
must split — the Developer stops and says so rather than adding one.

**Deliberately absent:** `src/lib/domain/types.ts` (no type changes); `supabase/migrations/**` (§ 6);
`src/lib/data/absence.ts`, `day-status.ts`, `busy.ts` (Out of scope 3); `YearView.tsx`,
`YearOverview.tsx` (Out of scope 1); `Events.tsx`, `EventDetail.tsx` (Out of scope 5); `Sidebar.tsx`
(Out of scope 7); `tests/viewed-team.test.ts` and `tests/seam-parity.test.ts` (both keep passing
unedited — the new `TeamReads.events` branch is asserted in `tests/event-layer.test.ts`).
`.ai/registry/glossary.md` is absent: `glossary_owed: []`; *Event*, *Attendee*, *Invitation* and
*Capacity* already have rows.

**`.ai/standards/ui-design-system.md` is here because ADR-049 § Affected documents names it** for the
coral token, to be written by this ticket; the Developer writes exactly § 4.7's line and nothing else.

**Tests owed.** `tests/event-layer.test.ts`: every function of § 4.2 (AC-1, AC-2, AC-6–AC-11 at the
unit level), both seam functions against the mock (AC-9, AC-10, AC-12: a non-admin's
`listEventsForTeam` is a subset of `listEvents`), and `teamReadsFor(...).events` for own and other
with a throwing own-read stub (CAL-12 AC-12 extended). `tests/e2e/evt-03-calendar-events.spec.ts`:
AC-1, AC-4, AC-6, AC-9, AC-13, AC-14, AC-15, AC-16, AC-17, AC-19 through the selectors of § 4.8.

## 8. Rejected alternatives

1. **A `security definer` function `list_events_for_team(p_team_id)` in ADR-040's shape**, which
   ADR-049 § Consequences offered. Plausible: one round trip, server-side filtering, and the shape the
   cross-team calendar reads already use. Rejected because it needs nothing the admin cannot already
   read, so it would add the product's widest event read — a definer function that, losing one
   clause, returns every event to every caller — in exchange for a filter over rows already in hand.
   EVT-01 § 8 rejected a definer read of events for the same reason (a policy fails closed; a definer
   function fails open). It would also make `schema_delta` non-`none` and the ticket `XL` by the
   sizing table. It is the right shape only if the event count outgrows `DATASTORE_MAX_ROWS`, at which
   point `listEvents` needs paging too.
2. **A continuous bar spanning several day cells**, as calendar apps draw multi-day events.
   Rejected: the week columns are independent `flex` sections that stack vertically below `xl`, and
   the month cell is a free-flowing stack whose height depends on its avatars — a spanning bar needs a
   reserved lane per event per row, which costs a fixed row in every cell of the week whether or not
   it holds an event. `CLAUDE.md` § Visual direction: density wins every time.
3. **Drawing events through `TeamReads` only on the admin's other-team view and calling `listEvents`
   directly in the screens otherwise.** Rejected: it writes the own/other branch a second time, the
   exact failure `viewed-team.ts`'s header (CAL-12 § 8 alternative 2) exists to prevent.
4. **Failing the whole screen to `unavailable` when the event read fails**, as every other read on
   these screens does. Rejected for AC-19: the other reads are inputs to the absence count, and a
   partial one would make a count wrong. The event layer feeds no count, so a missing layer says
   nothing false about absence — provided the screen *says* it is missing, which the notice does.

## Changelog

- `2026-10-08T08:11:00+0000` — all sections written. Raised by `tech-lead-design`.
