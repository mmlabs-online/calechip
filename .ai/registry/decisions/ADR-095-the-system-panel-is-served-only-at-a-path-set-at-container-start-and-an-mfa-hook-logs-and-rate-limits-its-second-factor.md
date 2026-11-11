---
doc_version: 3
last_updated: 2026-11-11
governed_by: [RULE-01, RULE-02, RULE-09]
---

# ADR-095 — The system panel is served only at a path set at container start, and a Supabase Auth MFA hook logs and rate-limits its second factor

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-11 — at `/plan` for MIR-18-c (ADR-008, ADR-067).

This ADR supersedes and reverses no accepted ADR. It supplies the exposure-hardening design that
[ADR-074](ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md)
decision 7 (*"Unindexed by response header"*) and decision 8 (*"the response header and the
unguessable path, rate limiting, failed-login logging and the IP allow-list question"*) assigned to
MIR-18-b, which split them to MIR-18-c (`.ai/board/tickets/MIR-18-b/01-plan.md` § 1). It stays inside
[ADR-005](ADR-005-authorization-in-rls.md): Supabase Auth authenticates, the database decides, and no
server-side API is written. It adds one table and one function (decision 4), so it is the ADR that
MIR-18-c's `schema_delta` requires.

## Context

- **Plan item P4-3** (`.ai/board/plans/calechip-multi-tenancy-plan.md:246-251`): *"Separate route,
  not indexed: `X-Robots-Tag: noindex` header, **not** `robots.txt` — listing it there publishes the
  path"*; *"IP allow-list if feasible"*; *"Rate limiting and failed-login logging"*.
- **ADR-059 decision 1:** *"One `system_admin` panel at an unguessable path."*
- **The panel is a static file today.** `vite.config.ts` builds `system.html` as its own entry
  (ADR-074 decision 6); `docker/nginx.conf`'s `location /` serves any file that exists, so
  `/system.html` is reachable by anyone who has read this public repository.
- **The repository is not a place for a secret path.** `docker/nginx.conf` is committed, and every
  `VITE_*` value is baked into the bundle at build (`Dockerfile` header). The one value the container
  takes at start is `CALECHIP_VERSION`, which the `Dockerfile` `CMD` writes under `/tmp/nginx`, the
  one path the unprivileged nginx user writes.
- **The second factor is verified by Supabase Auth, not by this repository.** The panel calls
  `mfa.challengeAndVerify` (`src/lib/data/system.ts`) and the browser talks to Supabase directly, so
  nginx never sees a code attempt and the panel cannot count failures that a caller could not bypass.
- **Supabase Auth offers an MFA verification attempt hook** that may be a Postgres function
  (`pg-functions://…`). The installed CLI (`supabase` 2.116.0) accepts
  `[auth.hook.mfa_verification_attempt]` with `enabled` and `uri` — read from the binary, not
  recalled. The installed `@supabase/auth-js` 2.112.4 declares the error code
  `mfa_verification_rejected` (`dist/module/lib/error-codes.d.ts`).
- **Password sign-in already has Supabase Auth's own limit** (`supabase/config.toml`
  `[auth.rate_limit] sign_in_sign_ups`), and its failures are in Supabase Auth's own logs.

## Decision

1. **The panel's path is set at container start from `CALECHIP_SYSTEM_PATH`, and is nowhere in the
   repository or the image.** The value must be 32 to 128 characters of `[A-Za-z0-9_-]` — 24 random
   bytes in base64url is 32 characters. At start the container writes
   `/tmp/nginx/system-panel.conf`, which `docker/nginx.conf` includes inside its `server` block:
   with a valid value, one exact-match `location` that serves `system.html` at `/<value>`; with an
   unset or invalid value, a comment only, so the panel is not served at all and the member app
   starts as usual. **Fail closed, never fail to start.** The minimum length also guarantees the
   location can never collide with `/healthz`, `/version.json`, `/index.html` or `/assets/`.
2. **`/system.html` itself answers 404**, by an exact-match `location` in the committed
   `docker/nginx.conf`. The built file stays in the image under that name; only the generated
   location serves it.
3. **The panel's response carries `X-Robots-Tag: noindex, nofollow`**, `Referrer-Policy:
   no-referrer` (so the panel's own requests never carry its path in a `Referer`), and
   `Cache-Control: no-store`, and the panel's location has `access_log off` (so the path is not
   written to the container log on every visit). The meta tag of ADR-074 decision 7 stays. Nothing is
   written to `robots.txt`.
4. **Failed second-factor attempts are logged, and rate-limited, by a Postgres MFA verification
   hook.** `public.hook_mfa_verification_attempt(jsonb)` runs inside Supabase Auth's own
   verification, so nothing in the browser can skip it. It writes one row to
   `public.mfa_failed_verification` for every invalid code, and it **refuses every verification —
   valid code or not — for an identity that has 5 or more invalid codes in the trailing 15 minutes**,
   logging a refused valid code as `locked_out`. Only `invalid_code` rows count toward the limit.
   The table and the function are reachable by `supabase_auth_admin` only; `anon` and
   `authenticated` hold nothing on either.
5. **The limit is per identity, not per address, and applies to every identity's second factor.**
   The hook cannot be scoped to system admins and need not be: no other role enrols a factor today,
   and counting a member's attempts costs nothing.
6. **The panel says why.** The seam maps `mfa_verification_rejected` to the existing failure code
   `rate_limited` with the message *"Too many incorrect codes. Try again in 15 minutes."*; every
   other verification failure keeps *"That code did not match. Try again."*.
7. **The IP allow-list is not built: it is not feasible as a control in this deployment.** The
   browser reaches Supabase Auth and PostgREST directly, so an nginx allow-list would hide only the
   HTML, which the secret path of decision 1 already hides; and behind the Cloudflare Tunnel nginx
   sees the tunnel's address, not the visitor's. Restricting the path at the edge (Cloudflare Access
   in front of the panel's path) remains available to the operator outside this repository and
   needs no change here.

## Options considered

- **Keep `/system.html`, hardened with the header only.** Rejected: ADR-059 decision 1 says
  *unguessable*, and the name is in a public repository.
- **Bake the path into the image at build, as a `VITE_*`-style build argument.** Rejected: the image
  is pushed to a public registry and promoted by digest (CICD-04), so anything baked in is readable by
  anyone who pulls it, and changing the path would need a rebuild.
- **Rename the build entry to a random file name committed in the repository.** Rejected: the
  repository is the leak.
- **Count failures in the panel and report them to an RPC.** Rejected under ADR-005: a caller who
  skips the panel skips the count, and a client-reported log can be forged or omitted.
- **Rate-limit `/auth/v1/factors/*/verify` in nginx.** Rejected: that traffic goes to Supabase, not
  through this nginx.
- **Lock the account on failure by setting `auth.users.banned_until`.** Rejected: it needs a write
  into Supabase Auth's own schema, it outlives the window unless something clears it, and the hook's
  refusal already blocks the factor without touching identity state.

## Consequences

- **The operator generates the path and gives it to the container**, from a file outside the
  deployment repository's checkout (`docs/ops/deployment-repo/apps/calechip/compose.yml`). Until
  then the panel is not served in production. Changing the path is a container restart, not a
  rebuild.
- **The hook must be enabled on the hosted project by a person**, in the dashboard (RULE-09), after
  the migration is applied. Until then failures are neither logged nor limited in production, as
  TOTP itself was until a person enabled it (ADR-074 § Consequences). Whether the hosted project's
  plan offers the MFA verification hook is a fact only the operator holds —
  `TODO(verify)` at enablement.
- **A lockout can be triggered only by someone who already holds the password**, since a code is
  asked for only after password sign-in, and Supabase Auth limits password sign-ins on its own. An
  operator who locks themselves out waits 15 minutes, or deletes their own `invalid_code` rows as
  `postgres`.
- **Nothing prunes `public.mfa_failed_verification`.** ADR-050 decision 6 forbids a scheduler; a row
  is a few dozen bytes, and the table is read by a person in the dashboard.
- `vite preview` and `pnpm dev` still serve `/system.html`: they are not the deployment, and the
  end-to-end suite depends on them.
- The panel's asset chunks stay under `/assets/` with hashed names. They contain no secret — the
  Supabase URL and anon key are public by design — and nothing in the member bundle names them.

## Revert condition

The operator puts the panel behind an edge control that makes the path irrelevant (decision 1), or
decides a second-factor lockout costs more than it protects (decision 4). Either supersedes the
matching decision; the other decisions stand alone.
