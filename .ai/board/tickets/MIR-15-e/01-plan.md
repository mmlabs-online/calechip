---
ticket: MIR-15-e
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-06T09:08:21Z
inputs_read:
  - .ai/board/tickets/MIR-15-e/ticket.yaml
  - .ai/board/tickets/MIR-15-b/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-079-org-public-holidays-are-written-through-four-system-admin-rpcs-and-each-org-reads-only-its-own.md
  - .ai/templates/plan.md
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261105180000_mir15_org_public_team_bound.sql
  - src/routes/Holidays.tsx
  - src/App.tsx
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - tests/holiday-writes.test.ts
  - tests/manager-role.test.ts
  - tests/seam-parity.test.ts
  - tests/e2e/adm-02-holidays.spec.ts
  - tests/e2e/adm-03-holiday-writes.spec.ts
  - tests/e2e/cal-08-holiday-shading.spec.ts
  - tests/e2e/mir-14-b-worklist-teams.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-15-e — the member app stops offering holiday edits in Org public, and the mock seam reproduces Org public's holiday policies

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:304`):

| ID | Feature | Group |
|---|---|---|
| MIR-15 | In Org public, the directory, public events and event notifications stay within the team, only system_admin sets its holidays, and a team can be moved to another org | MIR |

**ADR-079 decision 5, the half this ticket ships:** *"MIR-15-e ships the member app: the Holidays
screen stops offering add, edit and delete to an admin of Org public, the member mock seam follows
decisions 2 and 3, and the vitest and e2e files that assert an Org public admin writes holidays
change with it."*

**Who gains what.** Since MIR-15-b the database refuses every holiday write by an admin of Org public
and lets each caller read only their own org's rows; the member app still offers an Org public admin
Add, Edit and Delete, each of which then fails with a sentence ("Only an admin can …") that is false
for the person reading it, and still tells a caller with no org that a year simply has no holidays.
After this ticket an Org public admin is shown the calendar, no write control, and one line saying
who sets it; a dedicated org's admin keeps all three controls (ADR-079 decision 2); a caller with no
org is told why there is no calendar. The mock — which the whole e2e suite drives — stops being
looser than SQL on decisions 2 and 3, so a passing e2e run says something about Org public again.

`size_estimate: M` — one new member-seam read in its two implementations, one screen, one routing
comment, and four test files.

**Out of scope — and where each goes:**

- **Any SQL.** The policies and the four RPCs are MIR-15-b's and shipped. This ticket adds no
  migration and calls only two functions that already exist (`public.member_org_id`,
  `public.org_is_shared`).
- **The system panel's holiday screen and `SystemSeam`** (`src/system/main.tsx`,
  `src/lib/data/system.ts`) — MIR-15-b's, unchanged.
- **An org on `Member`.** `Member` gains no field; the screen learns the one fact it needs through a
  seam read (§ 8).
- **Org modelling in the mock beyond holidays.** The mock's org knowledge added here is read by the
  four holiday functions and the new read only. Directory, events and notifications in the mock stay
  as they are (MIR-15's other halves).
- **A fixture account in a dedicated org** (`src/lib/fixtures.ts`, `supabase/seed.sql`). Every
  fixture member stays in Org public, as MIR-12's backfill puts every real member. Tests reach the
  dedicated path through a mock-only test switch (§ 4.3).
- **`org_admin` taking the write in a dedicated org** — MIR-16.
- **Propagating Org public's changes into dedicated orgs** — undecided, `/idea` (ADR-079 decision 4).
- **`.ai/standards/rbac-and-security.md:66` and weakness A11** — standards edit, human-only.
- **`tests/manager-role.test.ts`** — its holiday assertion (`:291-300`) is that a manager's add is
  refused, which stays true; it does not change.

## 2. Acceptance criteria

Throughout: **Org public** is the org with `is_shared_tenant = true`; a **dedicated org** is any other.
**Quan** is an approved admin of Org public (`FIXTURE_ADMIN`). **Quan-D** is the same account placed
in a dedicated org by the test switch of § 4.3. **Thanh** is an approved member of Org public
(`FIXTURE_MEMBER`). **Hoa** is signed in with no member row (`FIXTURE_MEMBER_LESS`). AC-1 to AC-6 are
observed on the `/holidays/<year>` screen; AC-7 to AC-12 against the member seam.

**AC-1 — an admin of Org public is offered no holiday write**
- Given Quan is signed in
- When he opens `/holidays/2026`
- Then the year's rows are listed, and there is no *Add* form, no *Edit* and no *Delete* on any row

**AC-2 — and is told who sets the calendar**
- Given Quan is signed in
- When he opens `/holidays/2026`
- Then the screen shows `Org public's holiday calendar is set by a system admin.`

**AC-3 — an admin of a dedicated org keeps all three controls**
- Given Quan-D is signed in
- When he opens `/holidays/2028`, adds a day, edits it and deletes it through the confirmation
- Then each succeeds on screen as ADM-03 describes, and the `set by a system admin` line is not shown

**AC-4 — a member is still offered nothing, and sees no system-admin line**
- Given Thanh is signed in
- When he opens `/holidays/2026`
- Then the rows are listed, no write control is shown, and the `set by a system admin` line is not
  shown

**AC-5 — a caller with no org is told there is no calendar for them, not that a year is empty**
- Given Hoa is signed in
- When she opens `/holidays/2026`
- Then the screen shows `Your account is not in an organisation yet, so there is no holiday calendar
  to show.`, no row, no year switcher, and not the past-the-horizon notice (`holidays-beyond-calendar`)

**AC-6 — when whether the org is shared cannot be read, no write control is shown**
- Given an admin is signed in and the read of whether their org is shared fails
- When the screen loads
- Then the rows are listed, no write control is shown, and the `set by a system admin` line is not
  shown

**AC-7 — the mock refuses an Org public admin all three writes**
- Given the current member is Quan
- When `addHoliday`, `updateHoliday` on a stored Org public row, and `deleteHoliday` on it are called
- Then each returns `{ ok: false }` with code `not_permitted`, and Org public's rows are unchanged

**AC-8 — the mock lets a dedicated org's admin write that org's rows, and only them**
- Given the current member is Quan-D
- When he adds a day on 2028-04-30, edits it and deletes it
- Then each returns `{ ok: true }`, and Org public's rows are unchanged throughout
- And when he calls `updateHoliday` or `deleteHoliday` with the id of an Org public row, each returns
  `not_permitted` and that row is unchanged

**AC-9 — the mock's date uniqueness is per org**
- Given Org public has a row on a date, and the dedicated org has its copy of it
- When Quan-D adds a second row on that date
- Then it is refused with `holiday_date_taken`
- And when Quan-D adds a row on 2028-04-30, a date neither org holds, it succeeds and Org public
  still has no row on 2028-04-30

**AC-10 — the mock reads each caller only their own org's rows**
- Given Quan-D has added a row on 2028-04-30
- When Quan-D, and then Thanh, call `listHolidays` for 2028
- Then Quan-D's result contains that row and Thanh's does not

**AC-11 — the mock reads a caller with no org nothing**
- When `listHolidays` is called for 2026 with no current member, with a pending member, and with a
  removed member
- Then each returns `[]`

**AC-12 — the seam answers whether the caller's org is shared**
- When `isOwnOrgShared()` is called as Quan, as Quan-D, and with no current member
- Then it returns `true`, `false` and `false` respectively

**Invariants touched.** `[]`. A holiday is not an entry and carries no member or team; INV-01 to
INV-07 read none of it (ADM-02, ADM-03, MIR-15-b's reasoning, unchanged). No entry path is edited.

**Open questions.** None that block.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

On the existing `/holidays/<year>` screen, nothing moves. Two additions:

1. **The system-admin line** (AC-2): one muted line (`text-sm opacity-70`) directly under the year
   header, where the *Add* form sits for a writing admin — so an Org public admin sees the line in the
   place they would look for the control.
2. **The no-org notice** (AC-5): replaces the whole list, in the same centred card the
   `holidays-unavailable` notice uses, without `role="alert"` (it is a state, not a failure).

## 3. Permission model

The controls are the policies MIR-15-b shipped (`holiday_insert_admin`, `holiday_update_admin`,
`holiday_delete_admin` with `and not public.org_is_shared(org_id)`; `holiday_select_own_org`). Every
change here is an affordance or the mock's reproduction of those policies.

| Action | Admin, Org public | Admin, dedicated org | Member (either) | Pending / removed / no member row |
|---|---|---|---|---|
| See Add, Edit, Delete on `/holidays` | ❌ **new** (AC-1) | ✅ unchanged (AC-3) | ❌ (AC-4) | ❌ (AC-5) |
| Mock `addHoliday` / `updateHoliday` / `deleteHoliday` | ❌ `not_permitted` **new** (AC-7) | ✅ own org's rows only **new bound** (AC-8) | ❌ unchanged | ❌ unchanged |
| Mock `listHolidays` | own org (AC-10) | own org (AC-10) | own org | `[]` **new** (AC-11) |
| `isOwnOrgShared` | `true` | `false` | per org | `false` |

`isOwnOrgShared` is never a permission: a wrong `false` shows an Org public admin three controls the
database refuses; a failure fails closed (AC-6). The screen gate is
`me.role === "admin" && me.removedAt === null && orgShared === "no"` (§ 4.4).

## 4. Contract

### 4.1 Member seam — `src/lib/data/index.ts`

Added to `DataSeam` directly after `deleteHoliday` (`:1084`):

```ts
  /**
   * MIR-15-e. Whether the caller's org is Org public, the shared tenant: `public.member_org_id` for
   * the signed-in user, then `public.org_is_shared` on it. `false` when there is no session, no
   * member row, or the member is not approved or is removed — `member_org_id` is null for each and
   * `org_is_shared(null)` is false. An affordance for `/holidays` only (ADR-079 decision 2); the
   * write policies are the control. THROWS on any failure; the caller fails closed.
   */
  isOwnOrgShared(): Promise<boolean>;
```

### 4.2 Supabase — `src/lib/data/supabase.ts`

```ts
  async isOwnOrgShared(): Promise<boolean> {
    const { data: auth } = await client().auth.getUser();
    const uid = auth.user?.id;
    if (!uid) return false;

    const { data: orgId, error: orgError } = await client().rpc("member_org_id", { p_uid: uid });
    if (orgError) throw new Error(`isOwnOrgShared failed: ${orgError.message}`);
    if (orgId === null) return false;

    const { data: shared, error } = await client().rpc("org_is_shared", { p_org_id: orgId });
    if (error) throw new Error(`isOwnOrgShared failed: ${error.message}`);
    return shared === true;
  },
```

The three refusal sentences (`:1436-1438`) become, and `mock.ts:563-565` repeats them verbatim:

```ts
const HOLIDAY_ADD_REFUSED = "Only an admin can add to the holiday calendar, and in Org public only a system admin can.";
const HOLIDAY_UPDATE_REFUSED = "Only an admin can change the holiday calendar, and in Org public only a system admin can.";
const HOLIDAY_DELETE_REFUSED = "Only an admin can remove a day from the holiday calendar, and in Org public only a system admin can.";
```

The comment at `:2883` (`holiday_select_all` is `using (true)`) is rewritten to cite
`holiday_select_own_org` and ADR-079 decision 3. `listHolidays`, `addHoliday`, `updateHoliday`,
`deleteHoliday` bodies are unchanged.

### 4.3 Mock — `src/lib/data/mock.ts`

```ts
/** MIR-15-e. The two orgs the mock's holiday table knows. Internal; not exported. */
type MockOrg = "org_public" | "dedicated";

/** MIR-15-e. localStorage key: a JSON array of member ids placed in the dedicated org. Read once at
 *  module load, the way SESSION_STORAGE_KEY is, so an e2e spec sets it with `page.addInitScript`. */
const DEDICATED_ORG_STORAGE_KEY = "calechip.mock.dedicatedOrgMembers";

/** Member ids in the dedicated org. Every other member is in Org public (MIR-12's backfill). */
let dedicatedOrgMemberIds: Set<string>; // initialised from DEDICATED_ORG_STORAGE_KEY, else empty

/** `public.member_org_id` reproduced: null unless the member exists, is `approved` and not removed. */
const mockOrgOf = (memberId: string | null): MockOrg | null;

/** The holiday table, one row per (org, date). Seeded with FIXTURE_HOLIDAYS for "org_public" (their
 *  own ids) and a copy of each for "dedicated" with ids from newHolidayId() — create_org's copy. */
const holidays: { org: MockOrg; row: Holiday }[];

/** Test-only, MIR-15-e. Replaces the dedicated org's member set; `[]` restores the default. A named
 *  export beside `seam`, so seam parity is untouched. */
export function __setDedicatedOrgMembersForTest(memberIds: string[]): void;
```

Behaviour, each the SQL policy reproduced:

- `listHolidays(range)` — `org = mockOrgOf(currentMemberId)`; `null` → `[]`; else that org's rows in
  range, sorted and limited as today.
- `addHoliday` — refused `not_permitted` / `HOLIDAY_ADD_REFUSED` unless `currentAdmin()` and
  `mockOrgOf(...) === "dedicated"`; `holiday_date_taken` checked within that org only; the row is
  stored under that org.
- `updateHoliday`, `deleteHoliday` — the same caller rule; the row is looked up within the caller's
  org only, and a miss is `not_permitted` (the filtered write's empty body); the date-taken check on
  update is within that org.
- `isOwnOrgShared()` — `mockOrgOf(currentMemberId) === "org_public"`.

Comments at `:540-551` and `:2882` (`using (true)`, "no team column … admits to everybody") are
rewritten to cite `holiday_select_own_org`, the per-org table and ADR-079.

### 4.4 Screen — `src/routes/Holidays.tsx`

```ts
type View =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "no-org" } // MIR-15-e AC-5: getCurrentMember resolved to a caller member_org_id is null for
  | { phase: "ready"; holidays: Holiday[]; me: Member | null; orgShared: OrgShared };

/** MIR-15-e. "unknown" is a failed read: no control (AC-6) and no system-admin line, since the
 *  line would then be a claim nothing established. */
type OrgShared = "yes" | "no" | "unknown";
```

`load`:
1. `me = await seam.getCurrentMember()`; a throw keeps today's behaviour (`me = null`, read
   continues, `memberRead = "failed"`).
2. If the read resolved and `me === null || me.status !== "approved" || me.removedAt !== null` →
   `{ phase: "no-org" }`, and `listHolidays` is not called.
3. `orgShared`: if `me?.role === "admin"`, `await seam.isOwnOrgShared()` → `"yes"` / `"no"`, a
   throw → `"unknown"` (AC-6); otherwise `"no"` without a call.
4. `listHolidays(range)` as today.

`const mayWrite = me !== null && me.removedAt === null && me.role === "admin" && orgShared === "no";`

Markup, new test ids and copy exactly:

| id | element | copy |
|---|---|---|
| `holidays-set-by-system` | the line of § 2b.1, rendered when `me?.role === "admin" && orgShared === "yes"` | `Org public's holiday calendar is set by a system admin.` |
| `holidays-no-org` | the notice of § 2b.2 | `Your account is not in an organisation yet, so there is no holiday calendar to show.` |

The file header (`:5-23`) is rewritten: the table now has an org, the read is `holiday_select_own_org`,
and the gate includes `!orgShared` (ADR-079 decisions 2, 3).

### 4.5 `src/App.tsx`

Comment only, `:535-544`: the route stays guarded on a session; the sentence *"a caller with no member
row reads the calendar exactly as a member does"* is replaced by *"reads no row since
`holiday_select_own_org` (ADR-079 decision 3), and the screen says so (MIR-15-e AC-5)"*. No route
changes.

### 4.6 Tests

- **`tests/holiday-writes.test.ts`** — every ADM-03 success block runs as Quan-D
  (`__setDedicatedOrgMembersForTest([FIXTURE_ADMIN.id])` in `beforeEach`, `[]` in `afterEach`). New
  `describe("MIR-15-e …")` blocks: one `it` per AC-7 to AC-12, named `AC-n: …`.
- **`tests/e2e/adm-03-holiday-writes.spec.ts`** — every existing test runs as Quan-D, by
  `page.addInitScript(() => localStorage.setItem("calechip.mock.dedicatedOrgMembers",
  JSON.stringify(["22222222-2222-4222-8222-222222222222"])))` before the first `goto`. New tests
  `MIR-15-e AC-1`, `AC-2`, `AC-3` (AC-3 may be a single test that adds, edits and deletes), `AC-4`.
- **`tests/e2e/adm-02-holidays.spec.ts`** — `AC-7` (`:205-217`) becomes MIR-15-e AC-5: Hoa sees
  `holidays-no-org`, zero `holidays-row`, zero `holidays-year`, and zero `holidays-beyond-calendar`.
- **`tests/e2e/cal-08-holiday-shading.spec.ts`** — the two tests that call `addHoliday(page, …)`
  (`:357`, `:518`) set the same init script, so the admin who adds is Quan-D.
- **AC-6** — one e2e test in `adm-03-holiday-writes.spec.ts`, as Quan-D, using the route-rewrite
  pattern of `tests/e2e/mir-14-b-worklist-teams.spec.ts:71-90`: the mock bundle's
  `async isOwnOrgShared(){` is prefixed with a throw, asserted to match exactly once; the test then
  asserts `holidays-row` is present and `holiday-add-form`, `holidays-row-edit`,
  `holidays-row-delete` and `holidays-set-by-system` all have count 0.

## 5. Seam impact

**`DataSeam` gains one function, `isOwnOrgShared(): Promise<boolean>`**, in both `supabase.ts` and
`mock.ts` with the same name and arity; `tests/seam-parity.test.ts` compares keys and passes once both
have it. `listHolidays`, `addHoliday`, `updateHoliday`, `deleteHoliday` keep their signatures; the
mock's bodies change to match SQL (§ 4.3). After this ticket the mock is no longer looser than SQL on
ADR-079 decisions 2 and 3 — the gap MIR-15-b § 5 recorded is closed. `SystemSeam`: none.

## 6. Schema delta

`none`. No migration, policy, trigger, constraint or function changes. The two RPCs called
(`member_org_id`, `org_is_shared`) exist and are executable by `authenticated`
(`20261103120000_mir13_write_path_org_bound.sql:81`, `20261105180000_mir15_org_public_team_bound.sql:41`).

## 7. allowed_paths

```yaml
allowed_paths:
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/routes/Holidays.tsx"
  - "src/App.tsx"
  - "tests/holiday-writes.test.ts"
  - "tests/e2e/adm-02-holidays.spec.ts"
  - "tests/e2e/adm-03-holiday-writes.spec.ts"
  - "tests/e2e/cal-08-holiday-shading.spec.ts"
```

`size: M` — 9 paths. `size_estimate` and `size` agree. `glossary_owed` is `[]`; no glossary row.
`tests/manager-role.test.ts`, named in `mir_detail`, was checked and needs no change (§ 1).

## 8. Rejected alternatives

- **Add `orgId` (or `orgIsShared`) to `Member`.** One read instead of a new seam function, and the
  fact is available to every screen. Rejected: `Member` is mapped in both seams, in every fixture and
  in `__putMemberForTest` callers across the suite, so a field for one screen's affordance touches far
  more than 12 files; and MIR-16/17 will reshape what a member knows about its org anyway.
- **Hide the controls for every admin.** Rejected in ADR-079 *Options considered*: a dedicated org's
  admin still holds the write (decision 2).
- **A fixture account in a dedicated org** (`fixtures.ts` + `seed.sql`). Gives e2e a real login for
  AC-3. Rejected: every roster, directory and count test reads the fixture member list, and the seed
  would need an org row; the localStorage switch reaches the same path with one line per spec and no
  shared-fixture change.
- **Call `isOwnOrgShared` for every caller.** Simpler `load`. Rejected: it adds a read, and a failure
  mode, to the member and no-org paths that ADM-02's tests pin, for a fact only an admin's screen uses.

## Changelog

- `2026-11-06T09:08:21Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from the ticket, ADR-079 and MIR-15-b's plan before the source tree was read for 3–8;
  reading it added AC-5 (the member-less e2e case in `adm-02-holidays.spec.ts:205` asserts the old
  behaviour and needs a stated replacement) and AC-6 (fail-closed, mirroring how `load` already
  treats a failed `getCurrentMember`), and removed `tests/manager-role.test.ts` from scope. Amended by
  `tech-lead-design`.
