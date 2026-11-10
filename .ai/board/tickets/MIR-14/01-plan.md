---
ticket: MIR-14
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-03T09:20:00Z
inputs_read:
  - .ai/board/tickets/MIR-14/ticket.yaml
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/plans/multi-tenancy-status.md
  - .ai/board/tickets/MIR-10/01-plan.md
  - .ai/board/tickets/MIR-13/01-plan.md
  - .ai/board/tickets/MIR-13-b/01-plan.md
  - .ai/board/tickets/ADM-05/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-035-a-third-role-manager-decides-entries-and-nothing-else.md
  - .ai/registry/decisions/ADR-067-the-runner-pushes-merges-and-decides-blocked-questions-on-its-own.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/decisions/ADR-072-reads-that-feed-the-absence-count-resolve-to-the-primary-team.md
  - .ai/standards/rbac-and-security.md
  - .ai/01-operating-model.md
  - supabase/migrations/20260903103000_cal01_entry.sql
  - supabase/migrations/20260905190000_adm05_entry_decision.sql
  - supabase/migrations/20260911170000_solo_approval_settings.sql
  - supabase/migrations/20260913120000_solo_manager_decision_generated_columns.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/_isolation.psql
  - src/lib/roles.ts
  - src/lib/data/index.ts
  - src/lib/data/mock.ts
  - src/lib/data/supabase.ts
  - src/lib/data/absence.ts
  - src/routes/PendingEntries.tsx
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-14 — the decision slice: one decider on any of the owner's teams, approval switches OR-ed, rejecter and self-approval recorded

## 1. Problem and scope

**Feature — MIR-14** (`.ai/registry/features.md:303`), transcribed:

> A multi-team member's entry needs approval if any of their teams requires it, the first decision wins, any rejection rejects, and both approver and rejecter are recorded

MIR-14 is the first of two tickets. It is split by operation (ADR-073 decision 9):

- **MIR-14** (this ticket) covers the write path. It sets who may decide, what a decision records,
  and when an entry needs one.
- **MIR-14-b** covers the queue. Owner names across teams, the teams each entry affects, and the
  empty-queue fallback.

**Who gains what.**

- **A manager** may decide their own entry. The database marks that decision `self_approved`.
- **A manager of any one of the owner's teams** may decide that owner's entry. Their decision is
  final for every team.
- **A manager** may no longer overturn a rejection someone else made.
- **Every rejection** records who made it and when. Until now a rejection recorded nobody.
- **A member on several teams** gets an entry that waits for a decision if any of their teams
  requires one.

No writer creates a second active membership yet (ADR-072 decision 5). So, in production, only the
self-decision, the rejecter record and the overturn refusal are visible today. The multi-team half
is proven against fixtures.

**Out of scope:**

- **The worklist across teams** — MIR-14-b. That covers owner names for a second-team member, the
  "teams this entry affects" chips, and what a queue shows when a team has no manager.
- **Showing `rejected_by` or `self_approved` on any screen** — MIR-14-b. `Entry` in
  `src/lib/domain/types.ts` is unchanged here. Adding fields to it is a shared-type change (XL).
- **`org_admin` deciding across the org** — MIR-16 (ADR-073 decision 7).
- **Moving the client's role checks onto `team_role`** — MIR-17. `mayDecide(role)` stays global.
- **A writer that creates a second active membership** — not owned by any ticket yet (ADR-072
  decision 5).
- **Re-applying the approval switches when a team changes them, or when an entry returns to
  `pending`** — ADM-08's insert-only rule, unchanged.
- **Recording who auto-approved** (audit A10, third part) — MIR-20's audit log.
- **A team with neither a manager nor an admin.** Nobody can decide its entries, as today. This
  ticket adds no fallback for it.

`size_estimate: M`.

## 2. Acceptance criteria

Fixtures used below come from `supabase/tests/_isolation.psql`: `admin_t`, `manager_t`, `member_t`
and `member_t2` on T (`team_t`); `admin_u`, `manager_u`, `member_u` and `member_u2` on U (`team_u`).
All of them are in Org public.

A **second-team row** means one active `membership` row with `is_primary = false`, inserted by the
test as the owner. Its `team_role` is stated each time.

**AC-1 — any team requiring approval makes the entry wait**
- Given `member_t` has a second-team row on U (`team_role = 'member'`), T has
  `pto_need_approve = false` and U has `pto_need_approve = true`
- When `member_t` inserts a PTO entry
- Then its `status` is `pending`, and `approved_by` and `approved_at` are null

**AC-2 — no team requiring approval auto-approves**
- Given the same rows, with `pto_need_approve = false` on both T and U
- When `member_t` inserts a PTO entry
- Then its `status` is `approved`, `approved_by` is null, `approved_at` is set and `self_approved`
  is false

**AC-3 — a single-team member is unchanged (ADM-08)**
- Given `member_u` is on U only, and U has `wfh_need_approve = false`
- When `member_u` inserts a WFH entry
- Then its `status` is `approved`, and a PTO entry from them, with `pto_need_approve = true`, is
  `pending`

**AC-4 — the manager of a second team decides, and the first decision is final for every team**
- Given `member_t` has a second-team row on U, and holds a pending entry E
- When `manager_u` approves E
- Then E is `approved` with `approved_by = manager_u`
- And `manager_t` and `manager_u` can each still select E, and neither finds it among rows with
  `status = 'pending'`

**AC-5 — a decider's power is per team**
- Given `member_u2` has a second-team row on T with `team_role = 'member'`, and `member_t` holds a
  pending entry E (T only)
- When `member_u2` patches E to `approved`
- Then no row changes
- And when `manager_u` patches E to `approved` (`manager_u` shares no team with `member_t`), no row
  changes

**AC-6 — a manager whose global role is manager decides only where they manage**
- Given `manager_u` has a second-team row on T with `team_role = 'member'`, and `member_t` holds a
  pending entry E
- When `manager_u` approves E
- Then no row changes, and E stays `pending`

**AC-7 — a rejection records its rejecter**
- Given `member_t` holds a pending entry E
- When `manager_t` rejects E with reason "Trùng lịch"
- Then E is `rejected`, `rejected_by = manager_t`, `rejected_at` is set, `approved_by` and
  `approved_at` are null, and `self_approved` is false

**AC-8 — a batch rejection records its rejecter on every row**
- Given `member_t` holds two pending entries
- When `manager_t` calls `public.reject_entries(<both ids>, 'Trùng lịch')`
- Then it returns 2, and both rows carry `rejected_by = manager_t` and a non-null `rejected_at`

**AC-9 — a manager may decide their own entry, and it is recorded**
- Given `manager_t` holds a pending entry E
- When `manager_t` approves E
- Then E is `approved` with `approved_by = manager_t` and `self_approved = true`
- And when `manager_t` rejects a second own pending entry with a reason, it is `rejected` with
  `rejected_by = manager_t` and `self_approved = false`

**AC-10 — an admin's self-approval is recorded too**
- Given `admin_t` holds a pending entry E
- When `admin_t` approves E
- Then `self_approved = true`

**AC-11 — `self_approved` is only ever about the current approval**
- Given `member_t`'s entry E approved by `manager_t`
- Then `self_approved` is false
- And given `manager_t`'s own self-approved entry, when `admin_t` rejects it with a reason,
  `self_approved` is false

**AC-12 — a second approval changes nothing**
- Given `member_t` has a second-team row on U, and E is approved by `manager_t`
- When `manager_u` approves E
- Then `approved_by` is still `manager_t`, and `approved_at` is unchanged

**AC-13 — any rejection rejects**
- Given the same rows, and E approved by `manager_t`
- When `manager_u` rejects E with a reason
- Then E is `rejected`, `rejected_by = manager_u`, and `approved_by`, `approved_at` and
  `self_approved` are cleared

**AC-14 — a manager may not overturn another person's rejection**
- Given the same rows, and E rejected by `manager_t`
- When `manager_u` approves E
- Then the write is refused with SQLSTATE 42501, and E is unchanged
- And when `manager_u` rewrites E's reason, the write is refused with 42501, and the reason and
  `rejected_by` are unchanged

**AC-15 — the rejecter may change their own decision**
- Given E rejected by `manager_t`
- When `manager_t` rewrites the reason
- Then the new reason stands, with `rejected_by = manager_t` and a new `rejected_at`
- And when `manager_t` then approves E, E is `approved`, and `rejected_by`, `rejected_at` and
  `rejection_reason` are null

**AC-16 — an admin keeps every ADM-05 transition**
- Given E rejected by `manager_t`
- When `admin_t` approves E
- Then E is `approved` with `approved_by = admin_t`
- And when `admin_t` rewrites the reason on a row `manager_t` rejected, the write succeeds and
  `rejected_by = admin_t`

**AC-17 — the fallback is the team's admin**
- Given T has no active manager (`manager_t` demoted to member by `admin_t` with
  `set_member_role`), and `member_t` holds a pending entry E
- When `admin_t` approves E
- Then it succeeds
- And when `admin_u` (same org, no shared team) approves E, no row changes

**AC-18 — INV-02 clears every decision record**
- Given E is `approved` with `self_approved = true`, and a second entry F is `rejected` with
  `rejected_by` set, both owned by `manager_t`
- When the owner changes `end_date` on each
- Then both are `pending`, with `approved_by`, `approved_at`, `rejection_reason`, `rejected_by` and
  `rejected_at` null, and `self_approved` false
- And when only `note` changes on an approved entry, nothing else moves

**AC-19 — the wire cannot write the new columns**
- Given any authenticated caller
- When they insert an entry naming `rejected_by`, `rejected_at` or `self_approved`, or patch any of
  the three on a row they can update
- Then the write is refused with 42501

**AC-20 — a decider can read what they may decide, and nobody else gains a read**
- Given `member_t` has a second-team row on U, and holds entry E
- Then `manager_u` selects E
- And `member_u` does not
- And `admin_u` does not by this policy, because the admin half needs a shared active team
- And the roster `manager_u` reads (`member_select_team`) still does not contain `member_t`

**AC-21 — the client affordance follows (mock seam)**
- Given the mock seam with the current member set to a manager
- When they call `approveEntry` on their own pending entry
- Then the result is ok, with `approvedBy` equal to their id
- And `rejectEntries` over a batch containing their own entry succeeds for every row

**AC-22 — the refusal sentence (both seams)**
- Given a manager calls `approveEntry` on an entry another decider rejected (mock: the rejection was
  made as another member)
- Then the result is `{ ok: false, error.code: "entry_decision_not_permitted" }`, and the message is
  exactly the `DECISION_REFUSED` sentence in § 4.4

**Invariants touched:** `[INV-02, INV-03, INV-07]`

- **INV-02.** Clause (c) gains three more columns to clear. The reset itself is unchanged (AC-18).
- **INV-03.** A reason rewrite now also moves `rejected_by`. `entry_rejection_reason_iff_rejected` is
  untouched (AC-15).
- **INV-07.** This ticket reads "every team that member belongs to" as the set of teams whose
  decider may decide the entry and whose switch can hold it `pending`. No count changes (AC-20).

**Open questions:** none. The plan's agreed rules (plan:30-35) settle every behaviour above. The
choices they left open are ADR-073, under the delegation below.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No layout changes in this slice. The only visible change is that a manager's own entries on
`/pending` get the approve and reject controls the rest of the rows already have, through
`mayDecideEntriesOf`. The "teams affected" display is MIR-14-b's.

## 3. Permission model

The server side is the control. The client is the affordance (ADR-005).

| Action | Who may | Who may not | Where it is checked |
|---|---|---|---|
| Decide another member's entry | admin sharing an active team with the owner; `team_role = 'manager'` on any of the owner's active teams | any other member, including a global `manager` with no manager row on the owner's teams (AC-5, AC-6); any admin with no shared team (AC-17) | `entry_update_admin` (unchanged), `entry_update_manager` and clause (a) — both through `may_decide_entry` |
| Decide their own entry | admin; manager (`team_role = 'manager'` on one of their own active teams) — **new, ADR-073 decision 3** | member | `entry_update_own` admits the row; clause (a) admits the decision |
| Approve, or rewrite the reason on, an entry someone else rejected | admin; the rejecter | any other manager (AC-14) | clause (a1), 42501 |
| Reject an approved entry | any decider (AC-13) | — | clause (a) |
| Write `rejected_by`, `rejected_at` or `self_approved` | nobody from the wire | every role (AC-19) | the column grants, unchanged: insert `(member_id, type, portion, start_date, end_date, tentative, note)`; update `(status, rejection_reason)` plus CAL-02's |
| Read an entry they may decide | the decider (AC-20) | everyone else, beyond the policies already there | `entry_select_decider` |

The manager's content containment (clause (a2)) is unchanged. It masks the three new columns along
with the four existing decision columns.

## 4. Contract

### 4.1 Migration `supabase/migrations/20261103210000_mir14_multi_team_decisions.sql`

It runs in one `begin; … commit;` and is idempotent (ADR-024). Applying it to a remote project is
human-only (RULE-09).

**Columns** (ADR-070 § 4, verbatim):

```sql
alter table public.entry
  add column if not exists rejected_by   uuid        null,
  add column if not exists rejected_at   timestamptz null,
  add column if not exists self_approved boolean     not null default false;

alter table public.entry drop constraint if exists entry_rejected_by_org_fk;
alter table public.entry
  add constraint entry_rejected_by_org_fk
  foreign key (rejected_by, org_id) references public.member (id, org_id) on delete restrict;
```

There is no backfill. Existing rejected rows keep `rejected_by` null. Under AC-14 only an admin can
change them. Say so in the file header.

**The helper:**

```sql
create or replace function public.may_decide_entry(p_uid uuid, p_owner uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select p_uid is not null and p_owner is not null and (
    (public.is_admin(p_uid) and public.shares_active_team(p_owner, p_uid))
    or exists (
      select 1
        from public.membership c
        join public.member cm on cm.id = c.member_id
       where c.member_id = p_uid
         and c.left_at is null
         and c.team_role = 'manager'::public.team_role
         and cm.removed_at is null
         and cm.status = 'approved'::public.member_status
         and c.team_id in (select public.member_team_ids(p_owner))
    )
  );
$$;
revoke all on function public.may_decide_entry(uuid, uuid) from public, anon;
grant execute on function public.may_decide_entry(uuid, uuid) to authenticated;
```

**Policies:**

```sql
drop policy if exists entry_update_manager on public.entry;
create policy entry_update_manager on public.entry
  for update to authenticated
  using      (not public.is_admin((select auth.uid()))
              and public.may_decide_entry((select auth.uid()), member_id))
  with check (public.may_decide_entry((select auth.uid()), member_id));

drop policy if exists entry_select_decider on public.entry;
create policy entry_select_decider on public.entry
  for select to authenticated
  using (public.may_decide_entry((select auth.uid()), member_id));
```

`entry_update_admin`, `entry_update_own`, `entry_select_team` and `entry_delete_*` are not touched.

**`entry_apply_approval_setting()`** becomes `security definer` (ADR-073 decision 6). The trigger
itself is unchanged:

```sql
create or replace function public.entry_apply_approval_setting() returns trigger
  language plpgsql security definer set search_path = '' as $$
declare
  v_needs boolean;
begin
  if new.status is distinct from 'pending'::public.entry_status then
    return new;
  end if;

  select bool_or(case new.type
                   when 'wfh'::public.entry_type then t.wfh_need_approve
                   when 'pto'::public.entry_type then t.pto_need_approve
                 end)
    into v_needs
    from public.team t
   where t.id in (select public.member_team_ids(new.member_id));

  if v_needs is false then
    new.status           := 'approved'::public.entry_status;
    new.approved_by      := null;
    new.approved_at      := now();
    new.rejection_reason := null;
    new.self_approved    := false;
    new.rejected_by      := null;
    new.rejected_at      := null;
  end if;

  return new;
end;
$$;
revoke all on function public.entry_apply_approval_setting() from public, anon;
```

**`entry_enforce_decision()`** is a `create or replace` of the 2026-09-13 body. The changes, clause
by clause:

- The `updated_at` line is unchanged.
- **(a)** keeps the same "decision column moved" test. The body becomes:

  ```sql
  if not public.may_decide_entry(v_uid, old.member_id) then
    raise exception 'only an admin, or a manager of one of this person''s teams, may decide this entry'
      using errcode = '42501';
  end if;
  -- (a1) ADR-073 decision 4
  if not public.is_admin(v_uid)
     and old.status = 'rejected'::public.entry_status
     and old.rejected_by is distinct from v_uid then
    raise exception 'only the person who rejected this entry, or an admin, may change that decision'
      using errcode = '42501';
  end if;
  ```

  This replaces both the `may_decide` refusal and the own-entry refusal.
- **(a2)** keeps its guard, with the `may_decide(v_uid)` conjunct replaced by
  `may_decide_entry(v_uid, old.member_id)`. Its mask becomes
  `'{status,rejection_reason,approved_by,approved_at,rejected_by,rejected_at,self_approved,updated_at,date_range,portion_slots}'`.
- **(b)** becomes:

  ```sql
  if new.status = 'approved'::public.entry_status
     and old.status is distinct from 'approved'::public.entry_status then
    new.approved_by      := v_uid;
    new.approved_at      := now();
    new.rejection_reason := null;
    new.self_approved    := (v_uid is not null and v_uid = old.member_id);
    new.rejected_by      := null;
    new.rejected_at      := null;
  elsif new.status = 'rejected'::public.entry_status
     and (old.status is distinct from 'rejected'::public.entry_status
          or new.rejection_reason is distinct from old.rejection_reason) then
    new.rejected_by   := v_uid;
    new.rejected_at   := now();
    new.approved_by   := null;
    new.approved_at   := null;
    new.self_approved := false;
  elsif new.status is distinct from 'approved'::public.entry_status then
    new.approved_by   := null;
    new.approved_at   := null;
    new.self_approved := false;
    if new.status is distinct from 'rejected'::public.entry_status then
      new.rejected_by := null;
      new.rejected_at := null;
    end if;
  end if;
  ```

- **(c)** keeps its condition. Its body also sets `new.rejected_by := null`,
  `new.rejected_at := null` and `new.self_approved := false`.

Comments in the function are carried forward. Where a comment cites ADR-035 item 3, it is amended to
cite ADR-073 decision 3.

### 4.2 pgTAP `supabase/tests/170-multi-team-decisions.test.sql`

There is one file, and AC-1 to AC-20 each have at least one assertion labelled `AC-n`. It follows the
`160-read-path-org-bound.test.sql` header pattern: `_isolation.psql`, `tests.seed()`, an explicit
`plan(n)`, and `rollback`.

`supabase/tests/010-catalogue.test.sql` adds to the definer census:

- under `-- MIR-14 helper`: `'public.may_decide_entry(uuid,uuid)'`
- under `-- MIR-14 trigger`: `'public.entry_apply_approval_setting()'`

### 4.3 Client — no seam signature, no shared type

`src/lib/roles.ts`:

```ts
export const mayDecideEntriesOf = (me: Member, ownerId: string): boolean =>
  me.status === "approved" && me.removedAt === null && mayDecide(me.role);
```

The second parameter is kept, so no caller changes. Its comment says the own-entry clause left with
ADR-073 decision 3.

`src/lib/data/mock.ts`:

- `applyDecision` drops the own-entry refusal, through `mayDecideEntriesOf`.
- It keeps a module-private `const rejectedByOf = new Map<string, string>()`, keyed by entry id.
- On a decision that moves a column, it refuses with `entry_decision_not_permitted` when
  `row.status === "rejected"`, the caller is not an admin, and `rejectedByOf.get(row.id) !== me.id`.
- It sets `rejectedByOf` on every transition into `rejected` and on every reason change. It deletes
  the key when the row leaves `rejected`, including through `updateEntry`'s INV-02 reset.
- `rejectEntries` applies the same refusal per row. The whole batch is refused if any row fails,
  matching the trigger's single statement.

### 4.4 The refusal sentence

`src/lib/data/supabase.ts` and `src/lib/data/mock.ts` both change `DECISION_REFUSED`. The two
constants stay identical:

```ts
const DECISION_REFUSED =
  "Only an admin, or a manager of one of this person's teams, can decide this entry — and only whoever rejected it, or an admin, can change a rejection. Nothing about this entry has changed.";
```

The code `entry_decision_not_permitted` and the 42501 mapping are unchanged.

## 5. Seam impact

**No function is added, removed or re-signed.** `approveEntry`, `rejectEntry` and `rejectEntries`
keep their signatures and their callers.

The supabase seam's behaviour changes only through the database and through one constant's text. In
the mock, `applyDecision` and `rejectEntries` change per § 4.3. Seam parity is unaffected.

## 6. Schema delta

**Not `none`.** It covers:

- three columns on `public.entry` and one composite FK (ADR-070 § 4);
- a new definer helper;
- `entry_update_manager` rewritten and `entry_select_decider` added;
- `entry_apply_approval_setting()` made `security definer` with the OR across teams;
- `entry_enforce_decision()` amended.

These are policies and triggers, so ADR-014 applies. The ADRs are ADR-073 (new, under ADR-067) and
ADR-070. `requires_adr: true`. Applying the migration is human-only (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-073-one-decider-on-any-of-the-owners-teams-decides-a-multi-team-entry.md"
  - ".ai/standards/rbac-and-security.md"
  - ".ai/board/tickets/MIR-14-b/ticket.yaml"
  - "supabase/migrations/20261103210000_mir14_multi_team_decisions.sql"
  - "supabase/tests/170-multi-team-decisions.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "src/lib/roles.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/data/supabase.ts"
  - "tests/manager-role.test.ts"
  - "tests/bulk-rejection.test.ts"
```

Eleven paths, so `size: M`, which agrees with `size_estimate: M`.

What changes in each of the less obvious paths:

- **`.ai/standards/rbac-and-security.md`** — the manager cell of *Approve or reject their own entry*
  becomes ✅ ADR-073. The role line for `manager` (line 19) drops "Not their own entry". Known
  weakness 4 extends to managers, recorded by `self_approved`. The MIR-14 paragraph (line 332) is
  marked as done by this ticket. Audit A10's rejection half is marked closed.
- **`tests/manager-role.test.ts`** — the ADR-035 item 3 suite (`:155-185`) is rewritten to the
  reversed rule (AC-21), and AC-22 is added.
- **`tests/bulk-rejection.test.ts`** — touched only if a case there asserts the manager own-entry
  refusal or the old sentence.

**`glossary_owed` is `[]`.** No glossary row is written.

## 8. Rejected alternatives

1. **Keep the whole of P3-5 in one ticket.** It would add the queue across teams, the
   "teams affected" chips and the `Entry` fields for the rejecter. That takes in
   `src/lib/data/index.ts`, `src/lib/domain/types.ts`, `src/routes/PendingEntries.tsx` and two more
   test files, which is about sixteen paths, so L. Adding fields to `Entry` is a shared-type change,
   so XL. Rejected: it is split by operation, as MIR-13 was.
2. **Optimistic "first decision wins" at the seam** (`approveEntry(id, from)` sending
   `status=eq.<from>`). Rejected. It changes two existing seam signatures (XL), and it guards only
   callers that pass `from` (ADR-073 *Options*).
3. **Refuse every re-decision of a decided entry.** Rejected. It removes ADM-05 AC-4 and AC-11 from
   the admin, and it contradicts "any rejection rejects" after an approval.
4. **Leave out `entry_select_decider` and let MIR-14-b add it.** Rejected. A second-team manager's
   PATCH is filtered by the select policies to zero rows, so AC-4, AC-12 to AC-14 and AC-20 would be
   unobservable in this slice. A ticket would reach DONE having shown nothing of its multi-team
   half.
5. **Test the manager with the global `may_decide`.** Rejected by AC-6 and ADR-073 *Options*.

## Delegated decisions

- ADR-073 — supersedes ADR-035 § Decision item 3 (a manager may decide their own entry). It narrows a
  manager's re-decision of another person's rejection. It reads "falls back to `org_admin`" as the
  team's admin until MIR-16, and splits MIR-14 by operation. Taken under ADR-067.

## Changelog

- 2026-11-03T09:20:00Z — created. Sections 1 and 2 were written from `features.md:303`,
  `ticket.yaml` and plan:30-35 before the source was read. After reading it, AC-20 was added: the
  select policy turned out to be required for AC-4 to be reachable at all (ADR-072 left
  `entry_select_team` on the primary team). Raised by tech-lead-design. Amended by tech-lead-design.
