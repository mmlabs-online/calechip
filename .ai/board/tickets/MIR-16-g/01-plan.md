---
ticket: MIR-16-g
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-08T06:11:06Z
inputs_read:
  - .ai/board/tickets/MIR-16-g/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-084-the-fixtures-name-the-admin-role-through-one-helper-before-the-value-is-renamed-in-place.md
  - .ai/registry/decisions/ADR-086-set-member-role-writes-the-team-role-and-the-manager-value-is-removed-by-a-column-retype.md
  - .ai/templates/plan.md
  - supabase/tests/_isolation.psql
  - supabase/tests/040-member-self-writes.test.sql
  - supabase/tests/100-mock-parity.test.sql
  - supabase/tests/250-membership-self-lock.test.sql
  - supabase/tests/270-member-team-id-dropped.test.sql
  - supabase/tests/300-org-admin-rename.test.sql
  - supabase/tests/310-manager-read-from-membership.test.sql
  - supabase/tests/320-set-member-role-team-role.test.sql
  - supabase/seed.sql
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-16-g — the pgTAP fixtures say which team role they mean, and stop spelling `'manager'` as a member role

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:305`):

| ID | Feature | Group |
|---|---|---|
| MIR-16 | The database splits admin into system_admin, org_admin and a per-team manager | MIR |

**ADR-086 decision 2** gives this ticket the removal of `'manager'` from `public.member_role`. It
also names the harness, the seed and the fixtures. **ADR-087 decision 1** (written at this PLAN)
narrows it to the fixtures, in ADR-084's shape:

- `tests.put_on_team` takes the team role explicitly;
- a new helper maps the application's role words to a team role;
- the remaining literal `'manager'` member-role values go through `tests.member_role`.

The type change itself moves to MIR-16-h.

**Who gains what.** No user sees a change. After this ticket, removing the value touches about
seven files instead of thirteen, and no test's manager stops being a manager when it does. The suite
also stops assuming that a person's team role can be read off their global role, which has been
false since MIR-16-f.

`size_estimate: M`. The work is the harness and seven pgTAP files, plus the split's board overhead.

**Out of scope — and where each goes:**

- **The migration** — the type re-created, `member.role` re-typed, `member_role_change` as text,
  `set_member_role(uuid, text)` — and its pgTAP, `010`'s census, the helper's `'manager'` branch,
  `290`, `300`'s label assertion and `seed.sql` all go to **MIR-16-h** (ADR-087 decision 2).
- **Any change to product code, a migration, or the seed.** This ticket changes the pgTAP harness and
  pgTAP files only.
- **`set_member_role` calls that pass `'manager'` as an untyped literal** (040 `:23`, 070, 140, 150,
  230, 320) are left as they are. They stay valid when MIR-16-h makes the parameter `text`.
- **`310` AC-6** (the owner sets Thanh's `member.role` to manager) stays. Through `tests.member_role`
  it keeps working, and MIR-16-h decides whether it still means anything.

## 2. Acceptance criteria

The observer is the pgTAP suite and the source of `supabase/tests/`.

**AC-1 — the seed's managers are managers of their team because the fixture says so**
- Given `tests.seed()` has run
- When the active primary `membership` row of `manager_t` and `manager_u` is read
- Then each has `team_role = 'manager'`, and every other seeded person on a team has
  `team_role = 'member'`

**AC-2 — `put_on_team` no longer reads `member.role`**
- When the body of `tests.put_on_team` is read
- Then it does not reference `role` on `public.member`. Its team role is its third argument, which
  defaults to `'member'`

**AC-3 — the application's role words map to a team role in one place**
- When `tests.team_role_for` is called with `'manager'`, `'member'` and `'admin'`
- Then it returns `manager`, `member` and `member`

**AC-4 — 100's subjects keep their team roles**
- Given `100-mock-parity.test.sql` inserts its predicate and own-update subjects
- When each `manager` subject placed on a team is read
- Then its active primary row has `team_role = 'manager'`, and every other subject's row has
  `'member'`

**AC-5 — no test outside the helper spells `'manager'` as a member-role value**
- When `supabase/tests/` is searched outside `_isolation.psql`
- Then there is no `'manager'::public.member_role` cast. Every value written to `member.role` and
  every assertion of a seeded manager's member role goes through `tests.member_role`

**AC-6 — the whole suite passes, with the same counts**
- When `supabase test db` runs
- Then every file passes, and no `plan(n)` changes

**Invariants touched.** `[]`. No product code, migration or seed changes. The fixtures produce the
same `membership` rows as before (AC-1, AC-4), so INV-04's windows in the tests are unchanged.

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

No screen changes. There is no layout.

## 3. Permission model

There is no change. The helpers live in the `tests` schema, which exists only in a pgTAP run and
which no client role can reach. Every fixture write runs as the owner with `auth.uid()` null. That
is why MIR-21-c's `membership_refuse_own_rows` admits it.

## 4. Contract

### 4.1 Harness — `supabase/tests/_isolation.psql`

```sql
-- MIR-16-g, ADR-087 decision 1. The application's role words to a team role, in one place.
create function tests.team_role_for(p_role text) returns public.team_role
  language sql immutable set search_path = '' as $$
  select case p_role when 'manager' then 'manager'::public.team_role
                     else 'member'::public.team_role end;
$$;

-- tests.put_on_team (:77-88) gains a third parameter and stops reading member.role:
create function tests.put_on_team(p_member_id uuid, p_team_id uuid,
                                  p_team_role public.team_role default 'member')
  returns void
  language sql security invoker set search_path = '' as $$
  insert into public.membership (org_id, team_id, member_id, team_role, is_primary, joined_at, left_at)
  select m.org_id, p_team_id, m.id,
         p_team_role,
         m.removed_at is null,
         m.created_at,
         case when m.removed_at is null then null else greatest(m.removed_at, m.created_at) end
    from public.member m
   where m.id = p_member_id;
$$;
```

`tests.team_role_for` is defined before `tests.put_on_team`. In `tests.seed()`, `:140` becomes
`perform tests.put_on_team(tests.id(v_person.label), tests.id(v_person.team), tests.team_role_for(v_person.role));`.
The `:72-76` comment gains a sentence saying the team role is the caller's (ADR-087), not
`member.role`'s. `tests.member_role` is unchanged.

Every other caller of `tests.put_on_team` passes two arguments and gets `'member'`. That is the
value the body derived for them before, because none of them inserts a manager. The Developer greps
the callers and confirms this in `03-impl-log.md`.

### 4.2 Fixture files

| File | Line | Change |
|---|---|---|
| `100-mock-parity.test.sql` | `:134` | `perform tests.put_on_team(tests.parity_id(p_case_id), tests.id('team_t'), tests.team_role_for(p_role));` |
| `310-manager-read-from-membership.test.sql` | `:29` | `select tests.put_on_team(tests.m310('rae'), tests.id('team_t'), 'manager');` |
| `040-member-self-writes.test.sql` | `:15` | the value is `tests.member_role('member')::text`. The refusal is the missing column grant, so any valid value proves it |
| `040-member-self-writes.test.sql` | `:44` | `'manager'` becomes `tests.member_role('manager')::text` |
| `250-membership-self-lock.test.sql` | `:124`, `:219` | the `::public.member_role` cast on `'manager'` is removed, leaving a plain literal argument to `set_member_role` |
| `270-member-team-id-dropped.test.sql` | `:134` | the value is `tests.member_role('member')::text`. That is still a change to A's own role, so the self-lock message is what answers |
| `300-org-admin-rename.test.sql` | `:35` | `'manager'` becomes `tests.member_role('manager')::text` |
| `320-set-member-role-team-role.test.sql` | `:88` | `'manager'` becomes `tests.member_role('manager')::text` |

`plan(n)` is unchanged in every file. A literal the Developer finds beyond this table follows the
same rule and is listed in `03-impl-log.md`.

## 5. Seam impact

None. No seam, mock or `src/` file changes.

## 6. Schema delta

`none`. No migration, and no change to any table, column, enum, function, policy, trigger, grant or
row. Only the `tests` schema of a pgTAP run changes.

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-087-the-fixtures-stop-deriving-a-team-role-from-member-role-before-manager-is-removed.md"
  - ".ai/board/tickets/MIR-16-h/ticket.yaml"
  - ".ai/board/tickets/MIR-17/ticket.yaml"
  - "supabase/tests/_isolation.psql"
  - "supabase/tests/040-member-self-writes.test.sql"
  - "supabase/tests/100-mock-parity.test.sql"
  - "supabase/tests/250-membership-self-lock.test.sql"
  - "supabase/tests/270-member-team-id-dropped.test.sql"
  - "supabase/tests/300-org-admin-rename.test.sql"
  - "supabase/tests/310-manager-read-from-membership.test.sql"
  - "supabase/tests/320-set-member-role-team-role.test.sql"
```

`size: M`, from 11 paths, and `size_estimate` agrees. As ADR-086 described it, MIR-16-g counted
about 13 files, which is `L` (ADR-087 *Context*). The type change moved to MIR-16-h, counted roughly
at seven paths, and MIR-17 now also depends on MIR-16-h. `glossary_owed` is `[]`.

## 8. Rejected alternatives

- **The removal in one ticket.** Rejected: about 13 files, `L`.
- **Keep `put_on_team` deriving the team role, and convert the seed's managers in MIR-16-h.**
  Rejected: the decider tests would lose their managers the moment the type changes. That would put
  the harness, 100 and 310 back into MIR-16-h.
- **Pass the team role into `put_on_team` at every call site.** Rejected: about twenty callers would
  change to say `'member'`, which the default already says.
- **Map `'manager'` in `tests.member_role` to `'member'` now.** Rejected: before the type changes,
  the seed's managers would hold `member` on `member.role` while MIR-16-f's AC-3 still describes a
  legacy manager. The mapping belongs with the change that makes it true.

## Changelog

- `2026-11-08T06:11:06Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from the ticket and ADR-086 before the source tree was read for 3–8. Reading it found
  three things:
  - `put_on_team` derives the team role from `member.role`, which added AC-1, AC-2 and AC-4;
  - every other member role already goes through `tests.member_role`, which kept the change to
    seven literal sites;
  - the removal is about 13 files (`L`), which led to the split to MIR-16-h (ADR-087).

  Amended by `tech-lead-design`.

## Delegated decisions

- **ADR-087**: MIR-16-g moves the fixtures. `tests.team_role_for` is added, `put_on_team` takes the
  team role, and no test outside the helper spells `'manager'` as a member role. MIR-16-h removes the
  value, with `set_member_role(uuid, text)` so `'org_admin'` is still refused with `42501`. MIR-17
  depends on MIR-16-h.
