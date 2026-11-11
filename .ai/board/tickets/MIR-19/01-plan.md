---
ticket: MIR-19
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-11T10:05:00Z
inputs_read:
  - .ai/board/tickets/MIR-19/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/decisions/ADR-071-writers-stamp-org-id-membership-mirrors-member-team-id-and-mir-13-splits-by-operation.md
  - .ai/registry/decisions/ADR-088-issue-reports-leave-the-member-app-first-and-the-rest-of-p4-2-is-mir-17-b.md
  - .ai/registry/decisions/ADR-095-the-system-panel-is-served-only-at-a-path-set-at-container-start-and-an-mfa-hook-logs-and-rate-limits-its-second-factor.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/plans/multi-tenancy-status.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/standards/architecture.md
  - .ai/standards/tech-stack.md
  - .ai/standards/ui-design-system.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - src/App.tsx
  - src/hooks/useSession.ts
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/data/system.ts
  - src/lib/domain/types.ts
  - src/lib/viewed-team.ts
  - src/lib/period.ts
  - src/lib/return-to.ts
  - src/components/AdminTabs.tsx
  - src/components/Sidebar.tsx
  - src/components/TopBar.tsx
  - docker/nginx.conf
  - Dockerfile
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261108090000_mir16c_manager_read_from_membership.sql
  - tests/route-role-guards.test.ts
  - tests/seam-parity.test.ts
  - tests/e2e/ (grep for toHaveURL, href assertions, page.url() walks, the catch-all)
  - node_modules/react-router 7.18.3 dist (BrowserRouter, Router, stripBasename, prependBasename)
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-19 — Every authenticated page is served under `/{org_code}` (first slice: the org address is served)

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:308`):

| ID | Feature | Group |
|---|---|---|
| MIR-19 | Every authenticated page is served under `/{org_code}` | MIR |

**Plan item:** Phase 5, *Org-scoped routing* (`.ai/board/plans/calechip-multi-tenancy-plan.md:261-283`).
Exit criteria there: *"Every authenticated page lives under `/{org_code}`"*, *"No reserved word can be
registered as an `org_code`"*, *"`org_code` is immutable after creation"*.

**The split, ADR-097 (written at this PLAN).** Phase 5 whole touches about 40 source files and about
25 e2e specs (§ 7). This ticket is the first slice: **the org address is served, beside the root one.**
MIR-19-b is the rest, in a fixed order — the specs learn the prefix first, then the root addresses send
a member to their org.

**Who gains what.** A signed-in member can open `/{their_org_code}/…` and get exactly the screen `/…`
gives them today. Every link inside the app keeps them under that prefix. A member who opens another
org's address gets a not-found screen and no data read. A signed-out person who opens an org address
signs in and lands back on that address. This is what makes MIR-19-b's flip a small change: when it
redirects `/` to `/{org_code}`, every page behind it already works there.

**Exit criteria already met before this ticket.** `org_code` immutability is the
`org_enforce_immutable_org_code` trigger (MIR-11). The reserved list is `org_code_not_reserved`
(MIR-11), but it lacks `tasks` (TSK-01's `/tasks`). This ticket adds `tasks`.

**Out of scope** (all in MIR-19-b, ADR-097 decision 5, unless said otherwise):

- Redirecting `/`, signing in, signing up, or any org-less address to `/{org_code}`. Root addresses
  keep working exactly as today, and nothing in the app links into the org form.
- Editing any existing e2e spec. They all keep passing because root addresses are unchanged.
- Email links (`send-event-email/template.ts:269`).
- nginx's `try_files $uri $uri/` (`docker/nginx.conf`). The reserved list already keeps `fonts` and
  `images` from being org codes.
- The system panel's mock reserved list (`src/lib/data/system.ts:758`), which stays stale on `tasks`.
- A sign-up at `/{org_code}/signup` landing in that org (ADR-071 decision 1). In this ticket that
  address crosses out to `/signup`, which is unchanged.
- Guest links under an org. They stay token-only (ADR-097 decision 6).
- An HTTP 404 status. The SPA serves `index.html` for every path. The *not-found* here is a screen.
- Any role-based difference. Every role is routed alike; roles are MIR-16 and MIR-17.

`size_estimate`: **M**.

## 2. Acceptance criteria

Terms used below. **Own org address:** `/` + the caller's org code + a path, for example
`/shared/month/2026-10`. Every existing member is in Org public, whose code is `shared`. In the mock
seam, a member listed in `calechip.mock.dedicatedOrgMembers` is in the dedicated org, whose code is
`acme`. **Org-shaped segment:** a first path segment that matches `^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$`
and is not on the reserved list (§ 4.2).

**AC-1 — the own org address serves the screen**
- Given an approved member of Org public, signed in
- When they open `/shared/month/2026-10`
- Then the month view for October 2026 is shown (`month-grid`), inside the shell, and the address
  stays `/shared/month/2026-10`.

**AC-2 — links inside the app keep the org**
- Given the member of AC-1 at `/shared/month/2026-10`
- When they follow the sidebar's year link (`home-year-link`), and then the brand logo
- Then the address is `/shared/year`, and then `/shared`. No link drops the prefix.

**AC-3 — an unknown address under the org stays under the org**
- Given the member of AC-1
- When they open `/shared/no/such/page`
- Then they land at `/shared`, which shows the current week (the root `/` behaviour, under the org).

**AC-4 — another org's address is not found, and reads nothing**
- Given the member of AC-1
- When they open `/acme/week`, or `/no-such-org`
- Then `org-not-found` is shown, and the shell, every calendar screen and every data read for that
  page are absent. The screen does not say whether that org exists.
- And `org-not-found-home` takes them to `/shared`.

**AC-5 — a dedicated org's member is served at their own code only**
- Given an approved member placed in the mock's dedicated org (code `acme`), signed in
- When they open `/acme/week`, and then `/shared/week`
- Then the first shows the week view, and the second shows `org-not-found`.

**AC-6 — Back across a crossing re-reads the address**
- Given the member of AC-1 at `/acme/week` (`org-not-found`)
- When they press `org-not-found-home`, and then the browser's Back
- Then they are at `/shared` with the week view, and then at `/acme/week` with `org-not-found` again.

**AC-7 — signed out at an org address: sign in, then come back**
- Given nobody is signed in
- When they open `/shared/week/2026-10-07`
- Then they are at `/signin?next=%2Fshared%2Fweek%2F2026-10-07` with the sign-in form.
- And when the member of AC-1 signs in there, they land at `/shared/week/2026-10-07` with the week view.

**AC-8 — signing out from inside the org**
- Given the member of AC-1 at `/shared/year`
- When they press `home-sign-out`
- Then they are at `/signin` (no org prefix) with the sign-in form.

**AC-9 — the account and guest addresses leave the org**
- Given anybody, signed in or not
- When they open `/shared/signup`, `/shared/signin`, or `/shared/guest/<token>`
- Then the address is replaced by `/signup`, `/signin` (or the signed-in landing), or
  `/guest/<token>`, and that screen behaves exactly as it does at the root.

**AC-10 — a caller who is not an approved member is sent to the root**
- Given a signed-in caller who is pending (`awaiting-approval`), or who has no member row
  (`not-on-a-team`)
- When they open `/shared/week`
- Then they are at `/`, showing the same screen they see at `/` today.

**AC-11 — the root addresses are unchanged**
- Given the member of AC-1
- When they open `/`, `/month/2026-10`, `/admin`, or `/events`
- Then each shows what it shows today, at that address, with no redirect. Every existing e2e spec
  passes unedited.

**AC-12 — the database answers only the caller's own org code** (pgTAP)
- Given `public.own_org_code()`
- When it is called by an approved member of org A, by a pending member, by a removed member, and by
  `anon`
- Then it returns A's `org_code`, `null`, `null`, and the call is refused for `anon`.
- And no caller can obtain another org's code through it. It takes no argument.

**AC-13 — `tasks` cannot be an org code**
- Given the migration applied
- When an org is inserted, or created through `create_org`, with `org_code = 'tasks'`
- Then the insert is refused by `org_code_not_reserved`.
- And `isOrgCode("tasks")` is `false` on the client.

**AC-14 — the client's org-code test matches the database's**
- Given `isOrgCode`
- Then it is `true` for `shared`, `acme` and `a1-b2`, and `false` for each reserved word, for `A1`,
  `-ab`, `ab-`, `a`, a 33-character code, `index.html`, and the empty string.

**Invariants touched:** `[]`. This ticket routes. It writes no entry and computes no count, so
INV-01 to INV-07 are unaffected. Every read is still bounded by the database's org policies (MIR-13).

**Open questions:** none. Every decision this ticket needs is in ADR-097.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

**`org-not-found`.** It renders in `BareLayout`, the gutter the signed-out screens use, with no
sidebar and no top bar. It is one centred card in the `AwaitingApproval` style: a heading
*"Page not found"*, one sentence *"This address is not part of your organisation."*, and one primary
button *"Go to your calendar"* (`org-not-found-home`). It has no mascot and no org name, and it does
not echo the code that was typed. English, per `ui-design-system.md` § Language.

## 3. Permission model

| Action | Who | Where the check lives |
|---|---|---|
| Read own org code | approved, non-removed member | `own_org_code()` → `member_org_id(auth.uid())` in SQL. `null` for anyone else. `anon` has no `execute`. |
| Be served `/{code}/…` | approved member whose own code is `code` | **Affordance only**, in `App.tsx`. Every read the screen then makes is bounded to the caller's org by the MIR-13 policies, whatever the URL says. The client never sends the URL's code to the database. |
| Be served another org's address | nobody | Affordance: `org-not-found` mounts no screen, so no read is issued. If it were bypassed, the reads would still return only the caller's own org (MIR-13). |
| Register `tasks` as an org code | nobody | `org_code_not_reserved` constraint (database). |

**Denials.**
- A member never sees another org's data through any address. That is the database's job (MIR-13).
  The routing adds not-found so the URL does not appear to work.
- A pending or member-less caller is never served an org address.
- `anon` cannot call `own_org_code()`.
- The function never takes an org id or a code as input, so it cannot be used to look up an org.

## 4. Contract

### 4.1 Migration — `supabase/migrations/20261111150000_mir19_own_org_code.sql`

Idempotent (ADR-024). One transaction. Applying it to a remote database is human (RULE-09).

```sql
-- 1. own_org_code()
create or replace function public.own_org_code() returns text
  language sql stable security definer set search_path = '' as $$
  select o.org_code
    from public.org o
   where o.id = public.member_org_id((select auth.uid()));
$$;
revoke all on function public.own_org_code() from public, anon;
grant execute on function public.own_org_code() to authenticated;

-- 2. 'tasks' joins the reserved list.
--    Guard first: raise exception 'mir19 refused: public.org holds org_code = ''tasks'''
--    (hint naming the row to rename by hand) when such a row exists.
--    Then: alter table public.org drop constraint if exists org_code_not_reserved;
--          alter table public.org add constraint org_code_not_reserved check (
--            org_code <> all (array[ <the 50 tokens of 20261027120000_mir11_composite_foreign_keys.sql:50-60, verbatim, in order>,
--                                    'tasks' ]));
--    The constraint name is unchanged (supabase/tests/120-composite-fks.test.sql:43 checks it).
```

### 4.2 `src/lib/org-path.ts` (new, imports nothing)

```ts
/** `org_code_shape` (20261027120000_mir11_composite_foreign_keys.sql:44-47), reproduced. */
export const ORG_CODE_SHAPE: RegExp = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/;

/** `org_code_not_reserved` as of 20261111150000_mir19_own_org_code.sql: the 50 MIR-11 tokens in their
 *  order, then "tasks". A copy; the member app may not import src/lib/data/system.ts (MIR-18 AC-14). */
export const RESERVED_ORG_CODES: readonly string[];

/** True when `segment` matches ORG_CODE_SHAPE, is 2..32 characters, and is not in RESERVED_ORG_CODES. */
export function isOrgCode(segment: string): boolean;

export interface OrgPath {
  /** The first segment when isOrgCode(it), else null. */
  orgCode: string | null;
  /** The pathname with that segment removed; "/" when nothing is left. The input unchanged when orgCode is null. */
  rest: string;
}

/** "/shared/month/2026-10" → { orgCode: "shared", rest: "/month/2026-10" }
 *  "/shared" and "/shared/" → { orgCode: "shared", rest: "/" }
 *  "/month/2026-10" → { orgCode: null, rest: "/month/2026-10" };  "/" → { orgCode: null, rest: "/" } */
export function splitOrgPath(pathname: string): OrgPath;

/** "/" + orgCode + rest, with rest "/" giving "/" + orgCode (react-router's own basename join).
 *  orgPath("shared", "/") === "/shared"; orgPath("shared", "/year") === "/shared/year". */
export function orgPath(orgCode: string, rest: string): string;

/** The router basename for a pathname: "/" + orgCode when splitOrgPath finds one, else "/". */
export function routerBase(pathname: string): string;
```

### 4.3 Seam — `src/lib/data/index.ts`, `supabase.ts`, `mock.ts`

Added to `DataSeam`, beside `getCurrentMember`:

```ts
/**
 * MIR-19, ADR-097 decision 2. The caller's own org code: `rpc("own_org_code")`.
 * `null` when nobody is signed in, or the caller is not an approved, non-removed member.
 * Never another org's code. THROWS on a transport failure, the shape `getCurrentMember` uses.
 */
getOwnOrgCode(): Promise<string | null>;
```

- **supabase:** `const { data, error } = await client().rpc("own_org_code");` Throw
  `new Error(\`getOwnOrgCode failed: ${error.message}\`)` on error, else return `data ?? null` typed
  `string | null`.
- **mock:** `mockOrgOf(currentMemberId)` → `null` gives `null`, `"org_public"` gives `"shared"`,
  `"dedicated"` gives `"acme"`. The two codes are module constants `MOCK_ORG_PUBLIC_CODE = "shared"`
  and `MOCK_DEDICATED_ORG_CODE = "acme"`, matching the panel mock's two orgs
  (`src/lib/data/system.ts`, `mockOrgs`).

### 4.4 `src/hooks/useSession.ts`

```ts
export interface SessionState {
  membership: Membership;
  /** MIR-19. `seam.getOwnOrgCode()`, read in the same `resolve()` pass as `membership` and set with it.
   *  `null` unless `membership.state === "member"`; may be `null` for a member when the read raced a
   *  removal. */
  orgCode: string | null;
  resolving: boolean;
  signIn(input: SignInInput): Promise<Result<Session>>;
  signOut(): Promise<Result<void>>;
  refresh(): void;
}
```

`resolve()` calls `getOwnOrgCode()` only when the member is approved, after `getCurrentMember()`. A
throw falls into the existing `catch`, which resolves to `signed-out` (fails closed). `Membership` in
`src/lib/domain/types.ts` is **not** changed.

### 4.5 `src/App.tsx`

```tsx
// App() state
const [base, setBase] = useState<string>(() => routerBase(window.location.pathname));
const syncBase = useCallback(() => setBase(routerBase(window.location.pathname)), []);
// useEffect: window "popstate" → syncBase; removed on unmount.

/** Replaces the current history entry with `path`, keeping history.state, then syncBase(). */
function cross(path: string): void;

<BrowserRouter key={base} basename={base}> … </BrowserRouter>
```

Inside `<Routes>`:

- **`base === "/"`.** The existing `BareLayout` block (`/signup`, `/guest/:token`,
  `/guest/registration/:token`, `/signin`), unchanged. Add `<Route path="/:orgCode/*"
  element={<EnterOrg onEnter={syncBase} />} />`. `EnterOrg` reads `useParams().orgCode`. When
  `isOrgCode` is true it calls `onEnter` in an effect and renders `null`. Otherwise it renders
  `<Navigate to="/" replace />`, the old catch-all's answer. Static first segments (`/month/:month`,
  `/year/:year/members`, …) still outrank it.
- **`base !== "/"`.** `<Route path="/signin" …>`, `<Route path="/signup" …>` and
  `<Route path="/guest/*" …>` each render `<LeaveOrg cross={cross} />`. It calls
  `cross(pathname + search)` in an effect, using the router's (base-stripped) location, and renders
  `null`.
  - **Signed out:** every other path renders `<LeaveOrg>`, which calls
    `cross(signInReturningTo(base + pathname + search))` instead.
  - **`undecided` or `member-less`:** `cross("/")`.
  - **`member` whose `orgCode !== base.slice(1)`:** every other path renders `<OrgNotFound
    onHome={…} />` inside `BareLayout`. The button does a **push**, not a replace:
    `window.history.pushState(null, "", orgPath(orgCode, "/"))`, then `syncBase()`. AC-6 needs the
    wrong address to stay in history. When `orgCode` is `null`, the button crosses to `/`.
- **The shell layout route** (`<Route element={membership.state === "member" ? <AppShell …/> :
  <BareLayout />}>` and all its children, the `*` catch-all included) **is written once in the source**.
  It is held in one `const shellRoutes = (<Route …>…</Route>)` and placed in both route tables. It
  renders when `base === "/"`, or when the member's `orgCode === base.slice(1)`.
  `tests/route-role-guards.test.ts` reads this text, so every `path="…"` and `element={…}` in it
  stays character-for-character as it is.
- `EnterOrg`, `LeaveOrg` and `OrgNotFound` are module-level components in `App.tsx`, beside
  `BareLayout` and `AfterSignIn`. They are not new files.

Selectors: `org-not-found` (the card), `org-not-found-home` (its button). `app-root` and
`seam-banner` keep their names and positions (UIE-02 AC-17).

### 4.6 Tests

- `tests/org-path.test.ts` (vitest): AC-13 (client half) and AC-14, plus `splitOrgPath`, `orgPath`
  and `routerBase` on the examples in § 4.2. A source-text check that `RESERVED_ORG_CODES` equals the
  migration's array, in order, read from `20261111150000_mir19_own_org_code.sql`.
- `supabase/tests/370-own-org-code.test.sql` (pgTAP, `tests.seed()` + `_isolation.psql`): AC-12 and
  AC-13 (database half). It also checks that `has_function_privilege('anon', 'public.own_org_code()',
  'execute')` is false.
- `tests/e2e/mir-19-org-routing.spec.ts`: one `test` per AC-1 to AC-11, named `AC-n …`. AC-5 places
  the member through `page.addInitScript` on `calechip.mock.dedicatedOrgMembers`, as MIR-15-e does.
  AC-11 asserts the four root addresses only; the rest of AC-11 is the unedited suite.

## 5. Seam impact

One new function, `getOwnOrgCode(): Promise<string | null>`, in `DataSeam` and in both
implementations, same name and arity. `seam-parity.test.ts` compares keys and needs no edit. No
existing seam function changes signature.

## 6. Schema delta

`20261111150000_mir19_own_org_code.sql`:
- **adds** `public.own_org_code()`;
- **re-creates the constraint** `org_code_not_reserved` with `tasks` added.

No table, column, policy, trigger, enum or row changes. A constraint change is not `none` (ADR-014).
ADR-097 decisions 2 and 3, written at this PLAN under ADR-067. Applying it to the hosted project is
human (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-097-an-org-address-is-served-beside-the-root-one-first-and-the-flip-is-mir-19-b.md"
  - ".ai/board/tickets/MIR-19-b/ticket.yaml"
  - "supabase/migrations/20261111150000_mir19_own_org_code.sql"
  - "supabase/tests/370-own-org-code.test.sql"
  - "src/lib/org-path.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/hooks/useSession.ts"
  - "src/App.tsx"
  - "tests/org-path.test.ts"
  - "tests/e2e/mir-19-org-routing.spec.ts"
```

12 paths, so `size: M`, which agrees with `size_estimate: M`. As Phase 5 described it, the count was
about 70: 40 `src/` files with an absolute path, about 25 e2e specs, nginx and the email template.
That is `L`, and the split is ADR-097. The sizing table also reads *"changes the schema"* as `XL`.
This follows the MIR precedent (MIR-16-c, MIR-21-f): a schema change carried by an ADR written under
ADR-067 is sized by its file count. The two ADR-097 paths are written at this PLAN.
`glossary_owed` is `[]`, so no glossary row is written.

## 8. Rejected alternatives

1. **A `/:orgCode` parent route, with every link rewritten through an `orgPath()` helper.** This is
   explicit and needs no remount. It was rejected because it edits about 40 screen files, and any
   future link written without the helper silently leaves the org. With a basename, staying in the org
   is the default, and leaving it is one of four named crossings.
2. **`unstable_HistoryRouter`, deriving the basename on every location change.** No key remount. It
   was rejected because it is an `unstable_` export of a dependency already past reliable recall. The
   stable `BrowserRouter` plus a key covers the same four crossings and `popstate`.
3. **`orgCode` as a computed field on `Member`.** No new seam function. It was rejected because it
   changes a shared type module (`XL`), and the field would be `null` on every row but the caller's own.
4. **Flipping in this ticket and quarantining the specs that break.** It was rejected because
   ADR-060's quarantine is for unplanned failures on `main`, not a planned break.

## Changelog

- `2026-11-11T10:05:00Z` — all sections written. Raised by `tech-lead-design`. Amended by `tech-lead-design`.

## Delegated decisions

- ADR-097 — MIR-19 splits. The basename is the URL's org segment. `own_org_code()` is added. `tasks`
  is reserved. MIR-19-b holds the rest, specs before the flip.
