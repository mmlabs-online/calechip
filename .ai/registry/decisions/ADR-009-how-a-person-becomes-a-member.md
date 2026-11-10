---
doc_version: 3
last_updated: 2026-09-10
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-009 — A person joins by signing up against an allow-list

## Status

**`SUPERSEDED by ADR-033` — 2026-09-10.** The order is reversed: everybody who signs up gets a
`member` row, and an admin approves or rejects them afterwards. `allowed_email` is dropped. What
survives untouched is the mechanism this ADR chose and the reason it chose it — `signUp` on the
ordinary client, no server, no service-role key, ADR-005 unmoved. **Nothing below is edited**; the
whole value of this file now is the record of what was decided first.

`ACCEPTED by the operator` — 2026-08-31. Superseded, not reversed on its own terms.

Recorded, not authored. Offered three paths — an Edge Function holding the service-role key, a
self-serve sign-up gated by an allow-list, and a claim token. The operator chose:
*"Tự phục vụ: signUp + allow-list."*

## Context

`/triage` returned `NEEDS-ADR` on the first idea about team membership, and pointed at open question 4
in `.ai/standards/data-model.md`, which had already recorded itself as blocking *"the first story
touching team management"*. This is that story.

The question underneath it: **a `member` row's primary key is `auth.users(id)` (ADR-005 and the data
model), so the row cannot exist before the auth user. How does the auth user come to exist?**

**The finding that decided it, verified in the installed types rather than recalled.**
`inviteUserByEmail` is declared on `GoTrueAdminApi` — `GoTrueAdminApi.d.ts:131`, reached as
`supabase.auth.admin.inviteUserByEmail(...)`. The admin surface requires the **service-role key**,
which bypasses row-level security entirely. `signUp` is not on that surface at all; it is on the
ordinary client.

ADR-005 left no server. So the Supabase invite flow, as the idea assumed it, **cannot be built
without first reversing ADR-005** — a service-role key in a browser bundle would hand every visitor
full read and write on every table.

## Decision

**A person joins by signing themselves up. An admin controls who may.**

1. An admin adds an email address to an **allow-list** table. This is an ordinary write, governed by
   the same row-level security as everything else — no elevated key anywhere.
2. The person signs up through `supabase.auth.signUp`, on the ordinary client.
3. A database trigger on `auth.users` creates the `member` row **only if** the address is on the
   allow-list, and consumes the entry.

**No server, no Edge Function, no service-role key.** ADR-005 stands unchanged, and its revert
condition is not touched.

This answers open question 4 in `.ai/standards/data-model.md`, and question 1 of *"who removes a
member"* is unaffected — removal stays a soft delete.

## Rationale

The alternative with the best user experience was an Edge Function holding the service-role key, so
that an admin could send a real invitation email. It was rejected because **it is precisely the thin
server seam ADR-005 examined and refused this morning**, and adopting it here would mean superseding
that ADR as a side effect of a membership feature rather than as a decision taken on its own terms. A
decision that large should not arrive attached to something else.

A claim token — the admin generates a token and delivers it by any channel — was rejected as the same
shape as the allow-list with an extra table, an expiry policy and a revocation story to maintain. The
allow-list achieves the same control using the email address the person will sign up with anyway.

## Consequences

What becomes true:

- Membership is controlled without any elevated credential existing anywhere in the system.
- The trigger is the enforcement point, so it holds against anyone signing up, not just against this
  application's UI.

**What becomes harder:**

- **There is no invitation email.** The admin adds the address and then tells the person by whatever
  channel the team already uses. For a team of five to thirty that is a message, not a feature — but
  it is a real difference from what the idea imagined, and the story must say so rather than implying
  an email arrives.
- **A person who signs up before being allow-listed gets an auth user with no member row.** That
  state must be handled in the interface, not left to look like a bug. It is also a small privacy
  surface: sign-up succeeds and reveals nothing, which is the correct behaviour.
- **The allow-list is a new table**, with its own policies and its own place in the permission matrix.

## Revert condition

**The first time the team needs to onboard somebody whose email address nobody knows in advance**, or
the first time the absence of an invitation email is what stops a person joining. Either means the
allow-list is the wrong shape, and the claim-token path — not the Edge Function — is the cheaper
correction, because it also needs no server.

Reaching for the Edge Function requires superseding ADR-005 on its own terms first.

## Affected documents

| File | Change |
|---|---|
| `.ai/standards/data-model.md` | Open question 4 answered; the allow-list table added |
| `.ai/standards/rbac-and-security.md` | The allow-list rows enter the permission table |
| `.ai/board/ideas/2026-08-31-nobody-can-join-the-board.md` | Unblocked; ready to re-triage |
