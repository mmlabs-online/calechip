---
ticket: MIR-03
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-20T15:02:00+07:00
inputs_read:
  - .ai/board/tickets/MIR-03/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-044-an-admin-sets-a-rank-on-any-team.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-063-mir-is-an-eighth-feature-group.md
  - .ai/registry/decisions/ADR-064-a-person-cannot-change-their-own-role-status-or-team.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/01-operating-model.md
  - supabase/migrations/20260924100000_solo_cross_team_role.sql
  - supabase/migrations/20261020120000_mir02_member_self_writes.sql
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/routes/MemberList.tsx
  - tests/cross-team-role.test.ts
consulted:
  - with: operator
    asked: "Q1: who does an admin 'actually administer' — own team (supersedes ADR-044 Decision 1) or the caller's org (empty until MIR-12)? Q2: the separate gate on promotion to admin — own-team definer function, no in-product path, or a two-admin rule?"
    answer: "Q1. A / Q2. A"
    resulted_in_amendment: true
chat_before_verdict: "one round: the BLOCKED version of this file, 2026-10-20T14:50:40+07:00, answered by the operator"
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-03 — PLAN

## 1. Problem and scope

**Feature implemented**, transcribed from `.ai/registry/features.md:292`:

> | MIR-03 | Role changes are bounded to members the admin administers, promotion to admin is a
> separately gated action, and every role change records its actor | MIR | PLANNED | |

Plan item P0-3 (`.ai/board/plans/calechip-multi-tenancy-plan.md:83-86`), verbatim:

> - Add a team/org condition — an admin may only change roles for members they actually administer
> - Refuse promotion to `admin` through this path entirely; make it a deliberate, separately-gated action
> - Record the actor of every role change

**Decided by the operator on 2026-10-20 and recorded in
[ADR-065](../../../registry/decisions/ADR-065-role-changes-are-own-team-promotion-is-its-own-action-and-every-change-is-recorded.md):**
"members they actually administer" means the admin's **own team** (Q1 A, superseding ADR-044
Decision 1). The separate gate is **its own admin-only, own-team action** with a confirmation (Q2 A).

**Who loses what, and why it matters.** Today any admin can make anyone on any team a manager or an
admin, and nothing records who did it. `is_admin` is global, and an admin is the one role nobody can
take away, so a single mis-aimed or malicious promotion on another team cannot be undone and cannot
be traced. After this ticket an admin changes ranks only on their own team. Making someone an admin
is a separate, confirmed step, and every rank change leaves a row saying who made it. This is phase
0's exit criterion *"Role changes are bounded and logged"* (plan:96).

**Out of scope**
- `move_member`, `admit_member`, rejection by any admin, `list_all_members`, `list_members_for_team`
  (the other cross-team findings ADR-064 names) — **MIR-13**. ADR-065 *Consequences* records that
  move-then-rank stays possible until then, as two recorded actions.
- Demoting an admin — still *not decided, denied until it is* (`rbac-and-security.md:60`).
- Widening promotion to managers on the screen. Today *Promote* is drawn only on a `member` row. The
  datastore accepts a manager as a target (rbac row *"Promote a member or a manager to admin"*), and
  the screen stays as it is.
- The role split into `system_admin` / `org_admin` / per-team manager — **MIR-16, MIR-17**. Org-wide
  rank changes for `org_admin` — **MIR-13**.
- Reading `member_role_change` anywhere in the product, and a general audit log — **MIR-20**
  (plan:294).
- `removeMember` — unchanged, still own-team on `member_update_admin` (ADR-044 Decision 3).
- Updating `.ai/standards/rbac-and-security.md` and `data-model.md` — human-only. Owed, as listed in
  ADR-065 *Affected documents*.
- `supabase/db.sql` — MIR-08.

`size_estimate: M` — one migration, the seam, one screen, tests, manual verification.

## 2. Acceptance criteria

"Own team" means the target's `member.team_id` equals the caller's. The screen and the API must
agree. "Refused" means the call returns an error, the target's `role` is unchanged afterwards, and
no `member_role_change` row is added.

**AC-1 — an admin changes a rank on their own team**
- Given an admin A of team T and an approved, not removed member M of team T whose role is `member`
- When A makes M a manager, and then makes M a member again
- Then both calls succeed, M's role is `manager` after the first and `member` after the second, and
  `member_role_change` holds two new rows for M: `member → manager` and `manager → member`, each
  with `changed_by = A` and a `changed_at` set by the database.

**AC-2 — another team's member is refused**
- Given an admin A of team T and an approved member M of a different team U
- When A sets M's rank to `manager` (or to `member`, if M is a manager)
- Then the call is refused, and the screen shows *"That person's role could not be changed."*

**AC-3 — the rank write refuses `admin`**
- Given an admin A of team T and an approved member M of team T
- When A calls the rank write (`setMemberRole`, `public.set_member_role`) with role `admin`
- Then the call is refused and M is still `member`.

**AC-4 — promotion to admin on the own team, confirmed**
- Given an admin A of team T, on the Members screen, and an approved member M of team T whose role
  is `member`
- When A presses *Promote* on M's row
- Then a confirmation dialog opens that names M and says this cannot be undone, and nothing has
  changed yet.
- When A confirms
- Then M's role is `admin`, the dialog closes, the roster reloads showing M as admin, and
  `member_role_change` holds one new row `member → admin` for M with `changed_by = A`.

**AC-5 — cancelling the promotion changes nothing**
- Given the dialog from AC-4 is open
- When A presses *Cancel*
- Then the dialog closes, M is still `member`, and no `member_role_change` row is added.

**AC-6 — promotion on another team is refused**
- Given an admin A of team T and an approved member M of team U
- When A calls the promotion (`promoteMember`, `public.promote_member_to_admin`) for M
- Then it is refused with *"That person could not be promoted."*

**AC-7 — only an admin changes a rank or promotes**
- Given a caller who is a `member` or a `manager` (on any team), or no signed-in caller at all
- When they call the rank write or the promotion for any member
- Then both are refused.

**AC-8 — the row conditions still hold on both paths**
- Given an admin A of team T
- When A calls the rank write or the promotion for (a) a member of T who has been removed, (b) a
  member of T who is already `admin`, or (c) an id that names nobody
- Then each is refused with the same answer as AC-2 (rank write) or AC-6 (promotion), so the refusal
  does not say which condition failed. A pending sign-up has no team, so it is never on A's team and
  is refused by AC-2's condition.

**AC-9 — the record covers every path, with an honest actor**
- Given the migration is applied
- When `role` on a `member` row changes in a statement that comes from outside any authenticated
  request (the SQL editor)
- Then one `member_role_change` row is written for that change, with `changed_by` null.
- And when an update statement touches `role` without changing its value
- Then no row is written.

**AC-10 — the record cannot be read or forged through the API**
- Given a signed-in member, manager or admin, holding an access token and the anon key
- When they `select`, `insert`, `update` or `delete` on `/rest/v1/member_role_change`
- Then every request is refused or returns no rows, and the table's contents are unchanged.

**AC-11 — the screen draws rank controls on the own team only**
- Given an admin A of team T viewing the Members screen with every team listed
- Then *Make manager* / *Remove manager* and *Promote* appear on rows of team T (on the same rows as
  before this ticket) and on **no** row of any other team. *Delete account* is unchanged.
- And for a member or a manager, none of the three is drawn on any row, as before.

**Invariants touched: `[INV-07]`.**
- **INV-07** — an entry is counted against the teams its owner belongs to, and `team_id` decides
  which. Both functions write `role` only, never `team_id`, and the new trigger writes only to the
  new table. No change can move anyone's entries to a different team's count. Tests assert that
  `team_id` is unchanged after every successful call.

**Open questions.** None. Q1 and Q2 were answered by the operator (front-matter `consulted`). The
confirmation in AC-4/AC-5 rests on a premise that turned out to be wrong when the source was read.
ADR-065 § Status records the correction, and the Changelog below says what changed and why.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

**The promotion confirmation reuses the shape of the removal confirmation dialog**
(`member-list-remove-confirm`), in the same place on the page and in the same order: a sentence,
then any error, then the confirm button, then *Cancel*. Copy:

- Sentence: `Make <strong>{displayName}</strong> an admin? An admin cannot be demoted, so this cannot be undone here.`
- Confirm button: `Make admin`, and `Promoting…` while busy. A filled button, but **not** the rose
  danger fill the removal uses: nothing is lost. Use the screen's existing primary filled button
  class.
- Cancel button: `Cancel`, the removal dialog's outline style.
- `aria-label="Confirm promoting the member"`, `role="dialog"`, `aria-modal="true"`.

Only one confirmation is open at a time. Pressing *Promote* while the removal dialog is open does
nothing, because the row controls are disabled while either dialog is open.

## 3. Permission model

The control is in the datastore in every row. The screen predicates are affordances only (ADR-005).

| Action | Member | Manager | Admin | Where it is held |
|---|---|---|---|---|
| Set a rank `member` ⇄ `manager` | ❌ | ❌ | ✅ **own team only** (was: any team) | `set_member_role`: `is_admin`, then `m.team_id = member_team_id(auth.uid())` in the `where` |
| Set rank `admin` through the rank write | ❌ | ❌ | ❌ **new** | `set_member_role`: refuses `p_role = 'admin'` before the update |
| Promote a member or a manager to admin | ❌ | ❌ | ✅ **own team only**, through its own function (was: any team, through the rank write) | `promote_member_to_admin`: `is_admin`, own-team `where` |
| Demote an admin | ❌ | ❌ | ❌ (unchanged, not decided) | both `where` clauses; `member_enforce_role_and_removal` |
| Change own role | ❌ | ❌ | ❌ (unchanged, ADR-064) | the admin's own row is `admin`; trigger self clause |
| Read or write `member_role_change` | ❌ | ❌ | ❌ | RLS on, no policy, no privilege for `anon` or `authenticated` |
| Remove a member | ❌ | ❌ | ✅ own team (unchanged) | `member_update_admin` |

The record is written by a `security definer` trigger function. It is not a privilege any caller
holds.

## 4. Contract

### 4.1 Migration `supabase/migrations/20261020150000_mir03_bounded_role_changes.sql` (new)

`begin; … commit;`, idempotent, applied by a human (RULE-09). The header cites ADR-065 and this plan,
and says it supersedes ADR-044 Decision 1. `set search_path = ''` and schema-qualified names
throughout.

**(a) The record table.**

```sql
create table if not exists public.member_role_change (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.member (id) on delete restrict,
  from_role   public.member_role not null,
  to_role     public.member_role not null,
  changed_by  uuid references public.member (id) on delete restrict,
  changed_at  timestamptz not null default now()
);
alter table public.member_role_change enable row level security;
revoke all on table public.member_role_change from public, anon, authenticated;
```

No policy is created. `on delete restrict` matches `entry.approved_by`.

**(b) The recording trigger.**

```sql
create or replace function public.member_record_role_change() returns trigger
  language plpgsql security definer set search_path = '' as $$
begin
  insert into public.member_role_change (member_id, from_role, to_role, changed_by)
  values (new.id, old.role, new.role, (select auth.uid()));
  return null;
end;
$$;
revoke all on function public.member_record_role_change() from public;

drop trigger if exists member_record_role_change on public.member;
create trigger member_record_role_change
  after update of role on public.member
  for each row
  when (old.role is distinct from new.role)
  execute function public.member_record_role_change();
```

`changed_at` takes the column default, so it is the database's clock and never the client's.

**(c) The rank write, bounded.** `create or replace function public.set_member_role(p_member_id uuid,
p_role public.member_role) returns public.member`, same signature, `security definer`. The body is
the current one with two changes:

```sql
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can change a rank' using errcode = '42501';
  end if;

  -- ADR-065 decision 2.
  if p_role = 'admin'::public.member_role then
    raise exception 'promotion to admin is promote_member_to_admin, not a rank change'
      using errcode = '42501';
  end if;

  update public.member m
     set role = p_role
   where m.id = p_member_id
     and m.team_id = public.member_team_id((select auth.uid()))   -- ADR-065 decision 1
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'admin'::public.member_role
  returning m.* into v_row;

  if not found then
    raise exception 'that rank could not be changed' using errcode = '42501';
  end if;
  return v_row;
```

`m.team_id is not null` is dropped. The equality cannot match a null `team_id`, and the caller is an
admin, who always has a team. Keep a one-line comment saying so. The existing `revoke … from public`
and `grant execute … to authenticated` are repeated.

**(d) The promotion.**

```sql
create or replace function public.promote_member_to_admin(p_member_id uuid)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_row public.member;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can promote a member' using errcode = '42501';
  end if;

  update public.member m
     set role = 'admin'::public.member_role
   where m.id = p_member_id
     and m.team_id = public.member_team_id((select auth.uid()))
     and m.status = 'approved'::public.member_status
     and m.removed_at is null
     and m.role <> 'admin'::public.member_role
  returning m.* into v_row;

  if not found then
    raise exception 'that member could not be promoted' using errcode = '42501';
  end if;
  return v_row;
end;
$$;
revoke all on function public.promote_member_to_admin(uuid) from public;
grant execute on function public.promote_member_to_admin(uuid) to authenticated;
```

`member_enforce_role_and_removal` is **not** replaced. It still fires before both updates, and its
clauses stand behind the `where`.

### 4.2 Real seam `src/lib/data/supabase.ts`: no signature changes

- `promoteMember(memberId)` calls
  `client().rpc("promote_member_to_admin", { p_member_id: memberId })`. On `error` →
  `{ ok: false, error: toRankFailure(error, MEMBER_PROMOTE_REFUSED) }`. If `!isMemberRow(data)` →
  `{ ok: false, error: { code: "unknown", message: MEMBER_PROMOTE_REFUSED } }`. Otherwise
  `{ ok: true, value: toMember(data) }`. `setRankThroughRpc` is no longer used by it.
- `setMemberRole(memberId, role)` stays as it is (`setRankThroughRpc(memberId, role,
  MEMBER_RANK_REFUSED)`). An `"admin"` argument reaches the function and comes back as a `42501`,
  which `toRankFailure` already maps to `not_permitted` with the rank sentence.
- Bring the ADR-044 comments on `setRankThroughRpc`, `promoteMember` and `setMemberRole` up to date:
  cite ADR-065, say "own team", and say that promotion has its own RPC. No other function changes.

### 4.3 Mock seam `src/lib/data/mock.ts`

It reproduces the two functions exactly, the same way it reproduces every other definer function:

- `setRank`'s target predicate gains `m.teamId === me.teamId`. Its `m.teamId !== null` conjunct may
  go, as in § 4.1(c).
- `setMemberRole(memberId, role)` returns `refused("not_permitted", MEMBER_RANK_REFUSED)` when
  `role === "admin"`, after the admin check and before any row lookup. This is the same order as
  § 4.1(c).
- `promoteMember` keeps calling `setRank(memberId, "admin", "Only an admin can promote a member.",
  MEMBER_PROMOTE_REFUSED)`, which now carries the own-team predicate. It does not go through
  `setMemberRole`, so the admin refusal does not touch it.
- **The mock keeps no `member_role_change` record.** No seam function reads it (§ 5), so a mock copy
  would be untested state. AC-1, AC-4, AC-9 and AC-10's record clauses are verified in § 4.7 only.
- Bring the header comment on `setRank` up to date (cite ADR-065; the own-team filter is back).

### 4.4 Seam interface `src/lib/data/index.ts`

Doc comments only, on `promoteMember` and `setMemberRole`: own team, ADR-065, promotion has its own
function, the rank write refuses `"admin"`. **No signature, type or export changes.**

### 4.5 Screen `src/routes/MemberList.tsx`

- `canPromote(m)` becomes `me.role === "admin" && m.id !== me.id && m.role === "member" && m.teamId === me.teamId`.
- `canSetManager(m)` becomes `me.role === "admin" && m.id !== me.id && m.role !== "admin" && m.teamId === me.teamId`.
- Rewrite the comment above these predicates. All three now compare teams, because all three
  controls are own-team (ADR-065 for the ranks, ADR-044 Decision 3 for removal). The comment that
  explains why `canRemove` alone compares teams is no longer true.
- New state `promoting: Member | null`. *Promote* sets it (clearing `actionError`) and does not call
  the seam. The confirmation dialog from § 2b renders while `promoting` is set. Its confirm button
  calls the seam, which is today's `onPromote` body run against `promoting`. On success it clears
  `promoting` and reloads. On refusal it keeps the dialog open with the error in the dialog. On a
  throw it shows the existing *"Could not promote. Please try again."* in the dialog. *Cancel* clears
  `promoting` and `actionError`.
- Disable the row-level buttons while `pending || promoting` is set, in addition to `busy`. The page
  error (`member-list-action-error` above the table) renders only when neither dialog is open.
- Replace the *"TEA-04 AC-4. No confirmation, and that is a decision…"* comment above `onPromote`
  with one that cites ADR-065 decision 3 and says why there is now a confirmation (one-way action).

### 4.6 Tests

**`tests/role-change-bounds.test.ts` (new, drives the mock seam).** One `it` per row, names as
written. Every test that writes restores what it wrote, except promotion tests, which cannot. Put
those last in the file and aim them at a member nothing later depends on.

| AC | `it(...)` |
|---|---|
| AC-1 | `"an admin makes a member of their own team a manager and back"`. Also asserts `teamId` unchanged (INV-07) |
| AC-2 | `"an admin cannot set the rank of another team's member"` |
| AC-3 | `"the rank write refuses admin, even on the admin's own team"` |
| AC-6 | `"an admin cannot promote another team's member"` |
| AC-7 | `"a member cannot set a rank or promote"` |
| AC-7 | `"a manager cannot set a rank or promote"` |
| AC-7 | `"nobody signed in cannot set a rank or promote"` |
| AC-8 | `"a removed member, an admin, and an unknown id are refused on both paths with one answer each"` |
| AC-4 | `"an admin promotes a member of their own team to admin"`. Asserts role `admin`, `teamId` unchanged, and that a following `setMemberRole(id, "member")` is refused. **Last in the file** |
| AC-1–AC-10 | `"the migration bounds set_member_role, adds promote_member_to_admin and records every role change"`. A static read of the migration file asserting: the own-team conjunct appears in both functions, the `p_role = 'admin'` refusal, `create table if not exists public.member_role_change`, `enable row level security`, `revoke all on table public.member_role_change from public, anon, authenticated`, and the `after update of role` trigger with its `when` clause. **Not verification.** It guards against the file being lost or reshaped before MIR-05 can run it |

**`tests/cross-team-role.test.ts` (edit).** It asserts ADR-044 Decision 1, which is now superseded.
Add a dated paragraph at the top of the header (*"MIR-03, 2026-10-20 — ADR-065 supersedes Decision
1…"*) and keep the existing header below it. Change only the assertions that encode cross-team
success (`"an admin makes ANOTHER team's member a manager, and puts them back"`, `"an admin promotes
ANOTHER team's member to admin"`) into the refusal, renaming those two `it`s to say so. Every other
test in the file keeps its name and assertion. If one starts failing because of the own-team bound,
re-aim it at a member of the admin's own team and say so in `03-impl-log.md`.

**`tests/notifications.test.ts` and `tests/tasks.test.ts` (edit, fixture setup only).** Each seeds
an admin of `FIXTURE_OTHER_TEAM` in `beforeAll` through `setMemberRole(id, "admin")`, which ADR-065
now refuses. Seed that person instead by approving onto `FIXTURE_TEAM`, `promoteMember` as
`FIXTURE_ADMIN`, then `moveMember(id, FIXTURE_OTHER_TEAM.id)` (ADR-065 *Consequences*), and re-cite
the ADR-044 comment in `tasks.test.ts` to ADR-065. No `it`, name or assertion changes.

**The whole existing suite must stay green**, including `tests/e2e/`. `tsk-01-tasks.spec.ts:72` and
`tsk-04-week-task-badge.spec.ts:196` press *Make manager* on a teammate's row and must still pass.
No e2e spec presses *Promote* today (`solo-member-admin.spec.ts:251` asserts it is absent).

### 4.7 Manual verification `.ai/board/tickets/MIR-03/verification.md` (new)

Same form as MIR-02's: the developer writes the steps, the operator fills in the results, and no key
or token goes in the file. Plan:85-86 and the phase 0 exit criteria (plan:98) make it the
verification of record until MIR-05.

1. **Before the migration**: reproduce the finding. An admin of team T calls
   `POST /rest/v1/rpc/set_member_role` for a member of team U with `p_role = "manager"`. Record the
   status and the row's `role`, then the operator restores it in the SQL editor.
2. **After the migration**: one step per AC-1 to AC-3 and AC-6 to AC-10. Each step gives the exact
   `curl` (RPC or `/rest/v1/member_role_change`), the token it runs as, the expected status
   (`42501` for a refusal), a `select role, team_id from public.member where id = …`, and a
   `select * from public.member_role_change order by changed_at desc limit 5` showing the rows
   expected, or that none was added. AC-9 is an `update` run in the SQL editor. AC-4, AC-5 and AC-11
   go through the application.

### Selectors

| `data-testid` | Element | Status |
|---|---|---|
| `member-list-row-promote` | *Promote* row button. Now opens the dialog | existing, behaviour changed |
| `member-list-row-manager` | *Make / Remove manager* | existing, drawn on own-team rows only |
| `member-list-promote-confirm` | the promotion dialog | **new** |
| `member-list-promote-confirm-accept` | *Make admin* | **new** |
| `member-list-promote-confirm-cancel` | *Cancel* | **new** |
| `member-list-action-error` | the error inside the promotion dialog, the same id the removal dialog uses for its error | existing id, new place |

## 5. Seam impact

**No seam function is added, removed or re-signed.** `promoteMember` changes its implementation in
the real seam (a different RPC). Both `promoteMember` and `setMemberRole` change behaviour in the
mock, to match the stricter datastore. Seam parity holds. RULE-02 is unchanged: the screen still
reaches the datastore only through the seam.

## 6. Schema delta

**Not `none`.** It replaces the definer function `set_member_role` (same signature). It creates the
definer function `promote_member_to_admin(uuid)` with its grants, the table `member_role_change`
(RLS on, no policy, all privileges revoked from `public`, `anon` and `authenticated`), the trigger
function `member_record_role_change()`, and the `after update of role` trigger on `public.member`.
No existing table, column, constraint or policy changes.

**ADR: [ADR-065](../../../registry/decisions/ADR-065-role-changes-are-own-team-promotion-is-its-own-action-and-every-change-is-recorded.md),
`ACCEPTED by the operator` 2026-10-20 ("Q1. A / Q2. A").** It supersedes ADR-044 Decision 1, and
ADR-044 carries the note. `requires_adr: true`. Applying the migration is human (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20261020150000_mir03_bounded_role_changes.sql"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/data/index.ts"
  - "src/routes/MemberList.tsx"
  - "tests/role-change-bounds.test.ts"
  - "tests/cross-team-role.test.ts"
  - "tests/notifications.test.ts"   # beforeAll fixture setup only (other team's admin seeded via own-team promote + move)
  - "tests/tasks.test.ts"           # beforeAll fixture setup only, same seeding; ADR-044 comment re-cited to ADR-065
  - ".ai/registry/decisions/ADR-065-role-changes-are-own-team-promotion-is-its-own-action-and-every-change-is-recorded.md"
  - ".ai/registry/decisions/ADR-044-an-admin-sets-a-rank-on-any-team.md"   # supersession note under § Status only
  - ".ai/board/tickets/MIR-03/**"
```

`glossary_owed` is `[]`. No glossary row is written and `.ai/registry/glossary.md` is not listed.

Nine source and test files plus two ADRs (seven at PLAN; two test files added by the 2026-10-20 amendment below): **`size: M`**, which agrees with `size_estimate: M`.

**Not XL.** `.ai/01-operating-model.md:449` lists a schema change under XL, and the next paragraph
gives the test: *"whether existing callers must change"*. No seam signature or shared type changes
and no caller of the seam changes, which is the reading ADM-06 § 7 applied to its own migration.

`tests/cross-team-role.test.ts` and `ADR-044` are files this run did not create. Each is listed for
the narrow edit § 4.6 and § 6 name: superseded assertions turned into refusals, and a status note
added with the body kept.

## 8. Rejected alternatives

**A. Record the actor as columns on `member` (`role_changed_by`, `role_changed_at`).** No new table,
no new trigger, and the actor sits beside the role it explains, the way `approved_by` sits on
`entry`. Rejected because it keeps only the **last** change. A promotion followed by a rank change
erases who promoted, and the promotion is the one change that cannot be undone. P0-3 says *"every
role change"*.

**B. Insert the record inside `set_member_role` and `promote_member_to_admin`, with no trigger.**
The write is visible in the function body that causes it, and there is one fewer object to reason
about. Rejected because it records only those two paths. A rank changed in the SQL editor, or by a
function written later, would leave no row. The trigger covers every path, and the null actor in
AC-9 is the honest record of a change no user token made.

**C. Keep one function and add a `p_confirm boolean` for promotion.** Fewer functions, and the RPC
the client already calls. Rejected because a flag the client sets is not a gate. Any caller can pass
`true`, so "separately gated" would mean a parameter. ADR-065 decision 3 gives promotion its own
function, which later work can re-point at a different role on its own (MIR-16, to
`system_admin`/`org_admin`) without touching the rank write.

## Changelog

- `2026-10-20T14:50:40+07:00` — written `BLOCKED` at section 2 on Q1 (team or org bound, ADR-044
  Decision 1) and Q2 (the promotion gate). Raised by `tech-lead-design`.
- `2026-10-20T15:02:00+07:00` — all sections written after the operator answered "Q1. A / Q2. A",
  recorded as ADR-065. Raised by the operator. Amended by `tech-lead-design`. Sections 1 and 2 were
  drafted from the plan item, the audit, ADR-044 and the answers before the seam and the screen were
  read. **Reading `src/routes/MemberList.tsx` found that the client draws no promotion confirmation**:
  TEA-04 chose none, and Q2 A was worded as if one existed. AC-4/AC-5 and § 2b **add** one, so the
  operator gets the option as it was put to them. ADR-065 § Status records the correction and how to
  revert it. Reading `20260911180000_solo_many_teams.sql` confirmed that `admit_member` does not
  write `role`, so the trigger in § 4.1(b) is the only actor mechanism needed. No AC was narrowed to
  fit the code.
- `2026-10-20` — `tests/notifications.test.ts` and `tests/tasks.test.ts` added to § 7 and named in
  § 4.6, for `beforeAll` fixture setup only. Raised by `developer` (`99-questions.md` round 1).
  Amended by `tech-lead-design`. Both seeded another team's admin through
  `setMemberRole(id, "admin")`, which ADR-065 decisions 1 and 2 refuse; § 4.6 had named only
  `tests/cross-team-role.test.ts`. The replacement seeding (own-team promote, then move) is the path
  ADR-065 *Consequences* records as still open and ends in the same state. `size` stays `M`: nine
  files is within M, and no AC changed.
