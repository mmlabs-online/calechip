---
ticket: MIR-19-f
stage: PLAN
agent: tech-lead-design
produced_at: 2026-11-12T03:38:19Z
inputs_read:
  - .ai/board/tickets/MIR-19-f/ticket.yaml
  - .ai/board/tickets/MIR-19-d/01-plan.md
  - .ai/board/tickets/MIR-19-e/ticket.yaml
  - .ai/board/tickets/MIR-19/01-plan.md
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-059-calechip-becomes-multi-tenant-system-org-team.md
  - .ai/registry/decisions/ADR-071-writers-stamp-org-id-membership-mirrors-member-team-id-and-mir-13-splits-by-operation.md
  - .ai/registry/decisions/ADR-074-system-admin-is-a-separate-account-table-behind-totp-in-its-own-entry.md
  - .ai/registry/decisions/ADR-097-an-org-address-is-served-beside-the-root-one-first-and-the-flip-is-mir-19-b.md
  - .ai/registry/decisions/ADR-098-an-email-to-a-member-carries-their-org-code-in-the-request-the-database-posts.md
  - .ai/board/plans/calechip-multi-tenancy-plan.md
  - .ai/board/plans/multi-tenancy-status.md
  - .ai/standards/rbac-and-security.md
  - .ai/01-operating-model.md (§ Sizing)
  - .ai/templates/plan.md
  - src/App.tsx
  - src/routes/SignUp.tsx
  - src/components/AuthCard.tsx
  - src/lib/org-path.ts
  - src/lib/data/index.ts (SignUpInput, DataSeam.signUp)
  - src/lib/data/supabase.ts (signUp, toFailure)
  - src/lib/data/mock.ts (signUp, mockOrgOf, dedicatedOrgMemberIds, listPendingMembers, countPendingMembers, decideMember, getOwnOrgCode)
  - supabase/migrations/20260831150024_tea01_membership.sql (trigger admit_allow_listed_member)
  - supabase/migrations/20261106130000_mir21c_membership_self_lock.sql (admit_allow_listed_member, latest)
  - supabase/migrations/20261107180000_mir21f_drop_member_team_id.sql (stamp_org_id, latest)
  - supabase/migrations/20261107230000_mir16b_is_org_admin.sql (member_select_pending_admin, admit_member, reject_member)
  - supabase/migrations/20261027120000_mir11_composite_foreign_keys.sql (public.org, org_code constraints)
  - supabase/migrations/20261105120000_mir18b_org_management.sql (no delete, no suspend; caps unenforced)
  - supabase/tests/010-catalogue.test.sql, 190-system-admin.test.sql, 250-membership-self-lock.test.sql, 370-own-org-code.test.sql
  - tests/signup-confirmation.test.ts
  - tests/e2e/mir-19-org-routing.spec.ts, tests/e2e/solo-new-signups.spec.ts, tests/e2e/tea-01-signup.spec.ts, tests/e2e/mir-19-d-flip.spec.ts
  - node_modules/@supabase/auth-js 2.112.4 lib/error-codes.d.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# MIR-19-f — A sign-up at /{org_code}/signup lands in that org

## 1. Problem and scope

**Feature row, transcribed** (`.ai/registry/features.md:308`):

| ID | Feature | Group |
|---|---|---|
| MIR-19 | Every authenticated page is served under `/{org_code}` | MIR |

**Plan item:** Phase 5, *Org-scoped routing* (`.ai/board/plans/calechip-multi-tenancy-plan.md:261-283`),
ADR-097 decision 5, item 6: *"A sign-up at `/{org_code}/signup` lands in that org (ADR-071 decision 1).
This needs a schema change and its own ADR."* The ADR is
[ADR-099](../../../registry/decisions/ADR-099-a-sign-up-at-an-org-address-lands-in-that-org-and-an-unknown-code-is-refused.md),
written at this PLAN under ADR-067. This is the last planned slice of MIR-19.

**Who gains what.** A person given their organisation's address, such as `/acme/signup`, signs up
there and lands in **that org's** sign-up queue, where that org's org admin admits them to one of its
teams. Today every sign-up lands in Org public, whatever address it was made at
(`/acme/signup` crosses out to `/signup`), so a dedicated org cannot take a new person without a system
admin moving them later. After this ticket, an org admin's queue holds exactly the people who signed up
at their org's address.

**The two questions `ticket.yaml` left open, answered from the recorded decisions (ADR-099):**

- **Which orgs accept sign-ups at their address:** every org that exists, Org public included
  (`/shared/signup` is the same as `/signup`). No recorded decision restricts any org. Caps, licence and
  member counting are deferred (ADR-059 items 2 to 4) and read by nothing. A sign-up never creates an
  org (ADR-059 item 5).
- **A sign-up at an unknown or reserved code:** the database refuses it, and no account is created. A
  reserved word is a code no org can hold, so it is the same case. The client cannot tell an unknown
  code from a real one (`public.org` is closed to it), so the form is shown at any org-shaped address
  and the refusal arrives on submit. A reserved first segment is not an org address at all (ADR-097
  decision 1), so `/<reserved>/signup` never shows the form.

**Out of scope:**

- Any org-level switch for sign-ups: suspended orgs, a domain allow-list, closed orgs. Not decided
  anywhere; ADR-099's revert condition names where it would go.
- Caps, licence and member counting at sign-up or at admission (ADR-059 items 2 to 4, deferred).
- A specific error message for an unknown code. GoTrue does not pass the trigger's message through, and
  the seam does not guess (ADR-099 *Consequences*). The form shows the existing generic failure.
- Showing the org's name or code on the sign-up screen. The client cannot read the org's name.
- `/{org_code}/signin` and `/{org_code}/guest/…`: they keep crossing out to the root (ADR-097
  decisions 1 and 6).
- Removing `stamp_org_id()`'s `member` arm (ADR-099 decision 4). Its comment is not edited.
- Org-bounding the mock's `decideMember` **team** check (the mock's teams carry no org). Only the
  **target member's** org is checked, as `admit_member` does.
- Editing `.ai/standards/rbac-and-security.md` (human plane). Its sign-up paragraph stays true.
- The `features.md` row. `/ship` marks MIR-19 `DONE` with this ticket, since it is the last slice.
- Applying the migration to the hosted project (RULE-09).

`size_estimate`: **M**.

## 2. Acceptance criteria

Terms. **Acme:** the mock's dedicated org, code `acme`; in SQL, any non-shared org. **Org public:**
code `shared`, `is_shared_tenant = true`. **The form:** `signup-form`. **The notice:**
`signup-confirm-notice` (the e2e build pins Confirm email ON). *"Is at X"* means
`new URL(page.url()).pathname` equals X once the named element is visible.

**AC-1: the sign-up screen is served at an org address**
- Given nobody is signed in
- When they open `/acme/signup`
- Then they are at `/acme/signup` with the form shown, and the tab `auth-tab-signup` carries
  `aria-current="page"`.

**AC-2: a sign-up at an org address completes there**
- Given nobody is signed in, at `/acme/signup`
- When they fill display name, avatar, a new email and a password and press `signup-submit`
- Then the notice is shown and they are still at `/acme/signup`.

**AC-3: Org public's address is the same as the root**
- Given nobody is signed in
- When they open `/shared/signup`
- Then they are at `/shared/signup` with the form shown, and a sign-up there shows the notice.

**AC-4: a code that names no org is refused, and no account is created**
- Given nobody is signed in, at `/no-such-org/signup`
- When they complete the form and submit
- Then `signup-error` is shown, the notice is not, they are still at `/no-such-org/signup`, and
  `signup-submit` is enabled again.
- And at the seam: `signUp` with `orgCode: "no-such-org"` returns `{ ok: false }` with
  `error.code === "unknown"`, and no member row, pending or otherwise, is created for that address.

**AC-5: a reserved first segment is not a sign-up address**
- Given nobody is signed in
- When they open `/www/signup`
- Then the form is never shown, and they end at `/signin` with `sign-in-submit` visible.

**AC-6: the sign-in tab leaves the org, as before**
- Given nobody is signed in, at `/acme/signup`
- When they press `auth-tab-signin`
- Then they are at `/signin` with `sign-in-submit` visible.

**AC-7: a signed-in member at an org's sign-up address is shown the form, as at the root**
- Given the member `thanh@example.com`, signed in (Org public)
- When they open `/shared/signup`
- Then they are at `/shared/signup` with the form shown. (The root `/signup` already renders the form in
  every membership state — `App.tsx` route comment, TEA-01.)

**AC-8: the root sign-up is unchanged**
- Given `tests/e2e/tea-01-signup.spec.ts` and `tests/signup-confirmation.test.ts`
- When they run
- Then every test passes unedited, and the real seam sends no `org_code` key in `options.data` for a
  root sign-up (`orgCode` absent or `null`).

**AC-9: a sign-up lands in the org of its address — database**
- Given `supabase/tests/380-sign-up-lands-in-org.test.sql` (§ 4.6)
- When the pgTAP suite runs
- Then each holds:
  1. An `auth.users` insert with `email_confirmed_at = now()` and `raw_user_meta_data.org_code` = Org F's
     code creates a `public.member` row with `org_id` = Org F, `status = 'pending'`, `role = 'member'`,
     and no `membership` row.
  2. The same, inserted unconfirmed and then confirmed by `update … set email_confirmed_at = now()`,
     creates nothing on insert and the same row on confirmation.
  3. No `org_code` key, and `org_code` = `'   '`, each create a row in Org public.
  4. `org_code` = `'shared'` creates a row in Org public.
  5. `org_code` = `'no-such-org-380'` and `org_code` = `'admin'` each make the `auth.users` insert throw
     `P0002` with message `sign_up_org_unknown`, and leave no `auth.users` and no `member` row.
  6. `raw_user_meta_data.role = 'org_admin'` beside a valid `org_code` still creates `role = 'member'`
     (TEA-01 AC-9 holds).
  7. Authenticated as Org F's org admin, the new row is visible through `public.member` (the
     `member_select_pending_admin` policy); authenticated as an org admin of Org public, it is not.
  8. `public.admit_allow_listed_member()`'s source does not name `team_id` (250 AC-8 still holds).
- And `190-system-admin.test.sql`, `250-membership-self-lock.test.sql` and every other pgTAP file pass
  unedited.

**AC-10: a sign-up lands in the org of its address — mock seam**
- Given `tests/signup-org.test.ts` (§ 4.7), driving the mock directly with Confirm email ON
- When it runs
- Then:
  1. With the fixture org admin `quan@example.com` placed in Acme (`__setDedicatedOrgMembersForTest`),
     a `signUp` with `orgCode: "acme"` is listed by `listPendingMembers` and counted by
     `countPendingMembers` for him; the seeded Org public pending sign-up is not.
  2. With him in Org public (the default), the same `orgCode: "acme"` sign-up is not listed or
     counted, and the seeded one is; a `signUp` with no `orgCode`, or `orgCode: "shared"`, is listed.
  3. With him in Org public, `decideMember` on the Acme sign-up returns
     `{ ok: false, error: { code: "not_permitted" } }` with the existing `SIGNUP_DECISION_REFUSED`
     message, and the row stays `pending`.
  4. AC-4's seam half.

**AC-11: MIR-19 AC-9 is amended to this ticket**
- Given `tests/e2e/mir-19-org-routing.spec.ts`
- When it is read
- Then the test `AC-9 …` asserts `/shared/signup` stays at `/shared/signup` with the form shown, its
  title says it was amended by MIR-19-f, and its `/shared/signin` and `/shared/guest/…` assertions are
  unchanged. Every other test in the file is unedited and passes.

**AC-12: everything else passes**
- Given this ticket's commit
- When `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm exec playwright test` run
- Then all pass. No spec other than the two in § 7 is in the diff; none is skipped, `fixme`'d or
  deleted. `tests/route-role-guards.test.ts`, `tests/org-path.test.ts`, `tests/seam-parity.test.ts`,
  `tests/e2e/solo-new-signups.spec.ts` and `tests/e2e/mir-19-d-flip.spec.ts` pass unedited.

**Invariants touched:** `[]`. A sign-up creates a pending member row with no team; it writes no
entry and changes no count, so INV-01 to INV-07 are unaffected. INV-07's *"every team that member
belongs to"* is still empty for a pending row.

**Open questions:** none. ADR-099 settles both questions `ticket.yaml` left open (§ 1).

### 2b. Visual reference

Visual reference: none. The layout below is the Tech Lead's own and was never specified.

There is no new layout. `/{org_code}/signup` renders the existing sign-up card exactly as `/signup`
does, inside the same `BareLayout` gutter. No element or selector is added.

## 3. Permission model

| Action | Who | Where the check lives |
|---|---|---|
| Sign up at `/{org_code}/signup` | anybody, in every membership state, as at `/signup` | No gate: sign-up needs no permission (`rbac-and-security.md` § sign-up). |
| Land in org F's queue | a sign-up whose `raw_user_meta_data.org_code` is F's code | **The database**: `admit_allow_listed_member()` resolves the code and writes `org_id` (ADR-099 decision 2). The client's `orgCode` is an input, never a grant. |
| Refuse an unknown or reserved code | — | **The database**: the same trigger raises `P0002` on the `auth.users` insert (decision 3). |
| Read or decide org F's pending sign-up | an approved org admin of org F | Unchanged: `member_select_pending_admin`, `admit_member`, `reject_member` (MIR-16-b). Mock: `listPendingMembers`, `countPendingMembers`, `decideMember` now reproduce the `org_id` clause. |

**Denials.**
- A sign-up can put a person only in a **pending** row. `role` is still hard-coded `member` and never read
  from metadata; `status` takes its `pending` default; no `membership` row is written.
- An org admin of another org, and Org public's org admin, never see or decide org F's sign-up.
- A sign-up never creates an org, and never lands in an org other than the one its code names, or Org
  public when it names none. An unresolvable code at confirmation creates nothing rather than falling to
  Org public (decision 5).
- Choosing `org_code` by calling GoTrue directly grants nothing beyond what opening `/{code}/signup`
  grants (ADR-099 *Consequences*).

## 4. Contract

### 4.1 `supabase/migrations/20261112150000_mir19f_sign_up_lands_in_org.sql` — new

Header comment: implements ADR-099 decisions 2, 3 and 5; **IDEMPOTENT** (ADR-024, `create or replace`);
no table, column, constraint, policy, trigger or grant change; applying it to a remote database is human
(RULE-09). Wrapped in `begin; … commit;`.

One statement: `public.admit_allow_listed_member()` re-created, same name, same `returns trigger`, same
`language plpgsql security definer set search_path = extensions`. The trigger
`admit_allow_listed_member` (`after insert or update of email_confirmed_at on auth.users`) is **not**
touched. Body, in this order:

```sql
create or replace function public.admit_allow_listed_member() returns trigger
  language plpgsql security definer set search_path = extensions as $$
declare
  v_code text := nullif(btrim(new.raw_user_meta_data ->> 'org_code'), '');
  v_org  uuid;
begin
  -- ADR-099 decision 2: the org of the address; Org public when none is named.
  if v_code is null then
    select o.id into v_org from public.org o where o.is_shared_tenant;
  else
    select o.id into v_org from public.org o where o.org_code = v_code;
  end if;

  -- ADR-099 decision 3: an unknown or reserved code refuses the sign-up itself. Outside the
  -- `exception when others` block below on purpose: this is the one failure that must reach GoTrue.
  if v_org is null and tg_op = 'INSERT' then
    raise exception 'sign_up_org_unknown' using errcode = 'P0002';
  end if;

  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;   -- already admitted on an earlier confirmation
  end if;

  -- ADR-099 decision 5: never fall through to stamp_org_id()'s shared-tenant fallback.
  if v_org is null then
    raise warning 'admit_allow_listed_member: no org for code % (auth user %)', v_code, new.id;
    return new;
  end if;

  begin
    insert into public.member (id, org_id, display_name, avatar, role)
    values (
      new.id,
      v_org,
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
               split_part(new.email, '@', 1)),
      coalesce(nullif(btrim(new.raw_user_meta_data ->> 'avatar'), ''), '1.png'),
      'member'::public.member_role
    )
    on conflict (id) do nothing;
  exception when others then
    raise warning 'admit_allow_listed_member failed for auth user %: %', new.id, sqlerrm;
  end;

  return new;
end;
$$;
```

The comments from the current definition (`20261106130000_mir21c_membership_self_lock.sql:84-90`,
`:103-104`: no allow-list lookup, no team, `role` never read from metadata, why a raise is caught) are
kept beside the lines they explain. The grants are restated exactly as the current definition leaves
them (no migration grants or revokes on this function today, so none is added).

### 4.2 `src/lib/data/index.ts` — `SignUpInput` gains one optional field

```ts
export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  avatar: string;
  /**
   * MIR-19-f, ADR-099. The org code of the address the sign-up was made at (`/{orgCode}/signup`);
   * absent or null at `/signup`. Sent as `raw_user_meta_data.org_code`; the database resolves it and
   * refuses a code that names no org.
   */
  orgCode?: string | null;
}
```

`DataSeam.signUp(input: SignUpInput): Promise<Result<SignUpOutcome>>` keeps its signature. Its
docblock gains one sentence: *"MIR-19-f: `input.orgCode` names the org the pending row lands in; a code
that names no org is refused with `unknown`."* No existing caller changes.

### 4.3 `src/lib/data/supabase.ts` — `signUp`

`options.data` becomes:

```ts
options: {
  data: {
    display_name: input.displayName,
    avatar: input.avatar,
    ...(input.orgCode ? { org_code: input.orgCode } : {}),
  },
},
```

Nothing else in the function changes. `toFailure` is **not** edited: the trigger's refusal reaches the
client as a GoTrue error whose code is not in its switch, so it maps to
`{ code: "unknown", message: "Something went wrong. Please try again." }`.
`TODO(verify):` the exact GoTrue `error.code` for a failing `auth.users` trigger (expected
`unexpected_failure`, status 500; `@supabase/auth-js` 2.112.4 `error-codes.d.ts` lists it). Whatever it
is, it is not one of `toFailure`'s named cases, which is all this plan relies on.

### 4.4 `src/lib/data/mock.ts` — `signUp` and the pending queue

1. **A new internal helper**, beside `mockOrgOf`:

   ```ts
   // MIR-19-f. `member.org_id` reproduced for ANY row, whatever its status: the dedicated org when the
   // id is in `dedicatedOrgMemberIds`, else Org public. Unlike `mockOrgOf`, which is `member_org_id`.
   const mockRowOrgOf = (memberId: string): MockOrg =>
     dedicatedOrgMemberIds.has(memberId) ? "dedicated" : "org_public";
   ```

2. **`signUp(input)`**, after the existing `weak_password` check and before `members.push`:

   ```ts
   const orgCode = input.orgCode ?? null;
   if (orgCode !== null && orgCode !== MOCK_ORG_PUBLIC_CODE && orgCode !== MOCK_DEDICATED_ORG_CODE) {
     return { ok: false, error: { code: "unknown", message: "Something went wrong. Please try again." } };
   }
   ```

   After `members.push({...})` (the pushed object is unchanged):
   `if (orgCode === MOCK_DEDICATED_ORG_CODE) dedicatedOrgMemberIds.add(userId);`
   An unknown code pushes no member and no `signedUp` credential.

3. **`listPendingMembers()`** and **`countPendingMembers()`**: after `if (!currentAdmin()) …`, the
   existing filter gains `&& mockRowOrgOf(m.id) === mockOrgOf(currentMemberId)`, in both, in the same
   position, so the badge and the list still cannot disagree.

4. **`decideMember(memberId, decision)`**: the `target` lookup gains
   `&& mockRowOrgOf(m.id) === mockOrgOf(me.id)`. A target in another org therefore returns the existing
   `refused("not_permitted", SIGNUP_DECISION_REFUSED)`. The team check is unchanged (§ 1 *Out of scope*).

No export is added to `seam`, so seam parity is unchanged.

### 4.5 `src/routes/SignUp.tsx` and `src/App.tsx`

**`SignUp.tsx`:** the default export takes one optional prop.

```ts
export interface SignUpProps {
  /** MIR-19-f, ADR-099. The org of the address (`/{orgCode}/signup`); null at `/signup`. */
  orgCode?: string | null;
}

export default function SignUp({ orgCode = null }: SignUpProps): JSX.Element
```

The one call becomes `seam.signUp({ email, password, displayName, avatar: chosenAvatar, orgCode })`.
Nothing else changes: the nine `signup-*` selectors, the states, the `<Navigate to="/" replace />`
hand-over (under an org base it lands on `/{orgCode}`, which routes by membership as today). Import
`type JSX` from `react` if the return annotation needs it.

**`App.tsx`:** in the org-base route table (the `base !== "/"` branch), the line

```tsx
<Route path="/signup" element={<LeaveOrg kind="through" base={base} cross={cross} />} />
```

is replaced by

```tsx
{/* MIR-19-f, ADR-099 decision 3. The sign-up screen is served under the org it signs up to;
    /signin and /guest/… still leave the org. Same BareLayout gutter as the root route. */}
<Route element={<BareLayout />}>
  <Route path="/signup" element={<SignUp orgCode={base.slice(1)} />} />
</Route>
```

in the same position, so it still outranks `orgGate`'s `*`. The root table's `<SignUp />` is unchanged.
`src/lib/org-path.ts` is **not** edited: `ROOT_ONLY_SEGMENTS` still keeps a member at `/signup` from
being flipped, which is right, because a root sign-up lands in Org public.

### 4.6 `supabase/tests/380-sign-up-lands-in-org.test.sql` — new

Shape as `370-own-org-code.test.sql`: `\ir _isolation.psql`, `tests.seed()`, a local id helper
`tests.m380(label)` with prefix `c3800000-0000-4000-8000-0000000000`, Org F
(`org_code = 'org-f-mir19f-380'`) with Team F and an approved org admin Fay (`role = 'org_admin'`, on
Team F), and `tests.id('admin_t')` as Org public's org admin. One assertion group per AC-9 item; `plan(n)`
equal to the assertion count. Inserts into `auth.users` name `id`, `email`, `raw_user_meta_data` and,
where confirmed, `email_confirmed_at`.

### 4.7 `tests/signup-org.test.ts` — new (Vitest)

Drives `@/lib/data/mock` directly with `vi.resetModules()` and
`vi.stubEnv("VITE_REQUIRE_EMAIL_CONFIRMATION", "true")`, as `tests/signup-confirmation.test.ts` does.
Signs in as `quan@example.com` / `FIXTURE_PASSWORD`. Calls `__setDedicatedOrgMembersForTest([quanId])`
**before** the Acme `signUp`, because the helper replaces the set. One `it` per AC-10 item, each naming
its item.

### 4.8 `tests/e2e/mir-19-f-org-signup.spec.ts` — new; `tests/e2e/mir-19-org-routing.spec.ts` — AC-9 only

New spec: one `test` per AC-1 to AC-7, titles prefixed `AC-n:`. Each new email is unique per test
(e.g. `mir19f-ac2@example.com`). Waits on elements, then reads `new URL(page.url()).pathname`.

`mir-19-org-routing.spec.ts`: in `test("AC-9: …")` only, the first block becomes *"`/shared/signup`
serves the form at `/shared/signup`"*; the title gains *"(amended by MIR-19-f)"*; one comment line cites
ADR-099 decision 3. The header comment gains one line, as MIR-19-d's did.

## 5. Seam impact

`signUp` keeps its name, arity and return type. `SignUpInput` gains the optional `orgCode`; both
implementations read it (§ 4.3, § 4.4). No function is added or removed, so the seam-parity test is
unchanged. The mock's `listPendingMembers`, `countPendingMembers` and `decideMember` are tightened to the
`org_id` clause SQL already has.

## 6. Schema delta

`supabase/migrations/20261112150000_mir19f_sign_up_lands_in_org.sql` — re-creates the trigger function
`public.admit_allow_listed_member()` so it writes `org_id` from `raw_user_meta_data.org_code` (Org public
when absent) and raises `sign_up_org_unknown` (`P0002`) on the `auth.users` insert when the code names no
org. No table, column, constraint, policy, trigger or grant change. Not `none` under ADR-014, because it
changes a trigger function. ADR-099. Applying it to the hosted project is human (RULE-09).

## 7. allowed_paths

```yaml
allowed_paths:
  - ".ai/registry/decisions/ADR-099-a-sign-up-at-an-org-address-lands-in-that-org-and-an-unknown-code-is-refused.md"
  - "supabase/migrations/20261112150000_mir19f_sign_up_lands_in_org.sql"
  - "supabase/tests/380-sign-up-lands-in-org.test.sql"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/routes/SignUp.tsx"
  - "src/App.tsx"
  - "tests/signup-org.test.ts"
  - "tests/e2e/mir-19-f-org-signup.spec.ts"
  - "tests/e2e/mir-19-org-routing.spec.ts"
```

11 paths, so `size: M`, which agrees with `size_estimate: M`. The sizing table reads *"changes the
schema"* as `XL`; this follows the MIR precedent (MIR-19, MIR-19-e, MIR-16-f): a schema change carried by
an ADR written under ADR-067 is sized by its file count. `010-catalogue.test.sql` is not listed: no new
function is created, and `admit_allow_listed_member()` is already in its census (`:93`).
`glossary_owed` is `[]`, so no glossary row is written.

## 8. Rejected alternatives

1. **An unknown code lands in Org public.** The sign-up never fails, and nothing reveals whether a code
   is in use. Rejected: a typo puts a stranger in another tenant's queue, and an Org public admin may
   admit them. ADR-099 *Options*.
2. **An `anon` function `org_accepts_sign_up(text)`, asked before the form is shown,** so an unknown code
   gets a not-found card instead of a failed submit. Rejected: an unthrottled oracle for which codes
   exist, and a new `security definer` surface for `anon`, against MIR-19's choice not to say whether an
   org exists.
3. **The sign-up screen stays at the root, with `?org=acme` carried across the crossing.** No App.tsx
   route change. Rejected: the address the person was given would change under them, and a second
   channel for the org (a query string) would sit beside the router's basename, which is the one
   ADR-097 chose.
4. **A specific "no such organisation" message**, by mapping GoTrue's generic 500 when an `orgCode` was
   sent. Rejected: any other 500 on that request (an SMTP failure, an outage) would be reported as a
   wrong address. The generic message is true in every case.

## Delegated decisions

- ADR-099 — `/{org_code}/signup` serves the sign-up screen under that org instead of crossing out
  (narrows ADR-097 decision 1), and `stamp_org_id()`'s `member` arm stays for owner-side inserts
  (narrows ADR-071's revert condition). Every org accepts sign-ups; an unknown or reserved code refuses
  the sign-up in the database.

## Changelog

- `2026-11-12T03:38:19Z` — all sections written. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
