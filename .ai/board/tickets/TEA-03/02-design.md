---
ticket: TEA-03
stage: DESIGN
agent: tech-lead-design
produced_at: 2026-09-01T07:58:50+07:00
inputs_read:
  - .ai/board/tickets/TEA-03/01-story.md
  - .ai/board/tickets/TEA-03/ticket.yaml
  - .ai/registry/invariants.md
  - .ai/registry/glossary.md
  - .ai/registry/features.md
  - .ai/registry/decisions/ADR-005-authorization-in-rls.md
  - .ai/registry/decisions/ADR-012-design-resizes-without-routing-back.md
  - .ai/registry/decisions/ADR-013-removed-members-count-until-removal.md
  - .ai/registry/decisions/ADR-014-policy-migrations-are-not-schema-delta-none.md
  - .ai/registry/decisions/ADR-017-the-qa-gate-is-temporarily-waived.md
  - .ai/registry/decisions/ADR-018-who-may-read-the-member-list.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/data-model.md
  - .ai/standards/coding-standards.md
  - .ai/standards/testing-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/board/tickets/TEA-02/02-design.md   # sections 5 and 6 only, for the precedent this one follows
  - src/lib/data/index.ts
  - src/lib/data/supabase.ts
  - src/lib/data/mock.ts
  - src/lib/domain/types.ts
  - src/lib/fixtures.ts
  - src/routes/AllowList.tsx
  - src/App.tsx
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260901090000_tea02_allow_list_writes.sql
  - supabase/seed.sql
  - tests/seam-parity.test.ts
  - playwright.config.ts
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: IN_PROGRESS
---

# TEA-03 — Team member list — technical design

## 1. Contract

Every name below is decided here or already exists in `.ai/standards/data-model.md`. RULE-04: the
Developer invents none of them.

### 1.1 Domain types — one constant added, no type changed

`Member` in `src/lib/domain/types.ts` already carries every field this ticket displays and reads:
`id`, `teamId`, `displayName`, `avatar`, `role`, `removedAt`, `createdAt`. **No domain type is added
and none is changed.** `MemberRole` already has the two values. No `FailureCode` is added — see §1.2
on why this read throws rather than returning a `Result`.

One runtime constant is added, beside the existing `AVATAR_CHOICES`:

```ts
/**
 * AC-8. The explicit row limit the roster read asks for, and the count at which it refuses to
 * answer. Above any plausible team size — the glossary records exactly one team in v1 and the
 * brief's worked example is ten people — and deliberately far below the datastore's own cap, so
 * that this assertion fires before the server's silent one does.
 */
export const ROSTER_LIMIT = 500;
```

**Why it lives in `src/lib/domain/types.ts` and not in the seam's `index.ts`.** Both implementations
need it, and both already import *types* from `./index`; those imports are erased at build. A
**runtime** import from `index.ts` into `mock.ts` or `supabase.ts` would not be erased, and
`index.ts` imports both implementations — that is a real cycle at load time. `types.ts` imports
nothing from `src/lib/data/`, and it already carries a runtime constant for exactly this reason.

**The constant's validity has one external dependency, cited rather than re-raised.** The assertion
only fires if `ROSTER_LIMIT` sits *below* the datastore's own `max-rows` cap; if the server cap were
lower, the server would truncate at its number and this check would never see its own. The unknown
cap is the `TODO(verify):` already carried by CAL-04, ADM-02 and ADM-04 in `.ai/registry/features.md`,
and `01-story.md` §AC-8 says it is not re-raised here. 500 is chosen to sit under any plausible
setting; if the cap turns out to be lower, the fix is this one number.

### 1.2 The seam — one function added

Added to `DataSeam` in `src/lib/data/index.ts`, and to both implementations with the same name and
arity:

```ts
/**
 * TEA-03 AC-1, AC-2, AC-3, AC-4, AC-6, AC-7, AC-8. The caller's team roster.
 *
 * Takes no team parameter: `member_select_team` scopes the rows to the caller's own team, and a
 * parameter would imply the caller could ask for another team's and be answered (the same
 * reasoning that kept `teamId` off `addAllowedEmail`).
 *
 * RETURNS REMOVED MEMBERS, carrying `removedAt`. Which rows the screen draws is a display decision
 * above the seam; which rows the read returns is not — ADR-013 and the INV-04 note require the
 * counting function to be GIVEN the roster with `removedAt` per member, because it cannot derive
 * membership-as-of-a-date from the entries. A filter here would make INV-04 uncomputable for every
 * past date, and CAL-04 and CAL-06 unbuildable against this read.
 *
 * Ordered by `createdAt` ascending, then `id` ascending. Deterministic in both implementations —
 * see §1.4.
 *
 * An empty array is a normal answer and not an error: it is what the policy returns to a caller
 * with no member row (AC-7) and to a caller with no session (AC-6).
 *
 * THROWS on a transport failure and on a possibly-truncated answer (AC-8). There is no
 * caller-visible failure shape, so a `Result` would have nothing to carry; returning `[]` for a
 * broken connection would report "you are on no team" for what is a network fault, and returning a
 * short list for a capped read is the exact failure AC-8 exists to prevent.
 */
listMembers(): Promise<Member[]>;
```

**The name.** `.ai/standards/coding-standards.md` requires data-access functions to read as verbs
against an entity — `listOrders`, `getOrderById`. The entity is `member`, so the function is
`listMembers`, matching `listAllowedEmails` against `allowed_email`. It is not `listTeamMembers`:
the team is not a parameter and not a filter this function applies, it is what the policy already
means.

**No existing signature changes.** `ready`, `signUp`, `getOwnMember`, `getCurrentMember`,
`listAllowedEmails`, `addAllowedEmail` and `removeAllowedEmail` are untouched, so no existing caller
changes. That is the §5 sizing test.

### 1.3 The screen — `src/routes/MemberList.tsx`, route `/members`

Four states, and `loading` must resolve into one of the other three. The shape follows
`src/routes/AllowList.tsx`, with one deliberate difference recorded in §1.3.1.

```ts
type View =
  | { phase: "loading" }
  | { phase: "notOnATeam" }                          // AC-7
  | { phase: "unavailable" }                         // AC-8, and any throw from the read
  | { phase: "ready"; me: Member; roster: Member[] }; // AC-1, AC-3, AC-4
```

The load sequence, in this order:

1. `const me = await seam.getCurrentMember()`.
2. `me === null` → `notOnATeam`. **This is the whole of AC-7.** The policy scopes to the caller's
   team by way of the caller's own member row; with no such row there is no team, and the two
   available answers are "nothing" and "everything". The screen must say which one it got.
3. otherwise `const roster = await seam.listMembers()` → `ready`.
4. any throw from either call → `unavailable`.

**What the screen draws (AC-1, AC-4).** `roster.filter(m => m.removedAt === null)`, each row showing
`avatar`, `displayName` and `role`. The filter is in the component and nowhere below it: AC-4's two
halves are *the read keeps them* and *the screen does not list them*, and this line is the second
half. It carries a comment naming AC-4 and ADR-013, per `.ai/standards/coding-standards.md`
(*a comment naming an invariant ID at the point that upholds it is valuable*).

**Role is displayed, not acted on.** `role` renders as a label — `Quản trị viên` / `Thành viên`. There
is no control on this screen that writes anything, which is the whole of the affordance over AC-5;
see §2.

#### 1.3.1 Why this screen has an error state and `AllowList.tsx` does not

`AllowList.tsx` folds a throw into `refused`, deliberately, because failing closed on a permission
screen is the safe direction. **Here that would be wrong twice.** A caller who is on a team would be
told they are not, which is AC-7's sentence used as a lie; and a truncated read would be
indistinguishable from a small team, which is precisely the arithmetic failure AC-8 describes —
the roster is INV-04's denominator, so a roster short by two people raises the ratio on every date.
AC-8 requires that **no screen consumes the possibly-truncated result**, so the honest state is
"this list could not be read", and a partial list is never rendered.

### 1.4 Ordering — `createdAt` ascending, then `id` ascending

The story specifies no order and one is needed, because an unordered read is untestable and the two
implementations would be free to disagree.

`created_at asc, id asc` in PostgREST; `sort` on the same two keys in the mock. **The `id`
tiebreaker is not decoration:** `FIXTURE_ADMIN` and `FIXTURE_MEMBER` in `src/lib/fixtures.ts` carry
the *same* `createdAt` literal (`2026-08-31T00:00:00+00:00`), so `created_at` alone leaves their
order undefined in PostgreSQL and dependent on insertion order in the mock. Two implementations that
disagree about row order fail nothing and produce a flaky test.

Ordering by `displayName` was rejected — §7.

### 1.5 Fixtures — three added

In `src/lib/fixtures.ts`, with the identical literals inserted by `supabase/seed.sql` in the same
commit. `FIXTURE_OTHER_TEAM_ID` already exists as a bare id and now needs a real `team` row behind
it, because `member.team_id` references `team(id)`.

| Name | What it is | Needed by |
|---|---|---|
| `FIXTURE_OTHER_TEAM` | `{ id: FIXTURE_OTHER_TEAM_ID, name: "Nhóm khác", overloadThreshold: 0.5 }` — the second team AC-2 is asserted against | AC-2 |
| `FIXTURE_OTHER_TEAM_MEMBER` | A `Member` of `FIXTURE_OTHER_TEAM`, id `66666666-6666-4666-8666-666666666666`, role `member` | AC-2 |
| `FIXTURE_REMOVED_MEMBER` | A `Member` of `FIXTURE_TEAM` with `removedAt` set to `2026-08-31T12:00:00+00:00`, id `77777777-7777-4777-8777-777777777777`, role `member` | AC-4 |

**Ids are picked to avoid the collision `FIXTURE_MEMBER` already recorded.** `33333333-…` is the
operator's own admin account in `supabase/seed.sql` and `55555555-…` is `FIXTURE_MEMBER`; the two
new ids are unused. `44444444-4444-4444-8444-444444444444` is `FIXTURE_OTHER_TEAM_ID` and stays a
team id.

## 2. Permission model

Against `.ai/standards/rbac-and-security.md`. **One row, and its being one row is a criterion.**

| Action | `member` | `admin` | Where the check runs |
|---|---|---|---|
| Read the member list | ✅ | ✅ | `member_select_team` on `public.member` (§4) |

`member` and `admin` are the same PostgreSQL role, `authenticated`; the predicate does not mention
`role` at all, which is why an admin cannot receive a row or a field a member does not (AC-3). There
is no second policy for admins and none may be added — ADR-018 records that a ticket needing one is
a change to the envelope and goes to the operator.

### The denials, and what holds each

| Denial | AC | Held by |
|---|---|---|
| A row of another team, in either role | AC-2 | `team_id = public.member_team_id((select auth.uid()))` in `member_select_team`. The predicate is the team boundary; nothing above it filters by team. |
| An admin reading more rows or fields than a member | AC-3 | One policy, no `role` in its predicate, one column list in the seam (`MEMBER_COLUMNS`, already exists). |
| Any insert, update or delete of `member` | AC-5 | **The absence of a policy.** Row-level security is enabled on `public.member` and no write policy exists; this migration adds none, and ADR-018 §Decision 3 forbids one now or later. TEA-01 also granted `select` only — `insert`, `update` and `delete` were never granted to `authenticated`, so the write is refused twice. |
| A caller with no session | AC-6 | `revoke all … from anon` plus `to authenticated` on the policy (TEA-01's migration). The new policy is `to authenticated` for the same reason: written `to public` it would re-open the table to the key that ships in the bundle by design. |
| A signed-in caller with no member row | AC-7 | `member_team_id` returns null for them, `team_id = null` is never true, and `member_select_own` matches no row either. Zero rows, from the policy. |

### Affordances, which enforce nothing (ADR-005)

Two, and both carry a comment saying so:

- **The `notOnATeam` state.** It converts the policy's zero rows into a sentence. It is not a check:
  a caller with no member row gets nothing from PostgREST whatever this screen renders.
- **The absence of every write control.** There is no add, edit, remove or promote control on this
  screen — not because they are hidden, but because they do not exist here. TEA-04 owns the two that
  will, and it adds the policies for them.

The `removedAt` filter in §1.3 is **not** an affordance and must not be commented as one. It is a
display decision over a read that deliberately returns more than the screen shows.

## 3. Seam impact

**One function added: `listMembers()`.** It appears in `DataSeam` and in both implementations with
the same name and arity, or `tests/seam-parity.test.ts` fails — which it must do unedited, which is
why that file is absent from `allowed_paths` (§5).

No existing seam function changes. `getOwnMember` and `getCurrentMember` both go through
`readMember`, which filters by id alone and relies entirely on the policy; adding a second permissive
policy widens what `member_select_own` already allowed them and changes neither call.

### Two return shapes parity cannot catch, and must be asserted

`.ai/standards/architecture.md`: *parity is necessary and not sufficient … where a return shape is
subtle, assert it.* Both of these are behaviours of the **policy**, so the mock reproduces the
policy and not the screen — the same rule TEA-02's mock follows.

**Shape 1 — the read returns removed members.** `mock.listMembers()` must not filter `removedAt`.
A mock that filtered would make every component test pass against a seam that has already made
INV-04 uncomputable, and the screen's own filter would hide the difference.

**Shape 2 — the mock reproduces both policies composing, including for a removed caller.** Row-level
security policies are permissive and OR together (ADR-018). The mock's `listMembers` is therefore:

| Caller | Rows | Because |
|---|---|---|
| `null` | `[]` | no session, or no member row — AC-6, AC-7 |
| a member with `removedAt` set | their own row only | `member_select_own` answers; `member_team_id` filtered them out so `member_select_team` does not |
| an active member | every member of their `teamId`, **removed ones included** | `member_select_team`, which does not filter `removedAt` |

The middle row is the state ADR-018 §Consequences created on purpose, and a mock that collapsed it
into `[]` would erase the difference between *removed* and *never admitted* — the distinction the ADR
rejected replacing `member_select_own` in order to keep.

**Both implementations apply `ROSTER_LIMIT` and raise at it.** In `supabase.ts` this is
`.limit(ROSTER_LIMIT)` and `if (rows.length >= ROSTER_LIMIT) throw`. The mock applies the same limit
and the same raise; its array is bounded by the fixtures so it never fires, and it is there so the
two implementations tell one story rather than because the mock can truncate.

## 4. Schema delta

**Not `none`.** One new migration, `create policy` only — ADR-014 admits no carve-out for a `select`
policy, and `01-story.md` records the field being corrected from `none` at SPEC.

**ADR-018 — Who may read the member list, and the policy that carries it** is `ACCEPTED by steward`
(2026-09-01) and linked in `ticket.yaml`. Definition of Ready item 4 passes, so this section does
**not** stop with BLOCKED: the decision this stage would have escalated for is already recorded.

`supabase/migrations/<timestamp>_tea03_member_select_team.sql`, generated by
`supabase migration new` — the Developer adds one file there and edits neither existing migration.
Its entire content is the statement ADR-018 §Decision fixes:

```sql
create policy member_select_team on public.member
  for select to authenticated
  using (team_id = public.member_team_id((select auth.uid())));
```

**What the file must not contain**, each from ADR-018 §Consequences:

- No `drop policy`. `member_select_own` is **kept** — replacing it leaves a removed member unable to
  read even their own row, which collapses AC-7 and AC-4 together.
- No `grant`. TEA-01 already granted `select on public.member` to `authenticated`.
- No `alter table`, no column, no new helper. `public.member_team_id(uuid)` exists from TEA-01 and is
  `security definer`, so a policy on `member` may consult `member` without recursing through
  `member`'s own policies.
- No `removed_at` condition. ADR-018 §Decision 2.
- No insert, update or delete policy, now or ever.

**Applying it is human — RULE-09.** No agent runs `supabase db push`.

### 4.1 The seed — `supabase/seed.sql`

Three rows the story's criteria have nothing to run against without: a second `team`, a member on it
(AC-2), and a removed member on the first team (AC-4). Each `member` needs an `auth.users` row first,
because `member.id` references it, and each `auth.users` insert must set `confirmation_token`,
`recovery_token`, `email_change_token_new` and `email_change` to `''` — **MD-014**, which is why
every seeded account in this file already does.

Insert order is forced by the foreign keys and none of them cascade: `team` → `auth.users` →
`member`. Appended to the existing blocks, never interleaved with them.

**ADR-018's revert condition names this seed data specifically.** Exactly one team exists in v1, so
AC-2 is unobservable through the interface and a one-team fixture passes whether the scope is in the
predicate or absent from it.

## 5. allowed_paths

```yaml
allowed_paths:
  - "supabase/migrations/*.sql"
  - "supabase/seed.sql"
  - "src/lib/domain/types.ts"
  - "src/lib/data/index.ts"
  - "src/lib/data/supabase.ts"
  - "src/lib/data/mock.ts"
  - "src/lib/fixtures.ts"
  - "src/routes/MemberList.tsx"
  - "src/App.tsx"
  - "tests/permission-model.test.ts"
  - "tests/e2e/tea-03-member-list.spec.ts"
```

Eleven globs, eleven files. `supabase/migrations/*.sql` is one new file and is a glob only because
`supabase migration new` generates the timestamp in the name; the Developer adds one file there and
must not edit TEA-01's or TEA-02's.

**`tests/seam-parity.test.ts` is deliberately absent.** One seam function is added and it must keep
passing unedited — that is the whole of its value, and a ticket permitted to edit it can make it
agree with whatever it did.

**`src/routes/AllowList.tsx` is deliberately absent.** Its `allow-list-row-added-by` cell renders a
raw member id with the comment *"there is no seam function that turns one into a name — the member
list is TEA-03"*. There now is one. Resolving it is a real improvement, it has no acceptance
criterion here, and it is TEA-02's file — §7.

### Size

**M.** Eleven files, against `01-story.md`'s `size_estimate` of **S**.

**The two disagree, and the disagreement is reported rather than smoothed over.** Under ADR-012 the
verdict wins and DESIGN proceeds: this ticket is not routed back to `ba`, because a second pass would
read the same design and reach the same size — the size comes from the enumerated list above, not
from anything the story could have said differently. The S estimate is defensible from the story
alone, which describes one read and one plain list; what it could not see is that AC-2 needs a second
team seeded, AC-4 needs a removed member seeded, and AC-8 needs a shared constant and a raise in two
implementations. Four of the eleven files exist only to make criteria observable.

**This is the first ticket whose `size` exceeds its `size_estimate`** — TEA-01 and TEA-02 were both
M against M. ADR-012's revert condition is three consecutive such tickets, and it is watched in
`metrics.md`, so this one is recorded here as the first rather than left to be reconstructed later.

**Not L.** Eleven is inside M's twelve, and nothing here splits: the read path and the screen over it
are one operation, and *never split backend from frontend alone* — that produces a ticket the QA gate
has nothing to run.

**Not XL.** The XL row covers a change to the schema, to an existing seam signature, or to a shared
type module, and its stated test is *whether existing callers must change*. This migration adds one
policy to a table it does not alter, adds one seam function without touching the seven that exist,
and adds one constant to `types.ts` without changing `Member`, `Session`, `Result` or any other
shape. No existing caller changes. This is the reading TEA-01 and TEA-02 both took.

### Prerequisites this ticket does not own

**The sign-in half of feature TEA-01 still does not exist — but it now has a ticket, TEA-05.**
`01-story.md` names it as out of scope and every criterion begins "given a signed-in…". The concrete
consequence is unchanged from TEA-02 and must be stated rather than discovered:

- In a real build `getCurrentMember()` returns null on every call, because nothing ever creates a
  session. **`/members` will render `member-list-not-on-a-team` for everybody, admin included.**
- So the end-to-end suite drives the **mock** seam, as `tests/e2e/tea-01-signup.spec.ts` already
  does, and the policy assertions live in `tests/permission-model.test.ts` against a real database
  with a token per role (§6.3).
- **Every criterion is verifiable and the screen is not usable.** That pair is the cost of TEA-01
  shipping as a half; it does not block this ticket and it is TEA-05's to close.

**A Supabase project now exists**, which is new since TEA-02's design said none did: `.env` carries
`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_DB_URL`.
`tests/permission-model.test.ts` can therefore run for the first time. Two limits come with that and
neither is this ticket's to settle:

- `.ai/standards/architecture.md` §Configuration and environment requires policy tests to point at a
  **disposable** database and says a suite that can reach production data is one command away from
  writing to it. That section is still `TODO(project):`. The test must read `SUPABASE_DB_URL` and
  **skip when it is absent** rather than fail — `vitest` owns `tests/**/*.test.ts`, so an unskippable
  database test turns `pnpm exec vitest run` red for everybody who has no `.env`.
- The service-role key is in `.env`, which is now git-ignored (commit `f118ca4`). Known weakness 2 in
  `.ai/standards/rbac-and-security.md` still applies and nothing here changes it.

## 6. Testability contract

The attribute is `data-testid`, named once in `.ai/standards/testing-standards.md`. **RULE-05 makes
this table the only channel through which these controls reach QA** — a control missing here does not
exist as far as QA is concerned.

`member-list-row` and the three cells inside it appear once per drawn member and are addressed by the
row's `data-member-id`; every other selector identifies exactly one element.

| selector | Element | Used by |
|---|---|---|
| `app-root` | The routed shell in `App.tsx`. Already exists. | all |
| `seam-banner` | The mock-seam banner. Already exists; asserts which implementation drove the test. | all |
| `member-list-loading` | Placeholder while `getCurrentMember()` and `listMembers()` are in flight. Present so QA can assert it **disappears**. | AC-1 |
| `member-list-not-on-a-team` | The state shown to a caller with no member row: no list, and a sentence saying they are not on a team. **Not an empty list.** | AC-7 |
| `member-list-unavailable` | The state shown when the read throws — a transport failure, or AC-8's refusal to return a possibly-truncated roster. No partial list is drawn. | AC-8 |
| `member-list-table` | The roster. | AC-1, AC-2, AC-3 |
| `member-list-row` | One drawn member. Carries `data-member-id` with the member's id and `data-role` with `member` or `admin`. | AC-1, AC-2, AC-3, AC-4 |
| `member-list-row-avatar` | The member's avatar within a row. | AC-1 |
| `member-list-row-name` | The member's `displayName` within a row. | AC-1 |
| `member-list-row-role` | The member's role within a row, as a label. | AC-1, AC-3 |
| `member-list-empty` | Shown when the roster is read successfully and no member survives the `removedAt` filter. | AC-4 |

**`data-member-id` is how AC-1's *the caller included* is asserted** — the caller's own id appears as
a row — and how AC-2's *no row belonging to team U* is asserted, by the absence of
`FIXTURE_OTHER_TEAM_MEMBER`'s id. No "this is you" marker is drawn: the story does not ask for one
and the attribute already answers the question.

**AC-3 is asserted by comparison, not by a selector of its own.** The same page is loaded as an admin
and as a member and the two sets of `member-list-row` ids and cell contents must be equal. A selector
that appeared only for one role would be the defect, not the test.

### 6.1 The criteria with no interface

AC-5 and AC-6 have no control and no state on this screen — they are the write refusal and the
anonymous read, and both are properties of the policy and the grant. They are asserted in
`tests/permission-model.test.ts` (§6.3) and nowhere else. AC-2 has a screen half and a policy half;
the screen half is unobservable in a one-team fixture, so its real assertion is also there.

### 6.2 Which implementation a test drives

Unchanged from TEA-01 and TEA-02, and load-bearing here: `src/lib/data/index.ts` chooses, and
`seam-banner` reports the choice. The end-to-end suite for this ticket runs against the **mock**, for
the reason in §5 *Prerequisites*. Such a run proves the screen and the mock's imitation of the two
policies; **it proves nothing about the policies themselves**, and nothing in the e2e suite may be
read as covering them.

### 6.3 `tests/permission-model.test.ts` — still the mandatory test, and it still does not exist

`.ai/standards/testing-standards.md` requires it — *every role, every action, both directions,
including the denials* — and a `git ls-files` on 2026-09-01 confirms no such file. **TEA-02's design
specified it in the same words and it was never written**, because ADR-017 waives entry into the QA
stage and the Developer's `allowed_paths` are not the same thing as an instruction. Repeating that
specification without recording the outcome would be designing the same gap a second time.

What this ticket needs from it, with a token per role against a real database:

| Assertion | AC |
|---|---|
| a member reads every row of their own team, removed members included | AC-1, AC-4 |
| an admin reads exactly the same row ids and the same columns as a member | AC-3 |
| neither role receives a row belonging to `FIXTURE_OTHER_TEAM` | AC-2 |
| the anon key alone reads zero rows | AC-6 |
| a signed-in auth user with no `member` row reads zero rows | AC-7 |
| a removed member reads their own row and no other | ADR-018 §Consequences |
| insert, update and delete on `member` are each refused, in both roles | AC-5 |
| a roster of `ROSTER_LIMIT` rows makes `listMembers()` throw rather than return | AC-8 |

It must skip when `SUPABASE_DB_URL` is absent — §5 *Prerequisites*.

### 6.4 Under ADR-017 nobody is dispatched to write either test file

Stated plainly because it decides whether this ticket ships tested. ADR-017 runs the loop
`REVIEW -> DONE`; the QA stage is not entered, and Definition of Done items 3 and 4 — *every AC maps
to a named test*, *unit and end-to-end tests exit 0* — are suspended for its duration. `/qa` still
runs correctly **if the operator invokes it by hand**, which is the only path by which the two files
in `allowed_paths` come to exist.

This design does not route around that, and it does not reassign the tests to the Developer: RULE-05
exists because a test written by the author of the implementation agrees with the implementation,
including where it is wrong, and the fix for a waived gate is not to quietly re-home the work it was
skipping. What the design owes is the record — §6 is complete and independent, so `/qa` can be run
against it at any point, before or after this ticket ships. **MD-016 already carries the register
row** for the waiver having no counter; this is the second ticket to depend on it.

## 7. Rejected alternatives

**Filtering `removed_at is null` in the read — in the policy, or in `listMembers`.** Genuinely
plausible and the first thing most implementations do: the screen shows current members, so returning
only current members looks like the same requirement one layer down, and it makes the component
simpler. Rejected because it is the exact failure AC-4 was written to catch. ADR-013 and the INV-04
note require the counting function to be **given** the roster with `removedAt` per member, since it
cannot derive membership-as-of-a-date from the entries; a filter in the read makes INV-04
uncomputable for every past date and CAL-04 and CAL-06 unbuildable against this seam. Worse, it fails
silently and looks correct today, because nothing in this ticket computes a count. In the policy it
would fail a second way — a removed caller would lose their own row, which is the shape ADR-018
rejected.

**Ordering by `displayName`.** The obvious order for a roster, and what a reader expects. Rejected on
parity: the mock would sort with JavaScript's `localeCompare` and the real implementation with
PostgreSQL's collation, and Vietnamese diacritics are exactly where the two disagree — `Đ` against
`D`, and the tone marks the type stack in `CLAUDE.md` exists to render correctly. Two implementations
that order differently pass `tests/seam-parity.test.ts` and produce a test that fails on one of them.
`createdAt, id` is deterministic in both and costs a roster of ten people nothing. If alphabetical
order is wanted it belongs above the seam, where one implementation sorts one array.

**Giving `listMembers` a `teamId` parameter, validated by the policy.** Symmetrical with what the
screens will eventually want when multiple teams exist, and it reads as more explicit. Rejected for
the reason that kept `teamId` off `addAllowedEmail`: a parameter the policy overrides is a parameter
that lies, and one the policy validates is a permission surface the interface can get wrong. Omitting
it makes AC-2 unreachable through any client this repository builds, so the only way to test the team
boundary is against the policy — which is where ADR-018 puts its revert condition.

**Resolving `allow-list-row-added-by` to a display name now that a roster exists.** TEA-02's screen
renders a raw uuid there and its own comment points at this ticket. Rejected as scope: it is TEA-02's
file, it has no acceptance criterion here, and `listMembers` returns only the caller's *own team's*
members while `added_by` could in principle name an admin who has since been removed — which resolves
to a row this read does return, but to a rule nobody has written. It is a good first ticket for
whoever picks up the allow-list again, and it is one line plus a lookup.

## Open questions

None blocking.

- **A removed caller lands on `member-list-empty`, and the sentence they see is TEA-04's to write.**
  `member_select_own` returns them their own row, `member_select_team` returns nothing, and the
  screen's `removedAt` filter then empties the list. `01-story.md` puts *what a removed member looks
  like on this screen* out of scope, and it is right to — the surface that can say *you were removed*
  arrives with the ticket that removes people. The empty state here makes no claim about why it is
  empty, which is the most this ticket can honestly render.
- **`member-list-not-on-a-team` also answers a caller with no session.** `getCurrentMember()` returns
  null for both, and AC-6 requires only that no rows are returned. Telling a signed-out person they
  are not on a team is not false, and it is not the sentence they need. TEA-05 — *Sign in, sign out,
  and the member-less landing state* — owns the split, and it is that ticket's central object.
- **`.ai/standards/ui-design-system.md` is still a stub.** This screen's colour, type and density come
  from `CLAUDE.md` §Visual direction instead — rounded, pastel, dense in the grid. The roster is a
  list rather than the calendar grid, so nothing here forces the Vui/Gọn density decision, and the
  next ticket to draw the grid will face the same missing file.

## Changelog

- `2026-09-01T07:58:50+07:00` — sections 1–7 created. Raised by `ba` (`01-story.md`). Amended by
  `tech-lead-design`.
