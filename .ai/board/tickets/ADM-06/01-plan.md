---
ticket: ADM-06
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-05T23:10:00+07:00
inputs_read:
  - .ai/board/tickets/ADM-06/ticket.yaml
  - .ai/board/tickets/ADM-05/01-plan.md
  - .ai/board/tickets/ADM-05/03-impl-log.md
  - .ai/board/tickets/ADM-04/01-plan.md
  - .ai/board/ideas/2026-08-31-no-way-to-tell-a-settled-plan-from-a-typed-one.md
  - .ai/00-charter.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
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
  - supabase/migrations/20260903143000_cal02_own_entry_writes.sql
  - supabase/migrations/20260903160000_cal03_admin_entry_writes.sql
  - supabase/migrations/20260905190000_adm05_entry_decision.sql
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/components/EntryDecision.tsx
  - src/routes/PendingEntries.tsx
  - tests/entry-decision.test.ts
  - tests/e2e/adm-04-worklist.spec.ts
  - tests/e2e/adm-05-approve-reject.spec.ts
  - ui-language.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# ADM-06 — Reject several entries at once, with one reason for the batch

## 1. Problem and scope

**The feature row, transcribed from `.ai/registry/features.md:117` without paraphrase.** The
sentences this plan is built on, in the order they appear:

> Reject several entries at once, with one reason for the batch
>
> Brief 7.4's bulk half, and a second operation on the surface ADM-04 builds and ADM-05 makes
> decidable. **Answered by the operator, 2026-08-31: one reason is typed for the batch and written
> onto every entry in it.** INV-03 is therefore satisfied per record — each rejected row carries its
> own non-empty reason — and the batch stays faster than rejecting one at a time, which is the only
> thing that makes it worth building. A shared reason row, or a nullable reason on a batch, would be
> a second reading of INV-03 and is not available. Editing an individual reason afterwards is in v1
> and belongs to ADM-05, on the same form that already writes the field. **It is
> `public.reject_entries(p_ids uuid[], p_reason text)`, declared `security invoker`, not a PATCH with
> `id=in.(…)`** — ADR-016 §4, verified against the installed `@supabase/postgrest-js` rather than
> recalled. **`security invoker` is what keeps this inside ADR-005: `entry_update_admin` and the
> trigger's guard both still run, as the caller, so no authorization moves into the function — it is
> a transport change and not an enforcement layer.** What the naive form costs: `in()` puts the ids in
> the **query string** at 37 bytes per uuid, so a few hundred entries meets a proxy's request-line cap
> as an opaque **414** at exactly the moment an admin clears a backlog, which is the only moment bulk
> rejection exists for; and chunking to avoid it reintroduces the cross-chunk partial failure a single
> statement does not have. **The partial-failure case that must reach the story, because it is the one
> that passes every check:** rows an RLS policy does not admit are **filtered rather than errored**, so
> *reject 8* updates 5 and returns HTTP 200, and an `!error` check is green. The function returns
> `get diagnostics row_count`, and the seam compares it against the selection size and says *"5 of 8"*
> rather than *"done"*. **Failure, by contrast, is atomic** — one statement, one transaction — so if
> any row fails the check or the guard, **none** are rejected and the admin who selected eight gets
> zero; that is the safe direction and the story still owes them which one failed. An empty reason is
> refused with `22023` and a sentence rather than a raw `23514`. **`schema_delta` is not `none`** — it
> creates the function and its grant, with `revoke all … from public` beside it — **ADR-016** linked.
> TODO(verify): whether PostgREST's `db-max-rows` caps a PATCH's returned representation or its
> affected rows; the two readings fail in opposite directions and neither is confirmable from a file in
> this repository. **`Invariants touched` is INV-03 only:** the `approved_by` and `approved_at`
> clearing on a rejection is ADM-05's rule applied per entry through the same trigger, so listing
> INV-02 here would over-declare on the argument CAL-05 already made about INV-06. **The single approve
> and the single reject stay a plain PATCH** — this function is for the batch only, and a second path
> for N=1 is a second thing to keep correct. Charter refusal 2 applies unchanged and is hardest to hold
> here: rejecting twelve entries in one action must still read as one lead rearranging a week, not as a
> batch decision about twelve people's leave.

**Who gains what.** An **admin** gains one action that rejects a set of entries in one statement,
carrying one reason onto every record in it. Nothing else in the product changes hands: the member's
capabilities are untouched, and the two `rbac-and-security.md` rows this consumes —
*Approve or reject another member's entry* and *Approve or reject their own entry* — are the same two
ADM-05 already consumed, with no new row and no widening.

**Why it matters, stated as the thing that is actually being bought.** It is not a feature, it is a
**rate**. An admin who must reject nine entries one at a time types nine reasons, and the ninth is
worse than the first; the queue that most needs clearing is the one where clearing it is most
expensive. The idea's own justification is exactly this and nothing more — *"the batch stays faster
than rejecting one at a time, which is the only thing that makes it worth building"* — and it is the
sentence that decides everything below, because a batch that is not markedly faster than the loop it
replaces should not exist.

**And the thing it is most likely to break.** Charter refusal 2. One reason written onto twelve
records is, mechanically, one judgement applied to twelve people, and that is precisely the reading
the charter refuses. The feature row names it as *hardest to hold here*. The answer this plan takes
is that the batch never gains a vocabulary the single rejection does not have: the same field, the
same question — *what would work instead* — the same absence of quota, entitlement or HR, and copy
that names **entries and dates** rather than people. AC-16 and AC-17 are that, asserted.

`size_estimate`: **M**. One migration creating one function and its two privilege statements; one
seam function implemented twice; one new component; one screen amended; two new test files; and one
shipped end-to-end suite narrowed by two lines. **Not S** — eighteen criteria, a migration, and a
partial-failure contract that is the substance of the ticket rather than a detail of it. **Not L** —
no new table, no new column, no new policy, no new route, no new enum value, and the function it
creates is transcribed from `supabase/db.sql` rather than designed here.

### Out of scope

- **Bulk approval.** No feature row asks for it, and the asymmetry is deliberate rather than an
  oversight: a rejection carries a reason, which is what makes a batch of them one act with one
  justification; an approval carries none, so a batch of approvals is a sequence of unrelated
  judgements with nothing binding them. If it is ever wanted it wants its own row.
- **Any other bulk operation** — bulk delete, bulk edit, bulk return-to-pending. `approved → pending`
  is named in no permission row and is denied until decided, exactly as it is for ADM-05; the other
  two are not asked for anywhere.
- **A second path for N=1.** ADR-016 §4 in terms: *"the single approve and the single reject stay a
  plain PATCH"*. `approveEntry` and `rejectEntry` are untouched by this ticket, and selecting exactly
  one row still goes through the batch function — see § 8, rejected alternative 2, for why that is not
  a contradiction.
- **Editing an individual reason after the batch.** ADM-05's, shipped: `rejectEntry` on an
  already-rejected row is the per-entry re-word, and the feature row says the edit *"belongs to
  ADM-05, on the same form that already writes the field"*.
- **Selecting across pages.** A selection that outlives the page it was made on is a batch whose
  contents the admin cannot see at the moment they submit it, which is the one property a bulk
  rejection must not have. AC-14 makes the reset explicit rather than leaving it to be discovered.
- **Selecting the whole matching set** — a *select everything, not just this page* control. The screen
  has not read those rows, so a control offering them would send ids it never displayed. AC-15 pins
  select-all to the page.
- **Telling the member anything.** No email, no notification, no channel, in the batch path any more
  than the single one. The reason is satisfied as data and reaches its subject on pull — ADM-05's
  criterion, inherited and not re-opened.
- **Undo.** Nothing in this product has it, and a batch is not where it gets invented. The available
  correction is the one that already exists: approve the entry, or re-word its reason, per row.
- **Any fourth `entry_status`, auto-rejection, auto-expiry, or a rule that changes a status without an
  admin acting.** The idea's triage: *"a status that changes itself is exactly the false record INV-02
  exists to prevent."*
- **`.maxAffected(n)`.** ADR-016 §4 carries a `TODO(verify):` on it — it is typed against PostgREST
  v13+, the hosted major is unconfirmed, and it caps a **maximum** while the direction that matters
  here is *fewer rows than expected*. It would answer a question this plan does not ask. § 8,
  rejected alternative 4.
- **Resolving either `TODO(verify):` on `db-max-rows`.** Carried by the feature row, by ADR-016 §4 and
  by five limit constants in `src/lib/domain/types.ts`. Not confirmable from a file in this repository
  and not this ticket's to answer — *Open questions* item 2 records what it costs here, which is
  nothing this plan depends on.
- **Editing the `[OWED]` labels in `supabase/db.sql`.** ADR-026 decision point 6 says applying it
  discharges no migration, the target schema does not change here, and flipping the labels is a job no
  ticket is assigned. ADM-02, ADM-03 and ADM-05 each shipped without doing it. *Open questions* item 3.
- **The two limit constants ADM-04 found to be above the datastore's cap.** Still owed a `BUG` row,
  still not this ticket's — ADM-04 *Open questions* item 4, inherited through ADM-05 unchanged.

## 2. Acceptance criteria

Written for a reader with no access to any conversation (RULE-16). Every criterion is observable from
outside the system — through the interface, or through the seam, which is the boundary the unit level
addresses. **The refusals are half of this set on purpose**, and on this ticket they carry more than
usual: the failure this feature has is not an error, it is a success message about a write that
partly did not happen.

**AC-1 — the batch rejects.**
- **Given** an admin on `/entries/pending`, and three pending entries listed there
- **When** they select all three, type one reason and submit the batch
- **Then** all three entries have `status = 'rejected'` and each carries that reason as its
  `rejectionReason`, and the screen reports **three** rejected of three selected.

**AC-2 — one reason, written onto every entry in the batch.**
- **Given** a batch of entries belonging to more than one member
- **When** the batch is rejected with the reason *"The whole team is out that week — could either of
  you move to the following Monday?"*
- **Then** every entry in the batch carries that exact string in `rejectionReason`, per record, with no
  shared row and no null — INV-03 is satisfied once per entry rather than once per batch.

**AC-3 — a batch with no reason is refused before the write is issued.**
- **Given** an admin with entries selected and the reason field empty, or containing only whitespace
- **When** they submit
- **Then** the batch is refused with `rejection_reason_required` and a sentence, **no request reaches
  the datastore**, no entry changes, and the selection and the typed text stay on screen where they can
  be corrected.

**AC-4 — a batch with nothing selected is refused before the write is issued.**
- **Given** an admin with a reason typed and no entry selected
- **When** they submit
- **Then** the batch is refused with `no_entries_selected` and a sentence, no request reaches the
  datastore, and nothing is reported as done.

**AC-5 — a partly-admitted batch reports what actually happened, and never *done*.**
- **Given** a batch of eight entry ids of which the datastore admits five to this caller
- **When** the batch is rejected
- **Then** the outcome carries `requested: 8` and `rejected: 5`, the five are rejected with the reason,
  the other three are unchanged, and the screen says **"5 of 8"** — a result that names both numbers,
  never *done* and never a count taken from the selection.

**AC-6 — the same entry selected twice counts once.**
- **Given** a batch whose id list contains the same entry id more than once
- **When** the batch is rejected
- **Then** `requested` is the number of **distinct** ids, `rejected` is at most `requested`, and the
  duplicate does not make an otherwise complete batch report as partial.

**AC-7 — failure is atomic: none, not some.**
- **Given** a batch where the datastore raises on any row in it
- **When** the batch is submitted
- **Then** **no** entry in the batch is rejected — not the rows before the failing one and not the rows
  after it — and the caller receives a failure rather than a count.

**AC-8 — a member cannot bulk-reject, and is told so in a sentence.**
- **Given** somebody who is not an admin, holding a valid token, invoking the batch rejection against
  entries they can read — including their own
- **When** the batch is submitted
- **Then** it is refused with `entry_decision_not_permitted` and a sentence, **no entry changes**, and
  no SQLSTATE reaches the interface.

**AC-9 — an approved entry in a batch loses its approver with its approval.**
- **Given** a batch containing an entry whose `status` is `approved` and whose `approvedBy` and
  `approvedAt` are set
- **When** the batch is rejected
- **Then** that entry's `status` is `rejected`, it carries the batch's reason, and `approvedBy` and
  `approvedAt` are both null. This is ADM-05's shipped rule applied per record through the same
  trigger; this ticket adds no rule of its own about provenance.

**AC-10 — an admin may include their own entry in a batch.**
- **Given** an admin whose own pending entry is in the worklist
- **When** they include it in a batch and reject it
- **Then** it is rejected exactly as another member's is, with no special case and no extra refusal —
  the `rbac-and-security.md` row *Approve or reject their own entry* is ✅ for `admin`.

**AC-11 — an entry the caller may not reach is filtered, not errored.**
- **Given** an admin of one team, and a batch containing an entry belonging to a **different** team
- **When** the batch is rejected
- **Then** the request succeeds, the other team's entry is **unchanged**, it is counted out of
  `rejected`, and the response is a partial result rather than an error — the two are different facts
  and the interface must not fold them together.

**AC-12 — the worklist re-reads after a batch, and the outstanding figure is the datastore's.**
- **Given** an admin who has just rejected a batch from `/entries/pending`
- **When** the batch reports back
- **Then** the screen re-reads the page it is on and the outstanding count falls because the datastore
  returned a smaller set — never because rows were removed from a list held in the browser.

**AC-13 — the selection survives a refusal and does not survive a success.**
- **Given** a batch that was refused for a blank reason (AC-3), an empty selection (AC-4) or a
  permission refusal (AC-8)
- **When** the refusal is displayed
- **Then** the selection and the typed reason are still there. **And given** a batch that succeeded
  wholly or partly, **then** the selection and the reason field are cleared, so the next batch cannot
  inherit the last one's contents.

**AC-14 — changing the view clears the selection.**
- **Given** an admin with entries selected on the worklist
- **When** they change the date window, change the kind filter, or move to another page
- **Then** the selection is empty — a batch may only ever contain rows the admin can see at the moment
  they submit it.

**AC-15 — *select all* means this page.**
- **Given** a worklist whose matching set is larger than one page
- **When** the admin uses the select-all control
- **Then** exactly the rows **on the current page** are selected, and no id the screen has not
  displayed is ever part of a batch.

**AC-16 — the batch speaks about entries and dates, never about people's leave.**
- **Given** any state of the batch controls, including the refusals and the partial result
- **When** the copy on `/entries/pending` is read
- **Then** the object is an **entry** and never a request, an application or an *đơn*; no quota,
  balance, entitlement or remaining-days figure appears; nothing reaches HR; and no copy implies the
  members may not be away. Charter refusals 1 and 2, and this is the criterion the feature row names as
  hardest to hold here.

**AC-17 — selecting writes nothing.**
- **Given** an admin selecting rows, clearing rows and typing into the reason field
- **When** no submit has happened
- **Then** no request has been issued and no entry has changed — the batch is composed and then sent,
  and there is no interaction on this screen that writes as a side effect of being used.

**AC-18 — the rejected count comes from the datastore and never from the selection.**
- **Given** any batch
- **When** the outcome is reported
- **Then** `rejected` is the number of rows the datastore itself says it changed, and there is no path
  by which the number of ids sent becomes the number reported rejected — including the case where every
  row was admitted and the two numbers happen to be equal.

**Invariants touched — `[INV-03]`, and exactly that.**

- **INV-03** — *a rejected entry always carries a non-empty rejection reason.* Held by the check
  constraint `entry_rejection_reason_iff_rejected`, which is a biconditional
  (`.ai/standards/data-model.md:162`) and is not amended here. This ticket writes `status` and
  `rejection_reason` **in one statement**, per record, which is what the biconditional requires; and it
  refuses an empty reason **twice** — in `public.reject_entries` with `22023` and a sentence
  (ADR-016 §4), and in the seam before the request is issued (AC-3). Neither refusal is the control.
  The constraint is. AC-2, AC-3.

**INV-02 is deliberately absent, and the feature row is the authority for that**: *"the `approved_by`
and `approved_at` clearing on a rejection is ADM-05's rule applied per entry through the same trigger,
so listing INV-02 here would over-declare on the argument CAL-05 already made about INV-06."* AC-9
observes that clearing; it does not create it, does not amend the clause that does, and ships no
trigger change at all. **INV-05 is absent for the neighbouring reason**: `tentative` is not in this
function's `set` list and not in any grant this ticket touches, so approval-versus-tentativeness is
not reached, only left alone. **INV-01 is absent** because a rejected entry still occupies its slots
(ADR-011) and nothing here changes what the exclusion constraint sees. **INV-04 is absent** on the
argument that kept it off CAL-01, CAL-08 and ADM-05: rejecting changes what the absence count *reads*
and computes no count here.

### Open questions

None of these blocks. Each is recorded because it is a thing a later reader would otherwise have to
re-derive, and each says what it costs.

1. **The batch's reason and the per-entry reason are the same field, and nothing enforces that they
   stay the same field.** ADM-05 writes `rejection_reason` through `rejectEntry`; this ticket writes
   the identical column through `public.reject_entries`. Two writers, one column, and the only thing
   keeping them in agreement is that both go through INV-03's constraint. That is enough for
   correctness and it is not enough for *meaning*: if a later ticket gives the single rejection a
   structured reason and the batch does not, the two diverge silently. Recorded, not fixed — a shared
   shape today would be a shape with one member.
2. **`db-max-rows` is still unresolved, and this plan does not depend on it.** ADR-016 §4 and the
   feature row both carry the `TODO(verify):` about whether it caps a PATCH's returned representation
   or its affected rows. **This ticket sends no PATCH and returns no representation** — the function
   returns one integer and the ids travel in the POST body — so the ambiguity does not reach it. It is
   named here so that a reader who arrives from either of those documents does not go looking for the
   handling that is missing on purpose.
3. **Five `[OWED]` labels in `supabase/db.sql` are stale, and this ticket adds a sixth.** ADM-05
   recorded the same finding and did not sweep it either. After this migration ships, the
   `[OWED] ADM-06` markers at `supabase/db.sql:535` and `:696-698` describe a function that exists.
   ADR-026 decision point 6 says applying `db.sql` discharges no migration, so nothing is *wrong*; the
   labels are simply behind. The fix shape is a check that reads the marker set against
   `supabase/migrations/`, and it wants a ticket of its own rather than a sweep by whoever ships next.
4. **`public.reject_entries` has no upper bound on `p_ids`.** ADR-016 §4 removed the *query-string*
   ceiling by moving the ids into the body, and put no ceiling in their place. A pathological array is
   bounded in practice by AC-15 — a batch may only contain rows on one page, and `PENDING_PAGE_SIZE`
   is 50 — so the reachable maximum from this product's own interface is fifty ids. That bound lives in
   the interface and not in the function, which is the honest description of it.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

Checked before writing: `.ai/board/tickets/ADM-06/design/` does not exist, and
`.ai/board/ideas/2026-08-31-no-way-to-tell-a-settled-plan-from-a-typed-one.md` — the file this
feature's `Notes` row cites — attaches no image.

**One bar above the list, and one checkbox on each row.** The worklist keeps every element it has:
the header and its count, the two filters, the rows with their member, dates, kind, portion and
`Open` link, ADM-05's per-row `EntryDecision` panel, and the pager. This ticket adds exactly two
things to that screen — a **selection checkbox at the start of each row**, and a **batch bar between
the filters and the list** — and changes nothing else.

**The bar is present but inert until something is selected.** It carries, in this order: the number
selected, the select-all-on-this-page control, the reason field, the submit, and a clear. It is not a
dialog and it does not cover the list, because the one thing an admin must be able to do while typing
a reason for twelve entries is **look at the twelve entries**. A modal here would hide the batch's
contents at the moment they are being justified, which is the same failure as selecting across pages
and is refused for the same reason.

**The reason field is always visible in the bar, not a disclosure.** ADM-05's per-row panel opens its
field on Reject, because there the reject control and the field are the same act begun. Here the field
is the whole content of the bar and there is nothing to disclose it from — a bar that opened a field
that opened a submit would be three clicks to do once what the row-level control does in two.

**The result of a batch is a sentence in the bar and stays there.** *"5 of 8 entries rejected"* on a
partial batch, and it does not disappear on the re-read — AC-5's number is the one thing on the screen
that the re-read cannot show, because the rows it is about are gone from the view. A toast would take
the only record of a partial write off the screen after four seconds.

**The batch bar sits outside `[data-testid="pending-entries"]`.** That is a placement decision with a
test consequence and it is deliberate — ADM-04's AC-9 suite asserts that the list itself holds no
`form`, and keeping the bar outside the `<ul>` is what leaves that assertion meaningful after this
ticket. § 7 says what the same suite does lose.

**Density: this is a grid and the bar must not cost it a row when nothing is selected.** `CLAUDE.md`
§ *Visual direction* — charm belongs in the empty states, never in the calendar grid; the worklist is
the nearest thing this product has to one. The bar is a single line at rest.

## 3. Permission model

**Two rows consumed, none amended, and they are the two ADM-05 already consumes**
(`.ai/standards/rbac-and-security.md:36-37`):

| Action | `member` | `admin` |
|---|---|---|
| Approve or reject another member's entry | ❌ | ✅ |
| Approve or reject their own entry | ❌ | ✅ |

**There is no bulk row and none is written.** Rejecting eight entries is the action in row one, done
eight times in one statement; a separate permission for the plural would be a second place the same
rank is decided, and `rbac-and-security.md` is human-only under RULE-01 in any case.

**Where the check runs — in the database, in two mechanisms that both still fire, and this is the
whole reason the function is `security invoker`.**

1. **`entry_update_admin`** (shipped by CAL-03,
   `supabase/migrations/20260903160000_cal03_admin_entry_writes.sql:80`) — `using (is_admin(uid) and
   the entry's member is on the caller's team)`. It is what makes AC-11 a **filter** rather than an
   error: a row this predicate does not admit is not matched by the `update`, so it is silently not
   updated, which is the fail-quiet behaviour AC-5 exists to make visible.
2. **Clause (a) of `public.entry_enforce_decision()`** (shipped by ADM-05,
   `supabase/migrations/20260905190000_adm05_entry_decision.sql:84-92`) — raises `42501` when a
   non-admin moves `status`, `rejection_reason`, `approved_by` or `approved_at`. It is what makes AC-8
   a **refusal** rather than a filter, and the difference matters: `entry_update_own` admits a member's
   **own** rows, so without clause (a) a member's bulk rejection of their own entries would pass the
   policy. Clause (a) is the only thing between them and it fires inside this function exactly as it
   fires on a single PATCH.

**`security invoker` is load-bearing and is the sentence a reviewer should check.** ADR-016 §4:
*"No authorization moves into the function: `entry_update_admin` and clause (a) both still run, exactly
as for a single PATCH. The function is a transport change, not an enforcement layer."* A
`security definer` version would run as the owner, both mechanisms would evaluate against the owner
rather than the caller, and this ticket would have moved the check out of the declarative layer that
ADR-005 puts it in. **If the migration is ever rewritten as `security definer`, this feature has become
an authorization bypass**, and nothing in `src/` would report it.

**What a member must not be able to do**, and where each denial is held:

| Denial | Held by | Observable as |
|---|---|---|
| Bulk-reject another member's entries | `entry_update_admin` filters them, then clause (a) raises on any that `entry_update_own` admitted | AC-8 |
| Bulk-reject **their own** entries | clause (a). The policy admits them; **only** the trigger refuses | AC-8 |
| Reach another team's entries in a batch | `entry_update_admin`'s team predicate, silently | AC-11 |
| Write a rejection with no reason | `entry_rejection_reason_iff_rejected`, and `22023` in the function before it | AC-3 |
| Write `approved_by` or `approved_at` through the batch | the function's `set` list names neither, and neither is granted to `authenticated` at all | AC-9 |

**Everything in `src/` on this path is an affordance and none of it is a control.** The checkboxes,
the bar, the disabled submit, the seam's blank-reason and empty-selection refusals: all of them are
there so the interface is usable and the messages are sentences. A member who reached them in a
debugger, or who called `reject_entries` with their own token from anywhere else, is refused by clause
(a) and by nothing this ticket writes above the seam. `.ai/standards/rbac-and-security.md`
§ *Where the check runs*.

**One honest limit, inherited from ADM-05 and not fixed here.** ADR-016's headline consequence asks
for the denial to be issued *against a real PostgreSQL with a member's token, not through the seam*.
No project is provisioned and `tests/permission-model.test.ts` does not exist. Against
`src/lib/data/mock.ts`, AC-8 demonstrates **the sentence** and not the refusal; the refusal is clause
(a)'s and is verified the day a project exists. ADM-05's plan recorded exactly this and it is not
weaker here — it is the same clause doing the same work through a different transport.

## 4. Contract

Exact and copy-pasteable (RULE-04). Every name the developer will type appears below first.

### 4.1 Domain types — `src/lib/domain/types.ts`

**One interface and one failure code. Nothing existing changes shape**, so no existing caller changes
and the *"changes a shared type module"* clause of `.ai/01-operating-model.md:375` is not engaged —
the CAL-04, ADM-02, CAL-08 and ADM-04 precedent, each of which added shapes here at M.

```ts
// ---------------------------------------------------------------------------
// ADM-06. 01-plan.md section 4.1.
// ---------------------------------------------------------------------------

/**
 * ADM-06. What a bulk rejection actually did.
 *
 * BOTH NUMBERS, and that is the whole reason this is a shape rather than a `number`. A row the policy
 * does not admit is FILTERED rather than errored, so a batch of eight can reject five and report
 * success; a caller holding only the count cannot tell that from a batch of five that rejected five.
 * `requested` is what was asked for and `rejected` is what the datastore says it changed, and the
 * screen is required to say both (AC-5, AC-18).
 */
export interface BulkRejectionOutcome {
  /** DISTINCT ids sent, after de-duplication in the seam (AC-6). Never the raw array length. */
  requested: number;
  /** `get diagnostics row_count` from `public.reject_entries`. NEVER derived from `requested`. */
  rejected: number;
}
```

And one member added to the existing `FailureCode` union, beside ADM-05's two:

```ts
  // ADM-06, AC-4. A batch with nothing in it, refused in the SEAM before a request is issued.
  //
  // It is a refusal rather than a no-op because `update ... where id = any('{}')` succeeds and
  // changes nothing, so an empty batch would otherwise report `{ requested: 0, rejected: 0 }` —
  // ok:true on a write that never happened, which is the exact fail-quiet shape this whole ticket
  // exists to make visible. NOT `rejection_reason_required`: the two refusals name different missing
  // things and one code carrying two sentences is how a wrong message reaches a screen (CAL-01's
  // reasoning, applied a third time).
  | "no_entries_selected"
```

### 4.2 The seam — `src/lib/data/index.ts`, `mock.ts`, `supabase.ts`

**One function, added to `DataSeam` below `rejectEntry`.** `approveEntry` and `rejectEntry` are
**unchanged — not one character**, and so are `listPendingEntries`, `updateEntry` and `deleteEntry`.

```ts
  /**
   * ADM-06 AC-1 to AC-11, AC-18. Rejects SEVERAL entries in ONE statement, with ONE reason written
   * onto every one of them.
   *
   * IT IS `public.reject_entries(p_ids uuid[], p_reason text)` AND NOT A PATCH WITH `id=in.(…)`.
   * ADR-016 section 4, verified there against the installed @supabase/postgrest-js: `in()` appends
   * the ids TO THE QUERY STRING at 37 bytes per uuid, so a few hundred meets a proxy's request-line
   * cap as an opaque 414 — at the exact moment an admin clears a backlog. Chunking to avoid that
   * reintroduces the cross-chunk partial failure a single statement does not have.
   *
   * NEITHER TAKES A ROLE NOR CHECKS ONE, the property every write on this seam has: the controls are
   * `entry_update_admin` and clause (a) of `public.entry_enforce_decision()`, both of which still run
   * AS THE CALLER because the function is `security invoker` (01-plan.md section 3).
   *
   * IT RETURNS BOTH NUMBERS. A row the policy does not admit is FILTERED, not errored — the batch
   * succeeds and changes fewer rows than it named — so `rejected` comes from the function's
   * `get diagnostics row_count` and `requested` from the de-duplicated id list, and a caller is
   * expected to compare them (AC-5, AC-18).
   *
   * IT REFUSES TWO THINGS BEFORE ISSUING ANYTHING, and both are AFFORDANCES: a blank or
   * whitespace-only reason (`rejection_reason_required`, AC-3) and an empty id list
   * (`no_entries_selected`, AC-4). The controls are `entry_rejection_reason_iff_rejected` and the
   * function's own `22023`; these exist so the interface never renders a SQLSTATE.
   *
   * FAILURE IS ATOMIC (AC-7). One statement, one transaction: if the datastore raises on any row,
   * none are rejected and this returns a failure rather than a partial count.
   *
   * NOT FOR N=1. `rejectEntry` above stays the single path — ADR-016 section 4 in terms — and this
   * function is never called to reject one entry from the row-level panel.
   */
  rejectEntries(entryIds: string[], reason: string): Promise<Result<BulkRejectionOutcome>>;
```

**`src/lib/data/supabase.ts`** — the implementation, in full:

```ts
const BULK_REJECT_REFUSED = "These entries could not be rejected.";
const NOTHING_SELECTED = "Select at least one entry before rejecting.";

  // ADM-06 AC-1 to AC-11, AC-18.
  //
  // `.rpc()` AND NOT `.update()`, and the reason is ADR-016 section 4's rather than a preference:
  // the ids travel in the POST body instead of the query string, so the 414 ceiling is gone; and the
  // function returns the affected count, which is the only way the filtered-row case is detectable at
  // all.
  //
  // THE PARAMETER NAMES ARE THE FUNCTION'S — `p_ids` and `p_reason`. PostgREST matches an RPC's
  // arguments by name, so a rename here is a 404 at runtime and not a type error.
  //
  // `toDecisionFailure` IS REUSED UNCHANGED and no fourth mapper is written. It already answers the
  // three codes this path can produce — 42501 from clause (a), 23514 from INV-03's biconditional, and
  // PGRST301 for a missing or expired token — and 22023 is the one addition, which is the same
  // sentence 23514 already carries because it is the same missing thing.
  async rejectEntries(entryIds: string[], reason: string): Promise<Result<BulkRejectionOutcome>> {
    if (reason.trim() === "") {
      return { ok: false, error: { code: "rejection_reason_required", message: REASON_REQUIRED } };
    }

    // AC-6. De-duplicated HERE rather than left to `= any(p_ids)`, which collapses them silently:
    // `requested` must be a number the returned count can be compared against, and the raw array
    // length is not one.
    const ids = [...new Set(entryIds)];
    if (ids.length === 0) {
      return { ok: false, error: { code: "no_entries_selected", message: NOTHING_SELECTED } };
    }

    const { data, error } = await client().rpc("reject_entries", {
      p_ids: ids,
      p_reason: reason,
    });

    if (error) return { ok: false, error: toDecisionFailure(error) };

    // AC-18. The count is the datastore's. A null or non-numeric body is a contract violation rather
    // than a zero — reporting "0 of 8" for a response nobody could read would be the fail-quiet
    // answer to a fail-quiet problem.
    if (typeof data !== "number") {
      return { ok: false, error: { code: "unknown", message: BULK_REJECT_REFUSED } };
    }

    return { ok: true, value: { requested: ids.length, rejected: data } };
  },
```

and one case added to the existing `toDecisionFailure`, which is otherwise untouched:

```ts
    // ADM-06. `public.reject_entries` raises this for a blank reason — ADR-016 section 4, "an empty
    // reason is refused with a sentence rather than a raw 23514". UNREACHABLE FROM THIS APPLICATION,
    // because `rejectEntries` refuses it first; reaching it means a caller that is not this
    // application, and the honest answer is still the one about the reason.
    case "22023":
      return { code: "rejection_reason_required", message: REASON_REQUIRED };
```

**`src/lib/data/mock.ts`** — the same signature, reproducing the datastore's behaviour and **declaring
that it does**:

```ts
  // ADM-06 AC-1 to AC-11, AC-18.
  //
  // IT REPRODUCES `public.reject_entries` PLUS THE TWO CONTROLS AROUND IT, which is the third time
  // this file does that and is declared for the reason it already states for INV-01 and for clauses
  // (a) and (b): the mock is not a datastore anybody's data lives in, the real mechanisms are the
  // policy and the trigger, and this exists so AC-5, AC-7, AC-8 and AC-11 are observable end to end
  // with no provisioned project.
  //
  // THE ORDER IS THE DATASTORE'S: reason, then selection, then the policy filter, then the guard,
  // then the write. Reversed anywhere it stops modelling the thing it is modelling.
  //
  // ATOMIC ON FAILURE (AC-7): the guard is evaluated over the WHOLE admitted set before a single row
  // is written, so a refusal leaves every entry exactly as it was. Nothing here writes as it goes.
  async rejectEntries(entryIds: string[], reason: string): Promise<Result<BulkRejectionOutcome>> {
    if (reason.trim() === "") {
      return { ok: false, error: { code: "rejection_reason_required", message: REASON_REQUIRED } };
    }

    const ids = [...new Set(entryIds)];
    if (ids.length === 0) {
      return { ok: false, error: { code: "no_entries_selected", message: NOTHING_SELECTED } };
    }

    const me = members.find((m) => m.id === currentMemberId && m.removedAt === null) ?? null;
    if (!me) {
      return { ok: false, error: { code: "entry_not_permitted", message: BULK_REJECT_REFUSED } };
    }

    // The two PERMISSIVE policies composing, exactly as `approveEntry` and `rejectEntry` compose
    // them. A row neither admits is FILTERED — dropped from the set and counted out — and is never an
    // error (AC-11).
    const admitted = ids
      .map((id) => entries.find((e) => e.id === id && (ownsEntry(me, e) || adminMayReach(me, e))))
      .filter((e): e is Entry => e !== undefined);

    // Clause (a), over the whole admitted set and BEFORE any write. A rejection moves `status` or
    // `rejection_reason` on every row it touches, so a non-admin is refused for the batch as a whole
    // — which is what one statement and one transaction means (AC-7, AC-8).
    const moves = admitted.some(
      (e) => e.status !== "rejected" || e.rejectionReason !== reason,
    );
    if (moves && !(me.role === "admin" && me.removedAt === null)) {
      return { ok: false, error: { code: "entry_decision_not_permitted", message: DECISION_REFUSED } };
    }

    // The write, through the SAME function the single path uses, so clause (b)'s nulling of
    // `approved_by` and `approved_at` is written once in this file rather than twice (AC-9).
    for (const row of admitted) {
      applyDecision(me, row, { status: "rejected", rejectionReason: reason });
    }

    return { ok: true, value: { requested: ids.length, rejected: admitted.length } };
  },
```

### 4.3 The migration — `supabase/migrations/20260905230000_adm06_reject_entries.sql` (new)

**Three statements, transcribed from `supabase/db.sql:553-566` and `:697-698`**, which carry the
target under ADR-026 marked `[OWED] ADM-06`. Nothing is designed here: ADR-016 §4 wrote this function
and `db.sql` already holds it verbatim.

```sql
create or replace function public.reject_entries(p_ids uuid[], p_reason text) returns integer
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

**What the file must say in its header, because each is a decision a reviewer has to be able to check:**

- **`security invoker` is the whole safety argument** — § 3, and ADR-016 §4. A `definer` version is an
  authorization bypass.
- **`revoke all … from public` comes before the grant**, because PostgreSQL grants `execute` on a new
  function to `public` by default. Without the revoke the grant is decoration and `anon` can call it.
  This is the redundant-grant trap ADM-03 recorded, in its dangerous direction rather than its
  harmless one.
- **No new trigger, no `create or replace` on `entry_enforce_decision()`, no new policy, no new
  column, no new grant on `public.entry`.** The `set` list names `status` and `rejection_reason`,
  which ADM-05 already granted to `authenticated`
  (`20260905190000_adm05_entry_decision.sql:170`), and the function runs as the caller so it needs
  exactly those and no more. **A second `BEFORE UPDATE` trigger on `entry` is ADR-016's own third
  revert signal** and this file must not add one.
- **`create or replace function`, not `create function`**, matching `db.sql` and every function
  migration in this repository.

### 4.4 The screens

**`src/components/BulkRejection.tsx` (new).** The bar. It is handed the selection and reports the
outcome; it holds no list, issues no read, and calls `seam.rejectEntries` and nothing else.

```ts
export interface BulkRejectionProps {
  /** The selected entry ids, in the order the rows are displayed. The bar never chooses them. */
  selectedIds: string[];
  /** Every id on the current page, for the select-all control (AC-15). Never the matching set. */
  pageIds: string[];
  /** Select-all and clear both go through the caller, which owns the selection state (AC-14). */
  onSelectionChange: (ids: string[]) => void;
  /** The batch landed, wholly or partly. The CALLER re-reads — this bar splices nothing (AC-12). */
  onRejected: () => void | Promise<void>;
}

export default function BulkRejection(props: BulkRejectionProps): JSX.Element;
```

**Why a second component rather than an extension of `EntryDecision`.** They are different controls
over different things — one entry against a set — and `EntryDecision`'s props are one `Entry`. The
duplication ADM-05 was avoiding does not arise here, because **that component does not hold the rule
either**: its own header says it deliberately does not check the reason, since INV-03's biconditional
is the control and the seam already refuses a blank one. Two components, one rule, held in the
database — which is what ADR-005 asks for. § 8, rejected alternative 1.

**`src/routes/PendingEntries.tsx` (amended).** Four additions and nothing removed:

1. `const [selected, setSelected] = useState<string[]>([])` — the selection lives on the screen and
   not in the bar, because AC-14 resets it on a query change and AC-15 needs the page's ids.
2. `useEffect` clearing `selected` whenever `query` changes — AC-14, one line, and it must key on the
   same `query` memo `load` already depends on.
3. `<BulkRejection … onRejected={load} />` between the filter row and the list — outside the `<ul>`,
   § 2b.
4. A checkbox as the first child of each `<li>`, `data-testid="pending-entry-row-select"`, checked
   from `selected` and toggling it.

Untouched: `load`, the four view phases, `localToday`, both filters, the pager, the count paragraph,
the row link, and ADM-05's `<EntryDecision>` mount. The one write on this screen is still the panel's
and the bar's; **this file issues none itself**, which is the property ADM-04 established and ADM-05
kept.

**Copy, all English** (`.ai/standards/ui-design-system.md` § Language; `PendingEntries.tsx` is not on
`copyDebt` and must not join it). The strings, fixed here so AC-16 is checkable:

| Element | Copy |
|---|---|
| Bar, nothing selected | `Select entries to reject them together.` |
| Bar, n selected | `n entries selected` (`1 entry selected` at one) |
| Select-all control | `Select every entry on this page` |
| Reason label | `What would work instead?` — the same question ADM-05's panel asks |
| Submit | `Reject the selected entries` |
| Clear | `Clear the selection` |
| Whole result | `n entries rejected, each with this reason.` |
| Partial result | `5 of 8 entries rejected. The other 3 were not yours to decide and are unchanged.` |
| Standing note | `The entries stay on the board and stay theirs to edit or remove. This is the team's schedule, not permission to be away.` |

The last row is ADM-05's sentence, repeated deliberately: it is the copy that holds charter refusal 2,
and a batch is where it is most needed and most likely to be dropped.

### 4.5 Selectors

`.ai/standards/ui-design-system.md` § Selectors — a control with no selector cannot be exercised.

| Selector | Element | Criteria |
|---|---|---|
| `bulk-rejection` | the bar, carrying `data-selected="<n>"` | AC-13, AC-14, AC-17 |
| `bulk-rejection-reason` | the reason field, `data-required="true"` | AC-3 |
| `bulk-rejection-submit` | the submit | AC-1 to AC-11 |
| `bulk-rejection-select-all` | select every row on this page | AC-15 |
| `bulk-rejection-clear` | clear the selection | AC-13 |
| `bulk-rejection-result` | the outcome sentence, `data-requested` and `data-rejected` | AC-5, AC-18 |
| `bulk-rejection-error` | the refusal, `data-code="<FailureCode>"` | AC-3, AC-4, AC-8 |
| `pending-entry-row-select` | the per-row checkbox, one per `pending-entry-row` | AC-1, AC-14, AC-15 |

`data-requested` and `data-rejected` are two attributes rather than one string, for the reason ADM-04
gave for `data-total` beside `data-shown`: a test that has to parse *"5 of 8"* out of a sentence is a
test that breaks when the sentence is reworded, and the number is the criterion while the wording is
not.

## 5. Seam impact

**One function added, `rejectEntries`, in `index.ts`, `mock.ts` and `supabase.ts` — same name, same
arity, so `tests/seam-parity.test.ts` passes unedited.**

**Nothing existing changes signature.** `approveEntry`, `rejectEntry`, `listPendingEntries`,
`updateEntry`, `deleteEntry`, `listTeamEntries` and every other member of `DataSeam` are untouched, so
no existing caller changes and the XL clause of `.ai/01-operating-model.md:375` is not engaged — see
§ 7.

**One existing helper gains one case**: `toDecisionFailure` in `supabase.ts` learns `22023`. It is a
new case in an existing `switch`, not a changed one, and the three cases ADM-05 wrote keep their
codes and their sentences.

**This is the first `.rpc()` call in the seam** — `grep -rn "\.rpc(" src/` returns nothing today — and
that is worth a reviewer's attention rather than a note in passing. It is a second shape of request
beside the table builders, and PostgREST resolves an RPC's arguments **by name**, so `p_ids` and
`p_reason` are part of the contract in a way a column name reached through `.update()` is not: a
rename is a runtime 404 that typechecks cleanly.

## 6. Schema delta

**Not `none`.** ADR-014, and there is no carve-out: this migration creates a function and changes two
privileges.

`schema_delta`: *creates `public.reject_entries(uuid[], text)` — ADR-016 §4, transcribed from
`supabase/db.sql:553-566` — and its two privilege statements, `revoke all … from public` then
`grant execute … to authenticated` (`supabase/db.sql:697-698`)*

`requires_adr: true` — **ADR-016**, `ACCEPTED by tech-lead-design` on 2026-08-31. Its §4 decides this
function, gives its body, and states the `security invoker` argument that keeps it inside ADR-005.
**No new ADR is written by this ticket**, and none is needed: nothing here supersedes or reverses an
accepted decision, and every object below was decided in a document that already exists.

**Verified owed against `supabase/migrations/`, not read off `db.sql`'s labels** — five of which are
stale (*Open questions* item 3), so the labels are evidence of intent and not of state:

- `grep -rn "reject_entries" supabase/migrations/` returns **nothing**. The function does not exist in
  any shipped migration.
- The only `grant execute` statements in `supabase/migrations/` are TEA-01's, on `is_admin` and the
  membership trigger's function. None names `reject_entries`.

**One object the ticket shell named and this plan does not create.** `ticket.yaml`'s original
`schema_delta` read *"creates `public.reject_entries(uuid[], text)` and its execute grant"* — correct,
and it omits the `revoke`. The revoke is not cosmetic and is not implied by the grant: PostgreSQL
grants `execute` on a newly created function to `public` by default, so without it the function is
callable by `anon` and the grant that follows changes nothing. `db.sql:697` has it; the corrected
`schema_delta` above names it.

**Applying the migration is human — RULE-09.** This one is a smaller step than ADM-05's, and the
reason is worth stating rather than assuming: ADM-05's file opened two columns to `authenticated` in
the same breath as the guard that constrains them, so applying it in the wrong order was a real
hazard. This file opens nothing. The columns are already granted, the guard is already installed, and
the function is a new call path over both.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260905230000_adm06_reject_entries.sql"
  - "src/lib/data/index.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/domain/types.ts"
  - "src/components/BulkRejection.tsx"
  - "src/routes/PendingEntries.tsx"
  - "tests/bulk-rejection.test.ts"
  - "tests/e2e/adm-06-bulk-reject.spec.ts"
  - "tests/e2e/adm-04-worklist.spec.ts"
```

Ten globs, ten files; four are new — the migration, the component and the two test files.

**`size`: M, agreeing with `size_estimate` in section 1.** ADR-012 is not engaged and nothing splits.
Ten of M's ceiling of twelve (`.ai/01-operating-model.md` § Sizing).

**The XL clause was checked rather than assumed, because this ticket ships a migration.**
`.ai/01-operating-model.md:375` lists a schema change under XL, and its own next paragraph gives the
operative test: *"XL is for changes that break the seam's existing contract … The test is whether
existing callers must change, not whether the seam was touched at all."* **No existing caller
changes**: `rejectEntry` keeps its two-parameter signature and every call site of it, `updateEntry`
and `listPendingEntries` are untouched, `BulkRejectionOutcome` is a new shape with one producer, and
`no_entries_selected` is an addition to a union no exhaustive switch consumes. Seven tickets have now
shipped migrations at M — CAL-01, CAL-02, CAL-03, ADM-01, ADM-02, ADM-03, ADM-05.

**The tenth path is a shipped test suite, and it is here for a decided reason rather than a
discovered one.** `tests/e2e/adm-04-worklist.spec.ts` asserts, inside `[data-testid="pending-entries"]`,
that the list holds no `form` and no `input`
(`tests/e2e/adm-04-worklist.spec.ts:279-280`). **AC-1 puts a checkbox on every row, which is an
`<input>` inside that list**, so the second assertion cannot survive this ticket. The permitted edit is
**one line removed and one comment amended, and nothing else**:

- **`form` stays at 0**, which is why § 2b places the batch bar outside the `<ul>`. That is the half of
  ADM-04's property that is still true and still worth holding: the list itself has no form of its own.
- **`input` goes**, with a comment naming ADM-06 as what superseded it, in the same form ADM-05's
  amendment used for `textarea` and `button`.
- **The four `pending-entry-row-*` / `pending-entries-*` selector assertions above it and the whole
  AC-15 vocabulary check below it are untouched.** ADM-04's own criterion stays legible and the losing
  triage argument at `.ai/registry/features.md:103` that it protects stays readable.

This is written into `allowed_paths` at PLAN rather than found at IN_PROGRESS. ADM-05 hit the same
collision from the other side, its § 7 claimed the suite would pass unedited, and the developer was
blocked on a four-line edit to a file RULE-03 forbade them — recorded in that ticket's
`99-questions.md` and Changelog. The lesson generalises and is the reason for this paragraph: **a
structural assertion about what a shipped screen does *not* contain is a liability owned by whichever
ticket adds the thing.**

**Deliberately absent, each with its reason:**

- **`supabase/db.sql`** — ADR-026 decision point 6: applying it discharges no migration, and the
  target schema does not change because `db.sql` already **holds this function verbatim** at `:553`.
  Turning two `[OWED] ADM-06` labels into `[SHIPPED]` is a label edit no ticket is assigned, and
  ADM-02, ADM-03 and ADM-05 all shipped without doing it. *Open questions* item 3.
- **`src/components/EntryDecision.tsx`** — the per-row panel is unchanged. The batch is a different
  control over a different thing, and ADR-016 §4 keeps the single reject on its own path.
- **`supabase/seed.sql`, `src/lib/fixtures.ts`** — **no fixture is added, deliberately**, the choice
  ADM-05 made and for its reason: every criterion here is stronger created by the write it is testing.
  `FIXTURE_APPROVED_ENTRY` already exists for AC-9 and `FIXTURE_OTHER_TEAM_ENTRY` is already a pending
  entry on another team, which is AC-11 with no new row.
- **`tests/entry-decision.test.ts`, `tests/e2e/adm-05-approve-reject.spec.ts`, `tests/pending-entries.test.ts`,
  `tests/seam-parity.test.ts`** — **the four safety nets, and all must pass unedited.** Checked
  assertion by assertion rather than assumed, which is the whole lesson of the tenth path above: none
  of them asserts the absence of a control, `adm-05-approve-reject.spec.ts`'s `toHaveCount(0)` calls
  are all about `entry-decision*` selectors and page text, and `seam-parity` counts names and arity —
  which a tenth function on both implementations satisfies by construction. If any of them goes red,
  something in this plan is wrong rather than something in that file.
- **`tests/ui-language.test.ts`, `ui-language.json`** — nothing translated, nothing de-listed.
  `BulkRejection.tsx` is new so § Language covers it from its first line, and `PendingEntries.tsx` is
  not on `copyDebt` and must not join it. The two new strings in `supabase.ts` and `mock.ts` are
  English, as ADM-05's were; both files are on `copyDebt` for pre-existing copy and the ratchet only
  shrinks.
- **`src/routes/TeamEntries.tsx`, `src/routes/EditEntry.tsx`** — neither lists a set an admin would
  batch, and `EditEntry` is one entry by construction. ADM-05's panel stays the path there.
- **Every calendar view** — CAL-05 refuses decision controls from its side and this idea's triage
  refuses them from the other. A bulk control on a grid would be both, twice.
- **`.ai/standards/rbac-and-security.md`** — two rows consumed, none amended, no new row. RULE-01.
- **`.ai/registry/features.md`** — registry plane; the `Status` column is `/ship`'s.
- **`.ai/registry/decisions/`** — no ADR is written. ADR-016 §4 already decides every object here.

## 8. Rejected alternatives

**1. One component — teach `EntryDecision` to take an array of entries.** Genuinely tidy: one place
where a rejection reason is composed, one set of selectors, and the row-level case is the array of
length one. It is rejected on the shape of its own props. `EntryDecision` renders **inside a row** and
its whole contract is one `Entry` — it reads `entry.status` to decide whether the approve control
exists at all (AC-11 of ADM-05), and it reads `entry.rejectionReason` to pre-fill the field when
re-wording. An array version answers neither question: a set of entries has no single status and no
single existing reason, so every branch in that component would fork on `length === 1`, and a
component that is two components joined by a length check is harder to read than two components.
**The duplication this alternative exists to prevent does not actually arise**, and that is the
decisive part: `EntryDecision`'s own header records that it does **not** hold the rule — INV-03's
biconditional is the control and the seam refuses a blank reason before the round trip — so two
components are two affordances over one rule, not two copies of it.

**2. No migration at all — call `rejectEntry` once per selected entry, in a loop.** The cheapest thing
that produces the feature: no schema delta, no ADR to cite, no new seam function, no `.rpc()`, and it
works against the shipped code today. **It is rejected because it is the failure ADR-016 §4 already
rejected chunking for, taken to its limit.** Eight entries are eight PATCHes, eight transactions and
eight trigger firings; there is no statement spanning them, so a refusal on the fifth leaves four
rejected and three untouched — a **partial write with no transaction and no report**, which is
strictly worse than the filtered-row case this plan spends AC-5 on, because that one at least returns
a count. It is also the slower thing sold as the faster one: the feature's only justification is the
rate, and N round trips is the rate an admin already has. Recorded rather than dismissed because it is
what a reviewer will ask for when they see a migration on a ticket that adds no column.

**3. The naive `PATCH` with `id=in.(…)` — one request, no function, no migration.** Not mine to
re-decide and recorded so the reasoning travels with the code: ADR-016 §4 rejected it against the
installed `@supabase/postgrest-js`, where `in()` appends the ids **to the query string** at 37 bytes
per uuid, so a few hundred entries meets a proxy's request-line cap as an **opaque 414** at exactly
the moment an admin clears a backlog. Worth stating precisely because **this plan caps a batch at one
page of 50 (AC-15), which is about 1.9 KB and would not trip it** — so the alternative is not
obviously broken at this ticket's own sizes, and somebody will notice that. It stays rejected: the cap
is an interface decision that a later ticket could relax in one line, and the request shape should not
be the thing that quietly stops working when it does. The function also returns the affected count,
which the PATCH cannot without `Prefer: count=exact` on a write, and that count is AC-5 and AC-18.

**4. `.maxAffected(n)` as the partial-write detector**, rather than comparing `requested` against the
returned count. It is the purpose-built mechanism —
`PostgrestTransformBuilder.ts:1042-1054`, sending `Prefer: handling=strict, max-affected=n` — and
using it would put the assertion at the transport layer where it belongs. Rejected on two facts ADR-016
§4 records: it is typed `MaxAffectedEnabled<ClientOptions['PostgrestVersion']>` and documented as
*"Only available in PostgREST v13+"*, and the hosted major is unconfirmed with no project provisioned;
and it caps a **maximum** and cannot detect **fewer** rows than expected, which is the only direction
that matters here. It would refuse a batch that affected too many rows — a case this product cannot
produce — while staying silent on the case it exists for.

**5. A confirmation dialog naming the entries about to be rejected.** The obviously-responsible thing,
and `.ai/standards/ui-design-system.md` § *Destructive actions* is right there. It is rejected because
**a rejection is not destructive and must not be dressed as though it were.** The charter and the
idea's triage both say what a rejection does: the entry stays on the board, stays its member's, stays
editable and stays deletable by them, and nothing in the product is disabled because it is rejected. A
modal asking *are you sure you want to reject 12 entries* would teach exactly the reading charter
refusal 2 forbids — that this is a decision about twelve people's leave rather than one lead
rearranging a week — and it would do it at the moment the reading is most available. What replaces it
is § 2b's non-modal bar: the list stays visible while the reason is typed, so the admin sees the batch
instead of confirming a number.

## Changelog

- `2026-09-05T23:10:00+07:00` — sections 1–8 written. First version. Raised by `tech-lead-design`.
