---
ticket: TEA-05
stage: IN_PROGRESS
agent: developer
produced_at: 2026-09-03T09:39:34+07:00   # cycle 2; cycle 1 was 2026-09-01T15:14:14+07:00
inputs_read:
  - .ai/board/tickets/TEA-05/01-plan.md
  - .ai/board/tickets/TEA-05/ticket.yaml
  - .ai/standards/testing-standards.md
  - .ai/standards/coding-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/templates/impl-log.md
  - .ai/registry/rules.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/seed.sql
  - src/lib/domain/types.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/fixtures.ts
  - src/App.tsx
  - src/routes/SignUp.tsx
  - src/routes/AllowList.tsx
  - src/routes/MemberList.tsx
  - tests/seam-parity.test.ts
  - tests/e2e/smoke.spec.ts
  - tests/e2e/tea-01-signup.spec.ts
  - eslint.config.js
  - tsconfig.json
  - playwright.config.ts
  - node_modules/.pnpm/@supabase+auth-js@2.112.4/node_modules/@supabase/auth-js/dist/module/GoTrueClient.d.ts
  - node_modules/.pnpm/@supabase+auth-js@2.112.4/node_modules/@supabase/auth-js/dist/module/lib/types.d.ts
  - node_modules/.pnpm/@supabase+auth-js@2.112.4/node_modules/@supabase/auth-js/dist/module/lib/error-codes.d.ts
  # cycle 2 only, below.
  - .ai/registry/decisions/ADR-022-the-qa-stage-is-removed.md
  - .ai/board/tickets/TEA-05/04-review.md
  - .ai/board/tickets/TEA-05/06-test-report.md
  - tests/e2e/tea-05-sign-in.spec.ts
  - tests/e2e/seam.setup.ts
  - vite.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REVIEW
---

# TEA-05 — implementation log

## Files touched

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/domain/types.ts` | modified | Adds the `Membership` three-state union TEA-01's design reserved for this ticket, and one `FailureCode`, `email_not_confirmed`. Both are additive; no existing type changed and no existing caller changed. | §4.1 |
| `src/lib/data/index.ts` | modified | Declares `SignInInput` and the four seam functions on `DataSeam`. No existing signature touched. | §4.2 |
| `src/lib/data/supabase.ts` | modified | The real implementation of all four, plus the `email_not_confirmed` arm of the existing `toFailure`. The event union is dropped at the boundary rather than passed up. | §4.1, §4.2 |
| `src/lib/data/mock.ts` | modified | The mock implementation of all four. The mock **stops fabricating an identity**: `currentMemberId` no longer starts at `FIXTURE_ADMIN` but follows a session that `signIn` establishes and `signOut` clears. | §5 |
| `src/lib/fixtures.ts` | modified | `FIXTURE_MEMBER_LESS`, `FIXTURE_CREDENTIALS`, `FIXTURE_PASSWORD` and `FIXTURE_UNCONFIRMED` (see Deviations). The mock's `signIn` answers from this list and from nothing else, so its refusals are the seed's refusals. | §5.1 |
| `src/hooks/useSession.ts` | created | Where the session is read on the client, and the only place above the seam that reads it. Resolves the three states in the order §4.3 gives, subscribes, and unsubscribes on cleanup. | §4.3 |
| `src/routes/SignIn.tsx` | created | AC-1, AC-2, AC-3. Four fields' worth of screen and one error line; the message comes from the seam so this file cannot compose a sentence that tells an unknown address from a wrong password. | §4.4 |
| `src/routes/NotOnATeam.tsx` | created | AC-4, AC-6. The member-less screen, and the sign-out control that is the only way out of that state. It says nothing about the allow-list because it cannot know and must not appear to guess. | §4.4 |
| `src/routes/Home.tsx` | created | AC-1, AC-6, AC-10. Own `display_name`, `avatar` and `role`, a sign-out control, and the one admin-only `/allow-list` link. No team name and no board. | §4.4, §6 |
| `src/App.tsx` | modified | One `useSession()` call and the routing table of §4.4, including `app-session-loading` and the catch-all moving from `→ /signup` to `→ /`. `app-root` and `seam-banner` keep their names and positions. | §4.4 |
| `supabase/seed.sql` | modified | Three `auth.users` rows and one `member` row: `FIXTURE_MEMBER`'s missing seed (the drift §5.1 found), `FIXTURE_MEMBER_LESS`'s, and `FIXTURE_UNCONFIRMED`'s. | §5.1 |

**One file in `allowed_paths` was deliberately not created** — `tests/e2e/tea-05-sign-in.spec.ts`. It
is the acceptance suite, which is QA's from the story and the §8 selector table, and explicitly not
the Developer's: RULE-05 exists because a test written against the implementation passes against the
parts of the implementation that are wrong. `allowed_paths` permits a file, it does not commission
one, and TEA-04's log records the same split for the same reason. **ADR-021 re-armed the QA gate on
2026-09-01, so unlike TEA-02, TEA-03 and TEA-04 this suite will actually be written** — see Open
questions for what it will hit.

## Contract items

| § item | Implemented at | Notes |
|--------|----------------|-------|
| §4.1 — `Membership` | `src/lib/domain/types.ts:42` | Verbatim from the design, including the three arms and their payloads. |
| §4.1 — `email_not_confirmed` | `src/lib/domain/types.ts:62` | Added to the open union. Verified on disk in `@supabase/auth-js@2.112.4` `lib/error-codes.d.ts`, not recalled. |
| §4.1 — no other type changes | `Member`, `AuthUser`, `Session`, `Result` untouched | §7's sizing test, and it holds: no existing caller changed. |
| §4.2 — `SignInInput` | `src/lib/data/index.ts:27` | |
| §4.2 — `getSession` declared / real / mock | `index.ts:167`, `supabase.ts:446`, `mock.ts:407` | Null is a normal answer. In the real one an error folds into the same null, the way `readCurrentMember` already folds `AuthSessionMissingError`. |
| §4.2 — `onAuthStateChange` declared / real / mock | `index.ts:184`, `supabase.ts:463`, `mock.ts:418` | Takes `Session \| null` and **not** `AuthChangeEvent`: that union is a Supabase type and would be datastore vocabulary above the seam. Returns a real unsubscribe in both. |
| §4.2 — `signIn` declared / real / mock | `index.ts:194`, `supabase.ts:480`, `mock.ts:440` | One message for an unknown address and a wrong password (AC-2); its own for AC-3. Neither implementation looks the address up first, so neither can become an enumeration oracle. |
| §4.2 — `signOut` declared / real / mock | `index.ts:201`, `supabase.ts:493`, `mock.ts:474` | `Result<void>`; a failure is returned rather than thrown. |
| §4.2 — the API verified on disk, not recalled | see `inputs_read` | Every row of the design's verification table was re-checked against the installed `2.112.4`: `signInWithPassword` `GoTrueClient.d.ts:589`, `signOut` `:2033`, `getSession` `:1479`, `onAuthStateChange` `:2045`, `Subscription.unsubscribe` `lib/types.d.ts:531`, the event union `lib/types.d.ts:15`. All confirmed. |
| §4.3 — `SessionState` and `useSession()` | `src/hooks/useSession.ts:19`, `:33` | The interface as designed, including `resolving`. |
| §4.3 — resolution order 1→2→3 | `src/hooks/useSession.ts:47-68` | `getSession` then `getCurrentMember`; null at step 2 is `member-less`, which is AC-4's whole mechanism. |
| §4.3 — `resolving` false after the first resolution and false thereafter | `src/hooks/useSession.ts:73` | A later change re-resolves without returning the screen to a spinner. |
| §4.3 — subscription created in an effect, returned function called on cleanup | `src/hooks/useSession.ts:77-87` | |
| §4.3 — `useSession()` called exactly once, in `App.tsx`, result passed as props | `src/App.tsx:23` | One call site in the repository; `grep -c "useSession(" src/**` is 1 outside the hook. |
| §4.4 — `SignIn.tsx` | `src/routes/SignIn.tsx` | On success it renders nothing of its own and performs no navigation; the listener fires and `App.tsx` routes away. |
| §4.4 — `NotOnATeam.tsx` | `src/routes/NotOnATeam.tsx` | Carries a sign-out control. Says nothing about the allow-list. |
| §4.4 — `Home.tsx` | `src/routes/Home.tsx` | Three values off the caller's own row, a sign-out control, one conditional link. |
| §4.4 — the routing table, all four columns × three states | `src/App.tsx:44-97` | Reproduced exactly, including `/signup` reachable in every state and the catch-all `→ /`. |
| §4.4 — `app-root` and `seam-banner` keep names and positions | `src/App.tsx:27`, `:35` | `tests/e2e/smoke.spec.ts` passes unedited, which is why it is absent from `allowed_paths`. |
| §4.4 — `/allow-list` and `/members` not guarded | `src/App.tsx:88`, `:91` | Unchanged entries. Neither file was opened for edit; neither is in `allowed_paths`. |
| §5 — four functions in `DataSeam` and both implementations, same name and arity | `tests/seam-parity.test.ts` passes **unedited** | 2 tests, both green. |
| §5 — no existing seam function changed | eight prior functions untouched | `getCurrentMember()` is called by §4.3 exactly as `AllowList.tsx` and `MemberList.tsx` already call it. |
| §5 — the mock's five rows of behaviour | `src/lib/data/mock.ts:440-478` | Each of the five rows in the design's table, in that order. |
| §5 — expiry not modelled in the mock | `src/lib/data/mock.ts:412-417` | Stated at the call site, not only in the plan. |
| §5 — `__setCurrentMember` stays, now redundant | `src/lib/data/mock.ts:120` | Kept, and the comment now says it moves the member and not the session, so a caller using it chooses a state the application cannot reach. |
| §5.1 — `FIXTURE_CREDENTIALS`, `FIXTURE_MEMBER_LESS` | `src/lib/fixtures.ts:220`, `:157` | |
| §5.1 — the `FIXTURE_MEMBER` drift repaired | `supabase/seed.sql:330-362` | Confirmed before the edit: `grep -c '55555555-5555-4555-8555-555555555555' supabase/seed.sql` was 0. It is now 2 — an `auth.users` row and a `member` row. |
| §5.1 — MD-014's four token columns set to `''` | `supabase/seed.sql:334`, `:368`, `:391` | On all three new accounts. This is the ticket where that defect bites hardest. |
| §6 — `schema_delta: none`, condition discharged | `src/routes/Home.tsx` | The screen reads `display_name`, `avatar` and `role` off the caller's own row and **nothing else**; `grep -rn "team" src/routes/Home.tsx` finds no read of `public.team`. No migration was written and `supabase/migrations/` was not opened. |
| §8 — the twelve selectors | see the Testability contract table below | All present. Nothing beyond the table was added — see Deviations item 3. |

## Deviations from the design

Three, all declared, and the first is the only one that adds anything the plan did not name.

**1. `FIXTURE_UNCONFIRMED`, and a third seeded account.** `src/lib/fixtures.ts:175`,
`supabase/seed.sql:386-407`. §5's mock table requires *"an address flagged unconfirmed in the
fixture"* for AC-3, and §5.1 scopes `FIXTURE_CREDENTIALS` to **seeded** addresses — but none of the
seeded accounts is unconfirmed, and §5.1 enumerates two new seed rows, neither of which is one. The
two sentences cannot both be satisfied without a third account, and the alternative was a fixture
flag with no seed row behind it, which is precisely the drift §5.1 exists to repair, one file over.
So: one more `auth.users` row, `email_confirmed_at` NULL, no `member` row (the trigger returns early
on a null value), and a matching `FIXTURE_UNCONFIRMED` in the fixture module. **It is the row that
makes AC-3 observable at all**, in the mock and against a real project alike.

**2. The mock's `currentMemberId` starts at `null` rather than at `FIXTURE_ADMIN.id`.**
`src/lib/data/mock.ts:110`. §5 says the mock "stops fabricating and starts implementing" and that
`signIn` "sets the current session", but does not say what happens to the seeded identity that
existed only because no session could be established. Leaving it seeded would have made the mock
answer `getCurrentMember()` as an admin with nobody signed in, which breaks AC-4 (a member-less
sign-in would land on `Home`) and makes AC-11's roster assertion pass by accident. It also brings the
mock into line with the real seam, where `getCurrentMember()` returns null with no session — so
`/allow-list` and `/members` now fail safe against **both** implementations rather than only against
Supabase. This is a behaviour change for those two screens under the mock, and it is the correct
one; neither file was edited.

**3. No `data-testid` on the sign-in `<form>`.** `src/routes/SignIn.tsx:59-62`. `SignUp.tsx` carries
`signup-form`, so the symmetry is tempting. §8 does not name one, and RULE-05 makes that table the
only channel a selector reaches QA through — an extra one is a selector QA cannot address and a
reviewer has to reconcile. `sign-in-submit` is what §8 says asserts *"the sign-in screen"* for AC-5
and AC-9, and it does. Recorded because the absence is deliberate and reads as an omission.

## Invariants

| ID | Still holds because |
|----|---------------------|
| `INV-04` | **Nothing in this ticket writes `public.member` on any path.** `grep -n "from(\"member\")" src/lib/data/supabase.ts` returns four statements — two reads and TEA-04's two updates — and no new one; the two functions this ticket adds to that file, `signIn` and `signOut`, touch `auth` only. The mock is the same claim in the other implementation: `signIn` returns on one of three branches and `members` is not named on any of them, so a refused sign-in, a successful one, and a sign-in by somebody with no member row all leave the array identical. The sole writer of that table is still the `admit_allow_listed_member` trigger on `auth.users`, which fires on `email_confirmed_at` and not on sign-in, and `public.member` still has no insert policy. The denominator therefore cannot move, and AC-11 is that behaviour having been chosen rather than assumed — which is the reason the plan listed the invariant despite the feature row saying `[]`. |

## Verification run

| Command | Exit | Notes |
|---------|------|-------|
| typecheck — `pnpm exec tsc --noEmit` | 0 | |
| lint — `pnpm exec eslint .` | 0 | Includes the RULE-02 rule. No new file imports `@supabase/*`; the two that could have — `useSession.ts` and `App.tsx` — go through `@/lib/data`. |
| unit — `pnpm exec vitest run` | 0 | 1 file, 2 tests. `tests/seam-parity.test.ts` passes **unedited** with four functions added, which is §5's stated requirement. |
| end-to-end — `pnpm exec playwright test`, seam pinned to the mock by `VITE_DATA_SEAM=mock` | 0 | 10 tests in 2 files, **all pass**. On `main` six of these fail (MD-021), and they fail for BUG-001's reason and not for a reason in this diff — see Open questions. |
| `git diff --name-only` subset of `allowed_paths` | yes | Eleven of the twelve; the twelfth is QA's and is not created. |

**The end-to-end run needed `VITE_DATA_SEAM=mock` in front of it, and that is BUG-001, not a fix for
it.** `playwright.config.ts` is untouched and is not in `allowed_paths`. The variable was supplied on
the command line for the verification above so that this ticket's diff could be judged against
something other than the live project; nothing in the repository now pins the seam, and a plain
`pnpm exec playwright test` on this machine still resolves to Supabase because a `.env` carrying
`VITE_SUPABASE_URL` is present.

## Testability contract

| selector | Exists at |
|----------|-----------|
| `app-root` | `src/App.tsx:27` — unchanged name and position |
| `seam-banner` | `src/App.tsx:35` — unchanged name and position |
| `app-session-loading` | `src/App.tsx:49` |
| `sign-in-email` | `src/routes/SignIn.tsx:72` |
| `sign-in-password` | `src/routes/SignIn.tsx:85` |
| `sign-in-submit` | `src/routes/SignIn.tsx:102` |
| `sign-in-error` | `src/routes/SignIn.tsx:96` |
| `not-on-a-team` | `src/routes/NotOnATeam.tsx:37` |
| `not-on-a-team-sign-out` | `src/routes/NotOnATeam.tsx:49` |
| `home-member-name` | `src/routes/Home.tsx:50` |
| `home-member-avatar` | `src/routes/Home.tsx:46` |
| `home-member-role` | `src/routes/Home.tsx:53` |
| `home-sign-out` | `src/routes/Home.tsx:79` |
| `home-allow-list-link` | `src/routes/Home.tsx:72` — rendered only when `role` is `admin` |
| `member-list-row` | `src/routes/MemberList.tsx:235` — TEA-03's, unchanged, used here only to read the roster |

Every criterion except AC-7's reload half and AC-8 was exercised against a browser during this stage,
with the seam pinned to the mock, using a throwaway suite kept **outside** the repository so that
`tests/e2e/tea-05-sign-in.spec.ts` stays QA's to write against §8 rather than against this code. Nine
checks, all passing: AC-9 from `/` and from an unrouted address, AC-5's absence of `not-on-a-team`
with no session, AC-2's two messages being one string, AC-3's distinct sentence, AC-1 and AC-10 for
an admin, AC-10's negative half for a member, AC-4 for `FIXTURE_MEMBER_LESS`, AC-6 from both screens,
and the admin link reaching `/allow-list`. The suite was deleted; it is named here so the claim is
attributable rather than asserted, and QA's own suite is what the gate will read.

## Open questions

**1. AC-7's reload half cannot pass against the mock, and §8.1 does not say so.** The plan routes
AC-3 and AC-8 to a real project because the mock has no clock; **AC-7 belongs in that list too and is
not in it**. §5's table promises *"`getSession` after `signIn` and before `signOut` → the session"*,
which is true and is a same-page-lifetime claim; AC-7 asks that a **reload** keep the session, and
the mock's session is a module-level variable in browser memory — the `seam-banner` says as much in
Vietnamese on every page. A reload signs the person out. This was observed, not reasoned: the
throwaway suite's tenth check asserted that a signed-in caller opening `/signin` is routed to `/`,
and it failed for exactly this reason, which is also why a signed-in caller cannot reach `/signin` at
all under the mock. **QA will write a test for AC-7 from §8 and it will fail against the mock**, and
that failure will be the harness rather than this implementation. Against a real project
`persistSession: true` is the client's default and both behaviours hold. Raising it here rather than
letting it arrive as a rework cycle.

**2. BUG-001 is still ahead of this ticket and the QA gate is armed.** ADR-021 §Consequences: until
BUG-001 lands, no ticket can pass the QA gate, because Definition of Done item 3 requires the suites
to exit 0 and a plain `pnpm exec playwright test` on any machine with a `.env` drives the live
project. §7 already records this. Nothing in this diff changes it, and pinning the seam here would
have been fixing another ticket's defect inside a feature branch.

**3. `.ai/standards/rbac-and-security.md:114` is still open, and the answer now exists in code.**
*"Name where the session is read on the client, and what happens on expiry"* is standards plane and
human-owned under RULE-01, so this stage could not write it. It is answered for this ticket at
`src/hooks/useSession.ts:1-13` and in §4.3: read in one place, and on expiry the client emits with a
null session, this hook re-resolves to `signed-out`, and `App.tsx` routes to the sign-in screen. A
human still owes that line, and until it is written the answer lives in a hook comment and a ticket
artifact, where the next reader will not look for it.

**4. `roleLabel` now exists twice.** `src/routes/Home.tsx:26` and `src/routes/MemberList.tsx:22`, the
same two Vietnamese labels. `MemberList.tsx` is not in this ticket's `allowed_paths`, so extracting
it was not available — the duplication is declared at the call site rather than left for a reviewer
to find. The next ticket that may touch both files should lift it into one place.

---

## Cycle 2 — 2026-09-03. What changed, and why there was a second run

**Appended, not rewritten. Everything above is cycle 1 as it stood on 2026-09-01** — including Open
question 1, which predicted this cycle's only defect and named the file it lived in.

### Why this ran at all

Cycle 1 ended `gate: PASS` and REVIEW returned `gate: PASS` on the same day
(`04-review.md:11`). What followed was not a rework routed from a verdict on this code:

- QA ran once, on this ticket, and returned `gate: FAIL` — thirteen end-to-end failures, blocked on
  BUG-001 (`06-test-report.md:10`). **Its `next_state: REWORK` no longer routes anywhere: ADR-022
  removed the QA stage the day that report was written**, so no gate carries that verdict and the
  REWORK it asked for has no producer.
- BUG-001 has since merged and `origin/main` is merged into this branch at `9f086e9`. The suite is
  now pinned — `playwright.config.ts` sets `VITE_DATA_SEAM=mock` on `webServer.env`, and
  `tests/e2e/seam.setup.ts` refuses the run from the served page if it is not.

So the run that cycle 1 could only describe is now actually possible. **It was run, and it found one
real defect in this ticket's code**, distinct from the thirteen environment failures QA reported:
19 of 21 passed, and the 2 that failed were both TEA-05's.

### The defect: the mock did not reproduce AC-7, and both failures were that

| Test | Failure | Cause |
|---|---|---|
| `tea-05-sign-in.spec.ts:135` AC-7 — a reload keeps the session | `home-member-name` not found after `page.reload()` | the mock's session is module state, and a reload discards it |
| `tea-05-sign-in.spec.ts:159` AC-11 — signing in creates, updates and deletes nothing | `member-list-row` not found after `page.goto("/members")` | the same: `goto` is a full page load, so the admin is signed out before `/members` renders and the screen fails safe |

**This is cycle 1's Open question 1, arriving as predicted and resolved rather than re-declared.**
That note argued AC-7 belonged in §8.1's real-project-only list beside AC-3 and AC-8. On re-reading,
it does not, and the difference is the reason it is fixed here instead of being escalated:

- AC-3 and AC-8 are GoTrue **behaviours** — a confirmation state and a token clock. The mock has
  neither, and inventing one would be a second definition of when a session ends (§5).
- AC-7 is **storage**, and the real seam does not implement it either. `persistSession` is a
  `@supabase/auth-js` default, so the client writes the session to `localStorage` and reads it back
  on the next load — `supabase.ts:454` already says so in as many words. A mock that keeps the
  session only in memory is not "missing a clock", it is answering `null` where the real one answers
  the session, for a call §5's own table puts opposite AC-7: *"`getSession` after `signIn` and before
  `signOut` → the session"*. A reload sits inside that window.

So the mock stores it too. No plan change is owed and none was made.

### Files touched in cycle 2

| file | created/modified | why | contract item it satisfies |
|------|------------------|-----|----------------------------|
| `src/lib/data/mock.ts` | modified | `SESSION_STORAGE_KEY`, `sessionStore()`, `readStoredSession()` and `writeStoredSession()`. `currentSession` initialises from the store instead of `null`, `currentMemberId` derives from it, and `setSession` persists on the way in and clears on the way out — so `signOut` removes the stored copy in the same call that clears the in-memory one, which is AC-6 and not only AC-7. | §5, AC-7 |

Nothing else changed. `git status --porcelain` is one line.

Three things the fix is deliberately careful about, because each is a way it could have been worse
than the defect:

1. **`localStorage` is absent under vitest.** `vite.config.ts:17` sets `environment: "node"`, and
   `tests/seam-parity.test.ts:12` imports this module at the top level — so a bare `localStorage`
   reference at module load would take the unit suite down. `sessionStore()` returns `null` for both
   `typeof localStorage === "undefined"` and a store that throws on access, and every caller reads
   that as "no stored session" rather than as an error.
2. **The stored value is shape-checked, not cast.** It comes back from a store a person can edit by
   hand; a malformed one returns `null` and lands on the sign-in screen rather than rendering a
   signed-in screen for a user with no id.
3. **A blocked or full store costs persistence, not the sign-in.** `writeStoredSession` swallows its
   own failure and the in-memory session stands, so that load behaves exactly as the mock did before.

**The key is the mock's own** — `calechip.mock.session`. The real client never reads it, and the mock
never reads the client's, so the two implementations cannot end up sharing a session across a seam
switch.

### Verification run — cycle 2

Run on this branch with `origin/main` merged in, and with **no environment variable supplied on the
command line**: `playwright.config.ts` pins the seam now, which is the whole of BUG-001.

| Command | Exit | Notes |
|---------|------|-------|
| typecheck — `pnpm exec tsc --noEmit` | 0 | |
| lint — `pnpm exec eslint .` | 0 | |
| unit — `pnpm exec vitest run` | 0 | 1 file, 2 tests. `tests/seam-parity.test.ts` still passes **unedited** — the four helpers are module-local functions, not seam keys. |
| end-to-end — `pnpm exec playwright test` | 0 | **21 passed**, across `seam-guard`, `smoke`, `tea-01-signup` and this ticket's eleven. Before this fix: 19 passed, 2 failed. |
| `node scripts/check-allowed-paths.mjs` | 0 | 18 changed files against `origin/main`, all inside the twelve globs. |

**All four Definition of Done commands exit 0 on a plain invocation.** That is worth stating rather
than assuming: ADR-022 §Consequences makes `/ship` item 3 the last check on the suites, and it is the
first time in this ticket's history that the end-to-end command can be run without a variable in
front of it.

### What cycle 2 does NOT close

- **`tests/e2e/tea-05-sign-in.spec.ts` was written by the `qa` agent on 2026-09-01, and the role that
  wrote it no longer exists.** ADR-022 §Consequences: *"Nobody writes tests."* The file is in
  `allowed_paths` and was not edited here — the two failures were defects in `mock.ts`, not in the
  spec, and editing a failing test written against the plan would have been the wrong repair. It is
  named here so the next reader knows why this ticket has an acceptance suite and later ones will
  not.
- **AC-3 and AC-8 remain unprovable against the mock**, exactly as §8.1 says. The suite passes them
  by asserting the mock's own answers; neither has been observed against a real Supabase project.
  MD-014 is the standing proof that this difference is not theoretical.
- **Open questions 2, 3 and 4 above.** 2 is discharged by BUG-001 having merged. 3
  (`rbac-and-security.md:114`) and 4 (`roleLabel` duplicated at `Home.tsx:26` and
  `MemberList.tsx:22`) stand unchanged — both need a file outside `allowed_paths`.
