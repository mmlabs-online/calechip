---
ticket: OPS-004
stage: PLAN
agent: tech-lead-design
produced_at: 2026-09-07T20:42:15+07:00
inputs_read:
  - .ai/board/tickets/OPS-004/ticket.yaml
  - .ai/registry/features.md
  - .ai/registry/invariants.md
  - .ai/registry/decisions/ADR-030-the-first-admin-arrives-by-a-password-free-bootstrap-file.md
  - .ai/registry/decisions/ADR-024-the-seed-is-human-applied-and-converge-only.md
  - .ai/standards/architecture.md
  - .ai/standards/rbac-and-security.md
  - supabase/migrations/20260831150024_tea01_membership.sql
  - supabase/migrations/20260901090000_tea02_allow_list_writes.sql
  - supabase/seed.sql
  - supabase/db.sql
  - scripts/check-allowed-paths.mjs
  - package.json
consulted: []
chat_before_verdict: none
gate: PASS
blocking_reason: ""
next_state: READY
---

# OPS-004 — A password-free bootstrap file that creates the first team and the first admin

## 1. Problem and scope

**Feature IDs.** `feature_ids: [TEA-01]`, transcribed from `.ai/registry/features.md:126` without
paraphrase:

> | TEA-01 | Sign up and establish the member record | TEA | DONE | INV-04, INV-07 |

That row's `Notes` cell carries the marker this ticket exists to answer, quoted verbatim:

> TODO(project): the first-team and first-admin bootstrap is not a capability of this feature — a
> human applies a seed, per the re-triage verdict in the idea file.

and, appended at `/triage` on 2026-09-07, the sentence that binds this plan:

> **The marker closes when OPS-004 ships, not now.**

**Definition of Ready item 1 constrains `feature_ids`, not the ticket `id`** — stated in that same
cell, on the BUG-001 precedent. `OPS-004` is a chore, per `.ai/01-operating-model.md:317`.

**The capability nobody gains, and why that is the point.** No role gains anything. A freshly
provisioned Supabase project running this repository's migrations admits nobody, and the deadlock is
closed at two independent links: an `allowed_email` row needs an admin `member`
(`…tea01_membership.sql:44`, `…tea02_allow_list_writes.sql:26-33`), and `allowed_email.team_id` is
`not null references public.team` (`…tea01_membership.sql:43`) against a table with zero rows and no
insert path anywhere in the schema. `member` may never gain an insert policy —
`…tea01_membership.sql:170-173`, repeated at `supabase/db.sql:577` and `:741-743`. The only exit the
repository ever documented was `supabase/seed.sql`, whose guard at `:37-49` now refuses any target
that is not `local` (ADR-024), because every password in that file is published here.
`supabase/db.sql:998` states the consequence in its own words: *"Standing up a usable project needs
one team row and one admin member row, by hand."*

This ticket adds `supabase/bootstrap.sql` — **one file, applied once, by a human, to a real
project** — so that the hand in that sentence has something reviewable to apply. The shape is fixed
by ADR-030, `ACCEPTED by tech-lead-design` under ADR-008 because it supersedes nothing: it is
ADR-009's own recorded exit made runnable again after ADR-024 closed the file that used to carry it.

**This ticket rests on ADR-030 and that is not `depends_on`.** If the operator declines ADR-030 at
merge, the ticket is invalid rather than blocked, and the correct action is to close it —
`ticket.yaml` § 0.

**Out of scope.**

- **Every screen. This ticket ships no interface at all.** The image attached at `/triage` stays with
  the idea and specifies nothing, because the verdict there was NEEDS-ADR
  (`.claude/commands/triage.md:68-69`; `.ai/standards/ui-design-system.md` § *Visual specification*).
  No `design/` directory exists on this ticket and none is to be created.
- **The sign-up approval queue (`YÊU CẦU ĐĂNG KÝ MỚI`).** It reverses ADR-009 decision points 1 and
  3, both `ACCEPTED by the operator`. One question went back to the operator at triage and is
  unanswered. **If implementation finds itself adding a pending state, a requests table, or a trigger
  that files a sign-up, it has crossed into that decision and must stop and ask.**
- **`supabase/seed.sql`, in every respect.** Its guard is correct, its credentials stay unusable
  against a real project, and this ticket adds a file beside it rather than touching it.
- **Making `allowed_email.added_by` nullable.** Refused twice, and the mechanical objection is the
  stronger one: it unblocks nothing (ADR-030, Exit B).
- **A `security definer` first-admin function, an Edge Function, or any component holding the
  service-role key.** ADR-030 Exits C and D; ADR-005; ADR-009:87-89.
- **`.ai/standards/data-model.md` § *Seed data* (`:187-206`), which now describes two things while
  `supabase/` will hold three.** Standards plane, human-only under RULE-01 and `CLAUDE.md` § *Two
  planes*. **It must not enter `allowed_paths`** and the third bullet is owed to a human. Recorded in
  ADR-030's *Consequences* and in `ticket.yaml` § 8; named here so a plan that inherited the ADR's
  costing does not try to write it.
- **`supabase/db.sql`, including § 9.4.** ADR-030's *Changed by this ADR* table says *"nothing here"*
  for that file, and §§ 9.1 and 9.2 are separately stale (they claim `public.team` has no select and
  no update policy; `20260904100000_cal04_team_select.sql:34-38` and
  `20260905000000_adm01_team_threshold.sql:43, 62-66` both shipped). **The cost of holding this line
  is stated rather than hidden:** § 9.4 at `:995-998` is the only place in the repository that tells a
  person standing up a project they need a team row and an admin row, and after this ticket it will
  still say *"by hand"* without naming `supabase/bootstrap.sql`. That pointer is owed to the `db.sql`
  regeneration chore under ADR-025, which has no ticket. See § 8, rejected alternative 3.
- **An automated test.** § 2, *What nothing verifies*, records why one cannot exist and what stands
  in its place.
- **Applying the file to anything.** RULE-09 and ADR-024 decision point 2: human-applied and named,
  never performed by an agent.

`size_estimate: S` — one new file, no migration, no TypeScript, no test harness.

## 2. Acceptance criteria

The subject of every criterion below is **applying `supabase/bootstrap.sql` to a database**, as one
submission, with the two settings established beforehand per § 4.

**AC-1 — either setting missing or blank refuses, and says how to supply both.**
- Given `calechip.bootstrap_email` or `calechip.bootstrap_team_name` is unset, empty, or
  whitespace-only
- When the file is applied
- Then it raises an exception whose message names the setting that is missing and whose hint names
  **both** invocations from § 4, and **no row is written to any table**

**AC-2 — no such auth user refuses, and points at sign-up.**
- Given both settings are supplied, and `auth.users` holds no row whose address matches
  `calechip.bootstrap_email`
- When the file is applied
- Then it raises `no auth user with that address; sign up through the application first`, and no row
  is written

**AC-3 — the address is matched case- and whitespace-insensitively.**
- Given an `auth.users` row whose `email` is `admin-zero@example.com`, and
  `calechip.bootstrap_email` is set to `  Admin-Zero@Example.COM  `
- When the file is applied
- Then that row is the one resolved, and the outcome is the same as if the address had been typed
  exactly

**AC-4 — an empty project is bootstrapped: exactly one team, exactly one admin.**
- Given `public.team` holds zero rows, `public.member` holds zero rows, and exactly one `auth.users`
  row matches `calechip.bootstrap_email`
- When the file is applied with `calechip.bootstrap_team_name` set to `CaleChip`
- Then `public.team` holds exactly one row, with `name = 'CaleChip'`, `overload_threshold = 0.5` and
  `created_at` from the column defaults (`…tea01_membership.sql:24-29`)
- And `public.member` holds exactly one row, with `id` = the resolved auth user id, `team_id` = that
  team's id, `role = 'admin'`, `removed_at` null, `created_at` from the column default, and
  `display_name` and `avatar` equal to what `…tea01_membership.sql:113-117` would have derived for
  the same auth user
- And `public.allowed_email` is unchanged — **no row is written and none is consumed**

**AC-5 — one existing team is reused, never renamed and never duplicated.**
- Given `public.team` holds exactly one row named `Đội A`, and `calechip.bootstrap_team_name` is set
  to `CaleChip`
- When the file is applied
- Then `public.team` still holds exactly one row, still named `Đội A`
- And the member row written by AC-4 carries that existing team's `id`

**AC-6 — two or more teams refuses.**
- Given `public.team` holds two or more rows
- When the file is applied
- Then it raises, naming the count it found, and no row is written

**AC-7 — re-running for an already-bootstrapped admin is a silent no-op.**
- Given `public.member` holds a row whose `id` is the resolved auth user id, with `role = 'admin'`
  and `removed_at` null
- When the file is applied
- Then it emits `notice: already bootstrapped`, raises nothing, and writes no row — **whether or not
  other active admins exist.** This clause is evaluated before AC-9 and is the only silent outcome

**AC-8 — an existing member row for that id with any other shape refuses. It never promotes and
never un-removes.**
- Given `public.member` holds a row whose `id` is the resolved auth user id, and that row has
  `role = 'member'`, **or** a non-null `removed_at`
- When the file is applied
- Then it raises, naming the `role` and `removed_at` it found, and no row is written or updated

**AC-9 — a different active admin refuses. This is the control.**
- Given `public.member` holds no row for the resolved auth user id, and holds at least one row with
  `role = 'admin'` and `removed_at` null under some other id
- When the file is applied
- Then it raises, stating that the project already has an admin, and no row is written

**AC-10 — a refusal leaves the database exactly as it was.**
- Given any of AC-1, AC-2, AC-6, AC-8 or AC-9 holds
- When the file is applied
- Then `select count(*) from public.team`, `select count(*) from public.member` and
  `select count(*) from public.allowed_email` return what they returned before the application

**AC-11 — the file carries no credential and creates no auth user.**
- Given the committed `supabase/bootstrap.sql`
- When it is searched
- Then it contains no `encrypted_password`, no `insert into auth.users`, no `update auth.`, no
  password, token or key of any kind, and no email address other than the placeholder in its own
  header comment
- And the only tables it writes are `public.team` and `public.member`; the only table it reads
  outside those is `auth.users`, by `select`

**AC-12 — the file applies unchanged in the Supabase dashboard SQL editor.**
- Given the committed `supabase/bootstrap.sql`
- When it is searched
- Then it contains no psql meta-command — no line beginning `\` — so the editor, which is not psql,
  can accept it verbatim (`supabase/seed.sql:31-32` is the precedent)

**AC-13 — the file states its own procedure, in its own header, editor first.**
- Given the committed `supabase/bootstrap.sql`
- When its header comment is read
- Then its first line says the file is applied by a human and never by an agent (RULE-09, mirroring
  `supabase/seed.sql:1`)
- And the header names **both** invocations of § 4, dashboard SQL editor first, with a placeholder
  address that is not a real person's
- And it states, in one sentence each: that it contains no password and creates no auth user; that
  the read-only listing of § 3 is performed before the first application; and that its two derived
  columns are a deliberate copy of `…tea01_membership.sql:113-117`

**Invariants touched: `[INV-07]`.**

- **INV-07** — *"Every entry belongs to exactly one member, and is counted only against the team that
  member belongs to."* This file establishes the single `team` row and the `team_id` of the first
  `member`, so it is where the mapping INV-07 presumes comes from. AC-5 and AC-6 are what protect it:
  a second team row would silently partition the roster, and every count downstream would be correct
  against the wrong denominator. The trigger's own comment at `…tea01_membership.sql:114` marks the
  same line — *"INV-07: the team comes from here and nowhere else"* — and this file is that same
  `nowhere else` for one row.
- The other six are untouched, and the reason is one sentence: this file writes no `entry` row and
  defines no count, so INV-01 through INV-06 have nothing here to be true or false about.

**What nothing verifies, and it is not a gap that can be closed here.** No automated check reaches
this file. Nothing in `scripts/`, `.claude/hooks/` or `.github/workflows/` reads `supabase/` at all
(`grep` over all three returns nothing); `pnpm test` is Vitest against the mock seam and
`pnpm e2e` is Playwright, which `BUG-001` pinned to the mock seam and which ADR-024 decision point 3
forbids pointing at a real project; there is no `supabase/config.toml`, so there is no local stack to
apply it to. **So AC-1 through AC-13 are observable by a human applying the file, and by nothing
else.** ADR-030's *Consequences* says this in terms: the guard is *"unverified by anything except a
human reading it"*. AC-11, AC-12 and AC-13 are deliberately written to be checkable by `grep` and by
reading, because they are the subset that a reviewer at REVIEW can actually settle.

**Open questions: none.** The unanswered sign-up-approval-queue question is real and is recorded in
ADR-030 and in `ticket.yaml` § 3, but it does not bear on any criterion above: every one of them
describes a person who exists in `auth.users` and in no other table, which is the state the queue
would abolish. If the operator accepts the queue, ADR-030 is superseded and this ticket is
reconsidered whole — it is not amended.

### 2b. Visual reference

```
Visual reference: none. The layout below is the Tech Lead's own and was never specified.
```

**And there is no layout, because this ticket builds no screen.** The line above is written because
the gate requires exactly one of the two, and this is the honest one: no image binds this plan. The
image attached at `/triage` is out of scope entirely (§ 1) — a NEEDS-ADR verdict leaves the image
with the idea, and the operator sees no new surface from this ticket at all. The only thing a person
will read is a SQL file's comment header, whose content is fixed by AC-13.

## 3. Permission model

**No product role gains or loses anything.** The permission table at
`.ai/standards/rbac-and-security.md:28-46` is unchanged by this ticket — no row is added, edited or
removed. That is a load-bearing property: ADR-030 rejected Exit C partly *because* it would have
added a row to a human-only file under RULE-01.

| Actor | May, after this ticket | Where the check lives |
|---|---|---|
| `anon` | nothing new. Still `revoke all on public.team, public.member, public.allowed_email from anon, authenticated` (`…tea01_membership.sql:145`) | Postgres grants and RLS |
| `authenticated` `member` | nothing new. No insert on `team`, none on `member` | RLS; `member` has no insert policy and permanently may not (`…tea01_membership.sql:170-173`) |
| `authenticated` `admin` | nothing new. Still cannot create a team and still cannot insert a `member` | as above |
| **the human applying the file** | inserts one `team` row and one admin `member` row, once | **the file's own `raise` clauses, and nothing else** |

**The denials, stated as denials.**

- **No role reachable from the browser may run any part of this.** The file is not a function, not a
  policy and not a grant; it creates no callable object, so there is no surface left behind after it
  is applied. This is the whole of what Exit C would have cost and this ticket does not pay it.
- **No agent applies it, ever.** RULE-09, ADR-024 decision point 2. `/ship` names the owed operator
  action in its reply and does not perform it. **A caveat the reviewer should know:** ADR-024's own
  owed edit to `.claude/commands/ship.md` has not landed — `grep -n supabase .claude/commands/ship.md`
  returns nothing today — so that naming is a behaviour the agent must remember rather than one the
  command file instructs. That edit is the steward's and is not in this ticket's scope.
- **It does not promote and it does not un-remove** (AC-8). Promotion is TEA-04's power, with a
  permission row behind it (`20260901120000_tea04_member_writes.sql:29, 42-50`). A file that quietly
  grants admin is the fail-open shape ADR-030 rejected Exit C for.
- **It writes no `allowed_email` row and consumes none** (AC-4). Admin zero was never allow-listed,
  and inventing a consumed entry for them would be a false provenance record in the one table whose
  purpose is provenance (`…tea02_allow_list_writes.sql:22-24`).

**The privileged context is the connection, not the code.** The file is applied through the dashboard
SQL editor or a `psql` session on `SUPABASE_DB_URL` — both of which are already the database owner
and already bypass row-level security. This ticket adds no new way to reach that context; it adds a
reviewable script to run once inside a context the operator already has.

**The read-only listing, which is an obligation and not a suggestion.** ADR-024 decision point 4
(`:112-124`): nobody can confirm what a hosted project contains from this repository, and ADR-024
declined a drift detector. **Before the first application to any project that may already hold rows,
the applying human runs these two queries and reads the answers:**

```sql
select id, name from public.team;
select id, role, removed_at from public.member;
```

They are exactly what AC-5 through AC-9 test, so **a surprising answer to either means stop rather
than adjust.** AC-13 puts this sentence in the file's header, which is the only place the person
holding the SQL editor will see it.

## 4. Contract

**The artefact.** `supabase/bootstrap.sql` — one file, **one statement**: a single
`do $$ … $$;` block. One statement is atomic without a `begin`/`commit` that the SQL editor would
fight, which is what makes AC-10 true by construction and closes ADR-024's partially-applied-file
hazard (`:119-121`) for this file. ADR-030 decision point 2.

**Inputs — two required settings, and nothing else.**

| Setting | Type | Required | Read as |
|---|---|---|---|
| `calechip.bootstrap_email` | `text` | yes | `nullif(btrim(coalesce(current_setting('calechip.bootstrap_email', true), '')), '')` |
| `calechip.bootstrap_team_name` | `text` | yes | `nullif(btrim(coalesce(current_setting('calechip.bootstrap_team_name', true), '')), '')` |

`current_setting(…, true)` returns `NULL` rather than raising when the name is unset — the same
mechanism `supabase/seed.sql:39` already uses, so this is not a new one. The `btrim`/`nullif` wrapper
is what makes a whitespace-only value fail AC-1 rather than reaching `name text not null` as a blank
team name.

**The committed file is never edited in order to run it.** An edited-but-uncommitted SQL file is
precisely the drift ADR-024 exists about, and a person's real email address does not belong in this
repository. ADR-030 decision point 4.

**Invocations — both, editor first, verbatim in the file header (AC-13).**

```sql
-- Supabase dashboard → SQL editor, as one submission:
set calechip.bootstrap_email     = 'admin-zero@example.com';
set calechip.bootstrap_team_name = 'CaleChip';
-- …then paste supabase/bootstrap.sql below this line.
```

```bash
# or, when SUPABASE_DB_URL is to hand:
PGOPTIONS="-c calechip.bootstrap_email=admin-zero@example.com -c calechip.bootstrap_team_name=CaleChip" \
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 --single-transaction -f supabase/bootstrap.sql
```

**Resolution of the auth user (AC-2, AC-3).**

```sql
select u.id, u.email, u.raw_user_meta_data
  into v_uid, v_email, v_meta
  from auth.users u
 where lower(btrim(u.email)) = lower(v_email_setting);
```

**Deviation from ADR-030 decision point 5's literal SQL, stated rather than slipped in.** The ADR
writes `where email = current_setting('calechip.bootstrap_email')`. This plan lowercases and trims
both sides. The decision the ADR takes — *"resolves the auth user by address, and matches exactly one
row or raises"* — is unchanged; only the matching predicate is widened, because the operator types
this address by hand into a dashboard field and a capitalised first letter returning *"no auth user
with that address"* would send them looking for a sign-up that already happened. ADR-030 point 5 also
argues that more than one row cannot occur, citing GoTrue's unique index on `auth.users.email`; a
case-insensitive predicate weakens that argument, so **the file counts rather than assuming**: `> 1`
match raises, naming the count. That is what ADR-030 says the file does in the same sentence
(*"raises rather than assuming it"*), so the widening costs nothing it was relying on.

**The team (AC-4, AC-5, AC-6).** `public.team` has `id uuid primary key default gen_random_uuid()`
and **no unique constraint on `name`** (`…tea01_membership.sql:24-29`), so `on conflict do nothing`
cannot express *"reuse the one team"* — it would create a second team on the second run and nothing
would refuse it.

| `select count(*) from public.team` | Behaviour |
|---|---|
| `0` | `insert into public.team (name) values (v_team_name) returning id into v_team_id` — `overload_threshold` and `created_at` take the column defaults |
| `1` | `select id into v_team_id from public.team` — **do not insert, do not rename** |
| `> 1` | `raise` — v1 is single-team (`.ai/00-charter.md:30`, multiple teams deferred to P2 at `:64-66`) and a project holding two is a state this file must not act inside |

**The member row (AC-4), and the precedence among AC-7, AC-8 and AC-9.** Evaluated in this order, and
the order is the contract:

1. a row exists for `v_uid` with `role = 'admin'` and `removed_at is null` →
   `raise notice 'already bootstrapped'`, write nothing, **return** (AC-7)
2. a row exists for `v_uid` with any other `role`, or a non-null `removed_at` → `raise` (AC-8)
3. any row with `role = 'admin'` and `removed_at is null` exists under a different id → `raise`
   (AC-9)
4. otherwise, insert:

```sql
insert into public.member (id, team_id, display_name, avatar, role)
values (
  v_uid,
  v_team_id,   -- INV-07: the team comes from here and nowhere else
  coalesce(nullif(btrim(v_meta ->> 'display_name'), ''), split_part(v_email, '@', 1)),
  coalesce(nullif(btrim(v_meta ->> 'avatar'), ''), '🙂'),
  'admin'::public.member_role
);
```

`removed_at` stays null and `created_at` takes the column default. **The two derived columns are a
deliberate, marked copy of `…tea01_membership.sql:113-117`.** Two derivations of the same two columns
that disagree is a second source; this one is a copy on purpose and the file says so in a comment, per
AC-13. ADR-030 decision point 7.

**Error and notice text.** AC-1, AC-2, AC-6, AC-8 and AC-9 each require the message to name what was
found; the wording beyond that is the Developer's, with one exception — **AC-2's message is fixed
verbatim** because ADR-030 decision point 5 fixes it: `no auth user with that address; sign up through
the application first`. Every `raise exception` carries a `using hint =` naming the two queries of
§ 3, on the pattern of `supabase/seed.sql:40-46`.

**Return type: none.** The file returns no result set. Its observable outputs are exactly three: the
rows it wrote, the notice it emitted, and the exception it raised.

## 5. Seam impact

**None.** No function in the data-access seam changes, and no function is added. This ticket touches
no file under `src/`, so `src/lib/seam.ts`, `src/lib/supabase.ts`, `src/lib/mock.ts` and
`src/lib/fixtures.ts` are all unchanged and the seam-parity test is unaffected. RULE-02 is not
engaged: the file is applied to the database directly by a human, outside the running application,
and no component reaches it.

## 6. Schema delta

**`none`.** Confirmed at PLAN rather than inherited from the shell.

**This ticket writes no migration.** The file it adds creates **rows**. It adds no table, no column,
no type, no policy, no trigger, no constraint, no grant, no index and no function, so ADR-014 — *a
migration touching a policy, trigger or constraint is not `none`* — does not fire on it. The
precedent is exact: ADR-024 governs `supabase/seed.sql`, which also creates rows and is also not a
migration.

**ADR-030 is linked as the decision this whole ticket rests on, not as the schema-delta ADR that
Definition of Ready item 4 asks for.** Conflating those two reasons would make this field look graded
when it is not. `requires_adr` stays `false` for the same reason and the ADR exists regardless.

**One consequence this plan accepts and does not mitigate**, recorded in ADR-030's *Consequences*:
the file **names columns** — `public.team (name)` and
`public.member (id, team_id, display_name, avatar, role)`. The moment a migration adds a `not null`
column without a default to either table, or renames one, this file breaks and **nothing in the
repository notices** (§ 2, *What nothing verifies*). It will be discovered by a person standing up a
project, which is the worst possible moment.

## 7. allowed_paths

```yaml
allowed_paths:
  - "supabase/bootstrap.sql"
```

One path, and it is the whole ticket. The ticket folder `.ai/board/tickets/OPS-004/` and the
ship-owned set are exempt by name in `scripts/check-allowed-paths.mjs:130-132`, so neither is
enumerated here.

**Three paths a reader might expect and will not find, each excluded deliberately:** no `src/**` (§ 5
— nothing in the application changes), no `supabase/migrations/**` (§ 6 — no migration), no
`tests/**` (§ 2 — no automated check can reach this file, and writing one that could is forbidden by
ADR-024 decision point 3).

`size: S`. **`size_estimate` and `size` agree**, both `S`, which is the uninteresting outcome and is
recorded because ADR-012 asks for the comparison either way: one new file of perhaps eighty lines,
most of them comment, with no second file to keep in step.

## 8. Rejected alternatives

ADR-030 already rejected the four other exits at the level of the decision — nullable `added_by`, a
`security definer` first-admin function, an Edge Function, and hand-typed SQL in the editor with
nothing committed. Those are not re-argued here. What follows are the three choices this **plan** had
to make that the ADR left open or that reading the schema opened.

**1. Parameterise on the auth user's uuid rather than their email address.**
Genuinely plausible: it is the primary key, `member.id references auth.users (id)` takes it directly,
and it sidesteps every question of case and of GoTrue's storage. **Rejected on where the value comes
from.** The uuid exists only in the Supabase dashboard's user list and has to be found there and
hand-transcribed into the SQL editor — and the whole procedure exists to remove a hand-transcription
step, not to add one. The email address is the identifier the operator already has: they watched that
person sign up, and it is what the person typed. The cost of the choice is AC-3, which is one `lower`
and one `btrim`, and the count-and-raise in § 4 that pays for widening the predicate.

**2. Write it as a plain `insert … select … on conflict do nothing`, with no `do $$` block.**
Plausible on the face of it — it is shorter, it is what `supabase/seed.sql:51-58` does for its own
team row, and `on conflict do nothing` reads like idempotence. **Rejected on two counts, the first
mechanical and fatal.** `public.team` has no unique constraint on `name`
(`…tea01_membership.sql:24-29`), so there is no conflict target that means *"a team already exists"*;
the second run inserts a **second team** and nothing refuses it. The seed gets away with it only
because it inserts a hard-coded `id` and conflicts on the primary key, which this file cannot do —
its whole point is not to carry literals. Second: AC-6, AC-8 and AC-9 are refusals with different
messages selected by a query, and a statement-level `on conflict` clause cannot express any of them.
AC-9 in particular — *a different active admin already exists* — is the single control standing
between this file and a second admin on a production project, and it is not expressible without a
procedural block.

**3. Put the procedure in a document — `SETUP.md`, `README.md`, or `db.sql` § 9.4 — rather than in
the file's own header.**
This is the alternative with a real cost on both sides, and it is why § 1 carries an out-of-scope
bullet about `db.sql` § 9.4 instead of silence. **Rejected, with the loss named.** `SETUP.md` and
`README.md` are about standing up a project *from the kit* — the operating model, the hooks, the
registry — and neither mentions Supabase or this product's deployment at all; a CaleChip-specific
bootstrap paragraph in either is off-topic where it sits and is a second copy of instructions that
already have a home. `supabase/db.sql` § 9.4 **is** the right place a reader would look, and it is
exactly the place ADR-030's *Changed by this ADR* table marks *"nothing here"*: that file is
regenerated under ADR-025 by a session that owns it, and opening it in this ticket's `allowed_paths`
would put its two separately-stale sections (§§ 9.1, 9.2) in front of a developer who was told not to
fix them. So the header carries the procedure, on the precedent of `supabase/seed.sql:16-36`, which
is the same directory and the same shape of file. **What that costs:** until the `db.sql`
regeneration chore lands, § 9.4 will still say a team row and an admin row are needed *"by hand"*
without naming the file that does it, and the file's discoverability rests on somebody listing
`supabase/`. That pointer is one sentence and it is owed to a session that does not yet exist.

## Changelog

- `2026-09-07T20:42:15+07:00` — sections 1–8 written. Raised by `tech-lead-design`.
- `2026-09-07T20:42:15+07:00` — section 4, after reading `…tea01_membership.sql`: the auth-user
  predicate widened from ADR-030 decision point 5's `email = current_setting(…)` to a trimmed,
  lowercased comparison, with an explicit count-and-raise replacing the ADR's reliance on GoTrue's
  unique index. AC-3 added to cover it. Reason and the argument it weakens are stated in § 4 rather
  than only here. Raised by `tech-lead-design`. Amended by `tech-lead-design`.
- `2026-09-07T20:42:15+07:00` — section 1, out of scope: `supabase/db.sql` § 9.4 added as an explicit
  exclusion with its cost named, after § 8 alternative 3 established that it is the place a reader
  would look and the place ADR-030 forbids this ticket to touch. Raised by `tech-lead-design`.
  Amended by `tech-lead-design`.
