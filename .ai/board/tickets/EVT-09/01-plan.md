---
ticket: EVT-09
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-12T22:26:48+0700
inputs_read:
  - .ai/board/tickets/EVT-09/ticket.yaml
  - .ai/board/ideas/2026-10-12-a-person-outside-the-product-learns-of-a-public-event-only-by-a-forwarded-link.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-055-an-entered-address-is-mailed-an-invitation-to-a-public-event.md
  - .ai/templates/plan.md
  - .ai/01-operating-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/steward/context.md
  - .ai/board/tickets/EVT-08/01-plan.md
  - src/routes/EventEditor.tsx
  - src/routes/EventDetail.tsx
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - tests/event-invitation.test.ts
  - tests/e2e/evt-08-event-invitation.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-09 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md` § EVT without paraphrase:**

| ID | Title |
|----|-------|
| EVT-09 | A creator enters email addresses to invite while creating a public event |

The row's Notes are the scope: *"the create-event form gains the same email field `EVT-08` puts on
the detail page, shown only when the scope is public (Q2-A, Q3-B "Lúc tạo"); every rule of `EVT-08`
applies unchanged — it adds a surface, not a behaviour."* Decided by ADR-055 decision 1 (*"while
creating the event and afterwards from its detail page"*), `ACCEPTED by the operator` (F1).

**Who gains what.** Since `EVT-08` a creator can invite addresses to a public event, but only once
the event exists: create it, land on its page, find the panel, paste again. The operator asked for
it at the moment of creation (*"Khi tạo event public cho phép user nhập email cụ thể…"*). This
ticket puts the field on the create form, so a member who creates a public event types the
addresses with the name and the dates, presses *Create event* once, and lands on the event's page
with the invitations already sent and the guest link already open. Everything about what an
invitation is — who may send one, which mail goes to whom, once per address, the membership
blindness — is `EVT-08`'s and is reached through its one seam function, unchanged.

**Out of scope.**

- **Any change to what an invitation does** — dedupe, the two mails, the opening of the guest link,
  the invited list, who may read it. All `EVT-08`'s; this ticket calls `inviteToEvent` as it is.
- **The field on the edit form.** Inviting after creation is the detail page's panel (`EVT-08`); the
  edit form at `/events/:id/edit` shows no invite field, for any scope.
- **The field for team-scope or named-people events** (Q2-A). Hidden while those scopes are chosen,
  and whatever it holds is not sent.
- **Creating the event and its invitations in one transaction.** Two seam calls, in order; § 8
  alternative 1 says why, and AC-6 says what the creator sees when the second one fails.
- **Inviting the well-formed addresses and dropping the malformed ones** — `EVT-08` § 8
  alternative 4, kept: one malformed address stops the whole form (AC-4).
- **A cap, unsubscribe, re-sending, mail on edit/delete/close/scope change** — ADR-055 decision 9,
  as `EVT-08`.
- **Any schema, seam, policy, Edge Function or template change.**
- **`.ai/standards/rbac-and-security.md`.** Its `EVT-08` rows name the action, not the surface, and
  hold for this one unchanged.

**`size_estimate: S`** — one form gains a conditional field and a two-step save, one detail-page
panel gains an optional starting state, and their tests. No schema, no seam, no registry row.

## 2. Acceptance criteria

Vocabulary as `EVT-01`'s and `EVT-08`'s (*email invitation*, *invited* / *already invited*, *a
member's address*, *open to guests*, *straight to the datastore*). Additionally:

- **The create form** — `event-form` at `/events/new`. **The edit form** — `event-form` at
  `/events/:id/edit`.
- **The invite field** — the create form's `event-form-invite-input`.

### The field

**AC-1 — shown only while the scope is public, on the create form only**
- Given the create form
- When *Every team* (`event-scope-public`) is chosen
- Then `event-form-invite` is drawn, holding `event-form-invite-input` (a multi-line field)
- And while *Own team* or *Named people* is chosen, `event-form-invite` is not drawn
- And the edit form never draws `event-form-invite`, whatever the event's scope

**AC-2 — creating with no addresses is `EVT-01`'s creation, unchanged**
- Given the create form with the invite field empty or holding only spaces and separators, or with
  a scope other than public chosen whatever the field held before
- When the creator presses `event-save`
- Then the event is created exactly as before this ticket, no invitation call is made, nothing is
  handed to the sender, and the creator lands on the event's page with no `event-invite-result`

### Creating with addresses

**AC-3 — the event is created, then each address invited**
- Given the create form, public scope, and one or more well-formed addresses in the invite field —
  separated by commas, semicolons, spaces or new lines, as `EVT-08` AC-1
- When the creator presses `event-save`
- Then the event is created first, and then every address is invited to it exactly as `EVT-08`
  AC-1, AC-6–AC-9 and AC-11 describe, with the creator as the inviter
- And the creator lands on the event's page (`event-detail`), where `event-guest-panel` shows the
  open guest link (`EVT-08` AC-5), `event-invite-result` lists each distinct address once under
  *Invited* (`event-invite-sent`), and each appears in `event-invited-list`
- And an address typed twice in the field, in any letter case, is invited once and listed once
- And the result is the same, field for field, whether any address belongs to a member (`EVT-08`
  AC-7) — this surface adds no response, error or count the panel does not already have

**AC-4 — a malformed address creates nothing**
- Given the create form, public scope, and an invite field in which any address, trimmed, is longer
  than 254 characters or not of the shape *something@something.something* with no spaces
- When the creator presses `event-save`
- Then **no event is created**, nothing is invited and nothing is handed to the sender
- And `event-form-invite-error` says *Each address must look like name@example.com, in 254
  characters or fewer.*, followed by the addresses that do not
- And the form keeps every value typed, the invite field included
- *`EVT-08` AC-10's check and sentence, made before the event exists so that a typo never leaves a
  half-done event behind.*

**AC-5 — every other refusal is the form's, as before**
- Given the create form with well-formed addresses and a refusal from `createEvent` — an empty
  name, reversed dates, a bad capacity or deadline (`EVT-01` AC-2, AC-3; `EVT-02` AC-2)
- When the creator presses `event-save`
- Then `event-form-error` shows the seam's sentence as before, no event exists, nothing is
  invited, and the invite field keeps what was typed

**AC-6 — the event is created but the invitations fail**
- Given the event was created and the invitation call then returned a refusal or failed
- Then the creator still lands on the new event's page — the form is never shown again for an event
  that exists, so a second press cannot create a second event
- And there `event-invite-error` reads *The event was created, but the invitations were not sent.*
  followed by the refusal's sentence, and `event-invite-input` holds the addresses that were typed,
  so pressing `event-invite-submit` sends them as `EVT-08` AC-1
- And `event-invite-result` is not drawn

**AC-7 — one press, one event**
- Given the create form
- When the creator presses `event-save`
- Then `event-save` is disabled and reads *Saving…* until the event has been created **and** the
  invitations answered, or a refusal is shown
- And the event is created at most once per press

### What it does not touch

**AC-8 — the rest of the product is as it was**
- Given any event created through the create form, with or without addresses
- Then the event, its attendees, its guests, its notifications and `EVT-05`'s mail for it are what
  `EVT-01`, `EVT-02` and `EVT-05` give it — the invite field adds only what `inviteToEvent` adds
- And the detail page reached any other way — the events list, a reload, a link — shows the panel
  exactly as `EVT-08` AC-1 and AC-12, with no `event-invite-result` and no `event-invite-error`
  until a send

**Invariants touched: `[]`.** Nothing new reads or writes an entry, a member or a count; the
invitation is `EVT-08`'s, which answered `[]` for the same reasons (`EVT-08` 01-plan.md § 2). The
create form's own save is `EVT-01`'s, unchanged. INV-01–INV-07 constrain entries and the absence
count, which nothing here touches.

**Open questions.** None that block. This plan's own decisions, each cheap to reverse: a malformed
address stops creation rather than creating the event and reporting the address (AC-4); a failed
invitation after a created event goes to the detail page with the addresses ready to resend rather
than back to the form (AC-6); the field lives on the create form only, not the edit form (AC-1) —
Q3-B said *"Lúc tạo"*, and *"về sau"* is the detail page's.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No image is in `.ai/board/tickets/EVT-09/design/` (the folder does not exist) or cited by the idea
file. Nothing below is a behaviour beyond § 2.

**The create form.** `event-form-invite` sits **directly under the *Who is it for?* fieldset, in the
slot `event-picker` takes for *Named people*** — the two never show together, and each is the
follow-up question to the scope just chosen. Location, description and the buttons stay below it,
in `EVT-01`'s order.

- A label in the form's `LABEL` style: **Invite by email (optional)**. Under it one
  `text-[11px] text-ink-3` line: *Each address gets one invitation with the guest link. Creating
  opens this event to guests.* — drawn only while the field holds an address, so an untouched form
  does not announce a side effect it will not have. While empty, the line reads *People outside
  CaleChip get the guest link by email.*
- `event-form-invite-input`: a `textarea`, 3 rows, the form's `FIELD` style, placeholder
  *name@example.com, another@example.com*, `aria-label` *Email addresses*.
- `event-form-invite-error` (role `alert`, `text-danger`) under the field, the sentence and then the
  malformed addresses in `font-semibold`, `break-all` — `EVT-08`'s panel, in the form's type.
- The save button reads *Create event* whether or not addresses are entered.

**The detail page** is `EVT-08`'s, unchanged in layout. Arriving from the form, the panel opens
already holding the result of the send (*Invited* pills) or the error and the addresses (AC-6).

English copy throughout (F2-A).

## 3. Permission model

Nothing new. The create form is reached only by `membership.state === "member"` (`src/App.tsx`
route guard, an affordance); `createEvent`'s policies are `EVT-01`'s; the caller who just created the
event is its creator, so `invite_to_event`'s `may_manage_event` admits them and its `scope =
'public'` check holds the scope (`EVT-08` § 3). Every check below lives on the server; the form's
are affordances.

| Action | signed out | `member` | `manager` | `admin` | Held by |
|---|---|---|---|---|---|
| Reach the create form | ❌ | ✅ | ✅ | ✅ | route guard (affordance); `EVT-01` |
| Create the event | ❌ | ✅ | ✅ | ✅ | `EVT-01` policies, unchanged |
| Invite addresses to the event just created, if public | ❌ | ✅ own (they are its creator) | ✅ own — **nothing more** | ✅ | `invite_to_event` — `EVT-08` § 3, unchanged |
| Invite while creating a team or named event | ❌ | ❌ | ❌ | ❌ | the form sends nothing; `invite_to_event` → EV009 regardless |
| Learn from the form or the landing page whether an address is a member's | ❌ | ❌ | ❌ | ❌ | the form shows only `inviteToEvent`'s outcomes, which carry no such thing (`EVT-08` AC-7) |

**Denials the tests must assert:** a team or named creation with text left in the (hidden) field
makes no `inviteToEvent` call and hands nothing to the sender (AC-2); a malformed address makes no
`createEvent` call (AC-4); a member's address and an outsider's give the same landing result (AC-3).

## 4. Contract

**No domain type, no seam function, no `FailureCode`, no SQL changes.** Every name below is new and
lives in the two route files.

### 4.1 `src/routes/EventDetail.tsx` — the handoff and the panel's starting state

Appended beside `parseInvitationInput`, exported:

```ts
/** EVT-09 § 4. What the create form hands the event page through the router's location state,
 *  after inviting at creation. `invited`: `inviteToEvent`'s outcomes, unchanged. `failed`: the event
 *  exists, the invitation call did not succeed (AC-6). */
export type InviteHandoff =
  | { kind: "invited"; outcomes: EmailInvitationOutcome[] }
  | { kind: "failed"; message: string; emails: string[] };

/** EVT-09 AC-3, AC-6, AC-8. `location.state` read as an InviteHandoff, or null unless it is exactly
 *  one of the two shapes. History state is untyped input; anything else is null. */
export function readInviteHandoff(state: unknown): InviteHandoff | null;
```

`EventDetail` reads `readInviteHandoff(useLocation().state)` once and passes it to
`EventInvitePanel` as a new prop `handoff: InviteHandoff | null`, which seeds the panel's existing
state at mount:

- `invited` → `result = outcomes`.
- `failed` → `error = INVITE_NOT_SENT + " " + message`, `text = emails.join(", ")`.
- null → today's starting state.

```ts
const INVITE_NOT_SENT = "The event was created, but the invitations were not sent.";
```

No other behaviour of the panel changes; a later send replaces the seeded result or error as today.

### 4.2 `src/routes/EventEditor.tsx` — the field and the two-step save

`FormValues` gains `inviteText: string`, `""` initially, on the create form only.

Exported, so the order and the failure handling are unit-testable without a browser:

```ts
/** EVT-09 AC-2..AC-6. Validates the addresses, creates the event, then invites. Never invites
 *  before the event exists and never creates when an address is malformed.
 *  - `scope !== "public"` or no address after parsing → `createEvent` only; `handoff: null`.
 *  - any malformed address → `{ ok: false, malformed }`, and neither call is made.
 *  - `createEvent` refused → `{ ok: false, error }`, and `inviteToEvent` is not called.
 *  - created, invite refused or thrown → `{ ok: true, id, handoff: { kind: "failed", … } }`.
 *  - created and invited → `{ ok: true, id, handoff: { kind: "invited", outcomes } }`. */
export async function createEventWithInvitations(
  data: Pick<DataSeam, "createEvent" | "inviteToEvent">,
  input: SaveEventInput,
  inviteText: string,
): Promise<
  | { ok: true; id: string; handoff: InviteHandoff | null }
  | { ok: false; error: Failure }
  | { ok: false; malformed: string[] }
>;
```

`DataSeam` and `SaveEventInput` are imported from `@/lib/data`, `Failure` from
`@/lib/domain/types`. It parses with `parseInvitationInput` and checks with `invalidInvitationEmails`, imported from
`./EventDetail` — **reused, not copied**. The malformed sentence is `EVT-08`'s
`invalid_invitation_email` message, verbatim (AC-4).

`EventForm.onSubmit`, on the create form: the existing date check, then
`createEventWithInvitations(seam, input, values.inviteText)`; `malformed` → `event-form-invite-error`;
`error` → `event-form-error`; ok → `onSaved(id, handoff)`. The edit form's path is unchanged.
`onSaved` becomes `(eventId: string, handoff?: InviteHandoff | null) => void`, and `EventEditor`
calls `navigate(\`/events/${savedId}\`, handoff ? { state: handoff } : undefined)`.

### 4.3 Selectors

| Selector | Where | AC |
|---|---|---|
| `event-form-invite` | create form, public scope only | AC-1 |
| `event-form-invite-input` | inside it | AC-1, AC-3, AC-4 |
| `event-form-invite-error` | inside it, after a malformed address | AC-4 |

`EVT-01`'s `event-form`, `event-save`, `event-form-error`, `event-scope-*` and `EVT-08`'s
`event-invite-*`, `event-invited-*` and `EVT-06`'s `event-guest-panel` are unchanged and asserted.

## 5. Seam impact

None. `createEvent` and `inviteToEvent` are called as they are, from the interface, through `seam`
(RULE-02). `createEventWithInvitations` takes a `Pick<DataSeam, …>` so the unit test can hand it a
stub; it is not a seam member and adds nothing to parity.

## 6. Schema delta

`none`. Agrees with `ticket.yaml`. `requires_adr: true` is met by ADR-055 (`ACCEPTED by the
operator`), which decides this surface in decision 1; this ticket needs no ADR of its own.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/routes/EventEditor.tsx"
  - "src/routes/EventDetail.tsx"
  - "tests/event-create-invitation.test.ts"
  - "tests/e2e/evt-09-create-invitation.spec.ts"
```

**Glossary:** `glossary_owed: []` — *Email invitation* already has its row (`EVT-08`) and is not
rewritten.

**Deliberately absent:** `src/lib/data/**` and `src/lib/domain/types.ts` (no seam or type change —
if one is needed, the contract is wrong and the Developer stops); `tests/event-invitation.test.ts`
and `tests/e2e/evt-08-event-invitation.spec.ts` (`EVT-08`'s behaviour is unchanged and they must pass
untouched); `tests/e2e/evt-01-events.spec.ts` (the create form without addresses is unchanged —
AC-2 is asserted in the new spec); `.ai/standards/rbac-and-security.md` (§ 1).

**`size: S`** — four paths. Agrees with `size_estimate: S`.

## 8. Rejected alternatives

**1. One definer function that creates the event and invites in one transaction.** No half-done
state: either the event and its invitations exist or neither does, and AC-6 disappears. Rejected: it
is a schema change and a new seam function for a failure that only a network drop between two calls
can produce, and it would put a second copy of `EVT-01`'s insert rules and `EVT-08`'s invite rules in
one function, both to keep in step. The feature row says this ticket *"adds a surface, not a
behaviour"*. AC-4 removes the only foreseeable cause — a malformed address — before anything is
written, and AC-6 lands the rare remainder on the page that can retry it.

**2. On an invitation failure, stay on the form and show the error.** The creator sees the problem
where they typed. Rejected: the event already exists, so a second press of *Create event* creates a
second one; the detail page is the only place that can retry against the event that was made.

**3. Validate nothing on the form and let `inviteToEvent` refuse.** Less code; the seam already
refuses malformed input. Rejected: by then the event exists, so every typo becomes AC-6's
"created but not sent" — the half-done state, made routine.

**4. Show the result on the form, then navigate.** Rejected: an extra screen state for a result the
detail page's panel already knows how to draw, and the creator would leave the form only to see the
same list again.

## Changelog

- 2026-10-12T22:26:48+0700 — created. Sections 1 and 2 were written from the feature row, the idea,
  ADR-055 and `EVT-08`'s plan before the source was read. On reading `EventEditor.tsx`, AC-7 gained
  its first clause — `event-save` already disables and reads *Saving…* during a save, and it now
  stays so across both calls; on reading `EventDetail.tsx`, AC-6 was made concrete as the panel
  opening with the error and the addresses, since `EventInvitePanel` already owns both. No AC was
  loosened. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
