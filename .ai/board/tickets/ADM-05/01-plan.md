---
ticket: ADM-05
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-05T19:05:27+07:00
inputs_read:
  - .ai/board/tickets/ADM-05/ticket.yaml
  - .ai/board/tickets/ADM-04/01-plan.md
  - .ai/board/tickets/ADM-01/01-plan.md
  - .ai/board/tickets/ADM-03/01-plan.md
  - .ai/board/ideas/2026-08-31-no-way-to-tell-a-settled-plan-from-a-typed-one.md
  - .ai/00-charter.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md
  - .ai/standards/architecture.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - supabase/db.sql
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260903143000_cal02_own_entry_writes.sql
  - supabase/migrations/20260903160000_cal03_admin_entry_writes.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/routes/PendingEntries.tsx
  - src/routes/EditEntry.tsx
  - src/routes/TeamEntries.tsx
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# ADM-05 — Approve or reject an entry, with a reason on rejection

## 1. Problem and scope

**The feature row, transcribed from `.ai/registry/features.md:104` without paraphrase.** The
sentences this plan is built on, in the order they appear:

> Approve or reject an entry, with a reason on rejection
>
> Brief 7.4's write path, over the two permission rows *Approve or reject another member's entry* and
> *Approve or reject their own entry* (❌ / ✅ both) in rbac-and-security.md. **The decision surface is
> ADM-04's list; this row adds the two controls and the mandatory reason to it.** **`schema_delta` is
> not `none`** — the `entry_update_admin` policy, the amendment of `public.entry_enforce_decision()`,
> and the `entry` table grant — with **ADR-016** linked […] **The idea says it consumes the permission
> model rather than deciding it, and that turned out to be false: the model as written cannot be
> built.** […] The guard is therefore a `before update` trigger, merged into the one INV-02 already
> needs, and clause order is load-bearing — ADR-016 §1. **`approved_by` and `approved_at` become
> unwritable from the wire** […] **CAL-01 creates the function in its INV-02-only form**, so this row
> uses `create or replace function` and must not add a second `before update` trigger to `entry` […]
> **A substantive edit to a *rejected* entry also returns it to `pending` and clears
> `rejection_reason`, and this is the likely path rather than an edge case** […] **Clearing the reason
> is forced, not chosen** […] **The member-facing half of INV-03 is an acceptance criterion here: the
> owner of a rejected entry can read the reason, and who rejected it and when, without an admin
> telling them.** v1 has no notification channel and this row must not grow one […] Whether a
> **rejected** entry is drawn at all is CAL-04's open `TODO(project):`, inherited here and not
> re-asked […] **Charter refusal 2 is acceptance criteria here, not a principle** — the seven testable
> conditions are in the verdict section of the idea file, and the trap they exist for is that the
> domain word *duyệt* **is** the HR word, so the guard has to be everything around it. The one a
> developer will cross in good faith: a rejection must remove nothing and lock nothing […]
> **`approved → pending` is not built.** […] Self-approval is permitted and its cost is recorded as
> known weakness 4. **A member's forged approval is refused loudly** — `42501` reaches the browser as
> a PostgREST `403`, and the seam must turn it into a sentence […] **The permission-model test gains
> its sharpest case and it is a denial** […] INV-02 is listed because this row creates the approved
> state that makes the trigger observable at all and amends the function that holds it; INV-05 because
> approving an entry that is still tagged tentative must not clear the tag […] **INV-04 is
> deliberately absent.**

**Who gains what.** An **admin** gains the one lever the product was missing: they can say *"yes, this
one is settled"*, or *"no, and here is what would work instead"*. Every **member reading the calendar**
gains the larger half — the star stops being decoration and starts meaning *an admin has seen this
and accepted it against the team's schedule*, which is what makes a tentative entry four months out
worth declaring. The **member who was refused** gains the reason, which is the one thing that makes a
refusal actionable.

**What this ticket actually owes at the schema level is narrower than `ticket.yaml` says, and the
correction is section 6.** That field names three objects; **`entry_update_admin` was shipped by CAL-03
on 2026-09-03** and is not this ticket's. Two objects are genuinely owed, and `supabase/db.sql` marks
both `[OWED] ADM-05` under ADR-026 decision point 1, item 3.

**`size_estimate`: M.** One migration replacing a function body and adding one grant, two seam
functions implemented twice, two failure codes, one new component mounted on two screens — and no new
table, no new column, no new policy, no new route.

### Out of scope

- **Bulk rejection.** `public.reject_entries(uuid[], text)` is **ADM-06**, and `db.sql` marks it
  `[OWED] ADM-06`. ADR-016 § 4 says in words that *"the single approve and the single reject stay a
  plain PATCH"* and that the batch function is for the batch only.
- **`approved → pending`.** Deliberate un-approval is named in no permission row, and
  `rbac-and-security.md` is human-only under RULE-01, so it is denied until decided — the footing of
  known weakness 6's two rows. `approved → rejected` carries a reason and is the available path.
- **Any fourth `entry_status`, auto-approval, auto-expiry, or any rule that changes a status without
  an admin acting.** The idea's triage puts it out of scope: *"a status that changes itself is exactly
  the false record INV-02 exists to prevent."*
- **Telling the member anything.** No email, no notification, no channel. The reason is satisfied as
  data and reaches its subject **on pull** — AC-15.
- **`updated_by`, or a change feed recording who approved and then rejected.** The idea's triage puts
  it out of scope citing `data-model.md` OPEN QUESTIONS item 5 and the brief's P1. *Open questions*
  item 1 records what that costs this ticket, because it costs it one clause of one AC.
- **Whether a rejected entry is drawn on the calendar.** CAL-04's open `TODO(project):`, inherited and
  not re-asked — the idea says so explicitly.
- **Rendering the star and `approved_by` on the calendar.** CAL-04, CAL-05 and CAL-06 own that
  vocabulary and already ship it. This ticket only makes `status` change.
- **Approval controls on the calendar views.** CAL-05 refuses them from its side; this refuses them
  from the other.
- **Editing the `[OWED]` labels in `supabase/db.sql`.** *Open questions* item 3 — five of them are
  already stale and it is not this ticket's to sweep.
- **Fixing the two limit constants ADM-04 found to be above the datastore's cap.** ADM-04 *Open
  questions* item 4; still owed a `BUG` row, still not this ticket's.

## 2. Acceptance criteria

Observable through the interface or through `pnpm test`. The selector attribute is `data-testid`.

**AC-1 — an admin approves a pending entry**
- **Given** an admin on the worklist and an entry whose `status` is `pending`
- **When** they approve it
- **Then** the entry's `status` becomes `approved`, it leaves the worklist, and the outstanding count
  drops by one

**AC-2 — an admin rejects an entry, with a reason**
- **Given** an admin on the worklist and a pending entry
- **When** they reject it with a non-empty reason
- **Then** the entry's `status` becomes `rejected`, it carries that reason, and it leaves the worklist

**AC-3 — a rejection with no reason is refused, and nothing is written**
- **Given** an admin rejecting an entry
- **When** the reason is empty or is only whitespace
- **Then** the rejection is refused with a sentence, the entry's `status` is unchanged, and no
  raw SQLSTATE reaches the screen

**AC-4 — approving a rejected entry clears its reason**
- **Given** an entry whose `status` is `rejected` and which carries a reason
- **When** an admin approves it
- **Then** its `status` is `approved` and its `rejection_reason` is empty — the two are written in one
  statement, because INV-03's check refuses any transition off `rejected` that leaves the reason
  standing

**AC-5 — an admin edits the reason on an entry that is already rejected**
- **Given** a rejected entry carrying a reason
- **When** an admin rejects it again with different wording
- **Then** the entry keeps `status` `rejected` and carries the new reason, and no approval is created
  or destroyed by the edit

**AC-6 — approving does not clear the tentative tag (INV-05)**
- **Given** a pending entry whose `tentative` flag is set
- **When** an admin approves it
- **Then** its `status` is `approved` **and** it is still tentative — two independent axes, and the
  entry shows both

**AC-7 — `approved_by` and `approved_at` are the datastore's, never the client's**
- **Given** an admin approving an entry while sending an `approved_by` naming a different admin and an
  `approved_at` in the past
- **When** the write lands
- **Then** the stored `approved_by` is the acting admin and the stored `approved_at` is the time of
  the write — whatever was sent is discarded

**AC-8 — a member's forged approval on their own entry is refused, in a sentence**
- **Given** a signed-in member and their own pending entry
- **When** they issue an update setting `status` to `approved`
- **Then** the write is refused, the entry stays `pending`, and what reaches the interface is a
  sentence rather than `42501` or a PostgREST error body

**AC-9 — a member may not write a rejection reason either**
- **Given** a signed-in member and their own entry
- **When** they issue an update setting `rejection_reason`
- **Then** the write is refused on the same terms as AC-8

**AC-10 — an admin may approve their own entry**
- **Given** an admin who owns a pending entry
- **When** they approve it
- **Then** it is approved, and its `approved_by` is that admin — self-approval is permitted, and the
  star on it means *an admin said so* where that admin is themselves

**AC-11 — the permitted transitions, and the two that are not offered**
- **Given** an admin looking at an entry in each of the three statuses
- **When** the controls on offer are read
- **Then** `pending → approved`, `pending → rejected`, `approved → rejected`, `rejected → approved`
  and `rejected → rejected` are all reachable, and **no control anywhere returns an entry to
  `pending`** — that transition is not offered and not built

**AC-12 — a substantive edit to an approved entry returns it to pending (INV-02)**
- **Given** an approved entry
- **When** its owner, or an admin, changes its dates, type, portion or tentative flag
- **Then** its `status` returns to `pending` and its `approved_by` and `approved_at` are cleared —
  and this is observable for the first time, because until this ticket nothing could create the
  approved state

**AC-13 — a substantive edit to a rejected entry returns it to pending and clears the reason**
- **Given** a rejected entry carrying a reason
- **When** its owner changes its dates
- **Then** its `status` becomes `pending` and its `rejection_reason` is empty — the likely path, not
  an edge case, because INV-01 still holds the rejected entry's slots and editing it is the only
  route open to its owner

**AC-14 — editing only the note revokes nothing**
- **Given** an approved entry
- **When** its owner changes only the note
- **Then** it is still approved, and its `approved_by` and `approved_at` are unchanged

**AC-15 — the owner of a rejected entry reads the reason without being told**
- **Given** a member whose entry an admin has rejected, and no message of any kind sent to them
- **When** they open that entry
- **Then** they can read the rejection reason and the time the decision was recorded, on the screen,
  with no admin involved

**AC-16 — a decision the policy does not admit is reported as a refusal, not as success**
- **Given** an admin acting on an entry the update policy does not admit for them
- **When** the write is issued
- **Then** the interface reports a refusal — the row count is what decides, because a filtered row
  answers 200 with an empty body and an error check alone is green

**AC-17 — an admin of another team may not decide this team's entries**
- **Given** an entry belonging to a member of another team
- **When** an admin of this team attempts a decision on it
- **Then** it is refused, and nothing about that entry changes

**AC-18 — the copy is a coordination signal, not an employment decision**
- **Given** every screen this ticket touches
- **When** its copy is read
- **Then** the object is an **entry** and never a request, an application or *đơn*; no quota, balance,
  entitlement or remaining-days figure appears; the reason field's label asks what would work instead
  rather than demanding a justification; and no control, link or field reaches HR

**AC-19 — the star's meaning is stated once, in the product**
- **Given** a member or an admin on a screen that shows an approved entry
- **When** they look for what the star means
- **Then** one sentence in the interface says it: an admin has seen this and accepted it against the
  team's schedule

**AC-20 — a rejection removes nothing and locks nothing**
- **Given** an entry an admin has rejected
- **When** its owner returns to it
- **Then** it is still on the board, still theirs, and still editable and deletable by them; nothing
  in the product is disabled because an entry is `pending` or `rejected`, and no copy implies the
  member may not go

**Invariants touched.** `[INV-02, INV-03, INV-05]` — exactly the three the ADM-05 row lists. This
plan adds none and removes none.

- **INV-02** — *an approved entry whose dates, type, portion or tentative flag change returns to
  `pending`; editing only the note does not.* **Held by `public.entry_enforce_decision()` clause (c)**,
  which CAL-01 shipped and this ticket does not alter. This ticket is listed because it **creates the
  approved state that makes the trigger observable at all** — until now nothing in the product could
  set `status` to `approved`, so clause (c) has never had a live case — and because it amends the
  function that holds it. AC-12 and AC-14 are the two halves.
- **INV-03** — *a rejected entry always carries a non-empty rejection reason.* **Held by the check
  constraint `entry_rejection_reason_iff_rejected`**, which is a **biconditional**
  (`supabase/db.sql:213`), so it holds both directions: no rejected row without a reason, and no
  reason on a row that is not rejected. This ticket is the first to write the column. The interface's
  required-reason field is an **affordance** and not the mechanism — AC-3 asserts the affordance, and
  the constraint is what makes the refusal true when the affordance is bypassed. Clause (b)'s nulling
  of the reason on approval is forced by the same constraint, which is AC-4.
- **INV-05** — *a tentative entry counts toward the absence count exactly as a non-tentative one
  does.* Reached indirectly and listed for it: approval and tentativeness are two independent axes,
  and an approval that cleared `tentative` would change what the entry contributes on the count's
  own terms. **Held by absence** — clause (b) touches `approved_by`, `approved_at` and
  `rejection_reason` and never `tentative`, and the update grant this ticket adds names two columns
  and not that one. AC-6.

**INV-04 is deliberately absent**, and the row says so: rejecting changes what the count *reads* and
computes no count — the same argument that kept it off CAL-01 and CAL-08. **INV-01 is absent for a
different reason worth stating:** ADR-011 established that a rejected entry still occupies its slots,
which is what makes AC-13's edit path the likely one, and nothing here changes the constraint or the
slots.

### Open questions

**None blocking.**

**1. TODO(project) — *"who rejected it and when"* is not storable in v1, and the feature row's AC
names it.** The row says the member-facing half of INV-03 is *"the owner of a rejected entry can read
the reason, **and who rejected it and when**, without an admin telling them."* The first and third
parts are AC-15 and are delivered. **The middle part cannot be built**, and the reason is in the
accepted decision this ticket implements:

- `entry` has no `rejected_by` and no `decided_by` column (`data-model.md`; `supabase/db.sql` § 3).
- **ADR-016 clause (b) nulls `approved_by` and `approved_at` on any transition off `approved`**, so
  the rejecter cannot be parked there.
- **Parking them there anyway is closed by ADR-016's own revert condition 1**, which makes *"`status
  <> 'approved'` and `approved_by is not null`"* an observable defect signal. Writing a rejecter into
  `approved_by` would make the audit trail a false record, which the ADR ranks as worse than none.
- **`updated_by` and a decision change feed are out of scope by triage**, citing `data-model.md` OPEN
  QUESTIONS item 5 and the brief's P1.

So AC-15 delivers **the reason and when the decision was recorded** — `updated_at`, which the trigger
writes from the datastore's clock and no client can set. It does not deliver *who*. **Closing it is a
schema change** — two columns, or a rename of the two that exist — plus an amendment to
`data-model.md`, which is human plane under RULE-01, and RULE-09 makes applying it human. It is the
operator's, it is small, and it is named here rather than quietly dropped from the AC.

**2. Not blocking, and it is ADR-016's own headline consequence: the sharpest test case in the product
cannot be run.** ADR-016 *Consequences* requires *a member PATCHes `{"status":"approved"}` against
their own entry and is refused* — **"issued against a real PostgreSQL with a member's token, not
through the seam, since the seam is where the affordance lives and not where the control is."**
`tests/permission-model.test.ts` does not exist and never has (ADM-01 *Open questions* item 5 records
the same), and **no Supabase project is provisioned**, so there is no real PostgreSQL and no member's
token to issue it with. AC-8 and AC-9 are therefore satisfied here **against the mock**, where the
guard is a second implementation of clause (a) and proves the *interface* behaviour and not the
control. This is stated rather than hidden: **on the mock these two criteria demonstrate the sentence,
not the refusal.** The refusal is held by the trigger and is verified the day a project exists. Nothing
in this ticket can change that, and pretending otherwise would be the *"permission held by intent
rather than by a control"* failure `rbac-and-security.md` names as the most expensive kind.

**3. Not blocking, not this ticket's to fix, and it got worse this week: `supabase/db.sql`'s `[OWED]`
markers can no longer be trusted.** ADR-026 decision point 3 says every group-2 object carries a
comment naming *"the ticket that still owes its migration"*. **Five of them are stale** — three
`[OWED] ADM-02` and two `[OWED] ADM-03`, two of which still read *"No migration exists for this yet"*
while `20260905120000_adm02_holiday.sql`, `20260905120100_adm02_holiday_seed.sql` and
`20260905140000_adm03_holiday_writes.sql` all shipped on 2026-09-05. ADM-01 *Open questions* item 4
recorded the same class of staleness in § 9; nobody was given the job, and ADR-026 assigns it to no
ticket.

**Why it matters more here than anywhere it has been recorded before:** this is the first ticket whose
migration is **transcribed from `db.sql`**, so the labels are not documentation, they are the input.
This plan therefore verified both of its own markers against the migrations directory rather than
trusting them — `grep "only an admin may decide an entry" supabase/migrations/` returns nothing, and
no migration grants `status` — and section 6 records that check. **The fix shape**, for whoever is
given it: either `/ship` flips the labels of the ticket it is shipping, or `check-docs.mjs` gains a
check that fails a `[OWED] <TICKET>` marker whose ticket is `DONE`. The second is better, because it
also catches the case nobody remembered.

**4. Not blocking — `ticket.yaml`'s `schema_delta` names an object CAL-03 already shipped.** Corrected
at this gate; section 6 has the detail. Recorded because the shell was written at triage on 2026-08-31,
three days before CAL-03 shipped `entry_update_admin`, and a `schema_delta` that over-claims is how a
migration ends up recreating a policy that already exists.

**5. Not blocking — `.ai/standards/ui-design-system.md` § Colour and § Components are still
`TODO(project)` stubs.** Every criterion above turns on an attribute or on copy, never on a colour.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

Checked before writing: `.ai/board/tickets/ADM-05/design/` does not exist, and
`.ai/board/ideas/2026-08-31-no-way-to-tell-a-settled-plan-from-a-typed-one.md` attaches no image.

**One decision panel, built once and mounted twice.** `src/components/EntryDecision.tsx` renders the
approve control, the reject control and the reason field, and decides nothing about who may use it —
it is handed an entry and calls the seam. It is mounted:

- **on each row of `/entries/pending`**, which is the surface the feature row names — *"the decision
  surface is ADM-04's list; this row adds the two controls and the mandatory reason to it"*;
- **on `/entries/:id/edit`, for an admin**, which is where an entry that is no longer pending is
  reachable at all. The worklist shows only pending entries by construction, so AC-5's reason edit
  and AC-4's `rejected → approved` have nowhere else to happen. Both admin lists already link every
  row there.

A second copy of the controls, rather than one component on two screens, is what would make *"a
rejection carries a reason"* a rule written twice.

**The reason field is a disclosure, not a prompt.** Reject opens the field; nothing is written until
it is submitted. The panel never shows a confirmation dialog for approve — approving is reversible by
rejecting, and a dialog on the commonest action in the queue is how a queue stops being worked.

**Its copy is where AC-18 lives.** The reason field's label asks *what would work instead*, which is
the idea's condition 6 and the concrete content of *"the one thing that makes it actionable"*. AC-19's
one sentence about the star sits on `/entries/:id/edit` beside the status, where somebody who has just
seen a star is standing.

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. **Two rows consumed, none invented, none amended.**

| Action | `member` | `admin` | Where the check lives |
|---|---|---|---|
| `Approve or reject another member's entry` (line 35) | ❌ | ✅ | **Two objects together, and neither is sufficient alone**: policy `entry_update_admin` (CAL-03, shipped) admits the row, and **clause (a) of `public.entry_enforce_decision()` (this ticket) is what refuses the decision columns** |
| `Approve or reject their own entry` (line 36) | ❌ | ✅ | Clause (a) alone. `entry_update_own` (CAL-02, shipped) admits a member's own row and cannot be narrowed — see below |
| `Edit their own entry` (line 33) | ✅ | ✅ | `entry_update_own` plus the CAL-02 column grant. **Unchanged**, and AC-12 to AC-14 assert it stays unchanged |
| `Read any entry in the team` (line 30) | ✅ | ✅ | `entry_select_team` (CAL-01, shipped). **Unchanged** — and it is what makes AC-15 possible with no new read |

**The denial that is the whole ticket, stated as a denial: a member may not approve their own entry,
and no policy can refuse it.** This is not a summary of ADR-016, it is the reason section 6 is not
`none`:

- An RLS `UPDATE` policy has `using`, which sees the OLD row, and `with check`, which sees the NEW
  row, and **no expression sees both** — so *"`status` did not change"* is not expressible.
- Permissive policies **OR** together, so `entry_update_own` admits the member's own row on its own,
  whatever sits beside it.
- **`with check (status = 'pending')` on the own-entry policy is the trap**, and it is wrong for an
  INV-02 reason: editing only the note does not revoke an approval, so a member must be able to write
  a row whose `status` is `approved`. It would break the one case INV-02 went out of its way to exempt.
- **A column grant cannot separate the two roles**, and the contrast with ADM-01 is the instructive
  part rather than a near-miss: ADM-01's `grant update (overload_threshold)` works because *nobody*
  may rename the team, so the privilege is uniform. Here `member` and `admin` are the **same
  PostgreSQL role**, `authenticated` — the rank is a column read through `public.is_admin(uuid)` — so
  revoking `status` from `authenticated` blocks the admin too.

**Two things must land in one migration or the product is worse than before it.** The grant
`update (status, rejection_reason)` makes those columns writable by `authenticated`, which is both
roles; clause (a) is the only thing that then distinguishes them. **Granting the columns while the
function is still in its INV-02-only form hands every member the exact write ADR-016 exists to
refuse, with no guard behind it.** `supabase/db.sql:681-687` states this in the same words, and
section 6 makes it one file.

**Where authorization on `entry` now lives, for a reviewer: two places.** The policies, and clause (a)
of the trigger. Review checks R6 and R8 must read both — a reviewer who reads only the policies will
conclude the model is broken, correctly, for what they read. ADR-016 *Consequences* names this as the
cost of the decision.

**What no interface control protects.** Every control this ticket adds is an affordance. A member who
reaches `/entries/pending` in a debugger, or issues the PATCH by hand, is refused by clause (a) and
not by anything in `src/`.

## 4. Contract

### 4.1 Domain types — `src/lib/domain/types.ts`

**Two failure codes added to the `FailureCode` union, and nothing else.** No new interface, no new
constant; `Entry` already carries `status`, `rejectionReason`, `approvedBy` and `approvedAt`, all four
written by CAL-01 and all four unchanged in shape.

```ts
  // ADM-05, 01-plan.md section 4.1. Clause (a) of `public.entry_enforce_decision()` refused the
  // write: somebody who is not an admin tried to move a decision column. It arrives as SQLSTATE
  // 42501, which PostgREST answers as 403.
  //
  // NOT `entry_not_permitted`, which is the code CAL-01 and CAL-02 map for a policy refusal and
  // whose sentence is written about creating and editing. One code carrying two sentences is how a
  // wrong message reaches a screen — CAL-01's own reasoning for keeping this code out of
  // `not_permitted`, applied one layer further in. The distinction is real and not cosmetic: a
  // filtered row means "not yours to touch", and 42501 here means "yours, but not this column".
  | "entry_decision_not_permitted"
  // ADM-05, AC-3. INV-03 refused: a rejection with no reason. Raised in the SEAM before the write is
  // issued, so the interface never meets the raw 23514 the biconditional check would answer with —
  // the shape ADR-016 section 4 gives `reject_entries`, which raises 22023 with a sentence for the
  // same reason. The CHECK CONSTRAINT is still the control; this is the sentence.
  | "rejection_reason_required"
```

### 4.2 The seam — `src/lib/data/index.ts`, `mock.ts`, `supabase.ts`

**Two functions added. Nothing existing changes signature or behaviour.**

```ts
/**
 * ADM-05 AC-1, AC-4, AC-6, AC-7, AC-10, AC-16, AC-17. Approves ONE entry. Admin only, and the
 * control is clause (a) of `public.entry_enforce_decision()` — not this function, and not the
 * screen that calls it.
 *
 * IT SENDS `status` AND NOTHING ELSE. `approved_by` and `approved_at` are written by the datastore
 * from `auth.uid()` and `now()`, and anything sent for them is discarded (AC-7); `rejection_reason`
 * is nulled by the same clause, because INV-03's check is a biconditional and a transition off
 * `rejected` that leaves the reason standing is refused with a raw 23514 (AC-4). A seam that sent
 * those columns would be a second expression of clause (b) that agrees with it until one is edited.
 *
 * IT MUST COUNT THE AFFECTED ROWS. A row the policy does not admit is FILTERED, not errored:
 * PostgREST answers 200 with an empty body, so an `!error` check is green on a refusal. Zero rows is
 * `entry_not_permitted` — the shape `updateEntry` and `deleteEntry` already use (AC-16, AC-17).
 *
 * 42501 from clause (a) maps to `entry_decision_not_permitted` with a sentence (AC-8).
 */
approveEntry(entryId: string): Promise<Result<Entry>>;

/**
 * ADM-05 AC-2, AC-3, AC-5, AC-9, AC-16, AC-17. Rejects ONE entry with a reason, and REWRITES the
 * reason on an entry that is already rejected — one function, because they are one statement:
 * `status = 'rejected'` and `rejection_reason = reason` written together. AC-5 is `rejectEntry`
 * called on a rejected row, which is why the idea calls the per-entry reason edit *"the same field
 * on the same form"*.
 *
 * REFUSES A BLANK REASON BEFORE ISSUING THE WRITE — `rejection_reason_required`, empty or
 * whitespace-only (AC-3). That is an AFFORDANCE. `entry_rejection_reason_iff_rejected` is the
 * control and it refuses the same write with 23514; this exists so the interface never renders a
 * SQLSTATE, which is the failure ADR-011 recorded for 23P01.
 *
 * NOT `public.reject_entries(uuid[], text)`. That is ADM-06's, for the batch only — ADR-016 section
 * 4: "the single approve and the single reject stay a plain PATCH", and a second path for N=1 is a
 * second thing to keep correct.
 */
rejectEntry(entryId: string, reason: string): Promise<Result<Entry>>;
```

**Neither function takes a role, and neither checks one.** The same property `updateEntry` and
`deleteEntry` have and for the same reason: ownership and rank were never the seam's to decide.

**The mock implements clause (a) as a second implementation of the guard, and that is declared rather
than hidden.** It is acceptable on the terms `mock.ts` already states for INV-01: the mock is not a
datastore anybody's data lives in, and the real mechanism is the trigger. It exists so AC-8, AC-9,
AC-16 and AC-17 are observable end to end with no provisioned project — see *Open questions* item 2
for exactly what that does and does not prove.

### 4.3 The migration — `supabase/migrations/20260905190000_adm05_entry_decision.sql` (new)

**Two objects, transcribed from `supabase/db.sql`, which ADR-026 decision point 1 item 3 marks
`[OWED] ADM-05` — and verified against `supabase/migrations/` rather than trusted** (*Open questions*
item 3):

1. **`create or replace function public.entry_enforce_decision()`**, gaining clauses (a) and (b).
   Verified owed: `grep "only an admin may decide an entry" supabase/migrations/` returns nothing.
2. **`grant update (status, rejection_reason) on public.entry to authenticated;`** Verified owed: the
   only `grant update` on `entry` in any migration is CAL-02's six-column list.

**Five properties of that file, each of which is a way it can be got wrong:**

- **`create or replace function`, and NOT a second trigger.** The trigger `entry_enforce_decision`
  already exists on `entry` and already points at this name (CAL-01). PostgreSQL fires same-event
  triggers **alphabetically by name**, so a second `before update` trigger would make the guard's
  correctness depend on spelling. One function is what keeps the order explicit — and ADR-016's third
  revert signal is exactly *a second `BEFORE UPDATE` trigger appearing on `entry`*.
- **Clause order is the whole design, and it is: `updated_at`, then (a), then (b), then (c).** The
  guard reads the values the client sent, before anything below has touched them. A member editing
  dates on an approved entry passes (a) — at that point `new.status` still equals `old.status` — and
  is then reset by (c). **Reversed, the guard sees a `status` change made by the reset itself and
  refuses a member's legitimate edit.**
- **Clause (c) is CAL-01's and CAL-02's, transcribed unchanged**, `updated_at` line included. The
  replacement is a superset of the shipped body, not a rewrite of it, and a diff against
  `supabase/migrations/20260903143000_cal02_own_entry_writes.sql` should show additions only.
- **`security invoker`, and no new grant on `public.is_admin(uuid)`.** TEA-01 already granted execute
  to `authenticated` (`…tea01_membership.sql:71`); a second grant is the redundant-grant trap ADM-03
  recorded — it reads as a control and is not one.
- **`entry_update_admin` is NOT created here.** CAL-03 shipped it
  (`20260903160000_cal03_admin_entry_writes.sql:80`). Section 6.

**Applying it is human — RULE-09**, and this one more than most: it opens two columns to
`authenticated` in the same statement that closes them behind the guard.

### 4.4 The screens

**`src/components/EntryDecision.tsx` (new).** Props: the entry, and a callback for *the decision
landed* so the caller reloads. It renders the approve control, the reject control, the reason field
and the failure sentence, and it calls `seam.approveEntry` and `seam.rejectEntry` and nothing else.
**It imports no read and issues no query**; which entries it is rendered for is the caller's decision,
and which writes succeed is the datastore's.

**`src/routes/PendingEntries.tsx`.** The panel is mounted on each row, replacing nothing — ADM-04's
`pending-entry-row-link` stays. After a decision the screen **reloads the page it is on**, so the row
leaves the queue and `pending-entries-count` falls (AC-1, AC-2). The reload is `load()`, which ADM-04
already has: a local splice would make the count and the list disagree, which is the one property that
screen was built not to have.

**`src/routes/EditEntry.tsx`.** Three changes and no more:

1. **The panel, for an admin only** — the affordance that makes AC-4, AC-5 and AC-11 reachable for an
   entry that is not pending. The role branch this file already makes for its read decides it.
2. **The rejection reason, shown to the owner** — AC-15. It renders whenever `status` is `rejected`,
   for **both** roles, because the member is the reader this criterion is about. The time is
   `updated_at`, which the trigger writes and no client can set; *Open questions* item 1 records that
   *who* is not available.
3. **One sentence on what the star means** — AC-19, beside `edit-entry-status`, which is where a
   person who has just seen a star is standing.

**No calendar view is touched.** CAL-04, CAL-05 and CAL-06 already draw the star and the dashed
tentative border; this ticket makes `status` change and they render the change with no edit. That is
the whole of *"this idea's contribution to the read signal is that `status` ever changes"*.

### 4.5 Selectors

`data-testid`. Existing selectors are unchanged; everything below is new except where noted.

| Selector | Where | Notes |
|---|---|---|
| `entry-decision` | the panel | `data-entry-id`, `data-status` |
| `entry-decision-approve` | the panel | absent when the entry is already `approved` (AC-11) |
| `entry-decision-reject` | the panel | opens the reason field |
| `entry-decision-reason` | the panel | the textarea. `data-required="true"` |
| `entry-decision-submit` | the panel | writes the rejection |
| `entry-decision-cancel` | the panel | closes the field, writes nothing |
| `entry-decision-error` | the panel | `role="alert"`. Carries `data-code`, so AC-3, AC-8 and AC-16 assert *which* refusal rather than *some* refusal |
| `edit-entry-rejection-reason` | `EditEntry.tsx` | AC-15. Present only when `status` is `rejected` |
| `edit-entry-decided-at` | `EditEntry.tsx` | AC-15's *when*. `data-updated-at` |
| `edit-entry-star-meaning` | `EditEntry.tsx` | AC-19 |
| `edit-entry-status` | **existing**, unchanged | already carries `data-status` |
| `pending-entries-count` | **existing**, unchanged | AC-1 and AC-2 read `data-total` before and after |

**No selector on any calendar view.** If a decision AC could only be asserted there, it would mean an
approval control had reached a surface CAL-05 refuses it on.

## 5. Seam impact

**Two functions added — `approveEntry(entryId)` and `rejectEntry(entryId, reason)` — implemented in
both `supabase.ts` and `mock.ts` with the same name and arity**, or `tests/seam-parity.test.ts` fails.
That test reads the exported key set dynamically and needs no edit.

**No existing seam function changes signature or behaviour.** `updateEntry` and `deleteEntry` are
untouched — CAL-03 already demonstrated that widening what a policy admits changes neither, and the
same holds here: clause (a) narrows what `updateEntry` may carry through, and the function's contract
is unchanged because it never carried `status` in the first place (its `UpdateEntryInput` names six
fields and none of them is a decision column).

**One behaviour of an existing function does change and it is worth naming, because a reviewer will
look for it:** a member's `updateEntry` on an **approved** entry now has an approval to revoke, so
INV-02's reset becomes observable through a function this ticket does not edit. AC-12 and AC-14 assert
it there.

**Parity is necessary and not sufficient, and the gap is the mock's clause (a).** Section 4.2 declares
it; *Open questions* item 2 states what it proves.

## 6. Schema delta

**NOT `none`, and `ticket.yaml`'s wording is corrected at this gate.**

The shell was written at triage on 2026-08-31 and reads: *"adds the `entry_update_admin` policy,
replaces `public.entry_enforce_decision()` with the guarded form, and grants update on `public.entry`
— ADR-016"*. **The first of those three is no longer true.** `entry_update_admin` was shipped by
CAL-03 on 2026-09-03, in `supabase/migrations/20260903160000_cal03_admin_entry_writes.sql:80`,
together with its team predicate. Recreating it here would be a `drop … if exists` and a `create`
against a policy that already exists and is already correct.

**What is genuinely owed, both verified against `supabase/migrations/` rather than read off a label:**

1. `create or replace function public.entry_enforce_decision()` — clauses (a) and (b) added, clause
   (c) and the `updated_at` line transcribed unchanged. **ADR-016 § 1.**
2. `grant update (status, rejection_reason) on public.entry to authenticated;` — **ADR-016
   *Consequences***, and CAL-02 deferred exactly these two columns by name.

**ADR-016 is linked, not authored, and no new ADR is written.** It is `ACCEPTED by tech-lead-design`
under ADR-008 and every statement in section 4.3 is transcribed from its § 1 or from
`supabase/db.sql`'s § 4, which ADR-026 decision point 2 admits only as verbatim transcription of an
accepted clause. Nothing here decides anything ADR-016 has not decided.
**ADR-014 would require the link for the grant alone**, and this goes further than a policy.

**The tension ADR-016 states about itself is carried here rather than discovered at review.** ADR-005
says row-level security *"is the only mechanism that enforces"* authorization, and clause (a) is
authorization in the database but not in a policy. ADR-016's Status section argues it inside the
envelope on two grounds — nothing reaches application code, and ADR-005 already puts INV-02 in a
trigger — and records that **if the operator reads *"and nowhere else"* literally and disagrees at
merge, ADR-008's revert condition fires and RULE-09 returns to v1.** That is a decision this plan does
not re-argue and does not hide: it is the single most reviewable thing in this ticket.

**`requires_adr` stays `true`. Applying the migration is human — RULE-09.**

**`supabase/db.sql` is not edited** — section 7, and *Open questions* item 3.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260905190000_adm05_entry_decision.sql"
  - "src/lib/data/index.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/domain/types.ts"
  - "src/components/EntryDecision.tsx"
  - "src/routes/PendingEntries.tsx"
  - "src/routes/EditEntry.tsx"
  - "tests/entry-decision.test.ts"
  - "tests/e2e/adm-05-approve-reject.spec.ts"
  - "tests/e2e/adm-04-worklist.spec.ts"   # added by amendment, 2026-09-05 — see the Changelog
```

Eleven globs, eleven files; three are new — the migration, the component and its two test files.
The eleventh is not new and was a safety net until the amendment below moved it.

**`size`: M, agreeing with `size_estimate` in section 1.** ADR-012 is not engaged and nothing splits.
Eleven of M's ceiling of twelve.

**The XL clause was checked rather than assumed, because this ticket ships a migration.**
`.ai/01-operating-model.md:375` lists a schema change under XL, and its own next paragraph gives the
operative test: *"XL is for changes that break the seam's existing contract … The test is whether
existing callers must change, not whether the seam was touched at all."* **No existing caller
changes**: `updateEntry` keeps its six-field input, `deleteEntry` is untouched, and the two failure
codes are additions to a union that no exhaustive switch consumes. Six tickets have shipped migrations
at M — CAL-01, CAL-02, CAL-03, ADM-01, ADM-02, ADM-03 — and this reading is the one the loop has
consistently taken.

**Deliberately absent, each with its reason:**

- **`supabase/db.sql`** — ADR-026 decision point 6: *"applying `db.sql` does not discharge the
  migration"*, and the file's job is the target schema, which this ticket does not change. Turning
  two `[OWED]` labels into `[SHIPPED]` is a label edit that **no ticket is assigned**, and ADM-02 and
  ADM-03 both shipped without doing it — so doing it here would be one ticket sweeping five stale
  markers it did not create. *Open questions* item 3 carries it with a fix shape.
- **`supabase/seed.sql`, `src/lib/fixtures.ts`** — **no fixture is added, deliberately.** A seeded
  `approved` and a seeded `rejected` row would be states no admin ever produced, and every criterion
  above is stronger created by the write it is testing: the e2e spec approves ADM-04's pending
  fixtures and then reads them back. `FIXTURE_APPROVED_ENTRY` already exists for AC-12 and AC-14, and
  `FIXTURE_OTHER_TEAM_ENTRY` is already a pending entry on another team, which is AC-17's case with no
  new row.
- **`src/routes/TeamEntries.tsx`** — CAL-03's list keeps its edit and delete controls and gains
  nothing. Every entry it lists is reachable at `/entries/:id/edit`, where the panel is, so mounting a
  third copy would add a surface without adding a capability.
- **Every calendar view — `MonthView.tsx`, `WeekView.tsx`, `YearView.tsx`, `OverloadWarning.tsx`** —
  they already render the star and the tentative border and need no edit to render a status that now
  changes. An approval control on any of them is refused by CAL-05's row and by this idea's triage.
- **`src/components/EntryForm.tsx`, `src/routes/NewEntry.tsx`** — the six substantive fields are not
  this ticket's, and a decision is not an edit. Both are OPS-002's `copyDebt`.
- **`tests/seam-parity.test.ts`** — passes unedited (section 5).
- **`cal-02-edit-delete-entry.spec.ts`, `cal-03-admin-edit-entry.spec.ts`** — **the two safety nets,
  and both must pass unedited.** They report the case that matters most: **an ordinary edit by an
  owner or an admin must still succeed after clause (a) exists.** If clause order were reversed,
  those two suites are what would go red, and they are the cheapest place for it to happen.
- **`tests/e2e/adm-04-worklist.spec.ts` was the third safety net and is no longer one.** It is in
  `allowed_paths` as of the amendment below, for **one four-line edit and nothing else**. The first
  version of this section had it passing unedited on the strength of the role it plays — *reports a
  broken worklist selector* — and that reading was incomplete: its AC-9 test asserts the absence of
  the decision controls **twice**, once by the four `pending-entry-row-*` and `pending-entries-*`
  selector names (which still hold, because § 4.5 names this ticket's controls `entry-decision-*`)
  and once **structurally**, `form`, `textarea`, `button` and `input` each at count 0 inside
  `[data-testid="pending-entries"]` (`tests/e2e/adm-04-worklist.spec.ts:273-278`). The structural
  half asserts the absence this ticket exists to remove, and no implementation avoids it: rendering
  the two controls as something other than a `button` to slip past a structural assertion would be a
  worse outcome than the red suite. **The permitted edit is the two structural lines that survive
  and no more** — `form` and `input` stay at 0, `textarea` and `button` go, with a comment naming
  ADM-05 as what superseded them. The four selector-name assertions above and the entire AC-15
  vocabulary check below are **untouched**, so ADM-04's own criterion stays legible and the losing
  triage argument in `features.md:103` that it protects stays readable, which deleting the test
  would have cost.
- **`tests/ui-language.test.ts`, `ui-language.json`** — nothing translated, nothing de-listed.
  `EntryDecision.tsx` is new, so § Language covers it from its first line, and its copy is English.
  **`EditEntry.tsx` is not on `copyDebt`** and its existing Vietnamese `STATUS_LABELS` are a
  pre-existing condition this ticket must not extend: everything it adds there is English.
- **`.ai/standards/rbac-and-security.md`** — four rows consumed, none amended. Known weakness 3 is
  **narrowed** by this ticket — the decision now carries reliable provenance while an admin's *edit*
  is still untraced — and ADR-016 records that the amendment is a human's. RULE-01.
- **`.ai/standards/data-model.md`** — human plane. *Open questions* item 1's missing column lives
  there and is the operator's.
- **`.ai/registry/features.md`** — registry plane; the `Status` column is `/ship`'s.

## 8. Rejected alternatives

**1. A column grant plus a `security definer` RPC — `approve_entry(uuid)`, `reject_entry(uuid, text)`
running as owner.** **This one works**, which is what makes it the alternative worth stating: the
function runs with the owner's privileges, so `status` need never be granted to `authenticated` at
all, and the *"grant and guard must land together"* hazard in section 3 disappears. ADR-016's
Rationale rejects it and this plan follows: it moves the authorization check into a function while
ADR-005 places it in the database's declarative layer, and it adds a second write surface beside
PostgREST that has to be kept in step with the policies under it. It buys nothing the trigger does not
— **the trigger already sees OLD and NEW, which is the only capability the whole problem needed.**
Recorded rather than dismissed: if the guard ever needs state it cannot reach from OLD, NEW and
`is_admin()`, this is what returns, and ADR-016's revert condition 2 names that signal.

**2. `with check (status = 'pending')` on `entry_update_own`.** The shortest thing that looks like it
closes the hole, it needs no trigger and no migration beyond one policy, and **it is wrong for an
INV-02 reason** rather than a mechanical one: editing only the note does not revoke an approval, so a
member must be able to write a row whose `status` is `approved`. The policy would refuse the one case
INV-02 went out of its way to exempt — a member fixing a typo on an approved entry — and the failure
would look like a permissions bug rather than a design error.

**3. One seam function — `decideEntry(entryId, decision)` — instead of two.** Genuinely tidier: the
two write the same column, answer to the same policy and the same clause, and a union parameter would
make the permitted transitions of AC-11 enumerable in one place. Rejected because the two have
**different preconditions**: a rejection carries a mandatory reason and an approval must carry none,
so a single function would take a reason that is required for one value of its own parameter and
forbidden for the other. That is the shape that produces `reason?: string` and then a runtime check —
and the runtime check would be a third place INV-03 is written, after the constraint and the field.

**4. Mounting the panel only on the worklist, as the feature row's sentence reads literally.** It
would be one file smaller and would match *"the decision surface is ADM-04's list"* word for word. It
is rejected because the worklist shows **only pending entries by construction** —
`listPendingEntries` hard-codes `status = 'pending'` — so `rejected → approved` (AC-4) and the reason
edit (AC-5) would have no surface anywhere in the product, and the idea puts the reason edit in v1 in
terms. The alternative that keeps one surface is adding a status filter to the worklist, which would
change `listPendingEntries`'s shipped contract and its meaning — ADM-04 is one week old and its own
plan spends a section on why that read is narrow.

**5. Writing `approved_by` and `approved_at` from the seam.** The obvious client-side implementation,
and it is what the product did in every earlier draft of this feature: the browser knows who is signed
in, so it can send the two columns. Rejected because it makes the **only audit trail v1 has**
forgeable — one admin could write another admin's id into a PATCH body they composed, and known
weakness 3 means nothing anywhere would contradict them. Clause (b) discards whatever arrives, which
also makes CAL-05's *"displaying who approved is not approving"* true by construction rather than by
a story remembering it. This is the alternative a reviewer should check was refused, because the code
that implements it is shorter and reads correctly.

## Changelog

- `2026-09-05T19:05:27+07:00` — sections 1–8 written. First version. Raised by `tech-lead-design`.
- `2026-09-05T22:45+07:00` — **§ 7 amended: `tests/e2e/adm-04-worklist.spec.ts` moves from the
  safety-net list into `allowed_paths`, an eleventh path.** Raised by `developer` at IN_PROGRESS
  through `99-questions.md`, answered by `tech-lead-design`; the consult is on the
  `developer->tech-lead-design` edge and is counted there. **No acceptance criterion changed** —
  this is a defect in § 7, not an AC reshaped to fit what is easy to build. What § 7 got wrong: it
  claimed that suite could pass unedited, and the claim was made from the suite's *stated role*
  rather than its assertions, four of which assert structurally the very absence the ADM-05 feature
  row removes. The conflict is between ADM-04 AC-9 and the ADM-05 row and exists whatever this
  ticket implements; the only choices were which file records the supersession. **Two alternatives
  refused:** shipping with the suite red under an ADM-04 `BUG` row — the Definition of Done includes
  the end-to-end run, and a red suite everybody knows about is how a suite stops being read; and
  not mounting the panel on the worklist — refused already, § 8 alternative 4, and it would leave
  AC-1 and AC-2 without a surface. **`size` is unchanged at M**: eleven files against M's ceiling
  of twelve (`.ai/01-operating-model.md` § Sizing), and `size_estimate` still agrees, so ADR-012
  stays disengaged.
