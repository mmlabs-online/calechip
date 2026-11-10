---
ticket: EVT-14
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-15T14:04:28+0700
inputs_read:
  - .ai/board/tickets/EVT-14/ticket.yaml
  - .ai/board/ideas/2026-10-14-the-way-to-join-an-event-scrolls-out-of-sight-and-a-guest-cannot-sign-in-from-it.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-061-invitations-reach-every-event-scope-and-a-signed-in-reader-leaves-the-guest-page.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/ui-design-system.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - .ai/board/tickets/EVT-06/01-plan.md
  - .ai/board/tickets/EVT-13/ticket.yaml
  - .ai/board/tickets/UIE-12/ticket.yaml
  - .ai/board/tickets/UIE-12/01-plan.md
  - src/App.tsx
  - src/routes/GuestEvent.tsx
  - src/routes/SignIn.tsx
  - src/components/AuthCard.tsx
  - src/hooks/useSession.ts
  - tests/e2e/evt-06-guest-link.spec.ts
  - tests/e2e/uie-12-sticky-join.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# EVT-14 — a signed-out reader of a guest link is offered sign-in and sign-up

## 1. Problem and scope

**From `.ai/registry/features.md`, verbatim:**

> | EVT-14 | A signed-out reader of a guest link is offered sign-in and sign-up, and signing in returns them to the event | EVT | PLANNED | | From `.ai/board/ideas/2026-10-14-the-way-to-join-an-event-scrolls-out-of-sight-and-a-guest-cannot-sign-in-from-it.md`, same verdict as `UIE-12`. **Written by `product` at /triage on 2026-10-14** (ADR-007). `depends_on: [EVT-13]`, so that a reader who signs in and can read the event ends on `/events/<id>` (Q3-A). **No ADR:** ADR-061 decision 8 already has the guest page read the session, and a signed-in reader who cannot read the event "sees the guest page as today", which has no prompt; nothing is granted, denied or revealed. **SCOPE, each clause the operator's answer in the idea's § Evidence:** `/guest/:token` shows a log-in and sign-up prompt to signed-out readers only, never to a signed-in one (Q5-A); guest registration without an account stays (Q2-A); *Log in* returns the reader to the same event, which needs a return-to on `/signin` (Q3-A); *Sign up* links to `/signup` as it is, and the prompt says an admin must approve the account (Q4-A) — **no permission is granted by signing up from an event** (Q4-C refused). **The return-to accepts an in-app path only**, or it is an open redirect; PLAN states the rule as a criterion. **`product`'s guesses, not the operator's, and PLAN may overturn any of them:** the prompt can be dismissed for the current page view only and nothing is persisted (G2); no schema change (G3). PLAN records the amendment to EVT-06 AC-16 that a signed-out and a signed-in non-reader now see different pages. Layout, including header or footer, is `tech-lead-design`'s. **Shares `src/routes/GuestEvent.tsx` with `UIE-12`, so the two are sequenced.** `Invariants touched` is PLAN's. |

**Who gains what.** A person who opens a guest link while signed out — most often a member who
followed a forwarded link or an emailed invitation — gains a way, from that page, to sign in as
themselves and come back to the same event, instead of registering as a guest with their email and
ending up in the guest list rather than the event's member attendance. Since EVT-13, a member who
comes back signed in and can read the event is taken on to `/events/<id>`; one who cannot sees the
guest page as before. Someone with no account gains a visible way to ask for one, told plainly that
an admin must approve it. Nobody gains a permission: both are links to screens that already exist.
G2 and G3 are kept as `product` guessed them; this plan does not overturn either.

**G1 belongs to `UIE-12`**, which has shipped, and is not this ticket's.

`size_estimate: S` — one prompt on one page, a query parameter honoured by one existing redirect,
and one pure function.

### Out of scope

- **Making an account mandatory to register** (Q2-B, decided against). EVT-07's form, its states and
  its test ids are untouched.
- **Any permission, approval or membership from signing up on an event page** (Q4-C, decided
  against). `/signup` is linked exactly as it is, and no return-to is carried to it: a new account
  is pending and could not read the event anyway.
- **The prompt on any page other than `/guest/:token` in its `ready` state** — not on the manage
  page `/guest/registration/:token`, not on `guest-event-not-found` (EVT-06 AC-13 keeps "nothing
  onward"), not while loading.
- **Linking a guest registration to a member account** after the guest signs in or up.
- **The redirect of a signed-in reader to `/events/<id>`.** That is EVT-13, shipped; this ticket only
  routes the reader back into it.
- **Persisting a dismissed prompt** across page views, reloads or visits (G2).
- **A return-to on any other entry to `/signin`** — the shell's own redirect of a signed-out caller
  from a guarded address does not start carrying one here. The parameter is honoured from wherever it
  comes, but only the guest page writes it.
- **Restyling `/signin` or `/signup`**, or naming the event on them.

## 2. Acceptance criteria

"Signed out" below means `useSession`'s `signed-out` membership state — no session at all.
"Signed in" means any of the other four (`member`, `undecided`, `member-less`, and an approved member
who cannot read the event).

### The prompt

**AC-1 — a signed-out reader is offered both ways in**
- Given an event open to guests, and a caller who is signed out
- When they open its guest link and the event is drawn
- Then `guest-auth-prompt` is shown once on the page, holding `guest-auth-prompt-signin` and
  `guest-auth-prompt-signup`, and a sentence saying a new account must be approved by an admin
  before it can be used

**AC-2 — a signed-in reader is never offered it** (Q5-A)
- Given an event open to guests, and a caller who is signed in in any membership state — pending
  approval, member-less, or an approved member who cannot read the event
- When they open its guest link and the guest page is drawn
- Then `guest-auth-prompt` is absent, and nothing else on the page differs from what a signed-out
  caller sees
- *This amends EVT-06 AC-16 ("a signed-in reader sees the same page") for a second time: ADR-061
  decision 8 replaced it for a reader of the event; this criterion replaces it for every signed-in
  caller by exactly one element, the prompt. Recorded here, as triage directed.*

**AC-3 — only where there is an event to come back to**
- Given a signed-out caller
- When the guest page is loading, or shows `guest-event-not-found`, or the caller is on the manage
  page `/guest/registration/<token>`
- Then `guest-auth-prompt` is absent

**AC-4 — registering as a guest still works beside it** (Q2-A)
- Given AC-1's page
- Then `guest-register` (or `guest-register-closed`, `guest-register-full`) is drawn exactly as
  EVT-07 and UIE-12 drew it, in `guest-join-bar`, and a guest can register while the prompt is shown
- And no control of the prompt overlaps a control of `guest-join-bar`, at any scroll position, wide
  or narrow

**AC-5 — the prompt stays in view while the page scrolls**
- Given AC-1's page with a description longer than the viewport
- When the reader scrolls to the bottom of the page
- Then `guest-auth-prompt-signin` and `guest-auth-prompt-signup` are inside the viewport, at the top
  of it, on a narrow (390 × 844) and a wide (1440 × 900) viewport alike

**AC-6 — dismissed for this page view only** (G2)
- Given AC-1's page
- When the reader activates `guest-auth-prompt-dismiss`
- Then `guest-auth-prompt` is gone, and the rest of the page is unchanged
- And when the page is reloaded, the prompt is shown again
- And nothing is written to `localStorage`, `sessionStorage`, a cookie or the URL by the dismissal

### Signing in from it

**AC-7 — *Sign in* goes to `/signin` and names the way back** (Q3-A)
- Given AC-1's page at `/guest/<token>`
- When the reader activates `guest-auth-prompt-signin`
- Then the browser is at `/signin?next=<the URL-encoded path /guest/<token>>`, showing the sign-in
  screen exactly as TEA-05 and UIE-01 draw it

**AC-8 — signing in returns the reader to the event**
- Given AC-7's screen
- When an approved member who can read the event signs in
- Then they end on `/events/<id>` of that event (EVT-13 AC-1, reached through `/guest/<token>`)
- And when instead the person signing in cannot read the event — an approved member outside its
  audience, a pending sign-up, or a member-less user — they end on `/guest/<token>`, showing the guest
  page without `guest-auth-prompt` (AC-2)
- And pressing Back from where they end does not show the sign-in screen again

**AC-9 — the return-to accepts an in-app path only** (feature row: "or it is an open redirect")
- Given a caller who is or becomes signed in at `/signin?next=<value>`
- Then they are sent to `<value>` only when it is a path on this origin: it begins with exactly one
  `/`, the character after it is neither `/` nor `\`, and it contains no `\`, no ASCII control
  character and no whitespace
- And for every other value — absent, empty, `//evil.example`, `/\evil.example`, `https://evil.example`,
  `javascript:alert(1)`, `evil.example`, `/a%0Ab` (a newline once decoded), a value with a `\` anywhere — they
  are sent to `/`, exactly as before this ticket
- And at no point does the browser leave the application's origin

**AC-10 — `/signin` without a return-to is unchanged**
- Given `/signin` with no `next` parameter
- Then everything TEA-05 AC-1..AC-9 and UIE-01 assert still holds, including that a caller already
  signed in is sent to `/`

### Signing up from it

**AC-11 — *Sign up* goes to `/signup` as it is** (Q4-A)
- Given AC-1's page
- When the reader activates `guest-auth-prompt-signup`
- Then the browser is at `/signup` with no query string, showing the sign-up screen exactly as TEA-01
  and UIE-01 draw it
- And an account created there is pending approval exactly as it is today: it reads no event, joins
  no team and is approved by nobody because of where it came from (Q4-C refused)

### What it does not touch

**AC-12 — the guest page's other guarantees hold**
- Given AC-1's page
- Then EVT-06 AC-9 still holds (no sign-in form, no sidebar, no application top bar — the prompt is
  not that bar and carries no navigation but its two links), EVT-06 AC-12 (no field beyond those
  listed), and EVT-06 AC-15 (the two `<meta>` tags, removed once the reader leaves, including by the
  prompt's links)

**Invariants touched.** `[]` — INV-01 to INV-07 are about entries and the absence count; this ticket
reads and writes neither.

**Open questions.** None. One assumption ships and is stated here so it can be argued with: the
button is labelled *Sign in*, not *Log in*, because every other control in the product that reaches
`/signin` says *Sign in* (`SignIn.tsx:129`, `AuthCard.tsx` `auth-tab-signin`). The feature row's
italic *Log in* names the action, not a string.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

The operator's request allowed the header or the footer. **Header**, because UIE-12 already pins
`guest-join-bar` to the bottom of a narrow screen, and two pinned strips at the bottom would put the
prompt's links over the register button (AC-4).

- **`guest-auth-prompt`** is a slim card, `rounded-card bg-card shadow-soft`, with the lavender callout
  tint the guest page already uses (`bg-holiday/30` over the card), drawn **above** the `CaleChip`
  label and the event card, as a sibling *before* the guest page's `<section>` rather than inside its
  grid — so UIE-12's `xl` two-column grid and its row placements are not disturbed. Same width as the
  section: `max-w-xl` below `xl`, `max-w-[55.5rem]` from `xl`.
- **It is `sticky top-0`** with a `z-20` over the join bar's `z-10`, so it stays at the top of the
  viewport as the page scrolls (AC-5).
- **Contents, one line from `sm`, wrapping below:** the sentence *Have a CaleChip account? Sign in to
  join as yourself.*; then the two links as pills — *Sign in* (`PRIMARY_BUTTON`'s look) and
  *Sign up* (`QUIET_BUTTON`'s look); then a small `×` button, `aria-label="Dismiss"`, right-aligned.
  Below the sentence, in `text-xs text-ink-3`: *New accounts are approved by an admin before they can
  be used.* (AC-1, Q4-A).
- **From `xl`, the join bar's sticky offset moves from `xl:top-6` to below the prompt** while the
  prompt is shown, so the two never overlap in the right column (AC-4); once dismissed, it returns to
  `xl:top-6`. Below `xl` they are at opposite ends of the screen and need no offset.
- No mascot, no illustration: the prompt is a way in, not an empty state.

## 3. Permission model

**Nothing in this ticket is a permission. Every element is an affordance** (ADR-005), and no row of
`.ai/standards/rbac-and-security.md` changes.

| Action | Signed out | Signed in, any state | Where it is decided |
|---|---|---|---|
| See the prompt | ✅ on a `ready` guest page | ❌ | The page, from `useSession`'s membership — an affordance. Showing or hiding it grants, denies and reveals nothing: both links are public addresses |
| Reach `/signin` | ✅ (as today) | ❌ → redirected (as today) | `App.tsx`'s `/signin` route, unchanged in what it guards |
| Be sent to `next` after sign-in | — | ✅ only to an in-app path (AC-9) | `safeReturnTo` in `App.tsx`'s redirect. **This is the only security-relevant rule in the ticket**: a target read from the URL is attacker-chosen, and a phishing link `…/signin?next=https://evil.example` must land on `/` |
| Read the event after returning | — | exactly as EVT-13 decides | `guest_link_event_id` and `may_read_event` in the database (ADR-061 decision 8). The return-to only puts the reader at `/guest/<token>`; it never names `/events/<id>` itself, so it cannot shortcut that check |
| Reach `/signup` | ✅ (as today) | ✅ (as today, ADR-009) | unchanged |
| Gain anything by signing up from the prompt | ❌ | ❌ | Nothing to decide: the link carries no parameter, and `/signup` creates a pending account as it does today (Q4-C refused) |

**The token travels in one more URL**: `/signin?next=%2Fguest%2F<token>`. It is the same origin and
the same browser history the token is already in; EVT-06 AC-15's `no-referrer` is removed when the
reader leaves the guest page, and the sign-in screen loads nothing cross-origin that the browser's
default `strict-origin-when-cross-origin` would hand a path to. No new exposure beyond the history
entry the guest page already creates.

## 4. Contract

### 4.1 `src/lib/return-to.ts` — new, pure

```ts
/** EVT-14 AC-9. The query parameter `/signin` reads, and the only name for it. */
export const RETURN_TO_PARAM = "next";

/**
 * EVT-14 AC-9. `raw` when it is a path on this origin, otherwise "/".
 * A path on this origin: begins with exactly one "/", the next character is neither "/" nor "\",
 * and it contains no "\", no character in U+0000..U+001F or U+007F, and no whitespace.
 * Takes the value as `URLSearchParams.get` returns it — already percent-decoded — and never decodes
 * again.
 */
export function safeReturnTo(raw: string | null): string;

/** EVT-14 AC-7. The `/signin` address that returns to `path`: "/signin?next=" + encodeURIComponent(path). */
export function signInReturningTo(path: string): string;
```

### 4.2 `src/App.tsx`

- The `/signin` route's signed-in arm, today `<Navigate to="/" replace />`, becomes
  `<AfterSignIn />`, a component defined in `App.tsx` (it must sit inside `<BrowserRouter>` to read
  the query string, and `App` itself does not):

```tsx
function AfterSignIn(): JSX.Element {
  const [params] = useSearchParams();
  return <Navigate to={safeReturnTo(params.get(RETURN_TO_PARAM))} replace />;
}
```

  `replace` is kept: it is what makes AC-8's "Back does not show the sign-in screen again" true.
- The `/guest/:token` route passes one more prop:
  `<GuestEvent signedInMember={membership.state === "member"} signedOut={membership.state === "signed-out"} />`.
  `useSession` is still called exactly once (TEA-05 § 4.3).
- `SignIn.tsx` is **not** changed: it never navigates (its header comment), so the return-to lives
  entirely in the route that already does the routing.

### 4.3 `src/routes/GuestEvent.tsx`

```tsx
export default function GuestEvent({
  signedInMember,
  signedOut,
}: {
  signedInMember: boolean;
  signedOut: boolean;
}): JSX.Element;
```

- New state in `GuestEvent`: `const [promptDismissed, setPromptDismissed] = useState(false);` —
  component state only (AC-6), reset by a remount, i.e. a reload or a new token.
- `const promptShown = signedOut && state.phase === "ready" && !promptDismissed;`
- The component returns a fragment: `{promptShown ? <GuestAuthPrompt … /> : null}` then the existing
  `<section>`. `guest-join-bar`'s `xl:top-6` becomes conditional on `promptShown` (§ 2b).
- New private component in the same file:

```tsx
function GuestAuthPrompt({
  token,
  onDismiss,
}: {
  token: string;
  onDismiss: () => void;
}): JSX.Element;
```

  `guest-auth-prompt-signin` is a react-router `<Link to={signInReturningTo(`/guest/${token}`)}>`;
  `guest-auth-prompt-signup` is `<Link to="/signup">`; `guest-auth-prompt-dismiss` is a
  `<button type="button">` calling `onDismiss`.

### 4.4 Selectors — new, and the only new ones

| `data-testid` | Element | AC |
|---|---|---|
| `guest-auth-prompt` | the prompt's root | AC-1, AC-2, AC-3, AC-5, AC-6 |
| `guest-auth-prompt-signin` | the *Sign in* link | AC-1, AC-5, AC-7 |
| `guest-auth-prompt-signup` | the *Sign up* link | AC-1, AC-5, AC-11 |
| `guest-auth-prompt-dismiss` | the `×` button | AC-6 |

Every existing `guest-*`, `sign-in-*`, `sign-up-*` and `auth-*` id is frozen.

## 5. Seam impact

**None.** No seam function is added, changed or called anew. The session is already resolved in
`App` and reaches the page as a prop, as EVT-13 did with `signedInMember`.

## 6. Schema delta

**`none`** (G3 holds). No table, column, policy, trigger, function or grant. `requires_adr: false`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/return-to.ts"
  - "src/App.tsx"
  - "src/routes/GuestEvent.tsx"
  - "tests/return-to.test.ts"
  - "tests/e2e/evt-14-guest-sign-in.spec.ts"
```

`glossary_owed` is `[]`; no glossary row is written. *Guest* and *Guest link* already have rows.

`size: S` — five paths, two of them new tests. Agrees with `size_estimate: S`.

`.ai/standards/rbac-and-security.md` is deliberately not on the list: § 3 changes no row, and a row
for "see a prompt" would record an affordance as a permission.

## 8. Rejected alternatives

1. **The prompt in the footer, under or merged into `guest-join-bar`.** Plausible: one pinned element
   instead of two, and the operator offered the footer. Rejected because the bar is the page's
   primary action (UIE-12) and on a narrow screen it is already at the bottom; merging the prompt into
   it makes the register form taller exactly where the screen is shortest, and a separate footer
   strip would sit over its button (AC-4). The header is empty on this page.
2. **Carry the return-to in `sessionStorage`, set by the guest page and read after sign-in.**
   Plausible: no token in the `/signin` URL, and no open-redirect parameter to validate at all, since
   only the page writes the value. Rejected because it survives across tabs of the session and
   outlives the click — a member who opened a guest link last week and signs in today from the
   bookmark would be thrown onto an old event — and because G2 says nothing is persisted, which a
   reviewer would rightly read as covering this. The query parameter is visible, single-use by
   construction, and its one risk is closed by AC-9.
3. **Navigate from `SignIn.tsx` on success.** Rejected: the screen deliberately never navigates and
   lets the session change route it (`SignIn.tsx:7-8`); a second navigation racing `App`'s redirect
   is the kind of double-routing that produced the `/signin` ↔ `/` loop the landing route comments
   record. The redirect that already exists is the one place to change.

## Changelog

- `2026-10-15T14:04:28+0700` — sections 1–8 written. Sections 1 and 2 were drafted from the feature
  row and the idea file before the source was read; reading `App.tsx` added "signed in, any state"
  to AC-2 (the page knew only `signedInMember`, so a pending or member-less session would otherwise
  have been shown a *Sign in* link while signed in), and confirmed AC-3's exclusion of
  `guest-event-not-found` against EVT-06 AC-13. No AC was narrowed to fit the code. Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.
