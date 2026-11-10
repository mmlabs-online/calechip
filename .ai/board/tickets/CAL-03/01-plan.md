---
ticket: CAL-03
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-03T14:22:53+07:00
inputs_read:
  - .ai/board/tickets/CAL-03/ticket.yaml
  - .ai/board/tickets/CAL-01/01-plan.md
  - .ai/board/tickets/CAL-02/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/00-charter.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-011-inv-01-exclusion-constraint.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/registry/decisions/ADR-018-who-may-read-the-member-list.md
  - .ai/standards/architecture.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260903143000_cal02_own_entry_writes.sql
  - supabase/migrations/20260901093000_tea03_member_select_team.sql
  - src/lib/data/index.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/EditEntry.tsx
  - src/routes/NewEntry.tsx
  - src/App.tsx
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# CAL-03 — Edit or delete another member's entry, as an admin

## 1. Problem and scope

### The feature row, transcribed

`.ai/registry/features.md:90`, `CAL-03`, group `CAL`, status `PLANNED`, invariants touched
`INV-01, INV-02, INV-06, INV-07`:

> From 2026-08-31-a-plan-has-nowhere-to-be-written-down.md. A separate permission row in
> rbac-and-security.md and a separate policy from CAL-02, kept as its own row because it is the only
> one carrying known weakness 3: v1 records no trace that an admin edited somebody else's entry, so
> the charter amendment of 2026-08-31 — an entry stops being purely its author's statement — lands
> entirely here. Creating on another member's behalf stays denied while editing and deleting are
> permitted; that asymmetry is decided, is not obvious, and is the reason this row must not grow a
> create path. data-model.md open question 5 (`updated_by`) would close the weakness, blocks nothing,
> and is a schema change with its own decision. `schema_delta` none.

**The row's closing `schema_delta` none is stale, exactly as CAL-02's was.** ADR-014 —
`ACCEPTED by the operator` — has no carve-out for a policy, and this ticket ships two. The ticket
shell already carries the correction. Recorded as a finding for a human: `features.md` is registry
plane under RULE-01.

### What this gives whom

An **admin** gains the ability to correct or remove somebody else's entry. That is the last of the
three write verbs the permission table gives them over the calendar, and it is the one that changes
what an entry *is*: after this ticket an entry is no longer purely its author's statement. The
charter amendment of 2026-08-31 recorded that, and the feature row says it lands entirely here.

A **member** gains nothing and must lose nothing. CAL-02 gave them their own entries; this ticket
adds a second, wider policy beside that one, and permissive policies OR together — so the single
most likely defect in this ticket is a widening that reaches further than `is_admin` and quietly
gives every member the admin's row.

**`size_estimate`: M.** Twelve files, two of them new. The migration is unusually small — two
policies and nothing else — and the weight is on the surface: an admin needs a way to *reach* another
member's entry, and no such read exists yet. Not `L`: no new table, no new column, no new grant, and
no new write function in the seam.

### Out of scope

- **Creating an entry on another member's behalf.** Denied for both roles in
  `.ai/standards/rbac-and-security.md`, and the feature row is explicit that the asymmetry is decided
  and that this row must not grow a create path. **No `insert` policy is added and none may be.**
- **Approving or rejecting, and any write to `status` or `rejection_reason`.** ADM-04 and ADM-05.
  Both columns remain outside the update grant CAL-02 wrote, and this ticket does not widen it.
- **Recording who edited.** `.ai/standards/data-model.md` OPEN QUESTIONS item 5 — an `updated_by`
  column would close known weakness 3, it blocks nothing, and it is a schema change with its own
  decision. **This ticket ships the capability that makes the weakness real and does not close it.**
  See *Open questions* item 1.
- **The month, week and year views.** CAL-04, CAL-05, CAL-06. This ticket adds one flat read of the
  team's entries so the admin can reach a row; it is not range-shaped, it computes nothing, and
  section 5 states the boundary.
- **The absence count, the overload threshold, the roster count.** CAL-04 and CAL-07.
- **Notifying the member, or the approving admin, that their entry changed.** v1 has no notification
  channel and the change feed is on the brief's P1 list. The feature row settles this for the delete
  case and the same reasoning covers the edit.
- **Demoting an admin, or any change to who is an admin.** TEA-04 shipped promotion; demotion is a
  denial by default in `rbac-and-security.md` and is not touched.
- **Whether an entry may be edited onto a date in the past.** Still the open `TODO(project)` on
  `.ai/registry/features.md:87`, which left CAL-01's AC-12 unwritten and CAL-02 silent. Unchanged
  here — see *Open questions* item 2.

## 2. Acceptance criteria

Every criterion is observable through the interface. The selector attribute is `data-testid`.

**AC-1 — an admin edits another member's entry**
- **Given** a signed-in admin, and a `pending` entry belonging to a different member of the same team
- **When** the admin opens that entry, changes its dates, and saves
- **Then** the entry is stored with the new dates and still belongs to the original member

**AC-2 — an admin deletes another member's entry**
- **Given** a signed-in admin, and an entry belonging to a different member of the same team
- **When** the admin deletes it and confirms
- **Then** the entry is gone, and reloading does not bring it back

**AC-3 — an admin's substantive edit revokes an approval (INV-02, actor-blind)**
- **Given** a signed-in admin, and an `approved` entry belonging to a different member which names
  an approver
- **When** the admin changes its dates and saves
- **Then** the entry reads `pending`, carries no approver and no approval time — the reset is the
  same one the owner's own edit produces

**AC-4 — an admin's note-only edit does not revoke an approval (INV-02)**
- **Given** a signed-in admin, and an `approved` entry belonging to a different member
- **When** the admin changes only the note and saves
- **Then** the entry is still `approved` and still names the same approver and approval time

**AC-5 — a member still cannot edit or delete another member's entry**
- **Given** a signed-in member who is not an admin, and an entry belonging to a different member
- **When** they issue an edit or a delete against that entry's id
- **Then** both are refused and the entry is unchanged

**AC-6 — an admin may not create an entry on another member's behalf**
- **Given** a signed-in admin
- **When** a create is issued carrying a `memberId` that is not their own
- **Then** the write is refused — the admin has no more power to create than a member has

**AC-7 — an admin may not move an entry to another member (INV-07)**
- **Given** a signed-in admin editing another member's entry
- **When** a `memberId` other than the entry's owner is submitted with the edit
- **Then** the write is refused and the entry still belongs to its original member

**AC-8 — an admin may not touch an entry belonging to another team (INV-07)**
- **Given** a signed-in admin of one team, and an entry belonging to a member of a different team
- **When** they issue an edit or a delete against that entry's id
- **Then** both are refused and the entry is unchanged

**AC-9 — an admin's edit is refused when it would overlap the owner's other entry (INV-01)**
- **Given** a member who owns a `full` entry covering `2026-11-05` and another covering `2026-11-20`
- **When** an admin edits the second so its range covers `2026-11-05` and saves
- **Then** the save is refused, neither entry changes, and the screen shows a sentence naming the
  clash — the constraint is evaluated against the **owner's** entries, not the admin's

**AC-10 — the team entry list is reachable by an admin and by nobody else**
- **Given** a signed-in member who is not an admin
- **When** they open the team entry list by address
- **Then** the screen refuses and lists no entry belonging to anybody else

**AC-11 — an admin's edit records when it happened, and that is the only trace**
- **Given** an entry belonging to a different member, never edited
- **When** an admin edits it
- **Then** the entry's `updatedAt` is later than its `createdAt`, and nothing stored on the entry
  distinguishes the admin's edit from one the owner made themselves

**AC-12 — deleting an approved entry removes its approval with it**
- **Given** a signed-in admin, and an `approved` entry belonging to a different member which names
  an approver
- **When** the admin deletes it
- **Then** the entry and its approver are gone together, and no row remains referring to either

### Invariants touched

`[INV-01, INV-02, INV-06, INV-07]` — the four the feature row lists. This plan adds none.

- **INV-01** — held by `entry_no_overlapping_portion`, the exclusion constraint CAL-01 shipped.
  Nothing is re-implemented. **The subtlety this ticket introduces is whose entries the constraint
  compares:** it keys on `member_id`, so an admin editing somebody else's row collides with *that
  member's* other entries and never with the admin's own. AC-9 asserts exactly that, and it is the
  case an implementation written from the admin's point of view gets wrong.
- **INV-02** — held by `public.entry_enforce_decision()`. The trigger is **actor-blind by decision**
  (ADR-016 §2): it can distinguish an admin from the owner and deliberately does not, because
  INV-02's text carries no actor qualifier and an editing admin is not necessarily the approving one.
  AC-3 and AC-4 observe that the admin's edit produces the same reset and the same note carve-out as
  the owner's. **This ticket must not add an actor carve-out**, and it changes the function not at all.
- **INV-06** — held by column shape. `portion` stays a single not-null enum; an admin can change
  which portion applies and cannot make it vary by date. Nothing here touches the column or the form.
- **INV-07** — held by three things together: `member_id` absent from CAL-02's update grant, the new
  admin policy's `with check` on team, and the not-null reference the table carries. AC-7 and AC-8
  observe the two halves. **AC-8 is the one with no mechanism of its own if the team predicate is
  omitted** — a policy of `using (public.is_admin(auth.uid()))` alone would let an admin of one team
  edit every entry in the product, and ADR-016 §*Consequences* names precisely that shape.

**INV-03, INV-04 and INV-05 are deliberately absent.** INV-03 is unreachable: `rejection_reason` is
not in the update grant and this ticket does not widen it. INV-04 and INV-05 are the absence count —
this ticket computes none, reads no threshold and reads no roster. Changing rows the count will later
sum is what every write ticket does, and `.ai/registry/invariants.md` warns that a list is what a
change *could* affect rather than everything downstream of it.

### Open questions

1. **Known weakness 3 becomes real with this ticket and is not closed by it.**
   `.ai/standards/rbac-and-security.md` known weakness 3: *"An admin may edit any member's entry, and
   v1 records no trace of it."* Until now that was a statement about a capability nobody had; after
   this ticket the capability exists. `updated_at` moves (AC-11) and says *when*, never *who*.
   `.ai/standards/data-model.md` OPEN QUESTIONS item 5 offers `updated_by` as the cheapest close and
   records that it blocks nothing and is a schema change with its own decision. **Not blocking** —
   the feature row decided the capability ships without it. Recorded here because this is the ticket
   after which the weakness has teeth, and the operator should meet that rather than discover it.

2. **The past-date question is still open** — `.ai/registry/features.md:87`, unchanged through CAL-01
   and CAL-02. It names creating and editing, so it reaches an admin's edit too. **Not written as an
   AC and no rule is implemented in either direction.** The operator's, under RULE-01. One answer
   settles CAL-01's AC-12, CAL-02 and this ticket together.

3. **`tests/permission-model.test.ts` still does not exist.** AC-5, AC-6, AC-7 and AC-8 are four
   denials, and AC-8 is the one that cannot be observed honestly through the interface: exactly one
   team exists in v1, so the cross-team case is asserted against seeded data rather than through a
   real second team's session. ADR-018's revert condition names that same limitation for TEA-03's
   read, and the fixtures this ticket extends were built for it. **Not blocking** — pre-existing
   debt, recorded by CAL-01 and CAL-02 before it. It is worth being plain that a one-team fixture
   passes whether the team predicate is in the policy or absent from it, which is why section 6 puts
   the predicate in writing rather than leaving it to a test to catch.

---

*Sections 1 and 2 above were written before the source tree was read for this ticket. Sections 3 to 8
were written after. Nothing in 1 or 2 was amended.*

---

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. Every decision is a policy or a column privilege —
ADR-005. Nothing in `src/` is a control.

| Action | `member` | `admin` | Where the decision is made |
|---|---|---|---|
| Edit or delete another member's entry | ❌ | ✅ | policies `entry_update_admin` and `entry_delete_admin`, both `using (is_admin(uid) and same team)` |
| Edit or delete their own entry | ✅ | ✅ | `entry_update_own` / `entry_delete_own`, CAL-02, untouched |
| Create an entry on another member's behalf | ❌ | ❌ | `entry_insert_own`'s `with check`, CAL-01, untouched. **No insert policy is added** |
| Change `member_id` on an edit | ❌ | ❌ | column privilege — `member_id` is not in CAL-02's update grant |
| Set `status` or `rejection_reason` | ❌ | ❌ | column privilege — neither is in the update grant. ADM-05 |
| Touch an entry of another team | ❌ | ❌ | the team predicate in both policies above |
| Read the team's entries | ✅ | ✅ | `entry_select_team`, CAL-01, untouched |

**This ticket completes the permission table's calendar rows for an admin.** Every row above except
the first was already delivered; the first is what CAL-02's migration deliberately left out, naming
this ticket.

### Three properties of the policy pair that decide whether this is correct

**1. Permissive policies OR together, and that is the mechanism, not a hazard to work around.**
`entry_update_own` admits the caller's own rows; `entry_update_admin` admits their team's rows when
the caller is an admin. An admin gets the union, a member gets only the first. No policy is dropped
and no policy is edited — **CAL-02's two policies must come through this ticket untouched**, and a
reviewer who finds them modified has found the defect.

**2. The team predicate is load-bearing and is the half with no test behind it.** A policy of
`using (public.is_admin((select auth.uid())))` alone reads correct, passes every test that can be
written against a one-team fixture, and lets an admin of any team edit every entry in the product at
P2. That is `rbac-and-security.md` known weakness 1 — *fails open and silently* — and ADR-016
§*Consequences* names this exact shape. Both helpers are TEA-01's `security definer` functions, so a
policy on `entry` may consult `member` without recursing through `member`'s own policies.

**3. No grant is added, and adding one would be the redundant-grant trap.** CAL-02 already wrote
`grant update (start_date, end_date, type, portion, tentative, note) on public.entry to authenticated`
and `grant delete on public.entry to authenticated`. Both are **role-blind** — `member` and `admin`
are the same PostgreSQL role, `authenticated` — so the privilege an admin needs is already held and
the policy is the only thing that was missing. This inverts the trap found three times in this
repository (TEA-01, ADR-016 §*Consequences*, CAL-02 step 2), where the policy existed and the grant
did not. A second `grant` here would read as a control and be none.

### The affordances

The team entry list renders edit and delete controls, and it renders nothing at all to a caller whose
`getCurrentMember()` is not an admin. **That is an affordance and carries a comment saying so** —
what stops a member is `entry_update_admin`, not the absence of a screen. AC-10 asserts the
affordance; AC-5 asserts the control, by issuing the write rather than by looking for a button.

## 4. Contract

### 4.1 Seam addition — one read, and no write

```ts
  // -------------------------------------------------------------------------
  // CAL-03 — edit or delete another member's entry, as an admin. 01-plan.md section 4.1.
  // -------------------------------------------------------------------------

  /**
   * CAL-03 AC-1, AC-2, AC-3, AC-4, AC-9, AC-10, AC-12. Every entry of the caller's team, newest
   * start date first — the caller's own included.
   *
   * DELIBERATELY FLAT, and this is the boundary with CAL-04. It takes NO date range, returns no
   * count, and is not the read the month grid issues: CAL-04's is range-shaped
   * (`date_range=ov.…`), feeds INV-04's `absenceCountsFor`, and is given the roster. This one
   * answers "which entries exist for this team" so an admin can reach a row, and it must not grow a
   * range parameter — the moment it does, there are two team-entry reads and one of them will be
   * the one nobody updated. Same reasoning that kept `listOwnEntries` narrow at CAL-01.
   *
   * NO ROLE PARAMETER AND NO `is_admin` CHECK INSIDE IT. `entry_select_team` admits the team's rows
   * to every member, because `Read any entry in the team` is ✅ for both roles — so this read is not
   * where the admin capability lives. What an admin may do with a row it returns is decided by
   * `entry_update_admin`, in the datastore.
   *
   * THROWS on a transport failure and on a possibly-truncated answer, the shape `listMembers` and
   * `listOwnEntries` use. A short list here would hide entries from the one person able to correct
   * them, which is the failure TEAM_ENTRY_LIMIT exists to turn into an error.
   */
  listTeamEntries(): Promise<Entry[]>;
```

**No write function is added, and that is the finding this section leads with.** `updateEntry` and
`deleteEntry` were written at CAL-02 as *policy-driven* operations: they take an entry id, issue the
statement, and read the affected-row count to tell success from a filtered refusal. Nothing in either
mentions ownership, because ownership was never theirs to decide. Adding `entry_update_admin` widens
what those same two functions may reach, with no change to either signature or body — which is what
ADR-005 predicts when authorization lives entirely in the database, and is the cleanest available
evidence that CAL-02 put the check in the right place.

**One constant in `src/lib/domain/types.ts`:**

```ts
/** CAL-03. The explicit row limit `listTeamEntries` asks for, and the count at which it refuses to
 *  answer. Separate from OWN_ENTRY_LIMIT because a team's entries outnumber one member's and the two
 *  numbers move for different reasons; shared with nothing, for the same reason ROSTER_LIMIT is its
 *  own constant. It must sit BELOW the datastore's own `max-rows` cap or the assertion never fires.
 *
 *  TODO(verify): the datastore's default `max-rows`. The same unknown is carried by CAL-04, ADM-02,
 *  ADM-04 and OWN_ENTRY_LIMIT. If it is lower than this, the fix is this one number. */
export const TEAM_ENTRY_LIMIT = 2000;
```

### 4.2 The failure mapping

**Unchanged from CAL-02, and no failure code is added.** An admin meets the same three sentences a
member meets, for the same three situations:

| Refusal | Reaches the browser as | Code |
|---|---|---|
| `entry_no_overlapping_portion` — AC-9 | `409`, SQLSTATE `23P01` | `overlapping_entry` |
| both policies filtered the row — AC-5, AC-8 | `200`, empty body, zero rows | `entry_not_permitted` |
| ungranted column named — AC-6, AC-7 | `403`, SQLSTATE `42501` | `entry_not_permitted` |
| `entry_end_after_start` | `400`, SQLSTATE `23514` | `invalid_date_range` |

**`entry_not_permitted` still covers "not yours", "no such entry" and now "another team's" alike**,
and must keep doing so. A distinct code for the cross-team case would tell an admin that an id exists
in a team they cannot read, which is the enumeration oracle the merged code exists to prevent.

### 4.3 The screens

**`src/routes/TeamEntries.tsx` — new, route `/entries/team`.** Guarded like `/entries/new`:
membership state `member`, otherwise `Navigate to="/"`. Inside, it calls `getCurrentMember()` and
renders the refusal to a non-admin — the same shape `AllowList.tsx` and `MemberList.tsx` already use,
which is why neither of those is in `allowed_paths`.

| `data-testid` | What it is |
|---|---|
| `team-entries` | the list container |
| `team-entry-row` | one row per entry, carrying `data-entry-id` |
| `team-entry-row-member` | the owner's display name — the column that makes this list different from the own-entry list |
| `team-entry-row-dates` | `yyyy-MM-dd → yyyy-MM-dd`, both bounds always, as CAL-01 fixed |
| `team-entry-row-status` | carried as `data-status`, for AC-3 and AC-4 |
| `team-entry-row-edit` | a link to `/entries/:id/edit` |
| `team-entry-row-delete`, `team-entry-delete-confirm` | the delete control and its confirmation |
| `team-entries-refused` | what a non-admin sees. AC-10 |
| `team-entries-empty` | the empty state |

**The owner's name comes from `listMembers()`**, which TEA-03 already built and which returns the
team's roster including removed members. Joining it to the entries in the component costs no new
read and no new policy.

**`src/routes/EditEntry.tsx` — one change.** It currently loads the entry from `listOwnEntries` and
renders `edit-entry-not-found` when the id is not in that list. It now chooses the read by the
caller's role: `listTeamEntries()` for an admin, `listOwnEntries()` otherwise. **`edit-entry-not-found`
keeps its name, its position and its silence** — it still says nothing about whether the id exists.

**`tests/e2e/cal-02-edit-delete-entry.spec.ts` is the safety net for that change and is not in
`allowed_paths`.** CAL-02's twelve criteria must pass unedited; the admin branch is new behaviour on
a screen those tests already cover, and if it breaks the member path they report it. The same rule
CAL-02 applied to CAL-01's suite.

**`src/routes/Home.tsx`** gains one admin-only link to `/entries/team`, beside the `/allow-list` link
TEA-05 established there. One line, same condition.

## 5. Seam impact

**One function added: `listTeamEntries`.** It appears in `index.ts`, `supabase.ts` and `mock.ts` with
the same name and arity, or `tests/seam-parity.test.ts` fails — that test follows the seam unedited.

**No existing seam function changes signature, return type or body.** `updateEntry` and `deleteEntry`
gain reach through the policy alone (section 4.1).

**Parity is necessary and not sufficient, and the subtle shape is the mock's team scoping.** The real
implementation is scoped by `entry_select_team` and issues no team filter of its own. `mock.ts` has
no policy, so it must filter to the caller's team explicitly — and **a mock that returns every entry
it holds passes parity, passes every happy-path test, and makes AC-8 untestable against the seam the
end-to-end suite actually drives**, because BUG-001 pinned that suite to `mock`. The mock must also
refuse `updateEntry` and `deleteEntry` for a non-admin against somebody else's row, and for anybody
against another team's row, mirroring the two policies rather than approximating them. Each of those
carries a comment naming the policy it stands in for.

## 6. Schema delta

**Not `none`** — ADR-014, no carve-out for a policy. One new migration,
`supabase/migrations/20260903xxxxxx_cal03_admin_entry_writes.sql`. Applying it is human — RULE-09.

Approved ADRs it rests on, all already accepted, **and no new ADR is written**: every decision below
sits inside an existing envelope.

- **ADR-005** — why the policies are the control and the seam is not.
- **ADR-014** — why this is not `none`.
- **ADR-016** — §*Consequences* states that CAL-03's admin policy *"would happily reassign an entry to
  another member and break INV-07"* if written as `using (public.is_admin(…))` alone, and assigns the
  column grant excluding `member_id` to CAL-02 and CAL-03. CAL-02 wrote that grant; this ticket
  inherits it and writes the predicate ADR-016 warned about.
- **ADR-018** — the team-scoped read, and the precedent for `public.member_team_id()` on both sides
  of a comparison.

What the migration contains — **two policies, and nothing else at all:**

1. ```sql
   create policy entry_update_admin on public.entry
     for update to authenticated
     using (
       public.is_admin((select auth.uid()))
       and public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
     )
     with check (
       public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
     );
   ```

   **`using` carries `is_admin` and `with check` does not, and that asymmetry is deliberate.** `using`
   sees the OLD row and answers *may this caller touch this row at all* — that is where the role
   belongs, and it is AC-5 and AC-8. `with check` sees the NEW row and answers *may the row look like
   this afterwards*; repeating `is_admin` there would re-assert a fact `using` already established
   and would read as a second control while being none. What `with check` must catch is a **move
   across teams**, which `using` structurally cannot see, because `using` is evaluated against the
   old row's team.

   It is **redundant while `member_id` is ungranted** — CAL-02's column list omits it permanently, so
   `NEW.member_id` always equals `OLD.member_id` — and it is kept anyway as the second lock, exactly
   as CAL-02's own policy and TEA-04's `member_update_admin` keep theirs. AC-7 is held by the grant
   first and this clause second.

2. ```sql
   create policy entry_delete_admin on public.entry
     for delete to authenticated
     using (
       public.is_admin((select auth.uid()))
       and public.member_team_id(member_id) = public.member_team_id((select auth.uid()))
     );
   ```

   No `with check` — a delete has no new row.

**What the migration must NOT contain, and each absence is a decision:**

- **No `insert` policy, permanently.** The feature row: *"this row must not grow a create path."*
  `entry_insert_own`'s `with check (member_id = (select auth.uid()))` stays the only insert path for
  both roles, and AC-6 is that policy, unmodified, doing its job.
- **No grant of any kind.** Section 3, property 3.
- **No edit to `entry_update_own` or `entry_delete_own`.** They are permissive and compose by OR.
- **No change to `public.entry_enforce_decision()`.** INV-02 is actor-blind by decision (ADR-016 §2)
  and AC-3 exists to observe that it stays so. Adding an actor carve-out here would be reversing an
  accepted ADR, which is the operator's call and not this ticket's.
- **No edit to any shipped migration.** Both policies are new objects in this ticket's own file.

`ticket.yaml`'s `schema_delta` is rewritten to link the four ADRs above and `requires_adr` is set to
`true`, correcting the `false` the shell carried beside a non-`none` `schema_delta`.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260903*_cal03_admin_entry_writes.sql"
  - "supabase/seed.sql"
  - "src/lib/fixtures.ts"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/routes/TeamEntries.tsx"
  - "src/routes/EditEntry.tsx"
  - "src/routes/Home.tsx"
  - "src/App.tsx"
  - "tests/e2e/cal-03-admin-edit-entry.spec.ts"
```

Twelve globs, twelve files; two are new — the migration and `src/routes/TeamEntries.tsx`.

**`size`: M, agreeing with `size_estimate` in section 1.** ADR-012 is not engaged and nothing splits.
Twelve is M's ceiling, the figure TEA-05 fixed and CAL-01 and CAL-02 both sat below. It is worth
saying where the twelve went, because the migration is the smallest this board has produced and the
count is the highest: two of the files are the migration and its seed, four are the seam and its
types, four are the interface, and two are fixtures and a spec. **Nothing here is a second capability
hiding inside the first** — an admin who cannot reach another member's entry has not been given the
permission, so the read and the screen are the feature rather than an addition to it.

**`supabase/seed.sql` and `src/lib/fixtures.ts` carry one new row: an entry owned by
`FIXTURE_OTHER_TEAM_MEMBER`.** AC-8 has nothing to assert against otherwise — the fixtures already
hold a second team and a member on it, from TEA-03, but no entry. Everything else AC-1 to AC-12 needs
already exists: `FIXTURE_APPROVED_ENTRY` belongs to `FIXTURE_APPROVED_MEMBER`, which is **not** the
admin, so AC-3, AC-4 and AC-12 have an approved entry of somebody else's to act on without a new
fixture.

**Deliberately absent, each with its reason:**

- `tests/e2e/cal-02-edit-delete-entry.spec.ts` — **the safety net for the `EditEntry.tsx` change**
  (section 4.3). Must pass unedited.
- `tests/e2e/cal-01-create-entry.spec.ts` — AC-6's create path is CAL-01's policy unmodified; that
  suite proves it still refuses.
- `tests/seam-parity.test.ts` — follows the seam unedited.
- `tests/e2e/smoke.spec.ts`, `tea-01-signup.spec.ts`, `tea-05-sign-in.spec.ts` — untouched.
- `src/components/EntryForm.tsx` — CAL-02's extraction is used unchanged. The admin edits the same
  six fields the owner does; a form that behaved differently for an admin would be a second place
  where the permission model is expressed.
- `src/routes/NewEntry.tsx` — the own-entry list is unchanged. An admin's own entries appear there
  exactly as before, and the team list is a separate screen.
- `src/routes/MemberList.tsx`, `src/routes/AllowList.tsx` — the admin-refusal shape is copied from
  them, not edited into them.
- Every shipped migration — never edited.
- `.ai/standards/rbac-and-security.md` — **known weakness 3 is made real by this ticket and its text
  is owed a human amendment.** Standards plane, RULE-01. *Open questions* item 1.

## 8. Rejected alternatives

**1. One policy for both roles, `using (member_id = auth.uid() or public.is_admin(auth.uid()) and
same team)`, replacing CAL-02's.** Genuinely plausible and it is what a reader who wants the whole
rule in one place would write: one predicate, one thing to read, no reasoning about how permissive
policies compose. It is rejected on two grounds and the second is the decisive one. First, it edits a
shipped policy — CAL-02's `entry_update_own` would be dropped and recreated, which is a window in
which no policy is attached and a diff in which the member's rule and the admin's rule are one line
that either is right or is wrong as a unit. Second, and worse, **`or` and `and` in one predicate is
where this fails open**: PostgreSQL's precedence binds `and` tighter, so the parenthesisation above
is not what a reader assumes, and a misplaced bracket makes every member an admin with no error and
no test failure on a one-team fixture. Two policies that OR by the engine's own rule are the same
logic with the composition taken out of the author's hands, and `rbac-and-security.md` known weakness
1 is that a policy written too permissively fails open and silently.

**2. Reusing `listOwnEntries` and adding a `memberId` parameter, rather than a new
`listTeamEntries`.** Plausible and it is the smaller diff: one function instead of two, one place
where entry reads are shaped, and the parameter would be an address rather than a permission surface
— the same argument that justified `removeMember(memberId)` and `updateEntry(entryId, …)`. Rejected
because the two reads answer different questions and the parameter hides that. `listOwnEntries()`
takes nothing precisely so that it cannot be asked about somebody else, and the seam's own comment
says so; adding the parameter would make the *absence* of an argument mean "me", which is a default
rather than a guarantee. It would also give the month view a plausible-looking home — the parameter
generalises, and CAL-04's range-shaped read would arrive as a second parameter on the same function
rather than as the new thing it is. Two narrow reads that each refuse to grow are cheaper than one
that invites it.

**3. Adding an `updated_by` column in this ticket, closing known weakness 3 while the capability
ships.** The most tempting of the three, and it is the *right* thing on the merits: this is the
ticket that makes the weakness real, `data-model.md` already names the column, and closing a hole in
the same change that opens it is how it ought to work. It is rejected because it is a schema change
the operator has not decided. `data-model.md` OPEN QUESTIONS item 5 is open, it says in words that
this is *"a decision about how much trace v1 keeps"*, and RULE-09 makes a schema change permanently
human. Writing the column here would be an agent answering a product question by shipping it, which
`.ai/registry/invariants.md` and the charter both put outside what an agent may do. The honest move
is the one taken: ship the capability the feature row decided, record in *Open questions* that the
weakness now has teeth, and leave the column to the operator.

## Changelog

- `2026-09-03T14:22:53+07:00` — sections 1 to 8 written. Sections 1 and 2 written before the source
  tree was read; nothing in either was amended afterwards. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.
