---
ticket: ADM-01
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-05T00:03:06+07:00
supersedes: 2026-09-03T10:29:17+07:00 (the BLOCKED first pass; its Changelog entries are kept below)
inputs_read:
  - .ai/board/tickets/ADM-01/ticket.yaml
  - .ai/board/tickets/ADM-01/01-plan.md (the 2026-09-03 BLOCKED pass)
  - .ai/board/tickets/CAL-04/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-020-the-admin-write-path-on-member.md
  - .ai/registry/decisions/ADR-026-db-sql-carries-the-target-schema.md
  - .ai/registry/decisions/ADR-027-the-datastore-becomes-sqlite-behind-a-written-server.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/board/backlog.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260901120000_tea04_member_writes.sql
  - supabase/migrations/20260904100000_cal04_team_select.sql
  - supabase/db.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/Home.tsx
  - src/routes/AllowList.tsx
  - src/routes/TeamEntries.tsx
  - src/routes/MonthView.tsx
  - src/App.tsx
  - tests/e2e/cal-03-admin-edit-entry.spec.ts
  - tests/e2e/seam.setup.ts
  - tests/seam-parity.test.ts
  - tests/absence.test.ts
  - ui-language.json
  - eslint.config.js
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# ADM-01 — Set the overload threshold

## 1. Problem and scope

**Feature ID: ADM-01.** Transcribed from `.ai/registry/features.md` without paraphrase:

> | ADM-01 | Set the overload threshold | ADM | PLANNED | [] |

An admin gains the ability to change the share of the team above which a date is called overloaded.
Today `team.overload_threshold` exists, is `numeric not null default 0.5`, and no human being can
change it — TEA-01 created the column and revoked every privilege on the table, so the default is
the only value the product will ever hold. That matters more than a settings screen usually would,
because the threshold is not a stored fact about any day: an overloaded day is a comparison
performed on read (`.ai/standards/data-model.md`, *What is deliberately not stored*), so changing
this one number silently reclassifies every date in the product, past and future, in both
directions. **Since CAL-04 shipped, that reclassification is visible** — `src/routes/MonthView.tsx`
reads the threshold and shades the crowded days with it — so this is the ticket that turns a
hard-coded 50% into a team's own number. It is the first row in the ADM group, so it also fixes the
shape the approval, holiday-calendar and remaining admin rows inherit.

**Out of scope.**

- **Any use of the threshold.** Nothing in this ticket compares a count to it, draws an overloaded
  day, or warns anybody. The absence count is CAL-04's single function (`src/lib/data/absence.ts`)
  and the warning is CAL-07; building either here would give INV-04 a second arithmetic, which the
  CAL-04 registry row names as the specific failure that would survive the seam-parity test.
- **The `team` select policy and its grant.** **CAL-04 shipped both** —
  `supabase/migrations/20260904100000_cal04_team_select.sql` carries
  `grant select on public.team to authenticated` and `create policy team_select_own`. This ticket
  adds the update half and nothing else, exactly as the CAL-04 registry row says
  (`.ai/registry/features.md:103`, *"ADM-01 owns the matching update privilege on that table and
  nothing else"*). This is what the 2026-09-03 pass was BLOCKED on; see the Changelog.
- **`getTeam()` on the seam.** Also CAL-04's, and already on all three implementations
  (`src/lib/data/index.ts:400`, `supabase.ts`, `mock.ts`). This ticket adds one function beside it.
- **A general admin settings area.** One screen, at its own address. The ADM-01 registry row leaves
  the choice open as a `TODO(project):` and recommends its own screen so that this row does not have
  to invent an admin area; that recommendation is taken, and Open question 1 records it as an
  assumption that ships rather than a decision made silently.
- **Renaming the team.** `team.name` is not writable by anybody after this ticket, and section 6
  explains that this is the whole reason the grant is column-level.
- **Any audit trail of the change.** `team` carries no `updated_by` and no `updated_at`, so v1
  records neither who moved the threshold nor when. This is known weakness 3 in
  `.ai/standards/rbac-and-security.md` and it is not closed here; adding the columns is a schema
  change nobody has asked for and would need its own row.
- **`supabase/db.sql`.** Not touched, on the CAL-04 precedent — CAL-04 shipped its policy without
  editing that file. Open question 4 records the drift this leaves and whose it is.

`size_estimate`: **M**.

## 2. Acceptance criteria

**AC-1 — an admin sees the value before changing it**
- Given a signed-in admin of a team whose `overload_threshold` is `0.5`
- When they open the threshold screen
- Then the screen shows the current threshold as `50%`, and the input is pre-filled with `50`.

**AC-2 — an admin changes the threshold**
- Given a signed-in admin on the threshold screen showing `50%`
- When they enter `60` and save
- Then the save succeeds, the screen reports that the threshold was saved, and the screen shows
  `60%`.

**AC-3 — the new value is read back from the datastore, not from the screen**
- Given an admin who has saved a threshold of `60%`
- When they leave the threshold screen and open it again
- Then it shows `60%`, fetched afresh, and nothing the previous screen held is the source of it.

**AC-4 — a member cannot reach the control**
- Given a signed-in member whose role is `member`
- When they open the threshold screen by typing its address
- Then no input and no save control is rendered, and the screen says the setting is for admins.

**AC-5 — a member's write is refused below the interface**
- Given a member whose role is `member`
- When `setOverloadThreshold` is called with that member as the caller, bypassing every interface
  control
- Then the threshold is unchanged and the caller is told the write was not permitted.

**AC-6 — a caller with no member row is refused and told nothing**
- Given a signed-in caller who has no member row, and a caller with no session
- When the threshold screen's address is opened
- Then no threshold value is shown, and nothing on screen reveals whether a team exists or what its
  threshold is.

**AC-7 — the threshold is bounded**
- Given a signed-in admin on the threshold screen
- When they enter a value below `0` or above `100`
- Then the save is refused before any write is issued, the screen says the permitted range is `0%`
  to `100%` inclusive, and the stored value is unchanged.

**AC-8 — a non-numeric, empty or fractional value is refused**
- Given a signed-in admin on the threshold screen
- When they clear the input, enter text that is not a number, or enter `60.5`
- Then the save is refused before any write is issued, the screen says a whole percentage is
  required, and the stored value is unchanged.

**AC-9 — the write reaches no other column of the team row**
- Given a signed-in admin whose team is named `CaleChip`
- When they save a new threshold
- Then the threshold changes and the team's name is unchanged; `setOverloadThreshold` carries no
  other field, and in the datastore the privilege to write any other column is held by nobody.

**AC-10 — the link is shown to an admin and to nobody else**
- Given the landing screen
- When it is rendered for an admin, then for a member, then for somebody with no member row
- Then the link to the threshold screen appears in the first case only.

**AC-11 — nothing is blocked by this setting**
- Given any threshold value, including `0%` and `100%`
- When any other screen in the product is used
- Then no action anywhere is refused, delayed or warned about because of the threshold. Charter
  refusal 6 governs what the threshold *does*; this row only sets it.

**AC-12 — saving the same value again is not an error**
- Given an admin on the threshold screen showing `60%`
- When they save `60` without changing it
- Then the save succeeds and the value remains `60%`.

**AC-13 — the new threshold reclassifies the days already on screen**
- Given an admin who has saved a threshold of `60%`
- When they open the month view
- Then it states that a day is crowded above `60%` of the team, and the days it shades as crowded
  are those above the new share and not the old one.

**AC-14 — a removed member is refused**
- Given a caller whose member row carries a `removedAt`
- When `setOverloadThreshold` is called with that caller
- Then the threshold is unchanged and the caller is told the write was not permitted, whatever role
  their row records.

**Invariants touched: `[]`.**

Written explicitly rather than left absent, and the reason is recorded rather than left to read as
an oversight. Setting the threshold changes what is *called* overloaded; it touches no entry, writes
no count and reads none. `.ai/registry/invariants.md:178` records **"The threshold is 50%"** under
*Considered and rejected as an invariant* — "configurable by an admin, therefore not an invariant" —
so the field this ticket makes writable is the one the invariant register already declined to
constrain. INV-04 is deliberately absent for the same reason it is absent from CAL-08 and ADM-05: a
row that changes what a comparison yields, while computing no comparison, cannot produce a second
definition of anything. AC-13 asserts the effect on CAL-04's comparison and adds no second copy of
it — the arithmetic stays in `src/lib/data/absence.ts`, which this ticket does not open.

**Open questions.** None blocking. The 2026-09-03 pass's blocking question is answered and closed;
see the Changelog.

1. **Assumption that ships — the surface is its own screen at `/threshold`.** The ADM-01 registry
   row leaves this open as a `TODO(project):` and recommends its own screen; the recommendation is
   taken so this row does not have to invent an admin settings area, and ADM-02, ADM-03 and ADM-04
   inherit the answer. Reversing it later moves one route and one link.
2. **Assumption that ships — the permitted range is `0` to `100` inclusive, in whole percentage
   points.** The registry row records the range and granularity as unstated in the brief, the
   charter and the glossary, and says the input needs bounds. `0` and `100` are both admitted rather
   than excluded, because both are meaningful against the glossary's strictly-greater comparison —
   at `0%` any day with one absence is crowded and an empty day is not, at `100%` no day ever is,
   and neither is a degenerate state the product must refuse. Whole percentage points, because the
   screen speaks in percent and a half-point of a team of six is not a distinction anybody can act
   on. AC-7 and AC-8 are written against this and are the two criteria to revisit if the operator
   answers differently.
3. **Not blocking, and not this ticket's to answer.** The change has no audit trail, per Out of
   scope. Recorded here so that a reader of ADM-05 — which does get `approved_by` and `approved_at`
   — does not conclude that `team` was considered and found not to need them.
4. **Not blocking, and outside this ticket — `supabase/db.sql` is already stale.** Its § 9.1 says
   `public.team` has no select policy and no select grant, owned by CAL-04; CAL-04 shipped both on
   2026-09-04 and did not edit that file. § 9.2 describes this ticket's gap and says *the ticket is
   blocked*, which stops being true at this gate. ADR-026 assigns no ticket the job of keeping the
   file current, so both lines will stay wrong until somebody is given it. Named here because
   ADR-026 decision point 4 exists so that the operator does not discover the schema from behaviour,
   and a stale § 9 is that protection failing quietly. Not fixed here: `db.sql` is deliberately out
   of `allowed_paths` (section 7).
5. **Not blocking, an observation.** `supabase/migrations/20260831150024_tea01_membership.sql:150`
   says a read path is *"exercised by tests/permission-model.test.ts"*. That file does not exist and
   never has. The 2026-09-03 pass listed it in `allowed_paths` on the strength of that comment; this
   pass does not, and names `tests/threshold.test.ts` instead (section 7).

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

Checked before writing: `.ai/board/tickets/ADM-01/design/` does not exist, no image is attached
anywhere under `.ai/board/`, and the idea this row was promoted from
(`.ai/board/ideas/2026-08-31-a-crowded-day-is-discovered-too-late.md`) carries none. So the
arrangement in AC-1 to AC-10 above and in section 4.3 below is originated here, and it is cheap to
argue with: it borrows its shape wholesale from `src/routes/AllowList.tsx`, which is the nearest
thing the product has to an admin write screen.

## 3. Permission model

Against `.ai/standards/rbac-and-security.md`. Two rows, both already in that table and both
operator-decided; this ticket invents no permission.

| Permission | member | admin | Where it is enforced |
|---|---|---|---|
| `Read the overload threshold` (line 47) | ✅ | ✅ | `team_select_own` and `grant select on public.team` — **shipped by CAL-04**, not by this ticket |
| `Set the overload threshold` (line 48) | ❌ | ✅ | `team_update_admin`, plus `grant update (overload_threshold) on public.team` — this ticket |

**The denials, stated as denials.**

- A member may not write `overload_threshold`. Enforced by `team_update_admin`, whose `using` and
  `with check` both require `public.is_admin((select auth.uid()))`. AC-5.
- Nobody — member or admin — may write `team.name`, `team.id` or `team.created_at`. There is no
  permission row anywhere for renaming the team, and this is the finding the ADM-01 registry row
  calls the one that makes this ticket bigger than it looks: **an RLS `UPDATE` policy is row-level,
  so it admits every column of any row it admits.** A policy alone would turn *set the threshold*
  into *edit the team row*. The control that actually withholds `name` is the column-level grant in
  section 6, and it is uniform across roles precisely because nobody may rename the team. TEA-04's
  `grant update (role, removed_at) on public.member` is the same shape, and the ADM-05 row in
  `.ai/registry/features.md` contrasts the two: a column grant works here and cannot work for
  `entry.status`, because there `member` and `admin` are the same PostgreSQL role and revoking the
  column would block the admin too. AC-9.
- Nobody may write another team's row. `team_update_admin` is scoped by
  `public.member_team_id((select auth.uid()))`, which is `security definer` and already granted to
  `authenticated` by TEA-01 at `supabase/migrations/20260831150024_tea01_membership.sql:71`.
- A removed member writes nothing, whatever their `role` says. Both helpers filter
  `removed_at is null` in their own bodies (`tea01_membership.sql:54-69`), so a removed caller
  resolves to `is_admin = false` and `member_team_id = null`; `id = null` is never true. AC-14. This
  is inherited from the helpers rather than restated in the policy, exactly as CAL-04's migration
  records for the select half.
- A caller with no session reads nothing and writes nothing. `anon` is granted nothing on `team` by
  TEA-01's revoke and stays that way; the policy below is written `to authenticated`, never
  `to public`, per the note TEA-03's migration carries at
  `supabase/migrations/20260901093000_tea03_member_select_team.sql:27`. AC-6.

**Where the check runs.** On the server side of the boundary, always. Under ADR-005 the browser
speaks to PostgREST directly, so the policy and the grant *are* the control and there is nothing
behind them. The role test on the screen — AC-4 and AC-10, hiding the input and the link from a
member — is an affordance only, and AC-5 exists precisely to prove that removing the affordance
changes nothing: it calls the seam function with a member as the caller, past every control the
interface holds.

## 4. Contract

### 4.1 The seam

One function added. `getTeam()` and the `Team` type already exist and are unchanged — CAL-04 shipped
both, and `src/lib/data/index.ts:400` carries an explicit instruction on `getTeam` that this section
obeys: *"IT CARRIES NO WRITE HALF AND MUST NOT GROW ONE."* The write is a separate function.

```ts
// src/lib/data/index.ts — new input type, beside the existing SignUpInput / SignInInput /
// CreateEntryInput / UpdateEntryInput.

export interface SetOverloadThresholdInput {
  /**
   * A FRACTION in [0, 1] inclusive, never a percentage. `Team.overloadThreshold` is a share
   * (glossary, *Threshold*) and `src/lib/data/absence.ts` compares against a share; the screen is
   * the one edge that speaks percent and it converts there. Two representations of one number on
   * the seam is how a factor of one hundred gets applied twice.
   */
  overloadThreshold: number;
}
```

```ts
// src/lib/data/index.ts — added to `interface DataSeam`, immediately after `getTeam()`.

/**
 * ADM-01 AC-2, AC-5, AC-9, AC-12, AC-14. Sets the caller's OWN team's threshold. Admin only; the
 * policy is the control and this function is the affordance.
 *
 * TAKES NO TEAM PARAMETER, for the reason `getTeam()` already records: `team_update_admin` resolves
 * the row from `auth.uid()`, and a `teamId` argument would be a value the CALLER supplies, which is
 * the shape `addAllowedEmail` and `listMembers` both refused.
 *
 * IT CARRIES NO OTHER COLUMN, and that is a contract and not an omission. There is no shape in
 * which a caller could send `name` and have it reach the datastore (AC-9). The column grant in
 * section 6 is what makes the same thing true one layer down.
 *
 * Returns the updated row. The `.select()` in the real implementation is NOT a convenience: under
 * row-level security a refused UPDATE is FILTERED, not errored — it matches nothing and PostgREST
 * answers 200 with an empty body, which `removeMember` and `promoteMember` already document at
 * src/lib/data/supabase.ts. Zero rows returned is a refusal and maps to `not_permitted`; treating
 * `!error` as success would report a refusal as done. This is the one behaviour in this contract a
 * developer will get wrong in good faith, and AC-5 is the test that catches it.
 */
setOverloadThreshold(input: SetOverloadThresholdInput): Promise<Result<Team>>;
```

**No new domain type.** `Team` is already in `src/lib/domain/types.ts:225` with `id`, `name`,
`overloadThreshold` and `createdAt`. `src/lib/domain/types.ts` is therefore NOT in `allowed_paths`.

**No new `FailureCode`.** `not_permitted` already exists and is what `removeMember` and
`promoteMember` — the other two admin-only writes — return, each with its own message written at its
own call site. CAL-01 added `entry_not_permitted` rather than reuse it, and the reason it gave does
not apply here: that reason was a shared constant message about the allow-list, and these messages
are per-call-site strings. `network` and `unknown` carry the rest.

**New messages are in English.** `src/lib/data/mock.ts` and `src/lib/data/supabase.ts` are on the
`copyDebt` ratchet in `ui-language.json`, so a Vietnamese string added there would pass the lint
rule — and the ratchet *only shrinks* (`eslint.config.js:36-39`). `src/routes/Threshold.tsx` is new
and not on that list, so its copy must be English or lint fails. A Vietnamese seam message rendered
by an English screen is the mismatch this paragraph exists to prevent. OPS-002 owns translating what
is already there; this ticket adds no new debt to it.

### 4.2 The datastore call, exactly

```ts
// src/lib/data/supabase.ts
const { data, error } = await client()
  .from("team")
  .update({ overload_threshold: input.overloadThreshold })
  .select(TEAM_COLUMNS)
  .returns<TeamRow[]>();
```

**No `.eq("id", …)`.** `team_update_admin`'s `using` clause resolves the row from the caller, and a
client-supplied id would be the parameter section 4.1 refuses. This matches `getTeam()`, which
issues no filter either.

**`.returns<TeamRow[]>()` and not `.maybeSingle()`.** A refused update returns zero rows, and
`maybeSingle()` on zero rows is `data: null` with no error — indistinguishable from the shape a
successful update of a row that no longer exists would produce. `promoteMember` in
`src/lib/data/supabase.ts` already uses the array form for exactly this and is the shape to copy.

### 4.3 The screen

`/threshold`, one card in the shape `src/routes/AllowList.tsx` already uses
(`mx-auto max-w-md rounded-2xl bg-white p-8 shadow-sm`). Four phases, mirroring that file's `View`
union: `loading`, `refused`, `ready`, and an `unavailable` phase for a failed read, which
`TeamEntries.tsx` also carries.

Elements in order, with their selectors — `data-testid`, per
`.ai/standards/testing-standards.md` § *The selector contract*:

| Order | Element | `data-testid` | Shown when |
|---|---|---|---|
| — | loading notice | `threshold-loading` | the read is in flight (AC-1) |
| — | refusal notice | `threshold-refused` | the caller is a member, has no member row, or has no session (AC-4, AC-6) |
| — | read-failure notice, `role="alert"` | `threshold-unavailable` | `getTeam()` threw |
| 1 | heading | — | ready |
| 2 | one sentence: what a crowded day is, and that nothing is ever blocked by it (AC-11) | — | ready |
| 3 | the current value, rendered as whole percent | `threshold-current` | ready |
| 4 | number input, labelled, pre-filled with the current whole percent | `threshold-input` | ready, admin |
| 5 | validation message, `role="alert"` | `threshold-input-error` | AC-7, AC-8 |
| 6 | save control | `threshold-save` | ready, admin |
| 7 | success notice, `role="status"` | `threshold-saved` | AC-2, AC-12 |
| 8 | write-failure notice, `role="alert"` | `threshold-error` | AC-5's refusal reaching a screen |
| 9 | link back to the landing screen | `threshold-back` | ready |

`threshold-current` carries `data-threshold` with the FRACTION, the way
`src/routes/MonthView.tsx:341` already exposes `data-threshold` — so a test asserts the stored share
rather than parsing rendered copy.

**Validation happens before the call, not after it (AC-7, AC-8).** The screen holds the input as a
string, and a value that is not a whole integer in `[0, 100]` issues nothing — it renders
`threshold-input-error` and returns. There is no `check` constraint behind this and section 6 says
why.

**The link on the landing screen.** One `<Link>` in `src/routes/Home.tsx`, under
`member.role === "admin"`, beside `home-allow-list-link` and `home-team-entries-link` — the same
one-link edit CAL-05 and CAL-06 each made to that file. `data-testid="home-threshold-link"`. AC-10.

**The route in `src/App.tsx`.** `<Route path="/threshold" element={…} />`, **guarded on
`membership.state === "member"`** and not on the role — the same choice `/entries/team` records: a
member who types the address must reach the component and be refused BY IT (`threshold-refused`,
AC-4) rather than be bounced to `/`, because the refusal is what says why. A caller with no session
or no member row lands on `/`, which resolves by membership. The guard is an affordance either way;
`team_update_admin` is the control.

## 5. Seam impact

One function added: `setOverloadThreshold(input)`. It appears in `src/lib/data/index.ts`,
`src/lib/data/supabase.ts` and `src/lib/data/mock.ts` with the same name and the same arity, or
`tests/seam-parity.test.ts` fails. That test is deliberately **not** in `allowed_paths`: it must
pass unedited with the function added, which is the property that makes it worth having.

**No pure module and no shared arithmetic.** The percent-to-fraction conversion lives in the screen,
which is the one edge that speaks percent (section 4.1). Putting it in `src/lib/` would create a
second place that knows the representation, and the seam already declares the fraction form in a doc
comment where a developer will meet it.

`mock.ts` holds `const teams: Team[] = [{ ...FIXTURE_TEAM }, { ...FIXTURE_OTHER_TEAM }]` at
`src/lib/data/mock.ts:110` — already mutable objects, so the write is an assignment and no fixture
changes. `src/lib/fixtures.ts` is therefore not in `allowed_paths`; `FIXTURE_TEAM.overloadThreshold`
is already `0.5` at `src/lib/fixtures.ts:24`.

**The mock must refuse exactly as the policy does**, using the existing `currentAdmin()` helper at
`src/lib/data/mock.ts:253` — which already filters `removedAt === null` and `role === "admin"`, so
AC-14 is inherited rather than written twice. It returns `refused("not_permitted", …)` rather than
throwing. The acceptance suite drives the mock (BUG-001 pinned it, `tests/e2e/seam.setup.ts`), so a
mock that is permissive where the policy is not would make AC-4, AC-5 and AC-10 pass against
nothing.

**The mock writes the caller's OWN team only** — resolved through `memberTeamId(currentMemberId)`,
the same way `getTeam()` does in that file — so `FIXTURE_OTHER_TEAM` is untouched by any caller on
the first team.

## 6. Schema delta

**NOT `none`** — ADR-014, no carve-out, and CAL-04 applied the same reading to a select-only
migration one day earlier. `ticket.yaml` shipped from the template with `schema_delta: none` and
`requires_adr: false`; the ADM-01 registry row's closing sentence says `schema_delta` none because
"`team` and `overload_threshold` are created by TEA-01's migration". That is true of the **column**
and does not settle the **privileges**, which the same row requires two sentences earlier. Both
fields were corrected in `ticket.yaml` by the 2026-09-03 pass and stay corrected.

One new migration, `supabase/migrations/20260905000000_adm01_team_threshold.sql`. It alters no
table, adds no column, creates no function and drops nothing.

```sql
-- ADM-01. The admin write path on `public.team`, and nothing else.
-- Applying this file is human (RULE-09). No agent runs `supabase db push`.
--
-- The SELECT half is NOT here: CAL-04 shipped `grant select on public.team` and `team_select_own`
-- in 20260904100000_cal04_team_select.sql, which is what .ai/registry/features.md:103 assigns it.
-- This file is the "matching update privilege on that table and nothing else" the same row gives
-- ADM-01.
--
-- ADR-005 puts the check here rather than in the interface; ADR-014 is why this is not
-- `schema_delta: none`. Both LINKED, not authored: this creates no table, no column and no
-- constraint. ADR-020 half two is the SHAPE precedent — a column-level update grant beside an
-- admin-scoped update policy — but it is about `public.member` and is cited, not extended.
--
-- `public.is_admin(uuid)` and `public.member_team_id(uuid)` already exist from
-- 20260831150024_tea01_membership.sql, are both `security definer`, and are ALREADY granted to
-- `authenticated` at that file's line 71. A second grant here is the redundant-grant trap: it reads
-- as a control and is not one.
--
-- Both helpers filter `removed_at is null` inside their own bodies, so a removed caller resolves to
-- `is_admin = false` and `member_team_id = null`, and `id = null` is never true. That is where
-- AC-14 comes from; restating it in the predicate would be a second copy of the same rule.

-- THE COLUMN GRANT IS THE CONTROL, not the policy. An RLS UPDATE policy is row-level and admits
-- EVERY COLUMN of a row it admits, so `team_update_admin` alone would let any admin rewrite
-- `team.name` — for which no permission row exists anywhere. TEA-01 revoked all on `public.team`
-- from `anon` and `authenticated` at 20260831150024_tea01_membership.sql:145, so nothing is
-- inherited and both statements below are required. Same shape as TEA-04's
-- `grant update (role, removed_at) on public.member`, and it works here for the reason it cannot
-- work on `entry.status`: nobody may rename the team, so the privilege is uniform across roles.
--
-- This is deliberately a COLUMN list where CAL-04's `grant select` is the whole table. The
-- asymmetry is not an inconsistency: a read of `team` is already scoped to the caller's own row by
-- the policy and every column of that row is theirs to see, whereas a write of `name` is refused to
-- everybody and only a column list can express that.
grant update (overload_threshold) on public.team to authenticated;

-- AC-2, AC-5, AC-9, AC-12, AC-14. `to authenticated`, never `to public`: a policy written
-- `to public` re-opens the table to the anon key, which ships in the browser bundle by design
-- (rbac-and-security.md, "Secrets").
--
-- `(select auth.uid())` and not bare `auth.uid()` — the idiom every policy in this project already
-- uses (tea01:162, tea02:29, tea03:36, tea04:45, cal01:206, cal03:83, cal04:38).
--
-- BOTH `using` AND `with check`, and they are identical. `using` decides which row may be updated;
-- `with check` decides what the row may become. Here the column grant already withholds `id`, so
-- the pair cannot come apart — it is written out because the next admin write policy on this table
-- will be copied from this one and may not have that protection.
create policy team_update_admin on public.team
  for update to authenticated
  using      (id = public.member_team_id((select auth.uid()))
              and public.is_admin((select auth.uid())))
  with check (id = public.member_team_id((select auth.uid()))
              and public.is_admin((select auth.uid())));
```

**No trigger, and this is the difference from TEA-04.** ADR-020's write path on `member` needed
`member_enforce_role_and_removal()` because a `with check` sees the NEW row with no OLD and so
cannot say "this column did not change". Nothing here needs that sentence: there is exactly one
writable column, and every other column is withheld by the grant rather than guarded by a predicate.

**No `check` constraint on the column, and the range lives in the screen.** A `check` would be a
schema change to a table TEA-01 owns, and it would refuse with a raw `23514` that the seam would
then have to translate into a sentence. The permitted range is a product decision recorded as Open
question 2, not a datastore truth — the invariant register declined to constrain the threshold at
all. AC-7 and AC-8 are therefore screen-level criteria and say so.

**Applying the migration is human — RULE-09.**

`requires_adr`: **true**, and **no new ADR is authored** — **ADR-005 and ADR-014 are LINKED**. This
is the CAL-03 and CAL-04 precedent applied unchanged: a migration that creates a policy is not
`none`, and the decision it rests on has already been taken. The 2026-09-03 pass said an ADR was
owed to the operator, and the reason it gave was that the ADR would settle its blocking question — a
`features.md` ownership change, RULE-01 human-only. **That question is closed and no registry row
moves**, so the reason is gone with it. What remains is a policy predicate, which is what PLAN is
for and which CAL-04 designed for the select half at its own gate without an ADR.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/20260905000000_adm01_team_threshold.sql"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/routes/Threshold.tsx"
  - "src/routes/Home.tsx"
  - "src/App.tsx"
  - "tests/threshold.test.ts"
  - "tests/e2e/adm-01-threshold.spec.ts"
```

Nine globs, nine files, three of them new. `size`: **M**.

**`size_estimate` and `size` agree at M**, so ADR-012 is not engaged and nothing splits. The
estimate in section 1 was written before the file list; both were reached from the same fact, that
this is one screen, one migration and one seam function, and the thing that could have pushed it to
L — an admin settings area — was put out of scope in section 1 before the count was taken. The list
is **one path shorter than the 2026-09-03 pass's ten**, which is the whole visible effect of CAL-04
having shipped: see the Changelog.

**`tests/threshold.test.ts` is the unit test and it is new.** AC-5, AC-9 and AC-14 are refusals
below the interface, and the acceptance suite cannot reach them: it drives the browser and cannot
call a seam function with a chosen caller. This file imports `seam as mock` and `__setCurrentMember`
from `src/lib/data/mock` — the shape `tests/seam-parity.test.ts` already uses — and asserts the
refusals the policy makes. It is not named `tests/permission-model.test.ts`: that file is cited by a
comment in TEA-01's migration and has never existed (Open question 5), and creating it here would
mean adopting a scope nobody wrote.

**Deliberately absent, each for a reason:**

- `tests/seam-parity.test.ts` — must pass unedited with the function added (section 5).
- `src/lib/domain/types.ts` — `Team` already exists at line 225 and no `FailureCode` is added
  (section 4.1).
- `src/lib/fixtures.ts` — `FIXTURE_TEAM.overloadThreshold` is already `0.5` at line 24.
- `src/lib/data/absence.ts` — CAL-04's, and the single home of INV-04's arithmetic. AC-13 asserts
  its output changes and does not touch it.
- `src/routes/MonthView.tsx` — AC-13 is satisfied by the screen CAL-04 already shipped, which reads
  `team.overloadThreshold` at line 341. If it needed an edit to pass, AC-13 would be describing a
  CAL-04 defect and belongs on a bug ticket, not here.
- `supabase/db.sql` — Open question 4. Out of scope on the CAL-04 precedent.
- `playwright.config.ts` — the seam is pinned by BUG-001 and this ticket has no reason to touch it.
- `.ai/registry/**` — nothing here writes the registry, and this pass identifies no amendment it
  needs. `features.md` is correct exactly as written.

## 8. Rejected alternatives

**Rejected: take the select policy and grant here anyway, as the 2026-09-03 pass proposed.** That
pass wrote both statements into its migration and stopped on whether it was allowed to keep them. It
is now rejected on a fact rather than a judgement:
`supabase/migrations/20260904100000_cal04_team_select.sql` is merged, so a second
`create policy team_select_own` would fail on apply — which is precisely the collision the blocked
question was protecting against. It is recorded rather than silently dropped because the reasoning
that produced it was sound and the fact underneath it moved.

**Rejected: fold the read into the write and ship no separate screen state.** The screen would
render an empty input, the admin would type a number, and the save would return the updated row —
one seam call instead of two. Rejected on the count AC-1 makes: an admin who cannot see the current
value has no way to know whether they are changing it or confirming it, and AC-12 (saving the same
value) stops meaning anything. It was also the shape that made sense only while `team` was
unreadable, and it is not that any more.

**Rejected: a `security definer` function, `public.set_overload_threshold(numeric)`, with no policy
and no grant on the table.** It would carry the role test in its own body, need only `grant execute`,
and sidestep the column-grant subtlety in one move. Rejected because it moves the authorization out
of the place ADR-005 puts it — the whole decision of that ADR is that the policy is the control —
and because it would establish, on the first row of the ADM group, a second pattern for admin writes
one ticket after ADR-020 established the first. The next admin row would have to choose between
them, and the reason for the choice would be lost. The column-grant subtlety is not a cost to be
avoided; it is the finding, and it is written down.

**Rejected: store the threshold as whole percent in the datastore.** The screen speaks percent and
the column would then need no conversion. Rejected because `.ai/standards/data-model.md:27` fixes
the column as a share with default `0.5`, changing it is a migration on a shipped table, and
`src/lib/data/absence.ts` compares `count / currentMembers` against a share on both sides. The
conversion belongs at the one edge that speaks percent, which is the screen.

## Changelog

- `2026-09-03T10:29:17+07:00` — sections 1 through 8 written. Gate BLOCKED on Open question 1.
  Raised by `tech-lead-design`.
- `2026-09-03T10:29:17+07:00` — section 6 corrects `schema_delta` from `none` and `requires_adr`
  from `false` in `ticket.yaml`, per ADR-014. The ADM-01 row in `features.md` says `schema_delta`
  none in its closing sentence; that is true of the column and not of the policy and grant the same
  row requires. Raised by `tech-lead-design`. Not a registry edit — the correction is to
  `ticket.yaml`, and the registry row is left as a human's to amend.
- `2026-09-05T00:03:06+07:00` — **the blocking question is closed and the gate moves BLOCKED →
  PASS.** It asked whether ADM-01 ships the `team` select policy and grant. The answer is no, on two
  grounds that are now facts rather than judgements: the `orchestrator` recorded the decision in
  `ticket.yaml` on 2026-09-04 and added CAL-04 to `depends_on`, and CAL-04 then shipped both
  statements in `supabase/migrations/20260904100000_cal04_team_select.sql`, merged to `main`.
  `features.md` is unedited and no registry row moves. Raised by `tech-lead-design`.
- `2026-09-05T00:03:06+07:00` — sections 4, 5, 6 and 7 rewritten against the shipped tree rather
  than against the 2026-09-03 tree. `getTeam()` and the `Team` domain type were this plan's to
  create and are now CAL-04's, shipped; `src/lib/domain/types.ts` and one `allowed_paths` entry go
  with them, and the migration loses its select block. Raised by `tech-lead-design`.
- `2026-09-05T00:03:06+07:00` — **AC-3 amended, and the reason is recorded because reading the code
  is what changed it.** It read *"When the page is reloaded — Then the screen shows 60%, read from
  the datastore and not from anything held in the browser."* The acceptance suite is pinned to the
  in-memory seam (BUG-001, `tests/e2e/seam.setup.ts`) and a document load resets that seam's module
  state — `tests/e2e/cal-03-admin-edit-entry.spec.ts:78` records exactly this and walks the history
  instead. As written the criterion was unobservable in the only environment that runs it. It now
  says *leave the screen and open it again*, which asserts the same thing that matters — the value
  came back from the seam, not from what the screen was holding — and can actually be observed. The
  weaker half, survival across a browser reload, is a property of the real datastore that no test in
  this project exercises for any feature. Raised by `tech-lead-design`.
- `2026-09-05T00:03:06+07:00` — **AC-9 amended** from a datastore-only criterion (*an update naming
  `name` is refused*) to one that also states an observable consequence (*the team's name is
  unchanged after a save*). The original could only ever be checked against a live PostgreSQL
  instance, which RULE-09 keeps human and which no gate in this loop reaches. The column grant is
  still what enforces it, and sections 3 and 6 both say so. Raised by `tech-lead-design`.
- `2026-09-05T00:03:06+07:00` — **AC-13 and AC-14 added.** AC-13 asserts that the month view
  reclassifies its days after the threshold moves; it needs no code — `src/routes/MonthView.tsx:341`
  already reads the value — and it is the only place in this ticket where the registry row's
  sentence *"setting the threshold silently reclassifies every day in the product"* becomes
  observable. AC-14 states the removed-member refusal, which both policy helpers and the mock's
  `currentAdmin()` already produce and which no criterion named. Raised by `tech-lead-design`.
- `2026-09-05T00:03:06+07:00` — section 6 keeps `requires_adr: true` and now LINKS ADR-005 and
  ADR-014 instead of owing a new ADR to the operator. The debt existed because the ADR would have
  settled the blocking question; with that question closed by a merged migration, what is left is a
  policy predicate, which is PLAN's to design — the CAL-03 and CAL-04 precedent. Raised by
  `tech-lead-design`.
- `2026-09-05T00:03:06+07:00` — § 2b added. The section did not exist when this plan was first
  written; `.ai/standards/ui-design-system.md` § *Visual specification* was added on 2026-09-04. No
  image is attached at either stage, so the layout is marked as the Tech Lead's own. Raised by
  `tech-lead-design`.
