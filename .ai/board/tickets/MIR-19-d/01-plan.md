---
ticket: MIR-19-d
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-12T01:18:05Z
inputs_read:
  - .ai/board/tickets/MIR-19-d/ticket.yaml
  - .ai/board/tickets/MIR-19/01-plan.md
  - .ai/board/tickets/MIR-19-c/01-plan.md
  - .ai/board/tickets/MIR-19-c/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-097-an-org-address-is-served-beside-the-root-one-first-and-the-flip-is-mir-19-b.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - src/App.tsx
  - src/lib/org-path.ts
  - src/hooks/useSession.ts
  - src/lib/overdue-prompt.ts
  - src/components/OverduePrompt.tsx
  - src/components/AppShell.tsx
  - src/routes/SignUp.tsx
  - src/lib/data/mock.ts (signUp, session persistence)
  - src/lib/data/system.ts (MOCK_RESERVED_ORG_CODES)
  - docker/nginx.conf
  - tests/route-role-guards.test.ts
  - tests/org-path.test.ts
  - tests/e2e-org-prefix.test.ts
  - tests/e2e/support/org-prefix.ts
  - tests/e2e/mir-19-org-routing.spec.ts
  - tests/e2e/evt-14-guest-sign-in.spec.ts
  - tests/e2e/ (grep for toHaveURL, page.url(), pushState and popstate; read the navigate/walkTo helper of each of the eleven pushState specs, and tsk-02 AC-10)
  - node_modules/react-router 7.18.3 dist (getUrlBasedHistory.handlePop, BrowserRouter)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-19-d — The root addresses send a member to their org

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:308`):

| ID | Feature | Group |
|---|---|---|
| MIR-19 | Every authenticated page is served under `/{org_code}` | MIR |

**Plan item:** Phase 5, *Org-scoped routing* (`.ai/board/plans/calechip-multi-tenancy-plan.md:261-283`),
ADR-097 decision 5, items 2 to 6. MIR-19 serves `/{own_org}/…` beside every root address; MIR-19-b and
MIR-19-c moved the e2e specs onto the org-prefix helper.

**The split.** ADR-097 decision 5: the slice *"plans its own count, and splits again if it is `L`"*.
Items 2 to 6 together are `L` and item 6 is a schema change. Split by operation, in decision 5's order:

- **This ticket (MIR-19-d): item 2, the flip.**
- **MIR-19-e, created at this PLAN:** items 3, 4 and 5 — email links carry the org, nginx drops `$uri/`,
  the panel's mock reserved list gains `tasks`. Three small edits outside the router.
- **MIR-19-f, created at this PLAN:** item 6 — a sign-up at `/{org_code}/signup` lands in that org
  (ADR-071 decision 1). A schema change with its own ADR, decided at its own PLAN.

**Who gains what.** An approved member who opens any root address of the app — `/`, a bookmark such as
`/month/2026-10`, an old email link such as `/events/<id>`, or the landing after signing in — is moved
to the same address under their own org (`/shared/…` for every member of Org public), and the address
bar from then on shows the org they are working in. This is what makes Phase 5's exit criterion
*"Every authenticated page lives under `/{org_code}`"* true for members: after MIR-19 an org address
worked, but nothing sent anybody to it.

**What stays at the root (ADR-097 decisions 1, 5.2 and 6).** A signed-out caller, an `undecided`
(pending) caller and a `member-less` caller. The account addresses `/signin` and `/signup`, and the guest
links `/guest/…`, for everybody.

**Signing up (decision 5.2's third verb).** Every sign-up creates a *pending* member row
(`src/lib/data/mock.ts:1692-1708`, the SOLO 2026-09-10 rewrite of `admit_allow_listed_member`), so a
sign-up never produces an approved member. `SignUp.tsx:130` hands a live session to `/`, which then
resolves by membership; a pending caller stays at `/` (decision 5.2), and an approved one would be
sent on by the same catch-all as AC-1. No code is specific to sign-up, and the e2e build pins Confirm
email ON (`playwright.config.ts`), so no hand-over is drivable. Sign-up *into an org* is MIR-19-f.

**The pushState specs, counted as MIR-19-c asked.** Eleven specs move a signed-in member by
`window.history.pushState` + a `popstate` to an org-less address: evt-03, evt-06, evt-07, evt-09,
evt-10, evt-11, evt-14, solo-approval-settings, solo-busy-day, tsk-02, uie-12. **None is edited.** The
flip answers a popstate to an org-less address by rewriting that history entry to the org address
*before the router reads it* (§ 4.3), so the router lands on `/shared/<same path>` with the same base,
nothing remounts, and the mock's module state and every component's state survive exactly as they do
today. tsk-02 AC-10 is the spec that proves the "nothing remounts" half: its overdue prompt is claimed
once per page load in module state (`src/lib/overdue-prompt.ts:13-22`), so a remounted shell would never
show it again (§ 8 alternative 1). evt-09:197 pushes the page's own pathname (`/shared/events/<id>`
after the flip), which needs no rewrite.

**The specs whose subject is the landing.** `evt-14-guest-sign-in` asserts four exact member landings
(`:295`, `:335`, `:342`, `:349`) — edited here. Its `:289` (`/signin?next=…`, signed out), `:309` and
`:322` (the guest page, root by decision 6) and `:358` (`/signup`, signed out) stay true and are not
edited. `mir-19-org-routing.spec.ts` AC-11 (*"the root addresses are unchanged"*) is the criterion this
ticket reverses; it is rewritten to the flip (§ 4.5).

**Out of scope:**

- Email links carry the org (`supabase/functions/send-event-email/template.ts:269`). → **MIR-19-e.**
  Until then an email link opens `/events/<id>` and the flip carries a member on to
  `/shared/events/<id>`, so it keeps working.
- nginx's `try_files $uri $uri/` (`docker/nginx.conf:79`). → **MIR-19-e.**
- `tasks` on the system panel's mock reserved list (`src/lib/data/system.ts:758`). → **MIR-19-e.**
- A sign-up at `/{org_code}/signup` landing in that org (ADR-071 decision 1); schema and ADR.
  → **MIR-19-f.** Until then `/shared/signup` crosses out to `/signup` as MIR-19 AC-9 shipped it.
- Moving `undecided` or `member-less` callers under an org. Decision 5.2 keeps them at the root.
- Guest links under an org. Decision 6.
- Editing any of the eleven pushState specs, the ten history-walk specs (MIR-19-c) or the nine
  href specs (MIR-19-b). They must pass unedited — AC-12. **One exception:** `cal-08-holiday-shading`'s
  two walks for an admin placed in the dedicated org (§ 4.5, AC-14).
- An HTTP redirect. The flip is client-side; the server still serves `index.html` for every path.
- The `features.md` row. It stays `PLANNED` until MIR-19-f ships.

`size_estimate`: **M**.

## 2. Acceptance criteria

Terms. **Member:** `thanh@example.com`, an approved member of Org public, whose org code is `shared`
(ADR-097 *Consequences*). **Member-less:** `hoa@example.com`, a session with no member row. **Org
address:** `/shared` + a root path. *"Is at X"* means `new URL(page.url()).pathname` equals X once the
named screen is visible.

**AC-1: the landing is the org address**
- Given the member, signed in
- When they open `/`
- Then they are at `/shared`, and the current week is shown (`week-anchor`) inside the shell
  (`home-member-name`).

**AC-2: every org-less app address keeps its path and its query**
- Given the member, signed in
- When they open `/month/2026-10`, `/admin`, `/events`, and `/events?probe=1`
- Then they are at `/shared/month/2026-10` (`month-grid` shown), `/shared/admin`, `/shared/events`
  (`events-new-button` shown), and `/shared/events` with `search` equal to `?probe=1`.

**AC-3: signing in lands under the org**
- Given nobody is signed in, at `/signin`
- When the member signs in
- Then they are at `/shared` with the week shown.
- And given nobody is signed in at `/signin?next=%2Fevents`, when the member signs in there, they are at
  `/shared/events`.

**AC-4: a member already signed in at `/signin` is sent on under the org**
- Given the member, signed in
- When they open `/signin`, and then `/signin?next=%2Fevents`
- Then they are at `/shared`, and then at `/shared/events`. Neither shows the sign-in form.

**AC-5: the flip adds no history entry**
- Given the member, signed in, who opened `/month/2026-10` and is at `/shared/month/2026-10`
- When they follow `home-year-link` to `/shared/year` and press the browser's Back
- Then they are at `/shared/month/2026-10`, never at `/month/2026-10`.

**AC-6: a popstate to an org-less address lands under the org, and the shell is not remounted**
- Given the member at `/shared` with the shell shown
- When `window.history.pushState({}, "", "/events")` runs, followed by a `popstate` event on `window`
- Then they are at `/shared/events` with `events-new-button` shown, and the `home-member-name` element
  that was on the page before the push is still connected to the document (the same element, not a
  new one).

**AC-7: an address the app does not route still ends on the org landing, without a loop**
- Given the member, signed in
- When they open `/x/such/page` (a first segment that cannot be an org code: one character), and then
  `/guest` (a root-only first segment with no token)
- Then each time they are at `/shared` with the week shown.
- An unrouted address whose first segment *is* org-shaped (`/no/such/page`) is not flipped: it is
  another org's address and shows `org-not-found`, as MIR-19 AC-4 requires for `/no-such-org`.

**AC-8: the account and guest addresses stay at the root for a member**
- Given the member, signed in
- When they open `/signup`, and then `/guest/` followed by 64 zeros
- Then they are at `/signup` with `signup-form` shown, and then at `/guest/000…0` (64 zeros) with
  `guest-event-not-found` shown.

**AC-9: the callers who are not approved members stay at the root**
- Given the member-less caller, signed in
- When they open `/`, and then `/month/2026-10`
- Then they are at `/` with `not-on-a-team` shown, and then at `/month/2026-10` with
  `month-not-on-a-team` shown.
- And given nobody is signed in, when `/` is opened, they are at `/signin` with the sign-in form.

**AC-10: MIR-19 AC-11 is rewritten to the flip**
- Given `tests/e2e/mir-19-org-routing.spec.ts`
- When it is read
- Then the test named `AC-11 …` asserts that the member opening `/`, `/month/2026-10`, `/admin` and
  `/events` is at `/shared`, `/shared/month/2026-10`, `/shared/admin` and `/shared/events`, and its title
  says it was amended by MIR-19-d. Its AC-1 to AC-10 are not edited and pass.

**AC-11: EVT-14's member landings are under the org**
- Given `tests/e2e/evt-14-guest-sign-in.spec.ts`
- When it runs
- Then the four member landings (`:295`, `:335`, `:342`, `:349` at `origin/main` ad49668) expect
  `/shared/events/<id>`, `/shared`, `/shared` and `/shared/events`, and every test in the file passes.
  No other line of the file changes except one import.

**AC-12: everything else passes unedited**
- Given this ticket's commit
- When `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm exec playwright test` run
- Then all pass. No spec file other than the four in § 7 is in the diff; none is skipped, `fixme`'d or
  deleted; each existing spec keeps its test count. This covers the eleven pushState specs, the
  history-walk specs, `tests/route-role-guards.test.ts` and `tests/e2e-org-prefix.test.ts`.

**AC-14: a dedicated-org admin's history walk in cal-08 stops at his own org address**
- Given `tests/e2e/cal-08-holiday-shading.spec.ts` `AC-9 and AC-10` and `AC-14`, which place the admin
  in the mock's dedicated org (`placeAdminInDedicatedOrg`, code `acme`), so the flip lands him at
  `/acme/month/2026-09`
- When the spec runs
- Then both tests pass. The only change in the file is the path the two `backTo` calls after
  `addHoliday` walk to (`/month/2026-09` → `/acme/month/2026-09`), with one comment line above each.
  `backTo`, `appPathname`, every assertion, the loop bound and the test count are unchanged.

**AC-13: `ownOrgAddress` maps a root address to the org address, and leaves alone what must stay**
- Given `ownOrgAddress` (§ 4.1)
- When `pnpm test` runs `tests/org-path.test.ts`
- Then every example in § 4.1's docblock holds.

**Invariants touched:** `[]`. This ticket routes. It writes no entry, computes no count and changes no
screen's reads, so INV-01 to INV-07 are unaffected. Every read stays bounded by the MIR-13 policies.

**Open questions:** none. ADR-097 decisions 1, 5.2 and 6 settle who moves, who stays and how the base
moves.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

There is no layout. This ticket adds no screen, element or selector; it changes which address a screen
is shown at.

## 3. Permission model

| Action | Who | Where the check lives |
|---|---|---|
| Be sent from a root address to `/{org_code}/…` | an approved, non-removed member whose `own_org_code()` is not `null` | **Affordance only**, in `App.tsx`. The code is the one the database returned (`useSession().orgCode`, MIR-19 § 4.4); the URL is never sent to the database. Every read the screen then makes is bounded to the caller's org by the MIR-13 policies. |
| Stay at the root | signed-out, `undecided`, `member-less`; and anybody at `/signin`, `/signup`, `/guest/…` | `App.tsx`: the flip is off unless `membership.state === "member"` and `orgCode !== null`. |

**Denials.**
- The flip never sends anybody to an org other than the one `own_org_code()` returned. It takes no org
  from the URL.
- A pending or member-less caller is never sent to an org address (AC-9).
- A member whose `orgCode` is `null` (the read raced a removal) is not flipped and sees the root
  screens as before this ticket; the database still answers their reads as it would at any address.
- No guard is added or removed on any route. `shellRoutes` is placed in the route tables exactly as
  MIR-19 wrote it.

## 4. Contract

### 4.1 `src/lib/org-path.ts` — two exports added, nothing else changed

Appended after `routerBase`. The module still imports nothing.

```ts
/** MIR-19-d, ADR-097 decisions 1 and 6. First path segments that stay at the root for everybody:
 *  the two account addresses and the guest links. */
export const ROOT_ONLY_SEGMENTS: readonly string[] = ["signin", "signup", "guest"];

/**
 * MIR-19-d, ADR-097 decision 5.2. The address a member of `orgCode` is sent to from the root address
 * `pathname` + `suffix`: `orgPath(orgCode, pathname) + suffix`. `null` when that pathname is not sent:
 * its first segment is an org code (`splitOrgPath(pathname).orgCode !== null`), or is in
 * ROOT_ONLY_SEGMENTS. `suffix` is the search and the hash, appended unchanged.
 *
 * ownOrgAddress("shared", "/", "") === "/shared"
 * ownOrgAddress("shared", "/month/2026-10", "?team=x") === "/shared/month/2026-10?team=x"
 * ownOrgAddress("shared", "/events", "?probe=1#top") === "/shared/events?probe=1#top"
 * ownOrgAddress("shared", "/x/such/page", "") === "/shared/x/such/page"
 * ownOrgAddress("shared", "/signin.html", "") === "/shared/signin.html"
 * ownOrgAddress("shared", "/no/such/page", "") === null   (org-shaped first segment: MIR-19 AC-4)
 * ownOrgAddress("shared", "/signin", "?next=%2Fevents") === null
 * ownOrgAddress("shared", "/signup", "") === null
 * ownOrgAddress("shared", "/guest", "") === null
 * ownOrgAddress("shared", "/guest/abc", "") === null
 * ownOrgAddress("shared", "/shared/week", "") === null
 * ownOrgAddress("shared", "/acme/week", "") === null
 */
export function ownOrgAddress(orgCode: string, pathname: string, suffix: string): string | null;
```

The first segment is the text between the leading `/` and the next `/` (empty for `/`).

### 4.2 `src/App.tsx` — the root route table in flip mode

In `App()`, after the `useSession()` call:

```tsx
// MIR-19-d, ADR-097 decision 5.2. The org a root address sends this caller to; null turns the flip off.
const ownOrg: string | null = membership.state === "member" ? orgCode : null;
```

Inside `<Routes>`, the `base === "/"` arm becomes:

```tsx
<>
  {/* the BareLayout block (/signup, /guest/:token, /guest/registration/:token, /signin): unchanged */}
  {ownOrg === null ? (
    <>
      <Route path="/:orgCode/*" element={<EnterOrg onEnter={syncBase} />} />
      {shellRoutes}
    </>
  ) : (
    <Route path="*" element={<EnterOwnOrg orgCode={ownOrg} cross={cross} syncBase={syncBase} />} />
  )}
</>
```

The `base !== "/"` arm is not changed. `shellRoutes` and every comment inside it are not changed
(`tests/route-role-guards.test.ts` reads that text).

**`EnterOwnOrg`**, a module-level component beside `EnterOrg`, not a new file:

```tsx
/** MIR-19-d, ADR-097 decision 5.2. The root router's catch-all for a member with an org code. */
function EnterOwnOrg({
  orgCode,
  cross,
  syncBase,
}: {
  orgCode: string;
  cross: (path: string) => void;
  syncBase: () => void;
}): JSX.Element | null;
```

Reading `const { pathname, search, hash } = useLocation()`:

1. `splitOrgPath(pathname).orgCode !== null` (reached by a `<Navigate>` inside the root router, e.g.
   `AfterSignIn` to `?next=/shared/week/…`): call `syncBase()` in an effect and render `null` — what
   `EnterOrg` does.
2. else `ownOrgAddress(orgCode, pathname, search + hash)` is `null` (a root-only first segment no root
   route matched, e.g. `/guest`, `/signin/x`): render `<Navigate to="/" replace />`. `/` then matches
   this route again and takes branch 3. **Without this branch `/guest` would loop**: sent to
   `/shared/guest`, crossed back out to `/guest` by MIR-19's `LeaveOrg`, and so on (AC-7).
3. else call `cross(target)` in an effect and render `null`. `cross` replaces the history entry
   (MIR-19 § 4.5), so the flip adds none (AC-5).

Only `EnterOwnOrg` renders while the flip is on and the path is not a root-only route, so the shell is
never mounted under the root router for a member with an org code: it mounts once, under `/shared`.

### 4.3 `src/App.tsx` — the `popstate` listener

The existing effect that adds `syncBase` as a `popstate` listener is replaced by:

```tsx
useEffect(() => {
  const onPopState = (): void => {
    if (ownOrg !== null) {
      const { pathname, search, hash } = window.location;
      const target = ownOrgAddress(ownOrg, pathname, search + hash);
      if (target !== null) window.history.replaceState(window.history.state, "", target);
    }
    syncBase();
  };
  window.addEventListener("popstate", onPopState, true);
  return () => window.removeEventListener("popstate", onPopState, true);
}, [ownOrg, syncBase]);
```

**Why `capture: true`.** react-router's `handlePop` reads `window.location` when it runs
(`getUrlBasedHistory`, `history.location` getter, react-router 7.18.3
`dist/development/chunk-BV7QT456.mjs:294-302` and `:341-343`). Both listeners are on `window`, so the event
is at its target, where capturing listeners run before non-capturing ones (DOM Standard, *dispatch*;
Chromium 89+). This listener therefore rewrites the entry first, and the router reads
`/shared/events` rather than `/events`. The base is unchanged (`/shared`), `BrowserRouter`'s `key` is
unchanged, and nothing remounts (AC-6). Registration order cannot decide this: `BrowserRouter`
re-subscribes on every remount, so it is sometimes before and sometimes after `App`'s listener.
`window.history.state` is passed through, so react-router's `idx` and `usr` survive (evt-09 hands state
in this way). TODO(verify): the Developer confirms the ordering by AC-6 and tsk-02 AC-10 passing, not
by reading.

### 4.4 `tests/org-path.test.ts` — one `describe` appended

`describe("MIR-19-d ownOrgAddress", …)` with one `it` per example in § 4.1's docblock, and one asserting
`ROOT_ONLY_SEGMENTS` equals `["signin", "signup", "guest"]`. Add `ownOrgAddress` and `ROOT_ONLY_SEGMENTS`
to the existing import from `../src/lib/org-path` (`tests/org-path.test.ts:5-11`). No
existing `describe` or `it` is edited.

### 4.5 E2E specs

**`tests/e2e/mir-19-d-flip.spec.ts` (new).** One `test` per AC-1 to AC-9, titled `AC-n: …` under
`test.describe("MIR-19-d the root addresses send a member to their org", …)`. Helpers copied in the shape
of `mir-19-org-routing.spec.ts:15-26` (`signInAt`, `signedInMember`; password `password123`). The
session survives `page.goto` (the mock stores it in `localStorage`), so tests address the app by URL,
except AC-5 (Back) and AC-6 (pushState), which must not reload. AC-6 takes
`const before = await page.getByTestId("home-member-name").elementHandle()` before the push and asserts
`await before!.evaluate((el) => el.isConnected)` is `true` after `events-new-button` is visible.
Pathnames are read raw (`new URL(page.url()).pathname`): the subject is the exact address.

**`tests/e2e/mir-19-org-routing.spec.ts`.** Only the `AC-11` test changes. Title:
`"AC-11 (amended by MIR-19-d): a root address sends a member to the same address under the org"`. Body:
the same four `page.goto`s, the same visibility waits, and the expected pathnames `/shared`,
`/shared/month/2026-10`, `/shared/admin`, `/shared/events` (each `/admin` and `/events` read through
`expect.poll`, since they have no visibility wait today). The header comment gains one line:
`// MIR-19-d: AC-11 now asserts the flip (ADR-097 decision 5.2).`

**`tests/e2e/evt-14-guest-sign-in.spec.ts`.** Add
`import { E2E_ORG_CODE } from "./support/org-prefix";` after the `@playwright/test` import. Then exactly:

| Line (ad49668) | Before | After |
|---|---|---|
| `:295` | ``toHaveURL(`/events/${id}`)`` | ``toHaveURL(`/${E2E_ORG_CODE}/events/${id}`)`` |
| `:335` | `toHaveURL("/")` | ``toHaveURL(`/${E2E_ORG_CODE}`)`` |
| `:342` | `toHaveURL("/")` | ``toHaveURL(`/${E2E_ORG_CODE}`)`` |
| `:349` | `toHaveURL("/events")` | ``toHaveURL(`/${E2E_ORG_CODE}/events`)`` |

Test titles are not changed (they name EVT-14's criteria, whose `/` is now the landing the flip
forwards). No other line changes.

**`tests/e2e/cal-08-holiday-shading.spec.ts`** (added 2026-11-12, second question). Exactly two call
sites change, at `ad49668` `:407` (test `AC-9 and AC-10`) and `:547` (test `AC-14`):

```ts
// before
await backTo(page, "/month/2026-09");
// after
// MIR-19-d: this admin is in the dedicated org, so the flip lands him under /acme, which appPathname does not strip.
await backTo(page, "/acme/month/2026-09");
```

Nothing else in the file changes: not `backTo`, not `placeAdminInDedicatedOrg`, not `openAs(…,
"/month/2026-09")` (a root address, which the flip carries to `/acme/…`), and not the import.
`tests/e2e/support/org-prefix.ts` is not edited (§ 8 alternative 5).

## 5. Seam impact

None. No function in `src/lib/data/` is added, removed or changed. `getOwnOrgCode()` (MIR-19) is read
through `useSession` as today.

## 6. Schema delta

`none`. No migration, function, policy, trigger or constraint. Item 6's schema change is MIR-19-f's,
with its own ADR.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/board/tickets/MIR-19-e/ticket.yaml"
  - ".ai/board/tickets/MIR-19-f/ticket.yaml"
  - "src/App.tsx"
  - "src/lib/org-path.ts"
  - "tests/org-path.test.ts"
  - "tests/e2e/mir-19-d-flip.spec.ts"
  - "tests/e2e/mir-19-org-routing.spec.ts"
  - "tests/e2e/evt-14-guest-sign-in.spec.ts"
  - "tests/e2e/cal-08-holiday-shading.spec.ts"
```

Nine paths (eight at first PLAN; cal-08 added by the second question, Changelog), so `size: M`, matching `size_estimate: M`. It was predicted `L` at `/plan MIR-19-c` for
items 2 to 6 together; taking item 2 alone, and finding that none of the eleven pushState specs needs an
edit (§ 1), is what brings it to `M`.

- **MIR-19-e and MIR-19-f `ticket.yaml` are written at this PLAN**, at `BACKLOG`. MIR-19-e carries items
  3 to 5 and depends on MIR-19-d; MIR-19-f carries item 6, `requires_adr: true`, and depends on MIR-19-e.
  Nothing further is owed on either at IN_PROGRESS.
- **No dependant changes.** No `ticket.yaml` names MIR-19-d in `depends_on` (checked across
  `.ai/board/tickets/*/ticket.yaml` on 2026-11-12). The IDs `MIR-19-e`, `MIR-19-f` and the file
  `mir-19-d-flip.spec.ts` are not in use (checked against `git branch -a` and `.ai/`).
- **No ADR.** ADR-097 decisions 1, 5.2 and 6 decide the flip; this ticket chooses only how it is wired.
- `glossary_owed` is `[]`, so no glossary row is written.

## 8. Rejected alternatives

1. **Flip on popstate through the route table, as `EnterOrg` does** — let the root router mount at the
   org-less address and cross from a route element. One mechanism instead of two. Rejected: every
   popstate to an org-less address would move the base `/shared` → `/` → `/shared`, and `BrowserRouter`
   is keyed by the base, so the whole shell remounts twice. tsk-02 AC-10 then fails: `OverduePrompt`
   claims the prompt once per page load in module state (`src/lib/overdue-prompt.ts:13-22`), so the
   remounted prompt never opens. Any other state a screen holds across a client-side navigation is lost
   the same way. ADR-097 decision 5.1 requires the specs to pass across the flip, not to be rewritten
   around it.
2. **Rewrite the entry in a normal (bubbling) popstate listener and dispatch a second `popstate`** so
   the router re-reads. Order-independent on paper. Rejected: the router first commits the org-less
   location, which under basename `/shared` matches no route, and whether React folds that render into
   the second one depends on batching inside a nested synthetic event. A blank frame there unmounts the
   shell — alternative 1's failure, intermittently.
3. **Give a member a fixed base `/{orgCode}` from the session rather than from the URL**, and rewrite any
   org-less URL before the router renders. Rejected: it reverses ADR-097 decision 1 (*"the router's
   `basename` is the org segment of the URL"*) and breaks MIR-19 AC-4/AC-6, where a member at another
   org's address must be shown `org-not-found` at that address.
4. **Take items 2 to 5 together, leaving only item 6.** Items 4 and 5 are one line each. Rejected:
   item 3 needs the edge function to learn an event's org code, which is its own design and its own
   tests in `supabase/functions/`, and bundling it makes this ticket's diff two operations. Splitting
   by operation is the operating model's first rule.

5. **For cal-08, widen `stripOrg` to strip `acme` as well**, so `appPathname` hides every mock org.
   Rejected: `tests/e2e/support/org-prefix.ts:9-12` deliberately strips only `shared`, because *"a spec
   that stripped any org-shaped segment would pass at another org's address"*; stripping `acme` too
   would let a `shared` member's walk pass at `/acme/…`, the exact error it guards against. It is also
   pinned by `tests/e2e-org-prefix.test.ts`, so it is the larger change. Two literal paths in the one
   spec that places a member in `acme` say what that spec expects.

## Changelog

- `2026-11-12T01:18:05Z`: all sections written. Scope narrowed from the ticket's title (*"The root
  addresses send a member to their org, then email links, nginx, the panel's reserved list and sign-up
  follow"*) to item 2, because the whole is `L` and item 6 is a schema change (§ 1, § 7). Items 3 to 5
  are MIR-19-e, item 6 is MIR-19-f. The pushState specs `mir_detail` asked to be counted are counted in
  § 1: none is edited, because § 4.3 rewrites the entry before the router reads it. Raised by
  `tech-lead-design`. Amended by `tech-lead-design`.
- `2026-11-12T01:27:00Z`: § 2 AC-7 and § 4.1 docblock amended. Two examples (`/no/such/page` →
  `/shared/no/such/page`, `/signins` → `/shared/signins`) contradicted § 4.1's own rule, because `no`
  and `signins` are valid org codes under `isOrgCode`, and flipping them would break MIR-19 AC-4. The
  rule stands; the examples become `/x/such/page` and `/signin.html` (neither first segment matches
  `ORG_CODE_SHAPE`), and `/no/such/page` → `null` is added as the counter-example. § 4.4 needs no text
  change: it already says one `it` per docblock example. Raised by `developer`
  (99-questions.md). Amended by `tech-lead-design`.
- `2026-11-12T01:31:00Z`: § 1 Out of scope, § 2 AC-12 and new AC-14, § 4.5 (cal-08 block), § 7 (cal-08
  added, nine paths, still `M`), § 8 alternative 5. The first PLAN missed that `cal-08-holiday-shading`
  places its admin in the dedicated org `acme` (`placeAdminInDedicatedOrg`), so the flip lands him at
  `/acme/month/2026-09`, and `appPathname` strips only `shared`: two walks ran past the first entry.
  The app is correct; the spec's target path changes in two places. Also fixed § 1's
  out-of-scope bullet, which cited AC-9 for "pass unedited" where AC-12 is meant. Raised by
  `developer` (99-questions.md, second question). Amended by `tech-lead-design`.
