---
ticket: EVT-05
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-09T08:50:35+0700
inputs_read:
  - .ai/board/tickets/EVT-05/ticket.yaml
  - .ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-050-in-app-notifications-for-events-are-written-by-the-database.md
  - .ai/registry/decisions/ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/standards/tech-stack.md
  - .ai/standards/integrations.md
  - .ai/steward/context.md
  - .ai/board/tickets/EVT-04/ticket.yaml
  - .ai/board/tickets/EVT-04/01-plan.md
  - .claude/hooks/guard-allowed-paths.mjs
  - supabase/functions/.env  # variable names and comments only; values not read into any artifact
  - supabase/migrations/20260929120000_evt01_event.sql
  - supabase/migrations/20261008120000_evt04_notification.sql
  - supabase/migrations/20260910093000_solo_profile_self_update.sql
  - supabase/migrations/20260912120000_solo_member_email.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/routes/Profile.tsx
  - eslint.config.js
  - tsconfig.json
  - package.json
  - .gitignore
  - Dockerfile
  - CHANGELOG.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-05 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md` § EVT — Events without paraphrase:**

| ID | Title |
|----|-------|
| EVT-05 | A person is emailed when an event for their team is created, when they are invited, and when their request is decided |

The row's Notes column is the scope, each clause the operator's, decided by ADR-051 (`ACCEPTED by
the operator`, amending ADR-005 and ADR-045 decision 6): one server-side component exists to send
mail and authorizes nothing; email on a new event scoped to the recipient's own team, on being
invited by name, and on a join request approved, rejected or removed (Q1 *"đúng"*, narrowed by Q3
*"b"* — **not for public events**); not on edit, delete, join request or withdrawal; one switch turns
all event email off, in-app untouched (Q4 *"a"*); English, on a designed template (Q8 *"dùng tiếng
anh và có template đẹp."*).

**The row's blocker is answered.** The Notes column still reads *"BLOCKED ON THE OPERATOR AT PLAN: no
email provider, key holder or sending domain exists (Q6)"*. The idea file's § *Evidence* Q6 now
carries the operator's answers of 2026-10-08 and 2026-10-09: **Gmail over SMTP with an App Password**
(*"chọn cách B"*), **no sending domain**, account **`didi00889900@gmail.com`**, From
**`CaleChip <didi00889900@gmail.com>`**, credentials in the gitignored `supabase/functions/.env`.
ADR-051 decision 7 asked for provider, key and domain to exist; all three are answered. Who holds the
account is not stated; it changes no acceptance criterion and is recorded in ADR-053 § *Consequences*
instead of blocking. The mechanism ADR-051 decision 1 leaves to this stage is
[ADR-053](../../../registry/decisions/ADR-053-event-email-goes-over-gmail-smtp-from-an-edge-function-the-database-calls.md),
written here under `tech-lead-design`'s name (ADR-008); it records Q6 and reverses nothing.

**Who gains what.** `EVT-04` put a bell in the top bar, but a bell is only seen by someone who opens
the app. A member invited by name, a member whose request was decided, and a team whose colleague
announced something still find out only when they next sign in. This ticket sends those five moments
to the person's inbox, in English, on a page that looks like CaleChip — and gives every member one
switch on `/profile` to stop it. It is the product's first message that leaves the product.

**Out of scope.**

- **Email for public events** (Q3), and **email on edit, cancellation, a join request or a
  withdrawal** (Q1, ADR-051 decision 4). Those stay in-app only (`EVT-04`).
- **Reminders** before an event or a deadline — no scheduler (ADR-050 decision 6).
- **Per-kind email settings** (Q4) and **any setting for in-app notifications**.
- **One-click unsubscribe from the email.** A link that turns the switch off would make the function a
  writer of product data, which ADR-051 decision 3 forbids. The footer sends the reader to `/profile`.
- **Retry, queueing, delivery tracking or bounce handling.** A failed send is logged and dropped
  (ADR-053 decision 6).
- **Emailing a guest's manage link** — `EVT-07`'s Notes name it a later ticket on this one.
- **Email about entries** (PTO/WFH decisions), push, SMS, chat.
- **Any change to who receives an in-app notification.** This ticket reads `EVT-04`'s rows; it changes
  none of `EVT-04`'s triggers, its `notify` function or its policies.
- **Writing secrets, Vault entries, or deploying.** The two new environment variables, the two Vault
  secrets, `supabase secrets set`, `supabase functions deploy` and applying the migration are human
  (RULE-09). The Developer documents them in the migration header and `03-impl-log.md`.
- **`.ai/standards/tech-stack.md`** — ADR-051 § *Affected documents* assigns its runtime-and-provider
  line to this `/plan`, but that file's own last section says an agent stops rather than edits it.
  Owed to `/thuki`, with ADR-053 as the record meanwhile. **`.ai/standards/integrations.md`** and a
  `.ai/registry/boundaries.json` entry for ADR-053 revert condition 2 are owed to `/thuki` likewise.
- **`supabase/db.sql`** — MD-033, as for every `EVT-0x`.

**`size_estimate: M`** — one migration (a column, an RPC, one trigger function and its trigger), one
Edge Function in two files, two seam functions in both implementations, one card on `/profile`, two
tests, one ADR and two standards entries. Section 7 counts the verdict.

## 2. Acceptance criteria

Vocabulary, in addition to `EVT-04`'s (*approved member*, *takes part in*, *the actor*, *straight to
the datastore*):

- **An email kind** — one of the five notification kinds that may produce an email:
  `event_created`, `event_invited`, `attendance_approved`, `attendance_rejected`,
  `attendance_removed`.
- **Its notification** — the `public.notification` row `EVT-04` writes for the same recipient and the
  same write. An email exists only beside one.
- **The switch** — `profile-event-email` on `/profile`; **on** means the person receives event email.
- **The sender** — the Edge Function `send-event-email` (ADR-053).
- **The account address** — the address the person signs in with.

### Who is emailed, and for what

**AC-1 — a new event for my own team**
- Given an approved member creates an event whose scope is **own team**
- Then every other approved member of the creator's team whose switch is on receives one email for it
- And when the scope is **every team**, nobody receives an email for it — `EVT-04`'s in-app
  `event_created` rows are still written exactly as before
- And when the scope is **named people**, nobody receives an `event_created` email; the named receive
  AC-2's

**AC-2 — invited by name**
- Given a person is named on an event, at creation or added on an edit
- Then that person, if their switch is on, receives one email saying they were invited
- And they receive it exactly when `EVT-04` writes them an `event_invited` notification — so a person
  already named receives nothing new when the event is saved again, and the actor never does

**AC-3 — my request decided, or my place removed**
- Given a person's pending request is approved or rejected, or their attendance is removed
- Then that person, if their switch is on, receives one email saying which
- And they receive it exactly when `EVT-04` writes the matching notification — so a creator deciding
  their own request receives nothing, and a person who can no longer read the event receives nothing
  (`EVT-04` AC-8)

**AC-4 — nothing else is emailed**
- Given an event is edited or deleted, or a person requests to join or withdraws or cancels a request
- Then no email is sent to anybody, whatever their switch; the in-app notifications are unchanged

**AC-5 — an email only ever beside its notification**
- Given any write
- Then an email is sent to a person only for a notification of an email kind addressed to that person
  by that write
- And therefore never to someone who cannot read the event, never to the actor, never for a write
  made with no signed-in person, and never twice for one notification
- And an email is addressed to the recipient's account address, and to nobody else

**AC-6 — the switch turns all of it off, and only it**
- Given a person whose switch is off
- Then they receive no event email of any kind
- And their in-app notifications are written and shown exactly as when it is on
- And turning it back on affects only notifications written afterwards; nothing missed is sent

**AC-7 — on by default**
- Given any member who has never touched the switch — existing members when the migration is
  applied, and every member who signs up afterwards
- Then their switch is on

### What the email says

**AC-8 — subject, sender and recipient**
- Given an email for any email kind
- Then it is from `CaleChip <didi00889900@gmail.com>` (the configured sender), to the recipient's
  account address only, with the subject for its kind as § 4.4 fixes, in English

**AC-9 — the body**
- Given an email
- Then it greets the recipient by display name, states the kind's sentence (the `EVT-04` in-app
  sentence for that kind, § 4.4), and shows the event's name, its dates and — when it has one — its
  location
- And it carries a button, **Open the event**, linking to `/events/<event id>` on the application's
  address
- And its footer says why the person received it and that event email can be turned off on their
  Profile, linking to `/profile` on the application's address
- And it carries a plain-text alternative with the same sentence, name, dates, location and both
  addresses

**AC-10 — names are shown as written, and never as markup**
- Given an event name, a location, or a display name containing Vietnamese
  diacritics (`Buổi họp Đà Nẵng`, `Nguyễn Thị Ánh`)
- Then they appear in the subject and body with every diacritic intact
- And given one containing markup (`<b>x</b>`, `<script>`) — it appears as those literal characters
  and is never interpreted

**AC-11 — the dates**
- Given an event's start and end dates
- Then they read as one date on one day (`12 Oct 2026`), a range within a month (`12–14 Oct 2026`),
  across months (`30 Oct – 2 Nov 2026`), or across years (`30 Dec 2026 – 2 Jan 2027`)

### When it cannot be sent

**AC-12 — a failed or impossible send never touches the action**
- Given the sender is unreachable, refuses the message, is not deployed, or is not configured — no
  secret in Vault, no environment variable, `pg_net` absent
- When a person makes any write in AC-1 to AC-3
- Then that write succeeds exactly as it would with email working, and its in-app notifications are
  written
- And the email is not sent and is never retried

**AC-13 — the sender answers only the database**
- Given a request to the sender without the shared secret, or with a wrong one
- Then it is refused and nothing is sent
- And given a request with the secret whose body is not a well-formed email request (§ 4.3), it is
  refused and nothing is sent
- And no file under `src/` names the sender or calls it (ADR-051 decision 3)

### The switch

**AC-14 — reading and changing it on `/profile`**
- Given an approved member on `/profile`
- Then `profile-event-email` shows whether their event email is on
- When they change it and press `profile-save`
- Then it is saved, `profile-outcome` reports success, and on reload it shows the saved value
- And changing only the switch is a change: it does not answer *Nothing to save*
- And leaving the screen without pressing save saves nothing, as for every other field there

**AC-15 — only my own switch**
- Given any person, any role, admin included
- When they change another person's switch straight to the datastore — through the RPC or by writing
  the column
- Then nothing changes; writing the column directly is refused for everybody, their own row included
- And a removed member cannot change theirs

### What it does not touch

**AC-16 — nothing else changes**
- Given every write above
- Then no entry, absence count, overload state or calendar view changes; `listMembers()` returns the
  same people with the same fields; and the in-app notifications `EVT-04` writes are exactly those it
  wrote before this ticket

**Invariants touched: `[]`.** Considered, none reachable. INV-01, 02, 03, 05 and 06 constrain entries,
which nothing here creates, reads or changes. INV-04 depends on `member.removed_at` and INV-07 on
`member.team_id`; the new column is neither, the RPC writes only `event_email_enabled`, and no
`member` policy is created, dropped or replaced — the test reads the migration and asserts it.
`EVT-04`'s recipient rules, which carry ADR-045 decision 3, are read, not changed (AC-16).

**Open questions.** None. Every trigger, exclusion and the switch are operator answers (Q1, Q3, Q4) in
ADR-051; Q6 is answered; Q8's *"template đẹp"* is the layout below, which is this plan's own. Marked
decisions of this plan: the default-on switch (the idea's assumption 6, confirmed — AC-7); the switch
on `/profile` saved by the screen's one save button (AC-14); no retry (AC-12, ADR-053 decision 6); the
date formats (AC-11); the subjects (§ 4.4). Who holds the Gmail account changes nothing above and is
recorded in ADR-053.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

**The email** — one centred column 560 pixels wide on a soft lavender-grey page (`#F4F2FA`):

- **Header**: the word *CaleChip* in the primary colour, bold, rounded face, 20 pixels, left-aligned,
  above a white card.
- **The card**: white, 20-pixel corner radius, 32 pixels of padding, a thin `#ECE8F5` border. Inside,
  in order: `Hi {recipient},` in grey; the kind's sentence as the headline, 20 pixels bold, dark ink;
  then an **event panel** — a tinted rounded box whose tint is the kind's (peach-pink `#FDEDEF` for
  approved, mint `#E8F6EF` for created and invited, lavender `#EFEAFB` for rejected and removed),
  holding the event name bold, a 📅 line with the dates and, when there is one, a 📍 line with the
  location; then **Open the event**, a pill button in the primary colour with white bold text.
- **Footer**, outside the card, small grey text: *You got this email because you are on CaleChip.
  Event email can be turned off on your Profile.* — "Profile" is the link.
- Font stack `'Nunito', 'Baloo 2', 'Segoe UI', Arial, sans-serif`, linked from Google Fonts; most
  clients ignore the link and fall back, and every fallback renders Vietnamese diacritics. Never
  Quicksand (`CLAUDE.md` § *Visual direction*).
- Table-based layout with inline styles only — email clients drop `<style>` blocks and flex.
- No image, no mascot, no tracking pixel.

**The switch on `/profile`** — a new card, **Email**, placed between the display-name card and the
password card, in the same `CARD` style: the heading `Email`, then one row with a toggle on the right
(`role="switch"`, `aria-checked`) and on the left *Event email* in `text-sm` semibold above *Emails
when an event is announced for your team, when you are invited, and when your request is decided.*
in `text-sm` grey. Saved by the existing **Save changes**; nothing else on the screen moves.

## 3. Permission model

**Authorization stays in PostgreSQL** (ADR-005, ADR-051 decision 2). The sender authorizes nothing,
holds no database credential and reads nothing (ADR-053 decision 2); every recipient decision is made
by `EVT-04`'s triggers and this ticket's one trigger, both definer functions.

| Action | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|
| Read own switch | ✅ | ✅ | ✅ | `member_select_own` (TEA-01), unchanged |
| Change own switch | ✅ | ✅ | ✅ | `public.set_event_email(p_enabled)`, definer, writes `where id = auth.uid() and removed_at is null` |
| Change another person's switch | ❌ | ❌ | ❌ **by name** | the RPC takes no member id; no column grant exists |
| Write `event_email_enabled` with a plain update, own row included | ❌ | ❌ | ❌ | **no `update (event_email_enabled)` grant** — 42501 |
| Change it as a removed member | ❌ | ❌ | ❌ | `removed_at is null` in the RPC's `where` |
| Cause an email to someone | only through a write that writes them an email-kind notification | same | same | `email_notification` trigger, `after insert on notification` |
| Call the sender | ❌ | ❌ | ❌ | the shared secret, held in Vault and the function's environment only; no seam function names it |
| Read Vault or `auth.users` | ❌ | ❌ | ❌ | unchanged; the definer trigger reads both |

**Why the switch is an RPC and not a column grant.** `member_update_admin` already lets an admin
update any row of their team. A `grant update (event_email_enabled)` would therefore let an admin turn
off a colleague's email, and a policy cannot refuse it — a policy sees only the new row (`rbac-and-
security.md` known weakness 6, recorded in `20260910093000_solo_profile_self_update.sql`). The fence
there is a clause in `member_enforce_role_and_removal`, which would mean replacing that whole function
to add one line. A definer function that only ever writes the caller's own row, with no grant on the
column at all, closes it without touching the trigger. § 8 alternative 2.

**What a teammate can see.** `event_email_enabled` is readable by everyone who can read the member row
— the member themself, teammates (TEA-03) and cross-team readers (CAL-11). It is a preference, grants
nothing, and no screen shows anyone else's; withholding one column would mean revoking table-level
`select` on `member` and re-granting the rest, a change to every read in the product. Stated, accepted.

**The secret is the sender's only gate**, and the JWT check is off for it (ADR-053 § *Consequences*).
Whoever holds the secret can send any message the template can render to any address, from the
CaleChip account. It exists in exactly two places, neither in git, and AC-13 refuses a request without
it.

**Interface affordances, not controls:** the switch renders only on `/profile`, which only a signed-in
member inside the shell reaches.

**Where this cannot be verified today.** As for `EVT-01` to `EVT-04`, `tests/permission-model.test.ts`
against a real PostgreSQL is owed project-wide. The mock reproduces the RPC and the trigger's recipient
rule; the migration is asserted by reading the file; the template is a pure module tested directly.
The first real send is a human step (ADR-053, *TODO(verify)* on port 465).

## 4. Contract

### 4.1 Domain types — none change

`src/lib/domain/types.ts` is untouched. The switch is a `boolean`; the email request type lives with
the sender (§ 4.3), because nothing in `src/` may know it (AC-13).

### 4.2 Seam — `src/lib/data/index.ts`

```ts
  // -------------------------------------------------------------------------
  // EVT-05 — the event email switch. 01-plan.md section 4.2. ADR-051, ADR-053.
  //
  // Two functions. NOTHING IN THE SEAM SENDS, QUEUES OR NAMES AN EMAIL: the database hands email-kind
  // notifications to the sender from a trigger (`supabase/migrations/20261009090000_evt05_event_email.sql`),
  // and ADR-051 decision 3 forbids the browser calling it.
  // -------------------------------------------------------------------------

  /** EVT-05 AC-14. Whether the caller receives event email. Null when nobody is signed in or the
   *  caller has no member row — a normal answer, as `getCurrentMember` gives. Throws on a read
   *  failure, as the other reads do. */
  getEventEmailEnabled(): Promise<boolean | null>;

  /** EVT-05 AC-14, AC-15. Sets the caller's own switch and returns the saved value. No member id
   *  parameter, and there must never be one. No row written (no member row, or removed): fails with
   *  `unknown` and the sentence "Your email setting could not be saved." */
  setEventEmailEnabled(enabled: boolean): Promise<Result<boolean>>;
```

Failure sentences are English, repeated verbatim in both implementations; network failures map to the
existing `network`. No new `FailureCode`.

- **`supabase.ts`**: read — `from("member").select("event_email_enabled").eq("id", <session user
  id>).maybeSingle()`, null data → `null`; write — `rpc("set_event_email", { p_enabled: enabled })`,
  a `null` result → the failure above.
- **`mock.ts`**: a `Map<string, boolean>` of switches, absent meaning `true` (AC-7), keyed by member
  id; the setter refuses a caller with no member row or with `removedAt` set. Reset by the existing
  `__resetEvents()`.
- **The mock reproduces the trigger** (§ 4.3, `email_notification`): in its existing `notify` helper,
  after a notification is pushed, when its kind is an email kind, and — for `event_created` — the
  event's scope is `"team"`, and the recipient's switch is on, and the recipient has an `email`, it
  appends `{ notificationId, kind, to, eventId }` to an in-memory outbox. Exported for tests only,
  beside `__resetEvents`, **not on the seam object**:

```ts
export interface MockEventEmail {
  notificationId: string;
  kind: "event_created" | "event_invited" | "attendance_approved" | "attendance_rejected" | "attendance_removed";
  to: string;
  eventId: string;
}
/** EVT-05. The emails the database would have handed the sender since the last `__resetEvents()`. */
export function __sentEventEmails(): MockEventEmail[];
```

`to` in the mock is `Member.email`; the database uses `auth.users.email` (§ 4.3), which the mock does
not have. The difference is recorded in the mock's comment.

### 4.3 Database — `supabase/migrations/20261009090000_evt05_event_email.sql`

Names fixed by this plan (RULE-04). The Developer writes the SQL; these are its shapes.

```sql
-- 1. The extension. pg_net creates its own `net` schema. TODO(verify) against the hosted project.
create extension if not exists pg_net;

-- 2. The switch (AC-7: default true covers every existing row and every future admission).
alter table public.member
  add column if not exists event_email_enabled boolean not null default true;
-- NO update grant on this column, to anybody. Written only by set_event_email.

-- 3. The only writer (AC-14, AC-15).
create or replace function public.set_event_email(p_enabled boolean) returns boolean
  language sql volatile security definer set search_path = '' as $$
  update public.member
     set event_email_enabled = p_enabled
   where id = (select auth.uid())
     and removed_at is null
  returning event_email_enabled;
$$;
-- revoke execute from public, anon; grant execute to authenticated.

-- 4. The hand-off (AC-1 to AC-6, AC-12).
create or replace function public.email_notification() returns trigger
  language plpgsql volatile security definer set search_path = '' as $$ … $$;

create trigger email_notification
  after insert on public.notification
  for each row
  when (new.kind in ('event_created', 'event_invited',
                     'attendance_approved', 'attendance_rejected', 'attendance_removed'))
  execute function public.email_notification();
```

**`email_notification()`**, in order, the whole body inside one `begin … exception when others then
raise warning 'event email not queued for notification %: %', new.id, sqlerrm; end;` block, and
`return new` always (AC-12):

1. Read `decrypted_secret` from `vault.decrypted_secrets` for the names **`event_email_function_url`**
   and **`event_email_hook_secret`**. Either missing → return, nothing sent.
2. Build the request body (below) from `new`, joined to the recipient's `public.member` row
   (`r.id = new.recipient_id`), the recipient's **`auth.users.email`** (`u.id = new.recipient_id`),
   the event (`e.id = new.event_id`), and the actor's `public.member` row (`a.id = new.actor_id`),
   **where** `r.event_email_enabled` **and** `u.email is not null` **and** (`new.kind <>
   'event_created'` **or** `e.scope = 'team'`). No row → return, nothing sent.
3. `perform net.http_post(url := <url>, body := <body>, headers := jsonb_build_object('Content-Type',
   'application/json', 'x-event-email-secret', <secret>))`. TODO(verify) the parameter names against
   the installed `pg_net`. The queued request is a row in `pg_net`'s own table, so a write that rolls
   back takes its email with it — TODO(verify).

No recipient rule beyond step 2's: who receives the notification is `EVT-04`'s, unchanged (AC-5).

**The request body** — camelCase JSON, built with `jsonb_build_object`; the sender's parser (§ 4.5)
accepts exactly this:

```json
{
  "notificationId": "<new.id>",
  "kind": "<new.kind>",
  "to": "<u.email>",
  "recipientName": "<r.display_name>",
  "actorName": "<a.display_name>",
  "event": {
    "id": "<e.id>",
    "name": "<e.name>",
    "startDate": "<e.start_date, YYYY-MM-DD>",
    "endDate": "<e.end_date, YYYY-MM-DD>",
    "location": "<e.location, or null>"
  }
}
```

**Grants:** `revoke execute … from public, anon` on both functions; `grant execute … to authenticated`
on both — on the trigger function as `EVT-04` does for its seven; it cannot be called through
PostgREST, since it returns `trigger`.

**The header** says it has not been run against PostgreSQL and lists the human steps, in order:
apply; add `APP_URL` and `EMAIL_HOOK_SECRET` to `supabase/functions/.env`; `supabase secrets set
--env-file supabase/functions/.env`; `supabase functions deploy send-event-email --no-verify-jwt`;
`select vault.create_secret('<function url>', 'event_email_function_url');` and
`select vault.create_secret('<same secret as EMAIL_HOOK_SECRET>', 'event_email_hook_secret');`; one
real send to confirm port 465.

### 4.4 The words — `supabase/functions/send-event-email/template.ts`

| Kind | Subject | Headline (the `EVT-04` sentence) |
|---|---|---|
| `event_created` | `{actor} announced {event}` | `{actor} announced {event}.` |
| `event_invited` | `{actor} invited you to {event}` | `{actor} invited you to {event}.` |
| `attendance_approved` | `Your request to join {event} was approved` | `Your request to join {event} was approved.` |
| `attendance_rejected` | `Your request to join {event} was declined` | `Your request to join {event} was declined.` |
| `attendance_removed` | `You were removed from {event}` | `You were removed from {event}.` |

Greeting `Hi {recipientName},`. Button `Open the event`. Footer `You got this email because you are on
CaleChip. Event email can be turned off on your Profile.` Plain text: the greeting, the headline, the
event name, the dates, the location line when present, `Open the event: {appUrl}/events/{id}`, and
`Turn event email off: {appUrl}/profile`.

### 4.5 The sender — `supabase/functions/send-event-email/`

**`template.ts` — imports nothing**, so both Deno and Vitest load it. Exactly these exports:

```ts
/** EVT-05. The five notification kinds that may produce an email (ADR-051 decision 4). */
export type EventEmailKind =
  | "event_created"
  | "event_invited"
  | "attendance_approved"
  | "attendance_rejected"
  | "attendance_removed";

/** EVT-05 § 4.3. The body `email_notification()` posts. */
export interface EventEmailRequest {
  notificationId: string;
  kind: EventEmailKind;
  to: string;
  recipientName: string;
  actorName: string;
  event: {
    id: string;
    name: string;
    startDate: string; // YYYY-MM-DD
    endDate: string; // YYYY-MM-DD
    location: string | null;
  };
}

export interface RenderedEmail {
  subject: string;
  html: string;
  text: string;
}

/** AC-13. The request, or null when `input` is not exactly that shape — every string non-empty
 *  except `location`, which is a string or null; `kind` one of the five; both dates YYYY-MM-DD with
 *  `endDate >= startDate`. */
export function parseEventEmailRequest(input: unknown): EventEmailRequest | null;

/** AC-11. `12 Oct 2026`, `12–14 Oct 2026`, `30 Oct – 2 Nov 2026`, `30 Dec 2026 – 2 Jan 2027`.
 *  English month abbreviations; an en dash, unspaced within a month, spaced across months. */
export function formatEventDates(startDate: string, endDate: string): string;

/** AC-8 to AC-11. `appUrl` has no trailing slash (the caller strips one). Every interpolated value is
 *  HTML-escaped in `html` (`& < > " '`) and left as written in `subject` and `text`. */
export function renderEventEmail(request: EventEmailRequest, appUrl: string): RenderedEmail;
```

**`index.ts`** — the Deno entry point; imports `./template.ts` and `npm:nodemailer@<major>`, the major
pinned in the specifier after the Developer reads the package's current release (TODO(verify): the
major, and that its `createTransport` with `secure: true` on 465 runs under Supabase's Edge Runtime).

- **Environment**, every one required: `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`,
  `MAIL_FROM` (the five already in `supabase/functions/.env`, names kept), `APP_URL`,
  `EMAIL_HOOK_SECRET`.
- `Deno.serve`, answering JSON `{ "sent": boolean, "notificationId"?: string, "error"?: string }`:

| Condition | Status | Sends |
|---|---|---|
| method is not `POST` | 405 | no |
| `x-event-email-secret` missing, or not equal to `EMAIL_HOOK_SECRET` (compared in constant time) | 401 | no |
| any environment variable missing | 500 | no |
| `parseEventEmailRequest` returns null | 400 | no |
| SMTP refuses or fails | 502, `console.error` naming the notification id, the kind and the error message — **never the password, the secret, the address or the body** | no |
| sent | 200 | one message: `from` `MAIL_FROM`, `to` the request's `to` only, `subject`, `html`, `text` from `renderEventEmail` |

The secret check comes before the environment and body checks, so an unauthenticated caller learns
nothing about the configuration.

### 4.6 The switch on `/profile` — `src/routes/Profile.tsx`

| Id | Where | AC |
|---|---|---|
| `profile-event-email` | the toggle button in the new **Email** card, `role="switch"`, `aria-checked`, `aria-label="Event email"`; carries `data-enabled="true"|"false"` | AC-14 |

- Loaded by the screen's existing `load()`, beside `getSession()` and `getTeam()`, with its own
  `catch`; until it answers, or when it answers null, the toggle is disabled.
- Pressing it changes form state only. **`onSubmit`** treats a switch differing from the loaded value
  as a change (so *Nothing to save* no longer answers it, AC-14), and calls `setEventEmailEnabled`
  after `updateOwnProfile` when the profile changed, before the password change, each as the screen
  already sequences its writes. A failure goes to `profile-outcome` as the others do; on success the
  loaded value becomes the saved one.
- The header comment gains one paragraph naming `EVT-05`, this plan's § 2b as the card's authority,
  and that the switch is saved by the one save button for the header's own reason 1.

## 5. Seam impact

**Two functions added:** `getEventEmailEnabled`, `setEventEmailEnabled` — in `index.ts`,
`supabase.ts` and `mock.ts`, same name and arity; `tests/seam-parity.test.ts` checks it without edit.
**No existing function changes signature.** The mock's private `notify` helper gains the outbox
append; no contract changes. `__sentEventEmails` and `MockEventEmail` are mock-only exports, not seam
members.

**Invariants — how each is held (R8).** None touched (§ 2). The test reads the migration and asserts:
it contains no `create policy`, `drop policy` or `alter policy` on `public.member`; no `grant update`
naming `event_email_enabled`; no change to any `EVT-04` function name (`notify`, `may_read_event`,
`notify_*`, `mark_notifications_read`); and `listMembers()` returns the same rows before and after a
switch change and a fan-out (AC-16).

**Tests — `tests/event-email.test.ts`**, against the mock and the pure template, one `describe` per AC
group: AC-1's three scopes; AC-2 and AC-3 by kind, including the creator-decides-own and the
cannot-read cases; AC-4's four non-email writes; AC-5's one-email-per-notification and actor cases;
AC-6 and AC-7; AC-8 to AC-11 through `renderEventEmail` and `formatEventDates` (all five kinds,
diacritics, markup escaping, all four date shapes); `parseEventEmailRequest` refusing each malformed
field (AC-13); AC-15 through the mock setter; the migration-reading assertions above, plus that the
trigger's `when` lists exactly the five kinds, that the body checks `event_email_enabled` and
`e.scope = 'team'`, and that the function body has the `exception when others` handler (AC-12); and
that no file under `src/` contains `send-event-email` (AC-13). **`tests/e2e/evt-05-event-email.spec.ts`**
drives AC-14 on `/profile` through the mock: on by default, switch off, save, outcome, reload, still
off; switch-only change is saved, not *Nothing to save*.

## 6. Schema delta

**One extension, one column, one RPC, one trigger function and one trigger on `public.notification`,
and their grants** — § 4.3. Not `none`: a trigger and a definer function (ADR-014).

**ADRs:** [ADR-051](../../../registry/decisions/ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md),
`ACCEPTED by the operator` — the component and its fence; [ADR-053](../../../registry/decisions/ADR-053-event-email-goes-over-gmail-smtp-from-an-edge-function-the-database-calls.md),
`ACCEPTED by tech-lead-design` — the mechanism, the provider as the operator chose it, and the
`nodemailer` dependency (R9). `ticket.yaml`'s `requires_adr: true` cites both.

**No existing policy, trigger or function is replaced.** `EVT-04`'s `notify` and seven triggers, every
`member` policy and `member_enforce_role_and_removal` are untouched. The new trigger is `after insert`
on a table only definer functions insert into, so it runs only on a notification that was written; its
own failure is swallowed (AC-12).

**Applying it, setting the secrets and deploying are human** (RULE-09). Idempotent in ADR-024's shape
— `create extension if not exists`, `add column if not exists`, `create or replace` for functions,
`drop trigger if exists` then `create` — one transaction. `supabase/db.sql` is not updated (MD-033).

**Standards written by this ticket:** the `event_email_enabled` column in `.ai/standards/data-model.md`
under `member`, and in `.ai/standards/rbac-and-security.md` § *The permission table* the § 3 rows for
the switch. Nothing else in either file changes. `tech-stack.md` is owed to `/thuki` (§ 1).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-053-event-email-goes-over-gmail-smtp-from-an-edge-function-the-database-calls.md"
  - ".ai/standards/data-model.md"
  - ".ai/standards/rbac-and-security.md"
  - "supabase/migrations/20261009090000_evt05_event_email.sql"
  - "supabase/functions/send-event-email/index.ts"
  - "supabase/functions/send-event-email/template.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/routes/Profile.tsx"
  - "tests/event-email.test.ts"
  - "tests/e2e/evt-05-event-email.spec.ts"
```

**Glossary:** `glossary_owed` is `[]`; no row written.

**ADR-053 was written at this stage** and is on the list so it ships with the ticket; the Developer
does not edit it.

**Twelve paths: `size: M`, agreeing with `size_estimate: M` — at the ceiling.** A thirteenth makes this
`L`, which must split; the Developer stops and says so rather than adding one. **Deliberately absent:**
`src/lib/domain/types.ts` (no shared type changes, § 4.1); `src/components/NotificationBell.tsx` and
`tests/notifications.test.ts` (in-app is unchanged — if a notifications test fails, the mock's `notify`
changed behaviour, and the Developer stops); `tests/e2e/solo-profile.spec.ts` (the new card adds
nothing it asserts against — if it fails, the Developer stops); `supabase/functions/.env` (secrets are
human); `.ai/standards/tech-stack.md`, `integrations.md`, `.ai/registry/boundaries.json` (owed to
`/thuki`, § 1); `supabase/db.sql` (MD-033); `eslint.config.js` and `tsconfig.json` —
`typescript-eslint`'s recommended set already lints `supabase/**/*.ts` without `no-undef`, and `tsc`
reaches `template.ts` only through the test's import, which is why `template.ts` imports nothing. If
`pnpm lint` or `pnpm typecheck` fails on `index.ts` anyway, the Developer stops and reports it rather
than widening either config.

## 8. Rejected alternatives

**1. The sender reads the notification itself with the service-role key, given only its id.** Smaller
blast radius for a leaked hook secret — re-sending real mail rather than writing arbitrary mail — and
no address in `pg_net`'s queue table. Rejected (ADR-053 § *Rationale*): it puts the key that bypasses
every policy into the component ADR-051 says authorizes nothing, and makes its query a second place
recipients could be decided. A sender that cannot read the database cannot break ADR-051 decision 2.

**2. `grant update (event_email_enabled)` plus a clause in `member_enforce_role_and_removal`**, the
pattern `display_name` and `avatar` use. Familiar, and the seam would be one more column in an update.
Rejected: the grant alone lets an admin change a colleague's switch through `member_update_admin`, and
the fence means `create or replace` of a trigger function carrying six other clauses — `20260910093000`
records that a replace that drops one removes a control silently. A definer RPC with no grant writes
one column on one row and touches nothing else.

**3. A separate trigger per source table — on `event`, `event_invitee` and `event_attendance` — that
both writes nothing in-app and posts the email.** It would not depend on `EVT-04`'s table. Rejected: it
would re-derive every recipient rule `EVT-04` already holds, including ADR-045 decision 3 through
`may_read_event`, so the two channels could disagree about who may hear of an event. Hanging the email
off the notification row makes AC-5 true by construction.

**4. The switch saves the moment it is pressed**, as most settings toggles do. Rejected for this
screen: `Profile.tsx`'s header decides one form and one save button, and its reason 1 — the password
card's *leave all three empty* sentence only works if save submits the page — would leave one control
on the page that behaves differently from every other.

## Changelog

- `2026-10-09T08:50:35+0700` — written. The feature row's *blocked on the operator* clause is stale:
  idea Q6 was answered on 2026-10-08 and 2026-10-09 (§ 1). `features.md` is ship-owned, so the row's
  Notes are left for `/ship` to bring level. Raised by `tech-lead-design`.
