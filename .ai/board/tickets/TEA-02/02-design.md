---
ticket: TEA-02
stage: DESIGN
agent: tech-lead-design
produced_at: 2026-08-31T17:14:11Z
branch: feat/TEA-02
session_note: >-
  Produced in the session that also wrote 01-story.md. session-model.md gives `ba` and
  `tech-lead-design` separate persistent sessions and the size verdict below judges that story's
  size_estimate, so this design was reached with the story's reasoning already in context rather
  than from the artifact cold. Raised once and overruled by the operator, who repeated the command.
  Recorded here because a reader comparing size to size_estimate is entitled to know the two were
  not reached independently.
inputs_read:
  - .ai/board/tickets/TEA-02/ticket.yaml
  - .ai/board/tickets/TEA-02/01-story.md
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-009-how-a-person-becomes-a-member.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/standards/architecture.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/standards/coding-standards.md
  - .ai/standards/ui-design-system.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/seed.sql
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/App.tsx
  - tests/seam-parity.test.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: IN_PROGRESS
---

# TEA-02 — Manage the allow-list — tech design

Design against `01-story.md` of `2026-08-31T16:56:07Z`, ADR-005 (authorization lives in row-level
security; there is no server) and ADR-009 (an admin's allow-list write is an ordinary RLS-governed
write, with no elevated credential anywhere).

**What this design settles that nothing upstream had settled:**

1. **The caller's identity becomes a seam function.** Every criterion in the story begins "given a
   signed-in admin", and the seam TEA-01 left has no way to ask who is calling — `getOwnMember`
   takes a `userId` that nothing can supply. Section 1.2 adds `getCurrentMember()`. This is the one
   place this design reaches into territory the sign-in half will also want, and section 7 says why
   that is the cheaper of the two errors available.
2. **AC-7's refusal is a policy predicate, not a check in the screen.** `consumed_at is null` goes in
   the `using` clause of the delete policy, so the refusal holds against anybody with a token rather
   than against this screen. Section 2.
3. **The mandatory permission-model test does not exist yet.** `.ai/standards/testing-standards.md`
   names it as one of two mandatory unit tests; TEA-01 listed it in `allowed_paths` and shipped
   without it. AC-4, AC-7 and AC-8 are policy assertions and have nowhere else to live, so this
   ticket writes it. Section 6.3.
4. **The seed grows a member-role member.** The permission-model test needs a token per role and the
   seed has only an admin, so the denial half of AC-8 has nobody to be denied as.

Verified rather than recalled:

| Fact | Read from | What it changed |
|---|---|---|
| `allowed_email` has a select policy for admins of the caller's team, and **no insert, update or delete policy**; `authenticated` holds `select` only | `supabase/migrations/20260831150024_tea01_membership.sql` | Every write in this ticket is denied today. Section 4 is a migration, not `none`. |
| `public.is_admin(uuid)` and `public.member_team_id(uuid)` exist, both `security definer` | same file | The new policies reuse them and define no third helper. |
| `allowed_email.email` is `citext` and the primary key | same file | AC-5 is the primary key doing its job; the interface maps the conflict to a typed failure and adds no lookup of its own. |
| The seam-parity test compares `Object.keys` of the exported `seam` object and per-key arity | `tests/seam-parity.test.ts` | A named export beside `seam` — the mock's test hook in section 1.4 — does not affect parity. |
| The seed contains one team, one admin, one unconsumed and one consumed allow-list entry, and no member-role member | `supabase/seed.sql` | Section 4.2 adds one. |
| `src/App.tsx` routes `*` to `/signup` and has no navigation | `src/App.tsx` | AC-9 is satisfied by the absence of a link plus the screen's own refusal; there is no menu to hide an item from. |

---

## 1. Contract

Every name below is either already in the repository or is introduced here. RULE-04: nothing is
invented at implementation time.

### 1.1 Domain types — `src/lib/domain/types.ts` (edit)

```ts
/** A row of `public.allowed_email`, in application casing. */
export interface AllowedEmail {
  email: string;          // citext in the datastore; already folded by PostgREST on the way out
  teamId: string;
  addedBy: string;        // member id of the admin who added it
  addedAt: string;        // ISO 8601
  consumedAt: string | null;  // null means the invitation is still open
}

/** How an entry is displayed (AC-1). Derived, never stored — `consumedAt` is the only source. */
export type AllowedEmailState = "open" | "joined";
```

`FailureCode` gains three members. They are the expected failures of this ticket, and per
`.ai/standards/coding-standards.md` an expected failure is returned rather than thrown:

```ts
  | "already_allow_listed"   // AC-5: the address is on the list, disregarding case
  | "already_consumed"       // AC-7: the entry has admitted somebody and cannot be removed
  | "not_permitted"          // AC-4, AC-8: the policy refused the write
```

### 1.2 Seam contract — `src/lib/data/index.ts` (edit)

```ts
export interface AddAllowedEmailInput {
  email: string;
}

export interface DataSeam {
  ready(): Promise<boolean>;
  signUp(input: SignUpInput): Promise<Result<SignUpOutcome>>;
  getOwnMember(userId: string): Promise<Member | null>;

  /**
   * AC-1, AC-9. The caller's own member row, or null when nobody is signed in or the auth user has
   * no member row. Null is a normal answer and not an error.
   */
  getCurrentMember(): Promise<Member | null>;

  /**
   * AC-1. Every allow-list entry the caller may read, newest first. Takes no team parameter: the
   * policy scopes the rows to the caller's team, and a parameter would imply the caller could ask
   * for another team's and be answered.
   */
  listAllowedEmails(): Promise<AllowedEmail[]>;

  /**
   * AC-2, AC-4, AC-5. `teamId` is never a parameter — the policy's `with check` supplies it, so
   * there is no value a caller could pass that would move an entry to another team.
   */
  addAllowedEmail(input: AddAllowedEmailInput): Promise<Result<AllowedEmail>>;

  /** AC-6, AC-7, AC-8. Refused by the policy for a consumed entry and for a non-admin. */
  removeAllowedEmail(email: string): Promise<Result<void>>;
}
```

**Why `listAllowedEmails` and `addAllowedEmail` take no `teamId`.** AC-4 says an admin must not create
an entry for another team. A parameter the policy then overrides is a parameter that lies; a parameter
the policy validates is a permission surface the interface can get wrong. Omitting it means the
question cannot be asked, which is the same reasoning `member_select_own` used in TEA-01.

### 1.3 The screen — `src/routes/AllowList.tsx` (new)

One route, `/allow-list`. Four states, and the first two are the AC-8 and AC-9 halves:

| State | When | Renders |
|---|---|---|
| loading | the first `getCurrentMember()` is in flight | `allow-list-loading`, which must resolve |
| refused | `getCurrentMember()` returns null, or a member whose `role` is not `admin` | `allow-list-refused` — no list, no form |
| empty | admin, and `listAllowedEmails()` returns `[]` | `allow-list-empty` plus the add form |
| list | admin, with entries | the table plus the add form |

The add form is one text input and one submit. The remove control appears only on rows whose state is
`open`; a `joined` row renders no remove control at all, which is the affordance over AC-7.

### 1.4 The mock's test hook — `src/lib/data/mock.ts` (edit)

```ts
/** Test-only. Sets which seeded member `getCurrentMember` answers as. Not part of the seam. */
export function __setCurrentMember(id: string | null): void;
```

It is a named export beside `seam`, so seam parity — which compares the keys of the `seam` object —
is untouched. Default is `FIXTURE_ADMIN.id`; the component and end-to-end tests set it to
`FIXTURE_MEMBER.id` to reach the refused state.

### 1.5 Fixtures — `src/lib/fixtures.ts` (edit)

```ts
/** A member-role member. The permission-model test needs a token per role and the seed had only an
 *  admin, so AC-8's denials had nobody to be denied as. */
export const FIXTURE_MEMBER: Member = {
  id: "33333333-3333-4333-8333-333333333333",
  teamId: FIXTURE_TEAM.id,
  displayName: "Thành viên",
  avatar: "🐱",
  role: "member",
  removedAt: null,
  createdAt: "2026-08-31T00:00:00+00:00",
};

/** A second team, for AC-4. Nothing renders it; it exists so that "another team" is a real id. */
export const FIXTURE_OTHER_TEAM_ID: string = "44444444-4444-4444-8444-444444444444";
```

Every literal above also goes into `supabase/seed.sql` in the same commit — the shared-fixture rule
in `.ai/standards/testing-standards.md`.

## 2. Permission model

Against `.ai/standards/rbac-and-security.md`. **The check lives in row-level security and nowhere
else** (ADR-005). Everything in the interface is an affordance and carries a comment saying so.

| Action | `anon` | `member` | `admin` | Where the check is |
|---|---|---|---|---|
| Read the allow-list | ❌ | ❌ | ✅ own team | `allowed_email_select_admin`, exists since TEA-01 |
| Add an address | ❌ | ❌ | ✅ own team | `allowed_email_insert_admin` — new, section 4 |
| Remove an address | ❌ | ❌ | ✅ own team, `consumed_at is null` | `allowed_email_delete_admin_unconsumed` — new, section 4 |
| Edit an entry | ❌ | ❌ | ❌ | no update policy exists and none is added |

**The two bounds on the admin's ✅ are both in the policy**, which is what makes AC-4 and AC-7 hold
against a raw token and not only against this screen:

- **Own team.** `with check (team_id = public.member_team_id(auth.uid()))` on insert; the same
  predicate in `using` on delete. AC-4.
- **Unconsumed.** `consumed_at is null` in the delete policy's `using`. AC-7. A consumed row is
  invisible to the delete, so the statement removes zero rows and the seam reports
  `already_consumed` — see section 3 on why zero rows is not silent success.

**Affordances, each decoration over one of the rows above:**

- `allow-list-refused` instead of the list, when the caller is not an admin (AC-9). It hides a screen
  the policy would empty anyway.
- No remove control on a `joined` row (AC-7).
- No navigation anywhere leads to `/allow-list`. There is no navigation at all yet, so AC-9 costs
  nothing to satisfy and will need revisiting the first time a menu exists.

**`.ai/standards/ui-design-system.md` *Destructive actions* is `TODO(project)` and this is the first
destructive action in the product.** The standard's stated rule — a confirmation must name what is
about to be lost, and *"Are you sure?" names nothing* — is applied here rather than deferred: the
confirmation names the address being removed. Removing an unconsumed entry loses nothing but the
invitation, so no count is named; there is nothing to count.

## 3. Seam impact

**Three functions added, one existing function untouched.** All three appear in both implementations
with the same name and arity, or the parity test fails.

| Function | `supabase.ts` | `mock.ts` |
|---|---|---|
| `getCurrentMember()` | `auth.getUser()`, then the existing `getOwnMember` path. No session means null. | the member whose id `__setCurrentMember` last set, default `FIXTURE_ADMIN` |
| `listAllowedEmails()` | `from("allowed_email").select(...).order("added_at", { ascending: false })` | the in-memory rows, filtered to the current member's team, same order |
| `addAllowedEmail(input)` | `.insert({ email, team_id: <the caller's team> }).select().single()` | folds the address, checks the list, appends |
| `removeAllowedEmail(email)` | `.delete().eq("email", email).select()` | folds, finds, refuses a consumed entry |

**Two shapes the parity test cannot catch, asserted separately per the standard's own warning:**

1. **A delete that removes zero rows is not success.** Under RLS a refused delete is not an error — it
   matches nothing. Both implementations therefore ask for the deleted rows back (`.select()`) and
   return `{ ok: false, error: { code: … } }` when none come. The code is `already_consumed` when the
   row exists and is consumed and `not_permitted` when it does not exist for this caller; the real
   implementation distinguishes them with one follow-up read, because the two are different sentences
   on screen and collapsing them would tell an admin their own entry does not exist.
2. **The insert's team comes from the datastore, not from the caller.** `supabase.ts` sets `team_id`
   from `getCurrentMember()`; the policy's `with check` then re-derives it and refuses a mismatch.
   The mock uses the current member's team. Neither reads a caller-supplied value, so AC-4 has no
   path through the interface at all.

**`mock.ts` must reproduce the policy's refusals, not the screen's.** This is the rule TEA-01's mock
already follows for the trigger: a mock that let a member add an address would make every component
test pass against a missing policy.

## 4. Schema delta

**Not `none`.** One migration, adding two policies and two grants — ADR-014 makes that a schema delta
regardless of what the policies do. The approved decision it hangs on is
**[ADR-009](../../../registry/decisions/ADR-009-how-a-person-becomes-a-member.md)**: *"An admin adds
an email address to an allow-list table. This is an ordinary write, governed by the same row-level
security as everything else — no elevated key anywhere."* This migration is that sentence expressed
as DDL, so **no new ADR is needed and this stage does not stop.**

`ticket.yaml` already carries the corrected `schema_delta` and `requires_adr: true`.

### 4.1 The migration — `supabase/migrations/<timestamp>_tea02_allow_list_writes.sql`

```sql
-- TEA-02. The write half of the allow-list. ADR-009 for the decision, ADR-014 for why this file
-- makes the ticket's schema_delta not `none`.

-- TEA-01 revoked everything and granted only select. Writes need their own grants; a policy alone
-- cannot admit a statement the role has no privilege to issue.
grant insert, delete on public.allowed_email to authenticated;

-- AC-2, AC-4. `with check` and not `using`: an insert has no existing row to test. The team is
-- derived from the caller rather than accepted from them, so AC-4 has no path through any client.
create policy allowed_email_insert_admin on public.allowed_email
  for insert to authenticated
  with check (
    public.is_admin((select auth.uid()))
    and team_id = public.member_team_id((select auth.uid()))
    and added_by = (select auth.uid())
    and consumed_at is null
  );

-- AC-6, AC-7, AC-8. `consumed_at is null` is the whole of AC-7 and it is here rather than in the
-- interface: a consumed row is invisible to this policy, so the delete matches nothing whoever
-- issues it. `added_by` is the only provenance for who admitted an existing member
-- (.ai/standards/data-model.md), and this predicate is what keeps it.
create policy allowed_email_delete_admin_unconsumed on public.allowed_email
  for delete to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id = public.member_team_id((select auth.uid()))
    and consumed_at is null
  );

-- Still no update policy on any of the three tables, deliberately. An entry that is wrong is removed
-- and re-added, which keeps added_by and added_at describing an act that actually happened
-- (01-story.md, Permissions). `member` still has no insert policy and must never gain one.
```

**`added_by = auth.uid()` in the `with check`** is not in the story and is added here: without it an
admin could attribute an entry to a colleague, and `added_by` is the field the data model calls the
only provenance for who let somebody in. It refuses nothing a legitimate client would send.

### 4.2 The seed — `supabase/seed.sql` (edit)

Adds `FIXTURE_MEMBER`'s auth user and member row, with the same literals as section 1.5, in the
existing insert order. Nothing else changes: the two allow-list entries already give AC-1 an `open`
row and a `joined` row.

## 5. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/*.sql"
  - "supabase/seed.sql"
  - "src/App.tsx"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/fixtures.ts"
  - "src/routes/AllowList.tsx"
  - "tests/permission-model.test.ts"
  - "tests/e2e/tea-02-allow-list.spec.ts"
```

Eleven globs, eleven files. `supabase/migrations/*.sql` is one new file and is a glob only because
`supabase migration new` generates the timestamp in the name — the Developer adds one file there and
must not edit TEA-01's.

`tests/seam-parity.test.ts` is deliberately **absent**. Three seam functions are added and it must
keep passing unedited; that is the whole of its value, and a ticket that may edit it can make it
agree with whatever it did.

### Size

**M.** Eleven files, against the story's `size_estimate` of M — the two agree, and section 7 records
what was left out to keep it there.

**Not XL.** The XL row covers a change to the schema, to an existing seam signature, or to a shared
type module, with the stated test being *whether existing callers must change*. This migration adds
policies to a table it does not alter, adds seam functions without touching `signUp` or
`getOwnMember`, and adds types to `types.ts` without changing `Member`, `Session` or `Result`. No
existing caller changes. This is the same reading TEA-01's design took and it is recorded again
because the literal words and the stated test still diverge.

### Prerequisites this ticket does not own

**The sign-in half of feature TEA-01 does not exist and has no ticket.** `01-story.md` names it, and
it lands here as a concrete limit rather than a note:

- In a real build `getCurrentMember()` returns null on every call, because nothing ever creates a
  session. **The screen will render `allow-list-refused` for everybody, including a real admin.**
- So the end-to-end test drives the **mock** seam (`VITE_DATA_SEAM=mock`), which is how
  `tests/e2e/tea-01-signup.spec.ts` already runs, and section 6.3 puts the policy assertions in
  `tests/permission-model.test.ts` against a real database with a token per role.
- **Every criterion is verifiable and the feature is not usable.** That is a true and uncomfortable
  pair, and it is the cost of TEA-01 shipping as a half. It does not block this ticket and it will
  block the first person who tries to use the screen.

**No Supabase project is provisioned.** Unchanged from TEA-01: the migration can be written, not
applied, and `tests/permission-model.test.ts` needs a real PostgreSQL to run at all.

## 6. Testability contract

The attribute is `data-testid`, named once in `.ai/standards/testing-standards.md`. RULE-05 makes this
table the only channel through which these controls reach QA.

`allow-list-row`, `allow-list-row-remove` and `allow-list-row-state` appear once per entry and are
addressed by the row's `data-email`; every other selector identifies exactly one element.

| selector | Element | Used by |
|---|---|---|
| `app-root` | The routed shell in `App.tsx`. Already exists. | all |
| `seam-banner` | The mock-seam banner. Already exists; asserts which implementation drove the test. | all |
| `allow-list-loading` | Placeholder while the first `getCurrentMember()` is in flight. Present so QA can assert it **disappears**. | AC-1, AC-9 |
| `allow-list-refused` | The state shown to a non-admin: no list, no form. | AC-8, AC-9 |
| `allow-list-empty` | The empty state, shown to an admin with no entries. | AC-1 |
| `allow-list-table` | The table of entries. | AC-1, AC-2, AC-6 |
| `allow-list-row` | One entry. Carries `data-email` with the address and `data-state` with `open` or `joined`. | AC-1, AC-2, AC-5, AC-6 |
| `allow-list-row-state` | The open/joined indicator within a row. | AC-1 |
| `allow-list-row-added-by` | Who added the entry, and when. | AC-1 |
| `allow-list-row-remove` | The remove control. **Rendered only on an `open` row.** | AC-6, AC-7 |
| `allow-list-add-email` | The address input on the add form. | AC-2, AC-5 |
| `allow-list-add-submit` | The add form's submit. | AC-2, AC-5 |
| `allow-list-add-error` | The typed failure from `addAllowedEmail`, rendered as a sentence. | AC-5 |
| `allow-list-remove-confirm` | The confirmation dialog. Names the address being removed. | AC-6 |
| `allow-list-remove-confirm-accept` | Its accept control. | AC-6 |
| `allow-list-remove-confirm-cancel` | Its cancel control. | AC-6 |
| `allow-list-no-email-notice` | The permanent line saying the system sends nothing and the admin must tell the person. | AC-10 |

### 6.2 Which implementation a test drives

Unchanged from TEA-01 and restated because it is load-bearing here: `src/lib/data/index.ts` chooses,
and `seam-banner` reports the choice. The end-to-end suite for this ticket runs against the mock,
for the reason in *Prerequisites* above.

### 6.3 `tests/permission-model.test.ts` — the mandatory test, written here

`.ai/standards/testing-standards.md` requires it — *"every role, every action, both directions,
including the denials"* — and it does not exist. This ticket creates it with a token per role against
a real database, covering the three allow-list rows in both directions plus the two bounds:

| Assertion | AC |
|---|---|
| admin reads own team's entries; member reads none | AC-1, AC-8 |
| admin inserts; member's insert is refused | AC-2, AC-8 |
| an insert naming another team is refused | AC-4 |
| a duplicate address, differing only in case, is refused | AC-5 |
| admin deletes an unconsumed entry | AC-6 |
| admin's delete of a consumed entry removes nothing | AC-7 |
| member's delete is refused | AC-8 |

It also carries TEA-01's `getOwnMember` role assertions, which had nowhere to live when TEA-01
shipped without this file. **That is not scope creep into TEA-01** — the file is new, the assertions
are two lines, and a permission-model test that covers one table while the seam exposes two is the
kind of gap the standard's "both directions" language exists to close.

## 7. Rejected alternatives

**Taking the caller's member from a React context populated at sign-in, instead of adding
`getCurrentMember()` to the seam.** This is what the sign-in half will build, and it is the reason the
alternative is genuine rather than a strawman: adding the function here means two tickets have a claim
on the same contract, and the sign-in ticket may want a subscription rather than a one-shot read.
Rejected because the context does not exist and cannot be built here — a provider fed by
`onAuthStateChange` is the sign-in half's central object, and building a throwaway one would be
building that ticket badly and then deleting it. A one-shot read is additive: the sign-in half can
back the context *with* `getCurrentMember()` and nothing in this ticket changes. The reverse — a
context built here and replaced there — costs a rewrite in a file this ticket owns.

**Enforcing AC-7 in the interface by hiding the remove control on a `joined` row, and nothing more.**
Rejected on ADR-005: a control that is only hidden is bypassed by issuing the delete from anywhere
else, and `added_by` is the only record of who admitted an existing member. The hidden control stays,
as the affordance, over a policy that refuses independently.

**Adding an update policy so a mistyped address can be corrected in place.** Rejected because
`added_at` and `added_by` would then describe an act that did not happen — an entry edited on Tuesday
still claiming it was added on Monday by whoever added the wrong address. Remove-and-re-add costs one
extra click and keeps both fields honest. Recorded because it is the first thing an admin will ask
for.

**Letting `addAllowedEmail` take a `teamId`, validated by the policy.** Rejected in section 1.2: a
parameter the policy overrides is a parameter that lies, and one the policy validates is a permission
surface the interface can get wrong. Omitting it makes AC-4 unreachable through any client this
repository builds.

## Open questions

None blocking.

- **`.ai/standards/ui-design-system.md` *Destructive actions* is `TODO(project)`** and this ticket
  introduces the product's first destructive action. Section 2 applies the rule the standard already
  states — the confirmation names the address — but the list the standard asks for is still unwritten,
  and the next destructive action will face the same gap.
- **AC-9 is cheap only because there is no navigation.** The first ticket that adds a menu inherits
  the real version of this criterion.

## Changelog

- `2026-08-31T17:14:11Z` — sections 1–7 created. Raised by `ba` (`01-story.md`). Amended by
  `tech-lead-design`.
