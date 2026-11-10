---
ticket: TEA-05
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-01T14:26:13+07:00
inputs_read:
  - .ai/board/tickets/TEA-05/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/00-charter.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-009-how-a-person-becomes-a-member.md
  - .ai/registry/decisions/ADR-010-triage-creates-the-ticket-shell.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-019-idea-into-triage-spec-into-plan.md
  - .ai/registry/decisions/ADR-021-revert-the-qa-waiver.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/board/tickets/TEA-01/01-story.md        # the carve-out table, and the AC-6 fragments
  - .ai/board/tickets/TEA-01/02-design.md       # sections 1.1 and 7, for the same
  - .ai/board/tickets/BUG-001/ticket.yaml
  - .ai/board/backlog.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# TEA-05 — Sign in, sign out, and the member-less landing state

## 1. Problem and scope

### The feature rows, transcribed

**This ticket carries two feature IDs — `TEA-05` and `TEA-01`.** `TEA-05` is a row of its own;
`TEA-01` is here because this is the other half of that feature, carved out at DESIGN on 2026-08-31
and never turned into a ticket. TEA-01's story fixes both halves at `feature_ids: [TEA-01]` and says
the feature *"is delivered only when both are DONE"* (`01-story.md:212`).

From `.ai/registry/features.md`, the load-bearing clauses of the `TEA-05` row, verbatim. The row is
long and the ticket shell is its authoritative enumeration by the row's own instruction — *"Contents,
enumerated at `01-story.md:210` and carried into the ticket shell rather than restated as paths
here"* — so what is transcribed below is what binds this plan, not the whole cell:

> **The other half of TEA-01, carved out at DESIGN on 2026-08-31 and never turned into a ticket** —
> the work was written down in four artifacts and fell through a hole in the loop, because no command
> creates a shell for half a feature (MD-017).

> **`schema_delta` none, and this is conditional rather than free.** […] **The condition:
> `public.team` has RLS enabled with everything revoked and no select policy anywhere** […] and
> **that policy belongs to CAL-04** […] So the landing screen reads the caller's own `member` row and
> nothing else, plus one link to the admin allow-list screen when that row is an admin. **If DESIGN
> cannot hold the screen inside that, narrow the screen rather than taking CAL-04's policy early.**

> **The trap is recorded in the application shell itself, in a comment TEA-02 left there:** TEA-02's
> AC-9 is satisfied today only by the absence of any menu, so the first ticket that adds one inherits
> the real version of that criterion. A landing screen is the obvious place for a menu to appear,
> which makes this the likeliest ticket to become that one by accident. It must not.

> **AC-6 was lost and must be reconstructed, not transcribed.**

**`/ship` must read step 3 as plural.** `.claude/commands/ship.md:42` says *"this feature's
`Status`"*, singular, written before any ticket had two IDs. `TEA-05` and `TEA-01` go to `DONE`
together, or the board keeps lying in the other direction — TEA-01's row has no other path out of
`IN_PROGRESS`.

### What the person gains

**Nobody can sign in.** TEA-01 shipped sign-up: a person creates an account, confirms their address,
a trigger makes their `member` row, and then the product has no door. Three screens exist behind that
door and all three are unreachable — `/signup` is the only route anybody lands on, and `App.tsx`'s
catch-all sends every other address there. `getCurrentMember()` returns `null` on every call in a
real build, so `/allow-list` renders *refused* to a genuine admin and `/members` renders *not on a
team* to a genuine member. **Two shipped tickets are fully built and entirely unusable**, and the
operator's own admin account, seeded on 2026-09-01, cannot get in.

This ticket adds the door: sign in, sign out, a session that survives a reload, and the landing
screen a signed-in person arrives at — including the one for a person who has an account and no
`member` row, which ADR-009 §Consequences says *"must be handled in the interface, not left to look
like a bug"*.

`size_estimate` from this section: **M**. The carve-out at `01-story.md:211` estimated **S**; the
technical half of triage re-read the file list and said M, and recorded the disagreement rather than
copying the S forward. This plan agrees with M — see §7, where it is counted rather than judged.

### Out of scope

- **Anything on the landing screen beyond the caller's own `member` row, plus one link to
  `/allow-list` when that row is an admin.** `public.team` has row-level security enabled, everything
  revoked and **no select policy anywhere**; that policy and the `grant select on public.team` beside
  it belong to CAL-04. The month view is CAL-04's and stays there. If this screen cannot be held
  inside that, the screen narrows — taking CAL-04's policy early would be ADR-010 §Revert condition's
  first clause firing, not a scope adjustment.
- **A navigation menu.** `src/App.tsx:33-36` records that TEA-02's AC-9 is satisfied today only by the
  absence of one, so the first ticket adding a menu inherits the real version of that criterion.
  **The single admin-only `/allow-list` link this ticket does add is that criterion arriving, in
  miniature and on purpose** — it is the one link the feature row permits, its visibility is AC-10,
  and it is named here so that it is a decision rather than an accident. Nothing else navigates.
- **Closing `.ai/standards/rbac-and-security.md:114`** — *"name where the session is read on the
  client, and what happens on expiry"*. Standards plane, human-owned under RULE-01. This plan decides
  the ticket's behaviour and cannot write that line; see Open questions.
- **Password reset, email change, account deletion, and social sign-in or SSO.** Each is its own idea.
  The charter's two roles are unchanged: no guest, no read-only visitor, no public calendar.
- **Route guards on `/allow-list` and `/members`.** Both already fail safe with no session, and
  neither file is in this ticket's `allowed_paths`. AC-9 covers the landing route and the catch-all
  only.
- **Fixing the end-to-end suite's unpinned seam** — BUG-001, and it is ahead of this ticket on the
  board. §7 records what that means for this one.
- **Retroactively testing TEA-02, TEA-03 and TEA-04.** ADR-021 §What is owed item 2 owes a separate
  ticket for that surface.

## 2. Acceptance criteria

**AC-1 — a member signs in and lands on the board**
- Given a person whose address is confirmed and who has a `member` row on team T
- When they submit their address and password on the sign-in screen
- Then they are signed in, and land on a screen showing their own `display_name`, `avatar` and `role`

**AC-2 — a wrong address and a wrong password are refused identically**
- Given a person at the sign-in screen
- When they submit an address that has no account, or an address that has one with the wrong password
- Then they stay on the sign-in screen and are shown **one** message, which does not say which of the
  two was wrong

  *The same reasoning that kept TEA-01's AC-5 from being an address-enumeration oracle. Two distinct
  messages let anybody test whether a colleague has an account here.*

**AC-3 — an unconfirmed address cannot sign in, and is told why**
- Given a person who signed up and has not yet confirmed their address
- When they sign in with the correct password
- Then they are refused, and told to confirm their address rather than that their password is wrong

  *TEA-01's AC-7 requires confirmation to be on, so this is a state the product creates on purpose and
  a person will reach it by following the instructions. Folding it into AC-2's single message would
  send somebody to reset a password that is correct. It reveals that the address has an account,
  which AC-2 conceals — that is accepted here and recorded in Open questions: the allow-list status
  ADR-009 protects is a different fact and stays hidden.*

**AC-4 — a signed-in person with no `member` row is told they are not on a team.**
**This criterion is RECONSTRUCTED, not transcribed.**
- Given a person who has confirmed their address and has **no** `member` row, because their address
  was not on the allow-list when they signed up
- When they sign in
- Then they land on a screen that says they are signed in and not yet on a team, and that an admin
  must add their address before they can join
- And no `member` row is created

  *The text this reconstructs does not exist. TEA-01's `01-story.md:86-90` deleted it in the same edit
  that promised it survived elsewhere; the story entered git history already carrying the placeholder,
  `git fsck --lost-found --unreachable` is empty, the stash is empty, and no artifact quotes it.
  Written afresh from the three surviving fragments the ticket shell names — `02-design.md:160-163`
  (the three-state union distinguishing signed-out from member-less from member, "which owns AC-6"),
  `02-design.md:818` ("the exact state the sign-in half's AC-6 exists to make rare"), and
  `01-story.md:102-105` (AC-5 and the moved AC-6 together tell a **signed-in** person whether their
  address is allow-listed). Presenting it as a transcription of text nobody can produce would be the
  more expensive error.*

**AC-5 — the member-less answer is never given to a caller with no session**
- Given a caller with no session
- When they open any address the application serves
- Then they are shown the sign-in screen, and nothing tells them whether any address is on the
  allow-list or has an account

  *ADR-009 §Consequences: only somebody who controls the mailbox may learn their allow-list status.
  A screen announcing "you are not on the allow-list" to an unauthenticated caller would undo TEA-01's
  AC-5 and turn it into an address-enumeration oracle. This is the bound on AC-4, and it is why AC-4
  is reachable only after a successful sign-in.*

**AC-6 — signing out ends the session**
- Given a signed-in person
- When they sign out
- Then they land on the sign-in screen, and reloading the page or navigating to the landing address
  does not restore the session

  *On a shared machine, in a product where every member reads the whole team's calendar, a session
  nobody can end is a real gap. Decided in scope at triage.*

**AC-7 — a reload keeps the session**
- Given a signed-in person
- When they reload the page
- Then they are still signed in and land where a signed-in person lands, without re-entering anything

**AC-8 — an expired or revoked session lands on sign-in, not on a broken screen**
- Given a signed-in person whose session has expired or been revoked
- When the application next reads the session
- Then they are shown the sign-in screen, and no screen renders as though they were still signed in

**AC-9 — with no session, the application lands on the sign-in screen**
- Given a caller with no session
- When they open the landing address, or any address the application does not route
- Then they are shown the sign-in screen

**AC-10 — the allow-list link is shown to an admin and to nobody else**
- Given a signed-in person on the landing screen
- When their `role` is `admin`
- Then a link to the allow-list screen is shown
- And when their `role` is `member`, no such link is shown

  *`Read the allow-list` is ❌ for a member and ✅ for an admin in
  `.ai/standards/rbac-and-security.md`. The link is an affordance only — `allowed_email_select_admin`
  already returns a member no rows and `AllowList.tsx` already refuses them — and it is the real
  version of TEA-02's AC-9 arriving for exactly one item.*

**AC-11 — signing in creates, updates and deletes nothing**
- Given any sign-in attempt, successful or refused, by a person with a `member` row or without one
- When it completes
- Then no row of `member` is created, updated or deleted

  *`.ai/registry/features.md` states the case this exists to catch: "presenting the member-less state
  must not create a member, or INV-04's denominator moves for somebody nobody admitted."*

### Invariants touched

**`[INV-04]` — and this diverges from the `TEA-05` feature row, which says `[]`.** The divergence is
written out rather than left for a reviewer to reconcile.

- **INV-04 — one definition of the absence count.** Reached indirectly. This ticket computes no
  count, creates no row and reads the row TEA-01's trigger already created. It is listed because
  `.ai/registry/invariants.md` says the list records what a change **could** affect and that
  *"choosing the safest behaviour and then concluding no invariant is engaged is circular reasoning:
  the fact that the behaviour had to be chosen is the evidence that the invariant was in play."*
  AC-11 is that behaviour being chosen. The feature row reaches `[]` by the other reading — that
  nothing here writes a row, so nothing can move the denominator — and that reading is correct about
  the mechanism and, by the rule above, the wrong test. **The mechanism is genuinely thin and is
  stated so R8 does not look for a control that is not there: nothing in §4 writes `public.member`,
  and the only writer of that table remains the admission trigger on `auth.users`.**

**Not listed, argued rather than assumed.** INV-07 is on TEA-01's row because that ticket *creates* a
`member` row and fixes its team; signing in fixes nothing and reads what exists. INV-01, INV-02,
INV-03, INV-05 and INV-06 all constrain `entry` rows, and `entry` does not exist yet — CAL-01 creates
it.

### Open questions

None blocking. Four things this plan decided rather than deferred:

- **`.ai/standards/rbac-and-security.md:114` stays open.** *"Name where the session is read on the
  client, and what happens on expiry"* is standards plane and human-owned under RULE-01, and the
  ticket shell calls it *"a decision owed before DESIGN"*. This plan answers it **for this ticket** in
  §4.2 and §4.3, from the installed library's own documented behaviour verified on disk rather than
  from a preference — which is the most a board-plane artifact may do. **A human still owes that
  line**, and until it is written the answer lives in a ticket artifact where the next reader will not
  look for it.
- **AC-3 reveals that an address has an account; AC-2 conceals which of two things was wrong.** The
  two are in tension and the split is deliberate: Supabase Auth returns a distinct
  `email_not_confirmed` error whatever this screen renders, so the account-existence signal is already
  at the API and hiding it in the interface would buy nothing while sending a person to reset a
  correct password. What ADR-009 actually protects — whether an address is on the **allow-list** —
  stays hidden in both branches, because sign-up succeeds identically either way.
- **The landing screen shows the caller's own row and one link, and no team name.** `public.team` has
  no select policy, so the team's name is unreadable; the screen says *"nhóm của bạn"* rather than
  naming it. This is the *narrow the screen* instruction being followed rather than CAL-04's policy
  being taken early.
- **Sign-in is by email and password only.** It is what TEA-01's sign-up creates and the only method
  the seeded accounts have. Magic links, OTP and SSO are each their own idea.

## 3. Permission model

**This ticket adds no permission and changes no row of the table in
`.ai/standards/rbac-and-security.md`.** Authentication is not authorization (ADR-005): Supabase Auth
establishes who the caller is, and every policy already written decides what that identity may do.
One existing row governs one control here:

| Action | `member` | `admin` | Where the check runs |
|---|---|---|---|
| Read the allow-list | ❌ | ✅ | `allowed_email_select_admin` (TEA-01's migration), unchanged |

AC-10's link is an **affordance** over that policy and carries a comment saying so. A member who
types `/allow-list` still reaches `AllowList.tsx`, which still calls `getCurrentMember()` and still
renders `allow-list-refused`; the policy still returns them zero rows. Hiding the link saves a
pointless journey and refuses nobody.

### The denials, and what holds each

| Denial | AC | Held by |
|---|---|---|
| A caller with no session learning anything about any address | AC-5 | TEA-01's `revoke all on public.member … from anon` plus `member_select_own` being `to authenticated`. **With no session the application cannot know the fact it would be leaking** — the routing that shows the sign-in screen instead is an affordance over that, not the control. |
| Sign-in creating a `member` row | AC-11 | The absence of any write path. `public.member` has no insert policy and never may (ADR-018 §Decision 3); since TEA-04 its only `update` grant is on `role` and `removed_at` behind `member_update_admin`. The sole writer is the `admit_allow_listed_member` trigger on `auth.users`, which fires on `email_confirmed_at` and not on sign-in. **Nothing in §4 issues a write of any kind.** |
| A member seeing the allow-list link | AC-10 | The affordance above, over `allowed_email_select_admin`. |
| Reading the team's name, or any row of `public.team` | §1, Out of scope | `public.team` has row-level security enabled, everything revoked, and **no select policy anywhere**. §4.4 is built so that nothing asks. |

**Every screen in §4.4 is an affordance and none of them is a control.** That is the whole of this
section, and it is short because a sign-in feature under ADR-005 adds no enforcement — it produces
the identity the enforcement already reads.

## 4. Contract

### 4.1 Domain types — one union added, one `FailureCode` added

**`Membership`, the three-state union TEA-01's design reserved for this ticket.**
`02-design.md:160-163` declined to define it there: *"the three-state union that distinguishes
signed-out from member-less from member belongs to the sign-in half, which owns AC-6. Defining it here
with no consumer would be a shared type the other ticket then has to change."* This is that ticket and
this is that consumer.

```ts
/**
 * TEA-05. The three states a caller can be in, and they are three rather than two on purpose:
 * "signed in" and "on a team" are different facts, and ADR-009 creates people who are the first
 * without being the second.
 */
export type Membership =
  | { state: "signed-out" }
  | { state: "member-less"; user: AuthUser }
  | { state: "member"; user: AuthUser; member: Member };
```

`AuthUser`, `Session` and `Member` already exist and are unchanged. One `FailureCode` is added to the
existing union:

```ts
| "email_not_confirmed"  // AC-3. Verified on disk: the code appears in
                         // @supabase/auth-js@2.112.4/dist/module/lib/error-codes.d.ts
```

**No other type changes**, so no existing caller changes — §7's sizing test.

### 4.2 The seam — four functions added

The four the carve-out enumerated at `01-story.md:210`. Added to `DataSeam` in
`src/lib/data/index.ts` and to both implementations with the same name and arity.

```ts
export interface SignInInput {
  email: string;
  password: string;
}

/**
 * TEA-05 AC-7, AC-8, AC-9. The session as it stands right now, or null. Null is a normal answer.
 * Reads persisted state; it does not prompt for anything.
 */
getSession(): Promise<Session | null>;

/**
 * TEA-05 AC-6, AC-7, AC-8. Calls `listener` whenever the session appears, changes or goes away.
 * Returns the unsubscribe function; the caller MUST call it on unmount.
 *
 * The listener takes `Session | null` and NOT the underlying library's event union. That union is a
 * datastore type, and `.ai/standards/architecture.md` (Layers) says code above the seam works in
 * domain types and never in a client's vocabulary — passing it through would put a Supabase type in
 * a hook and make RULE-02 a matter of which import you happened to write. It is lossless here:
 * every event this ticket reacts to (SIGNED_IN, SIGNED_OUT, TOKEN_REFRESHED, INITIAL_SESSION)
 * carries the session or null, and nothing in §4.3 branches on which one arrived.
 */
onAuthStateChange(listener: (session: Session | null) => void): () => void;

/**
 * TEA-05 AC-1, AC-2, AC-3. Email and password only — it is what TEA-01's sign-up creates and what
 * the seeded accounts have.
 *
 * Expected failures are RETURNED, not thrown (.ai/standards/coding-standards.md). Two codes reach a
 * sentence on screen: `invalid_credentials` for AC-2, which must stay one message for both the
 * unknown address and the wrong password, and `email_not_confirmed` for AC-3.
 */
signIn(input: SignInInput): Promise<Result<Session>>;

/**
 * TEA-05 AC-6. Ends the session. Returns `Result<void>`; a failure here is rare and is still
 * returned rather than thrown, because a sign-out that silently did nothing on a shared machine is
 * the failure this function exists to prevent.
 */
signOut(): Promise<Result<void>>;
```

**Verified against the installed client rather than recalled**, per the *past reliable recall* list in
`.ai/standards/tech-stack.md`. Every line below is in
`node_modules/.pnpm/@supabase+auth-js@2.112.4/node_modules/@supabase/auth-js/dist/module/`:

| What the seam needs | What the library gives | Where |
|---|---|---|
| `signIn` | `signInWithPassword(credentials): Promise<AuthTokenResponsePassword>` | `GoTrueClient.d.ts:589` |
| `signOut` | `signOut(options?): Promise<{ error: AuthError \| null }>` | `GoTrueClient.d.ts:2033` |
| `getSession` | `getSession(): Promise<{ data: { session: Session \| null }, error }>` | `GoTrueClient.d.ts:1479` |
| `onAuthStateChange` | `onAuthStateChange(cb): { data: { subscription: Subscription } }`, and `Subscription.unsubscribe: () => void` | `GoTrueClient.d.ts:2045`, `lib/types.d.ts:531` |
| the event union | `'INITIAL_SESSION' \| 'PASSWORD_RECOVERY' \| 'SIGNED_IN' \| 'SIGNED_OUT' \| 'TOKEN_REFRESHED' \| 'USER_UPDATED' \| 'MFA_CHALLENGE_VERIFIED'` | `lib/types.d.ts:15` |
| AC-3's code | `'email_not_confirmed'` | `lib/error-codes.d.ts` |
| AC-7 and AC-8 | `persistSession: true` and `autoRefreshToken: true` are the **defaults** | `GoTrueClient.js:17-18` |

**AC-7 and AC-8 are library behaviour, not behaviour this ticket builds**, and that is why they are
criteria rather than construction: the client persists the session and refreshes the token on its
own, and emits `SIGNED_OUT` when a refresh finally fails. §4.3 subscribes and re-renders; it
implements no expiry logic of its own, and must not — a second timer would be a second source of
truth about whether somebody is signed in.

### 4.3 The hook — `src/hooks/useSession.ts` (new)

**This is what `.ai/standards/rbac-and-security.md:114` asks for, answered for this ticket.** The
session is read here and nowhere else above the seam; on expiry the library emits and this hook
re-resolves to `{ state: "signed-out" }`, which routes to the sign-in screen (AC-8).

```ts
export interface SessionState {
  membership: Membership;
  /** True until the first resolution completes. AC-9 must not flash the sign-in screen at somebody
   *  who is signed in, and `signed-out` is indistinguishable from `not yet known` without this. */
  resolving: boolean;
  signIn(input: SignInInput): Promise<Result<Session>>;
  signOut(): Promise<Result<void>>;
}

export function useSession(): SessionState;
```

Resolution, in this order, on mount and again on every change the listener reports:

1. `const session = await seam.getSession()` — null gives `{ state: "signed-out" }`.
2. `const member = await seam.getCurrentMember()` — null gives `{ state: "member-less", user }`.
   **This is AC-4's whole mechanism**, and it is the distinction ADR-009 §Consequences requires be
   handled in the interface rather than left to look like a bug.
3. otherwise `{ state: "member", user, member }`.

`resolving` is `false` after the first resolution and stays false; a later change re-resolves without
returning the screen to a spinner.

The subscription is created in an effect and **the returned function is called on cleanup.** A leaked
subscription survives a hot reload and re-resolves against a stale closure.

**`useSession()` is called exactly once, in `App.tsx`**, and the result is passed to the two screens
that need it as props. §9 records why that is a hook and not the context provider TEA-02's design
predicted.

### 4.4 The screens

**`src/routes/SignIn.tsx` (new).** Email, password, submit, and one error line. On success it renders
nothing of its own — the listener in §4.3 fires and `App.tsx` routes away. AC-2's single message is
produced in the seam, not here: `supabase.ts`'s existing `toFailure` already maps
`invalid_credentials` to *"Email hoặc mật khẩu không đúng."*, which names neither field, and AC-3's
new code gets its own sentence.

**`src/routes/NotOnATeam.tsx` (new).** AC-4. Says the person is signed in and not yet on a team, and
that an admin must add their address. **It must not say whether their address is on the allow-list**
— it cannot know, and ADR-009 §Consequences plus TEA-01's AC-5 are why it must not appear to guess.
Carries a sign-out control, because somebody in this state has no other way out.

**`src/routes/Home.tsx` (new).** AC-1, AC-10. The caller's own `display_name`, `avatar` and `role`
from the `member` already in `Membership`, a sign-out control, and — when `role === "admin"` — one
link to `/allow-list`.

**It shows no team name and no board.** `public.team` has no select policy, so the name is unreadable;
the screen says *"nhóm của bạn"*. The month view is CAL-04's. **This is the feature row's *narrow the
screen* instruction being followed**, and the narrowing is what keeps `schema_delta` at `none` (§6).

**`src/App.tsx` (edit).** One `useSession()` call and the routing table below. `app-root` and
`seam-banner` keep their names and their positions.

| `membership` | `/signin` | `/` | `/signup` | `*` |
|---|---|---|---|---|
| `resolving` | `app-session-loading` on every path | | | |
| `signed-out` | `SignIn` | → `/signin` | `SignUp` | → `/` |
| `member-less` | → `/` | `NotOnATeam` | `SignUp` | → `/` |
| `member` | → `/` | `Home` | `SignUp` | → `/` |

`/allow-list` and `/members` keep their current entries and are **not** guarded here: both already
fail safe with no session, and neither file is in `allowed_paths`. `/signup` stays reachable in every
state — it is TEA-01's shipped screen and the only route a person who has not signed up can use. The
catch-all changes from `→ /signup` to `→ /`, which is AC-9.

## 5. Seam impact

**Four functions added: `getSession`, `onAuthStateChange`, `signIn`, `signOut`.** All four appear in
`DataSeam` and in both implementations with the same name and arity, or `tests/seam-parity.test.ts`
fails — and it must pass **unedited**, which is why it is absent from §7. It enumerates
`Object.keys(referenceImpl)` and follows the seam without a change.

No existing seam function changes. `getCurrentMember()` is called by §4.3 exactly as `AllowList.tsx`
and `MemberList.tsx` already call it, and finally returns something other than null in a real build —
which is the point of the ticket rather than a change to the function.

### What the mock must reproduce

**The mock stops fabricating and starts implementing.** Today `mock.ts` holds `currentMemberId`
seeded to `FIXTURE_ADMIN` and a test-only `__setCurrentMember` door, because no session exists. After
this ticket the mock has a real sign-in: `signIn` checks an address and a password against
`FIXTURE_CREDENTIALS` (§5.1) and sets the current session; `signOut` clears it; `getSession` reports
it; `onAuthStateChange` notifies the listeners the mock keeps in an array and returns a real
unsubscribe.

| Attempt | Mock answer | Reproducing |
|---|---|---|
| unknown address, or known address with the wrong password | `invalid_credentials`, one message | AC-2 |
| an address flagged unconfirmed in the fixture | `email_not_confirmed` | AC-3 |
| a credential whose account has no member row | `ok`; `getCurrentMember()` then returns null | AC-4 |
| `signOut` | `ok`; session null, listeners notified | AC-6 |
| `getSession` after `signIn` and before `signOut` | the session | AC-7 |

**`__setCurrentMember` stays, and is now redundant rather than load-bearing.** Nothing in the
repository calls it today. Removing it is a tidy-up with no criterion behind it and it is left alone;
the honest note is that after this ticket a test should sign in rather than assert its way into a
session, and the next ticket to touch `mock.ts` can delete it.

**Expiry is not modelled in the mock.** AC-8 is the library refreshing and finally emitting
`SIGNED_OUT`; the mock has no clock and no token, and a fake expiry would be a second definition of
when a session ends. AC-8 is therefore observable only against a real project — §8.1.

### 5.1 Fixtures and the seed — a drift repaired on the way past

`src/lib/fixtures.ts` gains `FIXTURE_CREDENTIALS`, mapping each seeded address to its password and
its expected membership, and `FIXTURE_MEMBER_LESS` — an auth user with **no** `member` row, which
AC-4 needs and which **does not exist today**: every one of the seven seeded accounts has a member
row.

**And `FIXTURE_MEMBER` is in `src/lib/fixtures.ts` and in `mock.ts` and has no row in
`supabase/seed.sql`.** Verified: `grep -c '55555555-5555-4555-8555-555555555555' supabase/seed.sql`
returns 0, while every other fixture — `FIXTURE_ADMIN`, `FIXTURE_OTHER_TEAM_MEMBER`,
`FIXTURE_REMOVED_MEMBER`, `FIXTURE_SECOND_ADMIN` — has one. So **the only `member`-role account in the
product is unseeded**, and against a real project AC-10's *"and when their `role` is `member`, no such
link is shown"* has nobody to be. `.ai/standards/testing-standards.md` requires the two files to carry
the same rows and says why: *"a fixture that exists only in one test file drifts from the seed and
produces failures that reproduce in CI and not locally."*

`supabase/seed.sql` therefore gains two accounts: `FIXTURE_MEMBER`'s, repairing the drift, and
`FIXTURE_MEMBER_LESS`'s. Both need an `auth.users` row first, with `confirmation_token`,
`recovery_token`, `email_change_token_new` and `email_change` set to `''` — MD-014, and this ticket is
the one where that defect bites hardest, because it made **every seeded account fail to sign in** and
sign-in is the whole subject here.

**A repair inside a feature ticket is worth flagging rather than doing quietly**, and it is done here
because the alternative is an acceptance criterion nobody can run.

## 6. Schema delta

**`none`, and the condition the feature row attached to that word is discharged rather than assumed.**

The row says `none` holds only if the landing screen stays inside what is already readable —
*"the caller's own `member` row and nothing else, plus one link to the admin allow-list screen when
that row is an admin"* — because `public.team` has row-level security enabled, everything revoked and
no select policy anywhere, and that policy belongs to CAL-04 per ADR-014's *Correction* of
2026-08-31.

**§4.4 stays inside it.** `Home.tsx` renders `display_name`, `avatar` and `role`, all three off the
`member` row `member_select_own` already returns, plus one conditional link. It shows no team name —
the screen says *"nhóm của bạn"* — and no board. Nothing here reads `public.team`, so no policy and no
`grant select on public.team to authenticated` is needed, and ADR-010 §Revert condition's first clause
does not fire.

**`requires_adr: false`.** No migration, no policy, no trigger, no constraint. ADR-005 is explicit
that authentication writes none: Supabase Auth authenticates, row-level security authorizes, there is
no server and no authentication API. The admission trigger fires on `email_confirmed_at` and is
untouched by signing in. `member_select_own`'s own comment — *"the sign-in half depends on this policy
rather than adding one"* — is this ticket's dependency being discharged.

**`none` does not mean no SQL file changes.** `supabase/seed.sql` is edited (§5.1). It is data a human
applies, not schema: no table, column, policy, trigger or constraint is touched, so ADR-014 does not
engage. It is named here so that nobody reads `none` and then finds a `.sql` file in the diff.

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/fixtures.ts"
  - "src/hooks/useSession.ts"
  - "src/routes/SignIn.tsx"
  - "src/routes/NotOnATeam.tsx"
  - "src/routes/Home.tsx"
  - "src/App.tsx"
  - "supabase/seed.sql"
  - "tests/e2e/tea-05-sign-in.spec.ts"
```

Twelve globs, twelve files. **No inline comments on the items** — `readYamlList` in
`scripts/check-allowed-paths.mjs` and in `.claude/hooks/guard-allowed-paths.mjs` strips only a leading
and a trailing quote, so a trailing `# …` is swallowed into the pattern and the glob matches nothing.

**Deliberately absent:**

- `tests/seam-parity.test.ts` — four seam functions are added and it must pass unedited.
- `playwright.config.ts` — pinning the suite's seam is **BUG-001**, which is ahead of this ticket on
  the board. Taking it here would be fixing another ticket's defect inside a feature branch.
- `src/routes/AllowList.tsx`, `src/routes/MemberList.tsx` — both already fail safe with no session and
  neither needs an edit. §4.4 adds no guard around them.
- `supabase/migrations/` — §6.
- `tests/permission-model.test.ts` — every criterion here is observable through the interface,
  including AC-11 (§8).

### Size

**M.** Twelve files, and `size_estimate` in §1 was also **M** — they agree, and the agreement is
worth the line the command asks for because **the carve-out that created this ticket said S**
(`01-story.md:211`). The technical half of `/triage` re-read the file list, counted ten to eleven, and
recorded M against that S rather than copying it forward. This plan counts twelve: triage's eleven
plus `supabase/seed.sql`, which triage did not list and which §5.1 explains. The S was an estimate of
one operation; what it could not see is that the operation needs two accounts nobody has seeded.

**Not L, so nothing splits** — twelve is M's ceiling and L begins above it. It is close enough to say
what would push it over: a route guard on `/allow-list` and `/members`, or the permission-model test.
Both are excluded above with reasons, not to protect the size.

**Not XL despite touching `src/lib/domain/types.ts`.** The XL row's stated test is *whether existing
callers must change*. `Membership` is a new union with no existing consumer and the new `FailureCode`
is added to a union that is already open; `Member`, `Session`, `AuthUser` and `Result` are untouched.
No existing caller changes. Triage reached the same reading independently.

### Prerequisites this ticket does not own

**BUG-001 is ahead of this ticket on the board and TEA-05 will stop at its QA gate until it lands.**
ADR-021 §Consequences: *"Until it lands, no ticket can pass the QA gate, because Definition of Done
item 3 requires the suites to exit 0."* The end-to-end suite pins no seam — it inherits whatever `.env`
the machine carries, so today it resolves to Supabase and drives the live project, and six of ten
tests fail on `main` (MD-021).

**`depends_on` is left as `[TEA-01]` and BUG-001 is deliberately not added to it.** ADR-021's own
posture is that tickets proceed and stop at the gate — it says CAL-01 *will* stop at QA and calls that
"the loop working" — and the board already sequences BUG-001 at row 1 above this ticket at row 2, so
the orchestrator reaches it first without an edge. Adding one would substitute this plan's judgement
for the ADR's stated shape.

## 8. Testability contract

The attribute is `data-testid`, named once in `.ai/standards/testing-standards.md`. RULE-05 makes this
table the only channel through which these controls reach QA. **ADR-021 re-armed the QA gate on
2026-09-01, so this section is live rather than dormant** — QA is entered, RULE-05 governs again, and
Definition of Done item 4 requires every AC below to map to a named test.

| selector | Element | Used by |
|---|---|---|
| `app-root` | The routed shell. Already exists. | all |
| `seam-banner` | The mock-seam banner. Already exists; asserts which implementation drove the test. | all |
| **`app-session-loading`** | *New.* Shown on every path until the first session resolution completes. Present so QA can assert it **disappears**, and so a signed-in person never sees the sign-in screen flash. | AC-1, AC-9 |
| **`sign-in-email`** | *New.* The address input. | AC-1, AC-2, AC-3 |
| **`sign-in-password`** | *New.* The password input. | AC-1, AC-2, AC-3 |
| **`sign-in-submit`** | *New.* The submit control. Its presence is how AC-5 and AC-9 assert "the sign-in screen". | AC-1, AC-2, AC-3, AC-5, AC-9 |
| **`sign-in-error`** | *New.* The typed failure, rendered as one sentence. **AC-2 asserts the text is identical for an unknown address and a wrong password.** | AC-2, AC-3 |
| **`not-on-a-team`** | *New.* The member-less screen. Its **absence** is how AC-5 is asserted for a caller with no session. | AC-4, AC-5 |
| **`not-on-a-team-sign-out`** | *New.* Sign-out from the member-less screen — the only way out of that state. | AC-6 |
| **`home-member-name`** | *New.* The caller's own `display_name`. | AC-1, AC-7 |
| **`home-member-avatar`** | *New.* The caller's own `avatar`. | AC-1 |
| **`home-member-role`** | *New.* The caller's own `role`, as a label. | AC-1 |
| **`home-sign-out`** | *New.* The sign-out control on the landing screen. | AC-6 |
| **`home-allow-list-link`** | *New.* The link to `/allow-list`. **Rendered only when `role` is `admin`**; its absence for a member is half of AC-10. | AC-10 |
| `member-list-row` | TEA-03's, already exists, carries `data-member-id`. Used here **only to read the roster**, not to test the member list. | AC-11 |

**AC-11 is asserted end to end and needs no unit test.** Sign in as `FIXTURE_MEMBER_LESS`, land on
`not-on-a-team`, sign out; sign in as `FIXTURE_ADMIN`, open `/members`, and assert the set of
`member-list-row` `data-member-id` values is unchanged and contains no row for the member-less user.
A sign-in that created a member row would be visible there and nowhere else.

### 8.1 What the end-to-end suite cannot prove, whichever seam it drives

**This is the ticket where that gap is widest, and the ticket shell says so.** Against the mock the
suite proves the three membership states, the routing table, both sign-out paths and every message —
and proves nothing about Supabase Auth, which is the component this feature is made of.

**MD-014 is the standing proof that the difference is not theoretical.** Every seeded account failed
to sign in with `500 Database error querying schema` because four `auth.users` columns were left
NULL, and it *"was found on the first contact with a real Supabase project, not in any test."* No
mock could have found it. **AC-3 and AC-8 are in the same position** — an unconfirmed address and an
expired token are GoTrue behaviours, and the mock has no clock (§5).

So the suite for this ticket is written to pin its seam explicitly, and the QA stage is where the
choice of which one it pins is made against a real project. **The mechanism for pinning is BUG-001's
and is not built here** (§7). Until it exists, a run of this suite inherits the machine's `.env` and,
on any machine that can run the application, drives the live project.

### 8.2 Which implementation a test drives

`src/lib/data/index.ts` chooses and `seam-banner` reports the choice. Every test in this ticket's
suite asserts the banner's presence or absence first, so a run that silently changed seam fails on
its first assertion rather than in the middle of a sign-in.

## 9. Rejected alternatives

**A React context provider, which is the shape TEA-02's design predicted.** Its §7 rejected adding
`getCurrentMember()` as a one-shot read only conditionally, saying *"a provider fed by
`onAuthStateChange` is the sign-in half's central object"* — so a context is the expected answer and
this plan does not build one. Rejected because a provider solves a problem this ticket does not have:
its value is one subscription serving many consumers scattered through a tree, and here there is
exactly **one** consumer — `App.tsx` — which resolves the membership and passes it to two screens as
props. A provider would add a file, a wrapper and an indirection to serve a single call site. **The
first component that needs the session without a prop path should add the provider**, backing it with
this same hook, and nothing in §4.3 has to change when it does. Building it now would be building that
ticket badly and then deleting it, which is the argument TEA-02 used in the other direction.

**Passing the library's `AuthChangeEvent` through the seam, so callers can distinguish
`SIGNED_OUT` from `TOKEN_REFRESHED`.** Genuinely useful in a bigger app — a token refresh that fails
is a different message from a deliberate sign-out. Rejected on `.ai/standards/architecture.md`
(*Layers*): that union is a Supabase type, and code above the seam works in domain types and never in
a client's vocabulary. Exposing it would make RULE-02 a matter of which import a hook happened to
write rather than a directory boundary a lint rule can check. It is also lossless for every criterion
here — nothing in §4.3 branches on which event arrived, only on whether a session came with it — and
the day a screen needs the distinction, the seam can carry a domain enum of its own.

**Distinguishing "no account with that address" from "wrong password" on the sign-in screen.** The
more helpful message, and what most products do. Rejected because it is an address-enumeration oracle
against a team roster: anybody could test whether a colleague has an account here. It is the same
reasoning that shaped TEA-01's AC-5, and AC-2 is written as a refusal so that the single message is a
criterion rather than a coincidence of which error the library happened to return.

**Guarding `/allow-list` and `/members` in `App.tsx` while the routing table was being written.** One
line each, obviously correct, and the files are open in front of whoever writes §4.4. Rejected because
both screens already fail safe — `AllowList.tsx` renders `allow-list-refused` and `MemberList.tsx`
renders `member-list-not-on-a-team` when `getCurrentMember()` returns null — so the guard adds no
protection, and because it would put this ticket's routing decisions on top of two other tickets'
acceptance criteria. If a guard is wanted it is a change to what those screens promise, and it belongs
to a ticket that says so.

**Modelling session expiry in the mock so AC-8 could run without a real project.** Attractive because
AC-8 is otherwise unverifiable in the fast suite. Rejected: the mock would need a clock and a token
lifetime, and both are the library's — a fake expiry is a second definition of when a session ends,
and the two would drift in the direction that matters (the mock says expired, the real client has
refreshed). §8.1 records AC-8 as a real-project criterion instead, which is true rather than
convenient.

## Changelog

- `2026-09-01T14:26:13+07:00` — sections 1 and 2 written from `features.md`, the ticket shell, the
  charter, ADR-009 and the three surviving AC-6 fragments, **before the source tree was read**.
  Sections 3 through 9 written after, with the auth API verified on disk rather than recalled.
  **No acceptance criterion was amended after reading the code.** Two facts found while reading did
  change the plan without changing an AC, and both are in §5.1: no seeded auth user lacks a `member`
  row, and `FIXTURE_MEMBER` has no seed row at all — so `supabase/seed.sql` entered `allowed_paths`
  and the size went from triage's eleven files to twelve. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
