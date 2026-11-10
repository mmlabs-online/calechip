---
ticket: EVT-13
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-14T23:51:43+0700
inputs_read:
  - .ai/board/tickets/EVT-13/ticket.yaml
  - .ai/board/ideas/2026-10-14-a-team-or-named-event-cannot-invite-anyone-by-email.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-061-invitations-reach-every-event-scope-and-a-signed-in-reader-leaves-the-guest-page.md
  - .ai/standards/rbac-and-security.md
  - .ai/board/tickets/EVT-06/01-plan.md
  - supabase/migrations/20261009120000_evt06_guest_link.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - src/App.tsx
  - src/routes/GuestEvent.tsx
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - tests/e2e/evt-06-guest-link.spec.ts
  - tests/e2e/evt-07-guest-registration.spec.ts
  - tests/seam-parity.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-13 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md` § EVT without paraphrase:**

| ID | Title |
|----|-------|
| EVT-13 | A signed-in member who opens a guest link to an event they can read is taken to the event in the app |

The row's Notes are the scope: *"`/guest/<token>` redirects a signed-in user who can read the event to
`/events/<id>`; a signed-in user who cannot, and every signed-out reader, see the guest page as today.
Independent of `EVT-12`."* Decided by ADR-061 decision 8, `ACCEPTED by the operator` from Q4-A
verbatim; it replaces `EVT-06` AC-16 for a signed-in reader who can read the event.

**Who gains what.** Since `EVT-12` a team or limited event can be opened to guests by an invitation,
and a guest link travels: forwarded in chat, pasted in a mail, shared by a colleague. A member who
opens one while signed in today lands on the guest page — the stripped, account-less view, with a
form to register as a guest — when they could see the event in the app and join it as themselves.
This ticket sends that member to the event's own page instead, so they attend as a member, and the
attendee list does not split one person into a member and a guest. Everyone else — signed out, or
signed in without access to the event — sees exactly the guest page they see today. **No reader gains
anything they could not already read** (ADR-061 decision 8).

**Out of scope.**

- **Redirecting a signed-in user who cannot read the event** (Q4-B, decided against). They see the
  guest page and may register as a guest, as today.
- **Any change to the guest page itself** — its fields, its registration form, its not-found state,
  or what a signed-out reader sees (`EVT-06` AC-9 to AC-15, AC-17; `EVT-07`).
- **Any change to who can read an event**, to the guest link's lifecycle, or to who can see the link
  (`EVT-06` AC-1 to AC-8).
- **Converting an existing guest registration into a member's attendance**, or warning a member that
  they already registered as a guest with their own address. A member who registered as a guest
  before this ticket keeps that registration.
- **A link from the guest page to sign in**, or a prompt to sign in first. A signed-out reader is
  never redirected (ADR-061 revert condition 3).
- **Remembering the guest link through a sign-in.** A signed-out reader who signs in elsewhere and
  comes back is handled as a signed-in reader then, not before.
- **`EVT-12`'s invitations**, and the guest mail's button, which keeps pointing at `/guest/<token>`.

**`size_estimate: S`** — one route decides on load whether to redirect, and the one read that lets it
decide.

## 2. Acceptance criteria

Vocabulary as `EVT-01`'s and `EVT-06`'s (*can read an event*, *open to guests*, *the guest page*
`guest-event`, *the guest link*, *signed in*, *signed out*). Additionally:

- **A reader of the event** — a signed-in person who can read the event inside the product: an
  approved, not removed member for whom `EVT-01`'s read rule (with `EVT-02`'s participant clause)
  admits it — every admin, its creator, everyone on a public event, its team on an own-team event,
  its named people on a named-people event, and anyone pending or attending it.
- **The event page** — `/events/<id>`, `event-detail` (`EVT-01`).

**AC-1 — a reader is taken to the event page**
- Given an event open to guests, and a signed-in reader of the event
- When they open its guest link
- Then they land on the event page for that event, showing `event-detail` with the event's name, and
  the guest page's content is not shown at any point after the decision is made
- And the address bar shows `/events/<id>`
- And pressing the browser's Back button does not return them to the guest link, so they are not sent
  forward again in a loop
- *ADR-061 decision 8. Replaces `EVT-06` AC-16 for this case.*

**AC-2 — every kind of reader**
- Given an event open to guests
- Then AC-1 holds for each of: an admin of any team; its creator; any member, for a public event; a
  member of its team, for an own-team event; a named person, for a named-people event; a member
  pending or attending it whatever its scope

**AC-3 — a signed-in non-reader sees the guest page as today**
- Given an event open to guests, and a signed-in member who cannot read it — another team's member on
  an own-team event, a member not named on a named-people event
- When they open its guest link
- Then they see the guest page exactly as a signed-out caller does (`EVT-06` AC-9 to AC-12, and
  `EVT-07`'s registration), with no redirect and nothing on it saying the event exists in the app
- *ADR-061 decision 8, Q4-A over Q4-B.*

**AC-4 — a signed-in person with no access to the product sees the guest page**
- Given an event open to guests, and a signed-in person who is a pending sign-up, rejected, or
  removed, or who has no member row
- When they open its guest link
- Then they see the guest page exactly as a signed-out caller does, with no redirect

**AC-5 — a signed-out reader is never redirected**
- Given any guest link, valid or not
- When it is opened signed out
- Then the guest page is shown exactly as `EVT-06` describes, with no redirect and no sign-in screen
- *ADR-061 revert condition 3.*

**AC-6 — a link that does not work says one thing, signed in or not**
- Given a token that never existed, a malformed one, one whose event was closed to guests, or one
  whose event was deleted
- When it is opened by anyone, a reader of the event included
- Then they see `guest-event-not-found` with the same wording as `EVT-06` AC-13, and no redirect
- *A closed link no longer names an event, for anyone (`EVT-06` AC-4).*

**AC-7 — nothing is revealed to a non-reader**
- Given a signed-in person who is not a reader of the event, or a signed-out caller, holding the
  event's guest link
- Then nothing they can read — the guest page, the address bar, or any response straight to the
  datastore — gives them the event's id or tells them anything about the event the guest page does
  not already show a signed-out caller
- And no read straight to the datastore gives any caller the event id behind a token unless that
  caller is, at that moment, a reader of that event; a signed-out caller reaches no such read at all
- *ADR-061 decision 8: "No reader gains anything they could not already read." `EVT-06` AC-12: the
  guest read returns no event id; `EVT-06` AC-14: the anon key reaches nothing else.*

**AC-8 — the decision is made on every opening**
- Given a person who opened a guest link and was shown the guest page or the event page
- When their access changes — they are named, they join, they are removed from the product, they sign
  in or out — and they open the link again
- Then the outcome follows their access at that moment

**AC-9 — the rest of the product is as it was**
- Given any number of guest links opened
- Then every event, guest registration, attendance, notification and guest link is exactly what it
  would have been without them — opening a link reads, it never writes
- And `/events/<id>`, the guest page for a non-reader, and every other route behave as before

**Invariants touched: `[]`.** Opening a guest link reads; it writes nothing (AC-9). The new read
returns an event id or null and reads `event_guest_link` and, through `may_read_event`, the event,
its invitees, its attendance and the caller's own member row — no entry, no count, and no policy or
grant on `public.member` changes, so `listMembers()`, INV-04's denominator, is untouched. INV-01–07
constrain entries, which nothing here reads or writes.

**Open questions.** None that block. This plan's own readings, each cheap to reverse:

1. **Back does not return to the guest link** (AC-1). The redirect replaces the history entry. Not in
   ADR-061; without it, Back from the event page lands on the link and is sent forward again.
2. **A closed or deleted link redirects nobody** (AC-6), reader or not. The decision reads the open
   link only, so a reader holding a dead link sees `EVT-06`'s not-found page, as everyone does.
3. **Only a signed-in approved member is asked** (AC-4). A pending, rejected, removed or member-less
   session is never a reader (`may_read_event` starts from `member_team_id`), so the page does not
   ask the database for them at all.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image is in `.ai/board/tickets/EVT-13/design/` (the folder does not exist) or cited by the idea
file. **There is no new screen.** While the decision is being made, the guest page shows its
existing *Loading the event…* state (`EVT-06`); a reader then sees `EVT-01`'s event page and never
the guest card; everyone else sees the guest page unchanged. No banner, link or hint is added to
either page.

## 3. Permission model

Server-side always: the control is the definer function in § 4.1. The route's choice to ask is an
affordance.

| Action | signed out (`anon`) | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|---|
| Learn the event id behind a guest token | ❌ | only for an event they can read | same as member | ✅ any open link | `guest_link_event_id(text)`: granted to `authenticated` only; returns `event_id` only when `may_read_event(event_id, auth.uid())` |
| Learn the event id as a pending, rejected, removed or member-less session | ❌ | ❌ | ❌ | ❌ | `may_read_event` starts from `member_team_id(uid) is not null` |
| Learn whose event a token is without being its reader | ❌ | ❌ | ❌ | — | the function answers null for "no such open link" and for "not a reader" alike; the guest read (`EVT-06`) is unchanged and still returns no id |
| Read the guest token of an event they can read | ❌ | ❌ unless they may manage it | same | ✅ | unchanged — `EVT-06` AC-3; this function takes a token, it never returns one |

**Denials the tests must assert**, both implementations where the mock can express them: signed out,
`getGuestLinkEventId` is null (AC-5, AC-7); a member of another team holding an own-team event's token
gets null (AC-3); a member not named on a named-people event gets null (AC-3); a closed link's old
token gets null for its creator (AC-6); a malformed token makes no round trip (AC-6). In the
migration: the function is not granted to `anon`, and its body has no path returning `event_id`
without `may_read_event`.

**The mock reproduces it and cannot prove it** — the `EVT-01` precedent. The migration is applied by a
human (RULE-09).

## 4. Contract

### 4.1 Database — `supabase/migrations/20261015090000_evt13_guest_link_event_id.sql`

One transaction, idempotent in ADR-024's shape, header in `EVT-12`'s shape including the not-verified
line. Names fixed here (RULE-04).

```sql
-- EVT-13 AC-1, AC-7. The event behind an open guest link, to a reader of that event only.
create or replace function public.guest_link_event_id(p_token text) returns uuid
  language sql stable security definer set search_path = '' as $$
  select l.event_id
    from public.event_guest_link l
   where l.token = p_token
     and public.may_read_event(l.event_id, (select auth.uid()));
$$;

revoke all on function public.guest_link_event_id(text) from public, anon, authenticated;
grant execute on function public.guest_link_event_id(text) to authenticated;
```

**Nothing else.** No table, column, policy, trigger or grant on any table changes; `get_guest_event`,
`list_guest_event_attendees`, `may_read_event` and `event_guest_link`'s policies are read, not
changed.

### 4.2 Seam — `src/lib/data/index.ts`

Appended to `DataSeam` under an `EVT-13` banner after `EVT-07`'s guest functions. Both
implementations, same name and arity. **No existing signature changes; no domain type changes.**

```ts
  // -------------------------------------------------------------------------
  // EVT-13 — a signed-in reader leaves the guest page. 01-plan.md section 4.2. ADR-061 decision 8.
  // -------------------------------------------------------------------------

  /** EVT-13 AC-1..AC-7. The id of the event behind an OPEN guest link, only when the signed-in caller
   *  can read that event; null otherwise — signed out, not a reader, a closed, deleted or unknown
   *  link alike. Null for a token failing GUEST_LINK_TOKEN_PATTERN, with no round trip. Throws on a
   *  read failure. */
  getGuestLinkEventId(token: string): Promise<string | null>;
```

**`src/lib/data/supabase.ts`.** Pattern check → null; then `client().rpc("guest_link_event_id",
{ p_token: token })`; an error throws `getGuestLinkEventId failed: <message>`; `data` is the id, or
null. The route (§ 4.3) calls it only for a signed-in member.

**`src/lib/data/mock.ts`.** Pattern check → null; `guestEventId(token)` (the existing helper: open
links of live events); null → null; otherwise the id when `mayReadEvent(event, currentMemberId)`,
else null. No await between the lookup and the check.

### 4.3 Route — `src/App.tsx` and `src/routes/GuestEvent.tsx`

**`src/App.tsx`.** The `/guest/:token` route element becomes
`<GuestEvent signedInMember={membership.state === "member"} />`; its comment cites `EVT-13` and
replaces "with no guard and no redirect" with what is now true. The route stays outside the shell
and in `BareLayout`. Nothing else in the file changes.

**`src/routes/GuestEvent.tsx`.** The default export takes `{ signedInMember: boolean }`. Its load
effect, keyed on `token` and `signedInMember`:

1. If `signedInMember`: `seam.getGuestLinkEventId(token ?? "")`, a failure read as null. An id →
   `navigate(`/events/${id}`, { replace: true })` and stop — the guest reads are not made, and the
   state stays `loading`, so no guest content is drawn (AC-1).
2. Otherwise, or on null: the existing `getGuestEvent` and `getGuestRegistrationTerms` reads,
   unchanged (AC-3 to AC-6).

The header comment's *"NO SESSION IS READ, AND NONE IS NEEDED"* paragraph is rewritten to say what
the page now reads and why (ADR-061 § *Consequences*: the guest page is no longer session-blind).
`GuestRegistration`, the manage page, is unchanged and takes no prop.

### 4.4 Selectors

None added, none removed. AC-1 is observed through `event-detail`, `event-name` and the URL; AC-3 to
AC-6 through `EVT-06`'s `guest-event` and `guest-event-not-found`.

## 5. Seam impact

One function added to `DataSeam` and to both implementations with the same name and arity:
`getGuestLinkEventId(token)`. The seam-parity test covers it without an edit. No existing function's
signature or behaviour changes. `listMembers()` and every policy on `public.member` are untouched.

## 6. Schema delta

**Not `none`** — one definer function and its execute grant (§ 4.1). Triage wrote `none` (*"a client
route change; no table, policy, trigger or function"*); reading the source showed the client cannot
make the decision alone: `EVT-06` AC-12 keeps the event id out of the guest read, and
`event_guest_link`'s select policy shows the token only to those who may manage the event, so a
reader who is not a manager has no way to map a token to an event. `schema_delta` in `ticket.yaml` is
amended to say so.

**Within ADR-061.** Decision 8 decides the behaviour; this function is its smallest implementation,
returns nothing to a caller who could not already read the event, and is not granted to `anon`. It
supersedes no decision: the guest read, its fields and its anon grant are untouched, so ADR-052
decision 3 and `EVT-06` AC-12 and AC-14 stand. `requires_adr: true` is met by ADR-061.

**Applying it is human** (RULE-09). `supabase/db.sql` is not updated (MD-033).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/standards/rbac-and-security.md"
  - "supabase/migrations/20261015090000_evt13_guest_link_event_id.sql"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/App.tsx"
  - "src/routes/GuestEvent.tsx"
  - "tests/guest-link.test.ts"
  - "tests/e2e/evt-06-guest-link.spec.ts"
  - "tests/e2e/evt-07-guest-registration.spec.ts"
  - "tests/e2e/evt-10-description.spec.ts"
  - "tests/e2e/evt-11-description-pictures.spec.ts"
```

**Glossary:** `glossary_owed: []`. *Guest link* already has a row and is not rewritten.

**Standards written by this ticket:** `.ai/standards/rbac-and-security.md` — § 3's first row added
beside `EVT-06`'s guest-link rows, and one sentence in the *Signed out* paragraph saying
`guest_link_event_id(text)` is not granted to `anon`.

**Why each test path.** `guest-link.test.ts` takes § 3's denials and the migration-shape checks.
`evt-06-guest-link.spec.ts:185` asserts `EVT-06` AC-16 — a signed-in creator on the guest page —
which AC-1 reverses: it becomes the redirect case, and a signed-in non-reader case is added.
`evt-07-guest-registration.spec.ts` AC-4 (`:149`) and AC-17 (`:210`) register as a guest while signed
in as the event's creator, who is now redirected; each signs out, or switches to a member who cannot
read the event, before opening the link — a change of who drives the journey, not of what it asserts.
`evt-10-description.spec.ts` AC-2/3/4 (`:237`), AC-6 (`:329`) and AC-8 (`:418`), and
`evt-11-description-pictures.spec.ts` AC-3 (`:206`) and AC-7 (`:266`), open the guest page signed in
as the event's creator to assert the guest surface, and are now redirected; each signs out before
that `navigate` and signs back in client-side only if a later step needs the creator. No assertion
changes. *Added at the developer's Q1 (`99-questions.md`).*

**Deliberately absent:** `src/lib/domain/types.ts` (the function returns a `string`); a new e2e spec
(the cases sit beside `EVT-06`'s guest-page cases); `.ai/registry/decisions/ADR-052-*.md`'s Status
note (ADR-061 § *Affected documents*; `/thuki`).

**`size: M`** — ten paths. **Disagrees with `size_estimate: S`**: the estimate assumed a client-only
change, as triage's `schema_delta: none` did; the definer read (§ 6) adds a migration, the seam in
three files and a standards row, and two existing e2e journeys need a different driver. The verdict
wins (ADR-012).

## 8. Rejected alternatives

**1. Let readers of an event read its guest token** — widen `event_guest_link`'s select policy to
`may_read_event`, then compare tokens on the client. No new function. Rejected: it shows every team
member the guest link of every event they can read, which `EVT-06` AC-3 forbids (*"never to a reader
who may not manage it"*) and ADR-052 keeps with the managers.

**2. Add the event id to the guest read for a signed-in caller.** One call instead of two. Rejected:
`get_guest_event` is `anon`'s read; giving it a session-dependent column makes its answer differ by
caller, and `EVT-06` AC-12's fixed field list is the property its tests assert. A separate function
granted to `authenticated` only keeps the anon surface exactly as it was.

**3. Match the guest event against `listEvents()` on the client** by name and dates. No database
change. Rejected: two events may share a name and dates, so the redirect could land on the wrong
event.

**4. Redirect in `App.tsx`'s route table** with a guard component. Rejected: the decision needs a
round trip keyed on the token, and the guest page already owns the loading state and the token's
pattern check; a second component would duplicate both.

## Changelog

- 2026-10-14T23:51:43+0700 — created. Sections 1 and 2 were written from the feature row, ADR-061
  decision 8 and `EVT-06`'s plan before the source was read. On reading the source: AC-7 was
  rewritten, without loosening it, from a sentence about telling valid links apart — which the guest
  page already does for anyone — to what decision 8 protects, the event id and anything beyond the
  guest page; and it gained the signed-out caller. `schema_delta` amended from `none` (§ 6). Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.
- 2026-10-15T08:04:35+0700 — Amended by tech-lead-design at the developer's Q1: § 7 gains
  `tests/e2e/evt-10-description.spec.ts` and `tests/e2e/evt-11-description-pictures.spec.ts`, whose
  guest-surface journeys are driven by the signed-in creator and are redirected by AC-1 — the same
  case already planned for `evt-07`, missed at PLAN. Twelve paths; `size` stays `M`, at the split
  limit and not over it.
