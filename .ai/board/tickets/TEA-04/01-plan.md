---
ticket: TEA-04
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-01T10:40:34+07:00
inputs_read:
  - .ai/board/tickets/TEA-04/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/00-charter.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-008-agents-may-accept-adrs.md
  - .ai/registry/decisions/ADR-013-removed-members-count-until-removal.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-016-entry-status-guard-is-a-trigger.md
  - .ai/registry/decisions/ADR-017-the-qa-gate-is-temporarily-waived.md
  - .ai/registry/decisions/ADR-018-who-may-read-the-member-list.md
  - .ai/registry/decisions/ADR-019-idea-into-triage-spec-into-plan.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/board/ideas/2026-08-31-nobody-can-join-the-board.md
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# TEA-04 — Remove a member, and promote a member to admin

## 1. Problem and scope

### The feature row, transcribed

`TEA-04` from `.ai/registry/features.md`, without paraphrase:

> Remove a member, and promote a member to admin | TEA | PLANNED | INV-04, INV-07 | From
> 2026-08-31-nobody-can-join-the-board.md. One admin surface over two permission rows. Removal is a
> soft delete, and that column is the definition of INV-04's denominator: entries stay and stay
> visible, and the absence count for past dates changes, per the INV-04 note. Promotion is one-way in
> v1 — demoting an admin is denied by default rather than by decision, rbac-and-security.md known
> weakness 6.

**One correction to that row, recorded and not acted on.** The demotion denial is known weakness
**7**, not 6; weakness 6 is the `WITH CHECK` limitation, which this ticket also runs straight into
(§6). `features.md` is registry and human-only under RULE-01, so the row stands as written and this
plan cites the weakness by its content rather than by its number.

### What the admin gains

**Today the roster is readable and inert.** TEA-03 shipped `member_select_team`, and `public.member`
has never carried an insert, update or delete policy — TEA-01's migration says so in terms, and
ADR-018 §Decision 3 restates it. So an admin can see exactly who is on the team and can change none
of it. Two consequences are already live rather than theoretical: somebody who has left the company
stays in INV-04's denominator forever, which lowers every overload ratio the calendar tickets will
compute; and the first admin is the only admin the product can ever have, because
`supabase/seed.sql` applied by a human is the only path to the role.

This ticket adds the two writes the charter's Roles table has named as admin powers since the
2026-08-31 amendment — *remove members* and *promote a member to admin* — as one surface over the
member list TEA-03 already draws. It computes nothing: `removed_at` is the column INV-04's
denominator is defined against, and moving it is this ticket's whole effect on that number.

`size_estimate` from this section: **M**. Two write paths, each needing a policy, a guard and an
affordance, over a screen that exists.

### Out of scope

- **Demoting an admin to member.** `.ai/standards/rbac-and-security.md` marks it ❌ for both roles and
  *not decided — denied until it is*. Promotion is one-way in v1. AC-5 makes the refusal explicit
  rather than leaving it to the absence of a control; building demotion would be inventing a
  permission.
- **Restoring a removed member, or clearing `removed_at`.** No permission row exists for it. Same
  reasoning, and the same treatment: refused in AC-9's mechanism, not silently unimplemented.
- **Deleting the auth user, or any hard delete.** `member.id` references `auth.users(id) on delete
  restrict` and removal here is a soft delete by definition (`.ai/standards/data-model.md`). Deleting
  an auth user needs Supabase's admin surface and the service-role key, which under ADR-005 has
  nowhere in this system to live.
- **Anything that touches a removed member's entries.** The charter and the operator's decision of
  2026-08-31 are that entries stay. The `entry` table does not exist yet — CAL-01 creates it — so
  there is nothing here to leave alone except the rule itself.
- **Recomputing the absence count, or displaying it.** INV-04 has exactly one implementation and it
  does not exist yet (CAL-04, CAL-07). This ticket moves the column that count is defined against and
  performs no arithmetic; putting any here would create the second definition INV-04 forbids.
- **How a removed member is drawn on the member list.** TEA-03's plan deferred this here, and it is
  answered narrowly: they are **not drawn**, which is what TEA-03 already implements, and this ticket
  adds no control to reveal them. A roster view of past members is a feature nobody has asked for.
- **Telling a removed person anything.** ADR-009 established that this product sends no mail and no
  notification; removal is no different, and the admin tells them out of band as they did to admit
  them.
- **Editing `display_name`, `avatar` or `team_id`.** No permission row, and AC-7 refuses all three at
  the datastore rather than merely omitting the controls.
- **The sign-in half of TEA-01** — TEA-05. Every criterion below begins *given a signed-in…* and
  there is still no way to sign in.

## 2. Acceptance criteria

**AC-1 — an admin removes a member**
- Given a signed-in admin of team T, and an active member M of team T who is not the admin themselves
- When the admin removes M
- Then M's `removed_at` is set, M is no longer drawn on the member list, and M's `member` row still
  exists

**AC-2 — removal is a soft delete and the roster keeps the row**
- Given member M of team T has been removed
- When the team's roster is read through the data-access seam
- Then M is returned, carrying their `removed_at`

  *This is TEA-03's AC-4 restated as a thing this ticket must not break, and it is the reason INV-04
  is listed below. ADR-013 requires the counting function to be **given** the roster with `removed_at`
  per member, because it cannot derive membership-as-of-a-date from the entries.*

**AC-3 — `removed_at` is the server's clock and cannot be supplied by the caller**
- Given a signed-in admin
- When they remove a member by any route including one that does not go through this application's
  interface, supplying a `removed_at` of their own choosing
- Then the value stored is the datastore's own clock at the moment of the write, and the supplied
  value is discarded

  *ADR-013's revert condition is exactly this incident: "if a member is removed with a `removed_at`
  that is wrong or backdated, every past count moves with it, silently and everywhere". A caller-
  supplied timestamp on this column is not a data-entry mistake, it is a silent rewrite of every past
  absence count.*

**AC-4 — an admin promotes a member to admin**
- Given a signed-in admin of team T, and an active member M of team T whose role is `member`
- When the admin promotes M
- Then M's role is `admin`, and M is thereafter answered as an admin by every permission check

**AC-5 — no role may be demoted**
- Given a signed-in admin, and a member row of their own team whose role is `admin`
- When they attempt to set that row's role to `member`, by any route including one that does not go
  through this application's interface
- Then the write is refused and the role is unchanged

  *`Demote an admin to member` is ❌ for both roles in `.ai/standards/rbac-and-security.md`, marked
  not decided. The refusal is asserted rather than left to the absence of a control, because the
  absence of a control refuses nobody who can issue a `PATCH`.*

**AC-6 — a member may neither remove nor promote**
- Given a signed-in member whose role is `member`
- When they attempt to set `removed_at` or `role` on any member row including their own, by any route
- Then the write is refused

**AC-7 — no role may write any other column of `member`**
- Given a signed-in member or a signed-in admin
- When they attempt to write `id`, `team_id`, `display_name`, `avatar` or `created_at` on any member
  row, by any route
- Then the write is refused

  *`team_id` is the one that matters and it is INV-07: a writable `team_id` moves a member between
  teams, and every entry they own is counted against the new one. The other four are refused for the
  same reason TEA-03 refused them — no permission row exists, so the write is not permitted.*

**AC-8 — no role may insert or delete a `member` row**
- Given a signed-in member or a signed-in admin
- When they attempt to insert or delete a row of `member`, by any route
- Then the write is refused

  *TEA-01 established the admission trigger as the only writer and ADR-018 §Decision 3 forbids an
  insert policy "now or by any later ticket". This is the later ticket, and it is the one that opens
  this table's `update` — the specific risk of opening one verb is that another is dragged along.*

**AC-9 — an admin may not remove themselves**
- Given a signed-in admin
- When they attempt to set `removed_at` on their own member row, by any route
- Then the write is refused and the row is unchanged

  *A denial by default rather than by decision, taken under the principle
  `.ai/standards/rbac-and-security.md` states for exactly this case: "a denial that turns out to be
  wrong surfaces as a blocked story, which is cheap; a permission that turns out to be wrong surfaces
  as data somebody should not have touched." The concrete loss it prevents is a one-way door — the
  sole admin removes themselves, `is_admin` then answers false for everybody, no promotion is
  possible, and the roster is recoverable only by a human editing the database. It is narrower than
  the `Remove a member` permission row and is recorded as such in §6 and in Open questions.*

**AC-10 — a removed member cannot be promoted**
- Given a signed-in admin, and a member row of team T whose `removed_at` is set
- When they attempt to promote that row
- Then the write is refused

  *`public.is_admin` filters `removed_at is null`, so a promoted removed member would hold a role
  that answers false everywhere — a row that says `admin` and behaves as nobody. Refusing it keeps the
  column and the behaviour agreeing.*

**AC-11 — neither action reaches another team**
- Given a signed-in admin of team T, and a member row belonging to a different team U
- When they attempt to remove or promote it, by any route
- Then the write is refused and no row of team U changes

  *INV-07. Exactly one team exists in v1 (glossary, *Team*), so this is unobservable through the
  interface and is asserted against seeded data carrying a second team — the same shape ADR-018's
  revert condition requires of TEA-03's AC-2, and the seed rows already exist for it.*

**AC-12 — a caller with no session writes nothing**
- Given a caller with no session, holding only the anon key
- When they attempt to update `member`
- Then the write is refused

**AC-13 — an admin sees exactly the controls the permissions allow**
- Given a signed-in admin viewing the member list
- When the roster is drawn
- Then a row for an active `member` of their team, other than themselves, carries both a remove
  control and a promote control; a row whose role is `admin` carries a remove control and **no**
  promote control; and their own row carries neither

**AC-14 — a member sees no control at all**
- Given a signed-in member whose role is `member`, viewing the member list
- When the roster is drawn
- Then no row carries a remove control or a promote control

**AC-15 — removing names the person and says what survives**
- Given an admin has chosen to remove member M
- When the confirmation is shown
- Then it names M's `display_name`, and it says that M's entries stay on the calendar
- And the removal happens only after the confirmation is accepted

  *`.ai/standards/ui-design-system.md`, *Destructive actions*: the confirmation names what is about to
  be lost, and "Are you sure?" names nothing. What is lost here is a person's presence on the roster
  and their contribution to the team size every overload warning divides by; what is **not** lost is
  their entries, and an admin who assumes otherwise will not remove anybody.*

### Invariants touched

- **INV-07 — one member, one team.** `member.team_id` becomes writable in principle the moment this
  table gains an `update` verb, and AC-7 is the criterion that stops it. The team boundary on both
  actions is AC-11.
- **INV-04 — one definition of the absence count.** Reached indirectly, and listed for that reason.
  This ticket computes no count. It writes `removed_at`, which is both the definition of INV-04's
  denominator (`.ai/standards/data-model.md`: *"`removed_at` is what 'current member count' means"*)
  and, through ADR-013, the per-date membership condition in its numerator. Three ways this ticket
  could break a number it never computes: a caller-supplied or backdated timestamp (AC-3), a removal
  that deletes rather than soft-deletes (AC-1, AC-2), and a `team_id` write moving a member's entries
  to another team's count (AC-7).

Neither is discharged by this ticket, and that is not the test — both are listed because the
behaviour had to be chosen.

### Open questions

None blocking. Three things this plan decided rather than deferred, each recorded so the decision is
visible rather than inferred:

- **An admin may not remove themselves (AC-9).** Narrower than the `Remove a member` permission row,
  which says only ✅ for admin. Taken as a denial by default under the principle that file states for
  undecided rows. **Revert condition:** the first admin who legitimately needs to leave the team and
  has to ask a human to edit the database. At that point the right answer is probably *the last
  admin may not be removed* rather than *no admin may remove themselves*, which is a headcount rule
  and costs a subquery.
- **`removed_at` is set to the server clock and never to a caller-supplied value (AC-3).** The
  alternative — letting an admin backdate a departure to the person's actual last day — is a real
  requirement in an HR system and this is not one (charter, refusals 1 and 3). ADR-013's revert
  condition names backdating as the incident that would force snapshotting the count instead of
  deriving it, so permitting it here would spend an invariant to save a date picker.
- **Promotion has no confirmation; removal does.** Promotion is reversible in principle and
  irreversible in this version only because demotion is undecided, and it destroys nothing. Removal
  changes a number every calendar view divides by. `.ai/standards/ui-design-system.md` asks for a
  confirmation on destructive actions and promotion is not one.

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. Check R6 reads this section.

| Action | `member` | `admin` | Where the check runs |
|---|---|---|---|
| Remove a member | ❌ | ✅ | policy `member_update_admin`, plus the column grant and the trigger (§6) |
| Promote a member to admin | ❌ | ✅ | the same three |
| Demote an admin to member | ❌ | ❌ | trigger `member_enforce_role_and_removal`, `42501` |

The first two rows were decided by the operator on 2026-08-31 and are in the charter's Roles table.
The third is marked *not decided — denied until it is*, and this ticket denies it with a mechanism
rather than with an omission.

**`member` and `admin` are the same PostgreSQL role, `authenticated`.** The distinction lives in the
policy predicate, never in the grant — which is what makes §6's split between *what the grant
withholds from everybody* and *what the policy withholds from a member* the load-bearing part of this
design.

### The denials, and what holds each

| Denial | AC | Held by |
|---|---|---|
| A member removing or promoting anybody, including themselves | AC-6 | `public.is_admin((select auth.uid()))` in `member_update_admin`'s `using`. A member's `UPDATE` matches no row. |
| Writing `id`, `team_id`, `display_name`, `avatar` or `created_at` | AC-7 | **The column-level grant.** `update (role, removed_at)` and nothing else, so a statement naming any other column is refused with `42501 permission denied for column` before any policy runs — for both roles, because neither may write them. |
| Demoting an admin | AC-5 | The trigger. `WITH CHECK` cannot see the old row, so no policy can express "this column did not change"; this is known weakness 6 exactly. |
| Promoting a removed member | AC-10 | The trigger. |
| Undoing or re-dating a removal | out of scope, §1 | The trigger. |
| An admin removing themselves | AC-9 | The trigger, comparing `old.id` to `auth.uid()`. |
| A caller-supplied `removed_at` | AC-3 | The trigger, which overwrites it with `now()`. Not a refusal — the write succeeds and the value is discarded, the same shape ADR-016 clause (b) uses for `approved_by`. |
| Reaching another team | AC-11 | `team_id = public.member_team_id((select auth.uid()))` in `using`. INV-07. |
| Inserting or deleting a `member` row | AC-8 | **The absence of a policy and the absence of a grant.** TEA-01 granted `select` only; this migration adds `update` on two columns and nothing else. ADR-018 §Decision 3 forbids an insert policy permanently. |
| A caller with no session | AC-12 | `to authenticated` on the policy, and TEA-01's `revoke all … from anon`. |

### Affordances, which enforce nothing (ADR-005)

Every control described in §4.3 is an affordance and carries a comment saying so. The remove and
promote controls are hidden exactly where the policy or the trigger would refuse anyway — on a
member's own view (AC-14), on the caller's own row, and on a row that is already an admin (AC-13).
Hiding them saves a round trip and says why; it refuses nobody holding a token, which is the whole
of ADR-005.

The confirmation dialog (AC-15) is **not** an affordance over a permission. It is the destructive-
action rule in `.ai/standards/ui-design-system.md`, and what it protects against is a mis-click by
somebody who is fully entitled to the action.

## 4. Contract

### 4.1 Domain types — none added, none changed

`Member`, `MemberRole`, `Result` and `Failure` already carry everything. **No new `FailureCode`**, and
that is a decision rather than an oversight: every refusal reachable from this interface is the policy
or the trigger saying no, and they are one sentence to the admin — `not_permitted`, which exists.
The four trigger refusals that carry distinct reasons (demotion, promoting a removed member, undoing
a removal, self-removal) are all unreachable through the controls §4.3 draws, so a code per reason
would be a branch no screen can take. `src/lib/domain/types.ts` is therefore absent from §7.

### 4.2 The seam — two functions added

Added to `DataSeam` in `src/lib/data/index.ts` and to both implementations with the same name and
arity:

```ts
/**
 * TEA-04 AC-1, AC-3, AC-6, AC-9, AC-11, AC-12. Soft-removes a member of the caller's own team.
 *
 * Takes no timestamp. `removed_at` is written by the datastore's own clock and a caller-supplied
 * value is discarded by the trigger (AC-3) — ADR-013's revert condition is a backdated removal
 * moving every past absence count silently, so there is no parameter here that could carry one.
 *
 * Returns the updated row. The `.select()` is not a convenience: under row-level security a
 * refused UPDATE is FILTERED, not errored — it matches nothing and PostgREST answers 200 with an
 * empty body (ADR-016 section 4, behaviour 2). Zero rows returned is a refusal and is mapped to
 * `not_permitted`; treating `!error` as success would report a refusal as done.
 */
removeMember(memberId: string): Promise<Result<Member>>;

/**
 * TEA-04 AC-4, AC-5, AC-6, AC-10, AC-11, AC-12. Promotes a member of the caller's own team to
 * admin. One-way: there is no `demoteMember`, and adding one would be inventing a permission
 * (`Demote an admin to member` is not decided).
 *
 * Returns the updated row, and treats zero rows as a refusal, for the same reason as above.
 */
promoteMember(memberId: string): Promise<Result<Member>>;
```

**`memberId` is an address, not a permission surface.** It names an existing row that the policy then
filters by team and by the caller's role — the shape `removeAllowedEmail(email)` already uses. It is
unlike the `teamId` that was deliberately kept off `addAllowedEmail`, which would have *supplied* a
value that landed in the row.

**No existing signature changes.** `ready`, `signUp`, `getOwnMember`, `getCurrentMember`,
`listAllowedEmails`, `addAllowedEmail`, `removeAllowedEmail` and `listMembers` are untouched, so no
existing caller changes. That is §7's sizing test.

### 4.3 The screen — `src/routes/MemberList.tsx`, extended

The route exists and `src/App.tsx` is not touched. The four `View` phases stay as TEA-03 shipped
them; `ready` already carries `me`, which is what the affordances need.

Two controls are added to each drawn row, and the conditions are AC-13 exactly:

```ts
const canRemove = (m: Member): boolean => me.role === "admin" && m.id !== me.id;
const canPromote = (m: Member): boolean =>
  me.role === "admin" && m.id !== me.id && m.role === "member";
```

`m.removedAt === null` is not in either predicate because the screen only ever draws active members —
TEA-03's `current` filter runs first, and re-testing it here would imply the list might contain one.

Three pieces of local state, following `AllowList.tsx`:

```ts
const [pending, setPending] = useState<Member | null>(null);   // the row awaiting confirmation
const [busy, setBusy] = useState(false);
const [actionError, setActionError] = useState<Failure | null>(null);
```

- **Promote** calls `seam.promoteMember(m.id)` directly — no confirmation (§2, Open questions) — then
  `load()` on success, or renders `member-list-action-error` on a returned failure.
- **Remove** opens the confirmation first (AC-15). On accept it calls `seam.removeMember(m.id)`, then
  `load()` on success. **On a refusal the dialog stays open** and the sentence is rendered inside it,
  the same shape `AllowList.tsx` uses: the row it is about is named directly above.
- Both `catch` a throw and render a generic failure, because a transport error is not a refusal.

The confirmation names the person and what survives:

> Gỡ **{pending.displayName}** khỏi nhóm? Các đăng ký nghỉ/WFH của người này vẫn được giữ lại và vẫn
> hiển thị trên lịch.

## 5. Seam impact

**Two functions added: `removeMember` and `promoteMember`.** Both appear in `DataSeam` and in both
implementations with the same name and arity, or `tests/seam-parity.test.ts` fails — which it must do
**unedited**, which is why it is absent from §7.

No existing seam function changes. `listMembers` already returns removed members carrying `removedAt`
and needs no edit for AC-2; that criterion is a thing this ticket must not break, not a thing it
builds.

### What the mock must reproduce — the policy and the trigger, never the screen

The same rule TEA-02's and TEA-03's mocks follow, and it matters more here because six of the fifteen
criteria are refusals. `mock.ts` seeds `currentMemberId` and `__setCurrentMember` already exist, so a
test can be any seeded member.

| Attempt | Mock answer | Reproducing |
|---|---|---|
| caller is not an active admin of the row's team | `not_permitted` | `member_update_admin.using` |
| the row belongs to another team | `not_permitted` | the same predicate — INV-07 |
| promote a row whose role is already `admin` | `not_permitted` | the trigger's demotion clause is not reached; the policy matches, the trigger refuses nothing, and the write is a no-op — so the mock refuses it explicitly rather than reporting success for nothing. See the note below. |
| promote a row whose `removedAt` is set | `not_permitted` | the trigger, AC-10 |
| remove the caller's own row | `not_permitted` | the trigger, AC-9 |
| remove a row whose `removedAt` is already set | `not_permitted` | the trigger's one-way clause |
| remove a permitted row | `ok`, `removedAt` set to the mock's own `new Date().toISOString()` | the trigger writing `now()`, AC-3 |

**The one place the mock is deliberately stricter than the datastore**, and it is called out because a
reviewer will otherwise read it as drift: promoting somebody who is already an admin updates zero
columns in PostgreSQL and returns the row unchanged, so the real seam sees one row back and reports
success. The mock refuses it. Neither behaviour is reachable from the interface — AC-13 draws no
promote control on an admin row — and the honest fix is that `promoteMember` has no meaning for a row
that is already admin. **If this divergence is judged wrong at review, the correction is to make the
mock report success, not to add a policy clause**; the datastore is the authority on what the policy
does and there is nothing to enforce here.

## 6. Schema delta

**Not `none`.** ADR-014, and there is no carve-out: this migration adds a grant, a policy, a function
and a trigger.

**`requires_adr: true`, and no ADR exists yet.** Definition of Ready item 4 will fail at
`/next-ticket` until one is written and linked. This is the same position TEA-03 was in at the end of
its SPEC, and it is resolved the same way: the steward writes it, the orchestrator links it. It is
**not** a BLOCKED gate — the decision sits inside an already-accepted envelope, so it does not go to
the operator under RULE-09:

- *Remove a member* and *Promote a member to admin* are ✅ for admin in
  `.ai/standards/rbac-and-security.md`, decided by the operator on 2026-08-31 and in the charter's
  Roles table.
- *Demote an admin to member* is ❌ for both, marked not decided. Denying it changes nothing.
- The two things the ADR adds are a **narrowing** (AC-9, an admin may not remove themselves) and an
  **application** of ADR-013's revert condition (AC-3, `removed_at` is the server's clock). Neither
  reverses an accepted decision, which is ADR-008's test.

### What the ADR must record

The migration is `supabase/migrations/<timestamp>_tea04_member_writes.sql`, generated by
`supabase migration new`. The Developer adds one file there and edits none of the three that exist.
Applying it is human — RULE-09.

**1. The column-level grant, and why it works here when it does not work for `entry`.**

```sql
grant update (role, removed_at) on public.member to authenticated;
```

`.ai/standards/rbac-and-security.md` known weakness 6 records that column grants do **not** close the
equivalent hole on `entry`, and the reason it gives is exactly the reason they close it here: they
worked on `team` "because *nobody* may rename a team, so the privilege could simply be withheld".
Nobody may write `id`, `team_id`, `display_name`, `avatar` or `created_at` on `member` either — not a
member and not an admin — so the privilege is withheld from `authenticated` outright and AC-7 is held
by the grant rather than by a predicate. `entry` is different because member and admin need
*different* access to the same column, and one grant cannot say that.

**2. The policy.** Nothing about the caller's role or team is expressible in the grant, so it goes
here:

```sql
create policy member_update_admin on public.member
  for update to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id = public.member_team_id((select auth.uid()))
  )
  with check (
    team_id = public.member_team_id((select auth.uid()))
  );
```

`public.is_admin(uuid)` and `public.member_team_id(uuid)` both exist from TEA-01 and are
`security definer`, so a policy on `member` may consult `member` without recursing through `member`'s
own policies. The `with check` is redundant while `team_id` is ungranted and is kept as the second
lock: if a later ticket ever grants that column, the policy already refuses a move across teams.

**3. The trigger, which is what `WITH CHECK` cannot be.** Known weakness 6 states the limitation and
names this exact remedy — *"a `BEFORE UPDATE` trigger comparing `OLD` and `NEW`"* — and ADR-016
already established the shape, the naming and the SQLSTATE convention on `entry`. This follows it:

```sql
create function public.member_enforce_role_and_removal() returns trigger
  language plpgsql security invoker set search_path = '' as $$
declare
  v_uid uuid := (select auth.uid());
begin
  -- AC-5. Demotion is denied for everybody, in every context. `Demote an admin to member` is ❌/❌.
  if old.role = 'admin'::public.member_role and new.role is distinct from old.role then
    raise exception 'an admin may not be demoted' using errcode = '42501';
  end if;

  -- AC-10. A promoted removed member would hold a role that `is_admin` answers false for.
  if new.role is distinct from old.role and old.removed_at is not null then
    raise exception 'a removed member may not be promoted' using errcode = '42501';
  end if;

  -- Removal is one-way. Restoring a member is not a decided permission (section 1, Out of scope),
  -- and re-dating one is ADR-013's revert condition arriving as an ordinary UPDATE.
  if old.removed_at is not null and new.removed_at is distinct from old.removed_at then
    raise exception 'a removal may not be undone or re-dated' using errcode = '42501';
  end if;

  -- AC-9. `v_uid is not null` so a migration, the SQL editor or a service-role call is not blocked
  -- — nothing blocks a service-role key anyway (known weakness 1). ADR-016 clause (a) does the same.
  if old.removed_at is null and new.removed_at is not null
     and v_uid is not null and old.id = v_uid then
    raise exception 'an admin may not remove themselves' using errcode = '42501';
  end if;

  -- AC-3. Provenance, never trusted from the wire — ADR-016 clause (b), same reasoning. This is the
  -- column INV-04's denominator is defined against and ADR-013's per-date condition reads.
  if old.removed_at is null and new.removed_at is not null then
    new.removed_at := now();
  end if;

  return new;
end;
$$;

create trigger member_enforce_role_and_removal
  before update on public.member
  for each row execute function public.member_enforce_role_and_removal();
```

`security invoker`, following ADR-016: the function needs no privilege of its own — it reads
`auth.uid()` and calls `public.is_admin`, which is already `security definer` and already granted.
Nothing is elevated, so nothing has to be reasoned about.

**4. What the migration must not contain.** No `alter table`, no column, no `drop policy`, no
`insert` or `delete` policy — ADR-018 §Decision 3, permanently — and no blanket
`grant update on public.member`, which is the whole of point 1.

### 6.1 The seed — one row

`supabase/seed.sql` gains a **second admin** on `FIXTURE_TEAM`, with the matching
`FIXTURE_SECOND_ADMIN` in `src/lib/fixtures.ts`. AC-13 needs an admin row that is **not** the caller
in order to assert *remove control, no promote control*, and today `FIXTURE_ADMIN` is the only admin
fixture on that team — so the caller and the only admin row are the same row and the criterion is
unobservable. It also makes AC-9 concrete rather than hypothetical: with two admins, refusing
self-removal costs nobody the ability to leave.

An `auth.users` row comes first, with `confirmation_token`, `recovery_token`,
`email_change_token_new` and `email_change` set to `''` — MD-014, as every seeded account in that file
already does. The literals match the fixture exactly.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/*.sql"
  - "supabase/seed.sql"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/fixtures.ts"
  - "src/routes/MemberList.tsx"
  - "tests/permission-model.test.ts"
  - "tests/e2e/tea-04-member-admin.spec.ts"
```

Nine globs, nine files. `supabase/migrations/*.sql` is one new file and is a glob only because
`supabase migration new` generates the timestamp; TEA-01's, TEA-02's and TEA-03's are not to be
edited.

**No inline comments on the items.** `readYamlList` in `scripts/check-allowed-paths.mjs` and in
`.claude/hooks/guard-allowed-paths.mjs` strips only a leading and a trailing quote, so a trailing
`# …` is swallowed into the pattern and the glob matches nothing. The per-file reasoning belongs
here, where it stays true.

**Deliberately absent:**

- `tests/seam-parity.test.ts` — two seam functions are added and it must keep passing unedited; that
  is the whole of its value.
- `src/App.tsx` — `/members` already routes to `MemberList`, added by TEA-03.
- `src/lib/domain/types.ts` — no type and no `FailureCode` is added (§4.1).

### Size

**M.** Nine files, and `size_estimate` in §1 was also **M** — the two agree, which is worth one line
precisely because the same agent wrote both: the estimate was made from *two write paths over an
existing screen* and the count came out where that reading predicted. Nothing was reshaped to make
them meet.

**Not L**, so nothing splits. Splitting *remove* from *promote* was considered and would produce two
tickets sharing one migration, one policy and one trigger — the operating model's *split by operation
first* separates a read path from a write path, and these are two writes through the same guard.

**Not XL.** The XL row's stated test is *whether existing callers must change*. This migration adds a
grant, a policy and a trigger to a table it does not alter; it adds two seam functions without
touching the eight that exist; it changes no shared type module at all. No existing caller changes.

### Prerequisites this ticket does not own

**The sign-in half of TEA-01 still does not exist — TEA-05 owns it.** In a real build
`getCurrentMember()` returns null on every call, so `/members` renders `member-list-not-on-a-team`
for everybody and no control is ever drawn. The end-to-end suite therefore drives the **mock** seam,
as TEA-01's, TEA-02's and TEA-03's do, and the policy and trigger assertions live in
`tests/permission-model.test.ts` against a real database with a token per role. Every criterion is
verifiable and the feature is not usable — the same true and uncomfortable pair TEA-02 recorded, and
it is TEA-05's to close.

## 8. Testability contract

The attribute is `data-testid`, named once in `.ai/standards/testing-standards.md`. RULE-05 makes this
table the only channel through which these controls reach QA — a control missing here does not exist
as far as QA is concerned. Dormant while ADR-017 waives QA, and written anyway; R7 still reads it.

The five selectors TEA-03 shipped keep their names and their meaning. New ones are marked.

| selector | Element | Used by |
|---|---|---|
| `app-root` | The routed shell. Already exists. | all |
| `seam-banner` | The mock-seam banner. Already exists; asserts which implementation drove the test. | all |
| `member-list-loading` | Already exists. Present so QA can assert it disappears. | AC-13, AC-14 |
| `member-list-not-on-a-team` | Already exists. | — |
| `member-list-unavailable` | Already exists. | — |
| `member-list-table` | Already exists. | AC-1, AC-13, AC-14 |
| `member-list-row` | Already exists. Carries `data-member-id` and `data-role`. **AC-1 is asserted by the row's disappearance** after a removal, and AC-4 by its `data-role` flipping to `admin`. | AC-1, AC-4, AC-13, AC-14 |
| `member-list-row-avatar` | Already exists. | — |
| `member-list-row-name` | Already exists. | AC-15 |
| `member-list-row-role` | Already exists. | AC-4 |
| `member-list-empty` | Already exists. | — |
| **`member-list-row-remove`** | *New.* The remove control within a row. Rendered only when the caller is an admin and the row is not their own. | AC-13, AC-14, AC-15 |
| **`member-list-row-promote`** | *New.* The promote control within a row. Rendered only when the caller is an admin, the row is not their own, and the row's role is `member`. | AC-4, AC-13, AC-14 |
| **`member-list-remove-confirm`** | *New.* The confirmation dialog. Names the member's `display_name` and says their entries stay. | AC-15 |
| **`member-list-remove-confirm-accept`** | *New.* Its accept control. The only thing that performs a removal. | AC-1, AC-15 |
| **`member-list-remove-confirm-cancel`** | *New.* Its cancel control. Closes the dialog and removes nobody. | AC-15 |
| **`member-list-action-error`** | *New.* The typed failure from either write, rendered as a sentence. Inside the dialog for a removal, above the table for a promotion. | AC-13 |

**AC-13's three cases are read off `member-list-row`'s attributes**, not off separate selectors: for
each row, whether `member-list-row-remove` and `member-list-row-promote` are present is compared
against that row's `data-member-id` and `data-role`. A selector per case would be the defect rather
than the test.

### 8.1 The criteria with no interface

**AC-2, AC-3, AC-5, AC-6, AC-7, AC-8, AC-9, AC-10, AC-11 and AC-12** have no control and no state on
this screen. They are the trigger's refusals, the grant's refusals and the anonymous read — all
properties of the datastore, and all asserted in `tests/permission-model.test.ts` with a token per
role. Ten of fifteen criteria live there, which is the honest shape of a ticket whose subject is a
permission: **an interface test of this feature proves almost nothing about it.**

`tests/permission-model.test.ts` still does not exist. TEA-02 and TEA-03 both specified it and
neither produced it, because ADR-017 waives entry into the QA stage and nobody is dispatched to
write it. It must skip when `SUPABASE_DB_URL` is absent — `vitest` owns `tests/**/*.test.ts`, so an
unskippable database test turns the unit command red for everybody without a `.env`.

### 8.2 Which implementation a test drives

`src/lib/data/index.ts` chooses and `seam-banner` reports the choice. The end-to-end suite runs
against the mock. Such a run proves the screen and the mock's imitation of the policy and the
trigger; **it proves nothing about the policy or the trigger themselves**, and nothing in that suite
may be read as covering them.

## 9. Rejected alternatives

**A blanket `grant update on public.member to authenticated`, with the policy as the only control.**
This is what TEA-02 did for `allowed_email` (`grant insert, delete`) and it is the obvious next step
from that precedent — one grant, one policy, no trigger, and the migration is eight lines. Rejected
because `WITH CHECK` sees only the new row and cannot say *this column did not change*
(`.ai/standards/rbac-and-security.md`, known weakness 6). Under a blanket grant an admin's
`PATCH {"team_id": "<other team>"}` passes both `using` and any `with check` that names the caller's
team — the row was theirs and stays theirs — and INV-07 is gone with no error anywhere. The same
statement could backdate `removed_at` and move every past absence count, which is ADR-013's revert
condition arriving as an ordinary write. The narrower grant costs one line and closes both.

**A `security definer` function — `remove_member(uuid)`, `promote_member(uuid)` — instead of a policy
and a trigger.** Genuinely attractive: the rules read as procedural code, all seven refusals live in
one readable place, and the seam calls `rpc()` instead of building a PATCH. Rejected because it moves
authorization out of row-level security and into a function body, which ADR-005 places outside the
model, and because ADR-016 §4 already drew this exact line — a bulk operation was allowed to become a
function only on condition that it stayed `security invoker`, precisely so that the policy still ran.
A `security definer` write path is the whole authorization model bypassed by design rather than by
accident, which is the objection the source idea raised against the admission trigger and which
ADR-009 had to answer explicitly.

**Hard-deleting the `member` row.** Rejected on three independent grounds, any one of which is
sufficient: `.ai/standards/data-model.md` defines `removed_at` as a soft delete and calls it the
meaning of "current member count"; `member.id references auth.users(id) on delete restrict`, so the
delete is refused by the foreign key anyway; and ADR-013 requires a removed member's entries to keep
counting for dates before their removal, which is uncomputable once the row and its `removed_at` are
gone. It is listed because it is what "remove a member" reads like to anybody who has not read the
data model.

**Refusing demotion by simply not building a control for it.** Rejected on ADR-005: a control that
does not exist refuses nobody holding a token, and `role` is granted `update` for the promotion path,
so the column is writable in exactly the direction that must be refused. The trigger is what makes
AC-5 a statement about the system rather than about this screen.

**Letting the admin choose the removal date.** The first thing an admin will ask for — somebody's last
day is rarely the day the admin gets round to the admin screen. Rejected because `removed_at` is not
an administrative note: ADR-013 makes it the per-date membership condition in INV-04's numerator, so
a date chosen by hand silently rewrites past absence counts, and ADR-013's revert condition names
that incident as the one that would force snapshotting the count instead of deriving it. It is also
HR-shaped, and the charter refuses that twice (refusals 1 and 3).

## Changelog

- `2026-09-01T10:40:34+07:00` — sections 1 and 2 written from `features.md`, the charter,
  `rbac-and-security.md`, ADR-013 and the source idea, before the source tree was read. Sections 3
  through 9 written after. **No acceptance criterion was amended after reading the code** — the ADR-019
  hazard this order exists against did not arise, and it is recorded as not having arisen rather than
  left silent. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
