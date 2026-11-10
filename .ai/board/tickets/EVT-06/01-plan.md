---
ticket: EVT-06
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-09T09:55:08+0700
inputs_read:
  - .ai/board/tickets/EVT-06/ticket.yaml
  - .ai/board/ideas/2026-10-08-a-gathering-cannot-include-anyone-without-an-account.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-052-an-event-can-be-opened-to-guests-without-an-account.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/steward/context.md
  - .ai/board/tickets/EVT-02/01-plan.md
  - .ai/board/tickets/EVT-05/01-plan.md
  - .ai/board/tickets/EVT-05/ticket.yaml
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/routes/EventDetail.tsx
  - src/App.tsx
  - tests/ui-language.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-06 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md` § EVT without paraphrase:**

| ID | Title |
|----|-------|
| EVT-06 | A creator opens an event to guests, and anyone with its link reads it and who is coming |

The row's Notes are the scope, each clause an operator answer in
`.ai/board/ideas/2026-10-08-a-gathering-cannot-include-anyone-without-an-account.md` § *Evidence*,
decided by ADR-052 (`ACCEPTED by the operator`), which overrides ADR-045 decision 3 for an opened
event: the creator, any member, opens or closes it (Q2-A); any scope (Q3-B); an unguessable link,
unlisted, unindexed (Q9-A); the page shows the event and its attendee names (Q4-B, F3-A) — including
a named-people event's, to anyone with the link (F2-A). The anonymous caller reaches only an opened
event addressed by its token — never another event, an entry, or a member field beyond a name.

**Who gains what.** Today an event exists only for signed-in members its scope admits. This ticket
lets the person who organises it — or an admin — turn on a link they can hand to anyone, and lets
whoever holds that link see what the gathering is, when and where, how many seats are left and who is
already coming, without an account. It is the read half: nobody outside can yet *register*
(`EVT-07`), so what this delivers is that the creator stops re-typing the event into a chat message
for outsiders. The property that must not bend is the fence: the link opens exactly one event's
public fields and attendee names, and the anon key reaches nothing else.

**Out of scope.**

- **Guest registration, the manage link, guest email visibility** — all `EVT-07`. No guest row,
  table or field exists after this ticket, and the guest page has no join control.
- **Emailing the link to anyone**, or any notification when an event is opened or closed. Opening is
  not an edit of the event and fires none of `EVT-04`'s triggers (§ 2 AC-1).
- **A list of opened events** anywhere, and search-engine indexing (Q9-A).
- **A notice to the event's attendees that their names are on a public page.** The exposure is
  decided (F2, ADR-052 § *Consequences*); telling attendees about it is not asked for and would be a
  later ticket.
- **Server headers** (`X-Robots-Tag`, `Referrer-Policy`) on the guest address. The page sets both as
  `<meta>` tags (AC-15); a header needs the hosting config, which no one has asked to touch.
- **Showing on the guest page** the creator, scope, named list, approval mode, registration deadline,
  avatars, teams or any email — Q4 lists the fields, and these are not among them.
- **Any new power for `manager`**, and any change to `listEvents`, `getEvent` or another existing
  seam function.
- **`.ai/standards/data-model.md`'s `event_guest_link` entity** — ADR-052 § *Affected documents*
  names it; § 7 explains why it goes to `/thuki` and not this ticket. § 4.3 is its transcription
  source.
- **The charter's stale § *Who uses it*** — ADR-052 § *Affected documents* leaves it unrepaired.

**`size_estimate: M`** — one migration (one table, three policies, two definer reads), four seam
functions in both implementations, one new screen, one changed screen, the route, and their tests.

## 2. Acceptance criteria

Vocabulary, in addition to `EVT-01`'s and `EVT-02`'s (*can read an event*, *attendee*, *seats
taken*, *straight to the datastore*):

- **Guest link** — glossary row written by this ticket. An event **is open to guests** while it has
  one.
- **May manage an event** — its creator while still an approved, non-removed member, or any admin.
  `EVT-01`'s editors exactly (`may_manage_event`); never a manager as such.
- **Signed out** — a caller holding only the public anon key, no session.
- **The guest page** — the address the guest link points at, `/guest/<token>`.

### Opening and closing

**AC-1 — the creator opens an event to guests**
- Given the detail page of an event the caller created, not open to guests
- When they press `event-guest-open-button`
- Then `event-guest-link` shows the full address `<origin>/guest/<token>`, where `<token>` is 64
  lowercase hexadecimal characters
- And the event itself is unchanged: its `updatedAt` does not move and no notification of any kind
  is written to anyone

**AC-2 — an admin opens and closes any event**
- Given an admin on the detail page of any event, whatever its scope or team and whoever created it
- Then they see `event-guest-panel` and may open and close it exactly as its creator may
- *Confirms the idea's assumption 1 and ADR-052 decision 1's "assumed, not asked": an admin edits any
  event (ADR-045 decision 5), and opening is the narrower power.*

**AC-3 — nobody else opens, closes or sees the link**
- Given a member who can read an event but may not manage it — including a manager, and including
  the event's own attendees and named people
- Then they see no `event-guest-panel`, and `getEventGuestLink` returns null for them whether or not
  the event is open
- And opening or closing it straight to the datastore is refused with `event_not_permitted`, and an
  open that is refused creates no link
- And the same refusals hold for the event's creator once they are removed from the product or are
  no longer approved
- *The link is shown only to those who may manage the event: this plan's default denial, not an
  operator answer. A reader who could see it could forward it, widening the event past its scope
  without the creator's decision — and Q2 gives that decision to the creator.*

**AC-4 — closing stops the link**
- Given an event open to guests, on its detail page, as someone who may manage it
- When they press `event-guest-close-button`, then `event-guest-close-confirm` in the confirmation,
  which says the link will stop working for everyone holding it
- Then the panel shows the event as not open, with `event-guest-open-button` again
- And the guest page at the old address shows `guest-event-not-found` from that moment
- And `event-guest-close-cancel` leaves the event open and the link unchanged

**AC-5 — opening again makes a new link**
- Given an event that was open, then closed
- When it is opened again
- Then its link carries a different token, and the token from before stays dead
- *ADR-052 decision 2: "Opening it creates an unguessable link" — read per opening. A closed link
  that came back on reopening would put back into circulation an address its creator chose to kill.*

**AC-6 — opening twice gives one link**
- Given an event already open to guests — opened in another tab, or by an admin and its creator at
  the same moment
- When it is opened again
- Then it has exactly one link, the result is the link already in place, and its token does not
  change

**AC-7 — deleting the event kills its link**
- Given an event open to guests
- When it is deleted (`EVT-01` AC-15)
- Then its guest page shows `guest-event-not-found`

**AC-8 — copying the link**
- Given `event-guest-link` on screen
- When `event-guest-copy-button` is pressed
- Then the address is written to the clipboard and `event-guest-copied` reads *Copied*
- And where the browser refuses the clipboard, `event-guest-copied` asks the reader to select the
  address and copy it themselves, and the address stays on screen

### The guest page

**AC-9 — anyone with the link reads the event, signed out**
- Given an event open to guests, and a caller who is signed out
- When they open its guest link
- Then they see `guest-event`, with no sign-in screen, no sidebar and no top bar, showing top to
  bottom: `guest-event-name`; `guest-event-dates` (one date, or a start and end); `guest-event-location`
  when it has one; `guest-event-description` when it has one; `guest-event-seats`; then
  `guest-event-attendees`
- And `guest-event-seats` reads *N of M seats left* when the event has a capacity and a seat is free,
  *Full* when seats taken equals capacity, and *No seat limit* when it has none

**AC-10 — who is coming**
- Given the guest page
- Then `guest-event-attendees` lists every attendee (status `attending`) by display name, one
  `guest-event-attendee` each, in the order they joined, members of any team alike (F3-A)
- And a pending, rejected or removed attendance is not listed and not counted
- And an attendee who is no longer an approved member of the product is listed as *Former member*,
  with no name
- And with no attendees, `guest-event-attendees-empty` says nobody has joined yet

**AC-11 — any scope, named people included**
- Given an event of scope own team, every team, or named people, open to guests
- Then its guest page shows it exactly as AC-9 and AC-10 describe, to a signed-out caller and to a
  signed-in member who cannot read it inside the product alike (Q3-B, F2-A)

**AC-12 — nothing but those fields**
- Given the guest page, or the guest read called straight to the datastore with a valid token
- Then what comes back is the event's name, description, location, start date, end date, capacity,
  seats taken, and the attendees' display names — nothing else: no event id, creator, team, scope,
  named list, approval mode, deadline, timestamps, member id, avatar, role, team or email
  (ADR-052 decision 3, revert condition 1)

**AC-13 — a link that does not work says one thing**
- Given a token that never existed, a malformed one, one whose event was closed (AC-4) or deleted
  (AC-7)
- When the guest page is opened with it
- Then it shows `guest-event-not-found` with the same wording in every one of those cases, and
  nothing on it distinguishes them

**AC-14 — the anon key reaches nothing else**
- Given a signed-out caller going straight to the datastore with the anon key
- Then reading `event`, `event_attendance`, `event_invitee`, `event_guest_link`, `member`, `entry`
  or `notification` returns nothing or is refused
- And calling `list_member_directory`, `save_event`, `may_manage_event`, or any other function but
  the two guest reads is refused
- And opening or closing any event to guests is refused
- And the two guest reads return nothing for any token but an open event's — so no call lists
  opened events or reveals whether an event exists
- (ADR-052 § *Consequences*: "a policy that tested only 'opened' would make every opened event
  enumerable"; revert condition 1)

**AC-15 — not indexed, not leaked**
- Given the guest page, in any state including `guest-event-not-found`
- Then the document carries `<meta name="robots" content="noindex, nofollow">` and
  `<meta name="referrer" content="no-referrer">`, and neither is present on any other address once
  the reader leaves it
- *`no-referrer` is this plan's: a link clicked in a description would otherwise hand the token to
  the site it points at, which is a way of listing it (Q9-A).*

**AC-16 — a signed-in reader sees the same page**
- Given a signed-in member, whatever their team, role or membership state
- When they open a guest link
- Then they see the guest page exactly as a signed-out caller does, with no redirect — and with no
  more on it than AC-12 allows

**AC-17 — a past event stays readable**
- Given an open event whose end date is before today in `Asia/Ho_Chi_Minh`
- Then its guest page still shows it; opening is ended only by closing (AC-4) or deleting (AC-7)

### What it does not touch

**AC-18 — members' screens are otherwise unchanged**
- Given any member who may not manage an event
- Then its detail page, the events list and the week and month grids look and behave exactly as
  before, open or not
- And `listEvents`, `getEvent`, `listEventAttendance`, `listMemberDirectory` and `listMembers`
  return exactly what they returned before this ticket, to every caller

**Invariants touched: `[INV-04]`.** The guest read resolves members' display names for an anonymous
caller, which is the widest read of `member` the product has made. INV-04's denominator is what
`listMembers()` returns, and a design that met the requirement by widening a `member` policy — or
adding an `anon` policy to `member` — would change it. It is held by § 4.3: no policy or grant on
`public.member` changes, and the only path to a name is a `security definer` function returning one
text column (§ 6). No entry is read, so INV-01–03 and INV-05–07 are not reached; ADR-052 decision 9
records that guests (`EVT-07`) engage none of INV-04, INV-05, INV-07 either.

**Open questions.** None that block. Three answers above are this plan's and not the operator's, each
marked where it stands: who sees the link (AC-3), a new token on reopening (AC-5), and `no-referrer`
(AC-15). Each is cheap to reverse.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image is in `.ai/board/tickets/EVT-06/design/` (the folder does not exist) or cited by the idea
file. What follows is the arrangement, and nothing in it is a behaviour beyond § 2.

**Event detail — `event-guest-panel`**, for those who may manage the event only, inside the event
card, last, below `EVT-02`'s attendance panel, behind the same `border-t border-line pt-4` divider:

- A heading **Guest link**, small caps as *Invited* and *Going* are.
- **Not open:** one line, *Anyone with the link can see this event and who is coming, without
  signing in.* — then `event-guest-open-button`, **Open to guests**, a secondary button.
- **Open:** the same line; `event-guest-link`, a read-only text field holding the address, full
  width, selecting itself on focus; beside it `event-guest-copy-button` **Copy**; under it
  `event-guest-copied` as a polite status line; then `event-guest-close-button` **Close the link**,
  a text-style button in `text-danger`. `event-guest-error` (role `alert`) above the buttons when a
  call fails.
- The close confirmation is the shared `Modal` with `testIdPrefix="event-guest-close"`, heading
  *Close the guest link?*, body *The link will stop working for everyone who has it. Opening it
  again makes a new link.*

**Guest page — `/guest/:token`**, rendered in `BareLayout` beside `/signup`, no shell:

- One card, `max-w-xl`, centred, `rounded-card bg-card shadow-soft` as the event detail card is.
- Above the card, small and muted: the product name, not a link (a guest has nowhere in it to go).
- In the card, the AC-9 order. Dates and location in `text-ink-2`; description `whitespace-pre-wrap`.
  `guest-event-seats` is a pill; *Full* uses the overloaded-day pink, never red (`CLAUDE.md`
  § *Visual direction*).
- **Going (N)** heading, then the attendees as name-only pills (`rounded-pill bg-field`) — no avatar,
  because AC-12 sends none.
- `guest-event-not-found`: the same card, *This link does not work. It may have been closed, or the
  address may be incomplete.* — and nothing else, no link onward.
- English copy throughout (idea assumption 5); no Vietnamese diacritic in interface copy
  (`ui-language.json`). Attendee names are user content and render as stored.

## 3. Permission model

Server-side always: the controls are the grants, policies and definer functions in § 4.3. The screen
hides the panel from non-managers and is an affordance only.

| Action | signed out (`anon`) | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|---|
| Open an event they created to guests | — | ✅ | ✅ | ✅ | `event_guest_link_insert_manage` (`may_manage_event`) |
| Open someone else's event to guests | ❌ | ❌ | ❌ **as a manager, nothing** | ✅ | same policy; admin is `is_admin`, never `may_decide` |
| Close an event's guest link | ❌ | own event only | own event only | ✅ any | `event_guest_link_delete_manage` |
| Read an event's guest link (the token) | ❌ | own event only | own event only | ✅ any | `event_guest_link_select_manage` |
| Choose the token, or the time it was opened | ❌ | ❌ | ❌ | ❌ | column grant: `insert (event_id)` only; no update grant |
| Any of the above once removed or no longer approved | ❌ | ❌ | ❌ | ❌ | `may_manage_event`'s `member_team_id(uid) is not null` |
| Read an open event's public fields and attendee names, with its token | ✅ | ✅ | ✅ | ✅ | `get_guest_event(text)`, `list_guest_event_attendees(text)` |
| Read anything through a token that is not an open event's | ❌ | ❌ | ❌ | ❌ | both functions return zero rows |
| List open events, or learn whether an event exists | ❌ | ❌ | ❌ | ❌ | no function takes anything but a token; no `anon` grant on any table |
| Read any table, or call any other function | ❌ | (unchanged) | (unchanged) | (unchanged) | `revoke all … from anon` on every object this migration creates; no existing `anon` grant changes |

**Denials the tests must assert**, both implementations where the mock can express them: a reader
who is not a manager of the event gets null from `getEventGuestLink` and `event_not_permitted` from
open and close (AC-3); a manager gets the same (AC-3); a removed creator gets the same (AC-3); a
signed-out caller gets `event_not_permitted` from open and close and null from `getEventGuestLink`
(AC-14); `getGuestEvent` returns null for an unknown, malformed, closed and deleted token (AC-13); a
`GuestEvent` carries exactly the keys in § 4.1 (AC-12).

**The mock reproduces these clause for clause and cannot prove them** — the `EVT-01` precedent. The
migration is applied by a human (RULE-09); the permission-model test against a real PostgreSQL stays
owed project-wide.

## 4. Contract

### 4.1 Domain types — `src/lib/domain/types.ts`

Appended under a new `EVT-06` banner after `EVT-04`'s. No existing type changes; `CalEvent` gains
nothing.

```ts
// ---------------------------------------------------------------------------
// EVT-06 — the guest link. 01-plan.md section 4.1. ADR-052.
// ---------------------------------------------------------------------------

/** EVT-06. Glossary *Guest link*. One row of `public.event_guest_link`. Readable only by those who
 *  may manage the event (AC-3). `token` is 64 lowercase hex characters, chosen by the database. */
export interface EventGuestLink {
  eventId: string;
  token: string;
  /** ISO 8601. When this link was created; a reopened event has a later one (AC-5). */
  openedAt: string;
}

/** EVT-06. What the guest page reads, and EXACTLY that — AC-12, ADR-052 revert condition 1. No id,
 *  no creator, no scope, no deadline, no member id. Adding a field here is widening what the anon
 *  key reads, and needs its own decision. */
export interface GuestEvent {
  name: string;
  description: string | null;
  location: string | null;
  /** `yyyy-MM-dd`, inclusive both ends, as `CalEvent` does. */
  startDate: string;
  endDate: string;
  capacity: number | null;
  /** Attendances in state `attending`. */
  seatsTaken: number;
  /** One per attendee, in join order. Null for a person no longer an approved member — rendered
   *  "Former member" (AC-10). */
  attendeeNames: Array<string | null>;
}

/** EVT-06 AC-1. The token's shape, as the database's check states it. The guest page does not call
 *  the datastore for a token that fails it, and shows the same not-found (AC-13). */
export const GUEST_LINK_TOKEN_PATTERN = /^[0-9a-f]{64}$/;
```

**No new error code.** Refusals reuse `event_not_permitted` (42501, or a write that touched zero
rows), whose sentence already fits.

### 4.2 Seam — `src/lib/data/index.ts`

Appended to `DataSeam` under an `EVT-06` banner after `EVT-05`'s. Both implementations, same names and
arity (seam-parity test).

```ts
  // -------------------------------------------------------------------------
  // EVT-06 — the guest link. 01-plan.md section 4.2. ADR-052.
  //
  // Four functions, none changing an existing one. Open, close and the link read are a table and
  // three policies in `supabase/migrations/20261009120000_evt06_guest_link.sql`; the guest read is
  // two `security definer` functions, THE ONLY OBJECTS THE ANON ROLE MAY CALL. `listMembers()` and
  // every policy on `public.member` are untouched (INV-04).
  // -------------------------------------------------------------------------

  /** EVT-06 AC-1, AC-3. The event's guest link, or null when it is not open OR the caller may not
   *  manage it — deliberately the same answer. Throws on a read failure. */
  getEventGuestLink(eventId: string): Promise<EventGuestLink | null>;

  /** EVT-06 AC-1, AC-2, AC-3, AC-5, AC-6. Inserts the row; the database chooses the token. A 23505
   *  (already open) is NOT an error: the existing link is read back and returned (AC-6). 42501, or
   *  a 23505 whose read-back finds nothing, is `event_not_permitted`. */
  openEventToGuests(eventId: string): Promise<Result<EventGuestLink>>;

  /** EVT-06 AC-3, AC-4. Deletes the row and reads back what it removed; zero rows is
   *  `event_not_permitted`, not success — `deleteEvent`'s shape. */
  closeEventToGuests(eventId: string): Promise<Result<void>>;

  /** EVT-06 AC-9..AC-14, AC-16, AC-17. Works with no session. Null for a token failing
   *  GUEST_LINK_TOKEN_PATTERN (no round trip), and for one that is not an open event's. Two calls —
   *  `get_guest_event` then `list_guest_event_attendees` — merged; `seatsTaken` comes from the
   *  first, never from the length of the second. The attendee read is bounded by
   *  DATASTORE_MAX_ROWS and throws at the bound, as `listEventAttendance` does. Throws on any other
   *  read failure. */
  getGuestEvent(token: string): Promise<GuestEvent | null>;
```

**`src/lib/data/supabase.ts`.** `getEventGuestLink`: `from("event_guest_link").select("event_id, token,
opened_at").eq("event_id", eventId).maybeSingle()`. `openEventToGuests`:
`insert({ event_id }).select("event_id, token, opened_at").single()`; on `23505`, call
`getEventGuestLink` and return it if non-null. `closeEventToGuests`: `delete().eq("event_id",
eventId).select("event_id")`. `getGuestEvent`: `rpc("get_guest_event", { p_token })` then
`rpc("list_guest_event_attendees", { p_token }).limit(DATASTORE_MAX_ROWS)`. The mapper turns
`event_id`/`opened_at`/`start_date`/`end_date`/`seats_taken`/`display_name` into § 4.1's names and
nothing else.

**`src/lib/data/mock.ts`.** A module-level `Map<string, { token: string; openedAt: string }>` keyed by
event id, not persisted (the event store is not either). The caller check is `EVT-01`'s
`may_manage_event` reproduction. Tokens are 32 bytes from `crypto.getRandomValues`, hex-encoded.
`deleteEvent` removes the event's entry (the cascade). `getGuestEvent` reads no session. Attendee
names resolve as the directory does: approved and not removed, otherwise null.

### 4.3 Database — `supabase/migrations/20261009120000_evt06_guest_link.sql`

One transaction, idempotent in ADR-024's shape. **Nothing existing is replaced**: no policy, trigger
or function from `EVT-01`–`EVT-05` changes, and nothing is written to `public.event`.

```sql
begin;

-- 1. The table. A row is "open to guests"; no row is closed. The token is the database's.
create table if not exists public.event_guest_link (
  event_id  uuid primary key references public.event(id) on delete cascade,   -- AC-6, AC-7
  token     text not null unique
            default (replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', '')),
  opened_at timestamptz not null default now(),
  constraint event_guest_link_token_shape check (token ~ '^[0-9a-f]{64}$')
);
alter table public.event_guest_link enable row level security;

-- 2. Policies. `to authenticated`, `(select auth.uid())` wrapped, drop-then-create.
drop policy if exists event_guest_link_select_manage on public.event_guest_link;
create policy event_guest_link_select_manage on public.event_guest_link
  for select to authenticated
  using (public.may_manage_event(event_id, (select auth.uid())));

drop policy if exists event_guest_link_insert_manage on public.event_guest_link;
create policy event_guest_link_insert_manage on public.event_guest_link
  for insert to authenticated
  with check (public.may_manage_event(event_id, (select auth.uid())));

drop policy if exists event_guest_link_delete_manage on public.event_guest_link;
create policy event_guest_link_delete_manage on public.event_guest_link
  for delete to authenticated
  using (public.may_manage_event(event_id, (select auth.uid())));

-- 3. The guest read. SECURITY DEFINER, and the ONLY anon-callable objects in the schema.
--    Each filters on the token FIRST and on nothing the caller can widen.
create or replace function public.get_guest_event(p_token text)
  returns table (name text, description text, location text, start_date date, end_date date,
                 capacity integer, seats_taken integer)
  language sql stable security definer set search_path = '' as $$
  select e.name, e.description, e.location, e.start_date, e.end_date, e.capacity,
         (select count(*)::integer from public.event_attendance a
           where a.event_id = e.id and a.status = 'attending'::public.attendance_status)
    from public.event_guest_link l
    join public.event e on e.id = l.event_id
   where l.token = p_token;
$$;

create or replace function public.list_guest_event_attendees(p_token text)
  returns table (display_name text)
  language sql stable security definer set search_path = '' as $$
  select case when m.status = 'approved'::public.member_status and m.removed_at is null
              then m.display_name end
    from public.event_guest_link l
    join public.event_attendance a on a.event_id = l.event_id
                                  and a.status = 'attending'::public.attendance_status
    join public.member m on m.id = a.member_id
   where l.token = p_token
   order by a.created_at, a.member_id;
$$;

-- 4. Grants. Explicit, never inherited (EVT-01 § 7's reason).
revoke all on public.event_guest_link from anon, authenticated;
grant select, delete on public.event_guest_link to authenticated;
grant insert (event_id) on public.event_guest_link to authenticated;

revoke all on function public.get_guest_event(text) from public, anon, authenticated;
revoke all on function public.list_guest_event_attendees(text) from public, anon, authenticated;
grant execute on function public.get_guest_event(text) to anon, authenticated;
grant execute on function public.list_guest_event_attendees(text) to anon, authenticated;

commit;
```

`gen_random_uuid()` is core PostgreSQL (13+) and draws from the strong random source; two v4 UUIDs
give 244 random bits and need no extension schema. Every table since `TEA-01` already defaults its
id to it (`20260831150024_tea01_membership.sql:25`), so the function is known to exist where this
migration runs.

### 4.4 Screens

**`src/App.tsx`.** One route, inside the first `<Route element={<BareLayout />}>` beside `/signup`,
reachable in every membership state, no guard:

```tsx
<Route path="/guest/:token" element={<GuestEvent />} />
```

**`src/routes/GuestEvent.tsx`** (new), default export `GuestEvent(): JSX.Element`. Reads `token` from
`useParams`; calls `seam.getGuestEvent(token)` once; states `loading`, `ready`, `missing` (null *or* a
thrown read — the same `guest-event-not-found`, AC-13). A `useEffect` appends the two `<meta>` tags of
AC-15 to `document.head` on mount and removes them on unmount. Exports
`guestSeatsLabel(capacity: number | null, seatsTaken: number): string` returning AC-9's three
strings, for the unit test.

**`src/routes/EventDetail.tsx`.** The `load` adds `seam.getEventGuestLink(id)` to its `Promise.all`
only when `mayEditEvent(event, me)` — so a non-manager makes no extra call (AC-18). The panel of § 2b
is a function component in the same file, `EventGuestPanel({ event, link, onChange })`, rendered
when `canEdit`. Exports `guestLinkUrl(origin: string, token: string): string` returning
`` `${origin}/guest/${token}` ``.

### 4.5 Selectors

| Selector | Where | AC |
|---|---|---|
| `event-guest-panel` | event detail, managers only | AC-2, AC-3, AC-18 |
| `event-guest-open-button` | panel, not open | AC-1, AC-4, AC-5 |
| `event-guest-link` (read-only input) | panel, open | AC-1, AC-5, AC-6 |
| `event-guest-copy-button`, `event-guest-copied` | panel, open | AC-8 |
| `event-guest-close-button`, `event-guest-close-confirm`, `event-guest-close-cancel` | panel and its modal | AC-4 |
| `event-guest-error` | panel | AC-3 |
| `guest-event` | guest page | AC-9, AC-11, AC-16 |
| `guest-event-name`, `guest-event-dates`, `guest-event-location`, `guest-event-description`, `guest-event-seats` | guest page | AC-9, AC-12 |
| `guest-event-attendees`, `guest-event-attendee`, `guest-event-attendees-empty` | guest page | AC-10 |
| `guest-event-not-found` | guest page | AC-4, AC-7, AC-13 |

## 5. Seam impact

Four functions added to `DataSeam` and to both implementations with the same names and arity:
`getEventGuestLink(eventId)`, `openEventToGuests(eventId)`, `closeEventToGuests(eventId)`,
`getGuestEvent(token)`. **No existing function's signature or behaviour changes**, except that the
mock's `deleteEvent` also drops the event's guest link — the reproduction of the cascade, invisible to
any caller that does not hold a token. So this is not XL (operating model § *Sizing*).

## 6. Schema delta

**Not `none`.** One table, `public.event_guest_link`, with a check constraint, a unique constraint,
three policies and column grants; two `security definer` functions granted to `anon`. Decided by
[ADR-052](../../../registry/decisions/ADR-052-an-event-can-be-opened-to-guests-without-an-account.md),
`ACCEPTED by the operator` — `requires_adr: true` is met.

**Departs from `ticket.yaml`'s triage description**, which said *fields and a token on
`public.event`*. Corrected in `schema_delta` and the Changelog. A column on `public.event` would be
returned to every reader of the event by `event_select_visible` and the table-wide `select` grant —
the token to every member AC-3 denies it to — and opening would be an `UPDATE` of `event`, which
fires `EVT-04`'s `notify_event_updated` to every participant (contradicting AC-1). § 8 alternative 1.

**Why definer functions for the anon read, and not an `anon` policy**: ADR-052 § *Consequences* names
the shape. A policy on `event` for `anon` cannot see the token the caller holds — PostgREST hands it
no parameter — so it could test only "is opened", which is the enumerable shape ADR-052 forbids. And
an `anon` policy on `member` would touch INV-04's denominator. The functions return a fixed column
list; § 2 AC-12 is the column list's test.

**`EVT-02`'s concurrency guarantee is untouched**: nothing here writes an attendance. `EVT-07` is
where anonymous writers enter the race.

**Applying it is human** (RULE-09). `supabase/db.sql` is not updated (MD-033).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/glossary.md"
  - ".ai/standards/rbac-and-security.md"
  - "supabase/migrations/20261009120000_evt06_guest_link.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/routes/EventDetail.tsx"
  - "src/routes/GuestEvent.tsx"
  - "src/App.tsx"
  - "tests/guest-link.test.ts"
  - "tests/e2e/evt-06-guest-link.spec.ts"
```

**Glossary:** *Guest link*, written at this stage (ADR-047).

**Standards written by this ticket:** in `.ai/standards/rbac-and-security.md` § *The permission
table*, § 3's rows for opening, closing and reading the guest link, and for the anonymous guest read,
with a signed-out column note — the anon role's first rows (ADR-052 § *Affected documents*). Nothing
else in that file changes. **`.ai/standards/data-model.md`'s `event_guest_link` entity is left to
`/thuki`**, the `EVT-01`/`EVT-02` precedent: twelve paths is the ceiling for M, a thirteenth makes this
an L that would have to split, and the split the operating model allows — read path from write path —
was already made at triage. The entity is § 4.3 transcribed.

**`size: M`** — twelve paths. Agrees with `size_estimate: M`. It was fourteen in the first draft; the
guest panel moved into `EventDetail.tsx` instead of its own component file, and the data-model entity
went to `/thuki`.

## 8. Rejected alternatives

**1. The token as a column on `public.event`** (triage's description). One table fewer and no join.
Rejected: `event_select_visible` and the table-wide `select` grant return the column to every reader
of the event, so hiding it from non-managers needs a column-level revoke that breaks every existing
`select("*")` on `event`; and opening becomes an `UPDATE` of `event`, which fires `EVT-04`'s
`notify_event_updated` to every participant and moves `updatedAt`, which `EventDetail` keys the
attendance panel on. A separate table puts the token behind its own three policies and touches
nothing that exists.

**2. A boolean `open_to_guests` on `event` and the event id as the link.** Simplest possible, and the
link never changes. Rejected: the event id is in every member's browser and every notification, so
the link would not be unguessable and ADR-052 decision 2 would not hold; and closing could not kill
an address that had leaked, only hide the event until the next opening.

**3. One `security definer` function returning a JSON document**, event and attendee names in one
round trip. Rejected: a `jsonb` return has no column list the database enforces, so a later edit that
adds `e.*` to it widens what the anon key reads with no signature change for a reviewer to see. Two
functions with `returns table (…)` make AC-12 a property of the signature.

**4. Show the guest link to every reader of the event.** Lets any attendee forward it. Rejected for
AC-3's reason: Q2 gives the decision to open — that is, to widen past the event's scope — to the
creator, and a link every reader holds is a decision every reader makes.

## Changelog

- 2026-10-09T09:55:08+0700 — created. `schema_delta` in `ticket.yaml` rewritten from triage's *fields
  and a token on `public.event`* to the separate `event_guest_link` table, for § 6's reason; the ACs
  were written before the source was read and none was amended after. Raised by `tech-lead-design`.
  Amended by `tech-lead-design`.
