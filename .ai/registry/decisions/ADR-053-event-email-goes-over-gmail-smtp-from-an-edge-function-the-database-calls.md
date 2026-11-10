---
doc_version: 3
last_updated: 2026-10-09
governed_by: [RULE-01, RULE-09]
---

# ADR-053 — Event email goes over Gmail SMTP, from one Edge Function the database calls

## Status

`ACCEPTED by tech-lead-design` — 2026-10-09, at `/plan` of `EVT-05`.

**Decisions 2 and 3 amended in letter 2026-10-12 by [ADR-055](ADR-055-an-entered-address-is-mailed-an-invitation-to-a-public-event.md)**, `ACCEPTED by the operator` for its ADR-051 half and by `product`, inside the envelope, for this one: a second `after insert` trigger, on the table of invited addresses, posts to the same function, and an invitation row is addressed to an entered address rather than to someone who can read the event. The function still authorizes nothing, reads nothing and holds no database credential, and the database still decides every recipient. The text below is left as written.

**Inside the envelope, so accepted by the agent (RULE-09, ADR-008).** It supersedes and reverses
nothing. [ADR-051](ADR-051-a-server-side-component-sends-event-email-and-authorizes-nothing.md)
decision 1 leaves the mechanism to `tech-lead-design` at `/plan` of `EVT-05`; this ADR is that
choice. Its decision 7 leaves the provider, the key holder and the sending domain to the operator;
this ADR **records** the operator's answers and authors none of them. The operator reviews it at
merge (CODEOWNERS).

## Context

- ADR-051 admits one server-side component whose whole job is sending event email, which authorizes
  nothing and which the browser never calls.
- `EVT-04` (ADR-050) already writes one `public.notification` row per recipient, from definer
  triggers, only to people who can read the event and never to the actor. Every email ADR-051
  decision 4 names is one of its kinds: `event_created` (narrowed to own-team events),
  `event_invited`, `attendance_approved`, `attendance_rejected`, `attendance_removed`.
- **The operator's answers to idea Q6**, recorded in
  `.ai/board/ideas/2026-10-08-a-person-learns-about-an-event-only-by-going-to-look.md` § *Evidence*:
  Gmail over SMTP with an App Password (*"chọn cách B"*, over the Gmail API with OAuth); no sending
  domain, so no SPF or DKIM records are owed; the sending account is `didi00889900@gmail.com`; the
  From header is `CaleChip <didi00889900@gmail.com>`, the account address itself; the credentials
  live in the gitignored `supabase/functions/.env` and reach the hosted project through
  `supabase secrets set`.
- Supabase's hosted Edge Functions refuse outgoing connections on ports 25 and 587; the sender uses
  465, implicit TLS. TODO(verify) with one real send from the deployed function.

## Decision

1. **The component is one Supabase Edge Function, `send-event-email`**, under
   `supabase/functions/send-event-email/`. It is the product's only server-side code.
2. **The database calls it, nothing else does.** An `after insert` trigger on `public.notification`
   whose kind is one of the five above — `event_created` only when the event's scope is own team —
   posts one request per row through the `pg_net` extension. The request carries everything the
   message needs; **the function holds no database credential and reads nothing.**
3. **The database decides who is mailed.** The trigger skips a recipient who switched event email
   off, and inherits from ADR-050 that every row is already addressed to someone who can read the
   event, other than the actor. The function applies no recipient rule of its own.
4. **The call is authenticated with a shared secret**, held in Supabase Vault on the database side
   and in the function's environment on the other. The function's URL lives in Vault too, so no
   migration carries a project address or a secret. A request without the secret is refused.
5. **The mail is sent through Gmail's SMTP server on port 465 with the account's App Password**,
   using the `nodemailer` package imported as `npm:nodemailer` with its major pinned in the import.
   That is the only dependency this ADR adds, and it is reachable only from
   `supabase/functions/send-event-email/`.
6. **A failed send is logged and never retried.** The action that caused it has already committed and
   is never rolled back (ADR-051 § *Consequences*); the trigger swallows its own failure so a missing
   extension, secret or function never fails a user's write. The record of a failure is the
   function's log and `pg_net`'s response table.

## Rationale

**Rejected: the function reads the notification itself, with the service-role key**, given only a
row id. It shrinks what a leaked hook secret can do — re-send real mail, not write arbitrary mail —
but it puts the key that bypasses every row-level policy into the one component ADR-051 says
authorizes nothing, and makes the function's reads a second place where recipients could be decided.
A function that cannot read the database cannot be the component that broke ADR-051 decision 2.

**Rejected: a Supabase Database Webhook configured in the dashboard.** It is `pg_net` underneath, but
it lives outside the migrations, so no review sees it and no fresh project reproduces it.

**Rejected: the browser asks the function to send after each action.** ADR-051 decision 3 forbids
the browser calling it, and a tab closed between the action and the call loses the mail silently.

**Rejected: an SMTP client written by hand over `Deno.connectTls`.** It removes the dependency, but
MIME, UTF-8 headers for Vietnamese names, and `AUTH LOGIN` are exactly where a hand-written client
fails quietly, and a lost email is not visible to anybody.

**Rejected: the Gmail API over OAuth** — the operator's own Q6 branch A, offered and not chosen.

## Consequences

- **A Gmail account's daily sending limit is the product's.** A team event mails every other approved
  member of the team at once; a team larger than Gmail's per-day cap would lose the excess. Not
  reached at this product's size; recorded so it is not a surprise.
- **Deploying is three manual steps beside `pnpm build`**, all human (RULE-09): apply the migration;
  `supabase secrets set --env-file supabase/functions/.env` and
  `supabase functions deploy send-event-email --no-verify-jwt`; create the two Vault secrets. The
  function checks its own secret, which is why the platform's JWT check is switched off for it.
- **Until those steps are done, nothing is mailed and nothing fails.** The trigger finds no Vault
  secret and does nothing.
- **Who holds the Gmail account is not recorded.** The operator supplied its App Password; whoever
  can sign in to `didi00889900@gmail.com` can read every reply and bounce, and can revoke the
  password, which stops all event email.
- **ADR-051 § *Consequences*' line on SPF and DKIM no longer applies**: mail leaves from a Gmail
  address on Google's own domain. Its text is unchanged.
- **`.ai/standards/tech-stack.md` should name the Edge Function runtime and this package.** That
  file's own last section says an agent stops rather than edits it, so the line is owed to `/thuki`
  rather than written by the ticket that needed it.

## Revert condition

Either, one occurrence:

1. **The function is given a database credential, or reads or writes product data.** On
   observation: remove it; decision 2 has been broken, and ADR-051 decision 2 with it.
2. **The package is imported anywhere outside `supabase/functions/send-event-email/`.** On
   observation: remove the import.

ADR-051's own two revert conditions apply on top.

## Affected documents

- `.ai/board/tickets/EVT-05/01-plan.md` — the contract this ADR's decisions become.
- `.ai/standards/data-model.md`, `.ai/standards/rbac-and-security.md` — the opt-out column, its RPC
  and the trigger. Written by `EVT-05`.
- `.ai/standards/tech-stack.md` — owed to `/thuki` (Consequences, last item).
