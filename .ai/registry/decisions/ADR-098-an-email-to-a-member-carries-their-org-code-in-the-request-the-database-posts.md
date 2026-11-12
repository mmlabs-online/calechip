---
doc_version: 3
last_updated: 2026-11-12
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-098 — An email to a member carries their org code in the request the database posts

## Status

`ACCEPTED by tech-lead-design under the operator's delegation (ADR-067)`

2026-11-12 — at `/plan MIR-19-e` (ADR-008, ADR-067).

This ADR decides *how* ADR-097 decision 5.3 (*"Email links carry the org"*) is carried out. It
reverses no accepted decision: it keeps ADR-051 decision 2 and ADR-053 decision 3 exactly as they
stand, and ADR-097 decision 6 (guest links stay token-only).

## Context

Read on 2026-11-12 at `origin/main` `a6f9d4a` (MIR-19-d shipped).

- **The sender reads nothing.** `supabase/functions/send-event-email/index.ts` holds no database
  credential (ADR-053) and renders only the request it is handed: *"the request carries everything
  the message needs"* (its header). The button link is built from `APP_URL` and the event id alone
  (`template.ts:269`); the profile link from `APP_URL` alone (`template.ts:262`).
- **Two trigger functions build the request.** `public.email_notification()`, last defined in
  `20261009090000_evt05_event_email.sql`, and `public.email_invitation()`, last defined in
  `20261014090000_evt12_invite_every_scope.sql`. Both are `security definer` and both already join
  the recipient's `public.member` row (the invitation's member branch only).
- **A member is routed into their own org only.** MIR-19 serves `/{own_org}/…`; any other org's
  address shows `org-not-found` (ADR-097 decision 4). `public.member_org_id(uuid)` answers an approved,
  not-removed member's org (`20261103120000_mir13_write_path_org_bound.sql:33`).
- **Since MIR-19-d an org-less link still works for a member**: the flip carries `/events/<id>` on to
  `/{own_org}/events/<id>`. So a missing org code is a cost of one extra hop, not a broken link.
- **The function and the migration are deployed separately, by a person** (RULE-09, ADR-053
  *Consequences*), in either order.

## Decision

1. **The org code travels in the request.** Each trigger function adds one key, `orgCode`, to the
   JSON body it posts: the `org_code` of `public.member_org_id(<recipient member id>)`. The function
   still reads nothing.
2. **It is the recipient's org, not the event's.** The link is for the person opening it, and the
   router only ever serves that person their own org. A recipient the database has decided may read
   the event is in the event's org in every case MIR-11 allows, so the two agree; where they could
   not, the recipient's is the one that opens.
3. **A guest request carries `orgCode: null`.** ADR-097 decision 6: a guest has no org, and an
   outsider is never told one.
4. **A request without a usable `orgCode` renders the root links it renders today.** Absent or `null`
   gives `${APP_URL}/events/<id>` and `${APP_URL}/profile`. A present value that is not a string in
   `org_code_shape` refuses the request as malformed, as any other malformed field does. This makes
   either deploy order safe: an old function ignores the new key, and a new function given an old
   body sends root links.
5. **Only the two member links move**: the event button and the profile link. The logo and the
   product link in the footer stay at `APP_URL`; they appear in the guest mail too, and `/` sends a
   member to their org (MIR-19-d).
6. **The migration re-creates the two functions and nothing else.** No trigger, policy, constraint,
   table or grant changes; the grants are restated as they stand. Under ADR-014 it is still not
   `schema_delta: none`, because it re-creates functions that triggers run.

## Options considered

- **The sender reads the org code itself**, with a service-role key and one `select`. Rejected: it
  gives the one server-side component a database credential, which ADR-053 kept out of it, to read
  a value the trigger already has a row away.
- **The event's org (`event.org_id`) rather than the recipient's.** Rejected (decision 2): it is the
  same value whenever the recipient can read the event, and the wrong one in the only case where they
  differ.
- **Leave the links at the root and let the flip carry them.** Rejected: ADR-097 decision 5.3 asks
  for the org in the link, and the root link costs every reader a redirect and shows an org-less
  address first.
- **Make `orgCode` required.** Rejected (decision 4): a function deployed before the migration would
  answer 400 to every request, and ADR-053 decision 6 drops a failed send without retry.

## Consequences

- The request shape of EVT-05 and EVT-08 gains one optional key. `tests/event-email.test.ts` and
  `tests/event-invitation.test.ts` keep passing unedited, because a request without the key parses
  and renders exactly as before.
- The template restates `org_code_shape` (it imports nothing). That is a fourth copy of the shape,
  beside the constraint, `src/lib/org-path.ts` and the system panel's mock.
- Applying the migration and redeploying the function are human steps (RULE-09).

## Revert condition

A screen needs an emailed link to open in an org other than the reader's own — for instance a
cross-org event. Then the event's org replaces the recipient's in decision 2.
