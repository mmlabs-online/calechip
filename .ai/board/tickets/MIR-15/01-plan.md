---
ticket: MIR-15
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-05T05:19:00Z
inputs_read:
  - .ai/board/tickets/MIR-15/ticket.yaml
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/audits/multi-tenancy-audit-2026-10-12.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-045-charter-refusals-4-and-5-are-lifted-for-events.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-066-the-member-directory-is-own-team-plus-people-the-caller-already-shares-an-event-with.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md
  - .ai/registry/decisions/ADR-075-a-system-admin-manages-orgs-through-three-aal2-gated-rpcs.md
  - .ai/board/ideas/2026-09-29-a-gathering-has-nowhere-to-be-announced-or-joined.md
  - .ai/standards/rbac-and-security.md
  - .ai/01-operating-model.md
  - .ai/templates/plan.md
  - supabase/migrations/20260905120000_adm02_holiday.sql
  - supabase/migrations/20260929140000_evt02_attendance.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261103180000_mir13b_read_path_org_bound.sql
  - supabase/migrations/20261104150000_mir18_system_admin.sql
  - supabase/migrations/20261105120000_mir18b_org_management.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/160-read-path-org-bound.test.sql
  - src/lib/data/mock.ts
  - src/lib/data/system.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-15 — in Org public, a `public` event reaches only its own team, its notification follows it, and the directory reaches no other team through it

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:304`):

| ID | Feature | Group |
|---|---|---|
| MIR-15 | In Org public, the directory, public events and event notifications stay within the team, only system_admin sets its holidays, and a team can be moved to another org | MIR |

**Plan item P3-6, transcribed** (`.ai/board/plans/calechip-multi-tenancy-plan.md:206-211`):

- Disable `list_member_directory` across teams when `is_shared_tenant`
- Disable `event scope = 'public'` reaching outside the team when `is_shared_tenant`
- Trigger `notify_event_created` (`evt04:154-174`) must not notify across teams when `is_shared_tenant`
- Only `system_admin` sets holidays for Org public
- Build "move a team to another org" in the system panel — needed the day a customer buys a licence

**This ticket ships the first three bullets in the database, and the scope label.** The mock seam's
copy of the same predicate, with the eleven test files that assert today's cross-team reach, goes to
**MIR-15-d**; the fourth bullet to **MIR-15-b**; the fifth to **MIR-15-c**. All three are created
here (§ 7, ADR-076 decision 6). The feature row stays `PLANNED` until all four ship.

**Who gains what.** Org public is the tenant every unlicensed team lives in, and today it is every
team (MIR-12). ADR-059 decision 2 says it has *"every org-wide visibility feature disabled"*, because
the teams in it are strangers to one another who happen to share a free tier — not colleagues in one
company. Today a member of one such team who announces a `public` event reaches, notifies, and lets
join every member of every other free team, and the people who create or attend those events show up
in strangers' member directories. After this ticket, a member of Org public announces to, notifies,
and is seen by their own team. A team in a dedicated org keeps the org-wide `public` scope it has
today: the narrowing is a property of the shared tenant, not of the scope.

`size_estimate: M` — three predicates, one trigger and one helper in one migration, their pgTAP, and
two strings. No new screen, no new seam function, no mock change.

**Out of scope — and where each goes:**

- **Only `system_admin` sets Org public's holidays** — **MIR-15-b**. Includes the finding that
  `holiday_select_all` is still `using (true)` (`supabase/migrations/20260905120000_adm02_holiday.sql:58-59`),
  recorded in MIR-15-b's `mir_detail`.
- **The mock seam, and the vitest and e2e tests that run against it** — **MIR-15-d**. Until it
  ships the mock still lets a `public` event reach every team; every AC below is asserted against the
  database here, and against the mock there.
- **Moving a team to another org from the system panel** — **MIR-15-c**, with three open questions in
  its `mir_detail` that no source answers.
- **The admin's reach inside Org public.** An `is_admin` member of Org public still reads every
  event and every member of Org public (ADR-076 decision 4). Who administers Org public is MIR-16's.
- **Named invitations across teams in Org public**, by picker id (`save_event`) or by address
  (`invite_to_event`'s member branch). They still cross teams, by the operator's EVT-01 Q5 answer
  *"Bất kỳ team nào"*; ADR-076 *Options considered* records it as the next Org public special case
  (plan:324), for `/idea`.
- **Guest links and email invitations on a `public` event** (EVT-06, EVT-07, EVT-08, EVT-12's public
  branch). They are token- and address-scoped, not tenant-scoped, and are unchanged.
- **Rewriting stored `scope` values.** No row of `public.event` is updated (ADR-076 decision 1).
- **Notifications already delivered**, and attendances already held, on a cross-team `public` event
  created before the migration. Neither is deleted (ADR-076 *Consequences*).
- **The admin's calendar layer** (`src/lib/event-layer.ts:74`, a `public` event shows in every team
  view an admin opens) and the join button's affordance (`src/components/EventAttendancePanel.tsx:133-134`).
  The first is the admin's reach (ADR-076 decision 4); the second is MIR-15-d's question.
- **`supabase/tests/030-member-reads.test.sql:19-23`, `:40-44`** — two `todo()` tests for finding
  F-3 that this change may make pass. A passing `todo` does not fail the suite; removing them is
  MIR-15-d's or F-3's.
- **Any other notification kind** — invited, decided, edited, cancelled, join request, withdrawal.
  Each already goes to someone who can read the event (ADR-050), and decision 1 changes who that is.

## 2. Acceptance criteria

Throughout: **Org public** is the org with `is_shared_tenant = true`. **Team A** and **Team B** are
two teams of Org public. **Alice** is an approved member on Team A only, **Bob** an approved member on
Team B only, **Carol** an approved member on both Team A and Team B, and **Ada** an `admin` of Org
public on Team A. **Org D** is a dedicated org (`is_shared_tenant = false`) with teams **D1** and
**D2**; **Dan** is an approved member on D1 only, **Dee** on D2 only. All of AC-1 to AC-15 are observed
against the database, as the caller: "reads" means the row is returned by `select` on `public.event`
(what `listEvents()` and `getEvent(id)` issue) and `may_read_event` is true; "joins" is an insert
into `public.event_attendance` (what `joinEvent` issues); "the directory" is
`list_member_directory()` (what `listMemberDirectory()` calls). The mock answers the same ACs at
MIR-15-d.

**AC-1 — a public event in Org public is read by its own team**
- Given Alice has created an event with scope `public`, so its team is Team A
- When Carol and Ada each list events
- Then both read it

**AC-2 — and by nobody on another team only**
- Given the event of AC-1
- When Bob selects events, and selects that one by id
- Then neither returns it, and `may_read_event(event, Bob)` is false

**AC-3 — a public event in a dedicated org still reaches every team of that org**
- Given Dan has created an event with scope `public`
- When Dee lists events
- Then Dee reads it, as before this ticket

**AC-4 — joining follows reading in Org public**
- Given the event of AC-1, open for registration, with no capacity limit and approval off
- When Bob tries to join it
- Then the join is refused and no attendance row exists for Bob
- And when Carol joins it, the join succeeds

**AC-5 — and in a dedicated org it does not change**
- Given the event of AC-3, open, no capacity, approval off
- When Dee joins it
- Then the join succeeds

**AC-6 — a public event in Org public notifies only its own team**
- Given no notification exists for this event
- When Alice creates an event with scope `public`
- Then Carol and Ada each have exactly one `event_created` notification for it
- And Bob has none, and Alice (the actor) has none

**AC-7 — in a dedicated org it still notifies every team**
- When Dan creates an event with scope `public`
- Then Dee has exactly one `event_created` notification for it, and Dan has none

**AC-8 — the directory does not reach another team through a public event**
- Given Bob has created an event with scope `public` on Team B, and Alice shares no team, no other
  event and no notification with Bob
- When Alice reads the directory
- Then Bob is not in it

**AC-9 — nor through an attendee of one**
- Given an event with scope `public` whose team is Team B, which Bob attends, and Alice shares no
  team, no other event and no notification with Bob
- When Alice reads the directory
- Then Bob is not in it

**AC-10 — the directory still names the people of the caller's own teams**
- When Carol reads the directory
- Then it contains Alice and Bob, each with their team's name

**AC-11 — and still names the people a named invitation connects** (ADR-066 (c), unchanged)
- Given Bob has created an event with scope `named` naming Alice
- When Alice reads the directory
- Then Bob is in it

**AC-12 — the admin of Org public is unchanged** (ADR-076 decision 4)
- Given the event of AC-8
- When Ada lists events and reads the directory
- Then Ada reads the event and the directory contains Bob

**AC-13 — a dedicated org's directory still reaches through its public events**
- Given the event of AC-3, which Dan created, and Dee shares no team with Dan
- When Dee reads the directory
- Then Dan is in it

**AC-14 — an existing cross-team attendee keeps their place and loses the right to come back**
- Given an event with scope `public` on Team A that Bob was attending before the migration
- When Bob lists events
- Then Bob reads it
- And when Bob withdraws and then tries to join again, the second join is refused

**AC-15 — the stored scope is untouched**
- Given any event with scope `public` before the migration
- When the migration has run
- Then its `scope` is still `public`

**AC-16 — the editor no longer promises every team, in Org public**
- Given Alice opens the event editor
- When she looks at the `public` scope option
- Then its label or help text does not say the event reaches every team or every member of the
  deployment

**Invariants touched.** `[INV-04]`. **INV-04** — `list_member_directory()` reads `public.member`,
and INV-04's denominator is `listMembers()`; no select policy on `public.member` changes, so the
denominator is untouched (the same reasoning EVT-01 and EVT-02 recorded). No entry, portion, approval
or membership is read or written: INV-01, INV-02, INV-03, INV-05, INV-06 and INV-07 are not reached.

**Open questions.** None that block. Every narrowing is ADR-059 decision 2's, and the shape is
ADR-076's (*Delegated decisions*).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

**The layout is unchanged; only two strings move.** The scope picker in the event editor
(`src/routes/EventEditor.tsx:72-76`) and the scope badge on the events list (`src/routes/Events.tsx:22-26`)
keep their order, colours and test ids. The third choice's label becomes `Public` in both places, and
its hint in the editor becomes `Your whole organisation — or only your team, on the shared space`.
The member app does not know whether its org is shared (no seam read carries `is_shared_tenant`), so
the hint is written to be true in both kinds of org rather than switched on a flag nobody can read.
The other two choices, `Own team` and `Limited people`, are not touched.

## 3. Permission model

Every check is on the server side of the boundary, in the policy or `security definer` function
named. The two strings of § 2b are an affordance only.

| Action | Member, Org public, event on own team | Member, Org public, event on another team only | Admin of Org public | Member, dedicated org |
|---|---|---|---|---|
| Read a `public` event — `event_select_visible`, `may_read_event` | ✅ | ❌ unless creator, named invitee or participant | ✅ any in the org (unchanged) | ✅ any in the org (unchanged) |
| Join a `public` event — `event_attendance_insert_own`, `event_attendance_guard` via `is_event_audience` | ✅ | ❌ | ❌ as audience (unchanged: no admin clause, EVT-02 AC-11) unless on its team | ✅ any in the org (unchanged) |
| Receive `event_created` for a `public` event — `notify_event_created` | ✅ | ❌ | ✅ only when on its team | ✅ any in the org (unchanged) |
| See a member in the directory through a `public` event they created or attend — `list_member_directory` (c), (d) | ✅ (already by (b)) | ❌ | ✅ by (a), unchanged | ✅ (unchanged) |
| See a member through a named invitation or a notification — (c), (e) | ✅ | ✅ unchanged (ADR-076 decision 3) | ✅ | ✅ |
| Learn whether an org is shared — `org_is_shared(uuid)` | callable by `authenticated`, returns one boolean for an org id; `anon` ❌ | same | same | same |

**Denials the tests must assert** (each is an AC): AC-2 (read), AC-4 (join), AC-6 (notified), AC-8
and AC-9 (directory), AC-14 (re-join). And the three non-changes, so the fence is not drawn too wide:
AC-3, AC-5, AC-7, AC-13 (dedicated org), AC-11 (named), AC-12 (admin).

`org_is_shared` reveals no row: `public.org` stays closed to `authenticated`
(`supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql:97-98`). Given an org id a
caller does not already hold, it answers `false` exactly as it does for a dedicated org, and org ids
reach a member only on their own rows.

## 4. Contract

### 4.1 Migration `supabase/migrations/20261105180000_mir15_org_public_team_bound.sql`

Idempotent (ADR-024): `create or replace` throughout, `drop policy if exists` before the one policy.
Bodies are MIR-13-b's, each with **one** disjunct changed; every line not shown is kept verbatim.

```sql
-- 1. The one predicate (ADR-076 decision 5). Definer: `authenticated` holds no grant on public.org.
create or replace function public.org_is_shared(p_org_id uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select coalesce((select o.is_shared_tenant from public.org o where o.id = p_org_id), false);
$$;
revoke all on function public.org_is_shared(uuid) from public, anon;
grant execute on function public.org_is_shared(uuid) to authenticated;

-- 2. The public disjunct, in all three readers (may_read_event, the policy event_select_visible,
--    is_event_audience). Replaces `e.scope = 'public'::public.event_scope` (or `scope = …` in the
--    policy) and nothing else:
--       (e.scope = 'public'::public.event_scope
--        and (not public.org_is_shared(e.org_id)
--             or e.team_id in (select public.member_team_ids(p_uid))))
--    In the policy, `e.` is dropped and `p_uid` is `(select auth.uid())`.

-- 3. notify_event_created: the recipient predicate becomes
--       and ((new.scope = 'public'::public.event_scope and not public.org_is_shared(new.org_id))
--            or new.team_id in (select public.member_team_ids(m.id)))
--    Everything else in MIR-13-b's body (20261103180000:166-187) is unchanged, including the early
--    return for `named` and `public.notify`'s own exclusion of the actor.
```

`list_member_directory()` is **not** redefined: it reads `may_read_event`, which § 4.1 item 2
changes (ADR-076 decision 3). `save_event`, `invite_to_event`, `may_manage_event` and
`is_event_participant` are not redefined.

### 4.2 pgTAP `supabase/tests/210-org-public-team-bound.test.sql`

One file, one `plan(n)`, seeded by `tests.seed()` (whose org is Org public). It creates Org D with D1
and D2, Dan and Dee, as `160-read-path-org-bound.test.sql:42-…` creates Org B. One assertion per AC
that SQL can observe — AC-1 to AC-15 — plus:

- `org_is_shared` is `false` for Org D, `true` for Org public, `false` for a random uuid;
- `anon` lacks `EXECUTE` on `public.org_is_shared(uuid)`.

### 4.3 Census — `supabase/tests/010-catalogue.test.sql`

`public.org_is_shared(uuid)` is a new `security definer` function in `public`; it is added to the
AC-12 census with this file named as the suite that classifies it, the way MIR-18-b added its three.

### 4.4 Mock seam — not this ticket

`src/lib/data/mock.ts` is not changed here; the three edits are written into MIR-15-d's
`mir_detail`. Every vitest and e2e test that runs against the mock therefore passes unchanged, except
the two label assertions of § 4.6.

### 4.5 Screens

`src/routes/EventEditor.tsx:75` becomes
`{ scope: "public", label: "Public", hint: "Your whole organisation — or only your team, on the shared space" },`.
`src/routes/Events.tsx:25` becomes `public: "Public",`, and the comment on line 28 says `Public peach`.

### 4.6 Tests changed here

- `supabase/tests/160-read-path-org-bound.test.sql:178-186` — its AC-6 `set_eq` expects
  `event_created` for Org A's public event to reach every approved member of Org A, team_u included.
  It now expects the event's team only. `:138` and `:159` keep passing only because K holds an active
  membership on team_u (`:64-65`); a comment saying so is added beside each.
- `tests/e2e/evt-01-events.spec.ts:117`, `:174` — `toHaveText("Every team")` becomes
  `toHaveText("Public")`.
- `supabase/tests/010-catalogue.test.sql` — the census, § 4.3.

## 5. Seam impact

None. No `DataSeam` function is added, removed or re-shaped; `listEvents`, `getEvent`, `joinEvent`,
`listMemberDirectory` and `listNotifications` keep their signatures and return types. **The mock is
looser than SQL on this one predicate until MIR-15-d ships** (MIR-07's direction is that it never
be), recorded in ADR-076 decision 6 as the price of the split.

## 6. Schema delta

**Not `none`** (ADR-014): the policy `event_select_visible` is replaced, the definer functions
`may_read_event`, `is_event_audience` and the trigger function `notify_event_created` are replaced,
and the definer function `org_is_shared(uuid)` is added. No table, column, constraint or index
changes, and no row is updated. **ADR-076**, accepted under ADR-067 at this PLAN. Applying it to the
hosted project is human-only (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-076-in-org-public-a-public-event-is-a-team-event-and-the-directory-reaches-no-other-team-through-it.md"
  - ".ai/board/tickets/MIR-15-b/ticket.yaml"
  - ".ai/board/tickets/MIR-15-c/ticket.yaml"
  - ".ai/board/tickets/MIR-15-d/ticket.yaml"
  - "supabase/migrations/20261105180000_mir15_org_public_team_bound.sql"
  - "supabase/tests/210-org-public-team-bound.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "supabase/tests/160-read-path-org-bound.test.sql"
  - "src/routes/EventEditor.tsx"
  - "src/routes/Events.tsx"
  - "tests/e2e/evt-01-events.spec.ts"
```

`size: M` — 11 paths. `glossary_owed` is `[]`; *Org public* already says what this ticket does
(`.ai/registry/glossary.md:64`), so no row is written.

**`size_estimate` and `size` agree at M, but only after a second split.** As first drawn — the mock
and its tests in this ticket — the census found 26 failing test blocks across 12 more files, which is
L. The fence cannot split by operation (a read fenced without the join lets a member join an event
they cannot read), so it splits by surface: database and label here, mock and seam tests in MIR-15-d
(12 paths by its own count).

## 8. Rejected alternatives

- **Rewrite every `public` event in Org public to `team`, and refuse `public` at save there.** One
  `update` and one check in `save_event`, and the three readers would need no change at all. Rejected:
  it destroys the creator's choice irreversibly, breaks EVT-06/EVT-08's public branch on those events
  (guest link, email invitations key on `scope = 'public'`), and a team moved to a dedicated org by
  MIR-15-c would arrive with every public event demoted. ADR-076 *Options considered*.
- **Strip the directory to own teams only in Org public — disjuncts (a) and (b), nothing through
  events.** The literal reading of plan:207 and the glossary's *"stays within a single team"*.
  Rejected: named invitations still cross teams (operator, EVT-01 Q5), so the invitee would read an
  event whose creator has no name and the creator an attendee list with a nameless row. Fencing the
  `public` disjunct closes the reach the audit found (A:394, A:423, A:431) without that.
- **Carry `is_shared_tenant` to the member app and switch the editor's wording on it.** Rejected for
  this ticket: a new seam read in both implementations, a parity case and a type, to choose between
  two strings, while no dedicated org has a member yet (MIR-15-c is what puts one there). The neutral
  hint of § 2b is true in both.

## Changelog

- `2026-11-05T05:19:00Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  written before the source tree was read for 3–8.
- `2026-11-05` — § 1, § 2 preamble and AC-2, § 4.4, § 4.6, § 5, § 7: the mock and its tests moved to
  MIR-15-d after the test census put the ticket at L. The ACs' meaning is unchanged; their
  observation point is now named as the database. Raised by `tech-lead-design`. Amended by
  `tech-lead-design`.

## Delegated decisions

- **ADR-076** — in Org public a `public` event reaches only its own team, its notification follows
  it, the directory is fenced through `may_read_event` rather than stripped, the admin disjunct is
  unchanged, and MIR-15 splits into MIR-15 (database and label), MIR-15-d (mock and seam tests),
  MIR-15-b (holidays) and MIR-15-c (move a team). Narrows
  ADR-045 decision 3 and ADR-066 decision 2 inside Org public only, under ADR-059 decision 2.
