---
ticket: MIR-18-c
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-11T08:40:00Z
inputs_read:
  - .ai/board/tickets/MIR-18-c/ticket.yaml
  - .ai/board/tickets/MIR-18-b/ticket.yaml
  - .ai/board/tickets/MIR-18-b/01-plan.md
  - .ai/board/tickets/MIR-18/03-impl-log.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md
  - .ai/standards/tech-stack.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - Dockerfile
  - docker/nginx.conf
  - vite.config.ts
  - system.html
  - supabase/config.toml
  - supabase/migrations/20261104150000_mir18_system_admin.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/190-system-admin.test.sql
  - scripts/db-test.mjs
  - src/lib/data/system.ts
  - src/system/main.tsx
  - src/lib/domain/types.ts
  - tests/e2e/mir-18-system-panel.spec.ts
  - docs/ops/deployment-repo/README.md
  - docs/ops/deployment-repo/apps/calechip/compose.yml
  - node_modules/.pnpm/@supabase+auth-js@2.112.4/node_modules/@supabase/auth-js/dist/module/lib/error-codes.d.ts
  - node_modules/.pnpm/@supabase+cli-linux-x64@2.116.0/node_modules/@supabase/cli-linux-x64/bin/supabase
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-18-c — the system panel is served only at a path set at container start, unindexed, and its second factor is logged and rate-limited in the database

## 1. Problem and scope

**Feature — MIR-18** (`.ai/registry/features.md:307`), transcribed:

> A separate system admin panel, unindexed, with its own account store, 2FA and org management

Plan item P4-3 (`.ai/board/plans/calechip-multi-tenancy-plan.md:246-251`), the four bullets this
ticket owns:

> - Separate route, not indexed: `X-Robots-Tag: noindex` header, **not** `robots.txt` — listing it there publishes the path
> - IP allow-list if feasible
> - Rate limiting and failed-login logging

ADR-059 decision 1: *"One `system_admin` panel at an unguessable path."* MIR-18 shipped the door
(account store, TOTP), MIR-18-b the org management, and MIR-18-b's PLAN split the exposure hardening
here, by operation (`.ai/board/tickets/MIR-18-b/01-plan.md` § 1). This is the last slice of MIR-18's
row; the row can move to DONE when this ships.

**Who gains what.** Today anyone who reads this public repository knows the panel is at
`/system.html`, and a person holding a system admin's password can try authenticator codes without
limit and without trace. After this ticket, the operator sets the panel's path when the container
starts — it is in no file, image or bundle — and `/system.html` answers 404; the panel's response
tells crawlers not to index it. Every wrong code is written to a log in the database, and after five
wrong codes in fifteen minutes Supabase Auth refuses that identity's second factor — even the right
code — until the window passes, and the panel says so. Both controls run where a caller cannot skip
them: in nginx and inside Supabase Auth's own verification (ADR-095).

**Out of scope:**

- **An IP allow-list.** Not feasible as a control here (ADR-095 decision 7): the browser reaches
  Supabase directly, and behind the Cloudflare Tunnel nginx sees the tunnel's address. Putting
  Cloudflare Access in front of the path is the operator's, outside this repository.
- **Logging or limiting failed *password* sign-ins.** Supabase Auth limits them
  (`supabase/config.toml` `[auth.rate_limit] sign_in_sign_ups`) and logs them; this ticket's open
  part was the second factor (`ticket.yaml` `mir_detail`).
- **A screen that shows the failure log, an alert on failures, or an unlock control.** The log is
  read by a person in the dashboard. Unlocking is waiting out the window, or a `delete` by a person.
- **Pruning the log.** ADR-050 decision 6 forbids a scheduler.
- **Hiding the panel from `vite preview` and `pnpm dev`.** They are not the deployment, and the
  end-to-end suite runs the panel at `/system.html` through them.
- **Renaming the panel's hashed asset chunks.** They hold no secret and the member bundle does not
  name them (ADR-095 § Consequences).
- **The staging compose file** (`docs/ops/deployment-repo/apps/calechip-staging/compose.yml`).
  Staging without the value simply serves no panel — the fail-closed default.
- **Enabling the hook on the hosted project, applying the migration, generating the production path
  and placing its file on the server.** All four are a person's (RULE-09); the ticket ships the
  means and the instructions.

`size_estimate: M`.

## 2. Acceptance criteria

Three levels, because the controls live in three places. **Container ACs (AC-1 to AC-5)** are run
against the image built from this branch, `docker build --build-arg VITE_DATA_SEAM=mock -t
calechip:mir18c .`, started with `docker run --rm -p 3000:3000 [-e CALECHIP_SYSTEM_PATH=…]
calechip:mir18c`, and observed with `curl -i`; they are recorded in
`.ai/board/tickets/MIR-18-c/verification.md`. **Database ACs (AC-6 to AC-12)** are pgTAP.
**Panel ACs (AC-13 to AC-16)** are Playwright against the mock build. **AC-17** is a manual run
against the local Supabase stack, recorded in the same `verification.md`; it is the verification
`verification_required: true` asks for, since the panel ACs only exercise the mock.

`P` below is the fixture path `mir18c-0123456789abcdefABCDEF_-xyz` (34 characters).

**AC-1 — the panel is served at the configured path, unindexed**
- Given the container is started with `CALECHIP_SYSTEM_PATH=P`
- When `GET /P` is requested
- Then the status is 200, `Content-Type` starts with `text/html`, the body contains
  `<title>CaleChip system</title>`, and the response carries `X-Robots-Tag: noindex, nofollow`,
  `Referrer-Policy: no-referrer`, `Cache-Control: no-store` and `X-Content-Type-Options: nosniff`

**AC-2 — the build name is never served**
- Given the container is started with `CALECHIP_SYSTEM_PATH=P`, and again with it unset
- When `GET /system.html` is requested
- Then the status is 404 both times, and the body does not contain `CaleChip system`

**AC-3 — an unset or invalid path serves no panel, and the container still starts**
- Given the container is started with `CALECHIP_SYSTEM_PATH` unset; then with `short`; then with
  `mir18c-0123456789abcdef/../ABCDEF_-xyz`; then with a 129-character value of `a`
- When `GET /healthz` and `GET /P` are requested
- Then `/healthz` is 200 each time; `/P` returns the member app's `index.html` (status 200, body
  does not contain `CaleChip system`, no `X-Robots-Tag`); and the container's standard error carries
  the line `calechip: CALECHIP_SYSTEM_PATH is unset or invalid; the system panel is not served.`
  without the value

**AC-4 — the member app is unchanged**
- Given the container is started with `CALECHIP_SYSTEM_PATH=P`
- When `GET /`, `GET /healthz`, `GET /version.json` and `GET /calendar` are requested
- Then each answers as before this change (200; `/` and `/calendar` the member `index.html`;
  `/version.json` JSON), and none carries `X-Robots-Tag`

**AC-5 — the path is not written to the access log**
- Given the container is started with `CALECHIP_SYSTEM_PATH=P`
- When `GET /P` is requested
- Then `docker logs` for the container contains no line containing `P`

**pgTAP fixtures** — added by the test as `postgres`, on top of `tests.seed()`: two `auth.users`
rows `mfa_a` and `mfa_b` (`email_confirmed_at` null, so no member row is created), and two factor
uuids `factor_a`, `factor_b`. *"Event(u, f, v)"* is
`jsonb_build_object('user_id', u, 'factor_id', f, 'valid', v)`. *"Continue"* is the jsonb
`{"decision": "continue"}`; *"reject"* is
`{"decision": "reject", "message": "Too many incorrect codes. Try again in 15 minutes."}`.
"In the window" means `attempted_at > now() - interval '15 minutes'`. The hook is called as the
session user (`postgres`); its privileges are asserted with `has_*_privilege`.

**AC-6 — the log table and the hook exist, and are closed to every client role**
- `public.mfa_failed_verification` exists with RLS enabled and the columns of § 4.1
- `anon` and `authenticated` hold no privilege on the table and cannot execute
  `public.hook_mfa_verification_attempt(jsonb)`
- `supabase_auth_admin` holds `select` and `insert` on the table and `execute` on the function
- The function is not `security definer` (the census in `010-catalogue.test.sql` is unchanged)

**AC-7 — a wrong code is logged and, under the limit, goes through**
- Given `mfa_a` has no rows
- When the hook is called with Event(`mfa_a`, `factor_a`, false)
- Then it returns continue, and the table holds exactly one row for `mfa_a`: `factor_id = factor_a`,
  `reason = 'invalid_code'`, `attempted_at = now()`

**AC-8 — a right code under the limit is not logged**
- Given `mfa_a` has 4 `invalid_code` rows in the window
- When the hook is called with Event(`mfa_a`, `factor_a`, true)
- Then it returns continue, and `mfa_a` still has 4 rows

**AC-9 — the fifth wrong code in the window is refused**
- Given `mfa_a` has 4 `invalid_code` rows in the window
- When the hook is called with Event(`mfa_a`, `factor_a`, false)
- Then it returns reject, and `mfa_a` has 5 `invalid_code` rows

**AC-10 — while locked, a right code is refused and logged as `locked_out`, which does not count**
- Given `mfa_a` has 5 `invalid_code` rows in the window
- When the hook is called with Event(`mfa_a`, `factor_a`, true) twice
- Then it returns reject both times, `mfa_a` has 2 `locked_out` rows, and still 5 `invalid_code` rows

**AC-11 — rows older than the window do not count**
- Given `mfa_b` has 10 `invalid_code` rows with `attempted_at = now() - interval '16 minutes'` and 4
  in the window
- When the hook is called with Event(`mfa_b`, `factor_b`, true)
- Then it returns continue

**AC-12 — the count is per identity, and a malformed event is refused**
- Given `mfa_a` has 5 `invalid_code` rows in the window and `mfa_b` has none in it
- When the hook is called with Event(`mfa_b`, `factor_b`, true)
- Then it returns continue
- And a call whose event lacks `user_id`, or `factor_id`, or `valid` raises SQLSTATE `22023` and
  writes no row

**Panel fixtures (mock build, `/system.html`)** — MIR-18's: `ops@calechip.test` is a system admin
with an authenticator already set up, the password is `calechip-demo`, the one valid code is
`246810`. "A wrong code" is `000000`.

**AC-13 — under the limit, a wrong code says so and stays on the code screen**
- Given `ops@calechip.test` has signed in and is on `system-verify`
- When a wrong code is submitted four times
- Then after each, `system-code-error` reads `That code did not match. Try again.` and `system-verify`
  is still shown

**AC-14 — the fifth wrong code ends the attempt and says why**
- Given AC-13's four wrong codes
- When a fifth wrong code is submitted
- Then `system-signin-form` is shown, and `system-signin-error` reads
  `Too many incorrect codes. Try again in 15 minutes.`

**AC-15 — while locked, the right code does not let you in**
- Given AC-14
- When `ops@calechip.test` signs in again with the right password and submits `246810`
- Then `system-signin-form` is shown with the same `system-signin-error` text, and
  `system-signed-in` is not shown

**AC-16 — after the window, the right code lets you in**
- Given AC-14, with the page clock installed before the page loaded
- When the clock is moved forward 15 minutes and 1 second, and `ops@calechip.test` signs in and
  submits `246810`
- Then `system-signed-in` is shown

**AC-17 — the real stack (manual, `verification.md`)**
- Given the local stack (`pnpm exec supabase start`, then `pnpm exec supabase db reset --local`)
  with this branch's `supabase/config.toml`, a system admin made with `grant_system_admin`, and the
  panel run against it (`pnpm dev`, `/system.html`) with a TOTP factor enrolled
- When five wrong codes are submitted, then the right code
- Then the panel shows AC-13's message four times and AC-14's after the fifth; the right code is
  refused with AC-14's message; `select reason, count(*) from public.mfa_failed_verification group
  by reason` shows 5 `invalid_code` and 1 `locked_out`; and `verification.md` records whether the
  panel landed on the sign-in form or stayed on the code screen after each refusal (the § 4.4
  `TODO(verify)`)

**Invariants touched:** `[]`. No entry, count, team, membership or role is read or written. The only
new rows are in a new table keyed on `auth.users`; INV-01 to INV-07 concern entries and the absence
count, and nothing here reaches either.

**Open questions:** none that change an AC. Three facts are `TODO(verify)` and are settled by running,
not by asking: the hook's event keys and its call on an invalid code (AC-17), whether a rejection
ends the session (AC-17; the panel handles both, § 4.4), and whether the hosted project's plan
offers the hook (the operator, at enablement — ADR-095 § Consequences).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No new element. The lockout message appears in the slot that already exists for it: the sign-in
form's `system-signin-error` when the refusal ended the session, or the code form's
`system-code-error` when it did not. Same type, same colour (`text-danger`) as the messages already
shown there.

## 3. Permission model

| Action | Who may | Where the check lives | Who must not |
|---|---|---|---|
| Load the panel's HTML | Anyone holding the path | nginx: only the generated exact-match location serves `system.html` (ADR-095 decisions 1, 2) | Anyone requesting `/system.html` — 404 |
| Verify a second-factor code | The identity whose aal1 session it is | Supabase Auth, then `public.hook_mfa_verification_attempt` inside the same verification | An identity with 5 `invalid_code` rows in the window, even with a valid code |
| Write `public.mfa_failed_verification` | `supabase_auth_admin`, through the hook | Table grant (`insert`) and RLS policy | `anon`, `authenticated` — no privilege; RLS on |
| Read `public.mfa_failed_verification` | `supabase_auth_admin` (the hook's count); `postgres` (the operator, in the dashboard) | Table grant (`select`) and RLS policy; `postgres` owns the table | `anon`, `authenticated`, and so every panel and member session |
| Execute the hook function | `supabase_auth_admin` | `revoke all … from public, anon, authenticated; grant execute … to supabase_auth_admin` | `anon`, `authenticated` |

The panel's mapping of `mfa_verification_rejected` to a message, and the mock's own count, are
**affordances** (`.ai/standards/rbac-and-security.md`): they say why, they decide nothing. The mock's
count exists so the panel's handling can be exercised without a stack.

## 4. Contract

### 4.1 Migration — `supabase/migrations/20261111180000_mir18c_mfa_verification_hook.sql`

Idempotent (ADR-024): `if not exists`, `create or replace`, `drop … if exists`, grants restated. One
`begin; … commit;`.

```sql
create table if not exists public.mfa_failed_verification (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users (id) on delete cascade,
  factor_id    uuid not null,
  reason       text not null
               constraint mfa_failed_verification_reason_check
               check (reason in ('invalid_code', 'locked_out')),
  attempted_at timestamptz not null default now()
);
create index if not exists mfa_failed_verification_user_attempted_idx
  on public.mfa_failed_verification (user_id, attempted_at desc);

alter table public.mfa_failed_verification enable row level security;
revoke all on table public.mfa_failed_verification from public, anon, authenticated;
grant select, insert on table public.mfa_failed_verification to supabase_auth_admin;
-- policies: mfa_failed_verification_auth_admin_select  for select to supabase_auth_admin using (true)
--           mfa_failed_verification_auth_admin_insert  for insert to supabase_auth_admin with check (true)

grant usage on schema public to supabase_auth_admin;

create or replace function public.hook_mfa_verification_attempt(event jsonb) returns jsonb
  language plpgsql volatile security invoker set search_path = '' as $$ … $$;
revoke all on function public.hook_mfa_verification_attempt(jsonb) from public, anon, authenticated;
grant execute on function public.hook_mfa_verification_attempt(jsonb) to supabase_auth_admin;
```

**The function body, step by step** (ADR-095 decision 4):

1. `v_user uuid := (event ->> 'user_id')::uuid`, `v_factor uuid := (event ->> 'factor_id')::uuid`,
   `v_valid boolean := (event ->> 'valid')::boolean`. Any of the three null →
   `raise exception 'malformed MFA verification event' using errcode = '22023'`. Other keys are
   ignored.
2. If `not v_valid`: insert `(user_id, factor_id, reason) = (v_user, v_factor, 'invalid_code')`.
3. `v_failures := count(*)` of rows with `user_id = v_user`, `reason = 'invalid_code'`,
   `attempted_at > now() - interval '15 minutes'` (step 2's row included).
4. If `v_failures >= 5`: if `v_valid`, insert `(v_user, v_factor, 'locked_out')`; return
   `jsonb_build_object('decision', 'reject', 'message', 'Too many incorrect codes. Try again in 15 minutes.')`.
5. Otherwise return `jsonb_build_object('decision', 'continue')`.

The two numbers are literals in the function with a comment citing ADR-095 decision 4; they are not
configuration.

`TODO(verify)`: the event keys `user_id`, `factor_id`, `valid` are from Supabase Auth's hook
documentation as recalled, not read. AC-17 confirms them; a different key name is a one-line change in
step 1 and is recorded in the impl log.

### 4.2 `supabase/config.toml`

Added after the commented `[auth.hook.custom_access_token]` block, nothing else changed:

```toml
# MIR-18-c, ADR-095 decision 4: logs and rate-limits second-factor codes. The hosted project's hook
# is enabled in its dashboard by a person (RULE-09).
[auth.hook.mfa_verification_attempt]
enabled = true
uri = "pg-functions://postgres/public/hook_mfa_verification_attempt"
```

### 4.3 nginx and the container

**`docker/nginx.conf`** — two additions inside `server`, after `location = /index.html` and before
`location /`:

```nginx
    # MIR-18-c, ADR-095 decision 2: the panel is never served under its build name.
    location = /system.html {
      return 404;
    }

    # MIR-18-c, ADR-095 decision 1: the panel's one location, written at container start from
    # CALECHIP_SYSTEM_PATH (Dockerfile CMD). A comment only when the value is unset or invalid.
    include /tmp/nginx/system-panel.conf;
```

**`Dockerfile` `CMD`** — still one `sh -c`, still writing `/tmp/nginx/version.json` exactly as now,
then, before `exec nginx -g 'daemon off;'`, writes `/tmp/nginx/system-panel.conf` **every time**
(nginx refuses to start on a missing include):

- **Valid** — `CALECHIP_SYSTEM_PATH` is 32 to 128 characters, every one in `[A-Za-z0-9_-]` — the
  file is exactly, with `<value>` substituted:

  ```nginx
  location = /<value> {
    access_log off;
    default_type text/html;
    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header X-Content-Type-Options nosniff always;
    add_header Referrer-Policy no-referrer always;
    add_header Cache-Control "no-store" always;
    try_files /system.html =404;
  }
  ```

- **Unset or invalid** — the file is the single line
  `# CALECHIP_SYSTEM_PATH is unset or invalid: the system panel is not served (ADR-095 decision 1).`
  and the start writes to standard error exactly
  `calechip: CALECHIP_SYSTEM_PATH is unset or invalid; the system panel is not served.`
  **The value is never echoed**, valid or not.

The `CMD` comment block above it gains one paragraph naming `CALECHIP_SYSTEM_PATH`, the rule, and
ADR-095. No new file under `docker/`: the project has no `.sh` files (`CLAUDE.md` § Working
agreements), and the existing `CALECHIP_VERSION` step is the precedent for inline start logic.

**`docs/ops/deployment-repo/apps/calechip/compose.yml`** — the service gains, after `environment`:

```yaml
    # MIR-18-c, ADR-095 decision 1: CALECHIP_SYSTEM_PATH, the system panel's path, from a file on the
    # server OUTSIDE this repository's checkout (the runner cleans its workspace). Optional: without
    # it the panel is not served and everything else runs.
    env_file:
      - path: /etc/calechip/system-panel.env
        required: false
```

and its header comment's *"The one environment value is CALECHIP_VERSION"* sentence names the
second one. `TODO(verify)`: `env_file` with `required` needs Docker Compose 2.24 or later on the
server — the README says so where it lists the host's requirements.

**`docs/ops/deployment-repo/README.md`** — the paragraph *"`release.env` holds no secret … The only
environment CaleChip reads at runtime is `CALECHIP_VERSION` …"* is extended, not replaced: it names
`CALECHIP_SYSTEM_PATH`, says it lives only in `/etc/calechip/system-panel.env` on the server
(readable by the runner's user, never committed), gives the generator
`openssl rand -base64 24 | tr '+/' '-_'` (32 characters), and says the panel's URL is
`https://<host>/<value>`. The host requirements line gains *Compose 2.24 or later*.

### 4.4 The panel seam — `src/lib/data/system.ts`

`SystemSeam` is unchanged: no function is added, renamed or re-typed. `verifyCode`'s failure gains
one code from the existing `FailureCode` union (`src/lib/domain/types.ts:136`, `"rate_limited"`).

New module constants:

```ts
const TOO_MANY_CODES = "Too many incorrect codes. Try again in 15 minutes.";
// ADR-095 decision 4. The mock's copy of the hook's numbers; the hook is the control.
const MOCK_CODE_FAILURE_LIMIT = 5;
const MOCK_CODE_FAILURE_WINDOW_MS = 15 * 60 * 1000;
let mockCodeFailures = new Map<string, number[]>(); // email -> Date.now() of each wrong code
```

**Supabase `verifyCode`** — when `mfa.challengeAndVerify` returns an `error` whose `code` is
`"mfa_verification_rejected"`, return
`{ ok: false, error: { code: "rate_limited", message: TOO_MANY_CODES } }`; every other failure path
returns `refused` as now.

**Mock `verifyCode`** — the session, account and factor checks are unchanged and run first (a factor
mismatch is `refused` and not counted). Then, with `now = Date.now()`:

1. Keep only this account's failures with `t > now - MOCK_CODE_FAILURE_WINDOW_MS`.
2. If `code.trim() !== MOCK_SYSTEM_CODE`, push `now`.
3. If the kept count is `>= MOCK_CODE_FAILURE_LIMIT`: set `mockSession = null` and
   `mockPendingFactorId = null`, and return `rate_limited` / `TOO_MANY_CODES`.
4. If the code was wrong, return `refused`. Otherwise the existing success path.

Step 3 mirrors Supabase Auth signing the identity out on a rejection.
`TODO(verify)`: that sign-out is recalled from Supabase Auth's source, not read; AC-17 records what
the real stack does, and § 4.5 handles either outcome.

### 4.5 The panel — `src/system/main.tsx`

`verify(code)` in `SystemPanel` — on `!result.ok`:

- `result.error.code === "rate_limited"`: `const next = await systemSeam.gate(); await arrive(next);`
  then `setSignInError(result.error.message)` when `next.state === "signed-out"`, otherwise
  `setCodeError(result.error.message)`. (`arrive` clears `codeError`, so the message is set after it.)
- any other code: `setCodeError(result.error.message)`, as now.

No new component, state or `data-testid`. `signIn` already clears `signInError` on its next submit.

### 4.6 pgTAP — `supabase/tests/360-mfa-verification-hook.test.sql`

The file's own fixture helper `tests.mfa(p_label text) returns uuid` maps `mfa_a`, `mfa_b`,
`factor_a`, `factor_b` to fixed uuids (the `tests.sys` pattern of `190-system-admin.test.sql`).
Backdated and pre-existing rows are inserted directly as `postgres`. Every AC-6 to AC-12 clause is at
least one assertion; `plan(n)` is the count.

### 4.7 Playwright — `tests/e2e/mir-18-c-code-lockout.spec.ts`

`PANEL = "/system.html"`, the constants and the `signIn` / `submitCode` helpers of
`tests/e2e/mir-18-system-panel.spec.ts` copied, not imported. One `test` per AC-13 to AC-16; AC-16
calls `page.clock.install()` before `page.goto(PANEL)` and `page.clock.fastForward("15:01")`. Every
locator is an existing `data-testid`.

### 4.8 Standards — `.ai/standards/rbac-and-security.md`

- § Authentication, after the system admin paragraph: one sentence — wrong second-factor codes are
  logged in `public.mfa_failed_verification` and five in fifteen minutes refuse the factor, by the
  MFA verification hook (ADR-095 decision 4).
- § Secrets table, one row: `System panel path` | `CALECHIP_SYSTEM_PATH`, set at container start from
  a file on the server; never in a repository, an image or a build argument | The operator and the
  system admins.

## 5. Seam impact

- **Member seam (`src/lib/data/index.ts`, `mock.ts`, `supabase.ts`): none.** `tests/seam-parity.test.ts`
  is unaffected.
- **Panel seam (`src/lib/data/system.ts`):** no function added, removed or re-typed; both
  implementations of `verifyCode` gain the `rate_limited` failure (§ 4.4). Same name and arity in
  both.

## 6. Schema delta

**Not `none`.** One table, `public.mfa_failed_verification`, with an index, RLS and two policies, and
one function, `public.hook_mfa_verification_attempt(jsonb)` — § 4.1. Recorded in
[ADR-095](../../../registry/decisions/ADR-095-the-system-panel-is-served-only-at-a-path-set-at-container-start-and-an-mfa-hook-logs-and-rate-limits-its-second-factor.md),
accepted under ADR-067. No existing table, column, policy, trigger or function changes, and the
function is `security invoker`, so the `security definer` census is untouched.

Applying the migration to the hosted project, and then enabling the hook in its dashboard, is a
person's (RULE-09), in that order: a hook pointing at a function that does not exist fails every
second-factor verification.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-095-the-system-panel-is-served-only-at-a-path-set-at-container-start-and-an-mfa-hook-logs-and-rate-limits-its-second-factor.md"
  - ".ai/standards/rbac-and-security.md"
  - "Dockerfile"
  - "docker/nginx.conf"
  - "docs/ops/deployment-repo/README.md"
  - "docs/ops/deployment-repo/apps/calechip/compose.yml"
  - "supabase/config.toml"
  - "supabase/migrations/20261111180000_mir18c_mfa_verification_hook.sql"
  - "supabase/tests/360-mfa-verification-hook.test.sql"
  - "src/lib/data/system.ts"
  - "src/system/main.tsx"
  - "tests/e2e/mir-18-c-code-lockout.spec.ts"
```

`.ai/board/tickets/MIR-18-c/verification.md` is in the ticket folder and needs no entry.

- **12 paths: `size: M`**, equal to `size_estimate: M`. It is the top of M; one more path would be L.
- **Schema change and XL.** The Sizing table's XL row names a schema change. As for MIR-18-b
  (ADR-075) and MIR-15-c (ADR-093), the escalation that row asks for is discharged by the ADR
  accepted under ADR-067's delegation, and the size is counted from files.
- **`glossary_owed: []`** — no glossary row is written.
- **Deliberately absent:** `supabase/tests/010-catalogue.test.sql` (the function is not a definer);
  `vite.config.ts` and `system.html` (the build entry is unchanged); `.ai/standards/data-model.md`
  (the table is operational, not a domain entity — the same call MIR-18-b made for its column);
  `tests/e2e/mir-18-system-panel.spec.ts` (it keeps passing at `/system.html` under `vite preview`);
  `docs/ops/deployment-repo/apps/calechip-staging/compose.yml` (§ 1 Out of scope).

## 8. Rejected alternatives

1. **Generate the panel's location from a template file with `envsubst`** (`docker/system-panel.conf.template`,
   the stock nginx image's mechanism). Genuinely tidier than a `printf` in `CMD`. Rejected: the
   `Dockerfile` deliberately deletes the stock entrypoint scripts because they rewrite `/etc/nginx`
   as root; `envsubst` alone cannot validate the value or fall back to *not served*, so a validation
   step in `CMD` is needed anyway; and it adds a thirteenth path, which is L.
2. **Count wrong codes in the panel and report them through an RPC.** No Supabase Auth setting to
   enable on the hosted project, and it works on any plan. Rejected under ADR-005: a caller who
   skips the panel skips the count, so it limits nobody who matters and logs only the honest.
3. **Split the path from the hook — two tickets.** Each would be S, and the Sizing rule's first cut is
   by operation. Rejected: at twelve paths the whole is M, and the two halves share the panel's threat
   model and one ADR; splitting would ship an unguessable path with an unlimited second factor
   behind it, or the reverse, for no smaller review.
4. **Reject only the invalid attempts once over the limit, letting a valid code through.** Kinder to
   an operator who fumbles five times. Rejected: an attacker's guesses are invalid anyway, so the
   refusal would change nothing for them; refusing the valid code is the only thing that makes the
   limit a limit.

## Changelog

- 2026-11-11 — first version. Sections 1 and 2 were written before the source tree was read for 3
  to 8. Reading it changed three things, none of which narrowed an AC: AC-14's landing screen was
  written for both outcomes of a rejection after `src/system/main.tsx` showed the panel re-reads the
  gate on every transition; `rate_limited` was taken from the existing `FailureCode` union
  (`src/lib/domain/types.ts:136`) instead of a new code; and the hook was confirmed configurable on
  the installed CLI before AC-17 was written against it.
- 2026-11-11 — process note: ADR-095 was written before its path was added to `allowed_paths`, the
  reverse of `/plan`'s stated order. The path was added in the same run, before this plan was
  written; nothing else was written outside the ticket folder.

## Delegated decisions

- ADR-095 — the panel's path from `CALECHIP_SYSTEM_PATH` at container start, `/system.html` 404, the
  response headers, the MFA verification hook with its 5-in-15-minutes limit, and the IP allow-list
  declared not feasible. It supersedes and reverses no accepted ADR; it is written under ADR-067
  because it carries a schema change.
