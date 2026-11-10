---
doc_version: 3
last_updated: 2026-08-31
governed_by: [RULE-01, RULE-04, RULE-09]
---

# ADR-016 — Only an admin may change an entry's decision columns, and the guard is a trigger

## Status

`ACCEPTED by tech-lead-design` — 2026-08-31.

**This decision sits inside ADR-005, and it is the closest call of the four ADRs written today. A
reviewer should meet that rather than discover it.** [ADR-005](ADR-005-authorization-in-rls.md) says,
in words: *"Row-level security provides authorization, and is the only mechanism that enforces it."*
The guard decided below is authorization **in the database but not in a policy**, and read literally
that sentence is reversed. Two reasons it is nevertheless inside the envelope, and the second is the
decisive one. First, ADR-005's own revert condition names the failure as *"the first permission
requirement that cannot be expressed as an RLS policy without duplicating the rule in application
code"* — nothing here reaches application code: no server, no Edge Function, no TypeScript check, and
the enforcement point remains the one the attacker also has to go through. Second, **ADR-005 already
puts INV-02 in a trigger** — *"INV-01 becomes a PostgreSQL exclusion constraint, INV-03 a check
constraint, and INV-02 a trigger"* — so a trigger on `entry` is a mechanism that ADR itself names,
and this one is merged into that very trigger rather than added beside it. The precedent for the
shape is [ADR-011](ADR-011-inv-01-exclusion-constraint.md): ADR-005 said which layer, and the ADR
decides what it operates on.

**If the operator reads *"and nowhere else"* literally and disagrees at merge, ADR-008's revert
condition fires** and RULE-09 returns to v1. That is the correct outcome of a disagreement and is why
the tension is stated here instead of being smoothed into the Rationale.

Two documents this ADR deliberately does not edit, both registry and both human-only under RULE-01:
`.ai/registry/invariants.md` and `.ai/registry/glossary.md`. Neither INV-02 nor INV-03 changes text;
the findings that touch them are recorded under *Consequences* for a human, unwritten.

## Context

`.ai/board/ideas/2026-08-31-no-way-to-tell-a-settled-plan-from-a-typed-one.md` asks for approval,
rejection with a reason, bulk rejection and an admin worklist. `.ai/standards/rbac-and-security.md`
carries the permission rows already — *Approve or reject another member's entry* (❌ / ✅) and
*Approve or reject their own entry* (❌ / ✅) — so **a member may not approve their own entry**, and
the idea says correctly that it *"consumes the permission model rather than deciding it"*.

It consumes a model that cannot be built as written, and that is why this ADR exists.

Four columns on `entry` carry the decision: `status`, `rejection_reason`, `approved_by`,
`approved_at` (`.ai/standards/data-model.md`, `doc_version: 4`). Under ADR-005 the browser holds the
user's own token and PATCHes PostgREST directly, so the only thing between a member and
`{"status":"approved"}` on their own row is a row-level security policy.

**A policy cannot stop it.** An RLS `UPDATE` policy has `using`, which sees the OLD row, and
`with check`, which sees the NEW row, and **no expression can see both**. "`status` did not change"
is therefore not expressible. Permissive policies OR together, so CAL-02's member own-entry policy —
`using (member_id = (select auth.uid())) with check (member_id = (select auth.uid()))` — admits the
forged row on its own, whatever the admin policy beside it says.

`.ai/standards/rbac-and-security.md` known weakness 1 describes exactly this class: a policy written
too permissively **fails open and silently** — no error, no log. Here it is not written too
permissively; it is written as permissively as the mechanism allows.

Three further facts constrain the answer.

- **`member` and `admin` are one PostgreSQL role.** Both authenticate as `authenticated`; the rank is
  a column on `public.member`, read through `public.is_admin(uuid)`
  (`supabase/migrations/20260831150024_tea01_membership.sql:54-62`).
- **`approved_by` is the only audit trail v1 has** (`data-model.md`), and it matters more than usual
  because known weakness 3 says an admin may edit any member's entry with no other trace.
- **INV-02 is silent on rejected entries.** It reads *"An **approved** entry whose dates, type,
  portion or tentative flag change returns to `pending`."*

## Decision

### 1. One `BEFORE UPDATE` trigger on `entry`, holding the guard and INV-02 together

The guard and INV-02's reset are **one function and one trigger**, not two. Names, real under RULE-04
from this point — they are what appears in the migration, in the seam's types, and in any design
section 1 touching `entry`:

- function `public.entry_enforce_decision()`
- trigger `entry_enforce_decision`, `before update on public.entry for each row`
- policy `entry_update_admin`

```sql
create function public.entry_enforce_decision() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- (a) The guard. Only an admin may move the four decision columns.
  --     v_uid is null in a migration, the SQL editor or a service-role call; that context is not
  --     blocked, because nothing blocks a service-role key anyway (known weakness 1).
  if (new.status           is distinct from old.status
   or new.rejection_reason is distinct from old.rejection_reason
   or new.approved_by      is distinct from old.approved_by
   or new.approved_at      is distinct from old.approved_at)
     and v_uid is not null
     and not public.is_admin(v_uid) then
    raise exception 'only an admin may decide an entry'
      using errcode = '42501';
  end if;

  -- (b) Provenance. Never trusted from the wire, in either direction.
  if new.status = 'approved'::public.entry_status
     and old.status is distinct from 'approved'::public.entry_status then
    new.approved_by      := v_uid;
    new.approved_at      := now();
    new.rejection_reason := null;      -- INV-03 is a biconditional; see part 3
  elsif new.status is distinct from 'approved'::public.entry_status then
    new.approved_by := null;
    new.approved_at := null;
  end if;

  -- (c) INV-02, and the rejected-entry hole closed with it. Runs LAST, on purpose.
  if (new.start_date is distinct from old.start_date
   or new.end_date   is distinct from old.end_date
   or new.type       is distinct from old.type
   or new.portion    is distinct from old.portion
   or new.tentative  is distinct from old.tentative)
     and old.status <> 'pending'::public.entry_status then
    new.status           := 'pending'::public.entry_status;
    new.approved_by      := null;
    new.approved_at      := null;
    new.rejection_reason := null;
  end if;

  return new;
end;
$$;
```

**`security invoker`, not `security definer`.** The function needs no privilege of its own: it reads
`auth.uid()` and calls `public.is_admin`, which is already `security definer` and already granted
(`…tea01_membership.sql:71`). Nothing is elevated, so nothing has to be reasoned about.

**Order inside the function is the whole design.** The guard reads the values the client sent, before
any clause below has touched them. A member editing dates on an approved entry passes (a) — at that
point `new.status` still equals `old.status` — and is then reset by (c). Reverse the two and the
guard sees a `status` change **made by the reset itself** and refuses a member's legitimate edit.

### 2. The trigger stays actor-blind on INV-02, and rewrites provenance on the decision

**INV-02 fires for an admin's edit under CAL-03 exactly as for the owner's.** The trigger *can*
distinguish — `auth.uid()` and `is_admin()` are both reachable — and does not, on three grounds:
INV-02's text carries no actor qualifier; `.ai/registry/invariants.md` gives the reason as *"an entry
displaying an approved star for content that no admin ever saw is a false record"*, and an editing
admin is not necessarily the approving one; and an actor-conditional reset takes the **not-admin
branch silently when `auth.uid()` is null** — a migration, the SQL editor, a service-role call — so
the same edit would mean different things depending on where it was issued. The cost of no carve-out
is one click: self-approval is permitted (`rbac-and-security.md`), so the admin re-approves and
`approved_at` then tells the truth.

**`approved_by` and `approved_at` are written by the database and never by the client.** Clause (b)
overwrites whatever arrived. The two roles are treated differently on purpose: a **member** sending a
forged `approved_by` is refused with `42501` by clause (a), because the request is illegitimate and
should say so; an **admin** sending another admin's id is silently corrected to their own, because
the request is legitimate and only its provenance is wrong.

### 3. A substantive edit to a *rejected* entry returns it to pending and clears the reason

INV-02 is silent here, so as things stand a rejected entry edited substantively keeps
`status = 'rejected'` and keeps a `rejection_reason` describing dates that no longer exist. INV-03's
check is satisfied, so nothing complains.

**This is the likely path, not an edge case.** ADR-011 records that a rejected entry still occupies
its portion under INV-01, which has no status carve-out — so the member **cannot create a replacement
on the same dates**, and editing the rejected entry is the only route open to them. The commonest
thing that happens after a rejection lands in the one case nobody specified.

Clause (c)'s `old.status <> 'pending'` therefore covers `rejected` as well as `approved`. This
contradicts neither invariant: INV-02 is silent, and INV-03 is preserved because the reason is
cleared in the same statement. **No registry edit is required, which is why this ADR may decide it.**

**Clearing the reason is forced, not chosen.** `.ai/standards/data-model.md` specifies INV-03's check
*"in both directions"* — a biconditional, `(status = 'rejected') = (rejection_reason is not null and
btrim(rejection_reason) <> '')`. Any transition off `rejected` that does not null the column is
refused with a raw SQLSTATE `23514`. The same coupling binds an admin **approving a previously
rejected entry**: one statement must set `status`, `approved_by`, `approved_at` and null
`rejection_reason` together, which is why clause (b) nulls it rather than leaving it to the caller.

### 4. Bulk rejection is a `security invoker` function, not a PATCH with `id=in.(…)`

Verified on disk against the installed client, not recalled. Every line below is in
`node_modules/.pnpm/@supabase+postgrest-js@2.112.4/node_modules/@supabase/postgrest-js/`, reached
from `@supabase/supabase-js@2.112.4`; the three files are cited by name from here on.

- `PostgrestQueryBuilder.ts:1570` — `update(values)` sets `const method = 'PATCH'`. One request.
- `PostgrestFilterBuilder.ts:825-847` — `in(column, values)` appends `` `in.(${cleanedValues})` ``
  **to the query string**, after `Array.from(new Set(values))`.

So the naive form is genuinely one round trip, and it is still **wrong for the batch**:

**The ceiling.** A uuid plus its comma is 37 bytes in the URL, so a hundred entries is ~3.7 KB of
`in.(…)` and a few hundred meets a proxy's request-line cap as an opaque **414** — at the exact
moment an admin clears a backlog, which is the only moment bulk rejection exists for. Chunking
reintroduces cross-chunk partial failure that the single statement did not have.

**Three partial-failure behaviours of the naive form**, all real:

1. **Atomic on failure.** One PATCH is one statement is one transaction: if any row fails INV-03's
   check or clause (a), **none** are rejected. The safe direction — and the admin who selected eight
   gets zero, with no indication which one failed.
2. **Silently partial under RLS.** Rows the policy does not admit are **filtered, not errored**.
   "Reject 8" updates 5 and returns HTTP 200. This is the fail-quiet case; it needs an affected-count
   assertion and **not** an `!error` check.
3. **Deduplication.** `in()` collapses duplicate ids before sending them.

The decision:

```sql
create function public.reject_entries(p_ids uuid[], p_reason text) returns integer
  language plpgsql security invoker set search_path = '' as $$
declare v_n integer;
begin
  if btrim(coalesce(p_reason, '')) = '' then
    raise exception 'a rejection carries a reason' using errcode = '22023';  -- INV-03, legibly
  end if;
  update public.entry
     set status = 'rejected'::public.entry_status, rejection_reason = p_reason
   where id = any (p_ids);
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke all on function public.reject_entries(uuid[], text) from public;
grant execute on function public.reject_entries(uuid[], text) to authenticated;
```

**It is `security invoker`, and that is what keeps this inside ADR-005.** No authorization moves into
the function: `entry_update_admin` and clause (a) both still run, exactly as for a single PATCH. The
function is a **transport change**, not an enforcement layer, and an ADR that let it be
`security definer` would be moving the check — which is the thing the Status section says this ADR
does not do.

What it buys: the ids travel in the POST body, so behaviour 3's ceiling is gone; `= any(p_ids)`
handles duplicates, so behaviour 3 is moot; the returned count makes behaviour 2 **detectable**, so
the seam can compare it against the selection size and say *"5 of 8"* instead of *"done"*; and
behaviour 1 is unchanged and still atomic. An empty reason is refused with a sentence rather than a
`23514`.

**The single approve and the single reject stay a plain PATCH.** This function is for the batch only;
one row does not need it, and a second path for N=1 is a second thing to keep correct.

`TODO(verify):` `.maxAffected(n)` (`PostgrestTransformBuilder.ts:1042-1054`, sending
`Prefer: handling=strict, max-affected=n`) is typed `MaxAffectedEnabled<ClientOptions['PostgrestVersion']>`
and its own doc comment says *"Only available in PostgREST v13+"*. The PostgREST major behind the
hosted project is unconfirmed — no project is provisioned, and ADR-011 carries the same marker for
the PostgreSQL major. Note that it caps a **maximum** and cannot detect *fewer* rows than expected,
which is the direction that matters here.

`TODO(verify):` whether PostgREST's `db-max-rows` caps a PATCH's **returned representation** or its
**affected rows**. The two readings fail in opposite directions — the first makes the returned count
understate and produces false alarms, the second silently rejects a prefix of the batch — and neither
can be confirmed from a file in this repository. Read PostgREST's own configuration documentation
before the seam trusts the count.

## Rationale

Four mechanisms were available for part 1. Two do not work at all, and recording *why* is most of the
value of this document, because both look correct.

- **`with check (status = 'pending')` on the member's own-entry policy.** It appears to close the
  hole and is **wrong for an INV-02 reason**: editing only the note does not revoke an approval, so a
  member must be able to write a row whose `status` is `approved`. The policy would break the one
  case INV-02 went out of its way to exempt.
- **A restrictive (`as restrictive`) policy.** It ANDs rather than ORs, which fixes the permissive
  composition — and it still has no OLD row, so it cannot say "did not change" either.
- **A column-level `GRANT`, as ADM-01 used for `team.overload_threshold`.** This is the instructive
  contrast rather than a near-miss. ADM-01 works because **nobody** may rename the team, so
  `grant update (overload_threshold)` is uniform across roles. Here `member` and `admin` are the same
  PostgreSQL role, `authenticated`; column privileges are per-role, so revoking `status` from
  `authenticated` **blocks the admin too**. A control that cannot express the distinction cannot
  enforce it.
- **A column grant plus a `SECURITY DEFINER` RPC** — `approve_entry(uuid)`,
  `reject_entries(uuid[], text)` running as owner. This one works. It is rejected because it moves
  the authorization check into a function while ADR-005 places it in the database's declarative
  layer, adds a second write surface beside PostgREST that has to be kept in step with the policies
  under it, and buys nothing the trigger does not: the trigger already sees OLD and NEW, which is the
  only capability the whole problem needed. Recorded rather than dismissed, because if the trigger
  ever needs state it cannot reach, this is what returns.

Part 4 rejected the chunked PATCH: it is simpler, needs no migration, and reintroduces exactly the
partial failure the single statement avoided — an admin clearing a backlog would get some chunks
applied and some not, with no transaction spanning them.

A fifth shape was considered for part 1 and refused: **moving `status` into an `entry_decision` table**
so the decision is a separate row with its own policies and RLS alone suffices. It contradicts
`data-model.md`'s `status` column, which is operator-decided schema, and a schema change is
permanently human under RULE-09. Not taken, and not routed around.

## Consequences

**`approved_by` stops being forgeable, and that is the finding this ADR leads with.** Before it, the
only audit trail v1 has arrived in a PATCH body the admin composed; one admin could write another
admin's id into it, and known weakness 3 means nothing anywhere would contradict them. The column
that exists precisely because admin edits are untraceable was itself untraceable. After clause (b),
`approved_by` and `approved_at` are **unwritable from the wire** — whatever is sent is discarded and
replaced — which also makes CAL-05's *"displaying who approved is not approving"* true by
construction rather than by the story remembering it.

**A member's forged approval is refused, loudly.** `42501` reaches the browser as a PostgREST `403`.
The seam must turn it into a sentence; a raw SQLSTATE at that moment is the same failure ADR-011
recorded for `23P01`.

**The permission-model test gains its sharpest case, and it is a denial.** Per
`.ai/standards/testing-standards.md`, a permission test asserting only the allow cases passes when
the check is deleted. The case is: *a member PATCHes `{"status":"approved"}` against their own entry
and is refused* — issued against a real PostgreSQL with a member's token, not through the seam, since
the seam is where the affordance lives and not where the control is.

**What becomes harder:**

- **The trigger ordering trap is closed by construction and would reopen on the next trigger.**
  PostgreSQL fires same-event triggers **alphabetically by name**, so two `BEFORE UPDATE` triggers on
  `entry` would have their order decided by spelling. One function is what makes the order explicit.
  Anyone adding a second `BEFORE UPDATE` trigger to `entry` inherits this problem silently.
- **The function is created twice, across two tickets.** CAL-01's `ticket.yaml:16` already says its
  migration ships *"INV-02's trigger"*. Under this ADR that migration creates
  `public.entry_enforce_decision()` in its INV-02-only form, and the approval ticket **replaces** it
  with `create or replace function` rather than adding a second trigger. CAL-01's design must use
  this name — which RULE-04 now makes real — or the replacement lands beside the original instead of
  over it.
- **`public.is_admin(uuid)` needs no grant here**, verified on disk:
  `supabase/migrations/20260831150024_tea01_membership.sql:71` already does
  `grant execute on function public.is_admin(uuid) … to authenticated`. A second grant is the
  redundant-grant trap ADM-03 recorded — it reads as a control and is not one.
- **The `entry` table grant is not inherited.** TEA-01's
  `revoke all on public.team, public.member, public.allowed_email from anon, authenticated`
  (`…tea01_membership.sql:145`) names three tables because `entry` did not exist. So CAL-01 writes
  its own `revoke all on public.entry`, and every ticket adding an `entry` write writes its own
  `grant`. This is the third time this trap has been found — ADM-01 on `team`, ADM-02 on `holiday`.
- **Authorization on `entry` is now in two places to read**: the policies, and clause (a). Review
  checks R6 and R8 must read both, and a reviewer who reads only the policies will conclude the model
  is broken — correctly, for what they read.

**Three findings this ADR records and does not fix:**

- **`.ai/board/tickets/CAL-02/ticket.yaml:16` and `CAL-03/ticket.yaml:16` both say
  `schema_delta: none`**, while CAL-02's own comment at lines 36-38 says *"This ticket adds the update
  and delete policies"*. Under [ADR-014](ADR-014-policy-migrations-are-not-schema-delta-none.md),
  `ACCEPTED by the operator`, that is not `none`. ADR-014's Consequences exempt *"CAL-04 through
  CAL-07"* by name and are silent on CAL-02 and CAL-03. Two backlog rows are inconsistent with an
  operator-accepted decision. Correcting a ticket outside the active one is not this run's to do.
- **A column grant excluding `member_id` belongs to CAL-02 and CAL-03, not here.** CAL-02's own-entry
  policy catches a reassignment through `with check (member_id = auth.uid())`; CAL-03's admin policy,
  `using (public.is_admin(…))`, would **happily reassign an entry to another member** and break
  INV-07. `grant update (start_date, end_date, type, portion, tentative, note, status,
  rejection_reason) on public.entry to authenticated` is the control, and it is those rows' to write.
- **`rbac-and-security.md` known weakness 3 is narrowed but not closed by this ADR**, and its text is
  not amended here: an admin's *edit* to another member's entry is still untraced, and only the
  *decision* now carries reliable provenance. A human may wish to record that distinction in that
  file; this run does not write it.

## Revert condition

**Two observable signals, either one.**

1. **The first `entry` row found where `status <> 'approved'` and `approved_by is not null`, or
   `status = 'approved'` and `approved_by is null`.** One occurrence is enough: it means clause (b)
   or clause (c) is not doing what this ADR says, and `approved_by` is the only audit trail v1 has —
   a false one is worse than none, which is the same standard `.ai/registry/invariants.md` applies to
   an invariant claimed and not held. Record it in the invariant decision log in
   `.ai/board/metrics.md` and correct the function. This is checkable as a single query and should
   be one, in the permission-model test's fixtures.

2. **The first permission requirement on `entry` that clause (a) cannot express** because it needs
   state the trigger cannot reach from OLD, NEW and `is_admin()`. The brief's P2 list has a plausible
   candidate — *"hai người này không được nghỉ cùng ngày"* — and it is the same candidate ADR-005's
   own revert condition names. At that point the `SECURITY DEFINER` RPC alternative returns on its
   own terms, and if it too is insufficient, ADR-005 is what is wrong rather than this.

A third, slower signal worth watching: **a second `BEFORE UPDATE` trigger appearing on `entry`**. The
single-function property is what makes the ordering explicit, and once it is gone the guard's
correctness depends on trigger names sorting the right way, which nobody will notice until a member's
ordinary edit is refused.

## Affected documents

| File | Change | doc_version |
|---|---|---|
| `.ai/standards/data-model.md` | The *Where invariants are held* INV-02 row records the merged guard and names `public.entry_enforce_decision()`; a new row records the decision-column guard and the provenance rewrite | 4 → 5 |
| `.ai/registry/invariants.md` | **No change.** INV-02 and INV-03 are held as written; part 3 decides behaviour the invariants are silent on, and silence is not a contradiction | unchanged |
| `.ai/registry/glossary.md` | **No change.** No term is added or redefined | unchanged |
| `.ai/standards/rbac-and-security.md` | **No change on this run.** The permission table is consumed, not amended; the narrowing of known weakness 3 is recorded above for a human | unchanged |
| `.ai/board/tickets/CAL-01/ticket.yaml` | **Not edited here.** Its migration must use the function name fixed above; recorded as a consequence | unchanged |
| `.ai/board/tickets/CAL-02/ticket.yaml`, `CAL-03/ticket.yaml` | **Not edited here.** Their `schema_delta: none` is inconsistent with ADR-014; recorded as a finding | unchanged |
