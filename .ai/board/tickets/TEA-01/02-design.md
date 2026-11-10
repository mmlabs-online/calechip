---
ticket: TEA-01
stage: DESIGN
agent: tech-lead-design
produced_at: 2026-08-31T15:35:07Z
revision_of: 2026-08-31T15:24:54Z
branch: feat/TEA-01
inputs_read:
  - .ai/board/tickets/TEA-01/ticket.yaml
  - .ai/board/tickets/TEA-01/01-story.md          # revision of 2026-08-31T09:23:25Z
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/rules.md
  - .ai/registry/decisions/ADR-009-how-a-person-becomes-a-member.md
  - .ai/registry/decisions/ADR-012-design-resizes-without-routing-back.md
  - .ai/standards/architecture.md
  - .ai/standards/tech-stack.md
  - .ai/standards/data-model.md
  - .ai/standards/rbac-and-security.md
  - .ai/standards/testing-standards.md
  - .ai/standards/coding-standards.md
  - .ai/standards/ui-design-system.md
  - .ai/01-operating-model.md
  - .gitignore
  - node_modules/@supabase/auth-js (installed types)
  - node_modules/react-router-dom (installed types)
consulted:
  - with: qa
    asked: "which implementation of the seam does the end-to-end build use, and what configures it"
    answer: "section 6.2 — src/lib/data/index.ts resolves it; a build with no VITE_SUPABASE_URL takes the mock and renders seam-banner"
    resulted_in_amendment: true
  - with: qa
    asked: "what supplies the real database with a token per role for tests/permission-model.test.ts, and what identifiers does it address"
    answer: "section 6.4 — the identifiers are given; the environment does not exist and is an operator decision, not an amendment"
    resulted_in_amendment: true
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: REWORK
# The operator chose to provision a disposable database — 2026-08-31. That closes the question
# this design was BLOCKED on at 15:24:54Z. TEA-01 now waits on the chore specified in full in
# Appendix A, which product creates as OPS-nnn at /triage; the ten database-backed criteria stay
# NOT WRITTEN until it lands. The developer work in section 6.2 and 6.3 is independent of it and
# runs now, which is why next_state is REWORK rather than a hold.
---

# TEA-01 — Sign up and establish the member record — tech design

Second revision. The first sized this ticket at L against an estimate of M and routed it back to
SPEC; the BA's revision of `2026-08-31T09:23:25Z` carved out the sign-in half, moved AC-6 to it, and
added AC-13 so this half ends on its own answer. **Against that story the verdict is M, twelve files,
and the gate passes.**

Design against `01-story.md` of `2026-08-31T09:23:25Z`, ADR-005 (authorization lives in row-level
security, there is no server) and ADR-009 (a person joins by signing themselves up against an
allow-list).

**What this design settles, that nothing upstream had settled:**

1. The table name `allowed_email` is **confirmed**. `.ai/standards/data-model.md` handed the one
   invented name in that file to DESIGN, and this is DESIGN. No better candidate was found: it names
   the thing it holds, it is singular like every other table in the model, and it does not claim to
   be an invitation, which ADR-009 was at pains to say it is not.
2. The SQL rank helper `.ai/standards/rbac-and-security.md` left as `TODO(project): something of the
   shape is_admin(uid)` is **named and specified** in section 4, together with a second helper
   `member_team_id(uid)` that the allow-list policy needs and that file did not anticipate.
3. **One trigger covers both project settings for email confirmation** — the residual AC-7 pinned.
   Section 4 shows why, and it is not a compromise: with autoconfirm on, `email_confirmed_at` is
   already set at insert, so an `after insert or update of email_confirmed_at` trigger fires exactly
   once in both configurations.
4. **The seam grows an auth surface.** Under ADR-005 `supabase.auth` is the Supabase client, so
   sign-up is a seam function or it is a RULE-02 violation. This is the first design to say so, and it
   is why section 3 is not "none".
5. **`src/lib/fixtures.ts`** is the shared fixture module `.ai/standards/testing-standards.md` left as
   `TODO(project)`, and `supabase/seed.sql` holds the same rows so the two cannot drift.

Verified rather than recalled, per the *Versions the model cannot recall* discipline in
`.ai/standards/tech-stack.md`:

| Fact | Read from | What it changed |
|---|---|---|
| `signUp(credentials)` takes `options.data`, and that object **maps to `auth.users.raw_user_meta_data`** | `@supabase/auth-js@2.112.4` `lib/types.d.ts:545-552`, `:574` | The trigger reads `new.raw_user_meta_data ->> 'display_name'`. AC-8 has a mechanism instead of an intention. |
| With **Confirm email on**, `signUp` returns a `user` and a **null session**; with it off, both | `GoTrueClient.d.ts:292-296` | AC-13 is satisfiable as written: with confirmation on there is no session to redirect with, so the sign-up screen ends on its own notice. |
| With **Confirm email on**, `signUp` for an already-registered confirmed address returns an **obfuscated user**; with it off it returns `User already registered` | `GoTrueClient.d.ts:297-300` | Recorded in section 2 as a real consequence for AC-5's enumeration property. It is a project setting, not code. |
| `BrowserRouter`, `Routes`, `Route`, `Navigate` are exported from `react-router-dom` 7.18.3 | `react-router/dist/development/index.d.ts:6` | Declarative routing is available; no data-router migration is needed for this ticket. |
| Supabase CLI migrations live in `supabase/migrations/<timestamp>_<description>.sql`; seed in `supabase/seed.sql`; applied with `supabase db push`, reset with `supabase db reset` | Supabase's own documentation, fetched 2026-08-31 | `.ai/standards/data-model.md` carried this as `TODO(verify)`. Section 5 can now name real paths. **The layout is confirmed; the CLI is still not installed and no project is provisioned** — see *Prerequisites this ticket does not own*. |
| `.gitignore` ignores `node_modules`, `dist`, `coverage`, `.vite`, `*.tsbuildinfo`, `test-results`, `playwright-report`, `blob-report` — **and no `.env` of any name** | `.gitignore`, read on 2026-08-31 | `.ai/standards/architecture.md` *Configuration and environment* says `.env.local` "which `.gitignore` already excludes". **It does not.** `.ai/standards/rbac-and-security.md` known weakness 2 has it right. See *Prerequisites*. |
| `citext` availability on a hosted project | **Not confirmed.** Supabase's extensions page names no list. | Stays `TODO(verify)` with a named fallback in section 4.3. AC-4 states behaviour, not mechanism, so both shapes satisfy it. |

---

## 1. Contract

Every name below is either already in `.ai/standards/data-model.md` or is introduced here, which is
what RULE-04 requires before the Developer writes a line. Nothing in this section may be renamed at
implementation time.

### 1.1 Domain types — `src/lib/domain/types.ts` (new)

Domain types are shared and importable from any layer (`.ai/standards/architecture.md`, *Layers*).
They live outside `src/lib/data/` precisely so a component can hold a `Member` without importing the
seam.

```ts
export type MemberRole = "member" | "admin";

/** A row of `public.member`, in application casing. */
export interface Member {
  id: string;            // = the Supabase Auth user id (data-model.md)
  teamId: string;
  displayName: string;
  avatar: string;
  role: MemberRole;
  removedAt: string | null;   // ISO 8601, null means active
  createdAt: string;          // ISO 8601
}

/** The authenticated identity. Never the member; the two are separate on purpose (AC-5). */
export interface AuthUser {
  id: string;
  email: string;
  emailConfirmed: boolean;
}

export interface Session {
  user: AuthUser;
  accessToken: string;
}

/** Expected failures are returned, not thrown (.ai/standards/coding-standards.md, Error handling). */
export type FailureCode =
  | "invalid_credentials"
  | "email_already_registered"
  | "weak_password"
  | "rate_limited"
  | "network"
  | "unknown";

export interface Failure {
  code: FailureCode;
  message: string;   // already in the conversation language; safe to render
}

export type Result<T> = { ok: true; value: T } | { ok: false; error: Failure };

/**
 * The avatar set offered at sign-up (AC-8). `member.avatar` is `text not null` and the prototype
 * stores an emoji (data-model.md).
 *
 * TODO(project): the contents of this array are a placeholder and are the operator's to set — see
 * `## Open questions`. The *name*, the *location* and the *type* are decided here and are not
 * placeholders; only the twelve values are.
 */
export const AVATAR_CHOICES: readonly string[] = [
  "🐱", "🐶", "🐰", "🦊", "🐻", "🐼",
  "🐨", "🐯", "🦁", "🐸", "🐧", "🦉",
];
```

**`Membership` is not here.** The three-state union that distinguishes signed-out from
member-less from member belongs to the sign-in half, which owns AC-6. Defining it here with no
consumer would be a shared type the other ticket then has to change, which is the one thing the
Sizing table calls XL.

### 1.2 The seam — `src/lib/data/index.ts` (edit)

`DataSeam` grows two functions. `ready()` stays. Every implementation exports the same names with the
same arity or the seam-parity test in `tests/seam-parity.test.ts` fails.

```ts
import type { Member, Result, Session } from "../domain/types";

export interface SignUpInput {
  email: string;
  password: string;
  displayName: string;
  avatar: string;
}

export interface SignUpOutcome {
  /** True when the project has Confirm email on and the address is not yet confirmed. */
  needsEmailConfirmation: boolean;
  /** Non-null only when the project has Confirm email off. AC-13: the screen ignores it either way. */
  session: Session | null;
}

export interface DataSeam {
  ready(): Promise<boolean>;

  /**
   * AC-1, AC-5, AC-8, AC-13. Creates the auth user and nothing else — the `member` row is the
   * trigger's work, never this function's. It returns the same shape whether or not the address is
   * allow-listed, and it cannot tell the difference; that is what makes AC-5 hold.
   */
  signUp(input: SignUpInput): Promise<Result<SignUpOutcome>>;

  /**
   * AC-1, AC-9. Null means "this auth user has no member row", which is a normal answer and not an
   * error. Under `member_select_own` (section 4) a caller can only ever address their own row, so
   * `userId` is a readability parameter and not a permission surface.
   *
   * Nothing in this ticket's interface calls it — the sign-up screen ends on its own notice (AC-13).
   * Its caller here is `tests/permission-model.test.ts`, which is how AC-1 and AC-9 are observed
   * through the seam rather than only through raw SQL. The story's split table left it in this half
   * deliberately, and the sign-in half consumes it rather than adding it.
   */
  getOwnMember(userId: string): Promise<Member | null>;
}
```

**Three things this contract deliberately does not contain.**

- **No `signIn`, `signOut`, `getSession` or `onSessionChange`.** They are the session half of the
  seam and the story's split moved them out by name.
- **No `listAllowedEmails`.** AC-11 and AC-12 say *"by any route, including one that does not go
  through this application's interface"* — they are assertions about policies, and section 4 carries
  them. Reading the allow-list through the interface is TEA-02, which the story puts out of scope. A
  seam function added here would be dead code the moment it was written, and R5 would still require
  it to be implemented.
- **No permission check anywhere in the seam.** Under ADR-005 a check here is an affordance, and this
  ticket has no control to hide: sign-up is open to anonymous by design. Section 2 says where the
  real gates are.

### 1.3 The routed shell — `src/App.tsx` (edit)

```tsx
<BrowserRouter>
  <Routes>
    <Route path="/signup" element={<SignUp />} />
    <Route path="*" element={<Navigate to="/signup" replace />} />
  </Routes>
</BrowserRouter>
```

`data-testid="app-root"` moves onto the element wrapping `<Routes>` and keeps its name, so the
existing end-to-end smoke test in `tests/e2e/smoke.spec.ts` keeps passing without being edited.

The catch-all redirect is temporary and is named as such: the sign-in half replaces it with `/signin`
and `/`. It exists so this ticket has no route that renders nothing.

### 1.4 The sign-up screen — `src/routes/SignUp.tsx` (new)

One component, one local form state, one call. It holds no session, reads no member row, and
navigates nowhere.

```ts
type SignUpFormState =
  | { phase: "editing"; error: Failure | null }
  | { phase: "submitting" }
  | { phase: "submitted" };   // AC-13: terminal. The notice, and nothing after it.
```

`submit` is disabled unless email, password, `displayName` and `avatar` are all non-empty — the
affordance behind AC-8. It is an affordance and not a control: the `not null` columns are the control,
and the comment on that line says so, per ADR-005.

**Styling is the existing Tailwind defaults.** `.ai/standards/ui-design-system.md` is a stub, the
rounded type face named in `CLAUDE.md` is not installed, and adding a font here would be a design-system
decision taken inside a feature ticket. `src/index.css` is deliberately absent from `allowed_paths`.

### 1.5 The mock's seed — `src/lib/fixtures.ts` (new)

`.ai/standards/architecture.md` requires the mock seam to be *"seeded from the shared fixture
module"*, and `.ai/standards/testing-standards.md` carries `TODO(project): name the shared fixture
module`. This names it: **`src/lib/fixtures.ts`**, and `supabase/seed.sql` inserts the same rows so
the two do not drift.

```ts
export const FIXTURE_TEAM: { id: string; name: string; overloadThreshold: number };
export const FIXTURE_ADMIN: Member;           // the seeded first admin
export const FIXTURE_ALLOWED_EMAIL: string;   // an unconsumed allow-list address
export const FIXTURE_CONSUMED_EMAIL: string;  // a consumed one, for AC-3
export const FIXTURE_UNLISTED_EMAIL: string;  // for AC-5
```

The uuids are fixed literals, not generated, so the SQL seed and the TypeScript fixtures hold the
same values.

---

## 2. Permission model

Against the table in `.ai/standards/rbac-and-security.md`. Every gate below is a row-level security
policy in the migration in section 4. **There is no other enforcement point in this ticket** — no
seam check, no interface check, and therefore no check that can be skipped by issuing the request
from somewhere that is not this application.

| Action | anonymous | `member` | `admin` | Where the gate is |
|---|---|---|---|---|
| Sign up | ✅ | — | — | No gate, by design. See below. |
| Read own `member` row | ❌ | ✅ | ✅ | policy `member_select_own` |
| Read another member's row | ❌ | ❌ | ❌ | absence of any wider select policy. **TEA-03 widens this**, and the `Read the member list` row in `rbac-and-security.md` is what it will widen to. |
| Insert / update / delete a `member` row | ❌ | ❌ | ❌ | absence of any write policy. The trigger is `security definer` and is the only writer. |
| Read the allow-list | ❌ | ❌ | ✅ (own team) | policy `allowed_email_select_admin` — AC-11, AC-12 |
| Insert / update / delete an allow-list entry | ❌ | ❌ | ❌ | absence of any write policy. **TEA-02**. |
| Read `team` | ❌ | ❌ | ❌ | RLS enabled, no policy. Nothing in TEA-01 reads it. |

**Sign-up has no permission gate and that is the design, not an omission.** ADR-009: the gate is the
trigger. An address that is not on the allow-list produces an auth user with no `member` row, and
that auth user can read nothing — `member_select_own` returns their own row, which does not exist,
and every other table denies. The refusal is therefore held against anybody who signs up, not only
against this interface.

**Three denials that are load-bearing and are easy to lose:**

1. **Nobody may insert into `member` directly.** If any write policy existed on `member`, the
   allow-list would be a suggestion: a signed-in person could insert their own row with any
   `team_id`. There is no insert policy in this migration and there must not be one in TEA-02 or
   TEA-03 either.
2. **`role` is never read from user metadata.** `raw_user_meta_data` is user-controlled — it is
   whatever the caller passed to `signUp`. The trigger writes the literal `'member'` (AC-9). A
   `raw_user_meta_data ->> 'role'` anywhere in the migration is a privilege-escalation hole, and R6
   should treat one as a failure rather than a style note.
3. **The `authenticated` grants are explicit.** The migration revokes everything from `anon` and
   `authenticated` on all three tables first, then grants only `select` on `member` and
   `allowed_email`. Supabase's default privileges on new tables in `public` are permissive; relying
   on them would make the policy the only thing standing between `anon` and a write, and
   `rbac-and-security.md` known weakness 1 is precisely that a policy fails open silently.

**One consequence of AC-5 that is a project setting rather than code, and belongs on the record.**
With **Confirm email off**, `signUp` for an address that already has a confirmed account returns
`User already registered` (`GoTrueClient.d.ts:297-300`) — which makes sign-up an
account-existence oracle. With **Confirm email on**, it returns an obfuscated user and reveals
nothing. AC-7's reasoning already requires Confirm email to be on; this is a second, independent
reason for the same setting. It is named here because nothing in the repository configures it and
nobody would otherwise notice that the property AC-5 describes depends on a dashboard toggle.

---

## 3. Seam impact

**Not none.** Two functions are added to `src/lib/data/index.ts` and to both implementations, with
identical names and arity: `signUp` and `getOwnMember`. Signatures are in section 1.2. `ready()` is
unchanged.

This is ordinary feature work under the Sizing section of `.ai/01-operating-model.md` — *"Adding new
functions to the data-access seam is ordinary feature work, not XL... The test is whether existing
callers must change"* — and no existing caller changes, because `ready()` is untouched and is the
only function that exists today.

**Why auth belongs inside the seam at all**, since it is the first time the question arises:
`supabase.auth` is a property of the object `createClient` returns. Calling `signUp` from a component
means importing `@supabase/supabase-js` outside `src/lib/data/`, which is a RULE-02 violation and a
build failure under the `no-restricted-imports` rule in `eslint.config.js`. There is no version of
this feature in which auth sits outside the seam.

**What each implementation does.**

- `src/lib/data/supabase.ts` — `signUp` calls `client().auth.signUp({ email, password, options: {
  data: { display_name, avatar } } })`; `getOwnMember` is a single
  `from("member").select(...).eq("id", userId).maybeSingle()`. Columns are snake_case in the database
  and camelCase in the domain type, and this file is the only place the two meet.
- `src/lib/data/mock.ts` — an in-memory store seeded from `src/lib/fixtures.ts`. It reproduces the
  **trigger's behaviour**, not the interface's: `signUp` with an allow-listed address creates a member
  and consumes the entry; with an unlisted or already-consumed address it succeeds and creates nothing.
  A mock that always creates a member would make every component test pass against a broken trigger.

**`tests/seam-parity.test.ts` is in `allowed_paths` and is expected to need no edit.** It compares
exported key sets and arity generically. It is listed because a two-function addition is exactly the
change that reveals an assumption in a generic test, and a Developer blocked by the guard mid-stage
costs more than one glob.

---

## 4. Schema delta

**Not `none`.** Approved ADR: [ADR-009](../../../registry/decisions/ADR-009-how-a-person-becomes-a-member.md),
`ACCEPTED by the operator` on 2026-08-31. Definition of Ready item 4 is therefore satisfied.

**Applying the migration is human — RULE-09.** The Developer writes the file; nobody runs
`supabase db push` from an agent session.

This is the project's **first** migration: no `supabase/` directory exists and there is no schema at
all. So it creates `team` and `member` as well as `allowed_email` — a `member` row cannot exist
before the table does. Field names and types are copied from `.ai/standards/data-model.md` without
alteration. `entry`, `holiday` and the INV-01 exclusion constraint from ADR-011 are **not** in this
migration; they belong to the features that use them.

### 4.1 The migration — `supabase/migrations/<timestamp>_tea01_membership.sql`

```sql
-- TEA-01. ADR-009: a person joins by signing up against an allow-list.
-- Applying this file is human (RULE-09).

create extension if not exists citext with schema extensions;

create type public.member_role as enum ('member', 'admin');

create table public.team (
  id                 uuid primary key default gen_random_uuid(),
  name               text not null,
  overload_threshold numeric not null default 0.5,
  created_at         timestamptz not null default now()
);

create table public.member (
  id           uuid primary key references auth.users (id) on delete restrict,
  team_id      uuid not null references public.team (id) on delete restrict,
  display_name text not null,
  avatar       text not null,
  role         public.member_role not null default 'member',
  removed_at   timestamptz,
  created_at   timestamptz not null default now()
);

create table public.allowed_email (
  email       extensions.citext primary key,
  team_id     uuid not null references public.team (id) on delete restrict,
  added_by    uuid not null references public.member (id) on delete restrict,
  added_at    timestamptz not null default now(),
  consumed_at timestamptz
);

-- No cascade anywhere. data-model.md: "There is no cascade anywhere in this model, and that is a
-- decision rather than an omission."

-- The rank helper rbac-and-security.md left as TODO(project). security definer so that a policy on
-- one table may consult `member` without recursing through `member`'s own policies.
create function public.is_admin(p_uid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.member m
    where m.id = p_uid
      and m.role = 'admin'::public.member_role
      and m.removed_at is null
  );
$$;

create function public.member_team_id(p_uid uuid) returns uuid
  language sql stable security definer set search_path = '' as $$
  select m.team_id from public.member m
  where m.id = p_uid and m.removed_at is null;
$$;

revoke all on function public.is_admin(uuid), public.member_team_id(uuid) from public;
grant execute on function public.is_admin(uuid), public.member_team_id(uuid) to authenticated;

-- The whole feature. ADR-009 step 3.
--
-- search_path is `extensions` rather than '' because `allowed_email.email` is citext and the `=`
-- operator for it lives in that schema; with an empty search_path the comparison does not resolve.
-- Every relation below is fully qualified anyway, so nothing is reachable through the path itself.
create function public.admit_allow_listed_member() returns trigger
  language plpgsql security definer set search_path = extensions as $$
declare
  v_now     timestamptz := now();
  v_team_id uuid;
begin
  -- AC-7: admit on confirmation, never on insert-without-confirmation. With Confirm email OFF
  -- Supabase sets email_confirmed_at at insert time, so this one trigger fires exactly once under
  -- either project setting and the two candidate behaviours stay indistinguishable, as AC-7 says.
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.email_confirmed_at is not null then
    return new;   -- already admitted on an earlier confirmation
  end if;

  -- AC-2 and AC-3 in one statement. UPDATE ... RETURNING is atomic: two concurrent confirmations
  -- for the same address cannot both match `consumed_at is null`, so the second admits nobody.
  -- AC-4: citext, so the comparison is case-insensitive without a lower() anywhere.
  update public.allowed_email a
     set consumed_at = v_now
   where a.email = new.email
     and a.consumed_at is null
  returning a.team_id into v_team_id;

  if v_team_id is null then
    return new;   -- AC-5: not allow-listed, or already consumed. Sign-up still succeeds.
  end if;

  insert into public.member (id, team_id, display_name, avatar, role, created_at)
  values (
    new.id,
    v_team_id,                                    -- INV-07: the team comes from here and nowhere else
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
             split_part(new.email, '@', 1)),      -- AC-8, with a last-resort guard; see 4.4
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'avatar'), ''), '🙂'),
    'member'::public.member_role,                 -- AC-9. NEVER from raw_user_meta_data.
    v_now                                         -- AC-2: the same instant as consumed_at
  )
  on conflict (id) do nothing;

  return new;
exception when others then
  -- A trigger on auth.users that raises makes signUp fail outright, which would break AC-5's
  -- "sign-up succeeds and returns the same result". The whole block rolls back together, so the
  -- allow-list entry is not consumed either. The warning is what makes the failure findable.
  raise warning 'admit_allow_listed_member failed for auth user %: %', new.id, sqlerrm;
  return new;
end;
$$;

create trigger admit_allow_listed_member
  after insert or update of email_confirmed_at on auth.users
  for each row execute function public.admit_allow_listed_member();

alter table public.team          enable row level security;
alter table public.member        enable row level security;
alter table public.allowed_email enable row level security;

revoke all on public.team, public.member, public.allowed_email from anon, authenticated;
grant select on public.member        to authenticated;
grant select on public.allowed_email to authenticated;

-- The read path for AC-1 and AC-9: `getOwnMember`, exercised by tests/permission-model.test.ts.
-- It addresses only the caller's own id, so "no row" and "a row I may not see" collapse into one
-- answer. TEA-03 widens this to the team, per the `Read the member list` row in rbac-and-security.md,
-- and the sign-in half depends on this policy rather than adding one.
create policy member_select_own on public.member
  for select to authenticated
  using (id = (select auth.uid()));

-- AC-11 and AC-12.
create policy allowed_email_select_admin on public.allowed_email
  for select to authenticated
  using (
    public.is_admin((select auth.uid()))
    and team_id = public.member_team_id((select auth.uid()))
  );

-- No insert, update or delete policy on any of the three tables. With row-level security enabled and
-- no policy, the write is denied. TEA-02 adds the allow-list writes; TEA-04 adds removal and
-- promotion. `member` must never gain an insert policy — the trigger is the only writer.
```

### 4.2 The seed — `supabase/seed.sql`

One `team`, one auth user, one `member` row for that user with `role = 'admin'`, and two
`allowed_email` rows: one unconsumed and one consumed, so AC-3 has something to test against.
The uuids and addresses are the same literals as `src/lib/fixtures.ts`.

**This is the test-and-development seed, not the production bootstrap.** The story puts the first
team and the first admin out of scope and says a human applies a seed; this file is what a human
applies. It is in scope here only because AC-3, AC-11 and AC-12 have nothing to run against without
it, and `.ai/standards/testing-standards.md` requires tests to share the seed rather than invent
entities inline.

### 4.3 Two things a human must decide or verify before this migration is applied

- **`TODO(verify):` is `citext` available on the hosted project?** Supabase's extensions page names no
  list and no project is provisioned, so it could not be confirmed. **The fallback, if it is not:**
  `email text primary key` with `check (email = lower(email))`, the trigger comparing
  `a.email = lower(new.email)`, and `set search_path = ''` on the trigger function since no extension
  operator is then involved. AC-4 states the behaviour and not the mechanism, so both shapes satisfy
  it and no story amendment is needed either way.
- **`TODO(verify):` `new.raw_user_meta_data` is the column on `auth.users`.** The name is asserted by
  the installed auth-js types (`lib/types.d.ts:574`, *"maps to the `auth.users.raw_user_meta_data`
  column"*), which is strong but is the client's description of the server's schema rather than the
  schema. Confirm against `\d auth.users` on a real project before this is applied.

### 4.4 The `display_name` fallback, which looks like it contradicts AC-8

AC-8's note rejects deriving a display name from the address' local part **as the product's
behaviour**, and this design does not do that: the sign-up form requires both fields and does not
submit without them. The `coalesce` exists for the path AC-3 names — *"by any route, not only through
this application's interface"* — where a caller supplies no metadata at all. Without it the insert
violates `not null`, the trigger raises, and sign-up fails, which breaks AC-5. A fallback that never
fires in the product and prevents a hard failure outside it is not the alternative AC-8 rejected.

---

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
  - "src/routes/SignUp.tsx"
  - "tests/seam-parity.test.ts"
  - "tests/permission-model.test.ts"
  - "tests/e2e/tea-01-signup.spec.ts"
```

**Twelve files. `size: M`. `size_estimate: M`. They agree, and this revision is why.**

The first revision of this design enumerated fifteen files and returned **L** against the same
estimate of M. The story's revision of `2026-08-31T09:23:25Z` moved `src/hooks/useSession.ts`,
`src/routes/SignIn.tsx`, `src/routes/NotOnATeam.tsx`, `src/routes/Home.tsx` and four seam functions
into the sign-in half, and kept `src/App.tsx` here so this half is a running screen rather than a
migration nobody can reach. Twelve is the M ceiling exactly, so **any file added during
implementation tips this ticket to L** — that is a `developer` → `tech-lead-design` question under
the chat budget, not a decision to take in the moment.

`supabase/migrations/*.sql` is one file and is a glob only because `supabase migration new` generates
the timestamp in the name.

**Deliberately absent, each for a reason:**

- **`src/index.css`** — the rounded type face and the pastel palette in `CLAUDE.md` are a design-system
  decision and `.ai/standards/ui-design-system.md` is still a stub. A feature ticket is the wrong place
  to settle them. Section 1.4.
- **`supabase/config.toml`, and anything `supabase init` writes** — project setup, not feature work.
  Putting it here would make R1 pass on work nobody designed.
- **`.env.local`** — environment, never a repository file, and see the warning in *Prerequisites*.
- **`tests/e2e/smoke.spec.ts`** — `app-root` keeps its name in section 1.3 precisely so this file does
  not need touching.

**ADR-012 does not apply to this ticket** — it says so itself: *"Applies from the next ticket. TEA-01
is out of scope and is being handled by the operator."* The two numbers agree here anyway, so the
question does not arise. Recording both is what ADR-012 will require from the next ticket onward, and
doing it here costs a line.

### Prerequisites this ticket does not own, and cannot satisfy

Neither is a design defect. The first stops the ticket at the QA gate; the second is a security
exposure that this ticket makes live for the first time.

1. **No Supabase project is provisioned and the CLI is not installed** —
   `.ai/standards/tech-stack.md` carries both as `TODO(project)`. The migration can be *written*
   without them; it cannot be applied, and `tests/permission-model.test.ts` executes *"against a real
   PostgreSQL with a token per role"* (`.ai/standards/testing-standards.md`). **TEA-01 cannot pass the
   QA gate until a disposable database exists.** `.ai/standards/architecture.md` *Configuration and
   environment* already asks for the rule that a test run must never inherit a developer machine's
   settings; that is the same gap, and it should be a chore ticket rather than a discovery at QA.
2. **`.gitignore` does not ignore `.env` or `.env.local`, and this is the first ticket that needs
   one.** `.ai/standards/rbac-and-security.md` known weakness 2 records this as an operator decision
   of 2026-08-31 and says the control is attention. `.ai/standards/architecture.md` *Configuration and
   environment* contradicts it — it says `.env.local` is "which `.gitignore` already excludes", and
   the file read on 2026-08-31 excludes no such name. **One of those two standards documents is
   wrong and both are human-owned**, so this design records the contradiction rather than resolving
   it. Until it is resolved, whoever implements this ticket creates `.env.local` on a tree where
   `git add -A` will stage it.

---

## 6. Testability contract

The attribute is `data-testid`, named once in `.ai/standards/testing-standards.md`. RULE-05 makes
this table the only channel through which these controls reach QA: a control that is not here does
not exist, and R7 checks the reverse — every selector here exists in the markup.

`signup-avatar-option` appears once per entry in `AVATAR_CHOICES` and is the only repeated selector
in this table; every other one identifies exactly one element.

| selector | Element | Used by |
|---|---|---|
| `app-root` | The routed shell in `App.tsx`. Already exists and keeps its name. | all |
| `seam-banner` | **Added 2026-08-31T15:24:54Z.** A persistent notice rendered by `App.tsx` whenever the build resolved the seam to the in-memory implementation, carrying `data-seam="mock"`. Absent when the build resolved to the real one. See 6.2 — this is how a test knows which implementation it is driving, and how a person knows the page is not connected to anything. | 6.2 |
| `signup-form` | The sign-up form element | AC-1, AC-4, AC-5, AC-8 |
| `signup-email` | Email input | AC-1, AC-4, AC-5 |
| `signup-password` | Password input | AC-1 |
| `signup-display-name` | Display name input, required | AC-8 |
| `signup-avatar-picker` | The avatar radio group | AC-8 |
| `signup-avatar-option` | One selectable avatar. Repeated: one per `AVATAR_CHOICES` entry. Carries `data-avatar="<emoji>"` so a test can choose a known one and later assert the same value reached the `member` row. | AC-8 |
| `signup-submit` | Submit button. Disabled until email, password, display name and avatar are all present — the affordance behind AC-8, and an affordance only. **It is never left disabled without a terminal state beside it: see 6.3.** | AC-1, AC-5, AC-8 |
| `signup-error` | The failure message region. Renders `Failure.message`; absent when there is no failure. **Every unsuccessful sign-up renders it, including one that throws rather than returns — 6.3.** | AC-8 |
| `signup-confirm-notice` | The panel shown after a successful sign-up: "confirm your address". **Identical text and identical selector whether or not the address was allow-listed**, and the screen goes nowhere after it. This is where AC-5's "returns the same result" and AC-13's "does not redirect" are both observable. | AC-5, AC-7, AC-10, AC-13 |

**What has no selector, on purpose, and how QA reaches it instead.**

- **AC-2, AC-3, AC-11, AC-12** have no interface in this ticket at all. They are assertions about the
  trigger and the policies, and they belong in `tests/permission-model.test.ts` — see 6.4, which is
  where the environment that test needs is described and where it is stated that the environment does
  not yet exist.
- **AC-1, AC-4, AC-7 and AC-9 are only half observable through the interface.** The `member` row those
  criteria are about is reached through 6.4; the screen's half of them is reached through 6.2.
- **AC-6 is not in this ticket.** The story retains the number as a deliberate gap and moved the
  criterion to the sign-in half. Nothing here should be written against it.

### 6.2 Which implementation of the seam a build resolves to, and what configures it

**Added 2026-08-31T15:24:54Z, answering QA question 1. The first two revisions of this design were
silent on it, and that silence is the defect** — section 3 said two implementations exist and stay in
parity, and nothing said who chooses between them. `src/routes/SignUp.tsx` therefore imported
`@/lib/data/supabase` directly, so `pnpm exec playwright test` built a page that constructs a real
client against an absent `VITE_SUPABASE_URL` and raises `supabaseUrl is required.` on submit. QA is
right: that is section 6's question and not QA's.

**`src/lib/data/index.ts` is the one door, and it makes the choice.** Nothing above the seam names an
implementation; `SignUp.tsx` imports `{ seam } from "@/lib/data"` and never from `./supabase` or
`./mock`. Both files are already in `allowed_paths`; no file is added and `size` stays M.

```ts
// src/lib/data/index.ts — in addition to the interface it already exports
import { seam as mockSeam } from "./mock";
import { seam as supabaseSeam } from "./supabase";

// Importing both is safe: supabase.ts constructs its client lazily, and that laziness already exists
// for this exact reason — the seam-parity test caught eager construction on its first run.
const usesMock =
  import.meta.env.VITE_DATA_SEAM === "mock" || !import.meta.env.VITE_SUPABASE_URL;

export const seamName: "mock" | "supabase" = usesMock ? "mock" : "supabase";
export const seam: DataSeam = usesMock ? mockSeam : supabaseSeam;
```

**Two rules, and the second is what makes the first safe.**

1. **A build with no `VITE_SUPABASE_URL` resolves to the mock rather than to a page that throws.** The
   choice is between an in-memory implementation and a screen with no answer at all, and only one of
   the two can be tested. This is what `pnpm exec playwright test` gets as `playwright.config.ts`
   stands — `vite build && vite preview`, no environment file — and it needs no change to that config,
   which is deliberate: `playwright.config.ts` is not in `allowed_paths` and adding it would take this
   ticket to thirteen files and out of M.
2. **Whenever `seamName` is `mock`, `App.tsx` renders `seam-banner`.** A silent fallback to a fake
   datastore is the failure this rule exists to prevent: a deployment that forgets one environment
   variable would otherwise accept sign-ups into memory and look entirely normal. The banner is
   permanent, not dismissible, and it is also how a test asserts which implementation it drove.

**What this makes runnable, and what it does not.** `src/lib/data/mock.ts` reproduces the trigger's
behaviour rather than the interface's — an allow-listed address consumes the entry and creates a
member, an unlisted or already-consumed one succeeds and creates nothing, the address is folded for
case, and `signUp` returns `needsEmailConfirmation: true` with a null session. So the interface halves
of **AC-1, AC-4, AC-5, AC-7 and AC-13** are exercisable end to end today, with no database, and the
five tests QA left failing should go green.

**It proves the screen and the mock's imitation of the trigger. It proves nothing about the policies
or the real trigger** — those are 6.4, and an end-to-end run against the mock must never be reported
as covering them.

### 6.3 The terminal states of the sign-up screen

**Added 2026-08-31T15:24:54Z.** QA's failure 1 is a Developer defect and stays routed there; this
subsection exists because the design did not state the property plainly enough to be tested, and a
defect the specification cannot name will recur.

After `signup-submit` is clicked, the screen reaches exactly one of two terminal states, always, and
`signup-submit` is never left disabled without one of them on screen:

| Outcome | Terminal state |
|---|---|
| `signUp` returns `{ ok: true }` | `signup-confirm-notice` |
| `signUp` returns `{ ok: false }` | `signup-error`, rendering `Failure.message`, and the form is editable again |
| **`signUp` throws** — a construction error, a dropped connection, anything unexpected | `signup-error`, and the form is editable again |

The third row is the one that was missing. Section 1 says expected failures are *returned* rather than
thrown, which is true of the seam's own failures and is not true of everything the call can do: the
Supabase client raises on an unusable configuration before any request is made. The screen must
therefore catch as well as branch. This is testable through the selectors above and needs no source
file to be read.

### 6.4 `tests/permission-model.test.ts` — what it addresses, and what it needs that does not exist

**Added 2026-08-31T15:24:54Z, answering QA question 2.** Two halves: the identifiers, which were owed
to QA and are given here; and the environment, which cannot be given by this design.

**The identifiers.** RULE-05 keeps sections 1, 3 and 4 away from QA, so they are restated here.

| What | Value |
|---|---|
| Module | `@/lib/data` — the same door 6.2 describes. The test forces the real implementation with `VITE_DATA_SEAM=supabase` plus a configured URL and anon key; on the mock this test is meaningless, see below. |
| Function | `getOwnMember(userId: string): Promise<Member | null>`. Null means "this auth user has no member row" and is a normal answer, not an error. |
| `Member` fields | `id`, `teamId`, `displayName`, `avatar`, `role` (`"member" \| "admin"`), `removedAt` (null means active), `createdAt`. Camel case in the application; the seam is the only place they meet their snake_case columns. |
| Fixtures | `@/lib/fixtures` — `FIXTURE_TEAM`, `FIXTURE_ADMIN` (the seeded admin), `FIXTURE_ALLOWED_EMAIL` (unconsumed), `FIXTURE_CONSUMED_EMAIL` (consumed, for AC-3), `FIXTURE_UNLISTED_EMAIL` (for AC-5). `supabase/seed.sql` inserts the same literals. |
| A token per role | Three clients against the same project, each carrying its own identity: **anonymous** — the anon key with no session; **member** — signed in as the account created by signing up with `FIXTURE_ALLOWED_EMAIL`; **admin** — signed in as `FIXTURE_ADMIN`, whose auth user the seed creates. There is no service-role key anywhere and there must not be one: ADR-009 exists because that key has no server to live in. |
| The allow-list table | `allowed_email`, columns `email`, `team_id`, `added_by`, `added_at`, `consumed_at`. AC-11 asserts the member client reads **zero rows** from it and AC-12 asserts the admin client reads its own team's, consumed and unconsumed alike. |
| Confirming an address without a mailbox | The trigger fires on `email_confirmed_at` moving from null to non-null. A local stack confirms by setting it directly; a project with Confirm email off sets it at insert. Either satisfies AC-7's "and when the address is subsequently confirmed". |

**The environment, and why this test cannot be written to pass today.** Verified on 2026-08-31 rather
than assumed: no `docker` on the path and no daemon, no Supabase CLI globally or in `node_modules/`,
no project provisioned (`.ai/standards/tech-stack.md` carries both the CLI and the PostgreSQL major
as `TODO(project)`), and `.github/workflows/verify.yml` provisions no service. `pnpm exec vitest run`
is a required check, so a test written against a live database fails every pull request rather than
passing one.

**QA must not write this test against the mock seam.** It would assert that the mock imitates the
policies, which it does by construction — `.ai/standards/testing-standards.md` names mocking the mock
as a bad test, and `.ai/standards/rbac-and-security.md` known weakness 1 is that a policy fails open
silently and the denials test is the only thing that catches it. A green permission-model test that
never touched a policy is worse than the missing file, because the missing file is visible.

**This is a prerequisite, not a design defect, and it needs a human.** Section 5's *Prerequisites this
ticket does not own* said at `2026-08-31T09:34:46Z` that TEA-01 could not pass the QA gate until a
disposable database existed; this is that prediction arriving. The Definition of Done requires every
AC to map to a named test, and ten of the twelve criteria in this ticket run through this file, so
**TEA-01 cannot reach DONE on the strength of an amendment.** The decision was put to the operator in
`99-questions.md` as two options.

**The operator chose to provision it — 2026-08-31.** The chore is specified in full in
*Appendix A — the provisioning chore*, below, with everything verified on 2026-08-31 rather than
recalled. TEA-01 waits on it: the ten criteria in this file stay `NOT WRITTEN` until the stack exists,
and QA should make one pass afterwards rather than two before.

The rejected option is kept because a reader should be able to see what was weighed: **accept the
ticket with the database half unverified**, recording the ten criteria as verified by reading the
migration rather than by running it. Cheaper today; it contradicts the Definition of Done and leaves
the row-level security policies — which under ADR-005 are the entire authorization model — with no
test that asserts a denial.

---

## 7. Rejected alternatives

**Create the `member` row from the client, immediately after `signUp` returns.** Genuinely plausible,
and it is what the story's flow suggests if you do not look at the policies: `signUp`, then
`insert into member`. It is the shortest path, it needs no trigger, no `security definer` function
and no plpgsql, and it keeps the whole feature inside TypeScript where the team can read it.

Rejected because it requires an insert policy on `member`, and any insert policy a signed-in person
can satisfy lets them choose their own `team_id` and their own `role` — the allow-list becomes a
suggestion and AC-9 becomes a convention. Under ADR-005 there is nothing behind that policy: the
endpoint is reachable with the public anon key from anywhere. It would also fail AC-3 outright, since
consuming the entry and inserting the row would be two round trips with no transaction between them.
The trigger is more machinery, and it is the only shape in which "only an allow-listed address
becomes a member" is a fact about the database rather than about this application.

**Fire the trigger on `after insert on auth.users` and ignore confirmation.** Simpler, and
indistinguishable from the chosen design on a project with Confirm email off — which is how a
developer's first local project is usually configured, so it would look correct for a long time.
Rejected because AC-7 decided the opposite for two recorded reasons: an unconfirmed account would
enter INV-04's denominator and raise the overload threshold for everybody, and it would turn AC-5's
silence into an address-enumeration oracle readable by anybody who can type an address. The chosen
`after insert or update of email_confirmed_at` costs one extra `if` and behaves identically under
both settings.

**A scheduled reconciliation instead of a trigger** — a job that periodically finds confirmed auth
users whose address is on an unconsumed allow-list entry and creates the missing `member` rows.
Attractive because it is ordinary SQL with no `security definer` surface and it self-heals after a
failure. Rejected because the delay is the feature's whole user experience: a person confirms their
address, signs in, and is told they are not on a team until the job next runs — which is the exact
state the sign-in half's AC-6 exists to make rare. It also needs `pg_cron` or an external scheduler,
and a scheduler is a component ADR-005 removed.

**Match the address with `lower()` on a `text` column rather than adopting `citext`.** This is not
rejected so much as held in reserve: `.ai/standards/data-model.md` specifies `citext`, that file is
standards plane and human-owned, and DESIGN does not get to overrule it on a hunch about extension
availability. Section 4.3 carries it as the named fallback with the exact shape it would take, so the
substitution is a mechanical edit rather than a redesign if the extension turns out to be
unavailable.

**Move `getOwnMember` and `member_select_own` into the sign-in half, leaving this ticket with no read
path at all.** Tempting, because nothing in this half's interface calls either one, and a seam
function with no interface caller reads like scope that wandered in. Rejected on two grounds. The
story's split enumerates what leaves — `getSession`, `onAuthStateChange`, `signIn`, `signOut` — and
`getOwnMember` is not on that list, so moving it would be DESIGN re-splitting a story it was given.
More concretely, AC-1 and AC-9 are criteria of **this** ticket and both are about the contents of the
`member` row; without a read path they could only be asserted with raw SQL against a table this
ticket claims is protected by a policy, which tests the database and not the thing shipped. The
policy and its one reader belong with the migration that creates the table.

---

## Appendix A — the provisioning chore

**Written 2026-08-31T15:35:07Z, after the operator chose to provision.** It is here rather than in a
ticket of its own because `.claude/hooks/guard-allowed-paths.mjs` scopes every write on
`feat/TEA-01` to this ticket's folder and its twelve paths, so `tech-lead-design` cannot create a
sibling shell from here. Everything needed to create it is below; `product` assigns the `OPS-nnn` id
at `/triage` and the orchestrator wires `depends_on`.

**Title.** Provision a disposable Supabase database that tests can run against.

**Why.** `.ai/standards/testing-standards.md` requires a permission-model test asserting every
permission in both directions, and `.ai/standards/rbac-and-security.md` known weakness 1 says a
policy fails open **silently** — the denials test is the only thing that catches it. Under ADR-005
those policies are the entire authorization model. TEA-01 is the first ticket to write any, and ten
of its twelve criteria have nowhere to run. Every later ticket with a policy inherits the same gap,
so this is not TEA-01's problem, it is the project's, arriving on TEA-01.

**Verified on 2026-08-31, not recalled.** `.ai/standards/tech-stack.md` puts the Supabase CLI on its
*past reliable recall* list, so these were read rather than remembered.

| Fact | Source |
|---|---|
| **No container runtime on this machine** — no `docker`, `podman`, `colima`, `orbstack`, `nerdctl` or `lima` on the path, and no container application in `/Applications`. Homebrew **is** present at `/opt/homebrew/bin/brew`. | the machine, 2026-08-31 |
| The CLI's local stack **requires** a container runtime: *"That stack runs in Docker containers, so you need a container runtime installed first."* Docker Desktop is the primary recommendation; Rancher Desktop, Podman, OrbStack and colima are named as supported alternatives. | Supabase local-development documentation |
| The CLI installs as a dev dependency: `npm install supabase --save-dev`, Node 20+. `brew install supabase/tap/supabase` on macOS. | same |
| `supabase init` creates the configuration folder; `supabase start` launches the stack. | same |
| The stack exposes the API at `http://localhost:54321`, Studio at `http://localhost:54323`, and PostgreSQL at `postgresql://postgres:postgres@localhost:54322/postgres`. | same |
| `supabase` on npm resolves to **2.116.0**. | `npm view supabase version` |
| CI is GitHub Actions `ubuntu-latest`, running typecheck, lint, `pnpm exec vitest run`, the documentation audit, the hook tests and `pnpm exec playwright test`. No service container of any kind. | `.github/workflows/verify.yml` |
| **The CLI's own getting-started page does not document GitHub Actions.** | same page, checked for it |

**The work.**

1. **Install a container runtime.** The operator's choice of product; Homebrew is available. This is
   the one step no agent can do and it is why the chore exists as a chore.
2. **`pnpm add -D supabase`, then `supabase init`.** Creates `supabase/config.toml`. The migration and
   the seed TEA-01 writes already live at the paths the CLI expects — that layout was verified against
   Supabase's documentation at DESIGN and is why `allowed_paths` names them.
3. **`supabase start`, then `supabase db reset`** to apply `supabase/migrations/` and
   `supabase/seed.sql` together. This is the first time the TEA-01 migration is executed, so it is
   also where section 4.3's two `TODO(verify):` items are settled: whether `citext` is available, and
   that `auth.users.raw_user_meta_data` is the column the trigger reads. If `citext` is missing, 4.3
   names the exact fallback and it is a mechanical edit, not a redesign.
4. **Fix `.gitignore` before writing any `.env.local`.** It ignores no `.env` of any name today. This
   step also resolves the contradiction recorded in section 5: `.ai/standards/architecture.md` claims
   `.gitignore` already excludes `.env.local` and `.ai/standards/rbac-and-security.md` known weakness
   2 says it does not. The second is correct. Both files are human-owned, so the correction goes
   through CODEOWNERS review with the rest of this chore.
5. **Decide how `pnpm exec vitest run` behaves when no stack is running.** This is the step most
   likely to be skipped and it is the one that breaks CI. `tests/permission-model.test.ts` matches
   vitest's default pattern, `vitest run` is a required check, and a test that needs a database must
   not fail every pull request — nor be skipped, which
   `.ai/standards/testing-standards.md` calls a passing test that checks nothing. Either the stack
   runs in CI too (step 6) or the test moves to its own command and its own required check. Choose one
   and write it down; do not leave it to the first red pull request.
6. **Wire CI.** `TODO(verify):` the CLI's getting-started page does not cover GitHub Actions, so read
   `supabase/setup-cli` and the CLI's CI documentation before writing the step. Do not write it from
   memory — that is exactly the failure `.ai/standards/tech-stack.md` § *Versions the model cannot
   recall* describes. What is known: `ubuntu-latest` runners provide Docker, so a local stack in CI is
   plausible without a service container; confirm it by running it, not by asserting it.
7. **Close the two `TODO(project)` markers this chore is the answer to.** In
   `.ai/standards/testing-standards.md`: the run command for the permission-model test, beside the
   other four in the role-to-command table, and *"give both their real paths once the seam and the
   role model exist"* — the seam-parity test is at `tests/seam-parity.test.ts` and the permission-model
   test at `tests/permission-model.test.ts`. In `.ai/standards/architecture.md` § *Configuration and
   environment*: which settings a test run must never inherit from a developer machine.

**Files it touches, none of which is in TEA-01's `allowed_paths`.** This is why it is a separate
branch and not a widening of this ticket: `package.json`, `pnpm-lock.yaml`, `supabase/config.toml`,
`.gitignore`, `.github/workflows/verify.yml`, the vitest configuration in `vite.config.ts`,
`.ai/standards/testing-standards.md`, `.ai/standards/architecture.md`.

**Sequencing, which matters more than it looks.** One working directory holds one branch (ADR-006)
and a whole ticket stays uncommitted until `/ship`, so switching to a chore branch on a dirty tree is
not an inconvenience — it is the loss. The order that costs the fewest passes:

1. `/implement TEA-01` on this branch — QA's failure 1, and repointing `SignUp.tsx` at `@/lib/data`
   per 6.2. Both are inside `allowed_paths`.
2. Commit `feat/TEA-01` — a human commit, not `/ship`, which would mark a ticket DONE that is not.
3. The chore, on its own branch, merged the usual way.
4. Back to `feat/TEA-01`, then **one** `/qa` pass with all twelve criteria runnable, rather than one
   pass now that can only reach five and another afterwards.

**What it blocks.** TEA-01's QA gate, and the same gate on every later ticket that writes a policy —
TEA-02, TEA-03, TEA-04 and the ADM group at minimum.

---
## Open questions

One, and it does not block: it blocks the *contents* of a constant whose name, type and location this
design fixes.

**The twelve avatars.** `AVATAR_CHOICES` in `src/lib/domain/types.ts` ships with twelve placeholder
emoji chosen for nothing but being animals. `.ai/standards/ui-design-system.md` is a stub and names
no set; `CLAUDE.md` names mascots as a place charm belongs, and `.ai/standards/data-model.md` says
only that the prototype stores an emoji. Per the *No invention* rule in `CLAUDE.md` these are a
placeholder, not a decision. **They are the operator's to set**, and the cheapest moment is before
the first person signs up — every existing member's avatar is a value from this list, and changing
the list afterwards does not change the rows.

---

## Changelog

- `2026-08-31T09:16:26Z` — sections 1-7 created. Table name `allowed_email` confirmed; `is_admin` and
  `member_team_id` named, closing the `TODO(project)` in `.ai/standards/rbac-and-security.md`;
  `src/lib/fixtures.ts` named, closing the `TODO(project)` in
  `.ai/standards/testing-standards.md`; the Supabase migration layout verified against Supabase's own
  documentation, closing the `TODO(verify)` in `.ai/standards/data-model.md`. Gate FAIL on the size
  verdict, L against an estimate of M. Raised by `tech-lead-design`.
- `2026-08-31T09:34:46Z` — revised against the story of `2026-08-31T09:23:25Z`, which split the
  sign-in half out. Section 1: `signIn`, `signOut`, `getSession`, `onSessionChange`, the `Membership`
  union and `useSession` removed; the routed shell and the sign-up screen specified here instead.
  Section 5: twelve files, `size: M`, agreeing with `size_estimate`; a second prerequisite added, the
  `.gitignore` / `architecture.md` contradiction over `.env.local`. Section 6: the session and
  member-landing selectors removed, `signup-confirm-notice` extended to AC-13, and a note added on
  how QA reaches the criteria the interface cannot show. Section 7: one alternative added, on leaving
  `getOwnMember` out of this half. Gate PASS. Raised by `ba`. Amended by `tech-lead-design`.
- `2026-08-31T15:24:54Z` — section `6` amended, answering both QA questions in `99-questions.md`
  (RULE-14). **6.2** added: `src/lib/data/index.ts` resolves which implementation a build uses, a
  build with no `VITE_SUPABASE_URL` takes the mock, and `App.tsx` renders the new `seam-banner`
  selector so the fallback is never silent — the design's silence on this is what made five
  end-to-end tests unrunnable. **6.3** added: the sign-up screen's terminal states are exhaustive and
  include a thrown error, which is the property QA's failure 1 violates. **6.4** added: the module,
  signature, `Member` field names, fixtures and per-role tokens `tests/permission-model.test.ts`
  addresses, and the statement — verified, not assumed — that the database it needs does not exist
  and is an operator decision. No file added; `size` unchanged at M. Gate BLOCKED. Raised by `qa`.
  Amended by `tech-lead-design`.
- `2026-08-31T15:35:07Z` — the operator chose to provision. Section `6.4` records the decision and
  keeps the rejected option beside it; **Appendix A** added, specifying the chore in full — the
  container runtime the CLI requires and its absence from this machine, the install and start
  commands, the local URLs, the two `TODO(verify):` items in section 4.3 that the first real
  `supabase db reset` settles, the `.gitignore` correction, the vitest-in-CI decision that breaks
  the build if it is skipped, the eight files it touches — none of them in this ticket's
  `allowed_paths`, which is why it is a separate branch — and the commit-before-switching order
  ADR-006 makes load-bearing. Every fact in it was read on 2026-08-31, and the GitHub Actions step
  is left as `TODO(verify):` because the CLI's own page does not document it. No section 1-6 change;
  `size` unchanged at M. Gate PASS. Raised by `tech-lead-design`.
