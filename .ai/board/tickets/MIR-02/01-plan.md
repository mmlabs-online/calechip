---
ticket: MIR-02
stage: PLAN
agent: tech-lead-design
produced_at: 2026-10-20T13:37:06+0700
inputs_read:
  - .ai/board/tickets/MIR-02/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-039-every-admin-manages-every-team.md
  - .ai/registry/decisions/ADR-044-an-admin-sets-a-rank-on-any-team.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12-repro.md
  - .ai/standards/rbac-and-security.md
  - supabase/migrations/20260901120000_tea04_member_writes.sql
  - supabase/migrations/20260910093000_solo_profile_self_update.sql
  - supabase/migrations/20260910100000_solo_member_approval.sql
  - supabase/migrations/20260911180000_solo_many_teams.sql
  - supabase/migrations/20260924100000_solo_cross_team_role.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/routes/MemberList.tsx
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-02 — plan

## 1. Problem and scope

**Feature, transcribed from `.ai/registry/features.md:291`:**

| ID | Feature | Group |
|---|---|---|
| MIR-02 | A member's own role, status and team can be changed only through bounded, definer-checked paths | MIR |

**Plan item P0-2, transcribed from `.ai/board/plans/calechip-multi-tenancy-plan.md:76-81`:**

- Reproduce first: `PATCH /rest/v1/member?id=eq.<self>` with `{"role":"admin"}` from an ordinary
  member account. Record the result.
- Extend trigger `member_enforce_role_and_removal` to refuse a member changing their own `role`,
  `status` or `team_id`.
- Revoke `update (role, status, team_id)` from `authenticated` where the column is not needed; route
  those writes through definer RPCs instead.
- Reconcile the stale comment at `profile_self_update.sql:13-17`.
- Add a pgTAP test proving the PATCH fails (depends on P1-1; until then, a manual check recorded in
  the PR).

**What changes for whom.** Today any signed-in person — an ordinary member, or a pending sign-up who
has not been admitted — can raise their own authority with one direct request to the datastore:
make themselves admin, admit themselves, or move themselves onto another team. Because `is_admin` is
global, the first is admin over every team. After this ticket **nobody holding a user token can
change their own `role`, `status` or `team_id` by any path**, and no client can write those three
columns through a table statement at all. Admins keep every power they have over *other* people —
reject a sign-up, save the member edit panel, set a rank, move a member — through functions bounded
exactly as the policies were. This is the first of phase 0's exit criteria (plan:93): *"A member
account cannot alter its own role, status or team."*

**Size estimate: `M`.** One migration, two seam implementations changed internally, one new test
file, one comment correction; no screen.

**Out of scope.**

- **The cross-team findings on the definer functions** — `admit_member` and `move_member` accept any
  team, `set_member_role` any member, a rejection any admin (audit:378-387). Unchanged here; MIR-03
  bounds `set_member_role`, MIR-13 the rest.
- **The pgTAP test.** Depends on MIR-05 (plan:81); until it is DONE the verification is the manual
  check in `.ai/board/tickets/MIR-02/verification.md`, recorded in the pull request.
- **Running the reproduction or applying the migration.** Both are against the real database and are
  human (RULE-09). This ticket writes the steps; the operator runs them.
- **`supabase/db.sql`.** Stale in twelve places already (`rbac-and-security.md` gap A6); MIR-08
  regenerates or retires it.
- **`.ai/standards/rbac-and-security.md`.** Gap A2 closes and two permission rows want a clause
  (ADR-064 § *Affected documents*); standards are human-only, so the rows are named, not written.
- **Dropping `member_decide_admin`.** It becomes inert for writes and is left in place, the choice
  `20260911180000_solo_many_teams.sql` made for the same policy.
- **Any change to `removed_at`, `display_name` or `avatar` writes.** Their grants and trigger clauses
  stay as they are.
- **The mock-versus-SQL parity test.** MIR-07. The mock changes here only where this ticket makes SQL
  stricter.

## 2. Acceptance criteria

The datastore criteria (AC-1 to AC-6) are observed against a real database with the migration
applied, by the steps in `verification.md`, until MIR-05 lets pgTAP run them. AC-7 to AC-11 are
observed through the seam.

**AC-1 — a member cannot make themselves admin**
- Given an approved, not-removed member whose `role` is `member`, signed in with their own token
- When they send `PATCH /rest/v1/member?id=eq.<their id>` with `{"role":"admin"}`
- Then the request is refused with SQLSTATE `42501`, and their row's `role` is still `member`

**AC-2 — a member cannot change their own team**
- Given an approved member on team A, and a team B that exists
- When they send `PATCH /rest/v1/member?id=eq.<their id>` with `{"team_id":"<B>"}`
- Then the request is refused with `42501`, and their `team_id` is still A

**AC-3 — a pending sign-up cannot admit themselves**
- Given a person whose `member` row is `status = 'pending'` and `team_id` null
- When they send `PATCH /rest/v1/member?id=eq.<their id>` with `{"status":"approved","team_id":"<any team>"}`
- Then the request is refused with `42501`, and the row is still pending and teamless

**AC-4 — an admin cannot change their own status or team through the table either**
- Given an approved admin
- When they send a `PATCH` on their own row naming `status`, or `team_id`, or `role`
- Then each request is refused with `42501`, and the row is unchanged

**AC-5 — no path a user token can reach changes the caller's own three columns**
- Given an approved admin on team A, and a team B that exists
- When they call `rpc/move_member` with `p_member_id` = their own id and `p_team_id` = B
- Then the call is refused with `42501`, and their `team_id` is still A

**AC-6 — nobody writes the three columns through the table, on anybody's row**
- Given an approved admin, and an approved member on the admin's own team
- When the admin sends `PATCH /rest/v1/member?id=eq.<that member>` with `{"role":"manager"}`, or
  `{"status":"rejected"}`, or `{"team_id":"<the admin's team>"}`
- Then each is refused with `42501` and the row is unchanged

**AC-7 — editing your own name and avatar still works**
- Given an approved member
- When they save a new display name and an offered avatar on the profile screen
- Then both are saved and nothing else on their row changes (TEA-10 unchanged)

**AC-8 — an admin still rejects a sign-up**
- Given an admin and a pending, teamless sign-up
- When the admin rejects it
- Then the row becomes `status = 'rejected'` with `team_id` null, and the call succeeds

**AC-9 — rejecting a sign-up that is not waiting is still refused**
- Given an admin, and a person who is already approved or already rejected
- When the admin rejects them
- Then the call is refused with the sentence *"That sign-up could not be decided. It may already
  have been."*, code `not_permitted`, and the row is unchanged
- And a non-admin's rejection of a pending sign-up is refused the same way

**AC-10 — the member edit panel still saves, and still only to the admin's own team**
- Given an admin and a member of the admin's own team
- When the admin saves the member edit panel
- Then the save succeeds and the member is still on that team
- And a call naming a member of another team, or a destination that is not the admin's own team, or
  made by a non-admin, is refused with *"That member could not be moved."*, code `not_permitted`

**AC-11 — an admin moving somebody else, and setting somebody else's rank, still work**
- Given an admin and another approved, not-removed member
- When the admin moves them to another team, or sets their rank to `manager`
- Then the call succeeds (TEA-11, ADR-044 unchanged)
- And the same admin moving **themselves** is refused with *"That person could not be moved."*, code
  `not_permitted` (AC-5 seen through the seam)

**Invariants touched: `[INV-04, INV-07]`.**

- **INV-07** — `team_id` is the column that decides which team every one of a member's entries is
  counted against. A self-written `team_id` silently moves a person's whole absence history into
  another team's counts. Held by the column revoke and the trigger clause.
- **INV-04** — the absence count's denominator is the team's members as of the date. Self-written
  `team_id` or `status` changes who is in that set. Held by the same two mechanisms; `removed_at`,
  the column INV-04's note defines the denominator against, is not touched.

**Open questions.** None that change an AC. The one decision this plan makes that no ADR made —
AC-5 / AC-11's refusal of an admin moving themselves — is in ADR-064 *Consequences*, accepted by the
operator with the ADR on 2026-10-20 (option a: an admin is refused too).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

(No screen changes. Every sentence a person reads is one that already ships.)

## 3. Permission model

The check lives in the datastore in every row. The interface gates nothing new.

| Action | Member | Manager | Admin | Where it is held |
|---|---|---|---|---|
| Change own `role` | ❌ | ❌ | ❌ | column revoke (table path); trigger clause (every path) |
| Change own `status` | ❌ (incl. pending) | ❌ | ❌ | same |
| Change own `team_id` | ❌ | ❌ | ❌ — **new**: `move_member` on self refused | same |
| Write `role` / `status` / `team_id` on anybody's row through a table statement | ❌ | ❌ | ❌ | column revoke |
| Reject a pending sign-up | ❌ | ❌ | ✅ any (unchanged reach) | `reject_member` body: `is_admin` |
| Save the member edit panel | ❌ | ❌ | ✅ own team only | `set_member_team` body |
| Set another member's rank | ❌ | ❌ | ✅ (ADR-044, unchanged) | `set_member_role` + trigger |
| Move another member | ❌ | ❌ | ✅ (ADR-039, unchanged) | `move_member` + trigger |
| Edit own name / avatar | ✅ | ✅ | ✅ | unchanged |
| Remove a member | ❌ | ❌ | ✅ own team (unchanged) | `member_update_admin`, `removed_at` grant |

`auth.uid()` null — a migration, the SQL editor, the service role — is not refused by the new
clause, the carve-out the trigger's existing clauses make (known weakness 1: nothing blocks the
service role anyway).

## 4. Contract

### 4.1 Migration `supabase/migrations/20261020120000_mir02_member_self_writes.sql`

Wrapped in `begin; … commit;`, idempotent (`create or replace`), applied by a human (RULE-09). The
header cites ADR-064 and this plan, and states that it supersedes in effect the sentence *"Moving an
admin — the caller included — is allowed"* in `20260911180000_solo_many_teams.sql`.

**(a) The trigger.** `create or replace function public.member_enforce_role_and_removal()` with the
**whole current body of `20260910093000_solo_profile_self_update.sql` reproduced unchanged**, and
one clause added immediately after the `v_uid` assignment, before every existing clause:

```sql
  -- MIR-02, ADR-064 decision 3.
  if v_uid is not null and old.id = v_uid
     and (new.role    is distinct from old.role
       or new.status  is distinct from old.status
       or new.team_id is distinct from old.team_id) then
    raise exception 'a person may not change their own role, status or team'
      using errcode = '42501';
  end if;
```

The trigger itself (`member_enforce_role_and_removal` on `public.member`, `before update`, `for each
row`) is not dropped or recreated; replacing the function is enough.

**(b) The revoke.**

```sql
revoke update (role, status, team_id) on public.member from authenticated;
```

**(c) The rejection.**

```sql
create or replace function public.reject_member(p_member_id uuid) returns void
  language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can decide a sign-up' using errcode = '42501';
  end if;

  update public.member
     set status = 'rejected'::public.member_status, team_id = null
   where id = p_member_id
     and team_id is null
     and status = 'pending'::public.member_status;
  if not found then
    raise exception 'that sign-up is not waiting for a decision' using errcode = '42501';
  end if;
end;
$$;
```

**(d) The edit panel's save.**

```sql
create or replace function public.set_member_team(p_member_id uuid, p_team_id uuid)
  returns public.member
  language plpgsql volatile security definer set search_path = '' as $$
declare
  v_team uuid := public.member_team_id((select auth.uid()));
  v_row  public.member;
begin
  if not public.is_admin((select auth.uid())) then
    raise exception 'only an admin can move a member' using errcode = '42501';
  end if;

  update public.member m
     set team_id = p_team_id
   where m.id = p_member_id
     and m.team_id = v_team
     and p_team_id = v_team
  returning m.* into v_row;
  if not found then
    raise exception 'that member could not be moved' using errcode = '42501';
  end if;

  return v_row;
end;
$$;
```

**(e) Who may call them.**

```sql
revoke all on function public.reject_member(uuid) from public;
grant execute on function public.reject_member(uuid) to authenticated;
revoke all on function public.set_member_team(uuid, uuid) from public;
grant execute on function public.set_member_team(uuid, uuid) to authenticated;
```

Nothing else: no policy is created, altered or dropped; no table is altered.

### 4.2 Comment correction `supabase/migrations/20260910093000_solo_profile_self_update.sql`

**Comment lines only — the diff of this file must contain no line that is not a `--` comment.** The
paragraph at lines 13-17 is kept as written, and directly below it one paragraph is added:

```sql
-- *Corrected 2026-10-20 by MIR-02 (ADR-064).* The sentence above stopped being true at
-- `20260910100000_solo_member_approval.sql:173`, which granted `update (status, team_id)` to
-- `authenticated` the same day. `20261020120000_mir02_member_self_writes.sql` revokes it again,
-- with `role`, and adds the trigger clause that refuses a person changing their own `team_id`.
```

### 4.3 Real seam `src/lib/data/supabase.ts` — no signature changes

- `decideMember(memberId, { approve: false, … })` — replaces the table update with
  `client().rpc("reject_member", { p_member_id: memberId })`. On `error` →
  `{ ok: false, error: toTeamFailure(error, "That sign-up could not be decided. It may already have been.") }`;
  otherwise `{ ok: true, value: undefined }`. The approve branch is unchanged.
- `setMemberTeam(memberId, teamId)` — replaces the table update with
  `client().rpc("set_member_team", { p_member_id: memberId, p_team_id: teamId })`. On `error` →
  `toTeamFailure(error, "That member could not be moved.")`; if `!isMemberRow(data)` →
  `{ ok: false, error: { code: "unknown", message: "That member could not be moved." } }`; otherwise
  `{ ok: true, value: toMember(data) }`.
- The comments on both functions, and on `updateOwnProfile` where it says naming `role` or `team_id`
  is refused by the grant, are brought true. No other function changes.

### 4.4 Mock seam `src/lib/data/mock.ts`

- `moveMember` — refuses with `refused("not_permitted", MEMBER_MOVE_REFUSED)` when `memberId` is the
  current admin's own id, checked before the move. This is the only behaviour change; the mock must
  not stay looser than the trigger it reproduces.
- `setMemberRole` / `promoteMember` on the caller's own row are already refused by the mock (the row
  is `admin`); no change. `decideMember` and `setMemberTeam` keep their behaviour.

### 4.5 Seam interface `src/lib/data/index.ts`

Doc comments only, on `decideMember`, `setMemberTeam` and `moveMember`, naming the function that is
now the control. **No signature, type or export changes**, so the seam-parity test is unaffected.

### 4.6 Tests `tests/member-self-writes.test.ts` (new, runs against the mock seam)

One `it` per row, names as written:

| AC | `it(...)` |
|---|---|
| AC-11 | `"an admin cannot move themselves to another team"` |
| AC-11 | `"an admin still moves somebody else to another team"` |
| AC-11 | `"an admin still sets somebody else's rank"` |
| AC-8 | `"an admin still rejects a pending sign-up"` |
| AC-9 | `"rejecting somebody already decided is refused, with the shipped sentence"` |
| AC-9 | `"a member cannot reject a sign-up"` |
| AC-10 | `"the member edit panel still saves a member of the admin's own team"` |
| AC-10 | `"the edit panel refuses a member of another team"` |
| AC-7 | `"a member still edits their own display name and avatar"` |
| AC-1–AC-6 | `"the migration revokes role, status and team_id and adds the self clause"` — a static read of the migration file asserting the `revoke update (role, status, team_id)` statement and the self clause's three `is distinct from` comparisons are present. **Not verification**: a guard against the file being lost or reshaped before MIR-05 can run it |

### 4.7 Manual verification `.ai/board/tickets/MIR-02/verification.md` (new)

Two parts, steps written by the developer, results filled by the operator:

1. **Before the migration** — the reproduction P0-2 asks for first: the AC-1 `PATCH` from an
   ordinary member's token, with the request, the response status and body, and the row's `role`
   afterwards. Then the row put back by the operator in the SQL editor.
2. **After the migration** — one step per AC-1 to AC-6, each with the exact request (`curl` against
   `/rest/v1/…` with the member's or admin's access token and the anon key), the expected `42501`,
   and a `select` proving the row did not change; then AC-8 and AC-10 through the application.

The pull request links this file. Plan:81 makes it the verification of record until MIR-05.

### Selectors

None added or changed. No screen changes.

## 5. Seam impact

**No function is added, removed or re-signed.** Two functions change their implementation in the
real seam only — `decideMember` (reject branch) and `setMemberTeam` — from a table write to an RPC.
One function changes behaviour in the mock — `moveMember` refuses the caller's own id — to match the
stricter datastore. `.ai/standards/architecture.md`'s seam (RULE-02) is unchanged; seam parity holds.

## 6. Schema delta

**Not `none`** (ADR-014): replaces trigger function `member_enforce_role_and_removal`, revokes
`update (role, status, team_id)` on `public.member` from `authenticated`, creates definer functions
`reject_member(uuid)` and `set_member_team(uuid, uuid)` with their execute grants. No table, column,
constraint or policy changes.

**ADR: [ADR-064](../../../registry/decisions/ADR-064-a-person-cannot-change-their-own-role-status-or-team.md),
`ACCEPTED by the operator` 2026-10-20** — drafted `PROPOSED` by `tech-lead-design`; the operator
answered "a".
`requires_adr: true`. Applying the migration is human (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20261020120000_mir02_member_self_writes.sql"
  - "supabase/migrations/20260910093000_solo_profile_self_update.sql"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/data/index.ts"
  - "tests/member-self-writes.test.ts"
  - ".ai/registry/decisions/ADR-064-a-person-cannot-change-their-own-role-status-or-team.md"
  - ".ai/board/tickets/MIR-02/**"
```

`glossary_owed` is `[]`; no glossary row is written and `.ai/registry/glossary.md` is not listed.

Six source files and an ADR: **`size: M`**, which agrees with `size_estimate: M`.

`20260910093000_solo_profile_self_update.sql` is a file this run did not create; it is listed for the
comment correction P0-2 names, under § 4.2's comments-only constraint — the additive rule is kept by
appending a dated correction rather than rewriting the stale sentence.

## 8. Rejected alternatives

**A. Trigger clause only, no revoke.** Smallest diff: the trigger already fires on every path, so one
clause closes the self case everywhere, and no seam function has to move. Rejected because it leaves
three columns writable by every token through the table, guarded by a single procedural clause in a
function that has been `create or replace`d twice already; a later replacement that drops the clause
reopens the hole silently. The column grant is declarative and checked before any policy. The plan
item asks for both.

**B. Route `setMemberTeam` through `move_member` instead of a new function.** One fewer function,
and `move_member` already exists and is already called by the seam. Rejected because `move_member`
is any-admin, any-team (ADR-039): the edit panel's save, own-team-only today, would silently become a
cross-team write as a by-product of a security fix — widening a power in the ticket that exists to
narrow them.

**C. Exempt admins from the self clause** (`… and not public.is_admin(v_uid)`). Keeps `move_member`
on self working exactly as its header says. Rejected because the finding is a person raising or
re-scoping their own authority, and an admin changing their own `status` or `team_id` is that shape;
a carve-out keyed on the very role the hole grants is the wrong place for an exception. ADR-064 puts
the behaviour change in front of the operator rather than hiding it.

## Changelog

- `2026-10-20T13:37:06+0700` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2
  were drafted from the plan item, the audit and the features row before the seam was read; reading
  `src/lib/data/supabase.ts` added AC-8 to AC-10 (the two writes that still used the revoked
  grants) and reading `20260911180000_solo_many_teams.sql` added AC-5 and the self-move half of
  AC-11 (the definer path the revoke does not reach). No AC was narrowed by what the code made easy.
- `2026-10-20T13:46:24+0700` — sections 2 and 6: ADR-064 accepted by the operator ("a"); the admin
  self-move refusal in AC-5 and AC-11 stands. No AC changed. Raised by the operator. Amended by
  `tech-lead-design`.
