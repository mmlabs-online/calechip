---
doc_version: 3
last_updated: 2026-09-01
governed_by: [RULE-01, RULE-09]
---

# ADR-018 — Who may read the member list, and the policy that carries it

## Status

`ACCEPTED by steward` — 2026-09-01.

**Under ADR-008, and the distinction matters here more than usual.** The *permission* is the
operator's and was confirmed by them on 2026-08-31: the `Read the member list` row in
`.ai/standards/rbac-and-security.md` is ✅ for member and ✅ for admin, recorded there as derived,
flagged, then confirmed. The *policy shape* below is mine, and I cannot point at the operator saying
any of it, so this is not `ACCEPTED by the operator`. It sits inside an accepted envelope rather than
changing one, which is the test ADR-008 states.

`.github/CODEOWNERS` puts it in front of the operator at merge regardless — RULE-01 has not moved.

## Context

TEA-03 fails Definition of Ready item 4. Its `schema_delta` is a policy change, ADR-014 admits no
carve-out for a `select` policy, and nothing in `.ai/registry/decisions/` decides who may read the
member list. ADR-013 requires the roster without saying who reads it. ADR-005 says authorization
lives in policies, and citing it for one particular policy would exempt every policy from ADR-014.

What exists today, from TEA-01's migration
(`supabase/migrations/20260831150024_tea01_membership.sql`):

- `select on public.member` is granted to `authenticated`, revoked from `anon`.
- One select policy, `member_select_own`, `using (id = (select auth.uid()))`.
- Two `security definer` helpers. `public.member_team_id(uid)` returns the caller's `team_id` **and
  filters `removed_at is null`**, so a removed caller resolves to `null`.
- No insert, update or delete policy on `member`, deliberately and permanently: the admission trigger
  is the only writer, and any insert policy a signed-in person can satisfy lets them choose their own
  `team_id` and their own `role`.

## Decision

**A signed-in member may read every `member` row belonging to their own team. An admin may read
exactly the same rows and the same fields, and no more.** One permission, two roles — an admin read
written separately, that quietly returns more, is the failure this sentence exists to prevent.

Carried by **adding** a second select policy:

```sql
create policy member_select_team on public.member
  for select to authenticated
  using (team_id = public.member_team_id((select auth.uid())));
```

Three things about that statement are the decision, not the implementation:

1. **`member_select_own` is kept, not replaced.** TEA-03's `ticket.yaml` says the migration *replaces*
   it. That is the one part of the ticket this ADR overturns, and the reason is in *Consequences*.
2. **The policy does not filter `removed_at`.** A removed member's row is returned to their
   teammates, carrying `removed_at`. Which rows the *screen* draws is a display decision above the
   seam; which rows the *read* returns is not — INV-04 cannot derive membership-as-of-a-date from the
   entries, so ADR-013 requires the roster to arrive carrying it.
3. **No insert or delete policy is added to `public.member`, now or by any later ticket.** An
   `update` policy is admissible only when all three of these hold together: the `update` privilege
   is granted **by column** and never blanket; the policy is scoped to an admin of the caller's own
   team; and a `BEFORE UPDATE` trigger enforces every constraint that `WITH CHECK` structurally
   cannot express.

   Restated here because this is the ticket that opens this table's `select`, and the specific risk
   of widening a read is that a write is dragged along with it. `insert` and `delete` keep the reason
   TEA-01 gave them: the admission trigger is the only creator of a `member` row, any insert policy a
   signed-in person can satisfy lets them choose their own `team_id` and `role`, and a delete would
   destroy the `removed_at` ADR-013 requires.

   **Amended 2026-09-01 by ADR-020, on the operator's instruction.** This point read *"No insert,
   update or delete policy is added, now or by any later ticket"* until TEA-04 showed that the only
   implementation satisfying it was a `security definer` write path — which ADR-005 forbids. The
   original wording is kept here rather than replaced silently: it extended TEA-01's reasoning about
   `insert` to `update` and `delete` without saying why, in an ADR about reads, and that is a mistake
   worth being able to find again.

Row-level security policies are permissive and OR together, so the two policies compose without
either one being rewritten.

## Rationale

**Rejected: replace `member_select_own` with the team policy alone**, which is what TEA-03's
`schema_delta` currently describes. It fails on a state the ticket itself says must stay
distinguishable. `member_team_id` filters `removed_at is null`, so a removed member resolves to
`null`, `team_id = null` is never true, and they can no longer read even their own row. The seam's
`readMember` filters by id alone and relies entirely on the policy
(`readMember` in `src/lib/data/supabase.ts`, lines 85-94), so `getOwnMember` would return `null` for a removed member —
byte-identical to the answer for somebody who was never admitted at all. TEA-03's own AC-7 note says
those two states *"are indistinguishable on screen and mean opposite things"*. Replacement makes them
indistinguishable in the datastore, where no screen can recover the difference.

**Rejected: one policy with the combined predicate** `id = (select auth.uid()) or team_id =
public.member_team_id((select auth.uid()))`. It is correct and it is one object instead of two. It
was rejected because it rewrites a policy TEA-01 already shipped and asserted against, to produce
behaviour identical to leaving it alone — a diff whose entire content is risk. Two policies with one
job each also read better in `\d public.member`, and a later ticket narrowing one of them does not
have to re-derive the other's half of the predicate.

**Not considered a live option: denying the read.** The derivation recorded in
`rbac-and-security.md` is that `Read any entry in the team` is already ✅ for a member and the year
view renders one row per member, so a member denied the list could reconstruct it from entries they
are entitled to read. Denying it would deny nothing and leave TEA-03's policy with no row to be
written against.

## Consequences

- **A removed member sees their own row and nobody else's.** `member_select_own` answers, the team
  policy does not, because `member_team_id` filtered them out. That is the correct shape and not a
  side effect worth removing: it is exactly what lets the interface tell a removed person they were
  removed rather than that they were never here.
- **TEA-03's `schema_delta` is wrong as written and needs correcting from *replaces* to *adds*, with
  this ADR linked.** That field belongs to the ticket, at the READY transition, and is the
  orchestrator's write — not mine, and not the BA's.
- **The migration is `create policy` only.** No `drop policy`, no column, no table, no grant — TEA-01
  already granted `select on public.member` to `authenticated`.
- **The team boundary now lives in exactly one predicate**, and INV-07 depends on it holding. Exactly
  one team exists in v1, so TEA-03's AC-2 is unobservable through the interface and has to be
  asserted against seeded data carrying a second team. A one-team fixture passes whether or not the
  scope is there at all.
- **`anon` is unaffected.** The policy is `to authenticated`; a policy written `to public` would
  re-open the table to the key that ships in the browser bundle by design.
- CAL-04 and CAL-06 can be built against this read. They are the tickets that consume the roster with
  `removed_at` per member, and point 2 above is what makes them possible.

## Revert condition

**Any read of `public.member` that returns a row belonging to a team the caller is not on.** Observed
in TEA-03's AC-2 test against two-team seed data, or in the running system. One occurrence is enough
and there is no threshold to reach: this is fail-open, the mode
`.ai/standards/rbac-and-security.md` records as known weakness 1 — no error, no log, just rows that
should not have been returned.

**On revert:** drop `member_select_team` and leave `member_select_own` standing. The member list goes
dark rather than wide, TEA-03 returns to DESIGN, and this ADR is superseded rather than amended.

A second signal, slower and needing a person: **a ticket that requires an admin to read more of
`member` than a member reads.** That would mean the single `Read the member list` row is two
permissions wearing one name, which is a change to the envelope rather than a decision inside it —
so it goes to the operator and supersedes this ADR, and is not settled by widening the policy.

## Affected documents

| File | Change |
|---|---|
| `.ai/board/tickets/TEA-03/ticket.yaml` | `schema_delta` corrected from *replaces* to *adds*, this ADR linked. Written by `orchestrator` at the READY transition |

`.ai/standards/rbac-and-security.md` needs no change — the row it carries is what this ADR records,
and the confirmation note there is the provenance this ADR's `Status` rests on. No rule and no
invariant is amended.
