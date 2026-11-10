---
ticket: UIE-12
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-15T10:51:02+0700
inputs_read:
  - .ai/board/tickets/UIE-12/ticket.yaml
  - .ai/board/ideas/2026-10-14-the-way-to-join-an-event-scrolls-out-of-sight-and-a-guest-cannot-sign-in-from-it.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/standards/ui-design-system.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - .ai/board/tickets/UIE-10/01-plan.md
  - src/routes/EventDetail.tsx
  - src/routes/GuestEvent.tsx
  - src/components/EventAttendancePanel.tsx
  - src/components/AppShell.tsx
  - src/components/ReportIssueButton.tsx
  - src/components/Sidebar.tsx
  - src/App.tsx
  - src/lib/data/index.ts
  - playwright.config.ts
  - tests/e2e/evt-02-attendance.spec.ts
  - tests/e2e/evt-06-guest-link.spec.ts
  - tests/e2e/evt-07-guest-registration.spec.ts
  - tests/e2e/evt-10-description.spec.ts
  - tests/guest-registration.test.ts
consulted:
  - with: developer
    asked: "The content pane never scrolls (the document does), so a sticky bar inside it never sticks; add src/components/AppShell.tsx to allowed_paths for a one-class fix? (99-questions.md Q1)"
    answer: "Agreed: the row's flex-1 becomes flex-[1_1_0px], restoring UIE-02 § 4.9's pane-only scrolling; the full e2e suite must pass"
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# UIE-12 — the way to join an event stays in view while its page scrolls

## 1. Problem and scope

### The feature row, transcribed

| ID | Title | Group | Status |
|----|-------|-------|--------|
| UIE-12 | The way to join an event stays in view while its page scrolls, on `/events/:id` and on `/guest/:token` | UIE | PLANNED |

The clauses of the row's `Notes` that bind this plan, verbatim:

- *"the join or register block stays visible while the reader scrolls, on both `/events/:id` and
  `/guest/:token` (Q1-A), which means taking the join action and its status out of
  `EventAttendancePanel` and making the guest register form sticky as well"*
- *"guest registration without an account stays exactly as EVT-07 shipped it (Q2-A)"*
- *"`product`'s guesses, not the operator's, and PLAN may overturn any of them: the block always shows
  the reader's current state, including after they have joined (G1); no schema change (G3)"*
- *"Every control here is an affordance (ADR-005): `event_attendance_guard`, `register_guest` and
  `event_guest_guard` allow exactly what they allow today."*
- *"The `data-testid` names the EVT-02, EVT-06 and EVT-07 specs read are frozen."*
- *"Shares `src/routes/GuestEvent.tsx` with `EVT-14`, so the two are sequenced, not run in parallel."*

**G1 is adopted** and becomes AC-3 to AC-5. **G3 holds** — § 6. G2 belongs to EVT-14.

### What this buys, and for whom

An approved member reading `/events/:id`, and anyone reading `/guest/:token`, can act on the event
from wherever they are on the page. Today the join control (`EventAttendancePanel.tsx:252-264`) and
the guest register form (`GuestEvent.tsx:238`) sit after the description, which since EVT-10 and
EVT-11 can be many screens of text and pictures. The reader scrolls past everything to find the one
thing the page asks of them, and loses it again on the way back up. Nothing about who may join, or
what joining does, changes.

### Out of scope

- **The sign-in and sign-up prompt on the guest page, and a return-to on `/signin`** — `EVT-14`.
- **Making an account mandatory to register** (idea Q2-B, decided against). EVT-07 stays as it is.
- **A sticky block on any other surface** — the calendar grids, `/events`, the manage page
  `/guest/registration/:token`. Only the two event article pages (Q1-A).
- **Moving the seats line, the deadline line, the requests list or the *Going* list.** They stay in
  `EventAttendancePanel` where they are; only the reader's own action and status move.
- **Moving the manager panels** (`EventGuestPanel`, `EventInvitePanel`) or the Edit / Delete controls.
- **A collapsed bar that expands into the guest form** — § 8, rejected alternative 2.
- **Any change to what a write allows or refuses**, and any new seam function, column or policy.

`size_estimate: S` — two routes and one component rearranged, one component extracted, two tests.

## 2. Acceptance criteria

Terms used below. **The join block** is the new region holding the reader's own action on the event:
`event-join-bar` on `/events/:id`, `guest-join-bar` on `/guest/:token`. **Wide** is a viewport at
least 1280 px wide; **narrow** is anything below. **Long description** means a description whose
rendered height is more than twice the viewport's. **In view** is Playwright's `toBeInViewport()`
against the page's scrolling region.

### The member page, `/events/:id`

**AC-1 — the join block is in view at both ends of a long page, at both widths**
- Given an approved member in the audience of an open event with a long description, on which they
  have no attendance
- When they open `/events/<id>` at 1280×720, and again at 800×720, and at each width scroll first so
  `event-attendees` is in view and then so `event-name` is in view
- Then `event-join-button` is in view after each of the two scrolls, at both widths.

**AC-2 — the reader's action and status live in the join block, not the attendance panel**
- Given the page of AC-1
- When the DOM is read
- Then `event-join-button` is a descendant of `event-join-bar` and not of `event-attendance`; and
  `event-seats`, `event-deadline` and `event-attendees` are still descendants of `event-attendance`.

**AC-3 — after joining, the block shows the reader's status and stays in view (G1)**
- Given the member of AC-1, on an event without approval
- When they click `event-join-button` and then scroll so `event-attendees` is in view
- Then `event-my-status` carries `data-status="attending"`, is a descendant of `event-join-bar`, and is
  in view; `event-leave-button` is in the same block; `event-join-button` is absent.

**AC-4 — a reader in the audience on a closed event is told so in the block (G1)**
- Given an approved member in the audience of an event whose registration deadline has passed, with
  no attendance
- When they open `/events/<id>`
- Then `event-join-bar` holds `event-join-closed` with the text *Registration closed*, and
  `event-join-button` is absent. (`event-deadline` keeps its own *Registration closed* text, EVT-02
  AC-10.)

**AC-5 — a reader in the audience on a full event without approval is told so in the block (G1)**
- Given an approved member in the audience of an open event, without approval, whose capacity is
  taken, with no attendance
- When they open `/events/<id>`
- Then `event-join-bar` holds `event-join-full` containing the text *This event is full.*, and
  `event-join-button` is absent.

**AC-6 — no join block for a reader with nothing to do there**
- Given an admin reading an *Own team* event of a team they are not on, with no attendance (EVT-02
  AC-11)
- When they open `/events/<id>`
- Then `event-join-bar` is absent and `event-detail` is laid out exactly as before this ticket — one
  column, at most 36 rem (`max-w-xl`) wide.

**AC-7 — wide places the block beside the article; narrow places it under**
- Given the page of AC-1
- When it is rendered at 1280×720
- Then the left edge of `event-join-bar`'s box is at or right of the right edge of `event-detail`'s
  box, and their top edges are within 1 px of each other before any scroll.
- And when it is rendered at 800×720, the top of `event-join-bar`'s box is below the top of
  `event-detail`'s box and its left edge is within 1 px of `event-detail`'s left edge.

**AC-8 — the block's controls never sit under the report-issue bubble**
- Given the page of AC-1 at 800×720, and again at 1280×720
- When the page is scrolled so `event-attendees` is in view
- Then the box of `event-join-button` does not intersect the box of `report-issue-bubble`; and after
  joining, nor does the box of `event-leave-button`.

**AC-9 — a refused join is reported in the block** *(amended at IN_PROGRESS, `99-questions.md` Q2)*
- Given an open event with capacity 1 and no approval, opened to guests by its creator, and an
  approved member in its audience with the page open and `event-join-button` showing
- When the last seat is taken by a guest through a direct `registerGuest(<token>, …)` seam call, and
  the member then clicks `event-join-button`
- Then `event-join-error` is shown inside `event-join-bar` carrying the seam's message, and no
  `event-my-status` appears. The guard refuses the write whatever the page drew (ADR-005).

**AC-10 — leaving from the block still confirms first**
- Given the member of AC-3 after joining
- When they click `event-leave-button`
- Then `event-leave-modal` opens, as EVT-02 AC-29 specifies, and `event-leave-confirm`
  removes the attendance. (Covered by `evt-02-attendance.spec.ts` passing unedited — AC-14.)

### The guest page, `/guest/:token`

**AC-11 — the register form is in view at both ends of a long page, at both widths**
- Given a signed-out reader of an open guest link to an open event with a long description
- When they open `/guest/<token>` at 1280×720, and again at 800×720, and at each width scroll first
  so `guest-event-attendees` is in view and then so `guest-event-name` is in view
- Then `guest-register-name`, `guest-register-email` and `guest-register-submit` are each in view
  after each of the two scrolls, at both widths.

**AC-12 — the register block sits outside the event card, and the card keeps its order**
- Given the page of AC-11
- When the DOM is read
- Then `guest-register` is a descendant of `guest-join-bar` and not of `guest-event`; and EVT-06
  AC-9's order inside `guest-event` — name, dates, location, description, seats, who is coming —
  holds (`evt-06-guest-link.spec.ts` asserts it, unedited).

**AC-13 — after registering, the receipt stays in the block (G1)**
- Given the reader of AC-11 at 800×720
- When they register with a valid name and email, then scroll so `guest-event-attendees` is in view
- Then `guest-registered` is a descendant of `guest-join-bar`, and `guest-manage-link` is in view.

AC-7's arrangement holds on this page with `guest-join-bar` and `guest-event` in place of
`event-join-bar` and `event-detail`. It is asserted by the same spec as **AC-7G**.

### Both pages

**AC-14 — the frozen specs pass unedited**
- Given this ticket's change
- When `tests/e2e/evt-02-attendance.spec.ts`, `evt-06-guest-link.spec.ts`,
  `evt-07-guest-registration.spec.ts`, `evt-10-description.spec.ts` and
  `evt-11-description-pictures.spec.ts` run
- Then each passes with no edit to the file. Every `data-testid` they read keeps its name.

**AC-15 — one copy of each control, at every width**
- Given the pages of AC-1 and AC-11, at 1280×720 and at 800×720
- When the DOM is read
- Then `event-join-bar`, `event-join-button`, `guest-join-bar` and `guest-register-submit` each have a
  count of exactly 1. The two widths are one element restyled, never two elements shown and hidden.

**AC-16 — the block's state is decided by one pure function**
- Given `joinBarState` (§ 4.1)
- When it is called with each combination of: attendance not yet loaded; an attendance of each of the
  four statuses, with registration open and closed; no attendance and not in the audience; no
  attendance, in the audience, closed; no attendance, in the audience, open, full, with and without
  approval; no attendance, in the audience, open, not full, with and without approval
- Then it answers exactly the row of the table in § 4.1 for that combination.

**Invariants touched:** `[]`. Nothing here reads, writes or counts an entry; the absence count
(INV-04) and every other ledger row are about entries, and this ticket moves controls on the event
pages only.

**Open questions:** none. G1 is adopted as AC-3 to AC-5; G3 holds (§ 6); G2 is EVT-14's.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

*There is no `design/` folder for this ticket and the idea attaches no image.* The arrangement, which
AC-1, AC-6, AC-7, AC-8, AC-11 and AC-15 bind:

- **Wide (≥ 1280 px, Tailwind `xl`): two columns.** The article on the left at its current
  `max-w-xl` (36 rem), and to its right an 18 rem column holding the join block as its own card
  (`rounded-card bg-card shadow-soft p-5`), `sticky top-6`, `self-start`. The two columns are centred
  together. The back link (`‹ Events`) and the *CaleChip* line stay above, left-aligned to the
  article. *Why `xl` and not `lg`:* the sidebar is a fixed 216 px (`Sidebar.tsx:316`) and the content
  pane pads 24 px each side, so at 1024 px the pane has 760 px against the 888 px two columns need;
  at 1280 it has 1016. The guest page has no sidebar and would fit at `lg`, but one breakpoint for
  both pages is one rule to keep true.
- **Narrow (< 1280 px): one column.** The join block is the last child of the page column, after the
  article, `sticky bottom-0`, full column width, the same card look with a top shadow so it reads as
  floating over the text that scrolls under it. Sticky, not fixed: `AppShell.tsx:138-142` records why
  a fixed child of the scrolling pane is the arrangement that breaks.
- **The report bubble.** On the member page below `xl` the block's content keeps 4 rem clear on its
  right (`pr-16`), so `report-issue-bubble` (`ReportIssueButton.tsx:122`, `fixed bottom-6 right-6`)
  can float over the card's edge but never over a control (AC-8). The guest page has no bubble.
- **What the member block holds:** exactly the row `EventAttendancePanel` draws today — the join
  button, or the status sentence with *Cancel request* / *Withdraw* — plus the two new one-line
  states, *Registration closed* and the *Full* pill with *This event is full.*, copied from the guest
  block's (`GuestEvent.tsx:372-394`) so the two pages say the same thing. A small uppercase label
  above it, as the guest block has: **Join** when the button reads *Join*, **Request to join** when it
  reads that, **Your place** otherwise.
- **What the guest block holds:** `GuestRegisterPanel` unchanged in content — its heading, the
  approval note, the form, the closed and full lines, and after submitting the receipt with the
  manage link. It loses its `border-t pt-4` (it is no longer a section of the card) and gains the
  card look. On narrow at `sm` and wider the two fields sit side by side, to keep the pinned block
  short; below `sm` they stack as today.
- **Colours** are the existing tokens: *Full* in `bg-overload`, never red; the primary button as
  today.

## 3. Permission model

**Nothing changes, and every control here was and remains an affordance (ADR-005).**

| Action | Who the page offers it to | What refuses it regardless |
|---|---|---|
| Join / request to join | an approved, non-removed member with a team, in `is_event_audience`, with no attendance, registration open, and a free seat unless approval is required — `inAudience` and `joinBarState` as today's `canJoin` (`EventAttendancePanel.tsx:197-202`) | `event_attendance_guard` and the attendance insert policy (EVT-02 migration) |
| Cancel request / withdraw | the reader with a pending or attending row, while registration is open | `event_attendance_guard` |
| Register as a guest | any reader of an open guest link with a non-null terms read, registration open, a seat free unless approval is required | `register_guest`, `event_guest_guard` |

**Denials, unchanged:** an admin outside an *Own team* event is offered no join (AC-6, EVT-02 AC-11);
a reader not in the audience is offered nothing; a reader on a closed or full event is told so and
offered no button (AC-4, AC-5). The two new informational states reveal nothing a reader cannot
already see: `event-deadline` already says *Registration closed* and `event-seats` already says
*Full* to the same reader.

## 4. Contract

### 4.1 `src/components/EventJoinBar.tsx` — new

```ts
import type { AttendanceStatus, CalEvent, EventAttendance, Member } from "@/lib/domain/types";

/** What the join block shows. Decided here and nowhere else (AC-16). */
export type JoinBarState =
  | { kind: "hidden" }
  | { kind: "join"; requiresApproval: boolean }
  | { kind: "status"; status: AttendanceStatus; canLeave: boolean }
  | { kind: "closed" }
  | { kind: "full" };

export function joinBarState(input: {
  event: CalEvent;
  me: Member | null;
  invitees: readonly string[];
  /** `null` until the attendance load answers. */
  rows: readonly EventAttendance[] | null;
  /** Members and guests attending — today's `taken` (`EventAttendancePanel.tsx:192`). */
  taken: number;
  /** `registrationOpen(event, eventToday())`. */
  open: boolean;
}): JoinBarState;

export interface EventJoinBarProps {
  event: CalEvent;
  me: Member | null;
  invitees: string[];
  attendance: EventAttendanceLoad;   // § 4.2
}

export default function EventJoinBar(props: EventJoinBarProps): JSX.Element | null;
```

`joinBarState` answers, first match wins:

| # | Condition | Answer |
|---|---|---|
| 1 | `rows === null` | `hidden` |
| 2 | `me` has a row in `rows` | `status`, with `canLeave = open && (status === "pending" \|\| status === "attending")` |
| 3 | `!inAudience(event, me, invitees)` | `hidden` |
| 4 | `!open` | `closed` |
| 5 | `!event.requiresApproval && event.capacity !== null && taken >= event.capacity` | `full` |
| 6 | otherwise | `join`, with `requiresApproval = event.requiresApproval` |

Rows 1, 2, 3, 5 and 6 together are today's `canJoin` exactly; rows 4 and 5 replace today's *nothing*
with a sentence (G1). `EventJoinBar` renders `null` for `hidden`, and otherwise:

```
<div data-testid="event-join-bar">            ← the card; sticky per § 2b
  <h2>Join | Request to join | Your place</h2>
  join    → <button data-testid="event-join-button">Join | Request to join</button>
  status  → <p data-testid="event-my-status" data-status={status}>{MY_STATUS[status]}</p>
            + when canLeave <button data-testid="event-leave-button">Cancel request | Withdraw</button>
  closed  → <p data-testid="event-join-closed">Registration closed</p>
  full    → <p data-testid="event-join-full"><span>Full</span> This event is full.</p>
  error   → <p data-testid="event-join-error" role="alert">{message}</p>
</div>
+ the leave confirmation, `Modal testIdPrefix="event-leave"`, moved here unchanged from
  `EventAttendancePanel.tsx:412-446`
```

`MY_STATUS` and the leave dialog's text move with the controls, unchanged in wording. The join click
is `attendance.run(() => seam.joinEvent(event.id))`; leave confirm is
`attendance.run(() => seam.leaveEvent(event.id))`. A non-null result is shown as `event-join-error`
and cleared on the next click.

### 4.2 `src/components/EventAttendancePanel.tsx` — the load lifted into a hook

```ts
type WriteResult = { ok: true } | { ok: false; error: { message: string } };

export interface EventAttendanceLoad {
  /** `null` until the first load answers; `[]` after a failed load. */
  rows: EventAttendance[] | null;
  guests: EventGuest[];
  /** True after a failed load — the panel shows today's sentence for it. */
  loadFailed: boolean;
  /** One write at a time, across the bar and the panel. */
  busy: boolean;
  /** Runs one write, then reloads both lists. Resolves the write's message on failure, else null. */
  run(write: () => Promise<WriteResult>): Promise<string | null>;
}

/** Loads on mount and whenever `event.id` or `event.updatedAt` changes — the job the
 *  `key={event.updatedAt}` remount did (`EventDetail.tsx:315-316`). */
export function useEventAttendance(event: CalEvent): EventAttendanceLoad;

/** Exported unchanged, for `joinBarState`. */
export function inAudience(event: CalEvent, me: Member | null, invitees: readonly string[]): boolean;

/** Members and guests attending, as today's `taken`. */
export function seatsTaken(rows: readonly EventAttendance[] | null, guests: readonly EventGuest[]): number;

export interface EventAttendancePanelProps {
  event: CalEvent;
  directory: DirectoryMember[];
  /** The creator or an admin — the affordance over `event_attendance_update_manage`. */
  canManage: boolean;
  attendance: EventAttendanceLoad;
}
```

The panel loses `me`, `invitees`, the join/status row, `leaving` and the leave dialog. It keeps the
seats and deadline line, `event-attendance-error` (for a failed load, and for its own approve,
reject and remove writes), the requests, *Going*, and the two remove dialogs — markup and test ids
unchanged.

### 4.3 `src/routes/EventDetail.tsx`

Calls `useEventAttendance(event)` once and passes the result to both `EventAttendancePanel` (no
`key` prop any longer) and `EventJoinBar`. Wraps the article and the bar per § 2b: when the bar is
not `hidden` the section is a one-column flow below `xl` and a two-column grid at `xl`; when it is
`hidden` the section is exactly today's (AC-6). The page reads `joinBarState` to decide which, so the
decision is not made twice.

### 4.4 `src/routes/GuestEvent.tsx`

`GuestEventCard` loses its `register` prop and the `{register}` slot (`GuestEvent.tsx:238`).
`GuestEvent` renders `<div data-testid="guest-join-bar">` holding `GuestRegisterPanel` as a sibling
after the card, arranged per § 2b, only when `state.terms` is non-null — a null terms read draws the
page as EVT-06 does, with no block, exactly as today (EVT-07 AC-22). `GuestRegisterPanel`'s
internals, its states and every test id in it are unchanged; only its outer class list changes.

No other signature changes. `GuestEvent({ signedInMember })` is untouched (EVT-13).

## 5. Seam impact

**None.** No function added, changed or removed in `src/lib/data/**`. The same `listEventAttendance`,
`listEventGuests`, `joinEvent`, `leaveEvent`, `decideAttendance`, `decideGuest`, `getGuestEvent`,
`getGuestRegistrationTerms` and `registerGuest` calls are made, from a hook instead of a component.

## 6. Schema delta

`none`. No table, column, policy, trigger, function or grant (G3 holds on reading the code: every
fact the block shows is already loaded by the page).

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/components/EventJoinBar.tsx"
  - "src/components/EventAttendancePanel.tsx"
  - "src/routes/EventDetail.tsx"
  - "src/routes/GuestEvent.tsx"
  - "src/components/AppShell.tsx"
  - "tests/event-join-bar.test.ts"
  - "tests/e2e/uie-12-sticky-join.spec.ts"
```

- `src/components/AppShell.tsx` — **added at IN_PROGRESS, `99-questions.md` Q1.** One class on the
  shell's row, `flex-1` → `flex-[1_1_0px]`, so the content pane is the scroller UIE-02 § 4.9 says it
  is; without it nothing in the pane can be sticky. Every shell route then scrolls in the pane, so
  the whole end-to-end suite, not only AC-14's five specs, must pass.

- `tests/event-join-bar.test.ts` — AC-16, one case per row of § 4.1's table and the four statuses.
- `tests/e2e/uie-12-sticky-join.spec.ts` — AC-1 to AC-9, AC-7G, AC-11 to AC-13, AC-15. A long
  description is written with the direct seam call `evt-10-description.spec.ts:91-115` uses (copied,
  not imported — that file is frozen). The widths are set per test with `page.setViewportSize`.
- The five frozen specs of AC-14 are **not** on this list on purpose: if one needs an edit, AC-14 has
  failed and the implementation is wrong, not the spec.

`glossary_owed` is `[]`; no glossary row is written.

`size: M` — seven paths since Q1 added `AppShell.tsx` (six at PLAN, `S`). It disagrees with
`size_estimate: S` because the estimate assumed the shell's pane already scrolled; it did not.

## 8. Rejected alternatives

1. **Leave the join row inside `EventAttendancePanel` and make it `position: fixed` at the bottom of
   the viewport.** The smallest diff: no hook, no new component, no prop change. Rejected for three
   reasons. A fixed child of the scrolling content pane is exactly the arrangement
   `AppShell.tsx:138-142` records as breaking the moment the pane gains a transform or filter. A fixed
   bar is aligned to the viewport, not to the column beside a 216 px sidebar, so it would need the
   sidebar's width hard-coded to line up. And the row's own `Notes` names the split — *"taking the
   join action and its status out of `EventAttendancePanel`"* — as what Q1-A means.
2. **On narrow screens, a compact bar with one *Register* button that expands into the form.** Shorter
   when pinned — the full form is around 200 px on a phone. Rejected because it adds a state that
   exists only at some widths, and the EVT-07 spec fills `guest-register-name` without a click first:
   that flow would pass on the desktop project and differ on a phone, which is a second behaviour
   nobody tests. Fields side by side from `sm` up recovers most of the height instead.
3. **Sticky at the top rather than the bottom on narrow screens.** Avoids the report bubble entirely
   and stays clear of a phone's on-screen keyboard. Rejected because a pinned block at the top covers
   the heading and the first lines the reader is trying to read, and the bottom is where the thumb
   is; the bubble is handled by 4 rem of padding (AC-8).

## Changelog

- `2026-10-15T10:51:02+0700` — created. Sections 1 and 2 drafted from the feature row and the idea
  file; reading the source added AC-8 (the report bubble, `ReportIssueButton.tsx:122`, which the
  bottom-pinned block would otherwise sit under) and fixed the breakpoint at `xl` from the sidebar's
  measured width. No AC was narrowed to fit the code. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
- `2026-10-15T11:18:30+0700` — § 7 `src/components/AppShell.tsx` added and `size` S → M. § 2b's
  premise that the content pane scrolls was false: `main` grows past `min-h-screen` and the document
  scrolls, so a sticky element in the pane never sticks. Raised by `developer` (`99-questions.md`
  Q1). Amended by `tech-lead-design`, in the same session.
- `2026-10-15T11:22:00+0700` — § 2 AC-9's Given/When changed from *the deadline is moved to the past*
  to *a guest takes the last seat*, Then unchanged: only the creator may move the deadline, so the
  original could not be set up with the reader's page open. Raised by `developer`
  (`99-questions.md` Q2). Amended by `tech-lead-design`, in the same session.
