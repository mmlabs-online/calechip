---
doc_version: 3
last_updated: 2026-09-07
governed_by: [RULE-01, RULE-09]
---

# ADR-030 — The first admin arrives by a password-free bootstrap file, parameterised on an existing auth user

## Status

`ACCEPTED by tech-lead-design` — 2026-09-07, at `/triage`, under ADR-008 and
`.claude/commands/triage.md`, lines `49-51`.

Accepted rather than referred, because **this supersedes nothing.** It is ADR-009's own recorded
exit — the three steps at `.ai/board/ideas/2026-08-31-nobody-can-join-the-board.md`, lines
`349-352`, written the day ADR-009 was accepted and never contradicted since — made runnable
again after ADR-024 closed the file that used to carry it. Step 2 says *"a human applies a seed
that inserts the `team` row and one `member` row carrying that user's id with the admin role"*.
`supabase/seed.sql` was the only file that could be that seed, and `supabase/seed.sql:37-49` now
refuses to run anywhere but a disposable database. This ADR gives step 2 a file again. Every clause
below sits inside ADR-005 (no server, no elevated credential in any bundle), inside ADR-009 (the
allow-list still governs everybody after the first), inside ADR-024 (human-applied, converge-only,
named and never performed by an agent) and inside ADR-025/ADR-026 (`supabase/db.sql` stays the only
source of schema; this file creates no object). It touches no migration, so ADR-014 does not fire.

**What it does not decide, by name:**

- **It does not touch ADR-009's admission model.** Decision points 1-3 at `ADR-009:38-46` — an admin
  adds an address to the allow-list, the person signs themselves up, a trigger admits them only if
  the address is listed — stand unchanged and govern member two onwards. This file writes exactly one
  `member` row, once, for a person who by construction cannot be admitted by the trigger.
- **It does not decide the sign-up approval queue.** The `YÊU CẦU ĐĂNG KÝ MỚI` surface in the image
  attached at `/triage` reverses ADR-009 decision points 1 and 3, which carry `ACCEPTED by the
  operator`. That question **has gone back to the operator and is unanswered.** It is deliberately not
  bundled here: the queue does not solve the bootstrap, and taking a membership-model decision as a
  side effect of fixing a deadlock is the exact failure `ADR-009:55-58` recorded when it refused the
  Edge Function.
- **It does not implement anything.** The SQL described below is written by `/plan` and `/implement`.
  This ADR decides the shape.

## Context

**A freshly provisioned Supabase project running this repository's migrations admits nobody, and no
file in the repository can change that.** The cycle is closed at two independent links, and only the
first was reported.

**Link 1 — the allow-list needs an admin who needs the allow-list.**

- `supabase/migrations/20260831150024_tea01_membership.sql:44` —
  `added_by uuid not null references public.member (id) on delete restrict`.
- `supabase/migrations/20260901090000_tea02_allow_list_writes.sql:26-33` — `allowed_email_insert_admin`
  requires `public.is_admin((select auth.uid()))` and `team_id = public.member_team_id(…)`.
- `…tea01_membership.sql:78-136` — the only writer of `public.member` is the trigger, and
  `:107-109` returns having inserted nothing when the address is not on the allow-list.
- `…tea01_membership.sql:171-173` — *"`member` must NEVER gain an insert policy"*, repeated for TEA-04
  at `supabase/db.sql:740`.

**Link 2 — the link nobody named: `public.team` has no insert path and zero rows.**
`allowed_email.team_id` is `not null references public.team (id)` at `…tea01_membership.sql:43`.
`grep -rn "insert into public\." supabase/migrations/` returns exactly two hits —
`…tea01_membership.sql:111` (the trigger, inserting a `member`) and
`20260905120100_adm02_holiday_seed.sql:30` (holidays). **No migration inserts a `team` row**, no
migration grants `insert` on `public.team`, and no policy is `for insert` on it: the only three insert
paths in the whole schema are `allowed_email` (`…tea02:15, 26`), `holiday`
(`20260905140000_adm03_holiday_writes.sql:35, 63`) and `entry`
(`20260903103000_cal01_entry.sql:192, 215`). `supabase/db.sql:994-999` states the consequence in
terms: *"This file creates no rows at all. … Standing up a usable project needs one team row and one
admin member row, by hand."*

**So breaking link 1 alone leaves link 2 standing.** That is the whole reason Exit B below is not an
exit, and it is the part of the measurement that was not in the report.

**One correction to the citation the deadlock was reported with.** The seed's target guard is
`supabase/seed.sql:37-49` — the `do $$` block, with the test at `:39`
(`current_setting('calechip.seed_target', true) <> 'local'`) and the invocation hint at `:45`. Lines
`:16-36` are the comment explaining it and execute nothing. The span quoted was right; the executing
half is the second one.

**The exit ADR-009 recorded no longer runs where it is needed.** `supabase/seed.sql` carries nine
published `encrypted_password` literals (`:68, 143, 212, 249, 301, 367, 401, 424, 468`) and had
already been hand-applied to the hosted project once; ADR-024 and the guard at `:37-49` closed it to
anything but a database that can be thrown away. That closure is correct and this ADR does not touch
it.

**Two facts about the surfaces available.** There is no `supabase/config.toml` and no
`supabase/functions/` — `supabase/` holds `db.sql`, `migrations/` and `seed.sql` — so there is no
local stack and no `supabase db reset` flow, which is why `seed.sql:20-22` says the file has only ever
been applied by hand. The Supabase CLI **is** installed as a devDependency
(`package.json:39`, `node_modules/.bin/supabase`; ADR-024:53-58 measured it), so
`supabase db query --file … --db-url …` is expressible — but it needs `SUPABASE_DB_URL`, which `.env`
lists as a name and holds no value, and which a person standing up a brand-new project may not have to
hand. The dashboard SQL editor is available on every hosted project unconditionally. Decision point 8
follows from that asymmetry.

## Options considered

The test applied to each is `.claude/commands/triage.md`, lines `49-53`: does the decision sit
inside what is already decided, or would it supersede an ADR carrying `ACCEPTED by the operator`?

**Exit A — a second, password-free SQL file parameterised on an auth user that already exists.**
*Cost:* one new file; one paragraph owed in `.ai/standards/data-model.md` § *Seed data* (`:187-206`)
distinguishing it from the two things already there; one owed operator action per ADR-024 decision
point 2; the operator must know which address signed up first. *What it makes worse:* a third SQL file
in `supabase/`, and the only file in the repository that creates rows in a production project — so it
inherits ADR-024 decision point 4's hazard (`:112-124`) in full. *ADR consequence:* supersedes
nothing; agent-acceptable under ADR-008. **Chosen.**

**Exit B — make `added_by` nullable.**
**This is not an exit at all, and that objection is stronger than the one recorded on 2026-08-31.**
The 2026-08-31 verdict rejected it on cost (`…nobody-can-join-the-board.md:354-356`: amends ADR-009's
table, *"the expensive way to buy something a seed already provides"*). That still stands, but the
mechanical point was never made: **nullable `added_by` unblocks nothing.** Inserting an
`allowed_email` row still has to pass `allowed_email_insert_admin` (`…tea02:26-33`), whose first
conjunct is `public.is_admin((select auth.uid()))` — false for a member-less caller — and whose second
is `team_id = public.member_team_id(…)` — `NULL` for the same caller. And `allowed_email.team_id` is
still `not null references public.team` (`…tea01:43`) against a table with zero rows and no insert
path. *Cost if taken anyway:* a migration altering a not-null constraint, which ADR-014 makes
explicitly not `schema_delta: none`, and the deletion of the only provenance for who let somebody in
(`…tea02:22-24`). *ADR consequence:* would supersede ADR-009 — stop and ask. **Dead: not worth asking,
because it buys nothing.**

**Exit C — a `security definer` function that admits the first member only while `member` is empty.**
The only candidate that fixes this from inside the product, with a screen. *Cost:* a privileged write
path callable by any authenticated caller, on the one table the schema says twice must never gain an
insert policy (`…tea01:171-173`, `supabase/db.sql:740`); an emptiness guard that is a race without
`lock table public.member in exclusive mode` or a unique partial index. *What it makes worse:* it is
permanently present after it is spent — one repair, one truncate, one restored-from-blank environment
away from handing admin to whoever signs up next, failing open and silently with no server-side log,
which is exactly known weakness 1 in `.ai/standards/rbac-and-security.md`. It also creates a
self-service admin path, which `.ai/00-charter.md` names nowhere
(`…nobody-can-join-the-board.md:358-360`). *ADR consequence:* supersedes nothing on the letter — but it
adds a permission row to the permission table in `.ai/standards/rbac-and-security.md` at `28-46`, a
human-only file under RULE-01.
**Rejected on proportion, not on constitutionality:** Exit A buys the same outcome for one documented
copy-paste and leaves no surface behind.

**Exit D — a Supabase Edge Function holding the service-role key.**
*Cost:* the key that `.ai/standards/rbac-and-security.md:128` says is *"the whole authorization model
in a single string"* and that `.gitignore:17-20` already records leaking once at `5a29434`.
*Supersession finding:* `ADR-009:87-89` settles it in advance — *"Reaching for the Edge Function
requires superseding ADR-005 on its own terms first."* ADR-005 is `ACCEPTED by the operator`, and
ADR-027, the one document that would have created a server, is `WITHDRAWN by the operator` and never
was in force (`ADR-027:11-26`). **Stop and ask — and there is no reason to ask**, because it is the
heaviest available answer to a one-time act. **Refused.**

**Exit E — by hand in the Supabase SQL editor, as a documented, non-secret procedure.**
*Cost:* zero code, zero migration, zero supersession. It is what `supabase/db.sql:996-999` already
prescribes. *What it makes worse:* hand-typed SQL against production, in no file, with nothing
recording that it happened or with which values — ADR-024's hazard in miniature, and it is the
operator's own complaint. **Exit A is Exit E with the SQL committed, parameterised and reviewable.**
A dominates E at the cost of one file; E remains the honest fallback and is where the revert condition
below lands.

## Decision

**Exit A. `supabase/bootstrap.sql` is the third and last SQL file in `supabase/`, and it is the only
file in this repository whose purpose is to write rows to a production project.**

**1. What the file is and where it lives.** `supabase/bootstrap.sql`, beside `db.sql` and `seed.sql`.
The three have three distinct contracts and none is a second source of anything the others carry:

| File | Carries | Applied to |
|---|---|---|
| `supabase/db.sql` | the target schema — objects, no rows (`:994-999`). ADR-025, ADR-026 | a fresh project, once |
| `supabase/seed.sql` | disposable test rows, with published passwords. ADR-024 | a throwaway database only, never a hosted one (`:37-49`) |
| `supabase/bootstrap.sql` | **two rows** — one `public.team`, one admin `public.member`. This ADR | a real project, once |

**2. It is one `do $$ … $$; ` block of plain SQL with no psql meta-commands.** One statement, so it is
atomic without a `begin`/`commit` the SQL editor would fight, which closes ADR-024's
partially-applied-file hazard (`:119-121`) for this file. `supabase/seed.sql:31-32` already records the
no-meta-commands reasoning and this follows it.

**3. It carries no password and creates no auth user.** It contains no `encrypted_password`, no
`insert into auth.users`, and no credential of any kind. It reads exactly one row of `auth.users` and
writes only `public.team` and `public.member`. This is the property that lets it be committed and
applied to production at all, and it is the whole difference between this file and `seed.sql`.

**4. It is parameterised on two required settings, read with `current_setting(…, true)`:
`calechip.bootstrap_email` and `calechip.bootstrap_team_name`.** Unset or empty raises, with a hint
naming both invocations — fail closed, the same polarity as `seed.sql:39-48`. The committed file is
never edited to run it, which is deliberate: an edited-but-uncommitted SQL file is precisely the drift
ADR-024 exists about, and a person's real email address does not belong in the repository.

*Why the address and not the uuid.* The email is the one identifier the operator already has — they
watched that person sign up. The uuid has to be found in the dashboard and hand-transcribed, and the
whole procedure exists to remove a hand-transcription step, not to add one.

*Why not a psql variable* (`\set` / `:'uid'`). Those are psql meta-commands. The SQL editor is not
psql and would fail on them, and decision point 8 makes the editor the primary surface.

*Why not a bare `where email = 'literal'` in the file.* Same objection as editing the file: the
literal is a person's address, and committing it is both a leak and a lie the next reader has to
notice.

**5. It resolves the auth user by address, and matches exactly one row or raises.**
`select id from auth.users where email = current_setting('calechip.bootstrap_email')` — zero rows
raises *"no auth user with that address; sign up through the application first"*, which is ADR-009's
step 1 (`…nobody-can-join-the-board.md:349`) and the state `src/routes/NotOnATeam.tsx` already
presents. More than one row cannot occur — GoTrue carries a unique index on `auth.users.email`
(ADR-024:117) — and the file raises rather than assuming it.

**6. It settles the team by counting, not by inserting blindly.** `public.team` has
`id uuid primary key default gen_random_uuid()` and **no unique constraint on `name`**
(`…tea01_membership.sql:24-29`), so a plain `insert … on conflict do nothing` would create a *second*
team on the second run and nothing would refuse it. Therefore: zero `team` rows → insert one with
`name = current_setting('calechip.bootstrap_team_name')` and the column defaults for
`overload_threshold` and `created_at`; exactly one → **reuse its id, do not insert, and do not rename
it**; more than one → raise, because v1 is single-team (`.ai/00-charter.md:30`, with multiple teams
deferred to P2 at `:64-66`) and a project holding two teams is a state this file must not act inside.

**7. It inserts one `public.member` row with `role = 'admin'`, mirroring the trigger's own derivations.**
`id` is the resolved auth user id, `team_id` the team from point 6 — INV-07, the team comes from one
place and nowhere else. `display_name` and `avatar` are derived exactly as
`…tea01_membership.sql:113-116` derives them:
`coalesce(nullif(btrim(raw_user_meta_data ->> 'display_name'), ''), split_part(email, '@', 1))` and
`coalesce(nullif(btrim(raw_user_meta_data ->> 'avatar'), ''), '🙂')`. Two derivations of the same two
columns that disagree is a second source; this one is a copy on purpose and says so in the file.
`removed_at` stays null and `created_at` takes the column default. **No `allowed_email` row is written
and none is consumed** — admin zero was never allow-listed, and inventing a consumed entry for them
would be a false provenance record in the one table whose purpose is provenance (`…tea02:22-24`).

**8. Idempotency, and the state guard, which is the same clause.** The file is **converge-only** in
ADR-024 decision point 1's sense (`:69-79`) — it never updates an existing value — and its guard is
**the mirror image of `seed.sql`'s in shape and its opposite in mechanism.** Same shape: it fails
closed, refuses to start rather than half-running, and states what it refused. Opposite mechanism:
`seed.sql:24-30` records that no query can distinguish a local stack from a hosted one, so its guard
must *ask a human to assert* the thing it cannot measure. This file's hazard **is** a query. So it
measures instead of asking:

- A `member` row already exists for the resolved id, with `role = 'admin'` and `removed_at is null`
  → **no-op**, `raise notice 'already bootstrapped'`, commit nothing. This is the re-run case and it
  is the only silent one.
- A `member` row exists for that id with any other `role` or a non-null `removed_at` → **raise**. It
  does not promote and it does not un-remove: promotion is TEA-04's power with a permission row behind
  it (`20260901120000_tea04_member_writes.sql:29, 42-50`), and a file that quietly grants admin is the
  fail-open shape this ADR rejected Exit C for.
- **Any `member` row with `role = 'admin'` and `removed_at is null` exists for a different id**
  → **raise.** The project already has a way in; this file's job is done and running it again can only
  add a second admin nobody asked for. This is the clause that stands between the file and a second
  admin on production, and it is the one the revert condition watches.

**9. How it is run: by a human, through the dashboard SQL editor, and never by an agent.** RULE-09,
and `supabase/seed.sql:1` sets the precedent sentence this file repeats in its own first line. The
editor is the primary surface because it is the only one that exists unconditionally on a hosted
project: there is no local stack (no `supabase/config.toml`), and while the CLI is installed
(`package.json:39`), `supabase db query --db-url` needs a connection string that `.env` lists as a
name and does not hold. Both invocations are named in the file's header, editor first:

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

**When a ticket's diff touches `supabase/bootstrap.sql`, `/ship` names the owed operator action in its
reply and does not perform it** — ADR-024 decision point 2 (`:81-93`), extended to this file by
naming, not by a new mechanism.

## Consequences

- **A file that runs on production is a file that runs on production, and decision point 8's third
  clause is the only thing between it and a second admin.** Do not read that clause as belt and
  braces. It is the control. It is one `raise` inside a `do` block written by an agent, reviewed once
  at merge, and never exercised by any test — `.ai/board/tickets/BUG-001/ticket.yaml` §5 records that
  the end-to-end suite is pinned to the mock seam and is structurally incapable of reaching the live
  project, and ADR-024 decision point 3 (`:97-110`) forbids adding a check that reads it. So this
  file's guard is **unverified by anything except a human reading it**, which is strictly weaker than
  `seed.sql`'s guard was — that one fails closed on an unset flag before touching a row, and this one
  fails closed on a query it must first get right.
- **The ADR-024 decision point 4 hazard applies to this file with full force** (`:112-124`): before
  the first application to a project that may already hold rows, a human performs a read-only listing.
  For this file the listing is two queries — `select id, name from public.team` and
  `select id, role, removed_at from public.member` — and they are also exactly what decision point 8
  checks, so a surprising answer to either means stop rather than adjust.
- **Drift against `supabase/db.sql` is a new, undetected class.** ADR-025 made `db.sql` never a second
  source of *objects*; this file is not one either. But it names columns —
  `public.team (name)` and `public.member (id, team_id, display_name, avatar, role)` — and the moment a
  migration adds a `not null` column without a default to either table, or renames one, this file
  breaks and **nothing in the repository notices**: it is not applied by any test, not parsed by any
  check, and not read by `scripts/check-docs.mjs`. It will be discovered by a person standing up a
  project, which is the worst possible moment. Its two derivations copied from
  `…tea01_membership.sql:113-116` (decision point 7) are a second copy of the same expressions and can
  drift the same way. Both are accepted; neither is mitigated by this ADR.
- **A third SQL file raises the cost of reading `supabase/`.** Anyone who now asks *"which file do I
  apply?"* has three answers instead of two, and two of them must never be applied to the same
  database. Decision point 1's table is the whole mitigation, and it lives here rather than in a
  standard until a human moves it.
- **This closes the `TODO(project)` on TEA-01's registry row** — *"the first-team and first-admin
  bootstrap is not a capability of this feature — a human applies a seed, per the re-triage verdict in
  the idea file"* — which has been open since 2026-08-31 because the seed it points at was closed to
  hosted projects by ADR-024. The bootstrap now exists as a named file with a contract. **This ADR does
  not edit that row.** Registry feature rows are `product`'s under ADR-007; the cell is theirs to
  append to and this paragraph is the notice that it is now appendable.
- **The first admin still gets no feature row and no screen**, exactly as
  `…nobody-can-join-the-board.md:358-361` decided. Nothing here becomes a capability of the product,
  and a person reading the running application will still find no way to create a team.
- **`.ai/standards/data-model.md` § *Seed data* (`:187-206`) is left incomplete by this ADR.** It says
  *"Two different things, and conflating them is how a correction gets reverted"* and there are now
  three. That file is standards plane, human-owned under RULE-01, and the third bullet is owed to a
  human. It is named here so it is not lost.
- **ADR-024's own owed edit to `.claude/commands/ship.md` has not landed** — `grep -n supabase
  .claude/commands/ship.md` returns nothing today. So decision point 9's "`/ship` names the owed
  action" describes a behaviour that is decided and not yet wired, for `seed.sql` and now for this
  file both. Until that edit lands, the operator hears about the owed application only if the agent
  remembers.

## Revert condition

**Observable, by two queries against the hosted project:**

```sql
select count(*) from public.team;                                              -- must be 1
select count(*) from public.member where role = 'admin' and removed_at is null; -- must be >= 1, and
                                                                                -- every id must be one
                                                                                -- a human bootstrapped
                                                                                -- or TEA-04 promoted
```

**If the first ever returns a number other than 1, or if an admin `member` row is ever found that no
human bootstrapped and no TEA-04 promotion produced**, then decision point 8's third clause failed
open, this decision was wrong, and the file is **deleted** rather than patched. The procedure reverts
to Exit E — hand-typed SQL in the SQL editor, per `supabase/db.sql:996-999` — which cannot be run by
accident precisely because it is not a file. The trade this ADR makes is reviewability against
runnability, and a file that ran when nobody meant it to has lost that trade outright.

**Separately, if the operator accepts the sign-up approval queue**, admission stops being allow-list-
first and the first admin may arrive by whatever that ADR decides. This one is then superseded rather
than amended, because decision points 5 through 8 are all about a person who exists in `auth.users`
and in no other table — a state the queue exists to abolish.

## Two stale facts found on the way, owned by nobody and fixed by nothing here

`supabase/db.sql` § 9.1 (`:931-943`) says `public.team` has no select policy and no select grant, and
§ 9.2 (`:948-961`) says it has no update policy and no `grant update (overload_threshold)`, with ADM-01
marked *"THE TICKET IS BLOCKED"*. **Both statements are false.**
`20260904100000_cal04_team_select.sql:34-38` shipped the grant and `team_select_own`, and
`20260905000000_adm01_team_threshold.sql:43` and `:62-66` shipped the grant and `team_update_admin`.
Under ADR-026 that file is the target schema and is applied by hand to stand up a fresh project — the
same act this ADR is about — so a person following § 9 while bootstrapping will believe two shipped
screens are broken, and may go looking for work that is already done. **This ADR does not own it and
does not fix it:** correcting `db.sql` is a chore for the session that regenerates it under ADR-025,
not something to fold into a decision about rows. It is recorded here rather than lost.

## Changed by this ADR

| File | Change | Plane |
|---|---|---|
| `supabase/bootstrap.sql` | created, per decision points 1-8 | agent, at `/implement` |
| `.ai/standards/data-model.md` | § *Seed data* (`:187-206`) needs a third bullet — two things are now three | **human, owed** |
| `.claude/commands/ship.md` | ADR-024's owed edit, extended to name `supabase/bootstrap.sql` | steward, owed |
| `.ai/registry/features.md` | TEA-01's `TODO(project)` is now closable — **`product`'s cell, ADR-007** | agent, not this one |
| `supabase/db.sql` | nothing here. §§ 9.1 and 9.2 are stale; see the section above | chore, unowned |
| `supabase/seed.sql` | nothing. Its guard is correct and is not touched | — |

No edit above is made by this ADR.
