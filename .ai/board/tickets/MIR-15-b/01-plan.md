---
ticket: MIR-15-b
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-06T04:36:00Z
inputs_read:
  - .ai/board/tickets/MIR-15-b/ticket.yaml
  - .ai/board/tickets/MIR-15/01-plan.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-070-the-org-and-multi-team-membership-schema.md
  - .ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md
  - .ai/registry/decisions/ADR-075-a-system-admin-manages-orgs-through-three-aal2-gated-rpcs.md
  - .ai/registry/decisions/ADR-076-in-org-public-a-public-event-is-a-team-event-and-the-directory-reaches-no-other-team-through-it.md
  - .ai/standards/rbac-and-security.md
  - .ai/templates/plan.md
  - supabase/migrations/20260905120000_adm02_holiday.sql
  - supabase/migrations/20260905140000_adm03_holiday_writes.sql
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql
  - supabase/migrations/20261103120000_mir13_write_path_org_bound.sql
  - supabase/migrations/20261105120000_mir18b_org_management.sql
  - supabase/tests/010-catalogue.test.sql
  - supabase/tests/140-org-stamping-and-membership-mirror.test.sql
  - supabase/tests/150-write-path-org-bound.test.sql
  - supabase/tests/200-org-management.test.sql
  - src/lib/data/system.ts
  - src/system/main.tsx
  - src/routes/Holidays.tsx
  - src/components/HolidayForm.tsx
  - src/lib/data/supabase.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/App.tsx
  - tests/e2e/mir-18-b-org-management.spec.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-15-b — only a system admin sets Org public's holidays, from the system panel, and each org reads only its own holiday calendar

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:304`):

| ID | Feature | Group |
|---|---|---|
| MIR-15 | In Org public, the directory, public events and event notifications stay within the team, only system_admin sets its holidays, and a team can be moved to another org | MIR |

**Plan item P3-6, the bullet this ticket ships** (`.ai/board/plans/calechip-multi-tenancy-plan.md:209`):
*"Only `system_admin` sets holidays for Org public"*. **ADR-070 § 4, `holiday` bullet:** *"In Org
public (`is_shared_tenant = true`), holiday rows are the system-owned national set and may be
written only by `system_admin` (MIR-15)"*. **ADR-076 decision 6:** *"MIR-15-b ships Org public's
holidays — the write policies, the read bound, and the panel screen."*

**Who gains what.** Today every admin of every free team edits the one calendar all of Org public
reads (`20261103120000_mir13_write_path_org_bound.sql:830-856`), so a stranger's typo moves a
bridge day for every team in the shared tier. After this ticket only a system admin, at `aal2`,
changes Org public's calendar, and does it from the system panel. Separately, since `create_org`
copies Org public's rows into each new org, a date has one row per org, and `holiday_select_all`
(`using (true)`) hands every member all of them; after this ticket a member reads their own org's
row for a date and no other (ADR-059 decision 1, *"its own holidays"*).

`size_estimate: M` — one migration (four RPCs, three narrowed policies, one replaced policy), its
pgTAP, one changed pgTAP case, four functions on the panel seam and one panel section.

**Out of scope — and where each goes:**

- **The member app's Holidays screen** (`src/routes/Holidays.tsx:216`, `mayWrite` is `role ===
  "admin"`) — it still offers add, edit and delete to an admin of Org public, and the database now
  refuses each one. **MIR-15-e**, created here (ADR-079 decision 5), with the member mock seam and
  the vitest and e2e files that assert an Org public admin writes holidays.
- **The member mock seam** (`src/lib/data/mock.ts`) — it keeps letting any admin write and every
  caller read every row until MIR-15-e. **MIR-15-e.**
- **The stale `using (true)` comments** in `src/lib/data/supabase.ts`, `src/lib/data/mock.ts`,
  `src/routes/Holidays.tsx` and `src/App.tsx` — **MIR-15-e**, which edits those files anyway.
- **A dedicated org's holidays.** Its `is_admin` members keep the write until MIR-16 re-points it at
  `org_admin` (ADR-070 § 4). The system admin gets no door to them.
- **Propagating a change in Org public's set to dedicated orgs' copies.** No source decides it;
  `create_org` copies once (ADR-075 decision 3). For `/idea` (ADR-079 decision 4).
- **A caller with no org** — pending, removed, member-less — now reads no holiday rows. What the
  member-app screen shows them is MIR-15-e's.
- **`.ai/standards/rbac-and-security.md:66`** and known weakness A11 (`:347`) — a standards edit,
  human-only.
- **Who entered or changed a row.** `holiday` still carries `created_at` only (ADM-02's known
  weakness). Unchanged.

## 2. Acceptance criteria

Throughout: **Org public** is the org with `is_shared_tenant = true`. **Org D** is a dedicated org.
**Ada** is an approved `admin` of Org public; **Alice** an approved member of Org public; **Pat** a
`pending` member of Org public. **Dora** is an approved `admin` of Org D; **Dan** an approved member
of Org D. **Sam** is a system admin; *at aal2* and *at aal1* name the assurance level of his session.
**H-P** is an Org public holiday on 2031-01-01 named `Tet Duong lich`, kind `non_working`; **H-D** is
Org D's row for the same date, named `New Year (D)`. AC-1 to AC-13 are observed against the database
as the caller; AC-14 to AC-20 in the system panel.

**AC-1 — an admin of Org public cannot add to its calendar**
- Given Ada is signed in
- When she inserts a holiday on 2031-03-01 into `public.holiday`, with or without an `org_id`
- Then the insert is refused with `42501` and Org public has no row on 2031-03-01

**AC-2 — nor change or remove one of its rows**
- Given H-P
- When Ada updates H-P's name, and deletes H-P
- Then each affects zero rows and H-P is unchanged

**AC-3 — an admin of a dedicated org still maintains that org's calendar** (until MIR-16)
- Given Dora is signed in
- When she inserts a holiday on 2031-03-02 with no `org_id`, renames it, and deletes it
- Then each succeeds: the row lands in Org D, takes the new name, and is gone after the delete

**AC-4 — a system admin at aal2 adds a day to Org public**
- Given Sam at aal2, and Org public has no row on 2031-03-03
- When he calls `add_national_holiday('2031-03-03', 'Gio To', 'non_working')`
- Then it returns an id, and that id is an Org public row on 2031-03-03 with that name and kind

**AC-5 — and edits and removes one**
- Given Sam at aal2 and H-P
- When he calls `update_national_holiday` on H-P with date 2031-01-02, name `Tet (moved)`, kind
  `working`, and then `delete_national_holiday` on H-P
- Then after the first H-P carries all three new values, and after the second it does not exist

**AC-6 — a second row for a date Org public already has is refused**
- Given Sam at aal2 and H-P
- When he calls `add_national_holiday('2031-01-01', 'Again', 'non_working')`, or moves another Org
  public row onto 2031-01-01 with `update_national_holiday`
- Then each is refused with `23505` and Org public still has exactly one row on 2031-01-01

**AC-7 — a blank name is refused**
- When Sam at aal2 calls `add_national_holiday('2031-03-04', '   ', 'non_working')`
- Then it is refused with `22023` and no row exists on 2031-03-04

**AC-8 — nobody else can use the door**
- When Sam at aal1, Ada, and Alice each call each of the four RPCs
- Then every call is refused with `42501`, `anon` holds no `EXECUTE` on any of them, and the holiday
  table is as it was

**AC-9 — the door does not reach a dedicated org**
- Given Sam at aal2 and H-D
- When he calls `update_national_holiday` and `delete_national_holiday` with H-D's id
- Then each is refused with `P0002` and H-D is unchanged

**AC-10 — the door lists Org public's calendar, and only it**
- Given Sam at aal2, H-P and H-D
- When he calls `list_national_holidays('2031-01-01', '2031-12-31')`
- Then it returns H-P with its id, date, name, kind and created_at, ascending by date, and not H-D

**AC-11 — each org reads only its own row for a date**
- Given H-P and H-D
- When Alice selects holidays on 2031-01-01, and Dan does the same
- Then Alice gets exactly H-P and Dan gets exactly H-D

**AC-12 — a caller with no org reads none**
- Given H-P
- When Pat selects holidays, and when Sam (who has no member row) selects from `public.holiday`
- Then each gets zero rows

**AC-13 — a new org still arrives with Org public's calendar**
- Given Sam at aal2 has added a row through `add_national_holiday`
- When he calls `create_org`
- Then the new org's rows include that row's date, name and kind (ADR-075 decision 3, unchanged)

**AC-14 — the panel shows Org public's calendar for a year**
- Given Sam is signed in to the panel at aal2
- When the signed-in screen loads
- Then below the orgs table a *National holidays* section shows the current year, and one row per
  Org public holiday in that year with its date, name and effect, in date order

**AC-15 — the panel moves between years**
- When Sam presses next, then previous
- Then the section shows the following year's rows, then the current year's again

**AC-16 — the panel says when a year has no rows**
- Given a year with no Org public holiday
- When Sam moves to it
- Then the section says `No holidays in <year>.` and shows no row

**AC-17 — the panel adds a day**
- When Sam presses *Add a day*, enters a date, a name and an effect, and saves
- Then the form closes and the row is in the list of that date's year

**AC-18 — the panel edits a day**
- When Sam presses *Edit* on a row, changes its name and effect, and saves
- Then the form closes and the row shows the new name and effect

**AC-19 — the panel removes a day only after a confirmation that names it**
- When Sam presses *Delete* on a row
- Then a confirmation names that row's date and name, and nothing is removed yet
- And when he cancels, the row stays; when he confirms, the row is gone

**AC-20 — the panel says why a write was refused**
- Given a row on a date
- When Sam adds another day on that date, or saves a name of only spaces
- Then the form stays open and shows `The calendar already has a row for that date. Edit that row
  instead.` or `A date and a name are required.` respectively

**Invariants touched.** `[]`. A holiday is not an entry, carries no member and no team, and none of
INV-01 to INV-07 reads it — the reasoning ADM-02 and ADM-03 recorded, unchanged by adding `org_id`.
The bridge-day derivation reads holidays but is not an invariant, and AC-11 keeps its input single-
valued per date.

**Open questions.** None that block. Propagation to dedicated orgs (decision 4 of ADR-079) is an
assumption that ships: nothing propagates.

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

A second `<section>` on the signed-in panel screen (`src/system/main.tsx`, `OrgManagement`), below the
Orgs section, in the same card style:

1. **Header row:** `<h2>` *National holidays* with the muted sub-label *Org public*; on the right the
   year switcher — a `‹` button, the year as text, a `›` button — and a primary *Add a day* button.
2. **Form slot** (one form at a time, the Orgs section's rule): the add or edit form, inline, with
   *Date* (`<input type="date">`), *Name* (text), *Effect* (`<select>`: `Not a working day` /
   `A working day`, the member app's two labels), *Save* and *Cancel*, and an error line under them.
3. **List:** a table with *Date* (`yyyy-MM-dd`, tabular), *Name*, *Effect*, and a right-aligned
   actions cell with *Edit* and *Delete* text buttons. A delete opens a confirmation row directly
   under that row: *Remove `<date>` — `<name>` from the national calendar?* with *Remove* and *Keep*.
4. **States:** `Loading holidays…` (status), the error with *Try again* (alert), and
   `No holidays in <year>.` when the year is empty.

Dense, like the orgs table above it; no colour beyond the panel's existing tokens.

## 3. Permission model

Every check is on the server side of the boundary. The panel's gate is an affordance; the control is
`public.is_system_admin()` inside each RPC, and the policies on `public.holiday`.

| Action | Sam at aal2 | Sam at aal1 | Admin, Org public | Member, Org public | Admin, dedicated org | Member, dedicated org | Pending / no org | anon |
|---|---|---|---|---|---|---|---|---|
| List Org public's holidays — `list_national_holidays` | ✅ | ❌ 42501 | ❌ 42501 | ❌ 42501 | ❌ 42501 | ❌ 42501 | ❌ 42501 | ❌ no EXECUTE |
| Add / edit / delete an Org public row — the three write RPCs | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Edit / delete a dedicated org's row through the RPCs | ❌ P0002 | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| Insert / update / delete `public.holiday` directly — `holiday_*_admin` | ❌ (no member row) | ❌ | ❌ **new** | ❌ | ✅ own org (unchanged) | ❌ | ❌ | ❌ no grant |
| Select `public.holiday` — `holiday_select_own_org` | ❌ 0 rows (reads via RPC) | ❌ 0 rows | own org | own org | own org | own org | ❌ 0 rows **new** | ❌ no grant |

**Denials the tests must assert** (each is an AC): AC-1, AC-2 (Org public admin), AC-6, AC-7
(values), AC-8 (every non-aal2 caller), AC-9 (door aimed at a dedicated org), AC-11 (the other org's
row), AC-12 (no org). And the non-changes, so the fence is not drawn too wide: AC-3 (dedicated
admin), AC-13 (`create_org`).

## 4. Contract

### 4.1 Migration `supabase/migrations/20261106120000_mir15b_org_public_holidays.sql`

Idempotent (ADR-024): `create or replace` for the functions, `drop policy if exists` before each
policy, grants re-stated. Wrapped in `begin; … commit;` as MIR-18-b's is.

```sql
-- 1. Read bound (ADR-079 decision 3).
drop policy if exists holiday_select_all on public.holiday;
drop policy if exists holiday_select_own_org on public.holiday;
create policy holiday_select_own_org on public.holiday
  for select to authenticated
  using (org_id = public.member_org_id((select auth.uid())));

-- 2. Member writes exclude the shared tenant (decision 2). MIR-13's bodies
--    (20261103120000:830-856), each with one conjunct added:
drop policy if exists holiday_insert_admin on public.holiday;
create policy holiday_insert_admin on public.holiday
  for insert to authenticated
  with check (
    public.is_admin((select auth.uid()))
    and org_id = public.member_org_id((select auth.uid()))
    and not public.org_is_shared(org_id)
  );
-- holiday_update_admin: the same added conjunct in BOTH `using` and `with check`.
-- holiday_delete_admin: the same added conjunct in `using`.

-- 3. The door (decision 1). Every function: language plpgsql, security definer,
--    set search_path = '', first statement
--      if not public.is_system_admin() then
--        raise exception 'not a system admin' using errcode = '42501';
--      end if;
--    then Org public resolved as
--      select o.id into v_org from public.org o where o.is_shared_tenant;

create or replace function public.list_national_holidays(p_start date, p_end date)
  returns table (id uuid, date date, name text, kind public.holiday_kind, created_at timestamptz)
  -- stable. Org public's rows with p_start <= date <= p_end, order by date asc.
  -- Columns qualified (`h.`): the `returns table` names are PL/pgSQL variables.

create or replace function public.add_national_holiday(
  p_date date, p_name text, p_kind public.holiday_kind
) returns uuid
  -- volatile. If btrim(coalesce(p_name, '')) = '' raise 'holiday name is required'
  -- using errcode = '22023'. Insert (org_id, date, name, kind) = (v_org, p_date, btrim(p_name),
  -- p_kind), returning id. A taken date raises 23505 from holiday_org_id_date_key, uncaught.

create or replace function public.update_national_holiday(
  p_id uuid, p_date date, p_name text, p_kind public.holiday_kind
) returns void
  -- volatile. Blank name: 22023 as above. Update the row where id = p_id and org_id = v_org,
  -- setting date, btrim(name), kind; if not found raise 'holiday not found' using errcode = 'P0002'.

create or replace function public.delete_national_holiday(p_id uuid) returns void
  -- volatile. Delete where id = p_id and org_id = v_org; if not found raise P0002 as above.

-- 4. Grants, for each of the four signatures:
revoke all on function public.list_national_holidays(date, date) from public, anon;
grant execute on function public.list_national_holidays(date, date) to authenticated;
-- …and the same pair for add_national_holiday(date, text, public.holiday_kind),
--   update_national_holiday(uuid, date, text, public.holiday_kind), delete_national_holiday(uuid).
```

The table grant (`grant select, insert, update, delete … to authenticated`) is unchanged.
`holiday_stamp_org_id` is unchanged: every RPC supplies `org_id`.

### 4.2 pgTAP `supabase/tests/240-org-public-holidays.test.sql`

One file, one `plan(n)`, on `tests.seed()` (whose org is Org public; `admin_t` is Ada). On top, as
`postgres`: Org D with team D1, Dora (`admin`) and Dan, both approved with a membership on D1; Pat
pending in Org public; a `system_admin` row for Sam's identity; H-P and H-D. `tests.authenticate_at`
as `200-org-management.test.sql:33-37` defines it. One assertion per AC-1 to AC-13 (several for AC-8:
each caller × each RPC, and one `function_privs_are` / `has_function_privilege` check per signature
for `anon`), plus: `holiday_select_all` no longer exists and `holiday_select_own_org` does.

### 4.3 Changed pgTAP — `supabase/tests/150-write-path-org-bound.test.sql:169-175`

`admin_t` is an admin of Org public (`:5`, `:26-29`). The `lives_ok` *"inserting a holiday with no
org_id is accepted"* becomes `throws_ok (…, '42501', null, 'AC-13: inserting a holiday into Org A is
refused — MIR-15-b, ADR-079 decision 2')`, and `:174`'s *"and it lands in Org A"* becomes
`is((select count(*)::int from public.holiday where date = '2099-07-04'), 0, …)`. `plan(46)` is
unchanged.

### 4.4 Census — `supabase/tests/010-catalogue.test.sql`

After the MIR-15 helper line:

```sql
    -- MIR-15-b RPCs, 240-org-public-holidays.test.sql
    'public.list_national_holidays(date,date)',
    'public.add_national_holiday(date,text,public.holiday_kind)',
    'public.update_national_holiday(uuid,date,text,public.holiday_kind)',
    'public.delete_national_holiday(uuid)',
```

An enum argument is spelled schema-qualified, as the existing
`'public.notify(uuid[],public.notification_kind,uuid,text)'` row is.

### 4.5 Panel seam — `src/lib/data/system.ts`

Added to `SystemSeam`, after `updateOrg`:

```ts
  /** `rpc("list_national_holidays", { p_start, p_end })`, ascending, limited to HOLIDAY_LIMIT. Never throws. MIR-15-b. */
  listNationalHolidays(range: DateRange): Promise<HolidayResult<Holiday[]>>;
  /** `rpc("add_national_holiday", { p_date, p_name, p_kind })`. Value is the new id. Never throws. */
  addNationalHoliday(input: NationalHolidayInput): Promise<HolidayResult<string>>;
  /** `rpc("update_national_holiday", { p_id, p_date, p_name, p_kind })`. Never throws. */
  updateNationalHoliday(holidayId: string, input: NationalHolidayInput): Promise<HolidayResult<null>>;
  /** `rpc("delete_national_holiday", { p_id })`. Never throws. */
  deleteNationalHoliday(holidayId: string): Promise<HolidayResult<null>>;
```

```ts
import type { DateRange, Holiday, HolidayKind, Result } from "@/lib/domain/types";
import { HOLIDAY_LIMIT } from "@/lib/domain/types";

export interface NationalHolidayInput {
  date: string; // yyyy-MM-dd
  name: string; // sent as given; the RPC trims and refuses blank
  kind: HolidayKind;
}

export type HolidayFailureCode =
  | "not_permitted"      // 42501
  | "holiday_not_found"  // P0002
  | "holiday_date_taken" // 23505
  | "invalid_holiday"    // 22023, or the list reached HOLIDAY_LIMIT
  | "network";           // anything else, or a throw

export type HolidayResult<T> =
  | { ok: true; value: T }
  | { ok: false; error: { code: HolidayFailureCode; message: string } };

export const HOLIDAY_FAILURE_MESSAGES: Record<HolidayFailureCode, string> = {
  not_permitted: "You do not have permission to do that.",
  holiday_not_found: "That day is no longer in the calendar. Reload to see the current list.",
  holiday_date_taken: "The calendar already has a row for that date. Edit that row instead.",
  invalid_holiday: "A date and a name are required.",
  network: "Could not reach the server. Try again.",
};
```

Rows map `created_at` → `createdAt` into the existing `Holiday` type. If the list returns
`>= HOLIDAY_LIMIT` rows it is refused as `network` — the truncation rule ADM-02 set for
`listHolidays`. `DateRange` and `HOLIDAY_LIMIT` are the existing exports at
`src/lib/domain/types.ts:523` and `:739`.

**Mock** (same file): a store of Org public's rows seeded with copies of `FIXTURE_HOLIDAYS`
(`src/lib/fixtures.ts:556`), gated on `mockMaySeeOrgs()`; the same five refusals (blank name after
trim, a taken date among the store's rows other than the one being edited, an unknown id). The
existing comment *"it does not model holidays"* (`:351`) is amended to say it models Org public's
only.

### 4.6 Panel screen — `src/system/main.tsx`

A `NationalHolidays` component rendered by `OrgManagement` after the Orgs `<section>`, plus a
`NationalHolidayForm` for add and edit. Year held in state, initial `new Date().getFullYear()`; the
range is `${year}-01-01`…`${year}-12-31`. After any successful write the year is reloaded. After an
add, the year switches to the added date's year.

Test ids (the e2e spec reads only these):

| id | element |
|---|---|
| `system-holidays` | the section |
| `system-holidays-year` | the year text, with `data-year` |
| `system-holidays-prev`, `system-holidays-next` | the two year buttons |
| `system-holidays-loading`, `system-holidays-error`, `system-holidays-retry`, `system-holidays-empty` | the states |
| `system-holiday-new` | *Add a day* |
| `system-holiday-form` | the add/edit form |
| `system-holiday-form-date`, `system-holiday-form-name`, `system-holiday-form-kind` | its fields |
| `system-holiday-form-submit`, `system-holiday-form-cancel`, `system-holiday-form-error` | its controls and error |
| `system-holiday-row` | a list row, with `data-date` |
| `system-holiday-row-date`, `system-holiday-row-name`, `system-holiday-row-effect` | its cells |
| `system-holiday-row-edit`, `system-holiday-row-delete` | its actions |
| `system-holiday-delete-confirm` (`role="alertdialog"`), `system-holiday-delete-accept`, `system-holiday-delete-cancel`, `system-holiday-delete-error` | the confirmation |

Copy, exactly: *National holidays*, *Org public*, *Add a day*, *Date*, *Name*, *Effect*,
*Not a working day*, *A working day*, *Save*, *Cancel*, *Edit*, *Delete*,
*Remove {date} — {name} from the national calendar?*, *Remove*, *Keep*, *Loading holidays…*,
*No holidays in {year}.*, *Try again*. The screen imports nothing from the member app
(`main.tsx:3-5`): the two effect labels are written here, not imported from `HolidayForm`.

### 4.7 e2e `tests/e2e/mir-15-b-national-holidays.spec.ts`

Against the mock build, signed in as `mir-18-b-org-management.spec.ts:15-23` does. One test per
AC-14 to AC-20, reading the fixture holidays' years from `src/lib/fixtures.ts` rather than from the
clock.

## 5. Seam impact

**`DataSeam` (the member seam): none.** No function is added, removed or re-shaped; `listHolidays`
is unchanged and the read bound is the policy's. **The panel seam `SystemSeam` gains four
functions** (§ 4.5), in both its implementations in the same file; it has no parity test of its own
and the member seam-parity test does not read it. **The member mock is looser than SQL on the
holiday predicates until MIR-15-e ships** (ADR-079 decision 5).

## 6. Schema delta

**Not `none`** (ADR-014): the policy `holiday_select_all` is dropped and `holiday_select_own_org`
created; `holiday_insert_admin`, `holiday_update_admin` and `holiday_delete_admin` are replaced; four
`security definer` functions are added. No table, column, constraint, index or row changes.
**ADR-079**, accepted under ADR-067 at this PLAN. Applying it to the hosted project is human-only
(RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-079-org-public-holidays-are-written-through-four-system-admin-rpcs-and-each-org-reads-only-its-own.md"
  - ".ai/board/tickets/MIR-15-e/ticket.yaml"
  - "supabase/migrations/20261106120000_mir15b_org_public_holidays.sql"
  - "supabase/tests/240-org-public-holidays.test.sql"
  - "supabase/tests/150-write-path-org-bound.test.sql"
  - "supabase/tests/010-catalogue.test.sql"
  - "src/lib/data/system.ts"
  - "src/system/main.tsx"
  - "tests/e2e/mir-15-b-national-holidays.spec.ts"
```

`size: M` — 9 paths. `glossary_owed` is `[]`; *Org public* already says *"Administered by
`system_admin`, who alone sets its holidays"* (`.ai/registry/glossary.md:64`), so no row is written.

**`size_estimate` and `size` agree at M, after a split.** With the member app in it — `index.ts`,
`supabase.ts`, `mock.ts`, `Holidays.tsx`, `App.tsx` and the four test files that assert an Org
public admin writes holidays (`tests/holiday-writes.test.ts`, `tests/e2e/adm-03-holiday-writes.spec.ts`,
`tests/e2e/cal-08-holiday-shading.spec.ts`, `tests/manager-role.test.ts`) — it counted 18 paths, L.
The member half moved to MIR-15-e (ADR-079 decision 5).

## 8. Rejected alternatives

- **Policies for the system admin on `public.holiday`, read and written through PostgREST.** Four
  disjuncts and no new function. Rejected: the panel would have to send Org public's id on every
  insert because `holiday_stamp_org_id` finds no member row for a system admin, the panel could then
  aim a write at any org it can name, and it departs from the panel's one pattern (ADR-075 decision
  1). ADR-079 *Options considered*.
- **Hide the member app's write controls for every admin in this ticket.** One condition in
  `Holidays.tsx`, no new seam read, and the gap between the two tickets closes. Rejected: it takes
  the write away from a dedicated org's admin, who still holds it in the database (decision 2), and
  no source takes it before MIR-16.
- **Keep `using (true)` and filter `listHolidays` by the caller's org.** Rejected under ADR-005: the
  filter is an affordance a direct PostgREST call skips.

## Changelog

- `2026-11-06T04:36:00Z` — all sections written. Raised by `tech-lead-design`. Sections 1 and 2 were
  drafted from the ticket, ADR-070, ADR-074, ADR-075 and ADR-076 before the source tree was read for
  3–8; reading it moved the member-app screen out (§ 7's split) and added AC-12 for the
  member-less caller, whom the read bound reaches. Amended by `tech-lead-design`.

## Delegated decisions

- **ADR-079** — Org public's holidays are written only through four `aal2`-gated RPCs that resolve
  Org public themselves; member write policies exclude the shared tenant; `holiday_select_all`
  (ADR-015, `using (true)`) is replaced by a read bounded to the caller's org; nothing propagates to
  dedicated orgs; and MIR-15-b splits into MIR-15-b (database and panel) and MIR-15-e (member app and
  mock). Reverses ADR-015's select policy; narrows ADM-03 inside Org public under ADR-070 § 4.
